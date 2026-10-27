import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const h=globalThis as any;
const inventory=(changes:any={})=>({schema:'vugg-local-cell-inventory-v1',waterKg:1,
  dicMolC:0.001,alkalinityEq:0.0008,calciumMol:0,ironMol:0,sulfateMol:0,oxygenMol:0,
  temperatureC:25,fluidPressureKbar:0.00101325,pHModel:'existing-reduced-carbonate-v1',...changes});
const clone=(x:any)=>JSON.parse(JSON.stringify(x));
function smallSim(){
  h.setSeed(42);
  const grid=new h.CavityVoxelGrid({ring_count:1,cells_per_ring:2,depth_count:2});
  grid.voxels=Array.from({length:4},(_,i)=>({ringIdx:0,cellIdx:Math.floor(i/2),depthIdx:i%2,
    fluid:new h.FluidChemistry(),temperature:25}));
  h._bindCavityVoxelGridMeshInternal(grid,null);
  return {step:0,crystals:[],conditions:{fluid:new h.FluidChemistry(),temperature:25,pressure:0.00101325},
    wall_state:{voxelGridFor:()=>grid}};
}
function rows(sim:any){
  return sim.wall_state.voxelGridFor(sim).voxels.map((v:any,i:number)=>({
    address:[v.ringIdx,v.cellIdx,v.depthIdx],inventory:inventory({waterKg:1+i/10})}));
}
function snapshot(sim:any){return h.createLocalStateFoundationSnapshot(sim,rows(sim),'explicit test component inventory');}

describe('production local-state foundation: no reactions, transport, or legacy conversion',()=>{
  it('requires independently authored extensive amounts and never accepts pH as migration authority',()=>{
    expect(h.validateLocalCellInventory(inventory())).toEqual(inventory());
    for(const key of ['waterKg','dicMolC','alkalinityEq','calciumMol','ironMol','sulfateMol','oxygenMol']){
      const partial=inventory();delete partial[key];partial.pH=7;
      expect(()=>h.validateLocalCellInventory(partial)).toThrow('explicit fields');
    }
    expect(()=>h.validateLocalCellInventory(new h.FluidChemistry({pH:7}))).toThrow('no legacy/pH inference');
    expect(()=>h.validateLocalCellInventory(inventory({schema:'future-v2'}))).toThrow('schema');
  });
  it.each([NaN,Infinity,'1',null,true])('rejects non-numeric/nonfinite inventories: %s',value=>{
    for(const key of ['waterKg','dicMolC','alkalinityEq','calciumMol','ironMol','sulfateMol','oxygenMol']){
      expect(()=>h.validateLocalCellInventory(inventory({[key]:value}))).toThrow();
    }
  });
  it('permits negative alkalinity, not negative inventories; dry cells have no dissolved stock',()=>{
    expect(h.validateLocalCellInventory(inventory({alkalinityEq:-0.001})).alkalinityEq).toBe(-0.001);
    for(const key of ['waterKg','dicMolC','calciumMol','ironMol','sulfateMol','oxygenMol']){
      expect(()=>h.validateLocalCellInventory(inventory({[key]:-1}))).toThrow('Negative');
    }
    expect(()=>h.validateLocalCellInventory(inventory({waterKg:0}))).toThrow('dry cell');
    const dry=inventory({waterKg:0,dicMolC:0,alkalinityEq:0});
    expect(h.localCellInventoryPH(dry)).toEqual({status:'unresolved',pH:null,reason:'dry-cell'});
  });
  it('derives a labeled reduced-model pH from molal inventories, preserving all amounts',()=>{
    const a=inventory(),before=clone(a),result=h.localCellInventoryPH(a);
    expect(result.status).toBe('model-estimate');
    expect(result.authority).toBe('diagnostic-only-no-production-feedback');
    expect(result.pH).toBeGreaterThan(6);expect(result.pH).toBeLessThan(8);
    expect(Math.abs(result.residualEqKg)).toBeLessThan(1e-12);
    const doubled=inventory({waterKg:2,dicMolC:0.002,alkalinityEq:0.0016});
    expect(h.localCellInventoryPH(doubled).pH).toBe(result.pH);
    expect(a).toEqual(before);
    // Equal acid-equivalent inputs have different effects on distinct carbon
    // inventories. No pH slider is accepted as a hidden alkalinity surrogate.
    const weak=inventory({dicMolC:0.0001,alkalinityEq:-0.0001});
    expect(h.localCellInventoryPH(weak).pH).toBeLessThan(5);
  });
  it.each([{ironMol:1e-5},{sulfateMol:1e-5},{pHModel:'unresolved'},
    {temperatureC:120},{fluidPressureKbar:1.5},{alkalinityEq:10}])('keeps unsupported speciation unresolved: %j',changes=>{
    const result=h.localCellInventoryPH(inventory(changes));
    expect(result.status).toBe('unresolved');expect(result.pH).toBeNull();
  });
  it('retains distinct cell inventories without changing legacy fluids or drawing RNG',()=>{
    const sim=smallSim(),grid=sim.wall_state.voxelGridFor(sim);
    const before=JSON.stringify(grid.voxels),fp=h.simulationStateFingerprint(sim);
    const record=snapshot(sim);
    expect(h.localStateFoundationFor(sim)).toBeNull();
    h.installLocalStateFoundation(sim,record);
    expect(h.localStateFoundationFor(sim).cells[0].inventory.waterKg).toBe(1);
    expect(h.localStateFoundationFor(sim).cells[3].inventory.waterKg).toBe(1.3);
    expect(JSON.stringify(grid.voxels)).toBe(before);
    expect(h.simulationStateProjection(sim).rngState).toBe(42);
    expect(h.simulationStateFingerprint(sim)).not.toBe(fp);
    expect(Object.isFrozen(record.cells[0].inventory)).toBe(true);
    expect(()=>h.installLocalStateFoundation(sim,record)).toThrow('already installed');
  });
  it('round-trips the complete versioned checkpoint only onto its exact fresh initialization',()=>{
    const sim=smallSim(),record=snapshot(sim);h.installLocalStateFoundation(sim,record);
    const text=h.serializeLocalStateFoundation(sim),fp=h.simulationStateFingerprint(sim);
    const target=smallSim();h.restoreLocalStateFoundation(target,text);
    expect(h.serializeLocalStateFoundation(target)).toBe(text);
    expect(h.simulationStateFingerprint(target)).toBe(fp);
    const wrong=smallSim();wrong.conditions.fluid.pH=2;
    expect(()=>h.restoreLocalStateFoundation(wrong,text)).toThrow('binding mismatch');
    expect(h.localStateFoundationFor(wrong)).toBeNull();
  });
  it('atomically rejects missing, reordered, duplicate, or future cell records',()=>{
    for(const corrupt of [(x:any)=>x.cells.pop(),(x:any)=>x.cells.reverse(),
      (x:any)=>{x.cells[1].address=x.cells[0].address;},(x:any)=>{delete x.cells[0].inventory.alkalinityEq;},
      (x:any)=>{x.schema='v2';},(x:any)=>{x.provenance.kind='pH-only-migration';}]){
      const sim=smallSim(),bad=clone(snapshot(sim)),fp=h.simulationStateFingerprint(sim);corrupt(bad);
      expect(()=>h.installLocalStateFoundation(sim,bad)).toThrow();
      expect(h.localStateFoundationFor(sim)).toBeNull();expect(h.simulationStateFingerprint(sim)).toBe(fp);
    }
  });
  it('rejects sparse cell arrays and sparse addresses without filling missing data',()=>{
    for(const corrupt of [(x:any)=>{delete x.cells[1];},
      (x:any)=>{x.cells[0].address=new Array(3);},
      (x:any)=>{delete x.cells[0].address[1];}]){
      const sim=smallSim(),bad=clone(snapshot(sim)),fp=h.simulationStateFingerprint(sim);corrupt(bad);
      expect(()=>h.installLocalStateFoundation(sim,bad)).toThrow();
      expect(h.localStateFoundationFor(sim)).toBeNull();expect(h.simulationStateFingerprint(sim)).toBe(fp);
    }
  });
  it.each(['reactions','transport','carbonateBuffer','legacyProjection'])('cannot enable the deferred %s feature through a checkpoint',key=>{
    const sim=smallSim(),record=clone(snapshot(sim));record.capabilities[key]=true;
    expect(()=>h.installLocalStateFoundation(sim,record)).toThrow('feature boundary closed');
    expect(h.localStateFoundationFor(sim)).toBeNull();
  });
  it('refuses legacy growth/diffusion before state, RNG, or inventory mutation',()=>{
    const sim=smallSim(),grid=sim.wall_state.voxelGridFor(sim);h.installLocalStateFoundation(sim,snapshot(sim));
    const before=h.serializeLocalStateFoundation(sim),fp=h.simulationStateFingerprint(sim);
    expect(()=>h.VugSimulator.prototype.run_step.call(sim)).toThrow('inventory-only');
    expect(()=>grid.diffuse(0.1,['pH','Fe'])).toThrow('transport is not commissioned');
    expect(()=>h.assertLegacySaveHasNoLocalStateFoundation(sim)).toThrow('Legacy recipe save');
    expect(sim.step).toBe(0);expect(h.serializeLocalStateFoundation(sim)).toBe(before);
    expect(h.simulationStateFingerprint(sim)).toBe(fp);
  });
  it('detects out-of-band edits instead of exporting a misleading current checkpoint',()=>{
    const sim=smallSim();h.installLocalStateFoundation(sim,snapshot(sim));
    sim.conditions.fluid.Ca+=1;
    expect(()=>h.serializeLocalStateFoundation(sim)).toThrow('changed outside');
  });
  it('does not synthesize local inventories for legacy runs',()=>{
    const sim=smallSim();
    expect(h.localStateFoundationFor(sim)).toBeNull();
    expect(()=>h.serializeLocalStateFoundation(sim)).toThrow('no explicit conserved inventory');
    expect(h.simulationStateProjection(sim)).not.toHaveProperty('localConservedFoundation');
  });
});

describe('pinned pre-foundation recipe witness',()=>{
  it('restores an explicit checkpoint onto a fresh real simulator without changing a component or legacy field',()=>{
    const oldGet=document.getElementById.bind(document);
    document.getElementById=((id:string)=>id.startsWith('broth-')?null:oldGet(id)) as any;
    try{
      localStorage.clear();h.setFortressInstantLines(true);
      h.fortressBeginFromScenario('tutorial_first_crystal',42);
      const source=h._liveFortressSim();h.installLocalStateFoundation(source,snapshot(source));
      const text=h.serializeLocalStateFoundation(source),fp=h.simulationStateFingerprint(source);
      h.fortressReset();h.fortressBeginFromScenario('tutorial_first_crystal',42);
      const target=h._liveFortressSim();
      expect(h.localStateFoundationFor(target)).toBeNull();
      h.restoreLocalStateFoundation(target,text);
      expect(h.serializeLocalStateFoundation(target)).toBe(text);
      expect(h.simulationStateFingerprint(target)).toBe(fp);
      expect(target.step).toBe(0);expect(target.crystals).toHaveLength(0);
    }finally{document.getElementById=oldGet;h.fortressReset();localStorage.clear();}
  });
  it('refuses a real recipe save instead of silently discarding an installed local checkpoint',()=>{
    const oldGet=document.getElementById.bind(document);
    document.getElementById=((id:string)=>id.startsWith('broth-')?null:oldGet(id)) as any;
    try{
      localStorage.clear();h.setFortressInstantLines(true);
      h.fortressBeginFromScenario('tutorial_first_crystal',42);
      const sim=h._liveFortressSim(),beforeStorage=localStorage.getItem('vugg-saves-v1');
      const record=snapshot(sim);h.installLocalStateFoundation(sim,record);
      expect(()=>h._savePersistActive()).toThrow('Legacy recipe save cannot preserve');
      expect(localStorage.getItem('vugg-saves-v1')).toBe(beforeStorage);
      expect(JSON.parse(h.serializeLocalStateFoundation(sim))).toEqual(record);
    }finally{document.getElementById=oldGet;h.fortressReset();localStorage.clear();}
  });
  it('loads a real v286 save captured at db2c17bd and reproduces its exact physical fingerprint',()=>{
    const fixture=JSON.parse(fs.readFileSync('tests-js/fixtures/local-state-legacy-save-v286.json','utf8'));
    expect(fixture.sourceCommit).toBe('db2c17bdac4e7fd3dbcdad1fd03d23f6654d661d');
    const oldGet=document.getElementById.bind(document);
    document.getElementById=((id:string)=>id.startsWith('broth-')?null:oldGet(id)) as any;
    try{
      localStorage.clear();h.setFortressInstantLines(true);
      expect(h._saveReplayCompatibility(fixture.record)).toEqual({ok:true,reason:''});
      expect(h.persistSaves([fixture.record])).toBe(true);
      expect(h.loadSaveById(fixture.record.id)).toBe(true);
      expect(h.simulationStateFingerprint(h._liveFortressSim())).toBe(fixture.stateFingerprint);
      expect(h.localStateFoundationFor(h._liveFortressSim())).toBeNull();
    }finally{document.getElementById=oldGet;h.fortressReset();localStorage.clear();}
  });
});
