import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evidenceCheckpointDirectory,
  evidenceIdentity,
  assertEvidenceCheckpointDirectory,
  loadScenarioReceipt,
  requireScenarioReceipt,
  prepareEvidenceCheckpointDirectory,
  scenarioReceipt,
  sha256File,
  writeJsonAtomic,
} from '../tools/scenario-evidence-checkpoint.mjs';
import { stripDigestForStory } from '../tools/strip-digest-shape.mjs';
import { canonicalStripRecordedAt } from '../tools/strip-identity.mjs';

describe('resumable scenario evidence workflows', () => {
  it('rejects malformed identities and missing exact-bundle checkpoints', () => {
    expect(() => evidenceIdentity({
      kind: 'strip-archive', simVersion: 0, modelDigest: 'model-a',
      bundleDigest: 'c'.repeat(64), executionDigest: 'e'.repeat(64),
      producerDigest: 'f'.repeat(64), runtimeDigest: '1'.repeat(64), seed: 42,
    })).toThrow('SIM_VERSION');
    expect(() => evidenceIdentity({
      kind: 'strip-archive', simVersion: 264, modelDigest: 'model-a',
      bundleDigest: 'not-a-digest', executionDigest: 'e'.repeat(64),
      producerDigest: 'f'.repeat(64), runtimeDigest: '1'.repeat(64), seed: 42,
    })).toThrow('bundle SHA-256');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-missing-evidence-'));
    const identity = evidenceIdentity({
      kind: 'strip-archive', simVersion: 264, modelDigest: 'model-a',
      bundleDigest: 'd'.repeat(64), executionDigest: 'e'.repeat(64),
      producerDigest: 'f'.repeat(64), runtimeDigest: '1'.repeat(64), seed: 42,
    });
    expect(() => assertEvidenceCheckpointDirectory(root, identity))
      .toThrow('exact-bundle checkpoint is missing');
  });

  it('binds receipts to the exact bundle and verifies payloads and artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-scenario-evidence-'));
    const identity = evidenceIdentity({
      kind: 'strip-archive',
      simVersion: 264,
      modelDigest: 'model-a',
      bundleDigest: 'c'.repeat(64),
      executionDigest: 'e'.repeat(64),
      producerDigest: 'f'.repeat(64),
      runtimeDigest: '1'.repeat(64),
      seed: 42,
    });
    const directory = prepareEvidenceCheckpointDirectory(root, identity);
    expect(evidenceCheckpointDirectory(root, identity)).toBe(directory);
    expect(directory).toContain('strip-archive-v264-cccccccccccc-eeeeeeeeeeee-ffffffffffff-111111111111');

    const artifact = path.join(root, 'story.json');
    writeJsonAtomic(artifact, { story: true });
    const receiptPath = path.join(directory, 'fixture.json');
    writeJsonAtomic(receiptPath, scenarioReceipt({
      id: 'fixture',
      specHash: 'a'.repeat(64),
      durationSteps: 10,
      seed: 42,
      artifactSha256: sha256File(artifact),
      payload: { quartz: { total: 1 } },
    }));
    const expected = {
      id: 'fixture', specHash: 'a'.repeat(64), durationSteps: 10, seed: 42, artifactPath: artifact,
    };
    expect(loadScenarioReceipt(receiptPath, expected)?.payload).toEqual({ quartz: { total: 1 } });
    expect(() => requireScenarioReceipt(path.join(directory, 'missing.json'), expected))
      .toThrow('exact-bundle scenario evidence receipt is missing');

    writeJsonAtomic(artifact, { story: false });
    expect(() => loadScenarioReceipt(receiptPath, expected)).toThrow('artifact mismatch');
    const forged = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    forged.payload.quartz.total = 2;
    writeJsonAtomic(receiptPath, forged);
    expect(() => loadScenarioReceipt(receiptPath, { ...expected, artifactPath: undefined }))
      .toThrow('payload mismatch');

    const changedProducerDirectory = prepareEvidenceCheckpointDirectory(root, {
      ...identity, producer_sha256: '9'.repeat(64),
    });
    expect(changedProducerDirectory).not.toBe(directory);
    expect(changedProducerDirectory).toContain('-999999999999-');
  });

  it('derives the compact digest exactly from a full archived story', () => {
    const story = {
      steps: 8,
      depth_positions: 2,
      chips: {
        pH: {
          wall: [6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7],
          center: 'same_as_wall',
        },
        calcite_morph: {
          wall: [null, 1, 1, 3, 3, 1, null, null],
        },
      },
    };
    const digest = stripDigestForStory(story);
    expect(digest).toMatchObject({ steps: 8, depth_positions: 2 });
    expect(digest.chips.pH.wall).toEqual({
      min: 6, max: 6.7, samples: [6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7],
    });
    expect(digest.chips.pH.center).toEqual(digest.chips.pH.wall);
    expect(digest.chips.calcite_morph.wall).toEqual({
      min: 1, max: 3, samples: [null, 1, 1, 3, 3, 1, null, null],
    });
    expect(digest.chips.calcite_morph.center).toBeUndefined();
  });

  it('normalizes wall-clock metadata out of canonical strip evidence', () => {
    expect(canonicalStripRecordedAt(1)).toBeNull();
    expect(canonicalStripRecordedAt(9_999_999_999)).toBe(
      canonicalStripRecordedAt(1),
    );
  });
});
