import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  COLD_CI_SCHEMA, coldCiVerdict, fullTestResultProblems, runColdCi,
} from '../tools/cold-ci-lib.mjs';
import {
  TEST_INVOCATION_ENV, TEST_INVOCATION_SCHEMA, makeTestCheckpoint, makeTestCompletionReport,
  testInvocationReportPath, testWorkflowIdentity, writeJsonAtomic,
} from '../tools/test-workflow.mjs';

const invocationId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const allFiles = ['tests-js/a.test.ts', 'tests-js/b.test.ts'];
const clean = { commit: 'a'.repeat(40), dirty: false };
const identity = { sha256: 'b'.repeat(64) };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function fullResult(currentIdentity = identity) {
  return {
    schema: TEST_INVOCATION_SCHEMA, invocation_id: invocationId, status: 0, outcome: 'completed',
    completion: makeTestCompletionReport({ identity: currentIdentity, completedFiles: allFiles,
      batches: allFiles.map(file => ({ files: [file], peak_rss_bytes: 123 })), uninterrupted: true }),
  };
}
function verdict(overrides: any = {}) {
  return coldCiVerdict({ child: { status: 0 }, result: fullResult(), invocationId,
    identity, allFiles, before: clean, after: clean, ...overrides });
}

function fixture(run: (f: any) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-cold-ci-'));
  const stampPath = path.join(root, '.ci-stamp.json');
  const identify = () => testWorkflowIdentity({ root });
  const options = { root, argv: [], newId: () => invocationId, gitState: () => clean,
    identify, discover: () => allFiles };
  const readStamp = () => JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  const writeResult = (result = fullResult(identify())) => writeJsonAtomic(testInvocationReportPath(invocationId, root), result);
  fs.writeFileSync(path.join(root, 'input.txt'), 'original');
  try { run({ root, stampPath, identify, options, readStamp, writeResult }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

describe('cold-CI full-suite verdict boundary', () => {
  it('requires an uninterrupted result from this invocation and exact suite', () => {
    expect(verdict()).toMatchObject({ verdict: 'green', exitCode: 0, full_suite_pass: true, reasons: [] });
  });

  it.each([
    ['no result', () => null],
    ['foreign invocation', (r: any) => { r.invocation_id = otherId; return r; }],
    ['unknown result schema', (r: any) => { r.schema = 'unknown'; return r; }],
    ['selected/chip run', (r: any) => { r.completion = null; return r; }],
    ['operator resume', (r: any) => { r.completion.status = 'operator-resume-complete'; r.completion.full_suite_pass = false; return r; }],
    ['untrusted prefix', (r: any) => { r.completion.trust = 'untrusted-operator-convenience'; return r; }],
    ['false full-suite flag', (r: any) => { r.completion.full_suite_pass = false; return r; }],
    ['project/runtime drift', (r: any) => { r.completion.identity.sha256 = 'c'.repeat(64); return r; }],
    ['missing file', (r: any) => { r.completion.completed_files.pop(); return r; }],
    ['extra file', (r: any) => { r.completion.completed_files.push('tests-js/extra.test.ts'); return r; }],
    ['duplicate file', (r: any) => { r.completion.completed_files[1] = allFiles[0]; return r; }],
    ['missing batch', (r: any) => { r.completion.batches.pop(); return r; }],
    ['duplicate batch', (r: any) => { r.completion.batches.push(r.completion.batches[0]); return r; }],
    ['empty batch', (r: any) => { r.completion.batches.push({ files: [] }); return r; }],
    ['null batch', (r: any) => { r.completion.batches = [null]; return r; }],
    ['failed test result', (r: any) => { r.status = 7; r.outcome = 'test-process-failed'; return r; }],
  ])('never stamps %s GREEN despite a zero npm exit', (_label, change) => {
    expect(verdict({ result: (change as Function)(clone(fullResult())) }))
      .toMatchObject({ verdict: 'inconclusive', exitCode: 2, full_suite_pass: false });
  });

  it('refuses an empty discovered suite', () => {
    expect(fullTestResultProblems({ result: fullResult(), invocationId, identity, allFiles: [] }).join(' '))
      .toContain('exact discovered suite');
  });

  it.each([
    { before: { ...clean, dirty: true } },
    { after: { ...clean, dirty: true } },
    { after: { ...clean, commit: 'c'.repeat(40) } },
  ])('does not reuse a verdict across dirty states or changed HEAD: %j', change => {
    expect(verdict(change)).toMatchObject({ verdict: 'inconclusive', exitCode: 2 });
  });

  it.each([1, 2, 7])('preserves CI failure %i even without a test result', status => {
    expect(verdict({ child: { status }, result: null })).toMatchObject({ verdict: 'red', exitCode: status });
  });

  it('distinguishes monitor loss from a test that exits 2, with failure precedence', () => {
    for (const [outcome, status, expected] of [
      ['monitor-unavailable', 2, 'inconclusive'], ['test-process-failed', 2, 'red'],
      ['rss-limit-exceeded', 1, 'red'], ['termination-failed', 1, 'red'],
    ] as const) {
      const result = { ...fullResult(), status, outcome, completion: null };
      expect(verdict({ child: { status }, result })).toMatchObject({ verdict: expected, exitCode: status });
    }
    const lost = { ...fullResult(), status: 2, outcome: 'monitor-unavailable', completion: null };
    expect(verdict({ child: { status: 7 }, result: lost })).toMatchObject({ verdict: 'red', exitCode: 7 });
    expect(verdict({ child: { status: 2 }, result: { ...lost, invocation_id: otherId } })).toMatchObject({ verdict: 'red', exitCode: 2 });
  });

  it.each([{ status: null, signal: 'SIGTERM' }, { status: 0, error: new Error('denied') }])(
    'never stamps a launch failure or signal GREEN', child => {
      expect(verdict({ child })).toMatchObject({ verdict: 'red', exitCode: 1 });
    },
  );
});

describe('cold-CI invocation and reusable local stamp', () => {
  it('invalidates old GREEN before launch, passes a fresh id, and checks without launching CI', () => fixture(f => {
    writeJsonAtomic(f.stampPath, { verdict: 'green', commit: clean.commit });
    const spawn = vi.fn((command, args, options) => {
      expect(f.readStamp()).toMatchObject({ verdict: 'running', full_suite_pass: false });
      expect(command).toBe('npm');
      expect(args).toEqual(['run', 'ci']);
      expect(options).toMatchObject({ cwd: f.root, windowsHide: true, env: { [TEST_INVOCATION_ENV]: invocationId } });
      f.writeResult();
      return { status: 0 };
    });
    expect(runColdCi({ ...f.options, spawn })).toBe(0);
    expect(f.readStamp()).toMatchObject({ schema: COLD_CI_SCHEMA, trust: 'local-ci-result-not-independent-attestation',
      verdict: 'green', full_suite_pass: true, invocationId, childExitCode: 0 });
    expect(runColdCi({ ...f.options, spawn, argv: ['--check'] })).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(1);
    // Ignored build inputs are invisible to git status but still invalidate it.
    fs.mkdirSync(path.join(f.root, 'dist'));
    fs.writeFileSync(path.join(f.root, 'dist', 'changed.js'), 'changed');
    expect(runColdCi({ ...f.options, spawn, argv: ['--check'] })).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  }));

  it.each(['no report', 'malformed report', 'stale shared last-pass'])('refuses %s from a successful command', label => fixture(f => {
    const spawn = () => {
      if (label === 'malformed report') {
        f.writeResult(); fs.writeFileSync(testInvocationReportPath(invocationId, f.root), '{');
      } else if (label === 'stale shared last-pass') {
        writeJsonAtomic(path.join(f.root, '.local-evidence', 'test-workflow-last-pass-v2.json'), fullResult(f.identify()).completion);
      }
      return { status: 0 };
    };
    expect(runColdCi({ ...f.options, spawn })).toBe(2);
    expect(f.readStamp()).toMatchObject({ verdict: 'inconclusive', full_suite_pass: false });
  }));

  it('refuses to reuse an existing invocation result and invalidates the old stamp', () => fixture(f => {
    f.writeResult(); writeJsonAtomic(f.stampPath, { verdict: 'green' });
    const spawn = vi.fn();
    expect(runColdCi({ ...f.options, spawn })).toBe(1);
    expect(spawn).not.toHaveBeenCalled();
    expect(f.readStamp().verdict).toBe('red');
  }));

  it.each([null, '{', JSON.stringify({ commit: clean.commit, dirty: false, verdict: 'green' })])(
    'rejects missing, malformed and legacy stamps without spawning (%j)', contents => fixture(f => {
      if (contents !== null) fs.writeFileSync(f.stampPath, contents);
      const spawn = vi.fn();
      expect(runColdCi({ ...f.options, spawn, argv: ['--check'] })).toBe(1);
      expect(spawn).not.toHaveBeenCalled();
    }),
  );

  it('checks runtime identity, dirty state, HEAD, and stamp integrity on reuse', () => fixture(f => {
    expect(runColdCi({ ...f.options, spawn: () => { f.writeResult(); return { status: 0 }; } })).toBe(0);
    const original = f.readStamp();
    const spawn = vi.fn();
    for (const overrides of [
      { identify: () => ({ sha256: 'c'.repeat(64) }) },
      { gitState: () => ({ ...clean, dirty: true }) },
      { gitState: () => ({ ...clean, commit: 'd'.repeat(40) }) },
      { discover: () => [allFiles[0]] },
    ]) expect(runColdCi({ ...f.options, ...overrides, spawn, argv: ['--check'] })).toBe(1);
    for (const change of [{ full_suite_pass: false }, { childExitCode: 2 }, { exitCode: 1 },
      { endCommit: 'd'.repeat(40) }, { dirty: true }, { verdict: 'running' }, { invocationId: otherId }]) {
      writeJsonAtomic(f.stampPath, { ...original, ...change });
      expect(runColdCi({ ...f.options, spawn, argv: ['--check'] })).toBe(1);
    }
    expect(spawn).not.toHaveBeenCalled();
  }));

  it.each([0, 7])('cannot bless an unreadable final tree, and preserves child failure %i', status => fixture(f => {
    const options = { ...f.options, identify: () => { throw new Error('unreadable'); },
      spawn: () => ({ status }) };
    expect(runColdCi(options)).toBe(status || 2);
    expect(f.readStamp().verdict).toBe(status ? 'red' : 'inconclusive');
  }));

  it('records a thrown launch error and refuses unknown arguments without spawning', () => fixture(f => {
    expect(runColdCi({ ...f.options, spawn: () => { throw new Error('launch denied'); } })).toBe(1);
    expect(f.readStamp()).toMatchObject({ verdict: 'red', reasons: ['launch denied'] });
    const spawn = vi.fn();
    expect(runColdCi({ ...f.options, spawn, argv: ['--check', '--fresh'] })).toBe(1);
    expect(spawn).not.toHaveBeenCalled();
  }));

  it('reads real Git state, including nonignored untracked work', () => fixture(f => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: 'pipe', windowsHide: true });
    fs.writeFileSync(path.join(f.root, '.gitignore'), '.ci-stamp.json\n.local-evidence/\n');
    git('init', '-q'); git('add', '.');
    git('-c', 'user.name=Cold CI Test', '-c', 'user.email=coldci@example.invalid', '-c', 'commit.gpgsign=false',
      '-c', `core.hooksPath=${path.join(f.root, 'no-hooks')}`, 'commit', '-qm', 'fixture');
    const { gitState: _ignored, ...options } = f.options;
    const spawn = vi.fn(() => { f.writeResult(); return { status: 0 }; });
    expect(runColdCi({ ...options, spawn })).toBe(0);
    expect(runColdCi({ ...options, spawn, argv: ['--check'] })).toBe(0);
    fs.writeFileSync(path.join(f.root, 'untracked.txt'), 'changed');
    expect(runColdCi({ ...options, spawn, argv: ['--check'] })).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  }));

  it.each(['../outside', '/absolute', 'C:/absolute', '', 'not-a-uuid'])(
    'rejects unsafe invocation names %j', id => {
      expect(() => testInvocationReportPath(id)).toThrow('UUID');
    },
  );
});

describe('real runner to cold-CI result wiring (tiny fixture suite)', () => {
  it.each([
    ['full', 0, true], ['resume', 2, false], ['selected', 2, false], ['failed', 7, false], ['failed-exit2', 2, false],
  ] as const)('%s run produces verdict %i without running geological fixtures', (mode, expected, full) => fixture(f => {
    fs.mkdirSync(path.join(f.root, 'tools'));
    for (const file of ['test-workflow.mjs', 'test-quarry-ledger.mjs', 'locality-frequency-contract.mjs', 'test-chip-check.mjs']) {
      fs.copyFileSync(path.join(process.cwd(), 'tools', file), path.join(f.root, 'tools', file));
    }
    fs.mkdirSync(path.join(f.root, 'tests-js'));
    for (const file of allFiles) fs.writeFileSync(path.join(f.root, file), '// fixture');
    // Preserve the real npm run ci -> npm test -> coordinator boundary while
    // replacing only the expensive CI gates and geological test bodies.
    fs.writeFileSync(path.join(f.root, 'package.json'), JSON.stringify({ private: true, scripts: {
      ci: 'npm test', test: `node tools/test-workflow.mjs${mode === 'selected' ? ` --file ${allFiles[0]}` : ''}`,
    } }));
    fs.mkdirSync(path.join(f.root, 'node_modules', 'vitest'), { recursive: true });
    // A finite fake Vitest executable exercises the actual coordinator and
    // result publication, not the simulation or a second real test pool.
    fs.writeFileSync(path.join(f.root, 'node_modules', 'vitest', 'vitest.mjs'), `
      console.log('fixture executed ' + process.argv.filter(arg => arg.startsWith('tests-js/')).join(','));
      process.exitCode = ${mode === 'failed' ? 7 : mode === 'failed-exit2' ? 2 : 0};
    `);
    if (mode === 'resume') writeJsonAtomic(path.join(f.root, '.local-evidence', 'test-workflow-checkpoint-v2.json'),
      makeTestCheckpoint({ identity: f.identify(), completedFiles: [allFiles[0]],
        batches: [{ files: [allFiles[0]], peak_rss_bytes: 123 }] }));
    let stdout = '';
    const spawn = (command: string, args: string[], options: any) => {
      const child = spawnSync(command, args, {
        ...options, stdio: 'pipe', encoding: 'utf8', timeout: 15000,
      });
      expect(child.error).toBeUndefined();
      stdout = child.stdout;
      return child;
    };
    expect(runColdCi({ ...f.options, spawn })).toBe(expected);
    expect(f.readStamp().full_suite_pass).toBe(full);
    expect(f.readStamp().testResult.invocation_id).toBe(invocationId);
    if (mode === 'resume') {
      expect(stdout).toContain('OPERATOR RESUME COMPLETE');
      expect(stdout).not.toContain(`fixture executed ${allFiles[0]}`);
      expect(stdout).toContain(`fixture executed ${allFiles[1]}`);
    }
    if (mode.startsWith('failed')) {
      expect(f.readStamp().testResult).toMatchObject({ status: expected, outcome: 'test-process-failed', completion: null });
      expect(f.readStamp().verdict).toBe('red');
    }
  }), 20000);

  it.each([0, 1, 2, 7])('the actual cold-CI CLI preserves verdict %i and arguments', status => fixture(f => {
    fs.copyFileSync(path.join(process.cwd(), 'tools', 'cold-ci.mjs'), path.join(f.root, 'cold-ci.mjs'));
    fs.writeFileSync(path.join(f.root, 'cold-ci-lib.mjs'), `
      export function runColdCi() { console.log(JSON.stringify(process.argv.slice(2))); return ${status}; }
    `);
    const result = spawnSync(process.execPath, ['cold-ci.mjs', '--check'], {
      cwd: f.root, encoding: 'utf8', windowsHide: true, timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    expect(JSON.parse(result.stdout.trim())).toEqual(['--check']);
  }));
});
