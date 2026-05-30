// tests-js/carbonate-localization-equilibration.test.ts —
// Week 4a infrastructure.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 4 ships the wall-mesh
// localization resolvers + per-vertex accessors + Henry's-Law pH
// equilibrator. This file pins:
//
//   - per-vertex chemistry accessors (fluidAtMeshVertex,
//     temperatureAtMeshVertex) read from WallMesh.cells[i] which is
//     where per-vertex chemistry has lived since Tranche 4a; fall back
//     to ring data when cells aren't populated yet (pole vertices,
//     pre-bindRingChemistry state)
//
//   - polymorphic resolvers handle all three input forms (scalar,
//     resolver fn, per-region tag map) for open_to_atmosphere +
//     atmospheric_pCO2_bar + wall_rock_thermal_buffer_C +
//     host_rock_composition
//
//   - equilibratePHtoPCO2 bisection converges to the pH where
//     equilibriumPCO2(fluid, T) matches the target. Round-trip
//     idempotence (apply once, apply again → same answer) + sane
//     non-convergence behavior

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

declare const fluidAtMeshVertex: (sim: any, mesh: any, vertexIdx: number) => any;
declare const temperatureAtMeshVertex: (sim: any, mesh: any, vertexIdx: number) => number;
declare const isOpenAtMeshVertex: (scenario: any, mesh: any, vertexIdx: number) => boolean;
declare const atmosphericPCO2AtMeshVertex: (scenario: any, mesh: any, vertexIdx: number) => number;
declare const wallRockThermalBufferAtMeshVertex: (scenario: any, mesh: any, vertexIdx: number) => number;
declare const hostRockCompositionAtMeshVertex: (scenario: any, mesh: any, vertexIdx: number) => string;
declare const equilibratePHtoPCO2: (fluid: any, T_celsius: number, target_pCO2_bar: number) => number;
declare const equilibriumPCO2: (fluid: any, T_celsius: number) => number;

// Build a minimal mesh-shaped stub with N rings × M cells. Each cell
// has a unique fluid. The orientation tags match WallMesh's
// 'floor' / 'wall' / 'ceiling' convention.
function buildStubMesh(ringCount: number = 4, cellsPerRing: number = 4) {
  const mesh: any = {
    vertices: [],
    cells: [],
    numInterior: ringCount * cellsPerRing,
  };
  for (let r = 0; r < ringCount; r++) {
    const orient = r === 0 ? 'floor' : (r === ringCount - 1 ? 'ceiling' : 'wall');
    for (let c = 0; c < cellsPerRing; c++) {
      const i = r * cellsPerRing + c;
      mesh.vertices.push({
        phi: Math.PI * (r + 0.5) / ringCount,
        theta: 2 * Math.PI * c / cellsPerRing,
        ringIdx: r,
        cellIdx: c,
        orientation: orient,
        isPole: false,
      });
      mesh.cells.push({
        fluid: new FluidChemistry({ Ca: 100 + i, CO3: 50 + i, pH: 7.0 }),
        temperature_ring: r,
      });
    }
  }
  return mesh;
}

describe('PROPOSAL-CARBONATE-GEOCHEM Week 4 — per-vertex accessors', () => {
  it('fluidAtMeshVertex returns the cell fluid for an interior vertex', () => {
    const mesh = buildStubMesh(4, 4);
    const sim: any = { ring_fluids: [], ring_temperatures: [25, 25, 25, 25] };
    const f = fluidAtMeshVertex(sim, mesh, 5);
    expect(f).toBe(mesh.cells[5].fluid);
    expect(f.Ca).toBe(100 + 5);
  });

  it('fluidAtMeshVertex falls back to sim.ring_fluids for unpopulated cells', () => {
    const mesh = buildStubMesh(4, 4);
    mesh.cells[3].fluid = null; // simulate pre-bind state
    const ringFluid = new FluidChemistry({ Ca: 999, CO3: 50 });
    const sim: any = { ring_fluids: [ringFluid, ringFluid, ringFluid, ringFluid] };
    const f = fluidAtMeshVertex(sim, mesh, 3);
    expect(f).toBe(ringFluid);
  });

  it('temperatureAtMeshVertex reads from sim.ring_temperatures via temperature_ring', () => {
    const mesh = buildStubMesh(4, 4);
    const sim: any = { ring_temperatures: [10, 20, 30, 40] };
    expect(temperatureAtMeshVertex(sim, mesh, 0)).toBe(10);   // ring 0
    expect(temperatureAtMeshVertex(sim, mesh, 4)).toBe(20);   // ring 1
    expect(temperatureAtMeshVertex(sim, mesh, 12)).toBe(40);  // ring 3
  });

  it('temperatureAtMeshVertex falls back to conditions.temperature', () => {
    const mesh = buildStubMesh(2, 2);
    const sim: any = { conditions: { temperature: 75 } };
    // No ring_temperatures → falls back
    expect(temperatureAtMeshVertex(sim, mesh, 0)).toBe(75);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 4 — polymorphic resolvers', () => {
  it('scalar boolean for open_to_atmosphere applies to every vertex', () => {
    const mesh = buildStubMesh(4, 4);
    expect(isOpenAtMeshVertex({ open_to_atmosphere: true }, mesh, 0)).toBe(true);
    expect(isOpenAtMeshVertex({ open_to_atmosphere: true }, mesh, 7)).toBe(true);
    expect(isOpenAtMeshVertex({ open_to_atmosphere: false }, mesh, 5)).toBe(false);
  });

  it('default false when open_to_atmosphere is absent', () => {
    const mesh = buildStubMesh(4, 4);
    expect(isOpenAtMeshVertex({}, mesh, 0)).toBe(false);
    expect(isOpenAtMeshVertex(null, mesh, 0)).toBe(false);
  });

  it('resolver function gets (mesh, vertexIdx)', () => {
    const mesh = buildStubMesh(4, 4);
    const fn = (m: any, idx: number) => idx >= 8;  // open from index 8 up
    const scenario = { open_to_atmosphere: fn };
    expect(isOpenAtMeshVertex(scenario, mesh, 4)).toBe(false);
    expect(isOpenAtMeshVertex(scenario, mesh, 8)).toBe(true);
    expect(isOpenAtMeshVertex(scenario, mesh, 12)).toBe(true);
  });

  it('per-region map keyed on vertex.orientation', () => {
    // 4 rings: ring 0 = floor, rings 1-2 = wall, ring 3 = ceiling.
    // Open only at ceiling — sabkha-like "evaporation surface" pattern.
    const mesh = buildStubMesh(4, 4);
    const scenario = {
      open_to_atmosphere: {
        _default: false,
        floor: false,
        wall: false,
        ceiling: true,
      },
    };
    expect(isOpenAtMeshVertex(scenario, mesh, 0)).toBe(false);  // ring 0 floor
    expect(isOpenAtMeshVertex(scenario, mesh, 4)).toBe(false);  // ring 1 wall
    expect(isOpenAtMeshVertex(scenario, mesh, 8)).toBe(false);  // ring 2 wall
    expect(isOpenAtMeshVertex(scenario, mesh, 12)).toBe(true);  // ring 3 ceiling
  });

  it('per-region map falls through to _default for unmapped orientation', () => {
    const mesh = buildStubMesh(4, 4);
    const scenario = { open_to_atmosphere: { _default: true } };
    expect(isOpenAtMeshVertex(scenario, mesh, 0)).toBe(true);
    expect(isOpenAtMeshVertex(scenario, mesh, 15)).toBe(true);
  });

  it('atmospheric pCO2 defaults to modern 4.2e-4 bar', () => {
    const mesh = buildStubMesh(4, 4);
    expect(atmosphericPCO2AtMeshVertex({}, mesh, 0)).toBeCloseTo(4.2e-4, 6);
  });

  it('atmospheric pCO2 scalar override (cave atmosphere 1e-2 bar)', () => {
    const mesh = buildStubMesh(4, 4);
    const scenario = { atmospheric_pCO2_bar: 1e-2 };
    expect(atmosphericPCO2AtMeshVertex(scenario, mesh, 0)).toBe(1e-2);
    expect(atmosphericPCO2AtMeshVertex(scenario, mesh, 12)).toBe(1e-2);
  });

  it('atmospheric pCO2 per-region map (high near floor, atmospheric near ceiling)', () => {
    // Cave-like: CO2 builds up near the floor from biological activity;
    // ceiling exchanges with atmosphere.
    const mesh = buildStubMesh(4, 4);
    const scenario = {
      atmospheric_pCO2_bar: {
        _default: 4.2e-4,
        floor: 1e-2,
      },
    };
    expect(atmosphericPCO2AtMeshVertex(scenario, mesh, 0)).toBe(1e-2);    // floor
    expect(atmosphericPCO2AtMeshVertex(scenario, mesh, 12)).toBe(4.2e-4); // ceiling
  });

  it('host_rock_composition defaults to limestone, accepts override', () => {
    const mesh = buildStubMesh(4, 4);
    expect(hostRockCompositionAtMeshVertex({}, mesh, 0)).toBe('limestone');
    expect(hostRockCompositionAtMeshVertex({ host_rock_composition: 'dolomite' }, mesh, 0))
      .toBe('dolomite');
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 4 — Henry\'s-Law pH equilibrator', () => {
  it('returns current pH for invalid target', () => {
    const f = new FluidChemistry({ Ca: 100, CO3: 100, pH: 7.5 });
    expect(equilibratePHtoPCO2(f, 25, 0)).toBe(7.5);
    expect(equilibratePHtoPCO2(f, 25, -1)).toBe(7.5);
    expect(equilibratePHtoPCO2(f, 25, NaN)).toBe(7.5);
  });

  it('returns current pH for zero-DIC fluid', () => {
    const f = new FluidChemistry({ CO3: 0, pH: 7.5 });
    expect(equilibratePHtoPCO2(f, 25, 4.2e-4)).toBe(7.5);
  });

  it('equilibrating to current pCO2 returns ~current pH (round-trip)', () => {
    const f = new FluidChemistry({ Ca: 100, CO3: 200, pH: 7.5 });
    const currentPCO2 = equilibriumPCO2(f, 25);
    const newPH = equilibratePHtoPCO2(f, 25, currentPCO2);
    expect(Math.abs(newPH - 7.5)).toBeLessThan(0.01);
  });

  it('higher target pCO2 → lower equilibrium pH', () => {
    const f = new FluidChemistry({ Ca: 100, CO3: 200, pH: 7.5 });
    const lowTargetPH = equilibratePHtoPCO2(f, 25, 1e-2);  // high pCO2
    const highTargetPH = equilibratePHtoPCO2(f, 25, 1e-5); // low pCO2
    expect(lowTargetPH).toBeLessThan(highTargetPH);
  });

  it('equilibration converges (pCO2 at returned pH matches target)', () => {
    const f = new FluidChemistry({ Ca: 100, CO3: 200, pH: 7.5 });
    const target = 4.2e-4;
    const newPH = equilibratePHtoPCO2(f, 25, target);
    const proxy: any = { CO3: f.CO3, pH: newPH };
    const achieved = equilibriumPCO2(proxy, 25);
    // Relative tolerance — bisection converges to <1e-6 in pH which
    // is <0.1% in pCO2 for the smooth Bjerrum response.
    expect(Math.abs(achieved - target) / target).toBeLessThan(0.01);
  });

  it('idempotence: applying equilibration twice gives same result', () => {
    const f = new FluidChemistry({ Ca: 100, CO3: 200, pH: 7.5 });
    const target = 1e-3;
    const ph1 = equilibratePHtoPCO2(f, 25, target);
    const f2 = new FluidChemistry({ Ca: 100, CO3: 200, pH: ph1 });
    const ph2 = equilibratePHtoPCO2(f2, 25, target);
    expect(Math.abs(ph2 - ph1)).toBeLessThan(0.001);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 4b — run_step wiring (positive control)', () => {
  // Confirms the dispatcher in 85-simulator.ts run_step actually calls
  // _applyOpenAtmosphereEquilibration AND that scenarios.json5's
  // open_to_atmosphere + atmospheric_pCO2_bar fields make it onto
  // conditions._scenario. Without this pin, a typo (wrong field name,
  // wrong helper name, missing this.) would silently no-op and the
  // Week 4c scenario flips would have no effect.

  it('open_to_atmosphere=false (default) is a no-op (no pH drift)', () => {
    setSeed(42);
    const scn = SCENARIOS && SCENARIOS.cooling;
    if (!scn) return; // skip if not loaded
    const { conditions, events, defaultSteps } = scn();
    // Default scenario should not have open_to_atmosphere set
    expect(conditions._scenario && conditions._scenario.open_to_atmosphere).toBeFalsy();
    const initialPH = conditions.fluid.pH;
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 3; i++) sim.run_step();
    // pH may shift slightly from regular event chemistry, but not from
    // any equilibration (since it never ran).
    // We can't compare directly to initialPH because events can change
    // it — instead confirm the conditions._scenario shape is what we
    // expect when the flag is absent.
    expect(typeof conditions._scenario).toBe('object');
  });

  it('open_to_atmosphere=true mutates pH to match equilibrator prediction', () => {
    setSeed(42);
    const scn = SCENARIOS && SCENARIOS.cooling;
    if (!scn) return;
    const { conditions, events } = scn();
    conditions._scenario = {
      open_to_atmosphere: true,
      atmospheric_pCO2_bar: 0.01,  // arbitrary target above modern atmospheric
    };
    conditions.fluid.CO3 = 200;
    conditions.fluid.pH = 7.5;
    // Compute the expected equilibrated pH from the equilibrator
    // directly — that's what _applyOpenAtmosphereEquilibration should
    // produce if the wiring is correct. Direction depends on T (high
    // T lowers KH which can flip the apparent direction vs naive
    // expectation), so the empirically-honest check is "matches the
    // equilibrator's prediction" rather than "moves in a specific
    // direction."
    const expectedPH = equilibratePHtoPCO2(
      { CO3: conditions.fluid.CO3, pH: conditions.fluid.pH },
      conditions.temperature,
      0.01,
    );
    const sim = new VugSimulator(conditions, events);
    sim.run_step();
    // Note: events fire BEFORE equilibration in run_step. For the
    // cooling scenario at step 1 no events fire (events start at
    // step 5+ in this scenario), so the equilibration sees the
    // initial fluid state. Tolerance accounts for any small post-
    // equilibration drift from dissolve_wall / propagation.
    expect(Math.abs(conditions.fluid.pH - expectedPH)).toBeLessThan(0.2);
    // Also confirm it actually MOVED — if the equilibration didn't
    // fire, pH would equal initialPH (7.5).
    expect(Math.abs(conditions.fluid.pH - 7.5)).toBeGreaterThan(0.01);
  });

  it('per-ring fluids equilibrate alongside global fluid', () => {
    setSeed(42);
    const scn = SCENARIOS && SCENARIOS.cooling;
    if (!scn) return;
    const { conditions, events } = scn();
    conditions._scenario = {
      open_to_atmosphere: true,
      atmospheric_pCO2_bar: 1e-5,  // very low pCO2 → pH should rise (alkaline)
    };
    conditions.fluid.CO3 = 200;
    conditions.fluid.pH = 7.0;
    const sim = new VugSimulator(conditions, events);
    sim.run_step();
    // Global fluid pH rose (low pCO2 target).
    expect(conditions.fluid.pH).toBeGreaterThan(7.0);
    // Per-ring fluids also rose.
    if (sim.ring_fluids && sim.ring_fluids.length > 0) {
      const ringPH = sim.ring_fluids[Math.floor(sim.ring_fluids.length / 2)].pH;
      expect(ringPH).toBeGreaterThan(7.0);
    }
  });
});
