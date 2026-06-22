// tests-js/sector-zoning.test.ts — sector (hourglass) zoning render-tag
// (crystal-face realism arc 2026-06-21). PROPOSALS-crystal-face-realism §1.
//
// Different growth sectors (crystal faces) incorporate trace elements at different
// rates → composition/colour partitions by growth SECTOR with a sharp boundary
// (Dowty 1976, Am.Min. 61:460-469; titanaugite hourglass Ferguson 1973, Min.Mag.
// 39:321). Tier A render-only abstraction: classifySectorZoning (js/45) tags the
// sector-zoned minerals (tourmaline first) so the renderer tints the termination
// sector apart from the prism body. PURE tagging (no rng/fluid) → SIM-neutral.
//
// These pin: tourmaline grows in gem_pegmatite and ≥1 gets _sectorZoned (kind
// hourglass); only the registered mineral is tagged; a scenario without a sector
// mineral carries no tags; the tag is inert (assemblage unchanged).

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

describe('sector (hourglass) zoning tag (tourmaline @ gem_pegmatite)', () => {
  it('tourmaline grows and at least one is tagged sector-zoned (hourglass)', () => {
    const sim = run('gem_pegmatite', 42);
    expect(sim).toBeTruthy();
    const tour = sim.crystals.filter((c: any) => c.mineral === 'tourmaline' && !c.dissolved);
    expect(tour.length).toBeGreaterThan(0);
    const zoned = tour.filter((c: any) => c._sectorZoned && c._sectorZoned.kind === 'hourglass');
    expect(zoned.length).toBeGreaterThan(0);
  });

  it('only the registered sector mineral is tagged — no other mineral carries it', () => {
    const sim = run('gem_pegmatite', 42);
    const taggedNonTour = sim.crystals.filter((c: any) => c.mineral !== 'tourmaline' && c._sectorZoned);
    expect(taggedNonTour.length).toBe(0);
  });

  it('a scenario with no sector-zoned mineral carries no tags (grimsel cleft)', () => {
    const sim = run('grimsel_alpine_cleft', 42);
    const tagged = sim.crystals.filter((c: any) => c._sectorZoned);
    expect(tagged.length).toBe(0);
  });

  it('the tag is inert — gem_pegmatite still grows its assemblage', () => {
    const sim = run('gem_pegmatite', 42);
    const counts: Record<string, number> = {};
    for (const c of sim.crystals) if (!c.dissolved) counts[c.mineral] = (counts[c.mineral] || 0) + 1;
    expect(counts.tourmaline).toBeGreaterThan(0);
    expect(counts.quartz).toBeGreaterThan(0);
  });
});
