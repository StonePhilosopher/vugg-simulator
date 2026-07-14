// tools/o5-split-census.mjs — W-F O5 SPLITTING S-a instrument (pre-registration
// census + the deformation-saddle NONCOLLISION certificate).
//
// The split accrual (js/44c accrueSplitIndex, in the js/85 growth loop) is
// recorded-but-unread in S-a. Before S-b lets `_split.rung` drive habit + render,
// this probe answers the two questions the two-commit discipline requires:
//
//   1. PRE-REGISTRATION — WHICH crystals accrue a split index at seed 42, by
//      route (A impurity / B high-σ / both) and rung. When S-b flips
//      O5_SPLITTING_ENABLED, ONLY these crystals may move; every non-accruing
//      crystal MUST stay byte-identical.
//
//   2. NONCOLLISION CERTIFICATE (boss §9a #4, promoted to a REQUIRED S-a gate) —
//      the split-saddle set (a crystal that earns a CURVED rung via the A route
//      is the growth-split saddle) must NOT collide with the deformation-saddle
//      set (crystals carrying `_deformation`, the post-growth shear bend — js/45
//      classifyDeformation). "Same visual habit, different cause, different
//      record." A crystal in BOTH sets is a collision: S-b would have to decide
//      which mechanism owns its shape. The certificate PASSES when the
//      intersection is empty.
//
// Pure read: runs each scenario at seed 42, inspects `_split` + `_deformation` on
// the final crystal list. No RNG, no mutation — S-a is itself byte-identical
// (this only observes the recorded state). classifyDeformation runs inside
// run_step (js/85:866), so `_deformation` is populated by a plain run.
//
// Usage: node tools/o5-split-census.mjs [--seed N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({
  toolName: 'o5-split-census',
  extraExports: ['splitAbleFor', 'SPLIT_ABILITY'],
});
const { SCENARIOS, VugSimulator, setSeed, splitAbleFor, SPLIT_ABILITY } = bundle;

const rows = [];
const collisions = [];          // CERTIFICATE: split-SADDLE ∩ deformation (the gate)
const overlaps = [];            // informational: any-rung split ∩ deformation
const routeTotals = { A: 0, B: 0, both: 0 };
const rungTotals = { curved: 0, split: 0, sheaf: 0, spherulite: 0 };
const mineralsAccrued = new Map();   // mineral -> count
const rungByMineral = new Map();     // mineral -> { none, curved, split, sheaf, spherulite } (UNtruncated)
const sigmaSamples = [];             // driver.sigma of accruing crystals (σ-scale calibration)
const indexSamples = [];             // final index of accruing crystals (band-cut calibration)
let fleetSplit = 0, fleetDeform = 0, fleetOverlap = 0;

// The split-able roster present in the fleet (splitAbility > 0), whether or not
// it accrued — so we can report the gap between "can split" and "did accrue".
const splitAbleSeen = new Map();     // mineral -> { present, accrued }

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }

  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  const splitCrystals = sim.crystals.filter((c) => c && c._split);
  const deformCrystals = sim.crystals.filter((c) => c && c._deformation);
  // The BROAD overlap (any split rung ∩ any deformation) — informational only.
  const overlap = sim.crystals.filter((c) => c && c._split && c._deformation);
  // The CERTIFICATE collision (the gate, boss §9a #4): a growth-split SADDLE (the
  // CURVED rung — the ONLY split habit that renders as a curved rhomb, visually
  // colliding with a shear bend) that ALSO carries a deformation bend. Two causes
  // for the SAME visual habit — that is what must stay separate. A B-route
  // spherulite/sheaf that later deforms is a legible SEQUENCE (grew radial, then
  // was tectonized — like grow-then-etch), not a provenance ambiguity, so it is
  // NOT a certificate failure; it surfaces only in the broad-overlap line.
  const collide = sim.crystals.filter(
    (c) => c && c._split && c._split.rung === 'curved' && c._deformation);

  // Track the split-able roster present in this scenario.
  for (const c of sim.crystals) {
    if (!c) continue;
    if (splitAbleFor(c.mineral) > 0) {
      const rec = splitAbleSeen.get(c.mineral) || { present: 0, accrued: 0 };
      rec.present++;
      if (c._split) rec.accrued++;
      splitAbleSeen.set(c.mineral, rec);
    }
  }

  if (splitCrystals.length || deformCrystals.length) {
    for (const c of splitCrystals) {
      routeTotals[c._split.route] = (routeTotals[c._split.route] || 0) + 1;
      if (c._split.rung in rungTotals) rungTotals[c._split.rung]++;
      mineralsAccrued.set(c.mineral, (mineralsAccrued.get(c.mineral) || 0) + 1);
      const rm = rungByMineral.get(c.mineral) || { none: 0, curved: 0, split: 0, sheaf: 0, spherulite: 0 };
      rm[c._split.rung] = (rm[c._split.rung] || 0) + 1;
      rungByMineral.set(c.mineral, rm);
      if (c._split.driver && Number.isFinite(c._split.driver.sigma)) sigmaSamples.push(c._split.driver.sigma);
      if (Number.isFinite(c._split.index)) indexSamples.push(c._split.index);
    }
    fleetSplit += splitCrystals.length;
    fleetDeform += deformCrystals.length;
    fleetOverlap += overlap.length;
    for (const c of collide) {
      collisions.push({
        scenario: name, id: c.crystal_id, mineral: c.mineral,
        rung: c._split.rung, route: c._split.route,
        deform: (c._deformation && c._deformation.kind) || '?',
      });
    }
    for (const c of overlap) {
      overlaps.push({
        scenario: name, id: c.crystal_id, mineral: c.mineral,
        rung: c._split.rung, route: c._split.route,
        deform: (c._deformation && c._deformation.kind) || '?',
      });
    }
    rows.push({
      name, split: splitCrystals.length, deform: deformCrystals.length,
      collide: collide.length, crystals: sim.crystals.length,
      samples: splitCrystals.slice(0, 8).map((c) => ({
        id: c.crystal_id, m: c.mineral,
        idx: +(c._split.index || 0).toFixed(3), rung: c._split.rung,
        route: c._split.route, dom: c._split.dominant,
      })),
    });
  }
}

console.log(`\nO5 SPLIT CENSUS — seed ${SEED} (S-a pre-registration + noncollision certificate)`);
console.log('='.repeat(80));

if (!rows.length) {
  console.log('No scenario accrues a split index at this seed, and none carries _deformation.');
} else {
  console.log('scenario                        split  deform  collide  crystals');
  console.log('-'.repeat(80));
  rows.sort((a, b) => b.split - a.split);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(30)}  ${String(r.split).padStart(5)}  ${String(r.deform).padStart(6)}` +
      `  ${String(r.collide).padStart(7)}  ${String(r.crystals).padStart(8)}`,
    );
    if (VERBOSE) {
      for (const s of r.samples) {
        console.log(`${''.padEnd(32)}#${s.id} ${s.m}: idx=${s.idx} rung=${s.rung} route=${s.route} dom=${s.dom}`);
      }
    }
  }
  console.log('-'.repeat(80));
  console.log(`TOTAL: ${fleetSplit} crystal(s) accrued a split index across ${rows.length} scenario(s); ${fleetDeform} carry _deformation.`);
  console.log(`  by route:  A=${routeTotals.A || 0}  B=${routeTotals.B || 0}  both=${routeTotals.both || 0}`);
  console.log(`  by rung:   curved=${rungTotals.curved}  split=${rungTotals.split}  sheaf=${rungTotals.sheaf}  spherulite=${rungTotals.spherulite}`);
  if (mineralsAccrued.size) {
    const byM = [...mineralsAccrued.entries()].sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${m}×${n}`).join('  ');
    console.log(`  minerals:  ${byM}`);
  }
  // σ + index distributions — the 4a.7 calibration instrument. Pick
  // SPLIT_SIGMA_SPHERULITE at the high end of the σ spread (the SI≈2–3 image),
  // and the band cuts against the index spread, so the ladder distributes.
  const pct = (arr, p) => {
    if (!arr.length) return NaN;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p / 100 * s.length)))];
  };
  const fmt = (arr) => arr.length
    ? `min ${pct(arr, 0).toFixed(2)}  p25 ${pct(arr, 25).toFixed(2)}  med ${pct(arr, 50).toFixed(2)}  p75 ${pct(arr, 75).toFixed(2)}  p95 ${pct(arr, 95).toFixed(2)}  max ${pct(arr, 100).toFixed(2)}`
    : '—';
  console.log(`  σ spread:  ${fmt(sigmaSamples)}`);
  console.log(`  idx spread: ${fmt(indexSamples)}`);
  // Full (UNtruncated) rung × mineral — the calibration matrix. Only minerals
  // that reach a real rung (curved+) shown; sorted by highest rung reached.
  console.log('  rung × mineral (curved/split/sheaf/spherulite; none omitted):');
  const rank = (rm) => (rm.spherulite ? 4 : rm.sheaf ? 3 : rm.split ? 2 : rm.curved ? 1 : 0);
  const rows2 = [...rungByMineral.entries()]
    .filter(([, rm]) => rm.curved || rm.split || rm.sheaf || rm.spherulite)
    .sort((a, b) => rank(b[1]) - rank(a[1]) || a[0].localeCompare(b[0]));
  for (const [m, rm] of rows2) {
    const parts = [];
    if (rm.curved) parts.push(`curved×${rm.curved}`);
    if (rm.split) parts.push(`split×${rm.split}`);
    if (rm.sheaf) parts.push(`sheaf×${rm.sheaf}`);
    if (rm.spherulite) parts.push(`spherulite×${rm.spherulite}`);
    if (rm.none) parts.push(`(none×${rm.none})`);
    console.log(`    ${m.padEnd(14)} ${parts.join('  ')}`);
  }
}

// The split-able roster gap: minerals that CAN split (splitAbility > 0) and are
// present, but did NOT accrue — informative, not a failure (their conditions did
// not cross either route).
const dormant = [...splitAbleSeen.entries()]
  .filter(([, v]) => v.accrued === 0)
  .map(([m, v]) => `${m}(×${v.present})`)
  .sort();
if (dormant.length) {
  console.log(`\nSPLIT-ABLE BUT DORMANT (present, splitAbility>0, no accrual — conditions never crossed a route):`);
  console.log('  ' + dormant.join('  '));
}

// ── THE NONCOLLISION CERTIFICATE (required S-a gate, boss §9a #4) ──────────────
// Guards the SADDLE specifically: a growth-split saddle (CURVED rung) must not
// also be a shear-bent saddle. Two causes, one visual habit — that is the
// forbidden ambiguity. Higher split rungs (spherulite/sheaf) that co-occur with
// a deformation event are a legible SEQUENCE, reported in the broad-overlap line.
console.log(`\n${'='.repeat(80)}`);
console.log('NONCOLLISION CERTIFICATE — growth-split SADDLE (curved rung)  vs  deformation bend');
if (!collisions.length) {
  console.log('  PASS ✓  No curved-rung (saddle) crystal also carries a deformation bend.');
  console.log('          The two saddle mechanisms — growth-split (A-route) and post-growth');
  console.log('          shear — do not collide, so S-b may earn split-saddle without');
  console.log('          re-tagging any shear-bent crystal (the two-mechanism invariant).');
} else {
  console.log(`  FAIL ✗  ${collisions.length} curved-rung crystal(s) ALSO carry a deformation bend —`);
  console.log('          S-b must decide which mechanism owns the saddle (deformation takes');
  console.log('          precedence; exclude _deformation-tagged crystals from split-saddle):');
  for (const c of collisions) {
    console.log(`            ${c.scenario} #${c.id} ${c.mineral}: split rung=${c.rung} route=${c.route}  ×  deform=${c.deform}`);
  }
}
// Informational: the broad any-rung overlap (a spherulite/sheaf that also got
// deformed — a sequence, not a collision). Named so S-b is aware of it.
if (fleetOverlap) {
  console.log(`\n  note — ${fleetOverlap} non-saddle overlap(s) (split + deformation on one crystal, a`);
  console.log('         legible sequence, NOT a certificate failure):');
  for (const c of overlaps) {
    console.log(`            ${c.scenario} #${c.id} ${c.mineral}: split rung=${c.rung} route=${c.route}  ×  deform=${c.deform}`);
  }
}

console.log(`\nPRE-REGISTRATION: when S-b flips O5_SPLITTING_ENABLED, ONLY the ${fleetSplit} crystal(s)`);
console.log('listed above may move in the baseline; all others must stay byte-identical.');
console.log('');

// Non-zero exit on certificate failure so a future CI hook can gate on it.
process.exit(collisions.length ? 1 : 0);
