import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FILE_BUNDLE_ASSET_SCHEMA = 'vugg-file-bundle-assets-v1';
export const FILE_BUNDLE_START_MARKER = '// === BUILD:file-assets:start ===';
export const FILE_BUNDLE_END_MARKER = '// === BUILD:file-assets:end ===';

const EXPLICIT_RUNTIME_ASSETS = Object.freeze([
  'data/minerals.json',
  'data/scenarios.json5',
  'data/thermo-carbonates.json',
  'data/thermo-sulfates.json',
]);

const codePointCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export function fileBundleAssetFiles(root) {
  const narrativesDirectory = path.join(root, 'narratives');
  const narratives = fs.readdirSync(narrativesDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => `narratives/${entry.name}`);
  const relativeFiles = [...EXPLICIT_RUNTIME_ASSETS, ...narratives].sort(codePointCompare);
  for (const relative of relativeFiles) {
    if (!fs.existsSync(path.join(root, relative))) {
      throw new Error(`file-bundle runtime asset is missing: ${relative}`);
    }
  }
  return relativeFiles;
}

export function fileBundleAssetDigest(root, relativeFiles = fileBundleAssetFiles(root)) {
  const hash = crypto.createHash('sha256');
  hash.update(`${FILE_BUNDLE_ASSET_SCHEMA}\0`);
  for (const relative of relativeFiles) {
    const bytes = fs.readFileSync(path.join(root, relative));
    hash.update(`${relative.length}:${relative}\0${bytes.length}:`);
    hash.update(bytes);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function buildFileBundlePrelude(root) {
  const relativeFiles = fileBundleAssetFiles(root);
  const assets = {};
  for (const relative of relativeFiles) {
    assets[relative] = fs.readFileSync(path.join(root, relative), 'utf8');
  }
  const receipt = Object.freeze({
    schema: FILE_BUNDLE_ASSET_SCHEMA,
    asset_count: relativeFiles.length,
    sha256: fileBundleAssetDigest(root, relativeFiles),
  });
  const receiptJson = scriptSafeJson(receipt);
  const assetsJson = scriptSafeJson(assets);

  return `${FILE_BUNDLE_START_MARKER}
(function installVuggLocalFileAssets() {
  const receipt = Object.freeze(${receiptJson});
  Object.defineProperty(globalThis, '__VUGG_FILE_BUNDLE_RECEIPT', {
    value: receipt, enumerable: false, writable: false, configurable: false,
  });
  if (!globalThis.location || globalThis.location.protocol !== 'file:') return;

  const assets = Object.freeze(${assetsJson});
  const nativeFetch = typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : null;
  const responseFor = (relative) => {
    const text = assets[relative];
    const contentType = relative.endsWith('.json')
      ? 'application/json; charset=utf-8'
      : relative.endsWith('.md')
        ? 'text/markdown; charset=utf-8'
        : 'text/plain; charset=utf-8';
    if (typeof globalThis.Response === 'function') {
      return new globalThis.Response(text, {
        status: 200,
        headers: { 'content-type': contentType },
      });
    }
    return {
      ok: true,
      status: 200,
      text: async () => text,
      json: async () => JSON.parse(text),
    };
  };

  globalThis.fetch = async function vuggLocalFileFetch(input, init) {
    const raw = typeof input === 'string' || input instanceof URL
      ? String(input)
      : String(input && input.url || input);
    let pathname = '';
    try {
      pathname = decodeURIComponent(new URL(raw, globalThis.location.href).pathname)
        .replaceAll('\\\\', '/');
    } catch (_error) { /* unknown input falls through to native fetch */ }
    for (const relative of Object.keys(assets)) {
      if (pathname === relative || pathname.endsWith('/' + relative)) {
        return responseFor(relative);
      }
    }
    if (nativeFetch) return nativeFetch(input, init);
    throw new TypeError('fetch is unavailable for non-bundled file URL: ' + raw);
  };
})();
${FILE_BUNDLE_END_MARKER}`;
}
