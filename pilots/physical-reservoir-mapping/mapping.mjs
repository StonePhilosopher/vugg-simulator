// Analytical initialization control only. Neither game runtime imports this.
import {createHash} from 'node:crypto';
import evidence from './source-evidence.json' with {type:'json'};
import {canonicalJSON,DECLARATION_SCHEMA,MOLAL_UNITS,compileFiniteReservoirDeclaration}
  from '../finite-reservoir-authority/contract.mjs';

export const CONTROL_SCHEMA='vugg-physical-reservoir-control-v1';
const CHECKPOINT_SCHEMA='vugg-physical-reservoir-checkpoint-v1';
const sha=x=>createHash('sha256').update(canonicalJSON(x)).digest('hex');
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
freeze(evidence);
function exact(x,keys,label){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length
    ||keys.some(k=>!Object.hasOwn(x,k)))throw Error(label+': complete explicit fields required');
}
function provenance(p){
  exact(p,['kind','reference'],'control provenance');
  if(p.kind!=='authored-experiment'||typeof p.reference!=='string'||!p.reference.trim())
    throw Error('Only explicitly authored analytical controls are supported');
}
function quantity(q,unit){
  exact(q,['value','unit','provenance'],'control quantity');provenance(q.provenance);
  if(q.unit!==unit||typeof q.value!=='number'||!Number.isFinite(q.value))throw Error('Invalid control quantity/units: '+unit);
  return q.value;
}
function sum(xs){let s=0,c=0;for(const x of xs){const y=x-c,t=s+y;c=(t-s)-y;s=t;}return s;}
function amount(volume,scale){
  const value=volume*scale;
  if(!Number.isFinite(value)||(volume>0&&value===0))throw Error('Unrepresentable physical amount');
  return value;
}
function closes(expected,actual,label){
  const residual=actual-expected,tolerance=64*Number.EPSILON*(Math.abs(expected)+Math.abs(actual));
  if(!Number.isFinite(residual)||!Number.isFinite(tolerance)||Math.abs(residual)>tolerance)
    throw Error(label+': volume partition does not close');
  return {expected,actual,residual,tolerance};
}
const q=(value,unit,reference)=>({value,unit,provenance:{kind:'authored-experiment',reference}});

// IAPWS SR6-08(2011), Eq. (2), Table 1. This is explicitly pure ordinary
// liquid water at 100000 Pa, not a brine-density or general-pressure model.
export function iapwsReferenceDensity(temperatureK){
  if(typeof temperatureK!=='number'||!Number.isFinite(temperatureK)||temperatureK<253.15||temperatureK>383.15)
    throw Error('Outside the published liquid-water correlation range');
  const w=evidence.water,alpha=Number(w.TR)/(Number(w.TaK)-temperatureK),
    beta=Number(w.TR)/(temperatureK-Number(w.TbK));
  const bracket=Number(w.a5)+sum(w.a.map(([n,a])=>Number(a)*alpha**n))
    +sum(w.b.map(([m,b])=>Number(b)*beta**m));
  const specificVolume=Number(w.R)*Number(w.TR)/Number(w.p0Pa)*bracket;
  if(!(specificVolume>0)||!Number.isFinite(specificVolume))throw Error('Unrepresentable water specific volume');
  return 1/specificVolume;
}

export function mapPhysicalControl(input){
  exact(input,['schema','geometry','water','wall','temperature','pressure','cavityRadius','wallThickness','partition','provenance'],'physical control');
  provenance(input.provenance);
  if(input.schema!==CONTROL_SCHEMA||input.geometry!=='analytic-concentric-sphere-shell-v1'
    ||input.water!=='fully-flooded-degassed-pure-H2O-no-displaced-solids'
    ||input.wall!=='nonporous-pure-calcite-entire-shell-inventory')
    throw Error('Only the explicit flooded sphere/pure-water/pure-calcite control is commissioned');
  const temperatureC=quantity(input.temperature,'deg_C'),pressureBar=quantity(input.pressure,'bar_abs');
  if(temperatureC!==26||pressureBar!==1)throw Error('Control requires 26 deg_C and 1 bar absolute; no P-T extrapolation');
  const radius=quantity(input.cavityRadius,'mm'),thickness=quantity(input.wallThickness,'mm');
  if(!(radius>0)||!(thickness>0)||!Number.isFinite(radius+thickness)||radius+thickness===radius)
    throw Error('Positive representable cavity radius and wall thickness required');
  exact(input.partition,['rings','cellsPerRing','radialEdgesMm'],'control partition');
  const {rings,cellsPerRing,radialEdgesMm:edges}=input.partition;
  if(!Number.isSafeInteger(rings)||rings<1||!Number.isSafeInteger(cellsPerRing)||cellsPerRing<1
    ||!Array.isArray(edges)||edges.length<2||edges[0]!==radius||edges.at(-1)!==0)
    throw Error('Complete explicit angular/radial partition required');
  const depths=edges.length-1,count=rings*cellsPerRing*depths;
  if(!Number.isSafeInteger(count)||count>65536)throw Error('Control partition exceeds the bounded 65536-cell limit');
  for(let d=0;d<edges.length;d++){
    if(typeof edges[d]!=='number'||!Number.isFinite(edges[d])||edges[d]<0||(d&&edges[d]>=edges[d-1]))
      throw Error('Radial boundaries must decrease strictly from cavity radius to zero');
  }
  const sourceDigest=sha(evidence),mappingId=sha({input,sourceDigest});
  const density=iapwsReferenceDensity(temperatureC+273.15),vm=Number(evidence.calcite.molarVolumeCm3Mol);
  const waterVolume=4*Math.PI*radius**3/3;
  // Stable shell polynomial avoids subtracting two almost equal cubes.
  const shellCube=thickness*(3*radius**2+3*radius*thickness+thickness**2);
  const wallVolume=4*Math.PI*shellCube/3;
  if(![waterVolume,wallVolume].every(v=>v>0&&Number.isFinite(v)))throw Error('Unrepresentable physical control volume');
  const waterKg=amount(waterVolume,density*1e-9),calciteMol=amount(wallVolume,1/(1000*vm));
  const reference='physical-control:'+mappingId;
  const cells=[];
  for(let r=0;r<rings;r++)for(let c=0;c<cellsPerRing;c++)for(let d=0;d<depths;d++){
    const phi0=Math.PI*r/rings,phi1=Math.PI*(r+1)/rings;
    const theta0=2*Math.PI*c/cellsPerRing,theta1=2*Math.PI*(c+1)/cellsPerRing;
    const solidAngle=(2*Math.PI/cellsPerRing)*2*Math.sin((phi0+phi1)/2)*Math.sin((phi1-phi0)/2);
    const outer=edges[d],inner=edges[d+1];
    const fluidCube=(outer-inner)*(outer**2+outer*inner+inner**2);
    const waterVolumeMm3=solidAngle*fluidCube/3,wallVolumeMm3=d===0?solidAngle*shellCube/3:0;
    if(!(waterVolumeMm3>0)||(d===0&&!(wallVolumeMm3>0)))throw Error('Unrepresentable physical cell volume');
    cells.push({address:[r,c,d],bounds:{polarRadians:[phi0,phi1],azimuthRadians:[theta0,theta1],radialMm:[inner,outer]},
      waterVolumeMm3,wallVolumeMm3,waterKg:amount(waterVolumeMm3,density*1e-9),calciteMol:amount(wallVolumeMm3,1/(1000*vm))});
  }
  const closure={waterVolumeMm3:closes(waterVolume,sum(cells.map(c=>c.waterVolumeMm3)),'water'),
    wallVolumeMm3:closes(wallVolume,sum(cells.map(c=>c.wallVolumeMm3)),'wall')};
  const declaration={schema:DECLARATION_SCHEMA,dimensions:{rings,cellsPerRing,depths},
    waterSources:[{id:'control-water',water:q(waterKg,'kg_solvent_water',reference+'; '+evidence.water.url),
      // Zero analytical totals follow from the declared degassed pure-water
      // experiment. They are not inferred absences in any legacy fluid.
      molality:Object.fromEntries(Object.entries(MOLAL_UNITS).map(([k,u])=>[k,q(0,u,reference+'; explicitly degassed pure H2O')]))}],
    calciteSources:[{id:'control-wall',owner:'wall-carbonate',phase:'calcite',
      amount:q(calciteMol,'mol_CaCO3',reference+'; '+evidence.calcite.url)}],
    cells:cells.map(c=>({address:c.address,waterSourceId:'control-water',
      water:q(c.waterKg,'kg_solvent_water',reference+'; analytical sector volume times pure-water density'),
      calciteSourceId:c.address[2]===0?'control-wall':null,
      calcite:q(c.calciteMol,'mol_CaCO3',reference+'; angular allotment of one global shell'),
      temperature:q(temperatureC,'deg_C',reference),pressure:q(pressureBar/1000,'kbar',reference),pHModel:'unresolved'}))};
  const compiled=compileFiniteReservoirDeclaration(declaration),vmError=Number(evidence.calcite.reportedErrorCm3Mol);
  const payload={schema:'vugg-physical-reservoir-record-v1',inputs:JSON.parse(canonicalJSON(input)),sourceDigest,mappingId,
    geometryAuthority:'authored analytical sphere and shell; not a legacy/rendered cavity or a measured natural specimen',
    densityKgM3:density,molarVolumeCm3Mol:vm,cells,closure,compiled,
    uncertainty:{geometry:'exact by definition for this analytical control; not a measurement with zero error',
      waterKgFromDensityK2:waterKg*evidence.water.stableLiquidRelativeUncertainty,
      calciteMolAtVmPlusReportedError:wallVolume/(1000*(vm+vmError)),
      calciteMolAtVmMinusReportedError:wallVolume/(1000*(vm-vmError)),
      calciteIntervalMeaning:'reported-error sensitivity, not a guaranteed bound or k=2 interval',
      excluded:'natural geometry, wall phase fraction/porosity/access, mineral pressure correction; no combined full uncertainty'},
    stockAccess:'angular budgets assigned to d=0 only; no instantaneous accessibility or dissolution-rate claim',
    productionAllowed:false,legacyPhysicalMapping:false,reactions:false,transport:false};
  return freeze({...payload,recordDigest:sha(payload)});
}

function verified(record){
  const regenerated=mapPhysicalControl(record?.inputs);
  if(canonicalJSON(record)!==canonicalJSON(regenerated))throw Error('Physical record no longer matches its causal inputs');
  return regenerated;
}
export function serializePhysicalRecord(record){
  const valid=verified(record);
  return JSON.stringify({schema:CHECKPOINT_SCHEMA,inputs:valid.inputs,recordDigest:valid.recordDigest});
}
export function restorePhysicalRecord(text){
  if(typeof text!=='string')throw Error('Complete physical checkpoint text required');
  const saved=JSON.parse(text);exact(saved,['schema','inputs','recordDigest'],'physical checkpoint');
  if(saved.schema!==CHECKPOINT_SCHEMA)throw Error('Unsupported physical checkpoint schema');
  const record=mapPhysicalControl(saved.inputs);
  if(saved.recordDigest!==record.recordDigest)throw Error('Physical input/model/source binding mismatch');
  return record;
}

// A discrepancy report, never a legacy converter or a stock rescaler.
export function compareLegacyWallReference(record,reference){
  const valid=verified(record);
  if(reference?.units!=='mmol_formula_per_kg_solvent_reference'||reference.modeledFormula!=='CaCO3'
    ||typeof reference.remaining!=='number'||!Number.isFinite(reference.remaining)||reference.remaining<=0
    ||reference.physicalCalciteMol!==null||reference.physicalWaterKg!==null)
    throw Error('An unreconciled positive legacy CaCO3 reference ledger is required');
  if(reference.nominalCavityRadiusMm!==valid.inputs.cavityRadius.value
    ||reference.remainingThicknessMm!==valid.inputs.wallThickness.value)
    throw Error('Legacy comparison requires the same nominal radius and remaining thickness');
  const legacyMolPerKgReference=reference.remaining/1000;
  const physicalWaterKg=valid.compiled.totals.waterKg,physicalCalciteMol=valid.compiled.totals.calciteMol;
  const hypotheticalCalciteMol=legacyMolPerKgReference*physicalWaterKg;
  const impliedReferenceKgToRepresentShell=physicalCalciteMol/legacyMolPerKgReference;
  const physicalToHypotheticalStockRatio=physicalCalciteMol/hypotheticalCalciteMol;
  if(![legacyMolPerKgReference,hypotheticalCalciteMol,impliedReferenceKgToRepresentShell,physicalToHypotheticalStockRatio]
    .every(n=>n>0&&Number.isFinite(n)))throw Error('Unrepresentable legacy reference comparison');
  return freeze({schema:'vugg-wall-reference-physical-discrepancy-v1',legacyMolPerKgReference,
    comparisonBasis:'same nominal radius/thickness only; legacy irregular shape is not equated to the analytical sphere',
    physicalWaterKg,physicalCalciteMol,hypotheticalCalciteMolIfReferenceKgEqualsWaterKg:hypotheticalCalciteMol,
    impliedReferenceKgToRepresentShell,physicalToHypotheticalStockRatio,
    authority:'dimensional diagnostic only; implied reference kg are not physical solvent kg',
    productionMappingAllowed:false,referenceRescaled:false});
}
