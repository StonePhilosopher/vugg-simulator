// tests-js/selenite-swallowtail.test.ts — second iconic twin primitive
//
// v134 (2026-05-22) ships PRIM_SELENITE_SWALLOWTAIL_TWIN — two tabular
// gypsum blades joined at the base on a {100} contact plane, opening
// upward in a V at 60° total (30° per blade from vertical). The
// canonical "fishtail" / "swallowtail" twin (Dana 8th ed. CaSO4·2H2O
// section; Hurlbut & Klein 23rd ed. §13). Selenite gets twinned at p=0.18
// per nucleation (v133's twin_laws[].probability) — about 1 in 5
// selenite crystals across all scenarios.
//
// Dispatch precedence (in _lookupCrystalPrimitive):
//   1. fluorite penetration check
//   2. selenite swallowtail check (this test)
//   3. air-mode dripstone override
//   4. canonical primitive (habit-string)
//
// Same precedence rationale as fluorite: a twinned selenite in an
// air-mode cavity is still a twin, not a dripstone. The check runs
// before the air override.

import { describe, expect, it } from 'vitest';

declare const PRIM_SELENITE_SWALLOWTAIL_TWIN: any;
declare const PRIM_CUBE: any;
declare const _lookupCrystalPrimitive: any;

describe('selenite-swallowtail — primitive geometry', () => {
  it('PRIM_SELENITE_SWALLOWTAIL_TWIN is defined', () => {
    expect(PRIM_SELENITE_SWALLOWTAIL_TWIN).toBeTruthy();
    expect(PRIM_SELENITE_SWALLOWTAIL_TWIN.name).toBe('selenite_swallowtail_twin');
  });

  it('has 16 vertices (8 per blade)', () => {
    expect(PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices).toHaveLength(16);
  });

  it('has 24 edges (12 per blade)', () => {
    expect(PRIM_SELENITE_SWALLOWTAIL_TWIN.edges).toHaveLength(24);
  });

  it('the two blades share a contact base edge at world (0, -0.1, ±b)', () => {
    // Blade A's contact-base corners are at indices 4, 5 — the
    // (xl=0, yl=0, zl=±b) corners of blade A's local frame. Blade B's
    // contact-base corners are at indices 8, 9 — the (xl=0, yl=0,
    // zl=±b) corners of blade B's local frame (blade B's local xl
    // ranges over {0, +2a}). After +30°/-30° rotation around the
    // z-axis through origin, the xl=0 yl=0 corners stay fixed at
    // world (0, 0, ±b) + base_y shift.
    const v4 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[4];
    const v5 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[5];
    const v8 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[8];
    const v9 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[9];
    // Coincidence: blade A 4 ↔ blade B 8, blade A 5 ↔ blade B 9.
    expect(v4[0]).toBeCloseTo(v8[0], 4);
    expect(v4[1]).toBeCloseTo(v8[1], 4);
    expect(v4[2]).toBeCloseTo(v8[2], 4);
    expect(v5[0]).toBeCloseTo(v9[0], 4);
    expect(v5[1]).toBeCloseTo(v9[1], 4);
    expect(v5[2]).toBeCloseTo(v9[2], 4);
    // World position: contact-base edge at X=0, Y=-0.1.
    expect(v4[0]).toBeCloseTo(0, 4);
    expect(v4[1]).toBeCloseTo(-0.1, 4);
  });

  it('blades fan in OPPOSITE X directions at the contact-top (swallowtail V)', () => {
    // Contact-top corners — where the two blades originally met on
    // the {100} plane at the top, but spread apart under twin rotation.
    // Blade A's contact-top (xl=0, yl=L) is at index 6 — leans -X.
    // Blade B's contact-top is at index 10 (xl=0 in blade B local,
    // yl=L) — leans +X. These are the V's open mouth.
    const v6 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[6];
    const v10 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[10];
    expect(v6[0]).toBeLessThan(0);  // blade A top leans -X
    expect(v10[0]).toBeGreaterThan(0);  // blade B top leans +X
    // Both tops above the wall (Y > 0).
    expect(v6[1]).toBeGreaterThan(0);
    expect(v10[1]).toBeGreaterThan(0);
    // Symmetric (mirror about X=0).
    expect(v6[0]).toBeCloseTo(-v10[0], 4);
    expect(v6[1]).toBeCloseTo(v10[1], 4);
    expect(v6[2]).toBeCloseTo(v10[2], 4);
  });

  it('outer base corners (away from contact) bury below the wall', () => {
    // Blade A's outer base corners are at indices 0, 1 (xl=-2a, yl=0).
    // After +30° rotation: world X = -2a*cos30°, world Y = -2a*sin30°
    // + base_y. With a=0.08, base_y=-0.1: Y = -0.08 - 0.1 = -0.18 (well
    // below the y=-0.1 wall). The blade A 0 ↔ blade B 12 outer base
    // pair mirrors across X=0 like a swallowtail's buried lower body.
    const v0 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[0];
    const v12 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[12];
    expect(v0[1]).toBeLessThan(-0.1);
    expect(v12[1]).toBeLessThan(-0.1);
    expect(v0[0]).toBeCloseTo(-v12[0], 4);  // X-mirror
  });

  it('the V opening angle is 60° (30° per blade from vertical)', () => {
    // The blade A c-axis runs from contact-base (index 4) to
    // contact-top (index 6). Direction vector (v6 - v4) should make
    // a 30° angle with +Y (vertical).
    const v4 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[4];
    const v6 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[6];
    const dx = v6[0] - v4[0];
    const dy = v6[1] - v4[1];
    const angleFromVertical = Math.atan2(Math.abs(dx), dy);  // radians
    expect(angleFromVertical).toBeCloseTo(Math.PI / 6, 4);  // 30°
  });

  it('per-blade edge sets are disjoint (no edges cross between blades)', () => {
    // All 12 blade-A edges have both endpoints in [0, 7].
    // All 12 blade-B edges have both endpoints in [8, 15].
    const bladeA = PRIM_SELENITE_SWALLOWTAIL_TWIN.edges.filter((e: number[]) => e[0] < 8 && e[1] < 8);
    const bladeB = PRIM_SELENITE_SWALLOWTAIL_TWIN.edges.filter((e: number[]) => e[0] >= 8 && e[1] >= 8);
    expect(bladeA).toHaveLength(12);
    expect(bladeB).toHaveLength(12);
    expect(bladeA.length + bladeB.length).toBe(24);
  });

  it('blade lengths are preserved (rigid rotation, not skew)', () => {
    // Blade A contact-base-to-contact-top (indices 4 → 6) should equal
    // local L=1.1. Blade B (indices 12 → 14) should match.
    const distBetween = (a: number[], b: number[]) => Math.sqrt(
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
    );
    const v4 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[4];
    const v6 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[6];
    const v12 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[12];
    const v14 = PRIM_SELENITE_SWALLOWTAIL_TWIN.vertices[14];
    expect(distBetween(v4, v6)).toBeCloseTo(1.1, 4);
    expect(distBetween(v12, v14)).toBeCloseTo(1.1, 4);
  });
});

describe('selenite-swallowtail — dispatch precedence in _lookupCrystalPrimitive', () => {
  function mkSelenite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'selenite',
      habit: 'tabular',
      c_length_mm: 10,
      a_width_mm: 3,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned selenite + swallowtail law → swallowtail primitive', () => {
    const c = mkSelenite({ twinned: true, twin_law: 'swallowtail' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('untwinned selenite → canonical (NOT swallowtail)', () => {
    const c = mkSelenite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('twinned selenite with empty twin_law → canonical (defensive)', () => {
    const c = mkSelenite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('twinned selenite with a different twin_law → canonical', () => {
    // A hypothetical future selenite twin (e.g. arrow-head {101})
    // shouldn't be routed to the swallowtail primitive. Only the
    // exact 'swallowtail' law name fires.
    const c = mkSelenite({ twinned: true, twin_law: 'arrowhead' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('twinned gypsum with swallowtail law → NOT the selenite twin', () => {
    // The dispatch is mineral-scoped. 'gypsum' as a separate mineral
    // entry (if it exists) wouldn't hit the swallowtail primitive even
    // with the right twin_law — the law is keyed to mineral='selenite'.
    const c = { ...mkSelenite({ twinned: true, twin_law: 'swallowtail' }), mineral: 'gypsum' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('twinned selenite in air-mode cavity → swallowtail (beats dripstone)', () => {
    // Mirrors the fluorite-twin behavior: the twin override runs
    // BEFORE the air-mode dripstone check. A drained-cavity swallowtail
    // selenite is still a swallowtail, not a dripstone.
    const c = mkSelenite({
      twinned: true, twin_law: 'swallowtail',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });

  it('twinned fluorite with swallowtail law → NOT the selenite twin', () => {
    // Mineral-scoped check: fluorite with twin_law='swallowtail' would
    // not be a real specimen (fluorite isn't tabular) but defensive
    // code should still route mineral-correctly. Fluorite's primitive
    // dispatch should fall through (the fluorite twin check is for
    // 'penetration', not 'swallowtail').
    const c = { ...mkSelenite({ twinned: true, twin_law: 'swallowtail' }), mineral: 'fluorite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_SELENITE_SWALLOWTAIL_TWIN);
  });
});
