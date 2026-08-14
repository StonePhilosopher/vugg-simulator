#!/usr/bin/env node
/**
 * Run a bounded, serial multi-seed occurrence probe without rebaking the fleet.
 *
 * Usage:
 *   node tools/scenario-frequency-probe.mjs --scenarios=bisbee,reactive_wall --seeds=1,2,42
 *
 * The full commissioning receipt remains gen-locality-frequency-baseline.mjs.
 * This tool is the fast preflight for a named scenario change and intentionally
 * uses the same first-appearance accounting as that generator.
 */

import { loadSimBundle } from './_harness.mjs';

function csvArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find(arg => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).split(',').map(value => value.trim()).filter(Boolean) : fallback;
}

const requestedScenarios = csvArg('scenarios', []);
const seeds = csvArg('seeds', ['1', '2', '42']).map(Number);
if (!requestedScenarios.length) {
  throw new Error('At least one --scenarios=id[,id] value is required.');
}
if (seeds.some(seed => !Number.isSafeInteger(seed))) {
  throw new Error('--seeds values must be safe integers.');
}

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'scenario-frequency-probe',
});

for (const scenario of requestedScenarios) {
  if (!SCENARIOS[scenario]) throw new Error(`Unknown scenario: ${scenario}`);
}

console.log(`SIM ${SIM_VERSION}; seeds ${seeds.join(', ')}`);
for (const scenario of requestedScenarios) {
  console.log(`\n${scenario}`);
  for (const seed of seeds) {
    setSeed(seed);
    const { conditions, events, defaultSteps } = SCENARIOS[scenario]();
    const sim = new VugSimulator(conditions, events);
    const firstSteps = new Map();
    for (let i = 0; i < defaultSteps; i++) {
      try {
        sim.run_step();
      } catch (error) {
        throw new Error(
          `${scenario} seed ${seed} failed while advancing authored step ${i + 1}`,
          { cause: error },
        );
      }
      for (const crystal of sim.crystals) {
        const mineral = String(crystal?.mineral || '');
        if (mineral && !firstSteps.has(mineral)) firstSteps.set(mineral, Number(sim.step));
      }
    }
    const species = [...firstSteps.entries()].sort(([a], [b]) => a.localeCompare(b));
    console.log(`  seed ${seed}: ${species.length} species`);
    console.log(`    ${species.map(([mineral, step]) => `${mineral}@${step}`).join(', ')}`);
  }
}
