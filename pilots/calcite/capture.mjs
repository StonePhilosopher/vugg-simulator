// Node capture boundary; this module is never loaded by the viewer.
import { loadSimBundle } from '../../tools/_harness.mjs';
import { clone } from './specimen.js';
export async function loadPilotModel() {
  return loadSimBundle({toolName:'calcite-specimen-pilot',extraExports:[
    'Crystal','GrowthZone','classifyWulffForm','wulffFaceSetForMineral','wulffPolyhedron',
    'o1aExposureK','_topoCAxisForCrystal','_crystalYaw','_makeWulffGeom',
    '_makeWulffHalfFormGeom','_o1bNeighborShadow',
  ]});
}
export const kernelFor = h => ({faceSet:h.wulffFaceSetForMineral,polyhedron:h.wulffPolyhedron});
export function captureCrystal(h,c,anchor,axis) {
  return clone({
    id:c.crystal_id,mineral:c.mineral,habit:c.habit,twinned:c.twinned,
    cLengthMm:c.c_length_mm,aWidthMm:c.a_width_mm,bookedVolumeMm3:c._volume_mm3,
    totalGrowthUm:c.total_growth_um,anchor,axis,yaw:h._crystalYaw(c.crystal_id),
    growthEnvironment:c.growth_environment??'fluid',surfaceGrowth:c._surfaceGrowth??null,
    exposureK:h.o1aExposureK(c),attachedFraction:c._occlusion?.attachedFraction??0.5,
    attachmentAtNucleus:c._occlusion?.attachedFraction==null,
    form:c._wulffForm,zones:c.zones,nucleationStep:c.nucleation_step,
    etchHistory:c.etch_history||[],enclosedBy:c.enclosed_by,
    enclosedCrystals:c.enclosed_crystals||[],enclosureReceipt:c.enclosure_receipt||null,
    split:c._split||null,formation:{calciteIntegral:c._wulffCalInt||null,exposureIntegral:c._o1aExp||null,occlusion:c._occlusion||null,nucleationTilt:c._nucTilt||null},
  });
}
export function captureLive(h,sim,source) {
  const eligible=sim.crystals.filter(c=>c.mineral==='calcite' && c._wulffForm
    && !c.twinned && c.enclosed_by==null && !c._surfaceGrowth && c.growth_environment!=='air'
    && ['rhombohedral','scalenohedral'].includes(c.habit) && c.c_length_mm>0);
  return {
    step:sim.step,
    source:{...source,kind:'live-model-capture',excludedCrystals:sim.crystals.filter(c=>!eligible.includes(c)).map(c=>({id:c.crystal_id,mineral:c.mineral,habit:c.habit,reason:'outside plain Wulff calcite pilot'})),
      boundary:'Contacts use captured eligible calcites only; other minerals and cavity clipping are outside this pilot.'},
    crystals:eligible.map(c=>captureCrystal(h,c,sim.wall_state.surfacePointForCrystal(c),
      h._topoCAxisForCrystal(c,...sim.wall_state.surfaceNormalForCrystal(c)))),
  };
}

export function controlledInputs(h) {
  // Authored accepted-zone fixture, not an end-to-end chemistry experiment.
  // Exercises the existing Crystal.add_zone and morphology classifier unchanged.
  const crystals=[],frames=[];
  const schedule=[
    {label:'Older generation',a:1100,b:0,mn:0.01},
    {label:'Younger neighbor nucleates',a:500,b:900,mn:0.04},
    {label:'Neighbor contact and Mn-rich growth',a:450,b:850,mn:0.2},
    {label:'Dissolution',a:-240,b:-120,mn:0},
    {label:'Regrowth',a:550,b:300,mn:0.03},
  ];
  for(let i=0;i<schedule.length;i++) {
    const event=schedule[i],step=i+1;
    for(let j=0;j<2;j++) {
      const thickness=j?event.b:event.a;
      if(!thickness)continue;
      if(!crystals[j])crystals[j]=new h.Crystal({mineral:'calcite',habit:'rhombohedral',crystal_id:j+1,nucleation_step:step});
      const c=crystals[j]; c.crystal_id=j+1; c.nucleation_step??=step;
      const z=new h.GrowthZone({step,temperature:40,thickness_um:thickness,growth_rate:thickness,trace_Mn:event.mn,note:`Authored fixture: ${event.label}`});
      z._time_scaled=true;
      c.add_zone(z);
    }
    h.classifyWulffForm({step,conditions:{wall:{wulff_calcite:true}},crystals});
    frames.push({step,source:{kind:'authored-zone-fixture',label:event.label,
      limitation:'Authored zones, composition and anchors; tests data custody, not chemical prediction or mass balance.'},
      crystals:crystals.map((c,j)=>captureCrystal(h,c,[j*0.75,0,0],[0,1,0]))});
  }
  return frames;
}
