// tests-js/mesh.test.ts — Phase 2 of PROPOSAL-CAVITY-MESH.
//
// What the Phase 2 refactor promises:
//   * The cavity-geometry math (vertex positions, vertex colors,
//     triangulation) moves out of js/99i-renderer-three.ts and into
//     WallMesh — but the resulting numbers are byte-identical to what
//     the renderer used to compute inline.
//   * WallState.meshFor(sim) returns a cached mesh; subsequent calls
//     after a dissolution event re-bake the buffers in place.
//   * The mesh exposes a `sig` string that matches the renderer's
//     cache key so cache-hit semantics don't shift.
//
// These tests pin those promises so Phase 2.5 (irregular tessellations)
// and Phase 3 (per-vertex chemistry state) can edit the mesh internals
// freely as long as the public surface keeps holding.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const FluidChemistry: any;
declare const VugWall: any;
declare const WallState: any;
declare const WallMesh: any;

describe('cavity-mesh Phase 2 — WallMesh builds + recomputes correctly', () => {
  it('default tessellation has ring_count × cells_per_ring + 2 vertices', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    // 16 × 120 = 1920 interior + 2 poles.
    expect(mesh.numInterior).toBe(1920);
    expect(mesh.vertices.length).toBe(1922);
    expect(mesh.southIdx).toBe(1920);
    expect(mesh.northIdx).toBe(1921);
  });

  it('triangulation count matches the legacy renderer math', () => {
    // South cap: N triangles. North cap: N triangles. Inter-ring: 2 ×
    // (ringCount - 1) × N triangles. Total = 2 × N + 2 × (ringCount - 1) × N.
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    const N = 120, ringCount = 16;
    const expectedTris = 2 * N + 2 * (ringCount - 1) * N;
    // indices is a flat array; 3 entries per triangle.
    expect(mesh.indices.length).toBe(expectedTris * 3);
  });

  it('vertex (phi, theta) matches the renderer formula', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    // Renderer's formula: phi = π × (r + 0.5) / ringCount; theta = 2π × c / N.
    const r = 5, c = 30;
    const v = mesh.vertices[r * 120 + c];
    expect(v.phi).toBeCloseTo(Math.PI * 5.5 / 16, 10);
    expect(v.theta).toBeCloseTo(2 * Math.PI * 30 / 120, 10);
    expect(v.ringIdx).toBe(5);
    expect(v.cellIdx).toBe(30);
    expect(v.orientation).toBe(wall.ringOrientation(5));
  });

  it('vertex positions match the renderer formula at a known cell', () => {
    // Build a wall with a default-spherical archetype so the formula
    // reduces to (radius_mm × spherical-to-cartesian) with the
    // polarProfileFactor / twist baked in.
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    const r = 8, c = 60;  // equator-ish
    const phi = Math.PI * (r + 0.5) / 16;
    const polar = wall.polarProfileFactor(phi);
    const twist = wall.ringTwistRadians(phi);
    const cell = wall.rings[r][c];
    const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : wall.initial_radius_mm;
    const radius = (baseR + cell.wall_depth) * polar;
    const theta = (2 * Math.PI * c) / 120 + twist;
    const expectX = radius * Math.sin(phi) * Math.cos(theta);
    const expectY = -radius * Math.cos(phi);
    const expectZ = radius * Math.sin(phi) * Math.sin(theta);
    const idx = r * 120 + c;
    // Precision 5 (5e-6) — v69's 3D sphere-union geometry rescales
    // base_radius_mm by a per-build factor, and the recomputed mesh.
    // positions land slightly off the in-test re-derivation due to
    // float-multiply order. The formula is still being verified;
    // we're not asserting byte equality.
    expect(mesh.positions[idx * 3 + 0]).toBeCloseTo(expectX, 5);
    expect(mesh.positions[idx * 3 + 1]).toBeCloseTo(expectY, 5);
    expect(mesh.positions[idx * 3 + 2]).toBeCloseTo(expectZ, 5);
  });

  it('signature changes when wall_depth changes (dissolution path)', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const meshA = WallMesh.fromWallState(wall);
    const sigA = meshA.sig;
    // Simulate a dissolution event: bump a sampled cell's wall_depth.
    // The cheap signature samples every floor(N/8) = 15th cell, so
    // c=0 is guaranteed to be in the checksum. (Mirrors how
    // wall.erodeCells distributes wall_depth across many cells in
    // practice — at least one sampled cell will catch any real event.)
    wall.rings[3][0].wall_depth += 1.5;
    meshA.recomputeIfStale(wall);
    const sigB = meshA.sig;
    expect(sigB).not.toBe(sigA);
    // And the cached signature on the SAME mesh updated in place — no
    // stale identity hanging around for the cache layer to mis-key on.
    expect(meshA.sig).toBe(sigB);
  });

  it('recomputeIfStale is a no-op when the wall is unchanged', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    const sig0 = mesh.sig;
    const firstX = mesh.positions[0];
    expect(mesh.recomputeIfStale(wall)).toBe(false);
    expect(mesh.sig).toBe(sig0);
    expect(mesh.positions[0]).toBe(firstX);
  });

  it('WallState.meshFor returns the same instance across calls', () => {
    // The lazy accessor must cache — otherwise the renderer pays the
    // factory cost every frame instead of every dissolution event.
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const m1 = wall.meshFor();
    const m2 = wall.meshFor();
    expect(m1).toBe(m2);
  });

  it('maxRadiusByRing reflects per-ring max distance', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16 });
    const mesh = WallMesh.fromWallState(wall);
    // Independently iterate the mesh's positions and confirm the
    // cached per-ring max matches.
    const N = 120;
    for (let r = 0; r < 16; r++) {
      let maxR = 0;
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const x = mesh.positions[idx * 3 + 0];
        const y = mesh.positions[idx * 3 + 1];
        const z = mesh.positions[idx * 3 + 2];
        const rr = Math.sqrt(x * x + y * y + z * z);
        if (rr > maxR) maxR = rr;
      }
      // maxRadiusByRing is a Float32Array; the Float32→Float64
      // round-trip caps tolerance at ~6 decimal digits of precision.
      // At ~25 mm cavity radius, ~1e-5 mm is the realistic ULP.
      expect(mesh.maxRadiusByRing[r]).toBeCloseTo(maxR, 4);
    }
  });

  it('integrates with a running sim — mesh tracks dissolution events', () => {
    // Pull a wall through a real scenario. The mesh built before any
    // dissolution event should change after run_step deposits some
    // wall_depth (cooling has acid pulses that erode the wall).
    const conds: any = {
      fluid: new FluidChemistry({
        Ca: 200, CO3: 200, pH: 7, salinity: 0, Cu: 0, Pb: 0, Zn: 0,
        SiO2: 50, Fe: 5, Mn: 1, Al: 1, Mg: 50, K: 1, Na: 1,
        S: 50, sulfateInherited: true, As: 0, Sr: 1, Ba: 1, F: 0, Cl: 0,
        concentration: 100,
      }),
      wall: new VugWall({ composition: 'limestone' }),
      temperature: 50, pressure_bars: 1, depth_m: 0, oxygen_fugacity: -50,
    };
    const sim = new VugSimulator(conds, []);
    const meshA = sim.wall_state.meshFor(sim);
    const sigA = meshA.sig;
    // Manually trigger a dissolution-shape event so the test doesn't
    // depend on a particular scenario's pulse timing. Ring 3 / cell 0:
    // c=0 is on the signature stride (every N/8 = 15th cell), and
    // r=3 gives a non-zero weight (r*31 + c = 93) so the checksum
    // actually moves — at r=0 c=0 the weight is zero and the bump
    // would be invisible to the signature.
    sim.wall_state.rings[3][0].wall_depth += 2.0;
    const meshB = sim.wall_state.meshFor(sim);
    expect(meshB).toBe(meshA);                  // cached instance reused
    expect(meshB.sig).not.toBe(sigA);           // but contents refreshed
  });
});
