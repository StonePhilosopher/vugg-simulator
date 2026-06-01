#!/usr/bin/env node
/**
 * tools/movement-dark-observe.mjs — Geological Movements "DARK OBSERVATION"
 * (commits nothing). The first faithful step of the arc — see
 * proposals/HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md.
 *
 * Before opting any scenario in for real (that bumps a baseline), OBSERVE:
 * inject ONE movement onto a scenario AT RUNTIME ONLY and watch the trajectory.
 * No committed scenario file is touched, no baseline regen, no SIM_VERSION bump.
 *
 * WHAT THE FIRST RUN TAUGHT US (cooling / temperature, 2026-06-01):
 *   • ambient_cooling() runs EVERY step (a trend + stochastic thermal-pulse
 *     re-warming on the SHARED rng) — temperature is already an ad-hoc movement.
 *   • fluid.Eh is frozen at 200 AND INERT: EH_DYNAMIC_ENABLED is off, so engines
 *     gate on fluid.O2, not Eh. Driving Eh is a downstream no-op until Phase 4c.
 *   • fluid.O2 is the ACTIVE redox lever — but in supergene scenarios the vadose
 *     override already drives it (confounded).
 *   • the system shows SENSITIVE DEPENDENCE: an OU nudge on a field with a
 *     state-dependent mechanic (temperature) diverges chaotically (B−C → 60°C).
 *   → so the clean substrate is a field that is FLAT in baseline (no per-step
 *     mechanic touches it) yet ACTIVE downstream. In supergene scenarios that is
 *     pH: nearly flat (CV~0.05) but every SI/solubility engine reads it, and a
 *     descending oxidizing meteoric front acidifying the fluid is FAITHFUL.
 *
 * Three variants, same seed (42) + same cavity (→ same movement stream):
 *   A  baseline    — no movement (what ships today)
 *   C  trend-only  — a smoothstep TREND on the driven field, texture OFF
 *   B  trend + OU  — same TREND + Ornstein-Uhlenbeck mean-reverting texture
 *
 * Questions:
 *   Q1 ramp-vs-drift : does the driven field describe a CURVE? (A vs C)
 *   Q2 OU visibility : is the OU texture VISIBLE at sim resolution, or below the
 *                      noise floor → rip it? On a clean field B−C == OU exactly.
 *   Q3 the thesis    : does driving ONE master variable make the SI engines move
 *                      the ELEMENTS (correlated pulses, not randomized chemistry)?
 *
 * Usage: node tools/movement-dark-observe.mjs [scenario] [field] [amp] [clampMin]
 *   defaults: supergene_oxidation  pH  -2.0  3.5
 *   e.g.      node tools/movement-dark-observe.mjs cooling temperature -90 25
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'movement-dark-observe' });

const [, , argScen, argField, argAmp, argClamp] = process.argv;
const SCEN = argScen || 'supergene_oxidation';
const FIELD = argField || 'pH';                       // dotted path on conditions
const AMP = argAmp !== undefined ? Number(argAmp) : -2.0;   // TREND amplitude (field units)
const CLAMP_MIN = argClamp !== undefined ? Number(argClamp) : 3.5;
// OU texture scale, per-field (rough "1 band of wobble"): pH→0.12, T→4, else 5%.
const OU_SIGMA = FIELD === 'pH' ? 0.12 : FIELD === 'temperature' ? 4 : Math.abs(AMP) * 0.05;
const OU = { theta: 0.3, sigma: OU_SIGMA };

if (!SCENARIOS[SCEN]) { console.error(`no scenario '${SCEN}'. available:`, Object.keys(SCENARIOS).sort().join(', ')); process.exit(1); }

// Fields to watch: the driven field, the inert control (Eh), the
// already-dynamic baseline movers (temperature/O2 — confounds to note), and the
// redox/solubility-sensitive metals that SHOULD pulse if the thesis holds.
const WATCH = [FIELD, 'temperature', 'Eh', 'O2', 'pH', 'Fe', 'Cu', 'Mn', 'Zn', 'Pb', 'S', 'SiO2', 'As', 'Co', 'Ni', 'Ca', 'CO3']
  .filter((v, i, a) => a.indexOf(v) === i);

function read(sim, k) { return k === 'temperature' ? sim.conditions.temperature : sim.conditions.fluid[k]; }

// Field path is relative to `conditions`: temperature is top-level, everything
// else (pH, O2, metals…) lives under conditions.fluid.* — so the movement spec
// must say 'fluid.pH', not 'pH'. (A bare 'pH' resolves to conditions.pH ==
// undefined → base NaN → the controller silently skips the movement.)
const FIELD_PATH = FIELD === 'temperature' ? 'temperature' : `fluid.${FIELD}`;

function movementSpec(withTexture, steps) {
  const m = {
    field: FIELD_PATH,
    startStep: 0,
    endStep: steps,
    ops: [{ kind: 'trend', amp: AMP, ease: true }],   // smoothstep drift
    clampMin: CLAMP_MIN,
  };
  if (withTexture) m.texture = { theta: OU.theta, sigma: OU.sigma };
  return [m];
}

function run(withMovement, steps) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  if (withMovement) {
    if (!sim.conditions._scenario) sim.conditions._scenario = {};
    sim.conditions._scenario.movements = movementSpec(withMovement === 'texture', steps);
  }
  const series = {};
  const rec = () => {
    for (const k of WATCH) {
      const v = read(sim, k);
      if (typeof v === 'number' && isFinite(v)) (series[k] ??= []).push(v);
    }
  };
  rec();
  for (let s = 0; s < steps; s++) { sim.run_step(); rec(); }
  return series;
}

const stats = (arr) => {
  const n = arr.length, mean = arr.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(arr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n);
  let min = Infinity, max = -Infinity;
  for (const x of arr) { if (x < min) min = x; if (x > max) max = x; }
  return { mean, std, min, max, cv: Math.abs(mean) > 1e-9 ? std / Math.abs(mean) : 0 };
};

const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 100;
console.log(`\n### DARK OBSERVATION — ${SCEN}, driving ${FIELD} (trend amp ${AMP}, OU σ=${OU.sigma}), ${STEPS} steps, seed 42`);

const A = run(false, STEPS);
const C = run('plain', STEPS);
const B = run('texture', STEPS);

// ── Q1/Q2 — driven-field trajectory + isolated OU contribution ──────────────
console.log(`\n=== Q1/Q2  ${FIELD} trajectory ===`);
console.log('  step   A:baseline   C:trend-only   B:trend+OU    (B−C)=OU dev');
console.log('  ------------------------------------------------------------------');
const sample = Math.max(1, Math.round(STEPS / 10));
for (let s = 0; s <= STEPS; s += sample) {
  const a = A[FIELD][s], c = C[FIELD][s], b = B[FIELD][s];
  console.log(`  ${String(s).padStart(4)}  ${a.toFixed(3).padStart(9)}   ${c.toFixed(3).padStart(9)}    ${b.toFixed(3).padStart(9)}    ${(b - c).toFixed(4).padStart(9)}`);
}

const ouDev = B[FIELD].map((b, i) => b - C[FIELD][i]);
const ouAbs = ouDev.map(Math.abs);
const ouMax = Math.max(...ouAbs);
const ouMean = ouAbs.reduce((s, x) => s + x, 0) / ouAbs.length;
const trendSpan = Math.abs(C[FIELD][0] - C[FIELD][C[FIELD].length - 1]);
const trendStep = C[FIELD].map((c, i) => i === 0 ? 0 : Math.abs(c - C[FIELD][i - 1]));
const ouStep = ouDev.map((d, i) => i === 0 ? 0 : Math.abs(d - ouDev[i - 1]));
const k = Math.max(5, Math.round(STEPS * 0.15));   // "flat ends" window
const flatTrend = [...trendStep.slice(1, k + 1), ...trendStep.slice(-k)];
const flatOu = [...ouStep.slice(1, k + 1), ...ouStep.slice(-k)];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

console.log(`\n  OU texture (θ=${OU.theta}, σ=${OU.sigma}):`);
console.log(`    max |dev| from setpoint : ${ouMax.toFixed(3)}   (${(100 * ouMax / (trendSpan + 1e-9)).toFixed(1)}% of the ${trendSpan.toFixed(3)} trend span)`);
console.log(`    mean |dev|              : ${ouMean.toFixed(3)}`);
console.log(`    CLEAN-OVERLAY CHECK     : ${ouMean > 1e-6 ? 'PASS — B−C carries the OU wobble (the movement survives to step end; nothing clobbers it)' : 'FAIL — B−C≈0, something overwrites the field after the movement hook (e.g. open-atmosphere pH re-solve)'}`);
console.log(`    step-to-step Δ — trend: ${mean(trendStep.slice(1)).toFixed(4)}/step   OU: ${mean(ouStep.slice(1)).toFixed(4)}/step`);
console.log(`    at the smoothstep-FLAT ends — trend Δ: ${mean(flatTrend).toFixed(4)}/step   OU Δ: ${mean(flatOu).toFixed(4)}/step  → OU ${mean(flatOu) > mean(flatTrend) ? 'VISIBLE' : 'swamped'} (${(mean(flatOu) / (mean(flatTrend) + 1e-9)).toFixed(1)}×)`);

// ── Q3 — does driving the field move the ELEMENTS? CV: baseline vs trend+OU ──
console.log(`\n=== Q3  do the SI engines make correlated element pulses?  (CV: A baseline → B trend+OU) ===`);
console.log('  field         A:mean      A:CV      B:CV     ΔCV       note');
console.log('  ----------------------------------------------------------------------');
const FLAT = 0.05;
for (const f of WATCH) {
  if (!A[f] || !B[f]) continue;
  const sa = stats(A[f]), sb = stats(B[f]), dcv = sb.cv - sa.cv;
  let note;
  if (f === FIELD) note = 'driven (the input)';
  else if (f === 'Eh') note = 'inert control (EH_DYNAMIC off)';
  else if (sa.cv < FLAT && sb.cv >= FLAT) note = '✦ UNFROZEN by the movement';
  else if (dcv > 0.01) note = 'moves MORE';
  else if (dcv < -0.01) note = 'moves less';
  else if (sb.cv < FLAT) note = 'still flat';
  else note = '~unchanged (already dynamic)';
  console.log(`  ${f.padEnd(12)} ${sa.mean.toExponential(2).padStart(10)}  ${sa.cv.toFixed(3).padStart(7)}  ${sb.cv.toFixed(3).padStart(7)}  ${(dcv >= 0 ? '+' : '') + dcv.toFixed(3)}   ${note}`);
}
