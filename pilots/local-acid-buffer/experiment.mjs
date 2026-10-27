import {cell, inventory, assertConserved, oxidizePyrite, oxidizeFerrous, exchangeWater} from './ledger.mjs';
import {equilibrateCalcite} from './phreeqc.mjs';

export const EXPERIMENT = Object.freeze({
  schema: 'vugg-local-acid-buffer-experiment-v1',
  temperatureC: 25, pressureAtm: 1,
  units: 'mol components, eq alkalinity, kg solvent, dimensionless exchange fraction',
  waterKgPerCell: 1, NaClMolPerCell: 0.001,
  pyriteMolA: 0.002, O2MolA: 0.003, calciteMolB: 0.001,
  dissolvedCaAndCMolB: 0.0001,
  pulseMol: 0.0002, pulses: 4, cycles: 16, exchangeFraction: 0.25,
  kinetics: 'authored extents, not a rate law; cycles have no physical duration',
  reactionSchedule: 'oxidation -> finite calcite -> conservative exchange -> finite calcite/speciation',
  gas: 'closed-carbon or fixed-pCO2=10^-3.5 atm, independently in each cell',
  phases: 'finite dissolution-only calcite; prescribed Fe(OH)3 endpoint; no other precipitates',
});
export const CASES = [
  {id: 'closed-ferrous-no-transport', boundary: 'closed-carbon', iron: 'ferrous', exchange: 0},
  {id: 'closed-ferrous-transport', boundary: 'closed-carbon', iron: 'ferrous', exchange: 0.25},
  {id: 'closed-hydroxide-transport', boundary: 'closed-carbon', iron: 'ferric-hydroxide', exchange: 0.25},
  {id: 'open-hydroxide-transport', boundary: 'fixed-pCO2', iron: 'ferric-hydroxide', exchange: 0.25},
];

export function initialCells() {
  const e = EXPERIMENT, common = {waterKg: e.waterKgPerCell};
  const background = {Na: e.NaClMolPerCell, Cl: e.NaClMolPerCell};
  return [
    cell({...common, id: 'A-pyrite', pyrite: e.pyriteMolA,
      aqueous: {...background, O2: e.O2MolA}}),
    cell({...common, id: 'B-calcite', calcite: e.calciteMolB,
      aqueous: {...background, Ca: e.dissolvedCaAndCMolB, C: e.dissolvedCaAndCMolB,
        alkalinity: 2*e.dissolvedCaAndCMolB}}),
  ];
}

export function runExperiment(config, speciate) {
  if (!CASES.some(c => JSON.stringify(c) === JSON.stringify(config))) throw new Error('Unauthored experiment case');
  let cells = initialCells();
  const baseline = inventory(cells), history = [], checks = [];
  const check = (cycle, stage) => {
    const residual = assertConserved(baseline, cells);
    checks.push({cycle, stage, residual});
    return residual;
  };
  function buffer() {
    const endpoints = cells.map(c => equilibrateCalcite(c, config.boundary, speciate));
    cells = endpoints.map(x => x.cell);
    return endpoints.map(({dissolvedMol, endpoint, observation}) => ({dissolvedMol, endpoint, observation}));
  }
  const initialBuffer = buffer();
  history.push({cycle: 0, stage: 'initialized-and-buffered', cells: structuredClone(cells), buffer: initialBuffer,
    observations: initialBuffer.map(x => x.observation), residual: check(0, 'initialized')});
  for (let cycle=1; cycle<=EXPERIMENT.cycles; cycle++) {
    const requestedMol = cycle <= EXPERIMENT.pulses ? EXPERIMENT.pulseMol : 0;
    const pyrite = oxidizePyrite(cells[0], requestedMol);
    cells[0] = pyrite.cell;
    check(cycle, 'pyrite-accepted');
    const ferrous = oxidizeFerrous(cells[0], config.iron === 'ferric-hydroxide' ? cells[0].aqueous.FeII : 0);
    cells[0] = ferrous.cell;
    check(cycle, 'ferrous-accepted');
    const localBuffer = buffer();
    check(cycle, 'before-transport-buffer');
    const exchange = exchangeWater(cells[0], cells[1], config.exchange);
    cells = exchange.cells;
    check(cycle, 'conservative-exchange');
    // Re-equilibrate finite calcite after arrival too: a reported frame must
    // not show an artificial acid pulse waiting for the next split interval.
    const settled = buffer();
    history.push({cycle, stage: 'post-transport-buffered',
      requestedPyriteMol: requestedMol, acceptedPyriteMol: pyrite.acceptedMol, acceptedFerrousMol: ferrous.acceptedMol,
      beforeTransportBuffer: localBuffer, buffer: settled,
      exchangedWaterKg: exchange.exchangedWaterKg, transferred: exchange.transferred,
      cells: structuredClone(cells), observations: settled.map(x => x.observation),
      residual: check(cycle, 'after-transport-buffer')});
  }
  return {config, baseline, history, checks};
}
