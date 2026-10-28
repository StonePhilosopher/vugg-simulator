import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {finiteCalciteTransfer,referenceExtentToAbsoluteMol} from '../pilots/mvt-prehistory/transfer.mjs';
import {compilePrehistory,appendPrehistoryEvent,prehistoryPrefix,serializePrehistory,restorePrehistory}
  from '../pilots/mvt-prehistory/history.mjs';
import {controlInput,sharedEvents,controlCases,sealEvent,pulseEvent,reactionEvent,reopenEvent}
  from '../pilots/mvt-prehistory/control-fixture.mjs';
import {auditMvtPrehistory,requireMvtPhysicalPrehistory} from '../pilots/mvt-prehistory/source-audit.mjs';
import {buildPrehistoryReceipt} from '../pilots/mvt-prehistory/receipt.mjs';

const q=(value:number,unit:string)=>({value,unit});
const roundoff=(actual:number,expected:number)=>expect(Math.abs(actual-expected))
  .toBeLessThanOrEqual(64*Number.EPSILON*Math.abs(expected));
const request=(requested=0.001,stock=0.01)=>({wallSourceId:'declared-wall',owner:'wall-carbonate',phase:'calcite',
  requested:q(requested,'mol_CaCO3'),accessible:q(stock,'mol_CaCO3'),
  molarVolume:q(36.934,'cm3_per_mol_CaCO3'),
  provenance:{kind:'authored-experiment',reference:'finite stock arithmetic, not a natural-pore calibration'}});

describe('boundary-independent finite calcite transfer',()=>{
  it('books one Ca, one carbon and two alkalinity equivalents per calcite removed',()=>{
    const x=finiteCalciteTransfer(request());
    expect(x.acceptedMol).toBe(0.001);
    expect(x.delta).toMatchObject({wallCalciteMol:-0.001,aqueousCalciumMol:0.001,
      aqueousDicMolC:0.001,aqueousAlkalinityEq:0.002,solventWaterKg:0});
    expect(x.delta.crystallineVolumeRemovedMm3).toBeCloseTo(36.934,12);
    roundoff(x.remainingMol+x.acceptedMol,0.01);
    expect(x.productionMappingAllowed).toBe(false);
  });
  it('caps the transfer at finite accessible stock without borrowing grown calcite',()=>{
    const x=finiteCalciteTransfer(request(0.02,0.01));
    expect(x.acceptedMol).toBe(0.01);expect(x.remainingMol).toBe(0);
    expect(x.unacceptedMol).toBe(0.01);expect(x.limitedByStock).toBe(true);
    expect(x.wallSourceId).toBe('declared-wall');
  });
  it.each([[0,0.01],[0.01,0],[0,0]])('makes no transfer for requested/available %s/%s',(a,b)=>{
    const x=finiteCalciteTransfer(request(a,b));
    expect(x.acceptedMol).toBe(0);expect(x.delta.crystallineVolumeRemovedMm3).toBe(0);
    expect(x.remainingMol).toBe(b);
  });
  it('does not choose a fluid volume, void gain, pH, time or pressure from solid removal',()=>{
    const x=finiteCalciteTransfer(request());
    for(const key of ['voidGainMm3','waterKg','waterVolumeMm3','pH','elapsedSeconds','pressureBar'])
      expect(Object.hasOwn(x,key)).toBe(false);
    expect(x.delta.solventWaterKg).toBe(0);
  });
  it('retains independent immutable provenance and never mutates its input',()=>{
    const input=request(),before=JSON.stringify(input),x=finiteCalciteTransfer(input);
    expect(JSON.stringify(input)).toBe(before);
    input.provenance.reference='another experiment';expect(x.provenance.reference).not.toBe(input.provenance.reference);
    expect(()=>{x.delta.aqueousCalciumMol=1;}).toThrow();
  });
  it('refuses unknown phases, owners, missing fields and geometry-derived stock shortcuts',()=>{
    for(const change of [(x:any)=>x.owner='grown-crystal',(x:any)=>x.phase='dolomite',
      (x:any)=>delete x.accessible,(x:any)=>x.displayVolumeMm3=1,
      (x:any)=>x.accessible.unit='mmol_per_kg_reference']){
      const x=request();change(x);expect(()=>finiteCalciteTransfer(x)).toThrow();
    }
  });
  it.each([NaN,Infinity,-1,'1',null])('rejects invalid amounts %s',bad=>{
    for(const key of ['requested','accessible','molarVolume']){
      const x:any=request();x[key].value=bad;expect(()=>finiteCalciteTransfer(x)).toThrow();
    }
  });
  it('rejects zero molar volume and unrepresentable positive products/debits',()=>{
    const x=request();x.molarVolume.value=0;expect(()=>finiteCalciteTransfer(x)).toThrow();
    expect(()=>finiteCalciteTransfer(request(Number.MIN_VALUE,1))).toThrow('stock resolution');
    expect(()=>finiteCalciteTransfer(request(1e308,1e308))).toThrow('Unrepresentable');
  });
  it('converts reference extent only after an explicit kg-solvent amount is supplied',()=>{
    const extent=q(0.1871350865811667,'mmol_CaCO3_per_kg_solvent');
    roundoff(referenceExtentToAbsoluteMol(extent,q(1,'kg_solvent_water')),0.0001871350865811667);
    expect(referenceExtentToAbsoluteMol(extent,q(0.05,'kg_solvent_water')))
      .toBeCloseTo(0.000009356754329058335,18);
    expect(()=>referenceExtentToAbsoluteMol(extent,q(1,'kg_solution'))).toThrow();
    expect(()=>referenceExtentToAbsoluteMol(extent,q(1,'reference_kg_without_physical_mapping'))).toThrow();
  });
});

describe('host, void and fluid have one causal prehistory',()=>{
  it('starts from a mixed host with no inferred void or water',()=>{
    const x=compilePrehistory(controlInput());
    expect(x.pore.connectivity).toBe('no-pore');expect(x.pore.waterKg).toBe(0);
    expect(x.pore.geometricVoidVolumeMm3).toBe(0);
    expect(Object.values(x.host.initialPhaseVolumesMm3).every(v=>(v as number)>0)).toBe(true);
    expect(new Set(x.host.parcels.map((p:any)=>p.phase))).toEqual(new Set(['calcite','dolomite','quartz']));
  });
  it('exports mechanically removed breccia without pretending it dissolved into fluid',()=>{
    const x=compilePrehistory(controlInput(),sharedEvents().slice(0,1));
    roundoff(x.pore.geometricVoidVolumeMm3,1);
    roundoff(x.host.exportedPhaseVolumesMm3.calcite,1);
    expect(x.host.dissolvedCalciteMol).toBe(0);expect(x.pore.components.calciumMol).toBe(0);
    expect(x.pore.waterKg).toBe(0);expect(x.pore.connectivity).toBe('unestablished');
  });
  it('derives resident water and components from named incoming parcels and depletes those sources',()=>{
    const x=controlCases().connected;
    roundoff(x.pore.waterKg,0.5*8.5e-7+0.25*9.8e-7);
    expect(x.pore.wetVolumeMm3).toBe(0.75);
    roundoff(x.pore.components.zincMol,0.5*8.5e-7*0.001);
    roundoff(x.pore.components.reducedSulfurMol,0.25*9.8e-7*0.0005);
    expect(x.pore.residentFluidProvenance.map((p:any)=>p.reservoirId))
      .toEqual(['metal-brine-control','sulfur-water-control']);
    expect(x.externalReservoirs['metal-brine-control'].remainingVolumeMm3).toBe(99.5);
    expect(x.externalReservoirs['sulfur-water-control'].remainingVolumeMm3).toBe(99.75);
    expect(x.closure.water.residual).toBeLessThan(1e-18);
  });
  it('derives exposed mineral access from the surviving material geometry',()=>{
    const x=controlCases().sealed;
    expect(x.host.exposedSurfaces.find((p:any)=>p.parcelId===13)).toMatchObject({phase:'calcite',exposedFaceAreaMm2:1});
    expect(x.host.exposedSurfaces.find((p:any)=>p.parcelId===0).potentialCalciteMol).toBe(0);
    expect(x.host.exposedSurfaces.filter((p:any)=>p.exposedFaceAreaMm2>0).map((p:any)=>p.phase))
      .toEqual(expect.arrayContaining(['calcite','dolomite','quartz']));
    expect(x.host.exposedSurfaces.filter((p:any)=>p.phase!=='calcite').every((p:any)=>p.potentialCalciteMol===0)).toBe(true);
  });
  it('does not accept water mass, wall stock or a pure-calcite lithology shortcut as independent initial conditions',()=>{
    for(const mutate of [(x:any)=>x.waterKg=1,(x:any)=>x.wallCalciteMol=1,
      (x:any)=>delete x.host.phases,(x:any)=>x.host.phases.fill('limestone'),
      (x:any)=>delete x.reservoirs[0].solventMassPerVolume,(x:any)=>delete x.reservoirs[0].molality.alkalinityEq]){
      const input=controlInput();mutate(input);expect(()=>compilePrehistory(input)).toThrow();
    }
  });
  it('refuses guessed chemistry from pH or reference kilograms and preserves explicit approximations',()=>{
    const input=controlInput();(input.reservoirs[0] as any).pH=7;expect(()=>compilePrehistory(input)).toThrow();
    const wrong=controlInput();wrong.reservoirs[0].solventMassPerVolume.unit='kg_reference_per_mm3';
    expect(()=>compilePrehistory(wrong)).toThrow();
    expect(controlCases().sealed.qualification).toContain('not commissioned natural-MVT');
  });
  it('does not merge disconnected cavities into one chemical compartment',()=>{
    const e=sharedEvents()[0];e.parcelIds=[0,22];expect(()=>compilePrehistory(controlInput(),[e])).toThrow('Disconnected');
  });
  it('refuses entry before formation, a missing feeder, and donor/pore overdraw',()=>{
    expect(()=>compilePrehistory(controlInput(),[sharedEvents()[2]])).toThrow('open feeder');
    const x=controlCases().connected;
    for(const delta of [{feederId:'missing'},{reservoirId:'unnamed'},{volume:{value:200,unit:'mm3_solution'}}])
      expect(()=>appendPrehistoryEvent(x,{...pulseEvent(),...delta})).toThrow();
  });
  it('depletes a finite external donor exactly after successive withdrawals, without negative or ghost solutes',()=>{
    const input=controlInput();input.reservoirs[0].volume.value=0.3;
    const events=sharedEvents().slice(0,3);events[2].volume.value=0.1;
    const before=compilePrehistory(input,events);
    const after=appendPrehistoryEvent(before,{...pulseEvent(),
      volume:{value:before.externalReservoirs['metal-brine-control'].remainingVolumeMm3,unit:'mm3_solution'}});
    const donor=after.externalReservoirs['metal-brine-control'];
    expect(donor.remainingVolumeMm3).toBe(0);expect(donor.remainingWaterKg).toBe(0);
    expect(Object.values(donor.components).every(v=>v===0)).toBe(true);
    expect(()=>appendPrehistoryEvent(after,{...pulseEvent(),id:'overdraw-after-exhaustion'})).toThrow('finite donor');
  });
});

describe('connected and sealed snapshots are chapters of the same specimen',()=>{
  it('seals the existing resident inventory without rewriting or replenishing it',()=>{
    const {connected,sealed}=controlCases();
    expect(sealed.pore.connectivity).toBe('sealed');expect(connected.pore.connectivity).toBe('connected');
    expect(sealed.pore.waterKg).toBe(connected.pore.waterKg);
    expect(sealed.pore.components).toEqual(connected.pore.components);
    expect(sealed.host).toEqual(connected.host);expect(sealed.externalReservoirs).toEqual(connected.externalReservoirs);
    const receipt=sealed.historyReceipts.at(-1);
    expect(receipt.detail.materialBeforeDigest).toBe(receipt.detail.materialAfterDigest);
    expect(prehistoryPrefix(sealed,4)).toEqual(connected);
  });
  it('branches before sealing for the external-reservoir control and rejects the same pulse after sealing',()=>{
    const {connected,sealed,connectedPulse}=controlCases();
    expect(prehistoryPrefix(connectedPulse,4)).toEqual(connected);
    expect(()=>appendPrehistoryEvent(sealed,pulseEvent())).toThrow('open feeder');
    expect(connectedPulse.pore.waterKg).toBeGreaterThan(sealed.pore.waterKg);
    roundoff(connectedPulse.pore.waterKg-sealed.pore.waterKg,0.125*8.5e-7);
    expect(connectedPulse.externalReservoirs['metal-brine-control'].remainingVolumeMm3).toBe(99.375);
  });
  it('reopens the same feeder and fluid lineage, rather than constructing another initial pore',()=>{
    const {connectedPulse,reopenedPulse}=controlCases();
    expect(reopenedPulse.pore).toEqual(connectedPulse.pore);
    expect(reopenedPulse.host).toEqual(connectedPulse.host);
    expect(reopenedPulse.externalReservoirs).toEqual(connectedPulse.externalReservoirs);
    expect(reopenedPulse.recordDigest).not.toBe(connectedPulse.recordDigest);
    expect(reopenedPulse.events.map((e:any)=>e.type)).toContain('seal_feeder');
  });
  it('conserves the sealed finite system while deriving new void from actual removed calcite',()=>{
    const {sealed,sealedTransfer:r}=controlCases();
    const parcel=sealed.host.parcels[13],expectedMol=parcel.volumeMm3/(36.934*1000);
    roundoff(r.host.dissolvedCalciteMol,expectedMol);
    roundoff(r.pore.components.calciumMol-sealed.pore.components.calciumMol,expectedMol);
    roundoff(r.pore.components.dicMolC-sealed.pore.components.dicMolC,expectedMol);
    roundoff(r.pore.components.alkalinityEq-sealed.pore.components.alkalinityEq,2*expectedMol);
    // Difference of two cavity volumes: allow roundoff at their original scale.
    expect(Math.abs((r.pore.geometricVoidVolumeMm3-sealed.pore.geometricVoidVolumeMm3)-parcel.volumeMm3))
      .toBeLessThanOrEqual(128*Number.EPSILON*(Math.abs(r.pore.geometricVoidVolumeMm3)+Math.abs(sealed.pore.geometricVoidVolumeMm3)));
    expect(r.pore.waterKg).toBe(sealed.pore.waterKg);
    expect(r.host.remainingPhaseVolumesMm3.dolomite).toBe(sealed.host.remainingPhaseVolumesMm3.dolomite);
    expect(r.host.remainingPhaseVolumesMm3.quartz).toBe(sealed.host.remainingPhaseVolumesMm3.quartz);
    for(const evidence of Object.values(r.closure.components) as any[])
      expect(Math.abs(evidence.residual)).toBeLessThanOrEqual(evidence.tolerance);
    expect(r.historyReceipts.at(-1).detail.conversion.actual).toBeCloseTo(parcel.volumeMm3,15);
  });
  it('does not turn new void into new water or reuse the initial volume approximation after reaction',()=>{
    const {sealedTransfer:r}=controlCases();
    expect(r.pore.wetVolumeMm3).toBeNull();expect(r.pore.pH).toBeNull();expect(r.pore.pressureBar).toBeNull();
    const reopened=appendPrehistoryEvent(r,reopenEvent());
    expect(()=>appendPrehistoryEvent(reopened,pulseEvent())).toThrow('solution volume is unresolved');
    expect(reopened.pore.waterKg).toBe(r.pore.waterKg);
    const noContact=JSON.parse(JSON.stringify(reactionEvent()));delete noContact.contactModel;
    expect(()=>appendPrehistoryEvent(controlCases().sealed,noContact)).toThrow();
  });
  it.each([0,19,25])('will not consume an unexposed calcite or non-calcite parcel %s',parcelId=>{
    expect(()=>appendPrehistoryEvent(controlCases().sealed,{...reactionEvent(),parcelId})).toThrow('exposed calcite');
  });
  it('consumes a parcel once, preserves one source lineage, and rejects invented cement/closure material',()=>{
    const {sealed,sealedTransfer:r}=controlCases();
    expect(()=>appendPrehistoryEvent(sealed,sealEvent())).toThrow('already recorded');
    expect(()=>appendPrehistoryEvent(r,{...reactionEvent(),id:'duplicate-material-debit'})).toThrow('exposed calcite');
    expect(()=>appendPrehistoryEvent(controlCases().connected,{...sealEvent(),mechanism:'cement-volume-from-nowhere'})).toThrow('cement');
  });
});

describe('causal persistence and actual-MVT authority refusal',()=>{
  it('reconstructs both boundary states and the consumed host from complete source-bound history',()=>{
    for(const x of Object.values(controlCases())){
      expect(restorePrehistory(serializePrehistory(x))).toEqual(x);
      expect(x.productionMappingAllowed).toBe(false);expect(x.productionReactions).toBe(false);expect(x.transport).toBe(false);
    }
  });
  it('rejects retroactive host, fluid, history or derived-state edits',()=>{
    const x=controlCases().sealedTransfer,text=serializePrehistory(x);
    for(const mutate of [(s:any)=>s.inputs.host.phases[13]='quartz',
      (s:any)=>s.inputs.reservoirs[0].molality.zincMol.value*=2,(s:any)=>s.events.splice(4,1),
      (s:any)=>s.modelDigest='other-model']){
      const saved=JSON.parse(text);mutate(saved);expect(()=>restorePrehistory(JSON.stringify(saved))).toThrow();
    }
    const forged=JSON.parse(JSON.stringify(x));forged.pore.waterKg=1;
    expect(()=>appendPrehistoryEvent(forged,reopenEvent())).toThrow('causal prehistory');
  });
  it('retains independent, deeply immutable inputs and snapshots',()=>{
    const input=controlInput(),events=sharedEvents(),before=JSON.stringify({input,events});
    const x=compilePrehistory(input,events);expect(JSON.stringify({input,events})).toBe(before);
    input.host.phases[13]='quartz';expect(x.inputs.host.phases[13]).toBe('calcite');
    expect(()=>{x.pore.waterKg=1;}).toThrow();
  });
  it('keeps actual MVT history gaps explicit and never borrows another scenario seal or a pure-calcite wall',()=>{
    const a=auditMvtPrehistory();
    expect(a.known.authoredHostProxy).toBe('limestone');
    expect(a.known.events.map((e:any)=>e.step)).toEqual([20,60,80]);
    expect(a.differentScenarioPrecedents.reactiveWall.events.at(-1).step).toBe(90);
    expect(a.connectedPhysicalSnapshot).toBeNull();expect(a.sealedPhysicalSnapshot).toBeNull();
    expect(a.physicalPrehistoryCommissioned).toBe(false);
    expect(()=>requireMvtPhysicalPrehistory()).toThrow('MVT physical prehistory HOLD');
  });
  it('reproduces the commissioned receipt with unchanged production and registered science producers',()=>{
    const receipt=buildPrehistoryReceipt();
    expect(receipt).toEqual(JSON.parse(fs.readFileSync('pilots/mvt-prehistory/receipt.json','utf8')));
    expect(receipt.registeredProducerContractsUnchanged).toBe(true);
    expect(receipt.boundaryProofs.connectedMaterialDigest).toBe(receipt.boundaryProofs.sealedMaterialDigest);
    expect(receipt.actualMvt.physicalPrehistoryCommissioned).toBe(false);
  });
});
