// tests-js/carbonate-ksp.test.ts — Week 2 SI engine pins.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 2. Locks in:
//
//   - The flag mechanism (default off + per-mineral fine-grain)
//   - SI = log10(IAP/Ksp) signs at known under-, equilibrium, and
//     super-saturated fluids
//   - Retrograde T-dependence for calcite (higher T → higher SI at
//     constant fluid; calcite is LESS soluble at higher T)
//   - Aragonite SI < calcite SI at the same fluid (aragonite is
//     metastable — needs more supersaturation to precipitate)
//   - Dolomite IAP uses CO3 squared (sensitivity check vs simple
//     carbonates)
//   - HMC SI depends on mg_content via Ksp scaling
//   - OH-bearing carbonates respond to pH via OH activity
//   - Engine integration: with all flags off, supersaturation_calcite()
//     gives the same result as the empirical engine (regression pin)
//   - Engine integration: with calcite flag on, the SI-based path
//     returns omega instead of empirical sigma (positive control)
//
// These tests are pure-math + small-scenario. They do NOT regen
// baselines; that's caught by the calibration test elsewhere.

import { afterEach, describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const SCENARIOS: any;
declare const setSeed: any;

declare const carbonateSaturationIndex: (
  mineralId: string, fluid: any, T_C: number, mg_content?: number) => number;
declare const carbonateOmega: (
  mineralId: string, fluid: any, T_C: number, mg_content?: number) => number;
declare const carbonateEngineSigma: (
  mineralId: string, fluid: any, T_C: number, mg_content?: number) => number;
declare const carbonatesWithSI: () => string[];
declare const carbonatePromotionReady: (mineralId: string) => boolean;
declare const kspSupersatActiveFor: (mineralId: string) => boolean;
declare const CARBONATE_KSP_ACTIVE: boolean;
declare const CARBONATE_KSP_ACTIVE_PER_MINERAL: Record<string, boolean>;

declare const setCarbonateKspActive: (active: boolean) => void;
declare const setCarbonateKspActiveFor: (mineralId: string, active: boolean) => void;
declare const snapshotCarbonateKspFlags: () => { global: boolean; perMineral: Record<string, boolean> };
declare const restoreCarbonateKspFlags: (snap: { global: boolean; perMineral: Record<string, boolean> }) => void;

declare const getCarbonateLogKsp: (mineralId: string, T_C: number, mg_content?: number) => number;
declare const bjerrumFractions: (pH: number, T_C: number) => { H2CO3: number; HCO3: number; CO3: number };
declare const carbonateIonPpm: (fluid: any, T_C: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — flag mechanism', () => {
  it('CARBONATE_KSP_ACTIVE is true since v144 (Week 9 calcite promotion)', () => {
    // v143: flag was false (engine infrastructure observer-only).
    // v144: flag flipped true alongside per-mineral.calcite flip when
    // the calcite SI engine + PWP rate law became the production path.
    // The per-mineral map is the gate now; the global flag just gates
    // the dispatcher's entire branch.
    expect(CARBONATE_KSP_ACTIVE).toBe(true);
  });

  it('per-mineral flags: calcite true (v144); aragonite/dolomite/siderite/HMC still false', () => {
    // Calcite is the first carbonate promoted (Week 9 / v144). Aragonite
    // is Week 12, dolomite Week 10, HMC Week 11 — all still pending.
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.calcite).toBe(true);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.aragonite).toBe(false);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.dolomite).toBe(false);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.siderite).toBe(false);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.HMC).toBe(false);
  });

  it('kspSupersatActiveFor returns true only for calcite (v144 state)', () => {
    expect(kspSupersatActiveFor('calcite')).toBe(true);
    for (const m of carbonatesWithSI()) {
      if (m === 'calcite') continue;
      expect(kspSupersatActiveFor(m)).toBe(false);
    }
  });

  it('rosasite + aurichalcite intentionally absent from per-mineral flag table', () => {
    // Both are tier-D thermo data; SI returns NaN. No flag entry =
    // documents the "no thermo data" gap clearly.
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.rosasite).toBeUndefined();
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.aurichalcite).toBeUndefined();
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — SI math signs', () => {
  it('SI < 0 for undersaturated dilute calcite fluid (rainwater-like)', () => {
    // Rainwater-equilibrated DIC ~5 ppm at pH 5.6 (atmospheric pCO2),
    // Ca ~1 ppm. Very dilute → strongly undersaturated for calcite.
    const f = new FluidChemistry({ Ca: 1, CO3: 5, pH: 5.6 });
    const SI = carbonateSaturationIndex('calcite', f, 25);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeLessThan(-2);
  });

  it('SI > 0 for supersaturated calcite fluid (sabkha-like)', () => {
    // Evaporative brine: Ca 800 ppm, DIC 500 ppm, pH 8.5. Should be
    // strongly supersaturated for calcite at surface T.
    const f = new FluidChemistry({ Ca: 800, CO3: 500, pH: 8.5 });
    const SI = carbonateSaturationIndex('calcite', f, 25);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeGreaterThan(1);
  });

  it('SI ≈ 0 at calcite equilibrium fluid (back-calculated from Ksp)', () => {
    // Back-calc: at pH=8.3, T=25, find Ca + DIC giving SI ≈ 0.
    // Working through the activity math (see proposal Week-2 notes):
    //   Ksp_calcite(25) = 10^-8.48 ≈ 3.31e-9
    //   at I~0.005, γ(±2) ≈ 0.74; γ(CO3²⁻) ≈ 0.74
    //   a(Ca²⁺) needed × a(CO3²⁻) needed = Ksp
    //   with Ca = 40 ppm, m_Ca = 9.98e-4, a(Ca²⁺) ≈ 7.4e-4
    //   → a(CO3²⁻) needed ≈ 4.47e-6
    //   at pH 8.3 the CO3²⁻ fraction of DIC is ~0.0093
    //   → DIC needed ≈ 40 ppm
    const f = new FluidChemistry({ Ca: 40, CO3: 40, pH: 8.3 });
    const SI = carbonateSaturationIndex('calcite', f, 25);
    expect(Number.isFinite(SI)).toBe(true);
    // ±0.5 log unit — the activity model is Davies (not Pitzer) and
    // Kw uses 25°C value, so don't pin too tight.
    expect(Math.abs(SI)).toBeLessThan(0.5);
  });

  it('returns NaN for missing cation (siderite needs Fe)', () => {
    const f = new FluidChemistry({ Ca: 50, CO3: 100, Fe: 0 });
    const SI = carbonateSaturationIndex('siderite', f, 25);
    expect(Number.isNaN(SI)).toBe(true);
  });

  it('returns NaN for missing CO3 / DIC', () => {
    const f = new FluidChemistry({ Ca: 50, CO3: 0 });
    const SI = carbonateSaturationIndex('calcite', f, 25);
    expect(Number.isNaN(SI)).toBe(true);
  });

  it('returns NaN for rosasite (no thermo data)', () => {
    const f = new FluidChemistry({ Cu: 20, Zn: 15, CO3: 80, pH: 7 });
    const SI = carbonateSaturationIndex('rosasite', f, 25);
    expect(Number.isNaN(SI)).toBe(true);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — temperature dependence', () => {
  it('calcite is LESS soluble at higher T → SI rises with T at constant fluid', () => {
    // Retrograde solubility — the geological signature of calcite.
    // Plummer-Busenberg 1982: ΔH_diss = -10.5 kJ/mol (exothermic) →
    // higher T pushes equilibrium toward solids → omega increases.
    const f = new FluidChemistry({ Ca: 100, CO3: 100, pH: 7.5 });
    const SI_cold = carbonateSaturationIndex('calcite', f, 10);
    const SI_warm = carbonateSaturationIndex('calcite', f, 60);
    expect(Number.isFinite(SI_cold)).toBe(true);
    expect(Number.isFinite(SI_warm)).toBe(true);
    // 50 K rise should give a noticeable SI bump (not tiny, not absurd).
    expect(SI_warm).toBeGreaterThan(SI_cold);
    expect(SI_warm - SI_cold).toBeGreaterThan(0.1);
    expect(SI_warm - SI_cold).toBeLessThan(1.5);
  });

  it('Ksp(calcite, 25) matches the published value (-8.48)', () => {
    const logKsp = getCarbonateLogKsp('calcite', 25);
    expect(logKsp).toBeCloseTo(-8.48, 2);
  });

  it('Ksp(dolomite, 25) matches the published value (-17.09)', () => {
    const logKsp = getCarbonateLogKsp('dolomite', 25);
    expect(logKsp).toBeCloseTo(-17.09, 2);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — polymorph + stoichiometry', () => {
  it('aragonite is less stable than calcite → aragonite SI < calcite SI', () => {
    // Aragonite logKsp_25 = -8.336 vs calcite -8.48. Aragonite is more
    // soluble → higher Ksp → LOWER SI for the same fluid (need a stronger
    // supersaturation to precipitate aragonite at equilibrium).
    const f = new FluidChemistry({ Ca: 200, CO3: 200, pH: 8.0 });
    const SI_cal = carbonateSaturationIndex('calcite', f, 25);
    const SI_arg = carbonateSaturationIndex('aragonite', f, 25);
    expect(Number.isFinite(SI_cal)).toBe(true);
    expect(Number.isFinite(SI_arg)).toBe(true);
    expect(SI_arg).toBeLessThan(SI_cal);
    // Spread is logKsp_arg - logKsp_cal = -8.336 - (-8.48) = +0.144
    // (so SI_arg - SI_cal should be ~-0.144, ± Davies noise).
    expect(Math.abs((SI_arg - SI_cal) + 0.144)).toBeLessThan(0.15);
  });

  it('dolomite IAP uses CO3 squared — doubles its sensitivity to DIC', () => {
    // Comparing the dolomite SI between two DIC values at same Ca, Mg:
    // doubling DIC should bump SI by ~2 × log10(2) = 0.602 (because
    // CO3 appears squared in IAP). For simple AB(CO3) carbonates it's
    // 1 × log10(2) = 0.301. The "doubling" of DIC actually means
    // doubling the CO3²⁻ activity at constant pH; via Bjerrum the
    // CO3 fraction stays the same so DIC scales linearly.
    const f1 = new FluidChemistry({ Ca: 200, Mg: 600, CO3: 100, pH: 7.8 });
    const f2 = new FluidChemistry({ Ca: 200, Mg: 600, CO3: 200, pH: 7.8 });
    const SI1 = carbonateSaturationIndex('dolomite', f1, 25);
    const SI2 = carbonateSaturationIndex('dolomite', f2, 25);
    const dSI = SI2 - SI1;
    expect(Number.isFinite(SI1)).toBe(true);
    expect(Number.isFinite(SI2)).toBe(true);
    // ~0.6 log unit (2 × log10(2)) ± slight Davies shift from ionic
    // strength change.
    expect(dSI).toBeGreaterThan(0.5);
    expect(dSI).toBeLessThan(0.7);
  });

  it('calcite SI scales 1× log10(2) when DIC doubles (sanity vs dolomite)', () => {
    const f1 = new FluidChemistry({ Ca: 200, CO3: 100, pH: 7.8 });
    const f2 = new FluidChemistry({ Ca: 200, CO3: 200, pH: 7.8 });
    const SI1 = carbonateSaturationIndex('calcite', f1, 25);
    const SI2 = carbonateSaturationIndex('calcite', f2, 25);
    const dSI = SI2 - SI1;
    expect(dSI).toBeGreaterThan(0.20);
    expect(dSI).toBeLessThan(0.40);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — HMC mg_content', () => {
  it('HMC SI varies with mg_content (Ksp scales with x)', () => {
    // logKsp(x) = -8.48 + 0.10 × x × 100  (per data/thermo-carbonates.json
    // mg_content_linear fit).
    //   x=0.00: logKsp = -8.48 (= calcite)
    //   x=0.10: logKsp = -7.48 (10× more soluble than pure calcite)
    //   x=0.20: logKsp = -6.48
    // Higher x → MORE soluble → LOWER SI at the same fluid.
    const f = new FluidChemistry({ Ca: 400, Mg: 400, CO3: 200, pH: 8.0 });
    const SI_pure = carbonateSaturationIndex('HMC', f, 25, 0.0);
    const SI_low = carbonateSaturationIndex('HMC', f, 25, 0.10);
    const SI_high = carbonateSaturationIndex('HMC', f, 25, 0.20);
    expect(Number.isFinite(SI_pure)).toBe(true);
    expect(Number.isFinite(SI_low)).toBe(true);
    expect(Number.isFinite(SI_high)).toBe(true);
    expect(SI_pure).toBeGreaterThan(SI_low);
    expect(SI_low).toBeGreaterThan(SI_high);
    // 0 → 10 mol-% Mg = 1 log-unit drop in SI per the linear fit.
    expect(Math.abs((SI_pure - SI_low) - 1.0)).toBeLessThan(0.3);
  });

  it('HMC SI at x=0 matches calcite SI (HMC is pure calcite when mg_content = 0)', () => {
    const f = new FluidChemistry({ Ca: 400, CO3: 200, pH: 8.0 });
    const SI_cal = carbonateSaturationIndex('calcite', f, 25);
    const SI_HMC0 = carbonateSaturationIndex('HMC', f, 25, 0.0);
    expect(Number.isFinite(SI_cal)).toBe(true);
    expect(Number.isFinite(SI_HMC0)).toBe(true);
    expect(Math.abs(SI_cal - SI_HMC0)).toBeLessThan(0.01);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — OH-bearing carbonates respond to pH', () => {
  it('malachite SI rises with pH (OH^- activity ∝ 10^(pH-14))', () => {
    // Malachite IAP includes a(OH⁻)². Each pH unit increase = 10× OH⁻
    // = 100× IAP contribution = +2 log units in SI from the OH term
    // alone. Bjerrum CO3 also rises → expect a steep dependence.
    const f5 = new FluidChemistry({ Cu: 30, CO3: 100, pH: 5.5, O2: 2 });
    const f8 = new FluidChemistry({ Cu: 30, CO3: 100, pH: 8.0, O2: 2 });
    const SI_acid = carbonateSaturationIndex('malachite', f5, 25);
    const SI_alk = carbonateSaturationIndex('malachite', f8, 25);
    expect(Number.isFinite(SI_acid)).toBe(true);
    expect(Number.isFinite(SI_alk)).toBe(true);
    expect(SI_alk).toBeGreaterThan(SI_acid);
    // Spread is dominated by OH² (+5 from pH) + CO3 from Bjerrum
    // amplification → expect 5+ log units of jump. Reality includes
    // activity-coefficient changes from ionic strength shifts; tolerate
    // 3-10 range.
    expect(SI_alk - SI_acid).toBeGreaterThan(3);
    expect(SI_alk - SI_acid).toBeLessThan(12);
  });

  it('hydrozincite SI rises sharply with pH (OH^6 stoichiometry)', () => {
    // 6 OH means +6 per pH unit from the OH term — should be the
    // sharpest pH dependence of any carbonate in the catalog.
    const f7 = new FluidChemistry({ Zn: 30, CO3: 100, pH: 7.0, O2: 2 });
    const f9 = new FluidChemistry({ Zn: 30, CO3: 100, pH: 9.0, O2: 2 });
    const SI_neut = carbonateSaturationIndex('hydrozincite', f7, 25);
    const SI_alk = carbonateSaturationIndex('hydrozincite', f9, 25);
    expect(Number.isFinite(SI_neut)).toBe(true);
    expect(Number.isFinite(SI_alk)).toBe(true);
    expect(SI_alk - SI_neut).toBeGreaterThan(6);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2/9 — engine integration', () => {
  it('with flag off (transient), supersaturation_calcite returns empirical sigma (regression)', () => {
    // The dispatcher hook is a one-line early-return that's a no-op
    // when CARBONATE_KSP_ACTIVE is false. Confirms no value drift
    // from adding the hook. After v144 we must temporarily flip the
    // flag off to exercise the fallback path.
    const snap = snapshotCarbonateKspFlags();
    try {
      setCarbonateKspActive(false);
      const f = new FluidChemistry({ Ca: 200, CO3: 150, pH: 7.5 });
      const cond = new VugConditions({ temperature: 25, fluid: f });
      const sigma = cond.supersaturation_calcite();
      expect(Number.isFinite(sigma)).toBe(true);
      expect(sigma).toBeGreaterThan(0);  // supersaturated for empirical engine too
    } finally {
      restoreCarbonateKspFlags(snap);
    }
  });

  it('all 14 carbonate supersat methods still return finite numbers (smoke)', () => {
    // Catches the "added dispatcher but broke the body" class of bug.
    const f = new FluidChemistry({
      Ca: 200, Mg: 200, Fe: 20, Mn: 20, Zn: 20, Cu: 20, Pb: 20,
      Ba: 30, Sr: 30, CO3: 150, pH: 7.5, O2: 1.5,
    });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    // Smoke-only: just confirm each method returns a number (not NaN
    // or throw). Doesn't assert specific values — that's the
    // baseline test's job.
    const methods = [
      'supersaturation_calcite',
      'supersaturation_aragonite',
      'supersaturation_dolomite',
      'supersaturation_siderite',
      'supersaturation_rhodochrosite',
      'supersaturation_smithsonite',
      'supersaturation_cerussite',
      'supersaturation_witherite',
      'supersaturation_strontianite',
      'supersaturation_malachite',
      'supersaturation_azurite',
      'supersaturation_rosasite',
      'supersaturation_aurichalcite',
      'supersaturation_hydrozincite',
    ];
    for (const m of methods) {
      const v = cond[m]();
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — promotion readiness audit', () => {
  it('calcite is promotion-ready (A thermo + A kinetic per thermo-carbonates.json)', () => {
    expect(carbonatePromotionReady('calcite')).toBe(true);
  });

  it('aragonite is promotion-ready (A thermo + B kinetic)', () => {
    expect(carbonatePromotionReady('aragonite')).toBe(true);
  });

  it('dolomite is promotion-ready (A thermo + B kinetic — Kim 2023)', () => {
    expect(carbonatePromotionReady('dolomite')).toBe(true);
  });

  it('siderite is NOT promotion-ready (A thermo but C kinetic — Greenberg-Tomson 1992)', () => {
    // Per data/thermo-carbonates.json siderite kinetic tier is C.
    // Promotion would lose the redox-confounded rate law's known
    // limitations; tighten kinetics first.
    expect(carbonatePromotionReady('siderite')).toBe(false);
  });

  it('rosasite + aurichalcite are NOT promotion-ready (tier D thermo, no SI fn)', () => {
    expect(carbonatePromotionReady('rosasite')).toBe(false);
    expect(carbonatePromotionReady('aurichalcite')).toBe(false);
  });

  it('carbonatesWithSI lists exactly the 13 implemented SI engines', () => {
    const ids = carbonatesWithSI();
    expect(ids.length).toBe(13);
    expect(ids).toContain('calcite');
    expect(ids).toContain('HMC');
    expect(ids).toContain('hydrozincite');
    expect(ids).not.toContain('rosasite');
    expect(ids).not.toContain('aurichalcite');
  });
});

// =============================================================
// Positive-control tests — flip a flag, verify the dispatcher path
// actually routes to the SI engine, then restore.
//
// Without these, the Week 9 promotion would be the first time the
// dispatcher actually runs. Catching a typo or wrong-arg-list there
// means the bug surfaces inside a calibration-shift commit, mixed
// in with legitimate seed-42 drift — hard to diagnose. Catching it
// here keeps the dispatcher contract honest from Week 2 onward.
// =============================================================

describe('PROPOSAL-CARBONATE-GEOCHEM Week 2 — dispatcher positive control', () => {
  // afterEach restore so every test starts with the canonical
  // flag state (global off, all per-mineral off) regardless of
  // what prior tests did.
  let _flagSnap: any = null;

  afterEach(() => {
    if (_flagSnap) {
      restoreCarbonateKspFlags(_flagSnap);
      _flagSnap = null;
    }
  });

  it('flag setter actually flips the global flag', () => {
    _flagSnap = snapshotCarbonateKspFlags();
    // v144: calcite starts ON. Verify we can flip it OFF, then back ON.
    expect(kspSupersatActiveFor('calcite')).toBe(true);
    setCarbonateKspActiveFor('calcite', false);
    expect(kspSupersatActiveFor('calcite')).toBe(false);
    setCarbonateKspActive(false);
    setCarbonateKspActiveFor('calcite', true);
    expect(kspSupersatActiveFor('calcite')).toBe(false);  // AND-gate
    setCarbonateKspActive(true);
    expect(kspSupersatActiveFor('calcite')).toBe(true);
  });

  it('with calcite flag on, supersaturation_calcite() returns carbonateEngineSigma value', () => {
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(true);
    setCarbonateKspActiveFor('calcite', true);
    const f = new FluidChemistry({ Ca: 200, CO3: 150, pH: 8.0 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const engineSigma = cond.supersaturation_calcite();
    const expected = carbonateEngineSigma('calcite', f, 25);
    expect(Number.isFinite(engineSigma)).toBe(true);
    expect(Number.isFinite(expected)).toBe(true);
    expect(engineSigma).toBeCloseTo(expected, 6);
    // And it should differ from the empirical path (otherwise the
    // dispatcher might be silently falling through):
    setCarbonateKspActiveFor('calcite', false);
    const empirical = cond.supersaturation_calcite();
    expect(Math.abs(engineSigma - empirical)).toBeGreaterThan(0.01);
  });

  it('hard gate still fires when calcite flag is on (T > T_max → 0)', () => {
    // The bug we're guarding against: dispatcher placed BEFORE the
    // thermal-decomposition gate would let calcite "precipitate" at
    // 600°C just because Ksp(T) is still finite there.
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(true);
    setCarbonateKspActiveFor('calcite', true);
    const f = new FluidChemistry({ Ca: 500, CO3: 500, pH: 8.0 });
    const cond = new VugConditions({ temperature: 600, fluid: f });
    const sigma = cond.supersaturation_calcite();
    expect(sigma).toBe(0);
  });

  it('hard redox gate still fires when siderite flag is on (oxidizing → 0)', () => {
    // Siderite needs anoxic per Fe²⁺ stability. The SI engine doesn't
    // know about redox (Phase 4 split not landed), so without the
    // redox gate firing first, an oxidizing fluid would still produce
    // omega > 0 from the SI calculation. Geologically wrong.
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(true);
    setCarbonateKspActiveFor('siderite', true);
    const f = new FluidChemistry({ Fe: 100, CO3: 200, pH: 7, O2: 5 }); // oxidizing
    const cond = new VugConditions({ temperature: 60, fluid: f });
    const sigma = cond.supersaturation_siderite();
    expect(sigma).toBe(0);
  });

  it('hard mg_ratio gate still fires when dolomite flag is on (Mg/Ca too low → 0)', () => {
    // Dolomite needs mg_ratio in [0.3, 30]. Engine gate skips dolomite
    // entirely outside that band. SI engine without the gate would
    // happily compute omega for any Ca + Mg + CO3 combination.
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(true);
    setCarbonateKspActiveFor('dolomite', true);
    const f = new FluidChemistry({ Ca: 1000, Mg: 50, CO3: 200, pH: 7.5 }); // mg_ratio = 0.05
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const sigma = cond.supersaturation_dolomite();
    expect(sigma).toBe(0);
  });

  it('per-mineral flag isolates — flipping calcite does NOT affect dolomite', () => {
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(true);
    setCarbonateKspActiveFor('calcite', true);
    // dolomite per-mineral is still false → dolomite uses empirical
    const f = new FluidChemistry({ Ca: 200, Mg: 200, CO3: 150, pH: 7.5 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const dol_si_off = cond.supersaturation_dolomite();
    // Now flip dolomite specifically
    setCarbonateKspActiveFor('dolomite', true);
    const dol_si_on = cond.supersaturation_dolomite();
    // These should differ — flipping the per-mineral flag changes path
    expect(Math.abs(dol_si_off - dol_si_on)).toBeGreaterThan(0.01);
  });

  it('global flag OFF + per-mineral ON still uses empirical (AND-gate semantics)', () => {
    _flagSnap = snapshotCarbonateKspFlags();
    setCarbonateKspActive(false);  // global OFF
    setCarbonateKspActiveFor('calcite', true);  // per-mineral ON
    expect(kspSupersatActiveFor('calcite')).toBe(false);  // AND-gate
    const f = new FluidChemistry({ Ca: 200, CO3: 150, pH: 8.0 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    setCarbonateKspActive(true);
    const sigma_both_on = cond.supersaturation_calcite();
    setCarbonateKspActive(false);
    const sigma_global_off = cond.supersaturation_calcite();
    expect(Math.abs(sigma_both_on - sigma_global_off)).toBeGreaterThan(0.01);
  });

  it('snapshot + restore round-trips correctly', () => {
    const original = snapshotCarbonateKspFlags();
    // Mutate from the v144 default state (global ON, calcite ON,
    // siderite OFF) to something different, then restore and confirm
    // every recorded entry came back.
    setCarbonateKspActive(false);
    setCarbonateKspActiveFor('calcite', false);
    setCarbonateKspActiveFor('siderite', true);
    restoreCarbonateKspFlags(original);
    expect(CARBONATE_KSP_ACTIVE).toBe(true);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.calcite).toBe(true);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.siderite).toBe(false);
  });
});
