// Commission only this shared-history arithmetic control, never natural MVT.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildSourceAudit} from '../finite-reservoir-authority/audit.mjs';
import {canonicalJSON} from '../finite-reservoir-authority/contract.mjs';
import {controlInput,sharedEvents,controlCases,sealEvent,pulseEvent,reactionEvent,reopenEvent} from './control-fixture.mjs';
import {auditMvtPrehistory} from './source-audit.mjs';
import {prehistoryPrefix,serializePrehistory,restorePrehistory} from './history.mjs';

const ROOT='pilots/mvt-prehistory/';
const FILES=['history.mjs','transfer.mjs','control-fixture.mjs','source-audit.mjs','receipt.mjs','reference.py'];
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
const digest=x=>createHash('sha256').update(canonicalJSON(x)).digest('hex');
function summarize(x){return {recordDigest:x.recordDigest,modelDigest:x.modelDigest,eventIds:x.events.map(e=>e.id),
  host:{initialPhaseVolumesMm3:x.host.initialPhaseVolumesMm3,remainingPhaseVolumesMm3:x.host.remainingPhaseVolumesMm3,
    exportedPhaseVolumesMm3:x.host.exportedPhaseVolumesMm3,dissolvedCalciteMol:x.host.dissolvedCalciteMol,
    exposedSurfaces:x.host.exposedSurfaces.filter(p=>p.exposedFaceAreaMm2>0)},
  pore:x.pore,
  externalReservoirs:Object.fromEntries(Object.entries(x.externalReservoirs).map(([id,r])=>[id,{
    remainingVolumeMm3:r.remainingVolumeMm3,remainingWaterKg:r.remainingWaterKg,components:r.components}])),
  closure:x.closure};}

export function buildPrehistoryReceipt(){
  const authority=buildSourceAudit(),cases=controlCases();
  const {connected,sealed,sealedTransfer,connectedPulse,reopenedPulse}=cases;
  assert.deepEqual(prehistoryPrefix(sealed,sharedEvents().length),connected);
  assert.deepEqual(prehistoryPrefix(connectedPulse,sharedEvents().length),connected);
  for(const key of ['host','externalReservoirs'])assert.deepEqual(connected[key],sealed[key]);
  for(const key of ['waterKg','components','wetVolumeMm3'])assert.deepEqual(connected.pore[key],sealed.pore[key]);
  for(const x of Object.values(cases))assert.deepEqual(restorePrehistory(serializePrehistory(x)),x);
  assert.equal(sealedTransfer.pore.waterKg,sealed.pore.waterKg);
  assert.deepEqual(reopenedPulse.pore,connectedPulse.pore);
  const files=[...FILES.map(f=>ROOT+f),'tests-js/mvt-prehistory.test.ts','.github/workflows/ci.yml'];
  return {schema:'vugg-mvt-prehistory-control-receipt-v1',base:'576a6ceeb81f590618d4974a30612bf9c5177d1d',
    runtime:authority.runtime,productionExecutionDigest:authority.productionExecutionDigest,
    registeredProducerContractsUnchanged:authority.registeredProducerContractsUnchanged,
    productionSourceHashes:authority.sourceHashes,
    sourceHashes:Object.fromEntries(files.map(f=>[f,hash(f)])),
    scope:'authored mixed-host causal conservation control plus actual-MVT source-gap audit; no growth fleet, EOS, speciation or geological calibration',
    causes:{input:controlInput(),sharedEvents:sharedEvents(),seal:sealEvent(),pulse:pulseEvent(),
      prescribedTransfer:reactionEvent(),reopen:reopenEvent()},
    cases:Object.fromEntries(Object.entries(cases).map(([name,x])=>[name,summarize(x)])),
    boundaryProofs:{sharedPrefixDigest:connected.recordDigest,
      connectedMaterialDigest:digest({host:connected.host,water:connected.pore.waterKg,
        components:connected.pore.components,donors:connected.externalReservoirs}),
      sealedMaterialDigest:digest({host:sealed.host,water:sealed.pore.waterKg,
        components:sealed.pore.components,donors:sealed.externalReservoirs}),
      allCheckpointsReconstruct:true,connectedPulseConsumesNamedDonor:true,
      sealedTransferCreatesNoWater:true,reopenedPulseHasSameMaterialWithDifferentHistory:true},
    actualMvt:auditMvtPrehistory(),
    limitations:['material parcels are not the legacy fluid voxels',
      'authored component vectors are bookkeeping stimuli, not electroneutral commissioned brine/groundwater recipes',
      'source solvent/volume coefficients and additive parcel volumes are declared approximations, not a mixed-brine EOS',
      'external isolation/reopening has no cement or fracture-volume prediction',
      'reaction contact and whole-parcel extent are prescribed, not a wetting or rate law',
      'post-reaction solution volume, pressure, speciation and pH remain unresolved',
      'calcite molar volume retains the existing 26 C reference; no MVT temperature/pressure correction',
      'no legacy mass, erosion, grown-crystal or completed-surface mapping is supplied'],
    productionMappingAllowed:false,productionReactions:false,transport:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const result=buildPrehistoryReceipt(),serialized=JSON.stringify(result,null,2)+'\n',output=ROOT+'receipt.json';
  if(process.argv.includes('--write'))fs.writeFileSync(output,serialized);
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n'),serialized,
    'Shared MVT prehistory control receipt is stale');
  console.log(JSON.stringify({cases:Object.keys(result.cases),actualMvtMissing:result.actualMvt.missingAuthority,
    productionExecutionDigest:result.productionExecutionDigest,productionMappingAllowed:false}));
}
