// tests-js/reactivated-fluorite-vein.test.ts — v176 scenario tests.
//
// The fluid-spots SEAL → BREACH lifecycle (js/85k Phase 2d) demonstrator:
// a crack-seal reactivated vug (North-Pennine-style fluorite-galena-barite).
// Stage 1 grows while the feeders are OPEN (fluid_mixing@20 + fluid_pulse@60);
// a cement SEALS them (event_reactivated_vein_seal@78, spots:'seal'); a
// tectonic pulse BREACHES them open again (event_reactivated_vein_breach@118,
// spots:'breach') for a gen-2 fluorite + calcite.
//
// The headline assertion is the MECHANISM, not just the assemblage: the
// feeder open-count must be >0 in stage 1, drop to 0 across the sealed
// interval, and rise again after the breach. That's what proves the
// scenario actually exercises the (previously unused) breach API.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'reactivated_fluorite_vein';

function runScenario(seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[NAME];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 160;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

// Step through capturing the open-feeder count after each step, so we can
// see the seal→breach lifecycle in the timeline (robust to ±1 step-index).
function runWithSpotTimeline(seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[NAME];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 160;
  const openAt: number[] = [];
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const fsf = sim._fluidSpots;
    openAt.push(fsf && !fsf.isEmpty ? fsf.openSpots().length : 0);
  }
  return { sim, openAt };
}

const maxIn = (a: number[], lo: number, hi: number) =>
  Math.max(0, ...a.slice(lo, hi));

describe('Reactivated fluorite vein scenario (v176)', () => {
  describe('scenario is registered + fires', () => {
    it('SCENARIOS.reactivated_fluorite_vein exists', () => {
      expect(typeof SCENARIOS[NAME]).toBe('function');
    });

    it('runs to completion and produces crystals', () => {
      const sim = runScenario();
      expect(sim).not.toBeNull();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });
  });

  describe('THE MECHANISM — seal → breach feeder lifecycle (Phase 2d)', () => {
    it('seeds fluid feeders that the lifecycle can toggle', () => {
      const r = runWithSpotTimeline()!;
      expect(r.sim._fluidSpots).toBeTruthy();
      expect(r.sim._fluidSpots.isEmpty).toBe(false);
    });

    it('feeders are OPEN in stage 1, SEALED across the quiet interval, BREACHED open for stage 2', () => {
      const { openAt } = runWithSpotTimeline()!;
      // Stage 1 (open growth, ~steps 30-70): some feeders open.
      expect(maxIn(openAt, 30, 71)).toBeGreaterThan(0);
      // Sealed interval (after seal@78, before breach@118, ~steps 90-110): all shut.
      expect(maxIn(openAt, 90, 111)).toBe(0);
      // After the breach (~steps 130-159): feeders open again.
      expect(maxIn(openAt, 130, 160)).toBeGreaterThan(0);
    });
  });

  describe('paragenesis — expected mineral firings at seed 42', () => {
    let species: Set<string>;
    function ensure() {
      if (!species) species = new Set(runScenario()!.crystals.map((c: any) => c.mineral));
    }

    it('fires the gangue + sulfide assemblage (fluorite, galena, barite, calcite)', () => {
      ensure();
      expect(species.has('fluorite')).toBe(true);
      expect(species.has('galena')).toBe(true);
      expect(species.has('barite')).toBe(true);
      expect(species.has('calcite')).toBe(true);
    });

    it('fires a Zn-sulfide (sphalerite OR wurtzite — the high-T polymorph)', () => {
      ensure();
      expect(species.has('sphalerite') || species.has('wurtzite')).toBe(true);
    });
  });

  describe('expects_species declaration matches the JSON5 spec', () => {
    it('declares its principal species', () => {
      const spec = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,(\s*[}\]])/g, '$1')
      );
      const expects = spec.scenarios[NAME].expects_species;
      expect(Array.isArray(expects)).toBe(true);
      for (const m of ['fluorite', 'galena', 'barite', 'calcite', 'sphalerite']) {
        expect(expects).toContain(m);
      }
    });
  });
});
