import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildReleaseManifests,
} from '../tools/release-audit.mjs';
import { buildLocalDiagnosticReceipt } from '../tools/local-diagnostics.mjs';

declare const RELEASE_RUNTIME_CONTRACT: any;
declare const SIM_VERSION: number;

describe('local release systems', () => {
  it('reproduces exact versioned content and asset manifests', async () => {
    const root = process.cwd();
    const { content, assets, runtimeContract } = await buildReleaseManifests();
    expect(runtimeContract).toEqual(RELEASE_RUNTIME_CONTRACT);
    expect(content).toEqual(JSON.parse(readFileSync(join(root, 'release', 'content-pack-manifest.json'), 'utf8')));
    expect(assets).toEqual(JSON.parse(readFileSync(join(root, 'release', 'asset-manifest.json'), 'utf8')));
    expect(content.packs[0]).toMatchObject({
      id: 'core',
      content_version: '1.0.0',
      compatibility: { sim_version: SIM_VERSION, save_format: RELEASE_RUNTIME_CONTRACT.save_format },
      counts: { scenarios: 41, minerals: 184, narratives: 94 },
    });
    expect(assets.renderer_lod_contract.scientific_authority)
      .toEqual(RELEASE_RUNTIME_CONTRACT.scientific_authority);
    expect(assets.renderer_lod_contract.presentation)
      .toEqual(RELEASE_RUNTIME_CONTRACT.presentation);
    expect(assets.audio_mix_states).toEqual({
      title: {
        source_asset: 'music-title',
        default_gain: RELEASE_RUNTIME_CONTRACT.audio_mix_states.title.default_gain,
        loops: RELEASE_RUNTIME_CONTRACT.audio_mix_states.title.loops,
      },
      building: {
        source_asset: 'music-building',
        default_gain: RELEASE_RUNTIME_CONTRACT.audio_mix_states.building.default_gain,
        loops: RELEASE_RUNTIME_CONTRACT.audio_mix_states.building.loops,
      },
      strip_view: {
        source_asset: null,
        music_gain: RELEASE_RUNTIME_CONTRACT.audio_mix_states.strip_view.music_gain,
        sonifier_default_master_gain:
          RELEASE_RUNTIME_CONTRACT.audio_mix_states.strip_view.sonifier_default_master_gain,
      },
      muted: {
        source_asset: null,
        gain: RELEASE_RUNTIME_CONTRACT.audio_mix_states.muted.gain,
      },
    });
    expect(assets.assets.every(asset => /^[0-9a-f]{64}$/.test(asset.sha256))).toBe(true);
    expect(assets.distribution_status).toContain('human-clearance-required');
  });

  it('builds a timestamp-free local-only diagnostic without claiming stale evidence is current', async () => {
    const receipt = await buildLocalDiagnosticReceipt();
    expect(receipt).toMatchObject({
      schema: 'vugg-local-diagnostic-receipt-v1',
      privacy: {
        telemetry: false,
        network_requests: 0,
        absolute_paths_included: false,
      },
      identity: {
        sim_version: SIM_VERSION,
        model_digest_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        browser_bundle_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        runtime_execution_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      science_evidence: {
        present: true,
        exact_execution_match: expect.any(Boolean),
        mismatches: expect.any(Array),
      },
      receipt_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(receipt)).not.toMatch(/generated_at|recorded_at|[A-Z]:\\Users\\/i);
    expect(receipt.source.dirty_paths.every(path => !path.startsWith('ata/'))).toBe(true);
  });

  it('ships an external evidence template with every human gate honestly pending', () => {
    const template = JSON.parse(readFileSync(join(process.cwd(), 'docs', 'external-gate-evidence-template.json'), 'utf8'));
    expect(Object.keys(template.gates)).toHaveLength(4);
    expect(Object.values(template.gates).every((gate: any) => gate.status === 'pending')).toBe(true);
    expect(Object.values(template.candidate).every(value => value === null)).toBe(true);
  });
});
