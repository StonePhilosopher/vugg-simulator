import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isolatedNarrativeLoader(fetchImpl: (url: string) => Promise<any>) {
  const manifest = fs.readFileSync(path.join(ROOT, 'dist', '04-narrative-manifest.generated.js'), 'utf8');
  const loader = fs.readFileSync(path.join(ROOT, 'dist', '05-narratives.js'), 'utf8');
  const quietConsole = { info() {}, error() {} };
  const evaluate = new Function(
    'fetch',
    'console',
    `${manifest}\n${loader}\nreturn { NARRATIVES_READY_PROMISE, narrativesReady, waitForNarrativesReady, assertNarrativesReady };`,
  );
  return evaluate(fetchImpl, quietConsole) as any;
}

describe('generated Markdown narrative system', () => {
  it('preloads every generated manifest entry with a zero-failure receipt', async () => {
    const manifest = (globalThis as any)._NARRATIVE_MANIFEST as readonly string[];
    const cache = (globalThis as any)._NARRATIVE_CACHE as Record<string, Record<string, string>>;
    const receipt = await (globalThis as any).NARRATIVES_READY_PROMISE;

    expect((globalThis as any).narrativesReady()).toBe(true);
    expect(() => (globalThis as any).assertNarrativesReady()).not.toThrow();
    expect(manifest).toHaveLength(94);
    expect(new Set(manifest).size).toBe(manifest.length);
    expect(manifest).toContain('andalusite');
    expect(receipt).toEqual({ expected: 94, loaded: 94, failed: [] });
    for (const species of manifest) {
      expect(Object.keys(cache[species] || {}).length, species).toBeGreaterThan(0);
    }
  });

  it('serves the formerly omitted and formerly inline-only quartz passages', () => {
    const variant = (globalThis as any).narrative_variant as (
      species: string,
      key: string,
      context?: Record<string, unknown>,
    ) => string;

    expect(variant('andalusite', 'chiastolite')).toContain('growth-SECTOR zoning');
    expect(variant('quartz', 'gwindel', { twist: 12 })).toContain('single alpine-fissure quartz crystal');
    expect(variant('quartz', 'gwindel', { twist: 12 })).toContain('screw-dislocation structure');
    expect(variant('quartz', 'gwindel', { twist: 12 })).not.toContain('stack of subparallel individuals');
    expect(variant('quartz', 'sceptre_masking', { film_phrase: 'hematite ' }))
      .toContain('a hematite film');
    expect(variant('quartz', 'bent')).toContain('post-growth overprint');
    expect(variant('quartz', 'tessin')).toContain('Tessiner Habitus');
    expect(variant('quartz', 'tessin')).toContain('{40-41}');
    expect(variant('quartz', 'tessin')).not.toContain('z{011}');
  });

  it('keeps active Gwindel model metadata consistent with the canonical science', () => {
    const minerals = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'),
    );
    const gwindel = minerals.minerals.quartz.habit_variants
      .find((variant: any) => variant.name === 'gwindel');
    const morphology = fs.readFileSync(path.join(ROOT, 'js', '45-morphology.ts'), 'utf8');

    expect(gwindel.trigger).toContain('one flattened quartz crystal');
    expect(gwindel.trigger).toContain('screw-dislocation twist');
    expect(gwindel.trigger).not.toContain('under syn-growth tectonic shear');
    expect(morphology).toContain('growth-incorporated screw-dislocation structure');
    expect(morphology).not.toContain('A gwindel is a stack of subparallel');
  });

  it('rejects partial preload, remains not ready, and blocks startup', async () => {
    const runtime = isolatedNarrativeLoader(async () => ({ ok: false }));

    expect(runtime.narrativesReady()).toBe(false);
    expect(() => runtime.assertNarrativesReady()).toThrow(/simulation startup blocked/);
    await expect(runtime.NARRATIVES_READY_PROMISE).rejects.toMatchObject({
      name: 'NarrativePreloadError',
      receipt: { expected: 94, loaded: 0 },
    });
    await expect(runtime.waitForNarrativesReady()).rejects.toMatchObject({
      name: 'NarrativePreloadError',
    });
    expect(runtime.narrativesReady()).toBe(false);
  });
});
