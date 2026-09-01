// Shared helpers for the strip-digest tripwire.
// One file per scenario (strip-digest-<name>.test.ts) so vitest can
// work-steal across workers — the old 4 shards were badly unbalanced
// (shard 1 ~57s vs shard 0 ~35s) because long recordings serialized
// inside a single file.

import { describe, expect, it } from 'vitest';
import { currentEvidenceIdentity, loadAuthenticatedEvidenceJson } from './authenticated-evidence';
import { loadArchivedScenario } from './strip-helpers';
import { stripDigestForStory } from '../tools/strip-digest-shape.mjs';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;

export function loadDigest(): { version: number; digest: any } {
  const version = currentEvidenceIdentity.simVersion;
  const digest = loadAuthenticatedEvidenceJson(
    `tests-js/baselines/strip_digest_v${version}.json`,
    'strip-digest',
  );
  return { version, digest };
}

/** Register the tripwire for one curated scenario. */
export function registerStripDigestScenario(name: string): void {
  const { version, digest } = loadDigest();
  describe(`strip chemistry-trajectory tripwire — ${name}`, () => {
    it('binds the baseline to the active semantic model identity', () => {
      expect(digest.sim_version).toBe(SIM_VERSION);
      expect(digest.model_digest).toBe(MODEL_DIGEST);
    });
    it('matches the authenticated recorded chemistry trajectory', () => {
      const story = loadArchivedScenario(name);
      expect(stripDigestForStory(story)).toEqual(digest.scenarios[name]);
    });
  });
}
