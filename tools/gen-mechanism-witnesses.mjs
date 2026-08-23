#!/usr/bin/env node
/**
 * Deterministic production-engine boundary witnesses for mechanisms that a
 * locality trajectory need not cross in every release seed. These are
 * explicitly counterfactual commissioning controls, never claims about the
 * associated locality. They execute the same Crystal, GrowthZone, engine and
 * accepted-zone budget code as gameplay so an implemented-looking reaction
 * cannot remain visible only in a unit-test fixture.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';
import { writeJsonAtomic } from './scenario-evidence-checkpoint.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MECHANISM_WITNESS_SCHEMA = 'vugg-mechanism-witnesses-v2';

const canonicalJson = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const finiteClose = (actual, expected, tolerance = 1e-12) =>
  typeof actual === 'number' && Number.isFinite(actual)
  && typeof expected === 'number' && Number.isFinite(expected)
  && Math.abs(actual - expected) <= tolerance;
const exactKeys = (value, keys) => value && typeof value === 'object'
  && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const readExecutedNumber = (root, relativePath, pattern, label) => {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`cannot resolve executed ${label}`);
  const value = Number(matches[0][1]);
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`invalid executed ${label}`);
  return value;
};
const authoritativeChalcanthiteReturn = (root, lossUm) => {
  const formulaBudget = readExecutedNumber(
    root, 'dist/18-constants.js',
    /STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM\s*=\s*([0-9.eE+-]+)/g,
    'growth-budget formula calibration',
  );
  const chemistryPath = 'dist/20a-chemistry-activity.js';
  const cuMass = readExecutedNumber(
    root, chemistryPath, /\bCu:\s*\{[^}]*\bmolarMass:\s*([0-9.eE+-]+)/g,
    'Cu molar mass',
  );
  const sulfurMass = readExecutedNumber(
    root, chemistryPath, /\bS:\s*\{[^}]*\bmolarMass:\s*([0-9.eE+-]+)/g,
    'S molar mass',
  );
  return Object.freeze({
    Cu: lossUm * formulaBudget * cuMass,
    S_sulfate: lossUm * formulaBudget * sulfurMass,
  });
};
const canonicalChalcanthiteEnclosureReceipt = () => ({
  schema: 'enclosure-receipt-v1', event: 'enclosed', step: 10,
  host_crystal_id: 271, host_mineral: 'calcite',
  guest_crystal_id: 270, guest_mineral: 'chalcanthite',
  route: 'guest-on-host', adjacency_authority: 'exact-substrate-id',
  host_same_step_positive_growth_um: 1,
  host_same_step_negative_growth_um: 0,
  host_same_step_net_growth_um: 1,
  host_physical_size_at_enclosure_um: 401,
  guest_positive_core_um: 100,
  guest_loss_um: 0,
  guest_remaining_growth_um: 100,
  guest_partially_dissolved: false,
  size_ratio: 4.01,
  guest_recent_growth_um: 1.5,
  guest_slowing_threshold_um: 3,
});
const canonicalChalcanthiteEnclosureTopology = () => ({
  host_crystal_id: 271,
  guest_crystal_id: 270,
  guest_enclosed_by: 271,
  host_enclosed_crystals: [270],
  host_enclosed_at_step: [10],
  host_dissolved: false,
  guest_active: false,
  guest_dissolved: false,
});
const CONTROL_ROLE = 'controlled production-engine boundary; not a locality trajectory';
const CHALCANTHITE_CONTROLS = Object.freeze([
  Object.freeze({ name: 'salinity-only', salinity: 0, pH: 3,
    mode: 'water_solubility_low_salinity' }),
  Object.freeze({ name: 'pH-only', salinity: 10, pH: 7,
    mode: 'water_solubility_high_pH' }),
  Object.freeze({ name: 'combined', salinity: 0, pH: 7,
    mode: 'water_solubility_low_salinity_high_pH' }),
  Object.freeze({ name: 'neither', salinity: 10, pH: 3, mode: null }),
]);

const TRANSFORMATION_CASES = Object.freeze([
  Object.freeze({
    mineral: 'haidingerite', parent_mineral: 'pharmacolite', pH_threshold: 4.5,
    claim_card_scenario: 'wittichen', claim_card_link: 'executed-transformation-product',
    formula: Object.freeze({ Ca: 1, As: 1 }),
  }),
  Object.freeze({
    mineral: 'meta-autunite', parent_mineral: 'autunite', pH_threshold: 4.5,
    claim_card_scenario: 'schneeberg', claim_card_link: 'executed-surviving-parent',
    formula: Object.freeze({ Ca: 1, U: 2, P: 2 }),
  }),
  Object.freeze({
    mineral: 'metatorbernite', parent_mineral: 'torbernite', pH_threshold: 5.0,
    claim_card_scenario: 'schneeberg', claim_card_link: 'executed-transformation-product',
    formula: Object.freeze({ Cu: 1, U: 2, P: 2 }),
  }),
  Object.freeze({
    mineral: 'metazeunerite', parent_mineral: 'zeunerite', pH_threshold: 5.0,
    claim_card_scenario: 'schneeberg', claim_card_link: 'executed-transformation-product',
    formula: Object.freeze({ Cu: 1, U: 2, As: 2 }),
  }),
]);

function transformationReactivityWitness(science, spec) {
  const {
    Crystal, GrowthZone, FluidChemistry, MINERAL_ENGINES,
    applyStoichiometricGrowthBudget,
  } = science;
  const crystal = new Crystal({ mineral: spec.mineral, crystal_id: 1 });
  const fluid = new FluidChemistry({
    pH: 7, Ca: 100, Cu: 100, U: 100, P: 100, As: 100,
  });
  const conditions = { fluid, temperature: 25 };
  const shell = new GrowthZone({
    step: 0,
    temperature: 25,
    thickness_um: 10,
    growth_rate: 10,
    formula_stoichiometry: spec.formula,
  });
  shell._time_scaled = true;
  applyStoichiometricGrowthBudget(crystal, shell, conditions);
  crystal.add_zone(shell);
  const before = Object.fromEntries(Object.keys(spec.formula).map(key => [key, Number(fluid[key])]));
  const neutralResult = MINERAL_ENGINES[spec.mineral](crystal, conditions, 1);
  if (neutralResult != null) throw new Error(`${spec.mineral}: transformation product grew/reacted above its acid boundary`);

  const controlPH = spec.pH_threshold - 0.1;
  fluid.pH = controlPH;
  const etch = MINERAL_ENGINES[spec.mineral](crystal, conditions, 2);
  if (!(Number(etch?.thickness_um) < 0) || etch?.dissolutionMode !== 'acid') {
    throw new Error(`${spec.mineral}: no production acid etch below authored boundary`);
  }
  etch._time_scaled = true;
  applyStoichiometricGrowthBudget(crystal, etch, conditions);
  crystal.add_zone(etch);

  const expectedReturn = {};
  const observedReturn = {};
  const closureError = {};
  const removedUm = -Number(etch.thickness_um);
  for (const species of Object.keys(spec.formula)) {
    expectedReturn[species] = Number(shell._budget_inventory_per_um?.[species] || 0) * removedUm;
    observedReturn[species] = Number(fluid[species]) - Number(before[species]);
    closureError[species] = observedReturn[species] - expectedReturn[species];
    if (Math.abs(closureError[species]) > 1e-12) {
      throw new Error(`${spec.mineral}: ${species} booked-return closure error ${closureError[species]}`);
    }
  }
  return {
    mineral: spec.mineral,
    parent_mineral: spec.parent_mineral,
    role: 'controlled production-engine boundary; not a locality trajectory',
    claim_card_scenario: spec.claim_card_scenario,
    claim_card_link: spec.claim_card_link,
    pH_threshold: spec.pH_threshold,
    control_pH: controlPH,
    positive_growth_above_boundary: false,
    parent_shell: {
      thickness_um: Number(shell.thickness_um),
      formula_stoichiometry: copy(shell.formula_stoichiometry),
      booked_inventory_per_um: copy(shell._budget_inventory_per_um),
    },
    accepted_etch: {
      thickness_um: Number(etch.thickness_um),
      dissolution_mode: etch.dissolutionMode,
      transformation_reactivity: copy(etch.transformation_reactivity),
      returned_budget_inventory: copy(etch._returned_budget_inventory),
    },
    expected_return_ppm: expectedReturn,
    observed_return_ppm: observedReturn,
    closure_error_ppm: closureError,
    remaining_solid_um: Number(crystal.total_growth_um),
  };
}

function acceptedZone(science, thicknessUm, step = 0) {
  const zone = new science.GrowthZone({
    step, thickness_um: thicknessUm, growth_rate: thicknessUm,
  });
  zone._time_scaled = true;
  return zone;
}

function controlledSimulator(science) {
  science.setSeed(42);
  const scenario = science.SCENARIOS.cooling();
  const sim = new science.VugSimulator(scenario.conditions, scenario.events);
  sim.events = [];
  sim.check_nucleation = () => {};
  sim._applyGeometricSelection = () => {};
  sim._runEngineForCrystal = () => null;
  sim.get_vug_fill = () => 0.5;
  return sim;
}

function installChalcanthite(science, sim, crystal, cellIdx) {
  crystal.wall_anchor = sim.wall_state._anchorFromRingCell(0, cellIdx);
  const localFluid = sim.wall_state.meshFor(sim).cellOf(crystal, sim.wall_state).fluid;
  localFluid.sulfurPoolsExplicit = true;
  localFluid.S_sulfate = Number(localFluid.S_sulfate) || 0;
  localFluid.S_sulfide = Number(localFluid.S_sulfide) || 0;
  localFluid.S_elemental = Number(localFluid.S_elemental) || 0;
  return localFluid;
}

function chalcanthiteWaterSolubilityWitness(science, spec, index) {
  const sim = controlledSimulator(science);
  const crystal = new science.Crystal({
    mineral: 'chalcanthite', crystal_id: 200 + index, habit: 'prismatic',
  });
  crystal.add_zone(acceptedZone(science, 10));
  crystal._buried = true;
  sim.crystals = [crystal];
  const localFluid = installChalcanthite(science, sim, crystal, 8 + index);
  sim.conditions.fluid.salinity = 10;
  sim.conditions.fluid.pH = 3;
  localFluid.salinity = spec.salinity;
  localFluid.pH = spec.pH;
  const localBefore = { Cu: Number(localFluid.Cu), S_sulfate: Number(localFluid.S_sulfate) };
  const bulkBefore = {
    Cu: Number(sim.conditions.fluid.Cu),
    S: Number(sim.conditions.fluid.S),
    S_sulfate: Number(sim.conditions.fluid.S_sulfate),
  };
  let bookedLocal = null;
  let bookedBulk = null;
  let bookedLocalAfter = null;
  let bookedBulkAfter = null;
  const applyBudget = sim._applyZoneGrowthBudget.bind(sim);
  sim._applyZoneGrowthBudget = (target, accepted) => {
    const beforeLocal = { Cu: Number(localFluid.Cu), S_sulfate: Number(localFluid.S_sulfate) };
    const beforeBulk = {
      Cu: Number(sim.conditions.fluid.Cu),
      S: Number(sim.conditions.fluid.S),
      S_sulfate: Number(sim.conditions.fluid.S_sulfate),
    };
    const result = applyBudget(target, accepted);
    bookedLocal = {
      Cu: Number(localFluid.Cu) - beforeLocal.Cu,
      S_sulfate: Number(localFluid.S_sulfate) - beforeLocal.S_sulfate,
    };
    bookedBulk = {
      Cu: Number(sim.conditions.fluid.Cu) - beforeBulk.Cu,
      S: Number(sim.conditions.fluid.S) - beforeBulk.S,
      S_sulfate: Number(sim.conditions.fluid.S_sulfate) - beforeBulk.S_sulfate,
    };
    bookedLocalAfter = {
      Cu: Number(localFluid.Cu), S_sulfate: Number(localFluid.S_sulfate),
    };
    bookedBulkAfter = {
      Cu: Number(sim.conditions.fluid.Cu),
      S: Number(sim.conditions.fluid.S),
      S_sulfate: Number(sim.conditions.fluid.S_sulfate),
    };
    return result;
  };
  const recorder = new science.StripRecorder(sim, { duration_steps: 1, angular_indices: 1 });
  sim.run_step();
  recorder.captureStep(sim);
  const dataset = recorder.finalize();
  const loss = crystal.zones.find(zone => Number(zone.thickness_um) < 0) || null;
  const stripLoss = (dataset.layer_growth_testimony || []).find(row =>
    row.crystal_id === crystal.crystal_id && Number(row.thickness_um) < 0) || null;
  const expectedLossUm = spec.mode == null ? 0 : 4;
  const expectedReturn = {
    Cu: expectedLossUm * science.stoichiometricBudgetDebitPpmPerUm('Cu', 1),
    S_sulfate: expectedLossUm * science.stoichiometricBudgetDebitPpmPerUm('S', 1),
  };
  if (spec.mode == null) {
    bookedLocal = { Cu: 0, S_sulfate: 0 };
    bookedBulk = { Cu: 0, S: 0, S_sulfate: 0 };
    bookedLocalAfter = { ...localBefore };
    bookedBulkAfter = { ...bulkBefore };
  }
  const returned = copy(loss?._returned_budget_inventory || {});
  return {
    name: spec.name,
    mineral: 'chalcanthite',
    role: CONTROL_ROLE,
    local_gate: {
      salinity: spec.salinity,
      pH: spec.pH,
      low_salinity: spec.salinity < 4,
      high_pH: spec.pH > 5,
    },
    bulk_control: { salinity: 10, pH: 3 },
    accepted_loss_um: loss ? -Number(loss.thickness_um) : 0,
    dissolution_mode: loss?.dissolutionMode || null,
    returned_budget_inventory: returned,
    expected_return_ppm: expectedReturn,
    booked_local_delta_ppm: bookedLocal,
    booked_local_after_ppm: bookedLocalAfter,
    booked_bulk_delta_ppm: bookedBulk,
    booked_bulk_after_ppm: bookedBulkAfter,
    local_before_ppm: localBefore,
    bulk_before_ppm: bulkBefore,
    strip_negative_layer: stripLoss ? {
      thickness_um: Number(stripLoss.thickness_um),
      dissolution_mode: stripLoss.dissolution_mode,
      returned_budget_inventory: copy(stripLoss.returned_budget_inventory || {}),
    } : null,
    remaining_solid_um: Number(crystal.total_growth_um),
  };
}

function chalcanthiteEnclosureWitness(science) {
  const sim = controlledSimulator(science);
  sim.step = 9;
  const guest = new science.Crystal({
    mineral: 'chalcanthite', crystal_id: 270, habit: 'prismatic',
  });
  for (const [step, amount] of [[0, 98.5], [1, 0.5], [2, 0.5], [3, 0.5]]) {
    guest.add_zone(acceptedZone(science, amount, step));
  }
  const host = new science.Crystal({
    mineral: 'calcite', crystal_id: 271, habit: 'rhombohedral',
  });
  host.add_zone(acceptedZone(science, 400, 9));
  host.add_zone(acceptedZone(science, 1, 10));
  host.active = false;
  const receipt = canonicalChalcanthiteEnclosureReceipt();
  guest.active = false;
  guest.enclosed_by = host.crystal_id;
  guest.enclosure_receipt = receipt;
  host.enclosed_crystals = [guest.crystal_id];
  host.enclosed_at_step = [10];
  sim.crystals = [guest, host];
  sim._enclosureReceipts = [receipt];
  const localFluid = installChalcanthite(science, sim, guest, 5);
  localFluid.salinity = 0;
  localFluid.pH = 7;
  sim.conditions.fluid.salinity = 10;
  sim.conditions.fluid.pH = 3;
  const authorityBefore = !!science.currentEnclosureAuthority(sim, guest);
  const recorder = new science.StripRecorder(sim, { duration_steps: 1, angular_indices: 1 });
  sim.run_step();
  recorder.captureStep(sim);
  const dataset = recorder.finalize();
  const stripLosses = (dataset.layer_growth_testimony || []).filter(row =>
    row.crystal_id === guest.crystal_id && Number(row.thickness_um) < 0);
  return {
    name: 'authenticated-enclosure-withheld',
    mineral: 'chalcanthite',
    role: CONTROL_ROLE,
    local_gate: { salinity: 0, pH: 7, low_salinity: true, high_pH: true },
    enclosure_receipt: copy(receipt),
    topology: canonicalChalcanthiteEnclosureTopology(),
    authority_before: authorityBefore,
    authority_after: !!science.currentEnclosureAuthority(sim, guest),
    accepted_loss_um: 100 - Number(guest.total_growth_um),
    strip_negative_layer_count: stripLosses.length,
    remaining_solid_um: Number(guest.total_growth_um),
  };
}

export function verifyMechanismWitnessArtifact(root, artifact, expected = {}) {
  if (artifact?.schema !== MECHANISM_WITNESS_SCHEMA) throw new Error('mechanism witness schema mismatch');
  if (expected.simVersion != null && artifact.sim_version !== Number(expected.simVersion)) {
    throw new Error('mechanism witness SIM version mismatch');
  }
  if (expected.modelDigest != null && artifact.model_digest !== String(expected.modelDigest)) {
    throw new Error('mechanism witness model digest mismatch');
  }
  if (artifact.browser_bundle_sha256 !== browserBundleDigest(root)) throw new Error('mechanism witness browser bundle mismatch');
  if (artifact.execution_set_sha256 !== runtimeExecutionDigest(root)) throw new Error('mechanism witness execution set mismatch');
  if (canonicalJson(artifact.node_runtime) !== canonicalJson(nodeRuntimeIdentity())
      || artifact.node_runtime_sha256 !== nodeRuntimeDigest()) {
    throw new Error('mechanism witness Node/V8 runtime mismatch');
  }
  if (artifact.producer_contract_sha256 !== producerContractDigest(root, 'mechanism-witnesses')) {
    throw new Error('mechanism witness producer mismatch');
  }
  if (artifact.payload_sha256 !== sha256(canonicalJson(artifact.payload))) {
    throw new Error('mechanism witness payload digest mismatch');
  }
  const controls = artifact.payload?.transformation_reactivity;
  if (!Array.isArray(controls) || controls.length !== TRANSFORMATION_CASES.length) {
    throw new Error('mechanism witness transformation control fleet is incomplete');
  }
  for (const control of controls) {
    if (control.role !== 'controlled production-engine boundary; not a locality trajectory') {
      throw new Error(`${control.mineral}: mechanism witness role is ambiguous`);
    }
    if (control.accepted_etch?.dissolution_mode !== 'acid'
        || !(Number(control.accepted_etch?.thickness_um) < 0)
        || control.accepted_etch?.transformation_reactivity?.inventory_authority !== 'booked-layer-lifo') {
      throw new Error(`${control.mineral}: mechanism witness does not prove accepted booked acid return`);
    }
    if (!control.parent_mineral || !control.claim_card_scenario
        || !['executed-transformation-product', 'executed-surviving-parent'].includes(control.claim_card_link)) {
      throw new Error(`${control.mineral}: mechanism witness lacks a fail-closed claim-card link`);
    }
    for (const error of Object.values(control.closure_error_ppm || {})) {
      if (Math.abs(Number(error)) > 1e-12) throw new Error(`${control.mineral}: mechanism witness does not close`);
    }
  }
  const solubility = artifact.payload?.chalcanthite_water_solubility;
  if (!solubility || !Array.isArray(solubility.trigger_controls)
      || solubility.trigger_controls.length !== CHALCANTHITE_CONTROLS.length) {
    throw new Error('chalcanthite water-solubility witness fleet is incomplete');
  }
  for (let index = 0; index < CHALCANTHITE_CONTROLS.length; index++) {
    const expectedControl = CHALCANTHITE_CONTROLS[index];
    const control = solubility.trigger_controls[index];
    if (control?.name !== expectedControl.name || control?.mineral !== 'chalcanthite'
        || control?.role !== CONTROL_ROLE) {
      throw new Error('chalcanthite witness identity/role mismatch');
    }
    const gate = control.local_gate;
    if (!exactKeys(gate, ['salinity', 'pH', 'low_salinity', 'high_pH'])
        || gate.salinity !== expectedControl.salinity || gate.pH !== expectedControl.pH
        || gate.low_salinity !== (expectedControl.salinity < 4)
        || gate.high_pH !== (expectedControl.pH > 5)
        || !exactKeys(control.bulk_control, ['salinity', 'pH'])
        || control.bulk_control.salinity !== 10 || control.bulk_control.pH !== 3) {
      throw new Error(`${expectedControl.name}: chalcanthite witness gate mismatch`);
    }
    const triggered = expectedControl.mode != null;
    if (control.dissolution_mode !== expectedControl.mode
        || control.accepted_loss_um !== (triggered ? 4 : 0)
        || control.remaining_solid_um !== (triggered ? 6 : 10)) {
      throw new Error(`${expectedControl.name}: chalcanthite witness loss/mode mismatch`);
    }
    const authoritativeReturn = authoritativeChalcanthiteReturn(
      root, triggered ? control.accepted_loss_um : 0,
    );
    const expectedReturn = control.expected_return_ppm;
    const returned = control.returned_budget_inventory;
    const localBefore = control.local_before_ppm;
    const localDelta = control.booked_local_delta_ppm;
    const localAfter = control.booked_local_after_ppm;
    const bulkBefore = control.bulk_before_ppm;
    const bulkDelta = control.booked_bulk_delta_ppm;
    const bulkAfter = control.booked_bulk_after_ppm;
    if (!exactKeys(expectedReturn, ['Cu', 'S_sulfate'])
        || !exactKeys(localBefore, ['Cu', 'S_sulfate'])
        || !exactKeys(localDelta, ['Cu', 'S_sulfate'])
        || !exactKeys(localAfter, ['Cu', 'S_sulfate'])
        || !exactKeys(bulkBefore, ['Cu', 'S', 'S_sulfate'])
        || !exactKeys(bulkDelta, ['Cu', 'S', 'S_sulfate'])
        || !exactKeys(bulkAfter, ['Cu', 'S', 'S_sulfate'])) {
      throw new Error(`${expectedControl.name}: chalcanthite transaction schema mismatch`);
    }
    for (const species of ['Cu', 'S_sulfate']) {
      if (!finiteClose(expectedReturn[species], authoritativeReturn[species])
          || !finiteClose(localBefore[species], 0)
          || !finiteClose(localDelta[species], authoritativeReturn[species])
          || !finiteClose(localAfter[species], localBefore[species] + localDelta[species])) {
        throw new Error(`${expectedControl.name}: chalcanthite authoritative ${species} transaction does not close`);
      }
    }
    for (const species of ['Cu', 'S', 'S_sulfate']) {
      if (!finiteClose(bulkBefore[species], 0)
          || !finiteClose(bulkDelta[species], 0)
          || !finiteClose(bulkAfter[species], bulkBefore[species])) {
        throw new Error(`${expectedControl.name}: chalcanthite bulk transaction is not closed`);
      }
    }
    if (!triggered) {
      if (control.strip_negative_layer != null
          || Object.keys(control.returned_budget_inventory || {}).length !== 0) {
        throw new Error('neither-trigger chalcanthite control contains a forged loss');
      }
      continue;
    }
    const strip = control.strip_negative_layer;
    if (!exactKeys(returned, ['Cu', 'S_sulfate'])
        || !exactKeys(strip, ['thickness_um', 'dissolution_mode', 'returned_budget_inventory'])
        || !exactKeys(strip.returned_budget_inventory, ['Cu', 'S_sulfate'])) {
      throw new Error(`${expectedControl.name}: chalcanthite return reached the wrong reservoir/bulk`);
    }
    for (const species of ['Cu', 'S_sulfate']) {
      if (!finiteClose(returned[species], authoritativeReturn[species])
          || !finiteClose(strip.returned_budget_inventory[species], authoritativeReturn[species])) {
        throw new Error(`${expectedControl.name}: chalcanthite ${species} local return does not close`);
      }
    }
    if (strip?.dissolution_mode !== expectedControl.mode || strip?.thickness_um !== -4) {
      throw new Error(`${expectedControl.name}: strip testimony does not match chalcanthite loss`);
    }
  }
  const enclosure = solubility.enclosure_control;
  if (enclosure?.name !== 'authenticated-enclosure-withheld'
      || enclosure?.role !== CONTROL_ROLE || enclosure?.mineral !== 'chalcanthite'
      || enclosure?.authority_before !== true || enclosure?.authority_after !== true
      || enclosure?.accepted_loss_um !== 0 || enclosure?.strip_negative_layer_count !== 0
      || enclosure?.remaining_solid_um !== 100
      || canonicalJson(enclosure?.local_gate) !== canonicalJson({
        salinity: 0, pH: 7, low_salinity: true, high_pH: true,
      })
      || canonicalJson(enclosure?.enclosure_receipt)
        !== canonicalJson(canonicalChalcanthiteEnclosureReceipt())
      || canonicalJson(enclosure?.topology)
        !== canonicalJson(canonicalChalcanthiteEnclosureTopology())) {
    throw new Error('authenticated chalcanthite enclosure witness does not withhold decay');
  }
  return true;
}

export async function buildMechanismWitnessArtifact(root = ROOT) {
  const science = await loadSimBundle({
    toolName: 'gen-mechanism-witnesses',
    extraExports: [
      'Crystal', 'GrowthZone', 'FluidChemistry', 'MINERAL_ENGINES',
      'applyStoichiometricGrowthBudget', 'VugSimulator', 'SCENARIOS', 'setSeed',
      'StripRecorder', 'currentEnclosureAuthority',
      'stoichiometricBudgetDebitPpmPerUm',
    ],
  });
  const payload = {
    source: 'exact production classes, engines, and accepted-zone budget path',
    transformation_reactivity: TRANSFORMATION_CASES.map(spec => transformationReactivityWitness(science, spec)),
    chalcanthite_water_solubility: {
      role: CONTROL_ROLE,
      trigger_controls: CHALCANTHITE_CONTROLS.map((spec, index) =>
        chalcanthiteWaterSolubilityWitness(science, spec, index)),
      enclosure_control: chalcanthiteEnclosureWitness(science),
    },
  };
  return {
    schema: MECHANISM_WITNESS_SCHEMA,
    sim_version: science.SIM_VERSION,
    model_digest: science.MODEL_DIGEST,
    browser_bundle_sha256: browserBundleDigest(root),
    execution_set_sha256: runtimeExecutionDigest(root),
    node_runtime: nodeRuntimeIdentity(),
    node_runtime_sha256: nodeRuntimeDigest(),
    producer_contract_sha256: producerContractDigest(root, 'mechanism-witnesses'),
    payload,
    payload_sha256: sha256(canonicalJson(payload)),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  for (const arg of process.argv.slice(2)) if (arg !== '--check') throw new Error(`unknown argument: ${arg}`);
  const artifact = await buildMechanismWitnessArtifact(ROOT);
  verifyMechanismWitnessArtifact(ROOT, artifact, {
    simVersion: artifact.sim_version,
    modelDigest: artifact.model_digest,
  });
  const output = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${artifact.sim_version}.json`);
  const encoded = `${JSON.stringify(artifact, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== encoded) {
      throw new Error(`stale mechanism witness artifact: ${path.relative(ROOT, output)}`);
    }
    console.log(`[mechanism-witnesses] PASS: ${artifact.payload.transformation_reactivity.length} transformation + ${artifact.payload.chalcanthite_water_solubility.trigger_controls.length + 1} chalcanthite controls`);
  } else {
    writeJsonAtomic(output, artifact);
    console.log(`[mechanism-witnesses] wrote ${path.relative(ROOT, output)}`);
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main().catch(error => {
  console.error(`[mechanism-witnesses] FAIL: ${error.message}`);
  process.exitCode = 1;
});
