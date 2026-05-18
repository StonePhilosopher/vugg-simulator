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
  // v68: effectiveTemperature is now an identity pass-through after the
  // Mo-flux artifact was removed (canonical 5ecbb42). Kept for forward
  // compat with the Python mirror.
  const eT = this.effectiveTemperature;
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
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
  const eT = this.effectiveTemperature;
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
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
  // Pre-v68 the Mo-flux widened the galena T window; that was a
  // simulation artifact with no geological basis.
  const eT = this.effectiveTemperature;
  if (eT >= 200 && eT <= 400) sigma *= 1.3;
  if (eT > 450) sigma *= Math.exp(-0.008 * (eT - 450));
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'galena');
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor for pyrite/marcasite/sphalerite/wurtzite/
  // chalcopyrite. Those are unrelated Fe/Zn/Cu sulfides with their own
  // stoichiometry; multiplying SIX factors stacked log γᵢ over the wrong
  // ion sets and silently dampened galena's σ by ~½×. Regression
  // introduced by the Phase 2b activity-coefficient sweep (eff8ec1,
  // 2026-05-05). Equivalent fixes landed on adamite, borax, and stibnite
  // the same day. Galena is the most heavily exercised mineral in the
  // sim (MVT + every Pb-bearing scenario) so this is the highest-impact
  // single line of the audit.
  return Math.max(sigma, 0);
},

  supersaturation_molybdenite() {
  // v13: reconciled to Python (which agent-api already matched). Pre-v13
  // had no O2 gate, allowing the sulfide to form under oxidizing conditions.
  if (this.fluid.Mo < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;  // sulfide, needs reducing
  let sigma = (this.fluid.Mo / 15.0) * (this.fluid.S / 60.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
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
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor for tetrahedrite + tennantite. Those are
  // Cu-As/Sb sulfosalts with their own stoichiometry, structurally
  // unrelated to stibnite (Sb2S3). Stacking the three factors dampened
  // σ enough to keep stibnite below the σ=1.2 nucleation threshold even
  // in porphyry (Sb=25, S=60-115): pre-fix best σ = 0.87 across 360
  // step-samples. Regression introduced by the Phase 2b sweep (eff8ec1,
  // 2026-05-05). Equivalent fixes landed on adamite, borax, and galena
  // the same day.
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

  // v63 brief-19 — telluride / selenide / Cd-sulfide group.
  // All are reducing-only (chalcophile chemistry); most are Au-Ag-Te or
  // Pb-Ag-Se epithermal phases; greenockite/hawleyite are the Cd-sulfide
  // pair from sphalerite oxidation.

  // AuTe2 — incommensurately modulated monoclinic Au telluride.
  // Fires when Au + Te both present, low S, mid-T epithermal.
  supersaturation_calaverite() {
    if (this.fluid.Au < 0.1 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Au/1.0, Te/5.0) → (Au/0.2, Te/2.0). Cripple Creek fluid
    // inclusion data (Saunders 2008) puts typical telluride-precipitating
    // fluids at Au 0.4-2 ppm and Te 1-30 ppm. The prior references
    // anchored "well-saturated" at Au=1 ppm and Te=5 ppm, so the
    // scenario's natural-range Au=0.4 / Te=3 gave σ=0.24 — well below
    // the >1.0 nucleation threshold. epithermal_telluride's
    // calaverite stale across 10 seeds × 100 steps confirmed the
    // miss via tools/mineral_coverage_check.mjs.
    let sigma = (this.fluid.Au / 0.2) * (this.fluid.Te / 2.0);
    const T = this.temperature;
    if (T < 100 || T > 450) return 0;
    let T_factor = 1.0;
    if (T >= 200 && T <= 350) T_factor = 1.2;
    else if (T < 200) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 100));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 350));
    sigma *= T_factor;
    // Sulfide competition — high S favors sulfides over tellurides
    if (this.fluid.S > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (this.fluid.S - 50));
    // Sylvanite competition — when Ag is comparable to Au, sylvanite wins
    if (this.fluid.Ag > this.fluid.Au * 5) sigma *= 0.5;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'calaverite');
    return Math.max(sigma, 0);
  },

  // (Au,Ag)Te2 — Au:Ag 1:1 to 3:1 monoclinic telluride. Photosensitive.
  // Wins over calaverite when Ag is comparable to Au.
  supersaturation_sylvanite() {
    if (this.fluid.Au < 0.1 || this.fluid.Ag < 0.5 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Au/1.0, Ag/5.0, Te/5.0) → (Au/0.2, Ag/5.0, Te/2.0). Same
    // rescaling rationale as calaverite — Cripple Creek Au + Te
    // averages were sub-saturating against the prior anchors. Ag/5.0
    // kept because Ag=15 in the scenario already produces a 3× factor
    // and the cation-fork dynamic (sylvanite favored when Ag dominates
    // Au) needs preservation, not amplification.
    let sigma = (this.fluid.Au / 0.2) * (this.fluid.Ag / 5.0) * (this.fluid.Te / 2.0) * 0.7;
    const T = this.temperature;
    if (T < 80 || T > 400) return 0;
    let T_factor = 1.0;
    if (T >= 150 && T <= 300) T_factor = 1.2;
    else if (T < 150) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 80));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 300));
    sigma *= T_factor;
    if (this.fluid.S > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (this.fluid.S - 50));
    // Calaverite competition — when Au ≫ Ag, calaverite wins
    if (this.fluid.Au > this.fluid.Ag * 0.5) sigma *= 0.7;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'sylvanite');
    return Math.max(sigma, 0);
  },

  // Ag2Te — silver telluride. Phase transition at 155°C (cubic↔monoclinic).
  // Wins over acanthite (Ag2S) only when Te > S.
  supersaturation_hessite() {
    if (this.fluid.Ag < 5 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Ag/30.0, Te/5.0) → (Ag/10.0, Te/2.0). Hessite is the Ag-
    // dominant end of the Au-Te paragenesis; at Cripple Creek's
    // Ag=15 ppm + Te=3 ppm the prior anchors gave σ=0.3, no
    // nucleation across the 10-seed sweep. The new anchors put
    // hessite in supersaturated territory at the scenario's
    // chemistry, unlocking the Ag→native_tellurium consumption
    // cascade (hessite debits Ag from the broth; when Ag drops
    // below the native_tellurium gate of 5 ppm, that engine fires).
    let sigma = (this.fluid.Ag / 10.0) * (this.fluid.Te / 2.0);
    const T = this.temperature;
    if (T < 50 || T > 400) return 0;
    let T_factor = 1.0;
    if (T >= 150 && T <= 250) T_factor = 1.2;
    else if (T < 150) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.006 * (T - 250));
    sigma *= T_factor;
    // Sulfide competition — acanthite (Ag2S) wins when S >> Te
    if (this.fluid.S > 30) sigma *= Math.max(0.4, 1.0 - 0.01 * (this.fluid.S - 30));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hessite');
    return Math.max(sigma, 0);
  },

  // Ag2Se — silver selenide. Phase transition at 133°C (orthorhombic↔cubic).
  // Wins over acanthite + hessite only when Se > S and Se > Te.
  supersaturation_naumannite() {
    if (this.fluid.Ag < 5 || this.fluid.Se < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.Ag / 30.0) * (this.fluid.Se / 5.0);
    const T = this.temperature;
    if (T < 50 || T > 350) return 0;
    let T_factor = 1.0;
    if (T >= 100 && T <= 200) T_factor = 1.2;
    else if (T < 100) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 200));
    sigma *= T_factor;
    if (this.fluid.S > 30) sigma *= Math.max(0.4, 1.0 - 0.01 * (this.fluid.S - 30));
    // Hessite competition — when Te > Se, hessite wins
    if (this.fluid.Te > this.fluid.Se) sigma *= 0.6;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'naumannite');
    return Math.max(sigma, 0);
  },

  // PbSe — lead selenide. Galena-structure. Above 300°C forms continuous
  // SS with galena; below, miscibility gap opens (exsolution lamellae).
  supersaturation_clausthalite() {
    if (this.fluid.Pb < 20 || this.fluid.Se < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.Pb / 80.0) * (this.fluid.Se / 5.0);
    const T = this.temperature;
    if (T < 50 || T > 450) return 0;
    let T_factor = 1.0;
    if (T >= 100 && T <= 250) T_factor = 1.2;
    else if (T < 100) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 250));
    sigma *= T_factor;
    // Galena competition — high S forms PbS instead
    if (this.fluid.S > 30) sigma *= Math.max(0.3, 1.0 - 0.015 * (this.fluid.S - 30));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'clausthalite');
    return Math.max(sigma, 0);
  },

  // CdS — hexagonal (wurtzite-structure) cadmium sulfide. High-T polymorph
  // (>200°C). Fast nucleation due to extreme Ksp (~10⁻²⁸). Forms by
  // sphalerite oxidation releasing Cd that re-precipitates against
  // residual sulfide.
  supersaturation_greenockite() {
    if (this.fluid.Cd < 0.5 || this.fluid.S < 5) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    let sigma = (this.fluid.Cd / 1.5) * (this.fluid.S / 30.0);
    const T = this.temperature;
    if (T < 25 || T > 250) return 0;
    let T_factor = 1.0;
    if (T >= 50 && T <= 150) T_factor = 1.2;
    else if (T < 50) T_factor = Math.max(0.5, 0.6 + 0.012 * (T - 25));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 150));
    sigma *= T_factor;
    // pH window 5-7
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (4.0 - this.fluid.pH));
    if (this.fluid.pH > 8.0) sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 8.0));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'greenockite');
    return Math.max(sigma, 0);
  },

  // CdS — cubic (sphalerite-structure) low-T polymorph. <100°C kinetically
  // favored. Always powdery — no discrete crystals.
  supersaturation_hawleyite() {
    if (this.fluid.Cd < 0.5 || this.fluid.S < 5) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    let sigma = (this.fluid.Cd / 1.5) * (this.fluid.S / 30.0);
    const T = this.temperature;
    if (T < 5 || T > 100) return 0;
    let T_factor = 1.0;
    if (T >= 10 && T <= 50) T_factor = 1.2;
    else if (T < 10) T_factor = Math.max(0.4, 0.5 + 0.05 * T);
    else T_factor = Math.max(0.4, 1.2 - 0.015 * (T - 50));
    sigma *= T_factor;
    // Above 100°C, greenockite (hexagonal) is favored
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (4.0 - this.fluid.pH));
    if (this.fluid.pH > 8.0) sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 8.0));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hawleyite');
    return Math.max(sigma, 0);
  },
});
