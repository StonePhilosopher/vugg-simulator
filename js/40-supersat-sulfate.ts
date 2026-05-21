// ============================================================
// js/40-supersat-sulfate.ts — supersaturation methods for sulfate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/sulfate.py. Minerals (12): alunite, anglesite, anhydrite, antlerite, barite, brochantite, celestine, chalcanthite, jarosite, mirabilite, selenite, thenardite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Sulfate MINERAL_GATES exports ----

const MINERAL_GATES_barite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 125,
  fluid_min: { Ba: 5, S: 10 },
  O2_min: 0.1,
  pH_min: 4, pH_max: 9,
  surface_energy: 'medium',
  _sources: ['barite engine v17+', 'He et al. 1995', 'MVT diagnostic literature'],
  _notes: 'BaSO4 — heavy spar, MVT gangue. T optimum 50-200°C. O2 saturates at SO4/H2S boundary (0.4), not at full oxidation — allows galena+barite coexistence.',
};

const MINERAL_GATES_celestine: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 80,
  fluid_min: { Sr: 3, S: 10 },
  O2_min: 0.1,
  pH_min: 5, pH_max: 9,
  surface_energy: 'medium',
  _sources: ['celestine engine v17+'],
  _notes: 'SrSO4 — pale celestial blue Sr sulfate. Substrate pref: existing barite (celestobarite-barytocelestine pair).',
};

const MINERAL_GATES_anhydrite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 150,
  fluid_min: { Ca: 50, S: 20 },
  O2_min: 0.3,
  pH_min: 5, pH_max: 9,
  surface_energy: 'medium',
  _sources: ['anhydrite engine v17+', 'Blount & Dickson 1973'],
  _notes: 'CaSO4 — high-T or saline-low-T Ca sulfate. Below 60°C: needs salinity > 50 (dilute low-T → selenite wins).',
};

const MINERAL_GATES_brochantite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Cu: 10, S: 15 },
  O2_min: 0.5,
  pH_min: 3, pH_max: 7.5,
  surface_energy: 'low',
  _sources: ['brochantite engine v17+'],
  _notes: 'Cu4(SO4)(OH)6 — wet-supergene Cu sulfate (pH 4-7 fork end). Substrate pref dissolving chalcocite/covellite.',
};

const MINERAL_GATES_antlerite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Cu: 15, S: 20 },
  O2_min: 0.5,
  pH_min: 0.5, pH_max: 4,
  surface_energy: 'low',
  _sources: ['antlerite engine v17+', 'Chuquicamata literature'],
  _notes: 'Cu3(SO4)(OH)4 — dry-acid Cu sulfate (pH 1-3.5 fork end). Substrate-prefers dissolving brochantite (pH-fork conversion).',
};

const MINERAL_GATES_jarosite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { K: 5, Fe: 10, S: 20 },
  O2_min: 0.5,
  pH_max: 5,
  surface_energy: 'medium',
  _sources: ['jarosite engine v17+', 'AMD / Mars-class literature'],
  _notes: 'KFe3(SO4)2(OH)6 — acid mine drainage yellow. Substrate-pref dissolving pyrite/marcasite (diagnostic yellow rim).',
};

const MINERAL_GATES_alunite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 125,
  fluid_min: { K: 5, Al: 10, S: 20 },
  O2_min: 0.5,
  pH_max: 5,
  surface_energy: 'medium',
  _sources: ['alunite engine v17+'],
  _notes: 'KAl3(SO4)2(OH)6 — advanced argillic alteration index. Substrate-pref dissolving feldspar (Al source).',
};

const MINERAL_GATES_chalcanthite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 50, T_optimal: 30,
  fluid_min: { Cu: 30, S: 50 },
  O2_min: 0.8,
  pH_max: 4,
  surface_energy: 'low',
  _sources: ['chalcanthite engine v17+'],
  _notes: 'CuSO4·5H2O — blue vitriol. Requires salinity > 5.0 (evaporative concentration).',
};

const MINERAL_GATES_mirabilite: MineralGates = {
  sigma_crit: 1.0,
  T_max: 32, T_optimal: 5,
  fluid_min: { Na: 50, S: 50 },
  O2_min: 0.2,
  pH_min: 5,                    // attenuation; effective gate
  surface_energy: 'low',
  _sources: ['mirabilite engine v29+'],
  _notes: 'Na2SO4·10H2O Glauber salt — cold playa-brine evaporite. Quadratic in concentration; needs c ≥ 1.5.',
};

const MINERAL_GATES_thenardite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 25, T_optimal: 60,
  fluid_min: { Na: 50, S: 50 },
  O2_min: 0.2,
  pH_min: 5,
  surface_energy: 'low',
  _sources: ['thenardite engine v29+'],
  _notes: 'Na2SO4 anhydrous — warm playa surface. Quadratic in concentration; needs c ≥ 1.5.',
};

const MINERAL_GATES_selenite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Ca: 20, S: 15 },
  O2_min: 0.2,
  surface_energy: 'low',
  _sources: ['selenite engine v17+', 'Van Driessche et al. 2016'],
  _notes: 'CaSO4·2H2O — Pulpí 20°C, Naica 54.5°C. Phase boundary to anhydrite at ~55-60°C; soft decay above 60°C. T<40 bonus.',
};

const MINERAL_GATES_anglesite: MineralGates = {
  sigma_crit: 1.1,
  T_optimal: 30,
  fluid_min: { Pb: 15, S: 15 },
  O2_min: 0.8,
  pH_min: 2.0,
  surface_energy: 'medium',
  _sources: ['anglesite engine v17+'],
  _notes: 'PbSO4 — supergene oxidation of galena. Substrate-pref galena (dissolving or active).',
};

const MINERAL_GATES_linarite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 25,
  fluid_min: { Pb: 30, Cu: 10, S: 50 },
  O2_min: 0.5,
  pH_min: 4.0, pH_max: 7.0,
  surface_energy: 'low',
  _sources: ['linarite engine v100+', 'Williams 1990', 'Smith 1994 (Tsumeb monograph)'],
  _notes: 'PbCu(SO4)(OH)2 deep azure-blue. CO3:SO4 ratio < 0.3 required. Cl > 100 suppresses (boleite group).',
};

const MINERAL_GATES_caledonite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 25,
  fluid_min: { Pb: 30, Cu: 10, S: 50, CO3: 5 },
  O2_min: 0.5,
  pH_min: 5.0, pH_max: 7.0,
  surface_energy: 'medium',
  _sources: ['caledonite engine v100+', 'Wilson & Dunn 1978 MinRec 9:251'],
  _notes: 'Pb5Cu2(CO3)(SO4)3(OH)6 — intermediate CO3:SO4 0.3-1. Epitactic on linarite as carbonate activity rises. Cl > 50 suppresses.',
};

const MINERAL_GATES_leadhillite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 30,
  fluid_min: { Pb: 50, S: 30, CO3: 30 },
  O2_min: 0.5,
  pH_min: 6.0, pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['leadhillite engine v100+'],
  _notes: 'Pb4(SO4)(CO3)2(OH)2 — pearly white mica-like tablets, Cu-poor (Cu > 50 suppresses). CO3:SO4 > 1.5 required.',
};

Object.assign(VugConditions.prototype, {
  supersaturation_barite() {
  const g = MINERAL_GATES_barite;
  if (this.fluid.Ba < g.fluid_min!.Ba || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
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
  const g = MINERAL_GATES_anhydrite;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
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
  const g = MINERAL_GATES_brochantite;
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
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
  const g = MINERAL_GATES_antlerite;
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH > g.pH_max! || this.fluid.pH < g.pH_min!) return 0;
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
  const g = MINERAL_GATES_jarosite;
  if (this.fluid.K < g.fluid_min!.K || this.fluid.Fe < g.fluid_min!.Fe || this.fluid.S < g.fluid_min!.S
      || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH > g.pH_max!) return 0;
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
  const g = MINERAL_GATES_alunite;
  if (this.fluid.K < g.fluid_min!.K || this.fluid.Al < g.fluid_min!.Al || this.fluid.S < g.fluid_min!.S
      || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH > g.pH_max!) return 0;
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
  const g = MINERAL_GATES_celestine;
  if (this.fluid.Sr < g.fluid_min!.Sr || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
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
  const g = MINERAL_GATES_chalcanthite;
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.S < g.fluid_min!.S) return 0;
  if (this.fluid.pH > g.pH_max!) return 0;
  if (!sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
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
  const g = MINERAL_GATES_mirabilite;
  if (this.fluid.Na < g.fluid_min!.Na || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature > g.T_max!) return 0;
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
  const g = MINERAL_GATES_thenardite;
  if (this.fluid.Na < g.fluid_min!.Na || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min!) return 0;
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
  const g = MINERAL_GATES_selenite;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
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
  const g = MINERAL_GATES_anglesite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.S < g.fluid_min!.S || !sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const pb_f = Math.min(this.fluid.Pb / 40.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 40.0, 1.5);
  const o_f  = sulfateRedoxFactor(this.fluid, 1.0, 1.5);
  let sigma = pb_f * s_f * o_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'anglesite');
  return Math.max(sigma, 0);
},

// v100 (2026-05-19): Pb-Cu supergene sulfate trio — linarite +
// leadhillite + caledonite. Late-stage Pb-Cu oxidation cycle from
// Tsumeb / Bisbee / Leadhills Scotland. All require SIMULTANEOUS
// oxidation of galena (PbS) AND Cu-sulfide proximate. Discriminator
// gates per Williams 1990 + Smith 1994 (Tsumeb monograph) + Wilson
// & Dunn 1978 MinRec 9:251 (Leadhills):
//
//   linarite      PbCu(SO4)(OH)2          pH 4-7, CO3:SO4 < 0.1
//                                          (Cu-Pb-rich + low-CO3)
//   caledonite    Pb5Cu2(CO3)(SO4)3(OH)6   pH 5-7, CO3:SO4 0.3-1
//                                          (mixed, blue-green)
//   leadhillite   Pb4(SO4)(CO3)2(OH)2      pH 6-8, CO3:SO4 > 2
//                                          (CO3-dominant, low Cu)
//
// Three minerals pull apart on pH + CO3:SO4 ratio + Cu:Pb fraction.
// All use sulfateRedoxAvailable for oxidizing supergene gate.

  supersaturation_linarite() {
    // PbCu(SO4)(OH)2 — monoclinic deep azure-blue. Galena + Cu-sulfide
    // co-oxidation product; lowest CO3 of the trio.
    const g = MINERAL_GATES_linarite;
    if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Cu < g.fluid_min!.Cu) return 0;
    if (this.fluid.S < g.fluid_min!.S) return 0;
    if (!sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // CO3:SO4 ratio fork — linarite needs LOW carbonate
    const co3_so4 = this.fluid.CO3 / Math.max(this.fluid.S, 1);
    if (co3_so4 > 0.3) return 0;  // > 0.3 → caledonite/leadhillite
    // Chloride suppression (boleite group)
    if (this.fluid.Cl > 100) return 0;
    const pb_f = Math.min(this.fluid.Pb / 50.0, 2.0);
    const cu_f = Math.min(this.fluid.Cu / 30.0, 2.0);
    const s_f  = Math.min(this.fluid.S / 100.0, 2.0);
    let sigma = pb_f * cu_f * s_f;
    const pH = this.fluid.pH;
    if (pH >= 5.0 && pH <= 6.0) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 5.5) * 0.5);
    sigma *= sulfateRedoxFactor(this.fluid, 1.0, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'linarite');
    return Math.max(sigma, 0);
  },

  supersaturation_caledonite() {
    // Pb5Cu2(CO3)(SO4)3(OH)6 — orthorhombic blue-green. Intermediate
    // CO3:SO4. Often epitactic on linarite as the carbonate activity
    // rises during continued reaction with limestone host.
    const g = MINERAL_GATES_caledonite;
    if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Cu < g.fluid_min!.Cu) return 0;
    if (this.fluid.S < g.fluid_min!.S) return 0;
    if (this.fluid.CO3 < g.fluid_min!.CO3) return 0;
    if (!sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // CO3:SO4 0.3-1 sweet spot
    const co3_so4 = this.fluid.CO3 / Math.max(this.fluid.S, 1);
    if (co3_so4 < 0.1 || co3_so4 > 2.0) return 0;
    if (this.fluid.Cl > 50) return 0;
    const pb_f = Math.min(this.fluid.Pb / 50.0, 2.0);
    const cu_f = Math.min(this.fluid.Cu / 30.0, 1.8);
    const s_f  = Math.min(this.fluid.S / 100.0, 1.8);
    const co3_f = Math.min(this.fluid.CO3 / 30.0, 1.5);
    let sigma = pb_f * cu_f * s_f * co3_f;
    const pH = this.fluid.pH;
    if (pH >= 5.5 && pH <= 6.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 6.0) * 0.5);
    if (co3_so4 >= 0.3 && co3_so4 <= 1.0) sigma *= 1.2;
    sigma *= sulfateRedoxFactor(this.fluid, 1.0, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'caledonite');
    return Math.max(sigma, 0);
  },

  supersaturation_leadhillite() {
    // Pb4(SO4)(CO3)2(OH)2 — monoclinic pseudo-trigonal, pearly white
    // mica-like tablets. Carbonate-dominant; Cu-poor; metastable
    // (ages to anglesite + cerussite under humidity cycling).
    const g = MINERAL_GATES_leadhillite;
    if (this.fluid.Pb < g.fluid_min!.Pb) return 0;
    if (this.fluid.S < g.fluid_min!.S) return 0;
    if (this.fluid.CO3 < g.fluid_min!.CO3) return 0;
    if (!sulfateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // CO3:SO4 fork — leadhillite needs CARBONATE-dominant
    const co3_so4 = this.fluid.CO3 / Math.max(this.fluid.S, 1);
    if (co3_so4 < 1.5) return 0;
    // Cu suppression — leadhillite is the Cu-poor end
    if (this.fluid.Cu > 50) return 0;
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.0);
    const s_f  = Math.min(this.fluid.S / 100.0, 1.5);
    const co3_f = Math.min(this.fluid.CO3 / 100.0, 2.0);
    let sigma = pb_f * s_f * co3_f;
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 7.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.0) * 0.5);
    sigma *= sulfateRedoxFactor(this.fluid, 1.0, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'leadhillite');
    return Math.max(sigma, 0);
  },
});
