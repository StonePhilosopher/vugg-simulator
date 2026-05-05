// ============================================================
// js/32-supersat-carbonate.ts — supersaturation methods for carbonate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/carbonate.py. Minerals (11): aragonite, aurichalcite, azurite, calcite, cerussite, dolomite, malachite, rhodochrosite, rosasite, siderite, smithsonite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_calcite() {
  // Calcite has RETROGRADE solubility — less soluble at higher T.
  // Precipitates on heating or CO₂ degassing. Forms at 10-500°C.
  // Decomposes to CaO + CO₂ above ~500°C.
  // Mg poisoning: Mg²⁺ stalls calcite {10ī4} growth steps (Davis 2000;
  // Nielsen 2013). Mg/Ca > ~2 hands the polymorph to aragonite. Capped
  // at 85% inhibition — high-Mg calcite (HMC) always forms some fraction.
  if (this.temperature > 500) return 0; // thermal decomposition
  const eq = 300.0 * Math.exp(-0.005 * this.temperature);
  if (eq <= 0) return 0;
  // PROPOSAL-GEOLOGICAL-ACCURACY Phase 2 fix: real saturation is the
  // ion-activity product Q = a(Ca²⁺) × a(CO3²⁻), not min(Ca, CO3). The
  // geometric mean √(Ca·CO3) preserves the existing eq calibration
  // (= ppm) and matches the old Liebig result when Ca=CO3, but correctly
  // counts both species when they differ.
  const ca_co3 = Math.sqrt(this.fluid.Ca * effectiveCO3(this.fluid, this.temperature));
  let sigma = ca_co3 / eq;
  // Phase 2b: activity-coefficient correction (Davies). Drops σ by ~0.6-0.9×
  // at typical fluid I, more sharply at brine I. Flag-OFF default — no
  // change until calibration sweep at the flag-flip commit.
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'calcite');

  // Acid dissolution of carbonates
  if (this.fluid.pH < 5.5) {
    const acid_attack = (5.5 - this.fluid.pH) * 0.5;
    sigma -= acid_attack;
  }
  // Alkaline conditions favor carbonate precipitation. Phase 3
  // (May 2026): when CARBONATE_SPECIATION_ACTIVE is on, the proper
  // pH-dependent Bjerrum amplification of CO₃²⁻ is already baked
  // into effectiveCO3 above — so this manual boost would double-count.
  // Flag-OFF path: keep the empirical 3^(pH-7.5) factor (which
  // approximates Bjerrum) so behavior is consistent in either mode.
  else if (this.fluid.pH > 7.5 && !CARBONATE_SPECIATION_ACTIVE) {
    sigma *= Math.pow(3.0, this.fluid.pH - 7.5);
  }

  // Mg poisoning of calcite growth steps — sigmoid centered on Mg/Ca=2
  const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
  const mg_inhibition = 1.0 / (1.0 + Math.exp(-(mg_ratio - 2.0) / 0.5));
  sigma *= (1.0 - 0.85 * mg_inhibition);

  return Math.max(sigma, 0);
},

  supersaturation_siderite() {
  // FeCO3 — iron carbonate. Reducing conditions only (Fe²⁺ stability).
  if (this.fluid.Fe < 10 || effectiveCO3(this.fluid, this.temperature) < 20) return 0;
  if (this.temperature < 20 || this.temperature > 300) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 9.0) return 0;
  if (this.fluid.O2 > 0.8) return 0;  // hard reducing gate
  const eq_fe = 80.0 * Math.exp(-0.005 * this.temperature);
  if (eq_fe <= 0) return 0;
  // Phase 2 fix: Q = a(Fe²⁺) × a(CO3²⁻); see calcite for rationale.
  const fe_co3 = Math.sqrt(this.fluid.Fe * effectiveCO3(this.fluid, this.temperature));
  let sigma = fe_co3 / eq_fe;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'siderite');
  if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
  else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
  if (this.fluid.O2 > 0.3) sigma *= Math.max(0.2, 1.0 - (this.fluid.O2 - 0.3) * 1.5);
  return Math.max(sigma, 0);
},

  supersaturation_dolomite() {
  // CaMg(CO3)2 — ordered Ca-Mg carbonate. Kim 2023: T floor lowered to
  // 10°C — ambient T is fine thermodynamically, kinetics handled by f_ord.
  if (this.fluid.Mg < 25 || this.fluid.Ca < 30 || effectiveCO3(this.fluid, this.temperature) < 20) return 0;
  if (this.temperature < 10 || this.temperature > 400) return 0;
  if (this.fluid.pH < 6.5 || this.fluid.pH > 10.0) return 0;
  const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
  if (mg_ratio < 0.3 || mg_ratio > 30.0) return 0;
  const eq = 200.0 * Math.exp(-0.005 * this.temperature);
  if (eq <= 0) return 0;
  // Phase 2 fix: real Q for dolomite CaMg(CO3)₂ is
  // a(Ca²⁺)·a(Mg²⁺)·a(CO3²⁻)². The fourth-root keeps the result in
  // ppm units (comparable to eq) while properly weighting CO3 by its
  // stoichiometric coefficient of 2. Old form min(√(Ca·Mg), 2·CO3)
  // was a Liebig hybrid: half-correct (geometric mean for cations) +
  // half-Liebig (min against CO3), which under-counted CO3 even when
  // it was abundant.
  const product = Math.pow(
    this.fluid.Ca * this.fluid.Mg * effectiveCO3(this.fluid, this.temperature) * effectiveCO3(this.fluid, this.temperature), 0.25);
  let sigma = product / eq;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'dolomite');
  const ratio_distance = Math.abs(Math.log10(mg_ratio));
  sigma *= Math.exp(-ratio_distance * 1.0);
  if (this.temperature > 250) sigma *= Math.max(0.3, 1.0 - (this.temperature - 250) / 200.0);
  if (this.fluid.pH < 6.5) sigma -= (6.5 - this.fluid.pH) * 0.3;
  return Math.max(sigma, 0);
},

  supersaturation_rhodochrosite() {
  // MnCO3 — pink Mn carbonate, structurally identical to calcite (R3̄c).
  // T 20-250°C, pH 5-9, Mn²⁺ stable in moderate-to-reducing conditions.
  if (this.fluid.Mn < 5 || effectiveCO3(this.fluid, this.temperature) < 20) return 0;
  if (this.temperature < 20 || this.temperature > 250) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 9.0) return 0;
  if (this.fluid.O2 > 1.5) return 0;
  const eq_mn = 50.0 * Math.exp(-0.005 * this.temperature);
  if (eq_mn <= 0) return 0;
  // Phase 2 fix: Q = a(Mn²⁺) × a(CO3²⁻); see calcite for rationale.
  const mn_co3 = Math.sqrt(this.fluid.Mn * effectiveCO3(this.fluid, this.temperature));
  let sigma = mn_co3 / eq_mn;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'rhodochrosite');
  if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
  else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
  if (this.fluid.O2 > 0.8) sigma *= Math.max(0.3, 1.5 - this.fluid.O2);
  return Math.max(sigma, 0);
},

  supersaturation_aragonite() {
  // Orthorhombic CaCO₃ dimorph — metastable at surface but kinetically
  // favored when Mg/Ca > ~1.5 (dominant, Folk 1974 / Morse 1997),
  // T > ~50°C (Burton & Walter 1987 in low-Mg), or Ω > ~10 (Ostwald
  // step rule, Sun 2015). Trace Sr/Pb/Ba give a small additional boost.
  // Pressure is the thermodynamic sorter (stable above ~0.4 GPa) but is
  // irrelevant at vug/hot-spring pressures — don't use it as a gate.
  if (this.fluid.Ca < 30 || effectiveCO3(this.fluid, this.temperature) < 20) return 0;
  if (this.fluid.pH < 6.0 || this.fluid.pH > 9.0) return 0;

  const eq = 300.0 * Math.exp(-0.005 * this.temperature);
  if (eq <= 0) return 0;
  // Phase 2 fix: Q = a(Ca²⁺) × a(CO3²⁻); see calcite for rationale.
  const ca_co3 = Math.sqrt(this.fluid.Ca * effectiveCO3(this.fluid, this.temperature));
  let omega = ca_co3 / eq;
  if (ACTIVITY_CORRECTED_SUPERSAT) omega *= activityCorrectionFactor(this.fluid, 'aragonite');

  const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
  const mg_factor = 1.0 / (1.0 + Math.exp(-(mg_ratio - 1.5) / 0.3));
  const T_factor = 1.0 / (1.0 + Math.exp(-(this.temperature - 50.0) / 15.0));
  const omega_factor = 1.0 / (1.0 + Math.exp(-(Math.log10(Math.max(omega, 0.01)) - 1.0) / 0.3));
  const trace_sum = this.fluid.Sr + this.fluid.Pb + this.fluid.Ba;
  const trace_ratio = trace_sum / Math.max(this.fluid.Ca, 0.01);
  const trace_factor = 1.0 + 0.3 / (1.0 + Math.exp(-(trace_ratio - 0.01) / 0.005));

  // Weighted sum, not product — Mg/Ca alone is enough at high values.
  const favorability = (0.70 * mg_factor + 0.20 * T_factor + 0.10 * omega_factor) * trace_factor;
  return omega * favorability;
},

  supersaturation_malachite() {
  if (this.fluid.Cu < 5 || effectiveCO3(this.fluid, this.temperature) < 20 || this.fluid.O2 < 0.3) return 0;
  // Denominators reference realistic supergene weathering fluid (Cu ~25 ppm,
  // CO₃ ~100 ppm). The older 50/200 values were tuned for Cu-saturated
  // porphyry fluids and starved supergene vugs of their flagship Cu mineral.
  // Malachite-vs-azurite competition is encoded by carbonate-activity
  // thresholds (Vink 1986, Mineralogical Magazine 50:43-47): malachite
  // CO3 ≥20, azurite CO3 ≥120 — the sim-scale encoding of Vink's
  // log(pCO2) ≈ -3.5 univariant boundary at 25°C. Azurite drops back
  // to malachite via the paramorph mechanic in grow_azurite when CO3
  // falls during a run (Bisbee step 225 ev_co2_drop).
  // See research/research-broth-ratio-malachite-azurite.md.
  let sigma = (this.fluid.Cu / 25.0) * (effectiveCO3(this.fluid, this.temperature) / 100.0) * (this.fluid.O2 / 1.0);
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.005 * (this.temperature - 50));
  }
  if (this.fluid.pH < 4.5) {
    sigma -= (4.5 - this.fluid.pH) * 0.5;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'malachite');
  return Math.max(sigma, 0);
},

  supersaturation_smithsonite() {
  // v17 reconciliation (May 2026): supergene-only per
  // research-smithsonite.md (T 10-50°C optimum, never above ~80°C
  // in nature). Pre-v17 JS hard cap at 200°C was too lenient.
  // Tightened to 100°C hard with steep decay above 80°C.
  if (this.fluid.Zn < 20 || effectiveCO3(this.fluid, this.temperature) < 50 || this.fluid.O2 < 0.2) return 0;
  if (this.temperature > 100) return 0;
  if (this.fluid.pH < 5) return 0;
  let sigma = (this.fluid.Zn / 80.0) * (effectiveCO3(this.fluid, this.temperature) / 200.0) * (this.fluid.O2 / 1.0);
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.04 * (this.temperature - 80));
  }
  if (this.fluid.pH > 7) sigma *= 1.2;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'smithsonite');
  return Math.max(sigma, 0);
},

  supersaturation_azurite() {
  if (this.fluid.Cu < 20 || effectiveCO3(this.fluid, this.temperature) < 120 || this.fluid.O2 < 1.0) return 0;
  const cu_f = Math.min(this.fluid.Cu / 40.0, 2.0);
  const co_f = Math.min(effectiveCO3(this.fluid, this.temperature) / 150.0, 1.8);
  const o_f  = Math.min(this.fluid.O2 / 1.5, 1.3);
  let sigma = cu_f * co_f * o_f;
  if (this.temperature > 50) sigma *= Math.exp(-0.06 * (this.temperature - 50));
  if (this.fluid.pH < 5.0) sigma -= (5.0 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'azurite');
  return Math.max(sigma, 0);
},

  supersaturation_cerussite() {
  if (this.fluid.Pb < 15 || effectiveCO3(this.fluid, this.temperature) < 30) return 0;
  const pb_f = Math.min(this.fluid.Pb / 40.0, 2.0);
  const co_f = Math.min(effectiveCO3(this.fluid, this.temperature) / 80.0, 1.5);
  let sigma = pb_f * co_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.4;
  else if (this.fluid.pH > 7.0) sigma *= 1.0 + (this.fluid.pH - 7.0) * 0.1;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cerussite');
  return Math.max(sigma, 0);
},

  supersaturation_rosasite() {
  if (this.fluid.Cu < 5 || this.fluid.Zn < 3 || effectiveCO3(this.fluid, this.temperature) < 30) return 0;
  if (this.temperature < 10 || this.temperature > 40) return 0;
  if (this.fluid.O2 < 0.8) return 0;
  if (this.fluid.pH < 6.5) return 0;
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const cu_fraction = this.fluid.Cu / cu_zn_total;  // safe — Cu>=5 above
  if (cu_fraction < 0.5) return 0;  // broth-ratio branch: Cu must dominate
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const zn_f = Math.min(this.fluid.Zn / 25.0, 2.0);
  const co3_f = Math.min(effectiveCO3(this.fluid, this.temperature) / 100.0, 2.0);
  let sigma = cu_f * zn_f * co3_f;
  if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
  else if (cu_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 30) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.5, 1.2 - 0.07 * (T - 30));
  sigma *= T_factor;
  if (this.fluid.Fe > 60) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'rosasite');
  return Math.max(sigma, 0);
},

  supersaturation_aurichalcite() {
  if (this.fluid.Zn < 5 || this.fluid.Cu < 3 || effectiveCO3(this.fluid, this.temperature) < 30) return 0;
  if (this.temperature < 10 || this.temperature > 40) return 0;
  if (this.fluid.O2 < 0.8) return 0;
  // pH gate — see vugg.py supersaturation_aurichalcite for citation
  // (Pinch & Wilson 1977 — real Tsumeb fluids active at pH 5.5-7.5).
  if (this.fluid.pH < 6.0) return 0;
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const zn_fraction = this.fluid.Zn / cu_zn_total;
  if (zn_fraction < 0.5) return 0;  // broth-ratio branch: Zn must dominate
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const zn_f = Math.min(this.fluid.Zn / 25.0, 2.0);
  const co3_f = Math.min(effectiveCO3(this.fluid, this.temperature) / 100.0, 2.0);
  let sigma = cu_f * zn_f * co3_f;
  if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
  else if (zn_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 28) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.5, 1.2 - 0.06 * (T - 28));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'aurichalcite');
  return Math.max(sigma, 0);
},
});
