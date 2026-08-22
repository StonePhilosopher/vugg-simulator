import { describe, expect, it } from 'vitest';

declare const MINERAL_SPEC: any;
declare const crystalSizeAuthority: (crystal: any) => any;
declare const crystalAtAuthoredSizeCap: (crystal: any) => boolean;
declare const classifyCelestineHabit: (conditions: any, sigma: number) => any;

function crystal(mineral: string, habit: string, extentCm: number, extent_kind?: string) {
  return { mineral, habit, extent_kind, total_growth_um: extentCm * 10000 };
}

describe('individual crystal versus aggregate extent authority', () => {
  it('raises celestine from the stale 30 cm cap to twice the documented 46 cm authority', () => {
    expect(MINERAL_SPEC.celestine.size_authority.individual_record_cm).toBe(46);
    const c = crystal('celestine', 'bladed', 92);
    expect(crystalSizeAuthority(c)).toMatchObject({
      extent_kind: 'individual', record_cm: 46, cap_cm: 92,
    });
    expect(crystalAtAuthoredSizeCap(c)).toBe(true);
  });

  it('does not apply an individual-crystal cap to capacity-bound coatings and masses', () => {
    for (const c of [
      crystal('malachite', 'botryoidal', 500),
      crystal('smithsonite', 'botryoidal/stalactitic', 500),
      crystal('selenite', 'rosette', 5000),
      crystal('celestine', 'fibrous_blanket', 500),
    ]) {
      expect(crystalSizeAuthority(c).extent_kind).toBe('aggregate');
      expect(crystalSizeAuthority(c).cap_cm).toBeNull();
      expect(crystalAtAuthoredSizeCap(c)).toBe(false);
    }
  });

  it('keeps individual smithsonite and selenite records separate from their aggregate habits', () => {
    expect(crystalSizeAuthority(crystal('smithsonite', 'rhombohedral', 20)))
      .toMatchObject({ extent_kind: 'individual', record_cm: 10, cap_cm: 20 });
    expect(crystalSizeAuthority(crystal('selenite', 'prismatic', 2400)))
      .toMatchObject({ extent_kind: 'individual', record_cm: 1200, cap_cm: 2400 });
  });

  it('labels the unresolved 60 cm wulfenite report as aggregate, not individual authority', () => {
    const individual = crystalSizeAuthority(crystal('wulfenite', 'tabular', 22));
    const intergrowth = crystalSizeAuthority(crystal('wulfenite', 'intergrown_thin_plates', 120));
    expect(individual).toMatchObject({ extent_kind: 'individual', record_cm: 11, cap_cm: 22 });
    expect(intergrowth).toMatchObject({ extent_kind: 'aggregate', record_cm: 60, cap_cm: 120 });
  });

  it('uses the production celestine precedence in census-visible classification', () => {
    const conditions = {
      fluid: { S: 400, Sr: 10, Ba: 10, Mn: 0 },
      wall: { composition: 'limestone' },
    };
    expect(classifyCelestineHabit(conditions, 3)).toMatchObject({
      habit: 'fibrous_blanket', extent_kind: 'aggregate',
    });
    conditions.wall.composition = 'basalt';
    expect(classifyCelestineHabit(conditions, 3)).toMatchObject({
      habit: 'nodular', extent_kind: 'aggregate',
    });
  });
});
