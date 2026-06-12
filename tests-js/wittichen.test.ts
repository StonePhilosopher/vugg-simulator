// tests-js/wittichen.test.ts — wittichen five-element vein (v189).
//
// The morphology registry's dendrite-band tenant + the skutterudite/
// safflorite de-orphaning scenario. Science: RESEARCH-bismuth-
// morphology-2026-06-12.md §4; judge: tools/wittichen-dendrite-observe
// (8/8 seeds at ship time). The contracts pinned here are the seed-42
// claims-table slice of the judge's contract + the movement shape +
// the aspirational-expects honesty.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_REGIMES: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 160;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

describe('wittichen five-element vein (v189)', () => {

  let _sim: any = null;
  const sim = () => (_sim ||= runScenario('wittichen'));
  const alive = (m: string) => sim().crystals.filter((c: any) => c.mineral === m && !c.dissolved && c.total_growth_um > 0);

  it('is registered with the declared movements (T trend + the Eh shock pulse)', () => {
    expect(SCENARIOS.wittichen).toBeTruthy();
    const spec = (SCENARIOS.wittichen as any)._json5_spec || {};
    const movements = spec.movements;
    // shape contract: one temperature movement + one fluid.Eh movement
    // whose ops include a deep negative pulse (the CH4 influx)
    const fields = (movements || []).map((m: any) => m.field);
    expect(fields).toContain('temperature');
    expect(fields).toContain('fluid.Eh');
    const eh = (movements || []).find((m: any) => m.field === 'fluid.Eh');
    const pulse = (eh.ops || []).find((o: any) => o.kind === 'pulse' && o.amp < -200);
    expect(pulse).toBeTruthy();
  });

  it('THE HEADLINE: native bismuth survives carrying dendritic zone mass ≥25%', () => {
    const bi = alive('native_bismuth');
    expect(bi.length).toBeGreaterThanOrEqual(2);
    let d = 0, tot = 0;
    for (const c of bi) for (const z of c.zones || []) {
      if (z.thickness_um > 0 && z.morph_regime) { tot += z.thickness_um; if (z.morph_regime === 'dendritic') d += z.thickness_um; }
    }
    expect(tot).toBeGreaterThan(0);
    expect(d / tot).toBeGreaterThanOrEqual(0.25);
  });

  it('the de-orphaned arsenide suite is ALIVE (first scenario home fleet-wide)', () => {
    expect(alive('skutterudite').length).toBeGreaterThanOrEqual(1);
    expect(alive('safflorite').length).toBeGreaterThanOrEqual(1);
    expect(alive('nickeline').length).toBeGreaterThanOrEqual(1);
    expect(alive('native_arsenic').length).toBeGreaterThanOrEqual(1);
  });

  it('the silver tarnish story: native silver grows, then sulfidizes to acanthite', () => {
    // native_silver crystals exist in the record (grew on the shock)…
    const agAll = sim().crystals.filter((c: any) => c.mineral === 'native_silver' && c.total_growth_um > 0);
    expect(agAll.length).toBeGreaterThanOrEqual(1);
    // …and the meteoric-sulfate stage converted the standing crop
    expect(alive('acanthite').length).toBeGreaterThanOrEqual(1);
  });

  it('carbonate gangue seals the vein (the cross-section specimen)', () => {
    expect(alive('calcite').length + alive('aragonite').length).toBeGreaterThanOrEqual(1);
  });

  it('the Bi zone stack reads feathery → dendrite → quieter (the shock is an EPISODE, not the whole life)', () => {
    const bi = alive('native_bismuth');
    const mass: Record<string, number> = {};
    for (const c of bi) for (const z of c.zones || []) {
      if (z.thickness_um > 0 && z.morph_regime) mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
    }
    // multiple bands present — the crystal records a TRAJECTORY
    const present = MORPH_REGIMES.filter((r: string) => (mass[r] || 0) > 0);
    expect(present.length).toBeGreaterThanOrEqual(3);
    expect(mass.dendritic).toBeGreaterThan(0);
    expect((mass.stepped_mild || 0) + (mass.stepped_macro || 0)).toBeGreaterThan(0);
  });

  it('NO spurious halite (a vein never evaporates — the first-observation catch)', () => {
    expect(alive('halite').length).toBe(0);
  });

  it('aspirational expects documented: barite + erythrite declared but not firing at seed 42 (v107 honesty)', () => {
    // _json5_spec is attached to the scenario CALLABLE, not its return
    // value (js/70-events.ts scenario loader convention).
    const spec = (SCENARIOS.wittichen as any)._json5_spec || {};
    const expects = spec.expects_species || [];
    expect(expects).toContain('barite');
    expect(expects).toContain('erythrite');
    expect(alive('barite').length).toBe(0);   // re-pin when the tune lands
    expect(alive('erythrite').length).toBe(0);
  });
});
