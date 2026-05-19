// tests-js/architecture-audit.test.ts — cavity-archetype audit pins (2026-05-18, v78).
//
// Pins the geological wins from the 2026-05-18 architecture audit
// (commit c2c12ca). Six scenarios got their correct cavity archetype:
//
//   stalactite_demo, zoned_dripstone_cave, supergene_oxidation,
//   colorado_plateau  → irregular (karst, gossan, roll-front)
//   porphyry, schneeberg                                     → tabular
//                                                              (vein-controlled)
//
// What this catches: future calibration drift that accidentally
// regresses the geological signature. Pre-audit, schneeberg's
// pocket geometry suppressed the LITERAL TYPE LOCALITY MINERAL
// (zeunerite, described 1872 from the Walpurgis Flacher vein).
// Post-audit, zeunerite is back. This pin makes sure it stays back.
//
// See proposals/HANDOFF-HIGH-FILL-ARC-COMPLETE.md §5 for the
// audit's place in the open backlog.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSeeds(scenarioName: string, mineralName: string, seeds: number[]) {
  let everNucleated = false;
  let totalCount = 0;
  for (const seed of seeds) {
    setSeed(seed);
    const scen = SCENARIOS[scenarioName];
    if (!scen) return { everNucleated: null, totalCount: 0, missingScenario: true };
    const { conditions, events, defaultSteps } = scen();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    // v85 (2026-05-19): count any crystal that ORIGINATED as the named
    // mineral, including post-transformation paramorphs. The autunite-
    // group meta- trio (meta-autunite, metatorbernite, metazeunerite)
    // converts at-source post-cooling at Schneeberg's still-warm ring
    // contacts — the type-locality nucleation event happened (the
    // mineralogical signature is preserved), the lattice just lost
    // its structural water by run-end. This is the correct geological
    // signal: museum-drawer torbernite/zeunerite from Schneeberg IS
    // largely metatorbernite/metazeunerite by the time it reaches a
    // collector, exactly because of this kind of ring-T pulse.
    const hits = sim.crystals.filter((c: any) =>
      c.mineral === mineralName || c.paramorph_origin === mineralName,
    );
    if (hits.length > 0) {
      everNucleated = true;
      totalCount += hits.length;
    }
  }
  return { everNucleated, totalCount };
}

describe('Architecture audit — cavity archetype pins (2026-05-18, v78)', () => {
  describe('tabular activates: schneeberg = five-element vein, Walpurgis Flacher', () => {
    it('zeunerite (TYPE LOCALITY mineral) nucleates in schneeberg', () => {
      // The 1872 type for zeunerite was described from the Walpurgis
      // Flacher vein at the Weisser Hirsch Mine — exactly the scenario
      // this anchors. Under pre-audit pocket geometry, zeunerite was
      // structurally suppressed. Under tabular geometry it fires.
      const r = runSeeds('schneeberg', 'zeunerite', [42, 1, 7]);
      expect(r.everNucleated, `zeunerite never nucleated across seeds (audit regression!)`)
        .toBe(true);
    });

    it('annabergite (Co-Ni arsenate, Schneeberg signature) nucleates', () => {
      // Annabergite is another Schneeberg signature — Co-Ni-As decay
      // product from the cobaltite/nickeline supergene cascade.
      // Documented since the 1700s at the locality.
      const r = runSeeds('schneeberg', 'annabergite', [42, 1, 7]);
      expect(r.everNucleated, `annabergite never nucleated across seeds`)
        .toBe(true);
    });

    it('uranospinite (still fires) in schneeberg', () => {
      // Uranospinite is also a Schneeberg type-locality mineral (1873).
      // Architecture audit kept it active.
      const r = runSeeds('schneeberg', 'uranospinite', [42, 1, 7]);
      expect(r.everNucleated, `uranospinite never nucleated across seeds`)
        .toBe(true);
    });

    it('torbernite (Schneeberg type, 1772) still fires', () => {
      // The mineral that started the Walpurgis Flacher type-locality
      // sequence (described 1772). All three uranyl species pass.
      const r = runSeeds('schneeberg', 'torbernite', [42, 1, 7]);
      expect(r.everNucleated, `torbernite never nucleated across seeds`)
        .toBe(true);
    });
  });

  describe('architecture field is set on each audited scenario', () => {
    // Source-inspection pins so the architecture field doesn't quietly
    // drift back to pocket via JSON edit accident. We construct the
    // scenario and read wall.architecture from conditions.
    function getArchetype(scenarioName: string): string | null {
      const scen = SCENARIOS[scenarioName];
      if (!scen) return null;
      const { conditions } = scen();
      return conditions?.wall?.architecture ?? null;
    }

    it('schneeberg.architecture === "tabular"', () => {
      expect(getArchetype('schneeberg')).toBe('tabular');
    });

    it('porphyry.architecture === "tabular"', () => {
      expect(getArchetype('porphyry')).toBe('tabular');
    });

    it('stalactite_demo.architecture === "irregular"', () => {
      expect(getArchetype('stalactite_demo')).toBe('irregular');
    });

    it('zoned_dripstone_cave.architecture === "irregular"', () => {
      expect(getArchetype('zoned_dripstone_cave')).toBe('irregular');
    });

    it('supergene_oxidation.architecture === "irregular"', () => {
      expect(getArchetype('supergene_oxidation')).toBe('irregular');
    });

    it('colorado_plateau.architecture === "irregular"', () => {
      expect(getArchetype('colorado_plateau')).toBe('irregular');
    });
  });

  describe('tabular geometry produces the elongation + walls_only effect', () => {
    it('schneeberg WallState carries elongation > 0', () => {
      // tabular archetype sets elongation = 0.55 (anisotropic cross-
      // section, fracture-pocket shape). Pocket archetype leaves it at
      // 0. This pin catches accidental archetype regressions.
      setSeed(42);
      const { conditions, events } = SCENARIOS['schneeberg']();
      const sim = new VugSimulator(conditions, events);
      expect(sim.wall_state.elongation, 'tabular elongation must be > 0')
        .toBeGreaterThan(0);
    });

    it('schneeberg WallState carries walls_only nucleation bias', () => {
      // tabular's nucleation_bias = 'walls_only' keeps crystals off the
      // floor/ceiling poles of the tabular cavity (geologically: vein
      // crystals nucleate on the wall faces of the fissure).
      setSeed(42);
      const { conditions, events } = SCENARIOS['schneeberg']();
      const sim = new VugSimulator(conditions, events);
      expect(sim.wall_state.nucleation_bias)
        .toBe('walls_only');
    });

    it('irregular scenarios keep uniform nucleation', () => {
      // sanity check the other half: irregular archetype keeps
      // nucleation_bias = 'uniform'.
      for (const name of ['stalactite_demo', 'supergene_oxidation', 'colorado_plateau']) {
        setSeed(42);
        const { conditions, events } = SCENARIOS[name]();
        const sim = new VugSimulator(conditions, events);
        expect(sim.wall_state.nucleation_bias, `${name} should be uniform`)
          .toBe('uniform');
      }
    });
  });
});
