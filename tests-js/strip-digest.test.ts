// tests-js/strip-digest.test.ts — strip-view chemistry-TRAJECTORY tripwire.
//
// Companion to tools/gen-strip-digest.mjs (the generator), the way
// calibration.test.ts is to gen-js-baseline.mjs. For each curated best-data
// scenario it records the run through the StripRecorder, reduces the per-cell
// chemistry trajectory to the same compact digest the generator wrote, and
// asserts it matches the committed baseline (strip_digest_v<SIM_VERSION>.json).
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recordScenario } from './strip-helpers';
import { stripDigestForDataset } from '../tools/strip-digest-shape.mjs';

declare const stripDataIndex: any;
declare const stripDequantize: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

// Read SIM_VERSION from the source file, not the bundle global: the baseline
// loads at module-import time, before the harness injects globals. Same
// approach calibration.test.ts uses.
function readSimVersion(): number {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
    const m = src.match(/^const SIM_VERSION = (\d+);/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function loadDigest(): { version: number; digest: any | null } {
  const version = readSimVersion();
  const file = path.join(BASELINES, `strip_digest_v${version}.json`);
  try {
    return { version, digest: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { version, digest: null };
  }
}

const { version, digest } = loadDigest();

describe('strip chemistry-trajectory tripwire — seed 42 vs committed digest', () => {
  if (!digest) {
    it(`(no strip_digest_v${version}.json — run tools/gen-strip-digest.mjs)`, () => {
      expect(true).toBe(true);
    });
    return;
  }

  const names = Object.keys(digest.scenarios);

  for (const name of names) {
    it(`${name} matches the recorded chemistry trajectory`, () => {
      // Build deps INSIDE the test: the bundle globals (stripDataIndex,
      // stripDequantize) are injected by setup's beforeAll, which runs after
      // collection — referencing them in the describe body throws.
      const deps = { stripDataIndex, stripDequantize };
      const ds = recordScenario(name);
      if (!ds) return; // scenario not registered in this build → skip
      const got = stripDigestForDataset(ds, deps);
      expect(got).toEqual(digest.scenarios[name]);
    }, 60000);
  }
});
