# archive/strips — the story of the canonical seed-42 vugg

One folder per SIM_VERSION, one file per scenario: the full strip record
of that version's canonical (seed 42) run. This is the vugg's life story
as the strip view draws it and the sonifier plays it — every chip's
complete per-step chemistry trajectory plus every nucleation event (the
bells) — kept as a permanent record rather than regenerated and thrown
away at each rebake.

Boss directive (2026-06-12): "we should be keeping them as a record of
the story of the canonical seed 42 vugg." The species-count baselines
(tests-js/baselines/seed42_v*.json) record what the vugg ENDED as; the
strip digest (strip_digest_v*.json) is an 8-sample tripwire over 12
scenarios. Neither is the story. These files are.

The archive preserves each version AS IT WAS, errors included. v194's
mvt story carries acanthite and native-silver bells that v195 removed as
a confabulation (Tri-State is diagnostically silver-poor) — that is the
correct content of the v194 record, not a defect in it. Do not
regenerate old folders; a version's story is written once.

## Format (`strip-story-v1`)

Per file: `{ format, sim_version, scenario, seed, steps,
depth_positions, chips, nucleation_events }`.

- `chips[id]` — label/system/units/range plus the FULL step series in
  real units (round-3), reduced from the raw recorder volume:
  - dense chips: `wall` and `center` series, angle-averaged at
    mid-height (`read: mean_over_angle_at_mid_height`); `center` is the
    literal string `"same_as_wall"` when byte-identical (most chemistry
    is depth-uniform);
  - sparse crystal-anchored morph ordinals: `wall` only, max over
    angle×height (`read: max_over_angle_height`) — same conventions as
    tools/strip-digest-shape.mjs.
- `nucleation_events` — verbatim from the recorder.
- Dropped: the angular×height spatial texture and floor_data. The
  temporal narrative is complete.

## Workflow

`node tools/gen-strip-archive.mjs` AFTER the SIM_VERSION bump (the
folder is named from the current version; the tool refuses to overwrite
an existing folder without `--force`). Part of the standard rebake
ritual alongside gen-js-baseline + gen-strip-digest.

## Comparing stories

`tools/strip-archive-diff.mjs` overlays two versions of a scenario and
shows where they vary — which chip trajectories diverged (ranked by
max|Δ| with the step it peaks), an ASCII overlay, and the nucleation
bells gained/dropped:

```
node tools/strip-archive-diff.mjs 194 195 mvt            # text report + sparkline overlay
node tools/strip-archive-diff.mjs 194 195 mvt --chip Ag  # drill into one chip (full Δ table)
node tools/strip-archive-diff.mjs 194 195 mvt --html     # interactive overlay → .strip-diffs/ (gitignored)
node tools/strip-archive-diff.mjs 194 195 --all          # fleet sweep: loudest chip + bell delta per scenario
```

The v194→v195 mvt diff is the canonical demo: the `Ag` chip drops from a
full trajectory to flat zero and the bell table reads
`−4 acanthite, −4 native_silver` — the silver de-confabulation, made
visible.
