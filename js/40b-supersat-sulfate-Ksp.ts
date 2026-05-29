// ============================================================
// js/40b-supersat-sulfate-Ksp.ts — Ksp-based SI for sulfates
// ============================================================
// Mirror of 32b-supersat-carbonate-Ksp.ts for the sulfate family.
// Pure observer (Phase 1 / 2026-05-30): consumed by the strip's
// sulfate SI chips (SI_selenite/anhydrite/barite/celestine, added
// in 99j) so the strip stops being SI-blind on the evaporite +
// sulfate-vein scenario family (naica / sicily_solfifera /
// sulphur_bank / sabkha / searles).
//
// The existing 40-supersat-sulfate.ts σ-driver functions remain the
// nucleation gates and are unchanged by this module. The relationship
// between this module's SI and 40's σ is the same as the relationship
// between 32b's SI and 32's σ for carbonates: SI is the rigorous
// thermodynamic observable (log Ω = log IAP − log Ksp(T)); σ is the
// engine's capped nucleation driver (Math.min(ratio, cap) × T/pH
// modifiers). They tell different stories — both useful.
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
// 2. **a(H₂O) = 1** for gypsum's `CaSO4·2H2O = Ca + SO4 + 2H2O`. The
//    PHREEQC wateq4f log_k is also defined at unit water activity —
//    so matching the database convention is the right call here. For
//    halite-saturated brines a(H₂O) drops to ~0.75 and gypsum SI would
//    be ~0.25 units low; Pitzer-grade work is research-mode territory.
//
// 3. **Davies activity coefficients** (capped at γ ≤ 1) used via the
//    existing speciesActivity() in 20a — same path as the carbonate
//    SI engine. Valid to I ≈ 0.5 mol/kg; clamps gracefully above.

// Geometric-mean SI for AB(SO4) sulfates: SI = log10(a_cation · a_SO4) − log10(Ksp).
// Returns NaN if cation/SO4 absent or thermo not loaded — call sites
// (strip chip reads) treat NaN as null (chip hides that sample).
function _SI_AB_sulfate(mineralId: string, fluid: any, T: number, cationKey: string): number {
  if (!fluid) return NaN;
  const I = ionicStrength(fluid);
  const a_cation = speciesActivity(fluid, cationKey, I);
  if (!(a_cation > 0)) return NaN;
  const a_SO4 = speciesActivity(fluid, 'S', I);
  if (!(a_SO4 > 0)) return NaN;
  const logKsp = getSulfateLogKsp(mineralId, T);
  if (!isFinite(logKsp)) return NaN;
  return Math.log10(a_cation) + Math.log10(a_SO4) - logKsp;
}

function saturationIndex_selenite(fluid: any, T: number): number {
  return _SI_AB_sulfate('selenite', fluid, T, 'Ca');
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
