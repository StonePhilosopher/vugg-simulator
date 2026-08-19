#!/usr/bin/env node
/**
 * Deterministic science receipt for the paired Asbestos Hills models.
 * Runs production scenarios at gameplay seed 42 and fails closed when the
 * modeled histories lose their required crocidolite substrate, pressure
 * transition, or hypothesis-specific preservation/alteration behavior.
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'asbestos-hills-observe',
});

const seedArg = process.argv.indexOf('--seed');
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 42;
const check = process.argv.includes('--check');

const models = [
  {
    scenario: 'asbestos_hills_crack_seal',
    token: 'model=antitaxial-crack-seal',
    shapeSeed: 2003,
    oxidativeLoss: false,
  },
  {
    scenario: 'asbestos_hills_surficial_alteration',
    token: 'model=surficial-alteration',
    shapeSeed: 2004,
    oxidativeLoss: true,
  },
];

const receipts = [];
const failures = [];

for (const expected of models) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[expected.scenario]();
  const sim = new VugSimulator(conditions, events);
  const snapshots = [];
  const captureSteps = new Set([1, 57, 58, 59, defaultSteps]);
  for (let i = 0; i < defaultSteps; i++) {
    sim.run_step();
    if (captureSteps.has(sim.step)) {
      snapshots.push({
        step: sim.step,
        temperature_C: Number(sim.conditions.temperature.toFixed(2)),
        fluid_pressure_kbar: Number(sim.conditions.pressure.toFixed(6)),
        rock_pressure_kbar: Number(sim.conditions.wall.confining_pressure_kbar.toFixed(6)),
        pH: Number(sim.conditions.fluid.pH.toFixed(3)),
        O2: Number(sim.conditions.fluid.O2.toFixed(3)),
        SiO2: Number(sim.conditions.fluid.SiO2.toFixed(2)),
        Fe: Number(sim.conditions.fluid.Fe.toFixed(2)),
        tiger_eye_stage: sim.conditions._scenario?.tiger_eye_stage,
      });
    }
  }

  const crocidolites = sim.crystals.filter(crystal => crystal.mineral === 'crocidolite');
  const tigersEye = sim.crystals.filter(crystal => crystal.mineral === 'tigers_eye');
  const oxidativeZones = crocidolites.flatMap(crystal =>
    (crystal.zones || [])
      .filter(zone => zone.thickness_um < 0 && zone.dissolutionMode === 'oxidative')
      .map(zone => ({
        crystal_id: crystal.crystal_id,
        step: zone.step,
        thickness_um: Number(zone.thickness_um.toFixed(4)),
        returned: Object.fromEntries(Object.entries(zone._returned_budget_inventory || {})
          .map(([species, value]) => [species, Number(Number(value).toFixed(8))])),
        accepted: Number(zone._returned_budget_inventory?.Na) > 0
          && Number(zone._returned_budget_inventory?.Fe) > 0
          && Number(zone._returned_budget_inventory?.SiO2) > 0,
      })));
  const acceptedOxidativeZones = oxidativeZones.filter(zone => zone.accepted);
  const oxidativeZoneSummary = {
    count: oxidativeZones.length,
    first_step: oxidativeZones.length ? Math.min(...oxidativeZones.map(zone => zone.step)) : null,
    last_step: oxidativeZones.length ? Math.max(...oxidativeZones.map(zone => zone.step)) : null,
    total_loss_um: Number((-oxidativeZones.reduce((sum, zone) => sum + zone.thickness_um, 0)).toFixed(3)),
    crystal_ids: [...new Set(oxidativeZones.map(zone => zone.crystal_id))],
    accepted_count: acceptedOxidativeZones.length,
    first_accepted_step: acceptedOxidativeZones.length
      ? Math.min(...acceptedOxidativeZones.map(zone => zone.step)) : null,
  };
  const receipt = {
    scenario: expected.scenario,
    seed,
    shape_seed: sim.conditions.wall.shape_seed,
    host: sim.conditions.wall.composition,
    model: sim.conditions._scenario?.tiger_eye_origin_model,
    snapshots,
    crocidolite: crocidolites.map(crystal => ({
      crystal_id: crystal.crystal_id,
      nucleation_step: crystal.nucleation_step,
      active: !!crystal.active,
      dissolved: !!crystal.dissolved,
      growth_um: Number((Number(crystal.total_growth_um) || 0).toFixed(3)),
    })),
    oxidative_crocidolite_zones: oxidativeZoneSummary,
    tigers_eye: tigersEye.map(crystal => ({
      crystal_id: crystal.crystal_id,
      nucleation_step: crystal.nucleation_step,
      habit: crystal.habit,
      position: crystal.position,
      growth_um: Number((Number(crystal.total_growth_um) || 0).toFixed(3)),
      booked_fe_remaining_ppm_equivalent: Number((crystal.zones || [])
        .filter(zone => zone.thickness_um > 0)
        .reduce((sum, zone) => sum + Math.max(0, Number(zone._remaining_solid_um) || 0)
          * Math.max(0, Number(zone._budget_inventory_per_um?.Fe) || 0), 0).toFixed(8)),
      positive_growth_before_step_58_um: Number((crystal.zones || [])
        .filter(zone => zone.thickness_um > 0 && zone.step < 58)
        .reduce((sum, zone) => sum + zone.thickness_um, 0).toFixed(6)),
      positive_growth_from_step_58_um: Number((crystal.zones || [])
        .filter(zone => zone.thickness_um > 0 && zone.step >= 58)
        .reduce((sum, zone) => sum + zone.thickness_um, 0).toFixed(6)),
      oxidation_state: crystal._tiger_eye_oxidation_state || null,
      state_overprints: (crystal.zones || [])
        .filter(zone => zone.state_overprint === 'tiger_eye_fe_oxidation_colour')
        .map(zone => ({
          step: zone.step,
          thickness_um: zone.thickness_um,
          state_overprint: zone.state_overprint,
          oxidation_fraction: Number(zone.oxidation_receipt?.modeled_ferrous_oxidation_fraction) || 0,
          colour_state: zone.oxidation_receipt?.colour_state || null,
          oxygen_consumed_claimed: Number(zone.oxidation_receipt?.oxygen_consumed) || 0,
          oxygen_after: Number(zone.oxidation_receipt?.oxygen_after),
          oxygen_delta: Number(zone._state_overprint_fluid_delta_actual?.O2) || 0,
        })),
    })),
    fluid_boundary_transactions: sim._fluidBoundaryTransactions || [],
    fluid_boundary_violations: sim._fluidBoundaryViolations || [],
  };
  receipts.push(receipt);

  const require = (condition, message) => {
    if (!condition) failures.push(`${expected.scenario}: ${message}`);
  };
  require(receipt.shape_seed === expected.shapeSeed, `shape seed is ${receipt.shape_seed}, expected ${expected.shapeSeed}`);
  require(receipt.host === 'banded_iron_formation', `host is ${receipt.host}`);
  require(crocidolites.length > 0, 'no crocidolite grew');
  require(tigersEye.length > 0, 'no tiger\'s-eye grew');
  require(tigersEye.every(crystal => String(crystal.position).includes(expected.token)), 'tiger\'s-eye lacks the selected model token');
  require((acceptedOxidativeZones.length > 0) === expected.oxidativeLoss,
    `accepted oxidative crocidolite loss=${acceptedOxidativeZones.length > 0}, expected ${expected.oxidativeLoss}`);
  if (expected.scenario === 'asbestos_hills_crack_seal') {
    require(oxidativeZones.length === 0, 'crack-seal crocidolite acquired an oxidative loss zone');
    require(receipt.tigers_eye.every(crystal => crystal.positive_growth_from_step_58_um === 0),
      'crack-seal tiger\'s-eye added positive SiO2 framework after the oxidation event');
    require(receipt.tigers_eye.some(crystal => crystal.state_overprints.some(zone =>
      zone.step >= 58 && zone.thickness_um === 0 && zone.oxidation_fraction > 0)),
    'no accepted zero-thickness Fe-oxidation overprint was recorded after step 58');
    require(receipt.tigers_eye.every(crystal => crystal.state_overprints.every(zone =>
      zone.oxygen_consumed_claimed > 0
      && zone.oxygen_delta < 0
      && zone.oxygen_after >= 0
      && Math.abs(zone.oxygen_consumed_claimed + zone.oxygen_delta) < 1e-8)),
    'an Fe-oxidation state receipt does not close against its actual O2 debit');
  } else {
    const firstTigerStep = Math.min(...tigersEye.map(crystal => crystal.nucleation_step));
    require(firstTigerStep > oxidativeZoneSummary.first_accepted_step,
      `first tiger's-eye step ${firstTigerStep} did not follow accepted alteration step ${oxidativeZoneSummary.first_accepted_step}`);
  }
  require(sim.conditions.pressure === 0.001, `final fluid pressure is ${sim.conditions.pressure} kbar`);
  require(sim.conditions.wall.confining_pressure_kbar === 0.001,
    `final rock pressure is ${sim.conditions.wall.confining_pressure_kbar} kbar`);
  const oxygenBoundaryReceipts = (sim._fluidBoundaryTransactions || []).filter(transaction =>
    transaction.closed && (transaction.declarations || []).some(declaration =>
      Object.prototype.hasOwnProperty.call(declaration.fields || {}, 'O2')));
  require(oxygenBoundaryReceipts.length > 0,
    'oxidizing meteoric-water O2 replacement lacks a closed boundary receipt');
  require((sim._fluidBoundaryViolations || []).length === 0, 'fluid boundary ledger reports violations');
}

console.log(JSON.stringify({
  schema: 'vugg-asbestos-hills-receipt-v2',
  seed,
  receipts,
  failures,
}, null, 2));

if (check && failures.length) process.exitCode = 1;
