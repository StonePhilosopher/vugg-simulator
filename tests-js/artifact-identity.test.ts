import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertStripIdentity } from '../tools/strip-identity.mjs';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: Record<string, any>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('archived strip testimony identity', () => {
  it('keeps simulation seed 42 distinct from every authored wall shape seed', () => {
    const entries = Object.entries(SCENARIOS);
    expect(entries).toHaveLength(39);
    for (const [scenario, makeScenario] of entries) {
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
