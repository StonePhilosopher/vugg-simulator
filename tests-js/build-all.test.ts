import { describe, expect, it, vi } from 'vitest';
import { runBuildAll } from '../tools/build-all-lib.mjs';

describe('build-all fail-closed compiler gate', () => {
  it('returns the TypeScript exit code and never splices a stale bundle', () => {
    const spawn = vi.fn(() => ({ status: 2, error: undefined }));
    const status = runBuildAll({
      spawn,
      execPath: 'node-test',
      root: 'repo-test',
      tscEntry: 'tsc-test',
      forwardedArgs: ['--check'],
    });
    expect(status).toBe(2);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][1]).toEqual(['tsc-test', '-p', 'tsconfig.json']);
  });

  it('runs the splice only after a clean compiler result', () => {
    const spawn = vi.fn()
      .mockReturnValueOnce({ status: 0, error: undefined })
      .mockReturnValueOnce({ status: 0, error: undefined });
    expect(runBuildAll({ spawn, forwardedArgs: ['--check'] })).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn.mock.calls[1][1]).toEqual(['tools/build.mjs', '--check']);
  });
});
