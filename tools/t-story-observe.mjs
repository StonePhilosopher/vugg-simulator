#!/usr/bin/env node
/**
 * tools/t-story-observe.mjs — generalized dark observation for per-scenario
 * THERMAL STORIES (the v181 T-unlock rollout). Generalizes
 * naica-thermal-observe.mjs the way movement-assemblage-observe generalized
 * mvt-redox-observe: one instrument for the whole rollout.
 *
 * THE CLASSIFICATION (discovered on gem_pegmatite, 2026-06-10): scenarios
 * carry their T design in one of two shapes —
 *
 *   NAICA-SHAPE     events do NOT own T (or only bracket it) → the story is
 *                   a DECLARED temperature movement + stand-down.
 *   PEGMATITE-SHAPE events fully anchor T (absolute setpoints down a curve)
 *                   → a movement would CLOBBER eight working setpoints; the
 *                   story is already there and the fix is silencing the
 *                   ambient NOISE around it (thermal_pulses:false where
 *                   fracture-valve re-warms have no geological home, e.g. a
 *                   sealed miarolitic pocket; cooling_rate where the
 *                   inter-event drift is mis-sloped).
 *
 * Variants: A = BASE (as shipped) vs B = the candidate story, assembled
 * from flags and/or a movement spec. Reports T statistics, pulse counts,
 * assemblage diff, and expects_species survival per seed.
 *
 * Usage:
 *   node tools/t-story-observe.mjs <scenario> [options]
 *     --pulses-off              candidate sets wall.thermal_pulses=false
 *     --cooling-rate <x>        candidate sets wall.cooling_rate=x
 *     --move base,amp,start,end candidate adds a temperature movement
 *                               (smoothstep trend; no texture)
 *     --seeds a,b,c             (default 42,7,1009)
 *     --band lo,hi              report %steps with T in [lo,hi]
 *
 * Examples:
 *   node tools/t-story-observe.mjs gem_pegmatite --pulses-off
 *   node tools/t-story-observe.mjs cooling --move 170,-40,0,100 --pulses-off
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, SIM_VERSION } =
  await loadSimBundle({ toolName: 't_story_observe' });

const argv = process.argv.slice(2);
const scen = argv[0];
if (!scen || !SCENARIOS[scen]) {
  console.error(`usage: node tools/t-story-observe.mjs <scenario> [--pulses-off] [--cooling-rate x] [--move base,amp,start,end] [--seeds a,b,c] [--band lo,hi]`);
  console.error(`scenarios: ${Object.keys(SCENARIOS).sort().join(', ')}`);
  process.exit(1);
}
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const has = (name) => argv.includes(name);

const pulsesOff = has('--pulses-off');
const coolingRate = opt('--cooling-rate') !== null ? Number(opt('--cooling-rate')) : null;
const moveArg = opt('--move');
const seeds = (opt('--seeds') || '42,7,1009').split(',').map(Number);
const [bandLo, bandHi] = (opt('--band') || '').split(',').map(Number);

let movement = null;
if (moveArg) {
  const [base, amp, start, end] = moveArg.split(',').map(Number);
  movement = [{ field: 'temperature', startStep: start, endStep: end, base, ops: [{ kind: 'trend', amp, ease: true }] }];
}
if (!pulsesOff && coolingRate === null && !movement) {
  console.error('no candidate options given — nothing to compare. Pass --pulses-off / --cooling-rate / --move.');
  process.exit(1);
}

console.log(`SIM_VERSION ${SIM_VERSION} — ${scen}`);
console.log(`candidate: ${[pulsesOff && 'thermal_pulses:false', coolingRate !== null && `cooling_rate:${coolingRate}`, movement && `move(${moveArg})`].filter(Boolean).join(' + ')}\n`);

// expects_species lives on the factory's raw spec (SCENARIOS[scen]._json5_spec,
// attached in js/70-events.ts) — NOT on conditions._scenario. Same read as
// movement-assemblage-observe.mjs:63.
const expects = (SCENARIOS[scen]._json5_spec && SCENARIOS[scen]._json5_spec.expects_species) || [];

function run(seed, candidate) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[scen]();
  if (candidate) {
    if (movement) conditions._scenario = Object.assign({}, conditions._scenario, { movements: movement });
    if (pulsesOff) conditions.wall.thermal_pulses = false;
    if (coolingRate !== null) conditions.wall.cooling_rate = coolingRate;
  }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let minT = Infinity, maxT = -Infinity, sumT = 0, inBand = 0, pulses = 0, peakFill = 0;
  for (let i = 0; i < steps; i++) {
    const log = sim.run_step();
    for (const l of log) if (l.includes('THERMAL PULSE')) pulses++;
    const T = sim.conditions.temperature;
    sumT += T; if (T < minT) minT = T; if (T > maxT) maxT = T;
    if (Number.isFinite(bandLo) && T >= bandLo && T <= bandHi) inBand++;
    const f = sim.get_vug_fill ? sim.get_vug_fill() : 0;
    if (f > peakFill) peakFill = f;
  }
  const species = {};
  for (const c of sim.crystals) species[c.mineral] = (species[c.mineral] || 0) + 1;
  return { minT, maxT, meanT: sumT / steps, endT: sim.conditions.temperature, inBandPct: 100 * inBand / steps, pulses, peakFill, species, crystals: sim.crystals.length, steps };
}

for (const seed of seeds) {
  const A = run(seed, false);
  const B = run(seed, true);
  console.log(`=== seed ${seed} ===`);
  const row = (label, r) => console.log(
    `  ${label}  T[${r.minT.toFixed(0)}..${r.maxT.toFixed(0)}] mean ${r.meanT.toFixed(0)} end ${r.endT.toFixed(0)}` +
    (Number.isFinite(bandLo) ? `  band ${r.inBandPct.toFixed(0)}%` : '') +
    `  pulses ${r.pulses}  fill ${r.peakFill.toFixed(2)}  crystals ${r.crystals}`);
  row('BASE ', A);
  row('STORY', B);
  const lost = Object.keys(A.species).filter(k => !B.species[k]);
  const gained = Object.keys(B.species).filter(k => !A.species[k]);
  if (lost.length) console.log(`  lost under story:   ${lost.join(', ')}`);
  if (gained.length) console.log(`  gained under story: ${gained.join(', ')}`);
  const missing = expects.filter(e => !Object.keys(B.species).some(k => k === e));
  console.log(missing.length
    ? `  ⚠ EXPECTS MISSING under story: ${missing.join(', ')}`
    : `  expects_species all present under story (${expects.join(', ')})`);
  console.log('');
}
