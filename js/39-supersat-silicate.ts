// ============================================================
// js/39-supersat-silicate.ts — supersaturation methods for silicate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/silicate.py. Minerals (13): albite, apophyllite, aquamarine, beryl, chrysocolla, emerald, feldspar, heliodor, morganite, quartz, spodumene, topaz, tourmaline. Family helpers: _beryl_base_sigma, _corundum_base_sigma.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_quartz() {
  const eq = this.silica_equilibrium(this.effectiveTemperature);
  if (eq <= 0) return 0;
  let sigma = this.fluid.SiO2 / eq;

  // HF attack on quartz: low pH + high F = dissolution
  if (this.fluid.pH < 4.0 && this.fluid.F > 20) {
    const hf_attack = (4.0 - this.fluid.pH) * (this.fluid.F / 50.0) * 0.3;
    sigma -= hf_attack;
  }

  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'quartz');
  return Math.max(sigma, 0);
},

  supersaturation_feldspar() {
  // K-feldspar (sanidine/orthoclase/microcline polymorphs).
  // v17 reconciliation (May 2026): pre-v17 JS folded Na into a
  // K-or-Na fork using max(K,Na), but albite has its own
  // supersaturation_albite engine — Na fluids should route there,
  // not double-fire here. Python's K-only design has been canonical
  // since the data model split feldspar/albite as separate species.
  // JS now matches Python's K-only structure, with a hard 800°C
  // upper cap (sanidine→melt boundary) added.
  if (this.fluid.K < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  // Hard upper cap — feldspar melts above 800°C.
  if (this.temperature > 800) return 0;
  let sigma = (this.fluid.K / 40.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
  // Feldspars need HIGH temperature — they're igneous/metamorphic
  if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
  // Acid destabilization — kaolinization regime, mirrors grow_feldspar
  // dissolution at pH < 4. KAlSi₃O₈ + H⁺ → kaolinite + K⁺ + SiO₂.
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 2.0;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'feldspar');
  return Math.max(sigma, 0);
},

  supersaturation_apophyllite() {
  if (this.fluid.K < 5 || this.fluid.Ca < 30 || this.fluid.SiO2 < 800 || this.fluid.F < 2) return 0;
  if (this.temperature < 50 || this.temperature > 250) return 0;
  if (this.fluid.pH < 7.0 || this.fluid.pH > 10.0) return 0;
  if (this.pressure > 0.5) return 0;
  const product = (this.fluid.K / 30.0) * (this.fluid.Ca / 100.0) * (this.fluid.SiO2 / 1500.0) * (this.fluid.F / 8.0);
  let T_factor;
  if (this.temperature >= 100 && this.temperature <= 200) T_factor = 1.4;
  else if ((this.temperature >= 80 && this.temperature < 100) || (this.temperature > 200 && this.temperature <= 230)) T_factor = 1.0;
  else T_factor = 0.6;
  const pH_factor = (this.fluid.pH >= 7.5 && this.fluid.pH <= 9.0) ? 1.2 : 0.8;
  let sigma = product * T_factor * pH_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'apophyllite');
  return sigma;
},

  supersaturation_albite() {
  if (this.fluid.Na < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  let sigma = (this.fluid.Na / 35.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
  if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
  // Acid destabilization — albite kaolinizes at pH < 3 (more
  // resistant than K-feldspar). Mirrors grow_albite dissolution gate.
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 2.0;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'albite');
  return Math.max(sigma, 0);
},

  supersaturation_spodumene() {
  if (this.fluid.Li < 8 || this.fluid.Al < 5 || this.fluid.SiO2 < 40) return 0;
  const li_f = Math.min(this.fluid.Li / 20.0, 2.0);
  const al_f = Math.min(this.fluid.Al / 10.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
  let sigma = li_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 450 && T <= 600) T_factor = 1.0;
  else if (T >= 400 && T < 450) T_factor = 0.5 + 0.01 * (T - 400);
  else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
  else if (T > 700) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.5 - 0.008 * (400 - T));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'spodumene');
  return Math.max(sigma, 0);
},

  supersaturation_chrysocolla() {
  if (this.fluid.Cu < 5 || this.fluid.SiO2 < 20 || this.fluid.O2 < 0.3) return 0;
  if (this.temperature < 5 || this.temperature > 80) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
  if (this.fluid.CO3 > this.fluid.SiO2) return 0;
  const cu_f = Math.min(this.fluid.Cu / 30.0, 3.0);
  const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.5);
  const o_f  = Math.min(this.fluid.O2 / 1.0, 1.5);
  const T = this.temperature;
  let t_f;
  if (T >= 15 && T <= 40) t_f = 1.0;
  else if (T < 15) t_f = Math.max(0.3, T / 15.0);
  else t_f = Math.max(0.3, 1.0 - (T - 40) / 40.0);
  const pH = this.fluid.pH;
  let ph_f;
  if (pH >= 6.0 && pH <= 7.5) ph_f = 1.0;
  else if (pH < 6.0) ph_f = Math.max(0.4, 1.0 - (6.0 - pH) * 0.6);
  else ph_f = Math.max(0.4, 1.0 - (pH - 7.5) * 0.6);
  let sigma = cu_f * si_f * o_f * t_f * ph_f;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chrysocolla');
  return Math.max(sigma, 0);
},

  _beryl_base_sigma() {
  if (this.fluid.Be < 10 || this.fluid.Al < 6 || this.fluid.SiO2 < 50) return 0;
  const be_f = Math.min(this.fluid.Be / 15.0, 2.5);
  const al_f = Math.min(this.fluid.Al / 12.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 350.0, 1.5);
  let sigma = be_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 350 && T <= 550) T_factor = 1.0;
  else if (T >= 300 && T < 350) T_factor = 0.6 + 0.008 * (T - 300);
  else if (T > 550 && T <= 650) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 550));
  else if (T > 650) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.6 - 0.006 * (300 - T));
  sigma *= T_factor;
  // Activity correction at the family-base helper applies uniformly to
  // beryl/emerald/aquamarine/morganite/heliodor (same Be₃Al₂Si₆O₁₈
  // shared-cation set; chromophore traces don't move I).
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'beryl');
  return Math.max(sigma, 0);
},

  supersaturation_beryl() {
  const f = this.fluid;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;       // emerald priority
  if (f.Mn >= 2.0) return 0;                     // morganite priority
  if (f.Fe >= 15 && f.O2 > 0.5) return 0;        // heliodor priority
  if (f.Fe >= 8) return 0;                       // aquamarine priority
  return this._beryl_base_sigma();
},

  supersaturation_emerald() {
  if (this.fluid.Cr < 0.5 && this.fluid.V < 1.0) return 0;
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const chrom_f = Math.max(
    Math.min(this.fluid.Cr / 1.5, 1.8),
    Math.min(this.fluid.V / 3.0, 1.5)
  );
  return base * chrom_f;
},

  supersaturation_aquamarine() {
  const f = this.fluid;
  if (f.Fe < 8) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  if (f.Mn >= 2.0) return 0;                 // morganite
  if (f.Fe >= 15 && f.O2 > 0.5) return 0;    // heliodor
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const fe_f = Math.min(f.Fe / 12.0, 1.8);
  return base * fe_f;
},

  supersaturation_morganite() {
  const f = this.fluid;
  if (f.Mn < 2.0) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const mn_f = Math.min(f.Mn / 4.0, 1.8);
  return base * mn_f;
},

  supersaturation_heliodor() {
  const f = this.fluid;
  if (f.Fe < 15 || f.O2 <= 0.5) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  if (f.Mn >= 2.0) return 0;                 // morganite
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const fe_f = Math.min(f.Fe / 20.0, 1.6);
  const o2_f = Math.min(f.O2 / 1.0, 1.3);
  return base * fe_f * o2_f;
},

  _corundum_base_sigma() {
  if (this.fluid.Al < 15) return 0;
  if (this.fluid.SiO2 > 50) return 0;  // UPPER gate — defining constraint
  if (this.fluid.pH < 6 || this.fluid.pH > 10) return 0;
  const T = this.temperature;
  if (T < 400 || T > 1000) return 0;
  const al_f = Math.min(this.fluid.Al / 25.0, 2.0);
  let sigma = al_f;
  let T_factor;
  if (T >= 600 && T <= 900) T_factor = 1.0;
  else if (T >= 400 && T < 600) T_factor = 0.4 + 0.003 * (T - 400);
  else if (T > 900 && T <= 1000) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 900));
  else T_factor = 0.2;
  sigma *= T_factor;
  const pH_factor = (this.fluid.pH >= 7 && this.fluid.pH <= 9) ? 1.0 : 0.6;
  sigma *= pH_factor;
  // Activity correction at the family-base helper applies uniformly to
  // corundum/ruby/sapphire (shared Al₂O₃ formula; trace chromophores
  // don't move I).
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'corundum');
  return Math.max(sigma, 0);
},

  supersaturation_tourmaline() {
  if (this.fluid.Na < 3 || this.fluid.B < 6 || this.fluid.Al < 8 || this.fluid.SiO2 < 60) return 0;
  const na_f = Math.min(this.fluid.Na / 20.0, 1.5);
  const b_f  = Math.min(this.fluid.B / 15.0, 2.0);
  const al_f = Math.min(this.fluid.Al / 15.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
  let sigma = na_f * b_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 400 && T <= 600) T_factor = 1.0;
  else if (T >= 350 && T < 400) T_factor = 0.5 + 0.01 * (T - 350);
  else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
  else if (T > 700) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.5 - 0.008 * (350 - T));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tourmaline');
  return Math.max(sigma, 0);
},

  supersaturation_topaz() {
  if (this.fluid.F < 20 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  const al_f = Math.min(this.fluid.Al / 8.0, 2.0);
  const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
  const f_f  = Math.min(this.fluid.F / 25.0, 1.5);
  let sigma = al_f * si_f * f_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 340 && T <= 400) T_factor = 1.0;
  else if (T >= 300 && T < 340) T_factor = 0.6 + 0.01 * (T - 300);
  else if (T > 400 && T <= 500) T_factor = Math.max(0.2, 1.0 - 0.008 * (T - 400));
  else if (T > 500 && T <= 600) T_factor = Math.max(0.1, 0.4 - 0.003 * (T - 500));
  else T_factor = 0.1;
  sigma *= T_factor;
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'topaz');
  return Math.max(sigma, 0);
},
});
