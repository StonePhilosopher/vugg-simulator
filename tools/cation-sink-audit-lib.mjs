/** Pure helpers for tools/cation-sink-audit.mjs and its fail-closed tests. */

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

export function spatialFieldReceiptFromFluids(fluids, field) {
  const controlVolumes = Array.isArray(fluids) ? fluids : [];
  const values = controlVolumes
    .map(fluid => fluid?.[field])
    .filter(isFiniteNumber);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    addressable_control_volumes: controlVolumes.length,
    [`valid_${field}_control_volumes`]: values.length,
    total_ppm_control_volume_sum: total,
    mean_ppm: values.length ? total / values.length : null,
    min_ppm: values.length ? Math.min(...values) : null,
    max_ppm: values.length ? Math.max(...values) : null,
    nonzero_control_volumes: values.filter(value => value > 1e-9).length,
  };
}

export function auditTrajectoryIntegrityFailures(
  trajectory,
  { field = 'Zn', expectedControlVolumes = 7680 } = {},
) {
  const failures = [];
  const validKey = `valid_${field}_control_volumes`;
  for (const row of Array.isArray(trajectory) ? trajectory : []) {
    const where = `step ${row?.step ?? '?'} (${row?.label || 'unlabelled'})`;
    const bulkRaw = row?.fluid_ppm?.[field];
    if (!isFiniteNumber(bulkRaw)) {
      failures.push(`${where}: bulk ${field} is non-finite`);
    }

    const spatial = row?.[`spatial_${field}`];
    const addressableRaw = spatial?.addressable_control_volumes;
    const validRaw = spatial?.[validKey];
    if (!isFiniteNumber(addressableRaw) || addressableRaw !== expectedControlVolumes) {
      failures.push(
        `${where}: addressable ${field} control volumes ${isFiniteNumber(addressableRaw) ? addressableRaw : 'missing'}, expected ${expectedControlVolumes}`,
      );
    }
    if (!isFiniteNumber(validRaw) || validRaw !== expectedControlVolumes) {
      failures.push(
        `${where}: valid finite ${field} control volumes ${isFiniteNumber(validRaw) ? validRaw : 'missing'}, expected ${expectedControlVolumes}`,
      );
    }
    const minRaw = spatial?.min_ppm;
    const maxRaw = spatial?.max_ppm;
    if (!isFiniteNumber(minRaw)) {
      failures.push(`${where}: spatial ${field} minimum is non-finite`);
    }
    if (!isFiniteNumber(maxRaw)) {
      failures.push(`${where}: spatial ${field} maximum is non-finite`);
    }
  }
  return failures;
}
