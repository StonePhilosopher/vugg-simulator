// tests-js/cleft-halfform.test.ts — THE FOUNDATION RUNGS (SIM 215, 2026-07-03):
// W-K V0 cleft-truth + W-F O0 half-forms, co-staged per the co-evolution rule.
//
// What v215 promises:
//   * V0 — a new 'cleft' archetype: planar-lens cavity (polar_flatten oblate
//     profile), cleft-aware ringOrientation (faces = footwall/hangingwall,
//     rim = wall), floor_ceiling nucleation → opposed druses; grimsel +
//     tormiq move off 'pocket'. Every OTHER archetype's polar profile is
//     numerically untouched (byte-safety), and the pole caps now honor the
//     polar profile (the cleft-needle / basin-spike fix).
//   * O0 — attached-crystal truth: the Wulff kernel grows a HALF-FORM when
//     handed the attachment plane as one more half-space, emitting a real
//     scar-cap face, normalized at the FULL form's scale. Steno pin: the
//     clip adds a plane, never tilts a crystal-face normal.
//
// Science anchors: Ricchi 2021 (cleft slab geometry), Self & Hill 2003
// (opposed druses / contact faces), Grigor'ev 1965 (half-forms). See
// PROPOSAL-VUG-GENESIS-2026-07-03.md §6 (V0) + PROPOSAL-ONTOGENY-2026-07-03.md
// §3 (O0).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const WallState: any;
declare const WallMesh: any;
declare const wulffFaceSetForMineral: any;
declare const wulffPolyhedron: any;
declare const _makeWulffGeom: any;
declare const _makeWulffHalfFormGeom: any;

function makeSim(scenarioName: string, seed = 42, steps?: number) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  expect(scen, `scenario ${scenarioName} missing`).toBeTruthy();
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

// ============================================================
// V0 — the cleft archetype
// ============================================================

describe('W-K V0 — cleft archetype (planar-lens fissure)', () => {
  it('grimsel_alpine_cleft + tormiq_alpine_cleft carry architecture "cleft"', () => {
    for (const name of ['grimsel_alpine_cleft', 'tormiq_alpine_cleft']) {
      const scen = SCENARIOS[name];
      expect(scen, `scenario ${name} missing`).toBeTruthy();
      const { conditions } = scen();
      expect(conditions?.wall?.architecture, `${name} must be a cleft`).toBe('cleft');
    }
  });

  it('cleft WallState carries the lens knobs (flatten, elongation, floor_ceiling)', () => {
    const wall = new WallState({ architecture: 'cleft', cells_per_ring: 120, ring_count: 16 });
    expect(wall.polar_flatten).toBeGreaterThan(0);
    expect(wall.polar_flatten).toBeLessThan(0.5);       // it must read as a SLAB, not a fat ellipsoid
    expect(wall.elongation).toBeGreaterThan(0);          // stretched along strike
    expect(wall.nucleation_bias).toBe('floor_ceiling');  // opposed druses, not rim crystals
  });

  it('polarProfileFactor is the exact oblate lens: 1 at the rim, q at the faces', () => {
    const wall = new WallState({ architecture: 'cleft', cells_per_ring: 120, ring_count: 16 });
    const q = wall.polar_flatten;
    expect(wall.polarProfileFactor(Math.PI / 2)).toBeCloseTo(1.0, 6);   // equatorial rim untouched
    expect(wall.polarProfileFactor(0)).toBeCloseTo(q, 6);               // footwall face
    expect(wall.polarProfileFactor(Math.PI)).toBeCloseTo(q, 6);         // hangingwall face
    // strictly monotonic from face to rim on the south half — a lens, not a wobble
    let prev = wall.polarProfileFactor(0);
    for (let k = 1; k <= 8; k++) {
      const f = wall.polarProfileFactor((Math.PI / 2) * (k / 8));
      expect(f).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = f;
    }
  });

  it('BYTE-SAFETY: non-cleft archetypes keep their polar profile bit-for-bit', () => {
    // The 3D builder zeroes the Fourier amplitudes, so the legacy profile is
    // exactly 1.0 everywhere for pocket/irregular/tabular/spherical, and the
    // basin sigmoid is untouched by the new flatten branch (polar_flatten 0).
    for (const arch of ['pocket', 'irregular', 'tabular', 'spherical']) {
      const wall = new WallState({ architecture: arch, cells_per_ring: 120, ring_count: 16 });
      wall.polar_amplitudes = [];   // the constructor path zeroes these; enforce for the raw-state test
      for (let k = 0; k <= 16; k++) {
        expect(wall.polarProfileFactor(Math.PI * k / 16), `${arch} must stay 1.0`).toBeCloseTo(1.0, 12);
      }
      expect(wall.polar_flatten).toBe(0);
    }
    const basin = new WallState({ architecture: 'basin', cells_per_ring: 120, ring_count: 16 });
    basin.polar_amplitudes = [];
    expect(basin.polar_flatten).toBe(0);
    // basin north pole stays the sigmoid pinch (~0.05), NOT the lens
    expect(basin.polarProfileFactor(Math.PI)).toBeLessThan(0.1);
    expect(basin.polarProfileFactor(0)).toBeGreaterThan(0.9);
  });

  it('cleft ringOrientation: faces are floor/ceiling druse walls, only the rim is "wall"', () => {
    const wall = new WallState({ architecture: 'cleft', cells_per_ring: 120, ring_count: 16 });
    for (let r = 0; r <= 6; r++) expect(wall.ringOrientation(r), `ring ${r}`).toBe('floor');
    expect(wall.ringOrientation(7)).toBe('wall');
    expect(wall.ringOrientation(8)).toBe('wall');
    for (let r = 9; r <= 15; r++) expect(wall.ringOrientation(r), `ring ${r}`).toBe('ceiling');
    // non-cleft keeps the sphere quarters (regression guard)
    const pocket = new WallState({ architecture: 'pocket', cells_per_ring: 120, ring_count: 16 });
    expect(pocket.ringOrientation(0)).toBe('floor');
    expect(pocket.ringOrientation(7)).toBe('wall');
    expect(pocket.ringOrientation(15)).toBe('ceiling');
  });

  it('pole caps honor the polar profile (the cleft-needle fix)', () => {
    const wall = new WallState({ architecture: 'cleft', cells_per_ring: 120, ring_count: 16, vug_diameter_mm: 100, shape_seed: 7 });
    const mesh = WallMesh.fromWallState(wall);
    // each cap projects from ITS OWN parent ring's mean radius (the
    // sphere-union is asymmetric per ring — compare like with like)
    const ringMean = (idx: number) => {
      const ring = wall.rings[idx];
      let m = 0;
      for (const c of ring) m += c.base_radius_mm + c.wall_depth;
      return m / ring.length;
    };
    const northY = mesh.positions[mesh.northIdx * 3 + 1];
    const southY = mesh.positions[mesh.southIdx * 3 + 1];
    // caps must sit at ~q × (projected mean ring radius), NOT at full radius
    const q = wall.polar_flatten;
    const proj = Math.cos(Math.PI / 32);
    expect(Math.abs(northY)).toBeLessThan(ringMean(15) * proj * (q + 0.05));
    expect(Math.abs(southY)).toBeLessThan(ringMean(0) * proj * (q + 0.05));
    expect(Math.abs(northY)).toBeGreaterThan(ringMean(15) * proj * q * 0.5);   // flush, not collapsed to zero
  });

  it('pole caps of a legacy pocket wall are byte-identical to the pre-fix formula', () => {
    const wall = new WallState({ architecture: 'pocket', cells_per_ring: 120, ring_count: 16, vug_diameter_mm: 100, shape_seed: 7 });
    const mesh = WallMesh.fromWallState(wall);
    const ring0 = wall.rings[0];
    let meanR = 0;
    for (const c of ring0) meanR += c.base_radius_mm + c.wall_depth;
    meanR /= ring0.length;
    // pre-fix: southR = meanRingRadius(0) × cos(π/(2·ringCount)); the polar
    // factor for a legacy wall is exactly 1.0, so the number must not move.
    // (precision 4: mesh.positions is a Float32Array — ~4e-6 abs at 70 mm.)
    expect(mesh.positions[mesh.southIdx * 3 + 1]).toBeCloseTo(-meanR * Math.cos(Math.PI / 32), 4);
  });

  it('grimsel crystals live on the two druse faces (floor_ceiling bias holds at seed 42)', () => {
    const sim = makeSim('grimsel_alpine_cleft');
    expect(sim.crystals.length).toBeGreaterThan(0);
    for (const c of sim.crystals) {
      const zone = sim.wall_state.zoneOf(c);
      expect(zone === 'floor' || zone === 'ceiling',
        `${c.mineral} sits on the rim (zone=${zone}) — floor_ceiling bias broken`).toBe(true);
    }
  });

  it('re-genre survival: the cleft suites still fire at seed 42', () => {
    // The shape change moves nucleation geometry; the SPECIES story must
    // survive it. Grimsel: smoky quartz is the volumetric star. Tormiq:
    // epidote is the star (max_nucleation-capped most-abundant before V0).
    const grimsel = makeSim('grimsel_alpine_cleft');
    expect(grimsel.crystals.some((c: any) => c.mineral === 'quartz'),
      'grimsel lost its quartz in the re-genre').toBe(true);
    const tormiq = makeSim('tormiq_alpine_cleft');
    expect(tormiq.crystals.some((c: any) => c.mineral === 'epidote'),
      'tormiq lost its epidote in the re-genre').toBe(true);
  });
});

// ============================================================
// O0 — half-forms (attached-crystal truth)
// ============================================================

describe('W-F O0 — Wulff half-forms with a real scar cap', () => {
  const TENANTS: Array<[string, number, number]> = [
    // [mineral, growthFrac, biasC] — plausible mid-run values per tenant
    ['fluorite', 0.6, 1.3],
    ['calcite', 0.7, 0.8],
    ['wulfenite', 0.5, 1.0],
    ['barite', 0.5, 1.0],
    ['galena', 0.6, 1.0],
    ['titanite', 0.5, 1.0],
  ];

  function geomYRange(geom: any): [number, number] {
    const pos = geom.attributes.position.array;
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
      if (pos[i] < lo) lo = pos[i];
      if (pos[i] > hi) hi = pos[i];
    }
    return [lo, hi];
  }

  it('builds a half-form for every Wulff tenant (no degenerate clamps at 0.5)', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      expect(faces, `${mineral} face set`).toBeTruthy();
      const half = _makeWulffHalfFormGeom(faces, 0.5);
      expect(half, `${mineral} half-form degenerate`).toBeTruthy();
    }
  });

  it('the buried half is GONE: clipped minY sits at the attachment plane', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      const full = _makeWulffGeom(faces);
      const half = _makeWulffHalfFormGeom(faces, 0.5);
      const [fLo, fHi] = geomYRange(full);
      const [hLo, hHi] = geomYRange(half);
      const yCutNorm = fLo + 0.5 * (fHi - fLo);   // mid-extent in the SHARED (full-form) scale
      expect(hLo, `${mineral} still has buried geometry`).toBeGreaterThanOrEqual(yCutNorm - 1e-4);
      expect(hLo, `${mineral} cap not at the cut plane`).toBeLessThanOrEqual(yCutNorm + 1e-4);
      // free termination untouched — same top, same scale
      expect(hHi).toBeCloseTo(fHi, 4);
    }
  });

  it('the scar cap is a REAL face: triangles lie in the cut plane', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      const half = _makeWulffHalfFormGeom(faces, 0.5);
      const pos = half.attributes.position.array;
      const [lo] = geomYRange(half);
      let capTris = 0;
      for (let t = 0; t < pos.length; t += 9) {
        if (Math.abs(pos[t + 1] - lo) < 1e-4
          && Math.abs(pos[t + 4] - lo) < 1e-4
          && Math.abs(pos[t + 7] - lo) < 1e-4) capTris++;
      }
      expect(capTris, `${mineral} has no scar cap`).toBeGreaterThanOrEqual(1);
    }
  });

  it('STENO PIN: the clip adds a plane — it never tilts a crystal-face normal', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      const before = JSON.stringify(faces.map((f: any) => f.n));
      _makeWulffHalfFormGeom(faces, 0.5);
      expect(JSON.stringify(faces.map((f: any) => f.n)), `${mineral} input mutated`).toBe(before);
      // and the clipped polyhedron's surviving crystal faces reference the
      // ORIGINAL planes verbatim (the kernel indexes into the input list)
      const clip = { n: [0, -1, 0], d: 0 };
      const poly = wulffPolyhedron(faces.concat([clip]));
      for (const f of poly.faces) {
        if (f.plane < faces.length) {
          expect(poly && faces[f.plane].n, 'plane index escaped the input list').toBeTruthy();
        }
      }
    }
  });

  it('attachment-fraction quantile moves the cut plane (0.3 buries less than 0.7)', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const [lo30] = geomYRange(_makeWulffHalfFormGeom(faces, 0.3));
    const [lo70] = geomYRange(_makeWulffHalfFormGeom(faces, 0.7));
    expect(lo30).toBeLessThan(lo70);   // shallower attachment keeps more of the lower body
  });

  it('degenerate requests clamp instead of throwing', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    expect(() => _makeWulffHalfFormGeom(faces, 5)).not.toThrow();     // clamps to 0.95
    expect(() => _makeWulffHalfFormGeom(faces, -1)).not.toThrow();    // 0/negative → 0.5 default then clamp floor
    expect(() => _makeWulffHalfFormGeom(null, 0.5)).not.toThrow();
    expect(_makeWulffHalfFormGeom(null as any, 0.5)).toBeNull();
  });
});
