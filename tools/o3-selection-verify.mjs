// tools/o3-selection-verify.mjs — close the loop for W-F O3b: does the ENGINE'S
// geometric-selection burial reproduce the oracle's signatures on the real
// fleet? The standalone oracle (o3-selection-oracle.mjs) proved the LAW; this
// probe checks the sim against it and calibrates the burial dials.
//
// THE HONEST MEASUREMENT (controls for sim chemistry)
// ---------------------------------------------------
// The sim's crystal sizes vary for CHEMICAL reasons too (depletion, caps), so a
// raw survivor curve isn't a clean oracle match. The confound-free signal is
// the DIFFERENCE selection makes, ON vs OFF:
//   1. TILT-COLLAPSE — with selection ON, the SURVIVING population is more wall-
//      normal than the drawn population (⟨θ_survivor⟩ < ⟨θ_all⟩), and the buried
//      losers are the tilted ones (⟨θ_buried⟩ > ⟨θ_survivor⟩). Chemistry cannot
//      cause this; only geometric selection culls by orientation. This is the
//      decisive proof.
//   2. DENSITY THINS FASTER — the survivor-vs-height slope (log n(≥h) vs log h)
//      is MORE NEGATIVE with selection ON than OFF (the OFF slope is the pure
//      chemical size distribution; the extra steepening is selection, trending
//      toward Gray's −1/2).
//   3. SANE BURIED FRACTION — not ~0 (no effect) and not ~all (a bald druse);
//      a legible druse keeps its hero terminations (spec risk #2).
//
// Usage: node tools/o3-selection-verify.mjs [--lead FRAC] [--sweep] [--seed N]

import { loadSimBundle } from './_harness.mjs';

const leadArg = process.argv.indexOf('--lead');
const LEAD = leadArg >= 0 ? parseFloat(process.argv[leadArg + 1]) : null;
const SWEEP = process.argv.includes('--sweep');
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;

const bundle = await loadSimBundle({
  toolName: 'o3-selection-verify',
  extraExports: [
    'setGeometricSelectionEnabled', 'setO3BuryLeadFrac', 'setO3BuryDThetaMinDeg',
    'setO3BuryGraceSteps', 'o3NormalFrontMm',
  ],
});
const { SCENARIOS, VugSimulator, setSeed, setGeometricSelectionEnabled,
        setO3BuryLeadFrac, setO3BuryDThetaMinDeg, o3NormalFrontMm } = bundle;
const dthArg = process.argv.indexOf('--dtheta');
const DTHETA = dthArg >= 0 ? parseFloat(process.argv[dthArg + 1]) : null;
const DSWEEP = process.argv.includes('--dsweep');

const DEG = 180 / Math.PI;

function runAll(seed) {
  const crystals = [];
  const perScenario = [];
  for (const name of Object.keys(SCENARIOS).sort()) {
    setSeed(seed);
    let scen; try { scen = SCENARIOS[name](); } catch { continue; }
    const sim = new VugSimulator(scen.conditions, scen.events);
    const steps = scen.defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    let n = 0, buried = 0;
    for (const c of sim.crystals) {
      if (!c || !c._nucTilt) continue;
      if (c.dissolved) continue;
      const rec = {
        theta: c._nucTilt.theta, buried: c._buried === true,
        front: o3NormalFrontMm(c), name,
      };
      crystals.push(rec); n++; if (rec.buried) buried++;
    }
    perScenario.push({ name, n, buried });
  }
  return { crystals, perScenario };
}

function meanTilt(list) {
  if (!list.length) return NaN;
  return list.reduce((s, r) => s + r.theta, 0) / list.length * DEG;
}

// log n(≥h) vs log h slope over a front window.
function survivorSlope(fronts, lo, hi, bins = 24) {
  const sorted = fronts.filter((f) => f > 0).sort((a, b) => a - b);
  if (sorted.length < 8) return { slope: NaN, r2: NaN };
  const xs = [], ys = [];
  for (let i = 0; i < bins; i++) {
    const h = lo * Math.pow(hi / lo, i / (bins - 1));
    let cnt = 0; for (const f of sorted) if (f >= h) cnt++;
    if (cnt > 0) { xs.push(Math.log(h)); ys.push(Math.log(cnt)); }
  }
  const nn = xs.length; if (nn < 4) return { slope: NaN, r2: NaN };
  const mx = xs.reduce((s, v) => s + v, 0) / nn, my = ys.reduce((s, v) => s + v, 0) / nn;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < nn; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return { slope: sxy / sxx, r2: (sxy * sxy) / (sxx * syy || 1) };
}

function report(lead) {
  if (lead != null) setO3BuryLeadFrac(lead);

  setGeometricSelectionEnabled(false);
  const off = runAll(SEED);
  setGeometricSelectionEnabled(true);
  const on = runAll(SEED);
  setGeometricSelectionEnabled(false);   // leave the bundle in ship state

  const allOff = off.crystals;
  const survOn = on.crystals.filter((r) => !r.buried);
  const buriedOn = on.crystals.filter((r) => r.buried);
  const buriedFrac = on.crystals.length ? buriedOn.length / on.crystals.length : 0;

  // front windows from the data
  const frontsOff = allOff.map((r) => r.front).filter((f) => f > 0).sort((a, b) => a - b);
  const q = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : NaN;
  const lo = Math.max(0.3, q(frontsOff, 0.30)), hi = Math.max(lo * 2, q(frontsOff, 0.97));
  const slopeOff = survivorSlope(allOff.map((r) => r.front), lo, hi);
  const slopeOn = survivorSlope(survOn.map((r) => r.front), lo, hi);

  console.log(`\n# O3b SELECTION VERIFY  (lead frac=${(lead ?? 'default')}, seed ${SEED})`);
  console.log(`  crystals: ${on.crystals.length}   buried: ${buriedOn.length}  (${(buriedFrac * 100).toFixed(1)}%)`);
  console.log(`  ── TILT-COLLAPSE (the decisive selection signature) ──`);
  console.log(`    ⟨θ⟩ all (no selection)  : ${meanTilt(allOff).toFixed(1)}°`);
  console.log(`    ⟨θ⟩ SURVIVORS (selected): ${meanTilt(survOn).toFixed(1)}°   ← should be LOWER`);
  console.log(`    ⟨θ⟩ BURIED (culled)     : ${meanTilt(buriedOn).toFixed(1)}°   ← should be HIGHER`);
  const collapse = meanTilt(allOff) - meanTilt(survOn);
  console.log(`    survivor collapse Δ     : ${collapse.toFixed(1)}°  ${collapse > 1 ? '✓ selects toward normal' : '✗ no collapse'}`);
  console.log(`  ── DENSITY THINS FASTER (log n(≥h) vs log h, window ${lo.toFixed(1)}–${hi.toFixed(1)} mm) ──`);
  console.log(`    slope OFF (chem only)   : ${slopeOff.slope.toFixed(3)}  (R²=${slopeOff.r2.toFixed(2)})`);
  console.log(`    slope ON  (+selection)  : ${slopeOn.slope.toFixed(3)}  (R²=${slopeOn.r2.toFixed(2)})   ` +
              `${slopeOn.slope < slopeOff.slope - 0.02 ? '✓ steeper' : '≈ same'}`);
  console.log(`  ── BURIED FRACTION legibility (want ~10–40%) ──  ${
    buriedFrac >= 0.08 && buriedFrac <= 0.45 ? '✓ legible' : (buriedFrac < 0.08 ? '✗ too weak' : '✗ over-culls')}`);
  // Per-scenario: is burial CONCENTRATED in the dense druses (physically right —
  // isolated crystals don't compete) or spread thin everywhere?
  const bs = on.perScenario.filter((s) => s.n > 0).map((s) => ({ ...s, frac: s.buried / s.n }))
    .sort((a, b) => b.frac - a.frac);
  console.log('  ── per-scenario burial (top 10 by fraction) ──');
  for (const s of bs.slice(0, 10)) {
    console.log(`    ${s.name.padEnd(30)} ${String(s.buried).padStart(3)}/${String(s.n).padStart(3)}  ${(s.frac * 100).toFixed(0).padStart(3)}%`);
  }
  const nonzero = bs.filter((s) => s.buried > 0).length;
  console.log(`    (${nonzero}/${bs.length} scenarios show any burial)`);
  return { buriedFrac, collapse, slopeOn: slopeOn.slope, slopeOff: slopeOff.slope };
}

if (DSWEEP) {
  console.log('# θ-ADVANTAGE SWEEP — the SENSITIVE dial (lead fraction proved inert; burial is gated by whether');
  console.log('# a more-normal-enough neighbor EXISTS). Lower dθ ⇒ more pairs qualify ⇒ more burial.');
  const rows = [];
  for (const dt of [4, 6, 8, 12, 16, 22]) {
    setO3BuryDThetaMinDeg(dt);
    const r = report(null);
    rows.push({ dt, ...r });
  }
  setO3BuryDThetaMinDeg(8);
  console.log('\n# SWEEP SUMMARY');
  for (const r of rows) {
    console.log(`  dθ ${String(r.dt).padStart(2)}°: buried ${(r.buriedFrac * 100).toFixed(0).padStart(2)}%  collapse ${r.collapse.toFixed(1)}°  slopeΔ ${(r.slopeOn - r.slopeOff).toFixed(3)}`);
  }
} else if (SWEEP) {
  console.log('# LEAD-FRACTION SWEEP — buried% · collapseΔ · slopeΔ');
  const rows = [];
  for (const f of [0.20, 0.30, 0.40, 0.50, 0.60, 0.70]) rows.push({ f, ...report(f) });
  console.log('\n# SWEEP SUMMARY');
  for (const r of rows) console.log(`  lead ${r.f.toFixed(2)}: buried ${(r.buriedFrac * 100).toFixed(0)}%  collapse ${r.collapse.toFixed(1)}°`);
} else {
  if (DTHETA != null) setO3BuryDThetaMinDeg(DTHETA);
  report(LEAD);
}
