// Selective quartz persistence only. No R7 surface/enclosure-history migration.
interface StripQuartzFormTestimony {
  schema: 'strip-quartz-form-observations-v1';
  crystal_id: number | string; captured_step: number; sample_index: number;
  nucleation_step?: number | null;
  zones: { zone_index: number; step: number }[];
  history: QuartzFormHistory;
}
const STRIP_QUARTZ_FORM_LIMITS = Object.freeze({rows:10_000,zonesPerRow:10_000,
  zoneWitnesses:500_000,bytes:32*1024*1024});
function stripValidateQuartzFormTestimony(value: unknown, sampleCount: number): void {
  if (!Array.isArray(value) || value.length > STRIP_QUARTZ_FORM_LIMITS.rows) throw new Error('strip: invalid quartz form testimony');
  const seen = new Set<number|string>(); let bytes=2,witnesses=0;
  try {
    for(let index=0;index<value.length;index++) {
      const row=_quartzFormValue(value,String(index));
      _quartzFormFields(row,['schema','crystal_id','captured_step','sample_index','nucleation_step','zones','history']);
      if(row.schema!=='strip-quartz-form-observations-v1'||!_quartzFormId(row.crystal_id)||seen.has(row.crystal_id)
        ||!_quartzFormStep(row.captured_step)||!_quartzFormStep(row.sample_index)||row.sample_index>=sampleCount
        ||!Array.isArray(row.zones)||row.zones.length>STRIP_QUARTZ_FORM_LIMITS.zonesPerRow) throw new Error('record coordinates');
      seen.add(row.crystal_id);witnesses+=row.zones.length;
      if(witnesses>STRIP_QUARTZ_FORM_LIMITS.zoneWitnesses) throw new Error('aggregate zone bound');
      for(let i=0;i<row.zones.length;i++) {
        const z=_quartzFormValue(row.zones,String(i));_quartzFormFields(z,['zone_index','step']);
        if(z.zone_index!==i||!_quartzFormStep(z.step)||z.step>row.captured_step) throw new Error('zone witness');
      }
      const h=row.history;
      if(!validateQuartzFormHistory(h,row.zones)||h.source_crystal_id!==row.crystal_id
        ||row.zones.length!==(h.observed_zone_count??0)
        ||(h.observed_through_step!==null&&h.observed_through_step>row.captured_step)
        ||(h.unavailable&&h.unavailable.step>row.captured_step)
        ||(!h.unavailable&&h.observed_through_step!==row.captured_step)) throw new Error('ledger coverage');
      quartzFormAssertKnownBirth(h,row.nucleation_step);
      bytes+=_quartzFormEncoder.encode(JSON.stringify(row)).length+(index?1:0);
      if(bytes>STRIP_QUARTZ_FORM_LIMITS.bytes) throw new Error('aggregate byte bound');
    }
  } catch {throw new Error('strip: invalid or oversized quartz form history');}
}

const COLLECTION_QUARTZ_FORM_SCHEMA='collection-quartz-form-v1';
function collectionQuartzFormForPersistence(crystal:any):any {
  const history=quartzFormHistoryForPersistence(crystal);
  if(history===undefined)return undefined;
  return _quartzFormFreeze({schema:COLLECTION_QUARTZ_FORM_SCHEMA,history,
    source:{crystal_id:history.source_crystal_id,
      cdr_replaces_crystal_id:crystal.cdr_replaces_crystal_id??null}});
}
function assertCollectionQuartzForm(record:any):void {
  if(record.quartz_form===undefined)return; // Old records stay old; no backfill.
  const form=record.quartz_form;
  _quartzFormFields(form,['schema','history','source']);
  _quartzFormFields(form.source,['crystal_id','cdr_replaces_crystal_id']);
  if(form.schema!==COLLECTION_QUARTZ_FORM_SCHEMA
    ||!Array.isArray(record.zones)||!validateQuartzFormHistory(form.history,record.zones)
    ||form.history.source_crystal_id!==form.source.crystal_id
    ||(form.source.cdr_replaces_crystal_id!==null&&!_quartzFormId(form.source.cdr_replaces_crystal_id))) throw new Error('Library has invalid quartz form history');
  const h=form.history;quartzFormAssertKnownBirth(h,record.source?.nucleation_step);
  if(h.unavailable)return; // Preserve the accepted prefix despite later state.
  const last=h.changes.length?h.changes[h.changes.length-1]:h.initial,s=last?.snapshot;
  if(!s||record.mineral!=='quartz'||h.observed_zone_count!==record.zones.length||(s.habit||'')!==record.habit
    ||!_quartzFormEqual(s.dominant_forms||[],record.forms||[])||!!s.twinned!==record.twinned
    ||(s.twin_law||null)!==(record.twin_law||null)) throw new Error('Library quartz form contradicts its current descriptor');
}
function restoreCollectionQuartzForm(stand:any,record:any):void {
  if(record.quartz_form===undefined)return;
  assertCollectionQuartzForm(record);
  const form=JSON.parse(JSON.stringify(record.quartz_form));
  Object.defineProperty(stand,'_quartzFormHistory',{value:_quartzFormFreeze(form.history),enumerable:false,writable:false,configurable:false});
  stand._collectionSourceHistory=_quartzFormFreeze(form.source);
}
