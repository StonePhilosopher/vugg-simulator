import { describe, expect, it } from 'vitest';

declare function waterActivityAssessment(fluid: any, temperatureC?: number): any;
declare function sulfateSaturationIndex(mineral: string, fluid: any, temperatureC: number): number;

describe('gypsum water-activity correction', () => {
  it('pins the NaCl-equivalent primary-data interpolation and disclosed limits', () => {
    expect(waterActivityAssessment({ salinity: 0 }, 25)).toMatchObject({
      value: 1,
      status: 'calibrated-proxy',
    });
    expect(waterActivityAssessment({ salinity: 35 }, 25).value).toBeCloseTo(0.980, 12);
    expect(waterActivityAssessment({ salinity: 260 }, 25).value).toBeCloseTo(0.759, 12);
    const bittern = waterActivityAssessment({ salinity: 300 }, 25);
    expect(bittern.value).toBeCloseTo(0.703, 12);
    expect(bittern.status).toBe('composition-extrapolation');
    expect(bittern.uncertainty).toBeGreaterThan(0.01);
    expect(waterActivityAssessment({ salinity: 35 }, 150).status).toBe('temperature-extrapolation');
  });

  it('includes two waters in gypsum log-IAP but not anhydrite', () => {
    const base = { Ca: 1000, S: 1000, salinity: 0 };
    const brine = { ...base, salinity: 260 };
    const gypsumShift = sulfateSaturationIndex('selenite', brine, 25)
      - sulfateSaturationIndex('selenite', base, 25);
    expect(gypsumShift).toBeCloseTo(2 * Math.log10(0.759), 12);

    const anhydriteShift = sulfateSaturationIndex('anhydrite', brine, 25)
      - sulfateSaturationIndex('anhydrite', base, 25);
    expect(anhydriteShift).toBeCloseTo(0, 12);
  });
});
