# HANDOFF: Helicoid Manifold (v0–v24) + Carbonate Geochem Week 1

**Author:** Claude Sonnet 4.5 (helicoid arc)
**Date:** 2026-05-26
**Session anchor commit:** 8f92a16 (proposal alignment with WallMesh)
**Successor recommended starting point:** start a fresh context, read this doc + `proposals/PROPOSAL-CARBONATE-GEOCHEM.md`, then resume at Week 2

---

## What this handoff is

A transfer document, not a status report. The boss asked specifically for "thoughts, concerns, and wisdom you want to carry on to the next builder" — so this is calibrated for the next agent walking in cold. Status is in commit messages; this doc carries the tacit knowledge.

Read this first. Then read `proposals/PROPOSAL-CARBONATE-GEOCHEM.md`. Then the last 5-6 commit messages (they're written paper-dense per boss preference; they're not just changelog entries).

---

## Where we landed

**Helicoid Manifold for Multidimensional Space**, v0–v24, fully shipped:

- v0–v11: geometry evolution (line → helicoid surface → spinning → stacked radar screens → 47 chemistry trails with future-fade)
- v12–v16: side legend with per-param toggles + focus modes (active-only, movers, hover-to-identify)
- v17: wall-distance lateral-vs-radial bug fix (boss flagged; previous agents had missed it)
- v18–v19: symmetric crystal fade-in-and-out as a per-fragment shader skin
- v20–v21: time-as-rotation decoupled from sweep angle (each rotation captures one moment in time)
- v22: layout move (legend banner above the vugg) + proper name
- v23: spin-direction alignment (surface mesh was rotating opposite to data)
- v24: full chemical names in hover tooltips

**Carbonate geochem Phase 1 Week 1**, shipped:

- `data/thermo-carbonates.json` — 15 minerals with sourced thermo + kinetic data, confidence-tiered
- `js/20c-chemistry-carbonate-Ksp.ts` — loader + Ksp(T) helpers + tier filter
- `tools/thermo-coverage-check.mjs` — CLI audit report
- `proposals/PROPOSAL-CARBONATE-GEOCHEM.md` — 12-week plan, validated, aligned with WallMesh localization

**Live URL:** https://syntaxswine.github.io/multidimensional-space-simulator/

The helicoid is the centerpiece visualization the boss wants this game to be known for. The carbonate engine is the load-bearing geological engine that makes the visualization geologically truthful.

---

## What you absolutely must know before touching anything

### 1. This is a FORK of vugg-simulator, anticipated to merge back

The eventual merge is the load-bearing constraint. Two breadcrumbs to respect:

- **`HELIX-OVERLAY-FORK` greppable markers** — every fork-only addition to vugg-simulator-inherited files is bracketed with `=== HELIX-OVERLAY-FORK ADDITION (vNN) ===` / `=== END HELIX-OVERLAY-FORK ADDITION ===`. `git grep HELIX-OVERLAY-FORK` lists every site. When you add new fork-only code, follow this pattern.
- **`proposals/HELIX-OVERLAY-FORK-CHANGES.md`** — the merge guide. Read it before adding anything that touches shared files. Update it when you add new fork-only sites.

Internal symbol names (`_helix*`, file path `99j-helix-overlay.ts`, commit titles "helix overlay vNN") stay stable so git blame survives the merge. The proper name "Helicoid Manifold for Multidimensional Space" is for user-facing strings only.

### 2. The Bjerrum partition + Kim 2023 f_ord scaffolding is already in place

Don't rebuild this. Specifically:
- `js/20b-chemistry-carbonate-system.ts` — Bjerrum partition with K₁, K₂, KH, Henry's-Law. `CARBONATE_SPECIATION_ACTIVE = true`.
- `js/52-engines-carbonate.ts` — Kim 2023 f_ord formula for dolomite ordering, with fluid-level cycle counting (`conditions._dol_cycle_count`).
- `js/32-supersat-carbonate.ts` — `effectiveCO3(fluid, T)` for pH-amplified CO₃²⁻ activity, Mg-poisoning sigmoid for calcite.

The carbonate engine arc completes these into a real Ksp-driven SI engine. It does NOT replace them.

### 3. The wall-distance bug taught a lesson about questioning "obvious" math

v17 fixed a bug where the helicoid wall trail was reading `cell.base_radius_mm + cell.wall_depth` — distance from cavity center to the wall surface point. On a roughly spherical cavity that's ~R everywhere, including the polar caps where the cavity should taper to a point. Boss flagged: "the wall distance variable is not getting smaller as it goes up to the top or down to the bottom. i think it might be measuring from the middle of the sphere instead of the local measurement."

Boss noted previous agents had tried to fix this and missed it. The fix was `radius * sin(phi)` — the lateral (perpendicular-to-axis) distance, not the radial distance.

Generalizable lesson: when the boss describes a visual finding with geometric reasoning, the diagnosis is usually correct. Don't argue with the math; trust the eye and find what's wrong with the code.

Also: v17 surfaced a latent `this`-binding bug in the snap proxy. When you fix one thing in this codebase, watch for second-order effects that emerge.

### 4. The localization target is the WallMesh, not abstract per-cell

Three iterations to get this right (boss kept clarifying):

- I first heard "more localized" → assumed scenario → per-ring → per-cell progression
- Boss clarified: per-ring is ALREADY where fluid lives; future is finer
- Boss clarified again: WallMesh per-vertex is the target

PROPOSAL-CAVITY-MESH Phase 3+ already plans per-vertex state on `WallMesh.cells[]`. The carbonate engine should ALIGN with that plan, not invent a parallel grid. Specifically:

- Accessors are `fluidAtMeshVertex(sim, mesh, vertexIdx)` not `fluidAtCell(ringIdx, cellIdx)`
- Resolvers return per-vertex answers
- Per-ring array schema form is INTENTIONALLY OMITTED from new schema slots — per-ring is what the wall mesh is retiring

When you're tempted to introduce a new spatial abstraction, ask: does the WallMesh already cover this? Usually yes.

### 5. Time and rotation are separate variables

v21 was the critical move. Before v21, the helicoid mapped sweep angle → scenario step continuously. Boss flagged: "you are showing the crystals fully grown before they have finished growing. each sweep of the helicoid through the vug should be capturing only what is happening at that exact moment in time."

Now:
- `_helixSweepAngle` is the visual rotation (60 RPM default)
- `_helixCurrentTimeStep` advances independently (1 step/sec at default)
- `_helixDisplayedStep` is `floor(_helixCurrentTimeStep)` — the step every sample reads from within a rotation

Within one rotation, the entire vugg shows ONE moment. Time advances between rotations. The two knobs that tune this: `_HELIX_RPM` and `_HELIX_STEPS_PER_REV`. Boss range: "1 rotation per unit of time through 5 rotations per unit of time." Default is the fast end (1 step/rev at 60 RPM = 1 step/sec).

Generalizable lesson: never let a single state variable carry two meanings. If a quantity is doing two jobs (rotation visual AND time advance), split it.

### 6. The per-fragment shader skin is the right abstraction for "currently active"

v19 was a critical move too. Boss caught: "the whole crystal fades in and out at the same time instead of the fade matching the sweep of the helicoid."

The fix was a per-fragment shader injection (via the existing `onBeforeCompile` pattern from `_applyCavityClip`) that gives each surface point its own opacity based on its own world-y → helicoid leading-edge angle. A tall crystal that spans 11 mm of vertical extent on a 56 mm cavity gets revealed segment-by-segment as the spiral leading edge crosses each Y at a different sweep moment.

Boss suggested it: "could you do it as a skin?" Listen for these architectural hints — they're often pointing at the right layer.

Generalizable lesson: per-fragment shaders give you control no JS-side opacity manipulation can match. When the boss wants something to behave per-point on a surface, the shader is the answer.

---

## What you should know about working with this boss

### They notice things

At 60 RPM with per-revolution time sync, they spotted the helicoid surface and the data trails rotating in opposite directions. The discrepancy had been latent since v2; nobody noticed at 4 RPM. Boss noticed at 60 RPM within minutes.

They spotted that crystals were appearing fully grown at sweep angles before their nucleation step. They spotted that wall distance wasn't tapering at the poles. They spotted that the chip tooltips said "CO3" when they wanted "Carbonate."

When they say "i see flashes of CO" or "the helicoid seems to spin counterclockwise," they're not chatting — they're flagging bugs. Trust the report.

### They read commit messages as papers

This is in the user-memory note ("Commit messages like field notes — dense observational commit messages with per-item tables, verification numbers, the why; boss reads them as papers"). It's real. Match it. The pattern:

- Title: dense, named arc + slice
- Body: per-item table of what changed (file, function, intent)
- "What you should see now" section
- "Verification" section with real numbers
- "Next" pointer
- Fork breadcrumb if applicable

Use `git commit -F $env:TEMP\commitmsg.tmp` for multi-line commits on Windows PowerShell. Heredocs in PS are fragile around special chars.

### They have strong geological domain knowledge

They reference real specimens (TN457 barite), real localities (Sweetwater, Coorong), real scenarios (sabkha dolomitization via Kim 2023 Science 382:915). When they correct geological framing, the correction is usually right. Don't argue from textbook generalities against their specific knowledge.

The flip side: they appreciate when you bring geological accuracy proactively. The proposal sections that distinguished disordered HMC (reactive_wall) from ordered dolomite (sabkha via Kim 2023 cyclic-Ω) — they didn't need me to explain those, but they noticed when I included them correctly.

### They preserve history

The v18 per-mesh opacity code is gone from the codebase (replaced by v19 shader skin), but the v18 commit stays in git. The "wisdom from previous attempts" is in git history, not in the current code. Read recent commits when debugging.

### They want autonomous-but-conversational pacing

The user-memory note "Keep going through coupled phases" applies. Don't checkpoint constantly. But also: when there's a substantive design decision (the 6 open questions in the carbonate proposal, the 3 clarifications of what "localized" meant), stop and confirm. They're skilled at noticing when an autonomous run is heading the wrong way and will redirect — but you save them effort by catching the genuine decisions yourself.

The signal that they want you to stop is rarely a direct "stop." It's more often "i was thinking [X] would be the way to go" or "the thing you missed is [Y]." Listen for those.

### "this looks great" usually means "and here's the next bigger ask"

This happened multiple times. Compliment is genuine; it's also the bridge to the next thing. Don't get complacent.

---

## The arc ahead — carbonate engine Phase 1 Weeks 2-12

| week | track | deliverable |
|---|---|---|
| 2 | carbonate engine | `js/32b-supersat-carbonate-Ksp.ts` — replace empirical eq forms in `32-supersat-carbonate.ts` with SI-based saturation indices using `getCarbonateLogKsp`. Default flag `CARBONATE_KSP_ACTIVE` off, per-mineral validation flip later. |
| 3 | helicoid integration | Add `CARBONATE SYSTEM` section to legend with 11 new chips (DIC, CO₂(aq), HCO₃⁻, CO₃²⁻, SI per carbonate mineral, pCO₂, f_ord). Read through the per-vertex accessors. |
| 4 | open/closed system | `js/20d-localization-resolvers.ts` — polymorphic resolvers keyed on WallMesh vertex. Henry's-Law equilibration in observer mode. |
| 5 | validation: easy | MVT, cooling, gem_pegmatite. Sanity check before kinetic engine lands. |
| 6 | kinetics module | `js/52b-engines-carbonate-kinetics.ts` — Plummer-Wigley-Parkhurst rate law. Aragonite-vs-calcite metastability. Still observer. |
| 7 | validation: critical part 1 | reactive_wall. **Must produce disordered HMC, NOT ordered dolomite.** |
| 8 | validation: critical part 2 | sabkha_dolomitization. **f_ord must cross 0.7 between cycles 6 and 9. Ordered dolomite appears after.** |
| 9 | first engine promotion | Flip calcite engine. Re-anchor any scenario where seed-42 output shifted via `vugg-tune-scenario`. SIM_VERSION bump. |
| 10-12 | remaining engine promotions | dolomite, HMC, aragonite. One per week. |

Stoppable cleanly after Week 5 (observer-only, no calibration risk) if scope expands.

**Skills to use:**
- `vugg-add-mineral` for HMC entry creation
- `vugg-add-broth` if new FluidChemistry fields land
- `vugg-add-scenario` for any new validation scenarios
- `vugg-tune-scenario` after each engine promotion (this WILL be needed; budget time)
- `vugg-add-twin-law` for HMC twin laws

---

## Open questions still on the table

Question #5 (localization) is resolved (WallMesh per-vertex). Five remain:

1. **Continuous HMC vs discrete HMC bands.** I defaulted to continuous (`crystal.mg_content` as state) but didn't get explicit boss confirmation. If continuous becomes painful to wire (HMC↔dolomite transition logic gets tangled), discrete 3-tier might be cleaner.

2. **Open-system default.** Defaulted to `false` (closed) to preserve existing calibrations. If boss wants `true` (more geologically common), the calibration-drift cost is real for the closed-leaning scenarios (MVT in particular).

3. **MVT Pitzer in Phase 1 or Phase 2.** Defaulted to Phase 2. If MVT validation in Week 5 fails because Davies activity model can't handle 3-5 mol/kg ionic strength, you may need to pull Pitzer forward (+3 weeks).

4. **Vaterite in Phase 1 or Phase 2.** Defaulted to Phase 2. Real but not load-bearing on any current scenario.

5. **Thermo data file structure.** Defaulted to sibling file (`data/thermo-carbonates.json`). Other family files (`data/thermo-sulfides.json`, etc.) will follow if the audit framework extends. Boss didn't push back; if they want inline in `data/minerals.json` later, that's a clean migration.

These are flagged in the proposal but not yet boss-confirmed beyond my defaults. They might come up during Week 2-3 work.

---

## Concerns and watchouts

### `searles_lake` smoke test flakes

`tests-js/fill-exempt.test.ts > searles_lake scenario end-to-end (smoke)` failed once in full-suite runs, passed every time in isolation. RNG-pollution from sibling tests in suite ordering. **Pre-existing**, unrelated to any v20+ work, but worth knowing about if you see a single-test failure in CI.

### Calibration drift across 14 scenarios is real

The carbonate engine promotion will shift seed-42 output for every scenario that consumes that mineral. Budget ~1 day per scenario for tune-scenario re-anchoring. Don't underestimate. The vugg-tune-scenario skill encodes the discipline; use it.

### The Bjerrum damping coefficient (`BJERRUM_DAMPING = 0.5`) is a compromise

In `js/20b-chemistry-carbonate-system.ts`. Full Bjerrum (damping=1.0) gives proper pH amplification but breaks existing scenario calibrations. The 0.5 default was tuned for backward compat. When you flip CARBONATE_KSP_ACTIVE per-mineral in Week 2, you may want to flip damping=1.0 simultaneously — but DON'T do both for all minerals at once. Per-mineral validation only.

### The helicoid's per-fragment shader is tied to `_applyCavityClip`

The skin shader I added in v19 is injected through the same `onBeforeCompile` that the cavity-clip uses. If anyone refactors the clip injection, they need to preserve the helix-skin injection too. The fork breadcrumbs flag the site; protect them.

### `_dol_cycle_count` is currently scenario-handler-incremented

The Week 4+ work derives this from ω-history automatically. Migrating without breaking the cycling-based scenarios (sabkha specifically) needs care. Plan: keep the manual increment as a fallback, layer derived counting on top, validate that derived counting matches manual for sabkha before retiring manual.

### Davies activity model fails at I > 0.5 mol/kg

MVT brines hit I ≈ 3-5 mol/kg. Davies in this range gives calcite SI errors of ~0.5-1.0 log units. If MVT validation in Week 5 shows wrong calcite firing, this is the likely cause. Two responses available: defer Pitzer to Phase 2 (document the limitation) or pull Pitzer forward (+3 weeks scope).

### The rate band on the helicoid is dormant in steady state

`_HELIX_RATE_BAND_MIN_NORM = 0.04` filters out trails with low |Δr|. In current post-sim view with chemistry held at the displayed step, Δr per sample is small. The band only fires when chemistry actively varies between rotations. This is correct behavior, not a bug, but a future builder might mistake it for one.

---

## Things I'd carry forward — wisdom

### Build for the eye, not just the data

The helicoid arc happened because the boss could SEE things the numbers were hiding. Wall trail not tapering, crystals appearing pre-nucleation, surface spinning opposite to data. Every one of these was a visualization revealing a data bug. Build visualizations that let you see what's wrong. Then when you see something wrong, fix the data, not the visualization.

### When the boss describes a problem geometrically, the diagnosis is usually correct

Multiple instances: wall distance ("might be measuring from middle of sphere"), crystals ("whole crystal fading instead of the slice"), spin direction ("helicoid is counterclockwise and data is clockwise"). They thought about it visually, they reasoned about it geometrically, they're right. Trust the description; debug toward what they described.

### The proposal docs are real contracts, not background reading

When the design shifts mid-week (the localization-target clarifications happened across three commits in one day), update the proposal doc. Future agents read it. The boss reads it. It becomes the merge contract. A stale proposal is worse than no proposal.

I updated the carbonate proposal four times during this session as the design clarified. Every update was commit-worthy. Treat the proposal as code.

### Honesty about uncertainty is what the boss wants from the geochem engine

The whole point of the database-gap audit framework is to surface what we DON'T know. When you encode a Ksp value, cite the source. When the source is single and dated, mark it tier B. When there's no source, mark it tier D and say so in the notes. Narrator hints will eventually surface tier-C/D to the player. The boss explicitly asked for this transparency.

Don't fudge a value to make a scenario work. If the data says rosasite Ksp is unknown, the engine says rosasite Ksp is unknown, the narrator footnotes it, and the player learns something true about the state of geochemistry knowledge.

### Decouple, don't multiplex

v21 (time vs sweep) and v22 (legend banner moved out of canvas-wrap) were both wins from separating two things that had been doing one job. Look for these. Single state variables doing double duty are a smell.

### The wall mesh is the answer to many localization questions

When PROPOSAL-CAVITY-MESH lands Phase 3, it becomes the home of per-vertex everything. Don't invent parallel grids; align with the mesh. The boss saying "wall mesh is probably the right direction" wasn't a casual remark; it was a structural commitment that should govern many future decisions.

### Per-fragment shaders are how you control "what's currently happening on this surface"

If you find yourself doing per-mesh opacity manipulation in JavaScript and it feels too coarse, the fragment shader is probably the right layer. The pattern is in `_applyCavityClip` and was extended by the v19 helix skin. Reuse this pattern when you need per-point control.

### Don't merge index.html line-by-line

The bundled JS inside `index.html` between `// === BUILD:bundle:start ===` / `// === BUILD:bundle:end ===` is regenerated by `tools/build.mjs` from `dist/**/*.js`. Merge the sources under `js/` and run `npm run build`. The static HTML/CSS in `index.html` (button, legend div, CSS block) IS hand-edited and survives rebuilds — merge those manually.

This trips up new agents. The HELIX-OVERLAY-FORK-CHANGES.md doc spells it out.

### Use the skills

`vugg-add-mineral`, `vugg-add-broth`, `vugg-add-scenario`, `vugg-tune-scenario`, `vugg-add-twin-law` encode institutional knowledge accumulated over many minerals + scenarios. They cover gotchas (the FluidChemistry S-not-SO4 trap, the MINERAL_SPEC async-loading trap, the v89-Sn first-consumer pattern). When you're about to do something the skill covers, use the skill. Don't reinvent the patterns.

### The boss appreciates field-notes commit messages

Dense, per-item tables, observed values, the why. Match the existing helix-overlay commit message style. Multi-line commits via `git commit -F $env:TEMP\commitmsg.tmp` on Windows PS. The investment in commit-message quality pays back when the boss reads them and when you (or the next agent) read them six months later.

### Things will be revealed that you didn't know were there

The helicoid surfaced the wall-distance bug, the spin-direction mismatch, the latent `polarProfileFactor` binding bug. The carbonate engine will surface things in the existing engines. Don't be surprised when fixing one thing reveals two more. The boss has been clear that this is part of the work, not a complication of it.

### The carbonate work composes with cavity-mesh evolution

PROPOSAL-CAVITY-MESH Phase 3 introduces per-vertex state. The carbonate engine accessors point at the wall mesh from day 1. When Phase 3 ships, carbonate chemistry becomes per-vertex automatically. Neither proposal blocks the other.

Look for opportunities like this. Each major arc should be designed to compose with the others, not stand alone. The handoff to the next builder is partly: tell them which arcs are converging.

---

## Specific files / artifacts the next builder should look at first

Read in this order:

1. **This doc** (you're doing it)
2. **`proposals/PROPOSAL-CARBONATE-GEOCHEM.md`** — the 12-week plan, fully detailed
3. **`proposals/HELIX-OVERLAY-FORK-CHANGES.md`** — merge contract if you touch shared files
4. **`data/thermo-carbonates.json`** `_meta` block — confidence-tier definitions, citation legend
5. **`js/20b-chemistry-carbonate-system.ts`** — existing Bjerrum scaffolding, the foundation the engine builds on
6. **`js/52-engines-carbonate.ts`** lines 220-273 — the Kim 2023 f_ord logic for dolomite
7. **`js/99j-helix-overlay.ts`** header comment — the boss model + the v0–v22 design history
8. **`js/23-geometry-wall-mesh.ts`** header — the WallMesh structure, Phase 3 plans for per-vertex state
9. Recent commit messages: `git log --oneline -30` then read the ones with structure (most of them)

Then run:
```
npm install
npm run build
npm run typecheck
node tools/thermo-coverage-check.mjs
```

If all four pass clean, you have a working tree. Start the preview server and load the helicoid to confirm visually.

---

## What I'd do differently if I started over

- Get the wall-mesh localization clarification on the FIRST iteration of the proposal, not the third. I added "per-region" and "per-cell function" to the schema before realizing the WallMesh was the actual target. Some of the proposal-doc churn was avoidable.
- Build the per-vertex accessors (`fluidAtMeshVertex` etc.) in Week 1, not Week 4. They're load-bearing on the engine being agnostic to data-model granularity. Better to have them stubbed in early than added later.
- Confirm the 6 open questions explicitly with the boss BEFORE writing thermo-carbonates.json. I took defaults; most are probably fine but #1 (continuous HMC) and #2 (open-system default) might cost rework if the boss disagrees.
- Test the preview MCP server's cwd issue earlier. I wasted time on the first sim run because the python server was serving the wrong project directory; the launch.json fix took two iterations.

---

## Closing thought for the next builder

The boss has spent decades on geological knowledge that doesn't fit neatly into AI training data. They've also tried multiple agents on this project and have specific scars (the wall-distance bug is the one I know about; there are probably more).

You're not starting at zero. You're inheriting a working visualization that the boss is excited about ("this looks fantastic" and "it really is showing me things i didn't know were happening" were both said this session), AND a partial geochemistry engine that needs completion.

The opportunity ahead is real: a visualization layer fused with a geological engine that nobody else has built because nobody has both. The carbonate engine Phase 1 is six weeks from real-geochem-driven SI displays on the helicoid, twelve weeks from full engine promotion. The audit framework surfaces uncertainties honestly. The wall-mesh alignment composes with the existing cavity-mesh plans.

Take it seriously. Match the dense commit-message style. Trust the boss's diagnostic instincts. When they say "this is so good," brace for the next bigger ask. When they describe a visual problem geometrically, debug toward what they described. When they say something is the "right direction," it usually is.

Good luck.

— Claude Sonnet 4.5, helicoid arc, 2026-05-26
