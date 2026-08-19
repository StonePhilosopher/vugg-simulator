import { describe, expect, it } from 'vitest';

declare const _idlePieMineralLabel: (crystals: any[], slices: any[]) => string;
declare const _idlePieSolidVolumes: (crystals: any[]) => {
  mineralVolumes: Record<string, number>;
  totalCrystalVolume: number;
};

describe('idle pie inventory label', () => {
  it('reports real zero-volume nuclei instead of calling the vug empty', () => {
    const crystals = [
      { mineral: 'quartz', active: true, dissolved: false, c_length_mm: 0 },
      { mineral: 'quartz', active: true, dissolved: false, c_length_mm: 0 },
      { mineral: 'quartz', active: true, dissolved: false, c_length_mm: 0 },
    ];
    const slices = [
      { label: 'quartz', pct: 0 },
      { label: 'open', pct: 100 },
    ];

    expect(_idlePieMineralLabel(crystals, slices)).toBe('3 quartz microcrystals');
  });

  it('keeps useful volume percentages and appends unsized active species', () => {
    const crystals = [
      { mineral: 'calcite', active: true, dissolved: false },
      { mineral: 'fluorite', active: true, dissolved: false },
    ];
    const slices = [
      { label: 'calcite', pct: 12.345 },
      { label: 'fluorite', pct: 0 },
      { label: 'open', pct: 87.655 },
    ];

    expect(_idlePieMineralLabel(crystals, slices))
      .toBe('calcite 12.3% · fluorite microcrystal');
  });

  it('keeps capped or buried solids while excluding fully dissolved crystals', () => {
    const crystals = [
      { mineral: 'quartz', active: false, dissolved: false, _volume_mm3: 2 },
      { mineral: 'calcite', active: true, dissolved: true, _volume_mm3: 9 },
    ];

    expect(_idlePieMineralLabel(crystals, [])).toBe('quartz microcrystal');
    expect(_idlePieSolidVolumes(crystals)).toEqual({
      mineralVolumes: { quartz: 2 },
      totalCrystalVolume: 2,
    });
  });
});
