# HANDOFF — Calcite morphology arc (stepped calcite & the full Sunagawa spectrum)

*2026-06-11. Status: RESEARCH + CALIBRATION DONE, peer-review-corrected,
nothing wired into the engine yet. Two boss decisions are BLOCKING the
build (§5). The boss expects this to be a big change — plan accordingly:
the render phase is the largest geometry work since the cavity mesh.*

---

## 1. What the boss asked for (the brief, verbatim anchors)

- "theres still no way to generate a geologically accurate stepped calcite.
  calcites are my favorite crystal and the stepped calcites are my favorite
  subgroup, so i'd love to be able to **watch how they grow**"
- On being offered a choice of stepped looks: "**this falls under follow the
  science. if the data produces multiple morphologies so should the game.**
  be sure to save the research data you use for later verification"

So: NOT a hand-picked "stepped" habit. ONE mechanism that reads growth
conditions and lets the whole documented calcite morphology spectrum emerge
— stepped calcite is the favorite band of that spectrum, and the deliverable
the boss personally wants is WATCHING the steps build during growth (render
phase is not optional polish; it is the ask).

## 2. The science (settled — read before touching anything)

**proposals/RESEARCH-calcite-morphology-2026-06-11.md** is the geological
oracle, with verifiable citations (Teng/Dove/De Yoreo 2000; Wolthers 2022;
GCA 2021 morphology diagram; CGD 2023 hopper; GCA 2015 Mg; Sunagawa
1981/2005). Load-bearing facts:

- Two growth regimes: **spiral (BCF)** at low σ → smooth faces; **2D
  nucleation** above a crossover → layer growth whose elementary steps
  **BUNCH into macrosteps** = the visible stepped calcite. Bunching is
  driven by impurity pinning + **fluctuating growth conditions** — i.e. the
  Movements layer (v169–v186) is the natural driver: THE STEPS ARE THE
  CHEMISTRY CURVE MADE SOLID. This is the design's center of gravity.
- **Sunagawa ordering (PEER-REVIEW CORRECTED 2026-06-11, 17th catch):**
  polyhedral → **hopper/skeletal** (onset of diffusional instability,
  hollow faces, still faceted) → **dendritic** (instability taken further,
  branches). My first draft had dendrite/hopper REVERSED; an external
  reviewer caught it before it reached the engine. The corrected order is
  in the research doc §3 with a correction note; do not regress it.
- **Size damping is real physics** (endorsed by the same reviewer): big
  slow crystals build a thick boundary layer, surface σ lags bulk σ, so
  they hold faceted at high bulk σ. Implemented as
  `surfσ = 1 + (bulkσ−1)/(1 + size/SIZE_HALF_UM)`.
- **Mg axis** (phase 4, not yet built): Mg/Ca ≳ 0.2 elongates calcite
  toward scalenohedral/dogtooth + biases bunching. The σ axis sets
  smooth↔stepped↔hopper; Mg sets the FORM the steps build into.
- **σ units do NOT transfer from papers** (reduced σ, crossover ~0.8) to
  the sim (omega-like, measured 1.05–664). Thresholds were calibrated by
  observation (§3 below). NEVER transcribe a paper threshold into sim units.

## 3. The calibration (measured, seed 42)

**tools/calcite-sigma-observe.mjs** — per-scenario + fleet σ distribution
during active calcite growth. Key numbers: fleet σ spans 1.05–664;
q50 17, q75 103, q95 626. Step-to-step |Δσ| median 0.020 but q90 0.5,
max 107 → the bunching signal exists and is movement/event-driven.

**tools/calcite-morphology-map.mjs** — the CANDIDATE CLASSIFIER lives here
(deliberately in a tool, not the engine, so it can be tuned transparently).
Thresholds in sim-unit SURFACE σ, Sunagawa order:

```
spar < 2 | stepped(mild) < 8 | STEPPED < 50 | hopper/skeletal < 200 | dendritic ≥ 200
SIZE_HALF_UM = 80 (boundary-layer damping)   MG_SCALENO = 0.15 (Mg:Ca form flip)
```

Fleet map at seed 42 (13 calcite scenarios): 8 smooth-spar-dominant (mvt,
fluorite-vein, marble, deccan, jeffrey, mn-calcite, travertine, pulse) —
several with stepped RIM zones; searles stepped(mild); ultramafic +
stalactite STEPPED; sabkha + dripstone HOPPER (σ 537–625 sustained).
**Dendritic: ZERO stable endpoints** — only transient rim bands (dripstone
24%). The reviewer predicted exactly this ("do high-σ cases collapse into
hopper-style hollowing?" — yes), and it is geologically honest: sustained
dendrite-grade σ is rare in nature. An empty stable-dendrite column is
correct, not a gap.

Zoning emerges free: most single-crystal scenarios carry mixed zones
(smooth core → stepped rim) because σ moves mid-growth. This is the real
phenomenon (growth-zoned calcite) and it costs nothing — per-ZONE
classification, not per-crystal.

## 4. Codebase recon (where it plugs in — verified against source 2026-06-11)

- **Engine**: `js/52-engines-carbonate.ts grow_calcite()`. σ computed at
  line ~13; the **manganocalcite branch (~lines 80–107) is the exact
  precedent** for condition-dispatched habit override (sets crystal.habit /
  dominant_forms / _variety from chemistry+kinetics per step). The
  morphology classifier goes here (reading σ level, σ history, Mg:Ca, T).
- **Per-zone record**: `GrowthZone` (`js/27-geometry-crystal.ts` ~line 48)
  already stores per-step thickness/growth_rate/traces. Add a morphology
  tag per zone (regime + step scale) so SHAPE history is recorded like
  chemistry already is.
- **Geometry**: `Crystal.add_zone()` integrates zones into an ellipsoid of
  revolution — NO surface relief exists. **This is the big change the boss
  senses**: making steps visible means per-zone terraces in the geometry.
- **Render**: `js/99c-renderer-primitives.ts` (11 primitives) +
  `99d-renderer-wireframe.ts` / `99i-renderer-three.ts` dispatch
  habit→primitive, scaled by (a_width_mm, c_length_mm). Stepped/hopper need
  either new primitives or (better, for WATCHING growth) geometry built
  from the zone stack so terraces appear as zones accumulate.
- **Habit data**: `data/minerals.json` calcite `habit_variants` (6 today,
  σ/T-triggered at nucleation via `js/07-habit-variant.ts`). Note habit is
  selected ONCE at nucleation; mid-growth changes go through the engine
  override path (manganocalcite precedent), not the variant selector.
- **Strip**: zones already render as chemistry bands; a per-zone morphology
  chip is nearly free and gives the strip a "the rock got stepped HERE" read.

## 5. ⛔ BLOCKING — two boss decisions requested, not yet answered

1. **Size damping / smooth-spar weight.** SIZE_HALF_UM=80 pulls deccan,
   jeffrey, marble back to smooth-spar despite high bulk σ. Physically
   sound, reviewer-endorsed — but is it RIGHT for these localities in
   hand-specimen terms? Boss's eye sets this knob. If deccan/jeffrey
   calcite should read stepped, raise SIZE_HALF_UM (weaker damping) or
   lower STEP thresholds.
2. **The stepped-calcite showcase locality.** Stepped is currently dominant
   only in ultramafic + stalactite (neither a classic stepped-calcite
   locality). The boss's favorite subgroup deserves a purpose-built
   scenario sitting squarely in the stepped band with a Movements-driven
   oscillatory σ (the bunching driver). ASKED: which locality/look to
   anchor — e.g. Elmwood-style stepped scalenohedron, zoned stepped rhomb,
   other. The whole render phase showcases this scenario.

## 6. The phased plan (after §5 unblocks)

- **Phase 0 (dark, byte-identical):** port the classifier from the map tool
  into `grow_calcite()` writing METADATA ONLY (crystal._morphology +
  per-zone tag); nothing reads it. Gate: byte-identical baselines, the map
  tool re-run agrees with its own pre-port output.
- **Phase 1:** per-zone morphology tags official in GrowthZone; strip chip.
  Probably SIM-neutral (observer-only) — verify, don't assume.
- **Phase 2:** habit strings + dominant_forms driven by the classifier
  (SIM bump + rebake; expects/lineage gates per the v185/v186 discipline —
  REMEMBER the 16th catch: gates keyed on names miss renamed/transformed
  entities; and the 17th: orderings verified against the research doc).
- **Phase 3 (THE ASK):** visible terraces. Geometry built from the zone
  stack so steps appear AS THE CRYSTAL GROWS (live render + replay).
  Largest change; design doc + boss look before commit. Options scouted in
  §4 (zone-stack geometry > static stepped primitives, because the boss
  wants to watch them BUILD).
- **Phase 4:** Mg elongation axis (needs Mg in broth verification — most
  scenarios carry fluid.Mg already).
- **Phase 5:** showcase scenario (per §5.2) + tests + narrator voice.

## 7. Discipline carried forward

- Verify the engine against the RESEARCH DOC, not a plausible story; the
  doc's §6 lists the re-test hooks (regime ordering; movement-driven
  bunching ↑ steps; Mg elongation; no-regression on existing calcite
  scenarios).
- Thresholds from sim-unit OBSERVATION only (the map tool is the bench).
- Multi-seed rate gates for marginals; lineage-aware checks where entities
  transform (16th catch).
- Per the boss: research data SAVED for later verification — keep the
  research doc's source list updated if any threshold is re-derived.
- All three artifacts (research + two tools) are sim-neutral; engine
  untouched as of this handoff. Tree state: committed on top of v186
  (`52cab29`).
