import {describe,it,expect,beforeAll} from 'vitest';
import fs from 'node:fs';
import {observeInitialWallReference,preflightWallReference,evaluatePhysicalHypothesis}
  from '../pilots/reservoir-reference-preflight/preflight.mjs';
import {buildMvtPreflightReceipt} from '../pilots/reservoir-reference-preflight/receipt.mjs';

const h=globalThis as any;
const receipt=()=>JSON.parse(fs.readFileSync('pilots/reservoir-reference-preflight/receipt.json','utf8'));
const observation=()=>receipt().record.observation;
const hypothesis=(waterKg:number,stockMol?:number)=>({water:{value:waterKg,unit:'kg_solvent_water'},
  reactiveWallCalcite:{value:stockMol??observation().reference.remaining/1000*waterKg,unit:'mol_CaCO3_wall'},
  provenance:{kind:'conditional-hypothesis',reference:'arbitrary dimensional test, not a measured MVT fluid'}});

describe('reference-to-physical dimensional compatibility',()=>{
  it('derives the one-kg reference requirement without assigning water to the vug',()=>{
    const result=preflightWallReference(observation());
    expect(result.nominalTargetEquivalentSolventKg).toBe(1);
    expect(result.requiredSolventKgPerM3OfWholeCavity).toBeCloseTo(14657.122521083,7);
    expect(result.localAllocation).toMatchObject({cellCount:7680,waterKg:null,wetControlVolumesMm3:null,reactiveWallCalciteMol:null});
    expect(result.requiredDensityMeaning).toContain('not a brine density');
    expect(result.referenceEquation.extent).toContain('/ 1000');
  });
  it('separates measured numerical erosion residual/tolerance from physical uncertainty',()=>{
    const result=preflightWallReference(observation());
    expect(result.achievedEquivalentSolventKg).toBeLessThan(1);
    expect(result.geometryOnlyEquivalentSolventKgInterval[0]).toBeLessThan(1);
    expect(result.geometryOnlyEquivalentSolventKgInterval[1]).toBeGreaterThan(1);
    expect(result.intervalMeaning).toContain('not physical uncertainty');
  });
  it.each([0.001,0.05,2])('exposes geometric drift under an explicit %s kg hypothesis',kg=>{
    const result=evaluatePhysicalHypothesis(observation(),hypothesis(kg));
    expect(result.geometryNumericallyCompatible).toBe(false);
    expect(result.stockNumericallyCompatible).toBe(true);
    expect(result.physicalDissolvedCalciteMol).toBeCloseTo(0.1871350865811667/1000*kg,14);
    expect(result.physicalDissolutionVolumeMm3).toBeCloseTo(6.911647287788811*kg,12);
    expect(result.requiredVoidGainPerCrystallineCalciteVolume).toBeCloseTo(0.9999417738966887/kg,9);
    expect(result.requiredFactorMeaning).toContain('not a measured reactive fraction');
    expect(result.enoughDeclaredStockForPreview).toBe(true);
    expect(result.productionMappingAllowed).toBe(false);
  });
  it('never treats numerical compatibility at one kg as physical authorization',()=>{
    const result=evaluatePhysicalHypothesis(observation(),hypothesis(1));
    expect(result.geometryNumericallyCompatible).toBe(true);
    expect(result.stockNumericallyCompatible).toBe(true);
    expect(result.productionMappingAllowed).toBe(false);
    expect(result.reactions).toBe(false);expect(result.transport).toBe(false);expect(result.referenceRescaled).toBe(false);
    expect(result.conclusion).toContain('no physical or spatial authority');
  });
  it('reports separate finite stock incompatibility and stock exhaustion',()=>{
    const x=evaluatePhysicalHypothesis(observation(),hypothesis(1,1e-6));
    expect(x.geometryNumericallyCompatible).toBe(true);
    expect(x.stockNumericallyCompatible).toBe(false);
    expect(x.enoughDeclaredStockForPreview).toBe(false);
    expect(x.physicalDissolvedCalciteMol).toBeGreaterThan(x.hypothesis.reactiveWallCalcite.value);
  });
  it('retains a single global parent instead of multiplying by the cell count',()=>{
    const x=evaluatePhysicalHypothesis(observation(),hypothesis(0.05));
    expect(x.expectedRemainingCalciteMolFromLegacy).toBeCloseTo(0.009356754329058337,15);
    expect(x.expectedRemainingCalciteMolFromLegacy).not.toBeCloseTo(0.009356754329058337*7680,3);
    expect(x.hypothesis.reactiveWallCalcite.unit).toBe('mol_CaCO3_wall');
  });
  it('preserves caller data and returns frozen independent records',()=>{
    const input=observation(),test=hypothesis(1),before=JSON.stringify([input,test]);
    const a=preflightWallReference(input),b=evaluatePhysicalHypothesis(input,test);
    expect(JSON.stringify([input,test])).toBe(before);
    input.volumeMm3=1;test.water.value=2;
    expect(a.observation.volumeMm3).toBeGreaterThan(68000);expect(b.hypothesis.water.value).toBe(1);
    expect(Object.isFrozen(a.observation.geometryReceipt)).toBe(true);
    expect(()=>{a.localAllocation.waterKg=1;}).toThrow();
  });
  it.each([0,-1,NaN,Infinity,'1',null])('rejects unsupported water or stock amounts %s',bad=>{
    for(const field of ['water','reactiveWallCalcite']){
      const x:any=hypothesis(1);x[field].value=bad;
      expect(()=>evaluatePhysicalHypothesis(observation(),x)).toThrow();
    }
  });
  it('rejects relabeling solution mass, grown calcite, missing units, and pH inference',()=>{
    for(const change of [(x:any)=>x.water.unit='kg_solution',
      (x:any)=>x.reactiveWallCalcite.unit='mol_CaCO3_grown_crystal',
      (x:any)=>delete x.water.unit,(x:any)=>x.pH=7,
      (x:any)=>x.provenance.kind='scientifically-resolved']){
      const x:any=hypothesis(1);change(x);expect(()=>evaluatePhysicalHypothesis(observation(),x)).toThrow();
    }
  });
  it('refuses unrepresentable products rather than returning zero or infinity',()=>{
    for(const kg of [Number.MIN_VALUE,Number.MAX_VALUE])
      expect(()=>evaluatePhysicalHypothesis(observation(),hypothesis(kg,1))).toThrow('representable');
  });
  it('requires complete observations and compatible units/phase',()=>{
    for(const change of [(x:any)=>delete x.geometryPlan,(x:any)=>x.renderQuality='high',
      (x:any)=>x.reference.modeledFormula='CaMg(CO3)2',
      (x:any)=>x.reference.units='mol_physical',
      (x:any)=>x.reference.physicalWaterKg=1,(x:any)=>x.dimensions.depths=5]){
      const x=observation();change(x);expect(()=>preflightWallReference(x)).toThrow();
    }
  });
  it.each(['targetMm3PerKgReference','oldVolumeMm3','achievedNumericMm3'])('refuses inconsistent geometry %s',field=>{
    const x=observation();x.geometryPlan[field]*=2;expect(()=>preflightWallReference(x)).toThrow();
  });
  it('refuses a tolerance broad enough to hide the whole transaction',()=>{
    const x=observation();x.geometryPlan.toleranceMm3=x.geometryPlan.targetMm3PerKgReference;
    expect(()=>preflightWallReference(x)).toThrow('Unresolved geometry');
  });
  it('requires carbonate and calcium releases to close separately',()=>{
    for(const key of ['calciumMgKgReference','carbonAsCO3MgKgReference']){
      const x=observation();x.stimulus[key]*=2;expect(()=>preflightWallReference(x)).toThrow('stoichiometry');
    }
  });
  it('refuses a consumed or cloned parent and a relabeled reference decrement',()=>{
    for(const change of [(x:any)=>x.reference.released=1,
      (x:any)=>x.reference.initial*=7680,(x:any)=>x.reference.owner='voxel-wall-clone',
      (x:any)=>x.stimulus.acceptedRateMm*=2]){
      const x=observation();change(x);expect(()=>preflightWallReference(x)).toThrow();
    }
  });
  it('does not confuse one total cavity volume with 7680 spatial water measurements',()=>{
    const input=observation(),a=preflightWallReference(input);
    input.dimensions={rings:1,cellsPerRing:1,depths:1};input.cellCount=1;
    const b=preflightWallReference(input);
    expect(b.nominalTargetEquivalentSolventKg).toBe(a.nominalTargetEquivalentSolventKg);
    expect(b.remainingCalciteMolPerKgReference).toBe(a.remainingCalciteMolPerKgReference);
    expect(b.localAllocation.waterKg).toBeNull();
  });
});

describe('actual initial MVT observation and evidence binding',()=>{
  let sim:any;
  beforeAll(()=>{h.setSeed(42);sim=new h.VugSimulator(h.SCENARIOS.mvt().conditions);});
  it('inspects the authenticated cavity and an uncommitted attack without growth or RNG changes',()=>{
    const fp=h.simulationStateFingerprint(sim),rng=h.simulationStateProjection(sim).rngState;
    const x=observeInitialWallReference(h,sim);
    expect(x.cellCount).toBe(7680);expect(x.geometryReceipt.resolution).toBe(48);
    expect(x.stimulus.acceptedRateMm).toBe(0.5);
    expect(x.conditions).toEqual({temperatureC:180,pressureKbar:0.3,salinityIndex:15});
    expect(h.simulationStateFingerprint(sim)).toBe(fp);
    expect(h.simulationStateProjection(sim).rngState).toBe(rng);
    expect(sim.wall_state.cavityEvolutionLedger().cursor).toBe(0);
    expect(h.localStateFoundationFor(sim)).toBeNull();
    expect(sim.conditions.wall.host_formula_released_mmolkg).toBe(0);
  });
  it.each([{step:1},{crystals:[{}]}])('refuses a later or occupied specimen: %j',change=>{
    expect(()=>observeInitialWallReference(h,{...sim,...change})).toThrow('Fresh legacy');
  });
  it('refuses partial flooding and dolomite instead of supplying a guessed water/stock mapping',()=>{
    for(const conditions of [{...sim.conditions,fluid_surface_ring:3},
      {...sim.conditions,wall:{...sim.conditions.wall,composition:'dolomite'}}])
      expect(()=>observeInitialWallReference(h,{...sim,conditions})).toThrow();
  });
  it('reproduces the pinned source/runtime receipt; no production mapping is certified',async()=>{
    const result=await buildMvtPreflightReceipt(h);
    expect(result).toEqual(receipt());
    expect(result.productionMappingAllowed).toBe(false);
    expect(result.registeredProducerContractsUnchanged).toBe(true);
    expect(result.record.observation.inspectionDidNotMutate).toBe(true);
    expect(Object.values(result.absentPhysicalInputs).every(v=>v===null)).toBe(true);
  });
});
