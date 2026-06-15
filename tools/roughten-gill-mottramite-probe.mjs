#!/usr/bin/env node
/**
 * tools/roughten-gill-mottramite-probe.mjs — why doesn't mottramite fire
 * at roughten_gill? (task #55, 2026-06-12; the gate-census pattern from
 * the linarite arc + wittichen-sulfate-probe.)
 *
 * THE HISTORY THIS PROBE MUST SETTLE (scenarios.json5 V-axis note):
 *   v109: V 6→0 rippled 3 minerals (reverted).
 *   v180: V 6→12 cleared the V≥10 gate but mottramite STILL didn't fire
 *         AND sphalerite rippled 7x→2x in the primary stage (reverted).
 *         Suspected blocker: "Zn≥0.5 or the redox/T product".
 * Both failures were PRIMARY-BROTH V bumps — any σ change before the
 * step-25 lockup re-rolls the shared RNG stream under the primary suite.
 * The 70q header's own geology ("wallrock V ~10-20 ppm leaches in
 * supergene window") suggests the V belongs in an EVENT, not the broth.
 *
 * Logs, per step: T, pH, O2, Pb, Cu, Zn, V, cu_fraction, the six
 * mottramite gate verdicts (Pb≥40 Cu≥50 V≥10 redox@0.5 Zn≥0.5
 * cuFrac≥0.5), σ for the V-competitor set (mottramite, descloizite,
 * vanadinite), and — whenever all hard gates pass — the σ factor
 * breakdown (pb_f·cu_f·v_f·ox_f·band·T_f, mirroring
 * 38-supersat-phosphate; probe-side recompute, observer-only).
 *
 * Usage: node tools/roughten-gill-mottramite-probe.mjs
 *        [--seed 42] [--every 5]
 *        [--set V=12]        broth hypothesis (initial fluid, pre-step-0;
 *                            the v180 move — expect primary-stage ripple)
 *        [--pulse 70:V=14]   event hypothesis (assign fluid.V=14 right
 *                            after step 70 runs — the supergene-leach
 *                            shape; primary stage untouched)
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'roughten-gill-mottramite-probe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const EVERY = args.includes('--every') ? Number(args[args.indexOf('--every') + 1]) : 5;
const sets = [];
const pulses = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set' && args[i + 1]) {
    const [k, v] = args[i + 1].split('=');
    sets.push([k, Number(v)]);
  }
  if (args[i] === '--pulse' && args[i + 1]) {
    const [step, kv] = args[i + 1].split(':');
    const [k, v] = kv.split('=');
    pulses.push([Number(step), k, Number(v)]);
  }
}

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS.roughten_gill();
for (const [k, v] of sets) {
  conditions.fluid[k] = v;
  console.log(`[probe] initial fluid.${k} := ${v}`);
}
const sim = new VugSimulator(conditions, events);
const n = defaultSteps ?? 200;

// probe-side mirror of supersaturation_mottramite's factor chain
// (38-supersat-phosphate) — so the census can say WHICH factor starves
// σ when every hard gate passes. Observer-only; the engine's own σ is
// printed alongside as the ground truth.
function mottFactors(c) {
  const f = c.fluid;
  const pb_f = Math.min(f.Pb / 80.0, 2.5);
  const cu_f = Math.min(f.Cu / 80.0, 2.5);
  const v_f = Math.min(f.V / 20.0, 2.5);
  const cuFrac = f.Cu / Math.max(f.Cu + f.Zn, 0.001);
  let band = 1.0;
  if (cuFrac >= 0.55 && cuFrac <= 0.85) band = 1.3;
  else if (cuFrac > 0.95) band = 0.5;
  const T = c.temperature;
  let T_f;
  if (T >= 30 && T <= 50) T_f = 1.2;
  else if (T < 20) T_f = 0.4;
  else if (T < 30) T_f = 0.4 + 0.08 * (T - 20);
  else if (T <= 80) T_f = Math.max(0.4, 1.2 - 0.020 * (T - 50));
  else T_f = 0.3;
  const pH_f = (f.pH < 4 || f.pH > 8) ? 0.6 : 1.0;
  return { pb_f, cu_f, v_f, cuFrac, band, T_f, pH_f };
}

console.log(`\n### ROUGHTEN GILL MOTTRAMITE GATE CENSUS — seed ${SEED}, ${n} steps`);
if (pulses.length) console.log(`    pulses: ${pulses.map(([s, k, v]) => `step ${s}: fluid.${k} := ${v}`).join('; ')}`);
console.log('  step    T     pH    O2     Pb   Cu   Zn    V   cuFr | gate: Pb≥40 Cu≥50 V≥10 redox Zn≥.5 fr≥.5 | σ_mott σ_desc σ_van');
let mottEverPos = 0, mottMax = 0, mottMaxStep = -1;
for (let s = 0; s < n; s++) {
  sim.run_step();
  for (const [ps, k, v] of pulses) {
    if (s === ps) {
      sim.conditions.fluid[k] = v;
      console.log(`  [pulse] step ${s}: fluid.${k} := ${v}`);
    }
  }
  const c = sim.conditions, f = c.fluid;
  const sigM = c.supersaturation_mottramite();
  const sigD = c.supersaturation_descloizite();
  const sigV = c.supersaturation_vanadinite();
  if (sigM > 0) mottEverPos++;
  if (sigM > mottMax) { mottMax = sigM; mottMaxStep = s; }
  const cuFrac = f.Cu / Math.max(f.Cu + f.Zn, 0.001);
  const gates = [f.Pb >= 40, f.Cu >= 50, f.V >= 10, (f.O2 ?? 0) >= 0.5 || (typeof f.Eh === 'number' && f.Eh > 0), f.Zn >= 0.5, cuFrac >= 0.5];
  const allPass = gates.every(Boolean);
  if (s % EVERY === 0 || sigM >= 1 || (allPass && s % 2 === 0)) {
    const g = gates.map((x) => (x ? '✓' : '✗'));
    console.log(`  ${String(s).padStart(4)}  ${c.temperature.toFixed(0).padStart(4)}  ${f.pH.toFixed(1).padStart(5)}  ${(f.O2 ?? 0).toFixed(2).padStart(5)}  ${f.Pb.toFixed(0).padStart(4)} ${f.Cu.toFixed(0).padStart(4)} ${f.Zn.toFixed(0).padStart(4)} ${f.V.toFixed(0).padStart(4)}   ${cuFrac.toFixed(2)} |        ${g[0]}     ${g[1]}    ${g[2]}    ${g[3]}     ${g[4]}     ${g[5]}   |  ${sigM.toFixed(2).padStart(5)}  ${sigD.toFixed(2).padStart(5)}  ${sigV.toFixed(2).padStart(5)}`);
    if (allPass && sigM < 1) {
      const m = mottFactors(c);
      console.log(`        └ gates ALL pass, σ starved: pb_f ${m.pb_f.toFixed(2)} · cu_f ${m.cu_f.toFixed(2)} · v_f ${m.v_f.toFixed(2)} · ox_f · band ${m.band.toFixed(1)} · T_f ${m.T_f.toFixed(2)} · pH_f ${m.pH_f.toFixed(1)}`);
    }
  }
}
const alive = (m) => sim.crystals.filter((x) => x.mineral === m && !x.dissolved && x.total_growth_um > 0).length;
console.log(`\n  mottramite: σ>0 on ${mottEverPos}/${n} steps; max σ ${mottMax.toFixed(3)} at step ${mottMaxStep}; crystals: ${alive('mottramite')}`);
console.log(`  V-competitors: descloizite ${alive('descloizite')}, vanadinite ${alive('vanadinite')}, clinobisvanite ${alive('clinobisvanite')}`);
console.log(`  primary-suite ripple watch: sphalerite ${alive('sphalerite')}, galena ${alive('galena')}, chalcopyrite ${alive('chalcopyrite')}, pyrite ${alive('pyrite')}, tetrahedrite ${alive('tetrahedrite')}, tennantite ${alive('tennantite')}`);
console.log(`  supergene-suite watch: linarite ${alive('linarite')}, caledonite ${alive('caledonite')}, leadhillite ${alive('leadhillite')}, brochantite ${alive('brochantite')}, pyromorphite ${alive('pyromorphite')}, mimetite ${alive('mimetite')}, cerussite ${alive('cerussite')}, native_silver ${alive('native_silver')}`);
const census = {};
for (const x of sim.crystals) {
  if (x.dissolved || !(x.total_growth_um > 0)) continue;
  census[x.mineral] = (census[x.mineral] || 0) + 1;
}
console.log(`  census: ${Object.entries(census).sort().map(([m, k]) => `${m}×${k}`).join('  ')}`);
