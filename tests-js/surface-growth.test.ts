import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const Crystal: any;
declare const MINERAL_SPEC: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const surfaceGrowthRegimeFor: any;
declare const surfaceGrowthDescriptor: any;
declare const classifySurfaceGrowth: any;
declare const _surfaceGrowthInstanceCount: any;
declare const _surfaceGrowthSampleDirections: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function crystal(mineral: string, habit: string, vector = 'projecting', extra: any = {}) {
  const c = new Crystal({
    mineral, habit, vector, wall_spread: 0.85, void_reach: 0.15,
    crystal_id: 100, ...extra,
  });
  c.total_growth_um = 500;
  c._volume_mm3 = 12.5;
  return c;
}

function catalogCrystal(mineral: string, habitName: string) {
  const variant = MINERAL_SPEC[mineral].habit_variants.find((row: any) => row.name === habitName);
  expect(variant, `${mineral}.${habitName} must be a production catalog habit`).toBeTruthy();
  return crystal(mineral, variant.name, variant.vector, variant);
}

function runScenario(name: string, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < defaultSteps; i++) sim.run_step();
  return sim;
}

describe('SIM 246 area-covering surface-growth fabrics', () => {
  it('classifies the physical fabric rather than treating every aggregate as one trophy crystal', () => {
    expect(surfaceGrowthRegimeFor(crystal('chalcedony', 'length_fast_microfibrous')))
      .toBe('laminated_lining');
    expect(surfaceGrowthRegimeFor(crystal('chalcedony', 'banded_agate')))
      .toBe('laminated_lining');

    expect(surfaceGrowthRegimeFor(crystal('hematite', 'earthy_red_ochre')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(crystal('malachite', 'banded')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(crystal('azurite', 'crystalline_crust', 'coating')))
      .toBe('botryoidal_crust');

    expect(surfaceGrowthRegimeFor(crystal('quartz', 'rock_crystal_druse', 'coating')))
      .toBe('euhedral_druse');
    expect(surfaceGrowthRegimeFor(catalogCrystal('calcite', 'druzy_crust')))
      .toBe('euhedral_druse');
    expect(surfaceGrowthRegimeFor(catalogCrystal('calcite', 'botryoidal')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(catalogCrystal('calcite', 'travertine_crust')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(crystal('quartz', 'prismatic', 'projecting')))
      .toBeNull();
    expect(surfaceGrowthRegimeFor(crystal('calcite', 'scalenohedral', 'projecting')))
      .toBeNull();

    expect(surfaceGrowthRegimeFor(crystal('chrysotile', 'massive_fibrous')))
      .toBe('fibrous_mat');
    expect(surfaceGrowthRegimeFor(crystal('tremolite', 'prismatic')))
      .toBeNull();
  });

  it('does not turn an unspecified Mn oxide or every massive aggregate into black wall paint', () => {
    expect(surfaceGrowthRegimeFor(crystal('pyrolusite', 'massive_sooty')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(crystal('pyrolusite', 'botryoidal_reniform')))
      .toBe('botryoidal_crust');
    expect(surfaceGrowthRegimeFor(crystal('pyrolusite', 'radiating_fibrous', 'coating')))
      .toBeNull();
    expect(surfaceGrowthRegimeFor(crystal('magnetite', 'massive_granular')))
      .toBeNull();
  });

  it('derives physical mean thickness from exactly the accepted aggregate volume', () => {
    const c = crystal('malachite', 'botryoidal', 'coating');
    c.total_growth_um = 800;
    c._volume_mm3 = 17.25;
    const desc = surfaceGrowthDescriptor(c, { meanDiameterMm: () => 50 });
    expect(desc.coverage_fraction).toBeGreaterThan(0.7);
    expect(desc.mass_basis).toContain('_volume_mm3');
    expect(desc.covered_area_mm2 * desc.mean_thickness_um / 1000)
      .toBeCloseTo(c._volume_mm3, 12);
  });

  it('refreshes eligible records and removes stale records without changing the mass ledger', () => {
    const eligible = crystal('quartz', 'rock_crystal_druse', 'coating');
    const ineligible = crystal('quartz', 'prismatic', 'projecting');
    ineligible._surfaceGrowth = { regime: 'stale' };
    const before = eligible._volume_mm3 + ineligible._volume_mm3;
    const sim = {
      step: 19,
      wall_state: { meanDiameterMm: () => 40 },
      crystals: [eligible, ineligible],
    };
    classifySurfaceGrowth(sim);
    expect(eligible._surfaceGrowth).toMatchObject({
      regime: 'euhedral_druse', at_step: 19, booked_volume_mm3: 12.5,
    });
    expect(ineligible._surfaceGrowth).toBeUndefined();
    expect(eligible._volume_mm3 + ineligible._volume_mm3).toBe(before);
  });

  it('uses deterministic equal-area sampling and a strict mobile LOD cap', () => {
    const mobile = _surfaceGrowthInstanceCount(1, true);
    const desktop = _surfaceGrowthInstanceCount(1, false);
    expect(mobile).toBe(56);
    expect(desktop).toBe(128);
    expect(desktop).toBeGreaterThan(mobile);

    const a = _surfaceGrowthSampleDirections([0, 1, 0], mobile, 0.8, 42);
    const b = _surfaceGrowthSampleDirections([0, 1, 0], mobile, 0.8, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(mobile);
    for (const [x, y, z] of a) {
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 12);
      // A coverage of 0.8 is a cap ending at dot(center, point) = -0.6.
      expect(y).toBeGreaterThan(-0.6);
    }
    expect(Math.min(...a.map((p: number[]) => p[1]))).toBeLessThan(-0.5);
  });

  it('offers authored rock-crystal druse and azurite-crust nucleation variants', () => {
    expect(MINERAL_SPEC.quartz.habit_variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'rock_crystal_druse', vector: 'coating' }),
    ]));
    expect(MINERAL_SPEC.azurite.habit_variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'crystalline_crust', vector: 'coating' }),
    ]));
  });

  it('turns the Deccan Stage-I claim into a persisted, mass-closing chalcedony lining', () => {
    const sim = runScenario('deccan_zeolite', 42);
    const linings = sim.crystals.filter((c: any) =>
      c.mineral === 'chalcedony' && c.total_growth_um > 0 && !c.dissolved,
    );
    expect(linings.length).toBeGreaterThan(0);
    expect(linings.every((c: any) => c._surfaceGrowth?.regime === 'laminated_lining'))
      .toBe(true);
    for (const c of linings) {
      const s = c._surfaceGrowth;
      expect(s.covered_area_mm2 * s.mean_thickness_um / 1000)
        .toBeCloseTo(c._volume_mm3, 10);
    }
  });

  it('renders representative instances in one draw call without inventing sim crystals', () => {
    const source = fs.readFileSync(path.join(ROOT, 'js/99i-renderer-three.ts'), 'utf8');
    const start = source.indexOf('function _emitSurfaceGrowthSwath(');
    const end = source.indexOf('\nfunction ', start + 1);
    const body = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(body).toContain('new THREE.InstancedMesh');
    expect(body).toContain('representative_only: true');
    expect(body).not.toContain('sim.crystals.push');
  });
});
