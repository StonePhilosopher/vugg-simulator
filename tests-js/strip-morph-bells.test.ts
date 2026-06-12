// tests-js/strip-morph-bells.test.ts — THE DENDRITE BELL (js/85i,
// fix-backlog 2026-06-12). The morph chips record regime ordinals
// (0 smooth … 4 dendritic); buildStripMorphSlamHits rings an anvil
// strike on each UPWARD crossing. jsdom is deaf — these pin the pure
// schedule builder; the sound itself needs the boss's ear, like all
// sonifier work.
//
// Contracts:
//   1. upward crossings ring, downward (healing) is silent
//   2. severity → register (deeper slam = lower strike) + the
//      dendrite arrival's dissonant +1-semitone partner
//   3. sparse-max read (morph chips anchor at points — the digest
//      lesson; an angle-average would read all-null)
//   4. only *_morph chips participate; tempo scales tSec
//   5. the real thing: a recorded wittichen strip carries the 0→4
//      bismuth slam — the dendrite toll fires from real data

import { describe, expect, it } from 'vitest';
import { recordScenario } from './strip-helpers';

declare const buildStripMorphSlamHits: any;
declare const stripSonifyGetMorphBells: any;
declare const stripSonifySetMorphBells: any;
declare const stripAllocateData: any;
declare const stripDataIndex: any;

// Synthetic dataset with one sparse morph chip (values only at angle 1,
// height 0 — everything else stays the 255 missing sentinel) plus one
// non-morph chip that rises monotonically (must NOT ring).
function makeMorphDataset(ordinals: number[]): any {
  const steps = ordinals.length;
  const axes = { steps, angular_indices: 2, height_positions: 2, depth_positions: 1 };
  const chips = [
    { id: 'test_morph', label: 'tst morph', system: 'native', range: [0, 4], units: '', color: 0xd8c8e8 },
    { id: 'other', label: 'Other', system: 'special', range: [0, 1], units: '', color: 0xff0000 },
  ];
  const data = stripAllocateData(axes, 2);
  for (let s = 0; s < steps; s++) {
    data[stripDataIndex(s, 1, 0, 0, axes, 2, 0)] = Math.round((ordinals[s] / 4) * 254);
    // the non-morph chip rises 0→1 everywhere
    const byte = Math.round((s / Math.max(1, steps - 1)) * 254);
    for (let a = 0; a < 2; a++) for (let h = 0; h < 2; h++) {
      data[stripDataIndex(s, a, h, 1, axes, 2, 0)] = byte;
    }
  }
  return {
    manifest: {
      format_version: 2, sim_version: 190, scenario_id: 'test', seed: 42,
      recorded_at: 0, duration_steps: steps, axes, chips,
    },
    chip_data: data,
    nucleation_events: [],
  };
}

describe('the dendrite bell — morph-ordinal slam schedule (pure)', () => {

  it('rings upward crossings only; severity sets register; the dendrite clang doubles', () => {
    // ordinals: 0 0 1 1 4 4 2 2 3 3 → slams at step2 (→1), step4 (→4
    // + partner), step8 (2→3). The 4→2 healing at step6 is SILENT.
    const ds = makeMorphDataset([0, 0, 1, 1, 4, 4, 2, 2, 3, 3]);
    const hits = buildStripMorphSlamHits(ds, { stepDurationMs: 1000 });
    expect(hits.length).toBe(4);
    expect(hits[0].tSec).toBe(2);
    expect(hits[0].freq).toBeCloseTo(523.25, 2);   // ordinal 1 — C5
    expect(hits[1].tSec).toBe(4);
    expect(hits[1].freq).toBeCloseTo(98.0, 2);     // ordinal 4 — the G2 toll
    expect(hits[2].tSec).toBe(4);                  // the dissonant partner, same instant
    expect(hits[2].freq).toBeCloseTo(98.0 * 1.0595, 2);
    expect(hits[3].tSec).toBe(8);
    expect(hits[3].freq).toBeCloseTo(130.81, 2);   // ordinal 3 — C3
    // deeper slam = harder, longer strike
    expect(hits[1].gain).toBeGreaterThan(hits[0].gain);
    expect(hits[1].decay).toBeGreaterThan(hits[0].decay);
    // clangy waveform, distinct from the sine/triangle nucleation bells
    for (const h of hits) expect(h.waveform).toBe('square');
    // the non-morph 'other' chip rose 0→1 and rang nothing (4 hits total)
  });

  it('a crystal appearing already driven rings on arrival (silence = the smooth floor)', () => {
    // chip absent (all-null) for 3 steps, then appears at ordinal 4
    const ds = makeMorphDataset([0, 0, 0, 4]);
    // make the first three steps truly ABSENT, not ordinal-0
    const axes = ds.manifest.axes;
    for (let s = 0; s < 3; s++) ds.chip_data[stripDataIndex(s, 1, 0, 0, axes, 2, 0)] = 255;
    const hits = buildStripMorphSlamHits(ds, { stepDurationMs: 1000 });
    expect(hits.length).toBe(2);                   // strike + dendrite partner
    expect(hits[0].tSec).toBe(3);
    expect(hits[0].freq).toBeCloseTo(98.0, 2);
  });

  it('tempo scales the schedule', () => {
    const ds = makeMorphDataset([0, 2]);
    const slow = buildStripMorphSlamHits(ds, { stepDurationMs: 1000 });
    const fast = buildStripMorphSlamHits(ds, { stepDurationMs: 250 });
    expect(slow.length).toBe(1);
    expect(fast.length).toBe(1);
    expect(fast[0].tSec).toBeCloseTo(slow[0].tSec / 4, 6);
  });

  it('toggle plumbing round-trips (default ON)', () => {
    expect(stripSonifyGetMorphBells()).toBe(true);
    expect(stripSonifySetMorphBells(false)).toBe(false);
    expect(stripSonifyGetMorphBells()).toBe(false);
    expect(stripSonifySetMorphBells(true)).toBe(true);
  });

  it('THE REAL THING: a recorded wittichen strip rings the dendrite toll', () => {
    const ds = recordScenario('wittichen');
    expect(ds).toBeTruthy();
    const hits = buildStripMorphSlamHits(ds, { stepDurationMs: 1000 });
    // the bismuth_morph chip slams 0→4 on the reducing Eh pulse — at
    // least one ordinal-4 strike (the 98 Hz toll) must be scheduled
    const tolls = hits.filter((h: any) => h.mineral === 'bismuth_morph' && Math.abs(h.freq - 98.0) < 0.1);
    expect(tolls.length).toBeGreaterThanOrEqual(1);
  });
});
