# PROPOSAL: Habit-Driven Edge Textures on the Wall Profile

**Author:** Stone Philosopher (drafted with Claude)
**Date:** 2026-04-22
**Status:** Proposal for builder

---

## Overview

The Wall Profile (topo-canvas) currently paints each occupied cell as a smooth Bezier-bounded wedge filled in the mineral's class colour. Geologically, the inner edge of that wedge — the surface facing the void — IS the crystal-fluid interface. It's the only edge of the crystal that would actually be visible to a person looking into the vug. Every other edge is buried in adjacent crystal mass.

The proposal: replace the flat-fill inner edge with a **textured polyline whose pattern is dispatched from the crystal's habit**. Pyrite cubes get repeating Vs. Dogtooth calcite gets sharp tall triangles. Dolomite gets curved-shoulder saddle rhombs (the diagnostic signature). Botryoidal chrysocolla gets bumpy half-circles. Aragonite cyclic twins get pseudo-hex peaks.

Evocative, not literal. Same spirit as the groove and the wall outline — the simulator stays symbolic rather than trying to render crystals photographically — but the symbol now carries habit information, not just colour.

---

## Why Now

After Round 3 (carbonates, Kim-2023 dolomite kinetics) the simulator can distinguish ordered dolomite from disordered protodolomite, scalenohedral from rhombohedral calcite, columnar from cyclic-twinned aragonite — but only in the crystal descriptor strings. On the Wall Profile they all paint as undifferentiated coloured wedges. The chemistry-driven habit dispatch already happens at growth time (`grow_aragonite`, `grow_calcite`, `grow_dolomite`); the renderer just doesn't consume the habit string.

Edge textures convert the existing habit-dispatch chain into a visible signal at zero physics cost.

---

## Design

### The dispatch

One new field per mineral spec: `edge_texture: string`, drawn from a closed enum (initial set of ~17 templates below). Default lives on the mineral entry; each `habit_variants[]` entry can override.

Dispatch is **(mineral, habit) → texture**:

- calcite default `dogtooth` → habit `rhombohedral` overrides to `rhomb`
- aragonite default `prismatic_hex` → habit `twinned_cyclic` overrides to `cyclic_twin_hex`, habit `flos_ferri` overrides to `flos_ferri`, habit `acicular_needle` overrides to `acicular`
- dolomite default `saddle_rhomb` → habit `coarse_rhomb` overrides to `rhomb`, habit `massive` overrides to `smooth`
- pyrite default `cube_edge` → habit `pyritohedron` overrides to `pyritohedron_edge`, habit `framboid` overrides to `botryoidal`

This piggybacks the Mg/Ca-driven, σ-driven, and trace-element-driven habit selection that the grow functions already perform. Renderer reads `cell.crystal_id → crystal.habit`, looks up the texture, draws.

### The texture enum

Initial set covering the existing 51 minerals:

| token | shape | typical minerals |
|---|---|---|
| `smooth` | the existing Bezier (no change) | chalcedony, opal, massive forms, obsidian glass-feel |
| `dogtooth` | sharp tall isoceles triangles, ~3:1 height:base | calcite scalenohedral |
| `rhomb` | broad 60°-shouldered triangles, ~1:2 height:base | calcite rhombohedral, coarse-rhomb dolomite |
| `saddle_rhomb` | rhombs with curved (concave) sides | dolomite — diagnostic |
| `cube_edge` | regular Vs, 90° peaks, equal pitch | pyrite cube, galena, halite, fluorite cube |
| `pyritohedron_edge` | irregular pentagonal peaks | pyrite striated/pyritohedron |
| `octahedral` | sharper diamond peaks, ~2:1 height:base | fluorite octahedron, magnetite, spinel |
| `prismatic_hex` | flat-top trapezoids in series | quartz, beryl, apatite |
| `acicular` | many tall thin spikes, density ~6/mm | marcasite, stibnite, erythrite, annabergite |
| `bladed` | tilted thin rectangles | kyanite, bladed selenite, wurtzite |
| `tabular` | thin parallel ridges along the edge | mica, gypsum tabular, barite tabular |
| `botryoidal` | bumpy half-circles, smooth join | chrysocolla, malachite, hematite, framboidal pyrite |
| `spherulitic` | radial fan of fine lines from a centre | wavellite, mesolite, zeolite spherulites |
| `dendritic` | branching L-system, depth 2 | native copper, manganese-oxide dendrites |
| `fibrous` | many tiny equal hairs | satin spar selenite, asbestos |
| `drusy` | many small equal triangles, density ~10/mm | microcrystalline druse, late-stage quartz veneer |
| `flos_ferri` | wavy curls, sinusoidal with random phase | aragonite flos_ferri |
| `cyclic_twin_hex` | pseudo-hexagonal 6-pointed star inscribed | twinned aragonite, Japan-law twinned quartz |

Each template is a pure function:

```
(arcStartXY, arcEndXY, arcMidXY, normalDir, amplitudeMm, pitchMm, mmToPx) → polyline
```

### Per-crystal, not per-cell

The current wedge loop (line 14650) is per-cell. Two adjacent cells painted by the same crystal each get their own outer Bezier and share boundary radii so the band stays continuous. **A textured inner edge with per-cell anchoring will reset the tooth phase at every cell boundary**, producing visible seams every 5° on a single crystal that paints 8 contiguous cells.

Fix: refactor the inner-edge pass to run per crystal. Sketch:

```js
// Group occupied cells by crystal_id
const byCrystal = new Map();
for (let i = 0; i < N; i++) {
  const cid = ring0[i].crystal_id;
  if (cid == null) continue;
  if (!byCrystal.has(cid)) byCrystal.set(cid, []);
  byCrystal.get(cid).push(i);
}

// For each crystal, draw outer fill per-cell (existing logic, unchanged)
// then draw ONE textured inner edge spanning its full cell list
for (const [cid, cells] of byCrystal) {
  drawTexturedInnerEdge(crystal, cells, ring0, /* ... */);
}
```

The outer-edge fill loop stays per-cell (it interlocks with the wall outline pass). Only the inner edge needs the change.

### Amplitude scaling

Tooth height in mm is the smaller of:
- physical: `thickness_mm × habit_amplitude_factor` (don't draw teeth taller than the crystal is thick)
- geometric: `MAX_AMPLITUDE_FRAC × cell_arc_mm` (don't crash teeth into the wedge boundary)

`MAX_AMPLITUDE_FRAC ≈ 0.45`. `habit_amplitude_factor` lives on the texture template — drusy is `0.1` (tiny), dogtooth is `0.6` (tall), bladed is `0.9` (very tall).

Pitch (tooth spacing in mm) is also per-template: dogtooth ~0.8mm, drusy ~0.15mm, cube_edge ~0.5mm.

### Visibility floor

Below ~2px tooth height, the texture renders as anti-aliased fuzz. The groove already handles this gracefully (`web/index.html:13687` — `if (width < 0.15) continue`). Same trick: each template returns a `min_amplitude_px` constant; if the computed amplitude falls below it, fall through to `smooth` for that crystal at that zoom level. Better to read as a clean curve at low zoom than as visual noise.

This makes the textures **zoom-progressive**: zoom in, the dogtooth resolves; zoom out, it relaxes to the existing curve. No information loss, just appropriate detail.

---

## Data Schema

`data/minerals.json` per-mineral block gains:

```json
{
  "name": "calcite",
  "edge_texture": "dogtooth",
  "edge_texture_params": {
    "amplitude_factor": 0.6,
    "pitch_mm": 0.8
  },
  "habit_variants": [
    {
      "name": "scalenohedral",
      "trigger": "high_sigma_low_mg",
      "edge_texture": "dogtooth"
    },
    {
      "name": "rhombohedral",
      "trigger": "default",
      "edge_texture": "rhomb"
    }
  ]
}
```

`vugg.py` MINERAL_SPEC mirrors the field but doesn't use it (Python doesn't render). Declared so `tools/sync-spec.js` doesn't drift-warn. Same single-source-of-truth pattern as `class_color`.

The texture templates themselves live JS-only in a new module (or inlined in `web/index.html`) — they are pure rendering code, no physics, so Python never sees them.

---

## Implementation Outline

1. **Schema migration.** Add `edge_texture` field to MINERAL_SPEC_FALLBACK and `data/minerals.json` for all 51 minerals. Bulk literature pass — for each mineral, the dominant natural habit determines the default; existing `habit_variants` entries get overrides where they differ. (~1 day, mostly lookup.)

2. **Refactor inner-edge rendering to per-crystal.** Group cells by `crystal_id` first, then emit one textured polyline per crystal. Outer-fill and wall-outline passes stay per-cell. (~half day, biggest engineering risk because of the wedge-continuity invariant.)

3. **Texture template library.** Implement the ~17 path generators as pure functions. Each takes the same signature so the dispatch table is uniform. Unit-testable with a small standalone HTML harness that draws each template on a flat baseline at varying amplitude/pitch. (~1-2 days.)

4. **Dispatch + amplitude/visibility wiring.** Look up template by `(mineral, habit)`, compute amplitude with both caps, apply visibility floor, draw. (~half day.)

5. **Mirror to docs/.** Auto-mirror script handles it.

6. **Verification harness.** A new dev-only scenario or test page that stamps every texture on a uniform wall, so visual regression is one screenshot away. (~half day.)

Total estimate: ~1 week of focused work.

---

## What This Enables

- **Saddle dolomite becomes visible.** The curved-shoulder rhomb is *the* field signature for dolomite vs straight calcite. The Kim-2023 cycle work shipped in Round 3 only had textual/numeric output (`f_ord`, `cycles`); now ordered dolomite shows up as a different *shape* on the wall.
- **The Mg/Ca chemistry chain becomes legible.** As Mg rises, calcite habit shifts scalenohedral → rhombohedral → aragonite, and you'd see all three textures swap as the chemistry shifts. Right now it's a numeric change buried in `crystal.habit`.
- **Pyrite cube vs pyritohedron vs framboidal** all dispatchable from existing habit data.
- **Twin laws ride the same system.** Cyclic-twinned aragonite renders as `cyclic_twin_hex` instead of `prismatic_hex`. Twin events already track in the groove; now they show on the wall.
- **Botryoidal/spherulitic/fibrous aggregate forms** become visually distinct from monocrystalline forms at last — currently chrysocolla and chalcedony paint identically.
- **Acicular sprays of marcasite or erythrite** read as spike fields, not flat wedges.

---

## What NOT to Change

- **Wall data model.** No new fields on cells or crystals beyond what habit dispatch already populates.
- **Outer-edge fill.** The wall-side of the wedge is buried in adjacent mass; it stays smooth Bezier.
- **Wall outline pass.** Continues to stroke per-cell over the fill. Independent of textures.
- **Groove visualization.** Different purpose (history vs present form). Leave alone.
- **Python and agent-api runtimes.** Texture rendering is JS-only. Python declares the field for spec parity, ignores it.
- **Class colour palette.** Textures use the same `topoClassColor()` lookup; only the geometry changes.
- **Habit-dispatch logic in grow functions.** Already correct; renderer just consumes the result.

---

## Risks

- **Performance.** Each wedge currently is ~5 path operations. A textured edge with 20 teeth across the arc is ~40-80 ops. With 50 crystals on the wall = ~2000-4000 ops per frame. Canvas should handle this fine, but the topo replay (`wall_state_history` playback) needs benchmarking — that's the one place we redraw at high frame rate. If it stutters, drop the playback to a lower texture-detail tier.
- **Per-crystal continuity bugs.** Crystals that paint non-contiguous cell groups (split by an inclusion or a small overlapping crystal) need the inner-edge loop to walk each contiguous run separately. Edge-case but real — has to be tested with `sweetwater` style scenarios where calcite hosts pyrite inclusions.
- **Texture conflict at crystal boundaries.** Adjacent crystals painted by different minerals will have different textures at the shared cell boundary; teeth from one will not align with teeth from the other. This is geologically correct (real crystals don't co-align across species boundaries) but may visually jar. Solution: each per-crystal texture path explicitly terminates at `cellR[firstCell] - inwardPx` and `cellR[lastCell] - inwardPx`, accepting the boundary discontinuity. Don't try to blend.
- **Drusy at extreme zoom out.** A 5° arc with 80 micro-teeth at 25% zoom is invisible regardless of anti-aliasing. Visibility floor handles it, but document the threshold so it's not surprising.
- **Looks more authoritative than the chemistry warrants.** Same risk flagged in the silhouette discussion: a crisp dogtooth-calcite texture on a Mg=0 fluid is a lie that's harder to spot than a numeric one. **This is why the chemistry audit must ship first.**

---

## Sequencing / Prerequisites

**Hard prerequisite: `TASK-BRIEF-SCENARIO-CHEMISTRY-AUDIT.md` ships first.**

Habit dispatch is chemistry-driven (Mg/Ca for carbonates, σ for quartz scepter overgrowth, trace ions for tourmaline schorl/elbaite, σ-and-T for aragonite habit). Habit-driven textures only tell the truth once the chemistry does. Shipping textures on top of a Mg=0 default-broth means every scenario shows the wrong texture confidently. The audit makes the existing habit-dispatch actually fire across realistic ranges; only then does it pay to render those habits visually.

After the chemistry audit lands, this proposal can ship in a single ~week of work. No new minerals, no new physics, no new scenarios required.

---

## Files to Touch

- `data/minerals.json` — add `edge_texture` field per mineral and per habit variant
- `docs/data/minerals.json` — mirror
- `vugg.py` — declare `edge_texture` in MINERAL_SPEC entries (no rendering)
- `web/index.html`:
  - extend MINERAL_SPEC_FALLBACK with `edge_texture`
  - new template-library section (~17 path generators)
  - refactor inner-edge rendering in `topoRender` (line 14565) to per-crystal loop
  - dispatch + amplitude/visibility wiring
- `docs/index.html` — mirror via auto-mirror script
- `tools/sync-spec.js` — register the new field if it gates on a known-keys allowlist

## Out of Scope

- 3D textures (proposal targets the existing 2D Wall Profile)
- Adding new habit variants (covered by future mineral rounds — this proposal renders what already exists)
- Animating tooth growth during active growth steps (nice future addition, not v1)
- Replacing the groove with anything (groove is signature, untouched)
- Edge textures on the agent-api runtime (no rendering layer there)

---

## Verification

For each of the ~17 templates:
1. Stamp on a flat baseline at amplitude 0.5mm, 1mm, 5mm in a dev test page; confirm geometry matches the literature/handbook reference for that habit.
2. Stamp on a 5° arc at zoom 25%, 100%, 400%; confirm visibility floor kicks in at the documented threshold.

For the dispatch:
1. Run scenario `sabkha_dolomitization` seed 42, screenshot the Wall Profile. Saddle-rhomb dolomite should be visually distinct from calcite rhomb.
2. Run scenario `mvt` seed 42, screenshot. Calcite scalenohedral (dogtooth) should be visually distinct from any rhombohedral calcite present.
3. Run `bisbee` seed 42. Pyrite cube edges should read different from chrysocolla botryoidal.
4. Diff the screenshots against pre-textures baseline — every species visible as a distinct edge signature, no scenario regressions.

Bonus: a `texture_gallery` dev-only page that lays every texture on a uniform white arc at fixed amplitude and pitch, captioned with mineral list. Saved as a static screenshot, makes future-you's PR review trivial.

---

Commit per logical chunk (schema migration, per-crystal refactor, template library, dispatch, verification harness) — five commits, easy to bisect if anything regresses. Do NOT push — boss reviews and merges.
