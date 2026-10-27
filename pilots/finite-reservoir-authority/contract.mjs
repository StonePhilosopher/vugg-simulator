// Calcite-only initial reservoir declarations. Not loaded by either game runtime.
// Converts explicit source molalities and allocated water into component amounts.
// It never chooses water density, reactive wall fractions, or a growth/volume model.
import {createHash} from 'node:crypto';

export const DECLARATION_SCHEMA = 'vugg-finite-reservoir-initialization-v1';
export const CHECKPOINT_SCHEMA = 'vugg-finite-reservoir-checkpoint-v1';
export const MOLAL_UNITS = Object.freeze({dicMolC:'mol_C_per_kg_water',
  calciumMol:'mol_Ca_per_kg_water', ironMol:'mol_Fe_total_per_kg_water',
  sulfateMol:'mol_S_VI_per_kg_water', oxygenMol:'mol_O2_per_kg_water',
  alkalinityEq:'eq_per_kg_water'});
const COMPONENTS = Object.keys(MOLAL_UNITS);
const PROVENANCE = ['authored-experiment', 'external-declaration'];
const REFERENCE_PREFIX = 'finite-reservoir-declaration-sha256:';

function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== keys.length
      || keys.some(k => !Object.hasOwn(value, k))) throw Error(`${label}: complete explicit fields required`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label}: nonempty reference/identity required`);
  return value;
}
function dense(value, label) {
  if (!Array.isArray(value)) throw Error(`${label}: array required`);
  return Array.from(value, x => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error(`${label}: missing/sparse entry`);
    return x;
  });
}
function quantity(q, unit, label, signed = false) {
  exact(q, ['value','unit','provenance'], label);
  if (q.unit !== unit || typeof q.value !== 'number' || !Number.isFinite(q.value)
      || (!signed && q.value < 0)) throw Error(`${label}: invalid amount or units; expected ${unit}`);
  exact(q.provenance, ['kind','reference'], `${label} provenance`);
  if (!PROVENANCE.includes(q.provenance.kind)) throw Error(`${label}: no commissioned legacy/geometry mapping`);
  text(q.provenance.reference, `${label} provenance`);
  return q.value;
}
function freeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
}
export function canonicalJSON(x) {
  if (Array.isArray(x)) return '['+x.map(canonicalJSON).join(',')+']';
  if (x && typeof x === 'object') return '{'+Object.keys(x).sort()
    .map(k => JSON.stringify(k)+':'+canonicalJSON(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
const sha = x => createHash('sha256').update(canonicalJSON(x)).digest('hex');
function sum(values) {
  let total = 0, correction = 0;
  for (const x of values) { const adjusted=x-correction, next=total+adjusted;
    correction=(next-total)-adjusted; total=next; }
  if (!Number.isFinite(total)) throw Error('Unrepresentable inventory sum');
  return total;
}
function product(a, b) {
  const value=a*b;
  if (!Number.isFinite(value) || (a!==0 && b!==0 && value===0)) throw Error('Unrepresentable inventory product');
  return value===0 ? 0 : value;
}
function closure(expected, observed, label, magnitude = Math.abs(expected)+Math.abs(observed)) {
  // Roundoff only: no absolute floor that could forgive exhausting a tiny stock.
  // Report the residual; never rescale allocations or invent a remainder.
  const tolerance=64*Number.EPSILON*magnitude, residual=expected-observed;
  if (!Number.isFinite(residual) || !Number.isFinite(tolerance)
      || Math.abs(residual)>tolerance) throw Error(`${label}: allocation does not close`);
  return {expected, allocated:observed, residual, tolerance};
}
function dimensions(input) {
  exact(input, ['rings','cellsPerRing','depths'], 'dimensions');
  if (Object.values(input).some(n => !Number.isSafeInteger(n) || n<1)
      || !Number.isSafeInteger(input.rings*input.cellsPerRing*input.depths)) throw Error('Invalid dimensions');
}
const addressKey = a => a.join(',');

export function compileFiniteReservoirDeclaration(input) {
  exact(input, ['schema','dimensions','waterSources','calciteSources','cells'], 'reservoir declaration');
  if (input.schema!==DECLARATION_SCHEMA) throw Error('Unsupported reservoir declaration schema');
  dimensions(input.dimensions);
  const ids=new Set(), waters=new Map(), calcites=new Map();
  const addId=id => { text(id,'source'); if (ids.has(id)) throw Error('Duplicate source identity'); ids.add(id); };
  for (const source of dense(input.waterSources,'water sources')) {
    exact(source,['id','water','molality'],'water source'); addId(source.id);
    const kg=quantity(source.water,'kg_solvent_water','source water');
    exact(source.molality,COMPONENTS,'source composition');
    const molality=Object.fromEntries(COMPONENTS.map(k=>[k,
      quantity(source.molality[k],MOLAL_UNITS[k],k,k==='alkalinityEq')]));
    if (kg===0 && COMPONENTS.some(k=>molality[k]!==0)) throw Error('Dry source has nonzero composition');
    waters.set(source.id,{source,kg,molality,allocations:[]});
  }
  const solidSources=dense(input.calciteSources,'calcite sources');
  if (solidSources.length>1) throw Error('Schema v1 permits only one global wall-carbonate source');
  for (const source of solidSources) {
    exact(source,['id','owner','phase','amount'],'calcite source'); addId(source.id);
    if (source.owner!=='wall-carbonate') throw Error('Grown-crystal or other reservoirs are outside the wall-carbonate contract');
    if (source.phase!=='calcite') throw Error('Only explicitly declared CaCO3 calcite is supported');
    const mol=quantity(source.amount,'mol_CaCO3','calcite stock');
    calcites.set(source.id,{source,mol,allocations:[]});
  }
  const dims=input.dimensions, count=dims.rings*dims.cellsPerRing*dims.depths;
  if (!Array.isArray(input.cells) || input.cells.length!==count) throw Error('Every canonical cell must be covered exactly once');
  const cells=dense(input.cells,'cells').map((row,index)=>{
    exact(row,['address','waterSourceId','water','calciteSourceId','calcite','temperature','pressure','pHModel'],'cell');
    const expected=[Math.floor(index/(dims.cellsPerRing*dims.depths)),
      Math.floor(index/dims.depths)%dims.cellsPerRing,index%dims.depths];
    if (!Array.isArray(row.address) || row.address.length!==3
        || expected.some((v,i)=>row.address[i]!==v)) throw Error('Cell address/order mismatch');
    const source=waters.get(row.waterSourceId);
    if (!source) throw Error('Missing named water source');
    const kg=quantity(row.water,'kg_solvent_water','cell water');
    source.allocations.push(kg);
    const temperature=quantity(row.temperature,'deg_C','temperature',true);
    const pressure=quantity(row.pressure,'kbar','pressure');
    if (temperature<=-273.15 || pressure<=0) throw Error('Invalid thermodynamic coordinates');
    if (!['unresolved','existing-reduced-carbonate-v1'].includes(row.pHModel)) throw Error('Unsupported diagnostic pH model');
    const inventory={schema:'vugg-local-cell-inventory-v1',waterKg:kg,
      ...Object.fromEntries(COMPONENTS.map(k=>[k,product(source.molality[k],kg)])),
      temperatureC:temperature,fluidPressureKbar:pressure,pHModel:row.pHModel};
    const mol=quantity(row.calcite,'mol_CaCO3','local calcite allotment');
    let buffer=null;
    if (row.calciteSourceId===null) {
      if (mol!==0) throw Error('Unnamed calcite stock cannot supply material');
    } else {
      const stock=calcites.get(row.calciteSourceId);
      if (!stock) throw Error('Missing named calcite source');
      stock.allocations.push(mol);
      buffer={sourceId:row.calciteSourceId,ownerKind:'wall-carbonate',allotmentId:row.calciteSourceId+'@'+addressKey(expected),
        ownerAddress:expected,molCaCO3:mol,phase:'calcite',
        sourceProvenance:{...stock.source.amount.provenance},allocationProvenance:{...row.calcite.provenance}};
    }
    return {address:expected,waterSourceId:row.waterSourceId,inventory,buffer};
  });
  const waterClosure=Object.fromEntries([...waters].map(([id,s])=>[id,closure(s.kg,sum(s.allocations),'water '+id)]));
  const calciteClosure=Object.fromEntries([...calcites].map(([id,s])=>[id,closure(s.mol,sum(s.allocations),'calcite '+id)]));
  const components=Object.fromEntries(COMPONENTS.map(k=>{
    const sourceAmounts=[...waters.values()].map(s=>product(s.kg,s.molality[k]));
    const cellAmounts=cells.map(c=>c.inventory[k]);
    return [k,closure(sum(sourceAmounts),sum(cellAmounts),k,
      sum([...sourceAmounts,...cellAmounts].map(Math.abs)))];
  }));
  const declaration=JSON.parse(canonicalJSON(input));
  return freeze({schema:'vugg-finite-reservoir-compilation-v1',declaration,
    declarationSha256:sha(declaration),cells,
    totals:{waterKg:sum(cells.map(c=>c.inventory.waterKg)),
      calciteMol:sum(cells.map(c=>c.buffer?.molCaCO3||0)),
      ...Object.fromEntries(COMPONENTS.map(k=>[k,sum(cells.map(c=>c.inventory[k]))]))},
    closure:{waterSources:waterClosure,calciteSources:calciteClosure,components},
    authority:'explicit initial declarations; provenance assertions are not independent scientific certification',
    productionAllowed:false,reactions:false,transport:false,
    physicalMapping:'legacy wall/crystal/geometry and actual cavity-water mapping not commissioned'});
}

function foundationRows(compiled) {
  return compiled.cells.map(c=>({address:c.address,inventory:c.inventory}));
}
function verifyCheckpoint(h,input) {
  exact(input,['schema','declaration','foundation'],'finite reservoir checkpoint');
  if (input.schema!==CHECKPOINT_SCHEMA) throw Error('Unsupported finite reservoir checkpoint');
  const compiled=compileFiniteReservoirDeclaration(input.declaration);
  const foundation=h.validateLocalStateFoundationSnapshot(input.foundation);
  if (foundation.provenance.reference!==REFERENCE_PREFIX+compiled.declarationSha256
      || canonicalJSON(foundation.dimensions)!==canonicalJSON(compiled.declaration.dimensions)
      || canonicalJSON(foundation.cells)!==canonicalJSON(foundationRows(compiled))) {
    throw Error('Checkpoint source/allocation/initial inventory binding mismatch');
  }
  return {compiled,foundation};
}

// Bridge only to PR36's non-ticking, initial-state authority. No data is written
// into legacy ppm fluids, wall ledgers, crystal ledgers, or display geometry.
export function createFiniteReservoirCheckpoint(h,sim,declaration) {
  const compiled=compileFiniteReservoirDeclaration(declaration);
  const foundation=h.createLocalStateFoundationSnapshot(sim,foundationRows(compiled),
    REFERENCE_PREFIX+compiled.declarationSha256);
  const checkpoint={schema:CHECKPOINT_SCHEMA,declaration:compiled.declaration,foundation};
  verifyCheckpoint(h,checkpoint);
  return freeze(checkpoint);
}

export function restoreFiniteReservoirCheckpoint(h,sim,text) {
  if (typeof text!=='string') throw Error('A complete serialized finite reservoir checkpoint is required');
  const input=JSON.parse(text),{compiled,foundation}=verifyCheckpoint(h,input);
  h.installLocalStateFoundation(sim,foundation);
  return freeze({checkpoint:{schema:CHECKPOINT_SCHEMA,declaration:compiled.declaration,foundation},compiled});
}
