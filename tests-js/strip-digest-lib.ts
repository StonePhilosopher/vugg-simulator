// Shared helpers for the sharded strip-digest tripwire.
// One file used to run all ~12 recordings sequentially (~several minutes on
// a single worker). Sharding fans them across workers.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

export const STRIP_DIGEST_SHARD_COUNT = 4;

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

export function digestScenariosForShard(
  digest: { scenarios: Record<string, any> },
  shard: number,
  shardCount = STRIP_DIGEST_SHARD_COUNT,
): string[] {
  return Object.keys(digest.scenarios)
    .sort()
    .filter((_, i) => i % shardCount === shard);
}
