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
declare const stripSonifyGetCrystalVolume: any;
declare const stripSonifySetCrystalVolume: any;
declare const stripSonifyGetDepletion: any;
declare const stripSonifySetDepletion: any;
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

  it('crystal volume defaults to full (prior mix) and clamps to [0,1]', () => {
    const original = stripSonifyGetCrystalVolume();
    expect(original).toBe(1);                           // default = unchanged prior mix
    expect(stripSonifySetCrystalVolume(0.3)).toBeCloseTo(0.3, 6);
    expect(stripSonifyGetCrystalVolume()).toBeCloseTo(0.3, 6);
    expect(stripSonifySetCrystalVolume(5)).toBe(1);     // clamp high
    expect(stripSonifySetCrystalVolume(-2)).toBe(0);    // clamp low
    stripSonifySetCrystalVolume(original);              // restore
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

describe('strip sonify — pulse / rhythm', () => {
  it('articulates on a subdivision grid — gates are sparser than the per-step contour', () => {
    const ds = makeDataset(24);
    const plan = buildStripSonifyPlan(ds, 'test', { stepDurationMs: 100 });
    expect(plan.notes.length).toBe(24);                         // per-step pitch contour unchanged
    expect([2, 3, 4, 6]).toContain(plan.subdiv);                // a musical subdivision
    expect(plan.gates.length).toBeGreaterThan(0);
    expect(plan.gates.length).toBeLessThan(plan.notes.length);  // fewer sounded notes than steps = rhythm
  });

  it('notes are legato (sustain to the next onset, no overlap) and time-ordered', () => {
    const plan = buildStripSonifyPlan(makeDataset(24), 'test', { stepDurationMs: 100 });
    let prev = -1;
    for (let i = 0; i < plan.gates.length; i++) {
      const g = plan.gates[i];
      expect(g.durSec).toBeGreaterThan(0);
      expect(g.tSec).toBeGreaterThanOrEqual(prev);       // time-ordered
      const next = i + 1 < plan.gates.length ? plan.gates[i + 1].tSec : plan.durationSec;
      expect(g.tSec + g.durSec).toBeLessThanOrEqual(next + 1e-6);   // ends before the next begins
      prev = g.tSec;
    }
  });

  it('fires fewer notes when the data holds: a flat trajectory yields fewer onsets than a moving one', () => {
    const moving = buildStripSonifyPlan(makeDataset(24), 'test', {});
    const flat = makeDataset(24);
    flat.chip_data.fill(127);            // constant byte → constant pitch → it holds
    const flatPlan = buildStripSonifyPlan(flat, 'test', {});
    expect(flatPlan.gates.length).toBeLessThan(moving.gates.length);
  });

  it('a held (even) line DRONES: it sustains most of the timeline instead of resting silent', () => {
    // The boss's 2026-06-03 ear: "a lot of the modes don't play most of the
    // even droning lines." A steady line must keep sounding, not rest at ~0.
    const flat = makeDataset(240, 0x223344);   // dim color → slow "pad" subdiv
    flat.chip_data.fill(127);                  // constant pitch → held the whole run
    const plan = buildStripSonifyPlan(flat, 'test', { stepDurationMs: 140 });
    const sounded = plan.gates.reduce((s: number, g: any) => s + g.durSec, 0);
    expect(sounded / plan.durationSec).toBeGreaterThan(0.7);   // drones (was ~0.05 before the fix)
    expect(plan.gates.some((g: any) => g.sustain)).toBe(true); // held notes flagged for the player to hold
  });

  it('brightness sets the subdivision — bright voices busier than dim', () => {
    const bright = buildStripSonifyPlan(makeDataset(24, 0xffffff), 'test', {}); // white = brightest
    const dim = buildStripSonifyPlan(makeDataset(24, 0x202020), 'test', {});    // near-black
    expect(bright.subdiv).toBeLessThanOrEqual(dim.subdiv);     // smaller subdiv = more notes/sec
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

describe('strip sonify — stereo pan from angular position', () => {
  // A dataset with `A` angular sub-strips where the chip's value is loaded
  // heavily on ONE sub-strip (`loadAngle`) and light elsewhere — a lopsided
  // ring. height collapsed to 1 for clarity.
  function makePanDataset(steps: number, loadAngle: number, A = 4): any {
    const axes = { steps, angular_indices: A, height_positions: 1, depth_positions: 1 };
    const chips = [{ id: 'test', label: 'Test', system: 'special', range: [0, 1], units: '', color: 0xff0000 }];
    const data = stripAllocateData(axes, 1);
    for (let s = 0; s < steps; s++) {
      for (let a = 0; a < A; a++) {
        data[stripDataIndex(s, a, 0, 0, axes, 1, 0)] = (a === loadAngle) ? 240 : 20;
      }
    }
    return {
      manifest: { format_version: 2, sim_version: 167, scenario_id: 'pan', seed: 42, recorded_at: 0, duration_steps: steps, axes, chips },
      chip_data: data, nucleation_events: [],
    };
  }

  it('emits one pan per step, all within [-1, 1]', () => {
    const plan = buildStripSonifyPlan(makePanDataset(12, 1), 'test', {});
    expect(plan.pans.length).toBe(12);
    for (const p of plan.pans) {
      expect(p.pan).toBeGreaterThanOrEqual(-1);
      expect(p.pan).toBeLessThanOrEqual(1);
    }
  });

  it('a spatially-uniform field sits dead center (the sines cancel)', () => {
    // makeDataset loads every angle identically → centroid is centered.
    const plan = buildStripSonifyPlan(makeDataset(8), 'test', {});
    for (const p of plan.pans) expect(Math.abs(p.pan)).toBeLessThan(1e-9);
  });

  it('a lopsided field leans toward the loaded side (right vs left)', () => {
    // A=4: sub-strip 1 is at +90° (sin=+1, hard right), sub-strip 3 at
    // -90° (sin=-1, hard left).
    const right = buildStripSonifyPlan(makePanDataset(8, 1), 'test', {});
    const left = buildStripSonifyPlan(makePanDataset(8, 3), 'test', {});
    expect(right.pans[4].pan).toBeGreaterThan(0.3);
    expect(left.pans[4].pan).toBeLessThan(-0.3);
    expect(right.pans[4].pan).toBeCloseTo(-left.pans[4].pan, 6);   // mirror image
  });

  it('crystal bells pan to where they nucleated around the ring', () => {
    const ds = makeDataset(8);
    ds.nucleation_events = [
      { step: 1, ring: 0, cell: 0, mineral: 'm' },    // 0° → center
      { step: 2, ring: 0, cell: 30, mineral: 'm' },   // +90° → hard right (sin=+1)
      { step: 3, ring: 0, cell: 90, mineral: 'm' },   // -90° → hard left (sin=-1)
    ];
    const hits = buildStripCrystalHits(ds, {}, { colorOf: () => 0xff0000, sizeOf: () => 2 });
    expect(hits[0].pan).toBeCloseTo(0, 6);
    expect(hits[1].pan).toBeCloseTo(1, 6);
    expect(hits[2].pan).toBeCloseTo(-1, 6);
  });
});

describe('strip sonify — continuous (raw rock) honesty dial', () => {
  it('is registered as a selectable mode with empty semitones (the sentinel)', () => {
    const cont = STRIP_SONIFY_SCALES.find((s: any) => s.id === 'continuous');
    expect(cont).toBeTruthy();
    expect(cont.semitones).toEqual([]);
    expect(stripSonifySetScaleId('continuous')).toBe('continuous');  // accepted by the setter
    stripSonifySetScaleId('major_pentatonic');                       // restore
  });

  it('glides (no scale, no rhythm): one sustained gate + glide flag', () => {
    const plan = buildStripSonifyPlan(makeDataset(16), 'test', { scaleId: 'continuous', stepDurationMs: 100 });
    expect(plan.glide).toBe(true);
    expect(plan.gates.length).toBe(1);                       // one sustained tone, not plucks
    expect(plan.gates[0].durSec).toBeCloseTo(plan.durationSec, 6);
    // A normal scale is NOT glide and DOES pluck.
    const scaled = buildStripSonifyPlan(makeDataset(16), 'test', { scaleId: 'major_pentatonic', stepDurationMs: 100 });
    expect(scaled.glide).toBe(false);
    expect(scaled.gates.length).toBeGreaterThan(1);
  });

  it('is unquantized: a rising ramp climbs more distinct pitches than the snapped scale', () => {
    const ds = makeDataset(16);
    const cont = buildStripSonifyPlan(ds, 'test', { scaleId: 'continuous' });
    const pent = buildStripSonifyPlan(ds, 'test', { scaleId: 'major_pentatonic' });
    const distinct = (p: any) => new Set(p.notes.map((n: any) => Math.round(n.freq * 100))).size;
    // 16-step ramp → 16 distinct raw pitches; pentatonic snaps to far fewer.
    expect(distinct(cont)).toBeGreaterThan(distinct(pent));
    // Monotonic non-decreasing (tracks the rising contour) + positive.
    for (let i = 1; i < cont.notes.length; i++) {
      expect(cont.notes[i].freq).toBeGreaterThanOrEqual(cont.notes[i - 1].freq);
    }
    for (const n of cont.notes) expect(n.freq).toBeGreaterThan(0);
  });

  it('crystal bells in continuous mode still ring (hue → smooth pitch, no NaN)', () => {
    const ds = makeDataset(8);
    ds.nucleation_events = [{ step: 1, ring: 0, cell: 10, mineral: 'm' }];
    const hits = buildStripCrystalHits(ds, { scaleId: 'continuous' }, { colorOf: () => 0x00ff00, sizeOf: () => 3 });
    expect(hits.length).toBe(1);
    expect(Number.isFinite(hits[0].freq)).toBe(true);
    expect(hits[0].freq).toBeGreaterThan(0);
  });
});

describe('strip sonify — the depletion voice (audible twin of the floor shadow)', () => {
  // A v3 dataset with floor_data. The chip's LEVEL is a steady high byte;
  // when `deplete`, ONE angular bin's FLOOR plunges (a local halo), so the
  // ring-MIN floor sits well below the level mean → an audible shadow. When
  // not, floor == level everywhere → no dip → no shadow (self-gating).
  function makeFloorDataset(steps: number, deplete: boolean, formatVersion = 3, chipColor = 0x66ccff): any {
    const axes = { steps, angular_indices: 2, height_positions: 2, depth_positions: 1 };
    const chips = [{ id: 'ion', label: 'Ion', system: 'ion', range: [0, 1], units: 'ppm', color: chipColor }];
    const data = stripAllocateData(axes, 1);
    const floor = stripAllocateData(axes, 1);
    const lvlByte = 200;
    for (let s = 0; s < steps; s++) {
      for (let a = 0; a < 2; a++) {
        for (let h = 0; h < 2; h++) {
          const i = stripDataIndex(s, a, h, 0, axes, 1, 0);
          data[i] = lvlByte;
          floor[i] = deplete && a === 0 ? 80 : lvlByte;   // bin 0 = deep halo; bin 1 = at level
        }
      }
    }
    const ds: any = {
      manifest: { format_version: formatVersion, sim_version: 175, scenario_id: 'floor', seed: 42, recorded_at: 0, duration_steps: steps, axes, chips },
      chip_data: data, nucleation_events: [],
    };
    if (formatVersion >= 3) ds.floor_data = floor;   // v1/v2 carry none
    return ds;
  }

  it('a depleted ion grows a shadow: floorNotes + shadowGains, the floor at/below the level', () => {
    const plan = buildStripSonifyPlan(makeFloorDataset(16, true), 'ion', { stepDurationMs: 100 });
    expect(plan.floorNotes).toBeTruthy();
    expect(plan.floorNotes.length).toBe(plan.notes.length);
    expect(plan.shadowGains.length).toBe(plan.notes.length);
    // The shadow swells to an audible peak (deep halo saturates the gain map).
    const peak = Math.max(...plan.shadowGains.map((g: any) => g.gain));
    expect(peak).toBeGreaterThan(0.2);
    // floor ≤ level pitch at every step (the undertone hangs below the drone).
    for (let i = 0; i < plan.notes.length; i++) {
      expect(plan.floorNotes[i].freq).toBeLessThanOrEqual(plan.notes[i].freq);
    }
    // And it actually opens a gap somewhere (not a unison shadow).
    expect(plan.floorNotes.some((n: any, i: number) => n.freq < plan.notes[i].freq)).toBe(true);
  });

  it('an abundant ion (floor == level) grows NO shadow — it self-gates to silence', () => {
    const plan = buildStripSonifyPlan(makeFloorDataset(16, false), 'ion', {});
    expect(plan.floorNotes).toBeUndefined();
    expect(plan.shadowGains).toBeUndefined();
  });

  it('a v2 dataset (no floor_data) grows no shadow even if depletion-shaped', () => {
    const plan = buildStripSonifyPlan(makeFloorDataset(16, true, 2), 'ion', {});
    expect(plan.floorNotes).toBeUndefined();
    expect(plan.shadowGains).toBeUndefined();
  });

  it('the toggle suppresses the shadow without touching the main voice', () => {
    const original = stripSonifyGetDepletion();
    expect(typeof original).toBe('boolean');
    stripSonifySetDepletion(false);
    const off = buildStripSonifyPlan(makeFloorDataset(16, true), 'ion', {});
    expect(off.floorNotes).toBeUndefined();
    expect(off.notes.length).toBe(16);                 // the drone is untouched
    expect(stripSonifySetDepletion(true)).toBe(true);
    const on = buildStripSonifyPlan(makeFloorDataset(16, true), 'ion', {});
    expect(on.floorNotes).toBeTruthy();
    stripSonifySetDepletion(original);                 // restore
  });

  it('the shadow snaps to the active scale (a musical interval, not a smear)', () => {
    const pcOf = (freq: number) => (((Math.round(12 * Math.log2(freq / 440) + 69) % 12) + 12) % 12);
    const plan = buildStripSonifyPlan(makeFloorDataset(16, true), 'ion', { scaleId: 'major_pentatonic' });
    const allowed = new Set([0, 2, 4, 7, 9]);
    for (const n of plan.floorNotes) expect(allowed.has(pcOf(n.freq))).toBe(true);
  });

  it('continuous (raw rock) mode still gives the shadow a glided floor contour', () => {
    const plan = buildStripSonifyPlan(makeFloorDataset(16, true), 'ion', { scaleId: 'continuous' });
    expect(plan.glide).toBe(true);
    expect(plan.floorNotes).toBeTruthy();
    expect(plan.floorNotes.length).toBe(plan.notes.length);
    for (const n of plan.floorNotes) expect(n.freq).toBeGreaterThan(0);
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
