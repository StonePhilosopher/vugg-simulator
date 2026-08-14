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
declare function fortressStep(action: string, payload?: any): void;
declare function fortressFinish(): void;
declare function fortressReset(): void;
declare function setFortressInstantLines(v: boolean): void;
declare function _liveFortressSim(): any;
declare function _liveFortressActive(): boolean;
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
    expect(_saveReplayCompatibility(records[1])).toEqual({ ok: true, reason: '' });

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
      .toEqual({ ok: true, reason: '' });
  });

  it('preserves but refuses a rehashed v3-to-v2 downgrade with an unreceipted collection map', () => {
    const modern = minimalSave('no-downgrade');
    modern.format = 2;
    modern.collected = [[0, 'forged-pre-event-specimen']];
    delete modern.run_id;
    delete modern.collection_epoch;
    delete modern.collection_receipts;
    modern.recipe_digest = _saveRecipeDigest(modern);

    expect(_saveReplayCompatibility(modern)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/pre-event collection mappings.*replay is blocked/i),
    });
    expect(persistSaves([modern])).toBe(true);
    expect(loadSaves()).toHaveLength(1);
    expect(_saveReplayCompatibility(loadSaves()[0])).toMatchObject({ ok: false });
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
    localStorage.setItem('vugg-saves-v1', generationOne as string);
    localStorage.setItem('vugg-saves-v1.pending', generationTwo as string);
    localStorage.removeItem('vugg-saves-v1.backup');

    expect(loadSaves().map(record => record.id)).toEqual(['first', 'second']);
    expect(localStorage.getItem('vugg-saves-v1.pending')).toBeNull();
    expect(JSON.parse(localStorage.getItem('vugg-saves-v1') as string).generation).toBe(2);
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
    const existingRaw = JSON.stringify([{ id: 'existing-specimen', mineral: 'quartz', name: 'Existing' }]);
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
    expect(loadCrystals()).toEqual([{ id: 'existing-specimen', mineral: 'quartz', name: 'Existing' }]);
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
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
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
    expect(grown).toBeGreaterThan(0); // commissioned Herkimer cooling grows one large quartz
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
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const original = _liveSaveActiveRecord();
    const originalId = original.id;
    const runId = original.run_id;
    const targetIdx = _liveFortressSim().crystals.findIndex((crystal: any) =>
      (crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0);
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Journaled Herkimer quartz');
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

  it('one-way migrates only an uncollected pre-run-id v2 recipe into the v3 event epoch', () => {
    const legacy = minimalSave('safe-v2-import', { format: 2, kind: 'auto' });
    delete legacy.run_id;
    delete legacy.collection_epoch;
    delete legacy.collection_receipts;
    legacy.recipe_digest = _saveRecipeDigest(legacy);
    expect(persistSaves([legacy])).toBe(true);

    expect(loadSaveById(legacy.id)).toBe(true);
    expect(_liveSaveActiveRecord()).toMatchObject({
      id: legacy.id,
      run_id: legacy.id,
      format: 3,
      collection_epoch: 'event-cursor-v1',
      collection_receipts: [],
      collected: [],
    });
    expect(loadSaves().find(record => record.id === legacy.id)).toMatchObject({
      format: 3,
      run_id: legacy.id,
      collection_epoch: 'event-cursor-v1',
    });
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
