import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSimBundle } from './_harness.mjs';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(ROOT, 'data', 'scenarios.json5');
const MINERALS_PATH = path.join(ROOT, 'data', 'minerals.json');
export const SCENARIO_AUTHORING_SCHEMA = 'vugg-scenario-authoring-preview-v1';
export const SCENARIO_AUTHORING_RECEIPT_SCHEMA = 'vugg-scenario-authoring-receipt-v1';
export const DEFAULT_AUTHORING_SEED = 42;

const AUTHORING_FLUID_NUMERIC_FIELDS = Object.freeze([
  'SiO2', 'reactiveSilicaFraction', 'Ca', 'CO3', 'F', 'Zn', 'S', 'Fe', 'Mn', 'Al', 'Ti', 'Pb', 'U',
  'Cu', 'Mo', 'K', 'Na', 'Mg', 'Ba', 'Sr', 'Cr', 'P', 'As', 'Cl', 'V', 'W',
  'Ag', 'Bi', 'Sb', 'Ni', 'Co', 'B', 'Li', 'Be', 'Te', 'Se', 'Ge', 'Au',
  'Cd', 'Hg', 'Sn', 'Y', 'O2', 'Eh', 'pH', 'salinity', 'concentration',
  'S_sulfide', 'S_sulfate', 'S_elemental',
]);
const AUTHORING_FLUID_BOOLEAN_FIELDS = Object.freeze(['sulfateInherited', 'sulfurPoolsExplicit']);
const AUTHORING_FLUID_ENUMS = Object.freeze({
  nativeSulfurPathway: Object.freeze([
    null,
    'oxidative_interface',
    'oxidative_closed_fluid',
    'anaerobic_microbial_inherited',
  ]),
});
export const SCENARIO_AUTHORING_FLUID_FIELDS = Object.freeze([
  ...AUTHORING_FLUID_NUMERIC_FIELDS,
  ...AUTHORING_FLUID_BOOLEAN_FIELDS,
  ...Object.keys(AUTHORING_FLUID_ENUMS),
]);
const AUTHORING_FLUID_FIELD_SET = new Set(SCENARIO_AUTHORING_FLUID_FIELDS);
const AUTHORING_FLUID_SPECIAL_NUMERIC_FIELDS = new Set([
  'reactiveSilicaFraction', 'Eh', 'pH', 'salinity', 'concentration',
]);

export function parseScenarioDocument(text) {
  return JSON.parse(String(text)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1'));
}

function mineralName(entry) {
  return typeof entry === 'string' ? entry : entry?.mineral;
}

export function validateScenarioDocument(doc, mineralSpec) {
  const errors = [];
  const scenarios = doc?.scenarios;
  if (doc?.$schema_version !== '1.0.0') errors.push('root $schema_version must be 1.0.0');
  if (!scenarios || typeof scenarios !== 'object' || Array.isArray(scenarios)) {
    return ['root scenarios must be an object'];
  }
  const knownMinerals = new Set(Object.keys(mineralSpec || {}));
  for (const [id, spec] of Object.entries(scenarios)) {
    const at = message => errors.push(`${id}: ${message}`);
    if (!/^[a-z0-9_]+$/.test(id)) at('id must use lowercase snake_case');
    if (typeof spec.anchor !== 'string' || !spec.anchor.trim()) at('anchor is required');
    if (typeof spec.description !== 'string' || !spec.description.trim()) at('description is required');
    if (!Number.isSafeInteger(spec.duration_steps) || spec.duration_steps <= 0) at('duration_steps must be a positive safe integer');
    if (!Array.isArray(spec.notes) || !spec.notes.length
        || spec.notes.some(note => typeof note !== 'string' || !note.trim())) {
      at('notes must be a nonempty array of nonempty strings');
    }
    if (!Array.isArray(spec.sources) || !spec.sources.length
        || spec.sources.some(source => typeof source !== 'string' || !source.trim())) {
      at('sources must be a nonempty array of nonempty citations');
    }
    const initial = spec.initial;
    if (!initial || typeof initial !== 'object') {
      at('initial is required');
      continue;
    }
    if (!Number.isFinite(initial.temperature_C)) at('initial.temperature_C must be finite');
    if (!Number.isFinite(initial.pressure_kbar) || initial.pressure_kbar < 0.001 || initial.pressure_kbar > 4.4) {
      at('initial.pressure_kbar must stay inside the commissioned 0.001..4.4 kbar grid');
    }
    if (!initial.fluid || typeof initial.fluid !== 'object' || Array.isArray(initial.fluid)) {
      at('initial.fluid must be an object');
    } else {
      const fluid = initial.fluid;
      const unknown = Object.keys(fluid).filter(key => !AUTHORING_FLUID_FIELD_SET.has(key));
      if (unknown.length) at(`initial.fluid contains unknown field(s): ${unknown.join(', ')}`);
      for (const field of AUTHORING_FLUID_NUMERIC_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(fluid, field)) continue;
        const value = fluid[field];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          at(`initial.fluid.${field} must be a finite number`);
        } else if (!AUTHORING_FLUID_SPECIAL_NUMERIC_FIELDS.has(field) && value < 0) {
          at(`initial.fluid.${field} must be non-negative`);
        }
      }
      if (fluid.pH != null && (!Number.isFinite(fluid.pH) || fluid.pH < 0 || fluid.pH > 14)) {
        at('initial.fluid.pH must be finite within 0..14');
      }
      if (fluid.salinity != null
          && (!Number.isFinite(fluid.salinity) || fluid.salinity < 0 || fluid.salinity > 350)) {
        at('initial.fluid.salinity must be finite within 0..350 permille');
      }
      if (fluid.reactiveSilicaFraction != null
          && (!Number.isFinite(fluid.reactiveSilicaFraction)
            || fluid.reactiveSilicaFraction < 0 || fluid.reactiveSilicaFraction > 1)) {
        at('initial.fluid.reactiveSilicaFraction must be finite within 0..1');
      }
      if (fluid.Eh != null && (!Number.isFinite(fluid.Eh) || fluid.Eh < -2000 || fluid.Eh > 2000)) {
        at('initial.fluid.Eh must be finite within -2000..2000 mV');
      }
      if (fluid.concentration != null
          && (!Number.isFinite(fluid.concentration) || fluid.concentration <= 0)) {
        at('initial.fluid.concentration must be finite and positive');
      }
      for (const field of AUTHORING_FLUID_BOOLEAN_FIELDS) {
        if (fluid[field] != null && typeof fluid[field] !== 'boolean') {
          at(`initial.fluid.${field} must be boolean`);
        }
      }
      for (const [field, allowed] of Object.entries(AUTHORING_FLUID_ENUMS)) {
        if (Object.prototype.hasOwnProperty.call(fluid, field) && !allowed.includes(fluid[field])) {
          at(`initial.fluid.${field} has an unsupported value`);
        }
      }
      if (fluid.sulfurPoolsExplicit === true) {
        for (const field of ['S_sulfide', 'S_sulfate', 'S_elemental']) {
          if (!Number.isFinite(fluid[field]) || fluid[field] < 0) {
            at(`initial.fluid.${field} is required and non-negative for explicit sulfur pools`);
          }
        }
        if (!Number.isFinite(fluid.S)
            || Math.abs(fluid.S - (fluid.S_sulfide + fluid.S_sulfate)) > 1e-9) {
          at('initial.fluid.S must equal S_sulfide + S_sulfate for explicit sulfur pools');
        }
      }
    }
    const wall = initial.wall;
    if (!wall || typeof wall !== 'object' || Array.isArray(wall)) at('initial.wall must be an object');
    else {
      if (typeof wall.composition !== 'string' || !wall.composition.trim()) at('initial.wall.composition is required');
      if (!Number.isSafeInteger(wall.shape_seed)) at('initial.wall.shape_seed must be explicitly authored as a safe integer');
    }
    if (!Array.isArray(spec.events)) at('events must be an array');
    else {
      let priorStep = -1;
      for (const [index, event] of spec.events.entries()) {
        if (!event || typeof event !== 'object') { at(`events[${index}] must be an object`); continue; }
        if (!Number.isSafeInteger(event.step) || event.step < 0) {
          at(`events[${index}].step must be a non-negative safe integer`);
        }
        if (event.step > spec.duration_steps && event.extended_only !== true) {
          at(`events[${index}] is past duration_steps without extended_only:true`);
        }
        if (event.step < priorStep) at(`events[${index}] is out of chronological order`);
        priorStep = event.step;
        if (typeof event.type !== 'string' || !event.type) at(`events[${index}].type is required`);
        if (typeof event.name !== 'string' || !event.name) at(`events[${index}].name is required`);
      }
    }
    const positiveTiers = ['expects_species', 'deterministic_species', 'statistical_species', 'aspirational_species'];
    const claimed = new Map();
    for (const tier of positiveTiers) {
      const entries = spec[tier] || [];
      if (!Array.isArray(entries)) { at(`${tier} must be an array`); continue; }
      for (const [index, entry] of entries.entries()) {
        const name = mineralName(entry);
        if (typeof name !== 'string' || !knownMinerals.has(name)) at(`${tier}[${index}] names an unknown mineral`);
        if (tier !== 'expects_species' && (typeof entry?.reason !== 'string' || !entry.reason.trim())) {
          at(`${tier}[${index}] requires a scientific reason`);
        }
        if (claimed.has(name)) at(`${name} appears in both ${claimed.get(name)} and ${tier}`);
        else claimed.set(name, tier);
      }
    }
    const exclusions = spec.excluded_species || {};
    if (typeof exclusions !== 'object' || Array.isArray(exclusions)) at('excluded_species must be an object');
    else {
      for (const name of Object.keys(exclusions)) {
        if (!knownMinerals.has(name)) at(`excluded_species names unknown mineral ${name}`);
        if (claimed.has(name)) at(`${name} is both positively claimed and excluded`);
        if (typeof exclusions[name] !== 'string' || !exclusions[name].trim()) {
          at(`excluded_species.${name} requires a nonempty scientific reason`);
        }
      }
    }
  }

  const scenarioIds = new Set(Object.keys(scenarios));
  const layout = doc.menu_layout || {};
  const visitLayout = value => {
    if (Array.isArray(value)) return value.forEach(visitLayout);
    if (!value || typeof value !== 'object') return;
    if (typeof value.scenario === 'string' && !scenarioIds.has(value.scenario)) {
      errors.push(`menu_layout references unknown scenario ${value.scenario}`);
    }
    for (const child of Object.values(value)) visitLayout(child);
  };
  visitLayout(layout);
  return errors;
}

function rounded(value, digits = 9) {
  return Number.isFinite(value) ? +Number(value).toFixed(digits) : null;
}

function numericFluid(fluid) {
  return Object.fromEntries(Object.keys(fluid || {})
    .filter(key => typeof fluid[key] === 'number' && Number.isFinite(fluid[key]))
    .sort()
    .map(key => [key, rounded(fluid[key])]));
}

function crystalSummary(crystals) {
  const alive = (crystals || []).filter(crystal => !crystal.dissolved && Number(crystal.size) > 0);
  const counts = {};
  for (const crystal of alive) counts[crystal.mineral] = (counts[crystal.mineral] || 0) + 1;
  const biggest = alive.slice().sort((a, b) => Number(b.size) - Number(a.size))[0] || null;
  return {
    active_count: alive.length,
    mineral_counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    biggest: biggest ? { mineral: biggest.mineral, size_um: rounded(biggest.size, 6) } : null,
  };
}

function stepSnapshot(sim) {
  return {
    step: sim.step,
    temperature_C: rounded(sim.conditions.temperature, 6),
    pressure_kbar: rounded(sim.conditions.pressure, 9),
    pH: rounded(sim.conditions.fluid.pH, 6),
    flow_rate: rounded(sim.conditions.flow_rate, 6),
    fluid_surface_height_mm: rounded(sim.conditions.fluid_surface_height_mm, 6),
    crystals: crystalSummary(sim.crystals),
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function trustedAuthoredScenario(bundle, scenarioId) {
  const make = bundle.SCENARIOS[scenarioId];
  if (!make) throw new Error(`unknown scenario: ${scenarioId}`);
  const document = parseScenarioDocument(fs.readFileSync(SPEC_PATH, 'utf8'));
  const authored = document?.scenarios?.[scenarioId];
  if (!authored) throw new Error(`scenario source is missing: ${scenarioId}`);
  const sourceJson = JSON.stringify(authored);
  const sourceHash = sha256(sourceJson);
  if (JSON.stringify(make._json5_spec) !== sourceJson || make._scenario_spec_hash !== sourceHash) {
    throw new Error(`${scenarioId}: runtime scenario authority differs from data/scenarios.json5`);
  }
  // A fresh parse is the independent authority. Nothing returned to the caller
  // aliases the mutable runtime factory metadata used to construct the sim.
  return authored;
}

function scenarioPreviewPayloadProjection(preview) {
  return {
    schema: preview.schema,
    identity: preview.identity,
    authored_claims: preview.authored_claims,
    initial_fluid: preview.initial_fluid,
    trajectory: preview.trajectory,
    final_state_sha256: preview.final_state_sha256,
  };
}

function scenarioPreviewReceiptProjection(receipt) {
  return {
    schema: receipt.schema,
    payload_sha256: receipt.payload_sha256,
    browser_bundle_sha256: receipt.browser_bundle_sha256,
    runtime_execution_sha256: receipt.runtime_execution_sha256,
    producer_contract_sha256: receipt.producer_contract_sha256,
    node_runtime: receipt.node_runtime,
    node_runtime_sha256: receipt.node_runtime_sha256,
  };
}

export function scenarioPreviewPayloadDigest(preview) {
  return sha256(JSON.stringify(scenarioPreviewPayloadProjection(preview)));
}

export function scenarioPreviewReceiptDigest(receipt) {
  return sha256(JSON.stringify(scenarioPreviewReceiptProjection(receipt)));
}

export async function assertScenarioPreviewReceipt(preview, { requireCurrent = true } = {}) {
  const payloadKeys = ['authored_claims', 'final_state_sha256', 'identity', 'initial_fluid', 'receipt', 'schema', 'trajectory'];
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)
      || JSON.stringify(Object.keys(preview).sort()) !== JSON.stringify(payloadKeys.sort())) {
    throw new Error('scenario preview has missing or unknown payload fields');
  }
  const receipt = preview.receipt;
  const receiptKeys = [
    'browser_bundle_sha256', 'node_runtime', 'node_runtime_sha256', 'payload_sha256',
    'producer_contract_sha256', 'receipt_sha256', 'runtime_execution_sha256', 'schema',
  ];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)
      || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(receiptKeys.sort())
      || receipt.schema !== SCENARIO_AUTHORING_RECEIPT_SCHEMA) {
    throw new Error('scenario preview receipt has an invalid schema');
  }
  const payloadSha = scenarioPreviewPayloadDigest(preview);
  if (receipt.payload_sha256 !== payloadSha) throw new Error('scenario preview payload digest mismatch');
  if (receipt.node_runtime_sha256 !== sha256(JSON.stringify(receipt.node_runtime))) {
    throw new Error('scenario preview Node runtime digest mismatch');
  }
  if (receipt.receipt_sha256 !== scenarioPreviewReceiptDigest(receipt)) {
    throw new Error('scenario preview provenance receipt digest mismatch');
  }
  if (requireCurrent) {
    const bundle = await loadSimBundle({
      toolName: 'scenario-authoring-verifier',
      extraExports: ['simulationStateFingerprint', 'FLUID_CHEMISTRY_INPUT_FIELDS'],
    });
    const make = bundle.SCENARIOS[preview.identity?.scenario];
    if (!make
        || preview.identity.sim_version !== bundle.SIM_VERSION
        || preview.identity.model_digest_sha256 !== sha256(bundle.MODEL_DIGEST)
        || preview.identity.scenario_spec_sha256 !== make._scenario_spec_hash) {
      throw new Error('scenario preview simulation identity is not current');
    }
    const current = {
      browser_bundle_sha256: browserBundleDigest(ROOT),
      runtime_execution_sha256: runtimeExecutionDigest(ROOT),
      producer_contract_sha256: producerContractDigest(ROOT, 'scenario-authoring'),
      node_runtime_sha256: nodeRuntimeDigest(),
    };
    for (const [field, expected] of Object.entries(current)) {
      if (receipt[field] !== expected) throw new Error(`scenario preview ${field} is not current`);
    }
    if (JSON.stringify(receipt.node_runtime) !== JSON.stringify(nodeRuntimeIdentity())) {
      throw new Error('scenario preview Node runtime identity is not current');
    }
    const runtimeFluidFields = bundle.FLUID_CHEMISTRY_INPUT_FIELDS;
    if (!(runtimeFluidFields instanceof Set)
        || JSON.stringify([...runtimeFluidFields].sort()) !== JSON.stringify([...SCENARIO_AUTHORING_FLUID_FIELDS].sort())) {
      throw new Error('scenario authoring fluid schema differs from the runtime constructor schema');
    }
    const replayedPayload = buildScenarioPreviewPayload(bundle, {
      scenarioId: preview.identity.scenario,
      seed: preview.identity.seed,
      steps: preview.identity.requested_steps,
    });
    if (JSON.stringify(scenarioPreviewPayloadProjection(preview)) !== JSON.stringify(replayedPayload)) {
      throw new Error('scenario preview scientific payload does not match deterministic current-scenario replay');
    }
  }
  return true;
}

function buildScenarioPreviewPayload(bundle, { scenarioId, seed = DEFAULT_AUTHORING_SEED, steps = null } = {}) {
  if (typeof bundle.simulationStateFingerprint !== 'function') {
    throw new Error('simulationStateFingerprint is unavailable; preview cannot authenticate final state');
  }
  const make = bundle.SCENARIOS[scenarioId];
  const authored = trustedAuthoredScenario(bundle, scenarioId);
  const requestedSteps = steps == null ? Math.min(authored.duration_steps, 12) : Number(steps);
  if (!Number.isSafeInteger(requestedSteps) || requestedSteps < 0 || requestedSteps > authored.duration_steps) {
    throw new Error(`steps must be an integer within 0..${authored.duration_steps}`);
  }
  if (!Number.isSafeInteger(seed) || seed < -2147483648 || seed > 2147483647) {
    throw new Error('seed must be an exact signed 32-bit integer');
  }
  bundle.setSeed(seed);
  const { conditions, events, defaultSteps } = make();
  const sim = new bundle.VugSimulator(conditions, events);
  const initialFluid = numericFluid(sim.conditions.fluid);
  const trajectory = [stepSnapshot(sim)];
  for (let index = 0; index < requestedSteps; index++) {
    sim.run_step();
    trajectory.push(stepSnapshot(sim));
  }
  const modelSha = sha256(bundle.MODEL_DIGEST);
  return {
    schema: SCENARIO_AUTHORING_SCHEMA,
    identity: {
      sim_version: bundle.SIM_VERSION,
      model_digest_sha256: modelSha,
      scenario: scenarioId,
      scenario_spec_sha256: make._scenario_spec_hash,
      seed,
      shape_seed: authored.initial.wall.shape_seed,
      requested_steps: requestedSteps,
      authored_duration_steps: defaultSteps,
      truncated_preview: requestedSteps < defaultSteps,
    },
    authored_claims: {
      expects_species: structuredClone(authored.expects_species || []),
      deterministic_species: structuredClone(authored.deterministic_species || []),
      statistical_species: structuredClone(authored.statistical_species || []),
      aspirational_species: structuredClone(authored.aspirational_species || []),
      excluded_species: structuredClone(authored.excluded_species || {}),
    },
    initial_fluid: initialFluid,
    trajectory,
    final_state_sha256: bundle.simulationStateFingerprint(sim),
  };
}

export async function buildScenarioPreview({ scenarioId, seed = DEFAULT_AUTHORING_SEED, steps = null } = {}) {
  const bundle = await loadSimBundle({
    toolName: 'scenario-authoring',
    extraExports: ['simulationStateFingerprint', 'FLUID_CHEMISTRY_INPUT_FIELDS'],
  });
  const payload = buildScenarioPreviewPayload(bundle, { scenarioId, seed, steps });
  const payloadSha = scenarioPreviewPayloadDigest(payload);
  const preview = {
    ...payload,
    receipt: {
      schema: SCENARIO_AUTHORING_RECEIPT_SCHEMA,
      payload_sha256: payloadSha,
      browser_bundle_sha256: browserBundleDigest(ROOT),
      runtime_execution_sha256: runtimeExecutionDigest(ROOT),
      producer_contract_sha256: producerContractDigest(ROOT, 'scenario-authoring'),
      node_runtime: nodeRuntimeIdentity(),
      node_runtime_sha256: nodeRuntimeDigest(),
    },
  };
  preview.receipt.receipt_sha256 = scenarioPreviewReceiptDigest(preview.receipt);
  await assertScenarioPreviewReceipt(preview);
  return preview;
}

function parseArgs(argv) {
  const args = { check: false, preview: null, seed: DEFAULT_AUTHORING_SEED, steps: null, out: null };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--check') args.check = true;
    else if (arg === '--preview') args.preview = argv[++index];
    else if (arg === '--seed') args.seed = Number(argv[++index]);
    else if (arg === '--steps') args.steps = Number(argv[++index]);
    else if (arg === '--out') args.out = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.check && !args.preview) args.check = true;
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const doc = parseScenarioDocument(fs.readFileSync(SPEC_PATH, 'utf8'));
  const mineralsDoc = JSON.parse(fs.readFileSync(MINERALS_PATH, 'utf8'));
  const mineralSpec = mineralsDoc.minerals || mineralsDoc;
  const errors = validateScenarioDocument(doc, mineralSpec);
  if (errors.length) throw new Error(`scenario validation failed:\n- ${errors.join('\n- ')}`);
  const bundle = await loadSimBundle({
    toolName: 'scenario-authoring-check',
    extraExports: ['simulationStateFingerprint', 'FLUID_CHEMISTRY_INPUT_FIELDS'],
  });
  if (!(bundle.FLUID_CHEMISTRY_INPUT_FIELDS instanceof Set)
      || JSON.stringify([...bundle.FLUID_CHEMISTRY_INPUT_FIELDS].sort())
        !== JSON.stringify([...SCENARIO_AUTHORING_FLUID_FIELDS].sort())) {
    throw new Error('scenario authoring fluid schema differs from the runtime constructor schema');
  }
  const authoredIds = Object.keys(doc.scenarios).sort();
  const runtimeIds = Object.keys(bundle.SCENARIOS).sort();
  if (JSON.stringify(authoredIds) !== JSON.stringify(runtimeIds)) {
    throw new Error('runtime scenario registry does not match data/scenarios.json5');
  }
  for (const id of authoredIds) {
    if (bundle.SCENARIOS[id]._json5_spec !== doc.scenarios[id]
        && JSON.stringify(bundle.SCENARIOS[id]._json5_spec) !== JSON.stringify(doc.scenarios[id])) {
      throw new Error(`${id}: runtime authored spec differs from parsed source`);
    }
  }
  console.error(`[scenario-authoring] PASS: ${authoredIds.length} scenarios; runtime registry, schema, menu references, claims, pressure, event order, and shape_seed are valid`);
  if (!args.preview) return;
  const preview = await buildScenarioPreview({ scenarioId: args.preview, seed: args.seed, steps: args.steps });
  const json = `${JSON.stringify(preview, null, 2)}\n`;
  if (args.out) {
    const output = path.resolve(ROOT, args.out);
    const relative = path.relative(ROOT, output);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('--out must stay inside the repository');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json, 'utf8');
    console.error(`[scenario-authoring] wrote ${relative.replaceAll('\\', '/')}`);
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
