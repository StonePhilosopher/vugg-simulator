import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {nodeRuntimeIdentity, assertCommissionedEvidenceRuntime} from '../../tools/evidence-runtime.mjs';
import {applyGasCarbon} from './ledger.mjs';
import {REFERENCE, createPhreeqc, equilibrateCalcite, speciationDeck, parseSelected,
  assertSpeciation, sha256} from './phreeqc.mjs';
import {EXPERIMENT, CASES, initialCells, runExperiment} from './experiment.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PREFIX = 'pilots/local-acid-buffer/';
export const SOURCE_FILES = ['ledger.mjs', 'phreeqc.mjs', 'experiment.mjs', 'commission.mjs',
  'references/official-ex5.pqi', 'references/example5-open.pqi', 'references/example5-closed.pqi'];
const read = relative => fs.readFileSync(path.join(ROOT, PREFIX, relative), 'utf8').replaceAll('\r\n', '\n');
export const sourceBindings = () => ({
  ...Object.fromEntries(SOURCE_FILES.map(file => [PREFIX+file, sha256(read(file))])),
  'tools/evidence-runtime.mjs': sha256(fs.readFileSync(path.join(ROOT, 'tools/evidence-runtime.mjs'), 'utf8').replaceAll('\r\n', '\n')),
});
const hashObject = obj => sha256(JSON.stringify(obj));

export function replayEngine(transcript) {
  const rows = new Map();
  for (const entry of transcript) {
    if (typeof entry.input !== 'string' || typeof entry.selected !== 'string') throw new Error('Invalid transcript');
    if (rows.has(entry.input) && rows.get(entry.input) !== entry.selected) throw new Error('Conflicting reference observations');
    rows.set(entry.input, entry.selected);
  }
  const run = input => {
    if (!rows.has(input)) throw new Error('No executed PHREEQC observation for this input');
    return rows.get(input);
  };
  return {run, speciate(c, boundary) {
    const result = parseSelected(run(speciationDeck([c], boundary)));
    if (result.length !== 1 || result[0].simulation !== 1) throw new Error('Invalid replay solution');
    const observation = assertSpeciation(c, result[0], boundary);
    return {cell: boundary === 'fixed-pCO2' ? applyGasCarbon(c, observation.C) : structuredClone(c), observation};
  }};
}

function referenceRows(text) {
  const rows = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
  const header = ['reactionO2', 'pH', 'waterKg', 'carbon', 'calcite', 'pyrite', 'goethite', 'gypsum', 'gasCarbon', 'gypsumSI'];
  if (rows[0].join('|') !== header.join('|') || rows.length !== 8) throw new Error('Invalid Example 5 output');
  const result = rows.slice(2).map(row => {
    if (row.length !== header.length || row.some(v => !Number.isFinite(Number(v)))) throw new Error('Invalid Example 5 row');
    return Object.fromEntries(header.map((k,i) => [k, Number(row[i])]));
  });
  if (result.map(x => x.reactionO2).join(',') !== '0,0.001,0.005,0.01,0.03,0.05') throw new Error('Wrong Example 5 steps');
  return result;
}

function nativeCalciteDeck(boundary) {
  const c = initialCells()[1];
  return speciationDeck([c], boundary).replace(/END\n$/, '') + `EQUILIBRIUM_PHASES 1
 Calcite 0 ${c.solid.calcite}
${boundary === 'fixed-pCO2' ? ' CO2(g) -3.5 10\n' : ''}END
`;
}

function summarize(result) {
  const first = result.history[0], last = result.history.at(-1);
  const maxResidual = Object.fromEntries(Object.keys(result.baseline).map(key => [key,
    Math.max(...result.checks.map(frame => Math.abs(frame.residual[key])))]));
  return {config: result.config, baseline: result.baseline, conservationCheckpoints: result.checks.length,
    initial: {cells: first.cells, observations: first.observations},
    final: {cells: last.cells, observations: last.observations}, maxResidual,
    trace: result.history.map(frame => ({cycle: frame.cycle, stage: frame.stage,
      pH: frame.observations.map(x => x.pH), calciteMolB: frame.cells[1].solid.calcite,
      CaMolB: frame.cells[1].aqueous.Ca, CMolB: frame.cells[1].aqueous.C,
      FeIIMolB: frame.cells[1].aqueous.FeII, sulfateMolB: frame.cells[1].aqueous.sulfate,
      alkalinityEqB: frame.cells[1].aqueous.alkalinity, cellBHash: hashObject(frame.cells[1]),
      acceptedPyriteMol: frame.acceptedPyriteMol ?? 0, acceptedFerrousMol: frame.acceptedFerrousMol ?? 0,
      carbonFromGasMol: frame.cells.map(c => c.ledger.carbonFromGas),
      bufferEndpoints: frame.buffer.map(x => x.endpoint),
      calciteSI: frame.observations.map(x => x.calciteSI),
    }))};
}

export function produceResults(engine, progress = () => {}) {
  const reference = {};
  const original = read('references/official-ex5.pqi');
  if (sha256(original) !== REFERENCE.officialExampleLfSha256) throw new Error('Changed original Example 5');
  const table = engine.run(original, 'ex5.sel').trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
  if (table.length !== 8 || !table[0].includes('gypsum')) throw new Error('Invalid distribution example output');
  const index = name => table[0].indexOf(name);
  reference.distribution = table.slice(2).map(row => ({step: Number(row[index('step')]),
    pH: Number(row[index('pH')]), gypsum: Number(row[index('gypsum')])}));
  for (const variant of ['open', 'closed']) {
    reference[variant] = referenceRows(engine.run(read(`references/example5-${variant}.pqi`)));
  }
  for (let i=0; i<6; i++) {
    const original = reference.distribution[i], measured = reference.open[i];
    // Original selected output has fewer printed digits; no chemistry edits.
    if (original.step !== i+1 || !Number.isFinite(original.pH) || !Number.isFinite(original.gypsum)
      || Math.abs(original.pH - measured.pH) > 1e-5 || Math.abs(original.gypsum - measured.gypsum) > 5e-8) {
      throw new Error('Instrumented Example 5 differs from untouched distribution');
    }
  }
  reference.documentationComparison = {
    url: 'https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-67.htm',
    guideFinalGypsumMol: 0.00955, commissionedFinalGypsumMol: reference.open.at(-1).gypsum,
    differenceMol: reference.open.at(-1).gypsum - 0.00955,
    verdict: 'qualitative agreement; older guide value not numerically reproduced by the pinned distribution/database',
  };
  // Native EQUILIBRIUM_PHASES is an independent numerical route to the
  // Fe-free carbonate endpoint used by the bounded bisection adapter.
  const carbonateControls = {};
  for (const boundary of ['closed-carbon', 'fixed-pCO2']) {
    const nativeRows = parseSelected(engine.run(nativeCalciteDeck(boundary)));
    if (nativeRows.length !== 2) throw new Error('Missing native calcite equilibrium output');
    const native = nativeRows[1], pilot = equilibrateCalcite(initialCells()[1], boundary, engine.speciate);
    const deltaPH = pilot.observation.pH - native.pH;
    const deltaDissolvedMol = pilot.dissolvedMol - (native.Ca - initialCells()[1].aqueous.Ca);
    // Native batch equilibration also updates solvent H/O. Compare solution
    // compositions on the SAME kg-water basis; retain the absolute-mol and
    // solvent differences as evidence, without substituting either inventory.
    const deltaCaMolKg = pilot.observation.Ca/pilot.cell.waterKg - native.Ca/native.waterKg;
    const deltaCMolKg = pilot.observation.C/pilot.cell.waterKg - native.C/native.waterKg;
    if (Math.abs(deltaPH) > 2e-6 || Math.abs(deltaCaMolKg) > 2e-10 || Math.abs(deltaCMolKg) > 2e-10) {
      throw new Error('Native calcite control mismatch');
    }
    carbonateControls[boundary] = {native, pilot: pilot.observation, dissolvedMol: pilot.dissolvedMol,
      deltaPH, deltaDissolvedMol, deltaCaMolKg, deltaCMolKg, deltaWaterKg: pilot.cell.waterKg - native.waterKg};
  }
  const cases = CASES.map(config => {
    progress(config.id);
    return summarize(runExperiment(config, engine.speciate));
  });
  return {reference, carbonateControls, cases};
}

export function loadEvidence() {
  const receipt = JSON.parse(read('receipt.json'));
  if (!receipt.runtime) throw new Error('Missing pilot producer runtime');
  assertCommissionedEvidenceRuntime(receipt.runtime);
  if (receipt.schema !== 'vugg-local-acid-buffer-receipt-v1'
    || receipt.scope !== 'isolated-pilot-production-disabled'
    || !isDeepStrictEqual(receipt.sourceBindings, sourceBindings())
    || !isDeepStrictEqual(receipt.dependency, REFERENCE)
    || !isDeepStrictEqual(receipt.experiment, EXPERIMENT)) throw new Error('Stale or incompatible pilot receipt');
  const bytes = fs.readFileSync(path.join(ROOT, PREFIX, 'reference-transcript.json.gz'));
  if (sha256(bytes) !== receipt.transcriptSha256) throw new Error('Reference transcript hash mismatch');
  const transcript = JSON.parse(gunzipSync(bytes, {maxOutputLength: 20*1024*1024}).toString('utf8'));
  if (transcript.length !== receipt.phreeqcCalls) throw new Error('Reference transcript count mismatch');
  return {receipt, transcript};
}

function main(args) {
  const mode = args[0], index = args.indexOf('--phreeqc-root');
  if (!['--write', '--check'].includes(mode) || index !== 1 || args.length !== 3) {
    throw new Error('Usage: node pilots/local-acid-buffer/commission.mjs --write|--check --phreeqc-root PATH');
  }
  assertCommissionedEvidenceRuntime();
  const sources = sourceBindings();
  const dependencyRoot = path.resolve(args[2]);
  const originalExample = fs.readFileSync(path.join(dependencyRoot, 'examples/ex5'), 'utf8').replaceAll('\r\n', '\n');
  if (sha256(originalExample) !== REFERENCE.officialExampleLfSha256) throw new Error('Uncommissioned original Example 5');
  const engine = createPhreeqc({executable: path.join(dependencyRoot, 'bin/Release/phreeqc.exe'),
    database: path.join(dependencyRoot, 'database/phreeqc.dat'),
    workdir: path.join(ROOT, '.local-evidence/acid-buffer-pilot/executions')});
  const started = new Date().toISOString();
  const results = produceResults(engine, id => console.log(`PHREEQC pilot: ${id}`));
  if (!isDeepStrictEqual(sources, sourceBindings())) throw new Error('Pilot source changed during commissioning');
  engine.assertDependencies();
  if (mode === '--write') {
    const transcript = gzipSync(JSON.stringify(engine.transcript), {level: 9});
    const receipt = {schema: 'vugg-local-acid-buffer-receipt-v1', scope: 'isolated-pilot-production-disabled',
      integrationBase: '2f81c230cd17e0b9307401da441a30151ba080c3',
      hashPolicy: 'SHA-256; source text LF-normalized, dependency and gzip bytes raw',
      producedAt: new Date().toISOString(), runtime: nodeRuntimeIdentity(),
      dependency: REFERENCE, sourceBindings: sources, experiment: EXPERIMENT,
      phreeqcCalls: engine.transcript.length, transcriptSha256: sha256(transcript), results};
    fs.writeFileSync(path.join(ROOT, PREFIX, 'reference-transcript.json.gz'), transcript);
    fs.writeFileSync(path.join(ROOT, PREFIX, 'receipt.json'), JSON.stringify(receipt, null, 2)+'\n');
  } else {
    const {receipt} = loadEvidence();
    if (!isDeepStrictEqual(receipt.results, results)) throw new Error('Live PHREEQC results differ from receipt');
  }
  const execution = {mode, started, completed: new Date().toISOString(), runtime: nodeRuntimeIdentity(),
    phreeqcCalls: engine.transcript.length, sourceBindings: sourceBindings(), status: 'passed'};
  fs.writeFileSync(path.join(ROOT, '.local-evidence/acid-buffer-pilot', `execution-${mode.slice(2)}.json`), JSON.stringify(execution,null,2)+'\n');
  console.log(`Passed: ${CASES.length} pilot cases, 2 Example 5 variants, 2 native calcite controls; ${engine.transcript.length} PHREEQC calls.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
