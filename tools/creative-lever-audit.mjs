// tools/creative-lever-audit.mjs — Creative-mode geological-lever coverage
//
// This is a causal contract, not a slider-count test. It inventories authored
// and runtime state, verifies Creative's setup/live controls, executes every
// chemistry lever's canonical causal probe, and fails CI for missing evidence,
// consumers, ranges, representations, or undocumented derived state.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Scenario top-level fields. Metadata is intentionally not a geological
// control. The other entries are real boundary/process inputs that Creative
// must eventually expose through primitives rather than one button per event.
const TOP_LEVEL_CLASSIFICATION = {
  anchor: 'metadata',
  description: 'metadata',
  duration_steps: 'time',
  events: 'process',
  expects_species: 'validation',
  deterministic_species: 'validation',
  statistical_species: 'validation',
  aspirational_species: 'validation',
  excluded_species: 'validation',
  nucleation_windows: 'process',
  nucleation_prerequisites: 'process',
  initial: 'state',
  notes: 'metadata',
  sources: 'metadata',
  claim_citations: 'metadata',
  tutorial: 'presentation',
  open_to_atmosphere: 'direct',
  atmospheric_pCO2_bar: 'direct',
  carbonate_boundary: 'direct',
  carbon_ledger: 'validation',
  movements: 'direct',
  fluid_spots: 'direct',
  weathering_epilogue: 'process',
  tiger_eye_origin_model: 'direct',
  tiger_eye_stage: 'process',
};

// Classification is explicit so a new scenario wall field cannot silently
// appear without an audit decision. "Presentation" fields may belong in view
// settings, but they are not Earth-system levers. "Derived" fields should be
// enabled automatically by a geological choice instead of exposed as ordinary
// player-facing switches.
const WALL_CLASSIFICATION = {
  air_mode_default: 'derived',
  alpine_cleft: 'derived',
  architecture: 'setup',
  cavity_render: 'presentation',
  composition: 'direct',
  confining_pressure_kbar: 'direct',
  cooling_rate: 'direct',
  ambient_temperature_C: 'direct',
  directional_steps: 'presentation',
  gamma_host: 'direct',
  graphitic: 'direct',
  inter_ring_diffusion_rate: 'direct',
  is_lit: 'direct',
  light_exposure: 'direct',
  matrix: 'presentation',
  occlusion: 'presentation',
  occlusion_fraction: 'presentation',
  open_system: 'direct',
  open_spring: 'direct',
  per_vertex_nucleation: 'derived',
  primary_bubbles: 'setup',
  reactivity: 'direct',
  secondary_bubbles: 'setup',
  shape_seed: 'setup',
  size_class: 'setup',
  thermal_pulses: 'direct',
  thickness_mm: 'direct',
  vug_diameter_mm: 'direct',
  wall_Fe_ppm: 'direct',
  wall_Mg_ppm: 'direct',
  wall_Mn_ppm: 'direct',
  wulff_barite: 'presentation',
  wulff_calcite: 'presentation',
  wulff_fluorite: 'presentation',
  wulff_galena: 'presentation',
  wulff_titanite: 'presentation',
  wulff_wulfenite: 'presentation',
  zone_chemistry: 'direct',
};

// Runtime fields that must NOT be ordinary direct sliders because they are
// derived state or an internal compatibility marker. Each declaration names
// its upstream source and real consumer. Anything absent or incomplete fails.
const DERIVED_RUNTIME_FLUID_FIELDS = {
  Eh: {
    disposition: 'derived-observation',
    source: 'fluid.O2 direct control or authored fluid.Eh movement; synchronized by _syncRedoxEh',
    consumers: ['redox availability/rate helpers', 'formation hover redox assessment'],
  },
  concentration: {
    disposition: 'derived-process-state',
    source: 'evaporation/drying and flooding actions; reset/propagation in simulator hydrology',
    consumers: ['supersaturation_halite', 'supersaturation_borax', 'evaporite engines'],
  },
  sulfateInherited: {
    disposition: 'documented-non-control',
    source: 'named external oxidized-sulfate fluid pulse; internal one-pool/two-pool compatibility latch',
    consumers: ['sulfateAvailablePpm', '_propagateGlobalDelta'],
  },
};

const EXPECTED_CHEMISTRY_GROUPS = {
  Mg: 'major', Na: 'major', K: 'major', O2: 'redox', salinity: 'physical',
};

function auditChemistryEvidence(registry, causalProbe) {
  const errors = [];
  const results = {};
  for (const [field, control] of Object.entries(registry || {})) {
    const evidence = control?.evidence;
    if (!Array.isArray(evidence?.provenance) || evidence.provenance.length === 0) {
      errors.push(`${field}: missing provenance`);
    }
    if (!String(evidence?.coupling || '').trim()) errors.push(`${field}: missing coupling`);
    if (!Array.isArray(evidence?.consumers) || evidence.consumers.length === 0) {
      errors.push(`${field}: missing consumers`);
    }
    try {
      const low = causalProbe(field, Number(control.min));
      const high = causalProbe(field, Number(control.max));
      results[field] = { low, high };
      if (!low || !high || low.route === 'unimplemented' || high.route === 'unimplemented') {
        errors.push(`${field}: no conservation/gameplay route`);
      }
      if (!Object.is(Number(low?.fluid_value), Number(control.min))
          || !Object.is(Number(high?.fluid_value), Number(control.max))) {
        errors.push(`${field}: range-input adapter did not reach canonical FluidChemistry exactly`);
      }
      if (!Number.isFinite(Number(low?.signal)) || !Number.isFinite(Number(high?.signal))
          || Object.is(Number(low?.signal), Number(high?.signal))) {
        errors.push(`${field}: production consumer did not respond across [${control.min}, ${control.max}]`);
      }
      if (!high?.consumer_mutated) {
        errors.push(`${field}: high-end conservation/gameplay consumer produced no mutation/observable`);
      }
      if (!low?.forward_route || !high?.forward_route || !low?.forward_observed || !high?.forward_observed) {
        errors.push(`${field}: no actual forward supersaturation/engine/morphology consumer`);
      }
      if (!Number.isFinite(Number(low?.forward_signal)) || !Number.isFinite(Number(high?.forward_signal))
          || Object.is(Number(low?.forward_signal), Number(high?.forward_signal))) {
        errors.push(`${field}: actual forward consumer did not respond across [${control.min}, ${control.max}]`);
      }
    } catch (error) {
      errors.push(`${field}: causal probe threw ${error.message}`);
    }
  }
  for (const [field, group] of Object.entries(EXPECTED_CHEMISTRY_GROUPS)) {
    if (registry?.[field]?.group !== group) {
      errors.push(`${field}: expected geochemical group ${group}, got ${registry?.[field]?.group}`);
    }
  }
  return { errors, results };
}

function auditSetupUIFluidRoundTrip(registry, readControls, Fluid) {
  const errors = [];
  const passedFields = [];
  const fixture = document.createElement('div');
  fixture.id = 'creative-audit-setup-fixture';
  document.body.appendChild(fixture);
  const expected = {};
  for (const [field, control] of Object.entries(registry || {})) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = control.id;
    input.min = String(control.min * control.scale);
    input.max = String(control.max * control.scale);
    input.step = String(control.step * control.scale);
    const increments = Math.max(1, Math.floor((control.max - control.min) * 0.37 / control.step));
    const canonical = Math.min(control.max, control.min + increments * control.step);
    input.value = String(canonical * control.scale);
    fixture.appendChild(input);
    expected[field] = canonical;
  }
  try {
    const params = readControls();
    const fluid = new Fluid(params);
    // SIM 243: once the explicit oxidation-state ledger is selected, bulk S
    // is a conserved derived total rather than a fourth independent sulfur
    // reservoir.  The setup fixture intentionally exercises both pools, so
    // verify the resulting identity instead of the superseded bulk input.
    if (fluid.sulfurPoolsExplicit) {
      expected.S = Number(expected.S_sulfide || 0) + Number(expected.S_sulfate || 0);
    }
    for (const [field, value] of Object.entries(expected)) {
      if (!Object.is(Number(fluid[field]), Number(value))) {
        errors.push(`${field}: setup DOM → readCreativeChemistryControls → FluidChemistry changed ${value} to ${fluid[field]}`);
      } else {
        passedFields.push(field);
      }
    }
  } finally {
    fixture.remove();
  }
  return { errors, passedFields };
}

function auditLiveSaveReplay(registry, api) {
  const errors = [];
  const passedFields = [];
  const fixture = document.createElement('div');
  fixture.id = 'creative-audit-save-fixture';
  document.body.appendChild(fixture);
  for (const control of Object.values(registry || {})) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `broth-${control.liveKey}`;
    input.min = String(control.min * control.scale);
    input.max = String(control.max * control.scale);
    input.step = String(control.step * control.scale);
    fixture.appendChild(input);
  }
  try {
    localStorage.clear();
    api.setFortressInstantLines(true);
    api.fortressReset();
    api.fortressBeginFromScenario('cooling', 98123);
    const expected = {};
    for (const [field, control] of Object.entries(registry || {})) {
      const increments = Math.max(1, Math.floor((control.max - control.min) * 0.61 / control.step));
      const canonical = Math.min(control.max, control.min + increments * control.step);
      expected[field] = canonical;
      api.setBrothValue(control.liveKey, String(canonical * control.scale));
      const now = api._liveFortressSim()?.conditions?.fluid?.[field];
      if (field !== 'CO3' && field !== 'pH' && !Object.is(Number(now), Number(canonical))) {
        errors.push(`${field}: live DOM adapter wrote ${now}, expected ${canonical}`);
      }
    }
    // Conserved-carbon Creative runs treat live DIC as explicit replacement
    // water and solve pH from reduced alkalinity. Their resulting values are
    // the replay contract; neither is an independent post-solve assignment.
    const conservedFluid = api._liveFortressSim()?.conditions?.fluid;
    expected.CO3 = Number(conservedFluid?.CO3);
    expected.pH = Number(conservedFluid?.pH);
    // Editing either explicit dissolved reservoir must update the aggregate
    // S ledger; elemental S remains a separate solid reservoir.
    const liveFluid = api._liveFortressSim()?.conditions?.fluid;
    if (liveFluid?.sulfurPoolsExplicit) {
      expected.S = Number(expected.S_sulfide || 0) + Number(expected.S_sulfate || 0);
    }
    const manual = api._saveManualNamed('creative audit all chemistry');
    if (!manual) {
      errors.push('save replay: manual save was not created');
      return { errors, passedFields };
    }
    api.fortressReset();
    if (!api.loadSaveById(manual.id)) {
      errors.push('save replay: loadSaveById rejected the audit save');
      return { errors, passedFields };
    }
    const restored = api._liveFortressSim()?.conditions?.fluid;
    for (const [field, value] of Object.entries(expected)) {
      if (!Object.is(Number(restored?.[field]), Number(value))) {
        errors.push(`${field}: live edit → localStorage save → replay restored ${restored?.[field]}, expected ${value}`);
      } else {
        passedFields.push(field);
      }
    }
  } catch (error) {
    errors.push(`save replay threw ${error.message}`);
  } finally {
    try { api.fortressReset(); } catch {}
    fixture.remove();
  }
  return { errors, passedFields };
}

function auditDerivedRuntimeFields(runtimeMissingLive) {
  const errors = [];
  for (const field of runtimeMissingLive) {
    const declaration = DERIVED_RUNTIME_FLUID_FIELDS[field];
    if (!declaration) {
      errors.push(`${field}: runtime fluid field lacks a direct control or derived-state declaration`);
      continue;
    }
    if (!declaration.disposition || !declaration.source || !declaration.consumers?.length) {
      errors.push(`${field}: incomplete derived-state source/consumer declaration`);
    }
  }
  for (const field of Object.keys(DERIVED_RUNTIME_FLUID_FIELDS)) {
    if (!runtimeMissingLive.includes(field)) errors.push(`${field}: stale derived-state declaration`);
  }
  return errors;
}

// Authored JSON fields that are deliberately tracked as defects because the
// runtime constructor drops them. Any new dropped field is unclassified and
// fails the audit.
const DEAD_AUTHORED_FLUID_CLASSIFICATION = {};

// Scenario values outside the current live-slider domains are known defects:
// syncBrothSliders clamps them in the DOM and fortressStep writes the clamped
// value back before advancing. Classify by field so a newly overflowing field
// fails the contract, while the current repair backlog remains executable.
const LIVE_RANGE_GAP_CLASSIFICATION = {};

const union = (arrays) => [...new Set(arrays.flat())].sort();
const difference = (a, b) => a.filter((item) => !b.has(item));
const intersection = (a, b) => a.filter((item) => b.has(item));
const groupByValue = (obj, keys = Object.keys(obj)) => {
  const out = {};
  for (const key of keys) (out[obj[key]] ||= []).push(key);
  for (const values of Object.values(out)) values.sort();
  return out;
};

function liveSliderRangesFromHtml(liveMappings, registry) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ranges = new Map();
  for (const match of html.matchAll(/<input\b[^>]*\bid="broth-([^"]+)"[^>]*>/g)) {
    const tag = match[0];
    const attr = (name) => {
      const found = tag.match(new RegExp(`\\b${name}="([^"]+)"`));
      return found ? Number(found[1]) : NaN;
    };
    const rawMin = attr('min');
    const rawMax = attr('max');
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) continue;
    const mapping = liveMappings.find((entry) => entry.key === match[1]);
    const prop = mapping?.path?.startsWith('fluid.') ? mapping.path.slice('fluid.'.length) : null;
    const scale = prop
      ? (registry[prop]?.scale || 1)
      : (match[1] === 'flow' ? 10 : match[1] === 'pressure' ? 100 : 1);
    ranges.set(match[1], { min: rawMin / scale, max: rawMax / scale });
  }
  return ranges;
}

function recordingProxy(target, basePath, writes, cache = new WeakMap()) {
  if (!target || typeof target !== 'object') return target;
  if (cache.has(target)) return cache.get(target);
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver);
      return value && typeof value === 'object'
        ? recordingProxy(value, [...basePath, String(key)], writes, cache)
        : value;
    },
    set(obj, key, value, receiver) {
      writes.add([...basePath, String(key)].join('.'));
      return Reflect.set(obj, key, value, receiver);
    },
  });
  cache.set(target, proxy);
  return proxy;
}

function inventoryEventWrites(SCENARIOS) {
  const paths = new Set();
  const errors = [];
  for (const [scenarioId, makeScenario] of Object.entries(SCENARIOS)) {
    const { conditions, events } = makeScenario();
    for (const event of events) {
      const writes = new Set();
      try {
        event.apply_fn(recordingProxy(conditions, [], writes));
      } catch (error) {
        errors.push(`${scenarioId} / ${event.name}: ${error.message}`);
      }
      for (const writtenPath of writes) paths.add(writtenPath);
    }
  }
  return { paths: [...paths].sort(), errors };
}

const bundle = await loadSimBundle({
  toolName: 'creative-lever-audit',
  extraExports: [
    'FluidChemistry',
    'VugWall',
    'VugConditions',
    'CREATIVE_CHEMISTRY_CONTROLS',
    'creativeChemistryCausalProbe',
    'readCreativeChemistryControls',
    'BROTH_MAP',
    'setBrothValue',
    'fortressBeginFromScenario',
    'fortressReset',
    'setFortressInstantLines',
    '_liveFortressSim',
    '_saveManualNamed',
    'loadSaveById',
  ],
});

const {
  SCENARIOS, FluidChemistry, VugWall, VugConditions,
  CREATIVE_CHEMISTRY_CONTROLS, creativeChemistryCausalProbe,
  readCreativeChemistryControls, BROTH_MAP,
} = bundle;
const scenarioEntries = Object.entries(SCENARIOS);
const specs = scenarioEntries.map(([, makeScenario]) => makeScenario._json5_spec || {});
const events = specs.flatMap((spec) => spec.events || []);
const movements = specs.flatMap((spec) => spec.movements || []);

const authoredTopFields = union(specs.map((spec) => Object.keys(spec)));
const authoredInitialFields = union(specs.map((spec) => Object.keys(spec.initial || {})));
const authoredFluidFields = union(specs.map((spec) => Object.keys(spec.initial?.fluid || {})));
const authoredWallFields = union(specs.map((spec) => Object.keys(spec.initial?.wall || {})));
const runtimeFluidFields = Object.keys(new FluidChemistry()).sort();
const runtimeWallFields = Object.keys(new VugWall()).sort();
const runtimeConditionFields = Object.keys(new VugConditions()).sort();
const runtimeFluidSet = new Set(runtimeFluidFields);
const liveMappings = Object.entries(BROTH_MAP || {})
  .map(([key, entry]) => ({ key, path: entry.path }))
  .filter((entry) => typeof entry.path === 'string')
  .sort((a, b) => a.key.localeCompare(b.key));
const livePaths = liveMappings.map((entry) => entry.path);
const requiredLiveEnvironmentalPaths = [
  'pressure',
  'fluid_surface_height_percent',
  'porosity',
  'wall.cooling_rate',
  'wall.ambient_temperature_C',
  'wall.reactivity',
  'wall.vug_diameter_mm',
  'wall.thickness_mm',
  'wall.wall_Fe_ppm',
  'wall.wall_Mn_ppm',
  'wall.wall_Mg_ppm',
  'inter_ring_diffusion_rate',
  'wall.gamma_host',
  '_scenario.atmospheric_pCO2_bar',
  'wall.composition',
  '_scenario.open_to_atmosphere',
  'wall.open_system',
  'wall.open_spring',
  'wall.is_lit',
  'wall.graphitic',
  'wall.thermal_pulses',
  'wall.thermal_pulse_fluid',
  'wall.pH_boundary',
];
const missingLiveEnvironmentalPaths = requiredLiveEnvironmentalPaths
  .filter((fieldPath) => !livePaths.includes(fieldPath));
// Most setup markup is authored in index.html. New authority controls are
// installed from the executable UI module so generated index.html remains a
// build product; audit both sources as one authored control surface.
const setupHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  + '\n' + fs.readFileSync(path.join(ROOT, 'js', '97-ui-fortress.ts'), 'utf8');
const requiredSetupEnvironmentalIds = [
  'f-pressure',
  'f-host-composition', 'f-architecture', 'f-vug-diameter',
  'f-host-thickness', 'f-wall-fe', 'f-wall-mn', 'f-wall-mg',
  'f-wall-reactivity', 'f-cooling-rate', 'f-ambient-temperature', 'f-diffusion-rate',
  'f-primary-bubbles', 'f-secondary-bubbles', 'f-shape-seed',
  'f-gamma-host', 'f-graphitic', 'f-open-system', 'f-open-spring', 'f-thermal-pulses',
  'f-is-lit',
  'f-ph-boundary-enabled', 'f-ph-boundary-target', 'f-ph-boundary-rate',
  'f-ph-boundary-authority', 'f-thermal-pulse-authority',
  'f-thermal-pulse-components', 'f-thermal-pulse-ph-delta', 'f-thermal-pulse-flow',
  'f-flow-rate', 'f-porosity', 'f-water-table',
  'f-open-atmosphere', 'f-pco2',
];
const missingSetupEnvironmentalIds = requiredSetupEnvironmentalIds
  .filter((id) => !setupHtml.includes(`id="${id}"`));
const requiredAdvancedEditorIds = [
  'creative-movement-field', 'creative-movement-operator',
  'creative-feeder-kind', 'creative-feeder-cells',
  'creative-thermal-id', 'creative-thermal-temperature', 'creative-thermal-cell',
  'creative-thermal-depth', 'creative-thermal-coupling',
  'creative-thermal-advection', 'creative-thermal-direction',
  'creative-thermal-start', 'creative-thermal-end',
  'creative-thermal-enabled', 'creative-thermal-conduction', 'creative-thermal-wall-coupling',
  'creative-thermal-rock-temperature',
  'creative-zone-name', 'creative-zone-field',
  'creative-deformation-style', 'creative-stress-mpa', 'creative-etch-duration-days', 'creative-film-mineral',
];
const missingAdvancedEditorIds = requiredAdvancedEditorIds
  .filter((id) => !setupHtml.includes(`id="${id}"`));
const etchProcessContractErrors = [];
const etchDurationTag = setupHtml.match(/<input\b[^>]*\bid="creative-etch-duration-days"[^>]*>/)?.[0] || '';
const etchNumberAttribute = (name) => {
  const match = etchDurationTag.match(new RegExp(`\\b${name}="([^"]+)"`));
  return match ? Number(match[1]) : NaN;
};
if (setupHtml.includes('id="creative-etch-style"')) {
  etchProcessContractErrors.push('cosmetic creative-etch-style override must remain absent; morphology is model-derived');
}
if (etchDurationTag) {
  if (!(etchNumberAttribute('min') > 0)) etchProcessContractErrors.push('etch duration min must be positive');
  if (etchNumberAttribute('max') !== 19.5) etchProcessContractErrors.push('etch duration max must equal measured 19.5-day envelope');
  if (etchNumberAttribute('value') !== 19.5) etchProcessContractErrors.push('etch duration default must equal 19.5 days');
}
if (!setupHtml.includes("duration_days: _creativeOptionalNumber('creative-etch-duration-days')")) {
  etchProcessContractErrors.push('Creative etch action must dispatch direct duration_days');
}
const liveFluidFields = livePaths
  .filter((fieldPath) => fieldPath.startsWith('fluid.'))
  .map((fieldPath) => fieldPath.slice('fluid.'.length))
  .sort();
const liveFluidSet = new Set(liveFluidFields);
const setupFluidFields = Object.keys(CREATIVE_CHEMISTRY_CONTROLS || {}).sort();
const setupFluidSet = new Set(setupFluidFields);
const acceptedAuthoredFluidFields = intersection(authoredFluidFields, runtimeFluidSet);
const deadAuthoredFluidFields = difference(authoredFluidFields, runtimeFluidSet);
const authoredMissingLive = difference(acceptedAuthoredFluidFields, liveFluidSet);
const authoredMissingSetup = difference(acceptedAuthoredFluidFields, setupFluidSet);
const runtimeMissingLive = difference(runtimeFluidFields, liveFluidSet);
const chemistryEvidence = auditChemistryEvidence(
  CREATIVE_CHEMISTRY_CONTROLS,
  creativeChemistryCausalProbe,
);
const chemistryEvidenceErrors = chemistryEvidence.errors;
const setupUIFluidRoundTrip = auditSetupUIFluidRoundTrip(
  CREATIVE_CHEMISTRY_CONTROLS,
  readCreativeChemistryControls,
  FluidChemistry,
);
const liveSaveReplay = auditLiveSaveReplay(CREATIVE_CHEMISTRY_CONTROLS, bundle);
const derivedRuntimeFluidErrors = auditDerivedRuntimeFields(runtimeMissingLive);
const eventWrites = inventoryEventWrites(SCENARIOS);
const liveSliderRanges = liveSliderRangesFromHtml(liveMappings, CREATIVE_CHEMISTRY_CONTROLS);
const authoredRangeViolations = [];
for (const [scenarioId, makeScenario] of scenarioEntries) {
  const initial = makeScenario._json5_spec?.initial || {};
  const fluid = initial.fluid || {};
  for (const mapping of liveMappings) {
    const field = mapping.path.startsWith('fluid.') ? mapping.path.slice('fluid.'.length) : mapping.path;
    const value = mapping.path.startsWith('fluid.') ? fluid[field]
      : mapping.path === 'temperature' ? initial.temperature_C
      : mapping.path === 'pressure' ? initial.pressure_kbar
      : undefined;
    const range = liveSliderRanges.get(mapping.key);
    if (typeof value !== 'number' || !range) continue;
    if (value < range.min || value > range.max) {
      authoredRangeViolations.push({ scenario: scenarioId, field, value, ...range });
    }
  }
}
const rangeViolationFields = union(authoredRangeViolations.map((item) => [item.field]));

const unclassified = {
  topLevel: authoredTopFields.filter((field) => !(field in TOP_LEVEL_CLASSIFICATION)),
  initial: authoredInitialFields.filter((field) => !['temperature_C', 'pressure_kbar', 'fluid', 'wall'].includes(field)),
  wall: authoredWallFields.filter((field) => !(field in WALL_CLASSIFICATION)),
  deadAuthoredFluid: deadAuthoredFluidFields.filter((field) => !(field in DEAD_AUTHORED_FLUID_CLASSIFICATION)),
  runtimeFluidGap: runtimeMissingLive.filter((field) => !(field in DERIVED_RUNTIME_FLUID_FIELDS)),
  liveRangeGap: rangeViolationFields.filter((field) => !(field in LIVE_RANGE_GAP_CLASSIFICATION)),
};

const staleClassifications = {
  wall: Object.keys(WALL_CLASSIFICATION).filter((field) => !authoredWallFields.includes(field)),
  fluidGap: Object.keys(DERIVED_RUNTIME_FLUID_FIELDS).filter((field) => !runtimeMissingLive.includes(field)),
  deadAuthoredFluid: Object.keys(DEAD_AUTHORED_FLUID_CLASSIFICATION)
    .filter((field) => !deadAuthoredFluidFields.includes(field)),
  liveRangeGap: Object.keys(LIVE_RANGE_GAP_CLASSIFICATION)
    .filter((field) => !rangeViolationFields.includes(field)),
};

// Wall runtime contains accumulated/output and dormant fields as well as input
// fields. Report them for visibility but do not pretend they all belong in the
// Creative UI.
const runtimeOnlyWallFields = difference(runtimeWallFields, new Set(authoredWallFields));
const eventDirectiveCounts = {
  spots: events.filter((event) => event.spots != null).length,
  deformation: events.filter((event) => event.deformation != null).length,
  etch: events.filter((event) => event.etch != null).length,
  film: events.filter((event) => event.film != null).length,
};

const result = {
  contract: {
    passed: Object.values(unclassified).every((items) => items.length === 0)
      && Object.values(staleClassifications).every((items) => items.length === 0)
      && missingLiveEnvironmentalPaths.length === 0
      && missingSetupEnvironmentalIds.length === 0
      && missingAdvancedEditorIds.length === 0
      && etchProcessContractErrors.length === 0
      && eventWrites.errors.length === 0
      && chemistryEvidenceErrors.length === 0
      && setupUIFluidRoundTrip.errors.length === 0
      && liveSaveReplay.errors.length === 0
      && derivedRuntimeFluidErrors.length === 0,
    unclassified,
    staleClassifications,
    eventProbeErrors: eventWrites.errors,
    missingLiveEnvironmentalPaths,
    missingSetupEnvironmentalIds,
    missingAdvancedEditorIds,
    etchProcessContractErrors,
    chemistryEvidenceErrors,
    setupUIFluidRoundTripErrors: setupUIFluidRoundTrip.errors,
    liveSaveReplayErrors: liveSaveReplay.errors,
    derivedRuntimeFluidErrors,
  },
  inventory: {
    scenarios: scenarioEntries.length,
    events: events.length,
    movements: movements.length,
    movementScenarios: specs.filter((spec) => (spec.movements || []).length > 0).length,
    movementFields: union(movements.map((movement) => [movement.field])),
    authoredTopFields,
    authoredInitialFields,
    authoredFluidFields,
    authoredWallFields,
    runtimeFluidFields,
    runtimeConditionFields,
    runtimeOnlyWallFields,
    eventWrittenPaths: eventWrites.paths,
    eventDirectiveCounts,
    authoredRangeViolations,
  },
  creativeCoverage: {
    livePaths,
    liveFluidFields,
    setupFluidFields,
    acceptedAuthoredFluidFields,
    deadAuthoredFluidFields,
    authoredMissingLive,
    authoredMissingSetup,
    runtimeMissingLive,
    derivedRuntimeFluidFields: Object.fromEntries(
      runtimeMissingLive.map((field) => [field, DERIVED_RUNTIME_FLUID_FIELDS[field]]),
    ),
    chemistryEvidenceFields: Object.keys(CREATIVE_CHEMISTRY_CONTROLS).sort(),
    conservationRoutes: Object.fromEntries(
      Object.entries(chemistryEvidence.results).map(([field, probe]) => [field, probe.high.route]),
    ),
    causalGameplayRoutes: Object.fromEntries(
      Object.entries(chemistryEvidence.results).map(([field, probe]) => [field, probe.high.forward_route]),
    ),
    setupUIFluidRoundTripFields: setupUIFluidRoundTrip.passedFields.sort(),
    liveSaveReplayFields: liveSaveReplay.passedFields.sort(),
    wallClassification: groupByValue(WALL_CLASSIFICATION, authoredWallFields),
    topLevelClassification: groupByValue(TOP_LEVEL_CLASSIFICATION, authoredTopFields),
    requiredLiveEnvironmentalPaths,
    requiredSetupEnvironmentalIds,
    requiredAdvancedEditorIds,
  },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const wallGroups = result.creativeCoverage.wallClassification;
  console.log('Creative geological-lever audit');
  console.log(`  Authored fleet: ${result.inventory.scenarios} scenarios, ${result.inventory.events} events, ${result.inventory.movements} movements across ${result.inventory.movementScenarios} scenarios`);
  console.log(`  Fluid schema: ${authoredFluidFields.length} authored fields; ${acceptedAuthoredFluidFields.length} accepted; ${deadAuthoredFluidFields.length} silently dropped`);
  console.log(`  Creative live fluid: ${liveFluidFields.length}/${acceptedAuthoredFluidFields.length} authored accepted fields; missing ${authoredMissingLive.join(', ') || 'none'}`);
  console.log(`  Creative setup fluid: ${setupFluidFields.length}/${acceptedAuthoredFluidFields.length} authored accepted fields; missing ${authoredMissingSetup.join(', ') || 'none'}`);
  console.log(`  Live slider ranges: ${authoredRangeViolations.length} authored initial values clipped across ${new Set(authoredRangeViolations.map((item) => item.scenario)).size} scenarios${rangeViolationFields.length ? ` (${rangeViolationFields.join(', ')})` : ''}`);
  console.log(`  Wall schema: ${authoredWallFields.length} authored fields; direct ${wallGroups.direct?.length || 0}; partial ${wallGroups.partial?.length || 0}; derived ${wallGroups.derived?.length || 0}; missing ${wallGroups.missing?.length || 0}; presentation ${wallGroups.presentation?.length || 0}`);
  console.log(`  Environmental controls: live ${requiredLiveEnvironmentalPaths.length - missingLiveEnvironmentalPaths.length}/${requiredLiveEnvironmentalPaths.length}; setup ${requiredSetupEnvironmentalIds.length - missingSetupEnvironmentalIds.length}/${requiredSetupEnvironmentalIds.length}`);
  console.log(`  Advanced history editors: ${requiredAdvancedEditorIds.length - missingAdvancedEditorIds.length}/${requiredAdvancedEditorIds.length} required surfaces`);
  console.log(`  Process directives: ${eventDirectiveCounts.spots} spot lifecycle, ${eventDirectiveCounts.deformation} deformation, ${eventDirectiveCounts.etch} etch, ${eventDirectiveCounts.film} film`);
  console.log(`  Setup UI → FluidChemistry: ${setupUIFluidRoundTrip.passedFields.length}/${setupFluidFields.length} levers round-tripped`);
  console.log(`  Gameplay consumers: ${Object.keys(chemistryEvidence.results).length}/${setupFluidFields.length} levers executed through production routes; ${chemistryEvidenceErrors.length} errors`);
  console.log(`  Live UI → localStorage save → replay: ${liveSaveReplay.passedFields.length}/${setupFluidFields.length} levers restored exactly`);
  console.log(`  Derived runtime fields: ${runtimeMissingLive.length - derivedRuntimeFluidErrors.length}/${runtimeMissingLive.length} have source + consumers`);
  console.log(`  Contract: ${result.contract.passed ? 'PASS — every discovered input is represented, reaches gameplay, and survives replay' : 'FAIL — a representation, gameplay, or replay defect exists'}`);
  if (deadAuthoredFluidFields.length) console.log(`  Defect: authored but discarded fluid fields: ${deadAuthoredFluidFields.join(', ')}`);
  for (const [area, fields] of Object.entries(unclassified)) {
    if (fields.length) console.error(`  Unclassified ${area}: ${fields.join(', ')}`);
  }
  for (const [area, fields] of Object.entries(staleClassifications)) {
    if (fields.length) console.error(`  Stale ${area}: ${fields.join(', ')}`);
  }
  for (const error of eventWrites.errors) console.error(`  Event probe error: ${error}`);
  if (missingLiveEnvironmentalPaths.length) console.error(`  Missing live environmental controls: ${missingLiveEnvironmentalPaths.join(', ')}`);
  if (missingSetupEnvironmentalIds.length) console.error(`  Missing setup environmental controls: ${missingSetupEnvironmentalIds.join(', ')}`);
  if (missingAdvancedEditorIds.length) console.error(`  Missing advanced history editors: ${missingAdvancedEditorIds.join(', ')}`);
  for (const error of etchProcessContractErrors) console.error(`  Etch process contract error: ${error}`);
  for (const error of chemistryEvidenceErrors) console.error(`  Chemistry evidence error: ${error}`);
  for (const error of setupUIFluidRoundTrip.errors) console.error(`  Setup round-trip error: ${error}`);
  for (const error of liveSaveReplay.errors) console.error(`  Save replay error: ${error}`);
  for (const error of derivedRuntimeFluidErrors) console.error(`  Derived runtime field error: ${error}`);
}

if (!result.contract.passed) process.exitCode = 1;
