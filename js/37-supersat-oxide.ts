// ============================================================
// js/37-supersat-oxide.ts — supersaturation methods for oxide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/oxide.py. Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_hematite() {
  if (this.fluid.Fe < 20 || this.fluid.O2 < 0.5) return 0;
  let sigma = (this.fluid.Fe / 100.0) * (this.fluid.O2 / 1.0) * Math.exp(-0.002 * this.temperature);
  if (this.fluid.pH < 3.5) {
    sigma -= (3.5 - this.fluid.pH) * 0.3;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hematite');
  return Math.max(sigma, 0);
},

  supersaturation_uraninite() {
  // Reconciled to Python canonical (v12, May 2026). Pre-v12 JS used a
  // T-only formula with no O2 gate — uraninite would form even in
  // oxidizing conditions, contradicting research-uraninite.md.
  // Now: needs reducing + U + (slight high-T preference).
  if (this.fluid.U < 5 || this.fluid.O2 > 0.3) return 0;
  let sigma = (this.fluid.U / 20.0) * (0.5 - this.fluid.O2);
  if (this.temperature > 200) sigma *= 1.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uraninite');
  return Math.max(sigma, 0);
},

  supersaturation_magnetite() {
  if (this.fluid.Fe < 25 || this.fluid.O2 < 0.1 || this.fluid.O2 > 1.0) return 0;
  const fe_f = Math.min(this.fluid.Fe / 60.0, 2.0);
  const o_f = Math.max(0.4, 1.0 - Math.abs(this.fluid.O2 - 0.4) * 1.5);
  let sigma = fe_f * o_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 300 && T <= 600) T_factor = 1.0;
  else if (T >= 100 && T < 300) T_factor = 0.5 + 0.0025 * (T - 100);
  else if (T > 600 && T <= 800) T_factor = Math.max(0.4, 1.0 - 0.003 * (T - 600));
  else T_factor = 0.2;
  sigma *= T_factor;
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'magnetite');
  return Math.max(sigma, 0);
},

  supersaturation_cuprite() {
  if (this.fluid.Cu < 20 || this.fluid.O2 < 0.3 || this.fluid.O2 > 1.2) return 0;
  const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
  const o_f = Math.max(0.3, 1.0 - Math.abs(this.fluid.O2 - 0.7) * 1.4);
  let sigma = cu_f * o_f;
  if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
  if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cuprite');
  return Math.max(sigma, 0);
},

  supersaturation_corundum() {
  const f = this.fluid;
  if (f.Cr >= 2.0) return 0;  // ruby priority
  if (f.Fe >= 5) return 0;    // sapphire priority
  return this._corundum_base_sigma();
},

  supersaturation_ruby() {
  if (this.fluid.Cr < 2.0) return 0;
  const base = this._corundum_base_sigma();
  if (base <= 0) return 0;
  const cr_f = Math.min(this.fluid.Cr / 5.0, 2.0);
  return base * cr_f;
},

  supersaturation_sapphire() {
  const f = this.fluid;
  if (f.Cr >= 2.0) return 0;  // ruby priority
  if (f.Fe < 5) return 0;
  const base = this._corundum_base_sigma();
  if (base <= 0) return 0;
  let chrom_f = Math.min(f.Fe / 15.0, 1.5);
  if (f.Ti >= 0.5) chrom_f *= Math.min(f.Ti / 1.5, 1.3);
  return base * chrom_f;
},
});
