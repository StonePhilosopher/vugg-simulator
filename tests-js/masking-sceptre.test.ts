// tests-js/masking-sceptre.test.ts — W-F O5 masking sceptre, the classifier core.
//
// classifyQuartzSceptre (js/45) now recognises TWO boundary types on a quartz
// zone-stack:
//   • CORROSION (the original): a run of NEGATIVE zones (grimsel's resorbed SEAL).
//   • MASKING (new): a PRISM-DOMINANT masked_horizon (O5b breakthrough) — a film
//     frosted the prism, the tip renewed a wider cap (Takahashi & Sunagawa 2004
//     ELO). A termination / uniform film (phi_prism ≤ phi_term — every coats_front
//     film today) is NOT a sceptre; that prism-dominance gate is what keeps the
//     fleet byte-identical.
// The render (js/99i _makeSceptreHexPrism) is driven entirely by capFrac, so these
// pins on the classifier's verdict are what a preview eye-check then confirms.

import { describe, expect, it } from 'vitest';

declare const classifyQuartzSceptre: any;

// Build a quartz crystal from a compact zone spec. Each zone: [thickness_um] or
// [thickness_um, {masked_horizon, phi_prism, phi_term}]. step is the index.
function quartz(zoneSpecs: Array<[number] | [number, any]>): any {
  const zones = zoneSpecs.map((spec, i) => {
    const z: any = { thickness_um: spec[0], step: i };
    if (spec[1]) {
      if (spec[1].masked_horizon) z.masked_horizon = true;
      if (spec[1].phi_prism != null) z.masked_phi_prism = spec[1].phi_prism;
      if (spec[1].phi_term != null) z.masked_phi_term = spec[1].phi_term;
    }
    return z;
  });
  return { mineral: 'quartz', habit: 'prismatic', zones };
}

describe('W-F O5 masking sceptre — classifier route B (prism-dominant masked_horizon)', () => {
  it('a prism-dominant masked_horizon with a real stem + cap is a MASKING sceptre', () => {
    // 300µm stem → breakthrough zone (masked, prism-dominant) → 250µm more cap.
    const c = quartz([
      [150], [150],
      [120, { masked_horizon: true, phi_prism: 0.8, phi_term: 0.1 }],   // cap base
      [130], [130],
    ]);
    classifyQuartzSceptre({ crystals: [c] });
    expect(c._sceptre).toBeTruthy();
    expect(c._sceptre.route).toBe('masking');
    expect(c.habit).toBe('scepter_overgrowth');
    expect(c._sceptre.stemUm).toBeCloseTo(300, 3);   // 150+150 before the horizon
    expect(c._sceptre.capUm).toBeCloseTo(380, 3);     // 120 (horizon) + 130 + 130
    expect(c._sceptre.capFrac).toBeCloseTo(380 / 680, 5);
    // cap zones (from the horizon onward) are tagged
    expect(c.zones[2].morph_sceptre).toBe('cap');
    expect(c.zones[4].morph_sceptre).toBe('cap');
    expect(c.zones[0].morph_sceptre).toBeUndefined();
  });

  it('a TERMINATION-dominant film (phi_prism ≤ phi_term) is NOT a sceptre — a buried horizon', () => {
    // Same geometry, but the film is termination-dominant (the coats_front case).
    const c = quartz([
      [150], [150],
      [120, { masked_horizon: true, phi_prism: 0.1, phi_term: 0.8 }],
      [130], [130],
    ]);
    classifyQuartzSceptre({ crystals: [c] });
    expect(c._sceptre).toBeFalsy();
    expect(c.habit).toBe('prismatic');
  });

  it('an EQUAL-coverage film (phi_prism == phi_term) does not qualify — dominance is strict', () => {
    const c = quartz([
      [200], [50],
      [120, { masked_horizon: true, phi_prism: 0.5, phi_term: 0.5 }],
      [200],
    ]);
    classifyQuartzSceptre({ crystals: [c] });
    expect(c._sceptre).toBeFalsy();
  });

  it('a prism-dominant horizon with too little stem or cap does not qualify', () => {
    const tinyStem = quartz([
      [80],                                                            // stem 80 < 200
      [120, { masked_horizon: true, phi_prism: 0.8, phi_term: 0.0 }],
      [300], [300],
    ]);
    classifyQuartzSceptre({ crystals: [tinyStem] });
    expect(tinyStem._sceptre).toBeFalsy();

    const tinyCap = quartz([
      [300], [300],
      [50, { masked_horizon: true, phi_prism: 0.8, phi_term: 0.0 }],   // cap 50 < 200
    ]);
    classifyQuartzSceptre({ crystals: [tinyCap] });
    expect(tinyCap._sceptre).toBeFalsy();
  });
});

describe('W-F O5 masking sceptre — corrosion route (regression: unchanged)', () => {
  it('a resorption boundary (negative zones) still classifies as a CORROSION sceptre', () => {
    const c = quartz([
      [200], [150],       // stem 350
      [-120], [-80],      // resorbed SEAL
      [200], [180],       // cap 380
    ]);
    classifyQuartzSceptre({ crystals: [c] });
    expect(c._sceptre).toBeTruthy();
    expect(c._sceptre.route).toBe('corrosion');
    expect(c.habit).toBe('scepter_overgrowth');
    expect(c._sceptre.stemUm).toBeCloseTo(350, 3);
    expect(c._sceptre.capUm).toBeCloseTo(380, 3);
    // cap zones after the negative run are tagged; the resorbed zones are not
    expect(c.zones[4].morph_sceptre).toBe('cap');
    expect(c.zones[2].morph_sceptre).toBeUndefined();
  });

  it('non-quartz and short crystals are ignored', () => {
    const barite = { mineral: 'barite', habit: 'bladed', zones: [
      { thickness_um: 300 }, { thickness_um: 200, masked_horizon: true, masked_phi_prism: 0.9, masked_phi_term: 0 }, { thickness_um: 300 }, { thickness_um: 100 },
    ] };
    classifyQuartzSceptre({ crystals: [barite] });
    expect(barite._sceptre).toBeFalsy();   // classifier is quartz-only

    const short = quartz([[300], [300, { masked_horizon: true, phi_prism: 0.9, phi_term: 0 }]]);
    classifyQuartzSceptre({ crystals: [short] });   // < 4 zones
    expect(short._sceptre).toBeFalsy();
  });
});
