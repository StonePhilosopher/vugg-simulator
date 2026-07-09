// tests-js/uv-zone-bars.test.ts — Door 2, the UV scale audit (98c, 2026-07-09)
//
// zoneFluorescence gates were broth-scale numbers tested against
// zone-scale traces; the recalibration mirrors the growth engines' own
// recorded classifiers (js/52 calcite ladder, js/59 willemite ladder,
// spec fluorescence canon) so the bar agrees with the zone notes it
// renders beside. Pins are SYNTHETIC zone stacks at census-measured
// images (tools/uv-zone-census.mjs) — no scenario runs, no DOM.

import { describe, expect, it } from 'vitest';

declare function zoneFluorescence(zone: any, mineral: string, crystal: any): string | null;
declare function uvSummary(mineral: string): string;
declare const Crystal: any;

const xtal = (o: any = {}) => ({ radiation_damage: 0, ...o });

// A real Crystal (prototype methods live) with synthetic zones — the
// narrator (predict_fluorescence) runs the same zone-scale gates as the
// bar since v225; these pins hold the two voices together.
const narr = (mineral: string, zones: any[], extra: any = {}) => {
  const c = Object.create(Crystal.prototype);
  Object.assign(c, { mineral, zones, radiation_damage: 0, ...extra });
  return c.predict_fluorescence() as string;
};

describe('zoneFluorescence — calcite mirrors the js/52 ladder branch-for-branch', () => {
  it('four tiers + no-activator, exactly the engine note classes', () => {
    // dark CL: Mn present, Fe > 2 quenches (deccan image: Fe 24.8 / Mn 3.7)
    expect(zoneFluorescence({ trace_Mn: 3.7, trace_Fe: 24.8 }, 'calcite', xtal())).toBeNull();
    // brilliant salmon (tutorial rim image: Mn 14.8, Fe 0.04 post-recharge)
    expect(zoneFluorescence({ trace_Mn: 14.8, trace_Fe: 0.04 }, 'calcite', xtal())).toBe('#ff5040');
    // moderate orange
    expect(zoneFluorescence({ trace_Mn: 3.0, trace_Fe: 0.8 }, 'calcite', xtal())).toBe('#e06a30');
    // weak orange (elmwood image: Fe p50 1.27 / Mn 4.0 — the famous
    // fluorescent the 223a96b gate false-quenched; it GLOWS again)
    expect(zoneFluorescence({ trace_Mn: 4.0, trace_Fe: 1.27 }, 'calcite', xtal())).toBe('#a05226');
    // no activator (searles image: Mn 0.14)
    expect(zoneFluorescence({ trace_Mn: 0.14, trace_Fe: 0.08 }, 'calcite', xtal())).toBeNull();
  });

  it('quench outranks brightness — ladder order is the engine order', () => {
    // Mn 8 would be brilliant-tier, but Fe 3 quenches first (js/52 checks
    // dark-CL before the glow tiers; the bar must match).
    expect(zoneFluorescence({ trace_Mn: 8, trace_Fe: 3 }, 'calcite', xtal())).toBeNull();
  });
});

describe('zoneFluorescence — corundum family: Cr activator, Fe quench at zone image', () => {
  it('numeric trace_Cr arm (v225+ records)', () => {
    expect(zoneFluorescence({ trace_Cr: 4.5, trace_Fe: 0.06 }, 'ruby', xtal())).toBe('#ff5050');
  });
  it('note arm keeps pre-v225 records replaying honest', () => {
    const note = "Mogok ruby red (Cr³⁺ 4.5 ppm), rhombohedral present";
    expect(zoneFluorescence({ trace_Fe: 0.06, note }, 'ruby', xtal())).toBe('#ff5050');
  });
  it('Fe quenches at the zone image (basalt-hosted ≥ 4; gate 2.0)', () => {
    expect(zoneFluorescence({ trace_Cr: 4.5, trace_Fe: 4.0 }, 'ruby', xtal())).toBeNull();
  });
  it('no Cr datum, no note → dark', () => {
    expect(zoneFluorescence({ trace_Fe: 0.06 }, 'ruby', xtal())).toBeNull();
  });
  it('pink Cr-sapphire rides the same physics', () => {
    const note = "pink sapphire (Cr³⁺ 0.30 — sub-ruby threshold)";
    expect(zoneFluorescence({ trace_Fe: 0.1, note }, 'sapphire', xtal())).toBe('#ff5050');
  });
});

describe('zoneFluorescence — fluorite: REE (Eu²⁺ proxy) or defects, NOT Mn', () => {
  it('trace_Y arm (the recorded REE proxy, js/53)', () => {
    expect(zoneFluorescence({ trace_Y: 0.03 }, 'fluorite', xtal())).toBe('#5588ff');
  });
  it('yttrofluorite / REE-bearing note arms (custom writers + pre-v225)', () => {
    const grass = "color zone: rich grass-green (fresh, HREE-rich yttrofluorite) (octahedral, Y 3.2 ppm)";
    const pale = "color zone: pale yellow-green (REE-bearing, photobleach-fadable)";
    expect(zoneFluorescence({ note: grass }, 'fluorite', xtal())).toBe('#5588ff');
    expect(zoneFluorescence({ note: pale }, 'fluorite', xtal())).toBe('#5588ff');
  });
  it('the Fe-green body-colour note does NOT match (its "Y-yttrofluorite" mention is a contrast, not a claim) — and the old Mn arm is gone', () => {
    const trap = "color zone: green (Fe-bearing — different mechanism from Y-yttrofluorite green)";
    // mvt image: Mn 3.51 lit the old wrong-element gate; IL-KY-type
    // fluorite is famously non-fluorescent. Dark now.
    expect(zoneFluorescence({ note: trap, trace_Mn: 3.51 }, 'fluorite', xtal())).toBeNull();
  });
  it('plain F-center body colour is not a UV claim', () => {
    const fc = "color zone: blue-violet (F-center, low-REE)";
    expect(zoneFluorescence({ note: fc }, 'fluorite', xtal())).toBeNull();
  });
  it('radiation defects still glow', () => {
    expect(zoneFluorescence({}, 'fluorite', xtal({ radiation_damage: 0.5 }))).toBe('#5588ff');
  });
});

describe('zoneFluorescence — willemite mirrors the js/59 ladder (spec threshold 0.005)', () => {
  it('bright green from trace-Mn up — the tn457 zones (0.075) the old 0.1 gate darkened', () => {
    expect(zoneFluorescence({ trace_Mn: 0.075 }, 'willemite', xtal())).toBe('#88ff44');
    expect(zoneFluorescence({ trace_Mn: 0.006 }, 'willemite', xtal())).toBe('#88ff44');
  });
  it('engine else-tier is "weakly fluorescent", not dark', () => {
    expect(zoneFluorescence({ trace_Mn: 0.004 }, 'willemite', xtal())).toBe('#5a9944');
  });
});

describe('zoneFluorescence — the uranyl family and the uraninite canon', () => {
  it('autunite intense apple-green; uranophane/uranospinite bright yellow-green', () => {
    expect(zoneFluorescence({}, 'autunite', xtal())).toBe('#aaff66');
    expect(zoneFluorescence({}, 'uranophane', xtal())).toBe('#ccff44');
    expect(zoneFluorescence({}, 'uranospinite', xtal())).toBe('#aaee55');
  });
  it('Cu²⁺ quenches the torbernite family — dark is diagnostic', () => {
    expect(zoneFluorescence({}, 'metatorbernite', xtal())).toBeNull();
    expect(zoneFluorescence({}, 'metazeunerite', xtal())).toBeNull();
  });
  it('uraninite is NON-fluorescent (research-uraninite.md canon; the old bar faked ×584 glowing zones)', () => {
    expect(zoneFluorescence({}, 'uraninite', xtal({ radiation_damage: 22 }))).toBeNull();
  });
});

describe('zoneFluorescence — emerald: Colombian low-Fe glows, schist-type quenched', () => {
  it('zone-image split at 1.0 (partition 0.010 → broth ~100)', () => {
    expect(zoneFluorescence({ trace_Fe: 0.5 }, 'emerald', xtal())).toBe('#c04040');
    expect(zoneFluorescence({ trace_Fe: 1.5 }, 'emerald', xtal())).toBeNull();
  });
});

describe('zoneFluorescence — adamite: uranyl-activated, Cu QUENCHES (the inverted gate)', () => {
  it('plain adamite bright lime; cuprian adamite dim — the pre-audit sense was backwards', () => {
    const plain = "prismatic, yellow-green — UV-FLUORESCENT lime-green 💚 (trace uranyl, the Mapimí classic)";
    const cupro = "tabular, vivid green (cuproadamite) — Cu²⁺ mutes the UV glow";
    expect(zoneFluorescence({ note: plain }, 'adamite', xtal())).toBe('#88dd66');
    expect(zoneFluorescence({ note: cupro }, 'adamite', xtal())).toBe('#557744');
  });
  it('the v225 numeric arm reads the recorded trace_Cu directly', () => {
    expect(zoneFluorescence({ trace_Cu: 2.1 }, 'adamite', xtal())).toBe('#557744');
    expect(zoneFluorescence({ trace_Cu: 0.05 }, 'adamite', xtal())).toBe('#88dd66');
  });
});

describe('zoneFluorescence — apophyllite: honest inert (Mn-orange retired)', () => {
  it('no Mn arm — the literature pass found no orange response, and zones carry no trace_Mn anyway', () => {
    expect(zoneFluorescence({ trace_Mn: 0.5 }, 'apophyllite', xtal())).toBeNull();
    expect(zoneFluorescence({}, 'apophyllite', xtal())).toBeNull();
  });
});

describe('zoneFluorescence — sphalerite/wurtzite: cleiophane orange, marmatite dead', () => {
  it('low-Fe gemmy cleiophane glows Mn-orange (elmwood image: Fe 1.39 / Mn 0.2)', () => {
    expect(zoneFluorescence({ trace_Mn: 0.2, trace_Fe: 1.39 }, 'sphalerite', xtal())).toBe('#ff9944');
  });
  it('Fe is the hard veto (mvt image: Fe 14.4) — and wurtzite rides the same physics', () => {
    expect(zoneFluorescence({ trace_Mn: 1.25, trace_Fe: 14.4 }, 'sphalerite', xtal())).toBeNull();
    expect(zoneFluorescence({ trace_Mn: 1.4, trace_Fe: 19.8 }, 'wurtzite', xtal())).toBeNull();
  });
  it('no activator, no glow', () => {
    expect(zoneFluorescence({ trace_Mn: 0.05, trace_Fe: 0.1 }, 'sphalerite', xtal())).toBeNull();
  });
});

describe('zoneFluorescence — feldspar: weak Fe³⁺ deep red SW; amazonite gets no arm', () => {
  it('top-decile Fe glows dim ~700 nm red (Bostwick: Franklin albite FL red SW)', () => {
    expect(zoneFluorescence({ trace_Fe: 0.5 }, 'feldspar', xtal())).toBe('#6a2020');
    expect(zoneFluorescence({ trace_Fe: 0.2 }, 'feldspar', xtal())).toBeNull();
  });
  it('an amazonite zone note does not light anything — Pb²⁺ is a colour centre, not an activator', () => {
    const note = "amazonite (Pb²⁺ = 0.40 ppm) — green from lead substituting for potassium";
    expect(zoneFluorescence({ note, trace_Fe: 0.13 }, 'feldspar', xtal())).toBeNull();
  });
});

describe('zoneFluorescence — the honest constants', () => {
  it('scheelite intrinsic blue-white; aragonite dark until the organics field exists', () => {
    expect(zoneFluorescence({}, 'scheelite', xtal())).toBe('#ddddff');
    expect(zoneFluorescence({}, 'aragonite', xtal())).toBeNull();
  });
});

describe('predict_fluorescence (js/27) — the narrator shares the bar\'s gates (v225)', () => {
  it('calcite: banded verdict when glow and quench zones coexist (the tutorial story)', () => {
    const s = narr('calcite', [
      { trace_Mn: 1.1, trace_Fe: 4.8 },   // dark early
      { trace_Mn: 5.4, trace_Fe: 4.8 },   // dark middle (loaded-but-quenched)
      { trace_Mn: 14.4, trace_Fe: 0.24 }, // brilliant rim
    ]);
    expect(s).toMatch(/^banded orange-red/);
  });
  it('calcite: pure tiers narrate their tier', () => {
    expect(narr('calcite', [{ trace_Mn: 14, trace_Fe: 0.1 }])).toMatch(/^brilliant salmon/);
    expect(narr('calcite', [{ trace_Mn: 4, trace_Fe: 24 }])).toMatch(/^quenched/);
    expect(narr('calcite', [{ trace_Mn: 0.2, trace_Fe: 0.1 }])).toMatch(/^non-fluorescent/);
  });
  it('ruby: the Mogok signature from recorded trace_Cr; basalt-type quenches', () => {
    expect(narr('ruby', [{ trace_Cr: 4.5, trace_Fe: 0.06 }])).toMatch(/strong red.*694/);
    expect(narr('ruby', [{ trace_Cr: 4.5, trace_Fe: 4.0 }])).toMatch(/^weak to inert.*basalt/);
  });
  it('quartz: the Al-blue branch is retired — honestly inert', () => {
    expect(narr('quartz', [{ trace_Al: 97 }])).toMatch(/^non-fluorescent \(macrocrystalline/);
  });
  it('adamite: uranyl-bright vs cuprian-dim (the inverted sense), off recorded trace_Cu', () => {
    expect(narr('adamite', [{ trace_Cu: 2.1 }])).toMatch(/^dim green \(cuprian/);
    expect(narr('adamite', [{ trace_Cu: 0.02 }])).toMatch(/^bright lime-green.*Mapimí/);
  });
  it('the uranyl family: bright members and the Cu²⁺ veto', () => {
    expect(narr('uranophane', [{}])).toMatch(/^bright yellow-green.*outshines autunite/);
    expect(narr('metatorbernite', [{}])).toMatch(/^non-fluorescent — Cu²⁺ kills/);
  });
  it('fluorite: a locality trait — REE lot glows, plain lot says why it does not', () => {
    expect(narr('fluorite', [{ trace_Y: 0.03 }])).toMatch(/^blue-violet/);
    expect(narr('fluorite', [{ trace_Mn: 3.5 }])).toMatch(/locality trait/);
  });
  it('sphalerite: cleiophane orange with tribo; marmatitic Fe reads quenched', () => {
    expect(narr('sphalerite', [{ trace_Mn: 0.2, trace_Fe: 1.4 }])).toMatch(/^orange under LW.*tribo/);
    expect(narr('sphalerite', [{ trace_Mn: 1.2, trace_Fe: 14 }])).toMatch(/marmatitic/);
  });
  it('willemite finally narrates (was unknown): the Franklin classic', () => {
    expect(narr('willemite', [{ trace_Mn: 0.075 }])).toMatch(/^bright green.*Franklin/);
  });
  it('feldspar: weak Fe³⁺ deep red; the amazonite Pb glow claim is retired', () => {
    expect(narr('feldspar', [{ trace_Fe: 0.5 }])).toMatch(/^weak deep-red/);
    expect(narr('feldspar', [{ trace_Fe: 0.1, note: 'amazonite (Pb²⁺ = 0.40 ppm) — green from lead' }]))
      .toMatch(/colour centre, not a glow/);
  });
});

describe('uvSummary — structured spec entries render as prose, not [object Object]', () => {
  it('plain-string entries pass through (ruby)', () => {
    const s = uvSummary('ruby');
    expect(typeof s).toBe('string');
    expect(s).toMatch(/694|red/i);
  });
  it('structured entries compact to activator/colour prose (calcite)', () => {
    const s = uvSummary('calcite');
    // "[object" catches BOTH failure shapes: the whole-entry "[object
    // Object]" and the empty-object-field "[object quenches" the live
    // check caught (spec empty slots arrive as objects, not strings).
    expect(s).not.toMatch(/\[object/);
    expect(s).toMatch(/orange/i);
  });
  it('canonical non-fluorescents say so', () => {
    expect(uvSummary('uraninite')).toBe('non-fluorescent — diagnostic');
  });
  it('unknown mineral stays honest', () => {
    expect(uvSummary('notamineral')).toBe('inert under UV');
  });
});
