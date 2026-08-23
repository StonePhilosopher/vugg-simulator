#!/usr/bin/env node
/**
 * tools/review-claim-card.mjs — distill a scenario into an adversarial-review CARD.
 *
 * The hostile review (2026-07-14) asks of every canonical seed-42 vugg: "would a
 * geologist believe this crystal's biography?" To ask that cheaply, this tool
 * fuses two sources into one compact card per scenario:
 *
 *   1. the scenario DEFINITION (data/scenarios.json5 via the harness) — the CLAIM:
 *      anchor locality, deposit-type description, expects_species, cited sources,
 *      initial T/P/fluid.
 *   2. the canonical STRIP (archive/strips/v<N>/<scenario>.json) — the TESTIMONY:
 *      the actual nucleation sequence (paragenetic order) + environment trajectory.
 *
 * The card surfaces the adversarial hooks: the paragenetic order as the sim
 * actually grew it, species present that expects_species never named (surprises),
 * expected species that never nucleated (no-shows), and the T/pH/Eh/salinity arc.
 * A mineralogist reads the card and challenges; they never need the 175 KB strip.
 *
 * This is a passive READ instrument — it never touches sim output. Not part of the
 * rebake ritual; run on demand during a review.
 *
 * Usage:
 *   node tools/review-claim-card.mjs <scenario> [--version N] [--json]
 *   node tools/review-claim-card.mjs --all [--version N] [--out DIR]
 *   node tools/review-claim-card.mjs --help
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertStripIdentity } from './strip-identity.mjs';
import { verifyMechanismWitnessArtifact } from './gen-mechanism-witnesses.mjs';
import { reduceEnclosureLifecycle } from './enclosure-evidence.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function latestStripVersion() {
  const dir = path.join(ROOT, 'archive', 'strips');
  const vs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
    .map((d) => parseInt(d.name.slice(1), 10))
    .sort((a, b) => a - b);
  return vs[vs.length - 1];
}

function seriesStats(chip) {
  if (!chip || !Array.isArray(chip.wall) || !chip.wall.length) return null;
  const w = chip.wall.filter((x) => typeof x === 'number');
  if (!w.length) return null;
  const first = w[0], last = w[w.length - 1];
  let min = Infinity, max = -Infinity;
  for (const x of w) { if (x < min) min = x; if (x > max) max = x; }
  return { first, last, min, max, units: chip.units || '' };
}

/** Group nucleation plus alteration products into first-appearance order. */
function paragenesis(strip) {
  const firstStep = new Map();
  const count = new Map();
  const transformationCount = new Map();
  const pathways = new Map();
  for (const ev of strip.nucleation_events || []) {
    if (!firstStep.has(ev.mineral) || ev.step < firstStep.get(ev.mineral)) firstStep.set(ev.mineral, ev.step);
    count.set(ev.mineral, (count.get(ev.mineral) || 0) + 1);
    if (!pathways.has(ev.mineral)) pathways.set(ev.mineral, new Set());
    pathways.get(ev.mineral).add('nucleation');
  }
  for (const ev of strip.executed_testimony?.transformations || []) {
    if (!ev?.to) continue;
    if (!firstStep.has(ev.to) || ev.step < firstStep.get(ev.to)) firstStep.set(ev.to, ev.step);
    transformationCount.set(ev.to, (transformationCount.get(ev.to) || 0) + 1);
    if (!pathways.has(ev.to)) pathways.set(ev.to, new Set());
    pathways.get(ev.to).add(`${ev.from || '?'} -> ${ev.to}`);
  }
  const order = [...firstStep.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([mineral, step]) => ({
      mineral,
      first_step: step,
      events: count.get(mineral) || 0,
      transformations: transformationCount.get(mineral) || 0,
      pathways: [...(pathways.get(mineral) || [])],
    }));
  return order;
}

function normalizeExpectationEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => (
    typeof entry === 'string'
      ? { mineral: entry, reason: null }
      : { ...entry, mineral: String(entry?.mineral || ''), reason: entry?.reason || null }
  )).filter((entry) => entry.mineral);
}

function buildScienceDecisions(spec, science) {
  const temperatureC = spec.initial?.temperature_C ?? null;
  const fluidPressureKbar = spec.initial?.pressure_kbar ?? null;
  const confiningPressureKbar = spec.initial?.wall?.confining_pressure_kbar ?? null;
  const boundary = Number.isFinite(temperatureC)
    ? science.calciteAragoniteBoundaryKbar(temperatureC) : null;
  const aragoniteSecure = Number.isFinite(temperatureC) && Number.isFinite(fluidPressureKbar)
    ? science.aragoniteIsPressureStable(temperatureC, fluidPressureKbar) : null;
  const al2sio5 = Number.isFinite(temperatureC)
    ? science.al2sio5PhaseAssessment(temperatureC, confiningPressureKbar) : null;
  const gypsumBoundaryC = Number.isFinite(fluidPressureKbar)
    ? science.gypsumAnhydriteBoundaryC(fluidPressureKbar) : null;
  const waterActivity = science.waterActivityAssessment(spec.initial?.fluid, temperatureC ?? 25);
  const pressureGridMinerals = [
    'calcite', 'aragonite', 'dolomite', 'siderite', 'rhodochrosite',
    'anhydrite', 'barite', 'celestine', 'selenite',
  ];
  const pressureKsp = Object.fromEntries(pressureGridMinerals.map((mineral) => [
    mineral,
    science.thermoPressureAssessment(mineral, temperatureC, fluidPressureKbar),
  ]));
  const stressEvents = (spec.events || [])
    .filter(e => e.type === 'tectonic_shock' || e.deformation || /strain|stress/.test(e.type || ''))
    .map(e => ({
      step: e.step,
      type: e.type,
      decision: e.type === 'tectonic_shock'
        ? { sigma_diff_mpa: 50, timescale: 'instantaneous', model: 'resolved-shear threshold pulse; fluid pressure unchanged; no creep law' }
        : e.deformation
          ? { model: 'authored visual deformation overprint', directive: e.deformation }
          : { model: 'scenario-specific mechanical event; inspect handler' },
    }));
  return {
    model_digest: science.MODEL_DIGEST,
    growth_budget: science.STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE,
    fluid_pressure: {
      initial_kbar: fluidPressureKbar,
      role: 'cavity-fluid pressure; never silently substituted for rock pressure or differential stress',
    },
    confining_pressure: {
      initial_kbar: confiningPressureKbar,
      role: confiningPressureKbar == null
        ? 'unspecified; metamorphic phase field is reported unconstrained'
        : 'rock/confining pressure used by metamorphic phase fields',
    },
    phase_fields: {
      calcite_aragonite: {
        boundary_kbar: boundary,
        secure_aragonite_field: aragoniteSecure,
        model: 'Hacker et al. (2005) polynomial; secure field requires +1 kbar uncertainty clearance',
      },
      al2sio5,
      gypsum_anhydrite: {
        pure_water_boundary_C: gypsumBoundaryC,
        initial_water_activity: waterActivity,
        model: 'Hardie pure-water phase line plus explicit 2log10(a_w) gypsum saturation term; a_w is a disclosed NaCl-equivalent proxy, not Pitzer-grade multicomponent brine output',
      },
    },
    pressure_ksp_grid: {
      rule: 'reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy',
      assessments: pressureKsp,
    },
    differential_stress_events: stressEvents,
  };
}

function sampleStats(samples, key) {
  const values = (samples || []).map((s) => s?.[key]).filter(Number.isFinite);
  if (!values.length) return null;
  return {
    first: values[0], last: values[values.length - 1],
    min: Math.min(...values), max: Math.max(...values), samples: values.length,
  };
}

function buildSulfurLedgerTestimony(samples) {
  const ledger = Array.isArray(samples) ? samples : [];
  const phases = new Map();
  let maxAbsBalanceErrorPpm = 0;
  let maxAbsTestimonyErrorPpm = 0;
  let closedSampleCount = 0;
  for (const sample of ledger) {
    maxAbsBalanceErrorPpm = Math.max(
      maxAbsBalanceErrorPpm,
      Math.abs(Number(sample?.errorPpm) || 0),
    );
    maxAbsTestimonyErrorPpm = Math.max(
      maxAbsTestimonyErrorPpm,
      Math.abs(Number(sample?.testimonyErrorPpm) || 0),
    );
    if (sample?.closed === true && sample?.testimonyClosed === true) closedSampleCount++;
    for (const phase of (Array.isArray(sample?.phaseIdentity) ? sample.phaseIdentity : [])) {
      const mineral = String(phase?.mineral || '');
      const reservoir = String(phase?.reservoir || '');
      if (!mineral || !reservoir) continue;
      const key = `${reservoir}\0${mineral}`;
      const existing = phases.get(key) || {
        mineral,
        reservoir,
        max_booked_solid_ppm: 0,
      };
      existing.max_booked_solid_ppm = Math.max(
        existing.max_booked_solid_ppm,
        Math.max(0, Number(phase?.bookedSolidPpm) || 0),
      );
      phases.set(key, existing);
    }
  }
  const first = ledger[0] || null;
  const last = ledger.at(-1) || null;
  return {
    source: 'archived phase-resolved sulfur ledger; exact samples are authenticated by the strip SHA-256',
    sample_count: ledger.length,
    closed_sample_count: closedSampleCount,
    all_closed: ledger.length ? closedSampleCount === ledger.length : null,
    max_abs_balance_error_ppm: maxAbsBalanceErrorPpm,
    max_abs_testimony_error_ppm: maxAbsTestimonyErrorPpm,
    first_fluid_reservoir_ppm: first?.fluidReservoirPpm ?? null,
    last_fluid_reservoir_ppm: last?.fluidReservoirPpm ?? null,
    first_solid_reservoir_ppm: first?.solidReservoirPpm ?? null,
    last_solid_reservoir_ppm: last?.solidReservoirPpm ?? null,
    activation: first?.activation ?? null,
    phase_identities: Array.from(phases.values()).sort((a, b) => (
      a.reservoir.localeCompare(b.reservoir) || a.mineral.localeCompare(b.mineral)
    )),
    samples: ledger,
  };
}

// Evidence-side mirror of js/20-chemistry-fluid.ts. The browser constructor
// owns the runtime schema; this explicit non-sulfur projection is the claim
// producer's fail-closed vocabulary. tests-js/claim-cards.test.ts attacks
// unknown fields and full-replacement omissions so the two modules cannot
// silently acquire different scientific meanings.
export const EVIDENCE_FLUID_BOUNDARY_FIELDS = Object.freeze([
  'SiO2', 'reactiveSilicaFraction', 'Ca', 'CO3', 'F', 'Zn', 'Fe', 'Mn', 'Al', 'Ti', 'Pb', 'U',
  'Cu', 'Mo', 'K', 'Na', 'Mg', 'Ba', 'Sr', 'Cr', 'P', 'As', 'Cl', 'V', 'W',
  'Ag', 'Bi', 'Sb', 'Ni', 'Co', 'B', 'Li', 'Be', 'Te', 'Se', 'Ge', 'Au',
  'Cd', 'Hg', 'Sn', 'Y', 'O2', 'Eh', 'pH', 'salinity', 'concentration',
]);
const EVIDENCE_FLUID_BOUNDARY_FIELD_SET = new Set(EVIDENCE_FLUID_BOUNDARY_FIELDS);
const EVIDENCE_SULFUR_REPLACEMENT_FIELDS = Object.freeze([
  'S', 'S_sulfide', 'S_sulfate', 'S_elemental',
]);
const EVIDENCE_SULFUR_PATHWAYS = new Set([
  null,
  'oxidative_interface',
  'oxidative_closed_fluid',
  'anaerobic_microbial_inherited',
]);

const evidenceFluidBoundaryUnit = (field) => {
  if (field === 'pH') return 'pH';
  if (field === 'Eh') return 'mV';
  if (field === 'reactiveSilicaFraction') return 'fraction';
  if (field === 'concentration') return 'multiplier';
  return 'mg_per_kg_solvent';
};

const evidenceLedgerTolerance = (before, after) => (
  Math.max(1e-7, Math.abs(Math.max(before, after)) * 1e-9)
);

const hasExactKeys = (value, expected) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const assertFluidAuthorityProjection = (value, label) => {
  if (!hasExactKeys(value, [
    'sulfurPoolsExplicit', 'sulfateInherited', 'nativeSulfurPathway',
  ])
      || typeof value.sulfurPoolsExplicit !== 'boolean'
      || typeof value.sulfateInherited !== 'boolean'
      || !EVIDENCE_SULFUR_PATHWAYS.has(value.nativeSulfurPathway)) {
    throw new Error(`[card] ${label} has noncanonical sulfur authority`);
  }
  return value;
};

const assertFluidAuthoritySpatialState = (value, label) => {
  if (!hasExactKeys(value, [
    'count', 'sulfurPoolsExplicitCount', 'sulfateInheritedCount', 'nativeSulfurPathways',
  ])
      || !Number.isSafeInteger(value.count) || value.count <= 0
      || !Number.isSafeInteger(value.sulfurPoolsExplicitCount)
      || value.sulfurPoolsExplicitCount < 0 || value.sulfurPoolsExplicitCount > value.count
      || !Number.isSafeInteger(value.sulfateInheritedCount)
      || value.sulfateInheritedCount < 0 || value.sulfateInheritedCount > value.count
      || !value.nativeSulfurPathways || typeof value.nativeSulfurPathways !== 'object'
      || Array.isArray(value.nativeSulfurPathways)) {
    throw new Error(`[card] ${label} has noncanonical spatial sulfur authority`);
  }
  let pathwayCount = 0;
  for (const [pathway, count] of Object.entries(value.nativeSulfurPathways)) {
    const canonicalPathway = pathway === 'null' ? null : pathway;
    if (!EVIDENCE_SULFUR_PATHWAYS.has(canonicalPathway)
        || !Number.isSafeInteger(count) || count <= 0) {
      throw new Error(`[card] ${label} has noncanonical spatial sulfur authority`);
    }
    pathwayCount += count;
  }
  if (pathwayCount !== value.count) {
    throw new Error(`[card] ${label} has incomplete spatial sulfur authority`);
  }
  return value;
};

const assertSulfurReplacementSpatialRow = (row, field, count, transactionIndex) => {
  const numericKeys = [
    'targetValuePerFluid', 'beforeValueTotal',
    'expectedAfterValueTotal', 'afterValueTotal',
    'expectedNet', 'actualNet', 'error', 'tolerance',
  ];
  if (!hasExactKeys(row, [
    'count', 'beforeFiniteCount', 'unit', 'targetValuePerFluid',
    'beforeValueTotal', 'expectedAfterValueTotal', 'scope', 'fluxBasis',
    'afterCount', 'afterFiniteCount',
    'afterValueTotal', 'expectedNet', 'actualNet', 'error', 'tolerance', 'closed',
  ])
      || row.count !== count || row.beforeFiniteCount !== count
      || row.afterCount !== count || row.afterFiniteCount !== count
      || row.unit !== 'mg_per_kg_solvent'
      || row.scope !== 'canonical-wet-voxel-volume'
      || row.fluxBasis !== 'authenticated-net-only; gross-per-voxel-replacement-exchange-not-published'
      || row.closed !== true
      || numericKeys.some((key) => typeof row[key] !== 'number' || !Number.isFinite(row[key]))
      || row.targetValuePerFluid < 0) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} has noncanonical ${field} spatial testimony`);
  }
  const expectedAfter = row.targetValuePerFluid * count;
  const expectedNet = expectedAfter - row.beforeValueTotal;
  const actualNet = row.afterValueTotal - row.beforeValueTotal;
  const error = actualNet - expectedNet;
  const tolerance = Math.max(
    1e-7,
    Math.max(Math.abs(row.beforeValueTotal), Math.abs(row.afterValueTotal)) * 1e-9,
  );
  if (row.tolerance !== tolerance
      || Math.abs(row.expectedAfterValueTotal - expectedAfter) > tolerance
      || Math.abs(row.afterValueTotal - expectedAfter) > tolerance
      || Math.abs(row.expectedNet - expectedNet) > tolerance
      || Math.abs(row.actualNet - actualNet) > tolerance
      || Math.abs(row.error - error) > tolerance
      || Math.abs(error) > tolerance) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} has unauthenticated ${field} spatial closure`);
  }
  return row.targetValuePerFluid;
};

const assertFullyMixedFluidBoundaryAuthority = (transaction, declarations, transactionIndex) => {
  if (typeof transaction.source !== 'string' || !transaction.source.trim()
      || declarations.length !== 1
      || declarations[0].kind !== 'replacement'
      || declarations[0].source !== transaction.source
      || transaction.authority_closed !== true
      || transaction.sulfur_spatial_closed !== true) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} lacks exact replacement authority`);
  }
  const fields = Object.keys(declarations[0].fields).sort();
  const fullFields = [...EVIDENCE_FLUID_BOUNDARY_FIELDS].sort();
  const carbonatePreservedFields = fullFields.filter((field) => field !== 'CO3' && field !== 'pH');
  const exactFieldSet = (expected) => fields.length === expected.length
    && fields.every((field, index) => field === expected[index]);
  if (!exactFieldSet(fullFields) && !exactFieldSet(carbonatePreservedFields)) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} has an incomplete replacement field set`);
  }
  const before = assertFluidAuthorityProjection(
    transaction.authority_before,
    `fully-mixed fluid-boundary transaction ${transactionIndex} before`,
  );
  const target = assertFluidAuthorityProjection(
    transaction.authority_target,
    `fully-mixed fluid-boundary transaction ${transactionIndex} target`,
  );
  const after = assertFluidAuthorityProjection(
    transaction.authority_after,
    `fully-mixed fluid-boundary transaction ${transactionIndex} after`,
  );
  const beforeSpatial = assertFluidAuthoritySpatialState(
    transaction.authority_before_spatial,
    `fully-mixed fluid-boundary transaction ${transactionIndex} before`,
  );
  const afterSpatial = assertFluidAuthoritySpatialState(
    transaction.authority_after_spatial,
    `fully-mixed fluid-boundary transaction ${transactionIndex} after`,
  );
  const targetPathway = target.nativeSulfurPathway == null ? 'null' : target.nativeSulfurPathway;
  if (JSON.stringify(after) !== JSON.stringify(target)
      || beforeSpatial.count !== afterSpatial.count
      || afterSpatial.sulfurPoolsExplicitCount !== (target.sulfurPoolsExplicit ? afterSpatial.count : 0)
      || afterSpatial.sulfateInheritedCount !== (target.sulfateInherited ? afterSpatial.count : 0)
      || !hasExactKeys(afterSpatial.nativeSulfurPathways, [targetPathway])
      || afterSpatial.nativeSulfurPathways[targetPathway] !== afterSpatial.count) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} did not reach its sulfur authority target`);
  }
  if (!hasExactKeys(transaction.sulfur_spatial_testimony, EVIDENCE_SULFUR_REPLACEMENT_FIELDS)) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} lacks complete sulfur spatial testimony`);
  }
  const sulfurTargets = Object.fromEntries(EVIDENCE_SULFUR_REPLACEMENT_FIELDS.map((field) => [
    field,
    assertSulfurReplacementSpatialRow(
      transaction.sulfur_spatial_testimony[field], field, afterSpatial.count, transactionIndex,
    ),
  ]));
  const sulfurTolerance = Math.max(1e-7, Math.abs(sulfurTargets.S) * 1e-9);
  if (target.sulfurPoolsExplicit
      && Math.abs(sulfurTargets.S - sulfurTargets.S_sulfide - sulfurTargets.S_sulfate) > sulfurTolerance) {
    throw new Error(`[card] fully-mixed fluid-boundary transaction ${transactionIndex} has inconsistent explicit sulfur targets`);
  }
  // `before` is retained as event-time testimony even when the local field was
  // heterogeneous. Target/after are the actual physical closure authority.
  return before;
};

const canonicalBoundaryDeclaration = (declaration) => ({
  kind: declaration.kind,
  source: declaration.source,
  fields: Object.fromEntries(Object.entries(declaration.fields).sort(([a], [b]) => a.localeCompare(b))),
});

export function buildFluidBoundaryTestimony(samples, scenarioSpec = null) {
  const transactions = Array.isArray(samples) ? samples : [];
  const carriesRecorderIndex = transactions.some((row) => (
    Object.prototype.hasOwnProperty.call(row || {}, 'sample_index')
  ));
  let previousStep = -1;
  let previousSampleIndex = -1;
  for (const [transactionIndex, transaction] of transactions.entries()) {
    if (!transaction || !['fluid-boundary-v1', 'fully-mixed-fluid-replacement-v1'].includes(transaction.schema)
        || typeof transaction.step !== 'number' || !Number.isSafeInteger(transaction.step)
        || transaction.step < 0
        || transaction.closed !== true
        || transaction.spatial_scope !== 'canonical-wet-voxel-volume'
        || !Array.isArray(transaction.declarations) || !transaction.declarations.length
        || !Array.isArray(transaction.testimony) || !transaction.testimony.length) {
      throw new Error(`[card] fluid-boundary transaction ${transactionIndex} lacks closed canonical spatial testimony`);
    }
    const transactionKeys = transaction.schema === 'fluid-boundary-v1'
      ? ['schema', 'step', 'spatial_scope', 'declarations', 'testimony', 'closed']
      : [
        'schema', 'step', 'spatial_scope', 'declarations', 'testimony', 'source',
        'authority_before', 'authority_before_spatial', 'authority_after',
        'authority_after_spatial', 'authority_target', 'authority_closed',
        'sulfur_spatial_testimony', 'sulfur_spatial_closed', 'closed',
      ];
    const allowedTransactionKeys = Object.prototype.hasOwnProperty.call(transaction, 'sample_index')
      ? [...transactionKeys, 'sample_index'] : transactionKeys;
    const hasSampleIndex = Object.prototype.hasOwnProperty.call(transaction, 'sample_index');
    if (!hasExactKeys(transaction, allowedTransactionKeys)
        || hasSampleIndex !== carriesRecorderIndex
        || (hasSampleIndex
          && (!Number.isSafeInteger(transaction.sample_index)
            || transaction.sample_index < 0
            || transaction.sample_index < previousSampleIndex))
        || transaction.step < previousStep) {
      throw new Error(`[card] fluid-boundary transaction ${transactionIndex} has schema-external fields`);
    }
    previousStep = transaction.step;
    if (hasSampleIndex) previousSampleIndex = transaction.sample_index;
    const declarations = [];
    const declaredFields = new Set();
    for (const declaration of transaction.declarations) {
      if (!hasExactKeys(declaration, ['kind', 'source', 'fields'])
          || !['addition', 'replacement'].includes(declaration.kind)
          || typeof declaration.source !== 'string' || !declaration.source.trim()
          || !declaration.fields || typeof declaration.fields !== 'object'
          || Array.isArray(declaration.fields) || !Object.keys(declaration.fields).length) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} has a noncanonical declaration`);
      }
      for (const [field, value] of Object.entries(declaration.fields)) {
        if (!EVIDENCE_FLUID_BOUNDARY_FIELD_SET.has(field)
            || typeof value !== 'number' || !Number.isFinite(value)
            || (declaration.kind === 'addition' && value <= 0)
            || (declaration.kind === 'replacement' && field !== 'pH' && field !== 'Eh' && value < 0)) {
          throw new Error(`[card] fluid-boundary transaction ${transactionIndex} has a noncanonical declaration`);
        }
        declaredFields.add(field);
      }
      declarations.push(canonicalBoundaryDeclaration(declaration));
    }
    if (transaction.schema === 'fully-mixed-fluid-replacement-v1') {
      assertFullyMixedFluidBoundaryAuthority(transaction, declarations, transactionIndex);
    }
    const testimonyByField = new Map();
    for (const row of transaction.testimony) {
      if (!hasExactKeys(row, [
        'field', 'before', 'after', 'declaredAddition', 'declaredReplacementTarget',
        'declaredDelta', 'declaredImports', 'declaredExports', 'actualDelta',
        'error', 'tolerance', 'unit', 'spatial', 'closed',
      ])
          || typeof row.field !== 'string' || !row.field
          || testimonyByField.has(row.field)) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} has duplicate or noncanonical field testimony`);
      }
      testimonyByField.set(row.field, row);
    }
    if (testimonyByField.size !== declaredFields.size
        || [...declaredFields].some((field) => !testimonyByField.has(field))) {
      throw new Error(`[card] fluid-boundary transaction ${transactionIndex} declaration/testimony fields disagree`);
    }
    for (const field of [...declaredFields].sort()) {
      const row = testimonyByField.get(field);
      const spatial = row?.spatial;
      if (!spatial || typeof spatial !== 'object' || Array.isArray(spatial)) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} field '${field}' lacks closed canonical spatial testimony`);
      }
      const bulkNumericKeys = [
        'before', 'after', 'declaredAddition', 'declaredDelta', 'declaredImports',
        'declaredExports', 'actualDelta', 'error', 'tolerance',
      ];
      if (bulkNumericKeys.some((key) => typeof row?.[key] !== 'number'
          || !Number.isFinite(row[key]))
          || row.unit !== evidenceFluidBoundaryUnit(field)) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} field '${field}' has noncanonical bulk testimony`);
      }
      let expectedBulkAfter = row.before;
      let declaredAddition = 0;
      let replacementTarget = null;
      for (const declaration of declarations) {
        if (!Object.prototype.hasOwnProperty.call(declaration.fields, field)) continue;
        const value = declaration.fields[field];
        if (declaration.kind === 'addition') {
          expectedBulkAfter += value;
          declaredAddition += value;
        } else {
          expectedBulkAfter = value;
          replacementTarget = value;
        }
      }
      const declaredDelta = expectedBulkAfter - row.before;
      const actualDelta = row.after - row.before;
      const bulkError = actualDelta - declaredDelta;
      const bulkTolerance = evidenceLedgerTolerance(row.before, row.after);
      const replacementMatches = replacementTarget === null
        ? row.declaredReplacementTarget === null
        : typeof row.declaredReplacementTarget === 'number'
          && Number.isFinite(row.declaredReplacementTarget)
          && Math.abs(row.declaredReplacementTarget - replacementTarget) <= bulkTolerance;
      if (row.closed !== true || !replacementMatches
          || Math.abs(row.declaredAddition - declaredAddition) > bulkTolerance
          || Math.abs(row.declaredDelta - declaredDelta) > bulkTolerance
          || Math.abs(row.declaredImports - Math.max(0, declaredDelta)) > bulkTolerance
          || Math.abs(row.declaredExports - Math.max(0, -declaredDelta)) > bulkTolerance
          || Math.abs(row.actualDelta - actualDelta) > bulkTolerance
          || Math.abs(row.error - bulkError) > bulkTolerance
          || row.tolerance !== bulkTolerance
          || Math.abs(bulkError) > bulkTolerance) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} field '${field}' has unauthenticated bulk closure`);
      }
      const numericKeys = [
        'beforeValueTotal', 'expectedAfterValueTotal', 'afterValueTotal', 'expectedNet',
        'actualNet', 'error', 'tolerance',
      ];
      const numeric = Object.fromEntries(numericKeys.map((key) => [key, spatial?.[key]]));
      const tolerance = numeric.tolerance;
      const spatialKeys = [
        'count', 'beforeFiniteCount', 'unit', 'beforeValueTotal',
        'expectedAfterValueTotal', 'scope', 'fluxBasis', 'afterCount',
        'afterFiniteCount', 'afterValueTotal', 'expectedNet', 'actualNet',
        'error', 'tolerance', 'closed',
        ...(transaction.schema === 'fully-mixed-fluid-replacement-v1'
          ? ['targetValuePerFluid'] : []),
      ];
      let expectedSpatialAfter = numeric.beforeValueTotal;
      for (const declaration of declarations) {
        if (!Object.prototype.hasOwnProperty.call(declaration.fields, field)) continue;
        const value = declaration.fields[field];
        if (declaration.kind === 'addition') {
          expectedSpatialAfter += value * spatial.count;
        } else {
          expectedSpatialAfter = value * spatial.count;
        }
      }
      const recomputedExpectedNet = expectedSpatialAfter - numeric.beforeValueTotal;
      const recomputedActualNet = numeric.afterValueTotal - numeric.beforeValueTotal;
      const recomputedError = recomputedActualNet - recomputedExpectedNet;
      const spatialTolerance = Math.max(
        1e-7,
        Math.max(Math.abs(numeric.beforeValueTotal), Math.abs(numeric.afterValueTotal)) * 1e-9,
      );
      if (!hasExactKeys(spatial, spatialKeys) || spatial.closed !== true
          || row.closed !== true
          || spatial.scope !== 'canonical-wet-voxel-volume'
          || spatial.fluxBasis !== 'authenticated-net-only; gross-per-voxel-replacement-exchange-not-published'
          || spatial.unit !== row.unit
          || Object.prototype.hasOwnProperty.call(spatial, 'declaredIncreaseTotal')
          || Object.prototype.hasOwnProperty.call(spatial, 'declaredDecreaseTotal')
          || (transaction.schema === 'fully-mixed-fluid-replacement-v1'
            && (typeof spatial.targetValuePerFluid !== 'number'
              || !Number.isFinite(spatial.targetValuePerFluid)
              || replacementTarget === null
              || Math.abs(spatial.targetValuePerFluid - replacementTarget) > spatialTolerance))
          || !Number.isSafeInteger(spatial.count) || spatial.count <= 0
          || spatial.beforeFiniteCount !== spatial.count
          || spatial.afterCount !== spatial.count
          || spatial.afterFiniteCount !== spatial.count
          || numericKeys.some((key) => typeof numeric[key] !== 'number'
            || !Number.isFinite(numeric[key]))
          || tolerance !== spatialTolerance
          || Math.abs(numeric.expectedNet - recomputedExpectedNet) > spatialTolerance
          || Math.abs(numeric.actualNet - recomputedActualNet) > spatialTolerance
          || Math.abs(numeric.error - recomputedError) > spatialTolerance
          || Math.abs(numeric.expectedAfterValueTotal - expectedSpatialAfter) > spatialTolerance
          || Math.abs(numeric.afterValueTotal - numeric.expectedAfterValueTotal) > spatialTolerance
          || Math.abs(recomputedError) > spatialTolerance) {
        throw new Error(`[card] fluid-boundary transaction ${transactionIndex} field '${row?.field || '?'}' lacks closed canonical spatial testimony`);
      }
    }
  }
  const expectedAuthored = (scenarioSpec?.events || [])
    .filter((event) => typeof event?.fluid_boundary_source === 'string'
      && event.fluid_boundary_source.trim())
    .map((event) => {
      if (typeof event.step !== 'number' || !Number.isSafeInteger(event.step)
          || !event.fluid_transform?.add
          || typeof event.fluid_transform.add !== 'object'
          || Array.isArray(event.fluid_transform.add)) {
        throw new Error('[card] authored fluid-boundary event has no canonical addition schema');
      }
      return {
        step: event.step,
        declaration: canonicalBoundaryDeclaration({
          kind: 'addition',
          source: event.fluid_boundary_source,
          fields: event.fluid_transform.add,
        }),
      };
    });
  if (expectedAuthored.length && transactions.length !== expectedAuthored.length) {
    throw new Error('[card] authored fluid-boundary transaction set contains missing or extra rows');
  }
  for (const expected of expectedAuthored) {
    const atStep = transactions.filter((transaction) => transaction.step === expected.step);
    if (atStep.length !== 1 || atStep[0].schema !== 'fluid-boundary-v1'
        || JSON.stringify(atStep[0].declarations.map(canonicalBoundaryDeclaration))
          !== JSON.stringify([expected.declaration])) {
      throw new Error(`[card] authored fluid-boundary step ${expected.step} disagrees with its scenario event`);
    }
  }
  const closedTransactionCount = transactions.filter((row) => row?.closed === true).length;
  return {
    source: 'archived declared non-sulfur fluid-boundary transactions; exact net spatial closure is authenticated by the strip SHA-256; gross per-voxel replacement exchange is intentionally not claimed',
    transaction_count: transactions.length,
    closed_transaction_count: closedTransactionCount,
    all_closed: transactions.length ? closedTransactionCount === transactions.length : null,
    transactions,
  };
}

const MORPHOLOGY_REGIMES = new Set([
  'spiral_smooth', 'stepped_mild', 'stepped_macro',
  'hopper_skeletal', 'dendritic',
]);

function evidenceMorphologyRegime(thresholds, surfaceSigma, label) {
  const keys = ['SPIRAL_MAX', 'STEP_MILD_MAX', 'STEP_MACRO_MAX', 'HOPPER_MAX'];
  if (!thresholds || keys.some((key) => !Number.isFinite(thresholds[key]))) {
    throw new Error(`[card] ${label} has no finite morphology threshold authority`);
  }
  if (surfaceSigma < thresholds.SPIRAL_MAX) return 'spiral_smooth';
  if (surfaceSigma < thresholds.STEP_MILD_MAX) return 'stepped_mild';
  if (surfaceSigma < thresholds.STEP_MACRO_MAX) return 'stepped_macro';
  if (surfaceSigma < thresholds.HOPPER_MAX) return 'hopper_skeletal';
  return 'dendritic';
}

export function buildMorphologyLayerTestimony(layerGrowth, morphRegistry) {
  if (!morphRegistry || typeof morphRegistry !== 'object') {
    throw new Error('[card] missing MORPH_TH registry required to authenticate morphology layers');
  }
  const tenantMinerals = Object.keys(morphRegistry).sort();
  const tenants = new Set(tenantMinerals);
  const lastZoneIndexByCrystal = new Map();
  const lastStepByCrystal = new Map();
  const physicalRemainingByCrystal = new Map();
  for (const [index, row] of layerGrowth.entries()) {
    if (!row || typeof row !== 'object'
        || typeof row.step !== 'number' || !Number.isSafeInteger(row.step) || row.step < 0
        || typeof row.crystal_id !== 'number' || !Number.isSafeInteger(row.crystal_id)
        || row.crystal_id <= 0
        || typeof row.zone_index !== 'number' || !Number.isSafeInteger(row.zone_index)
        || row.zone_index < 0
        || typeof row.mineral !== 'string' || row.mineral.length === 0
        || typeof row.thickness_um !== 'number' || !Number.isFinite(row.thickness_um)
        || typeof row.is_phantom !== 'boolean') {
      throw new Error(`[card] layer ${index} has a noncanonical identity, zone, mineral, thickness, or phantom schema`);
    }
    const lastZoneIndex = lastZoneIndexByCrystal.get(row.crystal_id);
    const lastStep = lastStepByCrystal.get(row.crystal_id);
    if ((lastZoneIndex == null && row.zone_index !== 0)
        || (lastZoneIndex != null && row.zone_index !== lastZoneIndex + 1)) {
      throw new Error(`[card] crystal ${row.crystal_id} layer zone indices are not contiguous from zero`);
    }
    if (lastStep != null && row.step < lastStep) {
      throw new Error(`[card] crystal ${row.crystal_id} layer steps move backward`);
    }
    const priorPhysicalUm = physicalRemainingByCrystal.get(row.crystal_id) || 0;
    const signedPhysicalUm = row.thickness_um > 0
      ? (row.is_phantom ? 0 : row.thickness_um)
      : row.thickness_um;
    const nextPhysicalUm = priorPhysicalUm + signedPhysicalUm;
    const prefixToleranceUm = Math.max(1e-9, Math.abs(priorPhysicalUm) * 1e-12);
    if (nextPhysicalUm < -prefixToleranceUm) {
      throw new Error(`[card] crystal ${row.crystal_id} has a negative physical-solid inventory prefix`);
    }
    lastZoneIndexByCrystal.set(row.crystal_id, row.zone_index);
    lastStepByCrystal.set(row.crystal_id, row.step);
    physicalRemainingByCrystal.set(row.crystal_id, Math.max(0, nextPhysicalUm));
  }
  const positiveLayers = layerGrowth.filter((row) =>
    row.thickness_um > 0 && tenants.has(row.mineral));
  const classifiedLayers = [];
  const unavailableLayers = [];
  const terminalDepletedLayers = [];
  const regimeCounts = {};
  const basisCounts = {};

  for (const row of positiveLayers) {
    const morphology = row?.morphology;
    const label = `${row?.mineral || 'unknown'} crystal ${row?.crystal_id ?? '?'} step ${row?.step ?? '?'}`;
    if (!morphology || typeof morphology !== 'object') {
      throw new Error(`[card] ${label} has positive growth without morphology testimony`);
    }
    if (morphology.status === 'classified') {
      const basis = morphology.sigma_basis;
      const postStepSigma = morphology.post_step_sigma;
      if (!['post-step', 'post-step-terminal-depleted'].includes(basis)
          || !Number.isFinite(postStepSigma)
          || !Number.isFinite(morphology.surface_sigma)
          || !MORPHOLOGY_REGIMES.has(morphology.regime)
          || typeof morphology.form !== 'string' || morphology.form.length === 0
          || morphology.unavailable_reason !== null) {
        throw new Error(`[card] ${label} has incomplete classified morphology testimony`);
      }
      if ((basis === 'post-step-terminal-depleted') !== (postStepSigma < 1)) {
        throw new Error(`[card] ${label} morphology depletion basis disagrees with post-step sigma`);
      }
      const expectedRegime = evidenceMorphologyRegime(
        morphRegistry[String(row.mineral)], morphology.surface_sigma, label,
      );
      if (morphology.regime !== expectedRegime) {
        throw new Error(`[card] ${label} recorded regime disagrees with its threshold authority and surface sigma`);
      }
      classifiedLayers.push(row);
      regimeCounts[morphology.regime] = (regimeCounts[morphology.regime] || 0) + 1;
      basisCounts[basis] = (basisCounts[basis] || 0) + 1;
      if (basis === 'post-step-terminal-depleted') terminalDepletedLayers.push(row);
      continue;
    }
    if (morphology.status === 'unavailable-nonfinite-post-step') {
      if (morphology.sigma_basis !== 'post-step-unavailable'
          || morphology.unavailable_reason !== 'nonfinite-post-step-sigma'
          || morphology.post_step_sigma !== null
          || morphology.surface_sigma !== null
          || morphology.regime !== null
          || morphology.form !== null) {
        throw new Error(`[card] ${label} has malformed unavailable morphology testimony`);
      }
      unavailableLayers.push(row);
      basisCounts['post-step-unavailable'] = (basisCounts['post-step-unavailable'] || 0) + 1;
      continue;
    }
    if (morphology.status === 'unavailable-derived-morphology') {
      const basis = morphology.sigma_basis;
      if (!['post-step', 'post-step-terminal-depleted'].includes(basis)
          || !Number.isFinite(morphology.post_step_sigma)
          || (basis === 'post-step-terminal-depleted') !== (morphology.post_step_sigma < 1)
          || ![
            'nonfinite-effective-sigma-multiplier',
            'nonfinite-surface-sigma',
            'missing-crystallographic-form',
          ].includes(morphology.unavailable_reason)
          || morphology.surface_sigma !== null
          || morphology.regime !== null
          || morphology.form !== null) {
        throw new Error(`[card] ${label} has malformed derived-unavailable morphology testimony`);
      }
      unavailableLayers.push(row);
      basisCounts[basis] = (basisCounts[basis] || 0) + 1;
      continue;
    }
    if (morphology.status === 'unavailable-no-surviving-interface') {
      if (morphology.unavailable_reason !== 'no-surviving-interface-after-same-step-dissolution'
          || morphology.sigma_basis !== 'post-step-no-solid-interface'
          || morphology.post_step_sigma !== null
          || morphology.surface_sigma !== null
          || morphology.regime !== null
          || morphology.form !== null) {
        throw new Error(`[card] ${label} has malformed no-surviving-interface morphology testimony`);
      }
      const sameCrystalThroughStep = layerGrowth.filter((candidate) =>
        candidate.crystal_id === row.crystal_id && candidate.step <= row.step);
      const physicalPositiveUm = sameCrystalThroughStep.reduce((sum, candidate) =>
        sum + (candidate.thickness_um > 0 && candidate.is_phantom === false
          ? candidate.thickness_um : 0), 0);
      const physicalLossUm = sameCrystalThroughStep.reduce((sum, candidate) =>
        sum + (candidate.thickness_um < 0 ? Math.abs(candidate.thickness_um) : 0), 0);
      const sameStepLossUm = layerGrowth.reduce((sum, candidate) =>
        sum + (candidate.crystal_id === row.crystal_id
          && candidate.step === row.step
          && candidate.zone_index > row.zone_index
          && candidate.thickness_um < 0
          ? Math.abs(candidate.thickness_um) : 0), 0);
      const closureToleranceUm = Math.max(1e-9, physicalPositiveUm * 1e-12);
      const remainingSolidUm = physicalPositiveUm - physicalLossUm;
      if (typeof row.remaining_solid_um !== 'number'
          || !Number.isFinite(row.remaining_solid_um)
          || row.remaining_solid_um < 0
          || row.remaining_solid_um > closureToleranceUm
          || !(sameStepLossUm > 0)
          || Math.abs(remainingSolidUm) > closureToleranceUm) {
        throw new Error(`[card] ${label} claims no surviving interface without `
          + 'same-step physical dissolution and signed solid-inventory closure');
      }
      unavailableLayers.push(row);
      basisCounts['post-step-no-solid-interface'] =
        (basisCounts['post-step-no-solid-interface'] || 0) + 1;
      continue;
    }
    throw new Error(`[card] ${label} has an unknown morphology testimony status`);
  }

  return {
    source: 'all positive layers for MORPH_TH-registered minerals; exact rows are authenticated by the strip SHA-256',
    tenant_minerals: tenantMinerals,
    positive_layer_count: positiveLayers.length,
    classified_layer_count: classifiedLayers.length,
    unavailable_layer_count: unavailableLayers.length,
    terminal_depleted_layer_count: terminalDepletedLayers.length,
    regime_counts: regimeCounts,
    basis_counts: basisCounts,
    terminal_depleted_layers: terminalDepletedLayers,
    unavailable_layers: unavailableLayers,
  };
}

function buildExecutedScienceTestimony(strip, science, spec) {
  const pressurePhase = strip.executed_testimony?.pressure_phase || [];
  const stressEvents = strip.executed_testimony?.stress_events || [];
  const transformations = strip.executed_testimony?.transformations || [];
  const carbonateBoundary = strip.executed_testimony?.carbonate_boundary || [];
  const sulfurLedger = strip.executed_testimony?.sulfur_ledger || [];
  const fluidBoundary = strip.executed_testimony?.fluid_boundary || [];
  const enclosures = strip.executed_testimony?.enclosures || [];
  const layerGrowth = strip.executed_testimony?.layer_growth || [];
  const habitMorphology = strip.executed_testimony?.habit_morphology || [];
  const enclosureLifecycle = reduceEnclosureLifecycle(enclosures);
  const al2Counts = {};
  let aragoniteSecureSteps = 0;
  for (const sample of pressurePhase) {
    const phase = sample?.al2sio5?.phase || 'unavailable';
    al2Counts[phase] = (al2Counts[phase] || 0) + 1;
    if (sample?.calcite_aragonite?.secure_aragonite === true) aragoniteSecureSteps++;
  }
  return {
    source: 'archived executed run state; not reconstructed from scenario definition',
    pressure_phase_sample_count: pressurePhase.length,
    fluid_pressure_kbar: sampleStats(pressurePhase, 'fluid_pressure_kbar'),
    confining_pressure_kbar: sampleStats(pressurePhase, 'confining_pressure_kbar'),
    temperature_C: sampleStats(pressurePhase, 'temperature_C'),
    calcite_aragonite: {
      secure_aragonite_steps: aragoniteSecureSteps,
      first: pressurePhase[0]?.calcite_aragonite ?? null,
      last: pressurePhase.at(-1)?.calcite_aragonite ?? null,
    },
    al2sio5: {
      phase_counts: al2Counts,
      first: pressurePhase[0]?.al2sio5 ?? null,
      last: pressurePhase.at(-1)?.al2sio5 ?? null,
    },
    gypsum_anhydrite: {
      first: pressurePhase[0]?.gypsum_anhydrite ?? null,
      last: pressurePhase.at(-1)?.gypsum_anhydrite ?? null,
    },
    stress_events: stressEvents,
    transformations,
    carbonate_boundary: {
      sample_count: carbonateBoundary.length,
      first: carbonateBoundary[0] ?? null,
      last: carbonateBoundary.at(-1) ?? null,
      samples: carbonateBoundary,
    },
    sulfur_ledger: buildSulfurLedgerTestimony(sulfurLedger),
    fluid_boundary: buildFluidBoundaryTestimony(fluidBoundary, spec),
    enclosures: {
      source: 'accepted host-over-guest and later liberation events from the archived executed run',
      event_count: enclosures.length,
      accepted_enclosure_count: enclosureLifecycle.accepted_enclosure_count,
      liberation_count: enclosureLifecycle.liberation_count,
      current_inclusion_count: enclosureLifecycle.current_inclusions.length,
      current_inclusions: enclosureLifecycle.current_inclusions,
      events: enclosures,
    },
    crystal_layers: {
      source: 'accepted growth-zone stack from the archived executed run',
      layer_count: layerGrowth.length,
      formula_layers: layerGrowth.filter((z) => z?.formula_stoichiometry),
      solid_solution_layers: layerGrowth.filter((z) => z?.solid_solution),
      binding_competition_allocations: layerGrowth.filter((z) => z?.competition_allocation),
      reactive_transformation_layers: layerGrowth.filter((z) => z?.transformation_reactivity),
      masked_horizons: layerGrowth.filter((z) => z?.masked_horizon),
      morphology: buildMorphologyLayerTestimony(layerGrowth, science?.MORPH_TH),
    },
    habit_morphology: {
      source: 'final physical crystal state from the archived executed run',
      crystals: habitMorphology,
      surface_films: habitMorphology.filter((crystal) => crystal?.surface_film),
    },
  };
}

function transformationReactivityCommissioning(scenario, strip, artifact) {
  if (!artifact) return null;
  const products = new Set((strip.executed_testimony?.transformations || [])
    .map(event => event?.to)
    .filter(Boolean));
  const finalMinerals = new Set((strip.executed_testimony?.habit_morphology || [])
    .map(crystal => crystal?.mineral)
    .filter(Boolean));
  const controls = (artifact.payload?.transformation_reactivity || [])
    .filter(control => control?.claim_card_scenario === scenario);
  for (const control of controls) {
    if (control.claim_card_link === 'executed-transformation-product'
        && !products.has(control.mineral)) {
      throw new Error(`${scenario}: ${control.mineral} commissioning link lacks an executed transformation product`);
    }
    if (control.claim_card_link === 'executed-surviving-parent'
        && !finalMinerals.has(control.parent_mineral)) {
      throw new Error(`${scenario}: ${control.mineral} commissioning link lacks surviving ${control.parent_mineral}`);
    }
  }
  return {
    role: 'controlled production-engine boundary; not a locality trajectory',
    artifact_schema: artifact.schema,
    artifact_payload_sha256: artifact.payload_sha256,
    link_authority: 'artifact-authored scenario route, verified against executed product or surviving parent',
    controls,
  };
}

export function buildCard(name, spec, strip, science, {
  stripSha256 = null,
  mechanismWitnessArtifact = null,
} = {}) {
  const para = paragenesis(strip);
  const present = new Set(para.map((p) => p.mineral));
  const expects = spec.expects_species || [];
  const deterministicAccessories = normalizeExpectationEntries(spec.deterministic_species);
  const deterministic = [
    ...expects.map((mineral) => ({
      mineral: typeof mineral === 'string' ? mineral : String(mineral?.mineral || ''),
      reason: typeof mineral === 'string' ? 'Authored headline release promise.' : mineral?.reason || null,
      headline: true,
    })),
    ...deterministicAccessories.map((entry) => ({ ...entry, headline: false })),
  ].filter((entry) => entry.mineral);
  const statistical = normalizeExpectationEntries(spec.statistical_species);
  const aspirational = normalizeExpectationEntries(spec.aspirational_species);
  const excludedSpecies = spec.excluded_species || {};
  const authored = new Set([
    ...deterministic.map((entry) => entry.mineral),
    ...statistical.map((entry) => entry.mineral),
    ...aspirational.map((entry) => entry.mineral),
    ...Object.keys(excludedSpecies),
  ]);
  const surprises = para.filter((p) => !authored.has(p.mineral)).map((p) => p.mineral);
  const noShows = deterministic.map((entry) => entry.mineral).filter((m) => !present.has(m));
  const statisticalNoShows = statistical.map((entry) => entry.mineral).filter((m) => !present.has(m));
  const aspirationalNoShows = aspirational.map((entry) => entry.mineral).filter((m) => !present.has(m));
  const excludedAppearances = Object.keys(excludedSpecies).filter((m) => present.has(m));

  const env = {};
  for (const k of ['T', 'pH', 'Eh', 'salinity', 'O2', 'concentration']) {
    const chip = strip.chips[k];
    const quantized = seriesStats(chip);
    const raw = Array.isArray(strip.raw_environment?.[k])
      ? seriesStats({ wall: strip.raw_environment[k], units: chip?.units || quantized?.units || '' })
      : null;
    const st = raw || quantized;
    if (!st) continue;
    st.source = raw ? 'raw_simulation_state' : 'quantized_spatial_chip';
    if (raw && Array.isArray(chip?.range) && chip.range.length === 2) {
      const [rangeMin, rangeMax] = chip.range.map(Number);
      const lower = raw.min < rangeMin;
      const upper = raw.max > rangeMax;
      if (lower || upper) {
        st.quantized_display_clipping = {
          range: [rangeMin, rangeMax],
          lower,
          upper,
          reported_values_use_raw_state: true,
        };
      }
    }
    env[k] = st;
  }
  // saturation drivers present in this scenario's chip set
  const si = {};
  for (const k of Object.keys(strip.chips)) {
    if (k.startsWith('SI_')) { const st = seriesStats(strip.chips[k]); if (st) si[k] = st; }
  }

  return {
    schema: 'vugg-claim-card-v2',
    scenario: name,
    sim_version: strip.sim_version,
    model_digest: strip.model_digest,
    scenario_spec_hash: strip.scenario_spec_hash,
    strip_steps: strip.steps,
    strip_sha256: stripSha256,
    claim: {
      anchor: spec.anchor || null,
      description: spec.description || null,
      expects_species: expects,
      expectation_contract: {
        deterministic,
        deterministic_headline: expects,
        deterministic_accessory: deterministicAccessories,
        statistical,
        aspirational,
      },
      excluded_species: excludedSpecies,
      sources: spec.sources || [],
      claim_citations: spec.claim_citations || [],
      initial_temperature_C: spec.initial?.temperature_C ?? null,
      initial_pressure_kbar: spec.initial?.pressure_kbar ?? null,
      wall_architecture: spec.initial?.wall?.architecture ?? null,
      notes: spec.notes || [],
      authored_science_context: buildScienceDecisions(spec, science),
    },
    testimony: {
      species_count: present.size,
      paragenetic_order: para,
      surprises_not_in_expects: surprises,
      expected_no_shows: noShows,
      statistical_no_shows: statisticalNoShows,
      aspirational_no_shows: aspirationalNoShows,
      excluded_species_appearances: excludedAppearances,
      environment: env,
      saturation_indices: si,
      executed_science: {
        ...buildExecutedScienceTestimony(strip, science, spec),
        transformation_reactivity_commissioning:
          transformationReactivityCommissioning(name, strip, mechanismWitnessArtifact),
      },
    },
  };
}

export function renderMarkdown(card) {
  const c = card.claim, t = card.testimony;
  const L = [];
  L.push(`# CLAIM CARD — ${card.scenario}  (v${card.sim_version}, seed 42, ${card.strip_steps} steps)`);
  L.push('');
  L.push(`**Anchor:** ${c.anchor || '(none)'}`);
  L.push(`**Deposit:** ${c.description || '(none)'}`);
  L.push(`**Initial:** ${c.initial_temperature_C ?? '?'} °C, ${c.initial_pressure_kbar ?? '?'} kbar, wall=${c.wall_architecture || '?'}`);
  const sd = c.authored_science_context;
  L.push(`**Model digest:** ${card.model_digest}`);
  L.push(`**Scenario spec hash:** ${card.scenario_spec_hash}`);
  L.push(`**Archived strip SHA-256:** ${card.strip_sha256 || '(not recorded)'}`);
  L.push('');
  L.push('## Model boundary: calibrated growth budget');
  L.push(`  - Kind: ${sd.growth_budget.kind}`);
  L.push(`  - Basis: ${sd.growth_budget.basis}`);
  L.push(`  - Preserves: ${sd.growth_budget.preserves}`);
  L.push(`  - Limitation: ${sd.growth_budget.limitation}`);
  L.push('');
  L.push('## Expectation contract');
  L.push(`**Deterministic headline (${c.expectation_contract.deterministic_headline.length}):** ${c.expectation_contract.deterministic_headline.join(', ') || '(none)'}`);
  L.push(`**Deterministic accessories (${c.expectation_contract.deterministic_accessory.length}):** ${c.expectation_contract.deterministic_accessory.map((e) => `${e.mineral}${e.reason ? ` — ${e.reason}` : ''}`).join('; ') || '(none)'}`);
  L.push(`**Statistical (${c.expectation_contract.statistical.length}):** ${c.expectation_contract.statistical.map((e) => `${e.mineral}${e.reason ? ` — ${e.reason}` : ''}`).join('; ') || '(none)'}`);
  L.push(`**Aspirational (${c.expectation_contract.aspirational.length}):** ${c.expectation_contract.aspirational.map((e) => `${e.mineral}${e.reason ? ` — ${e.reason}` : ''}`).join('; ') || '(none)'}`);
  const excluded = Object.entries(c.excluded_species || {});
  L.push(`**Locality exclusions (${excluded.length}):** ${excluded.map(([m, reason]) => `${m} — ${reason}`).join('; ') || '(none)'}`);
  L.push('');
  L.push(`**Cited sources:**`);
  for (const s of c.sources) L.push(`  - ${s}`);
  if (!c.sources.length) L.push('  - (none)');
  L.push('');
  L.push('**Claim-level citations:**');
  for (const citation of c.claim_citations || []) {
    L.push(`  - ${citation.claim_id || 'claim'}: ${citation.statement || '(no statement)'} — ${(citation.sources || []).join('; ') || '(no source)'}`);
  }
  if (!(c.claim_citations || []).length) L.push('  - (none authored)');
  L.push('');
  L.push(`## Paragenetic order as grown (${t.species_count} species)`);
  L.push('| # | mineral | first step | nucleations | transformations | pathway |');
  L.push('|--|--|--|--|--|--|');
  t.paragenetic_order.forEach((p, i) => L.push(`| ${i + 1} | ${p.mineral} | ${p.first_step} | ${p.events} | ${p.transformations} | ${p.pathways.join('; ')} |`));
  L.push('');
  L.push(`**Surprises (present but absent from all authored expectation tiers):** ${t.surprises_not_in_expects.join(', ') || '(none)'}`);
  L.push(`**Deterministic no-shows:** ${t.expected_no_shows.join(', ') || '(none)'}`);
  L.push(`**Statistical no-shows (non-failing):** ${t.statistical_no_shows.join(', ') || '(none)'}`);
  L.push(`**Aspirational no-shows (non-failing):** ${t.aspirational_no_shows.join(', ') || '(none)'}`);
  L.push(`**Excluded-locality appearances (failing):** ${t.excluded_species_appearances.join(', ') || '(none)'}`);
  L.push('');
  L.push(`## Environment trajectory (first → last, [min,max])`);
  for (const [k, v] of Object.entries(t.environment)) {
    const clipped = v.quantized_display_clipping
      ? `; quantized display range [${v.quantized_display_clipping.range.join(', ')}] clipped, raw executed state reported`
      : '';
    L.push(`  - ${k}: ${v.first} → ${v.last} ${v.units}  [${v.min}, ${v.max}] (${v.source})${clipped}`);
  }
  L.push('');
  L.push(`## Saturation drivers`);
  for (const [k, v] of Object.entries(t.saturation_indices)) {
    L.push(`  - ${k}: ${v.first} → ${v.last}  [${v.min}, ${v.max}]`);
  }
  L.push('');
  L.push('## Authored pressure/stress/phase context (claim, not run testimony)');
  L.push(`  - Fluid pressure: ${sd.fluid_pressure.initial_kbar ?? 'unspecified'} kbar — ${sd.fluid_pressure.role}`);
  L.push(`  - Rock pressure: ${sd.confining_pressure.initial_kbar ?? 'unspecified'} kbar — ${sd.confining_pressure.role}`);
  const ca = sd.phase_fields.calcite_aragonite;
  L.push(`  - Calcite/aragonite boundary: ${ca.boundary_kbar == null ? 'n/a' : ca.boundary_kbar.toFixed(3) + ' kbar'}; secure aragonite=${ca.secure_aragonite_field ?? 'n/a'}`);
  const al = sd.phase_fields.al2sio5;
  L.push(`  - Al2SiO5: ${al ? `${al.phase} (nominal ${al.nominalPhase || 'n/a'}) — ${al.note}` : 'n/a'}`);
  const gy = sd.phase_fields.gypsum_anhydrite;
  L.push(`  - Gypsum/anhydrite pure-water boundary: ${gy.pure_water_boundary_C == null ? 'n/a' : gy.pure_water_boundary_C.toFixed(2) + ' °C'}; initial a_w=${gy.initial_water_activity.value.toFixed(3)} ±${gy.initial_water_activity.uncertainty.toFixed(3)} (${gy.initial_water_activity.status})`);
  L.push(`  - Ksp pressure rule: ${sd.pressure_ksp_grid.rule}`);
  for (const [mineral, assessment] of Object.entries(sd.pressure_ksp_grid.assessments)) {
    L.push(`    - ${mineral}: ${assessment.status}; active=${assessment.active}; ΔlogK=${assessment.correctionLog10K}; ${assessment.note}`);
  }
  if (sd.differential_stress_events.length) {
    for (const e of sd.differential_stress_events) L.push(`  - Stress/overprint step ${e.step}: ${e.type} — ${e.decision.model}`);
  } else {
    L.push('  - Differential stress: no authored stress event.');
  }
  L.push('');
  const ex = t.executed_science;
  L.push('## Executed pressure/stress/phase testimony (archived run)');
  L.push(`**Source:** ${ex.source}`);
  const fmtStats = (v, units) => v
    ? `${v.first} → ${v.last} ${units} [${v.min}, ${v.max}], n=${v.samples}`
    : 'not recorded';
  L.push(`  - Fluid pressure: ${fmtStats(ex.fluid_pressure_kbar, 'kbar')}`);
  L.push(`  - Rock/confining pressure: ${fmtStats(ex.confining_pressure_kbar, 'kbar')}`);
  L.push(`  - Temperature: ${fmtStats(ex.temperature_C, '°C')}`);
  L.push(`  - Secure aragonite assessment: ${ex.calcite_aragonite.secure_aragonite_steps}/${ex.pressure_phase_sample_count} executed steps; first=${JSON.stringify(ex.calcite_aragonite.first)}, last=${JSON.stringify(ex.calcite_aragonite.last)}`);
  L.push(`  - Al2SiO5 executed phase counts: ${JSON.stringify(ex.al2sio5.phase_counts)}; first=${ex.al2sio5.first?.phase || 'n/a'}, last=${ex.al2sio5.last?.phase || 'n/a'}`);
  if (ex.stress_events.length) {
    for (const e of ex.stress_events) {
      const counts = {};
      for (const r of (e.evaluated_crystals || [])) counts[r.outcome] = (counts[r.outcome] || 0) + 1;
      L.push(`  - Executed stress step ${e.step}: σdiff=${e.sigma_diff_mpa} MPa; affected crystal IDs=[${(e.twinned_crystal_ids || []).join(', ')}]; outcomes=${JSON.stringify(counts)}`);
    }
  } else {
    L.push('  - Executed stress: no stress event recorded by the run.');
  }
  if (ex.transformations.length) {
    for (const e of ex.transformations) {
      L.push(`  - Transformation step ${e.step}: ${e.from} → ${e.to} (${e.mechanism}); `
        + `dehydration=${JSON.stringify(e.dehydration || null)}; phase-replacement=${JSON.stringify(e.phase_replacement || null)}`);
    }
  } else {
    L.push('  - Mineral transformations: none executed.');
  }
  const commissioning = ex.transformation_reactivity_commissioning;
  if (commissioning) {
    L.push(`  - Transformation reactivity commissioning: ${commissioning.role}; `
      + `artifact ${commissioning.artifact_schema}/${commissioning.artifact_payload_sha256}.`);
    if (commissioning.controls.length) {
      for (const control of commissioning.controls) {
        L.push(`    - ${control.mineral}: neutral positive growth=${control.positive_growth_above_boundary}; `
          + `acid boundary pH ${control.pH_threshold}, control pH ${control.control_pH}; `
          + `etch=${control.accepted_etch.thickness_um} µm; `
          + `formula=${JSON.stringify(control.parent_shell.formula_stoichiometry)}; `
          + `returned=${JSON.stringify(control.accepted_etch.returned_budget_inventory)}; `
          + `closure error=${JSON.stringify(control.closure_error_ppm)}.`);
      }
    } else {
      L.push('    - No controlled reactivity witness is applicable to a transformation product in this locality run.');
    }
  }
  if (ex.carbonate_boundary.sample_count) {
    const first = ex.carbonate_boundary.first;
    const last = ex.carbonate_boundary.last;
    const failed = ex.carbonate_boundary.samples.filter(sample => sample?.last_transaction?.ok === false).length;
    L.push(`  - Conserved carbonate boundary: ${ex.carbonate_boundary.sample_count} samples; `
      + `mode ${first.mode}→${last.mode}; DIC ${first.dic_mol_kg}→${last.dic_mol_kg} mol/kg; `
      + `export ${last.boundary_export_mol_kg} mol/kg; reduced alkalinity ${last.reduced_alkalinity_eq_kg} eq/kg; `
      + `blocked=${last.blocked}; failed latest transactions=${failed}; uncertainties=${JSON.stringify(last.uncertainties || [])}`);
  } else {
    L.push('  - Conserved carbonate boundary: not enabled for this archived run.');
  }
  const fluidBoundary = ex.fluid_boundary;
  L.push('');
  L.push('## Declared non-sulfur fluid-boundary transactions (archived run)');
  L.push(`**Source:** ${fluidBoundary.source}`);
  if (fluidBoundary.transaction_count) {
    L.push(`  - Closure: ${fluidBoundary.closed_transaction_count}/${fluidBoundary.transaction_count} transactions; `
      + `all_closed=${fluidBoundary.all_closed}.`);
    for (const tx of fluidBoundary.transactions) {
      L.push(`  - Step ${tx.step}: closed=${tx.closed}; declarations=${JSON.stringify(tx.declarations || [])}; `
        + `testimony=${JSON.stringify(tx.testimony || [])}.`);
    }
  } else {
    L.push('  - No declared non-sulfur fluid-boundary transaction was executed.');
  }
  const enclosures = ex.enclosures;
  L.push('');
  L.push('## Crystal enclosure receipts (archived run)');
  L.push(`**Source:** ${enclosures.source}`);
  if (enclosures.event_count) {
    for (const receipt of enclosures.events) {
      if (receipt.event === 'liberated') {
        L.push(`  - Step ${receipt.step}: ${receipt.guest_mineral} #${receipt.guest_crystal_id} liberated `
          + `from ${receipt.host_mineral} #${receipt.host_crystal_id}; original enclosure step=`
          + `${receipt.enclosure_step}; host size/threshold/current=`
          + `${receipt.host_size_at_enclosure_um}/${receipt.liberation_threshold_um}/`
          + `${receipt.host_current_growth_um} µm; host still solid=${receipt.host_still_has_solid}; `
          + `front-film contribution removed=${receipt.front_film_contribution_removed}.`);
      } else {
        L.push(`  - Step ${receipt.step}: ${receipt.host_mineral} #${receipt.host_crystal_id} enclosed `
          + `${receipt.guest_mineral} #${receipt.guest_crystal_id}; route=${receipt.route}; `
          + `host net layer=${receipt.host_same_step_net_growth_um} µm; `
          + `distance/reach=${receipt.anchor_distance_mm}/${receipt.footprint_reach_mm} mm; `
          + `size ratio=${receipt.size_ratio}; guest recent=${receipt.guest_recent_growth_um} µm; `
          + `guest core/loss/remaining=${receipt.guest_positive_core_um}/${receipt.guest_loss_um}/`
          + `${receipt.guest_remaining_growth_um} µm; partial loss=${receipt.guest_partially_dissolved}.`);
      }
    }
    L.push(`  - Final inclusion status: ${enclosures.current_inclusion_count} current; `
      + `${enclosures.accepted_enclosure_count} accepted and ${enclosures.liberation_count} liberated.`);
  } else {
    L.push('  - No host-over-guest enclosure was accepted in this run.');
  }
  const sulfur = ex.sulfur_ledger;
  L.push('');
  L.push('## Sulfur reservoir identity and conservation (archived run)');
  L.push(`**Source:** ${sulfur.source}`);
  if (sulfur.sample_count) {
    if (sulfur.activation) {
      L.push(`  - Ledger activation: step ${sulfur.activation.step}, kind=${sulfur.activation.kind}, `
        + `closed=${sulfur.activation.closed}; initial fluid=${sulfur.activation.fluidInitialPpm} ppm; `
        + `initial solid=${sulfur.activation.solidInitialPpm} ppm.`);
    }
    L.push(`  - Closure: ${sulfur.closed_sample_count}/${sulfur.sample_count} samples; `
      + `all_closed=${sulfur.all_closed}; max |balance error|=${sulfur.max_abs_balance_error_ppm} ppm; `
      + `max |testimony error|=${sulfur.max_abs_testimony_error_ppm} ppm.`);
    L.push(`  - Fluid reservoirs (sulfide/sulfate/elemental), first → last: `
      + `${JSON.stringify(sulfur.first_fluid_reservoir_ppm)} → ${JSON.stringify(sulfur.last_fluid_reservoir_ppm)}.`);
    L.push(`  - Solid reservoirs, first → last: `
      + `${JSON.stringify(sulfur.first_solid_reservoir_ppm)} → ${JSON.stringify(sulfur.last_solid_reservoir_ppm)}.`);
    L.push(`  - Phase identities: ${sulfur.phase_identities.length
      ? sulfur.phase_identities.map((phase) => `${phase.mineral}→${phase.reservoir}`).join(', ')
      : '(no sulfur-bearing solid booked)'}.`);
  } else {
    L.push('  - Sulfur ledger: explicit valence-resolved sulfur pools were not enabled for this scenario.');
  }
  L.push('');
  L.push('## Layer, solid-solution, competition, and habit testimony');
  const layers = ex.crystal_layers;
  L.push(`  - Accepted layers: ${layers.layer_count}; formula-bearing=${layers.formula_layers.length}; `
    + `solid-solution=${layers.solid_solution_layers.length}; binding competition=${layers.binding_competition_allocations.length}; `
    + `reactive transformation etches=${layers.reactive_transformation_layers.length}; `
    + `masked horizons=${layers.masked_horizons.length}.`);
  const morphology = layers.morphology;
  L.push(`  - Registered-mineral morphology: positive=${morphology.positive_layer_count}; `
    + `classified=${morphology.classified_layer_count}; unavailable=${morphology.unavailable_layer_count}; `
    + `terminal-depleted=${morphology.terminal_depleted_layer_count}; `
    + `regimes=${JSON.stringify(morphology.regime_counts)}; bases=${JSON.stringify(morphology.basis_counts)}.`);
  for (const row of morphology.terminal_depleted_layers) {
    L.push(`  - Terminal-depleted morphology crystal ${row.crystal_id}, step ${row.step}: ${row.mineral}; `
      + `post-step sigma=${row.morphology.post_step_sigma}; surface sigma=${row.morphology.surface_sigma}; `
      + `regime=${row.morphology.regime}; form=${row.morphology.form}.`);
  }
  for (const row of morphology.unavailable_layers) {
    L.push(`  - Unavailable morphology crystal ${row.crystal_id}, step ${row.step}: ${row.mineral}; `
      + `${row.morphology.status}/${row.morphology.unavailable_reason} `
      + `(${row.morphology.sigma_basis}).`);
  }
  for (const row of layers.solid_solution_layers) {
    L.push(`  - Solid-solution layer crystal ${row.crystal_id}, step ${row.step}: ${row.mineral}; `
      + `formula=${JSON.stringify(row.formula_stoichiometry)}; model=${JSON.stringify(row.solid_solution)}.`);
  }
  for (const row of layers.binding_competition_allocations) {
    L.push(`  - Competition crystal ${row.crystal_id}, step ${row.step}: ${row.mineral}; `
      + `${JSON.stringify(row.competition_allocation)}.`);
  }
  for (const row of layers.masked_horizons) {
    L.push(`  - Masked horizon crystal ${row.crystal_id}, film step ${row.originating_film_step}, `
      + `breakthrough step ${row.step}: ${row.mineral} through ${row.film_mineral}; `
      + `coverage term/prism=${row.masked_phi_term}/${row.masked_phi_prism}; thickness=${row.thickness_um} µm.`);
  }
  for (const crystal of ex.habit_morphology.crystals) {
    L.push(`  - Habit crystal ${crystal.crystal_id}: ${crystal.mineral}; ${crystal.habit}; `
      + `extent=${crystal.extent_kind}; forms=${JSON.stringify(crystal.dominant_forms)}; `
      + `size authority=${JSON.stringify(crystal.size_authority)}; CDR=${JSON.stringify(crystal.cdr_replacement_evidence)}.`);
  }
  for (const crystal of ex.habit_morphology.surface_films) {
    L.push(`  - Surviving surface film crystal ${crystal.crystal_id}: ${crystal.mineral}; `
      + `${JSON.stringify(crystal.surface_film)}.`);
  }
  L.push('');
  L.push(`## Scenario notes (author's own rationale)`);
  for (const n of c.notes) L.push(`> ${n}\n`);
  return L.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.length === 0) {
    console.log('node tools/review-claim-card.mjs <scenario> [--version N] [--json]');
    console.log('node tools/review-claim-card.mjs --all [--version N] [--out DIR]');
    return;
  }
  const all = argv.includes('--all');
  const asJson = argv.includes('--json');
  const vIdx = argv.indexOf('--version');
  const version = vIdx >= 0 ? parseInt(argv[vIdx + 1], 10) : latestStripVersion();
  const oIdx = argv.indexOf('--out');
  const outDir = oIdx >= 0 ? argv[oIdx + 1] : null;
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] === '--version') && !(argv[i - 1] === '--out'));

  const h = await import(pathToFileURL(path.join(ROOT, 'tools', '_harness.mjs')).href);
  const science = await h.loadSimBundle({
    toolName: 'review-claim-card',
    extraExports: [
      'calciteAragoniteBoundaryKbar', 'aragoniteIsPressureStable',
      'al2sio5PhaseAssessment', 'gypsumAnhydriteBoundaryC',
      'waterActivityAssessment', 'thermoPressureAssessment',
      'STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE',
      'MORPH_TH',
    ],
  });
  const { SCENARIOS } = science;
  const stripDir = path.join(ROOT, 'archive', 'strips', `v${version}`);
  const mechanismPath = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${version}.json`);
  if (!fs.existsSync(mechanismPath)) {
    throw new Error(`[card] missing authenticated mechanism witness artifact for v${version}`);
  }
  const mechanismWitnessArtifact = JSON.parse(fs.readFileSync(mechanismPath, 'utf8'));
  verifyMechanismWitnessArtifact(ROOT, mechanismWitnessArtifact, {
    simVersion: science.SIM_VERSION,
    modelDigest: science.MODEL_DIGEST,
  });

  const names = all
    ? fs.readdirSync(stripDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort()
    : positional;

  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  for (const name of names) {
    const spec = SCENARIOS[name]?._json5_spec;
    const stripPath = path.join(stripDir, `${name}.json`);
    if (!spec) { console.error(`[card] no scenario def for ${name}`); continue; }
    if (!fs.existsSync(stripPath)) { console.error(`[card] no strip v${version} for ${name}`); continue; }
    const stripRaw = fs.readFileSync(stripPath);
    const strip = JSON.parse(stripRaw.toString('utf8'));
    if (version !== science.SIM_VERSION) {
      throw new Error(`[card] requested v${version}, but the loaded science bundle is v${science.SIM_VERSION}; historical cards require their historical science bundle`);
    }
    const scenarioSpecHash = crypto.createHash('sha256')
      .update(JSON.stringify(spec))
      .digest('hex');
    assertStripIdentity(strip, {
      version,
      modelDigest: science.MODEL_DIGEST,
      scenario: name,
      seed: 42,
      scenarioSpecHash,
    });
    const stripSha256 = crypto.createHash('sha256').update(stripRaw).digest('hex');
    const card = buildCard(name, spec, strip, science, {
      stripSha256,
      mechanismWitnessArtifact,
    });
    if (outDir) {
      fs.writeFileSync(path.join(outDir, `${name}.md`), renderMarkdown(card).trimEnd() + '\n');
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(card, null, 2) + '\n');
    } else if (asJson) {
      console.log(JSON.stringify(card, null, 2));
    } else {
      console.log(renderMarkdown(card));
      if (names.length > 1) console.log('\n' + '='.repeat(80) + '\n');
    }
  }
  if (outDir) console.log(`[card] wrote ${names.length} cards → ${path.relative(ROOT, outDir)}`);
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
