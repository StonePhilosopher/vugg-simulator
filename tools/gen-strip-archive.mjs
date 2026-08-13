#!/usr/bin/env node
/**
 * tools/gen-strip-archive.mjs — archive the full strip STORY of the
 * canonical seed-42 vugg, one file per scenario, one folder per
 * SIM_VERSION:  archive/strips/v<N>/<scenario>.json
 *
 * WHY (boss directive, 2026-06-12): every rebake and probe run generates
 * the strip dataset — the per-step chemistry trajectories and the
 * nucleation record that the strip view draws and the sonifier plays —
 * and until now we threw it away, keeping only species COUNTS
 * (seed42_v*.json) and an 8-sample tripwire digest of 12 scenarios
 * (strip_digest_v*.json). The strips ARE the story of each version's
 * canonical vugg; this tool keeps them. The archive preserves the record
 * as it WAS, errors included — a v194 strip with the confabulated mvt
 * silver bells is part of the history, not something to regenerate away.
 *
 * WHAT IS KEPT vs the raw recorder dataset (~26 MB/scenario quantized):
 *   - every chip in the manifest, FULL step series (no subsampling),
 *     dequantized to real units, rounded to 3 decimals;
 *   - dense chips: angle-averaged at mid-height, at wall AND center
 *     depth (center stored as "same_as_wall" when byte-identical — most
 *     scenarios' chemistry is depth-uniform and this halves the file);
 *   - sparse crystal-anchored morph chips: max over angle x height at
 *     the wall (same convention as the digest — interior voxels never
 *     carry a morph ordinal);
 *   - nucleation_events VERBATIM (the bells);
 *   - manifest metadata (axes, chip labels/units/ranges, recorded_at).
 * What is dropped: the angular x height spatial texture and floor_data
 * (the substrate layer). The temporal narrative survives whole.
 *
 * Run AFTER the SIM_VERSION bump (same footgun as gen-js-baseline:
 * the folder is named from the CURRENT SIM_VERSION). Exact-bundle receipts in
 * .local-evidence resume completed stories; --force recomputes the selection
 * and --fresh discards the current receipt set. There is deliberately no
 * adoption escape hatch: only an execution by the exact bundle may mint its
 * receipt.
 *
 *   1. bump SIM_VERSION  2. npm run build  3. node tools/gen-strip-archive.mjs
 *
 * During a pre-commit review loop, a correction confined to one scenario may
 * refresh only that story after the full version archive exists:
 *   node tools/gen-strip-archive.mjs --scenario <id> --force
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import { assertStripIdentity, canonicalStripRecordedAt } from './strip-identity.mjs';
import { evidenceBundleDigest } from './locality-frequency-checkpoint.mjs';
import { nodeRuntimeDigest, producerContractDigest, runtimeExecutionDigest } from './evidence-runtime.mjs';
import {
  evidenceIdentity,
  loadScenarioReceipt,
  prepareEvidenceCheckpointDirectory,
  scenarioReceipt,
  scenarioSpecHash,
  sha256File,
  writeJsonAtomic,
} from './scenario-evidence-checkpoint.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FORCE = process.argv.includes('--force');
const FRESH = process.argv.includes('--fresh');
const SCENARIO_FLAG = process.argv.indexOf('--scenario');
const ONLY_SCENARIO = SCENARIO_FLAG >= 0 ? process.argv[SCENARIO_FLAG + 1] : null;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (['--force', '--fresh'].includes(arg)) continue;
  if (arg === '--scenario') { i++; continue; }
  throw new Error(`unknown argument: ${arg}`);
}

const { SIM_VERSION, MODEL_DIGEST, SCENARIOS, VugSimulator, setSeed, StripRecorder, stripDataIndex, stripDequantize } =
  await loadSimBundle({
    toolName: 'gen-strip-archive',
    extraExports: ['StripRecorder', 'stripDataIndex', 'stripDequantize'],
  });

const OUT_DIR = path.join(ROOT, 'archive', 'strips', `v${SIM_VERSION}`);
const checkpointDir = prepareEvidenceCheckpointDirectory(ROOT, evidenceIdentity({
  kind: 'strip-archive',
  simVersion: SIM_VERSION,
  modelDigest: MODEL_DIGEST,
  bundleDigest: evidenceBundleDigest(ROOT),
  executionDigest: runtimeExecutionDigest(ROOT),
  producerDigest: producerContractDigest(ROOT, 'strip-archive'),
  runtimeDigest: nodeRuntimeDigest(),
  seed: 42,
}), { fresh: FRESH });

// Sparse crystal-anchored ordinal chips read as max-over-space (mirrors
// STRIP_DIGEST_SPARSE_MAX_CHIPS in strip-digest-shape.mjs — keep in sync
// when a new morph tenant lands).
const SPARSE_MAX_CHIPS = new Set([
  'calcite_morph', 'halite_morph', 'sylvite_morph',
  'bismuth_morph', 'fluorite_morph', 'pyrite_morph',
]);

const round3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

function denseSeries(ds, chipIdx, depth) {
  const axes = ds.manifest.axes;
  const C = ds.manifest.chips.length;
  const meta = ds.manifest.chips[chipIdx];
  const height = axes.height_positions >> 1;
  const out = [];
  for (let step = 0; step < axes.steps; step++) {
    let sum = 0, n = 0;
    for (let a = 0; a < axes.angular_indices; a++) {
      const li = stripDataIndex(step, a, height, chipIdx, axes, C, depth);
      if (li < 0) continue;
      const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
      if (v != null) { sum += v; n++; }
    }
    out.push(n ? round3(sum / n) : null);
  }
  return out;
}

function sparseMaxSeries(ds, chipIdx, depth) {
  const axes = ds.manifest.axes;
  const C = ds.manifest.chips.length;
  const meta = ds.manifest.chips[chipIdx];
  const out = [];
  for (let step = 0; step < axes.steps; step++) {
    let best = null;
    for (let h = 0; h < axes.height_positions; h++) {
      for (let a = 0; a < axes.angular_indices; a++) {
        const li = stripDataIndex(step, a, h, chipIdx, axes, C, depth);
        if (li < 0) continue;
        const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
        if (v != null && (best == null || v > best)) best = v;
      }
    }
    out.push(round3(best));
  }
  return out;
}

function archiveScenario(name, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const steps = defaultSteps ?? 100;
  const sim = new VugSimulator(conditions, events);
  const rec = new StripRecorder(sim, { duration_steps: steps, notes: `archive ${name}` });
  sim._stripRecorder = rec;
  // Preserve exact executed global state alongside the quantized spatial chips.
  // Chip ranges are visualization ranges and may clamp extreme values (sabkha
  // salinity reaches an authored 250 psu while its helix display tops at 200).
  // Review testimony must never mistake that display clamp for measured state.
  const rawEnvironment = Object.fromEntries(
    ['T', 'pH', 'Eh', 'salinity', 'O2', 'concentration'].map((key) => [key, []]),
  );
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const fluid = sim.conditions?.fluid || {};
    rawEnvironment.T.push(Number.isFinite(Number(sim.conditions?.temperature))
      ? Number(sim.conditions.temperature) : null);
    for (const key of ['pH', 'Eh', 'salinity', 'O2', 'concentration']) {
      rawEnvironment[key].push(Number.isFinite(Number(fluid[key])) ? Number(fluid[key]) : null);
    }
  }
  const ds = rec.finalize();

  const D = (ds.manifest.axes.depth_positions && ds.manifest.axes.depth_positions > 0)
    ? ds.manifest.axes.depth_positions : 1;
  const chips = {};
  for (let ci = 0; ci < ds.manifest.chips.length; ci++) {
    const meta = ds.manifest.chips[ci];
    const sparse = SPARSE_MAX_CHIPS.has(meta.id);
    const entry = {
      label: meta.label, system: meta.system, units: meta.units, range: meta.range,
    };
    if (sparse) {
      entry.read = 'max_over_angle_height';
      entry.wall = sparseMaxSeries(ds, ci, 0);
    } else {
      entry.read = 'mean_over_angle_at_mid_height';
      entry.wall = denseSeries(ds, ci, 0);
      if (D > 1) {
        const center = denseSeries(ds, ci, D - 1);
        entry.center = (JSON.stringify(center) === JSON.stringify(entry.wall))
          ? 'same_as_wall' : center;
      }
    }
    chips[meta.id] = entry;
  }

  const scenarioSpecHashValue = crypto.createHash('sha256')
    .update(JSON.stringify(SCENARIOS[name]?._json5_spec ?? null))
    .digest('hex');
  const story = {
    format: 'strip-story-v2',
    sim_version: ds.manifest.sim_version,
    model_digest: ds.manifest.model_digest,
    scenario: name,
    scenario_spec_hash: scenarioSpecHashValue,
    seed,
    // Wall-clock time is operational metadata, not scientific state. A
    // canonical seed/bundle rebake must be byte-identical on another day.
    recorded_at: canonicalStripRecordedAt(ds.manifest.recorded_at),
    steps: ds.manifest.axes.steps,
    depth_positions: D,
    raw_environment: rawEnvironment,
    chips,
    nucleation_events: ds.nucleation_events,
    executed_testimony: {
      pressure_phase: ds.pressure_phase_testimony || [],
      stress_events: ds.stress_event_testimony || [],
      transformations: ds.transformation_event_testimony || [],
      carbonate_boundary: ds.carbonate_boundary_testimony || [],
    },
  };
  return assertStripIdentity(story, {
    version: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenario: name,
    seed,
    scenarioSpecHash: scenarioSpecHashValue,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let totalBytes = 0;
if (ONLY_SCENARIO && !SCENARIOS[ONLY_SCENARIO]) {
  throw new Error(`[gen-strip-archive] unknown scenario: ${ONLY_SCENARIO}`);
}
const names = ONLY_SCENARIO ? [ONLY_SCENARIO] : Object.keys(SCENARIOS).sort();
for (const name of names) {
  const outPath = path.join(OUT_DIR, `${name}.json`);
  const { defaultSteps } = SCENARIOS[name]();
  const expected = {
    id: name,
    specHash: scenarioSpecHash(SCENARIOS[name]._json5_spec),
    durationSteps: defaultSteps ?? 100,
    seed: 42,
    artifactPath: outPath,
  };
  const checkpointPath = path.join(checkpointDir, `${name}.json`);
  const checkpoint = FORCE ? null : loadScenarioReceipt(checkpointPath, expected);
  if (checkpoint) {
    const story = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assertStripIdentity(story, {
      version: SIM_VERSION,
      modelDigest: MODEL_DIGEST,
      scenario: name,
      seed: 42,
      scenarioSpecHash: expected.specHash,
    });
    totalBytes += fs.statSync(outPath).size;
    console.log(`  ${name.padEnd(28)} ${String(story.steps).padStart(3)} steps, `
      + `${Object.keys(story.chips).length} chips, ${story.nucleation_events.length} nucleations [resumed]`);
    continue;
  }
  const story = archiveScenario(name, 42);
  writeJsonAtomic(outPath, story);
  const bytes = fs.statSync(outPath).size;
  totalBytes += bytes;
  writeJsonAtomic(checkpointPath, scenarioReceipt({
    id: name,
    specHash: expected.specHash,
    durationSteps: expected.durationSteps,
    seed: expected.seed,
    artifactSha256: sha256File(outPath),
  }));
  console.log(`  ${name.padEnd(28)} ${String(story.steps).padStart(3)} steps, `
    + `${Object.keys(story.chips).length} chips, ${story.nucleation_events.length} nucleations, `
    + `${(bytes / 1024).toFixed(0)} KB`);
}
console.log(`\n[gen-strip-archive] wrote ${names.length} stories to `
  + `${path.relative(ROOT, OUT_DIR)} (${(totalBytes / 1024 / 1024).toFixed(1)} MB total)`);
