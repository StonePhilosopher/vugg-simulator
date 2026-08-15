// Shared helpers for the strip-digest tripwire.
// One file per scenario (strip-digest-<name>.test.ts) so vitest can
// work-steal across workers — the old 4 shards were badly unbalanced
// (shard 1 ~57s vs shard 0 ~35s) because long recordings serialized
// inside a single file.

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

export function readSimVersion(): number {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
    const m = src.match(/^const SIM_VERSION = (\d+);/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

export function loadDigest(): { version: number; digest: any | null } {
  const version = readSimVersion();
  const file = path.join(BASELINES, `strip_digest_v${version}.json`);
  try {
    return { version, digest: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { version, digest: null };
  }
}

/** Register the tripwire for one curated scenario. */
export function registerStripDigestScenario(name: string): void {
  const { version, digest } = loadDigest();
  describe(`strip chemistry-trajectory tripwire — ${name}`, () => {
    if (!digest) {
      it(`(no strip_digest_v${version}.json — run tools/gen-strip-digest.mjs)`, () => {
        expect(true).toBe(true);
      });
      return;
    }
    if (!digest.scenarios[name]) {
      it.skip(`${name} not in strip_digest_v${version}.json`, () => {});
      return;
    }
    it(`matches the recorded chemistry trajectory`, () => {
      const deps = { stripDataIndex, stripDequantize };
      const ds = recordScenario(name);
      if (!ds) return;
      expect(stripDigestForDataset(ds, deps)).toEqual(digest.scenarios[name]);
    }, 120000);
  });
}
