// Produce inspectable specimens, not calibration evidence or a performance run.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from '../../tools/three.module.js';
import {loadPilotModel,kernelFor} from './capture.mjs';
import {controlledSpecimen} from './fixture.mjs';
import {CalciteAuthorityWriter,saveCalciteSpecimen,loadCalciteSpecimen,calciteProductionGate} from './authority.js';
import {recordCalciteSteps} from './growth-capture.mjs';
import {SpecimenView} from './render.js';
import {assertCommissionedEvidenceRuntime,runtimeExecutionDigest} from '../../tools/evidence-runtime.mjs';

assertCommissionedEvidenceRuntime();
const h=await loadPilotModel(),output=path.resolve('.local-evidence/calcite-authority-v1/specimens');
fs.mkdirSync(output,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const sourceFiles=['pilots/calcite/authority.js','pilots/calcite/specimen.js','pilots/calcite/capture.mjs',
  'pilots/calcite/growth-capture.mjs','pilots/calcite/render.js','pilots/calcite/fixture.mjs','pilots/calcite/record.mjs'];
const model={kind:'live-model-capture',scenario:'elmwood',seed:42,wulffCalciteOverride:true,
  limitation:'Old pilot configuration, 16 steps; not authored default Elmwood or an independent geology validation',
  simVersion:h.SIM_VERSION,runtimeDigest:runtimeExecutionDigest(process.cwd()),
  sourceHashes:Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'))]))};
function run(record){
  h.setSeed(42);const scenario=h.SCENARIOS.elmwood();scenario.conditions.wall.wulff_calcite=true;
  const sim=new h.VugSimulator(scenario.conditions,scenario.events),trajectory=[];
  const original=sim.run_step;
  sim.run_step=function(){const result=original.call(this);trajectory.push(h.simulationStateFingerprint(this));return result;};
  const writer=new CalciteAuthorityWriter(kernelFor(h),model);
  const specimen=record?recordCalciteSteps(h,sim,writer,16,{scenario:'elmwood',seed:42,wulffCalciteOverride:true}):null;
  if(!record)for(let i=0;i<16;i++)sim.run_step();
  return {trajectory,specimen,crystals:JSON.stringify(sim.crystals)};
}
const baseline=run(false),recorded=run(true);
if(JSON.stringify(baseline.trajectory)!==JSON.stringify(recorded.trajectory)||baseline.crystals!==recorded.crystals)throw Error('Recording changed actual growth');
function rebuild(specimen){
  const group=new THREE.Group(),view=new SpecimenView(THREE,group),signatures=[];
  try{
    for(const frame of specimen.frames){
      view.dispose();view.sync(frame.surface);
      signatures.push(hash(JSON.stringify(group.children.map(m=>({id:m.userData.crystalId,
        positions:Array.from(m.geometry.attributes.position.array),groups:m.geometry.groups})))));
    }
  }finally{view.dispose();}
  if(view.created!==view.disposed)throw Error('Unreleased specimen resources');
  return signatures;
}
const proof={scope:'custody and reconstruction, not physical-solid closure',
  trajectoryUnchanged:true,crystalBytesUnchanged:true,examples:{}};
for(const [name,specimen] of Object.entries({controlled:controlledSpecimen(h),elmwood:recorded.specimen})){
  const text=saveCalciteSpecimen(specimen),loaded=loadCalciteSpecimen(text);
  const before=rebuild(specimen),after=rebuild(loaded);
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error(`Save/load reconstruction changed ${name}`);
  const file=path.join(output,`${name}.json`);fs.writeFileSync(file,text+'\n');
  proof.examples[name]={file:path.basename(file),specimenSha256:hash(text),frames:specimen.frames.length,
    events:specimen.events.length,geometrySha256ByStep:after,productionGate:calciteProductionGate(loaded)};
}
fs.writeFileSync(path.join(output,'proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({output,...proof},null,2));
