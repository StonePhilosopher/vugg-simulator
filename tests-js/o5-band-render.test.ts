// tests-js/o5-band-render.test.ts — W-F O5c: the band render's PURE core.
//
// O5c makes the masked_horizon phantom VISIBLE: a thin concentric shell inside
// the crystal, at the horizon's recorded radial depth, tinted by the film
// mineral, revealed by the host's Depth-A translucency (the Three renderer, not
// exercised here). The two testable pieces are pure and DOM-free:
//   • maskedHorizonBands(crystal) — reconstructs each horizon's radial fraction
//     from the recorded zone stack (running Σthickness_um / final c_length),
//     the same accumulation js/27 add_zone does, so it reads back the depth the
//     sim actually buried the film at. Render-only: mutates nothing.
//   • filmBandRGB(mineral) — the low-saturation field-guide palette.
//
// These pin the render's data path so a preview eye-check only has to confirm
// the mesh geometry, not the arithmetic.

import { describe, expect, it } from 'vitest';

declare const maskedHorizonBands: any;
declare const filmBandRGB: any;
declare const _o5EmitMaskedBands: any;
declare const THREE: any;

// A crystal is a plain bag here — the helper reads only .zones, .c_length_mm,
// and per-zone .thickness_um / .masked_horizon / .film_mineral.
function crystalWithZones(zones: any[], cLenMm: number): any {
  return { zones, c_length_mm: cLenMm };
}

describe('W-F O5c — maskedHorizonBands (pure radial-depth reconstruction)', () => {
  it('places a single horizon at its running-growth fraction of final size', () => {
    // 300 µm clean → 200 µm masked (film buried) → 500 µm clean. Running total
    // at the horizon = 500 µm = 0.5 mm; final c_length = 1.0 mm → frac 0.5.
    const c = crystalWithZones([
      { thickness_um: 300 },
      { thickness_um: 200, masked_horizon: true, film_mineral: 'clay' },
      { thickness_um: 500 },
    ], 1.0);
    const bands = maskedHorizonBands(c);
    expect(bands.length).toBe(1);
    expect(bands[0].frac).toBeCloseTo(0.5, 6);
    expect(bands[0].mineral).toBe('clay');
  });

  it('returns multiple horizons inner→outer, monotonic in fraction', () => {
    // The elmwood snowball shape: two buried films, then a final clean skin.
    const c = crystalWithZones([
      { thickness_um: 300 },
      { thickness_um: 200, masked_horizon: true, film_mineral: 'clay' },       // run 500 → 500/1200
      { thickness_um: 300, masked_horizon: true, film_mineral: 'iron oxide' }, // run 800 → 800/1200
      { thickness_um: 400 },                                                   // run 1200 = final
    ], 1.2);
    const bands = maskedHorizonBands(c);
    expect(bands.length).toBe(2);
    expect(bands[0].frac).toBeCloseTo(500 / 1200, 6);
    expect(bands[1].frac).toBeCloseTo(800 / 1200, 6);
    expect(bands[1].frac).toBeGreaterThan(bands[0].frac);   // inner → outer
    expect(bands.map((b: any) => b.mineral)).toEqual(['clay', 'iron oxide']);
  });

  it('an unfilmed crystal has no bands', () => {
    const c = crystalWithZones([
      { thickness_um: 400 },
      { thickness_um: 600 },
    ], 1.0);
    expect(maskedHorizonBands(c)).toEqual([]);
  });

  it('drops a horizon that lands on the outer surface (frac ≥ 1 needs no internal shell)', () => {
    // Masked zone is the LAST growth → running total == final c_length → frac 1.
    const c = crystalWithZones([
      { thickness_um: 700 },
      { thickness_um: 300, masked_horizon: true, film_mineral: 'clay' },   // run 1000 = final → frac 1.0
    ], 1.0);
    expect(maskedHorizonBands(c)).toEqual([]);
  });

  it('a net dissolution zone shrinks the running depth exactly as the sim does', () => {
    // clean 600 → dissolve −200 (net 400) → masked +400 (net 800). The horizon
    // sits at 800/1000 = 0.8, NOT (600+400)/final — the negative zone counts.
    const c = crystalWithZones([
      { thickness_um: 600 },
      { thickness_um: -200 },
      { thickness_um: 400, masked_horizon: true, film_mineral: 'chlorite' },  // run 800
      { thickness_um: 200 },                                                  // run 1000 = final
    ], 1.0);
    const bands = maskedHorizonBands(c);
    expect(bands.length).toBe(1);
    expect(bands[0].frac).toBeCloseTo(0.8, 6);
  });

  it('is defensive on degenerate input (no zones / zero size / garbage)', () => {
    expect(maskedHorizonBands(null)).toEqual([]);
    expect(maskedHorizonBands({})).toEqual([]);
    expect(maskedHorizonBands(crystalWithZones([{ thickness_um: 100, masked_horizon: true }], 0))).toEqual([]);
  });

  it('falls back to a generic mineral name when the zone omits film_mineral', () => {
    const c = crystalWithZones([
      { thickness_um: 400 },
      { thickness_um: 200, masked_horizon: true },   // no film_mineral
      { thickness_um: 400 },
    ], 1.0);
    const bands = maskedHorizonBands(c);
    expect(bands.length).toBe(1);
    expect(bands[0].mineral).toBe('film');
  });
});

describe('W-F O5c masked-horizon cavity clipping', () => {
  it('binds every emitted child shell to the parent clip uniforms', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const host = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const state = {
      clipUniforms: {
        uVugRadius: { value: 10 }, uVugCenter: { value: new THREE.Vector3() },
        uVugRingCount: { value: 0 }, uVugRadiiByRing: { value: new Float32Array(32) },
        uVugCellRadii: { value: null }, uVugCellTexW: { value: 0 }, uVugCellTexH: { value: 0 },
        uCavityClipMode: { value: 1 }, uCavityField: { value: null },
        uCavityFieldWorldScale: { value: new THREE.Vector3(1, 1, 1) },
        uCavityFieldWorldBias: { value: new THREE.Vector3() }, uCavityFieldIsovalue: { value: 0 },
        uHelixEnabled: { value: 0 }, uHelixSweep: { value: 0 }, uHelixYCenter: { value: 0 },
        uHelixYSpan: { value: 1 }, uHelixNTurns: { value: 1 }, uHelixFade: { value: 1 },
      },
    };
    const crystal = {
      crystal_id: 7, c_length_mm: 1,
      zones: [
        { thickness_um: 300 },
        { thickness_um: 200, masked_horizon: true, film_mineral: 'clay' },
        { thickness_um: 500 },
      ],
    };
    _o5EmitMaskedBands(host, crystal, state);
    expect(host.children).toHaveLength(1);
    const shader: any = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main(){\n#include <dithering_fragment>\n}',
    };
    host.children[0].material.onBeforeCompile(shader);
    expect(shader.uniforms.uCavityField).toBe(state.clipUniforms.uCavityField);
    expect(shader.fragmentShader).toContain('uniform sampler3D uCavityField');
    expect(host.children[0].material.customProgramCacheKey())
      .toBe('vugg-cavity-clip:field-r32f-freudenthal-v2');
  });
});

describe('W-F O5c — filmBandRGB (low-saturation field-guide palette)', () => {
  const isRGB = (c: any) =>
    Array.isArray(c) && c.length === 3 && c.every((v: any) => typeof v === 'number' && v >= 0 && v <= 1);

  it('maps the named film minerals to distinct muted hues', () => {
    const clay = filmBandRGB('clay');
    const iron = filmBandRGB('iron oxide');
    const chlorite = filmBandRGB('chlorite');
    for (const c of [clay, iron, chlorite]) expect(isRGB(c)).toBe(true);
    // Distinct diagnostic hues: clay buff (R>G>B, warm), chlorite green (G highest),
    // iron oxide rust (R highest, low B).
    expect(chlorite[1]).toBeGreaterThan(chlorite[0]);   // green channel leads
    expect(iron[0]).toBeGreaterThan(iron[2]);           // rust: red over blue
    expect(clay[0]).toBeGreaterThan(clay[2]);           // buff: warm
    expect(clay).not.toEqual(chlorite);
    expect(iron).not.toEqual(chlorite);
  });

  it('substring-matches loose film names (an event can name it loosely)', () => {
    expect(filmBandRGB('hematite stain')).toEqual(filmBandRGB('iron oxide'));   // both → rust
    expect(filmBandRGB('chlorite dusting')).toEqual(filmBandRGB('chlorite'));
  });

  it('returns a neutral buff for an unknown/blank film', () => {
    expect(isRGB(filmBandRGB('unobtanium'))).toBe(true);
    expect(isRGB(filmBandRGB(''))).toBe(true);
    expect(isRGB(filmBandRGB(null as any))).toBe(true);
  });
});
