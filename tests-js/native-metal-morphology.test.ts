// tests-js/native-metal-morphology.test.ts — native copper + gold
// morphology contracts (morphology-generalization arc, sixth/seventh
// tenants — the conflation sweep that closes the boss's list,
// 2026-06-12; sim-neutral: no rng in either habit branch).
//
// Contracts:
//   1. registry shapes + the measured band placements (copper bands on
//      bisbee's −400 pulse ramp, peak 2.09; gold on its 2.77 plateau)
//   2. THE CONFLATION FIX: nugget and massive_sheet retired from
//      σ-dispatch (placer/fissure-fill TEXTURES, not growth
//      morphology) — bisbee gold reads spongy/dendritic, the σ-top
//      copper band is the arborescent tree
//   3. THE COPPER STORY: bisbee's copper grows on the pulse, records
//      stepped mass and preserves a smooth terminal positive shell. Any later
//      oxidation or enclosure must be backed by its own physical receipt.
//   4. chips under the native group

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 320;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

describe('native copper + gold morphology (the conflation sweep)', () => {

  let _bisbee: any = null;
  const bisbee = () => (_bisbee ||= runScenario('bisbee'));

  it('registries: Sunagawa-ordered bands on the measured trajectories', () => {
    for (const m of ['native_copper', 'native_gold']) {
      const th = MORPH_TH[m];
      expect(th).toBeTruthy();
      expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
      expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
      expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    }
    // copper: the −400 pulse peak (2.09 measured) is the dendrite moment
    expect(morphRegime(MORPH_TH.native_copper, 2.09)).toBe('dendritic');
    expect(morphRegime(MORPH_TH.native_copper, 1.5)).toBe('stepped_mild');   // wire
    // gold: bisbee plateau dendritic/fishbone; porphyry octahedral
    expect(morphRegime(MORPH_TH.native_gold, 2.77)).toBe('stepped_macro');
    expect(morphRegime(MORPH_TH.native_gold, 1.35)).toBe('spiral_smooth');
  });

  it('the Bisbee pulse grows stepped copper and any later loss/enclosure is physically receipted', () => {
    const sim = bisbee();
    const cu = sim.crystals.filter((c: any) => c.mineral === 'native_copper' && c.total_growth_um > 0);
    expect(cu.length).toBeGreaterThanOrEqual(1);
    let fleetOxidativeLoss = 0;
    let fleetReturnedCu = 0;
    for (const c of cu) {
      const positiveCore = c.zones.reduce((sum: number, z: any) =>
        sum + (z.thickness_um > 0 && !z.is_phantom ? z.thickness_um : 0), 0);
      const lossZones = c.zones.filter((z: any) => z.thickness_um < 0);
      const oxidativeLoss = lossZones.reduce((sum: number, z: any) =>
        sum + Math.abs(z.thickness_um), 0);
      const returnedCu = lossZones.reduce((sum: number, z: any) =>
        sum + Number(z._returned_budget_inventory?.Cu || 0), 0);
      fleetOxidativeLoss += oxidativeLoss;
      fleetReturnedCu += returnedCu;
      expect(positiveCore).toBeGreaterThan(0);
      expect(oxidativeLoss).toBeLessThan(positiveCore);
      expect(c.total_growth_um).toBeGreaterThan(0);
      expect(c.dissolved).toBe(false);
      if (oxidativeLoss > 0) {
        // O3 geometric selection shadows the growth front; it is not an
        // impermeable enclosure.  Bisbee's oxygenated late fluid must still
        // remove a booked outer Cu shell and return Cu to solution.
        expect(c.partially_dissolved).toBe(true);
        expect(returnedCu).toBeGreaterThan(0);
        expect(c.total_growth_um).toBeCloseTo(positiveCore - oxidativeLoss, 9);
      }
      if (c.enclosed_by != null) {
        const host = sim.crystals.find((row: any) => row.crystal_id === c.enclosed_by);
        expect(host).toBeTruthy();
        expect(host.mineral).toBe('chrysocolla');
        expect(host.enclosed_crystals).toContain(c.crystal_id);
        expect(c.enclosure_receipt).toMatchObject({
          schema: 'enclosure-receipt-v1',
          host_crystal_id: host.crystal_id,
          guest_crystal_id: c.crystal_id,
          guest_mineral: 'native_copper',
          host_mineral: 'chrysocolla',
          route: 'host-on-guest',
        });
        expect(c.enclosure_receipt.host_same_step_net_growth_um).toBeGreaterThan(0);
        expect(c.enclosure_receipt.size_ratio).toBeGreaterThan(3);
        expect(['guest-on-host', 'host-on-guest', 'geometric-overlap'])
          .toContain(c.enclosure_receipt.route);
      }
    }
    const fleetLossZones = cu.flatMap((c: any) =>
      c.zones.filter((zone: any) => zone.thickness_um < 0));
    expect(fleetLossZones).toHaveLength(5);
    expect(fleetOxidativeLoss).toBeCloseTo(50, 12);
    expect(fleetReturnedCu).toBeGreaterThan(0);
    const bookedCu = cu.flatMap((c: any) => c.zones)
      .filter((zone: any) => zone.thickness_um > 0)
      .reduce((sum: number, zone: any) =>
        sum + zone.thickness_um * Number(zone._budget_inventory_per_um?.Cu || 0), 0);
    const remainingCu = cu.flatMap((c: any) => c.zones)
      .filter((zone: any) => zone.thickness_um > 0)
      .reduce((sum: number, zone: any) => sum
        + Number(zone._remaining_solid_um ?? zone.thickness_um)
          * Number(zone._budget_inventory_per_um?.Cu || 0), 0);
    expect(bookedCu - remainingCu).toBeCloseTo(fleetReturnedCu, 12);
    const copperEnclosures = (sim._enclosureReceipts || []).filter(
      (row: any) => row.event === 'enclosed' && row.guest_mineral === 'native_copper',
    );
    expect(copperEnclosures).toHaveLength(1);
    expect(copperEnclosures[0]).toMatchObject({
      schema: 'enclosure-receipt-v1',
      step: 154,
      host_mineral: 'chrysocolla',
      guest_mineral: 'native_copper',
      route: 'host-on-guest',
      adjacency_authority: 'exact-substrate-id',
      guest_loss_um: 50,
      guest_partially_dissolved: true,
    });
    expect(copperEnclosures[0].guest_loss_um).toBeGreaterThan(0);
    expect(copperEnclosures[0].guest_loss_um)
      .toBeLessThan(copperEnclosures[0].guest_positive_core_um);
    let stepped = 0, tot = 0;
    for (const c of cu) for (const z of c.zones || []) {
      if (z.thickness_um > 0 && z.morph_regime) {
        tot += z.thickness_um;
        if (z.morph_regime === 'stepped_mild' || z.morph_regime === 'stepped_macro') stepped += z.thickness_um;
      }
    }
    expect(tot).toBeGreaterThan(0);
    expect(stepped / tot).toBeGreaterThan(0.8);
    for (const c of cu) {
      const positive = c.zones.filter((z: any) => z.thickness_um > 0);
      expect(positive.at(-1)?.morph_regime).toBe('spiral_smooth');
      // `habit` describes the exposed terminal form; the zone ledger above
      // retains the much larger stepped/arborescent pulse beneath it.
      expect(c.habit).toBe('cubic_dodecahedral');
    }
  });

  it('growth-front shadowing does not suppress a booked oxidative shell loss', () => {
    const sim = runScenario('bisbee', 42, 149);
    const copper = sim.crystals.find((c: any) =>
      c.mineral === 'native_copper' && c.total_growth_um > 0);
    expect(copper).toBeTruthy();
    const before = copper.total_growth_um;
    copper._buried = true;
    sim.run_step();
    const loss = copper.zones.at(-1);
    expect(loss.step).toBe(150);
    expect(loss.thickness_um).toBeLessThan(0);
    expect(loss._returned_budget_inventory?.Cu).toBeGreaterThan(0);
    expect(copper.total_growth_um).toBeLessThan(before);
    expect(copper.total_growth_um).toBeGreaterThan(0);
    expect(copper._buried).toBe(true);
    expect(copper.partially_dissolved).toBe(true);
  });

  it('THE CONFLATION FIX: bisbee gold is spongy/dendritic, never nugget; the legacy texture strings are retired from dispatch', () => {
    const au = bisbee().crystals.filter((c: any) => c.mineral === 'native_gold' && !c.dissolved && c.total_growth_um > 0);
    expect(au.length).toBeGreaterThanOrEqual(1);
    for (const c of au) {
      expect(['dendritic', 'octahedral']).toContain(c.habit);
      expect(c.habit).not.toBe('nugget');
    }
    const cu = bisbee().crystals.filter((c: any) => c.mineral === 'native_copper' && c.total_growth_um > 0);
    for (const c of cu) expect(c.habit).not.toBe('massive_sheet');
  });

  it('porphyry gold remains aspirational while its low-saturation habit stays octahedral', () => {
    const sim = runScenario('porphyry');
    const au = sim.crystals.filter((c: any) => c.mineral === 'native_gold' && !c.dissolved && c.total_growth_um > 0);
    // Bingham gold is documented, but the canonical path does not yet build
    // the required bornite-bearing substrate after its copper pulse.  Do not
    // turn that aspirational locality claim into a deterministic test fixture.
    expect(au).toHaveLength(0);
    expect(
      SCENARIOS.porphyry._json5_spec.aspirational_species
        .some((entry: any) => entry.mineral === 'native_gold'),
    ).toBe(true);

    // Keep the independent morphology contract: if a future causal path
    // produces native gold at Bingham's measured low-saturation band, the
    // shared morphology registry identifies a rare octahedral crystal.
    const regime = morphRegime(MORPH_TH.native_gold, 1.35);
    expect(regime).toBe('spiral_smooth');
    expect(morphDisplayLabel('native_gold', regime)).toBe('octahedral (rare crystal)');
  });

  it('copper_morph + gold_morph chips complete the native legend group', () => {
    for (const id of ['copper_morph', 'gold_morph']) {
      const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === id);
      expect(p).toBeTruthy();
      expect(p.system).toBe('native');
    }
  });
});
