// Authored arithmetic fixture only. These are not measured Tri-State material,
// fluid, phase-abundance, temperature, pressure, or flow parameters.
import {HISTORY_SCHEMA,COMPONENT_UNITS,compilePrehistory,appendPrehistoryEvent} from './history.mjs';

const p=reference=>({kind:'authored-experiment',reference});
const event=(id,type,fields)=>({id,type,...fields,provenance:p('prescribed shared-prehistory control event '+id+'; no kinetic or locality prediction')});
const volume=value=>({value,unit:'mm3_solution'});
const source=(id,role,coefficient,values)=>({id,role,volume:volume(100),
  solventMassPerVolume:{value:coefficient,unit:'kg_solvent_per_mm3_solution'},
  molality:Object.fromEntries(Object.entries(COMPONENT_UNITS).map(([key,unit])=>[key,{value:values[key]??0,unit}])),
  provenance:p('arithmetic-control fluid parcel definition; all omitted fixture component values explicitly zero; solvent/solution-volume coefficient is not a commissioned natural-brine EOS')});

export function controlInput(){
  const otherPhases={1:'quartz',3:'quartz',6:'dolomite',17:'quartz',19:'quartz',21:'quartz',25:'dolomite',29:'quartz'};
  return {schema:HISTORY_SCHEMA,host:{id:'mixed-host-control',lithology:'authored carbonate/chert material-parcel control',
    axesMm:{x:[0,1,1.0001,2.0001,3.0001],y:[0,1,2,3],z:[0,1,2,3]},
    phases:Array.from({length:36},(_,id)=>otherPhases[id]??'calcite'),
    priorAlteration:'source-declared initial phase map; earlier alteration history unresolved, not fabricated',
    provenance:p('explicit nonuniform cuboid parcel map; not sampled Tri-State limestone/dolostone or an inferred phase fraction')},
    reservoirs:[
      source('metal-brine-control','metal-bearing basinal-brine analogue',8.5e-7,
        {calciumMol:0.001,dicMolC:0.0001,ironMol:0.0002,zincMol:0.001,leadMol:0.0001,
          sodiumMol:0.1,chlorideMol:0.1,alkalinityEq:-0.02}),
      source('sulfur-water-control','sulfur-bearing groundwater analogue',9.8e-7,
        {dicMolC:0.001,sulfateMol:0.001,reducedSulfurMol:0.0005,oxygenMol:0.00001,
          sodiumMol:0.01,chlorideMol:0.01,alkalinityEq:0.002})],
    mixingVolumeModel:'declared-additive-parcel-volume-control',
    feederBoundaryModel:'imposed-external-port-isolation-control',
    provenance:p('shared causal conservation fixture; volume additivity and imposed isolation are explicit control assumptions, not production MVT physics')};
}
export function sharedEvents(){return [
  event('create-void','export_breccia',{parcelIds:[22]}),
  event('connect-feeder','connect_feeder',{feederId:'fracture-control',poreParcelId:22,
    reservoirIds:['metal-brine-control','sulfur-water-control']}),
  event('brine-entry','admit_fluid',{feederId:'fracture-control',reservoirId:'metal-brine-control',volume:volume(0.5)}),
  event('groundwater-entry','admit_fluid',{feederId:'fracture-control',reservoirId:'sulfur-water-control',volume:volume(0.25)})];}
export const sealEvent=()=>event('seal-feeder','seal_feeder',{feederId:'fracture-control',mechanism:'imposed-outside-pore-isolation'});
export const pulseEvent=()=>event('later-brine-pulse','admit_fluid',{feederId:'fracture-control',reservoirId:'metal-brine-control',volume:volume(0.125)});
export const reactionEvent=()=>event('prescribed-host-calcite-transfer','remove_calcite_parcel',{
  parcelId:13,prescribedWholeParcel:true,contactModel:'prescribed-whole-parcel-contact-control'});
export const reopenEvent=()=>event('reopen-feeder','reopen_feeder',{feederId:'fracture-control',mechanism:'imposed-outside-pore-isolation'});

export function controlCases(){
  const connected=compilePrehistory(controlInput(),sharedEvents());
  // Seal the existing state FIRST; do not independently initialize trapped fluid.
  const sealed=appendPrehistoryEvent(connected,sealEvent());
  const sealedTransfer=appendPrehistoryEvent(sealed,reactionEvent());
  // Branch at the common prefix before sealing for the external-water control.
  const connectedPulse=appendPrehistoryEvent(connected,pulseEvent());
  const reopenedPulse=appendPrehistoryEvent(appendPrehistoryEvent(sealed,reopenEvent()),pulseEvent());
  return {connected,sealed,sealedTransfer,connectedPulse,reopenedPulse};
}
