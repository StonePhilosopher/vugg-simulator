// Commission the dimensional observation of ONE initial MVT specimen, no run.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadSimBundle} from '../../tools/_harness.mjs';
import {parseScenarioDocument} from '../../tools/scenario-authoring.mjs';
import {buildSourceAudit} from '../finite-reservoir-authority/audit.mjs';
import {observeInitialWallReference,preflightWallReference} from './preflight.mjs';

const ROOT='pilots/reservoir-reference-preflight/';
const FILES=['preflight.mjs','receipt.mjs','reference.py'];
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
export async function buildMvtPreflightReceipt(h){
  const audit=buildSourceAudit();
  const raw=parseScenarioDocument(fs.readFileSync('data/scenarios.json5','utf8')).scenarios.mvt;
  // A private disposable initialization. The observation itself never draws RNG.
  h.setSeed(42);
  const {conditions}=h.SCENARIOS.mvt(),sim=new h.VugSimulator(conditions);
  const record=preflightWallReference(observeInitialWallReference(h,sim));
  assert.equal(record.observation.conditions.temperatureC,raw.initial.temperature_C);
  assert.equal(record.observation.conditions.pressureKbar,raw.initial.pressure_kbar);
  assert.equal(record.observation.conditions.salinityIndex,raw.initial.fluid.salinity);
  return {schema:'vugg-mvt-reservoir-reference-receipt-v1',base:'01903bbe84766aa8b795047b363a8e38ba03d9b2',
    runtime:audit.runtime,productionExecutionDigest:audit.productionExecutionDigest,
    registeredProducerContractsUnchanged:audit.registeredProducerContractsUnchanged,
    productionSourceHashes:{...audit.sourceHashes,...Object.fromEntries([
      'js/23d-geometry-cavity-production-authority.ts','js/85l-simulation-command-protocol.ts',
      'tools/_harness.mjs'].map(f=>[f,hash(f)]))},
    sourceHashes:Object.fromEntries(FILES.map(f=>[ROOT+f,hash(ROOT+f)])),
    scenario:'mvt',seed:42,scope:'one initial production geometry and noncommitting reference dissolution preview; no growth fleet',
    authoredInputs:{temperatureC:raw.initial.temperature_C,pressureKbar:raw.initial.pressure_kbar,
      salinityIndex:raw.initial.fluid.salinity,wall:raw.initial.wall},
    absentPhysicalInputs:{cellSolventKg:null,solutionDensityKgM3:null,solventMassFraction:null,
      accessibleWallCalciteMol:null,cellAllocation:null},
    record,productionMappingAllowed:false,reactions:false,transport:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const result=await buildMvtPreflightReceipt(await loadSimBundle({toolName:'mvt-reservoir-reference-preflight',
    extraExports:['localStateFoundationFor']}));
  const serialized=JSON.stringify(result,null,2)+'\n',output=ROOT+'receipt.json';
  if(process.argv.includes('--write'))fs.writeFileSync(output,serialized);
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n'),serialized,
    'MVT reference preflight evidence is stale');
  console.log(JSON.stringify({scenario:result.scenario,volumeMm3:result.record.observation.volumeMm3,
    nominalEquivalentSolventKg:result.record.nominalTargetEquivalentSolventKg,
    requiredSolventKgPerM3:result.record.requiredSolventKgPerM3OfWholeCavity,productionMappingAllowed:false}));
}
