// ============================================================
// js/34-supersat-hydroxide.ts — supersaturation methods for hydroxide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/hydroxide.py. Minerals (2): goethite, lepidocrocite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.
//
// v127 (2026-05-21): Each mineral now exports a MINERAL_GATES_<mineral>
// structured constant that captures σ_crit (from nucleation file),
// composition gates, T/pH/O2 ranges, and surface energy category. The
// gates power (a) the initiative system in js/20-initiative.ts and
// (b) the library card "Competitiveness profile" section. The supersat
// function reads composition + redox gates from the constant; the
// nucleation function reads σ_crit. Refactor is internal — no behavior
// change, baselines byte-identical.

// ---- Hydroxide MINERAL_GATES exports (interface in 18a-mineral-gates-types.ts) ----

const MINERAL_GATES_goethite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 80,
  fluid_min: { Fe: 15 },
  O2_min: 0.4,                  // hydroxideRedoxAvailable(fluid, 0.4)
  surface_energy: 'medium',
  _sources: ['goethite nucleation gate (84-nucleation-hydroxide:17)', 'Cornell & Schwertmann 2003 (iron oxides)'],
  _notes: 'σ attenuates exponentially above T=150°C (kinetic ceiling). pH < 3 incurs σ penalty but does not gate.',
};

const MINERAL_GATES_lepidocrocite: MineralGates = {
  sigma_crit: 1.1,
  T_optimal: 40,
  T_max: 200,                   // no hard cap but σ attenuates sharply above 50
  fluid_min: { Fe: 15 },
  O2_min: 0.8,                  // hydroxideRedoxAvailable(fluid, 0.8) — more strongly oxidizing than goethite
  pH_max: 9.5,                  // σ attenuates above 7.5; effectively gated by 9.5
  surface_energy: 'medium',
  _sources: ['lepidocrocite nucleation gate (84-nucleation-hydroxide:38)', 'Cornell & Schwertmann 2003'],
  _notes: 'γ-FeO(OH) is the metastable polymorph; converts to goethite over time. Secondary nucleation gate at σ > 1.7.',
};

Object.assign(VugConditions.prototype, {
  supersaturation_goethite() {
  const g = MINERAL_GATES_goethite;
  if (this.fluid.Fe < g.fluid_min!.Fe || !hydroxideRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  let sigma = (this.fluid.Fe / 60.0) * hydroxideRedoxFactor(this.fluid, 1.0);
  if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'goethite');
  return Math.max(sigma, 0);
},

  supersaturation_lepidocrocite() {
  const g = MINERAL_GATES_lepidocrocite;
  if (this.fluid.Fe < g.fluid_min!.Fe || !hydroxideRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const fe_f = Math.min(this.fluid.Fe / 50.0, 2.0);
  const o_f = hydroxideRedoxFactor(this.fluid, 1.5, 1.5);
  let sigma = fe_f * o_f;
  if (this.temperature > 50) sigma *= Math.exp(-0.02 * (this.temperature - 50));
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.4;
  if (this.fluid.pH > 7.5) sigma *= Math.max(0.5, 1.0 - (this.fluid.pH - 7.5) * 0.3);
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'lepidocrocite');
  return Math.max(sigma, 0);
},
});
