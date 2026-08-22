// tests-js/shigar-pegmatite.test.ts — v216 scenario tests.
//
// Shigar Valley aquamarine pegmatite (Dassu / Nyet-Bruk / Yuno / Alchuri,
// Skardu District, Gilgit-Baltistan, Pakistan). The beryl-family's anchor
// scenario — aquamarine is the geological anchor, but SIM 272 treats it as
// an aspirational licensed product until the executed chemistry grows it —
// and the stage
// for Tutorial 4 (collecting). Seven events, 70 steps:
//   1 outer shell 555°C (microcline + smoky quartz)
//   2 schorl 520°C (B crosses its ≥6 floor)
//   3 cleavelandite 490°C (albitization, K→Na)
//   4 AQUAMARINE 430°C (Be crosses its ≥10 floor; Fe re-floored at 12,
//     O2 held ≤0.3 — Fe²⁺-blue per Goldman/Rossman/Parkin 1978, inside
//     the 435-355°C pocket window per London/Hunt/Duval 2020)
//   5 topaz 380°C (F crosses its ≥20 floor)
//   6 HF ETCH 310°C (Be crash + F>30 + pH<3 → _beryl_family_dissolution
//     etch branch; etched Pakistani blue beryl per G&G 57(2) 2021)
//   7 quiet at 265°C
//
// Variety-dispatch fences: Cr 0.05 / V 0.2 (no emerald), Mn 0.8 (no
// morganite), O2 0.15 (no heliodor), Fe ≥ 8 (no goshenite).

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
  const steps = defaultSteps ?? 70;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

describe('Shigar Valley aquamarine pegmatite scenario (v216)', () => {
  describe('scenario is registered + fires', () => {
    it('SCENARIOS.shigar_pegmatite exists', () => {
      expect(typeof SCENARIOS.shigar_pegmatite).toBe('function');
    });

    it('runs to completion and produces crystals', () => {
      const sim = runScenario('shigar_pegmatite');
      expect(sim).not.toBeNull();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });
  });

  describe('paragenesis — expected mineral firings at seed 42', () => {
    let sim: any;
    let species: Set<string>;

    function ensureSim() {
      if (!sim) {
        sim = runScenario('shigar_pegmatite');
        species = new Set(sim.crystals.map((c: any) => c.mineral));
      }
    }

    it('does not overstate the aspirational aquamarine anchor as a seed-42 product', () => {
      ensureSim();
      expect(species.has('aquamarine')).toBe(false);
    });

    it('fires quartz (pegmatite silica saturation)', () => {
      ensureSim();
      expect(species.has('quartz')).toBe(true);
    });

    it('fires tourmaline (schorl on the boron budget)', () => {
      ensureSim();
      expect(species.has('tourmaline')).toBe(true);
    });

    it('fires topaz after the F-rich late-pocket pulse', () => {
      ensureSim();
      expect(species.has('topaz')).toBe(true);
    });

    it('fires the feldspar story (microcline wall zone + cleavelandite albitization)', () => {
      ensureSim();
      expect(species.has('feldspar')).toBe(true);
      expect(species.has('albite')).toBe(true);
    });

    it('keeps every unlicensed beryl-family substitute absent', () => {
      ensureSim();
      // Cr/V at trace (no emerald), Mn<2 (no morganite), O2 0.15 (no
      // heliodor), Fe≥8 (goshenite/'beryl' returns 0). If any of these
      // appear, a fence moved — check the broth against the gates in
      // js/39-supersat-silicate.ts before touching this pin.
      expect(species.has('beryl')).toBe(false);
      expect(species.has('emerald')).toBe(false);
      expect(species.has('morganite')).toBe(false);
      expect(species.has('heliodor')).toBe(false);
    });
  });

  describe('engine integration — the Shigar signatures', () => {
    let sim: any;

    function ensureSim() {
      if (!sim) sim = runScenario('shigar_pegmatite');
    }

    it('smoky quartz: the pegmatite host doses quartz (Rossman [AlO4]0 path)', () => {
      ensureSim();
      const quartzes = sim.crystals.filter((c: any) => c.mineral === 'quartz');
      expect(quartzes.length).toBeGreaterThan(0);
      // composition 'pegmatite' → radHost 1.0 → dose accrues per step.
      const dosed = quartzes.some((c: any) => (c.radiation_damage || 0) > 0.05);
      expect(dosed).toBe(true);
    });

    it('does not invent an HF etch testimony without an executed aquamarine parent', () => {
      ensureSim();
      const aquas = sim.crystals.filter((c: any) => c.mineral === 'aquamarine');
      expect(aquas).toEqual([]);
      expect(sim.log.some((line: string) => /HF-assisted dissolution/.test(line))).toBe(false);
    });
  });

  describe('expects_species declaration ↔ JSON5', () => {
    it('declares the five executed headlines and separately licenses aquamarine as aspirational', () => {
      const raw = fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8');
      const m = raw.match(/"shigar_pegmatite":\s*\{[\s\S]*?"expects_species":\s*\[([^\]]*)\]/);
      expect(m).not.toBeNull();
      const declared = [...m![1].matchAll(/"([a-z_0-9]+)"/g)].map(x => x[1]).sort();
      expect(declared).toEqual(
        ['albite', 'feldspar', 'quartz', 'topaz', 'tourmaline']);

      const parsed = JSON.parse(raw
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1'));
      expect(parsed.scenarios.shigar_pegmatite.aspirational_species)
        .toContainEqual(expect.objectContaining({
          mineral: 'aquamarine',
          reason: expect.stringMatching(/no discrete aquamarine.*three SIM 272 commissioned seeds/i),
        }));
    });

    it('duration is tutorial-tempo (70 steps)', () => {
      const raw = fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8');
      const m = raw.match(/"shigar_pegmatite":\s*\{[\s\S]*?"duration_steps":\s*(\d+)/);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBe(70);
    });
  });
});
