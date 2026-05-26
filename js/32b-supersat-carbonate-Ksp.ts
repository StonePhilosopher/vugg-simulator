// ============================================================
// js/32b-supersat-carbonate-Ksp.ts — Ksp-based saturation indices
// ============================================================
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 2.
//
// This module is the THERMODYNAMIC core of the carbonate engine. It
// computes textbook saturation indices SI = log10(IAP/Ksp) for the
// carbonate minerals against the Ksp(T) data shipped in Week 1
// (data/thermo-carbonates.json + js/20c-chemistry-carbonate-Ksp.ts).
//
// Two surfaces ride on top of the same SI math:
//
//   (1) carbonateSaturationIndex(mineralId, fluid, T, mg_content?)
//       Pure observable. Always callable. Returns log10(omega) per
//       textbook convention: SI = 0 at equilibrium, +1 at 10x
//       supersaturated, -1 at 10x undersaturated. NaN when the data
//       isn't available. The Week 3 helicoid trails consume this
//       directly as observers — no engine promotion needed.
//
//   (2) carbonateEngineSigma(mineralId, fluid, T, mg_content?)
//       Engine surface. Returns omega = 10^SI for consumption by
//       supersaturation_<mineral>() methods in 32-supersat-carbonate.ts.
//       Gated behind kspSupersatActiveFor(mineralId) — when the gate
//       is false (default), the empirical engine continues unchanged.
//
// FLAG SHAPE — designed for per-mineral promotion per Week 9-12 plan.
//
//   CARBONATE_KSP_ACTIVE = false             // global gate
//   CARBONATE_KSP_ACTIVE_PER_MINERAL = {
//     calcite: false, aragonite: false, ...  // all default false
//   }
//   kspSupersatActiveFor(mineralId) = CARBONATE_KSP_ACTIVE
//                                     && PER_MINERAL[mineralId]
//
// To promote ONE mineral (e.g. calcite, the canonical Week-9 flip):
//   1. flip CARBONATE_KSP_ACTIVE to true
//   2. flip CARBONATE_KSP_ACTIVE_PER_MINERAL.calcite to true
//   3. re-tune MINERAL_GATES_calcite.sigma_crit (the empirical 1.3
//      maps to a different omega — textbook omega=1 is equilibrium,
//      so the new sigma_crit lives in [1.0, ~5] depending on the
//      nucleation-barrier margin we want)
//   4. re-anchor any drifted scenarios via vugg-tune-scenario
// All four are landed in the same commit per the proposal.
//
// THERMODYNAMICS — full, undamped.
//
// Unlike effectiveCO3 (damped Bjerrum, BJERRUM_DAMPING=0.5 to preserve
// the empirical eq calibration) and activityCorrectionFactor (damped
// Davies, ACTIVITY_DAMPING=0.25), this module uses the RAW physics.
// SI is supposed to be observable truth — what a real geochemist
// would measure. The damping in 20a/20b is legacy-empirical-engine
// calibration ballast; the new path bypasses both:
//
//   - CO3^2- activity: carbonateIonPpm(fluid, T) * ppm-to-molality
//     * raw daviesLogGamma(-2, I)
//   - Cation activity: ppm/molarMass * raw daviesLogGamma(z, I)
//   - OH- activity: 10^(pH-14) * raw daviesLogGamma(-1, I)
//   - Kw assumed = 1e-14 (25 C value). T-dependence is real but small
//     in the 0-100 C band relevant here; refinement deferred to a
//     possible Phase 2 activity model upgrade.
//
// PER-MINERAL IAP STOICHIOMETRY (the eight Ca/Mg/Fe/Mn/Zn/Pb/Ba/Sr
// monocarbonates + dolomite + HMC + three OH-bearing supergene Cu/Zn
// minerals — 13 of the 14 carbonates in the catalog):
//
//   simple AB(CO3): IAP = a(A^2+) * a(CO3^2-)
//     calcite, aragonite (Ca); siderite (Fe); rhodochrosite (Mn);
//     smithsonite (Zn); cerussite (Pb); witherite (Ba); strontianite (Sr)
//
//   dolomite CaMg(CO3)2: IAP = a(Ca^2+) * a(Mg^2+) * a(CO3^2-)^2
//
//   HMC Ca(1-x)Mg(x)CO3: IAP = a(Ca^2+)^(1-x) * a(Mg^2+)^x * a(CO3^2-)
//     Ksp scales with mg_content via mg_content_linear fit in 20c.
//
//   malachite Cu2(CO3)(OH)2: IAP = a(Cu^2+)^2 * a(CO3^2-) * a(OH^-)^2
//   azurite Cu3(CO3)2(OH)2: IAP = a(Cu^2+)^3 * a(CO3^2-)^2 * a(OH^-)^2
//   hydrozincite Zn5(CO3)2(OH)6:
//       IAP = a(Zn^2+)^5 * a(CO3^2-)^2 * a(OH^-)^6
//
// DEFERRED — rosasite + aurichalcite. Mixed-cation OH-bearing
// carbonates with NO published thermodynamic data (tier D in
// data/thermo-carbonates.json). The endmember-mixture approximation
// the JSON sketches is not enough rigor for engine consumption.
// Real handling needs either (a) measured Ksp data, (b) explicit
// solid-solution model (regular vs ideal), or (c) deferral to the
// empirical engine indefinitely. For now: SI returns NaN; the
// helicoid trail simply omits these two minerals. When (a) or (b)
// becomes available, slot them in here.
//
// KINETIC MODIFIERS — explicitly NOT in scope.
//
// The empirical methods in 32-supersat-carbonate.ts apply
// Mg-poisoning (calcite/aragonite), pH-acid-attack, pH-alkaline-boost,
// trace-cation tweaks, etc. AFTER computing eq-divided sigma. These
// are KINETIC effects, not equilibrium quantities. The proposal puts
// them in Week 6's js/52b-engines-carbonate-kinetics.ts module
// (Plummer-Wigley-Parkhurst rate law + Mg-poisoning inhibitor +
// metastability decisions). At Week 9 flip time the kinetic engine
// is in place, so SI -> rate -> growth, with kinetic modifiers
// applied to the rate, not to omega.
//
// For Week 2, carbonateEngineSigma returns raw omega. If a per-mineral
// flag is flipped BEFORE the kinetic engine lands, Mg poisoning + pH
// modifiers would be lost — DON'T flip until Week 6+ ships kinetics.
// The flag gate is the guarantee.

// =============================================================
// Flag mechanism
// =============================================================

// Global gate. When false, NO carbonate is promoted to SI-based sigma.
// All supersaturation_<carbonate>() methods continue on the empirical
// path. This is the default; per-mineral promotion (Weeks 9-12) flips
// this to true AND flips the per-mineral entry.
//
// `let` rather than const so setCarbonateKspActive() can flip it from
// outside the bundle (tests, future debug UI). Production promotions
// edit the literal here in source; tests use the setter for transient
// flipping with afterEach restore.
//
// v144 (Week 9 calcite promotion): flipped from false to true. Calcite
// is the first carbonate promoted to the SI engine + PWP rate law. The
// per-mineral map below gates which carbonates actually use the new
// path; the global flag is the master switch.
let CARBONATE_KSP_ACTIVE = true;

// Per-mineral fine-grain gate. When CARBONATE_KSP_ACTIVE is true,
// only entries here flagged true use the SI engine. Per-mineral
// promotion is the unit of change — one carbonate per commit per
// the Week 9-12 plan. Reserved entries (rosasite, aurichalcite, HMC,
// otavite, etc.) included for documentation; flipping them without
// Ksp data is a no-op (SI returns NaN, fallback to empirical).
//
// v144: calcite flipped to true. Aragonite, dolomite, siderite,
// rhodochrosite remain false pending their own Week 10/11/12 promotion
// commits.
const CARBONATE_KSP_ACTIVE_PER_MINERAL: Record<string, boolean> = {
  calcite:        true,
  aragonite:      false,
  dolomite:       false,
  siderite:       false,
  rhodochrosite:  false,
  smithsonite:    false,
  cerussite:      false,
  witherite:      false,
  strontianite:   false,
  malachite:      false,
  azurite:        false,
  hydrozincite:   false,
  HMC:            false,
  // rosasite + aurichalcite intentionally absent — no thermo data,
  // would be no-ops if flipped.
};

function kspSupersatActiveFor(mineralId: string): boolean {
  if (!CARBONATE_KSP_ACTIVE) return false;
  return CARBONATE_KSP_ACTIVE_PER_MINERAL[mineralId] === true;
}

// Setters — exposed so tests can flip flags transiently. NOT for
// production code: per the proposal's Week 9-12 plan, real promotions
// edit the source literals + bump SIM_VERSION in the same commit, so
// the flag-flip is captured in git history alongside the
// MINERAL_GATES re-tuning and scenario re-anchoring it requires.
//
// Mirrors the setGraduatedCompetition* pattern from js/44 — the IIFE
// bundle's closure-scoped `let` can't be reassigned via globalThis,
// so setters are the only safe way to flip it from outside.
function setCarbonateKspActive(active: boolean): void {
  CARBONATE_KSP_ACTIVE = !!active;
}

function setCarbonateKspActiveFor(mineralId: string, active: boolean): void {
  CARBONATE_KSP_ACTIVE_PER_MINERAL[mineralId] = !!active;
}

// Snapshot + restore — convenience for tests that flip multiple flags
// then need to revert in afterEach without remembering exactly what
// was changed.
function snapshotCarbonateKspFlags(): { global: boolean; perMineral: Record<string, boolean> } {
  return {
    global: CARBONATE_KSP_ACTIVE,
    perMineral: Object.assign({}, CARBONATE_KSP_ACTIVE_PER_MINERAL),
  };
}

function restoreCarbonateKspFlags(snap: { global: boolean; perMineral: Record<string, boolean> }): void {
  CARBONATE_KSP_ACTIVE = !!snap.global;
  for (const k in CARBONATE_KSP_ACTIVE_PER_MINERAL) {
    delete CARBONATE_KSP_ACTIVE_PER_MINERAL[k];
  }
  for (const k in snap.perMineral) {
    CARBONATE_KSP_ACTIVE_PER_MINERAL[k] = !!snap.perMineral[k];
  }
}

// =============================================================
// Activity helpers — undamped, raw Davies
// =============================================================

// log10 a(cation^z+) for a fluid species at given ionic strength.
// Returns -Infinity if the cation is absent (ppm <= 0). Skips the
// damping that activityCorrectionFactor applies for empirical-engine
// calibration ballast.
function _logActivityCation(fluid: any, cationKey: string, I: number): number {
  const props = (typeof SPECIES_PROPERTIES !== 'undefined') ? SPECIES_PROPERTIES[cationKey] : null;
  if (!props) return -Infinity;
  const ppm = fluid[cationKey];
  if (typeof ppm !== 'number' || ppm <= 0) return -Infinity;
  const m = ppm / (1000 * props.molarMass);
  if (m <= 0) return -Infinity;
  return Math.log10(m) + daviesLogGamma(props.charge, I);
}

// log10 a(CO3^2-) from the Bjerrum partition. carbonateIonPpm returns
// the actual CO3^2- ppm at the fluid's pH and T (UNDAMPED — different
// from effectiveCO3 which applies BJERRUM_DAMPING for legacy calibration).
function _logActivityCO3(fluid: any, T: number, I: number): number {
  if (typeof carbonateIonPpm !== 'function') return -Infinity;
  const ppm_CO3 = carbonateIonPpm(fluid, T);
  if (!isFinite(ppm_CO3) || ppm_CO3 <= 0) return -Infinity;
  const m = ppm_CO3 / (1000 * 60.01);  // CO3 molar mass
  if (m <= 0) return -Infinity;
  return Math.log10(m) + daviesLogGamma(-2, I);
}

// log10 a(OH-) at the fluid's pH. Uses Kw = 1e-14 (25 C value);
// T-dependence of Kw is real (pKw drops from 14.0 at 25 C to ~13.0
// at 100 C per Marshall & Franck 1981) but the effect on SI for OH-
// bearing carbonates is small at the temperatures these minerals form
// (typically <60 C in supergene settings). Documented as a known
// approximation; refinement deferred to Phase 2.
function _logActivityOH(fluid: any, I: number): number {
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  const m_OH = Math.pow(10, pH - 14.0);
  if (m_OH <= 0) return -Infinity;
  return Math.log10(m_OH) + daviesLogGamma(-1, I);
}

// =============================================================
// Per-mineral SI computation
// =============================================================

// Simple monocarbonates (AB(CO3) where A is a divalent cation).
// IAP = a(A^2+) * a(CO3^2-); SI = log10(IAP) - log10(Ksp).
function _SI_simple(mineralId: string, fluid: any, T: number, cationKey: string): number {
  const I = ionicStrength(fluid);
  const logA_M = _logActivityCation(fluid, cationKey, I);
  if (!isFinite(logA_M)) return NaN;
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  const logKsp = getCarbonateLogKsp(mineralId, T);
  if (!isFinite(logKsp)) return NaN;
  return (logA_M + logA_CO3) - logKsp;
}

function saturationIndex_calcite(fluid: any, T: number): number {
  return _SI_simple('calcite', fluid, T, 'Ca');
}
function saturationIndex_aragonite(fluid: any, T: number): number {
  return _SI_simple('aragonite', fluid, T, 'Ca');
}
function saturationIndex_siderite(fluid: any, T: number): number {
  return _SI_simple('siderite', fluid, T, 'Fe');
}
function saturationIndex_rhodochrosite(fluid: any, T: number): number {
  return _SI_simple('rhodochrosite', fluid, T, 'Mn');
}
function saturationIndex_smithsonite(fluid: any, T: number): number {
  return _SI_simple('smithsonite', fluid, T, 'Zn');
}
function saturationIndex_cerussite(fluid: any, T: number): number {
  return _SI_simple('cerussite', fluid, T, 'Pb');
}
function saturationIndex_witherite(fluid: any, T: number): number {
  return _SI_simple('witherite', fluid, T, 'Ba');
}
function saturationIndex_strontianite(fluid: any, T: number): number {
  return _SI_simple('strontianite', fluid, T, 'Sr');
}

// Dolomite CaMg(CO3)2.
// IAP = a(Ca^2+) * a(Mg^2+) * a(CO3^2-)^2.
function saturationIndex_dolomite(fluid: any, T: number): number {
  const I = ionicStrength(fluid);
  const logA_Ca = _logActivityCation(fluid, 'Ca', I);
  if (!isFinite(logA_Ca)) return NaN;
  const logA_Mg = _logActivityCation(fluid, 'Mg', I);
  if (!isFinite(logA_Mg)) return NaN;
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  const logIAP = logA_Ca + logA_Mg + 2 * logA_CO3;
  const logKsp = getCarbonateLogKsp('dolomite', T);
  if (!isFinite(logKsp)) return NaN;
  return logIAP - logKsp;
}

// HMC Ca(1-x)Mg(x)CO3 — mg_content x is per-crystal state.
// IAP = a(Ca^2+)^(1-x) * a(Mg^2+)^x * a(CO3^2-).
// Ksp varies with x via the mg_content_linear fit in 20c.
function saturationIndex_HMC(fluid: any, T: number, mg_content: number): number {
  const x = Math.max(0, Math.min(0.30, mg_content));
  const I = ionicStrength(fluid);
  const logA_Ca = _logActivityCation(fluid, 'Ca', I);
  if (!isFinite(logA_Ca)) return NaN;
  let logIAP = (1 - x) * logA_Ca;
  if (x > 0) {
    const logA_Mg = _logActivityCation(fluid, 'Mg', I);
    if (!isFinite(logA_Mg)) return NaN;
    logIAP += x * logA_Mg;
  }
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  logIAP += logA_CO3;
  const logKsp = getCarbonateLogKsp('HMC', T, mg_content);
  if (!isFinite(logKsp)) return NaN;
  return logIAP - logKsp;
}

// Malachite Cu2(CO3)(OH)2.
// IAP = a(Cu^2+)^2 * a(CO3^2-) * a(OH^-)^2.
function saturationIndex_malachite(fluid: any, T: number): number {
  const I = ionicStrength(fluid);
  const logA_Cu = _logActivityCation(fluid, 'Cu', I);
  if (!isFinite(logA_Cu)) return NaN;
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  const logA_OH = _logActivityOH(fluid, I);
  if (!isFinite(logA_OH)) return NaN;
  const logIAP = 2 * logA_Cu + logA_CO3 + 2 * logA_OH;
  const logKsp = getCarbonateLogKsp('malachite', T);
  if (!isFinite(logKsp)) return NaN;
  return logIAP - logKsp;
}

// Azurite Cu3(CO3)2(OH)2.
// IAP = a(Cu^2+)^3 * a(CO3^2-)^2 * a(OH^-)^2.
function saturationIndex_azurite(fluid: any, T: number): number {
  const I = ionicStrength(fluid);
  const logA_Cu = _logActivityCation(fluid, 'Cu', I);
  if (!isFinite(logA_Cu)) return NaN;
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  const logA_OH = _logActivityOH(fluid, I);
  if (!isFinite(logA_OH)) return NaN;
  const logIAP = 3 * logA_Cu + 2 * logA_CO3 + 2 * logA_OH;
  const logKsp = getCarbonateLogKsp('azurite', T);
  if (!isFinite(logKsp)) return NaN;
  return logIAP - logKsp;
}

// Hydrozincite Zn5(CO3)2(OH)6.
// IAP = a(Zn^2+)^5 * a(CO3^2-)^2 * a(OH^-)^6.
function saturationIndex_hydrozincite(fluid: any, T: number): number {
  const I = ionicStrength(fluid);
  const logA_Zn = _logActivityCation(fluid, 'Zn', I);
  if (!isFinite(logA_Zn)) return NaN;
  const logA_CO3 = _logActivityCO3(fluid, T, I);
  if (!isFinite(logA_CO3)) return NaN;
  const logA_OH = _logActivityOH(fluid, I);
  if (!isFinite(logA_OH)) return NaN;
  const logIAP = 5 * logA_Zn + 2 * logA_CO3 + 6 * logA_OH;
  const logKsp = getCarbonateLogKsp('hydrozincite', T);
  if (!isFinite(logKsp)) return NaN;
  return logIAP - logKsp;
}

// =============================================================
// Public observers — Week 3 helicoid trails consume these.
// Always callable regardless of CARBONATE_KSP_ACTIVE.
// =============================================================

// Returns log10(omega) per textbook: 0=equilibrium, +1=10x supersat,
// -1=10x undersat. NaN if data not available (mineral not in dispatch,
// fluid lacks required cation, etc.). Consumers (helicoid trails,
// engines, narrators) decide how to handle NaN — typically by hiding
// the trail or skipping the read.
function carbonateSaturationIndex(mineralId: string, fluid: any, T_C: number, mg_content: number = 0): number {
  if (!fluid) return NaN;
  switch (mineralId) {
    case 'calcite':       return saturationIndex_calcite(fluid, T_C);
    case 'aragonite':     return saturationIndex_aragonite(fluid, T_C);
    case 'dolomite':      return saturationIndex_dolomite(fluid, T_C);
    case 'HMC':           return saturationIndex_HMC(fluid, T_C, mg_content);
    case 'siderite':      return saturationIndex_siderite(fluid, T_C);
    case 'rhodochrosite': return saturationIndex_rhodochrosite(fluid, T_C);
    case 'smithsonite':   return saturationIndex_smithsonite(fluid, T_C);
    case 'cerussite':     return saturationIndex_cerussite(fluid, T_C);
    case 'witherite':     return saturationIndex_witherite(fluid, T_C);
    case 'strontianite':  return saturationIndex_strontianite(fluid, T_C);
    case 'malachite':     return saturationIndex_malachite(fluid, T_C);
    case 'azurite':       return saturationIndex_azurite(fluid, T_C);
    case 'hydrozincite':  return saturationIndex_hydrozincite(fluid, T_C);
    // rosasite + aurichalcite: no thermo data — return NaN. Helicoid
    // trail simply omits these.
    default:              return NaN;
  }
}

// Saturation ratio omega = IAP/Ksp = 10^SI. Returns 0 (not NaN) for
// missing data so engine call sites can treat omega=0 as "no
// information / cannot precipitate" without defensive checks.
function carbonateOmega(mineralId: string, fluid: any, T_C: number, mg_content: number = 0): number {
  const SI = carbonateSaturationIndex(mineralId, fluid, T_C, mg_content);
  if (!isFinite(SI)) return 0;
  return Math.pow(10, SI);
}

// Engine surface — consumed by supersaturation_<mineral>() in
// 32-supersat-carbonate.ts when kspSupersatActiveFor(mineralId) is
// true. Returns omega directly (no kinetic modifiers — those land in
// Week 6's js/52b-engines-carbonate-kinetics.ts).
//
// Per-mineral flag flips at Week 9-12 will also re-tune
// MINERAL_GATES_<mineral>.sigma_crit because empirical sigma and
// textbook omega have different absolute magnitudes (empirical
// sigma_crit ~ 1.0-1.3 for calcite; new omega-based sigma_crit lives
// in [1, ~5] depending on the nucleation-barrier margin desired).
function carbonateEngineSigma(mineralId: string, fluid: any, T_C: number, mg_content: number = 0): number {
  return carbonateOmega(mineralId, fluid, T_C, mg_content);
}

// =============================================================
// Coverage / introspection (for tools + library UI)
// =============================================================

// Which carbonate minerals have SI implementations in this module?
// (Distinct from "which have thermo data" — rosasite+aurichalcite have
// no thermo data and no SI fn; HMC has both but requires mg_content.)
function carbonatesWithSI(): string[] {
  return [
    'calcite', 'aragonite', 'dolomite', 'HMC',
    'siderite', 'rhodochrosite', 'smithsonite',
    'cerussite', 'witherite', 'strontianite',
    'malachite', 'azurite', 'hydrozincite',
  ];
}

// Promotion readiness — used by tools/thermo-coverage-check.mjs and
// the proposal's audit framework. A mineral is "promotion-ready" when
// it has SI implementation AND its thermo+kinetic data are both
// tier A or B.
function carbonatePromotionReady(mineralId: string): boolean {
  const ids = carbonatesWithSI();
  if (ids.indexOf(mineralId) === -1) return false;
  if (typeof getCarbonateThermoTier !== 'function') return false;
  const tT = getCarbonateThermoTier(mineralId);
  const tK = getCarbonateKineticTier(mineralId);
  const okTiers = ['A', 'B'];
  return okTiers.indexOf(tT) !== -1 && okTiers.indexOf(tK) !== -1;
}
