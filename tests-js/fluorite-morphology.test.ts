// tests-js/fluorite-morphology.test.ts — fluorite morphology contracts
// (morphology-generalization arc, FOURTH tenant, 2026-06-12 —
// sim-neutral: no rng in the habit branch, shared cube alphabet).
//
// Contracts pinned:
//   1. REGISTRY SHAPE: Sunagawa-ordered bands across the authenticated
//      accepted-layer fleet, with no size damping.
//   2. REGISTRY BOUNDARIES: every adjacent Sunagawa-style surface
//      regime remains ordered and directly testable without assigning
//      an obsolete scenario plateau to the boundary.
//   3. LOCALITY-AUTHORED EVIDENCE: Elmwood's corrected Gratz-Misra
//      Ca/F brine stays below the stepped threshold. Its late CO3/pH
//      pulse train is a calcite driver, not an invented fluorite
//      coupling. The reactivated vein retains three positive layer
//      regimes and its fail-closed stepped-face etch receipt.
//   4. THE REE COMPOSE: sunnyside fluorite keeps octahedral_REE habit
//      + morph_form 'octahedron' (form beats roughness; the v103 Y
//      rule outranks the regime alphabet).
//   5. INSTRUMENTS: fluorite_morph chip ('halide' system), display.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
declare const halideTerraceBands: any;
declare const _HELIX_CHEM_PARAMS: any;
declare const _habitGeomToken: any;
declare const _habitAspectRatio: any;
declare const HABIT_TO_TEXTURE: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 120;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

const FLUORITE_REGIMES = new Set([
  'spiral_smooth', 'stepped_mild', 'stepped_macro', 'hopper_skeletal', 'dendritic',
]);

function fluoriteMass(sim: any): {
  mass: Record<string, number>,
  total: number,
  positiveTotal: number,
  positiveZones: any[],
} {
  const mass: Record<string, number> = {};
  const positiveZones: any[] = [];
  let total = 0, positiveTotal = 0;
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'fluorite' || c.dissolved) continue;
    for (const z of c.zones || []) {
      if (!(z.thickness_um > 0)) continue;
      positiveZones.push(z);
      positiveTotal += z.thickness_um;
      if (!z.morph_regime) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
      total += z.thickness_um;
    }
  }
  return { mass, total, positiveTotal, positiveZones };
}

function expectCompleteFluoriteMorphology(summary: ReturnType<typeof fluoriteMass>) {
  expect(summary.positiveZones.length).toBeGreaterThan(0);
  for (const z of summary.positiveZones) {
    expect(FLUORITE_REGIMES.has(z.morph_regime)).toBe(true);
    expect(Number.isFinite(z.morph_surf_sigma)).toBe(true);
  }
  expect(summary.total).toBeCloseTo(summary.positiveTotal, 12);
}

describe('fluorite morphology registry (fourth tenant)', () => {

  it('Sunagawa-ordered bands have direct, gap-free threshold boundaries', () => {
    const th = MORPH_TH.fluorite;
    expect(th).toBeTruthy();
    expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
    expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
    expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    expect(th.SIZE_HALF_UM).toBe(Infinity);
    const eps = 1e-9;
    expect(morphRegime(th, th.SPIRAL_MAX - eps)).toBe('spiral_smooth');
    expect(morphRegime(th, th.SPIRAL_MAX)).toBe('stepped_mild');
    expect(morphRegime(th, th.STEP_MILD_MAX - eps)).toBe('stepped_mild');
    expect(morphRegime(th, th.STEP_MILD_MAX)).toBe('stepped_macro');
    expect(morphRegime(th, th.STEP_MACRO_MAX - eps)).toBe('stepped_macro');
    expect(morphRegime(th, th.STEP_MACRO_MAX)).toBe('hopper_skeletal');
    expect(morphRegime(th, th.HOPPER_MAX - eps)).toBe('hopper_skeletal');
    expect(morphRegime(th, th.HOPPER_MAX)).toBe('dendritic');
  });

  it('mvt fluorite stays glassy (100% smooth at seed 42)', () => {
    const summary = fluoriteMass(runScenario('mvt'));
    expectCompleteFluoriteMorphology(summary);
    const { mass, total } = summary;
    expect(total).toBeGreaterThan(0);
    expect((mass.spiral_smooth || 0) / total).toBeCloseTo(1, 6);
  });

  it('elmwood fluorite stays smooth under its locality-owned Ca/F brine; calcite owns the late CO3 pulses', () => {
    const sim = runScenario('elmwood');
    const summary = fluoriteMass(sim);
    expectCompleteFluoriteMorphology(summary);
    const { mass, total, positiveZones } = summary;
    expect(total).toBeGreaterThan(0);
    expect(Object.keys(mass)).toEqual(['spiral_smooth']);
    expect((mass.spiral_smooth || 0) / total).toBeCloseTo(1, 12);
    expect(Math.max(...positiveZones.map((z: any) => z.morph_surf_sigma)))
      .toBeLessThan(MORPH_TH.fluorite.SPIRAL_MAX);
  });

  it('reactivated vein records mixed layers and withholds the flat-{100} rate from its stepped breach face', () => {
    const sim = runScenario('reactivated_fluorite_vein');
    const summary = fluoriteMass(sim);
    expectCompleteFluoriteMorphology(summary);
    const { mass, total } = summary;
    expect(total).toBeGreaterThan(0);
    // Authenticated layer testimony: the first and second fluid generations
    // leave three physically distinct regimes. A later smooth overgrowth may restore
    // the final display habit to `cubic`, but it cannot rewrite the stepped
    // surface that the breach wash actually encountered at step 118.
    expect(Object.keys(mass).sort()).toEqual([
      'hopper_skeletal', 'spiral_smooth', 'stepped_macro',
    ]);
    const smoothShare = (mass.spiral_smooth || 0) / total;
    const hopperShare = (mass.hopper_skeletal || 0) / total;
    const steppedShare = (mass.stepped_macro || 0) / total;
    expect(smoothShare).toBeGreaterThan(0);
    expect(hopperShare).toBeGreaterThan(0);
    expect(steppedShare).toBeGreaterThan(smoothShare);
    expect(steppedShare).toBeGreaterThan(hopperShare);
    expect(smoothShare + hopperShare + steppedShare).toBeCloseTo(1, 12);
    expect(sim._physicalEtchReceipts.at(-1)).toMatchObject({
      schema: 'physical-dissolution-v3', step: 118,
      considered: 1, accepted: 0, rejected: 1,
      receipts: [{
        mineral: 'fluorite', habit: 'stepped_cube', accepted: false,
        rejection: 'no_face_matched_evidence_bounded_rate_model',
      }],
    });
    const etched = sim.crystals.filter((c: any) =>
      c.mineral === 'fluorite'
      && !c.dissolved
      && Array.isArray(c.etch_history)
      && c.etch_history.length > 0);
    expect(etched).toEqual([]);
  });

  it('THE REE COMPOSE: sunnyside fluorite keeps its octahedron (form beats roughness)', () => {
    const sim = runScenario('sunnyside_american_tunnel');
    const fl = sim.crystals.filter((c: any) => c.mineral === 'fluorite' && !c.dissolved && c.total_growth_um > 0);
    expect(fl.length).toBeGreaterThan(0);
    for (const c of fl) {
      expect(c.habit).toBe('octahedral_REE');
      const tagged = (c.zones || []).find((z: any) => z.morph_form);
      expect(tagged.morph_form).toBe('octahedron');
    }
  });

  it('σ-stepped REE octahedra: routes exist end-to-end (fleet-inert — sunnyside is flat at 1.95)', () => {
    // The compose in grow_fluorite fires only when a Y>1 scenario sees
    // driven σ — no fleet tenant today, BY MEASUREMENT (the survey
    // re-confirmed sunnyside flat at 1.95 before this shipped). What
    // CAN rot silently is the plumbing, so pin every route the renames
    // will need the day a Y-fluorite scenario lands:
    // 3D token — stepped/hopper keep the octahedron; dendritic gets the
    // tree (spike token). Plain octahedral_REE had been a hex-prism
    // wart since v103 (same family as pyritohedral) — pinned fixed.
    expect(_habitGeomToken('octahedral_REE')).toBe('octahedron');
    expect(_habitGeomToken('stepped_octahedral_REE')).toBe('octahedron');
    expect(_habitGeomToken('hopper_octahedral_REE')).toBe('octahedron');
    expect(_habitGeomToken('dendritic_octahedral_REE')).toBe('spike');
    // Aspect firewall — the parent landed on the default 0.5; renames
    // carry it explicitly (rename must never move volume → chemistry).
    for (const h of ['octahedral_REE', 'stepped_octahedral_REE',
                     'hopper_octahedral_REE', 'dendritic_octahedral_REE']) {
      expect(_habitAspectRatio(h)).toBe(0.5);
    }
    // 2D texture — same grammar as every other regime family.
    expect(HABIT_TO_TEXTURE['stepped_octahedral_REE']).toBe('hopper');
    expect(HABIT_TO_TEXTURE['hopper_octahedral_REE']).toBe('hopper');
    expect(HABIT_TO_TEXTURE['dendritic_octahedral_REE']).toBe('acicular');
  });

  it('fluorite_morph chip exists under the halide system; display speaks fluorite', () => {
    const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === 'fluorite_morph');
    expect(p).toBeTruthy();
    expect(p.system).toBe('halide');
    expect(morphDisplayLabel('fluorite', 'stepped_macro')).toBe('composite/stepped cube');
    expect(morphDisplayLabel('fluorite', 'spiral_smooth')).toBe('glassy cube');
  });
});
