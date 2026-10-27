import { describe, expect, it } from 'vitest';

declare const Crystal: any, GrowthZone: any, StripRecorder: any, VugSimulator: any, SCENARIOS: any, setSeed: any;
declare const recordQuartzFormObservations: any, quartzFormObservationAtStep: any;
declare const stripSerialize: any, stripDeserialize: any, stripValidateDatasetShape: any;
declare const stripStoredRecordFromDataset: any, stripDatasetFromStoredRecord: any;
declare const stripDatasetFromAuthenticatedStoredRecord: any, stripDurableDatasetDigest: any;
declare const stripImportedStorageKey: any, stripStoredRecordOrigin: any, stripStorageOriginEligible: any;
declare const stripValidateQuartzFormTestimony: any, STRIP_QUARTZ_FORM_LIMITS: any;

const copy = (v: any) => JSON.parse(JSON.stringify(v));
function specimen(id: number | string = 41) {
  const c = new Crystal({ crystal_id: id, mineral: 'quartz', habit: 'prismatic', nucleation_step: 0 });
  const z = new GrowthZone({ step: 1, temperature: 100, thickness_um: 100, growth_rate: 1 });
  z._time_scaled = true; c.add_zone(z); return c;
}
function simulator(c: any, step = 1) {
  return { step, crystals: [c], wall_state: { ring_count: 1, cells_per_ring: 1 },
    conditions: { temperature: 100, pressure: 0.001,
      _scenario: { id: 'quartz-history-control', duration_steps: 1 } } };
}
function fixture(step = 1, id: number | string = 41) {
  const c = specimen(id), sim = simulator(c, step);
  recordQuartzFormObservations(sim);
  const recorder = new StripRecorder(sim, { angular_indices: 1, duration_steps: 1 });
  return { c, sim, recorder };
}
function dataset(step = 1) {
  const { sim, recorder } = fixture(step); recorder.captureStep(sim); return recorder.finalize();
}
function bounds(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let at = 0;
  for (let i = 0; i < 3; i++) at += 4 + view.getUint32(at, true);
  return { at, length: view.getUint32(at, true) };
}
function mutateBinary(bytes: Uint8Array, mutate: (t: any) => void) {
  const { at, length } = bounds(bytes);
  const t = JSON.parse(new TextDecoder().decode(bytes.subarray(at + 4, at + 4 + length)));
  mutate(t); const section = new TextEncoder().encode(JSON.stringify(t));
  const result = new Uint8Array(bytes.length - length + section.length);
  result.set(bytes.subarray(0, at)); new DataView(result.buffer).setUint32(at, section.length, true);
  result.set(section, at + 4); result.set(bytes.subarray(at + 4 + length), at + 4 + section.length);
  return result;
}

describe('strip quartz form observations — persistence B', () => {
  it('captures exact finalized states including zero-growth changes, null and removal, without changing old captures', () => {
    const { c, sim, recorder } = fixture(1, 'source-quartz');
    recorder.captureStep(sim);
    const first = recorder.latestQuartzForms.get('source-quartz'), original = JSON.stringify(first);
    c.twinned = true; c.twin_law = 'Dauphiné'; c._polymorph = 'beta'; c._gwindel = null;
    sim.step = 2; recordQuartzFormObservations(sim); recorder.captureStep(sim);
    c._polymorph = null; delete c._gwindel; c._split = {};
    sim.step = 3; recordQuartzFormObservations(sim); recorder.captureStep(sim);
    const ds = recorder.finalize(), row = ds.quartz_form_testimony[0];
    expect(row).toMatchObject({ schema: 'strip-quartz-form-observations-v1', crystal_id: 'source-quartz', captured_step: 3, sample_index: 2 });
    expect(row.history).toEqual(c._quartzFormHistory);
    expect(row.zones).toEqual([{ zone_index: 0, step: 1 }]);
    expect(row.history.changes[0].snapshot._gwindel).toBeNull();
    expect(row.history.changes[1].snapshot).not.toHaveProperty('_gwindel');
    expect(row.history.changes[1].snapshot).toMatchObject({ _polymorph: null, split_presence: 'present' });
    expect(JSON.stringify(first)).toBe(original);
    expect(Object.isFrozen(row.history.initial.snapshot.dominant_forms)).toBe(true);
    expect(() => { row.zones[0].step = 8; }).toThrow();
    const saved = JSON.stringify(row); c.habit = 'future form'; c.zones[0].step = 99;
    expect(JSON.stringify(row)).toBe(saved);
  });

  it('round-trips all observations and source IDs through binary and authenticated storage codecs', async () => {
    const ds = dataset(), bytes = await stripSerialize(ds, false);
    const decoded = await stripDeserialize(bytes), stored = stripStoredRecordFromDataset(decoded);
    stored.dataset_digest_sha256 = await stripDurableDatasetDigest(decoded);
    const loaded = await stripDatasetFromAuthenticatedStoredRecord(stored);
    expect(loaded.quartz_form_testimony).toEqual(ds.quartz_form_testimony);
    expect(Object.isFrozen(decoded.quartz_form_testimony[0].history)).toBe(true);
    expect(Object.isFrozen(loaded.quartz_form_testimony[0].zones)).toBe(true);
    expect(await stripSerialize(loaded, false)).toEqual(bytes);
    const erased = { ...stored }; delete erased.quartz_form_testimony;
    await expect(stripDatasetFromAuthenticatedStoredRecord(erased)).rejects.toThrow(/digest mismatch/);
  });

  it('keeps structurally valid self-rehashed files in the imported evidence domain', async () => {
    const ds = dataset(); ds.quartz_form_testimony = copy(ds.quartz_form_testimony);
    ds.quartz_form_testimony[0].history.initial.snapshot.habit = 'plausible but invented';
    const imported = await stripDeserialize(await stripSerialize(ds, false));
    const record = stripStoredRecordFromDataset(imported, 'imported-file');
    record.dataset_digest_sha256 = await stripDurableDatasetDigest(imported);
    record.key = stripImportedStorageKey(record.manifest, record.dataset_digest_sha256);
    expect((await stripDatasetFromAuthenticatedStoredRecord(record)).quartz_form_testimony).toEqual(ds.quartz_form_testimony);
    expect(stripStoredRecordOrigin(record)).toBe('imported-file');
    expect(stripStorageOriginEligible(stripStoredRecordOrigin(record))).toBe(false);
    // A self-hash supplies integrity, not regenerated producer authentication.
  });

  it('keeps actual simulator steps separate from sample indices and retains closed unsupported prefixes', async () => {
    const late = dataset(100), row = late.quartz_form_testimony[0];
    expect(row).toMatchObject({ captured_step: 100, sample_index: 0 });
    expect(row.history.initial.step).toBe(100);
    expect((await stripDeserialize(await stripSerialize(late, false))).quartz_form_testimony).toEqual(late.quartz_form_testimony);
    for (const unsupported of [false, true]) {
      const { c, sim, recorder } = fixture();
      if (unsupported) c.mineral = 'chalcedony'; else c.habit = 'later unknown';
      sim.step = unsupported ? 2 : 3; recordQuartzFormObservations(sim);
      // The accepted prefix is valid even though later live state differs.
      recorder.captureStep(sim);
      const saved = (await stripDeserialize(await stripSerialize(recorder.finalize(), false))).quartz_form_testimony[0];
      expect(saved.history.unavailable.reason).toBe(unsupported ? 'unsupported-mineral' : 'observation-gap');
      expect(saved.history.observed_through_step).toBe(1);
      const source = { crystal_id: saved.crystal_id, _quartzFormHistory: saved.history, zones: saved.zones };
      expect(quartzFormObservationAtStep(source, 1).snapshot.habit).toBe('prismatic');
      expect(quartzFormObservationAtStep(source, 2).status).toBe('unavailable');
      expect(quartzFormObservationAtStep({ ...source, crystal_id: 'wrong-source' }, 1))
        .toMatchObject({ status: 'unavailable', reason: 'source-identity-mismatch' });
    }
  });

  it('preserves absent history and exact prior testimony bytes rather than inventing observations', async () => {
    const c = specimen(), sim = simulator(c), recorder = new StripRecorder(sim, { angular_indices: 1, duration_steps: 1 });
    recorder.captureStep(sim); const ds = recorder.finalize();
    expect(c).not.toHaveProperty('_quartzFormHistory'); expect(ds).not.toHaveProperty('quartz_form_testimony');
    const bytes = await stripSerialize(ds, false), { at, length } = bounds(bytes);
    const oldKeys = ['pressure_phase','stress_event','transformation_event','carbonate_boundary','sulfur_ledger',
      'fluid_boundary','enclosure','player_action','layer_growth','habit_morphology'].map(k => k + '_testimony');
    const prior = Object.fromEntries(oldKeys.map(k => [k, ds[k] || []]));
    if (ds.surface_history_testimony !== undefined) prior.surface_history_testimony = ds.surface_history_testimony;
    expect(new TextDecoder().decode(bytes.subarray(at + 4, at + 4 + length))).toBe(JSON.stringify(prior));
    expect(await stripSerialize(await stripDeserialize(bytes), false)).toEqual(bytes);
    expect(stripDatasetFromStoredRecord(stripStoredRecordFromDataset(ds))).not.toHaveProperty('quartz_form_testimony');
    for (const version of [1, 2, 3, 4, 5]) {
      expect(await stripDeserialize(await stripSerialize({ ...ds, manifest: { ...ds.manifest, format_version: version } }, false)))
        .not.toHaveProperty('quartz_form_testimony');
    }
  });

  it('rejects malformed, duplicate, future and contradictory imported coordinates at both boundaries', async () => {
    const ds = dataset(), bytes = await stripSerialize(ds, false);
    for (const mutate of [
      (t: any) => t.quartz_form_testimony = null,
      (t: any) => t.quartz_form_testimony.push(copy(t.quartz_form_testimony[0])),
      (t: any) => t.quartz_form_testimony[0].schema = 'unknown',
      (t: any) => t.quartz_form_testimony[0].history.source_crystal_id = 99,
      (t: any) => t.quartz_form_testimony[0].history.initial.zone_count = 0,
      (t: any) => t.quartz_form_testimony[0].history.observed_through_step = 2,
      (t: any) => t.quartz_form_testimony[0].history.changes.push(copy(t.quartz_form_testimony[0].history.initial)),
      (t: any) => t.quartz_form_testimony[0].history.unavailable = { reason: 'observation-gap', step: 2 },
      (t: any) => t.quartz_form_testimony[0].history.initial.snapshot._gwindel = { twistDeg: 999 },
      (t: any) => t.quartz_form_testimony[0].zones[0].zone_index = 1,
      (t: any) => t.quartz_form_testimony[0].zones[0].step = 2,
      (t: any) => t.quartz_form_testimony[0].zones = [],
      (t: any) => t.quartz_form_testimony[0].captured_step = 0,
      (t: any) => t.quartz_form_testimony[0].sample_index = 1,
      (t: any) => t.quartz_form_testimony[0].nucleation_step = 8,
      (t: any) => {
        const row = t.quartz_form_testimony[0]; row.nucleation_step = 8; row.zones = [];
        Object.assign(row.history, { initial: null, changes: [], observed_through_step: null,
          observed_zone_count: null, unavailable: { reason: 'invalid-descriptor', step: 1 } });
      },
      (t: any) => t.quartz_form_testimony[0].extra = 'unrecognized',
    ]) {
      await expect(stripDeserialize(mutateBinary(bytes, mutate))).rejects.toThrow(/quartz/);
      const raw = { ...ds, quartz_form_testimony: copy(ds.quartz_form_testimony) }; mutate(raw);
      expect(() => stripValidateDatasetShape(raw)).toThrow(/quartz/);
      const stored = stripStoredRecordFromDataset(raw); stored.dataset_digest_sha256 = '0'.repeat(64);
      await expect(stripDatasetFromAuthenticatedStoredRecord(stored)).rejects.toThrow(/quartz/);
    }
  });

  it('latches failures before and after witness capture, even when the outer caller catches them', () => {
    for (const kind of ['stale', 'identity', 'accessor', 'later-work']) {
      const { c, sim, recorder } = fixture(); recorder.captureStep(sim);
      sim.step = 2; recordQuartzFormObservations(sim);
      let getterCalls = 0;
      if (kind === 'stale') c.habit = 'unobserved';
      if (kind === 'identity') c.crystal_id = 99;
      if (kind === 'accessor') Object.defineProperty(c.zones[0], 'step', { get() { getterCalls++; return 1; }, configurable: true });
      if (kind === 'later-work') Object.defineProperty(sim, 'wall_state', { get() { throw Error('later capture read failed'); }, configurable: true });
      let failed = false;
      try { recorder.captureStep(sim); } catch { failed = true; }
      expect(failed).toBe(true); expect(getterCalls).toBe(0);
      expect(() => recorder.finalize()).toThrow(/capture failed/);
    }
    const c = specimen(); Object.defineProperty(c, '_quartzFormHistory', { value: undefined, configurable: true });
    const sim = simulator(c); recordQuartzFormObservations(sim); delete c._quartzFormHistory;
    const recorder = new StripRecorder(sim, { angular_indices: 1, duration_steps: 1 });
    expect(() => recorder.captureStep(sim)).toThrow(/quartz/);
    expect(() => recorder.finalize()).toThrow(/capture failed/);
  });

  it('checks known birth for open and closed histories while retaining genuinely unknown birth', async () => {
    for (const closed of [false, true]) {
      const { c, sim, recorder } = fixture();
      if (closed) { sim.step = 3; recordQuartzFormObservations(sim); }
      c.nucleation_step = 8;
      expect(() => recorder.captureStep(sim)).toThrow(/nucleation/);
      expect(() => recorder.finalize()).toThrow(/capture failed/);
      for (const birth of [null, undefined]) {
        c.nucleation_step = birth;
        const next = new StripRecorder(sim, { angular_indices: 1, duration_steps: 1 }); next.captureStep(sim);
        const ds = await stripDeserialize(await stripSerialize(next.finalize(), false));
        expect(ds.quartz_form_testimony[0].nucleation_step).toBe(birth);
      }
    }
  });

  it('leaves production simulation bookkeeping intact when its optional capture fails', () => {
    setSeed(42); const { conditions, events } = SCENARIOS.tutorial_first_crystal();
    const sim = new VugSimulator(conditions, events);
    const recorder = new StripRecorder(sim, { angular_indices: 1, duration_steps: 2 });
    sim._stripRecorder = recorder;
    // Inject a recorder-local failure after the first valid finalized sample.
    sim.run_step(); const step = sim.step, before = recorder.capturedSteps;
    recorder._captureQuartzForms = () => { throw Error('controlled persistence failure'); };
    expect(() => sim.run_step()).not.toThrow();
    expect(sim.step).toBe(step + 1); expect(recorder.capturedSteps).toBe(before);
    expect(() => recorder.finalize()).toThrow(/capture failed/);
    for (const c of sim.crystals.filter((c: any) => c.mineral === 'quartz')) {
      expect(c._quartzFormHistory.observed_through_step).toBe(sim.step);
    }
  });

  it('enforces aggregate witness and row bounds before whole-channel serialization', () => {
    expect(() => stripValidateQuartzFormTestimony(new Array(STRIP_QUARTZ_FORM_LIMITS.rows + 1), 1)).toThrow(/quartz/);
    const base = copy(dataset().quartz_form_testimony[0]);
    base.zones = Array.from({ length: 10_000 }, (_, zone_index) => ({ zone_index, step: 1 }));
    base.history.initial.zone_count = 10_000; base.history.observed_zone_count = 10_000;
    stripValidateQuartzFormTestimony([base], 1);
    const many = Array.from({ length: 51 }, (_, id) => ({ ...base, crystal_id: id, history: { ...base.history, source_crystal_id: id } }));
    expect(() => stripValidateQuartzFormTestimony(many, 1)).toThrow(/oversized/);
  });

  it('rejects excessive aggregate bytes even when every ledger and witness count fits', () => {
    const base = copy(dataset().quartz_form_testimony[0]);
    const snapshot = { ...base.history.initial.snapshot, dominant_forms: Array.from({ length: 16 }, () => 'x'.repeat(200)) };
    base.history.initial.snapshot = snapshot;
    base.history.changes = Array.from({ length: 63 }, (_, i) => ({ step: i + 2, zone_count: 1,
      snapshot: { ...snapshot, habit: 'observed-' + i } }));
    base.captured_step = 64; base.history.observed_through_step = 64;
    stripValidateQuartzFormTestimony([base], 1);
    const count = Math.floor(STRIP_QUARTZ_FORM_LIMITS.bytes / new TextEncoder().encode(JSON.stringify(base)).length) + 2;
    const many = Array.from({ length: count }, (_, id) => ({ ...base, crystal_id: id,
      history: { ...base.history, source_crystal_id: id } }));
    expect(count).toBeLessThan(STRIP_QUARTZ_FORM_LIMITS.rows);
    expect(count).toBeLessThan(STRIP_QUARTZ_FORM_LIMITS.zoneWitnesses);
    expect(() => stripValidateQuartzFormTestimony(many, 1)).toThrow(/oversized/);
  });
});
