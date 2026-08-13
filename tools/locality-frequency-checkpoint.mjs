import fs from 'node:fs';
import path from 'node:path';
import { browserBundleDigest } from './evidence-runtime.mjs';
import { writeJsonAtomic } from './scenario-evidence-checkpoint.mjs';

export { writeJsonAtomic };

export const CHECKPOINT_SCHEMA = 'vugg-locality-frequency-checkpoint-v2';

export function evidenceBundleDigest(root) {
  return browserBundleDigest(root);
}

export function checkpointIdentity({ simVersion, modelDigest, seeds, bundleDigest,
                                     executionDigest, producerDigest, runtimeDigest }) {
  const version = Number(simVersion);
  const model = String(modelDigest || '');
  const bundle = String(bundleDigest || '').toLowerCase();
  const execution = String(executionDigest || '').toLowerCase();
  const producer = String(producerDigest || '').toLowerCase();
  const runtime = String(runtimeDigest || '').toLowerCase();
  const normalizedSeeds = [...seeds].map(Number);
  if (!Number.isInteger(version) || version < 1) throw new Error('invalid locality evidence SIM_VERSION');
  if (!model) throw new Error('invalid locality evidence MODEL_DIGEST');
  for (const [label, digest] of [['bundle', bundle], ['execution', execution],
    ['producer', producer], ['Node runtime', runtime]]) {
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`invalid locality evidence ${label} SHA-256`);
  }
  if (!normalizedSeeds.length || normalizedSeeds.some(seed => !Number.isInteger(seed))) {
    throw new Error('invalid locality evidence seeds');
  }
  return {
    schema: CHECKPOINT_SCHEMA,
    sim_version: version,
    model_digest: model,
    seeds: normalizedSeeds,
    bundle_sha256: bundle,
    execution_sha256: execution,
    producer_sha256: producer,
    node_runtime_sha256: runtime,
  };
}

export function checkpointDirectory(root, identity) {
  return path.join(
    root, '.local-evidence',
    `locality-frequency-v${identity.sim_version}`
      + `-${identity.bundle_sha256.slice(0, 12)}`
      + `-${identity.execution_sha256.slice(0, 12)}`
      + `-${identity.producer_sha256.slice(0, 12)}`
      + `-${identity.node_runtime_sha256.slice(0, 12)}`,
  );
}

export function prepareCheckpointDirectory(root, identity, { fresh = false } = {}) {
  const directory = checkpointDirectory(root, identity);
  if (fresh) fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  const identityPath = path.join(directory, 'identity.json');
  if (fs.existsSync(identityPath)) {
    const stored = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    if (JSON.stringify(stored) !== JSON.stringify(identity)) {
      throw new Error('locality-frequency checkpoint identity mismatch; rerun with --fresh');
    }
  } else {
    writeJsonAtomic(identityPath, identity);
  }
  return directory;
}

export function assertCheckpointDirectory(root, identity) {
  const directory = checkpointDirectory(root, identity);
  const identityPath = path.join(directory, 'identity.json');
  if (!fs.existsSync(identityPath)) throw new Error('locality-frequency exact-execution checkpoint is missing');
  const stored = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  if (JSON.stringify(stored) !== JSON.stringify(identity)) {
    throw new Error('locality-frequency checkpoint identity mismatch');
  }
  return directory;
}

export function loadScenarioCheckpoint(file, expected, reconstruct) {
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.locality_frequency_spec_hash !== expected.specHash
      || value.duration_steps !== expected.durationSteps
      || !Array.isArray(value.runs)
      || value.runs.length !== expected.seeds.length
      || value.runs.some((run, index) => run.seed !== expected.seeds[index])) {
    throw new Error(`${expected.id}: locality-frequency checkpoint contract mismatch`);
  }
  const rebuilt = reconstruct({ duration_steps: value.duration_steps, runs: value.runs }, expected.seeds);
  if (rebuilt.errors.length || JSON.stringify(rebuilt.occurrences) !== JSON.stringify(value.occurrences)) {
    throw new Error(`${expected.id}: locality-frequency checkpoint reconstruction mismatch`);
  }
  return value;
}
