// tools/o2-contact-probe.mjs — observe-before-commit for W-F O2 (induction
// surfaces). PROPOSAL-ONTOGENY risk #1: "budget a probe before committing."
//
// THE QUESTION
// ------------
// O2 clips interpenetrating neighbor crystals at their growth-rate-weighted
// meeting plane and retags the shared facet `contact` (matte, no euhedral
// gloss). Before writing the pairwise-clip renderer, three things must be
// MEASURED, not assumed:
//   1. Does interpenetration actually happen, and how much? If nucleation
//      already spaces crystals out, O2 has nothing to clip and no payoff.
//   2. Cost envelope: how many crystals sit in >=1 contact (each needs its
//      OWN geometry — bypassing the per-FORM geomCache), and what is the
//      worst-case neighbor count for one crystal (extra half-spaces fed to
//      wulffPolyhedron, whose vertex enumeration is O(planes^3)).
//   3. Which scenarios are the dense druses worth an eye-check.
//
// METHOD — faithful renderer placement, replicated offline
// --------------------------------------------------------
// Mirrors js/99i's per-crystal placement EXACTLY (the anchor math at ~3888,
// the O0 occlusion sink at ~3952/4418, the size floors at ~4357): world
// centre = anchor + cAxis*(cLen*(0.5-occF)); the wall methods come off
// sim.wall_state, _topoCAxisForCrystal/_resolveCrystalGeomToken are captured
// globals. No THREE — placement is pure vector math; geometry emission (the
// only THREE consumer) isn't needed to count overlaps.
//
// Overlap is bracketed so the conclusion is honest regardless of the
// bounding-body model: r_tight = 0.5*max(aWid,cLen) (a sphere INSIDE the box,
// under-counts) and r_diag = 0.5*sqrt(2*aWid^2 + cLen^2) (the box's
// circumscribed sphere, over-counts). If even r_tight shows many contacts, O2
// clearly has work; if even r_diag shows ~none, it doesn't.
//
// Usage: node tools/o2-contact-probe.mjs  [--seed N]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'o2-contact-probe',
  extraExports: ['_topoCAxisForCrystal', '_resolveCrystalGeomToken'],
});

// C_FLOOR / A_FLOOR from js/99i:4357 (non-replay path).
const C_FLOOR = 2.0, A_FLOOR = 1.5;

// The O0 equant-closed set from js/99i:3954 — these sink to occF 0.5 (half-form
// centred at the nucleus), everything else is base-at-anchor (occF 0).
const O0_EQUANT = new Set(['cube', 'octahedron', 'rhomb', 'scalene', 'tablet', 'rhombic_dodec', 'dodecahedron']);

function placeCrystal(sim, wall, crystal) {
  if (!crystal || (crystal.dissolved && !crystal.perimorph_eligible)) return null;
  const anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
  if (!anchor) return null;                         // floaters/air/snowball skip, as the renderer does
  const ringCount = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  const initR = wall.initial_radius_mm || 25;
  let ringIdx = anchor.ringIdx;
  if (ringIdx == null || ringIdx < 0 || ringIdx >= ringCount) ringIdx = 0;
  const cellIdx = anchor.cellIdx;
  if (cellIdx == null) return null;
  const ring = wall.rings[ringIdx]; if (!ring) return null;
  const cell = ring[cellIdx]; if (!cell) return null;

  const phi = Math.PI * (ringIdx + 0.5) / ringCount;
  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
  const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0.0;
  const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
  const radiusMm = (baseR + cell.wall_depth) * polar;
  const theta = (2 * Math.PI * cellIdx) / N + twist;
  const ax = radiusMm * sinPhi * Math.cos(theta);
  const ay = -radiusMm * cosPhi;
  const az = radiusMm * sinPhi * Math.sin(theta);

  const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  const nx = -ax / len, ny = -ay / len, nz = -az / len;
  const [cx, cy, cz] = (typeof _topoCAxisForCrystal === 'function')
    ? _topoCAxisForCrystal(crystal, nx, ny, nz) : [nx, ny, nz];

  let cLen = Math.max(C_FLOOR, crystal.c_length_mm || 0);
  let aWid = Math.max(A_FLOOR, crystal.a_width_mm || 0);

  const token = (typeof _resolveCrystalGeomToken === 'function')
    ? _resolveCrystalGeomToken(crystal, crystal.habit) : (crystal.habit || 'prism');
  const simOccF = (crystal._occlusion && typeof crystal._occlusion.attachedFraction === 'number')
    ? crystal._occlusion.attachedFraction : null;
  const occF = simOccF != null ? simOccF
    : (O0_EQUANT.has(token) && crystal.growth_environment !== 'air' ? 0.5 : 0);

  const off = cLen * (0.5 - occF);
  const wx = ax + cx * off, wy = ay + cy * off, wz = az + cz * off;

  const rTight = 0.5 * Math.max(aWid, cLen);
  const rDiag = 0.5 * Math.sqrt(2 * aWid * aWid + cLen * cLen);
  // The clip only applies to Wulff-form tenants (the wulffPolyhedron path);
  // every other mineral renders a fixed primitive O2 can't half-space this cut.
  const WULFF_TENANTS = new Set(['fluorite', 'calcite', 'wulfenite', 'barite', 'galena', 'titanite']);
  const isWulff = !!crystal._wulffForm && WULFF_TENANTS.has(crystal.mineral);
  // The generic convex-mesh clipper reaches any crystal whose emitted form is a
  // single convex body: a plane cut then has ONE convex cap. Concave forms
  // (botryoidal, dripstone, frostwork, twins, and stepped/hoppered/etched
  // overprints) need a later, harder treatment — sized out here.
  const CONVEX_TOKENS = new Set(['cube', 'octahedron', 'rhomb', 'scalene', 'tablet', 'prism', 'spike', 'rhombic_dodec', 'dodecahedron']);
  const stepped = !!(crystal._etch || (crystal._deformation && crystal._deformation.kind === 'etwin'));
  const isConvex = CONVEX_TOKENS.has(token) && !stepped;
  return { mineral: crystal.mineral, token, wx, wy, wz, cLen, aWid, rTight, rDiag, isWulff, isConvex };
}

function probe(name) {
  const scn = SCENARIOS[name];
  if (!scn) return null;
  setSeed(SEED);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 100;
  for (let i = 0; i < total; i++) sim.run_step();
  const wall = sim.wall_state;

  const bodies = [];
  for (const c of sim.crystals) {
    const b = placeCrystal(sim, wall, c);
    if (b) bodies.push(b);
  }
  const n = bodies.length;
  let pairs = 0, tight = 0, diag = 0;
  const nbTight = new Array(n).fill(0);
  const depths = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs++;
      const bi = bodies[i], bj = bodies[j];
      const dx = bi.wx - bj.wx, dy = bi.wy - bj.wy, dz = bi.wz - bj.wz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bi.rDiag + bj.rDiag) diag++;
      if (d < bi.rTight + bj.rTight) {
        tight++; nbTight[i]++; nbTight[j]++;
        const overlap = (bi.rTight + bj.rTight) - d;
        depths.push(overlap / Math.min(2 * bi.rTight, 2 * bj.rTight));   // as frac of smaller body
      }
    }
  }
  const contacted = nbTight.filter(x => x > 0).length;
  const maxNb = nbTight.reduce((a, b) => Math.max(a, b), 0);
  // The O2-this-cut subset: Wulff-form crystals that are contacted (clipped
  // against any-mineral neighbours), and their worst neighbour count.
  let wContacted = 0, wMaxNb = 0, cxContacted = 0, cxMaxNb = 0;
  for (let i = 0; i < n; i++) {
    if (nbTight[i] > 0) {
      if (bodies[i].isWulff) { wContacted++; if (nbTight[i] > wMaxNb) wMaxNb = nbTight[i]; }
      if (bodies[i].isConvex) { cxContacted++; if (nbTight[i] > cxMaxNb) cxMaxNb = nbTight[i]; }
    }
  }
  depths.sort((a, b) => a - b);
  const medDepth = depths.length ? depths[depths.length >> 1] : 0;
  const maxDepth = depths.length ? depths[depths.length - 1] : 0;
  return { name, n, pairs, tight, diag, contacted, maxNb, wContacted, wMaxNb, cxContacted, cxMaxNb, medDepth, maxDepth };
}

const rows = [];
for (const name of Object.keys(SCENARIOS)) {
  try { const r = probe(name); if (r) rows.push(r); }
  catch (e) { rows.push({ name, err: String(e).slice(0, 60) }); }
}
rows.sort((a, b) => (b.tight || 0) - (a.tight || 0));

console.log(`\nW-F O2 interpenetration census — seed ${SEED}, all scenarios run to completion.`);
console.log('tight = spheres inside the boxes (under-count); diag = circumscribed spheres (over-count).');
console.log('contacted = crystals in >=1 tight contact = per-instance geoms O2 must build (cache pressure).');
console.log('maxNb = worst-case neighbor count for one crystal = extra half-spaces to wulffPolyhedron.\n');
console.log('scenario                          N   tight  contacted maxNb || convex-contacted convex-maxNb  medDepth');
console.log('--------------------------------- --- ------ --------- ----- || ---------------- ------------ --------');
let TN = 0, Ttight = 0, Tcontact = 0, Tmax = 0, TwContact = 0, TcxContact = 0, TcxMax = 0;
for (const r of rows) {
  if (r.err) { console.log(`${r.name.padEnd(33)} ERR ${r.err}`); continue; }
  TN += r.n; Ttight += r.tight; Tcontact += r.contacted; Tmax = Math.max(Tmax, r.maxNb);
  TwContact += r.wContacted; TcxContact += r.cxContacted; TcxMax = Math.max(TcxMax, r.cxMaxNb);
  console.log(
    `${r.name.padEnd(33)} ${String(r.n).padStart(3)} ${String(r.tight).padStart(6)} ` +
    `${String(r.contacted).padStart(9)} ${String(r.maxNb).padStart(5)} || ` +
    `${String(r.cxContacted).padStart(16)} ${String(r.cxMaxNb).padStart(12)} ${(r.medDepth * 100).toFixed(0).padStart(7)}%`);
}
console.log('--------------------------------- --- ------ --------- ----- || ---------------- ------------ --------');
console.log(`FLEET: ${TN} crystals, ${Ttight} tight contacts, ${Tcontact} contacted, worst nb ${Tmax}.`);
console.log(`O2 GENERIC CLIP reaches CONVEX crystals: ${TcxContact} contacted need per-instance geoms, worst neighbor count ${TcxMax}.`);
console.log(`  (Wulff-form subset within that: ${TwContact}. Concave forms — botryoidal/hopper/twin — deferred.)`);
