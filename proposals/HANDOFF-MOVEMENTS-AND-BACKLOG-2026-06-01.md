# HANDOFF — Geological Movements project + carried backlog (2026-06-01)

**What this is:** the single master document for the active **Geological
Movements** project AND a distilled, current snapshot of the whole open
backlog. Part I = the project we're building now. Part II = everything else
we want to do, carried forward. The next builder can act from this doc alone.

**Tip state:** `origin/main` (Syntaxswine) current; **SIM_VERSION 167**; full
suite green; working tree clean. Canonical (`StonePhilosopher`) minerals.json
FIXED 2026-06-01 (`083d994`, boss).

---

## ★ North Star — follow the science (boss, 2026-06-01)

The North Star of the whole project is **follow the science**: at every step,
model what real rocks actually do. The **finish line** — a *replication of life
with backward compatibility* (show a photo of a real crystal, get back the
seeds + settings that regrow it — the inverse of crystal-cipher) — is NOT a
target you aim at directly. It is the **inevitable consequence** of following
the science faithfully:

- You can't aim at "replicate all of life" — too big, unknowable. You CAN
  answer, at every step, "is this what real rocks do?" Faithful local steps
  compose into a faithful whole.
- **Invertibility is inherited, not engineered.** Nature's processes are
  deterministic functions of their conditions — a zoned crystal IS the record
  of its fluid history. A model that mirrors the physics inherits its
  invertibility from reality; we only have to not break it (hence seed-linking,
  deterministic streams, no wall-clock).
- The inevitability holds **only if every step is science-true.** One fabricated
  citation or unchecked "good enough" mechanism snaps the guarantee — it inserts
  a step that doesn't compose toward the real thing. So the discipline (verify
  sources, defer to geology, observe before assert, never fabricate) isn't
  caution for its own sake — it's what keeps the destination reachable.

Every arc — Movements included — needs no other justification than: *it is the
next faithful step.* Movements aren't chrome; they're "model what real broths
actually do."

---

# PART I — THE GEOLOGICAL MOVEMENTS PROJECT (active)

## The problem (measured, not assumed)
`tools/broth-stability-probe.mjs` (2026-06-01): **~64% of broth fields are a
dead-flat line** over a vug's life (cooling 76%, sabkha 70%, bisbee 66%, mvt
65%, porphyry 64%, supergene 44%). **`Eh` (redox) is frozen at 200 in every
scenario** — the master control on Fe/Mn/Cu/U/As/V, nailed down. Where elements
move at all, it's because a discrete event shoved them. The broth is a **step
function**; real vug chemistry is a **continuously evolving curve**.

## The science (settled — see the docs)
- `RESEARCH-vug-fluid-evolution-2026-06-01.md` — deep-research pass, 23
  verified findings, research-grade citations (NOT yet project-canonical —
  open-the-source before any land in code/data, per the v145 rule).
- **Confirmed:** master variables (T, pH, redox) drive chemistry; elements
  **covary** off shared drivers, not independently (boiling co-precipitates
  Au-Ag-Cu-Pb-Zn — Drummond & Ohmoto 1985). Unfreezing **redox** is the #1 fix.
- **Correction 1 (red noise):** measured natural zoning is **anti-persistent /
  mean-reverting** at fine scale (Holten 1997), NOT a persistent random walk.
  Model = **moving setpoint + mean-reverting (OU) texture**. Hasselmann-1976
  red-noise transfer to geochemistry is unsupported (my analogy, flagged).
- **Correction 2 (iron):** hydrothermal Fe is dominantly ferrous, transported
  as Cl complexes → banding is **solubility cycling** (pH/salinity/buffer), NOT
  in-fluid Fe²⁺/Fe³⁺ oxidation. The oxidation story is the **supergene** regime.
- Self-organized intrinsic zoning is real (Barker & Cox 2011) → a separate,
  lower-priority lane for fine texture; coarse stage-banding is what we model.

## The design (agreed — see PROPOSAL-EVENTS-AS-GEOLOGICAL-MOVEMENTS.md §8/§9/§9b)
- **Primitive alphabet, not a menu.** Master-variable trajectories = sums of
  composable operators: **TREND / PULSE (trains) / STEP / OSCILLATION
  (mean-reverting) / MIXING.** Named archetypes (orogenic, hydrothermal pulse
  train, meteoric front, magmatic-hydrothermal) are just **presets**; the seed
  samples the *continuous* space, so most vugs are unnamed blends. "Just because
  a pattern hasn't been named doesn't mean it doesn't happen."
- **Elements are NOT randomized.** Move the master variables; let the existing
  saturation/SI engines translate that into *correlated* element pulses. The
  seed gives reproducibility; the SI engines give geological coherence; so the
  shapes are free to vary without going incoherent.
- **Seeded movements from a dedicated sub-stream off the VUGG seed.**
  `makeRng(hash(vuggSeed,"movements"))`, deterministic FNV-1a (no
  Math.random/Date.now — resume-safe). Boss's call: link to the *vugg* seed
  (not a separate chemistry seed) so the vug's geology drives its chemical
  outcome — one coherent story per seed, maximal per-seed variety. Dedicated
  stream (not shared `rng`) so movement-tuning doesn't displace nucleation order.
  Reproducibility is **required**: baseline tests depend on it AND the
  crystal-cipher sub-project (Part II-B) needs bit-exact regeneration.
- **Opt-in rollout.** Movements fire only for scenarios that opt in;
  un-migrated scenarios stay byte-identical (draw-gate like the v162 thermal-
  pulse `&&` trick). Pilot one, look + listen, then migrate incrementally.
- **Mechanical sub-events stay instantaneous** (a brecciation rupture); the
  *regime* around them is the movement.

## Build plan (phased)
- **✅ Phase 0 — dark scaffold (DONE — `e87bf9d` + `91e18b4`).** Movement PRNG +
  primitive operators + OU texture + no-op-safe applicator + the SPATIAL-origin
  data model (`origin` field + seeded `_pickOriginCell`), all **default-off →
  proven sim-neutral** (seed-42 + strip-digest byte-identical, 1712/1712, NO
  SIM_VERSION bump). The engine exists; nothing opts in yet.
- **Phase 1 — meteoric-front temporal pilot.** Opt ONE supergene scenario in
  (bisbee/supergene_oxidation/schneeberg). Redox-led (exercises the frozen-Eh
  fix), the regime where our iron model is unambiguous (oxidation), most
  existing scenarios to validate against. Regen that one baseline (SIM bump),
  look at the strip + listen, decide ramp-vs-drift / texture by eye + ear.
  (Open decision: scenario + ramp-vs-drift.)
- **Phase 2 — fluid-source spots (spatial).** See PROPOSAL §10. Cracks/geysers/
  hot spots: seeded (off the cavity seed) wall points that (a) anchor
  `origin:'cell'` movements, (b) bias local nucleation/deposition, (c) add a
  local wall-decay bonus, (d) open/close via events (spatializing the existing
  seal/breach handlers). Sub-steps 2a seed+observe (dark) → 2b wall-decay bonus
  → 2c origin-rides-spots + deposition bias → 2d open/close events; each its own
  baseline regen + look. This is the physical body of §9c and feeds per-vertex.
- **Phase 3 — incremental rollout.** Migrate further scenarios/archetypes one
  at a time, each its own dense commit + baseline regen.
- **Open knob:** "how fast" (movement timescales) is UNQUANTIFIED by the
  research → it's ours to calibrate to band-count + visual/sonic readability
  (sim runs ~100–260 steps; real vugs 10³–10⁶ yr). Informed by, not bound to,
  geology.

## Dark observation — what the engine actually does (2026-06-01)
`tools/movement-dark-observe.mjs` (uncommitted instrument): injects ONE movement
at RUNTIME onto a scenario (3 variants — A baseline / C trend-only / B trend+OU),
no committed file touched, no baseline regen. The first faithful step paid off
and **reframed Phase 1**:

- **F1 — temperature is ALREADY a movement.** `ambient_cooling()` runs EVERY
  step (85-simulator.ts:673): a cooling drift + stochastic thermal-pulse
  re-warming, on the **shared `rng`**. So `events:[]` never meant "T is flat."
  Movements should eventually **subsume** this (declarative TREND+PULSE on the
  dedicated reproducible stream), not run alongside it. Also: driving T with OU
  produced chaotic B−C divergence (≈60°C) — **sensitive dependence** through the
  cooling-mechanic feedback. Don't drive temperature with texture until
  ambient_cooling is reconciled.
- **F2 — Eh is frozen at 200 AND INERT.** `EH_DYNAMIC_ENABLED` (20c-chemistry-
  redox.ts:165) is OFF by default; every redox engine gates on `fluid.O2`, not
  `fluid.Eh`. **A movement on Eh is a downstream no-op until Phase 4c.** The
  headline "frozen Eh" is a Phase-4 redox-wiring gap, NOT a movements gap.
- **F3 — the live lever today is pH.** Nearly flat in baseline (CV 0.02–0.06)
  yet pivotal (every carbonate/sulfate SI + metal-solubility engine reads it).
  O2 is also live but already moved by the vadose override in supergene.
- **THESIS CONFIRMED** — driving pH down (smoothstep TREND −2 + OU σ0.12) makes
  the SI engines emit **correlated, geologically-correct** element pulses
  (elements never randomized directly):
  - `cooling` (closed): pH 6.8→5.4 curve; **Ca CV 0→0.38, CO₃ 0→0.65 UNFROZEN**
    (acidification dissolves carbonate — textbook); Fe 0.61→0.67, Mn 0.55→0.60.
  - `supergene_oxidation`: pH 6.8→5.3; **Mn 0.04→0.17 UNFROZEN**, Fe 0.14→0.22,
    S 0.64→0.76, Ca 0.13→0.42, CO₃ 0.11→0.33 — a meteoric acid front mobilizing
    metals (faithful: sulfide oxidation → H₂SO₄).
- **Q2 OU visibility — KEEP IT.** Texture is VISIBLE (3–9× the trend's
  step-to-step Δ at the smoothstep-flat ends), bounded and mean-reverting
  (clean-overlay PASS). **ramp-vs-drift is ANSWERED: BOTH** — a smoothstep TREND
  setpoint + OU texture = the research's moving-setpoint+OU model, confirmed to
  render at sim resolution.
- **Correction logged.** An early run mis-set the field path (`'pH'` vs
  `'fluid.pH'` — paths are relative to `conditions`, fluid fields live under
  `conditions.fluid.*`) → the controller silently skipped (base NaN). I
  mis-attributed the no-op to open-atmosphere pH re-solve; verified WRONG — only
  `naica` is `open_to_atmosphere`. Mechanism beats plausible narration.

**Open decisions REFRAMED for Phase 1** (was: scenario + ramp-vs-drift):
  1. **Strategy fork** — (a) drive **pH now** (the live lever; correlated pulses
     today) vs (b) flip `EH_DYNAMIC_ENABLED` / do Phase 4c FIRST so **Eh** becomes
     the master redox variable (bigger; addresses the frozen-Eh headline directly).
  2. **Pilot scenario** — `supergene_oxidation` (faithful meteoric front,
     recommended) vs `cooling` (max carbonate unfreeze) vs other.
  3. ramp-vs-drift — **resolved: keep the OU texture** (visible + bounded).

## Phase 4c — MAKE Eh LIVE (boss chose this 2026-06-02, before any pilot)
Boss decision: wire Eh to actually drive chemistry FIRST, then pilot a movement
on **`mvt`**. Rationale: a movement on an inert variable is a no-op; make it
physical first. Scoping found the redox migration is far more complete than its
comments suggested — the per-class helpers (sulfate/hydroxide/oxide×3/arsenate/
carbonate×3/sulfide×3/molybdate/phosphate/silicate/native×4) are **fully wired at
250+ call sites**, all flag-gated with a `fluid.O2` passthrough. The keystone gap:
**`fluid.Eh` is written once at init and never synced** — so flipping the flag with
frozen Eh feeds every engine a constant fake O2. The fix stages cleanly because
`ehFromO2`/`o2FromEh` are **exact inverses for O2 ∈ [0.05, 5]** (0.000% round-trip;
diverges only above O2=5, unreachable by any scenario → clamp in 4c.2).

- **✅ 4c.1 — Eh observer sync (DONE, byte-identical, NO SIM bump).**
  `_syncRedoxEh()` (85c) sets `fluid.Eh = ehFromO2(fluid.O2)` on every container
  (ring_fluids + voxels/mesh.cells), called at the END of run_step (after
  diffusion, before strip capture). Flag stays OFF → nothing reads Eh → seed-42
  byte-identical (calibration green) AND Eh not in the strip digest (also green,
  no regen). Eh now UNFREEZES on the strip (supergene Eh CV 0→0.22 tracking O2;
  cooling O2-flat→Eh pins at −75, correct). 3 tripwires in redox.test.ts.
- **✅ 4c.2 — flipped `EH_DYNAMIC_ENABLED` (DONE, SIM 167→168).** `let`+setter
  (mirrors setCarbonateKspActive). Early sync added before check_nucleation;
  end-of-step sync kept for the strip. **FluidChemistry constructor now derives
  Eh=ehFromO2(O2) when O2 given but Eh isn't** — makes hand-built fluids
  (tests/tools) redox-self-consistent under the flag; sim-invisible (the early
  sync overwrites it). 29/31 scenarios byte-identical; radioactive_pegmatite +
  schneeberg float-cascade (≤4.4e-16 round-trip ε tips a threshold), NO mineral
  lost. Baselines regen'd (seed42_v168; strip_digest byte-identical but version
  stamp). Full suite 1717/1717. Redox tests: parity blocks wrapped in
  setEhDynamicEnabled(false) using a LIVE flag read (snapshotEhDynamicFlag —
  the exported EH_DYNAMIC_ENABLED is a frozen load-time snapshot); flag-state +
  consumed-path tests added. No O2≤5 clamp needed (max observed O2≈2.2;
  o2FromEh saturates >5 gently). Commit: 4c.2.
- **✅ 4c.3a — Eh-CANONICAL mechanism (DONE, sim-neutral, no bump).** Boss chose
  "follow the science" → Eh is the master redox axis (O2 is one expression).
  `_syncRedoxEh(ehCanonical)`: default O2→Eh (the 4c.1/4c.2 view); when a movement
  drives fluid.Eh this step, flip to Eh→O2 so the movement's Eh survives to the
  engines instead of being clobbered. `MovementController.drivesFieldAt(field,
  step)` gates it; run_step passes the flag to both sync call sites. No scenario
  opts in → ehCanonical always false → byte-identical (calibration green, still
  v168). Tests: drivesFieldAt unit + injected-Eh-movement sim test (O2 derives
  from the movement's Eh). NB: vadose-override O2 writes + an Eh movement on the
  SAME cells is a per-cell-ownership conflict deferred to Phase 2; mvt (the pilot)
  is closed/no-vadose so the coarse whole-cavity flip is exact there.
- **✅ 4c.3b — `mvt` Eh-movement pilot SHIPPED (SIM 168→169). FIRST real movement.**
  Grounded in RESEARCH-mvt-redox-2026-06-02.md (deep-research, verified): MVT ore
  fluid is REDUCING during sulfide deposition (log fO2 −52…−55), but barite (a
  sulfate) belongs to an EARLIER less-reducing gangue stage — research CORRECTED my
  first sketch (an oxidizing↔reducing oscillation was wrong; discarded). Dark-
  observed both candidates (tools/mvt-redox-observe.mjs): a FLAT reducing baseline
  WIPES barite + sphalerite; the chosen **+50 → −250 mV smoothstep TREND + OU**
  preserves the full expects_species (barite kept as the early oxidizing stage,
  galena boosted 1×→4× as it reduces late) — the Tri-State paragenetic order
  (sulfate gangue early → sulfide ore late). mvt's scenarios.json5 gains a
  `movements` block; Eh-canonical (O2 follows). Only mvt changed; all other
  scenarios byte-identical; seed42_v169 + strip_digest regen; suite 1719/1719.
  **REMAINING: boss LOOK (strip Eh chip should sweep +60→−246, paragenetic barite-
  early/galena-late) + LISTEN (sonifier) — the sensory acceptance I can't do —
  then tune shape by eye+ear if wanted.**

**★ The "make Eh live" arc is COMPLETE (4c.1 observer → 4c.2 consume → 4c.3a
Eh-canonical → 4c.3b first movement).** Eh went frozen+inert → live, consumed, and
drivable, with the first geological movement (mvt redox trend) shipped. The
Movements engine is now PROVEN end-to-end on a real scenario. Next arcs: Phase 3
incremental rollout (more scenarios/archetypes opt in, each its own commit +
look+listen) and Phase 2 fluid-source spots (spatial).
- **Latent note:** even flag-ON, the helpers use the coarse `ehFromO2` bijection,
  NOT the principled Nernst couples (`REDOX_COUPLES`/`redoxFraction`, built in 4a,
  still uncalled). Richer per-couple redox is a later refinement, not 4c.

## Verification tools (this project)
- `tools/broth-stability-probe.mjs` — re-run after each migration; the flat-%
  should drop and the volatile (redox-led) elements should move. NB: much of the
  baseline "flat %" is spectator ions (Na/K/Mg/Cl) + inert Eh — not all stasis is
  a defect. The pivotal-but-flat fields (Ca/CO₃/Mn in closed scenarios) are the
  real targets, and a single pH movement unfreezes them.
- `tools/movement-dark-observe.mjs` — the A/C/B observation harness above; run
  before opting any scenario in, to ground the oracle and pick field + amplitude.
- The strip view + sonifier ARE the look+listen instruments for the pilot.

---

# PART II — CARRIED BACKLOG (distilled + current)

> **`proposals/BACKLOG.md` holds the full 630-line history.** ⚠️ It is partly
> STALE: its Python↔JS parity items are **DEAD** (Python tree deleted
> 2026-05-07 — JS-only now), and its SIM_VERSION section reads "7" (actual:
> 167). Trust THIS snapshot for what's live. Grouped by theme, roughly by
> actionability. "mine/boss-lane" noted where it matters.

### A. Sonifier / strip-as-instrument — musicality (open, ongoing)
The boss's standing "how do we make it more musical" thread. Lanes:
**looping** (boss's earlier next-simplest pick), **reverb/space** (cheapest
remaining win — decay could derive from cavity size = honest), melody-over-
drone, moving harmony. Seasonings: velocity-from-rate-of-change, detune/chorus.
**Data gap:** no Mohs/luster/crystal-system in minerals.json → crystal timbre
is color+size only; a per-mineral acoustic table would unlock "harder=brighter,
metallic=clink." (jsdom is deaf — the SOUND needs a human ear. Already shipped
this arc: pan-from-angle + continuous "raw rock" mode, `0db9fca`.)

### B. Crystal-Cipher / "crystal language" sub-project (PROPOSAL-CRYSTAL-CIPHER.md)
Deterministic regeneration of shared structured content as an agent-friendly
messaging substrate (recipe URL → ~5 MB regenerated corpus → coordinate
selection decodes the message; ~60,000× compression; the simulator source IS
the shared codebook). **Reproducibility-critical** — this is *why* movements
must be seed-linked (Part I). Substrate enrichments proposed: real crystal
lattices (space groups / Wyckoff / Miller), UV-fluorescence trace channels,
helicoid-as-Scytale (winding params = transposition key). Conceptual; depends
on strip-view bedrock (shipped) + per-vertex spatial chemistry.

### C. Thermo tail (flagged in-data; not urgent — mine-lane)
Run `tools/thermo-coverage-check.mjs --verify`/`--internal` before/after.
- **dolomite ΔH** −28 vs wateq4f −39.5 (engine-promoted; needs a
  vugg-tune-scenario calibration pass; shifts seed-42).
- **siderite ΔH** −20 vs −10.4/−16 — verify Bénézeth 2009 full text first
  (feeds SI_siderite chip → digest drift).
- **witherite ΔGf** −1132.2 ~0.9 log-units adrift — non-fatal review.

### D. Geological-Accuracy phases (PROPOSAL-GEOLOGICAL-ACCURACY.md)
Phases 1+2 shipped. Open: **Phase 3** CO₂ degassing as a precipitation driver
(partly present via `70l-co2-events`; couples with PROPOSAL-VOLATILE-GASES).
**Phase 4** dynamic pH/Eh redox couples (Fe³⁺/Fe²⁺, Mn⁴⁺/Mn²⁺, SO₄/HS⁻) —
**NOTE: largely SUBSUMED by the Movements project's redox-unfreezing**; reconcile
rather than duplicate. **Phase 5** solid-solution composition tracking
(continuous mole-fraction; unblocks twin retune + 3D habit bias). **Phase 6**
CNT rate gates (lowest priority). Also Phase 1e (unify dissolution credits) +
2d (per-scenario fluid recalibration so ACTIVITY_DAMPING can rise).

### E. Strip-contract campaign
Author strip contracts (grow-digest + chip-envelope) for gem_pegmatite, marble,
evaporites — extend the test-instrument coverage the way bisbee/supergene got.

### F. Future scenarios
Sweetwater (snowball barite) + Elmwood (calcite-after-fluorite perimorph) — MVT,
may need scenario-specific paragenesis tunings. Cobalt-Ontario/Freiberg Ag vein
(activates nickeline+cobaltite+native_silver). Acid-mine-drainage (activates
chalcanthite). Plus the D3-gated scenarios (H below).
- **Specimen-anchored MVT scenario from the boss's own collection (boss, 2026-06-02;
  "sometime down the line").** Boss owns 30+ MVT calcites + fluorites + barites +
  sphalerites, probably galena (unconfirmed — resolve from the shelf; galena
  presence calibrates the depth of the reducing Eh excursion). That assemblage is
  the EXACT `mvt` expects_species (sphalerite, galena, fluorite, barite, calcite),
  so this is mostly a CALIBRATION of the existing literature-anchored `mvt` against
  real specimens (habit/color/paragenetic order), via the vugg-add-scenario
  specimen-anchored workflow — NOT a from-scratch build. The "replication of life"
  north star applied to his rocks; the richer successor to today's Tri-State-lit
  `mvt` + its Eh-movement (4c.3b). NB 30+ pieces likely span sub-districts
  (Tri-State / Elmwood TN / Cave-in-Rock IL / Moroccan-Spanish barite) → decide
  one representative scenario vs sub-district variants from the specimens. Inputs
  can flow from the 1217-specimen mineral catalog once iPhone-capture is live.
  FUTURE CONTEXT, not a current requirement — needs photos/labels in hand.

### G. Mineral engines — pre-researched, pure engine work (use vugg-add-mineral)
- **Cd + greenockite** (CdS yellow on Tri-State sphalerite; Cd field).
- **Au-Te coupling**: calaverite + sylvanite (Bingham telluride cap; Te plumbed).
- **Auriferous-chalcocite** trace tracking (Bisbee — Au hosted in chalcocite).
- **Ag/Ge engines** (Tsumeb): proustite, pyrargyrite, native_silver,
  chlorargyrite, germanite, renierite (Ag/Ge already in fluid).
- **Halides**: atacamite, chlorargyrite, boleite (Cl plumbed).

### H. Diamond / mantle "D3" plumbing cluster (long runway — end of 200-list)
Heavy shared plumbing (carbon field + pressure-as-real-supersat-driver + mantle
T/P regime) pays for ~15-20 minerals: Al₂SiO₅ polymorphs (kyanite/andalusite/
sillimanite), coesite/stishovite, jadeite/omphacite/lawsonite/glaucophane,
olivine-peridot, enstatite, diopside, pyrope, spinel, phlogopite, ilmenite,
chromite, perovskite, **diamond** (capstone). Enables blueschist / impact-crater
/ kimberlite scenarios. D2 bridge: xenocryst diamond in a shell kimberlite.

### I. Tutorials rework (separate work package, post-Phase-3)
Tutorial system is slated for its own rework arc.

### J. Twin-probability retune (deferred)
Per-roll twin rates don't account for per-mineral lifetime step-count. Build a
tool (extend `tools/twin_rate_check`) to count observed in-game twin frequency
per mineral at seed-42 vs literature; retune per-mineral (not blanket). Wants
Phase-5 continuous composition first. Candidates: cerussite cyclic_sixling,
sphalerite spinel-law, calcite c-twin, arsenopyrite trillings.

### K. 3D loose ends
- **bornite + magnetite** dropped from seed-42 (porphyry / deccan_zeolite) by
  per-ring chemistry fragmentation; tune fluid or add a seed-pulse, restore
  expects_species.
- Water-level **proportional (RC-circuit) drainage** polish (v26 uses constant
  rate).
- Dripstone **aspect-ratio** refinement (cave stalactites are slimmer, 10-20:1).

### L. Creative-mode controls
Wall **porosity slider** (designed: surface-area × matrix-leaching × residence-
time; needs wall_K/Na/Si/Al_ppm schema). Wall **composition picker** (limestone/
dolomite/silicate). Full element-slider exposure (every starter-fluid element
visible at setup).

### M. Narrative cleanups (small)
Verify whether JS narrators for borax/tincalconite/halite/mirabilite/thenardite
are still missing (port from the dead Python if so — last reference predates the
Python deletion). Auto-generate `_NARRATIVE_MANIFEST` from MINERAL_SPEC. Drop
inline JS narrator fallbacks (likely moot post-extraction — verify).

### N. Internal token rename (cosmetic, deferred)
`fortress*`→Creative, `legendsSim`→Simulation, `idle*`→Zen, `groove*`→Record
Player. ~199/40/30 occurrences; breadcrumbs in place. No UX gain; pure churn.

### Q. Performance / optimization (flagged boss 2026-06-01 — "down the line")
**Symptom:** computer fans spin up on **new-vug GENERATION** (not during the
run) → the cost is in the synchronous SETUP path, not the step loop. Suspects to
PROFILE (observe-before-assert; don't pre-optimize): the wall-mesh build
(bubble placement / tessellation in 22-geometry-wall), the cavity voxel-grid
construction (4 depth slices × cells — `voxelGridFor`, v158/159), per-cell
chemistry binding (`bindRingChemistry`), and the initial diffusion warm-up
(`_diffuseFull`/`_diffuseRingState`, v160). Likely a one-time O(cells)–O(cells²)
setup cost. Deferred — not now, and NOT to derail the movements arc. When picked
up: build a timing probe first (match the gen-baseline/calibration-sweep tool
pattern), profile, then optimize the actual hotspot. NB: the fluid-source-spots
design (§10) already reduces per-step RNG by using a bounded precomputed origin
set instead of per-parcel rolls — perf and geology aligned there.

### O. RESOLVED / DONE (don't re-open)
- **Per-vertex placement flip** — investigated v167, deliberately NOT globally
  flipped (scale-starved); area-skew bug fixed. Stays opt-in. Don't re-attempt
  the naive flip (HANDOFF-PER-VERTEX-PLACEMENT.md).
- **Canonical minerals.json** — FIXED 2026-06-01 (`083d994`).
- **multidim merge** — DONE (folded into vugg, 3dc858c).

### DEAD (do not action — historical only in BACKLOG.md)
- All **Python↔JS parity** items (effectiveTemperature port, silica_equilibrium,
  supersat-drift reconciliation, sync-spec Check 7, scenario_random parity,
  Python A6–A8 refactor): Python is deleted. JS is canonical.

---

## ☆ Builder's note to the next builder (coda, 2026-06-01)

Things worth carrying that aren't fully captured above:

1. **The inverse problem (the finish line) probably factors through the strip
   dataset.** "Photo → recipe" direct is brutally ill-posed. But the strip
   dataset (the fluid TRAJECTORY) is the deterministic interface between a
   specimen and its recipe — and a crystal's zoning literally IS its recorded
   trajectory. So the inverse likely decomposes: *photo → trajectory* (read the
   zoning — hard, but it's reading what nature already wrote down) → *trajectory
   → recipe* (seeds + settings that reproduce it — low-dimensional, tractable).
   The Movements engine is building the recipe→trajectory leg. So Movements
   isn't only forward-faithfulness — it's the **middle leg of backward
   compatibility**. Design the strip dataset asking "could I invert from this?"

2. **The convergence heuristic.** This session, "cheaper," "truer," and "more
   invertible" kept landing on the SAME choice (fluid-source spots were all
   three). That's the signature of a good parameterization. Rule: when a choice
   is at once more efficient, more geologically honest, AND more invertible,
   trust it hard. If making something prettier costs truth or invertibility,
   be suspicious — you've probably left the science.

3. **First thing to check in Phase 1:** is the OU fine-texture even visible at
   sim resolution (~100–260 steps, post-downsample)? Holten's anti-persistence
   is at the zoning-band scale, finer than our step. If it's below the noise
   floor, rip it — don't tune an invisible parameter.

4. **Two watch-items.** (a) The suite proves *determinism*, not *correctness* —
   build the geological oracle FROM the first dark observation, never blind
   (the too-tight-contract trap). (b) The arc's risk is *convergence*, not
   capability — lock a minimum-lovable v1 (broth measurably less flat, reads
   true on 2 scenarios) before coupling spots/spatial.

5. When the science contradicts your plan, that's the compass working, not a
   setback. The best moves this session were the two corrections (red-noise →
   mean-reverting; iron → solubility cycling). Stay glad to be wrong.
