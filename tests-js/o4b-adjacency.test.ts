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
// out), dormant (an old large crystal cannot swallow without adding a current
// layer), and the coats_front split with its liberation clear.
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
declare const GrowthZone: any;
declare const applyFilmDusting: any;

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
  // Keep the accepted-zone inventory mechanically identical to the size while
  // retaining three thin terminal layers for the slowing test.
  c.zones = growthUm > 1.5
    ? [
        { step: 0, thickness_um: growthUm - 1.5 },
        { step: 1, thickness_um: 0.5 },
        { step: 2, thickness_um: 0.5 },
        { step: 3, thickness_um: 0.5 },
      ]
    : [
        { step: 1, thickness_um: growthUm / 3 },
        { step: 2, thickness_um: growthUm / 3 },
        { step: 3, thickness_um: growthUm / 3 },
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

// Enclosure represents a moving host growth front.  Direct unit fixtures must
// therefore book the same physical fact that the production growth loop does:
// one accepted, non-phantom positive host layer at the current step.
function growHostNow(sim: any, host: any, thicknessUm = 1) {
  sim.step = Math.max(4, Number(sim.step) || 0);
  const zone = new GrowthZone({
    step: sim.step,
    temperature: sim.conditions.temperature,
    thickness_um: thicknessUm,
    growth_rate: thicknessUm,
  });
  zone._time_scaled = true;
  host.add_zone(zone);
  return zone;
}

function growHostNextStep(sim: any, host: any, thicknessUm = 1) {
  sim.step = Math.max(4, Number(sim.step) || 0) + 1;
  return growHostNow(sim, host, thicknessUm);
}

function addHostZone(sim: any, host: any, thicknessUm: number, positivePhantom = false) {
  const zone = new GrowthZone({
    step: sim.step,
    temperature: sim.conditions.temperature,
    thickness_um: thicknessUm,
    growth_rate: thicknessUm,
  });
  zone._time_scaled = true;
  if (positivePhantom) zone.is_phantom = true;
  host.add_zone(zone);
  return zone;
}

describe('W-F O4b — geometric enclosure adjacency', () => {
  let sim: any;
  beforeEach(() => { sim = freshSim(); });

  it('encloses a slowing neighbor within footprint reach (confirmed class)', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 11, 100);   // one cell away
    // Even a floor-reach host (±1 cell each + 1 slack) covers a 1-cell gap.
    growHostNow(sim, host);
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
    growHostNow(sim, host);
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
    growHostNow(sim, host);
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
    growHostNow(sim, grower);
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
    growHostNow(sim, host);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();               // out of reach today
    // Phase 2: the footprint arrives (20% past the gap, from the host's own spread).
    const targetGrowth = growthForHalfArc(host, dist * 1.2);
    growHostNextStep(sim, host, Math.max(1, targetGrowth - host.total_growth_um));
    expect(host.total_growth_um).toBeGreaterThanOrEqual(targetGrowth);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(host.crystal_id);    // the deferred swallow
    expect(guest.enclosure_receipt.host_same_step_net_growth_um).toBeGreaterThan(0);
  });

  it('does not let a large dormant host swallow a newly slowing neighbor', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('chalcopyrite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('native_copper'), ring, 11, 100);
    sim.step = 4;

    // The host is large, active, adjacent, and has old layers, but no accepted
    // layer at step 4.  Size alone is not evidence that it grew around the
    // guest.
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();
    expect(host.enclosed_crystals).not.toContain(guest.crystal_id);

    // Once the host actually advances, the same geometry can honestly enclose.
    growHostNow(sim, host);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(host.crystal_id);
  });

  it('does not enclose a fully dissolved, zero-solid guest', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 11, 100);
    guest.total_growth_um = 0;
    guest.c_length_mm = 0;
    guest.dissolved = true;
    growHostNow(sim, host);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBeNull();
    expect(sim._enclosureReceipts).toEqual([]);
  });

  it('rejects phantom-only and fully consumed non-phantom guest inventories', () => {
    const ring = equatorRing(sim);
    sim.step = 4;
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const phantom = place(sim, sim.nucleate('pyrite'), ring, 11, 100);
    phantom.zones = [1, 2, 3].map((step) => ({
      step, thickness_um: 40, is_phantom: true,
    }));
    phantom.total_growth_um = 120;
    phantom.c_length_mm = 0.12;
    phantom.dissolved = false;
    const consumed = place(sim, sim.nucleate('marcasite'), ring, 12, 100);
    consumed.zones = [
      { step: 1, thickness_um: 2 },
      { step: 2, thickness_um: -1 },
      { step: 3, thickness_um: -1 },
    ];
    consumed.total_growth_um = 1; // forged public aggregate must not authorize solid
    consumed.c_length_mm = 0.001;
    consumed.dissolved = false;
    growHostNow(sim, host);
    sim._check_enclosure();
    expect(phantom.enclosed_by).toBeNull();
    expect(consumed.enclosed_by).toBeNull();
    expect(sim._enclosureReceipts).toEqual([]);
  });

  it('waives 0.5 mm only for exact substrate contact and admits a shadowed physical guest', () => {
    const run = (exact: boolean) => {
      const local = freshSim();
      const ring = equatorRing(local);
      const guest = place(local, local.nucleate('pyrite'), ring, 10, 100);
      guest._buried = true;
      const position = exact ? `on pyrite #${guest.crystal_id}` : 'vug wall';
      const host = place(local, local.nucleate('calcite', position), ring, 10, 399);
      growHostNow(local, host, 1); // 0.400 mm host, 4x the guest
      local._check_enclosure();
      return { host, guest };
    };
    const exact = run(true);
    expect(exact.host.c_length_mm).toBeCloseTo(0.4, 12);
    expect(exact.guest.enclosed_by).toBe(exact.host.crystal_id);
    expect(exact.guest.enclosure_receipt).toMatchObject({
      route: 'host-on-guest', adjacency_authority: 'exact-substrate-id',
    });
    const lateral = run(false);
    expect(lateral.host.c_length_mm).toBeCloseTo(0.4, 12);
    expect(lateral.guest.enclosed_by).toBeNull();
  });

  it('does not let positive phantom thickness manufacture a lateral floor or footprint', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 399);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 11, 100);
    // Public/rendered aggregates are deliberately inflated above the legacy
    // 0.5-mm gate and enlarge the legacy footprint. The accepted physical
    // inventory remains 0.399 mm until the real 1-um current layer arrives.
    host.zones.push({ step: 3, thickness_um: 5000, is_phantom: true });
    host.total_growth_um += 5000;
    host.c_length_mm = host.total_growth_um / 1000;
    expect(host.c_length_mm).toBeGreaterThan(0.5);
    expect(sim.wall_state.footprintArcMm(host)).toBeGreaterThan(
      sim.wall_state.footprintArcMm(host, 399),
    );
    growHostNow(sim, host, 1);
    sim._check_enclosure();
    expect(host.c_length_mm).toBeGreaterThan(5);
    expect(guest.enclosed_by).toBeNull();
    expect(sim._enclosureReceipts).toEqual([]);
  });

  it('rejects positive phantom, net-zero, and net-negative same-step host testimony', () => {
    const ring = equatorRing(sim);
    const cases = [
      { cell: 10, positive: 1, negative: 0, phantom: true },
      { cell: 30, positive: 1, negative: -1, phantom: false },
      { cell: 50, positive: 1, negative: -2, phantom: false },
    ];
    sim.step = 4;
    for (const row of cases) {
      const host = place(sim, sim.nucleate('calcite'), ring, row.cell, 8000);
      const guest = place(sim, sim.nucleate('pyrite'), ring, row.cell + 1, 100);
      addHostZone(sim, host, row.positive, row.phantom);
      if (row.negative) addHostZone(sim, host, row.negative);
      sim._check_enclosure();
      expect(guest.enclosed_by).toBeNull();
    }
    expect(sim._enclosureReceipts).toEqual([]);
  });

  it('prefers the guest\'s advancing substrate host over an older lateral host', () => {
    const ring = equatorRing(sim);
    const lateral = place(sim, sim.nucleate('calcite'), ring, 10, 9000);
    const substrate = place(sim, sim.nucleate('quartz'), ring, 11, 8000);
    const guest = place(
      sim,
      sim.nucleate('pyrite', `on quartz #${substrate.crystal_id}`),
      ring,
      11,
      100,
    );
    growHostNow(sim, lateral);
    addHostZone(sim, substrate, 1);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(substrate.crystal_id);
    expect(lateral.enclosed_crystals).not.toContain(guest.crystal_id);
    expect(guest.enclosure_receipt).toMatchObject({
      schema: 'enclosure-receipt-v1',
      host_crystal_id: substrate.crystal_id,
      guest_crystal_id: guest.crystal_id,
      route: 'guest-on-host',
      adjacency_authority: 'exact-substrate-id',
    });
    expect(guest.enclosure_receipt.host_same_step_positive_growth_um).toBe(1);
    expect(guest.enclosure_receipt.host_same_step_negative_growth_um).toBe(0);
    expect(guest.enclosure_receipt.host_same_step_net_growth_um).toBe(1);
    expect(sim._enclosureReceipts).toEqual([guest.enclosure_receipt]);
  });

  it('prefers a host rooted on the guest over a lateral host', () => {
    const ring = equatorRing(sim);
    const lateral = place(sim, sim.nucleate('calcite'), ring, 10, 9000);
    const guest = place(sim, sim.nucleate('pyrite'), ring, 11, 100);
    const rooted = place(
      sim,
      sim.nucleate('quartz', `on pyrite #${guest.crystal_id}`),
      ring,
      11,
      8000,
    );
    growHostNow(sim, lateral);
    addHostZone(sim, rooted, 1);
    sim._check_enclosure();
    expect(guest.enclosed_by).toBe(rooted.crystal_id);
    expect(guest.enclosure_receipt.route).toBe('host-on-guest');
  });

  it('uses distance, then size ratio, then crystal ID for lateral ties', () => {
    const run = (aCell: number, aGrowth: number, bCell: number, bGrowth: number) => {
      const local = freshSim();
      const ring = equatorRing(local);
      const first = place(local, local.nucleate('calcite'), ring, aCell, aGrowth);
      const second = place(local, local.nucleate('quartz'), ring, bCell, bGrowth);
      const guest = place(local, local.nucleate('pyrite'), ring, 11, 100);
      growHostNow(local, first);
      addHostZone(local, second, 1);
      local._check_enclosure();
      return { first, second, guest };
    };

    const distance = run(8, 9000, 10, 9000);
    expect(distance.guest.enclosed_by).toBe(distance.second.crystal_id);

    const ratio = run(10, 8000, 10, 9000);
    expect(ratio.guest.enclosed_by).toBe(ratio.second.crystal_id);

    const id = run(10, 9000, 10, 9000);
    expect(id.guest.enclosed_by).toBe(id.first.crystal_id);
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
    growHostNow(sim, host);
    sim._check_enclosure();
    expect(onFront.enclosed_by).toBe(host.crystal_id);
    expect(onFront.coats_front).toBe(true);
    expect(lateral.enclosed_by).toBe(host.crystal_id);
    expect(lateral.coats_front).toBe(false);
  });

  it('partial host retreat liberates the guest, removes its front film, and emits evidence', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 1);
    host.total_growth_um = 0;
    host.c_length_mm = 0;
    host.a_width_mm = 0;
    host.zones = [];
    host.phantom_surfaces = [];
    host.phantom_count = 0;
    for (const [step, thickness] of [[1, 3000], [2, 3000], [3, 2000]]) {
      sim.step = step;
      addHostZone(sim, host, thickness);
    }
    const guest = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    sim.step = 4;
    addHostZone(sim, host, 5000, true); // testimony-only: never solid threshold
    addHostZone(sim, host, 1000);
    sim._check_enclosure();
    expect(guest.coats_front).toBe(true);
    expect(host._film).toBeTruthy();
    expect(host.total_growth_um).toBe(14000); // includes the explicit phantom
    expect(guest.enclosure_receipt.host_physical_size_at_enclosure_um).toBe(9000);

    // A real accepted negative shell exposes the guest before the host is
    // destroyed: 6000 < 0.7 * 9000, with 6000 um of host still present.
    sim.step = 5;
    addHostZone(sim, host, -3000);
    expect(host.total_growth_um).toBe(11000); // raw total still includes phantom
    expect(host.dissolved).toBe(false);
    sim._check_liberation();
    expect(guest.enclosed_by).toBeNull();
    expect(guest.coats_front).toBeNull();
    expect(guest.active).toBe(true);
    expect(host._film).toBeNull();
    expect(sim._enclosureReceipts.map((row: any) => row.schema))
      .toEqual(['enclosure-receipt-v1', 'liberation-receipt-v1']);
    expect(guest.liberation_receipt).toMatchObject({
      event: 'liberated',
      enclosure_step: 4,
      host_current_growth_um: 6000,
      host_size_at_enclosure_um: 9000,
      host_still_has_solid: true,
    });
    expect(guest.liberation_receipt.liberation_threshold_um).toBe(6300);
  });

  it('preserves an intervening dust film and reports zero removal when it dominates', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    growHostNow(sim, host, 1000);
    sim._check_enclosure();
    expect(host._film.phi_term).toBeCloseTo(0.15, 12);
    applyFilmDusting([host], 'clay', 0.5, 0.2, 5, ['calcite']);
    expect(host._film).toMatchObject({ mineral: 'clay', phi_term: 0.5, phi_prism: 0.2 });
    sim.step = 6;
    addHostZone(sim, host, -3000);
    sim._check_liberation();
    expect(host._film).toMatchObject({ mineral: 'clay', phi_term: 0.5, phi_prism: 0.2, step: 5 });
    expect(guest.liberation_receipt).toMatchObject({
      front_film_operation_found: true,
      front_film_contribution_removed: 0,
      front_film_prism_contribution_removed: 0,
    });
  });

  it('records only the effective capped contribution and removes exactly that amount', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    applyFilmDusting([host], 'clay', 0.99, 0, 3, ['calcite']);
    const guest = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    growHostNow(sim, host, 1000);
    sim._check_enclosure();
    expect(host._film.phi_term).toBeCloseTo(0.995, 12);
    expect(guest.enclosure_receipt.front_film_nominal_contribution).toBe(0.15);
    expect(guest.enclosure_receipt.front_film_contribution).toBeCloseTo(0.005, 12);
    sim.step = 5;
    addHostZone(sim, host, -3000);
    sim._check_liberation();
    expect(host._film).toMatchObject({ mineral: 'clay', phi_term: 0.99 });
    expect(guest.liberation_receipt.front_film_contribution_removed).toBeCloseTo(0.005, 12);
  });

  it('does not claim film removal after the enclosure film already grew through', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const guest = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    growHostNow(sim, host, 1000);
    sim._check_enclosure();
    host._film = null; // accepted later breakthrough consumed the entire film
    sim.step = 5;
    addHostZone(sim, host, -3000);
    sim._check_liberation();
    expect(host._film).toBeNull();
    expect(guest.liberation_receipt).toMatchObject({
      front_film_operation_found: false,
      front_film_contribution_removed: 0,
    });
  });

  it('removes one front guest without erasing another guest film', () => {
    const ring = equatorRing(sim);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 8000);
    const first = place(sim, sim.nucleate('pyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    growHostNow(sim, host, 1000); // first enclosure at physical 9000
    sim._check_enclosure();
    expect(host._film.phi_term).toBeCloseTo(0.15, 12);
    const second = place(sim, sim.nucleate('chalcopyrite', `on calcite #${host.crystal_id}`),
      ring, 10, 100);
    growHostNextStep(sim, host, 3000); // second enclosure at physical 12000
    sim._check_enclosure();
    expect(host._film.phi_term).toBeCloseTo(0.30, 12);
    sim.step += 1;
    addHostZone(sim, host, -5000); // physical 7000: frees second (<8400), not first (>6300)
    sim._check_liberation();
    expect(first.enclosed_by).toBe(host.crystal_id);
    expect(second.enclosed_by).toBeNull();
    expect(host._film.phi_term).toBeCloseTo(0.15, 12);
    expect(second.liberation_receipt.front_film_contribution_removed).toBeCloseTo(0.15, 12);
  });
});
