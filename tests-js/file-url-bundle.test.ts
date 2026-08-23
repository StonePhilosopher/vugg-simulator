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
  canonicalText,
  fileBundleAssetDigest,
  fileBundleAssetFiles,
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

    const scenarioResponse = await fileGlobal.fetch('./data/scenarios.json5');
    expect(await scenarioResponse.text())
      .toBe(canonicalText(fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8')));
    const narrativeResponse = await fileGlobal.fetch('./narratives/quartz.md');
    expect(await narrativeResponse.text())
      .toBe(canonicalText(fs.readFileSync(path.join(ROOT, 'narratives', 'quartz.md'), 'utf8')));
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

  it('produces identical embedded assets and receipts from LF, CRLF, and mixed checkouts', () => {
    const roots = ['lf', 'crlf', 'mixed'].map(kind => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `vugg-file-assets-${kind}-`));
      fs.mkdirSync(path.join(root, 'data'), { recursive: true });
      fs.mkdirSync(path.join(root, 'narratives'), { recursive: true });
      const newline = kind === 'crlf' ? '\r\n' : '\n';
      for (const name of ['minerals.json', 'thermo-carbonates.json', 'thermo-sulfates.json']) {
        fs.writeFileSync(path.join(root, 'data', name), `{${newline}}${newline}`);
      }
      const scenarioText = kind === 'mixed'
        ? `{ scenarios: {} }\r\n// text\n`
        : `{ scenarios: {} }${newline}// text${newline}`;
      fs.writeFileSync(path.join(root, 'data', 'scenarios.json5'), scenarioText);
      fs.writeFileSync(path.join(root, 'narratives', 'quartz.md'), `# Quartz${newline}`);
      return root;
    });
    const preludes = roots.map(buildFileBundlePrelude);
    const digests = roots.map(root => fileBundleAssetDigest(root));
    expect(new Set(preludes).size).toBe(1);
    expect(new Set(digests).size).toBe(1);
    expect(preludes[0]).not.toContain('\r');
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
