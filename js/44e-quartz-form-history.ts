// Finalized-step observations of existing quartz classifiers, not face kinetics.
// Selective contract: proposals/QUARTZ-RECONCILIATION-2026-10-23.md.
// B preserves observations through versioned collections and strip testimony.
// C projects this ledger without changing growth, chemistry or RNG.
// v2 dates quartz topology scope without importing R7's general enclosure replay.
const QUARTZ_FORM_HISTORY_SCHEMA = 'quartz-form-observations-v2';
const QUARTZ_FORM_HISTORY_BASIS = 'simulator-state-at-finalized-step';
const QUARTZ_FORM_HISTORY_LIMITS = Object.freeze({
  recordsPerCrystal: 1024, bytesPerCrystal: 262144, bytesPerRun: 16777216,
  snapshotBytes: 8192,
});
type QuartzFormHistory = {
  schema: string; observation_basis: string; source_crystal_id: number | string;
  initial: any; changes: readonly any[]; observed_through_step: number | null;
  observed_zone_count: number | null;
  unavailable?: { reason: string; step: number };
};
type QuartzFormObserverState = {
  history: QuartzFormHistory; json: string | null; bytes: number;
  budget: {bytes: number};
};
const _quartzFormOwners = new WeakMap<object, QuartzFormObserverState>();
// Invalid identity or a sealed/occupied owner slot may prevent attaching a
// ledger at all. Latch that first failure privately; repair cannot erase it.
const _quartzFormUnownedFailures = new WeakMap<object, {reason: string; step: number}>();
const _quartzFormRunBudgets = new WeakMap<object, { bytes: number }>();
const _quartzFormEncoder = new TextEncoder();

function _quartzFormId(id: any): boolean {
  return (Number.isSafeInteger(id) && id >= 0)
    || (typeof id === 'string' && id.length > 0 && id.length <= 256);
}
function _quartzFormStep(step: any): boolean { return Number.isSafeInteger(step) && step >= 0; }
function _quartzFormPlain(value: any): boolean {
  return !!value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
// Observe data properties only. A getter is not scientific testimony and must
// not run arbitrary code during the finalized-step observation.
function _quartzFormValue(object: any, key: string): any {
  const d = Object.getOwnPropertyDescriptor(object, key);
  if (!d) {
    if (key in object) throw new Error('inherited descriptor');
    return undefined;
  }
  if (!('value' in d)) throw new Error('accessor descriptor');
  return d.value;
}
function _quartzFormFields(value: any, keys: string[]): void {
  if (!_quartzFormPlain(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error('descriptor fields');
  for (const key of keys) _quartzFormValue(value, key);
}
function _quartzFormFreeze(value: any): any {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) _quartzFormFreeze(v);
    Object.freeze(value);
  }
  return value;
}
function _quartzFormEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every(k => other.includes(k)
    && _quartzFormEqual(_quartzFormValue(a, k), _quartzFormValue(b, k)));
}
function _quartzFormZoneStep(zones: any[], index: number): any {
  const z = _quartzFormValue(zones, String(index));
  if (!z || typeof z !== 'object') throw new Error('zone entry');
  return _quartzFormValue(z, 'step');
}
function _quartzFormSnapshot(crystal: any, step: number): any {
  const out: any = { mineral: 'quartz' };
  const tilt=_quartzFormValue(crystal,'_nucTilt');
  if(tilt!==undefined){
    if(tilt===null)out._nucTilt=null;
    else{
      _quartzFormFields(tilt,['theta','azim']);
      const theta=_quartzFormValue(tilt,'theta'),azim=_quartzFormValue(tilt,'azim');
      if(!Number.isFinite(theta)||!Number.isFinite(azim))throw new Error('nucleation tilt');
      out._nucTilt={theta,azim};
    }
  }
  for(const key of ['enclosed_by','cdr_replaces_crystal_id']){
    const value=_quartzFormValue(crystal,key);
    if(value!==undefined){if(value!==null&&!_quartzFormId(value))throw new Error('topology identity');out[key]=value;}
  }
  for(const key of ['dissolved','perimorph_eligible']){
    const value=_quartzFormValue(crystal,key);
    if(value!==undefined){if(typeof value!=='boolean')throw new Error('topology flag');out[key]=value;}
  }
  for (const key of ['habit', 'twin_law', '_polymorph', 'mineral_display', 'growth_environment']) {
    const v = _quartzFormValue(crystal, key);
    if (v === undefined) continue;
    if (v !== null && (typeof v !== 'string' || v.length > 512)) throw new Error('descriptor text');
    out[key] = v;
  }
  const twinned = _quartzFormValue(crystal, 'twinned');
  if (twinned !== undefined) {
    if (twinned !== null && typeof twinned !== 'boolean') throw new Error('twin flag');
    out.twinned = twinned;
  }
  const forms = _quartzFormValue(crystal, 'dominant_forms');
  if (forms !== undefined) {
    if (forms === null) out.dominant_forms = null;
    else {
      if (!Array.isArray(forms) || forms.length > 32) throw new Error('form list');
      out.dominant_forms = [];
      for (let i = 0; i < forms.length; i++) {
        const f = _quartzFormValue(forms, String(i));
        if (typeof f !== 'string' || f.length > 256) throw new Error('form text');
        out.dominant_forms.push(f);
      }
    }
  }
  for (const key of ['_split', '_surfaceGrowth']) {
    const v = _quartzFormValue(crystal, key);
    if (v !== undefined && v !== null && !_quartzFormPlain(v)) throw new Error('scope witness');
    out[key === '_split' ? 'split_presence' : 'surface_growth_presence'] =
      v === undefined ? 'absent' : v === null ? 'null' : 'present';
  }
  const sceptre = _quartzFormValue(crystal, '_sceptre');
  if (sceptre !== undefined) {
    out._sceptre = null;
    if (sceptre !== null) {
      const keys = ['boundaryStep', 'stemUm', 'capUm', 'capFrac', 'route'];
      _quartzFormFields(sceptre, keys);
      const s: any = Object.fromEntries(keys.map(k => [k, _quartzFormValue(sceptre, k)]));
      if (!_quartzFormStep(s.boundaryStep) || s.boundaryStep > step
        || !['stemUm','capUm','capFrac'].every(k => Number.isFinite(s[k]) && s[k] >= 0)
        || s.capFrac > 1 || !(s.stemUm + s.capUm > 0)
        || Math.abs(s.capFrac - s.capUm / (s.stemUm + s.capUm)) > 1e-9
        || !['corrosion','masking'].includes(s.route)) throw new Error('sceptre descriptor');
      out._sceptre = s;
    }
  }
  const gwindel = _quartzFormValue(crystal, '_gwindel');
  if (gwindel !== undefined) {
    out._gwindel = null;
    if (gwindel !== null) {
      const keys = ['twistDeg', 'lengthUm', 'span'];
      _quartzFormFields(gwindel, keys);
      const g: any = Object.fromEntries(keys.map(k => [k, _quartzFormValue(gwindel, k)]));
      if (!Number.isFinite(g.twistDeg) || g.twistDeg < 45 || g.twistDeg > 120
        || !Number.isFinite(g.lengthUm) || g.lengthUm < 0 || !_quartzFormStep(g.span)) throw new Error('gwindel descriptor');
      out._gwindel = g;
    }
  }
  return _quartzFormFreeze(out);
}

function _quartzFormClose(state: QuartzFormObserverState, reason: string, step: number): void {
  if (state.history.unavailable) return;
  // This is the first unavailable cursor, not a claim about when a hidden
  // transition physically happened. A late detection cannot certify the gap.
  if (state.history.observed_through_step !== null) step = Math.min(step, state.history.observed_through_step + 1);
  state.history = Object.freeze({ ...state.history, unavailable: Object.freeze({reason, step}) });
}
function _quartzFormOwn(crystal: any, id: number | string, budget: {bytes: number}): QuartzFormObserverState {
  let state = _quartzFormOwners.get(crystal);
  if (state) return state;
  state = { history: Object.freeze({schema: QUARTZ_FORM_HISTORY_SCHEMA,
    observation_basis: QUARTZ_FORM_HISTORY_BASIS, source_crystal_id: id,
    initial: null, changes: Object.freeze([]), observed_through_step: null, observed_zone_count: null}),
    json: null, bytes: 0, budget };
  const owner = state;
  // Engine transactions enumerate/deep-copy ordinary fields. This one narrowly
  // belongs to the observer, never an engine, and must not incur that O(history)
  // copying cost. Getter + frozen values also prevent public mutation of records.
  try {
    if (Object.prototype.hasOwnProperty.call(crystal, '_quartzFormHistory')) throw new Error('history ownership conflict');
    Object.defineProperty(crystal, '_quartzFormHistory', {enumerable: false, configurable: false,
      get: () => owner.history});
  } catch (_error) { throw new Error('history-attachment'); }
  _quartzFormOwners.set(crystal, state);
  return state;
}
function _quartzFormObserve(crystal: any, step: number, budget: {bytes: number}): void {
  const id = _quartzFormValue(crystal, 'crystal_id');
  const prior = _quartzFormOwners.get(crystal);
  if (!_quartzFormId(id)) {
    if (prior) _quartzFormClose(prior, 'identity-change', step);
    else _quartzFormUnownedFailures.set(crystal, Object.freeze({reason:'invalid-identity',step}));
    return;
  }
  const state = _quartzFormOwn(crystal, id, budget), h = state.history;
  if (h.unavailable) return;
  if (state.budget !== budget) { _quartzFormClose(state, 'run-change', step); return; }
  if (id !== h.source_crystal_id) { _quartzFormClose(state, 'identity-change', step); return; }
  if (_quartzFormValue(crystal, 'mineral') !== 'quartz') { _quartzFormClose(state, 'unsupported-mineral', step); return; }
  const through = h.observed_through_step;
  if (through !== null && (step < through || step > through + 1)) {
    _quartzFormClose(state, step < through ? 'out-of-order' : 'observation-gap', step < through ? step : through + 1); return;
  }
  try {
    const zones = _quartzFormValue(crystal, 'zones');
    if (!Array.isArray(zones)) throw new Error('zone array');
    const count = zones.length, priorCount = h.observed_zone_count ?? 0;
    if (count < priorCount) throw new Error('zone count decreased');
    // Only inspect the newly appended suffix. No previous zone is modified or
    // reinterpreted by this recorder; historical volume is a separate authority.
    let previousStep = priorCount ? _quartzFormZoneStep(zones, priorCount - 1) : 0;
    if (!_quartzFormStep(previousStep) || previousStep > step) throw new Error('zone coordinate');
    for (let i = priorCount; i < count; i++) {
      const zoneStep = _quartzFormZoneStep(zones, i);
      if (!_quartzFormStep(zoneStep) || zoneStep < previousStep || zoneStep > step) throw new Error('zone coordinate');
      if (through !== null && step > through && zoneStep <= through) {
        _quartzFormClose(state, 'backdated-zone', zoneStep); return;
      }
      previousStep = zoneStep;
    }
    const snapshot = _quartzFormSnapshot(crystal, step), json = JSON.stringify(snapshot);
    const snapshotBytes = _quartzFormEncoder.encode(json).length;
    if (snapshotBytes > QUARTZ_FORM_HISTORY_LIMITS.snapshotBytes) { _quartzFormClose(state, 'snapshot-limit', step); return; }
    if (step === through) {
      if (json !== state.json || count !== h.observed_zone_count) _quartzFormClose(state, 'conflicting-observation', step);
      return;
    }
    let initial = h.initial, changes = h.changes;
    if (!initial || json !== state.json) {
      const record = Object.freeze({step, zone_count: count, snapshot});
      const bytes = _quartzFormEncoder.encode(JSON.stringify(record)).length;
      if (initial && changes.length + 1 >= QUARTZ_FORM_HISTORY_LIMITS.recordsPerCrystal) {
        _quartzFormClose(state, 'record-limit', step); return;
      }
      if (state.bytes + bytes > QUARTZ_FORM_HISTORY_LIMITS.bytesPerCrystal
        || budget.bytes + bytes > QUARTZ_FORM_HISTORY_LIMITS.bytesPerRun) {
        _quartzFormClose(state, 'byte-limit', step); return;
      }
      if (!initial) initial = record;
      else changes = Object.freeze([...changes, record]);
      state.bytes += bytes; budget.bytes += bytes;
    }
    state.json = json;
    state.history = Object.freeze({...h, initial, changes, observed_through_step: step, observed_zone_count: count});
  } catch (_error) {
    _quartzFormClose(state, 'invalid-descriptor', step);
  }
}

function recordQuartzFormObservations(sim: any): void {
  if (!sim || !_quartzFormStep(sim.step) || !Array.isArray(sim.crystals)) return;
  let budget = _quartzFormRunBudgets.get(sim);
  if (!budget) { budget = {bytes: 0}; _quartzFormRunBudgets.set(sim, budget); }
  const seen = new Map<any, any>();
  for (const crystal of sim.crystals) {
    if (!crystal || typeof crystal !== 'object') continue;
    if (_quartzFormUnownedFailures.has(crystal)) continue;
    try {
      const prior = _quartzFormOwners.get(crystal);
      if (!prior && _quartzFormValue(crystal, 'mineral') !== 'quartz') continue;
      const id = _quartzFormValue(crystal, 'crystal_id');
      if (seen.has(id)) {
        const other = _quartzFormOwners.get(seen.get(id));
        if (other) _quartzFormClose(other, 'duplicate-identity', sim.step);
        const current = prior || (_quartzFormId(id) ? _quartzFormOwn(crystal, id, budget) : null);
        if (current) _quartzFormClose(current, 'duplicate-identity', sim.step);
        continue;
      }
      seen.set(id, crystal);
      _quartzFormObserve(crystal, sim.step, budget);
    } catch (_error) {
      // The observation is nonessential to growth, but failure must stay visible.
      // For normal owned crystals a failed read closes the accepted prefix.
      const state = _quartzFormOwners.get(crystal);
      if (state) _quartzFormClose(state, 'invalid-descriptor', sim.step);
      else _quartzFormUnownedFailures.set(crystal, Object.freeze({
        reason:_error instanceof Error && _error.message === 'history-attachment' ? 'history-attachment' : 'invalid-descriptor',step:sim.step}));
    }
  }
}

// Syntax/coordinate validation for diagnostics and the later persistence step.
// It cannot authenticate testimony: that requires regenerated producer comparison.
function validateQuartzFormHistory(history: any, zones: any[]): boolean {
  try {
    const h = history;
    _quartzFormFields(h, ['schema','observation_basis','source_crystal_id','initial','changes',
      'observed_through_step','observed_zone_count','unavailable']);
    if (h.schema !== QUARTZ_FORM_HISTORY_SCHEMA || h.observation_basis !== QUARTZ_FORM_HISTORY_BASIS
      || !_quartzFormId(h.source_crystal_id) || !Array.isArray(zones) || !Array.isArray(h.changes)
      || h.changes.length >= QUARTZ_FORM_HISTORY_LIMITS.recordsPerCrystal) return false;
    const reasons = ['identity-change','unsupported-mineral','out-of-order','observation-gap','snapshot-limit',
      'conflicting-observation','record-limit','byte-limit','invalid-descriptor','duplicate-identity','run-change','backdated-zone'];
    if (h.unavailable !== undefined) {
      _quartzFormFields(h.unavailable, ['reason','step']);
      if (!reasons.includes(h.unavailable.reason) || !_quartzFormStep(h.unavailable.step)) return false;
    }
    if (h.initial === null) return !!h.unavailable && !h.changes.length
      && h.observed_through_step === null && h.observed_zone_count === null;
    if (!_quartzFormStep(h.observed_through_step) || !_quartzFormStep(h.observed_zone_count)
      || h.observed_zone_count > zones.length) return false;
    let zoneStep = 0;
    const zoneSteps: number[] = [];
    for (let i = 0; i < h.observed_zone_count; i++) {
      const s = _quartzFormZoneStep(zones, i);
      if (!_quartzFormStep(s) || s < zoneStep || s > h.observed_through_step) return false;
      zoneStep = s; zoneSteps.push(s);
    }
    // A closed history certifies only its accepted zone prefix. A malformed
    // later entry must not make earlier, successfully observed cursors vanish.
    if (!h.unavailable && zones.length > h.observed_zone_count) zoneSteps.push(_quartzFormZoneStep(zones, h.observed_zone_count));
    let priorStep = -1, priorCount = 0, priorJson: string | null = null, bytes = 0;
    for (const row of [h.initial, ...h.changes]) {
      _quartzFormFields(row, ['step','zone_count','snapshot']);
      if (!_quartzFormStep(row.step) || row.step <= priorStep || row.step > h.observed_through_step
        || !_quartzFormStep(row.zone_count) || row.zone_count < priorCount || row.zone_count > h.observed_zone_count) return false;
      if ((row.zone_count && zoneSteps[row.zone_count - 1] > row.step)
        || ((!h.unavailable || row.step < h.unavailable.step)
          && zoneSteps[row.zone_count] !== undefined && zoneSteps[row.zone_count] <= row.step)) return false;
      const s = row.snapshot;
      _quartzFormFields(s, ['mineral','habit','twin_law','_polymorph','mineral_display','growth_environment',
        'twinned','dominant_forms','split_presence','surface_growth_presence','_sceptre','_gwindel',
        'enclosed_by','cdr_replaces_crystal_id','dissolved','perimorph_eligible','_nucTilt']);
      if (s.mineral !== 'quartz' || !['absent','null','present'].includes(s.split_presence)
        || !['absent','null','present'].includes(s.surface_growth_presence)) return false;
      const input: any = {...s};
      for (const [field, presence] of [['_split',s.split_presence],['_surfaceGrowth',s.surface_growth_presence]]) {
        if (presence !== 'absent') input[field] = presence === 'null' ? null : {};
      }
      const normalized = _quartzFormSnapshot(input, row.step), canonical = JSON.stringify(normalized);
      if (!_quartzFormEqual(s, normalized) || canonical === priorJson
        || _quartzFormEncoder.encode(canonical).length > QUARTZ_FORM_HISTORY_LIMITS.snapshotBytes) return false;
      bytes += _quartzFormEncoder.encode(JSON.stringify(row)).length;
      priorStep = row.step; priorCount = row.zone_count; priorJson = canonical;
    }
    if (bytes > QUARTZ_FORM_HISTORY_LIMITS.bytesPerCrystal) return false;
    if ((h.observed_zone_count && zoneSteps[h.observed_zone_count - 1] > h.observed_through_step)
      || ((!h.unavailable || h.observed_through_step < h.unavailable.step)
        && zoneSteps[h.observed_zone_count] !== undefined && zoneSteps[h.observed_zone_count] <= h.observed_through_step)) return false;
    return !h.unavailable || h.unavailable.step <= h.observed_through_step + 1;
  } catch (_error) { return false; }
}

// Data projection only: consumer route eligibility lives in 46m, independently
// of valid testimony. Never compare a past snapshot to today's descriptors.
function quartzFormObservationAtStep(crystal: any, step: number): any {
  try {
    const failure = crystal && typeof crystal === 'object' ? _quartzFormUnownedFailures.get(crystal) : null;
    if (failure) return {status:'unavailable',reason:failure.reason,unavailable_step:failure.step};
    const h = _quartzFormOwners.get(crystal)?.history ?? _quartzFormValue(crystal, '_quartzFormHistory');
    if (!_quartzFormStep(step) || !h || !validateQuartzFormHistory(h, crystal.zones)) return {status:'unavailable',reason:'missing-or-invalid-history'};
    const sourceId = crystal._collectionSourceHistory?.crystal_id ?? crystal.crystal_id;
    if (h.source_crystal_id !== sourceId) return {status:'unavailable',reason:'source-identity-mismatch'};
    quartzFormAssertKnownBirth(h, crystal.nucleation_step);
    if (!h.initial || (h.unavailable && step >= h.unavailable.step)) return {status:'unavailable',reason:h.unavailable?.reason || 'unobserved'};
    if (step < h.initial.step || step > h.observed_through_step) return {status:'unavailable',reason:'outside-observed-coverage'};
    let observation = h.initial;
    for (const row of h.changes) { if (row.step > step) break; observation = row; }
    return {status:'recorded',observation_step:observation.step,observation_basis:h.observation_basis,
      snapshot:JSON.parse(JSON.stringify(observation.snapshot))};
  } catch {
    return {status:'unavailable',reason:'missing-or-invalid-history'};
  }
}

// Export accepted testimony, never create observations as a side effect of saving.
// A closed history can differ from today's crystal; its declared prefix survives.
// Syntax and endpoint fidelity are not origin authentication: collections also
// replay their commands, while arbitrary strip imports retain imported status.
function quartzFormAssertKnownBirth(history: QuartzFormHistory, birth: unknown): void {
  if (birth === undefined || birth === null) return;
  if (!_quartzFormStep(birth)
      || (history.initial && history.initial.step < (birth as number))
      || (!history.initial && history.unavailable && history.unavailable.step < (birth as number))) {
    throw new Error('quartz form history: observation precedes known nucleation or invalid birth coordinate');
  }
}

function quartzFormHistoryForPersistence(crystal: any, capturedStep?: number): QuartzFormHistory | undefined {
  const failure = crystal && _quartzFormUnownedFailures.get(crystal);
  if (failure) throw new Error(`quartz form history: ${failure.reason}`);
  const owner = crystal && _quartzFormOwners.get(crystal);
  const h = owner ? owner.history : _quartzFormValue(crystal, '_quartzFormHistory');
  if (h === undefined) return undefined;
  const zones = _quartzFormValue(crystal, 'zones');
  if (!validateQuartzFormHistory(h, zones)
      || h.source_crystal_id !== _quartzFormValue(crystal, 'crystal_id')) {
    throw new Error('quartz form history: invalid ledger or source identity');
  }
  quartzFormAssertKnownBirth(h, _quartzFormValue(crystal, 'nucleation_step'));
  if (capturedStep !== undefined && (!_quartzFormStep(capturedStep)
      || (h.observed_through_step !== null && h.observed_through_step > capturedStep)
      || (h.unavailable && h.unavailable.step > capturedStep))) {
    throw new Error('quartz form history: future observation at capture');
  }
  if (!h.unavailable) {
    const last = h.changes.length ? h.changes[h.changes.length - 1] : h.initial;
    if (!last || _quartzFormValue(crystal, 'mineral') !== 'quartz'
        || h.observed_zone_count !== zones.length
        || (capturedStep !== undefined && h.observed_through_step !== capturedStep)
        || !_quartzFormEqual(last.snapshot, _quartzFormSnapshot(crystal, h.observed_through_step))) {
      throw new Error('quartz form history: final observation contradicts live state');
    }
  }
  return _quartzFormFreeze(JSON.parse(JSON.stringify(h)));
}
