// ============================================================
// js/30-supersat-arsenate.ts — supersaturation methods for arsenate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/arsenate.py. Minerals (6): adamite, annabergite, erythrite, mimetite, olivenite, scorodite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Arsenate MINERAL_GATES exports ----
// All arsenates use arsenateAvailablePpm helper for As(V) state-aware
// composition; sigma_crit 1.0 for most; substrate discount applies in nucleation.

const MINERAL_GATES_olivenite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 10, T_max: 60, T_optimal: 30,
  fluid_min: { Cu: 50, As: 10, Zn: 0.5 },
  O2_min: 0.5,
  pH_min: 4, pH_max: 8,
  surface_energy: 'medium',
  _sources: ['olivenite engine v92+'],
  _notes: 'Cu2(AsO4)(OH) — Cu-dominant supergene arsenate. Cu/(Cu+Zn) ≥ 0.5 broth gate. Zincolivenite sweet spot Cu-fraction 0.55-0.85.',
};

const MINERAL_GATES_scorodite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Fe: 5, As: 3 },
  O2_min: 0.3,
  pH_max: 6,
  surface_energy: 'medium',
  _sources: ['scorodite engine v92+'],
  _notes: 'FeAsO4·2H2O — canonical supergene weathering of arsenopyrite. Substrate-pref dissolving arsenopyrite/pyrite.',
};

const MINERAL_GATES_erythrite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 20,
  fluid_min: { Co: 2, As: 5 },
  O2_min: 0.3,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['erythrite engine v92+'],
  _notes: 'Co3(AsO4)2·8H2O cobalt bloom. Vivianite-group fragility (8 H2O).',
};

const MINERAL_GATES_annabergite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 20,
  fluid_min: { Ni: 2, As: 5 },
  O2_min: 0.3,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['annabergite engine v92+'],
  _notes: 'Ni3(AsO4)2·8H2O nickel bloom — Ni equivalent of erythrite.',
};

const MINERAL_GATES_adamite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 30,
  fluid_min: { Zn: 10, As: 5, Cu: 0.5 },
  O2_min: 0.3,
  pH_min: 4.0, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['adamite engine v92+'],
  _notes: 'Zn2(AsO4)(OH) — Zn-dominant. Cu trace for fluorescence. Zn-fraction sweet spot 0.55-0.85.',
};

const MINERAL_GATES_pharmacolite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 25,
  fluid_min: { Ca: 15, As: 5 },
  O2_min: 0.3,
  pH_min: 5.5, pH_max: 7.5,
  surface_energy: 'low',
  _sources: ['pharmacolite engine v92+', 'research-pharmacolite.md'],
  _notes: 'CaHAsO4·2H2O — Ca-only hydrated arsenate, five-element-vein supergene bloom (Jáchymov/Schneeberg/Cobalt-Ontario).',
};

const MINERAL_GATES_conichalcite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 100, T_optimal: 27,
  fluid_min: { Ca: 15, Cu: 10, As: 5 },
  O2_min: 0.3,
  pH_min: 5.0, pH_max: 7.5,
  surface_energy: 'medium',
  _sources: ['conichalcite engine v92+', 'research-conichalcite.md'],
  _notes: 'CaCu(AsO4)(OH) — Ca-cation analog of olivenite. Ca/(Ca+Cu) > 0.4 routes here.',
};

const MINERAL_GATES_mimetite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 80,
  fluid_min: { Pb: 5, As: 3, Cl: 2 },
  O2_min: 0.3,
  pH_min: 3.5,
  surface_energy: 'medium',
  _sources: ['mimetite engine v92+'],
  _notes: 'Pb5(AsO4)3Cl — apatite-group Pb arsenate. Needs Cl. Substrate-pref galena.',
};

const MINERAL_GATES_austinite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 30,
  fluid_min: { Ca: 30, Zn: 20, As: 5 },
  O2_min: 0.5,
  pH_min: 6.0, pH_max: 8.5,
  surface_energy: 'medium',
  _sources: ['austinite engine v97+', 'Gebhard 1999 Tsumeb monograph'],
  _notes: 'CaZn(AsO4)(OH) — Ca-Zn adelite-descloizite analog of conichalcite. Pb > 50 routes to duftite/bayldonite.',
};

const MINERAL_GATES_legrandite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 25,
  fluid_min: { Zn: 100, As: 10 },
  O2_min: 0.5,
  pH_min: 4.5, pH_max: 7.0,
  surface_energy: 'medium',
  _sources: ['legrandite engine v97+'],
  _notes: 'Zn2(AsO4)(OH)·H2O — canary-yellow Tsumeb iconic. Ca > 20 + Cu > 50 + Pb > 20 all suppress.',
};

const MINERAL_GATES_koettigite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 35, T_optimal: 20,
  fluid_min: { Zn: 50, As: 10 },
  O2_min: 0.5,
  pH_min: 6.0, pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['koettigite engine v97+'],
  _notes: 'Zn3(AsO4)2·8H2O — vivianite-group Zn end (8 H2O fragile, hard T cap). Co > 10 or Ni > 10 suppress.',
};

const MINERAL_GATES_duftite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 30,
  fluid_min: { Pb: 50, Cu: 20, As: 5 },
  O2_min: 0.5,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['duftite engine v97+'],
  _notes: 'PbCu(AsO4)(OH) — olive-green Pb:Cu ~1:1. V > As routes to mottramite. Cu/Pb > 2 routes to bayldonite.',
};

const MINERAL_GATES_bayldonite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 30,
  fluid_min: { Pb: 30, Cu: 100, As: 10 },
  O2_min: 0.5,
  pH_min: 5.0, pH_max: 7.5,
  surface_energy: 'medium',
  _sources: ['bayldonite engine v97+'],
  _notes: 'PbCu3(AsO4)2(OH)2 — apple-green Cu-enriched Pb-Cu arsenate. Cu/Pb > 2 required.',
};

Object.assign(VugConditions.prototype, {
  supersaturation_olivenite() {
  // v92 As-state split: consume As(V) ppm (arsenateAvailablePpm) rather
  // than raw fluid.As. The Sulphur-Bank-style sulfide-rich fluid keeps
  // As as As(III) thioarsenites; supergene oxidation puts it as As(V).
  // Pre-v92 the legacy `arsenateRedoxAvailable(fluid, 0.5)` gate was a
  // bulk-O2 proxy that could pass on Sulphur Bank's brief O2 spikes; the
  // new helper reads the full state (S + O2) and gives back the actually-
  // accessible As(V) concentration.
  const g = MINERAL_GATES_olivenite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Cu < g.fluid_min!.Cu || as_v < g.fluid_min!.As) return 0;
  if (!arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  // Recessive-side trace floor — real olivenite always has at least
  // trace Zn (zincolivenite-leaning); makes the ratio meaningful.
  if (this.fluid.Zn < g.fluid_min!.Zn) return 0;
  // Broth-ratio gate — olivenite is Cu-dominant.
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const cu_fraction = this.fluid.Cu / cu_zn_total;
  if (cu_fraction < 0.5) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const as_f = Math.min(as_v / 20.0, 2.5);
  const ox_f = arsenateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = cu_f * as_f * ox_f;
  // Sweet-spot bonus — Cu-dominant with Zn trace is zincolivenite-
  // leaning, the most-collected form. Pure-Cu damped (malachite/
  // brochantite take that territory).
  if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
  else if (cu_fraction > 0.95) sigma *= 0.5;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'olivenite');
  return Math.max(sigma, 0);
},

  supersaturation_scorodite() {
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm. Scorodite
  // is the canonical FeAsO₄·2H₂O supergene weathering product of
  // arsenopyrite — only forms when As has been oxidized to As(V).
  const g = MINERAL_GATES_scorodite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Fe < g.fluid_min!.Fe || as_v < g.fluid_min!.As || !arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH > g.pH_max!) return 0;  // dissolves above pH 5; nucleation gate at 6 for hysteresis
  let sigma = (this.fluid.Fe / 30.0) * (as_v / 15.0) * arsenateRedoxFactor(this.fluid, 1.0);
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.025 * (this.temperature - 80));
  }
  if (this.fluid.pH > 5) {
    sigma *= Math.max(0.3, 1.0 - 0.5 * (this.fluid.pH - 5));
  } else if (this.fluid.pH < 2) {
    sigma *= Math.max(0.4, 1.0 - 0.3 * (2 - this.fluid.pH));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'scorodite');
  return Math.max(sigma, 0);
},

  supersaturation_erythrite() {
  // Co3(AsO4)2·8H2O — cobalt bloom. Shared vivianite-group gating with annabergite.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_erythrite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Co < g.fluid_min!.Co || as_v < g.fluid_min!.As || !arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  const product = (this.fluid.Co / 20.0) * (as_v / 30.0) * arsenateRedoxFactor(this.fluid, 1.0);
  const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
  return product * T_factor;
},

  supersaturation_annabergite() {
  // Ni3(AsO4)2·8H2O — nickel bloom. Ni equivalent of erythrite.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_annabergite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Ni < g.fluid_min!.Ni || as_v < g.fluid_min!.As || !arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  const product = (this.fluid.Ni / 20.0) * (as_v / 30.0) * arsenateRedoxFactor(this.fluid, 1.0);
  const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
  return product * T_factor;
},

  supersaturation_adamite() {
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_adamite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Zn < g.fluid_min!.Zn || as_v < g.fluid_min!.As || !arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  // Trace Cu floor — Cu²⁺ activator gives the diagnostic green
  // fluorescence; recessive-side floor makes the Cu:Zn ratio meaningful.
  if (this.fluid.Cu < g.fluid_min!.Cu) return 0;
  // Broth-ratio gate — adamite is Zn-dominant.
  const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
  const zn_fraction = this.fluid.Zn / cu_zn_total;
  if (zn_fraction < 0.5) return 0;
  let sigma = (this.fluid.Zn / 80.0) * (as_v / 30.0) * arsenateRedoxFactor(this.fluid, 1.0);
  // Sweet-spot bonus — Zn-dominant with Cu trace (the fluorescent
  // variety) is the most aesthetic adamite. Pure-Zn damped because
  // hemimorphite/smithsonite take that territory.
  if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
  else if (zn_fraction > 0.95) sigma *= 0.5;
  if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.4;
  else if (this.fluid.pH > 8.0) sigma *= 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'adamite');
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor('erythrite') + ('annabergite'). Those are
  // distinct Co + Ni arsenates with their own stoichiometry; multiplying
  // them into adamite's σ stacked three ≤1 factors and silently dampened
  // the σ by ~½×. Regression introduced by the Phase 2b activity-coefficient
  // sweep (eff8ec1, 2026-05-05). Equivalent fixes landed on borax, galena,
  // and stibnite the same day.
  return Math.max(sigma, 0);
},

  supersaturation_pharmacolite() {
  // CaHAsO₄·2H₂O — monoclinic hydrated calcium hydrogen arsenate, the
  // Ca-only (no Cu) supergene arsenate. Distinctive radiating/stellate
  // acicular aggregates ("starbursts of white needles"). The classic
  // Jáchymov/Schneeberg/Cobalt-Ontario silver-cobalt-arsenic-district
  // weathering bloom; forms when arsenic-rich primary phases (cobaltite,
  // nickeline, native_arsenic, arsenopyrite) oxidize in carbonate-
  // buffered groundwater that supplies Ca. Per research-pharmacolite.md
  // (boss canonical 2026-05).
  //
  // Cation anti-gates (research §Inhibiting elements): high Cu routes
  // to conichalcite, high Pb to mimetite, high Zn to adamite, high Co
  // to erythrite, high Ni to annabergite. The pharmacolite engine
  // SUPPRESSES (not blocks) when those competing cations exceed
  // pharmacolite's own — fluid splits its arsenate budget across
  // competitor species; pharmacolite gets the residual when Ca
  // dominates the cation pool overall.
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  //
  // v92 cleanup: REMOVED the v88 inline sulfide-suppression band-aid
  // (was `if (fluid.S > 50) return 0`). That gate was a proxy for
  // "As is chemically bound in As(III) sulfide complexes" — the
  // simulator's single fluid.As pool couldn't distinguish As(III)
  // from As(V) so a hard sulfide-block was needed to prevent
  // Sulphur Bank from spuriously firing pharmacolite during O2-spike
  // events. v92 makes the band-aid obsolete: arsenateAvailablePpm
  // already returns 0 when fluid.S > 50 AND O2 < 1.0, encoding the
  // thioarsenite-stability geochemistry directly. The principled
  // helper replaces the band-aid.
  const g = MINERAL_GATES_pharmacolite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Ca < g.fluid_min!.Ca || as_v < g.fluid_min!.As) return 0;
  if (!arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  // Cation-share gate: Ca must dominate the cation pool. The
  // denominator includes the major competing cations from the
  // arsenate-fork minerals. Pharmacolite gets the share of the
  // arsenate budget proportional to its cation share.
  const competing = this.fluid.Cu + this.fluid.Pb + this.fluid.Zn
                  + this.fluid.Co + this.fluid.Ni;
  const total_cations = this.fluid.Ca + competing;
  const ca_fraction = this.fluid.Ca / total_cations;
  if (ca_fraction < 0.3) return 0;  // strongly competed-out
  // Note: the cation-share check above is a binary gate (block when
  // Ca-share < 0.3). We do NOT multiply sigma by ca_fraction in
  // addition — that double-dampened the engine in early calibration
  // (typical schneeberg-late chemistry gave sigma ~ 0.24, below the
  // 1.0 nucleation threshold). Now sigma scales on the absolute Ca/As
  // concentrations with a sweet-spot bonus when Ca strongly dominates.
  const ca_f = Math.min(this.fluid.Ca / 50, 2.5);
  const as_f = Math.min(as_v / 15, 2.5);
  const ox_f = arsenateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = ca_f * as_f * ox_f;
  if (ca_fraction >= 0.6) sigma *= 1.3;  // strong Ca-dominance bonus
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 35) T_factor = 1.2;
  else if (T < 15) T_factor = Math.max(0.3, 0.4 + 0.05 * (T - 5));
  else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 35));
  else T_factor = 0.2;
  sigma *= T_factor;
  // Cu-suppression (research: "high copper favors olivenite/conichalcite").
  // Soft scaling rather than hard block — pharmacolite tolerates trace Cu
  // but loses ground rapidly as Cu approaches Ca.
  if (this.fluid.Cu > 5) sigma *= Math.max(0.3, 1.0 - (this.fluid.Cu - 5) / 100);
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pharmacolite');
  return Math.max(sigma, 0);
},

  supersaturation_conichalcite() {
  // CaCu(AsO₄)(OH) — orthorhombic Ca-Cu arsenate. Vivid emerald to
  // apple green (Cu²⁺ chromophore). Per research-conichalcite.md (boss
  // canonical 2026-05): supergene Cu-As oxidation zone, Ca-cation
  // analog of olivenite (Cu only). The two coexist but are
  // differentiated by Ca/(Ca+Cu) ratio — conichalcite when Ca dominates
  // ("contains calcium, which makes it harder Mohs 4.5 vs 3 for
  // olivenite, and typically brighter in color").
  //
  // Cation-fork mechanic (mirrors autunite-vs-torbernite, Round 9d):
  // Ca/(Ca+Cu) > 0.4 → conichalcite path; Cu-dominant → olivenite.
  // The threshold is at 0.4 rather than 0.5 because conichalcite is
  // structurally permissive — even a Cu-dominant fluid can produce
  // conichalcite if enough Ca is around to occupy the cation site;
  // supergene Cu-As fluids in carbonate-buffered systems (Tsumeb,
  // Bisbee at depth) usually carry both.
  //
  // pH window 5.0-7.5 (research: "mildly acidic to neutral").
  // T window 10-100°C, optimum 15-40°C.
  // Eh > 0.2 V — As must be As⁵⁺ (oxidizing supergene fluid).
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_conichalcite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Cu < g.fluid_min!.Cu || as_v < g.fluid_min!.As) return 0;
  if (!arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
  if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
  const ca_cu_total = this.fluid.Ca + this.fluid.Cu;
  const ca_fraction = this.fluid.Ca / ca_cu_total;
  if (ca_fraction < 0.4) return 0;  // Cu-dominant routes to olivenite
  const ca_f = Math.min(this.fluid.Ca / 150, 2.0);
  const cu_f = Math.min(this.fluid.Cu / 30, 2.0);
  const as_f = Math.min(as_v / 15, 2.5);
  const ox_f = arsenateRedoxFactor(this.fluid, 1.0, 2.0);
  let sigma = ca_f * cu_f * as_f * ox_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 15 && T <= 40) T_factor = 1.2;
  else if (T < 15) T_factor = Math.max(0.3, 0.4 + 0.05 * (T - 5));
  else if (T <= 60) T_factor = Math.max(0.5, 1.2 - 0.025 * (T - 40));
  else T_factor = 0.3;
  sigma *= T_factor;
  // Sweet-spot bonus — Ca-dominant with Cu trace is the Ca-Cu sweet
  // spot (Tsumeb / Bisbee deep gossan). Pure-Ca (Cu < trace) is
  // structurally impossible (Cu is in the formula).
  if (ca_fraction >= 0.55 && ca_fraction <= 0.90) sigma *= 1.2;
  // Pb suppression — research-conichalcite.md: "high Pb favors
  // mimetite/pyromorphite" via Pb²⁺ competing with Ca²⁺ for the
  // arsenate anion.
  if (this.fluid.Pb > 50) sigma *= Math.max(0.4, 1.0 - (this.fluid.Pb - 50) / 200);
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'conichalcite');
  return Math.max(sigma, 0);
},

  supersaturation_mimetite() {
  // v92 As-state split: As(V) ppm via arsenateAvailablePpm.
  const g = MINERAL_GATES_mimetite;
  const as_v = arsenateAvailablePpm(this.fluid);
  if (this.fluid.Pb < g.fluid_min!.Pb || as_v < g.fluid_min!.As || this.fluid.Cl < g.fluid_min!.Cl || !arsenateRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  let sigma = (this.fluid.Pb / 60.0) * (as_v / 25.0) * (this.fluid.Cl / 30.0) * arsenateRedoxFactor(this.fluid, 1.0);
  if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
  if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.5;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mimetite');
  return Math.max(sigma, 0);
},

// v97 (2026-05-19): Tsumeb arsenate suite — austinite + legrandite +
// koettigite + duftite + bayldonite. The 2nd-oxidation-zone signature
// arsenates from Tsumeb (Gebhard 1999). All five supergene at <50°C,
// oxidizing (O2 > 0.5, Eh strongly positive), with As(V) via
// arsenateAvailablePpm.
//
// Cation-ratio fork gates (Magalhães et al. 1988 stability +
// Gebhard 1999 paragenesis):
//   austinite      Ca:Zn ~1:1, Cu < Zn (pH 6.5-8.0)
//   legrandite     Zn-rich, Ca < 20 ppm, mildly acidic (pH 4.5-6.5)
//   koettigite     Zn >> (Co+Ni), very damp, T < 35 (pH 6-8)
//   duftite        Pb:Cu near 1:1 (pH 5.5-7.5)
//   bayldonite     Pb:Cu near 1:3 / Cu-enriched (pH 5-7)
//
// Refs: Gebhard 1999 "Tsumeb"; Keller 1977 MinRec 8(3); Wilson &
// Keller 2001 MinRec 32(3); Magalhães et al. 1988; Anthony et al.
// Handbook of Mineralogy.

  supersaturation_austinite() {
    // CaZn(AsO4)(OH) — Ca-Zn adelite-descloizite analog of conichalcite.
    const g = MINERAL_GATES_austinite;
    const as_v = arsenateAvailablePpm(this.fluid);
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Zn < g.fluid_min!.Zn || as_v < g.fluid_min!.As) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    const cu_frac = this.fluid.Cu / Math.max(this.fluid.Cu + this.fluid.Zn, 0.001);
    if (cu_frac > 0.5) return 0;  // Cu-dominant → conichalcite wins
    if (this.fluid.Pb > 50) return 0;  // duftite/bayldonite take precedence
    const ca_f = Math.min(this.fluid.Ca / 80.0, 2.0);
    const zn_f = Math.min(this.fluid.Zn / 60.0, 2.0);
    const as_f = Math.min(as_v / 15.0, 2.0);
    let sigma = ca_f * zn_f * as_f;
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 8.0) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.25) * 0.5);
    if (cu_frac < 0.3) sigma *= 1.2;  // pure Zn-end sweet spot
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'austinite');
    return Math.max(sigma, 0);
  },

  supersaturation_legrandite() {
    // Zn2(AsO4)(OH)·H2O — bright canary yellow, Tsumeb iconic.
    const g = MINERAL_GATES_legrandite;
    const as_v = arsenateAvailablePpm(this.fluid);
    if (this.fluid.Zn < g.fluid_min!.Zn || as_v < g.fluid_min!.As) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    if (this.fluid.Ca > 20) return 0;  // austinite competes
    if (this.fluid.Cu > 50) return 0;  // olivenite/conichalcite compete
    if (this.fluid.Pb > 20) return 0;  // Pb arsenates compete
    const zn_f = Math.min(this.fluid.Zn / 150.0, 2.5);
    const as_f = Math.min(as_v / 25.0, 2.0);
    let sigma = zn_f * as_f;
    const pH = this.fluid.pH;
    if (pH >= 5.0 && pH <= 6.0) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 5.5) * 0.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'legrandite');
    return Math.max(sigma, 0);
  },

  supersaturation_koettigite() {
    // Zn3(AsO4)2·8H2O — vivianite group, Zn end-member. 8H2O fragile.
    const g = MINERAL_GATES_koettigite;
    const as_v = arsenateAvailablePpm(this.fluid);
    if (this.fluid.Zn < g.fluid_min!.Zn || as_v < g.fluid_min!.As) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    if (this.fluid.Co > 10) return 0;  // erythrite wins
    if (this.fluid.Ni > 10) return 0;  // annabergite wins
    const zn_f = Math.min(this.fluid.Zn / 80.0, 2.0);
    const as_f = Math.min(as_v / 20.0, 1.8);
    let sigma = zn_f * as_f;
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 7.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.0) * 0.5);
    if (this.temperature > 25) sigma *= Math.max(0.3, 1.0 - (this.temperature - 25) * 0.07);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'koettigite');
    return Math.max(sigma, 0);
  },

  supersaturation_duftite() {
    // PbCu(AsO4)(OH) — olive-green, Pb:Cu near 1:1.
    const g = MINERAL_GATES_duftite;
    const as_v = arsenateAvailablePpm(this.fluid);
    if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Cu < g.fluid_min!.Cu || as_v < g.fluid_min!.As) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    if (this.fluid.V > as_v) return 0;  // V > As → mottramite wins
    const cu_pb_ratio = this.fluid.Cu / Math.max(this.fluid.Pb, 0.001);
    if (cu_pb_ratio > 2.0) return 0;  // Cu-rich → bayldonite wins
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.0);
    const cu_f = Math.min(this.fluid.Cu / 50.0, 1.8);
    const as_f = Math.min(as_v / 15.0, 2.0);
    let sigma = pb_f * cu_f * as_f;
    const pH = this.fluid.pH;
    if (pH >= 6.0 && pH <= 7.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 6.75) * 0.5);
    if (cu_pb_ratio >= 0.7 && cu_pb_ratio <= 1.5) sigma *= 1.2;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'duftite');
    return Math.max(sigma, 0);
  },

  supersaturation_bayldonite() {
    // PbCu3(AsO4)2(OH)2 — apple-green, Pb:Cu near 1:3 (Cu-enriched).
    const g = MINERAL_GATES_bayldonite;
    const as_v = arsenateAvailablePpm(this.fluid);
    if (this.fluid.Pb < g.fluid_min!.Pb || this.fluid.Cu < g.fluid_min!.Cu || as_v < g.fluid_min!.As) return 0;
    if (this.fluid.O2 < g.O2_min!) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    if (this.fluid.V > as_v) return 0;  // V > As → mottramite wins
    const cu_pb_ratio = this.fluid.Cu / Math.max(this.fluid.Pb, 0.001);
    if (cu_pb_ratio < 2.0) return 0;  // Pb-rich → duftite wins
    const pb_f = Math.min(this.fluid.Pb / 60.0, 1.8);
    const cu_f = Math.min(this.fluid.Cu / 120.0, 2.2);
    const as_f = Math.min(as_v / 20.0, 2.0);
    let sigma = pb_f * cu_f * as_f;
    const pH = this.fluid.pH;
    if (pH >= 5.5 && pH <= 7.0) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 6.25) * 0.5);
    if (cu_pb_ratio >= 2.5 && cu_pb_ratio <= 4.0) sigma *= 1.2;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'bayldonite');
    return Math.max(sigma, 0);
  },
});
