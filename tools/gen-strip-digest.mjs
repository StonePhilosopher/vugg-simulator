#!/usr/bin/env node
/**
 * tools/gen-strip-digest.mjs — write the strip-view chemistry-trajectory
 * tripwire baseline to tests-js/baselines/strip_digest_v<N>.json.
 *
 * Companion to tests-js/strip-digest.test.ts (the tripwire) the way
 * gen-js-baseline.mjs is to calibration.test.ts. Reduces each already
 * authenticated canonical strip story to a compact digest (per key chip:
 * {min,max,samples[8]} at wall + center) and writes it keyed to the current
 * SIM_VERSION. The archive is the full-fidelity authority, so this stage must
 * never replay the same geology a third time.
 *
 * Run after any change that legitimately shifts a recorded trajectory
 * (engine change with a SIM_VERSION bump, OR a recording-layer change such
 * as a chip-read fix — those don't bump SIM_VERSION but DO move the digest):
 *   1. npm run build
 *   2. node tools/gen-strip-digest.mjs
 *   3. Inspect the diff vs the previous strip_digest_v*.json (it's
 *      human-readable: which chip's min/max/samples moved, at which depth).
 *   4. Commit the new baseline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';
import {
  STRIP_DIGEST_SCENARIOS,
  stripDigestForStory,
} from './strip-digest-shape.mjs';
import { assertStripIdentity } from './strip-identity.mjs';
import { evidenceBundleDigest } from './locality-frequency-checkpoint.mjs';
import {
  assertCommissionedEvidenceRuntime,
  nodeRuntimeDigest,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';
import {
  assertEvidenceCheckpointDirectory,
  evidenceIdentity,
  requireScenarioReceipt,
  scenarioSpecHash,
  writeJsonAtomic,
} from './scenario-evidence-checkpoint.mjs';

assertCommissionedEvidenceRuntime();

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

const { SIM_VERSION, MODEL_DIGEST, SCENARIOS } =
  await loadSimBundle({ toolName: 'gen-strip-digest' });
const checkpointDir = assertEvidenceCheckpointDirectory(ROOT, evidenceIdentity({
  kind: 'strip-archive',
  simVersion: SIM_VERSION,
  modelDigest: MODEL_DIGEST,
  bundleDigest: evidenceBundleDigest(ROOT),
  executionDigest: runtimeExecutionDigest(ROOT),
  producerDigest: producerContractDigest(ROOT, 'strip-archive'),
  runtimeDigest: nodeRuntimeDigest(),
  seed: 42,
}));

const digest = { sim_version: SIM_VERSION, model_digest: MODEL_DIGEST, seed: 42, scenarios: {} };
for (const name of STRIP_DIGEST_SCENARIOS) {
  if (!SCENARIOS[name]) {
    console.log(`  ${name.padEnd(28)} (not registered — skipped)`);
    continue;
  }
  const storyPath = path.join(ROOT, 'archive', 'strips', `v${SIM_VERSION}`, `${name}.json`);
  const { defaultSteps } = SCENARIOS[name]();
  const specHash = scenarioSpecHash(SCENARIOS[name]._json5_spec);
  requireScenarioReceipt(path.join(checkpointDir, `${name}.json`), {
    id: name,
    specHash,
    durationSteps: defaultSteps ?? 100,
    seed: 42,
    artifactPath: storyPath,
  });
  const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
  assertStripIdentity(story, {
    version: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenario: name,
    seed: 42,
    scenarioSpecHash: specHash,
  });
  digest.scenarios[name] = stripDigestForStory(story);
  const chips = Object.keys(digest.scenarios[name].chips).length;
  console.log(`  ${name.padEnd(28)} ${String(story.steps).padStart(3)} steps, ${chips} key chips, depth ${digest.scenarios[name].depth_positions} [archived story]`);
}

const outPath = path.join(BASELINES, `strip_digest_v${SIM_VERSION}.json`);
writeJsonAtomic(outPath, digest);
console.log(`\n[gen-strip-digest] wrote ${path.relative(ROOT, outPath)} (${Object.keys(digest.scenarios).length} scenarios)`);
