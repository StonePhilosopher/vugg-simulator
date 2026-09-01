// Shared helpers for the sharded calibration sweep.
// Split across calibration-shard-*.test.ts so ~39 scenario runs fan out
// across vitest workers instead of sitting sequential on one file.

import { currentEvidenceIdentity, loadAuthenticatedEvidenceJson } from './authenticated-evidence';

/** Finer than 4: more files → better work-stealing when scenario costs differ. */
export const CALIBRATION_SHARD_COUNT = 8;

export function loadBaseline(): { version: number; baseline: Record<string, any> } {
  const version = currentEvidenceIdentity.simVersion;
  const baseline = loadAuthenticatedEvidenceJson(
    `tests-js/baselines/seed42_v${version}.json`,
    'seed42-baseline',
  ) as Record<string, any>;
  return { version, baseline };
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
