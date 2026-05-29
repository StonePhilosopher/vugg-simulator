#!/usr/bin/env node
/**
 * tools/strip-survey.mjs — batched, per-scenario chip-trajectory survey for the
 * strip-as-instrument campaign. Loads the bundle ONCE and steps every scenario
 * (or a chosen subset), reading the strip chip functions DIRECTLY (raw,
 * unquantized — same path as strip-chip-envelope) at the wall (depth 0),
 * ring-averaged per step. Prints a dense per-scenario grid:
 *
 *     chip   min   max   first→last   %null   MONO/PIN hints   sparkline
 *
 * This is the "survey before you swing" instrument: it makes ~21 uninstrumented
 * scenarios × the active chips legible in one scroll, so anomalies (a driver
 * stuck flat, a one-way ratchet, a chip pinned at a range bound, chemistry that
 * contradicts the scenario's design intent) jump out for a human read. It does
 * NOT auto-classify bugs — the hints are advisory; geological judgment decides.
 * (Cf. the zoned_dripstone_cave / searles flat-ions false alarms.)
 *
 * Usage:
 *   node tools/strip-survey.mjs                      # all scenarios, curated chips
 *   node tools/strip-survey.mjs bisbee marble        # named scenarios only
 *   node tools/strip-survey.mjs --chips pH,T,O2      # override chip set
 *   node tools/strip-survey.mjs --all-chips bisbee   # every active chip
 *   node tools/strip-survey.mjs --seed 7             # different seed
 *
 * Only chips that are ACTIVE in a scenario (|max| > eps or nonzero range) print,
 * to cut noise — an all-zero ion in a scenario that doesn't carry it is silent.
 */

import { loadSimBundle } from './_harness.mjs';

const argv = process.argv.slice(2);
const positionals = [];
const opts = { seed: 42, allChips: false, chips: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--seed') opts.seed = parseInt(argv[++i], 10);
  else if (a === '--all-chips') opts.allChips = true;
  else if (a === '--chips') opts.chips = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
  else if (a.startsWith('--')) { console.error(`unknown flag: ${a}`); process.exit(1); }
  else positionals.push(a);
}

const { SCENARIOS, VugSimulator, setSeed, _HELIX_CHEM_PARAMS } =
  await loadSimBundle({ toolName: 'strip-survey', extraExports: ['_HELIX_CHEM_PARAMS'] });

const params = _HELIX_CHEM_PARAMS || [];
if (!params.length) { console.error('no _HELIX_CHEM_PARAMS captured — run `npm run build` first'); process.exit(1); }

// Curated default chip set: conditions + carbonate SI + the dolomite-order
// driver + the broad ion roster. Active-only filtering hides the irrelevant.
const CURATED = [
  'T', 'pH', 'O2', 'Eh', 'salinity', 'concentration',
  'DIC', 'CO3', 'SI_calcite', 'SI_aragonite', 'SI_dolomite', 'SI_HMC', 'SI_siderite', 'f_ord',
  'Ca', 'Mg', 'Fe', 'Mn', 'Cu', 'Zn', 'Pb', 'S', 'Ba', 'Sr', 'SiO2',
  'U', 'As', 'Bi', 'Co', 'Ni', 'Ag', 'Sb', 'Mo', 'W', 'Sn', 'Te', 'Au',
  'Cl', 'Na', 'K', 'B', 'F', 'Li', 'Al', 'P',
];

const wantIds = opts.chips || (opts.allChips ? params.map(p => p.id) : CURATED);
const chipParams = wantIds
  .map(id => params.find(p => p.id === id))
  .filter(Boolean);

const EPS = 1e-6;
const SPARK = '▁▂▃▄▅▆▇█';
const SPARK_W = 64;  // downsample long runs so the grid stays one-scroll legible
function sparkline(series, lo, hi) {
  const span = (hi - lo) || 1;
  // bucket into <=SPARK_W columns, averaging non-null values per bucket
  const cols = Math.min(SPARK_W, series.length);
  const out = [];
  for (let c = 0; c < cols; c++) {
    const a = Math.floor((c * series.length) / cols);
    const b = Math.floor(((c + 1) * series.length) / cols);
    let sum = 0, n = 0;
    for (let i = a; i < b; i++) { const v = series[i]; if (v != null && isFinite(v)) { sum += v; n++; } }
    if (!n) { out.push(' '); continue; }
    const t = Math.max(0, Math.min(1, (sum / n - lo) / span));
    out.push(SPARK[Math.min(SPARK.length - 1, Math.round(t * (SPARK.length - 1)))]);
  }
  return out.join('');
}

function reduce(series) {
  const vals = series.filter(v => v != null && isFinite(v));
  const nNull = series.length - vals.length;
  if (!vals.length) return null;
  let min = Infinity, max = -Infinity;
  for (const v of vals) { if (v < min) min = v; if (v > max) max = v; }
  // monotone (ignoring nulls): strictly non-decreasing / non-increasing, with
  // a real net move (so a flat line isn't flagged as both).
  let up = true, down = true;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < vals[i - 1] - EPS) up = false;
    if (vals[i] > vals[i - 1] + EPS) down = false;
  }
  const net = vals[vals.length - 1] - vals[0];
  const range = max - min;
  return {
    min, max, range, nNull,
    first: vals[0], last: vals[vals.length - 1],
    mono: range > EPS ? (up && net > EPS ? 'UP' : down && net < -EPS ? 'DN' : '') : '',
    flat: range <= EPS,
  };
}

const names = positionals.length ? positionals : Object.keys(SCENARIOS).sort();
const fmt = (v) => (v == null ? 'null' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

for (const name of names) {
  if (!SCENARIOS[name]) { console.log(`\n=== ${name}: UNKNOWN SCENARIO ===`); continue; }
  setSeed(opts.seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  const wall = () => sim.wall_state || sim.conditions?.wall;

  // per-chip per-step ring-averaged raw value at depth 0
  const series = {};
  for (const p of chipParams) series[p.id] = [];
  for (let s = 0; s < steps; s++) {
    sim.run_step();
    const w = wall();
    const rc = Math.max(1, Number(w?.ring_count) || 16);
    for (const p of chipParams) {
      if (typeof p.read !== 'function') { series[p.id].push(null); continue; }
      let sum = 0, n = 0;
      for (let h = 0; h < rc; h++) {
        let v; try { v = p.read(sim, w, h, 0); } catch { v = null; }
        if (v != null && typeof v === 'number' && isFinite(v)) { sum += v; n++; }
      }
      series[p.id].push(n ? sum / n : null);
    }
  }

  console.log(`\n=== ${name}  (steps=${steps}) ===`);
  console.log('  chip          min       max       first→last        %null  hint    spark');
  for (const p of chipParams) {
    const r = reduce(series[p.id]);
    if (!r) continue;                                  // all-null → silent
    if (Math.abs(r.max) < EPS && Math.abs(r.min) < EPS) continue;  // all-zero → silent
    const pctNull = Math.round((r.nNull / steps) * 100);
    // PIN: spends >40% of non-null steps within 1% of a declared bound.
    const lo = Number(p.min), hi = Number(p.max);
    const bandLo = lo + 0.01 * (hi - lo), bandHi = hi - 0.01 * (hi - lo);
    let pinLo = 0, pinHi = 0, nv = 0;
    for (const v of series[p.id]) { if (v == null) continue; nv++; if (v <= bandLo) pinLo++; if (v >= bandHi) pinHi++; }
    const pin = nv ? (pinLo / nv > 0.4 ? 'PIN-LO' : pinHi / nv > 0.4 ? 'PIN-HI' : '') : '';
    const hint = [r.flat ? 'FLAT' : '', r.mono === 'UP' ? 'MONO↑' : r.mono === 'DN' ? 'MONO↓' : '', pin].filter(Boolean).join(',');
    console.log(
      `  ${p.id.padEnd(13)} ${fmt(r.min).padStart(8)} ${fmt(r.max).padStart(9)}  ${(fmt(r.first) + '→' + fmt(r.last)).padEnd(16)} ${(pctNull + '%').padStart(5)}  ${hint.padEnd(14)} ${sparkline(series[p.id], r.min, r.max)}`,
    );
  }
}
console.log('');
