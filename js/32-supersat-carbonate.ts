// ============================================================
// js/32-supersat-carbonate.ts — supersaturation methods for carbonate minerals
// ============================================================
// Authoritative TypeScript carbonate supersaturation runtime. Minerals (11):
// aragonite, aurichalcite, azurite, calcite, cerussite, dolomite, malachite,
// rhodochrosite, rosasite, siderite, smithsonite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Carbonate MINERAL_GATES exports ----

const MINERAL_GATES_calcite: MineralGates = {
  // v144 (Week 9 SI-engine promotion): sigma_crit bumped 1.3 → 1.5.
  // The empirical engine's 1.3 was in empirical-sigma units (ppm-style
  // ratio Ca·CO3 / eq); the SI engine returns textbook omega = IAP/Ksp
  // (=1 at thermodynamic equilibrium). Heterogeneous nucleation on a
  // vugg wall starts at omega ~ 1.5-3 per Morse & Arvidson 2002 review,
  // matching what the calibration probe (tools/w9_calcite_calibration_
  // probe.mjs) observed: median omega at empirical nucleation threshold
  // = 1.28, p75 = 4.29. 1.5 sits at the lower edge — kinetic barrier
  // present but not overrestrictive.
  sigma_crit: 1.5,
  T_max: 500, T_optimal: 100,
  fluid_min: { Ca: 1, CO3: 1 },
  surface_energy: 'medium',
  _sources: ['calcite engine v17+', 'Davis 2000', 'Nielsen 2013', 'Söhnel & Mullin 1982', 'Morse & Arvidson 2002'],
  _notes: 'Retrograde solubility (precipitates on heating / CO2 degassing). Mg/Ca > ~2 routes to aragonite via Mg poisoning of growth steps. v144 SI engine: sigma is textbook omega = IAP/Ksp; sigma_crit 1.5 reflects heterogeneous nucleation barrier on cavity walls.',
};

const MINERAL_GATES_aragonite: MineralGates = {
  // v147 (Week 12 SI-engine promotion): sigma_crit stays at 1.0
  // because the supersaturation_aragonite function multiplies omega
  // by the kinetic favorability factor (Mg-factor × T-factor ×
  // omega-factor × trace-factor) — same magnitudes as the empirical
  // engine. Aragonite is unique among the promoted carbonates in
  // keeping a kinetic modifier on the sigma scale; it's the
  // metastable polymorph, so its firing rule depends on KINETIC
  // criteria (Folk 1974 Mg/Ca preference, Burton-Walter 1987 T
  // preference, Morse 1997 omega-driven Ostwald step rule) layered
  // on top of the textbook thermodynamic omega.
  //
  // T_max 400°C added in v147: aragonite is the metastable polymorph
  // and reverts rapidly to calcite above ~400°C at low pressure per
  // Carlson (1983) "The polymorphs of CaCO3 and the aragonite-calcite
  // transformation," Reviews in Mineralogy vol 11 (Carbonates:
  // Mineralogy and Chemistry, ed. Reeder), MSA, pp 191-225. The
  // high-T metamorphic aragonite firings in v146
  // marble_contact_metamorphism (T=698°C) were a geological anomaly
  // the empirical engine didn't catch. Adding the gate makes the
  // structural fact (aragonite has a real T-limit) load-bearing.
  // (Author + year + topic recalled correctly during W12 prep but
  // journal/volume/pages first written as fabricated "Geol. Soc. Am.
  // Memoir 161:153-162" — web-verified-corrected before commit.)
  sigma_crit: 1.0,
  T_max: 400, T_optimal: 80,
  fluid_min: { Ca: 30, CO3: 20 },
  pH_min: 6.0, pH_max: 9.0,
  surface_energy: 'low',
  _sources: ['aragonite engine v17+', 'Folk 1974', 'Morse 1997', 'Burton & Walter 1987 (seawater 5-25°C — see v228 note)', 'Wollast 1990', 'Carlson 1983', 'Fouke et al. 2000 JSR 70:565 (Mammoth facies)', 'Casella et al. 2017 Biogeosciences 14:1461 (inversion kinetics)', 'Wassenburg et al. 2016 GCA (Mg/Ca crossover 1.1 mol/mol)', 'Bots et al. 2011 Geology 39:331 (SO4 evaluated, excluded)', 'Barber et al. 1975 Chemical Geology 16:239-241 DOI 10.1016/0009-2541(75)90032-7 (Co poisoning at 25 C)', 'González-López et al. 2018 Chemical Geology 482:91-100 DOI 10.1016/j.chemgeo.2018.02.003 (Co/Ca pathway)', 'Brazier & Mavromatis 2022 Chemical Geology 600:120863 DOI 10.1016/j.chemgeo.2022.120863 (Co partitioning)'],
  _notes: 'Orthorhombic CaCO3 dimorph. Selectors: hard-present aqueous molar Mg/Ca >=1.1 OR explicit shallow 40-100 C spring OR 20-30 C dissolved Co >=5e-4 mol/kg within Co/Ca<0.6 and below the >=1e-2 M amorphous-only limit OR high-pressure stability. Smooth tails cannot create selectors outside evidence domains. Omega amplifies but cannot select. Co-bearing shells debit trace Co at equilibrium DCo=0.1 in the measured 25 C domain.',
};

// Cobalt can poison calcite growth and redirect CaCO3 precipitation toward
// aragonite. Barber et al. (1975) observed the first mixtures at 5e-4 M Co,
// mostly aragonite by 3e-3 M, and amorphous material alone at 1e-2 M. The
// simulator's ppm convention is mg/kg, so concentration/1000/M gives mol/kg;
// at these dilute concentrations molality is the honest available proxy for
// the experiment's molarity. We keep the temperature envelope tight around
// the ambient experiments instead of extrapolating this selector into hot
// veins.
function aragoniteCoSelector(fluid: any, temperatureC: number): any {
  const cobaltMolal = Math.max(0, Number(fluid?.Co) || 0) / 1000 / 58.933194;
  const calciumMolal = Math.max(0, Number(fluid?.Ca) || 0) / 1000 / 40.078;
  const aqueousCoCaMolarRatio = cobaltMolal / Math.max(calciumMolal, 1e-12);
  const temperatureSupported = temperatureC >= 20 && temperatureC <= 30;
  const compositionSupported = aqueousCoCaMolarRatio < 0.6;
  const crystallineWindow = cobaltMolal >= 5e-4 && cobaltMolal < 1e-2;
  const present = temperatureSupported && compositionSupported && crystallineWindow;
  const progress = Math.max(0, Math.min(1, (cobaltMolal - 5e-4) / (3e-3 - 5e-4)));
  return {
    schema: 'aragonite-Co-selector-v1',
    present,
    // The lower anchor is the first experimentally observed aragonite+calcite
    // mixture, so crossing it must open (not merely hint at) the aragonite
    // route. The 0.90→1.00 ramp represents increasing selector confidence;
    // ordinary saturation, nucleation RNG, local substrate, and Co mass still
    // decide whether a crystal actually appears.
    strength: present ? 0.90 + 0.10 * progress : 0,
    cobaltMolal,
    aqueousCoCaMolarRatio,
    temperatureSupported,
    compositionSupported,
    crystallineWindow,
    lowerThresholdMolal: 5e-4,
    mostlyAragoniteMolal: 3e-3,
    amorphousOnlyThresholdMolal: 1e-2,
  };
}

function aragoniteCoPartitioning(fluid: any, temperatureC: number): any {
  const selector = aragoniteCoSelector(fluid, temperatureC);
  // Brazier & Mavromatis (2022): equilibrium log DCo ≈ -1.0 at
  // 25 C/1 bar. D = (Co/Ca)solid / (Co/Ca)aqueous.
  const distributionCoefficient = selector.temperatureSupported ? 0.1 : 0;
  const formulaCoefficientCo = selector.present
    ? distributionCoefficient * selector.aqueousCoCaMolarRatio
    : 0;
  const effectiveBookedDistributionCoefficient = selector.aqueousCoCaMolarRatio > 0
    ? formulaCoefficientCo / selector.aqueousCoCaMolarRatio : 0;
  const targetSolidCoPpm = formulaCoefficientCo > 0
    ? formulaCoefficientCo * 58.933194 / 100.0869 * 1e6
    : 0;
  return {
    schema: 'aragonite-Co-partition-v2',
    ...selector,
    distributionCoefficient,
    effectiveBookedDistributionCoefficient,
    formulaCoefficientCo,
    targetSolidCoPpm,
    domain: '20-30 C ambient Co-bearing CaCO3; equilibrium and booked DCo=0.1 anchored at 25 C',
  };
}

const MINERAL_GATES_dolomite: MineralGates = {
  // v145 (Week 10 SI-engine promotion): sigma_crit bumped 1.0 → 10.
  // The empirical engine's 1.0 was in empirical-sigma units (4th-root
  // of Ca·Mg·CO3² / eq, ppm-scale); the SI engine returns textbook
  // omega = IAP/Ksp where dolomite's a(Ca)·a(Mg)·a(CO3)² gives huge
  // omegas in any Mg-rich brine (median omega at empirical threshold
  // = 504 per tools/w10_dolomite_calibration_probe.mjs, p25-p75
  // 486-525). Setting sigma_crit = 10 acknowledges a meaningful
  // heterogeneous-nucleation barrier without double-counting Kim
  // 2023's f_ord gate (which is the real kinetic barrier for
  // ordered dolomite and lives in dolomiteRate / grow_dolomite).
  sigma_crit: 10,
  T_min: 10, T_max: 400, T_optimal: 150,
  fluid_min: { Ca: 30, Mg: 25, CO3: 20 },
  pH_min: 6.5, pH_max: 10.0,
  surface_energy: 'medium',
  _sources: ['dolomite engine v17+', 'Kim 2023', 'Morse & Arvidson 2002'],
  _notes: 'Mg/Ca window 0.3-30. T floor lowered to 10°C (Kim 2023) — ambient T thermodynamically fine, kinetics handled by ordering factor. v145 SI engine: sigma is textbook omega; sigma_crit 10 acknowledges nucleation kinetic barrier separate from the Kim f_ord ordering gate.',
};

const MINERAL_GATES_HMC: MineralGates = {
  // High-Magnesium Calcite Ca(1-x)Mg(x)CO3 with x ≈ 0.05-0.30.
  // The disordered Mg-substituted calcite phase that's the kinetic
  // precursor to ordered dolomite (Kim 2023 cyclic-omega mechanism).
  // Forms as marine + sabkha cement and biogenic skeletons
  // (echinoderms, coralline algae, foraminifera). Not a discrete IMA
  // species — a varietal-name on the calcite-dolomite solid-solution
  // joining ordered dolomite at x ≥ ~0.45.
  //
  // sigma_crit: SI-engine omega scale, comparable to calcite (1.5)
  // but tighter — HMC is a metastable intermediate, so a meaningful
  // kinetic barrier prevents over-firing at marginal supersaturation.
  // Empirical sigma_crit (when flag is off) is in ppm-style ratio.
  // v146 sigma_crit: 2.0 (slightly above calcite's 1.5; HMC nucleates
  // less readily than pure calcite because the Mg-substituted lattice
  // has higher surface energy per Davis 2000).
  sigma_crit: 2.0,
  T_min: 0, T_max: 60, T_optimal: 25,
  fluid_min: { Ca: 10, Mg: 5, CO3: 20 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'medium',
  _sources: ['Busenberg_Plummer_1989', 'Glynn_Reardon_1990', 'Mucci_1987', 'Mucci_Morse_1983', 'Davis_2000', 'Kim_2023', 'Goldsmith_Graf_1958'],
  _notes: 'The candidate shell must contain 4-30 mol% Mg under a domain-bounded partition screen using aqueous molar Mg/Ca. Mucci 1987 D_Mg(T) applies only to the standard-seawater ratio+salinity proxy; Mucci-Morse 1983 supplies the separate Mg/Ca 7.5-20, seawater-matrix plateau at 25 C. Other parent fluids produce an explicit coverage gap, not a low-HMC verdict. T_max 60°C is an authored kinetic occurrence gate, not a solid-solution equilibrium boundary. The subregular calculation is a metastable fixed-composition screen inside the documented 25 C miscibility gap, never a stable homogeneous-solution claim.',
};

const MINERAL_GATES_siderite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 20, T_max: 300, T_optimal: 100,
  fluid_min: { Fe: 10, CO3: 20 },
  pH_min: 5.0, pH_max: 9.0,
  O2_max: 0.8,                  // reducing required (Fe2+ stability)
  surface_energy: 'medium',
  _sources: ['siderite engine v17+'],
  _notes: 'FeCO3 — reducing-fluid Fe carbonate. carbonateRedoxAnoxic gate.',
};

const MINERAL_GATES_rhodochrosite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 20, T_max: 250, T_optimal: 80,
  fluid_min: { Mn: 5, CO3: 20 },
  pH_min: 5.0, pH_max: 9.0,
  O2_max: 1.5,                  // moderate-to-reducing
  surface_energy: 'medium',
  _sources: ['rhodochrosite engine v17+'],
  _notes: 'MnCO3 pink carbonate — structurally identical to calcite (R3̄c).',
};

const MINERAL_GATES_malachite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Cu: 5, CO3: 20 },
  O2_min: 0.3,
  pH_min: 4.5,
  surface_energy: 'low',
  _sources: ['malachite engine v17+', 'Vink 1986 Mineralogical Magazine 50:43-47'],
  _notes: 'Cu2CO3(OH)2 — wins over azurite when CO3 in [20, 120] ppm window (Vink 1986 univariant boundary).',
};

const MINERAL_GATES_smithsonite: MineralGates = {
  sigma_crit: 1.0,
  T_max: 100, T_optimal: 30,
  fluid_min: { Zn: 20, CO3: 50 },
  // rung-4d (SIM 233): 0.2 → 0.5, the willemite-4a shape. A floor below the
  // SO₄/HS boundary (0.2 ≈ 0 mV) let the supergene Zn carbonate mint at
  // elmwood@88, Eh +24 — ONE step after sphalerite nucleated at the same
  // +24 — Zn double-booked into sulfide + supergene carbonate in a single
  // reduced MVT brine (elmwood expects neither; its Zn is sphalerite). Legit
  // firings sit at +322/+357 (supergene_oxidation, expects-listed): zero
  // collateral. 0.5 = the Zn partition, mirroring cerussite's Pb partition
  // (rung 4c): sphalerite below +100 mV, smithsonite above. Also settles the
  // tn457 question structurally — that fluid tops out at +76, so nonsulfide
  // Zn can never co-precipitate there; the old proposal's "tn457 smithsonite"
  // claim was the confabulation, not the sim.
  O2_min: 0.5,
  pH_min: 5,
  surface_energy: 'medium',
  _sources: ['smithsonite engine v17+', 'research-smithsonite.md'],
  _notes: 'Supergene-only (T 10-50°C optimum). v17 tightened from 200°C to 100°C hard cap to match research.',
};

const MINERAL_GATES_azurite: MineralGates = {
  sigma_crit: 1.4,
  T_optimal: 30,
  fluid_min: { Cu: 20, CO3: 120 },
  O2_min: 1.0,
  pH_min: 5.0,
  surface_energy: 'low',
  _sources: ['azurite engine v17+', 'Vink 1986'],
  _notes: 'Cu3(CO3)2(OH)2 — high-CO3 (≥120) regime of Cu carbonate field. Reverts to malachite paramorph if CO3 drops.',
};

const MINERAL_GATES_cerussite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Pb: 15, CO3: 30 },
  O2_min: 0.5,
  pH_min: 4.0,
  surface_energy: 'medium',
  _sources: ['cerussite engine v17+', 'Garrels 1954 GCA 5:153-168', 'Sato 1992 GCA 56:3133-3156'],
  _notes: 'PbCO3 SUPERGENE Pb carbonate — the Pb analog of smithsonite (ZnCO3), forms by galena OXIDATION. O2_min 0.5 (Eh ≥ +100 mV) added rung-4c (SIM 232): cerussite forms ABOVE galena stability (the +100 mV galena ceiling from rung-4b) — the redox partition of Pb, galena below, cerussite above. Before, cerussite ALONE among the supergene carbonates lacked the carbonateRedoxAvailable gate its siblings (smithsonite/malachite/azurite/rosasite/aurichalcite) all have, so it minted in reducing hypogene brines (mvt Eh -36, elmwood +24) beside actively-growing galena. Substrate pref: dissolving anglesite > dissolving galena > active galena.',
};

const MINERAL_GATES_rosasite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 40, T_optimal: 22,
  fluid_min: { Cu: 5, Zn: 3, CO3: 30 },
  O2_min: 0.8,
  pH_min: 6.5,
  surface_energy: 'low',
  _sources: ['rosasite engine v17+'],
  _notes: '(Cu,Zn)2(CO3)(OH)2 — Cu-dominant branch (Cu fraction ≥ 0.5). Fe > 60 ppm suppresses.',
};

const MINERAL_GATES_aurichalcite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 40, T_optimal: 20,
  fluid_min: { Zn: 5, Cu: 3, CO3: 30 },
  O2_min: 0.8,
  pH_min: 6.0,
  surface_energy: 'low',
  _sources: ['aurichalcite engine v17+', 'Pinch & Wilson 1977'],
  _notes: '(Zn,Cu)5(CO3)2(OH)6 — Zn-dominant branch (Zn fraction ≥ 0.5). Tsumeb fluids pH 5.5-7.5.',
};

const MINERAL_GATES_strontianite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 5, T_max: 250, T_optimal: 115,
  fluid_min: { Sr: 30, CO3: 50 },
  pH_min: 6.0,
  surface_energy: 'medium',
  _sources: ['strontianite engine v63+'],
  _notes: 'SrCO3 — pseudohex cyclic twinning diagnostic. S > 50 ppm suppresses (celestine wins).',
};

const MINERAL_GATES_witherite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 5, T_max: 250, T_optimal: 115,
  fluid_min: { Ba: 30, CO3: 50 },
  pH_min: 6.0,
  surface_energy: 'medium',
  _sources: ['witherite engine v63+'],
  _notes: 'BaCO3 — pseudohex Ba carbonate, bluish-white SW UV fluorescence. S > 50 suppresses (barite wins).',
};

const MINERAL_GATES_hydrozincite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 30, T_optimal: 15,
  fluid_min: { Zn: 5, CO3: 100 },
  O2_min: 0.5,
  pH_min: 7.0, pH_max: 9.5,
  surface_energy: 'low',
  _sources: ['hydrozincite engine v98+', 'Hitzman et al. 2003', 'Boni & Mondillo 2015'],
  _notes: 'Zn5(CO3)2(OH)6 — latest+coolest Zn supergene. SiO2 > 50 routes to hemimorphite. Cu fraction > 0.15 routes to aurichalcite.',
};

// Canonical reagent route shared with the formation diagnostic. These three
// empirical engines still consume the raw total-CO3 control; every other
// carbonate route consumes pH/T-speciated effective carbonate.
const CARBONATE_RAW_CO3_ENGINE_ROUTES = new Set([
  'strontianite', 'witherite', 'hydrozincite',
]);

function carbonateEngineAvailableCO3(mineral: string, fluid: any, temperature: number): number {
  if (CARBONATE_RAW_CO3_ENGINE_ROUTES.has(mineral)) {
    const raw = Number(fluid?.CO3);
    return Number.isFinite(raw) ? raw : 0;
  }
  return effectiveCO3(fluid, temperature);
}

Object.assign(VugConditions.prototype, {
  supersaturation_calcite() {
  // Calcite has RETROGRADE solubility — less soluble at higher T.
  // Precipitates on heating or CO₂ degassing. Forms at 10-500°C.
  // Decomposes to CaO + CO₂ above ~500°C.
  // Mg poisoning: Mg²⁺ stalls calcite {10ī4} growth steps (Davis 2000;
  // Nielsen 2013). Mg/Ca > ~2 hands the polymorph to aragonite. Capped
  // at 85% inhibition — high-Mg calcite (HMC) always forms some fraction.
  if (this.temperature > MINERAL_GATES_calcite.T_max!) return 0; // thermal decomposition
  // Week 2 (PROPOSAL-CARBONATE-GEOCHEM): SI-based dispatcher hook.
  // Runs AFTER hard physical/geochemical gates (thermal decomposition
  // boundary, ingredient minimums, redox gates) so the SI engine
  // inherits those constraints when per-mineral promotion lands. No-op
  // when CARBONATE_KSP_ACTIVE is false (default). See js/32b-supersat-
  // carbonate-Ksp.ts for the SI engine + flag mechanism.
  if (kspSupersatActiveFor('calcite')) return carbonateEngineSigma('calcite', this.fluid, this.temperature, 0, this.pressure);
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
  const mg_ratio = aqueousMgCaMolarRatio(this.fluid);
  const mg_inhibition = 1.0 / (1.0 + Math.exp(-(mg_ratio - 2.0) / 0.5));
  sigma *= (1.0 - 0.85 * mg_inhibition);

  return Math.max(sigma, 0);
},

  supersaturation_siderite() {
  // FeCO3 — iron carbonate. Reducing conditions only (Fe²⁺ stability).
  const g = MINERAL_GATES_siderite;
  if (this.fluid.Fe < g.fluid_min!.Fe || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  if (!carbonateRedoxAnoxic(this.fluid, g.O2_max!)) return 0;  // hard reducing gate
  if (kspSupersatActiveFor('siderite')) return carbonateEngineSigma('siderite', this.fluid, this.temperature, 0, this.pressure);
  const eq_fe = 80.0 * Math.exp(-0.005 * this.temperature);
  if (eq_fe <= 0) return 0;
  // Phase 2 fix: Q = a(Fe²⁺) × a(CO3²⁻); see calcite for rationale.
  const fe_co3 = Math.sqrt(this.fluid.Fe * effectiveCO3(this.fluid, this.temperature));
  let sigma = fe_co3 / eq_fe;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'siderite');
  if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
  else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
  sigma *= carbonateRedoxPenalty(this.fluid, 0.3, 1.0, 1.5, 0.2);
  return Math.max(sigma, 0);
},

  supersaturation_dolomite() {
  // CaMg(CO3)2 — ordered Ca-Mg carbonate. Kim 2023: T floor lowered to
  // 10°C — ambient T is fine thermodynamically, kinetics handled by f_ord.
  const g = MINERAL_GATES_dolomite;
  if (this.fluid.Mg < g.fluid_min!.Mg || this.fluid.Ca < g.fluid_min!.Ca || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  const mg_ratio = aqueousMgCaMolarRatio(this.fluid);
  if (mg_ratio < 0.3 || mg_ratio > 30.0) return 0;
  if (kspSupersatActiveFor('dolomite')) return carbonateEngineSigma('dolomite', this.fluid, this.temperature, 0, this.pressure);
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

  supersaturation_HMC(mg_content?: number) {
  // High-Magnesium Calcite Ca(1-x)Mg(x)CO3, x ≈ 0.05-0.30.
  // Disordered Mg-substituted calcite intermediate. Kinetic precursor
  // to ordered dolomite (Kim 2023 cyclic mechanism); persists as a
  // metastable phase without cycling. The promoted thermodynamic screen uses
  // the nondefective subregular calcite/disordered-dolomite component model
  // of Busenberg & Plummer (1989) and Glynn & Reardon (1990); defects remain
  // an explicit kinetic uncertainty rather than a fake linear Ksp correction.
  //
  // Each candidate shell receives the composition predicted from the current
  // aqueous *molar* Mg/Ca ratio and Mucci's measured temperature-dependent
  // distribution coefficient. An explicit x is accepted for per-crystal/
  // per-zone thermodynamic probes; production nucleation never substitutes a
  // fixed representative composition.
  const g = MINERAL_GATES_HMC;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Mg < g.fluid_min!.Mg || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  const predicted = hmcCompositionFromFluid(this.fluid, this.temperature);
  this._hmcCompositionAssessment = predicted;
  const explicitComposition = Number.isFinite(mg_content);
  if (!explicitComposition && !predicted.compositionDomainSupported) return 0;
  const x = explicitComposition
    ? Math.max(0, Math.min(0.30, Number(mg_content)))
    : predicted.mgMoleFraction;
  if (!explicitComposition && !predicted.validHMCComposition) return 0;
  const mg_ratio = predicted.aqueousMgCaMolarRatio;
  if (kspSupersatActiveFor('HMC')) {
    return carbonateEngineSigma('HMC', this.fluid, this.temperature, x, this.pressure);
  }

  // Empirical fallback (flag-off): calcite-like formula with
  // Mg-substitution accounted for via a milder eq, and damped by
  // distance from the optimum Mg/Ca ≈ 4 (marine seawater equivalent).
  // Conservative — HMC is geologically a sometimes-mineral, not a
  // default precipitator.
  const eq = 320.0 * Math.exp(-0.005 * this.temperature);  // Slightly more soluble than calcite
  if (eq <= 0) return 0;
  // Geometric mean of (Ca · CO3) — same calcite-style Q with Mg as a
  // multiplicative modifier.
  const ca_co3 = Math.sqrt(this.fluid.Ca * effectiveCO3(this.fluid, this.temperature));
  let sigma = ca_co3 / eq;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'HMC');
  // Mg-presence boost (HMC needs Mg in fluid — more Mg = more HMC
  // favorability up to the optimum near Mg/Ca ≈ 4; above that
  // aragonite/dolomite take over).
  if (mg_ratio < 4.0) sigma *= 1.0 + 0.25 * mg_ratio;
  else sigma *= Math.max(0.4, 2.0 - mg_ratio / 8.0);
  // pH boost (alkaline-favored, like calcite)
  if (this.fluid.pH > 7.5) sigma *= Math.pow(2.0, this.fluid.pH - 7.5);
  // T preference: HMC favored at low T (sabkha/marine cool conditions).
  // Above 30°C, aragonite kinetic preference takes over per
  // Burton & Walter 1987 GCA 51:777.
  if (this.temperature > 30) sigma *= Math.max(0.3, 1.0 - (this.temperature - 30) / 30);
  return Math.max(sigma, 0);
},

  supersaturation_rhodochrosite() {
  // MnCO3 — pink Mn carbonate, structurally identical to calcite (R3̄c).
  // T 20-250°C, pH 5-9, Mn²⁺ stable in moderate-to-reducing conditions.
  const g = MINERAL_GATES_rhodochrosite;
  if (this.fluid.Mn < g.fluid_min!.Mn || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  if (!carbonateRedoxAnoxic(this.fluid, g.O2_max!)) return 0;
  if (kspSupersatActiveFor('rhodochrosite')) return carbonateEngineSigma('rhodochrosite', this.fluid, this.temperature, 0, this.pressure);
  const eq_mn = 50.0 * Math.exp(-0.005 * this.temperature);
  if (eq_mn <= 0) return 0;
  // Phase 2 fix: Q = a(Mn²⁺) × a(CO3²⁻); see calcite for rationale.
  const mn_co3 = Math.sqrt(this.fluid.Mn * effectiveCO3(this.fluid, this.temperature));
  let sigma = mn_co3 / eq_mn;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'rhodochrosite');
  if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
  else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
  sigma *= carbonateRedoxPenalty(this.fluid, 0.8, 0.7, 1.0, 0.3);
  return Math.max(sigma, 0);
},

  supersaturation_aragonite() {
  // Orthorhombic CaCO₃ dimorph — metastable at surface but kinetically
  // favored when Mg/Ca > ~1.5 (dominant, Folk 1974 / Morse 1997),
  // T > ~50°C (Burton & Walter 1987 in low-Mg), or Ω > ~10 (Ostwald
  // step rule, Sun 2015). Trace Sr/Pb/Ba give a small additional boost.
  // Pressure is the thermodynamic sorter only in the deep/cold stability
  // window. Low-pressure aragonite remains Mg/degassing-kinetic and must never
  // be excluded by a pressure gate.
  //
  // v147 (Week 12 SI engine promotion): the architectural choice for
  // aragonite differs from calcite/dolomite/HMC. For thermodynamic-
  // minimum carbonates, supersaturation_<mineral> returns RAW textbook
  // omega when the flag is on. Aragonite is DIFFERENT — it's the
  // metastable polymorph; its firing rule is fundamentally a KINETIC
  // criterion (Mg/Ca preference + T preference + Ostwald step rule +
  // trace boost) layered on top of the textbook omega. The SI engine
  // promotion swaps the BASIS of omega from the empirical
  // ca_co3/eq formula to textbook IAP/Ksp, but the favorability layer
  // stays — preserving the geological model where omega tells you HOW
  // SUPERSATURATED but favorability tells you WHETHER ARAGONITE WINS.
  const g = MINERAL_GATES_aragonite;
  if (this.fluid.Ca < g.fluid_min!.Ca || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // v147 T_max gate: aragonite reverts to calcite above ~400°C per
  // Carlson 1983 Reviews in Mineralogy 11:191-225. Pre-v147 the
  // empirical engine had no T cap; marble_contact_metamorphism fired
  // aragonite at 698°C which is physically impossible.
  if (g.T_max != null && this.temperature > g.T_max) return 0;

  // Step 1: compute omega — either textbook (SI engine on) or
  // empirical (flag off, legacy ca_co3/eq formula).
  let omega: number;
  if (kspSupersatActiveFor('aragonite')) {
    omega = carbonateEngineSigma('aragonite', this.fluid, this.temperature, 0, this.pressure);
    if (!isFinite(omega) || omega <= 0) return 0;
  } else {
    const eq = 300.0 * Math.exp(-0.005 * this.temperature);
    if (eq <= 0) return 0;
    // Phase 2 fix: Q = a(Ca²⁺) × a(CO3²⁻); see calcite for rationale.
    const ca_co3 = Math.sqrt(this.fluid.Ca * effectiveCO3(this.fluid, this.temperature));
    omega = ca_co3 / eq;
    if (ACTIVITY_CORRECTED_SUPERSAT) omega *= activityCorrectionFactor(this.fluid, 'aragonite');
  }

  // Step 2: kinetic favorability — same formula regardless of which
  // omega source feeds in. v228 RESTRUCTURE (hostile-review fix ladder,
  // rung 2). The v147 weighted sum let the T-term SUBSTITUTE for Mg, so
  // hot low-Mg vein brines (elmwood 121°C @ Mg/Ca 0.18, wittichen 156°C,
  // grimsel 221°C…) grew aragonite where every such deposit shows calcite.
  // The physical model is two SELECTORS, either sufficient (an OR):
  //   1. Mg-poisoning of calcite (works at any T; aqueous MOLAR Mg/Ca
  //      threshold 1.1 — Wassenburg 2016 cave-dripwater crossover;
  //      Folk's classic 1-2 molar band). Concentrations are stored as
  //      mg/kg, so convert with the element molar masses before comparing.
  //   2. The SPRING WINDOW — vent/apron degassing kinetics, T rising
  //      ~40-45°C (Folk 1994; Fouke 2000: Mammoth vents 71-73°C are
  //      aragonite, distal 28-30°C calcite) and CLOSING ~90°C (Lake
  //      Bogoria boiling springs ~90-96°C are the hottest documented
  //      primary low-Mg aragonite; Casella 2017: aragonite→calcite
  //      replacement completes in DAYS at 175°C — confined vein fluids
  //      above ~100°C cannot deliver preserved primary aragonite).
  //      Burton & Walter 1987's T-effect was measured in SEAWATER at
  //      5-25°C — the old open-ended T-sigmoid extrapolated it to
  //      regimes it never covered; T is a proxy for 1-atm degassing
  //      supersaturation, which a sealed hot vein cannot reach (Jones
  //      2017 review).
  // Ω is NOT a selector: with no selector present, high-Ω low-Mg cold
  // water runs the vaterite→calcite Ostwald cascade, not aragonite —
  // so Ω acts only as a bounded AMPLIFIER of an existing selector
  // (De Choudens-Sánchez & González 2009 even find the Ω-sign contested;
  // don't lean on it). Dissolved SO4 was evaluated and consciously
  // EXCLUDED: Bots et al. 2011 show SO4 shifts the Mg threshold (the
  // two are mutually dependent) rather than acting independently —
  // an additive SO4 term would recreate the exact spurious-driver bug
  // this restructure removes.
  const mg_ratio_molar = (this.fluid.Mg / 24.305)
    / Math.max(this.fluid.Ca / 40.078, 1e-12);
  const mgSelectorPresent = mg_ratio_molar >= 1.1;
  const mg_factor = mgSelectorPresent
    ? 1.0 / (1.0 + Math.exp(-(mg_ratio_molar - 1.1) / 0.3))
    : 0;
  const T_rise = 1.0 / (1.0 + Math.exp(-(this.temperature - 45.0) / 10.0));
  const T_fall = 1.0 / (1.0 + Math.exp((this.temperature - 90.0) / 8.0));
  // The low-Mg temperature selector represents an open vent/apron spring,
  // not a sealed hydrothermal vein merely cooling through the same numbers.
  // Restrict it to the project's shallow-spring pressure envelope. Deeper
  // fluids can still select aragonite through Mg poisoning or the stable
  // high-pressure phase field below.
  const shallowSurfaceSpring = this.wall?.open_spring === true
    && Number(this.pressure) <= 0.10;
  const springSelectorPresent = shallowSurfaceSpring
    && this.temperature >= 40
    && this.temperature <= 100;
  const T_window = springSelectorPresent ? T_rise * T_fall : 0;
  // Ambient cobalt-bearing water is a fourth measured selector. Co²⁺
  // poisons calcite step propagation much as Mg²⁺ does; unlike a generic
  // trace boost, this route is hard-bounded to the Barber/González-López
  // experiment domain and is unavailable to the hot hypogene vein stage.
  const coSelector = aragoniteCoSelector(this.fluid, this.temperature);
  const coSelectorPresent = coSelector.present;
  const omega_factor = 1.0 / (1.0 + Math.exp(-(Math.log10(Math.max(omega, 0.01)) - 1.0) / 0.3));
  const trace_sum = this.fluid.Sr + this.fluid.Pb + this.fluid.Ba;
  const trace_ratio = trace_sum / Math.max(this.fluid.Ca, 0.01);
  const trace_factor = 1.0 + 0.3 / (1.0 + Math.exp(-(trace_ratio - 0.01) / 0.005));

  // Johannes-Puhan reversals / Hacker-fit field: above ~3 kbar, sufficiently
  // cold aragonite is the stable CaCO3 phase and does not need the shallow
  // Mg-poisoning or spring-degassing selector. At lower pressure those kinetic
  // selectors remain authoritative.
  const pressureStable = aragoniteIsPressureStable(this.temperature, this.pressure);

  // Logistic functions have non-zero tails by construction. They are useful
  // for weighting evidence INSIDE a documented domain, but must not turn an
  // absent driver into a small positive selector that a huge omega can amplify.
  if (!pressureStable && !mgSelectorPresent && !springSelectorPresent
      && !coSelectorPresent) return 0;

  // Selector OR (maximum of independent routes), then a soft self-gate: a polymorph
  // selector must actually be PRESENT — sub-threshold residue from two
  // absent drivers must not multiply a huge Ω over the nucleation gate
  // (stalactite_demo's brine-strength Ω≈56 did exactly that pre-v228).
  const selector = pressureStable
    ? 1.0
    : Math.max(mg_factor, T_window, coSelector.strength);
  const selector_gate = 1.0 / (1.0 + Math.exp(-(selector - 0.10) / 0.03));
  const favorability = selector * selector_gate * (0.8 + 0.2 * omega_factor) * trace_factor;
  return omega * favorability;
},

  supersaturation_malachite() {
  const g = MINERAL_GATES_malachite;
  if (this.fluid.Cu < g.fluid_min!.Cu || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3 || !carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (kspSupersatActiveFor('malachite')) return carbonateEngineSigma('malachite', this.fluid, this.temperature, 0, this.pressure);
  // Denominators reference realistic supergene weathering fluid (Cu ~25 ppm,
  // CO₃ ~100 ppm). The older 50/200 values were tuned for Cu-saturated
  // porphyry fluids and starved supergene vugs of their flagship Cu mineral.
  // Malachite-vs-azurite competition is encoded by carbonate-activity
  // thresholds (Vink 1986, Mineralogical Magazine 50:43-47): malachite
  // CO3 ≥20, azurite CO3 ≥120 — the sim-scale encoding of Vink's
  // log(pCO2) ≈ -3.5 univariant boundary at 25°C. Azurite drops back
  // to malachite via the paramorph mechanic in grow_azurite when CO3
  // falls during a run (Bisbee step 225 ev_co2_drop).
  // See research/arcs/research-broth-ratio-malachite-azurite.md.
  let sigma = (this.fluid.Cu / 25.0) * (effectiveCO3(this.fluid, this.temperature) / 100.0) * carbonateRedoxFactor(this.fluid, 1.0);
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
  const g = MINERAL_GATES_smithsonite;
  if (this.fluid.Zn < g.fluid_min!.Zn || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3 || !carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min!) return 0;
  if (kspSupersatActiveFor('smithsonite')) return carbonateEngineSigma('smithsonite', this.fluid, this.temperature, 0, this.pressure);
  let sigma = (this.fluid.Zn / 80.0) * (effectiveCO3(this.fluid, this.temperature) / 200.0) * carbonateRedoxFactor(this.fluid, 1.0);
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.04 * (this.temperature - 80));
  }
  if (this.fluid.pH > 7) sigma *= 1.2;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'smithsonite');
  return Math.max(sigma, 0);
},

  supersaturation_azurite() {
  const g = MINERAL_GATES_azurite;
  if (this.fluid.Cu < g.fluid_min!.Cu || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3 || !carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (kspSupersatActiveFor('azurite')) return carbonateEngineSigma('azurite', this.fluid, this.temperature, 0, this.pressure);
  const cu_f = Math.min(this.fluid.Cu / 40.0, 2.0);
  const co_f = Math.min(effectiveCO3(this.fluid, this.temperature) / 150.0, 1.8);
  const o_f  = carbonateRedoxFactor(this.fluid, 1.5, 1.3);
  let sigma = cu_f * co_f * o_f;
  if (this.temperature > 50) sigma *= Math.exp(-0.06 * (this.temperature - 50));
  if (this.fluid.pH < 5.0) sigma -= (5.0 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'azurite');
  return Math.max(sigma, 0);
},

  supersaturation_cerussite() {
  const g = MINERAL_GATES_cerussite;
  // rung-4c (SIM 232): the missing oxidizing gate. cerussite is the supergene Pb
  // carbonate (galena → cerussite by OXIDATION), the Pb analog of smithsonite —
  // but alone among the supergene carbonates it lacked carbonateRedoxAvailable,
  // so it minted in reducing hypogene brines (mvt Eh -36, elmwood +24) beside
  // actively-growing galena. Gated to O2_min 0.5 (Eh ≥ +100 mV = galena's rung-4b
  // stability ceiling): the redox partition of Pb — galena below +100, cerussite
  // above. Census gap was wide (spurious -36/+24; legit +202..+357). Garrels 1954.
  if (this.fluid.Pb < g.fluid_min!.Pb || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3 || !carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (kspSupersatActiveFor('cerussite')) return carbonateEngineSigma('cerussite', this.fluid, this.temperature, 0, this.pressure);
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
  const g = MINERAL_GATES_rosasite;
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.Zn < g.fluid_min!.Zn || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (!carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH < g.pH_min!) return 0;
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
  const g = MINERAL_GATES_aurichalcite;
  if (this.fluid.Zn < g.fluid_min!.Zn || this.fluid.Cu < g.fluid_min!.Cu || effectiveCO3(this.fluid, this.temperature) < g.fluid_min!.CO3) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (!carbonateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  // pH gate — see vugg.py supersaturation_aurichalcite for citation
  // (Pinch & Wilson 1977 — real Tsumeb fluids active at pH 5.5-7.5).
  if (this.fluid.pH < g.pH_min!) return 0;
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

  // v63 brief-19: SrCO3 — Sr carbonate. Aragonite-group orthorhombic;
  // pseudohexagonal cyclic twinning is the diagnostic habit. Loses to
  // celestine when SO4 dominates.
  supersaturation_strontianite() {
    const g = MINERAL_GATES_strontianite;
    const availableCO3 = carbonateEngineAvailableCO3('strontianite', this.fluid, this.temperature);
    if (this.fluid.Sr < g.fluid_min!.Sr || availableCO3 < g.fluid_min!.CO3) return 0;
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    if (kspSupersatActiveFor('strontianite')) return carbonateEngineSigma('strontianite', this.fluid, this.temperature, 0, this.pressure);
    let sigma = (this.fluid.Sr / 80.0) * (availableCO3 / 200.0);
    let T_factor = 1.0;
    if (T >= 80 && T <= 150) T_factor = 1.2;
    else if (T < 80) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 5));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 150));
    sigma *= T_factor;
    if (this.fluid.pH < 6.0) sigma *= Math.max(0.2, 1.0 - 0.35 * (6.0 - this.fluid.pH));
    const sulfatePpm = sulfateAvailablePpm(this.fluid, this.temperature);
    if (sulfatePpm > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (sulfatePpm - 50));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'strontianite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: BaCO3 — Ba carbonate. Almost always cyclic-twinned into
  // pseudohexagonal pyramids. Loses to barite when SO4 dominates; Cave-in-Rock
  // (Illinois) is the canonical witherite + barite + fluorite + galena
  // assemblage.
  supersaturation_witherite() {
    const g = MINERAL_GATES_witherite;
    const availableCO3 = carbonateEngineAvailableCO3('witherite', this.fluid, this.temperature);
    if (this.fluid.Ba < g.fluid_min!.Ba || availableCO3 < g.fluid_min!.CO3) return 0;
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    if (kspSupersatActiveFor('witherite')) return carbonateEngineSigma('witherite', this.fluid, this.temperature, 0, this.pressure);
    let sigma = (this.fluid.Ba / 80.0) * (availableCO3 / 200.0);
    let T_factor = 1.0;
    if (T >= 80 && T <= 150) T_factor = 1.2;
    else if (T < 80) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 5));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 150));
    sigma *= T_factor;
    if (this.fluid.pH < 6.0) sigma *= Math.max(0.2, 1.0 - 0.35 * (6.0 - this.fluid.pH));
    const sulfatePpm = sulfateAvailablePpm(this.fluid, this.temperature);
    if (sulfatePpm > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (sulfatePpm - 50));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'witherite');
    return Math.max(sigma, 0);
  },

  // v98 (2026-05-19): Hydrozincite Zn5(CO3)2(OH)6 — monoclinic C2/m,
  // the latest+coolest Zn supergene mineral. Forms <30°C, alkaline
  // (pH 7-9), carbonate-rich, Si-poor (otherwise hemimorphite wins).
  // Spherulitic chalky crusts + cave-floor coatings. Type locality
  // Iglesiente, Sardinia; bioremediator at Naracauli (Preisig et al.
  // 2014). Per Hitzman et al. 2003 Econ. Geol. 98:685-714 (nonsulfide
  // Zn synthesis) + Boni & Mondillo 2015 Ore Geol. Rev. 67:208-233.
  supersaturation_hydrozincite() {
    const g = MINERAL_GATES_hydrozincite;
    const availableCO3 = carbonateEngineAvailableCO3('hydrozincite', this.fluid, this.temperature);
    if (this.fluid.Zn < g.fluid_min!.Zn || availableCO3 < g.fluid_min!.CO3) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    if (this.fluid.SiO2 > 50) return 0;  // hemimorphite wins above
    // High sulfate → gypsum + Zn-sulfates win
    if (sulfateAvailablePpm(this.fluid, this.temperature) > 100 && this.fluid.O2 > 0.5) return 0;
    // Cu suppresses → aurichalcite (Zn-Cu carbonate-hydroxide) wins
    const cu_frac = this.fluid.Cu / Math.max(this.fluid.Cu + this.fluid.Zn, 0.001);
    if (cu_frac > 0.15) return 0;
    if (kspSupersatActiveFor('hydrozincite')) return carbonateEngineSigma('hydrozincite', this.fluid, this.temperature, 0, this.pressure);
    const zn_f = Math.min(this.fluid.Zn / 20.0, 2.5);
    const co3_f = Math.min(availableCO3 / 200.0, 2.0);
    let sigma = zn_f * co3_f;
    const pH = this.fluid.pH;
    if (pH >= 7.5 && pH <= 8.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.0) * 0.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hydrozincite');
    return Math.max(sigma, 0);
  },
});
