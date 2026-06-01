// ============================================================
// js/85i-strip-sonify.ts — let the rocks speak their truth
// ============================================================
// MVP sonification of a strip dataset (the boss's "afternoon MVP",
// 2026-05-31): one chip → one oscillator, value → pitch quantized to a
// pentatonic scale, step → time. A theremin tracing the chemistry.
//
// THE REFRAME (continuing the strip-as-instrument lineage): the strip
// recorder already captured every chip's trajectory as a time-series
// (85f dataset, 85g recorder). The chart is the EYE's reading of that
// recording; this module is the EAR's. "The truth is told in time" — and
// in 4/4. The geology supplies the phrasing for free: monotonic ramps
// rise, retrograde solubility falls, sabkha Ω-cycling repeats as an
// ostinato, a sulphur_bank pH crash drops and rebounds.
//
// DESIGN NOTES FROM THE BOSS:
//   * "the color of the line creates a hierarchy" — the chip's color is
//     a first-class musical input, NOT decoration. Even at one voice we
//     map hue → register and brightness → loudness, so when more voices
//     arrive each self-places by color: bright/warm leads, dim/cool
//     recedes. _stripSonifyColorToVoice is the seed of that hierarchy.
//   * "play with the tempo in playback" (later) — step→time is a single
//     knob (opts.stepDurationMs). A future tempo slider sets it; no UI
//     for it yet, but the engine already honors it.
//
// NO new dependencies — Web Audio (OscillatorNode) is a browser
// primitive. The PLAN builder is pure + headless-testable; only the
// PLAYER touches AudioContext (guarded, browser-only).
//
// Reads 85f globals: stripDataIndex, stripDequantizeNormalized.

// Tempo + voice defaults. stepDurationMs is THE tempo knob.
const STRIP_SONIFY_DEFAULTS = {
  stepDurationMs: 140,   // ms per sim step (future tempo slider sets this)
  octaveSpan: 3,         // pentatonic scale spans this many octaves
};

// C-major pentatonic scale degrees, in semitones above the octave root.
const _STRIP_PENTATONIC = [0, 2, 4, 7, 9];

// MIDI note number → frequency (A4 = MIDI 69 = 440 Hz, equal temperament).
function _stripSonifyMidiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Build the ascending frequency table for a pentatonic scale of
// `octaveSpan` octaves starting at scientific octave `baseOctave`
// (so baseOctave=4 starts at C4 = MIDI 60). Returns ascending Hz.
function _stripSonifyPentatonicFreqs(baseOctave: number, octaveSpan: number): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaveSpan; o++) {
    for (const s of _STRIP_PENTATONIC) {
      const midi = 12 * (baseOctave + o + 1) + s; // C(oct) MIDI = 12*(oct+1)
      out.push(_stripSonifyMidiToFreq(midi));
    }
  }
  return out;
}

// Color → musical voice (THE hierarchy mapping). Takes a chip's hex color
// (an integer 0xRRGGBB, as stored in StripChipMeta.color) and returns:
//   * baseOctave  — register. Warm hues sit LOW (lead/bass), cool hues
//     HIGH, so distinct chips occupy distinct pitch bands.
//   * voiceGain   — loudness from perceived brightness. Brighter line =
//     louder = higher in the hierarchy (the eye reads bright as
//     prominent; the ear should too).
//   * waveform    — vivid (saturated) colors get a slightly richer
//     timbre. Kept gentle (sine / triangle only — no buzzy saw/square,
//     per the restrained field-guide aesthetic).
function _stripSonifyColorToVoice(color: number): {
  baseOctave: number; voiceGain: number; waveform: OscillatorType;
} {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  let hue = 0;
  if (d > 1e-6) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const sat = d <= 1e-6 ? 0 : d / (1 - Math.abs(2 * light - 1) + 1e-9);
  // coolness: red(0°)→0 (warm/low), cyan(180°)→1 (cool/high), wraps
  // smoothly; greens/purples land mid-register.
  const coolness = (1 - Math.cos(hue * Math.PI / 180)) / 2;
  const baseOctave = 3 + Math.round(coolness * 3);          // 3..6
  // Perceptual luminance (Rec. 601-ish) → loudness, with headroom.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const voiceGain = 0.14 + 0.34 * lum;                       // ~0.14..0.48
  const waveform: OscillatorType = sat > 0.55 ? 'triangle' : 'sine';
  return { baseOctave, voiceGain, waveform };
}

// Resolve a chip id → its index in the manifest (and its meta). Returns
// null if the chip isn't in this dataset.
function _stripSonifyFindChip(ds: StripDataset, chipId: string):
  { idx: number; meta: StripChipMeta } | null {
  const chips = ds.manifest.chips;
  for (let i = 0; i < chips.length; i++) {
    if (chips[i].id === chipId) return { idx: i, meta: chips[i] };
  }
  return null;
}

// Per step, the mean NORMALIZED (0..1) value of `chipIdx` across the wall
// slice (depth 0) — all angles × heights — skipping nulls. One number per
// step → the melodic contour. Holds the last valid value across all-null
// steps so the line doesn't drop out.
function _stripSonifyContour(ds: StripDataset, chipIdx: number): number[] {
  const ax = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  const out: number[] = [];
  let hold = 0.5;
  for (let step = 0; step < ax.steps; step++) {
    let sum = 0, n = 0;
    for (let a = 0; a < ax.angular_indices; a++) {
      for (let h = 0; h < ax.height_positions; h++) {
        const li = stripDataIndex(step, a, h, chipIdx, ax, chipCount, 0);
        if (li < 0) continue;
        const v = stripDequantizeNormalized(ds.chip_data[li]);
        if (v === null) continue;
        sum += v; n++;
      }
    }
    const val = n > 0 ? sum / n : hold;
    hold = val;
    out.push(val);
  }
  return out;
}

interface StripSonifyPlan {
  notes: { tSec: number; freq: number }[];
  durationSec: number;
  voiceGain: number;
  waveform: OscillatorType;
  baseOctave: number;
  chipId: string;
  chipLabel: string;
  chipColor: number;
}

// PURE: build the playback plan for one chip of a dataset. No audio.
// Returns null if the chip isn't present or the dataset has no steps.
function buildStripSonifyPlan(
  ds: StripDataset, chipId: string, opts: { stepDurationMs?: number; octaveSpan?: number } = {}
): StripSonifyPlan | null {
  const found = _stripSonifyFindChip(ds, chipId);
  if (!found) return null;
  const steps = ds.manifest.axes.steps | 0;
  if (steps < 1) return null;
  const stepMs = opts.stepDurationMs ?? STRIP_SONIFY_DEFAULTS.stepDurationMs;
  const span = opts.octaveSpan ?? STRIP_SONIFY_DEFAULTS.octaveSpan;
  const voice = _stripSonifyColorToVoice(found.meta.color >>> 0);
  const freqs = _stripSonifyPentatonicFreqs(voice.baseOctave, span);
  const contour = _stripSonifyContour(ds, found.idx);
  const notes = contour.map((v, step) => {
    const idx = Math.max(0, Math.min(freqs.length - 1, Math.round(v * (freqs.length - 1))));
    return { tSec: (step * stepMs) / 1000, freq: freqs[idx] };
  });
  return {
    notes,
    durationSec: (steps * stepMs) / 1000,
    voiceGain: voice.voiceGain,
    waveform: voice.waveform,
    baseOctave: voice.baseOctave,
    chipId,
    chipLabel: found.meta.label,
    chipColor: found.meta.color >>> 0,
  };
}

type StripSonifyHandle = { stop: () => void; setVolume: (v: number) => void };

// Singleton playback handle so a new play stops the previous one. Carries
// setVolume so the volume slider can adjust a live performance.
let _stripSonifyHandle: StripSonifyHandle | null = null;

// Master volume (0..1). The slider sets this; it persists between plays
// and is applied live to any in-progress performance.
let _stripSonifyMasterVolume = 0.7;

// Is a sonification currently playing?
function stripSonifyIsPlaying(): boolean { return _stripSonifyHandle !== null; }

// Stop any active playback (idempotent).
function stripSonifyStop(): void {
  if (_stripSonifyHandle) {
    try { _stripSonifyHandle.stop(); } catch (_e) { /* ignore */ }
    _stripSonifyHandle = null;
  }
}

function stripSonifyGetMasterVolume(): number { return _stripSonifyMasterVolume; }

// Set master volume (0..1). Stored for future plays AND applied live to
// any in-progress playback. Returns the clamped value.
function stripSonifySetMasterVolume(v: number): number {
  const vol = Math.max(0, Math.min(1, Number(v)));
  _stripSonifyMasterVolume = vol;
  if (_stripSonifyHandle) { try { _stripSonifyHandle.setVolume(vol); } catch (_e) { /* ignore */ } }
  return vol;
}

// Build plans for several chips at once (skips any not in the dataset).
function buildStripSonifyPlans(
  ds: StripDataset, chipIds: string[],
  opts: { stepDurationMs?: number; octaveSpan?: number } = {}
): StripSonifyPlan[] {
  const out: StripSonifyPlan[] = [];
  for (const id of chipIds) {
    const p = buildStripSonifyPlan(ds, id, opts);
    if (p) out.push(p);
  }
  return out;
}

// PLAYER: schedule one OR MORE plans as layered voices on a shared
// timeline. Each plan is one continuous oscillator whose frequency jumps
// per step (setValueAtTime — the "stepped theremin"); its per-voice gain
// comes from the chip color (brightness → loudness, THE hierarchy),
// scaled by 1/sqrt(voiceCount) so a dense selection sums without
// clipping. All voices feed a master gain set by the volume slider.
// Browser-only; returns null headless. onEnded fires when the last voice
// finishes (or on stop).
function playStripSonifyPlans(
  plans: StripSonifyPlan[], onEnded?: () => void
): StripSonifyHandle | null {
  const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  if (typeof AC !== 'function') return null;
  if (!plans.length) return null;
  stripSonifyStop();

  const ctx = new AC();
  // Browsers create the context suspended until a user gesture; the Play
  // click IS that gesture, so resume immediately.
  try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch (_e) { /* ignore */ }

  const master = ctx.createGain();
  master.gain.value = _stripSonifyMasterVolume;
  master.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.06;
  const attack = 0.08, release = 0.18;
  const voiceScale = 1 / Math.sqrt(plans.length);   // keep the mix bounded
  let endMax = t0 + 0.2;
  const oscs: any[] = [];

  for (const plan of plans) {
    const osc = ctx.createOscillator();
    const vg = ctx.createGain();
    osc.type = plan.waveform;
    osc.connect(vg).connect(master);
    const end = t0 + Math.max(plan.durationSec, 0.2);
    if (end > endMax) endMax = end;
    // Pitch contour — instantaneous jumps per step.
    if (plan.notes.length) osc.frequency.setValueAtTime(plan.notes[0].freq, t0);
    for (const n of plan.notes) osc.frequency.setValueAtTime(n.freq, t0 + n.tSec);
    // Per-voice envelope (peak = color loudness × mix scale).
    const peak = plan.voiceGain * voiceScale;
    vg.gain.setValueAtTime(0, t0);
    vg.gain.linearRampToValueAtTime(peak, t0 + attack);
    vg.gain.setValueAtTime(peak, Math.max(t0 + attack, end - release));
    vg.gain.linearRampToValueAtTime(0, end);
    osc.start(t0);
    osc.stop(end + 0.05);
    oscs.push(osc);
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try { ctx.close(); } catch (_e) { /* ignore */ }
    if (_stripSonifyHandle === handle) _stripSonifyHandle = null;
    if (onEnded) { try { onEnded(); } catch (_e) { /* ignore */ } }
  };
  // All voices share the same step count → same duration, so any one's
  // onended marks the end of the performance.
  oscs[oscs.length - 1].onended = finish;

  const handle: StripSonifyHandle = {
    stop() {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
        master.gain.linearRampToValueAtTime(0, now + 0.06);
        for (const o of oscs) { try { o.stop(now + 0.08); } catch (_e) { /* ignore */ } }
      } catch (_e) { /* ignore */ }
      finish();
    },
    setVolume(v: number) {
      try { master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.03); } catch (_e) { /* ignore */ }
    },
  };
  _stripSonifyHandle = handle;
  return handle;
}

// Back-compat single-plan player (delegates to the layered player).
function playStripSonifyPlan(
  plan: StripSonifyPlan, onEnded?: () => void
): StripSonifyHandle | null {
  return playStripSonifyPlans([plan], onEnded);
}

// Convenience: build + play one chip.
function stripSonify(
  ds: StripDataset, chipId: string,
  opts: { stepDurationMs?: number; octaveSpan?: number } = {},
  onEnded?: () => void
): StripSonifyHandle | null {
  const plan = buildStripSonifyPlan(ds, chipId, opts);
  if (!plan) return null;
  return playStripSonifyPlans([plan], onEnded);
}

// Convenience: build + play several chips layered — color sets each
// voice's place in the mix. This is "play exactly what's selected."
function stripSonifyMany(
  ds: StripDataset, chipIds: string[],
  opts: { stepDurationMs?: number; octaveSpan?: number } = {},
  onEnded?: () => void
): StripSonifyHandle | null {
  const plans = buildStripSonifyPlans(ds, chipIds, opts);
  if (!plans.length) return null;
  return playStripSonifyPlans(plans, onEnded);
}
