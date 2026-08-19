import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import { assertIndexMatchesDist, runtimeDependencyFiles } from '../tools/evidence-runtime.mjs';
import {
  FILE_BUNDLE_ASSET_SCHEMA,
  FILE_BUNDLE_END_MARKER,
  FILE_BUNDLE_START_MARKER,
  buildFileBundlePrelude,
  fileBundleAssetDigest,
  fileBundleAssetFiles,
  readFileBundleAsset,
} from '../tools/file-bundle-assets.mjs';
import { parseScenarioDocument } from '../tools/scenario-authoring.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');

describe('self-contained file URL bundle', () => {
  it('embeds every fetched runtime input under one deterministic receipt', () => {
    const files = fileBundleAssetFiles(ROOT);
    const runtimeAssets = runtimeDependencyFiles(ROOT)
      .filter(file => !file.includes(`${path.sep}dist${path.sep}`))
      .map(file => path.relative(ROOT, file).replaceAll('\\', '/'));
    expect(files).toEqual(runtimeAssets);
    expect(files).toContain('data/scenarios.json5');
    expect(files).toContain('data/minerals.json');
    expect(files).toContain('data/thermo-carbonates.json');
    expect(files).toContain('data/thermo-sulfates.json');
    expect(files.filter(file => file.startsWith('narratives/'))).toHaveLength(94);
    expect(fileBundleAssetDigest(ROOT)).toMatch(/^[0-9a-f]{64}$/);
    expect(assertIndexMatchesDist(ROOT)).toBe(true);
  });

  it('serves exact embedded bytes only for file URLs and preserves native HTTP fetch', async () => {
    const nativeFetch = vi.fn(async () => new Response('native', { status: 404 }));
    const fileGlobal: any = {
      location: {
        protocol: 'file:',
        href: 'file:///C:/Users/test/Vugg-Simulator/index.html',
      },
      fetch: nativeFetch,
      Response,
    };
    new Function('globalThis', 'URL', buildFileBundlePrelude(ROOT))(fileGlobal, URL);
    expect(fileGlobal.__VUGG_FILE_BUNDLE_RECEIPT).toEqual({
      schema: FILE_BUNDLE_ASSET_SCHEMA,
      asset_count: 98,
      sha256: fileBundleAssetDigest(ROOT),
    });

    // Compared against the LF-normalised reader, not against raw working-tree
    // bytes: on a CRLF checkout the two differ, and it is the normalised form
    // the bundle is required to serve.
    const scenarioResponse = await fileGlobal.fetch('./data/scenarios.json5');
    expect(await scenarioResponse.text())
      .toBe(readFileBundleAsset(ROOT, 'data/scenarios.json5'));
    const narrativeResponse = await fileGlobal.fetch('./narratives/quartz.md');
    expect(await narrativeResponse.text())
      .toBe(readFileBundleAsset(ROOT, 'narratives/quartz.md'));
    expect(nativeFetch).not.toHaveBeenCalled();

    const unknown = await fileGlobal.fetch('./not-bundled.txt');
    expect(unknown.status).toBe(404);
    expect(nativeFetch).toHaveBeenCalledTimes(1);

    const httpFetch = vi.fn();
    const httpGlobal: any = {
      location: { protocol: 'http:', href: 'http://127.0.0.1:8765/' },
      fetch: httpFetch,
      Response,
    };
    new Function('globalThis', 'URL', buildFileBundlePrelude(ROOT))(httpGlobal, URL);
    expect(httpGlobal.fetch).toBe(httpFetch);
  });

  it('boots the generated index from file:// with every scenario menu populated', async () => {
    const html = fs.readFileSync(INDEX, 'utf8');
    expect(html).toContain(FILE_BUNDLE_START_MARKER);
    expect(html).toContain(FILE_BUNDLE_END_MARKER);
    const scenarioDoc = parseScenarioDocument(
      fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8'),
    );
    const expectedQuickPlay = Object.keys(scenarioDoc.scenarios)
      .filter(id => !id.startsWith('tutorial_')).length;
    const expectedPanelButtons = scenarioDoc.menu_layout.panel
      .reduce((count: number, group: any) => count
        + (group.fluids?.length || group.buttons?.length || 0), 0);
    const messages: string[] = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', message => messages.push(String(message)));
    virtualConsole.on('warn', message => messages.push(String(message)));
    virtualConsole.on('jsdomError', error => messages.push(String(error?.message || error)));
    const dom = new JSDOM(html, {
      url: 'file:///C:/Users/test/Vugg-Simulator/index.html',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        (window as any).Audio = class {
          play() { return Promise.resolve(); }
          pause() {}
        };
        (window as any).matchMedia = () => ({
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        });
        window.HTMLCanvasElement.prototype.getContext = () => null;
      },
    });
    try {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline
        && dom.window.document.querySelectorAll('#scenario option').length < expectedQuickPlay) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(dom.window.document.querySelectorAll('#scenario option')).toHaveLength(expectedQuickPlay);
      expect(dom.window.document.querySelectorAll('#scenarios-panel-groups button'))
        .toHaveLength(expectedPanelButtons);
      expect(dom.window.document.querySelectorAll('#idle-scenario option'))
        .toHaveLength(scenarioDoc.menu_layout.idle.length);
      expect(dom.window.document.querySelectorAll('#begin-tutorial-buttons button'))
        .toHaveLength(scenarioDoc.menu_layout.begin_tutorials.length);
      expect(messages.filter(message => /all fetch paths failed|canonical files failed/i.test(message)))
        .toEqual([]);
    } finally {
      dom.window.close();
    }
  });
});

// The invariant the v1 schema did not hold, pinned directly rather than through
// this checkout: the same COMMITTED content must produce the same bundle no
// matter what line endings a clone happens to land on disk. Testing it against
// the real tree would only ever measure whatever endings this machine has, so
// the fixture builds the same logical assets twice — once LF, once CRLF — and
// demands one digest. Drop the normalisation and both assertions below go red.
describe('file bundle is a function of content, not of checkout line endings', () => {
  const ASSET_BODIES: Record<string, string> = {
    'data/minerals.json': '{\n  "a": 1,\n  "b": [2, 3]\n}\n',
    'data/scenarios.json5': '{\n  // a comment\n  scenarios: {},\n}\n',
    'data/thermo-carbonates.json': '{\n  "calcite": -8.48\n}\n',
    'data/thermo-sulfates.json': '{\n  "gypsum": -4.58\n}\n',
    'narratives/quartz.md': '# Quartz\n\nA line.\nAnother line.\n',
    'narratives/calcite.md': '# Calcite\n\nRhombs.\n',
  };

  const plant = (eol: '\n' | '\r\n') => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `vugg-bundle-${eol === '\n' ? 'lf' : 'crlf'}-`));
    fs.mkdirSync(path.join(root, 'data'));
    fs.mkdirSync(path.join(root, 'narratives'));
    for (const [relative, body] of Object.entries(ASSET_BODIES)) {
      fs.writeFileSync(path.join(root, relative), body.replaceAll('\n', eol));
    }
    return root;
  };

  it('digests a CRLF checkout and an LF checkout identically', () => {
    const lf = plant('\n');
    const crlf = plant('\r\n');
    try {
      // Guard the fixture itself: if these were equal on disk the test would
      // pass while proving nothing.
      expect(fs.readFileSync(path.join(crlf, 'narratives/quartz.md'), 'utf8'))
        .not.toBe(fs.readFileSync(path.join(lf, 'narratives/quartz.md'), 'utf8'));
      expect(fileBundleAssetDigest(crlf)).toBe(fileBundleAssetDigest(lf));
      expect(buildFileBundlePrelude(crlf)).toBe(buildFileBundlePrelude(lf));
    } finally {
      fs.rmSync(lf, { recursive: true, force: true });
      fs.rmSync(crlf, { recursive: true, force: true });
    }
  });

  it('embeds no carriage returns even from a CRLF checkout', () => {
    const crlf = plant('\r\n');
    try {
      expect(readFileBundleAsset(crlf, 'narratives/quartz.md')).not.toContain('\r');
      expect(buildFileBundlePrelude(crlf)).not.toContain('\r\n');
    } finally {
      fs.rmSync(crlf, { recursive: true, force: true });
    }
  });
});
