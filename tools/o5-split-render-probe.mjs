// tools/o5-split-render-probe.mjs — W-F O5 SPLITTING S-c instrument (the
// continuous-render acceptance gate, headless).
//
// S-c makes the split render vary CONTINUOUSLY with `_split.index` instead of
// snapping between fixed meshes (§9c #2). The render mapping lives in js/99i
// (the Three renderer), which no headless run exercises — so this probe
// REPLICATES the exact js/99i quantization formulas and applies them to the
// real seed-42 split crystals. If each active render family spreads into ≥2
// distinct quantized buckets, the ladder is genuinely continuous (not a snap);
// if a family collapses to one bucket, the render is still effectively fixed
// and S-c has not landed for it.
//
// This is a data-level proof of the render's continuity that needs no browser
// (WebGL screenshots time out) and no GL context. The formulas below are a
// MIRROR of js/99i-renderer-three.ts (the split render hook) — keep them in
// sync; the comment tags cite the source band cuts.
//
// Usage: node tools/o5-split-render-probe.mjs [--seed N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({ toolName: 'o5-split-render-probe' });
const { SCENARIOS, VugSimulator, setSeed } = bundle;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ── the js/99i render-param mappings (MIRROR — keep in sync) ──────────────────
// curved band 0.08..0.25 → curvature 0.05..0.16 (quantize 0.01), rhomb/saddle only
const curvatureFor = (idx) =>
  Math.round((0.05 + 0.11 * clamp01((idx - 0.08) / 0.17)) * 100) / 100;
// split+sheaf band 0.25..0.85 → splay 0.30..1.08 rad (quantize 0.05)
const splayFor = (idx) =>
  Math.round((0.30 + 0.78 * clamp01((idx - 0.25) / 0.60)) * 20) / 20;
// spherulite band 0.85..1.0 → completeness 0..1 (quantize 0.05)
const completenessFor = (idx) =>
  Math.round(clamp01((idx - 0.85) / 0.15) * 20) / 20;

// The curved-rung render only takes rhombohedral carbonates + saddle-habit
// crystals (a curved gypsum keeps its blade). Mirror of the js/99i gate
// `token === 'rhomb' || habit.indexOf('saddle') >= 0`, approximated here by the
// carbonate-rhomb roster (the minerals whose geom token is 'rhomb') + saddle habit.
const RHOMB_CARBONATES = new Set([
  'calcite', 'dolomite', 'siderite', 'rhodochrosite', 'magnesite', 'ankerite',
  'smithsonite', 'otavite', 'gaspeite', 'kutnohorite',
]);
const curvedTakesSaddle = (c) =>
  (typeof c.habit === 'string' && c.habit.indexOf('saddle') >= 0) ||
  RHOMB_CARBONATES.has(c.mineral);

const buckets = {
  curved: new Map(),      // curvature -> count (rhomb/saddle only)
  fan: new Map(),         // splay -> count (split + sheaf, one continuous family)
  spherulite: new Map(),  // completeness -> count
};
const curvedOther = new Map();  // curved rung, NON-rhomb (keeps its habit) -> count
let nSplit = 0;

const add = (m, k) => m.set(k, (m.get(k) || 0) + 1);

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  for (const c of sim.crystals) {
    if (!c || !c._split || c._deformation) continue;   // _deformation set is a SEPARATE render (certified noncollision)
    const rung = c._split.rung;
    const idx = clamp01(c._split.index || 0);
    if (rung === 'curved') {
      if (curvedTakesSaddle(c)) add(buckets.curved, curvatureFor(idx));
      else add(curvedOther, c.mineral);
      nSplit++;
    } else if (rung === 'split' || rung === 'sheaf') {
      add(buckets.fan, splayFor(idx)); nSplit++;
    } else if (rung === 'spherulite') {
      add(buckets.spherulite, completenessFor(idx)); nSplit++;
    }
  }
}

const fmt = (m) => [...m.entries()].sort((a, b) => a[0] - b[0])
  .map(([k, v]) => `${k}×${v}`).join('  ');

console.log(`\nO5-splitting RENDER-PARAM probe — seed ${SEED}`);
console.log(`  ${nSplit} split-rung crystals mapped to render params\n`);
console.log(`  curved  (saddle curvature, rhomb/saddle set) — ${buckets.curved.size} distinct: ${fmt(buckets.curved) || '(none)'}`);
console.log(`  fan     (splay, split+sheaf continuous)       — ${buckets.fan.size} distinct: ${fmt(buckets.fan) || '(none)'}`);
console.log(`  spher.  (completeness)                        — ${buckets.spherulite.size} distinct: ${fmt(buckets.spherulite) || '(none)'}`);
if (curvedOther.size) {
  console.log(`\n  (curved-rung non-rhomb minerals keep their habit render: ${fmt2(curvedOther)})`);
}
function fmt2(m) { return [...m.entries()].sort().map(([k, v]) => `${k}×${v}`).join(', '); }

// ── acceptance gate: every ACTIVE family must span ≥2 buckets (continuous, not a snap) ──
const active = [
  ['curved', buckets.curved],
  ['fan', buckets.fan],
  ['spherulite', buckets.spherulite],
].filter(([, m]) => m.size > 0);

const degenerate = active.filter(([, m]) => m.size < 2).map(([n]) => n);
if (VERBOSE) {
  console.log(`\n  active families: ${active.map(([n]) => n).join(', ')}`);
}
if (degenerate.length) {
  console.log(`\n  ✗ FAIL — family collapsed to a single bucket (still a snap): ${degenerate.join(', ')}`);
  process.exit(1);
}
console.log(`\n  ✓ PASS — every active render family spans ≥2 distinct buckets (continuous ladder).`);
