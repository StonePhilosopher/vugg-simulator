// tests-js/vector-taxonomy.test.ts — pin the vector-tag taxonomy.
//
// The `vector` field on each habit_variants[] entry describes how a
// crystal extends from its substrate. v135 (2026-05-22) split out
// `skeletal` from `dendritic` to distinguish two geologically distinct
// partial-growth modes:
//
//   dendritic — true branching / tree-like growth (silver wire,
//               copper arborescent, gold dendrites, manganese ferns)
//   skeletal  — partial-growth crystal-form silhouette with stepped
//               or hollow faces (galena hopper, quartz fenster, halite
//               hopper, bismuth staircase cubes)
//
// Both are partial-growth phenomena from supersaturated solutions but
// they're geometrically distinct: dendrites BRANCH outward with no
// crystal-form silhouette; skeletal crystals KEEP their cube/prism
// silhouette but with inward-growing faces.
//
// This test pins the categorization so a future edit doesn't quietly
// re-merge them. The split has no dispatch effect (both fall through
// `selectHabitVariant`'s vector-aware scoring); it's purely about
// hovertext + library card accuracy.
//
// Reads data/minerals.json directly (not the bundle's MINERAL_SPEC
// global) because the bundle exports MINERAL_SPEC at IIFE return —
// before the async _loadSpec() fetch completes — so the global
// points to the compact FALLBACK without habit_variants. The source-
// of-truth JSON is the right thing to pin anyway: this test is about
// data quality, not engine behavior.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINERALS_JSON_PATH = path.join(ROOT, 'data', 'minerals.json');
const MINERAL_SPEC: Record<string, any> = JSON.parse(
  fs.readFileSync(MINERALS_JSON_PATH, 'utf8'),
).minerals;

describe('vector taxonomy — skeletal vs dendritic', () => {
  function vectorsFor(mineral: string): { name: string; vector: string }[] {
    const e = MINERAL_SPEC[mineral];
    if (!e || !Array.isArray(e.habit_variants)) return [];
    return e.habit_variants
      .filter((v: any) => v && typeof v === 'object' && v.vector)
      .map((v: any) => ({ name: v.name, vector: v.vector }));
  }

  it('galena skeletal_hopper has vector: skeletal (NOT dendritic)', () => {
    // Galena hopper is the classic stepped-face cube — Joplin / Tri-State
    // / Madan specimens. The cube silhouette is preserved; faces grow
    // inward. NOT a tree-like branching dendrite.
    const sh = vectorsFor('galena').find(v => v.name === 'skeletal_hopper');
    expect(sh).toBeTruthy();
    expect(sh!.vector).toBe('skeletal');
  });

  it('quartz skeletal_fenster has vector: skeletal (NOT dendritic)', () => {
    // Fenster (= German for "window") quartz has hollow stepped faces
    // typical of skeletal SiO2. Keeps hexagonal-prism silhouette; the
    // faces have window-like recesses. Not branching.
    const sf = vectorsFor('quartz').find(v => v.name === 'skeletal_fenster');
    expect(sf).toBeTruthy();
    expect(sf!.vector).toBe('skeletal');
  });

  it('true dendritic minerals keep vector: dendritic', () => {
    // The native-element + sulfide dendrites genuinely branch outward
    // without crystal-form silhouettes. Pin a few canonical examples
    // so the split doesn't accidentally mis-categorize them.
    const cases = [
      { mineral: 'native_gold', variant: 'dendritic' },
      { mineral: 'native_silver', variant: 'dendritic' },
      { mineral: 'native_silver', variant: 'wire' },
      { mineral: 'native_copper', variant: 'arborescent_dendritic' },
      { mineral: 'native_bismuth', variant: 'arborescent_dendritic' },
      { mineral: 'argentite', variant: 'arborescent' },
      { mineral: 'millerite', variant: 'capillary' },
      { mineral: 'native_tellurium', variant: 'reticulated' },
    ];
    for (const c of cases) {
      const hv = vectorsFor(c.mineral).find(v => v.name === c.variant);
      if (!hv) {
        // If the variant doesn't exist, that's fine for this test —
        // we're only pinning what's there. (Catches the case where
        // a future edit renames a variant.)
        continue;
      }
      expect(hv.vector,
        `${c.mineral}::${c.variant} should be vector: dendritic`)
        .toBe('dendritic');
    }
  });

  it('every habit_variant.vector is in the canonical set', () => {
    // Whitelist of legal vector tags. If a future edit introduces a
    // typo or a new tag without updating the dispatch + hovertext,
    // this test flags it.
    const canonical = new Set([
      'equant',     // cubes, octahedra, garnets
      'projecting', // acicular, prismatic, columnar
      'coating',    // botryoidal, druzy crust, massive
      'tabular',    // flat plates parallel to wall
      'dendritic',  // true branching / tree-like
      'skeletal',   // hopper, fenster — crystal-form silhouette with stepped/hollow faces
    ]);
    const offenders: string[] = [];
    for (const k of Object.keys(MINERAL_SPEC)) {
      const e = MINERAL_SPEC[k];
      if (!e || !Array.isArray(e.habit_variants)) continue;
      for (const hv of e.habit_variants) {
        if (!hv || typeof hv !== 'object' || !hv.vector) continue;
        const v = String(hv.vector).toLowerCase();
        if (!canonical.has(v)) {
          offenders.push(`${k}::${hv.name} = ${hv.vector}`);
        }
      }
    }
    expect(offenders,
      `non-canonical vector tags found:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('skeletal vector tag is used (split lives in real data, not just theory)', () => {
    // Sanity that the v135 split actually shows up in the spec — a
    // future edit that re-merges skeletal → dendritic would silently
    // make this test useless without this assertion.
    let skeletalCount = 0;
    for (const k of Object.keys(MINERAL_SPEC)) {
      const e = MINERAL_SPEC[k];
      if (!e || !Array.isArray(e.habit_variants)) continue;
      for (const hv of e.habit_variants) {
        if (hv && typeof hv === 'object' && hv.vector === 'skeletal') {
          skeletalCount++;
        }
      }
    }
    expect(skeletalCount,
      'expected at least 2 habit_variants tagged vector: skeletal (galena skeletal_hopper, quartz skeletal_fenster)')
      .toBeGreaterThanOrEqual(2);
  });
});
