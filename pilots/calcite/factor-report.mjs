// Derive coverage from existing captured evidence. Never changes specimens or
// reruns growth. Regenerate inputs with record.mjs when their source is stale.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../tools/three.module.js';
import {loadPilotModel} from './capture.mjs';
import {loadCalciteSpecimen,saveCalciteSpecimen,calciteProductionGate} from './authority.js';
import {auditSpecimenFactors,fleetFactorCoverage} from './factor-audit.js';
import {SpecimenView} from './render.js';
import {CALCITE_VOLUME_CONTRACT,assertCalciteVolumeContract} from './volume-contract.js';
import {assertCommissionedEvidenceRuntime,runtimeExecutionDigest} from '../../tools/evidence-runtime.mjs';
assertCommissionedEvidenceRuntime();
const h=await loadPilotModel(),digest=runtimeExecutionDigest(process.cwd());
const hash=text=>createHash('sha256').update(text).digest('hex');
const sourceHash=file=>hash(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'));
const census=JSON.parse(fs.readFileSync('pilots/calcite/volume-census.json','utf8'));
if(census.runtimeDigest!==digest)throw Error('Fleet census runtime is stale');
for(const [file,expected] of Object.entries(census.sourceHashes))if(sourceHash(file)!==expected)throw Error(`Stale fleet source: ${file}`);
const examples={};
function meshSignatures(specimen){
  const group=new THREE.Group(),view=new SpecimenView(THREE,group),signatures=[];
  try{for(const frame of specimen.frames){
    view.dispose();view.sync(frame.surface);
    signatures.push(hash(JSON.stringify(group.children.map(m=>({id:m.userData.crystalId,
      positions:Array.from(m.geometry.attributes.position.array),groups:m.geometry.groups})))));
  }}finally{view.dispose();}
  if(view.created!==view.disposed)throw Error('Mesh resources not disposed');
  return signatures;
}
for(const name of ['controlled','elmwood']){
  const text=fs.readFileSync(`.local-evidence/calcite-authority-v1/specimens/${name}.json`,'utf8').trimEnd();
  const specimen=loadCalciteSpecimen(text);
  if(name==='controlled'&&hash(text)!==JSON.parse(fs.readFileSync('pilots/calcite/golden.json','utf8')).specimenSha256)throw Error('Controlled specimen does not match the golden fixture');
  if(name==='elmwood'){
    if(specimen.model.runtimeDigest!==digest)throw Error('Specimen runtime is stale');
    for(const [file,expected] of Object.entries(specimen.model.sourceHashes))if(sourceHash(file)!==expected)throw Error(`Stale specimen source: ${file}`);
  }
  const audit=auditSpecimenFactors(specimen,h.wulffPolyhedron);
  const reloaded=loadCalciteSpecimen(saveCalciteSpecimen(specimen));
  if(JSON.stringify(audit)!==JSON.stringify(auditSpecimenFactors(reloaded,h.wulffPolyhedron)))throw Error('Replay changed factor audit');
  const before=meshSignatures(specimen),after=meshSignatures(reloaded);
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Replay changed mesh reconstruction');
  const volumeContracts=specimen.frames.flatMap(f=>f.surface.crystals.map(c=>({step:f.step,id:c.id,
    ...assertCalciteVolumeContract(c,c.completion.volumeMm3)})));
  examples[name]={specimenSha256:hash(text),sourceClass:name==='controlled'?'authored accepted-zone fixture':'live Elmwood with explicit Wulff override',
    volumeContracts,
    audit,replay:{frames:specimen.frames.length,factorsUnchanged:true,geometrySha256ByStep:after,allResourcesDisposed:true},
    productionGate:calciteProductionGate(specimen)};
}
const result={schema:'calcite-factor-coverage-v1',runtime:{node:process.version,platform:process.platform,arch:process.arch},
  runtimeDigest:digest,volumeContract:CALCITE_VOLUME_CONTRACT,
  sourceHashes:Object.fromEntries(['pilots/calcite/factor-audit.js','pilots/calcite/factor-report.mjs','pilots/calcite/volume-contract.js'].map(file=>[file,sourceHash(file)])),
  fleetReceiptSha256:sourceHash('pilots/calcite/volume-census.json'),fleet:fleetFactorCoverage(census),examples,
  interpretation:'Arithmetic diagnosis only. The bounding ellipsoid is a comparison reference, not a replacement solid, calibration, density or porosity.',
  gaps:['Contact/dissolution/regrowth witnesses are authored fixture evidence, not validated live geological episodes.',
    'Default fleet supported historical surfaces cover MVT scalenohedra only; other habits remain excluded.',
    'Bounding-reference diagnosis uses saved specimen planes; fleet scalar rows lack those planes.',
    'O1a/O1b effects remain included in the recorded full-form stage, not separately attributed.',
    'A wrong mass model cannot be established from procedural surface volume alone.'],productionHeld:true};
fs.writeFileSync('pilots/calcite/factor-coverage.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fleet:result.fleet,examples:Object.fromEntries(Object.entries(examples).map(([name,e])=>[name,
  {samples:e.audit.supportedCrystalSteps,habits:e.audit.habits,phases:e.audit.phaseCounts,contactFaceSamples:e.audit.contactFaceSamples,replayFrames:e.replay.frames}]))},null,2));
