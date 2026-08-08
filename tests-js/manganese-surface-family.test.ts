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

  it('shares the full grown, booked, exposed precursor rule with Creative diagnosis', () => {
    const c = conditions({ Mg: 100 }, 155);
    const sim = new VugSimulator(c, []);
    const sigma = c.supersaturation_todorokite();
    const zeroGrowth = bookedBirnessite(91);
    zeroGrowth.total_growth_um = 0;
    const noBookedMn = bookedBirnessite(92);
    noBookedMn.zones = [];
    const enclosed = bookedBirnessite(93);
    enclosed.enclosed_by = 999;

    for (const invalid of [zeroGrowth, noBookedMn, enclosed]) {
      sim.crystals = [invalid];
      expect(isTodorokiteBirnessitePrecursor(invalid)).toBe(false);
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

    const valid = bookedBirnessite(94);
    sim.crystals = [valid];
    expect(isTodorokiteBirnessitePrecursor(valid)).toBe(true);
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
