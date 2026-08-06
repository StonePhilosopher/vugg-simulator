import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
        const strip = JSON.parse(fs.readFileSync(path.join(stripDir, `${scenario}.json`), 'utf8'));
        const card = JSON.parse(fs.readFileSync(path.join(outDir, `${scenario}.json`), 'utf8'));

      expect(card, `${scenario}: identity`).toMatchObject({
        scenario,
        sim_version: SIM_VERSION,
        model_digest: MODEL_DIGEST,
        scenario_spec_hash: strip.scenario_spec_hash,
        strip_steps: strip.steps,
      });
      expect(card.claim.expects_species, `${scenario}: authored species`).toEqual(spec.expects_species || []);
      expect(card.claim.authored_science_context.model_digest, `${scenario}: authored science digest`).toBe(MODEL_DIGEST);
      expect(card.claim.authored_science_context.growth_budget, `${scenario}: disclosed growth-budget boundary`)
        .toEqual(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE);
      expect(card.claim.authored_science_context.growth_budget.is_physical_mass_conservation).toBe(false);

      const eventCount = new Map<string, number>();
      for (const event of strip.nucleation_events || []) {
        eventCount.set(event.mineral, (eventCount.get(event.mineral) || 0) + 1);
      }
      expect(card.testimony.paragenetic_order, `${scenario}: all nucleation testimony`)
        .toHaveLength(eventCount.size);
      for (const entry of card.testimony.paragenetic_order) {
        expect(entry.events, `${scenario}: ${entry.mineral} event count`)
          .toBe(eventCount.get(entry.mineral));
      }

      const executed = card.testimony.executed_science;
      expect(executed.pressure_phase_sample_count, `${scenario}: pressure samples`).toBe(strip.steps);
      expect(executed.stress_events, `${scenario}: stress testimony`)
        .toEqual(strip.executed_testimony?.stress_events || []);
      expect(Object.keys(card.testimony.saturation_indices).sort(), `${scenario}: SI cards`)
        .toEqual(Object.keys(strip.chips).filter(key => key.startsWith('SI_')).sort());

        const markdown = fs.readFileSync(path.join(outDir, `${scenario}.md`), 'utf8');
        expect(markdown, `${scenario}: rendered digest`).toContain(`**Model digest:** ${MODEL_DIGEST}`);
        expect(markdown, `${scenario}: rendered spec identity`).toContain(`**Scenario spec hash:** ${strip.scenario_spec_hash}`);
        expect(markdown, `${scenario}: rendered model boundary`).toContain('Model boundary: calibrated growth budget');
        expect(markdown, `${scenario}: rendered physical limitation`).toContain('not physical solid mass or volume');
        expect(markdown, `${scenario}: authored section`).toContain('Authored pressure/stress/phase context');
        expect(markdown, `${scenario}: executed section`).toContain('Executed pressure/stress/phase testimony');
      }
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
