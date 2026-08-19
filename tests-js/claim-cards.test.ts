import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;
declare const SCENARIOS: Record<string, any>;
declare const STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE: Record<string, any>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('adversarial claim-card fleet', () => {
  it('builds and inspects every current scenario card, including executed testimony', () => {
    const stripDir = path.join(ROOT, 'archive', 'strips', `v${SIM_VERSION}`);
    const files = fs.readdirSync(stripDir).filter(name => name.endsWith('.json')).sort();
    const scenarioNames = Object.keys(SCENARIOS).sort();
    expect(files.map(name => name.replace(/\.json$/, ''))).toEqual(scenarioNames);

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-claim-cards-'));
    try {
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
        schema: 'vugg-claim-card-v3',
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
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
