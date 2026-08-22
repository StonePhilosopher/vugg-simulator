// Physical dissolution/etch contract (SIM 253).
import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const physicalEtchVisualStateAtStep: any;
declare const _physicalEtchEquivalentAxialLoss: any;
declare const _topoHistoricalCrystalSize: any;
declare const applyPhysicalEtchDirective: any;
declare const fluoriteSaturationAssessment: any;
declare const FluidChemistry: any;
declare const _physicalEtchModelFor: any;
declare const _physicalEtchReliefBucket: any;

function remaining(crystal: any, species: string): number {
  let total = 0;
  for (const zone of crystal.zones || []) {
    if (!(zone && zone.thickness_um > 0)) continue;
    const remainingUm = Number.isFinite(Number(zone._remaining_solid_um))
      ? Math.max(0, Number(zone._remaining_solid_um))
      : Math.max(0, Number(zone.thickness_um) || 0);
    total += remainingUm * (Number(zone._budget_inventory_per_um?.[species]) || 0);
  }
  return total;
}

function startScenario() {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS.reactivated_fluorite_vein();
  return { sim: new VugSimulator(conditions, events), defaultSteps };
}

describe('evidence-bounded physical etch', () => {
  it('withholds the wash from a stepped surface and mass-closes a controlled flat-{100} exposure', () => {
    const { sim } = startScenario();
    while (sim.step < 117) sim.run_step();
    const fluorite = sim.crystals.find((c: any) => c.mineral === 'fluorite' && !c.dissolved);
    expect(fluorite).toBeTruthy();
    const before = {
      size: fluorite.total_growth_um,
      volume: fluorite._volume_mm3,
      ca: remaining(fluorite, 'Ca'),
      fluorine: remaining(fluorite, 'F'),
    };

    expect(fluorite.habit).toBe('stepped_cube');
    const noFaceModel = applyPhysicalEtchDirective(sim, {
      minerals: ['fluorite'], duration_days: 1,
    }, 117);
    expect(noFaceModel).toMatchObject({ considered: 1, accepted: 0, rejected: 1 });
    expect(noFaceModel.receipts[0].rejection)
      .toBe('no_face_matched_evidence_bounded_rate_model');
    // Isolate the independent solution-envelope guard with an explicitly
    // controlled flat face. The pre-breach fluid is still outside the cited
    // bath envelope, so no solid may be removed.
    fluorite.habit = 'cubic';
    const outOfEnvelope = applyPhysicalEtchDirective(sim, {
      minerals: ['fluorite'], duration_days: 1,
    }, 117);
    expect(outOfEnvelope).toMatchObject({ considered: 1, accepted: 0, rejected: 1 });
    expect(outOfEnvelope.receipts[0].rejection).toBe('outside_rate_model_envelope');
    fluorite.habit = 'stepped_cube';
    expect(fluorite.total_growth_um).toBe(before.size);
    const unsupported = applyPhysicalEtchDirective(sim, {
      minerals: ['calcite'], duration_days: 1,
    }, 117);
    expect(unsupported.considered).toBeGreaterThan(0);
    expect(unsupported.accepted).toBe(0);
    expect(unsupported.receipts.every(
      (receipt: any) => receipt.rejection === 'no_face_matched_evidence_bounded_rate_model',
    )).toBe(true);

    // Controlled face-matched specimen before the event fires. This lets the
    // step-118 directive evaluate the exact pH 3.6 replacement wash, before the
    // ordinary end-of-step boundary evolution. It is the non-vacuous positive
    // integration for rate, shell return, morphology, and mass closure; the
    // separate regression below preserves the unmodified seed-42 testimony.
    fluorite.habit = 'cubic';
    sim.run_step();
    const summary = sim._physicalEtchReceipts.at(-1);
    expect(summary).toMatchObject({
      schema: 'physical-dissolution-v3', step: 118, considered: 1, accepted: 1, rejected: 0,
    });
    const receipt = summary.receipts[0];
    expect(receipt.modelId).toBe('Godinho2012-fluorite-100-bounded-analogue-v2');
    expect(receipt.temperatureC).toBeCloseTo(21, 10);
    expect(receipt).toMatchObject({
      pH: 3.6,
      pressureKbar: 0.001,
      gameplaySigma: 0,
      face: '{100}',
      surfaceMorphology: 'cubic-{100}-pits-90deg-sidewalls',
      endpoint: 'duration_complete',
      integrationSubsteps: 512,
      shapeModel: 'render-matched-isometric-habit-equivalent',
      returnedClosureMaxAbsPpm: 0,
      evidenceClass: 'bounded_extrapolation_from_face_specific_rate',
      visualRepresentation: 'schematic_magnified_preexisting_pore_relief_mass_silhouette_physical',
      schematicReliefMagnification: 250,
      affinityBoundaryTransfer: 'mineral_level_bounded_extrapolation_only_no_rate_or_face_multiplier',
    });
    expect(receipt.initialOmega).toBeGreaterThan(0); // raw Ω survives gameplay's hard gate
    expect(receipt.initialDeltaGKcalMol).toBeLessThanOrEqual(-7);
    expect(receipt.finalDeltaGKcalMol).toBeLessThanOrEqual(-7);
    expect(receipt.finalOmega).toBeGreaterThan(receipt.initialOmega); // returned F feeds back
    expect(receipt.visualIntensity).toBeGreaterThan(0);
    expect(receipt.systematicUncertainty).toContain('unquantified');
    expect(receipt.sourceBathProtocol).toContain('renewed every 48 h');
    expect(receipt.simulatedBathProtocol).toContain('closed return path');
    expect(receipt.affinityBoundarySource).toContain('Cama');
    expect(receipt.affinityBoundarySource).toContain('{111}, pH 2');
    expect(receipt.axialLossUm).toBeCloseTo(2 * receipt.normalRetreatUm, 9);
    expect(receipt.renderedDimensionsBeforeMm.c).toBe(
      receipt.renderedDimensionsBeforeMm.a,
    );
    expect(receipt.renderedDimensionsAfterMm.c).toBe(
      receipt.renderedDimensionsAfterMm.a,
    );
    expect(fluorite.total_growth_um).toBeLessThan(before.size);
    expect(fluorite._volume_mm3).toBeLessThan(before.volume);

    const negativeAtWash = fluorite.zones.filter(
      (zone: any) => zone.step === 118 && zone.thickness_um < 0,
    );
    expect(negativeAtWash).toHaveLength(1); // no event + engine double count
    expect(negativeAtWash[0].physical_etch.modelId).toBe(receipt.modelId);
    expect(before.ca - remaining(fluorite, 'Ca')).toBeCloseTo(
      receipt.returnedInventoryPpm.Ca, 10,
    );
    expect(before.fluorine - remaining(fluorite, 'F')).toBeCloseTo(
      receipt.returnedInventoryPpm.F, 10,
    );
    expect(receipt.volumeBeforeMm3 - receipt.volumeAfterMm3).toBeCloseTo(
      receipt.volumeLossMm3, 10,
    );
  }, 300000);

  it('records the unmodified seed-42 stepped surface as a fail-closed wash', () => {
    const { sim } = startScenario();
    while (sim.step < 118) sim.run_step();
    const fluorite = sim.crystals.find((c: any) => c.mineral === 'fluorite');
    expect(fluorite.habit).toBe('stepped_cube');
    expect(sim._physicalEtchReceipts.at(-1)).toMatchObject({
      schema: 'physical-dissolution-v3', step: 118,
      considered: 1, accepted: 0, rejected: 1,
      receipts: [{
        mineral: 'fluorite', habit: 'stepped_cube', accepted: false,
        rejection: 'no_face_matched_evidence_bounded_rate_model',
      }],
    });
    expect(fluorite.etch_history || []).toHaveLength(0);
    expect(physicalEtchVisualStateAtStep(fluorite, 118)).toBeNull();
    expect(fluorite.phantom_count || 0).toBe(0);
  }, 300000);

  it('replay shows sharp → face-derived pits → progressive healing while retaining the phantom boundary', () => {
    const { sim, defaultSteps } = startScenario();
    while (sim.step < 117) sim.run_step();
    const fluorite = sim.crystals.find((c: any) => c.mineral === 'fluorite');
    expect(physicalEtchVisualStateAtStep(fluorite, 117)).toBeNull();
    expect(fluorite.habit).toBe('stepped_cube');
    // Install the controlled flat-{100} surface before the breach event so the
    // rate sees the exact authored replacement fluid at its replay boundary.
    fluorite.habit = 'cubic';
    sim.run_step();
    expect(sim._physicalEtchReceipts.at(-1).accepted).toBe(1);
    const etched = physicalEtchVisualStateAtStep(fluorite, 118);
    sim.run_step();
    const partlyHealed = physicalEtchVisualStateAtStep(fluorite, 119);
    expect(etched.amount).toBeGreaterThan(0);
    expect(etched.morphology).toBe('cubic-{100}-pits-90deg-sidewalls');
    expect(etched.healedFraction).toBe(0);
    expect(partlyHealed.healedFraction).toBeGreaterThan(0);
    expect(partlyHealed.healedFraction).toBeLessThan(1);
    expect(partlyHealed.amount).toBeLessThan(etched.amount);
    while (sim.step < (defaultSteps || 160)) sim.run_step();
    const fullyHealed = physicalEtchVisualStateAtStep(fluorite, 120);
    const finalEtch = physicalEtchVisualStateAtStep(fluorite, sim.step);
    // Accepted regrowth exceeds the 0.265 µm removed depth on the second
    // post-wash step in the commissioned v270 trajectory, so the exposed
    // pits disappear promptly. The buried phantom boundary remains durable
    // stratigraphic testimony of the dissolution event.
    expect(fullyHealed).toBeNull();
    // The fully overgrown state persists through the final frame.
    expect(finalEtch).toBeNull();
    const reliefBuckets = [etched, partlyHealed]
      .map(state => _physicalEtchReliefBucket(state.amount));
    expect(new Set(reliefBuckets).size).toBe(2);
    expect(reliefBuckets[0]).toBeGreaterThan(reliefBuckets[1]);
    expect(Math.abs(reliefBuckets[0] - etched.amount)).toBeLessThanOrEqual(0.0005);
    expect(fluorite.phantom_count).toBeGreaterThan(0);
    expect(fluorite.zones.some((zone: any) => /phantom boundary/.test(zone.note || ''))).toBe(true);

    const beforeWash = _topoHistoricalCrystalSize(fluorite, 117);
    const afterWash = _topoHistoricalCrystalSize(fluorite, 118);
    expect(beforeWash.c_length_mm).toBeGreaterThan(afterWash.c_length_mm);
  }, 300000);

  it('computes isometric equivalent geometry without trusting stale ledger axes', () => {
    const cube = _physicalEtchEquivalentAxialLoss({
      mineral: 'fluorite', habit: 'stepped_cube',
      c_length_mm: 10, a_width_mm: 5, _volume_mm3: 130.8996939,
    }, 100);
    expect(cube.shapeModel).toBe('render-matched-isometric-habit-equivalent');
    expect(cube.renderedDimensionsBeforeMm).toEqual({ c: 10, a: 10 });
    expect(cube.renderedDimensionsAfterMm.c).toBeCloseTo(9.8, 12);
    expect(cube.renderedDimensionsAfterMm.a).toBeCloseTo(9.8, 12);
    expect(cube.axialLossUm).toBeCloseTo(200, 9);
  });

  it('rejects stepped and hopper surface states from the flat-{100} rate model', () => {
    expect(_physicalEtchModelFor({ mineral: 'fluorite', habit: 'cubic' })).toBeTruthy();
    expect(_physicalEtchModelFor({ mineral: 'fluorite', habit: 'stepped_cube' })).toBeNull();
    expect(_physicalEtchModelFor({ mineral: 'fluorite', habit: 'hopper_cube' })).toBeNull();
  });

  it('solves a closed fluoride speciation balance for raw thermodynamic Ω', () => {
    const fluid = new FluidChemistry({
      Ca: 8, F: 0.01, Na: 1138, Cl: 1755, pH: 3.6,
      salinity: 2.9, SiO2: 0, CO3: 0, Fe: 0, Mn: 0, Al: 0, Ti: 0,
    });
    const assessment = fluoriteSaturationAssessment(fluid, 21);
    expect(assessment.status).toBe('accepted');
    expect(assessment.omega).toBeGreaterThan(0);
    expect(assessment.deltaGKcalMol).toBeLessThanOrEqual(-7);
    expect(assessment.reconstructedFluorideMolal).toBeCloseTo(
      assessment.totalFluorideMolal, 16,
    );
    expect(assessment.hfMolal).toBeGreaterThan(0);
  });

  it('does not invent an etch outside a supported mineral/rate envelope', () => {
    const synthetic = {
      zones: [
        { step: 1, thickness_um: 1000 },
        { step: 10, thickness_um: -200 },
        { step: 11, thickness_um: 50 },
        { step: 12, thickness_um: 200 },
      ],
      etch_history: [{
        accepted: true, step: 10, zoneIndex: 1, axialLossUm: 200,
        visualIntensity: 0.8, surfaceMorphology: 'test-pits', modelId: 'test',
      }],
    };
    expect(physicalEtchVisualStateAtStep(synthetic, 9)).toBeNull();
    expect(physicalEtchVisualStateAtStep(synthetic, 10).amount).toBeCloseTo(0.8, 10);
    expect(physicalEtchVisualStateAtStep(synthetic, 11).healedFraction).toBeCloseTo(0.25, 10);
    expect(physicalEtchVisualStateAtStep(synthetic, 12)).toBeNull();
  });
});
