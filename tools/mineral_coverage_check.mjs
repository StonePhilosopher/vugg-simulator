#!/usr/bin/env node
/**
 * tools/mineral_coverage_check.mjs — find dead minerals.
 *
 * For each mineral in data/minerals.json, count how many (scenario,
 * seed) pairs in a 10-seed × all-scenarios sweep produced at least
 * one nucleation. Report:
 *
 *   * Live minerals: nucleated in ≥1 (scenario, seed). These have
 *     calibration signal — tunings can be tested against observed
 *     output.
 *
 *   * Stale minerals: nucleated in 0 pairs but ARE referenced by at
 *     least one scenario's expects_species list. These are the
 *     interesting cases — the scenario author wrote down "this should
 *     nucleate" but the engine never agrees. Either the scenario
 *     chemistry doesn't meet the engine's gates, the engine has a bug,
 *     or the expects_species claim is aspirational.
 *
 *   * Dead minerals: nucleated in 0 pairs AND no scenario claims them
 *     in expects_species. Authored but unreferenced — perhaps included
 *     for Library Mode browsing but never exercised by gameplay. Lower
 *     priority for calibration work, but useful to surface as the
 *     "minerals that exist on paper only" set.
 *
 * Usage: `node tools/mineral_coverage_check.mjs [seeds]`
 *   seeds: comma-separated integer list, defaults to 10 seeds
 *
 * Companion to tools/twin_rate_check.mjs (same harness, different
 * signal). Composable: both read data/minerals.json directly for
 * the authored side and run the bundle for the observed side.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'mineral_coverage_check' });

const MINERALS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8')).minerals;

// --- Sweep ---

const args = process.argv.slice(2);
const seeds = args[0]
  ? args[0].split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))
  : [42, 1, 7, 13, 23, 99, 314, 1729, 8675309, 137];

const scenarioNames = Object.keys(SCENARIOS).sort();
console.log(`[mineral_coverage_check] sweeping ${seeds.length} seeds × ${scenarioNames.length} scenarios at SIM_VERSION ${SIM_VERSION}\n`);

// Per-mineral observation: { nucleations, scenarios: Set<name> }
const obs = {};
function bump(mineral, scenarioName) {
  if (!obs[mineral]) obs[mineral] = { nucleations: 0, scenarios: new Set() };
  obs[mineral].nucleations++;
  obs[mineral].scenarios.add(scenarioName);
}

for (const seed of seeds) {
  for (const name of scenarioNames) {
    setSeed(seed);
    const { conditions, events, defaultSteps } = SCENARIOS[name]();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    for (const c of sim.crystals) bump(c.mineral, name);
  }
}

// Build expects_species reverse-lookup: for each mineral, which
// scenarios DECLARE it should appear?
const expectsLookup = {};  // { mineral: Set<scenarioName> }
for (const [scenName, scen] of Object.entries(SCENARIOS)) {
  // _json5_spec is attached to each scenario callable by 70-events.ts
  // (the buildScenarioFromSpec wrapper). expects_species lives there.
  const spec = scen._json5_spec;
  if (!spec) continue;
  const expects = spec.expects_species || [];
  for (const m of expects) {
    if (!expectsLookup[m]) expectsLookup[m] = new Set();
    expectsLookup[m].add(scenName);
  }
}

// Three categories.
const allMinerals = Object.keys(MINERALS_JSON).sort();
const live = [];
const stale = [];
const dead = [];

for (const m of allMinerals) {
  const o = obs[m];
  if (o && o.nucleations > 0) {
    live.push(m);
  } else {
    const expectedBy = expectsLookup[m] ? Array.from(expectsLookup[m]).sort() : [];
    if (expectedBy.length > 0) {
      stale.push({ mineral: m, expectedBy });
    } else {
      dead.push(m);
    }
  }
}

console.log(`Total minerals in spec: ${allMinerals.length}`);
console.log(`Live (≥1 nucleation in sweep): ${live.length}`);
console.log(`Stale (scenario expects, never nucleates): ${stale.length}`);
console.log(`Dead (no scenario references, no nucleations): ${dead.length}\n`);

console.log('Stale minerals — scenario authors wrote down expects_species but engine never agrees:');
console.log('-'.repeat(98));
if (stale.length === 0) {
  console.log('  (none — every expected mineral nucleates in at least one (scenario, seed) pair)');
} else {
  for (const s of stale) {
    console.log(`  ${s.mineral.padEnd(20)} expected by: ${s.expectedBy.join(', ')}`);
  }
}

console.log('\nDead minerals — authored in spec, never nucleated, no scenario claims them:');
console.log('-'.repeat(98));
const colWidth = 18;
let line = '  ';
for (let i = 0; i < dead.length; i++) {
  const cell = dead[i].padEnd(colWidth);
  if (line.length + cell.length > 96) {
    console.log(line);
    line = '  ';
  }
  line += cell;
}
if (line.trim()) console.log(line);

console.log(`\nLive minerals (${live.length}) — these have calibration signal in the sweep.`);
