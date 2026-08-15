// Shared helpers for the sharded calibration sweep.
// Split across calibration-shard-*.test.ts so ~39 scenario runs fan out
// across vitest workers instead of sitting sequential on one file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

/** Finer than 4: more files → better work-stealing when scenario costs differ. */
export const CALIBRATION_SHARD_COUNT = 8;

export function readSimVersion(): number {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
    const m = src.match(/^const SIM_VERSION = (\d+);/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

export function loadBaseline(): { version: number; baseline: Record<string, any> | null } {
  const version = readSimVersion();
  const file = path.join(BASELINES, `seed42_v${version}.json`);
  try {
    return { version, baseline: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { version, baseline: null };
  }
}

export function summarize(sim: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!sim || !sim.crystals) return out;
  for (const c of sim.crystals) {
    if (!out[c.mineral]) {
      out[c.mineral] = { active: 0, dissolved: 0, total: 0, max_um: 0 };
    }
    out[c.mineral].total++;
    if (c.dissolved) out[c.mineral].dissolved++;
    else out[c.mineral].active++;
    if (c.total_growth_um > out[c.mineral].max_um) {
      out[c.mineral].max_um = Math.round(c.total_growth_um * 10) / 10;
    }
  }
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

/** Scenario names for one shard (stable sort, then modulo). */
export function scenariosForShard(
  baseline: Record<string, any>,
  shard: number,
  shardCount = CALIBRATION_SHARD_COUNT,
): string[] {
  return Object.keys(baseline)
    .sort()
    .filter((_, i) => i % shardCount === shard);
}
