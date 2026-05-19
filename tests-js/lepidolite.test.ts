// tests-js/lepidolite.test.ts — Li-mica engine pins (v86, 2026-05-19).
//
// Lepidolite K(Li,Al)₃(Al,Si)₄O₁₀(F,OH)₂ — trioctahedral lithium mica.
// Late-pegmatite mineral with Mn²⁺-purple chromophore (Evans & Raftery
// 1982) and thermoluminescence (50-200°C heat releases visible light;
// research-lepidolite.md §Fluorescence & Luminescence).
//
// Slots into gem_pegmatite Cruzeiro paragenesis (Cassedanne 1991). The
// LCT pegmatite sequence has lepidolite at the Li-phase boundary,
// typically replacing spodumene during late hydrothermal alteration.
//
// What this catches:
//   * supersaturation_lepidolite gate correctness (K/Li/Al/SiO2/F all
//     required; pH window; T window; Fe-suppression branch).
//   * Engine fires reliably in gem_pegmatite across 3 seeds.
//   * Variety dispatch: Mn=8 (gem_pegmatite default) → purple_book.
//   * Substrate preference includes spodumene replacement.
//   * Other scenarios (no Li or no F) do NOT fire lepidolite.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runGemPegmatite(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['gem_pegmatite']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 230;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_lepidolite();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

describe('Lepidolite — Li-mica engine (v86)', () => {
  describe('supersaturation_lepidolite gate correctness', () => {
    function sigmaAt(opts: any): number {
      const fluid = new FluidChemistry(opts);
      const cond = new VugConditions({ temperature: opts.T ?? 450, fluid });
      return cond.supersaturation_lepidolite();
    }

    it('returns 0 when K < 10', () => {
      expect(sigmaAt({ K: 5, Li: 30, Al: 80, SiO2: 5000, F: 20, T: 450 })).toBe(0);
    });

    it('returns 0 when Li < 15', () => {
      expect(sigmaAt({ K: 50, Li: 10, Al: 80, SiO2: 5000, F: 20, T: 450 })).toBe(0);
    });

    it('returns 0 when Al < 10', () => {
      expect(sigmaAt({ K: 50, Li: 30, Al: 5, SiO2: 5000, F: 20, T: 450 })).toBe(0);
    });

    it('returns 0 when SiO2 < 200', () => {
      expect(sigmaAt({ K: 50, Li: 30, Al: 80, SiO2: 100, F: 20, T: 450 })).toBe(0);
    });

    it('returns 0 when F < 5 (lepidolite is F-essential)', () => {
      expect(sigmaAt({ K: 50, Li: 30, Al: 80, SiO2: 5000, F: 2, T: 450 })).toBe(0);
    });

    it('returns 0 at pH < 6 (acidic destabilization)', () => {
      expect(sigmaAt({ K: 50, Li: 30, Al: 80, SiO2: 5000, F: 20, pH: 4.0, T: 450 })).toBe(0);
    });

    it('returns 0 at pH > 9 (alkaline cap)', () => {
      expect(sigmaAt({ K: 50, Li: 30, Al: 80, SiO2: 5000, F: 20, pH: 10.0, T: 450 })).toBe(0);
    });

    it('fires σ > 1.0 at gem_pegmatite-style chemistry (T=450°C)', () => {
      const s = sigmaAt({ K: 80, Li: 35, Al: 150, SiO2: 8000, F: 25, Mn: 8, pH: 6.8, T: 450 });
      expect(s, `lepidolite σ was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });

    it('T optimum 400-500°C — peaks above T=300 fallback', () => {
      const at450 = sigmaAt({ K: 80, Li: 35, Al: 150, SiO2: 8000, F: 25, T: 450 });
      const at300 = sigmaAt({ K: 80, Li: 35, Al: 150, SiO2: 8000, F: 25, T: 300 });
      expect(at450, `σ at T=450 was ${at450.toFixed(2)}`).toBeGreaterThan(at300);
    });

    it('Fe>100 ppm suppresses sigma toward zinnwaldite', () => {
      const lowFe = sigmaAt({ K: 80, Li: 35, Al: 150, SiO2: 8000, F: 25, Fe: 20, T: 450 });
      const hiFe  = sigmaAt({ K: 80, Li: 35, Al: 150, SiO2: 8000, F: 25, Fe: 300, T: 450 });
      expect(hiFe, `σ at high Fe was ${hiFe.toFixed(2)}, low Fe was ${lowFe.toFixed(2)}`)
        .toBeLessThan(lowFe);
    });
  });

  describe('gem_pegmatite integration — Cruzeiro Li phase (Cassedanne 1991)', () => {
    it.each([42, 1, 7])('seed %d: lepidolite peak σ > 1.5', (seed) => {
      const { maxSigma } = runGemPegmatite(seed);
      expect(maxSigma, `seed ${seed}: lepidolite peak σ was ${maxSigma.toFixed(2)}`)
        .toBeGreaterThan(1.5);
    });

    it.each([42, 1, 7])('seed %d: at least 1 lepidolite crystal forms', (seed) => {
      const { sim } = runGemPegmatite(seed);
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
      expect(lep.length, `seed ${seed}: zero lepidolite crystals formed`)
        .toBeGreaterThan(0);
    });

    it.each([42, 1, 7])('seed %d: lepidolite respects cap=3', (seed) => {
      const { sim } = runGemPegmatite(seed);
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
      expect(lep.length, `seed ${seed}: ${lep.length} lepidolite > cap`)
        .toBeLessThanOrEqual(3);
    });

    it.each([42, 1, 7])('seed %d: gem_pegmatite Mn=8 routes to purple_book variety', (seed) => {
      const { sim } = runGemPegmatite(seed);
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite' && c.active);
      if (lep.length === 0) return; // covered by separate pin
      const purple = lep.filter((c: any) => c.habit === 'purple_book' || c.habit === 'scaly_aggregate');
      expect(purple.length,
        `seed ${seed}: lepidolite habits = ${lep.map((c: any) => c.habit).join(',')}; expected purple_book or scaly_aggregate`)
        .toBeGreaterThan(0);
    });
  });

  describe('substrate preference — spodumene replacement documented in research', () => {
    it('lepidolite nucleates on existing spodumene/tourmaline/feldspar/quartz or vug wall across 3 seeds', () => {
      let onSubstrate = 0;
      let total = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runGemPegmatite(seed);
        const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
        for (const c of lep) {
          total++;
          const pos = c.position || '';
          if (pos.includes('spodumene') || pos.includes('tourmaline')
              || pos.includes('feldspar') || pos.includes('quartz')
              || pos === 'vug wall') {
            onSubstrate++;
          }
        }
      }
      expect(total, 'no lepidolite crystals to inspect across 3 seeds').toBeGreaterThan(0);
      expect(onSubstrate,
        `expected lepidolite on canonical substrate across 3 seeds; got ${onSubstrate}/${total}`)
        .toBe(total);
    });
  });

  describe('other scenarios do NOT fire lepidolite (no Li/F coincidence)', () => {
    it('sulphur_bank: zero lepidolite (no Li, no F)', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
      expect(lep.length).toBe(0);
    });

    it('schneeberg: zero lepidolite (Li=15 below gate, F=20 ok, but Mn=5 trace + T regime wrong)', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS['schneeberg']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < (defaultSteps ?? 160); i++) sim.run_step();
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
      expect(lep.length,
        `schneeberg unexpectedly produced ${lep.length} lepidolite — chemistry should be borderline at best`)
        .toBe(0);
    });
  });

  describe('gem_pegmatite expects_species declaration includes lepidolite (added v91)', () => {
    it('lepidolite is listed in expects_species', () => {
      // v91 added lepidolite to gem_pegmatite's expects_species so the
      // canonical contract for the Cruzeiro scenario now reflects what
      // the engine actually produces. Cassedanne 1991 documents
      // lepidolite at Cruzeiro; the v91 addition makes it a pin.
      const callable = SCENARIOS['gem_pegmatite'];
      const spec = (callable as any)._json5_spec;
      expect(spec).toBeTruthy();
      expect(spec.expects_species).toContain('lepidolite');
    });

    it('lepidolite fires in gem_pegmatite (matches expects_species pin)', () => {
      const { sim } = runGemPegmatite(42);
      const lep = sim.crystals.filter((c: any) => c.mineral === 'lepidolite');
      expect(lep.length).toBeGreaterThan(0);
    });
  });
});
