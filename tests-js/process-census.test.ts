import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  QUERY_TIMEOUT_MS, WINDOWS_PROCESS_QUERY, assessProcessSnapshot, captureProcessSnapshot,
  parseWindowsProcessSnapshot, runProcessCensus,
} from '../tools/process-census-lib.mjs';

const observedAt = '2026-10-14T19:00:00.000Z';
const root = 'C:/work/vugg-simulator';
const start = (seconds: number) => `2026-10-14T18:00:${String(seconds).padStart(2, '0')}.0000000Z`;
const proc = (overrides: any = {}) => ({ pid: 10, ppid: 0, name: 'node.exe',
  started_at: start(0), command: 'node tools/process-census.mjs', ...overrides });
const parse = (rows: any[]) => parseWindowsProcessSnapshot(JSON.stringify(rows), { observedAt, root });
const assess = (rows: any[], selfPid = 10) => assessProcessSnapshot(parse(rows), { selfPid });
const external = (overrides: any = {}) => proc({ pid: 40, started_at: start(2),
  command: 'node tools/test-workflow.mjs', ...overrides });

describe('process census snapshot normalization', () => {
  it('keeps shell intermediates and exact creation timestamps without retaining command lines', () => {
    const rows = [proc(), proc({ pid: 20, ppid: 10, name: 'cmd.exe', started_at: start(1), command: 'npm test --token=secret-value' }),
      external({ pid: 30, ppid: 20, started_at: '2026-10-14T18:00:02.1234567Z', command: 'node tools/test-workflow.mjs --token=secret-value' })];
    const snapshot = parse(rows);
    expect(snapshot.status).toBe('available');
    expect(snapshot.processes.map(p => p.pid)).toEqual([10, 20, 30]);
    expect(snapshot.processes[2].started_at).toBe('2026-10-14T18:00:02.1234567Z');
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.processes.every(p => !('command' in p) && !('cmd' in p))).toBe(true);
  });

  it.each(['', '{', 'null', '{}', JSON.stringify(proc()), '[null]',
    JSON.stringify([proc(), proc()]), JSON.stringify([proc({ pid: -1 })]),
    JSON.stringify([proc({ ppid: null })]), JSON.stringify([proc({ name: 'node\n.exe' })]),
  ])('rejects malformed/partial query output instead of substituting an empty census (%j)', text => {
    const result = parseWindowsProcessSnapshot(text, { observedAt, root });
    expect(result.status).toBe('unavailable');
    expect(assessProcessSnapshot(result, { selfPid: 10 })).toMatchObject({ status: 'unknown', exit_code: 2 });
  });

  it.each([null, '', '/Date(1780000000000)/', 'not-a-date', '2026-02-31T18:00:00.0000000Z',
    '2026-10-14T18:00:00.000Z', '2026-10-14T20:00:00.0000000Z',
  ])('keeps an invalid, imprecise, or future start time unknown (%j)', started_at => {
    const report = assess([proc(), external({ started_at, command: 'node utility.mjs' })]);
    expect(report).toMatchObject({ status: 'unknown', exit_code: 2 });
    expect(report.runtimes.find(p => p.pid === 40)?.started_at).toBeNull();
    expect(report.issues).toContain('pid 40: start-unavailable');
  });

  it.each([
    ['node.exe', 'node tools/test-workflow.mjs', 'test-workflow'],
    ['NODE.EXE', 'node "C:\\work\\vugg-simulator\\tools\\cold-ci.mjs"', 'cold-ci'],
    ['node', 'node /elsewhere/node_modules/vitest/vitest.mjs run', 'vitest'],
    ['nodejs', 'nodejs tools/build-all.mjs --check', 'build-all'],
    ['bun.exe', 'bun node_modules/vite/bin/vite.js', 'vite'],
    ['deno.exe', 'deno run tools/test-workflow.mjs', 'test-workflow'],
    ['esbuild.exe', 'esbuild node_modules/vitest/vitest.mjs', 'vitest'],
  ])('recognizes %s work without requiring a Vugg directory in %s', (name, command, kind) => {
    const report = assess([proc(), external({ name, command })]);
    expect(report).toMatchObject({ status: 'busy', exit_code: 1 });
    expect(report.blockers[0].work_kind).toBe(kind);
  });

  it.each(['node not-vitest.mjs', 'node test-workflow.mjs.bak', 'node utility.mjs', 'node.exe'])(
    'does not invent recognized work from %s', command => {
      const report = assess([proc(), external({ command })]);
      expect(report).toMatchObject({ status: 'no-observed-work', exit_code: 0, host_cleanliness: 'not-certified', full_suite_pass: false });
      expect(report.blockers).toEqual([]);
    },
  );

  it('uses full path boundaries for an advisory checkout hint', () => {
    for (const [command, expected] of [
      ['node "C:\\WORK\\Vugg-Simulator\\tools\\test-workflow.mjs"', 'current-checkout-path'],
      ['node C:/work/vugg-simulator-neighbor/tools/test-workflow.mjs', 'unresolved'],
      ['node C:/elsewhere/vugg-simulator/tools/test-workflow.mjs', 'unresolved'],
      ['node tools/test-workflow.mjs', 'unresolved'],
    ]) {
      const report = assess([proc(), external({ command })]);
      expect(report.blockers[0].checkout_hint).toBe(expected);
      expect(report.status).toBe('busy');
    }
  });
});

describe('process census caller ancestry and verdict', () => {
  it('excludes a verified caller tree across cmd and PowerShell intermediates', () => {
    const report = assess([proc(), proc({ pid: 20, ppid: 10, name: 'cmd.exe', started_at: start(1) }),
      proc({ pid: 25, ppid: 20, name: 'powershell.exe', started_at: start(2) }),
      external({ pid: 30, ppid: 25, started_at: start(3) })]);
    expect(report).toMatchObject({ status: 'no-observed-work', exit_code: 0, caller: { pid: 10, started_at: start(0) } });
    expect(report.runtimes.find(p => p.pid === 30)?.relation).toBe('descendant');
    expect(report.runtimes.map(p => p.pid)).toEqual([10, 30]);
  });

  it('does not exclude a worker through a recycled parent PID, including sub-millisecond ordering', () => {
    const report = assess([proc({ started_at: '2026-10-14T18:00:00.0000002Z' }),
      external({ ppid: 10, started_at: '2026-10-14T18:00:00.0000001Z' })]);
    expect(report).toMatchObject({ status: 'busy', exit_code: 1 });
    expect(report.blockers[0]).toMatchObject({ relation: 'unresolved', ancestry_issue: 'parent-created-after-child' });
  });

  it.each([
    ['missing parent', [external({ ppid: 99 })], 'parent-not-observed'],
    ['unreadable parent start', [proc({ pid: 20, ppid: 10, name: 'cmd.exe', started_at: null }), external({ ppid: 20 })], 'ancestor-start-unavailable'],
    ['cycle', [proc({ pid: 20, ppid: 40, name: 'cmd.exe', started_at: start(2) }), external({ ppid: 20 })], 'ancestry-cycle'],
  ])('does not exempt observed work with %s', (_label, rows, reason) => {
    const report = assess([proc(), ...rows as any[]]);
    expect(report.status).toBe('busy');
    expect(report.blockers[0].ancestry_issue).toBe(reason);
  });

  it.each([{ rows: [] }, { rows: [proc({ started_at: null })] }])('cannot report no observed work without the caller identity ($rows)', ({ rows }) => {
    const report = assess(rows);
    expect(report).toMatchObject({ status: 'unknown', exit_code: 2 });
    expect(report.issues).toContain('caller-identity-unavailable');
  });

  it('does not treat an unreadable runtime command as an idle runtime', () => {
    expect(assess([proc(), external({ command: null })])).toMatchObject({ status: 'unknown', exit_code: 2,
      issues: ['pid 40: command-unavailable'] });
  });

  it('does not require inaccessible system commands to attribute known JS work', () => {
    const report = assess([proc(), proc({ pid: 4, ppid: 0, name: 'System', command: null, started_at: null })]);
    expect(report.status).toBe('no-observed-work');
    expect(report.issues).toEqual([]);
  });

  it('retains a positive busy observation alongside missing metadata', () => {
    const report = assess([proc(), external(), external({ pid: 41, command: null })]);
    expect(report).toMatchObject({ status: 'busy', exit_code: 1, issues: ['pid 41: command-unavailable'] });
    expect(report.blockers.map(p => p.pid)).toEqual([40]);
  });

  it('assigns neither leak nor cleanup authority from old age or a process name', () => {
    const report = assess([proc(), external({ started_at: '2025-01-01T00:00:00.0000000Z', command: 'node editor-runtime.mjs' })]);
    expect(report).toMatchObject({ status: 'no-observed-work', trust: 'local-process-observation-not-ownership-authority' });
    expect(JSON.stringify(report)).not.toMatch(/leakCandidate|safeToTerminate|killable/);
  });
});

describe('bounded Windows acquisition and one-shot CLI', () => {
  it('queries the full process list with a hidden, bounded child', async () => {
    const exec = vi.fn(async () => ({ stdout: JSON.stringify([proc()]) }));
    const snapshot = await captureProcessSnapshot({ exec, platform: 'win32', now: () => Date.parse(observedAt), root });
    expect(snapshot.status).toBe('available');
    expect(exec).toHaveBeenCalledExactlyOnceWith('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_QUERY],
      expect.objectContaining({ windowsHide: true, timeout: QUERY_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }));
    expect(QUERY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(QUERY_TIMEOUT_MS).toBeLessThanOrEqual(15000);
    expect(WINDOWS_PROCESS_QUERY).not.toContain('-Filter');
    expect(WINDOWS_PROCESS_QUERY).toContain("$ErrorActionPreference = 'Stop'");
    expect(WINDOWS_PROCESS_QUERY).toContain("CreationDate.ToUniversalTime().ToString('o')");
    expect(WINDOWS_PROCESS_QUERY).toContain('ConvertTo-Json -InputObject $rows');
  });

  it.each(['access denied secret-value', 'timed out secret-value', 'maxBuffer exceeded secret-value'])(
    'marks failed acquisition unknown and discards raw errors (%s)', async message => {
      const snapshot = await captureProcessSnapshot({ platform: 'win32', exec: async () => { throw new Error(message); } });
      const report = assessProcessSnapshot(snapshot);
      expect(report).toMatchObject({ status: 'unknown', exit_code: 2, issues: ['process-query-failed'] });
      expect(JSON.stringify(report)).not.toContain('secret-value');
    },
  );

  it('explicitly reports unsupported platforms without guessing a process census', async () => {
    const exec = vi.fn();
    expect(assessProcessSnapshot(await captureProcessSnapshot({ platform: 'linux', exec })))
      .toMatchObject({ status: 'unknown', exit_code: 2, issues: ['unsupported-platform'] });
    expect(exec).not.toHaveBeenCalled();
  });

  it.each([
    [[proc()], 'no-observed-work', 0], [[proc(), external()], 'busy', 1], [[proc(), external({ command: null })], 'unknown', 2],
  ])('preserves preflight status %s in the JSON result and exit code', async (rows, status, code) => {
    const log = vi.fn(); const persist = vi.fn(); const capture = vi.fn(async () => parse(rows as any[]));
    expect(await runProcessCensus({ argv: ['--preflight', '--json'], selfPid: 10, capture, persist, log })).toBe(code);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status, exit_code: code }));
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ status, exit_code: code, full_suite_pass: false });
  });

  it('writes only sanitized metadata to its diagnostic file', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-census-'));
    try {
      const log = vi.fn();
      expect(await runProcessCensus({ root: directory, argv: [], selfPid: 10, log,
        capture: async () => parse([proc(), external({ command: 'node vitest.mjs --token=secret-value' })]),
      })).toBe(1);
      const saved = fs.readFileSync(path.join(directory, '.local-evidence', 'process-preflight-v1.json'), 'utf8');
      expect(saved).not.toContain('secret-value');
      expect(saved).not.toContain('--token');
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-value');
      expect(JSON.parse(saved)).toMatchObject({ status: 'busy', exit_code: 1 });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it.each([false, true])('does not report success when persistence fails (busy=%s)', async busy => {
    const log = vi.fn();
    expect(await runProcessCensus({ argv: ['--json'], selfPid: 10, log,
      capture: async () => parse(busy ? [proc(), external()] : [proc()]),
      persist: () => { throw new Error('disk error secret-value'); },
    })).toBe(busy ? 1 : 2);
    expect(JSON.parse(log.mock.calls[0][0]).issues).toContain('report-write-failed');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-value');
  });

  it('handles a failed or absent snapshot without claiming observation succeeded', async () => {
    for (const capture of [async () => { throw new Error('query failed secret-value'); }, async () => null]) {
      const log = vi.fn();
      expect(await runProcessCensus({ argv: ['--json'], capture, log, persist: vi.fn() })).toBe(2);
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-value');
    }
  });

  it.each([['--help'], ['--allow-busy'], ['--postflight', '123'], ['--json', '--json']].map(argv => ({ argv })))(
    'does not query the host on help or invalid arguments $argv', async ({ argv }) => {
      const capture = vi.fn(); const persist = vi.fn();
      expect(await runProcessCensus({ argv, capture, persist, log: vi.fn(), error: vi.fn() })).toBe(argv[0] === '--help' ? 0 : 2);
      expect(capture).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    },
  );

  it.each([0, 1, 2])('the actual CLI awaits and preserves exit %i', status => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-census-cli-'));
    try {
      fs.copyFileSync(path.join(process.cwd(), 'tools/process-census.mjs'), path.join(directory, 'process-census.mjs'));
      fs.writeFileSync(path.join(directory, 'process-census-lib.mjs'), `
        export async function runProcessCensus() {
          await new Promise(resolve => setTimeout(resolve, 10));
          console.log(JSON.stringify(process.argv.slice(2))); return ${status};
        }
      `);
      const child = spawnSync(process.execPath, ['process-census.mjs', '--json'], {
        cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 5000,
      });
      expect(child.error).toBeUndefined();
      expect(child.status).toBe(status);
      expect(JSON.parse(child.stdout.trim())).toEqual(['--json']);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
