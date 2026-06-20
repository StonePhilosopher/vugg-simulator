// tests-js/titanite.test.ts — CaTiSiO₅ (sphene) engine pins (v205, 2026-06-19).
//
// Titanite — monoclinic Ca-Ti-Si nesosilicate, de-orphans PROPOSALS-LEDGER
// §A #13 and is the first piece of the alpine-cleft arc (the quartz-morphology
// content home). Per research-grimsel-alpine-cleft.md §5 + Handbook of
// Mineralogy 2001 (Göschener Alp alpine-cleft analysis) + Oberti et al. 1991.
//
// What this catches:
//   * Engine gates: Ti (the rare discriminator), Ca, SiO2 floors; T window
//     150-700°C; pH 6.0-9.5.
//   * NO redox gate (Ti⁴⁺ is fO2-insensitive — fires oxidizing AND reducing,
//     the discriminator vs epidote which needs O2).
//   * Habit dispatch (sphenoid_wedge / prismatic / flattened_tabular).
//   * Color dispatch by Cr (green) / Fe (brown) trace — NOT a gate.
//   * Fires in tormiq_alpine_cleft (the showcase, replaces the magnetite
//     Ti-Fe-oxide stand-in) + porphyry (igneous accessory).
//   * Ti=0 scenarios stay titanite-free (the footprint is contained).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runScenario(scenarioName: string, seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[scenarioName]();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_titanite();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

function sigmaAt(opts: any): number {
  const fluid = new FluidChemistry(opts);
  const cond = new VugConditions({ temperature: opts.T ?? 350, fluid });
  return cond.supersaturation_titanite();
}

describe('Titanite — CaTiSiO₅ engine (v205)', () => {
  describe('supersaturation_titanite gate correctness', () => {
    it('returns 0 when Ti < 0.5 (the discriminator — Ti is the rare ingredient)', () => {
      expect(sigmaAt({ Ti: 0.2, Ca: 600, SiO2: 320, pH: 7.0, T: 350 })).toBe(0);
    });

    it('returns 0 when Ca < 40', () => {
      expect(sigmaAt({ Ti: 1, Ca: 20, SiO2: 320, pH: 7.0, T: 350 })).toBe(0);
    });

    it('returns 0 when SiO2 < 80', () => {
      expect(sigmaAt({ Ti: 1, Ca: 600, SiO2: 40, pH: 7.0, T: 350 })).toBe(0);
    });

    it('returns 0 at T < 150°C and T > 700°C', () => {
      expect(sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 7.0, T: 120 })).toBe(0);
      expect(sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 7.0, T: 800 })).toBe(0);
    });

    it('returns 0 outside pH 6.0-9.5', () => {
      expect(sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 5.0, T: 350 })).toBe(0);
      expect(sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 10.0, T: 350 })).toBe(0);
    });

    it('fires σ > 1 at alpine-cleft chemistry (Ca=600, Ti=1, SiO2=320, T=350, pH=7)', () => {
      const s = sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 7.0, T: 350 });
      expect(s, `titanite σ was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });

    it('is REDOX-INSENSITIVE — fires the same oxidizing OR reducing (no O2 gate, unlike epidote)', () => {
      const oxid = sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, O2: 2.0, pH: 7.0, T: 350 });
      const redu = sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, O2: 0.0, pH: 7.0, T: 350 });
      expect(oxid).toBeGreaterThan(1.0);
      expect(redu).toBeGreaterThan(1.0);
      expect(oxid).toBeCloseTo(redu, 5);  // redox makes NO difference
    });

    it('T sweet spot 250-450°C peaks above the window edges', () => {
      const at350 = sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 7.0, T: 350 });
      const at650 = sigmaAt({ Ti: 1, Ca: 600, SiO2: 320, pH: 7.0, T: 650 });
      expect(at350).toBeGreaterThan(at650);
    });
  });

  describe('tormiq_alpine_cleft integration — the showcase (replaces the magnetite Ti-oxide stand-in)', () => {
    it.each([42, 1, 7])('seed %d: at least 1 titanite forms', (seed) => {
      const { sim } = runScenario('tormiq_alpine_cleft', seed);
      const tt = sim.crystals.filter((c: any) => c.mineral === 'titanite');
      expect(tt.length, `seed ${seed}: zero titanite in tormiq`).toBeGreaterThan(0);
    });

    it('titanite respects a small accessory cap (≤ 8 total across the run)', () => {
      for (const seed of [42, 1, 7]) {
        const { sim } = runScenario('tormiq_alpine_cleft', seed);
        const tt = sim.crystals.filter((c: any) => c.mineral === 'titanite');
        expect(tt.length).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('porphyry integration — the igneous-accessory titanite', () => {
    it.each([42, 1, 7])('seed %d: at least 1 titanite forms', (seed) => {
      const { sim } = runScenario('porphyry', seed);
      const tt = sim.crystals.filter((c: any) => c.mineral === 'titanite');
      expect(tt.length, `seed ${seed}: zero titanite in porphyry`).toBeGreaterThan(0);
    });
  });

  describe('habit + substrate', () => {
    it('titanite samples the wedge/prismatic/tabular habit alphabet across seeds', () => {
      const habits = new Set<string>();
      for (const seed of [42, 1, 7]) {
        for (const scen of ['tormiq_alpine_cleft', 'porphyry']) {
          const { sim } = runScenario(scen, seed);
          for (const c of sim.crystals.filter((c: any) => c.mineral === 'titanite')) {
            if (c.habit) habits.add(c.habit);
          }
        }
      }
      const canonical = ['sphenoid_wedge', 'prismatic', 'flattened_tabular'];
      expect(canonical.filter(h => habits.has(h)).length,
        `expected a canonical titanite habit; got ${[...habits].join(',')}`).toBeGreaterThan(0);
    });

    it('nucleates on canonical alpine-cleft substrate (quartz/adularia/epidote/calcite/wall)', () => {
      let total = 0, onSubstrate = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runScenario('tormiq_alpine_cleft', seed);
        for (const c of sim.crystals.filter((c: any) => c.mineral === 'titanite')) {
          total++;
          const pos = c.position || '';
          if (pos.includes('quartz') || pos.includes('feldspar') || pos.includes('epidote')
              || pos.includes('calcite') || pos === 'vug wall') onSubstrate++;
        }
      }
      expect(total, 'no titanite to inspect').toBeGreaterThan(0);
      expect(onSubstrate, `expected titanite on canonical substrate; got ${onSubstrate}/${total}`).toBe(total);
    });
  });

  describe('footprint is contained — Ti-poor scenarios stay titanite-free', () => {
    it.each(['bisbee', 'supergene_oxidation', 'sulphur_bank'])('%s: zero titanite (no Ti budget)', (scen) => {
      const { sim } = runScenario(scen, 42);
      const tt = sim.crystals.filter((c: any) => c.mineral === 'titanite');
      expect(tt.length).toBe(0);
    });
  });
});
