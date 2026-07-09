// tests-js/o5-film.test.ts — W-F O5a: perturbed regrowth, the record-unread
// tranche (SIM-neutral, byte-identical).
//
// O5a records a foreign-matter film (`_film`) on crystals — from the event
// `film:` dusting directive and from O4b coats_front enclosures — and defines
// the σ*(φ) masking law, but NO growth path reads either yet (the gate is behind
// O5_MASKING_ENABLED, false until O5b). So these pins are on the pure law and the
// writers' recorded state, exactly as the O3a suite pinned drawNucleationTilt +
// _nucTilt before O3b read them.
//
// The law is the two-pass-reconciled form (rockbot's baseline-anchored version,
// PROPOSAL-O5 §8 Q1): σ*(φ) = σ*₀·(1 + k·φ/(1−φ)) — reduces to σ*₀ at φ=0 (the
// byte-identity anchor), diverges as φ→1 (a complete film fully arrests).

import { beforeEach, describe, expect, it } from 'vitest';

declare const sigmaStarForCoverage: any;
declare const applyFilmDusting: any;
declare const setSigmaStarK: any;
declare const O5_MASKING_ENABLED: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

describe('W-F O5 — σ*(φ) masking law (pure, unread in O5a)', () => {
  beforeEach(() => setSigmaStarK(1.0));

  it('reduces to the clean threshold at φ=0 (the byte-identity anchor)', () => {
    expect(sigmaStarForCoverage(2.5, 0)).toBe(2.5);
    expect(sigmaStarForCoverage(2.5, -0.3)).toBe(2.5);   // negative coverage = clean
    expect(sigmaStarForCoverage(0, 0)).toBe(0);
  });

  it('is monotone increasing in φ (a heavier film is a higher barrier)', () => {
    const s0 = 2.0;
    let prev = -Infinity;
    for (const phi of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95]) {
      const v = sigmaStarForCoverage(s0, phi);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('matches the hyperbolic form σ*₀·(1 + k·φ/(1−φ)) at a checkpoint', () => {
    setSigmaStarK(1.0);
    // φ=0.5, k=1 → σ*₀·(1 + 1·0.5/0.5) = σ*₀·2
    expect(sigmaStarForCoverage(3, 0.5)).toBeCloseTo(6, 6);
    // φ=0.75 → σ*₀·(1 + 0.75/0.25) = σ*₀·4
    expect(sigmaStarForCoverage(3, 0.75)).toBeCloseTo(12, 6);
  });

  it('diverges toward a very high barrier as φ→1 (complete film arrests), but stays finite (φ clamp)', () => {
    const near = sigmaStarForCoverage(1, 0.999);   // clamped at O5_PHI_MAX=0.995
    expect(Number.isFinite(near)).toBe(true);
    expect(near).toBeGreaterThan(100);             // σ*₀·(1 + 0.995/0.005) = 200
    // A truly heavy blanket is a genuinely huge barrier, NOT a modest cap
    // (the reconciliation's "honor the divergence" over the old 0.95 clamp).
    expect(near).toBeGreaterThan(sigmaStarForCoverage(1, 0.9) * 5);
  });

  it('scales with the calibration constant k', () => {
    setSigmaStarK(2.0);
    // φ=0.5, k=2 → σ*₀·(1 + 2·1) = σ*₀·3
    expect(sigmaStarForCoverage(4, 0.5)).toBeCloseTo(12, 6);
    setSigmaStarK(1.0);
  });
});

describe('W-F O5 — applyFilmDusting (writer 1 core, deterministic)', () => {
  const mk = (over: any = {}) => ({
    crystal_id: over.id ?? 1, mineral: over.mineral ?? 'quartz',
    active: over.active ?? true, dissolved: over.dissolved ?? false,
    enclosed_by: over.enclosed_by ?? null, _film: over._film ?? null,
  });

  it('sets _film on active, exposed, matching crystals only', () => {
    const crystals = [
      mk({ id: 1, mineral: 'quartz' }),
      mk({ id: 2, mineral: 'quartz', active: false }),     // inactive → skip
      mk({ id: 3, mineral: 'quartz', dissolved: true }),   // dissolved → skip
      mk({ id: 4, mineral: 'quartz', enclosed_by: 9 }),    // already enclosed → skip
      mk({ id: 5, mineral: 'calcite' }),                   // not in filter → skip
    ];
    const n = applyFilmDusting(crystals, 'chlorite', 0.1, 0.8, 42, ['quartz']);
    expect(n).toBe(1);
    expect(crystals[0]._film).toEqual({ mineral: 'chlorite', phi_term: 0.1, phi_prism: 0.8, step: 42 });
    expect(crystals[1]._film).toBeNull();
    expect(crystals[3]._film).toBeNull();
    expect(crystals[4]._film).toBeNull();
  });

  it('a null filter dusts every exposed crystal regardless of mineral', () => {
    const crystals = [mk({ id: 1, mineral: 'quartz' }), mk({ id: 2, mineral: 'calcite' })];
    expect(applyFilmDusting(crystals, 'clay', 0.2, 0.2, 10, null)).toBe(2);
    expect(crystals[0]._film.mineral).toBe('clay');
    expect(crystals[1]._film.mineral).toBe('clay');
  });

  it('a second dusting accretes (MAX per axis), it does not wash off', () => {
    const c = mk({ id: 1, mineral: 'quartz', _film: { mineral: 'chlorite', phi_term: 0.3, phi_prism: 0.6, step: 5 } });
    applyFilmDusting([c], 'clay', 0.5, 0.2, 20, null);   // term rises 0.3→0.5, prism holds 0.6
    expect(c._film.phi_term).toBe(0.5);
    expect(c._film.phi_prism).toBe(0.6);
    expect(c._film.step).toBe(20);
  });

  it('clamps coverages into [0,1]', () => {
    const c = mk();
    applyFilmDusting([c], 'clay', 1.7, -0.4, 1, null);
    expect(c._film.phi_term).toBe(1);
    expect(c._film.phi_prism).toBe(0);
  });
});

describe('W-F O5 — coats_front writer 2 records host film (O4b enclosures)', () => {
  function freshSim() {
    setSeed(42);
    const scen = (SCENARIOS['mvt'] ?? SCENARIOS[Object.keys(SCENARIOS)[0]])();
    return new VugSimulator(scen.conditions, scen.events);
  }
  function place(sim: any, c: any, ring: number, cell: number, growthUm: number) {
    c.wall_anchor = sim.wall_state._anchorFromRingCell(ring, cell);
    c.total_growth_um = growthUm; c.c_length_mm = growthUm / 1000;
    c.zones = [{ step: 1, thickness_um: 0.5 }, { step: 2, thickness_um: 0.5 }, { step: 3, thickness_um: 0.5 }];
    c.active = true; c.dissolved = false; c._buried = false;
    return c;
  }

  it('a front-coating enclosure records termination-film on the host; a lateral one does not', () => {
    const sim = freshSim();
    const ring = Math.floor(sim.wall_state.ring_count / 2);
    const host = place(sim, sim.nucleate('calcite'), ring, 10, 9000);
    const onFront = place(sim, sim.nucleate('chalcopyrite', `on calcite #${host.crystal_id}`), ring, 10, 100);
    sim._check_enclosure();
    expect(onFront.coats_front).toBe(true);
    expect(host._film).toBeTruthy();
    expect(host._film.mineral).toBe('chalcopyrite');   // the guest IS the film
    expect(host._film.phi_term).toBeGreaterThan(0);
    expect(host._film.phi_prism).toBe(0);              // front-coating lands on the tip, not flanks

    // A second, LATERAL swallow on a fresh host deposits no film.
    const host2 = place(sim, sim.nucleate('calcite'), ring, 40, 9000);
    const lateral = place(sim, sim.nucleate('pyrite'), ring, 41, 100);
    sim._check_enclosure();
    expect(lateral.coats_front).toBe(false);
    expect(host2._film).toBeNull();
  });
});

describe('W-F O5 — the masking gate flag (O5a recorded-unread → O5b live)', () => {
  it('O5_MASKING_ENABLED is TRUE — the σ*(φ) gate is live as of O5b (SIM 222)', () => {
    // O5a shipped this false (film recorded, unread → byte-identical). O5b flipped
    // it: the growth loop now gates filmed crystals on σ*(φ). The byte-identity of
    // the non-film fleet is preserved by the `crystal._film` guard, NOT by the flag
    // (the full-suite baseline pins carry that proof); this pin just tracks the flip.
    expect(O5_MASKING_ENABLED).toBe(true);
  });
});
