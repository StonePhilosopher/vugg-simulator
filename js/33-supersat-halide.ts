// ============================================================
// js/33-supersat-halide.ts — supersaturation methods for halide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/halide.py. Minerals (2): fluorite, halite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Halide MINERAL_GATES exports ----

const MINERAL_GATES_fluorite: MineralGates = {
  sigma_crit: 1.2,
  T_optimal: 150,
  fluid_min: { Ca: 10, F: 5 },
  pH_min: 3.0,                  // σ attenuates below 5; effectively gated by 3
  surface_energy: 'medium',
  _sources: ['fluorite engine v17+', 'Richardson & Holland 1979', 'Hamza & Hamdona 1991'],
  _notes: '5-tier T window peak 100-250°C per Richardson & Holland 1979. Fluoro-complex penalty above F=80 ppm.',
};

const MINERAL_GATES_halite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 25,
  fluid_min: { Na: 5, Cl: 50 },
  surface_energy: 'low',
  _sources: ['halite engine v27+'],
  _notes: 'Quadratic in concentration — stays dormant at scenario baseline (c=1), fires when vadose concentration spike kicks in. T > 100 attenuates by 0.7×.',
};

const MINERAL_GATES_atacamite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 5,
  T_max: 200,
  T_optimal: 30,
  fluid_min: { Cu: 10, Cl: 30 },
  O2_min: 0.5,                  // strict oxidizing only
  pH_min: 4.0,                  // σ attenuates below 5; effective gate ~4
  pH_max: 8.5,                  // σ attenuates above 7; effective gate ~8.5
  surface_energy: 'medium',
  _sources: ['atacamite engine v63+', 'Atacama Desert supergene literature'],
  _notes: 'Arid Cu-supergene chloride. Wins over malachite/brochantite/chrysocolla when Cl dominates Cu-pairing. CO3 > 100 and S > 100 suppress.',
};

const MINERAL_GATES_sylvite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 25,
  T_max: 200,                   // σ attenuates above 100; effectively gated by 200
  fluid_min: { K: 50, Cl: 100 },
  surface_energy: 'low',
  _sources: ['sylvite engine v63+', 'late-stage potash evaporite literature'],
  _notes: 'Quadratic in concentration like halite. Mg > 500 suppresses (carnallite competition).',
};

Object.assign(VugConditions.prototype, {
  supersaturation_fluorite() {
  const g = MINERAL_GATES_fluorite;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.F < g.fluid_min!.F) return 0;
  let product = (this.fluid.Ca / 200.0) * (this.fluid.F / 20.0);
  // 5-tier T window per Richardson & Holland 1979 + MVT deposit
  // studies showing 50-152°C formation range. Solubility increases
  // with T below 100°C (kinetically slow precipitation), passes
  // through max around 100-250°C, declines above 350°C.
  let T_factor = 1.0;
  if (this.temperature < 50) T_factor = this.temperature / 50.0;
  else if (this.temperature < 100) T_factor = 0.8;
  else if (this.temperature <= 250) T_factor = 1.2;
  else if (this.temperature <= 350) T_factor = 1.0;
  else T_factor = Math.max(0.1, 1.0 - (this.temperature - 350) / 200);
  let sigma = product * T_factor;
  // v17: fluoro-complex penalty (ported from Python canonical, May 2026).
  // Per Manning 1979 — at very high F, Ca²⁺ + nF⁻ → CaFₙ complexes
  // re-dissolve fluorite. Secondary effect at T<300°C, real.
  if (this.fluid.F > 80) {
    const complex_penalty = (this.fluid.F - 80) / 200.0;
    sigma -= complex_penalty;
  }
  // Acid dissolution — fluorite dissolves in strong acid
  if (this.fluid.pH < 5.0) {
    const acid_attack = (5.0 - this.fluid.pH) * 0.4;
    sigma -= acid_attack;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'fluorite');
  return Math.max(sigma, 0);
},

  supersaturation_halite() {
  // v27 chloride evaporite. Quadratic in concentration so halite
  // stays dormant at scenario baseline (concentration=1) and fires
  // sharply when a vadose-transition concentration spike kicks in.
  // Mirror of supersaturation_halite in vugg.py.
  const g = MINERAL_GATES_halite;
  if (this.fluid.Na < g.fluid_min!.Na || this.fluid.Cl < g.fluid_min!.Cl) return 0;
  const c = this.fluid.concentration ?? 1.0;
  let sigma = (this.fluid.Na / 100.0) * (this.fluid.Cl / 500.0) * c * c;
  if (this.temperature > 100) sigma *= 0.7;
  if (this.fluid.pH < 4.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'halite');
  return Math.max(sigma, 0);
},

  // v63 brief-19: arid Cu-supergene chloride.
  // Cu2Cl(OH)3 — wins over malachite/brochantite/chrysocolla when Cl is the
  // dominant Cu-pairing anion (Atacama-style aridity). Strict supergene T
  // and oxidizing-only redox.
  supersaturation_atacamite() {
    const g = MINERAL_GATES_atacamite;
    if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.Cl < g.fluid_min!.Cl) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    let sigma = (this.fluid.Cu / 80.0) * (this.fluid.Cl / 200.0);
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    if (T > 100) sigma *= Math.exp(-0.04 * (T - 100));
    else if (T > 40) sigma *= 1.0 - 0.005 * (T - 40);
    if (this.fluid.pH > 7.0) sigma *= Math.max(0.2, 1.0 - 0.25 * (this.fluid.pH - 7.0));
    if (this.fluid.pH < 5.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (5.0 - this.fluid.pH));
    if (this.fluid.CO3 > 100) sigma *= Math.max(0.3, 1.0 - 0.005 * (this.fluid.CO3 - 100));
    if (this.fluid.S > 100) sigma *= Math.max(0.4, 1.0 - 0.003 * (this.fluid.S - 100));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'atacamite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: late-stage evaporite K-Cl. Quadratic in concentration
  // (like halite) — stays dormant at scenario baseline, fires sharply
  // when a vadose-transition concentration spike kicks in. Carnallite
  // competes for K when Mg is high.
  supersaturation_sylvite() {
    const g = MINERAL_GATES_sylvite;
    if (this.fluid.K < g.fluid_min!.K || this.fluid.Cl < g.fluid_min!.Cl) return 0;
    const c = this.fluid.concentration ?? 1.0;
    let sigma = (this.fluid.K / 200.0) * (this.fluid.Cl / 800.0) * c * c;
    if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
    if (this.fluid.Mg > 500) sigma *= Math.max(0.4, 1.0 - 0.001 * (this.fluid.Mg - 500));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'sylvite');
    return Math.max(sigma, 0);
  },
});
