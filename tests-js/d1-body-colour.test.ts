// tests-js/d1-body-colour.test.ts — D1a (Depth-C body colour), the DEFAULTS tranche.
// resolveBodyColour (js/12a) replaces the class-taxonomy class_color base of
// _localCrystalColor with the real per-species body colour resolved from
// data/minerals.json `color_rules` (default variant) via the COLOUR_LEXICON
// name→sRGB table + SPECIES_BODY_COLOUR overrides. Render-only, RNG-free.
//
// The load-bearing pin is COVERAGE: every species' default colour name must be
// in the lexicon, so a new mineral (or a renamed default) can't silently fall
// back to the class wheel unnoticed. Chemistry-gated variants are D1b.

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

declare const resolveBodyColour: any;
declare const _defaultColourName: any;
declare const _chemistryVariant: any;
declare const COLOUR_LEXICON: any;
declare const SPECIES_BODY_COLOUR: any;

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'minerals.json'), 'utf8')).minerals;
const isHex = (s: any) => typeof s === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(s);

describe('D1a — resolveBodyColour resolution order', () => {
  it('per-species override wins first (the 20 default_color placeholders)', () => {
    // acanthite is a SPECIES_BODY_COLOUR override; its spec default name is the
    // "default_color" placeholder, so the override must take precedence.
    expect(resolveBodyColour({ mineral: 'acanthite' }, SPEC.acanthite)).toBe(SPECIES_BODY_COLOUR.acanthite);
  });

  it('named default resolves through the lexicon', () => {
    const c = resolveBodyColour({ mineral: 'calcite' }, SPEC.calcite);
    expect(c).toBe(COLOUR_LEXICON.white);          // calcite default variant = "white"
    expect(c).not.toBe(SPEC.calcite.class_color);  // and it is NOT the class wheel
  });

  it('no explicit default → first color_rules variant (hematite/sphalerite)', () => {
    // hematite has no {default:true}; first variant is specular_metallic_gray
    expect(resolveBodyColour({ mineral: 'hematite' }, SPEC.hematite)).toBe(COLOUR_LEXICON.specular_metallic_gray);
  });

  it('falls back to class_color when there is no color_rules', () => {
    expect(resolveBodyColour({ mineral: 'x' }, { class_color: '#123456' })).toBe('#123456');
    expect(resolveBodyColour({}, {})).toBe('#d2691e');   // ultimate fallback, no throw
  });

  it('is deterministic (RNG-free) and null-safe', () => {
    const s = SPEC.galena;
    expect(resolveBodyColour({ mineral: 'galena' }, s)).toBe(resolveBodyColour({ mineral: 'galena' }, s));
    expect(() => resolveBodyColour(null, null)).not.toThrow();
  });
});

describe('D1a — lexicon integrity + coverage (the regression guard)', () => {
  it('every lexicon / override value is a valid hex', () => {
    for (const [k, v] of Object.entries(COLOUR_LEXICON)) expect(isHex(v), `lexicon ${k}`).toBe(true);
    for (const [k, v] of Object.entries(SPECIES_BODY_COLOUR)) expect(isHex(v), `override ${k}`).toBe(true);
  });

  it('EVERY species resolves to a real body colour — none silently hits the class-wheel fallback', () => {
    const fell: string[] = [];
    for (const m of Object.keys(SPEC)) {
      const hasOverride = !!SPECIES_BODY_COLOUR[m];
      const name = _defaultColourName(SPEC[m]);
      const inLex = !!(name && COLOUR_LEXICON[name]);
      if (!hasOverride && !inLex) fell.push(`${m} (default:${name})`);
    }
    expect(fell, `missing lexicon coverage for: ${fell.join(', ')}`).toEqual([]);
  });

  it('the collision is broken: mvt same-hue sulfides resolve to distinct colours', () => {
    // sphalerite/galena/pyrite all shared class_color #7feb13; now distinct.
    const g = resolveBodyColour({ mineral: 'galena' }, SPEC.galena);
    const s = resolveBodyColour({ mineral: 'sphalerite' }, SPEC.sphalerite);
    const p = resolveBodyColour({ mineral: 'pyrite' }, SPEC.pyrite);
    expect(new Set([g, s, p]).size).toBe(3);
    expect(SPEC.galena.class_color).toBe(SPEC.sphalerite.class_color);  // they DID share the wheel hue
  });
});

// D1b — chemistry-gated variants fired from the crystal's own growth-weighted traces.
const sph = (fe: number) => resolveBodyColour({ mineral: 'sphalerite', zones: [{ thickness_um: 10, trace_Fe: fe }] }, SPEC.sphalerite);
const qtz = (rad: number) => resolveBodyColour({ mineral: 'quartz', radiation_damage: rad, zones: [{ thickness_um: 10 }] }, SPEC.quartz);

describe('D1b — chemistry-gated variants (the Fe / radiation axes)', () => {
  it('sphalerite darkens MONOTONICALLY with Fe: pale → honey → marmatite (no gap fallback)', () => {
    expect(sph(0.5)).toBe(COLOUR_LEXICON.pale_yellow);       // Fe<2 → base (default), NOT a "<" variant
    expect(sph(5)).toBe(COLOUR_LEXICON.honey_brown);         // Fe 2-10
    expect(sph(12)).toBe(COLOUR_LEXICON.honey_brown);        // Fe 10-15 GAP → rounds DOWN to honey, not pale
    expect(sph(20)).toBe(COLOUR_LEXICON.black_marmatite);    // Fe>15
    // and the ladder is non-lightening: lightness never increases as Fe rises
    // (pale is the lightest, marmatite the darkest)
    expect(sph(12)).not.toBe(COLOUR_LEXICON.pale_yellow);
  });

  it('quartz smoky/morion by radiation_damage; the more extreme threshold wins', () => {
    expect(qtz(0)).toBe(COLOUR_LEXICON.clear);
    expect(qtz(0.4)).toBe(COLOUR_LEXICON.smoky);   // >0.3
    expect(qtz(0.7)).toBe(COLOUR_LEXICON.morion);  // >0.6 beats >0.3
  });

  it('a "<" trigger never fires (the false-positive the probe caught)', () => {
    // sphalerite pale_yellow is "Fe < 2" — it must resolve via the DEFAULT path,
    // never as a fired chemistry variant (else a blank field wins trivially).
    expect(_chemistryVariant({ mineral: 'sphalerite', zones: [{ thickness_um: 10, trace_Fe: 0 }] }, SPEC.sphalerite)).toBeNull();
  });

  it('a variant needing a field the sim lacks (Cr) never fires', () => {
    // wulfenite "red" needs Cr; the sim carries no trace_Cr → null (stays default).
    expect(_chemistryVariant({ mineral: 'wulfenite', zones: [{ thickness_um: 10, trace_Fe: 99 }] }, SPEC.wulfenite)).toBeNull();
  });

  it('a fluorescence (_FL) variant is excluded — that is UV render, not body colour', () => {
    // calcite orange_FL ("Mn>2 and Fe<10") must NOT recolour the body; calcite stays white.
    const c = resolveBodyColour({ mineral: 'calcite', zones: [{ thickness_um: 10, trace_Mn: 8, trace_Fe: 1 }] }, SPEC.calcite);
    expect(c).toBe(COLOUR_LEXICON.white);
  });

  it('is deterministic + null-safe on a bare crystal', () => {
    expect(sph(20)).toBe(sph(20));
    expect(() => _chemistryVariant({}, SPEC.sphalerite)).not.toThrow();
    expect(_chemistryVariant({ zones: [] }, {})).toBeNull();
  });
});
