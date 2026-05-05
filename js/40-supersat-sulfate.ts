// ============================================================
// js/40-supersat-sulfate.ts — supersaturation methods for sulfate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/sulfate.py. Minerals (12): alunite, anglesite, anhydrite, antlerite, barite, brochantite, celestine, chalcanthite, jarosite, mirabilite, selenite, thenardite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_barite() {
  if (this.fluid.Ba < 5 || this.fluid.S < 10 || !sulfateRedoxAvailable(this.fluid, 0.1)) return 0;
  // Factor caps to prevent evaporite-level S from runaway sigma.
  const ba_f = Math.min(this.fluid.Ba / 30.0, 2.0);
  const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
  // O2 saturation at SO₄/H₂S Eh boundary (~O2=0.4), not at fully
  // oxidized. Allows barite + galena coexistence (MVT diagnostic).
  const o2_f = sulfateRedoxFactor(this.fluid, 0.4, 1.5);
  let sigma = ba_f * s_f * o2_f;
  const T = this.temperature;
  if (T >= 50 && T <= 200) {
    sigma *= 1.2;
  } else if (T < 5) {
    sigma *= 0.3;
  } else if (T > 500) {
    sigma *= Math.max(0.2, 1.0 - 0.003 * (T - 500));
  }
  if (this.fluid.pH < 4) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (4 - this.fluid.pH));
  } else if (this.fluid.pH > 9) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'barite');
  return Math.max(sigma, 0);
},

  supersaturation_anhydrite() {
  if (this.fluid.Ca < 50 || this.fluid.S < 20 || !sulfateRedoxAvailable(this.fluid, 0.3)) return 0;
  const ca_f = Math.min(this.fluid.Ca / 200.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
  const o2_f = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = ca_f * s_f * o2_f;
  const T = this.temperature;
  const salinity = this.fluid.salinity;
  let T_factor;
  if (T > 60) {
    if (T < 200) {
      T_factor = 0.5 + 0.005 * (T - 60);
    } else if (T <= 700) {
      T_factor = 1.2;
    } else {
      T_factor = Math.max(0.3, 1.2 - 0.002 * (T - 700));
    }
  } else {
    if (salinity > 100) {
      T_factor = Math.min(1.0, 0.4 + salinity / 200.0);
    } else if (salinity > 50) {
      T_factor = 0.3;
    } else {
      return 0;  // dilute low-T → gypsum/selenite wins
    }
  }
  sigma *= T_factor;
  if (this.fluid.pH < 5) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (5 - this.fluid.pH));
  } else if (this.fluid.pH > 9) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'anhydrite');
  return Math.max(sigma, 0);
},

  supersaturation_brochantite() {
  if (this.fluid.Cu < 10 || this.fluid.S < 15 || !sulfateRedoxAvailable(this.fluid, 0.5)) return 0;
  if (this.fluid.pH < 3 || this.fluid.pH > 7.5) return 0;
  const cu_f = Math.min(this.fluid.Cu / 40.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 30.0, 2.5);
  const o2_f = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = cu_f * s_f * o2_f;
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.05 * (this.temperature - 50));
  }
  if (this.fluid.pH < 4) {
    sigma *= Math.max(0.3, 1.0 - 0.5 * (4 - this.fluid.pH));
  } else if (this.fluid.pH > 6) {
    sigma *= Math.max(0.3, 1.0 - 0.4 * (this.fluid.pH - 6));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'brochantite');
  return Math.max(sigma, 0);
},

  supersaturation_antlerite() {
  if (this.fluid.Cu < 15 || this.fluid.S < 20 || !sulfateRedoxAvailable(this.fluid, 0.5)) return 0;
  if (this.fluid.pH > 4 || this.fluid.pH < 0.5) return 0;
  const cu_f = Math.min(this.fluid.Cu / 40.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 30.0, 2.5);
  const o2_f = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = cu_f * s_f * o2_f;
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.05 * (this.temperature - 50));
  }
  if (this.fluid.pH > 3.5) {
    sigma *= Math.max(0.2, 1.0 - 0.5 * (this.fluid.pH - 3.5));
  } else if (this.fluid.pH < 1.5) {
    sigma *= Math.max(0.4, 1.0 - 0.3 * (1.5 - this.fluid.pH));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'antlerite');
  return Math.max(sigma, 0);
},

  supersaturation_jarosite() {
  if (this.fluid.K < 5 || this.fluid.Fe < 10 || this.fluid.S < 20
      || !sulfateRedoxAvailable(this.fluid, 0.5)) return 0;
  if (this.fluid.pH > 5) return 0;
  const k_f  = Math.min(this.fluid.K  / 15.0, 2.0);
  const fe_f = Math.min(this.fluid.Fe / 30.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 50.0, 2.5);
  const o2_f = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = k_f * fe_f * s_f * o2_f;
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.04 * (this.temperature - 50));
  }
  if (this.fluid.pH > 4) {
    sigma *= Math.max(0.2, 1.0 - 0.6 * (this.fluid.pH - 4));
  } else if (this.fluid.pH < 1) {
    sigma *= 0.4;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'jarosite');
  return Math.max(sigma, 0);
},

  supersaturation_alunite() {
  if (this.fluid.K < 5 || this.fluid.Al < 10 || this.fluid.S < 20
      || !sulfateRedoxAvailable(this.fluid, 0.5)) return 0;
  if (this.fluid.pH > 5) return 0;
  const k_f  = Math.min(this.fluid.K  / 15.0, 2.0);
  const al_f = Math.min(this.fluid.Al / 25.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 50.0, 2.5);
  const o2_f = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = k_f * al_f * s_f * o2_f;
  const T = this.temperature;
  if (T >= 50 && T <= 200) {
    sigma *= 1.2;
  } else if (T < 25) {
    sigma *= 0.5;
  } else if (T > 350) {
    sigma *= Math.max(0.2, 1.0 - 0.005 * (T - 350));
  }
  if (this.fluid.pH > 4) {
    sigma *= Math.max(0.2, 1.0 - 0.6 * (this.fluid.pH - 4));
  } else if (this.fluid.pH < 1) {
    sigma *= 0.4;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'alunite');
  return Math.max(sigma, 0);
},

  supersaturation_celestine() {
  if (this.fluid.Sr < 3 || this.fluid.S < 10 || !sulfateRedoxAvailable(this.fluid, 0.1)) return 0;
  const sr_f = Math.min(this.fluid.Sr / 15.0, 2.0);
  const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
  // O2 saturation at SO₄/H₂S boundary — same MVT-coexistence rationale.
  const o2_f = sulfateRedoxFactor(this.fluid, 0.4, 1.5);
  let sigma = sr_f * s_f * o2_f;
  const T = this.temperature;
  if (T < 100) {
    sigma *= 1.2;
  } else if (T > 200) {
    sigma *= Math.max(0.3, 1.0 - 0.005 * (T - 200));
  }
  if (this.fluid.pH < 5) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (5 - this.fluid.pH));
  } else if (this.fluid.pH > 9) {
    sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'celestine');
  return Math.max(sigma, 0);
},

  supersaturation_chalcanthite() {
  if (this.fluid.Cu < 30 || this.fluid.S < 50) return 0;
  if (this.fluid.pH > 4) return 0;
  if (!sulfateRedoxAvailable(this.fluid, 0.8)) return 0;
  if (this.fluid.salinity < 5.0) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 3.0);
  const s_f  = Math.min(this.fluid.S  / 100.0, 3.0);
  const ox_f = sulfateRedoxFactor(this.fluid, 1.5, 2.0);
  const sal_f = Math.min(this.fluid.salinity / 30.0, 3.0);
  const ph_f = Math.max(0.5, 1.0 + (3.0 - this.fluid.pH) * 0.2);
  let sigma = cu_f * s_f * ox_f * sal_f * ph_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.3;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.09 * (T - 10);
  else if (T <= 50) T_factor = Math.max(0.4, 1.3 - 0.06 * (T - 40));
  else T_factor = 0.2;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chalcanthite');
  return Math.max(sigma, 0);
},

  supersaturation_mirabilite() {
  // v29 cold-side Na-sulfate evaporite. Mirror of vugg.py.
  if (this.fluid.Na < 50 || this.fluid.S < 50 || !sulfateRedoxAvailable(this.fluid, 0.2)) return 0;
  if (this.temperature > 32) return 0;
  const c = this.fluid.concentration ?? 1.0;
  if (c < 1.5) return 0;
  let sigma = (this.fluid.Na / 300.0) * (this.fluid.S / 200.0) * c * c;
  if (this.temperature < 10) sigma *= 1.3;
  if (this.fluid.pH < 5.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mirabilite');
  return Math.max(sigma, 0);
},

  supersaturation_thenardite() {
  // v29 warm-side Na-sulfate evaporite. Mirror of vugg.py.
  if (this.fluid.Na < 50 || this.fluid.S < 50 || !sulfateRedoxAvailable(this.fluid, 0.2)) return 0;
  if (this.temperature < 25) return 0;
  const c = this.fluid.concentration ?? 1.0;
  if (c < 1.5) return 0;
  let sigma = (this.fluid.Na / 300.0) * (this.fluid.S / 200.0) * c * c;
  if (this.temperature > 50) sigma *= 1.2;
  if (this.fluid.pH < 5.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'thenardite');
  return Math.max(sigma, 0);
},

  supersaturation_selenite() {
  // v17 reconciliation (May 2026): Phase boundary is at ~55-60°C
  // (Naica 54.5°C, Pulpí 20°C, Van Driessche et al. 2016). Pre-v17
  // JS used a hard 80°C cutoff which was too lenient — gypsum
  // converts to anhydrite well before 80°C. Now matches Python's
  // softer decay starting at 60°C, while keeping JS's T<40 bonus
  // (real per Pulpí Geode formation).
  if (this.fluid.Ca < 20 || this.fluid.S < 15 || !sulfateRedoxAvailable(this.fluid, 0.2)) return 0;
  let sigma = (this.fluid.Ca / 60.0) * (this.fluid.S / 50.0) * sulfateRedoxFactor(this.fluid, 0.5);
  if (this.temperature > 60) {
    sigma *= Math.exp(-0.06 * (this.temperature - 60));
  }
  // Cool-T sweet spot — Pulpí 20°C
  if (this.temperature < 40) sigma *= 1.5;
  // Neutral to slightly alkaline pH preferred
  if (this.fluid.pH < 5.0) {
    sigma -= (5.0 - this.fluid.pH) * 0.2;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'selenite');
  return Math.max(sigma, 0);
},

  supersaturation_anglesite() {
  if (this.fluid.Pb < 15 || this.fluid.S < 15 || !sulfateRedoxAvailable(this.fluid, 0.8)) return 0;
  const pb_f = Math.min(this.fluid.Pb / 40.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 40.0, 1.5);
  const o_f  = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = pb_f * s_f * o_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'anglesite');
  return Math.max(sigma, 0);
},
});
