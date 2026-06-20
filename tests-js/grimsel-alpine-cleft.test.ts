// tests-js/grimsel-alpine-cleft.test.ts — Grimsel/Aar Swiss alpine cleft (v206).
//
// The granite-hosted Zerrkluft counterpart to the amphibolite tormiq cleft —
// the content home of the quartz-morphology arc. A declared retrograde T
// movement (450→200 °C) + a crack-seal SiO2 sawtooth grow the iconic Grimsel
// specimen: SMOKY, Tessin-habit SCEPTRE quartz, with the full alpine suite
// (feldspar/albite, titanite, hematite iron-roses, fluorite, apatite, calcite).
//
// These pins lock the scenario registration, the dilute-felsic broth controls
// (so adularia/albite stay MINOR and never enclose the quartz), the assemblage,
// and the three honest quartz variants: sceptre (structural), smoky/morion
// (colour), Tessin (face form).

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

let _sim: any = null;
function sim42(): any { if (!_sim) _sim = run('grimsel_alpine_cleft', 42); return _sim; }
function counts42(): Record<string, number> {
  const m: Record<string, number> = {};
  const sim = sim42();
  if (sim) for (const c of sim.crystals) m[c.mineral] = (m[c.mineral] || 0) + 1;
  return m;
}
function quartz42(): any[] {
  const sim = sim42();
  return sim ? sim.crystals.filter((c: any) => c.mineral === 'quartz') : [];
}

describe('Grimsel alpine-cleft smoky sceptre quartz (v206)', () => {
  it('scenario is registered', () => {
    expect(SCENARIOS.grimsel_alpine_cleft).toBeTypeOf('function');
  });

  it('declares a retrograde temperature movement (the naica idiom), not random pulses', () => {
    const { conditions } = SCENARIOS.grimsel_alpine_cleft();
    expect(conditions.wall.thermal_pulses).toBe(false);            // designed cooling, not magmatic re-warm
    const { defaultSteps } = SCENARIOS.grimsel_alpine_cleft();
    expect(defaultSteps).toBeGreaterThanOrEqual(180);
  });

  it('the broth is DILUTE in K/Na/Al — adularia + albite stay the minor early coating', () => {
    const { conditions } = SCENARIOS.grimsel_alpine_cleft();
    expect(conditions.fluid.K).toBeLessThan(60);    // the prior K=120 grew an 18mm feldspar that enclosed quartz
    expect(conditions.fluid.Na).toBeLessThan(60);   // the prior Na=80 grew a 7mm albite that enclosed quartz
    expect(conditions.fluid.O2).toBeGreaterThanOrEqual(0.5); // oxidizing → hematite, not pyrite (the Aar redox tell)
  });

  it('quartz is the volumetric main stage — larger than the feldspar/albite coating', () => {
    const qz = quartz42();
    expect(qz.length).toBeGreaterThan(0);
    const qzMax = Math.max(...qz.map((c) => c.total_growth_um || 0));
    const fsp = sim42().crystals.filter((c: any) => c.mineral === 'feldspar' || c.mineral === 'albite');
    const fspMax = fsp.length ? Math.max(...fsp.map((c: any) => c.total_growth_um || 0)) : 0;
    expect(qzMax).toBeGreaterThan(fspMax);   // the geologically right-way-up cleft
  });

  it('SCEPTRE: ≥1 quartz shows the resorption→renewal phantom boundary', () => {
    const sceptres = quartz42().filter((c) => c._sceptre);
    expect(sceptres.length).toBeGreaterThan(0);
    // a real sceptre has a substantial gen-1 stem AND gen-2 cap
    for (const c of sceptres) {
      expect(c._sceptre.stemUm).toBeGreaterThan(150);
      expect(c._sceptre.capUm).toBeGreaterThan(150);
      // habit reads scepter_overgrowth UNLESS this crystal is also the gwindel
      // showpiece, where the twist takes render precedence (habit='gwindel').
      if (!c._gwindel) expect(c.habit).toBe('scepter_overgrowth');
    }
  });

  it('GWINDEL: the largest cleft quartz is the twisted showpiece (the Grimsel type habit)', () => {
    const gwindels = quartz42().filter((c) => c._gwindel);
    expect(gwindels.length).toBe(1);                       // one showpiece, deterministic
    const g = gwindels[0];
    expect(g.habit).toBe('gwindel');                       // render precedence over sceptre
    expect(g._gwindel.twistDeg).toBeGreaterThanOrEqual(45);
    // the gwindel is the LARGEST quartz (the long-grown showpiece)
    const maxUm = Math.max(...quartz42().map((c) => c.total_growth_um || 0));
    expect(g.total_growth_um).toBe(maxUm);
  });

  it('SMOKY: ≥1 quartz develops colour centres from the radiogenic granite host', () => {
    const smoky = quartz42().filter((c) => (c.radiation_damage || 0) > 0.3);
    expect(smoky.length).toBeGreaterThan(0);
  });

  it('TESSIN: cleft quartz carries the steep-rhombohedron face development', () => {
    const tessin = quartz42().filter((c) => (c.dominant_forms || []).some((f: string) => f.includes('steep rhombohedron')));
    expect(tessin.length).toBeGreaterThan(0);
  });

  it('every expects_species fires at seed 42', () => {
    const c = counts42();
    for (const m of ['quartz', 'feldspar', 'titanite', 'hematite', 'fluorite', 'apatite', 'calcite']) {
      expect(c[m] || 0, `${m} should fire`).toBeGreaterThan(0);
    }
  });
});
