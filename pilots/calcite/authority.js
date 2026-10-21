// Calcite-only authority boundary. No simulator, fluid, RNG, DOM, or Three.js.
// The growth driver writes events; completed historical surfaces are data.
import {clone,freeze,SpecimenRecorder,validateFrame} from './specimen.js';

export const AUTHORITY_SCHEMA='vugg-calcite-scientific-solid-authority-v1';
export const VOLUME_RELATIONSHIP=freeze({
  status:'scientific-solid-closure-unresolved',
  booked:'accepted-zone ellipsoid inventory; chemistry and fill authority',
  completed:'procedurally completed Wulff/contact surface at recorded scale',
  relationship:'completed = booked * fullToBooked * attachmentRetention * contactRetention',
  factorsAre:'measured representation factors, not porosity or a new density',
  conversionTolerance:{relative:1e-8,absoluteMm3:1e-10},
  allowedConsumers:{booked:['chemistry','fill','dissolution-inventory'],
    completed:['surface-reconstruction','surface-inspection']},
  forbidden:'No geometry-to-mass substitution, renderer rescaling, or feedback.',
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
const extentKeys=['cLengthMm','aWidthMm','bookedVolumeMm3','totalGrowthUm'];
function assertExtent(extent){
  if(!extent||extentKeys.some(k=>!finite(extent[k])||extent[k]<0))throw Error('Invalid recorded extent');
}
function assertZone(zone,step){
  if(!zone||!Number.isSafeInteger(zone.step)||zone.step!==step||!finite(zone.thickness_um))throw Error('Invalid accepted zone');
}

export class CalciteAuthorityWriter {
  #model; #events=[]; #frames=[]; #origins=new Map(); #zoneCounts=new Map();
  #compiler; #lastStep=0; #lastZones=new Map();
  constructor(kernel,model){
    if(!model||typeof model.kind!=='string')throw Error('Missing model identity');
    this.#model=freeze(clone(model));this.#compiler=new SpecimenRecorder(kernel);
  }
  #append(event){
    const saved=freeze({...clone(event),sequence:this.#events.length});
    this.#events.push(saved);return saved;
  }
  nucleate(origin){
    if(origin?.mineral!=='calcite'||!Number.isSafeInteger(origin.id)||origin.id<1||this.#origins.has(origin.id)
      ||!Number.isSafeInteger(origin.nucleationStep)||origin.nucleationStep<=this.#lastStep)throw Error('Invalid or retroactive calcite origin');
    const event=this.#append({kind:'nucleation',step:origin.nucleationStep,id:origin.id,origin});
    this.#origins.set(origin.id,event);this.#zoneCounts.set(origin.id,0);
    return event;
  }
  acceptZone({id,step,zoneIndex,zone,before,after,morphologyInputs}){
    const origin=this.#origins.get(id);
    if(!origin||step<=this.#lastStep||step<origin.step||zoneIndex!==this.#zoneCounts.get(id))throw Error('Unowned, retroactive, or missing accepted zone');
    assertZone(zone,step);assertExtent(before);assertExtent(after);
    const previous=this.#events.findLast(e=>e.id===id&&['growth','dissolution','regrowth'].includes(e.kind));
    const kind=zone.thickness_um<0?'dissolution':zone.thickness_um>0&&previous?.zone.thickness_um<0?'regrowth':'growth';
    const event=this.#append({kind,id,step,zoneIndex,zone,before,after,
      morphologyInputs:morphologyInputs??null,
      authority:'accepted existing model transition; not independently validated geology'});
    this.#zoneCounts.set(id,zoneIndex+1);return event;
  }
  captureStep(input){
    const step=input?.surface?.step;
    if(!Number.isSafeInteger(step)||step!==this.#lastStep+1||!Array.isArray(input.allCalcite))throw Error('Missing or out-of-order specimen step');
    const ids=new Set();
    for(const c of input.allCalcite){
      if(c.mineral!=='calcite'||ids.has(c.id)||!this.#origins.has(c.id)
        ||c.nucleationStep!==this.#origins.get(c.id).step||c.zones.length!==this.#zoneCounts.get(c.id))throw Error('Calcite lineage or zone custody gap');
      ids.add(c.id);assertExtent(c);
    }
    for(const id of this.#origins.keys())if(!ids.has(id))throw Error('Missing calcite lineage; removals require a modeled transformation record');
    const surface=this.#compiler.capture(input.surface);
    for(const c of surface.crystals)if(!same(c.facts,input.allCalcite.find(x=>x.id===c.id)))throw Error('Surface facts diverge from growth record');
    const overprints=[];
    for(const c of input.allCalcite){
      const old=this.#lastZones.get(c.id)||[];
      for(let i=0;i<old.length;i++)if(!same(old[i],c.zones[i]))overprints.push(this.#append({kind:'zone-overprint',id:c.id,step,zoneIndex:i,
        before:old[i],after:c.zones[i],authority:'observed later mutation; cause unresolved; never rewrites the formation event'}).sequence);
      for(let i=old.length;i<c.zones.length;i++){
        const initial=this.#events.find(e=>e.id===c.id&&e.zoneIndex===i&&['growth','dissolution','regrowth'].includes(e.kind));
        if(!same(initial.zone,c.zones[i]))this.#append({kind:'zone-finalization',id:c.id,step,zoneIndex:i,
          before:initial.zone,after:c.zones[i],authority:'observed same-step receipt finalization; initial accepted event preserved'});
      }
      this.#lastZones.set(c.id,clone(c.zones));
    }
    const frame=freeze({step,surface,allCalcite:clone(input.allCalcite),overprints,
      eventCount:this.#events.length});
    this.#frames.push(frame);this.#lastStep=step;return frame;
  }
  specimen(){
    const specimen=freeze({schema:AUTHORITY_SCHEMA,model:this.#model,
      volumeRelationship:VOLUME_RELATIONSHIP,events:[...this.#events],frames:[...this.#frames]});
    assertCalciteSpecimen(specimen);return specimen;
  }
}

export function assertCalciteSpecimen(specimen){
  if(specimen?.schema!==AUTHORITY_SCHEMA||!specimen.model?.kind
    ||!same(specimen.volumeRelationship,VOLUME_RELATIONSHIP)||!Array.isArray(specimen.events)
    ||!Array.isArray(specimen.frames))throw Error('Invalid calcite specimen contract');
  const origins=new Map(),counts=new Map(),lastEventStep=new Map(),zoneStates=new Map(),lastAccepted=new Map();
  specimen.events.forEach((e,i)=>{
    if(e.sequence!==i||!Number.isSafeInteger(e.step)||e.step<1||!Number.isSafeInteger(e.id)||e.id<1
      ||e.step<(lastEventStep.get(e.id)||0))throw Error('Invalid event chronology');
    lastEventStep.set(e.id,e.step);
    if(e.kind==='nucleation'){
      if(origins.has(e.id)||e.origin?.id!==e.id||e.origin?.mineral!=='calcite'||e.origin.nucleationStep!==e.step)throw Error('Invalid immutable origin');
      if(!['anchor','axis'].every(k=>Array.isArray(e.origin[k])&&e.origin[k].length===3&&e.origin[k].every(finite))
        ||Math.hypot(...e.origin.axis)<1e-10)throw Error('Invalid origin orientation');
      origins.set(e.id,e);counts.set(e.id,0);zoneStates.set(e.id,[]);
    }else if(['growth','dissolution','regrowth'].includes(e.kind)){
      if(!origins.has(e.id)||e.zoneIndex!==counts.get(e.id))throw Error('Invalid zone custody');
      assertZone(e.zone,e.step);assertExtent(e.before);assertExtent(e.after);
      const previous=lastAccepted.get(e.id);
      const kind=e.zone.thickness_um<0?'dissolution':e.zone.thickness_um>0&&previous?.zone.thickness_um<0?'regrowth':'growth';
      if(e.kind!==kind)throw Error('Invalid growth/dissolution/regrowth cause');
      if(previous&&extentKeys.some(k=>e.before[k]!==previous.after[k]))throw Error('Unrecorded extent change between accepted zones');
      if(e.zone.thickness_um>0&&e.after.bookedVolumeMm3<e.before.bookedVolumeMm3
        ||e.zone.thickness_um<0&&e.after.bookedVolumeMm3>e.before.bookedVolumeMm3)throw Error('Inventory contradicts accepted growth direction');
      lastAccepted.set(e.id,e);
      zoneStates.get(e.id).push(e.zone);counts.set(e.id,e.zoneIndex+1);
    }else if(['zone-overprint','zone-finalization'].includes(e.kind)){
      if(!origins.has(e.id)||!Number.isSafeInteger(e.zoneIndex)||e.zoneIndex<0||e.zoneIndex>=counts.get(e.id)||!e.before||!e.after
        ||!same(zoneStates.get(e.id)[e.zoneIndex],e.before)
        ||(e.kind==='zone-finalization'&&e.before.step!==e.step))throw Error('Invalid overprint/finalization');
      zoneStates.get(e.id)[e.zoneIndex]=e.after;
    }else throw Error('Unknown scientific event');
  });
  let previousCount=0;
  for(let i=0;i<specimen.frames.length;i++){
    const f=specimen.frames[i];
    if(f.step!==i+1||f.surface?.step!==f.step||!Number.isSafeInteger(f.eventCount)
      ||f.eventCount<previousCount||f.eventCount>specimen.events.length
      ||!Array.isArray(f.allCalcite)||!Array.isArray(f.overprints))throw Error('Invalid recorded frame');
    const available=specimen.events.slice(0,f.eventCount);
    if(available.some(e=>e.step>f.step)||specimen.events.slice(f.eventCount).some(e=>e.step<=f.step))throw Error('Frame uses future or missing events');
    validateFrame(f.surface);
    const ids=new Set();
    for(const c of f.allCalcite){
      const origin=origins.get(c.id),zones=available.filter(e=>e.id===c.id&&['growth','dissolution','regrowth'].includes(e.kind));
      if(c.mineral!=='calcite'||ids.has(c.id)||!origin||origin.step>f.step||c.nucleationStep!==origin.step
        ||!Array.isArray(c.zones)||c.zones.length!==zones.length)throw Error('Frame lineage mismatch');
      ids.add(c.id);assertExtent(c);
      zones.forEach((e,j)=>{if(c.zones[j].step!==e.zone.step||c.zones[j].thickness_um!==e.zone.thickness_um)throw Error('Frame changed accepted zone');});
      const atStep=zones.map(e=>e.zone);
      for(const e of available)if(e.id===c.id&&['zone-overprint','zone-finalization'].includes(e.kind))atStep[e.zoneIndex]=e.after;
      if(!same(atStep,c.zones))throw Error('Frame changed zone composition or history without a recorded cause');
      const last=zones.at(-1);
      if(last&&extentKeys.some(k=>last.after[k]!==c[k]))throw Error('Frame changed extent or booked inventory without an accepted event');
    }
    for(const e of available)if(e.kind==='nucleation'&&!ids.has(e.id))throw Error('Frame dropped lineage');
    for(const c of f.surface.crystals)if(!same(c.facts,f.allCalcite.find(x=>x.id===c.id)))throw Error('Reconstruction has a second source of truth');
    for(const n of f.overprints)if(!Number.isSafeInteger(n)||specimen.events[n]?.kind!=='zone-overprint'||specimen.events[n].step!==f.step)throw Error('Missing overprint cause');
    previousCount=f.eventCount;
  }
  if(previousCount!==specimen.events.length)throw Error('Uncommitted growth events');
  return specimen;
}

export function saveCalciteSpecimen(specimen){assertCalciteSpecimen(specimen);return JSON.stringify(specimen);}
export function loadCalciteSpecimen(text){return freeze(assertCalciteSpecimen(JSON.parse(text)));}

// Exact recorded frames, never interpolation from a later habit or live fluid.
export class CalciteRecordPlayer {
  #specimen;
  constructor(specimen){this.#specimen=loadCalciteSpecimen(saveCalciteSpecimen(specimen));}
  atStep(step){
    if(!Number.isSafeInteger(step)||step<1||step>this.#specimen.frames.length)throw Error('No authoritative calcite frame at that step');
    return this.#specimen.frames[step-1].surface;
  }
}

// Deliberately cannot be opened by changing a saved flag. Authority/rebuild
// proofs alone do not resolve scientific volume or missing face/zone physics.
export function calciteProductionGate(specimen){
  assertCalciteSpecimen(specimen);
  return freeze({allowed:false,reasons:[
    'booked inventory and completed solid do not yet share a physical volume model',
    'face arrest/retreat and surviving internal zone boundaries remain unresolved',
    ...(specimen.events.some(e=>e.kind==='zone-overprint')?['later zone mutations require explicit modeled causes']:[]),
  ]});
}
