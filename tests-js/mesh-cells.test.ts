// tests-js/mesh-cells.test.ts — Phase 4 Tranche 1 of PROPOSAL-CAVITY-MESH.
//
// Pins the per-vertex chemistry container that mediates between the
// legacy ring_fluids[] world and the upcoming mesh-resident chemistry.
// Tranche 1 contract:
//   * mesh.cells[i] exists for every interior vertex.
//   * cells[i].fluid IS the SAME OBJECT as ring_fluids[ringIdxOf(i)]
//     (byte-identical aliasing — the chemistry engine reads through
//     either accessor and gets the same storage).
//   * cells[i].temperature_ring caches the ring index for temperature
//     lookups (numbers can't be aliased like objects can).
//   * cellOf(crystal) resolves a crystal's anchor to its cell.
//   * Mutations via cells[i].fluid are visible through ring_fluids[r]
//     and vice versa — same object, two paths.
//
// Tranches 2-5 will (a) un-alias to per-vertex cloned fluids, (b)
// migrate the Laplacian + propagate-global-delta over the mesh,
// (c) move water-level mechanic to mm-height, (d) retire wall.rings.
// Tests here pin Tranche 1 so those follow-ups can edit freely as
// long as the per-vertex contract holds.

import { describe, expect, it } from 'vitest';
import { runScenario } from './helpers';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;

function makeConditions(wallOpts: any = {}) {
  return new VugConditions({
    fluid: new FluidChemistry({
      Ca: 200, CO3: 200, SiO2: 100, Mg: 50, pH: 7,
      salinity: 0, concentration: 1.0,
    }),
    wall: new VugWall(wallOpts),
    temperature: 50,
    pressure_bars: 1,
    depth_m: 0,
    oxygen_fugacity: -50,
  });
}

describe('cavity-mesh Phase 4 Tranche 1 — mesh.cells[] container', () => {
  it('mesh.cells.length matches numInterior (one per interior vertex)', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    expect(mesh).toBeTruthy();
    // ring_count × cells_per_ring = 16 × 120 = 1920 interior vertices.
    expect(mesh.cells.length).toBe(1920);
    expect(mesh.cells.length).toBe(mesh.numInterior);
  });

  it('cells[i].fluid is initialized from ring_fluids[ringIdxOf(i)] (independent clone post-Tranche-4a)', () => {
    // Tranche 1's aliasing invariant gave way to Tranche 4a's
    // un-aliasing: each cell now has its OWN FluidChemistry clone,
    // initialized from the ring representative at bind time. Values
    // match at construction; mutations from then on are independent.
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const N = sim.wall_state.cells_per_ring;
    // Check every cell's initial values match the source ring's fluid.
    for (let i = 0; i < mesh.numInterior; i++) {
      const v = mesh.vertices[i];
      const ringFluid = sim.ring_fluids[v.ringIdx];
      // Same VALUES at bind time...
      expect(mesh.cells[i].fluid.Ca).toBe(ringFluid.Ca);
      expect(mesh.cells[i].fluid.SiO2).toBe(ringFluid.SiO2);
      expect(mesh.cells[i].temperature_ring).toBe(v.ringIdx);
      // ...but different OBJECTS for non-equator rings. The equator
      // ring still has ring_fluids[equator] === conditions.fluid via
      // the legacy alias (Tranche 1 preserved this); cells in that
      // ring are clones, so they don't share identity.
      expect(mesh.cells[i].fluid).not.toBe(ringFluid);
    }
  });

  it('mutating cells[i].fluid does NOT affect ring_fluids[r] (un-aliased per-vertex)', () => {
    // Post-Tranche-4a: cells have independent storage. Mutating one
    // cell's chemistry doesn't ripple into the legacy ring_fluids[r]
    // array or into other cells in the same ring.
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const N = sim.wall_state.cells_per_ring;
    const ring0Initial = sim.ring_fluids[0].Ca;
    mesh.cells[0].fluid.Ca = 999;
    // ring_fluids[0] (the legacy backing store) unchanged — un-aliased.
    expect(sim.ring_fluids[0].Ca).toBe(ring0Initial);
    // Neighbor cells in the same ring also unchanged — per-vertex.
    expect(mesh.cells[1].fluid.Ca).toBe(ring0Initial);
    expect(mesh.cells[N - 1].fluid.Ca).toBe(ring0Initial);
  });

  it('mesh.cellOf(crystal) resolves an anchored crystal to its cell', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    // Build a crystal anchored at a known (ring, cell) pair via the
    // Phase 1 anchor helper. Post-Tranche-4b wall_anchor is the sole
    // positional field.
    const c: any = { wall_anchor: sim.wall_state._anchorFromRingCell(3, 7) };
    const cell = mesh.cellOf(c, sim.wall_state);
    expect(cell).toBeTruthy();
    // Post-Tranche-4a: cells own independent FluidChemistry clones, so
    // identity differs from ring_fluids[r] — values match at init.
    expect(cell.fluid.Ca).toBe(sim.ring_fluids[3].Ca);
    expect(cell.fluid.SiO2).toBe(sim.ring_fluids[3].SiO2);
    expect(cell.temperature_ring).toBe(3);
  });

  it('cellOf returns null for an unanchored crystal', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    expect(mesh.cellOf(null, sim.wall_state)).toBeNull();
    expect(mesh.cellOf({}, sim.wall_state)).toBeNull();
    expect(sim.wall_state.chemistryAddressForCrystal({})).toBeNull();
    expect(sim.wall_state.chemistryVertexForCrystal({})).toBe(-1);
  });

  it('per-crystal growth swap reads cell.fluid (end-to-end integration)', () => {
    // Run a real scenario; the per-crystal fluid swap in
    // _runEngineForCrystal now sources from mesh.cellOf(crystal).fluid.
    // Because Tranche 1 aliases cells[i].fluid === ring_fluids[r], the
    // calibration baseline reproduces byte-identical. This test just
    // confirms the scenario produces SOME crystals (the rest of the
    // suite catches drift).
    const sim = runScenario('cooling', { seed: 42, steps: 30 });
    expect(sim).toBeTruthy();
    expect(sim.crystals.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Tranche 2 — Per-vertex Laplacian + propagate-global-delta
// ============================================================

describe('cavity-mesh Phase 4 Tranche 2 — mesh-edge Laplacian', () => {
  it('adjacency builds 4 neighbors for interior vertices, 3 for pole-ring vertices', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const ringCount = 16, N = 120;
    const adj = mesh._buildAdjacency(ringCount, N);
    expect(adj.length).toBe(mesh.numInterior);
    // Interior ring (say ring 5, cell 30): 2 same-ring + 2 adjacent-ring.
    expect(adj[5 * N + 30].length).toBe(4);
    // Top ring (ring 0, cell 0): the up-clamp deduplicates, so 3 neighbors.
    expect(adj[0 * N + 0].length).toBe(3);
    // Bottom ring (ring 15, cell 0): the down-clamp deduplicates, so 3 neighbors.
    expect(adj[15 * N + 0].length).toBe(3);
  });

  it('adjacency wraps theta correctly (same-ring left/right neighbors)', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const ringCount = 16, N = 120;
    const adj = mesh._buildAdjacency(ringCount, N);
    // Ring 5, cell 0: same-ring neighbors are cell N-1 (left wraps) and cell 1.
    const r5c0Neighbors = new Set(adj[5 * N + 0]);
    expect(r5c0Neighbors.has(5 * N + (N - 1))).toBe(true);  // wrap-left
    expect(r5c0Neighbors.has(5 * N + 1)).toBe(true);         // right
    // Ring 5, cell N-1: same-ring neighbors are N-2 and cell 0 (right wraps).
    const r5cLastNeighbors = new Set(adj[5 * N + (N - 1)]);
    expect(r5cLastNeighbors.has(5 * N + (N - 2))).toBe(true);
    expect(r5cLastNeighbors.has(5 * N + 0)).toBe(true);     // wrap-right
  });

  it('mesh.diffuse on uniform chemistry is a no-op (Laplacian of constant = 0)', () => {
    // Default scenario: every cell starts with identical chemistry
    // (clones of one initial fluid). Laplacian of a constant = 0, so
    // no field should change after diffuse fires. This invariant
    // holds across aliased (Tranche 1-3) AND un-aliased (Tranche 4a+)
    // models — the math doesn't care.
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const ca_before = mesh.cells.map((c: any) => c.fluid.Ca);
    mesh.diffuse(0.05, ['Ca'], sim.ring_temperatures);
    const ca_after = mesh.cells.map((c: any) => c.fluid.Ca);
    expect(ca_after).toEqual(ca_before);
  });

  it('mesh.diffuse with zoned chemistry diffuses per-vertex over the cavity surface', () => {
    // Tranche 4a behavior: inject a per-ring gradient at cells-level
    // and confirm the Laplacian relaxes each vertex toward its mesh
    // neighbors. Floor cells (high Ca) shed toward equator cells,
    // ceiling cells (low Ca) gain from equator cells.
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const n = sim.wall_state.ring_count;
    const N = sim.wall_state.cells_per_ring;
    // Set every cell in ring 0 to Ca=500, every cell in ring 15 to
    // Ca=100, everything else interpolates.
    for (let r = 0; r < n; r++) {
      const Ca = 500 - (400 * r) / (n - 1);
      for (let c = 0; c < N; c++) mesh.cells[r * N + c].fluid.Ca = Ca;
    }
    const before = [];
    for (let r = 0; r < n; r++) before.push(mesh.cells[r * N].fluid.Ca);
    mesh.diffuse(0.05, ['Ca'], sim.ring_temperatures);
    // After one Laplacian step, ring 0 (boundary, only ring 1 contributes
    // via the "up-clamp" neighbor → self) should drift toward ring 1.
    // Same for the interior. Don't pin specific values — confirm the
    // gradient narrowed.
    const after = [];
    for (let r = 0; r < n; r++) after.push(mesh.cells[r * N].fluid.Ca);
    const gradBefore = before[0] - before[n - 1];
    const gradAfter = after[0] - after[n - 1];
    expect(gradAfter).toBeLessThan(gradBefore);
  });

  it('mesh.propagateDelta applies the delta to every cell (per-vertex)', () => {
    // Tranche 4a: cells are un-aliased, so propagateDelta no longer
    // dedups by fluid identity — every cell receives the delta from
    // its own independent storage. The equator cells get it too
    // (the legacy "skip equator" came from aliased cells sharing
    // conditions.fluid; now they're clones).
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const n = sim.wall_state.ring_count;
    const N = sim.wall_state.cells_per_ring;
    const equator = Math.floor(n / 2);
    // Snapshot pre-event cell values across all rings.
    const cellsBefore = [];
    for (let i = 0; i < mesh.numInterior; i++) cellsBefore.push(mesh.cells[i].fluid.Ca);
    // Mutate conditions.fluid (the legacy alias to ring_fluids[equator]
    // still works, but cells have their own storage).
    const preSnap = new FluidChemistry({ ...sim.conditions.fluid });
    sim.conditions.fluid.Ca += 100;
    mesh.propagateDelta(preSnap, ['Ca'], sim.ring_fluids[equator]);
    // Every cell — including equator cells — should have gained 100.
    for (let i = 0; i < mesh.numInterior; i++) {
      expect(mesh.cells[i].fluid.Ca).toBe(cellsBefore[i] + 100);
    }
  });

  it('fluid_surface_height_mm and fluid_surface_ring alias the same storage', () => {
    // Tranche 3 — water-level mechanic migrates to mm-height as
    // canonical; legacy name keeps reading/writing the same slot
    // (numerically identical while ring_spacing_mm = 1.0). Tests pin
    // that both accessors stay in lockstep.
    const c = new VugConditions({
      fluid: new FluidChemistry(), wall: new VugWall(),
    });
    // Default: null on both.
    expect(c.fluid_surface_height_mm).toBeNull();
    expect(c.fluid_surface_ring).toBeNull();
    // Write via legacy name, read via canonical name.
    c.fluid_surface_ring = 4.5;
    expect(c.fluid_surface_height_mm).toBe(4.5);
    // Write via canonical, read via legacy.
    c.fluid_surface_height_mm = 12;
    expect(c.fluid_surface_ring).toBe(12);
    // Sentinel "above ceiling" survives the round trip.
    c.fluid_surface_ring = 1e6;
    expect(c.fluid_surface_height_mm).toBe(1e6);
  });

  it('fluid_surface_height_mm constructor opt overrides legacy name', () => {
    // If both names are provided at construction, the canonical one
    // wins. (This case won't happen in shipping scenarios — they only
    // pass fluid_surface_ring — but it's the right migration semantic
    // for scenarios written after Tranche 3 lands.)
    const c = new VugConditions({
      fluid: new FluidChemistry(), wall: new VugWall(),
      fluid_surface_ring: 4,
      fluid_surface_height_mm: 7,
    });
    expect(c.fluid_surface_height_mm).toBe(7);
    expect(c.fluid_surface_ring).toBe(7);
  });

  it('legacy event handlers still see fluid_surface_ring as the live value', () => {
    // Naica / Searles / sabkha event handlers write
    // conditions.fluid_surface_ring directly. After Tranche 3 the
    // write goes through the setter and lands in _fluidSurfaceMm.
    // Internal classifiers read whichever — must stay coherent.
    const c = new VugConditions({
      fluid: new FluidChemistry(), wall: new VugWall(),
    });
    c.fluid_surface_ring = 0;  // "drain to floor" event
    expect(c.fluid_surface_height_mm).toBe(0);
    // ringWaterState in a 16-ring cavity at surface=0: every ring is
    // vadose (above the floor surface).
    for (let r = 0; r < 16; r++) {
      expect(c.ringWaterState(r, 16)).toBe('vadose');
    }
  });

  it('_diffuseRingState delegates to mesh.diffuse (per-vertex Laplacian)', () => {
    // Post-Tranche-4a: _diffuseRingState routes to mesh.diffuse which
    // operates per-vertex. ring_fluids[] is no longer the mutation
    // target — cells are. Test that running diffusion on an injected
    // gradient narrows the gradient as expected.
    const sim = new VugSimulator(makeConditions(), []);
    const mesh = sim.wall_state.meshFor(sim);
    const n = sim.wall_state.ring_count;
    const N = sim.wall_state.cells_per_ring;
    for (let r = 0; r < n; r++) {
      const Ca = 100 + 20 * r;
      for (let c = 0; c < N; c++) mesh.cells[r * N + c].fluid.Ca = Ca;
    }
    const gradBefore = mesh.cells[(n - 1) * N].fluid.Ca - mesh.cells[0].fluid.Ca;
    sim._diffuseRingState();
    const gradAfter = mesh.cells[(n - 1) * N].fluid.Ca - mesh.cells[0].fluid.Ca;
    expect(Math.abs(gradAfter)).toBeLessThan(Math.abs(gradBefore));
  });
});
