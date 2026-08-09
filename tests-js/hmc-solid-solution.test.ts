import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const MINERAL_ENGINES: Record<string, Function>;
declare const SCENARIOS: Record<string, Function>;
declare const setSeed: (seed: number) => void;
declare const hmcCompositionFromFluid: (fluid: any, T: number) => any;
declare const hmcSolidSolutionAssessment: (x: number, T: number) => any;
declare const applyStoichiometricGrowthBudget: (crystal: any, zone: any, conditions: any) => any;
declare const _buildMineralFormationExplanation: (name: string, c: any, sim?: any, sigma?: number) => any;
declare const _renderFortressSigmaGroups: (c: any, host: HTMLElement) => void;
declare const _nuc_HMC: (sim: any) => void;

function diagnosticGroup(explanation: any, label: string): any {
  const group = explanation.groups.find((candidate: any) => candidate.label === label);
  expect(group, `missing ${label} diagnostic`).toBeDefined();
  return group;
}

describe('HMC measured partition and subregular solid activities', () => {
  it('nucleates from a covered local fluid even when the bulk parent is outside the partition domain', () => {
    setSeed(42);
    const bulk = new VugConditions({
      temperature: 18,
      fluid: new FluidChemistry({ Ca: 2000, Mg: 1500, CO3: 2200, pH: 8.4, salinity: 5 }),
    });
    const sim = new VugSimulator(bulk, []);
    const mesh = sim.wall_state.meshFor(sim), grid = sim.wall_state.voxelGridFor(sim);
    const target = { ringIdx: 6, cellIdx: 31 };
    const local = mesh.cells[target.ringIdx * sim.wall_state.cells_per_ring + target.cellIdx].fluid;
    Object.assign(local, { Ca: 400.78, Mg: 1263.86, CO3: 5000, pH: 8, salinity: 35 });
    grid.boundaryVoxel(target.ringIdx, target.cellIdx).temperature = 25;
    sim._thermalFieldActivated = true;
    _nuc_HMC(sim);
    const hmc = sim.crystals.find((crystal: any) => crystal.mineral === 'HMC');
    expect(hmc).toBeTruthy();
    expect(hmc.wall_anchor).toMatchObject(target);
    expect(hmc._hmc_nucleation_composition).toMatchObject({
      compositionDomainSupported: true,
      compositionDomainStatus: 'standard_seawater_ratio_salinity_proxy',
    });
    expect(hmc._mg_content).toBeCloseTo(
      hmc._hmc_nucleation_composition.mgMoleFraction, 12,
    );
  });

  it('uses molar Mg/Ca and the three measured Mucci temperature anchors', () => {
    // Standard-seawater-like molar Mg/Ca and salinity: the bounded domain
    // of Mucci's three-temperature series.
    const seawater = new FluidChemistry({ Ca: 400.78, Mg: 1263.86, CO3: 200, pH: 8, salinity: 35 });
    const at5 = hmcCompositionFromFluid(seawater, 5);
    const at25 = hmcCompositionFromFluid(seawater, 25);
    const at40 = hmcCompositionFromFluid(seawater, 40);
    expect(at25.aqueousMgCaMolarRatio).toBeCloseTo(5.2, 4);
    expect(at5.distributionCoefficient).toBeCloseTo(0.0121, 8);
    expect(at25.distributionCoefficient).toBeCloseTo(0.0172, 8);
    expect(at40.distributionCoefficient).toBeCloseTo(0.0271, 8);
    expect(at5.temperatureStatus).toBe('measured_5C');
    expect(at25.temperatureStatus).toBe('measured_25C');
    expect(at40.temperatureStatus).toBe('measured_40C');
    expect(at25.compositionDomainStatus).toBe('standard_seawater_ratio_salinity_proxy');
    expect(at25.compositionDomainSupported).toBe(true);
    expect(at5).toMatchObject({
      model: 'mucci_1987_and_mucci_morse_1983_bounded_partition_v3',
    });
    expect(hmcSolidSolutionAssessment(at5.mgMoleFraction, 5).activityModelTemperatureStatus)
      .toBe('dimensional_interaction_parameters_divided_by_RT_bounded_extrapolation');
  });

  it('returns a coverage gap instead of extrapolating D_Mg at low Mg/Ca', () => {
    const caveLike = new FluidChemistry({ Ca: 2000, Mg: 1500, CO3: 2200, pH: 8.4, salinity: 5 });
    const result = hmcCompositionFromFluid(caveLike, 18);
    expect(result.aqueousMgCaMolarRatio).toBeCloseTo(1.2369, 3);
    expect(result.compositionDomainSupported).toBe(false);
    expect(result.compositionDomainStatus).toBe('low_MgCa_composition_dependent_DMg_unresolved');
    expect(result.distributionCoefficient).toBeNull();
    expect(result.mgMoleFraction).toBeNull();
    expect(result.validHMCComposition).toBeNull();
  });

  it('recovers pure calcite at x=0 and nonideal component activities inside HMC', () => {
    const pure = hmcSolidSolutionAssessment(0, 25);
    const mixed = hmcSolidSolutionAssessment(0.10, 25);
    expect(pure.stoichiometricLogKsp).toBeCloseTo(pure.calciteLogK, 12);
    expect(pure.componentActivities.calcite).toBeCloseTo(1, 12);
    expect(mixed.componentMoleFractions).toEqual({
      calcite: 0.8,
      disorderedDolomiteHalfFormula: 0.2,
    });
    expect(mixed.activityCoefficients.calcite).not.toBeCloseTo(1, 3);
    expect(mixed.activityCoefficients.disorderedDolomiteHalfFormula).not.toBeCloseTo(1, 3);
    expect(mixed.phaseStabilityStatus).toBe('inside_documented_25C_miscibility_gap_metastable_branch');
    expect(mixed.insideDocumentedMiscibilityGap).toBe(true);
    expect(mixed.stableEquilibriumClaim).toBe(false);
    expect(mixed.screenRole).toBe('metastable_fixed_composition_kinetic_saturation_screen');
    expect(mixed.validity).toContain('metastable');
  });
});

describe('HMC per-zone mass balance and zoning', () => {
  it('books and returns each shell with its own Ca/Mg formula', () => {
    const conditions = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 1000, Mg: 1000, CO3: 1000, pH: 8 }),
    });
    const crystal = new Crystal({ mineral: 'HMC', crystal_id: 1 });
    const first = new GrowthZone({
      step: 1, temperature: 25, thickness_um: 10, growth_rate: 10,
      formula_stoichiometry: { Ca: 0.95, Mg: 0.05, CO3: 1 },
      solid_solution: { model: 'test', mgMoleFraction: 0.05 },
    });
    first._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, first, conditions);
    crystal.add_zone(first);
    const afterFirst = {
      Ca: conditions.fluid.Ca,
      Mg: conditions.fluid.Mg,
      CO3: conditions.fluid.CO3,
    };

    const second = new GrowthZone({
      step: 2, temperature: 25, thickness_um: 6, growth_rate: 6,
      formula_stoichiometry: { Ca: 0.80, Mg: 0.20, CO3: 1 },
      solid_solution: { model: 'test', mgMoleFraction: 0.20 },
    });
    second._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, second, conditions);
    crystal.add_zone(second);
    expect(second._budget_inventory_per_um.Mg / first._budget_inventory_per_um.Mg)
      .toBeCloseTo(4, 10);
    expect(second._budget_inventory_per_um.Ca / first._budget_inventory_per_um.Ca)
      .toBeCloseTo(0.80 / 0.95, 10);
    expect(crystal._mg_content).toBeCloseTo((10 * 0.05 + 6 * 0.20) / 16, 12);

    const dissolve = new GrowthZone({
      step: 3, temperature: 25, thickness_um: -6, growth_rate: -6,
      dissolutionMode: 'acid',
    });
    dissolve._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, dissolve, conditions);
    expect(conditions.fluid.Ca).toBeCloseTo(afterFirst.Ca, 10);
    expect(conditions.fluid.Mg).toBeCloseTo(afterFirst.Mg, 10);
    expect(conditions.fluid.CO3).toBeCloseTo(afterFirst.CO3, 10);
    expect(second._remaining_solid_um).toBeCloseTo(0, 12);
    expect(crystal._mg_content).toBeCloseTo(0.05, 12);
  });

  it('records different candidate-shell compositions when the fluid changes', () => {
    setSeed(42);
    const fluid = new FluidChemistry({ Ca: 400, Mg: 1200, CO3: 500, pH: 8.4, salinity: 35 });
    const conditions = new VugConditions({ temperature: 25, fluid });
    const crystal = new Crystal({ mineral: 'HMC', crystal_id: 7, position: 'vug wall' });
    crystal.active = true;
    const first = MINERAL_ENGINES.HMC(crystal, conditions, 1);
    expect(first).not.toBeNull();
    expect(first.formula_stoichiometry.Ca + first.formula_stoichiometry.Mg).toBeCloseTo(1, 12);
    expect(first.solid_solution.model).toBe('calcite_disordered_dolomite_subregular_v1');
    expect(first.solid_solution.partitionModel).toBe('mucci_1987_and_mucci_morse_1983_bounded_partition_v3');
    expect(first.solid_solution.phaseStabilityStatus)
      .toBe('inside_documented_25C_miscibility_gap_metastable_branch');

    fluid.Mg = 1400;
    const second = MINERAL_ENGINES.HMC(crystal, conditions, 2);
    expect(second).not.toBeNull();
    expect(second.solid_solution.mgMoleFraction)
      .toBeGreaterThan(first.solid_solution.mgMoleFraction);
    expect(second.note).toContain('D_Mg=0.0172');
  });

  it('persists formula, domain, and phase-stability receipts on an accepted production shell', () => {
    setSeed(42);
    const conditions = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 400, Mg: 1200, CO3: 500, pH: 8.4, salinity: 35 }),
    });
    const crystal = new Crystal({ mineral: 'HMC', crystal_id: 9, position: 'vug wall' });
    crystal.active = true;
    const zone = MINERAL_ENGINES.HMC(crystal, conditions, 1);
    expect(zone).not.toBeNull();
    zone._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, zone, conditions);
    crystal.add_zone(zone);
    expect(zone.formula_stoichiometry.Ca + zone.formula_stoichiometry.Mg).toBeCloseTo(1, 10);
    expect(zone.formula_stoichiometry.CO3).toBe(1);
    expect(zone.solid_solution.model).toBe('calcite_disordered_dolomite_subregular_v1');
    expect(zone.solid_solution.compositionDomainStatus).toBe('standard_seawater_ratio_salinity_proxy');
    expect(zone.solid_solution.validity).toContain('defect density');
    expect(zone.solid_solution.stableEquilibriumClaim).toBe(false);
  });
});

describe('HMC Creative-mode formation explanation', () => {
  it('shows the same live composition and formula used by production growth', () => {
    const conditions = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 400, Mg: 1200, CO3: 500, pH: 8.4, salinity: 35 }),
    });
    const sim = new VugSimulator(conditions, []);
    const why = _buildMineralFormationExplanation(
      'HMC', conditions, sim, conditions.supersaturation_HMC(),
    );
    const saturation = diagnosticGroup(why, 'Saturation');
    const compositionChip = saturation.chips.find((chip: any) => chip.text.includes('predicted shell x'));
    expect(compositionChip).toBeDefined();
    expect(compositionChip.note).toContain('D_Mg=0.0172');
    expect(compositionChip.note).toContain('metastable_fixed_composition_kinetic_saturation_screen');
    expect(compositionChip.note).toContain('stable equilibrium claim=false');
    const budget = diagnosticGroup(why, 'Calibrated growth budget');
    expect(budget.chips.some((chip: any) => chip.note.includes('current predicted shell formula'))).toBe(true);
  });

  it('labels unsupported compositions without inventing a formula or an absence verdict', () => {
    const unsupported = new VugConditions({
      temperature: 18,
      fluid: new FluidChemistry({ Ca: 2000, Mg: 1500, CO3: 2200, pH: 8.4, salinity: 5 }),
    });
    const whyUnsupported = _buildMineralFormationExplanation('HMC', unsupported, new VugSimulator(unsupported, []));
    const unresolved = diagnosticGroup(whyUnsupported, 'Saturation').chips
      .find((chip: any) => chip.text.includes('shell composition unresolved'));
    expect(unresolved).toMatchObject({ status: 'uncertain', met: true });
    expect(unresolved.note).toContain('no HMC presence or absence claim');
    expect(diagnosticGroup(whyUnsupported, 'Calibrated growth budget').chips[0].text)
      .toContain('formula unresolved');
    expect(whyUnsupported.state).toBe('unknown');
    expect(whyUnsupported.verdict).toContain('partition model lacks coverage');
    expect(whyUnsupported.verdict).toContain('not a geological absence or undersaturation verdict');

    const beyondMeasuredRatio = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 100, Mg: 3000, CO3: 500, pH: 8.4, salinity: 35 }),
    });
    const outOfRange = hmcCompositionFromFluid(beyondMeasuredRatio.fluid, 25);
    expect(outOfRange.aqueousMgCaMolarRatio).toBeGreaterThan(20);
    expect(outOfRange).toMatchObject({
      compositionDomainSupported: false,
      compositionDomainStatus: 'MgCa_above_measured_20_unresolved',
      mgMoleFraction: null,
    });

    const wrongMatrix = new FluidChemistry({ Ca: 100, Mg: 600, CO3: 500, pH: 8.4, salinity: 0 });
    expect(hmcCompositionFromFluid(wrongMatrix, 25)).toMatchObject({
      compositionDomainSupported: false,
      compositionDomainStatus: 'high_MgCa_nonseawater_solution_matrix_unresolved',
    });
  });

  it('renders unresolved HMC as unknown for never-formed and formed-earlier histories', () => {
    const conditions = new VugConditions({
      temperature: 18,
      fluid: new FluidChemistry({ Ca: 2000, Mg: 1500, CO3: 2200, pH: 8.4, salinity: 5 }),
    });
    const sim = new VugSimulator(conditions, []);
    const never = _buildMineralFormationExplanation('HMC', conditions, sim);
    expect(never.state).toBe('unknown');
    expect(never.verdict).toContain('simulator skips nucleation');
    expect(never.verdict).not.toContain('Not formed');
    expect(never.verdict).not.toContain('blocked');

    const prior = new Crystal({ mineral: 'HMC', crystal_id: 88, position: 'vug wall' });
    prior.active = true;
    sim.crystals.push(prior);
    const formedEarlier = _buildMineralFormationExplanation('HMC', conditions, sim);
    expect(formedEarlier.state).toBe('unknown');
    expect(formedEarlier.verdict).toContain('HMC formed earlier');
    expect(formedEarlier.verdict).toContain('current composition and saturation are unresolved');

    const host = document.createElement('div');
    _renderFortressSigmaGroups(conditions, host);
    const pill = host.querySelector('[data-hl-mineral="HMC"]') as HTMLButtonElement;
    expect(pill).toBeTruthy();
    expect(pill.classList.contains('sat-unknown')).toBe(true);
    expect(pill.textContent).toContain('composition/saturation unresolved');
    expect(pill.textContent).not.toContain('σ=0.00');
  });
});
