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

import { beforeEach, describe, expect, it, vi } from 'vitest';

declare function fortressBeginFromScenario(name: string, seed?: number): void;
declare function fortressBeginFromStarterFluid(presetId: string, seed?: number): void;
declare function _fortressBeginCustomFromParams(params: any, seed?: number): void;
declare function fortressStep(action: string, payload?: any): void;
declare function fortressFinish(): void;
declare function fortressReset(): void;
declare function showTitleScreen(): void;
declare function openNewGameMenu(): void;
declare function setFortressInstantLines(v: boolean): void;
declare function _liveFortressSim(): any;
declare function _liveFortressActive(): boolean;
declare function _fortressInitialFluidRecipeFor(sim: any): any;
declare function loadSaves(): any[];
declare function persistSaves(items: any[]): boolean;
declare function _saveRecipeDigest(rec: any): string;
declare function _saveCollectionReceiptDigest(receipt: any): string;
declare function _saveApplyCreativeCollectionReceipts(rec: any, opts?: any): { ok: boolean; count: number; newSpecies: string[] };
declare function _saveEnvelopeDigest(envelope: any): string;
declare function _saveFinishTransactionDigest(tx: any): string;
declare function _saveFinishRecordIdCandidate(runId: string, crystalIdx: number, attempt?: number): string;
declare function _savePruneAutosaves(items: any[]): any[];
declare function _saveReplayCompatibility(rec: any): { ok: boolean; reason: string };
declare function _liveSaveStorageNotice(): string | null;
declare function _liveSaveActiveRecord(): any;
declare function _savePersistActive(): boolean;
declare function _saveBuildLocalExport(): any;
declare function _saveLocalExportDigest(payload: any): string;
declare function _saveAssertLocalExport(payload: any): boolean;
declare function _saveApplyLocalExport(payload: any, opts?: any): boolean;
declare function _saveRecoverLocalImportJournal(): boolean;
declare function _saveBuildFinishTransaction(): any;
declare function _saveMarkFinished(): { name: string; saved: boolean } | null;
declare function deleteSaveById(id: string): boolean | void;
declare function loadCrystals(): any[];
declare function renameCollectedCrystal(id: string): void;
declare function deleteCollectedCrystal(id: string): void;
declare function loadLifetimeStats(): { crystals_collected: number; runs_finished: number };
declare function _saveManualNamed(name: string): any;
declare function loadSaveById(id: string): boolean;
declare function collectAllCrystals(crystals: any[], metaFn: any, opts?: any): { count: number; newSpecies: string[] };
declare function collectFromFortress(crystalIdx: number, ev?: any): void;
declare function _libraryProgressHTML(opts?: any): string;
declare function setBrothValue(key: string, sliderVal: string): void;
declare function updateCarbonateBoundaryReadout(): void;
declare function simulationStateFingerprint(sim: any): string;
declare function buildCrystalRecord(crystal: any, meta: any): any;
declare const MODEL_DIGEST: string;
declare const SIM_VERSION: number;
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

function installRealTestElement(id: string): HTMLDivElement {
  document.querySelectorAll(`#${id}`).forEach(el => el.remove());
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
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

// Collection/WAL tests need a collectable scientific object, not a hidden
// dependency on one locality's changing nucleation latency. The authored
// first-crystal tutorial is the deliberately fast fixture: its seed-42 quartz
// nucleates and grows on the first geological step. That keeps these tests
// about save/Library transactions while the separate Herkimer suites own the
// cooling trajectory.
function beginFastCollectableRun(): any {
  fortressBeginFromScenario('tutorial_first_crystal', 42);
  fortressStep('wait');
  const sim = _liveFortressSim();
  expect(grownCount(sim)).toBeGreaterThan(0);
  return sim;
}

function minimalSave(id: string, overrides: Record<string, any> = {}): any {
  const rec: any = {
    id,
    run_id: id,
    format: 3,
    collection_epoch: 'event-cursor-v1',
    sim_version: SIM_VERSION,
    model_digest: MODEL_DIGEST,
    scenario_spec_hash: SCENARIOS.cooling._scenario_spec_hash,
    kind: 'manual',
    status: 'in-progress',
    name: id,
    created_at: '2026-08-14T12:00:00.000Z',
    updated_at: '2026-08-14T12:00:00.000Z',
    origin: { type: 'scenario', scenario: 'cooling', seed: 42 },
    actions: [],
    broth_final: null,
    pending_broth: null,
    collected: [],
    collection_receipts: [],
    summary: null,
    replay_state_digest: null,
    replay_integrity: 'migrated-v2-identity-only',
    ...overrides,
  };
  if (!Object.prototype.hasOwnProperty.call(overrides, 'recipe_digest')) {
    rec.recipe_digest = _saveRecipeDigest(rec);
  }
  return rec;
}

// GAME-04 made the local-backup boundary share the same fail-closed specimen
// grammar as Library and Record Groove (js/93-ui-collection.ts).  Save/WAL
// fixtures must therefore represent records the product can actually render;
// otherwise an import-transaction test can fail before reaching the storage
// seam it owns.  Keep this helper beside minimalSave so future collection
// schema additions have one breadcrumb into the save-system campaign.
function minimalLibrarySpecimen(id: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    collected_at: '2026-08-14T12:00:00.000Z',
    mineral: 'quartz',
    name: id,
    mm: 1,
    a_mm: 0.5,
    habit: 'prismatic',
    forms: ['prism'],
    twinned: false,
    source: {
      mode: 'creative', scenario: 'cooling', seed: 42,
      nucleation_step: 1, nucleation_temp: 180,
    },
    zones: [],
    zone_count: 0,
    total_growth_um: 1_000,
    radiation_damage: 0,
    ...overrides,
  };
}

function minimalFinishingSave(id: string): any {
  const tx: any = {
    schema: 1,
    id: `finish:${id}`,
    run_id: id,
    library_baseline: [],
    library_records: [],
    collected: [],
    new_species: [],
    crystals_collected_delta: 0,
    runs_finished_delta: 1,
  };
  tx.digest = _saveFinishTransactionDigest(tx);
  const rec = minimalSave(id, {
    run_id: id,
    kind: 'auto',
    status: 'finishing',
    finish_transaction: tx,
  });
  rec.recipe_digest = _saveRecipeDigest(rec);
  return rec;
}

beforeEach(() => {
  localStorage.clear();
  setFortressInstantLines(true);
  fortressReset();
  ensureFeSlider();
});

describe('fortress save system (93a) — event-sourced replay', () => {
  it('does not carry a Custom replenish recipe through Home/New Game into an authored Scenario or its replay', () => {
    _fortressBeginCustomFromParams({
      temp: 180,
      pressure: 1,
      fluidParams: { Fe: 987, pH: 6.2 },
      wallOpts: {
        composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
        wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
      },
      conditionOpts: {},
      scenarioOpts: {},
      initialWaterTablePct: 100,
      presetLabel: 'hostile custom recipe',
    }, 777100);
    expect(_liveFortressSim().conditions.fluid.Fe).toBe(987);

    showTitleScreen();
    openNewGameMenu();
    fortressBeginFromScenario('cooling', 777101);
    const scenarioSim = _liveFortressSim();
    const scenarioInitialFe = scenarioSim.conditions.fluid.Fe;
    expect(scenarioInitialFe).not.toBe(987);
    const activeId = _liveSaveActiveRecord().id;

    fortressStep('inject_species', { species: 'Fe', ppm: 111 });
    expect(_liveFortressSim().conditions.fluid.Fe).toBeCloseTo(scenarioInitialFe + 111, 12);
    const scenarioGrid = scenarioSim.wall_state.voxelGridFor(scenarioSim);
    fortressStep('replenish');
    expect(_liveFortressSim().conditions.fluid.Fe).toBeCloseTo(scenarioInitialFe, 12);
    expect(scenarioGrid.voxels.every((voxel: any) =>
      voxel.fluid.Fe === scenarioInitialFe
    )).toBe(true);
    const boundary = scenarioSim._fluidBoundaryTransactions.at(-1);
    const iron = boundary.testimony.find((row: any) => row.field === 'Fe');
    expect(boundary).toMatchObject({
      schema: 'fully-mixed-fluid-replacement-v1',
      source: 'Creative starting-fluid replenish',
      spatial_scope: 'canonical-wet-voxel-volume',
      authority_closed: true,
      closed: true,
    });
    expect(iron).toMatchObject({
      declaredReplacementTarget: scenarioInitialFe,
      unit: 'mg_per_kg_solvent',
      spatial: { closed: true, targetValuePerFluid: scenarioInitialFe },
      closed: true,
    });
    const expectedFingerprint = simulationStateFingerprint(_liveFortressSim());
    expect(loadSaves().find(record => record.id === activeId).actions.map((row: any) => row.a))
      .toEqual(['inject_species', 'replenish']);

    fortressReset();
    expect(loadSaveById(activeId)).toBe(true);
    expect(_liveFortressSim().conditions.fluid.Fe).toBeCloseTo(scenarioInitialFe, 12);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(expectedFingerprint);
  });

  it('replenishes every wet voxel and restores explicit/legacy sulfur authority for Custom and Starter replays', () => {
    _fortressBeginCustomFromParams({
      temp: 180,
      pressure: 1,
      fluidParams: {
        Fe: 987,
        S: 999,
        S_sulfide: 30,
        S_sulfate: 70,
        S_elemental: 5,
        sulfurPoolsExplicit: true,
        sulfateInherited: true,
        nativeSulfurPathway: 'oxidative_interface',
        Eh: -150,
        pH: 6.2,
      },
      wallOpts: {
        composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
        wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
      },
      conditionOpts: {},
      scenarioOpts: {},
      initialWaterTablePct: 100,
      presetLabel: 'explicit sulfur replenish authority',
    }, 777102);
    const explicitSim = _liveFortressSim();
    const explicitGrid = explicitSim.wall_state.voxelGridFor(explicitSim);
    const beforeInvalidTarget = simulationStateFingerprint(explicitSim);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, Fe: -5 },
      'hostile negative-concentration target',
    )).toThrow(/Fe must be non-negative/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, Fe: '5' },
      'hostile string-coordinate target',
    )).toThrow(/Fe must be a raw finite number/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, Cu: true },
      'hostile boolean-coordinate target',
    )).toThrow(/Cu must be a raw finite number/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, Fe: null },
      'hostile null-coordinate target',
    )).toThrow(/Fe must be a raw finite number/);
    const missingCoordinate: any = { ...explicitSim.conditions.fluid };
    delete missingCoordinate.Fe;
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      missingCoordinate,
      'hostile incomplete-coordinate target',
    )).toThrow(/raw target is missing Fe/);
    const missingAuthority: any = { ...explicitSim.conditions.fluid };
    delete missingAuthority.sulfurPoolsExplicit;
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      missingAuthority,
      'hostile missing-authority target',
    )).toThrow(/raw target is missing sulfurPoolsExplicit/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, sulfateInherited: null },
      'hostile null-authority target',
    )).toThrow(/authority flags must be boolean/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid, S: explicitSim.conditions.fluid.S + 1 },
      'hostile inconsistent explicit-sulfur target',
    )).toThrow(/explicit S must equal S_sulfide \+ S_sulfate/);
    expect(() => explicitSim.replaceFullyMixedFluidBoundary(
      { ...explicitSim.conditions.fluid },
      '   ',
    )).toThrow(/requires a target and source/);
    expect(simulationStateFingerprint(explicitSim)).toBe(beforeInvalidTarget);
    explicitSim.conditions.fluid.S_sulfide = 20;
    explicitSim.conditions.fluid.S = 90;
    explicitGrid.voxels.at(-1).fluid.S_sulfide = 10;
    explicitGrid.voxels.at(-1).fluid.S = 80;
    fortressStep('replenish');
    const priorSulfurTransaction = JSON.parse(JSON.stringify(
      explicitSim._sulfurBoundaryTransactions.at(-1),
    ));
    const priorSulfurImports = explicitSim._sulfurBoundaryImportsPpm;
    expect(priorSulfurTransaction.closed).toBe(true);
    expect(priorSulfurImports).toBeGreaterThan(0);

    explicitSim.conditions.fluid.Fe = 1;
    explicitSim.conditions.fluid.S = 12;
    explicitSim.conditions.fluid.S_sulfide = 0;
    explicitSim.conditions.fluid.S_sulfate = 0;
    explicitSim.conditions.fluid.S_elemental = 0;
    explicitSim.conditions.fluid.sulfurPoolsExplicit = false;
    explicitSim.conditions.fluid.sulfateInherited = false;
    explicitSim.conditions.fluid.nativeSulfurPathway = null;
    explicitSim.conditions.fluid.Eh = 225;
    Object.assign(explicitGrid.voxels.at(-1).fluid, {
      Fe: 321,
      S: 17,
      S_sulfide: 0,
      S_sulfate: 0,
      S_elemental: 0,
      sulfurPoolsExplicit: false,
      sulfateInherited: false,
      nativeSulfurPathway: null,
      Eh: 225,
    });
    fortressStep('replenish');

    expect(explicitSim._sulfurBoundaryTransactions).toHaveLength(2);
    expect(explicitSim._sulfurBoundaryTransactions[0]).toEqual(priorSulfurTransaction);
    expect(explicitSim._sulfurBoundaryImportsPpm).toBeGreaterThanOrEqual(priorSulfurImports);

    expect(explicitSim.conditions.fluid).toMatchObject({
      Fe: 987,
      S: 100,
      S_sulfide: 30,
      S_sulfate: 70,
      S_elemental: 5,
      sulfurPoolsExplicit: true,
      sulfateInherited: true,
      nativeSulfurPathway: 'oxidative_interface',
      Eh: -150,
    });
    expect(explicitGrid.voxels.every((voxel: any) =>
      voxel.fluid.Fe === 987
      && voxel.fluid.S === 100
      && voxel.fluid.S_sulfide === 30
      && voxel.fluid.S_sulfate === 70
      && voxel.fluid.S_elemental === 5
      && voxel.fluid.sulfurPoolsExplicit === true
      && voxel.fluid.sulfateInherited === true
      && voxel.fluid.nativeSulfurPathway === 'oxidative_interface'
      && voxel.fluid.Eh === -150
    )).toBe(true);
    expect(explicitSim._fluidBoundaryTransactions.at(-1)).toMatchObject({
      authority_target: {
        sulfurPoolsExplicit: true,
        sulfateInherited: true,
        nativeSulfurPathway: 'oxidative_interface',
      },
      authority_closed: true,
      authority_after_spatial: {
        count: explicitGrid.voxels.length,
        sulfurPoolsExplicitCount: explicitGrid.voxels.length,
        sulfateInheritedCount: explicitGrid.voxels.length,
        nativeSulfurPathways: { oxidative_interface: explicitGrid.voxels.length },
      },
      sulfur_spatial_closed: true,
      sulfur_spatial_testimony: {
        S: { targetValuePerFluid: 100, closed: true },
        S_sulfide: { targetValuePerFluid: 30, closed: true },
        S_sulfate: { targetValuePerFluid: 70, closed: true },
        S_elemental: { targetValuePerFluid: 5, closed: true },
      },
      closed: true,
    });
    expect(explicitSim._sulfurBoundaryTransactions.at(-1)).toMatchObject({
      declarations: [{
        kind: 'replacement',
        targets: { S_sulfide: 30, S_sulfate: 70, S_elemental: 5 },
      }],
      closed: true,
    });
    showTitleScreen();
    openNewGameMenu();
    fortressBeginFromStarterFluid('carbonate', 777103);
    const legacySim = _liveFortressSim();
    const legacyGrid = legacySim.wall_state.voxelGridFor(legacySim);
    legacySim.conditions.fluid.S = 60;
    legacySim.conditions.fluid.S_sulfide = 20;
    legacySim.conditions.fluid.S_sulfate = 35;
    legacySim.conditions.fluid.S_elemental = 5;
    legacySim.conditions.fluid.sulfurPoolsExplicit = true;
    legacySim.conditions.fluid.sulfateInherited = true;
    legacySim.conditions.fluid.nativeSulfurPathway = 'oxidative_interface';
    Object.assign(legacyGrid.voxels.at(-1).fluid, {
      Fe: 654,
      S: 60,
      S_sulfide: 20,
      S_sulfate: 35,
      S_elemental: 5,
      sulfurPoolsExplicit: true,
      sulfateInherited: true,
      nativeSulfurPathway: 'oxidative_interface',
    });
    fortressStep('replenish');

    expect(legacySim.conditions.fluid).toMatchObject({
      S: 0,
      S_sulfide: 0,
      S_sulfate: 0,
      S_elemental: 0,
      sulfurPoolsExplicit: false,
      sulfateInherited: false,
      nativeSulfurPathway: null,
    });
    expect(legacyGrid.voxels.every((voxel: any) =>
      voxel.fluid.S === 0
      && voxel.fluid.S_sulfide === 0
      && voxel.fluid.S_sulfate === 0
      && voxel.fluid.S_elemental === 0
      && voxel.fluid.sulfurPoolsExplicit === false
      && voxel.fluid.sulfateInherited === false
      && voxel.fluid.nativeSulfurPathway === null
    )).toBe(true);
    expect(legacySim._fluidBoundaryTransactions.at(-1)).toMatchObject({
      authority_before: {
        sulfurPoolsExplicit: true,
        sulfateInherited: true,
        nativeSulfurPathway: 'oxidative_interface',
      },
      authority_target: {
        sulfurPoolsExplicit: false,
        sulfateInherited: false,
        nativeSulfurPathway: null,
      },
      authority_closed: true,
      authority_after_spatial: {
        count: legacyGrid.voxels.length,
        sulfurPoolsExplicitCount: 0,
        sulfateInheritedCount: 0,
        nativeSulfurPathways: { null: legacyGrid.voxels.length },
      },
      sulfur_spatial_closed: true,
      sulfur_spatial_testimony: {
        S: { targetValuePerFluid: 0, closed: true },
        S_sulfide: { targetValuePerFluid: 0, closed: true },
        S_sulfate: { targetValuePerFluid: 0, closed: true },
        S_elemental: { targetValuePerFluid: 0, closed: true },
      },
      closed: true,
    });
    expect(legacySim._sulfurBoundaryTransactions.at(-1)).toMatchObject({ closed: true });
  }, 60_000);

  it('replays receipted Replenish actions from clean Custom and Starter origins', () => {
    const assertReplay = () => {
      const activeId = _liveSaveActiveRecord().id;
      fortressStep('inject_species', { species: 'Fe', ppm: 13 });
      fortressStep('replenish');
      const expected = simulationStateFingerprint(_liveFortressSim());
      const receipt = _liveFortressSim()._fluidBoundaryTransactions.at(-1);
      expect(receipt).toMatchObject({
        schema: 'fully-mixed-fluid-replacement-v1',
        authority_closed: true,
        closed: true,
      });
      receipt.source = 'forged replacement source';
      expect(simulationStateFingerprint(_liveFortressSim())).not.toBe(expected);
      receipt.source = 'Creative starting-fluid replenish';
      expect(simulationStateFingerprint(_liveFortressSim())).toBe(expected);
      fortressReset();
      expect(loadSaveById(activeId)).toBe(true);
      expect(simulationStateFingerprint(_liveFortressSim())).toBe(expected);
    };

    _fortressBeginCustomFromParams({
      temp: 180,
      pressure: 1,
      fluidParams: { Fe: 87, S: 12, pH: 6.2 },
      wallOpts: {
        composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
        wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
      },
      conditionOpts: {}, scenarioOpts: {}, initialWaterTablePct: 100,
      presetLabel: 'custom replay replenish',
    }, 777104);
    assertReplay();

    showTitleScreen();
    openNewGameMenu();
    fortressBeginFromStarterFluid('carbonate', 777105);
    assertReplay();
  }, 60_000);

  it('migrates the legacy raw array while preserving unprovable v1 recipes as incompatible', () => {
    const v2 = minimalSave('legacy-v2', { format: 2 });
    delete v2.run_id;
    delete v2.collection_epoch;
    delete v2.collection_receipts;
    delete v2.recipe_digest;
    delete v2.replay_integrity;
    const v1 = minimalSave('legacy-v1', {
      format: 1,
      sim_version: 220,
      model_digest: undefined,
      scenario_spec_hash: undefined,
      replay_integrity: undefined,
    });
    delete v1.recipe_digest;
    localStorage.setItem('vugg-saves-v1', JSON.stringify([v1, v2]));

    const records = loadSaves();
    expect(records).toHaveLength(2);
    expect(records[0].format).toBe(1);
    expect(records[0].recipe_digest).toBeUndefined();
    expect(_saveReplayCompatibility(records[0])).toMatchObject({ ok: false });
    expect(records[1].recipe_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(records[1].replay_integrity).toBe('migrated-v2-identity-only');
    expect(_saveReplayCompatibility(records[1])).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/format-v2.*preserved.*replay.*blocked/i),
    });

    const envelope = JSON.parse(localStorage.getItem('vugg-saves-v1') || 'null');
    expect(envelope).toMatchObject({ storage_format: 2, generation: 0 });
    expect(envelope.storage_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(_liveSaveStorageNotice()).toMatch(/legacy array format/);

    const migratedDigest = records[1].recipe_digest;
    const secondRead = loadSaves();
    expect(secondRead.find(record => record.id === 'legacy-v2')).toMatchObject({
      recipe_digest: migratedDigest,
      replay_integrity: 'migrated-v2-identity-only',
    });
    expect(_saveReplayCompatibility(secondRead.find(record => record.id === 'legacy-v2')))
      .toMatchObject({ ok: false });
  });

  it('preserves but refuses a fully rehashed v3-to-v2 downgrade even when no collection exists', () => {
    const modern = minimalSave('no-downgrade');
    modern.format = 2;
    delete modern.run_id;
    delete modern.collection_epoch;
    delete modern.collection_receipts;
    modern.recipe_digest = _saveRecipeDigest(modern);

    expect(_saveReplayCompatibility(modern)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/format-v2.*self-consistent v3-to-v2 downgrade/i),
    });
    expect(persistSaves([modern])).toBe(true);
    expect(loadSaves()).toHaveLength(1);
    expect(_saveReplayCompatibility(loadSaves()[0])).toMatchObject({ ok: false });
  });

  it('preserves a pre-WAL terminal v2 recipe without inventing a finish transaction', () => {
    const legacyFinished = minimalSave('legacy-finished-v2', {
      format: 2,
      status: 'finished',
    });
    delete legacyFinished.run_id;
    delete legacyFinished.collection_epoch;
    delete legacyFinished.collection_receipts;
    delete legacyFinished.finish_transaction;
    legacyFinished.recipe_digest = _saveRecipeDigest(legacyFinished);

    expect(persistSaves([legacyFinished])).toBe(true);
    const preserved = loadSaves().find(record => record.id === legacyFinished.id);
    expect(preserved).toMatchObject({ format: 2, status: 'finished' });
    expect(preserved.finish_transaction).toBeUndefined();
    expect(_saveReplayCompatibility(preserved)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/format-v2.*preserved/i),
    });
  });

  it('rejects a rehashed format-v3 finished record after its finish transaction is removed', () => {
    const finished = minimalFinishingSave('missing-terminal-receipt');
    finished.status = 'finished';
    finished.recipe_digest = _saveRecipeDigest(finished);
    expect(_saveReplayCompatibility(finished)).toEqual({ ok: true, reason: '' });

    delete finished.finish_transaction;
    finished.recipe_digest = _saveRecipeDigest(finished);
    expect(_saveReplayCompatibility(finished)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/terminal record is missing.*finish transaction/i),
    });
    expect(persistSaves([finished])).toBe(false);
  });

  it('promotes the newest authenticated pending generation after an interrupted publication', () => {
    const first = minimalSave('first');
    expect(persistSaves([first])).toBe(true);
    const generationOne = localStorage.getItem('vugg-saves-v1');
    expect(persistSaves([first, minimalSave('second')])).toBe(true);
    const generationTwo = localStorage.getItem('vugg-saves-v1');
    const generationOneEnvelope = JSON.parse(generationOne as string);
    const generationTwoEnvelope = JSON.parse(generationTwo as string);
    expect(generationTwoEnvelope.generation).toBe(generationOneEnvelope.generation + 1);
    localStorage.setItem('vugg-saves-v1', generationOne as string);
    localStorage.setItem('vugg-saves-v1.pending', generationTwo as string);
    localStorage.removeItem('vugg-saves-v1.backup');

    expect(loadSaves().map(record => record.id)).toEqual(['first', 'second']);
    expect(localStorage.getItem('vugg-saves-v1.pending')).toBeNull();
    expect(JSON.parse(localStorage.getItem('vugg-saves-v1') as string).generation)
      .toBe(generationTwoEnvelope.generation);
    expect(_liveSaveStorageNotice()).toMatch(/pending journal/);
  });

  it('recovers a corrupt primary from its authenticated backup and quarantines the bad bytes', () => {
    const first = minimalSave('recover-me');
    expect(persistSaves([first])).toBe(true);
    const firstPrimary = JSON.parse(localStorage.getItem('vugg-saves-v1') as string);
    expect(persistSaves([first, minimalSave('newer-generation')])).toBe(true);
    const latestPrimary = JSON.parse(localStorage.getItem('vugg-saves-v1') as string);
    const naturalBackup = JSON.parse(localStorage.getItem('vugg-saves-v1.backup') as string);
    expect(latestPrimary.generation).toBe(firstPrimary.generation + 1);
    expect(naturalBackup.generation).toBe(firstPrimary.generation);
    expect(naturalBackup.storage_digest).toBe(_saveEnvelopeDigest(naturalBackup));
    expect(naturalBackup.records.map((record: any) => record.id)).toEqual(['recover-me']);
    localStorage.setItem('vugg-saves-v1', '{not-json');
    localStorage.removeItem('vugg-saves-v1.pending');

    expect(loadSaves().map(record => record.id)).toEqual(['recover-me']);
    expect(_liveSaveStorageNotice()).toMatch(/Recovered 1 save from backup/);
    const quarantine = JSON.parse(localStorage.getItem('vugg-saves-v1.corrupt') as string);
    expect(quarantine.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'primary', raw: '{not-json' }),
    ]));
    expect(() => JSON.parse(localStorage.getItem('vugg-saves-v1') as string)).not.toThrow();
  });

  it('preserves every corrupt storage candidate across recovery and new publication', () => {
    localStorage.setItem('vugg-saves-v1', '{bad-primary');
    localStorage.setItem('vugg-saves-v1.pending', '{bad-pending');
    localStorage.setItem('vugg-saves-v1.backup', '{bad-backup');

    expect(loadSaves()).toEqual([]);
    let quarantine = JSON.parse(localStorage.getItem('vugg-saves-v1.corrupt') as string);
    expect(quarantine).toMatchObject({ storage_format: 1 });
    expect(quarantine.entries.map((entry: any) => [entry.source, entry.raw])).toEqual([
      ['primary', '{bad-primary'],
      ['pending journal', '{bad-pending'],
      ['backup', '{bad-backup'],
    ]);

    expect(persistSaves([minimalSave('clean-recovery')])).toBe(true);
    quarantine = JSON.parse(localStorage.getItem('vugg-saves-v1.corrupt') as string);
    expect(quarantine.entries.map((entry: any) => entry.raw)).toEqual([
      '{bad-primary', '{bad-pending', '{bad-backup',
    ]);
    expect(loadSaves().map(record => record.id)).toEqual(['clean-recovery']);
  });

  it('exports and restores one checksum-bound, telemetry-free local data generation', () => {
    expect(persistSaves([minimalSave('backup-save')])).toBe(true);
    const backupSpecimen = minimalLibrarySpecimen('backup-specimen', { name: 'Backup quartz' });
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([backupSpecimen]));
    localStorage.setItem('vugg-stats-v1', JSON.stringify({
      crystals_collected: 7,
      runs_finished: 2,
      applied_finish_ids: ['finish-1'],
      applied_collection_ids: ['collect-1'],
    }));
    localStorage.setItem('vugg-settings-v1', JSON.stringify({
      display: { fontScale: 1.5, motion: 'reduced' },
    }));
    const backup = _saveBuildLocalExport();
    expect(_saveAssertLocalExport(backup)).toBe(true);
    expect(backup.backup_sha256).toBe(_saveLocalExportDigest(backup));

    localStorage.setItem('vugg-crystals-v1', '[]');
    localStorage.setItem('vugg-stats-v1', JSON.stringify({
      crystals_collected: 0,
      runs_finished: 0,
      applied_finish_ids: [],
      applied_collection_ids: [],
    }));
    localStorage.removeItem('vugg-settings-v1');
    expect(_saveApplyLocalExport(backup)).toBe(true);
    expect(loadSaves().map(record => record.id)).toEqual(['backup-save']);
    expect(loadCrystals()).toEqual([backupSpecimen]);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 7, runs_finished: 2 });
    expect(JSON.parse(localStorage.getItem('vugg-settings-v1') as string).display)
      .toEqual({ fontScale: 1.5, motion: 'reduced' });
    expect(localStorage.getItem('vugg-local-import-v1.pending')).toBeNull();
  });

  it('rejects both checksum tampering and a rehashed malformed Library before writes', () => {
    const backup = _saveBuildLocalExport();
    const tampered = structuredClone(backup);
    tampered.storage['vugg-settings-v1'] = JSON.stringify({ display: { fontScale: 1.5 } });
    expect(() => _saveAssertLocalExport(tampered)).toThrow(/failed authentication/i);

    const malformed = structuredClone(backup);
    malformed.storage['vugg-crystals-v1'] = JSON.stringify([
      minimalLibrarySpecimen('same'), minimalLibrarySpecimen('same'),
    ]);
    malformed.backup_sha256 = _saveLocalExportDigest(malformed);
    expect(() => _saveAssertLocalExport(malformed)).toThrow(/duplicate specimen id/i);
  });

  it('rolls back an interrupted import and resumes its exact journal after storage recovers', () => {
    expect(persistSaves([minimalSave('import-target')])).toBe(true);
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('target-crystal'),
    ]));
    localStorage.setItem('vugg-stats-v1', JSON.stringify({
      crystals_collected: 1,
      runs_finished: 1,
      applied_finish_ids: [],
      applied_collection_ids: [],
    }));
    const backup = _saveBuildLocalExport();

    expect(persistSaves([minimalSave('prior-save')])).toBe(true);
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('prior-crystal'),
    ]));
    const previousPrimary = localStorage.getItem('vugg-saves-v1');
    const previousLibrary = localStorage.getItem('vugg-crystals-v1');
    const nativeSetItem = Storage.prototype.setItem;
    let denied = false;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-crystals-v1' && !denied) {
        denied = true;
        throw new DOMException('simulated import interruption', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      expect(_saveApplyLocalExport(backup)).toBe(false);
    } finally {
      setItem.mockRestore();
    }
    expect(localStorage.getItem('vugg-saves-v1')).toBe(previousPrimary);
    expect(localStorage.getItem('vugg-crystals-v1')).toBe(previousLibrary);
    expect(localStorage.getItem('vugg-local-import-v1.pending')).not.toBeNull();

    expect(_saveRecoverLocalImportJournal()).toBe(true);
    expect(loadSaves().map(record => record.id)).toEqual(['import-target']);
    expect(loadCrystals().map(record => record.id)).toEqual(['target-crystal']);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 1 });
    expect(localStorage.getItem('vugg-local-import-v1.pending')).toBeNull();
  });

  it('never replays an old import when browser storage silently retains the close marker', () => {
    expect(persistSaves([minimalSave('silent-remove-target')])).toBe(true);
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('imported-crystal'),
    ]));
    const backup = _saveBuildLocalExport();

    const nativeRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === 'vugg-local-import-v1.pending') return;
      return nativeRemoveItem.call(this, key);
    });
    try {
      expect(_saveApplyLocalExport(backup)).toBe(false);
      expect(loadCrystals().map(record => record.id)).toEqual(['imported-crystal']);
      expect(JSON.parse(localStorage.getItem('vugg-local-import-v1.pending') as string))
        .toMatchObject({ schema: 'vugg-local-import-closed-v1', backup_sha256: backup.backup_sha256 });
      expect(_liveSaveStorageNotice()).toMatch(/inert close marker/i);
    } finally {
      removeItem.mockRestore();
    }

    // New player data written after the reported cleanup failure must survive
    // restart recovery; the retained value is a tombstone, not import intent.
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('newer-player-crystal'),
    ]));
    expect(_saveRecoverLocalImportJournal()).toBe(true);
    expect(loadCrystals().map(record => record.id)).toEqual(['newer-player-crystal']);
    expect(localStorage.getItem('vugg-local-import-v1.pending')).toBeNull();
  });

  it('reports throwing close-marker cleanup as post-commit and never mislabels changed data', () => {
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('throw-remove-imported'),
    ]));
    const removeBackup = _saveBuildLocalExport();
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('throw-remove-prior'),
    ]));

    const nativeRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === 'vugg-local-import-v1.pending') {
        throw new DOMException('simulated cleanup denial', 'SecurityError');
      }
      return nativeRemoveItem.call(this, key);
    });
    try {
      expect(_saveApplyLocalExport(removeBackup)).toBe(false);
      expect(loadCrystals().map(record => record.id)).toEqual(['throw-remove-imported']);
      expect(_liveSaveStorageNotice()).toMatch(/authenticated and committed.*inert close marker/i);
    } finally {
      removeItem.mockRestore();
    }
    expect(JSON.parse(localStorage.getItem('vugg-local-import-v1.pending') as string))
      .toMatchObject({ schema: 'vugg-local-import-closed-v1' });
    expect(_saveRecoverLocalImportJournal()).toBe(true);

    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('throw-readback-imported'),
    ]));
    const readbackBackup = _saveBuildLocalExport();
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([
      minimalLibrarySpecimen('throw-readback-prior'),
    ]));
    let pendingRemoved = false;
    let readbackThrew = false;
    const removeForReadback = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      const result = nativeRemoveItem.call(this, key);
      if (key === 'vugg-local-import-v1.pending') pendingRemoved = true;
      return result;
    });
    const nativeGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'vugg-local-import-v1.pending' && pendingRemoved && !readbackThrew) {
        readbackThrew = true;
        throw new DOMException('simulated cleanup readback denial', 'SecurityError');
      }
      return nativeGetItem.call(this, key);
    });
    try {
      expect(_saveApplyLocalExport(readbackBackup)).toBe(false);
      expect(loadCrystals().map(record => record.id)).toEqual(['throw-readback-imported']);
      expect(_liveSaveStorageNotice()).toMatch(/authenticated and committed.*inert close marker/i);
    } finally {
      getItem.mockRestore();
      removeForReadback.mockRestore();
    }
    expect(localStorage.getItem('vugg-local-import-v1.pending')).toBeNull();
  });

  it('never auto-prunes an unresolved finishing journal after its live session is gone', () => {
    const finishing = minimalFinishingSave('finish-wal');
    const ordinary = Array.from({ length: 12 }, (_, idx) => minimalSave(`auto-${idx}`, {
      kind: 'auto',
      updated_at: `2026-08-14T12:${String(idx).padStart(2, '0')}:00.000Z`,
    }));
    const pruned = _savePruneAutosaves([finishing, ...ordinary]);
    expect(pruned.find(record => record.id === finishing.id)).toBe(finishing);
    expect(pruned.filter(record => record.kind === 'auto' && record.status === 'in-progress'))
      .toHaveLength(8);
  });

  it('rejects a recipe mutation even when the outer storage digest is recomputed', () => {
    expect(persistSaves([minimalSave('sealed')])).toBe(true);
    const envelope = JSON.parse(localStorage.getItem('vugg-saves-v1') as string);
    envelope.records[0].actions.push({ a: 'wait' });
    envelope.storage_digest = _saveEnvelopeDigest(envelope);
    localStorage.setItem('vugg-saves-v1', JSON.stringify(envelope));
    localStorage.removeItem('vugg-saves-v1.pending');
    localStorage.removeItem('vugg-saves-v1.backup');

    expect(loadSaves()).toEqual([]);
    expect(_liveSaveStorageNotice()).toMatch(/no authenticated recovery copy/);
  });

  it('keeps a durable journal and repairs it when primary publication throws', () => {
    const nativeSetItem = Storage.prototype.setItem;
    let rejectedPrimary = false;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-saves-v1' && !rejectedPrimary) {
        rejectedPrimary = true;
        throw new DOMException('simulated primary interruption', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      expect(persistSaves([minimalSave('journaled')])).toBe(true);
      expect(localStorage.getItem('vugg-saves-v1')).toBeNull();
      expect(localStorage.getItem('vugg-saves-v1.pending')).not.toBeNull();
    } finally {
      setItem.mockRestore();
    }
    expect(loadSaves().map(record => record.id)).toEqual(['journaled']);
    expect(localStorage.getItem('vugg-saves-v1.pending')).toBeNull();
  });

  it('retains a completed action in memory and shows a global notice when the pending journal write is denied', () => {
    const storageNotice = installRealTestElement('saves-storage-notice');
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const nativeSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-saves-v1.pending') {
        throw new DOMException('simulated pending denial', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      fortressStep('warm');
      expect(_liveSaveActiveRecord().actions.at(-1)).toMatchObject({ a: 'warm' });
      const durable = JSON.parse(localStorage.getItem('vugg-saves-v1') as string);
      expect(durable.records.find((record: any) => record.id === activeId).actions).toEqual([]);
      expect(_liveSaveStorageNotice()).toMatch(/newest changes remain in memory/i);
      expect(storageNotice.classList).toContain('save-storage-global-failure');
      expect(storageNotice.style.display).toBe('block');
    } finally {
      setItem.mockRestore();
    }
    expect(_savePersistActive()).toBe(true);
    expect(loadSaves().find(record => record.id === activeId).actions.at(-1))
      .toMatchObject({ a: 'warm' });
  });

  it('does not claim or discard a finished run when pending-journal readback fails', () => {
    const fortressLog = installRealTestElement('fortress-log');
    installRealTestElement('saves-storage-notice');
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const nativeGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'vugg-saves-v1.pending') return null;
      return nativeGetItem.call(this, key);
    });
    try {
      fortressFinish();
      expect(_liveSaveActiveRecord()).toMatchObject({ id: activeId, status: 'finishing' });
      const durable = JSON.parse(localStorage.getItem('vugg-saves-v1') as string);
      expect(durable.records.find((record: any) => record.id === activeId).status).toBe('in-progress');
      expect(fortressLog.textContent).toMatch(/Finish transaction incomplete/i);
      expect(fortressLog.textContent).not.toMatch(/Run saved/i);
      expect(loadCrystals()).toEqual([]);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
    } finally {
      getItem.mockRestore();
    }
    expect(_saveMarkFinished()).toMatchObject({ name: expect.any(String), saved: true });
    expect(_liveSaveActiveRecord()).toBeNull();
    expect(loadSaves().find(record => record.id === activeId).status).toBe('finished');
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 1 });
  });

  it('fails closed and quarantines malformed Library bytes before staging finish', () => {
    fortressBeginFromScenario('cooling', 42);
    const corruptLibrary = '[{"id":"existing-specimen","mineral":"quartz"}';
    localStorage.setItem('vugg-crystals-v1', corruptLibrary);

    fortressFinish();

    expect(_liveSaveActiveRecord()).toMatchObject({ status: 'in-progress' });
    expect(localStorage.getItem('vugg-crystals-v1')).toBe(corruptLibrary);
    expect(JSON.parse(localStorage.getItem('vugg-crystals-v1.corrupt') as string))
      .toMatchObject({ raw: corruptLibrary });
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
  });

  it('retains a durable finishing WAL without overwriting existing specimens when Library readback is denied', () => {
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const existingSpecimen = minimalLibrarySpecimen('existing-specimen', { name: 'Existing' });
    const existingRaw = JSON.stringify([existingSpecimen]);
    localStorage.setItem('vugg-crystals-v1', existingRaw);
    const nativeGetItem = Storage.prototype.getItem;
    let libraryReads = 0;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'vugg-crystals-v1' && ++libraryReads >= 2) {
        throw new DOMException('simulated Library read denial', 'SecurityError');
      }
      return nativeGetItem.call(this, key);
    });
    try {
      fortressFinish();
      expect(_liveSaveActiveRecord()).toMatchObject({ id: activeId, status: 'finishing' });
      expect(loadSaves().find(record => record.id === activeId).status).toBe('finishing');
      expect(nativeGetItem.call(localStorage, 'vugg-crystals-v1')).toBe(existingRaw);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
    } finally {
      getItem.mockRestore();
    }
    expect(_saveMarkFinished()).toMatchObject({ saved: true });
    expect(loadCrystals()).toEqual([existingSpecimen]);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 1 });
  });

  it('preserves malformed lifetime bytes and applies a retained finish journal exactly once after repair', () => {
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const corruptStats = '{"crystals_collected":17,"runs_finished":4';
    localStorage.setItem('vugg-stats-v1', corruptStats);

    fortressFinish();

    expect(_liveSaveActiveRecord()).toMatchObject({ id: activeId, status: 'finishing' });
    expect(localStorage.getItem('vugg-stats-v1')).toBe(corruptStats);
    expect(JSON.parse(localStorage.getItem('vugg-stats-v1.corrupt') as string))
      .toMatchObject({ raw: corruptStats });

    const repaired = {
      crystals_collected: 17,
      runs_finished: 4,
      applied_finish_ids: ['finish:historical-save'],
      applied_collection_ids: [],
    };
    localStorage.setItem('vugg-stats-v1', JSON.stringify(repaired));
    expect(_saveMarkFinished()).toMatchObject({ saved: true });
    const applied = JSON.parse(localStorage.getItem('vugg-stats-v1') as string);
    expect(applied).toEqual({
      crystals_collected: 17,
      runs_finished: 5,
      applied_finish_ids: ['finish:historical-save', `finish:${activeId}`],
      applied_collection_ids: [],
    });
  });

  it('does not overwrite valid lifetime totals when the finish transaction cannot read them', () => {
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const prior = {
      crystals_collected: 23,
      runs_finished: 6,
      applied_finish_ids: ['finish:historical-save'],
      applied_collection_ids: [],
    };
    const priorRaw = JSON.stringify(prior);
    localStorage.setItem('vugg-stats-v1', priorRaw);
    const nativeGetItem = Storage.prototype.getItem;
    let denied = false;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'vugg-stats-v1' && !denied) {
        denied = true;
        throw new DOMException('simulated lifetime read denial', 'SecurityError');
      }
      return nativeGetItem.call(this, key);
    });
    try {
      fortressFinish();
      expect(_liveSaveActiveRecord()).toMatchObject({ id: activeId, status: 'finishing' });
      expect(nativeGetItem.call(localStorage, 'vugg-stats-v1')).toBe(priorRaw);
    } finally {
      getItem.mockRestore();
    }

    expect(_saveMarkFinished()).toMatchObject({ saved: true });
    expect(JSON.parse(localStorage.getItem('vugg-stats-v1') as string)).toEqual({
      crystals_collected: 23,
      runs_finished: 7,
      applied_finish_ids: ['finish:historical-save', `finish:${activeId}`],
      applied_collection_ids: [],
    });
  });

  it('rejects a rehashed staged-to-pre-collected forgery, then idempotently completes the authentic finish journal', () => {
    beginFastCollectableRun();
    const activeId = _liveSaveActiveRecord().id;
    const sim = _liveFortressSim();
    const grown = grownCount(sim);
    expect(grown).toBeGreaterThan(0);
    const targetIdx = sim.crystals.findIndex((crystal: any) =>
      (crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0);
    const sentinel = buildCrystalRecord(sim.crystals[targetIdx], {
      mode: 'creative',
      run_id: 'unrelated-run',
      crystal_index: targetIdx,
    });
    sentinel.id = 'science-identical-unrelated-sentinel';
    sentinel.name = 'Unrelated earlier specimen';
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([sentinel]));

    const nativeSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-crystals-v1') {
        throw new DOMException('simulated Library denial', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      fortressFinish();
      expect(_liveSaveActiveRecord()).toMatchObject({ id: activeId, status: 'finishing' });
      expect(loadSaves().find(record => record.id === activeId).status).toBe('finishing');
      expect(loadCrystals()).toEqual([sentinel]);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
    } finally {
      setItem.mockRestore();
    }

    const authenticRaw = localStorage.getItem('vugg-saves-v1') as string;
    const forgedEnvelope = JSON.parse(authenticRaw);
    const forgedRecord = forgedEnvelope.records.find((record: any) => record.id === activeId);
    const forgedTx = forgedRecord.finish_transaction;
    const targetPair = forgedTx.collected.find((pair: any) => pair[0] === targetIdx);
    const stagedId = targetPair[1];
    forgedTx.library_records = forgedTx.library_records.filter((record: any) => record.id !== stagedId);
    targetPair[1] = sentinel.id;
    forgedTx.crystals_collected_delta = forgedTx.library_records.length;
    const seenSpecies = new Set(forgedTx.library_baseline.map((entry: any) => entry.mineral));
    forgedTx.new_species = forgedTx.library_records
      .map((record: any) => record.mineral)
      .filter((mineral: string) => {
        if (seenSpecies.has(mineral)) return false;
        seenSpecies.add(mineral);
        return true;
      });
    forgedTx.digest = _saveFinishTransactionDigest(forgedTx);
    forgedRecord.recipe_digest = _saveRecipeDigest(forgedRecord);
    forgedEnvelope.storage_digest = _saveEnvelopeDigest(forgedEnvelope);
    localStorage.setItem('vugg-saves-v1', JSON.stringify(forgedEnvelope));
    localStorage.removeItem('vugg-saves-v1.pending');
    localStorage.removeItem('vugg-saves-v1.backup');

    fortressReset();
    expect(loadSaveById(activeId)).toBe(false);
    expect(loadCrystals()).toEqual([sentinel]);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });

    // Simulate closing the run after the write-ahead journal landed. Loading
    // must replay the recipe, apply the same specimen ids once, and seal it.
    localStorage.setItem('vugg-saves-v1', authenticRaw);
    expect(loadSaveById(activeId)).toBe(true);
    expect(loadSaves().find(record => record.id === activeId).status).toBe('finished');
    expect(loadCrystals()).toHaveLength(grown + 1);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: grown, runs_finished: 1 });

    const libraryIds = loadCrystals().map(record => record.id);
    expect(loadSaveById(activeId)).toBe(true);
    expect(loadCrystals().map(record => record.id)).toEqual(libraryIds);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: grown, runs_finished: 1 });
  });

  it('keeps the active autosave and recording identity when deletion cannot reach the pending journal', () => {
    fortressBeginFromScenario('cooling', 42);
    const activeId = _liveSaveActiveRecord().id;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const nativeSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-saves-v1.pending') {
        throw new DOMException('simulated delete denial', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      expect(deleteSaveById(activeId)).toBe(false);
      expect(_liveSaveActiveRecord()?.id).toBe(activeId);
      expect(loadSaves().some(record => record.id === activeId)).toBe(true);
      expect(_liveSaveStorageNotice()).toMatch(/newest changes remain in memory/i);
    } finally {
      setItem.mockRestore();
    }
    expect(deleteSaveById(activeId)).toBe(true);
    expect(_liveSaveActiveRecord()).toBeNull();
    expect(loadSaves().some(record => record.id === activeId)).toBe(false);
    confirm.mockRestore();
  });

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
    expect(manual.replay_state_digest).toBe(simulationStateFingerprint(simA));
    expect(manual.recipe_digest).toBe(_saveRecipeDigest(manual));
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

  it('keeps a Herkimer Heat choice above the absolute cooling movement and replays it exactly', () => {
    const seed = 26702;
    fortressBeginFromScenario('cooling', seed);
    const waitOnly = _liveFortressSim();
    expect(waitOnly.conditions.temperature).toBe(180);
    fortressStep('wait');
    const waitOnlyTemperature = waitOnly.conditions.temperature;
    const waitOnlyDigest = simulationStateFingerprint(waitOnly);

    fortressReset();
    fortressBeginFromScenario('cooling', seed);
    const heated = _liveFortressSim();
    expect(heated.conditions._scenario.movements).toEqual([
      expect.objectContaining({ field: 'temperature', startStep: 0, endStep: 100, base: 180 }),
    ]);
    fortressStep('heat');
    expect(heated.conditions.temperature).toBe(205);
    expect(heated._playerActionReceipts).toHaveLength(1);
    expect(heated._playerActionReceipts[0]).toMatchObject({
      schema: 'player-movement-intervention-v1',
      action: 'heat',
      field: 'temperature',
      accepted_at_step: 0,
      action_cursor: 0,
      first_geology_step: 1,
      value_before: 180,
      value_after: 205,
      applied_delta: 25,
      movement_authority: {
        schema: 'movement-player-offset-v2',
        field: 'temperature',
        first_geology_step: 1,
        offset_after: 25,
        offset_application: 'after-authored-texture-and-clamp',
      },
    });
    fortressStep('wait');
    expect(heated.conditions.temperature - waitOnlyTemperature).toBeCloseTo(25, 9);
    expect(simulationStateFingerprint(heated)).not.toBe(waitOnlyDigest);

    const beforeReplay = simulationStateFingerprint(heated);
    const manual = _saveManualNamed('GAME-02 Herkimer heat branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(heated._playerActionReceipts);
  });

  it('protects non-temperature controls through the generic movement-owned field boundary', () => {
    const seed = 26705;
    fortressBeginFromScenario('grimsel_alpine_cleft', seed);
    const waitOnly = _liveFortressSim();
    fortressStep('wait');
    const waitOnlyPressure = waitOnly.conditions.pressure;

    fortressReset();
    fortressBeginFromScenario('grimsel_alpine_cleft', seed);
    const decompressed = _liveFortressSim();
    fortressStep('decompress', { deltaKbar: 0.4 });
    expect(decompressed._playerActionReceipts).toHaveLength(1);
    expect(decompressed._playerActionReceipts[0]).toMatchObject({
      action: 'decompress', field: 'pressure',
      movement_authority: expect.objectContaining({
        schema: 'movement-player-offset-v2', movement_index: 1,
        offset_application: 'after-authored-texture-and-clamp',
      }),
    });
    expect(decompressed._playerActionReceipts[0].applied_delta).toBeCloseTo(-0.4, 12);
    fortressStep('wait');
    expect(decompressed.conditions.pressure - waitOnlyPressure).toBeCloseTo(-0.4, 10);
  });

  it('carries an accepted silica choice into every canonical pore-fluid voxel', () => {
    const seed = 26709;
    fortressBeginFromScenario('amethyst_geode', seed);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const silicaValues = () => grid.voxels.map((voxel: any) => voxel.fluid.SiO2);
    const before = silicaValues();
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((value: number) => value === 320)).toBe(true);

    fortressStep('silica');
    expect(sim.conditions.fluid.SiO2).toBe(720);
    const after = silicaValues();
    expect(after.every((value: number, index: number) => value === before[index] + 400)).toBe(true);
    expect(sim._playerActionReceipts).toHaveLength(1);
    expect(sim._playerActionReceipts[0]).toMatchObject({
      action: 'silica', field: 'fluid.SiO2', applied_delta: 400,
      fluid_spatial_authority: {
        schema: 'player-fluid-spatial-intervention-v1',
        field: 'fluid.SiO2', application: 'uniform-delta',
        scope: 'canonical-nonvadose-voxel-volume',
        water_state_basis: 'authenticated-cavity-ring-water-state',
        water_state_scope: 'nonvadose',
        canonical_count: before.length, count: before.length, excluded_count: 0,
        before_finite_count: before.length, after_finite_count: before.length,
        value_before: 320, value_after: 720, applied_delta: 400,
        clamped_count: 0, clamp_adjustment_total: 0,
        closed: true,
      },
    });
    fortressStep('wait');
    expect(sim.conditions.fluid.SiO2).toBeGreaterThan(700);
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 pore-fluid silica branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(sim._playerActionReceipts);
  });

  it('coalesces a downward-first silica broth drag as one exact spatial replacement', () => {
    fortressBeginFromScenario('amethyst_geode', 26710);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    setBrothValue('sio2', '100');
    setBrothValue('sio2', '200');
    expect(sim.conditions.fluid.SiO2).toBe(200);
    expect(grid.voxels.every((voxel: any) => voxel.fluid.SiO2 === 200)).toBe(true);
    expect(sim._playerActionReceipts).toHaveLength(1);
    expect(sim._playerActionReceipts[0]).toMatchObject({
      action: 'broth-sio2', field: 'fluid.SiO2',
      value_before: 320, value_after: 200, applied_delta: -120,
      fluid_spatial_authority: {
        schema: 'player-fluid-spatial-intervention-v1',
        application: 'exact-replacement',
        value_before: 320, value_after: 200, applied_delta: -120,
        count: grid.voxels.length, closed: true,
      },
    });
    fortressStep('wait');
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 exact silica broth branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(sim._playerActionReceipts);
  });

  it('targets drained silica and exact broth edits only to non-vadose pore fluid', () => {
    fortressBeginFromScenario('amethyst_geode', 26712);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const initialOxygen = grid.voxels[0].fluid.O2;
    expect(grid.voxels.every((voxel: any) => voxel.fluid.O2 === initialOxygen)).toBe(true);
    fortressStep('drain');
    const wet = grid.voxels.filter((voxel: any) =>
      sim.conditions.ringWaterState(voxel.ringIdx, sim.wall_state.ring_count) !== 'vadose');
    const vadose = grid.voxels.filter((voxel: any) =>
      sim.conditions.ringWaterState(voxel.ringIdx, sim.wall_state.ring_count) === 'vadose');
    expect(wet.length).toBeGreaterThan(0);
    expect(vadose.length).toBeGreaterThan(0);
    expect(wet.every((voxel: any) => voxel.fluid.O2 === initialOxygen)).toBe(true);
    expect(vadose.every((voxel: any) => voxel.fluid.O2 === 0.6)).toBe(true);

    fortressStep('silica');
    expect(wet.every((voxel: any) => voxel.fluid.SiO2 === 720)).toBe(true);
    expect(vadose.every((voxel: any) => voxel.fluid.SiO2 === 320)).toBe(true);
    expect(sim._playerActionReceipts.at(-1)?.fluid_spatial_authority).toMatchObject({
      scope: 'canonical-nonvadose-voxel-volume',
      water_state_scope: 'nonvadose',
      canonical_count: grid.voxels.length,
      count: wet.length,
      excluded_count: vadose.length,
      value_before: 320,
      value_after: 720,
      closed: true,
    });

    setBrothValue('sio2', '200');
    expect(wet.every((voxel: any) => voxel.fluid.SiO2 === 200)).toBe(true);
    expect(vadose.every((voxel: any) => voxel.fluid.SiO2 === 320)).toBe(true);
    expect(sim._playerActionReceipts.at(-1)?.fluid_spatial_authority).toMatchObject({
      application: 'exact-replacement',
      scope: 'canonical-nonvadose-voxel-volume',
      canonical_count: grid.voxels.length,
      count: wet.length,
      excluded_count: vadose.length,
      value_before: 720,
      value_after: 200,
      closed: true,
    });
    fortressStep('wait');
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 drained wet-fluid branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
  });

  it('applies Flood dilution as a per-voxel scale across heterogeneous wet and former-vadose fluid', () => {
    fortressBeginFromScenario('amethyst_geode', 26714);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    fortressStep('drain');
    const preFloodWet = grid.voxels.filter((voxel: any) =>
      sim.conditions.ringWaterState(voxel.ringIdx, sim.wall_state.ring_count) !== 'vadose');
    const preFloodVadose = grid.voxels.filter((voxel: any) =>
      sim.conditions.ringWaterState(voxel.ringIdx, sim.wall_state.ring_count) === 'vadose');
    fortressStep('silica');
    expect(preFloodWet.every((voxel: any) => voxel.fluid.SiO2 === 720)).toBe(true);
    expect(preFloodVadose.every((voxel: any) => voxel.fluid.SiO2 === 320)).toBe(true);

    fortressStep('flood');
    expect(sim.conditions.fluid_surface_ring).toBe(sim.wall_state.ring_count);
    expect(preFloodWet.every((voxel: any) => voxel.fluid.SiO2 === 432)).toBe(true);
    expect(preFloodVadose.every((voxel: any) => voxel.fluid.SiO2 === 192)).toBe(true);
    const authority = sim._playerActionReceipts.at(-1)?.fluid_spatial_authority;
    expect(authority).toMatchObject({
      application: 'uniform-scale',
      transformation_basis: 'flood:SiO2:scale',
      transform_scale: 0.6,
      transform_offset: 0,
      scope: 'canonical-nonvadose-voxel-volume',
      canonical_count: grid.voxels.length,
      count: grid.voxels.length,
      excluded_count: 0,
      value_before: 720,
      value_after: 432,
      closed: true,
    });
    const expectedTotal = preFloodWet.length * 432 + preFloodVadose.length * 192;
    expect(authority.after_total).toBeCloseTo(expectedTotal, 8);
    expect(authority.movement_authority).toBeUndefined();
    expect(sim._playerActionReceipts.at(-1).movement_authority).toMatchObject({
      offset_before: 400,
      offset_after: 112,
    });
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 heterogeneous flood scale');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
  });

  it('executes a bounded vadose law even when its bulk scalar is already at the bound', () => {
    fortressBeginFromScenario('amethyst_geode', 26716);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    fortressStep('drain');
    setBrothValue('o2', '20'); // 2.0 ppm in the still-wet volume; dry pores retain 0.6.
    fortressStep('flood');
    expect(sim.conditions.fluid.O2).toBe(2);
    expect(grid.voxels.some((voxel: any) => voxel.fluid.O2 === 0.6)).toBe(true);
    expect(grid.voxels.some((voxel: any) => voxel.fluid.O2 === 2)).toBe(true);

    fortressStep('evaporate');
    const vadose = grid.voxels.filter((voxel: any) =>
      sim.conditions.ringWaterState(voxel.ringIdx, sim.wall_state.ring_count) === 'vadose');
    expect(vadose.length).toBeGreaterThan(0);
    expect(vadose.every((voxel: any) => voxel.fluid.O2 >= 1.5)).toBe(true);
    expect(vadose.some((voxel: any) => voxel.fluid.O2 === 1.5)).toBe(true);
    expect(sim.conditions.fluid.O2).toBe(2);
  });

  it('does not invent, delete, or ambiguously re-valence sulfur in legacy Creative shortcuts', () => {
    _fortressBeginCustomFromParams({
      temp: 120,
      pressure: 0.5,
      fluidParams: {
        S: 100,
        S_sulfide: 30,
        S_sulfate: 60,
        S_elemental: 10,
        sulfurPoolsExplicit: true,
        sulfateInherited: true,
        nativeSulfurPathway: 'oxidative_interface',
        pH: 6.5,
      },
      wallOpts: {
        composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50,
        wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000,
      },
      conditionOpts: {}, scenarioOpts: {}, initialWaterTablePct: 100,
      presetLabel: 'GAME-02 explicit sulfur shortcut control',
    }, 26715);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const sulfurProjection = () => ({
      bulk: ['S', 'S_sulfide', 'S_sulfate', 'S_elemental'].map(
        key => sim.conditions.fluid[key],
      ),
      authority: {
        sulfurPoolsExplicit: sim.conditions.fluid.sulfurPoolsExplicit,
        sulfateInherited: sim.conditions.fluid.sulfateInherited,
        nativeSulfurPathway: sim.conditions.fluid.nativeSulfurPathway,
      },
      voxels: grid.voxels.map((voxel: any) => ({
        values: ['S', 'S_sulfide', 'S_sulfate', 'S_elemental'].map(
          key => voxel.fluid[key],
        ),
        sulfurPoolsExplicit: voxel.fluid.sulfurPoolsExplicit,
        sulfateInherited: voxel.fluid.sulfateInherited,
        nativeSulfurPathway: voxel.fluid.nativeSulfurPathway,
      })),
    });
    const initial = sulfurProjection();
    for (const action of ['evaporate', 'brine', 'copper', 'oxidize']) {
      fortressStep(action);
      expect(sulfurProjection(), `${action} must not create an uncited sulfur boundary`).toEqual(initial);
    }
    expect(sim._sulfurBoundaryImportsPpm).toBe(0);
    expect(sim._sulfurBoundaryExportsPpm).toBe(0);
    expect(sim._sulfurBoundaryTransactions).toEqual([]);
  });

  it('rolls a multi-coordinate fluid action back when one coordinate lacks a declared law', () => {
    fortressBeginFromScenario('amethyst_geode', 26716);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const fluid = sim.conditions.fluid;
    const originalAddReactiveSilica = fluid.addReactiveSilica;
    const beforeBulk = {
      SiO2: fluid.SiO2, reactiveSilicaFraction: fluid.reactiveSilicaFraction,
      Al: fluid.Al, Ti: fluid.Ti, Fe: fluid.Fe,
    };
    const beforeSpatial = grid.voxels.map((voxel: any) => ({
      SiO2: voxel.fluid.SiO2,
      reactiveSilicaFraction: voxel.fluid.reactiveSilicaFraction,
      Al: voxel.fluid.Al, Ti: voxel.fluid.Ti, Fe: voxel.fluid.Fe,
    }));
    // Hostile substitute: the visible Silica verb is allowed to change its
    // declared SiO2/reactive-silica/Al/Ti coordinates, not to smuggle Fe into
    // the same action. Preflight must restore even the legitimate coordinates.
    fluid.addReactiveSilica = function(amount: number) {
      this.SiO2 += amount;
      this.Fe += 1;
    };
    expect(() => fortressStep('silica')).toThrow(/changed undeclared field fluid\.Fe/);
    fluid.addReactiveSilica = originalAddReactiveSilica;
    expect({
      SiO2: fluid.SiO2, reactiveSilicaFraction: fluid.reactiveSilicaFraction,
      Al: fluid.Al, Ti: fluid.Ti, Fe: fluid.Fe,
    }).toEqual(beforeBulk);
    expect(grid.voxels.map((voxel: any) => ({
      SiO2: voxel.fluid.SiO2,
      reactiveSilicaFraction: voxel.fluid.reactiveSilicaFraction,
      Al: voxel.fluid.Al, Ti: voxel.fluid.Ti, Fe: voxel.fluid.Fe,
    }))).toEqual(beforeSpatial);
    expect(_liveSaveActiveRecord().actions).toEqual([]);
    expect(sim._playerActionReceipts ?? []).toEqual([]);
  });

  it('fails a partially drained carbonate Replenish atomically and replays the refusal', () => {
    fortressBeginFromScenario('amethyst_geode', 26711);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    fortressStep('silica');
    fortressStep('drain');
    const drainedRing = sim.conditions.fluid_surface_ring;
    expect(drainedRing).toBe(sim.wall_state.ring_count - 2);
    expect(grid.voxels.every((voxel: any) => voxel.fluid.SiO2 === 720)).toBe(true);
    expect(_fortressInitialFluidRecipeFor(sim).SiO2).toBe(320);

    fortressStep('replenish');
    expect(sim.conditions.fluid_surface_ring).toBe(drainedRing);
    expect(sim.conditions.fluid.SiO2).toBe(720);
    expect(grid.voxels.every((voxel: any) => voxel.fluid.SiO2 === 720)).toBe(true);
    expect(sim._fluidBoundaryTransactions).toEqual([]);
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      ok: false,
      kind: 'spatial_boundary_unsupported',
      error: 'partially_flooded_boundary_deferred',
    });
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 drained replenish branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);

    // The same physical boundary applies without a carbonate ledger: a
    // partially drained non-carbonate run must not replace hidden vadose
    // stores merely because no carbonate authority was present to refuse it.
    fortressReset();
    fortressBeginFromScenario('cooling', 26713);
    const nonCarbonate = _liveFortressSim();
    const nonCarbonateGrid = nonCarbonate.wall_state.voxelGridFor(nonCarbonate);
    fortressStep('drain');
    const beforeFluids = nonCarbonateGrid.voxels.map((voxel: any) => voxel.fluid.SiO2);
    fortressStep('replenish');
    expect(nonCarbonateGrid.voxels.map((voxel: any) => voxel.fluid.SiO2)).toEqual(beforeFluids);
    expect(nonCarbonate._fluidBoundaryTransactions).toEqual([]);
  });

  it('binds player-action testimony into deterministic replay identity', () => {
    fortressBeginFromScenario('cooling', 26703);
    fortressStep('heat');
    const sim = _liveFortressSim();
    const authentic = simulationStateFingerprint(sim);
    sim._playerActionReceipts[0] = {
      ...sim._playerActionReceipts[0],
      applied_delta: 24,
    };
    expect(simulationStateFingerprint(sim)).not.toBe(authentic);
  });

  it('coalesces a dragged movement-owned broth control and replays its final choice', () => {
    fortressBeginFromScenario('cooling', 26704);
    const sim = _liveFortressSim();
    setBrothValue('temp', '190');
    setBrothValue('temp', '205');
    expect(sim._playerActionReceipts).toEqual([
      expect.objectContaining({
        schema: 'player-movement-intervention-v1',
        action: 'broth-temp',
        field: 'temperature',
        value_before: 180,
        value_after: 205,
        applied_delta: 25,
        movement_authority: expect.objectContaining({
          offset_before: 0,
          offset_after: 25,
        }),
      }),
    ]);
    fortressStep('wait');
    expect(sim.conditions.temperature).toBeGreaterThan(204);
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 coalesced temperature branch');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(sim._playerActionReceipts);
  });

  it('does not coalesce broth testimony across an intervening same-step action cursor', () => {
    fortressBeginFromScenario('cooling', 26706);
    const sim = _liveFortressSim();
    setBrothValue('temp', '190');
    fortressStep('heat');
    setBrothValue('temp', '205');
    expect(sim._playerActionReceipts.map((row: any) => ({
      action: row.action,
      cursor: row.action_cursor,
      before: row.movement_authority.offset_before,
      after: row.movement_authority.offset_after,
    }))).toEqual([
      { action: 'broth-temp', cursor: 0, before: 0, after: 10 },
      { action: 'heat', cursor: 0, before: 10, after: 35 },
      { action: 'broth-temp', cursor: 1, before: 35, after: 25 },
    ]);
    fortressStep('wait');
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 cursor-separated controls');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(sim._playerActionReceipts);
  });

  it('carries field authority through clear and newly scheduled same-field movements', () => {
    fortressBeginFromScenario('cooling', 26707);
    const sim = _liveFortressSim();
    fortressStep('heat');
    fortressStep('clear_movements');
    fortressStep('schedule_movement', {
      field: 'temperature', operator: 'trend', duration: 20, delay: 0,
      value: 0, origin: 'global',
    });
    expect(sim._movements._state[0].playerOffset).toBe(25);
    fortressStep('heat');
    expect(sim._playerActionReceipts.map((row: any) => ({
      cursor: row.action_cursor,
      source: row.movement_authority.movement_source,
      before: row.movement_authority.offset_before,
      after: row.movement_authority.offset_after,
    }))).toEqual([
      { cursor: 0, source: 'authored-scenario', before: 0, after: 25 },
      { cursor: 3, source: 'player-scheduled', before: 25, after: 50 },
    ]);
    fortressStep('wait');
    expect(sim.conditions.temperature).toBeCloseTo(230, 10);
    const beforeReplay = simulationStateFingerprint(sim);
    const manual = _saveManualNamed('GAME-02 dynamic movement authority');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(simulationStateFingerprint(_liveFortressSim())).toBe(beforeReplay);
    expect(_liveFortressSim()._playerActionReceipts).toEqual(sim._playerActionReceipts);
  });

  it('labels a first-action scheduled movement as player authority, not authored geology', () => {
    fortressBeginFromScenario('cooling', 26708);
    const sim = _liveFortressSim();
    expect(sim._movements).toBeFalsy();
    fortressStep('schedule_movement', {
      field: 'temperature', operator: 'trend', duration: 20, delay: 0,
      value: 0, origin: 'global',
    });
    expect(sim._movements._movementSources).toEqual([
      'authored-scenario', 'player-scheduled',
    ]);
    fortressStep('heat');
    expect(sim._playerActionReceipts.at(-1)?.movement_authority).toMatchObject({
      movement_index: 1,
      movement_source: 'player-scheduled',
    });
    const authentic = simulationStateFingerprint(sim);
    sim._movements._movementSources[1] = 'authored-scenario';
    expect(simulationStateFingerprint(sim)).not.toBe(authentic);
  });

  it('fails closed before replay when the saved scientific model digest is tampered', () => {
    fortressBeginFromScenario('cooling', 424243);
    fortressStep('wait');
    const manual = _saveManualNamed('tampered model identity');
    const records = loadSaves();
    const stored = records.find((r: any) => r.id === manual.id);
    stored.model_digest = 'tampered-model-digest';
    stored.recipe_digest = _saveRecipeDigest(stored);
    expect(persistSaves(records)).toBe(true);

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
    stored.recipe_digest = _saveRecipeDigest(stored);
    expect(persistSaves(records)).toBe(true);

    fortressReset();
    expect(loadSaveById(manual.id)).toBe(false);
    expect(_liveFortressSim()).toBeNull();
  });

  it('fails closed when deterministic replay does not reproduce the saved state digest', () => {
    fortressBeginFromScenario('cooling', 424245);
    fortressStep('wait');
    const manual = _saveManualNamed('tampered replay state');
    const records = loadSaves();
    const stored = records.find((record: any) => record.id === manual.id);
    stored.replay_state_digest = 'f'.repeat(64);
    stored.recipe_digest = _saveRecipeDigest(stored);
    expect(persistSaves(records)).toBe(true);

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
      const grid = sim.wall_state.voxelGridFor(sim);
      const beforePH = sim.conditions.fluid.pH;
      const beforeDIC = sim.conditions.fluid.CO3;
      fortressStep(action);
      expect(sim._carbonateBoundaryState.transactions.at(-1), action).toMatchObject({
        ok: true, kind: 'ph_titration',
      });
      expect(sim.conditions.fluid.pH, action).not.toBe(beforePH);
      expect(sim.conditions.fluid.CO3, action).not.toBe(beforeDIC);
      // Breadcrumb: 97's carbonate titration replaces both coordinates in
      // 85c before the generic GAME-02 action audit runs. The action contract
      // must therefore declare and re-authenticate pH and DIC together; a
      // pH-only declaration would make the fail-closed bridge reject CO3.
      expect(grid.voxels.every((voxel: any) =>
        voxel.fluid.pH === sim.conditions.fluid.pH), action).toBe(true);
      expect(grid.voxels.every((voxel: any) =>
        voxel.fluid.CO3 === sim.conditions.fluid.CO3), action).toBe(true);
      fortressStep('wait');
      expect(sim._carbonateBoundaryState.blocked, action).toBe(false);
      expect(sim._carbonateBoundaryState.transactions.some((tx: any) =>
        tx.error === 'unreceipted_DIC_change')).toBe(false);
    }
  });

  it('rolls back carbonate solver testimony when coupled pH/DIC spatial closure fails', () => {
    ensureCarbonBoundaryControls();
    fortressBeginFromScenario('tutorial_travertine', 26719);
    const sim = _liveFortressSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const beforeFingerprint = simulationStateFingerprint(sim);
    const beforeBoundary = structuredClone(sim._carbonateBoundaryState);
    const beforeRingFluids = structuredClone(sim.ring_fluids);
    const originalReplace = sim._replaceFullyMixedCarbonateFluid;
    sim._replaceFullyMixedCarbonateFluid = function() {
      const oldCO3 = grid.voxels[0].fluid.CO3;
      const result = originalReplace.call(this);
      // Hostile partial-write substitute: production installed the coupled
      // solution everywhere except one canonical pore-fluid address.
      grid.voxels[0].fluid.CO3 = oldCO3;
      return result;
    };

    expect(() => fortressStep('tweak_acidify')).toThrow(/unauthenticated partial spatial write/);
    sim._replaceFullyMixedCarbonateFluid = originalReplace;
    expect(simulationStateFingerprint(sim)).toBe(beforeFingerprint);
    expect(sim._carbonateBoundaryState).toEqual(beforeBoundary);
    expect(sim.ring_fluids).toEqual(beforeRingFluids);
    expect(sim.conditions._carbonateBoundaryState).toBe(sim._carbonateBoundaryState);
    expect(_liveSaveActiveRecord().actions).toEqual([]);

    fortressStep('wait');
    expect(sim._carbonateBoundaryState.blocked).toBe(false);
    expect(sim._carbonateBoundaryState.transactions.some((tx: any) =>
      tx.error === 'unreceipted_DIC_change')).toBe(false);
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
    const sim = beginFastCollectableRun();
    const grown = grownCount(sim);
    expect(grown).toBeGreaterThan(0); // commissioned first-crystal tutorial grows quartz at step 1
    const grownCrystals = sim.crystals.filter((c: any) =>
      (c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0);

    // First prove that a specimen collected before narration is bound to its
    // existing Library id rather than staged a second time.
    const collisionTarget = grownCrystals[0];
    const collisionTargetIdx = sim.crystals.indexOf(collisionTarget);
    const preCollectedRecord = buildCrystalRecord(collisionTarget, {
      mode: 'creative',
      run_id: _liveSaveActiveRecord().run_id,
      crystal_index: collisionTargetIdx,
    });
    preCollectedRecord.id = 'pre-collected-projection';
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([preCollectedRecord]));
    collisionTarget._collectedRecordId = preCollectedRecord.id;
    const preCollectedTx = _saveBuildFinishTransaction();
    expect(preCollectedTx.library_records.some((record: any) => record.id === preCollectedRecord.id)).toBe(false);
    expect(preCollectedTx.collected).toContainEqual([collisionTargetIdx, preCollectedRecord.id]);

    // Force both legacy entropy inputs to collide, and occupy the transaction's
    // first deterministic candidate in the pre-existing Library. Allocation
    // must remain unique and advance deterministically to attempt 1.
    const collisionId = _saveFinishRecordIdCandidate(
      _liveSaveActiveRecord().run_id,
      collisionTargetIdx,
      0,
    );
    collisionTarget._collectedRecordId = null;
    preCollectedRecord.id = collisionId;
    preCollectedRecord.name = 'Existing collision sentinel';
    preCollectedRecord.source.run_id = 'unrelated-run';
    preCollectedRecord.source.crystal_index = 999;
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([preCollectedRecord]));

    const now = vi.spyOn(Date, 'now').mockReturnValue(1_786_700_000_000);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      fortressFinish();
    } finally {
      now.mockRestore();
      random.mockRestore();
    }

    // Collected: every grown crystal is marked + in the Library.
    for (const c of sim.crystals) {
      if ((c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0) {
        expect(c._collectedRecordId).toBeTruthy();
      }
    }
    expect(loadCrystals().length).toBe(grown + 1); // plus the pre-existing collision sentinel

    // Saved: the autosave sealed as finished.
    const saves = loadSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].status).toBe('finished');
    expect(saves[0].collected.length).toBe(grown);
    const collisionPair = saves[0].collected.find((pair: any) => pair[0] === collisionTargetIdx);
    expect(collisionPair[1]).toBe(_saveFinishRecordIdCandidate(
      saves[0].run_id,
      collisionTargetIdx,
      1,
    ));

    // Scored: the lifetime counters moved.
    const stats = loadLifetimeStats();
    expect(stats.crystals_collected).toBe(grown);
    expect(stats.runs_finished).toBe(1);

    // Idempotence: a second click must not double anything.
    fortressFinish();
    expect(loadCrystals().length).toBe(grown + 1);
    expect(loadLifetimeStats().runs_finished).toBe(1);

    // Library names are player-owned labels, not scientific state. Renaming
    // both the staged specimen and an unrelated baseline specimen must not
    // invalidate the finished save or be undone by its authenticated replay.
    const prompt = vi.spyOn(window, 'prompt');
    try {
      prompt.mockReturnValueOnce('Renamed staged quartz');
      renameCollectedCrystal(collisionPair[1]);
      prompt.mockReturnValueOnce('Renamed baseline sentinel');
      renameCollectedCrystal(collisionId);
    } finally {
      prompt.mockRestore();
    }
    expect(loadSaveById(saves[0].id)).toBe(true);
    const renamed = new Map(loadCrystals().map(record => [record.id, record.name]));
    expect(renamed.get(collisionPair[1])).toBe('Renamed staged quartz');
    expect(renamed.get(collisionId)).toBe('Renamed baseline sentinel');
    expect(loadLifetimeStats()).toEqual(stats);
  });

  it('journals Creative Collect across save/stats denial and manual branching without duplicating specimen or score', () => {
    beginFastCollectableRun();
    const original = _liveSaveActiveRecord();
    const originalId = original.id;
    const runId = original.run_id;
    const targetIdx = _liveFortressSim().crystals.findIndex((crystal: any) =>
      (crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0);
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Journaled tutorial quartz');
    const nativeSetItem = Storage.prototype.setItem;

    // A denied save WAL must move neither Library nor lifetime state. The
    // in-memory receipt may exist, but a crash/reset returns to the last
    // durable recipe with no phantom collection.
    const denySave = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-saves-v1.pending') {
        throw new DOMException('simulated collection WAL denial', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      collectFromFortress(targetIdx, null);
      expect(_liveSaveActiveRecord().collection_receipts).toHaveLength(1);
      expect(loadCrystals()).toEqual([]);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });

      // Authentication is bound to the immutable receipt bytes, not merely
      // the object identity that happened to pass once. Rehashing the same
      // object after authentication must not acquire authority.
      const heldReceipt = _liveSaveActiveRecord().collection_receipts[0];
      const originalName = heldReceipt.record.name;
      const originalDigest = heldReceipt.digest;
      heldReceipt.record.name = `${originalName} forged`;
      heldReceipt.digest = _saveCollectionReceiptDigest(heldReceipt);
      expect(_saveApplyCreativeCollectionReceipts(_liveSaveActiveRecord())).toMatchObject({ ok: false });
      expect(loadCrystals()).toEqual([]);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
      heldReceipt.record.name = originalName;
      heldReceipt.digest = originalDigest;
    } finally {
      denySave.mockRestore();
    }

    fortressReset();
    expect(loadSaveById(originalId)).toBe(true);
    expect(_liveSaveActiveRecord()).toMatchObject({ id: originalId, run_id: runId });
    expect(_liveSaveActiveRecord().collection_receipts).toEqual([]);

    // Once the WAL is durable, a denied stats write may leave the Library
    // ahead temporarily; reset/load must finish the same receipt exactly once.
    const denyStats = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'vugg-stats-v1') {
        throw new DOMException('simulated collection stats denial', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    try {
      collectFromFortress(targetIdx, null);
      expect(_liveSaveActiveRecord().collection_receipts).toHaveLength(1);
      expect(_liveSaveActiveRecord().collected).toHaveLength(1);
      expect(loadCrystals()).toHaveLength(1);
      expect(loadLifetimeStats()).toEqual({ crystals_collected: 0, runs_finished: 0 });
    } finally {
      denyStats.mockRestore();
    }

    const specimenId = loadCrystals()[0].id;
    for (let i = 0; i < 3; i++) fortressStep('wait');

    // Retry after the crystal has grown must resume its existing lineage WAL,
    // not mint a second receipt from the later science projection.
    collectFromFortress(targetIdx, null);
    expect(_liveSaveActiveRecord().collection_receipts).toHaveLength(1);
    expect(loadCrystals()).toHaveLength(1);
    expect(loadCrystals()[0].id).toBe(specimenId);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 0 });

    const manual = _saveManualNamed('Collection branch');
    expect(manual).toMatchObject({ kind: 'manual', run_id: runId });
    expect(manual.id).not.toBe(originalId);

    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    const branch = _liveSaveActiveRecord();
    expect(branch).toMatchObject({ kind: 'auto', run_id: runId });
    expect(branch.id).not.toBe(manual.id);
    expect(_liveFortressSim().crystals[targetIdx]._collectedRecordId).toBe(specimenId);
    expect(loadCrystals()).toHaveLength(1);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 0 });

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      deleteCollectedCrystal(specimenId);
    } finally {
      confirm.mockRestore();
    }
    expect(loadCrystals()).toEqual([]);
    fortressReset();
    expect(loadSaveById(branch.id)).toBe(true);
    expect(_liveFortressSim().crystals[targetIdx]._collectedRecordId).toBe(specimenId);
    expect(loadCrystals()).toEqual([]); // completed WAL does not undo product deletion
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 0 });

    fortressFinish();
    const finished = loadSaves().find(record => record.id === branch.id);
    expect(finished).toMatchObject({ status: 'finished', run_id: runId });
    expect(finished.collected).toEqual([]);
    expect(loadCrystals()).toEqual([]);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 1 });

    fortressFinish();
    expect(loadCrystals()).toEqual([]);
    expect(loadLifetimeStats()).toEqual({ crystals_collected: 1, runs_finished: 1 });
    prompt.mockRestore();
  });

  it('preserves an uncollected pre-run-id v2 recipe without promoting it into the v3 event epoch', () => {
    const legacy = minimalSave('safe-v2-import', { format: 2, kind: 'auto' });
    delete legacy.run_id;
    delete legacy.collection_epoch;
    delete legacy.collection_receipts;
    legacy.recipe_digest = _saveRecipeDigest(legacy);
    expect(persistSaves([legacy])).toBe(true);

    expect(loadSaveById(legacy.id)).toBe(false);
    expect(_liveSaveActiveRecord()).toBeNull();
    expect(loadSaves().find(record => record.id === legacy.id)).toMatchObject({
      format: 2,
      collected: [],
    });
  });

  it('a finished save restores as a finished run (re-narrated, nothing re-collected or re-counted)', () => {
    beginFastCollectableRun();
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
    beginFastCollectableRun();
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
    beginFastCollectableRun();
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
    beginFastCollectableRun();
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
