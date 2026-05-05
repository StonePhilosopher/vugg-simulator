// ============================================================
// js/38-supersat-phosphate.ts — supersaturation methods for phosphate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/phosphate.py. Minerals (11): autunite, carnotite, clinobisvanite, descloizite, mottramite, pyromorphite, torbernite, tyuyamunite, uranospinite, vanadinite, zeunerite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_descloizite() {
  if (this.fluid.Pb < 40 || this.fluid.Zn < 50 || this.fluid.V < 10) return 0;
  if (this.fluid.O2 < 0.5) return 0;
  if (this.fluid.Cu < 0.5) return 0;
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const zn_fraction = this.fluid.Zn / cu_zn_total;
  if (zn_fraction < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const zn_f = Math.min(this.fluid.Zn / 80.0, 2.5);
  const v_f  = Math.min(this.fluid.V  / 20.0, 2.5);
  const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
  let sigma = pb_f * zn_f * v_f * ox_f;
  if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
  else if (zn_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 30 && T <= 50) T_factor = 1.2;
  else if (T < 20) T_factor = 0.4;
  else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
  else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'descloizite');
  return Math.max(sigma, 0);
},

  supersaturation_mottramite() {
  if (this.fluid.Pb < 40 || this.fluid.Cu < 50 || this.fluid.V < 10) return 0;
  if (this.fluid.O2 < 0.5) return 0;
  if (this.fluid.Zn < 0.5) return 0;
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const cu_fraction = this.fluid.Cu / cu_zn_total;
  if (cu_fraction < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const v_f  = Math.min(this.fluid.V  / 20.0, 2.5);
  const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
  let sigma = pb_f * cu_f * v_f * ox_f;
  if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
  else if (cu_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 30 && T <= 50) T_factor = 1.2;
  else if (T < 20) T_factor = 0.4;
  else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
  else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mottramite');
  return Math.max(sigma, 0);
},

  supersaturation_clinobisvanite() {
  if (this.fluid.Bi < 2 || this.fluid.V < 2 || this.fluid.O2 < 1.0) return 0;
  const bi_f = Math.min(this.fluid.Bi / 5.0, 2.0);
  const v_f  = Math.min(this.fluid.V / 5.0, 2.0);
  const o_f  = Math.min(this.fluid.O2 / 1.5, 1.3);
  let sigma = bi_f * v_f * o_f;
  if (this.temperature > 40) sigma *= Math.exp(-0.04 * (this.temperature - 40));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'clinobisvanite');
  return Math.max(sigma, 0);
},

  supersaturation_pyromorphite() {
  if (this.fluid.Pb < 20 || this.fluid.P < 2 || this.fluid.Cl < 5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
  const p_f  = Math.min(this.fluid.P / 5.0, 2.0);
  const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
  let sigma = pb_f * p_f * cl_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pyromorphite');
  return Math.max(sigma, 0);
},

  supersaturation_vanadinite() {
  if (this.fluid.Pb < 20 || this.fluid.V < 2 || this.fluid.Cl < 5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
  const v_f  = Math.min(this.fluid.V / 6.0, 2.0);
  const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
  let sigma = pb_f * v_f * cl_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'vanadinite');
  return Math.max(sigma, 0);
},

  supersaturation_torbernite() {
  if (this.fluid.Cu < 5 || this.fluid.U < 0.3 || this.fluid.P < 1.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 10 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
  // Anion competition (3-way as of 9c): denominator includes V so
  // V-rich fluid routes to carnotite instead of falling into torbernite.
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const p_fraction = this.fluid.P / anion_total;
  if (p_fraction < 0.5) return 0;
  // Cation competition (Round 9d): Cu must dominate over Ca. Pre-9d
  // torbernite would have fired even in Ca-saturated groundwater if
  // Cu>=5; the cation fork sends those fluids to autunite instead.
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const cu_fraction = this.fluid.Cu / cation_total;
  if (cu_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const p_f = Math.min(this.fluid.P / 10.0, 2.0);
  let sigma = u_f * cu_f * p_f;
  if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 40) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'torbernite');
  return Math.max(sigma, 0);
},

  supersaturation_autunite() {
  // Round 9d (May 2026): Ca-cation analog of torbernite. Same parent
  // fluid (U + P + supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
  // Mirror of vugg.py supersaturation_autunite.
  if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.P < 1.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 5 || this.temperature > 50) return 0;
  if (this.fluid.pH < 4.5 || this.fluid.pH > 8.0) return 0;
  // Anion competition — same shape as torbernite/zeunerite/carnotite
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const p_fraction = this.fluid.P / anion_total;
  if (p_fraction < 0.5) return 0;
  // Cation competition — Ca must dominate over Cu (mirror of torbernite)
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const p_f = Math.min(this.fluid.P / 10.0, 2.0);
  let sigma = u_f * ca_f * p_f;
  if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 10 && T <= 35) T_factor = 1.2;
  else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'autunite');
  return Math.max(sigma, 0);
},

  supersaturation_zeunerite() {
  if (this.fluid.Cu < 5 || this.fluid.U < 0.3 || this.fluid.As < 2.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 10 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
  // Anion competition (3-way as of 9c)
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const as_fraction = this.fluid.As / anion_total;
  if (as_fraction < 0.5) return 0;
  // Cation competition (Round 9e): Cu must dominate over Ca. Mirror
  // of torbernite's 9d gate. Without this, zeunerite would fire in
  // Ca-saturated groundwater that should route to uranospinite.
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const cu_fraction = this.fluid.Cu / cation_total;
  if (cu_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const as_f = Math.min(this.fluid.As / 15.0, 2.0);
  let sigma = u_f * cu_f * as_f;
  if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 40) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'zeunerite');
  return Math.max(sigma, 0);
},

  supersaturation_uranospinite() {
  // Round 9e (May 2026): Ca-cation analog of zeunerite. Mirror of
  // vugg.py supersaturation_uranospinite. Same parent fluid (U + As +
  // supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
  if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.As < 2.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 5 || this.temperature > 50) return 0;
  if (this.fluid.pH < 4.5 || this.fluid.pH > 8.0) return 0;
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const as_fraction = this.fluid.As / anion_total;
  if (as_fraction < 0.5) return 0;
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const as_f = Math.min(this.fluid.As / 15.0, 2.0);
  let sigma = u_f * ca_f * as_f;
  if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 10 && T <= 35) T_factor = 1.2;
  else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uranospinite');
  return Math.max(sigma, 0);
},

  supersaturation_carnotite() {
  // V-branch / K-cation of the uranyl cation+anion fork (Round 9c + 9e).
  // Mirror of vugg.py supersaturation_carnotite.
  if (this.fluid.K < 5 || this.fluid.U < 0.3 || this.fluid.V < 1.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 10 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const v_fraction = this.fluid.V / anion_total;
  if (v_fraction < 0.5) return 0;
  // Cation competition (Round 9e): K must dominate over Ca. Without
  // this, carnotite would fire in Ca-saturated groundwater that should
  // route to tyuyamunite.
  const cation_total = this.fluid.K + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const k_fraction = this.fluid.K / cation_total;
  if (k_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const k_f = Math.min(this.fluid.K / 30.0, 2.0);
  const v_f = Math.min(this.fluid.V / 10.0, 2.0);
  let sigma = u_f * k_f * v_f;
  if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 20) T_factor = 0.5 + 0.07 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'carnotite');
  return Math.max(sigma, 0);
},

  supersaturation_tyuyamunite() {
  // Round 9e (May 2026): Ca-cation analog of carnotite. Mirror of
  // vugg.py supersaturation_tyuyamunite. Orthorhombic instead of
  // monoclinic crystal system but same chemistry stage.
  if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.V < 1.0 || this.fluid.O2 < 0.8) return 0;
  if (this.temperature < 5 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
  const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
  if (anion_total <= 0) return 0;
  const v_fraction = this.fluid.V / anion_total;
  if (v_fraction < 0.5) return 0;
  const cation_total = this.fluid.K + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const v_f = Math.min(this.fluid.V / 10.0, 2.0);
  let sigma = u_f * ca_f * v_f;
  if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 35) T_factor = 1.2;
  else if (T < 15) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tyuyamunite');
  return Math.max(sigma, 0);
},
});
