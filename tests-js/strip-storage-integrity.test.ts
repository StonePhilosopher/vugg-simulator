import { describe, expect, it } from 'vitest';

declare function stripDurableDatasetDigest(ds: any): Promise<string>;
declare function stripImportedStorageKey(manifest: any, digest: string): string;
declare function stripStorageKey(manifest: any): string;
declare function stripStoredRecordFromDataset(ds: any, origin?: 'production-run' | 'imported-file'): any;
declare function stripDatasetFromAuthenticatedStoredRecord(rec: any): Promise<any>;
declare function _stripPlanOriginEvictions(all: any[], incoming: any): string[];
declare function _stripCommitRecordAtomic(db: any, record: any): Promise<void>;
declare function _stripBuildDatasetListRow(entry: any): HTMLDivElement;

function dataset(byte = 7, recordedAt = 100) {
  return {
    manifest: {
      format_version: 1,
      sim_version: 281,
      model_digest: 'model-test',
      scenario_id: 'storage_control',
      seed: 42,
      recorded_at: recordedAt,
      duration_steps: 1,
      axes: { steps: 1, angular_indices: 1, height_positions: 1 },
      chips: [{ id: 'pH', label: 'pH', system: 'special', range: [4, 11], units: '', color: 0x9966ee }],
    },
    chip_data: new Uint8Array([byte]),
    nucleation_events: [],
  };
}

function storedStub(key: string, origin: 'production-run' | 'imported-file', recordedAt: number) {
  return {
    key,
    origin,
    manifest: { recorded_at: recordedAt },
    chip_data: new Uint8Array(),
    nucleation_events: [],
  };
}

function atomicFakeDb(initial: any[], failPut = false) {
  const state = new Map(initial.map(rec => [rec.key, rec]));
  const transactionModes: string[] = [];
  const db = {
    transaction(_storeName: string, mode: string) {
      transactionModes.push(mode);
      const staged = new Map(state);
      let aborted = false;
      const tx: any = {
        error: null,
        onerror: null,
        onabort: null,
        oncomplete: null,
        objectStore() {
          return {
            getAll() {
              const req: any = { result: null, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                if (aborted) return;
                req.result = Array.from(staged.values());
                req.onsuccess?.();
              });
              return req;
            },
            delete(key: string) {
              staged.delete(key);
              return {};
            },
            put(record: any) {
              if (failPut) {
                queueMicrotask(() => {
                  aborted = true;
                  tx.error = new Error('simulated quota failure');
                  tx.onabort?.();
                });
              } else {
                staged.set(record.key, record);
                queueMicrotask(() => {
                  if (aborted) return;
                  state.clear();
                  for (const [key, value] of staged) state.set(key, value);
                  tx.oncomplete?.();
                });
              }
              return {};
            },
          };
        },
        abort() {
          if (aborted) return;
          aborted = true;
          tx.error = tx.error || new Error('aborted');
          queueMicrotask(() => tx.onabort?.());
        },
      };
      return tx;
    },
  };
  return { db, state, transactionModes };
}

describe('Strip View storage identity', () => {
  it('content-addresses imports while preserving the production key', async () => {
    const first = dataset(7);
    const second = dataset(8);
    const firstDigest = await stripDurableDatasetDigest(first);
    const secondDigest = await stripDurableDatasetDigest(second);
    const localKey = stripStorageKey(first.manifest);
    const firstImport = stripImportedStorageKey(first.manifest, firstDigest);
    const secondImport = stripImportedStorageKey(second.manifest, secondDigest);

    expect(firstImport).not.toBe(localKey);
    expect(secondImport).not.toBe(localKey);
    expect(secondImport).not.toBe(firstImport);
    expect(stripImportedStorageKey(first.manifest, firstDigest)).toBe(firstImport);
  });

  it('rehashes imported payload bytes on read and rejects coordinated key drift', async () => {
    const ds = dataset(27);
    const digest = await stripDurableDatasetDigest(ds);
    const exact = stripStoredRecordFromDataset(ds, 'imported-file');
    exact.dataset_digest_sha256 = digest;
    exact.key = stripImportedStorageKey(ds.manifest, digest);

    await expect(stripDatasetFromAuthenticatedStoredRecord(exact)).resolves.toMatchObject({
      manifest: { scenario_id: 'storage_control' },
    });

    const payloadTamper = { ...exact, chip_data: new Uint8Array([99]) };
    await expect(stripDatasetFromAuthenticatedStoredRecord(payloadTamper))
      .rejects.toThrow('stored dataset digest mismatch');

    const keyTamper = { ...exact, key: exact.key.replace(/.$/, exact.key.endsWith('0') ? '1' : '0') };
    await expect(stripDatasetFromAuthenticatedStoredRecord(keyTamper))
      .rejects.toThrow('key does not match');
  });

  it('evicts only within the incoming origin namespace', () => {
    const production = Array.from({ length: 5 }, (_, i) => storedStub(`local-${i}`, 'production-run', i));
    const imports = Array.from({ length: 5 }, (_, i) => storedStub(`import-${i}`, 'imported-file', i));
    const incoming = storedStub('import-new', 'imported-file', 99);
    expect(_stripPlanOriginEvictions([...production, ...imports], incoming)).toEqual(['import-0']);
  });

  it('commits eviction and insertion atomically', async () => {
    const initial = Array.from({ length: 5 }, (_, i) => storedStub(`local-${i}`, 'production-run', i));
    const incoming = storedStub('local-new', 'production-run', 99);

    const failed = atomicFakeDb(initial, true);
    await expect(_stripCommitRecordAtomic(failed.db, incoming)).rejects.toThrow('simulated quota failure');
    expect(Array.from(failed.state.keys())).toEqual(initial.map(rec => rec.key));
    expect(failed.state.has('local-new')).toBe(false);
    expect(failed.transactionModes).toEqual(['readwrite']);

    const committed = atomicFakeDb(initial, false);
    await expect(_stripCommitRecordAtomic(committed.db, incoming)).resolves.toBeUndefined();
    expect(committed.state.has('local-0')).toBe(false);
    expect(committed.state.has('local-new')).toBe(true);
    expect(committed.transactionModes).toEqual(['readwrite']);
  });

  it('shows imported origin and treats an imported manifest name as text', () => {
    const hostile = '<img id="strip-origin-pwn" src=x onerror="globalThis.__stripPwn=1">';
    const ds = dataset();
    ds.manifest.scenario_id = hostile;
    const row = _stripBuildDatasetListRow({
      key: 'imported:test',
      manifest: ds.manifest,
      origin: 'imported-file',
      dataset_digest_sha256: 'a'.repeat(64),
    });

    expect(row.dataset.origin).toBe('imported-file');
    expect(row.querySelector('.ds-origin')?.textContent).toBe('IMPORTED FILE');
    expect(row.querySelector('.ds-name')?.firstChild?.textContent).toBe(hostile);
    expect(Array.from(row.getElementsByTagName('img')).some(img => img.id === 'strip-origin-pwn')).toBe(false);
  });
});
