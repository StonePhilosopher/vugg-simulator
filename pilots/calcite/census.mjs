// Serial, observation-only fleet census. Not a baseline or calibration producer.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadPilotModel,kernelFor,captureLive} from './capture.mjs';
import {SpecimenRecorder,validateFrame} from './specimen.js';
import {assertCommissionedEvidenceRuntime,runtimeExecutionDigest} from '../../tools/evidence-runtime.mjs';

assertCommissionedEvidenceRuntime();
const args=process.argv.slice(2);
const arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const output=arg('--output','.local-evidence/calcite-authority-v1/census.json');
const h=await loadPilotModel(),kernel=kernelFor(h);
const baseline=JSON.parse(fs.readFileSync(`tests-js/baselines/seed42_v${h.SIM_VERSION}.json`,'utf8'));
const scenarios=arg('--scenarios',Object.keys(baseline).sort().join(',')).split(',');
const result={schema:'calcite-volume-census-v1',seed:42,simVersion:h.SIM_VERSION,
  source:'actual scenario runs at authored duration; no scenario flags overridden',
  pilotSourceCommit:'5c6f11c80e31a582dbc86863a1418267b0731341',
  runtime:{node:process.version,platform:process.platform,arch:process.arch},
  runtimeDigest:runtimeExecutionDigest(process.cwd()),
  scope:'plain untwinned Wulff calcite; all other calcite explicitly counted as excluded',
  decision:'Preserve existing mass/growth rules; record measured factors; hold production integration.',
  sourceHashes:Object.fromEntries(['js/27-geometry-crystal.ts','js/45-morphology.ts','js/46-wulff-geometry.ts',
    'js/99i-renderer-three.ts','pilots/calcite/specimen.js','pilots/calcite/capture.mjs','pilots/calcite/census.mjs'].map(file=>[file,
    createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex')])),scenarios:[]};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const measure=frame=>validateFrame(frame).crystals.map(r=>({id:r.id,habit:r.facts.habit,
  cLengthMm:r.facts.cLengthMm,aWidthMm:r.facts.aWidthMm,bookedVolumeMm3:r.facts.bookedVolumeMm3,
  completedVolumeMm3:r.completion.volumeMm3,...r.completion.volumeAudit}));
fs.mkdirSync(path.dirname(output),{recursive:true});
for(const name of scenarios){
  h.setSeed(42);
  const {conditions,events,defaultSteps}=h.SCENARIOS[name]();
  const sim=new h.VugSimulator(conditions,events),steps=Number(arg('--steps',defaultSteps??120));
  const historical=[],compiler=new SpecimenRecorder(kernel);
  for(let i=0;i<steps;i++){
    sim.run_step();
    // Current scientific scale only: no visibility floors, rounded cache keys,
    // or invented forms for non-Wulff calcite. Save every supported step.
    const input=captureLive(h,sim,{scenario:name,seed:42});
    if(input.crystals.length){
      const before=h.simulationStateFingerprint(sim),facts=hash(sim.crystals);
      try{historical.push({step:sim.step,crystals:measure(compiler.capture(input))});}
      catch(error){historical.push({step:sim.step,error:String(error.message)});}
      if(before!==h.simulationStateFingerprint(sim)||facts!==hash(sim.crystals))throw Error(`Observation changed ${name} at ${sim.step}`);
    }
  }
  const before=h.simulationStateFingerprint(sim);
  const factsBefore=hash(sim.crystals);
  const input=captureLive(h,sim,{scenario:name,seed:42});
  const crystals=[];
  if(input.crystals.length)try{crystals.push(...measure(compiler.capture(input)));}
  catch(error){crystals.push({error:String(error.message)});}
  const all=sim.crystals.filter(c=>c.mineral==='calcite');
  const row={scenario:name,steps,wulffCalcite:!!conditions.wall.wulff_calcite,
    calciteCount:all.length,calciteBookedMm3:all.reduce((s,c)=>s+Math.max(0,c._volume_mm3),0),
    eligibleCount:input.crystals.length,excluded:all.filter(c=>!input.crystals.some(x=>x.id===c.crystal_id)).map(c=>({id:c.crystal_id,habit:c.habit,twinned:c.twinned,dissolved:c.dissolved,hasForm:!!c._wulffForm,
      surfaceGrowth:c._surfaceGrowth?.regime??null,growthEnvironment:c.growth_environment??'fluid',bookedVolumeMm3:c._volume_mm3})),
    observationDidNotMutate:before===h.simulationStateFingerprint(sim)&&factsBefore===hash(sim.crystals),
    fingerprint:before,historical,crystals};
  if(!row.observationDidNotMutate)throw Error(`Observation changed ${name}`);
  result.scenarios.push(row);
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({scenario:name,steps,calcite:all.length,eligible:input.crystals.length,errors:crystals.filter(c=>c.error).length}));
}
