// ============================================================
// js/38-supersat-phosphate.ts — supersaturation methods for phosphate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/phosphate.py. Minerals (11): autunite, carnotite, clinobisvanite, descloizite, mottramite, pyromorphite, torbernite, tyuyamunite, uranospinite, vanadinite, zeunerite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Phosphate MINERAL_GATES exports ----

const MINERAL_GATES_plumbogummite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 27,
  fluid_min: { Pb: 30, Al: 3, P: 2 },
  O2_min: 0.5,
  pH_min: 4.0, pH_max: 7.5,
  surface_energy: 'low',
  _sources: ['plumbogummite engine v108+', 'Hartley 1882 MinMag 5:21', 'Förtsch 1967', 'Bridges et al. 2011'],
  _notes: 'PbAl3(PO4)2(OH)5·H2O alunite-supergroup. Cl > 30 mildly suppresses (pyromorphite stability).',
};

// v193 descloizite-group V-economics correction: V_min 10 → 4 (and v_f
// normalization /20 → /8 in the σ methods) for BOTH group members. The
// old thresholds made the descloizite group need 5× vanadinite's V
// (gate 10 vs 2, v_f /20 vs /6) — backwards against the deposits: the
// descloizite-group vanadates are the ABUNDANT supergene V ores
// (Otavi Mountainland — once the world's largest V deposits — is
// descloizite/mottramite country; Boni et al. 2007, Econ Geol 102:441:
// mottramite around Cu-sulfide Tsumeb-type bodies, descloizite around
// sphalerite Berg Aukas-type), while vanadinite is the locality-special
// collector phase. Census evidence at v192: mottramite + descloizite
// fired NOWHERE in the 33-scenario fleet (dead-species pair) while
// vanadinite fired in 2. The correction brings the group to vanadinite-
// COMPARABLE V economics (gate 4 vs 2, v_f /8 vs /6), not privileged —
// the Cu/Zn cation forks remain the group's distinctive routing.
// Caldbeck V suite (vanadinite + mottramite + descloizite): Kingsbury
// & Hartley 1956 MinMag; Stanley, Symes & Jones 1991 MinMag 55:121.
const MINERAL_GATES_descloizite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 40,
  fluid_min: { Pb: 40, Zn: 50, V: 4, Cu: 0.5 },
  O2_min: 0.5,
  pH_min: 4, pH_max: 8,
  surface_energy: 'medium',
  _sources: ['descloizite engine v17+', 'Boni et al. 2007 Econ Geol 102:441 (v193 V-economics)'],
  _notes: 'PbZn(VO4)(OH) — Zn-dominant Pb-Zn-V (Zn/(Zn+Cu) ≥ 0.5).',
};

const MINERAL_GATES_mottramite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 40,
  fluid_min: { Pb: 40, Cu: 50, V: 4, Zn: 0.5 },
  O2_min: 0.5,
  pH_min: 4, pH_max: 8,
  surface_energy: 'medium',
  _sources: ['mottramite engine v17+', 'Boni et al. 2007 Econ Geol 102:441 (v193 V-economics)'],
  _notes: 'PbCu(VO4)(OH) — Cu-dominant Pb-Cu-V (Cu/(Cu+Zn) ≥ 0.5).',
};

const MINERAL_GATES_clinobisvanite: MineralGates = {
  sigma_crit: 1.5,
  T_optimal: 30,
  fluid_min: { Bi: 2, V: 2 },
  O2_min: 1.0,
  pH_min: 2.5,
  surface_energy: 'medium',
  _sources: ['clinobisvanite engine v17+'],
  _notes: 'BiVO4 — Bi-vanadate. Substrate-prefers dissolving native_bismuth / bismuthinite.',
};

const MINERAL_GATES_pyromorphite: MineralGates = {
  sigma_crit: 1.2,
  T_optimal: 40,
  fluid_min: { Pb: 20, P: 2, Cl: 5 },
  pH_min: 2.5,
  surface_energy: 'medium',
  _sources: ['pyromorphite engine v17+'],
  _notes: 'Pb5(PO4)3Cl — apatite-group Pb phosphate. Iconic green hexagonal prisms. Substrate-prefers dissolving cerussite + galena.',
};

const MINERAL_GATES_vanadinite: MineralGates = {
  sigma_crit: 1.3,
  T_optimal: 40,
  fluid_min: { Pb: 20, V: 2, Cl: 5 },
  // v193: O2_min added — the MISSING vanadate redox gate. Vanadinite is
  // Pb5(VO4)3Cl, a V⁵⁺ vanadate exactly like its siblings descloizite/
  // mottramite (O2_min 0.5) and clinobisvanite (1.0), but its formula
  // was cloned from pyromorphite (PO4 — P is always +5, needs no gate)
  // and the redox requirement never came along. Census evidence: at
  // roughten_gill v192 all 6 vanadinite crystals nucleated in steps
  // 30-70 at O2 0.20 — reducing-ish fluid where V⁵⁺ isn't mobile
  // (roll-front V geochemistry: V³⁺/V⁴⁺ immobile, V⁵⁺ vanadate needs
  // oxidizing conditions). Same family as the v92 As-state split.
  O2_min: 0.5,
  pH_min: 2.5,
  surface_energy: 'medium',
  _sources: ['vanadinite engine v17+'],
  _notes: 'Pb5(VO4)3Cl — red-orange hexagonal apatite-group. Substrate-pref goethite (Old Yuma Mine signature).',
};

const MINERAL_GATES_torbernite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 50, T_optimal: 25,
  fluid_min: { Cu: 5, U: 0.3, P: 1.0 },
  O2_min: 0.8,
  pH_min: 5.0, pH_max: 7.5,
  surface_energy: 'medium',
  _sources: ['torbernite engine v17+', 'Round 9 cation+anion fork'],
  _notes: 'Cu(UO2)2(PO4)2·12H2O — P-branch / Cu-cation uranyl phosphate. Anion fork P/(P+As+V) ≥ 0.5, cation fork Cu/(Cu+Ca) ≥ 0.5.',
};

const MINERAL_GATES_autunite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 22,
  fluid_min: { Ca: 15, U: 0.3, P: 1.0 },
  O2_min: 0.8,
  pH_min: 4.5, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['autunite engine v17+', 'Round 9d'],
  _notes: 'Ca(UO2)2(PO4)2·11H2O — Ca-cation analog of torbernite. Bright yellow-green LW-UV fluorescent.',
};

const MINERAL_GATES_zeunerite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 50, T_optimal: 25,
  fluid_min: { Cu: 5, U: 0.3, As: 2.0 },
  O2_min: 0.8,
  pH_min: 5.0, pH_max: 7.5,
  surface_energy: 'medium',
  _sources: ['zeunerite engine v17+', 'Round 9c'],
  _notes: 'Cu(UO2)2(AsO4)2·12H2O — As-branch / Cu-cation. Anion fork As/(P+As+V) ≥ 0.5.',
};

const MINERAL_GATES_uranospinite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 22,
  fluid_min: { Ca: 15, U: 0.3, As: 2.0 },
  O2_min: 0.8,
  pH_min: 4.5, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['uranospinite engine v17+', 'Round 9e'],
  _notes: 'Ca(UO2)2(AsO4)2·10H2O — Ca-cation analog of zeunerite.',
};

const MINERAL_GATES_carnotite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 50, T_optimal: 30,
  fluid_min: { K: 5, U: 0.3, V: 1.0 },
  O2_min: 0.8,
  pH_min: 5.0, pH_max: 7.5,
  surface_energy: 'medium',
  _sources: ['carnotite engine v17+', 'Round 9c+9e'],
  _notes: 'K2(UO2)2(VO4)2·3H2O — V-branch / K-cation. Colorado Plateau roll-front signature.',
};

const MINERAL_GATES_tyuyamunite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 25,
  fluid_min: { Ca: 15, U: 0.3, V: 1.0 },
  O2_min: 0.8,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['tyuyamunite engine v17+', 'Round 9e'],
  _notes: 'Ca(UO2)2(VO4)2·5H2O — Ca-cation analog of carnotite.',
};

const MINERAL_GATES_apatite: MineralGates = {
  sigma_crit: 1.1,
  T_min: 50, T_max: 1000, T_optimal: 350,
  fluid_min: { Ca: 50, P: 5 },
  pH_min: 5.0,
  surface_energy: 'medium',
  _sources: ['apatite engine v63+'],
  _notes: 'Ca5(PO4)3(F,Cl,OH) — apatite-supergroup parent. Wide T-window (50-1000°C). Pb > 30 + T < 100 suppresses (pyromorphite/mimetite drain P).',
};

const MINERAL_GATES_turquoise: MineralGates = {
  sigma_crit: 1.3,
  T_min: 5, T_max: 80, T_optimal: 32,
  fluid_min: { Cu: 5, Al: 3, P: 1 },
  O2_min: 0.5,
  pH_min: 6.0, pH_max: 8.5,
  surface_energy: 'low',
  _sources: ['turquoise engine v63+'],
  _notes: 'CuAl6(PO4)4(OH)8·4H2O — sky-blue supergene Cu-Al phosphate. SiO2/CO3/Cl all suppress at high concentrations.',
};

Object.assign(VugConditions.prototype, {
  // v108 (2026-05-20): plumbogummite PbAl3(PO4)2(OH)5·H2O — trigonal
  // Pb-Al-PO4 supergene phase, alunite supergroup (beudantite group).
  // Type locality Roughten Gill, Caldbeck Fells (Hartley 1882 MinMag
  // 5:21); Förtsch 1967 MinMag 36:530 re-examined the type material
  // and showed it to be a plumbogummite-hinsdalite-hidalgoite mix-
  // crystal. The terminal Pb-Al-PO4 phase of the supergene
  // paragenesis — forms LATE, after pyromorphite + Pb-Cu sulfates +
  // Pb-CO3 have had time to develop. The headline cabinet aesthetic
  // is cobalt-blue/sky-blue/lavender/turquoise botryoidal crusts
  // pseudomorphing pyromorphite (cobalt-blue mass draping green
  // hexagonal pyromorphite prisms — world-standard Roughten Gill
  // specimen).
  //
  // GATES — supergene Pb-rich + aluminous wallrock weathering:
  //   Pb ≥ 30  Al ≥ 3  P ≥ 2  (the three required cations)
  //   T 5-50°C  pH 4-7.5  oxidizing (O2 > 0.5)
  //
  // DISCRIMINATOR vs pyromorphite (Pb5(PO4)3Cl) — pyromorphite needs
  // Cl ≥ 5; plumbogummite needs Al ≥ 3. Cl > 30 mildly suppresses
  // plumbogummite (favors pyromorphite stability), modeling the
  // documented late-replacement sequence at Roughten Gill where
  // plumbogummite overprints pyromorphite as Al accumulates from
  // continued wallrock weathering.
  //
  // Refs: Hartley 1882 MinMag 5:21 (type description); Förtsch
  // 1967 MinMag 36:530 (type-material X-ray + IR correction);
  // Russell 1925 MinMag 20:257; Bridges et al. 2011 JRS 14:3
  // (modern Roughten Gill paper); Cooper & Stanley 1990 Minerals
  // of the English Lake District: Caldbeck Fells.
  supersaturation_plumbogummite() {
    const g = MINERAL_GATES_plumbogummite;
    if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Al < g.fluid_min!.Al || this.fluid.P < g.fluid_min!.P) return 0;
    if (!phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    const pb_f = Math.min(this.fluid.Pb / 60.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 8.0, 2.0);
    const p_f  = Math.min(this.fluid.P / 5.0, 2.0);
    let sigma = pb_f * al_f * p_f;
    // T sweet spot — 15-40°C supergene-mature window
    const T = this.temperature;
    if (T >= 15 && T <= 40) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 25) * 0.03);
    // pH sweet spot — 5-6.5 mildly acidic supergene
    if (this.fluid.pH >= 5.0 && this.fluid.pH <= 6.5) sigma *= 1.15;
    // Cl > 30 favors pyromorphite stability — plumbogummite slightly
    // suppressed at high Cl (the late-replacement geological signature)
    if (this.fluid.Cl > 30) {
      sigma *= Math.max(0.6, 1.0 - (this.fluid.Cl - 30) / 100);
    }
    sigma *= phosphateRedoxFactor(this.fluid, 1.0, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'plumbogummite');
    return Math.max(sigma, 0);
  },

  supersaturation_descloizite() {
  const g = MINERAL_GATES_descloizite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Zn < g.fluid_min!.Zn || this.fluid.V < g.fluid_min!.V) return 0;
  if (!phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.Cu < g.fluid_min!.Cu) return 0;
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const zn_fraction = this.fluid.Zn / cu_zn_total;
  if (zn_fraction < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const zn_f = Math.min(this.fluid.Zn / 80.0, 2.5);
  const v_f  = Math.min(this.fluid.V  / 8.0, 2.5);   // v193: /20 → /8 (V-economics, see gates comment)
  const ox_f = phosphateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = pb_f * zn_f * v_f * ox_f;
  if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
  else if (zn_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 30 && T <= 50) T_factor = 1.2;
  else if (T < 20) T_factor = 0.4;
  else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
  else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'descloizite');
  return Math.max(sigma, 0);
},

  supersaturation_mottramite() {
  const g = MINERAL_GATES_mottramite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Cu < g.fluid_min!.Cu || this.fluid.V < g.fluid_min!.V) return 0;
  if (!phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  // NOTE (2026-06-16): NO hard Zn-minimum gate. mottramite is PbCu(VO4)(OH) —
  // the Cu ENDMEMBER of the mottramite–descloizite series; it contains no Zn.
  // The old `if (Zn < 0.5) return 0` was spurious (a descloizite-template
  // copy): it blocked mottramite precisely when the fluid was purest-Cu
  // (Zn→0, cu_fraction→1.0), which is when mottramite should MOST form. It
  // also coupled mottramite to any Zn-consumer — gating oxidized-zone
  // sphalerite drained Zn to 0 at ~half the seeds and falsely killed
  // mottramite (the ZnS-redox-gate held-gate finding, ledger #11). The
  // cu_fraction discriminator below is the correct series gate.
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const cu_fraction = cu_zn_total > 0 ? this.fluid.Cu / cu_zn_total : 1.0;
  if (cu_fraction < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const v_f  = Math.min(this.fluid.V  / 8.0, 2.5);   // v193: /20 → /8 (V-economics, see gates comment)
  const ox_f = phosphateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = pb_f * cu_f * v_f * ox_f;
  if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
  else if (cu_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 30 && T <= 50) T_factor = 1.2;
  else if (T < 20) T_factor = 0.4;
  else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
  else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mottramite');
  return Math.max(sigma, 0);
},

  supersaturation_clinobisvanite() {
  const g = MINERAL_GATES_clinobisvanite;
  if (this.fluid.Bi < g.fluid_min!.Bi || this.fluid.V < g.fluid_min!.V || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const bi_f = Math.min(this.fluid.Bi / 5.0, 2.0);
  const v_f  = Math.min(this.fluid.V / 5.0, 2.0);
  const o_f  = phosphateRedoxFactor(this.fluid, 1.5, 1.3);
  let sigma = bi_f * v_f * o_f;
  if (this.temperature > 40) sigma *= Math.exp(-0.04 * (this.temperature - 40));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'clinobisvanite');
  return Math.max(sigma, 0);
},

  supersaturation_pyromorphite() {
  const g = MINERAL_GATES_pyromorphite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.P < g.fluid_min!.P || this.fluid.Cl < g.fluid_min!.Cl) return 0;
  const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
  const p_f  = Math.min(this.fluid.P / 5.0, 2.0);
  const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
  let sigma = pb_f * p_f * cl_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pyromorphite');
  return Math.max(sigma, 0);
},

  supersaturation_vanadinite() {
  const g = MINERAL_GATES_vanadinite;
  if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.V < g.fluid_min!.V || this.fluid.Cl < g.fluid_min!.Cl) return 0;
  // v193: the missing vanadate redox gate (see MINERAL_GATES_vanadinite
  // comment). V⁵⁺ mobility requires oxidizing fluid; without this gate
  // vanadinite fired at roughten_gill steps 30-70 at O2 0.20.
  if (!phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
  const v_f  = Math.min(this.fluid.V / 6.0, 2.0);
  const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
  let sigma = pb_f * v_f * cl_f;
  if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'vanadinite');
  return Math.max(sigma, 0);
},

  supersaturation_torbernite() {
  const g = MINERAL_GATES_torbernite;
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.U < g.fluid_min!.U || this.fluid.P < g.fluid_min!.P || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // Anion competition (3-way as of 9c): denominator includes V so
  // V-rich fluid routes to carnotite instead of falling into torbernite.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm. As(III)-only
  // fluids (sulfide-rich) contribute 0 to the anion-fork denominator
  // — meaning sulphur-bank-style fluids no longer spuriously share
  // anion-budget with the uranyl arsenate branch.
  const as_v = arsenateAvailablePpm(this.fluid);
  const anion_total = this.fluid.P + as_v + this.fluid.V;
  if (anion_total <= 0) return 0;
  const p_fraction = this.fluid.P / anion_total;
  if (p_fraction < 0.5) return 0;
  // Cation competition (Round 9d): Cu must dominate over Ca. Pre-9d
  // torbernite would have fired even in Ca-saturated groundwater if
  // Cu>=5; the cation fork sends those fluids to autunite instead.
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const cu_fraction = this.fluid.Cu / cation_total;
  if (cu_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const p_f = Math.min(this.fluid.P / 10.0, 2.0);
  let sigma = u_f * cu_f * p_f;
  if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 40) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'torbernite');
  return Math.max(sigma, 0);
},

  supersaturation_autunite() {
  // Round 9d (May 2026): Ca-cation analog of torbernite. Same parent
  // fluid (U + P + supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
  // Mirror of vugg.py supersaturation_autunite.
  const g = MINERAL_GATES_autunite;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.U < g.fluid_min!.U || this.fluid.P < g.fluid_min!.P || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // Anion competition — same shape as torbernite/zeunerite/carnotite.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const as_v = arsenateAvailablePpm(this.fluid);
  const anion_total = this.fluid.P + as_v + this.fluid.V;
  if (anion_total <= 0) return 0;
  const p_fraction = this.fluid.P / anion_total;
  if (p_fraction < 0.5) return 0;
  // Cation competition — Ca must dominate over Cu (mirror of torbernite)
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const p_f = Math.min(this.fluid.P / 10.0, 2.0);
  let sigma = u_f * ca_f * p_f;
  if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 10 && T <= 35) T_factor = 1.2;
  else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'autunite');
  return Math.max(sigma, 0);
},

  supersaturation_zeunerite() {
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm. Zeunerite
  // is the As-branch of the uranyl P/As/V fork — only As(V) (arsenate
  // anion AsO₄³⁻) is structurally eligible for the uranyl arsenate
  // site, so the fluid's As(III) thioarsenites don't count toward
  // zeunerite formation.
  const g = MINERAL_GATES_zeunerite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.U < g.fluid_min!.U || as_v < g.fluid_min!.As || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // Anion competition (3-way as of 9c) — As(V) ppm in numerator + denominator
  const anion_total = this.fluid.P + as_v + this.fluid.V;
  if (anion_total <= 0) return 0;
  const as_fraction = as_v / anion_total;
  if (as_fraction < 0.5) return 0;
  // Cation competition (Round 9e): Cu must dominate over Ca. Mirror
  // of torbernite's 9d gate. Without this, zeunerite would fire in
  // Ca-saturated groundwater that should route to uranospinite.
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const cu_fraction = this.fluid.Cu / cation_total;
  if (cu_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
  const as_f = Math.min(as_v / 15.0, 2.0);
  let sigma = u_f * cu_f * as_f;
  if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 40) T_factor = 1.2;
  else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'zeunerite');
  return Math.max(sigma, 0);
},

  supersaturation_uranospinite() {
  // Round 9e (May 2026): Ca-cation analog of zeunerite. Mirror of
  // vugg.py supersaturation_uranospinite. Same parent fluid (U + As +
  // supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_uranospinite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.U < g.fluid_min!.U || as_v < g.fluid_min!.As || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  const anion_total = this.fluid.P + as_v + this.fluid.V;
  if (anion_total <= 0) return 0;
  const as_fraction = as_v / anion_total;
  if (as_fraction < 0.5) return 0;
  const cation_total = this.fluid.Cu + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const as_f = Math.min(as_v / 15.0, 2.0);
  let sigma = u_f * ca_f * as_f;
  if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 10 && T <= 35) T_factor = 1.2;
  else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uranospinite');
  return Math.max(sigma, 0);
},

  supersaturation_carnotite() {
  // V-branch / K-cation of the uranyl cation+anion fork (Round 9c + 9e).
  // Mirror of vugg.py supersaturation_carnotite.
  const g = MINERAL_GATES_carnotite;
  if (this.fluid.K < g.fluid_min!.K || this.fluid.U < g.fluid_min!.U || this.fluid.V < g.fluid_min!.V || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // v92 As-state split: only As(V) is fork-eligible (carbonate competition).
  const anion_total = this.fluid.P + arsenateAvailablePpm(this.fluid) + this.fluid.V;
  if (anion_total <= 0) return 0;
  const v_fraction = this.fluid.V / anion_total;
  if (v_fraction < 0.5) return 0;
  // Cation competition (Round 9e): K must dominate over Ca. Without
  // this, carnotite would fire in Ca-saturated groundwater that should
  // route to tyuyamunite.
  const cation_total = this.fluid.K + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const k_fraction = this.fluid.K / cation_total;
  if (k_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const k_f = Math.min(this.fluid.K / 30.0, 2.0);
  const v_f = Math.min(this.fluid.V / 10.0, 2.0);
  let sigma = u_f * k_f * v_f;
  if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 20) T_factor = 0.5 + 0.07 * (T - 10);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'carnotite');
  return Math.max(sigma, 0);
},

  supersaturation_tyuyamunite() {
  // Round 9e (May 2026): Ca-cation analog of carnotite. Mirror of
  // vugg.py supersaturation_tyuyamunite. Orthorhombic instead of
  // monoclinic crystal system but same chemistry stage.
  const g = MINERAL_GATES_tyuyamunite;
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.U < g.fluid_min!.U || this.fluid.V < g.fluid_min!.V || !phosphateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  // v92 As-state split: only As(V) is fork-eligible.
  const anion_total = this.fluid.P + arsenateAvailablePpm(this.fluid) + this.fluid.V;
  if (anion_total <= 0) return 0;
  const v_fraction = this.fluid.V / anion_total;
  if (v_fraction < 0.5) return 0;
  const cation_total = this.fluid.K + this.fluid.Ca;
  if (cation_total <= 0) return 0;
  const ca_fraction = this.fluid.Ca / cation_total;
  if (ca_fraction < 0.5) return 0;
  const u_f = Math.min(this.fluid.U / 2.0, 2.0);
  const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
  const v_f = Math.min(this.fluid.V / 10.0, 2.0);
  let sigma = u_f * ca_f * v_f;
  if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 35) T_factor = 1.2;
  else if (T < 15) T_factor = 0.5 + 0.07 * (T - 5);
  else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tyuyamunite');
  return Math.max(sigma, 0);
},

  // v63 brief-19: apatite supergroup parent (Ca-end-member of pyromorphite/
  // mimetite/vanadinite). Wide T window (50-900°C); pH dissolution below 5.
  supersaturation_apatite() {
    const g = MINERAL_GATES_apatite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.P < g.fluid_min!.P) return 0;
    let sigma = (this.fluid.Ca / 200.0) * (this.fluid.P / 30.0);
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    // Optimum 200-500°C — wide thermally
    let T_factor = 1.0;
    if (T < 200) T_factor = Math.max(0.4, 0.5 + (T - 50) / 300);
    else if (T <= 500) T_factor = 1.2;
    else T_factor = Math.max(0.5, 1.2 - 0.0015 * (T - 500));
    sigma *= T_factor;
    if (this.fluid.pH < 5.0) sigma *= Math.max(0.2, 1.0 - 0.4 * (5.0 - this.fluid.pH));
    // Pb competition — pyromorphite/mimetite drain P at lower T if Pb is high
    if (this.fluid.Pb > 30 && T < 100) sigma *= Math.max(0.5, 1.0 - 0.01 * (this.fluid.Pb - 30));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'apatite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: arid Cu-supergene phosphate. Loses to chrysocolla (Si),
  // malachite (CO3), atacamite (Cl) when those anions dominate.
  supersaturation_turquoise() {
    const g = MINERAL_GATES_turquoise;
    if (this.fluid.Cu < g.fluid_min!.Cu || this.fluid.Al < g.fluid_min!.Al || this.fluid.P < g.fluid_min!.P) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    let sigma = (this.fluid.Cu / 50.0) * (this.fluid.Al / 25.0) * (this.fluid.P / 5.0);
    const T = this.temperature;
    if (T > g.T_max!) return 0;
    let T_factor = 1.0;
    if (T >= 15 && T <= 50) T_factor = 1.2;
    else if (T < 15) T_factor = 0.4 + 0.05 * T;
    else T_factor = Math.max(0.4, 1.2 - 0.025 * (T - 50));
    sigma *= T_factor;
    // pH window 6-8.5
    if (this.fluid.pH < 6.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (6.0 - this.fluid.pH));
    if (this.fluid.pH > 8.5) sigma *= Math.max(0.3, 1.0 - 0.3 * (this.fluid.pH - 8.5));
    // Anion competition penalties
    if (this.fluid.SiO2 > 200) sigma *= Math.max(0.4, 1.0 - 0.002 * (this.fluid.SiO2 - 200));
    if (this.fluid.CO3 > 100) sigma *= Math.max(0.4, 1.0 - 0.005 * (this.fluid.CO3 - 100));
    if (this.fluid.Cl > 100) sigma *= Math.max(0.5, 1.0 - 0.003 * (this.fluid.Cl - 100));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'turquoise');
    return Math.max(sigma, 0);
  },
});
