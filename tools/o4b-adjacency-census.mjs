// tools/o4b-adjacency-census.mjs — W-F O4b instrument (pre-registration census).
//
// ⚠ HISTORICAL — valid against SIM ≤ 220 only. This probe's gate replica and
// self-check pin the STRING mechanic this census existed to indict; the bump
// (SIM 221) replaced the live gate with the geometric one, so running this
// against v221+ fails the self-check BY DESIGN (the probe predicts string-world
// enactment; the live world no longer enacts it). The living enclosure
// instrument is tools/o4-enclosure-census.mjs. Kept as the pre-registration
// record the v221 baseline movers were judged against.
//
// The enclosure mechanic's adjacency gate (js/85c _check_enclosure) is a STRING
// test:   candidate.position === grower.position
//      || candidate.position.includes(`#${grower.crystal_id}`)
// Every free-wall crystal holds the literal 'vug wall', so branch 1 is true for
// ANY two free-wall crystals regardless of where they sit — an opposite-wall
// "swallow" passes. Branch 2 is a substring test — '#1' matches '#12'. And a
// guest nucleated on crystal A beside giant host B fails both branches, blocking
// a geologically correct lateral swallow.
//
// O4b replaces the gate with geometry the sim already owns: wall anchors
// (ring/cell → φ,θ on the sphere) and paintCrystal's own footprint law
// (half-arc = size_mm × wall_spread × FOOTPRINT_SCALE / 2). Before the bump,
// this probe runs every scenario at the canonical seed and records BOTH verdicts
// for every candidate pair that passes the non-adjacency gates, so each baseline
// mover is pre-registered:
//
//   CONFIRMED  string ✓  geom ✓   — enclosure survives the bump
//   DEFERRED   string ✓, geom ✗ at enactment, but the host's growing footprint
//              REACHES the guest's (fixed) anchor by run's end — post-bump the
//              swallow still happens, just LATER (lag reported in steps)
//   PHANTOM    string ✓, geom ✗ and never reached — geometrically absurd; stops
//   MISSED     string ✗  geom ✓   — blocked today, will fire post-bump
//   SUBSTRING  #-branch true but exact-ID parse disagrees (the '#1' vs '#12' bug)
//
// plus the coats_front split (guest nucleated ON the grower = front-coating,
// routes to O5; else embedded-inert, stays poikilotopic O4).
//
// FIRST-ORDER honesty: verdict flips alter the run's own future (caps, O3
// exemptions, active flags), so post-bump dynamics diverge beyond what any
// pre-run census can enumerate. These numbers name WHICH scenarios move and
// WHY; the exact movement is judged by baseline-diff at bump time.
//
// COUNTING: every class is deduped by CANDIDATE at first occurrence. Enacted
// classes (confirmed/phantom) are naturally one-shot — the live mechanic sets
// enclosed_by and the pair leaves the pool — but a MISSED pair stays eligible
// and would otherwise re-tally every remaining step (first cut of this tool
// reported pair-STEPS, 1222 vs ~a hundred real pairs). First-occurrence dedupe
// also approximates the geom world's own one-shot enactment.
//
// Pure read: the recorder consumes no RNG and mutates no sim state (shadow
// marking uses local Sets). The live trajectory is byte-identical to an
// uninstrumented run. SELF-CHECK: after the real _check_enclosure fires, the
// enacted set is compared against the rows predicted string-true; any mismatch
// means the probe's gate replica drifted from the live mechanic → exit 1
// (a probe that can't reproduce the mechanic has no business pre-registering it).
//
// Usage: node tools/o4b-adjacency-census.mjs [--seed N] [--steps N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const stepsArg = process.argv.indexOf('--steps');
const STEPS_OVERRIDE = stepsArg >= 0 ? parseInt(process.argv[stepsArg + 1], 10) : null;
const VERBOSE = process.argv.includes('--verbose');

// Mirrors paintCrystal (js/22): arcMm = size × max(spread, 0.05) × 4.0, painted
// as halfCells = max(1, round(arc/cellArc/2)) — the min-1 floor means every
// crystal claims at least ~one cell either side; carry that floor in mm.
const FOOTPRINT_SCALE = 4.0;
function halfArcMm(c, cellArcMm) {
  const arc = (c.total_growth_um / 1000) * Math.max(c.wall_spread ?? 0.5, 0.05) * FOOTPRINT_SCALE;
  return Math.max(arc / 2, cellArcMm);
}

// Mirrors parsePositionHost (js/26) — exact-ID anchor '<word> #<digits>'.
function positionHostId(position) {
  if (!position || typeof position !== 'string') return null;
  const m = position.match(/([a-z_]+)\s+#(\d+)/i);
  return m ? parseInt(m[2], 10) : null;
}

// Great-circle distance between two wall anchors. φ is COLATITUDE (0..π).
function anchorDistanceMm(wall, a, b) {
  const A = wall._anchorFromRingCell(a.ringIdx, a.cellIdx);
  const B = wall._anchorFromRingCell(b.ringIdx, b.cellIdx);
  const cosD = Math.cos(A.phi) * Math.cos(B.phi)
    + Math.sin(A.phi) * Math.sin(B.phi) * Math.cos(A.theta - B.theta);
  const R = (wall.cell_arc_mm * wall.cells_per_ring) / (2 * Math.PI);
  return R * Math.acos(Math.max(-1, Math.min(1, cosD)));
}

const bundle = await loadSimBundle({ toolName: 'o4b-adjacency-census' });
const { SCENARIOS, VugSimulator, setSeed } = bundle;

const scenarioRows = [];
let selfCheckFailures = 0;

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = STEPS_OVERRIDE ?? scen.defaultSteps ?? 100;

  const tally = {
    name,
    confirmed: 0, phantom: 0, missed: 0, substring: 0,
    front: 0, embedded: 0,           // coats_front split over confirmed+missed (the post-bump world)
    phantomSame: 0, phantomHash: 0,  // which string branch enacted the phantom
    unanchored: 0,
    distConfirmed: [], distPhantom: [], distMissed: [],
    deferredLags: [],                // steps between live enactment and geometric reach
    samples: [],                     // capped pair records for --verbose
  };
  const seenCandidate = new Set();   // run-wide dedupe: first verdict per candidate wins
  const phantomWatch = [];           // live-enacted, geom-false pairs still awaiting reach

  // Instrument: replicate the candidate loop on the same pre-state the real
  // mechanic is about to act on, with SHADOW sequential marking (two worlds:
  // string = what live does this step, geom = what the post-bump gate would
  // do this step). Then call the real mechanic and self-check against it.
  const realCheck = sim._check_enclosure.bind(sim);
  sim._check_enclosure = function instrumentedCheck() {
    const wall = this.wall_state;
    const cellArc = wall.cell_arc_mm;

    // Deferred tracking: anchors never move, so distance is fixed — only the
    // hosts' footprints grow. Re-test each watched phantom against CURRENT
    // sizes; the first step reach ≥ distance reclassifies it deferred.
    for (const w of phantomWatch) {
      if (w.resolved) continue;
      const reach = halfArcMm(w.grower, cellArc) + halfArcMm(w.cand, cellArc) + cellArc;
      if (w.dist <= reach) {
        w.resolved = true;
        tally.phantom--;
        if (w.branchSame) tally.phantomSame--; else tally.phantomHash--;
        tally.deferredLags.push(this.step - w.step);
        tally.embedded++;   // a lateral reach, by construction not substrate-linked
      }
    }

    const shadowString = new Set();   // candidate ids enclosed this step, string world
    const shadowGeom = new Set();     // candidate ids enclosed this step, geom world
    const predicted = [];             // what live will enact (for the self-check)

    for (const grower of this.crystals) {
      if (!grower.active || grower.c_length_mm < 0.5) continue;
      if (grower.enclosed_by != null) continue;
      const growerSize = grower.total_growth_um / 1000;
      for (const candidate of this.crystals) {
        if (candidate.crystal_id === grower.crystal_id) continue;
        if (candidate.enclosed_by != null) continue;
        if (candidate._buried) continue;
        if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;
        const candidateSize = candidate.total_growth_um / 1000;
        const sizeRatio = growerSize / Math.max(candidateSize, 0.001);
        if (!candidate.zones || candidate.zones.length < 3) continue;
        const recent = candidate.zones.slice(-3).reduce((s, z) => s + z.thickness_um, 0);
        if (!(recent < 3.0)) continue;
        if (!(sizeRatio > 3.0)) continue;

        // ---- both verdicts on identical pre-state ----
        const stringSame = candidate.position === grower.position;
        const stringHash = candidate.position.includes(`#${grower.crystal_id}`);
        const stringAdj = (stringSame || stringHash) && !shadowString.has(candidate.crystal_id);

        const candHostId = positionHostId(candidate.position);
        const growerHostId = positionHostId(grower.position);
        const linkCandOnGrower = candHostId === grower.crystal_id;
        const linkGrowerOnCand = growerHostId === candidate.crystal_id;
        const substringAccident = stringHash && candHostId != null && !linkCandOnGrower;

        const aG = wall._resolveAnchor(grower);
        const aC = wall._resolveAnchor(candidate);
        let distMm = null, reachMm = null;
        let geomNear = false;
        if (aG && aC) {
          distMm = anchorDistanceMm(wall, aG, aC);
          reachMm = halfArcMm(grower, cellArc) + halfArcMm(candidate, cellArc) + cellArc;
          geomNear = distMm <= reachMm;
        } else {
          tally.unanchored++;
        }
        const geomAdj = (linkCandOnGrower || linkGrowerOnCand || geomNear)
          && !shadowGeom.has(candidate.crystal_id);

        if (stringAdj) shadowString.add(candidate.crystal_id);
        if (geomAdj) shadowGeom.add(candidate.crystal_id);
        if (stringAdj) predicted.push(candidate.crystal_id);
        if (substringAccident && stringAdj && !stringSame) tally.substring++;

        let klass = null;
        if (stringAdj && geomAdj) klass = 'confirmed';
        else if (stringAdj && !geomAdj) klass = 'phantom';
        else if (!stringAdj && geomAdj) klass = 'missed';
        if (!klass) continue;
        if (seenCandidate.has(candidate.crystal_id)) continue;
        seenCandidate.add(candidate.crystal_id);

        tally[klass]++;
        if (klass === 'phantom') {
          if (stringSame) tally.phantomSame++; else tally.phantomHash++;
          if (distMm != null) {
            phantomWatch.push({
              grower, cand: candidate, dist: distMm, step: this.step,
              branchSame: stringSame, resolved: false,
            });
          }
        }
        if (klass !== 'phantom') {
          if (linkCandOnGrower) tally.front++; else tally.embedded++;
        }
        if (distMm != null) {
          if (klass === 'confirmed') tally.distConfirmed.push(distMm);
          else if (klass === 'phantom') tally.distPhantom.push(distMm);
          else tally.distMissed.push(distMm);
        }
        if (tally.samples.length < 40) {
          tally.samples.push({
            step: this.step, klass,
            grower: `${grower.mineral} #${grower.crystal_id} (${growerSize.toFixed(1)}mm)`,
            guest: `${candidate.mineral} #${candidate.crystal_id} (${candidateSize.toFixed(2)}mm)`,
            dist: distMm != null ? distMm.toFixed(1) : '—',
            reach: reachMm != null ? reachMm.toFixed(1) : '—',
            coats: linkCandOnGrower ? 'front' : 'embedded',
          });
        }
      }
    }

    const before = new Set(
      this.crystals.filter((c) => c.enclosed_by != null).map((c) => c.crystal_id));
    realCheck();
    const enacted = this.crystals
      .filter((c) => c.enclosed_by != null && !before.has(c.crystal_id))
      .map((c) => c.crystal_id).sort((x, y) => x - y);
    const want = [...new Set(predicted)].sort((x, y) => x - y);
    if (enacted.join(',') !== want.join(',')) {
      selfCheckFailures++;
      console.error(`[SELF-CHECK FAIL] ${name} step ${this.step}: ` +
        `live enacted [${enacted}] but probe predicted [${want}]`);
    }
  };

  for (let i = 0; i < steps; i++) sim.run_step();
  // Phantom dist entries whose pair later resolved to deferred no longer
  // describe a phantom — rebuild the array from the unresolved watch.
  tally.distPhantom = phantomWatch.filter((w) => !w.resolved).map((w) => w.dist);
  if (tally.confirmed || tally.phantom || tally.missed || tally.deferredLags.length) {
    scenarioRows.push(tally);
  }
}

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmtP = (arr) => arr.length
  ? `${pct(arr, 0).toFixed(1)}/${pct(arr, 0.5).toFixed(1)}/${pct(arr, 1).toFixed(1)}`
  : '—';

console.log(`\nO4b ADJACENCY-TRUTH CENSUS — seed ${SEED} (string gate vs geometric gate)`);
console.log('='.repeat(100));
if (!scenarioRows.length) {
  console.log('No enclosure-eligible pairs in any scenario at this seed.');
} else {
  console.log('scenario                    confirmed  DEFERRED(lag)  PHANTOM  MISSED  substr  front/embed   dist conf (min/med/max mm)');
  console.log('-'.repeat(112));
  scenarioRows.sort((a, b) => (b.phantom + b.missed) - (a.phantom + a.missed));
  const tot = { confirmed: 0, phantom: 0, missed: 0, substring: 0, front: 0, embedded: 0, deferred: 0 };
  for (const r of scenarioRows) {
    r.deferred = r.deferredLags.length;
    for (const k of Object.keys(tot)) tot[k] += r[k] || 0;
    const lagMed = r.deferredLags.length ? `~${pct(r.deferredLags, 0.5)}st` : '';
    console.log(
      `${r.name.padEnd(28)}  ${String(r.confirmed).padStart(7)}  ${String(r.deferred).padStart(6)}${lagMed.padEnd(7)}` +
      `  ${String(r.phantom).padStart(7)}  ${String(r.missed).padStart(6)}  ${String(r.substring).padStart(6)}` +
      `  ${String(r.front).padStart(5)}/${String(r.embedded).padEnd(5)}  ${fmtP(r.distConfirmed)}`,
    );
    if (r.phantom) {
      console.log(`${''.padEnd(28)}  · TRUE phantom: ${r.phantomSame} same-position, ` +
        `${r.phantomHash} #-substring · dist ${fmtP(r.distPhantom)} mm (never reached)`);
    }
    if (r.missed) {
      console.log(`${''.padEnd(28)}  · missed dist ${fmtP(r.distMissed)} mm`);
    }
  }
  console.log('-'.repeat(112));
  console.log(
    `TOTAL${''.padEnd(23)}  ${String(tot.confirmed).padStart(7)}  ${String(tot.deferred).padStart(6)}       ` +
    `  ${String(tot.phantom).padStart(7)}  ${String(tot.missed).padStart(6)}  ${String(tot.substring).padStart(6)}` +
    `  ${String(tot.front).padStart(5)}/${String(tot.embedded).padEnd(5)}`,
  );
  console.log('\nPost-bump world ≈ confirmed + missed (on time) + deferred (later, by the lag).');
  console.log('TRUE phantoms stop entirely. Scenarios listed move in the baseline sweep;');
  console.log('unlisted scenarios have zero eligible pairs and must hold byte-identical.');
  if (VERBOSE) {
    for (const r of scenarioRows) {
      console.log(`\n[${r.name}]`);
      for (const s of r.samples) {
        console.log(`  step ${String(s.step).padStart(3)}  ${s.klass.padEnd(9)} ` +
          `${s.guest} ← ${s.grower}  dist ${s.dist}mm vs reach ${s.reach}mm  [${s.coats}]`);
      }
    }
  }
}
if (selfCheckFailures) {
  console.error(`\n${selfCheckFailures} SELF-CHECK failure(s) — the probe's gate replica drifted from js/85c. Fix the probe before trusting any number above.`);
  process.exit(1);
}
console.log('');
