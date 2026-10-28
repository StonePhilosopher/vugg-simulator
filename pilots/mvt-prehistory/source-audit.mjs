// Read the actual authoring boundary; do not invent its physical prehistory.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseScenarioDocument} from '../../tools/scenario-authoring.mjs';

const lfHash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
export function auditMvtPrehistory(){
  const {scenarios}=parseScenarioDocument(fs.readFileSync('data/scenarios.json5','utf8'));
  const mvt=scenarios.mvt;
  if(!mvt||mvt.initial?.wall?.composition!=='limestone')throw Error('Pinned MVT authoring boundary changed; fresh authority audit required');
  const preflight=JSON.parse(fs.readFileSync('pilots/reservoir-reference-preflight/receipt.json','utf8'));
  const chronology=id=>scenarios[id].events.map(e=>({step:e.step,type:e.type,name:e.name}));
  const missing=[
    'physical host phase/material geometry and alteration provenance',
    'void-formation material-removal history; procedural shape is not that history',
    'named fluid parcel volumes and commissioned solvent/solution-volume relation',
    'complete source analytical inventories and a mixed-fluid volume model',
    'physical feeder connection and isolation event provenance',
    'physical wet-cell allocation and accessible phase stock from that history'];
  return {schema:'vugg-mvt-prehistory-source-audit-v1',scenario:'mvt',base:'576a6ceeb81f590618d4974a30612bf9c5177d1d',
    sourceHashes:Object.fromEntries(['data/scenarios.json5','js/20a-chemistry-activity.ts','js/22-geometry-wall.ts',
      'js/85k-fluid-spots.ts','pilots/reservoir-reference-preflight/receipt.json'].map(f=>[f,lfHash(f)])),
    known:{authoredHostProxy:mvt.initial.wall.composition,authoredShapeSeed:mvt.initial.wall.shape_seed,
      publishedScientificVoidVolumeMm3:preflight.record.observation.volumeMm3,
      geometryProvenance:'previously verified procedural scientific cavity; no prior material-removal history is fabricated',
      initialTemperatureC:mvt.initial.temperature_C,initialPressureKbar:mvt.initial.pressure_kbar,
      authoredFluid:mvt.initial.fluid,events:chronology('mvt'),
      mixingBoundary:mvt.events.find(e=>e.type==='mvt_fluid_mixing'),
      salinityMeaning:'NaCl-equivalent per-mille proxy used by water activity; not complete brine composition or density'},
    differentScenarioPrecedents:{reactiveWall:{scenario:'reactive_wall',hostProxy:scenarios.reactive_wall.initial.wall.composition,
      events:chronology('reactive_wall'),meaning:'contains an authored seal; its physical quantities/history are not transferred to Tri-State'},
      reactivatedVein:{scenario:'reactivated_fluorite_vein',events:chronology('reactivated_fluorite_vein'),
        meaning:'separate North Pennine-style demonstrator; its seal/reopen chronology is not a Tri-State event history'}},
    primaryQualitativeSupport:[
      {url:'https://www.kgs.ku.edu/Publications/pic17/pic17_2.html',scope:'Tri-State cherty limestone and resistant residual chert; no quantitative phase map or pore-scale fluid inventory'},
      {url:'https://pubs.usgs.gov/publication/sir20105070A',scope:'general MVT deposit framework; not this specimen prehistory or a numerical fluid recipe'}],
    missingAuthority:missing,connectedPhysicalSnapshot:null,sealedPhysicalSnapshot:null,
    physicalPrehistoryCommissioned:false,productionMappingAllowed:false};
}
export function requireMvtPhysicalPrehistory(){
  const audit=auditMvtPrehistory();
  throw Error('MVT physical prehistory HOLD: '+audit.missingAuthority.join('; '));
}
