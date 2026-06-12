// tools/strip-digest-shape.mjs — pure strip-digest computation, SHARED by the
// generator (tools/gen-strip-digest.mjs, Node) and the tripwire test
// (tests-js/strip-digest.test.ts, vitest). One source of truth for the digest
// shape so the two can never drift apart.
//
// WHAT THE DIGEST IS. A compact, human-diffable fingerprint of a scenario's
// per-cell chemistry TRAJECTORY (what the strip recorder captures), for a few
// key carbonate chips at wall + center depth. It is a TRIPWIRE: it pins
// "trajectory unchanged from the recorded build," NOT "correct per science."
// A mismatch means the chemistry path moved — go look — even when final
// crystal counts (the calibration baseline) didn't budge. Drift handling
// mirrors the crystal baseline: regenerate + inspect the diff on any change
// that legitimately shifts the trajectory (engine OR recording-layer, e.g. a
// chip-read change like the f_ord fix — those don't bump SIM_VERSION but DO
// move the digest, and the test correctly flags them).
//
// The codec functions (stripDataIndex, stripDequantize) are injected so this
// module has no dependency on the bundle or on jsdom — it's pure data work.

// Curated, best-data scenarios (kinetic dolomite + kinetic dissolution +
// equilibrium cooling + MVT). Intentionally NOT all scenarios — the
// all-scenarios contract sweep is a separate effort (each needs its data
// re-checked). The generator skips any not registered in the build.
export const STRIP_DIGEST_SCENARIOS = [
  'sabkha_dolomitization',
  'reactive_wall',
  'cooling',
  'mvt',
  'tutorial_travertine',
  // v161: searles_lake added with the evaporite family in mind. Its digest
  // pins the `concentration` cycle (the rewetting fix — ramp ×3 on drying,
  // reset to 1.0 on the fresh_pulse flood); a regression to the one-way
  // ratchet would move the wall samples and trip this tripwire.
  'searles_lake',
  // supergene_oxidation (Tsumeb gossan): a clean, cold, oxidizing supergene
  // trajectory — the acid window (pH dip), the carbonate ramp (DIC), calcite
  // undersaturation. NOT bisbee: bisbee's T is contaminated by the ungated
  // ambient_cooling thermal-pulse mechanic (flagged for review), so its
  // trajectory may legitimately move when that's addressed — held out of the
  // tripwire until then; its contract pins only the robust event-driven signals.
  'supergene_oxidation',
  // v166: the three sulfate-family scenarios newly SI-legible after v164/v165
  // wired the sulfate Ksp engine + chips. Each pins headline-mineral
  // saturation as well as ions/pH/T:
  //   naica_geothermal — SI_selenite hovers ~−0.2 (giant-crystal slow-growth)
  //   sicily_solfifera — SI_celestine ramps +0.46 → +0.86 (continuous precip)
  //   sulphur_bank     — SI_selenite stays deeply undersat (NOT a sulfate-
  //                       forming system; the acid-spring pH crash is the
  //                       headline; SI here tells the negative story)
  'naica_geothermal',
  'sicily_solfifera',
  'sulphur_bank',
];

// Key carbonate-system chips + the evaporite driver. Always present in the
// manifest (the recorder bakes every _HELIX_CHEM_PARAMS chip); may be flat in
// scenarios that don't exercise them, which is itself worth pinning (e.g.
// `concentration` stays 1.0 wherever no ring ever dries — a guard that a
// non-evaporite scenario never spuriously concentrates).
export const STRIP_DIGEST_CHIPS = [
  'SI_calcite', 'SI_dolomite', 'SI_aragonite', 'pH', 'DIC', 'f_ord', 'concentration',
  // v166: sulfate SI chips (v164 engine, v165 chip wiring) — the four
  // simple-sulfate Ksp dispatch (selenite/anhydrite/barite/celestine).
  // Each may be flat or NaN in scenarios that don't carry the right ion
  // (e.g., SI_barite is NaN where Ba≤0); the digest captures that gap
  // explicitly, which is itself a regression guard.
  'SI_selenite', 'SI_anhydrite', 'SI_barite', 'SI_celestine',
  // Morphology-generalization arc (2026-06-12): the morph-regime chips
  // (Sunagawa severity ordinal 0–4, sparse/null where no living tagged
  // crystal sits in the bin). halite_morph in searles_lake is the
  // tripwire's sharpest new pin: it must co-pulse with `concentration`
  // (hopper ordinal 3 exactly on the wet/dry spikes — the σ-plateau
  // stratification in RESEARCH-halide-morphology-2026-06-12.md §1).
  // calcite_morph rides along to pin the carbonate regime trajectories
  // (sabkha hopper, travertine/mvt smooth) that were previously only
  // test-pinned at end-state.
  'calcite_morph', 'halite_morph', 'sylvite_morph',
];

const SAMPLE_COUNT = 8;
const round3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

// Averaged-over-angle series at (mid ring, given depth). (number|null)[].
function seriesAt(ds, chipId, depth, deps) {
  const { stripDataIndex, stripDequantize } = deps;
  const axes = ds.manifest.axes;
  const C = ds.manifest.chips.length;
  const idx = ds.manifest.chips.findIndex((c) => c.id === chipId);
  if (idx < 0) return null;
  const meta = ds.manifest.chips[idx];
  const height = axes.height_positions >> 1;
  const out = [];
  for (let step = 0; step < axes.steps; step++) {
    let sum = 0, n = 0;
    for (let a = 0; a < axes.angular_indices; a++) {
      const li = stripDataIndex(step, a, height, idx, axes, C, depth);
      if (li < 0) continue;
      const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
      if (v != null) { sum += v; n++; }
    }
    out.push(n ? sum / n : null);
  }
  return out;
}

// SPARSE crystal-anchored chips (the morph ordinals): null everywhere
// except within ±2 cells of a living tagged crystal's anchor, so the
// mid-ring angle-AVERAGE above digests to all-null (searles halite
// anchors on the evaporite floor ring, not mid-wall — found at first
// regen, 2026-06-12). For these, the trajectory worth pinning is the
// SEVEREST regime visible ANYWHERE per step — max over angle × height —
// which is the pan pulse itself (banded 1 ↔ hopper 3 on the wet/dry
// concentration spikes).
const STRIP_DIGEST_SPARSE_MAX_CHIPS = new Set(['calcite_morph', 'halite_morph', 'sylvite_morph']);

function seriesMaxAt(ds, chipId, depth, deps) {
  const { stripDataIndex, stripDequantize } = deps;
  const axes = ds.manifest.axes;
  const C = ds.manifest.chips.length;
  const idx = ds.manifest.chips.findIndex((c) => c.id === chipId);
  if (idx < 0) return null;
  const meta = ds.manifest.chips[idx];
  const out = [];
  for (let step = 0; step < axes.steps; step++) {
    let best = null;
    for (let h = 0; h < axes.height_positions; h++) {
      for (let a = 0; a < axes.angular_indices; a++) {
        const li = stripDataIndex(step, a, h, idx, axes, C, depth);
        if (li < 0) continue;
        const v = stripDequantize(ds.chip_data[li], meta.range[0], meta.range[1]);
        if (v != null && (best == null || v > best)) best = v;
      }
    }
    out.push(best);
  }
  return out;
}

// Reduce a series to {min, max, samples[SAMPLE_COUNT]} — endpoints included,
// evenly spaced, rounded to 3 decimals. The samples carry the trajectory
// SHAPE (diffable); min/max catch peaks between samples.
function reduceSeries(s) {
  const defined = s.filter((v) => v != null);
  const min = defined.length ? Math.min(...defined) : null;
  const max = defined.length ? Math.max(...defined) : null;
  const L = s.length;
  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const idx = (SAMPLE_COUNT === 1) ? 0 : Math.round((i * (L - 1)) / (SAMPLE_COUNT - 1));
    samples.push(round3(s[idx]));
  }
  return { min: round3(min), max: round3(max), samples };
}

/**
 * Compute the digest for one finalized StripDataset.
 * @param {object} ds   finalized StripDataset (manifest + chip_data)
 * @param {object} deps { stripDataIndex, stripDequantize }
 * @returns {object} { steps, depth_positions, chips: { [chipId]: { wall, center? } } }
 */
export function stripDigestForDataset(ds, deps) {
  const D = (ds.manifest.axes.depth_positions && ds.manifest.axes.depth_positions > 0)
    ? ds.manifest.axes.depth_positions : 1;
  const out = { steps: ds.manifest.axes.steps, depth_positions: D, chips: {} };
  for (const chip of STRIP_DIGEST_CHIPS) {
    const sparse = STRIP_DIGEST_SPARSE_MAX_CHIPS.has(chip);
    const wall = sparse ? seriesMaxAt(ds, chip, 0, deps) : seriesAt(ds, chip, 0, deps);
    if (!wall) continue;
    const entry = { wall: reduceSeries(wall) };
    // Sparse chips skip the center read: crystals anchor on the wall;
    // interior voxels never carry a morph ordinal.
    if (D > 1 && !sparse) {
      const center = seriesAt(ds, chip, D - 1, deps);
      if (center) entry.center = reduceSeries(center);
    }
    out.chips[chip] = entry;
  }
  return out;
}
