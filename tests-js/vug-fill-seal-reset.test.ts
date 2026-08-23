import { describe, expect, it } from 'vitest';

declare const SCENARIOS: Record<string, () => any>;
declare const VugSimulator: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const setSeed: (seed: number) => void;
declare const _liveRng: () => { state: number; next: () => number };
declare const maxSizeCm: (mineral: string) => number | null;
declare const stoichiometricBudgetDebitPpmPerUm: (species: string, coefficient: number) => number;
declare const currentEnclosureAuthority: (sim: any, guest: any) => any;
declare const StripRecorder: any;

function makeSeed42Sim() {
  setSeed(42);
  const { conditions, events } = SCENARIOS.cooling();
  return new VugSimulator(conditions, events);
}

function acceptedZone(thicknessUm: number, step = 0) {
  const zone = new GrowthZone({
    step,
    thickness_um: thicknessUm,
    growth_rate: thicknessUm,
  });
  zone._time_scaled = true;
  return zone;
}

function installChalcanthite(sim: any, crystal: any, cellIdx = 0) {
  crystal.wall_anchor = sim.wall_state._anchorFromRingCell(0, cellIdx);
  const localFluid = sim.wall_state.meshFor(sim).cellOf(crystal, sim.wall_state).fluid;
  localFluid.sulfurPoolsExplicit = true;
  localFluid.S_sulfate = Number(localFluid.S_sulfate) || 0;
  localFluid.S_sulfide = Number(localFluid.S_sulfide) || 0;
  localFluid.S_elemental = Number(localFluid.S_elemental) || 0;
  localFluid.salinity = 0;
  localFluid.pH = 7;
  sim.conditions.fluid.salinity = 0;
  sim.conditions.fluid.pH = 7;
  return localFluid;
}

describe('vug seal reopening hysteresis', () => {
  it('re-arms only after aggregate open volume exceeds the 5% hysteresis band', () => {
    const sim = makeSeed42Sim();
    sim._vug_sealed = true;

    expect(sim._resetVugSealIfReopened(0.95, false)).toBe(false);
    expect(sim._vug_sealed).toBe(true);
    expect(sim._resetVugSealIfReopened(0.949, false)).toBe(true);
    expect(sim._vug_sealed).toBe(false);
  });

  it('counts capped and buried non-dissolved solids in authoritative fill', () => {
    const sim = makeSeed42Sim();
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 1, habit: 'prismatic' });
    const zone = new GrowthZone({ thickness_um: 1000, growth_rate: 1000 });
    zone._time_scaled = true;
    crystal.add_zone(zone);
    crystal.active = false;
    sim.crystals = [crystal];
    sim.conditions.wall.cavity_capacity_volume_mm3 = crystal._volume_mm3 * 2;

    expect(sim.get_vug_fill()).toBeCloseTo(0.5, 12);
    sim.log = [];
    sim._vug_sealed = false;
    expect(sim._sealVugIfFilled(1)).toBe(true);
    expect(sim.log[0]).toContain('dominant: quartz');
    crystal._buried = true;
    expect(sim.get_vug_fill()).toBeCloseTo(0.5, 12);
    crystal.dissolved = true;
    expect(sim.get_vug_fill()).toBe(0);
  });

  it('re-arms after accepted dissolution and can reseal later in the same step', () => {
    const sim = makeSeed42Sim();
    const dissolver = new Crystal({ mineral: 'quartz', crystal_id: 1, habit: 'prismatic' });
    const refiller = new Crystal({ mineral: 'quartz', crystal_id: 2, habit: 'prismatic' });
    for (const crystal of [dissolver, refiller]) {
      const initial = new GrowthZone({ thickness_um: 10, growth_rate: 10 });
      initial._time_scaled = true;
      crystal.add_zone(initial);
    }
    sim.crystals = [dissolver, refiller];
    sim.check_nucleation = () => {};
    sim._applyGeometricSelection = () => {};
    sim._computeGraduatedZones = () => null;
    sim._applyZoneGrowthBudget = () => null;

    let fill = 1.0;
    const dissolveAdd = dissolver.add_zone.bind(dissolver);
    dissolver.add_zone = (zone: any) => {
      dissolveAdd(zone);
      if (zone.thickness_um < 0) fill = 0.9;
    };
    const refillAdd = refiller.add_zone.bind(refiller);
    refiller.add_zone = (zone: any) => {
      refillAdd(zone);
      if (zone.thickness_um > 0) fill = 1.0;
    };
    sim._runEngineForCrystal = (_engine: any, crystal: any) => {
      const thickness = crystal === dissolver ? -1 : 1;
      const zone = new GrowthZone({ thickness_um: thickness, growth_rate: thickness });
      zone._time_scaled = true;
      return zone;
    };
    sim.get_vug_fill = () => fill;
    sim._vug_sealed = true;

    sim.run_step();

    expect(dissolver.total_growth_um).toBe(9);
    expect(refiller.total_growth_um).toBeGreaterThan(10);
    expect(sim._vug_sealed).toBe(true);
    expect(sim.log.filter((line: string) => line.includes('VUG SEALED'))).toHaveLength(1);
  });

  it('books chalcanthite decay into solid volume and re-arms the seal', () => {
    const sim = makeSeed42Sim();
    const crystal = new Crystal({ mineral: 'chalcanthite', crystal_id: 7, habit: 'prismatic' });
    const zone = new GrowthZone({ thickness_um: 10, growth_rate: 10 });
    zone._time_scaled = true;
    crystal.add_zone(zone);
    // Size caps now suppress only later positive growth through the audited
    // `_size_capped` path; they do not make an exposed solid inactive.  Keep
    // this chalcanthite chemically active so the fixture represents a real
    // pore-fluid-contacting crystal rather than an enclosed inclusion.
    crystal.active = true;
    sim.crystals = [crystal];
    sim.check_nucleation = () => {};
    sim._vug_sealed = true;
    sim.conditions.fluid.salinity = 0;
    sim.conditions.fluid.pH = 7;
    crystal.wall_anchor = sim.wall_state._anchorFromRingCell(0, 0);
    const localFluid = sim.wall_state.meshFor(sim).cellOf(crystal, sim.wall_state).fluid;
    localFluid.sulfurPoolsExplicit = true;
    localFluid.S_sulfate = Number(localFluid.S_sulfate) || 0;
    localFluid.S_sulfide = Number(localFluid.S_sulfide) || 0;
    localFluid.S_elemental = Number(localFluid.S_elemental) || 0;
    const beforeVolume = crystal._volume_mm3;
    let immediateLocalDelta: any = null;
    let immediateBulkDelta: any = null;
    const applyBudget = sim._applyZoneGrowthBudget.bind(sim);
    sim._applyZoneGrowthBudget = (target: any, accepted: any) => {
      const beforeLocal = { Cu: localFluid.Cu, S_sulfate: localFluid.S_sulfate };
      const beforeBulk = { Cu: sim.conditions.fluid.Cu, S: sim.conditions.fluid.S };
      const result = applyBudget(target, accepted);
      immediateLocalDelta = {
        Cu: localFluid.Cu - beforeLocal.Cu,
        S_sulfate: localFluid.S_sulfate - beforeLocal.S_sulfate,
      };
      immediateBulkDelta = {
        Cu: sim.conditions.fluid.Cu - beforeBulk.Cu,
        S: sim.conditions.fluid.S - beforeBulk.S,
      };
      return result;
    };
    // Step start remains inside the hysteresis band. The accepted special
    // decay then moves below it, proving the post-decay refresh (not merely the
    // ordinary step-start check) re-arms the seal.
    sim.get_vug_fill = () => crystal._volume_mm3 < beforeVolume ? 0.5 : 0.96;

    sim.run_step();

    expect(crystal.total_growth_um).toBeCloseTo(6, 12);
    expect(crystal._volume_mm3).toBeCloseTo(beforeVolume * 0.216, 12);
    const decay = crystal.zones[crystal.zones.length - 1];
    expect(decay?.dissolutionMode).toBe('water_solubility_high_pH');
    const expectedCu = 4 * stoichiometricBudgetDebitPpmPerUm('Cu', 1);
    const expectedS = 4 * stoichiometricBudgetDebitPpmPerUm('S', 1);
    expect(decay._returned_budget_inventory.Cu).toBeCloseTo(expectedCu, 12);
    expect(decay._returned_budget_inventory.S_sulfate).toBeCloseTo(expectedS, 12);
    expect(immediateLocalDelta.Cu).toBeCloseTo(expectedCu, 12);
    expect(immediateLocalDelta.S_sulfate).toBeCloseTo(expectedS, 12);
    expect(immediateBulkDelta).toEqual({ Cu: 0, S: 0 });
    expect(sim.get_vug_fill()).toBeLessThan(0.95);
    expect(sim._vug_sealed).toBe(false);
  });

  it('does not let cap, burial, or a stale inactive flag become a solubility shield', () => {
    const cases = [
      { label: 'authored-size cap', growthUm: Number(maxSizeCm('chalcanthite')) * 10000,
        prepare: (_sim: any, _crystal: any) => {} },
      { label: 'growth-front burial', growthUm: 10,
        prepare: (_sim: any, crystal: any) => { crystal._buried = true; } },
      { label: 'bare inactive flag', growthUm: 10,
        prepare: (_sim: any, crystal: any) => { crystal.active = false; } },
    ];

    for (const [index, row] of cases.entries()) {
      const sim = makeSeed42Sim();
      const crystal = new Crystal({
        mineral: 'chalcanthite', crystal_id: 30 + index, habit: 'prismatic',
      });
      crystal.add_zone(acceptedZone(row.growthUm));
      row.prepare(sim, crystal);
      sim.crystals = [crystal];
      sim.check_nucleation = () => {};
      sim._applyGeometricSelection = () => {};
      sim._runEngineForCrystal = () => null;
      sim.get_vug_fill = () => 0.5;
      installChalcanthite(sim, crystal, index + 1);
      expect(currentEnclosureAuthority(sim, crystal), row.label).toBeNull();
      const before = crystal.total_growth_um;

      sim.run_step();

      const decay = crystal.zones[crystal.zones.length - 1];
      const expectedLoss = Math.min(5, before * 0.4);
      expect(before - crystal.total_growth_um, row.label).toBeCloseTo(expectedLoss, 12);
      expect(decay.dissolutionMode, row.label).toBe('water_solubility_low_salinity_high_pH');
      expect(decay._returned_budget_inventory.Cu, row.label).toBeCloseTo(
        expectedLoss * stoichiometricBudgetDebitPpmPerUm('Cu', 1), 12,
      );
      expect(decay._returned_budget_inventory.S_sulfate, row.label).toBeCloseTo(
        expectedLoss * stoichiometricBudgetDebitPpmPerUm('S', 1), 12,
      );
      if (row.label === 'authored-size cap') expect(crystal._size_capped).toBe(true);
    }
  });

  it('withholds low-salinity decay only for a reciprocal authenticated enclosure', () => {
    const sim = makeSeed42Sim();
    sim.step = 9;
    sim.events = [];
    sim.check_nucleation = () => {};
    sim._applyGeometricSelection = () => {};
    sim._runEngineForCrystal = () => null;
    sim.get_vug_fill = () => 0.5;

    const guest = new Crystal({ mineral: 'chalcanthite', crystal_id: 70, habit: 'prismatic' });
    for (const [step, amount] of [[0, 98.5], [1, 0.5], [2, 0.5], [3, 0.5]]) {
      guest.add_zone(acceptedZone(amount, step));
    }
    const host = new Crystal({ mineral: 'calcite', crystal_id: 71, habit: 'rhombohedral' });
    host.add_zone(acceptedZone(400, 9));
    host.add_zone(acceptedZone(1, 10));
    host.active = false;
    const receipt = {
      schema: 'enclosure-receipt-v1', event: 'enclosed', step: 10,
      host_crystal_id: 71, host_mineral: 'calcite',
      guest_crystal_id: 70, guest_mineral: 'chalcanthite',
      route: 'guest-on-host', adjacency_authority: 'exact-substrate-id',
      host_same_step_positive_growth_um: 1,
      host_same_step_negative_growth_um: 0,
      host_same_step_net_growth_um: 1,
      host_physical_size_at_enclosure_um: 401,
      guest_positive_core_um: 100,
      guest_loss_um: 0,
      guest_remaining_growth_um: 100,
      guest_partially_dissolved: false,
      size_ratio: 4.01,
      guest_recent_growth_um: 1.5,
      guest_slowing_threshold_um: 3,
    };
    guest.active = false;
    guest.enclosed_by = host.crystal_id;
    guest.enclosure_receipt = receipt;
    host.enclosed_crystals = [guest.crystal_id];
    host.enclosed_at_step = [10];
    sim.crystals = [guest, host];
    sim._enclosureReceipts = [receipt];
    installChalcanthite(sim, guest, 5);
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest, receipt });

    sim.run_step();

    expect(guest.total_growth_um).toBeCloseTo(100, 12);
    expect(guest.zones).toHaveLength(4);
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest, receipt });
  });

  it('uses the crystal cell rather than contradictory bulk fluid for the decay gate', () => {
    const makeSpatialCase = (id: number) => {
      const sim = makeSeed42Sim();
      const crystal = new Crystal({ mineral: 'chalcanthite', crystal_id: id, habit: 'prismatic' });
      crystal.add_zone(acceptedZone(10));
      crystal._buried = true;
      sim.crystals = [crystal];
      sim.check_nucleation = () => {};
      sim._applyGeometricSelection = () => {};
      sim._runEngineForCrystal = () => null;
      sim.get_vug_fill = () => 0.5;
      const localFluid = installChalcanthite(sim, crystal, id % 12);
      return { sim, crystal, localFluid };
    };

    const locallyStable = makeSpatialCase(81);
    locallyStable.sim.conditions.fluid.salinity = 0;
    locallyStable.sim.conditions.fluid.pH = 7;
    locallyStable.localFluid.salinity = 10;
    locallyStable.localFluid.pH = 3;
    locallyStable.sim.run_step();
    expect(locallyStable.crystal.total_growth_um).toBeCloseTo(10, 12);
    expect(locallyStable.crystal.zones).toHaveLength(1);

    const locallyUnstable = makeSpatialCase(82);
    locallyUnstable.sim.conditions.fluid.salinity = 10;
    locallyUnstable.sim.conditions.fluid.pH = 3;
    locallyUnstable.localFluid.salinity = 0;
    locallyUnstable.localFluid.pH = 7;
    const beforeLocal = {
      Cu: locallyUnstable.localFluid.Cu,
      sulfate: locallyUnstable.localFluid.S_sulfate,
    };
    const beforeBulk = {
      Cu: locallyUnstable.sim.conditions.fluid.Cu,
      S: locallyUnstable.sim.conditions.fluid.S,
    };
    let bookedLocal: any = null;
    let bookedBulk: any = null;
    const applyBudget = locallyUnstable.sim._applyZoneGrowthBudget.bind(locallyUnstable.sim);
    locallyUnstable.sim._applyZoneGrowthBudget = (target: any, accepted: any) => {
      const localBefore = {
        Cu: locallyUnstable.localFluid.Cu,
        sulfate: locallyUnstable.localFluid.S_sulfate,
      };
      const bulkBefore = {
        Cu: locallyUnstable.sim.conditions.fluid.Cu,
        S: locallyUnstable.sim.conditions.fluid.S,
      };
      const result = applyBudget(target, accepted);
      bookedLocal = {
        Cu: locallyUnstable.localFluid.Cu - localBefore.Cu,
        sulfate: locallyUnstable.localFluid.S_sulfate - localBefore.sulfate,
      };
      bookedBulk = {
        Cu: locallyUnstable.sim.conditions.fluid.Cu - bulkBefore.Cu,
        S: locallyUnstable.sim.conditions.fluid.S - bulkBefore.S,
      };
      return result;
    };
    locallyUnstable.sim.run_step();
    const decay = locallyUnstable.crystal.zones.at(-1);
    const expectedCu = 4 * stoichiometricBudgetDebitPpmPerUm('Cu', 1);
    const expectedS = 4 * stoichiometricBudgetDebitPpmPerUm('S', 1);
    expect(decay.dissolutionMode).toBe('water_solubility_low_salinity_high_pH');
    expect(decay.note).toContain('local salinity 0.0, local pH 7.0');
    expect(decay._returned_budget_inventory.Cu).toBeCloseTo(expectedCu, 12);
    expect(decay._returned_budget_inventory.S_sulfate).toBeCloseTo(expectedS, 12);
    expect(bookedLocal.Cu).toBeCloseTo(expectedCu, 12);
    expect(bookedLocal.sulfate).toBeCloseTo(expectedS, 12);
    expect(bookedBulk).toEqual({ Cu: 0, S: 0 });
    // End-of-step diffusion may redistribute the local return, but it must not
    // be silently credited to the bulk handle used only as a gate control.
    expect(locallyUnstable.localFluid.Cu).toBeGreaterThan(beforeLocal.Cu);
    expect(locallyUnstable.localFluid.S_sulfate).toBeGreaterThan(beforeLocal.sulfate);
    expect(locallyUnstable.sim.conditions.fluid.Cu - beforeBulk.Cu).toBe(0);
    expect(locallyUnstable.sim.conditions.fluid.S - beforeBulk.S).toBe(0);
  });

  it('records salinity-only, pH-only, combined, and absent water-solubility triggers truthfully', () => {
    const controls = [
      { salinity: 0, pH: 3, mode: 'water_solubility_low_salinity' },
      { salinity: 10, pH: 7, mode: 'water_solubility_high_pH' },
      { salinity: 0, pH: 7, mode: 'water_solubility_low_salinity_high_pH' },
      { salinity: 10, pH: 3, mode: null },
    ];
    for (const [index, control] of controls.entries()) {
      const sim = makeSeed42Sim();
      const crystal = new Crystal({
        mineral: 'chalcanthite', crystal_id: 90 + index, habit: 'prismatic',
      });
      crystal.add_zone(acceptedZone(10));
      sim.crystals = [crystal];
      sim.check_nucleation = () => {};
      sim._applyGeometricSelection = () => {};
      sim._runEngineForCrystal = () => null;
      sim.get_vug_fill = () => 0.5;
      const localFluid = installChalcanthite(sim, crystal, index + 8);
      // Hold bulk at the opposite stable chemistry so this remains a local
      // trigger test instead of accidentally exercising the fallback.
      sim.conditions.fluid.salinity = 10;
      sim.conditions.fluid.pH = 3;
      localFluid.salinity = control.salinity;
      localFluid.pH = control.pH;
      const recorder = new StripRecorder(sim, { duration_steps: 1, angular_indices: 1 });

      sim.run_step();
      recorder.captureStep(sim);
      const strip = recorder.finalize();
      const recordedLosses = strip.layer_growth_testimony.filter((row: any) =>
        row.crystal_id === crystal.crystal_id && row.thickness_um < 0);

      if (control.mode == null) {
        expect(crystal.total_growth_um).toBeCloseTo(10, 12);
        expect(crystal.zones).toHaveLength(1);
        expect(recordedLosses).toEqual([]);
      } else {
        const decay = crystal.zones.at(-1);
        expect(crystal.total_growth_um).toBeCloseTo(6, 12);
        expect(decay.dissolutionMode).toBe(control.mode);
        expect(recordedLosses).toHaveLength(1);
        expect(recordedLosses[0].dissolution_mode).toBe(control.mode);
        expect(decay.note).toContain(
          `local salinity ${control.salinity.toFixed(1)}, local pH ${control.pH.toFixed(1)}`,
        );
      }
    }
  });

  it('lets an authored-size-capped fluorite dissolve and return local inventory', () => {
    const sim = makeSeed42Sim();
    const capCm = maxSizeCm('fluorite');
    expect(capCm).not.toBeNull();
    const capUm = Number(capCm) * 10000;
    const crystal = new Crystal({ mineral: 'fluorite', crystal_id: 11, habit: 'cubic' });
    const initial = new GrowthZone({ thickness_um: capUm, growth_rate: capUm });
    initial._time_scaled = true;
    crystal.add_zone(initial);
    crystal.wall_anchor = sim.wall_state._anchorFromRingCell(0, 1);
    sim.crystals = [crystal];
    sim.check_nucleation = () => {};
    sim._applyGeometricSelection = () => {};
    sim.get_vug_fill = () => 0.5;

    const localFluid = sim.wall_state.meshFor(sim).cellOf(crystal, sim.wall_state).fluid;
    localFluid.pH = 1;
    localFluid.Ca = 0;
    localFluid.F = 0;
    let localReturn: any = null;
    const applyBudget = sim._applyZoneGrowthBudget.bind(sim);
    sim._applyZoneGrowthBudget = (target: any, accepted: any) => {
      const before = { Ca: localFluid.Ca, F: localFluid.F };
      const result = applyBudget(target, accepted);
      if (accepted.thickness_um < 0) {
        localReturn = { Ca: localFluid.Ca - before.Ca, F: localFluid.F - before.F };
      }
      return result;
    };
    const beforeVolume = crystal._volume_mm3;

    sim.run_step();

    const dissolution = crystal.zones[crystal.zones.length - 1];
    expect(crystal._size_capped).toBe(true);
    expect(crystal.active).toBe(true);
    expect(crystal.dissolved).toBe(false);
    expect(dissolution.thickness_um).toBeLessThan(0);
    expect(crystal.total_growth_um).toBeLessThan(capUm);
    expect(crystal._volume_mm3).toBeLessThan(beforeVolume);
    expect(localReturn.Ca).toBeCloseTo(dissolution._returned_budget_inventory.Ca, 12);
    expect(localReturn.F).toBeCloseTo(dissolution._returned_budget_inventory.F, 12);
    expect(localReturn.Ca).toBeGreaterThan(0);
    expect(localReturn.F).toBeGreaterThan(0);
  });

  it('consumes a full-fill graduated negative zone once without RNG drift', () => {
    const sim = makeSeed42Sim();
    const capUm = Number(maxSizeCm('quartz')) * 10000;
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 31, habit: 'prismatic' });
    const initial = new GrowthZone({ thickness_um: capUm, growth_rate: capUm });
    initial._time_scaled = true;
    crystal.add_zone(initial);
    crystal._size_capped = true;
    sim.crystals = [crystal];
    sim.check_nucleation = () => {};
    sim._applyGeometricSelection = () => {};
    sim._vug_sealed = true;

    const storedNegative = new GrowthZone({ thickness_um: -2, growth_rate: -2 });
    storedNegative._time_scaled = true;
    let engineCalls = 0;
    let stateAfterPassOne = 0;
    let stateAtAcceptance = 0;
    sim._computeGraduatedZones = () => {
      engineCalls++;
      _liveRng().next();
      stateAfterPassOne = _liveRng().state;
      return new Map([[crystal.crystal_id, storedNegative]]);
    };
    sim._runEngineForCrystal = () => {
      engineCalls++;
      _liveRng().next();
      const wrongSecondZone = new GrowthZone({ thickness_um: -9, growth_rate: -9 });
      wrongSecondZone._time_scaled = true;
      return wrongSecondZone;
    };
    sim._applyZoneGrowthBudget = () => {
      stateAtAcceptance = _liveRng().state;
      return null;
    };
    let fill = 1;
    sim.get_vug_fill = () => fill;
    const addZone = crystal.add_zone.bind(crystal);
    crystal.add_zone = (zone: any) => {
      addZone(zone);
      fill = 0.9;
    };

    sim.run_step();

    expect(engineCalls).toBe(1);
    expect(stateAtAcceptance).toBe(stateAfterPassOne);
    expect(crystal.zones[crystal.zones.length - 1]).toBe(storedNegative);
    expect(crystal.total_growth_um).toBe(capUm - 2);
  });

  it('lets a dissolution-opened cavity emit a later seal transition again', () => {
    const sim = makeSeed42Sim();
    sim.crystals = [];
    sim.check_nucleation = () => {};
    sim._vug_sealed = true;
    sim.get_vug_fill = () => 0.9;

    sim.run_step();
    expect(sim._vug_sealed).toBe(false);

    sim.get_vug_fill = () => 1.0;
    sim.run_step();
    expect(sim._vug_sealed).toBe(true);
    expect(sim.log.filter((line: string) => line.includes('VUG SEALED'))).toHaveLength(1);
  });
});
