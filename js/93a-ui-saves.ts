// ============================================================
// js/93a-ui-saves.ts — UI — Game saves (autosave + manual) + lifetime stats
// ============================================================
// SCRIPT-mode TS — top-level decls stay global so cross-file references
// resolve at runtime.
//
// Boss directive 2026-07-08: "saving the game should be automatic. the
// last button should be 'narrate, collect, and save' … a save button
// between library and home … a save menu that has manual saves in
// addition to the autosaves … total crystals collected across all runs
// is a good base stat."
//
// DESIGN — event-sourced saves (the house religion: deterministic replay).
// A save is NOT a snapshot of the sim (grid voxels + ring fluids + rng
// internals would be huge and version-brittle). It is the RECIPE to
// re-grow the run exactly:
//
//   origin   — which begin path (scenario / starter / custom), its
//              resolved params, and the rng seed installed BEFORE any
//              construction (mirrors legends' seed-first order, the
//              order the seed-42 baselines prove deterministic).
//   actions  — every fortressStep verb in order, each with the broth-
//              slider values that differed from the previous action
//              (fortressStep re-applies sliders→sim before dispatch,
//              so slider state at action time IS the complete broth
//              input; see 97-ui-fortress.ts).
//   collected— [crystalIndex, libraryRecordId] pairs so replayed
//              crystals remember they're already in the Library.
//
// Loading replays the actions through the REAL fortressStep path with
// the pacing player in instant mode. Same seed + same actions = the
// same pocket, zone for zone. Replay is fail-closed on simulation version,
// scientific model digest, and (for authored scenarios) the exact scenario-
// spec hash. A recipe cannot silently grow a different rock under new science.
//
// The active run keeps ONE rolling autosave record, re-persisted after
// every action — "saving is automatic" means a browser crash costs
// nothing. Finish ("Narrate, Collect & Save") seals it as finished.
// Manual saves are frozen copies taken any time from the Saves menu.
//
// Lifetime stats ('vugg-stats-v1') are a separate tiny record: counters
// that only go UP (deleting a specimen from the Library doesn't un-find
// it). crystals_collected is the boss's named base stat for the future
// scoring system; runs_finished rides along for free.

const SAVES_KEY = 'vugg-saves-v1';
const SAVES_PENDING_KEY = 'vugg-saves-v1.pending';
const SAVES_BACKUP_KEY = 'vugg-saves-v1.backup';
const SAVES_CORRUPT_KEY = 'vugg-saves-v1.corrupt';
const STATS_KEY = 'vugg-stats-v1';
const STATS_CORRUPT_KEY = 'vugg-stats-v1.corrupt';
const SAVE_FORMAT = 3;
const SAVE_COLLECTION_EPOCH = 'event-cursor-v1';
const SAVE_STORAGE_FORMAT = 2;
const SAVE_QUARANTINE_FORMAT = 1;
const SAVE_QUARANTINE_LIMIT = 8;
// Autosaves beyond this count prune oldest-first (manual saves never
// auto-prune — the player curated those).
const MAX_AUTOSAVES = 8;

// The rolling autosave for the active fortress run (object identity ==
// the persisted record; mutated in place + re-persisted each action).
let _saveActiveRecord = null;
// Last captured broth-slider state — per-action deltas diff against it.
let _saveLastBroth = null;
// True while loadSaveById is replaying a save's action log. Read by
// 97-ui-fortress (skip pacing, skip finish's collect/save/stats) and by
// the recording hooks below (a replay must not re-record itself).
let _fortressReplaying = false;
let _savePendingAction = null;
let _saveStorageGeneration = 0;
let _saveStorageNotice = null;
const _SAVE_AUTHENTIC_COLLECTION_RECEIPTS = new WeakMap();
const _SAVE_COLLECTION_MARKS = new WeakMap();
// True only when the newest in-memory recipe has not reached an authenticated
// pending journal. Primary-publication failure is not dirty: the journal is a
// durable commit and loadSaves() can promote it after a crash.
let _saveStorageDirty = false;

// Live accessors for bundle-internal bindings — the globalThis copies
// tests-js/setup.ts exports are load-time SNAPSHOTS that go stale the
// moment the bundle reassigns them (the _liveRng precedent). Tests and
// probes read through these instead.
function _liveFortressSim() { return (typeof fortressSim !== 'undefined') ? fortressSim : null; }
function _liveFortressActive() { return (typeof fortressActive !== 'undefined') ? !!fortressActive : false; }
function _liveSaveActiveRecord() { return _saveActiveRecord; }
function _liveSaveStorageNotice() { return _saveStorageNotice; }

function _saveSetStorageNotice(message, writeFailure = false) {
  _saveStorageNotice = message || null;
  const el = (typeof document !== 'undefined')
    ? document.getElementById('saves-storage-notice')
    : null;
  if (!el) return;
  el.textContent = _saveStorageNotice || '';
  el.style.display = _saveStorageNotice ? 'block' : 'none';
  el.classList.toggle('save-storage-global-failure', !!(_saveStorageNotice && writeFailure));
}

function _saveWriteFailure(message) {
  _saveStorageDirty = true;
  _saveSetStorageNotice(
    message || 'Autosave could not be written. The newest changes remain in memory; open Saves and use Save current run to retry before closing this tab.',
    true,
  );
}

// ---------- storage ----------

function _saveRecipeProjection(rec) {
  const projection: any = {
    format: rec?.format ?? null,
    sim_version: rec?.sim_version ?? null,
    model_digest: rec?.model_digest ?? null,
    scenario_spec_hash: rec?.scenario_spec_hash ?? null,
    status: rec?.status ?? null,
    origin: rec?.origin ?? null,
    actions: rec?.actions ?? null,
    pending_broth: rec?.pending_broth ?? null,
    broth_final: rec?.broth_final ?? null,
    collected: rec?.collected ?? null,
    replay_state_digest: rec?.replay_state_digest ?? null,
    replay_integrity: rec?.replay_integrity ?? null,
  };
  // Optional fields keep pre-receipt v2 digests stable while binding every
  // new run identity and Creative collection write-ahead receipt.
  if (rec?.run_id != null) projection.run_id = rec.run_id;
  if (rec?.collection_epoch != null) projection.collection_epoch = rec.collection_epoch;
  if (rec?.collection_receipts != null) projection.collection_receipts = rec.collection_receipts;
  // Conditional keeps pre-transaction format-v2 recipe digests stable while
  // binding every newly staged finish transaction byte-for-byte.
  if (rec?.finish_transaction != null) projection.finish_transaction = rec.finish_transaction;
  return projection;
}

function _saveRecipeDigest(rec) {
  return sha256HexUtf8(JSON.stringify(_saveRecipeProjection(rec)));
}

function _saveFinishTransactionProjection(tx) {
  const projection: any = {
    schema: tx?.schema ?? null,
    id: tx?.id ?? null,
    library_baseline: tx?.library_baseline ?? null,
    library_records: tx?.library_records ?? null,
    collected: tx?.collected ?? null,
    new_species: tx?.new_species ?? null,
    crystals_collected_delta: tx?.crystals_collected_delta ?? null,
    runs_finished_delta: tx?.runs_finished_delta ?? null,
  };
  if (tx?.run_id != null) projection.run_id = tx.run_id;
  return projection;
}

function _saveFinishTransactionDigest(tx) {
  return sha256HexUtf8(JSON.stringify(_saveFinishTransactionProjection(tx)));
}

function _saveAssertFinishTransaction(tx, saveId, runId = null) {
  if (!tx || tx.schema !== 1 || tx.id !== `finish:${saveId}`
      || (tx.run_id != null && (typeof tx.run_id !== 'string' || !tx.run_id))
      || (runId != null && tx.run_id !== runId)
      || !Array.isArray(tx.library_baseline)
      || !Array.isArray(tx.library_records) || !Array.isArray(tx.collected)
      || !Array.isArray(tx.new_species)
      || tx.crystals_collected_delta !== tx.library_records.length
      || tx.runs_finished_delta !== 1
      || typeof tx.digest !== 'string'
      || tx.digest !== _saveFinishTransactionDigest(tx)) {
    throw new Error(`finish transaction failed authentication for ${saveId}`);
  }
  const recordIds = new Set();
  const baselineIds = new Set();
  for (const entry of tx.library_baseline) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || baselineIds.has(entry.id)
        || typeof entry.mineral !== 'string'
        || !/^[0-9a-f]{64}$/.test(String(entry.record_digest))
        || !/^[0-9a-f]{64}$/.test(String(entry.science_digest))) {
      throw new Error(`finish transaction has an invalid Library baseline for ${saveId}`);
    }
    baselineIds.add(entry.id);
  }
  for (const record of tx.library_records) {
    if (!record || typeof record.id !== 'string' || !record.id
        || recordIds.has(record.id) || baselineIds.has(record.id)) {
      throw new Error(`finish transaction has invalid specimen ids for ${saveId}`);
    }
    recordIds.add(record.id);
  }
  const crystalIndexes = new Set();
  const mappedRecordIds = new Set();
  for (const pair of tx.collected) {
    if (!Array.isArray(pair) || pair.length !== 2
        || !Number.isSafeInteger(pair[0]) || pair[0] < 0
        || typeof pair[1] !== 'string' || !pair[1]
        || crystalIndexes.has(pair[0]) || mappedRecordIds.has(pair[1])) {
      throw new Error(`finish transaction has an invalid crystal mapping for ${saveId}`);
    }
    crystalIndexes.add(pair[0]);
    mappedRecordIds.add(pair[1]);
  }
  for (const recordId of recordIds) {
    if (!mappedRecordIds.has(recordId)) {
      throw new Error(`finish transaction collection map is incomplete for ${saveId}`);
    }
  }
  return true;
}

function _saveSpecimenProjection(record, includeName = false) {
  if (!record || typeof record !== 'object') return null;
  const projection = {};
  for (const key of Object.keys(record)) {
    if (key === 'id' || key === 'collected_at' || (!includeName && key === 'name')) continue;
    projection[key] = record[key];
  }
  return projection;
}

function _saveSpecimenScienceDigest(record) {
  return sha256HexUtf8(JSON.stringify(_saveSpecimenProjection(record, false)));
}

function _saveLibraryRecordDigest(record) {
  return sha256HexUtf8(JSON.stringify(record));
}

function _saveStrictLibraryForFinish(phase) {
  if (typeof loadCrystalsStrict !== 'function') {
    throw new Error('strict Library reader is unavailable');
  }
  const strict = loadCrystalsStrict();
  if (strict.ok) return strict.records;
  const preserved = typeof quarantineCrystalStorage === 'function'
    ? quarantineCrystalStorage(strict.raw, `${phase}: ${strict.error}`)
    : false;
  throw new Error(`the specimen Library could not be authenticated (${strict.error}); corrupt bytes ${preserved ? 'were quarantined' : 'remain untouched in their original key'}`);
}

function _saveFinishRecordIdCandidate(saveId, crystalIdx, attempt = 0) {
  return `cry-finish-${sha256HexUtf8(`${saveId}:${crystalIdx}:${attempt}`).slice(0, 32)}`;
}

function _saveFinishSpecimenMeta(runId, crystalIdx) {
  return {
    mode: 'creative',
    run_id: runId,
    crystal_index: crystalIdx,
  };
}

function _saveCollectionReceiptProjection(receipt) {
  return {
    schema: receipt?.schema ?? null,
    id: receipt?.id ?? null,
    run_id: receipt?.run_id ?? null,
    crystal_index: receipt?.crystal_index ?? null,
    action_cursor: receipt?.action_cursor ?? null,
    record: receipt?.record ?? null,
  };
}

function _saveCollectionReceiptDigest(receipt) {
  return sha256HexUtf8(JSON.stringify(_saveCollectionReceiptProjection(receipt)));
}

function _saveCollectionReceiptId(runId, crystalIdx, actionCursor, record) {
  const science = _saveSpecimenScienceDigest(record);
  return `collect:${runId}:${crystalIdx}:${actionCursor}:${science.slice(0, 24)}`;
}

function _saveCollectionRecordId(receiptId) {
  return `cry-collection-${sha256HexUtf8(receiptId).slice(0, 32)}`;
}

function _saveAssertCollectionReceipt(receipt, runId) {
  if (!receipt || receipt.schema !== 1
      || typeof receipt.run_id !== 'string' || receipt.run_id !== runId
      || !Number.isSafeInteger(receipt.crystal_index) || receipt.crystal_index < 0
      || !Number.isSafeInteger(receipt.action_cursor) || receipt.action_cursor < 0
      || receipt.id !== _saveCollectionReceiptId(
        runId,
        receipt.crystal_index,
        receipt.action_cursor,
        receipt.record,
      )
      || !receipt.record || typeof receipt.record !== 'object'
      || receipt.record.id !== _saveCollectionRecordId(receipt.id)
      || receipt.record.source?.run_id !== runId
      || receipt.record.source?.crystal_index !== receipt.crystal_index
      || receipt.digest !== _saveCollectionReceiptDigest(receipt)) {
    throw new Error(`Creative collection receipt failed authentication for run ${runId}`);
  }
  return true;
}

function _saveAuthenticateCollectionReceiptAgainstLive(receipt, runId) {
  _saveAssertCollectionReceipt(receipt, runId);
  const crystal = fortressSim?.crystals?.[receipt.crystal_index];
  if (!crystal || !((crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0)) {
    throw new Error(`collection receipt crystal ${receipt.crystal_index} is not collectable in replay`);
  }
  const expected = buildCrystalRecord(
    crystal,
    _saveFinishSpecimenMeta(runId, receipt.crystal_index),
  );
  expected.id = receipt.record.id;
  if (_saveSpecimenScienceDigest(expected) !== _saveSpecimenScienceDigest(receipt.record)) {
    throw new Error(`collection receipt does not match replayed crystal ${receipt.crystal_index}`);
  }
  _SAVE_AUTHENTIC_COLLECTION_RECEIPTS.set(receipt, Object.freeze({
    receipt_digest: receipt.digest,
    projection_digest: _saveCollectionReceiptDigest(receipt),
    science_digest: _saveSpecimenScienceDigest(receipt.record),
    run_id: receipt.run_id,
    crystal_index: receipt.crystal_index,
    action_cursor: receipt.action_cursor,
    crystal,
  }));
  return crystal;
}

function _saveHasAuthenticatedCollectionReceipt(receipt) {
  const authority = receipt && _SAVE_AUTHENTIC_COLLECTION_RECEIPTS.get(receipt);
  if (!authority) return false;
  try {
    _saveAssertCollectionReceipt(receipt, authority.run_id);
  } catch (_e) {
    return false;
  }
  return receipt.digest === authority.receipt_digest
    && _saveCollectionReceiptDigest(receipt) === authority.projection_digest
    && _saveSpecimenScienceDigest(receipt.record) === authority.science_digest
    && receipt.run_id === authority.run_id
    && receipt.crystal_index === authority.crystal_index
    && receipt.action_cursor === authority.action_cursor
    && fortressSim?.crystals?.[receipt.crystal_index] === authority.crystal;
}

function _saveAllocateFinishRecordId(saveId, crystalIdx, occupiedIds) {
  for (let attempt = 0; attempt < 1_000_000; attempt++) {
    const candidate = _saveFinishRecordIdCandidate(saveId, crystalIdx, attempt);
    if (!occupiedIds.has(candidate)) {
      occupiedIds.add(candidate);
      return candidate;
    }
  }
  throw new Error(`could not allocate a collision-free specimen id for crystal ${crystalIdx}`);
}

function _saveDisambiguateFinishNames(items) {
  const counts = {};
  for (const item of items) counts[item.record.name] = (counts[item.record.name] || 0) + 1;
  const seen = {};
  for (const item of items) {
    const name = item.record.name;
    if (counts[name] > 1) {
      seen[name] = (seen[name] || 0) + 1;
      item.record.name = `${name} #${seen[name]}`;
    }
  }
}

function _saveAuthenticateFinishTransactionAgainstLive(tx, saveId, library, opts: any = {}) {
  _saveAssertFinishTransaction(tx, saveId, opts.runId ?? tx.run_id ?? null);
  if (typeof fortressSim === 'undefined' || !fortressSim || !Array.isArray(fortressSim.crystals)) {
    throw new Error('finish transaction has no replayed simulation to authenticate against');
  }
  const requireLibrary = opts.requireLibrary !== false;
  const libraryById = new Map<string, any>((library || []).map(record => [record.id, record]));
  const baselineById = new Map<string, any>(tx.library_baseline.map(entry => [entry.id, entry]));
  for (const entry of tx.library_baseline) {
    const actual = libraryById.get(entry.id);
    if (!actual) {
      if (requireLibrary) throw new Error(`baseline specimen ${entry.id} is missing`);
      continue;
    }
    const scienceMismatch = _saveSpecimenScienceDigest(actual) !== entry.science_digest
      || actual.mineral !== entry.mineral;
    const durableMismatch = requireLibrary
      && _saveLibraryRecordDigest(actual) !== entry.record_digest;
    if (scienceMismatch || durableMismatch) {
      throw new Error(`baseline specimen ${entry.id} changed after finish staging`);
    }
  }

  const stagedById = new Map<string, any>(tx.library_records.map(record => [record.id, record]));
  for (const record of tx.library_records) {
    const actual = libraryById.get(record.id);
    const mismatch = actual && (requireLibrary
      ? JSON.stringify(actual) !== JSON.stringify(record)
      : _saveSpecimenScienceDigest(actual) !== _saveSpecimenScienceDigest(record));
    if (mismatch) {
      throw new Error(`staged specimen ${record.id} conflicts with the Library`);
    }
  }

  const suppressedByCrystal = new Map<number, string>();
  const collectableIndexes = [];
  fortressSim.crystals.forEach((crystal, crystalIdx) => {
    if (crystal && ((crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0)) {
      const marker = crystal._collectedRecordId;
      const authenticatedDeletion = marker
        && !libraryById.has(marker)
        && _SAVE_COLLECTION_MARKS.get(crystal) === marker;
      if (authenticatedDeletion) {
        suppressedByCrystal.set(crystalIdx, marker);
        return;
      }
      collectableIndexes.push(crystalIdx);
    }
  });
  const mappedByCrystal = new Map<number, string>();
  for (const pair of tx.collected) {
    const suppressedId = suppressedByCrystal.get(pair[0]);
    if (suppressedId) {
      if (pair[1] !== suppressedId) {
        throw new Error(`finish transaction contradicts deleted specimen ${pair[1]}`);
      }
      continue;
    }
    mappedByCrystal.set(pair[0], pair[1]);
  }
  if (mappedByCrystal.size !== collectableIndexes.length
      || collectableIndexes.some(crystalIdx => !mappedByCrystal.has(crystalIdx))) {
    throw new Error('finish transaction does not cover every collectable replayed crystal exactly once');
  }

  const occupiedIds = new Set(tx.library_baseline.map(entry => entry.id));
  const expectedStaged = [];
  const specimenIdentity = tx.run_id || saveId;
  for (const crystalIdx of collectableIndexes) {
    const crystal = fortressSim.crystals[crystalIdx];
    const recordId = mappedByCrystal.get(crystalIdx);
    const stagedRecord = stagedById.get(recordId);
    const expected = buildCrystalRecord(
      crystal,
      tx.run_id
        ? _saveFinishSpecimenMeta(tx.run_id, crystalIdx)
        : { mode: 'creative' },
    );
    if (stagedRecord) {
      const expectedId = _saveAllocateFinishRecordId(specimenIdentity, crystalIdx, occupiedIds);
      if (recordId !== expectedId) {
        throw new Error(`staged specimen id is not the deterministic id for crystal ${crystalIdx}`);
      }
      expected.id = expectedId;
      expectedStaged.push({ crystalIdx, record: expected, actual: stagedRecord });
    } else {
      const baseline = baselineById.get(recordId);
      const exactProvenance = baseline
        && _saveSpecimenScienceDigest(expected) === baseline.science_digest;
      const migratedLegacy = baseline
        && _SAVE_COLLECTION_MARKS.get(crystal) === recordId
        && _saveLegacyRecordMatchesCrystal(libraryById.get(recordId), crystal);
      if (!exactProvenance && !migratedLegacy) {
        throw new Error(`pre-collected crystal ${crystalIdx} is not bound to its baseline specimen`);
      }
    }
  }
  _saveDisambiguateFinishNames(expectedStaged);
  for (const item of expectedStaged) {
    if (JSON.stringify(_saveSpecimenProjection(item.actual, true))
        !== JSON.stringify(_saveSpecimenProjection(item.record, true))) {
      throw new Error(`staged specimen data does not match replayed crystal ${item.crystalIdx}`);
    }
  }

  const beforeMinerals = new Set(tx.library_baseline.map(entry => entry.mineral));
  const expectedNewSpecies = [];
  for (const item of expectedStaged) {
    if (!beforeMinerals.has(item.actual.mineral)) {
      expectedNewSpecies.push(item.actual.mineral);
      beforeMinerals.add(item.actual.mineral);
    }
  }
  if (tx.crystals_collected_delta !== expectedStaged.length
      || tx.runs_finished_delta !== 1
      || JSON.stringify(tx.new_species) !== JSON.stringify(expectedNewSpecies)) {
    throw new Error('finish transaction deltas do not match replayed geology and Library baseline');
  }
  return true;
}

function _saveRecordShapeReason(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 'record is not an object';
  if (!Number.isInteger(rec.format) || rec.format < 1 || rec.format > SAVE_FORMAT) return 'unsupported record format';
  if (typeof rec.id !== 'string' || !rec.id) return 'record id is missing';
  if (rec.run_id != null && (typeof rec.run_id !== 'string' || !rec.run_id)) return 'record run identity is invalid';
  if (rec.format === SAVE_FORMAT) {
    if (typeof rec.run_id !== 'string' || !rec.run_id) return 'modern record run identity is missing';
    if (rec.collection_epoch !== SAVE_COLLECTION_EPOCH) return 'modern record collection epoch is missing or unsupported';
    if (!Array.isArray(rec.collection_receipts)) return 'modern record collection receipts are missing';
  }
  if (rec.kind !== 'auto' && rec.kind !== 'manual') return 'record kind is invalid';
  if (rec.status !== 'in-progress' && rec.status !== 'finishing' && rec.status !== 'finished') return 'record status is invalid';
  if (rec.format >= 2 && rec.status !== 'in-progress' && rec.finish_transaction == null) {
    return 'terminal record is missing its finish transaction';
  }
  if (rec.format >= 2 && rec.status === 'in-progress' && rec.finish_transaction != null) {
    return 'in-progress record carries an impossible finish transaction';
  }
  if (!rec.origin || typeof rec.origin !== 'object') return 'record origin is missing';
  if (!Array.isArray(rec.actions) || rec.actions.length > 100_000) return 'record action log is invalid';
  if (!Array.isArray(rec.collected)) return 'record collection map is invalid';
  if (rec.collection_receipts != null && !Array.isArray(rec.collection_receipts)) {
    return 'record collection receipts are invalid';
  }
  for (const entry of rec.actions) {
    if (!entry || typeof entry !== 'object' || typeof entry.a !== 'string' || !entry.a) {
      return 'record action entry is invalid';
    }
    if (entry.b != null && (typeof entry.b !== 'object' || Array.isArray(entry.b))) {
      return 'record broth delta is invalid';
    }
  }
  return '';
}

function _saveNormalizeRecord(rec, { migrate = false } = {}) {
  const reason = _saveRecordShapeReason(rec);
  if (reason) throw new Error(reason);
  if (rec.format >= 2) {
    if (rec.format === 2 && migrate && !rec.recipe_digest && !rec.replay_integrity) {
      // Migration fields are part of the recipe projection. Install every one
      // before minting the digest so the migrated record authenticates again
      // on its second read.
      rec.replay_integrity = rec.replay_state_digest
        ? 'state-fingerprint-v1'
        : 'migrated-v2-identity-only';
    }
    const expected = _saveRecipeDigest(rec);
    if (rec.recipe_digest && rec.recipe_digest !== expected) {
      throw new Error(`recipe digest mismatch for ${rec.id}`);
    }
    if (!rec.recipe_digest && !(rec.format === 2 && migrate)) {
      throw new Error(`modern record ${rec.id} is missing its recipe digest`);
    }
    if (rec.replay_state_digest != null
        && !/^[0-9a-f]{64}$/.test(String(rec.replay_state_digest))) {
      throw new Error(`record ${rec.id} has an invalid replay state digest`);
    }
    if (rec.finish_transaction != null) {
      _saveAssertFinishTransaction(rec.finish_transaction, rec.id, rec.run_id ?? null);
    }
    const receiptLineages = new Set();
    for (const receipt of (rec.collection_receipts || [])) {
      _saveAssertCollectionReceipt(receipt, rec.run_id || rec.id);
      if (receipt.action_cursor > rec.actions.length) {
        throw new Error(`collection receipt cursor exceeds the action log for ${rec.id}`);
      }
      const lineage = `${receipt.run_id}:${receipt.crystal_index}`;
      if (receiptLineages.has(lineage)) {
        throw new Error(`record ${rec.id} has duplicate collection receipts for one crystal lineage`);
      }
      receiptLineages.add(lineage);
    }
    if (rec.format === 2 && migrate && !rec.recipe_digest) {
      rec.recipe_digest = expected;
    }
  }
  // Format v1 pre-dates MODEL_DIGEST/scenario hashes. Preserve it verbatim for
  // export and diagnosis, but never mint modern identity or make it loadable.
  return rec;
}

function _saveEnvelopeDigest(envelope) {
  return sha256HexUtf8(JSON.stringify({
    storage_format: envelope.storage_format,
    generation: envelope.generation,
    records: envelope.records,
  }));
}

function _saveMakeEnvelope(items, generation) {
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new Error('save generation must be a non-negative safe integer');
  }
  const records = items.map(rec => _saveNormalizeRecord(rec, { migrate: true }));
  const ids = new Set(records.map(rec => rec.id));
  if (ids.size !== records.length) throw new Error('save record ids must be unique');
  const envelope: any = {
    storage_format: SAVE_STORAGE_FORMAT,
    generation,
    records,
  };
  envelope.storage_digest = _saveEnvelopeDigest(envelope);
  return envelope;
}

function _saveParseCandidate(raw, source) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    const envelope = _saveMakeEnvelope(parsed, 0);
    return { source, raw, envelope, legacy: true };
  }
  if (!parsed || parsed.storage_format !== SAVE_STORAGE_FORMAT
      || !Number.isSafeInteger(parsed.generation) || parsed.generation < 0
      || !Array.isArray(parsed.records)
      || typeof parsed.storage_digest !== 'string'
      || parsed.storage_digest !== _saveEnvelopeDigest(parsed)) {
    throw new Error(`${source} save envelope failed authentication`);
  }
  for (const rec of parsed.records) _saveNormalizeRecord(rec);
  return { source, raw, envelope: parsed, legacy: false };
}

function _saveQuarantine(raw, reason, source = 'unknown') {
  if (!raw) return;
  try {
    let entries = [];
    const priorRaw = localStorage.getItem(SAVES_CORRUPT_KEY);
    if (priorRaw) {
      try {
        const prior = JSON.parse(priorRaw);
        if (prior && prior.storage_format === SAVE_QUARANTINE_FORMAT && Array.isArray(prior.entries)) {
          entries = prior.entries.slice();
        } else if (prior && typeof prior.raw === 'string') {
          entries = [{ ...prior, source: prior.source || 'legacy' }];
        }
      } catch (_e) { /* The recovery store itself was unreadable; preserve new evidence. */ }
    }
    if (entries.some(entry => entry && entry.raw === raw && entry.source === source)) return;
    entries.push({
      captured_at: new Date().toISOString(),
      reason,
      source,
      raw,
    });
    if (entries.length > SAVE_QUARANTINE_LIMIT) {
      const firstPrimary = entries.find(entry => entry && entry.source === 'primary');
      const tail = entries.slice(-(SAVE_QUARANTINE_LIMIT - (firstPrimary ? 1 : 0)));
      entries = firstPrimary && !tail.includes(firstPrimary) ? [firstPrimary, ...tail] : tail;
    }
    localStorage.setItem(SAVES_CORRUPT_KEY, JSON.stringify({
      storage_format: SAVE_QUARANTINE_FORMAT,
      entries,
    }));
  } catch (_e) { /* Preserve the corrupt primary in place if quota is exhausted. */ }
}

function loadSaves() {
  const candidates = [];
  const failures = [];
  for (const [source, key] of [
    ['primary', SAVES_KEY],
    ['pending journal', SAVES_PENDING_KEY],
    ['backup', SAVES_BACKUP_KEY],
  ]) {
    let raw = null;
    try { raw = localStorage.getItem(key); }
    catch (e) { failures.push(`${source}: storage unavailable`); continue; }
    if (!raw) continue;
    try {
      const candidate = _saveParseCandidate(raw, source);
      if (candidate) candidates.push(candidate);
    } catch (e) {
      failures.push(`${source}: ${e && (e as any).message ? (e as any).message : e}`);
      if (source === 'primary') _saveQuarantine(raw, failures[failures.length - 1], source);
      else {
        _saveQuarantine(raw, failures[failures.length - 1], source);
        try { localStorage.removeItem(key); } catch (_e) { /* best effort */ }
      }
    }
  }

  if (!candidates.length) {
    if (failures.length) {
      _saveSetStorageNotice(
        `Save storage is corrupt and no authenticated recovery copy was found. The original bytes were preserved under recovery storage; new saves will start a separate valid journal. (${failures.join('; ')})`,
        _saveStorageDirty,
      );
    } else if (!_saveStorageDirty) {
      _saveSetStorageNotice(null);
    }
    _saveStorageGeneration = 0;
    return [];
  }

  const sourcePriority = { primary: 3, 'pending journal': 2, backup: 1 };
  candidates.sort((a, b) =>
    b.envelope.generation - a.envelope.generation
    || sourcePriority[b.source] - sourcePriority[a.source]);
  const chosen = candidates[0];
  _saveStorageGeneration = chosen.envelope.generation;
  const repaired = chosen.source !== 'primary' || chosen.legacy || failures.length > 0;
  if (repaired) {
    const repairedEnvelope = _saveMakeEnvelope(chosen.envelope.records, chosen.envelope.generation);
    const repairedRaw = JSON.stringify(repairedEnvelope);
    try {
      localStorage.setItem(SAVES_KEY, repairedRaw);
      localStorage.removeItem(SAVES_PENDING_KEY);
      _saveStorageDirty = false;
      _saveSetStorageNotice(`Recovered ${repairedEnvelope.records.length} save${repairedEnvelope.records.length === 1 ? '' : 's'} from ${chosen.legacy ? 'the legacy array format' : chosen.source}; the authenticated primary was repaired.${failures.length ? ` ${failures.join('; ')}` : ''}`);
    } catch (e) {
      _saveSetStorageNotice(`Authenticated saves were read from ${chosen.source}, but primary repair could not be written.`);
    }
    return repairedEnvelope.records;
  }
  if (!_saveStorageDirty) _saveSetStorageNotice(null);
  if (candidates.some(candidate => candidate.source === 'pending journal')) {
    try { localStorage.removeItem(SAVES_PENDING_KEY); } catch (_e) { /* best effort */ }
  }
  return chosen.envelope.records;
}

function persistSaves(items) {
  let envelope;
  try {
    envelope = _saveMakeEnvelope(items, _saveStorageGeneration + 1);
  } catch (e) {
    console.error('saves persist rejected invalid record:', e);
    _saveWriteFailure('Autosave rejected an invalid in-memory recipe. The current run remains in memory and was not presented as saved.');
    return false;
  }
  const raw = JSON.stringify(envelope);
  try {
    localStorage.setItem(SAVES_PENDING_KEY, raw);
    const journal = _saveParseCandidate(localStorage.getItem(SAVES_PENDING_KEY), 'pending journal');
    if (!journal || journal.envelope.storage_digest !== envelope.storage_digest) {
      throw new Error('pending save journal did not read back byte-authenticated');
    }
  } catch (e) {
    console.error('saves journal persist failed:', e);
    _saveWriteFailure('Autosave storage denied or failed journal readback. The newest changes remain in memory; open Saves and use Save current run to retry before closing this tab.');
    return false;
  }

  _saveStorageDirty = false;

  // The pending journal is already a durable commit. Backup and primary
  // publication are best-effort finalization; loadSaves() promotes the newest
  // authenticated generation after a crash or quota interruption.
  try {
    const currentRaw = localStorage.getItem(SAVES_KEY);
    if (currentRaw) {
      try {
        _saveParseCandidate(currentRaw, 'primary');
        localStorage.setItem(SAVES_BACKUP_KEY, currentRaw);
      } catch (e) {
        _saveQuarantine(currentRaw, `primary before overwrite: ${e && (e as any).message ? (e as any).message : e}`, 'primary');
      }
    }
  } catch (_e) { /* journal remains authoritative */ }

  try {
    localStorage.setItem(SAVES_KEY, raw);
    const primary = _saveParseCandidate(localStorage.getItem(SAVES_KEY), 'primary');
    if (!primary || primary.envelope.storage_digest !== envelope.storage_digest) {
      throw new Error('primary save envelope did not read back byte-authenticated');
    }
    localStorage.removeItem(SAVES_PENDING_KEY);
    _saveStorageGeneration = envelope.generation;
    _saveSetStorageNotice(null);
  } catch (e) {
    _saveStorageGeneration = envelope.generation;
    _saveSetStorageNotice('The newest save is safe in the recovery journal; primary storage will be repaired on the next read.');
    console.warn('saves primary publication deferred:', e);
  }
  return true;
}

function _saveLoadLifetimeStatsState() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      crystals_collected: (parsed && Number.isFinite(parsed.crystals_collected)) ? parsed.crystals_collected : 0,
      runs_finished: (parsed && Number.isFinite(parsed.runs_finished)) ? parsed.runs_finished : 0,
      applied_finish_ids: (parsed && Array.isArray(parsed.applied_finish_ids))
        ? parsed.applied_finish_ids.filter(id => typeof id === 'string')
        : [],
      applied_collection_ids: (parsed && Array.isArray(parsed.applied_collection_ids))
        ? parsed.applied_collection_ids.filter(id => typeof id === 'string')
        : [],
    };
  } catch (e) {
    return {
      crystals_collected: 0,
      runs_finished: 0,
      applied_finish_ids: [],
      applied_collection_ids: [],
    };
  }
}

function _saveQuarantineLifetimeStats(raw, reason) {
  if (typeof raw !== 'string') return false;
  try {
    const existing = localStorage.getItem(STATS_CORRUPT_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.raw === raw) return true;
      } catch (_e) { /* Replace an unreadable quarantine with the current bytes. */ }
    }
    const receipt = {
      captured_at: new Date().toISOString(),
      reason: String(reason || 'lifetime statistics authentication failed'),
      raw,
    };
    localStorage.setItem(STATS_CORRUPT_KEY, JSON.stringify(receipt));
    const verified = JSON.parse(localStorage.getItem(STATS_CORRUPT_KEY) || 'null');
    return !!verified && verified.raw === raw;
  } catch (_e) {
    return false;
  }
}

// Finish idempotence depends on applied_finish_ids. Transactional callers
// must distinguish an actually empty record from unreadable/corrupt storage;
// the permissive display reader above intentionally cannot make that claim.
function _saveStrictLifetimeStatsState(phase) {
  let raw = null;
  try {
    raw = localStorage.getItem(STATS_KEY);
  } catch (e) {
    throw new Error(`${phase}: lifetime statistics could not be read (${e && (e as any).message ? (e as any).message : e})`);
  }
  if (raw == null) {
    return {
      crystals_collected: 0,
      runs_finished: 0,
      applied_finish_ids: [],
      applied_collection_ids: [],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
        || !Number.isSafeInteger(parsed.crystals_collected) || parsed.crystals_collected < 0
        || !Number.isSafeInteger(parsed.runs_finished) || parsed.runs_finished < 0
        || (parsed.applied_finish_ids != null && !Array.isArray(parsed.applied_finish_ids))
        || (parsed.applied_collection_ids != null && !Array.isArray(parsed.applied_collection_ids))) {
      throw new Error('lifetime statistics have an invalid shape');
    }
    const appliedFinish = parsed.applied_finish_ids || [];
    const appliedCollection = parsed.applied_collection_ids || [];
    for (const [label, ids] of [['finish', appliedFinish], ['collection', appliedCollection]]) {
      const seen = new Set();
      for (const id of ids as any[]) {
        if (typeof id !== 'string' || !id || seen.has(id)) {
          throw new Error(`lifetime statistics contain invalid ${label} receipts`);
        }
        seen.add(id);
      }
    }
    return {
      crystals_collected: parsed.crystals_collected,
      runs_finished: parsed.runs_finished,
      applied_finish_ids: appliedFinish.slice(),
      applied_collection_ids: appliedCollection.slice(),
    };
  } catch (e) {
    const preserved = _saveQuarantineLifetimeStats(
      raw,
      `${phase}: ${e && (e as any).message ? (e as any).message : e}`,
    );
    throw new Error(`${phase}: lifetime statistics failed authentication; original bytes ${preserved ? 'were quarantined' : 'remain untouched'}`);
  }
}

function loadLifetimeStats() {
  const state = _saveLoadLifetimeStatsState();
  return {
    crystals_collected: state.crystals_collected,
    runs_finished: state.runs_finished,
  };
}
// Counters only go up. The Library is an inventory; this is a life list.
function bumpLifetimeStats(delta) {
  const s = _saveLoadLifetimeStatsState();
  if (delta && Number.isFinite(delta.crystals_collected)) s.crystals_collected += Math.max(0, delta.crystals_collected);
  if (delta && Number.isFinite(delta.runs_finished)) s.runs_finished += Math.max(0, delta.runs_finished);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  return { crystals_collected: s.crystals_collected, runs_finished: s.runs_finished };
}

function _saveApplyCreativeCollectionReceipts(rec, opts: any = {}) {
  const allReceipts = Array.isArray(rec?.collection_receipts) ? rec.collection_receipts : [];
  const receipts = Number.isSafeInteger(opts.cursor)
    ? allReceipts.filter(receipt => receipt.action_cursor === opts.cursor)
    : allReceipts.slice();
  if (!receipts.length) return { ok: true, count: 0, newSpecies: [] };
  const runId = rec.run_id || rec.id;
  try {
    const library = _saveStrictLibraryForFinish('Creative collection application');
    // Authenticate the counter state before mutating the Library. A later
    // stats write failure is recoverable from the already-durable save WAL.
    const stats = _saveStrictLifetimeStatsState('Creative collection application');
    const byId = new Map<string, any>(library.map(record => [record.id, record]));
    const beforeSpecies = new Set(library.map(record => record.mineral));
    const newSpecies = [];
    const mustExistAfterWrite = new Set();
    let libraryChanged = false;
    for (const receipt of receipts) {
      _saveAssertCollectionReceipt(receipt, runId);
      const alreadyApplied = stats.applied_collection_ids.includes(receipt.id);
      const atHistoricalCursor = Number.isSafeInteger(opts.cursor);
      if (atHistoricalCursor) {
        _saveAuthenticateCollectionReceiptAgainstLive(receipt, runId);
      } else if (!_saveHasAuthenticatedCollectionReceipt(receipt)) {
        if (!alreadyApplied) {
          throw new Error(`pending collection receipt ${receipt.id} lacks historical replay authentication`);
        }
        continue;
      }

      const prior = byId.get(receipt.record.id);
      if (prior && _saveSpecimenScienceDigest(prior) !== _saveSpecimenScienceDigest(receipt.record)) {
        throw new Error(`specimen ${receipt.record.id} conflicts with its collection receipt`);
      }
      if (!alreadyApplied && !prior) {
        library.push(receipt.record);
        byId.set(receipt.record.id, receipt.record);
        libraryChanged = true;
        mustExistAfterWrite.add(receipt.record.id);
        if (!beforeSpecies.has(receipt.record.mineral)) {
          newSpecies.push(receipt.record.mineral);
          beforeSpecies.add(receipt.record.mineral);
        }
      } else if (prior) {
        mustExistAfterWrite.add(receipt.record.id);
      }
      // alreadyApplied + missing means the completed specimen was deleted by
      // the player later. Preserve that deletion; the receipt remains lifetime
      // history and still marks this crystal as previously collected.
    }
    if (libraryChanged && !persistCrystals(library)) {
      throw new Error('the specimen Library rejected the Creative collection transaction');
    }
    const verifiedLibrary = new Map<string, any>(
      _saveStrictLibraryForFinish('Creative collection Library readback')
        .map(record => [record.id, record]),
    );
    for (const receipt of receipts) {
      if (!mustExistAfterWrite.has(receipt.record.id)) continue;
      const actual = verifiedLibrary.get(receipt.record.id);
      if (!actual || _saveSpecimenScienceDigest(actual) !== _saveSpecimenScienceDigest(receipt.record)) {
        throw new Error(`specimen ${receipt.record.id} failed collection readback`);
      }
    }

    let appliedCount = 0;
    for (const receipt of receipts) {
      if (!stats.applied_collection_ids.includes(receipt.id)) {
        if (!_saveHasAuthenticatedCollectionReceipt(receipt)) {
          throw new Error(`collection receipt ${receipt.id} was not authenticated at its action cursor`);
        }
        stats.crystals_collected += 1;
        stats.applied_collection_ids.push(receipt.id);
        appliedCount += 1;
      }
    }
    if (appliedCount > 0) {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      const verifiedStats = _saveStrictLifetimeStatsState('Creative collection statistics readback');
      if (verifiedStats.crystals_collected !== stats.crystals_collected
          || verifiedStats.runs_finished !== stats.runs_finished
          || receipts.some(receipt => !verifiedStats.applied_collection_ids.includes(receipt.id))) {
        throw new Error('Creative collection lifetime counters failed durable readback');
      }
    }
    for (const receipt of receipts) {
      if (!_saveHasAuthenticatedCollectionReceipt(receipt)) continue;
      const crystal = fortressSim?.crystals?.[receipt.crystal_index];
      if (crystal) {
        crystal._collectedRecordId = receipt.record.id;
        _SAVE_COLLECTION_MARKS.set(crystal, receipt.record.id);
      }
    }
    return { ok: true, count: appliedCount, newSpecies };
  } catch (e) {
    console.error('Creative collection transaction failed:', e);
    _saveWriteFailure(`The collection journal is safe, but its Library or lifetime transaction could not be committed (${e && (e as any).message ? (e as any).message : e}). Retry Collect or reload the save after storage is available.`);
    return { ok: false, count: 0, newSpecies: [] };
  }
}

function _saveCommitCreativeCollection(entries) {
  if (!_saveActiveRecord || _saveActiveRecord.status !== 'in-progress'
      || !Array.isArray(entries) || !entries.length) {
    return { ok: false, count: 0, newSpecies: [] };
  }
  const runId = _saveActiveRecord.run_id || _saveActiveRecord.id;
  const actionCursor = _saveActiveRecord.actions.length;
  if (!Array.isArray(_saveActiveRecord.collection_receipts)) {
    _saveActiveRecord.collection_receipts = [];
  }
  const byLineage = new Map(_saveActiveRecord.collection_receipts.map(receipt => [
    `${receipt.run_id}:${receipt.crystal_index}`,
    receipt,
  ]));
  for (const entry of entries) {
    const crystalIdx = entry?.record?.source?.crystal_index;
    if (entry?.record?.source?.run_id !== runId
        || !Number.isSafeInteger(crystalIdx) || fortressSim?.crystals?.[crystalIdx] !== entry.crystal) {
      return { ok: false, count: 0, newSpecies: [] };
    }
    const lineage = `${runId}:${crystalIdx}`;
    const existing = byLineage.get(lineage);
    if (existing) {
      if (!_saveHasAuthenticatedCollectionReceipt(existing)) {
        return { ok: false, count: 0, newSpecies: [] };
      }
      continue;
    }
    const receiptId = _saveCollectionReceiptId(runId, crystalIdx, actionCursor, entry.record);
    entry.record.id = _saveCollectionRecordId(receiptId);
    const receipt: any = {
      schema: 1,
      id: receiptId,
      run_id: runId,
      crystal_index: crystalIdx,
      action_cursor: actionCursor,
      record: entry.record,
    };
    receipt.digest = _saveCollectionReceiptDigest(receipt);
    _saveAuthenticateCollectionReceiptAgainstLive(receipt, runId);
    _saveActiveRecord.collection_receipts.push(receipt);
    byLineage.set(lineage, receipt);
  }

  // The save journal is the write-ahead commit. Nothing else moves until its
  // collection receipts and index mappings are durable.
  if (!_savePersistActive()) return { ok: false, count: 0, newSpecies: [] };
  return _saveApplyCreativeCollectionReceipts(_saveActiveRecord);
}

// ---------- capture helpers ----------

function _saveNewId() {
  return `save-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function _saveOriginLabel(origin) {
  if (!origin) return 'unknown vug';
  if (origin.type === 'scenario') return String(origin.scenario || 'scenario').replace(/_/g, ' ');
  if (origin.type === 'starter') {
    const p = (typeof FLUID_PRESETS !== 'undefined') ? FLUID_PRESETS[origin.presetId] : null;
    return p ? `starter: ${p.label}` : `starter: ${origin.presetId}`;
  }
  return 'custom vug';
}

// Read every broth slider's current string value. Sliders that don't
// exist (or parse non-finite — detached/stub DOM) are skipped: replay
// then skips them too, so both sides of the boundary agree.
function _saveCaptureBroth() {
  const out = {};
  if (typeof BROTH_MAP === 'undefined') return out;
  for (const [key, m] of Object.entries(BROTH_MAP)) {
    const slider = document.getElementById('broth-' + key) as HTMLInputElement | null;
    if (!slider) continue;
    const v = (m as any).parse(slider.value);
    const valid = (typeof _isBrothValueValid === 'function')
      ? _isBrothValueValid(m, v)
      : Number.isFinite(v);
    if (valid) out[key] = String(slider.value);
  }
  return out;
}

function _saveBrothDelta(now, last) {
  const delta = {};
  for (const [k, v] of Object.entries(now)) {
    if (!last || last[k] !== v) delta[k] = v;
  }
  return delta;
}

// Apply recorded broth values to UI, and optionally to canonical state.
// Action deltas and explicitly pending player edits use writeState=true.
// `broth_final` remains display-only: post-step slider values can be quantized
// echoes of continuous sim state (caught live: T 178.785 became 179 when that
// final temperature echo was once written back during replay).
function _saveApplyBroth(broth, writeState = false) {
  if (!broth || typeof BROTH_MAP === 'undefined') return;
  for (const [key, sv] of Object.entries(broth)) {
    if (!BROTH_MAP[key]) continue;
    const slider = document.getElementById('broth-' + key) as HTMLInputElement | null;
    if (slider) slider.value = sv as string;
    if (writeState) {
      const value = BROTH_MAP[key].parse(sv as string);
      const valid = (typeof _isBrothValueValid === 'function')
        ? _isBrothValueValid(BROTH_MAP[key], value)
        : Number.isFinite(value);
      if (valid) BROTH_MAP[key].set(value);
    }
  }
}

function _saveSummaryFromSim() {
  if (typeof fortressSim === 'undefined' || !fortressSim) return null;
  const crystals = fortressSim.crystals || [];
  let biggest = 0, biggestMineral = '';
  const minerals = new Set();
  for (const c of crystals) {
    minerals.add(c.mineral);
    if ((c.c_length_mm || 0) > biggest) { biggest = c.c_length_mm; biggestMineral = c.mineral; }
  }
  const cond = fortressSim.conditions;
  return {
    step: fortressSim.step || 0,
    crystals: crystals.length,
    minerals: Array.from(minerals),
    biggest_mm: +biggest.toFixed(2),
    biggest_mineral: biggestMineral,
    temperature: +(cond ? cond.temperature : 0).toFixed(0),
    pH: +(cond && cond.fluid ? cond.fluid.pH : 0).toFixed(1),
  };
}

function _saveCollectedPairs() {
  if (typeof fortressSim === 'undefined' || !fortressSim) return [];
  const byCrystal = new Map();
  const runId = _saveActiveRecord && (_saveActiveRecord.run_id || _saveActiveRecord.id);
  for (const receipt of (_saveActiveRecord?.collection_receipts || [])) {
    if (receipt?.run_id === runId && Number.isSafeInteger(receipt.crystal_index)) {
      byCrystal.set(receipt.crystal_index, receipt.record?.id);
    }
  }
  (fortressSim.crystals || []).forEach((c, idx) => {
    if (c && c._collectedRecordId) byCrystal.set(idx, c._collectedRecordId);
  });
  return Array.from(byCrystal.entries())
    .filter(pair => typeof pair[1] === 'string' && pair[1])
    .sort((a, b) => a[0] - b[0]);
}

// A historical event receipt and its lexical marker may bind a specimen that
// was collected before the crystal's final state. The stable lineage fields
// below distinguish that authenticated earlier projection from an unrelated
// Library specimen without pretending it equals the later crystal byte-for-byte.
function _saveLegacyRecordMatchesCrystal(record, crystal) {
  return !!record && !!crystal
    && record.mineral === crystal.mineral
    && record.source?.mode === 'creative'
    && record.source?.nucleation_step === crystal.nucleation_step
    && +(record.source?.nucleation_temp) === +(+crystal.nucleation_temp).toFixed(1);
}

function _saveScenarioSpecHash(origin) {
  if (!origin || origin.type !== 'scenario') return null;
  const make = (typeof SCENARIOS !== 'undefined') ? SCENARIOS[origin.scenario] : null;
  return make && typeof make._scenario_spec_hash === 'string'
    ? make._scenario_spec_hash
    : null;
}

// Scientific recipes use the same fail-closed identity invariant as strips.
// Keep this pure so the load gate and Saves-menu label share one verdict.
function _saveReplayCompatibility(rec) {
  if (!rec || (rec.format !== 2 && rec.format !== SAVE_FORMAT)) {
    return {
      ok: false,
      reason: `This save uses format v${rec && rec.format}; this build reads v${SAVE_FORMAT}. It can't be restored.`,
    };
  }
  const shapeReason = _saveRecordShapeReason(rec);
  if (shapeReason) {
    return {
      ok: false,
      reason: `Save schema authentication failed: ${shapeReason}. Replay is blocked.`,
    };
  }
  if (rec.format === 2 && rec.run_id == null
      && (!Array.isArray(rec.collection_receipts) || rec.collection_receipts.length === 0)
      && (rec.collected || []).length > 0) {
    return {
      ok: false,
      reason: 'This format-v2 save contains pre-event collection mappings with no action cursor or authenticated receipt. The recipe is preserved for diagnosis, but replay is blocked rather than promoting unverifiable specimen ownership.',
    };
  }
  const nowV = (typeof SIM_VERSION !== 'undefined') ? SIM_VERSION : null;
  if (rec.sim_version == null || nowV == null || rec.sim_version !== nowV) {
    return {
      ok: false,
      reason: `SIM identity mismatch: this recipe records v${rec.sim_version ?? 'unknown'}, but this build is v${nowV ?? 'unknown'}. Replay is blocked because the physics may differ.`,
    };
  }
  const nowDigest = (typeof MODEL_DIGEST !== 'undefined') ? MODEL_DIGEST : null;
  if (!rec.model_digest || !nowDigest || rec.model_digest !== nowDigest) {
    return {
      ok: false,
      reason: 'Scientific model digest mismatch: this recipe was recorded under different or unidentified equations. Replay is blocked rather than producing a different specimen.',
    };
  }
  const recipeDigest = _saveRecipeDigest(rec);
  if (!rec.recipe_digest || rec.recipe_digest !== recipeDigest) {
    return {
      ok: false,
      reason: 'Save recipe digest mismatch: its origin, action log, controls, or collection map changed. Replay is blocked.',
    };
  }
  if (rec.origin && rec.origin.type === 'scenario') {
    const currentHash = _saveScenarioSpecHash(rec.origin);
    if (!rec.scenario_spec_hash || !currentHash || rec.scenario_spec_hash !== currentHash) {
      return {
        ok: false,
        reason: `Scenario specification mismatch for "${rec.origin.scenario}": its starting geology or events changed (or were not identified). Replay is blocked.`,
      };
    }
  }
  return { ok: true, reason: '' };
}

function _saveSealActiveState() {
  if (!_saveActiveRecord) return;
  const sim = _liveFortressSim();
  if (sim && typeof simulationStateFingerprint === 'function') {
    _saveActiveRecord.replay_state_digest = simulationStateFingerprint(sim);
    _saveActiveRecord.replay_integrity = 'state-fingerprint-v1';
  }
  _saveActiveRecord.recipe_digest = _saveRecipeDigest(_saveActiveRecord);
}

function _saveBuildFinishTransaction() {
  if (!_saveActiveRecord || typeof fortressSim === 'undefined' || !fortressSim) return null;
  const runId = _saveActiveRecord.run_id || _saveActiveRecord.id;
  const libraryBefore = _saveStrictLibraryForFinish('finish staging');
  const beforeMinerals = new Set(libraryBefore.map(record => record.mineral));
  const libraryIds = new Set(libraryBefore.map(record => record.id));
  const occupiedIds = new Set(libraryIds);
  const existingCollected = [];
  const staged = [];
  (fortressSim.crystals || []).forEach((crystal, crystalIdx) => {
    if (!crystal || !((crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0)) return;
    if (crystal._collectedRecordId) {
      if (libraryIds.has(crystal._collectedRecordId)) {
        existingCollected.push([crystalIdx, crystal._collectedRecordId]);
        return;
      }
      if (_SAVE_COLLECTION_MARKS.get(crystal) === crystal._collectedRecordId) {
        return; // deliberately deleted after a completed collection receipt
      }
    }
    const record = buildCrystalRecord(
      crystal,
      _saveFinishSpecimenMeta(runId, crystalIdx),
    );
    record.id = _saveAllocateFinishRecordId(runId, crystalIdx, occupiedIds);
    staged.push({
      crystalIdx,
      record,
    });
  });
  _saveDisambiguateFinishNames(staged);

  const newSpecies = [];
  const seen = new Set(beforeMinerals);
  for (const item of staged) {
    if (!seen.has(item.record.mineral)) {
      newSpecies.push(item.record.mineral);
      seen.add(item.record.mineral);
    }
  }
  const tx: any = {
    schema: 1,
    id: `finish:${_saveActiveRecord.id}`,
    run_id: runId,
    library_baseline: libraryBefore.map(record => ({
      id: record.id,
      mineral: String(record.mineral || ''),
      record_digest: _saveLibraryRecordDigest(record),
      science_digest: _saveSpecimenScienceDigest(record),
    })),
    library_records: staged.map(item => item.record),
    collected: existingCollected
      .concat(staged.map(item => [item.crystalIdx, item.record.id]))
      .sort((a, b) => a[0] - b[0]),
    new_species: newSpecies,
    crystals_collected_delta: staged.length,
    runs_finished_delta: 1,
  };
  tx.digest = _saveFinishTransactionDigest(tx);
  _saveAssertFinishTransaction(tx, _saveActiveRecord.id, runId);
  _saveAuthenticateFinishTransactionAgainstLive(
    tx,
    _saveActiveRecord.id,
    libraryBefore,
    { runId },
  );
  return tx;
}

function _saveApplyFinishTransaction(tx, saveId) {
  try {
    _saveAssertFinishTransaction(tx, saveId);
    const library = _saveStrictLibraryForFinish('finish application');
    _saveAuthenticateFinishTransactionAgainstLive(tx, saveId, library);
    const byId = new Map(library.map(record => [record.id, record]));
    let libraryChanged = false;
    for (const record of tx.library_records) {
      const prior = byId.get(record.id);
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(record)) {
          throw new Error(`specimen ${record.id} conflicts with its finish receipt`);
        }
        continue;
      }
      library.push(record);
      byId.set(record.id, record);
      libraryChanged = true;
    }
    if (libraryChanged && !persistCrystals(library)) {
      throw new Error('the specimen Library rejected the finish transaction');
    }
    const verifiedRecords = _saveStrictLibraryForFinish('finish Library readback');
    const verifiedLibrary = new Map(verifiedRecords.map(record => [record.id, record]));
    for (const record of tx.library_records) {
      const actual = verifiedLibrary.get(record.id);
      if (!actual || JSON.stringify(actual) !== JSON.stringify(record)) {
        throw new Error(`specimen ${record.id} failed durable readback`);
      }
    }
    for (const pair of tx.collected) {
      if (!verifiedLibrary.has(pair[1])) {
        throw new Error(`collected specimen ${pair[1]} is missing from the Library`);
      }
    }

    const stats = _saveStrictLifetimeStatsState('finish application');
    if (!stats.applied_finish_ids.includes(tx.id)) {
      stats.crystals_collected += tx.crystals_collected_delta;
      stats.runs_finished += tx.runs_finished_delta;
      stats.applied_finish_ids.push(tx.id);
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      const verifiedStats = _saveStrictLifetimeStatsState('finish statistics readback');
      if (!verifiedStats.applied_finish_ids.includes(tx.id)
          || verifiedStats.crystals_collected !== stats.crystals_collected
          || verifiedStats.runs_finished !== stats.runs_finished) {
        throw new Error('lifetime counters failed durable readback');
      }
    }

    for (const pair of tx.collected) {
      const crystal = fortressSim && fortressSim.crystals && fortressSim.crystals[pair[0]];
      if (crystal) crystal._collectedRecordId = pair[1];
    }
    if (typeof libraryRender === 'function'
        && document.getElementById('library-panel')
        && document.getElementById('library-panel').style.display !== 'none') {
      libraryRender();
    }
    if (typeof refreshTitleLoadButton === 'function') refreshTitleLoadButton();
    return {
      ok: true,
      count: tx.library_records.length,
      newSpecies: tx.new_species.slice(),
      lifetime: loadLifetimeStats(),
    };
  } catch (e) {
    console.error('finish transaction apply failed:', e);
    _saveWriteFailure(`The run's finish journal is safe, but its Library or lifetime transaction could not be committed (${e && (e as any).message ? (e as any).message : e}). The run remains in memory; open Saves and retry before closing this tab.`);
    return { ok: false, count: 0, newSpecies: [], lifetime: loadLifetimeStats() };
  }
}

// ---------- recording hooks (called from 97/94 via typeof guards) ----------

// A fortress run just began. Create its rolling autosave.
function _saveNoteBegin(origin) {
  if (_fortressReplaying) return; // the replay driver adopts records itself
  if (typeof _clearBrothPlayerChanges === 'function') _clearBrothPlayerChanges();
  const recordId = _saveNewId();
  _saveActiveRecord = {
    id: recordId,
    run_id: recordId,
    format: SAVE_FORMAT,
    collection_epoch: SAVE_COLLECTION_EPOCH,
    sim_version: (typeof SIM_VERSION !== 'undefined') ? SIM_VERSION : null,
    model_digest: (typeof MODEL_DIGEST !== 'undefined') ? MODEL_DIGEST : null,
    scenario_spec_hash: _saveScenarioSpecHash(origin),
    kind: 'auto',
    status: 'in-progress',
    name: `Autosave — ${_saveOriginLabel(origin)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    origin,
    actions: [],
    broth_final: null,
    pending_broth: null,
    collected: [],
    collection_receipts: [],
    summary: _saveSummaryFromSim(),
    replay_state_digest: null,
    replay_integrity: 'state-fingerprint-v1',
  };
  _saveSealActiveState();
  _saveLastBroth = _saveCaptureBroth();
  const items = loadSaves();
  items.push(_saveActiveRecord);
  persistSaves(_savePruneAutosaves(items));
}

// One fortressStep verb is about to dispatch. Record it + the broth
// sliders that changed since the last recorded action.
function _saveRecordAction(action, payload) {
  if (_fortressReplaying || !_saveActiveRecord || _saveActiveRecord.status !== 'in-progress') return;
  const broth = _saveCaptureBroth();
  const delta = (typeof _peekBrothPlayerChanges === 'function')
    ? _peekBrothPlayerChanges()
    : _saveBrothDelta(broth, _saveLastBroth);
  const entry: any = { a: action };
  if (payload !== undefined && payload !== null) entry.p = payload;
  if (Object.keys(delta).length) entry.b = delta;
  _savePendingAction = { entry, broth };
}

// Commit only after fortressStep has completed its synchronous geology. A
// renderer/pacing crash cannot leave a half-applied verb authenticated as a
// completed recipe action; the prior storage generation remains recoverable.
function _saveCommitAction() {
  if (_fortressReplaying || !_saveActiveRecord || !_savePendingAction) return false;
  _saveActiveRecord.actions.push(_savePendingAction.entry);
  _saveLastBroth = _savePendingAction.broth;
  _savePendingAction = null;
  if (typeof _consumeBrothPlayerChanges === 'function') _consumeBrothPlayerChanges();
  return _savePersistActive();
}

// Re-snapshot the mutable fields + write through. Cheap enough to run
// per action; also the mode-leave hook (94-ui-menu switchMode).
function _savePersistActive() {
  if (_fortressReplaying || !_saveActiveRecord) return false;
  _saveActiveRecord.updated_at = new Date().toISOString();
  _saveActiveRecord.summary = _saveSummaryFromSim() || _saveActiveRecord.summary;
  _saveActiveRecord.broth_final = _saveCaptureBroth();
  const pending = (typeof _peekBrothPlayerChanges === 'function')
    ? _peekBrothPlayerChanges()
    : {};
  _saveActiveRecord.pending_broth = Object.keys(pending).length ? pending : null;
  _saveActiveRecord.collected = _saveActiveRecord.finish_transaction
    ? _saveActiveRecord.finish_transaction.collected.map(pair => pair.slice())
    : _saveCollectedPairs();
  _saveSealActiveState();
  const items = loadSaves();
  const idx = items.findIndex(s => s.id === _saveActiveRecord.id);
  if (idx >= 0) items[idx] = _saveActiveRecord; else items.push(_saveActiveRecord);
  return persistSaves(items);
}

// Narrate, Collect & Save sealed the run. Returns display info for the log.
function _saveMarkFinished() {
  if (_fortressReplaying || !_saveActiveRecord) return null;
  const name = _saveActiveRecord.name;
  if (Array.isArray(_saveActiveRecord.collection_receipts)
      && _saveActiveRecord.collection_receipts.length) {
    const collectionApplied = _saveApplyCreativeCollectionReceipts(_saveActiveRecord);
    if (!collectionApplied.ok) return { name, saved: false };
  }
  if (!_saveActiveRecord.finish_transaction) {
    try {
      _saveActiveRecord.finish_transaction = _saveBuildFinishTransaction();
    } catch (e) {
      console.error('finish transaction staging failed:', e);
      _saveWriteFailure(`Finish could not be staged because its Library baseline was not authenticated (${e && (e as any).message ? (e as any).message : e}). Existing Library bytes were not overwritten; repair or export them before retrying.`);
      return { name, saved: false };
    }
    if (!_saveActiveRecord.finish_transaction) return { name, saved: false };
  }
  const tx = _saveActiveRecord.finish_transaction;
  _saveActiveRecord.collected = tx.collected.map(pair => pair.slice());

  // Write-ahead: no Library specimen or lifetime counter changes until the
  // complete, authenticated finish transaction itself is durable.
  if (_saveActiveRecord.status !== 'finished') {
    _saveActiveRecord.status = 'finishing';
    if (!_savePersistActive()) return { name, saved: false };
  }
  const applied = _saveApplyFinishTransaction(tx, _saveActiveRecord.id);
  if (!applied.ok) return { name, saved: false };
  _saveActiveRecord.status = 'finished';
  if (!_savePersistActive()) return { name, saved: false };
  _saveActiveRecord = null; // run over — nothing more to record
  _saveLastBroth = null;
  _savePendingAction = null;
  return {
    name,
    saved: true,
    count: applied.count,
    newSpecies: applied.newSpecies,
    lifetime: applied.lifetime,
  };
}

// Reset button / replay teardown — drop the recording state. The
// persisted autosave keeps whatever was last written (an abandoned
// in-progress run stays loadable — that's the point of autosave).
function _saveNoteReset() {
  _saveActiveRecord = null;
  _saveLastBroth = null;
  _savePendingAction = null;
  if (typeof _clearBrothPlayerChanges === 'function') _clearBrothPlayerChanges();
}

// Keep the newest MAX_AUTOSAVES autosaves (by updated_at); the active
// record is always exempt. Manual saves pass through untouched.
function _savePruneAutosaves(items) {
  const autos = items.filter(s =>
    s.kind === 'auto'
    && s.status !== 'finishing'
    && (!_saveActiveRecord || s.id !== _saveActiveRecord.id));
  if (autos.length <= MAX_AUTOSAVES) return items;
  autos.sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
  const drop = new Set(autos.slice(0, autos.length - MAX_AUTOSAVES).map(s => s.id));
  return items.filter(s => !drop.has(s.id));
}

// ---------- manual save ----------

function _saveManualNamed(name) {
  if (!_saveActiveRecord || _saveActiveRecord.status !== 'in-progress') return null;
  if (!_savePersistActive()) return null; // retain active data for an explicit retry
  const copy = JSON.parse(JSON.stringify(_saveActiveRecord));
  copy.id = _saveNewId();
  copy.kind = 'manual';
  copy.name = name;
  copy.created_at = new Date().toISOString();
  copy.updated_at = copy.created_at;
  const items = loadSaves();
  items.push(copy);
  if (!persistSaves(items)) {
    alert('Could not save — localStorage is full or unavailable.');
    return null;
  }
  return copy;
}

function saveManualSave() {
  if (!_saveActiveRecord || typeof fortressSim === 'undefined' || !fortressSim) {
    alert('No active Creative run to save. Begin a run first — it autosaves as you play.');
    return;
  }
  if (_saveActiveRecord.status !== 'in-progress') {
    _saveMarkFinished();
    if (typeof savesRender === 'function') savesRender();
    return;
  }
  const def = `${_saveOriginLabel(_saveActiveRecord.origin)} — step ${(fortressSim && fortressSim.step) || 0}`;
  const chosen = (typeof prompt === 'function') ? prompt('Name this save:', def) : def;
  if (chosen === null) return; // cancelled
  const rec = _saveManualNamed(String(chosen || '').trim() || def);
  if (rec && typeof savesRender === 'function') savesRender();
}

// ---------- load (deterministic replay) ----------

function _saveRebuildOrigin(origin) {
  if (!origin) throw new Error('save has no origin');
  if (origin.type === 'scenario') {
    if (typeof SCENARIOS === 'undefined' || !SCENARIOS[origin.scenario]) {
      throw new Error(`scenario "${origin.scenario}" is not registered in this build`);
    }
    fortressBeginFromScenario(origin.scenario, origin.seed);
  } else if (origin.type === 'starter') {
    if (typeof FLUID_PRESETS === 'undefined' || !FLUID_PRESETS[origin.presetId]) {
      throw new Error(`starter fluid "${origin.presetId}" is not registered in this build`);
    }
    fortressBeginFromStarterFluid(origin.presetId, origin.seed);
  } else if (origin.type === 'custom') {
    _fortressBeginCustomFromParams(origin.params, origin.seed);
  } else {
    throw new Error(`unknown save origin type "${origin.type}"`);
  }
}

function loadSaveById(id) {
  const rec = loadSaves().find(s => s.id === id);
  if (!rec) return false;
  const persistedRunId = rec.run_id ?? null;
  const compatibility = _saveReplayCompatibility(rec);
  if (!compatibility.ok) {
    alert(compatibility.reason);
    return false;
  }
  // switchMode wires the topo canvases — harmless to skip when it
  // fails (headless drives have no canvas; the replay itself is pure
  // sim + log DOM).
  if (typeof switchMode === 'function') {
    try { switchMode('fortress'); } catch (e) { console.warn('saves: switchMode failed (headless?):', e); }
  }
  if (typeof fortressReset === 'function') fortressReset();

  const priorInstant = (typeof _fortressInstantLines !== 'undefined') ? _fortressInstantLines : false;
  _fortressReplaying = true;
  if (typeof setFortressInstantLines === 'function') setFortressInstantLines(true);
  let ok = false;
  try {
    _saveRebuildOrigin(rec.origin);
    const applyCollectionsAtCursor = (cursor) => {
      if (!Array.isArray(rec.collection_receipts) || !rec.collection_receipts.length) return;
      const collectionApplied = _saveApplyCreativeCollectionReceipts(rec, { cursor });
      if (!collectionApplied.ok) {
        throw new Error(`Creative collection receipts failed at action cursor ${cursor}`);
      }
    };
    applyCollectionsAtCursor(0);
    for (let actionIdx = 0; actionIdx < (rec.actions || []).length; actionIdx++) {
      const entry = rec.actions[actionIdx];
      if (entry.b) _saveApplyBroth(entry.b, true);
      fortressStep(entry.a, (entry.p !== undefined) ? entry.p : undefined);
      applyCollectionsAtCursor(actionIdx + 1);
    }
    // A live control writes state immediately. If it was the last thing the
    // player did before saving/leaving, no later action exists to carry its
    // delta, so restore that tail explicitly after replaying the action log.
    if (rec.pending_broth) _saveApplyBroth(rec.pending_broth, true);
    if (rec.broth_final) _saveApplyBroth(rec.broth_final, false);
    if (rec.replay_state_digest && typeof simulationStateFingerprint === 'function') {
      const replayDigest = simulationStateFingerprint(fortressSim);
      if (replayDigest !== rec.replay_state_digest) {
        throw new Error(`deterministic replay digest mismatch: expected ${rec.replay_state_digest}, got ${replayDigest}`);
      }
    }
    if (rec.finish_transaction) {
      const library = _saveStrictLibraryForFinish('save replay');
      _saveAuthenticateFinishTransactionAgainstLive(
        rec.finish_transaction,
        rec.id,
        library,
        {
          requireLibrary: rec.status === 'finishing',
          runId: persistedRunId,
        },
      );
    }
    if (rec.format === 2 && rec.status !== 'finished') {
      // The v2 recipe was authenticated before this one-way migration. From
      // this adoption forward v3 makes run lineage and event-cursor receipts
      // mandatory, so a modern record cannot fall back into the weak bridge.
      rec.format = SAVE_FORMAT;
      rec.run_id = rec.run_id || rec.id;
      rec.collection_epoch = SAVE_COLLECTION_EPOCH;
      rec.collection_receipts = rec.collection_receipts || [];
    }
    // Re-mark crystals already in the Library (crystal order is
    // deterministic under replay, so index pairing is stable).
    if (rec.status === 'finished') {
      for (const pair of (rec.collected || [])) {
        const c = fortressSim && fortressSim.crystals && fortressSim.crystals[pair[0]];
        if (c) c._collectedRecordId = pair[1];
      }
    }
    if (rec.status === 'finished' && typeof fortressFinish === 'function') {
      fortressFinish(); // re-narrates; collect/save/stats are replay-guarded
    }
    ok = true;
  } catch (e) {
    console.error('save restore failed:', e);
    alert(`Could not restore "${rec.name}" — ${e && (e as any).message ? (e as any).message : e}`);
    if (typeof fortressReset === 'function') fortressReset();
  } finally {
    _fortressReplaying = false;
    if (typeof setFortressInstantLines === 'function') setFortressInstantLines(priorInstant);
  }
  if (!ok) return false;

  // Adopt recording state so continued play keeps autosaving:
  //   in-progress AUTO save   → resume updating that very record.
  //   in-progress MANUAL save → fresh autosave seeded with its history
  //                             (the manual save stays frozen).
  //   finished save           → nothing left to record.
  if (rec.status === 'finished') {
    _saveActiveRecord = null;
    _saveLastBroth = null;
    _savePendingAction = null;
  } else if (rec.status === 'finishing') {
    _saveActiveRecord = rec;
    _saveLastBroth = _saveCaptureBroth();
    _savePendingAction = null;
    const finishInfo = _saveMarkFinished();
    if (finishInfo && finishInfo.saved && typeof fortressFinish === 'function') {
      _fortressReplaying = true;
      try { fortressFinish(); } finally { _fortressReplaying = false; }
    } else {
      fortressActive = false;
      document.querySelectorAll('.action-grid .action-btn').forEach(btn => btn.disabled = true);
    }
  } else if (rec.kind === 'auto') {
    _saveActiveRecord = rec;
    _saveLastBroth = _saveCaptureBroth();
    _savePendingAction = null;
    _saveSealActiveState();
    _savePersistActive();
  } else {
    const copy = JSON.parse(JSON.stringify(rec));
    copy.id = _saveNewId();
    copy.kind = 'auto';
    copy.name = `Autosave — ${_saveOriginLabel(rec.origin)}`;
    _saveActiveRecord = copy;
    _saveLastBroth = _saveCaptureBroth();
    _savePendingAction = null;
    _saveSealActiveState();
    const items = loadSaves();
    items.push(copy);
    persistSaves(_savePruneAutosaves(items));
  }

  // Post-restore housekeeping. Identity was proved before replay state changed.
  const logEl = document.getElementById('fortress-log');
  const steps = (typeof fortressSim !== 'undefined' && fortressSim) ? fortressSim.step : 0;
  const lines = [`💾 Restored "${rec.name}" — ${(rec.actions || []).length} actions replayed to step ${steps}.`];
  for (const line of lines) {
    fortressLogLines.push(line);
    if (logEl && typeof appendFortressLine === 'function') appendFortressLine(logEl, line);
  }
  if (typeof updateFortressStatus === 'function') updateFortressStatus();
  if (typeof updateFortressInventory === 'function') updateFortressInventory();
  if (typeof syncBrothSliders === 'function') syncBrothSliders();
  if (typeof topoRender === 'function') { try { topoRender(); } catch (_e) { /* canvas-less env */ } }
  return true;
}

// ---------- save menu panel ----------

function deleteSaveById(id) {
  const rec = loadSaves().find(s => s.id === id);
  if (!rec) return;
  if (typeof confirm === 'function' && !confirm(`Delete save "${rec.name}"?`)) return;
  if (!persistSaves(loadSaves().filter(s => s.id !== id))) {
    savesRender();
    return false;
  }
  if (_saveActiveRecord && _saveActiveRecord.id === id) _saveNoteReset();
  savesRender();
  return true;
}

function renameSaveById(id) {
  const items = loadSaves();
  const rec = items.find(s => s.id === id);
  if (!rec) return;
  const next = (typeof prompt === 'function') ? prompt('Rename save:', rec.name) : null;
  if (next === null || next === undefined) return;
  const renamed = String(next).trim() || rec.name;
  rec.name = renamed;
  if (!persistSaves(items)) {
    savesRender();
    return false;
  }
  if (_saveActiveRecord && _saveActiveRecord.id === id) _saveActiveRecord.name = renamed;
  savesRender();
  return true;
}

function _savesFmtDate(iso) {
  if (!iso) return '';
  // Compact field-note stamp: "2026-07-08 14:32"
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : String(iso);
}

function savesRender() {
  const items = loadSaves().slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const stats = loadLifetimeStats();
  const statsEl = document.getElementById('saves-stats');
  if (statsEl) {
    statsEl.textContent =
      `💎 ${stats.crystals_collected} crystal${stats.crystals_collected === 1 ? '' : 's'} collected all-time · ` +
      `🏁 ${stats.runs_finished} run${stats.runs_finished === 1 ? '' : 's'} narrated`;
  }
  const manualBtn = document.getElementById('saves-manual-btn') as HTMLButtonElement | null;
  if (manualBtn) {
    const active = !!(_saveActiveRecord && typeof fortressSim !== 'undefined' && fortressSim);
    const finishing = !!(_saveActiveRecord && _saveActiveRecord.status !== 'in-progress');
    manualBtn.disabled = !active;
    manualBtn.textContent = finishing ? '↻ Retry finish transaction' : '💾 Save current run';
    manualBtn.title = active
      ? (finishing ? 'Retry the authenticated Library, lifetime, and save transaction' : 'Freeze a named copy of the current Creative run')
      : 'No active Creative run — begin one; it autosaves as you play';
  }

  const storageNotice = document.getElementById('saves-storage-notice');
  if (storageNotice) {
    storageNotice.textContent = _saveStorageNotice || '';
    storageNotice.style.display = _saveStorageNotice ? 'block' : 'none';
  }

  const listEl = document.getElementById('saves-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'saves-empty';
    empty.textContent = 'No saves yet — begin a Creative run; it autosaves as you play.';
    listEl.appendChild(empty);
    return;
  }
  for (const rec of items) {
    const row = document.createElement('div');
    row.className = 'save-row';

    const head = document.createElement('div');
    head.className = 'save-row-head';
    const badge = document.createElement('span');
    badge.className = 'save-badge ' + (rec.kind === 'manual' ? 'manual' : 'auto');
    badge.textContent = rec.kind === 'manual' ? 'MANUAL' : 'AUTO';
    const name = document.createElement('span');
    name.className = 'save-name';
    name.textContent = rec.name || '(unnamed)';
    const status = document.createElement('span');
    const compatibility = _saveReplayCompatibility(rec);
    status.className = 'save-status ' + (!compatibility.ok ? 'incompatible' : (rec.status === 'finished' ? 'finished' : 'progress'));
    status.textContent = !compatibility.ok
      ? '⚠ incompatible model'
      : (rec.status === 'finished' ? '📜 narrated' : (rec.status === 'finishing' ? '↻ finish pending' : '⏳ in progress'));
    if (compatibility.ok && _saveActiveRecord && rec.id === _saveActiveRecord.id) status.textContent += ' · live';
    if (!compatibility.ok) status.title = compatibility.reason;
    head.appendChild(badge);
    head.appendChild(name);
    head.appendChild(status);

    const meta = document.createElement('div');
    meta.className = 'save-row-meta';
    const s = rec.summary || {};
    const parts = [
      `step ${s.step ?? 0}`,
      `${s.crystals ?? 0} crystal${(s.crystals ?? 0) === 1 ? '' : 's'}`,
    ];
    if (s.biggest_mm) parts.push(`biggest ${s.biggest_mm} mm ${s.biggest_mineral || ''}`.trim());
    if (s.temperature != null) parts.push(`${s.temperature}°C`);
    if (s.pH != null) parts.push(`pH ${s.pH}`);
    if (rec.sim_version != null) parts.push(`SIM v${rec.sim_version}`);
    parts.push(_savesFmtDate(rec.updated_at));
    meta.textContent = parts.join(' · ');

    const actions = document.createElement('div');
    actions.className = 'save-row-actions';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.disabled = !compatibility.ok;
    loadBtn.title = compatibility.ok
      ? 'Re-grow this run from its identity-verified recipe (seed + actions)'
      : compatibility.reason;
    loadBtn.onclick = () => loadSaveById(rec.id);
    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => renameSaveById(rec.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteSaveById(rec.id);
    actions.appendChild(loadBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    row.appendChild(head);
    row.appendChild(meta);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
}
