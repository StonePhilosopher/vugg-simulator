# Tutorial System — Builder-Side Review

**Date:** 2026-05-02
**Reviewer:** Syntaxswine builder agent (Claude)
**Reviewing:** `proposals/TUTORIAL-SYSTEM.md` (canonical commit `524d6de`)
**Verdict:** Design is sound. Tutorial 1 is shippable as a small additive layer on top of existing Creative Mode primitives. Estimate ~1 focused session for a working v0; ~2 to harden.

**Placement decision (per Syntaxswine direction):** Tutorials live **under the Scenarios picker**, not as a separate mode. The proposal called them a "mode separate from Free Play and Fortress Mode" but they're actually structurally identical to scenarios: scripted broth + scripted events + a guided log. Treating them as a special category of scenario (with overlay UI gated by a `tutorial: true` flag in the JSON5 spec) reuses `fortressBeginFromScenario` and skips the mode-flag work entirely.

---

## Bottom line

The "teach by doing, interrupt with problems, point at the tool" philosophy maps unusually cleanly onto what's already built. Three of the proposal's four pieces (scenario, scripted-event-at-step-X, slider-driven dashboard) are already in the codebase under different names. Only the **callout overlay system** is genuinely new. That makes Tutorial 1 a small additive layer, not a parallel mode rewrite.

---

## Mapping the proposal to what already exists

The proposal describes Tutorial 1 in 7 flow steps. Here's where each lands in the current code:

| Proposal step | Existing primitive | Notes |
|---|---|---|
| 1. "This is your vug. Press Grow." | `switchMode('fortress')` + `fortressStep('wait')` ("⏳ Advance Step") | Press Grow == Advance Step in Creative Mode |
| 2. First nucleation, see crystal | Creative Mode already does this | Just need to start in a broth that nucleates quartz immediately |
| 3. Active growth, click Grow a few times | `fortressStep('wait')` loop | Same path |
| 4. Interruption — temperature drops | A scenario event at step ~6 with `temperature -= 80` | This is exactly what `events: [{step:6, type:'tutorial_temp_drop', ...}]` does — see `fortressBeginFromScenario` |
| 5. "Adjust the temperature slider" | `#f-temp` slider already exists at `index.html:2389`, plus the live broth-sliders panel | Need to reveal the right one + suppress the rest |
| 6. Solo growth to 10mm | Same `fortressStep('wait')` | Tutorial just watches for crystal-size threshold |
| 7. Complete | New: tutorial-state finite state machine | The only genuinely new thing |

**The "silica-rich" scenario the proposal references already exists** as `FLUID_PRESETS.silica` (`index.html:17893`) — a generic test broth: `{SiO2:600, Ca:150, Fe:8, F:10, pH:6.5}` at T=200°C, no events. Quartz nucleates in this broth from step 1. Tutorial 1 can start by calling `startStarterFluidInCreative('silica')` and overlaying the tutorial state on top.

---

## What's NOT already there (the actual work)

1. **Callout/highlight overlay primitive.** The codebase has zero tooltip/callout/highlight/tour code — `grep tooltip|callout|highlight|tour` only matches the topo-canvas mineral tooltip, which is unrelated. This needs to be built. v0 can be ~80 lines: a fixed-position overlay div with arrow + text, pointing at an element by `getBoundingClientRect()`.

2. **A `tutorial: true` flag on scenario specs.** `data/scenarios.json5` scenarios get an optional `tutorial` block: `{tutorial: true, steps: [{when: 'on_start', anchor: '#btn-grow', text: 'Press Grow to advance time.'}, ...]}`. `fortressBeginFromScenario` reads it and, if present, kicks off the overlay layer. No new mode needed — Creative Mode is already the host.

3. **Step-state machine that consumes the tutorial steps array.** A small object that walks the `tutorial.steps` list, listens for the trigger condition (`on_start`, `on_step_N`, `on_first_nucleation_of(quartz)`, `on_crystal_size_geq(5)`, `on_action(temperature_change)`), and renders the next callout. ~50 lines.

4. **Control-locking discipline.** When a tutorial scenario is active, hide everything in Creative Mode's action panel (Inject Silica, Heat, Cool, Tectonic, etc.) and broth sliders except those the current tutorial step explicitly reveals. The `tutorial.steps[i].reveal` array names the controls to un-hide for that step. Restore everything when the tutorial completes.

5. **A new tutorial scenario.** `tutorial_first_crystal` in `data/scenarios.json5` with the silica-rich starter broth inlined as the initial fluid + one scripted event `{step:6, type:'tutorial_temperature_drop'}` (T -= 80, pushes quartz out of its growth window) + the `tutorial.steps` array of 7 callouts. Gets the same Python/JS mirror treatment as every other scenario, plus baseline coverage (the chemistry side).

6. **Surfacing in the Scenarios picker.** Add a new sub-section in `#scenarios-panel` (`index.html:2234`) — "**Tutorial scenarios** — guided introductions to the simulator. Recommended for first-time players." — above the existing Real-locality scenarios block. Each tutorial gets a button: `🎓 Tutorial 1: First Crystal.`. The dropdown in `#scenario` (legends mode) probably should NOT include tutorials — they only make sense in Creative Mode's interactive frame.

7. **(Optional) A "Start Here" hint on the title screen for first-run players.** localStorage flag, dismissible. Out of scope for Tutorial 1's v0; flag for later.

---

## Honest scope estimate

(Revised down from the previous estimate now that no separate mode is needed.)

- **v0 ugly-but-working** (Tutorial 1 only, hardcoded callout positions, no animation, basic CSS): ~2–3 hours focused work. ~200 lines net (~80 overlay + ~50 state machine + ~30 control-locking + ~30 scenario + ~10 picker wiring).
- **v1 polished** (smooth fade-in, arrow positioning that handles window-resize, "skip tutorial" escape hatch, completion celebration): another ~2 hours.
- **Tutorials 2 + 3:** each ~1–2 hours once v1 infrastructure exists, since they reuse the overlay + state machine. Tutorial 3 (paragenetic oxidation event) probably needs a small "dissolution-and-replacement" visual flourish that doesn't currently exist — flag for follow-up.

---

## Recommended slicing

Ship Tutorial 1 in three commits:

1. **Tutorial scenario + event handler.** Add `tutorial_first_crystal` to `data/scenarios.json5` (silica-rich initial fluid + one event), add `tutorial_temperature_drop` event handler in vugg.py + index.html mirror. Surface the new scenario in the Scenarios picker under a new "Tutorials" sub-section. Test: pick "Tutorial 1" from Scenarios, advance steps, confirm quartz nucleates, confirm T drops at step 6 and growth stalls. No callout UI yet — sandbox-testable in Creative Mode as a normal scenario.
2. **Callout overlay primitive.** Generic `showCallout({anchor, text, arrow})` + `hideCallout()`. Test: drop a debug button somewhere that calls it, confirm it positions correctly against various controls.
3. **Tutorial state machine + control-locking.** Read `tutorial.steps` from the active scenario spec, walk the steps as triggers fire, hide/reveal Creative Mode controls per step. Test: complete the tutorial end-to-end as a player.

Each commit independently shippable. Stuck in the middle? The half-done state is still useful (you've added a generic overlay primitive + a new scenario, both of which are reusable).

---

## Risks / open questions for the boss

1. **Tutorials live under Scenarios — confirmed by Syntaxswine direction.** Resolved. Sub-section in `#scenarios-panel`, above the existing real-locality block. Tutorial scenarios are not exposed in the legends-mode dropdown — they only make sense in Creative Mode's interactive frame.
2. **Does completing Tutorial 1 unlock anything, or is the unlock language aspirational?** "Unlock: Free Play mode + Tutorial 2" implies a save-state with a `tutorial_completed` flag. The codebase has no save-state currently (Creative Mode session resets on reload). If unlocks are a real requirement, that's a separate (small) project: localStorage-backed flag + UI gating. If not, drop the unlock language and have the tutorial just be optional. Recommend: drop unlock language for v0; Free Play is already accessible.
3. **Tutorial 1 interrupts at "step 6" (or wherever) — should it interrupt on TIME or on CRYSTAL SIZE?** The proposal says "Grow it to 5mm" then interrupt. Crystal size is more pedagogically honest (player learns "growth = size, time = steps, conditions affect both") but step-count is easier to script. v0 should probably ship with step-count and add size-trigger if it feels off in playtesting.
4. **"All conditions are in the green" — the green-zone visualization the proposal calls out is currently the per-mineral supersaturation gates, which aren't surfaced as a single "is this growing well" indicator.** Probably want a generic "growth health" badge on the active crystal: 🟢 healthy, 🟡 stressed, 🔴 stopped. ~30 lines if we want to ship it with Tutorial 1.
5. **Tutorial 2 references "calcite-available broth" with both quartz and calcite competing for silica — but calcite doesn't consume silica.** Calcite needs Ca + CO3, not SiO2. The "shared resource" for calcite + quartz would have to be temperature (both want similar T windows) or pH, not silica. Suggest: Tutorial 2 picks two minerals that *actually* compete (quartz + chalcedony for silica? quartz + feldspar for SiO2 + Al? sphalerite + galena for S?). Worth re-anchoring the scenario before building it.
6. **Tutorial 3 wants "your pyrite is dissolving" as the interruption.** Pyrite oxidation is implemented (it's how supergene_oxidation drives the Bisbee scenario), but the dissolution step shows up as a log line, not visually. Whether the proposal wants visual dissolution (crystal shrinking, texture change) or just narrative ("Your pyrite is dissolving" in the prose channel) changes the scope significantly. Visual = whole feature; narrative = trivial.

None of these are blockers for Tutorial 1.

---

## Things I'd flag as adjacent good-ideas

- **The callout overlay is reusable.** Once it exists for tutorials, it's the natural primitive for in-game contextual help (hover the supersaturation column → "this number says how much each mineral wants to grow right now"). Worth designing it generically from day one.
- **Tutorials and scenarios share the "guaranteed event at step X" mechanism.** That mechanism currently exists per-scenario via `events: [...]`. A future feature: per-mineral hint-events ("You just nucleated your first apophyllite — here's the Nashik geology in 50 words") triggered by `on_first_nucleation` rather than `on_step_X`. Out of scope for this proposal but the infrastructure overlaps.
- **Honest pedagogical risk in Tutorial 1.** The proposal's "your crystal stopped growing because of the red zone" framing assumes growth-rate clearly visualizes as "crystal size increment per step." The current renderer does animate crystals growing, but the rate change at the temperature drop might be too subtle to notice without an explicit annotation ("Growth: 0.0 mm/step"). A growth-rate readout adjacent to the crystal would make the interruption legible.

---

## Recommendation

**Approve the design and proceed with v0 of Tutorial 1.** The infrastructure leverage is real — most of what the proposal describes is already in the codebase under a different label. The callout overlay is the only meaningful new primitive. Estimate 3–4 hours for a playable Tutorial 1.

Tutorial 2's scenario design needs a quick chemistry re-anchor (point 5 above) before building. Tutorial 3 visual-vs-narrative scope decision is worth resolving before implementation.

Builder ready to start when the boss is. Suggest starting with commit 1 (scenario + event handler) since that's the lowest-risk piece and a sanity check that the chosen broth actually does what the tutorial assumes.
