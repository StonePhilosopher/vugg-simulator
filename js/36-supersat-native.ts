// ============================================================
// js/36-supersat-native.ts — supersaturation methods for native minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/native.py. Minerals (7): native_arsenic, native_bismuth, native_copper, native_gold, native_silver, native_sulfur, native_tellurium.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_native_tellurium() {
  if (this.fluid.Te < 0.5) return 0;
  if (this.fluid.Au > 1.0) return 0;
  if (this.fluid.Ag > 5.0) return 0;
  // Hg not currently tracked; coloradoite gate deferred.
  if (!nativeRedoxAnoxic(this.fluid, 0.5)) return 0;
  const te_f = Math.min(this.fluid.Te / 2.0, 3.5);
  const pb_suppr = Math.max(0.5, 1.0 - this.fluid.Pb / 200.0);
  const bi_suppr = Math.max(0.5, 1.0 - this.fluid.Bi / 60.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.8, 0.4);
  let sigma = te_f * pb_suppr * bi_suppr * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) {
    T_factor = 1.2;
  } else if (T < 100) {
    T_factor = 0.3;
  } else if (T < 150) {
    T_factor = 0.3 + 0.018 * (T - 100);
  } else if (T <= 400) {
    T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 300));
  } else {
    T_factor = 0.2;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_tellurium');
  return Math.max(sigma, 0);
},

  supersaturation_native_sulfur() {
  if (this.fluid.S < 100) return 0;
  if (!nativeRedoxWindow(this.fluid, 0.1, 0.7)) return 0;
  if (this.fluid.pH > 5) return 0;
  const metal_sum = this.fluid.Fe + this.fluid.Cu + this.fluid.Pb + this.fluid.Zn;
  if (metal_sum > 100) return 0;
  const s_f = Math.min(this.fluid.S / 200.0, 4.0);
  const eh_f = nativeRedoxTent(this.fluid, 0.4, 2.0, 0.4);
  const ph_f = Math.max(0.4, 1.0 - 0.15 * this.fluid.pH);
  let sigma = s_f * eh_f * ph_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 95) {
    T_factor = 1.2;
  } else if (T < 20) {
    T_factor = 0.6;
  } else if (T <= 119) {
    T_factor = Math.max(0.5, 1.2 - 0.025 * (T - 95));
  } else if (T < 200) {
    T_factor = Math.max(0.3, 0.5 - 0.005 * (T - 119));
  } else {
    T_factor = 0.0;
  }
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_sulfur');
  return Math.max(sigma, 0);
},

  supersaturation_native_arsenic() {
  if (this.fluid.As < 5) return 0;
  if (this.fluid.S > 10.0) return 0;
  if (this.fluid.Fe > 50.0) return 0;
  if (!nativeRedoxAnoxic(this.fluid, 0.5)) return 0;
  const as_f = Math.min(this.fluid.As / 30.0, 3.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.8, 0.4);
  const s_suppr = Math.max(0.4, 1.0 - this.fluid.S / 12.0);
  let sigma = as_f * red_f * s_suppr;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) {
    T_factor = 1.2;
  } else if (T < 100) {
    T_factor = 0.3;
  } else if (T < 150) {
    T_factor = 0.3 + 0.018 * (T - 100);
  } else if (T <= 350) {
    T_factor = Math.max(0.5, 1.2 - 0.014 * (T - 300));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_arsenic');
  return Math.max(sigma, 0);
},

  supersaturation_native_silver() {
  if (this.fluid.Ag < 1.0) return 0;
  if (this.fluid.S > 2.0) return 0;
  if (!nativeRedoxAnoxic(this.fluid, 0.3)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.0, 3.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 2.5, 0.3);
  const s_f = Math.max(0.2, 1.0 - this.fluid.S / 4.0);
  let sigma = ag_f * red_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 100 && T <= 200) {
    T_factor = 1.2;
  } else if (T < 50) {
    T_factor = 0.4;
  } else if (T < 100) {
    T_factor = 0.4 + 0.016 * (T - 50);
  } else if (T <= 300) {
    T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 200));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_silver');
  return Math.max(sigma, 0);
},

  supersaturation_native_bismuth() {
  if (this.fluid.Bi < 15 || this.fluid.S > 12 || !nativeRedoxAnoxic(this.fluid, 0.6)) return 0;
  const bi_f = Math.min(this.fluid.Bi / 25.0, 2.0);
  const s_mask = Math.max(0.4, 1.0 - this.fluid.S / 20.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = bi_f * s_mask * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 100 && T <= 250) T_factor = 1.0;
  else if (T < 100) T_factor = 0.6;
  else if (T <= 270) T_factor = Math.max(0.3, 1.0 - 0.05 * (T - 250));
  else T_factor = 0.1;
  sigma *= T_factor;
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_bismuth');
  return Math.max(sigma, 0);
},

  supersaturation_native_gold() {
  if (this.fluid.Au < 0.5) return 0;
  const au_f = Math.min(this.fluid.Au / 1.0, 4.0);
  const s_f = Math.max(0.2, 1.0 - this.fluid.S / 200.0);
  let sigma = au_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 400) T_factor = 1.0;
  else if (T < 20) T_factor = 0.5;
  else if (T <= 700) T_factor = Math.max(0.5, 1.0 - 0.001 * (T - 400));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_gold');
  return Math.max(sigma, 0);
},

  supersaturation_native_copper() {
  if (this.fluid.Cu < 50 || !nativeRedoxAnoxic(this.fluid, 0.4) || this.fluid.S > 30) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 2.0, 0.4);
  const s_f = Math.max(0.3, 1.0 - this.fluid.S / 40.0);
  let sigma = cu_f * red_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 150) T_factor = 1.0;
  else if (T < 20) T_factor = 0.7;
  else if (T <= 300) T_factor = Math.max(0.4, 1.0 - 0.004 * (T - 150));
  else T_factor = 0.2;
  sigma *= T_factor;
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_copper');
  return Math.max(sigma, 0);
},
});
