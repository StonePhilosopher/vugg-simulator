// tests-js/fortress-saves.test.ts — save system (93a-ui-saves.ts, 2026-07-08)
//
// The claim under test is the save system's whole premise: a save is a
// RECIPE (seed + action log + broth deltas), and replaying it through
// the real fortressStep path reproduces the run EXACTLY — same steps,
// same crystals, same zone counts, same fluid state. If any hidden
// input isn't captured (a Date.now() seed, a slider the recording
// missed, an rng consumer outside the replayed order), the fingerprint
// comparison here goes red.
//
// jsdom notes:
//  - setup.ts's DOM stub returns throwaway proxies for missing ids, so
//    broth sliders "don't exist" unless a test creates real elements.
//    fortressStep's finite-parse guard (added with this feature) skips
//    them identically on both sides of the save boundary. One REAL
//    slider (#broth-fe) is installed below to exercise the capture →
//    delta → replay path end to end.
//  - setFortressInstantLines(true) keeps the narrative-tempo player
//    synchronous — sim state is what's asserted, not pacing theater.
//  - Bundle-internal `let` bindings (fortressSim, fortressActive) are
//    read via the _live* accessors — the globalThis copies setup.ts
//    exports are load-time snapshots that go stale (the _liveRng
//    precedent).

import { beforeEach, describe, expect, it } from 'vitest';

declare function fortressBeginFromScenario(name: string, seed?: number): void;
declare function fortressBeginFromStarterFluid(presetId: string, seed?: number): void;
declare function fortressStep(action: string, payload?: any): void;
declare function fortressFinish(): void;
declare function fortressReset(): void;
declare function setFortressInstantLines(v: boolean): void;
declare function _liveFortressSim(): any;
declare function _liveFortressActive(): boolean;
declare function loadSaves(): any[];
declare function loadCrystals(): any[];
declare function loadLifetimeStats(): { crystals_collected: number; runs_finished: number };
declare function _saveManualNamed(name: string): any;
declare function loadSaveById(id: string): boolean;
declare function collectAllCrystals(crystals: any[], metaFn: any, opts?: any): { count: number; newSpecies: string[] };
declare function _libraryProgressHTML(opts?: any): string;
declare function setBrothValue(key: string, sliderVal: string): void;
declare function updateCarbonateBoundaryReadout(): void;
declare function simulationStateFingerprint(sim: any): string;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: Record<string, any>;
declare const CavityWaterAppearance: any;

// Real broth sliders so the recording has something genuine to capture.
// Held by module-scoped references — setup.ts's DOM stub wraps
// document.querySelector so a "does it exist" query always returns a
// truthy stub, which would silently skip creation (elements must be
// REAL and appended for the bundle's realGetById fallback to find them).
//
// broth-temp matters specifically: its toSlider rounds (Math.round(T)),
// so after every action the slider holds a quantized ECHO of fractional
// sim temperature. The first live eye-check caught replay force-feeding
// that echo back into the sim (T 178.785 → 179); with this slider real,
// the fingerprint comparison below guards that class forever.
const _sliders: Record<string, HTMLInputElement> = {};
function ensureSlider(key: string, min: string, max: string, value: string): HTMLInputElement {
  let el = _sliders[key];
  if (!el || !el.isConnected) {
    el = document.createElement('input');
    el.id = 'broth-' + key;
    el.setAttribute('min', min);
    el.setAttribute('max', max);
    document.body.appendChild(el);
    _sliders[key] = el;
  }
  el.value = value;
  return el;
}
function ensureFeSlider(): HTMLInputElement {
  ensureSlider('temp', '25', '600', '300');
  return ensureSlider('fe', '0', '500', '0');
}

function ensureCarbonBoundaryControls(): void {
  ensureSlider('carbon_headspace', '0', '2000', '100');
  ensureSlider('pco2', '-600', '-30', String(Math.log10(0.22) * 100));
  ensureSlider('open_atmosphere', '0', '1', '0');
  ensureSlider('carbon_alkalinity', '-500', '5000', '200');
  ensureSlider('co3', '0', '5000', '500');
  ensureSlider('ph', '0', '140', '70');
}

let _carbonReadout: HTMLDivElement | null = null;
function ensureCarbonReadout(): HTMLDivElement {
  if (!_carbonReadout || !_carbonReadout.isConnected) {
    _carbonReadout = document.createElement('div');
    _carbonReadout.id = 'carbonate-boundary-readout';
    document.body.appendChild(_carbonReadout);
  }
  return _carbonReadout;
}

function carbonateFingerprint(sim: any) {
  const state = sim._carbonateBoundaryState;
  return {
    mode: state.mode,
    headspaceLKg: +state.headspaceLKg.toFixed(9),
    targetPCO2Bar: +state.targetPCO2Bar.toFixed(12),
    dicMolKg: +state.lastDICMolKg.toFixed(12),
    headspaceCO2MolKg: +state.headspaceCO2MolKg.toFixed(12),
    reducedAlkalinityEqKg: +state.reducedAlkalinityEqKg.toFixed(12),
    imported: +state.boundaryImportMolKg.toFixed(12),
    exported: +state.boundaryExportMolKg.toFixed(12),
    transactions: state.transactions.map((tx: any) => [tx.kind, !!tx.ok, tx.note]),
  };
}

function ensureAllChemistrySliders(): Record<string, number> {
  const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
  const expected: Record<string, number> = {};
  for (const [field, control] of Object.entries(registry) as Array<[string, any]>) {
    const increments = Math.max(1, Math.floor((control.max - control.min) * 0.61 / control.step));
    const canonical = Math.min(control.max, control.min + increments * control.step);
    ensureSlider(
      control.liveKey,
      String(control.min * control.scale),
      String(control.max * control.scale),
      String(canonical * control.scale),
    ).step = String(control.step * control.scale);
    expected[field] = canonical;
  }
  return expected;
}

function fingerprint(sim: any) {
  return {
    step: sim.step,
    temperature: +sim.conditions.temperature.toFixed(6),
    pH: +sim.conditions.fluid.pH.toFixed(6),
    Fe: +sim.conditions.fluid.Fe.toFixed(6),
    Ca: +sim.conditions.fluid.Ca.toFixed(6),
    pressure: +sim.conditions.pressure.toFixed(6),
    crystals: (sim.crystals || []).map((c: any) => [
      c.mineral,
      +(c.c_length_mm || 0).toFixed(6),
      +(c.total_growth_um || 0).toFixed(4),
      (c.zones || []).length,
      !!c.twinned,
    ]),
  };
}

// Grown = collectable by the collectAllCrystals gate.
function grownCount(sim: any): number {
  return (sim.crystals || []).filter(
    (c: any) => (c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0,
  ).length;
}

beforeEach(() => {
  localStorage.clear();
  setFortressInstantLines(true);
  fortressReset();
  ensureFeSlider();
});

describe('fortress save system (93a) — event-sourced replay', () => {
  it('round-trips a run exactly: seed + actions + broth deltas → identical fingerprint', () => {
    fortressBeginFromScenario('cooling', 424242);
    expect(loadSaves().length).toBe(1); // autosave opened at begin
    expect(loadSaves()[0].kind).toBe('auto');

    // A varied run: time, temperature verbs, a real broth input event,
    // pH tweaks, and a seismic tap (rng-consuming twinning roll).
    fortressStep('wait');
    fortressStep('wait');
    fortressStep('heat');
    fortressStep('wait_10');
    ensureFeSlider().value = '120';
    setBrothValue('fe', '120');
    fortressStep('wait');
    fortressStep('tweak_acidify');
    fortressStep('wait');
    fortressStep('tap');
    fortressStep('wait');

    const simA = _liveFortressSim();
    const before = fingerprint(simA);
    expect(before.step).toBeGreaterThan(0);
    expect(before.Fe).toBeGreaterThan(0); // the slider injection reached the sim

    const manual = _saveManualNamed('round-trip probe');
    expect(manual).toBeTruthy();
    expect(manual.kind).toBe('manual');
    expect(manual.model_digest).toBe(MODEL_DIGEST);
    expect(manual.scenario_spec_hash).toBe(SCENARIOS.cooling._scenario_spec_hash);
    // The broth delta for Fe must be IN the action log (not just final state).
    const hasFeDelta = manual.actions.some((a: any) => a.b && a.b.fe === '120');
    expect(hasFeDelta).toBe(true);

    fortressReset();
    ensureFeSlider().value = '0'; // dirty the slider — replay must restore it
    expect(_liveFortressSim()).toBeNull();

    expect(loadSaveById(manual.id)).toBe(true);
    const after = fingerprint(_liveFortressSim());
    expect(after).toEqual(before);
  });

  it('fails closed before replay when the saved scientific model digest is tampered', () => {
    fortressBeginFromScenario('cooling', 424243);
    fortressStep('wait');
    const manual = _saveManualNamed('tampered model identity');
    const records = loadSaves();
    const stored = records.find((r: any) => r.id === manual.id);
    stored.model_digest = 'tampered-model-digest';
    localStorage.setItem('vugg-saves-v1', JSON.stringify(records));

    fortressReset();
    expect(loadSaveById(manual.id)).toBe(false);
    expect(_liveFortressSim()).toBeNull();
  });

  it('fails closed before replay when an authored scenario specification hash is tampered', () => {
    fortressBeginFromScenario('cooling', 424244);
    fortressStep('wait');
    const manual = _saveManualNamed('tampered scenario identity');
    const records = loadSaves();
    const stored = records.find((r: any) => r.id === manual.id);
    stored.scenario_spec_hash = 'tampered-scenario-hash';
    localStorage.setItem('vugg-saves-v1', JSON.stringify(records));

    fortressReset();
    expect(loadSaveById(manual.id)).toBe(false);
    expect(_liveFortressSim()).toBeNull();
  });

  it('starter-fluid runs round-trip too (wall shape_seed derives from the run seed)', () => {
    fortressBeginFromStarterFluid('carbonate', 777001);
    for (let i = 0; i < 6; i++) fortressStep('wait');
    fortressStep('cool');
    for (let i = 0; i < 4; i++) fortressStep('wait');

    const before = fingerprint(_liveFortressSim());
    const manual = _saveManualNamed('starter probe');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(fingerprint(_liveFortressSim())).toEqual(before);
  });

  it('restores a live control edit saved before any later geological action', () => {
    fortressBeginFromScenario('cooling', 777002);
    ensureFeSlider().value = '120';
    (globalThis as any).setBrothValue('fe', '120');
    const manual = _saveManualNamed('pending control probe');
    expect(manual.pending_broth).toEqual({ fe: '120' });

    fortressReset();
    ensureFeSlider().value = '0';
    expect(loadSaveById(manual.id)).toBe(true);
    expect(_liveFortressSim().conditions.fluid.Fe).toBe(120);
  });

  it('round-trips a pending Creative diameter as the same production authority', () => {
    ensureSlider('diameter', '5', '5000', '50');
    ensureSlider('water', '0', '1000', '1000');
    fortressBeginFromScenario('cooling', 42);
    const sim = _liveFortressSim();
    setBrothValue('water', '450');
    setBrothValue('diameter', '125');
    const before = simulationStateFingerprint(sim);
    const beforeContract = sim.wall_state._cavityProductionAuthorityContract.contract_digest;
    const beforeWaterFraction = sim.conditions.fluid_surface_height_mm
      / CavityWaterAppearance.verticalSpanForWall(sim.wall_state);
    const manual = _saveManualNamed('production diameter replay probe');
    expect(manual.pending_broth).toEqual({ water: '450', diameter: '125' });

    fortressReset();
    ensureSlider('diameter', '5', '5000', '50').value = '50';
    expect(loadSaveById(manual.id)).toBe(true);
    const replay = _liveFortressSim();
    expect(simulationStateFingerprint(replay)).toBe(before);
    expect(replay.wall_state._cavityProductionAuthorityContract.contract_digest)
      .toBe(beforeContract);
    expect(replay.conditions.wall.cavity_capacity_basis)
      .toBe('cartesian-field-freudenthal-volume-v2');
    expect(replay.conditions.fluid_surface_height_mm
      / CavityWaterAppearance.verticalSpanForWall(replay.wall_state))
      .toBeCloseTo(beforeWaterFraction, 10);
  }, 60_000);

  it('round-trips every Creative chemistry lever through live UI → save → replay', () => {
    const expected = ensureAllChemistrySliders();
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    fortressBeginFromScenario('cooling', 777003);
    for (const [field, control] of Object.entries(registry) as Array<[string, any]>) {
      const canonical = expected[field];
      (globalThis as any).setBrothValue(control.liveKey, String(canonical * control.scale));
      if (field !== 'CO3' && field !== 'pH') {
        expect(_liveFortressSim().conditions.fluid[field], `${field}.live write`).toBe(canonical);
      }
    }
    // In a conserved Creative run, the DIC control is a 100% authored
    // replacement-water recharge and pH is solved from reduced alkalinity.
    // Persist the resulting state rather than pretending both are independent
    // sliders with exact post-equilibration values.
    expected.CO3 = _liveFortressSim().conditions.fluid.CO3;
    expected.pH = _liveFortressSim().conditions.fluid.pH;
    // In explicit mode S is a derived observer, not a fourth spendable pool.
    // The later S(-II)/S(VI) writes intentionally replace the earlier bulk-S
    // value, so both the saved live state and replay must expose their sum.
    expected.S = expected.S_sulfide + expected.S_sulfate;
    expect(_liveFortressSim().conditions.fluid.S, 'derived dissolved S before save').toBe(expected.S);
    const manual = _saveManualNamed('all chemistry replay probe');
    expect(Object.keys(manual.pending_broth)).toHaveLength(Object.keys(registry).length - 1);
    expect(manual.pending_broth).not.toHaveProperty('ph');
    expect(manual.pending_broth).toHaveProperty('co3');

    fortressReset();
    for (const control of Object.values(registry) as any[]) {
      ensureSlider(control.liveKey, '0', String(control.max * control.scale), '0').value = '0';
    }
    expect(loadSaveById(manual.id)).toBe(true);
    for (const [field, canonical] of Object.entries(expected)) {
      expect(_liveFortressSim().conditions.fluid[field], `${field}.replay`).toBe(canonical);
    }
  });

  it('round-trips conserved-carbon controls and the transaction ledger through save/replay', () => {
    ensureCarbonBoundaryControls();
    fortressBeginFromScenario('tutorial_travertine', 42);
    expect(_liveFortressSim()._carbonateBoundaryState).toBeTruthy();

    setBrothValue('carbon_headspace', '250'); // 2.50 L/kg
    setBrothValue('pco2', '-200'); // 10^-2 bar
    setBrothValue('open_atmosphere', '1');
    fortressStep('wait');

    const before = carbonateFingerprint(_liveFortressSim());
    const manual = _saveManualNamed('carbonate boundary replay probe');
    expect(manual.actions.some((a: any) =>
      a.b?.carbon_headspace === '250'
      && a.b?.pco2 === '-200'
      && a.b?.open_atmosphere === '1')).toBe(true);

    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(carbonateFingerprint(_liveFortressSim())).toEqual(before);
  });

  it('surfaces conserved inventories and exposes no solver-off fallback', () => {
    ensureCarbonBoundaryControls();
    const readout = ensureCarbonReadout();
    fortressBeginFromScenario('tutorial_travertine', 42);
    updateCarbonateBoundaryReadout();
    expect(readout.textContent).toContain('CLOSED carbon boundary');
    expect(readout.textContent).toContain('DIC');
    expect(readout.textContent).toContain('headspace CO₂');
    expect(readout.textContent).toContain('reduced alkalinity');
    expect(readout.textContent).toContain('Uncertainty:');

    expect((globalThis as any).BROTH_MAP.carbon_boundary).toBeUndefined();
    expect(_liveFortressSim()._carbonateBoundaryState).toBeTruthy();
    expect(readout.textContent).not.toContain('legacy fixed-DIC');
  });

  it('routes live DIC through recharge, derives pH, and exposes blocked failures', () => {
    ensureCarbonBoundaryControls();
    const readout = ensureCarbonReadout();
    fortressBeginFromScenario('tutorial_travertine', 42);
    for (let i = 0; i < 8; i++) fortressStep('wait');
    const sim = _liveFortressSim();

    setBrothValue('co3', '5000');
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      ok: true, kind: 'recharge', replacementFraction: 1,
    });
    expect(sim._carbonateBoundaryState.boundaryImportMolKg).toBeGreaterThan(0);
    expect(sim._carbonateBoundaryState.boundaryExportMolKg).toBeGreaterThan(0);

    const derivedPH = sim.conditions.fluid.pH;
    const txCount = sim._carbonateBoundaryState.transactions.length;
    setBrothValue('ph', '80');
    expect(sim.conditions.fluid.pH).toBe(derivedPH);
    expect(sim._carbonateBoundaryState.transactions).toHaveLength(txCount);

    setBrothValue('carbon_alkalinity', '300');
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      ok: true, kind: 'alkalinity_titration', requestedReducedAlkalinityEqKg: 0.003,
    });

    sim.conditions.fluid.CO3 = 6500;
    fortressStep('wait');
    updateCarbonateBoundaryReadout();
    expect(sim._carbonateBoundaryState.blocked).toBe(true);
    expect(readout.textContent).toContain('BLOCKED');
    expect(readout.textContent).toContain('unreceipted_DIC_change');
    expect(readout.textContent).not.toContain('Within the v1 dilute-water envelope');
  });

  it('routes every Creative acid/base alias through spatially synchronized titration', () => {
    ensureCarbonBoundaryControls();
    for (const action of ['tweak_acidify', 'shift_acidify', 'acidify', 'tweak_alkalinize', 'shift_alkalinize', 'alkalinize']) {
      fortressReset();
      fortressBeginFromScenario('tutorial_travertine', 42);
      const sim = _liveFortressSim();
      fortressStep(action);
      expect(sim._carbonateBoundaryState.transactions.at(-1), action).toMatchObject({
        ok: true, kind: 'ph_titration',
      });
      fortressStep('wait');
      expect(sim._carbonateBoundaryState.blocked, action).toBe(false);
      expect(sim._carbonateBoundaryState.transactions.some((tx: any) =>
        tx.error === 'unreceipted_DIC_change')).toBe(false);
    }
  });

  it('the rolling autosave updates in place on every action', () => {
    fortressBeginFromScenario('cooling', 11);
    const id0 = loadSaves()[0].id;
    fortressStep('wait');
    fortressStep('wait');
    let saves = loadSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].id).toBe(id0);
    expect(saves[0].actions.length).toBe(2);
    fortressStep('heat');
    saves = loadSaves();
    expect(saves[0].actions.length).toBe(3);
    expect(saves[0].status).toBe('in-progress');
  });

  it('Narrate, Collect & Save: finish collects every crystal, seals the save, bumps lifetime counters — once', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const sim = _liveFortressSim();
    const grown = grownCount(sim);
    expect(grown).toBeGreaterThan(0); // cooling grows quartz early

    fortressFinish();

    // Collected: every grown crystal is marked + in the Library.
    for (const c of sim.crystals) {
      if ((c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0) {
        expect(c._collectedRecordId).toBeTruthy();
      }
    }
    expect(loadCrystals().length).toBe(grown);

    // Saved: the autosave sealed as finished.
    const saves = loadSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].status).toBe('finished');
    expect(saves[0].collected.length).toBe(grown);

    // Scored: the lifetime counters moved.
    const stats = loadLifetimeStats();
    expect(stats.crystals_collected).toBe(grown);
    expect(stats.runs_finished).toBe(1);

    // Idempotence: a second click must not double anything.
    fortressFinish();
    expect(loadCrystals().length).toBe(grown);
    expect(loadLifetimeStats().runs_finished).toBe(1);
  });

  it('a finished save restores as a finished run (re-narrated, nothing re-collected or re-counted)', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    fortressFinish();
    const sealed = loadSaves()[0];
    const libBefore = loadCrystals().length;
    const statsBefore = loadLifetimeStats();

    expect(loadSaveById(sealed.id)).toBe(true);

    expect(_liveFortressActive()).toBe(false); // run is over — actions stay sealed
    expect(loadCrystals().length).toBe(libBefore); // no duplicate specimens
    expect(loadLifetimeStats()).toEqual(statsBefore); // no double count
    // The replayed crystals remember their Library records.
    const marked = _liveFortressSim().crystals.filter((c: any) => c._collectedRecordId).length;
    expect(marked).toBe(sealed.collected.length);
  });

  it('lifetime crystals_collected never decrements — deleting a specimen does not un-find it', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(res.count).toBeGreaterThan(0);
    expect(loadLifetimeStats().crystals_collected).toBe(res.count);

    // jsdom's confirm() is a no-op stub, so delete the way the Library
    // ultimately does (filter + persist) — the stat must hold.
    const rec = loadCrystals()[0];
    localStorage.setItem('vugg-crystals-v1', JSON.stringify(loadCrystals().filter(c => c.id !== rec.id)));
    expect(loadCrystals().length).toBe(res.count - 1);
    expect(loadLifetimeStats().crystals_collected).toBe(res.count);
  });

  it('collectAllCrystals returns {count,newSpecies}; a second silent batch is a clean zero', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(typeof res.count).toBe('number');
    expect(Array.isArray(res.newSpecies)).toBe(true);
    expect(res.newSpecies.length).toBeGreaterThan(0); // first collect of these species
    const again = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(again).toEqual({ count: 0, newSpecies: [] });
  });

  it('the collection banner carries the lifetime total; home-screen variant is numeric from zero (boss ask 2026-07-08)', () => {
    const strip = (html: string) => html.replace(/<[^>]+>/g, '');

    // Fresh profile, home-screen variant: real zeros, not teaching prose.
    const zero = strip(_libraryProgressHTML({ numericWhenEmpty: true }));
    expect(zero).toMatch(/0 \/ \d+ species \(0%\)/);
    expect(zero).toMatch(/0 \/ \d+ twinned variants \(0%\)/);
    expect(zero).toContain('0 crystals all-time');
    expect(zero).not.toContain('Empty');

    // Library default keeps the teaching prose when nothing was ever found.
    expect(strip(_libraryProgressHTML())).toContain('Empty — grow a vugg');

    // Collect a run → the total lands in both variants.
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    const after = strip(_libraryProgressHTML());
    expect(after).toContain(`${res.count} crystal${res.count === 1 ? '' : 's'} all-time`);

    // Wipe the shelf: prose returns, but the life list survives — the
    // specimens are gone, the finding of them isn't.
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([]));
    const wiped = strip(_libraryProgressHTML());
    expect(wiped).toContain('Empty — grow a vugg');
    expect(wiped).toContain(`${res.count} crystal${res.count === 1 ? '' : 's'} all-time`);
  });
});
