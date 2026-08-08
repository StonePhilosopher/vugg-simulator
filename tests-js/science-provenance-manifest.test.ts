import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: any;
declare const EVENT_REGISTRY: any;
declare const scenarioSpecHash: (spec: any) => string;

const ROOT = process.cwd();
const manifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'generated', 'science-provenance-manifest.json'),
  'utf8',
));

describe('generated science/provenance manifest', () => {
  it('is tied to the current model and complete authored fleet', () => {
    expect(manifest).toMatchObject({
      schema: 'vugg-science-provenance-manifest-v1',
      sim_version: SIM_VERSION,
      model_digest: MODEL_DIGEST,
      canonical_run_seed: 42,
      validation: { status: 'PASS', error_count: 0 },
    });
    expect(manifest.scenarios.map((row: any) => row.id).sort()).toEqual(
      Object.keys(SCENARIOS).sort(),
    );
  });

  it('pins citations, registered handlers, authored shape seeds, and archive metadata', () => {
    for (const row of manifest.scenarios) {
      const spec = SCENARIOS[row.id]._json5_spec;
      expect(row.citations.length, `${row.id}: citations`).toBeGreaterThan(0);
      expect(row.scenario_spec_hash, `${row.id}: spec hash`).toBe(scenarioSpecHash(spec));
      expect(row.initial.shape_seed, `${row.id}: shape seed`).toBe(spec.initial.wall.shape_seed);
      expect(row.archive, `${row.id}: archive`).toMatchObject({
        sim_version: SIM_VERSION,
        model_digest: MODEL_DIGEST,
        scenario_spec_hash: row.scenario_spec_hash,
        seed: 42,
      });
      for (const type of row.event_types) {
        expect(typeof EVENT_REGISTRY[type], `${row.id}: ${type}`).toBe('function');
      }
    }
  });
});
