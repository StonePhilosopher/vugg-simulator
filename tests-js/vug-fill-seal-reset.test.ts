import { describe, expect, it } from 'vitest';

declare const SCENARIOS: Record<string, () => any>;
declare const VugSimulator: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const setSeed: (seed: number) => void;
declare const _liveRng: () => { state: number; next: () => number };
declare const maxSizeCm: (mineral: string) => number | null;
declare const stoichiometricBudgetDebitPpmPerUm: (species: string, coefficient: number) => number;

function makeSeed42Sim() {
  setSeed(42);
  const { conditions, events } = SCENARIOS.cooling();
  return new VugSimulator(conditions, events);
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
    crystal.active = false; // world-record cap: still a real exposed solid
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
    expect(decay?.dissolutionMode).toBe('low_salinity');
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
