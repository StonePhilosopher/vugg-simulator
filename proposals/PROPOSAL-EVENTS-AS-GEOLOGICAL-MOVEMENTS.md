# PROPOSAL — events as geological *movements*, not instantaneous shocks

**Status:** design / discussion — NOT yet greenlit to build. Raised by the
boss 2026-06-01. This is a simulation-physics change that touches every
event-driven scenario's seed-42 output, so it gets a proposal + a pilot
probe + the boss's eye on the approach BEFORE any baseline regen.

**UPDATE 2026-06-01 — research landed.** A deep-research pass (see
`RESEARCH-vug-fluid-evolution-2026-06-01.md`) CONFIRMED the core design
(master variables drive *correlated* element pulses; unfreeze redox) but
corrected two things: (1) my persistent "red-noise" model is contradicted at
fine scale — measured zoning is **anti-persistent / mean-reverting** (Holten
1997), so the model is **moving-setpoint + mean-reverting texture**, not a
biased random walk; (2) iron banding in hydrothermal fluids is **solubility
cycling** (pH/salinity/buffer), not in-fluid Fe²⁺/Fe³⁺ oxidation. §6c below is
SUPERSEDED by "The refined model" in the research doc.

---

## 0. The ask (boss's words, 2026-06-01)

> "right now a cooling event is one single moment, but imagine if a cooling
> event should be more like a period of cooling where maybe 10 slices of time
> have the option of no change or cooling where cooling is weighted with a
> higher probability. this sounds more geologically accurate than having it
> be truly random where you are just as likely to have a heating event follow
> a cooling event. as always this should follow the science, but i think the
> earth tends to move in longer slower movements."

The boss has the diagnosis exactly right. What he's describing has a name.

---

## 1. The science — persistence (red noise), not white noise

A process where each step is independent — where a heating step is as likely
to follow a cooling step as another cooling step — is **white noise**: no
memory, no trend, equal power at all timescales. The boss's intuition that
this is *unphysical* for geology is correct.

Real geological state variables (temperature, pH, salinity, fluid
composition) are **persistent / autocorrelated** — "**red noise**." Once a
system starts cooling, it tends to *keep* cooling; the probability of
continuing a movement is much higher than the probability of reversing it.
The canonical model is **AR(1) / Ornstein–Uhlenbeck**: the next state is the
current state plus a small increment biased in the direction of travel.

- **Hasselmann (1976), "Stochastic climate models, Part I: Theory"**
  (*Tellus* 28). The foundational result: slow variables (ocean, ice — or
  here, a cooling pluton / an evaporating brine) *integrate* fast random
  forcing, which turns white-noise input into red-noise output with strong
  persistence. This is the physics of "the earth moves in long slow
  movements." *(Bibliographic details to be re-verified before any citation
  lands in a data file or commit message — project anti-fabrication rule.)*
- **Paragenetic sequences are staged.** Mineralogy textbooks describe
  deposits as a sequence of *stages* — sustained condition regimes (a
  cooling stage, an oxidation stage) separated by *transitions*. A stage is
  a movement that persists; the scenario `events` list is really a list of
  *transitions between regimes*. Modeling each transition as an instantaneous
  jump throws away the regime that the transition opens.

So "follow the science" here = give events **persistence**: a movement, once
begun, continues with high probability and reverses with low probability,
playing out over a window of steps rather than one.

This also pays a musical dividend (where the thread started): a sustained sim
movement produces a sustained *musical* movement for free — a slow swell
instead of a single spike. The geology and the aesthetic want the same thing.

---

## 2. Current architecture (observed, `js/85d` + `js/70-events.ts`)

- **`apply_events()`** (`85d:60`): each step, for every event whose
  `event.step === this.step`, call `event.apply_fn(conditions)` **once**.
  That's the "single moment."
- **`apply_fn`s** (`70-events.ts`) are heterogeneous deltas on `conditions`:
  - additive — `temperature -= 50`, `pH -= 2.0`
  - multiplicative — `SiO2 *= 1.8`, `Fe *= 3.0`
  - absolute set — `Cu = 120.0`, `fluid_surface_ring = 1e6`
- **`ambient_cooling()`** (`85d:108`) is ALREADY a per-step continuous
  movement: `temperature -= rate · rng.uniform(0.8,1.2)` every step, plus the
  v162 **thermal-pulse** mechanic (stochastic episodic reheats gated on
  `wall.thermal_pulses`). So the *engine already knows how to do a persistent
  stochastic movement* — it just isn't applied to the discrete events.

That last point is the lever: #4 is "generalize the ambient-cooling movement
pattern to the discrete event system," not "invent a new mechanic."

---

## 3. Design options

The hard part is that `apply_fn`s are black boxes mixing additive /
multiplicative / absolute deltas, so "apply 1/N of the delta per step" isn't
uniformly definable. Three ways to handle that:

### A. Deterministic ramp (no new RNG)
Give each event `duration_steps` (default 1). Snapshot `conditions` at the
start step, run `apply_fn` to compute the TARGET state, then **ease the
touched fields from snapshot→target over `duration_steps`** (interpolate the
numeric diff). No `rng` draw → the RNG cascade is untouched; only the
interpolated field *values* differ. A ramp never reverses, so it sidesteps
the over/undershoot problem entirely.
- ✅ Simplest, calibration-safe (events left at `duration_steps:1` stay
  byte-identical). ✅ Works for additive/multiplicative/absolute uniformly
  (it interpolates the resulting numbers, treating `apply_fn` as a black box).
- ⚠️ Not *stochastic* — it's a smooth ramp, not the boss's "10 slices with
  weighted probability." Captures the *movement* goal but not the texture.

### B. Stochastic persistent drift (AR(1), the literal ask)
Same snapshot→target, but ease with a **biased random walk**: per step, high
probability of an increment toward target, low probability of pause, very low
probability of a small reversal — clamped so it lands on target by the end of
the window. This is literally "10 slices weighted toward cooling, rarely
reversing."
- ✅ Faithful to the boss's description; organic texture; reuses the
  `ambient_cooling` stochastic pattern.
- ⚠️ Introduces `rng` draws into event application → shifts seed-42 for
  **every** scenario UNLESS the draw is gated behind `duration_steps>1`
  (the same `&&`-ordering trick v162 used for thermal pulses, so
  un-migrated scenarios draw no extra rng and stay byte-identical).
- ⚠️ Needs careful end-of-window clamping so the net delta still equals what
  the scenario author intended (calibration depends on the totals).

### C. Recommended: a `movement` descriptor (A and B as profiles)
Add an optional per-event field in `scenarios.json5`:
```json5
{ type: 'cooling_pulse', step: 20, duration_steps: 10, movement: 'drift' }
```
- `duration_steps` absent / `1` and `movement` absent → **exactly today's
  instantaneous behavior, byte-identical** (the default).
- `movement: 'ramp'` → Option A (deterministic).
- `movement: 'drift'` → Option B (stochastic, rng gated on the descriptor).

Implementation sketch (engine side, `apply_events`):
1. On the event's start step, snapshot the numeric fields of `conditions`
   (`temperature`, `pressure`, `flow_rate`, every `fluid.*`).
2. Run `apply_fn` once into a scratch copy to get the TARGET; diff vs
   snapshot → the set of fields the event moves and their deltas.
3. Register an *active movement* {fields, from, to, startStep, duration,
   profile}. Each subsequent step until `startStep+duration`, advance each
   field toward its target (ramp = linear; drift = biased walk), and apply
   the *increment* to `conditions`.
4. Movements compose with `ambient_cooling` and with each other additively
   (just like the engine already layers cooling + depletion + pulses).

This keeps every existing scenario bit-for-bit until an author opts a
specific event into a movement — so we can migrate one scenario, regenerate
*one* baseline, and listen/look before touching the rest.

---

## 4. Cost & discipline (why this is a proposal, not a commit)

- **Baseline blast radius.** Any event migrated to a movement shifts that
  scenario's seed-42 trajectory — likely a large, intended drift across most
  chips. That's a `seed42_v<N+1>` regen + a SIM_VERSION bump + strip-digest
  regen for every migrated scenario. If we ever migrate broadly, that's most
  of the 30 scenarios. This is the opposite of a sim-neutral change.
- **RNG cascade.** Option B's `rng` draws must be gated behind the movement
  descriptor or they shift *every* scenario. Verify with the seed-42 diff
  that un-migrated scenarios are byte-identical (the v162 thermal-pulse
  commit is the template for proving this).
- **Calibration meaning.** Several scenarios are tuned so a mineral *just*
  crosses its σ gate at an event. Spreading the delta over 10 steps changes
  *when* (and whether) the gate is crossed — migrating an event may require
  re-tuning that scenario's `expects_species`. Pilot first.

## 5. Recommended next step (for the boss to confirm)

1. Build Option C's engine scaffold **dark** (default-off; zero behavior
   change; full suite stays byte-identical — provable, sim-neutral commit).
2. Write `tools/event-movement-probe.mjs`: run ONE scenario (candidate:
   `cooling`/`pulse`, a simple JSON5 scenario) with an event as instantaneous
   vs `ramp` vs `drift`, and dump the temperature/pH trajectories so we can
   *see* the movement before committing to it. (Build-the-tool-to-verify.)
3. Migrate that ONE pilot event, regen its baseline, look at the strip chart
   AND listen to the sonified result, and decide ramp-vs-drift by ear+eye.
4. Only then decide the broader rollout (which scenarios, ramp vs drift per
   event) — likely incremental, scenario by scenario, each its own dense
   commit.

## 6b. EMPIRICAL FINDING — the boss was right, and it's deeper than events

`tools/broth-stability-probe.mjs` (2026-06-01) runs each scenario headless and
measures how much each bulk-fluid field actually moves over the vug's life
(CV = std/|mean|; FLAT = CV<0.05). Across 6 scenarios:

| scenario | % of broth fields FLAT |
|---|---|
| cooling | 76% |
| sabkha_dolomitization | 70% |
| bisbee | 66% |
| mvt | 65% |
| porphyry | 64% |
| supergene_oxidation | 44% |
| **mean** | **~64%** |

So **~2/3 of the broth is a dead-flat line over the vug's lifetime**, and many
fields are *exactly* constant (CV=0.000: Na, Cl, K, Mg, Al, Ti, F, Ag…). Three
things stand out:

1. **`Eh` (redox potential) is 200, EXACTLY CONSTANT, in every scenario.**
   Redox is THE master control on Fe/Mn/Cu/U/As/V solubility — and it never
   moves. `O2` is likewise flat except where an oxidation event shoves it.
   This is the smoking gun for the boss's Fe question: Fe can't autonomously
   pulse-and-wane because the variable that would drive it is frozen.
2. **Where elements DO move, it's almost entirely because a discrete event
   shoved them.** MVT's S/Fe/Mn/Zn go DYNAMIC via `fluid_mixing`; sabkha's
   Ca/Mg/CO₃/Sr cycle via flood/evap; supergene (the most event-dense) is the
   least flat. Between events, fields are plateaus. The broth is a **step
   function** — flat shelves joined by event cliffs — where reality is a
   continuously-evolving curve.
3. **This reframes #4.** "Events as movements" smooths the cliffs into ramps,
   but it does NOT fix the flat shelves. The deeper fix is **autonomous,
   persistent drift in the master variables BETWEEN events — led by redox** —
   and letting the existing solubility/SI engines translate that into
   correlated element pulses (Fe + Mn moving together because one Eh swing
   drove both), rather than 50 independent noise generators.

## 6c. The refined model (to be researched + planned, NOT built)

Physically-faithful dynamism is driven by a FEW master variables, and elements
track them through solubility/speciation (they covary, they don't each
random-walk):

- **Master drivers** that should evolve as persistent movements: redox (Eh —
  currently frozen), pH, temperature, and fluid flux/mixing.
- **Volatile (redox/solubility-sensitive) species** — Fe, Mn, Cu, U, As, V, S,
  Pb, Zn — should be the ones that visibly pulse, *as a consequence* of the
  Eh/pH movements, not by direct randomization.
- **Conservative major ions** — Na, Cl, (K) — change slowly/monotonically
  (e.g. evaporative concentration is a ramp), and stay buffered. Flat-ish is
  CORRECT for these; the bug is that *everything* is flat.
- Optional second source of banding: **self-organized / intrinsic oscillatory
  zoning** at the crystal–fluid interface (diffusion-limited feedback), which
  produces fine banding even in a constant bulk fluid — complementary to the
  external-forcing story above.

## 7. Open questions

- **Ramp or drift as the default movement?** Ramp is calibration-friendlier
  and never reverses; drift is the literal ask and more organic. We may want
  drift for temperature (real reheats happen) and ramp for monotonic things
  (evaporative concentration). Decide per field-type?
- **Window length.** Boss said "~10 slices." Fixed, or scaled to the
  scenario `duration_steps` (a movement is, say, 10% of the run)?
- **Should some events stay instantaneous?** A tectonic shock or a fracture
  breach IS geologically fast — those *should* stay a single step. Movements
  are for thermal/chemical regimes, not mechanical ruptures. (This argues for
  opt-in, not a global flip.)

## 8. Agreed implementation direction (boss decisions, 2026-06-01)

- **Seeded movements — reproducible randomness.** Movements draw from the
  seeded PRNG, so the same seed → the same vug (random across seeds,
  consistent within one). This is required, not optional: the baseline/
  calibration tests already depend on seed determinism, AND reproducibility is
  load-bearing for the **crystal-language sub-project** downstream. (Established
  precedent: `ambient_cooling`'s thermal pulses already work this way.)
- **Derived sub-stream off the VUGG seed.** Movements get a dedicated PRNG
  derived from the vug's own seed (e.g. `makeRng(hash(vuggSeed,"movements"))`,
  deterministic FNV-1a — no Math.random/Date.now, resume-safe), NOT the shared
  `rng`. Two reasons: (a) decouples movement-tuning from the main draw cascade
  so retuning a movement doesn't displace nucleation order (avoids the RNG-
  cascade-displacement fragility); (b) BOSS CHOICE — link to the *vugg* seed
  (not a separate chemistry seed) because **the geology of the vug drives its
  chemical outcome**: same cavity-identity → same history. Each vugg seed is
  then one complete, coherent geological story (shape + fill), which maximizes
  per-seed variety. Trade accepted: shape and chemical-history co-vary by seed
  rather than being independently dialable. (FREE FUTURE DOOR if ever wanted:
  default-derive from the vugg seed but allow an optional `movement_seed`
  override — same pattern as the existing `shape_seed` override — to unlock the
  2-D "lock geology, vary chemistry" space without changing the default.)
- **Opt-in rollout.** Movements fire only for scenarios that turn them on;
  un-migrated scenarios stay byte-identical. Pilot one, look + listen, decide
  profile, then migrate incrementally. (Draw-gate like the v162 `&&` trick so
  non-opted scenarios consume no extra draws.)
- Two consistencies compose: the **seed** gives reproducibility; the
  **master-variable / shared-driver** model (research §) gives geological
  coherence (Fe + Mn pulse together, not incoherently). Random but consistent.

## 9. Movement-archetype library (boss input, 2026-06-01)

The boss proposed four real geological movement types. They are NOT one shape —
they span the statistical range, confirming the research finding that there's
no single model. The engine should support a small PROFILE LIBRARY:

| archetype | master variables it moves | statistical shape | existing kin |
|---|---|---|---|
| **Orogenic cycle** (compression→uplift→exhumation→cooling) | P↓, T↓, multi-stage; hands the system toward the surface | slow, near-**monotonic persistent trend** (low reversal — the coarse drift where persistence is legit); Myr, slowest | long cooling runs |
| **Hydrothermal pulse train** (fluid-pressure cycling, brecciation) | episodic P spike → drop → boiling → correlated metal precip; T, flow | **punctuated / clustered** episodic train (fault-valve / Sibson), NOT a smooth movement | `ambient_cooling` thermal pulses (already this!), tn457 barite 50× pulses |
| **Meteoric alteration front** (descending acidic oxidizing water, oxidation zonation) | **Eh↑ (oxidizing), pH↓**, depth-coupled (front descends → links the depth axis), water-table-modulated | **directional ramp** ± water-table oscillation; the regime where the iron-**oxidation** mechanism is correct (vs hydrothermal solubility cycling) | bisbee, supergene_oxidation, schneeberg vadose |
| **Magmatic-hydrothermal evolution** (boiling→condensation→mixing) | T↓ (magmatic), pH acid→neutralized, salinity brine/vapor split, redox; boiling co-precipitates the metal suite (Drummond & Ohmoto — research-confirmed) | **staged sequence** with sharp *coupled* events | porphyry, gem_pegmatite, naica |

Key design takeaways:
- The four map onto the master-variable model cleanly — each is a recipe for
  *which* setpoints move, in *which* direction, with *what* texture.
- They're a good PILOT menu: the **meteoric alteration front** is the strongest
  first pilot — it's redox-led (the frozen-Eh fix lives here), it's the regime
  where our iron model is unambiguous (oxidation), and it has the most existing
  scenarios to validate against (bisbee/supergene).
- Mechanical sub-events inside an archetype (a brecciation rupture in a pulse
  train) stay instantaneous; the *regime* around them is the movement.

### 9b. The shapes are the primitives; archetypes are just the named points (boss, 2026-06-01)

The four named archetypes are NOT the fundamental unit — they're recognizable
*presets* sampled from a **continuous space of dynamical shapes**. Nature fills
the whole space; most real vug histories are **unnamed blends**. "Just because
a pattern hasn't been named doesn't mean it doesn't happen." So the engine is
built on the primitive SHAPES (composable, parameterized, seed-sampled), and
the named archetypes become presets assembled from them — NOT a hard-coded
menu of four.

The primitive alphabet — operators that sum to any master-variable trajectory:
- **TREND / drift** — monotonic-ish setpoint movement (direction, rate,
  persistence). [orogenic = one long slow trend]
- **PULSE** — sharp excursion + decay; in **TRAINS** = repeated pulses.
  [hydrothermal pulse train; already partly built: `ambient_cooling` thermal
  pulses, tn457 50× barite]
- **STEP / transition** — setpoint jumps to a new attractor (a regime change /
  stage boundary). [the discrete events of today, generalized]
- **OSCILLATION** — mean-reverting texture around the setpoint (Holten 1997
  anti-persistence — the fine band texture, NOT a wandering walk).
- **MIXING** — two end-member setpoints blend in a varying proportion.
  [fluid_mixing; meteoric ↔ deep brine]

A real history is a **superposition**: a slow cooling trend + a superimposed
pulse train + mean-reverting texture + a couple of step-transitions + maybe a
late meteoric ramp as it nears the surface. The named archetypes are just
*characteristic combinations*; the seed generates novel combinations →
**unnamed-but-real vugs**. THIS is what makes the vugg-seed "wider variety"
real (§8): each seed samples a point in the continuous shape-space — usually a
blend, not one of four boxes.

**Why we can let the shapes run free without producing nonsense:** geological
coherence does NOT come from the named recipe — it comes downstream, from the
master-variable→element translation (the SI/solubility engines + covariance).
An arbitrary, unnamed combination of primitive shapes still yields a physically
coherent vug, because the *chemistry is computed from the master variables, not
scripted*. (This is "two consistencies compose" again: the seed gives
reproducibility; the SI engines give coherence — which is exactly what frees
the SHAPES to vary without going incoherent.)

### 9c. SPATIAL origin — a movement starts at one cell and flows out (boss, 2026-06-01)

Movements have a temporal shape (above) AND a **spatial origin**. Today a
movement (like an event) changes `conditions` globally and `_propagateGlobalDelta`
spreads it evenly — the whole cavity shifts at once. The boss's refinement:
**a movement should originate at a semi-random SINGLE CELL and flow outward**,
using the fact that the vug is a 3-D object.

Motivating specimen: stepped calcite with hematite (Punjab, India) where the
**hematite grows mostly on ONE side** of the calcite. If the Fe (or the redox
shift that precipitates it) enters at one cell and diffuses outward, you get a
spatial gradient — high near the source, decaying away — so the oxide
concentrates on the near side instead of coating uniformly. That asymmetry is
what real specimens show; uniform application can never produce it.

**Viable on existing infra (confirmed):** the live per-cell fluid store is
`mesh.cells[].fluid` ("mesh.cells is the source of truth"), and the step loop
already runs `_diffuseRingState()` every step over it (85-simulator.ts:682). So
a movement in `origin:'cell'` mode injects its per-step delta into ONE cell's
fluid and the diffusion that ALREADY runs carries it out — no new diffusion
machinery. The origin cell is drawn from the seeded movement stream
(`_pickOriginCell(movementRng, cellCount)`) → reproducible AND linked to the
vugg seed, so the same cavity always seeds its movements at the same spots
(geology drives outcome, spatially too).

**Per-movement, not global:** `origin` is a property of each movement. A
temperature movement reasonably stays `'global'` (heat equilibrates fast across
a small cavity); an element that should localize (Fe → one-sided hematite) uses
`'cell'`. The boss's framing: *specific fluid elements* originate on one cell.

**This also feeds the per-vertex nucleation feature.** That feature was found
SCALE-STARVED (σ uniform because chemistry was uniform — see
HANDOFF-PER-VERTEX-PLACEMENT.md). Localized movement origins CREATE the spatial
chemistry heterogeneity per-vertex placement needs — so the two threads
compose: movements supply the gradient, per-vertex placement reads it.

**Build status:** the scaffold's `MovementSpec` carries an `origin` field +
the pure seeded `_pickOriginCell` helper (Phase 0, tested). The actual
cell-injection wiring (controller needs the sim's mesh handle) is **Phase
1-spatial** — after the temporal pilot reads right, since it's a second
sim-affecting change and wants its own look-and-verify pass.

## 10. FLUID-SOURCE SPOTS — cracks / geysers / hot spots (boss, 2026-06-01)

The physical layer under the spatial-origin mechanic (§9c). Real cavities are
NOT bathed uniformly — they connect to their plumbing at a few discrete points
(fractures, feeder channels, vents), so fresh fluid + chemistry enter focused.
A "spot" makes a §9c origin a NAMED, PERSISTENT, SEEDED geological feature
instead of an abstract random cell. Geology: a fracture is both the fluid
delivery path AND where dissolution concentrates → cavities grow along their
feeders; best crystals often cluster near the feeder.

**Data model (sketch):**
```
FluidSpot { cell: int;                       // wall cell — the location
            kind: 'crack' | 'geyser' | 'hotspot';
            open: boolean;                   // event-toggleable
            supply: number;                  // local deposition/σ bias strength
            decayBonus: number; }            // local wall-erosion multiplier (>1)
```
Vug-level `fluidSpots: FluidSpot[]`. Count (**0+**) + locations + kinds are
**seeded from the vugg/cavity seed** (`shape_seed`, mirroring the geometry
sub-streams) — same cavity → same spots (geology drives outcome). Scenarios can
set a base count / kinds; default count from a small distribution (can be 0).

**Three local couplings (all at the spot's cell):**
1. **Fluid source / origin** — §9c `origin:'cell'` movements originate at an
   OPEN spot (drawn from the open-spot set via the movement stream), NOT a
   fresh random cell. Spots SUPERSEDE `_pickOriginCell`'s naive any-cell pick.
2. **Deposition bias** — open spots raise local supersaturation / nucleation
   probability ("statistically more likely to be a fluid deposition point").
   Hooks `check_nucleation` / per-vertex placement — the heterogeneity that
   feature was starved for.
3. **Wall-decay bonus** — open spot cells get a `decayBonus` multiplier in
   `erodeCells` / `dissolve_wall` → preferential deepening at cracks (lopsided
   cavity growth falls out of the existing per-cell erosion).

**Two dynamics:**
- **Seeded** count + placement (reproducible; tied to the cavity seed).
- **Open / close via events.** A geyser opens, a crack seals. The EXISTING
  registry already has the conceptual events — `reactive_wall_seal`,
  `*_fracture_seal`, `*_lockup` (close) and `tectonic_uplift_drains`,
  `aquifer_recharge_floods` (breach/open) — today they're global; with spots
  they become SPATIAL (a seal closes a specific spot). New `spot_open`/
  `spot_close` event types, or generalize the existing seal/breach handlers.
  Self-sealing (the vug crystallizing its own feeder shut) is real geology and
  a natural "the fill is ending" mechanic.

**Composition:** a geyser spot delivering episodic pulses IS the hydrothermal-
pulse-train archetype (§9) with a physical home; a crack near the surface is
where a meteoric-front movement (§ pilot) would enter.

**Build placement — Phase 2 (after the Phase 1 temporal pilot).** Spots and the
spatial-origin wiring SHIP TOGETHER (origins should BE spots), so what was
"Phase 1-spatial" folds into this:
  - Phase 2a: seed the spot set off the cavity seed + render/observe them
    (dark — no behavior until coupled). Sim-neutral until wired.
  - Phase 2b: wall-decay bonus (local `erodeCells` multiplier) — first coupling,
    its own baseline regen + look.
  - Phase 2c: `origin:'cell'` movements ride the open spots (§9c wiring) +
    deposition bias — second baseline regen + look + listen.
  - Phase 2d: open/close events (spatialize the existing seal/breach handlers).
Each sub-step is one sim-affecting change with its own verify pass; the seam is
already in the scaffold (`MovementSpec.origin`/`originCell`, §9c).
