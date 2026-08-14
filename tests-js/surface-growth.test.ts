import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const Crystal: any;
declare const MINERAL_SPEC: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const WallState: any;
declare const CavitySurfaceAnchors: any;
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

    expect(surfaceGrowthRegimeFor(catalogCrystal('romanechite', 'dendritic_surface_film')))
      .toBe('dendritic_film');
    expect(surfaceGrowthRegimeFor(catalogCrystal('todorokite', 'dendritic_mine_coating')))
      .toBe('dendritic_film');
    expect(surfaceGrowthRegimeFor(catalogCrystal('todorokite', 'radiating_fibrous_mat')))
      .toBe('fibrous_mat');
    expect(surfaceGrowthRegimeFor(catalogCrystal('birnessite', 'laminated_manganese_wall_lining')))
      .toBe('laminated_lining');
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

  it('uses the exact irregular WallMesh area in production descriptors', () => {
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 80,
      primary_bubbles: 5, secondary_bubbles: 9, shape_seed: 808,
    });
    const c = crystal('malachite', 'botryoidal', 'coating');
    c.wall_anchor = wall._anchorFromRingCell(6, 10);
    c._volume_mm3 = 21.75;
    const desc = surfaceGrowthDescriptor(c, wall);
    expect(desc.area_basis).toBe('exact WallMesh triangle area');
    expect(desc.cavity_area_mm2).toBeCloseTo(wall.meshFor().surfaceAreaMm2(), 9);
    expect(desc.covered_area_mm2 * desc.mean_thickness_um / 1000)
      .toBeCloseTo(c._volume_mm3, 12);
  });

  it('records chronological overlap as explicit surface stratigraphy', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 60 });
    const lining = crystal('chalcedony', 'banded_agate', 'coating', {
      crystal_id: 2, nucleation_step: 3,
    });
    const druse = crystal('quartz', 'rock_crystal_druse', 'coating', {
      crystal_id: 9, nucleation_step: 12,
    });
    lining.wall_anchor = wall._anchorFromRingCell(6, 12);
    druse.wall_anchor = wall._anchorFromRingCell(6, 14);
    const sim = { step: 20, wall_state: wall, crystals: [druse, lining] };
    classifySurfaceGrowth(sim);
    expect(lining._surfaceGrowth.stratigraphic_index).toBe(0);
    expect(lining._surfaceGrowth.underlying_surface_crystal_ids).toEqual([]);
    expect(druse._surfaceGrowth.stratigraphic_index).toBe(1);
    expect(druse._surfaceGrowth.underlying_surface_crystal_ids).toContain(2);
    expect(druse._surfaceGrowth.stratigraphy_basis).toBe('exact shared authenticated-surface triangles');
  });

  it('cannot poison cached patch membership to alter surface stratigraphy', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 60 });
    const lining = crystal('chalcedony', 'banded_agate', 'coating', {
      crystal_id: 102, nucleation_step: 3,
    });
    const druse = crystal('quartz', 'rock_crystal_druse', 'coating', {
      crystal_id: 109, nucleation_step: 12,
    });
    lining.wall_anchor = wall._anchorFromRingCell(6, 12);
    druse.wall_anchor = wall._anchorFromRingCell(6, 14);
    const sim = { step: 20, wall_state: wall, crystals: [druse, lining] };
    classifySurfaceGrowth(sim);
    const patch = wall.surfacePatchForCrystal(
      lining, lining._surfaceGrowth.coverage_fraction, sim,
    );
    const before = druse._surfaceGrowth.underlying_surface_crystal_ids.slice();
    expect(patch.triangle_bitset).toBeUndefined();
    expect(Object.isFrozen(patch.triangle_indices)).toBe(true);
    expect(() => { patch.triangle_indices[0] = Number.MAX_SAFE_INTEGER; }).toThrow();
    expect(() => { patch.triangles[0].triangle_index = Number.MAX_SAFE_INTEGER; }).toThrow();
    expect(() => { patch.triangles[0].neighbor_indices.length = 0; }).toThrow();
    classifySurfaceGrowth(sim);
    expect(druse._surfaceGrowth.underlying_surface_crystal_ids).toEqual(before);
    expect(before).toContain(102);
  });

  it('normalizes coincident WallMesh and MC layers onto one live surface for stratigraphy', () => {
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 60, shape_seed: 42,
    });
    const wallLayer = crystal('chalcedony', 'banded_agate', 'coating', {
      crystal_id: 21, nucleation_step: 2,
    });
    const fieldLayer = crystal('quartz', 'rock_crystal_druse', 'coating', {
      crystal_id: 22, nucleation_step: 3,
    });
    wallLayer.wall_anchor = wall._anchorFromRingCell(6, 12);
    fieldLayer.wall_anchor = wall.remapSurfaceAnchorToMarchingCubes(
      wallLayer.wall_anchor, { resolution: 20 },
    );
    wall.activateCavitySurfaceAnchorProvider({ resolution: 20 });
    const sim = { step: 5, wall_state: wall, crystals: [wallLayer, fieldLayer] };
    classifySurfaceGrowth(sim);

    const firstPatch = wall.surfacePatchForCrystal(
      wallLayer, wallLayer._surfaceGrowth.coverage_fraction, sim,
    );
    const secondPatch = wall.surfacePatchForCrystal(
      fieldLayer, fieldLayer._surfaceGrowth.coverage_fraction, sim,
    );
    expect(firstPatch.source_signature).toBe(secondPatch.source_signature);
    expect(fieldLayer._surfaceGrowth.underlying_surface_crystal_ids).toContain(21);
  });

  it('does not claim overlap when spherical caps touch but exact wall patches do not', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 60 });
    const earlier = crystal('chalcedony', 'banded_agate', 'coating', {
      crystal_id: 31, nucleation_step: 2, wall_spread: 0.02,
    });
    const later = crystal('quartz', 'rock_crystal_druse', 'coating', {
      crystal_id: 32, nucleation_step: 3, wall_spread: 0.02,
    });
    // Positive but vanishingly immature growth keeps the descriptor active
    // while its bounded coverage remains at the 2% physical minimum.
    earlier.total_growth_um = 0.0001;
    later.total_growth_um = 0.0001;
    earlier.wall_anchor = wall._anchorFromRingCell(0, 0);
    later.wall_anchor = wall._anchorFromRingCell(11, 24);
    const sim = { step: 5, wall_state: wall, crystals: [earlier, later] };
    classifySurfaceGrowth(sim);

    const firstPatch = wall.surfacePatchForCrystal(
      earlier, earlier._surfaceGrowth.coverage_fraction, sim,
    );
    const secondPatch = wall.surfacePatchForCrystal(
      later, later._surfaceGrowth.coverage_fraction, sim,
    );
    const firstTriangles = new Set(firstPatch.triangles.map((t: any) => t.triangle_index));
    expect(secondPatch.triangles.some((t: any) => firstTriangles.has(t.triangle_index))).toBe(false);
    expect(later._surfaceGrowth.underlying_surface_crystal_ids).toEqual([]);
    expect(later._surfaceGrowth.stratigraphy_basis).toBe('exact shared authenticated-surface triangles');
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
    expect(body).toContain('sampleSurfacePatch');
    expect(body).toContain("record.regime === 'dendritic_film'");
    expect(body).toContain('_getDendriteTreeGeom');
    expect(body).toContain('basis.makeBasis(lateral, axis, normal)');
    expect(body).not.toContain('swath.raycast = function');
    expect(body).not.toContain('sim.crystals.push');

    const syncStart = source.indexOf('function _topoSyncCrystalMeshes(');
    const syncEnd = source.indexOf('\nfunction ', syncStart + 1);
    const syncBody = source.slice(syncStart, syncEnd);
    expect(syncBody).toContain('_addCrystalParentRepresentation(state, crystal, mesh)');
  });
});
