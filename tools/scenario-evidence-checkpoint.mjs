import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const EVIDENCE_CHECKPOINT_SCHEMA = 'vugg-scenario-evidence-checkpoint-v2';
export const SCENARIO_RECEIPT_SCHEMA = 'vugg-scenario-evidence-receipt-v1';

export function evidenceIdentity({ kind, simVersion, modelDigest, bundleDigest,
                                   executionDigest, producerDigest, runtimeDigest, seed = 42 }) {
  if (!/^[a-z0-9-]+$/.test(String(kind || ''))) throw new Error('invalid evidence checkpoint kind');
  const version = Number(simVersion);
  const model = String(modelDigest || '');
  const bundle = String(bundleDigest || '').toLowerCase();
  const numericSeed = Number(seed);
  const execution = String(executionDigest || '').toLowerCase();
  const producer = String(producerDigest || '').toLowerCase();
  const runtime = String(runtimeDigest || '').toLowerCase();
  if (!Number.isInteger(version) || version < 1) throw new Error('invalid evidence SIM_VERSION');
  if (!model) throw new Error('invalid evidence MODEL_DIGEST');
  if (!/^[0-9a-f]{64}$/.test(bundle)) throw new Error('invalid evidence bundle SHA-256');
  if (!/^[0-9a-f]{64}$/.test(execution)) throw new Error('invalid evidence execution SHA-256');
  if (!/^[0-9a-f]{64}$/.test(producer)) throw new Error('invalid evidence producer SHA-256');
  if (!/^[0-9a-f]{64}$/.test(runtime)) throw new Error('invalid evidence Node runtime SHA-256');
  if (!Number.isInteger(numericSeed)) throw new Error('invalid evidence seed');
  return {
    schema: EVIDENCE_CHECKPOINT_SCHEMA,
    kind: String(kind),
    sim_version: version,
    model_digest: model,
    seed: numericSeed,
    bundle_sha256: bundle,
    execution_sha256: execution,
    producer_sha256: producer,
    node_runtime_sha256: runtime,
  };
}

export function evidenceCheckpointDirectory(root, identity) {
  return path.join(
    root,
    '.local-evidence',
    `${identity.kind}-v${identity.sim_version}`
      + `-${identity.bundle_sha256.slice(0, 12)}`
      + `-${identity.execution_sha256.slice(0, 12)}`
      + `-${identity.producer_sha256.slice(0, 12)}`
      + `-${identity.node_runtime_sha256.slice(0, 12)}`,
  );
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const backup = `${file}.${process.pid}.${Date.now()}.bak`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
    // Windows does not reliably replace an existing file with renameSync.
    // Preserve the prior complete artifact until the new complete artifact is
    // in place, and restore it if the second rename fails.
    fs.renameSync(file, backup);
    try {
      fs.renameSync(temp, file);
      fs.rmSync(backup, { force: true });
    } catch (replacementError) {
      if (!fs.existsSync(file) && fs.existsSync(backup)) fs.renameSync(backup, file);
      throw replacementError;
    }
  }
}

export function assertEvidenceCheckpointDirectory(root, identity) {
  const directory = evidenceCheckpointDirectory(root, identity);
  const identityPath = path.join(directory, 'identity.json');
  if (!fs.existsSync(identityPath)) {
    throw new Error(`${identity.kind} exact-bundle checkpoint is missing`);
  }
  const stored = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  if (JSON.stringify(stored) !== JSON.stringify(identity)) {
    throw new Error(`${identity.kind} checkpoint identity mismatch`);
  }
  return directory;
}

export function prepareEvidenceCheckpointDirectory(root, identity, { fresh = false } = {}) {
  const directory = evidenceCheckpointDirectory(root, identity);
  if (fresh) fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  const identityPath = path.join(directory, 'identity.json');
  if (fs.existsSync(identityPath)) {
    assertEvidenceCheckpointDirectory(root, identity);
  } else {
    writeJsonAtomic(identityPath, identity);
  }
  return directory;
}

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function scenarioSpecHash(spec) {
  return sha256Bytes(JSON.stringify(spec ?? null));
}

export function scenarioReceipt({ id, specHash, durationSteps, seed = 42, artifactSha256, payload }) {
  if (!/^[a-z0-9_-]+$/.test(String(id || ''))) throw new Error('invalid scenario evidence id');
  if (!/^[0-9a-f]{64}$/.test(String(specHash || '').toLowerCase())) {
    throw new Error('invalid scenario spec SHA-256');
  }
  if (!Number.isInteger(Number(durationSteps)) || Number(durationSteps) < 1) {
    throw new Error('invalid scenario evidence duration');
  }
  if (!Number.isInteger(Number(seed))) throw new Error('invalid scenario evidence seed');
  if (artifactSha256 != null && !/^[0-9a-f]{64}$/.test(String(artifactSha256).toLowerCase())) {
    throw new Error('invalid scenario artifact SHA-256');
  }
  const receipt = {
    schema: SCENARIO_RECEIPT_SCHEMA,
    scenario: String(id),
    scenario_spec_hash: String(specHash),
    duration_steps: Number(durationSteps),
    seed: Number(seed),
  };
  if (artifactSha256 != null) receipt.artifact_sha256 = String(artifactSha256).toLowerCase();
  if (payload !== undefined) {
    receipt.payload = payload;
    receipt.payload_sha256 = sha256Bytes(JSON.stringify(payload));
  }
  return receipt;
}

export function loadScenarioReceipt(file, expected) {
  if (!fs.existsSync(file)) return null;
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (receipt.schema !== SCENARIO_RECEIPT_SCHEMA
      || receipt.scenario !== expected.id
      || receipt.scenario_spec_hash !== expected.specHash
      || receipt.duration_steps !== expected.durationSteps
      || receipt.seed !== expected.seed) {
    throw new Error(`${expected.id}: scenario evidence checkpoint contract mismatch`);
  }
  if (receipt.payload !== undefined
      && receipt.payload_sha256 !== sha256Bytes(JSON.stringify(receipt.payload))) {
    throw new Error(`${expected.id}: scenario evidence checkpoint payload mismatch`);
  }
  if (expected.artifactPath
      && (!receipt.artifact_sha256
        || !fs.existsSync(expected.artifactPath)
        || receipt.artifact_sha256 !== sha256File(expected.artifactPath))) {
    throw new Error(`${expected.id}: scenario evidence checkpoint artifact mismatch`);
  }
  return receipt;
}

export function requireScenarioReceipt(file, expected) {
  const receipt = loadScenarioReceipt(file, expected);
  if (!receipt) throw new Error(`${expected.id}: exact-bundle scenario evidence receipt is missing`);
  return receipt;
}
