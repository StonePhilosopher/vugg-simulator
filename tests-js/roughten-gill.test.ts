// tests-js/roughten-gill.test.ts — v107 scenario tests.
//
// Caldbeck Fells / Roughten Gill Mine (Cumbria, England). Polymetallic
// Pb-Cu fissure-vein in Eycott Volcanic Group + Carrock Fell Intrusive
// Complex. Type locality for plumbogummite (Hartley 1882; plumbogummite
// not yet wired in the catalog — flagged as v108 add-mineral).
//
// References:
//   * Cooper M.P. & Stanley C.J. (1990) Minerals of the English Lake
//     District: Caldbeck Fells
//   * Bridges et al. (2011) JRS 14:3 — modern Roughten Gill paper
//   * Russell A. (1925) MinMag 20:257 — plumbogummite revisited
//   * Förtsch (1967) MinMag 36:530 — plumbogummite type-material
//     correction (plumbogummite-hinsdalite-hidalgoite mix-crystal)

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

describe('Roughten Gill Mine scenario (v107)', () => {
  describe('scenario is registered + fires', () => {
    it('SCENARIOS.roughten_gill exists', () => {
      expect(typeof SCENARIOS.roughten_gill).toBe('function');
    });

    it('runs to completion and produces crystals', () => {
      const sim = runScenario('roughten_gill');
      expect(sim).not.toBeNull();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });
  });

  describe('paragenesis — what actually fires at seed 42 (not aspirational)', () => {
    let sim: any;
    let species: Set<string>;

    function ensureSim() {
      if (!sim) {
        sim = runScenario('roughten_gill');
        species = new Set(sim.crystals.map((c: any) => c.mineral));
      }
    }

    it('fires primary sulfides (galena + pyrite)', () => {
      ensureSim();
      expect(species.has('galena')).toBe(true);
      expect(species.has('pyrite')).toBe(true);
    });

    it('fires Ag-sulfosalts (tetrahedrite + tennantite + proustite — Caldbeck Ag-suite)', () => {
      ensureSim();
      expect(species.has('tetrahedrite')).toBe(true);
      expect(species.has('tennantite')).toBe(true);
      // proustite as the Ag-As ruby silver — Caldbeck galena is Ag-rich
      expect(species.has('proustite')).toBe(true);
    });

    it('fires sphalerite as Zn primary', () => {
      ensureSim();
      expect(species.has('sphalerite')).toBe(true);
    });

    it('fires native_silver from the Ag-in-galena reservoir', () => {
      ensureSim();
      // ~838 ppm Ag in primary galena per BGS Earthwise + Bridges 2011;
      // supergene oxidation liberates the lattice silver as native flakes
      // in quartz-calcite microcavities. Acanthite forms as the
      // post-collection tarnish — also fires here.
      expect(species.has('native_silver') || species.has('acanthite')).toBe(true);
    });

    it('fires pyromorphite (Pb-PO4 supergene)', () => {
      ensureSim();
      expect(species.has('pyromorphite')).toBe(true);
    });

    it('fires anglesite (Pb-SO4 from pyrite-oxidation acid window)', () => {
      ensureSim();
      expect(species.has('anglesite')).toBe(true);
    });

    // v128c (graduated competition algorithm) initially dropped the four
    // v109-era minerals because Pb budget rationing didn't yet have their
    // stoichiometry to compete against. v128e (this commit's predecessor)
    // added stoichiometry for caledonite + plumbogummite + duftite +
    // proustite, restoring them to the paragenesis. The v109 explicit-
    // mineral assertions are back.
    it('fires cerussite (Pb-CO3 — v109 tune gain, restored under graduated competition v128e)', () => {
      ensureSim();
      expect(species.has('cerussite')).toBe(true);
    });

    it('fires brochantite (Cu-SO4 supergene — v109 tune gain, restored)', () => {
      ensureSim();
      expect(species.has('brochantite')).toBe(true);
    });

    it('fires caledonite (Pb-Cu sulfate-carbonate — v109 tune gain, v128e ship)', () => {
      ensureSim();
      expect(species.has('caledonite')).toBe(true);
    });

    it('fires plumbogummite (Pb-Al-PO4 — v108 type-locality mineral, v128e ship)', () => {
      ensureSim();
      expect(species.has('plumbogummite')).toBe(true);
    });

    it('fires proustite + duftite (new at v128e)', () => {
      ensureSim();
      expect(species.has('proustite')).toBe(true);
      expect(species.has('duftite')).toBe(true);
    });

    it('SUPPRESSES dioptase (geologically wrong for Caldbeck — v109 tune)', () => {
      ensureSim();
      // dioptase was an extra firing in v107 (Cu-silicate from Cu+SiO2
      // co-occurrence at supergene). v109 dropped SiO2 to suppress.
      // Cu-silicate at Caldbeck is not documented per Cooper & Stanley.
      expect(species.has('dioptase')).toBe(false);
    });

    it('fires As-sulfides (orpiment / pararealgar / arsenopyrite from primary As-rich fluid)', () => {
      ensureSim();
      // The As-rich primary fluid (As=12, from tetrahedrite-tennantite source)
      // produces As-sulfides at low-T supergene. Realistic for Caldbeck
      // tennantite-rich veins.
      const hasAsSulfide = species.has('orpiment') || species.has('pararealgar') || species.has('arsenopyrite');
      expect(hasAsSulfide).toBe(true);
    });

    it('fires quartz (vein gangue throughout)', () => {
      ensureSim();
      expect(species.has('quartz')).toBe(true);
    });
  });

  describe('expects_species declaration matches JSON5 spec', () => {
    it('scenario declares Pb-Cu supergene principals (aspirational; v109 tune candidate)', () => {
      const scenSpec = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,(\s*[}\]])/g, '$1')
      );
      const expects = scenSpec.scenarios.roughten_gill.expects_species;
      expect(Array.isArray(expects)).toBe(true);
      // The headline minerals — v100 trio in type-district + classic
      // Caldbeck supergene. Some are aspirational at v107 (v109 tuning
      // target). The declaration tracks what the scenario AIMS for.
      expect(expects).toContain('galena');
      expect(expects).toContain('pyromorphite');
      expect(expects).toContain('linarite');
      expect(expects).toContain('caledonite');
      expect(expects).toContain('leadhillite');
      expect(expects).toContain('native_silver');
    });
  });
});
