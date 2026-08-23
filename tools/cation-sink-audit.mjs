#!/usr/bin/env node
/**
 * tools/cation-sink-audit.mjs
 *
 * Deterministic receipt for analytical cations that can outlive the phase that
 * introduced them. The first client is the historical Schneeberg late-Zn
 * failure: once sulfide sulfur was exhausted, dissolved Zn remained in the
 * fluid and acted as a phantom competitor in pharmacolite's cation-share gate.
 *
 * This tool records the default seed (42 unless explicitly overridden), the
 * fluid trajectory, every Zn-bearing supersaturation route, and the exact Zn
 * inventory booked into accepted growth zones. It is deliberately a gameplay
 * replay, not a coefficient census.
 *
 * Usage: node tools/cation-sink-audit.mjs [scenario] [seed] [--check]
 */

import { createHash } from 'node:crypto';

import { loadSimBundle } from './_harness.mjs';
import {
  auditTrajectoryIntegrityFailures,
  spatialFieldReceiptFromFluids,
} from './cation-sink-audit-lib.mjs';

const {
  SIM_VERSION,
  MODEL_DIGEST,
  SCENARIOS,
  VugSimulator,
  setSeed,
  MINERAL_STOICHIOMETRY,
  arsenateAvailablePpm,
  arsenateCompetingCationMolarFraction,
} = await loadSimBundle({
  toolName: 'cation-sink-audit',
  extraExports: [
    'MINERAL_STOICHIOMETRY',
    'arsenateAvailablePpm',
    'arsenateCompetingCationMolarFraction',
  ],
});

const MODEL_DIGEST_SHA256 = createHash('sha256').update(MODEL_DIGEST).digest('hex');
// Historical commissioning: the pre-Cartesian SIM 259 trajectory ended at
// 0.618402. SIM 266 deliberately moved water, chemistry, and nucleation onto
// the exact Cartesian surface/volume authority, yielding the value below while
// preserving the five-crystal assemblage and every zero-Zn mass check. SIM 267
// corrects solid occupancy, size-cap dissolution, and seal/reopen transitions.
// SIM 272 added authored locality/boundary authority and mass-balanced
// transformation/competition allocation. SIM 273 commissions the reconciled
// locality expectation tiers and exact pore-fluid replacement ledger. SIM 274
// changes only Elmwood's staged Ba/sulfate boundary and snowball layers. Those
// changes leave this seed-42 trajectory byte-for-number unchanged: the same
// five-crystal assemblage and zero-Zn mass checks persist. SIM 275 moves
// chemically accessible growth-shadowed solids and authenticated inclusions
// onto distinct authorities; the resulting layered competition trajectory
// commissions the exact proxy below without introducing any Zn source/sink.
const SCHNEEBERG_SEED42_COMMISSIONING = Object.freeze({
  sim_version: 275,
  model_digest_sha256: '5cb41ef6f1e5ded590320300a7495ae451abee3a8200368c497b8f97a3584a39',
  pharmacolite_crystals: 5,
  final_pharmacolite_Ca_molar_fraction_proxy: 0.581977988422356,
  proxy_tolerance: 5e-7,
});

const scenarioId = process.argv[2] || 'schneeberg';
const seed = Number.isFinite(Number(process.argv[3])) ? Number(process.argv[3]) : 42;
const check = process.argv.includes('--check');
if (!SCENARIOS[scenarioId]) {
  throw new Error(`unknown scenario ${scenarioId}`);
}

const znMinerals = Object.entries(MINERAL_STOICHIOMETRY)
  .filter(([, formula]) => Number(formula.Zn) > 0)
  .map(([mineral]) => mineral)
  .sort();

function bookedInventory(sim, species) {
  const byMineral = {};
  let total = 0;
  for (const crystal of sim.crystals) {
    let crystalTotal = 0;
    for (const zone of crystal.zones || []) {
      const remaining = Number.isFinite(Number(zone._remaining_solid_um))
        ? Math.max(0, Number(zone._remaining_solid_um))
        : Math.max(0, Number(zone.thickness_um) || 0);
      crystalTotal += remaining * Math.max(0, Number(zone._budget_inventory_per_um?.[species]) || 0);
    }
    if (crystalTotal > 0) {
      byMineral[crystal.mineral] = (byMineral[crystal.mineral] || 0) + crystalTotal;
      total += crystalTotal;
    }
  }
  return { total, byMineral };
}

function sigmaReceipt(conditions) {
  const out = {};
  for (const mineral of znMinerals) {
    const method = conditions[`supersaturation_${mineral}`];
    if (typeof method !== 'function') continue;
    let value = null;
    try {
      const candidate = Number(method.call(conditions));
      if (Number.isFinite(candidate)) value = candidate;
    } catch {
      // A mineral with a substrate-only route is not a fluid Zn sink at this
      // step. Keep it out of the numerical claim rather than inventing zero.
    }
    if (value !== null) out[mineral] = value;
  }
  return out;
}

function canonicalFluids(sim) {
  const grid = sim.wall_state?.voxelGridFor?.(sim);
  if (Array.isArray(grid?.voxels)) {
    // Preserve missing fluid slots. The receipt must prove that every canonical
    // control volume has a finite field value, not silently filter holes out.
    return grid.voxels.map(voxel => voxel?.fluid);
  }
  const mesh = sim.wall_state?.meshFor?.(sim);
  return (mesh?.cells || []).map(cell => cell?.fluid);
}

function spatialFieldReceipt(sim, field) {
  return spatialFieldReceiptFromFluids(canonicalFluids(sim), field);
}

function spatialSigmaReceipt(sim) {
  const conditions = sim.conditions;
  const originalFluid = conditions.fluid;
  const maxima = {};
  try {
    // Only Zn-bearing control volumes can exercise a Zn sink. This keeps the
    // receipt linear in the number of actual candidates rather than evaluating
    // every mineral in all 7,680 zero-Zn voxels on every step.
    for (const fluid of canonicalFluids(sim).filter(candidate => Number(candidate?.Zn) > 1e-9)) {
      conditions.fluid = fluid;
      const local = sigmaReceipt(conditions);
      for (const [mineral, value] of Object.entries(local)) {
        maxima[mineral] = Math.max(Number(maxima[mineral]) || 0, Number(value) || 0);
      }
    }
  } finally {
    conditions.fluid = originalFluid;
  }
  return maxima;
}

setSeed(seed);
const { conditions, events, defaultSteps } = SCENARIOS[scenarioId]();
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps ?? 160;
const trajectory = [];

function record(label) {
  const f = sim.conditions.fluid;
  const sigma = sigmaReceipt(sim.conditions);
  const spatialSigma = spatialSigmaReceipt(sim);
  const spatialZn = spatialFieldReceipt(sim, 'Zn');
  const bookedZn = bookedInventory(sim, 'Zn');
  trajectory.push({
    label,
    step: sim.step,
    temperature_C: f === undefined ? null : sim.conditions.temperature,
    pH: f.pH,
    Eh_mV: f.Eh,
    O2: f.O2,
    fluid_ppm: {
      Zn: f.Zn,
      S: f.S,
      As_total: f.As,
      As_V_available: arsenateAvailablePpm(f),
      Ca: f.Ca,
      Cu: f.Cu,
      Pb: f.Pb,
      Co: f.Co,
      Ni: f.Ni,
      CO3: f.CO3,
      SiO2_reactive: typeof f.reactiveSilicaPpm === 'function' ? f.reactiveSilicaPpm() : f.SiO2,
    },
    pharmacolite_Ca_molar_fraction_proxy: arsenateCompetingCationMolarFraction(f, 'Ca'),
    booked_Zn_ppm: bookedZn.total,
    booked_Zn_by_mineral_ppm: bookedZn.byMineral,
    Zn_sink_sigma: sigma,
    spatial_Zn: spatialZn,
    spatial_Zn_sink_sigma_max: spatialSigma,
  });
}

record('initial');
for (let i = 0; i < steps; i++) {
  sim.run_step();
  record('post-step');
}

const final = trajectory.at(-1);
const maxima = {};
const spatialMaxima = {};
for (const mineral of znMinerals) {
  let max = 0;
  let maxStep = null;
  for (const row of trajectory) {
    const value = Number(row.Zn_sink_sigma[mineral]) || 0;
    if (value > max) {
      max = value;
      maxStep = row.step;
    }
  }
  if (max > 0) maxima[mineral] = { max_sigma: max, step: maxStep };
  let spatialMax = 0;
  let spatialMaxStep = null;
  for (const row of trajectory) {
    const value = Number(row.spatial_Zn_sink_sigma_max[mineral]) || 0;
    if (value > spatialMax) {
      spatialMax = value;
      spatialMaxStep = row.step;
    }
  }
  if (spatialMax > 0) spatialMaxima[mineral] = { max_sigma: spatialMax, step: spatialMaxStep };
}

const species = {};
for (const crystal of sim.crystals) {
  const origin = crystal.paramorph_origin || crystal.mineral;
  species[origin] = (species[origin] || 0) + 1;
}

const eventSteps = new Set([0, ...events.map(event => event.step), steps]);
const compactTrajectory = trajectory.filter((row, index) => {
  if (eventSteps.has(row.step)) return true;
  const previous = trajectory[index - 1];
  if (!previous) return true;
  const crossedSulfideFloor = (previous.fluid_ppm.S >= 10) !== (row.fluid_ppm.S >= 10);
  const crossedPharmacoliteShare = (previous.pharmacolite_Ca_molar_fraction_proxy >= 0.3)
    !== (row.pharmacolite_Ca_molar_fraction_proxy >= 0.3);
  const sinkCrossedOne = Object.keys(row.Zn_sink_sigma).some(mineral =>
    ((previous.Zn_sink_sigma[mineral] || 0) >= 1) !== ((row.Zn_sink_sigma[mineral] || 0) >= 1));
  return crossedSulfideFloor || crossedPharmacoliteShare || sinkCrossedOne;
});

const receipt = {
  audit: 'analytical-cation-sink-receipt-v1',
  sim_version: SIM_VERSION,
  model_digest_sha256: MODEL_DIGEST_SHA256,
  scenario: scenarioId,
  seed,
  steps,
  result: {
    audited_trajectory_rows: trajectory.length,
    final_fluid_Zn_ppm: final.fluid_ppm.Zn,
    final_spatial_Zn: final.spatial_Zn,
    addressable_control_volumes_final: final.spatial_Zn.addressable_control_volumes,
    valid_Zn_control_volumes_final: final.spatial_Zn.valid_Zn_control_volumes,
    minimum_valid_Zn_control_volumes: Math.min(
      ...trajectory.map(row => Number(row.spatial_Zn.valid_Zn_control_volumes)),
    ),
    peak_bulk_Zn_ppm: Math.max(...trajectory.map(row => Number(row.fluid_ppm.Zn))),
    minimum_bulk_Zn_ppm: Math.min(...trajectory.map(row => Number(row.fluid_ppm.Zn))),
    peak_spatial_Zn_ppm: Math.max(...trajectory.map(row => Number(row.spatial_Zn.max_ppm))),
    minimum_spatial_Zn_ppm: Math.min(...trajectory.map(row => Number(row.spatial_Zn.min_ppm))),
    peak_spatial_Zn_nonzero_control_volumes: Math.max(
      ...trajectory.map(row => Number(row.spatial_Zn.nonzero_control_volumes)),
    ),
    final_booked_Zn_ppm: final.booked_Zn_ppm,
    final_booked_Zn_by_mineral_ppm: final.booked_Zn_by_mineral_ppm,
    final_pharmacolite_Ca_molar_fraction_proxy: final.pharmacolite_Ca_molar_fraction_proxy,
    pharmacolite_crystals: species.pharmacolite || 0,
    koettigite_crystals: species.koettigite || 0,
    Zn_sink_sigma_maxima: maxima,
    spatial_Zn_sink_sigma_maxima: spatialMaxima,
  },
  trajectory: compactTrajectory,
};

if (check) {
  if (scenarioId !== 'schneeberg') {
    throw new Error('--check currently pins the documented Schneeberg orphan-Zn regression');
  }
  const failures = auditTrajectoryIntegrityFailures(trajectory, {
    field: 'Zn', expectedControlVolumes: 7680,
  });
  if (receipt.result.peak_bulk_Zn_ppm > 1e-9 || receipt.result.minimum_bulk_Zn_ppm < -1e-9) {
    failures.push(
      `bulk Zn trajectory left zero [${receipt.result.minimum_bulk_Zn_ppm}, ${receipt.result.peak_bulk_Zn_ppm}] ppm`,
    );
  }
  if (receipt.result.peak_spatial_Zn_ppm > 1e-9) {
    failures.push(`peak spatial Zn ${receipt.result.peak_spatial_Zn_ppm} ppm > 1e-9`);
  }
  if (receipt.result.minimum_spatial_Zn_ppm < -1e-9) {
    failures.push(`minimum spatial Zn ${receipt.result.minimum_spatial_Zn_ppm} ppm < -1e-9`);
  }
  if (Math.abs(receipt.result.final_fluid_Zn_ppm) > 1e-9) {
    failures.push(`final bulk Zn ${receipt.result.final_fluid_Zn_ppm} ppm is nonzero`);
  }
  if (receipt.result.final_spatial_Zn.nonzero_control_volumes !== 0) {
    failures.push(`${receipt.result.final_spatial_Zn.nonzero_control_volumes} final control volumes contain Zn`);
  }
  if (receipt.result.final_booked_Zn_ppm > 1e-9) {
    failures.push(`booked Zn ${receipt.result.final_booked_Zn_ppm} ppm exists without an authored source`);
  }
  if (receipt.result.pharmacolite_crystals < 1) {
    failures.push(`pharmacolite did not form at audited seed ${seed}`);
  }
  if (receipt.result.final_pharmacolite_Ca_molar_fraction_proxy < 0.3) {
    failures.push(
      `final pharmacolite Ca molar proxy ${receipt.result.final_pharmacolite_Ca_molar_fraction_proxy} < 0.3`,
    );
  }
  if (seed === 42) {
    const commissioned = SCHNEEBERG_SEED42_COMMISSIONING;
    if (SIM_VERSION !== commissioned.sim_version
        || MODEL_DIGEST_SHA256 !== commissioned.model_digest_sha256) {
      failures.push(
        `seed 42 has no commissioning checkpoint for SIM ${SIM_VERSION} model ${MODEL_DIGEST_SHA256}`,
      );
    } else {
      if (receipt.result.pharmacolite_crystals !== commissioned.pharmacolite_crystals) {
        failures.push(
          `seed 42 pharmacolite count ${receipt.result.pharmacolite_crystals}, `
          + `expected exactly ${commissioned.pharmacolite_crystals}`,
        );
      }
      if (Math.abs(receipt.result.final_pharmacolite_Ca_molar_fraction_proxy
          - commissioned.final_pharmacolite_Ca_molar_fraction_proxy)
          > commissioned.proxy_tolerance) {
        failures.push(
          `seed 42 final Ca molar proxy ${receipt.result.final_pharmacolite_Ca_molar_fraction_proxy}, `
          + `expected ${commissioned.final_pharmacolite_Ca_molar_fraction_proxy} `
          + `± ${commissioned.proxy_tolerance}`,
        );
      }
    }
  }
  if (failures.length) {
    console.error(`[cation-sink-audit] FAIL SIM ${SIM_VERSION} ${scenarioId} seed ${seed}`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `[cation-sink-audit] PASS SIM ${SIM_VERSION} ${scenarioId} seed ${seed}: `
      + `${receipt.result.audited_trajectory_rows} rows × ${receipt.result.minimum_valid_Zn_control_volumes} finite Zn volumes, `
      + `Zn peak/final 0 ppm, pharmacolite ${receipt.result.pharmacolite_crystals}, `
      + `final Ca molar proxy ${receipt.result.final_pharmacolite_Ca_molar_fraction_proxy.toFixed(6)}`,
    );
  }
} else {
  console.log(JSON.stringify(receipt, null, 2));
}
