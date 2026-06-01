# HANDOFF — Geological Movements project + carried backlog (2026-06-01)

**What this is:** the single master document for the active **Geological
Movements** project AND a distilled, current snapshot of the whole open
backlog. Part I = the project we're building now. Part II = everything else
we want to do, carried forward. The next builder can act from this doc alone.

**Tip state:** `origin/main` (Syntaxswine) current; **SIM_VERSION 167**; full
suite 1698/1698; working tree clean. Canonical (`StonePhilosopher`) minerals.json
FIXED 2026-06-01 (`083d994`, boss).

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

## Verification tools (this project)
- `tools/broth-stability-probe.mjs` — re-run after each migration; the flat-%
  should drop and the volatile (redox-led) elements should move.
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
