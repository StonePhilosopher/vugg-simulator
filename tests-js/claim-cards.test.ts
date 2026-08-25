import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyMechanismWitnessArtifact } from '../tools/gen-mechanism-witnesses.mjs';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: Record<string, any>;
declare const STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE: Record<string, any>;
declare const MORPH_TH: Record<string, any>;
declare const morphRegime: (thresholds: any, surfaceSigma: number) => string;

const MORPHOLOGY_REGIMES = new Set([
  'spiral_smooth', 'stepped_mild', 'stepped_macro',
  'hopper_skeletal', 'dendritic',
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('adversarial claim-card fleet', () => {
  it('authenticates player movement choices and rejects rehashed authority drift', () => {
    // Execute the CLI module with native Node. Vite cannot transform an ESM
    // shebang, and using Node here also exercises the exact producer runtime.
    const moduleUrl = pathToFileURL(path.join(ROOT, 'tools', 'review-claim-card.mjs')).href;
    const script = `
      import { buildPlayerActionTestimony } from ${JSON.stringify(moduleUrl)};
      const spec = { movements: [{
        field: 'temperature', startStep: 0, endStep: 100, base: 180,
        ops: [{ kind: 'trend', amp: -20, ease: true }]
      }] };
      const valid = {
        schema: 'player-movement-intervention-v1',
        action: 'heat', field: 'temperature', accepted_at_step: 0, action_cursor: 0,
        first_geology_step: 1, value_before: 180, value_after: 205,
        applied_delta: 25, sample_index: 0,
        fluid_spatial_authority: null,
        movement_authority: {
          schema: 'movement-player-offset-v2', movement_index: 0,
          movement_source: 'authored-scenario',
          field: 'temperature', first_geology_step: 1, applied_delta: 25,
          offset_before: 0, offset_after: 25,
          offset_application: 'after-authored-texture-and-clamp'
        }
      };
      const summary = buildPlayerActionTestimony([valid], spec);
      if (summary.action_count !== 1 || JSON.stringify(summary.actions) !== JSON.stringify([valid])) {
        throw new Error('valid player testimony did not round-trip');
      }
      const cursorSequence = [
        {
          ...valid, action: 'broth-temp', value_after: 190, applied_delta: 10,
          movement_authority: {
            ...valid.movement_authority, applied_delta: 10, offset_after: 10
          }
        },
        {
          ...valid, value_before: 190, value_after: 215, applied_delta: 25,
          movement_authority: {
            ...valid.movement_authority, applied_delta: 25,
            offset_before: 10, offset_after: 35
          }
        },
        {
          ...valid, action: 'broth-temp', action_cursor: 1,
          value_before: 215, value_after: 205, applied_delta: -10,
          movement_authority: {
            ...valid.movement_authority, applied_delta: -10,
            offset_before: 35, offset_after: 25
          }
        }
      ];
      if (buildPlayerActionTestimony(cursorSequence, spec).action_count !== 3) {
        throw new Error('cursor-separated player testimony did not close');
      }
      const silicaSpec = { movements: [{
        field: 'fluid.SiO2', startStep: 0, endStep: 18, base: 320, ops: []
      }] };
      const spatial = {
        schema: 'player-fluid-spatial-intervention-v1', field: 'fluid.SiO2',
        application: 'uniform-delta', scope: 'canonical-nonvadose-voxel-volume',
        transformation_basis: 'silica:SiO2:add',
        transform_scale: 1, transform_offset: 400, transform_min: 0, transform_max: null,
        water_state_basis: 'authenticated-cavity-ring-water-state',
        water_state_scope: 'nonvadose', canonical_count: 2, excluded_count: 0,
        count: 2, before_finite_count: 2, after_finite_count: 2,
        value_before: 320, value_after: 720, applied_delta: 400,
        before_total: 640, clamped_count: 0, clamp_adjustment_total: 0,
        expected_after_total: 1440, after_total: 1440,
        error: 0, tolerance: Math.max(1e-7, 1440 * 1e-9), closed: true
      };
      const silica = {
        ...valid, action: 'silica', field: 'fluid.SiO2',
        value_before: 320, value_after: 720, applied_delta: 400,
        fluid_spatial_authority: spatial,
        movement_authority: {
          ...valid.movement_authority, field: 'fluid.SiO2', applied_delta: 400,
          offset_before: 0, offset_after: 400
        }
      };
      if (buildPlayerActionTestimony([silica], silicaSpec).action_count !== 1) {
        throw new Error('spatial player testimony did not close');
      }
      const exactSpatial = {
        ...spatial, application: 'exact-replacement',
        transformation_basis: 'broth:absolute-control',
        transform_scale: 0, transform_offset: 200, transform_min: null, transform_max: null,
        value_after: 200, applied_delta: -120,
        clamped_count: 0, clamp_adjustment_total: 0,
        expected_after_total: 400, after_total: 400,
        tolerance: Math.max(1e-7, 640 * 1e-9)
      };
      const exactSilica = {
        ...silica, action: 'broth-sio2', value_after: 200, applied_delta: -120,
        fluid_spatial_authority: exactSpatial,
        movement_authority: {
          ...silica.movement_authority, applied_delta: -120,
          offset_before: 0, offset_after: -120
        }
      };
      if (buildPlayerActionTestimony([exactSilica], silicaSpec).action_count !== 1) {
        throw new Error('exact-replacement player testimony did not close');
      }
      const vadoseSpatial = {
        ...spatial,
        field: 'fluid.O2', scope: 'canonical-vadose-voxel-volume',
        application: 'bounded-affine', transformation_basis: 'drain:O2:bounded-affine',
        transform_scale: 1, transform_offset: 0, transform_min: 0.6, transform_max: null,
        water_state_scope: 'vadose', canonical_count: 4, count: 1, excluded_count: 3,
        before_finite_count: 1, after_finite_count: 1,
        value_before: 0.2, value_after: 0.6, applied_delta: 0.4,
        before_total: 0.2, clamped_count: 1, clamp_adjustment_total: 0.4,
        expected_after_total: 0.6, after_total: 0.6,
        tolerance: 1e-7
      };
      const vadoseOxygen = {
        ...silica, action: 'drain', field: 'fluid.O2',
        value_before: 0.2, value_after: 0.6, applied_delta: 0.4,
        fluid_spatial_authority: vadoseSpatial,
        movement_authority: {
          ...silica.movement_authority, field: 'fluid.O2', applied_delta: 0.4,
          offset_before: 0, offset_after: 0.4
        }
      };
      const oxygenSpec = { movements: [{
        field: 'fluid.O2', startStep: 0, endStep: 18, base: 0.2, ops: []
      }] };
      if (buildPlayerActionTestimony([vadoseOxygen], oxygenSpec).action_count !== 1) {
        throw new Error('vadose player testimony did not close');
      }
      const floodSpatial = {
        ...spatial,
        application: 'uniform-scale', transformation_basis: 'flood:SiO2:scale',
        transform_scale: 0.6, transform_offset: 0,
        value_before: 720, value_after: 432, applied_delta: -288,
        before_total: 1040, expected_after_total: 624, after_total: 624,
        tolerance: Math.max(1e-7, 1040 * 1e-9)
      };
      const floodSilica = {
        ...silica, action: 'flood',
        value_before: 720, value_after: 432, applied_delta: -288,
        fluid_spatial_authority: floodSpatial,
        movement_authority: {
          ...silica.movement_authority, applied_delta: -288,
          offset_before: 0, offset_after: -288
        }
      };
      if (buildPlayerActionTestimony([floodSilica], silicaSpec).action_count !== 1) {
        throw new Error('pointwise Flood scale testimony did not close');
      }
      const carbonateSpec = {
        carbonate_boundary: { spatial_model: 'equal_volume_fully_mixed' },
        movements: [{
          field: 'fluid.CO3', startStep: 0, endStep: 18, base: 500, ops: []
        }]
      };
      const acidDICSpatial = {
        ...exactSpatial,
        field: 'fluid.CO3', transformation_basis: 'acid:carbonate-boundary-exact',
        transform_offset: 400,
        value_before: 500, value_after: 400, applied_delta: -100,
        before_total: 1000, expected_after_total: 800, after_total: 800,
        tolerance: Math.max(1e-7, 1000 * 1e-9)
      };
      const acidDIC = {
        ...silica, action: 'tweak_acidify', field: 'fluid.CO3',
        value_before: 500, value_after: 400, applied_delta: -100,
        fluid_spatial_authority: acidDICSpatial,
        movement_authority: {
          ...silica.movement_authority, field: 'fluid.CO3', applied_delta: -100,
          offset_before: 0, offset_after: -100
        }
      };
      if (buildPlayerActionTestimony([acidDIC], carbonateSpec).action_count !== 1) {
        throw new Error('coupled carbonate DIC testimony did not close');
      }
      const forgeries = [
        { ...valid, applied_delta: 24 },
        { ...valid, action_cursor: -1 },
        { ...valid, sample_index: 1 },
        { ...valid, field: 'pressure' },
        { ...valid, movement_authority: { ...valid.movement_authority, movement_source: 'player-scheduled' } },
        { ...valid, movement_authority: { ...valid.movement_authority, offset_after: 24 } },
        { ...valid, movement_authority: { ...valid.movement_authority, movement_index: 1 } }
      ];
      const spatialForgeries = [
        [{ ...silica, fluid_spatial_authority: null }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: { ...spatial, count: 1 } }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: { ...spatial, excluded_count: 1 } }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: { ...spatial, water_state_scope: 'vadose' } }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: {
          ...spatial,
          scope: 'canonical-vadose-voxel-volume', water_state_scope: 'vadose',
        } }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: { ...spatial, after_total: 640 } }, silicaSpec],
        [{ ...silica, fluid_spatial_authority: { ...spatial, application: 'exact-replacement' } }, silicaSpec],
        [{ ...exactSilica, fluid_spatial_authority: { ...exactSpatial, tolerance: 4e-7 } }, silicaSpec],
        [{ ...valid, fluid_spatial_authority: spatial }, spec],
        // Self-consistent arithmetic is not authority for the physical law.
        // This forged Flood row changes the scale into a uniform subtraction,
        // recomputes every total, and must still be rejected by the independent
        // action/field transform projection in review-claim-card.
        [{
          ...floodSilica,
          fluid_spatial_authority: {
            ...floodSpatial,
            application: 'uniform-delta',
            transformation_basis: 'flood:SiO2:add',
            transform_scale: 1,
            transform_offset: -288,
            expected_after_total: 464,
            after_total: 464,
          }
        }, silicaSpec]
      ];
      for (const [forged, forgedSpec] of [
        ...forgeries.map(row => [row, spec]),
        ...spatialForgeries,
      ]) {
        let rejected = false;
        try { buildPlayerActionTestimony([forged], forgedSpec); } catch (error) {
          rejected = /player action/.test(String(error?.message || error));
        }
        if (!rejected) throw new Error('forged player testimony was accepted');
      }
      console.log('PLAYER_ACTION_TESTIMONY_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT, encoding: 'utf8', timeout: 20_000,
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain('PLAYER_ACTION_TESTIMONY_OK');
  });

  it('rejects bulk-only or open generic fluid-boundary testimony', () => {
    const moduleUrl = pathToFileURL(path.join(ROOT, 'tools', 'review-claim-card.mjs')).href;
    const script = `
      import {
        buildFluidBoundaryTestimony,
        EVIDENCE_FLUID_BOUNDARY_FIELDS
      } from ${JSON.stringify(moduleUrl)};
      const spatial = {
        unit: 'mg_per_kg_solvent',
        scope: 'canonical-wet-voxel-volume', count: 2,
        beforeFiniteCount: 2, afterCount: 2, afterFiniteCount: 2,
        beforeValueTotal: 10,
        expectedAfterValueTotal: 30, afterValueTotal: 30,
        expectedNet: 20, actualNet: 20, error: 0, tolerance: 1e-7, closed: true,
        fluxBasis: 'authenticated-net-only; gross-per-voxel-replacement-exchange-not-published'
      };
      const valid = {
        schema: 'fluid-boundary-v1', step: 1, sample_index: 0,
        spatial_scope: 'canonical-wet-voxel-volume', closed: true,
        declarations: [{ kind: 'addition', source: 'test Cu boundary', fields: { Cu: 10 } }],
        testimony: [{
          field: 'Cu', before: 5, after: 15, declaredAddition: 10,
          declaredReplacementTarget: null, declaredDelta: 10,
          declaredImports: 10, declaredExports: 0, actualDelta: 10,
          error: 0, tolerance: 1e-7, unit: 'mg_per_kg_solvent', closed: true, spatial
        }]
      };
      const spec = { events: [{
        step: 1, type: 'test_boundary', fluid_boundary_source: 'test Cu boundary',
        fluid_transform: { add: { Cu: 10 } }
      }] };
      const targetValue = (field) => field === 'pH' ? 7
        : field === 'reactiveSilicaFraction' || field === 'concentration' ? 1 : 0;
      const replacementFields = Object.fromEntries(
        EVIDENCE_FLUID_BOUNDARY_FIELDS.map((field) => [field, targetValue(field)])
      );
      const replacementSpatial = (field) => {
        const target = targetValue(field);
        return {
          count: 2, beforeFiniteCount: 2,
          unit: field === 'pH' ? 'pH'
            : field === 'Eh' ? 'mV'
              : field === 'reactiveSilicaFraction' ? 'fraction'
                : field === 'concentration' ? 'multiplier' : 'mg_per_kg_solvent',
          targetValuePerFluid: target,
          beforeValueTotal: target * 2,
          expectedAfterValueTotal: target * 2,
          scope: 'canonical-wet-voxel-volume', afterCount: 2, afterFiniteCount: 2,
          afterValueTotal: target * 2, expectedNet: 0, actualNet: 0,
          error: 0, tolerance: 1e-7, closed: true,
          fluxBasis: 'authenticated-net-only; gross-per-voxel-replacement-exchange-not-published'
        };
      };
      const replacement = {
        schema: 'fully-mixed-fluid-replacement-v1', step: 2,
        source: 'test exact replacement', spatial_scope: 'canonical-wet-voxel-volume',
        declarations: [{
          kind: 'replacement', source: 'test exact replacement', fields: replacementFields
        }],
        testimony: EVIDENCE_FLUID_BOUNDARY_FIELDS.map((field) => {
          const target = targetValue(field);
          return {
            field, before: target, after: target, declaredAddition: 0,
            declaredReplacementTarget: target, declaredDelta: 0,
            declaredImports: 0, declaredExports: 0, actualDelta: 0,
            error: 0, tolerance: 1e-7,
            unit: replacementSpatial(field).unit,
            closed: true, spatial: replacementSpatial(field)
          };
        }),
        authority_before: {
          sulfurPoolsExplicit: false, sulfateInherited: false, nativeSulfurPathway: null
        },
        authority_before_spatial: {
          count: 2, sulfurPoolsExplicitCount: 0, sulfateInheritedCount: 0,
          nativeSulfurPathways: { null: 2 }
        },
        authority_target: {
          sulfurPoolsExplicit: false, sulfateInherited: false, nativeSulfurPathway: null
        },
        authority_after: {
          sulfurPoolsExplicit: false, sulfateInherited: false, nativeSulfurPathway: null
        },
        authority_after_spatial: {
          count: 2, sulfurPoolsExplicitCount: 0, sulfateInheritedCount: 0,
          nativeSulfurPathways: { null: 2 }
        },
        authority_closed: true,
        sulfur_spatial_testimony: Object.fromEntries(
          ['S', 'S_sulfide', 'S_sulfate', 'S_elemental'].map((field) => [
            field,
            {
              count: 2, beforeFiniteCount: 2, unit: 'mg_per_kg_solvent',
              targetValuePerFluid: 0, beforeValueTotal: 0,
              expectedAfterValueTotal: 0, scope: 'canonical-wet-voxel-volume',
              fluxBasis: 'authenticated-net-only; gross-per-voxel-replacement-exchange-not-published',
              afterCount: 2, afterFiniteCount: 2, afterValueTotal: 0,
              expectedNet: 0, actualNet: 0, error: 0, tolerance: 1e-7, closed: true
            }
          ])
        ),
        sulfur_spatial_closed: true,
        closed: true
      };
      const summary = buildFluidBoundaryTestimony([valid], spec);
      if (summary.transaction_count !== 1 || summary.closed_transaction_count !== 1
          || summary.all_closed !== true) process.exit(2);
      const replacementSummary = buildFluidBoundaryTestimony([replacement]);
      if (replacementSummary.transaction_count !== 1
          || replacementSummary.all_closed !== true) process.exit(5);
      const forgedRows = [
        { ...valid, spatial_scope: undefined },
        { ...valid, closed: false },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: null }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, closed: false } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, afterCount: 1 } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, actualNet: 19 } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, afterValueTotal: 29 } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, error: null } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: { ...spatial, actualNet: '20' } }] },
        { ...valid, sample_index: -1 },
        { ...valid, testimony: [{ ...valid.testimony[0], spatial: {
          ...spatial, declaredIncreaseTotal: 120, declaredDecreaseTotal: 100
        } }] },
        { ...valid, testimony: [{ ...valid.testimony[0], tolerance: 1e9,
          spatial: { ...spatial, tolerance: 1e9 } }] },
        { ...valid, declarations: [] },
        { ...valid, testimony: [valid.testimony[0], structuredClone(valid.testimony[0])] },
        { ...valid, declarations: [{ ...valid.declarations[0], source: 'forged source' }] },
        { ...valid, authority_closed: true, sulfur_spatial_testimony: { banana: true } },
        { ...valid, declarations: [{ ...valid.declarations[0], authority: 'smuggled' }] },
        { ...valid, testimony: [{ ...valid.testimony[0], authority: 'smuggled' }] },
        { ...valid,
          declarations: [{ ...valid.declarations[0], fields: { Cu: 10, Fe: 5 } }]
        },
        (() => {
          const forged = structuredClone(valid);
          forged.declarations[0].fields.Cu = 20;
          Object.assign(forged.testimony[0], {
            after: 25, declaredAddition: 20, declaredDelta: 20,
            declaredImports: 20, actualDelta: 20
          });
          Object.assign(forged.testimony[0].spatial, {
            declaredIncreaseTotal: 40, expectedAfterValueTotal: 50,
            afterValueTotal: 50, expectedNet: 40, actualNet: 40
          });
          return forged;
        })(),
        { ...valid, schema: 'fully-mixed-fluid-replacement-v1',
          source: 'test Cu boundary' },
        (() => {
          const forged = structuredClone(replacement);
          delete forged.authority_target;
          return forged;
        })(),
        (() => {
          const forged = structuredClone(replacement);
          forged.sulfur_spatial_testimony.S.declaredIncreaseTotal = 100;
          forged.sulfur_spatial_testimony.S.declaredDecreaseTotal = 100;
          return forged;
        })(),
        (() => {
          const forged = structuredClone(replacement);
          forged.schema = 'fluid-boundary-v1';
          for (const field of [
            'source', 'authority_before', 'authority_before_spatial', 'authority_after',
            'authority_after_spatial', 'authority_target', 'authority_closed',
            'sulfur_spatial_testimony', 'sulfur_spatial_closed'
          ]) delete forged[field];
          return forged;
        })(),
        (() => {
          const forged = structuredClone(valid);
          forged.declarations[0].fields = { banana: 10 };
          forged.testimony[0].field = 'banana';
          return forged;
        })()
      ];
      for (const forged of forgedRows) {
        try {
          buildFluidBoundaryTestimony([forged], spec);
          process.exit(3);
        } catch (error) {
          if (!/fluid-boundary/.test(String(error?.message || error))) {
            console.error(error);
            process.exit(4);
          }
        }
      }
      const extra = structuredClone(valid);
      extra.step = 99;
      try {
        buildFluidBoundaryTestimony([valid, extra], spec);
        process.exit(6);
      } catch (error) {
        if (!/fluid-boundary/.test(String(error?.message || error))) {
          console.error(error);
          process.exit(7);
        }
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('rejects a self-consistent-looking morphology row whose regime contradicts its surface sigma', () => {
    const moduleUrl = pathToFileURL(path.join(ROOT, 'tools', 'review-claim-card.mjs')).href;
    const script = `
      import { buildMorphologyLayerTestimony } from ${JSON.stringify(moduleUrl)};
      const forged = [{
        step: 1, crystal_id: 1, zone_index: 0, mineral: 'pyrite',
        thickness_um: 10, is_phantom: false, remaining_solid_um: null,
        morphology: {
          status: 'classified', sigma_basis: 'post-step', post_step_sigma: 1.2,
          surface_sigma: 1.2, regime: 'dendritic', form: 'cubic', unavailable_reason: null
        }
      }];
      const registry = { pyrite: {
        SPIRAL_MAX: 1.6, STEP_MILD_MAX: 2.4, STEP_MACRO_MAX: 3.5, HOPPER_MAX: 4.2
      } };
      try {
        buildMorphologyLayerTestimony(forged, registry);
        console.error('forged morphology unexpectedly accepted');
        process.exit(3);
      } catch (error) {
        if (!/recorded regime disagrees/.test(String(error?.message || error))) {
          console.error(error);
          process.exit(4);
        }
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('rejects coerced layer identity, thickness, mineral, and phantom fields at the producer boundary', () => {
    const moduleUrl = pathToFileURL(path.join(ROOT, 'tools', 'review-claim-card.mjs')).href;
    const script = `
      import { buildMorphologyLayerTestimony } from ${JSON.stringify(moduleUrl)};
      const registry = { pyrite: {
        SPIRAL_MAX: 1.6, STEP_MILD_MAX: 2.4, STEP_MACRO_MAX: 3.5, HOPPER_MAX: 4.2
      } };
      const morphology = {
        status: 'classified', unavailable_reason: null, sigma_basis: 'post-step',
        post_step_sigma: 1.2, surface_sigma: 1.2, regime: 'spiral_smooth', form: 'cubic'
      };
      const valid = {
        step: 1, crystal_id: 1, zone_index: 0, mineral: 'pyrite', thickness_um: 10,
        is_phantom: false, morphology
      };
      const forgedRows = [
        [{ ...valid, thickness_um: '10' }],
        [{ ...valid, mineral: ['pyrite'] }],
        [{ ...valid, step: '1' }],
        [{ ...valid, crystal_id: '1' }],
        [{ ...valid, is_phantom: 'false' }]
      ];
      for (const forged of forgedRows) {
        try {
          buildMorphologyLayerTestimony(forged, registry);
          console.error('coerced morphology layer unexpectedly accepted');
          process.exit(3);
        } catch (error) {
          if (!/noncanonical identity, zone, mineral, thickness, or phantom schema/.test(String(error?.message || error))) {
            console.error(error);
            process.exit(4);
          }
        }
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('authenticates a fully erased shell only as no-surviving-interface testimony', () => {
    const moduleUrl = pathToFileURL(path.join(ROOT, 'tools', 'review-claim-card.mjs')).href;
    const script = `
      import { buildMorphologyLayerTestimony } from ${JSON.stringify(moduleUrl)};
      const registry = { pyrite: {
        SPIRAL_MAX: 1.6, STEP_MILD_MAX: 2.4, STEP_MACRO_MAX: 3.5, HOPPER_MAX: 4.2
      } };
      const row = {
        step: 1, crystal_id: 1, zone_index: 0, mineral: 'pyrite',
        thickness_um: 10, is_phantom: false, remaining_solid_um: 0,
        morphology: {
          status: 'unavailable-no-surviving-interface',
          unavailable_reason: 'no-surviving-interface-after-same-step-dissolution',
          sigma_basis: 'post-step-no-solid-interface', post_step_sigma: null,
          surface_sigma: null, regime: null, form: null
        }
      };
      const loss = {
        step: 1, crystal_id: 1, zone_index: 1, mineral: 'pyrite',
        thickness_um: -10, is_phantom: true, remaining_solid_um: null,
        morphology: {
          status: null, unavailable_reason: null, sigma_basis: null, post_step_sigma: null,
          surface_sigma: null, regime: null, form: null
        }
      };
      const summary = buildMorphologyLayerTestimony([row, loss], registry);
      if (summary.unavailable_layer_count !== 1 || summary.classified_layer_count !== 0) {
        console.error(summary);
        process.exit(3);
      }
      const invalidLedgers = [
        [row],
        [row, { ...loss, crystal_id: 2, zone_index: 0 }],
        [row, { ...loss, step: 2 }],
        [row, { ...loss, thickness_um: -9 }],
        [{ ...loss, zone_index: 0 }, { ...row, zone_index: 1 }],
        [row, { ...loss, zone_index: 0 }],
        [{ ...row, zone_index: 1 }, { ...loss, zone_index: 2 }],
        [row, { ...loss, zone_index: 2 }],
        [
          { ...row, step: 0, zone_index: 0, thickness_um: 5, remaining_solid_um: null,
            morphology: { ...row.morphology, status: 'classified', unavailable_reason: null,
              sigma_basis: 'post-step', post_step_sigma: 1.2,
              surface_sigma: 1.2, regime: 'spiral_smooth', form: 'cubic' } },
          { ...loss, zone_index: 1, thickness_um: -10 },
          { ...row, zone_index: 2, thickness_um: 5 }
        ],
        [{ ...row, remaining_solid_um: 1 }, loss]
      ];
      for (const ledger of invalidLedgers) {
        try {
          buildMorphologyLayerTestimony(ledger, registry);
          console.error('unclosed no-interface morphology unexpectedly accepted');
          process.exit(4);
        } catch (error) {
          if (!/(without same-step physical dissolution|not contiguous from zero|negative physical-solid inventory)/
            .test(String(error?.message || error))) {
            console.error(error);
            process.exit(5);
          }
        }
      }
      row.morphology.regime = 'spiral_smooth';
      try {
        buildMorphologyLayerTestimony([row, loss], registry);
        console.error('erased shell with a surviving regime unexpectedly accepted');
        process.exit(6);
      } catch (error) {
        if (!/malformed no-surviving-interface/.test(String(error?.message || error))) {
          console.error(error);
          process.exit(7);
        }
      }
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('builds and inspects every current scenario card, including executed testimony', () => {
    const stripDir = path.join(ROOT, 'archive', 'strips', `v${SIM_VERSION}`);
    const files = fs.readdirSync(stripDir).filter(name => name.endsWith('.json')).sort();
    const scenarioNames = Object.keys(SCENARIOS).sort();
    expect(files.map(name => name.replace(/\.json$/, ''))).toEqual(scenarioNames);

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-claim-cards-'));
    try {
      const mechanismArtifact = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`),
        'utf8',
      ));
      expect(verifyMechanismWitnessArtifact(ROOT, mechanismArtifact, {
        simVersion: SIM_VERSION,
        modelDigest: MODEL_DIGEST,
      })).toBe(true);
      let formulaLayerCount = 0;
      let solidSolutionLayerCount = 0;
      let cdrReplacementCount = 0;
      let reactivityControlCount = 0;
      let citedSizeAuthorityCount = 0;
      let claimCitationCount = 0;
      let enclosureReceiptCount = 0;
      const run = spawnSync(process.execPath, [
        'tools/review-claim-card.mjs', '--all', '--version', String(SIM_VERSION), '--out', outDir,
      ], { cwd: ROOT, encoding: 'utf8' });
      expect(run.status, `claim-card CLI\n${run.stdout}\n${run.stderr}`).toBe(0);
      expect(fs.readdirSync(outDir).filter(name => name.endsWith('.json')).sort())
        .toEqual(scenarioNames.map(name => `${name}.json`));

      for (const scenario of scenarioNames) {
        const spec = SCENARIOS[scenario]._json5_spec;
        const stripBytes = fs.readFileSync(path.join(stripDir, `${scenario}.json`));
        const strip = JSON.parse(stripBytes.toString('utf8'));
        const card = JSON.parse(fs.readFileSync(path.join(outDir, `${scenario}.json`), 'utf8'));

      expect(card, `${scenario}: identity`).toMatchObject({
        schema: 'vugg-claim-card-v2',
        scenario,
        sim_version: SIM_VERSION,
        model_digest: MODEL_DIGEST,
        scenario_spec_hash: strip.scenario_spec_hash,
        strip_steps: strip.steps,
        strip_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(card.claim.expects_species, `${scenario}: authored species`).toEqual(spec.expects_species || []);
      expect(card.strip_sha256, `${scenario}: strip content binding`)
        .toBe(crypto.createHash('sha256').update(stripBytes).digest('hex'));
      expect(card.claim.expectation_contract.deterministic, `${scenario}: deterministic contract`)
        .toEqual([
          ...(spec.expects_species || []).map((mineral: string) => ({
            mineral,
            reason: 'Authored headline release promise.',
            headline: true,
          })),
          ...(spec.deterministic_species || []).map((entry: any) => ({
            ...entry,
            headline: false,
          })),
        ]);
      expect(card.claim.expectation_contract.deterministic_headline, `${scenario}: deterministic headline`)
        .toEqual(spec.expects_species || []);
      expect(card.claim.expectation_contract.deterministic_accessory, `${scenario}: deterministic accessories`)
        .toEqual(spec.deterministic_species || []);
      expect(card.claim.expectation_contract.statistical, `${scenario}: statistical contract`)
        .toEqual(spec.statistical_species || []);
      expect(card.claim.expectation_contract.aspirational, `${scenario}: aspirational contract`)
        .toEqual(spec.aspirational_species || []);
      expect(card.claim.excluded_species, `${scenario}: locality exclusions`)
        .toEqual(spec.excluded_species || {});
      expect(card.claim.claim_citations, `${scenario}: claim-level citations`)
        .toEqual(spec.claim_citations || []);
      claimCitationCount += card.claim.claim_citations.length;
      expect(card.claim.authored_science_context.model_digest, `${scenario}: authored science digest`).toBe(MODEL_DIGEST);
      expect(card.claim.authored_science_context.growth_budget, `${scenario}: disclosed growth-budget boundary`)
        .toEqual(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE);
      expect(card.claim.authored_science_context.growth_budget.is_physical_mass_conservation).toBe(false);

      const eventCount = new Map<string, number>();
      for (const event of strip.nucleation_events || []) {
        eventCount.set(event.mineral, (eventCount.get(event.mineral) || 0) + 1);
      }
      const transformationCount = new Map<string, number>();
      for (const event of strip.executed_testimony?.transformations || []) {
        transformationCount.set(event.to, (transformationCount.get(event.to) || 0) + 1);
      }
      const delivered = new Set([...eventCount.keys(), ...transformationCount.keys()]);
      expect(card.testimony.paragenetic_order, `${scenario}: all appearance testimony`)
        .toHaveLength(delivered.size);
      for (const entry of card.testimony.paragenetic_order) {
        expect(entry.events, `${scenario}: ${entry.mineral} event count`)
          .toBe(eventCount.get(entry.mineral) || 0);
        expect(entry.transformations, `${scenario}: ${entry.mineral} transformation count`)
          .toBe(transformationCount.get(entry.mineral) || 0);
      }

      expect(card.testimony.expected_no_shows, `${scenario}: deterministic contract must deliver`).toEqual([]);
      expect(card.testimony.excluded_species_appearances, `${scenario}: exclusions must hold`).toEqual([]);

      const executed = card.testimony.executed_science;
      expect(executed.pressure_phase_sample_count, `${scenario}: pressure samples`).toBe(strip.steps);
      expect(executed.stress_events, `${scenario}: stress testimony`)
        .toEqual(strip.executed_testimony?.stress_events || []);
      expect(executed.transformations, `${scenario}: transformation testimony`)
        .toEqual(strip.executed_testimony?.transformations || []);
      expect(executed.carbonate_boundary.samples, `${scenario}: carbonate-boundary testimony`)
        .toEqual(strip.executed_testimony?.carbonate_boundary || []);
      expect(executed.carbonate_boundary.sample_count, `${scenario}: carbonate-boundary sample count`)
        .toBe(spec.carbonate_boundary ? strip.steps : 0);
      const sulfurSamples = strip.executed_testimony?.sulfur_ledger || [];
      expect(executed.sulfur_ledger.samples, `${scenario}: sulfur-ledger testimony`)
        .toEqual(sulfurSamples);
      expect(executed.sulfur_ledger.sample_count, `${scenario}: sulfur-ledger sample count`)
        .toBe(sulfurSamples.length);
      expect(executed.sulfur_ledger.closed_sample_count, `${scenario}: sulfur-ledger closure count`)
        .toBe(sulfurSamples.filter((sample: any) => sample.closed && sample.testimonyClosed).length);
      expect(executed.sulfur_ledger.all_closed, `${scenario}: sulfur-ledger closure`)
        .toBe(sulfurSamples.length ? true : null);
      const fluidBoundarySamples = strip.executed_testimony?.fluid_boundary || [];
      expect(executed.fluid_boundary.transactions, `${scenario}: fluid-boundary testimony`)
        .toEqual(fluidBoundarySamples);
      expect(executed.fluid_boundary.transaction_count, `${scenario}: fluid-boundary transaction count`)
        .toBe(fluidBoundarySamples.length);
      expect(executed.fluid_boundary.closed_transaction_count, `${scenario}: fluid-boundary closure count`)
        .toBe(fluidBoundarySamples.filter((sample: any) => sample.closed).length);
      expect(executed.fluid_boundary.all_closed, `${scenario}: fluid-boundary closure`)
        .toBe(fluidBoundarySamples.length ? true : null);
      const playerActionSamples = strip.executed_testimony?.player_actions || [];
      expect(executed.player_actions.actions, `${scenario}: player-action testimony`)
        .toEqual(playerActionSamples);
      expect(executed.player_actions.action_count, `${scenario}: player-action count`)
        .toBe(playerActionSamples.length);
      const enclosureSamples = strip.executed_testimony?.enclosures || [];
      expect(executed.enclosures.events, `${scenario}: enclosure testimony`)
        .toEqual(enclosureSamples);
      expect(executed.enclosures.event_count, `${scenario}: enclosure event count`)
        .toBe(enclosureSamples.length);
      for (const receipt of enclosureSamples) {
        const layers = strip.executed_testimony?.layer_growth || [];
        if (receipt.schema === 'enclosure-receipt-v1') {
          expect(receipt.event).toBe('enclosed');
          expect(receipt.host_same_step_positive_growth_um).toBeGreaterThan(0);
          expect(receipt.host_same_step_net_growth_um).toBeGreaterThan(0);
          expect(receipt.size_ratio).toBeGreaterThan(3);
          expect(['guest-on-host', 'host-on-guest', 'geometric-overlap']).toContain(receipt.route);
          if (receipt.route === 'geometric-overlap') {
            expect(receipt.anchor_distance_mm).toBeLessThanOrEqual(receipt.footprint_reach_mm);
          }
          const hostStep = layers.filter((row: any) => row.crystal_id === receipt.host_crystal_id
            && row.step === receipt.step);
          const hostPositive = hostStep.reduce((sum: number, row: any) =>
            sum + (row.thickness_um > 0 && !row.is_phantom ? row.thickness_um : 0), 0);
          const hostNegative = hostStep.reduce((sum: number, row: any) =>
            sum + (row.thickness_um < 0 ? Math.abs(row.thickness_um) : 0), 0);
          expect(hostPositive).toBeCloseTo(receipt.host_same_step_positive_growth_um, 12);
          expect(hostNegative).toBeCloseTo(receipt.host_same_step_negative_growth_um, 12);
          expect(hostPositive - hostNegative).toBeCloseTo(receipt.host_same_step_net_growth_um, 12);
          const hostToStep = layers.filter((row: any) => row.crystal_id === receipt.host_crystal_id
            && row.step <= receipt.step);
          const hostPhysical = hostToStep.reduce((sum: number, row: any) => {
            if (row.thickness_um > 0 && !row.is_phantom) return sum + row.thickness_um;
            if (row.thickness_um < 0) return sum - Math.abs(row.thickness_um);
            return sum;
          }, 0);
          expect(hostPhysical).toBeCloseTo(receipt.host_physical_size_at_enclosure_um, 10);

          const guestToStep = layers.filter((row: any) => row.crystal_id === receipt.guest_crystal_id
            && row.step <= receipt.step);
          const guestCore = guestToStep.reduce((sum: number, row: any) =>
            sum + (row.thickness_um > 0 && !row.is_phantom ? row.thickness_um : 0), 0);
          const guestLoss = guestToStep.reduce((sum: number, row: any) =>
            sum + (row.thickness_um < 0 ? Math.abs(row.thickness_um) : 0), 0);
          expect(guestCore).toBeCloseTo(receipt.guest_positive_core_um, 12);
          expect(guestLoss).toBeCloseTo(receipt.guest_loss_um, 12);
          expect(guestCore - guestLoss).toBeCloseTo(receipt.guest_remaining_growth_um, 10);
        } else {
          expect(receipt).toMatchObject({
            schema: 'liberation-receipt-v1',
            event: 'liberated',
            host_still_has_solid: true,
          });
          const original = enclosureSamples.find((row: any) =>
            row.schema === 'enclosure-receipt-v1'
            && row.host_crystal_id === receipt.host_crystal_id
            && row.guest_crystal_id === receipt.guest_crystal_id
            && row.step === receipt.enclosure_step);
          expect(original, `${scenario}: liberation must reference an accepted enclosure`).toBeTruthy();
          expect(receipt.host_current_growth_um).toBeLessThan(receipt.liberation_threshold_um);
          expect(receipt.liberation_threshold_um)
            .toBeCloseTo(receipt.host_size_at_enclosure_um * 0.7, 12);
          const hostAtEnclosure = layers.filter((row: any) =>
            row.crystal_id === receipt.host_crystal_id && row.step <= receipt.enclosure_step)
            .reduce((sum: number, row: any) => {
              if (row.thickness_um > 0 && !row.is_phantom) return sum + row.thickness_um;
              if (row.thickness_um < 0) return sum - Math.abs(row.thickness_um);
              return sum;
            }, 0);
          const hostAtLiberation = layers.filter((row: any) =>
            row.crystal_id === receipt.host_crystal_id && row.step <= receipt.step)
            .reduce((sum: number, row: any) => {
              if (row.thickness_um > 0 && !row.is_phantom) return sum + row.thickness_um;
              if (row.thickness_um < 0) return sum - Math.abs(row.thickness_um);
              return sum;
            }, 0);
          expect(hostAtEnclosure).toBeCloseTo(receipt.host_size_at_enclosure_um, 10);
          expect(Math.max(0, hostAtLiberation)).toBeCloseTo(receipt.host_current_growth_um, 10);
        }
      }
      enclosureReceiptCount += enclosureSamples.length;
      expect(executed.crystal_layers.formula_layers, `${scenario}: formula-layer testimony`)
        .toEqual((strip.executed_testimony?.layer_growth || []).filter((z: any) => z.formula_stoichiometry));
      expect(executed.crystal_layers.solid_solution_layers, `${scenario}: solid-solution testimony`)
        .toEqual((strip.executed_testimony?.layer_growth || []).filter((z: any) => z.solid_solution));
      expect(executed.crystal_layers.binding_competition_allocations, `${scenario}: competition testimony`)
        .toEqual((strip.executed_testimony?.layer_growth || []).filter((z: any) => z.competition_allocation));
      expect(executed.crystal_layers.masked_horizons, `${scenario}: masked-horizon testimony`)
        .toEqual((strip.executed_testimony?.layer_growth || []).filter((z: any) => z.masked_horizon));
      const tenantMinerals = Object.keys(MORPH_TH).sort();
      const tenantSet = new Set(tenantMinerals);
      const layerRows = strip.executed_testimony?.layer_growth || [];
      for (const row of layerRows) {
        expect(typeof row.step === 'number' && Number.isSafeInteger(row.step) && row.step >= 0).toBe(true);
        expect(typeof row.crystal_id === 'number' && Number.isSafeInteger(row.crystal_id)
          && row.crystal_id > 0).toBe(true);
        expect(typeof row.zone_index === 'number' && Number.isSafeInteger(row.zone_index)
          && row.zone_index >= 0).toBe(true);
        expect(typeof row.mineral === 'string' && row.mineral.length > 0).toBe(true);
        expect(typeof row.thickness_um === 'number' && Number.isFinite(row.thickness_um)).toBe(true);
        expect(typeof row.is_phantom).toBe('boolean');
      }
      const positiveMorphologyLayers = layerRows.filter((row: any) =>
        row.thickness_um > 0 && tenantSet.has(row.mineral));
      const regimeCounts: Record<string, number> = {};
      const basisCounts: Record<string, number> = {};
      const terminalDepletedLayers: any[] = [];
      const unavailableLayers: any[] = [];
      for (const row of positiveMorphologyLayers) {
        const morphology = row.morphology;
        expect(morphology, `${scenario}: ${row.mineral} step ${row.step} morphology object`).toBeTruthy();
        if (morphology.status === 'classified') {
          expect(['post-step', 'post-step-terminal-depleted']).toContain(morphology.sigma_basis);
          expect(Number.isFinite(morphology.post_step_sigma)).toBe(true);
          expect(Number.isFinite(morphology.surface_sigma)).toBe(true);
          expect(MORPHOLOGY_REGIMES.has(morphology.regime)).toBe(true);
          expect(morphology.regime).toBe(morphRegime(
            MORPH_TH[String(row.mineral)], morphology.surface_sigma,
          ));
          expect(typeof morphology.form === 'string' && morphology.form.length > 0).toBe(true);
          expect(morphology.unavailable_reason).toBeNull();
          expect(morphology.sigma_basis === 'post-step-terminal-depleted')
            .toBe(morphology.post_step_sigma < 1);
          regimeCounts[morphology.regime] = (regimeCounts[morphology.regime] || 0) + 1;
          basisCounts[morphology.sigma_basis] = (basisCounts[morphology.sigma_basis] || 0) + 1;
          if (morphology.sigma_basis === 'post-step-terminal-depleted') {
            terminalDepletedLayers.push(row);
          }
        } else if (morphology.status === 'unavailable-nonfinite-post-step') {
          expect(morphology).toEqual({
            status: 'unavailable-nonfinite-post-step',
            unavailable_reason: 'nonfinite-post-step-sigma',
            sigma_basis: 'post-step-unavailable',
            post_step_sigma: null,
            regime: null,
            form: null,
            surface_sigma: null,
          });
          expect(row.remaining_solid_um).toBe(0);
          unavailableLayers.push(row);
          basisCounts['post-step-unavailable'] = (basisCounts['post-step-unavailable'] || 0) + 1;
        } else if (morphology.status === 'unavailable-derived-morphology') {
          expect(morphology.status).toBe('unavailable-derived-morphology');
          expect([
            'nonfinite-effective-sigma-multiplier',
            'nonfinite-surface-sigma',
            'missing-crystallographic-form',
          ]).toContain(morphology.unavailable_reason);
          expect(['post-step', 'post-step-terminal-depleted']).toContain(morphology.sigma_basis);
          expect(Number.isFinite(morphology.post_step_sigma)).toBe(true);
          expect(morphology.sigma_basis === 'post-step-terminal-depleted')
            .toBe(morphology.post_step_sigma < 1);
          expect(morphology.regime).toBeNull();
          expect(morphology.form).toBeNull();
          expect(morphology.surface_sigma).toBeNull();
          unavailableLayers.push(row);
          basisCounts[morphology.sigma_basis] = (basisCounts[morphology.sigma_basis] || 0) + 1;
        } else {
          expect(morphology).toEqual({
            status: 'unavailable-no-surviving-interface',
            unavailable_reason: 'no-surviving-interface-after-same-step-dissolution',
            sigma_basis: 'post-step-no-solid-interface',
            post_step_sigma: null,
            regime: null,
            form: null,
            surface_sigma: null,
          });
          const sameCrystalThroughStep = layerRows.filter((candidate: any) =>
            candidate.crystal_id === row.crystal_id && candidate.step <= row.step);
          const physicalPositiveUm = sameCrystalThroughStep.reduce((sum: number, candidate: any) =>
            sum + (candidate.thickness_um > 0 && !candidate.is_phantom
              ? candidate.thickness_um : 0), 0);
          const physicalLossUm = sameCrystalThroughStep.reduce((sum: number, candidate: any) =>
            sum + (candidate.thickness_um < 0 ? Math.abs(candidate.thickness_um) : 0), 0);
          const sameStepLossUm = layerRows.reduce((sum: number, candidate: any) =>
            sum + (candidate.crystal_id === row.crystal_id
              && candidate.step === row.step
              && candidate.zone_index > row.zone_index
              && candidate.thickness_um < 0
              ? Math.abs(candidate.thickness_um) : 0), 0);
          expect(sameStepLossUm).toBeGreaterThan(0);
          expect(Math.abs(physicalPositiveUm - physicalLossUm))
            .toBeLessThanOrEqual(Math.max(1e-9, physicalPositiveUm * 1e-12));
          unavailableLayers.push(row);
          basisCounts['post-step-no-solid-interface'] =
            (basisCounts['post-step-no-solid-interface'] || 0) + 1;
        }
      }
      expect(executed.crystal_layers.morphology, `${scenario}: complete morphology summary`).toEqual({
        source: 'all positive layers for MORPH_TH-registered minerals; exact rows are authenticated by the strip SHA-256',
        tenant_minerals: tenantMinerals,
        positive_layer_count: positiveMorphologyLayers.length,
        classified_layer_count: positiveMorphologyLayers.length - unavailableLayers.length,
        unavailable_layer_count: unavailableLayers.length,
        terminal_depleted_layer_count: terminalDepletedLayers.length,
        regime_counts: regimeCounts,
        basis_counts: basisCounts,
        terminal_depleted_layers: terminalDepletedLayers,
        unavailable_layers: unavailableLayers,
      });
      expect(executed.habit_morphology.crystals, `${scenario}: habit testimony`)
        .toEqual(strip.executed_testimony?.habit_morphology || []);
      expect(executed.habit_morphology.surface_films, `${scenario}: surviving-film testimony`)
        .toEqual((strip.executed_testimony?.habit_morphology || []).filter((c: any) => c.surface_film));
      formulaLayerCount += executed.crystal_layers.formula_layers.length;
      solidSolutionLayerCount += executed.crystal_layers.solid_solution_layers.length;
      cdrReplacementCount += executed.habit_morphology.crystals
        .filter((crystal: any) => crystal.cdr_replacement_evidence).length;
      citedSizeAuthorityCount += executed.habit_morphology.crystals
        .filter((crystal: any) => (crystal.size_authority?.sources || []).length > 0).length;
      for (const event of executed.transformations.filter((row: any) => row.mechanism === 'dehydration')) {
        expect(event.dehydration?.formula_amount_mmol_kg,
          `${scenario}: dehydration testimony must represent positive parent solid`).toBeGreaterThan(0);
      }
      const transformedProducts = new Set(executed.transformations.map((event: any) => event.to));
      const finalMinerals = new Set(executed.habit_morphology.crystals.map((crystal: any) => crystal.mineral));
      const expectedControls = mechanismArtifact.payload.transformation_reactivity
        .filter((control: any) => control.claim_card_scenario === scenario);
      for (const control of expectedControls) {
        if (control.claim_card_link === 'executed-transformation-product') {
          expect(transformedProducts, `${scenario}: ${control.mineral} transformation-product link`)
            .toContain(control.mineral);
        } else {
          expect(finalMinerals, `${scenario}: ${control.mineral} surviving-parent link`)
            .toContain(control.parent_mineral);
        }
      }
      expect(executed.transformation_reactivity_commissioning,
        `${scenario}: authenticated reactivity commissioning`).toMatchObject({
        role: 'controlled production-engine boundary; not a locality trajectory',
        artifact_schema: mechanismArtifact.schema,
        artifact_payload_sha256: mechanismArtifact.payload_sha256,
        link_authority: 'artifact-authored scenario route, verified against executed product or surviving parent',
        controls: expectedControls,
      });
      reactivityControlCount += expectedControls.length;
      if (scenario === mechanismArtifact.payload.player_movement_choice.scenario) {
        expect(executed.player_choice_commissioning,
          `${scenario}: controlled divergent player branch`).toMatchObject({
          role: 'controlled production GAME-02 branch; not a locality trajectory claim',
          artifact_schema: mechanismArtifact.schema,
          artifact_payload_sha256: mechanismArtifact.payload_sha256,
          control: mechanismArtifact.payload.player_movement_choice,
        });
      } else {
        expect(executed.player_choice_commissioning).toBeNull();
      }
      if (sulfurSamples.length) {
        expect(executed.sulfur_ledger.activation, `${scenario}: sulfur-ledger activation`)
          .toEqual(sulfurSamples[0].activation);
        expect(executed.sulfur_ledger.first_fluid_reservoir_ppm)
          .toEqual(sulfurSamples[0].fluidReservoirPpm);
        expect(executed.sulfur_ledger.last_solid_reservoir_ppm)
          .toEqual(sulfurSamples.at(-1).solidReservoirPpm);
        for (const phase of executed.sulfur_ledger.phase_identities) {
          expect(phase).toMatchObject({
            mineral: expect.any(String),
            reservoir: expect.stringMatching(/^(sulfide|sulfate|elemental|unclassified)$/),
            max_booked_solid_ppm: expect.any(Number),
          });
        }
      }
      expect(Object.keys(card.testimony.saturation_indices).sort(), `${scenario}: SI cards`)
        .toEqual(Object.keys(strip.chips).filter(key => key.startsWith('SI_')).sort());

      if (scenario === 'sabkha_dolomitization') {
        expect(card.testimony.environment.salinity).toMatchObject({
          max: 250,
          source: 'raw_simulation_state',
          quantized_display_clipping: {
            range: [0, 200],
            upper: true,
            reported_values_use_raw_state: true,
          },
        });
      }

        const markdown = fs.readFileSync(path.join(outDir, `${scenario}.md`), 'utf8');
        expect(markdown, `${scenario}: rendered digest`).toContain(`**Model digest:** ${MODEL_DIGEST}`);
        expect(markdown, `${scenario}: rendered spec identity`).toContain(`**Scenario spec hash:** ${strip.scenario_spec_hash}`);
        expect(markdown, `${scenario}: rendered strip digest`).toContain(`**Archived strip SHA-256:** ${card.strip_sha256}`);
        expect(markdown, `${scenario}: rendered model boundary`).toContain('Model boundary: calibrated growth budget');
        expect(markdown, `${scenario}: rendered expectation contract`).toContain('Expectation contract');
        expect(markdown, `${scenario}: deterministic delivery`).toContain('**Deterministic no-shows:** (none)');
        expect(markdown, `${scenario}: rendered physical limitation`).toContain('not physical solid mass or volume');
        expect(markdown, `${scenario}: authored section`).toContain('Authored pressure/stress/phase context');
        expect(markdown, `${scenario}: executed section`).toContain('Executed pressure/stress/phase testimony');
        expect(markdown, `${scenario}: carbonate testimony`).toContain('Conserved carbonate boundary:');
        expect(markdown, `${scenario}: sulfur testimony`).toContain('Sulfur reservoir identity and conservation');
        expect(markdown, `${scenario}: enclosure testimony`).toContain('Crystal enclosure receipts');
        expect(markdown, `${scenario}: layer testimony`).toContain('Layer, solid-solution, competition, and habit testimony');
        expect(markdown, `${scenario}: morphology completeness`).toContain('Registered-mineral morphology: positive=');
        expect(markdown, `${scenario}: reactivity testimony`).toContain('Transformation reactivity commissioning:');
        if (scenario === 'elmwood') {
          expect(card.claim.claim_citations.map((c: any) => c.claim_id)).toContain('elmwood-celestine-license');
          expect(card.claim.claim_citations.map((c: any) => c.claim_id)).toContain('elmwood-masked-layer-hypothesis');
          expect(markdown).toContain('celestine-individual-size');
          const elmwoodBa = executed.fluid_boundary.transactions.filter((tx: any) =>
            (tx.testimony || []).some((row: any) => row.field === 'Ba'));
          expect(elmwoodBa.map((tx: any) => tx.step), 'Elmwood Ba boundary sequence')
            .toEqual([28, 40, 50, 60, 68, 78]);
          expect(elmwoodBa.every((tx: any) => tx.closed), 'Elmwood Ba boundary closure').toBe(true);
          const horizons = executed.crystal_layers.masked_horizons
            .filter((row: any) => row.mineral === 'barite');
          expect([...new Set(horizons.map((row: any) => row.step))], 'Elmwood breakthrough steps')
            .toEqual([50, 68]);
          expect([...new Set(horizons.map((row: any) => row.originating_film_step))], 'Elmwood source-film steps')
            .toEqual([40, 60]);
          expect(horizons.length, 'Elmwood published masked horizons').toBeGreaterThan(0);
          expect(horizons.every((row: any) => row.thickness_um > 0
            && ['clay', 'iron oxide'].includes(row.film_mineral))).toBe(true);
          const finalFilms = executed.habit_morphology.surface_films
            .filter((row: any) => row.mineral === 'barite');
          expect(finalFilms.length, 'Elmwood published terminal rind').toBeGreaterThan(0);
          expect(finalFilms.every((row: any) => row.surface_film?.mineral === 'clay'
            && row.surface_film?.step === 78)).toBe(true);
          expect(markdown).toContain('Declared non-sulfur fluid-boundary transactions');
          expect(markdown).toContain('Masked horizon crystal');
          expect(markdown).toContain('Surviving surface film crystal');
        }
        if (scenario === 'bisbee') {
          const copperLoss = (strip.executed_testimony?.layer_growth || []).filter((row: any) =>
            row.mineral === 'native_copper' && row.thickness_um < 0);
          expect(copperLoss.length, 'Bisbee must archive a mass-booked native-Cu retreat')
            .toBe(5);
          expect(copperLoss.reduce((sum: number, row: any) => sum + Math.abs(row.thickness_um), 0))
            .toBeCloseTo(50, 12);
          expect(copperLoss.every((row: any) => Number(row.returned_budget_inventory?.Cu) > 0))
            .toBe(true);
          const copperEnclosure = enclosureSamples.filter((row: any) =>
            row.schema === 'enclosure-receipt-v1' && row.guest_mineral === 'native_copper');
          expect(copperEnclosure).toHaveLength(1);
          expect(copperEnclosure[0]).toMatchObject({
            step: 154,
            host_mineral: 'chrysocolla',
            route: 'host-on-guest',
            adjacency_authority: 'exact-substrate-id',
            guest_loss_um: 50,
            guest_partially_dissolved: true,
          });
        }
        if (sulfurSamples.length) {
          expect(markdown, `${scenario}: sulfur activation rendered`).toContain('Ledger activation: step');
          expect(markdown, `${scenario}: sulfur closure rendered`)
            .toContain(`Closure: ${sulfurSamples.length}/${sulfurSamples.length} samples; all_closed=true`);
          expect(markdown, `${scenario}: sulfur reservoirs rendered`).toContain('Fluid reservoirs (sulfide/sulfate/elemental)');
        }
        if (scenario === 'sabkha_dolomitization') {
          expect(markdown).toContain('salinity: 120 → 250 psu  [35, 250]');
          expect(markdown).toContain('quantized display range [0, 200] clipped, raw executed state reported');
        }

        const committedJson = fs.readFileSync(
          path.join(ROOT, 'archive', 'claim-cards', `v${SIM_VERSION}`, `${scenario}.json`),
          'utf8',
        );
        const committedMarkdown = fs.readFileSync(
          path.join(ROOT, 'archive', 'claim-cards', `v${SIM_VERSION}`, `${scenario}.md`),
          'utf8',
        );
        expect(fs.readFileSync(path.join(outDir, `${scenario}.json`), 'utf8'), `${scenario}: committed JSON card`).toBe(committedJson);
        expect(markdown, `${scenario}: committed Markdown card`).toBe(committedMarkdown);
      }
      expect(formulaLayerCount, 'fleet must publish formula-bearing crystal layers').toBeGreaterThan(0);
      expect(solidSolutionLayerCount, 'fleet must publish dynamic solid-solution layers').toBeGreaterThan(0);
      expect(cdrReplacementCount, 'fleet must publish a positive CDR replacement').toBeGreaterThan(0);
      expect(reactivityControlCount, 'fleet must link every transformation-only reactivity control').toBe(4);
      expect(citedSizeAuthorityCount, 'fleet habit testimony must retain size-authority sources').toBeGreaterThan(0);
      expect(claimCitationCount, 'claim-level citations must be materially populated').toBeGreaterThan(3);
      expect(enclosureReceiptCount, 'fleet must publish at least one physical enclosure receipt').toBeGreaterThan(0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
