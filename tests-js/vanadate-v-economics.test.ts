// tests-js/vanadate-v-economics.test.ts — descloizite-group V economics.
//
// THE CORRECTION (task #55, the twice-deferred roughten_gill mottramite
// arc): mottramite + descloizite were a dead-species pair fleet-wide
// while their V-gate sat at 10 — 5× vanadinite's 2 — backwards against
// the deposits (the descloizite group ARE the abundant supergene V ores;
// Boni et al. 2007 Econ Geol 102:441). Two engine bugs + one missing
// engine corrections, each pinned here:
//
//   1. vanadinite's MISSING redox gate (was cloned from pyromorphite,
//      a PO4 phase with no redox requirement; V⁵⁺ vanadate needs O2).
//   2. descloizite-group V-economics (V_min 10→4, v_f /20→/8 — brought
//      to vanadinite-comparable V economy, not privileged).

import { describe, expect, it } from 'vitest';
import {
  currentEvidenceIdentity,
  loadAuthenticatedEvidenceJson,
  requireEvidenceScenario,
} from './authenticated-evidence';

declare const VugConditions: any;
declare const FluidChemistry: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
const SIM_VERSION = currentEvidenceIdentity.simVersion;
const LOCALITY_FREQUENCY = loadAuthenticatedEvidenceJson(
  `tests-js/baselines/locality_frequency_v${SIM_VERSION}.json`,
  'locality-frequency',
);
const SEED42_BASELINE = loadAuthenticatedEvidenceJson(
  `tests-js/baselines/seed42_v${SIM_VERSION}.json`,
  'seed42-baseline',
);

function finalAliveGrownGroup(seed: number): number {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.supergene_oxidation();
  const sim = new VugSimulator(conditions, events);
  for (let step = 0; step < (defaultSteps ?? 200); step++) sim.run_step();
  return sim.crystals.filter((crystal: any) =>
    (crystal.mineral === 'mottramite' || crystal.mineral === 'descloizite')
      && !crystal.dissolved
      && Number(crystal.total_growth_um) > 0,
  ).length;
}

describe('v193 — vanadinite redox gate (the missing V⁵⁺ oxidation requirement)', () => {
  it('blocks under reducing conditions (O2 < 0.5) even with full Pb+V+Cl', () => {
    // Pre-v193 this fired: vanadinite was the one Pb-vanadate with no
    // redox gate, so it nucleated at O2 0.20 (the roughten_gill reducing
    // window, steps 30-70). V⁵⁺ isn't mobile in reducing fluid.
    const fluid = new FluidChemistry({ Pb: 60, V: 20, Cl: 20, O2: 0.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 40, fluid });
    expect(cond.supersaturation_vanadinite()).toBe(0);
  });

  it('fires under oxidizing conditions (O2 ≥ 0.5)', () => {
    const fluid = new FluidChemistry({ Pb: 60, V: 20, Cl: 20, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 40, fluid });
    expect(cond.supersaturation_vanadinite()).toBeGreaterThan(0);
  });
});

describe('v193 — descloizite-group V-economics (gate 10→4, v_f /20→/8)', () => {
  it('mottramite fires at modest V (was blocked below the old V≥10 gate)', () => {
    // V=6 (roughten_gill broth level) — under the OLD gate (V_min 10)
    // this returned 0; the group needed 5× vanadinite. Now σ > 0.
    const fluid = new FluidChemistry({ Pb: 90, Cu: 75, Zn: 50, V: 6, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 30, fluid });
    expect(cond.supersaturation_mottramite()).toBeGreaterThan(0);
  });

  it('descloizite fires at modest V too (same V-economics correction)', () => {
    const fluid = new FluidChemistry({ Pb: 90, Zn: 90, Cu: 5, V: 6, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 30, fluid });
    expect(cond.supersaturation_descloizite()).toBeGreaterThan(0);
  });

  it('the Cu/Zn cation fork still routes: Cu-dominant → mottramite, Zn-dominant → descloizite', () => {
    // The V-economics correction did NOT touch the distinctive routing.
    const cuRich = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 80, Zn: 10, V: 8, O2: 1.2, pH: 5.5 }) });
    expect(cuRich.supersaturation_mottramite()).toBeGreaterThan(0);
    expect(cuRich.supersaturation_descloizite()).toBe(0);  // Zn-fraction < 0.5

    const znRich = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 10, Zn: 80, V: 8, O2: 1.2, pH: 5.5 }) });
    expect(znRich.supersaturation_descloizite()).toBeGreaterThan(0);
    expect(znRich.supersaturation_mottramite()).toBe(0);   // Cu-fraction < 0.5
  });

  it('the redox gate applies to the descloizite group as well (reducing → 0)', () => {
    const reducing = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 75, Zn: 50, V: 14, O2: 0.2, pH: 5.5 }) });
    expect(reducing.supersaturation_mottramite()).toBe(0);
  });
});

describe('v193 — the descloizite-group vanadate reaches its type-abundance supergene locality (Boni 2007)', () => {
  it('appears in all three evidence seeds and remains alive/grown at final seed 42', () => {
    // Boni 2007: the descloizite-group V ores are abundant around oxidizing Cu(-Zn)-sulfide
    // bodies (Tsumeb-type). WHICH member forms is set by the fluid's Cu/Zn ratio (the fork
    // pinned above: Cu-dominant → mottramite, Zn-dominant → descloizite).
    //
    // rung-4b (SIM 231, the primary-sulfide ceiling): before, spurious sphalerite nucleated in
    // this oxidation zone and LOCKED Zn into ZnS, leaving the fluid Cu-dominant → mottramite.
    // The ceiling corrects that (fresh ZnS can't nucleate in an oxidizing fluid), so Zn stays
    // dissolved → the fluid is Zn-dominant → the fork now routes to DESCLOIZITE (the freed-Zn
    // heir — the same causal chain that grew smithsonite here). The scenario is legitimately
    // Zn-rich: smithsonite (ZnCO3) is one of its expects_species. So pin the GROUP reaching
    // supergene abundance, not the specific member the Cu/Zn budget happens to select.
    // (Measured post-4b: descloizite alive 4,4,2,3,3 across these seeds; mottramite 0.)
    // The aggregate science-evidence receipt authenticates this exact-bundle
    // three-seed fleet observation; engine/fork behavior remains live above.
    const frequency = requireEvidenceScenario(LOCALITY_FREQUENCY, 'supergene_oxidation');
    const occurrenceSeeds = new Set<number>([
      ...(frequency.occurrences?.mottramite?.seeds || []),
      ...(frequency.occurrences?.descloizite?.seeds || []),
    ]);
    expect([...occurrenceSeeds].sort((a, b) => a - b)).toEqual([1, 2, 42]);

    // First appearance alone cannot establish growth or persistence. The
    // independently authenticated seed-42 final-state summary must retain an
    // alive descloizite-group crystal with positive cumulative growth.
    const finalState = requireEvidenceScenario(SEED42_BASELINE, 'supergene_oxidation');
    const group = [finalState.mottramite, finalState.descloizite]
      .filter((row: any) => row && typeof row === 'object');
    expect(group.reduce((sum: number, row: any) => sum + Number(row.active || 0), 0))
      .toBeGreaterThan(0);
    expect(Math.max(...group.map((row: any) => Number(row.max_um || 0))))
      .toBeGreaterThan(0);
  });

  it('finishes alive and positively grown in at least 3/5 independent fleet seeds', { timeout: 3_600_000 }, () => {
    // This is intentionally a live final-state contract. The locality-frequency
    // receipt records first appearance and therefore cannot prove persistence.
    // Stop after the third independent witness, but exhaust the five-seed fleet
    // before failing so immediate-dissolution and seed-fragility regressions show.
    let witnesses = 0;
    for (const seed of [1, 2, 3, 7, 13]) {
      if (finalAliveGrownGroup(seed) > 0) witnesses++;
      if (witnesses >= 3) break;
    }
    expect(witnesses, `descloizite-group survived and grew in ${witnesses}/5 fleet seeds`)
      .toBeGreaterThanOrEqual(3);
  });
});
