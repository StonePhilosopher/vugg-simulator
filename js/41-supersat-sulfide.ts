// ============================================================
// js/41-supersat-sulfide.ts — supersaturation methods for sulfide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/sulfide.py. Minerals (20): acanthite, argentite, arsenopyrite, bismuthinite, bornite, chalcocite, chalcopyrite, cobaltite, covellite, galena, marcasite, millerite, molybdenite, nickeline, pyrite, sphalerite, stibnite, tennantite, tetrahedrite, wurtzite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_sphalerite() {
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  // Below 95°C: full sigma. Above: accelerated decay (wurtzite field).
  const T_factor = this.temperature <= 95
    ? 2.0 * Math.exp(-0.004 * this.temperature)
    : 2.0 * Math.exp(-0.01 * this.temperature);
  return product * T_factor;
},

  supersaturation_wurtzite() {
  // Hexagonal (Zn,Fe)S dimorph of sphalerite. Round 9c retrofit
  // (Apr 2026): two-branch model. Equilibrium high-T branch (>95°C)
  // unchanged. Low-T metastable branch added per Murowchick & Barnes
  // 1986: wurtzite forms below 95°C only when pH<4 AND sigma_base>=1
  // AND Fe>=5 — the kinetic-trap conditions that produce Aachen-style
  // schalenblende and AMD wurtzite. See
  // research/research-broth-ratio-sphalerite-wurtzite.md.
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const T = this.temperature;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  if (T > 95) {
    let T_factor;
    if (T < 150) T_factor = (T - 95) / 55.0;
    else if (T <= 300) T_factor = 1.4;
    else T_factor = 1.4 * Math.exp(-0.005 * (T - 300));
    return product * T_factor;
  }
  // Low-T metastable branch — all three conditions required.
  if (this.fluid.pH >= 4.0) return 0;
  if (product < 1.0) return 0;
  if (this.fluid.Fe < 5) return 0;
  return product * 0.4;
},

  supersaturation_pyrite() {
  if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  const eT = this.effectiveTemperature; // Mo flux widens T window
  const T_factor = (100 < eT && eT < 400) ? 1.0 : 0.5;
  // pH rolloff below 5 — marcasite (orthorhombic FeS2) wins in acid
  let pH_factor = 1.0;
  if (this.fluid.pH < 5.0) {
    pH_factor = Math.max(0.3, (this.fluid.pH - 3.5) / 1.5);
  }
  return product * T_factor * pH_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_marcasite() {
  // Orthorhombic FeS2 dimorph of pyrite. pH<5 AND T<240 hard gates.
  if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH >= 5.0) return 0;
  if (this.temperature > 240) return 0;
  const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  const pH_factor = Math.min(1.4, (5.0 - this.fluid.pH) / 1.2);
  const T_factor = this.temperature < 150 ? 1.2 : 0.6;
  return product * pH_factor * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_chalcopyrite() {
  if (this.fluid.Cu < 10 || this.fluid.Fe < 5 || this.fluid.S < 15) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  const product = (this.fluid.Cu / 80.0) * (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  const eT = this.effectiveTemperature; // Mo flux widens T window
  // Chalcopyrite: main porphyry window 300-500°C, ~90% deposits before 400°C (Seo et al. 2012)
  // Can form at lower T (200-300°C) but less efficiently. Rare below 180°C.
  let T_factor;
  if (eT < 180) T_factor = 0.2;            // rare at low T
  else if (eT < 300) T_factor = 0.8;       // viable, not peak
  else if (eT <= 500) T_factor = 1.3;      // sweet spot — porphyry window
  else T_factor = 0.5;                      // fades above 500°C
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_galena() {
  // v13: reconciled to Python — pre-v13 had no O2 gate, allowing the
  // sulfide to form under oxidizing conditions (a clear physics bug,
  // surfaced by tools/supersat_drift_audit.py). Now matches vugg.py.
  if (this.fluid.Pb < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;  // sulfides can't survive oxidation
  let sigma = (this.fluid.Pb / 50.0) * (this.fluid.S / 80.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // v17: Mo-flux applied throughout via effectiveTemperature (matches Python).
  const eT = this.effectiveTemperature;
  if (eT >= 200 && eT <= 400) sigma *= 1.3;
  if (eT > 450) sigma *= Math.exp(-0.008 * (eT - 450));
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pyrite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'marcasite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'sphalerite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'wurtzite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'galena');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chalcopyrite');
  return Math.max(sigma, 0);
},

  supersaturation_molybdenite() {
  // v13: reconciled to Python (which agent-api already matched). Pre-v13
  // had no O2 gate, allowing the sulfide to form under oxidizing conditions.
  if (this.fluid.Mo < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;  // sulfide, needs reducing
  let sigma = (this.fluid.Mo / 15.0) * (this.fluid.S / 60.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // v17: use effectiveTemperature throughout for Mo-flux widening (matches Python).
  const eT = this.effectiveTemperature;
  if (eT < 150) {
    sigma *= Math.exp(-0.01 * (150 - eT));
  } else if (eT > 300 && eT < 500) {
    sigma *= 1.3;  // porphyry Mo sweet spot
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'molybdenite');
  return Math.max(sigma, 0);
},

  supersaturation_acanthite() {
  if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
  if (this.temperature > 173) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.5, 2.5);
  const s_f  = Math.min(this.fluid.S  / 25.0, 2.5);
  let sigma = ag_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 80 && T <= 150) {
    T_factor = 1.2;
  } else if (T < 80) {
    T_factor = Math.max(0.4, 1.0 - 0.012 * (80 - T));
  } else {  // 150 < T ≤ 173
    T_factor = Math.max(0.5, 1.0 - 0.020 * (T - 150));
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) {
    sigma *= 0.5;
  }
  if (this.fluid.Fe > 30 && this.fluid.Cu > 20) {
    sigma *= 0.6;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'acanthite');
  return Math.max(sigma, 0);
},

  supersaturation_argentite() {
  if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
  if (this.temperature <= 173) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.5, 2.5);
  const s_f  = Math.min(this.fluid.S  / 25.0, 2.5);
  let sigma = ag_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 400) {
    T_factor = 1.3;
  } else if (T <= 200) {
    T_factor = Math.max(0.5, (T - 173) / 27.0 + 0.5);
  } else if (T <= 600) {
    T_factor = Math.max(0.4, 1.0 - 0.005 * (T - 400));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) sigma *= 0.5;
  if (this.fluid.Cu > 30) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'argentite');
  return Math.max(sigma, 0);
},

  supersaturation_nickeline() {
  if (this.fluid.Ni < 40 || this.fluid.As < 40) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.6)) return 0;
  const ni_f = Math.min(this.fluid.Ni / 60.0, 2.5);
  const as_f = Math.min(this.fluid.As / 80.0, 2.5);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = ni_f * as_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 300 && T <= 450) T_factor = 1.3;
  else if (T < 200) T_factor = 0.3;
  else if (T < 300) T_factor = 0.3 + 0.010 * (T - 200);
  else if (T <= 500) T_factor = Math.max(0.5, 1.3 - 0.012 * (T - 450));
  else T_factor = 0.4;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'nickeline');
  return Math.max(sigma, 0);
},

  supersaturation_millerite() {
  if (this.fluid.Ni < 50 || this.fluid.S < 30) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.6)) return 0;
  if (this.fluid.As > 30.0 && this.temperature > 200) return 0;
  const ni_f = Math.min(this.fluid.Ni / 80.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 60.0, 2.5);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = ni_f * s_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 350) T_factor = 1.2;
  else if (T < 100) T_factor = 0.3;
  else if (T < 200) T_factor = 0.3 + 0.009 * (T - 100);
  else if (T <= 400) T_factor = Math.max(0.4, 1.2 - 0.013 * (T - 350));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'millerite');
  return Math.max(sigma, 0);
},

  supersaturation_cobaltite() {
  if (this.fluid.Co < 50 || this.fluid.As < 100 || this.fluid.S < 50) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const co_f = Math.min(this.fluid.Co / 80.0, 2.5);
  const as_f = Math.min(this.fluid.As / 120.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 80.0, 2.5);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = co_f * as_f * s_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 400 && T <= 500) T_factor = 1.3;
  else if (T < 300) T_factor = 0.3;
  else if (T < 400) T_factor = 0.3 + 0.010 * (T - 300);
  else if (T <= 600) T_factor = Math.max(0.4, 1.3 - 0.012 * (T - 500));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cobaltite');
  return Math.max(sigma, 0);
},

  supersaturation_arsenopyrite() {
  if (this.fluid.Fe < 5 || this.fluid.As < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.8)) return 0;  // sulfide — needs reducing
  let sigma = (this.fluid.Fe / 30.0) * (this.fluid.As / 15.0)
            * (this.fluid.S / 50.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // Mesothermal sweet spot 300-500°C
  const T = this.temperature;
  if (T >= 300 && T <= 500) {
    sigma *= 1.4;
  } else if (T < 200) {
    sigma *= Math.exp(-0.01 * (200 - T));
  } else if (T > 600) {
    sigma *= Math.exp(-0.015 * (T - 600));
  }
  // pH window 3-6.5
  if (this.fluid.pH < 3) {
    sigma *= 0.5;
  } else if (this.fluid.pH > 6.5) {
    sigma *= Math.max(0.2, 1.0 - 0.3 * (this.fluid.pH - 6.5));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'arsenopyrite');
  return Math.max(sigma, 0);
},

  supersaturation_tetrahedrite() {
  if (this.fluid.Cu < 10 || this.fluid.Sb < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
  if (this.temperature < 100 || this.temperature > 400) return 0;
  const product = (this.fluid.Cu / 40.0) * (this.fluid.Sb / 15.0) * (this.fluid.S / 40.0);
  let T_factor;
  if (this.temperature >= 200 && this.temperature <= 300) T_factor = 1.3;
  else if ((this.temperature >= 150 && this.temperature < 200) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
  else T_factor = 0.6;
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_tennantite() {
  if (this.fluid.Cu < 10 || this.fluid.As < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
  if (this.temperature < 100 || this.temperature > 400) return 0;
  const product = (this.fluid.Cu / 40.0) * (this.fluid.As / 15.0) * (this.fluid.S / 40.0);
  let T_factor;
  if (this.temperature >= 150 && this.temperature <= 300) T_factor = 1.3;
  else if ((this.temperature >= 100 && this.temperature < 150) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
  else T_factor = 0.6;
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_stibnite() {
  if (this.fluid.Sb < 10 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
  const sb_f = Math.min(this.fluid.Sb / 20.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 40.0, 1.5);
  let sigma = sb_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) T_factor = 1.0;
  else if (T >= 100 && T < 150) T_factor = 0.5 + 0.01 * (T - 100);
  else if (T > 300 && T <= 400) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 300));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.3, 1.0, 0.5);
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'stibnite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tetrahedrite');
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tennantite');
  return Math.max(sigma, 0);
},

  supersaturation_bismuthinite() {
  if (this.fluid.Bi < 5 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
  const bi_f = Math.min(this.fluid.Bi / 20.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 50.0, 1.5);
  let sigma = bi_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 400) T_factor = 1.0;
  else if (T >= 150 && T < 200) T_factor = 0.5 + 0.01 * (T - 150);
  else if (T > 400 && T <= 500) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 400));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.3, 1.0, 0.5);
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'bismuthinite');
  return Math.max(sigma, 0);
},

  supersaturation_bornite() {
  if (this.fluid.Cu < 25 || this.fluid.Fe < 8 || this.fluid.S < 20 || !sulfideRedoxAnoxic(this.fluid, 1.8)) return 0;
  const cu_fe_ratio = this.fluid.Cu / Math.max(this.fluid.Fe, 1);
  if (cu_fe_ratio < 2.0) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.0);
  const fe_f = Math.min(this.fluid.Fe / 30.0, 1.3);
  const s_f  = Math.min(this.fluid.S / 60.0, 1.5);
  let sigma = cu_f * fe_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 80 && T <= 300) T_factor = 1.0;
  else if (T < 80) T_factor = 0.6 + 0.005 * T;
  else if (T <= 500) T_factor = Math.max(0.5, 1.0 - 0.003 * (T - 300));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.5, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'bornite');
  return Math.max(sigma, 0);
},

  supersaturation_chalcocite() {
  if (this.fluid.Cu < 30 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.9)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 60.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 50.0, 1.5);
  let sigma = cu_f * s_f;
  if (this.temperature > 150) sigma *= Math.exp(-0.03 * (this.temperature - 150));
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.4, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chalcocite');
  return Math.max(sigma, 0);
},

  supersaturation_covellite() {
  if (this.fluid.Cu < 20 || this.fluid.S < 25 || !sulfideRedoxAnoxic(this.fluid, 2.0)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 60.0, 1.8);
  let sigma = cu_f * s_f;
  if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
  sigma *= sulfideRedoxTent(this.fluid, 0.8, 1.3, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'covellite');
  return Math.max(sigma, 0);
},
});
