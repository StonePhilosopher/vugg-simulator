#!/usr/bin/env node
/**
 * tools/saddle-dolomite-observe.mjs — dolomite HABIT × TEMPERATURE fleet map.
 *
 * Science check for the deformation/shear arc (RESEARCH-deformation-shear-
 * 2026-06-20.md §2): saddle (baroque) dolomite curvature is a GROWTH-DEFECT
 * driven by surface roughening ABOVE a critical temperature (~50–60 °C; Gregg
 * & Sibley 1984 CRT) + Ca-excess. Below the roughening T, dolomite grows
 * PLANAR. So an ambient scenario (coorong_sabkha ~25 °C) producing the
 * saddle_rhomb habit would be geologically WRONG.
 *
 * This probe runs every scenario, finds dolomite crystals, and reports — per
 * crystal-zone — the habit tag the engine assigned vs the temperature at that
 * zone. The question: does saddle_rhomb fire below the roughening T anywhere?
 *
 * Touches no engine code. Usage: node tools/saddle-dolomite-observe.mjs [--seed 42]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'saddle-dolomite-observe' });
const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;

const CRT_LO = 50, CRT_HI = 60; // Gregg & Sibley roughening band

const rows = [];
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const tByStep = {};
  const steps = defaultSteps || 100;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    tByStep[sim.step] = sim.conditions.temperature;
  }
  const dols = sim.crystals.filter((c) => c.mineral === 'dolomite' && !c.dissolved && c.total_growth_um > 0);
  if (!dols.length) continue;

  // habit tally + min/max T at which each habit's zones were grown
  const habitT = {}; // habit -> {n, tmin, tmax, umGrown}
  let saddleBelowCRT = 0, saddleGrowthUm = 0;
  for (const c of dols) {
    const h = c.habit || '(none)';
    for (const z of (c.zones || [])) {
      if (!(z.thickness_um > 0)) continue;
      const T = isFinite(tByStep[z.step]) ? tByStep[z.step] : (z.temperature ?? NaN);
      const rec = habitT[h] || (habitT[h] = { n: 0, tmin: Infinity, tmax: -Infinity, um: 0 });
      rec.n++; rec.um += z.thickness_um;
      if (isFinite(T)) { rec.tmin = Math.min(rec.tmin, T); rec.tmax = Math.max(rec.tmax, T); }
    }
    if ((c.habit || '').includes('saddle')) {
      // approximate T at this crystal's final habit decision: last positive zone
      const lastPos = [...(c.zones || [])].reverse().find((z) => z.thickness_um > 0);
      const T = lastPos ? (tByStep[lastPos.step] ?? lastPos.temperature) : NaN;
      saddleGrowthUm += c.total_growth_um;
      if (isFinite(T) && T < CRT_LO) saddleBelowCRT++;
    }
  }
  rows.push({ scen, nDol: dols.length, habitT, saddleBelowCRT, saddleGrowthUm });
}

console.log(`\nDOLOMITE HABIT × TEMPERATURE (seed ${SEED}) — roughening band ${CRT_LO}–${CRT_HI} °C\n`);
console.log('scenario'.padEnd(30) + 'dol  habit'.padEnd(22) + 'zones   T-range(°C)      µm');
console.log('-'.repeat(92));
for (const r of rows.sort((a, b) => a.scen.localeCompare(b.scen))) {
  let first = true;
  for (const [h, rec] of Object.entries(r.habitT).sort((a, b) => b[1].um - a[1].um)) {
    const trange = isFinite(rec.tmin) ? `${rec.tmin.toFixed(0)}–${rec.tmax.toFixed(0)}` : '?';
    const warn = (h.includes('saddle') && isFinite(rec.tmin) && rec.tmin < CRT_LO) ? '  ⚠ saddle below CRT' : '';
    console.log(
      (first ? r.scen.padEnd(30) : ''.padEnd(30)) +
      (first ? String(r.nDol).padStart(3) + '  ' : ''.padEnd(5)) +
      h.padEnd(17) + String(rec.n).padStart(5) + '   ' + trange.padStart(10) + '  ' + rec.um.toFixed(0).padStart(7) + warn
    );
    first = false;
  }
}
console.log('\nVERDICT:');
const offenders = rows.filter((r) => r.saddleBelowCRT > 0);
if (offenders.length) {
  console.log(`  ${offenders.length} scenario(s) grow saddle_rhomb below the roughening T (${CRT_LO} °C) — classifier IS mis-tagging:`);
  for (const r of offenders) console.log(`    ${r.scen}: ${r.saddleBelowCRT} saddle crystal(s) finished below CRT`);
  console.log('  → the science-faithful classifier correction (task #114) is warranted.');
} else {
  console.log('  No scenario grows saddle_rhomb below the roughening T — classifier is already science-consistent.');
  console.log('  → render-only build (skip the classifier correction / rebake).');
}
