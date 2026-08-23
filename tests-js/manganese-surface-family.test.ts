import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const Crystal: any;
declare const MINERAL_ENGINES: any;
declare const MINERAL_GATES_REGISTRY: any;
declare const MINERAL_STOICHIOMETRY: any;
declare const assessProductionNucleationDecision: any;
declare const applyBirnessiteTodorokiteTransition: any;
declare const remainingBookedInventory: any;
declare const isTodorokiteBirnessitePrecursor: any;
declare const _buildMineralFormationExplanation: any;
declare const _nuc_todorokite: any;
declare const setSeed: any;
declare const _liveRng: any;

function conditions(overrides: any = {}, temperature = 25) {
  const fluid = new FluidChemistry({
    Mn: 8, O2: 1.4, pH: 8.0, Fe: 1,
    Ba: 5, Mg: 5, K: 10, Pb: 1, Na: 30, Ca: 30, SiO2: 40,
    ...overrides,
  });
  return new VugConditions({ temperature, fluid });
}

function bookedBirnessite(id = 90) {
  const crystal = new Crystal({
    mineral: 'birnessite', crystal_id: id, habit: 'laminated_manganese_wall_lining',
    vector: 'coating', active: true, dissolved: false,
  });
  crystal.total_growth_um = 10;
  crystal.zones = [{
    thickness_um: 10,
    _remaining_solid_um: 10,
    _budget_inventory_per_um: { Mn: 1.2 },
  }];
  return crystal;
}

describe('SIM 250 honest Mn-oxide surface-family selector', () => {
  it('routes a low-T hydrous, low-tunnel-cation fluid to birnessite', () => {
    const c = conditions();
    const birnessite = c.supersaturation_birnessite();
    const pyrolusite = c.supersaturation_pyrolusite();
    expect(birnessite).toBeGreaterThan(1);
    expect(birnessite).toBeGreaterThan(pyrolusite);
    expect(c.supersaturation_romanechite()).toBe(0);
    expect(c.supersaturation_todorokite()).toBe(0);
  });

  it('makes Ba a load-bearing romanechite selector, not a trace label', () => {
    const c = conditions({ Ba: 220 });
    expect(c.supersaturation_romanechite()).toBeGreaterThan(1);
    expect(c.supersaturation_romanechite()).toBeGreaterThan(c.supersaturation_birnessite());
    expect(MINERAL_STOICHIOMETRY.romanechite).toEqual({ Ba: 1, Mn: 5 });
  });

  it('makes Mg a load-bearing todorokite selector in the tunnel-forming window', () => {
    const c = conditions({ Mg: 60 }, 100);
    expect(c.supersaturation_todorokite()).toBeGreaterThan(1);
    expect(c.supersaturation_todorokite()).toBeGreaterThan(c.supersaturation_birnessite());
    expect(MINERAL_STOICHIOMETRY.todorokite).toEqual({ Mg: 1, Mn: 6 });
    expect(MINERAL_GATES_REGISTRY.todorokite.required_substrate).toBe('birnessite');
    expect(conditions({ Mg: 60 }, 25).supersaturation_todorokite()).toBe(0);
  });

  it('transforms booked birnessite in place, preserves Mn and books only exchanged Mg', () => {
    const c = bookedBirnessite();
    const fluid = conditions({ Mg: 100 }, 155).fluid;
    const mnBefore = remainingBookedInventory(c, 'Mn');
    const mgBefore = fluid.Mg;
    const record = applyBirnessiteTodorokiteTransition(c, fluid, 155, 44);
    expect(record).toBeTruthy();
    expect(c.mineral).toBe('todorokite');
    expect(c.crystal_id).toBe(90);
    expect(remainingBookedInventory(c, 'Mn')).toBeCloseTo(mnBefore, 12);
    expect(remainingBookedInventory(c, 'Mg')).toBeCloseTo(record.structuralMgBookedPpm, 12);
    expect(mgBefore - fluid.Mg).toBeCloseTo(record.structuralMgBookedPpm, 12);
    expect(record.driver).toBe('Mg-exchanged-birnessite-to-todorokite');
    expect(c.phase_transition_history).toEqual([record]);
  });

  it('evaluates each precursor at its own voxel and debits only the transformed site', () => {
    setSeed(7);
    const c = conditions({ Mg: 100 }, 155);
    const sim = new VugSimulator(c, []);
    const cold = bookedBirnessite(201), hot = bookedBirnessite(202);
    cold.wall_anchor = { ringIdx: 1, cellIdx: 1 };
    hot.wall_anchor = { ringIdx: 8, cellIdx: 60 };
    sim.crystals = [cold, hot];
    const grid = sim.wall_state.voxelGridFor(sim);
    const mesh = sim.wall_state.meshFor(sim);
    grid.boundaryVoxel(1, 1).temperature = 25;
    grid.boundaryVoxel(8, 60).temperature = 155;
    const coldFluid = mesh.cells[1 * sim.wall_state.cells_per_ring + 1].fluid;
    const hotFluid = mesh.cells[8 * sim.wall_state.cells_per_ring + 60].fluid;
    Object.assign(coldFluid, { Mg: 100, Mn: 8, O2: 1.4, pH: 8, SiO2: 40 });
    Object.assign(hotFluid, { Mg: 100, Mn: 8, O2: 1.4, pH: 8, SiO2: 40 });
    const coldMgBefore = coldFluid.Mg, hotMgBefore = hotFluid.Mg, bulkMgBefore = c.fluid.Mg;
    sim._thermalFieldActivated = true;
    _nuc_todorokite(sim);
    expect(cold.mineral).toBe('birnessite');
    expect(coldFluid.Mg).toBe(coldMgBefore);
    expect(hot.mineral).toBe('todorokite');
    expect(hotFluid.Mg).toBeLessThan(hotMgBefore);
    expect(c.fluid.Mg).toBe(bulkMgBefore);
  });

  it('lets per-vertex chemistry open todorokite when uniform-T bulk chemistry is blocked', () => {
    setSeed(7);
    const c = conditions({ Mg: 0.1 }, 155);
    const sim = new VugSimulator(c, []);
    const precursor = bookedBirnessite(203);
    precursor.wall_anchor = { ringIdx: 8, cellIdx: 60 };
    sim.crystals = [precursor];
    const mesh = sim.wall_state.meshFor(sim);
    const localFluid = mesh.cells[8 * sim.wall_state.cells_per_ring + 60].fluid;
    Object.assign(localFluid, { Mg: 100, Mn: 8, O2: 1.4, pH: 8, SiO2: 40 });
    expect(c.supersaturation_todorokite()).toBe(0);
    sim.wall_state.per_vertex_nucleation = true;
    sim._thermalFieldActivated = false;
    _nuc_todorokite(sim);
    expect(precursor.mineral).toBe('todorokite');
    expect(localFluid.Mg).toBeLessThan(100);
    expect(c.fluid.Mg).toBe(0.1);
  });

  it('blocks fluid-only todorokite and reports the missing precursor in Creative diagnosis', () => {
    const c = conditions({ Mg: 100 }, 155);
    const sim = new VugSimulator(c, []);
    sim.crystals = [];
    const sigma = c.supersaturation_todorokite();
    expect(sigma).toBeGreaterThan(1);
    const blocked = assessProductionNucleationDecision('todorokite', sim, sigma, 1);
    expect(blocked.eligible).toBe(false);
    expect(blocked.source).toBe('required transformation precursor');
    expect(blocked.blockers.join(' ')).toContain('birnessite precursor');
    const whyBlocked = _buildMineralFormationExplanation('todorokite', c, sim, sigma);
    expect(whyBlocked.state).toBe('blocked');
    expect(whyBlocked.groups.find((g: any) => g.label === 'Substrate').chips[0])
      .toMatchObject({ met: false });
    expect(whyBlocked.groups.find((g: any) => g.label === 'Substrate').chips[0].text)
      .toContain('birnessite precursor absent');

    sim.crystals = [bookedBirnessite()];
    const eligible = assessProductionNucleationDecision('todorokite', sim, sigma, 1);
    expect(eligible.eligible).toBe(true);
    expect(eligible.stochasticBirth).toBe(true);
    const whyEligible = _buildMineralFormationExplanation('todorokite', c, sim, sigma);
    expect(whyEligible.state).toBe('eligible');
    expect(whyEligible.verdict).toContain('required birnessite precursor');
  });

  it('keeps the todorokite hover probe byte-for-byte isolated from live state', () => {
    setSeed(7);
    const c = conditions({ Mg: 0.1 }, 155);
    const sim = new VugSimulator(c, []);
    const precursor = bookedBirnessite(204);
    precursor.wall_anchor = { ringIdx: 8, cellIdx: 60 };
    sim.crystals = [precursor];
    const mesh = sim.wall_state.meshFor(sim);
    for (const cell of mesh.cells) cell.fluid.Mg = 0.1;
    mesh.cells[8 * sim.wall_state.cells_per_ring + 60].fluid.Mg = 100;
    sim.wall_state.per_vertex_nucleation = true;
    const testimony = () => JSON.stringify({
      bulkFluid: c.fluid,
      wallFluids: mesh.cells.map((cell: any) => cell.fluid),
      crystals: sim.crystals,
      log: sim.log,
      crystalCounter: sim.crystal_counter,
      rngState: _liveRng().state,
    });
    const before = testimony();
    const why = _buildMineralFormationExplanation('todorokite', c, sim);
    expect(why.groups.find((group: any) => group.label === 'Production nucleator'))
      .toBeTruthy();
    expect(testimony()).toBe(before);
  });

  it('shares the full grown, booked, exposed precursor rule with Creative diagnosis', () => {
    const c = conditions({ Mg: 100 }, 155);
    const sim = new VugSimulator(c, []);
    const sigma = c.supersaturation_todorokite();
    const zeroGrowth = bookedBirnessite(91);
    zeroGrowth.total_growth_um = 0;
    const noBookedMn = bookedBirnessite(92);
    noBookedMn.zones = [];
    for (const invalid of [zeroGrowth, noBookedMn]) {
      sim.crystals = [invalid];
      expect(isTodorokiteBirnessitePrecursor(invalid, sim)).toBe(false);
      const decision = assessProductionNucleationDecision('todorokite', sim, sigma, 1);
      expect(decision).toMatchObject({
        eligible: false,
        source: 'required transformation precursor',
      });
      const why = _buildMineralFormationExplanation('todorokite', c, sim, sigma);
      const substrate = why.groups.find((g: any) => g.label === 'Substrate');
      expect(substrate.chips[0]).toMatchObject({ met: false });
      expect(substrate.chips[0].text).toContain('birnessite precursor absent');
    }

    const staleFlag = bookedBirnessite(95);
    staleFlag.enclosed_by = 999;
    sim.crystals = [staleFlag];
    sim._enclosureReceipts = [];
    expect(isTodorokiteBirnessitePrecursor(staleFlag, sim)).toBe(true);
    expect(assessProductionNucleationDecision('todorokite', sim, sigma, 1).eligible)
      .toBe(true);

    const enclosed = bookedBirnessite(93);
    const host: any = {
      crystal_id: 999, mineral: 'calcite', active: true, dissolved: false,
      enclosed_crystals: [93], enclosed_at_step: [4],
      zones: [
        { step: 3, thickness_um: 400 },
        { step: 4, thickness_um: 1 },
      ],
    };
    const inventory = (enclosed.zones || []).reduce(
      (sum: number, zone: any) => sum + (zone.thickness_um > 0 ? zone.thickness_um : 0),
      0,
    );
    const receipt = {
      schema: 'enclosure-receipt-v1', event: 'enclosed', step: 4,
      host_crystal_id: 999, host_mineral: 'calcite',
      guest_crystal_id: 93, guest_mineral: 'birnessite',
      route: 'guest-on-host', adjacency_authority: 'exact-substrate-id',
      host_same_step_positive_growth_um: 1,
      host_same_step_negative_growth_um: 0,
      host_same_step_net_growth_um: 1,
      host_physical_size_at_enclosure_um: 401,
      guest_positive_core_um: inventory,
      guest_loss_um: 0,
      guest_remaining_growth_um: inventory,
      guest_partially_dissolved: false,
      size_ratio: 0.401 / Math.max(inventory / 1000, 0.001),
      guest_recent_growth_um: (enclosed.zones || []).slice(-3)
        .reduce((sum: number, zone: any) => sum + zone.thickness_um, 0),
      guest_slowing_threshold_um: 3,
    };
    enclosed.enclosed_by = 999;
    enclosed.enclosure_receipt = receipt;
    enclosed.active = false;
    sim.crystals = [enclosed, host];
    sim._enclosureReceipts = [receipt];
    expect(isTodorokiteBirnessitePrecursor(enclosed, sim)).toBe(false);
    expect(assessProductionNucleationDecision('todorokite', sim, sigma, 1)).toMatchObject({
      eligible: false, source: 'required transformation precursor',
    });

    const valid = bookedBirnessite(94);
    sim.crystals = [valid];
    sim._enclosureReceipts = [];
    expect(isTodorokiteBirnessitePrecursor(valid, sim)).toBe(true);
    expect(assessProductionNucleationDecision('todorokite', sim, sigma, 1).eligible).toBe(true);
  });

  it('keeps every sister phase behind Mn, temperature, pH and redox gates', () => {
    expect(conditions({ Mn: 0.1 }).supersaturation_birnessite()).toBe(0);
    expect(conditions({ O2: 0.1, Ba: 220 }).supersaturation_romanechite()).toBe(0);
    expect(conditions({ pH: 4.5, Mg: 60 }, 100).supersaturation_todorokite()).toBe(0);
    expect(conditions({ Ba: 220 }, 250).supersaturation_romanechite()).toBe(0);
  });

  it('registers gates and growth engines for diagnosis and accepted growth', () => {
    for (const mineral of ['birnessite', 'romanechite', 'todorokite']) {
      expect(MINERAL_GATES_REGISTRY[mineral]).toBeTruthy();
      expect(typeof MINERAL_ENGINES[mineral]).toBe('function');
    }
  });

  it('keeps unverified named localities clean while leaving Creative chemistry unrestricted', () => {
    const namedScenario = {
      conditions: Object.assign(conditions(), { _scenario: { id: 'unreconciled_locality' } }),
      crystals: [],
    };
    const assessment = assessProductionNucleationDecision('birnessite', namedScenario, 2, 1);
    expect(assessment.eligible).toBe(false);
    expect(assessment.source).toBe('scenario locality license');
    expect(assessment.blockers.join(' ')).toContain('chemistry alone does not prove occurrence');

    const creative = { conditions: conditions(), crystals: [] };
    const creativeAssessment = assessProductionNucleationDecision('birnessite', creative, 2, 1);
    expect(creativeAssessment.source).not.toBe('scenario locality license');
  });
});
