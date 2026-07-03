// tests-js/mineral-optics.test.ts — Depth-A1 data lint for the per-mineral `optics` blocks
// (RESEARCH-optical-realism-2026-07-02.md §4.1; the STANDING GOAL's first data commit).
//
// The optics block is RENDER-LAYER data: diaphaneity category + a clarity scalar (the Depth-A
// consumer) + lustre terms (recorded now, consumed at Depth-B) + notes + source. This lint keeps
// the vocabulary closed and the scalars sane so buildCrystalMaterial (Depth-A2) can trust the
// data unguarded. Species WITHOUT an optics block are fine — the builder falls back to class
// defaults; this test only validates what IS declared, plus the coverage floor (the Wulff
// tenants + prominence tier 1 must be verified, not defaulted).

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DOC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'minerals.json'), 'utf8'));
const MINERALS: Record<string, any> = DOC.minerals;
const withOptics = Object.entries(MINERALS).filter(([, m]) => m.optics) as [string, any][];

const DIAPHANEITY = new Set([
  'transparent', 'transparent_to_translucent', 'transparent_to_opaque',
  'translucent', 'translucent_to_opaque', 'opaque',
]);
const LUSTRE = new Set([
  'vitreous', 'subvitreous', 'adamantine', 'subadamantine', 'resinous', 'subresinous',
  'metallic', 'submetallic', 'pearly', 'silky', 'greasy', 'waxy', 'dull', 'earthy',
]);

describe('mineral optics blocks (Depth-A1 data lint)', () => {
  it('there ARE optics blocks (the A1 commit landed data, not just schema)', () => {
    expect(withOptics.length).toBeGreaterThanOrEqual(30);
  });

  it('every declared block is complete and in-vocabulary', () => {
    for (const [name, m] of withOptics) {
      const o = m.optics;
      expect(DIAPHANEITY.has(o.diaphaneity), `${name}: diaphaneity "${o.diaphaneity}"`).toBe(true);
      expect(typeof o.clarity, `${name}: clarity type`).toBe('number');
      expect(o.clarity, `${name}: clarity ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(o.clarity, `${name}: clarity ≤ 1`).toBeLessThanOrEqual(1);
      expect(Array.isArray(o.lustre) && o.lustre.length > 0, `${name}: lustre array`).toBe(true);
      for (const t of o.lustre) expect(LUSTRE.has(t), `${name}: lustre term "${t}"`).toBe(true);
      expect(o.notes === null || typeof o.notes === 'string', `${name}: notes`).toBe(true);
      expect(typeof o.source === 'string' && o.source.length > 0, `${name}: source`).toBe(true);
    }
  });

  it('category ↔ scalar coherence: "opaque" species sit at the opaque end (clarity ≤ 0.05)', () => {
    for (const [name, m] of withOptics) {
      if (m.optics.diaphaneity === 'opaque') {
        expect(m.optics.clarity, `${name}: opaque but clarity ${m.optics.clarity}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it('the goal benchmarks hold: Naica selenite + rock-crystal quartz are near-water-clear; the metallic opaques are 0', () => {
    expect(MINERALS.selenite.optics.clarity).toBeGreaterThanOrEqual(0.90);
    expect(MINERALS.quartz.optics.clarity).toBeGreaterThanOrEqual(0.90);
    for (const name of ['galena', 'pyrite', 'chalcopyrite', 'magnetite', 'stibnite']) {
      expect(MINERALS[name].optics.clarity, name).toBe(0);
    }
  });

  it('coverage floor: all six Wulff tenants + prominence tier 1 carry VERIFIED optics (not class defaults)', () => {
    const mustHave = [
      // the Wulff tenants (the showcase forms deserve verified clarity)
      'fluorite', 'calcite', 'wulfenite', 'barite', 'galena', 'titanite',
      // prominence tier 1 (expects_species count ≥ 4 across the fleet)
      'quartz', 'sphalerite', 'pyrite', 'feldspar', 'selenite', 'chalcopyrite',
    ];
    for (const name of mustHave) {
      expect(MINERALS[name], `${name} exists`).toBeTruthy();
      expect(MINERALS[name].optics, `${name} has optics`).toBeTruthy();
    }
  });

  it('lustre face-notes preserved for the famous cases (Depth-B consumers)', () => {
    expect(MINERALS.apophyllite.optics.notes).toMatch(/pearly on \{001\}/);
    expect(MINERALS.selenite.optics.notes).toMatch(/pearly on \{010\}/);
  });
});
