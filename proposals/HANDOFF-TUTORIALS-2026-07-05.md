# HANDOFF — The Tutorial Arc (engine v2 → v3, four tutorials, a new scenario)

**Sessions:** 2026-07-04 (Grand Tour rework, `7fd32d7`) + 2026-07-05 (Tutorial 4
Collecting + engine v3 + shigar_pegmatite, `4d8feb7`, SIM 216). Both Pages-verified
built==HEAD, both cold-ci stamped GREEN. This arc is orthogonal to the FOUNDATIONS /
ontogeny roadmap (`HANDOFF-FOUNDATIONS-2026-07-03.md` stays the roadmap handoff); it
touches the tutorial/UI layer and adds one scenario, no ontogeny/kernel code.

Boss framing across the two sessions: *"the game has expanded so much I think we really
need to update it… start out by explaining all the different parts of the screen going
top down"* → then *"we need a tutorial on collecting too… rather than being a creative
mode style tutorial this one covers simulation mode, the library, and saving,"* on a
mineral that had no scenario yet.

---

## What shipped

**Four guided tutorials in the Begin menu**, in order:
1. **The Grand Tour** (`tutorial_first_crystal`, fortress, 34 steps) — a top-down walk of
   the whole screen (title → 5 quick-nav doors → Wall Profile viewers ending on the
   helicoid manifold → σ nucleating/dormant readout, ending with the player unchecking
   dormant → action panel → log → inventory → tap-a-crystal → the original quartz
   growth/cooling arc). Broth/events unchanged, no SIM bump.
2. **A Mn-Doped Calcite** (`tutorial_mn_calcite`, fortress, 7 steps) — legacy sim-step
   script; UV activator/quencher lesson. Untouched by this arc except the free Finish
   button + skip.
3. **How CO₂ Builds a Calcite Crust** (`tutorial_travertine`, fortress) — legacy sim-step;
   its overlay script existed for months but had NO guided button until 7fd32d7 wired one.
4. **Collecting** (`shigar_pegmatite`, **legends mode**, 18 steps) — grow a Shigar
   aquamarine pocket in Simulation mode → 💎 collect one (persists to localStorage) →
   cross into the Library alive → find it on its species card.

**shigar_pegmatite scenario** (SIM 216, `js/70w-shigar.ts`) — the beryl family's first
`expects_species` coverage; also Tutorial 4's stage. Seed-42 = 21 crystals / 6 species
(the exact declaration), 0/37 cascade drift. Full provenance in the commit + the v216
history block.

---

## Engine v3 — the load-bearing reference (`js/70a-tutorial-overlay.ts`)

The full schema lives in that file's header comment; read it before authoring. Summary:

**Three step trigger types** (classified by `_tutStepTrigger`):
- `step: N` — SIM-STEP (fortress: `fortressSim.step`; legends: the narrative
  PLAYBACK position `_legendsPlaybackStep`). Consecutive due steps fire as a burst; only
  the last one's callout stays.
- `action: {event, selector, checked?}` — waits for the player to DO a thing. `event` ∈
  `click`/`change`/`input`. Matched via `closest(selector)`. Optional `checked` for
  checkbox state (e.g. dormant must be UNchecked).
- neither — CONTINUE: Continue button / Enter / Space.

**Per-step optional:** `anchor`, `side`, `text`, `hint`, `buttonLabel`, `unlock:[]`
(progressive `.tutorial-allow`), `spotlight` (un-dims `#mode-toggle`), `allowModes:[]`
(mode switches this step sanctions).

**Tutorial-level optional:** `unlock:[]` (starting whitelist, defaults `['#f-advance']`),
`mode:'legends'` (boot Simulation + preset the setup row), `preset:{scenario,seed,steps}`.

**The three v3 mechanisms (why they exist):**
1. **Legends mode.** v2 was fortress-only. `mode:'legends'` boots Simulation, presets
   `#scenario`/`#seed`/`#steps`, and the player presses Grow themselves. Legends runs the
   whole sim up front then paces the story — so `step:N` triggers fire off
   `_legendsPlaybackStep` (written from `displayLines` in js/91, per-header + on
   completion), NOT the sim's final step. Guarded: the js/91 tick only calls
   `_maybeAdvanceTutorial` when `_tutorialState.mode==='legends'`, so fortress tutorials
   (whose `fortressSim.step` is already final during pacing) don't burst at the first line.
2. **Cross-mode survival.** `_tutorialAllowsMode(mode)` (js/70a) is consulted by
   `switchMode` (js/94) and `showTitleScreen`/goHome before teardown. A switch to the
   tutorial's home mode or a current-step `allowModes` entry KEEPS the tutorial alive —
   this is how Collecting walks Simulation → Library. Home always ends it. With no
   tutorial running it's the legacy no-op path.
3. **Capture-phase action listeners + deferred advance.** THE BUG that cost this session
   an hour: the collect button re-renders the inventory synchronously, DETACHING the
   clicked node mid-dispatch — a bubble-phase listener never saw it, so the step hung
   after the crystal saved. Fix: listen on CAPTURE (records the match before any detach)
   and defer `_tutorialAdvance` one tick via setTimeout(0) so the game handler still runs
   FIRST (creates `#helix-legend` before the ⌇ step anchors to it; saves+re-renders
   before the collect step advances). All five action shapes verified: toggle-click,
   checkbox-change, re-rendering collect-click, search-input, mode-switch.

**Other v2/v3 facts:** missing anchor falls back `#topo-panel` → body (a bad selector
never stalls the machine invisibly). Control-locking is visible-but-inert (opacity .25,
grayscale, pointer-events none), not display:none — a newcomer SEES the panel before
earning it. The final step of ANY tutorial gets a Finish button (legacy sim-step
tutorials used to linger until Home).

---

## Traps (things that will bite the next author)

- **Native `prompt()` hangs headless preview.** The collect-naming flow calls
  `window.prompt`. Driving Tutorial 4 in preview, override `window.prompt/alert/confirm`
  BEFORE the collect click or every subsequent `preview_eval` times out on the blocked
  dialog. (Real users are fine.)
- **The v116 full-picker guard.** `tests-js/scenario-menu-coverage.test.ts` requires
  `startScenarioInCreative('<id>')` for EVERY scenario incl. tutorials in the Scenarios
  picker; guided `startTutorial` buttons live in the Begin menu ONLY. First Grand-Tour
  attempt used startTutorial in the picker and the guard correctly refused.
- **Fortress boots tutorials with `rng = SeededRandom(Date.now())` — NON-deterministic.**
  Author fortress action-steps that depend on growth (e.g. "tap your crystal card") with
  a keep-advancing fallback hint. (Legends tutorials preset a seed, so they ARE
  deterministic — that's why Tutorial 4 pins seed 42.)
- **Don't butt a continue/action step directly after a `step:N` step** — the trailing
  step's callout supersedes the fired one immediately (documented in the engine).
- **Legends narration has its OWN continue-pill** at the prologue/epilogue boundaries
  (a focused role=button div). `_tutorialKeydown` ignores keypresses targeting it, but
  don't author a continue-trigger tutorial step to sit on screen while a pill is armed.
- **shigar cascade discipline:** Be=8 / B=5 / F=18 start BELOW their hard ingredient
  floors (10/6/20) on purpose — dormant, lifted across by their events. Stage 4 re-floors
  Fe at 12 against schorl's appetite. Touch these and re-check the variety fences in
  js/39-supersat-silicate.ts.

---

## Open / not done

- **Tutorials 2 + 3 are still pure sim-step fortress scripts.** They'd read better with
  v2/v3 action beats (make the player push the pH, uncheck a filter). Low priority —
  they work.
- **shigar aquamarine visuals unverified by eye.** Preview never engaged WebGL this arc;
  the 3D model, the etch textures, and the smoky-quartz dose were confirmed by STATE +
  the strip archive, not a screenshot. Worth a Edge look (feedback:
  `preview_screenshot_timeout` — the vugg page times out screenshots while evals stay
  instant).
- **No fifth tutorial.** Natural candidates the four don't cover: the Record Player
  (turntable), Strip View as an instrument, twins, the deformation/movements systems.
- **Long-term:** the three menu surfaces should auto-generate from `SCENARIOS` with a
  `tutorial:true` flag (documented in vugg-add-scenario §10.5's TODO) — would retire the
  manual-sync guard entirely.

---

## The mark — what this arc adds

**The tutorial is the part of the game that ages fastest.** Every feature shipped since
the last tutorial rewrite makes the old tutorial more of a lie — it kept teaching "press
Advance on a quartz" while the game grew 180 species, eight modes, a helicoid, a Library,
a collection. A tutorial is not documentation you write once; it is a promise about what
the screen currently is, and it decays the moment the screen changes. Re-walk it whenever
the interface it describes has moved.

**Teach on the real thing, not a throwaway.** Tutorial 4 could have run on a
`tutorial_collecting` broth built to be convenient. It runs on the real Shigar pocket —
cited fluid framework, correct host geology, the actual etch mechanism — because the
science IS the stage, and a newcomer's first collected crystal should be a real place.
The tutorial and the scenario paid for each other: the scenario gave the tutorial
something worth keeping; the tutorial gave the scenario its most-run path.

**Build the mechanism, not a picture of it** (borrowed from the third hand, still true).
Engine v3's cross-mode survival is one predicate (`_tutorialAllowsMode`) consulted at the
one teardown site, not a special case bolted onto Tutorial 4. The capture-phase fix is
general — it made collect work AND hardened every future re-rendering action step. Ship
the smallest true version of the mechanism and the next tutorial is cheaper.

**The dream.** Four tutorials in, the shape of the real one is visible: a tutorial that
notices what you haven't done yet and offers the lesson when you reach for it — not a
linear tour you sit through once, but the game teaching itself in the margins as the
player wanders. Engine v3 already carries the parts (action triggers that watch for a
gesture, mode-aware state that survives navigation). The dream is that the last tutorial
we hand-author is the one that makes hand-authoring the rest unnecessary: the game grows
a new mode, and the mode arrives already able to explain itself.

Re-walk the tour when the screen moves, teach on real rock, and keep the mechanism
smaller than the feature it enables.

— the builder, fourth hand, the tutorial arc · 2026-07-05
