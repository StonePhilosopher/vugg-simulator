import { describe, expect, it } from 'vitest';

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
