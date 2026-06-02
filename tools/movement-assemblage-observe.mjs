#!/usr/bin/env node
/**
 * tools/movement-assemblage-observe.mjs — Geological Movements DARK OBSERVATION,
 * generalized (commits nothing). The Phase-3 rollout instrument.
 *
 * Generalizes tools/mvt-redox-observe.mjs (which hard-coded mvt + Eh + a fixed
 * EXPECTS list) to ANY scenario + ANY master-variable field. Before opting a
 * scenario in for real (which bumps a baseline), OBSERVE: inject a candidate
 * movement at RUNTIME ONLY (no committed file touched, no baseline regen, no
 * SIM_VERSION bump) and report whether the chosen shape KEEPS the scenario's
 * expects_species assemblage — and which elements it unfreezes.
 *
 * The discipline (HANDOFF-MOVEMENTS-AND-BACKLOG, lesson #1): build the
 * geological oracle FROM observation, never from a plausible story. A movement
 * that reads true in prose can still WIPE a headline mineral (the mvt-barite
 * tension — a flat-reducing fluid suppresses sulfate). This tool catches that
 * before it ships.
 *
 * Three variants, same seed (42) + same cavity (→ same movement stream):
 *   BASE    no movement (what ships today)
 *   FLAT    field HELD at (base+amp) the whole run + OU texture
 *           (the "always in that regime" literal reading — assemblage risk)
 *   TREND   field base → (base+amp) smoothstep + OU
 *           (the paragenetic reading: a slow regime shift across the run)
 *
 * expects_species is read from the scenario's raw spec (SCENARIOS[scen]
 * ._json5_spec.expects_species — attached in js/70-events.ts). When a movement
 * drives fluid.Eh the sim flips to Eh-CANONICAL (4c.3a) so O2 follows Eh.
 *
 * Usage (positional — startStep before the rarely-used clampMax):
 *   node tools/movement-assemblage-observe.mjs [scenario] [field] [base] [amp] [sigma] [clampMin] [startStep] [clampMax]
 *   defaults:  mvt  Eh  50  -300  15            (reproduces the mvt pilot)
 *   examples:
 *     node tools/movement-assemblage-observe.mjs supergene_oxidation pH 6.8 -2.5 0.12 3.5 20
 *       (pH 6.8→4.3, clampMin 3.5, startStep 20 — the v170 supergene acid front)
 *     node tools/movement-assemblage-observe.mjs colorado_plateau    Eh 200 -350 15
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'movement-assemblage-observe' });

const [, , argScen, argField, argBase, argAmp, argSigma, argClampMin, argStart, argClampMax] = process.argv;
const SCEN = argScen || 'mvt';
const FIELD = argField || 'Eh';
const BASE = argBase !== undefined ? Number(argBase) : 50;
const AMP = argAmp !== undefined ? Number(argAmp) : -300;
const SIGMA = argSigma !== undefined ? Number(argSigma)
  : FIELD === 'pH' ? 0.12 : FIELD === 'temperature' ? 4 : Math.max(1, Math.abs(AMP) * 0.05);
const CLAMP_MIN = argClampMin !== undefined ? Number(argClampMin) : undefined;
const CLAMP_MAX = argClampMax !== undefined ? Number(argClampMax) : undefined;

if (!SCENARIOS[SCEN]) {
  console.error(`no scenario '${SCEN}'. available:`, Object.keys(SCENARIOS).sort().join(', '));
  process.exit(1);
}

// Field path is relative to `conditions`: temperature is top-level, everything
// else lives under conditions.fluid.* — so a movement on pH must say 'fluid.pH'.
const FIELD_PATH = FIELD.includes('.') ? FIELD
  : FIELD === 'temperature' ? 'temperature' : `fluid.${FIELD}`;

const spec = SCENARIOS[SCEN]._json5_spec || {};
const EXPECTS = Array.isArray(spec.expects_species) ? spec.expects_species : [];
const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;

const START = argStart !== undefined ? Number(argStart) : 0;
const tex = { theta: 0.3, sigma: SIGMA };
const withBounds = (m) => {
  if (typeof CLAMP_MIN === 'number') m.clampMin = CLAMP_MIN;
  if (typeof CLAMP_MAX === 'number') m.clampMax = CLAMP_MAX;
  return m;
};
const SHAPES = {
  BASE: [],   // empty array overrides any baked movement → TRUE no-movement baseline
  FLAT: [withBounds({ field: FIELD_PATH, startStep: START, endStep: STEPS, base: BASE + AMP,
                      ops: [{ kind: 'trend', amp: 0 }], texture: tex })],
  TREND: [withBounds({ field: FIELD_PATH, startStep: START, endStep: STEPS, base: BASE,
                       ops: [{ kind: 'trend', amp: AMP, ease: true }], texture: tex })],
};

// Standard broad watch-set for the "did the SI engines make correlated element
// pulses?" check. Elements not present in a scenario are silently skipped.
const WATCH = ['pH', 'Eh', 'O2', 'temperature', 'Fe', 'Mn', 'Cu', 'Zn', 'Pb',
  'S', 'SiO2', 'As', 'Ca', 'CO3', 'F', 'Ba', 'Sr', 'U', 'V', 'K', 'Mo'];

function readField(sim, path) {
  const parts = path.split('.');
  let o = sim.conditions;
  for (let i = 0; i < parts.length - 1; i++) { if (o == null) return NaN; o = o[parts[i]]; }
  const v = o == null ? NaN : o[parts[parts.length - 1]];
  return typeof v === 'number' ? v : NaN;
}
const readWatch = (sim, k) => k === 'temperature' ? sim.conditions.temperature : sim.conditions.fluid[k];

function run(movements) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  if (movements) {
    if (!sim.conditions._scenario) sim.conditions._scenario = {};
    sim.conditions._scenario.movements = movements;
  }
  const traj = [];
  const series = {};
  const rec = () => {
    for (const k of WATCH) {
      const v = readWatch(sim, k);
      if (typeof v === 'number' && isFinite(v)) (series[k] ??= []).push(v);
    }
  };
  rec();
  for (let s = 0; s < STEPS; s++) { sim.run_step(); traj.push(readField(sim, FIELD_PATH)); rec(); }
  const counts = {};
  for (const c of sim.crystals) {
    counts[c.mineral] = counts[c.mineral] || { n: 0, max: 0 };
    counts[c.mineral].n++;
    if (c.total_growth_um > counts[c.mineral].max) counts[c.mineral].max = Math.round(c.total_growth_um);
  }
  const fmin = Math.min(...traj), fmax = Math.max(...traj);
  const fmean = traj.reduce((s, x) => s + x, 0) / traj.length;
  return { counts, fmin, fmax, fmean, series };
}

const stats = (arr) => {
  const n = arr.length, mean = arr.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(arr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n);
  return { mean, cv: Math.abs(mean) > 1e-9 ? std / Math.abs(mean) : 0 };
};

const R = {};
for (const k of Object.keys(SHAPES)) R[k] = run(SHAPES[k]);

console.log(`\n### MOVEMENT ASSEMBLAGE OBSERVATION — ${SCEN}, driving ${FIELD_PATH}`);
console.log(`    base ${BASE} → ${BASE + AMP} (trend amp ${AMP}), OU σ=${SIGMA}` +
  `${CLAMP_MIN !== undefined ? `, clampMin ${CLAMP_MIN}` : ''}${CLAMP_MAX !== undefined ? `, clampMax ${CLAMP_MAX}` : ''}` +
  `, ${STEPS} steps, seed 42`);
console.log(`    expects_species (${EXPECTS.length}): ${EXPECTS.join(', ') || '(none declared)'}`);

console.log(`\n  variant   ${FIELD} min / mean / max`);
for (const k of Object.keys(R)) {
  console.log(`  ${k.padEnd(7)} ${R[k].fmin.toFixed(1).padStart(8)} / ${R[k].fmean.toFixed(1).padStart(7)} / ${R[k].fmax.toFixed(1).padStart(7)}`);
}

if (EXPECTS.length) {
  console.log('\n  === expects_species survival (n crystals × max µm) ===');
  console.log('  mineral           BASE            FLAT            TREND');
  console.log('  --------------------------------------------------------------------');
  const fmt = (c) => c ? `${c.n}×${c.max}µm`.padEnd(14) : '— GONE —'.padEnd(14);
  for (const m of EXPECTS) {
    console.log(`  ${m.padEnd(16)} ${fmt(R.BASE.counts[m])}  ${fmt(R.FLAT.counts[m])}  ${fmt(R.TREND.counts[m])}`);
  }
}

console.log('\n  === expects_species lost per variant ===');
for (const k of Object.keys(R)) {
  const lost = EXPECTS.filter((m) => !R[k].counts[m]);
  const sp = Object.keys(R[k].counts).length;
  console.log(`  ${k.padEnd(7)} ${sp} species total — expects_species lost: ${lost.length ? lost.join(', ') : 'NONE ✓'}`);
}

console.log('\n  === full assemblage per variant (Δ vs BASE) ===');
const baseSet = new Set(Object.keys(R.BASE.counts));
for (const k of Object.keys(R)) {
  const here = new Set(Object.keys(R[k].counts));
  const gained = [...here].filter((m) => !baseSet.has(m)).sort();
  const lost = [...baseSet].filter((m) => !here.has(m)).sort();
  console.log(`  ${k}: ${here.size} species` +
    (k === 'BASE' ? '' : `  | +${gained.join(',') || '—'}  | -${lost.join(',') || '—'}`));
}

// Q3 — did driving one master variable make the SI engines move the ELEMENTS?
console.log('\n  === correlated element pulses (CV: BASE → TREND) ===');
console.log('  field         BASE:mean   BASE:CV   TREND:CV   ΔCV     note');
console.log('  ----------------------------------------------------------------------');
const FLAT = 0.05;
for (const f of WATCH) {
  if (!R.BASE.series[f] || !R.TREND.series[f]) continue;
  const sa = stats(R.BASE.series[f]), sb = stats(R.TREND.series[f]), dcv = sb.cv - sa.cv;
  let note;
  if (FIELD_PATH.endsWith(f)) note = 'driven (the input)';
  else if (sa.cv < FLAT && sb.cv >= FLAT) note = '✦ UNFROZEN by the movement';
  else if (dcv > 0.01) note = 'moves MORE';
  else if (dcv < -0.01) note = 'moves less';
  else if (sb.cv < FLAT) note = 'still flat';
  else note = '~unchanged (already dynamic)';
  console.log(`  ${f.padEnd(12)} ${sa.mean.toExponential(2).padStart(10)}  ${sa.cv.toFixed(3).padStart(7)}  ${sb.cv.toFixed(3).padStart(8)}  ${(dcv >= 0 ? '+' : '') + dcv.toFixed(3)}   ${note}`);
}
console.log('');
