#!/usr/bin/env node

import { loadSimBundle } from './_harness.mjs';

if (typeof globalThis.gc !== 'function') {
  throw new Error('cavity production memory budget requires node --expose-gc');
}
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'cavity-production-memory-budget',
});
const requireBudget = (condition, message) => {
  if (!condition) throw new Error(`Cavity production memory budget failed: ${message}`);
};

setSeed(42);
const { conditions, events } = SCENARIOS.reactive_wall();
conditions.fluid.pH = 4;
conditions.flow_rate = 0.4;
const sim = new VugSimulator(conditions, events);
const samples = [];
for (let commit = 1; commit <= 6; commit++) {
  sim.conditions.fluid.pH = 4;
  for (const ring of sim.wall_state.rings) for (const cell of ring) cell.fluid.pH = 4;
  sim.dissolve_wall();
  for (let pass = 0; pass < 3; pass++) globalThis.gc();
  const memory = process.memoryUsage();
  samples.push({
    commit,
    cursor: sim.wall_state.cavityEvolutionLedger().cursor,
    heap_mb: Number((memory.heapUsed / 1048576).toFixed(2)),
    external_mb: Number((memory.external / 1048576).toFixed(2)),
    array_buffers_mb: Number((memory.arrayBuffers / 1048576).toFixed(2)),
    rss_mb: Number((memory.rss / 1048576).toFixed(2)),
  });
}
requireBudget(samples.every((sample, index) => sample.cursor === index + 1),
  `unexpected erosion cursors ${samples.map(sample => sample.cursor)}`);
const first = samples[0], last = samples[samples.length - 1];
requireBudget(last.heap_mb <= first.heap_mb + 16,
  `post-GC heap grew ${last.heap_mb - first.heap_mb} MB`);
requireBudget(last.external_mb <= first.external_mb + 4,
  `post-GC external memory grew ${last.external_mb - first.external_mb} MB`);
requireBudget(last.array_buffers_mb <= first.array_buffers_mb + 4,
  `post-GC array buffers grew ${last.array_buffers_mb - first.array_buffers_mb} MB`);
requireBudget(last.rss_mb <= first.rss_mb + 64,
  `post-GC RSS grew ${last.rss_mb - first.rss_mb} MB`);
const receipt = Object.freeze({
  schema: 'cavity-production-memory-budget-v1',
  scenario: 'reactive_wall', simulation_seed: 42,
  shape_seed: conditions.wall.shape_seed,
  commits: samples.length,
  samples,
});
console.log(`[cavity-production-memory-budget] ${JSON.stringify(receipt)}`);
