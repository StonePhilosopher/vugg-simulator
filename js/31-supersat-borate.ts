// ============================================================
// js/31-supersat-borate.ts — supersaturation methods for borate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/borate.py. Minerals (2): borax, tincalconite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates export added.

// ---- Borate MINERAL_GATES exports ----

const MINERAL_GATES_borax: MineralGates = {
  sigma_crit: 1.0,
  T_max: 60,                    // hard cutoff: above 60°C borax dissolves
  T_optimal: 25,
  fluid_min: { Na: 50, B: 5 },
  pH_min: 7.0,                  // hard cutoff: alkaline only
  surface_energy: 'low',        // hydrated alkaline borate; relatively low γ_sl
  _sources: ['borax engine v28+', 'Searles Lake / Mojave evaporite literature'],
  _notes: 'Strict active-evaporation mineral — needs concentration ≥ 1.5 (vadose/meniscus rings only). Ca > 50 ppm suppresses.',
};

const MINERAL_GATES_tincalconite: MineralGates = {
  sigma_crit: Infinity,         // paramorph stub — never nucleates from solution
  T_max: 60,
  fluid_min: { Na: 50, B: 5 },
  pH_min: 7.0,
  surface_energy: 'low',
  _sources: ['tincalconite paramorph note in supersat function'],
  _notes: 'Paramorph product of borax dehydration (Na2B4O7·5H2O after Na2B4O7·10H2O). Never nucleates from fluid — only forms by replacement of existing borax. sigma_crit = Infinity reflects "no direct precipitation path."',
};

Object.assign(VugConditions.prototype, {
  supersaturation_tincalconite() {
  // v28 paramorph product of borax — never nucleates from solution.
  return 0;
},

  supersaturation_borax() {
  // v28 alkaline-brine borate evaporite. Mirror of
  // supersaturation_borax in vugg.py.
  const g = MINERAL_GATES_borax;
  if (this.fluid.Na < g.fluid_min!.Na || this.fluid.B < g.fluid_min!.B) return 0;
  if (this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min!) return 0;
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
