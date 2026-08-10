import { describe, expect, it } from 'vitest';
import {
  auditCard,
  deterministicRationaleContradiction,
} from '../tools/locality-envelope-audit.mjs';

const STRIP_SHA = 'a'.repeat(64);

function fixture(overrides: any = {}) {
  return {
    scenario: 'test_locality',
    sim_version: 260,
    model_digest: 'digest',
    scenario_spec_hash: 'hash',
    strip_sha256: STRIP_SHA,
    claim: {
      expectation_contract: {
        deterministic: [{ mineral: 'quartz', reason: 'Authored headline release promise.', headline: true }],
        statistical: [{ mineral: 'calcite', reason: 'Documented accessory gangue at the locality.', first_step_min: 5 }],
        aspirational: [{ mineral: 'fluorite', reason: 'Documented but not delivered by the present fluid path.' }],
      },
      excluded_species: { halite: 'No evaporitic or mine-efflorescence occurrence is documented.' },
    },
    testimony: {
      paragenetic_order: [
        { mineral: 'quartz', first_step: 1 },
        { mineral: 'calcite', first_step: 5 },
      ],
      surprises_not_in_expects: [],
      excluded_species_appearances: [],
    },
    ...overrides,
  };
}

const manifest = {
  id: 'test_locality',
  scenario_spec_hash: 'hash',
  locality_frequency_spec_hash: 'frequency-hash',
  archive: { sim_version: 260, model_digest: 'digest', strip_sha256: STRIP_SHA },
};

const DEFAULT_RUNS = [
  { seed: 1, first_steps: { quartz: 1, calcite: 5 } },
  { seed: 2, first_steps: { quartz: 1 } },
  { seed: 42, first_steps: { quartz: 1, calcite: 5 } },
];

function frequency(runInputs: any[] = DEFAULT_RUNS, occurrenceOverrides: Record<string, any> = {}) {
  const runs = runInputs.map((run) => ({
    seed: run.seed,
    species: Object.keys(run.first_steps).sort(),
    first_steps: Object.fromEntries(Object.entries(run.first_steps).sort(([a], [b]) => a.localeCompare(b))),
  }));
  const occurrences: Record<string, any> = {};
  for (const run of runs) {
    for (const mineral of run.species) {
      const occurrence = occurrences[mineral] || { count: 0, seeds: [], first_steps: {} };
      occurrence.count++;
      occurrence.seeds.push(run.seed);
      occurrence.first_steps[String(run.seed)] = run.first_steps[mineral];
      occurrences[mineral] = occurrence;
    }
  }
  for (const [mineral, override] of Object.entries(occurrenceOverrides)) {
    if (override === undefined) delete occurrences[mineral];
    else occurrences[mineral] = override;
  }
  return {
    locality_frequency_spec_hash: 'frequency-hash',
    duration_steps: 50,
    occurrences,
    runs,
  };
}

function audit(card: any, runs: any[] = DEFAULT_RUNS, occurrenceOverrides: Record<string, any> = {}) {
  return auditCard(card, manifest, {
    frequencyScenario: frequency(runs, occurrenceOverrides),
    frequencySeeds: [1, 2, 42],
    actualStripSha256: STRIP_SHA,
  });
}

describe('fast locality-envelope audit', () => {
  it('accepts a fully classified deterministic strip', () => {
    const result = audit(fixture());
    expect(result).toMatchObject({ errors: [], warnings: [], unresolved: [] });
  });

  it('rejects deterministic rationales that contradict their published tier', () => {
    for (const [reason, token] of [
      ['Retained as a non-deterministic phase.', 'non-deterministic'],
      ['Allowed statistically in this pocket.', 'statistical'],
      ['A documented phase, but not a defining deterministic phase.', 'not deterministic'],
      ['Legitimate but not guaranteed in every modeled pocket.', 'not guaranteed'],
      ['Discrete growth is not required in every pocket.', 'not required in every'],
    ]) {
      const card = fixture();
      card.claim.expectation_contract.deterministic[0].reason = reason;
      const result = audit(card);
      expect(deterministicRationaleContradiction(reason)).toBe(token);
      expect(result.errors.join('\n')).toContain(
        `deterministic quartz rationale contradicts its evidence tier (${token})`,
      );
    }
  });

  it('reports unclassified products for review', () => {
    const card = fixture();
    card.testimony.paragenetic_order.push({ mineral: 'pyrite', first_step: 2 });
    card.testimony.surprises_not_in_expects.push('pyrite');
    const result = audit(card, [
      ...DEFAULT_RUNS.slice(0, 2),
      { seed: 42, first_steps: { quartz: 1, calcite: 5, pyrite: 2 } },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.unresolved).toEqual(['pyrite']);
    expect(result.warnings.join('\n')).toContain('unclassified archived products: pyrite');
  });

  it('fails negative evidence, tier overlap, and first-appearance bounds', () => {
    const card = fixture();
    card.claim.expectation_contract.statistical.push({
      mineral: 'halite',
      reason: 'Contradictory classification for the test.',
      first_step_min: 10,
    });
    card.testimony.paragenetic_order.push({ mineral: 'halite', first_step: 3 });
    card.testimony.excluded_species_appearances.push('halite');
    const result = audit(card, [
      ...DEFAULT_RUNS.slice(0, 2),
      { seed: 42, first_steps: { quartz: 1, calcite: 5, halite: 3 } },
    ]);
    expect(result.errors.join('\n')).toContain('statistical/excluded tiers overlap at halite');
    expect(result.errors.join('\n')).toContain('negative-evidence exclusions appeared: halite');
    expect(result.errors.join('\n')).toContain('halite appeared at step 3, before authored minimum 10');
  });

  it('requires an appearing aspiration to be promoted', () => {
    const card = fixture();
    card.testimony.paragenetic_order.push({ mineral: 'fluorite', first_step: 8 });
    const result = audit(card, [
      ...DEFAULT_RUNS.slice(0, 2),
      { seed: 42, first_steps: { quartz: 1, calcite: 5, fluorite: 8 } },
    ]);
    expect(result.errors.join('\n')).toContain('aspirational products appeared and must be promoted or corrected: fluorite');
  });

  it('keeps excluded appearances out of the unclassified-products bucket', () => {
    const card = fixture();
    card.testimony.paragenetic_order.push({ mineral: 'halite', first_step: 8 });
    card.testimony.excluded_species_appearances.push('halite');
    const result = audit(card, [
      ...DEFAULT_RUNS.slice(0, 2),
      { seed: 42, first_steps: { quartz: 1, calcite: 5, halite: 8 } },
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors.join('\n')).toContain('negative-evidence exclusions appeared: halite');
  });

  it('fails stale archive identity', () => {
    const result = audit(fixture({ scenario_spec_hash: 'stale' }));
    expect(result.errors.join('\n')).toContain('scenario spec hash differs from science manifest');
  });

  it('rejects statistical targets with zero or unit occurrence frequency', () => {
    const always = audit(fixture(), [
      DEFAULT_RUNS[0],
      { seed: 2, first_steps: { quartz: 1, calcite: 5 } },
      DEFAULT_RUNS[2],
    ]);
    expect(always.errors.join('\n')).toContain('appeared in 3/3 seeds; promote it to deterministic');

    const never = audit(fixture(), [
      { seed: 1, first_steps: { quartz: 1 } },
      { seed: 2, first_steps: { quartz: 1 } },
      { seed: 42, first_steps: { quartz: 1 } },
    ]);
    expect(never.errors.join('\n')).toContain('appeared in 0/3 seeds; classify it as aspirational');
  });

  it('requires deterministic products across the entire seed panel', () => {
    const result = audit(fixture(), [
      DEFAULT_RUNS[0],
      { seed: 2, first_steps: {} },
      DEFAULT_RUNS[2],
    ]);
    expect(result.errors.join('\n')).toContain(
      'deterministic quartz appeared in 2/3 seeds; classify it as statistical or correct the model',
    );
  });

  it('fails a forged strip body even when metadata is unchanged', () => {
    const result = auditCard(fixture(), manifest, {
      frequencyScenario: frequency(),
      frequencySeeds: [1, 2, 42],
      actualStripSha256: 'b'.repeat(64),
    });
    expect(result.errors.join('\n')).toContain('archived strip bytes differ from pinned SHA-256');
  });

  it('rejects occurrence-count tampering instead of trusting the summary index', () => {
    const result = audit(fixture(), DEFAULT_RUNS, {
      calcite: { count: 3, seeds: [1, 42], first_steps: { 1: 5, 42: 5 } },
    });
    expect(result.errors.join('\n')).toContain(
      'occurrences do not match the canonical reconstruction from runs',
    );
  });

  it('rejects duplicate seed runs and run species/first-step disagreement', () => {
    const duplicate = frequency([...DEFAULT_RUNS, DEFAULT_RUNS[0]]);
    const duplicateResult = auditCard(fixture(), manifest, {
      frequencyScenario: duplicate,
      frequencySeeds: [1, 2, 42],
      actualStripSha256: STRIP_SHA,
    });
    expect(duplicateResult.errors.join('\n')).toContain('seed 1 has more than one run');

    const mismatched = frequency();
    mismatched.runs[0].species.push('pyrite');
    const mismatchResult = auditCard(fixture(), manifest, {
      frequencyScenario: mismatched,
      frequencySeeds: [1, 2, 42],
      actualStripSha256: STRIP_SHA,
    });
    expect(mismatchResult.errors.join('\n')).toContain('species and first_steps keys differ');
  });
});
