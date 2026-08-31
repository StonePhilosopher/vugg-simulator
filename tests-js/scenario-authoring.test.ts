import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  assertScenarioPreviewReceipt,
  assertScenarioRegistryIdentity,
  buildScenarioPreview,
  parseScenarioDocument,
  scenarioPreviewPayloadDigest,
  scenarioPreviewReceiptDigest,
  validateScenarioDocument,
} from '../tools/scenario-authoring.mjs';

declare const SIM_VERSION: number;
declare const SCENARIOS: Record<string, any>;
declare function scenarioReplaySpecHash(spec: any): string;

function sourceDocuments() {
  const root = process.cwd();
  const scenarios = parseScenarioDocument(readFileSync(join(root, 'data', 'scenarios.json5'), 'utf8'));
  const mineralsDoc = JSON.parse(readFileSync(join(root, 'data', 'minerals.json'), 'utf8'));
  return { scenarios, minerals: mineralsDoc.minerals || mineralsDoc };
}

describe('scenario authoring workflow', () => {
  it('fails the normal registry audit when the runtime replay projection drifts', () => {
    const { scenarios } = sourceDocuments();
    expect(assertScenarioRegistryIdentity({ SCENARIOS, scenarioReplaySpecHash }, scenarios)).toBe(true);

    const forgedCooling = Object.assign(function forgedCoolingScenario() {}, SCENARIOS.cooling);
    forgedCooling._scenario_replay_hash = '0'.repeat(64);
    expect(() => assertScenarioRegistryIdentity({
      SCENARIOS: { ...SCENARIOS, cooling: forgedCooling },
      scenarioReplaySpecHash,
    }, scenarios)).toThrow(/cooling.*replay identity/i);

    const coordinatedCooling = Object.assign(function coordinatedCoolingScenario() {}, SCENARIOS.cooling);
    coordinatedCooling._scenario_replay_hash = '0'.repeat(64);
    expect(() => assertScenarioRegistryIdentity({
      SCENARIOS: { ...SCENARIOS, cooling: coordinatedCooling },
      scenarioReplaySpecHash: (spec: any) => spec === scenarios.scenarios.cooling
        ? '0'.repeat(64)
        : scenarioReplaySpecHash(spec),
    }, scenarios)).toThrow(/cooling.*replay identity/i);
  });

  it('validates the complete authored fleet and fails closed on key science identity defects', () => {
    const { scenarios, minerals } = sourceDocuments();
    expect(validateScenarioDocument(scenarios, minerals)).toEqual([]);

    const missingShape = structuredClone(scenarios);
    delete missingShape.scenarios.cooling.initial.wall.shape_seed;
    expect(validateScenarioDocument(missingShape, minerals).join('\n')).toMatch(/cooling.*shape_seed/i);

    const contradictoryClaim = structuredClone(scenarios);
    contradictoryClaim.scenarios.cooling.excluded_species = { quartz: 'forged contradiction' };
    expect(validateScenarioDocument(contradictoryClaim, minerals).join('\n')).toMatch(/quartz.*positively claimed.*excluded/i);

    const unmarkedExtendedEvent = structuredClone(scenarios);
    delete unmarkedExtendedEvent.scenarios.great_salt_plains.events.at(-1).extended_only;
    expect(validateScenarioDocument(unmarkedExtendedEvent, minerals).join('\n')).toMatch(/past duration_steps.*extended_only/i);

    const malformedFluid = structuredClone(scenarios);
    malformedFluid.scenarios.cooling.initial.fluid.pH = 'acid';
    malformedFluid.scenarios.cooling.initial.fluid.Ca = -1;
    malformedFluid.scenarios.cooling.initial.fluid.uncommissionedIon = 10;
    malformedFluid.scenarios.cooling.initial.fluid.sulfateInherited = 'yes';
    malformedFluid.scenarios.cooling.initial.fluid.nativeSulfurPathway = 'magic';
    const fluidErrors = validateScenarioDocument(malformedFluid, minerals).join('\n');
    expect(fluidErrors).toMatch(/pH must be finite/i);
    expect(fluidErrors).toMatch(/Ca must be non-negative/i);
    expect(fluidErrors).toMatch(/unknown field.*uncommissionedIon/i);
    expect(fluidErrors).toMatch(/sulfateInherited must be boolean/i);
    expect(fluidErrors).toMatch(/nativeSulfurPathway has an unsupported value/i);

    const uncited = structuredClone(scenarios);
    uncited.scenarios.cooling.sources = [];
    uncited.scenarios.cooling.excluded_species = { calcite: '' };
    const citationErrors = validateScenarioDocument(uncited, minerals).join('\n');
    expect(citationErrors).toMatch(/sources must be a nonempty/i);
    expect(citationErrors).toMatch(/excluded_species\.calcite requires a nonempty/i);

    const malformedClaimCitations = structuredClone(scenarios);
    malformedClaimCitations.scenarios.elmwood.claim_citations = [
      { claim_id: 'Bad Claim', statement: '', sources: [] },
      { claim_id: 'Bad Claim', statement: 'duplicate', sources: [''] },
    ];
    const claimCitationErrors = validateScenarioDocument(malformedClaimCitations, minerals).join('\n');
    expect(claimCitationErrors).toMatch(/claim_id must use lowercase kebab-case/i);
    expect(claimCitationErrors).toMatch(/statement must be nonempty/i);
    expect(claimCitationErrors).toMatch(/sources must be a nonempty array/i);

    const malformedPulse = structuredClone(scenarios);
    malformedPulse.scenarios.cooling.events[0] = {
      step: 0, type: 'fluid_pulse', name: 'Bad pulse', description: 'negative control',
      fluid_transform: { add: { S_sulfate: 10 } }, material_authority: '',
    };
    const pulseErrors = validateScenarioDocument(malformedPulse, minerals).join('\n');
    expect(pulseErrors).toMatch(/nonempty material_authority/i);
    expect(pulseErrors).toMatch(/valence-specific boundary event/i);
  });

  it('emits a timestamp-free exact-identity seed-42 fixture deterministically', async () => {
    const first = await buildScenarioPreview({ scenarioId: 'cooling', seed: 42, steps: 1 });
    const replay = await buildScenarioPreview({ scenarioId: 'cooling', seed: 42, steps: 1 });
    expect(replay).toEqual(first);
    await expect(assertScenarioPreviewReceipt(first)).resolves.toBe(true);
    expect(first.identity).toMatchObject({
      sim_version: SIM_VERSION,
      scenario: 'cooling',
      seed: 42,
      shape_seed: 1,
      requested_steps: 1,
    });
    expect(first.identity.model_digest_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.identity.scenario_spec_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.final_state_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.receipt).toMatchObject({
      schema: 'vugg-scenario-authoring-receipt-v1',
      payload_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      browser_bundle_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      runtime_execution_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      producer_contract_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      node_runtime_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      receipt_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(first)).not.toMatch(/generated_at|recorded_at|Date\.now/);

    const provenanceTamper = structuredClone(first);
    provenanceTamper.receipt.browser_bundle_sha256 = '0'.repeat(64);
    await expect(assertScenarioPreviewReceipt(provenanceTamper)).rejects.toThrow(/receipt digest mismatch/i);

    // Rehashing a forged provenance receipt cannot make it current.
    provenanceTamper.receipt.receipt_sha256 = scenarioPreviewReceiptDigest(provenanceTamper.receipt);
    await expect(assertScenarioPreviewReceipt(provenanceTamper)).rejects.toThrow(/browser_bundle_sha256 is not current/i);

    const payloadTamper = structuredClone(first);
    payloadTamper.trajectory[0].pH = 1;
    await expect(assertScenarioPreviewReceipt(payloadTamper)).rejects.toThrow(/payload digest mismatch/i);

    const reseal = (preview: any) => {
      preview.receipt.payload_sha256 = scenarioPreviewPayloadDigest(preview);
      preview.receipt.receipt_sha256 = scenarioPreviewReceiptDigest(preview.receipt);
      return preview;
    };
    const seedTamper = structuredClone(first);
    seedTamper.identity.seed = 43;
    await expect(assertScenarioPreviewReceipt(reseal(seedTamper)))
      .rejects.toThrow(/does not match deterministic.*replay/i);

    const trajectoryTamper = structuredClone(first);
    trajectoryTamper.trajectory[1].pH += 0.25;
    await expect(assertScenarioPreviewReceipt(reseal(trajectoryTamper)))
      .rejects.toThrow(/does not match deterministic.*replay/i);

    const finalStateTamper = structuredClone(first);
    finalStateTamper.final_state_sha256 = 'f'.repeat(64);
    await expect(assertScenarioPreviewReceipt(reseal(finalStateTamper)))
      .rejects.toThrow(/does not match deterministic.*replay/i);

    const int32AliasTamper = structuredClone(first);
    int32AliasTamper.identity.seed = 4294967338; // 42 + 2^32; seed|0 used to alias 42.
    await expect(assertScenarioPreviewReceipt(reseal(int32AliasTamper)))
      .rejects.toThrow(/signed 32-bit integer/i);

    // Mutate the original return value, not a clone: preview claims must not
    // alias the verifier's runtime or source authority.
    first.authored_claims.expects_species[0] = 'calcite';
    await expect(assertScenarioPreviewReceipt(reseal(first)))
      .rejects.toThrow(/does not match deterministic.*replay/i);
    const fresh = await buildScenarioPreview({ scenarioId: 'cooling', seed: 42, steps: 1 });
    expect(fresh.authored_claims.expects_species).toEqual(['quartz']);
  }, 30_000);

  it('fails explicitly for uncaptured late and unresolved first-load harness exports', async () => {
    const harnessUrl = pathToFileURL(join(process.cwd(), 'tools', '_harness.mjs'));
    harnessUrl.search = '?memo-contract-regression';
    const memoHarness: any = await import(harnessUrl.href);
    await memoHarness.loadSimBundle({
      toolName: 'memo-contract-prime',
      extraExports: ['activityCorrectionFactor'],
    });
    await expect(memoHarness.loadSimBundle({
      toolName: 'memo-contract-regression',
      extraExports: ['ionicStrength'],
    })).rejects.toThrow(/memoized.*did not capture.*ionicStrength/i);

    const unresolvedUrl = pathToFileURL(join(process.cwd(), 'tools', '_harness.mjs'));
    unresolvedUrl.search = '?unresolved-contract-regression';
    const unresolvedHarness: any = await import(unresolvedUrl.href);
    await expect(unresolvedHarness.loadSimBundle({
      toolName: 'unresolved-contract-regression',
      extraExports: ['definitelyMissingVuggExport'],
    })).rejects.toThrow(/does not define.*definitelyMissingVuggExport/i);
  }, 30_000);
});
