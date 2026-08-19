#!/usr/bin/env node
/**
 * Generate the deterministic science/provenance contract for the shipped fleet.
 *
 * This is intentionally a failing generator, not a passive report.  A scenario
 * cannot enter the manifest if its citations are absent, its core authored state
 * lies outside the declared model envelope, an event handler is unregistered, or
 * its runtime/archive metadata no longer matches the JSON5 source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import {
  LOCALITY_FREQUENCY_SEEDS,
  localityFrequencySpecHash,
  validateFrequencyScenarioReceipt,
} from './locality-frequency-contract.mjs';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';
import {
  SCIENCE_EVIDENCE_PRODUCERS,
  SCIENCE_EVIDENCE_RECEIPT_SCHEMA,
  verifyArtifactHashMap,
} from './science-evidence-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes('--check');
const OUT_PATH = path.join(ROOT, 'data', 'generated', 'science-provenance-manifest.json');

const SUPPORT = Object.freeze({
  temperature_C: { min: -50, max: 1300, basis: 'declared browser-engine operating envelope' },
  fluid_pressure_kbar: { min: 0.001, max: 4.4, basis: 'MODEL_DIGEST Pfluid envelope' },
  pH: { min: 0, max: 14, basis: 'aqueous pH control domain' },
  salinity_ppm: { min: 0, max: 350000, basis: 'Creative/FluidChemistry authored domain' },
  atmospheric_pCO2_bar: { min: 1e-7, max: 100, basis: 'carbonate boundary numerical bracket' },
});

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const canonicalJson = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};
const stableStrings = values => {
  const list = Array.isArray(values)
    ? values.map(value => typeof value === 'string' ? value : value?.mineral).filter(Boolean)
    : values && typeof values === 'object'
      ? Object.keys(values)
      : [];
  return [...new Set(list.map(String))].sort();
};

function inRange(errors, scenario, label, value, range) {
  if (value == null) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < range.min || number > range.max) {
    errors.push(`${scenario}: ${label}=${value} outside supported ${range.min}..${range.max}`);
  }
}

function requireCitations(errors, id, spec) {
  const sources = Array.isArray(spec.sources)
    ? spec.sources.map(source => String(source).trim()).filter(Boolean) : [];
  if (!sources.length) errors.push(`${id}: missing sources[] citations`);
  for (const [index, source] of sources.entries()) {
    if (source.length < 8) errors.push(`${id}: sources[${index}] is not a usable citation`);
  }
  return sources;
}

function inspectArchive(errors, id, specHash, version, modelDigest) {
  const archivePath = path.join(ROOT, 'archive', 'strips', `v${version}`, `${id}.json`);
  if (!fs.existsSync(archivePath)) {
    errors.push(`${id}: missing current strip archive ${path.relative(ROOT, archivePath)}`);
    return null;
  }
  let strip;
  let raw;
  try {
    raw = fs.readFileSync(archivePath);
    strip = JSON.parse(raw.toString('utf8'));
  }
  catch (error) {
    errors.push(`${id}: unreadable strip archive (${error.message})`);
    return null;
  }
  if (strip.sim_version !== version) errors.push(`${id}: stale strip sim_version ${strip.sim_version}`);
  if (strip.model_digest !== modelDigest) errors.push(`${id}: stale strip model_digest`);
  if (strip.scenario !== id) errors.push(`${id}: strip scenario metadata is '${strip.scenario}'`);
  if (strip.scenario_spec_hash !== specHash) errors.push(`${id}: stale strip scenario_spec_hash`);
  if (strip.seed !== 42) errors.push(`${id}: canonical strip seed is ${strip.seed}, expected 42`);
  return {
    path: path.relative(ROOT, archivePath).replaceAll('\\', '/'),
    sim_version: strip.sim_version,
    model_digest: strip.model_digest,
    scenario_spec_hash: strip.scenario_spec_hash,
    seed: strip.seed,
    steps: strip.steps,
    strip_sha256: sha256(raw),
  };
}

function inspectLocalityFrequencyReceipt(errors, version, modelDigest, scenarioFactories) {
  const receiptPath = path.join(ROOT, 'tests-js', 'baselines', `locality_frequency_v${version}.json`);
  if (!fs.existsSync(receiptPath)) {
    errors.push(`missing multi-seed locality receipt ${path.relative(ROOT, receiptPath)}`);
    return null;
  }
  let receipt;
  let raw;
  try {
    raw = fs.readFileSync(receiptPath);
    receipt = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    errors.push(`unreadable multi-seed locality receipt (${error.message})`);
    return null;
  }
  if (receipt.schema !== 'vugg-locality-frequency-baseline-v1') {
    errors.push(`multi-seed locality receipt has unexpected schema '${receipt.schema}'`);
  }
  if (receipt.sim_version !== version) errors.push('multi-seed locality receipt has stale SIM version');
  if (receipt.model_digest !== modelDigest) errors.push('multi-seed locality receipt has stale model digest');
  if (canonicalJson(receipt.seeds) !== canonicalJson([...LOCALITY_FREQUENCY_SEEDS])) {
    errors.push(`multi-seed locality receipt must use seeds ${LOCALITY_FREQUENCY_SEEDS.join(', ')}`);
  }
  const expectedIds = Object.keys(scenarioFactories).sort();
  const actualIds = Object.keys(receipt.scenarios || {}).sort();
  if (canonicalJson(actualIds) !== canonicalJson(expectedIds)) {
    errors.push('multi-seed locality receipt scenario fleet is incomplete or contains unknown scenarios');
  }
  for (const id of expectedIds) {
    const scenarioReceipt = receipt.scenarios?.[id];
    if (!scenarioReceipt) continue;
    const spec = scenarioFactories[id]._json5_spec;
    if (scenarioReceipt.locality_frequency_spec_hash !== localityFrequencySpecHash(spec)) {
      errors.push(`${id}: multi-seed locality behavioral contract hash is stale`);
    }
    if (Number(scenarioReceipt.duration_steps) !== Number(spec.duration_steps)) {
      errors.push(`${id}: multi-seed locality duration is stale`);
    }
    const validation = validateFrequencyScenarioReceipt(scenarioReceipt, receipt.seeds);
    for (const error of validation.errors) errors.push(`${id}: multi-seed locality ${error}`);
  }
  return {
    path: path.relative(ROOT, receiptPath).replaceAll('\\', '/'),
    schema: receipt.schema,
    sim_version: receipt.sim_version,
    model_digest: receipt.model_digest,
    seeds: receipt.seeds,
    scenario_count: actualIds.length,
    sha256: sha256(raw),
  };
}

function inspectScienceEvidenceReceipt(errors, version, modelDigest) {
  const receiptPath = path.join(ROOT, 'archive', 'evidence', `v${version}.json`);
  if (!fs.existsSync(receiptPath)) {
    errors.push(`missing aggregate science evidence receipt ${path.relative(ROOT, receiptPath)}`);
    return null;
  }
  let receipt;
  let raw;
  try {
    raw = fs.readFileSync(receiptPath);
    receipt = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    errors.push(`unreadable aggregate science evidence receipt (${error.message})`);
    return null;
  }
  if (receipt.schema !== SCIENCE_EVIDENCE_RECEIPT_SCHEMA) errors.push('aggregate science evidence schema mismatch');
  if (receipt.sim_version !== version) errors.push('aggregate science evidence SIM version mismatch');
  if (receipt.model_digest !== modelDigest) errors.push('aggregate science evidence model digest mismatch');
  if (receipt.canonical_seed !== 42) errors.push('aggregate science evidence canonical seed mismatch');
  if (receipt.browser_bundle_sha256 !== browserBundleDigest(ROOT)) {
    errors.push('aggregate science evidence browser bundle mismatch');
  }
  if (receipt.execution_set_sha256 !== runtimeExecutionDigest(ROOT)) {
    errors.push('aggregate science evidence execution set mismatch');
  }
  if (canonicalJson(receipt.node_runtime) !== canonicalJson(nodeRuntimeIdentity())
      || receipt.node_runtime_sha256 !== nodeRuntimeDigest()) {
    errors.push('aggregate science evidence Node/V8 runtime mismatch');
  }
  for (const kind of SCIENCE_EVIDENCE_PRODUCERS) {
    if (receipt.producer_contracts?.[kind] !== producerContractDigest(ROOT, kind)) {
      errors.push(`aggregate science evidence producer mismatch: ${kind}`);
    }
  }
  // The receipt's own policy, not today's — see tools/hash-policy.mjs.
  try { verifyArtifactHashMap(ROOT, receipt.artifacts, policyOfReceipt(receipt)); }
  catch (error) { errors.push(error.message); }
  return {
    path: path.relative(ROOT, receiptPath).replaceAll('\\', '/'),
    sha256: sha256(raw),
    schema: receipt.schema,
    browser_bundle_sha256: receipt.browser_bundle_sha256,
    execution_set_sha256: receipt.execution_set_sha256,
    node_runtime: receipt.node_runtime,
    node_runtime_sha256: receipt.node_runtime_sha256,
    producer_contracts: receipt.producer_contracts,
    artifact_count: Object.keys(receipt.artifacts || {}).length,
  };
}

const {
  SIM_VERSION, MODEL_DIGEST, SCENARIOS, EVENT_REGISTRY, MINERAL_SPEC,
  THERMO_PRESSURE_GRID_DATA_SHA256, THERMO_PRESSURE_GRID,
  scenarioSpecHash, setSeed,
} = await loadSimBundle({
  toolName: 'gen-science-provenance-manifest',
  extraExports: [
    'EVENT_REGISTRY', 'MINERAL_SPEC', 'scenarioSpecHash',
    'THERMO_PRESSURE_GRID_DATA_SHA256', 'THERMO_PRESSURE_GRID',
  ],
});

const errors = [];
const referencedHandlers = new Set();
const scenarios = [];
const localityFrequencyProvenance = inspectLocalityFrequencyReceipt(
  errors, SIM_VERSION, MODEL_DIGEST, SCENARIOS,
);
const scienceEvidenceProvenance = inspectScienceEvidenceReceipt(
  errors, SIM_VERSION, MODEL_DIGEST,
);
const pressureGridPath = path.join(ROOT, 'data', 'generated', 'thermo-pressure-grid.json');
const pressureVerifierPath = path.join(ROOT, 'tools', 'check-pressure-grid.mjs');
let pressureGridProvenance = null;
try {
  const artifact = JSON.parse(fs.readFileSync(pressureGridPath, 'utf8'));
  const digest = sha256(canonicalJson(artifact.payload));
  if (digest !== artifact.data_sha256) errors.push('thermo pressure grid payload digest mismatch');
  if (artifact.data_sha256 !== THERMO_PRESSURE_GRID_DATA_SHA256) {
    errors.push('thermo pressure grid runtime/data digest mismatch');
  }
  if (artifact.payload?.model_id !== THERMO_PRESSURE_GRID?.model_id) {
    errors.push('thermo pressure grid runtime/data model identity mismatch');
  }
  if (!MODEL_DIGEST.includes('Ksp-pressure:SUPCRTBL')) {
    errors.push('MODEL_DIGEST does not declare the promoted SUPCRTBL pressure grid');
  }
  if (artifact.payload?.artifact_origin !== 'offline SUPCRTBL commissioning calculation') {
    errors.push(`thermo pressure grid declares unexpected origin '${artifact.payload?.artifact_origin}'`);
  }
  if (artifact.payload?.source_model?.software !== 'Reaktoro'
    || artifact.payload?.source_model?.version !== '2.13.0'
    || artifact.payload?.source_model?.database !== 'supcrtbl') {
    errors.push('thermo pressure grid source model is not the promoted Reaktoro 2.13.0 / SUPCRTBL identity');
  }
  if (!fs.existsSync(pressureVerifierPath)) errors.push('thermo pressure grid Node verifier is missing');
  const reactionIds = Object.keys(artifact.payload?.reactions || {});
  const sources = artifact.payload?.sources || [];
  if (reactionIds.length !== 8) errors.push(`thermo pressure grid has ${reactionIds.length} reactions, expected 8`);
  if (!Array.isArray(sources) || sources.length < 3) errors.push('thermo pressure grid lacks primary/model citations');
  pressureGridProvenance = {
    path: path.relative(ROOT, pressureGridPath).replaceAll('\\', '/'),
    data_sha256: artifact.data_sha256,
    model_id: artifact.payload.model_id,
    artifact_origin: artifact.payload.artifact_origin,
    source_model: artifact.payload.source_model,
    reproducibility: {
      verifier: {
        path: path.relative(ROOT, pressureVerifierPath).replaceAll('\\', '/'),
        sha256: sha256(fs.readFileSync(pressureVerifierPath)),
      },
      command: 'npm run check:pressure-grid',
      runtime: 'Node.js/TypeScript only',
    },
    reference_pressure_kbar: artifact.payload.reference_pressure_kbar,
    temperature_axis_C: artifact.payload.temperature_axis_C,
    pressure_axis_kbar: artifact.payload.pressure_axis_kbar,
    water_density_min_g_cm3: artifact.payload.validity?.water_density_min_g_cm3,
    reactions: reactionIds,
    unsupported: artifact.payload.unsupported,
    sources,
  };
} catch (error) {
  errors.push(`thermo pressure grid unreadable (${error.message})`);
}

for (const id of Object.keys(SCENARIOS).sort()) {
  const factory = SCENARIOS[id];
  const spec = factory?._json5_spec;
  if (!spec || typeof spec !== 'object') {
    errors.push(`${id}: missing authoritative _json5_spec metadata`);
    continue;
  }
  const specHash = scenarioSpecHash(spec);
  const sources = requireCitations(errors, id, spec);
  const initial = spec.initial || {};
  const fluid = initial.fluid || {};
  const wall = initial.wall || {};
  inRange(errors, id, 'initial.temperature_C', initial.temperature_C, SUPPORT.temperature_C);
  inRange(errors, id, 'initial.pressure_kbar', initial.pressure_kbar, SUPPORT.fluid_pressure_kbar);
  inRange(errors, id, 'initial.fluid.pH', fluid.pH, SUPPORT.pH);
  inRange(errors, id, 'initial.fluid.salinity', fluid.salinity, SUPPORT.salinity_ppm);
  inRange(errors, id, 'atmospheric_pCO2_bar', spec.atmospheric_pCO2_bar, SUPPORT.atmospheric_pCO2_bar);
  if (!Number.isFinite(Number(wall.shape_seed))) errors.push(`${id}: initial.wall.shape_seed is not authored`);
  if (!String(wall.composition || '').trim()) errors.push(`${id}: initial.wall.composition is missing`);

  const duration = Math.max(0, Math.trunc(Number(spec.duration_steps) || 0));
  const eventTypes = [];
  for (const [index, event] of (spec.events || []).entries()) {
    const type = String(event?.type || '');
    if (!type || typeof EVENT_REGISTRY[type] !== 'function') {
      errors.push(`${id}: events[${index}] references unregistered handler '${type}'`);
    } else {
      referencedHandlers.add(type);
      eventTypes.push(type);
    }
    const step = Number(event?.step);
    const deliberatelyExtended = event?.extended_only === true && step > duration;
    if (!Number.isFinite(step) || step < 0 || (step > duration && !deliberatelyExtended)) {
      errors.push(`${id}: events[${index}].step=${event?.step} outside 0..${duration}`);
    }
  }
  for (const [index, movement] of (spec.movements || []).entries()) {
    const start = Number(movement?.start_step ?? 0);
    const end = Number(movement?.end_step ?? duration);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > duration) {
      errors.push(`${id}: movements[${index}] has unsupported step range ${start}..${end}`);
    }
  }

  const expected = (spec.expects_species || []).map(entry => (
    typeof entry === 'string' ? entry : entry?.mineral
  )).filter(Boolean).map(String);
  const deterministic = stableStrings(spec.deterministic_species || []);
  const statistical = stableStrings(spec.statistical_species || []);
  const aspirational = stableStrings(spec.aspirational_species || []);
  for (const [tier, minerals] of Object.entries({
    expects_species: expected,
    deterministic_species: deterministic,
    statistical_species: statistical,
    aspirational_species: aspirational,
  })) {
    for (const mineral of minerals) {
      if (!MINERAL_SPEC[mineral]) errors.push(`${id}: ${tier} references unknown mineral '${mineral}'`);
    }
  }

  setSeed(42);
  let runtime;
  try { runtime = factory(); }
  catch (error) {
    errors.push(`${id}: runtime factory rejected its authored spec (${error.message})`);
    continue;
  }
  if (runtime.conditions?._scenario?.id !== id) errors.push(`${id}: stale runtime scenario id`);
  if (runtime.conditions?._scenario?.scenario_spec_hash !== specHash) {
    errors.push(`${id}: stale runtime scenario_spec_hash`);
  }
  if (Number(runtime.conditions?.wall?.shape_seed) !== Number(wall.shape_seed)) {
    errors.push(`${id}: runtime shape_seed does not match authored metadata`);
  }
  if (Number(runtime.defaultSteps) !== duration) errors.push(`${id}: runtime duration metadata is stale`);

  const archive = inspectArchive(errors, id, specHash, SIM_VERSION, MODEL_DIGEST);
  scenarios.push({
    id,
    scenario_spec_hash: specHash,
    locality_frequency_spec_hash: localityFrequencySpecHash(spec),
    anchor: String(spec.anchor || ''),
    duration_steps: duration,
    initial: {
      temperature_C: Number(initial.temperature_C),
      pressure_kbar: Number(initial.pressure_kbar),
      pH: Number(fluid.pH),
      salinity_ppm: Number(fluid.salinity),
      shape_seed: Number(wall.shape_seed),
      wall_composition: String(wall.composition),
    },
    citations: sources,
    citations_sha256: sha256(JSON.stringify(sources)),
    expects_species: stableStrings(expected),
    deterministic_species: deterministic,
    statistical_species: statistical,
    aspirational_species: aspirational,
    excluded_species: stableStrings(spec.excluded_species || []),
    event_types: stableStrings(eventTypes),
    event_count: (spec.events || []).length,
    extended_only_event_count: (spec.events || []).filter(event => event?.extended_only === true).length,
    movement_count: (spec.movements || []).length,
    archive,
  });
}

if (errors.length) {
  console.error(`[science-manifest] FAIL — ${errors.length} contract violation(s)`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const manifest = {
  schema: 'vugg-science-provenance-manifest-v5',
  sim_version: SIM_VERSION,
  model_digest: MODEL_DIGEST,
  canonical_run_seed: 42,
  shape_seed_policy: 'authored independently in data/scenarios.json5',
  support_envelopes: SUPPORT,
  thermo_pressure_grid: pressureGridProvenance,
  locality_frequency: localityFrequencyProvenance,
  science_evidence: scienceEvidenceProvenance,
  totals: {
    scenarios: scenarios.length,
    citations: scenarios.reduce((sum, row) => sum + row.citations.length, 0),
    event_instances: scenarios.reduce((sum, row) => sum + row.event_count, 0),
    referenced_event_handlers: referencedHandlers.size,
    registered_event_handlers: Object.keys(EVENT_REGISTRY).length,
    thermodynamic_pressure_reactions: pressureGridProvenance?.reactions.length || 0,
    thermodynamic_pressure_sources: pressureGridProvenance?.sources.length || 0,
  },
  referenced_event_handlers: [...referencedHandlers].sort(),
  scenarios,
  validation: { status: 'PASS', error_count: 0 },
};
const encoded = `${JSON.stringify(manifest, null, 2)}\n`;

if (CHECK) {
  if (!fs.existsSync(OUT_PATH) || fs.readFileSync(OUT_PATH, 'utf8') !== encoded) {
    console.error(`[science-manifest] stale generated manifest: ${path.relative(ROOT, OUT_PATH)}`);
    process.exit(1);
  }
  console.log(`[science-manifest] PASS — ${scenarios.length} scenarios, generated manifest current`);
} else {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, encoded);
  console.log(`[science-manifest] wrote ${path.relative(ROOT, OUT_PATH)} — ${scenarios.length} scenarios, ${manifest.totals.citations} citations`);
}
