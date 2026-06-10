// tests-js/ring-fluid-view.test.ts — REVIEW-THREE-METRICS §1.4
// resolution (2026-06-10): ring_fluids RETIRED as a forward chemistry
// store. The replay snapshot no longer clones the (frozen) non-equator
// slots — _repaintWallState captures a PROJECTION of the canonical
// per-cell chemistry computed by _ringFluidMeans at snapshot time.
// The LIVE ring_fluids array is deliberately untouched.
//
// Why: the per-ring leg of _propagateGlobalDelta was lost in the v159
// voxel re-pointing, so the slots froze at the initial broth for the
// whole run while their one live consumer — the replay snapshot the
// helicoid replay chips read — faithfully displayed the frozen values
// (the replay-mode sibling of the v157 live-chip pyramid artifact).
// Probe of the broken state: tools/ring-fluid-view-probe.mjs on
// reactivated_fluorite_vein seed 42 showed every non-equator ring
// 100% divergent on Zn (145.7 ppm of event chemistry never arrived).
//
// Why the projection is computed at SNAPSHOT time and not synced into
// the live array every step (the first cut did that): the live store
// is what the mesh-absent fallback readers and the tuned calibration
// see — keeping it frozen keeps the sim path byte-identical by
// construction. And the every-step sync measured 1.32 ms/call (~12% of
// a step), enough to push the 32-seed integration tests over their
// timeouts under parallel suite load; at snapshot stride it is ~80 ms
// per run.
//
// What these tests pin:
//   * the projection: _ringFluidMeans()[r][k] equals the ring's cell
//     mean for non-equator rings; the equator entry is the bulk view
//   * `concentration` is NOT projected (vadose-mirror-owned, same
//     exclusion as diffusion's _fluidFieldNames)
//   * the LIVE store stays FROZEN across steps (the SIM-neutrality
//     contract) and the equator alias survives
//   * the replay snapshot carries evolved non-equator chemistry — the
//     artifact this work retires

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;

function makeConditions(wallOpts: any = {}) {
  return new VugConditions({
    fluid: new FluidChemistry({
      Ca: 100, CO3: 100, SiO2: 100, Mg: 50, Fe: 5, pH: 7,
      salinity: 0, concentration: 1.0,
    }),
    wall: new VugWall(wallOpts),
    temperature: 50,
    pressure_bars: 1,
    depth_m: 0,
    oxygen_fugacity: -50,
  });
}

function ringCellMean(sim: any, r: number, field: string): number {
  const mesh = sim.wall_state.meshFor(sim);
  const perRing = sim.wall_state.cells_per_ring;
  let sum = 0, n = 0;
  for (let c = 0; c < perRing; c++) {
    const f = mesh.cells[r * perRing + c] && mesh.cells[r * perRing + c].fluid;
    if (f && typeof f[field] === 'number' && isFinite(f[field])) { sum += f[field]; n++; }
  }
  return n ? sum / n : NaN;
}

describe('ring_fluids retired — snapshot projection of cell chemistry (review §1.4)', () => {
  it('_ringFluidMeans equals the per-ring cell mean on non-equator rings', () => {
    const sim = new VugSimulator(makeConditions(), []);
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    const perRing = sim.wall_state.cells_per_ring;
    // Hand-set a recognizable gradient on ring 2 so the mean is
    // non-trivial: Ca = 200 + c.
    for (let c = 0; c < perRing; c++) {
      const f = mesh.cells[2 * perRing + c].fluid;
      if (f) f.Ca = 200 + c;
    }
    const proj = sim._ringFluidMeans();
    const n = sim.wall_state.ring_count;
    const equator = Math.floor(n / 2);
    expect(proj.length).toBe(sim.ring_fluids.length);
    expect(proj[2].Ca).toBeCloseTo(ringCellMean(sim, 2, 'Ca'), 9);
    expect(proj[2].Ca).toBeCloseTo(200 + (perRing - 1) / 2, 9);
    for (const r of [0, 5, n - 1]) {
      if (r === equator) continue;
      for (const k of ['CO3', 'SiO2', 'pH']) {
        expect(proj[r][k]).toBeCloseTo(ringCellMean(sim, r, k), 9);
      }
    }
  });

  it('the equator entry of the projection is the bulk view, never a ring mean', () => {
    const sim = new VugSimulator(makeConditions(), []);
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    const perRing = sim.wall_state.cells_per_ring;
    const equator = Math.floor(sim.wall_state.ring_count / 2);
    // Skew the equator ring's cells hard away from the bulk fluid.
    for (let c = 0; c < perRing; c++) {
      const f = mesh.cells[equator * perRing + c].fluid;
      if (f) f.Ca = 9999;
    }
    const proj = sim._ringFluidMeans();
    // The projection ignores the cells at the equator slot — it carries
    // conditions.fluid (what the old alias-clone capture put there).
    expect(proj[equator].Ca).toBeCloseTo(sim.conditions.fluid.Ca, 9);
    expect(proj[equator].Ca).not.toBeCloseTo(9999, 1);
    // And it is a CLONE, not the live object.
    expect(proj[equator]).not.toBe(sim.conditions.fluid);
  });

  it('concentration is NOT projected — the stored (vadose-owned) value carries through', () => {
    const sim = new VugSimulator(makeConditions(), []);
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    const perRing = sim.wall_state.cells_per_ring;
    for (let c = 0; c < perRing; c++) {
      const f = mesh.cells[2 * perRing + c].fluid;
      if (f) f.concentration = 9.5;
    }
    const proj = sim._ringFluidMeans();
    // The stored slot still holds the init 1.0 — the projection keeps it.
    expect(proj[2].concentration).toBeCloseTo(1.0, 9);
  });

  it('the LIVE ring_fluids store stays frozen across steps (SIM-neutrality contract)', () => {
    const sim = new VugSimulator(makeConditions(), []);
    const equator = Math.floor(sim.wall_state.ring_count / 2);
    const before = sim.ring_fluids[2].Ca;
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    const perRing = sim.wall_state.cells_per_ring;
    for (let c = 0; c < perRing; c++) {
      const f = mesh.cells[2 * perRing + c].fluid;
      if (f) f.Ca = 777;
    }
    sim.run_step();
    sim.run_step();
    // Cell mutations + steps never reach the live store — what the
    // mesh-absent fallbacks (and the tuned calibration) see is exactly
    // the legacy frozen value.
    expect(sim.ring_fluids[2].Ca).toBe(before);
    // And the load-bearing equator alias survives.
    expect(sim.ring_fluids[equator]).toBe(sim.conditions.fluid);
  });

  it('the replay snapshot carries the evolved projection (the artifact this retires)', () => {
    const sim = new VugSimulator(makeConditions(), []);
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    const perRing = sim.wall_state.cells_per_ring;
    for (let c = 0; c < perRing; c++) {
      const f = mesh.cells[2 * perRing + c].fluid;
      if (f) f.Ca = 555;
    }
    // Early steps snapshot at stride 1, so the next step captures it.
    sim.run_step();
    const snaps = sim.wall_state_history;
    expect(snaps.length).toBeGreaterThan(0);
    const last = snaps[snaps.length - 1];
    expect(last.ring_fluids).toBeTruthy();
    // Replay chips now see event/growth chemistry at ring 2 instead of
    // the frozen initial 100 — diffusion may have pulled it off 555,
    // so assert it LEFT the broth, not a pinned constant.
    expect(Math.abs(last.ring_fluids[2].Ca - 100)).toBeGreaterThan(100);
    // While the LIVE store still holds the frozen value (prior test's
    // contract, re-checked here at the consumer boundary).
    expect(sim.ring_fluids[2].Ca).toBeCloseTo(100, 6);
  });
});
