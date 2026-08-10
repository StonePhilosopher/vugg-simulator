#!/usr/bin/env node
/**
 * Generate the bounded multi-seed occurrence receipt used by the fast locality
 * audit. This is deliberately a commissioning generator, not an ordinary CI
 * step: it executes all scenarios serially for seeds 1, 2, and 42, then CI
 * validates the saved receipt against the current behavioral contract.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import {
  LOCALITY_FREQUENCY_SEEDS,
  localityFrequencySpecHash,
  reconstructFrequencyOccurrences,
} from './locality-frequency-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { SIM_VERSION, MODEL_DIGEST, SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'gen-locality-frequency-baseline',
});

const scenarios = {};
for (const id of Object.keys(SCENARIOS).sort()) {
  const spec = SCENARIOS[id]._json5_spec;
  const runs = [];

  for (const seed of LOCALITY_FREQUENCY_SEEDS) {
    setSeed(seed);
    const { conditions, events, defaultSteps } = SCENARIOS[id]();
    const sim = new VugSimulator(conditions, events);
    const firstSteps = new Map();
    for (let i = 0; i < defaultSteps; i++) {
      sim.run_step();
      for (const crystal of sim.crystals) {
        const mineral = String(crystal?.mineral || '');
        if (mineral && !firstSteps.has(mineral)) firstSteps.set(mineral, Number(sim.step));
      }
    }
    const species = [...firstSteps.keys()].sort();
    runs.push({
      seed,
      species,
      first_steps: Object.fromEntries([...firstSteps.entries()].sort(([a], [b]) => a.localeCompare(b))),
    });
  }

  const reconstructed = reconstructFrequencyOccurrences({
    duration_steps: Number(spec.duration_steps),
    runs,
  }, LOCALITY_FREQUENCY_SEEDS);
  if (reconstructed.errors.length) {
    throw new Error(`${id}: generated invalid frequency runs: ${reconstructed.errors.join('; ')}`);
  }
  const occurrences = reconstructed.occurrences;
  scenarios[id] = {
    locality_frequency_spec_hash: localityFrequencySpecHash(spec),
    duration_steps: Number(spec.duration_steps),
    occurrences,
    runs,
  };
  const statisticalCount = (spec.statistical_species || []).length;
  console.log(`  ${id.padEnd(32)} ${Object.keys(occurrences).length} panel species, ${statisticalCount} statistical target(s)`);
}

const receipt = {
  schema: 'vugg-locality-frequency-baseline-v1',
  sim_version: SIM_VERSION,
  model_digest: MODEL_DIGEST,
  seeds: [...LOCALITY_FREQUENCY_SEEDS],
  scenarios,
};
const outPath = path.join(ROOT, 'tests-js', 'baselines', `locality_frequency_v${SIM_VERSION}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`\n[gen-locality-frequency] wrote ${path.relative(ROOT, outPath)} (${Object.keys(scenarios).length} scenarios, seeds ${LOCALITY_FREQUENCY_SEEDS.join(', ')})`);
