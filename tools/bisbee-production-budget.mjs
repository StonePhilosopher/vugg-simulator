#!/usr/bin/env node

import { loadSimBundle } from './_harness.mjs';

const {
  SCENARIOS, VugSimulator, setSeed,
  CavityProductionAuthority, CavityScalarField,
} = await loadSimBundle({
  toolName: 'bisbee-production-budget',
  extraExports: ['CavityProductionAuthority', 'CavityScalarField'],
});

const requireBudget = (condition, message) => {
  if (!condition) throw new Error(`Bisbee production budget failed: ${message}`);
};

setSeed(42);
const { conditions, events } = SCENARIOS.bisbee();
requireBudget(conditions.wall.shape_seed === 13,
  `authored shape_seed changed to ${conditions.wall.shape_seed}`);
const started = performance.now();
const sim = new VugSimulator(conditions, events);
const initialCursor = sim.wall_state.cavityEvolutionLedger().cursor;
const originalExtract = CavityScalarField.prototype.extract;
const originalAuthenticate = CavityProductionAuthority.authenticateSurface;
const fullSurfaceResolutions = [];
let providerFullAuthentications = 0;
CavityScalarField.prototype.extract = function(...args) {
  fullSurfaceResolutions.push(this.sizeX);
  return originalExtract.apply(this, args);
};
CavityProductionAuthority.authenticateSurface = function(...args) {
  providerFullAuthentications++;
  return originalAuthenticate.apply(this, args);
};
const peak = { ...process.memoryUsage() };
let maximumStepMs = 0;
try {
  for (let step = 0; step < 70; step++) {
    const stepStarted = performance.now();
    sim.run_step();
    maximumStepMs = Math.max(maximumStepMs, performance.now() - stepStarted);
    const memory = process.memoryUsage();
    for (const key of ['rss', 'heapUsed', 'external', 'arrayBuffers']) {
      peak[key] = Math.max(Number(peak[key]) || 0, Number(memory[key]) || 0);
    }
  }
} finally {
  CavityScalarField.prototype.extract = originalExtract;
  CavityProductionAuthority.authenticateSurface = originalAuthenticate;
}
const elapsedMs = performance.now() - started;
const ledger = sim.wall_state.cavityEvolutionLedger();
const acceptedErosions = ledger.cursor - initialCursor;
// SIM 272 removes the uncited fleet-wide ambient chemistry package and lets
// Bisbee's authored wall/boundary conditions govern the early acid interval.
// Six positive, above-resolution attacks now close through the exact geometry
// authority before the sub-resolution withholding fence takes over.
requireBudget(acceptedErosions === 6,
  `expected 6 accepted erosions, received ${acceptedErosions}`);
requireBudget(fullSurfaceResolutions.length === acceptedErosions * 2,
  `expected ${acceptedErosions * 2} full surfaces, received ${fullSurfaceResolutions.length}`);
for (let index = 0; index < fullSurfaceResolutions.length; index += 2) {
  requireBudget(fullSurfaceResolutions[index] === 48
    && fullSurfaceResolutions[index + 1] === 64,
  `erosion ${index / 2 + 1} extracted ${fullSurfaceResolutions.slice(index, index + 2)}`);
}
requireBudget(providerFullAuthentications === 0,
  `provider installation repeated ${providerFullAuthentications} full authentications`);
for (const entry of ledger.entries.slice(initialCursor)) {
  const authority = entry.geometry_authority;
  requireBudget(authority.field_build_and_extract_evaluations === 2,
    `event ${entry.event_id} disclosed ${authority.field_build_and_extract_evaluations} full builds`);
  requireBudget(authority.full_surface_extract_evaluations?.production_48 === 1
    && authority.full_surface_extract_evaluations?.reference_64 === 1
    && authority.full_surface_extract_evaluations?.provider_install === 0,
  `event ${entry.event_id} has invalid full-surface accounting`);
  requireBudget(authority.volume_only_field_evaluations <= 39,
    `event ${entry.event_id} used ${authority.volume_only_field_evaluations} volume candidates`);
}
const receipt = {
  schema: 'bisbee-production-budget-v1',
  scenario: 'bisbee',
  simulation_seed: 42,
  shape_seed: conditions.wall.shape_seed,
  steps: 70,
  accepted_erosions: acceptedErosions,
  full_surface_resolutions: fullSurfaceResolutions,
  provider_full_authentications: providerFullAuthentications,
  elapsed_ms: Number(elapsedMs.toFixed(1)),
  maximum_step_ms: Number(maximumStepMs.toFixed(1)),
  peak_rss_mb: Number((peak.rss / 1048576).toFixed(1)),
  peak_heap_mb: Number((peak.heapUsed / 1048576).toFixed(1)),
  peak_external_mb: Number((peak.external / 1048576).toFixed(1)),
  peak_array_buffers_mb: Number((peak.arrayBuffers / 1048576).toFixed(1)),
};
console.log(`[bisbee-production-budget] ${JSON.stringify(receipt)}`);
requireBudget(elapsedMs < 30_000, `elapsed ${elapsedMs.toFixed(1)} ms`);
requireBudget(maximumStepMs < 5000, `maximum step ${maximumStepMs.toFixed(1)} ms`);
requireBudget(peak.rss < 640 * 1024 * 1024,
  `peak RSS ${(peak.rss / 1048576).toFixed(1)} MB`);
requireBudget(peak.heapUsed < 384 * 1024 * 1024,
  `peak heap ${(peak.heapUsed / 1048576).toFixed(1)} MB`);
requireBudget(peak.external < 96 * 1024 * 1024,
  `peak external ${(peak.external / 1048576).toFixed(1)} MB`);
requireBudget(peak.arrayBuffers < 64 * 1024 * 1024,
  `peak array buffers ${(peak.arrayBuffers / 1048576).toFixed(1)} MB`);
