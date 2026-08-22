// SIM 257 Roughton Gill mine-specific reconciliation.
//
// Bridges et al. (2011) is the mine-grain authority: quartz-dominant gangue
// with significant calcite/dolomite; galena, chalcopyrite and sphalerite as
// primary ores; carbonate-buffered malachite + cerussite weathering; abundant
// hemimorphite; pyromorphite and type-locality plumbogummite. The canonical
// scientific contract is seed 42 with the authored shape_seed 1882.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare function simulatorSulfurLedgerSnapshot(sim: any): any;
declare function simulatorCarbonLedgerSnapshot(sim: any): any;

type Evidence = {
  sim: any;
  stages: Map<number, any>;
  present: Set<string>;
};

let canonical: Evidence | null = null;

function canonicalEvidence(): Evidence {
  if (canonical) return canonical;
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS.roughten_gill();
  const sim = new VugSimulator(conditions, events);
  const stages = new Map<number, any>();
  const watchedSteps = new Set([54, 55, 59, 60, 99, 100, 139, 140, 179, 180, 214, 215, defaultSteps]);
  for (let i = 0; i < defaultSteps; i++) {
    sim.run_step();
    if (watchedSteps.has(sim.step)) {
      const f = sim.conditions.fluid;
      stages.set(sim.step, {
        temperature: sim.conditions.temperature,
        pH: f.pH,
        O2: f.O2,
        CO3: f.CO3,
        SiO2: f.SiO2,
        Cu: f.Cu,
        Cl: f.Cl,
        S: f.S,
        S_sulfide: f.S_sulfide,
        S_sulfate: f.S_sulfate,
        fluid_surface_ring: sim.conditions.fluid_surface_ring,
      });
    }
  }
  canonical = { sim, stages, present: new Set(sim.crystals.map((c: any) => c.mineral)) };
  return canonical;
}

function crystals(sim: any, mineral: string) {
  return sim.crystals.filter((crystal: any) =>
    crystal.mineral === mineral && !crystal.dissolved && crystal.total_growth_um > 0);
}

describe('Roughton Gill mine-specific scenario', () => {
  it('preserves the historical id, authored shape seed, duration, and six-stage sequence', () => {
    expect(typeof SCENARIOS.roughten_gill).toBe('function');
    const { conditions, defaultSteps } = SCENARIOS.roughten_gill();
    const spec = SCENARIOS.roughten_gill._json5_spec;
    expect(conditions.wall.shape_seed).toBe(1882);
    expect(defaultSteps).toBe(240);
    expect(spec.events.map((event: any) => [event.step, event.type])).toEqual([
      [55, 'roughten_gill_primary_carbonate_peak'],
      [60, 'roughten_gill_primary_lockup'],
      [100, 'roughten_gill_deep_weathering'],
      [140, 'roughten_gill_carbonate_buffering'],
      [180, 'roughten_gill_silica_zinc_weathering'],
      [215, 'roughten_gill_plumbogummite_cap'],
    ]);
    expect(spec.movements).toEqual([expect.objectContaining({
      field: 'temperature', startStep: 0, endStep: 60, base: 130,
    })]);
    expect(conditions._scenario.carbon_ledger).toBe(true);
  });

  it('delivers the documented primary assemblage inside the 110-130 C ore stage', { timeout: 300_000 }, () => {
    const { sim } = canonicalEvidence();
    for (const mineral of ['quartz', 'calcite', 'galena', 'sphalerite', 'chalcopyrite']) {
      const formed = crystals(sim, mineral);
      expect(formed.length, `${mineral} must form at seed 42`).toBeGreaterThan(0);
      expect(Math.max(...formed.map((crystal: any) => crystal.nucleation_step)), `${mineral} timing`)
        .toBeLessThanOrEqual(59);
      for (const crystal of formed) {
        expect(crystal.nucleation_temp, `${mineral} nucleation temperature`)
          .toBeGreaterThanOrEqual(110);
        expect(crystal.nucleation_temp, `${mineral} nucleation temperature`)
          .toBeLessThanOrEqual(130);
      }
    }
  });

  it('delivers the carbonate-buffered and silica-rich supergene hierarchy at seed 42', { timeout: 300_000 }, () => {
    const { sim, present } = canonicalEvidence();
    for (const mineral of [
      'malachite', 'cerussite', 'aurichalcite', 'hemimorphite',
      'pyromorphite', 'plumbogummite',
    ]) {
      expect(crystals(sim, mineral).length, `${mineral} must grow`).toBeGreaterThan(0);
    }
    expect(Math.min(...crystals(sim, 'malachite').map((c: any) => c.nucleation_step)))
      .toBeGreaterThanOrEqual(100);
    expect(Math.min(...crystals(sim, 'cerussite').map((c: any) => c.nucleation_step)))
      .toBeGreaterThanOrEqual(100);
    expect(Math.min(...crystals(sim, 'hemimorphite').map((c: any) => c.nucleation_step)))
      .toBeGreaterThanOrEqual(180);
    const firstPyromorphite = Math.min(...crystals(sim, 'pyromorphite')
      .map((c: any) => c.nucleation_step));
    const firstPlumbogummite = Math.min(...crystals(sim, 'plumbogummite')
      .map((c: any) => c.nucleation_step));
    expect(firstPlumbogummite).toBeGreaterThan(firstPyromorphite);
    expect(firstPlumbogummite).toBeGreaterThanOrEqual(215);
    const firstOvergrowth = crystals(sim, 'plumbogummite')
      .sort((a: any, b: any) => a.nucleation_step - b.nucleation_step)[0];
    expect(String(firstOvergrowth.position)).toContain('encrusting pyromorphite');
    expect(firstOvergrowth.habit).toBe('encrusting_pyromorphite');
    const parentId = Number(String(firstOvergrowth.position).match(/pyromorphite #(\d+)/)?.[1]);
    const parent = sim.crystals.find((crystal: any) => crystal.crystal_id === parentId);
    expect(parent).toMatchObject({ mineral: 'pyromorphite', active: true, dissolved: false });
    expect(parent.nucleation_step).toBeLessThan(firstOvergrowth.nucleation_step);
    for (const rare of ['linarite', 'caledonite', 'leadhillite']) {
      expect(present.has(rare), `${rare} is genuine but not a deterministic headline`).toBe(false);
    }
    const rosasiteAspiration = SCENARIOS.roughten_gill._json5_spec.aspirational_species
      .find((entry: any) => entry.mineral === 'rosasite');
    expect(rosasiteAspiration).toMatchObject({
      mineral: 'rosasite',
      reason: expect.stringContaining('absent from all three SIM 272 commissioned seeds'),
    });
    expect(present.has('rosasite'), 'documented rosasite remains an honest 0/3 aspiration').toBe(false);
  });

  it('transfers sulfur internally at oxidation and closes the boundary ledger', { timeout: 300_000 }, () => {
    const { sim, stages } = canonicalEvidence();
    expect(stages.get(99)).toMatchObject({ S_sulfide: 35, S_sulfate: 5, S: 40 });
    expect(stages.get(100)).toMatchObject({ S_sulfide: 5, S_sulfate: 35, S: 40 });
    const transaction = sim._sulfurBoundaryTransactions.find((row: any) => row.step === 100);
    expect(transaction).toMatchObject({ kind: 'internal_transfer', expectedNetPpm: 0, closed: true });
    expect(simulatorSulfurLedgerSnapshot(sim)).toMatchObject({
      closed: true,
      propagationViolations: 0,
    });
  });

  it('books carbonate-gangue release and both fluid replacements in a closed carbon ledger', { timeout: 300_000 }, () => {
    const { sim, stages } = canonicalEvidence();
    expect(stages.get(54).CO3).toBeLessThan(1200);
    expect(stages.get(55).CO3).toBeGreaterThan(1100);
    expect(stages.get(139).CO3).toBeCloseTo(150, 8);
    expect(stages.get(140).CO3).toBeCloseTo(295, 8);
    expect(stages.get(179).CO3).toBeCloseTo(295, 8);
    expect(stages.get(180).CO3).toBeCloseTo(120, 8);
    const transactions = sim._carbonSourceTransactions;
    expect(transactions.map((row: any) => row.step)).toEqual([55, 60, 140, 180]);
    expect(transactions.every((row: any) => row.closed)).toBe(true);
    expect(transactions[0].declarations).toEqual([expect.objectContaining({
      kind: 'addition', category: 'external_import',
      source: 'Roughton Gill primary carbonate-gangue ore fluid',
    })]);
    expect(transactions[2].declarations).toEqual([expect.objectContaining({
      kind: 'addition', category: 'wall_release', carbonatePpmPerFluid: 145,
    })]);
    const ledger = simulatorCarbonLedgerSnapshot(sim);
    expect(ledger.wallReleasePpm).toBeGreaterThan(0);
    expect(ledger).toMatchObject({ closed: true, propagationViolations: 0 });
  });

  it('attributes every authored metal/silica import or export and closes signed boundary receipts', { timeout: 300_000 }, () => {
    const { sim, stages } = canonicalEvidence();
    expect(sim._fluidBoundaryViolations).toEqual([]);
    expect(sim._fluidBoundaryTransactions.map((row: any) => row.step)).toEqual([60, 100, 140, 180, 215]);
    expect(sim._fluidBoundaryTransactions.every((row: any) => row.closed)).toBe(true);
    const bufferedCu = sim._fluidBoundaryTransactions.find((row: any) => row.step === 140);
    expect(bufferedCu.declarations).toEqual([expect.objectContaining({
      kind: 'addition',
      source: 'Roughton Gill carbonate-buffered upgradient Cu-weathering drainage',
      fields: { Cu: 80 },
    })]);
    expect(bufferedCu.testimony).toEqual([expect.objectContaining({
      field: 'Cu', before: 70, after: 150, declaredAddition: 80,
      declaredDelta: 80, declaredImports: 80, declaredExports: 0,
      actualDelta: 80, closed: true,
    })]);
    expect(stages.get(179).Cu).toBe(150);
    expect(stages.get(180).Cu).toBe(70);
    const silicaSeep = sim._fluidBoundaryTransactions.find((row: any) => row.step === 180);
    expect(silicaSeep.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'replacement',
        source: 'Roughton Gill silica-rich Zn-weathering seep replacement',
        fields: { Cu: 70 },
      }),
    ]));
    expect(silicaSeep.testimony).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'Cu', before: 150, after: 70, declaredReplacementTarget: 70,
        declaredDelta: -80, declaredImports: 0, declaredExports: 80,
        actualDelta: -80, closed: true,
      }),
    ]));
  });

  it('keeps mine-specific exclusions absent while global mineral engines remain available', { timeout: 300_000 }, () => {
    const { present } = canonicalEvidence();
    const spec = SCENARIOS.roughten_gill._json5_spec;
    for (const mineral of Object.keys(spec.excluded_species)) {
      expect(present.has(mineral), `${mineral} violates Roughton Gill negative evidence`).toBe(false);
    }
  });

  it('makes every deterministic promise true at canonical seed 42 and keeps aspirations disjoint', { timeout: 300_000 }, () => {
    const { present } = canonicalEvidence();
    const spec = SCENARIOS.roughten_gill._json5_spec;
    for (const mineral of spec.expects_species) {
      expect(present.has(mineral), `${mineral} deterministic promise`).toBe(true);
    }
    const expected = new Set(spec.expects_species);
    for (const entry of spec.aspirational_species) {
      expect(expected.has(entry.mineral), entry.mineral).toBe(false);
      expect(entry.reason).toMatch(/\S/);
    }
  });
});
