// tests-js/strip-sonify.test.ts — the MVP sonifier (js/85i).
//
// Pins the PURE pieces (no audio): the value→pentatonic-pitch + step→time
// plan builder, and the color→voice hierarchy mapping (hue→register,
// brightness→loudness). The Web Audio PLAYER is browser-only — jsdom has
// no AudioContext — so we also pin that it degrades gracefully (returns
// null) in the headless harness rather than throwing.

import { describe, expect, it } from 'vitest';

declare const buildStripSonifyPlan: any;
declare const buildStripSonifyPlans: any;
declare const _stripSonifyColorToVoice: any;
declare const playStripSonifyPlan: any;
declare const stripSonify: any;
declare const stripSonifyMany: any;
declare const stripSonifyIsPlaying: any;
declare const stripSonifyGetMasterVolume: any;
declare const stripSonifySetMasterVolume: any;
declare const stripAllocateData: any;
declare const stripDataIndex: any;

// Build a tiny synthetic dataset whose single chip's wall-mean contour
// ramps monotonically 0→1 across `steps`.
function makeDataset(steps: number, chipColor = 0xff0000): any {
  const axes = { steps, angular_indices: 2, height_positions: 2, depth_positions: 1 };
  const chips = [{ id: 'test', label: 'Test', system: 'special', range: [0, 1], units: '', color: chipColor }];
  const data = stripAllocateData(axes, 1);
  for (let s = 0; s < steps; s++) {
    const byte = Math.round((s / (steps - 1)) * 254);
    for (let a = 0; a < 2; a++) {
      for (let h = 0; h < 2; h++) {
        data[stripDataIndex(s, a, h, 0, axes, 1, 0)] = byte;
      }
    }
  }
  return {
    manifest: {
      format_version: 2, sim_version: 167, scenario_id: 'test', seed: 42,
      recorded_at: 0, duration_steps: steps, axes, chips,
    },
    chip_data: data,
    nucleation_events: [],
  };
}

describe('strip sonify — plan builder (pure)', () => {
  it('emits one note per step with step→time at the tempo knob', () => {
    const ds = makeDataset(8);
    const plan = buildStripSonifyPlan(ds, 'test', { stepDurationMs: 100 });
    expect(plan).not.toBeNull();
    expect(plan.notes.length).toBe(8);
    expect(plan.notes[0].tSec).toBeCloseTo(0, 6);
    expect(plan.notes[7].tSec).toBeCloseTo(0.7, 6);   // 7 × 100ms
    expect(plan.durationSec).toBeCloseTo(0.8, 6);      // 8 × 100ms
  });

  it('tempo knob (stepDurationMs) scales the timeline linearly', () => {
    const ds = makeDataset(8);
    const fast = buildStripSonifyPlan(ds, 'test', { stepDurationMs: 100 });
    const slow = buildStripSonifyPlan(ds, 'test', { stepDurationMs: 200 });
    expect(slow.durationSec).toBeCloseTo(fast.durationSec * 2, 6);
    expect(slow.notes[7].tSec).toBeCloseTo(fast.notes[7].tSec * 2, 6);
  });

  it('a rising contour yields a non-decreasing, pentatonic-quantized pitch line', () => {
    const ds = makeDataset(16);
    const plan = buildStripSonifyPlan(ds, 'test', {});
    // Monotonic non-decreasing freqs (the 0→1 ramp climbs the scale).
    for (let i = 1; i < plan.notes.length; i++) {
      expect(plan.notes[i].freq).toBeGreaterThanOrEqual(plan.notes[i - 1].freq);
    }
    // Lowest note < highest note (it actually traverses the scale).
    expect(plan.notes[0].freq).toBeLessThan(plan.notes[plan.notes.length - 1].freq);
    // Quantized to a small discrete set (pentatonic over a few octaves),
    // NOT a continuous sweep: far fewer distinct pitches than steps.
    const distinct = new Set(plan.notes.map((n: any) => Math.round(n.freq * 100)));
    expect(distinct.size).toBeLessThanOrEqual(15);   // 5 degrees × 3 octaves
    // Every pitch is a real, positive frequency.
    for (const n of plan.notes) expect(n.freq).toBeGreaterThan(0);
  });

  it('returns null for a chip not in the dataset, and for a zero-step dataset', () => {
    const ds = makeDataset(8);
    expect(buildStripSonifyPlan(ds, 'not_a_chip', {})).toBeNull();
    const empty = makeDataset(8); empty.manifest.axes.steps = 0;
    expect(buildStripSonifyPlan(empty, 'test', {})).toBeNull();
  });
});

describe('strip sonify — color creates the hierarchy', () => {
  it('warm hues sit in a LOWER register than cool hues', () => {
    const red = _stripSonifyColorToVoice(0xff0000);   // warm → low
    const blue = _stripSonifyColorToVoice(0x0000ff);  // cool → high
    expect(blue.baseOctave).toBeGreaterThan(red.baseOctave);
  });

  it('brighter lines are louder (foreground in the mix hierarchy)', () => {
    const bright = _stripSonifyColorToVoice(0xffffff);
    const dim = _stripSonifyColorToVoice(0x111111);
    expect(bright.voiceGain).toBeGreaterThan(dim.voiceGain);
    // Gentle, bounded gains (no clipping headroom blown).
    expect(bright.voiceGain).toBeLessThanOrEqual(0.6);
    expect(dim.voiceGain).toBeGreaterThan(0);
  });

  it('only gentle waveforms (sine / triangle) — no buzzy saw/square', () => {
    for (const c of [0xff0000, 0x00ff00, 0x0000ff, 0x808080, 0xffffff]) {
      const v = _stripSonifyColorToVoice(c);
      expect(['sine', 'triangle']).toContain(v.waveform);
    }
  });
});

describe('strip sonify — multi-voice (play exactly what is selected)', () => {
  it('buildStripSonifyPlans returns one plan per valid chip, skipping unknowns', () => {
    const ds = makeDataset(8);
    expect(buildStripSonifyPlans(ds, ['test', 'nope']).length).toBe(1);
    expect(buildStripSonifyPlans(ds, ['test', 'test']).length).toBe(2);
    expect(buildStripSonifyPlans(ds, []).length).toBe(0);
    expect(buildStripSonifyPlans(ds, ['nope']).length).toBe(0);
  });
});

describe('strip sonify — master volume', () => {
  it('has a sane default and clamps to [0,1]', () => {
    const original = stripSonifyGetMasterVolume();
    expect(original).toBeGreaterThan(0);
    expect(original).toBeLessThanOrEqual(1);
    expect(stripSonifySetMasterVolume(0.42)).toBeCloseTo(0.42, 6);
    expect(stripSonifyGetMasterVolume()).toBeCloseTo(0.42, 6);
    expect(stripSonifySetMasterVolume(2)).toBe(1);     // clamp high
    expect(stripSonifySetMasterVolume(-1)).toBe(0);    // clamp low
    stripSonifySetMasterVolume(original);              // restore
  });
});

describe('strip sonify — player degrades gracefully headless', () => {
  it('players return null when there is no AudioContext (jsdom)', () => {
    const ds = makeDataset(8);
    const plan = buildStripSonifyPlan(ds, 'test', {});
    // jsdom provides no Web Audio; the players must not throw.
    expect(playStripSonifyPlan(plan)).toBeNull();
    expect(stripSonify(ds, 'test', {})).toBeNull();
    expect(stripSonifyMany(ds, ['test'], {})).toBeNull();
    expect(stripSonifyIsPlaying()).toBe(false);
  });
});
