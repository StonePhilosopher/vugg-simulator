# PROPOSAL: True 3D Vug Simulation

**Author:** Stone Philosopher (drafted with Claude)
**Date:** 2026-04-22
**Status:** Proposal for boss review
**Companion to:** `PROPOSAL-3D-TOPO-VUG.md` (rendering) and the Tier-1 3D viewer work

---

## Overview

Today the simulation runs as a 2D lathe: every grow step, every chemistry update, every scenario event operates on a single circular cross-section stored as `wall_state.rings[0]`. The data model already declares `rings[]` (plural), but no code writes to ring[1] or beyond. A 3D viewer built against this data (Tier 1 — the tilted plane; Tier 2 — Three.js scene) can only ever extrude one slice up into a cylinder.

This proposal is the simulation-side complement: **populate multiple rings with real per-ring variation** so that "3D view" actually means "3D vug" rather than "2D slice on its side." The viewer work is forward-compatible; this work makes the viewer's pixels *mean* something.

---

## Why Now

Three wins unlock once the simulation is actually 3D:

1. **Orientation-dependent habits become real.** Stalactitic calcite (ceiling-down) vs floor-grown rhombs are different habits in the grow functions but the simulator can't distinguish them because every cell faces "inward" in the same way. A 3D simulation with gravity knows which cells are ceilings and which are floors.

2. **Vertical zonation** (bathtub rings, phreatic vs vadose, evaporation meniscus) becomes native. Sabkha dolomitization's cycling fluid levels are currently represented as temporal pulses of whole-vug chemistry; in 3D they'd be spatial — the evaporite horizon is a literal horizontal band on the wall.

3. **Dissolution tubes and fracture geometry** (acid flowing down through a vug, gas bubbles rising) become expressible as actual vertical structures rather than whole-vug events.

Without the 3D simulation, these phenomena either (a) can't be represented or (b) get shoehorned into time-varying single-ring chemistry that loses their spatial character. The chemistry audit task brief (`TASK-BRIEF-SCENARIO-CHEMISTRY-AUDIT.md`) hit this limit repeatedly — meniscus evaporation, floor-vs-ceiling assemblages, and percolation effects all had to be faked as whole-vug pulses.

---

## What Changes in the Data Model

### Rings become real

```
wall_state = {
  rings: [Ring_0, Ring_1, ..., Ring_(N-1)],   // N ≈ 16 for MVP
  vertical_axis_mm: 50,                        // total vug height
  ring_height_mm: 50 / N,                      // slice thickness
  ...existing fields
}

Ring_k = [Cell_k_0, Cell_k_1, ..., Cell_k_(M-1)]
Cell_k_j = {
  // EXISTING fields unchanged
  crystal_id, mineral, thickness_um, wall_depth, base_radius_mm,
  // NEW fields
  ring_index: k,
  z_mm: k * ring_height_mm,     // vertical position in vug-local coords
  orientation: 'floor' | 'wall' | 'ceiling'   // derived from ring geometry
}
```

The orientation tag is key: the top ring is "ceiling" (cells face downward), the bottom ring is "floor" (cells face upward), middle rings are "wall" (cells face horizontally inward). This is what lets grow functions condition on "am I a stalactite or stalagmite?"

### VugConditions becomes per-ring

```
vug = {
  rings: [VugConditions_0, VugConditions_1, ..., VugConditions_(N-1)],
  ...shared sim state (step, events, narrator)
}
```

Each `VugConditions` is what `VugConditions` is today — pH, temperature, fluid chemistry, flow rate. Temperature and pressure typically vary smoothly vertically (convection, geothermal gradient); fluid chemistry can vary sharply (stratification, meniscus).

### Crystal positions gain a ring

```
crystal.anchor = {
  ring_index: k,           // which ring it nucleated in
  cell_index: j,           // which cell within that ring
  vertical_span_rings: 3   // how many rings tall (for crystals spanning slices)
}
```

Crystals spanning multiple rings (common for tall acicular habits like stibnite or large dogtooth calcite) track their vertical extent so chemistry contributions and rendering both know where they are.

---

## What Changes in the Simulation

### Per-ring growth steps

Every grow function (`grow_calcite`, `grow_aragonite`, `grow_dolomite`, etc.) now runs per-ring, per-crystal. Independent by default. Same chemistry-→-habit dispatch, but the `VugConditions` passed in is the ring-local one.

### Inter-ring diffusion

Chemistry equilibrates between adjacent rings over time. Simplest model:

```
for each step:
  for each fluid component F:
    for each ring k:
      rings[k].fluid[F] += DIFFUSION_RATE * (rings[k-1].fluid[F] + rings[k+1].fluid[F] - 2*rings[k].fluid[F])
```

Rate tunable per component — fast for heat, slower for heavy ions. Advanced: density-driven convection (warm fluid rises, Mg-brines sink). Probably phase 2 of phase.

### Gravity and orientation

New per-cell tag `orientation` drives habit selection:

- **Ceiling cells (top ring):** stalactite bias — pointed-downward habits, fluid-dripping dynamics
- **Floor cells (bottom ring):** stalagmite bias — upward-pointing crystals, fluid-pooling dynamics (precipitation from evaporation favors these)
- **Wall cells (middle rings):** today's default — horizontal growth

Grow functions check `cell.orientation` and pick habit/rate accordingly. Existing grow functions continue to work unchanged — they just see `orientation: 'wall'` for all cells in a single-ring sim, which is the default.

### Fluid-level events

Scenario events that set "the fluid level dropped" (evaporation, drainage) now mean *something*: rings above the fluid surface enter vadose mode (no crystal growth from solution; maybe some oxidation if O₂ is high); rings below stay phreatic.

This mechanism also gives us literal **bathtub rings** — successive meniscus positions leave horizontal mineral bands on the wall.

---

## What Changes in the UI

The 2D Wall Profile becomes a *ring selector*. Default shows the middle ring. A slider or dropdown picks another ring to view. The 3D viewer (Tier 2) shows the whole stack.

Scenarios can now be screenshotted showing (a) a single ring, (b) a vertical cross-section, (c) the 3D rendering — all from the same underlying data.

---

## Risks

1. **Compute cost scales with N.** For N=16 rings and M=120 cells per ring, we go from 120 cells to 1,920 cells. Each gets per-step chemistry, supersaturation checks, growth calls. Probably fine on modern hardware but worth benchmarking before committing to N.

2. **Seed reproducibility breaks.** Seed 42 in the current sim will produce different output in the multi-ring sim even if fluid chemistry is identical — the crystal nucleation order changes because the RNG is consumed differently. Need a version tag so old scenario documentation ("at seed 42, sabkha produces 8 dolomites and 2 aragonites") doesn't become a lie. Probably add `sim_version: 3` or similar.

3. **Narrator tooling currently assumes single ring.** Event narrators, mineral narrators all take one `conditions`. They'd need to take either an *aggregate* conditions (averaged across rings) or a *primary ring* (user-selected or default-middle).

4. **All existing scenarios need review** to decide what "multi-ring" means for them:
   - Cooling: uniform across rings? Or hotter at floor?
   - MVT: brine rises from below — vertical gradient makes sense
   - Sabkha: evaporation at top, denser brine below — this is WHY sabkha wants 3D in the first place
   - Deccan zeolite: gas-bubble vesicle with temperature gradient vertically

5. **Every 4-runtime sync multiplies.** vugg.py and web/index.html already have the 2D version; now they each gain a 3D version. Keeping them aligned is more spec-drift surface.

6. **Agent-api lags behind.** agent-api was opted out of new mineral rounds. It'd also opt out of 3D simulation at first, but eventually needs to catch up or be formally deprecated.

---

## What NOT to Change (Even in a 3D World)

- **Texture system** (edge textures from recent commits). Works per-cell regardless of ring. Ships unchanged.
- **Mineral specs.** Formulas, supersaturation functions, thermal decomp tables, narrators — unchanged.
- **Scenario event lists.** Each event's magnitude/timing stays; its *application* may gain a per-ring dimension (e.g. "add Cu to the bottom 4 rings" instead of "add Cu").
- **UI framework.** HTML/CSS skeleton unchanged. New controls (ring slider, 3D toggle) are additive.
- **Groove visualization.** Different purpose (history); stays 2D.
- **Random seed semantics.** Same sim version → same seed → same output.

---

## Sequencing

Staged over months, not weeks. Each stage is shippable and testable in isolation.

### Phase 1 — Multi-ring data model, single-ring simulation

- `WallState.rings` populated for N=16 but all rings are identical copies of ring[0]
- `VugConditions` still shared across rings
- Nothing visible changes — 2D view shows ring[8] (middle) by default
- Proves the data model works without risking simulation correctness

### Phase 2 — Per-ring chemistry with inter-ring diffusion

- Each ring has its own `VugConditions`
- Diffusion step mixes fluid chemistry between adjacent rings
- Scenarios that don't set vertical gradients produce nearly-identical rings
- 2D view can now show different rings and differ visibly

### Phase 3 — Orientation tags + gravity-aware habit dispatch

- Top ring → `orientation: 'ceiling'`, bottom → `'floor'`, middle → `'wall'`
- Grow functions updated to key on orientation where relevant
- Stalactites and stalagmites diverge from wall crystals

### Phase 4 — Fluid-level scenarios (sabkha v2)

- `scenario_sabkha_dolomitization` reshot with actual vertical fluid levels
- Meniscus evaporation concentrates chemistry at the surface ring
- Tidal cycling is literal vertical movement, not whole-vug chemistry pulse
- Produces visible bathtub-ring stratigraphy

### Phase 5 — 3D-aware crystal positioning

- Crystals can span rings vertically
- Large dogtooth scalenohedra, acicular stibnite bundles grow tall
- 3D viewer (Tier 2) shows them as tall prisms

### Phase 6 — Density-driven fluid convection

- Mg-brines sink, hot fluids rise, stratification self-organizes
- Probably optional polish; previous phases already get most of the geological payoff

---

## Files Impacted (Rough Scope)

- `vugg.py` — WallState, VugConditions, every grow function, every scenario, narrator calls. Large refactor.
- `web/index.html` — same list, JS mirror
- `docs/index.html` — auto-mirror
- `data/minerals.json` — optional new fields (`orientation_preference`, `vertical_extent_factor`)
- `proposals/SCENARIO-LOCATIONS.md`, `TASK-BRIEF-SCENARIO-CHEMISTRY-AUDIT.md` — may specify vertical gradients per locality
- `agent-api/` — opt-out or upgrade, decide later

Estimated engineering time: **~3-4 weeks** of focused work, plus the chemistry audit needing vertical-gradient data per locality on top. Probably best done on a long-running `3d-sim` branch with periodic merges.

---

## Out of Scope (for THIS proposal)

- **Rendering.** Covered by `PROPOSAL-3D-TOPO-VUG.md` + the Tier-1 tilted-plane viewer currently being built. This proposal gives those viewers real 3D data to render; how the pixels are drawn is separate.
- **New minerals.** Independent work stream.
- **Edge textures.** Already ships per-cell; no changes needed for 3D.
- **Non-circular vug cross-sections.** Covered by Part 1 of `PROPOSAL-3D-TOPO-VUG.md` (Fourier profile). Composable with this proposal — each ring gets its own Fourier cross-section.

---

## Open Questions for the Boss

1. **Ring count.** Start with N=16 or commit to a target (say N=32) upfront? Tradeoff: vertical resolution vs compute cost.
2. **Scenario reproducibility policy.** When sim version bumps, do old scenario briefs get rewritten or archived with a version tag?
3. **Priority vs the chemistry audit.** The audit makes existing single-ring scenarios honest. 3D simulation makes new phenomena possible. Which lands first? (Arguably chemistry audit first — 3D scenarios would want literature-backed fluid compositions too.)
4. **Drop agent-api or upgrade it.** Agent-api already fell behind on minerals. 3D is another fork in the road.

---

Commit when proposal is agreed upon: split into per-phase task briefs (`TASK-BRIEF-3D-PHASE-1-DATA-MODEL.md`, etc.) so each phase has a specific scope. Do NOT push — boss reviews and merges.
