// Verify fresh producer output against the pinned integration baseline. Only
// the independently validated quartz observation channel may be additional.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadSimBundle} from './_harness.mjs';
import {assertCommissionedEvidenceRuntime,nodeRuntimeIdentity,runtimeExecutionDigest} from './evidence-runtime.mjs';
const base='91e5cc1102b453acac1638adb40b51587b75115e';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:128*1024*1024}).trimEnd();
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const old=file=>JSON.parse(git('show',`${base}:${file}`));
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
assertCommissionedEvidenceRuntime();
const api=await loadSimBundle({toolName:'quartz-reconciliation',extraExports:[
  'stripValidateQuartzFormTestimony','quartzFormObservationAtStep','quartzFormRenderProjection']});
const simulator=fs.readFileSync('js/85-simulator.ts','utf8').replaceAll('\r\n','\n');
assert.equal(simulator.replace('\n    // Observe finalized existing classifiers; never feed testimony into growth.\n    recordQuartzFormObservations(this);\n',''),
  git('show',`${base}:js/85-simulator.ts`)+'\n','The growth driver must only add the observation hook');
for(const file of ['data/scenarios.json5','data/minerals.json','data/thermo-carbonates.json','data/thermo-sulfates.json']){
  assert.equal(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n').trimEnd(),git('show',`${base}:${file}`),file);
}
const histories=[],channels=[];
for(const name of fs.readdirSync('archive/strips/v285').sort()){
  if(!name.endsWith('.json'))continue;
  const file=`archive/strips/v285/${name}`,after=read(file);if(!after.scenario)continue;
  const before=old(file),compared=structuredClone(after),rows=after.executed_testimony?.quartz_form;
  assert.equal(before.executed_testimony?.quartz_form,undefined,'The baseline must not already contain this channel');
  if(rows!==undefined){
    api.stripValidateQuartzFormTestimony(rows,after.steps);
    let snapshots=0,projected=0;
    for(const row of rows){
      const history=row.history,source={mineral:'quartz',crystal_id:row.crystal_id,zones:row.zones,
        nucleation_step:row.nucleation_step,_quartzFormHistory:history};
      const steps=new Set([history.initial?.step,...history.changes.map(r=>r.step),history.observed_through_step]
        .filter(s=>s!=null&&(!history.unavailable||s<history.unavailable.step)));
      snapshots+=(history.initial?1:0)+history.changes.length;
      for(const step of steps){
        const observation=api.quartzFormObservationAtStep(source,step);
        assert.equal(observation.status,'recorded',`${file}/${row.crystal_id}/${step}`);
        const p=api.quartzFormRenderProjection(source,source,step);
        if(p._quartzFormRender.status==='recorded-form-selection'){
          assert.equal(p.habit,observation.snapshot.habit);projected++;
        }else assert.equal(p._quartzFormRender.status,'legacy-current-form');
      }
    }
    channels.push({scenario:after.scenario,crystals:rows.length,snapshots,projectionChecks:projected,
      channelSha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')});
    delete compared.executed_testimony.quartz_form;
  }
  assert.deepEqual(compared,before,`${file}: existing scientific history changed`);histories.push(after.scenario);
}
assert.equal(histories.length,41);assert.ok(channels.length>0);
for(const file of ['seed42_v285.json','strip_digest_v285.json','locality_frequency_v285.json']){
  assert.deepEqual(read(`tests-js/baselines/${file}`),old(`tests-js/baselines/${file}`),file);
}
const census=read('pilots/calcite/volume-census.json');
assert.equal(census.runtimeDigest,runtimeExecutionDigest(process.cwd()));
assert.deepEqual(census.scenarios,old('pilots/calcite/volume-census.json').scenarios,'Fresh fleet values/fingerprints changed');
assert.equal(census.scenarios.length,41);
const oldJourneys=old('archive/evidence/guided-tutorial-browser-v285.json').payload.journeys;
const journeys=read('archive/evidence/guided-tutorial-browser-v285.json').payload.journeys;
const journeyChanges=[];
function diff(a,b,path=[]){
  if(Object.is(a,b))return;
  if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],[...path,key]);
  else journeyChanges.push({path:path.join('.'),before:a,after:b});
}
diff(oldJourneys,journeys);
const allowedJourneyLeaves=['simulation.collected.record_id','player_surfaces.collection_record_groove.record_id',
  'simulation.geology_preservation.before.run_id','simulation.geology_preservation.after.run_id',
  'player_surfaces.strip_view.download_sha256','player_surfaces.strip_view.imported_key',
  'player_surfaces.strip_view.dataset_digest_sha256','player_surfaces.strip_view.imported_digest_sha256'];
assert.deepEqual(journeyChanges.map(c=>c.path).sort(),allowedJourneyLeaves.sort(),'Unexplained browser journey change');
const byteProof=read('proposals/evidence/quartz-browser-payload-validation.json');
assert.equal(byteProof.runtimeExecutionDigest,census.runtimeDigest);
assert.equal(byteProof.proof.rawSha256,journeys.player_surfaces.strip_view.dataset_digest_sha256);
assert.equal(byteProof.proof.downloadSha256,journeys.player_surfaces.strip_view.download_sha256);
assert.equal(byteProof.proof.withoutQuartzRawSha256,oldJourneys.player_surfaces.strip_view.dataset_digest_sha256);
assert.equal(byteProof.proof.withoutQuartzDownloadSha256,oldJourneys.player_surfaces.strip_view.download_sha256);
assert.equal(byteProof.proof.fingerprint,oldJourneys.simulation.geology_preservation.before.fingerprint);
const result={schema:'quartz-reconciliation-validation-v1',base,runtime:nodeRuntimeIdentity(),
  runtimeExecutionDigest:census.runtimeDigest,sourceCommits:['3751060e94bc9ba8aba9a3b488d454b4f5ec4897',
    '0f0be7f7f94c9f8d5b2f7806504914c818f2da93','c045bb62802dec95504ccb97c7de53a0af8572b8'],
  sourceHashes:Object.fromEntries(['js/44e-quartz-form-history.ts','js/44f-quartz-form-persistence.ts','js/46a-quartz-render.ts',
    'js/46m-quartz-form-display.ts','js/85-simulator.ts','js/85f-strip-dataset.ts','js/85g-strip-recorder.ts',
    'js/85h-strip-storage.ts','js/93-ui-collection.ts','js/93a-ui-saves.ts','js/99i-renderer-three.ts',
    'tools/gen-strip-archive.mjs','tools/browser-workflow.mjs','tools/check-quartz-browser-payload.mjs',
    'tools/guided-tutorial-browser-receipt.mjs','tools/check-quartz-reconciliation.mjs'].map(file=>[file,hash(file)])),
  comparison:{existingHistoryPayloadsUnchanged:histories.length,numericalBaselinesUnchanged:3,
    freshFleetScenarioValuesAndFingerprintsUnchanged:census.scenarios.length,scenarioMineralThermoSourcesUnchanged:true},
  observationChannels:channels,browserJourneyChanges:journeyChanges,
  browserPayloadProof:'Actual Chrome bytes minus only quartz observations equal both exact baseline raw/download hashes.',
  compatibility:'Both viewers, exact flat cavity, non-WebGL fallback, wall controls and tutorial timing retained.',
  boundaries:['Finalized classifier observations are not measured face velocities or geological validation.',
    'Topology scope and nucleation tilt are observed in quartz v2 because the general R7 replay layer was not imported.',
    'Historical width and display material retain existing approximations; this is not a complete physical-solid reconstruction.',
    'Twins, split/fabric growth, casts, enclosed hosts, parent inheritance and gaps keep explicit latest-form display fallbacks.',
    'Legacy records remain readable without invented quartz testimony; old producer selection is retained for old authenticated receipts.']};
fs.mkdirSync('proposals/evidence',{recursive:true});
fs.writeFileSync('proposals/evidence/quartz-reconciliation-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({base,comparison:result.comparison,channels:channels.length,crystals:channels.reduce((n,r)=>n+r.crystals,0),
  snapshots:channels.reduce((n,r)=>n+r.snapshots,0),projectionChecks:channels.reduce((n,r)=>n+r.projectionChecks,0)},null,2));
