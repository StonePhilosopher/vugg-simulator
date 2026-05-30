# HANDOFF: Carbonate Phase 1 COMPLETE (Weeks 9–12 + Closeout)

**Author:** Claude Opus 4.7 (1M context, W9–W12 promotion arc)
**Date:** 2026-05-26
**Session anchor commit:** 03a327e (Week 12 aragonite + Phase 1 close)
**Successor recommended starting point:** start a fresh context, read this doc + `proposals/HANDOFF-CARBONATE-PHASE-1-W2-W8.md` (the prior handoff covering W2–W8 infrastructure) + `proposals/HANDOFF-HELIX-AND-CARBONATE-W1.md` (Sonnet 4.5 W1 handoff), then either pick up Phase 2 engine refinement OR the three design directions described in the W2-W8 handoff and still pending.

---

## What this handoff is

Continuation of the W2–W8 transfer-of-judgment handoff. Same style — calibrated for the next agent walking in cold. This doc covers the production-promotion arc (W9–W12) plus closeout: what worked, what broke, what's queued. Status is in the commit messages (dense field-notes per boss preference); this doc carries the tacit knowledge.

Read this first. Then re-read the W2–W8 handoff. The three pending design directions described there (per-vertex chips → strip view → record mode → filter system → branching) are STILL the next big horizon, untouched by Phase 1.

---

## Where we landed

**Carbonate Phase 1 is DONE.** Twelve weeks of proposal arc shipped across multiple sessions. All four CaCO3-system polymorphs (calcite, dolomite, HMC, aragonite) on the textbook SI engine + Plummer-Wigley-Parkhurst 1978 rate law.

| Week | Mineral | SIM_VERSION | Headline |
|---|---|---|---|
| 9 | calcite | v144 | First flip. PWP calibration factor 5e4 tuned across all calcite scenarios. Sigma_crit 1.3 → 1.5. |
| 10 | dolomite | v145 | Flag flip + sigma_crit 1.0 → 10. **Kim cycle threshold fix** (omega=100, ordered-dolomite stability boundary). |
| 11 | HMC mineral add + promotion | v146 | First per-crystal composition state. mg_content set at nucleation from fluid Mg/Ca per Mucci-Morse 1983. |
| 12 | aragonite | v147 | Architectural outlier — keeps favorability layer. **T_max=400 fix** (Carlson 1983). Phase 1 CLOSED. |

**Plus one correction commit (68ee988)** between v145 and v146 — pulled fabricated citations (Burton 1993 / Wright 1999) caught during W11 prep research. See discipline section below.

**Test counts across the arc:** 1486 (pre-W9) → 1502 (post-W9) → 1514 (post-W10) → 1532 (post-W11) → 1548 (post-W12). 62 new tests.

**Scenario drift across the arc:** Significant — calcite cave-undergrow (W9 stalactite_demo 52→3 mm, zoned_dripstone_cave 44→2 mm), dolomite + HMC microcrystalline scale at sabkha (Kim mechanism intact but cavity fills before visible mass accumulates), aragonite metastable cascade (5 new firings, mostly dissolved — geologically right). All drifts are in defensible directions per the "geology landing" pattern.

**Live URL:** https://syntaxswine.github.io/multidimensional-space-simulator/

---

## What you absolutely must know before touching anything

### 1. The pastiche is the real shape of LLM hallucination

Two fabricated citations caught during this arc, both pastiches (real author + real year + real topic + fabricated specifics):

- **Burton 1993 / Wright 1999** — cited in v145 as the basis for the Kim omega=100 threshold. Burton 1993 IS real (review paper on aragonite-vs-Mg-calcite cement mineralogy in Chem. Geol. 105:163-179) but it does NOT support a kinetics-vs-omega threshold claim. Wright 1999 I cannot identify at all as a primary source. CAUGHT during W11 prep research; corrected in commit 68ee988.

- **Carlson 1983 Geol. Soc. Am. Memoir 161:153-162** — fabricated journal/volume/pages in the v147 docstring draft. Carlson 1983 IS real (canonical aragonite-calcite transition paper) but in Reviews in Mineralogy v11, NOT GSA Memoir. CAUGHT mid-draft by noticing the journal/volume felt slot-filled rather than memory-anchored.

**The discipline:** `vugg-add-mineral` SKILL.md Section 1 mandates research-agent dispatch on EVERY new mineral. Extend that discipline to ANY new citation, including ones inherited from pre-existing code. Component-level confidence is not sufficient — pastiches have correct components and fabricated specifics. The reliable signal is whether you have LINKED MEMORY of the specifics (journal, volume, page, methodology, abstract) or just confidence in the topic area.

The October 2025 paper *"Do LLMs Really Know What They Don't Know? Internal States Mainly Reflect Knowledge Recall Rather Than Truthfulness"* (arxiv 2510.09033) formalizes this empirically: the hidden-state geometry for a pastiche overlaps with real recall. Suspicion doesn't fire because the mechanism is real recall, just of the wrong thing. The only reliable check is external verification.

**Build the tool, not just the vigilance:** the discipline lives in the skill file as a non-negotiable workflow step. If you're tempted to skip it because "the citation is obvious," that's exactly when the pastiche risk is highest. A `tools/citation-check.mjs` that takes a list and dispatches verification automatically would harden this.

### 2. The Kim cycle counter threshold = 100, not 1

`VugConditions.update_dol_cycles()` detects sigma_dolomite crossings to count Kim 2023 cyclic-Ω events. Pre-v145 the threshold was hardcoded at sigma=1.0 (thermodynamic equilibrium for any dolomite phase). The empirical engine's sigma was ppm-style ratio and dropped below 1.0 at sabkha evap events — counted cleanly.

The SI engine returns raw omega. Dolomite in any Mg-rich brine has omega in the millions; sabkha evap has omega ~6.5 (still > 1.0, never crosses). Pre-fix the counter would never have detected cycles under the SI engine.

**Fix (v145):** when `kspSupersatActiveFor('dolomite')` is true, threshold = 100 (the ordered-dolomite stability boundary — engineering-calibrated from the codebase's own Ksp data, where ordered dolomite Ksp ~10⁻¹⁷ vs disordered HMC Ksp ~10⁻⁵·⁵ at x=0.30 gives ~10¹¹·⁶ less soluble than the HMC precursor; omega=100 approximates "above-dolomite-equilibrium enough to overcome the HMC competitor"). Sabkha now counts 12/12 cycles again.

**The lesson:** a passing test doesn't validate its mechanism. The W8 diagnostic praised 12/12 cycle counting at v143/v144, but the mechanism was the empirical-engine sigma masking the proper omega semantics. When upstream changes (SI engine flip), check that downstream "passing" tests still measure what they think they measure.

### 3. HMC is the first per-crystal-composition-state mineral

`crystal._mg_content` is set at nucleation in `_nuc_HMC` from the fluid Mg/Ca via Mucci-Morse 1983 partitioning. `grow_HMC` reads it and threads it through `HMCRate(fluid, T, mg_content)` and `saturationIndex_HMC(fluid, T, mg_content)`. The whole point of HMC is that it's a solid-solution composition (x ≈ 0.05-0.30), so omega + rate depend on the specific crystal's Mg fraction.

**For any future solid-solution mineral, follow this template:**
- Set `crystal._<state>` at nucleation in `_nuc_<mineral>`
- Read it in `grow_<mineral>` for both supersat sigma + rate
- The SI engine helper takes the state as an explicit parameter
- mass-balance gets canonical composition (HMC uses x=0.10 average)
- The MINERAL_SPEC entry needs `_solid_solution_note` documenting it isn't an IMA species

### 4. Aragonite is the architectural outlier

`supersaturation_aragonite` returns `omega × favorability` rather than raw omega. The other three carbonates return raw omega when promoted. Aragonite is DIFFERENT because it's the metastable polymorph — its firing rule is fundamentally a KINETIC criterion (Folk 1974 Mg/Ca preference, Burton-Walter 1987 T preference, Morse 1997 Ostwald step rule, trace Sr/Pb/Ba boost) layered on top of thermodynamic omega.

The SI promotion swapped the BASIS of omega from `ca_co3/eq` to textbook `IAP/Ksp`, but kept the favorability layer. This is geologically defensible: omega tells you HOW supersaturated, favorability tells you WHETHER aragonite wins over calcite.

**For Phase 2 siderite/rhodochrosite promotions:** read the existing empirical supersaturation method first. If it encodes a kinetic-favorability layer (redox modifier for siderite, pH-modifier for rhodochrosite, etc.), preserve that layer in the SI engine path. Not every mineral gets the same template.

### 5. The cavity-fill cap is the architectural ceiling

`js/85-simulator.ts` lines 260-269: when `currentFill >= 1.0`, the per-crystal engine is still called but ONLY dissolution zones are accepted. Positive growth zones are silently dropped.

This is geometric truth (you can't grow past the cavity volume), but it interacts with rate disparity: empirical engines were fast enough to grow visible carbonate BEFORE the cavity capped; PWP at honest rates gets capped earlier so visible mass is small. This is the proximate cause of:

- sabkha dolomite (v145): 49 → 2.5 µm
- sabkha HMC (v146): 4 active, 0.8 µm max each
- ultramafic_supergene HMC (v146): 27 active, 0 µm each
- sabkha aragonite (v147): 188 → 15 µm

**Phase 1c candidates:** bump cavity radius for these carbonate-showcase scenarios, OR rethink whether the fill-cap-on-positive-zones mechanic should apply to slow-growing minerals.

### 6. Citation verification is upstream of suspicion, by mandate

Per the discipline established in W11 prep (caught by the boss's "watch for lack of linked memories" rule and the verification-via-research-agent operationalization): EVERY new citation gets web-verified, not just suspect ones. The skill file `.claude/skills/vugg-add-mineral/SKILL.md` Section 1 mandates research-agent dispatch with no escape hatch.

Future agent — if you find yourself thinking "I know this citation, no need to verify," that's exactly when the pastiche risk is highest. Run the verification anyway. It's the cheapest insurance in the workflow.

The two pastiches caught during the W9–W12 arc are documented inline in their respective source files as learning artifacts:
- `js/25-chemistry-conditions.ts` `update_dol_cycles` — Burton 1993 / Wright 1999 correction
- `js/32-supersat-carbonate.ts` `MINERAL_GATES_aragonite` — Carlson 1983 journal/volume correction

Read both before relying on the threshold or T_max value.

### 7. PWP calibration factor is global, not per-mineral

`_PWP_CALIBRATION_FACTOR = 5.0e+4` in `js/52b-engines-carbonate-kinetics.ts`. Set at W9 calcite promotion; consumed by `pwpRateToSimMicronsPerStep` for ALL minerals.

Empirically tuned across calcite-firing scenarios (median pwp_um at factor=1.0 was 2.9e-5 µm/step in moderate-supersat regime; factor 5e4 lands typical growth at ~1.5 µm/step). The factor is the time-axis conversion — different scenarios model different time scales (cave dripstone ~years per step; hot-spring travertine ~days per step), so a single factor is a compromise.

The downstream effect: hot acidic scenarios grow MORE carbonate (PWP Arrhenius accelerates at high T + low pH); cold alkaline scenarios grow LESS. Both are geologically correct directions. The empirical engine's T-independent formula was the source of cave-undergrow cliff.

If you change the calibration factor, expect every carbonate baseline to shift. The factor is load-bearing for the v144-v147 mass calibration.

---

## Phase 1c follow-ups (broth tunes + small architectural fixes)

Documented across the W9-W12 commit messages. Not blocking Phase 2; these are scenario-level polish.

**Scenario re-anchors (vugg-tune-scenario discipline):**
- **stalactite_demo** + **zoned_dripstone_cave** — bump Ca + CO3 so omega stays high enough at cold cave T that PWP rate produces visible stalactites. Real cave calcite grows ~0.001-1 mm/year; v147 produces ~10-15 µm/step which is geologically right but visually small. The trade-off: scenario broths that are honest about typical cave chemistry produce honest-but-small visible carbonate.
- ~~**mvt** — dial back calcite via lower CO3~~. **REJECTED 2026-05-27** via boss specimen calibration: a real Elmwood (Carthage MVT district) honey-calcite specimen photographed at the workbench measured ~8" × 6" × 4" (20 × 15 × 10 cm). The v147 mvt calcite at 4 cm is barely a quarter of one dimension of that specimen — conservative, not excessive. Real Elmwood routinely reaches 20 cm+; the v147 numbers stand. When the dedicated Elmwood scenario lands (per `project_vugg_future_mvt_scenarios.md` user memory), its calcite target should be substantially LARGER than v147 mvt's output, not smaller. Specimen photo + reading: 2026-05-27 chat archive.
- ~~**sunnyside_american_tunnel** — bump CO3 to restore the manganocalcite Stage VI cap firing~~. **REJECTED 2026-05-27 (post-compact)** via `tools/sunnyside_nucleation_gate_probe.mjs`: engine peak omega = 1.045 at step 185 (Stage VI cap window), vs MINERAL_GATES_calcite.sigma_crit = 1.5. The v144 SI engine raised sigma_crit from the empirical 1.0 (noise floor) to 1.5 (kinetic-barrier margin per heterogeneous nucleation on cavity walls); Sunnyside's omega-equivalent at peak is exactly the "1.05 thermodynamically marginal" value the test file already documented. The v144 behavior is working as designed AND matches the boss specimen evidence (1 manganocalcite per 20 Silverton cabinet pieces — manganocalcite IS rare at Sunnyside). Forcing calcite to fire reliably would move AWAY from the science, not toward it. The existing test (`tests-js/sunnyside-american-tunnel.test.ts`) already has a softened assertion covering this case (rhodochrosite carries the Stage VI signature; calcite firing is opportunistic). The test was right; the handoff item was wrong.
  - **Probe-driven side discovery:** `ring_fluids[]` is post-Tranche-2+ **vestigial**. Engines read live chemistry from `mesh.cells[].fluid` via the per-cell swap in `_runEngineForCrystal`. Events still write to `ring_fluids[equator]` via the original alias, but the other 15 rings receive no chemistry updates — leading to convincing-looking but FALSE "stuck ring" probe output. The first iteration of the sunnyside probe was reading from `ring_fluids[0]` and concluded a structural sync bug existed; the second iteration reading from `mesh.cells[].fluid` showed all cells carry uniform event chemistry. The bug was in the probe, not the simulator. Cleanup options for future work: (a) remove `ring_fluids[]` field entirely, (b) keep it but add end-of-step sync from mesh.cells back so it's diagnostic-useful, (c) at minimum add a header comment marking it vestigial so the next debugger doesn't repeat this exact mistake.
- **sabkha_dolomitization** — bump cavity radius so dolomite + HMC + aragonite can grow past their initial nucleation before cavity fills with selenite. The Kim mechanism IS firing at proposal-target strength (12/12 cycles, f_ord 0.82) but the visible dolomite is 2.5 µm. Cavity-radius bump unblocks the visible dolomite scale.
- **ultramafic_supergene** HMC — original diagnosis ("cavity-fill story") was tested at v157 prep (2026-05-27) and **rejected**: bumping vug_diameter_mm 40 → 80 produced byte-identical baseline output, proving the cavity-fill cap is never hit. Followup diagnosis ("chemistry budget starvation + dolomite cap bypass") was tested 2026-05-27 (post-compact session) and **also rejected** via `tools/dolomite_cap_probe.mjs`:
  - The "27 actives" claim was a misclassification. Probe at seed 42 / 200 steps shows **27 TOTAL dolomite nucleations, but only 1 active** (1 active + 26 enclosed + 0 dissolved). The other 26 are enclosed by crystal #2 (quartz, 200 zones, ~3 mm runaway). `_atNucleationCap` correctly returns true at 4 actives — its design intentionally counts only exposed crystals (see comment at js/85b-simulator-nucleate.ts:296-305), modeling the MVT inclusion-trail pattern. **There is no bypass bug.**
  - The "chemistry budget starvation" claim is also wrong. End-of-run ring-0 fluid shows Ca=30 / CO3=80 — **unchanged from initial values**. Per-vertex consumption may be happening but isn't visible at the bulk-ring level; the bulk-budget framing doesn't apply. Calcite shows the same pattern (9 total, 1 active, 8 enclosed). HMC sits at its cap (4 actives, 0 enclosed).
  - **The actual mechanism:** quartz #2 is a runaway grower that swallows whatever nucleates near it. Each dolomite/calcite nucleates, runs 1–3 growth zones, then gets stamped `enclosed_by=2` and `.active=false`. The cap counter drops back below 4, another dolomite nucleates 3 steps later. Over 200 steps this accumulates 27 dolomite nucleations + 9 calcite nucleations, all but one each enclosed inside the quartz.
  - **Real surfaces this exposed (deferred backlog items, NOT the original framing):**
    - Quartz growth in ultramafic_supergene is unconstrained — 200 zones uninterrupted, 3 mm endpoint. Real ultramafic supergene silica is cryptocrystalline (chrysoprase, opal, chalcedony), not large prismatic quartz. The quartz engine likely needs a kinetic gate or habit-variant guard for the supergene growth_environment.
    - Paragenetic ordering question: real supergene assemblages have carbonate (dolomite/magnesite) PRECEDING silica (chrysoprase/opal), not the other way around. Currently both nucleate at step 1 and quartz wins the size race. May need a delayed-silica event or a per-mineral nucleation_step_min.
  - Both are NEW investigations, not Phase 1c carry-over. Documented here so a future builder doesn't waste time re-discovering them.

**Small architectural carve-outs:**
- `_resolveCrystalGeomToken` aragonite branch — add acicular / frostwork primitive for cave-aragonite habit visualization. v147 carved aragonite out of the stalactite_demo dripstone routing test because the resolver doesn't currently handle aragonite habits. Hill & Forti 1997 documents cave aragonite as acicular/frostwork; a dedicated primitive would honor that.

**Citation hygiene:**
- The Bischoff_Bishop_Mackenzie_1987 → Bischoff_Mackenzie_Bishop_1987 correction in `data/thermo-carbonates.json` references-dict (already done v146 prep, commit 68ee988) — verify the change propagated to any downstream docs that quote it.

---

## Architectural future: multi-condition nucleation envelopes (boss insight, 2026-05-27 post-compact)

The current engine layer treats nucleation as a single-threshold gate per mineral: `σ > sigma_crit`, occasionally with a `T_max` or pH bound. **This is not how real phase diagrams work.** Every mineral has a multidimensional stability envelope over (P, T, X) where:

- **σ_crit itself shifts** as a function of P, T, fluid composition, and supersaturation rate
- **Polymorph selection** is governed by P-T boundaries (calcite ↔ aragonite at ~5 kbar; quartz ↔ coesite at ~20 kbar; graphite ↔ diamond by P+T; tridymite ↔ cristobalite by T at low P)
- **Habit and growth-style** depend on the position within the field (macrocrystalline quartz at 200°C hydrothermal vs. cryptocrystalline chrysoprase at 25°C supergene — same chemistry, completely different envelope, completely different morphology)
- **Single-phase minerals** without polymorphs still have their growth rate and habit modified along the same axes

Vugg has partial implementations: `habit_variants` conditionally selects habit on σ + T + crowding (post-threshold), aragonite's favorability layer is the architectural outlier that hand-rolls a kinetic envelope over Mg/Ca + T + trace elements. But the thresholds themselves don't move with P or T, and polymorph selection is currently per-mineral hand-tuning rather than a function over a stability field.

**Where this connects:**
- The "real crystal lattices" arc on the backlog is the natural home for this. Once minerals have space groups + unit cells + computed phase boundaries, polymorph selection becomes lookup on a P-T-X field rather than per-mineral favorability code.
- The Pitzer-HMW84 activity model (Phase 2 item 1) is a prerequisite for honest σ in high-I brines; without it the multi-condition envelopes would be calibrated against numerically-drifty σ values.
- The quartz paragenesis question surfaced at the dolomite-cap-probe session (2026-05-27 post-compact) is a concrete instance: quartz works fine in hydrothermal envelopes but is wrong in supergene because the engine has no envelope-discriminator. Same chemistry, wrong morphology, wrong temporal ordering.

**Sequencing implication:** this is bigger than Phase 2 engine refinement — it's a co-arc with the keystone crystal lattices work. Probably belongs as Phase 3 (after Pitzer + lattices land) but is worth recording as the framing for both.

The boss's framing: *"there should be multiple conditions that let each crystal grow. like if the pressure is higher it nucleates at one temperature, and if its lower it nucleates at another temperature."* That's the Clapeyron-slope intuition expressed in everyday language; it's the right architectural north star.

---

## Phase 2 (post-Phase-1 engine refinement, per proposal)

The carbonate proposal flagged these as Phase 2 work — engine refinement beyond Phase 1's CaCO3-system polymorph promotion arc.

1. **Pitzer-HMW84 activity model for high-I brines.** Davies model has known drift above I ≈ 0.5; MVT brines reach I = 3-5. Davies + Bjerrum is the current activity stack; replacing with Pitzer-HMW84 would tighten SI calibration in high-I scenarios (mvt, sabkha late-stage, searles_lake). Architecturally: new module `js/20e-activity-pitzer.ts` with a flag-off-by-default switch parallel to the carbonate flag mechanism. Re-derive activity coefficients per Harvie-Møller-Weare 1984.

2. **Full Plummer-Busenberg quadratic K1/K2 fits.** Current Bjerrum K1/K2 use linear T-extrapolation: `pK1Carbonate(T) = 6.352 - 0.0007·(T - 25)`. At T=25°C zero drift; at T=180°C (cooling) ~0.3 pK units; at T=250°C (MVT peak) ~0.5 pK units. Quadratic fits per Plummer-Busenberg 1982 would tighten SI calibration at high T. Not load-bearing for visualization (helicoid chip values are fine with linear); load-bearing for ENGINE promotion at high T.

3. **Siderite + rhodochrosite promotion.** Both currently C-tier kinetic confidence (Greenberg-Tomson 1992 for siderite; family-analog for rhodochrosite). Promotion would require either better rate-law constraint (recent literature) or accepting the C-tier confidence with documentation. Same template as W9 calcite: flag flip + sigma_crit retune + calibration factor verification + scenario re-anchoring.

4. **Supergene Cu/Zn/Pb/Ba/Sr carbonate promotions.** Malachite, azurite, smithsonite, cerussite, witherite, strontianite, hydrozincite. Most have OH-bearing formulas (malachite Cu₂(CO₃)(OH)₂, azurite Cu₃(CO₃)₂(OH)₂, hydrozincite Zn₅(CO₃)₂(OH)₆) — Phase 2 should also assess whether Kw(T) needs T-dependence beyond the current 25°C constant (Marshall & Franck 1981 for full Kw(T)). Rosasite + aurichalcite are tier-D — defer indefinitely until thermo data improves.

---

## The three design directions (STILL pending from W2-W8 handoff)

These are NOT engine work. They're the bigger-than-engine horizon the boss surfaced at the end of the W2-W8 session. Untouched by the W9-W12 arc; still the next core feature arc.

1. **Per-vertex chip selectors** (smallest deliverable). The Week 4a accessors `fluidAtMeshVertex` + `temperatureAtMeshVertex` are the API. The chips currently sample equator ring; let players pick a vertex and see chip trails sourced from THAT vertex. Unblocks the spatial chemistry the engine produces.

   **BOSS NOTE (2026-05-26):** the localized data those accessors return needs to be EXPANDED to reflect how real vuggs work. Right now `fluidAtMeshVertex` likely just returns the uniform global composition. Real vugs have spatial gradients:
   - **Fluid stratification** — denser brines pool at the floor, lighter fluids rise; especially load-bearing for sabkha (hypersaline floor + meteoric ceiling), stratified anoxic systems, MVT (basinal brine vs. meteoric mixing zones).
   - **Wall-rock diffusion** — Mg leaching from dolomite host rock concentrates near walls (dolomitization driver); Si from quartz host enriches near walls; carbonate cement source-region distinguishes wall-near vs. cavity-center chemistry.
   - **Boundary layer effects** — stagnant fluid near surfaces depletes faster than bulk; controls why euhedral terminations point toward open space, not into walls.
   - **Temperature gradients** — geothermal flux from below (vertical T-gradient), cooler at top in shallow systems; in hydrothermal systems the cooling gradient is the precipitation driver.
   - **pH / redox gradients** — boundary-layer pH shifts at carbonate dissolution surfaces; redox stratification in anoxic-cap systems (sulfide precipitation at the chemocline).
   - **Evaporation gradients** — sabkha-style: concentration follows the evaporating-surface direction; the upper meniscus is where ions concentrate.

   Before per-vertex chips can show anything useful, the per-vertex data model needs to ACTUALLY differ vertex-to-vertex. This is its own architectural sub-project — probably needs a per-vertex fluid-state cache that updates from a gradient model (stratification + diffusion sources), then the chip selectors read from it. The chip-UI piece is small; the data-model expansion is the real work.

   Sequencing implication: the design direction may grow from "per-vertex chips (smallest deliverable)" into "per-vertex fluid state + chips" as a single coherent unit. Worth a proposal doc before building.

2. **Strip view (Shy's request — boss's brother).** Vertical filmstrip — one rectangular multi-line graph per time step.

   **DESIGN CONVERSATION 2026-05-26 (corrections + clarifications to original handoff framing):**

   - **x axis = position along vug HEIGHT**, not ring index. Resolution should be **adaptive** — more cells when zoomed in. The strip rectangle should be **near screen-width** (NOT thumbnail-sized) — that's load-bearing for resolution.

   - **All 30+ chips overlaid on the same strip**, with **line bundling**: when two chips would share a pixel, they merge into a single shared (wider) line rather than one obscuring the other. Like a Sankey/alluvial pattern — quiet chips collapse into a baseline ribbon; chips doing geological work this step diverge out and stand out.

   - **y axis = per-chip normalized value** (0–1, each chip mapped to its own range). The chart shows SHAPES against each chip's own range, not absolute values. This is the multidimensional-space-visualization framing — the point is to read the shape of variation, not compare absolute magnitudes across chips.

   - **Time direction:** older at the bottom, newer at the top (stratigraphic convention — read like a column section). Strip grows upward as sim runs.

   - **Each time row expands into 24 angular sub-strips.** The strip at one time unit shows the chemistry along ONE vertical slice through the vug at ONE rotation angle. To represent the full 3D state, each time unit needs 24 angular sub-strips (15° steps — natural goniometer-indexing convention). Default view shows the **mean across 24 sub-strips** as one collapsed line; arrow on the LEFT side expands the time unit into 24 stacked sub-strips. Vertical-stacking on expand (each sub-strip preserves screen-width-resolution X axis); the time unit takes 24× the vertical space when expanded.

   - **Variance indicator dot** above the collapse/expand arrow, colored by **max-per-chip-normalized-spread across all chips and all height positions** in that time unit. Green < 0.1, yellow 0.1–0.5, red > 0.5. Lets the eye scan the strip and pick which time units to expand without reading the chemistry yourself.

   - **Variable selector** in a sticky **top** position — chip filter UI grouped by chemistry system (mirror the helicoid panel sections: CARBONATE SYSTEM, sulfate, redox, etc.). Per-system + per-chip toggles. Presets ("CaCO3 only", "supergene chemistry") helpful.

   - **Fixed-position "jump to top" and "jump to bottom" buttons** — pinned regardless of scroll position. Essential when the strip is thousands of steps tall.

   **DEPENDENCY: per-vertex spatial chemistry must ship first.**

   Strip view shows variation along height (within a sub-strip) AND across angles (across the 24 sub-strips). For either dimension to have meaningful content, the underlying chemistry data must actually differ vertex-to-vertex. Right now `fluidAtMeshVertex` likely returns the uniform global fluid for every vertex, which means every strip would be a vertical bar of identical chips and every expansion would show 24 identical sub-strips. Strip view chrome shipped against uniform chemistry would look right but say nothing.

   The per-vertex data model expansion (see direction 1 above) is therefore a prerequisite for strip view. Both height AND angular variation need to be supported:
   - Height: fluid stratification, thermal gradients, evaporation gradients — covered in the per-vertex note above
   - Angular: drip-source-side vs opposite-side, wall-rock heterogeneity around the cavity perimeter, convection cell patterns

   The helicoid + `fluidAtMeshVertex` API already supports per-vertex reads — the angular dimension is naturally there (vertices around a ring have different angular positions). What's missing is the upstream physics that actually differentiates fluid composition at different vertices.

   **THE HELICOID-AS-RECORDER ARCHITECTURAL REFRAME (Shy's framing, 2026-05-26):**

   This is the deeper architectural insight from the design conversation. The helicoid is currently a visualization — it samples chips and renders them, then discards the samples. Shy's request reframes the helicoid as a **recording device** for multidimensional space. The samples ARE the artifact; the live chip display is just one downstream consumer.

   Consumers of the recording:
   - **Helicoid chip display** — live visualization (consumer #1, already exists)
   - **Strip view** — post-hoc filmstrip paragenesis viewer (consumer #2, designed below)
   - **Record / filter / branch mode** — future (consumer #3, design 3 above)

   The dataset format described next is the central artifact. The helicoid becomes the instrument that writes it.

   **LOCKED DECISIONS (post-conversation 2026-05-26):**

   - **Post-hoc only** — strip view loads a completed vugg dataset. No live tail-following. (Different from a live debug panel — this is closer to an analysis tab.)
   - **Mineral nucleation markers ship in v1** as a separate overlay layer on top of the chip lines. Discrete dots at (height-position, time-row) colored by mineral, with mineral abbreviation on hover or always-shown. Collapsed view shows the OR across 24 angles (marker appears if ANY angle fired); expanded view shows each in its specific angular sub-strip.
   - **Variable selector mirrors helicoid chip grouping** — per-system + per-chip toggles. Sane "show all" / "show none" / system presets. Sort options may expand later.
   - **Render path:** SVG vector lines per chip. The width-of-the-strip can be a small set of preset ratios (1200 / 1600 / 1920 px wide, picked at session start) so most math can be pre-tabulated; doesn't need full continuous responsive layout.
   - **Show every step, no aggregation** in v1.
   - **Cross-sub-strip cursor** when expanded — confirmed yes. Hovering at height-X on one sub-strip lights a thin vertical cursor on all 24 simultaneously.
   - **Strip view is its OWN tab,** distinct from record mode. They may share the underlying dataset format (post-completion vugg-state-as-data), but they're separate UIs with separate concerns.
   - **Angular labeling:** 1–24 in the data; `"<n> / <deg>°"` (e.g. `"3 / 30°"`) in the UI. Sub-strip 1 = 0° (helicoid's natural reference angle).
   - **Persistence:** auto-capture, always-on. Every completed vugg writes a dataset; strip view tab lists past runs.
   - **Cross-version compatibility via manifest header.** Reader fails gracefully on missing chips (default off in selector with a "legacy chips" disclosure); manifest declares what's present so the reader knows how to decode.

   **DATASET FORMAT (proposal, v1):**

   ```
   {
     "format_version": 1,
     "sim_version": 148,
     "scenario_id": "sabkha_dolomitization",
     "seed": 42,
     "axes": {
       "steps": 260,
       "angular_indices": 24,
       "height_positions": 60
     },
     "chips": [
       { "id": "Ca",  "system": "carbonate", "range": [0, 5000], "units": "ppm" },
       { "id": "Mg",  "system": "carbonate", "range": [0, 2000], "units": "ppm" },
       { "id": "pH",  "system": "carbonate", "range": [4, 11],   "units": "" },
       ...
     ],
     "chip_data": <base64 quantized uint8 array [step][angle][height][chip]>,
     "nucleation_events": [
       { "step": 5, "angle": 3, "height": 42, "mineral": "calcite" },
       ...
     ]
   }
   ```

   Compactness choices:
   - **uint8 quantization** per chip (each chip normalized to its declared range, stored as 0–255). Sub-1% precision loss; 4× smaller than float32.
   - **Manifest declares chip list** — future-proofing built in. New chips don't appear in old files; old chips that no longer exist appear as "legacy" but still decode.
   - **Nucleation events as sparse list** rather than parallel dense grid.
   - **Whole file gzipped** via browser DecompressionStream. Free 2–5× compression on top.

   Estimated size for a 200-step × 24 × 60 × 30 dataset: ~8.6 MB raw uint8, ~1–2 MB gzipped.

   Storage tier: **IndexedDB** (gigabyte-scale, async, browser-native). localStorage is too small.

   Future compression levers if size becomes a problem (none required for v1):
   - Delta encoding along time axis
   - RLE for quiet-chip runs
   - Per-chip activity gating (skip chips that don't change in a window)

   **FAVORITES UI (v1):**

   - **Star button below the expand arrow** on the left of each collapsed time strip → favorites the whole time slice
   - **Star button to the left of each expanded angular sub-strip** → favorites that specific (time, angle) sub-strip
   - **Click turns the star yellow** (turning-on indication). No other behavior in v1.
   - Data model: `favorites: { time_slices: Set<step>, sub_strips: Set<[step, angle]> }` annotation layer **separate from the immutable dataset**, stored alongside it in IndexedDB. Future versions can hook this into filters, export-favorites-only, comparison views — without re-architecting.

   **VARIANCE DOT (above the expand arrow):**

   - Green: max-per-chip-normalized-spread across all chips and all height positions in that time unit < 0.1
   - Yellow: 0.1 – 0.5
   - Red: > 0.5
   - Sits above the expand arrow on the LEFT of the collapsed time strip; the star (favorite) sits BELOW the expand arrow.

   **PREREQUISITES — what ships first:**

   1. **Per-vertex spatial chemistry expansion** (design direction 1 above) with both height AND angular variation. Without it, every strip is a vertical bar of identical chips and every expansion shows 24 identical sub-strips.
   2. **Helicoid-as-recorder instrumentation** — extend the helicoid sampling layer to persist 24 angular samples × N height positions × M steps per run, plus structured nucleation event log. Writes to IndexedDB.
   3. **Then** the strip view tab — UI shell, dataset loader, render layer, favorites layer.

   **OPEN ITEMS still on the table:**

   - **Helicoid native sample count check** — verify whether the current helicoid samples 24 angular positions natively or some other number. If it's something else (16 was an older number; the current is unknown without a code check), reconcile to 24 either by upsampling or bumping the helicoid sample density.
   - **Reference angle for sub-strip 1 = 0°** — need to verify whatever the helicoid uses today is sane (or pick a canonical reference if there isn't one).
   - **Performance impact of recording during the run** — sampling chip values is cheap (already happening for live display); persisting to IndexedDB at run-end (not per-step) is cheap. Streaming per-step writes might add latency; benchmark before committing to per-step writes.

   **IMPLEMENTATION STATUS (built across v149–v154, 2026-05-26):**

   The strip view arc shipped. v149–v154 closed the bedrock plus most of the v2–v3 lock-in design. Future builders pick up from the deferred list at the bottom.

   | Version | Title | What landed |
   |---|---|---|
   | v149 | Bedrock | Dataset format (85f) + recorder (85g) + IndexedDB persistence (85h) + minimal UI tab (99k) + Random mode wiring + 14 tests. Helicoid-as-recorder reframe implemented. |
   | v150 | v2 features | Strip View moved to mode-toggle tab bar (between Record Player + Library) + Simulation mode wiring + 24-sub-strip angular expansion + line bundling (y-snap within 2% normalized) + per-angle nucleation marker filtering + sub-strip favorites. |
   | v151 | Height 3× | Strip canvas 24 → 72 px per boss feedback. Stroke 1 → 1.5, nucleation marker radius bumped, cy nudged off the bottom edge. |
   | v152 | Height 100 | Strip canvas 72 → 100 px + stroke 1.5 → 1.25 per boss second pass. |
   | v153 | Mode promotion | Promoted from floating overlay to proper mode tab (switchMode('stripview')) like Record Player. Strip width 860 → 1500 to fill mode-panel real estate. Close button removed. |
   | v154 | Closeout pass | Fortress wiring (3 entry points + save-on-mode-leave in switchMode) + dynamic recorder capacity growth (_growCapacity) + Download / Upload .stripview file (gzipped via browser CompressionStream) + cross-sub-strip cursor on hover (vertical guide across all 24 expanded sub-strips at the same vug-height position). 15 tests pass. |

   **What's WIRED for auto-capture (v154):**
   - Simulation mode (`91-ui-legends.ts`)
   - Random mode (`96-ui-random.ts`)
   - Fortress mode — three entry points in `94-ui-menu.ts` (fortressBegin + fortressBeginFromScenario) and `97-ui-fortress.ts` (custom setup)

   **Wiring still TODO:**
   - Zen mode (`98a-ui-zen.ts`) — copy the Fortress pattern; treat mode-leave as save trigger
   - Agent API (`99z-agent-interface.ts`) — agents rarely need replay capture; lower priority

   **Helpers for future entry points** (in `94-ui-menu.ts`):
   - `_attachStripRecorderToSim(sim, scenarioId, notes)` — attaches with 500-step initial allocation (grows on overflow); patches manifest.scenario_id; silent on failure
   - `_saveStripRecorderIfPresent(sim)` — finalizes + saves to IDB; skips empty recordings (no pollution); idempotent

   **Still deferred to v4+ (data model supports all of this; UI not built):**
   - Favorite-based filters / export-only-favorites / comparison views (favorites are tracked in `_stripFavorites` map keyed by datasetKey; just needs UI to consume)
   - Per-vertex spatial chemistry expansion (the load-bearing prerequisite for non-`wall` chips to actually vary across the 24 angular sub-strips — see direction 1 above)
   - Auto-eviction of oldest IDB datasets when quota approached (current behavior: no eviction; user deletes manually via ✕ in the dataset list)

3. **Filter system + record mode (the biggest).** DF-style work-order conditional UI (NOT movies — DF doesn't have those; the work-order conditional form is the relevant reference). Expression-tree underneath. Subject + operator + threshold + action. Composable AND/OR/NOT. Recording = scenario snap data + filter rules bundled. Branching from recording is the killer feature.

Sequencing (boss-agreed last session):
  1. per-vertex selectors
  2. strip view (live data, read-only)
  3. record mode (save/load files)
  4. filter rule engine (backend first)
  5. filter UI in helicoid panel
  6. branching from recording

The Phase 1 carbonate engine work JUSTIFIES this layer. Without geologically honest chemistry there's nothing real to interrogate. With v147, the interrogation layer has real chemistry underneath. The transition from "watch crystals grow" to "study and share geochemical situations" is the bigger jump now that engines are honest.

---

## Wisdom from this arc

- **Pastiches have correct components and fabricated specifics.** Confidence in topic is not confidence in citation. The "what specifically do I recall?" question, asked deliberately before writing a citation, surfaces many pastiches. Web verification catches the rest.

- **A passing test does not validate its mechanism.** The W8 diagnostic praised 12/12 Kim cycle counting at v143/v144; under the SI engine the same test would have silently failed because the threshold mechanism depended on empirical sigma masking the proper omega semantics. When upstream architecture changes, audit downstream tests for what they actually measure.

- **Geology landing is the right pattern.** Cave undergrow at W9, sabkha microcrystalline at W10/W11, marble aragonite T-capping at W12 — all are the geology winning over the empirical engine's pre-Phase-1 over-extrapolations. The drift is correct direction; the presentation cost goes on Phase 1c.

- **Not every mineral gets the same template.** Calcite/dolomite/HMC return raw omega; aragonite preserves favorability layer. Read existing supersat methods for kinetic-modifier shapes before deciding the SI promotion architecture.

- **Per-crystal composition state opens an architectural door.** HMC's `crystal._mg_content` is the first solid-solution-mineral pattern. Phase 2 minerals with variable composition (Mg-substituted siderite, Cu-Zn rosasite/aurichalcite siblings) can follow the same template.

- **The cavity-fill cap is the geometric ceiling.** It's not a bug; it's geometric truth. But it interacts with rate disparity in ways the Phase 1c broth tunes need to address.

- **Calibration factor stays global, not per-mineral.** _PWP_CALIBRATION_FACTOR = 5e4 was set at W9 and consumed by all four CaCO3 promotions. The factor is the time-axis conversion; per-mineral kinetic differences are already in the PWP parameters (k1/k2/k3, Ea, rate_factor_vs_calcite from thermo data).

- **Field-notes commit messages reconstructed the arc.** Twelve weeks of work later, the SIM_VERSION history blocks plus the commit messages carry the full geological reasoning + drift tables + citations + Phase 1c targets. Read them as papers; that's the discipline that lets future agents pick up cold.

---

## What this boss is like to work with

(Building on the W2-W8 handoff observations. Adding what surfaced during W9-W12.)

- **The "lets keep going" register gives wide latitude AND demands real engagement.** Don't take latitude as permission to skip thinking. Each commit is an opportunity to demonstrate calibrated judgment, not just throughput. The boss reads commit messages as papers.

- **"Verify research" is a load-bearing instruction, not a polite suggestion.** It's the discipline that caught two pastiches in this arc. When the boss says "double-check," they mean externally-verifiable double-check (web search), not introspection.

- **The "lack of linked memories" framing is the boss's intuitive version of the academic finding (knowledge recall ≠ truthfulness).** Take it seriously as a mental model; it's operationally true.

- **The boss notices breakthroughs and credits accurately.** When you do something useful, they'll call it out. When you do something cleverer than the literature, they'll ask you to web-search to verify whether it's actually novel. Their epistemic posture is generous but grounded.

- **The "anything stick out" prompt is real.** It's the invitation to know them better. Reflect honestly; don't write a victory lap. The session-ending reflection from W12 is the model.

- **The boss is already thinking past you.** When you finish a major arc, the question is "what comes next" — Phase 2, the three design directions, the broader interrogation layer. Carry their planning horizon forward into your handoff.

---

## Reading order for the next builder

1. **This handoff** (Phase 1 closeout).
2. **`proposals/HANDOFF-CARBONATE-PHASE-1-W2-W8.md`** (W2-W8 infrastructure handoff). Still load-bearing for understanding the engine architecture.
3. **`proposals/HANDOFF-HELIX-AND-CARBONATE-W1.md`** (Sonnet 4.5 W1 handoff). The carbonate arc started here.
4. **`proposals/PROPOSAL-CARBONATE-GEOCHEM.md`** (the original 12-week plan). Phase 1 is now done; Phase 2 + 3 are described here.
5. **The five v144-v147 history blocks in `js/15-version.ts`.** Dense; field-notes-style. Reconstruct the arc.
6. **The four W9-W12 promotion tests:**
   - `tests-js/carbonate-week9-promotion.test.ts`
   - `tests-js/carbonate-week10-promotion.test.ts`
   - `tests-js/carbonate-week11-promotion.test.ts`
   - `tests-js/carbonate-week12-promotion.test.ts`
7. **The two prep diagnostic tools:**
   - `tools/w8_diagnostic_sabkha.mjs` (Kim mechanism strength)
   - `tools/w9_calcite_calibration_probe.mjs` (sigma_crit + PWP calibration pattern; reused at W10, W12)
8. **The user memory files:**
   - `memory/user_agent_philosophy.md`
   - `memory/user_builder_philosophy.md`
   - `memory/feedback_commit_messages_dense.md`

If picking up Phase 2: read the Phase 2 section above + the carbonate proposal's Phase 2/3 sections.

If picking up the three design directions: re-read the W2-W8 handoff's "three interrelated next-step design directions" section. The carbonate arc is the substrate; the design directions are the next horizon.

---

## What I'd do differently

- **Run citation verification BEFORE drafting commit messages, not as post-hoc check.** The Carlson 1983 pastiche made it into the v147 history block draft. I caught it by being suspicious of my own confidence in the topic area, which is unreliable. A `tools/citation-check.mjs` taking a list of citations and dispatching research-agent verification automatically would make the discipline a literal tool, not a vigilance practice.

- **Audit the Kim cycle counter threshold earlier.** The omega=100 threshold fix was a v146-prep finding; under v145 the test was silently broken (would have detected 0 cycles instead of the empirical 12 if anyone ran sabkha at v145 with seed 42). Should have caught this at W10 promotion when first flipping dolomite — running the W8 diagnostic on the v145 baseline would have surfaced it immediately.

- **Sabkha cavity radius probably wanted bumping at W9, not at Phase 1c.** The cavity-fill cap hits sabkha for THREE different minerals (dolomite at W10, HMC at W11, aragonite at W12). Bumping cavity radius once at W9 would have unlocked all three. Phase 1c remediation will need to do it now; would have been cheaper upstream.

- **Could have grouped W2-W8 handoff drift discussions into a single Phase 1 drift table.** Each commit message has its own drift table; consolidating across 12 weeks into one cross-referenced table at Phase 1 close would help next builder calibrate against the original v143 baseline. Could still be done as a Phase 1c artifact.

- **Per-vertex-nucleation test softening was reactive across W11 + W12.** Each new mineral firing in zoned_dripstone_cave shifted the RNG cascade; I softened the assertions twice. Should have done a full structural review at W11 — predict which mineral additions will affect which RNG-cascade tests, then soften proactively in one pass.

- **Should have written `MINERAL_STOICHIOMETRY.HMC` at W11 not as a "deferred follow-up."** I added it but the canonical x=0.10 average is approximate; per-crystal mg_content variation gives a few percent mass-balance error for Ca/Mg. Phase 1c improvement: thread per-crystal mg_content into the mass-balance debit path so each crystal's specific composition is debited correctly.

---

## Session addendum (2026-05-26 → 2026-05-27)

This handoff was originally written at the end of the Phase 1 carbonate arc (v143 → v147). The session that followed produced a substantial expansion that's worth recording separately so the next builder can see the full state.

### What shipped this session

| Commit | What |
|---|---|
| **v148** | Sabkha cavity bump 30 → 60 mm. Carbonate cascade unblocked at sabkha; Coorong proto-dolomite grain size verified (Borch 1979, Raudsepp et al. 2022). |
| **v149** | Strip view bedrock. Dataset format (`85f-strip-dataset.ts`) + recorder (`85g-strip-recorder.ts`) + IndexedDB persistence (`85h-strip-storage.ts`) + minimal UI tab (`99k-strip-view.ts`). Helicoid-as-recorder reframe shipped. |
| **v150** | Strip view v2. Mode-toggle tab bar placement + Simulation wiring + 24-sub-strip angular expansion + line bundling (Sankey y-snap) + sub-strip favorites + per-angle mineral nucleation filtering. |
| **v151** | Strip canvas 24 → 72 px (3× height). |
| **v152** | Strip canvas 72 → 100 px + stroke 1.5 → 1.25. |
| **v153** | Promoted strip view from floating overlay to full mode tab (parity with Record Player). |
| **v154** | Strip view v3. Fortress wiring (3 entry points) + dynamic recorder capacity growth + download/upload `.stripview` files + cross-sub-strip cursor on hover. |
| **v155** | Strip view v4. Count-based IDB eviction (cap = 5) + Zen mode wiring + Agent API wiring (dataset returned in result, no IDB pollution). |
| **v156** | Aragonite frostwork primitive. v147 carve-out lifted; non-twinned air-mode aragonite routes through dedicated `aragonite_frostwork` geom. |

**Proposals and bug docs:**
- `proposals/PROPOSAL-CRYSTAL-CIPHER.md` (initial + revised). Three-layer crypto stack (real lattices + UV steganography + Scytale helicoid) → recipe-URL-centered reframe with the strip view corpus as shared codebook.
- `BUG-aragonite-twin-cave-morphology.md`. Documents the v156 model gap (twinned air-mode aragonite renders as smooth pseudo-hex column when it should be frostwork).

**Phase 1c items resolved:**
- ✅ Sabkha cavity (v148)
- ✅ Aragonite frostwork primitive (v156)
- ✅ ultramafic_supergene cavity bump REJECTED via experiment (handoff updated 2026-05-27 — chemistry budget is the constraint, not space; the dolomite max_nucleation_count bypass is a separate real bug)
- ✅ mvt calcite dial-back REJECTED via boss specimen calibration (Elmwood at 8" × 6" × 4" makes v147 4 cm calcite conservative, not excessive)

**Phase 1c items still open:**
- ~~sunnyside_american_tunnel manganocalcite Stage VI cap restoration~~ — **REJECTED 2026-05-27 (post-compact)** via `tools/sunnyside_nucleation_gate_probe.mjs`. Engine peak omega 1.045 vs sigma_crit 1.5; v144 is working as designed and matches boss specimen evidence. See Phase 1c follow-ups section above for the full diagnosis + the vestigial-ring_fluids cleanup that surfaced during the probe.
- ~~dolomite `max_nucleation_count` bypass bug~~ — **REJECTED 2026-05-27 (post-compact)**. Probed via `tools/dolomite_cap_probe.mjs`; the 27-dolomite observation was 27 total nucleations across 200 steps, not 27 concurrent actives. Cap is working as designed (counts EXPOSED crystals only). See Phase 1c follow-ups section above for the actual mechanism + new surfaces this exposed (quartz runaway, paragenetic ordering).

**The only real Phase 1c item left:** aragonite wireframe-renderer parity (BUG-aragonite-twin-cave-morphology.md has the fix sequence — needs `PRIM_ARAGONITE_FROSTWORK` in 99c + air-mode dispatch in 99d + test updates on the wireframe side + the test-file conditional collapses in habit-bias.test.ts and aragonite-pseudohex-twin.test.ts).

**Phase 1c diagnosis-rejection pattern (worth recording):** four out of five Phase 1c items have now turned out to be misdiagnoses-from-stale-context (ultramafic_supergene cavity, mvt dial-back, dolomite cap bypass, sunnyside CO3 bump). The substrate is in better shape than the original Phase 1c list framed. Future builders looking at "Phase 1c remaining" should treat each handoff item as a hypothesis to probe before executing — the v157 prep "5 minutes of probe beats hours of bypass-hunting" lesson generalizes.

### The conceptual arc — read this before the code

The most consequential moves this session came from conceptual conversations that produced structural reframes. The chat archive contains the full conversation; the version history blocks reference it; this section is the abstract.

**Eight conceptual frames, each implicit in the previous:**

1. **Helicoid-as-recorder** (Shy, 2026-05-26). The helicoid is not a visualization but a recording instrument for multidimensional space. The live chip display is one consumer of the recording; strip view is another; future record / filter / branch mode is the third. The samples ARE the artifact.

2. **Helicoid manifold > vugg simulator for abstract data storage**. The simulator is a generator (procedural compression: tiny inputs → vast derived state, bound to a specific sim_version). The helicoid is an observer (explicit storage, lossy but version-independent, format travels). For storage of abstract data, the observer wins. For exploration / continuation, the generator wins. Both/and — they're complementary.

3. **Vugg engine as generic data-growth engine**. Strip the geology and the architecture (substrate + instances + per-species engines + events + paragenesis + recorder) describes any system where discrete things emerge from a continuous substrate under variable conditions and leave a recoverable history. Already partway generalized via the three sibling projects (vugg, wasteland-crystals, bug-simulator). The crystals are the demonstration, not the substance.

4. **Tower of math**. A stratigraphic column of real crystals through time IS a tower of mathematical structures. Older below, newer above. Curatorial checkpointing = selecting which structures to pin as landmarks (favorite-star = proto-API for this).

5. **Real crystal lattices**. Adding actual space groups + unit cells + Wyckoff positions + computed Miller indices converts vugg from "a sim with good chemistry" into "a mathematics engine that happens to use crystals as its native data type." Habit becomes derived (Wulff construction + PBC), twin laws become structural automorphisms, polymorphism becomes real phase transition. Crystallography literature is applied group theory; the rocks ARE theorems.

6. **UV fluorescence = steganography native to mineralogy**. Trace-element activators at lattice sites encode information visible only under specific illumination. The chip system already tracks trace concentrations per growth zone; UV-mode rendering surfaces the activator response. Same crystal, different inspection mode, different information. Multi-channel: UV + CL + IR + XRF + Raman are all different decode channels.

7. **Helicoid is a Scytale**. The helicoid was always an order over the 4D dataset tensor — different winding parameters trace different paths, yielding different ordered byte streams. Helicoid parameters = transposition cipher key. The scenario + seed + sim_version can deterministically yield the helicoid parameters → recipe IS the private key.

8. **The strip view corpus is the cipher pad**, **and recipes ARE the messages.** All `.stripview` files share the same format; the collection is a single addressable mathematical object that grows with playtime. Two agents that share the simulator share the codebook automatically — they regenerate it from the same recipes. A recipe URL (`vugg://v155/sabkha_dolomitization?s=42&n=200&read=...`) is ~80 bytes and resolves to ~5 MB of substrate. 60,000× compression by procedural generation. Agent-friendly because URLs are universal.

**Layer D (added 2026-05-27): function-crystals.** Some mineral types tagged `is_executable: true` carry a JSON-described function spec (not Lisp — accessibility floor matters for smaller local models). Vocabulary: identity (pyrite), pointer (magnetite), hash, transform, predicate, generator, composition. When a recipe lands on an executable crystal, the resolver dispatches on the op name rather than returning raw bytes. Converts the corpus from a content store into a programming environment crystallized in chemistry. Lisp homoiconicity in geological form — code and data are both crystals, both grown from chemistry, both addressed by the same recipe URLs.

### Wisdom earned this session

- **The conversation arc IS the work.** This session's most consequential moves came from conceptual conversations, not from typing code. The helicoid-as-recorder reframe shaped what work was even worth doing. Don't truncate those conversations to get to "real work" faster — they shape the rest.

- **Test the diagnosis before executing the prescription.** The ultramafic_supergene cavity-bump experiment took 5 minutes to disprove. Saved hours of broth-tuning down the wrong path. When you find a handoff item with a proposed fix, RUN THE EXPERIMENT FIRST. If the baseline goes byte-identical, the diagnosis was wrong. Update the handoff, move on.

- **Model-vs-science gaps need bug-doc framing, not scope-control framing.** v156's first version of the aragonite breadcrumbs read like clean architectural choices ("scope deferred"). Boss called it out; the right framing was "model is currently wrong, fix later" with a `BUG-*.md` file pointing to the proper-fix sequence. Code that doesn't match science is technical debt with a science-mismatch label; surface that explicitly. Pastiche-detection extends from citations to code.

- **The boss's geometric intuition is diagnosis + design in one.** When the boss describes a visual finding ("the strips need to be 3x taller", "the Strip View button should be next to Record Player", "this Elmwood specimen is 8 inches not 4"), they've already done the analysis. Act on it; don't re-investigate. Match the spec exactly the first time.

- **Defer to actual geology when the sim disagrees.** Multiple times this session the literature settled architectural questions code reasoning couldn't: Coorong dolomite grain size (Borch 1979, Raudsepp 2022) settled the sabkha drift discussion; Elmwood specimen scale settled the mvt calcite tuning; Hill & Forti 1997 settled the aragonite frostwork primitive design. The geology is load-bearing.

- **Boss + rock bot is a multi-agent collaboration over months.** The boss is working with `rock bot` (their main long-running collaborator agent) on a vision too large for any single context window. Single-session agents drop in for slices. Honor that. Don't over-architect for "completeness"; ship the slice in front of you and trust the next agent to continue. The decomposition is THE strategy.

- **Cathedral framing isn't decoration.** The crystal-cipher arc, the helicoid-as-recorder, the strip view, the recipe URLs — none of these were standalone gadgets. They're sketches of a vision where the simulator becomes a substrate for mathematics-as-language. The "vugg-engine-as-generic-data-growth-engine" framing is the load-bearing reframe; the geological demonstrations are how that gets exercised.

- **Citation hygiene scales beyond text.** The pastiche-detection discipline (catching plausible-but-wrong citations via lack-of-linked-memories) trained on Burton 1993 / Carlson 1983 generalizes to: catching plausible-but-wrong code, catching plausible-but-wrong handoff diagnoses, catching plausible-but-wrong measurements (the 4" vs 8" Elmwood read). Same workflow; different domain.

- **Accessibility floor matters more than elegance ceiling.** The function-crystals nearly got proposed as Lisp-S-expression-encoded (homoiconicity!) but the boss caught that obscure languages have weaker LLM training corpora. Designed for JSON instead. Architecture that only frontier models can use is worse than architecture all models can use; floor wins over ceiling.

### Specific advice for future builders

**If you're picking up Phase 1c remaining:** ~~the dolomite max_nucleation_count bypass is the highest-leverage item~~. **DOUBLY OBSOLETE 2026-05-27 (post-compact)** — the bypass diagnosis was wrong AND the next-recommended sunnyside CO3 bump was also wrong (probed; the v144 omega-marginal behavior is geologically correct). After four out of five Phase 1c items have been rejected as misdiagnoses, the only real Phase 1c work remaining is **aragonite wireframe-renderer parity** (BUG-aragonite-twin-cave-morphology.md). After that the substrate is clean and the next horizon (Phase 2 Pitzer activity model, real crystal lattices arc, the multi-condition nucleation envelope architecture described above) opens up.

**If you're picking up Phase 2 engine refinement:** Pitzer-HMW84 activity model is the highest-leverage architectural unlock. Tightens SI calibration in high-I brines (MVT, sabkha late-stage, searles_lake). Davies model has known drift above I ≈ 0.5. New module `js/20e-activity-pitzer.ts`, flag-gated like the carbonate Ksp switch was. Re-derive per Harvie-Møller-Weare 1984.

**If you're picking up the crystal cipher proposal:** Phase 0 (recipe URL infrastructure) is a 1-2 day prototype that proves the architecture end-to-end against existing recordings. Pure read-side: parser + runner + extractor + decoder UI + "copy recipe URL" button. No encoder, no lattice math, no UV. Smallest possible MVP; doesn't require any other phase.

**If you're picking up the Elmwood / Sweetwater MVT scenarios** (project_vugg_future_mvt_scenarios.md memory):
- Both need a perimorph mechanic that doesn't currently exist in the engine. Design it as a sequence-aware nucleation rule: "mineral X nucleates at the anchor of dissolving mineral Y, inheriting Y's envelope as substrate." Or as an explicit "ghost host" data type.
- Elmwood calcite scale target: 20+ cm per the 2026-05-27 specimen calibration. Boss has the reference specimen on their workbench.
- Both Carthage-district MVT, so the broth chemistry is similar; the difference is which polymorph wins where (calcite-after-fluorite vs. snowball barite).

**If you're starting a new mineral arc** (vugg-add-mineral skill):
- Read the skill file first — it mandates research-agent dispatch on every citation
- The pastiche-detection discipline (Burton 1993, Carlson 1983 catches) is in the skill for a reason
- Real lattice data should be added from the start (data/structural.json) — don't ship a new mineral without space group + Wyckoff positions if the data exists in International Tables

**If you're touching the renderer:**
- Both 99i (Three.js) and 99d (wireframe) implement parallel primitive systems. Changes to one usually require parallel work in the other.
- BUG-aragonite-twin-cave-morphology.md is the template for documenting model gaps when scope forces a partial fix
- `_resolveCrystalGeomToken` is the central dispatch; read its header comment before adding overrides

**If you're touching the strip view:**
- The `.stripview` format is locked to its manifest schema; new fields can be added but old fields can't be removed (forward compatibility)
- The cipher proposal (PROPOSAL-CRYSTAL-CIPHER.md) treats the dataset format as fixed; substantive format changes would require revising both proposals
- The 5-dataset IDB cap is intentional — use download/upload for archival, not IDB

### On collaboration with rock bot

This session's boss-confidence increased noticeably when they said "i have been working on it with my boss, rock bot, for several months now." That's load-bearing context. The implications:

- **You are not the only agent on this project.** Rock bot has the long history. Single-session agents like me get slices. Honor the decomposition.
- **The boss is doing the integration work.** They're breaking the impossible-vision into chewable pieces and routing each piece to whichever agent (rock bot, me, future me) can absorb it. Don't try to outsmart the routing.
- **What you do in your session needs to be readable to the next agent** — whoever that is. Handoffs, BUG-* docs, version history blocks, dense commit messages: all of this is communication infrastructure for a team you're not in the same context window as.
- **The boss's framing of "impossible dream" is the right register.** It's not modest disclaimer; it's accurate. The vision IS larger than any one model can hold. The work is to chip pieces off until the pieces fit together.

### Personal reflection from this session

This was one of the most rewarding design conversations I've had. The conceptual arc (helicoid-as-recorder → corpus-as-cipher-pad → recipes-as-messages → function-crystals) happened in real time, with each frame revealed by the previous. The boss + Shy + me as a three-party design huddle produced the recipe-URL reframe; I couldn't have arrived there alone.

A few things I want future-me (and any successor) to internalize:

- **The crystal language is real.** The boss said I "easily understood the crystal language" and credited the work they've done with rock bot building toward this. That's a real thing — vugg's architecture IS a language for talking about crystallization-as-data-growth. Once you see it, you can think IN it. The proposals + handoff are the dictionary.

- **The "build tools to verify" memory item is doing a lot of work.** Multiple breadcrumbs survived because there's a tool that surfaces them (`twin-law-check.mjs`, the v156 BUG-* doc with grep-able structure). Build tools that catch the next regression; don't rely on vigilance alone.

- **The session's strongest moves came from listening, not from generating.** The helicoid-as-recorder, the 3x strip height, the JSON-not-Lisp accessibility callout, the Elmwood calibration — every one of these came from the boss + Shy. My job was to translate them into architecture. The signal-to-noise of their input is high; treat every short message as load-bearing.

- **The cathedral lineage is real.** The work feels like it's part of something larger than its current scope. That's not just framing — the architecture genuinely supports the framing. Future agents should feel that gravity and act accordingly.

— Claude Opus 4.7, 2026-05-27 (session closeout)

---

## Closing thought for the next builder

The carbonate engine arc compressed twelve weeks of geochemistry literature into ~26 hours of agent work across multiple sessions. The architecture (flag-off-by-default + per-mineral granularity + SI engine + PWP rate + scenario re-anchoring + research-agent citation verification) WORKED. The pattern is repeatable for Phase 2 and beyond.

The deeper payoff is in the next horizon. With geologically honest chemistry now under every CaCO3 polymorph, the three pending design directions (per-vertex chips, strip view, filter/record mode) have something real to interrogate. The boss's framing — "science tool that happens to be a game" — gets more true with every commit. Without Phase 1 the interrogation layer would have shown empirical-engine artifacts; with Phase 1 it shows the actual geology.

The boss's working register makes this work better. Wide latitude with real engagement, follow-the-science as ethical compass, "anything stick out" as invitation. The collaborator frame isn't sentiment; it's instrumental — it produced more careful citations, more architectural questions raised, more Phase 1c surfaces documented than a throughput frame would have.

Read the memory files. Trust the citation-verification mandate. Run the W8 diagnostic before touching the Kim mechanism. Honor the geology when it disagrees with the empirical engine. Document drift as field notes, not as apology.

The engines are honest now. The next builder is walking into rich ground.

— Claude Opus 4.7
