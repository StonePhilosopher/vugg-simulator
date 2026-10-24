import { describe, expect, it } from 'vitest';
declare const Crystal: any, GrowthZone: any, VugSimulator: any, SCENARIOS: any;
declare const recordQuartzFormObservations: any, quartzFormObservationAtStep: any, validateQuartzFormHistory: any;
declare const _snapshotEngineCrystalState: any, _stageAndRestoreEngineCrystalMutations: any;
declare const _runEngineFluidTransaction: any, _applyAcceptedCrystalMutations: any;
declare const classifyQuartzSceptre: any, classifyQuartzGwindel: any, _simulationCrystalProjection: any;
declare const simulationStateFingerprint: any, setSeed: any;
declare const QUARTZ_FORM_HISTORY_LIMITS: any;
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const crystal = (id=1) => new Crystal({mineral:'quartz',crystal_id:id,nucleation_step:0,habit:'prismatic'});
const observe = (c:any, step:number, sim:any={crystals:[c]}) => {sim.step=step;recordQuartzFormObservations(sim);return sim;};
const zone = (c:any, step:number, thickness:number) => c.add_zone(new GrowthZone({step,thickness_um:thickness,_time_scaled:true}));

describe('quartz finalized form observations — recorder A', () => {
  it('records only finalized observations and extends unchanged coverage without new snapshots', () => {
    const c=crystal(), sim=observe(c,4); const initial=c._quartzFormHistory.initial;
    observe(c,5,sim);observe(c,5,sim);
    expect(c._quartzFormHistory).toMatchObject({initial,changes:[],observed_through_step:5});
    expect(quartzFormObservationAtStep(c,3).status).toBe('unavailable');
    expect(quartzFormObservationAtStep(c,6).status).toBe('unavailable');
    expect(quartzFormObservationAtStep(c,5)).toMatchObject({status:'recorded',observation_step:4});
    expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
  });
  it('preserves null, absence, removals, twin state and zero-growth scope changes without borrowing live values', () => {
    const c=crystal(), sim=observe(c,1), first=clone(quartzFormObservationAtStep(c,1));
    c.twinned=true;c.twin_law='Dauphiné (thermal stress)';c._polymorph='beta';c.mineral_display='model label';
    c._gwindel=null;c._split={index:.2};c._surfaceGrowth={arbitrary:'scope witness only'};c.growth_environment='air';
    observe(c,2,sim);
    c._polymorph=null;delete c.mineral_display;delete c._gwindel;c._split=null;delete c._surfaceGrowth;
    c.dominant_forms.push('{101}');observe(c,3,sim);
    const second=quartzFormObservationAtStep(c,2).snapshot, third=quartzFormObservationAtStep(c,3).snapshot;
    expect(second).toMatchObject({twinned:true,twin_law:c.twin_law,_gwindel:null,split_presence:'present',surface_growth_presence:'present',growth_environment:'air'});
    expect(third).toMatchObject({_polymorph:null,split_presence:'null',surface_growth_presence:'absent'});
    expect(third).not.toHaveProperty('mineral_display');expect(third).not.toHaveProperty('_gwindel');
    expect(first).toEqual(quartzFormObservationAtStep(c,1));
    expect(c._quartzFormHistory.initial.snapshot.dominant_forms).toEqual([]);
    expect(()=>c._quartzFormHistory.initial.snapshot.dominant_forms.push('mutated')).toThrow();
    expect(()=>{c._quartzFormHistory={};}).toThrow();
  });
  it('records actual sceptre qualification at observation time, and moving gwindel winners including null removal', () => {
    const a=crystal(1), b=crystal(2), sim:any={step:1,crystals:[a,b],conditions:{wall:{alpine_cleft:true}}};
    zone(a,1,600);zone(a,2,-100);zone(a,3,250);zone(a,4,250);
    // Producer qualification occurs after the underlying boundary; it must not be backdated.
    classifyQuartzSceptre(sim);expect(a._sceptre).toMatchObject({route:'corrosion'});
    observe(a,4,sim);expect(a._quartzFormHistory.initial.step).toBe(4);
    expect(a._quartzFormHistory.initial.snapshot._sceptre).toEqual(a._sceptre);
    zone(a,5,1000);classifyQuartzGwindel(sim);observe(a,5,sim);
    const oldWinner=clone(quartzFormObservationAtStep(a,5));
    zone(b,6,4000);classifyQuartzGwindel(sim);observe(a,6,sim);
    expect(quartzFormObservationAtStep(a,6).snapshot._gwindel).toBeNull();
    expect(quartzFormObservationAtStep(b,6).snapshot._gwindel).toEqual(b._gwindel);
    expect(quartzFormObservationAtStep(a,5)).toEqual(oldWinner);
  });
  it('closes gaps, changed duplicate observations, ownership identity and unsupported re-entry', () => {
    for (const [kind, change, step] of [
      ['observation-gap',(c:any)=>{c.habit='late';},4],
      ['conflicting-observation',(c:any)=>{c.twinned=true;},2],
      ['identity-change',(c:any)=>{c.crystal_id=99;},3],
      ['unsupported-mineral',(c:any)=>{c.mineral='chalcedony';},3],
      ['out-of-order',(_c:any)=>{},1],
    ] as any[]) {
      const c=crystal(),sim=observe(c,2), initial=c._quartzFormHistory.initial;
      change(c);observe(c,step,sim);
      expect(c._quartzFormHistory.initial).toBe(initial);
      expect(c._quartzFormHistory.unavailable.reason).toBe(kind);
      expect(c._quartzFormHistory.observed_through_step).toBe(2);
      c.mineral='quartz';observe(c,5,sim);expect(c._quartzFormHistory.observed_through_step).toBe(2);
      expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
    }
  });
  it('keeps earlier coverage when a duplicate finalized step appends another zone', () => {
    const c=crystal(),sim=observe(c,1);zone(c,2,20);observe(c,2,sim);zone(c,2,10);observe(c,2,sim);
    expect(c._quartzFormHistory.unavailable.reason).toBe('conflicting-observation');
    expect(quartzFormObservationAtStep(c,1).status).toBe('recorded');
    expect(quartzFormObservationAtStep(c,2).status).toBe('unavailable');
  });
  it('retains explicit failed first observations and isolates descriptor/accessor failures to one crystal', () => {
    const a=crystal(1), b=crystal(2), sim:any={step:1,crystals:[a,b]};let getterCalls=0;
    Object.defineProperty(a,'habit',{get(){getterCalls++;throw Error('not data');},configurable:true});
    expect(()=>recordQuartzFormObservations(sim)).not.toThrow();
    expect(getterCalls).toBe(0);expect(a._quartzFormHistory).toMatchObject({initial:null,observed_through_step:null,unavailable:{reason:'invalid-descriptor'}});
    expect(validateQuartzFormHistory(a._quartzFormHistory,a.zones)).toBe(true);
    expect(b._quartzFormHistory.observed_through_step).toBe(1);
    Object.defineProperty(a,'habit',{value:'fixed',writable:true});observe(a,2,sim);
    expect(a._quartzFormHistory.initial).toBeNull();
    b._sceptre={boundaryStep:1,stemUm:1,capUm:1,capFrac:NaN,route:'corrosion'};
    observe(b,3,sim);expect(b._quartzFormHistory.unavailable.reason).toBe('invalid-descriptor');
  });
  it('closes both duplicate identities rather than attributing two crystals to one source', () => {
    const a=crystal(), b=crystal();observe(a,1,{crystals:[a,b]});
    expect(a._quartzFormHistory.unavailable.reason).toBe('duplicate-identity');
    expect(b._quartzFormHistory.unavailable.reason).toBe('duplicate-identity');
  });
  it('closes history when a crystal object moves into another run', () => {
    const c=crystal();observe(c,1);observe(c,2,{crystals:[c]});
    expect(c._quartzFormHistory.unavailable).toEqual({reason:'run-change',step:2});
    expect(quartzFormObservationAtStep(c,1).status).toBe('recorded');
    expect(quartzFormObservationAtStep(c,2).status).toBe('unavailable');
  });
  it('never invokes zone-entry or step accessors while observing', () => {
    for(const target of ['entry','step']) {
      const c=crystal(),sim=observe(c,1);let calls=0;zone(c,2,20);
      const getter={get(){calls++;throw Error('must not run');},configurable:true};
      if(target==='entry')Object.defineProperty(c.zones,'0',getter);
      else Object.defineProperty(c.zones[0],'step',getter);
      observe(c,2,sim);
      expect(calls).toBe(0);expect(c._quartzFormHistory.unavailable.reason).toBe('invalid-descriptor');
      expect(c._quartzFormHistory.observed_through_step).toBe(1);
      expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
      expect(quartzFormObservationAtStep(c,1).status).toBe('recorded');
      expect(calls).toBe(0);
    }
  });
  it('marks backdated zone additions unavailable from the first contradicted cursor', () => {
    const c=crystal(),sim=observe(c,1);observe(c,2,sim);zone(c,2,20);observe(c,3,sim);
    expect(c._quartzFormHistory.unavailable).toEqual({reason:'backdated-zone',step:2});
    expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
    expect(quartzFormObservationAtStep(c,1).status).toBe('recorded');
    expect(quartzFormObservationAtStep(c,2).status).toBe('unavailable');
  });
  it('latches failed first identities and attachment without executing getters or silently restarting', () => {
    for(const kind of ['identity','accessor','sealed','occupied']) {
      const c=crystal();let calls=0;
      if(kind==='identity')c.crystal_id=NaN;
      if(kind==='accessor')Object.defineProperty(c,'crystal_id',{get(){calls++;return 1;},configurable:true});
      if(kind==='sealed')Object.seal(c);
      if(kind==='occupied')c._quartzFormHistory={forged:true};
      const sim=observe(c,1), first=quartzFormObservationAtStep(c,1);
      expect(calls).toBe(0);expect(first).toMatchObject({status:'unavailable',unavailable_step:1});
      expect(first.reason).toBe(kind==='identity'?'invalid-identity':kind==='accessor'?'invalid-descriptor':'history-attachment');
      if(kind==='accessor')Object.defineProperty(c,'crystal_id',{value:1,writable:true});
      else if(kind==='identity')c.crystal_id=1;
      observe(c,2,sim);expect(quartzFormObservationAtStep(c,2)).toEqual(first);
    }
  });
  it('keeps history out of engine snapshots and records no rejected candidate twin/habit change', () => {
    const c=crystal(), sim=observe(c,1), before=_snapshotEngineCrystalState(c), ledger=c._quartzFormHistory;
    expect(Object.keys(c)).not.toContain('_quartzFormHistory');expect(before).not.toHaveProperty('_quartzFormHistory');
    const conditions={fluid:{Si:10}};
    const z=_runEngineFluidTransaction((target:any)=>{target.twinned=true;target.habit='candidate';return {thickness_um:2};},c,conditions,2);
    z.thickness_um=0;_applyAcceptedCrystalMutations(c,z);observe(c,2,sim);
    expect(c.twinned).toBe(false);expect(c.habit).toBe('prismatic');expect(c._quartzFormHistory.changes).toEqual([]);
    expect(_stageAndRestoreEngineCrystalMutations(c,before)).toEqual({});
    expect(ledger.initial).toBe(c._quartzFormHistory.initial);
    const stripped=clone(c);expect(_simulationCrystalProjection(c)).toEqual(_simulationCrystalProjection(stripped));
  });
  it('bounds changing record count and retained bytes with an unavailable suffix', () => {
    const c:any={mineral:'quartz',crystal_id:1,zones:[]},sim={crystals:[c]};
    for(let i=0;i<=QUARTZ_FORM_HISTORY_LIMITS.recordsPerCrystal;i++){c.habit=String(i);observe(c,i,sim);}
    expect(c._quartzFormHistory.unavailable.reason).toBe('record-limit');
    expect(c._quartzFormHistory.changes.length+1).toBe(QUARTZ_FORM_HISTORY_LIMITS.recordsPerCrystal);
    expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
    const b=crystal(2),other={crystals:[b]};b.dominant_forms=Array.from({length:16},()=> 'x'.repeat(200));
    for(let i=0;i<100;i++){b.habit=String(i);observe(b,i,other);}
    expect(b._quartzFormHistory.unavailable.reason).toBe('byte-limit');
    expect(b._quartzFormHistory.observed_through_step).toBeLessThan(99);
  });
  it('enforces snapshot and shared run byte limits independently of a per-crystal cap', () => {
    const oversized=crystal();oversized.dominant_forms=Array.from({length:32},()=> 'x'.repeat(256));
    observe(oversized,1);expect(oversized._quartzFormHistory.unavailable.reason).toBe('snapshot-limit');
    const crystals=Array.from({length:100},(_,i)=>crystal(i+1)),sim={crystals};
    for(const c of crystals)c.dominant_forms=Array.from({length:16},()=> 'x'.repeat(240));
    for(let step=0;step<50;step++){for(const c of crystals)c.habit=String(step);observe(crystals[0],step,sim);}
    let bytes=0,closed=0;
    for(const c of crystals) {
      const h=c._quartzFormHistory;
      const used=[h.initial,...h.changes].filter(Boolean).reduce((n,r)=>n+new TextEncoder().encode(JSON.stringify(r)).length,0);
      expect(used).toBeLessThan(QUARTZ_FORM_HISTORY_LIMITS.bytesPerCrystal);
      bytes+=used;if(h.unavailable){closed++;expect(h.unavailable.reason).toBe('byte-limit');}
      expect(validateQuartzFormHistory(h,c.zones)).toBe(true);
    }
    expect(closed).toBeGreaterThan(0);expect(bytes).toBeLessThanOrEqual(QUARTZ_FORM_HISTORY_LIMITS.bytesPerRun);
    expect(bytes).toBeGreaterThan(QUARTZ_FORM_HISTORY_LIMITS.bytesPerRun-8192);
  });
  it('rejects malformed/inconsistent imported diagnostic history without making it authenticated', () => {
    const c=crystal(),sim=observe(c,1);c.twinned=true;observe(c,2,sim);
    for(const alter of [
      (h:any)=>{h.initial.snapshot._gwindel={twistDeg:99,lengthUm:1,span:NaN};},
      (h:any)=>{h.changes[0].step=1;},(h:any)=>{h.observed_zone_count=999;},
      (h:any)=>{h.initial.snapshot.dominant_forms=['x'.repeat(257)];},
      (h:any)=>{h.changes[0].snapshot.extra='unrecognized';},
    ]) {const h=clone(c._quartzFormHistory);alter(h);expect(validateQuartzFormHistory(h,c.zones)).toBe(false);}
    const reordered=clone(c._quartzFormHistory);
    reordered.initial.snapshot=Object.fromEntries(Object.entries(reordered.initial.snapshot).reverse());
    expect(validateQuartzFormHistory(reordered,c.zones)).toBe(true);
  });
  it('observes production post-classifier values with no strip recorder attached', () => {
    setSeed(42);const {conditions,events}=SCENARIOS.grimsel_alpine_cleft();
    const sim=new VugSimulator(conditions,events);
    for(let i=0;i<30;i++)sim.run_step();
    expect(sim._stripRecorder).toBeFalsy();
    const quartz=sim.crystals.filter((c:any)=>c.mineral==='quartz');expect(quartz.length).toBeGreaterThan(0);
    for(const c of quartz) {
      expect(c._quartzFormHistory.observed_through_step).toBe(sim.step);
      expect(validateQuartzFormHistory(c._quartzFormHistory,c.zones)).toBe(true);
      const snap=quartzFormObservationAtStep(c,sim.step).snapshot;
      expect(snap.habit).toBe(c.habit);expect(snap.twinned).toBe(c.twinned);
      expect(snap._gwindel).toEqual(c._gwindel);expect(snap._sceptre).toEqual(c._sceptre);
    }
  });
});
