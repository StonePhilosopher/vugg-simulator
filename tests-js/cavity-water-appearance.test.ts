import { describe, expect, it } from 'vitest';

declare const CavityWaterAppearance: any;
declare const FluidChemistry: any;
declare const SIM_VERSION: number;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const VugWall: any;
declare const _topoReplayRenderDecision: any;
declare const simulationStateFingerprint: any;

function conditions(opts: any = {}) {
  return new VugConditions({
    temperature: 25,
    pressure: 0.001,
    fluid: new FluidChemistry({ pH: 7 }),
    wall: new VugWall({
      vug_diameter_mm: 50,
      architecture: 'spherical',
      primary_bubbles: 1,
      secondary_bubbles: 0,
      shape_seed: 42,
    }),
    ...opts,
  });
}

describe('authenticated world-space cavity water appearance', () => {
  it('rejects invalid authored water coordinates before chemistry can run', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => conditions({ fluid_surface_height_mm: value }))
        .toThrow(/finite and non-negative/);
      expect(() => conditions({ fluid_surface_ring: value }))
        .toThrow(/finite and non-negative/);
    }
  });

  it('converts legacy ring coordinates into physical millimetres at geometry binding', () => {
    const c = conditions({ fluid_surface_ring: 8 });
    const sim = new VugSimulator(c, []);
    const span = CavityWaterAppearance.verticalSpanForWall(sim.wall_state);
    expect(c.fluid_surface_height_mm).toBeCloseTo(span * 0.5, 12);
    expect(c.fluid_surface_ring).toBeCloseTo(8, 12);
    expect(c.ringWaterState(6, 16)).toBe('submerged');
    expect(c.ringWaterState(7, 16)).toBe('submerged');
    expect(c.ringWaterState(8, 16)).toBe('vadose');

    c.fluid_surface_ring = 1e6;
    expect(c.fluid_surface_height_mm).toBeCloseTo(span, 12);
    for (let ring = 0; ring < 16; ring++) {
      expect(c.ringWaterState(ring, 16)).toBe('submerged');
    }
  });

  it('treats a water plane at the exact cavity floor as zero-volume drainage', () => {
    const c = conditions({ fluid_surface_ring: 0 });
    const sim = new VugSimulator(c, []);
    expect(c.fluid_surface_height_mm).toBe(0);
    for (let ring = 0; ring < sim.wall_state.ring_count; ring++) {
      expect(c.ringWaterState(ring, sim.wall_state.ring_count)).toBe('vadose');
    }
    const active = sim.wall_state.activeCavitySurfaceAnchorProvider();
    const appearance = CavityWaterAppearance.create(sim.wall_state, c, {
      activeProvider: active,
      providerReceipt: active.receipt,
      surface: active.surface,
      sim,
    });
    expect(appearance.receipt.fully_drained).toBe(true);
    const base = new Float32Array(active.surface.colors);
    const rendered = CavityWaterAppearance.colorsForSurface(
      active.surface, appearance.receipt,
    );
    expect(new Uint8Array(rendered.buffer)).toEqual(new Uint8Array(base.buffer));
  });

  it('preserves an explicitly authored millimetre height instead of reinterpreting it as rings', () => {
    const c = conditions({ fluid_surface_height_mm: 2 });
    const sim = new VugSimulator(c, []);
    const span = CavityWaterAppearance.verticalSpanForWall(sim.wall_state);
    expect(c.fluid_surface_height_mm).toBe(2);
    expect(c.fluid_surface_ring).toBeCloseTo(
      2 / span * sim.wall_state.ring_count, 12,
    );
    expect(c.ringWaterState(1, 16)).toBe('submerged');
    expect(c.ringWaterState(2, 16)).toBe('vadose');
    expect(c.ringWaterState(3, 16)).toBe('vadose');
  });

  it('classifies chemistry rings from their actual vertices against the appearance plane', () => {
    const c = conditions({ fluid_surface_height_mm: 17.25 });
    const sim = new VugSimulator(c, []);
    const mesh = sim.wall_state.meshFor(sim);
    const receipt = CavityWaterAppearance.create(
      sim.wall_state, c, { surface: mesh, sim },
    ).receipt;
    const epsilon = Math.max(
      (receipt.ceiling_elevation_mm - receipt.floor_elevation_mm) * 1e-9, 1e-9,
    );
    for (let ring = 0; ring < sim.wall_state.ring_count; ring++) {
      let minY = Infinity;
      let maxY = -Infinity;
      for (let cell = 0; cell < sim.wall_state.cells_per_ring; cell++) {
        const y = mesh.positions[
          (ring * sim.wall_state.cells_per_ring + cell) * 3 + 1
        ];
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const expected = maxY <= receipt.water_plane_y_mm + epsilon ? 'submerged'
        : minY >= receipt.water_plane_y_mm - epsilon ? 'vadose' : 'meniscus';
      expect(c.ringWaterState(ring, sim.wall_state.ring_count)).toBe(expected);
    }
  });

  it('places the plane from exact surface vertices and tints the entire submerged swath', () => {
    const c = conditions();
    const sim = new VugSimulator(c, []);
    sim.enableProductionCavityAuthority();
    c.fluid_surface_height_mm = 15;
    const active = sim.wall_state.activeCavitySurfaceAnchorProvider();
    const appearance = CavityWaterAppearance.create(sim.wall_state, c, {
      activeProvider: active,
      providerReceipt: active.receipt,
      surface: active.surface,
      sim,
    });
    const positions = active.surface.positions;
    let floor = Infinity;
    for (let offset = 1; offset < positions.length; offset += 3) {
      floor = Math.min(floor, positions[offset]);
    }
    expect(appearance.receipt.floor_elevation_mm).toBe(floor);
    expect(appearance.receipt.water_plane_y_mm).toBeCloseTo(floor + 15, 12);
    expect(appearance.receipt.source_geometry_digest)
      .toBe(active.receipt.surface_buffer_digest);

    const colors = CavityWaterAppearance.colorsForSurface(
      active.surface, appearance.receipt,
    );
    let wet = 0;
    let dry = 0;
    for (let offset = 0; offset < positions.length; offset += 3) {
      const changed = colors[offset] !== active.surface.colors[offset]
        || colors[offset + 1] !== active.surface.colors[offset + 1]
        || colors[offset + 2] !== active.surface.colors[offset + 2];
      if (positions[offset + 1] <= appearance.receipt.water_plane_y_mm) {
        expect(changed).toBe(true);
        wet++;
      } else {
        expect(changed).toBe(false);
        dry++;
      }
    }
    expect(wet).toBeGreaterThan(100);
    expect(dry).toBeGreaterThan(100);

    const segments = CavityWaterAppearance.planeSegments(
      active.surface, appearance.receipt.water_plane_y_mm,
    );
    expect(segments.length).toBeGreaterThan(20);
    for (const segment of segments) {
      expect(segment).toHaveLength(2);
      for (const point of segment) {
        expect(point[1]).toBeCloseTo(appearance.receipt.water_plane_y_mm, 12);
      }
    }
  });

  it('fails chemistry closed when production Cartesian authority is unavailable', () => {
    const c = conditions({ fluid_surface_height_mm: 10 });
    const sim = new VugSimulator(c, []);
    sim.enableProductionCavityAuthority();
    expect(c.ringWaterState(4, sim.wall_state.ring_count)).toMatch(/submerged|meniscus|vadose/);
    sim.wall_state._activeCavitySurfaceAnchorProvider = null;
    sim.wall_state._cavitySurfaceAuthorityFailure = 'test provider loss';
    expect(() => c.ringWaterState(4, sim.wall_state.ring_count))
      .toThrow(/production cavity surface authority is unavailable/);
    expect(() => sim._applyVadoseOxidationOverride())
      .toThrow(/production cavity surface authority is unavailable/);
  });

  it('changes only appearance identity when water moves, not geometry identity', () => {
    const c = conditions({ fluid_surface_height_mm: 10 });
    const sim = new VugSimulator(c, []);
    const mesh = sim.wall_state.meshFor(sim);
    const geometrySig = mesh.sig;
    const stateFingerprint = simulationStateFingerprint(sim);
    const first = CavityWaterAppearance.create(sim.wall_state, c, { surface: mesh, sim });
    c.fluid_surface_height_mm = 20;
    const sameMesh = sim.wall_state.meshFor(sim);
    const second = CavityWaterAppearance.create(sim.wall_state, c, {
      surface: sameMesh, sim,
    });
    expect(sameMesh).toBe(mesh);
    expect(sameMesh.sig).toBe(geometrySig);
    expect(second.receipt.source_geometry_digest)
      .toBe(first.receipt.source_geometry_digest);
    expect(second.receipt.appearance_digest).not.toBe(first.receipt.appearance_digest);
    expect(simulationStateFingerprint(sim)).not.toBe(stateFingerprint);
  });

  it('replays captured water conditions and rejects live-state substitution or tampering', () => {
    const c = conditions({ fluid_surface_height_mm: 10 });
    const sim = new VugSimulator(c, []);
    sim.step = 1;
    sim._repaintWallState();
    const snapshot = sim.wall_state_history.at(-1);
    expect(snapshot.conditions.fluid_surface_height_mm).toBe(10);
    expect(snapshot.cavity_appearance.appearance_digest).toBeTruthy();
    expect(snapshot.sim_version).toBe(SIM_VERSION);
    expect(snapshot.cavity_water_history_cursor).toBe(1);
    expect(snapshot.cavity_water_history_signature).toBeTruthy();

    c.fluid_surface_height_mm = 40;
    // Historical appearance is derived from reconstructed geometry and the
    // canonical height, never today's mutable equivalent diameter.
    sim.wall_state.vug_diameter_mm *= 1.5;
    const decision = _topoReplayRenderDecision(sim.wall_state, snapshot);
    expect(decision.mode).toBe('cavity-field');
    expect(decision.conditions.fluid_surface_height_mm).toBe(10);
    expect(decision.appearance.appearance_digest)
      .toBe(snapshot.cavity_appearance.appearance_digest);

    const tamperedConditions = JSON.parse(JSON.stringify(snapshot));
    tamperedConditions.conditions.fluid_surface_height_mm = 11;
    expect(_topoReplayRenderDecision(sim.wall_state, tamperedConditions).mode)
      .toBe('corrupt');

    const tamperedReceipt = JSON.parse(JSON.stringify(snapshot));
    tamperedReceipt.cavity_appearance.water_plane_y_mm += 1;
    expect(_topoReplayRenderDecision(sim.wall_state, tamperedReceipt).mode)
      .toBe('corrupt');

    const missingReceipt = JSON.parse(JSON.stringify(snapshot));
    delete missingReceipt.cavity_appearance;
    expect(_topoReplayRenderDecision(sim.wall_state, missingReceipt).mode)
      .toBe('corrupt');

    const downgraded = JSON.parse(JSON.stringify(snapshot));
    downgraded.sim_version = 264;
    delete downgraded.cavity_appearance;
    expect(_topoReplayRenderDecision(sim.wall_state, downgraded).mode)
      .toBe('corrupt');

    const versionRemoved = JSON.parse(JSON.stringify(snapshot));
    delete versionRemoved.sim_version;
    versionRemoved.conditions.fluid_surface_height_mm = 11;
    expect(_topoReplayRenderDecision(sim.wall_state, versionRemoved).mode)
      .toBe('corrupt');

    // Rebuilding a valid public appearance digest around forged conditions is
    // still rejected by the independent append-only per-step water history.
    const selfConsistentForgery = JSON.parse(JSON.stringify(snapshot));
    selfConsistentForgery.conditions.fluid_surface_height_mm = 11;
    selfConsistentForgery.cavity_appearance = {
      ...CavityWaterAppearance.create(
        sim.wall_state, selfConsistentForgery.conditions, {
          surface: sim.wall_state.meshFor(sim),
          providerReceipt: selfConsistentForgery.cavity_surface_provider,
          sim,
        },
      ).receipt,
    };
    expect(_topoReplayRenderDecision(sim.wall_state, selfConsistentForgery).mode)
      .toBe('corrupt');
  });
});
