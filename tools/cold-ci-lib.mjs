/** Cold-CI stamps are local operator results, never independent attestation. */
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEST_CHECKPOINT_SCHEMA, TEST_INVOCATION_ENV, TEST_INVOCATION_SCHEMA, TEST_RESULT_TRUST,
  collectTestFiles, testInvocationReportPath, testWorkflowIdentity, writeJsonAtomic,
} from './test-workflow.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const COLD_CI_SCHEMA = 'vugg-cold-ci-stamp-v2';
export const COLD_CI_TRUST = 'local-ci-result-not-independent-attestation';
export const COLD_CI_INCONCLUSIVE = 2;

function readGitState(root) {
  const git = args => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: 'pipe', windowsHide: true,
  }).trim();
  return { commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '' };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function simVersion(root) {
  try {
    const source = fs.readFileSync(path.join(root, 'js', '15-version.ts'), 'utf8');
    const match = /const SIM_VERSION = (\d+)/.exec(source);
    return match ? Number(match[1]) : null;
  } catch { return null; }
}

function matchingInvocation(result, invocationId) {
  return result?.schema === TEST_INVOCATION_SCHEMA && result.invocation_id === invocationId;
}

const sameFiles = (actual, expected) => Array.isArray(actual) && Array.isArray(expected)
  && actual.length === expected.length && actual.every((file, index) => file === expected[index]);

export function fullTestResultProblems({ result, invocationId, identity, allFiles }) {
  const reasons = [];
  if (!matchingInvocation(result, invocationId)) reasons.push('missing or foreign test invocation result');
  if (result?.status !== 0 || result?.outcome !== 'completed') reasons.push('test invocation did not complete successfully');
  const report = result?.completion;
  if (report?.schema !== TEST_CHECKPOINT_SCHEMA || report?.status !== 'pass'
      || report?.full_suite_pass !== true || report?.trust !== TEST_RESULT_TRUST) {
    reasons.push('no uninterrupted full-suite result (resumed and selected runs are partial)');
  }
  if (!identity?.sha256 || report?.identity?.sha256 !== identity.sha256) {
    reasons.push('test result does not match the current project/runtime identity');
  }
  if (!Array.isArray(allFiles) || !allFiles.length || !sameFiles(report?.completed_files, allFiles)) {
    reasons.push('test result does not cover the exact discovered suite');
  }
  if (!Array.isArray(report?.batches) || !report.batches.length
      || !report.batches.every(batch => Array.isArray(batch?.files) && batch.files.length > 0)
      || !sameFiles(report.batches.flatMap(batch => batch.files), allFiles)) {
    reasons.push('batch records do not cover the exact discovered suite');
  }
  return reasons;
}

export function coldCiVerdict({ child, result, invocationId, identity, allFiles, before, after }) {
  // Keep real failures ahead of missing/partial evidence. Exit 2 alone is not
  // a monitor diagnosis: a test or an earlier CI gate may also return it.
  if (child.error || child.signal || child.status == null) {
    return { verdict: 'red', exitCode: 1, full_suite_pass: false,
      reasons: [child.error?.message || `CI command terminated without an exit status (${child.signal || 'unknown'})`] };
  }
  if (child.status !== 0) {
    const monitorLost = child.status === COLD_CI_INCONCLUSIVE
      && matchingInvocation(result, invocationId) && result.status === child.status
      && result.outcome === 'monitor-unavailable';
    return { verdict: monitorLost ? 'inconclusive' : 'red', exitCode: child.status,
      full_suite_pass: false, reasons: [monitorLost ? 'test RSS monitor unavailable' : `CI command exited ${child.status}`] };
  }
  const reasons = fullTestResultProblems({ result, invocationId, identity, allFiles });
  if (!before?.commit || before.commit !== after?.commit) reasons.push('HEAD changed during CI');
  if (before?.dirty !== false || after?.dirty !== false) reasons.push('CI started or ended on a dirty tree');
  return { verdict: reasons.length ? 'inconclusive' : 'green',
    exitCode: reasons.length ? COLD_CI_INCONCLUSIVE : 0, full_suite_pass: reasons.length === 0, reasons };
}

export function coldCiStampProblems({ stamp, state, identity, allFiles }) {
  if (stamp?.schema !== COLD_CI_SCHEMA || stamp?.trust !== COLD_CI_TRUST) {
    return ['missing, malformed, or legacy stamp; a new full-guard result is required'];
  }
  const reasons = [];
  if (stamp.verdict !== 'green' || stamp.full_suite_pass !== true
      || stamp.exitCode !== 0 || stamp.childExitCode !== 0) reasons.push(`stamp is not a full GREEN result (${stamp.verdict})`);
  if (!state?.commit || stamp.commit !== state.commit || stamp.endCommit !== stamp.commit) reasons.push('stamp is for another HEAD');
  if (stamp.dirty !== false || state?.dirty !== false) reasons.push('stamp or current tree is dirty');
  try { testInvocationReportPath(stamp.invocationId); }
  catch { reasons.push('stamp has no valid invocation id'); }
  reasons.push(...fullTestResultProblems({ result: stamp.testResult,
    invocationId: stamp.invocationId, identity, allFiles }));
  return reasons;
}

export function runColdCi({
  root = ROOT, argv = process.argv.slice(2), spawn = spawnSync,
  gitState = () => readGitState(root), identify = () => testWorkflowIdentity({ root }),
  discover = () => collectTestFiles(), newId = () => crypto.randomUUID(),
} = {}) {
  const stampPath = path.join(root, '.ci-stamp.json');
  if (argv.length && !(argv.length === 1 && argv[0] === '--check')) {
    console.error('Usage: node tools/cold-ci.mjs [--check]');
    return 1;
  }
  if (argv[0] === '--check') {
    try {
      const stamp = readJson(stampPath);
      const reasons = coldCiStampProblems({ stamp, state: gitState(), identity: identify(), allFiles: discover() });
      if (reasons.length) {
        console.log(`[cold-ci] stamp does NOT vouch for this tree:\n  - ${reasons.join('\n  - ')}`);
        return 1;
      }
      console.log(`[cold-ci] GREEN local result — ${stamp.commit.slice(0, 7)} verified ${stamp.finishedAt} (${stamp.durationSec}s)`);
      return 0;
    } catch (error) {
      console.error(`[cold-ci] cannot verify stamp: ${error.message}`);
      return 1;
    }
  }

  const started = Date.now();
  const stamp = { schema: COLD_CI_SCHEMA, trust: COLD_CI_TRUST,
    startedAt: new Date(started).toISOString(), verdict: 'running', full_suite_pass: false,
    exitCode: null, node: process.version, platform: `${process.platform}-${process.arch}` };
  try {
    // Invalidate a previous GREEN before launching anything, including when
    // this run is interrupted or fails before reaching the test runner.
    writeJsonAtomic(stampPath, stamp);
    const invocationId = newId();
    const resultPath = testInvocationReportPath(invocationId, root);
    if (fs.existsSync(resultPath)) throw new Error('test invocation result already exists; refusing to reuse it');
    const before = gitState();
    Object.assign(stamp, { invocationId, commit: before.commit, dirty: before.dirty });
    console.log(`[cold-ci] running full guard on ${before.commit.slice(0, 7)}${before.dirty ? ' (DIRTY tree)' : ''}…`);
    let child;
    try {
      child = spawn('npm', ['run', 'ci'], { cwd: root, stdio: 'inherit', shell: true,
        windowsHide: true, env: { ...process.env, [TEST_INVOCATION_ENV]: invocationId } });
    } catch (error) { child = { status: null, error }; }
    const result = readJson(resultPath);
    let after, identity, allFiles, inspectionError;
    try { after = gitState(); identity = identify(); allFiles = discover(); }
    catch (error) { inspectionError = error.message; }
    const verdict = coldCiVerdict({ child, result, invocationId, identity, allFiles, before, after });
    if (inspectionError) {
      verdict.reasons.push(`cannot inspect final tree: ${inspectionError}`);
      // Preserve a real child failure even if final inspection also failed.
      if (verdict.exitCode === 0) Object.assign(verdict, {
        verdict: 'inconclusive', exitCode: COLD_CI_INCONCLUSIVE, full_suite_pass: false,
      });
    }
    Object.assign(stamp, verdict, { childExitCode: child.status ?? null,
      endCommit: after?.commit ?? null, dirty: before.dirty || after?.dirty !== false,
      testResult: result, simVersion: simVersion(root),
      finishedAt: new Date().toISOString(), durationSec: Math.round((Date.now() - started) / 1000) });
    writeJsonAtomic(stampPath, stamp);
    console.log(`[cold-ci] ${stamp.verdict.toUpperCase()} — ${stamp.durationSec}s for this invocation; stamped .ci-stamp.json`);
    for (const reason of stamp.reasons) console.log(`[cold-ci] ${reason}`);
    return stamp.exitCode;
  } catch (error) {
    console.error(`[cold-ci] cannot complete verdict: ${error.message}`);
    // Never leave an earlier successful stamp usable after a failed attempt.
    try { writeJsonAtomic(stampPath, { ...stamp, verdict: 'red', full_suite_pass: false,
      exitCode: 1, reasons: [error.message], finishedAt: new Date().toISOString() }); }
    catch { /* The original write error is already reported; do not claim a stamp. */ }
    return 1;
  }
}
