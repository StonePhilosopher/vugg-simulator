#!/usr/bin/env node
/**
 * Test Quarry — measurement-only cost ledger + cost-weighted packing.
 *
 * This extends the PR #8 shard/foreman model already on main
 * (`tools/test-workflow.mjs` + `tests-js/calibration-shard-*.test.ts`).
 * It is not a second scheduler: the foreman still runs files serially
 * under the RSS watchdog, and calibration still lives in the same eight
 * shard files. The quarry only (1) records wall/RSS after a passing
 * foreman batch and (2) assigns scenarios to those shards by authored
 * `duration_steps` instead of name-modulo.
 *
 * It does not change science, baselines, receipts, or
 * `tools/baseline-diff.mjs`. Packed shard assignment is coverage-preserving:
 * the union of shards is the same scenario set as before.
 *
 * Tiers (`presubmit` / `canary` / `evidence`) are labels for later quarry
 * experiments. This first experiment records them on ledger rows and maps
 * the existing Bisbee production-budget witness to `canary`; it does not
 * implement a tiered runner.
 *
 * Cost proxy for heavy scenarios is authored `duration_steps` (Bisbee 340,
 * then Naica / Searles / Sabkha / Roughten Gill which share that pattern).
 * Evidence-tier work multiplies by the locality-frequency seed panel
 * (`[1, 2, 42]`). Measured `elapsed_ms` / `peak_rss_bytes` in
 * `.local-evidence/` are operator testimony, not authentication.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALITY_FREQUENCY_SEEDS } from './locality-frequency-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const TEST_QUARRY_LEDGER_SCHEMA = 'test-quarry-cost-ledger-v1';
export const TEST_QUARRY_LEDGER_TRUST = 'measurement-only-does-not-authenticate-science';
export const TEST_QUARRY_SIM_LINEAGE = 'SIM285/seed42_v285';
export const TEST_QUARRY_PACKING = 'cost-weighted-lpt-by-authored-duration-steps';
export const TEST_QUARRY_TIERS = Object.freeze(['presubmit', 'canary', 'evidence']);
export const TEST_QUARRY_EVIDENCE_SEEDS = LOCALITY_FREQUENCY_SEEDS;
export const TEST_QUARRY_EVIDENCE_SEED_COUNT = LOCALITY_FREQUENCY_SEEDS.length;
export const CALIBRATION_CI_SENTINEL = 'supergene_oxidation';
export const TEST_QUARRY_LEDGER_PATH = path.join(
  ROOT, '.local-evidence', 'test-quarry-cost-ledger-v1.json',
);

/**
 * First-experiment heavy scenarios: long authored runs whose name-modulo
 * shard assignment is known to cluster. Packing uses every scenario's
 * `duration_steps`; this list is the documented starting set.
 */
export const HEAVY_SCENARIO_IDS = Object.freeze([
  'bisbee',
  'naica_geothermal',
  'searles_lake',
  'sabkha_dolomitization',
  'roughten_gill',
]);

const RECEIPT_SCIENCE = 'does-not-change-baselines-or-receipts';

export function parseScenarioJson5(text) {
  return JSON.parse(String(text)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1'));
}

export function authoredScenarioDurationSteps({
  root = ROOT,
  source = fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8'),
} = {}) {
  const doc = parseScenarioJson5(source);
  const scenarios = doc?.scenarios;
  if (!scenarios || typeof scenarios !== 'object' || Array.isArray(scenarios)) {
    throw new Error('scenarios.json5 is missing a scenarios object');
  }
  const durations = {};
  for (const [id, spec] of Object.entries(scenarios)) {
    const durationSteps = Number(spec?.duration_steps);
    if (!Number.isSafeInteger(durationSteps) || durationSteps <= 0) {
      throw new Error(`${id}: duration_steps must be a positive safe integer`);
    }
    durations[id] = durationSteps;
  }
  return durations;
}

export function quarryProxyCost({ durationSteps, seeds = 1 } = {}) {
  if (!Number.isSafeInteger(durationSteps) || durationSteps <= 0) {
    throw new Error(`duration_steps must be a positive safe integer, received ${durationSteps}`);
  }
  if (!Number.isSafeInteger(seeds) || seeds <= 0) {
    throw new Error(`seeds must be a positive safe integer, received ${seeds}`);
  }
  return durationSteps * seeds;
}

export function heavyScenarioEvidenceCosts(durations = authoredScenarioDurationSteps()) {
  return Object.fromEntries(HEAVY_SCENARIO_IDS.map((id) => {
    const durationSteps = durations[id];
    if (!Number.isSafeInteger(durationSteps) || durationSteps <= 0) {
      throw new Error(`heavy scenario ${id} is missing authored duration_steps`);
    }
    return [id, {
      id,
      duration_steps: durationSteps,
      calibration_seeds: 1,
      evidence_seeds: TEST_QUARRY_EVIDENCE_SEED_COUNT,
      calibration_cost: quarryProxyCost({ durationSteps, seeds: 1 }),
      evidence_cost: quarryProxyCost({
        durationSteps, seeds: TEST_QUARRY_EVIDENCE_SEED_COUNT,
      }),
      tier: 'evidence',
    }];
  }));
}

export function quarryTierForTestFile(file) {
  const relative = String(file || '').replaceAll('\\', '/');
  if (relative.includes('cavity-production-bisbee-performance')
      || relative.endsWith('bisbee-production-budget.mjs')) {
    return 'canary';
  }
  if (/calibration-shard-\d+\.test\.ts$/.test(relative)
      || relative.endsWith('-seeds.test.ts')
      || relative.endsWith('stale-mineral-retunes.test.ts')) {
    return 'evidence';
  }
  return 'presubmit';
}

export function quarryEntryFromBisbeeBudgetReceipt(receipt) {
  const steps = Number(receipt?.steps);
  return Object.freeze({
    work: 'bisbee-production-budget',
    scenario: 'bisbee',
    tier: 'canary',
    duration_steps: steps,
    seeds: 1,
    cost: quarryProxyCost({ durationSteps: steps, seeds: 1 }),
    elapsed_ms: receipt.elapsed_ms,
    peak_rss_mb: receipt.peak_rss_mb,
    science: RECEIPT_SCIENCE,
    note: 'canary is the 70-step production witness; evidence Bisbee is 340 steps × 3 seeds',
  });
}

export function packByCost(items, {
  shardCount,
  costOf = () => 1,
  pinToShard0 = null,
} = {}) {
  if (!Array.isArray(items)) throw new Error('items must be an array');
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`shard count must be a positive integer, received ${shardCount}`);
  }
  const unique = [...new Set(items.map(String))];
  const shards = Array.from({ length: shardCount }, () => []);
  const loads = Array(shardCount).fill(0);
  const ranked = [...unique].sort((left, right) => {
    const costDelta = (Number(costOf(right)) || 0) - (Number(costOf(left)) || 0);
    if (costDelta !== 0) return costDelta;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const item of ranked) {
    let best = 0;
    for (let index = 1; index < shardCount; index++) {
      if (loads[index] < loads[best]) best = index;
    }
    shards[best].push(item);
    loads[best] += Number(costOf(item)) || 0;
  }
  if (pinToShard0 != null) {
    const from = shards.findIndex(shard => shard.includes(pinToShard0));
    if (from > 0) {
      [shards[0], shards[from]] = [shards[from], shards[0]];
      [loads[0], loads[from]] = [loads[from], loads[0]];
    }
  }
  for (const shard of shards) shard.sort();
  return { shards, loads: [...loads] };
}

export function packedNamesForShard(names, shard, shardCount, options = {}) {
  if (!Number.isInteger(shard) || shard < 0 || shard >= shardCount) {
    throw new Error(`shard ${shard} is outside 0..${shardCount - 1}`);
  }
  return packByCost(names, { shardCount, ...options }).shards[shard];
}

export function makeCostLedger({ batches = [] } = {}) {
  return {
    schema: TEST_QUARRY_LEDGER_SCHEMA,
    trust: TEST_QUARRY_LEDGER_TRUST,
    science: RECEIPT_SCIENCE,
    sim_lineage: TEST_QUARRY_SIM_LINEAGE,
    packing: TEST_QUARRY_PACKING,
    batches: batches.map(batch => normalizeLedgerBatch(batch)),
  };
}

function normalizeLedgerBatch(batch) {
  const files = [...(batch.files || [])].map(file => String(file).replaceAll('\\', '/'));
  if (!files.length) throw new Error('quarry ledger batch requires files');
  const elapsedMs = Number(batch.elapsed_ms);
  const peakRssBytes = Number(batch.peak_rss_bytes);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error(`invalid elapsed_ms ${batch.elapsed_ms}`);
  }
  if (!Number.isFinite(peakRssBytes) || peakRssBytes < 0) {
    throw new Error(`invalid peak_rss_bytes ${batch.peak_rss_bytes}`);
  }
  return {
    files,
    elapsed_ms: elapsedMs,
    peak_rss_bytes: peakRssBytes,
    tiers: files.map(quarryTierForTestFile),
  };
}

export function readCostLedger({
  ledgerPath = TEST_QUARRY_LEDGER_PATH,
} = {}) {
  if (!fs.existsSync(ledgerPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (parsed?.schema !== TEST_QUARRY_LEDGER_SCHEMA) return null;
    if (parsed?.trust !== TEST_QUARRY_LEDGER_TRUST) return null;
    if (parsed?.science !== RECEIPT_SCIENCE) return null;
    if (parsed?.sim_lineage !== TEST_QUARRY_SIM_LINEAGE) return null;
    if (!Array.isArray(parsed.batches)) return null;
    return makeCostLedger({ batches: parsed.batches });
  } catch {
    return null;
  }
}

export function writeCostLedger(ledger, {
  ledgerPath = TEST_QUARRY_LEDGER_PATH,
  writeJsonAtomic = defaultWriteJsonAtomic,
} = {}) {
  writeJsonAtomic(ledgerPath, makeCostLedger(ledger));
}

function defaultWriteJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

export function appendQuarryMeasurements({
  files,
  elapsedMs,
  peakRssBytes,
  ledgerPath = TEST_QUARRY_LEDGER_PATH,
  existing = readCostLedger({ ledgerPath }),
  writeJsonAtomic = defaultWriteJsonAtomic,
} = {}) {
  const nextBatch = normalizeLedgerBatch({
    files, elapsed_ms: elapsedMs, peak_rss_bytes: peakRssBytes,
  });
  const key = nextBatch.files.join('\0');
  const batches = (existing?.batches || []).filter(batch => batch.files.join('\0') !== key);
  batches.push(nextBatch);
  const ledger = makeCostLedger({ batches });
  writeCostLedger(ledger, { ledgerPath, writeJsonAtomic });
  return ledger;
}

export function formatPackingReport({
  durations = authoredScenarioDurationSteps(),
  shardCount = 8,
  pinToShard0 = CALIBRATION_CI_SENTINEL,
} = {}) {
  const names = Object.keys(durations).sort();
  const costOf = name => durations[name] || 0;
  const modulo = Array.from({ length: shardCount }, () => []);
  names.forEach((name, index) => modulo[index % shardCount].push(name));
  const packed = packByCost(names, { shardCount, costOf, pinToShard0 });
  const loadOf = shard => shard.reduce((sum, name) => sum + costOf(name), 0);
  const lines = [
    '[test-quarry] measurement-only cost ledger — does not change science, baselines, or receipts',
    `[test-quarry] lineage ${TEST_QUARRY_SIM_LINEAGE}; packing ${TEST_QUARRY_PACKING}`,
    `[test-quarry] CI sentinel ${pinToShard0} stays on calibration shard 0`,
    `[test-quarry] evidence seed panel [${TEST_QUARRY_EVIDENCE_SEEDS.join(', ')}]`,
  ];
  const heavy = heavyScenarioEvidenceCosts(durations);
  for (const id of HEAVY_SCENARIO_IDS) {
    const row = heavy[id];
    lines.push(
      `[test-quarry] ${id}: ${row.duration_steps} steps × ${row.evidence_seeds} seeds → evidence cost ${row.evidence_cost} (calibration cost ${row.calibration_cost})`,
    );
  }
  for (let shard = 0; shard < shardCount; shard++) {
    const before = loadOf(modulo[shard]);
    const after = packed.loads[shard];
    const heavies = packed.shards[shard].filter(name => HEAVY_SCENARIO_IDS.includes(name));
    lines.push(
      `[test-quarry] shard ${shard}: modulo ${before} → packed ${after} (${packed.shards[shard].length} scenarios)${heavies.length ? `; heavy: ${heavies.join(', ')}` : ''}`,
    );
  }
  return lines.join('\n');
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.length === 0) {
      console.log('node tools/test-quarry-ledger.mjs --print-packing');
      console.log('Measurement-only. Does not change science, baselines, or receipts.');
      console.log('Foreman measurements live at .local-evidence/test-quarry-cost-ledger-v1.json');
    } else if (args.length === 1 && args[0] === '--print-packing') {
      console.log(formatPackingReport());
    } else {
      throw new Error(`unknown argument: ${args.join(' ')}`);
    }
  } catch (error) {
    console.error(`[test-quarry] FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
