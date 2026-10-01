import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scenariosForShard } from './calibration-lib';
import {
  CALIBRATION_CI_SENTINEL,
  HEAVY_SCENARIO_IDS,
  TEST_QUARRY_EVIDENCE_SEED_COUNT,
  TEST_QUARRY_LEDGER_SCHEMA,
  TEST_QUARRY_LEDGER_TRUST,
  TEST_QUARRY_SIM_LINEAGE,
  TEST_QUARRY_TIERS,
  appendQuarryMeasurements,
  authoredScenarioDurationSteps,
  formatPackingReport,
  heavyScenarioEvidenceCosts,
  packByCost,
  packedNamesForShard,
  quarryEntryFromBisbeeBudgetReceipt,
  quarryProxyCost,
  quarryTierForTestFile,
  readCostLedger,
} from '../tools/test-quarry-ledger.mjs';

const moduloShard = (names: string[], shard: number, shardCount: number) =>
  [...names].sort().filter((_, index) => index % shardCount === shard);

describe('Test Quarry measurement-only cost ledger', () => {
  it('reads authored duration_steps for Bisbee and the matching heavy scenarios', () => {
    const durations = authoredScenarioDurationSteps();
    expect(durations.bisbee).toBe(340);
    expect(durations.naica_geothermal).toBe(320);
    expect(durations.searles_lake).toBe(300);
    expect(durations.sabkha_dolomitization).toBe(260);
    expect(durations.roughten_gill).toBe(240);
    expect(TEST_QUARRY_EVIDENCE_SEED_COUNT).toBe(3);
    expect(heavyScenarioEvidenceCosts(durations).bisbee).toMatchObject({
      duration_steps: 340,
      calibration_cost: 340,
      evidence_cost: 1020,
      tier: 'evidence',
    });
    expect(quarryProxyCost({ durationSteps: 340, seeds: 3 })).toBe(1020);
  });

  it('packs by cost without dropping or duplicating names', () => {
    const names = ['a', 'b', 'c', 'd', 'e'];
    const costOf = (name: string) => ({ a: 10, b: 8, c: 3, d: 3, e: 1 }[name] || 0);
    const packed = packByCost(names, { shardCount: 2, costOf });
    expect(packed.shards.flat().sort()).toEqual([...names].sort());
    expect(new Set(packed.shards.flat()).size).toBe(names.length);
    expect(packed.loads[0] + packed.loads[1]).toBe(25);
    expect(Math.abs(packed.loads[0] - packed.loads[1])).toBeLessThanOrEqual(3);
  });

  it('spreads the heavy scenarios that name-modulo stacked on shard 0', () => {
    const durations = authoredScenarioDurationSteps();
    const names = Object.keys(durations).sort();
    const shardCount = 8;
    const moduloZero = moduloShard(names, 0, shardCount);
    expect(moduloZero).toEqual(expect.arrayContaining([
      'naica_geothermal', 'sabkha_dolomitization', CALIBRATION_CI_SENTINEL,
    ]));

    const packed = packByCost(names, {
      shardCount,
      costOf: (name: string) => durations[name],
      pinToShard0: CALIBRATION_CI_SENTINEL,
    });
    expect(packed.shards[0]).toContain(CALIBRATION_CI_SENTINEL);
    expect(scenariosForShard(durations, 0)).toEqual(packed.shards[0]);
    expect(scenariosForShard(durations, 0)).toContain(CALIBRATION_CI_SENTINEL);

    const home = new Map<string, number>();
    packed.shards.forEach((shard, index) => {
      for (const name of shard) home.set(name, index);
    });
    const heavyHomes = HEAVY_SCENARIO_IDS.map(id => home.get(id));
    expect(heavyHomes.every(index => Number.isInteger(index))).toBe(true);
    expect(new Set(heavyHomes).size).toBe(HEAVY_SCENARIO_IDS.length);

    const union = packed.shards.flat().sort();
    expect(union).toEqual(names);
    expect(moduloShard(names, 0, shardCount).sort()).not.toEqual(packed.shards[0]);
  });

  it('keeps the CI sentinel on shard 0 after a rotation', () => {
    const names = ['supergene_oxidation', 'bisbee', 'light'];
    const packed = packByCost(names, {
      shardCount: 2,
      costOf: (name: string) => ({ supergene_oxidation: 1, bisbee: 100, light: 1 }[name] || 0),
      pinToShard0: CALIBRATION_CI_SENTINEL,
    });
    expect(packed.shards[0]).toContain(CALIBRATION_CI_SENTINEL);
    expect(packedNamesForShard(names, 0, 2, {
      costOf: () => 1,
      pinToShard0: CALIBRATION_CI_SENTINEL,
    })).toContain(CALIBRATION_CI_SENTINEL);
  });

  it('labels Bisbee production-budget work as canary without treating it as science', () => {
    expect(TEST_QUARRY_TIERS).toEqual(['presubmit', 'canary', 'evidence']);
    expect(quarryTierForTestFile('tests-js/cavity-production-bisbee-performance.test.ts'))
      .toBe('canary');
    expect(quarryTierForTestFile('tests-js/calibration-shard-3.test.ts')).toBe('evidence');
    expect(quarryTierForTestFile('tests-js/test-workflow.test.ts')).toBe('presubmit');
    const entry = quarryEntryFromBisbeeBudgetReceipt({
      steps: 70,
      elapsed_ms: 12_000,
      peak_rss_mb: 200,
    });
    expect(entry).toMatchObject({
      work: 'bisbee-production-budget',
      scenario: 'bisbee',
      tier: 'canary',
      cost: 70,
      science: 'does-not-change-baselines-or-receipts',
    });
    expect(entry.note).toMatch(/340 steps/);
  });

  it('writes an untrusted operator ledger keyed by file list', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-quarry-ledger-'));
    try {
      const ledgerPath = path.join(directory, 'ledger.json');
      appendQuarryMeasurements({
        files: ['tests-js/cavity-production-bisbee-performance.test.ts'],
        elapsedMs: 1234.5,
        peakRssBytes: 50_000_000,
        ledgerPath,
      });
      appendQuarryMeasurements({
        files: ['tests-js/cavity-production-bisbee-performance.test.ts'],
        elapsedMs: 1300,
        peakRssBytes: 51_000_000,
        ledgerPath,
      });
      const ledger = readCostLedger({ ledgerPath });
      expect(ledger).toMatchObject({
        schema: TEST_QUARRY_LEDGER_SCHEMA,
        trust: TEST_QUARRY_LEDGER_TRUST,
        sim_lineage: TEST_QUARRY_SIM_LINEAGE,
        science: 'does-not-change-baselines-or-receipts',
      });
      expect(ledger?.batches).toHaveLength(1);
      expect(ledger?.batches[0]).toMatchObject({
        files: ['tests-js/cavity-production-bisbee-performance.test.ts'],
        elapsed_ms: 1300,
        peak_rss_bytes: 51_000_000,
        tiers: ['canary'],
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('prints a packing report that refuses science authority', () => {
    const report = formatPackingReport();
    expect(report).toContain('does not change science, baselines, or receipts');
    expect(report).toContain(TEST_QUARRY_SIM_LINEAGE);
    expect(report).toContain('bisbee: 340 steps × 3 seeds');
    expect(report).toContain(`CI sentinel ${CALIBRATION_CI_SENTINEL} stays on calibration shard 0`);
    expect(report).not.toMatch(/SIM 237|seed42_v237/);
  });
});
