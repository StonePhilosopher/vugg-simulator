// tests-js/strip-digest.test.ts — strip-view chemistry-TRAJECTORY tripwire.
//
// Companion to tools/gen-strip-digest.mjs (the generator), the way
// calibration.test.ts is to gen-js-baseline.mjs. For each curated best-data
// scenario it loads the aggregate-receipted canonical strip story, reduces
// that per-cell chemistry trajectory to the same compact digest the generator
// wrote, and asserts it matches strip_digest_v<SIM_VERSION>.json. Live recorder
// behavior is covered separately; this test makes digest verification cheap.
//
// WHAT THIS CATCHES that the crystal-count calibration baseline can't: a
// chemistry-PATH change that doesn't move final crystal counts — e.g. a
// diffusion tweak that shifts the wall→center gradient, or a chip-read change
// (like the f_ord recorder fix) that alters what the recording shows. Those
// don't bump SIM_VERSION but DO move the digest, and this test flags them.
//
// On a legitimate change: `node tools/gen-strip-digest.mjs`, inspect the
// human-readable diff (which chip's min/max/samples moved, at which depth),
// commit the new baseline.
//
// Pins OBSERVED behavior — it is a stability tripwire, not a science claim.

import { describe, expect, it } from 'vitest';
import { currentEvidenceIdentity, loadAuthenticatedEvidenceJson } from './authenticated-evidence';
import { loadArchivedScenario } from './strip-helpers';
import { stripDigestForStory } from '../tools/strip-digest-shape.mjs';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;

const version = currentEvidenceIdentity.simVersion;
const digest = loadAuthenticatedEvidenceJson(
  `tests-js/baselines/strip_digest_v${version}.json`,
  'strip-digest',
);

describe('strip chemistry-trajectory tripwire — seed 42 vs committed digest', () => {
  it('binds the baseline to the active semantic model identity', () => {
    expect(digest.sim_version).toBe(SIM_VERSION);
    expect(digest.model_digest).toBe(MODEL_DIGEST);
  });

  const names = Object.keys(digest.scenarios);

  for (const name of names) {
    it(`${name} matches the authenticated recorded chemistry trajectory`, () => {
      const story = loadArchivedScenario(name);
      const got = stripDigestForStory(story);
      expect(got).toEqual(digest.scenarios[name]);
    });
  }
});
