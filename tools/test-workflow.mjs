#!/usr/bin/env node
/**
 * Memory-bounded full Vitest workflow.
 *
 * The repository has more than 200 test files. Even with one Vitest worker, a
 * single long-lived Node process can retain enough jsdom/simulator state to
 * become unfriendly to a workstation. Run small batches sequentially so every
 * child exits and returns its heap to the OS before the next batch begins.
 */

import { execFile, spawn as spawnChild } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const execFileAsync = promisify(execFile);
export const DEFAULT_TEST_BATCH_SIZE = 5;
export const CHILD_HEAP_LIMIT_MB = 1536;
export const MAX_BATCH_RSS_BYTES = 2 * 1024 * 1024 * 1024;
export const RSS_POLL_INTERVAL_MS = 1000;
export const MAX_CONSECUTIVE_RSS_FAILURES = 2;
export const TERMINATION_GRACE_MS = 2000;
export const HARD_KILL_GRACE_MS = 2000;

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
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--batch-size') batchSize = Number(argv[++index]);
    else if (arg === '--start-index') startIndex = Number(argv[++index]);
    else if (arg === '--help') return { help: true, batchSize, startIndex };
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new Error(`start index must be a non-negative integer, received ${startIndex}`);
  }
  return { help: false, batchSize, startIndex };
}

export async function runTestWorkflow({
  batchSize = DEFAULT_TEST_BATCH_SIZE,
  files = collectTestFiles(),
  batchRunner = runVitestBatch,
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
    console.log(`[test-workflow] batch ${index + 1}/${batches.length} PASS (peak ${peakMb} MB RSS)`);
  }
  console.log(`\n[test-workflow] PASS: ${files.length} files across ${batches.length} memory-bounded batches`);
  return 0;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('node tools/test-workflow.mjs [--batch-size N] [--start-index N]');
    } else {
      const allFiles = collectTestFiles();
      const files = selectResumeFiles(allFiles, args.startIndex);
      if (args.startIndex > 0) {
        console.log(`[test-workflow] resuming at sorted file index ${args.startIndex} of ${allFiles.length}`);
      }
      process.exitCode = await runTestWorkflow({
        batchSize: args.batchSize,
        files,
      });
    }
  } catch (error) {
    console.error(`[test-workflow] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
