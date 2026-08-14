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
  _sources: ['halite engine v27+', 'Usiglio 1849 via Warren 2021 (rung-5 re-anchor)'],
  _notes: 'rung-5: σ = (brine_strength/10.6)² where brine_strength = (salinity/35)×concentration in seawater multiples; halite onset 10.6× (Usiglio). Na/Cl floors are presence gates only. T > 100 attenuates 0.7×.',
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
  _sources: ['sylvite engine v63+', 'Warren 2021 (bittern 70–90×; rung-5 re-anchor)'],
  _notes: 'rung-5: σ = (brine_strength/70)² — bittern-stage onset (70–90× seawater, conservative end). EXTINCT at seed 42 until a real potash scenario ships. Mg > 500 suppresses (carnallite competition).',
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
  // rung-5 (SIM 234): re-anchored from abstracted ppm to REAL brine strength.
  // The v27 form σ = (Na/100)·(Cl/500)·c² put σ=1 at Na·Cl = 50,000 ppm² —
  // orders of magnitude below real halite saturation (~1.7×10¹⁰ ppm²) — so
  // nearly any Cl-bearing fluid fired it: tn457 grew halite ×12 from a
  // 4.5-psu Pb-Zn vug brine at 0.13× seawater strength (HALF that scenario's
  // crystals were salt), tutorial_travertine ×8 at 0.17×. The ppm axis CANNOT
  // carry the saturation decision: broths use deliberately-abstracted,
  // scenario-inconsistent sim-scale ppm (searles Na 1500 for a real ~110,000
  // ppm brine; sabkha Na 10,500 near-real — see scenarios.json5's own
  // convention note). The axis the sim already tracks in REAL units is
  // BRINE STRENGTH = (salinity/35 psu) × evaporative concentration, in
  // multiples of seawater. Halite begins at 10.6× seawater (Usiglio 1849;
  // Warren 2021 Evaporites). σ = (BS/10.6)² — quadratic kept, now for the
  // honest reason: both conserved ions scale with evaporation, IAP ∝ c².
  // Census (rung-5 halite-saturation-census): every keeper fires via its
  // real mechanism — searles drying spikes BS 15.4 (σ 2.12), GSP spikes 12.9
  // (σ 1.47), bisbee final_drying efflorescence (event salinity, js/70j) —
  // and every offender (tn457 0.13×, travertine 0.17×, all steady-brine c=1
  // births) goes to zero. Na/Cl floors remain as PRESENCE gates only.
  const g = MINERAL_GATES_halite;
  if (this.fluid.Na < g.fluid_min!.Na || this.fluid.Cl < g.fluid_min!.Cl) return 0;
  const c = this.fluid.concentration ?? 1.0;
  const brineStrength = ((this.fluid.salinity ?? 5.0) / 35.0) * c;
  let sigma = (brineStrength / 10.6) ** 2;
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
    // rung-5 (SIM 234): re-anchored with halite (see supersaturation_halite's
    // rationale block). Sylvite is a BITTERN-stage salt — the K-Mg chlorides
    // arrive only after massive halite precipitation, at 70–90× seawater
    // (Warren 2021; Usiglio's bitterns). σ = (BS/70)², the conservative end.
    // No current scenario approaches (fleet max BS 15.4 at searles' driest
    // spike) → sylvite goes EXTINCT at seed 42, and that is CORRECT: the
    // census showed every firing was spurious — sabkha ×4 at 3.4× BEFORE any
    // halite (inverted bittern order), searles ×3 at 5.1×, bisbee ×3 at 2.6×
    // (convicted by the hostile review's own scenario verdict: "sylvite, a
    // potash evaporite that cannot form at 3× seawater"; its lever: "keep
    // sylvite gated out entirely — no K-evaporite parent exists in this
    // system"). DEAD-not-stale, the willemite pattern: sylvite returns when a
    // real potash scenario (Zechstein / Prairie Evaporite / Khorat) ships
    // with a genuine 70×+ bittern stage.
    const g = MINERAL_GATES_sylvite;
    if (this.fluid.K < g.fluid_min!.K || this.fluid.Cl < g.fluid_min!.Cl) return 0;
    const c = this.fluid.concentration ?? 1.0;
    const brineStrength = ((this.fluid.salinity ?? 5.0) / 35.0) * c;
    let sigma = (brineStrength / 70.0) ** 2;
    if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
    if (this.fluid.Mg > 500) sigma *= Math.max(0.4, 1.0 - 0.001 * (this.fluid.Mg - 500));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'sylvite');
    return Math.max(sigma, 0);
  },
});
