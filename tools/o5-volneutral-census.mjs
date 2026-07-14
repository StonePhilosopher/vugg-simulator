// tools/o5-volneutral-census.mjs — W-K VOL-NEUTRAL blast-radius probe (the heavy
// debt's PRE-REGISTRATION census; boss directive 2026-07-14 "measure first").
//
// The proposed effect: a split crystal's axial extent compacts by
// splitGrowthMult(index) at CONSTANT volume (a_width widens to conserve
// _volume_mm3 — the needle→sphere at same material). The keystone claimed this
// is census-bounded ("~8 sites, fill untouched"). But c_length_mm feeds O3
// geometric-selection (js/44a, js/85b), enclosure (js/85c), and paragenesis
// (js/26) — so compacting a split crystal's LENGTH can change which crystals win,
// enclose, and nucleate, cascading to NON-split minerals. This probe MEASURES
// that blast radius before we choose honest-physics vs a display-only decouple.
//
// Method (no rebuild): O5_VOLNEUTRAL_ENABLED is a live binding. Run the seed-42
// fleet with it OFF (baseline A) and ON (baseline B) in ONE process, diff the
// per-scenario per-mineral summary (total / active / dissolved / max_um — the
// SAME shape gen-js-baseline records + calibration.test asserts). Because the
// compaction touches c_length_mm and NOT total_growth_um, max_um moves ONLY via
// cascade — so every diff is a genuine downstream effect, not the direct edit.
//
// Classify each moved mineral: split-able (SPLIT_ABILITY>0 → the set allowed to
// move) vs NOT (the flood). The NON-split count is the number the boss decides on.
//
// Usage: node tools/o5-volneutral-census.mjs [--seed N] [--verbose]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({
  toolName: 'o5-volneutral-census',
  extraExports: ['setO5VolNeutral', 'splitAbleFor'],
});
const { SCENARIOS, VugSimulator, setSeed, setO5VolNeutral, splitAbleFor } = bundle;

// Mirror gen-js-baseline.mjs summarize() EXACTLY (the calibration-gated shape).
function summarize(sim) {
  const out = {};
  if (!sim || !sim.crystals) return out;
  for (const c of sim.crystals) {
    if (!out[c.mineral]) out[c.mineral] = { active: 0, dissolved: 0, total: 0, max_um: 0 };
    out[c.mineral].total++;
    if (c.dissolved) out[c.mineral].dissolved++;
    else out[c.mineral].active++;
    if (c.total_growth_um > out[c.mineral].max_um) {
      out[c.mineral].max_um = Math.round(c.total_growth_um * 10) / 10;
    }
  }
  return out;
}

function runFleet() {
  const res = {};
  for (const name of Object.keys(SCENARIOS).sort()) {
    setSeed(SEED);
    let scen; try { scen = SCENARIOS[name](); } catch { continue; }
    const sim = new VugSimulator(scen.conditions, scen.events);
    const steps = scen.defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    res[name] = summarize(sim);
  }
  return res;
}

// ── run OFF then ON ───────────────────────────────────────────────────────────
setO5VolNeutral(false);
const A = runFleet();
setO5VolNeutral(true);
const B = runFleet();
setO5VolNeutral(false);   // leave the module as we found it

// ── flag-OFF byte-identical certificate ───────────────────────────────────────
// Baseline A (flag off) MUST equal the committed baseline of the CURRENT
// SIM_VERSION — proof the wiring is inert when off (the record-unread guarantee).
const baselineDir = path.join(ROOT, 'tests-js', 'baselines');
const versions = fs.readdirSync(baselineDir)
  .map((f) => /^seed42_v(\d+)\.json$/.exec(f)).filter(Boolean)
  .map((m) => Number(m[1])).sort((x, y) => x - y);
const curV = versions[versions.length - 1];
let offIdentical = null;
if (curV != null) {
  const committed = JSON.parse(fs.readFileSync(path.join(baselineDir, `seed42_v${curV}.json`), 'utf8'));
  // committed keys omit empty scenarios; compare the intersection the summarizer produces.
  offIdentical = JSON.stringify(committed) === JSON.stringify(sortDeep(A));
}
function sortDeep(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) {
    const inner = {};
    for (const m of Object.keys(o[k]).sort()) inner[m] = o[k][m];
    out[k] = inner;
  }
  return out;
}

// ── diff ──────────────────────────────────────────────────────────────────────
const movedMinerals = new Map();   // mineral -> { splitAble, scenarios:Set, kinds:Set }
const scenariosTouched = new Set();

function note(mineral, scen, kind, detail) {
  if (!movedMinerals.has(mineral)) {
    movedMinerals.set(mineral, { splitAble: !!splitAbleFor(mineral), scenarios: new Set(), kinds: new Set(), details: [] });
  }
  const m = movedMinerals.get(mineral);
  m.scenarios.add(scen); m.kinds.add(kind);
  if (detail) m.details.push(`${scen}:${detail}`);
  scenariosTouched.add(scen);
}

for (const scen of Object.keys(A)) {
  const a = A[scen] || {}, b = B[scen] || {};
  const minerals = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const m of minerals) {
    const ma = a[m], mb = b[m];
    if (!ma && mb) { note(m, scen, 'gained', `+${mb.total}`); continue; }
    if (ma && !mb) { note(m, scen, 'lost', `-${ma.total}`); continue; }
    if (ma.total !== mb.total) note(m, scen, 'count', `n ${ma.total}→${mb.total}`);
    if (ma.active !== mb.active || ma.dissolved !== mb.dissolved) note(m, scen, 'active/diss', `act ${ma.active}→${mb.active}`);
    if (ma.max_um !== mb.max_um) {
      const d = mb.max_um - ma.max_um;
      const pct = ma.max_um > 0 ? (100 * d / ma.max_um) : 0;
      note(m, scen, 'max_um', `max_um ${ma.max_um}→${mb.max_um} (${d > 0 ? '+' : ''}${d.toFixed(1)}µm, ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`);
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────
const all = [...movedMinerals.entries()].sort((x, y) => x[0].localeCompare(y[0]));
const splitMoved = all.filter(([, v]) => v.splitAble);
const nonSplitMoved = all.filter(([, v]) => !v.splitAble);

console.log(`\nW-K VOL-NEUTRAL blast-radius census — seed ${SEED}`);
console.log(`  constant-volume length-compaction on the SPLIT set (splitGrowthMult, floor ${'0.7'})`);
console.log(`  ${Object.keys(A).length} scenarios · ${scenariosTouched.size} touched by any change`);
console.log(`  flag-OFF byte-identical to committed seed42_v${curV}: ${
  offIdentical == null ? '(no baseline found)' : offIdentical ? '✓ inert-when-off certified' : '✗ FLAG-OFF DRIFTED (wiring not inert!)'}\n`);

console.log(`  SPLIT-able minerals moved (allowed — the set may move): ${splitMoved.length}`);
if (VERBOSE || splitMoved.length) {
  for (const [m, v] of splitMoved) {
    console.log(`    ${m.padEnd(16)} ${v.details.join('  ·  ')}`);
  }
}

console.log(`\n  ▶ NON-split minerals moved (THE FLOOD — the number that decides the path): ${nonSplitMoved.length}`);
for (const [m, v] of nonSplitMoved) {
  console.log(`    ${m.padEnd(16)} ${v.details.join('  ·  ')}`);
}

console.log(`\n  VERDICT: ${nonSplitMoved.length === 0
  ? '✓ ZERO non-split cascade — the honest physics IS census-bounded.'
  : `✗ ${nonSplitMoved.length} non-split minerals cascade — honest physics is NOT census-bounded (the flood is real).`}`);
