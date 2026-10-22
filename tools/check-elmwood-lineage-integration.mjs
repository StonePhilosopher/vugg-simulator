// Read-only comparison for the bounded PR #21 reconciliation. This authenticates
// continuity against published inputs; it does not calibrate a morphology law.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertCommissionedEvidenceRuntime,runtimeExecutionDigest} from './evidence-runtime.mjs';

const root=path.resolve(import.meta.dirname,'..');
const prior='277fc45a490f1931ec4c5c09db8294c3eba18f53';
const base='6ac66e385df65ac2c4a5509297284d1998d63bae';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true}).trimEnd();
const old=(ref,file)=>JSON.parse(git('show',`${ref}:${file}`));
const current=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceHash=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n')).digest('hex');
assertCommissionedEvidenceRuntime();
const execution=runtimeExecutionDigest(root);
const added=new Set(['celestine_history','celestine_origin','celestine_morphology','celestine_disclosure','habit_authority']);
const omitLineage=value=>Array.isArray(value)?value.map(omitLineage):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([key])=>!added.has(key)).map(([key,item])=>[key,omitLineage(item)])):value;

assert.equal(git('diff','--name-only',prior,'--','js'),'','Elmwood runtime implementation changed during reconciliation');
assert.equal(git('diff','--name-only',base,'--','data/minerals.json','data/scenarios.json5','data/thermo-carbonates.json','data/thermo-sulfates.json'),'',
  'Scientific inputs changed during reconciliation');
const strips=[];
for(const filename of fs.readdirSync(path.join(root,'archive/strips/v285')).sort()){
  if(!filename.endsWith('.json'))continue;
  const file=`archive/strips/v285/${filename}`,after=current(file);
  if(!after.scenario)continue;
  assert.deepEqual(after,old(prior,file),`${file}: prior lineage history changed`);
  const before=old(base,file),without=omitLineage(after);
  assert.deepEqual(without,before,`${file}: state drift beyond the five explicit lineage fields`);
  strips.push({scenario:after.scenario,preservedPriorPayloadSha256:hash(after),
    preservedMainPayloadSha256:hash(without),
    recordedLayers:after.executed_testimony.layer_growth.filter(zone=>zone.celestine_history).length});
}
assert.equal(strips.length,41);
const baselines=[];
for(const file of ['tests-js/baselines/seed42_v285.json','tests-js/baselines/strip_digest_v285.json','tests-js/baselines/locality_frequency_v285.json']){
  const after=current(file),before=old(base,file),previous=old(prior,file);
  const payload=value=>value.scenarios||value;
  assert.deepEqual(payload(after),payload(before),`${file}: main numerical outcomes changed`);
  assert.deepEqual(payload(after),payload(previous),`${file}: prior numerical outcomes changed`);
  baselines.push({file,preservedPayloadSha256:hash(payload(after))});
}
const censusFile='pilots/calcite/volume-census.json';
const census=current(censusFile),oldCensus=old(base,censusFile);
assert.equal(census.runtimeDigest,execution,'Fresh calcite census required for the reconciled runtime');
for(const [file,expected] of Object.entries(census.sourceHashes))assert.equal(sourceHash(file),expected,`Stale census source: ${file}`);
const scalarRows=receipt=>receipt.scenarios.map(({fingerprint,...row})=>row);
assert.deepEqual(scalarRows(census),scalarRows(oldCensus),'Calcite measured volumes, factors or coverage changed');
const reportFile='pilots/calcite/factor-coverage.json',report=current(reportFile),oldReport=old(base,reportFile);
assert.equal(report.runtimeDigest,execution,'Fresh factor report required');
assert.equal(report.examples.elmwood.audit.model.runtimeDigest,execution,'Fresh live specimen required');
assert.equal(report.fleetReceiptSha256,sourceHash(censusFile),'Factor report bound to a different census');
for(const [file,expected] of Object.entries({...report.sourceHashes,...report.examples.elmwood.audit.model.sourceHashes})){
  assert.equal(sourceHash(file),expected,`Stale factor-report source: ${file}`);
}
assert.deepEqual(report.fleet,oldReport.fleet,'Calcite fleet coverage changed');
for(const name of ['controlled','elmwood']){
  assert.deepEqual(report.examples[name].audit.samples,oldReport.examples[name].audit.samples,`${name}: calcite geometry factors changed`);
  assert.deepEqual(report.examples[name].replay,oldReport.examples[name].replay,`${name}: reconstruction changed`);
  assert.deepEqual(report.examples[name].productionGate,oldReport.examples[name].productionGate,`${name}: production hold changed`);
}
assert.equal(report.productionHeld,true);
assert.deepEqual(current('pilots/calcite/golden.json'),old(base,'pilots/calcite/golden.json'),'Calcite golden specimen changed');
const result={schema:'elmwood-lineage-integration-continuity-v1',prior,base,runtimeDigest:execution,
  verifierSha256:sourceHash('tools/check-elmwood-lineage-integration.mjs'),
  scope:'Published-lineage implementation and histories retained; current-main numerical and calcite geometry quantities unchanged. No physical-volume or morphology calibration claim.',
  lineageFieldAllowlist:[...added],strips,baselines,
  calcite:{scenarios:census.scenarios.length,unchangedMeasuredRowsSha256:hash(scalarRows(census)),
    changedStateFingerprints:census.scenarios.filter((row,index)=>row.fingerprint!==oldCensus.scenarios[index].fingerprint).length,
    fullFormAttachmentContactFactorsUnchanged:true,reconstructionUnchanged:true,goldenUnchanged:true,productionHeld:true}};
const output=path.join(root,'.local-evidence/elmwood-integration-continuity.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({strips:strips.length,recordedLayers:strips.reduce((sum,row)=>sum+row.recordedLayers,0),
  baselines:baselines.length,calcite:result.calcite,output},null,2));
