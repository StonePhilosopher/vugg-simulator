// tests-js/habit-bias.test.ts — Phase D habit-bias (3D Vision plan).
//
// Pins the gravity-aware c-axis helper that the Three.js renderer uses
// for crystals with growth_environment === 'air' (= nucleated in a
// vadose / drained cavity). The wireframe renderer (99d) already had
// this; Phase D ports the logic to the Three.js path.
//
// Contract:
//   * Fluid-mode crystals: c-axis = substrate normal (unchanged from
//     pre-Phase-D behavior).
//   * Air-mode ceiling cells (substrate normal ny < -0.4): c-axis
//     overrides to world-down (0, -1, 0) → stalactite hangs straight
//     down regardless of wall slope.
//   * Air-mode floor cells (substrate normal ny > +0.4): c-axis
//     overrides to world-up (0, 1, 0) → stalagmite stands vertical.
//   * Air-mode wall cells (|ny| ≤ 0.4): no clean geological analog,
//     falls back to substrate normal.

import { describe, expect, it } from 'vitest';
import { runScenario } from './helpers';

declare const _topoCAxisForCrystal: any;
declare const _resolveCrystalGeomToken: any;
declare const _habitGeomToken: any;
declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;

describe('habit-bias Phase D — gravity-aware c-axis for air crystals', () => {
  it('fluid crystals always follow substrate normal (legacy behavior)', () => {
    const fluid = { growth_environment: 'fluid' };
    // Ceiling-like substrate normal (points down): fluid mode preserves it.
    expect(_topoCAxisForCrystal(fluid, 0, -1, 0)).toEqual([0, -1, 0]);
    // Floor-like substrate normal (points up): fluid mode preserves it.
    expect(_topoCAxisForCrystal(fluid, 0, 1, 0)).toEqual([0, 1, 0]);
    // Wall-like normal (horizontal): fluid mode preserves it.
    expect(_topoCAxisForCrystal(fluid, 1, 0, 0)).toEqual([1, 0, 0]);
    // Tilted normal: fluid mode preserves it bit-for-bit.
    const tilted = _topoCAxisForCrystal(fluid, 0.6, -0.7, 0.3);
    expect(tilted).toEqual([0.6, -0.7, 0.3]);
  });

  it('air crystals on a ceiling cell hang straight down', () => {
    const air = { growth_environment: 'air' };
    // Strict ceiling apex (normal points straight down).
    expect(_topoCAxisForCrystal(air, 0, -1, 0)).toEqual([0, -1, 0]);
    // Tilted ceiling (normal still has ny < -0.4): stalactite is
    // VERTICAL, ignoring the wall tilt.
    expect(_topoCAxisForCrystal(air, 0.6, -0.7, 0.3)).toEqual([0, -1, 0]);
    expect(_topoCAxisForCrystal(air, -0.3, -0.5, 0.8)).toEqual([0, -1, 0]);
  });

  it('air crystals on a floor cell stand straight up', () => {
    const air = { growth_environment: 'air' };
    // Strict floor (normal points straight up).
    expect(_topoCAxisForCrystal(air, 0, 1, 0)).toEqual([0, 1, 0]);
    // Tilted floor (ny > 0.4): stalagmite is VERTICAL.
    expect(_topoCAxisForCrystal(air, 0.5, 0.6, 0.3)).toEqual([0, 1, 0]);
    expect(_topoCAxisForCrystal(air, -0.4, 0.8, 0.2)).toEqual([0, 1, 0]);
  });

  it('air crystals on wall cells fall back to substrate normal', () => {
    const air = { growth_environment: 'air' };
    // Horizontal-wall normal (ny ≈ 0): no gravity override.
    expect(_topoCAxisForCrystal(air, 1, 0, 0)).toEqual([1, 0, 0]);
    expect(_topoCAxisForCrystal(air, 0, 0, 1)).toEqual([0, 0, 1]);
    // Slightly off-horizontal but within ±0.4: still wall-mode.
    expect(_topoCAxisForCrystal(air, 0.9, 0.3, 0.1)).toEqual([0.9, 0.3, 0.1]);
    expect(_topoCAxisForCrystal(air, 0.85, -0.35, 0.4)).toEqual([0.85, -0.35, 0.4]);
  });

  it('threshold edges (ny = ±0.4) stay in wall-mode', () => {
    // Boundary semantics: strictly less than -0.4 OR strictly greater
    // than +0.4 triggers the override. ny = ±0.4 exactly stays radial.
    const air = { growth_environment: 'air' };
    expect(_topoCAxisForCrystal(air, 0.9, -0.4, 0)).toEqual([0.9, -0.4, 0]);
    expect(_topoCAxisForCrystal(air, 0.9, 0.4, 0)).toEqual([0.9, 0.4, 0]);
    // Just past the threshold: override fires.
    expect(_topoCAxisForCrystal(air, 0, -0.41, 0)).toEqual([0, -1, 0]);
    expect(_topoCAxisForCrystal(air, 0, 0.41, 0)).toEqual([0, 1, 0]);
  });

  it('crystal with no growth_environment defaults to fluid (substrate normal)', () => {
    // Loaded-from-old-save case: no growth_environment property → must
    // not crash and must NOT apply gravity bias.
    expect(_topoCAxisForCrystal({}, 0, -1, 0)).toEqual([0, -1, 0]);
    expect(_topoCAxisForCrystal(null, 0, -1, 0)).toEqual([0, -1, 0]);
  });
});

// ============================================================
// Slice 2 — wall.air_mode_default flag forces 'air' at nucleation
// ============================================================

describe('habit-bias Slice 2 — wall.air_mode_default flag', () => {
  // Synthetic minimal conditions for nucleation tests — the flag is
  // about how growth_environment gets stamped, so the rest of the
  // chemistry doesn't matter.
  function makeConditions(wallOpts: any = {}) {
    return new VugConditions({
      fluid: new FluidChemistry({
        Ca: 400, CO3: 600, pH: 7.8, salinity: 0.5,
      }),
      wall: new VugWall(wallOpts),
      temperature: 15,
      pressure_bars: 1,
      depth_m: 0,
      oxygen_fugacity: -50,
    });
  }

  it('default scenario (flag absent) stamps growth_environment from water-state', () => {
    // No air_mode_default, no fluid_surface_ring → all rings submerged
    // → every nucleation gets growth_environment = 'fluid'.
    const sim = new VugSimulator(makeConditions(), []);
    sim.nucleate('calcite', 'vug wall', 1.0);
    sim.nucleate('calcite', 'vug wall', 1.0);
    sim.nucleate('calcite', 'vug wall', 1.0);
    expect(sim.crystals.length).toBe(3);
    for (const c of sim.crystals) {
      expect(c.growth_environment).toBe('fluid');
    }
  });

  it('air_mode_default=true forces growth_environment=air on every nucleation', () => {
    const sim = new VugSimulator(makeConditions({
      air_mode_default: true,
    }), []);
    // Try a bunch of nucleations and confirm every single one is 'air'
    // regardless of which ring the nucleation engine picks.
    for (let i = 0; i < 8; i++) {
      sim.nucleate('calcite', 'vug wall', 1.0);
    }
    expect(sim.crystals.length).toBe(8);
    for (const c of sim.crystals) {
      expect(c.growth_environment).toBe('air');
    }
  });

  it('flag survives a partial water-level mechanic (precedence: flag wins)', () => {
    // Edge case: scenario sets air_mode_default AND fluid_surface_ring
    // to a non-extreme value (mid-cavity). The flag must beat the
    // per-ring water-state computation — a cave that's "half-flooded"
    // is geologically nonsense for this scenario type, but the
    // scenario author's intent (cave-style throughout) wins.
    const sim = new VugSimulator(makeConditions({
      air_mode_default: true,
    }), []);
    sim.conditions.fluid_surface_ring = 8;  // mid-cavity meniscus
    for (let i = 0; i < 5; i++) sim.nucleate('calcite', 'vug wall', 1.0);
    for (const c of sim.crystals) {
      expect(c.growth_environment).toBe('air');
    }
  });
});

// ============================================================
// Slice 5 — stalactite_demo scenario integration
// ============================================================

describe('habit-bias Slice 5 — stalactite_demo scenario produces air-mode crystals', () => {
  it('scenario is registered and loads from data/scenarios.json5', () => {
    expect(SCENARIOS).toBeTruthy();
    expect(SCENARIOS.stalactite_demo).toBeTruthy();
    expect(typeof SCENARIOS.stalactite_demo).toBe('function');
  });

  it('every crystal nucleated in stalactite_demo is air-mode', () => {
    const sim = runScenario('stalactite_demo', { seed: 42 });
    expect(sim).toBeTruthy();
    expect(sim.crystals.length).toBeGreaterThan(0);
    // The whole point of the scenario: every nucleation should be
    // air-mode courtesy of wall.air_mode_default. If a future commit
    // breaks the override path, this will catch it.
    for (const c of sim.crystals) {
      expect(c.growth_environment).toBe('air');
    }
  });

  it('produces crystals concentrated on speleothem zones (floor + ceiling) — Tranche 6 routing', () => {
    // Post-Tranche-6 (2026-05): stalactite_demo opts into zone_chemistry
    // (sharp Ca contrast: floor/ceiling 4000, wall 600) + per_vertex_nucleation.
    // Every nucleation lands at a high-σ cell in either the floor or
    // ceiling band — the wall zone has σ still above threshold but a
    // much smaller (σ-1)² weight, so the joint sampler routes
    // essentially every crystal to floor or ceiling.
    //
    // The visual contract: the rendered scene shows stalactites
    // (ceiling air-mode crystals, c-axis world-down) and stalagmites
    // (floor air-mode crystals, c-axis world-up). Wall-popcorn calcite
    // is the rare exception, not the rule.
    const sim = runScenario('stalactite_demo', { seed: 42 });
    const zoneCounts: any = { floor: 0, wall: 0, ceiling: 0 };
    for (const c of sim.crystals) {
      const z = sim.wall_state.zoneOf(c);
      if (z) zoneCounts[z]++;
    }
    const verticalZoneTotal = zoneCounts.floor + zoneCounts.ceiling;
    // Speleothem zones dominate (floor + ceiling > wall). The whole
    // point of opting into per_vertex_nucleation + sharp zoning was to
    // shift the area-weighted random placement (which favored wall
    // ~68% by cell count) into a σ-weighted placement that favors
    // speleothem zones.
    expect(verticalZoneTotal).toBeGreaterThan(zoneCounts.wall);
    // At least one of each: stalactite or stalagmite must exist
    // (the visible morphologies the scenario was authored to show).
    expect(verticalZoneTotal).toBeGreaterThan(0);
    // Sanity: total should match the air-mode-only crystals from the
    // previous assertion (every crystal is air-mode in this scenario).
    expect(zoneCounts.floor + zoneCounts.wall + zoneCounts.ceiling).toBe(sim.crystals.length);
  });

  it('scenario uses zone_chemistry + per_vertex_nucleation + diffusion=0 (Tranche 6 visual unlock)', () => {
    // Post-Tranche-6 (2026-05): the scenario now opts INTO zone_chemistry,
    // per_vertex_nucleation, and inter_ring_diffusion_rate=0.
    //
    // This test pins all three flags so a future scenario edit that
    // drops one (without intent) fails loudly. The previous v69
    // version of this test pinned the OPT-OUT — the reasoning has
    // inverted now that Tranche 6 closed the gap.
    expect(SCENARIOS.stalactite_demo).toBeTruthy();
    const sim = runScenario('stalactite_demo', { seed: 42 });
    expect(sim.wall_state.per_vertex_nucleation).toBe(true);
    // Sharp wall-cuspy zone chemistry is the design lever. If a future
    // edit smooths the zone gradient, the per-vertex routing weakens
    // and the speleothem visual degrades — flag that.
    const zc = sim.conditions.wall?.zone_chemistry;
    expect(zc).toBeDefined();
    expect(zc.ceiling?.Ca).toBeGreaterThanOrEqual(3000);
    expect(zc.floor?.Ca).toBeGreaterThanOrEqual(3000);
    expect(zc.wall?.Ca).toBeLessThanOrEqual(1000);
    // Diffusion pin: 0 = the gradient persists across the 100-step run.
    expect(sim.inter_ring_diffusion_rate).toBe(0);
  });
});

// ============================================================
// Slice 4 — dripstone geometry token resolver
// ============================================================

describe('habit-bias Slice 4 — _resolveCrystalGeomToken air-mode override', () => {
  it('fluid-mode crystals always return the canonical habit token', () => {
    // For every habit the wireframe + Three.js handle, fluid mode
    // must produce the same token _habitGeomToken would directly.
    const habits = [
      'prismatic', 'acicular', 'rhombohedral', 'scalenohedral',
      'tabular', 'cubic', 'octahedral', 'botryoidal', 'snowball',
    ];
    for (const habit of habits) {
      const fluid = { habit, growth_environment: 'fluid' };
      const canonical = _habitGeomToken(habit);
      expect(_resolveCrystalGeomToken(fluid, habit)).toBe(canonical);
    }
  });

  it('air-mode crystals on dripstone-eligible canonicals resolve to "dripstone"', () => {
    // The eligible set matches js/99d-renderer-wireframe.ts's
    // _isDripstoneEligibleCanonical: prism, spike (acicular), rhomb,
    // scalene, botryoidal.
    const eligible = [
      ['prismatic',     'prism'],
      ['acicular',      'spike'],
      ['rhombohedral',  'rhomb'],
      ['scalenohedral', 'scalene'],
      ['botryoidal',    'botryoidal'],
    ];
    for (const [habit, canonicalToken] of eligible) {
      // Sanity: the canonical lookup matches the expected wireframe map.
      expect(_habitGeomToken(habit)).toBe(canonicalToken);
      // Air mode replaces it with dripstone.
      const air = { habit, growth_environment: 'air' };
      expect(_resolveCrystalGeomToken(air, habit)).toBe('dripstone');
    }
  });

  it('air-mode crystals on NON-eligible canonicals stay on canonical', () => {
    // Isometric (cubes, octahedra, rhombic dodecahedra, dodecahedra,
    // snowball spheres) and tablets don't morph into dripstones.
    // They keep their canonical shape even in air mode — geologically
    // a fluorite cube on the ceiling doesn't drip; it stays a cube.
    const nonEligible = [
      ['cubic',        'cube'],
      ['octahedral',   'octahedron'],
      ['tabular',      'tablet'],
      ['snowball',     'snowball'],
      ['dodecahedral', 'dodecahedron'],
    ];
    for (const [habit, canonicalToken] of nonEligible) {
      expect(_habitGeomToken(habit)).toBe(canonicalToken);
      const air = { habit, growth_environment: 'air' };
      expect(_resolveCrystalGeomToken(air, habit)).toBe(canonicalToken);
    }
  });

  it('crystal with no growth_environment defaults to fluid (canonical token)', () => {
    // Pre-Phase-D save or null crystal: must not crash, must NOT
    // resolve to dripstone.
    expect(_resolveCrystalGeomToken({}, 'prismatic')).toBe('prism');
    expect(_resolveCrystalGeomToken(null, 'prismatic')).toBe('prism');
    expect(_resolveCrystalGeomToken({}, 'acicular')).toBe('spike');
  });

  it('cluster satellites of air-mode parents share the parent\'s gravity-bias helper', () => {
    // PROPOSAL-HABIT-BIAS Slice 3 — _emitClusterSatellites's
    // Rodrigues rotation now consults _topoCAxisForCrystal using the
    // SATELLITE's own re-projected substrate normal (not the parent's).
    // The satellite-position math itself is locked inside the
    // Three.js renderer so unit-testing the cluster code requires
    // mocking Three; instead, this test pins the SHARED CONTRACT.
    // The helper is the source of truth for both parent and satellite
    // c-axes; if a future agent re-tightens it, this test docs that
    // both code paths take the hit.
    const airParent = { growth_environment: 'air' };
    // Satellite that landed near the apex (substrate normal points
    // straight down): gravity-biased to world-down.
    expect(_topoCAxisForCrystal(airParent, 0.2, -0.8, 0.1)).toEqual([0, -1, 0]);
    // Satellite that spilled off the apex onto the upper-wall band
    // (substrate normal angles outward, |ny| < 0.4): stays radial,
    // so the cluster doesn't snap rigidly to gravity.
    expect(_topoCAxisForCrystal(airParent, 0.85, -0.35, 0.4)).toEqual([0.85, -0.35, 0.4]);
    // Floor-zone satellite (stalagmite cluster) — c-axis world-up.
    expect(_topoCAxisForCrystal(airParent, 0.1, 0.9, 0)).toEqual([0, 1, 0]);
  });

  it('stalactite_demo crystals route eligible habits through dripstone', () => {
    // End-to-end: every air-mode crystal in stalactite_demo whose
    // canonical habit is dripstone-eligible MUST resolve to the
    // dripstone primitive. The scenario produces a mix of habits
    // (calcite: scalenohedral_dogtooth → 'scalene'; quartz: prismatic
    // → 'prism'; etc.) so this is a real cross-section.
    //
    // v147 (Week 12 aragonite SI promotion): aragonite now fires in
    // stalactite_demo via the cascade-shifted RNG. Aragonite cave
    // morphology is acicular/frostwork (Hill & Forti 1997 'Cave
    // Minerals of the World' §5.3.4, §10), not smooth stalactite —
    // v147 carved aragonite out of the dripstone assertion as a Phase
    // 1c follow-up.
    //
    // Phase 1c (v156): added the _resolveCrystalGeomToken aragonite
    // air-mode branch → 'aragonite_frostwork' (Hill & Forti 1997 §10).
    // BUG-aragonite-twin-cave-morphology.md closed the v156 model gap:
    // ALL air-mode aragonite is frostwork now, twinned or not. The
    // cyclic-sextet pseudo-hex twin manifests as a 6-fold radiating
    // needle cluster in caves, not a smooth column (Frisia et al. 2002,
    // Grotte de Clamouse). The previously-split branch has collapsed.
    const sim = runScenario('stalactite_demo', { seed: 42 });
    let eligibleAirHits = 0;
    for (const c of sim.crystals) {
      const canonical = _habitGeomToken(c.habit);
      const resolved = _resolveCrystalGeomToken(c, c.habit);
      if (c.mineral === 'aragonite' && c.growth_environment === 'air') {
        // Cave aragonite → frostwork regardless of twin state.
        expect(resolved).toBe('aragonite_frostwork');
        continue;
      }
      if (c.growth_environment === 'air'
          && ['prism','spike','rhomb','scalene','botryoidal'].includes(canonical)) {
        expect(resolved).toBe('dripstone');
        eligibleAirHits++;
      }
    }
    // At least one non-aragonite crystal in the scenario should hit
    // the dripstone path — otherwise the scenario isn't proving the
    // feature.
    expect(eligibleAirHits).toBeGreaterThan(0);
  });
});
