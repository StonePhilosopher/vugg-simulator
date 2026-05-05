// ============================================================
// js/34-supersat-hydroxide.ts — supersaturation methods for hydroxide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/hydroxide.py. Minerals (2): goethite, lepidocrocite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_goethite() {
  if (this.fluid.Fe < 15 || !hydroxideRedoxAvailable(this.fluid, 0.4)) return 0;
  let sigma = (this.fluid.Fe / 60.0) * hydroxideRedoxFactor(this.fluid, 1.0);
  if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'goethite');
  return Math.max(sigma, 0);
},

  supersaturation_lepidocrocite() {
  if (this.fluid.Fe < 15 || !hydroxideRedoxAvailable(this.fluid, 0.8)) return 0;
  const fe_f = Math.min(this.fluid.Fe / 50.0, 2.0);
  const o_f = hydroxideRedoxFactor(this.fluid, 1.5, 1.5);
  let sigma = fe_f * o_f;
  if (this.temperature > 50) sigma *= Math.exp(-0.02 * (this.temperature - 50));
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.4;
  if (this.fluid.pH > 7.5) sigma *= Math.max(0.5, 1.0 - (this.fluid.pH - 7.5) * 0.3);
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'lepidocrocite');
  return Math.max(sigma, 0);
},
});
