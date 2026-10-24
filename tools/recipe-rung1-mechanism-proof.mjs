// Bounded SIM285 -> SIM286 identity audit of the normal mechanism producer.
// Observes its API calls; no source/engine/zone or official receipt is rewritten.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadSimBundle} from './_harness.mjs';
import {buildMechanismWitnessArtifact} from './gen-mechanism-witnesses.mjs';
import {assertCommissionedEvidenceRuntime,assertIndexMatchesDist,runtimeExecutionDigest} from './evidence-runtime.mjs';
const BASE='e2142582c5fa69e6b0dff306ccdc84597533ad1f';
const hash=value=>createHash('sha256').update(value).digest('hex');
const old=file=>JSON.parse(execFileSync('git',['show',`${BASE}:${file}`],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
assertCommissionedEvidenceRuntime();assertIndexMatchesDist(process.cwd());
const execution=runtimeExecutionDigest(process.cwd());
const prior=old('archive/evidence/mechanism-witnesses-v285.json');
const producer='tools/gen-mechanism-witnesses.mjs',source=fs.readFileSync(producer,'utf8');
// Request the producer's exact export set before the shared harness memoizes it.
const block=source.match(/export async function buildMechanismWitnessArtifact[\s\S]*?extraExports:\s*\[([\s\S]*?)\]/);
assert.ok(block,'Cannot locate the producer export contract');
const exports=[...block[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const api=await loadSimBundle({toolName:'recipe-rung1-mechanism-proof',extraExports:[...exports,'simulationStateProjection']});
assert.equal(api.SIM_VERSION,286);
const fingerprint=api.simulationStateFingerprint,datasetDigest=api.stripDurableDatasetDigest;
const projections=[],datasets=[];
const oldModel=prior.model_digest;
api.simulationStateFingerprint=sim=>{
  const actual=fingerprint(sim),projection=api.simulationStateProjection(sim);
  const comparison={...projection,simVersion:285,modelDigest:oldModel};
  projections.push({actual,priorIdentityOnly:hash(JSON.stringify(comparison))});
  assert.equal(fingerprint(sim),actual,'Observation changed a mechanism state');
  return actual;
};
api.stripDurableDatasetDigest=async ds=>{
  const actual=await datasetDigest(ds);
  const comparison={...ds,manifest:{...ds.manifest,sim_version:285,model_digest:oldModel}};
  datasets.push({actual,priorIdentityOnly:await datasetDigest(comparison),
    actualManifest:hash(JSON.stringify(ds.manifest)),priorIdentityOnlyManifest:hash(JSON.stringify(comparison.manifest))});
  assert.equal(await datasetDigest(ds),actual,'Observation changed the controlled dataset');
  return actual;
};
let observed;
try { observed=await buildMechanismWitnessArtifact(process.cwd()); }
finally { api.simulationStateFingerprint=fingerprint;api.stripDurableDatasetDigest=datasetDigest; }
const current=read('archive/evidence/mechanism-witnesses-v286.json');
assert.deepEqual(observed,current,'Observed producer must reproduce the actual normal receipt exactly');
assert.equal(projections.length,2);assert.equal(datasets.length,1);
const compared=structuredClone(observed.payload);
for(const [i,key] of ['wait_only','heat_choice'].entries()){
  const before=prior.payload.player_movement_choice[key].state_fingerprint;
  assert.equal(projections[i].priorIdentityOnly,before);
  assert.equal(projections[i].actual,compared.player_movement_choice[key].state_fingerprint);
  compared.player_movement_choice[key].state_fingerprint=before;
}
const oldReceipt=prior.payload.guided_tutorial.strip_target.receipt;
const newReceipt=compared.guided_tutorial.strip_target.receipt,d= datasets[0];
assert.equal(d.priorIdentityOnly,oldReceipt.dataset_digest_sha256);
assert.equal(d.priorIdentityOnlyManifest,oldReceipt.manifest_digest_sha256);
assert.equal(d.actual,newReceipt.dataset_digest_sha256);assert.equal(d.actualManifest,newReceipt.manifest_digest_sha256);
Object.assign(newReceipt,{sim_version:285,model_digest:oldModel,
  manifest_digest_sha256:d.priorIdentityOnlyManifest,dataset_digest_sha256:d.priorIdentityOnly});
const oldBrowser=old('archive/evidence/guided-tutorial-browser-v285.json');
const currentBrowser=read('archive/evidence/guided-tutorial-browser-v286.json');
assert.equal(compared.guided_tutorial.interaction_products.capable_browser_authority.payload_sha256,currentBrowser.payload_sha256);
assert.equal(prior.payload.guided_tutorial.interaction_products.capable_browser_authority.payload_sha256,oldBrowser.payload_sha256);
compared.guided_tutorial.interaction_products.capable_browser_authority.payload_sha256=oldBrowser.payload_sha256;
assert.deepEqual(compared,prior.payload,'Mechanism payload changed beyond the seven proved identity-derived fields');
assert.equal(runtimeExecutionDigest(process.cwd()),execution,'Runtime changed during observation');
const result={schema:'recipe-rung1-mechanism-identity-proof-v1',base:BASE,runtime_execution_sha256:execution,
  producer_source_sha256:hash(source.replaceAll('\r\n','\n')),observer_source_sha256:hash(fs.readFileSync(import.meta.filename,'utf8').replaceAll('\r\n','\n')),
  comparison_only_identity_substitution:true,actual_normal_receipt_reproduced:true,
  physical_payload_changes:0,proved_identity_derived_changes:7,projections,datasets,
  browser_payload_reference:{before:oldBrowser.payload_sha256,after:currentBrowser.payload_sha256,
    proof:'recipe-identity-browser-validation.json checks the complete browser payload and actual old-identity recovery'},
  trust:'local-commissioned-Node-reproduction-not-independent-attestation'};
fs.writeFileSync('proposals/evidence/recipe-identity-mechanism-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
