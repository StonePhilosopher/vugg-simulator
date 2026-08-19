import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkpointDirectory,
  checkpointIdentity,
  loadScenarioCheckpoint,
  prepareCheckpointDirectory,
  writeJsonAtomic,
} from '../tools/locality-frequency-checkpoint.mjs';

describe('resumable locality-frequency commissioning workflow', () => {
  it('keys checkpoints to version, model, seeds, and exact built bundle', () => {
    const identity = checkpointIdentity({
      simVersion: 264, modelDigest: 'model-a', seeds: [1, 2, 42], bundleDigest: 'a'.repeat(64),
      executionDigest: 'e'.repeat(64), producerDigest: 'f'.repeat(64),
      runtimeDigest: '1'.repeat(64),
    });
    expect(identity).toMatchObject({
      sim_version: 264, model_digest: 'model-a', seeds: [1, 2, 42], bundle_sha256: 'a'.repeat(64),
      execution_sha256: 'e'.repeat(64), producer_sha256: 'f'.repeat(64),
      node_runtime_sha256: '1'.repeat(64),
    });
    expect(checkpointDirectory('C:/repo', identity))
      .toContain('v264-aaaaaaaaaaaa-eeeeeeeeeeee-ffffffffffff-111111111111');
  });

  it('atomically resumes validated scenarios and rejects stale or forged receipts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-frequency-checkpoint-'));
    const identity = checkpointIdentity({
      simVersion: 264, modelDigest: 'model-a', seeds: [1, 2, 42], bundleDigest: 'b'.repeat(64),
      executionDigest: 'e'.repeat(64), producerDigest: 'f'.repeat(64),
      runtimeDigest: '1'.repeat(64),
    });
    const directory = prepareCheckpointDirectory(root, identity);
    expect(prepareCheckpointDirectory(root, identity)).toBe(directory);
    const file = path.join(directory, 'fixture.json');
    const value = {
      locality_frequency_spec_hash: 'spec-a',
      duration_steps: 10,
      occurrences: { quartz: { count: 3 } },
      runs: [1, 2, 42].map(seed => ({ seed, species: ['quartz'], first_steps: { quartz: 1 } })),
    };
    writeJsonAtomic(file, value);
    const reconstruct = () => ({ errors: [], occurrences: value.occurrences });
    expect(loadScenarioCheckpoint(file, {
      id: 'fixture', specHash: 'spec-a', durationSteps: 10, seeds: [1, 2, 42],
    }, reconstruct)).toEqual(value);
    expect(() => loadScenarioCheckpoint(file, {
      id: 'fixture', specHash: 'spec-b', durationSteps: 10, seeds: [1, 2, 42],
    }, reconstruct)).toThrow('contract mismatch');
    expect(() => prepareCheckpointDirectory(root, { ...identity, model_digest: 'model-b' }))
      .toThrow('identity mismatch');
    const changedProducerDirectory = prepareCheckpointDirectory(root, {
      ...identity, producer_sha256: '9'.repeat(64),
    });
    expect(changedProducerDirectory).not.toBe(directory);
    expect(changedProducerDirectory).toContain('-999999999999-');
  });
});
