import { describe, expect, it, vi } from 'vitest';
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
