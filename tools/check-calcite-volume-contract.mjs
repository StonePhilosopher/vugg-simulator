// Read-only comparison to the commissioned integration baseline. The fresh
// census is produced separately; this command never rebakes a baseline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertCommissionedEvidenceRuntime,nodeRuntimeIdentity,runtimeExecutionDigest} from './evidence-runtime.mjs';
const base='91e5cc1102b453acac1638adb40b51587b75115e';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}).trimEnd();
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const old=file=>JSON.parse(git('show',`${base}:${file}`));
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
assertCommissionedEvidenceRuntime();
assert.equal(git('diff','--name-only',base,'--','js','data','index.html'),'','Shipped runtime or data changed');
const histories=[];
for(const name of fs.readdirSync('archive/strips/v285').sort()){
  if(!name.endsWith('.json'))continue;
  const file=`archive/strips/v285/${name}`,value=read(file);
  if(!value.scenario)continue;
  assert.deepEqual(value,old(file),file);histories.push(value.scenario);
}
assert.equal(histories.length,41);
for(const file of ['seed42_v285.json','strip_digest_v285.json','locality_frequency_v285.json']){
  assert.deepEqual(read(`tests-js/baselines/${file}`),old(`tests-js/baselines/${file}`),file);
}
const file='pilots/calcite/volume-census.json',census=read(file);
assert.equal(census.runtimeDigest,runtimeExecutionDigest(process.cwd()));
for(const [file,digest] of Object.entries(census.sourceHashes))assert.equal(hash(file),digest,file);
assert.deepEqual(census.scenarios,old(file).scenarios,'Fresh 41-scenario values/fingerprints differ');
assert.equal(census.scenarios.length,41);
const report=read('pilots/calcite/factor-coverage.json'),prior=old('pilots/calcite/factor-coverage.json');
assert.equal(report.fleetReceiptSha256,hash(file));assert.deepEqual(report.fleet,prior.fleet);
for(const name of ['controlled','elmwood']){
  const a=report.examples[name],b=prior.examples[name];
  assert.deepEqual(a.audit.samples,b.audit.samples,`${name}: measured factors changed`);
  assert.deepEqual(a.replay,b.replay,`${name}: replay changed`);
  assert.equal(a.productionGate.allowed,false);
  assert.ok(a.volumeContracts.every(v=>v.arithmeticClosure==='passed'&&v.physicalClosure==='unresolved'&&!v.productionAllowed));
}
const golden=read('pilots/calcite/golden.json'),oldGolden=old('pilots/calcite/golden.json');
assert.deepEqual(golden.geometrySha256ByStep,oldGolden.geometrySha256ByStep);
assert.deepEqual(golden.bookedVolumeMm3ByStep,oldGolden.bookedVolumeMm3ByStep);
assert.notEqual(golden.specimenSha256,oldGolden.specimenSha256,'New contract must not masquerade as the old envelope');
const result={schema:'calcite-volume-contract-validation-v1',base,runtime:nodeRuntimeIdentity(),
  runtimeExecutionDigest:census.runtimeDigest,sourceHashes:Object.fromEntries([
    'pilots/calcite/volume-contract.js','pilots/calcite/authority.js','pilots/calcite/specimen.js',
    'pilots/calcite/census.mjs','pilots/calcite/factor-report.mjs','tests-js/calcite-solid-authority.test.ts',
    'tools/check-calcite-volume-contract.mjs'].map(f=>[f,hash(f)])),
  comparison:{freshScenarioCensus:41,allMeasurementsAndFingerprintsUnchanged:true,historyPayloadsUnchanged:histories.length,
    numericalBaselinesUnchanged:3,geometryGoldenUnchanged:true,bookedVolumeGoldenUnchanged:true,
    envelopeChange:'v2 explicitly carries executable volume reconciliation; legacy v1 refused, not upgraded'},
  physicalClosure:'unresolved',productionOptIn:'withheld',
  independentChecks:'Stored planes independently re-intersected by factor audit; factors are per-record representation ratios, not a physical calibration.',
  unverified:['Dense-solid mass/dimension/geometry reconciliation','Scientifically resolved face arrest and internal surviving boundaries',
    '43 excluded fleet calcites; scalar fleet receipt has no phase/contact-topology evidence']};
fs.mkdirSync('proposals/evidence',{recursive:true});
fs.writeFileSync('proposals/evidence/calcite-volume-contract-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
