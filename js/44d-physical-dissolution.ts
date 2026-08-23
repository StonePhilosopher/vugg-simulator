// ============================================================
// js/44d-physical-dissolution.ts — coupled, evidence-bounded surface retreat
// ============================================================
// A physical etch is an accepted negative zone. The rate model reads a raw
// thermodynamic saturation state, integrates dissolution and returned solid
// inventory together, and stops when either evidence or the transferred
// far-from-equilibrium affinity boundary runs out.
// See research/arcs/research-physical-dissolution-2026-08-08.md.

const PHYSICAL_DISSOLUTION_SCHEMA = 'physical-dissolution-v3';
const _SECONDS_PER_DAY = 86400;
const _PHYSICAL_ETCH_SUBSTEPS = 512;

function _wateqAnalyticalLogK(coefficients: number[], temperatureC: number): number {
  const tK = Number(temperatureC) + 273.15;
  const [a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0] = coefficients;
  return a1 + a2 * tK + a3 / tK + a4 * Math.log10(tK) + a5 / (tK * tK)
    + a6 * tK * tK;
}

function _associationLogKAtT(logK25: number, deltaHKcalMol: number, temperatureC: number): number {
  const tK = Number(temperatureC) + 273.15;
  const refK = 298.15;
  const rJ = 8.314462618;
  return logK25 - (deltaHKcalMol * 4184 / (2.303 * rJ)) * (1 / tK - 1 / refK);
}

// Raw CaF2 saturation, independent of the gameplay/nucleation score. Fluoride
// is partitioned among F-, HF, HF2-, CaF+, and MgF+ with WATEQ4F association
// constants. A bisection solve closes the analytical-F mass balance while
// CaF+/MgF+ also reduce their free-cation pools.
function fluoriteSaturationAssessment(fluid: any, temperatureC: number): any {
  const ionicStrengthMolal = ionicStrength(fluid);
  const tK = Number(temperatureC) + 273.15;
  if (!Number.isFinite(tK) || tK <= 0 || !Number.isFinite(ionicStrengthMolal)) {
    return { status: 'invalid_input', omega: null };
  }
  if (ionicStrengthMolal > 0.5) {
    return {
      status: 'outside_davies_envelope', omega: null, ionicStrengthMolal,
      envelope: { ionicStrengthMolal: [0, 0.5] },
    };
  }
  const fTotal = ppmToMolality(Math.max(0, Number(fluid?.F) || 0), 19.00);
  const caTotal = ppmToMolality(Math.max(0, Number(fluid?.Ca) || 0), 40.08);
  const mgTotal = ppmToMolality(Math.max(0, Number(fluid?.Mg) || 0), 24.31);
  const aH = Math.pow(10, -Number(fluid?.pH));
  if (!(fTotal > 0) || !(caTotal > 0) || !(aH > 0)) {
    return {
      status: 'missing_reactant', omega: 0, ionicStrengthMolal,
      totalFluorideMolal: fTotal, totalCalciumMolal: caTotal,
    };
  }

  const gamma1 = Math.pow(10, daviesLogGamma(1, ionicStrengthMolal));
  const gamma2 = Math.pow(10, daviesLogGamma(2, ionicStrengthMolal));
  const betaHF = Math.pow(10, _wateqAnalyticalLogK(
    [-2.033, 0.012645, 429.01, 0, 0], temperatureC,
  ));
  const betaHF2 = Math.pow(10, _associationLogKAtT(3.76, 4.55, temperatureC));
  const betaCaF = Math.pow(10, _associationLogKAtT(0.94, 4.12, temperatureC));
  const betaMgF = Math.pow(10, _associationLogKAtT(1.82, 3.20, temperatureC));

  const speciate = (freeFMolal: number) => {
    const freeCaMolal = caTotal / (1 + betaCaF * gamma2 * freeFMolal);
    const freeMgMolal = mgTotal / (1 + betaMgF * gamma2 * freeFMolal);
    const aF = gamma1 * freeFMolal;
    const aCa = gamma2 * freeCaMolal;
    const aMg = gamma2 * freeMgMolal;
    const hfMolal = betaHF * aH * aF;
    const hf2Molal = betaHF2 * aH * aF * aF / gamma1;
    const caFMolal = betaCaF * aCa * aF / gamma1;
    const mgFMolal = betaMgF * aMg * aF / gamma1;
    return {
      freeFMolal, freeCaMolal, freeMgMolal, aF, aCa, aMg,
      hfMolal, hf2Molal, caFMolal, mgFMolal,
      reconstructedFluorideMolal: freeFMolal + hfMolal + 2 * hf2Molal
        + caFMolal + mgFMolal,
    };
  };

  let lo = 0;
  let hi = fTotal;
  for (let i = 0; i < 96; i++) {
    const mid = (lo + hi) / 2;
    if (speciate(mid).reconstructedFluorideMolal > fTotal) hi = mid;
    else lo = mid;
  }
  const species = speciate((lo + hi) / 2);
  // WATEQ4F: CaF2 = Ca+2 + 2F-, log_k analytical expression.
  const logKsp = _wateqAnalyticalLogK([66.348, 0, -4298.2, -25.271, 0], temperatureC);
  const logIap = Math.log10(species.aCa) + 2 * Math.log10(species.aF);
  const omega = Math.pow(10, logIap - logKsp);
  const deltaGKcalMol = 8.314462618 * tK * Math.log(Math.max(omega, 1e-300)) / 4184;
  return {
    status: 'accepted',
    method: 'WATEQ4F-CaF2-HF-HF2-CaF-MgF-Davies-v1',
    database: 'USGS PHREEQC wateq4f.dat',
    ionicStrengthMolal,
    gammaMonovalent: gamma1,
    gammaDivalent: gamma2,
    totalFluorideMolal: fTotal,
    totalCalciumMolal: caTotal,
    ...species,
    logKsp,
    logIap,
    omega,
    deltaGKcalMol,
  };
}

const _FLUORITE_100_MODEL = Object.freeze({
  id: 'Godinho2012-fluorite-100-bounded-analogue-v2',
  source: 'Godinho, Piazolo & Evins 2012 GCA 86:392-403, doi:10.1016/j.gca.2012.02.032',
  face: '{100}',
  pH: 3.6,
  pHTolerance: 0.05,
  temperatureC: 21,
  temperatureToleranceC: 0.5,
  ionicStrengthMolal: 0.05,
  ionicStrengthToleranceMolal: 0.005,
  pressureKbar: 0.001,
  pressureToleranceKbar: 0.0003,
  maxDurationDays: 19.5, // measured first 468 h
  // Cama et al. (2010) measured a fluorite rate plateau below -7 kcal/mol.
  // Transfer ONLY that affinity boundary. The numeric {100} rate remains the
  // direct Godinho value; no {111} rate or face multiplier is imported.
  maximumDeltaGKcalMol: -7,
  molarVolumeCm3Mol: 24.55,
  rateMolM2S: 3.2e-9,
  rateRangeMolM2S: [3.0e-9, 3.4e-9],
  surfaceMorphology: 'cubic-{100}-pits-90deg-sidewalls',
  evidenceClass: 'bounded_extrapolation_from_face_specific_rate',
  systematicUncertainty: 'unquantified_electrolyte_surface_state_bath_protocol_and_cross_condition_affinity_boundary_transfer',
  affinityBoundarySource: 'Cama, Ayora & Lasaga 2010 GCA 74:4298-4311, doi:10.1016/j.gca.2010.04.067; fluorite {111}, pH 2',
  affinityBoundaryTransfer: 'mineral_level_bounded_extrapolation_only_no_rate_or_face_multiplier',
  sourceBathProtocol: '0.05 M NaClO4/HClO4; pH 3.6; 10 mL renewed every 48 h; Ca kept below 10 ppb',
  simulatedBathProtocol: '0.05 molal NaCl ionic-strength analogue; fixed pH; closed return path without 48 h renewal',
  defectAssumption: 'two schematic pre-existing pores per displayed face; density is not a measured natural-crystal inventory',
  schematicReliefMagnification: 250,
});

function _physicalEtchModelFor(crystal: any): any | null {
  if (crystal?.mineral !== 'fluorite') return null;
  const habit = String(crystal?.habit || '').toLowerCase();
  // Godinho's rate is for cleaned nominally-flat (001) top surfaces. A
  // stepped/hopper/dendritic cube shares a macroscopic face normal but not the
  // measured step-site state, so it must fail closed.
  if (habit === 'cubic') return _FLUORITE_100_MODEL;
  return null;
}

function physicalEtchExposureDays(directive: any): number {
  const authored = Number(directive?.duration_days);
  if (Number.isFinite(authored) && authored > 0) return authored;
  return NaN;
}

function _physicalEtchRenderedAxes(crystal: any): any {
  const cLengthMm = Math.max(0, Number(crystal?.c_length_mm) || 0);
  const habit = String(crystal?.habit || '').toLowerCase();
  const isIsometric = crystal?.mineral === 'fluorite'
    || habit.includes('cube') || habit.includes('octa')
    || habit.includes('dodec') || habit.includes('snowball');
  if (isIsometric) {
    return {
      cLengthMm,
      aWidthMm: cLengthMm,
      shapeModel: 'render-matched-isometric-habit-equivalent',
    };
  }
  return {
    cLengthMm,
    aWidthMm: Math.max(0, Number(crystal?.a_width_mm) || 0),
    shapeModel: 'ledger-axis-ellipsoid-equivalent',
  };
}

function _spheroidAreaMm2(aRadiusMm: number, cRadiusMm: number): number {
  if (!(aRadiusMm > 0) || !(cRadiusMm > 0)) return 0;
  const p = 1.6075;
  const term = (Math.pow(aRadiusMm, 2 * p)
    + 2 * Math.pow(aRadiusMm * cRadiusMm, p)) / 3;
  return 4 * Math.PI * Math.pow(term, 1 / p);
}

function _physicalEtchEquivalentAxialLoss(crystal: any, normalRetreatUm: number): any {
  const axes = _physicalEtchRenderedAxes(crystal);
  const cLengthMm = axes.cLengthMm;
  const aWidthMm = axes.aWidthMm;
  const retreatMm = Math.max(0, Number(normalRetreatUm) || 0) / 1000;
  const sourceVolume = Math.max(0, Number(crystal?._volume_mm3) || 0);
  if (axes.shapeModel === 'render-matched-isometric-habit-equivalent') {
    const remainingSpan = Math.max(0, cLengthMm - 2 * retreatMm);
    const volumeRatio = cLengthMm > 0 ? Math.pow(remainingSpan / cLengthMm, 3) : 0;
    const targetVolume = sourceVolume * volumeRatio;
    const surfaceArea = cLengthMm > 0 ? 6 * sourceVolume / cLengthMm : 0;
    return {
      ...axes,
      sourceVolumeMm3: sourceVolume,
      targetVolumeMm3: targetVolume,
      volumeLossMm3: sourceVolume - targetVolume,
      surfaceAreaMm2: surfaceArea,
      surfaceAreaToVolumePerMm: sourceVolume > 0 ? surfaceArea / sourceVolume : null,
      axialLossUm: Math.max(0, (cLengthMm - remainingSpan) * 1000),
      volumeLossFraction: sourceVolume > 0 ? (sourceVolume - targetVolume) / sourceVolume : 0,
      renderedDimensionsBeforeMm: { c: cLengthMm, a: aWidthMm },
      renderedDimensionsAfterMm: { c: remainingSpan, a: remainingSpan },
    };
  }
  const cRadius = cLengthMm / 2;
  const aRadius = aWidthMm / 2;
  const shapeVolume = (4 / 3) * Math.PI * aRadius * aRadius * cRadius;
  const insetA = Math.max(0, aRadius - retreatMm);
  const insetC = Math.max(0, cRadius - retreatMm);
  const insetShapeVolume = (4 / 3) * Math.PI * insetA * insetA * insetC;
  const volumeRatio = shapeVolume > 0 ? Math.max(0, Math.min(1, insetShapeVolume / shapeVolume)) : 0;
  const targetVolume = sourceVolume * volumeRatio;
  const equivalentCLengthMm = cLengthMm * Math.cbrt(volumeRatio);
  const surfaceArea = _spheroidAreaMm2(aRadius, cRadius);
  return {
    ...axes,
    sourceVolumeMm3: sourceVolume,
    targetVolumeMm3: targetVolume,
    volumeLossMm3: sourceVolume - targetVolume,
    surfaceAreaMm2: surfaceArea,
    surfaceAreaToVolumePerMm: sourceVolume > 0 ? surfaceArea / sourceVolume : null,
    axialLossUm: Math.max(0, (cLengthMm - equivalentCLengthMm) * 1000),
    volumeLossFraction: sourceVolume > 0 ? (sourceVolume - targetVolume) / sourceVolume : 0,
    renderedDimensionsBeforeMm: { c: cLengthMm, a: aWidthMm },
    renderedDimensionsAfterMm: {
      c: equivalentCLengthMm,
      a: aWidthMm * Math.cbrt(volumeRatio),
    },
  };
}

function _physicalEtchFirstGrowthStep(crystal: any): number | null {
  for (const zone of (crystal?.zones || [])) {
    if ((Number(zone?.thickness_um) || 0) > 0) return Number(zone.step);
  }
  return null;
}

function physicalEtchVisualStateAtStep(crystal: any, replayStep?: number): any {
  const history = Array.isArray(crystal?.etch_history) ? crystal.etch_history : [];
  const atStep = replayStep == null ? Infinity : replayStep;
  for (let hi = history.length - 1; hi >= 0; hi--) {
    const receipt = history[hi];
    if (!receipt?.accepted || receipt.step > atStep) continue;
    let regrownUm = 0;
    for (let zi = (receipt.zoneIndex ?? -1) + 1; zi < (crystal.zones || []).length; zi++) {
      const zone = crystal.zones[zi];
      if (zone?.step > atStep) break;
      if ((Number(zone?.thickness_um) || 0) > 0) regrownUm += Number(zone.thickness_um);
    }
    const removedUm = Math.max(0, Number(receipt.axialLossUm) || 0);
    const residualUm = Math.max(0, removedUm - regrownUm);
    if (!(residualUm > 1e-6) || !(removedUm > 0)) continue;
    const authoredIntensity = Number(receipt.visualIntensity);
    const baseIntensity = Math.max(0, Math.min(1,
      Number.isFinite(authoredIntensity) ? authoredIntensity : 0));
    return {
      kind: 'model-derived',
      morphology: receipt.surfaceMorphology,
      amount: baseIntensity * Math.max(0, Math.min(1, residualUm / removedUm)),
      atStep: receipt.step,
      residualUm,
      removedUm,
      healedFraction: Math.max(0, Math.min(1, regrownUm / removedUm)),
      modelId: receipt.modelId,
      visualRepresentation: receipt.visualRepresentation,
      schematicReliefMagnification: receipt.schematicReliefMagnification,
      defectAssumption: receipt.defectAssumption,
    };
  }
  return null;
}

function _physicalEtchWithLocalConditions(sim: any, crystal: any, fn: (conditions: any) => any): any {
  const savedFluid = sim.conditions.fluid;
  const savedTemperature = sim.conditions.temperature;
  const anchor = sim.wall_state?._resolveAnchor?.(crystal);
  const chemistry = sim.wall_state?.chemistryAddressForCrystal?.(crystal);
  const ringIdx = chemistry?.ringIdx;
  try {
    if (ringIdx != null && ringIdx >= 0 && ringIdx < sim.ring_fluids.length) {
      const mesh = sim.wall_state.meshFor(sim);
      const cell = mesh?.cellOf?.(crystal, sim.wall_state);
      sim.conditions.fluid = cell?.fluid || sim.ring_fluids[ringIdx];
      const vertexIdx = chemistry.vertexIndex;
      sim.conditions.temperature = temperatureAtMeshVertex(sim, mesh, vertexIdx);
    }
    return fn(sim.conditions);
  } finally {
    sim.conditions.fluid = savedFluid;
    sim.conditions.temperature = savedTemperature;
  }
}

function _physicalEtchGameplaySigma(crystal: any, conditions: any): number | null {
  const fn = conditions?.[`supersaturation_${crystal?.mineral}`];
  if (typeof fn !== 'function') return null;
  try {
    const value = Number(fn.call(conditions));
    return Number.isFinite(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

function _physicalEtchEnvelopeFailure(model: any, assessment: any, conditions: any, durationDays: number): string | null {
  const pH = Number(conditions.fluid?.pH);
  const temperatureC = Number(conditions.temperature);
  const pressureKbar = Number(conditions.pressure);
  if (Math.abs(pH - model.pH) > model.pHTolerance
      || Math.abs(temperatureC - model.temperatureC) > model.temperatureToleranceC
      || Math.abs(pressureKbar - model.pressureKbar) > model.pressureToleranceKbar
      || Math.abs(Number(assessment?.ionicStrengthMolal) - model.ionicStrengthMolal)
        > model.ionicStrengthToleranceMolal
      || !Number.isFinite(durationDays)
      || durationDays > model.maxDurationDays) return 'outside_rate_model_envelope';
  if (assessment?.status !== 'accepted' || !Number.isFinite(Number(assessment?.omega))) {
    return 'saturation_unavailable';
  }
  if (!(Number(assessment.deltaGKcalMol) <= model.maximumDeltaGKcalMol)) {
    return 'outside_far_field_affinity_plateau';
  }
  return null;
}

function _omegaAtDeltaG(deltaGKcalMol: number, temperatureC: number): number {
  const tK = Number(temperatureC) + 273.15;
  return Math.exp(Number(deltaGKcalMol) * 4184 / (8.314462618 * tK));
}

function _physicalEtchSchematicRelief(crystal: any, receipt: any, model: any): any {
  const spanMm = Math.max(0, Number(receipt?.renderedDimensionsBeforeMm?.c) || 0);
  const normalRetreatMm = Math.max(0, Number(receipt?.normalRetreatUm) || 0) / 1000;
  const magnification = Number(model?.schematicReliefMagnification) || 1;
  // A cube spans 0.8 renderer units and _makeEtchedCube's full-strength pit
  // inset is 0.055 units. Convert physical retreat to renderer coordinates,
  // then apply the explicitly disclosed vertical exaggeration. Silhouette and
  // booked mass remain the physical geometry; only the pore-relief overlay is
  // magnified.
  const renderedPhysicalInset = spanMm > 0 ? 0.8 * normalRetreatMm / spanMm : 0;
  const visualIntensity = Math.max(0, Math.min(1,
    renderedPhysicalInset * magnification / 0.055));
  return {
    visualIntensity,
    visualRepresentation: 'schematic_magnified_preexisting_pore_relief_mass_silhouette_physical',
    schematicReliefMagnification: magnification,
    defectAssumption: model.defectAssumption,
    physicalReliefResolvedAtDisplayScale: false,
  };
}

function _physicalEtchVirtualFluid(initialFluid: any, returned: Record<string, number>): any {
  const virtual = _cloneFluid(initialFluid);
  for (const species in returned) {
    if (typeof virtual[species] === 'number') virtual[species] += Number(returned[species]) || 0;
  }
  return virtual;
}

function applyPhysicalEtchDirective(sim: any, directive: any, step: number): any {
  const mineralFilter = Array.isArray(directive?.minerals) && directive.minerals.length
    ? new Set(directive.minerals.map(String)) : null;
  const durationDays = physicalEtchExposureDays(directive);
  const summary: any = {
    schema: PHYSICAL_DISSOLUTION_SCHEMA,
    step,
    durationDays,
    morphologyControl: 'model-derived-not-player-authored',
    considered: 0,
    accepted: 0,
    rejected: 0,
    totalVolumeLossMm3: 0,
    totalAxialLossUm: 0,
    receipts: [],
  };

  for (const crystal of (sim?.crystals || [])) {
    // Geometric-selection `_buried` means growth-front shadowing, not a
    // hermetic shell. Only a real enclosure receipt/lifecycle withholds the
    // solid from this fluid-facing physical etch path.
    if (!crystal || crystal.dissolved || currentEnclosureAuthority(sim, crystal)) continue;
    if (mineralFilter && !mineralFilter.has(String(crystal.mineral))) continue;
    if (!(crystal.total_growth_um > 0)) continue;
    const firstStep = _physicalEtchFirstGrowthStep(crystal);
    if (firstStep == null || firstStep >= step) continue;
    summary.considered++;
    const model = _physicalEtchModelFor(crystal);
    const receipt: any = {
      schema: PHYSICAL_DISSOLUTION_SCHEMA,
      step,
      crystalId: crystal.crystal_id,
      mineral: crystal.mineral,
      habit: crystal.habit,
      durationDays,
      accepted: false,
    };
    if (!model) {
      receipt.rejection = 'no_face_matched_evidence_bounded_rate_model';
      summary.rejected++;
      summary.receipts.push(receipt);
      continue;
    }

    _physicalEtchWithLocalConditions(sim, crystal, (conditions: any) => {
      const initialFluid = _cloneFluid(conditions.fluid);
      const temperatureC = Number(conditions.temperature);
      const pH = Number(initialFluid.pH);
      const pressureKbar = Number(conditions.pressure);
      const initialAssessment = fluoriteSaturationAssessment(initialFluid, temperatureC);
      const gameplaySigma = _physicalEtchGameplaySigma(crystal, conditions);
      Object.assign(receipt, {
        pH,
        temperatureC,
        pressureKbar,
        gameplaySigma,
        omega: initialAssessment.omega,
        initialOmega: initialAssessment.omega,
        initialDeltaGKcalMol: initialAssessment.deltaGKcalMol,
        initialSaturationAssessment: initialAssessment,
        modelId: model.id,
        source: model.source,
        face: model.face,
        rateRangeMolM2S: model.rateRangeMolM2S,
        surfaceMorphology: model.surfaceMorphology,
        evidenceClass: model.evidenceClass,
        systematicUncertainty: model.systematicUncertainty,
        affinityBoundarySource: model.affinityBoundarySource,
        affinityBoundaryTransfer: model.affinityBoundaryTransfer,
        sourceBathProtocol: model.sourceBathProtocol,
        simulatedBathProtocol: model.simulatedBathProtocol,
        pHAccounting: 'externally_fixed_activity_proxy_no_conserved_hydrogen_inventory',
      });
      const envelopeFailure = _physicalEtchEnvelopeFailure(
        model, initialAssessment, conditions, durationDays,
      );
      if (envelopeFailure) {
        receipt.rejection = envelopeFailure;
        receipt.envelope = {
          pH: [model.pH - model.pHTolerance, model.pH + model.pHTolerance],
          temperatureC: [model.temperatureC - model.temperatureToleranceC,
            model.temperatureC + model.temperatureToleranceC],
          pressureKbar: [model.pressureKbar - model.pressureToleranceKbar,
            model.pressureKbar + model.pressureToleranceKbar],
          ionicStrengthMolal: [model.ionicStrengthMolal - model.ionicStrengthToleranceMolal,
            model.ionicStrengthMolal + model.ionicStrengthToleranceMolal],
          durationDays: [0, model.maxDurationDays],
          maximumDeltaGKcalMol: model.maximumDeltaGKcalMol,
          maximumOmegaAtTemperature: _omegaAtDeltaG(model.maximumDeltaGKcalMol, temperatureC),
        };
        return;
      }

      let normalRetreatUm = 0;
      let endpoint = 'duration_complete';
      let integrationSubsteps = 0;
      let finalAssessment = initialAssessment;
      let returnedPreview: Record<string, number> = {};
      const dtDays = durationDays / _PHYSICAL_ETCH_SUBSTEPS;
      for (let i = 0; i < _PHYSICAL_ETCH_SUBSTEPS; i++) {
        const proposedNormal = normalRetreatUm + model.rateMolM2S
          * model.molarVolumeCm3Mol * _SECONDS_PER_DAY * dtDays;
        const proposedGeom = _physicalEtchEquivalentAxialLoss(crystal, proposedNormal);
        const proposedAxial = Math.min(crystal.total_growth_um, proposedGeom.axialLossUm);
        const proposedReturn = previewBookedDissolutionReturn(crystal, proposedAxial, initialFluid);
        const proposedFluid = _physicalEtchVirtualFluid(initialFluid, proposedReturn);
        const proposedAssessment = fluoriteSaturationAssessment(proposedFluid, temperatureC);
        integrationSubsteps++;
        if (proposedAssessment.status !== 'accepted') {
          endpoint = 'saturation_model_boundary';
          break;
        }
        if (!(Number(proposedAssessment.deltaGKcalMol) <= model.maximumDeltaGKcalMol)) {
          let lower = normalRetreatUm;
          let upper = proposedNormal;
          for (let bi = 0; bi < 64; bi++) {
            const mid = (lower + upper) / 2;
            const midGeom = _physicalEtchEquivalentAxialLoss(crystal, mid);
            const midAxial = Math.min(crystal.total_growth_um, midGeom.axialLossUm);
            const midReturn = previewBookedDissolutionReturn(crystal, midAxial, initialFluid);
            const midAssessment = fluoriteSaturationAssessment(
              _physicalEtchVirtualFluid(initialFluid, midReturn), temperatureC,
            );
            if (midAssessment.status === 'accepted'
                && Number(midAssessment.deltaGKcalMol) <= model.maximumDeltaGKcalMol) lower = mid;
            else upper = mid;
          }
          normalRetreatUm = lower;
          const boundaryGeom = _physicalEtchEquivalentAxialLoss(crystal, normalRetreatUm);
          const boundaryAxial = Math.min(crystal.total_growth_um, boundaryGeom.axialLossUm);
          returnedPreview = previewBookedDissolutionReturn(crystal, boundaryAxial, initialFluid);
          finalAssessment = fluoriteSaturationAssessment(
            _physicalEtchVirtualFluid(initialFluid, returnedPreview), temperatureC,
          );
          endpoint = 'far_field_affinity_plateau_limit';
          break;
        }
        normalRetreatUm = proposedNormal;
        returnedPreview = proposedReturn;
        finalAssessment = proposedAssessment;
        if (proposedAxial >= crystal.total_growth_um - 1e-9) {
          endpoint = 'solid_exhausted';
          break;
        }
      }

      const geom = _physicalEtchEquivalentAxialLoss(crystal, normalRetreatUm);
      const axialLossUm = Math.min(crystal.total_growth_um, geom.axialLossUm);
      if (!(axialLossUm > 1e-6)) {
        receipt.rejection = 'retreat_below_resolution';
        return;
      }
      returnedPreview = previewBookedDissolutionReturn(crystal, axialLossUm, initialFluid);
      finalAssessment = fluoriteSaturationAssessment(
        _physicalEtchVirtualFluid(initialFluid, returnedPreview), temperatureC,
      );
      const zone = new GrowthZone({
        step,
        temperature: temperatureC,
        thickness_um: -axialLossUm,
        growth_rate: -(axialLossUm / Math.max(durationDays, 1)),
        dissolutionMode: 'coupled_face_matched_surface_retreat',
        note: `${model.id}: raw Ω ${initialAssessment.omega.toExponential(3)}→${Number(finalAssessment.omega).toExponential(3)}, `
          + `${durationDays.toFixed(2)} d; ${model.surfaceMorphology}; exact booked shell inventory returned`,
      });
      zone._time_scaled = true;
      sim._applyZoneGrowthBudget(crystal, zone);
      crystal.add_zone(zone);
      const finalVolume = Math.max(0, Number(crystal._volume_mm3) || 0);
      const actualReturned = { ...(zone._returned_budget_inventory || {}) };
      const returnedClosureSpecies = [...new Set([
        ...Object.keys(returnedPreview), ...Object.keys(actualReturned),
      ])];
      const returnedClosureMaxAbsPpm = returnedClosureSpecies.reduce((max: number, species: any) => Math.max(
        max,
        Math.abs((Number(returnedPreview[species]) || 0) - (Number(actualReturned[species]) || 0)),
      ), 0);
      if (returnedClosureMaxAbsPpm > 1e-12) {
        throw new Error(
          `Physical etch booked-return closure failed for ${crystal.crystal_id}: `
          + `${returnedClosureMaxAbsPpm} ppm`,
        );
      }
      Object.assign(receipt, {
        accepted: true,
        endpoint,
        integrationSubsteps,
        rateMolM2S: model.rateMolM2S,
        normalRetreatUm,
        axialLossUm,
        shapeModel: geom.shapeModel,
        renderedDimensionsBeforeMm: geom.renderedDimensionsBeforeMm,
        renderedDimensionsAfterMm: geom.renderedDimensionsAfterMm,
        volumeBeforeMm3: geom.sourceVolumeMm3,
        volumeAfterMm3: finalVolume,
        volumeLossMm3: Math.max(0, geom.sourceVolumeMm3 - finalVolume),
        volumeLossFraction: geom.sourceVolumeMm3 > 0
          ? Math.max(0, (geom.sourceVolumeMm3 - finalVolume) / geom.sourceVolumeMm3) : 0,
        surfaceAreaMm2: geom.surfaceAreaMm2,
        surfaceAreaToVolumePerMm: geom.surfaceAreaToVolumePerMm,
        returnedInventoryPpm: actualReturned,
        previewReturnedInventoryPpm: returnedPreview,
        returnedClosureMaxAbsPpm,
        finalOmega: finalAssessment.omega,
        finalDeltaGKcalMol: finalAssessment.deltaGKcalMol,
        finalSaturationAssessment: finalAssessment,
        zoneIndex: crystal.zones.length - 1,
      });
      Object.assign(receipt, _physicalEtchSchematicRelief(crystal, receipt, model));
      zone.physical_etch = { ...receipt };
      (crystal.etch_history ||= []).push(receipt);
      crystal._physicalEtchAppliedStep = step;
    });

    if (receipt.accepted) {
      summary.accepted++;
      summary.totalVolumeLossMm3 += receipt.volumeLossMm3;
      summary.totalAxialLossUm += receipt.axialLossUm;
    } else {
      summary.rejected++;
    }
    summary.receipts.push(receipt);
  }
  (sim._physicalEtchReceipts ||= []).push(summary);
  return summary;
}
