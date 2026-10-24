// Generate only this isolated fixture's invariant, never science baselines.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../tools/three.module.js';
import {loadPilotModel} from './capture.mjs';
import {controlledSpecimen} from './fixture.mjs';
import {SpecimenView} from './render.js';
import {assertCommissionedEvidenceRuntime} from '../../tools/evidence-runtime.mjs';
assertCommissionedEvidenceRuntime();
const h=await loadPilotModel(),s=controlledSpecimen(h),group=new THREE.Group(),view=new SpecimenView(THREE,group);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const hashes=[];
try{
  for(const f of s.frames){
    view.sync(f.surface);
    hashes.push(hash(group.children.map(m=>({id:m.userData.crystalId,
      positions:Array.from(m.geometry.attributes.position.array),groups:m.geometry.groups}))));
  }
}finally{view.dispose();}
const result={schema:'calcite-authority-golden-v1',scope:'authored accepted-zone fixture; deterministic custody, not external geological validation',
  sourcePilot:'5c6f11c80e31a582dbc86863a1418267b0731341',runtime:`${process.platform}/${process.arch}/${process.version}`,
  specimenSha256:hash(s),geometrySha256ByStep:hashes,
  bookedVolumeMm3ByStep:s.frames.map(f=>f.allCalcite.map(c=>c.bookedVolumeMm3))};
fs.writeFileSync(new URL('./golden.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
