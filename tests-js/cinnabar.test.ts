// tests-js/cinnabar.test.ts — cinnabar mineral + Sulphur Bank
// integration pins (2026-05-18, v81).
//
// Cinnabar (HgS) is the new mineral. Lit by sulphur_bank scenario
// (mercury was the deposit's namesake commodity, but the simulator
// had no Hg field + no cinnabar engine until v81).
//
// Anchor: Almadén (Spain, type locality, mined 2000+ years),
// Sulphur Bank Mine (CA, scenario anchor), Idria (Slovenia),
// New Almaden (CA).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const MINERAL_SPEC: any;
declare const setSeed: any;

function runSulphurBank(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_cinnabar();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

describe('Cinnabar (HgS) — v81 mineral addition', () => {
  // (MINERAL_SPEC-based pins are dropped because globalThis.MINERAL_SPEC
  // in tests is the inline fallback snapshot — the async live-load
  // re-assignment doesn't propagate to globalThis after eval. The
  // engine-fire pins below are the actual behavior check, which is
  // what we care about.)

  describe('FluidChemistry.Hg field', () => {
    it('Hg defaults to 0', () => {
      const f = new FluidChemistry();
      expect(f.Hg).toBe(0);
    });

    it('Hg can be set via opts', () => {
      const f = new FluidChemistry({ Hg: 12 });
      expect(f.Hg).toBe(12);
    });
  });

  describe('supersaturation_cinnabar gates', () => {
    function sigmaAt(opts: any): number {
      const { T, ...fluidOpts } = opts;
      const fluid = new FluidChemistry(fluidOpts);
      const cond = new VugConditions({ temperature: T ?? 75, fluid });
      return cond.supersaturation_cinnabar();
    }

    it('returns 0 when Hg < 1.0', () => {
      const s = sigmaAt({ Hg: 0.5, S: 200, O2: 0.4, pH: 3.0, T: 75 });
      expect(s).toBe(0);
    });

    it('returns 0 when S < 50', () => {
      const s = sigmaAt({ Hg: 15, S: 30, O2: 0.4, pH: 3.0, T: 75 });
      expect(s).toBe(0);
    });

    it('returns 0 when O2 > 1.0 (fully oxic destroys HgS)', () => {
      const s = sigmaAt({ Hg: 15, S: 200, O2: 1.5, pH: 3.0, T: 75 });
      expect(s).toBe(0);
    });

    it('fires at Sulphur-Bank-style fluid (Hg=15, S=500, pH=2, T=75)', () => {
      const s = sigmaAt({ Hg: 15, S: 500, O2: 0.4, pH: 2.0, T: 75 });
      expect(s, `sigma at SB-style fluid was ${s.toFixed(2)}`).toBeGreaterThan(2.0);
    });

    it('fires at Sicily-style fluid (Hg=15, S=400, pH=6, T=30)', () => {
      // If Sicily also carries Hg trace (geologically real — Sicilian
      // sulfur ores have minor cinnabar in the SE part of the field),
      // the engine would fire there too. Broad pH tolerance is what
      // makes cinnabar the rare sulfide that works across both
      // native-sulfur deposit types.
      const s = sigmaAt({ Hg: 15, S: 400, O2: 0.4, pH: 6.0, T: 30 });
      expect(s, `sigma at Sicily-style fluid was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });
  });

  describe('Sulphur Bank integration (the namesake-commodity pin)', () => {
    it.each([42, 1, 7])('seed %d: cinnabar peak sigma > 3.0', (seed) => {
      const { maxSigma } = runSulphurBank(seed);
      expect(maxSigma, `cinnabar peak sigma at seed ${seed} was ${maxSigma.toFixed(2)}`)
        .toBeGreaterThan(3.0);
    });

    it.each([42, 1, 7])('seed %d: at least 4 active cinnabar crystals', (seed) => {
      const { sim } = runSulphurBank(seed);
      const active = sim.crystals.filter((c: any) =>
        c.mineral === 'cinnabar' && c.active,
      );
      expect(active.length, `seed ${seed}: only ${active.length} active cinnabar crystals`)
        .toBeGreaterThanOrEqual(4);
    });

    it.each([42, 1, 7])('seed %d: cinnabar reaches one of the canonical Sulphur Bank habits', (seed) => {
      // The engine's habit dispatcher:
      //   excess > 1.5            → massive_red (vermillion massive aggregate)
      //   T < 100, modest excess  → rhombohedral_cochineal (deep red rhombs)
      //   T >= 100, modest excess → rhombohedral_cochineal (stout rhombs)
      // At Sulphur Bank peak σ ~6.5, excess > 1.5 → massive_red
      // dominates; rhombohedral_cochineal may appear in early-σ phases
      // before recharge events spike σ. We pin "one of the canonical
      // cinnabar habits fires" rather than a specific one.
      const { sim } = runSulphurBank(seed);
      const allCb = sim.crystals.filter((c: any) => c.mineral === 'cinnabar');
      expect(allCb.length, `seed ${seed}: no cinnabar at all`).toBeGreaterThan(0);
      const canonicalHabits = ['rhombohedral_cochineal', 'massive_red'];
      const matched = allCb.filter((c: any) => canonicalHabits.includes(c.habit));
      expect(matched.length,
        `seed ${seed}: no cinnabar in canonical habits (got habits: ${[...new Set(allCb.map((c: any) => c.habit))].join(', ')})`)
        .toBeGreaterThan(0);
    });
  });

  describe('Sulphur Bank zoning: association is not sulfur epitaxy', () => {
    // USGS Bull. 922-L records cinnabar films on fractures in less-altered
    // basalt, whereas thoroughly opalized sulfurous rock contains little
    // cinnabar. USGS Bull. 1693 similarly separates native sulfur above the
    // palaeo-water table from cinnabar disseminations and fracture coatings.
    // Preserve the real association without inventing an S0 substrate.
    it('co-produces cinnabar and native sulfur without false sulfur-substrate labels', () => {
      let cinnabar = 0;
      let nativeSulfur = 0;
      let falseSulfurSubstrates = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runSulphurBank(seed);
        const cb = sim.crystals.filter((c: any) => c.mineral === 'cinnabar');
        const ns = sim.crystals.filter((c: any) => c.mineral === 'native_sulfur');
        cinnabar += cb.length;
        nativeSulfur += ns.length;
        falseSulfurSubstrates += cb.filter((c: any) =>
          (c.position || '').includes('native_sulfur')).length;
      }
      expect(cinnabar).toBeGreaterThan(0);
      expect(nativeSulfur).toBeGreaterThan(0);
      expect(falseSulfurSubstrates).toBe(0);
    });
  });

  describe('Sulphur Bank scenario carries Hg', () => {
    it('initial fluid has Hg >= 5 ppm', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.fluid.Hg).toBeGreaterThanOrEqual(5);
    });

    it('expects_species lists cinnabar', () => {
      // Inspecting the underlying spec attached to the scenario callable.
      const callable = SCENARIOS['sulphur_bank'];
      const spec = (callable as any)._json5_spec;
      expect(spec).toBeTruthy();
      expect(spec.expects_species).toContain('cinnabar');
    });
  });
});
