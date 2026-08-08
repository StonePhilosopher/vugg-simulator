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
  try { strip = JSON.parse(fs.readFileSync(archivePath, 'utf8')); }
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
  };
}

const {
  SIM_VERSION, MODEL_DIGEST, SCENARIOS, EVENT_REGISTRY, MINERAL_SPEC,
  scenarioSpecHash, setSeed,
} = await loadSimBundle({
  toolName: 'gen-science-provenance-manifest',
  extraExports: ['EVENT_REGISTRY', 'MINERAL_SPEC', 'scenarioSpecHash'],
});

const errors = [];
const referencedHandlers = new Set();
const scenarios = [];

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
  for (const mineral of expected) {
    if (!MINERAL_SPEC[mineral]) errors.push(`${id}: expects_species references unknown mineral '${mineral}'`);
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
  schema: 'vugg-science-provenance-manifest-v1',
  sim_version: SIM_VERSION,
  model_digest: MODEL_DIGEST,
  canonical_run_seed: 42,
  shape_seed_policy: 'authored independently in data/scenarios.json5',
  support_envelopes: SUPPORT,
  totals: {
    scenarios: scenarios.length,
    citations: scenarios.reduce((sum, row) => sum + row.citations.length, 0),
    event_instances: scenarios.reduce((sum, row) => sum + row.event_count, 0),
    referenced_event_handlers: referencedHandlers.size,
    registered_event_handlers: Object.keys(EVENT_REGISTRY).length,
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
