// ============================================================
// js/31-supersat-borate.ts — supersaturation methods for borate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/borate.py. Minerals (2): borax, tincalconite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_tincalconite() {
  // v28 paramorph product of borax — never nucleates from solution.
  return 0;
},

  supersaturation_borax() {
  // v28 alkaline-brine borate evaporite. Mirror of
  // supersaturation_borax in vugg.py.
  if (this.fluid.Na < 50 || this.fluid.B < 5) return 0;
  if (this.temperature > 60) return 0;
  if (this.fluid.pH < 7.0) return 0;
  const c = this.fluid.concentration ?? 1.0;
  // v28: hard concentration gate — borax is strictly an active-
  // evaporation mineral. Submerged rings stay at c=1.0 and never
  // fire borax; only meniscus + vadose rings cross this threshold.
  if (c < 1.5) return 0;
  let sigma = (this.fluid.Na / 500.0) * (this.fluid.B / 100.0) * c * c;
  if (this.fluid.pH >= 8.5 && this.fluid.pH <= 10.5) sigma *= 1.4;
  else if (this.fluid.pH > 10.5) sigma *= 1.1;
  if (this.fluid.Ca > 50) {
    const caPenalty = Math.min(1.0, this.fluid.Ca / 150.0);
    sigma *= (1.0 - 0.7 * caPenalty);
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'borax');
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor('tincalconite'). Tincalconite IS borax's
  // paramorph (same Na2B4O7 stoich, less water of hydration), so its
  // activity factor was numerically identical to borax's — applying both
  // squared the correction (γ² × m²), which is not how activity-coefficient
  // thermodynamics composes. Regression introduced by the Phase 2b sweep
  // (eff8ec1, 2026-05-05). Equivalent fixes landed on adamite, galena,
  // and stibnite the same day.
  return Math.max(sigma, 0);
},
});
