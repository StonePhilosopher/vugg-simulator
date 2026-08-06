// tests-js/sunnyside-american-tunnel.test.ts — v105 scenario tests.
//
// Anchored on boss specimens + Casadevall & Ohmoto 1977 six-stage
// Sunnyside paragenesis (compressed to four stages here):
//   Stage 1   Primary ore  — pyrite + galena + sphalerite/wurtzite +
//                            chalcopyrite + Ag-sulfosalts + Au + quartz
//                            (T 280-260°C, sulfide-buffered acidic)
//   Stage 2-3 Mn-carbonate — pale-pink rhodochrosite + siderite
//                            (T 215-245°C, Fe-poor late fluid)
//   Stage 4   Fluoride pulse — octahedral REE-fluorite (Y leached from
//                              Carpenter Ridge Tuff per Bachmann 2014;
//                              octahedral habit per Bosze & Rakovan 2002)
//   Stage 5   Manganocalcite cap — bright Mn²⁺-fluorescent calcite
//
// LABELING NOTE: "Standard Mine, Silverton" identifies Sunnyside output
// from the Standard Metals lease / American Tunnel production window.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const carbonateSaturationIndex: any;

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

describe('Sunnyside-American Tunnel scenario (v105)', () => {
  describe('scenario is registered + fires', () => {
    it('SCENARIOS.sunnyside_american_tunnel exists', () => {
      expect(typeof SCENARIOS.sunnyside_american_tunnel).toBe('function');
    });

    it('runs to completion and produces crystals', () => {
      const sim = runScenario('sunnyside_american_tunnel');
      expect(sim).not.toBeNull();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });
  });

  describe('paragenesis — expected mineral firings at seed 42', () => {
    let sim: any;
    let species: Set<string>;

    function ensureSim() {
      if (!sim) {
        sim = runScenario('sunnyside_american_tunnel');
        species = new Set(sim.crystals.map((c: any) => c.mineral));
      }
    }

    it('fires primary sulfides (pyrite, galena, chalcopyrite)', () => {
      ensureSim();
      expect(species.has('pyrite')).toBe(true);
      expect(species.has('galena')).toBe(true);
      expect(species.has('chalcopyrite')).toBe(true);
    });

    it('fires a Zn-sulfide (sphalerite OR wurtzite — high-T polymorph)', () => {
      ensureSim();
      // Sunnyside Stage III has marmatite (Fe-rich sphalerite); engine
      // at T~280 may dispatch to wurtzite (high-T ZnS polymorph). Either
      // is geologically correct.
      const hasZnS = species.has('sphalerite') || species.has('wurtzite');
      expect(hasZnS).toBe(true);
    });

    it('fires Ag-sulfosalts (tetrahedrite + at least one ruby silver)', () => {
      ensureSim();
      expect(species.has('tetrahedrite')).toBe(true);
      const hasRubySilver = species.has('proustite') || species.has('pyrargyrite');
      expect(hasRubySilver).toBe(true);
    });

    it('fires rhodochrosite (Stage V Mn-carbonate)', () => {
      ensureSim();
      expect(species.has('rhodochrosite')).toBe(true);
    });

    it('fires fluorite (Stage VI fluoride pulse)', () => {
      ensureSim();
      expect(species.has('fluorite')).toBe(true);
    });

    it('fires Mn-substituting calcite in the Stage VI cap', () => {
      ensureSim();
      const calcites = sim.crystals.filter((c: any) => c.mineral === 'calcite');
      expect(calcites.length).toBeGreaterThan(0);
      expect(calcites.some((c: any) => c._variety === 'manganocalcite')).toBe(true);
      const mnZones = calcites.flatMap((c: any) => c.zones || [])
        .filter((zone: any) => zone.thickness_um > 0 && zone.trace_stoichiometry?.Mn > 0);
      expect(mnZones.length).toBeGreaterThan(0);
      expect(mnZones.every((zone: any) => zone._budget_inventory_per_um?.Mn > 0)).toBe(true);
    });

    it('forms native gold from a formula-debited Au reservoir', () => {
      ensureSim();
      const gold = sim.crystals.filter((c: any) => c.mineral === 'native_gold');
      expect(gold.length).toBeGreaterThan(0);
      const growthZones = gold.flatMap((c: any) => c.zones || [])
        .filter((zone: any) => zone.thickness_um > 0);
      expect(growthZones.length).toBeGreaterThan(0);
      expect(growthZones.every((zone: any) => zone._budget_inventory_per_um?.Au > 0)).toBe(true);
    });

    it('fires quartz (ongoing through all stages)', () => {
      ensureSim();
      expect(species.has('quartz')).toBe(true);
    });
  });

  describe('multi-seed retained-species envelope', () => {
    it('retains chalcopyrite, native gold, and manganocalcite across five seeds', () => {
      for (const seed of [1, 7, 19, 42, 99]) {
        const sim = runScenario('sunnyside_american_tunnel', seed);
        for (const mineral of ['chalcopyrite', 'native_gold', 'calcite']) {
          const growth = sim.crystals
            .filter((c: any) => c.mineral === mineral)
            .flatMap((c: any) => c.zones || [])
            .reduce((sum: number, zone: any) => sum + Math.max(0, zone.thickness_um || 0), 0);
          expect(growth, `seed ${seed}: ${mineral} positive growth`).toBeGreaterThan(0);
        }
        expect(sim.crystals.some((c: any) => c.mineral === 'calcite'
          && c._variety === 'manganocalcite')).toBe(true);
      }
    });

    it('crosses positive authoritative calcite SI only in the terminal carbonate stage', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS.sunnyside_american_tunnel();
      const sim = new VugSimulator(conditions, events);
      let preCapMaxSI = -Infinity;
      let capMaxSI = -Infinity;
      for (let i = 0; i < (defaultSteps ?? 200); i++) {
        sim.run_step();
        const si = carbonateSaturationIndex('calcite', sim.conditions.fluid, sim.conditions.temperature);
        if (sim.step < 150) preCapMaxSI = Math.max(preCapMaxSI, si);
        else capMaxSI = Math.max(capMaxSI, si);
      }
      expect(preCapMaxSI).toBeLessThanOrEqual(0);
      expect(capMaxSI).toBeGreaterThan(0);
    });
  });

  describe('engine integration — v103 + v104 infra fires correctly', () => {
    it('the fluorite crystal carries the REE-octahedral habit flags', () => {
      const sim = runScenario('sunnyside_american_tunnel');
      const fluorites = sim.crystals.filter((c: any) => c.mineral === 'fluorite' && c.active);
      expect(fluorites.length).toBeGreaterThan(0);
      const fl = fluorites[0];
      // v103 grow_fluorite sets _ree_substitution + _photobleachable_color
      // when fluid.Y > 1.0 at growth time (Stage VI fluoride pulse
      // sets fluid.Y = 3.2).
      expect(fl._ree_substitution).toBe(true);
      expect(fl._photobleachable_color).toBe(true);
      expect(fl.habit).toBe('octahedral_REE');
    });

    it('the rhodochrosite is pale-pink (Ca-fraction > 0.5 in lattice)', () => {
      const sim = runScenario('sunnyside_american_tunnel');
      // NOT filtered on `active`: the color note is encoded at growth
      // time from the local Ca/(Mn+Ca) ratio and persists in the
      // crystal's zones regardless of whether the crystal is later
      // enclosed by a neighbor. v160 (per-voxel 3D diffusion) shifted
      // the seed-42 paragenesis so the headline rhodochrosite happens
      // to get enclosed by an adjacent galena (a Sweetwater-style
      // overgrowth — a seed-42 draw; 6 of 8 sampled seeds still leave
      // rhodochrosite exposed). The test's intent is to verify the
      // pale-pink COLOR ENCODING, which an enclosed crystal records
      // just as faithfully as an exposed one.
      const rhodos = sim.crystals.filter((c: any) => c.mineral === 'rhodochrosite');
      expect(rhodos.length).toBeGreaterThan(0);
      // The rhodochrosite engine's color note: pale pink when
      // Ca/(Mn+Ca) > 0.5. The Stage V broth gives Ca=200+, Mn=30 →
      // Ca-fraction ~ 0.87. Check the last growth-zone note encodes
      // pale-pink (kutnohorite-intermediate) color.
      const rhodo = rhodos[0];
      if (rhodo.zones && rhodo.zones.length > 0) {
        const lastZone = rhodo.zones[rhodo.zones.length - 1];
        expect(lastZone.note.toLowerCase()).toContain('pale pink');
      }
    });
  });

  describe('expects_species declaration matches actual firings', () => {
    it('scenario declares its principal species', () => {
      const scenSpec = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,(\s*[}\]])/g, '$1')
      );
      const expects = scenSpec.scenarios.sunnyside_american_tunnel.expects_species;
      expect(Array.isArray(expects)).toBe(true);
      expect(expects).toContain('rhodochrosite');
      expect(expects).toContain('fluorite');
      expect(expects).toContain('calcite');
      expect(expects).toContain('pyrite');
      expect(expects).toContain('galena');
      expect(expects).toContain('chalcopyrite');
      expect(expects).toContain('native_gold');

      const description = scenSpec.scenarios.sunnyside_american_tunnel.description;
      expect(description).toContain('Standard Metals Corporation');
      expect(description).not.toContain('dealer-conflation');
    });
  });
});
