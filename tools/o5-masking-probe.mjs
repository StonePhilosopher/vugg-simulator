// tools/o5-masking-probe.mjs — W-F O5b calibration instrument (4a.7 recipe).
//
// The masking gate (js/85 growth loop, σ*(φ)=σ*₀·(1+k·φ/(1−φ)), js/44b) is live
// in O5b. This probe isolates its effect: for a given SIGMA_STAR_K it runs each
// scenario at seed 42 TWICE — gate OFF (the v221 reference) then gate ON — and
// reports the per-scenario delta, so k is picked on the sim's own σ scale
// rather than guessed. It also enforces the O5a census's pre-registration: any
// movement in a NON-film scenario is a BUG (the gate should touch only crystals
// with `_film`), flagged and exit-1.
//
// Metrics per scenario (gate ON vs OFF):
//   filmed        crystals that ever carried _film
//   stalled       filmed crystals whose growth was masked ≥1 step
//   horizons      crystals that grew THROUGH a film (masked_horizon zones)
//   frozen        filmed crystals STILL masked at run end (never broke through)
//   Δmax_mm       largest single-crystal size change (masking shrinks growth)
//   Δcrystals     crystal-count change (0 expected — masking changes SIZE, not
//                 presence; a nonzero here means a downstream cap/enclosure
//                 rippled and wants a look)
//
// Usage: node tools/o5-masking-probe.mjs [--k N] [--sweep] [--seed N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const kArg = process.argv.indexOf('--k');
const K = kArg >= 0 ? parseFloat(process.argv[kArg + 1]) : 1.0;
const SWEEP = process.argv.includes('--sweep');
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({
  toolName: 'o5-masking-probe',
  extraExports: ['setO5MaskingEnabled', 'setSigmaStarK'],
});
const { SCENARIOS, VugSimulator, setSeed, setO5MaskingEnabled, setSigmaStarK } = bundle;

// The O5a census's pre-registered film-carrying scenarios (writer-2 coats_front).
// Only these may move when the gate is on; a scenario's own film: directive
// would add it, but no fleet scenario has one yet.
const CENSUS_FILMED = new Set([
  'bisbee', 'deccan_zeolite', 'radioactive_pegmatite', 'epithermal_telluride',
  'reactivated_fluorite_vein', 'reactive_wall', 'roughten_gill', 'schneeberg',
  'sulphur_bank', 'supergene_oxidation',
]);

function runScenario(name, gateOn, k) {
  setSigmaStarK(k);
  setO5MaskingEnabled(gateOn);
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { return null; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  const everMasked = new Set();
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    for (const c of sim.crystals) {
      if (c && c.zones && c.zones.length && c.zones[c.zones.length - 1]._maskedStall) {
        everMasked.add(c.crystal_id);
      }
    }
  }
  const bySize = {};
  let filmed = 0, horizons = 0, frozen = 0;
  for (const c of sim.crystals) {
    if (!c) continue;
    bySize[c.crystal_id] = c.total_growth_um;
    const hasHorizon = c.zones && c.zones.some((z) => z.masked_horizon);
    if (hasHorizon) horizons++;
    if (c._film) { filmed++; frozen++; }        // still filmed at end = never broke through
    else if (hasHorizon || everMasked.has(c.crystal_id)) filmed++;
  }
  return { crystals: sim.crystals.length, bySize,
    filmed, stalled: everMasked.size, horizons, frozen,
    species: new Set(sim.crystals.filter((c) => c && !c.dissolved).map((c) => c.mineral)) };
}

function measure(name, k) {
  const off = runScenario(name, false, k);
  const on = runScenario(name, true, k);
  if (!off || !on) return null;
  let dMax = 0, dMaxId = null;
  for (const id of Object.keys(off.bySize)) {
    const a = off.bySize[id] || 0, b = (on.bySize[id] ?? a);
    if (Math.abs(b - a) > Math.abs(dMax)) { dMax = b - a; dMaxId = id; }
  }
  const speciesLost = [...off.species].filter((s) => !on.species.has(s));
  return {
    name, filmed: on.filmed, stalled: on.stalled, horizons: on.horizons, frozen: on.frozen,
    dMaxMm: dMax / 1000, dMaxId, dCrystals: on.crystals - off.crystals,
    speciesLost, moved: (on.crystals !== off.crystals) || Math.abs(dMax) > 1e-9 || speciesLost.length > 0,
  };
}

function reportOneK(k) {
  console.log(`\n=== SIGMA_STAR_K = ${k} ===`);
  console.log('scenario                      filmed stall horiz froz   Δmax(mm)   Δcry  species-lost');
  console.log('-'.repeat(92));
  const offenders = [];
  const rows = [];
  for (const name of Object.keys(SCENARIOS).sort()) {
    const m = measure(name, k);
    if (!m) continue;
    if (m.moved && !CENSUS_FILMED.has(name)) offenders.push(name);
    if (m.moved || m.filmed) rows.push(m);
  }
  rows.sort((a, b) => Math.abs(b.dMaxMm) - Math.abs(a.dMaxMm));
  for (const m of rows) {
    const flag = (m.moved && !CENSUS_FILMED.has(m.name)) ? '  ⚠ OFF-CENSUS' : '';
    console.log(
      `${m.name.padEnd(28)}  ${String(m.filmed).padStart(6)} ${String(m.stalled).padStart(5)} ` +
      `${String(m.horizons).padStart(5)} ${String(m.frozen).padStart(4)}  ${m.dMaxMm.toFixed(3).padStart(9)} ` +
      `${String(m.dCrystals).padStart(5)}   ${m.speciesLost.join(',') || '—'}${flag}`,
    );
  }
  if (offenders.length) {
    console.error(`\n⚠ OFF-CENSUS MOVEMENT (BUG — gate touched a non-film scenario): ${offenders.join(', ')}`);
    return false;
  }
  console.log('\nAll movement confined to the census-10 (pre-registration holds).');
  return true;
}

console.log(`O5b MASKING PROBE — seed ${SEED}`);
console.log('='.repeat(92));
let ok = true;
if (SWEEP) {
  for (const k of [0.3, 0.5, 1.0, 2.0, 4.0]) ok = reportOneK(k) && ok;
} else {
  ok = reportOneK(K);
}
console.log('');
process.exit(ok ? 0 : 1);
