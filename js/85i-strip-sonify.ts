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
  stepDurationMs: 140,   // ms per sim step (the tempo slider sets this)
  octaveSpan: 3,         // the scale spans this many octaves
};

// SCALES / MODES (the dropdown). Each is a list of semitone offsets above
// the octave root. Descriptions cribbed from the fantasy-tavern / dwarven
// register a musician laid out (2026-05-31):
//   * Pentatonic — the safe default: 5 notes, NO semitone clashes even
//     when every chip plays at once. Foolproof for dense selections.
//   * Mixolydian (major + ♭7) — the rowdy-tavern workhorse. Bright but the
//     ♭7 keeps it folk/Celtic, not church. (bVII–IV–I session-tune land.)
//   * Dorian (minor + raised 6th) — sad-but-not-mopey modal ballad
//     ("Scarborough Fair" territory); the slow tune after a few rounds.
//   * Aeolian / natural minor — solemn, heavy, marching: dwarven halls.
//   * Phrygian (♭2, minor 3) — darker, austere.
//   * Phrygian dominant (♭2, major 3, ♭6, ♭7; 5th mode of harmonic minor)
//     — carved, exotic, severe: "old and not from around here."
const STRIP_SONIFY_SCALES: { id: string; label: string; semitones: number[] }[] = [
  { id: 'major_pentatonic',  label: 'Pentatonic — safe, no clashes', semitones: [0, 2, 4, 7, 9] },
  { id: 'mixolydian',        label: 'Mixolydian — rowdy tavern',     semitones: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'dorian',            label: 'Dorian — melancholy ballad',    semitones: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'aeolian',           label: 'Aeolian — dwarven march',       semitones: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'phrygian',          label: 'Phrygian — austere',            semitones: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'phrygian_dominant', label: 'Phrygian dominant — carved',    semitones: [0, 1, 4, 5, 7, 8, 10] },
  // THE HONESTY DIAL (boss, 2026-06-01): "the aesthetic can improve, but I
  // want it honest to the vugg." Every other entry quantizes the chemistry
  // to a playable scale — a human tuning laid over the rock. `continuous`
  // is the OTHER pole: NO scale, NO rhythm. The value glides smoothly across
  // the register as a raw microtonal theremin — the unvarnished reading of
  // the data. Less "musical", more true. The empty semitones[] is the
  // sentinel the plan builder checks (_stripSonifyIsContinuous).
  { id: 'continuous',        label: 'Continuous — raw rock (no scale)', semitones: [] },
];

// The wall's universal native angular resolution (cells_per_ring). Used to
// convert a nucleation event's `cell` index → an azimuth for stereo pan.
// Every scenario uses 120 (22-geometry-wall), and the strip dataset doesn't
// (yet) carry the value, so crystal azimuth assumes it. If a scenario ever
// overrides cells_per_ring, crystal pan stays spread but its absolute angle
// would scale — acceptable, and noted.
const _STRIP_SONIFY_CELLS_PER_RING = 120;

// Is this the unquantized "raw rock" mode? (the honesty dial's far pole)
function _stripSonifyIsContinuous(scaleId: string): boolean {
  if (scaleId === 'continuous') return true;
  const s = STRIP_SONIFY_SCALES.find((x) => x.id === scaleId);
  return !!s && s.semitones.length === 0;
}

// Continuous (unquantized) value→frequency: v∈0..1 maps smoothly across
// `span` octaves up from scientific octave `baseOctave`. No scale snapping —
// the literal pitch of the chemistry.
function _stripSonifyContinuousFreq(baseOctave: number, span: number, v: number): number {
  const baseMidi = 12 * (baseOctave + 1);             // C(baseOctave) in MIDI
  const midi = baseMidi + Math.max(0, Math.min(1, v)) * span * 12;
  return _stripSonifyMidiToFreq(midi);
}

// Active scale (the dropdown sets this; the convenience players use it
// when the caller doesn't override opts.scaleId). Default pentatonic.
let _stripSonifyScaleId = 'major_pentatonic';

function stripSonifyGetScaleId(): string { return _stripSonifyScaleId; }

// Set the active scale by id (must be a known scale). Returns the id in
// effect afterward.
function stripSonifySetScaleId(id: string): string {
  if (STRIP_SONIFY_SCALES.some((s) => s.id === id)) _stripSonifyScaleId = id;
  return _stripSonifyScaleId;
}

function _stripSonifyScaleSemitones(id: string): number[] {
  const s = STRIP_SONIFY_SCALES.find((x) => x.id === id);
  return s ? s.semitones : STRIP_SONIFY_SCALES[0].semitones;
}

// MIDI note number → frequency (A4 = MIDI 69 = 440 Hz, equal temperament).
function _stripSonifyMidiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Build the ascending frequency table for `semitones` repeated across
// `octaveSpan` octaves starting at scientific octave `baseOctave`
// (so baseOctave=4 starts at C4 = MIDI 60). Returns ascending Hz.
function _stripSonifyScaleFreqs(baseOctave: number, octaveSpan: number, semitones: number[]): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaveSpan; o++) {
    for (const s of semitones) {
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
  baseOctave: number; voiceGain: number; waveform: OscillatorType; hue: number;
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
  return { baseOctave, voiceGain, waveform, hue };
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

// Per step, the chip's VALUE-WEIGHTED angular centroid projected to stereo
// (the boss's "pan from angular position", 2026-06-01). The strip already
// fans the cavity into `angular_indices` sub-strips; this asks "which side
// of the void is this chip leaning toward right now?" and pans the voice
// there. A circular value-weighted mean over the ring, projected to the
// left-right axis as sin(θ̄):
//   pan = Σ_a v_a·sin(θ_a) / Σ_a v_a ,  θ_a = 2π·a/angular_indices
// Uniform chemistry → the sines cancel → 0 (dead center, honest: a
// spatially-uniform field has no side). A lopsided field leans toward the
// loaded side. sin() is the true stereo projection of an azimuth (front and
// back both collapse to center — inherent to 2-channel without HRTF, and
// honest about it). Holds the last value across all-null steps. Returns one
// pan ∈ [-1,1] per step, parallel to the contour.
function _stripSonifyPanContour(ds: StripDataset, chipIdx: number): number[] {
  const ax = ds.manifest.axes;
  const A = Math.max(1, ax.angular_indices);
  const chipCount = ds.manifest.chips.length;
  const out: number[] = [];
  let hold = 0;
  // Precompute the per-sub-strip sin/cos so we don't recompute per step.
  const sinA: number[] = [], cosA: number[] = [];
  for (let a = 0; a < A; a++) { const th = (2 * Math.PI * a) / A; sinA.push(Math.sin(th)); cosA.push(Math.cos(th)); }
  for (let step = 0; step < ax.steps; step++) {
    let sy = 0, sw = 0;
    for (let a = 0; a < A; a++) {
      let sum = 0, n = 0;
      for (let h = 0; h < ax.height_positions; h++) {
        const li = stripDataIndex(step, a, h, chipIdx, ax, chipCount, 0);
        if (li < 0) continue;
        const v = stripDequantizeNormalized(ds.chip_data[li]);
        if (v === null) continue;
        sum += v; n++;
      }
      if (n === 0) continue;
      const va = sum / n;
      sy += va * sinA[a]; sw += va;
    }
    const pan = sw > 1e-9 ? Math.max(-1, Math.min(1, sy / sw)) : hold;
    hold = pan;
    out.push(pan);
  }
  return out;
}

interface StripSonifyPlan {
  notes: { tSec: number; freq: number }[];   // per-step pitch contour (drives freq)
  gates: { tSec: number; durSec: number; sustain?: boolean }[]; // RHYTHM: when the voice sounds (sustain = hold as a drone, not a pluck)
  pans: { tSec: number; pan: number }[];     // per-step stereo position (-1..1 from angular centroid)
  floorNotes?: { tSec: number; freq: number }[];  // DEPLETION VOICE: shadow pitch contour (the floor); absent when there's no depletion to hear
  shadowGains?: { tSec: number; gain: number }[]; // DEPLETION VOICE: per-step shadow gain (0..mix), swells where the broth is drawn down
  glide: boolean;                            // continuous (raw) mode: ramp pitch + sustain, no plucks
  subdiv: number;                            // this voice's rhythmic subdivision (steps/note)
  durationSec: number;
  voiceGain: number;
  waveform: OscillatorType;
  baseOctave: number;
  chipId: string;
  chipLabel: string;
  chipColor: number;
}

// ============================================================
// RHYTHM — give it a pulse (the boss's pick, 2026-05-31)
// ============================================================
// The unmusical part was that the sim's STEP RATE was the NOTE RATE: every
// chip sounded continuously, all changing pitch in lockstep every step.
// Music decouples them — pitch follows the data, but RHYTHM comes from a
// grid + note-density rules. So each voice articulates on its own
// subdivision, fires a note when its pitch CHANGES, and offbeats swing
// slightly. Voices on different subdivisions (set by brightness — bright =
// busy melody, dim = slow pad) interlock into polyrhythm.
//
// LEGATO/DRONE (boss, 2026-06-03 — "a lot of the modes don't play most of
// the even droning lines"): the original made every note a fixed-length
// staccato PLUCK, then rested at silence until the next pitch change. A
// STEADY line changes pitch ~never, so it only got the sparse maxRest
// heartbeat — measured at ~5% sounded for a dim voice in EVERY scale mode
// (vs 100% in continuous). The fix: a note now SUSTAINS until just before
// the next articulation. A held pitch becomes a long drone; a changing pitch
// stays a short articulation. The note-density polyrhythm is preserved (busy
// voices still re-articulate often); only the GAPS are filled with tone
// instead of silence.
const STRIP_RHYTHM = {
  sustainFrac: 0.9,   // a note holds for this fraction of the gap to the next
                      // onset → held pitches drone, changing pitches detach
  swing: 0.12,        // offbeat delay as a fraction of the subdivision
  maxRest: 4,         // re-strike the drone at least every N slots (keeps it alive)
};

// Brightness → rhythmic subdivision (steps per note). Bright/foreground
// voices are busy (fast), dim/background voices are slow — so the color
// hierarchy also drives who's the melody vs the pad. {2,3,4,6} interlock.
function _stripSonifySubdivForVoice(voiceGain: number): number {
  const lum = Math.max(0, Math.min(1, (voiceGain - 0.14) / 0.34)); // invert colorToVoice gain map
  if (lum > 0.75) return 2;
  if (lum > 0.5) return 3;
  if (lum > 0.25) return 4;
  return 6;
}

// ============================================================
// THE DEPLETION VOICE — hear the broth drawn down around the crystals
// ============================================================
// The strip view draws a faint band hanging from a chip's LEVEL line down to
// its FLOOR — "the broth drawn down around the crystals" (format_version 3,
// 2026-06-03). This is the EAR's reading of that same recorded floor_data.
// Alongside the chip's main drone, a soft SHADOW oscillator sounds at the
// FLOOR pitch (the deepest depleted pocket on the wall) — at or BELOW the
// level pitch, since floor ≤ level. It swells where a crystal bites the broth
// hard and stays silent where the broth is uniform, so it SELF-GATES: limiting
// ions (Ag, Cd, F, Sn) sing; abundant ones (Ca, Zn) stay quiet.
//
// WHAT IT KEYS ON — and a deliberate eye/ear split (measured 2026-06-04 via
// tools/sonify-depletion-probe.mjs): the recorded halos are REAL but small in
// ABSOLUTE normalized terms (a limiting ion sits near the bottom of its own
// declared color-range, so a 20-49% local drawdown is only a ~1-10% band
// height). The VISUAL shadow keys on that absolute band — faint for low-
// baseline ions. The VOICE instead keys LOUDNESS on the RELATIVE drawdown
// (depth/level): that's the physical "how hard was this pocket sucked dry,"
// independent of the arbitrary declared range, and it's exactly what separates
// limiting ions (big relative dip) from abundant ones (broth barely dips). An
// absolute noise floor (~1.5 quantization levels) rejects quantization fuzz and
// essentially-absent ions (e.g. mvt SiO2: 12% relative on a ~0 baseline = noise).
// So the eye reads the absolute band; the ear reads the relative hollowing —
// complementary readings of one channel, not a contradiction. PITCH stays
// absolute (the floor's true value), so a deep halo opens a real interval and a
// shallow one just beats faintly under the drone.
//
// HONESTY: floor is RECORDED (floor_data, depth 0 = the wall where crystals
// grow), never synthesized. SIM-NEUTRAL (no engine output touched).
const STRIP_DEPLETION = {
  mix: 0.6,         // shadow PEAK gain as a fraction of the chip's own voice gain
  absNoise: 0.006,  // ignore drawdowns ≤ ~1.5 quantization levels (1 LSB ≈ 0.004) — noise / absent ions
  minRelDip: 0.05,  // relative drawdown (depth/level) below this = uniform broth → silent
  relDipRef: 0.30,  // relative drawdown that reaches full mix (a deep halo, e.g. mvt Cd ≈ 49%)
  detuneCents: 5,   // shadow a few cents FLAT → a faint beat where pitch is near-unison
};

// Is the depletion voice on? Default ON — it self-gates to silence where there
// is no depletion, so it only sings on limiting ions. The toggle lets the ear
// A/B it; flipping it rebuilds plans (a build-time change, like the crystals
// layer), so a live performance restarts to pick it up.
let _stripSonifyDepletionOn = true;
function stripSonifyGetDepletion(): boolean { return _stripSonifyDepletionOn; }
function stripSonifySetDepletion(on: boolean): boolean { _stripSonifyDepletionOn = !!on; return _stripSonifyDepletionOn; }

// Per step, reduce the recorded depletion FLOOR (floor_data, depth 0 = the
// wall) to the DEEPEST pocket anywhere on the wall: the MIN across all angles ×
// heights. A halo is LOCAL (one crystal, a few cells), so averaging — even a
// per-height ring-mean — re-dilutes the very thing the channel exists to show
// (measured: mean-of-ring-min hid mvt Cd's 49% halo as 2%). The single deepest
// cell is what the eye catches as the prominent band, so it's what the ear
// should track. Holds the last valid value across all-null steps so the
// undertone doesn't stutter. Returns null when the dataset carries no floor_data
// (v1/v2) OR this chip never recorded a floor (a non-ion chip the recorder
// skipped → all-255) — so abundant/non-ion chips get no shadow even in v3.
function _stripSonifyFloorSeries(ds: StripDataset, chipIdx: number): number[] | null {
  if (!ds.floor_data) return null;
  const ax = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  const floor: number[] = [];
  let hold = 0.5;
  let any = false;
  for (let step = 0; step < ax.steps; step++) {
    let mn = Infinity;
    for (let h = 0; h < ax.height_positions; h++) {
      for (let a = 0; a < ax.angular_indices; a++) {
        const li = stripDataIndex(step, a, h, chipIdx, ax, chipCount, 0);
        if (li < 0) continue;
        const v = stripDequantizeNormalized(ds.floor_data[li]);
        if (v === null) continue;
        if (v < mn) mn = v;
      }
    }
    if (mn !== Infinity) { hold = mn; any = true; }
    floor.push(mn === Infinity ? hold : mn);
  }
  return any ? floor : null;
}

// (level, floor) → shadow gain MULTIPLIER (0..mix). Gate on the RELATIVE
// drawdown depth/level (honest halo strength, range-independent), with an
// absolute noise floor that rejects quantization fuzz + essentially-absent
// ions. Silent below minRelDip; ramps to full `mix` at relDipRef, saturates.
function _stripSonifyShadowGain(level: number, floor: number): number {
  const depth = level - floor;
  if (depth <= STRIP_DEPLETION.absNoise) return 0;        // ≤ noise floor → nothing real to hear
  const relDip = depth / Math.max(STRIP_DEPLETION.absNoise, level);
  const t = (relDip - STRIP_DEPLETION.minRelDip) / Math.max(1e-6, STRIP_DEPLETION.relDipRef - STRIP_DEPLETION.minRelDip);
  return STRIP_DEPLETION.mix * Math.max(0, Math.min(1, t));
}

// PURE: build the playback plan for one chip of a dataset. No audio.
// Returns null if the chip isn't present or the dataset has no steps.
function buildStripSonifyPlan(
  ds: StripDataset, chipId: string,
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string } = {}
): StripSonifyPlan | null {
  const found = _stripSonifyFindChip(ds, chipId);
  if (!found) return null;
  const steps = ds.manifest.axes.steps | 0;
  if (steps < 1) return null;
  const stepMs = opts.stepDurationMs ?? STRIP_SONIFY_DEFAULTS.stepDurationMs;
  const span = opts.octaveSpan ?? STRIP_SONIFY_DEFAULTS.octaveSpan;
  const scaleId = opts.scaleId ?? _stripSonifyScaleId;
  const continuous = _stripSonifyIsContinuous(scaleId);
  const voice = _stripSonifyColorToVoice(found.meta.color >>> 0);
  const contour = _stripSonifyContour(ds, found.idx);
  const panContour = _stripSonifyPanContour(ds, found.idx);
  const pans = panContour.map((pan, step) => ({ tSec: (step * stepMs) / 1000, pan }));
  const durationSec = (steps * stepMs) / 1000;

  // THE DEPLETION VOICE — read the recorded floor (deepest pocket / step) and
  // turn it into a shadow gain envelope keyed on the RELATIVE drawdown. The
  // shadow exists only when the toggle is on AND some step actually sings
  // (gain > 0) — else hasShadow stays false → no extra voice, byte-for-byte the
  // prior plan on abundant/non-ion chips. floorNotes are filled below alongside
  // the main contour so they share the pitch mapping.
  const floorSeries = _stripSonifyDepletionOn ? _stripSonifyFloorSeries(ds, found.idx) : null;
  const shadowGains = floorSeries
    ? floorSeries.map((f, step) => ({
        tSec: (step * stepMs) / 1000,
        gain: _stripSonifyShadowGain((step < contour.length ? contour[step] : f), f),
      }))
    : null;
  const hasShadow = !!shadowGains && shadowGains.some((g) => g.gain > 0);

  let notes: { tSec: number; freq: number }[];
  let gates: { tSec: number; durSec: number; sustain?: boolean }[];
  let subdiv: number;
  let floorNotes: { tSec: number; freq: number }[] | undefined;

  if (continuous) {
    // RAW ROCK: unquantized log-pitch glide, sustained (no scale, no
    // plucks). One long gate; the player ramps freq between steps (glide).
    notes = contour.map((v, step) => ({
      tSec: (step * stepMs) / 1000,
      freq: _stripSonifyContinuousFreq(voice.baseOctave, span, v),
    }));
    if (hasShadow) {
      floorNotes = floorSeries!.map((v, step) => ({
        tSec: (step * stepMs) / 1000,
        freq: _stripSonifyContinuousFreq(voice.baseOctave, span, v),
      }));
    }
    gates = [{ tSec: 0, durSec: durationSec }];
    subdiv = Math.max(1, steps);
  } else {
    const freqs = _stripSonifyScaleFreqs(voice.baseOctave, span, _stripSonifyScaleSemitones(scaleId));
    // Per-step pitch contour (drives the oscillator frequency).
    const toIdx = (v: number) => Math.max(0, Math.min(freqs.length - 1, Math.round(v * (freqs.length - 1))));
    notes = contour.map((v, step) => ({ tSec: (step * stepMs) / 1000, freq: freqs[toIdx(v)] }));
    // The shadow snaps to the SAME scale (so floor and level form a musical
    // interval, not a microtonal smear); floor ≤ level → it sits at or below.
    if (hasShadow) {
      floorNotes = floorSeries!.map((v, step) => ({ tSec: (step * stepMs) / 1000, freq: freqs[toIdx(v)] }));
    }

    // RHYTHM — PASS 1: walk the grid at this voice's subdivision and collect
    // ONSETS. An onset fires when the pitch index CHANGES, or every maxRest
    // slots so a held drone re-strikes and stays alive. Offbeats swing.
    subdiv = _stripSonifySubdivForVoice(voice.voiceGain);
    const slotMs = subdiv * stepMs;
    const slotSec = slotMs / 1000;
    const onsets: number[] = [];   // tSec of each articulation
    let lastIdx = -1;
    let sinceGate = STRIP_RHYTHM.maxRest;   // force a gate on the first slot
    let slot = 0;
    for (let step = 0; step < steps; step += subdiv, slot++) {
      const idx = toIdx(contour[step]);
      if (idx !== lastIdx || sinceGate >= STRIP_RHYTHM.maxRest) {
        const swingSec = (slot % 2 === 1) ? (STRIP_RHYTHM.swing * slotMs) / 1000 : 0;
        onsets.push((step * stepMs) / 1000 + swingSec);
        lastIdx = idx;
        sinceGate = 0;
      } else {
        sinceGate++;
      }
    }
    // PASS 2: each note SUSTAINS until just before the next onset (legato), so
    // a HELD pitch drones (long note) and a CHANGING pitch detaches (short
    // note) — the boss's "even droning lines should play". The last note holds
    // to the end of the piece. A note longer than ~1.5 slots is flagged
    // `sustain` so the player holds it at level instead of a pluck-decay.
    gates = [];
    for (let i = 0; i < onsets.length; i++) {
      const start = onsets[i];
      const next = (i + 1 < onsets.length) ? onsets[i + 1] : durationSec;
      const durSec = Math.max(0.04, next - start) * STRIP_RHYTHM.sustainFrac;
      gates.push({ tSec: start, durSec, sustain: durSec > slotSec * 1.5 });
    }
  }

  return {
    notes,
    gates,
    pans,
    floorNotes,
    shadowGains: hasShadow ? shadowGains! : undefined,
    glide: continuous,
    subdiv,
    durationSec,
    voiceGain: voice.voiceGain,
    waveform: voice.waveform,
    baseOctave: voice.baseOctave,
    chipId,
    chipLabel: found.meta.label,
    chipColor: found.meta.color >>> 0,
  };
}

type StripSonifyHandle = {
  stop: () => void;
  setVolume: (v: number) => void;
  addVoice: (plan: StripSonifyPlan) => void;     // live-add a chip mid-performance
  removeVoice: (chipId: string) => void;          // live-remove a chip
  setVoices: (plans: StripSonifyPlan[]) => void;  // diff to exactly this set
  setCrystalVolume: (v: number) => void;          // ride the crystal-bell bus live (0..1)
};

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

// Crystal-bell layer volume (0..1) — rides the crystal submix bus only, so
// the percussion can be balanced against the chip drone independently of the
// master. Default 1.0 = the prior fixed mix (bell peak = hit.gain·0.55), so
// existing behavior is unchanged until the slider moves. Persists between
// plays + applies live. (The 🔔 toggle still gates crystals on/off entirely;
// this sets how loud they are when on.)
let _stripSonifyCrystalVolume = 1.0;

function stripSonifyGetCrystalVolume(): number { return _stripSonifyCrystalVolume; }

function stripSonifySetCrystalVolume(v: number): number {
  const vol = Math.max(0, Math.min(1, Number(v)));
  _stripSonifyCrystalVolume = vol;
  if (_stripSonifyHandle) { try { _stripSonifyHandle.setCrystalVolume(vol); } catch (_e) { /* ignore */ } }
  return vol;
}

// Tempo: ms per sim step. The slider sets this; the convenience players
// (stripSonify / stripSonifyMany) use it when the caller doesn't override
// opts.stepDurationMs. Note onsets are scheduled up front, so tempo can't
// be warped mid-note — changing it restarts the performance (the UI does
// that on slider release). Smaller ms = faster.
let _stripSonifyStepDurationMs = STRIP_SONIFY_DEFAULTS.stepDurationMs;

function stripSonifyGetStepDuration(): number { return _stripSonifyStepDurationMs; }

// Set tempo (ms/step), clamped to a musical range. Returns clamped value.
function stripSonifySetStepDuration(ms: number): number {
  const v = Math.max(30, Math.min(800, Number(ms) || STRIP_SONIFY_DEFAULTS.stepDurationMs));
  _stripSonifyStepDurationMs = v;
  return v;
}

// ============================================================
// CRYSTALS AS STRUCK BELLS (the brother's ask, 2026-05-31)
// ============================================================
// The chips are the sustained chemistry drone; the CRYSTALS are the
// percussion over it. Each nucleation_event pings a scale-snapped bell —
// sharp attack, exponential decay — voiced from the mineral's class_color
// + max_size_cm:
//   * color HUE → which scale degree it rings (so it's in key; this is
//     "categorize by color"). color BRIGHTNESS → loudness (the hierarchy).
//   * max_size_cm → register + ring-length: a big selenite blade tolls
//     low and long; a tiny pyrite cube ticks high and short (the bell-vs-
//     chime physics — bigger resonator = lower & longer).
// HONEST GAP: Mohs hardness / luster / crystal-system aren't in the data,
// so "harder = brighter, metallic = clink" isn't possible yet — a future
// per-mineral acoustic table would unlock it. Color + size carry it today.

let _stripSonifyCrystalsOn = true;
function stripSonifyGetCrystals(): boolean { return _stripSonifyCrystalsOn; }
function stripSonifySetCrystals(on: boolean): boolean { _stripSonifyCrystalsOn = !!on; return _stripSonifyCrystalsOn; }

// Resolve a mineral id → its crystal color (int 0xRRGGBB). Prefers the
// renderer's live class_color resolver (topoClassColor → "#rrggbb");
// falls back to mid-grey for unknown minerals / headless.
function _stripSonifyMineralColor(mineral: string): number {
  let hex: any = null;
  try { if (typeof topoClassColor === 'function') hex = topoClassColor(mineral); } catch (_e) { /* ignore */ }
  if (typeof hex === 'string') {
    const n = parseInt(hex.replace('#', ''), 16);
    if (Number.isFinite(n)) return n >>> 0;
  } else if (typeof hex === 'number' && Number.isFinite(hex)) {
    return hex >>> 0;
  }
  return 0x888888;
}

// Resolve a mineral id → its max crystal size (cm) from MINERAL_SPEC.
// Default ~2 cm when unavailable.
function _stripSonifyMineralSize(mineral: string): number {
  try {
    if (typeof MINERAL_SPEC !== 'undefined' && MINERAL_SPEC[mineral]
        && typeof MINERAL_SPEC[mineral].max_size_cm === 'number') {
      return MINERAL_SPEC[mineral].max_size_cm;
    }
  } catch (_e) { /* ignore */ }
  return 2;
}

// Deterministic string hash (FNV-1a) — no Math.random (resume-safe).
function _stripSonifyHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

interface StripCrystalHit {
  tSec: number; freq: number; gain: number; decay: number;
  waveform: OscillatorType; mineral: string;
  pan: number;   // stereo azimuth from the nucleation cell (where in the void it formed)
}

// Build the struck-bell schedule from a dataset's nucleation_events.
// `resolvers` lets tests inject colorOf/sizeOf deterministically; in the
// browser the defaults read the live class_color + max_size_cm.
function buildStripCrystalHits(
  ds: StripDataset,
  opts: { stepDurationMs?: number; scaleId?: string } = {},
  resolvers: { colorOf?: (m: string) => number; sizeOf?: (m: string) => number } = {}
): StripCrystalHit[] {
  const events = (ds && ds.nucleation_events) || [];
  if (!events.length) return [];
  const stepMs = opts.stepDurationMs ?? _stripSonifyStepDurationMs;
  const scaleId = opts.scaleId ?? _stripSonifyScaleId;
  const continuous = _stripSonifyIsContinuous(scaleId);
  const semis = _stripSonifyScaleSemitones(scaleId);
  const colorOf = resolvers.colorOf || _stripSonifyMineralColor;
  const sizeOf = resolvers.sizeOf || _stripSonifyMineralSize;
  const LO = Math.log10(0.5), HI = Math.log10(100);   // size→0..1 over 0.5..100 cm
  const hits: StripCrystalHit[] = [];
  for (const ev of events) {
    if (!ev || typeof ev.step !== 'number') continue;
    const voice = _stripSonifyColorToVoice((colorOf(ev.mineral) >>> 0) || 0x888888);
    const sizeCm = Math.max(0.05, Number(sizeOf(ev.mineral)) || 2);
    const sizeNorm = Math.max(0, Math.min(1, (Math.log10(sizeCm) - LO) / (HI - LO)));
    const octave = Math.max(2, Math.min(6, 5 - Math.round(sizeNorm * 2)));   // small→5, big→3
    // color HUE → pitch. Scale modes snap to a degree; continuous mode maps
    // hue smoothly across ~1.5 octaves above the size octave (honest pole).
    const freq = continuous
      ? _stripSonifyMidiToFreq(12 * (octave + 1) + (voice.hue / 360) * 18)
      : _stripSonifyMidiToFreq(12 * (octave + 1) + semis[Math.min(semis.length - 1, Math.floor((voice.hue / 360) * semis.length))]);
    // Stereo azimuth: where around the ring this crystal nucleated. `cell`
    // is the native cell index (0..cells_per_ring); sin(θ) is the honest
    // stereo projection — you hear the crystal pop in at its position.
    const cell = (ev && Number.isFinite(ev.cell)) ? (ev.cell % _STRIP_SONIFY_CELLS_PER_RING) : 0;
    const pan = Math.max(-1, Math.min(1, Math.sin((2 * Math.PI * cell) / _STRIP_SONIFY_CELLS_PER_RING)));
    hits.push({
      tSec: (ev.step * stepMs) / 1000,
      freq,
      gain: voice.voiceGain,                 // brightness → loudness
      decay: 0.22 + 1.5 * sizeNorm,          // tick (0.22 s) … toll (1.7 s)
      waveform: voice.waveform,
      mineral: ev.mineral,
      pan,
    });
  }
  return hits;
}

// ============================================================
// THE DENDRITE BELL — morph-ordinal slams (fix-backlog 2026-06-12)
// ============================================================
// The morph chips record each registry tenant's growth-regime ordinal
// (0 spiral_smooth … 4 dendritic) at its anchor crystal. When the fluid
// drives a crystal UP that ladder, the strip shows a slam — wittichen's
// bismuth_morph jumps 0→4 on the reducing Eh pulse. This layer RINGS
// it: one anvil strike per upward crossing, voiced by severity. The
// register DROPS as the ordinal climbs (a bigger instability is a
// bigger bell — the same resonator-physics pole as the nucleation
// bells' size→register rule), and the strike pitches are the C-root
// octave ladder so they sit in key under every C-rooted scale mode.
// The DENDRITE arrival (ordinal 4) adds a second partial detuned one
// semitone sharp at the same instant — a deliberately dissonant clang
// that says "interface stability just failed." Healing (downward)
// crossings are silent: recovery is the drone's story, the bell marks
// the shock. Strikes ride the crystal-bell submix bus, so the 🔔🔊
// slider governs all percussion together.
let _stripSonifyMorphBellsOn = true;
function stripSonifyGetMorphBells(): boolean { return _stripSonifyMorphBellsOn; }
function stripSonifySetMorphBells(on: boolean): boolean { _stripSonifyMorphBellsOn = !!on; return _stripSonifyMorphBellsOn; }

// ordinal 1..4 → strike pitch: C5, C4, C3, G2 (the dendrite toll).
const _STRIP_MORPH_SLAM_FREQ = [0, 523.25, 261.63, 130.81, 98.0];

function buildStripMorphSlamHits(
  ds: StripDataset,
  opts: { stepDurationMs?: number } = {}
): StripCrystalHit[] {
  if (!ds || !ds.manifest || !ds.manifest.axes || !ds.manifest.chips) return [];
  const stepMs = opts.stepDurationMs ?? _stripSonifyStepDurationMs;
  const ax = ds.manifest.axes;
  const chips = ds.manifest.chips;
  const C = chips.length;
  const A = Math.max(1, ax.angular_indices);
  const hits: StripCrystalHit[] = [];
  for (let ci = 0; ci < C; ci++) {
    const meta: any = chips[ci];
    if (!meta || typeof meta.id !== 'string' || !/_morph$/.test(meta.id)) continue;
    const lo = (meta.range && meta.range[0]) || 0;
    const hi = (meta.range && meta.range[1]) || 4;
    // prevOrd starts at the smooth floor: a crystal APPEARING already
    // driven (nucleated mid-shock) rings on arrival — that IS the slam.
    let prevOrd = 0;
    for (let step = 0; step < ax.steps; step++) {
      // Sparse-MAX read with position (the strip-digest lesson: morph
      // chips anchor at points, an angle-average reads all-null; and
      // the most driven crystal is the one that should ring).
      let maxV: number | null = null;
      let bestA = 0;
      for (let a = 0; a < A; a++) {
        for (let h = 0; h < ax.height_positions; h++) {
          const li = stripDataIndex(step, a, h, ci, ax, C, 0);
          if (li < 0) continue;
          const v = stripDequantize(ds.chip_data[li], lo, hi);
          if (v == null) continue;
          if (maxV === null || v > maxV) { maxV = v; bestA = a; }
        }
      }
      if (maxV === null) continue;   // chip absent this step — hold prevOrd
      const ord = Math.max(0, Math.min(4, Math.round(maxV)));
      if (ord > prevOrd) {
        const tSec = (step * stepMs) / 1000;
        // pan to where the driven crystal sits (same sin-projection as
        // the nucleation bells' cell azimuth)
        const pan = Math.max(-1, Math.min(1, Math.sin((2 * Math.PI * bestA) / A)));
        const freq = _STRIP_MORPH_SLAM_FREQ[ord];
        hits.push({
          tSec, freq,
          gain: 0.16 + 0.07 * ord,        // deeper slam = harder strike
          decay: 0.3 + 0.18 * ord,        // ...and a longer ring
          waveform: 'square',             // clangy — distinct from the sine/triangle bells
          mineral: meta.id, pan,
        });
        if (ord >= 4) {
          hits.push({
            tSec, freq: freq * 1.0595,    // +1 semitone — the dissonant dendrite clang
            gain: 0.12, decay: 0.55, waveform: 'square', mineral: meta.id, pan,
          });
        }
      }
      prevOrd = ord;
    }
  }
  return hits;
}

// Build plans for several chips at once (skips any not in the dataset).
function buildStripSonifyPlans(
  ds: StripDataset, chipIds: string[],
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string } = {}
): StripSonifyPlan[] {
  const out: StripSonifyPlan[] = [];
  for (const id of chipIds) {
    const p = buildStripSonifyPlan(ds, id, opts);
    if (p) out.push(p);
  }
  return out;
}

// PLAYER: schedule one OR MORE plans as layered voices on a shared
// timeline, with LIVE voice add/remove. Each plan is one continuous
// oscillator whose frequency jumps per step (setValueAtTime — the
// "stepped theremin"); its per-voice gain comes from the chip color
// (brightness → loudness, THE hierarchy), scaled by 1/sqrt(voiceCount)
// so a dense selection sums without clipping. All voices feed a master
// gain set by the volume slider.
//
// LIVE TOGGLING: every voice schedules its FULL contour relative to the
// shared t0. Adding a voice mid-performance starts its oscillator NOW but
// references the same t0, so its past step-events are already applied and
// it joins at the correct CURRENT pitch — in sync with the others. The
// per-voice gain fades in/out (setTargetAtTime) so toggling is smooth, and
// every add/remove rescales the surviving voices to keep the mix bounded.
//
// A silent timer oscillator runs the full duration and fires onEnded, so
// the performance ends cleanly regardless of which voices come and go.
// Browser-only; returns null headless.
function playStripSonifyPlans(
  plans: StripSonifyPlan[], onEnded?: () => void, crystalHits: StripCrystalHit[] = []
): StripSonifyHandle | null {
  const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  if (typeof AC !== 'function') return null;
  if (!plans.length && !crystalHits.length) return null;
  stripSonifyStop();

  const ctx = new AC();
  // Browsers create the context suspended until a user gesture; the Play
  // click IS that gesture, so resume immediately.
  try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch (_e) { /* ignore */ }

  const master = ctx.createGain();
  master.gain.value = _stripSonifyMasterVolume;
  master.connect(ctx.destination);

  // Crystal-bell submix bus — all bells feed this, it feeds master. Lets the
  // crystal-volume slider ride the percussion layer independently of the chip
  // drone (and live, like master). Default 1.0 → byte-for-byte the prior mix.
  const crystalBus = ctx.createGain();
  crystalBus.gain.value = _stripSonifyCrystalVolume;
  crystalBus.connect(master);

  const t0 = ctx.currentTime + 0.06;
  let durationSec = 0.2;
  for (const p of plans) if (p.durationSec > durationSec) durationSec = p.durationSec;
  // Crystal bells can ring past the last chip step — extend the end so the
  // last toll isn't cut off.
  for (const h of crystalHits) { const e = h.tSec + h.decay; if (e > durationSec) durationSec = e; }
  const endTime = t0 + durationSec;

  // chipId → { osc, lvlGain, plan, shOsc? }. Per voice: osc → artGain (rhythm
  // plucks) → lvlGain (structural level, rescale-adjusted) → master. The
  // DEPLETION VOICE (shOsc) is a second oscillator that shares lvlGain (so it
  // pans + rescales with the main voice) but bypasses artGain — a sustained
  // undertone, not a plucked note.
  const voices = new Map<string, { osc: any; lvlGain: any; plan: StripSonifyPlan; shOsc?: any }>();

  // Re-target every voice's LEVEL for the current voice count (keeps the
  // summed mix bounded as voices come and go). Rhythm lives on artGain.
  const rescale = () => {
    const scale = 1 / Math.sqrt(Math.max(1, voices.size));
    const now = ctx.currentTime;
    for (const v of voices.values()) {
      try { v.lvlGain.gain.setTargetAtTime(v.plan.voiceGain * scale, now, 0.04); } catch (_e) { /* ignore */ }
    }
  };

  const addVoiceInternal = (plan: StripSonifyPlan) => {
    if (voices.has(plan.chipId)) return;
    const osc = ctx.createOscillator();
    const artGain = ctx.createGain();   // rhythm — plucks up per gate, rests at 0
    const lvlGain = ctx.createGain();   // structural level (rescale-adjusted)
    osc.type = plan.waveform;
    // Stereo placement (where this chip leans in the void). Guarded:
    // jsdom / old browsers lack createStereoPanner → fall back to mono.
    const panner = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
    if (panner) {
      osc.connect(artGain).connect(lvlGain).connect(panner).connect(master);
      if (plan.pans && plan.pans.length) {
        try { panner.pan.setValueAtTime(plan.pans[0].pan, t0); } catch (_e) { /* ignore */ }
        for (const pp of plan.pans) { try { panner.pan.setValueAtTime(pp.pan, t0 + pp.tSec); } catch (_e) { /* ignore */ } }
      }
    } else {
      osc.connect(artGain).connect(lvlGain).connect(master);
    }
    const now = ctx.currentTime;
    if (plan.glide) {
      // RAW ROCK (continuous): smooth pitch glide + sustained tone, no
      // plucks. Frequency ramps between steps; the voice just sings.
      if (plan.notes.length) { try { osc.frequency.setValueAtTime(plan.notes[0].freq, t0); } catch (_e) { /* ignore */ } }
      for (const n of plan.notes) { try { osc.frequency.linearRampToValueAtTime(n.freq, t0 + n.tSec); } catch (_e) { /* ignore */ } }
      artGain.gain.setValueAtTime(0.0001, Math.max(now, t0 - 0.001));
      artGain.gain.linearRampToValueAtTime(1, t0 + 0.08);                  // fade in, then hold
      try { artGain.gain.setValueAtTime(1, Math.max(t0 + 0.1, endTime - 0.1)); } catch (_e) { /* ignore */ }
      try { artGain.gain.linearRampToValueAtTime(0.0001, endTime); } catch (_e) { /* ignore */ }
    } else {
      // Stepped "theremin": frequency jumps per step; staccato plucks.
      if (plan.notes.length) { try { osc.frequency.setValueAtTime(plan.notes[0].freq, t0); } catch (_e) { /* ignore */ } }
      for (const n of plan.notes) { try { osc.frequency.setValueAtTime(n.freq, t0 + n.tSec); } catch (_e) { /* ignore */ } }
      // Rhythm: artGain rests at ~0 and plucks for each gate (staccato).
      artGain.gain.setValueAtTime(0.0001, Math.max(now, t0 - 0.001));
      for (const gt of plan.gates) {
        const ts = t0 + gt.tSec;
        if (ts < now - 0.02) continue;                       // skip gates already past (live add)
        const dur = Math.max(0.04, gt.durSec);
        const attack = Math.min(0.012, dur * 0.4);
        try {
          artGain.gain.setValueAtTime(0.0001, ts);
          artGain.gain.linearRampToValueAtTime(1, ts + attack);
          if (gt.sustain) {
            // DRONE: hold near full for the body of the note, then a short
            // release — so a steady ("even") line actually sustains instead
            // of decaying to silence like a pluck (the boss's 2026-06-03 ask).
            const release = Math.min(0.12, dur * 0.3);
            artGain.gain.setValueAtTime(1, ts + Math.max(attack, dur - release));
            artGain.gain.exponentialRampToValueAtTime(0.0001, ts + dur);
          } else {
            artGain.gain.exponentialRampToValueAtTime(0.0001, ts + dur);   // pluck: attack → decay
          }
        } catch (_e) { /* ignore */ }
      }
    }
    // THE DEPLETION VOICE — a soft shadow oscillator at the FLOOR pitch,
    // swelling where the broth is drawn down (plan.shadowGains). Shares lvlGain
    // (→ panner → master), so it pans with the chip and rescales with the voice
    // count; bypasses artGain (no plucking — it's a sustained undertone). Sine
    // + a few cents FLAT → a faint beat where the gap is small, an open interval
    // where the depletion is deep. Silent on abundant ions (shadowGains ≈ 0);
    // absent entirely when the dataset has no floor_data. Mirrors the visual
    // shadow band the renderer hangs below the level line.
    let shOsc: any = null;
    if (plan.floorNotes && plan.floorNotes.length && plan.shadowGains && plan.shadowGains.length) {
      shOsc = ctx.createOscillator();
      const shGain = ctx.createGain();
      shOsc.type = 'sine';
      shOsc.connect(shGain).connect(lvlGain);
      try { shOsc.detune.setValueAtTime(-STRIP_DEPLETION.detuneCents, t0); } catch (_e) { /* ignore */ }
      // Pitch contour mirrors the main voice's mode: glide ramps, scale steps.
      try { shOsc.frequency.setValueAtTime(plan.floorNotes[0].freq, t0); } catch (_e) { /* ignore */ }
      for (const n of plan.floorNotes) {
        try {
          if (plan.glide) shOsc.frequency.linearRampToValueAtTime(n.freq, t0 + n.tSec);
          else shOsc.frequency.setValueAtTime(n.freq, t0 + n.tSec);
        } catch (_e) { /* ignore */ }
      }
      // Gain breathes with the depletion depth (smooth ramps → swell/recede,
      // not a stutter). Starts at its first value so a live-add joins in place.
      try { shGain.gain.setValueAtTime(Math.max(0.0001, plan.shadowGains[0].gain), Math.max(now, t0 - 0.001)); } catch (_e) { /* ignore */ }
      for (const sg of plan.shadowGains) {
        try { shGain.gain.linearRampToValueAtTime(Math.max(0.0001, sg.gain), t0 + sg.tSec); } catch (_e) { /* ignore */ }
      }
      try { shOsc.start(t0 > now ? t0 : now); } catch (_e) { /* ignore */ }
      try { shOsc.stop(endTime + 0.05); } catch (_e) { /* ignore */ }
    }
    lvlGain.gain.setValueAtTime(0, now);       // rescale() ramps it up to target
    try { osc.start(t0 > now ? t0 : now); } catch (_e) { /* ignore */ }
    try { osc.stop(endTime + 0.05); } catch (_e) { /* ignore */ }
    voices.set(plan.chipId, { osc, lvlGain, plan, shOsc });
  };

  for (const p of plans) addVoiceInternal(p);
  rescale();

  // Silent end-timer — survives voice churn and marks the true end.
  const timer = ctx.createOscillator();
  const tg = ctx.createGain();
  tg.gain.value = 0;
  timer.connect(tg).connect(master);
  try { timer.start(t0); timer.stop(endTime + 0.06); } catch (_e) { /* ignore */ }

  // Crystal bells — one short struck-tone oscillator per nucleation: sharp
  // attack, exponential decay. They feed the crystalBus (→ master), so the
  // crystal-volume slider rides them as a layer AND the master slider still
  // rides everything. Independent of the chip selection — a separate layer.
  const crystalOscs: any[] = [];
  for (const hit of crystalHits) {
    const tHit = t0 + hit.tSec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = hit.waveform;
    try { osc.frequency.setValueAtTime(hit.freq, tHit); } catch (_e) { /* ignore */ }
    // Pan to where the crystal nucleated around the ring (guarded → mono).
    const panner = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
    if (panner) {
      osc.connect(g).connect(panner).connect(crystalBus);
      try { panner.pan.setValueAtTime(hit.pan || 0, tHit); } catch (_e) { /* ignore */ }
    } else {
      osc.connect(g).connect(crystalBus);
    }
    const peak = Math.max(0.0001, hit.gain * 0.55);   // sits under the drone
    g.gain.setValueAtTime(0.0001, tHit);
    g.gain.linearRampToValueAtTime(peak, tHit + 0.005);                    // sharp attack
    g.gain.exponentialRampToValueAtTime(0.0001, tHit + Math.max(0.05, hit.decay)); // bell decay
    try { osc.start(tHit); osc.stop(tHit + Math.max(0.05, hit.decay) + 0.05); } catch (_e) { /* ignore */ }
    crystalOscs.push(osc);
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try { ctx.close(); } catch (_e) { /* ignore */ }
    if (_stripSonifyHandle === handle) _stripSonifyHandle = null;
    if (onEnded) { try { onEnded(); } catch (_e) { /* ignore */ } }
  };
  timer.onended = finish;

  const handle: StripSonifyHandle = {
    stop() {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
        master.gain.linearRampToValueAtTime(0, now + 0.06);
        for (const v of voices.values()) {
          try { v.osc.stop(now + 0.08); } catch (_e) { /* ignore */ }
          if (v.shOsc) { try { v.shOsc.stop(now + 0.08); } catch (_e) { /* ignore */ } }
        }
        for (const o of crystalOscs) { try { o.stop(now + 0.08); } catch (_e) { /* ignore */ } }
        try { timer.stop(now + 0.08); } catch (_e) { /* ignore */ }
      } catch (_e) { /* ignore */ }
      finish();
    },
    setVolume(v: number) {
      try { master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.03); } catch (_e) { /* ignore */ }
    },
    setCrystalVolume(v: number) {
      try { crystalBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.03); } catch (_e) { /* ignore */ }
    },
    addVoice(plan: StripSonifyPlan) {
      if (done || voices.has(plan.chipId)) return;
      addVoiceInternal(plan);
      rescale();
    },
    removeVoice(chipId: string) {
      const v = voices.get(chipId);
      if (!v) return;
      const now = ctx.currentTime;
      try { v.lvlGain.gain.cancelScheduledValues(now); v.lvlGain.gain.setTargetAtTime(0, now, 0.04); } catch (_e) { /* ignore */ }
      try { v.osc.stop(now + 0.2); } catch (_e) { /* ignore */ }
      if (v.shOsc) { try { v.shOsc.stop(now + 0.2); } catch (_e) { /* ignore */ } }
      voices.delete(chipId);
      rescale();
    },
    setVoices(newPlans: StripSonifyPlan[]) {
      const want = new Set(newPlans.map((p) => p.chipId));
      for (const id of Array.from(voices.keys())) if (!want.has(id)) this.removeVoice(id);
      for (const p of newPlans) if (!voices.has(p.chipId)) this.addVoice(p);
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

// The current module-default opts (tempo + scale), overridable by caller.
function _stripSonifyDefaultOpts(
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string }
): { stepDurationMs: number; scaleId: string; octaveSpan?: number } {
  return { stepDurationMs: _stripSonifyStepDurationMs, scaleId: _stripSonifyScaleId, ...opts };
}

// Convenience: build + play one chip.
function stripSonify(
  ds: StripDataset, chipId: string,
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string } = {},
  onEnded?: () => void
): StripSonifyHandle | null {
  const plan = buildStripSonifyPlan(ds, chipId, _stripSonifyDefaultOpts(opts));
  if (!plan) return null;
  return playStripSonifyPlans([plan], onEnded);
}

// Convenience: build + play several chips layered — color sets each
// voice's place in the mix. This is "play exactly what's selected."
function stripSonifyMany(
  ds: StripDataset, chipIds: string[],
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string } = {},
  onEnded?: () => void
): StripSonifyHandle | null {
  const o = _stripSonifyDefaultOpts(opts);
  const plans = buildStripSonifyPlans(ds, chipIds, o);
  const hits = _stripSonifyCrystalsOn ? buildStripCrystalHits(ds, o) : [];
  // The dendrite bell — morph-ordinal slam strikes layer onto the same
  // percussion bus as the nucleation bells (one volume rides both).
  const slams = _stripSonifyMorphBellsOn ? buildStripMorphSlamHits(ds, o) : [];
  if (!plans.length && !hits.length && !slams.length) return null;
  return playStripSonifyPlans(plans, onEnded, hits.concat(slams));
}

// LIVE: if a performance is playing, update its voice set to exactly
// `chipIds` (using the current tempo + scale) — adding/removing voices
// without restarting. No-op if nothing is playing. This is what the chip
// selector calls when you toggle an element on/off mid-performance.
function stripSonifyUpdateVoices(
  ds: StripDataset, chipIds: string[],
  opts: { stepDurationMs?: number; octaveSpan?: number; scaleId?: string } = {}
): void {
  if (!_stripSonifyHandle) return;
  const plans = buildStripSonifyPlans(ds, chipIds, _stripSonifyDefaultOpts(opts));
  try { _stripSonifyHandle.setVoices(plans); } catch (_e) { /* ignore */ }
}
