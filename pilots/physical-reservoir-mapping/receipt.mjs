// Producer for this analytical control only; never rebakes production evidence.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mapPhysicalControl,compareLegacyWallReference,iapwsReferenceDensity} from './mapping.mjs';
import {buildSourceAudit,inspectLegacyWallReference} from '../finite-reservoir-authority/audit.mjs';
import {loadSimBundle} from '../../tools/_harness.mjs';
const ROOT='pilots/physical-reservoir-mapping/';
const read=name=>JSON.parse(fs.readFileSync(ROOT+name,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
const SOURCE_FILES=['mapping.mjs','source-evidence.json','control.json','reference.py','reference.json','receipt.mjs'];

export function buildPhysicalMappingReceipt(h){
  const audit=buildSourceAudit(),input=read('control.json'),sources=read('source-evidence.json'),reference=read('reference.json');
  const record=mapPhysicalControl(input);
  const densityVerification=sources.water.verification.map(([temperatureK,publishedKgM3])=>{
    const computedKgM3=iapwsReferenceDensity(temperatureK),residualKgM3=computedKgM3-publishedKgM3;
    assert.ok(Math.abs(residualKgM3)<=sources.water.verificationRoundingToleranceKgM3,'IAPWS published verification point');
    return {temperatureK,publishedKgM3,computedKgM3,residualKgM3,
      toleranceKgM3:sources.water.verificationRoundingToleranceKgM3,
      scope:'computer-program verification; 260 K and 375 K are metastable liquid, not control conditions'};
  });
  const values={densityKgM3:record.densityKgM3,waterVolumeMm3:record.closure.waterVolumeMm3.actual,
    wallVolumeMm3:record.closure.wallVolumeMm3.actual,waterKg:record.compiled.totals.waterKg,calciteMol:record.compiled.totals.calciteMol};
  const decimalComparison=Object.fromEntries(Object.entries(values).map(([key,actual])=>{
    const expected=Number(reference[key]),residual=actual-expected,tolerance=64*Number.EPSILON*Math.abs(expected);
    assert.ok(Math.abs(residual)<=tolerance,'Decimal global witness: '+key);
    return [key,{expected,actual,residual,tolerance}];
  }));
  h.setSeed(42);
  const wall=new h.VugWall({composition:'limestone',vug_diameter_mm:2*input.cavityRadius.value,thickness_mm:input.wallThickness.value});
  const before=JSON.stringify(wall);
  const legacy={...inspectLegacyWallReference(wall),nominalCavityRadiusMm:wall.vug_diameter_mm/2,remainingThicknessMm:wall.thickness_mm};
  const discrepancy=compareLegacyWallReference(record,legacy);
  assert.equal(JSON.stringify(wall),before,'Legacy wall must not be changed');
  const partitions=[[1,1,1],[4,8,2],[8,16,4]].map(([rings,cellsPerRing,depths])=>{
    const variant=structuredClone(input);
    variant.partition={rings,cellsPerRing,radialEdgesMm:Array.from({length:depths+1},(_,i)=>input.cavityRadius.value*(1-i/depths))};
    const mapped=mapPhysicalControl(variant);
    for(const field of ['waterKg','calciteMol']){
      assert.ok(Math.abs(mapped.compiled.totals[field]-record.compiled.totals[field])
        <=64*Number.EPSILON*Math.abs(record.compiled.totals[field]),'Partition changes '+field);
    }
    return {rings,cellsPerRing,depths,cells:mapped.cells.length,waterKg:mapped.compiled.totals.waterKg,
      calciteMol:mapped.compiled.totals.calciteMol,closure:mapped.closure,recordDigest:mapped.recordDigest};
  });
  assert.equal(h.cavityMolarVolume('calcite',26,0.001).value_cm3_mol,record.molarVolumeCm3Mol,
    'Existing calcite reference value must not be silently changed');
  return {schema:'vugg-physical-reservoir-mapping-receipt-v1',base:'ba0204ddba27067146d28ba5d53dbb6c15943788',
    runtime:audit.runtime,productionExecutionDigest:audit.productionExecutionDigest,
    registeredProducerContractsUnchanged:audit.registeredProducerContractsUnchanged,
    productionSourceHashes:audit.sourceHashes,
    sourceHashes:Object.fromEntries(SOURCE_FILES.map(f=>[ROOT+f,hash(ROOT+f)])),
    scope:'one analytical initialization control; no legacy or fleet growth replay, physical scenario migration, reactions, or transport',
    densityVerification,decimalComparison,recordDigest:record.recordDigest,uncertainty:record.uncertainty,
    partitions,legacyReference:legacy,legacyInspectionDidNotMutate:true,discrepancy,
    productionAllowed:false,legacyPhysicalMapping:false,reactions:false,transport:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const result=buildPhysicalMappingReceipt(await loadSimBundle({toolName:'physical-reservoir-control',extraExports:['VugWall','cavityMolarVolume']}));
  const text=JSON.stringify(result,null,2)+'\n',output=ROOT+'receipt.json';
  if(process.argv.includes('--write'))fs.writeFileSync(output,text);
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8').replaceAll('\r\n','\n'),text,'Physical mapping receipt is stale');
  console.log(JSON.stringify({waterKg:result.discrepancy.physicalWaterKg,calciteMol:result.discrepancy.physicalCalciteMol,
    physicalToHypotheticalStockRatio:result.discrepancy.physicalToHypotheticalStockRatio,productionAllowed:false}));
}
