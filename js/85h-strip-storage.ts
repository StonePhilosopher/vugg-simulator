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
  manifest: StripManifest;
  chip_data: Uint8Array;
  nucleation_events: StripNucleationEvent[];
}

interface StripListEntry {
  key: string;
  manifest: StripManifest;
}

// Build a deterministic key for a dataset. recorded_at provides uniqueness.
function stripStorageKey(manifest: StripManifest): string {
  return `${manifest.scenario_id}@${manifest.seed}#${manifest.recorded_at}`;
}

// Check if IndexedDB is available in this environment. Tests + Node.
// won't have it unless a shim is loaded.
function stripStorageAvailable(): boolean {
  return typeof (globalThis as any).indexedDB === 'object' && (globalThis as any).indexedDB !== null;
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

// v155 (2026-05-26): count-based auto-eviction cap. Hard limit of 5
// datasets in IDB at a time; on save, oldest entries beyond the cap
// are silently removed before the new write. The download button +
// upload path lets users keep anything they care about as a
// .stripview file on disk; IDB is treated as a recent-N cache.
// Per locked v4 design (boss 2026-05-26): "the save/load will help
// if anyone actually wants to keep these."
const _STRIP_IDB_MAX_DATASETS = 5;

// Save a dataset. Returns the stored key. Evicts oldest datasets
// when the count cap is exceeded.
async function stripStorageSave(ds: StripDataset): Promise<string> {
  const db = await _stripOpenDB();
  const key = stripStorageKey(ds.manifest);
  // Eviction pass: walk existing keys, sort by recorded_at ascending
  // (OLDEST first), and delete the oldest until count = cap - 1 (one
  // free slot for the new save). If the new key already exists (re-
  // save of a same-timestamp dataset), it counts toward the cap as
  // itself rather than a fresh slot.
  await new Promise<void>((resolve, reject) => {
    const txList = db.transaction(_STRIP_STORE, 'readonly');
    const storeList = txList.objectStore(_STRIP_STORE);
    const req = storeList.getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as StripStoredRecord[];
      const existingKeys = new Set(all.map(r => r.key));
      const newSlotNeeded = !existingKeys.has(key) ? 1 : 0;
      const overflow = all.length + newSlotNeeded - _STRIP_IDB_MAX_DATASETS;
      if (overflow <= 0) { resolve(); return; }
      // Sort by recorded_at ASC (oldest first) and pick the first
      // `overflow` to evict. Skip the key we're about to write
      // (re-saves shouldn't evict themselves).
      const sorted = all
        .filter(r => r.key !== key)
        .sort((a, b) => a.manifest.recorded_at - b.manifest.recorded_at);
      const toEvict = sorted.slice(0, overflow).map(r => r.key);
      if (!toEvict.length) { resolve(); return; }
      const txDel = db.transaction(_STRIP_STORE, 'readwrite');
      const storeDel = txDel.objectStore(_STRIP_STORE);
      for (const k of toEvict) storeDel.delete(k);
      txDel.oncomplete = () => resolve();
      txDel.onerror = () => reject(txDel.error || new Error('strip: eviction failed'));
    };
    req.onerror = () => reject(req.error || new Error('strip: eviction list failed'));
  });

  const record: StripStoredRecord = {
    key,
    manifest: ds.manifest,
    chip_data: ds.chip_data,
    nucleation_events: ds.nucleation_events,
  };
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readwrite');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.put(record);
    req.onsuccess = () => resolve(key);
    req.onerror = () => reject(req.error || new Error('strip: save failed'));
    tx.oncomplete = () => db.close();
  });
}

// Load a dataset by key. Returns null if the key isn't present.
async function stripStorageLoad(key: string): Promise<StripDataset | null> {
  const db = await _stripOpenDB();
  return new Promise<StripDataset | null>((resolve, reject) => {
    const tx = db.transaction(_STRIP_STORE, 'readonly');
    const store = tx.objectStore(_STRIP_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const rec = req.result as StripStoredRecord | undefined;
      if (!rec) { resolve(null); return; }
      resolve({
        manifest: rec.manifest,
        chip_data: rec.chip_data,
        nucleation_events: rec.nucleation_events,
      });
    };
    req.onerror = () => reject(req.error || new Error('strip: load failed'));
    tx.oncomplete = () => db.close();
  });
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
      let entries = all.map(rec => ({ key: rec.key, manifest: rec.manifest }));
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
    tx.oncomplete = () => db.close();
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
    tx.oncomplete = () => db.close();
  });
}

// === END HELIX-OVERLAY-FORK ADDITION ==================================
