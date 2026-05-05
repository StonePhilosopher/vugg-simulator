// ============================================================
// js/33-supersat-halide.ts — supersaturation methods for halide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/halide.py. Minerals (2): fluorite, halite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_fluorite() {
  if (this.fluid.Ca < 10 || this.fluid.F < 5) return 0;
  let product = (this.fluid.Ca / 200.0) * (this.fluid.F / 20.0);
  // 5-tier T window per Richardson & Holland 1979 + MVT deposit
  // studies showing 50-152°C formation range. Solubility increases
  // with T below 100°C (kinetically slow precipitation), passes
  // through max around 100-250°C, declines above 350°C.
  let T_factor = 1.0;
  if (this.temperature < 50) T_factor = this.temperature / 50.0;
  else if (this.temperature < 100) T_factor = 0.8;
  else if (this.temperature <= 250) T_factor = 1.2;
  else if (this.temperature <= 350) T_factor = 1.0;
  else T_factor = Math.max(0.1, 1.0 - (this.temperature - 350) / 200);
  let sigma = product * T_factor;
  // v17: fluoro-complex penalty (ported from Python canonical, May 2026).
  // Per Manning 1979 — at very high F, Ca²⁺ + nF⁻ → CaFₙ complexes
  // re-dissolve fluorite. Secondary effect at T<300°C, real.
  if (this.fluid.F > 80) {
    const complex_penalty = (this.fluid.F - 80) / 200.0;
    sigma -= complex_penalty;
  }
  // Acid dissolution — fluorite dissolves in strong acid
  if (this.fluid.pH < 5.0) {
    const acid_attack = (5.0 - this.fluid.pH) * 0.4;
    sigma -= acid_attack;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'fluorite');
  return Math.max(sigma, 0);
},

  supersaturation_halite() {
  // v27 chloride evaporite. Quadratic in concentration so halite
  // stays dormant at scenario baseline (concentration=1) and fires
  // sharply when a vadose-transition concentration spike kicks in.
  // Mirror of supersaturation_halite in vugg.py.
  if (this.fluid.Na < 5 || this.fluid.Cl < 50) return 0;
  const c = this.fluid.concentration ?? 1.0;
  let sigma = (this.fluid.Na / 100.0) * (this.fluid.Cl / 500.0) * c * c;
  if (this.temperature > 100) sigma *= 0.7;
  if (this.fluid.pH < 4.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'halite');
  return Math.max(sigma, 0);
},
});
