import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSimBundle } from './_harness.mjs';
import {
  browserBundleDigest,
  nodeRuntimeDigest,
  producerContractDigest,
  runtimeExecutionDigest,
} from './evidence-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_MANIFEST = path.join(ROOT, 'release', 'content-pack-manifest.json');
const ASSET_MANIFEST = path.join(ROOT, 'release', 'asset-manifest.json');
export const CONTENT_PACK_SCHEMA = 'vugg-content-pack-catalog-v1';
export const ASSET_PACK_SCHEMA = 'vugg-production-asset-manifest-v1';
export const RELEASE_RUNTIME_CONTRACT_SCHEMA = 'vugg-release-runtime-contract-v1';

const compareCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileReceipt = relative => {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  return { path: relative.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha256(bytes) };
};

const CONTENT_FILES = Object.freeze([
  'data/locality_chemistry.json',
  'data/mindat-species-refs.json5',
  'data/minerals.json',
  'data/scenarios.json5',
  'data/structural.json',
  'data/thermo-carbonates.json',
  'data/thermo-sulfates.json',
]);

const ASSETS = Object.freeze([
  ['music-title', 'Vugg Simulator.mp3', 'runtime-audio', 'title music context', 'human-rights-clearance-required'],
  ['music-building', 'salt-circuit.mp3', 'runtime-audio', 'simulation, Library, and Record Player music context', 'human-rights-clearance-required'],
  ['favicon', 'vugg-favicon.svg', 'runtime-vector', 'browser identity', 'human-rights-clearance-required'],
  ['mineral-thumb-calcite', 'photos/thumbs/calcite.jpg', 'runtime-image', 'Library thumbnail', 'human-rights-clearance-required'],
  ['mineral-thumb-fluorite', 'photos/thumbs/fluorite.jpg', 'runtime-image', 'Library thumbnail', 'human-rights-clearance-required'],
  ['mineral-thumb-malachite', 'photos/thumbs/malachite.jpg', 'runtime-image', 'Library thumbnail', 'human-rights-clearance-required'],
  ['mineral-thumb-quartz', 'photos/thumbs/quartz.jpg', 'runtime-image', 'Library thumbnail', 'human-rights-clearance-required'],
  ['three-js', 'tools/three.module.js', 'runtime-library', 'WebGL renderer', 'SPDX-MIT-in-file'],
  ['source-calcite', 'photos/source/calcite.jpg', 'source-only-image', 'thumbnail source', 'human-rights-clearance-required'],
  ['source-fluorite', 'photos/source/fluorite.jpg', 'source-only-image', 'thumbnail source', 'human-rights-clearance-required'],
  ['source-malachite', 'photos/source/malachite.jpg', 'source-only-image', 'thumbnail source', 'human-rights-clearance-required'],
  ['source-quartz', 'photos/source/quartz.jpg', 'source-only-image', 'thumbnail source', 'human-rights-clearance-required'],
  ['source-title-art', 'photos/source/title-art.png', 'source-only-image', 'title-art source', 'human-rights-clearance-required'],
  ['title-art-reference', 'title-art-reference.png', 'reference-only-image', 'art-direction reference', 'human-rights-clearance-required'],
]);

function digestProjection(value, omittedKey) {
  const projection = { ...value };
  delete projection[omittedKey];
  return sha256(JSON.stringify(projection));
}

function assertReleaseRuntimeContract(contract) {
  if (!contract || contract.schema !== RELEASE_RUNTIME_CONTRACT_SCHEMA
      || !Number.isSafeInteger(contract.save_format) || contract.save_format < 1
      || !contract.scientific_authority || !contract.presentation || !contract.audio_mix_states) {
    throw new Error('built game does not expose a valid release runtime contract');
  }
  return contract;
}

async function loadReleaseBundle() {
  const bundle = await loadSimBundle({
    toolName: 'release-audit',
    extraExports: ['RELEASE_RUNTIME_CONTRACT'],
  });
  assertReleaseRuntimeContract(bundle.RELEASE_RUNTIME_CONTRACT);
  return bundle;
}

export async function buildContentPackManifest(bundle = null) {
  bundle = bundle || await loadReleaseBundle();
  const runtimeContract = assertReleaseRuntimeContract(bundle.RELEASE_RUNTIME_CONTRACT);
  const mineralsDocument = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'));
  const mineralSpec = mineralsDocument.minerals || mineralsDocument;
  const narrativeFiles = fs.readdirSync(path.join(ROOT, 'narratives'))
    .filter(name => name.endsWith('.md'))
    .map(name => `narratives/${name}`)
    .sort(compareCodePoint);
  const sourceFiles = [...CONTENT_FILES, ...narrativeFiles]
    .sort(compareCodePoint)
    .map(fileReceipt);
  const manifest = {
    schema: CONTENT_PACK_SCHEMA,
    catalog_version: '1.0.0',
    packs: [{
      id: 'core',
      content_version: '1.0.0',
      compatibility: {
        sim_version: bundle.SIM_VERSION,
        model_digest_sha256: sha256(bundle.MODEL_DIGEST),
        save_format: runtimeContract.save_format,
      },
      counts: {
        scenarios: Object.keys(bundle.SCENARIOS).length,
        minerals: Object.keys(mineralSpec).length,
        narratives: narrativeFiles.length,
      },
      browser_bundle_sha256: browserBundleDigest(ROOT),
      runtime_execution_sha256: runtimeExecutionDigest(ROOT),
      source_files: sourceFiles,
    }],
    producer_contract_sha256: producerContractDigest(ROOT, 'release-audit'),
    node_runtime_sha256: nodeRuntimeDigest(),
  };
  manifest.catalog_sha256 = digestProjection(manifest, 'catalog_sha256');
  return manifest;
}

function assetIdForRuntimeSource(source) {
  if (source == null) return null;
  const match = ASSETS.find(([, relative]) => relative === source);
  if (!match) throw new Error(`runtime audio source is absent from the asset inventory: ${source}`);
  return match[0];
}

export function buildAssetManifest(runtimeContract) {
  runtimeContract = assertReleaseRuntimeContract(runtimeContract);
  const authority = runtimeContract.scientific_authority;
  const presentation = runtimeContract.presentation;
  const audio = runtimeContract.audio_mix_states;
  const manifest = {
    schema: ASSET_PACK_SCHEMA,
    asset_pack_version: '1.0.0',
    distribution_status: 'development-assets-human-clearance-required',
    assets: ASSETS.map(([id, relative, delivery, role, rightsStatus]) => ({
      id,
      ...fileReceipt(relative),
      delivery,
      role,
      rights_status: rightsStatus,
    })),
    renderer_lod_contract: {
      scientific_authority: {
        field_resolution: authority.field_resolution,
        convergence_reference_resolution: authority.convergence_reference_resolution,
        isovalue: authority.isovalue,
        player_quality_control: authority.player_quality_control,
      },
      presentation: {
        mobile_classification: { ...presentation.mobile_classification },
        surface_growth_instance_cap_mobile: presentation.surface_growth_instance_cap_mobile,
        surface_growth_instance_cap_desktop: presentation.surface_growth_instance_cap_desktop,
      },
    },
    audio_mix_states: {
      title: {
        source_asset: assetIdForRuntimeSource(audio.title.source),
        default_gain: audio.title.default_gain,
        loops: audio.title.loops,
      },
      building: {
        source_asset: assetIdForRuntimeSource(audio.building.source),
        default_gain: audio.building.default_gain,
        loops: audio.building.loops,
      },
      strip_view: {
        source_asset: assetIdForRuntimeSource(audio.strip_view.source),
        music_gain: audio.strip_view.music_gain,
        sonifier_default_master_gain: audio.strip_view.sonifier_default_master_gain,
      },
      muted: {
        source_asset: assetIdForRuntimeSource(audio.muted.source),
        gain: audio.muted.gain,
      },
    },
    human_completion_gates: [
      'rights and license review for every non-library media asset',
      'human art direction and final mineral-image coverage beyond the four current thumbnails',
      'physical-device audio loudness, clipping, interruption, and accessibility review',
    ],
  };
  manifest.asset_manifest_sha256 = digestProjection(manifest, 'asset_manifest_sha256');
  return manifest;
}

export async function buildReleaseManifests() {
  const bundle = await loadReleaseBundle();
  return {
    content: await buildContentPackManifest(bundle),
    assets: buildAssetManifest(bundle.RELEASE_RUNTIME_CONTRACT),
    runtimeContract: bundle.RELEASE_RUNTIME_CONTRACT,
  };
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
}

function assertExactJson(file, expected) {
  const expectedRaw = `${JSON.stringify(expected, null, 2)}\n`;
  const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (actual !== expectedRaw) throw new Error(`${path.relative(ROOT, file)} is missing or stale; run npm run gen:release`);
}

function assertReleaseDocuments() {
  const requirements = new Map([
    ['CHANGELOG.md', ['SIM 266', 'External gates']],
    ['docs/RELEASE-MIGRATION-POLICY.md', ['content pack', 'format v2', 'SIM_VERSION']],
    ['docs/SCIENTIFIC-STEWARDSHIP.md', ['follow the science', 'AI Dr. Michael Wise', 'correction']],
    ['docs/LOCAL-DIAGNOSTICS.md', ['diagnostics:local', 'no network', 'local backup']],
    ['docs/ASSET-LOD-AUDIO-ART-DIRECTION.md', ['48', '64', '56', '128', 'human']],
    ['docs/EXTERNAL-RELEASE-GATES.md', ['iOS', 'Android', 'mineralogist', 'evidence']],
  ]);
  for (const [relative, tokens] of requirements) {
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) throw new Error(`release document is missing: ${relative}`);
    const source = fs.readFileSync(file, 'utf8');
    for (const token of tokens) if (!source.includes(token)) throw new Error(`${relative} is missing required release contract token: ${token}`);
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const unknown = process.argv.slice(2).filter(arg => arg !== '--write' && arg !== '--check');
  if (unknown.length) throw new Error(`unknown argument: ${unknown[0]}`);
  const { content, assets } = await buildReleaseManifests();
  if (write) {
    writeJsonAtomic(CONTENT_MANIFEST, content);
    writeJsonAtomic(ASSET_MANIFEST, assets);
  } else {
    assertExactJson(CONTENT_MANIFEST, content);
    assertExactJson(ASSET_MANIFEST, assets);
  }
  assertReleaseDocuments();
  console.error(`[release-audit] PASS: ${content.packs[0].counts.scenarios} scenarios, ${content.packs[0].counts.minerals} minerals, ${content.packs[0].counts.narratives} narratives, ${assets.assets.length} receipted assets; local P4 manifests and policies are current`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[release-audit] FAIL: ${error.message}`); process.exitCode = 1; });
}
