// tests-js/tormiq-alpine-cleft.test.ts — Tormiq Valley alpine-cleft epidote (v197).
//
// The anchor scenario for epidote (v196): an amphibolite-hosted Himalayan
// alpine cleft (Gilgit-Baltistan, Pakistan) with an oxidized, low-salinity
// metamorphic fluid. Epidote is the STAR; byssolite (actinolite), adularia
// (feldspar), albite, quartz and pink fluorite are the alpine-cleft suite.
// These pins lock the scenario registration + the epidote-led assemblage.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function run(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

// Lazy memo — runs at first it() execution, NOT at collection time (when the
// bundle globals aren't ready yet).
let _counts: Record<string, number> | null = null;
function counts42(): Record<string, number> {
  if (_counts) return _counts;
  const sim = run('tormiq_alpine_cleft', 42);
  const m: Record<string, number> = {};
  if (sim) for (const c of sim.crystals) m[c.mineral] = (m[c.mineral] || 0) + 1;
  _counts = m;
  return m;
}

describe('Tormiq alpine-cleft epidote scenario (v197)', () => {
  it('scenario is registered', () => {
    expect(SCENARIOS.tormiq_alpine_cleft).toBeTypeOf('function');
  });

  it('the broth is oxidized and low-salinity (the Fe3+ + no-halite controls)', () => {
    const { conditions } = SCENARIOS.tormiq_alpine_cleft();
    expect(conditions.fluid.O2).toBeGreaterThanOrEqual(0.5);   // oxidizing → Fe3+
    expect(conditions.fluid.Na).toBeLessThan(500);             // low salinity → no halite
  });

  it('epidote fires', () => {
    expect(counts42().epidote || 0).toBeGreaterThan(0);
  });

  it('epidote is the STAR (most-abundant species)', () => {
    const sorted = Object.entries(counts42()).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('epidote');
  });

  it('byssolite (actinolite) is present but secondary to epidote', () => {
    const c = counts42();
    expect(c.actinolite || 0).toBeGreaterThan(0);
    expect(c.actinolite || 0).toBeLessThanOrEqual(c.epidote || 0);
  });

  it('the cleft suite fires: quartz lining + adularia (feldspar)', () => {
    const c = counts42();
    expect(c.quartz || 0).toBeGreaterThan(0);
    expect(c.feldspar || 0).toBeGreaterThan(0);
  });

  it('NO halite — the low-salinity control holds', () => {
    expect(counts42().halite || 0).toBe(0);
  });

  it('every expects_species fires at seed 42 (no aspirational inflation)', () => {
    const c = counts42();
    for (const m of ['epidote', 'actinolite', 'quartz', 'feldspar', 'albite', 'fluorite']) {
      expect(c[m] || 0, `${m} should fire`).toBeGreaterThan(0);
    }
  });
});
