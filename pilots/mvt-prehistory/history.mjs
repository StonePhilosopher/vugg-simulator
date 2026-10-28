// Isolated causal-history compiler, not an MVT initial-condition migration.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../finite-reservoir-authority/contract.mjs';
import {finiteCalciteTransfer} from './transfer.mjs';
import mineralReference from '../physical-reservoir-mapping/source-evidence.json' with {type:'json'};

export const HISTORY_SCHEMA='vugg-host-fluid-prehistory-v1';
export const COMPONENT_UNITS=Object.freeze({calciumMol:'mol_Ca_per_kg_solvent',dicMolC:'mol_C_per_kg_solvent',
  ironMol:'mol_Fe_per_kg_solvent',zincMol:'mol_Zn_per_kg_solvent',leadMol:'mol_Pb_per_kg_solvent',
  sulfateMol:'mol_S_VI_per_kg_solvent',reducedSulfurMol:'mol_S_minusII_per_kg_solvent',
  oxygenMol:'mol_O2_per_kg_solvent',sodiumMol:'mol_Na_per_kg_solvent',chlorideMol:'mol_Cl_per_kg_solvent',
  alkalinityEq:'eq_per_kg_solvent'});
const KEYS=Object.keys(COMPONENT_UNITS),PHASES=['calcite','dolomite','quartz'];
const MODEL_FILES=['./history.mjs','./transfer.mjs','../finite-reservoir-authority/contract.mjs',
  '../physical-reservoir-mapping/source-evidence.json'];
const clone=x=>JSON.parse(canonicalJSON(x));
const sha=x=>createHash('sha256').update(canonicalJSON(x)).digest('hex');
const modelDigest=()=>sha(Object.fromEntries(MODEL_FILES.map(f=>[f,createHash('sha256')
  .update(fs.readFileSync(new URL(f,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')])));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function exact(x,keys,label){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length
    ||keys.some(k=>!Object.hasOwn(x,k)))throw Error(label+': complete explicit fields required');
}
function text(x,label){if(typeof x!=='string'||!x.trim())throw Error(label+': nonempty identity/reference required');return x;}
function provenance(p){
  exact(p,['kind','reference'],'provenance');
  if(!['authored-experiment','external-declaration'].includes(p.kind))throw Error('Unsupported provenance; no implicit legacy conversion');
  text(p.reference,'provenance');
}
function q(input,unit,signed=false){
  exact(input,['value','unit'],'quantity');
  if(input.unit!==unit||typeof input.value!=='number'||!Number.isFinite(input.value)||(!signed&&input.value<0))
    throw Error('Finite explicit quantity required: '+unit);
  return input.value;
}
function product(a,b){
  const x=a*b;if(!Number.isFinite(x)||(a!==0&&b!==0&&x===0))throw Error('Unrepresentable component product');return x===0?0:x;
}
function add(a,b){
  const x=a+b;if(!Number.isFinite(x)||(b!==0&&x===a))throw Error('Unrepresentable inventory change');return x===0?0:x;
}
function sum(xs){let s=0,c=0;for(const x of xs){const y=x-c,t=s+y;c=(t-s)-y;s=t;}return s;}
function closure(expected,actual,label,magnitude=Math.abs(expected)+Math.abs(actual)){
  const residual=actual-expected,tolerance=128*Number.EPSILON*magnitude;
  if(!Number.isFinite(residual)||!Number.isFinite(tolerance)||Math.abs(residual)>tolerance)
    throw Error(label+': conservation does not close');
  return {expected,actual,residual,tolerance};
}
function zeroComponents(){return Object.fromEntries(KEYS.map(k=>[k,0]));}
function geometry(host){
  exact(host,['id','lithology','axesMm','phases','priorAlteration','provenance'],'host');provenance(host.provenance);
  text(host.id,'host');text(host.lithology,'lithology');text(host.priorAlteration,'prior alteration disclosure');
  exact(host.axesMm,['x','y','z'],'host axes');
  const axes=['x','y','z'].map(k=>{
    const a=host.axesMm[k];
    if(!Array.isArray(a)||a.length<2||a.length>33)throw Error('Complete bounded material-parcel edges required');
    for(let i=0;i<a.length;i++)if(typeof a[i]!=='number'||!Number.isFinite(a[i])||(i&&a[i]<=a[i-1]))
      throw Error('Material-parcel edges must increase strictly');
    return a;
  });
  const dims=axes.map(a=>a.length-1),count=dims[0]*dims[1]*dims[2];
  if(count>512||!Array.isArray(host.phases)||host.phases.length!==count)throw Error('Every one of at most 512 host parcels requires a phase');
  const parcels=Array.from(host.phases,(phase,index)=>{
    if(!PHASES.includes(phase))throw Error('Explicit calcite/dolomite/quartz host phase required; no lithology-to-pure-calcite default');
    const xyz=[Math.floor(index/(dims[1]*dims[2])),Math.floor(index/dims[2])%dims[1],index%dims[2]];
    const lengths=xyz.map((p,d)=>axes[d][p+1]-axes[d][p]);
    const volume=product(product(lengths[0],lengths[1]),lengths[2]);
    if(!(volume>0))throw Error('Positive representable host-parcel volume required');
    return {id:index,address:xyz,initialPhase:phase,phase,volumeMm3:volume,lengthsMm:lengths};
  });
  return {parcels,dims};
}
function neighbors(parcel,parcels,dims){
  const found=[];
  for(let d=0;d<3;d++)for(const direction of [-1,1]){
    const a=parcel.address.slice();a[d]+=direction;
    if(a[d]<0||a[d]>=dims[d])continue;
    const next=parcels[(a[0]*dims[1]+a[1])*dims[2]+a[2]];
    if(next.phase==='void')found.push({id:next.id,areaMm2:product(parcel.lengthsMm[(d+1)%3],parcel.lengthsMm[(d+2)%3])});
  }
  return found;
}
function phaseVolumes(parcels){return Object.fromEntries(PHASES.map(p=>[p,sum(parcels.filter(x=>x.phase===p).map(x=>x.volumeMm3))]));}
function assertOnePore(parcels,dims){
  const voids=parcels.filter(p=>p.phase==='void');if(!voids.length)return;
  const visited=new Set([voids[0].id]),queue=[voids[0]];
  for(let i=0;i<queue.length;i++)for(const n of neighbors(queue[i],parcels,dims))
    if(!visited.has(n.id)){visited.add(n.id);queue.push(parcels[n.id]);}
  if(visited.size!==voids.length)throw Error('Disconnected voids cannot share one pore inventory in this bounded control');
}

function compile(input,events){
  exact(input,['schema','host','reservoirs','mixingVolumeModel','feederBoundaryModel','provenance'],'prehistory input');
  if(input.schema!==HISTORY_SCHEMA)throw Error('Unsupported prehistory schema');provenance(input.provenance);
  if(input.mixingVolumeModel!=='declared-additive-parcel-volume-control'
    ||input.feederBoundaryModel!=='imposed-external-port-isolation-control')
    throw Error('Explicit volume approximation and external port boundary required; no natural-MVT default');
  const {parcels,dims}=geometry(input.host),initialPhaseVolumes=phaseVolumes(parcels);
  if(!Array.isArray(input.reservoirs)||input.reservoirs.length<1||input.reservoirs.length>8)
    throw Error('One to eight explicitly named finite external reservoirs required');
  const reservoirs=Object.create(null),seen=new Set(),initialAqueous=zeroComponents();let initialWaterKg=0;
  for(const r of Array.from(input.reservoirs)){
    exact(r,['id','role','volume','solventMassPerVolume','molality','provenance'],'reservoir');provenance(r.provenance);
    text(r.id,'reservoir');text(r.role,'fluid origin');if(seen.has(r.id)||r.id===input.host.id)throw Error('Duplicate material source identity');seen.add(r.id);
    const volume=q(r.volume,'mm3_solution'),coefficient=q(r.solventMassPerVolume,'kg_solvent_per_mm3_solution');
    if(!(volume>0&&coefficient>0))throw Error('Positive reservoir volume and explicit solvent/solution-volume relation required');
    exact(r.molality,KEYS,'all declared control components');
    const molality=Object.fromEntries(KEYS.map(k=>[k,q(r.molality[k],COMPONENT_UNITS[k],k==='alkalinityEq')]));
    const water=product(volume,coefficient),amounts=Object.fromEntries(KEYS.map(k=>[k,product(molality[k],water)]));
    initialWaterKg=add(initialWaterKg,water);for(const k of KEYS)initialAqueous[k]=add(initialAqueous[k],amounts[k]);
    reservoirs[r.id]={id:r.id,role:r.role,initialVolumeMm3:volume,remainingVolumeMm3:volume,solventMassPerVolume:coefficient,
      initialWaterKg:water,remainingWaterKg:water,molality,components:amounts,provenance:clone(r.provenance)};
  }
  if(!Array.isArray(events)||events.length>64)throw Error('At most 64 complete causal events required');
  const vm=Number(mineralReference.calcite.molarVolumeCm3Mol),feeders=Object.create(null),aqueous=zeroComponents();
  const exported=Object.fromEntries(PHASES.map(p=>[p,0]));let waterKg=0,wetVolumeMm3=0,dissolvedCalciteMol=0;
  const receipts=[],eventIds=new Set();
  const voidVolume=()=>sum(parcels.filter(p=>p.phase==='void').map(p=>p.volumeMm3));
  const material=()=>({parcels:parcels.map(p=>({id:p.id,phase:p.phase})),exported,reservoirs,waterKg,wetVolumeMm3,aqueous,dissolvedCalciteMol});
  for(const e of Array.from(events)){
    if(!e||typeof e!=='object')throw Error('Complete causal event required');
    text(e.id,'event');if(eventIds.has(e.id))throw Error('Event identity already recorded');eventIds.add(e.id);provenance(e.provenance);
    const beforeDigest=sha(material()),beforeVoid=voidVolume();let detail={};
    if(e.type==='export_breccia'){
      exact(e,['id','type','parcelIds','provenance'],'breccia export');
      if(!Array.isArray(e.parcelIds)||!e.parcelIds.length||new Set(e.parcelIds).size!==e.parcelIds.length)throw Error('Distinct removed material parcels required');
      for(const id of e.parcelIds){
        const p=parcels[id];if(!Number.isSafeInteger(id)||!p||p.phase==='void')throw Error('Breccia export must consume a present host parcel once');
        exported[p.phase]=add(exported[p.phase],p.volumeMm3);p.phase='void';
      }
      detail={meaning:'mechanical export into a named external breccia ledger; no dissolved solute is created'};
    }else if(e.type==='connect_feeder'){
      exact(e,['id','type','feederId','poreParcelId','reservoirIds','provenance'],'feeder connection');text(e.feederId,'feeder');
      if(Object.hasOwn(feeders,e.feederId)||!Number.isSafeInteger(e.poreParcelId)||parcels[e.poreParcelId]?.phase!=='void'
        ||!Array.isArray(e.reservoirIds)||!e.reservoirIds.length||new Set(e.reservoirIds).size!==e.reservoirIds.length
        ||e.reservoirIds.some(id=>!Object.hasOwn(reservoirs,id)))throw Error('A new feeder must connect existing void to named finite reservoirs');
      feeders[e.feederId]={id:e.feederId,poreParcelId:e.poreParcelId,reservoirIds:e.reservoirIds.slice(),open:true};
    }else if(e.type==='admit_fluid'){
      exact(e,['id','type','feederId','reservoirId','volume','provenance'],'fluid entry');
      const feeder=feeders[e.feederId],r=reservoirs[e.reservoirId];
      if(!feeder?.open||!r||!feeder.reservoirIds.includes(e.reservoirId))throw Error('Fluid entry requires an open feeder to its named reservoir');
      if(wetVolumeMm3===null)throw Error('Post-reaction solution volume is unresolved; no hidden refill or overflow');
      const volume=q(e.volume,'mm3_solution');
      if(volume>r.remainingVolumeMm3||volume>voidVolume()-wetVolumeMm3)throw Error('Fluid pulse exceeds finite donor or available pore volume');
      // The final withdrawal consumes the actual finite balance. Repeated
      // floating multiplication must not leave negative water or ghost solute.
      const entire=volume===r.remainingVolumeMm3;
      const incomingWater=entire?r.remainingWaterKg:product(volume,r.solventMassPerVolume);
      const incoming=entire?{...r.components}:Object.fromEntries(KEYS.map(k=>[k,product(incomingWater,r.molality[k])]));
      r.remainingVolumeMm3=add(r.remainingVolumeMm3,-volume);r.remainingWaterKg=add(r.remainingWaterKg,-incomingWater);
      waterKg=add(waterKg,incomingWater);wetVolumeMm3=add(wetVolumeMm3,volume);
      for(const k of KEYS){r.components[k]=add(r.components[k],-incoming[k]);aqueous[k]=add(aqueous[k],incoming[k]);}
      if(r.remainingWaterKg<0||KEYS.some(k=>k!=='alkalinityEq'&&r.components[k]<0))
        throw Error('Finite donor debit cannot leave negative water or component inventory');
      detail={reservoirId:r.id,enteredVolumeMm3:volume,enteredWaterKg:incomingWater,enteredComponents:incoming,
        volumeMeaning:'declared additive parcel-volume approximation, not a commissioned mixed-brine equation of state'};
    }else if(e.type==='seal_feeder'||e.type==='reopen_feeder'){
      exact(e,['id','type','feederId','mechanism','provenance'],'feeder transition');
      if(e.mechanism!=='imposed-outside-pore-isolation')throw Error('A physical cement/closure volume cannot be invented by a connectivity toggle');
      const feeder=feeders[e.feederId],opening=e.type==='reopen_feeder';
      if(!feeder||feeder.open===opening)throw Error('Feeder transition does not follow its preceding state');
      feeder.open=opening;
      detail={mechanism:e.mechanism,materialBeforeDigest:beforeDigest,materialAfterDigest:sha(material()),
        meaning:'imposed external interface transition only; not a modeled cementation or fracture-rate law'};
    }else if(e.type==='remove_calcite_parcel'){
      exact(e,['id','type','parcelId','prescribedWholeParcel','contactModel','provenance'],'prescribed host reaction');
      const p=parcels[e.parcelId];
      if(e.prescribedWholeParcel!==true||e.contactModel!=='prescribed-whole-parcel-contact-control'
        ||!Number.isSafeInteger(e.parcelId)||!p||p.phase!=='calcite'||neighbors(p,parcels,dims).length===0||!(waterKg>0))
        throw Error('Only a prescribed exposed calcite parcel with resident solvent can react');
      const n=p.volumeMm3/(vm*1000);
      const transfer=finiteCalciteTransfer({wallSourceId:input.host.id+'@'+p.id,owner:'wall-carbonate',phase:'calcite',
        requested:{value:n,unit:'mol_CaCO3'},accessible:{value:n,unit:'mol_CaCO3'},
        molarVolume:{value:vm,unit:'cm3_per_mol_CaCO3'},provenance:e.provenance});
      aqueous.calciumMol=add(aqueous.calciumMol,transfer.acceptedMol);aqueous.dicMolC=add(aqueous.dicMolC,transfer.acceptedMol);
      aqueous.alkalinityEq=add(aqueous.alkalinityEq,2*transfer.acceptedMol);
      dissolvedCalciteMol=add(dissolvedCalciteMol,transfer.acceptedMol);p.phase='void';wetVolumeMm3=null;
      detail={transfer,parcelId:p.id,voidGainMm3:p.volumeMm3,
        conversion:closure(p.volumeMm3,transfer.delta.crystallineVolumeRemovedMm3,'calcite removal / new void'),
        contactModel:e.contactModel,
        meaning:'prescribed contact/full-parcel transfer, not predicted wetting, saturation, buffering kinetics, or dissolution duration'};
    }else throw Error('Unsupported causal event; no implicit alteration, sealing, water or mineral defaults');
    assertOnePore(parcels,dims);
    receipts.push({id:e.id,type:e.type,preMaterialDigest:beforeDigest,postMaterialDigest:sha(material()),
      voidBeforeMm3:beforeVoid,voidAfterMm3:voidVolume(),detail});
  }
  const remaining=phaseVolumes(parcels),voidMm3=voidVolume(),totalHostVolumeMm3=sum(parcels.map(p=>p.volumeMm3));
  const closureEvidence={hostGeometry:closure(totalHostVolumeMm3,voidMm3+sum(Object.values(remaining)),'host geometry'),
    phaseVolumes:Object.fromEntries(PHASES.map(p=>[p,closure(initialPhaseVolumes[p],remaining[p]+exported[p]
      +(p==='calcite'?dissolvedCalciteMol*vm*1000:0),p+' host/export/reaction')])),
    water:closure(initialWaterKg,waterKg+sum(Object.values(reservoirs).map(r=>r.remainingWaterKg)),'all source water'),
    components:{}};
  for(const k of ['calciumMol','dicMolC']){
    closureEvidence['calciteSegment_'+k]=closure(initialAqueous[k]+initialPhaseVolumes.calcite/(vm*1000),
      aqueous[k]+sum(Object.values(reservoirs).map(r=>r.components[k]))+(remaining.calcite+exported.calcite)/(vm*1000),
      'calcite host/export/aqueous '+k);
  }
  for(const k of KEYS){
    const transferred=k==='calciumMol'||k==='dicMolC'?dissolvedCalciteMol:k==='alkalinityEq'?2*dissolvedCalciteMol:0;
    closureEvidence.components[k]=closure(initialAqueous[k]+transferred,
      aqueous[k]+sum(Object.values(reservoirs).map(r=>r.components[k])),k,
      Math.abs(initialAqueous[k])+Math.abs(transferred)+Math.abs(aqueous[k])+sum(Object.values(reservoirs).map(r=>Math.abs(r.components[k]))));
  }
  const exposed=parcels.filter(p=>p.phase!=='void').map(p=>({parcelId:p.id,phase:p.phase,remainingVolumeMm3:p.volumeMm3,
    exposedFaceAreaMm2:sum(neighbors(p,parcels,dims).map(x=>x.areaMm2)),
    potentialCalciteMol:p.phase==='calcite'&&neighbors(p,parcels,dims).length?p.volumeMm3/(vm*1000):0}));
  const payload={schema:'vugg-host-fluid-boundary-snapshot-v1',inputs:clone(input),events:clone(events),modelDigest:modelDigest(),
    historyReceipts:receipts,host:{id:input.host.id,lithology:input.host.lithology,priorAlteration:input.host.priorAlteration,
      initialPhaseVolumesMm3:initialPhaseVolumes,remainingPhaseVolumesMm3:remaining,exportedPhaseVolumesMm3:exported,
      parcels,exposedSurfaces:exposed,dissolvedCalciteMol,calciteMolarVolumeCm3Mol:vm,
      calciteReference:clone(mineralReference.calcite)},
    pore:{geometricVoidVolumeMm3:voidMm3,wetVolumeMm3,waterKg,components:aqueous,pH:null,pressureBar:null,
      connectivity:voidMm3===0?'no-pore':Object.values(feeders).some(f=>f.open)?'connected'
        :Object.keys(feeders).length?'sealed':'unestablished',
      residentFluidProvenance:receipts.filter(r=>r.type==='admit_fluid').map(r=>({eventId:r.id,...r.detail})),
      waterMeaning:'derived only from the admitted fluid parcels and their explicit solvent/solution-volume relation'},
    externalReservoirs:reservoirs,feeders,closure:closureEvidence,
    qualification:'authored control with declared volume approximation and external isolation; not commissioned natural-MVT physical prehistory',
    productionMappingAllowed:false,productionReactions:false,transport:false,kinetics:false,legacyProjection:false};
  return freeze({...payload,recordDigest:sha(payload)});
}

export function compilePrehistory(input,events=[]){return compile(input,events);}
function verified(snapshot){
  const result=compile(snapshot?.inputs,snapshot?.events);
  if(canonicalJSON(result)!==canonicalJSON(snapshot))throw Error('Snapshot differs from its source-bound causal prehistory');
  return result;
}
export function appendPrehistoryEvent(snapshot,event){const valid=verified(snapshot);return compile(valid.inputs,[...valid.events,event]);}
export function prehistoryPrefix(snapshot,length){
  const valid=verified(snapshot);
  if(!Number.isSafeInteger(length)||length<0||length>valid.events.length)throw Error('Exact recorded history prefix required');
  return compile(valid.inputs,valid.events.slice(0,length));
}
export function serializePrehistory(snapshot){
  const valid=verified(snapshot);
  return JSON.stringify({schema:'vugg-host-fluid-prehistory-checkpoint-v1',inputs:valid.inputs,events:valid.events,
    modelDigest:valid.modelDigest,recordDigest:valid.recordDigest});
}
export function restorePrehistory(textInput){
  if(typeof textInput!=='string')throw Error('Complete prehistory checkpoint text required');
  const saved=JSON.parse(textInput);exact(saved,['schema','inputs','events','modelDigest','recordDigest'],'prehistory checkpoint');
  if(saved.schema!=='vugg-host-fluid-prehistory-checkpoint-v1'||saved.modelDigest!==modelDigest())throw Error('Prehistory model/source binding changed');
  const snapshot=compile(saved.inputs,saved.events);
  if(saved.recordDigest!==snapshot.recordDigest)throw Error('Prehistory inputs/causes binding changed');
  return snapshot;
}
