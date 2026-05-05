// ============================================================
// js/30-supersat-arsenate.ts — supersaturation methods for arsenate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/arsenate.py. Minerals (6): adamite, annabergite, erythrite, mimetite, olivenite, scorodite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_olivenite() {
  if (this.fluid.Cu < 50 || this.fluid.As < 10) return 0;
  if (this.fluid.O2 < 0.5) return 0;
  // Recessive-side trace floor — real olivenite always has at least
  // trace Zn (zincolivenite-leaning); makes the ratio meaningful.
  if (this.fluid.Zn < 0.5) return 0;
  // Broth-ratio gate — olivenite is Cu-dominant.
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const cu_fraction = this.fluid.Cu / cu_zn_total;
  if (cu_fraction < 0.5) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const as_f = Math.min(this.fluid.As / 20.0, 2.5);
  const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
  let sigma = cu_f * as_f * ox_f;
  // Sweet-spot bonus — Cu-dominant with Zn trace is zincolivenite-
  // leaning, the most-collected form. Pure-Cu damped (malachite/
  // brochantite take that territory).
  if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
  else if (cu_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'olivenite');
  return Math.max(sigma, 0);
},

  supersaturation_scorodite() {
  if (this.fluid.Fe < 5 || this.fluid.As < 3 || this.fluid.O2 < 0.3) return 0;
  if (this.fluid.pH > 6) return 0;  // dissolves above pH 5; nucleation gate at 6 for hysteresis
  let sigma = (this.fluid.Fe / 30.0) * (this.fluid.As / 15.0) * (this.fluid.O2 / 1.0);
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.025 * (this.temperature - 80));
  }
  if (this.fluid.pH > 5) {
    sigma *= Math.max(0.3, 1.0 - 0.5 * (this.fluid.pH - 5));
  } else if (this.fluid.pH < 2) {
    sigma *= Math.max(0.4, 1.0 - 0.3 * (2 - this.fluid.pH));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'scorodite');
  return Math.max(sigma, 0);
},

  supersaturation_erythrite() {
  // Co3(AsO4)2·8H2O — cobalt bloom. Shared vivianite-group gating with annabergite.
  if (this.fluid.Co < 2 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
  if (this.temperature < 5 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
  const product = (this.fluid.Co / 20.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
  const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
  return product * T_factor;
},

  supersaturation_annabergite() {
  // Ni3(AsO4)2·8H2O — nickel bloom. Ni equivalent of erythrite.
  if (this.fluid.Ni < 2 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
  if (this.temperature < 5 || this.temperature > 50) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
  const product = (this.fluid.Ni / 20.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
  const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
  return product * T_factor;
},

  supersaturation_adamite() {
  if (this.fluid.Zn < 10 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
  // Trace Cu floor — Cu²⁺ activator gives the diagnostic green
  // fluorescence; recessive-side floor makes the Cu:Zn ratio meaningful.
  if (this.fluid.Cu < 0.5) return 0;
  // Broth-ratio gate — adamite is Zn-dominant.
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const zn_fraction = this.fluid.Zn / cu_zn_total;
  if (zn_fraction < 0.5) return 0;
  let sigma = (this.fluid.Zn / 80.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
  // Sweet-spot bonus — Zn-dominant with Cu trace (the fluorescent
  // variety) is the most aesthetic adamite. Pure-Zn damped because
  // hemimorphite/smithsonite take that territory.
  if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
  else if (zn_fraction > 0.95) sigma *= 0.5;
  if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.4;
  else if (this.fluid.pH > 8.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'adamite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'erythrite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'annabergite');
  return Math.max(sigma, 0);
},

  supersaturation_mimetite() {
  if (this.fluid.Pb < 5 || this.fluid.As < 3 || this.fluid.Cl < 2 || this.fluid.O2 < 0.3) return 0;
  let sigma = (this.fluid.Pb / 60.0) * (this.fluid.As / 25.0) * (this.fluid.Cl / 30.0) * (this.fluid.O2 / 1.0);
  if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
  if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mimetite');
  return Math.max(sigma, 0);
},
});
