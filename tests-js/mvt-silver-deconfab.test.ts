// tests-js/mvt-silver-deconfab.test.ts — v195 mvt silver de-confabulation
// (boss catch, 2026-06-12).
//
// Tri-State is diagnostically silver-POOR: the district produced lead and
// zinc only, and low-Ag galena is an MVT fingerprint (Ag-in-galena rides
// Sb/Bi substitution — a high-T vein phenomenon absent from a ~150°C
// basinal brine; Leach et al. 2010 USGS MVT model lists Ag as "generally
// absent in most deposits"). The mvt broth's Ag=5 was an UNCITED Apr-2026
// gap-fill fabrication that fed 8 phantom crystals (acanthite ×4 +
// native_silver ×4) into the canonical seed-42 record for ~190 versions.
//
// These are INVERTED pins (the marble-aragonite retirement pattern): they
// assert the ABSENCE the correction restored. If silver ever reappears at
// mvt, either someone re-added broth Ag (read the v195 history block
// first) or an engine started minting Ag from nothing — both are bugs.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

const SILVER_SPECIES = [
  'acanthite', 'argentite', 'native_silver', 'proustite', 'pyrargyrite',
  'chlorargyrite', 'hessite', 'naumannite', 'sylvanite',
];

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 120;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

describe('mvt silver de-confabulation (v195)', () => {

  let _sim: any = null;
  const sim = () => (_sim ||= runScenario('mvt'));
  const of = (m: string) => sim().crystals.filter((c: any) => c.mineral === m);

  it('the broth carries NO silver — the Apr-2026 Ag=5 was uncited', () => {
    const { conditions } = SCENARIOS['mvt']();
    expect(conditions.fluid.Ag).toBe(0);
  });

  it('a full canonical run nucleates NO silver species (Tri-State produced Pb+Zn only)', () => {
    const silver = sim().crystals.filter((c: any) => SILVER_SPECIES.includes(c.mineral));
    expect(silver.length).toBe(0);
  });

  it('greenockite — the REAL Tri-State trace signature (Cd-in-sphalerite, Schwartz 2000) — still fires', () => {
    expect(of('greenockite').length).toBeGreaterThanOrEqual(1);
  });

  it('the diagnostic MVT assemblage survives the de-confabulation cascade', () => {
    // expects_species: the five the scenario promises. The 8 freed silver
    // slots re-roll mvt's RNG cascade; this pins that the re-roll never
    // costs the headline assemblage.
    for (const m of ['sphalerite', 'galena', 'fluorite', 'barite', 'calcite']) {
      expect(of(m).length, m).toBeGreaterThanOrEqual(1);
    }
  });
});
