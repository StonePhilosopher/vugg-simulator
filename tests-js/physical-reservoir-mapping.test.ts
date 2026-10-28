import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {mapPhysicalControl,iapwsReferenceDensity,serializePhysicalRecord,restorePhysicalRecord,
  compareLegacyWallReference} from '../pilots/physical-reservoir-mapping/mapping.mjs';
import {buildPhysicalMappingReceipt} from '../pilots/physical-reservoir-mapping/receipt.mjs';
import {inspectLegacyWallReference} from '../pilots/finite-reservoir-authority/audit.mjs';
const h=globalThis as any;
const read=(file:string)=>JSON.parse(fs.readFileSync('pilots/physical-reservoir-mapping/'+file,'utf8'));
const control=()=>read('control.json');
const copy=(x:any)=>JSON.parse(JSON.stringify(x));
const relative=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(64*Number.EPSILON*Math.abs(b));
function refined(){const x=control();x.partition={rings:8,cellsPerRing:16,radialEdgesMm:[10,7.5,5,2.5,0]};return x;}
function legacy(record:any){
  const wall=new h.VugWall({composition:'limestone',vug_diameter_mm:2*record.inputs.cavityRadius.value,
    thickness_mm:record.inputs.wallThickness.value});
  return {...inspectLegacyWallReference(wall),nominalCavityRadiusMm:wall.vug_diameter_mm/2,remainingThicknessMm:wall.thickness_mm};
}

describe('physical reservoir control: literature properties and analytical geometry',()=>{
  it.each(read('source-evidence.json').water.verification)('reproduces the published IAPWS verification density at %s K',(t:number,rho:number)=>{
    expect(Math.abs(iapwsReferenceDensity(t)-rho)).toBeLessThanOrEqual(5e-7);
  });
  it.each([NaN,Infinity,'299.15',null,253.14,383.16])('refuses an invalid/out-of-range density request: %s',t=>{
    expect(()=>iapwsReferenceDensity(t)).toThrow('correlation range');
  });
  it('matches an independently executed 60-digit global-volume and density witness',()=>{
    const x=mapPhysicalControl(control()),w=read('reference.json');
    relative(x.densityKgM3,Number(w.densityKgM3));
    relative(x.closure.waterVolumeMm3.actual,Number(w.waterVolumeMm3));
    relative(x.closure.wallVolumeMm3.actual,Number(w.wallVolumeMm3));
    relative(x.compiled.totals.waterKg,Number(w.waterKg));
    relative(x.compiled.totals.calciteMol,Number(w.calciteMol));
    expect(x.compiled.totals.waterKg).not.toBe(1);
    expect(x.compiled.cells.every((c:any)=>c.inventory.pHModel==='unresolved')).toBe(true);
    expect(x.compiled.totals.calciumMol).toBe(0); // Solid calcite has not dissolved.
    expect(x.compiled.totals.dicMolC).toBe(0);
  });
  it('weights polar and radial sectors by physical volume and allocates one wall parent only at d=0',()=>{
    const x=mapPhysicalControl(control()),at=(r:number,c:number,d:number)=>x.cells.find((p:any)=>p.address.join(',')===[r,c,d].join(','));
    relative(at(0,0,0).waterKg/at(0,0,1).waterKg,7);
    expect(at(1,0,0).waterKg).toBeGreaterThan(at(0,0,0).waterKg);
    expect(x.compiled.declaration.calciteSources).toHaveLength(1);
    expect(x.compiled.cells.filter((p:any)=>p.buffer)).toHaveLength(32);
    expect(x.cells.filter((p:any)=>p.address[2]!==0).every((p:any)=>p.calciteMol===0)).toBe(true);
    expect(new Set(x.compiled.cells.filter((p:any)=>p.buffer).map((p:any)=>p.buffer.sourceId))).toEqual(new Set(['control-wall']));
    expect(x.compiled.cells[0].buffer.molCaCO3).toBeLessThan(x.compiled.totals.calciteMol);
  });
  it('preserves every parent cell inventory when angular and radial cells are subdivided',()=>{
    const parent=mapPhysicalControl(control()),child=mapPhysicalControl(refined());
    for(const cell of parent.cells){
      const [r,c,d]=cell.address;
      const children=child.cells.filter((p:any)=>Math.floor(p.address[0]/2)===r
        &&Math.floor(p.address[1]/2)===c&&Math.floor(p.address[2]/2)===d);
      expect(children).toHaveLength(8);
      relative(children.reduce((s:number,p:any)=>s+p.waterKg,0),cell.waterKg);
      relative(children.reduce((s:number,p:any)=>s+p.calciteMol,0),cell.calciteMol);
    }
    relative(child.compiled.totals.waterKg,parent.compiled.totals.waterKg);
    relative(child.compiled.totals.calciteMol,parent.compiled.totals.calciteMol);
  });
  it('accepts explicit nonuniform radial boundaries without inventing equal-volume cells',()=>{
    const input=control();input.partition.radialEdgesMm=[10,9.9,1,0];
    const x=mapPhysicalControl(input),base=mapPhysicalControl(control());
    relative(x.compiled.totals.waterKg,base.compiled.totals.waterKg);
    relative(x.compiled.totals.calciteMol,base.compiled.totals.calciteMol);
    expect(x.cells[0].waterVolumeMm3).toBeLessThan(x.cells[1].waterVolumeMm3);
  });
  it('changes wall stock through shell geometry while leaving cavity water unchanged',()=>{
    const a=mapPhysicalControl(control()),input=control();input.wallThickness.value=2;
    const b=mapPhysicalControl(input);
    expect(b.compiled.totals.waterKg).toBe(a.compiled.totals.waterKg);
    relative(b.compiled.totals.calciteMol/a.compiled.totals.calciteMol,728/331);
    expect(b.compiled.totals.calciteMol).not.toBe(2*a.compiled.totals.calciteMol);
  });
  it('scales both inventories cubically when all physical lengths double',()=>{
    const a=mapPhysicalControl(control()),input=control();input.cavityRadius.value*=2;
    input.wallThickness.value*=2;input.partition.radialEdgesMm=input.partition.radialEdgesMm.map((v:number)=>2*v);
    const b=mapPhysicalControl(input);
    relative(b.compiled.totals.waterKg,8*a.compiled.totals.waterKg);
    relative(b.compiled.totals.calciteMol,8*a.compiled.totals.calciteMol);
  });
  it('keeps source uncertainty separate from numerical closure and retains the existing calcite reference',()=>{
    const x=mapPhysicalControl(control());
    expect(x.molarVolumeCm3Mol).toBe(h.cavityMolarVolume('calcite',26,0.001).value_cm3_mol);
    expect(x.uncertainty.waterKgFromDensityK2).toBe(x.compiled.totals.waterKg*1e-6);
    expect(x.uncertainty.calciteMolAtVmPlusReportedError).toBeLessThan(x.compiled.totals.calciteMol);
    expect(x.uncertainty.calciteMolAtVmMinusReportedError).toBeGreaterThan(x.compiled.totals.calciteMol);
    expect(x.closure.waterVolumeMm3.tolerance).toBeLessThan(1e-8);
    expect(x.uncertainty.calciteIntervalMeaning).toContain('not a guaranteed bound');
  });
});

describe('bounded authority and causal checkpoint',()=>{
  it.each([['water','brine'],['water','partly-flooded'],['wall','porous-limestone'],
    ['wall','grown-calcite'],['geometry','rendered-mesh']])('rejects unsupported %s=%s',(field,value)=>{
    const x=control();x[field]=value;expect(()=>mapPhysicalControl(x)).toThrow('Only the explicit');
  });
  it.each([[25,1],[26,1.01325],[26,0.1]])('refuses unsupported T/P: %s C, %s bar',(t,p)=>{
    const x=control();x.temperature.value=t;x.pressure.value=p;
    expect(()=>mapPhysicalControl(x)).toThrow('no P-T extrapolation');
  });
  it('requires complete units/provenance and accepts no legacy or display parameter shortcut',()=>{
    for(const corrupt of [(x:any)=>{delete x.pressure;},(x:any)=>{x.cavityRadius.unit='cm';},
      (x:any)=>{delete x.wallThickness.provenance;},(x:any)=>{x.pH=7;},
      (x:any)=>{x.renderQuality='high';},(x:any)=>{x.provenance.kind='legacy-ppm-conversion';}]){
      const x=control();corrupt(x);expect(()=>mapPhysicalControl(x)).toThrow();
    }
  });
  it('rejects incomplete, sparse, inverted or excessive partitions instead of repairing them',()=>{
    for(const bad of [[],[10,5,1],[9,5,0],[10,5,5,0],[10,NaN,0],[10,,0]]){
      const x=control();x.partition.radialEdgesMm=bad;expect(()=>mapPhysicalControl(x)).toThrow();
    }
    for(const n of [0,-1,1.5,Infinity,100000]){
      const x=control();x.partition.rings=n;expect(()=>mapPhysicalControl(x)).toThrow();
    }
  });
  it('refuses nonrepresentable dimensions without clipping physical stock',()=>{
    for(const n of [0,-1,NaN,Infinity,Number.MIN_VALUE]){
      const x=control();x.wallThickness.value=n;expect(()=>mapPhysicalControl(x)).toThrow();
    }
    const x=control();x.cavityRadius.value=1e200;x.partition.radialEdgesMm=[1e200,0];x.wallThickness.value=1e200;
    expect(()=>mapPhysicalControl(x)).toThrow('Unrepresentable');
    const tiny=control();tiny.cavityRadius.value=1e-106;tiny.wallThickness.value=1e-106;
    tiny.partition.radialEdgesMm=[1e-106,5e-107,0];
    expect(()=>mapPhysicalControl(tiny)).toThrow('Unrepresentable');
  });
  it('round-trips geometry, all quantities, source ownership and unchanged model identity from causal inputs',()=>{
    const a=mapPhysicalControl(control()),saved=serializePhysicalRecord(a),b=restorePhysicalRecord(saved);
    expect(b).toEqual(a);expect(b.recordDigest).toBe(a.recordDigest);
    expect(b.compiled.declaration.calciteSources[0].owner).toBe('wall-carbonate');
    expect(b.compiled.cells[0].buffer.allotmentId).toBe('control-wall@0,0,0');
    expect(b.productionAllowed).toBe(false);expect(b.legacyPhysicalMapping).toBe(false);
    expect(b.reactions).toBe(false);expect(b.transport).toBe(false);
  });
  it('rejects changed physical inputs or derived data instead of silently adopting a new reservoir',()=>{
    const a=mapPhysicalControl(control()),saved=JSON.parse(serializePhysicalRecord(a));
    saved.inputs.wallThickness.value=2;
    expect(()=>restorePhysicalRecord(JSON.stringify(saved))).toThrow('binding mismatch');
    const forged=copy(a);forged.compiled.cells[0].buffer.molCaCO3+=0.01;
    expect(()=>serializePhysicalRecord(forged)).toThrow('causal inputs');
    expect(()=>restorePhysicalRecord(JSON.stringify(a.compiled))).toThrow('complete explicit fields');
  });
  it('retains independent caller inputs and distinguishes new provenance from the same numerical specimen',()=>{
    const input=control(),a=mapPhysicalControl(input);input.provenance.reference='a separately authored control';
    const b=mapPhysicalControl(input);
    expect(b.compiled.totals).toEqual(a.compiled.totals);expect(b.mappingId).not.toBe(a.mappingId);
    expect(a.inputs.provenance.reference).not.toBe(input.provenance.reference);
    expect(()=>{a.compiled.cells[0].inventory.waterKg=1;}).toThrow();
  });
});

describe('legacy reference discrepancy remains a separate scientific hold',()=>{
  it('measures the mismatch without changing the wall or declaring reference kg to be physical water kg',()=>{
    const record=mapPhysicalControl(control()),ref=legacy(record),before=copy(ref);
    const x=compareLegacyWallReference(record,ref);
    expect(x.physicalToHypotheticalStockRatio).toBeGreaterThan(24000);
    expect(x.physicalToHypotheticalStockRatio).toBeLessThan(24030);
    expect(x.impliedReferenceKgToRepresentShell).not.toBe(x.physicalWaterKg);
    expect(x.productionMappingAllowed).toBe(false);expect(x.referenceRescaled).toBe(false);
    expect(ref).toEqual(before);
  });
  it('refuses dolomite, relabeled physical units and mismatched nominal dimensions',()=>{
    const record=mapPhysicalControl(control()),ref=legacy(record);
    for(const delta of [{modeledFormula:'CaMg(CO3)2'},{units:'mol_physical'},
      {nominalCavityRadiusMm:50},{remainingThicknessMm:500},{physicalWaterKg:1},{remaining:Number.MIN_VALUE}]){
      expect(()=>compareLegacyWallReference(record,{...ref,...delta})).toThrow();
    }
  });
  it('reproduces commissioned property, partition, source and unchanged-production evidence',()=>{
    const result=buildPhysicalMappingReceipt(h);
    expect(result).toEqual(read('receipt.json'));
    expect(result.productionAllowed).toBe(false);expect(result.legacyPhysicalMapping).toBe(false);
    expect(result.registeredProducerContractsUnchanged).toBe(true);
    expect(result.partitions.map((p:any)=>p.cells)).toEqual([1,64,512]);
    expect(result.legacyInspectionDidNotMutate).toBe(true);
  });
});
