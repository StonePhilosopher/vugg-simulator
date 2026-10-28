// Read-only authority census of authored initial inputs, not a growth census.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseScenarioDocument} from '../../tools/scenario-authoring.mjs';
import {loadSimBundle} from '../../tools/_harness.mjs';
import {assertCommissionedEvidenceRuntime,nodeRuntimeIdentity,runtimeExecutionDigest,
  producerContractDigest} from '../../tools/evidence-runtime.mjs';

const OUTPUT='pilots/finite-reservoir-authority/source-audit.json';
const WALL_OUTPUT='pilots/finite-reservoir-authority/wall-reference-census.json';
const BASE='c2651d4f2c2526b4944ef853ea6676bd9b4afd97';
// Re-pinned by the raw surface-read perf change: its runtime bytes moved, no simulated result did.
const EXECUTION='64cdfb541681cdf15aeee4cbf96496a78e0ef6230639252f7065523db9c64c85';
const SOURCES=['data/scenarios.json5','js/19-mineral-stoichiometry.ts',
  'js/20-chemistry-fluid.ts','js/20b-chemistry-carbonate-system.ts',
  'js/22-geometry-wall.ts','js/22a-geometry-cavity-evolution.ts',
  'js/24-geometry-voxel-grid.ts','js/24e-local-conserved-state.ts',
  'js/27-geometry-crystal.ts','js/85c-simulator-state.ts',
  'pilots/calcite/volume-contract.js','pilots/finite-reservoir-authority/contract.mjs',
  'pilots/finite-reservoir-authority/audit.mjs'];
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');

export function buildSourceAudit() {
  assertCommissionedEvidenceRuntime();
  assert.equal(runtimeExecutionDigest(process.cwd()),EXECUTION,
    'This declaration-only tranche requires the pinned production runtime to remain unchanged');
  const science=JSON.parse(fs.readFileSync('archive/evidence/v286.json','utf8'));
  const producers=Object.fromEntries(Object.keys(science.producer_contracts).map(kind=>
    [kind,producerContractDigest(process.cwd(),kind)]));
  assert.deepEqual(producers,science.producer_contracts,'Registered science producers changed');
  const document=parseScenarioDocument(fs.readFileSync('data/scenarios.json5','utf8'));
  const baseline=JSON.parse(fs.readFileSync('tests-js/baselines/seed42_v286.json','utf8'));
  assert.deepEqual(Object.keys(document.scenarios).sort(),Object.keys(baseline).sort(),
    'Audit must enumerate the entire authored fleet, without procedural/random inputs');
  const rows=Object.entries(document.scenarios).sort(([a],[b])=>a.localeCompare(b)).map(([id,s])=>{
    const initial=s.initial||{},fluid=initial.fluid||{},wall=initial.wall||{},boundary=s.carbonate_boundary||{};
    const fields=['Ca','CO3','Fe','S_sulfate','O2'];
    return {scenario:id,
      authoredFiniteWaterFields:Object.keys(initial).filter(k=>/^(waterKg|water_kg|cellWater|finite_reservoirs)$/.test(k)),
      rawFluidFields:Object.fromEntries(fields.map(k=>[k,Object.hasOwn(fluid,k)?fluid[k]:null])),
      missingRawFields:fields.filter(k=>!Object.hasOwn(fluid,k)),
      rawPH:Object.hasOwn(fluid,'pH')?fluid.pH:null,
      rawSulfurPoolsExplicit:Object.hasOwn(fluid,'sulfurPoolsExplicit')?fluid.sulfurPoolsExplicit:null,
      declaredCarbonateDIC:Object.hasOwn(boundary,'initial_DIC_mol_kg'),
      declaredReducedAlkalinity:Object.hasOwn(boundary,'reduced_alkalinity_eq_per_kg'),
      rawWallComposition:wall.composition??null,
      rawWallThicknessMm:Object.hasOwn(wall,'thickness_mm')?wall.thickness_mm:null};
  });
  return {schema:'vugg-finite-reservoir-source-audit-v1',base:BASE,
    runtime:nodeRuntimeIdentity(),productionExecutionDigest:EXECUTION,
    productionRuntimeUnchanged:true,registeredProducerContractsUnchanged:true,
    producerContracts:producers,sourceHashes:Object.fromEntries(SOURCES.map(f=>[f,hash(f)])),
    observation:'raw authored declarations only; no growth or transport executed; absent raw values are null, never inferred zero',
    summary:{authoredScenarios:rows.length,
      scenariosWithFiniteWaterDeclarations:rows.filter(r=>r.authoredFiniteWaterFields.length).length,
      scenariosWithDeclaredDICAndReducedAlkalinity:rows.filter(r=>r.declaredCarbonateDIC&&r.declaredReducedAlkalinity).length,
      modeledLimestoneWallProxies:rows.filter(r=>r.rawWallComposition==='limestone').length,
      modeledDolomiteWallProxies:rows.filter(r=>r.rawWallComposition==='dolomite').length},
    candidates:{
      water:{owner:'no legacy physical per-cell mass owner',basis:'mg/kg-solvent concentrations do not supply kg water',
        missing:['physical water mass or an evidenced wet-volume/density mapping','canonical cell allocation'],eligible:false},
      wall:{owner:'one conditions.wall host ledger',basis:'calibrated mmol formula/kg solvent reference; transactions name a 1 kg reference',
        missing:['physical/reference-stock reconciliation','explicit spatial stock allocation'],eligible:false,
        rule:'never duplicate the global host stock into every voxel; dolomite is not calcite'},
      crystal:{owner:'accepted-zone remaining booked uptake',basis:'remaining thickness times booked mg/kg-reference per micrometre',
        missing:['reference-to-absolute inventory mapping','per-crystal spatial debit ownership'],eligible:false},
      surface:{owner:'procedural completed surface',basis:'mm3; scientific-solid closure unresolved',
        rule:'forbidden as a substitute for chemical inventory',eligible:false}},
    primaryEvidence:[
      {url:'https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-48.htm',
        supports:'Explicit kg solvent converts molality into absolute component moles; pH is not that water inventory.'},
      {url:'https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-13.htm',
        supports:'Pure-phase amount is an independently specified finite stock in moles, not an aqueous concentration.'}],
    productionAllowed:false,reactions:false,transport:false,scenarios:rows};
}

export function inspectLegacyWallReference(wall) {
  if (!wall || typeof wall!=='object') throw Error('A resolved model wall is required');
  const initial=wall.host_formula_inventory_initial_mmolkg;
  const released=wall.host_formula_released_mmolkg;
  const thickness=wall.thickness_mm;
  if ([initial,released,thickness].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)
      || released>initial) throw Error('Incomplete/invalid wall reference inventory');
  const formula=wall.composition==='limestone'?'CaCO3':wall.composition==='dolomite'?'CaMg(CO3)2':null;
  const remaining=initial-released;
  if (!formula && (initial!==0||released!==0)) throw Error('Noncarbonate model host has carbonate reference inventory');
  // This is the EXISTING reference calibration, not a new density or reactive
  // phase-fraction model. Check it in its own units; never convert it to mol.
  const thicknessReference=formula?thickness*(15/40.078):0;
  const residual=remaining-thicknessReference;
  if (Math.abs(residual)>1e-9) throw Error('Wall reference ledger/thickness closure failed');
  return {owner:'conditions.wall (one global model ledger)',modeledHost:wall.composition,
    modeledFormula:formula,units:'mmol_formula_per_kg_solvent_reference',
    initial,released,remaining,referenceResidual:residual,legacyTolerance:1e-9,
    calibration:'existing 15 mg Ca per kg reference per mm; Ca formula mass 40.078 g/mol',
    physicalWaterKg:null,physicalCalciteMol:null,productionBufferEligible:false,
    reason:formula==='CaMg(CO3)2'?'dolomite proxy is not a pure-calcite reservoir'
      :formula?'global reference stock has no commissioned physical-mass or cell-allocation mapping'
        :'no carbonate stock in the existing model host'};
}

export function buildWallReferenceCensus(h) {
  const sourceAudit=buildSourceAudit();
  const rows=[];
  for (const id of sourceAudit.scenarios.map(x=>x.scenario)) {
    h.setSeed(42);
    const {conditions}=h.SCENARIOS[id]();
    const before=JSON.stringify(conditions.wall);
    const reference=inspectLegacyWallReference(conditions.wall);
    assert.equal(JSON.stringify(conditions.wall),before,'Inspection mutated '+id);
    rows.push({scenario:id,initialTemperatureC:conditions.temperature,
      initialFluidPressureKbar:conditions.pressure,reference,observationDidNotMutate:true});
  }
  return {schema:'vugg-wall-reference-authority-census-v1',base:BASE,seed:42,
    runtime:sourceAudit.runtime,productionExecutionDigest:EXECUTION,
    sourceHashes:sourceAudit.sourceHashes,
    scope:'actual scenario constructor state, before VugSimulator construction; no growth, dissolution or geometry authority installed',
    quantity:'legacy model reference formula inventory only; not physical moles, not per-cell stocks',
    sourceAuditSha256:hash(OUTPUT),scenarioCount:rows.length,
    productionAllowed:false,scenarios:rows};
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const wallMode=process.argv.includes('--wall-census');
  const result=wallMode?buildWallReferenceCensus(await loadSimBundle({toolName:'finite-wall-reference-census'})):buildSourceAudit();
  const serialized=JSON.stringify(result,null,2)+'\n',output=wallMode?WALL_OUTPUT:OUTPUT;
  if (process.argv.includes('--write')) fs.writeFileSync(output,serialized);
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n'),serialized,'Authority receipt is stale');
  console.log(JSON.stringify(wallMode?{scenarioCount:result.scenarioCount,productionAllowed:false}
    :{...result.summary,productionAllowed:false,productionRuntimeUnchanged:true,registeredProducerContractsUnchanged:true}));
}
