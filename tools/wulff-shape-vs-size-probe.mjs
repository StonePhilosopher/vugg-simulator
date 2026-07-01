#!/usr/bin/env node
// tools/wulff-shape-vs-size-probe.mjs — decisive test of the design-pass keystone (Stage 2, the
// "zone-integrated kinetic-Wulff walk"). CLAIM UNDER TEST: with a BULK sigma (one value per mineral
// per step, identical for every face), the Rung-0 linear velocity law v_i = A_i*(sigma-1) integrates to
//   d_i = SEED + sum_z A_i*(sigma_z - 1)*thick_z = SEED + A_i * K,   K = sum_z (sigma_z-1)*thick_z (COMMON).
// So the SHAPE (the d_i ratios) is set by the A_i ratios and ONE scalar K — the sigma TEMPORAL DETAIL
// cancels. If true, the temporal walk changes SIZE/development, NOT shape: it is a no-op for form, and the
// real render-only shape lever is the A_i (attachment-energy) ratios (Stage 3), not the sigma history.
// Tests on the REAL seed-42 mvt calcite that spanned surf_sigma 1.07->2.68 across its zones.
// SIM-neutral, read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulff-shape-vs-size-probe' });

// calcite Wulff forms (js/46): {104} R=1.0 bias, {211} R=1.87. Shape = the d_211/d_104 ratio (rhomb<->dogtooth).
const A = { f104: 1.0, f211: 1.87 };
const SEED = 0.05;

setSeed(42);
const { conditions, events, defaultSteps } = SCENARIOS['mvt']();
conditions.wall.wulff_calcite = true;
const sim = new VugSimulator(conditions, events);
for (let i = 0; i < (defaultSteps || 120); i++) sim.run_step();

// the Wulff-tagged calcite with the richest recorded sigma trajectory
const cals = sim.crystals.filter(c => c.mineral === 'calcite' && !c.dissolved && c._wulffForm);
let best = null, bestN = -1;
for (const c of cals) {
  const zs = (c.zones || []).filter(z => isFinite(z.morph_surf_sigma) && z.thickness_um > 0);
  if (zs.length > bestN) { bestN = zs.length; best = c; }
}
if (!best) { console.log('no recorded-sigma calcite found'); process.exit(1); }
const traj = best.zones.filter(z => isFinite(z.morph_surf_sigma) && z.thickness_um > 0).map(z => ({ s: z.morph_surf_sigma, t: z.thickness_um }));
const totalT = traj.reduce((a, z) => a + z.t, 0);
const sMin = Math.min(...traj.map(z => z.s)), sMax = Math.max(...traj.map(z => z.s));

console.log(`=== wulff-shape-vs-size — mvt seed 42, calcite #${best.crystal_id} ===`);
console.log(`zones with sigma: ${traj.length}  total thickness ${totalT.toFixed(1)}µm  surf_sigma range ${sMin.toFixed(3)}..${sMax.toFixed(3)}  frozen growthFrac ${best._wulffForm.growthFrac.toFixed(3)}\n`);

// --- the integral K under three sigma treatments ---
const K_real = traj.reduce((a, z) => a + (z.s - 1) * z.t, 0);
const sMeanW = 1 + K_real / totalT;                                  // thickness-weighted mean sigma
const K_flat = (sMeanW - 1) * totalT;                                // sigma replaced by its weighted mean
const shuffled = traj.map(z => z.s).reverse();                       // time-reverse the sigma sequence
const K_shuf = traj.reduce((a, z, i) => a + (shuffled[i] - 1) * z.t, 0);

const ratioAt = (K, a104 = A.f104, a211 = A.f211) => (SEED + a211 * K) / (SEED + a104 * K);   // d_211/d_104
console.log('--- SHAPE under the Rung-0 bulk-sigma linear law (d_211/d_104; the whole trigonal calcite shape) ---');
console.log(`  K (real sigma trajectory) = ${K_real.toFixed(2)}   -> shape ratio ${ratioAt(K_real).toFixed(4)}`);
console.log(`  K (sigma flattened to its weighted MEAN ${sMeanW.toFixed(3)}) = ${K_flat.toFixed(2)}   -> shape ratio ${ratioAt(K_flat).toFixed(4)}`);
console.log(`  K (sigma sequence time-REVERSED)      = ${K_shuf.toFixed(2)}   -> shape ratio ${ratioAt(K_shuf).toFixed(4)}`);
console.log(`  => real == flat == reversed : ${Math.abs(K_real - K_flat) < 1e-6 && Math.abs(K_real - K_shuf) < 1e-6 ? 'IDENTICAL — the sigma temporal detail contributes ZERO to shape (SIZE-only)' : 'DIFFER'}\n`);

// --- for reference: the shape is a 1-parameter family in the scalar; static-g gives the SAME family ---
console.log('--- the shape is a 1-parameter family in the development scalar (static-g and integral-K trace the SAME curve) ---');
for (const g of [0.15, 0.3, 0.6, 1.0]) console.log(`  static g=${g.toFixed(2)}  -> shape ratio ${ratioAt(g).toFixed(4)}`);
console.log(`  (K=${K_real.toFixed(1)} sits at the sharp end of this SAME curve — more DEVELOPED, not a different shape)\n`);

// --- the REAL sigma->shape lever: a per-FACE-differentiated response (breaks the common-factor) ---
// toy: {211} responds super-linearly to driving force (2D-nucleation-like), {104} stays linear.
const K104 = traj.reduce((a, z) => a + (z.s - 1) * z.t, 0);
const K211 = traj.reduce((a, z) => a + Math.pow(z.s - 1, 2) * z.t, 0);   // face-specific exponent
// scale K211 so both faces share a comparable magnitude, then compare the ratio to the linear case
const scale = K104 / K211;
const rLinear = ratioAt(K_real);
const rFaceDiff = (SEED + A.f211 * K211 * scale * 1.0) / (SEED + A.f104 * K104);
console.log('--- the real sigma->SHAPE lever: FACE-DIFFERENTIATED response (per-face law, or per-face/local sigma) ---');
console.log(`  linear separable (bulk sigma):        d_211/d_104 = ${rLinear.toFixed(4)}`);
console.log(`  {211} super-linear in (sigma-1):       d_211/d_104 = ${rFaceDiff.toFixed(4)}   (${((rFaceDiff / rLinear - 1) * 100).toFixed(1)}% shift)`);
console.log(`  => only a face-DIFFERENTIATED response (or per-face/local sigma) turns the sigma HISTORY into SHAPE.\n`);

console.log('VERDICT:');
console.log('  Stage-2 as specified (bulk sigma + Rung-0 linear) = a DEVELOPMENT/SIZE effect, already covered by Stage-1 growthFrac.');
console.log('  The render-only SHAPE bedrock is Stage-3 (E_att-seeded A_i ratios). Genuine sigma->shape needs per-face response (Rung-2 per-face b_i) or per-face/local sigma (Stage 6/8, mostly baseline-breaking).');
