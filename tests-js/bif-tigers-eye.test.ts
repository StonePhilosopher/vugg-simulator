// Regression contract for the paired Asbestos Hills tiger's-eye models.
// These tests exercise the production nucleator and complete authored
// scenarios at the project's canonical gameplay seed 42.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runScenario } from './helpers';

declare const Crystal: any;
declare const FluidChemistry: any;
declare const GrowthZone: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const VugWall: any;
declare const MINERAL_ENGINES: Record<string, Function>;
declare const _nuc_tigers_eye: (sim: any) => void;
declare const _buildMineralFormationExplanation: (name: string, c: any, sim?: any, sigma?: number) => any;
declare const setSeed: (seed: number) => void;

function diagnosticGroup(explanation: any, label: string) {
  return explanation.groups.find((entry: any) => entry.label === label);
}

function makeSim(
  model: string,
  temperature: number,
  oxygen: number,
  pH: number,
  composition = 'banded_iron_formation',
  matrix?: string,
) {
  const conditions = new VugConditions({
    temperature,
    pressure: 1,
    fluid: new FluidChemistry({ SiO2: 2000, Fe: 1000, Na: 1000, F: 0, O2: oxygen, pH }),
    wall: new VugWall({ composition, matrix, architecture: 'tabular' }),
  });
  conditions._scenario = {
    tiger_eye_origin_model: model,
    tiger_eye_stage: model === 'antitaxial_crack_seal'
      ? 'synchronous_crack_seal'
      : 'surficial_silicification',
  };
  setSeed(42);
  return new VugSimulator(conditions, []);
}

function applyAcceptedZone(sim: any, crystal: any, zone: any) {
  zone._time_scaled = true;
  sim._applyZoneGrowthBudget(crystal, zone);
  crystal.add_zone(zone);
  return zone;
}

function applyEngineZone(sim: any, crystal: any) {
  const zone = sim._runEngineForCrystal(MINERAL_ENGINES[crystal.mineral], crystal);
  if (!zone) return null;
  sim._finalizeZoneForApplication(crystal, zone);
  sim._applyZoneGrowthBudget(crystal, zone);
  crystal.add_zone(zone);
  return zone;
}

function bookedCrocidolite(sim: any, id = 1) {
  const crystal = new Crystal({
    mineral: 'crocidolite', crystal_id: id, position: 'BIF seam', active: true,
  });
  if (!sim.crystals.includes(crystal)) sim.crystals.push(crystal);
  applyAcceptedZone(sim, crystal, new GrowthZone({
    step: 1, temperature: 300, thickness_um: 12, growth_rate: 12,
  }));
  return crystal;
}

function bookOxidativeLoss(sim: any, crystal: any, step = 2) {
  return applyAcceptedZone(sim, crystal, new GrowthZone({
    step,
    temperature: 50,
    thickness_um: -1,
    growth_rate: -1,
    dissolutionMode: 'oxidative',
  }));
}

describe('production tiger\'s-eye substrate gates', () => {
  it('crack-seal model accepts grown, active crocidolite without a random substrate roll', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.25, 9);
    const crocidolite = bookedCrocidolite(sim);
    expect(crocidolite.zones[0]._budget_inventory_per_um).toMatchObject({
      Na: expect.any(Number), Fe: expect.any(Number), SiO2: expect.any(Number),
    });
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger?.position).toContain('model=antitaxial-crack-seal');
  });

  it('surficial model rejects a cosmetic dissolved flag without an accepted oxidative loss zone', () => {
    const sim = makeSim('surficial_alteration', 50, 0.75, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    crocidolite.dissolved = true;
    _nuc_tigers_eye(sim);
    expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
  });

  it('rejects a forged oxidative zone that bypassed the growth-budget transaction', () => {
    const sim = makeSim('surficial_alteration', 50, 0.75, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    crocidolite.add_zone(new GrowthZone({
      step: 2,
      temperature: 50,
      thickness_um: -1,
      growth_rate: -1,
      dissolutionMode: 'oxidative',
    }));
    expect(crocidolite.zones.at(-1)._returned_budget_inventory).toBeUndefined();
    _nuc_tigers_eye(sim);
    expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
  });

  it('surficial model accepts only a booked oxidative return receipt', () => {
    const sim = makeSim('surficial_alteration', 50, 0.75, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    const loss = bookOxidativeLoss(sim, crocidolite);
    expect(loss._returned_budget_inventory).toMatchObject({
      Na: expect.any(Number), Fe: expect.any(Number), SiO2: expect.any(Number),
    });
    expect(loss._returned_budget_inventory.Na).toBeGreaterThan(0);
    expect(loss._returned_budget_inventory.Fe).toBeGreaterThan(0);
    expect(loss._returned_budget_inventory.SiO2).toBeGreaterThan(0);
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger?.position).toContain('model=surficial-alteration');
  });

  it('bare wall and bare hematite remain insufficient in both models', () => {
    for (const model of ['antitaxial_crack_seal', 'surficial_alteration']) {
      const sim = makeSim(model, model === 'antitaxial_crack_seal' ? 300 : 50,
        model === 'antitaxial_crack_seal' ? 0.25 : 0.75,
        model === 'antitaxial_crack_seal' ? 9 : 7.2);
      sim.crystals = [new Crystal({ mineral: 'hematite', crystal_id: 8, active: true })];
      _nuc_tigers_eye(sim);
      expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
    }
  });

  it.each(['limestone', 'basalt'])('blocks %s even when accepted crocidolite is transplanted into it', (host) => {
    for (const model of ['antitaxial_crack_seal', 'surficial_alteration']) {
      const sim = makeSim(model, model === 'antitaxial_crack_seal' ? 300 : 50,
        model === 'antitaxial_crack_seal' ? 0.25 : 0.75,
        model === 'antitaxial_crack_seal' ? 9 : 7.2,
        host);
      const crocidolite = bookedCrocidolite(sim);
      if (model === 'surficial_alteration') bookOxidativeLoss(sim, crocidolite);
      expect(sim.conditions.supersaturation_tigers_eye()).toBe(0);
      _nuc_tigers_eye(sim);
      expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
    }
  });

  it('does not let renderer-only BIF matrix skin override limestone physics', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.25, 9,
      'limestone', 'banded_iron_formation');
    bookedCrocidolite(sim);
    expect(sim.conditions.wall.matrix).toBe('banded_iron_formation');
    expect(sim.conditions.supersaturation_tigers_eye()).toBe(0);
    _nuc_tigers_eye(sim);
    expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
  });

  it('fails closed on an unknown nonempty origin-model identifier', () => {
    const sim = makeSim('typo', 50, 0.8, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    bookOxidativeLoss(sim, crocidolite);
    expect(sim.conditions.supersaturation_tigers_eye()).toBe(0);
    _nuc_tigers_eye(sim);
    expect(sim.crystals.some((c: any) => c.mineral === 'tigers_eye')).toBe(false);
    const why = _buildMineralFormationExplanation('tigers_eye', sim.conditions, sim, 0);
    expect(diagnosticGroup(why, 'Origin model').chips[0]).toMatchObject({ met: false });
    expect(diagnosticGroup(why, 'Origin model').chips[0].text).toContain('unsupported origin model');
    expect(diagnosticGroup(why, 'Substrate').chips[0]).toMatchObject({ met: false });
  });

  it('does not relabel classic tiger\'s-eye as tiger iron for distant hematite', () => {
    const sim = makeSim('surficial_alteration', 50, 0.8, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    crocidolite.wall_anchor = sim.wall_state._anchorFromRingCell(0, 0);
    bookOxidativeLoss(sim, crocidolite);
    const hematite = new Crystal({ mineral: 'hematite', crystal_id: 90, active: true });
    hematite.wall_anchor = sim.wall_state._anchorFromRingCell(0, 5);
    sim.crystals.push(hematite);
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger).toBeTruthy();
    expect(tiger.position).not.toContain('TIGER IRON');
    expect(tiger.position).not.toContain('banded with hematite');
  });

  it.each(['hematite', 'jasper'])('keeps tiger iron reachable when local exposed %s is present', (ironPhase) => {
    const sim = makeSim('surficial_alteration', 50, 0.8, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    crocidolite.wall_anchor = sim.wall_state._anchorFromRingCell(0, 0);
    bookOxidativeLoss(sim, crocidolite);
    const localIron = new Crystal({ mineral: ironPhase, crystal_id: 91, active: true });
    localIron.wall_anchor = sim.wall_state._anchorFromRingCell(0, 1);
    sim.crystals.push(localIron);
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger?.position).toContain('TIGER IRON');
    expect(sim.log.some((line: string) => line.includes('TIGER IRON'))).toBe(true);
  });
});

describe('Creative formation diagnosis follows the selected model', () => {
  it('shows the crack-seal T/pH/redox envelope and grown-crocidolite requirement', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.25, 9);
    bookedCrocidolite(sim);
    const sigma = sim.conditions.supersaturation_tigers_eye();
    const why = _buildMineralFormationExplanation('tigers_eye', sim.conditions, sim, sigma);
    expect(diagnosticGroup(why, 'Origin model').chips[0].text).toContain('Heaney–Fisher');
    expect(diagnosticGroup(why, 'Temperature gate').chips[0].text).toContain('150–450°C');
    expect(diagnosticGroup(why, 'pH gate').chips[0].text).toContain('7–11');
    expect(diagnosticGroup(why, 'Redox gate').chips[0].text).toContain('needs');
    expect(diagnosticGroup(why, 'Host geology').chips[0]).toMatchObject({ met: true });
    expect(diagnosticGroup(why, 'Substrate').chips[0]).toMatchObject({ met: true });
    expect(diagnosticGroup(why, 'Substrate').chips[0].text).toContain('grown active crocidolite ×1');
  });

  it('shows the surface envelope and keeps alteration substrate red until loss is accepted', () => {
    const sim = makeSim('surficial_alteration', 50, 0.75, 7.2);
    const crocidolite = bookedCrocidolite(sim);
    let why = _buildMineralFormationExplanation(
      'tigers_eye', sim.conditions, sim, sim.conditions.supersaturation_tigers_eye(),
    );
    expect(diagnosticGroup(why, 'Origin model').chips[0].text).toContain('Gutzmer–Beukes–Cairncross');
    expect(diagnosticGroup(why, 'Temperature gate').chips[0].text).toContain('5–100°C');
    expect(diagnosticGroup(why, 'pH gate').chips[0].text).toContain('5.5–9.5');
    expect(diagnosticGroup(why, 'Substrate').chips[0]).toMatchObject({ met: false });
    bookOxidativeLoss(sim, crocidolite);
    why = _buildMineralFormationExplanation(
      'tigers_eye', sim.conditions, sim, sim.conditions.supersaturation_tigers_eye(),
    );
    expect(diagnosticGroup(why, 'Substrate').chips[0]).toMatchObject({ met: true });
    expect(diagnosticGroup(why, 'Substrate').chips[0].text).toContain('oxidatively altered crocidolite ×1');
  });

  it('derives the Creative crack-seal advance from live T/pH/O2 without a script stage', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.25, 9);
    bookedCrocidolite(sim);
    delete sim.conditions._scenario.tiger_eye_stage;
    let why = _buildMineralFormationExplanation(
      'tigers_eye', sim.conditions, sim, sim.conditions.supersaturation_tigers_eye(),
    );
    expect(diagnosticGroup(why, 'Temperature gate').chips[0].text).toContain('150');
    expect(diagnosticGroup(why, 'Process advance').chips[0].text).toContain('then set T 5');

    const surfaceSim = makeSim('antitaxial_crack_seal', 60, 0.8, 7);
    bookedCrocidolite(surfaceSim);
    delete surfaceSim.conditions._scenario.tiger_eye_stage;
    why = _buildMineralFormationExplanation(
      'tigers_eye', surfaceSim.conditions, surfaceSim,
      surfaceSim.conditions.supersaturation_tigers_eye(),
    );
    expect(surfaceSim.conditions._scenario.tiger_eye_stage).toBeUndefined();
    expect(diagnosticGroup(why, 'Origin model').chips[0].text).toContain('later oxidation');
    expect(diagnosticGroup(why, 'Temperature gate').chips[0].text).toContain('5');
    expect(diagnosticGroup(why, 'Process advance').chips[0].text).toContain('zero SiO2 growth');
  });
});

describe('tiger\'s-eye reaction and dissolution transactions', () => {
  it('accumulates a zero-thickness Fe-oxidation overprint from hawk\'s-eye to gold-brown', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.25, 9);
    bookedCrocidolite(sim);
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger).toBeTruthy();
    const synchronousZone = applyEngineZone(sim, tiger);
    expect(synchronousZone.thickness_um).toBeGreaterThan(0);
    expect(synchronousZone._budget_inventory_per_um.Fe).toBeGreaterThan(0);
    const frameworkBefore = tiger.total_growth_um;
    const bookedFe = synchronousZone._budget_inventory_per_um.Fe
      * synchronousZone._remaining_solid_um;
    const halfOxidationO2 = bookedFe * 0.6 * (8 / 55.845) * 0.5;

    delete sim.conditions._scenario.tiger_eye_stage;
    sim.conditions.temperature = 60;
    sim.conditions.fluid.pH = 7;
    sim.conditions.fluid.O2 = halfOxidationO2;
    sim.conditions._scenario.tiger_eye_stage = 'post_growth_oxidation';
    for (const fluid of sim.ring_fluids) {
      fluid.pH = 7;
      fluid.O2 = halfOxidationO2;
    }
    const tigerCell = sim.wall_state.meshFor(sim).cellOf(tiger, sim.wall_state);
    tigerCell.fluid.pH = 7;
    tigerCell.fluid.O2 = halfOxidationO2;
    const partial = applyEngineZone(sim, tiger);
    expect(partial.state_overprint).toBe('tiger_eye_fe_oxidation_colour');
    expect(partial.thickness_um).toBe(0);
    expect(partial.oxidation_receipt.modeled_ferrous_oxidation_fraction).toBeGreaterThan(0);
    expect(partial.oxidation_receipt.modeled_ferrous_oxidation_fraction).toBeLessThan(0.9);
    expect(-partial._state_overprint_fluid_delta_actual.O2).toBeCloseTo(
      partial.oxidation_receipt.oxygen_consumed, 10,
    );
    expect(tiger.habit).toBe('partly_oxidized_crack_seal_hawks_eye');
    expect(tiger.total_growth_um).toBe(frameworkBefore);

    sim.conditions.fluid.O2 = 10;
    for (const fluid of sim.ring_fluids) fluid.O2 = 10;
    tigerCell.fluid.O2 = 10;
    const completed = applyEngineZone(sim, tiger);
    expect(completed.state_overprint).toBe('tiger_eye_fe_oxidation_colour');
    expect(completed.thickness_um).toBe(0);
    expect(completed.oxidation_receipt.previous_oxidized_fe_ppm_equivalent).toBeGreaterThan(0);
    expect(completed.oxidation_receipt.modeled_ferrous_oxidation_fraction).toBeGreaterThanOrEqual(0.9);
    expect(tiger.habit).toBe('oxidized_crack_seal_chatoyant');
    expect(tiger.total_growth_um).toBe(frameworkBefore);
  });

  it('requires both low pH and high F for framework dissolution', () => {
    const sim = makeSim('antitaxial_crack_seal', 300, 0.2, 9);
    bookedCrocidolite(sim);
    _nuc_tigers_eye(sim);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    const acceptedGrowth = applyEngineZone(sim, tiger);
    expect(acceptedGrowth._budget_inventory_per_um.SiO2).toBeGreaterThan(0);
    expect(acceptedGrowth._budget_inventory_per_um.Fe).toBeGreaterThan(0);
    const tigerCell = sim.wall_state.meshFor(sim).cellOf(tiger, sim.wall_state);
    sim.conditions.fluid.pH = 3;
    sim.conditions.fluid.F = 0;
    tigerCell.fluid.pH = 3;
    tigerCell.fluid.F = 0;
    expect(sim._runEngineForCrystal(MINERAL_ENGINES.tigers_eye, tiger)).toBeNull();
    expect(tiger.dissolved).toBe(false);

    sim.conditions.fluid.F = 50;
    tigerCell.fluid.F = 50;
    const hfZone = sim._runEngineForCrystal(MINERAL_ENGINES.tigers_eye, tiger);
    expect(hfZone.thickness_um).toBeLessThan(0);
    expect(hfZone.dissolutionMode).toBe('hf');
    expect(hfZone.note).toContain('HF-assisted');
    expect(hfZone.note).not.toContain('limonite/goethite');
    sim._finalizeZoneForApplication(tiger, hfZone);
    sim._applyZoneGrowthBudget(tiger, hfZone);
    tiger.add_zone(hfZone);
    expect(hfZone._returned_budget_inventory.SiO2).toBeGreaterThan(0);
    expect(hfZone._returned_budget_inventory.Fe).toBeGreaterThan(0);
  });
});

describe('authored Asbestos Hills scenarios at seed 42', () => {
  it.each([
    ['asbestos_hills_crack_seal', 'antitaxial-crack-seal', 2003],
    ['asbestos_hills_surficial_alteration', 'surficial-alteration', 2004],
  ])('%s grows the modeled crocidolite/tiger\'s-eye history', (scenario, modelToken, shapeSeed) => {
    const sim = runScenario(scenario, { seed: 42 });
    expect(sim).toBeTruthy();
    expect(sim.conditions.wall.shape_seed).toBe(shapeSeed);
    expect(sim.conditions.wall.composition).toBe('banded_iron_formation');
    expect(sim.conditions.pressure).toBe(0.001);
    expect(sim.conditions.wall.confining_pressure_kbar).toBe(0.001);
    expect(sim.crystals.some((c: any) => c.mineral === 'crocidolite')).toBe(true);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger?.position).toContain(`model=${modelToken}`);
  });

  it('the crack-seal path preserves crocidolite through later oxidation', () => {
    const sim = runScenario('asbestos_hills_crack_seal', { seed: 42 });
    const crocidolites = sim.crystals.filter((c: any) => c.mineral === 'crocidolite');
    expect(crocidolites.length).toBeGreaterThan(0);
    expect(crocidolites.some((c: any) => (c.zones || []).some((z: any) =>
      z.thickness_um < 0 && z.dissolutionMode === 'oxidative'))).toBe(false);
    const tigers = sim.crystals.filter((c: any) => c.mineral === 'tigers_eye');
    expect(tigers.every((c: any) => (c.zones || []).every((z: any) =>
      z.step < 58 || !(z.thickness_um > 0)))).toBe(true);
    expect(tigers.some((c: any) => (c.zones || []).some((z: any) =>
      z.step >= 58 && z.state_overprint === 'tiger_eye_fe_oxidation_colour'
      && z.thickness_um === 0))).toBe(true);
  });

  it('the surficial path records accepted oxidative crocidolite loss before tiger\'s-eye', () => {
    const sim = runScenario('asbestos_hills_surficial_alteration', { seed: 42 });
    const crocidolites = sim.crystals.filter((c: any) => c.mineral === 'crocidolite');
    const acceptedLosses = crocidolites.flatMap((c: any) => (c.zones || []).filter((z: any) =>
      z.thickness_um < 0 && z.dissolutionMode === 'oxidative'
      && z._returned_budget_inventory?.Na > 0
      && z._returned_budget_inventory?.Fe > 0
      && z._returned_budget_inventory?.SiO2 > 0));
    expect(acceptedLosses.length).toBeGreaterThan(0);
    const tiger = sim.crystals.find((c: any) => c.mineral === 'tigers_eye');
    expect(tiger?.position).toContain('accepted oxidative alteration');
    expect(tiger.nucleation_step).toBeGreaterThanOrEqual(
      Math.min(...acceptedLosses.map((z: any) => z.step)),
    );
  });
});

describe('literature and visual data contract', () => {
  it('ships the corrected primary citations and no obsolete Am.Min. 88 claim in live metadata', () => {
    const root = process.cwd();
    const minerals = fs.readFileSync(path.join(root, 'data', 'minerals.json'), 'utf8');
    const scenarios = fs.readFileSync(path.join(root, 'data', 'scenarios.json5'), 'utf8');
    expect(`${minerals}\n${scenarios}`).toContain('Geology 31(4):323-326');
    expect(`${minerals}\n${scenarios}`).toContain('Geology 32(1):e44');
    expect(`${minerals}\n${scenarios}`).not.toContain('Geology 32(1):e44-e45');
    expect(minerals).not.toContain('Heaney & Fisher 2003 Am.Min. 88');
  });

  it('exposes BIF in Creative mode and supplies a dedicated banded renderer skin', () => {
    const root = process.cwd();
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const renderer = fs.readFileSync(path.join(root, 'js', '99a-renderer-textures.ts'), 'utf8');
    expect(html).toContain('<option value="banded_iron_formation">banded iron formation</option>');
    expect(html).toContain('id="f-tiger-eye-model"');
    expect(renderer).toContain('banded_iron_formation(ctx, rnd)');
  });
});
