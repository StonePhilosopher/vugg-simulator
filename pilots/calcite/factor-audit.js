// Read-only diagnosis from preserved planes. No growth, fluid, RNG, graphics,
// normalization changes, or new physical-volume convention.
import {geometryVolume,freeze,clone} from './specimen.js';
import {assertCalciteSpecimen} from './authority.js';

const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const scale=(v,k)=>v.map(x=>x*k);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const near=(a,b,label)=>{
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>Math.max(1e-10,Math.abs(b)*1e-8))throw Error(`Preserved-plane volume disagreement: ${label}`);
};

// Same rigid coordinate transform as the saved specimen, used only to measure
// extents in its own a/c/b frame. This never stretches the preserved surface.
function axes(facts){
  const u=scale(facts.axis,1/Math.hypot(...facts.axis)),w=1+u[1];
  const q=w<1e-10?[0,0,1]:cross([0,1,0],u),qw0=w<1e-10?0:w;
  const norm=Math.hypot(...q,qw0),v=scale(q,1/norm),qw=qw0/norm;
  const rotate=p=>{
    const r=[Math.cos(facts.yaw)*p[0]+Math.sin(facts.yaw)*p[2],p[1],-Math.sin(facts.yaw)*p[0]+Math.cos(facts.yaw)*p[2]];
    return add(r,add(scale(cross(v,r),2*qw),scale(cross(v,cross(v,r)),2)));
  };
  return [[1,0,0],[0,1,0],[0,0,1]].map(rotate);
}

export function boundingReference(facts,fullPlanes,polyhedron){
  const full=polyhedron(fullPlanes);
  if(full.vertices.length<4||full.faces.length<4)throw Error('No preserved full body');
  const extents=axes(facts).map(axis=>{
    const projected=full.vertices.map(v=>dot(v,axis));
    return Math.max(...projected)-Math.min(...projected);
  });
  const boundingEllipsoidMm3=Math.PI/6*extents[0]*extents[1]*extents[2];
  if(!(boundingEllipsoidMm3>0)||!(facts.bookedVolumeMm3>0))throw Error('Invalid diagnostic volume reference');
  const fullVolumeMm3=geometryVolume(full);
  return {
    reference:'ellipsoid fitted to full-body a/c/b extents; diagnostic only, not a solid or porosity model',
    extentsMm:{a:extents[0],c:extents[1],b:extents[2]},boundingEllipsoidMm3,
    boundingToBooked:boundingEllipsoidMm3/facts.bookedVolumeMm3,
    polyhedronToBounding:fullVolumeMm3/boundingEllipsoidMm3,
    dimensionRatios:{a:extents[0]/facts.aWidthMm,c:extents[1]/facts.cLengthMm,b:extents[2]/facts.aWidthMm},
    fullVolumeMm3,
  };
}

export function auditSpecimenFactors(specimen,polyhedron){
  assertCalciteSpecimen(specimen);
  const before=JSON.stringify(specimen),samples=[];
  for(const frame of specimen.frames)for(const crystal of frame.surface.crystals){
    const planes=crystal.completion.planes,fullPlanes=planes.filter(p=>p.kind==='form');
    const attachedPlanes=planes.filter(p=>p.kind==='form'||p.kind==='attachment');
    const reference=boundingReference(crystal.facts,fullPlanes,polyhedron);
    const attachedVolumeMm3=geometryVolume(polyhedron(attachedPlanes));
    const completedVolumeMm3=geometryVolume(polyhedron(planes)),audit=crystal.completion.volumeAudit;
    near(reference.fullVolumeMm3,audit.fullVolumeMm3,'full form');
    near(attachedVolumeMm3,audit.attachedVolumeMm3,'attachment');
    near(completedVolumeMm3,crystal.completion.volumeMm3,'contact completion');
    near(reference.boundingToBooked*reference.polyhedronToBounding,audit.fullToBooked,'reference factorization');
    const phases=specimen.events.filter(e=>e.step===frame.step&&e.id===crystal.id
      &&['growth','dissolution','regrowth'].includes(e.kind)).map(e=>e.kind);
    samples.push({step:frame.step,id:crystal.id,habit:crystal.facts.habit,phases:[...new Set(phases)],
      cLengthMm:crystal.facts.cLengthMm,aWidthMm:crystal.facts.aWidthMm,
      bookedVolumeMm3:crystal.facts.bookedVolumeMm3,
      fullVolumeMm3:reference.fullVolumeMm3,attachedVolumeMm3,completedVolumeMm3,
      fullToBooked:audit.fullToBooked,attachmentRetention:audit.attachmentRetention,contactRetention:audit.contactRetention,
      contactPlanes:planes.filter(p=>p.kind==='contact').length,
      activeContactFaces:crystal.completion.poly.faces.filter(f=>planes[f.plane].kind==='contact').length,
      reference});
  }
  if(JSON.stringify(specimen)!==before)throw Error('Factor audit mutated specimen');
  const phaseCounts=Object.fromEntries(['growth','dissolution','regrowth'].map(kind=>[kind,samples.filter(s=>s.phases.includes(kind)).length]));
  return freeze({model:clone(specimen.model),supportedCrystalSteps:samples.length,
    habits:[...new Set(samples.map(s=>s.habit))].sort(),phaseCounts,
    contactFaceSamples:samples.filter(s=>s.activeContactFaces>0).length,
    sizeRangeMm:samples.length?{c:[Math.min(...samples.map(s=>s.cLengthMm)),Math.max(...samples.map(s=>s.cLengthMm))],
      a:[Math.min(...samples.map(s=>s.aWidthMm)),Math.max(...samples.map(s=>s.aWidthMm))]}:null,
    samples});
}

export function fleetFactorCoverage(census){
  const samples=census.scenarios.flatMap(s=>s.historical.flatMap(f=>(f.crystals||[]).map(c=>({...c,scenario:s.scenario,step:f.step}))));
  if(census.scenarios.some(s=>!s.observationDidNotMutate||s.historical.some(f=>f.error)||s.crystals.some(c=>c.error)))throw Error('Incomplete fleet factor evidence');
  const supportedEndpoints=census.scenarios.reduce((n,s)=>n+s.eligibleCount,0);
  return freeze({scenarios:census.scenarios.length,endpointCalcites:census.scenarios.reduce((n,s)=>n+s.calciteCount,0),
    supportedEndpoints,excludedEndpoints:census.scenarios.reduce((n,s)=>n+s.excluded.length,0),
    supportedHistoricalCrystalSteps:samples.length,
    supportedScenarios:[...new Set(samples.map(s=>s.scenario))].sort(),
    supportedHabits:[...new Set(samples.map(s=>s.habit))].sort(),
    contactVolumeLossSamples:samples.filter(s=>s.contactRetention<1-1e-8).length,
    contactTopology:'not captured by the fleet scalar receipt',
    dissolutionAndRegrowth:'not classified by the fleet scalar receipt; unknown, not zero',
    boundingReference:'requires saved planes; unavailable in the fleet scalar receipt',
    completedToBookedRange:samples.length?[Math.min(...samples.map(s=>s.completedVolumeMm3/s.bookedVolumeMm3)),
      Math.max(...samples.map(s=>s.completedVolumeMm3/s.bookedVolumeMm3))]:null});
}
