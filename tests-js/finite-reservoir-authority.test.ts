import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {DECLARATION_SCHEMA,MOLAL_UNITS,canonicalJSON,compileFiniteReservoirDeclaration,
  createFiniteReservoirCheckpoint,restoreFiniteReservoirCheckpoint} from '../pilots/finite-reservoir-authority/contract.mjs';
import {buildSourceAudit,buildWallReferenceCensus,inspectLegacyWallReference} from '../pilots/finite-reservoir-authority/audit.mjs';
const h=globalThis as any;
const copy=(x:any)=>JSON.parse(JSON.stringify(x));
const q=(value:number,unit:string,reference:string)=>({value,unit,provenance:{kind:'authored-experiment',reference}});
function declaration(){
  const amounts:any={dicMolC:0.001,calciumMol:0.001,ironMol:0.0001,
    sulfateMol:0.0002,oxygenMol:0.0003,alkalinityEq:-0.0002};
  return {schema:DECLARATION_SCHEMA,dimensions:{rings:1,cellsPerRing:2,depths:1},
    waterSources:[{id:'water-A',water:q(1,'kg_solvent_water','fixture:one finite kg of solution water'),
      molality:Object.fromEntries(Object.entries(MOLAL_UNITS).map(([k,u])=>[k,q(amounts[k],u as string,'fixture:analytical total '+k)]))}],
    calciteSources:[{id:'wall-control',owner:'wall-carbonate',phase:'calcite',amount:q(0.005,'mol_CaCO3','fixture:independently declared calcite; NOT a production wall estimate')}],
    cells:[0,1].map(i=>({address:[0,i,0],waterSourceId:'water-A',
      water:q(i?0.75:0.25,'kg_solvent_water','fixture:explicit water allocation '+i),
      calciteSourceId:'wall-control',calcite:q(i?0.004:0.001,'mol_CaCO3','fixture:explicit solid allotment '+i),
      temperature:q(25,'deg_C','fixture:initial temperature'),pressure:q(0.00101325,'kbar','fixture:initial pressure'),
      pHModel:'unresolved'}))};
}
function smallSim(){
  h.setSeed(42);
  const grid=new h.CavityVoxelGrid({ring_count:1,cells_per_ring:2,depth_count:1});
  grid.voxels=[0,1].map(i=>({ringIdx:0,cellIdx:i,depthIdx:0,fluid:new h.FluidChemistry(),temperature:25}));
  h._bindCavityVoxelGridMeshInternal(grid,null);
  return {step:0,crystals:[],conditions:{fluid:new h.FluidChemistry(),temperature:25,pressure:0.00101325},
    wall_state:{voxelGridFor:()=>grid}};
}

describe('explicit finite reservoir initialization, with reactions and transport off',()=>{
  it('allocates unequal water masses at the same molality without duplicating the source',()=>{
    const input=declaration(),before=copy(input),result=compileFiniteReservoirDeclaration(input);
    expect(result.totals.waterKg).toBe(1);
    expect(result.cells[0].inventory.calciumMol).toBe(0.00025);
    expect(result.cells[1].inventory.calciumMol).toBe(0.00075);
    expect(result.totals.calciumMol).toBe(0.001);
    expect(result.totals.sulfateMol).toBe(0.0002);
    expect(result.totals.oxygenMol).toBe(0.0003);
    expect(result.totals.alkalinityEq).toBe(-0.0002);
    expect(result.cells[0].waterSourceId).toBe('water-A');
    expect(result.declaration.waterSources[0].molality.calciumMol.provenance.reference).toContain('analytical total calciumMol');
    expect(input).toEqual(before);
    expect(result.productionAllowed).toBe(false);expect(result.reactions).toBe(false);expect(result.transport).toBe(false);
  });
  it('keeps finite mineral moles independent of changes in water mass',()=>{
    const a=declaration(),b=copy(a);b.waterSources[0].water.value*=2;
    b.cells.forEach((c:any)=>c.water.value*=2);
    const x=compileFiniteReservoirDeclaration(a),y=compileFiniteReservoirDeclaration(b);
    expect(y.totals.calciumMol).toBe(2*x.totals.calciumMol);
    expect(y.totals.waterKg).toBe(2*x.totals.waterKg);
    expect(y.totals.calciteMol).toBe(x.totals.calciteMol);
    expect(y.cells.map((c:any)=>c.buffer.molCaCO3)).toEqual(x.cells.map((c:any)=>c.buffer.molCaCO3));
  });
  it('names the local allotment and its single global parent instead of copying the full wall stock',()=>{
    const result=compileFiniteReservoirDeclaration(declaration());
    expect(result.cells.map((c:any)=>c.buffer.allotmentId)).toEqual(['wall-control@0,0,0','wall-control@0,1,0']);
    expect(result.totals.calciteMol).toBe(0.005);
    const invalid=declaration();invalid.cells.forEach(c=>c.calcite.value=0.005);
    expect(()=>compileFiniteReservoirDeclaration(invalid)).toThrow('calcite wall-control: allocation does not close');
  });
  it('refuses a second global wall stock even when the domain-wide amount matches',()=>{
    const d=declaration();d.calciteSources[0].amount.value=0.002;
    d.calciteSources.push({id:'second-stock',owner:'wall-carbonate',phase:'calcite',amount:q(0.003,'mol_CaCO3','fixture:distinct second parent')});
    d.cells[1].calciteSourceId='second-stock';
    // The total is 0.005 mol, but v1 has only one global wall-stock owner.
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('one global wall-carbonate source');
  });
  it('reports floating-point roundoff without rescaling the declared cell water',()=>{
    const d=declaration();d.waterSources[0].water.value=0.3;
    d.cells[0].water.value=0.1;d.cells[1].water.value=0.2;
    const result=compileFiniteReservoirDeclaration(d),c=result.closure.waterSources['water-A'];
    expect(result.cells.map((x:any)=>x.inventory.waterKg)).toEqual([0.1,0.2]);
    expect(c.expected).toBe(0.3);expect(c.allocated).toBe(0.1+0.2);
    expect(c.residual).not.toBe(0);expect(Math.abs(c.residual)).toBeLessThan(c.tolerance);
  });
  it.each([0.5,2])('rejects incomplete or overdrafted source water: %s kg',kg=>{
    const d=declaration();d.waterSources[0].water.value=kg;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('water water-A: allocation does not close');
  });
  it('rejects duplicate identities, cross-type aliases and unowned calcite',()=>{
    const d=declaration();d.calciteSources[0].id='water-A';
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('Duplicate source');
    const e=declaration();e.cells[0].calciteSourceId=null as any;
    expect(()=>compileFiniteReservoirDeclaration(e)).toThrow('Unnamed calcite stock');
    const f=declaration();f.cells[0].waterSourceId='missing';
    expect(()=>compileFiniteReservoirDeclaration(f)).toThrow('Missing named water');
  });
  it('requires real alkalinity and component inputs; pH and missing fields cannot supply them',()=>{
    const d:any=declaration();delete d.waterSources[0].molality.alkalinityEq;
    d.waterSources[0].molality.pH=7;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('complete explicit fields');
    const e:any=declaration();delete e.waterSources[0].molality.ironMol;
    expect(()=>compileFiniteReservoirDeclaration(e)).toThrow('complete explicit fields');
    const f:any=declaration();delete f.waterSources[0].molality.calciumMol.provenance;
    expect(()=>compileFiniteReservoirDeclaration(f)).toThrow('complete explicit fields');
  });
  it.each(['mg_per_L','ppm','mol_O_atoms_per_kg_water','mol_SO4_per_kg_solution'])('refuses ambiguous or wrong component units: %s',unit=>{
    const d=declaration();d.waterSources[0].molality.oxygenMol.unit=unit;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('invalid amount or units');
  });
  it.each(['legacy-wall-reference','booked-crystal-volume','rendered-mesh','density-default'])('cannot promote %s into an absolute source by relabeling it',kind=>{
    const d=declaration();d.calciteSources[0].amount.provenance.kind=kind;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('no commissioned legacy/geometry mapping');
  });
  it('does not treat dolomite or HMC as pure calcite',()=>{
    for(const phase of ['dolomite','HMC']){const d=declaration();d.calciteSources[0].phase=phase;
      expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('CaCO3 calcite');}
  });
  it('keeps grown-crystal stock outside the first wall-carbonate contract',()=>{
    const d=declaration();d.calciteSources[0].owner='grown-crystal';
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('outside the wall-carbonate contract');
  });
  it('rejects missing and sparse sources, cells and addresses',()=>{
    for(const corrupt of [(d:any)=>{delete d.waterSources[0];},(d:any)=>{delete d.cells[1];},
      (d:any)=>{d.cells[0].address=new Array(3);},(d:any)=>{d.cells.pop();},
      (d:any)=>{d.cells[1].address=d.cells[0].address;}]){
      const d=declaration();corrupt(d);expect(()=>compileFiniteReservoirDeclaration(d)).toThrow();
    }
  });
  it('refuses nonfinite, negative, overflowed and underflowed stocks rather than clipping them',()=>{
    for(const value of [NaN,Infinity,-1,'1',null]){
      const d:any=declaration();d.waterSources[0].water.value=value;
      expect(()=>compileFiniteReservoirDeclaration(d)).toThrow();
    }
    const d=declaration();d.waterSources[0].molality.calciumMol.value=Number.MAX_VALUE;
    d.cells[0].water.value=Number.MAX_VALUE;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('Unrepresentable');
    const e=declaration();e.cells[0].water.value=1e-300;e.waterSources[0].molality.calciumMol.value=1e-300;
    expect(()=>compileFiniteReservoirDeclaration(e)).toThrow('Unrepresentable');
  });
  it('does not use an absolute tolerance to excuse exhausting a very small source',()=>{
    const d=declaration();d.calciteSources[0].amount.value=1e-30;
    d.cells[0].calcite.value=1e-20;d.cells[1].calcite.value=0;
    expect(()=>compileFiniteReservoirDeclaration(d)).toThrow('allocation does not close');
  });
  it('supports an explicitly dry cell and explicitly absent calcite, without guessing missing stocks',()=>{
    const d=declaration();d.cells[0].water.value=0;d.cells[1].water.value=1;
    d.cells[0].calciteSourceId=null as any;d.cells[0].calcite.value=0;d.cells[1].calcite.value=0.005;
    const result=compileFiniteReservoirDeclaration(d);
    expect(result.cells[0].buffer).toBeNull();
    expect(result.cells[0].inventory.waterKg).toBe(0);
    expect(result.cells[0].inventory.calciumMol).toBe(0);
    expect(result.cells[0].inventory.alkalinityEq).toBe(0);
    expect(h.validateLocalCellInventory(result.cells[0].inventory)).toEqual(result.cells[0].inventory);
    const dry=declaration();dry.waterSources[0].water.value=0;dry.cells.forEach(c=>c.water.value=0);
    expect(()=>compileFiniteReservoirDeclaration(dry)).toThrow('Dry source has nonzero composition');
  });
  it('freezes source facts and gives object-key order no scientific significance',()=>{
    const d=declaration(),result=compileFiniteReservoirDeclaration(d);
    const reverse=(v:any):any=>Array.isArray(v)?v.map(reverse):v&&typeof v==='object'
      ?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverse(x)])):v;
    expect(compileFiniteReservoirDeclaration(reverse(d)).declarationSha256).toBe(result.declarationSha256);
    expect(()=>{result.cells[0].buffer.molCaCO3=10;}).toThrow();
    expect(()=>{result.declaration.waterSources[0].water.value=10;}).toThrow();
    expect(Object.isFrozen(d.calciteSources[0].amount.provenance)).toBe(false);
    d.calciteSources[0].amount.provenance.reference='caller edit';
    expect(result.cells[0].buffer.sourceProvenance.reference).not.toBe('caller edit');
  });
});

describe('initial checkpoint provenance and existing foundation boundary',()=>{
  it('retains the full declaration through a fresh real-simulator initial checkpoint',()=>{
    const oldGet=document.getElementById.bind(document);
    document.getElementById=((id:string)=>id.startsWith('broth-')?null:oldGet(id)) as any;
    try{
      localStorage.clear();h.setFortressInstantLines(true);
      h.fortressBeginFromScenario('tutorial_first_crystal',42);
      const source=h._liveFortressSim(),grid=source.wall_state.voxelGridFor(source),d:any=declaration();
      const template=d.cells[0];d.dimensions={rings:grid.ring_count,cellsPerRing:grid.cells_per_ring,depths:grid.depth_count};
      d.cells=grid.voxels.map((v:any,i:number)=>({...template,address:[v.ringIdx,v.cellIdx,v.depthIdx],
        water:q(1/grid.voxels.length,'kg_solvent_water','authored compatibility fixture: finite 1 kg divided across declared cells'),
        calciteSourceId:i===0?'wall-control':null,
        calcite:q(i===0?0.005:0,'mol_CaCO3','authored compatibility fixture; not a production wall conversion'),
        temperature:q(source.conditions.temperature,'deg_C','initial model conditions.temperature'),
        pressure:q(source.conditions.pressure,'kbar','initial model conditions.pressure')}));
      const before=h.simulationStateFingerprint(source),c=createFiniteReservoirCheckpoint(h,source,d);
      expect(h.simulationStateFingerprint(source)).toBe(before);
      const first=restoreFiniteReservoirCheckpoint(h,source,JSON.stringify(c)),fp=h.simulationStateFingerprint(source);
      h.fortressReset();h.fortressBeginFromScenario('tutorial_first_crystal',42);
      const target=h._liveFortressSim(),second=restoreFiniteReservoirCheckpoint(h,target,JSON.stringify(first.checkpoint));
      expect(canonicalJSON(second)).toBe(canonicalJSON(first));
      expect(h.simulationStateFingerprint(target)).toBe(fp);
      expect(target.step).toBe(0);expect(target.crystals).toHaveLength(0);
      expect(()=>target.run_step()).toThrow('inventory-only');
      expect(()=>h._savePersistActive()).toThrow('Legacy recipe save cannot preserve');
    }finally{document.getElementById=oldGet;h.fortressReset();localStorage.clear();}
  });
  it('replays every source, water stock, component and calcite owner without growth or current-fluid inference',()=>{
    const source=smallSim(),before=h.simulationStateFingerprint(source),checkpoint=createFiniteReservoirCheckpoint(h,source,declaration());
    expect(h.simulationStateFingerprint(source)).toBe(before);
    const a=restoreFiniteReservoirCheckpoint(h,source,JSON.stringify(checkpoint));
    const fp=h.simulationStateFingerprint(source),target=smallSim();
    const b=restoreFiniteReservoirCheckpoint(h,target,JSON.stringify(a.checkpoint));
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
    expect(h.simulationStateFingerprint(target)).toBe(fp);
    expect(()=>h.VugSimulator.prototype.run_step.call(target)).toThrow('inventory-only');
    expect(()=>target.wall_state.voxelGridFor(target).diffuse(0.1,['pH'])).toThrow('transport');
  });
  it('binds calcite source quantities into the state identity even when aqueous amounts stay equal',()=>{
    const a=smallSim(),d=declaration(),c=createFiniteReservoirCheckpoint(h,a,d);
    restoreFiniteReservoirCheckpoint(h,a,JSON.stringify(c));const fp=h.simulationStateFingerprint(a);
    const b=smallSim(),e=declaration();e.calciteSources[0].amount.value*=2;e.cells.forEach(x=>x.calcite.value*=2);
    const next=createFiniteReservoirCheckpoint(h,b,e);restoreFiniteReservoirCheckpoint(h,b,JSON.stringify(next));
    expect(next.foundation.cells).toEqual(c.foundation.cells);
    expect(h.simulationStateFingerprint(b)).not.toBe(fp);
  });
  it('rejects changed provenance/stock and changed projected amounts before installation',()=>{
    for(const corrupt of [(c:any)=>{c.declaration.calciteSources[0].amount.value*=2;
      c.declaration.cells.forEach((x:any)=>x.calcite.value*=2);},
      (c:any)=>{c.foundation.cells[0].inventory.calciumMol+=0.01;}]){
      const sim=smallSim(),c=copy(createFiniteReservoirCheckpoint(h,sim,declaration()));corrupt(c);
      expect(()=>restoreFiniteReservoirCheckpoint(h,sim,JSON.stringify(c))).toThrow('binding mismatch');
      expect(h.localStateFoundationFor(sim)).toBeNull();
    }
  });
  it('refuses legacy foundation-only documents and wrong initializations instead of inventing a stock origin',()=>{
    const sim=smallSim(),c=createFiniteReservoirCheckpoint(h,sim,declaration());
    expect(()=>restoreFiniteReservoirCheckpoint(h,sim,JSON.stringify(c.foundation))).toThrow('complete explicit fields');
    sim.conditions.fluid.pH=2;
    expect(()=>restoreFiniteReservoirCheckpoint(h,sim,JSON.stringify(c))).toThrow('binding mismatch');
    expect(h.localStateFoundationFor(sim)).toBeNull();
  });
});

describe('raw authored-fleet authority census',()=>{
  it('reproduces its source-bound receipt and discloses missing physical water/stock mapping across all 41 scenarios',()=>{
    const actual=buildSourceAudit();
    expect(actual).toEqual(JSON.parse(fs.readFileSync('pilots/finite-reservoir-authority/source-audit.json','utf8')));
    expect(actual.summary.authoredScenarios).toBe(41);
    expect(actual.summary.scenariosWithFiniteWaterDeclarations).toBe(0);
    expect(actual.productionRuntimeUnchanged).toBe(true);
    expect(actual.registeredProducerContractsUnchanged).toBe(true);
    expect(actual.candidates.wall.owner).toBe('one conditions.wall host ledger');
    expect(actual.candidates.wall.eligible).toBe(false);
    expect(actual.candidates.surface.eligible).toBe(false);
  });
  it('reproduces actual wall-constructor reference stocks for every authored scenario without growing or mutating them',()=>{
    const actual=buildWallReferenceCensus(h);
    expect(actual).toEqual(JSON.parse(fs.readFileSync('pilots/finite-reservoir-authority/wall-reference-census.json','utf8')));
    expect(actual.scenarioCount).toBe(41);
    expect(actual.scenarios.every((r:any)=>r.observationDidNotMutate&&!r.reference.productionBufferEligible)).toBe(true);
  });
  it('distinguishes limestone and dolomite reference extents from physical calcite moles',()=>{
    const proxy={composition:'limestone',thickness_mm:2,host_formula_inventory_initial_mmolkg:2*(15/40.078),
      host_formula_released_mmolkg:0};
    const a=inspectLegacyWallReference(proxy),b=inspectLegacyWallReference({...proxy,composition:'dolomite'});
    expect(a.modeledFormula).toBe('CaCO3');expect(b.modeledFormula).toBe('CaMg(CO3)2');
    expect(a.remaining).toBe(b.remaining);
    expect(a.physicalCalciteMol).toBeNull();expect(a.physicalWaterKg).toBeNull();
    expect(a.productionBufferEligible).toBe(false);
    expect(a.units).toBe('mmol_formula_per_kg_solvent_reference');
    expect(()=>inspectLegacyWallReference({...proxy,host_formula_released_mmolkg:1})).toThrow('invalid wall');
    expect(()=>inspectLegacyWallReference({...proxy,thickness_mm:1})).toThrow('closure failed');
  });
});
