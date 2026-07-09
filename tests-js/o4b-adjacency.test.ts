// tests-js/o4b-adjacency.test.ts — W-F O4b (SIM 221): geometric enclosure
// adjacency + coats_front.
//
// The string gate this bump replaced was vacuous for free-wall pairs (every
// free-wall crystal holds the literal 'vug wall', so any two "matched" across
// the cavity — 276 of 342 seed-42 enclosures were never-reached phantoms,
// census: tools/o4b-adjacency-census.mjs) and blocked same-host siblings whose
// position strings differ only by narrative qualifiers. Each census class gets
// a pin here: phantom (far pair must NOT enclose), missed (co-anchored
// siblings MUST), substring (#G must not claim a guest on host #G<digit>),
// deferred (a host too small to reach re-qualifies once its footprint grows
// out), and the coats_front split with its liberation clear.
//
// Setup style: real sim + real wall, crystals hand-placed by overwriting
// anchor/size/zones after nucleate(). Distances and the growths needed to
// reach (or not reach) them are computed from the wall's OWN metric
// (cell_arc_mm, anchorDistanceMm) and each crystal's OWN wall_spread, so the
// pins survive tessellation, cavity-size, or habit-variant changes in the
// scenario data.

import { beforeEach, describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function freshSim() {
  setSeed(42);
  const scen = (SCENARIOS['mvt'] ?? SCENARIOS[Object.keys(SCENARIOS)[0]])();
  return new VugSimulator(scen.conditions, scen.events);
}

// Hand-place a crystal at an exact (ring, cell) with an exact size, active and
// pre-aged with 3 thin zones (the `slowing` gate reads true — guests are
// swallowable; hosts are distinguished by size, not zone thickness).
function place(sim: any, c: any, ringIdx: number, cellIdx: number, growthUm: number) {
  c.wall_anchor = sim.wall_state._anchorFromRingCell(ringIdx, cellIdx);
  c.total_growth_um = growthUm;
  c.c_length_mm = growthUm / 1000;
  c.zones = [
    { step: 1, thickness_um: 0.5 },
    { step: 2, thickness_um: 0.5 },
    { step: 3, thickness_um: 0.5 },
  ];
  c.active = true;
  c.dissolved = false;
  c._buried = false;
  return c;
}

// Growth (µm) whose painted half-arc equals halfArcMm for THIS crystal's
// wall_spread — inverse of WallState.footprintArcMm.
function growthForHalfArc(c: any, halfArcMm: number) {
  return (halfArcMm * 2 * 1000) / (4.0 * Math.max(c.wall_spread ?? 0.5, 0.05));
}

function equatorRing(sim: any): number {
  return Math.floor(sim.wall_state.ring_count / 2);
}

function distanceBetween(sim: any, a: any, b: any) {
  return sim.wall_state.anchorDistanceMm(
    sim.wall_state._resolveAnchor(a), sim.wall_state._resolveAnchor(b));
}

// Make a crystal ineligible on BOTH sides of the mechanic: zones=[] blocks
// candidacy (needs ≥3), c_length<0.5 blocks growerhood.
function park(c: any) {
  c.zones = [];
  c.c_length_mm = 0;
  c.active = false;
}

describe('W-F O4b — geometric enclosure adjacency', () => {
  let sim: any;
  beforeEach(() => { sim = freshSim(); });

  it('encloses a slowing neighbor within footprint reach (confirmed class)', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 11, 100);   // one cell away
    // Even a floor-reach host (±1 cell each + 1 slack) covers a 1-cell gap.
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(host.crystal_id);
    expect(host.enclosed_crystals).toContain(guest.crystal_id);
    expect(guest.active).toBe(false);
  });

  it('does NOT enclose across the cavity even though both positions read "vug wall" (phantom pin)', () => {
    const ring = equatorRing(sim);
    const N = sim.wall_state.cells_per_ring;
    const host = place(sim, sim.nucleate('calcite'), ring, 0, 1);
    const guest = place(sim, sim.nucleate('pyrite'), ring, Math.floor(N / 2), 100);
    expect(host.position).toBe(guest.position);   // the old gate's vacuous branch
    // Size the host from the wall's own metric: big enough to be a grower
    // with sizeRatio > 3, reach capped at a quarter of the actual distance.
    const cellArc = sim.wall_state.cell_arc_mm;
    const dist = distanceBetween(sim, host, guest);
    const g = Math.max(600, growthForHalfArc(host, dist / 4));
    host.total_growth_um = g;
    host.c_length_mm = g / 1000;
    const reach = Math.max(sim.wall_state.footprintArcMm(host) / 2, cellArc)
      + Math.max(sim.wall_state.footprintArcMm(guest) / 2, cellArc) + cellArc;
    expect(dist).toBeGreaterThan(reach);          // sanity: genuinely out of reach
    expect(g / 1000 / Math.max(guest.total_growth_um / 1000, 0.001)).toBeGreaterThan(3);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();
    expect(guest.active).toBe(true);
  });

  it('encloses a same-host sibling whose position string differs by qualifier (missed pin)', () => {
    const ring = equatorRing(sim);
    const perch = place(sim, sim.nucleate('quartz'), ring, 20, 400);   // c_length 0.4 → never a grower
    const host = place(sim, sim.nucleate('calcite', `on quartz #${perch.crystal_id} (late)`),
      ring, 20, 9000);
    const guest = place(sim, sim.nucleate('pyrite', `on weathering quartz #${perch.crystal_id}`),
      ring, 20, 100);
    // Different strings, shared ground — the old gate blocked exactly this.
    expect(host.position).not.toBe(guest.position);
    expect(guest.position.includes(`#${host.crystal_id}`)).toBe(false);
    // Keep the perch un-swallowable so only the host/guest verdict is under test.
    perch.zones = Array.from({ length: 3 }, (_, i) => ({ step: i + 1, thickness_um: 5 }));
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(host.crystal_id);
    expect(guest.coats_front).toBe(false);   // sibling ON the perch, not on the host's front
  });

  it('grower #G cannot claim a guest on host #G<digit> by substring (exact-ID pin)', () => {
    const ring = equatorRing(sim);
    const N = sim.wall_state.cells_per_ring;
    const grower = place(sim, sim.nucleate('calcite'), ring, 0, 600);
    const G = grower.crystal_id;
    // Advance the id counter until a nucleation lands on an id whose decimal
    // string extends G's (e.g. G=1 → 12): the old includes(`#${G}`) trap.
    let perch: any = null;
    for (let guard = 0; guard < 300 && !perch; guard++) {
      const q = sim.nucleate('quartz');
      const sid = String(q.crystal_id);
      if (sid.length > String(G).length && sid.startsWith(String(G))) perch = q;
      else park(q);
    }
    expect(perch, 'no prefix-colliding id within 300 nucleations').toBeTruthy();
    place(sim, perch, ring, Math.floor(N / 2), 400);   // far side; never a grower
    perch.zones = Array.from({ length: 3 }, (_, i) => ({ step: i + 1, thickness_um: 5 }));
    const guest = place(sim, sim.nucleate('pyrite', `on quartz #${perch.crystal_id}`),
      ring, Math.floor(N / 2), 100);
    expect(guest.position.includes(`#${G}`)).toBe(true);   // the substring trap is armed
    expect(distanceBetween(sim, grower, guest)).toBeGreaterThan(
      sim.wall_state.footprintArcMm(grower) / 2 + 3 * sim.wall_state.cell_arc_mm);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();   // neither by substring nor by geometry
  });

  it('a host too small to reach re-qualifies once its footprint grows out (deferred pin)', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 600);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 22, 100);   // 12 cells away
    const dist = distanceBetween(sim, host, guest);
    const cellArc = sim.wall_state.cell_arc_mm;
    // Phase 1: reach floored at 3 cells — sanity that the gap is wider.
    expect(dist).toBeGreaterThan(3 * cellArc + sim.wall_state.footprintArcMm(host) / 2);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();               // out of reach today
    // Phase 2: the footprint arrives (20% past the gap, from the host's own spread).
    const g = growthForHalfArc(host, dist * 1.2);
    host.total_growth_um = g;
    host.c_length_mm = g / 1000;
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(host.crystal_id);    // the deferred swallow
  });
});

describe('W-F O4b — coats_front classification', () => {
  let sim: any;
  beforeEach(() => { sim = freshSim(); });

  it('guest nucleated ON its swallower → front-coating; lateral neighbor → embedded', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 9000);
    const onFront = place(sim, sim.nucleate('chalcopyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    const lateral = place(sim, sim.nucleate('pyrite'), ring, 11, 100);
    sim._check_enclosure();
    expect(onFront.enclosed_by).toBe(host.crystal_id);
    expect(onFront.coats_front).toBe(true);
    expect(lateral.enclosed_by).toBe(host.crystal_id);
    expect(lateral.coats_front).toBe(false);
  });

  it('liberation clears coats_front with the enclosure', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 9000);
    const guest = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    sim.step = 5;   // enclosure records step 5 > the host's zone steps (1..3),
                    // so liberation's size-at-enclosure integral sees them all
    sim._check_enclosure();
    expect(guest.coats_front).toBe(true);
    // Dissolve the host back past the enclosure point (liberation gate:
    // total_growth < size-at-enclosure × 0.7).
    host.dissolved = true;
    host.total_growth_um = 0.5;
    sim._check_liberation();
    expect(guest.enclosed_by).toBeNull();
    expect(guest.coats_front).toBeNull();
    expect(guest.active).toBe(true);
  });
});
