// tests-js/narrators-evaporite.test.ts — Tier 1 A narrator ports.
//
// Pins the 5 narrators ported from the (deleted) Python tree:
//   * halite      → js/92c-narrators-halide.ts
//   * mirabilite  → js/92j-narrators-sulfate.ts
//   * thenardite  → js/92j-narrators-sulfate.ts
//   * borax       → js/92l-narrators-borate.ts (new file)
//   * tincalconite→ js/92l-narrators-borate.ts (new file)
//
// What this asserts:
//   * VugSimulator.prototype carries each `_narrate_<mineral>` method.
//   * Each returns a non-empty string when handed a plausible crystal
//     stub (id, habit, c_length_mm, zones, position, etc).
//   * Habit-specific paragraphs fire for each documented habit.
//   * The dissolved branch fires when `c.dissolved === true`.
//   * Dispatch through `this[`_narrate_${c.mineral}`]` resolves
//     (the path 85-simulator.ts:549 uses).
//
// What this is NOT testing: the actual prose. Prose is a content
// judgment; the test only guards the API surface. If a future edit
// tightens the prose the test still passes.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;

// Minimal crystal stub the narrators read from. The fields here match
// what Crystal carries in practice (see js/45-crystal.ts area), but
// stripped to just what the narrators touch.
function makeCrystalStub(mineral: string, habit: string, opts: any = {}) {
  return {
    crystal_id: opts.crystal_id ?? 7,
    mineral,
    habit,
    c_length_mm: opts.c_length_mm ?? 12.5,
    a_width_mm: opts.a_width_mm ?? 6.0,
    twinned: !!opts.twinned,
    twin_law: opts.twin_law ?? '',
    dissolved: !!opts.dissolved,
    zones: opts.zones ?? [],
    position: opts.position ?? 'wall',
    nucleation_temp: opts.nucleation_temp ?? 25,
    total_growth_um: opts.total_growth_um ?? 12500,
    phantom_count: opts.phantom_count ?? 0,
    // Some narrators call this; default to non-fluorescent.
    predict_fluorescence: opts.predict_fluorescence ?? (() => 'non-fluorescent'),
  };
}

// Invoke a narrator through the same dispatch path 85-simulator.ts uses
// at line 549 — `this[`_narrate_${c.mineral}`].call(this, c)`. Pass
// `null` as `this`; narrators here don't actually touch the simulator
// instance, only the crystal argument.
function callNarrator(mineral: string, c: any): string {
  const fn = (VugSimulator.prototype as any)[`_narrate_${mineral}`];
  expect(typeof fn).toBe('function');
  return fn.call(null, c);
}

describe('Tier 1 A — evaporite narrator ports', () => {
  describe('halite (NaCl)', () => {
    it('dispatches and emits non-empty prose for the default cubic habit', () => {
      const story = callNarrator('halite', makeCrystalStub('halite', 'cubic'));
      expect(story.length).toBeGreaterThan(60);
      expect(story).toContain('Halite #7');
      expect(story).toContain('NaCl');
    });

    it('hopper_growth habit branch fires', () => {
      const story = callNarrator('halite', makeCrystalStub('halite', 'hopper_growth'));
      expect(story.toLowerCase()).toContain('hopper');
    });

    it('stalactitic_speleothem habit branch fires', () => {
      const story = callNarrator('halite', makeCrystalStub('halite', 'stalactitic_speleothem'));
      expect(story.toLowerCase()).toContain('speleothem');
    });

    it('color zone branches fire (blue, pink, yellow, hematite)', () => {
      for (const color of ['blue_purple', 'rose_pink', 'yellow', 'red_hematite_inclusion']) {
        const c = makeCrystalStub('halite', 'cubic', {
          zones: [{ note: `color zone: ${color}` }],
        });
        const story = callNarrator('halite', c);
        // Each color rule pushes its own paragraph; the simplest check
        // is that the story grew beyond the default cubic length.
        expect(story.length).toBeGreaterThan(180);
      }
    });

    it('spinel-law twin branch fires (rare for halite)', () => {
      const c = makeCrystalStub('halite', 'cubic', { twinned: true, twin_law: 'spinel_law_rare' });
      const story = callNarrator('halite', c);
      expect(story.toLowerCase()).toContain('spinel');
      expect(story.toLowerCase()).toContain('rare');
    });

    it('dissolved branch fires', () => {
      const story = callNarrator('halite', makeCrystalStub('halite', 'cubic', { dissolved: true }));
      expect(story.toLowerCase()).toContain('dissolved');
    });
  });

  describe('mirabilite (Na₂SO₄·10H₂O)', () => {
    it('dispatches and emits non-empty prose for prismatic habit', () => {
      const story = callNarrator('mirabilite', makeCrystalStub('mirabilite', 'prismatic'));
      expect(story.length).toBeGreaterThan(60);
      expect(story).toContain('Mirabilite #7');
      expect(story).toContain('Glauber');
    });

    it('fibrous_coating habit branch fires', () => {
      const story = callNarrator('mirabilite', makeCrystalStub('mirabilite', 'fibrous_coating'));
      expect(story.toLowerCase()).toContain('efflorescent');
    });

    it('decay-warning branch fires when not dissolved', () => {
      const story = callNarrator('mirabilite', makeCrystalStub('mirabilite', 'prismatic'));
      expect(story.toLowerCase()).toContain('thenardite');
    });

    it('dissolved branch fires', () => {
      const story = callNarrator('mirabilite', makeCrystalStub('mirabilite', 'prismatic', { dissolved: true }));
      expect(story.toLowerCase()).toContain('dissolved');
    });
  });

  describe('thenardite (Na₂SO₄)', () => {
    it('dispatches and emits non-empty prose for dipyramidal habit', () => {
      const story = callNarrator('thenardite', makeCrystalStub('thenardite', 'dipyramidal'));
      expect(story.length).toBeGreaterThan(60);
      expect(story).toContain('Thenardite #7');
      expect(story.toLowerCase()).toContain('anhydrous');
    });

    it('pseudomorph habit references mirabilite (paramorph relationship)', () => {
      const story = callNarrator('thenardite', makeCrystalStub('thenardite', 'pseudomorph'));
      expect(story.toLowerCase()).toContain('paramorph');
      expect(story.toLowerCase()).toContain('mirabilite');
    });

    it('tabular and fibrous_coating habit branches fire', () => {
      const tab = callNarrator('thenardite', makeCrystalStub('thenardite', 'tabular'));
      expect(tab.toLowerCase()).toContain('tabular');
      const fib = callNarrator('thenardite', makeCrystalStub('thenardite', 'fibrous_coating'));
      expect(fib.toLowerCase()).toContain('efflorescent');
    });
  });

  describe('borax (Na₂[B₄O₅(OH)₄]·8H₂O)', () => {
    it('dispatches and emits non-empty prose for prismatic habit', () => {
      const story = callNarrator('borax', makeCrystalStub('borax', 'prismatic'));
      expect(story.length).toBeGreaterThan(60);
      expect(story).toContain('Borax #7');
    });

    it('cottonball habit branch fires (Death Valley playa)', () => {
      const story = callNarrator('borax', makeCrystalStub('borax', 'cottonball'));
      expect(story.toLowerCase()).toContain('cottonball');
    });

    it('dehydration-warning branch fires when not dissolved (the borax→tincalconite clock)', () => {
      const story = callNarrator('borax', makeCrystalStub('borax', 'prismatic'));
      expect(story.toLowerCase()).toContain('tincalconite');
    });

    it('dissolved branch fires', () => {
      const story = callNarrator('borax', makeCrystalStub('borax', 'prismatic', { dissolved: true }));
      expect(story.toLowerCase()).toContain('dissolved');
    });
  });

  describe('tincalconite (Na₂B₄O₇·5H₂O)', () => {
    it('dispatches and emits non-empty prose for pseudomorph habit', () => {
      const story = callNarrator('tincalconite', makeCrystalStub('tincalconite', 'pseudomorph'));
      expect(story.length).toBeGreaterThan(60);
      expect(story).toContain('Tincalconite #7');
    });

    it('references borax as the parent crystal (paramorph relationship)', () => {
      const story = callNarrator('tincalconite', makeCrystalStub('tincalconite', 'pseudomorph'));
      expect(story.toLowerCase()).toContain('borax');
    });

    it('states the reversible high-humidity boundary without overclaiming permanence', () => {
      const story = callNarrator('tincalconite', makeCrystalStub('tincalconite', 'pseudomorph'));
      expect(story.toLowerCase()).toContain('hydrate back');
      expect(story.toLowerCase()).toContain('does not yet replay');
    });
  });
});
