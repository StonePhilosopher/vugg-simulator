import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  guidedTutorialBrowserPayloadDigest,
  readGuidedTutorialBrowserReceipt,
  verifyGuidedTutorialBrowserReceipt,
} from '../tools/guided-tutorial-browser-receipt.mjs';
import { attestOwnedDevToolsBrowserRuntime } from '../tools/owned-browser-runtime.mjs';

declare const SIM_VERSION: number;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function rehash(receipt: any, mutate: (clone: any) => void) {
  const clone = structuredClone(receipt);
  mutate(clone);
  clone.payload_sha256 = guidedTutorialBrowserPayloadDigest(clone.payload);
  return clone;
}

describe('authenticated public-control guided tutorial journeys', () => {
  it('binds complete Creative/Simulation journeys and lifecycle policy to this executable', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(verifyGuidedTutorialBrowserReceipt(ROOT, receipt, { simVersion: SIM_VERSION })).toBe(true);
    expect(receipt.payload.journeys.creative.authored_milestones).toEqual([4, 11, 20, 26, 41, 50]);
    expect(receipt.payload.journeys.creative.acid_product)
      .toMatchObject({ accepted_at_step: 50, carbonate_transaction_kind: 'ph_titration' });
    expect(receipt.payload.journeys.simulation.collected)
      .toEqual({
        record_id: 'cry-16-9vm',
        name: '<img data-vugg-player-name-probe src=x onerror="globalThis.__vuggPlayerNameInjection=1">',
        mineral: 'topaz',
        source_scenario: 'shigar_pegmatite',
        source_seed: 42,
      });
    expect(receipt.payload.journeys.player_surfaces).toMatchObject({
      collection_record_groove: {
        hostile_dom_nodes: 0,
        hostile_code_executed: false,
        playback_started_and_stopped: true,
      },
      strip_view: {
        production_origin: 'production-run',
        imported_origin: 'imported-file',
        visible_import_label: 'IMPORTED FILE',
        playback_started_and_stopped: true,
      },
      phone: { width: 390, height: 844 },
    });
  });

  it('rejects self-rehashed missing progress, false products, and resurrected tutorial state', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.journeys.creative.authored_milestones.splice(2, 1);
    }), { simVersion: SIM_VERSION })).toThrow(/Creative journey/);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.journeys.creative.acid_product.carbonate_preparation_transfer_count = 0;
      clone.payload.journeys.creative.acid_product.carbonate_transaction_index =
        clone.payload.journeys.creative.acid_product.carbonate_transactions_before_action;
    }), { simVersion: SIM_VERSION })).toThrow(/step-50 acid product/);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.journeys.save_load_policy.tutorial_resurrected = true;
    }), { simVersion: SIM_VERSION })).toThrow(/save\/load policy/);
  });

  it('rejects schema-smuggled claims even after payload rehash', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.journeys.simulation.aquamarine_present = true;
    }), { simVersion: SIM_VERSION })).toThrow(/Simulation journey/);
  });

  it('rejects coordinated plausible-but-false products after payload rehash', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.journeys.creative.pause.step_index = 999;
      clone.payload.journeys.creative.pause.paused_at = 999;
      const acid = clone.payload.journeys.creative.acid_product;
      acid.before_pH = 100;
      acid.after_pH = 99;
      acid.spatial_authority_count = 1;
      acid.carbonate_transactions_before_action = 0;
      acid.carbonate_preparation_transfer_count = 1;
      acid.carbonate_transaction_index = 1;
      clone.payload.journeys.simulation.collected.record_id = 'fabricated-record';
    }), { simVersion: SIM_VERSION })).toThrow(/Creative journey|step-50 acid product/);
  });

  it('rejects coordinated geology and owned-browser identity forgeries', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      const preservation = clone.payload.journeys.skip_cleanup.geology_preservation;
      preservation.before.fingerprint = 'f'.repeat(64);
      preservation.after.fingerprint = 'f'.repeat(64);
      preservation.before.run_id = 'fabricated-run';
      preservation.after.run_id = 'fabricated-run';
    }), { simVersion: SIM_VERSION })).toThrow(/exact Skip geology/);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      clone.payload.browser_runtime.executable_name = 'fabricated-browser';
    }), { simVersion: SIM_VERSION })).toThrow(/identity mismatch/);
  });

  it('rejects coordinated self-rehashed player-surface forgeries', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    expect(() => verifyGuidedTutorialBrowserReceipt(ROOT, rehash(receipt, clone => {
      const collection = clone.payload.journeys.player_surfaces.collection_record_groove;
      collection.stored_name = 'forged safe-looking name';
      collection.library_name_text = 'forged safe-looking name';
      collection.groove_name_text = '“forged safe-looking name”';
      collection.zone_count = 999;
      const strip = clone.payload.journeys.player_surfaces.strip_view;
      strip.download_sha256 = 'a'.repeat(64);
      strip.dataset_digest_sha256 = 'b'.repeat(64);
      strip.imported_digest_sha256 = 'b'.repeat(64);
      strip.imported_key = `imported:${strip.production_key}@sha256-${'b'.repeat(64)}`;
      clone.payload.journeys.player_surfaces.phone.width = 412;
    }), { simVersion: SIM_VERSION })).toThrow(/Library and Record Groove|Strip View|phone/);
  });

  it('verifies published browser evidence without requiring that browser on the review host', () => {
    const receipt = readGuidedTutorialBrowserReceipt(ROOT, SIM_VERSION);
    const prior = process.env.VUGG_BROWSER_BIN;
    process.env.VUGG_BROWSER_BIN = path.join(ROOT, '__review_host_has_a_different_browser__');
    try {
      expect(verifyGuidedTutorialBrowserReceipt(ROOT, receipt, { simVersion: SIM_VERSION }))
        .toBe(true);
    } finally {
      if (prior == null) delete process.env.VUGG_BROWSER_BIN;
      else process.env.VUGG_BROWSER_BIN = prior;
    }
  });

  it('rejects a configured launcher whose DevTools port belongs to different bytes', () => {
    expect(() => attestOwnedDevToolsBrowserRuntime({
      configuredExecutable: process.execPath,
      devToolsOwnerExecutable: path.join(ROOT, 'package.json'),
      browserProduct: 'Chrome/151.0.7922.173',
      protocolVersion: '1.3',
    })).toThrow(/does not match the DevTools port owner/);
  });
});
