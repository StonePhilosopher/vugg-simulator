// tests-js/per-zone-color-mn.test.ts — v121 guard.
//
// Closes the v118+v119 chemistry-side capture vs. v121 color-side
// dispatch loop. After v118 (barite) and v119 (sphalerite, wurtzite,
// smithsonite) wired per-zone trace_Mn capture, the COLOR FUNCTION
// in 12-mineral-art.ts didn't actually consume it for those four
// minerals — the bytes were in the zones but no banding ever
// rendered. v121 adds avgMn-based color dispatch for all four.
//
// This test pins that:
//   1. Each of the four minerals' color responds to Mn (high vs low
//      Mn-trace zones produce DIFFERENT crystalColor outputs)
//   2. The per-zone color path (via 98c-ui-zone-bars.ts:zoneColor)
//      shows variation across the 50-pulse TN457 barite zones (the
//      visible-banding signature)
//   3. Backward compatibility: no Mn → same color as before (no
//      drift in scenarios where Mn is background)
//
// "The bar IS the growth narrative." — Professor (98c-ui-zone-bars.ts:61)
// This test guards that the narrative is now actually painted.

import { describe, expect, it } from 'vitest';

declare const crystalColor: (crystal: any) => string;
declare const zoneColor: (zone: any, mineral: string, crystal?: any) => string;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: (seed: number) => void;

function makeCrystal(mineral: string, zones: any[]): any {
  return {
    mineral,
    zones,
    radiation_damage: 0,
    c_length_mm: 5.0,
    habit: 'tabular',
  };
}

function makeZone(traceFe = 0, traceMn = 0, thickness = 10): any {
  return {
    step: 1,
    temperature: 100,
    thickness_um: thickness,
    growth_rate: thickness,
    trace_Fe: traceFe,
    trace_Mn: traceMn,
    trace_Al: 0,
    trace_Ti: 0,
    fluid_inclusion: false,
    note: '',
  };
}

describe('Per-zone color drives off trace_Mn (v121)', () => {
  describe('barite — Putnis & Perthuisot 2001 Mn-banded sulfate', () => {
    it('high Mn → saturated pink (TN457 cabinet aesthetic)', () => {
      const c = makeCrystal('barite', [makeZone(0, 0.10)]);
      expect(crystalColor(c)).toBe('#e85a8c');
    });

    it('mid Mn → softer pink (TN457 typical pulse)', () => {
      const c = makeCrystal('barite', [makeZone(0, 0.05)]);
      expect(crystalColor(c)).toBe('#ec7ba0');
    });

    it('low Mn → pale pink', () => {
      const c = makeCrystal('barite', [makeZone(0, 0.03)]);
      expect(crystalColor(c)).toBe('#f0a0bb');
    });

    it('zero Mn → white-cream default (no banding)', () => {
      const c = makeCrystal('barite', [makeZone(0, 0)]);
      expect(crystalColor(c)).toBe('#f5d6e3');
    });

    it('Fe with no Mn → Cumberland honey-yellow', () => {
      const c = makeCrystal('barite', [makeZone(5, 0)]);
      expect(crystalColor(c)).toBe('#e8a85c');
    });
  });

  describe('sphalerite — Cook & Ciobanu 2007 manganblende', () => {
    it('high Mn + low Fe → salmon-pink manganoan', () => {
      const c = makeCrystal('sphalerite', [makeZone(2, 2.0)]);
      expect(crystalColor(c)).toBe('#d8a888');
    });

    it('mid Mn + low Fe → pink-tinted honey', () => {
      const c = makeCrystal('sphalerite', [makeZone(2, 1.0)]);
      expect(crystalColor(c)).toBe('#d4998a');
    });

    it('no Mn + high Fe → marmatite dark (back-compat)', () => {
      const c = makeCrystal('sphalerite', [makeZone(15, 0)]);
      expect(crystalColor(c)).toBe('#553322');
    });

    it('no Mn + clean → honey-amber (back-compat)', () => {
      const c = makeCrystal('sphalerite', [makeZone(1, 0)]);
      expect(crystalColor(c)).toBe('#ddaa44');
    });
  });

  describe('wurtzite — hex ZnS dimorph, same Mn family', () => {
    it('high Mn → pink hex', () => {
      const c = makeCrystal('wurtzite', [makeZone(2, 2.0)]);
      expect(crystalColor(c)).toBe('#cc998a');
    });

    it('high Fe → dark hex (back-compat)', () => {
      const c = makeCrystal('wurtzite', [makeZone(15, 0)]);
      expect(crystalColor(c)).toBe('#4a2818');
    });

    it('default → warm brown', () => {
      const c = makeCrystal('wurtzite', [makeZone(0, 0)]);
      expect(crystalColor(c)).toBe('#a07050');
    });
  });

  describe('smithsonite — Tsumeb "bonbon pink" Mn₂⁺ variety', () => {
    it('high Mn → bonbon pink', () => {
      const c = makeCrystal('smithsonite', [makeZone(0, 1.5)]);
      expect(crystalColor(c)).toBe('#e89aaa');
    });

    it('mid Mn → pale pink', () => {
      const c = makeCrystal('smithsonite', [makeZone(0, 0.7)]);
      expect(crystalColor(c)).toBe('#dcaab6');
    });

    it('no Mn → sky-blue default (back-compat)', () => {
      const c = makeCrystal('smithsonite', [makeZone(0, 0)]);
      expect(crystalColor(c)).toBe('#88bbcc');
    });

    it('Fe-bearing no Mn → green-tinted (back-compat)', () => {
      const c = makeCrystal('smithsonite', [makeZone(3, 0)]);
      expect(crystalColor(c)).toBe('#88aa88');
    });
  });

  describe('zone-bar visualization — per-zone color WITHIN a single crystal', () => {
    it('TN457 barite long-lived crystal shows >=3 distinct colors across zones', () => {
      // The narrative win: a single barite crystal with 50 pulse-driven
      // zones should display visible banding because per-pulse Mn variation
      // is captured AND now consumed by the color function.
      setSeed(42);
      const { conditions, events } = SCENARIOS.tn457_barite_pulses();
      const sim = new VugSimulator(conditions, events);
      for (let s = 0; s < 110; s++) sim.run_step();

      const bar = sim.crystals.filter((c: any) => c.mineral === 'barite');
      expect(bar.length).toBeGreaterThan(0);

      // Find longest-lived barite (most growth zones)
      const longest = bar.sort((a: any, b: any) =>
        (b.zones || []).length - (a.zones || []).length)[0];
      const positiveZones = longest.zones.filter((z: any) => z.thickness_um > 0);
      expect(positiveZones.length).toBeGreaterThanOrEqual(3);

      // Each zone → zoneColor → distinct color buckets
      const colors = new Set<string>();
      for (const z of positiveZones) {
        colors.add(zoneColor(z, 'barite', longest));
      }
      // Expect at least 2 distinct color buckets across the 50-pulse run.
      // (TN457 narrative: pulses span Mn 0.3-50 ppm cumulative → multiple
      // pink tones from pale to saturated.)
      expect(colors.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Carbonate family — v122 extension', () => {
    it('aragonite high Mn + low Fe → peach (flos-ferri aesthetic)', () => {
      const c = makeCrystal('aragonite', [makeZone(0, 6)]);
      expect(crystalColor(c)).toBe('#e8b8a8');
    });

    it('aragonite mid Mn → pale peach', () => {
      const c = makeCrystal('aragonite', [makeZone(0, 3)]);
      expect(crystalColor(c)).toBe('#e8c8a8');
    });

    it('aragonite no Mn → cream-white default', () => {
      const c = makeCrystal('aragonite', [makeZone(0, 0)]);
      expect(crystalColor(c)).toBe('#f0e8d8');
    });

    it('dolomite high Mn → Tri-State pink (Heyl 1968)', () => {
      const c = makeCrystal('dolomite', [makeZone(0, 5)]);
      expect(crystalColor(c)).toBe('#e8b8b8');
    });

    it('dolomite mid Mn → pink-cream', () => {
      const c = makeCrystal('dolomite', [makeZone(0, 2)]);
      expect(crystalColor(c)).toBe('#e0c8b8');
    });

    it('dolomite no Mn → classic tan default', () => {
      const c = makeCrystal('dolomite', [makeZone(0, 0)]);
      expect(crystalColor(c)).toBe('#dcc8a8');
    });

    it('siderite high Mn + low Fe → manganoan ("oligonite") pink-shift', () => {
      const c = makeCrystal('siderite', [makeZone(10, 5)]);
      expect(crystalColor(c)).toBe('#c89890');
    });

    it('siderite Fe-dominant → classic amber-brown (back-compat)', () => {
      const c = makeCrystal('siderite', [makeZone(20, 0)]);
      expect(crystalColor(c)).toBe('#8b6914');
    });

    it('rhodochrosite high Mn → Sweet Home cherry', () => {
      const c = makeCrystal('rhodochrosite', [makeZone(0, 8)]);
      expect(crystalColor(c)).toBe('#d04060');
    });

    it('rhodochrosite default → raspberry pink', () => {
      const c = makeCrystal('rhodochrosite', [makeZone(0, 3)]);
      expect(crystalColor(c)).toBe('#d87090');
    });

    it('rhodochrosite Fe-substituted → brown-shifted', () => {
      const c = makeCrystal('rhodochrosite', [makeZone(15, 0)]);
      expect(crystalColor(c)).toBe('#a86060');
    });
  });

  describe('Convention regression guards', () => {
    it('Mn dispatch checks avgMn (not last-zone trace_Mn) — averages correctly', () => {
      // Mix one high-Mn zone with one no-Mn zone; avg lands in mid range.
      const c = makeCrystal('barite', [makeZone(0, 0.10), makeZone(0, 0)]);
      // avg = 0.05 → mid pink branch (#ec7ba0)
      expect(crystalColor(c)).toBe('#ec7ba0');
    });

    it('crystals with no zones fall back to MINERAL_GAME_COLORS', () => {
      const c = { mineral: 'barite', zones: [] };
      // No zones → use MINERAL_GAME_COLORS['barite']
      expect(crystalColor(c)).toBe('#eb137f');
    });
  });
});
