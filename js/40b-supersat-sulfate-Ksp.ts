// ============================================================
// js/40b-supersat-sulfate-Ksp.ts — Ksp-based SI for sulfates
// ============================================================
// Mirror of 32b-supersat-carbonate-Ksp.ts for the sulfate family.
// Authoritative saturation kernel (promoted for CaSO4 in SIM 244): consumed by the strip's
// sulfate SI chips (SI_selenite/anhydrite/barite/celestine, added
// in 99j) so the strip stops being SI-blind on the evaporite +
// sulfate-vein scenario family (naica / sicily_solfifera /
// sulphur_bank / sabkha / searles).
//
// Gypsum and anhydrite nucleation now require positive SI from this kernel;
// the other sulfate engines remain on their calibrated empirical routes.
//
// Public:
//   - sulfateSaturationIndex(mineralId, fluid, T_C) → log10 Ω  (NaN if undef)
//   - sulfateOmega(mineralId, fluid, T_C)            → 10^SI    (0 if NaN)
//
// Dispatch covers four canonical simple sulfates:
//   selenite/gypsum  CaSO4·2H2O  → SI = log a(Ca²⁺) + log a(SO4²⁻) − logKsp
//   anhydrite        CaSO4       → same form
//   barite           BaSO4       → log a(Ba²⁺) + log a(SO4²⁻) − logKsp
//   celestine        SrSO4       → log a(Sr²⁺) + log a(SO4²⁻) − logKsp
//
// 'gypsum' is accepted as an alias for 'selenite' — same chemistry,
// same Ksp.
//
// =============================================================
// Convention notes — these matter for interpretation
// =============================================================
//
// 1. **S is taken to be SO₄²⁻** by the SPECIES_PROPERTIES convention
//    (js/20a). Real fluids partition S between sulfate and sulfide
//    species depending on Eh / pH; this module reads total S as
//    if fully oxidized. For the supergene and evaporite scenarios
//    the sulfate chips matter to, that's the geologically correct
//    speciation (sulfates only form where SO₄ dominates). For
//    reducing systems (sulphur_bank's H₂S-dominant pulses) the SI
//    will read artificially supersaturated — but those systems aren't
//    the targets of these chips. Documented Phase 1 simplification.
//
// 2. **a(H₂O) is explicit for gypsum.** The reaction is
//    `CaSO4·2H2O = Ca + SO4 + 2H2O`, so log IAP includes 2 log(a_w).
//    waterActivity() uses a disclosed NaCl-equivalent interpolation of
//    Chirife & Resnik (1984) data; natural multicomponent brines retain an
//    uncertainty flag rather than being mislabeled as Pitzer-grade output.
//
// 3. **Davies activity coefficients** (capped at γ ≤ 1) used via the
//    existing speciesActivity() in 20a — same path as the carbonate
//    SI engine. Valid to I ≈ 0.5 mol/kg; clamps gracefully above.

// Geometric-mean SI for AB(SO4) sulfates: SI = log10(a_cation · a_SO4) − log10(Ksp).
// Returns NaN if cation/SO4 absent or thermo not loaded — call sites
// (strip chip reads) treat NaN as null (chip hides that sample).
function _SI_AB_sulfate(mineralId: string, fluid: any, T: number, cationKey: string, hydrationWaters = 0): number {
  if (!fluid) return NaN;
  // Explicit sulfur fluids must use only their sulfate reservoir. Legacy
  // fluids use the redox-partitioned sulfate amount. Clone rather than mutate
  // the live fluid so the SI calculation is a pure observer/driver.
  const sulfatePpm = typeof sulfateAvailablePpm === 'function'
    ? sulfateAvailablePpm(fluid, T)
    : Math.max(0, Number(fluid.S) || 0);
  const activityFluid = Object.assign(
    Object.create(Object.getPrototypeOf(fluid) || null),
    fluid,
    { S: sulfatePpm },
  );
  const I = ionicStrength(activityFluid);
  const a_cation = speciesActivity(activityFluid, cationKey, I);
  if (!(a_cation > 0)) return NaN;
  const a_SO4 = speciesActivity(activityFluid, 'S', I);
  if (!(a_SO4 > 0)) return NaN;
  const logKsp = getSulfateLogKsp(mineralId, T);
  if (!isFinite(logKsp)) return NaN;
  const logWater = hydrationWaters > 0
    ? hydrationWaters * Math.log10(waterActivity(activityFluid, T))
    : 0;
  return Math.log10(a_cation) + Math.log10(a_SO4) + logWater - logKsp;
}

function saturationIndex_selenite(fluid: any, T: number): number {
  return _SI_AB_sulfate('selenite', fluid, T, 'Ca', 2);
}
function saturationIndex_anhydrite(fluid: any, T: number): number {
  return _SI_AB_sulfate('anhydrite', fluid, T, 'Ca');
}
function saturationIndex_barite(fluid: any, T: number): number {
  return _SI_AB_sulfate('barite', fluid, T, 'Ba');
}
function saturationIndex_celestine(fluid: any, T: number): number {
  return _SI_AB_sulfate('celestine', fluid, T, 'Sr');
}

// =============================================================
// Public observers — strip chips in 99j consume these.
// =============================================================

// log10 Ω = log10(IAP / Ksp). 0 = equilibrium, +1 = 10× supersat,
// −1 = 10× undersat. NaN if data unavailable. Consumers (strip chip
// reads) treat NaN as null (chip hides that sample).
function sulfateSaturationIndex(mineralId: string, fluid: any, T_C: number): number {
  if (!fluid) return NaN;
  switch (mineralId) {
    case 'selenite':
    case 'gypsum':    return saturationIndex_selenite(fluid, T_C);
    case 'anhydrite': return saturationIndex_anhydrite(fluid, T_C);
    case 'barite':    return saturationIndex_barite(fluid, T_C);
    case 'celestine': return saturationIndex_celestine(fluid, T_C);
    default:          return NaN;
  }
}

// Ω = IAP / Ksp = 10^SI. Returns 0 (not NaN) for missing data so
// engine call sites can treat omega=0 as "cannot precipitate" without
// defensive checks. Matches carbonateOmega convention in 32b.
function sulfateOmega(mineralId: string, fluid: any, T_C: number): number {
  const SI = sulfateSaturationIndex(mineralId, fluid, T_C);
  if (!isFinite(SI)) return 0;
  return Math.pow(10, SI);
}

type CaSO4Evaluation = {
  phase: GypsumAnhydriteBoundaryAssessment;
  gypsumSI: number;
  anhydriteSI: number;
  gypsumOmega: number;
  anhydriteOmega: number;
  gypsumPrimaryAdmissible: boolean;
  anhydritePrimaryAdmissible: boolean;
  gypsumToAnhydriteAdmissible: boolean;
  anhydriteToGypsumAdmissible: boolean;
  reasons: string[];
};

// Single CaSO4 evaluator consumed by diagnostics, nucleation, and replacement.
// Stability and kinetic admissibility are separate outputs by design.
function evaluateCaSO4System(
  fluid: any,
  temperatureC: number,
  fluidPressureKbar: number,
): CaSO4Evaluation {
  const phase = gypsumAnhydritePhaseAssessment(fluid, temperatureC, fluidPressureKbar);
  const gypsumSI = sulfateSaturationIndex('selenite', fluid, temperatureC);
  const anhydriteSI = sulfateSaturationIndex('anhydrite', fluid, temperatureC);
  const gypsumOmega = Number.isFinite(gypsumSI) ? Math.pow(10, gypsumSI) : 0;
  const anhydriteOmega = Number.isFinite(anhydriteSI) ? Math.pow(10, anhydriteSI) : 0;
  const pH = Number(fluid?.pH);
  const sulfate = typeof sulfateAvailablePpm === 'function'
    ? sulfateAvailablePpm(fluid, temperatureC)
    : Math.max(0, Number(fluid?.S) || 0);
  const gypsumPrimaryAdmissible = gypsumSI > 0
    && temperatureC <= 80
    && (!Number.isFinite(pH) || pH >= 4)
    && sulfate > 0;
  const anhydritePrimaryAdmissible = anhydriteSI > 0
    && temperatureC >= 100
    && (!Number.isFinite(pH) || (pH >= 5 && pH <= 9))
    && sulfate > 0;
  const gypsumToAnhydriteAdmissible = phase.phase === 'anhydrite' && anhydriteSI > 0;
  const anhydriteToGypsumAdmissible = phase.phase === 'gypsum' && gypsumSI > 0;
  const reasons = [
    `gypsum SI ${Number.isFinite(gypsumSI) ? gypsumSI.toFixed(3) : 'undefined'}`,
    `anhydrite SI ${Number.isFinite(anhydriteSI) ? anhydriteSI.toFixed(3) : 'undefined'}`,
    `${phase.phase} equilibrium assessment at boundary ${phase.boundaryC.toFixed(1)} +/- ${phase.uncertaintyC.toFixed(1)} C`,
    temperatureC <= 80 ? 'primary gypsum kinetic window open' : 'primary gypsum kinetic window closed above 80 C',
    temperatureC >= 100 ? 'primary anhydrite kinetic floor cleared' : 'primary anhydrite kinetic floor not cleared',
    sulfate > 0 ? `sulfate reservoir ${sulfate.toFixed(3)} ppm` : 'no sulfate available',
  ];
  return {
    phase,
    gypsumSI,
    anhydriteSI,
    gypsumOmega,
    anhydriteOmega,
    gypsumPrimaryAdmissible,
    anhydritePrimaryAdmissible,
    gypsumToAnhydriteAdmissible,
    anhydriteToGypsumAdmissible,
    reasons,
  };
}
