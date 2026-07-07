// tests-js/local-color.test.ts — LOCAL CRYSTAL COLOUR (2026-07-07, boss queued:
// same-species neighbours + translucent overlaps must read as SEPARATE
// individuals). _localCrystalColor (js/99i) layers two honest effects on
// spec.class_color: (1) a bedrock chemistry TONE from the crystal's own
// growth-weighted chromophore trace load (Fe/Mn/Ti — deeper colour for higher
// impurity, NO mineral-specific hue claim, that's Depth-C's job); (2) a
// deterministic 3-axis (hue/sat/value) legibility FLOOR from the crystal_id so
// same-broth neighbours still separate. Render-only, RNG-free → byte-identical
// (the baseline suite pins that); these pins cover the colour math itself.

import { describe, expect, it } from 'vitest';

declare const _localCrystalColor: any;
declare const _topoParseColor: any;
declare const LOCAL_COLOR: any;

const SPEC = { class_color: '#b0b0b0' };   // a neutral grey base so shifts are legible
const rgbDist = (a: any, b: any) => 255 * Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
const lightness = (c: any) => { const h: any = { h: 0, s: 0, l: 0 }; c.getHSL(h); return h.l; };

describe('local colour — determinism + neighbour separation (the floor)', () => {
  it('is deterministic — same crystal id + zones → identical colour (RNG-free)', () => {
    const c = { crystal_id: 7, zones: [] };
    const a = _localCrystalColor(c, SPEC);
    const b = _localCrystalColor(c, SPEC);
    expect(a.r).toBe(b.r); expect(a.g).toBe(b.g); expect(a.b).toBe(b.b);
  });

  it('two trace-free neighbours (different ids) get DIFFERENT colours', () => {
    // no chemistry → only the id-hash floor separates them (the halite/galena case)
    const c1 = _localCrystalColor({ crystal_id: 1, zones: [] }, SPEC);
    const c2 = _localCrystalColor({ crystal_id: 2, zones: [] }, SPEC);
    expect(rgbDist(c1, c2)).toBeGreaterThan(3);   // perceptibly apart
  });

  it('a spread of ids fans across a visible-but-subtle colour range', () => {
    const cols = [];
    for (let id = 1; id <= 12; id++) cols.push(_localCrystalColor({ crystal_id: id, zones: [] }, SPEC));
    let maxSep = 0;
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) maxSep = Math.max(maxSep, rgbDist(cols[i], cols[j]));
    expect(maxSep).toBeGreaterThan(20);   // the group spans a readable range
    // …but every crystal stays close to the base (field-guide restraint)
    const base = _topoParseColor(SPEC.class_color);
    for (const c of cols) expect(rgbDist(c, base)).toBeLessThan(80);
  });
});

describe('local colour — chemistry tone (bedrock)', () => {
  it('a high-trace crystal reads DEEPER (lower lightness) than a trace-free one', () => {
    const id = 5;   // hold id fixed so the floor cancels — isolate the chemistry
    const hi = _localCrystalColor({ crystal_id: id, zones: [{ thickness_um: 10, trace_Fe: 6, trace_Mn: 12 }] }, SPEC);
    const lo = _localCrystalColor({ crystal_id: id, zones: [{ thickness_um: 10 }] }, SPEC);
    expect(lightness(hi)).toBeLessThan(lightness(lo));
  });

  it('growth-weights the trace load — a thick clean zone dilutes a thin dirty one', () => {
    const id = 9;
    const mostlyClean = _localCrystalColor({ crystal_id: id, zones: [
      { thickness_um: 1, trace_Fe: 20 }, { thickness_um: 99, trace_Fe: 0 },
    ] }, SPEC);
    const allDirty = _localCrystalColor({ crystal_id: id, zones: [{ thickness_um: 100, trace_Fe: 20 }] }, SPEC);
    expect(lightness(mostlyClean)).toBeGreaterThan(lightness(allDirty));
  });

  it('dissolution (negative) zones do not count toward the trace load', () => {
    const id = 3;
    const withDiss = _localCrystalColor({ crystal_id: id, zones: [
      { thickness_um: 10, trace_Fe: 5 }, { thickness_um: -5, trace_Fe: 999 },
    ] }, SPEC);
    const noDiss = _localCrystalColor({ crystal_id: id, zones: [{ thickness_um: 10, trace_Fe: 5 }] }, SPEC);
    expect(rgbDist(withDiss, noDiss)).toBeLessThan(0.5);   // the -5 zone was ignored
  });
});

describe('local colour — robustness', () => {
  it('null-safe on a bare crystal / missing spec', () => {
    expect(() => _localCrystalColor({}, {})).not.toThrow();
    expect(() => _localCrystalColor({ crystal_id: 0, zones: null }, null)).not.toThrow();
  });

  it('stays inside the [0,1] gamut for extreme trace + extreme id', () => {
    const c = _localCrystalColor({ crystal_id: 99991, zones: [{ thickness_um: 10, trace_Fe: 999, trace_Mn: 999, trace_Ti: 999 }] }, SPEC);
    for (const ch of [c.r, c.g, c.b]) { expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(1); }
  });
});
