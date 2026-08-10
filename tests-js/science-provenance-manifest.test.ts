import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { localityFrequencySpecHash } from '../tools/locality-frequency-contract.mjs';

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
      schema: 'vugg-science-provenance-manifest-v4',
      sim_version: SIM_VERSION,
      model_digest: MODEL_DIGEST,
      canonical_run_seed: 42,
      validation: { status: 'PASS', error_count: 0 },
    });
    expect(manifest.scenarios.map((row: any) => row.id).sort()).toEqual(
      Object.keys(SCENARIOS).sort(),
    );
    expect(manifest.thermo_pressure_grid).toMatchObject({
      model_id: 'SUPCRTBL-delta-logK-pressure-grid-v1',
      artifact_origin: 'offline SUPCRTBL commissioning calculation',
      source_model: { software: 'Reaktoro', version: '2.13.0', database: 'supcrtbl' },
      reference_pressure_kbar: 0.001,
      water_density_min_g_cm3: 0.35,
    });
    expect(manifest.thermo_pressure_grid.reactions).toHaveLength(8);
    expect(manifest.thermo_pressure_grid.sources).toHaveLength(3);
    expect(manifest.thermo_pressure_grid.reproducibility).toMatchObject({
      verifier: { path: 'tools/check-pressure-grid.mjs' },
      command: 'npm run check:pressure-grid',
      runtime: 'Node.js/TypeScript only',
    });
    expect(manifest.thermo_pressure_grid.reproducibility.verifier.sha256)
      .toMatch(/^[a-f0-9]{64}$/);

    const frequencyBytes = fs.readFileSync(path.join(ROOT, manifest.locality_frequency.path));
    expect(manifest.locality_frequency).toMatchObject({
      schema: 'vugg-locality-frequency-baseline-v1',
      sim_version: SIM_VERSION,
      model_digest: MODEL_DIGEST,
      seeds: [1, 2, 42],
      scenario_count: Object.keys(SCENARIOS).length,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(manifest.locality_frequency.sha256)
      .toBe(crypto.createHash('sha256').update(frequencyBytes).digest('hex'));
  });

  it('pins citations, registered handlers, authored shape seeds, and archive metadata', () => {
    for (const row of manifest.scenarios) {
      const spec = SCENARIOS[row.id]._json5_spec;
      expect(row.citations.length, `${row.id}: citations`).toBeGreaterThan(0);
      expect(row.scenario_spec_hash, `${row.id}: spec hash`).toBe(scenarioSpecHash(spec));
      expect(row.locality_frequency_spec_hash, `${row.id}: frequency contract hash`)
        .toBe(localityFrequencySpecHash(spec));
      expect(row.initial.shape_seed, `${row.id}: shape seed`).toBe(spec.initial.wall.shape_seed);
      expect(row.archive, `${row.id}: archive`).toMatchObject({
        sim_version: SIM_VERSION,
        model_digest: MODEL_DIGEST,
        scenario_spec_hash: row.scenario_spec_hash,
        seed: 42,
        strip_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const stripBytes = fs.readFileSync(path.join(ROOT, row.archive.path));
      expect(row.archive.strip_sha256, `${row.id}: archived strip bytes`)
        .toBe(crypto.createHash('sha256').update(stripBytes).digest('hex'));
      for (const type of row.event_types) {
        expect(typeof EVENT_REGISTRY[type], `${row.id}: ${type}`).toBe('function');
      }
    }
  });
});
