# Tutorial System — Builder-Side Review

**Date:** 2026-05-02
**Reviewer:** Syntaxswine builder agent (Claude)
**Reviewing:** `proposals/TUTORIAL-SYSTEM.md` (canonical commit `524d6de`)
**Verdict:** Design is sound. Tutorial 1 is shippable as a small additive layer on top of existing Creative Mode primitives. Estimate ~1 focused session for a working v0; ~2 to harden.

**Placement decision (per Syntaxswine direction):** Tutorials live **at the top of the New Game Menu** (`#new-game-panel`, the "Begin" screen) — above Scenarios / Creative mode / Simulation / The Groove / Home. They're the first thing a new player sees after clicking "Begin," which is the right pedagogical placement.

Structurally, tutorials are still implemented as a **scenario variant**: scripted broth + scripted events + a `tutorial: true` flag in the JSON5 spec that triggers the overlay UI. They reuse `fortressBeginFromScenario` and skip any new mode-flag plumbing. The placement decision is purely UI (where the entry button lives) — the underlying machinery is shared with Scenarios.

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

6. **Surfacing at the top of the New Game Menu.** Add a new section in `#new-game-panel` (`index.html:2221`) — "**Tutorials**" — ABOVE the existing Scenarios / Creative mode / Simulation / The Groove / Home buttons. Each tutorial gets its own button at the top of the menu: `🎓 Tutorial 1: First Crystal.` etc. The Scenarios picker (`#scenarios-panel`) and the legends-mode dropdown (`#scenario`) do NOT need tutorial entries — the New Game Menu is the single canonical entry point.

    Suggested HTML structure (drop-in at `#new-game-panel` after the menu-subheading):
    ```html
    <div class="menu-subheading">Tutorials</div>
    <div class="menu-buttons">
      <button onclick="startTutorial('first_crystal')">🎓 Tutorial 1: First Crystal.</button>
      <button onclick="startTutorial('mn_fluorescence')">🎓 Tutorial 2: A Mn-Doped Calcite.</button>
      <button onclick="startTutorial('oxidation_breach')">🎓 Tutorial 3: The Fourth Door.</button>
    </div>
    <div class="menu-subheading">Or jump straight in</div>
    <div class="menu-buttons">
      [existing Scenarios / Creative mode / Simulation / The Groove / Home buttons]
    </div>
    ```
    `startTutorial(name)` is a thin wrapper around `startScenarioInCreative(name)` that sets a tutorial-mode flag before booting the scenario, so the overlay layer activates.

7. **(Optional) A localStorage `seen_tutorial_1` flag** so returning players don't get the tutorial section visually shouting at them every time they hit "Begin." Render the section dimmer/smaller after first completion, or move it below the main buttons. Out of scope for v0 — first ship makes the section bold for everyone, polish is a follow-up.

---

## Honest scope estimate

(Revised down from the previous estimate now that no separate mode is needed.)

- **v0 ugly-but-working** (Tutorial 1 only, hardcoded callout positions, no animation, basic CSS): ~2–3 hours focused work. ~200 lines net (~80 overlay + ~50 state machine + ~30 control-locking + ~30 scenario + ~10 picker wiring).
- **v1 polished** (smooth fade-in, arrow positioning that handles window-resize, "skip tutorial" escape hatch, completion celebration): another ~2 hours.
- **Tutorials 2 + 3:** each ~1–2 hours once v1 infrastructure exists, since they reuse the overlay + state machine. Tutorial 3 (paragenetic oxidation event) probably needs a small "dissolution-and-replacement" visual flourish that doesn't currently exist — flag for follow-up.

---

## Recommended slicing

Ship Tutorial 1 in three commits:

1. **Tutorial scenario + event handler + New Game Menu entry.** Add `tutorial_first_crystal` to `data/scenarios.json5` (silica-rich initial fluid + one event), add `tutorial_temperature_drop` event handler in vugg.py + index.html mirror. Surface a "Tutorials" section at the top of the New Game Menu (`#new-game-panel`) with the Tutorial 1 button. Test: click Begin → click Tutorial 1 → confirm Creative Mode boots with the silica broth, advance steps, confirm quartz nucleates, confirm T drops at step 6 and growth stalls. No callout UI yet — sandbox-testable end-to-end as a normal scenario.
2. **Callout overlay primitive.** Generic `showCallout({anchor, text, arrow})` + `hideCallout()`. Test: drop a debug button somewhere that calls it, confirm it positions correctly against various controls.
3. **Tutorial state machine + control-locking.** Read `tutorial.steps` from the active scenario spec, walk the steps as triggers fire, hide/reveal Creative Mode controls per step. Test: complete the tutorial end-to-end as a player.

Each commit independently shippable. Stuck in the middle? The half-done state is still useful (you've added a generic overlay primitive + a new scenario, both of which are reusable).

---

## Risks / open questions for the boss

1. **Tutorials live under Scenarios — confirmed by Syntaxswine direction.** Resolved. Sub-section in `#scenarios-panel`, above the existing real-locality block. Tutorial scenarios are not exposed in the legends-mode dropdown — they only make sense in Creative Mode's interactive frame.
2. **Does completing Tutorial 1 unlock anything, or is the unlock language aspirational?** "Unlock: Free Play mode + Tutorial 2" implies a save-state with a `tutorial_completed` flag. The codebase has no save-state currently (Creative Mode session resets on reload). If unlocks are a real requirement, that's a separate (small) project: localStorage-backed flag + UI gating. If not, drop the unlock language and have the tutorial just be optional. Recommend: drop unlock language for v0; Free Play is already accessible.
3. **Tutorial 1 interrupts at "step 6" (or wherever) — should it interrupt on TIME or on CRYSTAL SIZE?** The proposal says "Grow it to 5mm" then interrupt. Crystal size is more pedagogically honest (player learns "growth = size, time = steps, conditions affect both") but step-count is easier to script. v0 should probably ship with step-count and add size-trigger if it feels off in playtesting.
4. **"All conditions are in the green" — the green-zone visualization the proposal calls out is currently the per-mineral supersaturation gates, which aren't surfaced as a single "is this growing well" indicator.** Probably want a generic "growth health" badge on the active crystal: 🟢 healthy, 🟡 stressed, 🔴 stopped. ~30 lines if we want to ship it with Tutorial 1.
5. **Tutorial 2 base + lesson confirmed (per Syntaxswine): `FLUID_PRESETS.carbonate` + Mn-bump-changes-the-calcite.** Broth is `{Ca:300, CO3:250, SiO2:80, Fe:10, Mn:8, F:5, pH:7.0}` — calcite-dominant.

    **The lesson is NOT competition.** The proposal framed Tutorial 2 as "two minerals share a resource" but the actual pedagogical thrust the boss wants is **mixing other fluids into a growing crystal changes how it grows** — same crystal, new property, the broth-history is recorded in the crystal itself. This is a cleaner escalation than competition:

    - Tutorial 1: conditions affect *growth* (T drops → growth stops)
    - Tutorial 2: additives affect *properties* (Mn crosses threshold → calcite zones glow under UV)
    - Tutorial 3: conditions change *identity* (oxidation → crystal transforms / dissolves into something new)

    Each tutorial teaches a deeper layer of "the vug remembers what you did." Calcite stays the protagonist throughout T2; a second mineral (rhodochrosite) is at most an optional aspirational beat at the end if Mn keeps climbing.

    **Engine support already in `data/minerals.json`:**
    - calcite (line 384): description literally says *"Mn²⁺ activates orange fluorescence; Fe²⁺ quenches it — the boundary between glowing and dark zones records a fluid-chemistry shift."* `fluorescence: {activator:"Mn", threshold_ppm:2, color:"orange_red"}` at line 421.
    - The carbonate broth's Fe:10 is at the quencher range — perfect setup for the optional third beat: "you added Mn but it's not glowing yet — the iron is quenching it. Drop Fe and try again."

    **Suggested 4-beat flow (single crystal, no competition):** (1) "Grow a calcite" — player advances steps, calcite nucleates and grows. (2) "Add some manganese" — Mn slider revealed, calcite zones start incorporating Mn²⁺ as new growth bands. (3) "Switch to UV view" — UV toggle revealed, the Mn-doped bands glow orange-red while older Fe-quenched zones stay dark. The player can see in the crystal's stripes the exact moment they changed the broth. (4) (Optional, depending on engine readiness) "Drop the iron" — Fe quencher cleared, full crystal lights up. Or alternatively a small "add more Mn" beat that nudges toward rhodochrosite plating, but that's bonus content, not the core lesson.

    **Verification before building:** confirm the engine's UV/fluorescence rendering pipeline actually highlights Mn-activated calcite zones IN REAL TIME (not just at end-of-run narration), and confirm the Fe-quenching gate is implemented in the engine (not just documented in the data-file description). Quick smoke test: run carbonate scenario in Creative Mode, manually bump Mn via a debug action, toggle UV view, see if any canvas/inventory treatment changes. If the realtime UV view doesn't exist or quenching isn't respected, those become engine prerequisites for Tutorial 2 — separate scope.
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
