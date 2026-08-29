import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CHILD_HEAP_LIMIT_MB,
  DEFAULT_TEST_BATCH_SIZE,
  MAX_BATCH_RSS_BYTES,
  MAX_CONSECUTIVE_RSS_FAILURES,
  TEST_CHECKPOINT_SCHEMA,
  TEST_CHECKPOINT_TRUST,
  assertTestWorkflowIdentityUnchanged,
  automaticTestRunPlan,
  collectTestIdentityFiles,
  collectTestFiles,
  makeTestCheckpoint,
  makeTestCompletionReport,
  parseArgs,
  partitionTests,
  readTestCheckpoint,
  runTestWorkflow,
  runVitestBatch,
  selectResumeFiles,
  testWorkflowIdentity,
  vitestBatchArgs,
  writeJsonAtomic,
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
    expect(DEFAULT_TEST_BATCH_SIZE).toBe(1);
    expect(partitionTests(files).every((batch) => batch.length === 1)).toBe(true);
  });

  it('parses a deterministic sorted-file resume index and rejects unsafe values', () => {
    expect(parseArgs(['--batch-size', '4', '--start-index', '115'])).toEqual({
      help: false,
      batchSize: 4,
      startIndex: 115,
      selectedFiles: [],
      fresh: false,
    });
    expect(parseArgs(['--file', 'tests-js/a.test.ts', '--file', 'tests-js/b.test.ts']))
      .toEqual({
        help: false,
        batchSize: 1,
        startIndex: 0,
        selectedFiles: ['tests-js/a.test.ts', 'tests-js/b.test.ts'],
        fresh: false,
      });
    expect(parseArgs(['--fresh'])).toMatchObject({ fresh: true });
    expect(() => parseArgs(['--start-index', '-1'])).toThrow('non-negative integer');
    expect(() => parseArgs(['--start-index', '1.5'])).toThrow('non-negative integer');
    expect(() => parseArgs(['--start-index', '1', '--file', 'tests-js/a.test.ts']))
      .toThrow('cannot be combined');
  });

  it('uses a clearly untrusted operator prefix and rejects stale or non-prefix checkpoints', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-test-checkpoint-'));
    try {
      fs.writeFileSync(path.join(directory, 'a.txt'), 'alpha');
      const identity = testWorkflowIdentity({
        root: directory,
        identityFiles: ['a.txt'],
        runtime: { node: 'test', v8: 'test', platform: 'test', arch: 'test' },
      });
      const allFiles = ['tests-js/a.test.ts', 'tests-js/b.test.ts'];
      const checkpointPath = path.join(directory, 'checkpoint.json');
      writeJsonAtomic(checkpointPath, makeTestCheckpoint({
        identity,
        completedFiles: [allFiles[0]],
        batches: [{ files: [allFiles[0]], peak_rss_bytes: 123 }],
      }));
      expect(readTestCheckpoint({ checkpointPath, identity, allFiles }))
        .toMatchObject({
          schema: TEST_CHECKPOINT_SCHEMA,
          trust: TEST_CHECKPOINT_TRUST,
          full_suite_pass: false,
          completed_files: [allFiles[0]],
        });

      fs.writeFileSync(path.join(directory, 'a.txt'), 'changed');
      const staleIdentity = testWorkflowIdentity({
        root: directory,
        identityFiles: ['a.txt'],
        runtime: { node: 'test', v8: 'test', platform: 'test', arch: 'test' },
      });
      expect(readTestCheckpoint({ checkpointPath, identity: staleIdentity, allFiles })).toBeNull();

      writeJsonAtomic(checkpointPath, makeTestCheckpoint({
        identity,
        completedFiles: [allFiles[1]],
        batches: [{ files: [allFiles[1]], peak_rss_bytes: 123 }],
      }));
      expect(readTestCheckpoint({ checkpointPath, identity, allFiles })).toBeNull();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('binds the complete project input tree, including release docs and CHANGELOG', () => {
    const files = collectTestIdentityFiles();
    expect(files).toContain('CHANGELOG.md');
    expect(files).toContain('docs/external-gate-evidence-template.json');
    expect(files).toContain('docs/RELEASE-MIGRATION-POLICY.md');
    expect(files).toContain('dist/00-mineral-spec.js');
    expect(files.some(file => file.startsWith('node_modules/'))).toBe(false);
    expect(files.some(file => file.startsWith('.local-evidence/'))).toBe(false);
  });

  it('refuses a fabricated complete checkpoint and never turns resume into full-suite PASS', () => {
    const allFiles = ['tests-js/a.test.ts', 'tests-js/b.test.ts'];
    const forgedComplete = makeTestCheckpoint({
      identity: { sha256: 'a'.repeat(64) },
      completedFiles: allFiles,
      batches: allFiles.map(file => ({ files: [file], peak_rss_bytes: 1 })),
    });
    expect(() => automaticTestRunPlan({ allFiles, resumed: forgedComplete }))
      .toThrow('refusing a zero-test PASS');

    const resumed = makeTestCheckpoint({
      identity: { sha256: 'a'.repeat(64) },
      completedFiles: [allFiles[0]],
      batches: [{ files: [allFiles[0]], peak_rss_bytes: 1 }],
    });
    const plan = automaticTestRunPlan({ allFiles, resumed });
    expect(plan).toMatchObject({
      resumeIndex: 1,
      files: [allFiles[1]],
      uninterrupted: false,
    });
    expect(makeTestCompletionReport({
      identity: resumed.identity,
      completedFiles: allFiles,
      batches: resumed.batches,
      uninterrupted: plan.uninterrupted,
    })).toMatchObject({
      status: 'operator-resume-complete',
      full_suite_pass: false,
      trust: TEST_CHECKPOINT_TRUST,
    });
  });

  it('fails closed when any project input changes during a run', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-test-identity-drift-'));
    try {
      const input = path.join(directory, 'CHANGELOG.md');
      fs.writeFileSync(input, 'before');
      const runtime = { node: 'test', v8: 'test', platform: 'test', arch: 'test' };
      const identity = testWorkflowIdentity({ root: directory, runtime });
      expect(assertTestWorkflowIdentityUnchanged(identity, { root: directory, runtime }).sha256)
        .toBe(identity.sha256);

      const batchRunner = vi.fn(async () => {
        fs.writeFileSync(input, 'after');
        return {
          status: 0,
          peakRssBytes: 100,
          exceededRssBytes: null,
          monitorError: null,
          terminationError: null,
        };
      });
      await expect(runTestWorkflow({
        files: ['tests-js/a.test.ts'],
        batchRunner,
        assertStable: () => assertTestWorkflowIdentityUnchanged(identity, {
          root: directory,
          runtime,
        }),
      })).rejects.toThrow('project identity changed during the test run');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
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
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as any;
      child.pid = 1234;
      child.kill = vi.fn((signal: string) => {
        if (signal === 'SIGKILL') queueMicrotask(() => child.emit('exit', null, 'SIGKILL'));
        return true;
      });
      const rssSampler = vi.fn().mockResolvedValue(MAX_BATCH_RSS_BYTES + 1);
      const hardKiller = vi.fn();
      const resultPromise = runVitestBatch({
        batch: ['tests-js/a.test.ts'],
        spawn: () => child,
        rssSampler,
        hardKiller,
        pollIntervalMs: 100,
        terminationGraceMs: 500,
        hardKillGraceMs: 500,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(rssSampler).toHaveBeenCalledTimes(1);
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');

      // Monitoring remains live while the child ignores SIGTERM. Fake time
      // makes this causal ordering independent of the host timer quantum.
      await vi.advanceTimersByTimeAsync(100);
      expect(rssSampler).toHaveBeenCalledTimes(2);
      expect(child.kill).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(400);
      const result = await resultPromise;
      expect(result.status).toBe(1);
      expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
      expect(hardKiller).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

  it('persists progress only after a passing batch', async () => {
    const onBatchPass = vi.fn();
    const batchRunner = vi.fn()
      .mockResolvedValueOnce({ status: 0, peakRssBytes: 100, exceededRssBytes: null, monitorError: null, terminationError: null })
      .mockResolvedValueOnce({ status: 7, peakRssBytes: 200, exceededRssBytes: null, monitorError: null, terminationError: null });
    const status = await runTestWorkflow({
      files: ['tests-js/a.test.ts', 'tests-js/b.test.ts'],
      batchSize: 1,
      batchRunner,
      onBatchPass,
    });
    expect(status).toBe(7);
    expect(onBatchPass).toHaveBeenCalledTimes(1);
    expect(onBatchPass).toHaveBeenCalledWith(expect.objectContaining({
      batch: ['tests-js/a.test.ts'],
      peakRssBytes: 100,
    }));
  });
});
