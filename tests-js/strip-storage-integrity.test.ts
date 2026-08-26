import { describe, expect, it, vi } from 'vitest';

declare function stripDurableDatasetDigest(ds: any): Promise<string>;
declare function stripImportedStorageKey(manifest: any, digest: string): string;
declare function stripStorageKey(manifest: any): string;
declare function stripStoredRecordFromDataset(ds: any, origin?: 'production-run' | 'imported-file'): any;
declare function stripDatasetFromAuthenticatedStoredRecord(rec: any): Promise<any>;
declare function _stripPlanOriginEvictions(all: any[], incoming: any): string[];
declare function _stripCommitRecordAtomic(db: any, record: any): Promise<void>;
declare function _stripBuildDatasetListRow(entry: any): HTMLDivElement;
declare function stripStoredRecordOrigin(rec: any): 'production-run' | 'imported-file' | 'legacy-unverified';
declare function stripStorageOriginEligible(origin: string): boolean;
declare function stripSerialize(ds: any, gzip?: boolean): Promise<Uint8Array>;
declare function stripDeserialize(input: Uint8Array): Promise<any>;
declare function _stripRenderStepSVG(ds: any, step: number, width: number, height: number): string;
declare function _stripPresentImportedDataset(
  body: HTMLElement, ds: any, saver?: any, available?: any, renderer?: any,
): Promise<string>;
declare function _stripReadUploadedDataset(file: any, deserializer?: any): Promise<any>;
declare function stripMaximumSerializedBytes(): number;

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

  it('fails closed on provenance-free legacy rows instead of calling them local evidence', async () => {
    const ds = dataset(31, 123);
    const legacy = stripStoredRecordFromDataset(ds);
    delete legacy.origin;
    delete legacy.dataset_digest_sha256;
    legacy.key = stripStorageKey(ds.manifest);

    expect(stripStoredRecordOrigin(legacy)).toBe('legacy-unverified');
    expect(stripStorageOriginEligible(stripStoredRecordOrigin(legacy))).toBe(false);
    await expect(stripDatasetFromAuthenticatedStoredRecord(legacy)).resolves.toMatchObject({
      manifest: { scenario_id: 'storage_control' },
    });
    const prefixedLegacy = { ...legacy, key: `imported:${legacy.key}` };
    await expect(stripDatasetFromAuthenticatedStoredRecord(prefixedLegacy)).resolves.toMatchObject({
      manifest: { scenario_id: 'storage_control' },
    });

    const malformedLegacy = {
      ...legacy,
      manifest: {
        ...legacy.manifest,
        duration_steps: 2,
        axes: { ...legacy.manifest.axes, steps: 2 },
      },
    };
    malformedLegacy.key = stripStorageKey(malformedLegacy.manifest);
    await expect(stripDatasetFromAuthenticatedStoredRecord(malformedLegacy))
      .rejects.toThrow(/tensor length mismatch/);

    const row = _stripBuildDatasetListRow({
      key: legacy.key,
      manifest: legacy.manifest,
      origin: stripStoredRecordOrigin(legacy),
    });
    expect(row.dataset.origin).toBe('legacy-unverified');
    expect(row.querySelector('.ds-origin')?.textContent).toBe('LEGACY / UNVERIFIED');

    const fullProduction = Array.from({ length: 5 }, (_, i) => storedStub(`local-${i}`, 'production-run', i));
    expect(_stripPlanOriginEvictions([legacy, ...fullProduction], storedStub('local-new', 'production-run', 999)))
      .toEqual(['local-0']);
  });

  it('keeps imported manifest and event prose inert through deserialize and SVG rendering', async () => {
    const hostile = '</title><image id="strip-import-pwn" href="x" onerror="globalThis.__stripImportPwn=1"></image><title>';
    const ds = dataset(127, 777);
    ds.manifest.scenario_id = hostile;
    ds.manifest.axes = { steps: 1, angular_indices: 1, height_positions: 2 };
    ds.manifest.duration_steps = 1;
    ds.manifest.chips[0].label = hostile;
    ds.chip_data = new Uint8Array([127, 127]);
    ds.nucleation_events = [{ step: 0, ring: 0, cell: 0, mineral: hostile }];

    const decoded = await stripDeserialize(await stripSerialize(ds, false));
    const row = _stripBuildDatasetListRow({
      key: `imported:${stripStorageKey(decoded.manifest)}`,
      manifest: decoded.manifest,
      origin: 'imported-file',
    });
    const holder = document.createElement('div');
    holder.appendChild(row);
    holder.insertAdjacentHTML('beforeend', _stripRenderStepSVG(decoded, 0, 100, 20));

    expect(row.querySelector('.ds-name')?.firstChild?.textContent).toBe(hostile);
    expect(holder.querySelector('#strip-import-pwn')).toBeNull();
    expect(holder.querySelector('title')?.textContent).toContain(hostile);
    expect((globalThis as any).__stripImportPwn).toBeUndefined();
  });

  it('rejects attribute-breaking chip ids and tensor-length lies at the import boundary', async () => {
    const hostileId = dataset(1, 888);
    hostileId.manifest.chips[0].id = 'pH" onload="globalThis.__stripImportPwn=1';
    await expect(stripDeserialize(await stripSerialize(hostileId, false)))
      .rejects.toThrow(/chip id/);

    const wrongTensor = dataset(1, 889);
    wrongTensor.manifest.axes.steps = 2;
    wrongTensor.manifest.duration_steps = 2;
    await expect(stripDeserialize(await stripSerialize(wrongTensor, false)))
      .rejects.toThrow(/tensor length mismatch/);
  });

  it('does not present a failed import as a durable imported product', async () => {
    const body = document.createElement('div');
    body.textContent = 'prior durable list';
    const renderer = vi.fn();
    const saver = vi.fn().mockRejectedValue(new Error('simulated quota failure'));

    await expect(_stripPresentImportedDataset(body, dataset(), saver, () => true, renderer))
      .rejects.toThrow('simulated quota failure');
    expect(renderer).not.toHaveBeenCalled();
    expect(body.textContent).toBe('prior durable list');
  });

  it('renders malformed legacy rows as separately deletable without hiding valid rows', () => {
    const corrupt = _stripBuildDatasetListRow({
      key: 'legacy-broken',
      origin: 'legacy-unverified',
      manifest: { scenario_id: 'broken-upload', recorded_at: 1 },
      invalid_reason: 'strip: invalid chip manifest',
    });
    const validDataset = dataset(7, 2);
    const valid = _stripBuildDatasetListRow({
      key: stripStorageKey(validDataset.manifest),
      origin: 'production-run',
      manifest: validDataset.manifest,
    });
    const list = document.createElement('div');
    list.append(corrupt, valid);

    expect(list.querySelectorAll('.strip-view-datasetrow')).toHaveLength(2);
    expect(corrupt.dataset.valid).toBe('false');
    expect(corrupt.querySelector('.ds-origin')?.textContent).toBe('CORRUPT / UNVERIFIED');
    expect(corrupt.querySelector('.ds-delete')).not.toBeNull();
    expect(valid.dataset.valid).toBe('true');
    expect(valid.querySelector('.ds-origin')?.textContent).toBe('LOCAL RECORDING');
  });

  it('rejects an oversized upload before allocating its bytes', async () => {
    const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const oversized = {
      size: stripMaximumSerializedBytes() + 1,
      arrayBuffer,
    };
    await expect(_stripReadUploadedDataset(oversized)).rejects.toThrow(/supported size/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
