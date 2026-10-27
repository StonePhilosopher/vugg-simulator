// Run from repo root after the real evidence producers. Read-only comparison
// of physical artifacts against PR #35's merged base; writes only this report.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runtimeExecutionDigest,nodeRuntimeIdentity,assertCommissionedEvidenceRuntime} from '../../tools/evidence-runtime.mjs';
assertCommissionedEvidenceRuntime();
const base='db2c17bdac4e7fd3dbcdad1fd03d23f6654d661d';
const norm=s=>s.replaceAll('\r\n','\n');
const hash=s=>createHash('sha256').update(norm(s)).digest('hex');
const oldText=file=>execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8',maxBuffer:64*1024*1024});
const nowText=file=>fs.readFileSync(file,'utf8');
const read=file=>JSON.parse(nowText(file));
const old=file=>JSON.parse(oldText(file));
const checks=[];
function same(file,projection=x=>x,label=file){
  assert.deepEqual(projection(read(file)),projection(old(file)),label);
  checks.push({label,file,before_sha256:hash(oldText(file)),after_sha256:hash(nowText(file)),physical_changes:0});
}
for(const kind of ['seed42','locality_frequency','strip_digest'])same(`tests-js/baselines/${kind}_v286.json`);
for(const directory of ['archive/strips/v286','archive/claim-cards/v286']){
  const files=execFileSync('git',['ls-tree','-r','--name-only',base,directory],{encoding:'utf8'})
    .trim().split('\n').filter(x=>x.endsWith('.json'));
  assert.equal(files.length,41);
  for(const file of files)same(file);
}
same('pilots/calcite/volume-census.json',x=>x.scenarios,'all 41 live final state fingerprints and captured calcite factors');
same('pilots/calcite/golden.json');
// This one model field binds the freshly recorded specimen to runtime bytes.
// Check its new value explicitly; compare every other model/audit field.
const withoutRuntime=model=>{const copy={...model};delete copy.runtimeDigest;return copy;};
assert.equal(read('pilots/calcite/factor-coverage.json').examples.elmwood.audit.model.runtimeDigest,
  runtimeExecutionDigest(process.cwd()));
same('pilots/calcite/factor-coverage.json',x=>({volumeContract:x.volumeContract,fleet:x.fleet,
  examples:Object.fromEntries(Object.entries(x.examples).map(([name,e])=>[name,{
    sourceClass:e.sourceClass,volumeContracts:e.volumeContracts,
    audit:{...e.audit,model:name==='elmwood'?withoutRuntime(e.audit.model):e.audit.model},
    replay:e.replay,productionGate:e.productionGate,
  }])),productionHeld:x.productionHeld}),'calcite contract, factors, geometry and production hold');
assert.equal(read('pilots/calcite/volume-census.json').runtimeDigest,runtimeExecutionDigest(process.cwd()));
assert.equal(read('pilots/calcite/factor-coverage.json').runtimeDigest,runtimeExecutionDigest(process.cwd()));
assert.equal(read('pilots/calcite/factor-coverage.json').productionHeld,true);
for(const name of ['controlled','elmwood']){
  const file=`.local-evidence/calcite-authority-v1/specimens/${name}.json`;
  const text=nowText(file).trimEnd(),specimen=JSON.parse(text);
  const prior=old('pilots/calcite/factor-coverage.json').examples[name];
  assert.equal(hash(text),read('pilots/calcite/factor-coverage.json').examples[name].specimenSha256);
  if(name==='elmwood'){
    assert.equal(specimen.model.runtimeDigest,runtimeExecutionDigest(process.cwd()));
    // Comparison copy only: recover the old authenticated specimen by changing
    // precisely this metadata value, never a zone, surface, or inventory.
    specimen.model.runtimeDigest=prior.audit.model.runtimeDigest;
  }
  assert.equal(hash(JSON.stringify(specimen)),prior.specimenSha256);
  checks.push({label:`complete ${name} specimen; only runtime identity may change`,file,
    before_sha256:prior.specimenSha256,after_sha256:hash(text),physical_changes:0});
}
same('archive/evidence/guided-tutorial-browser-v286.json',x=>x.payload,'real browser journey payload');
same('archive/evidence/mechanism-witnesses-v286.json',x=>x.payload,'production mechanism witness payload');
const result={schema:'vugg-local-state-foundation-validation-v1',base,
  runtime:nodeRuntimeIdentity(),runtime_execution_sha256:runtimeExecutionDigest(process.cwd()),
  trust:'local-reproduction-not-independent-attestation-not-cold-CI',
  checked_payloads:checks.length,scenario_count:41,locality_seeds:[1,2,42],
  legacy_state_fingerprints_unchanged:41,physical_changes:0,calcite_production_held:true,
  checks,source_sha256:hash(fs.readFileSync(import.meta.filename,'utf8'))};
fs.writeFileSync('proposals/evidence/local-state-foundation-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({base,checked_payloads:checks.length,physical_changes:0,legacy_state_fingerprints_unchanged:41}));
