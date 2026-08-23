import { describe, expect, it } from 'vitest';
import { reduceEnclosureLifecycle } from '../tools/enclosure-evidence.mjs';

function enclosure(host: number, guest: number, step: number) {
  return {
    schema: 'enclosure-receipt-v1',
    event: 'enclosed',
    step,
    host_crystal_id: host,
    guest_crystal_id: guest,
    host_mineral: 'calcite',
    guest_mineral: 'pyrite',
    route: 'geometric-overlap',
  };
}

function liberation(host: number, guest: number, enclosureStep: number, step: number) {
  return {
    schema: 'liberation-receipt-v1',
    event: 'liberated',
    step,
    enclosure_step: enclosureStep,
    host_crystal_id: host,
    guest_crystal_id: guest,
    host_mineral: 'calcite',
    guest_mineral: 'pyrite',
  };
}

describe('claim-card enclosure lifecycle authentication', () => {
  it('rejects a second enclosure while the guest is already current', () => {
    expect(() => reduceEnclosureLifecycle([
      enclosure(1, 7, 10),
      enclosure(2, 7, 11),
    ])).toThrow(/Duplicate current enclosure receipt for guest 7/);
  });

  it('accepts deterministic re-enclosure only after matching liberation', () => {
    const second = enclosure(2, 7, 20);
    const result = reduceEnclosureLifecycle([
      enclosure(1, 7, 10),
      liberation(1, 7, 10, 15),
      second,
    ]);
    expect(result).toEqual({
      accepted_enclosure_count: 2,
      liberation_count: 1,
      current_inclusions: [second],
    });
  });

  it('rejects time-reversed re-enclosure and malformed or unknown rows', () => {
    expect(() => reduceEnclosureLifecycle([
      enclosure(1, 7, 10),
      liberation(1, 7, 10, 15),
      enclosure(2, 7, 10),
    ])).toThrow(/Non-chronological enclosure lifecycle/);
    expect(() => reduceEnclosureLifecycle([
      { schema: 'enclosure-receipt-v2', event: 'enclosed', step: 1 },
    ])).toThrow(/Unknown enclosure lifecycle row/);
    expect(() => reduceEnclosureLifecycle([
      { ...enclosure(1, 7, 10), step: Number.NaN },
    ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    expect(() => reduceEnclosureLifecycle([
      { ...enclosure(1, 7, 10), guest_crystal_id: Number.NaN },
    ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    for (const badId of ['1', '01', ' 1 ', true]) {
      expect(() => reduceEnclosureLifecycle([
        { ...enclosure(1, 7, 10), host_crystal_id: badId },
      ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    }
    expect(() => reduceEnclosureLifecycle([
      { ...enclosure(1, 7, 10), step: '10' },
    ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    expect(() => reduceEnclosureLifecycle([
      enclosure(1, 7, 10),
      { ...enclosure(2, 7, 11), guest_crystal_id: '07' },
    ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    for (const badRoute of [1, 'banana']) {
      expect(() => reduceEnclosureLifecycle([
        { ...enclosure(1, 7, 10), route: badRoute },
      ])).toThrow(/requires a route/);
    }
    for (const badMineral of [1, ['calcite'], '', ' calcite']) {
      expect(() => reduceEnclosureLifecycle([
        { ...enclosure(1, 7, 10), host_mineral: badMineral },
      ])).toThrow(/Malformed enclosure lifecycle identity\/step/);
    }
  });
});
