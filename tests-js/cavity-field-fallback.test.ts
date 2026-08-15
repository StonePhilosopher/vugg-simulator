import { describe, expect, it, vi } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const CavityWaterAppearance: any;
declare const CavityEvolutionLedger: any;
declare const _topoCavityFieldCrossSectionReceipt: any;
declare const _topoRenderCavityFieldCrossSection: any;

function activeFixture() {
  setSeed(42);
  const { conditions, events } = SCENARIOS.amethyst_geode();
  const sim = new VugSimulator(conditions, events);
  sim.wall_state.activateCavitySurfaceAnchorProvider({ resolution: 20 });
  const active = sim.wall_state.activeCavitySurfaceAnchorProvider();
  const appearance = CavityWaterAppearance.create(
    sim.wall_state, sim.conditions, { sim, activeProvider: active },
  ).receipt;
  return { sim, active, appearance };
}

describe('capability-independent Cartesian cavity cross-section', () => {
  it('binds the CPU fallback to the exact field, surface, evolution, and water receipt', () => {
    const { sim, active, appearance } = activeFixture();
    const receipt = _topoCavityFieldCrossSectionReceipt(
      active, appearance, sim.wall_state, sim.conditions, sim,
    );
    expect(receipt.schema).toBe('cavity-field-cross-section-v1');
    expect(receipt.presentation).toContain('cpu-sampled-cross-section');
    expect(receipt.field_signature).toBe(active.field.sig);
    expect(receipt.field_snapshot_digest).toBe(active.field.snapshotDigest);
    expect(receipt.surface_signature).toBe(active.surface.sig);
    expect(receipt.surface_buffer_digest).toBe(active.surface.buffer_digest);
    expect(receipt.appearance_digest).toBe(appearance.appearance_digest);
    expect(receipt.appearance_source_geometry_digest)
      .toBe(active.receipt.surface_buffer_digest);
    expect(receipt.water_plane_y_mm).toBeNull();
    expect(receipt.crystal_policy).toMatch(/withheld/);
    const payload = CavityEvolutionLedger._clone(receipt);
    const digest = payload.receipt_digest;
    delete payload.receipt_digest;
    expect(digest).toBe(CavityEvolutionLedger.digest(payload));
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(() => _topoCavityFieldCrossSectionReceipt({
      ...active,
      receipt: { ...active.receipt, field_snapshot_digest: 'forged' },
    }, appearance, sim.wall_state, sim.conditions, sim))
      .toThrow(/exact current active provider/i);

    const other = activeFixture();
    expect(() => _topoCavityFieldCrossSectionReceipt(
      other.active, other.appearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/exact current active provider/i);

    const alteredReceipt = Object.freeze({
      ...active.receipt,
      cavity_evolution_signature: 'forged-evolution',
      production_contract_digest: 'forged-production-contract',
    });
    const alteredProvider = Object.freeze({
      field: active.field, surface: active.surface, receipt: alteredReceipt,
    });
    const alteredAppearance = CavityWaterAppearance.create(
      sim.wall_state, sim.conditions,
      { sim, activeProvider: alteredProvider, providerReceipt: alteredReceipt,
        surface: active.surface },
    ).receipt;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      alteredProvider, alteredAppearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/exact current active provider/i);

    const nonfinitePlane = CavityEvolutionLedger._clone(appearance);
    nonfinitePlane.water_plane_y_mm = Number.POSITIVE_INFINITY;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, nonfinitePlane, sim.wall_state, sim.conditions, sim,
    )).toThrow(/digest mismatch|non-finite/i);

    const forgedPlane = CavityEvolutionLedger._clone(appearance);
    forgedPlane.water_plane_y_mm = 1e12;
    delete forgedPlane.appearance_digest;
    forgedPlane.appearance_digest = CavityEvolutionLedger.digest(forgedPlane);
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, forgedPlane, sim.wall_state, sim.conditions, sim,
    )).toThrow(/appearance differs/i);

    const staleAppearance = appearance;
    sim.conditions.fluid_surface_height_mm = 5;
    expect(() => _topoCavityFieldCrossSectionReceipt(
      active, staleAppearance, sim.wall_state, sim.conditions, sim,
    )).toThrow(/appearance differs/i);

  });

  it('draws sampled field voxels and labels withheld crystals without WebGL', () => {
    const { sim, active, appearance } = activeFixture();
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const canvas: any = {};
    const ctx: any = {
      canvas,
      fillRect,
      fillText,
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
    };
    expect(_topoRenderCavityFieldCrossSection(
      ctx, 420, 300, active, appearance,
      sim.wall_state, sim.conditions, sim,
    )).toBe(true);
    expect(fillRect.mock.calls.length).toBeGreaterThan(
      active.field.sizeX * active.field.sizeY,
    );
    expect(fillText.mock.calls.some((call: any[]) => /Authenticated Cartesian/.test(call[0])))
      .toBe(true);
    expect(fillText.mock.calls.some((call: any[]) => /Crystals withheld/.test(call[0])))
      .toBe(true);
    expect(canvas._cavityFieldCrossSectionReceipt.field_snapshot_digest)
      .toBe(active.field.snapshotDigest);
  });
});
