import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyMechanismWitnessArtifact } from '../tools/gen-mechanism-witnesses.mjs';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalJson = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};
const rehashPayload = (artifact: any) => {
  artifact.payload_sha256 = crypto.createHash('sha256')
    .update(canonicalJson(artifact.payload)).digest('hex');
  return artifact;
};

describe('authenticated production mechanism witnesses', () => {
  it('publishes every transformation-only acid boundary through the accepted booked-layer path', () => {
    const file = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`);
    const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(verifyMechanismWitnessArtifact(ROOT, artifact, {
      simVersion: SIM_VERSION,
      modelDigest: MODEL_DIGEST,
    })).toBe(true);
    const controls = artifact.payload.transformation_reactivity;
    expect(controls.map((row: any) => row.mineral).sort()).toEqual([
      'haidingerite', 'meta-autunite', 'metatorbernite', 'metazeunerite',
    ]);
    for (const row of controls) {
      expect(row.role).toBe('controlled production-engine boundary; not a locality trajectory');
      expect(row.parent_mineral).toEqual(expect.any(String));
      expect(row.claim_card_scenario).toMatch(/^(schneeberg|wittichen)$/);
      expect(row.claim_card_link).toMatch(/^executed-(transformation-product|surviving-parent)$/);
      expect(row.positive_growth_above_boundary).toBe(false);
      expect(row.control_pH).toBeLessThan(row.pH_threshold);
      expect(row.accepted_etch).toMatchObject({
        dissolution_mode: 'acid',
        transformation_reactivity: {
          inventory_authority: 'booked-layer-lifo',
          positive_growth_allowed: false,
        },
      });
      expect(row.accepted_etch.thickness_um).toBeLessThan(0);
      expect(Math.max(...Object.values(row.closure_error_ppm).map(Number))).toBeLessThanOrEqual(1e-12);
    }
  });

  it('publishes local chalcanthite triggers, exact sulfate return, and enclosure withholding', () => {
    const file = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`);
    const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
    const controls = artifact.payload.chalcanthite_water_solubility.trigger_controls;
    expect(controls.map((row: any) => [row.name, row.dissolution_mode])).toEqual([
      ['salinity-only', 'water_solubility_low_salinity'],
      ['pH-only', 'water_solubility_high_pH'],
      ['combined', 'water_solubility_low_salinity_high_pH'],
      ['neither', null],
    ]);
    for (const row of controls.slice(0, 3)) {
      expect(row.role).toBe('controlled production-engine boundary; not a locality trajectory');
      expect(row.accepted_loss_um).toBe(4);
      expect(row.returned_budget_inventory).toMatchObject({
        Cu: row.expected_return_ppm.Cu,
        S_sulfate: row.expected_return_ppm.S_sulfate,
      });
      expect(row.returned_budget_inventory).not.toHaveProperty('S');
      expect(row.booked_local_delta_ppm).toEqual(row.expected_return_ppm);
      expect(row.booked_bulk_delta_ppm).toEqual({ Cu: 0, S: 0, S_sulfate: 0 });
      expect(row.strip_negative_layer).toMatchObject({
        thickness_um: -4,
        dissolution_mode: row.dissolution_mode,
        returned_budget_inventory: row.expected_return_ppm,
      });
    }
    expect(controls[3]).toMatchObject({
      accepted_loss_um: 0,
      dissolution_mode: null,
      strip_negative_layer: null,
      remaining_solid_um: 10,
    });
    expect(artifact.payload.chalcanthite_water_solubility.enclosure_control).toMatchObject({
      role: 'controlled production-engine boundary; not a locality trajectory',
      authority_before: true,
      authority_after: true,
      accepted_loss_um: 0,
      strip_negative_layer_count: 0,
      remaining_solid_um: 100,
    });
  });

  it('publishes a receipted Herkimer player choice with divergent geology', () => {
    const file = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`);
    const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
    const choice = artifact.payload.player_movement_choice;
    expect(choice).toMatchObject({
      role: 'controlled production GAME-02 branch; not a locality trajectory claim',
      scenario: 'cooling', seed: 42,
      authored_movement: { field: 'temperature', startStep: 0, endStep: 100, base: 180 },
      divergence: {
        crystal_summary_changed: true,
        state_fingerprint_changed: true,
      },
    });
    expect(choice.wait_only.player_actions).toEqual([]);
    expect(choice.wait_only.crystal_summary).toEqual([
      expect.objectContaining({ mineral: 'quartz', total_growth_um: expect.any(Number) }),
    ]);
    expect(choice.heat_choice.crystal_summary).toEqual([]);
    expect(choice.heat_choice.final_temperature_C - choice.wait_only.final_temperature_C)
      .toBeCloseTo(25, 10);
    expect(choice.heat_choice.player_actions).toEqual([
      expect.objectContaining({
        schema: 'player-movement-intervention-v1', action: 'heat',
        field: 'temperature', value_before: 180, value_after: 205,
        applied_delta: 25, sample_index: 0,
      }),
    ]);
  });

  it('rejects a self-rehashed player-choice branch with a rewritten intervention', () => {
    const file = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`);
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const forged = structuredClone(original);
    const choice = forged.payload.player_movement_choice;
    const action = choice.heat_choice.player_actions[0];
    action.value_after = 204;
    action.applied_delta = 24;
    action.movement_authority.applied_delta = 24;
    action.movement_authority.offset_after = 24;
    choice.heat_choice.final_temperature_C = choice.wait_only.final_temperature_C + 24;
    choice.divergence.final_temperature_delta_C = 24;
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forged), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/player movement-choice witness/);
  });

  it('rejects self-rehashed forged chalcanthite quantities, pools, closure, and enclosure', () => {
    const file = path.join(ROOT, 'archive', 'evidence', `mechanism-witnesses-v${SIM_VERSION}.json`);
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const forgedMode = structuredClone(original);
    forgedMode.payload.chalcanthite_water_solubility.trigger_controls[0]
      .dissolution_mode = 'water_solubility_high_pH';
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedMode), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/loss\/mode mismatch/);

    const forgedScale = structuredClone(original);
    const scaleRow = forgedScale.payload.chalcanthite_water_solubility.trigger_controls[0];
    for (const [species, value] of Object.entries({ Cu: 123, S_sulfate: 456 })) {
      scaleRow.expected_return_ppm[species] = value;
      scaleRow.returned_budget_inventory[species] = value;
      scaleRow.booked_local_delta_ppm[species] = value;
      scaleRow.booked_local_after_ppm[species] = value;
      scaleRow.strip_negative_layer.returned_budget_inventory[species] = value;
    }
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedScale), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/authoritative Cu transaction does not close/);

    const forgedPool = structuredClone(original);
    const poolRow = forgedPool.payload.chalcanthite_water_solubility.trigger_controls[1];
    poolRow.returned_budget_inventory.S_sulfide = 1;
    poolRow.booked_local_delta_ppm.S_sulfide = 1;
    poolRow.strip_negative_layer.returned_budget_inventory.S_sulfide = 1;
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedPool), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/transaction schema mismatch|wrong reservoir\/bulk/);

    const forgedBulk = structuredClone(original);
    forgedBulk.payload.chalcanthite_water_solubility.trigger_controls[2]
      .booked_bulk_delta_ppm.Cu = 0.001;
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedBulk), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/bulk transaction is not closed/);

    const forgedNeither = structuredClone(original);
    const neitherRow = forgedNeither.payload.chalcanthite_water_solubility.trigger_controls[3];
    neitherRow.booked_local_after_ppm.Cu = 99;
    neitherRow.booked_bulk_after_ppm.Cu = 88;
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedNeither), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/authoritative Cu transaction does not close|bulk transaction is not closed/);

    const forgedEnclosure = structuredClone(original);
    forgedEnclosure.payload.chalcanthite_water_solubility.enclosure_control.enclosure_receipt = {
      schema: 'enclosure-receipt-v1', guest_mineral: 'chalcanthite',
    };
    expect(() => verifyMechanismWitnessArtifact(ROOT, rehashPayload(forgedEnclosure), {
      simVersion: SIM_VERSION, modelDigest: MODEL_DIGEST,
    })).toThrow(/enclosure witness does not withhold/);
  });
});
