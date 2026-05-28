#!/usr/bin/env node
/**
 * tools/gen-strip-digest.mjs — write the strip-view chemistry-trajectory
 * tripwire baseline to tests-js/baselines/strip_digest_v<N>.json.
 *
 * Companion to tests-js/strip-digest.test.ts (the tripwire) the way
 * gen-js-baseline.mjs is to calibration.test.ts. Records each curated
 * scenario through the StripRecorder, reduces the per-cell chemistry
 * trajectory to a compact digest (per key chip: {min,max,samples[8]} at
 * wall + center), and writes it keyed to the current SIM_VERSION.
 *
 * Run after any change that legitimately shifts a recorded trajectory
 * (engine change with a SIM_VERSION bump, OR a recording-layer change such
 * as a chip-read fix — those don't bump SIM_VERSION but DO move the digest):
 *   1. npm run build
 *   2. node tools/gen-strip-digest.mjs
 *   3. Inspect the diff vs the previous strip_digest_v*.json (it's
 *      human-readable: which chip's min/max/samples moved, at which depth).
 *   4. Commit the new baseline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import {
  STRIP_DIGEST_SCENARIOS,
  stripDigestForDataset,
} from './strip-digest-shape.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed, StripRecorder, stripDataIndex, stripDequantize } =
  await loadSimBundle({
    toolName: 'gen-strip-digest',
    extraExports: ['StripRecorder', 'stripDataIndex', 'stripDequantize'],
  });

const deps = { stripDataIndex, stripDequantize };

function recordScenario(name, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  const rec = new StripRecorder(sim, { duration_steps: steps, notes: `digest ${name}` });
  sim._stripRecorder = rec;
  for (let i = 0; i < steps; i++) sim.run_step();
  return rec.finalize();
}

const digest = { sim_version: SIM_VERSION, seed: 42, scenarios: {} };
for (const name of STRIP_DIGEST_SCENARIOS) {
  if (!SCENARIOS[name]) {
    console.log(`  ${name.padEnd(28)} (not registered — skipped)`);
    continue;
  }
  const ds = recordScenario(name, 42);
  digest.scenarios[name] = stripDigestForDataset(ds, deps);
  const chips = Object.keys(digest.scenarios[name].chips).length;
  console.log(`  ${name.padEnd(28)} ${String(ds.manifest.axes.steps).padStart(3)} steps, ${chips} key chips, depth ${digest.scenarios[name].depth_positions}`);
}

if (!fs.existsSync(BASELINES)) fs.mkdirSync(BASELINES, { recursive: true });
const outPath = path.join(BASELINES, `strip_digest_v${SIM_VERSION}.json`);
fs.writeFileSync(outPath, JSON.stringify(digest, null, 2) + '\n');
console.log(`\n[gen-strip-digest] wrote ${path.relative(ROOT, outPath)} (${Object.keys(digest.scenarios).length} scenarios)`);
