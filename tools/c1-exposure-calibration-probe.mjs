// tools/c1-exposure-calibration-probe.mjs — C1 / O1a calibration stage. Reads
// the per-crystal _o1aExp base/tip integral the classifyWulffForm accumulator
// now writes, and reports the kExp distribution across the Wulff-tenant fleet
// under candidate SCALE values — so KEXP_SCALE is placed on the sim's OWN scale
// (the 4a.7 recipe: calibrate at the renderer's true parameters, then sweep),
// not transcribed. Commits nothing.
//
// The old fleet-wide constant was kExp=0.18 for EVERY fluid Wulff crystal. This
// shows what fraction the real field would leave near-isotropic vs materially
// exposed, and where the old 0.18 lands in the new distribution.
//
// Usage: node tools/c1-exposure-calibration-probe.mjs [--seed 42]

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, o1aExposureK, O1A_EXP } =
  await loadSimBundle({ toolName: 'c1-exposure-calibration-probe', extraExports: ['o1aExposureK', 'O1A_EXP'] });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;

const kExpAt = (ratio, scale, max) => Math.max(0, Math.min(max, scale * (1 - ratio)));

const rows = [];
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  for (let s = 0; s < steps; s++) sim.run_step();
  for (const c of sim.crystals) {
    if (!c || c.dissolved) continue;
    const acc = c._o1aExp;
    if (!acc || !(acc.G > 0)) continue;      // only fluid tenants the accumulator touched
    const s0 = acc.s0G / acc.G, sD = acc.sDG / acc.G;
    if (!(sD > 0)) continue;
    rows.push({ scen, id: c.crystal_id, mineral: c.mineral, ratio: s0 / sD, kExp: o1aExposureK(c) });
  }
}

const q = (arr, p) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.round(p * (a.length - 1)))];
};
const stat = (arr) => arr.length
  ? `n=${String(arr.length).padStart(3)} min=${q(arr, 0).toFixed(3)} q25=${q(arr, 0.25).toFixed(3)} med=${q(arr, 0.5).toFixed(3)} q75=${q(arr, 0.75).toFixed(3)} max=${q(arr, 1).toFixed(3)}`
  : 'n=0';

console.log(`\nC1 / O1a exposure calibration — Wulff-tenant fleet (seed ${SEED}).`);
console.log(`Shipped: SCALE=${O1A_EXP.KEXP_SCALE} MAX=${O1A_EXP.KEXP_MAX} DEFAULT=${O1A_EXP.KEXP_DEFAULT}\n`);
console.log(`fleet base/tip σ ratio : ${stat(rows.map((r) => r.ratio))}`);
console.log(`fleet kExp (shipped)   : ${stat(rows.map((r) => r.kExp))}`);
const iso = rows.filter((r) => r.kExp < 0.05).length;
const mod = rows.filter((r) => r.kExp >= 0.05 && r.kExp < 0.18).length;
const strong = rows.filter((r) => r.kExp >= 0.18).length;
console.log(`\ndistribution vs old constant 0.18:`);
console.log(`  isotropic  (kExp<0.05) : ${iso}  (${(100 * iso / Math.max(1, rows.length)).toFixed(0)}%)  — the calm majority the constant over-asymmetrized`);
console.log(`  moderate   (0.05–0.18) : ${mod}  (${(100 * mod / Math.max(1, rows.length)).toFixed(0)}%)`);
console.log(`  strong     (kExp≥0.18) : ${strong}  (${(100 * strong / Math.max(1, rows.length)).toFixed(0)}%)  — the starved few the constant under-asymmetrized`);

console.log(`\nSCALE sweep (kExp median / % strong≥0.18 / % isotropic<0.05):`);
for (const scale of [0.18, 0.24, 0.30, 0.36, 0.45, 0.60]) {
  const ks = rows.map((r) => kExpAt(r.ratio, scale, O1A_EXP.KEXP_MAX));
  const st = ks.filter((k) => k >= 0.18).length, is = ks.filter((k) => k < 0.05).length;
  console.log(`  SCALE=${scale.toFixed(2)}  med=${q(ks, 0.5).toFixed(3)}  strong=${(100 * st / Math.max(1, ks.length)).toFixed(0)}%  iso=${(100 * is / Math.max(1, ks.length)).toFixed(0)}%`);
}

console.log(`\nby mineral (median base/tip, median kExp, n):`);
const byMin = new Map();
for (const r of rows) { if (!byMin.has(r.mineral)) byMin.set(r.mineral, []); byMin.get(r.mineral).push(r); }
for (const [m, arr] of [...byMin.entries()].sort((a, b) => q(a[1].map((r) => r.ratio), 0.5) - q(b[1].map((r) => r.ratio), 0.5))) {
  console.log(`  ${m.padEnd(12)} n=${String(arr.length).padStart(3)}  base/tip=${q(arr.map((r) => r.ratio), 0.5).toFixed(3)}  kExp=${q(arr.map((r) => r.kExp), 0.5).toFixed(3)}`);
}
