import { afterEach, beforeEach, describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const VugWall: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const MINERAL_ENGINES: Record<string, Function>;
declare function getSimulationTimeScale(): number;
declare function setSimulationTimeScale(scale: number): number;
declare function setGraduatedCompetitionEnabled(value: boolean): void;
declare function stoichiometricBudgetDebitPpmPerUm(species: string, coefficient: number): number;
declare const STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE: {
  kind: string;
  basis: string;
  preserves: string;
  limitation: string;
  is_physical_mass_conservation: boolean;
};

const formulaDebit = (species: string, coefficient = 1) =>
  stoichiometricBudgetDebitPpmPerUm(species, coefficient);
let originalEngine: Function;
let originalTimeScale: number;

function makeSimulator(
  rawThickness: number,
  diameterMm = 100,
  fluidOverrides: Record<string, number> = {},
) {
  const fluid = new FluidChemistry({
    Zn: 1000, S: 1000, Fe: 1, Ge: 0, O2: 0.1, pH: 6.5, salinity: 10,
    ...fluidOverrides,
  });
  const conditions = new VugConditions({
    fluid,
    wall: new VugWall({ vug_diameter_mm: diameterMm }),
    temperature: 180,
    pressure_bars: 1,
  });
  const sim = new VugSimulator(conditions, []);
  const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 1, habit: 'prismatic' });
  sim.crystals = [crystal];
  sim.check_nucleation = () => {};
  const applyAcceptedBudget = sim._applyZoneGrowthBudget.bind(sim);
  sim._ledgerCalls = [];
  sim._applyZoneGrowthBudget = (acceptedCrystal: any, acceptedZone: any) => {
    const before = { Zn: sim.conditions.fluid.Zn, S: sim.conditions.fluid.S };
    const result = applyAcceptedBudget(acceptedCrystal, acceptedZone);
    sim._ledgerCalls.push({
      thickness_um: acceptedZone.thickness_um,
      Zn: before.Zn - sim.conditions.fluid.Zn,
      S: before.S - sim.conditions.fluid.S,
    });
    return result;
  };
  MINERAL_ENGINES.sphalerite = (_crystal: any, c: any, step: number) => new GrowthZone({
    step,
    temperature: c.temperature,
    thickness_um: rawThickness,
    growth_rate: rawThickness,
    note: 'controlled growth-budget fixture',
    ...(rawThickness < 0 ? { dissolutionMode: 'oxidative' } : {}),
  });
  return { sim, crystal, fluid };
}

function makeFluoriteSimulator(
  fluidParams: Record<string, number>,
  sigma: number,
  existingGrowthUm = 0,
) {
  const fluid = new FluidChemistry({
    Ca: 5000, F: 80, Y: 0, Fe: 0, Mn: 0,
    O2: 0.1, pH: 7, salinity: 10,
    ...fluidParams,
  });
  const conditions = new VugConditions({
    fluid,
    wall: new VugWall({
      vug_diameter_mm: 10000,
      composition: 'granite',
      reactivity: 0,
    }),
    temperature: 150,
    pressure_bars: 1,
  });
  conditions.supersaturation_fluorite = () => sigma;
  const sim = new VugSimulator(conditions, []);
  const crystal = new Crystal({
    mineral: 'fluorite', crystal_id: 7, habit: 'preexisting',
    dominant_forms: ['preexisting form'],
  });
  if (existingGrowthUm > 0) {
    const preexisting = new GrowthZone({
      step: 0, temperature: 150, thickness_um: existingGrowthUm,
      growth_rate: existingGrowthUm, note: 'preexisting fixture shell',
    });
    preexisting._time_scaled = true;
    crystal.add_zone(preexisting);
  }
  sim.crystals = [crystal];
  sim.check_nucleation = () => {};
  return { sim, crystal, fluid, conditions };
}

function makeRealMineralSimulator(
  mineral: string,
  fluidParams: Record<string, number>,
  temperature: number,
) {
  const fluid = new FluidChemistry({
    pH: 7, O2: 0.1, salinity: 5,
    ...fluidParams,
  });
  const conditions = new VugConditions({
    fluid,
    wall: new VugWall({
      vug_diameter_mm: 10000,
      composition: 'granite',
      reactivity: 0,
    }),
    temperature,
    pressure_bars: 1,
  });
  const sim = new VugSimulator(conditions, []);
  const crystal = new Crystal({ mineral, crystal_id: 19, habit: 'fixture' });
  sim.crystals = [crystal];
  sim.check_nucleation = () => {};
  return { sim, crystal, fluid, conditions };
}

function remainingInventory(crystal: any, species: string): number {
  return (crystal.zones || [])
    .filter((zone: any) => zone.thickness_um > 0)
    .reduce((sum: number, zone: any) => {
      const remaining = Number.isFinite(zone._remaining_solid_um)
        ? Math.max(0, zone._remaining_solid_um)
        : zone.thickness_um;
      return sum + remaining * Number(zone._budget_inventory_per_um?.[species] || 0);
    }, 0);
}

function applyRealEngineOnce(sim: any, crystal: any, mineral: string) {
  const zone = sim._runEngineForCrystal(MINERAL_ENGINES[mineral], crystal);
  sim.step += 1;
  if (!zone) return null;
  sim._finalizeZoneForApplication(crystal, zone);
  if (!zone.thickness_um) return null;
  sim._applyZoneGrowthBudget(crystal, zone);
  crystal.add_zone(zone);
  return zone;
}

beforeEach(() => {
  originalEngine = MINERAL_ENGINES.sphalerite;
  originalTimeScale = getSimulationTimeScale();
  setGraduatedCompetitionEnabled(false);
});

afterEach(() => {
  MINERAL_ENGINES.sphalerite = originalEngine;
  setSimulationTimeScale(originalTimeScale);
  setGraduatedCompetitionEnabled(true);
});

describe('accepted-zone stoichiometric growth-budget closure', () => {
  it('discloses the fixed axial calibration and its non-extensive physical boundary', () => {
    expect(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE).toMatchObject({
      kind: 'calibrated stoichiometric axial-growth budget proxy',
      is_physical_mass_conservation: false,
    });
    expect(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.basis).toContain('per accepted axial micrometre');
    expect(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.preserves).toContain('booked inventory');
    expect(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation)
      .toContain('independent of crystal size, habit, density, and rendered shell volume');

    const small = makeRealMineralSimulator('calcite', { Ca: 100, CO3: 100 }, 100);
    const large = makeRealMineralSimulator('calcite', { Ca: 100, CO3: 100 }, 100);
    const preexisting = new GrowthZone({
      step: 0, temperature: 100, thickness_um: 500, growth_rate: 500,
    });
    preexisting._time_scaled = true;
    large.crystal.add_zone(preexisting);
    expect(large.crystal._volume_mm3).toBeGreaterThan(small.crystal._volume_mm3);

    for (const fixture of [small, large]) {
      const zone = new GrowthZone({
        step: 1, temperature: 100, thickness_um: 10, growth_rate: 10,
      });
      zone._time_scaled = true;
      fixture.sim._applyZoneGrowthBudget(fixture.crystal, zone);
    }
    expect(100 - small.fluid.Ca).toBeCloseTo(100 - large.fluid.Ca, 12);
    expect(100 - small.fluid.CO3).toBeCloseTo(100 - large.fluid.CO3, 12);
  });

  it('converts formula mole ratios to mg/kg and preserves CaCO3 molar stoichiometry', () => {
    const { sim, crystal, fluid } = makeRealMineralSimulator(
      'calcite',
      { Ca: 100, CO3: 100, Mn: 0, Fe: 0 },
      100,
    );
    const zone = new GrowthZone({
      step: 1, temperature: 100, thickness_um: 10, growth_rate: 10,
    });
    zone._time_scaled = true;
    const before = { Ca: fluid.Ca, CO3: fluid.CO3 };
    sim._applyZoneGrowthBudget(crystal, zone);
    const caDebit = before.Ca - fluid.Ca;
    const carbonateDebit = before.CO3 - fluid.CO3;
    expect(caDebit).toBeCloseTo(10 * formulaDebit('Ca'), 12);
    expect(carbonateDebit).toBeCloseTo(10 * formulaDebit('CO3'), 12);
    expect(caDebit / 40.08).toBeCloseTo(carbonateDebit / 60.01, 12);
    expect(zone._budget_inventory_per_um.Ca / 40.08)
      .toBeCloseTo(zone._budget_inventory_per_um.CO3 / 60.01, 12);
  });

  it('shrinks the whole formula amount when one major reservoir is limiting', () => {
    const { sim, crystal, fluid } = makeRealMineralSimulator(
      'calcite',
      { Ca: formulaDebit('Ca') * 2, CO3: 100, Mn: 0, Fe: 0 },
      100,
    );
    const zone = new GrowthZone({
      step: 1, temperature: 100, thickness_um: 10, growth_rate: 10,
    });
    zone._time_scaled = true;
    const beforeCO3 = fluid.CO3;
    sim._applyZoneGrowthBudget(crystal, zone);
    expect(zone.thickness_um).toBeCloseTo(2, 12);
    expect(zone.growth_rate).toBeCloseTo(2, 12);
    expect(zone._stoichiometric_budget_cap.limiting_species).toBe('Ca');
    expect(fluid.Ca).toBeCloseTo(0, 12);
    expect(beforeCO3 - fluid.CO3).toBeCloseTo(2 * formulaDebit('CO3'), 12);
  });

  it('does not append a shell when a mandatory formula reservoir is dry', () => {
    setSimulationTimeScale(1);
    const { sim, crystal, fluid } = makeSimulator(10, 100, { Zn: 0 });
    for (const ringFluid of sim.ring_fluids) ringFluid.Zn = 0;
    const mesh = sim.wall_state.meshFor(sim);
    for (const cell of mesh.cells) cell.fluid.Zn = 0;
    const beforeS = fluid.S;
    sim.run_step();
    expect(crystal.zones).toHaveLength(0);
    expect(crystal.total_growth_um).toBe(0);
    expect(fluid.Zn).toBe(0);
    expect(fluid.S).toBe(beforeS);
  });

  for (const scale of [1, 5]) {
    it(`debits the exact applied ZnS thickness at timeScale=${scale}`, () => {
      setSimulationTimeScale(scale);
      const { sim, crystal, fluid } = makeSimulator(10);
      const beforeZn = fluid.Zn;
      const beforeS = fluid.S;
      sim.run_step();
      const applied = crystal.zones.at(-1).thickness_um;
      expect(applied).toBeCloseTo(10 * scale, 12);
      expect(sim._ledgerCalls).toHaveLength(1);
      expect(sim._ledgerCalls[0].thickness_um).toBeCloseTo(applied, 12);
      expect(sim._ledgerCalls[0].Zn).toBeCloseTo(applied * formulaDebit('Zn'), 12);
      expect(sim._ledgerCalls[0].S).toBeCloseTo(applied * formulaDebit('S'), 12);
      expect(beforeZn - fluid.Zn).toBeCloseTo(applied * formulaDebit('Zn'), 12);
      expect(beforeS - fluid.S).toBeCloseTo(applied * formulaDebit('S'), 12);
      expect((beforeZn - fluid.Zn) / 65.38).toBeCloseTo((beforeS - fluid.S) / 32.07, 12);
      expect(crystal.total_growth_um).toBeCloseTo(applied, 12);
    });
  }

  it('charges the dampened thickness, not the engine candidate', () => {
    setSimulationTimeScale(5);
    const { sim, crystal, fluid } = makeSimulator(10);
    sim.get_vug_fill = () => 0.9;
    const before = fluid.Zn;
    sim.run_step();
    const applied = crystal.zones.at(-1).thickness_um;
    expect(applied).toBeGreaterThan(0);
    expect(applied).toBeLessThan(50);
    expect(before - fluid.Zn).toBeCloseTo(applied * formulaDebit('Zn'), 12);
  });

  it('rolls legacy engine chemistry into the accepted-zone transaction without double-booking formula species', () => {
    setSimulationTimeScale(5);
    const { sim, crystal, fluid } = makeSimulator(10);
    MINERAL_ENGINES.sphalerite = (_crystal: any, c: any, step: number) => {
      // Representative legacy engine behavior: direct major-species debits
      // plus a non-stoichiometric redox reaction term.
      c.fluid.Zn = Math.max(0, c.fluid.Zn - 8);
      c.fluid.S = Math.max(0, c.fluid.S - 4);
      c.fluid.O2 = Math.max(0, c.fluid.O2 - 0.01);
      return new GrowthZone({
        step, temperature: c.temperature,
        thickness_um: 10, growth_rate: 10,
        note: 'legacy direct-debit fixture',
      });
    };
    const before = { Zn: fluid.Zn, S: fluid.S, O2: fluid.O2 };
    sim.run_step();
    const applied = crystal.zones.at(-1).thickness_um;
    expect(applied).toBe(50);
    // Zn and S are formula species: only the canonical ZnS ledger applies.
    expect(before.Zn - fluid.Zn).toBeCloseTo(applied * formulaDebit('Zn'), 12);
    expect(before.S - fluid.S).toBeCloseTo(applied * formulaDebit('S'), 12);
    // O2 is an explicit reaction proxy outside the stoichiometric ledger and
    // scales from the 10-µm candidate to the accepted 50-µm zone.
    expect(before.O2 - fluid.O2).toBeCloseTo(0.05, 12);
  });

  it('restores fluid immediately after a graduated-competition dry run', () => {
    setSimulationTimeScale(5);
    const { sim, crystal, fluid } = makeSimulator(10);
    const before = { Zn: fluid.Zn, S: fluid.S, O2: fluid.O2 };
    const engine = (_crystal: any, c: any, step: number) => {
      c.fluid.Zn -= 8;
      c.fluid.S -= 4;
      c.fluid.O2 -= 0.01;
      return new GrowthZone({ step, temperature: c.temperature, thickness_um: 10, growth_rate: 10 });
    };
    const candidate = sim._dryRunEngineForCrystal(engine, crystal);
    expect(candidate._engine_fluid_delta_per_candidate_um).toBeTruthy();
    expect({ Zn: fluid.Zn, S: fluid.S, O2: fluid.O2 }).toEqual(before);
  });

  it('rations the time-scaled physical thickness under production graduated competition', () => {
    setSimulationTimeScale(5);
    setGraduatedCompetitionEnabled(true);
    const { sim, crystal, fluid } = makeSimulator(10, 100, { Zn: 0.02, S: 0.02 });
    // Keep initiative non-zero while the fixture engine supplies the controlled
    // 10-um raw candidate. The production allocator must budget the 50-um
    // physical candidate that finalization would otherwise accept.
    sim.conditions.supersaturation_sphalerite = () => 2;
    const before = { Zn: fluid.Zn, S: fluid.S };

    sim.run_step();

    const accepted = crystal.zones.at(-1);
    const zincLimitedThickness = before.Zn / formulaDebit('Zn');
    expect(accepted.thickness_um).toBeCloseTo(zincLimitedThickness, 12);
    expect(accepted.growth_rate).toBeCloseTo(zincLimitedThickness, 12);
    expect(before.Zn - fluid.Zn).toBeCloseTo(accepted.thickness_um * formulaDebit('Zn'), 12);
    expect(before.S - fluid.S).toBeCloseTo(accepted.thickness_um * formulaDebit('S'), 12);
    expect(accepted._budget_inventory_per_um.Zn).toBeCloseTo(formulaDebit('Zn'), 12);
    expect(accepted._budget_inventory_per_um.S).toBeCloseTo(formulaDebit('S'), 12);
    expect(crystal.total_growth_um * formulaDebit('Zn')).toBeLessThanOrEqual(before.Zn + 1e-12);
  });

  it('rolls back real-engine crystal mutations when competition rations a candidate to zero', () => {
    setSimulationTimeScale(5);
    setGraduatedCompetitionEnabled(true);
    const { sim, crystal, fluid } = makeFluoriteSimulator(
      { Ca: 0, F: 0, Y: 10 },
      2,
      10,
    );
    const zonesBefore = crystal.zones.length;

    sim.run_step();

    expect(crystal.zones).toHaveLength(zonesBefore);
    expect(crystal.total_growth_um).toBe(10);
    expect(crystal.habit).toBe('preexisting');
    expect(crystal.dominant_forms).toEqual(['preexisting form']);
    expect(crystal._ree_substitution).toBeUndefined();
    expect(crystal._photobleachable_color).toBeUndefined();
    expect(fluid.Y).toBe(10);
    expect(sim.log.some((line: string) => line.includes('edge-of-gate skip'))).toBe(true);
  });

  it('records only available Y uptake and returns exactly that inventory on real fluorite dissolution', () => {
    setSimulationTimeScale(5);
    setGraduatedCompetitionEnabled(true);
    const { sim, crystal, fluid, conditions } = makeFluoriteSimulator(
      { Ca: 5000, F: 80, Y: 1.1, pH: 7 },
      100,
    );
    const initialY = fluid.Y;

    sim.run_step();

    const growth = crystal.zones.at(-1);
    expect(growth.thickness_um).toBeGreaterThan(1100);
    expect(fluid.Y).toBe(0);
    expect(growth._supplement_uptake_limited.Y.requested).toBeGreaterThan(initialY);
    expect(growth._supplement_uptake_limited.Y.actual).toBeCloseTo(initialY, 12);
    expect(growth._budget_inventory_per_um.Y * growth.thickness_um).toBeCloseTo(initialY, 12);

    conditions.supersaturation_fluorite = () => 0;
    for (let i = 0; i < 200 && crystal.active; i++) {
      // Keep every fluid view acidic; the simulator's zoned-fluid
      // equilibration otherwise relaxes the bulk fixture toward its ring clones.
      fluid.pH = 3;
      for (const ringFluid of sim.ring_fluids) ringFluid.pH = 3;
      sim.run_step();
    }

    expect(crystal.active).toBe(false);
    expect(crystal.dissolved).toBe(true);
    expect(crystal.total_growth_um).toBe(0);
    expect(fluid.Y).toBeCloseTo(initialY, 10);
  });

  it('keeps real arsenopyrite fluid Au plus remaining solid Au constant through repeated oxidation', () => {
    setSimulationTimeScale(1);
    const { sim, crystal, fluid, conditions } = makeRealMineralSimulator(
      'arsenopyrite',
      { Fe: 5000, As: 5000, S: 5000, Au: 1, Co: 0, pH: 6.5, O2: 0.1 },
      300,
    );
    const initialAu = fluid.Au;
    conditions.supersaturation_arsenopyrite = () => 3;
    applyRealEngineOnce(sim, crystal, 'arsenopyrite');

    const growth = crystal.zones.at(-1);
    expect(growth.thickness_um).toBeGreaterThan(3);
    expect(growth._budget_inventory_per_um.Au).toBeGreaterThan(0);
    expect(fluid.Au + remainingInventory(crystal, 'Au')).toBeCloseTo(initialAu, 12);

    conditions.supersaturation_arsenopyrite = () => 0;
    fluid.O2 = 2;
    for (let i = 0; i < 200 && crystal.active; i++) {
      applyRealEngineOnce(sim, crystal, 'arsenopyrite');
      const totalAu = fluid.Au + remainingInventory(crystal, 'Au');
      expect(totalAu, `Au closure after dissolution step ${i}`).toBeCloseTo(initialAu, 11);
      expect(fluid.Au).toBeLessThanOrEqual(initialAu + 1e-11);
    }
    expect(crystal.active).toBe(false);
    expect(remainingInventory(crystal, 'Au')).toBeCloseTo(0, 12);
    expect(fluid.Au).toBeCloseTo(initialAu, 11);
    const returnedNotes = crystal.zones.filter((zone: any) => zone.thickness_um < 0 && zone.note.includes('remaining solid inventory'));
    expect(returnedNotes.length).toBeGreaterThan(0);
  });

  it('converts calcite solid trace ppm to atoms/formula and closes Ca/CO3/Mn/Fe on repeated acid dissolution', () => {
    setSimulationTimeScale(1);
    const { sim, crystal, fluid, conditions } = makeRealMineralSimulator(
      'calcite',
      { Ca: 5000, CO3: 5000, Mn: 100, Fe: 10, Mg: 0, pH: 8, O2: 0.1 },
      100,
    );
    const species = ['Ca', 'CO3', 'Mn', 'Fe'];
    const initial = Object.fromEntries(species.map(name => [name, fluid[name]]));
    conditions.supersaturation_calcite = () => 5;
    applyRealEngineOnce(sim, crystal, 'calcite');

    const growth = crystal.zones.at(-1);
    expect(growth.thickness_um).toBeGreaterThan(5);
    expect(growth.trace_stoichiometry.Mn).toBeCloseTo(
      growth.trace_Mn * 1e-6 * (100.0869 / 54.938044),
      15,
    );
    expect(growth.trace_stoichiometry.Fe).toBeCloseTo(
      growth.trace_Fe * 1e-6 * (100.0869 / 55.845),
      15,
    );
    for (const name of species) {
      expect(fluid[name] + remainingInventory(crystal, name), `${name} after growth`).toBeCloseTo(initial[name], 10);
    }

    conditions.supersaturation_calcite = () => 0;
    fluid.pH = 4;
    for (let i = 0; i < 200 && crystal.active; i++) {
      applyRealEngineOnce(sim, crystal, 'calcite');
      for (const name of species) {
        expect(
          fluid[name] + remainingInventory(crystal, name),
          `${name} closure after dissolution step ${i}`,
        ).toBeCloseTo(initial[name], 9);
      }
    }
    expect(crystal.active).toBe(false);
    for (const name of species) {
      expect(remainingInventory(crystal, name), `${name} remaining solid`).toBeCloseTo(0, 12);
      expect(fluid[name], `${name} final fluid`).toBeCloseTo(initial[name], 9);
    }
  });

  it('charges the cavity-clamped thickness, not the oversized candidate', () => {
    setSimulationTimeScale(5);
    const { sim, crystal, fluid } = makeSimulator(1000, 0.1);
    const before = fluid.Zn;
    sim.run_step();
    const applied = crystal.zones.at(-1).thickness_um;
    expect(applied).toBeGreaterThan(0);
    expect(applied).toBeLessThan(5000);
    expect(crystal.late_interlocking).toBe(true);
    expect(before - fluid.Zn).toBeCloseTo(applied * formulaDebit('Zn'), 10);
    expect(sim.get_vug_fill()).toBeCloseTo(1, 9);
  });

  it('returns the exact accepted Zn:S inventory on partial and complete dissolution', () => {
    setSimulationTimeScale(5);
    const { sim, crystal, fluid } = makeSimulator(10);
    sim.run_step();
    const grown = crystal.total_growth_um;
    const afterGrowthZn = fluid.Zn;
    const afterGrowthS = fluid.S;

    MINERAL_ENGINES.sphalerite = (_crystal: any, c: any, step: number) => new GrowthZone({
      step,
      temperature: c.temperature,
      thickness_um: -2,
      growth_rate: -2,
      dissolutionMode: 'oxidative',
      note: 'controlled partial etch',
    });
    sim.run_step();
    const partial = -crystal.zones.at(-1).thickness_um;
    expect(partial).toBe(10);
    expect(fluid.Zn - afterGrowthZn).toBeCloseTo(partial * formulaDebit('Zn'), 12);
    expect(fluid.S - afterGrowthS).toBeCloseTo(partial * formulaDebit('S'), 12);
    expect(crystal.dissolved).toBe(false);
    expect(crystal.active).toBe(true);

    const beforeFinalZn = fluid.Zn;
    const beforeFinalS = fluid.S;
    MINERAL_ENGINES.sphalerite = (_crystal: any, c: any, step: number) => new GrowthZone({
      step,
      temperature: c.temperature,
      thickness_um: -1000,
      growth_rate: -1000,
      dissolutionMode: 'oxidative',
      note: 'controlled total etch',
    });
    sim.run_step();
    const finalRemoval = -crystal.zones.at(-1).thickness_um;
    expect(finalRemoval).toBeCloseTo(grown - partial, 12);
    expect(fluid.Zn - beforeFinalZn).toBeCloseTo(finalRemoval * formulaDebit('Zn'), 12);
    expect(fluid.S - beforeFinalS).toBeCloseTo(finalRemoval * formulaDebit('S'), 12);
    expect(crystal.total_growth_um).toBe(0);
    expect(crystal.dissolved).toBe(true);
    expect(crystal.active).toBe(false);
  });

  it('consumes and credits a sub-resolution solid remainder exactly', () => {
    setSimulationTimeScale(1);
    const { sim, crystal, fluid } = makeSimulator(6);
    sim.run_step();
    const afterGrowth = { Zn: fluid.Zn, S: fluid.S };
    MINERAL_ENGINES.sphalerite = (_crystal: any, c: any, step: number) => new GrowthZone({
      step,
      temperature: c.temperature,
      thickness_um: -2,
      growth_rate: -2,
      dissolutionMode: 'oxidative',
      note: 'resolution-floor fixture',
    });
    sim.run_step();
    const removal = -crystal.zones.at(-1).thickness_um;
    expect(removal).toBe(6);
    expect(fluid.Zn - afterGrowth.Zn).toBeCloseTo(removal * formulaDebit('Zn'), 12);
    expect(fluid.S - afterGrowth.S).toBeCloseTo(removal * formulaDebit('S'), 12);
    expect(crystal.total_growth_um).toBe(0);
    expect(crystal.dissolved).toBe(true);
  });
});
