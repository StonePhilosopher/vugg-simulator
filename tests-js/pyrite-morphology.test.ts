// tests-js/pyrite-morphology.test.ts — pyrite morphology contracts
// (morphology-generalization arc, FIFTH tenant, 2026-06-12 —
// sim-neutral striation overlay; form stays T-driven).
//
// Striations on pyrite faces ARE bunched growth steps (Murowchick &
// Barnes 1987) — the regime ladder names the intensity. Contracts:
//   1. registry shape + survey band placement
//   2. the zoned fleet picture (continuous σ → mixed crystals)
//   3. the overlay composes with the T-form dispatch (striated_ keeps
//      the parent form; framboids untouched)
//   4. aspect firewall + chip (the new 'sulfide' legend group)

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
declare const _habitAspectRatio: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 120;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

function pyriteMass(sim: any) {
  const mass: Record<string, number> = {};
  let total = 0;
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'pyrite' || c.dissolved) continue;
    for (const z of c.zones || []) {
      if (!(z.thickness_um > 0) || !z.morph_regime) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
      total += z.thickness_um;
    }
  }
  return { mass, total };
}

describe('pyrite morphology registry (fifth tenant)', () => {

  it('Sunagawa-ordered bands on the survey distribution', () => {
    const th = MORPH_TH.pyrite;
    expect(th).toBeTruthy();
    expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
    expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
    expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    expect(th.SIZE_HALF_UM).toBe(Infinity);
    expect(morphRegime(th, 1.3)).toBe('spiral_smooth');    // sunnyside/elmwood euhedra
    expect(morphRegime(th, 2.0)).toBe('stepped_mild');     // fine striations
    expect(morphRegime(th, 3.0)).toBe('stepped_macro');    // vein/hot-spring coarse
    expect(morphRegime(th, 3.84)).toBe('hopper_skeletal'); // fleet max — skeletal sliver
  });

  it('sulphur_bank hot-spring pyrite is striation-dominant; sunnyside euhedra stay smooth', () => {
    const sb = pyriteMass(runScenario('sulphur_bank'));
    expect(sb.total).toBeGreaterThan(0);
    const striated = ((sb.mass.stepped_mild || 0) + (sb.mass.stepped_macro || 0) + (sb.mass.hopper_skeletal || 0)) / sb.total;
    expect(striated).toBeGreaterThanOrEqual(0.5);
    const sun = pyriteMass(runScenario('sunnyside_american_tunnel'));
    expect(sun.total).toBeGreaterThan(0);
    expect((sun.mass.spiral_smooth || 0) / sun.total).toBeCloseTo(1, 6);
  });

  it('mvt pyrite is ZONED (the continuous-σ signature — mixed smooth↔striated)', () => {
    const { mass, total } = pyriteMass(runScenario('mvt'));
    expect(total).toBeGreaterThan(0);
    expect((mass.spiral_smooth || 0) / total).toBeGreaterThanOrEqual(0.2);
    expect(((mass.stepped_mild || 0) + (mass.stepped_macro || 0)) / total).toBeGreaterThanOrEqual(0.2);
  });

  it('the overlay composes: striated_ habits keep parent forms; framboids untouched; sunnyside pyritohedra unrenamed', () => {
    const sim = runScenario('sunnyside_american_tunnel');
    for (const c of sim.crystals) {
      if (c.mineral !== 'pyrite' || c.dissolved || !(c.total_growth_um > 0)) continue;
      expect(['pyritohedral', 'cubo-pyritohedral', 'cubic', 'framboidal']).toContain(c.habit);
    }
    const sb = runScenario('sulphur_bank');
    const habits = new Set(sb.crystals.filter((c: any) => c.mineral === 'pyrite' && !c.dissolved && c.total_growth_um > 0).map((c: any) => c.habit));
    // at least one striated habit appears in the striation-dominant scenario
    const striatedSeen = [...habits].some((h: any) => String(h).startsWith('striated_'));
    expect(striatedSeen).toBe(true);
  });

  it('aspect firewall: striated forms carry the parent default 0.5', () => {
    for (const h of ['striated_cubic', 'striated_pyritohedral', 'striated_cubo_pyritohedral', 'cubic', 'pyritohedral']) {
      expect(_habitAspectRatio(h)).toBe(0.5);
    }
  });

  it('pyrite_morph chip opens the sulfide legend group; display speaks pyrite', () => {
    const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === 'pyrite_morph');
    expect(p).toBeTruthy();
    expect(p.system).toBe('sulfide');
    expect(morphDisplayLabel('pyrite', 'stepped_mild')).toBe('finely striated');
    expect(morphDisplayLabel('pyrite', 'spiral_smooth')).toBe('smooth euhedral (Navajún glass)');
  });
});
