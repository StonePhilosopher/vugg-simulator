import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMMISSIONED_EVIDENCE_NODE_RUNTIME, nodeRuntimeIdentity } from '../tools/evidence-runtime.mjs';

import {
  auditTrajectoryIntegrityFailures,
  spatialFieldReceiptFromFluids,
} from '../tools/cation-sink-audit-lib.mjs';

describe('cation sink audit fail-closed receipts', () => {
  it('counts only finite field values while preserving every addressable slot', () => {
    const receipt = spatialFieldReceiptFromFluids([
      { Zn: 0 },
      undefined,
      { Zn: Number.NaN },
      { Zn: null },
      { Zn: '' },
      { Zn: 2 },
    ], 'Zn');

    expect(receipt).toMatchObject({
      addressable_control_volumes: 6,
      valid_Zn_control_volumes: 2,
      min_ppm: 0,
      max_ppm: 2,
      nonzero_control_volumes: 1,
    });
  });

  it('reports the exact step for a missing/non-finite spatial field and non-finite bulk field', () => {
    const goodSpatial = spatialFieldReceiptFromFluids([{ Zn: 0 }, { Zn: 0 }], 'Zn');
    const badSpatial = spatialFieldReceiptFromFluids([{ Zn: 0 }, { Zn: Number.NaN }], 'Zn');
    const failures = auditTrajectoryIntegrityFailures([
      { label: 'initial', step: 0, fluid_ppm: { Zn: 0 }, spatial_Zn: goodSpatial },
      { label: 'post-step', step: 1, fluid_ppm: { Zn: Number.NaN }, spatial_Zn: badSpatial },
      { label: 'post-step', step: 2, fluid_ppm: { Zn: '0' }, spatial_Zn: goodSpatial },
    ], { field: 'Zn', expectedControlVolumes: 2 });

    expect(failures).toEqual([
      'step 1 (post-step): bulk Zn is non-finite',
      'step 1 (post-step): valid finite Zn control volumes 1, expected 2',
      'step 2 (post-step): bulk Zn is non-finite',
    ]);
  });

  it('rejects a transient missing grid even when a later row recovers', () => {
    const complete = spatialFieldReceiptFromFluids([{ Zn: 0 }, { Zn: 0 }], 'Zn');
    const missing = spatialFieldReceiptFromFluids([], 'Zn');
    const failures = auditTrajectoryIntegrityFailures([
      { label: 'initial', step: 0, fluid_ppm: { Zn: 0 }, spatial_Zn: complete },
      { label: 'post-step', step: 1, fluid_ppm: { Zn: 0 }, spatial_Zn: missing },
      { label: 'post-step', step: 2, fluid_ppm: { Zn: 0 }, spatial_Zn: complete },
    ], { field: 'Zn', expectedControlVolumes: 2 });

    expect(failures).toEqual([
      'step 1 (post-step): addressable Zn control volumes 0, expected 2',
      'step 1 (post-step): valid finite Zn control volumes 0, expected 2',
      'step 1 (post-step): spatial Zn minimum is non-finite',
      'step 1 (post-step): spatial Zn maximum is non-finite',
    ]);
  });
});

const commissioned = JSON.stringify(nodeRuntimeIdentity()) === JSON.stringify(COMMISSIONED_EVIDENCE_NODE_RUNTIME);
describe.skipIf(!commissioned)('cation commissioning identity through the actual CLI', () => {
  let fixture: string;
  beforeAll(() => { fixture = mkdtempSync(join(tmpdir(), 'vugg-cation-identity-')); });
  afterAll(() => {
    if (!fixture) return;
    const target = realpathSync(fixture), parent = realpathSync(tmpdir());
    if (dirname(target) !== parent || !basename(target).startsWith('vugg-cation-identity-')) {
      throw Error('Refusing cleanup outside the owned identity fixture');
    }
    rmSync(target, {recursive: true, force: true});
  });
  const invoke = (preload?: string) => execFileSync(process.execPath, [
    '--max-old-space-size=768', ...(preload ? ['--import', pathToFileURL(preload).href] : []),
    join(process.cwd(), 'tools/cation-sink-audit.mjs'), 'schneeberg', '42', '--check',
  ], {cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024});

  it('accepts the measured current identity with unchanged count and zero-Zn checks', () => {
    const output = invoke();
    expect(output).toContain(`[cation-sink-audit] PASS SIM ${(globalThis as any).SIM_VERSION}`);
    expect(output).toContain('161 rows × 7680 finite Zn volumes');
    expect(output).toContain('pharmacolite 5');
  }, 90_000);

  it.each(['version', 'model'])('refuses an unknown %s even when the numerical replay matches', field => {
    const preload = join(fixture, `${field}.mjs`);
    const harness = pathToFileURL(join(process.cwd(), 'tools/_harness.mjs')).href;
    // Override only the harness's reported identity. The engine, data and its
    // internal scientific constants remain real/current: this is not a run of
    // another physical model or Node version.
    writeFileSync(preload, `import {loadSimBundle} from ${JSON.stringify(harness)};\n`
      + `const api=await loadSimBundle({extraExports:['MINERAL_STOICHIOMETRY','arsenateAvailablePpm','arsenateCompetingCationMolarFraction']});\n`
      + (field === 'version' ? 'api.SIM_VERSION=999999;\n' : "api.MODEL_DIGEST+='|synthetic-identity-mismatch';\n"));
    let failure: any;
    try { invoke(preload); } catch (error) { failure = error; }
    expect(failure?.status).toBe(1);
    const lines = String(failure.stderr).split(/\r?\n/).filter(line => /^\s+- /.test(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('no commissioning checkpoint');
  }, 90_000);
});
