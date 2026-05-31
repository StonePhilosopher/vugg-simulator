# HANDOFF — the per-vertex placement flip: a sampler bug fixed, a feature found starved

**Date:** 2026-05-30 · **SIM_VERSION 166 → 167**
**Scope:** Picked up the long-deferred "global per-vertex placement flip" (make
"nucleate where σ is highest" the default). Verified against the geology with two
new probes BEFORE committing — which is exactly why the flip waited for the
instrument. The verification changed the plan: fixed a latent area-weighting bug
in the sampler, but **did NOT flip the global default** — the instrument showed it
would be inert for the current scenario suite. All work on `main`, pushed to
`Syntaxswine/vugg-simulator`.

---

## TL;DR

The per-vertex nucleation machinery (`_perVertexNucleationSample`, the
`wall.per_vertex_nucleation` flag) shipped long ago as **Tranche 6, opt-in,
default-off**. Only `zoned_dripstone_cave` + `stalactite_demo` use it. "The flip"
was supposed to make it the global default. Before rebaking 30 baselines, I
pointed an instrument at it. Two findings:

1. **The sampler had a polar-skew bug.** It weighted candidate cells by `(σ−1)²`
   with **no cell-area term**. On the lat-long mesh every ring carries the same
   cell count but polar rings cover far less surface (sin φ → 0 at the caps), so a
   near-uniform σ field over-nucleated the floor/ceiling poles: floor/wall/ceiling
   came out **25/50/25** instead of the area-true **14.6/70.7/14.6** the legacy
   placement produces. **Fixed** (v167): `weight = ringAreaWeight(r) · (σ−1)²` —
   the same sin φ correction `_cellCavityVolMm3` already uses for fill accounting.

2. **The per-cell σ field is ~uniform, so the feature is starved.** In every
   non-zoned scenario σavg ≈ σmax — there is no gradient for "nucleate where σ is
   highest" to follow. Cause is **scale, not diffusion**: ~30 crystals on 1920
   cells means depletion touches ~1.5% of cells; the rest stay pristine and
   identical. Diffusion is a lever (CV rises as rate→0) but the magnitude is tiny
   (CV ≤ 2–4% even at diffusion=0). So "nucleate where σ is highest," done
   correctly (with the area term), reduces **exactly** to legacy area-weighting in
   a uniform field. The only place it does real work is where chemistry is
   **designed** to be spatially structured — `zone_chemistry`, which the showcase
   has and where the feature sorts aragonite/calcite beautifully.

**Decision:** land the area-term fix; keep per-vertex **opt-in**. The global flip
stays deferred — it would be a full RNG-cascade rebake of 28 scenarios for zero
placement benefit.

---

## The instruments (kept as permanent tools)

- **`tools/placement-skew-probe.mjs`** — for each scenario, computes per-cell σ
  for the dominant mineral and reports the floor/wall/ceiling nucleation
  distribution under three weightings: (a) legacy area-weighted, (b) current
  `(σ−1)²`, (c) proposed `sinφ·(σ−1)²`. Also hammers the real sampler 4000× as a
  cross-check. This is what found the bug and confirmed the fix (empirical sampler
  flipped 25/50/25 → 14.6/70.7/14.6).
- **`tools/sigma-structure-probe.mjs`** — per-cell σ structure vs
  `inter_ring_diffusion_rate` (0 / 0.01 / 0.05 / 0.2). Reports σ at crystal-
  occupied cells vs empty, CV across all cells, and the depleted-halo footprint
  (cells below 0.9·max). This is what proved the uniformity is a scale limit, not
  a diffusion artifact.

| scenario · mineral | (a) legacy | (b) current | (c) area-term |
|---|---|---|---|
| mvt · barite | 14.6/70.7/14.6 | 25.2/49.6/25.2 | 14.8/70.4/14.8 |
| marble · calcite | 14.6/70.7/14.6 | 25.0/50.0/25.0 | 14.7/70.7/14.6 |
| porphyry · arsenopyrite | 14.6/70.7/14.6 | 25.1/49.9/25.1 | 14.7/70.6/14.7 |
| *every non-zoned scenario* | 14.6/70.7/14.6 | ~25/50/25 | ~14.6/70.7/14.6 |

σ-structure (end of run, dominant mineral): even at **diffusion=0** the CV maxes
at ~2–4%, occupied/empty σ contrast ~0.88–0.92, depleted footprint <3% of cells.
~30 crystals / 1920 cells is the binding constraint.

---

## What "making the feature matter" would actually take (for the next builder)

Per-vertex placement is only valuable where the per-cell σ field has structure.
Today the *only* source of that structure is designed `zone_chemistry`. Real
depletion-driven structure (crystals self-spacing to avoid each other's depletion
halos — the geologically lovely outcome) would need one of:

- **A high-fill / many-crystal regime** so occupied cells become a large fraction
  of the mesh (then depletion halos overlap and a real σ landscape emerges).
- **A coarser effective nucleation mesh** so each crystal's depletion covers a
  meaningful fraction of candidate sites (1920 cells is far finer than the ~30
  crystals can structure).
- **Longer-range / larger-magnitude depletion halos** — a bigger `MASS_BALANCE_SCALE`
  paired with a moderate (not zero, not default) diffusion rate that spreads the
  depletion into halos without globally homogenizing.

None of these is a flag flip; each is its own piece of work with its own
verification. The honest state: **the feature is correct and opt-in; it earns its
keep wherever spatial chemistry structure exists; broad depletion-driven placement
is a future regime, not a default.**

---

## Baseline drift (v166 → v167)

Sampler runs only in the 2 per-vertex scenarios (flag default OFF), so **28/30 are
byte-identical**. Of the 2:
- `zoned_dripstone_cave`: aragonite max_um 5706.3 → 5730.4 (+0.4%), calcite max_um
  2166.4 → 2056.8 (−5%); **all counts identical** (no mineral appears/disappears).
- `stalactite_demo`: placement shifts but doesn't cross a count/size boundary →
  summary byte-identical.

Strip digest byte-identical (neither per-vertex scenario is in the 10-scenario
digest set). Showcase test `per-vertex-nucleation.test.ts` re-pinned: the
floor/ceiling **cross-exclusion** is preserved and sharper (aragonite floor 14%,
calcite ceiling 2%); aragonite's *plurality* shifts ceiling→wall (the equatorial
wall has ~5× the ceiling's area — wall frostwork is real, Hill & Forti 1997). The
test now pins enrichment-vs-area-baseline + the cross-sort rather than absolute
plurality.

Full suite 1656/1656 green.

---

## The lesson

The whole reason this flip waited for the strip/per-vertex instrument was so it
could be "verified against the geology before committing." It was — and the
verification *changed the decision*: a naive global flip would have shipped a
polar-skew artifact AND a full rebake for no benefit. Observe before you assert;
the instrument is more honest than the roadmap. (Same refrain as the strip-as-
instrument handoff — earned again.)
