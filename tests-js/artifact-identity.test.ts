import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertStripIdentity } from '../tools/strip-identity.mjs';
import { loadAuthenticatedEvidenceJson } from './authenticated-evidence';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: Record<string, any>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('archived strip testimony identity', () => {
  it('keeps every wall shape seed explicit and independent of the simulation RNG channel', () => {
    const entries = Object.entries(SCENARIOS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [scenario, makeScenario] of entries) {
      // Numerical equality is allowed: stalactite_demo deliberately authors
      // shape_seed 42. Independence means the shape seed lives in the
      // scenario spec instead of being inferred from the simulation seed.
      expect(
        makeScenario._json5_spec?.initial?.wall?.shape_seed,
        `${scenario} must author initial.wall.shape_seed independently of the simulation seed`,
      ).toEqual(expect.any(Number));
      expect(
        Number.isInteger(makeScenario._json5_spec.initial.wall.shape_seed),
        `${scenario} shape_seed must be an integer`,
      ).toBe(true);
    }
  });

  it('binds every current strip to model, scenario spec, seed, and filename', () => {
    const dir = path.join(ROOT, 'archive', 'strips', `v${SIM_VERSION}`);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(Object.keys(SCENARIOS).length);
    for (const file of files) {
      const scenario = file.replace(/\.json$/, '');
      const strip = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const receiptedStrip = loadAuthenticatedEvidenceJson(
        `archive/strips/v${SIM_VERSION}/${file}`,
        'strip-archive',
      );
      expect(receiptedStrip, `${file} aggregate evidence binding`).toEqual(strip);
      const scenarioSpecHash = crypto.createHash('sha256')
        .update(JSON.stringify(SCENARIOS[scenario]._json5_spec))
        .digest('hex');
      expect(() => assertStripIdentity(strip, {
        version: SIM_VERSION,
        modelDigest: MODEL_DIGEST,
        scenario,
        seed: 42,
        scenarioSpecHash,
      }), file).not.toThrow();
      expect(strip.format, file).toBe('strip-story-v2');
      expect(strip.executed_testimony?.pressure_phase, file).toHaveLength(strip.steps);
      expect(strip.executed_testimony?.carbonate_boundary || [], file)
        .toHaveLength(SCENARIOS[scenario]._json5_spec?.carbonate_boundary ? strip.steps : 0);
      const { conditions } = SCENARIOS[scenario]();
      const sulfurLedger = strip.executed_testimony?.sulfur_ledger || [];
      if (conditions.fluid.sulfurPoolsExplicit) {
        expect(sulfurLedger, `${file} constructor-explicit sulfur testimony length`)
          .toHaveLength(strip.steps);
        expect(sulfurLedger[0]?.activation, `${file} constructor activation`).toMatchObject({
          step: 0,
          kind: 'constructor_explicit_reservoirs',
          closed: true,
        });
      } else if (sulfurLedger.length) {
        const first = sulfurLedger[0];
        expect(sulfurLedger, `${file} continuous mid-run sulfur testimony`)
          .toHaveLength(strip.steps - first.sample_index);
        expect(first.activation, `${file} authenticated mid-run sulfur activation`).toMatchObject({
          step: first.step,
          kind: 'legacy_combined_to_explicit_reservoirs',
          closed: true,
        });
      }
      for (const sample of sulfurLedger) {
        expect(sample, `${file} sulfur testimony schema`).toMatchObject({
          step: expect.any(Number),
          sample_index: expect.any(Number),
          fluidReservoirPpm: {
            sulfide: expect.any(Number),
            sulfate: expect.any(Number),
            elemental: expect.any(Number),
          },
          solidReservoirPpm: {
            sulfide: expect.any(Number),
            sulfate: expect.any(Number),
            elemental: expect.any(Number),
            unclassified: expect.any(Number),
          },
          phaseIdentity: expect.any(Array),
          errorPpm: expect.any(Number),
          testimonyErrorPpm: expect.any(Number),
          propagationViolations: 0,
          testimonyClosed: true,
          closed: true,
        });
        const phaseTotal = sample.phaseIdentity.reduce(
          (sum: number, phase: any) => sum + Number(phase.bookedSolidPpm || 0),
          0,
        );
        expect(phaseTotal, `${file} step ${sample.step} phase-resolved solid testimony`)
          .toBeCloseTo(sample.solidPpm, 8);
      }
      if (scenario === 'supergene_oxidation') {
        // The authored Tsumeb sulfur boundary starts at the first explicit
        // sulfate pulse, not at the later dry-season recharge.  Keep this
        // chronology aligned with data/scenarios.json5, 70i-supergene.ts, and
        // the claim-card sulfur ledger rather than pinning the retired
        // hard-coded step-70-only implementation.
        expect(sulfurLedger[0]).toMatchObject({
          step: 5,
          sample_index: 4,
          activation: {
            step: 5,
            kind: 'legacy_combined_to_explicit_reservoirs',
            closed: true,
          },
          closed: true,
        });
        expect(sulfurLedger.map((sample: any) => sample.sample_index))
          .toEqual(Array.from({ length: strip.steps - 4 }, (_, i) => i + 4));
        expect(sulfurLedger.every((sample: any) => sample.step === sample.sample_index + 1))
          .toBe(true);

        const authoredSulfurAdditions = SCENARIOS[scenario]._json5_spec.events
          .filter((event: any) => event.sulfur_boundary?.kind === 'addition')
          .map((event: any) => {
            const pools = event.sulfur_boundary.pools;
            expect(Object.keys(pools), `supergene step ${event.step} sulfur valence`).toEqual(['sulfate']);
            return {
              step: event.step,
              ppmPerFluid: Object.values(pools)
                .reduce((sum: number, value: any) => sum + Number(value), 0),
            };
          });
        const voxelCount = sulfurLedger[0].activation.beforeCount;
        expect(Number.isSafeInteger(voxelCount) && voxelCount > 0).toBe(true);
        const importChanges = sulfurLedger
          .map((sample: any, index: number) => ({
            step: sample.step,
            deltaPpm: sample.importsPpm - (index ? sulfurLedger[index - 1].importsPpm : 0),
          }))
          .filter((row: any) => Math.abs(row.deltaPpm) > 1e-9);
        expect(importChanges.map((row: any) => row.step))
          .toEqual(authoredSulfurAdditions.map((row: any) => row.step));
        for (let i = 0; i < importChanges.length; i++) {
          expect(importChanges[i].deltaPpm, `supergene step ${importChanges[i].step} sulfur import`)
            .toBeCloseTo(authoredSulfurAdditions[i].ppmPerFluid * voxelCount, 8);
        }
        expect(sulfurLedger.find((sample: any) => sample.step === 55)?.importsPpm)
          .toBe(sulfurLedger.find((sample: any) => sample.step === 54)?.importsPpm);
        expect(sulfurLedger.every((sample: any) => (
          sample.exportsPpm === 0
          && sample.propagationViolations === 0
          && sample.testimonyClosed === true
          && sample.closed === true
        ))).toBe(true);
      }
      for (const event of strip.executed_testimony?.stress_events || []) {
        expect(event.event_id, `${file} stress id`).toMatch(/^stress-\d+-\d+$/);
        expect(event.evaluated_crystals, `${file} stress outcomes`).toBeInstanceOf(Array);
        for (const grain of event.evaluated_crystals) {
          expect(grain, `${file} stress grain`).toMatchObject({
            crystal_id: expect.any(Number),
            mineral: expect.any(String),
            schmid_factor: expect.any(Number),
            resolved_shear_mpa: expect.any(Number),
            crss_mpa: expect.any(Number),
            outcome: expect.stringMatching(/already_twinned|twinned|below_crss/),
          });
        }
      }
    }
  });

  it('rejects tampered, misfiled, or incomplete testimony', () => {
    const expected = {
      version: 238, modelDigest: 'science-A', scenario: 'mvt', seed: 42,
      scenarioSpecHash: 'spec-A',
    };
    const valid = {
      sim_version: 238, model_digest: 'science-A', scenario: 'mvt', seed: 42,
      scenario_spec_hash: 'spec-A',
    };
    expect(() => assertStripIdentity({ ...valid, model_digest: undefined }, expected)).toThrow(/digest mismatch/);
    expect(() => assertStripIdentity({ ...valid, sim_version: 237 }, expected)).toThrow(/version mismatch/);
    expect(() => assertStripIdentity({ ...valid, scenario: 'sabkha' }, expected)).toThrow(/scenario mismatch/);
    expect(() => assertStripIdentity({ ...valid, seed: 7 }, expected)).toThrow(/seed mismatch/);
    expect(() => assertStripIdentity({ ...valid, scenario_spec_hash: 'tampered' }, expected)).toThrow(/spec hash mismatch/);
  });
});
