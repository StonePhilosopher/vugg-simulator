#!/usr/bin/env node
/**
 * tools/gen-js-baseline.mjs — capture the seed-42 calibration sweep
 * across every scenario and dump it to tests-js/baselines/seed42_v<N>.json.
 *
 * Run after a SIM_VERSION bump that changes seed-42 output:
 *   1. Bump SIM_VERSION in js/15-version.ts.
 *   2. `npm run build`
 *   3. `node tools/gen-js-baseline.mjs`
 *   4. Inspect the diff vs the previous baseline (a few `diff -u` calls
 *      between sequential seed42_v*.json files). Wide spread or
 *      catastrophic drops are red flags.
 *   5. Commit the new baseline alongside the SIM_VERSION-bump commit.
 *
 * The companion test suite (tests-js/calibration.test.ts) reads the
 * baseline matching the current SIM_VERSION and asserts every scenario
 * still produces the same per-mineral counts. CI fails if a chemistry
 * change shifts seed-42 output without updating the baseline — exactly
 * the regression-catch the JS-side harness exists for.
 *
 * Mirrors the logic in tests-js/setup.ts (jsdom + bundle eval + fetch
 * mock + DOM stub) but writes to disk instead of running tests. We
 * inline the harness here rather than import from setup.ts because
 * setup.ts uses Vitest's `beforeAll` hook which doesn't exist outside
 * a Vitest run.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import { evidenceBundleDigest } from './locality-frequency-checkpoint.mjs';
import {
  assertCommissionedEvidenceRuntime,
  nodeRuntimeDigest,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';
import {
  evidenceIdentity,
  loadScenarioReceipt,
  prepareEvidenceCheckpointDirectory,
  scenarioReceipt,
  scenarioSpecHash,
  writeJsonAtomic,
} from './scenario-evidence-checkpoint.mjs';

assertCommissionedEvidenceRuntime();

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
for (const arg of args) {
  if (arg !== '--fresh') throw new Error(`unknown argument: ${arg}`);
}

const { SIM_VERSION, MODEL_DIGEST, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'gen-baseline' });
const checkpointDir = prepareEvidenceCheckpointDirectory(ROOT, evidenceIdentity({
  kind: 'seed42-baseline',
  simVersion: SIM_VERSION,
  modelDigest: MODEL_DIGEST,
  bundleDigest: evidenceBundleDigest(ROOT),
  executionDigest: runtimeExecutionDigest(ROOT),
  producerDigest: producerContractDigest(ROOT, 'seed42-baseline'),
  runtimeDigest: nodeRuntimeDigest(),
  seed: 42,
}), { fresh });

// --- Run every scenario at seed 42 + summarize ---

function summarize(sim) {
  const out = {};
  if (!sim || !sim.crystals) return out;
  for (const c of sim.crystals) {
    if (!out[c.mineral]) {
      out[c.mineral] = { active: 0, dissolved: 0, total: 0, max_um: 0 };
    }
    out[c.mineral].total++;
    if (c.dissolved) out[c.mineral].dissolved++;
    else out[c.mineral].active++;
    if (c.total_growth_um > out[c.mineral].max_um) {
      out[c.mineral].max_um = Math.round(c.total_growth_um * 10) / 10;
    }
  }
  // Sort keys for stable diff output across runs.
  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

function runScenario(name, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  return sim;
}

const names = Object.keys(SCENARIOS).sort();
const outPath = path.join(BASELINES, `seed42_v${SIM_VERSION}.json`);
const baseline = {};
for (const name of names) {
  const { defaultSteps } = SCENARIOS[name]();
  const expected = {
    id: name,
    specHash: scenarioSpecHash(SCENARIOS[name]._json5_spec),
    durationSteps: defaultSteps ?? 100,
    seed: 42,
  };
  const checkpointPath = path.join(checkpointDir, `${name}.json`);
  const checkpoint = loadScenarioReceipt(checkpointPath, expected);
  if (checkpoint?.payload !== undefined) {
    baseline[name] = checkpoint.payload;
    const total = Object.values(baseline[name]).reduce((n, value) => n + Number(value.total || 0), 0);
    console.log(`  ${name.padEnd(36)} ${String(total).padStart(3)} crystals, ${String(Object.keys(baseline[name]).length).padStart(2)} species [resumed]`);
    continue;
  }
  const sim = runScenario(name, 42);
  baseline[name] = summarize(sim);
  writeJsonAtomic(checkpointPath, scenarioReceipt({ ...expected, payload: baseline[name] }));
  const total = sim.crystals.length;
  const minerals = Object.keys(baseline[name]).length;
  console.log(`  ${name.padEnd(36)} ${String(total).padStart(3)} crystals, ${String(minerals).padStart(2)} species`);
}

writeJsonAtomic(outPath, baseline);
console.log(`\n[gen-baseline] wrote ${path.relative(ROOT, outPath)} (${names.length} scenarios)`);
