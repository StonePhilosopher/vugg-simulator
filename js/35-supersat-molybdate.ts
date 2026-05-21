// ============================================================
// js/35-supersat-molybdate.ts — supersaturation methods for molybdate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/molybdate.py. Minerals (4): ferrimolybdite, raspite, stolzite, wulfenite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Molybdate MINERAL_GATES exports ----

const MINERAL_GATES_wulfenite: MineralGates = {
  sigma_crit: 1.2,
  T_optimal: 50,
  fluid_min: { Pb: 10, Mo: 5 },
  O2_min: 0.5,
  pH_min: 3.5,
  pH_max: 9.0,
  surface_energy: 'medium',
  _sources: ['wulfenite engine v17+ reconciliation', 'research-wulfenite.md'],
  _notes: 'Rare two-parent (Pb from galena × Mo from molybdenite) supergene mineral. Decay above 80°C — supergene-only ceiling.',
};

const MINERAL_GATES_ferrimolybdite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Mo: 2, Fe: 3 },
  O2_min: 0.5,
  pH_min: 3.0,
  pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['ferrimolybdite engine v17+'],
  _notes: 'Canary-yellow Mo-oxidation product. Faster, less-picky than wulfenite. Strongly low-temperature (decay above 50°C).',
};

const MINERAL_GATES_raspite: MineralGates = {
  sigma_crit: 1.4,
  T_optimal: 30,
  fluid_min: { Pb: 40, W: 5 },
  O2_min: 0.5,
  pH_min: 4.0,
  pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['raspite engine v17+'],
  _notes: 'Monoclinic PbWO4. Cool-T window 20-40°C optimal. Loses to stolzite at higher σ (one of them suppresses the other in nucleation gate).',
};

const MINERAL_GATES_stolzite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 50,
  fluid_min: { Pb: 40, W: 5 },
  O2_min: 0.5,
  pH_min: 4.0,
  pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['stolzite engine v17+'],
  _notes: 'Tetragonal PbWO4. Wider T window than raspite (20-80°C optimal). Dominates the Pb-W slot.',
};

const MINERAL_GATES_scheelite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 100,
  T_max: 700,
  T_optimal: 400,
  fluid_min: { Ca: 50, W: 1 },
  pH_min: 4.0,
  surface_energy: 'medium',
  _sources: ['scheelite engine v63+'],
  _notes: 'CaWO4 — hydrothermal Ca-tungstate. Bright blue-white SW UV fluorescence (diagnostic vs wolframite).',
};

const MINERAL_GATES_powellite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 5,
  T_max: 250,
  T_optimal: 50,
  fluid_min: { Ca: 50, Mo: 1 },
  O2_min: 0.5,
  pH_min: 5.0,
  surface_energy: 'medium',
  _sources: ['powellite engine v63+'],
  _notes: 'CaMoO4 — supergene oxidation of molybdenite. Bright yellow SW UV (vs scheelite blue).',
};

const MINERAL_GATES_wolframite: MineralGates = {
  sigma_crit: 1.3,
  T_min: 200,
  T_max: 600,
  T_optimal: 350,
  fluid_min: { W: 1, Fe: 5, Mn: 1 },
  O2_min: 0.5,
  pH_min: 4.0,
  pH_max: 6.0,
  surface_energy: 'high',
  _sources: ['wolframite engine v63+'],
  _notes: '(Fe,Mn)WO4 monoclinic. Wins over scheelite when Ca depleted (Ca > 80 suppresses). Non-fluorescent.',
};

Object.assign(VugConditions.prototype, {
  supersaturation_wulfenite() {
  // v17 reconciliation (May 2026): per research-wulfenite.md
  // "T <80°C (supergene), pH 6-9 (near-neutral to slightly alkaline),
  // rare two-parent mineral that only appears when chemistry of two
  // different primary ore bodies converges." Pre-v17 JS T cap at
  // 250°C was way too lenient (250°C is hydrothermal, not supergene);
  // pH window 4-7 was too restrictive on alkaline side. Now matches
  // Python: decay above 80°C, graduated pH penalties at 3.5/9.0.
  // Pb/Mo thresholds (>=10/>=5) preserved — JS canonical here, matches
  // the research's "rare two-parent" framing better than Python's
  // pre-v17 lower thresholds.
  const gw = MINERAL_GATES_wulfenite;
  if (this.fluid.Pb < gw.fluid_min!.Pb || this.fluid.Mo < gw.fluid_min!.Mo || !molybdateRedoxAvailable(this.fluid, gw.O2_min!)) return 0;
  let sigma = (this.fluid.Pb / 40.0) * (this.fluid.Mo / 15.0) * molybdateRedoxFactor(this.fluid, 1.0);
  // Decay above 80°C — supergene-only ceiling
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.025 * (this.temperature - 80));
  }
  // Graduated pH penalties (matches research: 6-9 window, soft edges)
  if (this.fluid.pH < 3.5) {
    sigma -= (3.5 - this.fluid.pH) * 0.4;
  } else if (this.fluid.pH > 9.0) {
    sigma -= (this.fluid.pH - 9.0) * 0.3;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'wulfenite');
  return Math.max(sigma, 0);
},

  supersaturation_ferrimolybdite() {
  const g = MINERAL_GATES_ferrimolybdite;
  if (this.fluid.Mo < g.fluid_min!.Mo || this.fluid.Fe < g.fluid_min!.Fe || !molybdateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  // Lower Mo threshold + /10 scaling reflects faster, less-picky growth.
  let sigma = (this.fluid.Mo / 10.0) * (this.fluid.Fe / 20.0) * molybdateRedoxFactor(this.fluid, 1.0);
  // Strongly low-temperature — supergene/weathering zone only.
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.02 * (this.temperature - 50));
  }
  // pH window — mild acidic to neutral.
  if (this.fluid.pH > 7) {
    sigma *= Math.max(0.2, 1.0 - 0.2 * (this.fluid.pH - 7));
  } else if (this.fluid.pH < 3) {
    sigma *= Math.max(0.3, 1.0 - 0.25 * (3 - this.fluid.pH));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'ferrimolybdite');
  return Math.max(sigma, 0);
},

  supersaturation_raspite() {
  const g = MINERAL_GATES_raspite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.W < g.fluid_min!.W) return 0;
  if (!molybdateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.0);
  const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
  const ox_f = molybdateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = pb_f * w_f * ox_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'raspite');
  return Math.max(sigma, 0);
},

  supersaturation_stolzite() {
  const g = MINERAL_GATES_stolzite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.W < g.fluid_min!.W) return 0;
  if (!molybdateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
  const ox_f = molybdateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = pb_f * w_f * ox_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 80) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 100) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 80));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'stolzite');
  return Math.max(sigma, 0);
},

  // v63 brief-19: CaWO4 — Ca-tungstate, scheelite-group lattice (same as
  // raspite/stolzite/wulfenite). Bright blue-white SW UV fluorescence is
  // the diagnostic. Loses to wolframite when Ca is depleted.
  supersaturation_scheelite() {
    const g = MINERAL_GATES_scheelite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.W < g.fluid_min!.W) return 0;
    if (!molybdateRedoxAvailable(this.fluid, 0.0)) return 0;
    let sigma = (this.fluid.Ca / 200.0) * (this.fluid.W / 8.0);
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    let T_factor = 1.0;
    if (T >= 300 && T <= 500) T_factor = 1.2;
    else if (T < 300) T_factor = Math.max(0.5, 0.6 + 0.003 * (T - 100));
    else T_factor = Math.max(0.5, 1.2 - 0.0035 * (T - 500));
    sigma *= T_factor;
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.4, 1.0 - 0.2 * (4.0 - this.fluid.pH));
    // Mo competition shifts toward powellite end-member but stays in same
    // mineral; only large Mo pulls fluorescence toward yellow.
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'scheelite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: CaMoO4 — Mo-end-member of powellite-scheelite SS. Forms
  // in supergene oxidation of molybdenite. Bright yellow SW UV (vs
  // scheelite's blue) — same lattice, different activator.
  supersaturation_powellite() {
    const g = MINERAL_GATES_powellite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Mo < g.fluid_min!.Mo) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    let sigma = (this.fluid.Ca / 200.0) * (this.fluid.Mo / 8.0);
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    let T_factor = 1.0;
    if (T >= 20 && T <= 100) T_factor = 1.2;
    else if (T < 20) T_factor = Math.max(0.4, 0.5 + 0.04 * (T - 5));
    else T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 100));
    sigma *= T_factor;
    if (this.fluid.pH < 5.0) sigma *= Math.max(0.4, 1.0 - 0.25 * (5.0 - this.fluid.pH));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'powellite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: (Fe,Mn)WO4 — Fe-Mn tungstate, monoclinic (NOT scheelite-
  // group). Wins over scheelite when Ca is depleted and Fe+Mn dominate.
  // Refractory; non-fluorescent (diagnostic vs scheelite).
  supersaturation_wolframite() {
    const g = MINERAL_GATES_wolframite;
    if (this.fluid.W < g.fluid_min!.W || this.fluid.Fe < g.fluid_min!.Fe || this.fluid.Mn < g.fluid_min!.Mn) return 0;
    if (!molybdateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    let sigma = (this.fluid.W / 8.0) * (this.fluid.Fe / 30.0 + this.fluid.Mn / 15.0) * 0.5;
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    let T_factor = 1.0;
    if (T >= 300 && T <= 400) T_factor = 1.2;
    else if (T < 300) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 200));
    else T_factor = Math.max(0.5, 1.2 - 0.003 * (T - 400));
    sigma *= T_factor;
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.5, 1.0 - 0.2 * (4.0 - this.fluid.pH));
    else if (this.fluid.pH > 6.0) sigma *= Math.max(0.5, 1.0 - 0.2 * (this.fluid.pH - 6.0));
    // Ca competition — scheelite wins
    if (this.fluid.Ca > 80) sigma *= Math.max(0.5, 1.0 - 0.005 * (this.fluid.Ca - 80));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'wolframite');
    return Math.max(sigma, 0);
  },
});
