// Isolated pilot adapter, not installed in the shipped game. Hooks exist only
// during synchronous growth calls and are restored even on failure.
import {clone} from './specimen.js';
import {captureCrystal,captureLive} from './capture.mjs';

export const dimensions=c=>({cLengthMm:c.c_length_mm,aWidthMm:c.a_width_mm,
  bookedVolumeMm3:c._volume_mm3,totalGrowthUm:c.total_growth_um});
const morphology=c=>({habit:c.habit,form:c._wulffForm??null,
  calciteIntegral:c._wulffCalInt??null,exposureIntegral:c._o1aExp??null,split:c._split??null});
export function originFor(h,sim,c){
  const normal=sim.wall_state.surfaceNormalForCrystal(c);
  return clone({id:c.crystal_id,mineral:'calcite',nucleationStep:c.nucleation_step,
    nucleationTemperatureC:c.nucleation_temp,initialHabit:c.habit,wallAnchor:c.wall_anchor,
    anchor:sim.wall_state.surfacePointForCrystal(c),axis:h._topoCAxisForCrystal(c,...normal),
    yaw:h._crystalYaw(c.crystal_id),orientationAuthority:'existing procedural orientation; recorded at nucleation',
    identityAuthority:'model nucleation, not current-fluid reclassification'});
}
export function readCalciteStep(h,sim,source){
  const surface=captureLive(h,sim,source);
  const allCalcite=sim.crystals.filter(c=>c.mineral==='calcite').map(c=>captureCrystal(h,c,
    sim.wall_state.surfacePointForCrystal(c),h._topoCAxisForCrystal(c,...sim.wall_state.surfaceNormalForCrystal(c))));
  return {surface,allCalcite};
}
let active=false;
export function recordCalciteSteps(h,sim,writer,steps,source){
  if(active||!Number.isSafeInteger(steps)||steps<1)throw Error('Invalid or concurrent pilot capture');
  const originalAdd=h.Crystal.prototype.add_zone,originalNucleate=sim.nucleate;
  const descriptor=Object.getOwnPropertyDescriptor(sim,'nucleate');
  active=true;
  try{
    sim.nucleate=function(...args){
      const c=originalNucleate.apply(this,args);
      if(c.mineral==='calcite')writer.nucleate(originFor(h,sim,c));
      return c;
    };
    h.Crystal.prototype.add_zone=function(zone,...args){
      if(this.mineral!=='calcite'||!sim.crystals.includes(this))return originalAdd.call(this,zone,...args);
      const before=dimensions(this),zoneIndex=this.zones.length,inputs=clone(morphology(this));
      const result=originalAdd.call(this,zone,...args);
      writer.acceptZone({id:this.crystal_id,step:sim.step,zoneIndex,zone,before,after:dimensions(this),morphologyInputs:inputs});
      return result;
    };
    for(let i=0;i<steps;i++){sim.run_step();writer.captureStep(readCalciteStep(h,sim,source));}
    return writer.specimen();
  }finally{
    h.Crystal.prototype.add_zone=originalAdd;
    if(descriptor)Object.defineProperty(sim,'nucleate',descriptor);else delete sim.nucleate;
    active=false;
  }
}
