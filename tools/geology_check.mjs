#!/usr/bin/env node
/**
 * tools/geology_check.mjs — scenario-vs-real-paragenesis sanity audit.
 *
 * For a chosen scenario, run a 10-seed sweep and report per-mineral:
 *   * seeds-firing (of 10)
 *   * total crystals across the sweep
 *   * average crystal size (µm)
 *
 * Compare those to what literature says SHOULD be present. The boss's
 * "follow nature" framing — if a deposit class has 5 elements defining
 * it (e.g. Schneeberg's BiCoNiAgAs five-element formation) and one of
 * the canonical paragenesis members never fires, the broth is missing
 * a variable. Use this tool BEFORE chasing engine retunes.
 *
 * Born from the 2026-05-18 Path C cascade-gate audit, when Arc 2's
 * native_arsenic + native_bismuth softening surfaced that the broader
 * Bi-Co-Ni-Ag five-element-vein assemblage was still mostly dormant
 * because Schneeberg's broth was missing Co, Ni, AND Ag entirely.
 *
 * Companion to tools/mineral_coverage_check.mjs (system-wide live/dead)
 * and tools/stale_mineral_probe.mjs (per-mineral σ trace). Same harness
 * (tools/_harness.mjs).
 *
 * Configure the tracked mineral set + scenario at the top of the script.
 * Usage: `node tools/geology_check.mjs`
 */

import { loadSimBundle } from './_harness.mjs';

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'geology_check' });

const seeds = [42, 1, 7, 13, 23, 99, 314, 1729, 8675309, 137];
const scenario = 'schneeberg';
const tracked = ['native_arsenic', 'native_bismuth', 'native_silver', 'bismuthinite', 'autunite', 'zeunerite', 'torbernite', 'uraninite', 'arsenopyrite', 'erythrite', 'annabergite', 'cobaltite', 'nickeline', 'acanthite', 'naumannite'];

const byMineral = Object.fromEntries(tracked.map(m => [m, { seeds: [], totalCrystals: 0, totalSize_um: 0 }]));
for (const seed of seeds) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[scenario]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 160); i++) sim.run_step();
  for (const m of tracked) {
    const crystals = sim.crystals.filter(c => c.mineral === m);
    if (crystals.length) {
      byMineral[m].seeds.push(seed);
      byMineral[m].totalCrystals += crystals.length;
      byMineral[m].totalSize_um += crystals.reduce((s,c)=>s + (c.total_growth_um||0), 0);
    }
  }
}

console.log(`SIM_VERSION ${SIM_VERSION} | scenario: ${scenario} | ${seeds.length} seeds × default steps\n`);
console.log('mineral             seeds-firing   total-crystals   avg-size-um');
console.log('-'.repeat(74));
for (const m of tracked) {
  const o = byMineral[m];
  const avg = o.totalCrystals ? (o.totalSize_um / o.totalCrystals).toFixed(1) : '—';
  console.log(`${m.padEnd(20)} ${String(o.seeds.length).padStart(2)}/${seeds.length}            ${String(o.totalCrystals).padStart(4)}             ${avg}`);
}
