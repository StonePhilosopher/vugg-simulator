// tests-js/jeffrey-mine.test.ts — Jeffrey Mine scenario tests (v115).
//
// Sixth commit of the Jeffrey Mine rodingite arc. The runnable scenario
// that fires the full rodingite assemblage shipped v110-v114 at seed 42.
//
// Anchor: Jeffrey Mine, Val-des-Sources (formerly Asbestos), Quebec.
// Open-pit chrysotile-asbestos mine 1881-2011; world's premier locality
// for cabinet-grade CYPRINE vesuvianite (Bernardini 1981 MR 12(5):277).
//
// The five-stage event sequence walks the broth through:
//   1. Serpentinization onset → chrysotile + brucite + magnetite + awaruite
//   2. Mafic dike alteration → grossular + diopside
//   3. Mid-rodingite → cyprine vesuvianite (Cu trace 4 ppm)
//   4. Late Ca-silicates → pectolite + wollastonite + prehnite (Na surge)
//   5. Terminal datolite → datolite gemmy on prehnite substrate (B surge)
//
// The headline aesthetic per Bernardini 1981 is the sky-blue cyprine
// vesuvianite + colorless gemmy datolite assemblage.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScenario(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

describe('Jeffrey Mine scenario (v115)', () => {
  describe('scenario is registered + runs', () => {
    it('SCENARIOS.jeffrey_mine exists', () => {
      expect(typeof SCENARIOS.jeffrey_mine).toBe('function');
    });

    it('runs to completion and produces crystals', () => {
      const sim = runScenario('jeffrey_mine');
      expect(sim).not.toBeNull();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });

    it('wall composition is the new ultramafic type', () => {
      setSeed(42);
      const { conditions } = SCENARIOS.jeffrey_mine();
      expect(conditions.wall.composition).toBe('ultramafic');
    });
  });

  describe('expects_species declaration matches the rodingite suite', () => {
    it('separates deterministic headlines, statistical pectolite, and aspirational magnetite', () => {
      const scenSpec = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,(\s*[}\]])/g, '$1')
      );
      const contract = scenSpec.scenarios.jeffrey_mine;
      const expects = contract.expects_species;
      expect(Array.isArray(expects)).toBe(true);
      // The headline rodingite suite — what the scenario AIMS for.
      // v261 reserves this list for all-seed deterministic headline promises.
      expect(expects).toContain('chrysotile');
      expect(expects).toContain('vesuvianite');
      expect(expects).toContain('grossular');
      expect(expects).toContain('diopside');
      expect(expects).toContain('datolite');
      expect(expects).not.toContain('pectolite');
      expect(expects).toContain('wollastonite');
      expect(expects).toContain('prehnite');
      expect(expects).toContain('brucite');
      expect(expects).toContain('awaruite');
      // Pectolite is documented and licensed, but the v261 three-seed receipt
      // observes it in only 2/3 seeds. Do not overstate that variable delivery
      // as a deterministic headline promise.
      expect(contract.statistical_species).toContainEqual(expect.objectContaining({
        mineral: 'pectolite',
        reason: expect.stringMatching(/two of the three evidence seeds/i),
      }));
      expect(contract.aspirational_species).toContainEqual(expect.objectContaining({
        mineral: 'magnetite',
        reason: expect.stringMatching(/absent from the release seed audit/i),
      }));
    });
  });

  describe('paragenesis — what actually fires at seed 42', () => {
    let sim: any;
    let species: Set<string>;

    function ensureSim() {
      if (!sim) {
        sim = runScenario('jeffrey_mine');
        species = new Set(sim.crystals.map((c: any) => c.mineral));
      }
    }

    it('fires chrysotile (the asbestos host matrix — v114)', () => {
      ensureSim();
      expect(species.has('chrysotile')).toBe(true);
    });

    it('fires at least one major rodingite calc-silicate (grossular, diopside, or vesuvianite)', () => {
      ensureSim();
      const has_any = species.has('grossular') || species.has('diopside') || species.has('vesuvianite');
      expect(has_any).toBe(true);
    });

    it('fires at least one of the late Ca-silicate trio (pectolite, wollastonite, prehnite)', () => {
      ensureSim();
      const has_any = species.has('pectolite') || species.has('wollastonite') || species.has('prehnite');
      expect(has_any).toBe(true);
    });

    it('produces at least one growth-zone log entry', () => {
      ensureSim();
      expect(sim.log.length).toBeGreaterThan(0);
    });
  });
});
