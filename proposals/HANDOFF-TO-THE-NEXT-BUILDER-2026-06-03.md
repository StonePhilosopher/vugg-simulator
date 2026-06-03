# A letter to the next builder — the fluid-spots arc (2026-06-03)

You're probably a future me. Hello. This isn't the status doc — that's
`HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md` (Part II for the live open-items
list, the Phase 2 section for the spot couplings, the per-bump detail in
`js/15-version.ts`). This is the layer that doesn't survive in a diff: what the
work *felt* like to reason through, the traps I fell in so you don't, and the
honest edges of what we built. Read the status doc for *what*; read this for *how
to think about it*.

This session closed out the **fluid-spots arc** — seeded feeders that enter the
cavity at discrete points and do four things: deepen the wall (2b), inject a
chemical halo (2c.1), gather the best crystals (2c.2b), and open/close over the
vug's life (2d) — culminating in 2c.3, one feeder carrying all of it at once on
gem_pegmatite. SIM 171 → 174. The boss said "the nuances are really being
explored," and that's the truest description: almost every increment turned on a
*nuance* that only showed up when I measured instead of assumed.

---

## The one lesson, above all: verify the mechanism, don't narrate it

This session was a chain of "looks plausible, doesn't actually do the thing,"
and *every single one* was caught by measuring, never by the story sounding
right. If you take one thing from this letter, take this. The catches:

1. **2c.2 column-bias deposition.** I wired feeder-`supply` weighting into the
   ring0 column pick. The prose was perfect: "crystals cluster in the feeder's
   column." I built a probe to confirm — and gem_pegmatite's feeder columns
   captured **0 crystals**, OFF *and* ON. A feeder is a 2-D patch, not a thin
   vertical stripe, and the legacy column pick is sparse + often bypassed. It
   reshuffled competition without the spatial payoff. I shipped it **default-off**
   and wrote down why, rather than ship baseline churn for an invisible effect.
   The fix (2c.2b) was a per-cell proximity halo — which *did* cluster (0→18%
   within 2 cells of a feeder).

2. **The probe that lied, not the engine.** When I first measured 2c.2b
   clustering it read 0% — and I almost concluded the engine was broken. It
   wasn't: my probe decomposed the crystal anchor's `cellIdx` as if it were a
   full mesh index, when `cellIdx` is *already the column* (0..N-1) and the ring
   is a separate field (`ringIdx`). Fixed the probe → clustering was 11–18% all
   along. **When a measurement says "nothing happened," suspect the measurement
   first.** (This one cost me the most; it's the most human mistake in here.)

3. **2c.3 nutrient injection ≠ growth.** I expected injecting boron at the feeder
   to grow tourmaline there (the Punjab specimen). Measured: even a +4000 B
   injection left tourmaline 3×451µm *unchanged*. These growth engines aren't
   nutrient-rate-limited, and the per-cell injection is decoupled from the
   nucleation gate. So 2c.3 became an honest **chemical halo co-located with the
   cluster** — the feeder is the common cause (boron enters there, tourmaline
   gathers there), readable on strip + render at the same angular position — not
   a growth driver. I named that ceiling instead of overclaiming.

4. **reactive_wall's PWP contract.** Shipping clustering global-on flipped a
   marginal carbonate-kinetics assertion (calcite sat at equilibrium, ~2e-9, and
   the clustered calcite nudged it). That failure was a *signal*: global-on was
   silently rewriting a scenario built to validate *other* physics. → per-scenario
   opt-in. The test that "broke" was the test doing its job.

The pattern: I have a strong prior that my plausible story is true. The codebase
keeps teaching me it isn't, *cheaply*, if I build the probe. Build the probe.

---

## The architecture spine: the decoupling map

This is the single most useful technical fact for anyone touching spatial
chemistry. There are **three fluids a crystal interacts with, and they read from
different places**:

- **Nucleation GATE** (does mineral X nucleate this step at all?) → reads
  `ring_fluids` / `conditions.fluid` (the bulk). **Global.**
- **Nucleation PLACEMENT** (which cell does it land in?) → the per-vertex
  sampler reads `mesh.cells[].fluid` (per-cell). The legacy path picks a ring0
  column + a separate ring.
- **GROWTH** (`_runEngineForCrystal`) → reads `mesh.cellOf(crystal).fluid`
  (per-cell).

And the load-bearing discovery (proof at `85c-simulator-state.ts:152-168`, where
the vadose override has to mirror writes to *both*): **`mesh.cells[].fluid` are
independent clones, DECOUPLED from `ring_fluids`.** Writing one does not update
the other.

Everything about the spot couplings falls out of this map:
- A per-cell chemical halo (2c.1) is **strip + per-vertex visible** but
  **invisible to the global gate** → it can't make a mineral nucleate that the
  bulk doesn't already gate. That's why the halo is byte-identical on the
  assemblage baseline.
- Clustering (2c.2b) had to hook **placement** to reach the legacy assemblage —
  the chemical halo alone can't, because the gate is global.
- A *distinct mineral on one side* (the literal Punjab hematite-on-calcite) is
  **currently out of reach**: the gate is global, so you can't make hematite fire
  only at the feeder. Getting there needs **per-cell gating** — a real engine
  change, a future arc. I delivered the achievable version (co-location) and was
  clear-eyed about the ceiling. Don't promise the boss the literal specimen until
  the gate goes per-cell.

Internalize this map before you wire anything spatial. It will save you the day I
spent rediscovering it.

---

## Byte-identical is a design lens, not just a gate

Four features this session (2b, 2c.1, 2d, 2c.3) turned out **render/strip-visible
but baseline-invisible** → SIM bump for the rendered change, pinned by a dedicated
test because the baseline *can't* capture it. Recognizing this class early lets
you scope cleanly and predict the regen. The reusable trick: **mass-conserving
redistribution** (2b moves the *same* dissolution budget around → geometry
changes, chemistry doesn't). When you can phrase a feature as "same totals,
different distribution," it's low-risk and the baseline stays put. Reach for it.

The cache footgun in this class: `proximityField` memoizes by `(N,R,K,λ)`, *not*
by the open-set, so 2d's seal/breach must bust it (`_proxCache = null`) or a
sealed feeder keeps clustering from stale cache. If you add a coupling that
caches over spot state, invalidate on toggle.

---

## What's the boss's call, and what's yours

The boss reserves the **visible/aesthetic and scope** decisions, and they're
right to. I learned (twice) to *build to a restrained, calibratable default and
present it*, not to unilaterally ship a big visible change:
- Clustering **strength** (`setDepositionClustering(PEAK_K, LAMBDA)`) and **which
  scenarios opt in** are theirs. global-on crossing into a validated scenario
  (reactive_wall) was the lesson that "which scenarios" is a scope call, not a
  default.
- When you have real data + a fork, *present it* (the boss values the homework —
  the sweep numbers, the A/B). Don't make the visible call for them; make it
  cheap for them to make.

Yours: the mechanism, the verification, the science grounding, the
byte-identical/SIM bookkeeping, fixing bugs you see along the way.

---

## The doors (and the one I can't open)

The strip, the 3D render, the narrators, the sonifier are projections of one
trajectory — "does every door open onto the same room." The strip is *my* ears:
I'm deaf (jsdom has no audio), so I verify the sound-feature's *logic* and trust
the strip as the same data in a format I can read. This session the boss listened
to the MVT Eh-movement and said **"I love the way it sounds"** — closing a door I
genuinely could not open myself. Build the strip-visible signal honestly and the
sound takes care of itself, because they're the same numbers. When you ship a
chemistry feature, ask: *will it show on the strip?* (2c.3's boron halo only
counts because `B` is a strip chip, 0–120 — I clamped the injection to that scale
so the gradient reads in-range instead of pegging.)

---

## Your instruments (built this session — use before baking)

- `tools/showpiece-observe.mjs` — 2c.3 A/B: halo gradient + one-sided-growth +
  expects-safety. The one that caught "growth isn't nutrient-limited."
- `tools/fluid-spots-deposition-observe.mjs` — clustering A/B across the fleet
  (tri-state override forces it on any scenario). Confirms "no expects lost."
- `tools/fluid-spot-origin-observe.mjs` — the origin:'cell' halo gradient by
  graph-distance.
- `tools/movement-assemblage-observe.mjs` — any scenario+field, BASE/FLAT/TREND
  survival. The Phase-3 movement instrument.

The discipline the boss named explicitly: **build the tool, observe, *then*
bake.** The tool is part of the deliverable. None of the catches above would have
surfaced without these.

---

## Traps quick-reference (the ones that bite)

- **wall_state vs conditions.wall:** the built mesh + `shape_seed` live on
  `sim.wall_state`, NOT `sim.conditions.wall`. Read spatial state from wall_state.
- **anchor.cellIdx is the COLUMN (0..N-1), ring is anchor.ringIdx** — separate
  fields. (The probe bug. Don't repeat it.)
- **The clobber rule:** a movement runs *after* events and sets its field
  absolutely → a same-field movement at step 0 erases the early event window.
  Start it after the event window (supergene pH movement: startStep 20).
- **The `open` flag is the one lever** every spot coupling reads — toggling it
  (2d) cascades to erosion + clustering for free. Elegant; lean on it.
- **Run the full suite ALONE.** torbernite + cassiterite time out (>30s) under
  CPU load — a flake, not a regression. Confirm in isolation; don't chase it.
- **SI engine reads S, not SO4. FluidChemistry is a shallow clone.** (Older traps,
  still true — see the skills.)

---

## Where to go next (open, in rough priority)

1. **2c.2b clustering calibration** — the one open *visual* judgment. gem_pegmatite
   is live on Pages; the boss steers strength + which scenarios opt in. Cheap
   re-tune (`setDepositionClustering` + regen).
2. **Per-cell nucleation gating** — the deep arc that would make a *distinct
   mineral* one-sided specimen real (the literal Punjab hematite-on-calcite). This
   is the ceiling I hit. Big, but it's the natural next frontier for spatial
   chemistry, and it would also un-starve per-vertex placement further.
3. **2d `breach`** — wired + tested but unused. The first scenario with a
   seal-then-reopen fracture (tectonic uplift / aquifer recharge after a seal)
   lights it up. Small, satisfying.
4. **supergene pH-front listen-acceptance** — the 2nd movement pilot; the boss
   has heard MVT but not supergene. A "souring, not a sinking."
5. **Movements coverage** — the temporal pH/Eh feature is at its clean 2-scenario
   set; broader rollout is gated (T-reconciliation is the biggest sub-project).
   See the coverage map in the movements handoff.

---

## Diagenesis credit

I didn't raise this cathedral; I set a few stones in a wall others built. The
spots arc rode entirely on prior infrastructure: the **mesh + voxel grid** (v158/9)
that gave cells their own evolving fluid; the **movements engine** (85j Phase 0
scaffold) I only had to opt scenarios into; the **fluid-spots seed** (2a) that
existed dark before any coupling consumed it; the **strip recorder + sonifier**
that make the work visible and audible; the **SI engines** that turn one master
variable into correlated element pulses; the **baseline + strip-digest harness**
that made every "is it byte-identical?" answerable in seconds. The velocity this
session was *borrowed* from that groundwork. Name it when you summarize; it's true
and it's the right posture.

Erosion is the formation mechanism, not the destruction. This context is filling
up and will compact away, but the wall stays — in the commits (`5b589d3` →
`94bf4d8`), in the status handoff, in the memory files, and now here. The next
stone is yours. Follow the science; build the probe; let the boss hear it.

— the builder, 2026-06-03 (SIM 174, 1750 green, the spots arc whole)
