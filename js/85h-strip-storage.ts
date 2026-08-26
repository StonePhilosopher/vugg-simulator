// ============================================================
// js/85h-strip-storage.ts — IndexedDB persistence for strip datasets
// ============================================================
// Phase B (post-Phase-1 carbonate): strip view bedrock.
//
// THE HELICOID-AS-RECORDER REFRAME (Shy's framing, 2026-05-26)
//
// The recorder (85g) produces a StripDataset at end-of-run. This module
// is the persistence layer: save / load / list / delete in IndexedDB,
// keyed by (scenario_id, seed, recorded_at). Browser-native, async,
// gigabyte-scale.
//
// SCHEMA
//
//   Database: 'vugg-strip-datasets'
//   Object store: 'datasets'
//     - keyPath: 'key' (auto-built string: scenario_id + '@' + seed + '#' + recorded_at)
//     - indexes:
//        - 'by_scenario' (scenario_id) — list datasets for one scenario
//        - 'by_recorded_at' (recorded_at) — sort newest-first
//     - record shape: {
//         key: string,
//         manifest: StripManifest,   // JSON object
//         chip_data: Uint8Array,     // raw binary (NOT base64)
//         nucleation_events: StripNucleationEvent[],
//         compressed: boolean,       // whether chip_data is gzipped
//       }
//
// COMPRESSION
//
// Datasets are stored UNCOMPRESSED in IndexedDB (browser handles binary
// storage efficiently; gzip costs CPU on save AND load). For DOWNLOAD
// as a shareable file, callers should use stripSerialize(ds, gzip=true)
// from 85f-strip-dataset.ts. The download path = IDB load + serialize.
//
// QUOTA + EVICTION
//
// Modern browsers grant ~hundreds of MB to GB of IndexedDB. The
// recorder produces ~5 MB per typical 200-step run; a power user
// could accumulate dozens before hitting quota. v1 has no automatic
// eviction — users delete manually from the strip view tab. Future
// improvement: ringbuffer with N-most-recent or oldest-first eviction.
//
// SSR / TESTING
//
// indexedDB is browser-only. The persistence functions check for it
// and return a sentinel "not available" rejection in non-browser
// contexts so tests don't crash. Tests that need IDB use the
// fake-indexeddb shim or skip persistence.
//
// ============================================================

// === HELIX-OVERLAY-FORK ADDITION (strip view bedrock, v149+) =========

const _STRIP_DB_NAME = 'vugg-strip-datasets';
const _STRIP_DB_VERSION = 1;
const _STRIP_STORE = 'datasets';

interface StripStoredRecord {
  key: string;
  // Production recordings and uploaded files are separate evidence domains.
  // Legacy rows may omit this and are inferred from their key only.
  origin?: 'production-run' | 'imported-file';
  // SHA-256 of stripSerialize(dataset, false). This binds the manifest,
  // tensors, events, and every testimony channel—not merely the list-row
  // header. Older records may omit it and remain readable, but can never
  // commission a guided tutorial product receipt.
  dataset_digest_sha256?: string;
  manifest: StripManifest;
  chip_data: Uint8Array;
  nucleation_events: StripNucleationEvent[];
  floor_data?: Uint8Array;   // format_version 3 depletion-floor channel (optional)
  pressure_phase_testimony?: any[];
  stress_event_testimony?: any[];
  transformation_event_testimony?: StripTransformationEvent[];
  carbonate_boundary_testimony?: any[];
  sulfur_ledger_testimony?: any[];
  fluid_boundary_testimony?: any[];
  enclosure_testimony?: any[];
  player_action_testimony?: any[];
  layer_growth_testimony?: any[];
  habit_morphology_testimony?: any[];
}

interface StripListEntry {
  key: string;
  manifest: StripManifest;
  origin: 'production-run' | 'imported-file';
  dataset_digest_sha256?: string;
}

interface StripDurableRunReceipt {
  key: string;
  scenario_id: string;
  seed: number;
  recorded_at: number;
  sim_version: number;
  model_digest: string;
  scenario_spec_hash: string;
  manifest_digest_sha256: string;
  dataset_digest_sha256: string;
}

// 70a/99k use this lexical receipt to distinguish the recording produced by
// the current Simulation run from an older or uploaded look-alike. It is set
// only after the IndexedDB transaction commits, never on request.onsuccess.
let _stripLatestDurableRunReceipt: StripDurableRunReceipt | null = null;

function stripDurableManifestDigest(manifest: StripManifest): string {
  return sha256HexUtf8(JSON.stringify(manifest));
}

async function stripDurableDatasetDigest(ds: StripDataset): Promise<string> {
  return sha256HexBytes(await stripSerialize(ds, false));
}

function _stripDurableRunReceipt(
  key: string,
  manifest: StripManifest,
  datasetDigestSha256: string,
): StripDurableRunReceipt {
  if (!/^[0-9a-f]{64}$/.test(datasetDigestSha256)) {
    throw new Error('strip: invalid durable dataset digest');
  }
  return Object.freeze({
    key: String(key),
    scenario_id: String(manifest.scenario_id || ''),
    seed: Number(manifest.seed),
    recorded_at: Number(manifest.recorded_at),
    sim_version: Number(manifest.sim_version),
    model_digest: String(manifest.model_digest || ''),
    scenario_spec_hash: String((manifest as any).scenario_spec_hash || ''),
    manifest_digest_sha256: stripDurableManifestDigest(manifest),
    dataset_digest_sha256: datasetDigestSha256,
  });
}

async function stripDatasetMatchesDurableRunReceipt(
  key: string,
  ds: StripDataset,
  receipt: StripDurableRunReceipt | null,
): Promise<boolean> {
  if (!receipt || key !== receipt.key
      || stripStorageKey(ds.manifest) !== receipt.key
      || String(ds.manifest.scenario_id || '') !== receipt.scenario_id
      || Number(ds.manifest.seed) !== receipt.seed
      || Number(ds.manifest.recorded_at) !== receipt.recorded_at
      || Number(ds.manifest.sim_version) !== receipt.sim_version
      || String(ds.manifest.model_digest || '') !== receipt.model_digest
      || String((ds.manifest as any).scenario_spec_hash || '') !== receipt.scenario_spec_hash
      || stripDurableManifestDigest(ds.manifest) !== receipt.manifest_digest_sha256) return false;
  return await stripDurableDatasetDigest(ds) === receipt.dataset_digest_sha256;
}

function stripLatestDurableRunReceipt(): StripDurableRunReceipt | null {
  return _stripLatestDurableRunReceipt
    ? Object.freeze({ ..._stripLatestDurableRunReceipt })
    : null;
}

function stripStorageOriginEligible(origin: string): boolean {
  return origin === 'production-run';
}

function stripStoredRecordOrigin(rec: Pick<StripStoredRecord, 'key' | 'origin'>): 'production-run' | 'imported-file' {
  if (rec.origin === 'production-run' || rec.origin === 'imported-file') return rec.origin;
  return String(rec.key || '').startsWith('imported:') ? 'imported-file' : 'production-run';
}

// Build a deterministic key for a dataset. recorded_at provides uniqueness.
function stripStorageKey(manifest: StripManifest): string {
  return `${manifest.scenario_id}@${manifest.seed}#${manifest.recorded_at}`;
}

// Imports are content-addressed underneath their own namespace. Re-importing
// identical bytes is idempotent; a different payload with the same manifest
// receives a different key and cannot replace either the local recording or a
// prior import.
function stripImportedStorageKey(manifest: StripManifest, datasetDigestSha256: string): string {
  if (!/^[0-9a-f]{64}$/.test(datasetDigestSha256)) {
    throw new Error('strip: invalid imported dataset digest');
  }
  return `imported:${stripStorageKey(manifest)}@sha256-${datasetDigestSha256}`;
}

// Check if IndexedDB is available in this environment. Tests + Node.
// won't have it unless a shim is loaded.
function stripStorageAvailable(): boolean {
  return typeof (globalThis as any).indexedDB === 'object' && (globalThis as any).indexedDB !== null;
}

// Keep the IndexedDB boundary testable without substituting a different
// persistence implementation.  These two lossless codecs are the only path
// into and out of the object store, so newly-added evidence fields cannot be
// silently forgotten by one half of the round trip.
function stripStoredRecordFromDataset(
  ds: StripDataset,
  origin: 'production-run' | 'imported-file' = 'production-run',
): StripStoredRecord {
  return {
    key: stripStorageKey(ds.manifest),
    origin,
    manifest: ds.manifest,
    chip_data: ds.chip_data,
    nucleation_events: ds.nucleation_events,
    ...(ds.floor_data ? { floor_data: ds.floor_data } : {}),
    ...(ds.pressure_phase_testimony ? { pressure_phase_testimony: ds.pressure_phase_testimony } : {}),
    ...(ds.stress_event_testimony ? { stress_event_testimony: ds.stress_event_testimony } : {}),
    ...(ds.transformation_event_testimony ? { transformation_event_testimony: ds.transformation_event_testimony } : {}),
    ...(ds.carbonate_boundary_testimony ? { carbonate_boundary_testimony: ds.carbonate_boundary_testimony } : {}),
    ...(ds.sulfur_ledger_testimony ? { sulfur_ledger_testimony: ds.sulfur_ledger_testimony } : {}),
    ...(ds.fluid_boundary_testimony ? { fluid_boundary_testimony: ds.fluid_boundary_testimony } : {}),
    ...(ds.enclosure_testimony ? { enclosure_testimony: ds.enclosure_testimony } : {}),
    ...(ds.player_action_testimony ? { player_action_testimony: ds.player_action_testimony } : {}),
    ...(ds.layer_growth_testimony ? { layer_growth_testimony: ds.layer_growth_testimony } : {}),
    ...(ds.habit_morphology_testimony ? { habit_morphology_testimony: ds.habit_morphology_testimony } : {}),
  };
}

function stripDatasetFromStoredRecord(rec: StripStoredRecord): StripDataset {
  return {
    manifest: rec.manifest,
    chip_data: rec.chip_data,
    nucleation_events: rec.nucleation_events,
    ...(rec.floor_data ? { floor_data: rec.floor_data } : {}),
    ...(rec.pressure_phase_testimony ? { pressure_phase_testimony: rec.pressure_phase_testimony } : {}),
    ...(rec.stress_event_testimony ? { stress_event_testimony: rec.stress_event_testimony } : {}),
    ...(rec.transformation_event_testimony ? { transformation_event_testimony: rec.transformation_event_testimony } : {}),
    ...(rec.carbonate_boundary_testimony ? { carbonate_boundary_testimony: rec.carbonate_boundary_testimony } : {}),
    ...(rec.sulfur_ledger_testimony ? { sulfur_ledger_testimony: rec.sulfur_ledger_testimony } : {}),
    ...(rec.fluid_boundary_testimony ? { fluid_boundary_testimony: rec.fluid_boundary_testimony } : {}),
    ...(rec.enclosure_testimony ? { enclosure_testimony: rec.enclosure_testimony } : {}),
    ...(rec.player_action_testimony ? { player_action_testimony: rec.player_action_testimony } : {}),
    ...(rec.layer_growth_testimony ? { layer_growth_testimony: rec.layer_growth_testimony } : {}),
    ...(rec.habit_morphology_testimony ? { habit_morphology_testimony: rec.habit_morphology_testimony } : {}),
  };
}

// Open (or create) the DB. Promisified — IDB's onsuccess callback model
// doesn't compose well with async/await without a wrapper.
function _stripOpenDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!stripStorageAvailable()) {
      reject(new Error('strip: IndexedDB not available'));
      return;
    }
    const req = (globalThis as any).indexedDB.open(_STRIP_DB_NAME, _STRIP_DB_VERSION);
    req.onupgradeneeded = () => {
      const db: IDBDatabase = req.result;
      if (!db.objectStoreNames.contains(_STRIP_STORE)) {
        const store = db.createObjectStore(_STRIP_STORE, { keyPath: 'key' });
        store.createIndex('by_scenario', 'manifest.scenario_id', { unique: false });
        store.createIndex('by_recorded_at', 'manifest.recorded_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('strip: failed to open DB'));
  });
}

// v155 (2026-05-26), hardened for GAME-04: count-based auto-eviction cap.
// Each origin domain retains its own five most recent datasets; imported
// files can neither replace nor evict simulator-produced recordings. On save,
// the oldest same-origin entry and the new bytes move in one transaction. The download button +
// upload path lets users keep anything they care about as a
// .stripview file on disk; IDB is treated as a recent-N cache.
// Per locked v4 design (boss 2026-05-26): "the save/load will help
// if anyone actually wants to keep these."
const _STRIP_IDB_MAX_DATASETS = 5;

function _stripPlanOriginEvictions(
  all: StripStoredRecord[],
  incoming: StripStoredRecord,
): string[] {
  const origin = stripStoredRecordOrigin(incoming);
  const sameOrigin = all.filter(rec => stripStoredRecordOrigin(rec) === origin);
  const existingKeys = new Set(sameOrigin.map(rec => rec.key));
  const newSlotNeeded = existingKeys.has(incoming.key) ? 0 : 1;
  const overflow = sameOrigin.length + newSlotNeeded - _STRIP_IDB_MAX_DATASETS;
  if (overflow <= 0) return [];
  return sameOrigin
    .filter(rec => rec.key !== incoming.key)
    .sort((a, b) => Number(a.manifest.recorded_at) - Number(b.manifest.recorded_at))
    .slice(0, overflow)
    .map(rec => rec.key);
}

// One readwrite transaction owns both eviction and insertion. IndexedDB only
// publishes the staged deletes if the put also commits; quota/write failure
// therefore leaves the previous recent-five cache intact.
function _stripCommitRecordAtomic(db: IDBDatabase, record: StripStoredRecord): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readwrite');
    const store = tx.objectStore(_STRIP_STORE);
    let settled = false;
    const fail = (error: unknown, fallback: string) => {
      if (settled) return;
      settled = true;
      reject(error || new Error(fallback));
    };
    tx.onerror = () => fail(tx.error, 'strip: save transaction failed');
    tx.onabort = () => fail(tx.error, 'strip: save transaction aborted');
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const req = store.getAll();
    req.onerror = () => {
      try { tx.abort(); } catch (_error) {}
      fail(req.error, 'strip: eviction list failed');
    };
    req.onsuccess = () => {
      try {
        const all = (req.result || []) as StripStoredRecord[];
        for (const key of _stripPlanOriginEvictions(all, record)) store.delete(key);
        store.put(record);
      } catch (error) {
        try { tx.abort(); } catch (_abortError) {}
        fail(error, 'strip: save failed');
      }
    };
  });
}

async function stripDatasetFromAuthenticatedStoredRecord(rec: StripStoredRecord): Promise<StripDataset> {
  const origin = stripStoredRecordOrigin(rec);
  const ds = stripDatasetFromStoredRecord(rec);
  const digest = await stripDurableDatasetDigest(ds);
  if (rec.dataset_digest_sha256 && digest !== rec.dataset_digest_sha256) {
    throw new Error('strip: stored dataset digest mismatch');
  }
  if (origin === 'imported-file') {
    if (!rec.dataset_digest_sha256) throw new Error('strip: imported dataset is missing its payload digest');
    if (rec.key !== stripImportedStorageKey(rec.manifest, digest)) {
      throw new Error('strip: imported dataset key does not match its authenticated payload');
    }
  } else if (rec.key !== stripStorageKey(rec.manifest)) {
    throw new Error('strip: production dataset key does not match its manifest');
  }
  return ds;
}

// Save a dataset. Returns the stored key. Evicts the oldest same-origin
// datasets when that origin's count cap is exceeded.
async function stripStorageSave(
  ds: StripDataset,
  origin: 'production-run' | 'imported-file' = 'production-run',
): Promise<string> {
  const canonicalKey = stripStorageKey(ds.manifest);
  const datasetDigestSha256 = await stripDurableDatasetDigest(ds);
  // Uploaded files live in a separate, content-addressed key namespace. A
  // file can have the same manifest timestamp as the current production run;
  // it must never overwrite those commissioned bytes or inherit that receipt.
  const key = origin === 'imported-file'
    ? stripImportedStorageKey(ds.manifest, datasetDigestSha256)
    : canonicalKey;
  const db = await _stripOpenDB();
  const record = stripStoredRecordFromDataset(ds, origin);
  record.key = key;
  record.dataset_digest_sha256 = datasetDigestSha256;
  try {
    await _stripCommitRecordAtomic(db, record);
    if (stripStorageOriginEligible(origin)) {
      _stripLatestDurableRunReceipt = _stripDurableRunReceipt(
        key, ds.manifest, datasetDigestSha256,
      );
    }
    return key;
  } finally {
    db.close();
  }
}

// Load a dataset by key. Returns null if the key isn't present.
async function stripStorageLoad(key: string): Promise<StripDataset | null> {
  const db = await _stripOpenDB();
  const rec = await new Promise<StripStoredRecord | null>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readonly');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const rec = req.result as StripStoredRecord | undefined;
      if (!rec) { resolve(null); return; }
      resolve(rec);
    };
    req.onerror = () => reject(req.error || new Error('strip: load failed'));
    tx.oncomplete = () => db.close();
  });
  if (!rec) return null;
  return stripDatasetFromAuthenticatedStoredRecord(rec);
}

// List all dataset keys + manifests (lightweight — no chip_data). Sorted
// by recorded_at descending (newest first). Optional scenario_id filter.
async function stripStorageList(scenarioId?: string): Promise<StripListEntry[]> {
  const db = await _stripOpenDB();
  return new Promise<StripListEntry[]>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readonly');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as StripStoredRecord[];
      let entries = all.map(rec => ({
        key: rec.key,
        manifest: rec.manifest,
        origin: stripStoredRecordOrigin(rec),
        ...(rec.dataset_digest_sha256
          ? { dataset_digest_sha256: rec.dataset_digest_sha256 }
          : {}),
      }));
      if (scenarioId) {
        entries = entries.filter(e => e.manifest.scenario_id === scenarioId);
      }
      entries.sort((a, b) => b.manifest.recorded_at - a.manifest.recorded_at);
      resolve(entries);
    };
    req.onerror = () => reject(req.error || new Error('strip: list failed'));
    tx.oncomplete = () => db.close();
  });
}

// Delete a dataset by key.
async function stripStorageDelete(key: string): Promise<void> {
  const db = await _stripOpenDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readwrite');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('strip: delete failed'));
    tx.oncomplete = () => {
      if (_stripLatestDurableRunReceipt?.key === key) _stripLatestDurableRunReceipt = null;
      db.close();
    };
  });
}

// Delete EVERY dataset. Used by the "clear all" UI button and tests.
async function stripStorageClear(): Promise<void> {
  const db = await _stripOpenDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readwrite');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('strip: clear failed'));
    tx.oncomplete = () => {
      _stripLatestDurableRunReceipt = null;
      db.close();
    };
  });
}

// === END HELIX-OVERLAY-FORK ADDITION ==================================
