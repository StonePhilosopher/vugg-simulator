export const BISBEE_PRODUCTION_BUDGET = Object.freeze({
  scenario: 'bisbee',
  simulationSeed: 42,
  shapeSeed: 13,
  steps: 70,
  acceptedErosions: 6,
  fixedElapsedMs: 10_000,
  elapsedMsPerErosion: 6_000,
  maximumStepMs: 5_000,
  maximumVolumeCandidates: 39,
  peakRssMb: 640,
  peakHeapMb: 384,
  peakExternalMb: 96,
  peakArrayBuffersMb: 64,
});

const RECEIPT_KEYS = Object.freeze([
  'schema', 'scenario', 'simulation_seed', 'shape_seed', 'steps',
  'accepted_erosions', 'full_surface_resolutions',
  'provider_full_authentications', 'erosion_authority', 'elapsed_ms',
  'elapsed_allowance_ms', 'maximum_step_ms', 'process_cpu_ms',
  'peak_rss_mb', 'peak_heap_mb', 'peak_external_mb',
  'peak_array_buffers_mb',
]);

const AUTHORITY_KEYS = Object.freeze([
  'event_id', 'field_build_and_extract_evaluations', 'production_48',
  'reference_64', 'provider_install', 'volume_only_field_evaluations',
]);

const requireBudget = (condition, message) => {
  if (!condition) throw new Error(`Bisbee production budget failed: ${message}`);
};

const exactKeys = (value, keys) => value != null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).sort().join('\u0000') === [...keys].sort().join('\u0000');

const finiteNonnegative = value => typeof value === 'number'
  && Number.isFinite(value) && value >= 0;

export function bisbeeElapsedAllowanceMs(acceptedErosions) {
  requireBudget(Number.isSafeInteger(acceptedErosions) && acceptedErosions >= 0,
    `invalid erosion count ${acceptedErosions}`);
  return BISBEE_PRODUCTION_BUDGET.fixedElapsedMs
    + BISBEE_PRODUCTION_BUDGET.elapsedMsPerErosion * acceptedErosions;
}

/**
 * Fail-closed validation for the expensive Bisbee production witness.
 *
 * The total wall-clock allowance is derived from the authenticated work rather
 * than a machine-specific historical stopwatch. Operation counts, the strict
 * per-step watchdog, and memory ceilings remain independent hard boundaries.
 */
export function validateBisbeeProductionBudgetReceipt(receipt) {
  const expected = BISBEE_PRODUCTION_BUDGET;
  requireBudget(exactKeys(receipt, RECEIPT_KEYS), 'receipt schema keys changed');
  requireBudget(receipt.schema === 'bisbee-production-budget-v2',
    `unexpected schema ${receipt.schema}`);
  requireBudget(receipt.scenario === expected.scenario,
    `unexpected scenario ${receipt.scenario}`);
  requireBudget(receipt.simulation_seed === expected.simulationSeed,
    `unexpected simulation seed ${receipt.simulation_seed}`);
  requireBudget(receipt.shape_seed === expected.shapeSeed,
    `unexpected shape seed ${receipt.shape_seed}`);
  requireBudget(receipt.steps === expected.steps,
    `unexpected step count ${receipt.steps}`);
  requireBudget(receipt.accepted_erosions === expected.acceptedErosions,
    `expected ${expected.acceptedErosions} accepted erosions, received ${receipt.accepted_erosions}`);

  const resolutions = receipt.full_surface_resolutions;
  requireBudget(Array.isArray(resolutions)
    && resolutions.length === expected.acceptedErosions * 2,
  `expected ${expected.acceptedErosions * 2} full surfaces, received ${resolutions?.length}`);
  for (let index = 0; index < resolutions.length; index += 2) {
    requireBudget(resolutions[index] === 48 && resolutions[index + 1] === 64,
      `erosion ${index / 2 + 1} extracted ${resolutions.slice(index, index + 2)}`);
  }
  requireBudget(receipt.provider_full_authentications === 0,
    `provider installation repeated ${receipt.provider_full_authentications} full authentications`);

  requireBudget(Array.isArray(receipt.erosion_authority)
    && receipt.erosion_authority.length === expected.acceptedErosions,
  `expected ${expected.acceptedErosions} erosion authority rows`);
  const eventIds = new Set();
  for (const authority of receipt.erosion_authority) {
    requireBudget(exactKeys(authority, AUTHORITY_KEYS), 'erosion authority schema keys changed');
    requireBudget(Number.isSafeInteger(authority.event_id) && authority.event_id > 0,
      'erosion authority has invalid event id');
    requireBudget(!eventIds.has(authority.event_id),
      `duplicate erosion event ${authority.event_id}`);
    eventIds.add(authority.event_id);
    requireBudget(authority.field_build_and_extract_evaluations === 2,
      `event ${authority.event_id} disclosed ${authority.field_build_and_extract_evaluations} full builds`);
    requireBudget(authority.production_48 === 1 && authority.reference_64 === 1
      && authority.provider_install === 0,
    `event ${authority.event_id} has invalid full-surface accounting`);
    requireBudget(Number.isSafeInteger(authority.volume_only_field_evaluations)
      && authority.volume_only_field_evaluations >= 0
      && authority.volume_only_field_evaluations <= expected.maximumVolumeCandidates,
    `event ${authority.event_id} used ${authority.volume_only_field_evaluations} volume candidates`);
  }

  const allowance = bisbeeElapsedAllowanceMs(receipt.accepted_erosions);
  requireBudget(receipt.elapsed_allowance_ms === allowance,
    `elapsed allowance ${receipt.elapsed_allowance_ms} does not match derived ${allowance}`);
  requireBudget(finiteNonnegative(receipt.elapsed_ms) && receipt.elapsed_ms < allowance,
    `elapsed ${receipt.elapsed_ms} ms exceeds derived ${allowance} ms allowance`);
  requireBudget(finiteNonnegative(receipt.maximum_step_ms)
    && receipt.maximum_step_ms < expected.maximumStepMs,
  `maximum step ${receipt.maximum_step_ms} ms`);
  // CPU time is testimony until a multi-run same-host distribution is
  // commissioned. It is deliberately not used as an acceptance threshold.
  requireBudget(finiteNonnegative(receipt.process_cpu_ms),
    `invalid process CPU testimony ${receipt.process_cpu_ms}`);
  requireBudget(finiteNonnegative(receipt.peak_rss_mb)
    && receipt.peak_rss_mb < expected.peakRssMb,
  `peak RSS ${receipt.peak_rss_mb} MB`);
  requireBudget(finiteNonnegative(receipt.peak_heap_mb)
    && receipt.peak_heap_mb < expected.peakHeapMb,
  `peak heap ${receipt.peak_heap_mb} MB`);
  requireBudget(finiteNonnegative(receipt.peak_external_mb)
    && receipt.peak_external_mb < expected.peakExternalMb,
  `peak external ${receipt.peak_external_mb} MB`);
  requireBudget(finiteNonnegative(receipt.peak_array_buffers_mb)
    && receipt.peak_array_buffers_mb < expected.peakArrayBuffersMb,
  `peak array buffers ${receipt.peak_array_buffers_mb} MB`);
  return true;
}
