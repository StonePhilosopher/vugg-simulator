#!/usr/bin/env node
// tools/sulfur-speciation-census.mjs — S0 instrument for the fluid.S sulfate/sulfide
// split (proposals/PROPOSAL-FLUID-S-SPLIT-2026-07-17.md §7).
//
// The split's arc is byte-identical at S0: the derived partition lands in js/20c
// DEFINED-BUT-UNUSED. This tool exists so that partition ships with a MEASURED
// disequilibrium floor F_min instead of the proposal's 0.15 placeholder (open
// question §9.1), and so the barite-fleet sulfate fraction at the tightened
// 100/200 °C taper is a measurement, not §5-B's 150/250 °C estimate.
//
// ── METHOD ──────────────────────────────────────────────────────────────────
// Run seed 42 across the fleet; snapshot (fluid, T, Eh) at every step. For each
// nucleation event, recompute the species' REAL engine supersaturation with
// fluid.S replaced by the split-available ppm — sulfideAvailablePpm for reduced-S
// consumers, sulfateAvailablePpm for oxidized-S consumers — everything else in the
// fluid (Eh/O2/pH/metal loads/T) left exactly as recorded. If the post-split sigma
// still clears the species' nucleation bar (sigma_crit), it stays fed; if it drops
// below, it would starve. Sweep F_min downward; the MEASURED floor is the smallest
// value at which no non-carve-out consumer starves at any of its recorded events.
//
// The candidate partition is implemented LOCALLY here (parameterized by F_min so the
// sweep can vary it); js/20c will ship the frozen copy at the measured F_min. The
// T-taper anchors are the literature-tightened 100/200 °C single curve (Ohmoto &
// Lasaga 1982 half-life vs T), NOT the proposal's 150/250 °C — see the S0 research
// note.
//
// CAVEAT (honest, for an instrument): the recompute swaps fluid.S and temperature
// from the snapshot but reuses the run's final conditions object for any non-fluid
// scalar an engine might read (pressure/salinity). Sulfate/sulfide supersat methods
// are fluid+T functions in practice, so this is exact for them; a species that reads
// pressure would carry a small provenance error, flagged if it ever appears.
//
// Usage: node tools/sulfur-speciation-census.mjs [--verbose]

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERBOSE = process.argv.includes('--verbose');

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed, MINERAL_GATES_REGISTRY } = await h.loadSimBundle({
  toolName: 'sulfur-census',
  extraExports: ['MINERAL_GATES_REGISTRY'],
});

// ── the candidate partition (mirrors what js/20c will ship, F_min parameterized) ──
const EH_BOUNDARY = 76;   // mV = ehFromO2(0.4): the SO4/H2S boundary (rung 4b/4c)
const T_FROZEN = 100;     // ≤100 °C: abiotic SO4↔H2S exchange frozen (t_½ ~10⁸–10⁹ yr)
const T_FAST   = 200;     // ≥200 °C: Ohmoto & Lasaga fast-exchange (equilibrium <100 yr)
const W_HOT  = 12;        // sigmoid width (mV) at fast-exchange — near-sharp equilibrium step

function taperT(T) { return Math.min(1, Math.max(0, (T - T_FROZEN) / (T_FAST - T_FROZEN))); }

// fraction of fluid.S sitting as REDUCED S (H2S/HS-); high at low Eh, low at high Eh.
//
// wCold is the frozen-regime sigmoid width. The physical subtlety §4 flags: below
// ~200 °C a brine carries an INHERITED sulfate/sulfide ratio that is largely decoupled
// from local Eh (kinetics frozen). A NARROW cold sigmoid wrongly re-equilibrates that
// ratio to Eh; a WIDE cold sigmoid (wCold ≫ vug Eh span) flattens the partition toward
// ~0.5 across the whole reducing-to-oxidizing window — i.e. "both pools present,
// ratio ~Eh-independent." So sweeping wCold IS sweeping the inherited-disequilibrium
// flatness. Fmin is the residual clamp on the HOT tail so equilibrium never runs a
// species to exactly zero.
function sulfurReducedFraction(Eh, T, Fmin, wCold) {
  const t = taperT(T);
  const w = wCold + (W_HOT - wCold) * t;        // wide/flat when frozen → sharp when hot
  const floor = Fmin * (1 - t);                 // residual floor collapses to 0 by T_FAST
  let f = 1 / (1 + Math.exp((Eh - EH_BOUNDARY) / w));
  return Math.min(1 - floor, Math.max(floor, f));
}

// ── species → which side of S it consumes (proposal §3 census table, authoritative) ──
const SULFIDE_CONSUMERS = new Set([
  'galena','sphalerite','wurtzite','pyrite','marcasite','chalcopyrite','molybdenite',
  'tetrahedrite','tennantite','enargite','arsenopyrite','acanthite','argentite',
  'proustite','pyrargyrite','stibnite','bismuthinite','cinnabar','metacinnabar',
  'orpiment','realgar','pararealgar','greenockite','hawleyite','cobaltite','nickeline',
  'millerite','skutterudite','safflorite','rammelsbergite','loellingite',
]);
const SULFATE_CONSUMERS = new Set([
  'barite','celestine','anhydrite','selenite','gypsum','anglesite','brochantite',
  'antlerite','linarite','caledonite','leadhillite','jarosite','alunite','chalcanthite',
  'mirabilite','thenardite','langite','posnjakite','glauberite','epsomite',
]);
// Carve-outs: reported but NOT allowed to set F_min. native_sulfur needs BOTH species
// (synproportionation, Phase-S3); the enrichment trio eats dissolution-fed transient
// sulfide the standing-fraction model can't represent (proposal §6, stays gated).
const CARVEOUT = new Set(['native_sulfur','bornite','chalcocite','covellite']);

function sideOf(sp) {
  if (SULFIDE_CONSUMERS.has(sp)) return 'sulfide';
  if (SULFATE_CONSUMERS.has(sp)) return 'sulfate';
  return null;
}
function sigmaCritOf(sp) {
  const g = MINERAL_GATES_REGISTRY && MINERAL_GATES_REGISTRY[sp];
  return (g && typeof g.sigma_crit === 'number') ? g.sigma_crit : 1.0;
}

// ── run the fleet, snapshot per-step fluid state, collect nucleation events ──
const events = [];              // {sp, side, scen, step, Eh, T, S, sigmaCrit}
const unclassified = new Map(); // S-sensitive species not in either set → warn
const carveoutSeen = new Set();

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  const snaps = [];
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = sim.conditions.fluid;
    snaps.push({ fluid: { ...f }, T: sim.conditions.temperature, Eh: f.Eh });
  }
  // recompute helper: call a species' real engine with fluid.S swapped in.
  const cond = sim.conditions;
  const origFluid = cond.fluid, origT = cond.temperature;
  const sigmaWithS = (sp, snap, Sval) => {
    const method = cond['supersaturation_' + sp];
    if (typeof method !== 'function') return null;
    cond.fluid = { ...snap.fluid, S: Sval };
    cond.temperature = snap.T;
    let v;
    try { v = method.call(cond); } catch { v = null; }
    cond.fluid = origFluid; cond.temperature = origT;
    return v;
  };

  for (const c of sim.crystals) {
    const sp = c.mineral;
    const st = Math.min(c.nucleation_step ?? 0, snaps.length - 1);
    const snap = snaps[st];
    if (CARVEOUT.has(sp)) { carveoutSeen.add(sp); }
    const side = sideOf(sp);
    if (!side) {
      // Only warn about a STOICHIOMETRIC S-consumer we missed — i.e. one with a hard
      // S-gate (sigma → ~0 when S → 0). Species whose sigma merely wiggles with S are
      // feeling the ionic-strength/activity-correction shift, not consuming S as a
      // component (carbonates, silicates, native metals, halides) — not our concern.
      const full = sigmaWithS(sp, snap, snap.fluid.S);
      const zero = sigmaWithS(sp, snap, 0);
      if (full != null && zero != null && full > 1e-6 && zero < 1e-9 && !CARVEOUT.has(sp)) {
        unclassified.set(sp, (unclassified.get(sp) || 0) + 1);
      }
      continue;
    }
    // HARDENED (boss directive, pre-S1): each event's REAL nucleation bar =
    // sigma_crit × the paragenesis discount for the crystal's ACTUAL recorded
    // position, not a uniform 0.7. MVT barite that snowball-seeds on a sulfide host
    // gets its true host discount here (and js/90 even bypasses the probability gate
    // for those seeds — so σ-clearing at the discounted bar is the binding test).
    const realDiscount = (typeof sim._sigmaDiscountForPosition === 'function')
      ? sim._sigmaDiscountForPosition(sp, c.position) : 1.0;
    events.push({
      sp, side, scen: name, step: st, Eh: snap.Eh, T: snap.T, S: snap.fluid.S,
      sigmaCrit: sigmaCritOf(sp), pos: c.position, realDiscount,
      _snap: snap, _sigmaWithS: sigmaWithS,
    });
  }
}

// ── would-it-starve at a given (F_min, wCold): post-split sigma vs sigma_crit ──
function evalAt(ev, Fmin, wCold) {
  const red = sulfurReducedFraction(ev.Eh, ev.T, Fmin, wCold);
  const avail = ev.side === 'sulfide' ? ev.S * red : ev.S * (1 - red);
  const pre = ev._sigmaWithS(ev.sp, ev._snap, ev.S);
  const post = ev._sigmaWithS(ev.sp, ev._snap, avail);
  const bar = ev.sigmaCrit;
  // Only a species the split PUSHES from above its bar to below it "starves" at this
  // event — one already below pre-split nucleated via substrate discount / paramorph
  // parent and isn't ours to feed.
  const eventStarves = pre != null && post != null && pre >= bar && post < bar;
  const eventFeeds = post != null && post >= bar;   // this event alone would still fire
  return { red, avail, pre, post, bar, eventStarves, eventFeeds };
}

const feedable = events.filter(e => !CARVEOUT.has(e.sp));

// ── survival is per (species, scenario), NOT per event ──
// The acceptance criterion is "the mineral still forms in that run" (proposal §8:
// zero expects_species lost). A (species,scenario) SURVIVES the split if AT LEAST ONE
// of its recorded nucleation events still clears the bar. Per-event starvation is too
// strict — a species that loses one of five nucleations is not "lost."
const groups = new Map(); // `${sp}@${scen}` -> {sp, scen, side, events:[]}
for (const e of feedable) {
  const k = `${e.sp}@${e.scen}`;
  let g = groups.get(k);
  if (!g) groups.set(k, g = { sp: e.sp, scen: e.scen, side: e.side, events: [] });
  g.events.push(e);
}
// The nucleation bar per event. mode 'real' uses each event's actual position-derived
// paragenesis discount (the HARDENED test the boss asked for pre-S1); 'strict' uses the
// bare-wall sigma_crit (pessimistic bound — real survival is at least this good).
function barOf(e, mode) { return mode === 'real' ? e.sigmaCrit * e.realDiscount : e.sigmaCrit; }
function survivingGroups(Fmin, wCold, mode = 'real') {
  let lost = [];
  for (const g of groups.values()) {
    const anyFeeds = g.events.some(e => { const r = evalAt(e, Fmin, wCold); return r.post != null && r.post >= barOf(e, mode); });
    const formsNow = g.events.some(e => { const r = evalAt(e, Fmin, wCold); return r.pre != null && r.pre >= barOf(e, mode); });
    if (formsNow && !anyFeeds) lost.push(g);
  }
  return lost;
}

// ── the protected coexistence set the split must not break (proposal §8) ──
const PROTECTED = [
  ['barite', 'mvt'], ['galena', 'mvt'],
  ['barite', 'wittichen'], ['acanthite', 'wittichen'],
  ['selenite', 'elmwood'], ['sphalerite', 'elmwood'], ['barite', 'elmwood'],
  ['barite', 'tn457_barite_pulses'], ['sphalerite', 'tn457_barite_pulses'],
];

// ── 2-D sweep: F_min × wCold, count lost (species,scenario) coexistences ──
const FMINS  = [0.20, 0.15, 0.10, 0.05, 0.0];
const WCOLDS = [90, 150, 250, 400, 600];  // 90≈Eh-equilibrium sigmoid … 600≈flat (inherited)

// ── report ──────────────────────────────────────────────────────────────────
console.log('\n╔══ SULFUR-SPECIATION CENSUS (S0 instrument) ══╗');
console.log(`  seed 42 fleet · ${Object.keys(SCENARIOS).length} scenarios · ${events.length} S-consuming nucleation events · ${groups.size} (species,scenario) groups`);
console.log(`  partition: Eh_b=${EH_BOUNDARY}mV · taper ${T_FROZEN}/${T_FAST}°C · wHot=${W_HOT}mV · wCold swept`);

if (unclassified.size) {
  console.log('\n⚠ STOICHIOMETRIC S-consumer with a hard S-gate NOT classified (fix before S1):');
  for (const [sp, n] of unclassified) console.log(`    ${sp} (n=${n})`);
} else {
  console.log('\n✓ every hard-S-gated nucleator is classified sulfide|sulfate|carve-out (activity-only wiggles ignored)');
}
if (carveoutSeen.size) console.log(`  carve-outs present (excluded): ${[...carveoutSeen].join(', ')}`);

for (const mode of ['real', 'strict']) {
  const label = mode === 'real'
    ? "HARDENED — each event's actual position-derived discount"
    : 'STRICT bare-wall sigma_crit (pessimistic bound)';
  console.log(`\n── coexistences LOST (of ${groups.size} groups that currently form), by F_min × wCold  [${label}] ──`);
  console.log('        wCold→   ' + WCOLDS.map(w => String(w).padStart(6)).join(''));
  for (const Fmin of FMINS) {
    const cells = WCOLDS.map(w => String(survivingGroups(Fmin, w, mode).length).padStart(6));
    console.log(`   F_min ${Fmin.toFixed(2)}  ` + cells.join(''));
  }
}

console.log('\n── the PROTECTED set (§8) — survives? at F_min=0.10, by wCold ──');
console.log('   (✓=forms ✗=lost)   HARDENED(real) wCold→' + WCOLDS.map(w => String(w).padStart(5)).join('') + '   │ STRICT→' + WCOLDS.map(w => String(w).padStart(5)).join(''));
for (const [sp, scen] of PROTECTED) {
  const g = groups.get(`${sp}@${scen}`);
  if (!g) { console.log(`   ${(sp + '@' + scen).padEnd(26)} (no nucleation at seed 42)`); continue; }
  const marksFor = (mode) => WCOLDS.map(w => {
    const feeds = g.events.some(e => { const r = evalAt(e, 0.10, w); return r.post != null && r.post >= barOf(e, mode); });
    return (feeds ? '  ✓  ' : '  ✗  ');
  }).join('');
  console.log(`   ${(sp + '@' + scen).padEnd(26)} ` + marksFor('real') + '   │       ' + marksFor('strict'));
}
// the residual watch-list at the hardened best config (§ for S1 to clear)
console.log('\n── residual lost at HARDENED / F_min=0.10 / wCold=250 (the S1 watch-list) ──');
const residual = survivingGroups(0.10, 250, 'real');
for (const g of residual.sort((a, b) => a.scen.localeCompare(b.scen)))
  console.log(`   ${(g.sp + '@' + g.scen).padEnd(34)} ${g.side}  n=${g.events.length}  (disc ${g.events.map(e => e.realDiscount.toFixed(2)).join(',')})`);
console.log(`   → ${residual.length} groups; none in the §8 protected set if the table above is all ✓ (real).`);

// ── barite-fleet sulfate fraction at a representative flat-cold shape ──
const bariteEvents = events.filter(e => e.sp === 'barite');
function bariteStats(Fmin, wCold) {
  const fr = bariteEvents.map(e => 1 - sulfurReducedFraction(e.Eh, e.T, Fmin, wCold));
  const av = bariteEvents.map(e => e.S * (1 - sulfurReducedFraction(e.Eh, e.T, Fmin, wCold)));
  const mn = a => Math.min(...a), mx = a => Math.max(...a);
  return { n: bariteEvents.length, frMin: mn(fr), frMax: mx(fr), avMin: mn(av), avMax: mx(av) };
}
for (const w of [90, 400]) {
  const b = bariteStats(0.10, w);
  console.log(`\n── barite fleet (n=${b.n}) at F_min=0.10, wCold=${w} ──`);
  console.log(`   sulfate fraction  ${b.frMin.toFixed(3)} … ${b.frMax.toFixed(3)}   ppm avail ${b.avMin.toFixed(1)} … ${b.avMax.toFixed(1)}  (barite gates ≥10, s_f saturates ≥40)`);
}

if (VERBOSE) {
  console.log('\n── lost coexistences (HARDENED) at F_min=0.10, wCold=90 (Eh-equilibrium shape) ──');
  for (const g of survivingGroups(0.10, 90, 'real')) console.log(`   ${g.sp}@${g.scen} (${g.side}, n=${g.events.length})`);
  console.log('\n── lost coexistences (HARDENED) at F_min=0.10, wCold=400 (flat inherited shape) ──');
  for (const g of survivingGroups(0.10, 400, 'real')) console.log(`   ${g.sp}@${g.scen} (${g.side}, n=${g.events.length})`);
}
console.log('');
