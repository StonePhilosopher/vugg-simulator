import fs from 'node:fs';
import path from 'node:path';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  nodeRuntimeIdentity,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';
import { sha256Bytes, writeJsonAtomic } from './scenario-evidence-checkpoint.mjs';
import { verifyOwnedDevToolsBrowserRuntime } from './owned-browser-runtime.mjs';
import { parseScenarioDocument } from './scenario-authoring.mjs';

export const GUIDED_TUTORIAL_BROWSER_RECEIPT_SCHEMA =
  'vugg-guided-tutorial-browser-receipt-v5';
export const GUIDED_TUTORIAL_BROWSER_PRODUCER = 'guided-tutorial-browser';

const exactKeys = (value, keys) => value && typeof value === 'object'
  && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function guidedTutorialBrowserPayloadDigest(payload) {
  return sha256Bytes(Buffer.from(canonicalJson(payload), 'utf8'));
}

function assertCleanup(value, label) {
  if (!exactKeys(value, ['tutorial_null', 'callouts', 'locks'])
      || value.tutorial_null !== true || value.callouts !== 0 || value.locks !== 0) {
    throw new Error(`guided tutorial browser receipt has open ${label} teardown`);
  }
}

// These are deterministic products of the exact controlled public-control
// journeys. The verifier does not trust coordinated, internally plausible
// numbers supplied by the receipt itself: it compares them to this producer
// authority, whose bytes are included in the producer-contract digest.
const EXPECTED_GEOLOGY = Object.freeze({
  save_load: Object.freeze({
    runtime: 'fortress', scenario: 'tutorial_travertine', step: 1,
    fingerprint: '90dff7024c93d11fa90285ff9ea026c8bf722b1cbfc584bdae68538658652c23',
    run_id: 'save-16-i77',
  }),
  creative_completion: Object.freeze({
    runtime: 'fortress', scenario: 'tutorial_travertine', step: 50,
    fingerprint: '8c2eb2f17bf6355e14bfb98acaaaab16d451c26c89980cb3092edfb2af9e238e',
    run_id: 'save-16-jua',
  }),
  skip: Object.freeze({
    runtime: 'fortress', scenario: 'tutorial_mn_calcite', step: 0,
    fingerprint: '143c9a8881f813dc12baf49708c978b0fdb9e943b5c396149faaaa3ba99015a5',
    run_id: 'save-16-mhf',
  }),
  simulation_completion: Object.freeze({
    runtime: 'simulation', scenario: 'shigar_pegmatite', step: 70,
    fingerprint: '1285a3ec239fc66f883ccf4fd780bffb5134ca194786edde6a433c4675d7f0f6',
    run_id: 'd074d29098a55892e371c2ad12bc604ccb99cba6ae26bc5ae7a9fc015b73e3b6',
  }),
});
const EXPECTED_COLLECTION_RECORD_ID = 'cry-16-33x';
const EXPECTED_COLLECTION_NAME = '<img data-vugg-player-name-probe src=x onerror="globalThis.__vuggPlayerNameInjection=1">';
// Replaced with the exact SIM 285 values after the owned-browser source freeze.
const EXPECTED_GAME04_DATASET_SHA256 = 'd074d29098a55892e371c2ad12bc604ccb99cba6ae26bc5ae7a9fc015b73e3b6';
const EXPECTED_GAME04_DOWNLOAD_SHA256 = 'fc1a173eb221bff3f4c621232f2c1ec66692a53ec16655ba5478f4375d56db0b';
const EXPECTED_BROWSER_RUNTIME = Object.freeze({
  schema: 'vugg-owned-devtools-browser-runtime-v2',
  executable_name: 'chrome.exe',
  executable_sha256: 'bd88b26777496cef22fc09860164da7cba4a5c77e1dcbf5ad3a3967aa457d715',
  devtools_browser_product: 'Chrome/151.0.7922.173',
  devtools_protocol_version: '1.3',
});

function assertGeologyPreservation(value, expected, label) {
  if (!exactKeys(value, ['schema', 'before', 'after'])
      || value.schema !== 'guided-tutorial-geology-preservation-v1') {
    throw new Error(`guided tutorial browser receipt has invalid ${label} geology schema`);
  }
  for (const identity of [value.before, value.after]) {
    if (!exactKeys(identity, ['runtime', 'scenario', 'step', 'fingerprint', 'run_id'])
        || identity.runtime !== expected.runtime
        || identity.scenario !== expected.scenario
        || identity.step !== expected.step
        || identity.fingerprint !== expected.fingerprint
        || identity.run_id !== expected.run_id) {
      throw new Error(`guided tutorial browser receipt does not preserve exact ${label} geology`);
    }
  }
  if (canonicalJson(value.before) !== canonicalJson(value.after)) {
    throw new Error(`guided tutorial browser receipt changes ${label} geology`);
  }
}

function grandTourSavesSourceAuthority(root) {
  const source = fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8');
  const tutorial = parseScenarioDocument(source)?.scenarios
    ?.tutorial_first_crystal?.tutorial;
  const steps = tutorial?.steps;
  if (!Array.isArray(steps)) {
    throw new Error('guided tutorial browser receipt cannot resolve Tutorial 1 source');
  }
  const savesStepIndex = steps.findIndex(step => step?.anchor === '#mode-saves');
  const homeStepIndex = steps.findIndex(step => step?.anchor === '#mode-home');
  const saves = steps[savesStepIndex];
  const home = steps[homeStepIndex];
  if (savesStepIndex < 0 || homeStepIndex !== savesStepIndex + 1
      || saves?.spotlight !== '#mode-toggle' || home?.spotlight !== '#mode-toggle'
      || typeof saves?.text !== 'string' || typeof home?.text !== 'string') {
    throw new Error('guided tutorial browser receipt has invalid Tutorial 1 Saves source');
  }
  return {
    savesStepIndex,
    homeStepIndex,
    savesText: saves.text,
    homeText: home.text,
  };
}

export function verifyGuidedTutorialJourneys(journeys, simVersion, { root } = {}) {
  if (typeof root !== 'string' || !root) {
    throw new Error('guided tutorial browser journey verifier lacks a source root');
  }
  if (!exactKeys(journeys, [
    'schema', 'trust', 'sim_version', 'grand_tour_saves_lesson', 'creative', 'simulation',
    'save_load_policy', 'skip_cleanup', 'player_surfaces',
  ])
      || journeys.schema !== 'guided-tutorial-browser-journeys-v4'
      || journeys.trust !== 'local-owned-browser-player-controls-not-independent-attestation'
      || journeys.sim_version !== Number(simVersion)) {
    throw new Error('guided tutorial browser journey identity mismatch');
  }
  const sourceAuthority = grandTourSavesSourceAuthority(root);
  const grandTour = journeys.grand_tour_saves_lesson;
  if (!exactKeys(grandTour, [
    'scenario', 'entry', 'controls', 'quick_nav_ids', 'saves', 'home', 'teardown',
  ])
      || grandTour.scenario !== 'tutorial_first_crystal'
      || grandTour.entry !== 'Begin menu Tutorial 1 button'
      || canonicalJson(grandTour.controls) !== canonicalJson(['Continue'])
      || canonicalJson(grandTour.quick_nav_ids) !== canonicalJson([
        'mode-current', 'mode-groove', 'mode-stripview',
        'mode-library', 'mode-saves', 'mode-home',
      ])) {
    throw new Error('guided tutorial browser receipt does not close the Grand Tour Saves entry');
  }
  if (!exactKeys(grandTour.saves, [
    'step_index', 'trigger', 'anchor_id', 'highlighted', 'policy_text',
  ])
      || grandTour.saves.step_index !== sourceAuthority.savesStepIndex
      || grandTour.saves.trigger !== 'continue'
      || grandTour.saves.anchor_id !== 'mode-saves'
      || grandTour.saves.highlighted !== true
      || grandTour.saves.policy_text !== sourceAuthority.savesText) {
    throw new Error('guided tutorial browser receipt does not close the Grand Tour Saves lesson');
  }
  if (!exactKeys(grandTour.home, [
    'step_index', 'trigger', 'anchor_id', 'highlighted', 'preservation_text',
  ])
      || grandTour.home.step_index !== sourceAuthority.homeStepIndex
      || grandTour.home.trigger !== 'continue'
      || grandTour.home.anchor_id !== 'mode-home'
      || grandTour.home.highlighted !== true
      || grandTour.home.preservation_text !== sourceAuthority.homeText) {
    throw new Error('guided tutorial browser receipt does not close the Grand Tour Home lesson');
  }
  assertCleanup(grandTour.teardown, 'Grand Tour');
  const creative = journeys.creative;
  if (!exactKeys(creative, [
    'scenario', 'entry', 'controls', 'geological_step', 'authored_milestones',
    'pause', 'acid_product', 'geology_preservation', 'teardown',
  ])
      || creative.scenario !== 'tutorial_travertine'
      || creative.entry !== 'Begin menu Tutorial 3 button'
      || canonicalJson(creative.controls) !== canonicalJson([
        'Continue', 'Advance', '0.2s narrative speed', 'Tweak acid', 'Finish tutorial',
      ])
      || creative.geological_step !== 50
      || canonicalJson(creative.authored_milestones) !== canonicalJson([4, 11, 20, 26, 41, 50])
      || !exactKeys(creative.pause, ['step_index', 'paused_at', 'trigger'])
      || creative.pause.step_index !== 10
      || creative.pause.paused_at !== 10
      || creative.pause.trigger !== 'continue') {
    throw new Error('guided tutorial browser receipt does not close the Creative journey');
  }
  const acid = creative.acid_product;
  if (!exactKeys(acid, [
    'schema', 'product', 'action', 'accepted_at_step', 'before_pH', 'after_pH',
    'spatial_authority_schema', 'spatial_authority_scope',
    'spatial_authority_count', 'spatial_authority_closed',
    'carbonate_transaction_kind', 'carbonate_transaction_index',
    'carbonate_transactions_before_action', 'carbonate_preparation_transfer_count',
  ])
      || acid.schema !== 'fortress-fluid-action-product-v1'
      || acid.product !== 'carbonate-acid-titration'
      || acid.action !== 'tweak_acidify'
      || acid.accepted_at_step !== 50
      || acid.before_pH !== 8.228259199917794
      || acid.after_pH !== 7.928259199917797
      || acid.spatial_authority_schema !== 'player-fluid-spatial-intervention-v1'
      || acid.spatial_authority_scope !== 'canonical-nonvadose-voxel-volume'
      || acid.spatial_authority_count !== 7680
      || acid.spatial_authority_closed !== true
      || acid.carbonate_transaction_kind !== 'ph_titration'
      || acid.carbonate_transactions_before_action !== 139
      || acid.carbonate_preparation_transfer_count !== 2
      || acid.carbonate_transaction_index !== 141) {
    throw new Error('guided tutorial browser receipt lacks the committed step-50 acid product');
  }
  assertGeologyPreservation(
    creative.geology_preservation,
    EXPECTED_GEOLOGY.creative_completion,
    'Creative completion',
  );
  assertCleanup(creative.teardown, 'Creative');

  const simulation = journeys.simulation;
  if (!exactKeys(simulation, [
    'scenario', 'seed', 'steps', 'shape_seed_override', 'cavity_size', 'entry',
    'controls', 'collected', 'library_result', 'geology_preservation', 'teardown',
  ])
      || simulation.scenario !== 'shigar_pegmatite' || simulation.seed !== 42
      || simulation.steps !== 70 || simulation.shape_seed_override !== ''
      || simulation.cavity_size !== 'any'
      || simulation.entry !== 'Begin menu Tutorial 4 button'
      || canonicalJson(simulation.controls) !== canonicalJson([
        'Continue', 'Grow', '0.2s narrative speed', 'prologue gate', 'epilogue gate',
        'Collect topaz', 'Library', 'search topaz', 'Finish tutorial',
      ])
      || simulation.library_result !== 'topaz'
      || !exactKeys(simulation.collected, [
        'record_id', 'name', 'mineral', 'source_scenario', 'source_seed',
      ])
      || simulation.collected.record_id !== EXPECTED_COLLECTION_RECORD_ID
      || simulation.collected.name !== EXPECTED_COLLECTION_NAME
      || simulation.collected.mineral !== 'topaz'
      || simulation.collected.source_scenario !== 'shigar_pegmatite'
      || simulation.collected.source_seed !== 42) {
    throw new Error('guided tutorial browser receipt does not close the Simulation journey');
  }
  assertGeologyPreservation(
    simulation.geology_preservation,
    EXPECTED_GEOLOGY.simulation_completion,
    'Simulation completion',
  );
  assertCleanup(simulation.teardown, 'Simulation');

  if (!exactKeys(journeys.save_load_policy, [
    'origin', 'autosave_step', 'geology_preservation', 'tutorial_resurrected', 'policy',
  ])
      || journeys.save_load_policy.origin !== 'tutorial_travertine'
      || journeys.save_load_policy.autosave_step !== 1
      || journeys.save_load_policy.tutorial_resurrected !== false
      || journeys.save_load_policy.policy
        !== 'geological-run-restored-tutorial-overlay-intentionally-not-restored') {
    throw new Error('guided tutorial browser receipt does not close save/load policy');
  }
  assertGeologyPreservation(
    journeys.save_load_policy.geology_preservation,
    EXPECTED_GEOLOGY.save_load,
    'save/load',
  );
  if (!exactKeys(journeys.skip_cleanup, [
    'scenario', 'tutorial_removed', 'geology_preservation', 'callouts', 'locks',
  ])
      || journeys.skip_cleanup.scenario !== 'tutorial_mn_calcite'
      || journeys.skip_cleanup.tutorial_removed !== true
      || journeys.skip_cleanup.callouts !== 0 || journeys.skip_cleanup.locks !== 0) {
    throw new Error('guided tutorial browser receipt does not close Skip policy');
  }
  assertGeologyPreservation(
    journeys.skip_cleanup.geology_preservation,
    EXPECTED_GEOLOGY.skip,
    'Skip',
  );

  const surfaces = journeys.player_surfaces;
  if (!exactKeys(surfaces, [
    'schema', 'collection_record_groove', 'topology_helix', 'strip_view', 'phone',
  ]) || surfaces.schema !== 'game04-player-surfaces-v1') {
    throw new Error('guided tutorial browser receipt has invalid GAME-04 player surfaces');
  }
  const collection = surfaces.collection_record_groove;
  if (!exactKeys(collection, [
    'record_id', 'stored_name', 'library_name_text', 'groove_name_text',
    'hostile_dom_nodes', 'hostile_code_executed', 'zone_count',
    'playback_started_and_stopped',
  ])
      || collection.record_id !== EXPECTED_COLLECTION_RECORD_ID
      || collection.stored_name !== EXPECTED_COLLECTION_NAME
      || collection.library_name_text !== EXPECTED_COLLECTION_NAME
      || collection.groove_name_text !== `“${EXPECTED_COLLECTION_NAME}”`
      || collection.hostile_dom_nodes !== 0
      || collection.hostile_code_executed !== false
      || collection.zone_count !== 17
      || collection.playback_started_and_stopped !== true) {
    throw new Error('guided tutorial browser receipt does not close Library and Record Groove');
  }
  const topology = surfaces.topology_helix;
  if (!exactKeys(topology, [
    'scenario', 'public_control_sequence', 'pointer_hit_tested_controls',
    'final_three_enabled', 'final_helix_enabled',
  ])
      || topology.scenario !== 'shigar_pegmatite'
      || canonicalJson(topology.public_control_sequence) !== canonicalJson([
        'three:on', 'helix:off', 'three:off', 'helix:on', 'helix:off', 'three:on',
      ])
      || topology.pointer_hit_tested_controls !== true
      || topology.final_three_enabled !== true
      || topology.final_helix_enabled !== false) {
    throw new Error('guided tutorial browser receipt does not close topology and Helicoid controls');
  }
  const strip = surfaces.strip_view;
  const expectedProductionKey = 'shigar_pegmatite@42#42';
  const expectedImportedKey = `imported:${expectedProductionKey}@sha256-${EXPECTED_GAME04_DATASET_SHA256}`;
  if (!exactKeys(strip, [
    'scenario', 'seed', 'download_filename', 'download_sha256',
    'production_key', 'production_origin', 'imported_key', 'imported_origin',
    'dataset_digest_sha256', 'imported_digest_sha256', 'visible_import_label',
    'upload_via_visible_file_chooser', 'durable_commit_before_render',
    'playback_started_and_stopped',
  ])
      || strip.scenario !== 'shigar_pegmatite' || strip.seed !== 42
      || strip.download_filename !== 'shigar_pegmatite@seed42.stripview'
      || strip.download_sha256 !== EXPECTED_GAME04_DOWNLOAD_SHA256
      || strip.production_key !== expectedProductionKey
      || strip.production_origin !== 'production-run'
      || strip.imported_key !== expectedImportedKey
      || strip.imported_origin !== 'imported-file'
      || strip.dataset_digest_sha256 !== EXPECTED_GAME04_DATASET_SHA256
      || strip.imported_digest_sha256 !== EXPECTED_GAME04_DATASET_SHA256
      || strip.visible_import_label !== 'IMPORTED FILE'
      || strip.upload_via_visible_file_chooser !== true
      || strip.durable_commit_before_render !== true
      || strip.playback_started_and_stopped !== true) {
    throw new Error('guided tutorial browser receipt does not close authenticated Strip View products');
  }
  const phone = surfaces.phone;
  if (!exactKeys(phone, [
    'width', 'height', 'modes', 'no_horizontal_document_overflow',
    'panels_inside_viewport',
  ])
      || phone.width !== 390 || phone.height !== 844
      || canonicalJson(phone.modes) !== canonicalJson([
        'library', 'groove', 'stripview', 'current',
      ])
      || phone.no_horizontal_document_overflow !== true
      || phone.panels_inside_viewport !== true) {
    throw new Error('guided tutorial browser receipt does not close phone player surfaces');
  }
  return true;
}

export function buildGuidedTutorialBrowserReceipt(root, simVersion, journeys, browserRuntime) {
  verifyGuidedTutorialJourneys(journeys, simVersion, { root });
  verifyOwnedDevToolsBrowserRuntime(browserRuntime);
  if (canonicalJson(browserRuntime) !== canonicalJson(EXPECTED_BROWSER_RUNTIME)) {
    throw new Error('guided tutorial browser receipt does not identify the owned browser executable');
  }
  const payload = {
    browser_runtime: browserRuntime,
    journeys,
  };
  return {
    schema: GUIDED_TUTORIAL_BROWSER_RECEIPT_SCHEMA,
    sim_version: Number(simVersion),
    browser_bundle_sha256: browserBundleDigest(root),
    execution_set_sha256: runtimeExecutionDigest(root),
    node_runtime: nodeRuntimeIdentity(),
    node_runtime_sha256: nodeRuntimeDigest(),
    producer_contract_sha256: producerContractDigest(root, GUIDED_TUTORIAL_BROWSER_PRODUCER),
    payload,
    payload_sha256: guidedTutorialBrowserPayloadDigest(payload),
  };
}

export function verifyGuidedTutorialBrowserReceipt(root, receipt, { simVersion }) {
  if (!exactKeys(receipt, [
    'schema', 'sim_version', 'browser_bundle_sha256', 'execution_set_sha256',
    'node_runtime', 'node_runtime_sha256', 'producer_contract_sha256',
    'payload', 'payload_sha256',
  ])
      || receipt.schema !== GUIDED_TUTORIAL_BROWSER_RECEIPT_SCHEMA
      || receipt.sim_version !== Number(simVersion)
      || receipt.browser_bundle_sha256 !== browserBundleDigest(root)
      || receipt.execution_set_sha256 !== runtimeExecutionDigest(root)
      || canonicalJson(receipt.node_runtime) !== canonicalJson(nodeRuntimeIdentity())
      || receipt.node_runtime_sha256 !== nodeRuntimeDigest()
      || receipt.producer_contract_sha256
        !== producerContractDigest(root, GUIDED_TUTORIAL_BROWSER_PRODUCER)
      || receipt.payload_sha256 !== guidedTutorialBrowserPayloadDigest(receipt.payload)
      || !exactKeys(receipt.payload, ['browser_runtime', 'journeys'])
      || canonicalJson(receipt.payload.browser_runtime) !== canonicalJson(EXPECTED_BROWSER_RUNTIME)) {
    throw new Error('guided tutorial browser receipt identity mismatch');
  }
  verifyOwnedDevToolsBrowserRuntime(receipt.payload.browser_runtime);
  return verifyGuidedTutorialJourneys(receipt.payload.journeys, simVersion, { root });
}

export function writeGuidedTutorialBrowserReceipt(root, receipt) {
  const output = path.join(
    root, 'archive', 'evidence', `guided-tutorial-browser-v${receipt.sim_version}.json`,
  );
  writeJsonAtomic(output, receipt);
  return output;
}

export function readGuidedTutorialBrowserReceipt(root, simVersion) {
  const file = path.join(root, 'archive', 'evidence', `guided-tutorial-browser-v${simVersion}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
