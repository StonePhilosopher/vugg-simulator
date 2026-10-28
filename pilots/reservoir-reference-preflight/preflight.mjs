// Read-only dimensional preflight. Neither shipped runtime imports this module.
// A conditional calculation is not a physical inventory declaration or migration.
import {createHash} from 'node:crypto';
import {canonicalJSON} from '../finite-reservoir-authority/contract.mjs';
import {inspectLegacyWallReference} from '../finite-reservoir-authority/audit.mjs';

export const OBSERVATION_SCHEMA='vugg-initial-wall-reference-observation-v1';
const sha=x=>createHash('sha256').update(canonicalJSON(x)).digest('hex');
const clone=x=>JSON.parse(canonicalJSON(x));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function exact(x,keys,label){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length
    ||keys.some(k=>!Object.hasOwn(x,k)))throw Error(label+': explicit fields required');
}
function positive(x,label){
  if(typeof x!=='number'||!Number.isFinite(x)||x<=0)throw Error(label+': positive finite number required');
  return x;
}
function finite(x,label){if(typeof x!=='number'||!Number.isFinite(x))throw Error(label+': finite number required');return x;}
function product(a,b){return positive(a*b,'representable product');}
function ratio(a,b){return positive(a/b,'representable quotient');}
function closes(a,b,label){
  const tolerance=64*Number.EPSILON*(Math.abs(a)+Math.abs(b)),residual=a-b;
  if(!Number.isFinite(tolerance)||!Number.isFinite(residual)||Math.abs(residual)>tolerance)
    throw Error(label+': reference arithmetic does not close');
  return {residual,tolerance};
}

// The caller supplies an actual, fresh simulator. No setSeed, growth, chemical
// commit, foundation install or renderer is called. The authored 0.5 mm attack
// is an inspection stimulus, not a physical distance, clock, or accepted event.
export function observeInitialWallReference(h,sim){
  if(sim?.step!==0||!Array.isArray(sim.crystals)||sim.crystals.length!==0
    ||h.localStateFoundationFor(sim)!==null)throw Error('Fresh legacy initialization without crystals or a physical foundation required');
  const wall=sim.conditions?.wall;
  if(wall?.composition!=='limestone')throw Error('Only the existing limestone/CaCO3 proxy is in scope');
  if(sim.conditions.fluid_surface_ring!==null||sim.conditions.fluid_surface_height_mm!=null)
    throw Error('Only the initial fully flooded legacy case is in scope');
  const before=h.simulationStateFingerprint(sim),wallBefore=canonicalJSON(wall);
  const provider=sim.wall_state.activeCavitySurfaceAnchorProvider();
  if(provider?.receipt?.kind!=='cavity-field')throw Error('Authenticated production cavity required');
  const receipt=clone(provider.receipt),grid=sim.wall_state.voxelGridFor(sim);
  const dimensions={rings:grid.ring_count,cellsPerRing:grid.cells_per_ring,depths:grid.depth_count};
  const reference=inspectLegacyWallReference(wall);
  const preview=wall.previewDissolve(1.5,sim.conditions.fluid,{attempted_rate_mm:0.5,accepted_rate_mm:0.5,
    temperature_C:sim.conditions.temperature,pressure_kbar:sim.conditions.pressure});
  if(!preview.dissolved||preview.formula!=='CaCO3')throw Error('Positive calcite reference preview required');
  const plan=sim.wall_state.cavityEvolutionLedger().previewErosion(sim.wall_state,sim.wall_state.meshFor(),{
    target_volume_delta_mm3_per_kg:preview.target_volume_delta_mm3_per_kg,
    vertex_weights:new Float64Array(dimensions.rings*dimensions.cellsPerRing).fill(1)});
  if(plan.accepted===false)throw Error('Reference preview is below the existing geometry resolution');
  const target=plan.target_volume_delta_mm3_per_kg,achieved=plan.achieved_volume_delta_mm3_per_kg;
  if(Math.abs(achieved-target)>plan.volume_tolerance_mm3_per_kg)throw Error('Existing geometry preflight failed');
  if(before!==h.simulationStateFingerprint(sim)||wallBefore!==canonicalJSON(wall))throw Error('Observation changed scientific state');
  if(canonicalJSON(receipt)!==canonicalJSON(sim.wall_state.cavitySurfaceAnchorProviderReceipt()))
    throw Error('Observation changed geometry authority');
  return freeze({schema:OBSERVATION_SCHEMA,scope:'initial fully flooded legacy CaCO3 proxy; no accepted dissolution',
    volumeMm3:positive(wall.cavity_capacity_volume_mm3,'cavity capacity'),dimensions,
    cellCount:grid.voxels.length,geometryReceipt:receipt,reference,
    conditions:{temperatureC:sim.conditions.temperature,pressureKbar:sim.conditions.pressure,
      salinityIndex:sim.conditions.fluid.salinity},
    stimulus:{acceptedRateMm:preview.rate_mm,formulaExtentMmolKgReference:preview.formula_extent_mmolkg,
      calciumMgKgReference:preview.ca_released,carbonAsCO3MgKgReference:preview.co3_released,
      molarVolume:clone(preview.molar_volume)},
    geometryPlan:{targetMm3PerKgReference:target,achievedNumericMm3:achieved,
      toleranceMm3:plan.volume_tolerance_mm3_per_kg,oldVolumeMm3:plan.old_capacity_volume_mm3,
      meaning:'existing planner adds the per-reference-kg numeric target to absolute cavity mm3'},
    scientificFingerprint:before,inspectionDidNotMutate:true});
}

// Validate numeric/semantic closure, not independent geological truth. Only the
// pinned producer below can bind an observation to the actual MVT source bytes.
export function preflightWallReference(observation){
  exact(observation,['schema','scope','volumeMm3','dimensions','cellCount','geometryReceipt','reference',
    'conditions','stimulus','geometryPlan','scientificFingerprint','inspectionDidNotMutate'],'observation');
  if(observation.schema!==OBSERVATION_SCHEMA||observation.inspectionDidNotMutate!==true)
    throw Error('Unchanged initial reference observation required');
  if([observation.scope,observation.scientificFingerprint].some(x=>typeof x!=='string'||!x.trim()))
    throw Error('Observation scope and scientific identity required');
  const {reference,stimulus:s,geometryPlan:g,dimensions:d,geometryReceipt:r}=observation;
  exact(s,['acceptedRateMm','formulaExtentMmolKgReference','calciumMgKgReference',
    'carbonAsCO3MgKgReference','molarVolume'],'reference stimulus');
  exact(g,['targetMm3PerKgReference','achievedNumericMm3','toleranceMm3','oldVolumeMm3','meaning'],'geometry plan');
  exact(d,['rings','cellsPerRing','depths'],'dimensions');
  if(Object.values(d).some(n=>!Number.isSafeInteger(n)||n<1)||!Number.isSafeInteger(d.rings*d.cellsPerRing*d.depths)
    ||observation.cellCount!==d.rings*d.cellsPerRing*d.depths)throw Error('Canonical cell count mismatch');
  const volume=positive(observation.volumeMm3,'volume');
  if(reference?.modeledFormula!=='CaCO3'||reference.units!=='mmol_formula_per_kg_solvent_reference'
    ||reference.physicalWaterKg!==null||reference.physicalCalciteMol!==null||reference.productionBufferEligible!==false)
    throw Error('Unreconciled CaCO3 reference ledger required');
  positive(reference.remaining,'remaining reference stock');
  if(reference.owner!=='conditions.wall (one global model ledger)'||reference.released!==0)
    throw Error('One untouched initial global wall ledger required');
  closes(positive(reference.initial,'initial reference stock'),reference.remaining,'initial wall inventory');
  if(r?.kind!=='cavity-field'||r.resolution!==48||r.isovalue!==0
    ||typeof r.production_contract_digest!=='string'||!r.production_contract_digest)
    throw Error('Production geometry identity required');
  closes(positive(r.authoritative_volume_mm3,'geometry receipt volume'),volume,'capacity/authority');
  closes(positive(g.oldVolumeMm3,'old volume'),volume,'plan/capacity');
  const extent=positive(s.formulaExtentMmolKgReference,'reference extent');
  const rate=positive(s.acceptedRateMm,'reference rate');
  if(rate>2)throw Error('Reference preview exceeds the existing rate limit');
  closes(extent,product(rate,15/40.078),'existing thickness/reference calibration');
  const vm=positive(s.molarVolume?.value_cm3_mol,'molar volume');
  if(s.molarVolume.formula!=='CaCO3'||s.molarVolume.approximation!=='standard_state_crystalline')
    throw Error('Existing standard-state calcite approximation required');
  if(extent>reference.remaining)throw Error('Preview exceeds finite reference stock');
  const converted=product(extent,vm),target=positive(g.targetMm3PerKgReference,'target');
  closes(target,converted,'mmol/kg times cm3/mol = mm3/kg');
  closes(positive(s.calciumMgKgReference,'Ca release'),product(extent,40.078),'Ca stoichiometry');
  closes(positive(s.carbonAsCO3MgKgReference,'C as CO3 release'),product(extent,60.009),'carbonate stoichiometry');
  const achieved=positive(g.achievedNumericMm3,'achieved volume'),tolerance=finite(g.toleranceMm3,'geometry tolerance');
  if(tolerance<0||tolerance>=target||Math.abs(achieved-target)>tolerance)throw Error('Unresolved geometry preview');
  const requiredWaterKg=ratio(target,converted);
  const payload={schema:'vugg-wall-reference-preflight-v1',observation:clone(observation),
    referenceEquation:{extent:'n_calcite_mol = extent_mmol_per_kg * solvent_kg / 1000',
      volume:'dV_mm3 = n_calcite_mol * molar_volume_cm3_per_mol * 1000',
      combined:'dV_mm3 = extent_mmol_per_kg * molar_volume_cm3_per_mol * solvent_kg',
      solventFromPore:'solvent_kg = wet_mm3 * 1e-9 * solution_density_kg_m3 * solvent_mass_fraction',
      scope:'same global reference transaction and same dense-crystalline standard-state volume convention; no bulk-host porosity/phase/access factor, density or solvent mass inferred'},
    nominalTargetEquivalentSolventKg:requiredWaterKg,
    achievedEquivalentSolventKg:ratio(achieved,converted),
    geometryOnlyEquivalentSolventKgInterval:[Math.max(0,(achieved-tolerance)/converted),(achieved+tolerance)/converted],
    intervalMeaning:'existing numeric geometry tolerance only; not physical uncertainty, a water measurement, or acceptance of a model',
    requiredSolventKgPerM3OfWholeCavity:ratio(requiredWaterKg,product(volume,1e-9)),
    requiredDensityMeaning:'conditional mass/whole-cavity-volume quotient; not a brine density estimate or an equation of state',
    remainingCalciteMolPerKgReference:ratio(reference.remaining,1000),
    remainingCalciteReferenceVolumeMm3PerKg:product(reference.remaining,vm),
    localAllocation:{cellCount:observation.cellCount,waterKg:null,wetControlVolumesMm3:null,reactiveWallCalciteMol:null,
      reason:'addresses and equal reference averaging do not establish physical water masses, wet domains, or accessible calcite'},
    productionMappingAllowed:false,reactions:false,transport:false,referenceRescaled:false,
    holds:['physical wet-cell domains and solvent mass/composition are not commissioned',
      'finite accessible wall calcite phase inventory is not commissioned; grown calcite is separate',
      'reference-normalized chemical release and absolute geometric erosion need an explicit physical reconciliation']};
  return freeze({...payload,recordDigest:sha(payload)});
}

// An explicit *hypothesis* tests dimensional compatibility. It cannot install a
// foundation, debit either ledger, certify source evidence, or enable reactions.
export function evaluatePhysicalHypothesis(observation,hypothesis){
  const record=preflightWallReference(observation);
  exact(hypothesis,['water','reactiveWallCalcite','provenance'],'physical hypothesis');
  exact(hypothesis.provenance,['kind','reference'],'hypothesis provenance');
  if(hypothesis.provenance.kind!=='conditional-hypothesis'||typeof hypothesis.provenance.reference!=='string'
    ||!hypothesis.provenance.reference.trim())throw Error('Explicit conditional hypothesis required; not an authority declaration');
  const quantity=(q,unit)=>{exact(q,['value','unit'],'hypothesis quantity');
    if(q.unit!==unit)throw Error('Hypothesis units required: '+unit);return positive(q.value,unit);};
  const water=quantity(hypothesis.water,'kg_solvent_water');
  const stock=quantity(hypothesis.reactiveWallCalcite,'mol_CaCO3_wall');
  const expectedStock=product(record.remainingCalciteMolPerKgReference,water);
  const extent=observation.stimulus.formulaExtentMmolKgReference;
  const dissolvedMol=product(ratio(extent,1000),water);
  const physicalVolume=product(product(extent,observation.stimulus.molarVolume.value_cm3_mol),water);
  const residual=physicalVolume-observation.geometryPlan.achievedNumericMm3;
  if(!Number.isFinite(residual))throw Error('Unrepresentable compatibility residual');
  const stockTolerance=64*Number.EPSILON*(Math.abs(stock)+Math.abs(expectedStock));
  if(!Number.isFinite(stockTolerance))throw Error('Unrepresentable stock tolerance');
  return freeze({schema:'vugg-conditional-reservoir-compatibility-v1',observationDigest:record.recordDigest,
    hypothesis:clone(hypothesis),expectedRemainingCalciteMolFromLegacy:expectedStock,
    physicalDissolvedCalciteMol:dissolvedMol,physicalDissolutionVolumeMm3:physicalVolume,
    requiredVoidGainPerCrystallineCalciteVolume:ratio(observation.geometryPlan.achievedNumericMm3,physicalVolume),
    requiredFactorMeaning:'conditional geometric quotient only; not a measured reactive fraction, porosity, accessibility or approved conversion',
    inheritedGeometryResidualMm3:residual,inheritedGeometryToleranceMm3:observation.geometryPlan.toleranceMm3,
    geometryNumericallyCompatible:Math.abs(residual)<=observation.geometryPlan.toleranceMm3,
    stockResidualMol:stock-expectedStock,stockRoundoffToleranceMol:stockTolerance,
    stockNumericallyCompatible:Math.abs(stock-expectedStock)<=stockTolerance,
    enoughDeclaredStockForPreview:stock>=dissolvedMol,
    conclusion:'conditional arithmetic only; even matching numbers supply no physical or spatial authority',
    productionMappingAllowed:false,reactions:false,transport:false,referenceRescaled:false});
}
