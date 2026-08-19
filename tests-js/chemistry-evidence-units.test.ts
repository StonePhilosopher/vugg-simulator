import { describe, expect, it } from 'vitest';

declare const StripRecorder: any;
declare const SIM_VERSION: number;

describe('chemistry evidence concentration units', () => {
  it('publishes FluidChemistry mass-basis units instead of false mg/L labels', () => {
    const wall = { ring_count: 1, cells_per_ring: 1 };
    const sim = {
      SIM_VERSION,
      _seed: 42,
      crystals: [],
      conditions: {
        wall,
        _scenario: { id: 'unit-receipt', duration_steps: 1 },
      },
    };
    const chips = new StripRecorder(sim, { angular_indices: 1, duration_steps: 1 })
      .getManifest().chips;
    const byId = new Map(chips.map((chip: any) => [chip.id, chip]));

    expect(byId.get('O2')?.units).toBe('ppm (mg/kg solvent)');
    for (const id of ['DIC', 'CO2aq', 'HCO3', 'CO3_2']) {
      expect(byId.get(id)?.units).toBe('ppm as CO₃ eq. (mg/kg solvent)');
    }
    expect(chips.some((chip: any) => chip.units === 'mg/L')).toBe(false);
  });
});
