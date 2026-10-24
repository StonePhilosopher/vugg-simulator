import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CURRENT_HASH_POLICY, bytesForHash, sha256Bytes } from '../tools/hash-policy.mjs';
import { buildReleaseManifests, CORE_CONTENT_VERSION } from '../tools/release-audit.mjs';
import { buildLocalDiagnosticReceipt } from '../tools/local-diagnostics.mjs';

declare const RELEASE_RUNTIME_CONTRACT: any;
declare const SIM_VERSION: number;

describe('local release systems', () => {
  it('gives LF, CRLF, and mixed authored text one portable content identity', () => {
    // Release receipts consume the repository-wide hash policy. Exercise that
    // authority directly rather than keeping a second release-only newline
    // normaliser whose behavior can drift from every other producer.
    const root = mkdtempSync(join(tmpdir(), 'vugg-release-policy-'));
    try {
      const paths = ['lf.md', 'crlf.md', 'mixed.md'].map(name => join(root, name));
      writeFileSync(paths[0], 'alpha\nbeta\ngamma\n');
      writeFileSync(paths[1], 'alpha\r\nbeta\r\ngamma\r\n');
      writeFileSync(paths[2], 'alpha\rbeta\r\ngamma\n');
      expect(readFileSync(paths[1])).not.toEqual(readFileSync(paths[0]));

      const receipts = paths.map(file => {
        const bytes = bytesForHash(file, CURRENT_HASH_POLICY);
        return { bytes: bytes.length, sha256: sha256Bytes(bytes) };
      });
      expect(receipts[1]).toEqual(receipts[0]);
      expect(receipts[2]).toEqual(receipts[0]);
      expect(receipts[0]).toMatchObject({ bytes: 17 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reproduces exact versioned content and asset manifests', async () => {
    const root = process.cwd();
    const { content, assets, runtimeContract } = await buildReleaseManifests();
    expect(runtimeContract).toEqual(RELEASE_RUNTIME_CONTRACT);
    expect(content).toEqual(JSON.parse(readFileSync(join(root, 'release', 'content-pack-manifest.json'), 'utf8')));
    expect(assets).toEqual(JSON.parse(readFileSync(join(root, 'release', 'asset-manifest.json'), 'utf8')));
    expect(content.packs[0]).toMatchObject({
      id: 'core',
      content_version: CORE_CONTENT_VERSION,
      compatibility: { sim_version: SIM_VERSION, save_format: RELEASE_RUNTIME_CONTRACT.save_format },
      counts: { scenarios: 41, minerals: 184, narratives: 94 },
    });
    expect(CORE_CONTENT_VERSION).toBe('1.0.3');
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
