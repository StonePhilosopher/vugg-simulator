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
declare const stripSonifyGetStepDuration: any;
declare const stripSonifySetStepDuration: any;
declare const STRIP_SONIFY_SCALES: any;
declare const stripSonifyGetScaleId: any;
declare const stripSonifySetScaleId: any;
declare const stripSonifyUpdateVoices: any;
declare const buildStripCrystalHits: any;
declare const stripSonifyGetCrystals: any;
declare const stripSonifySetCrystals: any;
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

describe('strip sonify — tempo knob', () => {
  it('has a sane default and clamps to a musical range; the players honor it', () => {
    const original = stripSonifyGetStepDuration();
    expect(original).toBeGreaterThan(0);
    expect(stripSonifySetStepDuration(80)).toBe(80);
    expect(stripSonifyGetStepDuration()).toBe(80);
    // A faster tempo (smaller ms) shortens the timeline — and the
    // convenience build path picks up the module tempo by default.
    const ds = makeDataset(8);
    stripSonifySetStepDuration(100);
    const slow = buildStripSonifyPlan(ds, 'test', { stepDurationMs: stripSonifyGetStepDuration() });
    stripSonifySetStepDuration(50);
    const fast = buildStripSonifyPlan(ds, 'test', { stepDurationMs: stripSonifyGetStepDuration() });
    expect(fast.durationSec).toBeCloseTo(slow.durationSec / 2, 6);
    expect(stripSonifySetStepDuration(10)).toBe(30);    // clamp low (min 30)
    expect(stripSonifySetStepDuration(9999)).toBe(800); // clamp high (max 800)
    stripSonifySetStepDuration(original);               // restore
  });
});

describe('strip sonify — scales / modes', () => {
  const scaleById = (id: string) => STRIP_SONIFY_SCALES.find((s: any) => s.id === id);

  it('registry matches the musician spec (semitone sets)', () => {
    expect(scaleById('major_pentatonic').semitones).toEqual([0, 2, 4, 7, 9]);
    expect(scaleById('mixolydian').semitones).toEqual([0, 2, 4, 5, 7, 9, 10]);       // major + ♭7
    expect(scaleById('dorian').semitones).toEqual([0, 2, 3, 5, 7, 9, 10]);            // minor + raised 6
    expect(scaleById('aeolian').semitones).toEqual([0, 2, 3, 5, 7, 8, 10]);           // natural minor
    expect(scaleById('phrygian').semitones).toEqual([0, 1, 3, 5, 7, 8, 10]);          // ♭2, minor 3
    expect(scaleById('phrygian_dominant').semitones).toEqual([0, 1, 4, 5, 7, 8, 10]); // ♭2, major 3
  });

  it('default scale is the safe pentatonic; setter accepts known ids and rejects unknown', () => {
    const original = stripSonifyGetScaleId();
    expect(original).toBe('major_pentatonic');
    expect(stripSonifySetScaleId('dorian')).toBe('dorian');
    expect(stripSonifyGetScaleId()).toBe('dorian');
    expect(stripSonifySetScaleId('not_a_scale')).toBe('dorian'); // unchanged
    stripSonifySetScaleId(original);                             // restore
  });

  it('a chosen mode produces ONLY that scale’s pitch classes', () => {
    const ds = makeDataset(24);
    const pcOf = (freq: number) => {
      const midi = Math.round(12 * Math.log2(freq / 440) + 69);
      return ((midi % 12) + 12) % 12;
    };
    for (const id of ['mixolydian', 'phrygian_dominant', 'aeolian']) {
      const plan = buildStripSonifyPlan(ds, 'test', { scaleId: id });
      const allowed = new Set(scaleById(id).semitones);
      for (const n of plan.notes) expect(allowed.has(pcOf(n.freq))).toBe(true);
    }
  });

  it('7-note modes give finer pitch resolution than the 5-note pentatonic', () => {
    const ds = makeDataset(40);
    const distinct = (id: string) => new Set(
      buildStripSonifyPlan(ds, 'test', { scaleId: id }).notes.map((n: any) => Math.round(n.freq)),
    ).size;
    expect(distinct('mixolydian')).toBeGreaterThan(distinct('major_pentatonic'));
  });
});

describe('strip sonify — live voice update', () => {
  it('stripSonifyUpdateVoices is a no-op (no throw) when nothing is playing', () => {
    const ds = makeDataset(8);
    expect(() => stripSonifyUpdateVoices(ds, ['test'])).not.toThrow();
    expect(stripSonifyIsPlaying()).toBe(false);
  });
});

describe('strip sonify — crystals as struck bells', () => {
  const pcOf = (freq: number) => {
    const midi = Math.round(12 * Math.log2(freq / 440) + 69);
    return ((midi % 12) + 12) % 12;
  };
  // A dataset with two nucleations: a big warm crystal and a small cool one.
  const makeCrystalDs = () => {
    const ds = makeDataset(20);
    ds.nucleation_events = [
      { step: 2, ring: 0, cell: 0, mineral: 'big_red' },
      { step: 5, ring: 1, cell: 3, mineral: 'small_blue' },
    ];
    return ds;
  };
  const resolvers = {
    colorOf: (m: string) => (m === 'big_red' ? 0xff0000 : 0x0000ff),
    sizeOf: (m: string) => (m === 'big_red' ? 80 : 0.6),
  };

  it('one bell per nucleation, struck at the event step', () => {
    const hits = buildStripCrystalHits(makeCrystalDs(), { stepDurationMs: 100, scaleId: 'major_pentatonic' }, resolvers);
    expect(hits.length).toBe(2);
    expect(hits[0].tSec).toBeCloseTo(0.2, 6);  // step 2 × 100 ms
    expect(hits[1].tSec).toBeCloseTo(0.5, 6);  // step 5 × 100 ms
  });

  it('every bell rings IN the active scale', () => {
    const hits = buildStripCrystalHits(makeCrystalDs(), { scaleId: 'major_pentatonic' }, resolvers);
    const allowed = new Set([0, 2, 4, 7, 9]);
    for (const h of hits) expect(allowed.has(pcOf(h.freq))).toBe(true);
  });

  it('big crystals toll low + long; small crystals tick high + short (size → register + ring)', () => {
    const hits = buildStripCrystalHits(makeCrystalDs(), { scaleId: 'major_pentatonic' }, resolvers);
    const [big, small] = hits;
    expect(big.freq).toBeLessThan(small.freq);     // big = lower register
    expect(big.decay).toBeGreaterThan(small.decay); // big = longer ring
  });

  it('color sets the note (different hue → different scale degree) and the loudness (brightness)', () => {
    const hits = buildStripCrystalHits(makeCrystalDs(), { scaleId: 'major_pentatonic' }, resolvers);
    expect(pcOf(hits[0].freq)).not.toBe(pcOf(hits[1].freq)); // red vs blue → different note
    expect(hits[0].gain).toBeGreaterThan(hits[1].gain);      // red brighter than blue → louder
  });

  it('no events → no bells; crystals toggle has a sane default + setter', () => {
    expect(buildStripCrystalHits(makeDataset(8), {}, resolvers).length).toBe(0);
    const original = stripSonifyGetCrystals();
    expect(typeof original).toBe('boolean');
    expect(stripSonifySetCrystals(false)).toBe(false);
    expect(stripSonifyGetCrystals()).toBe(false);
    expect(stripSonifySetCrystals(true)).toBe(true);
    stripSonifySetCrystals(original);
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
