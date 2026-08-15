/**
 * Memory-bounded full Vitest workflow.
 *
 * The repository has more than 200 test files. Even with one Vitest worker, a
 * single long-lived Node process can retain enough jsdom/simulator state to
 * become unfriendly to a workstation. Run small batches sequentially so every
 * child exits and returns its heap to the OS before the next batch begins.
 *
 * The checkpoint is deliberately an UNTRUSTED local operator convenience. It
 * limits lost workstation time after an interruption, but a plain local JSON
 * file cannot attest that its recorded batches really ran. Only one process
 * that starts at file zero, observes one unchanged project identity after
 * every batch, and reaches the end may publish an uninterrupted PASS record.
 * Even that record is a local test result, not cryptographic release evidence.
 */

import { execFile, spawn as spawnChild } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const execFileAsync = promisify(execFile);
// Production Cartesian fixtures can each retain a complete 48/64 extraction.
// One file per child keeps worst-case suites below the workstation budget and
// returns every jsdom/surface cache to the OS before loading the next file.
export const DEFAULT_TEST_BATCH_SIZE = 1;
export const CHILD_HEAP_LIMIT_MB = 1536;
export const MAX_BATCH_RSS_BYTES = 2 * 1024 * 1024 * 1024;
export const RSS_POLL_INTERVAL_MS = 1000;
export const MAX_CONSECUTIVE_RSS_FAILURES = 2;
export const TERMINATION_GRACE_MS = 2000;
export const HARD_KILL_GRACE_MS = 2000;
export const TEST_CHECKPOINT_SCHEMA = 2;
export const TEST_CHECKPOINT_TRUST = 'untrusted-operator-convenience';
export const TEST_CHECKPOINT_PATH = path.join(
  ROOT, '.local-evidence', 'test-workflow-checkpoint-v2.json',
);
export const TEST_REPORT_PATH = path.join(
  ROOT, '.local-evidence', 'test-workflow-last-pass-v2.json',
);
export const TEST_RESUME_REPORT_PATH = path.join(
  ROOT, '.local-evidence', 'test-workflow-last-operator-resume-v2.json',
);

// These are generated dependency/operator/cache stores, never project inputs.
// Everything else under the repository root is included, including docs,
// CHANGELOG, media, proposals, research, untracked source, and ignored dist.
const TEST_IDENTITY_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.local-evidence',
  '.pytest_cache',
  '.review-cards',
  '.strip-diffs',
  '__pycache__',
  'node_modules',
]);
const TEST_IDENTITY_EXCLUDED_ROOT_FILES = new Set(['.ci-stamp.json']);

function collectFilesRecursively(root) {
  const found = [];
  const visit = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = relative
        ? path.join(relative, entry.name).replaceAll('\\', '/')
        : entry.name;
      if (entry.isDirectory()) {
        if (!TEST_IDENTITY_EXCLUDED_DIRECTORIES.has(entry.name)) {
          visit(childAbsolute, childRelative);
        }
      }
      else if (entry.isFile()) found.push(childRelative);
    }
  };
  visit(root, '');
  return found;
}

export function collectTestIdentityFiles(root = ROOT) {
  return collectFilesRecursively(root)
    .filter(relative => !TEST_IDENTITY_EXCLUDED_ROOT_FILES.has(relative))
    .sort();
}

export function testWorkflowIdentity({
  root = ROOT,
  identityFiles = collectTestIdentityFiles(root),
  runtime = {
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  },
} = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(`test-workflow-identity-v${TEST_CHECKPOINT_SCHEMA}\0`);
  hash.update(`${JSON.stringify(runtime)}\0`);
  for (const relative of identityFiles) {
    const bytes = fs.readFileSync(path.join(root, relative));
    hash.update(`${relative}\0${bytes.length}\0`);
    hash.update(bytes);
    hash.update('\0');
  }
  return Object.freeze({
    schema: TEST_CHECKPOINT_SCHEMA,
    sha256: hash.digest('hex'),
    file_count: identityFiles.length,
    runtime: Object.freeze({ ...runtime }),
  });
}

export function readTestCheckpoint({
  checkpointPath = TEST_CHECKPOINT_PATH,
  identity,
  allFiles,
} = {}) {
  if (!fs.existsSync(checkpointPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    if (parsed?.schema !== TEST_CHECKPOINT_SCHEMA) return null;
    if (parsed?.trust !== TEST_CHECKPOINT_TRUST) return null;
    if (parsed?.identity?.sha256 !== identity?.sha256) return null;
    if (!Array.isArray(parsed.completed_files) || !Array.isArray(parsed.batches)) return null;
    if (parsed.completed_files.length > allFiles.length) return null;
    for (let index = 0; index < parsed.completed_files.length; index++) {
      if (parsed.completed_files[index] !== allFiles[index]) return null;
    }
    if (parsed.batches.flatMap(batch => batch.files || []).join('\0')
      !== parsed.completed_files.join('\0')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

export function makeTestCheckpoint({ identity, completedFiles = [], batches = [] } = {}) {
  return {
    schema: TEST_CHECKPOINT_SCHEMA,
    trust: TEST_CHECKPOINT_TRUST,
    full_suite_pass: false,
    identity,
    completed_files: [...completedFiles],
    batches: batches.map(batch => ({
      files: [...batch.files],
      peak_rss_bytes: batch.peak_rss_bytes,
    })),
  };
}

export function makeTestCompletionReport({
  identity,
  completedFiles = [],
  batches = [],
  uninterrupted = false,
} = {}) {
  return {
    ...makeTestCheckpoint({ identity, completedFiles, batches }),
    status: uninterrupted ? 'pass' : 'operator-resume-complete',
    full_suite_pass: uninterrupted,
    trust: uninterrupted
      ? 'local-uninterrupted-result-not-independent-attestation'
      : TEST_CHECKPOINT_TRUST,
  };
}

export function assertTestWorkflowIdentityUnchanged(expected, options = {}) {
  const current = testWorkflowIdentity(options);
  if (current.sha256 !== expected?.sha256) {
    throw new Error(
      `project identity changed during the test run (${expected?.sha256 || 'missing'} -> ${current.sha256}); no batch receipt or PASS was published`,
    );
  }
  return current;
}

export function automaticTestRunPlan({ allFiles, resumed = null } = {}) {
  if (!Array.isArray(allFiles) || !allFiles.length) throw new Error('no test files discovered');
  const completedFiles = resumed ? [...resumed.completed_files] : [];
  const completedBatches = resumed ? [...resumed.batches] : [];
  if (completedFiles.length === allFiles.length) {
    throw new Error(
      'untrusted operator checkpoint already claims every file; refusing a zero-test PASS—rerun with --fresh',
    );
  }
  const resumeIndex = completedFiles.length;
  return {
    completedFiles,
    completedBatches,
    resumeIndex,
    files: selectResumeFiles(allFiles, resumeIndex),
    uninterrupted: resumeIndex === 0,
  };
}

export function collectTestFiles(directory = path.join(ROOT, 'tests-js')) {
  const found = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        found.push(path.relative(ROOT, absolute).replaceAll('\\', '/'));
      }
    }
  };
  visit(directory);
  return found.sort();
}

export function partitionTests(files, batchSize = DEFAULT_TEST_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`batch size must be a positive integer, received ${batchSize}`);
  }
  const batches = [];
  for (let index = 0; index < files.length; index += batchSize) {
    batches.push(files.slice(index, index + batchSize));
  }
  return batches;
}

export function selectResumeFiles(allFiles, startIndex = 0) {
  if (!allFiles.length) throw new Error('no test files discovered');
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= allFiles.length) {
    throw new Error(
      `start index ${startIndex} is outside discovered file range 0..${allFiles.length - 1}`,
    );
  }
  return allFiles.slice(startIndex);
}

export function vitestBatchArgs(batch) {
  return [
    `--max-old-space-size=${CHILD_HEAP_LIMIT_MB}`,
    VITEST,
    'run',
    ...batch,
    '--reporter=dot',
    '--pool=threads',
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--maxConcurrency=1',
  ];
}

export async function processRssBytes(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`invalid process id ${pid}`);
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('tasklist.exe', [
      '/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH',
    ], { windowsHide: true, encoding: 'utf8' });
    const fields = [...stdout.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    if (fields.length < 5 || Number(fields[1]) !== pid) throw new Error(`process ${pid} has exited`);
    const rssKb = Number(fields[4].replace(/[^0-9]/g, ''));
    if (!Number.isFinite(rssKb)) throw new Error(`could not parse RSS for process ${pid}`);
    return rssKb * 1024;
  }
  const { stdout } = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)], {
    encoding: 'utf8',
  });
  const rssKb = Number(stdout.trim());
  if (!Number.isFinite(rssKb)) throw new Error(`process ${pid} has exited`);
  return rssKb * 1024;
}

export async function forceKillProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`invalid process id ${pid}`);
  if (process.platform === 'win32') {
    await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      encoding: 'utf8',
    });
  } else {
    process.kill(pid, 'SIGKILL');
  }
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function runVitestBatch({
  batch,
  spawn = spawnChild,
  rssSampler = processRssBytes,
  hardKiller = forceKillProcess,
  rssLimitBytes = MAX_BATCH_RSS_BYTES,
  pollIntervalMs = RSS_POLL_INTERVAL_MS,
  terminationGraceMs = TERMINATION_GRACE_MS,
  hardKillGraceMs = HARD_KILL_GRACE_MS,
} = {}) {
  const child = spawn(process.execPath, vitestBatchArgs(batch), {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  let running = true;
  let peakRssBytes = 0;
  let exceededRssBytes = null;
  let monitorError = null;
  let spawnError = null;
  let terminationError = null;
  let consecutiveSamplerFailures = 0;
  let terminationPromise = null;
  let resolveTerminationAbort;
  const terminationAbortPromise = new Promise((resolve) => {
    resolveTerminationAbort = resolve;
  });
  const exitPromise = new Promise((resolve) => {
    child.once('error', (error) => {
      spawnError = error;
      running = false;
      resolve({ code: null, signal: null });
    });
    child.once('exit', (code, signal) => {
      running = false;
      resolve({ code, signal });
    });
  });
  const requestTermination = () => {
    if (terminationPromise) return terminationPromise;
    terminationPromise = (async () => {
      let softSent = false;
      try { softSent = child.kill('SIGTERM'); } catch { softSent = false; }
      if (softSent) await Promise.race([delay(terminationGraceMs), exitPromise]);
      if (!running) return;

      let hardSent = false;
      try { hardSent = child.kill('SIGKILL'); } catch { hardSent = false; }
      // Even a reported successful signal can race or be ignored. Give it a
      // brief chance, then use the exact-PID OS hard-kill path if still alive.
      await Promise.race([delay(Math.min(100, hardKillGraceMs)), exitPromise]);
      if (!running) return;
      try {
        await hardKiller(child.pid);
      } catch (error) {
        terminationError = new Error(
          `could not terminate process ${child.pid} after SIGTERM (${softSent}) and SIGKILL (${hardSent}): ${error.message}`,
        );
      }
      await Promise.race([delay(hardKillGraceMs), exitPromise]);
      if (running) {
        terminationError ||= new Error(`process ${child.pid} remained alive after hard-kill timeout`);
        // The OS has refused every exact-PID termination route. Preserve a
        // failing result, disclose the PID, and drop the ChildProcess handle's
        // event-loop reference so the coordinator itself still exits bounded.
        // Inherited stdio creates no parent-owned pipe handles to detach.
        child.unref();
        resolveTerminationAbort({ code: null, signal: 'TERMINATION_FAILED' });
      }
    })();
    return terminationPromise;
  };
  const monitorPromise = (async () => {
    while (running) {
      await delay(pollIntervalMs);
      if (!running) break;
      try {
        const rssBytes = await rssSampler(child.pid);
        consecutiveSamplerFailures = 0;
        peakRssBytes = Math.max(peakRssBytes, rssBytes);
        if (rssBytes > rssLimitBytes) {
          exceededRssBytes = rssBytes;
          requestTermination();
        }
      } catch (error) {
        consecutiveSamplerFailures++;
        if (running && consecutiveSamplerFailures >= MAX_CONSECUTIVE_RSS_FAILURES) {
          monitorError = new Error(
            `RSS sampler failed ${consecutiveSamplerFailures} consecutive times: ${error.message}`,
          );
          requestTermination();
        }
      }
    }
  })();
  const exit = await Promise.race([exitPromise, terminationAbortPromise]);
  running = false;
  await monitorPromise;
  if (terminationPromise) await terminationPromise;
  if (spawnError) throw spawnError;
  if (terminationError) {
    return {
      status: 1, peakRssBytes, exceededRssBytes, monitorError, terminationError, exit,
    };
  }
  if (monitorError) {
    return {
      status: 1, peakRssBytes, exceededRssBytes: null, monitorError, terminationError: null, exit,
    };
  }
  if (exceededRssBytes != null) {
    return {
      status: 1, peakRssBytes, exceededRssBytes, monitorError: null, terminationError: null, exit,
    };
  }
  return {
    status: exit.code ?? 1, peakRssBytes, exceededRssBytes: null,
    monitorError: null, terminationError: null, exit,
  };
}

export function parseArgs(argv) {
  let batchSize = DEFAULT_TEST_BATCH_SIZE;
  let startIndex = 0;
  let fresh = false;
  const selectedFiles = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--batch-size') batchSize = Number(argv[++index]);
    else if (arg === '--start-index') startIndex = Number(argv[++index]);
    else if (arg === '--file') selectedFiles.push(String(argv[++index] || '').replaceAll('\\', '/'));
    else if (arg === '--fresh') fresh = true;
    else if (arg === '--help') return { help: true, batchSize, startIndex, selectedFiles, fresh };
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new Error(`start index must be a non-negative integer, received ${startIndex}`);
  }
  if (selectedFiles.some(file => !file)) throw new Error('--file requires a test path');
  if (selectedFiles.length && startIndex !== 0) {
    throw new Error('--file and --start-index cannot be combined');
  }
  return { help: false, batchSize, startIndex, selectedFiles, fresh };
}

export async function runTestWorkflow({
  batchSize = DEFAULT_TEST_BATCH_SIZE,
  files = collectTestFiles(),
  batchRunner = runVitestBatch,
  assertStable = null,
  onBatchPass = null,
} = {}) {
  const batches = partitionTests(files, batchSize);
  console.log(`[test-workflow] ${files.length} files in ${batches.length} sequential batch(es) of at most ${batchSize}`);
  console.log(`[test-workflow] explicit threads=1; file parallelism off; RSS ceiling ${MAX_BATCH_RSS_BYTES / 1024 / 1024} MB`);

  for (const [index, batch] of batches.entries()) {
    const first = path.basename(batch[0]);
    const last = path.basename(batch[batch.length - 1]);
    console.log(`\n[test-workflow] batch ${index + 1}/${batches.length}: ${first} .. ${last}`);
    const result = await batchRunner({ batch });
    const peakMb = Math.ceil(result.peakRssBytes / 1024 / 1024);
    if (result.terminationError) {
      console.error(`[test-workflow] FAIL: ${result.terminationError.message}`);
      return 1;
    }
    if (result.monitorError) {
      console.error(`[test-workflow] FAIL: RSS watchdog unavailable in batch ${index + 1}/${batches.length}: ${result.monitorError.message}`);
      return 1;
    }
    if (result.exceededRssBytes != null) {
      const exceededMb = Math.ceil(result.exceededRssBytes / 1024 / 1024);
      console.error(`[test-workflow] FAIL: batch ${index + 1}/${batches.length} reached ${exceededMb} MB RSS (limit 2048 MB) and was terminated`);
      return 1;
    }
    if (result.status !== 0) {
      console.error(`[test-workflow] FAIL in batch ${index + 1}/${batches.length} (peak ${peakMb} MB RSS)`);
      return result.status ?? 1;
    }
    if (assertStable) await assertStable({
      batch: [...batch],
      batchIndex: index,
      batchCount: batches.length,
    });
    console.log(`[test-workflow] batch ${index + 1}/${batches.length} PASS (peak ${peakMb} MB RSS)`);
    if (onBatchPass) await onBatchPass({
      batch: [...batch],
      batchIndex: index,
      batchCount: batches.length,
      peakRssBytes: result.peakRssBytes,
    });
  }
  console.log(`\n[test-workflow] COMPLETE: ${files.length} files across ${batches.length} memory-bounded batches`);
  return 0;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('node tools/test-workflow.mjs [--fresh] [--batch-size N] [--start-index N] [--file tests-js/name.test.ts ...]');
    } else {
      const allFiles = collectTestFiles();
      for (const file of args.selectedFiles) {
        if (!allFiles.includes(file)) throw new Error(`selected test file is not registered: ${file}`);
      }
      const automaticCheckpoint = !args.selectedFiles.length && args.startIndex === 0;
      const identity = automaticCheckpoint ? testWorkflowIdentity() : null;
      if (automaticCheckpoint && args.fresh && fs.existsSync(TEST_CHECKPOINT_PATH)) {
        fs.unlinkSync(TEST_CHECKPOINT_PATH);
      }
      const resumed = automaticCheckpoint && !args.fresh
        ? readTestCheckpoint({ identity, allFiles })
        : null;
      const plan = automaticCheckpoint
        ? automaticTestRunPlan({ allFiles, resumed })
        : null;
      const completedFiles = plan ? plan.completedFiles : [];
      const completedBatches = plan ? plan.completedBatches : [];
      const resumeIndex = plan ? plan.resumeIndex : args.startIndex;
      const files = args.selectedFiles.length
        ? [...new Set(args.selectedFiles)]
        : plan ? plan.files : selectResumeFiles(allFiles, resumeIndex);
      if (args.startIndex > 0) {
        console.log(`[test-workflow] resuming at sorted file index ${args.startIndex} of ${allFiles.length}`);
      } else if (args.selectedFiles.length) {
        console.log(`[test-workflow] selected ${files.length} exact test file(s)`);
      } else if (resumeIndex > 0) {
        console.log(`[test-workflow] UNTRUSTED operator checkpoint resumes at sorted file index ${resumeIndex} of ${allFiles.length}`);
        console.log('[test-workflow] resumed batches cannot publish a full-suite PASS; use --fresh for one uninterrupted run');
      }
      if (automaticCheckpoint) {
        assertTestWorkflowIdentityUnchanged(identity);
        writeJsonAtomic(TEST_CHECKPOINT_PATH, makeTestCheckpoint({
          identity, completedFiles, batches: completedBatches,
        }));
      }
      const status = files.length ? await runTestWorkflow({
        batchSize: args.batchSize,
        files,
        assertStable: automaticCheckpoint
          ? () => assertTestWorkflowIdentityUnchanged(identity)
          : null,
        onBatchPass: automaticCheckpoint ? ({ batch, peakRssBytes }) => {
          completedFiles.push(...batch);
          completedBatches.push({ files: batch, peak_rss_bytes: peakRssBytes });
          writeJsonAtomic(TEST_CHECKPOINT_PATH, makeTestCheckpoint({
            identity, completedFiles, batches: completedBatches,
          }));
        } : null,
      }) : 0;
      if (automaticCheckpoint && status === 0 && completedFiles.length === allFiles.length) {
        assertTestWorkflowIdentityUnchanged(identity);
        const uninterrupted = plan.uninterrupted;
        const reportPath = uninterrupted ? TEST_REPORT_PATH : TEST_RESUME_REPORT_PATH;
        writeJsonAtomic(reportPath, makeTestCompletionReport({
          identity, completedFiles, batches: completedBatches, uninterrupted,
        }));
        fs.unlinkSync(TEST_CHECKPOINT_PATH);
        if (uninterrupted) {
          console.log(`[test-workflow] UNINTERRUPTED PASS: ${allFiles.length} files under one unchanged project identity`);
          console.log(`[test-workflow] local result (not independent attestation): ${path.relative(ROOT, reportPath)}`);
        } else {
          console.log(`[test-workflow] OPERATOR RESUME COMPLETE: ${allFiles.length} prefix/suffix records under one unchanged project identity`);
          console.log('[test-workflow] no full-suite PASS was issued; rerun with --fresh for one uninterrupted result');
        }
      }
      process.exitCode = status;
    }
  } catch (error) {
    console.error(`[test-workflow] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
