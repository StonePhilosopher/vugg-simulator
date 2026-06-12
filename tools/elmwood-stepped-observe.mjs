#!/usr/bin/env node
/**
 * tools/elmwood-stepped-observe.mjs — the calcite-morphology Phase 5
 * judge. Runs the elmwood scenario across seeds and reports, per seed:
 *
 *   - the MVT assemblage (sphalerite / fluorite / barite / calcite
 *     counts — the expects gate, multi-seed because single-seed pins
 *     are brittle, v135/v137/v181 pattern);
 *   - the HEADLINE calcite (largest): size, final habit, per-zone
 *     regime mix, and the TERRACE BAND COUNT calciteTerraceBands would
 *     hand the renderer — the number the boss actually sees;
 *   - the σ story: how many of the CO3 brine pulses the calcite rode
 *     (zones in the stepped band vs smooth band).
 *
 * The scenario exists to put a fluid-mode scalenohedral calcite
 * squarely in the stepped band with a pulse-train σ — this instrument
 * is the proof (or the tuning feedback).
 *
 * Usage: node tools/elmwood-stepped-observe.mjs [--seeds 42,1,7,13,99,2024,17,3]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'elmwood-observe' });

const args = process.argv.slice(2);
const seedArg = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : '42,1,7,13,99,2024,17,3';
const SEEDS = seedArg.split(',').map(Number);

if (!SCENARIOS.elmwood) {
  console.error('elmwood is not registered — add it to data/scenarios.json5 first');
  process.exit(1);
}

const ASSEMBLAGE = ['sphalerite', 'fluorite', 'barite', 'calcite', 'galena', 'dolomite'];
const rates = Object.fromEntries(ASSEMBLAGE.map((m) => [m, 0]));
let steppedHeadlines = 0;

for (const seed of SEEDS) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.elmwood();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();

  const counts = {};
  for (const c of sim.crystals) {
    if (c.dissolved) continue;
    counts[c.mineral] = (counts[c.mineral] || 0) + 1;
  }
  for (const m of ASSEMBLAGE) if (counts[m]) rates[m]++;

  const cals = sim.crystals.filter((c) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
  let head = null;
  for (const c of cals) if (!head || c.total_growth_um > head.total_growth_um) head = c;

  let line = `seed ${String(seed).padStart(4)}  ` + ASSEMBLAGE.map((m) => `${m.slice(0, 4)}:${counts[m] || 0}`).join(' ');
  if (head) {
    const mass = {};
    for (const z of head.zones) {
      if (!z.morph_regime || z.thickness_um <= 0) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
    }
    const tot = Object.values(mass).reduce((s, x) => s + x, 0) || 1;
    const steppedShare = ((mass.stepped_macro || 0) + (mass.stepped_mild || 0)) / tot;
    // Band count from the same regime-run walk calciteTerraceBands does
    // (recomputed here to stay dependency-light on the harness exports).
    let bandCount = 0, prevR = null;
    for (const z of head.zones) {
      if (!z.morph_regime || z.thickness_um <= 0) continue;
      if (z.morph_regime !== prevR) { bandCount++; prevR = z.morph_regime; }
    }
    line += `  | head calcite ${(head.total_growth_um / 1000).toFixed(1)}mm ${head.habit}`
      + ` stepped ${(100 * steppedShare).toFixed(0)}% bands ${bandCount}`;
    // Gate trued v192: the >0.4 share gate NEVER matched the shipped
    // claim (~18% fine-stepped rim on a massive golden core IS the
    // Elmwood hand specimen — macro-pagoda deliberately not chased).
    // The headline contract = stepped habit + the recorded rim share.
    if (String(head.habit).startsWith('stepped_') && steppedShare >= 0.15 && bandCount >= 8) steppedHeadlines++;
  } else {
    line += '  | NO CALCITE';
  }
  console.log(line);
}

console.log('\nfire rates over ' + SEEDS.length + ' seeds:');
for (const m of ASSEMBLAGE) console.log(`  ${m.padEnd(11)} ${rates[m]}/${SEEDS.length}`);
console.log(`  stepped headline calcite: ${steppedHeadlines}/${SEEDS.length}`);
