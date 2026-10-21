import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../tools/three.module.js';
import {controlledSpecimen} from '../pilots/calcite/fixture.mjs';
import {CalciteAuthorityWriter,CalciteRecordPlayer,saveCalciteSpecimen,loadCalciteSpecimen,
  assertCalciteSpecimen,calciteProductionGate} from '../pilots/calcite/authority.js';
import {recordCalciteSteps} from '../pilots/calcite/growth-capture.mjs';
import {kernelFor} from '../pilots/calcite/capture.mjs';
import {clone,geometryVolume,tessellate,validateFrame} from '../pilots/calcite/specimen.js';
import {SpecimenView} from '../pilots/calcite/render.js';
import {runtimeExecutionDigest} from '../tools/evidence-runtime.mjs';
import {boundingReference,auditSpecimenFactors,fleetFactorCoverage} from '../pilots/calcite/factor-audit.js';

const h=globalThis as any;
const hash=(x:any)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const geometry=(group:any)=>group.children.map((m:any)=>({id:m.userData.crystalId,
  positions:Array.from(m.geometry.attributes.position.array),groups:m.geometry.groups}));
const fixture=()=>controlledSpecimen(h);

describe('Calcite Scientific-Solid Authority v1 (isolated, production gate closed)',()=>{
  it('records nucleation, both generations, accepted composition, dissolution, and regrowth',()=>{
    const s=fixture();
    expect(s.frames).toHaveLength(5);
    expect(s.events.filter((e:any)=>e.kind==='nucleation').map((e:any)=>[e.id,e.step])).toEqual([[1,1],[2,2]]);
    expect(s.events.filter((e:any)=>e.kind==='dissolution')).toHaveLength(2);
    expect(s.events.filter((e:any)=>e.kind==='regrowth')).toHaveLength(2);
    const zone=s.events.find((e:any)=>e.id===1&&e.step===3&&e.kind==='growth');
    expect(zone.zone.trace_Mn).toBe(.2);
    expect(zone.after.bookedVolumeMm3).toBeGreaterThan(zone.before.bookedVolumeMm3);
    const retreat=s.events.find((e:any)=>e.id===1&&e.kind==='dissolution');
    expect(retreat.after.bookedVolumeMm3).toBeLessThan(retreat.before.bookedVolumeMm3);
    expect(s.frames[3].allCalcite[0].cLengthMm).toBeLessThan(s.frames[2].allCalcite[0].cLengthMm);
  });

  it('freezes origin and zone events and every contemporaneous morphology input',()=>{
    const s=fixture(),early=JSON.stringify(s.frames[0]);
    expect(()=>{s.events[0].origin.initialHabit='scalenohedral';}).toThrow();
    expect(()=>{s.events[1].zone.trace_Mn=100;}).toThrow();
    expect(()=>{s.frames[0].surface.crystals[0].facts.form.biasC=100;}).toThrow();
    expect(JSON.stringify(s.frames[0])).toBe(early);
    expect(s.frames[0].surface.crystals[0].facts.zones).toHaveLength(1);
    expect(s.frames[4].surface.crystals[0].facts.zones).toHaveLength(5);
  });

  it('growth → save/load → Record Player → total mesh rebuild matches the golden invariant',()=>{
    const s=fixture(),loaded=loadCalciteSpecimen(saveCalciteSpecimen(s)),player=new CalciteRecordPlayer(loaded);
    expect(loaded).toEqual(s);
    const group=new THREE.Group(),view=new SpecimenView(THREE,group),signatures=[];
    for(let step=1;step<=5;step++){
      const frame=player.atStep(step);view.sync(frame);const before=geometry(group);
      view.dispose();view.sync(frame);expect(geometry(group)).toEqual(before);
      signatures.push(hash(before));
    }
    const golden=JSON.parse(fs.readFileSync('pilots/calcite/golden.json','utf8'));
    expect(hash(s)).toBe(golden.specimenSha256);
    expect(signatures).toEqual(golden.geometrySha256ByStep);
    expect(loaded.frames.map((f:any)=>f.allCalcite.map((c:any)=>c.bookedVolumeMm3))).toEqual(golden.bookedVolumeMm3ByStep);
    view.dispose();expect(view.created).toBe(view.disposed);
  });

  it('seeks older steps exactly after later growth without interpolation or future zones',()=>{
    const p=new CalciteRecordPlayer(fixture());
    expect(p.atStep(5).crystals[0].facts.zones).toHaveLength(5);
    expect(p.atStep(1).crystals[0].facts.zones).toHaveLength(1);
    expect(()=>p.atStep(0)).toThrow(/No authoritative/);
    expect(()=>p.atStep(1.5)).toThrow(/No authoritative/);
    expect(()=>p.atStep(6)).toThrow(/No authoritative/);
  });

  it('preserves mass and completed volume independently across planar subdivision and camera changes',()=>{
    const s=fixture(),saved=saveCalciteSpecimen(s),frame=s.frames[4].surface;
    const group=new THREE.Group(),view=new SpecimenView(THREE,group),camera=new THREE.PerspectiveCamera();
    view.sync(frame);const created=view.created;
    camera.position.set(17,3,-2);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    view.sync(frame,{wireframe:true});expect(view.created).toBe(created);
    view.sync(frame,{subdivision:1});
    for(const c of frame.crystals){
      const data=tessellate(c,1),vertices=[],faces=[];
      for(let i=0;i<data.positions.length;i+=3)vertices.push(data.positions.slice(i,i+3));
      for(let i=0;i<vertices.length;i+=3)faces.push({verts:[i,i+1,i+2]});
      expect(geometryVolume({vertices,faces})).toBeCloseTo(c.completion.volumeMm3,10);
      expect(c.completion.volumeMm3).not.toBeCloseTo(c.facts.bookedVolumeMm3,4);
      expect(c.completion.volumeIsMassAuthority).toBe(false);
    }
    expect(saveCalciteSpecimen(s)).toBe(saved);view.dispose();
  });

  it('retains paired contact boundaries and their procedural authority, not simulated arrest',()=>{
    let faces=0;
    for(const f of fixture().frames.slice(1)){
      const planes=f.surface.crystals.map((c:any)=>c.completion.planes.find((p:any)=>p.kind==='contact'));
      expect(planes[0].neighborId).toBe(2);expect(planes[1].neighborId).toBe(1);
      expect(planes[0].d+planes[1].d).toBeCloseTo(0,12);
      for(let i=0;i<3;i++)expect(planes[0].n[i]+planes[1].n[i]).toBeCloseTo(0,12);
      for(const c of f.surface.crystals){
        expect(c.authority.contacts.classification).toBe('procedurally-completed');
        faces+=c.completion.poly.faces.filter((p:any)=>c.completion.planes[p.plane].kind==='contact').length;
      }
    }
    expect(faces).toBeGreaterThan(0);
  });

  it('records an explicit conversion, not a density/porosity story or permission to use mesh mass',()=>{
    const s=fixture();
    for(const f of s.frames)for(const c of f.surface.crystals){
      const a=c.completion.volumeAudit;
      const predicted=c.facts.bookedVolumeMm3*a.fullToBooked*a.attachmentRetention*a.contactRetention;
      expect(predicted).toBeCloseTo(c.completion.volumeMm3,10);
    }
    expect(s.volumeRelationship.allowedConsumers.booked).toContain('chemistry');
    expect(s.volumeRelationship.allowedConsumers.completed).not.toContain('chemistry');
    expect(calciteProductionGate(s).allowed).toBe(false);
  });

  it.each([
    (s:any)=>{s.events[1].zone.trace_Mn=.99;},
    (s:any)=>{s.frames[0].allCalcite[0].bookedVolumeMm3*=2;},
    (s:any)=>{s.frames[1].surface.crystals[0].facts.form.biasC*=2;},
    (s:any)=>{s.events[0].origin.nucleationStep=99;},
    (s:any)=>{s.frames[0].eventCount=s.events.length;},
    (s:any)=>{s.volumeRelationship.status='closed';},
    (s:any)=>{s.frames[0].surface.crystals[0].completion.visibilityScale=2;},
    (s:any)=>{s.frames[0].surface.crystals[0].completion.volumeIsMassAuthority=true;},
  ])('rejects a corrupted or authority-changing saved specimen (%#)',mutate=>{
    const s=clone(fixture());mutate(s);expect(()=>loadCalciteSpecimen(JSON.stringify(s))).toThrow();
  });

  it('fails on a missing event, missing lineage, or frame gap instead of reconstructing from final state',()=>{
    for(const edit of [(s:any)=>s.events.splice(1,1),(s:any)=>s.frames.splice(1,1),
      (s:any)=>{s.frames[1].allCalcite.pop();}]){
      const s=clone(fixture());edit(s);expect(()=>assertCalciteSpecimen(s)).toThrow();
    }
  });

  it('does not consult a growth kernel or current fluid when replaying saved geometry',()=>{
    const loaded=loadCalciteSpecimen(saveCalciteSpecimen(fixture()));
    const p=new CalciteRecordPlayer(loaded),group=new THREE.Group(),view=new SpecimenView(THREE,group);
    const original=h.wulffFaceSetForMineral;
    try{
      h.wulffFaceSetForMineral=()=>{throw Error('Growth kernel must not run during replay');};
      view.sync(p.atStep(1));view.dispose();view.sync(p.atStep(5));view.dispose();
    }finally{h.wulffFaceSetForMineral=original;view.dispose();}
    expect(loaded).toEqual(fixture());
  });

  it('keeps actual Elmwood growth trajectory unchanged while recording acceptance events',()=>{
    const run=(record:boolean)=>{
      h.setSeed(42);const scenario=h.SCENARIOS.elmwood();scenario.conditions.wall.wulff_calcite=true;
      const sim=new h.VugSimulator(scenario.conditions,scenario.events),fingerprints=[];
      const original=sim.run_step;
      sim.run_step=function(){const out=original.call(this);fingerprints.push(h.simulationStateFingerprint(this));return out;};
      const add=h.Crystal.prototype.add_zone;
      const writer=new CalciteAuthorityWriter(kernelFor(h),{kind:'live-model-capture',scenario:'elmwood',seed:42,
        wulffCalciteOverride:true,limitation:'Matched old pilot configuration; not authored default'});
      const specimen=record?recordCalciteSteps(h,sim,writer,16,{scenario:'elmwood',seed:42}):null;
      if(!record)for(let i=0;i<16;i++)sim.run_step();
      expect(h.Crystal.prototype.add_zone).toBe(add);expect(Object.hasOwn(sim,'nucleate')).toBe(false);
      return {fingerprints,specimen,crystals:hash(sim.crystals)};
    };
    const baseline=run(false),recorded=run(true);
    expect(recorded.fingerprints).toEqual(baseline.fingerprints);expect(recorded.crystals).toBe(baseline.crystals);
    expect(recorded.specimen.events.some((e:any)=>e.kind==='growth')).toBe(true);
    expect(recorded.specimen.frames.some((f:any)=>f.surface.crystals.length>0)).toBe(true);
    const restored=loadCalciteSpecimen(saveCalciteSpecimen(recorded.specimen));
    for(const f of restored.frames)validateFrame(f.surface);
    const report=JSON.parse(fs.readFileSync('pilots/calcite/factor-coverage.json','utf8'));
    expect(auditSpecimenFactors(restored,h.wulffPolyhedron).samples).toEqual(report.examples.elmwood.audit.samples);
    const group=new THREE.Group(),view=new SpecimenView(THREE,group),signatures=[];
    try{for(const frame of restored.frames){
      view.dispose();view.sync(frame.surface);signatures.push(hash(geometry(group)));
    }}finally{view.dispose();}
    expect(signatures).toEqual(report.examples.elmwood.replay.geometrySha256ByStep);
    expect(view.created).toBe(view.disposed);
  },120000);

  it('restores the pilot growth hooks on failure',()=>{
    const add=h.Crystal.prototype.add_zone;
    h.setSeed(42);const scenario=h.SCENARIOS.elmwood(),sim=new h.VugSimulator(scenario.conditions,scenario.events);
    const nuc=sim.nucleate;sim.run_step=()=>{throw Error('deliberate stopped growth');};
    const writer=new CalciteAuthorityWriter(kernelFor(h),{kind:'failure-fixture'});
    expect(()=>recordCalciteSteps(h,sim,writer,1,{})).toThrow(/deliberate/);
    expect(h.Crystal.prototype.add_zone).toBe(add);expect(sim.nucleate).toBe(nuc);
    expect(Object.hasOwn(sim,'nucleate')).toBe(false);
  });

  it('preserves a later zone mutation as an unresolved overprint instead of rewriting its formation',()=>{
    const original=fixture(),writer=new CalciteAuthorityWriter(kernelFor(h),original.model);
    for(const f of original.frames){
      for(const e of original.events.filter((e:any)=>e.step===f.step)){
        if(e.kind==='nucleation')writer.nucleate(e.origin);else writer.acceptZone(e);
      }
      const input=clone({surface:f.surface,allCalcite:f.allCalcite});
      if(f.step>=4){
        input.allCalcite[0].zones[0].trace_Mn=.99;
        input.surface.crystals[0].facts.zones[0].trace_Mn=.99;
      }
      // The compiler accepts raw captured facts, never a render-frame wrapper.
      writer.captureStep({surface:{step:f.step,source:input.surface.source,
        crystals:input.surface.crystals.map((c:any)=>c.facts)},allCalcite:input.allCalcite});
    }
    const s=loadCalciteSpecimen(saveCalciteSpecimen(writer.specimen()));
    expect(s.events.find((e:any)=>e.id===1&&e.kind==='growth').zone.trace_Mn).toBe(.01);
    expect(s.events.filter((e:any)=>e.kind==='zone-overprint')).toHaveLength(1);
    expect(s.frames[0].allCalcite[0].zones[0].trace_Mn).toBe(.01);
    expect(calciteProductionGate(s).reasons).toContain('later zone mutations require explicit modeled causes');
  });

  it('rejects open/duplicated surfaces and falsified conversion factors on load',()=>{
    for(const edit of [
      (c:any)=>c.completion.poly.faces.pop(),
      (c:any)=>c.completion.poly.faces.push(c.completion.poly.faces[0]),
      (c:any)=>{c.completion.volumeAudit.fullToBooked*=2;},
      (c:any)=>{c.completion.volumeAudit.contactRetention=1.5;},
    ]){
      const s=clone(fixture());edit(s.frames[0].surface.crystals[0]);
      expect(()=>loadCalciteSpecimen(JSON.stringify(s))).toThrow();
    }
  });

  it('rejects false regrowth claims and dimensions inconsistent with the accepted event',()=>{
    for(const edit of [
      (s:any)=>{s.events[1].kind='regrowth';},
      (s:any)=>{s.events.find((e:any)=>e.id===1&&e.step===2).before.aWidthMm*=2;},
      (s:any)=>{
        s.frames[0].allCalcite[0].cLengthMm*=2;
        s.frames[0].surface.crystals[0].facts.cLengthMm*=2;
      },
    ]){
      const s=clone(fixture());edit(s);expect(()=>loadCalciteSpecimen(JSON.stringify(s))).toThrow();
    }
  });

  it('binds the complete fleet census to current source and counts unsupported calcite honestly',()=>{
    const census=JSON.parse(fs.readFileSync('pilots/calcite/volume-census.json','utf8'));
    const baseline=JSON.parse(fs.readFileSync(`tests-js/baselines/seed42_v${h.SIM_VERSION}.json`,'utf8'));
    expect(census.scenarios.map((s:any)=>s.scenario)).toEqual(Object.keys(baseline).sort());
    expect(census.seed).toBe(42);expect(census.simVersion).toBe(h.SIM_VERSION);
    expect(census.runtimeDigest).toBe(runtimeExecutionDigest(process.cwd()));
    for(const [file,digest] of Object.entries(census.sourceHashes)){
      const actual=createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
      expect(actual,file).toBe(digest);
    }
    for(const s of census.scenarios){
      const authored=h.SCENARIOS[s.scenario]();
      expect(s.steps).toBe(authored.defaultSteps??120);
      expect(s.wulffCalcite).toBe(!!authored.conditions.wall.wulff_calcite);
      expect(s.observationDidNotMutate).toBe(true);
      expect(s.eligibleCount+s.excluded.length).toBe(s.calciteCount);
      expect(s.crystals).toHaveLength(s.eligibleCount);
      for(const frame of [{crystals:s.crystals,step:s.steps},...s.historical]){
        expect(frame.error).toBeUndefined();expect(frame.step).toBeLessThanOrEqual(s.steps);
        for(const c of frame.crystals){
          expect(c.error).toBeUndefined();
          const converted=c.bookedVolumeMm3*c.fullToBooked*c.attachmentRetention*c.contactRetention;
          expect(Math.abs(converted-c.completedVolumeMm3)).toBeLessThanOrEqual(Math.max(1e-10,c.completedVolumeMm3*1e-8));
          expect(c.attachmentRetention).toBeLessThanOrEqual(1+1e-8);
          expect(c.contactRetention).toBeLessThanOrEqual(1+1e-8);
        }
      }
    }
  });

  it('splits the full-form ratio using an analytic geometric reference, without changing mass',()=>{
    // A box is a geometry-only arithmetic oracle, not a proposed calcite habit.
    const planes=[{n:[1,0,0],d:1},{n:[-1,0,0],d:1},{n:[0,1,0],d:2},
      {n:[0,-1,0],d:2},{n:[0,0,1],d:3},{n:[0,0,-1],d:3}];
    const facts={axis:[0,1,0],yaw:0,cLengthMm:4,aWidthMm:2,bookedVolumeMm3:8*Math.PI/3};
    const saved=JSON.stringify(facts),r=boundingReference(facts,planes,h.wulffPolyhedron);
    expect(r.fullVolumeMm3).toBeCloseTo(48,12);
    expect(r.boundingEllipsoidMm3).toBeCloseTo(8*Math.PI,12);
    expect(r.boundingToBooked).toBeCloseTo(3,12);
    expect(r.polyhedronToBounding).toBeCloseTo(6/Math.PI,12);
    expect(r.boundingToBooked*r.polyhedronToBounding).toBeCloseTo(48/facts.bookedVolumeMm3,12);
    expect(JSON.stringify(facts)).toBe(saved);
  });

  it('measures the reference in the saved crystal frame, independent of world translation/rotation',()=>{
    const t=[300,-10,20],rotate=(v:number[])=>[-v[1],v[0],v[2]];
    const planes=[{n:[1,0,0],d:1},{n:[-1,0,0],d:1},{n:[0,1,0],d:2},
      {n:[0,-1,0],d:2},{n:[0,0,1],d:3},{n:[0,0,-1],d:3}].map(p=>{
      const n=rotate(p.n);return {n,d:p.d+n.reduce((s,x,i)=>s+x*t[i],0)};
    });
    const r=boundingReference({axis:[-1,0,0],yaw:0,cLengthMm:4,aWidthMm:2,bookedVolumeMm3:8*Math.PI/3},planes,h.wulffPolyhedron);
    expect(r.extentsMm.a).toBeCloseTo(2,10);expect(r.extentsMm.c).toBeCloseTo(4,10);expect(r.extentsMm.b).toBeCloseTo(6,10);
    expect(r.fullVolumeMm3).toBeCloseTo(48,10);expect(r.boundingToBooked).toBeCloseTo(3,10);
  });

  it('audits actual saved planes and identifies fixture contact/dissolution/regrowth coverage',()=>{
    const s=fixture(),before=JSON.stringify(s),audit=auditSpecimenFactors(s,h.wulffPolyhedron);
    expect(audit.supportedCrystalSteps).toBe(9);
    expect(audit.habits).toEqual(['rhombohedral']);
    expect(audit.phaseCounts).toEqual({growth:5,dissolution:2,regrowth:2});
    expect(audit.contactFaceSamples).toBe(8);
    expect(auditSpecimenFactors(loadCalciteSpecimen(saveCalciteSpecimen(s)),h.wulffPolyhedron)).toEqual(audit);
    expect(JSON.stringify(s)).toBe(before);
    const mutable=clone(s);auditSpecimenFactors(mutable,h.wulffPolyhedron);
    expect(Object.isFrozen(mutable.model)).toBe(false);
  });

  it('detects mutually compensating volume-factor errors by independently intersecting saved planes',()=>{
    const s=clone(fixture()),a=s.frames[0].surface.crystals[0].completion.volumeAudit;
    a.fullVolumeMm3*=2;a.fullToBooked*=2;a.attachmentRetention/=2;
    // The product still closes. Preserved planes provide the independent check.
    const loaded=loadCalciteSpecimen(JSON.stringify(s));
    expect(()=>auditSpecimenFactors(loaded,h.wulffPolyhedron)).toThrow(/Preserved-plane volume disagreement/);
  });

  it('keeps missing fleet phase/topology information distinct from observed absence',()=>{
    const census=JSON.parse(fs.readFileSync('pilots/calcite/volume-census.json','utf8'));
    const coverage=fleetFactorCoverage(census);
    expect(coverage.supportedScenarios).toEqual(['mvt']);
    expect(coverage.supportedHabits).toEqual(['scalenohedral']);
    expect(coverage.contactVolumeLossSamples).toBe(0);
    expect(coverage.dissolutionAndRegrowth).toContain('unknown, not zero');
    expect(coverage.contactTopology).toContain('not captured');
    expect(coverage.supportedEndpoints+coverage.excludedEndpoints).toBe(coverage.endpointCalcites);
  });

  it('binds the factor report to its evidence and preserves the fixture/live distinction',()=>{
    const report=JSON.parse(fs.readFileSync('pilots/calcite/factor-coverage.json','utf8'));
    const census=JSON.parse(fs.readFileSync('pilots/calcite/volume-census.json','utf8'));
    expect(report.fleet).toEqual(fleetFactorCoverage(census));expect(report.productionHeld).toBe(true);
    for(const [file,expected] of Object.entries({...report.sourceHashes,...report.examples.elmwood.audit.model.sourceHashes})){
      expect(createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex'),file).toBe(expected);
    }
    expect(createHash('sha256').update(fs.readFileSync('pilots/calcite/volume-census.json','utf8').replaceAll('\r\n','\n')).digest('hex')).toBe(report.fleetReceiptSha256);
    expect(report.examples.controlled.audit).toEqual(auditSpecimenFactors(fixture(),h.wulffPolyhedron));
    expect(report.examples.controlled.specimenSha256).toBe(hash(fixture()));
    expect(report.examples.controlled.sourceClass).toContain('authored');
    expect(report.examples.elmwood.sourceClass).toContain('explicit Wulff override');
    expect(report.examples.elmwood.audit.phaseCounts.dissolution).toBe(0);
    expect(report.examples.elmwood.audit.phaseCounts.regrowth).toBe(0);
    const golden=JSON.parse(fs.readFileSync('pilots/calcite/golden.json','utf8'));
    expect(report.examples.controlled.replay.geometrySha256ByStep).toEqual(golden.geometrySha256ByStep);
    for(const e of Object.values(report.examples) as any[]){expect(e.productionGate.allowed).toBe(false);expect(e.replay.allResourcesDisposed).toBe(true);}
  });
});
