// Strip-digest tripwire shard 0/4 — see strip-digest-lib.ts for why this is sharded.
import { describe, expect, it } from 'vitest';
import { recordScenario } from './strip-helpers';
import { stripDigestForDataset } from '../tools/strip-digest-shape.mjs';
import {
  STRIP_DIGEST_SHARD_COUNT,
  digestScenariosForShard,
  loadDigest,
} from './strip-digest-lib';

declare const stripDataIndex: any;
declare const stripDequantize: any;

const SHARD = 0;
const { version, digest } = loadDigest();

describe(`strip chemistry-trajectory tripwire (shard ${SHARD}/${STRIP_DIGEST_SHARD_COUNT})`, () => {
  if (!digest) {
    it(`(no strip_digest_v${version}.json — run tools/gen-strip-digest.mjs)`, () => {
      expect(true).toBe(true);
    });
    return;
  }
  for (const name of digestScenariosForShard(digest, SHARD)) {
    it(`${name} matches the recorded chemistry trajectory`, () => {
      const deps = { stripDataIndex, stripDequantize };
      const ds = recordScenario(name);
      if (!ds) return;
      expect(stripDigestForDataset(ds, deps)).toEqual(digest.scenarios[name]);
    }, 120000);
  }
});
