import { describe, expect, it } from 'vitest';

declare const findPseudomorphRoute: (parent: string, child: string) => any;
declare const cdrReplacementEvidence: (host: any, route: any, child: string) => any;

describe('CDR outline inheritance requires accepted matching parent loss', () => {
  const route = () => findPseudomorphRoute('azurite', 'malachite');
  const host = (zones: any[]) => ({
    mineral: 'azurite', crystal_id: 17, zones,
  });

  it('rejects proximity, a dissolved flag, and positive growth without parent loss', () => {
    expect(cdrReplacementEvidence(host([]), route(), 'malachite')).toBeNull();
    expect(cdrReplacementEvidence({ ...host([]), dissolved: true }, route(), 'malachite')).toBeNull();
    expect(cdrReplacementEvidence(host([
      { step: 2, thickness_um: 10, dissolutionMode: 'low_co3' },
    ]), route(), 'malachite')).toBeNull();
  });

  it('rejects actual loss through the wrong chemical trigger', () => {
    expect(cdrReplacementEvidence(host([
      { step: 3, thickness_um: -4, dissolutionMode: 'acid' },
    ]), route(), 'malachite')).toBeNull();
  });

  it('issues immutable evidence for exact accepted loss and matching route', () => {
    const evidence = cdrReplacementEvidence(host([
      { step: 3, thickness_um: -4, dissolutionMode: 'low_co3' },
      { step: 4, thickness_um: -2.5, dissolutionMode: 'low_co3' },
      { step: 5, thickness_um: -9, dissolutionMode: 'acid' },
    ]), route(), 'malachite');
    expect(evidence).toMatchObject({
      schema: 'cdr-replacement-evidence-v1',
      parent_crystal_id: 17,
      parent_mineral: 'azurite',
      child_mineral: 'malachite',
      route_trigger: 'low_co3',
      parent_loss_um: 6.5,
      matching_zone_count: 2,
      matching_zone_steps: [3, 4],
      shape_preserved: true,
    });
    expect(Object.isFrozen(evidence)).toBe(true);
  });
});
