import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBuildAll } from '../tools/build-all-lib.mjs';
import { auditNarratorSourceText } from '../tools/narrative-workflow.mjs';

describe('build-all fail-closed generated-data and compiler gates', () => {
  it('returns the narrative-audit exit code and never compiles stale generated data', () => {
    const spawn = vi.fn(() => ({ status: 3, error: undefined }));
    const remove = vi.fn();
    const status = runBuildAll({
      spawn,
      execPath: 'node-test',
      root: 'repo-test',
      tscEntry: 'tsc-test',
      forwardedArgs: ['--check'],
      remove,
    });
    expect(status).toBe(3);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    expect(spawn.mock.calls[0][1]).toEqual(['tools/narrative-workflow.mjs', '--check']);
  });

  it('returns the TypeScript exit code and never splices a stale bundle', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({ status: 0, error: undefined })
      .mockReturnValueOnce({ status: 2, error: undefined });
    const remove = vi.fn();
    const status = runBuildAll({ spawn, remove, tscEntry: 'tsc-test', forwardedArgs: ['--check'] });
    expect(status).toBe(2);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/[\\/]dist$/), {
      recursive: true, force: true,
    });
    expect(spawn.mock.calls[1][1]).toEqual(['tsc-test', '-p', 'tsconfig.json']);
  });

  it('runs the splice only after clean narrative and compiler results', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({ status: 0, error: undefined })
      .mockReturnValueOnce({ status: 0, error: undefined })
      .mockReturnValueOnce({ status: 0, error: undefined });
    const remove = vi.fn();
    expect(runBuildAll({ spawn, remove, forwardedArgs: ['--check'] })).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(spawn.mock.calls[2][1]).toEqual(['tools/build.mjs', '--check']);
  });

  it('fails closed before compilation when the stale dist tree cannot be removed', () => {
    const spawn = vi.fn(() => ({ status: 0, error: undefined }));
    const remove = vi.fn(() => { throw new Error('access denied'); });
    expect(runBuildAll({ spawn, remove, forwardedArgs: ['--check'] })).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it.each([
    { stage: 'narrative', call: 1 },
    { stage: 'typescript', call: 2 },
    { stage: 'splice', call: 3 },
  ])('does not treat a $stage spawn error or signal as success', ({ call }) => {
    for (const failure of [{ status: 0, error: new Error('spawn denied') }, { status: null, signal: 'SIGTERM' }]) {
      let current = 0;
      const spawn = vi.fn(() => ++current === call ? failure : { status: 0 });
      const remove = vi.fn();
      expect(runBuildAll({ spawn, remove, forwardedArgs: ['--check'] })).toBe(1);
      expect(spawn).toHaveBeenCalledTimes(call);
      expect(remove).toHaveBeenCalledTimes(call === 1 ? 0 : 1);
    }
  });

  it('preserves a failed bundle check instead of publishing a successful build', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 9 });
    expect(runBuildAll({ spawn, remove: vi.fn(), forwardedArgs: ['--check'] })).toBe(9);
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it.each([
    { mode: 'generation', forwardedArgs: [] },
    { mode: 'check', forwardedArgs: ['--check'] },
  ])('orders all build phases and preserves $mode mode', ({ forwardedArgs }) => {
    const events: string[] = [];
    const calls: Array<{ command: string; args: string[]; options: any }> = [];
    const root = path.join(os.tmpdir(), 'vugg-build-contract');
    const spawn = (command: string, args: string[], options: any) => {
      calls.push({ command, args, options });
      events.push(args[0]);
      return { status: 0 };
    };
    const remove = vi.fn((target: string, options: any) => {
      expect(target).toBe(path.join(root, 'dist'));
      expect(options).toEqual({ recursive: true, force: true });
      events.push('remove-dist');
    });
    expect(runBuildAll({ spawn, remove, root, tscEntry: 'tsc-test', execPath: 'node-test', forwardedArgs })).toBe(0);
    expect(events).toEqual(['tools/narrative-workflow.mjs', 'remove-dist', 'tsc-test', 'tools/build.mjs']);
    expect(calls.map(call => call.args)).toEqual([
      ['tools/narrative-workflow.mjs', ...forwardedArgs],
      ['tsc-test', '-p', 'tsconfig.json'],
      ['tools/build.mjs', ...forwardedArgs],
    ]);
    for (const call of calls) {
      expect(call.command).toBe('node-test');
      expect(call.options).toEqual({ cwd: root, stdio: 'inherit' });
    }
  });
});

describe('build-all CLI entry point', () => {
  it.each([0, 7])('returns the library verdict %i and preserves check-mode arguments', status => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-build-wrapper-'));
    try {
      // Execute the actual wrapper in isolation; no generated files or real
      // compiler processes are touched by the injected library.
      const wrapper = path.join(directory, 'build-all.mjs');
      fs.copyFileSync(path.join(process.cwd(), 'tools/build-all.mjs'), wrapper);
      fs.writeFileSync(path.join(directory, 'build-all-lib.mjs'), `
        export function runBuildAll() {
          console.log(JSON.stringify({ args: process.argv.slice(2) }));
          return ${status};
        }
      `);
      const result = spawnSync(process.execPath, [wrapper, '--check'], {
        cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 5000,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(status);
      expect(JSON.parse(result.stdout.trim())).toEqual({ args: ['--check'] });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});

describe('narrative AST audit', () => {
  it('rejects identifier-mediated prose fallbacks, named fallback prose, and dynamic variants', () => {
    const audit = auditNarratorSourceText(`
      const loaded = narrative_blurb('quartz');
      const alias = loaded;
      parts.push(alias || 'stale prose');
      const fallback = \`also stale prose\`;
      parts.push(narrative_variant('quartz', selectedVariant));
    `);

    expect(audit.inlineFallbacks).toHaveLength(2);
    expect(audit.dynamicVariants).toHaveLength(1);
  });

  it('allows unrelated defaults and literal narrative sections', () => {
    const audit = auditNarratorSourceText(`
      const habit = crystal.habit || '';
      parts.push(narrative_variant('quartz', 'gwindel', { habit }));
    `);

    expect(audit).toEqual({ inlineFallbacks: [], dynamicVariants: [] });
  });
});
