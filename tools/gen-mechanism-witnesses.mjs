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
import { parseScenarioDocument } from './scenario-authoring.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MECHANISM_WITNESS_SCHEMA = 'vugg-mechanism-witnesses-v5';

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
const PLAYER_CHOICE_CONTROL = Object.freeze({
  scenario: 'cooling', seed: 42, action: 'heat', appliedDelta: 25,
});
const GUIDED_TUTORIAL_CONTROL = Object.freeze({
  scenario: 'shigar_pegmatite', seed: 42, steps: 70,
  expectedPositiveMinerals: Object.freeze({
    albite: 2, feldspar: 2, quartz: 3, topaz: 4, tourmaline: 7,
  }),
});
const GUIDED_STRIP_RECORDED_AT = 281000042;

// Reconstruct the complete controlled Simulation command from authored source.
// Verification calls this independently: a witness cannot add a plausible-
// looking cavity override, rehash itself, and turn it into authenticated prose.
const guidedTutorialSourceAuthority = root => {
  const doc = parseScenarioDocument(fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8'));
  const spec = doc?.scenarios?.[GUIDED_TUTORIAL_CONTROL.scenario];
  if (!spec) throw new Error('guided tutorial Shigar scenario source is absent');
  const preset = spec?.tutorial?.preset;
  const expectedPreset = {
    seed: GUIDED_TUTORIAL_CONTROL.seed,
    steps: GUIDED_TUTORIAL_CONTROL.steps,
    shapeSeed: '',
    cavitySize: 'any',
  };
  if (!exactKeys(preset, Object.keys(expectedPreset))
      || canonicalJson(preset) !== canonicalJson(expectedPreset)) {
    throw new Error('guided tutorial Shigar preset does not own the complete command');
  }
  const grow = spec.tutorial.steps.find(step => step?.action?.selector === '#btn-grow')?.action;
  const expectedContext = [
    { selector: '#scenario', valueNormalized: GUIDED_TUTORIAL_CONTROL.scenario },
    { selector: '#seed', valueNormalized: String(GUIDED_TUTORIAL_CONTROL.seed) },
    { selector: '#steps', valueNormalized: String(GUIDED_TUTORIAL_CONTROL.steps) },
    { selector: '#shape-seed', valueExact: '' },
    { selector: '#cavity-size', valueExact: 'any' },
  ];
  if (!grow || canonicalJson(grow.context) !== canonicalJson(expectedContext)) {
    throw new Error('guided tutorial Shigar Grow does not bind the complete command');
  }
  const wall = spec?.initial?.wall;
  if (!wall || typeof wall.shape_seed !== 'number' || !Number.isSafeInteger(wall.shape_seed)
      || typeof wall.vug_diameter_mm !== 'number' || !Number.isFinite(wall.vug_diameter_mm)
      || !(wall.vug_diameter_mm > 0)) {
    throw new Error('guided tutorial Shigar resolved cavity source is invalid');
  }
  return {
    scenario_spec_hash: sha256(JSON.stringify(spec)),
    command_authority: {
      scenario: GUIDED_TUTORIAL_CONTROL.scenario,
      growth_seed: preset.seed,
      steps: preset.steps,
      shape_seed_input: preset.shapeSeed,
      cavity_size_input: preset.cavitySize,
    },
    resolved_cavity_authority: {
      source: 'scenario-default',
      shape_seed: wall.shape_seed,
      vug_diameter_mm: wall.vug_diameter_mm,
    },
  };
};

const guidedTutorialProductSourceAuthority = root => {
  const doc = parseScenarioDocument(fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8'));
  const tour = doc?.scenarios?.tutorial_first_crystal?.tutorial;
  const travertine = doc?.scenarios?.tutorial_travertine?.tutorial;
  if (!tour || !travertine) throw new Error('guided tutorial product source is absent');
  const viewerProducts = tour.steps
    .filter(step => step?.action?.event === 'vugg:tutorial-view-state-committed')
    .map(step => ({ selector: step.action.selector, ...copy(step.action.productState) }));
  const expectedViewerProducts = [
    { selector: '#topo-three-btn', control: 'topo-three-renderer', beforeEnabled: true, afterEnabled: false },
    { selector: '#topo-three-btn', control: 'topo-three-renderer', beforeEnabled: false, afterEnabled: true },
    { selector: '#helix-overlay-btn', control: 'helix-overlay', beforeEnabled: false, afterEnabled: true },
    { selector: '#helix-overlay-btn', control: 'helix-overlay', beforeEnabled: true, afterEnabled: false },
  ];
  if (canonicalJson(viewerProducts) !== canonicalJson(expectedViewerProducts)) {
    throw new Error('guided tutorial viewer products do not bind the commissioned transitions');
  }
  const acid = travertine.steps.find(step =>
    step?.action?.event === 'vugg:fortress-fluid-action-committed')?.action;
  const expectedAcid = {
    event: 'vugg:fortress-fluid-action-committed',
    selector: '.action-grid',
    productAction: 'carbonate-acid-titration',
  };
  if (canonicalJson(acid) !== canonicalJson(expectedAcid)) {
    throw new Error('guided tutorial acid step does not bind committed titration product');
  }
  return {
    commissioned_viewer_boot_state: {
      topo_three_renderer_enabled: true,
      helix_overlay_enabled: false,
    },
    viewer_products: expectedViewerProducts,
    carbonate_titration_product: expectedAcid,
  };
};

const guidedStripControlManifest = (root, simVersion, modelDigest) => {
  const doc = parseScenarioDocument(fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8'));
  const spec = doc?.scenarios?.tn457_barite_pulses;
  if (!spec) throw new Error('guided tutorial TN457 scenario source is absent');
  return {
    format_version: 4,
    sim_version: simVersion,
    model_digest: modelDigest,
    scenario_id: 'tn457_barite_pulses',
    scenario_spec_hash: sha256(JSON.stringify(spec)),
    seed: 42,
    recorded_at: GUIDED_STRIP_RECORDED_AT,
    duration_steps: 110,
    axes: { steps: 110, angular_indices: 24, height_positions: 16 },
    chips: [],
  };
};

const guidedStripControlDataset = manifest => ({
  manifest,
  chip_data: new Uint8Array([0, 1, 2, 3]),
  nucleation_events: [],
  pressure_phase_testimony: [], stress_event_testimony: [],
  transformation_event_testimony: [], carbonate_boundary_testimony: [],
  sulfur_ledger_testimony: [], fluid_boundary_testimony: [],
  enclosure_testimony: [], player_action_testimony: [],
  layer_growth_testimony: [], habit_morphology_testimony: [],
});

// Independent Node reconstruction of stripSerialize(ds, false) for the
// tiny controlled dataset. Verification never trusts the witness's own
// receipt hashes or the browser helper that produced them.
const serializeGuidedStripControl = dataset => {
  const manifest = Buffer.from(JSON.stringify(dataset.manifest), 'utf8');
  const events = Buffer.from(JSON.stringify(dataset.nucleation_events), 'utf8');
  const testimony = Buffer.from(JSON.stringify({
    pressure_phase_testimony: dataset.pressure_phase_testimony || [],
    stress_event_testimony: dataset.stress_event_testimony || [],
    transformation_event_testimony: dataset.transformation_event_testimony || [],
    carbonate_boundary_testimony: dataset.carbonate_boundary_testimony || [],
    sulfur_ledger_testimony: dataset.sulfur_ledger_testimony || [],
    fluid_boundary_testimony: dataset.fluid_boundary_testimony || [],
    enclosure_testimony: dataset.enclosure_testimony || [],
    player_action_testimony: dataset.player_action_testimony || [],
    layer_growth_testimony: dataset.layer_growth_testimony || [],
    habit_morphology_testimony: dataset.habit_morphology_testimony || [],
  }), 'utf8');
  const u32 = value => {
    const out = Buffer.alloc(4);
    out.writeUInt32LE(value, 0);
    return out;
  };
  return Buffer.concat([
    u32(manifest.length), manifest,
    u32(events.length), events,
    u32(0), // format-v4 depletion floor is absent
    u32(testimony.length), testimony,
    Buffer.from(dataset.chip_data),
  ]);
};

const guidedStripControlReceipt = (root, simVersion, modelDigest) => {
  const manifest = guidedStripControlManifest(root, simVersion, modelDigest);
  const key = `${manifest.scenario_id}@${manifest.seed}#${manifest.recorded_at}`;
  return {
    key,
    scenario_id: manifest.scenario_id,
    seed: manifest.seed,
    recorded_at: manifest.recorded_at,
    sim_version: manifest.sim_version,
    model_digest: manifest.model_digest,
    scenario_spec_hash: manifest.scenario_spec_hash,
    manifest_digest_sha256: sha256(JSON.stringify(manifest)),
    dataset_digest_sha256: sha256(serializeGuidedStripControl(
      guidedStripControlDataset(manifest),
    )),
  };
};

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

function playerMovementChoiceWitness(science) {
  const run = (intervene) => {
    science.setSeed(PLAYER_CHOICE_CONTROL.seed);
    const { conditions, events, defaultSteps } = science.SCENARIOS[PLAYER_CHOICE_CONTROL.scenario]();
    const sim = new science.VugSimulator(conditions, events);
    const recorder = new science.StripRecorder(sim, {
      duration_steps: defaultSteps,
      notes: `controlled ${intervene ? 'Heat' : 'wait-only'} player-choice branch`,
    });
    sim._stripRecorder = recorder;
    const initialTemperature = Number(sim.conditions.temperature);
    if (intervene) {
      const after = Number(sim.setGlobalTemperature(
        initialTemperature + PLAYER_CHOICE_CONTROL.appliedDelta,
      ));
      sim._movements = science._createMovementController(sim);
      const authority = sim._movements.applyPlayerDelta(
        'temperature', 1, after - initialTemperature,
      );
      const receipt = science.movementPlayerInterventionReceipt(
        PLAYER_CHOICE_CONTROL.action, 'temperature', 0, 0,
        initialTemperature, after, authority,
      );
      if (!receipt) throw new Error('controlled player Heat choice was not accepted');
      sim._playerActionReceipts = [receipt];
    }
    for (let step = 0; step < defaultSteps; step++) sim.run_step();
    const dataset = recorder.finalize();
    return {
      initial_temperature_C: initialTemperature,
      final_temperature_C: Number(sim.conditions.temperature),
      player_actions: copy(dataset.player_action_testimony || []),
      crystal_summary: sim.crystals.map(crystal => ({
        mineral: String(crystal.mineral),
        total_growth_um: Number(crystal.total_growth_um),
        positive_layer_count: (crystal.zones || []).filter(zone => Number(zone.thickness_um) > 0).length,
      })),
      state_fingerprint: science.simulationStateFingerprint(sim),
    };
  };
  const waitOnly = run(false);
  const heated = run(true);
  return {
    role: 'controlled production GAME-02 branch; not a locality trajectory claim',
    scenario: PLAYER_CHOICE_CONTROL.scenario,
    seed: PLAYER_CHOICE_CONTROL.seed,
    authored_movement: copy(
      science.SCENARIOS[PLAYER_CHOICE_CONTROL.scenario]._json5_spec.movements[0],
    ),
    wait_only: waitOnly,
    heat_choice: heated,
    divergence: {
      final_temperature_delta_C: heated.final_temperature_C - waitOnly.final_temperature_C,
      crystal_summary_changed: canonicalJson(heated.crystal_summary) !== canonicalJson(waitOnly.crystal_summary),
      state_fingerprint_changed: heated.state_fingerprint !== waitOnly.state_fingerprint,
    },
  };
}

async function guidedTutorialInteractionProducts(science) {
  const topo = document.createElement('button');
  topo.id = 'topo-three-btn';
  const helix = document.createElement('button');
  helix.id = 'helix-overlay-btn';
  document.body.append(topo, helix);
  const viewerReceipts = [];
  const recordViewer = event => viewerReceipts.push(copy(event.detail));
  topo.addEventListener('vugg:tutorial-view-state-committed', recordViewer);
  helix.addEventListener('vugg:tutorial-view-state-committed', recordViewer);
  science.topoSetThreeRendererEnabled(false, false);
  science.helixSetOverlayEnabled(true, false);
  await science.startTutorial('tutorial_first_crystal');
  const commissioning = copy(science.tutorialViewerCommissioningReceipt());
  const bootState = copy(science.tutorialStateSnapshot());
  if (!commissioning) throw new Error('guided tutorial boot emitted no viewer commissioning receipt');
  science.topoSetThreeRendererEnabled(false, true);
  science.topoSetThreeRendererEnabled(true, true);
  science.helixSetOverlayEnabled(true, true);
  science.helixSetOverlayEnabled(false, true);
  topo.remove();
  helix.remove();
  science.fortressReset();

  const grid = document.createElement('div');
  grid.className = 'action-grid';
  document.body.appendChild(grid);
  const originalQuerySelector = document.querySelector;
  document.querySelector = selector => selector === '.action-grid'
    ? grid : originalQuerySelector.call(document, selector);
  const runCarbonateControl = partialFlood => {
    const products = [];
    const listener = event => products.push(copy(event.detail));
    grid.addEventListener('vugg:fortress-fluid-action-committed', listener);
    science.fortressBeginFromScenario('tutorial_travertine', 42);
    if (partialFlood) science.fortressStep('drain');
    const sim = science._liveFortressSim();
    const beforePH = Number(sim?.conditions?.fluid?.pH);
    const beforeSurfaceRing = Number(sim?.conditions?.fluid_surface_ring);
    const beforeTransactionCount = Array.isArray(sim?._carbonateBoundaryState?.transactions)
      ? sim._carbonateBoundaryState.transactions.length : 0;
    science.fortressStep('tweak_acidify');
    const afterPH = Number(sim?.conditions?.fluid?.pH);
    const transactions = Array.isArray(sim?._carbonateBoundaryState?.transactions)
      ? sim._carbonateBoundaryState.transactions : [];
    const last = transactions.length ? transactions[transactions.length - 1] : null;
    const result = {
      precursor: partialFlood ? 'drain-to-partial-fluid-scope' : 'fully-wet-authored-start',
      action: 'tweak_acidify',
      before_pH: beforePH,
      after_pH: afterPH,
      fluid_surface_ring: beforeSurfaceRing,
      transaction_count_before: beforeTransactionCount,
      transaction_count_after: transactions.length,
      last_transaction: last ? {
        kind: last.kind ?? null,
        ok: last.ok === true,
      } : null,
      emitted_products: products,
    };
    grid.removeEventListener('vugg:fortress-fluid-action-committed', listener);
    science.fortressReset();
    return result;
  };
  let rejected;
  let accepted;
  try {
    rejected = runCarbonateControl(true);
    accepted = runCarbonateControl(false);
  } finally {
    document.querySelector = originalQuerySelector;
    grid.remove();
    science.fortressReset();
  }
  return {
    source_authority: guidedTutorialProductSourceAuthority(ROOT),
    viewer_control: {
      boot_state: bootState,
      commissioning,
      emitted_products: viewerReceipts,
    },
    carbonate_titration_control: { rejected, accepted },
  };
}

async function guidedTutorialWitness(science) {
  const control = GUIDED_TUTORIAL_CONTROL;
  const sourceAuthority = guidedTutorialSourceAuthority(ROOT);
  const interactionProducts = await guidedTutorialInteractionProducts(science);
  science.setSeed(control.seed);
  const { conditions, events } = science.SCENARIOS[control.scenario]();
  if (conditions?.wall?.shape_seed !== sourceAuthority.resolved_cavity_authority.shape_seed
      || conditions?.wall?.vug_diameter_mm
        !== sourceAuthority.resolved_cavity_authority.vug_diameter_mm) {
    throw new Error('guided tutorial runtime cavity disagrees with authored source');
  }
  const sim = new science.VugSimulator(conditions, events);
  for (let step = 0; step < control.steps; step++) sim.run_step();
  const positiveCounts = {};
  for (const crystal of sim.crystals) {
    if (!(Number(crystal.total_growth_um) > 0)) continue;
    const mineral = String(crystal.mineral);
    positiveCounts[mineral] = Number(positiveCounts[mineral] || 0) + 1;
  }
  const tutorial = science.SCENARIOS[control.scenario]._json5_spec.tutorial;
  const collectionAction = tutorial.steps.find(step => step?.action?.selector === '.inv-collect-btn')?.action;
  if (!collectionAction) throw new Error('guided tutorial collection action is absent');
  const collectButton = ownerMineral => ({
    dataset: {},
    closest: selector => selector === '.inv-crystal'
      ? { dataset: { mineral: ownerMineral } }
      : null,
  });
  const acceptsTopaz = science._tutorialActionTargetMatches(
    collectionAction, collectButton('topaz'),
  );
  const rejectsQuartz = !science._tutorialActionTargetMatches(
    collectionAction, collectButton('quartz'),
  );

  const manifest = guidedStripControlManifest(ROOT, science.SIM_VERSION, science.MODEL_DIGEST);
  const dataset = guidedStripControlDataset(manifest);
  const key = `${manifest.scenario_id}@${manifest.seed}#${manifest.recorded_at}`;
  const datasetDigest = await science.stripDurableDatasetDigest(dataset);
  const receipt = science._stripDurableRunReceipt(key, manifest, datasetDigest);
  const exactRow = {
    dataset: {
      scenarioId: receipt.scenario_id,
      seed: String(receipt.seed),
      simVersion: String(receipt.sim_version),
      modelDigest: receipt.model_digest,
      scenarioSpecHash: receipt.scenario_spec_hash,
      storageKey: receipt.key,
      recordedAt: String(receipt.recorded_at),
      manifestDigestSha256: receipt.manifest_digest_sha256,
      datasetDigestSha256: receipt.dataset_digest_sha256,
    },
  };
  const staleRow = copy(exactRow);
  staleRow.dataset.storageKey += '-uploaded-old';
  const stripAction = science.SCENARIOS.tn457_barite_pulses._json5_spec.tutorial.steps
    .find(step => step?.action?.selector === '.strip-view-datasetrow')?.action;
  if (!stripAction) throw new Error('guided tutorial strip action is absent');
  return {
    role: 'controlled production GAME-03 guided-flow witness; browser workflow owns visible lifecycle',
    shigar_execution: {
      scenario: control.scenario,
      seed: control.seed,
      steps: control.steps,
      ...sourceAuthority,
      positive_crystal_counts: positiveCounts,
      topaz_present: Number(positiveCounts.topaz || 0) > 0,
      beryl_absent: Number(positiveCounts.beryl || 0) === 0,
    },
    interaction_products: interactionProducts,
    collection_target: {
      event: collectionAction.event,
      selector: collectionAction.selector,
      owner_mineral: collectionAction.within?.dataset?.mineral || null,
      accepts_executed_topaz: acceptsTopaz,
      rejects_wrong_quartz: rejectsQuartz,
    },
    strip_target: {
      event: stripAction.event,
      selector: stripAction.selector,
      latest_stored_strip_required: stripAction.latestStoredStrip === true,
      exact_current_receipt_accepted: science._tutorialStripReceiptMatches(exactRow, receipt),
      stale_or_uploaded_row_rejected: !science._tutorialStripReceiptMatches(staleRow, receipt),
      production_run_can_commission_latest: science.stripStorageOriginEligible('production-run'),
      imported_file_cannot_commission_latest: !science.stripStorageOriginEligible('imported-file'),
      receipt: copy(receipt),
    },
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
  const choice = artifact.payload?.player_movement_choice;
  const movement = choice?.authored_movement;
  const waitOnly = choice?.wait_only;
  const heated = choice?.heat_choice;
  const action = heated?.player_actions?.[0];
  if (choice?.role !== 'controlled production GAME-02 branch; not a locality trajectory claim'
      || choice?.scenario !== PLAYER_CHOICE_CONTROL.scenario
      || choice?.seed !== PLAYER_CHOICE_CONTROL.seed
      || !exactKeys(movement, ['field', 'startStep', 'endStep', 'base', 'ops'])
      || movement.field !== 'temperature' || movement.startStep !== 0
      || movement.endStep !== 100 || movement.base !== 180
      || !Array.isArray(waitOnly?.player_actions) || waitOnly.player_actions.length !== 0
      || !Array.isArray(heated?.player_actions) || heated.player_actions.length !== 1
      || !exactKeys(action, [
        'schema', 'action', 'field', 'accepted_at_step', 'action_cursor',
        'first_geology_step', 'value_before', 'value_after', 'applied_delta',
        'fluid_spatial_authority', 'movement_authority', 'sample_index',
      ])
      || action?.schema !== 'player-movement-intervention-v1'
      || action?.action !== PLAYER_CHOICE_CONTROL.action || action?.field !== 'temperature'
      || action?.accepted_at_step !== 0 || action?.first_geology_step !== 1
      || action?.action_cursor !== 0 || action?.sample_index !== 0
      || action?.fluid_spatial_authority !== null
      || action?.value_before !== 180 || action?.value_after !== 205
      || action?.applied_delta !== PLAYER_CHOICE_CONTROL.appliedDelta
      || !exactKeys(action?.movement_authority, [
        'schema', 'movement_index', 'movement_source', 'field', 'first_geology_step',
        'applied_delta', 'offset_before', 'offset_after', 'offset_application',
      ])
      || action?.movement_authority?.schema !== 'movement-player-offset-v2'
      || action?.movement_authority?.movement_source !== 'authored-scenario'
      || action?.movement_authority?.offset_application !== 'after-authored-texture-and-clamp'
      || action?.movement_authority?.movement_index !== 0
      || action?.movement_authority?.offset_before !== 0
      || action?.movement_authority?.offset_after !== PLAYER_CHOICE_CONTROL.appliedDelta
      || !finiteClose(
        heated?.final_temperature_C - waitOnly?.final_temperature_C,
        PLAYER_CHOICE_CONTROL.appliedDelta,
      )
      || !finiteClose(
        choice?.divergence?.final_temperature_delta_C,
        PLAYER_CHOICE_CONTROL.appliedDelta,
      )
      || choice?.divergence?.crystal_summary_changed !== true
      || choice?.divergence?.state_fingerprint_changed !== true
      || typeof waitOnly?.state_fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(waitOnly.state_fingerprint)
      || typeof heated?.state_fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(heated.state_fingerprint)
      || waitOnly.state_fingerprint === heated.state_fingerprint
      || !Array.isArray(waitOnly?.crystal_summary) || waitOnly.crystal_summary.length === 0
      || !waitOnly.crystal_summary.every(row => row?.mineral === 'quartz'
        && Number(row.total_growth_um) > 0 && Number.isSafeInteger(row.positive_layer_count)
        && row.positive_layer_count > 0)
      || !Array.isArray(heated?.crystal_summary) || heated.crystal_summary.length !== 0) {
    throw new Error('player movement-choice witness does not prove a receipted divergent geology branch');
  }
  const guided = artifact.payload?.guided_tutorial;
  const sourceAuthority = guidedTutorialSourceAuthority(root);
  const productSourceAuthority = guidedTutorialProductSourceAuthority(root);
  const interaction = guided?.interaction_products;
  const viewer = interaction?.viewer_control;
  const carbonate = interaction?.carbonate_titration_control;
  const viewerReceiptKeys = [
    'schema', 'control', 'before_enabled', 'after_enabled',
  ];
  const expectedViewerReceipts = productSourceAuthority.viewer_products.map(row => ({
    schema: 'tutorial-view-state-product-v1',
    control: row.control,
    before_enabled: row.beforeEnabled,
    after_enabled: row.afterEnabled,
  }));
  if (!exactKeys(interaction, [
    'source_authority', 'viewer_control', 'carbonate_titration_control',
  ])
      || canonicalJson(interaction.source_authority) !== canonicalJson(productSourceAuthority)
      || !exactKeys(viewer, ['boot_state', 'commissioning', 'emitted_products'])
      || !exactKeys(viewer.boot_state, [
        'mode', 'step_index', 'step_count', 'rendered_index', 'paused_at', 'current_trigger',
      ])
      || viewer.boot_state.mode !== 'fortress'
      || viewer.boot_state.step_index !== 0
      || !Number.isSafeInteger(viewer.boot_state.step_count) || viewer.boot_state.step_count <= 0
      || viewer.boot_state.rendered_index !== 0
      || viewer.boot_state.current_trigger !== 'continue'
      || !exactKeys(viewer.commissioning, ['schema', 'before', 'after'])
      || viewer.commissioning.schema !== 'tutorial-viewer-commissioning-v1'
      || canonicalJson(viewer.commissioning.before) !== canonicalJson({
        topo_three_renderer_enabled: false, helix_overlay_enabled: true,
      })
      || canonicalJson(viewer.commissioning.after) !== canonicalJson({
        topo_three_renderer_enabled: true, helix_overlay_enabled: false,
      })
      || !Array.isArray(viewer.emitted_products)
      || viewer.emitted_products.length !== expectedViewerReceipts.length
      || !viewer.emitted_products.every(row => exactKeys(row, viewerReceiptKeys))
      || canonicalJson(viewer.emitted_products) !== canonicalJson(expectedViewerReceipts)
      || !exactKeys(carbonate, ['rejected', 'accepted'])) {
    throw new Error('guided tutorial witness does not prove executed viewer products');
  }
  const rejected = carbonate.rejected;
  const accepted = carbonate.accepted;
  const carbonateControlKeys = [
    'precursor', 'action', 'before_pH', 'after_pH', 'fluid_surface_ring',
    'transaction_count_before', 'transaction_count_after',
    'last_transaction', 'emitted_products',
  ];
  const acidReceiptKeys = [
    'schema', 'product', 'action', 'accepted_at_step', 'before_pH', 'after_pH',
    'spatial_authority_schema', 'spatial_authority_scope',
    'spatial_authority_count', 'spatial_authority_closed',
    'carbonate_transaction_kind', 'carbonate_transaction_index',
    'carbonate_transactions_before_action', 'carbonate_preparation_transfer_count',
  ];
  const acidReceipt = Array.isArray(accepted?.emitted_products)
    && accepted.emitted_products.length === 1 ? accepted.emitted_products[0] : null;
  if (!exactKeys(rejected, carbonateControlKeys)
      || rejected.precursor !== 'drain-to-partial-fluid-scope'
      || rejected.action !== 'tweak_acidify'
      || !finiteClose(rejected.before_pH, 6.5)
      || !finiteClose(rejected.before_pH, rejected.after_pH)
      || rejected.fluid_surface_ring !== 14
      || !Array.isArray(rejected.emitted_products) || rejected.emitted_products.length !== 0
      || !Number.isSafeInteger(rejected.transaction_count_before)
      || !Number.isSafeInteger(rejected.transaction_count_after)
      || rejected.transaction_count_after !== rejected.transaction_count_before + 1
      || !exactKeys(rejected.last_transaction, ['kind', 'ok'])
      || rejected.last_transaction.kind !== 'spatial_boundary_unsupported'
      || rejected.last_transaction.ok !== false
      || !exactKeys(accepted, carbonateControlKeys)
      || accepted.precursor !== 'fully-wet-authored-start'
      || accepted.action !== 'tweak_acidify'
      || !finiteClose(accepted.before_pH, 6.5)
      || !finiteClose(accepted.after_pH, 6.2)
      || !finiteClose(accepted.before_pH, acidReceipt?.before_pH)
      || !finiteClose(accepted.after_pH, acidReceipt?.after_pH)
      || !(accepted.after_pH < accepted.before_pH)
      || accepted.fluid_surface_ring !== 0
      || !Number.isSafeInteger(accepted.transaction_count_before)
      || !Number.isSafeInteger(accepted.transaction_count_after)
      || accepted.transaction_count_after !== accepted.transaction_count_before + 1
      || !exactKeys(accepted.last_transaction, ['kind', 'ok'])
      || accepted.last_transaction.kind !== 'ph_titration'
      || accepted.last_transaction.ok !== true
      || !exactKeys(acidReceipt, acidReceiptKeys)
      || acidReceipt.schema !== 'fortress-fluid-action-product-v1'
      || acidReceipt.product !== 'carbonate-acid-titration'
      || acidReceipt.action !== 'tweak_acidify'
      || acidReceipt.accepted_at_step !== 0
      || acidReceipt.spatial_authority_schema !== 'player-fluid-spatial-intervention-v1'
      || acidReceipt.spatial_authority_scope !== 'canonical-nonvadose-voxel-volume'
      || acidReceipt.spatial_authority_count !== 7680
      || acidReceipt.spatial_authority_closed !== true
      || acidReceipt.carbonate_transaction_kind !== 'ph_titration'
      || acidReceipt.carbonate_transactions_before_action !== accepted.transaction_count_before
      || acidReceipt.carbonate_preparation_transfer_count !== 0
      || acidReceipt.carbonate_transaction_index
        !== acidReceipt.carbonate_transactions_before_action
          + acidReceipt.carbonate_preparation_transfer_count) {
    throw new Error('guided tutorial witness does not prove accepted/rejected carbonate products');
  }
  const expectedGuided = {
    role: 'controlled production GAME-03 guided-flow witness; browser workflow owns visible lifecycle',
    shigar_execution: {
      scenario: GUIDED_TUTORIAL_CONTROL.scenario,
      seed: GUIDED_TUTORIAL_CONTROL.seed,
      steps: GUIDED_TUTORIAL_CONTROL.steps,
      ...sourceAuthority,
      positive_crystal_counts: GUIDED_TUTORIAL_CONTROL.expectedPositiveMinerals,
      topaz_present: true,
      beryl_absent: true,
    },
    interaction_products: interaction,
    collection_target: {
        event: 'vugg:crystal-collected', selector: '.inv-collect-btn',
        owner_mineral: 'topaz', accepts_executed_topaz: true,
        rejects_wrong_quartz: true,
    },
    strip_target: {
      event: 'vugg:strip-opened', selector: '.strip-view-datasetrow',
      latest_stored_strip_required: true,
      exact_current_receipt_accepted: true,
      stale_or_uploaded_row_rejected: true,
      production_run_can_commission_latest: true,
      imported_file_cannot_commission_latest: true,
      receipt: guidedStripControlReceipt(root, artifact.sim_version, artifact.model_digest),
    },
  };
  if (canonicalJson(guided) !== canonicalJson(expectedGuided)) {
    throw new Error('guided tutorial witness does not prove exact successful product targets');
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
      '_createMovementController', 'movementPlayerInterventionReceipt',
      'simulationStateFingerprint', 'scenarioSpecHash',
      '_tutorialActionTargetMatches', '_tutorialStripReceiptMatches',
      '_tutorialCanonicalizeViewerState', 'tutorialViewerCommissioningReceipt',
      'tutorialStateSnapshot', 'startTutorial',
      'topoSetThreeRendererEnabled', 'helixSetOverlayEnabled',
      'fortressBeginFromScenario', 'fortressStep', 'fortressReset', '_liveFortressSim',
      '_stripDurableRunReceipt', 'stripDurableDatasetDigest',
      'stripStorageOriginEligible',
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
    player_movement_choice: playerMovementChoiceWitness(science),
    guided_tutorial: await guidedTutorialWitness(science),
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
    console.log(`[mechanism-witnesses] PASS: ${artifact.payload.transformation_reactivity.length} transformation + ${artifact.payload.chalcanthite_water_solubility.trigger_controls.length + 1} chalcanthite + 1 player-choice control`);
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
