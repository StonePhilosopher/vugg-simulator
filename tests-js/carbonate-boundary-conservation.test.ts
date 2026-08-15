import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const CavityWaterAppearance: any;
declare const dicPpmToMolKg: (ppm: number) => number;
declare const dicMolKgToPpm: (molKg: number) => number;
declare const pureWaterDensityKgM3: (t: number) => number;
declare const pKwWater: (temperatureC: number) => number;
declare const reducedCarbonateAlkalinityEqKg: (dic: number, pH: number, t: number) => number;
declare const solvePHForReducedCarbonateAlkalinity: (dic: number, alk: number, t: number) => number;
declare const createConservedCarbonateBoundaryConfig: (fluid: any, t: number, opts?: any) => any;
declare const createCarbonateBoundaryState: (fluid: any, t: number, opts?: any) => any;
declare const equilibrateClosedCarbonateBoundaryState: (state: any, fluid: any, t: number, note?: string) => any;
declare const equilibrateOpenCarbonateBoundaryState: (state: any, fluid: any, t: number, target: number, note?: string) => any;
declare const chargeCarbonateBoundaryState: (state: any, fluid: any, t: number, molKg: number, note?: string) => any;
declare const rechargeCarbonateBoundaryState: (state: any, fluid: any, t: number, fraction: number, incomingDIC: number, incomingAlk: number, note?: string) => any;
declare const recordSimpleCaCO3SolidTransferState: (state: any, delta: number, mineral: string, note?: string) => any;
declare const recordUnresolvedCarbonateTransferState: (state: any, observedDIC: number, note: string) => any;
declare const carbonateBoundaryUncertainties: (fluid: any, t: number, pressureKbar: number, pCO2Bar: number) => string[];
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const EVENT_REGISTRY: Record<string, (conditions: any, eventSpec?: any) => string>;
declare const setSeed: (seed: number) => void;

const tolerance = (value: number) => Math.max(1e-12, Math.abs(value) * 1e-9);

function inertOpenBoundaryConditions(configure: (config: any, fluid: any) => any): any {
  const fluid = new FluidChemistry();
  // Leave DIC as the only reactive analytical pool so a run-step assertion
  // isolates boundary behavior from unrelated mineral nucleation/growth.
  for (const key of Object.keys(fluid)) {
    if (typeof fluid[key] === 'number') fluid[key] = 0;
  }
  fluid.CO3 = 500;
  fluid.pH = 7.2;
  fluid.Eh = 0;
  fluid.concentration = 1;
  const conditions = new VugConditions({
    temperature: 25,
    pressure: 0.00101325,
    fluid,
    wall: new VugWall({ composition: 'pegmatite', reactivity: 0, shape_seed: 42 }),
  });
  const config = createConservedCarbonateBoundaryConfig(fluid, 25, {
    mode: 'open', target_pCO2_bar: 4.2e-4, headspace_L_per_kg_water: 1,
  });
  conditions._scenario = {
    id: 'synthetic_boundary_fail_closed',
    open_to_atmosphere: true,
    carbonate_boundary: configure(config, fluid),
  };
  return conditions;
}

function expectPermanentBoundaryBlockSurvivesRunStep(conditions: any, expectedFlag: string): void {
  setSeed(42);
  const sim = new VugSimulator(conditions, []);
  const state = sim._carbonateBoundaryState;
  const before = {
    CO3: conditions.fluid.CO3,
    pH: conditions.fluid.pH,
    gas: state.headspaceCO2MolKg,
    system: state.initialSystemCarbonMolKg,
    lastDIC: state.lastDICMolKg,
    lastBulk: state.lastBulkDICPpm,
    transactions: JSON.parse(JSON.stringify(state.transactions)),
  };
  expect(state[expectedFlag]).toBe(true);
  expect(state.permanentBlocked).toBe(true);
  expect(state.blocked).toBe(true);

  sim.run_step();

  expect(state[expectedFlag]).toBe(true);
  expect(state.permanentBlocked).toBe(true);
  expect(state.blocked).toBe(true);
  expect({
    CO3: conditions.fluid.CO3,
    pH: conditions.fluid.pH,
    gas: state.headspaceCO2MolKg,
    system: state.initialSystemCarbonMolKg,
    lastDIC: state.lastDICMolKg,
    lastBulk: state.lastBulkDICPpm,
    transactions: state.transactions,
  }).toEqual(before);
  expect(state.transactions.some((tx: any) => tx.kind === 'open' || tx.kind === 'closed')).toBe(false);
}

describe('conserved carbonate boundary numerical kernel', () => {
  it('round-trips the simulator CO3-equivalent DIC convention exactly', () => {
    for (const ppm of [0, 50, 500, 12_000]) {
      expect(dicMolKgToPpm(dicPpmToMolKg(ppm))).toBeCloseTo(ppm, 10);
    }
  });

  it('uses the temperature-dependent water dissociation relation', () => {
    expect(pureWaterDensityKgM3(25)).toBeCloseTo(997.05, 1);
    expect(pKwWater(25)).toBeCloseTo(13.99, 2);
    expect(pKwWater(90)).toBeLessThan(pKwWater(25));
  });

  it('recovers pH from DIC plus reduced carbonate alkalinity', () => {
    const dic = dicPpmToMolKg(500);
    for (const t of [5, 25, 70, 90]) {
      for (const pH of [5.5, 6.5, 8.3, 10.2]) {
        const alk = reducedCarbonateAlkalinityEqKg(dic, pH, t);
        expect(solvePHForReducedCarbonateAlkalinity(dic, alk, t)).toBeCloseTo(pH, 8);
      }
    }
  });

  it('defaults Creative-style conserved boundaries to every validated simple-carbonate phase', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    const config = createConservedCarbonateBoundaryConfig(fluid, 25, {});
    expect(config.simple_carbonate_phases)
      .toEqual(['calcite', 'aragonite', 'dolomite', 'HMC']);

    const invalid = createCarbonateBoundaryState(fluid, 25, {
      ...config,
      simple_carbonate_phases: [...config.simple_carbonate_phases, 'malachite'],
    });
    expect(invalid.blocked).toBe(true);
    expect(invalid.configurationBlocked).toBe(true);
    expect(invalid.permanentBlocked).toBe(true);
    expect(invalid.transactions).toContainEqual(expect.objectContaining({
      kind: 'configuration_error',
      error: 'unsupported_simple_carbonate_phase',
      invalidSimpleCarbonatePhases: ['malachite'],
    }));
  });

  it('rejects inconsistent authored alkalinity before it can define headspace carbon', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.2, salinity: 0 });
    const before = { CO3: fluid.CO3, pH: fluid.pH };
    const reference = createCarbonateBoundaryState(fluid, 25, {
      headspace_L_per_kg_water: 1,
    });
    const authoredDIC = dicPpmToMolKg(fluid.CO3);
    const state = createCarbonateBoundaryState(fluid, 25, {
      initial_DIC_mol_kg: authoredDIC,
      reduced_alkalinity_eq_per_kg: reducedCarbonateAlkalinityEqKg(authoredDIC, 9.2, 25),
      headspace_L_per_kg_water: 1,
    });
    expect(state.blocked).toBe(true);
    expect(state.initializationBlocked).toBe(true);
    expect(state.permanentBlocked).toBe(true);
    expect(state.transactions).toContainEqual(expect.objectContaining({
      kind: 'initialization_mismatch',
      error: 'authored_reduced_alkalinity_does_not_match_fluid_pH',
      observedInitialPH: 7.2,
      derivedInitialPH: expect.closeTo(9.2, 8),
    }));
    expect({ CO3: fluid.CO3, pH: fluid.pH }).toEqual(before);
    expect(state.initialSystemCarbonMolKg).toBeCloseTo(reference.initialSystemCarbonMolKg, 14);
    expect(state.headspaceCO2MolKg).toBeCloseTo(reference.headspaceCO2MolKg, 14);
  });

  it('keeps an authored alkalinity/pH mismatch permanently fail-closed through run_step', () => {
    const conditions = inertOpenBoundaryConditions((config, fluid) => ({
      ...config,
      reduced_alkalinity_eq_per_kg: reducedCarbonateAlkalinityEqKg(
        dicPpmToMolKg(fluid.CO3), 9.2, 25,
      ),
    }));
    expectPermanentBoundaryBlockSurvivesRunStep(conditions, 'initializationBlocked');
  });

  it('keeps an unsupported carbonate phase permanently fail-closed through run_step', () => {
    const conditions = inertOpenBoundaryConditions(config => ({
      ...config,
      simple_carbonate_phases: [...config.simple_carbonate_phases, 'malachite'],
    }));
    expectPermanentBoundaryBlockSurvivesRunStep(conditions, 'configurationBlocked');
  });

  it('records and refuses every CO2 event when conserved boundary state is absent', () => {
    for (const type of ['co2_degas', 'co2_degas_with_reheat', 'co2_charge']) {
      const conditions: any = {
        temperature: 55,
        fluid: new FluidChemistry({ CO3: 500, pH: 7.2, salinity: 0 }),
      };
      const before = { temperature: conditions.temperature, CO3: conditions.fluid.CO3, pH: conditions.fluid.pH };
      const message = EVENT_REGISTRY[type](conditions, { name: `test ${type}` });
      expect({ temperature: conditions.temperature, CO3: conditions.fluid.CO3, pH: conditions.fluid.pH })
        .toEqual(before);
      expect(conditions._calciteDepositionalMode).toBeUndefined();
      expect(conditions._pending_carbonate_boundary_violation).toMatchObject({
        ok: false,
        kind: 'carbonate_boundary_required',
        error: 'co2_event_requires_conserved_carbonate_boundary',
      });
      expect(message).toContain('refused');
      expect(message).toContain('no chemistry was mutated');
    }
  });

  it('accepts dolomite and HMC receipts through a default custom conserved boundary', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.tutorial_travertine();
    conditions._scenario.open_to_atmosphere = false;
    conditions._scenario.carbonate_boundary = createConservedCarbonateBoundaryConfig(
      conditions.fluid, conditions.temperature, { mode: 'closed' },
    );
    const sim = new VugSimulator(conditions, events);
    const fluids = sim.wall_state.voxelGridFor(sim).voxels
      .map((voxel: any) => voxel.fluid).filter(Boolean);
    const localFluid = fluids.find((candidate: any) => candidate !== conditions.fluid);
    expect(localFluid).toBeDefined();
    for (const mineral of ['dolomite', 'HMC']) {
      const localDeltaPpm = -0.006001;
      localFluid.CO3 += localDeltaPpm;
      conditions._pending_carbonate_boundary_transfers = [{
        schema: 'accepted-carbonate-transfer-v1',
        crystalId: 1,
        mineral,
        acceptedThicknessUm: 0.01,
        localAqueousCarbonDeltaPpm: localDeltaPpm,
        touchedBulkFluidHandle: false,
      }];
      expect(sim._prepareCarbonateBoundarySpatialState()).toBe(true);
      expect(sim._carbonateBoundaryState.blocked).toBe(false);
      expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
        ok: true,
        kind: 'solid_transfer',
        minerals: [mineral],
      });
    }
  });

  it('gates the spatial boundary with the authenticated physical water span', () => {
    setSeed(42);
    const conditions = inertOpenBoundaryConditions(config => config);
    const sim = new VugSimulator(conditions, []);
    const appearance = CavityWaterAppearance.create(
      sim.wall_state, conditions, { sim },
    ).receipt;
    const exactSpan = appearance.ceiling_elevation_mm - appearance.floor_elevation_mm;
    conditions.fluid_surface_height_mm = exactSpan;
    expect(CavityWaterAppearance.create(sim.wall_state, conditions, { sim }).receipt.fully_submerged)
      .toBe(true);
    expect(sim._prepareCarbonateBoundarySpatialState()).toBe(true);

    conditions.fluid_surface_height_mm = exactSpan * 0.5;
    expect(sim._prepareCarbonateBoundarySpatialState()).toBe(false);
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      error: 'partially_flooded_boundary_deferred',
    });
  });

  it('blocks carbonate equilibration when production water authority is lost', () => {
    setSeed(42);
    const conditions = inertOpenBoundaryConditions(config => config);
    const sim = new VugSimulator(conditions, []);
    sim.enableProductionCavityAuthority();
    sim.wall_state._activeCavitySurfaceAnchorProvider = null;
    sim.wall_state._cavitySurfaceAuthorityFailure = 'test provider loss';
    expect(sim._prepareCarbonateBoundarySpatialState()).toBe(false);
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      error: 'cavity_water_authority_unavailable',
    });
  });

  it('closed aqueous/headspace equilibration conserves carbon and alkalinity', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 6.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {
      mode: 'closed',
      headspace_L_per_kg_water: 0.75,
      fluid_pressure_kbar: 0.00101325,
    });
    const alkBefore = state.reducedAlkalinityEqKg;
    const tx = equilibrateClosedCarbonateBoundaryState(state, fluid, 50);
    expect(Math.abs(tx.carbonErrorMolKg)).toBeLessThanOrEqual(tolerance(tx.before.totalCarbonMolKg));
    expect(state.reducedAlkalinityEqKg).toBe(alkBefore);
    expect(tx.alkalinityChangeEqKg).toBe(0);
    expect(fluid.pH).toBeCloseTo(tx.after.pH, 12);
  });

  it('open equilibration books the exact signed external carbon flux', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 6.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {
      mode: 'open',
      target_pCO2_bar: 4.2e-4,
      headspace_L_per_kg_water: 0.5,
      fluid_pressure_kbar: 0.00101325,
    });
    const tx = equilibrateOpenCarbonateBoundaryState(state, fluid, 25, 4.2e-4);
    const ledgerNet = state.boundaryImportMolKg - state.boundaryExportMolKg;
    expect(ledgerNet).toBeCloseTo(tx.after.totalCarbonMolKg - tx.before.totalCarbonMolKg, 13);
    expect(tx.alkalinityChangeEqKg).toBe(0);
    expect(fluid.pH).toBe(tx.after.pH);
  });

  it('a pure CO2 charge adds carbon without changing alkalinity', () => {
    const fluid = new FluidChemistry({ CO3: 250, pH: 7.2, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {
      mode: 'closed',
      headspace_L_per_kg_water: 1,
      fluid_pressure_kbar: 0.00101325,
    });
    const alkBefore = state.reducedAlkalinityEqKg;
    const beforeTotal = dicPpmToMolKg(fluid.CO3) + state.headspaceCO2MolKg;
    const charge = 0.0025;
    const tx = chargeCarbonateBoundaryState(state, fluid, 25, charge);
    expect(state.boundaryImportMolKg).toBeCloseTo(charge, 14);
    expect(tx.after.totalCarbonMolKg).toBeCloseTo(beforeTotal + charge, 12);
    expect(state.reducedAlkalinityEqKg).toBe(alkBefore);
    expect(Math.abs(tx.carbonErrorMolKg)).toBeLessThanOrEqual(tolerance(tx.before.totalCarbonMolKg));
  });

  it('replacement-water recharge books import and export separately and mixes alkalinity', () => {
    const fluid = new FluidChemistry({ CO3: 600, pH: 7.4, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {
      mode: 'closed', headspace_L_per_kg_water: 0.8, fluid_pressure_kbar: 0.00101325,
    });
    const beforeDIC = dicPpmToMolKg(fluid.CO3);
    const beforeGas = state.headspaceCO2MolKg;
    const beforeAlk = state.reducedAlkalinityEqKg;
    const incomingDIC = dicPpmToMolKg(200);
    const incomingAlk = reducedCarbonateAlkalinityEqKg(incomingDIC, 8.1, 25);
    const tx = rechargeCarbonateBoundaryState(
      state, fluid, 25, 0.25, incomingDIC, incomingAlk, 'test replacement water',
    );
    expect(tx.ok).toBe(true);
    expect(tx.kind).toBe('recharge');
    expect(tx.boundaryExportMolKg).toBeCloseTo(0.25 * beforeDIC, 14);
    expect(tx.boundaryImportMolKg).toBeCloseTo(0.25 * incomingDIC, 14);
    expect(state.boundaryExportMolKg).toBeCloseTo(tx.boundaryExportMolKg, 14);
    expect(state.boundaryImportMolKg).toBeCloseTo(tx.boundaryImportMolKg, 14);
    expect(state.reducedAlkalinityEqKg).toBeCloseTo(0.75 * beforeAlk + 0.25 * incomingAlk, 14);
    expect(tx.after.totalCarbonMolKg).toBeCloseTo(
      beforeDIC + beforeGas + tx.boundaryImportMolKg - tx.boundaryExportMolKg,
      12,
    );
    expect(Math.abs(tx.carbonErrorMolKg)).toBeLessThanOrEqual(tolerance(tx.before.totalCarbonMolKg));
  });

  it('invalid or unsolvable charge/recharge attempts do not mutate physical state or ledgers', () => {
    const fluid = new FluidChemistry({ CO3: 400, pH: 7.2, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, { headspace_L_per_kg_water: 1 });
    const before = {
      CO3: fluid.CO3,
      pH: fluid.pH,
      gas: state.headspaceCO2MolKg,
      alk: state.reducedAlkalinityEqKg,
      imports: state.boundaryImportMolKg,
      exports: state.boundaryExportMolKg,
    };
    const invalid = rechargeCarbonateBoundaryState(state, fluid, 25, 1.2, 0.01, 0.01);
    expect(invalid).toMatchObject({ ok: false, attemptedKind: 'recharge' });
    expect({
      CO3: fluid.CO3, pH: fluid.pH, gas: state.headspaceCO2MolKg,
      alk: state.reducedAlkalinityEqKg, imports: state.boundaryImportMolKg,
      exports: state.boundaryExportMolKg,
    }).toEqual(before);

    state.reducedAlkalinityEqKg = -10;
    const beforeFailedCharge = {
      CO3: fluid.CO3, pH: fluid.pH, gas: state.headspaceCO2MolKg,
      imports: state.boundaryImportMolKg, exports: state.boundaryExportMolKg,
    };
    const charge = chargeCarbonateBoundaryState(state, fluid, 25, 0.002);
    expect(charge).toMatchObject({ ok: false, attemptedKind: 'charge' });
    expect({
      CO3: fluid.CO3, pH: fluid.pH, gas: state.headspaceCO2MolKg,
      imports: state.boundaryImportMolKg, exports: state.boundaryExportMolKg,
    }).toEqual(beforeFailedCharge);
  });

  it('books carbonate solid transfer at two equivalents per mole', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {});
    const beforeAlk = state.reducedAlkalinityEqKg;
    const beforeDIC = dicPpmToMolKg(fluid.CO3);
    fluid.CO3 -= 60.01; // exactly 1 mmol/kg carbonate precipitated
    const delta = dicPpmToMolKg(fluid.CO3) - beforeDIC;
    const tx = recordSimpleCaCO3SolidTransferState(state, delta, 'calcite');
    expect(tx.aqueousCarbonDeltaMolKg).toBeCloseTo(delta, 14);
    expect(tx.solidCarbonDeltaMolKg).toBeCloseTo(-delta, 14);
    expect(state.reducedAlkalinityEqKg - beforeAlk).toBeCloseTo(2 * delta, 14);
  });

  it('uses the same per-carbon alkalinity stoichiometry for dolomite and HMC', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    for (const mineral of ['dolomite', 'HMC']) {
      const state = createCarbonateBoundaryState(fluid, 25, {});
      const before = state.reducedAlkalinityEqKg;
      const delta = -0.00025;
      const tx = recordSimpleCaCO3SolidTransferState(state, delta, mineral);
      expect(tx.ok).toBe(true);
      expect(tx.minerals).toEqual([mineral]);
      expect(state.reducedAlkalinityEqKg - before).toBeCloseTo(2 * delta, 14);
    }
  });

  it('rejects hydroxycarbonate transfer instead of applying the CaCO3 rule', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {});
    const alkBefore = state.reducedAlkalinityEqKg;
    const tx = recordSimpleCaCO3SolidTransferState(state, -0.001, 'malachite');
    expect(tx.ok).toBe(false);
    expect(tx.kind).toBe('solid_transfer_unresolved');
    expect(state.reducedAlkalinityEqKg).toBe(alkBefore);
  });

  it('records undeclared DIC change without rebalancing alkalinity', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, {});
    const alkBefore = state.reducedAlkalinityEqKg;
    const tx = recordUnresolvedCarbonateTransferState(
      state, state.lastDICMolKg - 0.001, 'test edit',
    );
    expect(tx.kind).toBe('solid_transfer_unresolved');
    expect(state.reducedAlkalinityEqKg).toBe(alkBefore);
    expect(state.lastDICMolKg).toBe(dicPpmToMolKg(500));
  });

  it('failed no-bracket solve does not mutate the fluid', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7.5, salinity: 0 });
    const state = createCarbonateBoundaryState(fluid, 25, { headspace_L_per_kg_water: 1 });
    const before = { CO3: fluid.CO3, pH: fluid.pH, gas: state.headspaceCO2MolKg };
    state.reducedAlkalinityEqKg = -10;
    const tx = equilibrateOpenCarbonateBoundaryState(state, fluid, 25, 4.2e-4);
    expect(tx).toMatchObject({ ok: false, kind: 'failed', error: 'no_bracket' });
    expect(fluid.CO3).toBe(before.CO3);
    expect(fluid.pH).toBe(before.pH);
    expect(state.headspaceCO2MolKg).toBe(before.gas);
  });

  it('closed and open boundaries diverge deterministically', () => {
    const closedFluid = new FluidChemistry({ CO3: 500, pH: 6.5, salinity: 0 });
    const openFluid = new FluidChemistry({ CO3: 500, pH: 6.5, salinity: 0 });
    const opts = { headspace_L_per_kg_water: 1, fluid_pressure_kbar: 0.00101325 };
    const closed = createCarbonateBoundaryState(closedFluid, 70, { ...opts, mode: 'closed' });
    const open = createCarbonateBoundaryState(openFluid, 70, { ...opts, mode: 'open' });
    equilibrateClosedCarbonateBoundaryState(closed, closedFluid, 25);
    equilibrateOpenCarbonateBoundaryState(open, openFluid, 25, 4.2e-4);
    expect(openFluid.CO3).not.toBeCloseTo(closedFluid.CO3, 6);
    expect(openFluid.pH).not.toBeCloseTo(closedFluid.pH, 6);
    expect(open.transactions[0].kind).toBe('open');
    expect(closed.transactions[0].kind).toBe('closed');
  });

  it('reports unsupported chemistry instead of silently claiming precision', () => {
    const fluid = new FluidChemistry({ CO3: 500, pH: 7, salinity: 250, B: 5, SiO2: 100 });
    const flags = carbonateBoundaryUncertainties(fluid, 150, 2, 5);
    expect(flags).toContain('salinity_model_missing');
    expect(flags).toContain('temperature_outside_pb82');
    expect(flags).toContain('gas_nonideality_missing');
    expect(flags).toContain('fluid_pressure_not_coupled_to_headspace');
    expect(flags).toContain('full_alkalinity_systems_omitted');
  });

  it('blocks an unreceipted spatial DIC edit even when calcite already exists', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.tutorial_travertine();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 8; i++) sim.run_step();
    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'calcite')).toBe(true);
    conditions.fluid.CO3 = 6500;
    sim.run_step();
    expect(sim._carbonateBoundaryState.blocked).toBe(true);
    const failure = [...sim._carbonateBoundaryState.transactions]
      .reverse().find((tx: any) => tx.ok === false);
    expect(failure).toMatchObject({
      kind: 'solid_transfer_unresolved',
      error: 'unreceipted_DIC_change',
    });
    expect(Math.abs(failure.residualBulkDICPpm)).toBeGreaterThan(1000);
  });

  it('rejects same-step DIC movements before they can alter a closed-system total', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.tutorial_travertine();
    conditions._scenario.movements = [{
      field: 'fluid.CO3', startStep: 1, endStep: 4,
      ops: [{ kind: 'trend', amp: 300, ease: false }], origin: 'global',
    }];
    const beforeCO3 = conditions.fluid.CO3;
    const sim = new VugSimulator(conditions, events);
    sim.run_step();
    expect(sim._carbonateBoundaryState.blocked).toBe(true);
    expect(conditions.fluid.CO3).toBeCloseTo(beforeCO3, 10);
    expect(sim._carbonateBoundaryState.boundaryImportMolKg).toBe(0);
    expect(sim._carbonateBoundaryState.boundaryExportMolKg).toBe(0);
    expect(sim._carbonateBoundaryState.transactions.at(-1)).toMatchObject({
      ok: false,
      attemptedKind: 'movement',
      field: 'fluid.CO3',
      error: 'movement_DIC_requires_explicit_recharge',
    });
  });
});

describe('tutorial travertine conserved-boundary integration', () => {
  it('runs three authored vents with closed receipts and calcite deposition', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.tutorial_travertine();
    expect(conditions.wall.shape_seed).toBe(4);
    expect(conditions._scenario.carbonate_boundary).toMatchObject({
      mode: 'closed',
      headspace_L_per_kg_water: 1,
      initial_DIC_mol_kg: expect.any(Number),
      reduced_alkalinity_eq_per_kg: expect.any(Number),
    });
    const initialPH = conditions.fluid.pH;
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < defaultSteps; i++) sim.run_step();
    const state = sim._carbonateBoundaryState;
    const vents = state.transactions.filter((tx: any) => tx.kind === 'open');
    const closed = state.transactions.filter((tx: any) => tx.kind === 'closed');
    expect(vents).toHaveLength(3);
    expect(vents.map((tx: any) => tx.after.pCO2Bar)).toEqual([0.08, 0.02, 0.004]);
    expect(vents.every((tx: any) => tx.boundaryDeltaMolKg < 0)).toBe(true);
    expect(closed.every((tx: any) => Math.abs(tx.carbonErrorMolKg)
      <= tolerance(tx.before.totalCarbonMolKg))).toBe(true);
    expect(state.boundaryExportMolKg).toBeGreaterThan(0);
    expect(state.boundaryImportMolKg).toBe(0);
    expect(state.uncertainties).toContain('full_alkalinity_systems_omitted');
    expect(state.uncertainties).not.toContain('salinity_model_missing');
    expect(state.uncertainties).not.toContain('fluid_pressure_not_coupled_to_headspace');
    expect(conditions.fluid.pH).toBeGreaterThan(initialPH);
    expect(sim.crystals.some((c: any) => c.mineral === 'calcite')).toBe(true);
    const finalWholeSystem = state.lastDICMolKg + state.headspaceCO2MolKg + state.solidCarbonMolKg;
    expect(finalWholeSystem).toBeCloseTo(
      state.initialSystemCarbonMolKg + state.boundaryImportMolKg - state.boundaryExportMolKg,
      11,
    );
    expect(state.transactions.some((tx: any) => tx.kind === 'solid_transfer_unresolved')).toBe(false);
  });
});

describe('sabkha conserved open-boundary integration', () => {
  it('authors every tidal endmember as a mass-balanced replacement-water receipt', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.sabkha_dolomitization();
    expect(conditions.wall.shape_seed).toBe(24);
    expect(conditions._scenario.carbonate_boundary).toMatchObject({
      mode: 'open',
      target_pCO2_bar: 4.2e-4,
      initial_DIC_mol_kg: expect.any(Number),
      reduced_alkalinity_eq_per_kg: expect.any(Number),
    });
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 40; i++) sim.run_step();
    const state = sim._carbonateBoundaryState;
    const replacements = state.transactions.filter((tx: any) => tx.kind === 'recharge');
    expect(replacements).toHaveLength(4);
    expect(replacements.every((tx: any) => tx.replacementFraction === 1)).toBe(true);
    expect(replacements.every((tx: any) => Number.isFinite(tx.incomingDICMolKg)
      && Number.isFinite(tx.incomingReducedAlkalinityEqKg))).toBe(true);
    expect(replacements.every((tx: any) => Math.abs(tx.carbonErrorMolKg) < 1e-12)).toBe(true);
    expect(state.boundaryImportMolKg).toBeGreaterThan(0);
    expect(state.boundaryExportMolKg).toBeGreaterThan(0);
    expect(state.uncertainties).toContain('salinity_model_missing');
    expect(state.transactions.some((tx: any) => tx.ok === false)).toBe(false);
  }, 300_000);
});
