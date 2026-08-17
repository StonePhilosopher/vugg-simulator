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

function buildExecutedScienceTestimony(strip) {
  const pressurePhase = strip.executed_testimony?.pressure_phase || [];
  const stressEvents = strip.executed_testimony?.stress_events || [];
  const transformations = strip.executed_testimony?.transformations || [];
  const carbonateBoundary = strip.executed_testimony?.carbonate_boundary || [];
  const sulfurLedger = strip.executed_testimony?.sulfur_ledger || [];
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
  };
}

export function buildCard(name, spec, strip, science, { stripSha256 = null } = {}) {
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
      executed_science: buildExecutedScienceTestimony(strip),
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
      L.push(`  - Transformation step ${e.step}: ${e.from} → ${e.to} (${e.mechanism})`);
    }
  } else {
    L.push('  - Mineral transformations: none executed.');
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
    ],
  });
  const { SCENARIOS } = science;
  const stripDir = path.join(ROOT, 'archive', 'strips', `v${version}`);

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
    const card = buildCard(name, spec, strip, science, { stripSha256 });
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
