// Boundary-independent arithmetic for prehistory controls. No production imports.
// Removing crystalline calcite is not, by itself, a bulk-host porosity,
// flooding, pressure, rate, or wall-recession model.
export const TRANSFER_SCHEMA='vugg-finite-calcite-transfer-v1';

function exact(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)
    ||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))
    throw Error(label+': complete explicit fields required');
}
function quantity(value,unit,label){
  exact(value,['value','unit'],label);
  if(value.unit!==unit||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<0)
    throw Error(label+': nonnegative finite '+unit+' required');
  return value.value;
}
function product(a,b){
  const value=a*b;
  if(!Number.isFinite(value)||(a!==0&&b!==0&&value===0))throw Error('Unrepresentable transfer product');
  return value===0?0:value;
}
function freeze(value){
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}

// A requested extent is an experiment input or the output of a separate
// reaction law. This operation only applies the named finite stock bound.
export function finiteCalciteTransfer(input){
  exact(input,['wallSourceId','owner','phase','requested','accessible','molarVolume','provenance'],'transfer');
  if(typeof input.wallSourceId!=='string'||!input.wallSourceId.trim()
    ||input.owner!=='wall-carbonate'||input.phase!=='calcite')
    throw Error('One named wall-carbonate calcite source required; grown crystals are separate');
  exact(input.provenance,['kind','reference'],'transfer provenance');
  if(!['authored-experiment','external-declaration'].includes(input.provenance.kind)
    ||typeof input.provenance.reference!=='string'||!input.provenance.reference.trim())
    throw Error('Explicit transfer provenance required');
  const requested=quantity(input.requested,'mol_CaCO3','requested calcite');
  const available=quantity(input.accessible,'mol_CaCO3','accessible wall calcite');
  const vm=quantity(input.molarVolume,'cm3_per_mol_CaCO3','crystalline molar volume');
  if(vm<=0)throw Error('Positive crystalline molar volume required');
  const accepted=Math.min(requested,available),remaining=available-accepted;
  if(accepted>0&&remaining===available)throw Error('Calcite debit is below representable stock resolution');
  // CaCO3(s) -> Ca analytical total + C(IV) analytical total + 2 eq alkalinity.
  // The carbon species, pH and reaction affinity are not selected here.
  const removedVolume=product(product(accepted,vm),1000);
  return freeze({schema:TRANSFER_SCHEMA,wallSourceId:input.wallSourceId,owner:input.owner,phase:input.phase,
    requestedMol:requested,availableMol:available,acceptedMol:accepted,remainingMol:remaining,
    unacceptedMol:requested-accepted,limitedByStock:requested>available,
    delta:{wallCalciteMol:accepted===0?0:-accepted,aqueousCalciumMol:accepted,aqueousDicMolC:accepted,
      aqueousAlkalinityEq:product(accepted,2),crystallineVolumeRemovedMm3:removedVolume,solventWaterKg:0},
    provenance:{...input.provenance},
    meaning:'stoichiometric finite-stock transfer; no equilibrium, kinetics, accessibility prediction or bulk-volume law',
    productionMappingAllowed:false,transport:false});
}

// The caller must already own an explicitly declared kg-solvent inventory.
// This function cannot turn a legacy concentration into water or wall stock.
export function referenceExtentToAbsoluteMol(extent,water){
  const mmolPerKg=quantity(extent,'mmol_CaCO3_per_kg_solvent','reference extent');
  const kg=quantity(water,'kg_solvent_water','declared solvent');
  return product(product(mmolPerKg,kg),0.001);
}
