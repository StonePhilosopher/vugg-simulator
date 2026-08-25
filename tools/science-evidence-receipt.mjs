#!/usr/bin/env node
/**
 * Persist and verify the clean-checkout authentication root for canonical
 * science evidence. Per-scenario checkpoint receipts remain local resumability
 * state; this checked-in aggregate binds every published artifact to the exact
 * browser bundle, exact Node execution set, fetched scientific inputs, and
 * evidence-producer contracts.
 */

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
import {
  assertEvidenceCheckpointDirectory,
  evidenceIdentity,
  requireScenarioReceipt,
  scenarioSpecHash,
  sha256File,
  writeJsonAtomic,
} from './scenario-evidence-checkpoint.mjs';
import {
  assertCheckpointDirectory,
  checkpointIdentity,
  evidenceBundleDigest,
  loadScenarioCheckpoint,
} from './locality-frequency-checkpoint.mjs';
import {
  LOCALITY_FREQUENCY_SEEDS,
  localityFrequencySpecHash,
  reconstructFrequencyOccurrences,
} from './locality-frequency-contract.mjs';
import {
  STRIP_DIGEST_SCENARIOS,
  stripDigestForStory,
} from './strip-digest-shape.mjs';
import { verifyMechanismWitnessArtifact } from './gen-mechanism-witnesses.mjs';
import {
  readGuidedTutorialBrowserReceipt,
  verifyGuidedTutorialBrowserReceipt,
} from './guided-tutorial-browser-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SCIENCE_EVIDENCE_RECEIPT_SCHEMA = 'vugg-science-evidence-receipt-v1';
export const SCIENCE_EVIDENCE_PRODUCERS = Object.freeze([
  'seed42-baseline', 'strip-archive', 'locality-frequency', 'strip-digest',
  'claim-cards', 'mechanism-witnesses', 'science-provenance', 'science-receipt',
  'guided-tutorial-browser',
]);

function relative(root, file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

export function scienceEvidenceArtifactFiles(root, version, scenarioNames) {
  const files = [
    path.join(root, 'tests-js', 'baselines', `seed42_v${version}.json`),
    path.join(root, 'tests-js', 'baselines', `locality_frequency_v${version}.json`),
    path.join(root, 'tests-js', 'baselines', `strip_digest_v${version}.json`),
    path.join(root, 'archive', 'evidence', `mechanism-witnesses-v${version}.json`),
    path.join(root, 'archive', 'evidence', `guided-tutorial-browser-v${version}.json`),
  ];
  for (const name of [...scenarioNames].sort()) {
    files.push(path.join(root, 'archive', 'strips', `v${version}`, `${name}.json`));
    files.push(path.join(root, 'archive', 'claim-cards', `v${version}`, `${name}.json`));
    files.push(path.join(root, 'archive', 'claim-cards', `v${version}`, `${name}.md`));
  }
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`published science artifact is missing: ${relative(root, file)}`);
  }
  return files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

export function artifactHashMap(root, files) {
  return Object.fromEntries(files.map(file => [relative(root, file), sha256File(file)]));
}

export function verifyArtifactHashMap(root, artifacts) {
  for (const [name, expected] of Object.entries(artifacts || {})) {
    const file = path.join(root, name);
    if (!fs.existsSync(file) || sha256File(file) !== expected) {
      throw new Error(`published science artifact hash mismatch: ${name}`);
    }
  }
  return true;
}

export function buildScienceEvidenceReceipt({ root, simVersion, modelDigest, scenarioNames }) {
  const mechanismPath = path.join(root, 'archive', 'evidence', `mechanism-witnesses-v${simVersion}.json`);
  if (!fs.existsSync(mechanismPath)) throw new Error(`published science artifact is missing: ${relative(root, mechanismPath)}`);
  verifyMechanismWitnessArtifact(root, JSON.parse(fs.readFileSync(mechanismPath, 'utf8')), {
    simVersion,
    modelDigest,
  });
  verifyGuidedTutorialBrowserReceipt(
    root, readGuidedTutorialBrowserReceipt(root, simVersion), { simVersion },
  );
  const files = scienceEvidenceArtifactFiles(root, simVersion, scenarioNames);
  return {
    schema: SCIENCE_EVIDENCE_RECEIPT_SCHEMA,
    sim_version: Number(simVersion),
    model_digest: String(modelDigest),
    canonical_seed: 42,
    browser_bundle_sha256: browserBundleDigest(root),
    execution_set_sha256: runtimeExecutionDigest(root),
    node_runtime: nodeRuntimeIdentity(),
    node_runtime_sha256: nodeRuntimeDigest(),
    producer_contracts: Object.fromEntries(SCIENCE_EVIDENCE_PRODUCERS.map(kind => [
      kind, producerContractDigest(root, kind),
    ])),
    artifacts: artifactHashMap(root, files),
  };
}

export function verifyLocalEvidenceReceipts({ root, simVersion, modelDigest, scenarios }) {
  const bundleDigest = evidenceBundleDigest(root);
  const executionDigest = runtimeExecutionDigest(root);
  const names = Object.keys(scenarios).sort();
  const seed42Dir = assertEvidenceCheckpointDirectory(root, evidenceIdentity({
    kind: 'seed42-baseline', simVersion, modelDigest, bundleDigest, executionDigest,
    producerDigest: producerContractDigest(root, 'seed42-baseline'), seed: 42,
    runtimeDigest: nodeRuntimeDigest(),
  }));
  const seed42Path = path.join(root, 'tests-js', 'baselines', `seed42_v${simVersion}.json`);
  const seed42 = JSON.parse(fs.readFileSync(seed42Path, 'utf8'));
  const stripDir = assertEvidenceCheckpointDirectory(root, evidenceIdentity({
    kind: 'strip-archive', simVersion, modelDigest, bundleDigest, executionDigest,
    producerDigest: producerContractDigest(root, 'strip-archive'), seed: 42,
    runtimeDigest: nodeRuntimeDigest(),
  }));
  const derivedStripDigest = {
    sim_version: Number(simVersion),
    model_digest: String(modelDigest),
    seed: 42,
    scenarios: {},
  };
  for (const name of names) {
    const spec = scenarios[name]._json5_spec;
    const durationSteps = Number(spec.duration_steps);
    const specHash = scenarioSpecHash(spec);
    const seedReceipt = requireScenarioReceipt(path.join(seed42Dir, `${name}.json`), {
      id: name, specHash, durationSteps, seed: 42,
    });
    if (JSON.stringify(seedReceipt.payload) !== JSON.stringify(seed42[name])) {
      throw new Error(`${name}: seed-42 published baseline differs from its execution receipt`);
    }
    requireScenarioReceipt(path.join(stripDir, `${name}.json`), {
      id: name, specHash, durationSteps, seed: 42,
      artifactPath: path.join(root, 'archive', 'strips', `v${simVersion}`, `${name}.json`),
    });
  }
  for (const name of STRIP_DIGEST_SCENARIOS) {
    if (!scenarios[name]) continue;
    const story = JSON.parse(fs.readFileSync(
      path.join(root, 'archive', 'strips', `v${simVersion}`, `${name}.json`),
      'utf8',
    ));
    derivedStripDigest.scenarios[name] = stripDigestForStory(story);
  }
  const publishedStripDigest = JSON.parse(fs.readFileSync(
    path.join(root, 'tests-js', 'baselines', `strip_digest_v${simVersion}.json`),
    'utf8',
  ));
  if (JSON.stringify(derivedStripDigest) !== JSON.stringify(publishedStripDigest)) {
    throw new Error('published strip digest is not the exact derivation of authenticated strip evidence');
  }

  const frequencyIdentity = checkpointIdentity({
    simVersion, modelDigest, seeds: LOCALITY_FREQUENCY_SEEDS, bundleDigest,
    executionDigest, producerDigest: producerContractDigest(root, 'locality-frequency'),
    runtimeDigest: nodeRuntimeDigest(),
  });
  const frequencyDir = assertCheckpointDirectory(root, frequencyIdentity);
  const frequencyPath = path.join(root, 'tests-js', 'baselines', `locality_frequency_v${simVersion}.json`);
  const frequency = JSON.parse(fs.readFileSync(frequencyPath, 'utf8'));
  for (const name of names) {
    const spec = scenarios[name]._json5_spec;
    const checkpoint = loadScenarioCheckpoint(path.join(frequencyDir, `${name}.json`), {
      id: name,
      specHash: localityFrequencySpecHash(spec),
      durationSteps: Number(spec.duration_steps),
      seeds: LOCALITY_FREQUENCY_SEEDS,
    }, reconstructFrequencyOccurrences);
    if (!checkpoint) throw new Error(`${name}: locality-frequency execution receipt is missing`);
    if (JSON.stringify(checkpoint) !== JSON.stringify(frequency.scenarios?.[name])) {
      throw new Error(`${name}: published locality-frequency evidence differs from its execution receipt`);
    }
  }
  return true;
}

async function main() {
  const check = process.argv.includes('--check');
  for (const arg of process.argv.slice(2)) if (arg !== '--check') throw new Error(`unknown argument: ${arg}`);
  const { SIM_VERSION, MODEL_DIGEST, SCENARIOS } = await loadSimBundle({
    toolName: 'science-evidence-receipt',
  });
  const receipt = buildScienceEvidenceReceipt({
    root: ROOT,
    simVersion: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenarioNames: Object.keys(SCENARIOS),
  });
  const output = path.join(ROOT, 'archive', 'evidence', `v${SIM_VERSION}.json`);
  const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== encoded) {
      throw new Error(`stale science evidence receipt: ${relative(ROOT, output)}`);
    }
    verifyArtifactHashMap(ROOT, receipt.artifacts);
    console.log(`[science-evidence] PASS: ${Object.keys(receipt.artifacts).length} artifacts, exact execution + producers`);
  } else {
    verifyLocalEvidenceReceipts({
      root: ROOT, simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST, scenarios: SCENARIOS,
    });
    writeJsonAtomic(output, receipt);
    console.log(`[science-evidence] wrote ${relative(ROOT, output)} (${Object.keys(receipt.artifacts).length} artifacts)`);
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[science-evidence] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
