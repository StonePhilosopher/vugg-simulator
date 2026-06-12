#!/usr/bin/env node
/**
 * tools/naica-thermal-observe.mjs — dark observation for naica's declared
 * thermal story (the FIRST consumer of the v181 T-unlock; movement-dark-
 * observe pattern: runtime injection only, no committed file touched).
 *
 * THE PREMISE (measured, v181 fleet probe): naica's "stable pool" is
 * currently ambient noise — drift crashes 56°C → 25°C in ~21 steps, then
 * ~19 random thermal pulses/run bounce T between the floor and the
 * 0.95·T0 = 53.2°C cap. The selenite 55-58°C sweet-spot (×1.4) fires for
 * ~2 steps. Real Naica (García-Ruiz 2007; Van Driessche 2011 PNAS) is the
 * opposite: a thermally BUFFERED pool holding 54-57°C for ~500 kyr,
 * cooling hundredths of a degree per year — the stability IS the
 * mechanism (low supersaturation → no new nuclei → old crystals just
 * keep adding layers).
 *
 * THE CANDIDATE (what v182 would declare):
 *   movements: [{ field:'temperature', startStep:0, endStep:260,
 *                 base:56, ops:[{kind:'trend', amp:-3, ease:true}] }]
 *   wall.thermal_pulses: false   (Naica's signature is NO thermal shocks)
 *   wall.cooling_rate: 0.1       (post-drainage era only — ambient owns T
 *                                 after step 260 when the mining events
 *                                 set 35/30; the buffer was the WATER)
 *   NO OU texture — the chaos warning aside, Naica is the no-noise locality.
 *
 * Window ends at 260 because naica_mining_drainage/recharge SET T (35/30)
 * — the movement must not clobber the mining story. The six slow_cooling
 * events keep their CHEMISTRY half (Ca≥280 / S≥380 anhydrite resupply);
 * only their -0.7°C drops are superseded (handler guard T>51 goes inert).
 *
 * Usage: node tools/naica-thermal-observe.mjs [seeds...]   (default 42 7 1009)
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, SIM_VERSION } =
  await loadSimBundle({ toolName: 'naica_thermal_observe' });

console.log(`SIM_VERSION ${SIM_VERSION}\n`);

const seeds = process.argv.slice(2).map(Number).filter(Boolean);
if (!seeds.length) seeds.push(42, 7, 1009);

const MOVEMENT = [{
  field: 'temperature', startStep: 0, endStep: 260,
  base: 56, ops: [{ kind: 'trend', amp: -3, ease: true }],
}];

function run(seed, withStory) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.naica_geothermal();
  if (withStory) {
    conditions._scenario = Object.assign({}, conditions._scenario, { movements: MOVEMENT });
    conditions.wall.thermal_pulses = false;
    conditions.wall.cooling_rate = 0.1;
  }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 320;
  let minT = Infinity, maxT = -Infinity, sumT = 0, sweet = 0, band = 0, pulses = 0;
  let tAt259 = null, tAt320 = null, peakFill = 0;
  for (let i = 0; i < steps; i++) {
    const log = sim.run_step();
    for (const l of log) if (l.includes('THERMAL PULSE')) pulses++;
    const T = sim.conditions.temperature;
    sumT += T; if (T < minT) minT = T; if (T > maxT) maxT = T;
    if (T >= 55 && T <= 58) sweet++;          // selenite engine sweet-spot (×1.4)
    if (T >= 54 && T <= 57) band++;           // García-Ruiz pool band
    if (sim.step === 259) tAt259 = T;
    const f = sim.get_vug_fill ? sim.get_vug_fill() : 0;
    if (f > peakFill) peakFill = f;
  }
  tAt320 = sim.conditions.temperature;
  const species = {};
  for (const c of sim.crystals) species[c.mineral] = (species[c.mineral] || 0) + 1;
  const sel = sim.crystals.filter(c => c.mineral === 'selenite');
  const selMax = sel.reduce((m, c) => Math.max(m, c.c_length_mm || 0), 0);
  return {
    minT, maxT, meanT: sumT / steps, sweetPct: 100 * sweet / steps, bandPct: 100 * band / steps,
    pulses, tAt259, tAt320, peakFill,
    species, selCount: sel.length, selMax, crystals: sim.crystals.length,
  };
}

for (const seed of seeds) {
  const A = run(seed, false);
  const B = run(seed, true);
  console.log(`=== seed ${seed} ===`);
  const row = (label, r) => console.log(
    `  ${label}  T[${r.minT.toFixed(1)}..${r.maxT.toFixed(1)}] mean ${r.meanT.toFixed(1)}  ` +
    `sweet55-58 ${r.sweetPct.toFixed(0)}%  band54-57 ${r.bandPct.toFixed(0)}%  pulses ${r.pulses}  ` +
    `T@259 ${r.tAt259?.toFixed(1)}  T@end ${r.tAt320?.toFixed(1)}  fill ${r.peakFill.toFixed(2)}`);
  row('BASE ', A);
  row('STORY', B);
  console.log(`  BASE  assemblage (${A.crystals}): ${Object.entries(A.species).map(([k, v]) => `${k}×${v}`).join(', ')}`);
  console.log(`  STORY assemblage (${B.crystals}): ${Object.entries(B.species).map(([k, v]) => `${k}×${v}`).join(', ')}`);
  console.log(`  selenite: ${A.selCount}× max ${A.selMax.toFixed(1)}mm  →  ${B.selCount}× max ${B.selMax.toFixed(1)}mm`);
  const lost = Object.keys(A.species).filter(k => !B.species[k]);
  const gained = Object.keys(B.species).filter(k => !A.species[k]);
  if (lost.length) console.log(`  LOST under story: ${lost.join(', ')}`);
  if (gained.length) console.log(`  gained under story: ${gained.join(', ')}`);
  console.log('');
}
console.log('expects_species: selenite (must survive at every seed; growth should IMPROVE)');
