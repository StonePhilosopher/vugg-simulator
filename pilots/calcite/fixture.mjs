// Authored accepted material, not a chemistry prediction. Source schedule is
// selectively transplanted from 5c6f11c8; no old recording or receipts reused.
import {CalciteAuthorityWriter} from './authority.js';
import {captureCrystal,kernelFor} from './capture.mjs';
import {dimensions} from './growth-capture.mjs';
export function controlledSpecimen(h){
  const writer=new CalciteAuthorityWriter(kernelFor(h),{kind:'authored-accepted-zone-fixture',
    limitation:'Authored composition, placement, and growth amounts; not a chemistry or conservation experiment.'});
  const crystals=[];
  const schedule=[
    {label:'Older generation',a:1100,b:0,mn:.01},
    {label:'Younger neighbor nucleates',a:500,b:900,mn:.04},
    {label:'Contact and Mn-rich growth',a:450,b:850,mn:.2},
    {label:'Dissolution',a:-240,b:-120,mn:0},
    {label:'Regrowth',a:550,b:300,mn:.03},
  ];
  for(let i=0;i<schedule.length;i++){
    const step=i+1,event=schedule[i];
    for(let j=0;j<2;j++){
      const thickness=j?event.b:event.a;if(!thickness)continue;
      if(!crystals[j]){
        crystals[j]=new h.Crystal({mineral:'calcite',habit:'rhombohedral',crystal_id:j+1,nucleation_step:step});
        writer.nucleate({id:j+1,mineral:'calcite',nucleationStep:step,initialHabit:'rhombohedral',
          anchor:[j*.75,0,0],axis:[0,1,0],orientationAuthority:'authored fixture'});
      }
      const c=crystals[j],before=dimensions(c),zoneIndex=c.zones.length;
      const zone=new h.GrowthZone({step,temperature:40,thickness_um:thickness,growth_rate:thickness,
        trace_Mn:event.mn,note:`Authored fixture: ${event.label}`});zone._time_scaled=true;
      c.add_zone(zone);
      writer.acceptZone({id:c.crystal_id,step,zoneIndex,zone,before,after:dimensions(c),
        morphologyInputs:{habit:c.habit,form:c._wulffForm??null}});
    }
    h.classifyWulffForm({step,conditions:{wall:{wulff_calcite:true}},crystals});
    const facts=crystals.map((c,j)=>captureCrystal(h,c,[j*.75,0,0],[0,1,0]));
    writer.captureStep({surface:{step,source:{kind:'authored-zone-fixture',label:event.label},crystals:facts},allCalcite:facts});
  }
  return writer.specimen();
}
