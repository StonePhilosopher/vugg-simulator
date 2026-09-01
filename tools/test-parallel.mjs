#!/usr/bin/env node
/**
 * tools/test-parallel.mjs — run the vitest suite as N process shards.
 *
 * On a machine with C cores, one vitest process with C workers still
 * leaves scheduling gaps (long files block a worker). Two processes
 * each with C/2 workers keep the CPUs busier. Exit code is the worst
 * shard status.
 *
 * Usage:
 *   node tools/test-parallel.mjs          # 2 shards (default)
 *   node tools/test-parallel.mjs 4        # 4 shards
 */
import { spawn } from 'node:child_process';
import os from 'node:os';

const shards = Math.max(1, parseInt(process.argv[2] || '2', 10) || 2);
const cpus = os.cpus()?.length || 4;
const workers = Math.max(1, Math.floor(cpus / shards));

console.log(`[test-parallel] ${shards} shards × ${workers} workers (cpus=${cpus})`);

const children = [];
for (let i = 1; i <= shards; i++) {
  const child = spawn(
    process.execPath,
    [
      './node_modules/vitest/vitest.mjs',
      'run',
      `--shard=${i}/${shards}`,
      `--maxWorkers=${workers}`,
      '--reporter=dot',
    ],
    { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname },
  );
  children.push(child);
}

const codes = await Promise.all(
  children.map(
    (c) =>
      new Promise((resolve) => {
        c.on('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
      }),
  ),
);
const worst = Math.max(0, ...codes.map((c) => c || 0));
console.log(`[test-parallel] done — shard exits: ${codes.join(', ')}`);
process.exit(worst);
