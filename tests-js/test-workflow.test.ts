import { EventEmitter } from 'node:events';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CHILD_HEAP_LIMIT_MB,
  MAX_BATCH_RSS_BYTES,
  MAX_CONSECUTIVE_RSS_FAILURES,
  collectTestFiles,
  parseArgs,
  partitionTests,
  runTestWorkflow,
  runVitestBatch,
  selectResumeFiles,
  vitestBatchArgs,
} from '../tools/test-workflow.mjs';

describe('memory-bounded full-test workflow', () => {
  it('discovers every test deterministically and partitions without loss', () => {
    const files = collectTestFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files).toEqual([...files].sort());
    expect(new Set(files).size).toBe(files.length);
    expect(files.every((file) => file.startsWith('tests-js/') && file.endsWith('.test.ts'))).toBe(true);
    expect(partitionTests(files, 5).flat()).toEqual(files);
    expect(partitionTests(files, 5).every((batch) => batch.length <= 5)).toBe(true);
  });

  it('parses a deterministic sorted-file resume index and rejects unsafe values', () => {
    expect(parseArgs(['--batch-size', '4', '--start-index', '115'])).toEqual({
      help: false,
      batchSize: 4,
      startIndex: 115,
      selectedFiles: [],
    });
    expect(parseArgs(['--file', 'tests-js/a.test.ts', '--file', 'tests-js/b.test.ts']))
      .toEqual({
        help: false,
        batchSize: 5,
        startIndex: 0,
        selectedFiles: ['tests-js/a.test.ts', 'tests-js/b.test.ts'],
      });
    expect(() => parseArgs(['--start-index', '-1'])).toThrow('non-negative integer');
    expect(() => parseArgs(['--start-index', '1.5'])).toThrow('non-negative integer');
    expect(() => parseArgs(['--start-index', '1', '--file', 'tests-js/a.test.ts']))
      .toThrow('cannot be combined');
  });

  it('rejects an empty resume suffix instead of reporting a false green run', () => {
    const files = ['tests-js/a.test.ts', 'tests-js/b.test.ts'];
    expect(selectResumeFiles(files, 1)).toEqual(['tests-js/b.test.ts']);
    expect(() => selectResumeFiles(files, files.length)).toThrow('outside discovered file range');
    expect(() => selectResumeFiles([], 0)).toThrow('no test files discovered');
  });

  it('pins one worker, threads, file serialization, and concurrency on the command line', () => {
    const args = vitestBatchArgs(['tests-js/a.test.ts']);
    expect(args).toEqual(expect.arrayContaining([
      `--max-old-space-size=${CHILD_HEAP_LIMIT_MB}`,
      '--pool=threads',
      '--maxWorkers=1',
      '--no-file-parallelism',
      '--maxConcurrency=1',
    ]));
    expect(path.basename(args[1])).toBe('vitest.mjs');
  });

  it('monitors total RSS asynchronously and terminates an oversized child', async () => {
    const child = new EventEmitter() as any;
    child.pid = 1234;
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit('exit', null, 'SIGTERM'));
      return true;
    });
    const spawn = vi.fn(() => child);
    const rssSampler = vi.fn().mockResolvedValue(MAX_BATCH_RSS_BYTES + 1);
    const result = await runVitestBatch({
      batch: ['tests-js/a.test.ts'],
      spawn,
      rssSampler,
      pollIntervalMs: 1,
    });
    expect(result).toMatchObject({ status: 1, exceededRssBytes: MAX_BATCH_RSS_BYTES + 1 });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('fails closed and terminates the child when RSS monitoring is unavailable', async () => {
    const child = new EventEmitter() as any;
    child.pid = 1234;
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit('exit', null, 'SIGTERM'));
      return true;
    });
    const result = await runVitestBatch({
      batch: ['tests-js/a.test.ts'],
      spawn: () => child,
      rssSampler: vi.fn().mockRejectedValue(new Error('sampler denied')),
      pollIntervalMs: 1,
    });
    expect(result.status).toBe(1);
    expect(result.monitorError?.message).toContain(
      `RSS sampler failed ${MAX_CONSECUTIVE_RSS_FAILURES} consecutive times: sampler denied`,
    );
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('continues monitoring and escalates when a child ignores SIGTERM', async () => {
    const child = new EventEmitter() as any;
    child.pid = 1234;
    child.kill = vi.fn((signal: string) => {
      if (signal === 'SIGKILL') queueMicrotask(() => child.emit('exit', null, 'SIGKILL'));
      return true;
    });
    const rssSampler = vi.fn().mockResolvedValue(MAX_BATCH_RSS_BYTES + 1);
    const hardKiller = vi.fn();
    const result = await runVitestBatch({
      batch: ['tests-js/a.test.ts'],
      spawn: () => child,
      rssSampler,
      hardKiller,
      pollIntervalMs: 1,
      terminationGraceMs: 2,
      hardKillGraceMs: 2,
    });
    expect(result.status).toBe(1);
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    expect(rssSampler.mock.calls.length).toBeGreaterThan(1);
    expect(hardKiller).not.toHaveBeenCalled();
  });

  it('returns bounded and unreferences the child if every termination route fails', async () => {
    const child = new EventEmitter() as any;
    child.pid = 1234;
    child.kill = vi.fn(() => false);
    child.unref = vi.fn();
    const started = Date.now();
    const result = await runVitestBatch({
      batch: ['tests-js/a.test.ts'],
      spawn: () => child,
      rssSampler: vi.fn().mockResolvedValue(MAX_BATCH_RSS_BYTES + 1),
      hardKiller: vi.fn().mockRejectedValue(new Error('OS denied hard kill')),
      pollIntervalMs: 1,
      terminationGraceMs: 2,
      hardKillGraceMs: 2,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.status).toBe(1);
    expect(result.terminationError?.message).toContain('OS denied hard kill');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(child.unref).toHaveBeenCalledTimes(1);
  });

  it('runs batches serially and stops at the first failing batch', async () => {
    const batchRunner = vi.fn()
      .mockResolvedValueOnce({ status: 0, peakRssBytes: 100, exceededRssBytes: null, monitorError: null, terminationError: null })
      .mockResolvedValueOnce({ status: 7, peakRssBytes: 200, exceededRssBytes: null, monitorError: null, terminationError: null })
      .mockResolvedValueOnce({ status: 0, peakRssBytes: 100, exceededRssBytes: null, monitorError: null, terminationError: null });
    const status = await runTestWorkflow({
      files: ['tests-js/a.test.ts', 'tests-js/b.test.ts', 'tests-js/c.test.ts'],
      batchSize: 1,
      batchRunner,
    });
    expect(status).toBe(7);
    expect(batchRunner).toHaveBeenCalledTimes(2);
    expect(batchRunner.mock.invocationCallOrder[0]).toBeLessThan(batchRunner.mock.invocationCallOrder[1]);
  });
});
