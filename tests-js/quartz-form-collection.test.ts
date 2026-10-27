import {describe,it,expect} from 'vitest';
declare const Crystal:any,GrowthZone:any,recordQuartzFormObservations:any;
declare const buildCrystalRecord:any,reconstructCrystalFromRecord:any,assertCrystalCollectionRecord:any;
declare const quartzFormObservationAtStep:any,quartzFormRenderProjection:any,quartzFormHistoryForPersistence:any;
declare const _saveSpecimenScienceDigest:any;
const copy=(x:any)=>JSON.parse(JSON.stringify(x));
function fixture(){
  const c=new Crystal({mineral:'quartz',crystal_id:37,habit:'prismatic',nucleation_step:1,nucleation_temp:300,growth_environment:'fluid'});
  const sim={step:1,crystals:[c]},meta={mode:'simulation',scenario:'quartz-control',seed:42};
  const add=(step:number,change:any={})=>{sim.step=step;Object.assign(c,change);
    c.add_zone(new GrowthZone({step,thickness_um:100,temperature:300,growth_rate:1,_time_scaled:true}));recordQuartzFormObservations(sim);};
  add(1);add(2,{habit:'doubly_terminated'});return {c,sim,meta,add};
}
describe('Quartz collection contract on the current Library and save schema',()=>{
  it('persists dated observations and source identity without resuming growth',()=>{
    const {c,meta}=fixture(),record=copy(buildCrystalRecord(c,meta));
    expect(assertCrystalCollectionRecord(record)).toBe(true);
    const stand=reconstructCrystalFromRecord(record);
    expect(stand.crystal_id).not.toBe(c.crystal_id);expect(stand.active).toBe(false);
    expect(stand._quartzFormHistory).toEqual(c._quartzFormHistory);
    expect(quartzFormObservationAtStep(stand,1)).toEqual(quartzFormObservationAtStep(c,1));
    expect(quartzFormRenderProjection(stand,stand,1)).toMatchObject({habit:'prismatic',_quartzFormRender:{status:'recorded-form-selection',source_crystal_id:37}});
    expect(quartzFormRenderProjection(stand,stand,2).habit).toBe('doubly_terminated');
    expect(Object.keys(stand)).not.toContain('_quartzFormHistory');
    expect(()=>{stand._quartzFormHistory.initial.snapshot.habit='forged';}).toThrow();
    expect(record.quartz_form.history).toEqual(c._quartzFormHistory);
  });
  it('retains an explicitly unknown suffix without borrowing later descriptors',()=>{
    const {c,sim,meta}=fixture();sim.step=4;recordQuartzFormObservations(sim);c.habit='unobserved-later-form';
    const stand=reconstructCrystalFromRecord(copy(buildCrystalRecord(c,meta)));
    expect(quartzFormObservationAtStep(stand,2).snapshot.habit).toBe('doubly_terminated');
    expect(quartzFormObservationAtStep(stand,3)).toMatchObject({status:'unavailable',reason:'observation-gap'});
  });
  it('preserves an earlier quartz prefix if the existing model changes mineral identity',()=>{
    const {c,sim,meta}=fixture();c.mineral='calcite';sim.step=3;recordQuartzFormObservations(sim);
    const record=copy(buildCrystalRecord(c,meta));expect(assertCrystalCollectionRecord(record)).toBe(true);
    const stand=reconstructCrystalFromRecord(record);expect(stand.mineral).toBe('calcite');
    expect(quartzFormRenderProjection(stand,stand,1)).toMatchObject({mineral:'quartz',habit:'prismatic'});
    expect(quartzFormObservationAtStep(stand,3)).toMatchObject({status:'unavailable',reason:'unsupported-mineral'});
  });
  it('reproduces old collection receipts through the explicit old producer',()=>{
    const {c,meta}=fixture(),old=buildCrystalRecord(c,meta,null),newRecord=buildCrystalRecord(c,meta);
    expect(old).not.toHaveProperty('quartz_form');expect(newRecord).toHaveProperty('quartz_form');
    const without={...newRecord};delete without.quartz_form;
    expect(_saveSpecimenScienceDigest(without)).toBe(_saveSpecimenScienceDigest(old));
    expect(_saveSpecimenScienceDigest(newRecord)).not.toBe(_saveSpecimenScienceDigest(old));
    expect(assertCrystalCollectionRecord(old)).toBe(true);
    const stand=reconstructCrystalFromRecord(copy(old));
    expect(quartzFormObservationAtStep(stand,1).status).toBe('unavailable');
    expect(quartzFormRenderProjection(stand,stand,1)._quartzFormRender.status).toBe('legacy-current-form');
  });
  it.each([
    (r:any)=>{r.quartz_form.history.source_crystal_id=99;},
    (r:any)=>{r.quartz_form.history.initial.snapshot.habit='forged';r.quartz_form.history.changes[0].snapshot.habit='forged';},
    (r:any)=>{r.quartz_form.history.observed_zone_count=1000;},
    (r:any)=>{r.source.nucleation_step=20;},
    (r:any)=>{r.quartz_form.extra='unknown';},
    (r:any)=>{r.mineral='calcite';},
  ])('refuses malformed or contradictory quartz observations (%#)',mutate=>{
    const {c,meta}=fixture(),record=copy(buildCrystalRecord(c,meta));mutate(record);
    expect(()=>assertCrystalCollectionRecord(record)).toThrow();
    expect(()=>reconstructCrystalFromRecord(record)).toThrow();
  });
  it('does not observe at save time and refuses an unobserved live mutation',()=>{
    const {c,meta}=fixture(),before=c._quartzFormHistory;c.habit='unobserved';
    expect(()=>buildCrystalRecord(c,meta)).toThrow('final observation contradicts');
    expect(c._quartzFormHistory).toBe(before);expect(()=>quartzFormHistoryForPersistence(c)).toThrow();
  });
  it('leaves unrelated minerals and old records in their existing producer schema',()=>{
    const {meta}=fixture(),c=new Crystal({mineral:'calcite',crystal_id:6,nucleation_temp:150});
    c.add_zone(new GrowthZone({step:1,thickness_um:100,temperature:150,growth_rate:1,_time_scaled:true}));
    expect(buildCrystalRecord(c,meta)).not.toHaveProperty('quartz_form');
    expect(()=>buildCrystalRecord(c,meta,'invented-schema')).toThrow();
  });
});
