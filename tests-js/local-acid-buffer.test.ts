import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {cell, assertCell, COMPONENTS, WATER_KG_PER_MOL, REACTIONS, TOL, inventory, assertConserved,
  oxidizePyrite, oxidizeFerrous, dissolveCalcite, exchangeWater, applyGasCarbon} from '../pilots/local-acid-buffer/ledger.mjs';
import {speciationDeck, parseSelected, assertSpeciation, equilibrateCalcite, createPhreeqc} from '../pilots/local-acid-buffer/phreeqc.mjs';
import {ROOT, PREFIX, loadEvidence, replayEngine, produceResults} from '../pilots/local-acid-buffer/commission.mjs';
import {CASES, initialCells, runExperiment} from '../pilots/local-acid-buffer/experiment.mjs';

const {receipt, transcript} = loadEvidence();
const results = produceResults(replayEngine(transcript));
const caseById = (id: string) => results.cases.find((c: any) => c.config.id === id)!;
const aqueousCell = () => cell({id: 'test', pyrite: 0.5, aqueous: {O2: 0.35}});

describe('isolated local acid / finite calcite pilot', () => {
  it('balances the atoms and charge of each declared endpoint independently', () => {
    const species: Record<string, Record<string, number>> = {
      FeS2: {Fe: 1, S: 2}, O2: {O: 2}, H2O: {H: 2, O: 1}, 'Fe2+': {Fe: 1, charge: 2},
      'SO4--': {S: 1, O: 4, charge: -2}, 'H+': {H: 1, charge: 1}, 'Fe(OH)3': {Fe: 1, O: 3, H: 3},
      CaCO3: {Ca: 1, C: 1, O: 3}, 'Ca2+': {Ca: 1, charge: 2}, 'CO3--': {C: 1, O: 3, charge: -2},
    };
    for (const reaction of Object.values(REACTIONS)) {
      for (const element of ['Fe', 'S', 'O', 'H', 'Ca', 'C', 'charge']) {
        const residual = Object.entries(reaction).reduce((sum, [name, amount]) => sum + amount*(species[name][element] || 0), 0);
        expect(residual).toBe(0);
      }
    }
  });

  it('books acid only for pyrite oxidation accepted by the finite O2 inventory', () => {
    const before = aqueousCell(), snapshot = structuredClone(before), start = inventory([before]);
    const result = oxidizePyrite(before, 0.3), c = result.cell;
    expect(result.acceptedMol).toBeCloseTo(0.1, 14);
    expect(c.solid.pyrite).toBeCloseTo(0.4, 14);
    expect(c.aqueous.FeII).toBeCloseTo(0.1, 14);
    expect(c.aqueous.sulfate).toBeCloseTo(0.2, 14);
    expect(c.aqueous.O2).toBe(0);
    expect(c.aqueous.alkalinity).toBeCloseTo(-0.2, 14);
    expect(c.ledger.acidProduced).toBeCloseTo(0.2, 14);
    expect(c.waterKg).toBeCloseTo(1 - 0.1*WATER_KG_PER_MOL, 14);
    expect(() => assertConserved(start, [c])).not.toThrow();
    expect(before).toEqual(snapshot);
  });

  it.each([0, 0.01])('never oxidizes more than available pyrite (%s mol)', available => {
    const result = oxidizePyrite(cell({id: 'limited', pyrite: available, aqueous: {O2: 1}}), 1);
    expect(result.acceptedMol).toBe(available);
    expect(result.cell.solid.pyrite).toBe(0);
  });

  it('does not grant the other two proton equivalents until FeII actually oxidizes', () => {
    const initial = cell({id: 'endpoint', pyrite: 0.001, aqueous: {O2: 0.000375}});
    const ferrous = oxidizePyrite(initial, 0.0001).cell;
    expect(ferrous.ledger.acidProduced).toBeCloseTo(0.0002, 14);
    expect(ferrous.solid.ferricHydroxide).toBe(0);
    const partial = oxidizeFerrous(ferrous, 0.00005).cell;
    expect(partial.ledger.acidProduced).toBeCloseTo(0.0003, 14);
    const finished = oxidizeFerrous(partial, 1).cell;
    expect(finished.ledger.acidProduced).toBeCloseTo(0.0004, 14);
    expect(finished.ledger.O2Consumed).toBeCloseTo(0.000375, 14);
    expect(finished.ledger.waterConsumed).toBeCloseTo(0.00035, 14);
    expect(finished.aqueous.FeII).toBeCloseTo(0, 14);
    expect(finished.solid.ferricHydroxide).toBeCloseTo(0.0001, 14);
    expect(() => assertConserved(inventory([initial]), [finished])).not.toThrow();
  });

  it('limits the second endpoint by its own oxygen supply', () => {
    const c = cell({id: 'iron', aqueous: {FeII: 0.1, alkalinity: 0.2, O2: 0.0125}});
    const result = oxidizeFerrous(c, 0.1);
    expect(result.acceptedMol).toBeCloseTo(0.05, 14);
    expect(result.cell.aqueous.FeII).toBeCloseTo(0.05, 14);
    expect(result.cell.aqueous.O2).toBe(0);
    expect(() => assertConserved(inventory([c]), [result.cell])).not.toThrow();
  });

  it('retains positive finite solvent and accounts for pathway water', () => {
    const c = cell({id: 'dry', waterKg: 1e-4, pyrite: 1, aqueous: {O2: 4}});
    const result = oxidizePyrite(c, 1);
    expect(result.acceptedMol).toBeLessThan(1e-4/WATER_KG_PER_MOL);
    expect(result.cell.waterKg).toBeGreaterThan(0);
    expect(() => assertConserved(inventory([c]), [result.cell])).not.toThrow();
  });

  it('books finite carbonate loss, Ca, C and two alkalinity equivalents together', () => {
    const c = cell({id: 'carbonate', calcite: 0.1});
    const end = dissolveCalcite(c, 0.1);
    expect(end.aqueous).toMatchObject({Ca: 0.1, C: 0.1, alkalinity: 0.2});
    expect(end.solid.calcite).toBe(0);
    expect(() => dissolveCalcite(end, 1e-9)).toThrow('inventory exceeded');
    expect(() => assertConserved(inventory([c]), [end])).not.toThrow();
  });

  it('exchanges amounts at donor molalities, including signed alkalinity, for unequal water masses', () => {
    const a = cell({id: 'small', waterKg: 1, pyrite: 1, aqueous: {Na: 0.1, alkalinity: 0.1}});
    const b = cell({id: 'large', waterKg: 4, calcite: 1, aqueous: {Cl: 0.2, alkalinity: -0.2}});
    const start = inventory([a, b]), original = structuredClone([a, b]);
    const result = exchangeWater(a, b, 0.5), [left, right] = result.cells;
    expect(result.exchangedWaterKg).toBe(0.5);
    expect(left.aqueous).toMatchObject({Na: 0.05, Cl: 0.025});
    expect(right.aqueous.Na).toBeCloseTo(0.05, 14);
    expect(right.aqueous.Cl).toBeCloseTo(0.175, 14);
    expect(left.aqueous.alkalinity).toBeCloseTo(0.025, 14);
    expect([left.waterKg, right.waterKg]).toEqual([1, 4]);
    expect([left.solid, right.solid]).toEqual([a.solid, b.solid]);
    expect(() => assertConserved(start, result.cells)).not.toThrow();
    expect([a, b]).toEqual(original);
    expect(COMPONENTS).not.toContain('pH');
  });

  it('does not use pH, camera, UV or visibility hints as reaction/transport inputs', () => {
    const a = aqueousCell(), b = structuredClone(a);
    Object.assign(b, {pH: 1, UV: 100, camera: 100, visibility: 100});
    const x = oxidizePyrite(a, 0.1), y = oxidizePyrite(b, 0.1);
    expect(y.acceptedMol).toBe(x.acceptedMol);
    expect(y.cell.aqueous).toEqual(x.cell.aqueous);
    expect(y.cell.ledger).toEqual(x.cell.ledger);
  });

  it.each([-1, NaN, Infinity])('rejects invalid reaction and transport inputs (%s)', value => {
    expect(() => oxidizePyrite(aqueousCell(), value)).toThrow();
    expect(() => oxidizeFerrous(aqueousCell(), value)).toThrow();
    expect(() => exchangeWater(aqueousCell(), aqueousCell(), value)).toThrow();
    expect(() => dissolveCalcite(aqueousCell(), value)).toThrow();
  });

  it('rejects incomplete inventories, falsified charge/acid ledgers and unsafe cell identifiers', () => {
    const c = aqueousCell();
    expect(() => assertConserved({}, [c])).toThrow('Incomplete');
    expect(() => assertConserved({...inventory([c]), Fe: NaN}, [c])).toThrow('Invalid initial');
    const forged = structuredClone(c); forged.aqueous.alkalinity = 0.1;
    expect(() => assertCell(forged)).toThrow('charge-reference');
    const acid = structuredClone(c); acid.ledger.acidProduced = 1;
    expect(() => assertCell(acid)).toThrow('ledger mismatch');
    for (const id of [undefined, 'A\nDELETE', '']) expect(() => cell({id})).toThrow();
  });

  it('tracks signed open-carbon exchange independently of alkalinity and keeps saved amounts intact', () => {
    const c = cell({id: 'gas', aqueous: {C: 0.1}}), start = inventory([c]);
    const gas = applyGasCarbon(c, 0.2), out = applyGasCarbon(gas, 0.05);
    expect(out.aqueous.alkalinity).toBe(0);
    expect(out.ledger.carbonFromGas).toBeCloseTo(-0.05, 14);
    expect(() => assertConserved(start, [out])).not.toThrow();
    expect(assertCell(JSON.parse(JSON.stringify(out)))).toEqual(out);
  });

  it('cannot silently fall back to an uncommissioned solver or a guessed pH', () => {
    expect(() => createPhreeqc({executable: path.join(ROOT, 'package.json'), database: path.join(ROOT, 'package.json'), workdir: ROOT})).toThrow('Uncommissioned');
    expect(() => speciationDeck(initialCells(), 'unknown')).toThrow('boundary');
    expect(() => parseSelected('pH\n7')).toThrow('header');
    expect(() => replayEngine([]).speciate(initialCells()[0], 'closed-carbon')).toThrow('No executed');
    expect(() => runExperiment({...CASES[0], iron: 'invented'}, () => {})).toThrow('Unauthored');
  });

  it('rejects a solver row that changes a fixed component, valence state, water or acid-base total', () => {
    const c = initialCells()[0], engine = replayEngine(transcript), {observation} = engine.speciate(c, 'closed-carbon');
    for (const key of ['Ca', 'Na', 'Cl', 'C', 'FeII', 'FeIII', 'sulfate', 'oxygenAtoms', 'alkalinity', 'waterKg', 'charge']) {
      expect(() => assertSpeciation(c, {...observation, [key]: observation[key]+1e-7}, 'closed-carbon')).toThrow();
    }
    expect(() => assertSpeciation(c, {...observation, pH: NaN}, 'closed-carbon')).toThrow();
    expect(() => assertSpeciation(c, {...observation, calciteSI: NaN}, 'closed-carbon')).toThrow();
    expect(() => assertSpeciation(c, {...observation, charge: NaN}, 'closed-carbon')).toThrow();
    expect(() => assertSpeciation(c, {...observation, logPCO2: NaN}, 'fixed-pCO2')).toThrow();
  });

  it('fails visibly rather than accepting a mineral equilibrium that never converged', () => {
    const c = cell({id: 'nonconvergent', calcite: 0.001});
    const speciate = (x: any) => ({cell: x, observation: {calciteSI: x.solid.calcite > 0.0006 ? -1 : 1}});
    expect(() => equilibrateCalcite(c, 'closed-carbon', speciate)).toThrow('did not converge');
    expect(c.solid.calcite).toBe(0.001);
  });
});

describe('executed PHREEQC evidence (offline replay, not a new solver execution)', () => {
  it('replays the actual source-bound selected outputs through the current operators', () => {
    expect(results).toEqual(receipt.results);
    expect(receipt.scope).toBe('isolated-pilot-production-disabled');
    expect(receipt.runtime).toMatchObject({node: '24.15.0', platform: 'win32', arch: 'x64'});
  });

  it('leaves every chemical amount in B unchanged when the transport boundary is closed', () => {
    const c = caseById('closed-ferrous-no-transport');
    expect(c.final.cells[1]).toEqual(c.initial.cells[1]);
    expect(new Set(c.trace.map((frame: any) => frame.cellBHash)).size).toBe(1);
    expect(c.final.observations[1].pH).toBe(c.initial.observations[1].pH);
    expect(c.final.observations[0].pH).toBeLessThan(3);
  });

  it('moves Fe and sulfate into B only with transport and consumes its finite calcite', () => {
    const off = caseById('closed-ferrous-no-transport'), on = caseById('closed-ferrous-transport');
    expect(off.final.cells[1].aqueous.FeII).toBe(0);
    expect(off.final.cells[1].aqueous.sulfate).toBe(0);
    expect(on.final.cells[1].aqueous.FeII).toBeGreaterThan(0);
    expect(on.final.cells[1].aqueous.sulfate).toBeGreaterThan(0);
    expect(on.final.cells[1].aqueous.Ca).toBeGreaterThan(on.initial.cells[1].aqueous.Ca);
    expect(on.final.cells[1].solid.calcite).toBeLessThan(on.initial.cells[1].solid.calcite);
  });

  it('reports locally equilibrated calcite while stock remains, then permits acid breakthrough after exhaustion', () => {
    const c = caseById('closed-hydroxide-transport');
    for (const frame of c.trace) if (frame.calciteMolB > 0) expect(Math.abs(frame.calciteSI[1])).toBeLessThanOrEqual(1e-9);
    expect(c.final.cells[1].solid.calcite).toBe(0);
    expect(c.final.observations[1].pH).toBeLessThan(4);
    const two = caseById('closed-ferrous-transport');
    for (const experiment of [c, two]) {
      const l = experiment.final.cells[0].ledger;
      expect(l.acidProduced).toBeCloseTo(2*l.pyriteOxidized + 2*l.ferrousOxidized, 12);
    }
    const l = c.final.cells[0].ledger;
    expect(l.acidProduced/l.pyriteOxidized).toBeGreaterThan(2);
    expect(l.acidProduced/l.pyriteOxidized).toBeLessThanOrEqual(4);
    expect(c.final.cells[1].aqueous.FeII).toBeGreaterThan(0); // oxygen-limited completion is retained
    expect(c.final.observations[1].pH).toBeLessThan(two.final.observations[1].pH);
  });

  it('closes all tracked inventories at every reaction/transport checkpoint, including gas exchange', () => {
    for (const c of results.cases) {
      expect(c.conservationCheckpoints).toBe(81); // initialization + five boundaries per cycle
      for (const value of Object.values(c.maxResidual)) expect(value).toBeLessThan(TOL);
      expect(() => assertConserved(c.baseline, c.final.cells)).not.toThrow();
      for (const state of c.final.cells) {
        expect(state.waterKg).toBeGreaterThan(0);
        expect(state.aqueous.O2).toBeGreaterThanOrEqual(0);
        if (c.config.boundary === 'closed-carbon') expect(state.ledger.carbonFromGas).toBe(0);
      }
    }
    const open = caseById('open-hydroxide-transport');
    expect(open.initial.cells[1].solid.calcite).not.toBe(caseById('closed-hydroxide-transport').initial.cells[1].solid.calcite);
    expect(open.final.cells.some((c: any) => Math.abs(c.ledger.carbonFromGas) > 0.0001)).toBe(true);
  });

  it('reproduces the untouched distribution example, exposes the older guide discrepancy, and separates closed carbon', () => {
    const {open, closed, distribution, documentationComparison} = results.reference;
    expect(open[0].pH).toBeCloseTo(8.27, 1);
    for (let i=0; i<open.length; i++) {
      expect(Math.abs(open[i].pH - distribution[i].pH)).toBeLessThan(1e-5);
      expect(Math.abs(open[i].gypsum - distribution[i].gypsum)).toBeLessThan(5e-8);
    }
    expect(documentationComparison.guideFinalGypsumMol).toBe(0.00955);
    expect(Math.abs(documentationComparison.differenceMol)).toBeGreaterThan(0.0005);
    for (const row of closed) expect(row.carbon + row.calcite).toBeCloseTo(10, 8);
    for (const row of open) expect(row.carbon + row.calcite + row.gasCarbon).toBeCloseTo(20, 8);
    expect(closed.at(-1)!.pH).not.toBeCloseTo(open.at(-1)!.pH, 2);
    const physics = (file: string) => fs.readFileSync(path.join(ROOT, PREFIX, 'references', file), 'utf8')
      .split('SELECTED_OUTPUT')[0].split(/\r?\n/).filter(line => !line.startsWith('#') && !line.startsWith('TITLE') && !line.includes('CO2(g)')).join('\n');
    expect(physics('example5-closed.pqi')).toBe(physics('example5-open.pqi'));
  });

  it('agrees with native PHREEQC carbonate equilibria on a common water-mass basis and retains the solvent difference', () => {
    for (const control of Object.values(results.carbonateControls) as any[]) {
      expect(Math.abs(control.deltaPH)).toBeLessThan(2e-6);
      expect(Math.abs(control.deltaCaMolKg)).toBeLessThan(2e-10);
      expect(Math.abs(control.deltaCMolKg)).toBeLessThan(2e-10);
      expect(control.deltaWaterKg).toBeGreaterThan(0);
    }
  });
});
