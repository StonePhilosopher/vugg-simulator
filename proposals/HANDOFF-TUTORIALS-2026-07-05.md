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

---

# CONTINUATION — the parity pass (2026-07-07, `78e2b0e` + `223a96b`)

The OPEN list above, worked. Boss ask: take the Grand Tour / Collecting rework and
apply it to the neglected tutorials. Two commits, both cold-ci gated, no SIM bump.

## What closed

- **Engine v3.1 — pause-not-supersede** (`js/70a`). Phase-0 reading of the machine
  before authoring found the "don't butt" trap is worse than documented: a fired
  sim-step whose successor is action/continue was superseded BEFORE FIRST PAINT
  (the rAF `renderedIdx` guard), so the narration was invisible, not brief. Both
  reworked tutorials shipped violating it — T1's step:9 temperature beat and T4's
  step:70 pocket-is-quiet beat never displayed. Now the machine REWINDS onto the
  fired narration (`pausedAt`) and renders it as a pseudo-continue (Continue ⏎ /
  Enter / Space); the prompt arrives after the acknowledge. `_tutCurrentTrigger()`
  centralizes the paused→continue reading. Authors may freely follow narration
  with an action now — the trap section below is amended.
- **A second engine bug found by driving, not reading:** the deliberately-lingering
  Begin ⏎ callout (successor sim-step not yet due) kept a LIVE button — a double
  click silently skipped the waiting beat. Consumed buttons now disable
  (`.tutorial-callout-btn:disabled`).
- **Tutorial 2 → 13 steps.** Framing continues → Begin ⏎ handoff (progressive
  unlock) → the Mn-pulse/Fe-drop arc → tap-your-card action → **the zone modal's
  "Under UV" bar as the payoff instrument** (dim quenched early zones, bright rim)
  → Franklin beat → whole-panel finale. Broth/events byte-identical.
- **Tutorial 3 → 14 steps.** σ-forecast framing → pulse beats re-anchored on
  `#f-stat-ph`/`#f-sat-bar` → **the INVERSE EXPERIMENT**: the 🧪 acid verbs unlock
  and the player runs the cascade backwards (measured in the drive: one Shift ↓pH,
  pH 8.0→6.0, σ(calcite) 23.19→0.08 — the cave-dissolution lesson performed, not
  narrated). Broth/events byte-identical, but the TEXT was re-trued: the old
  script's "Ca 200 / calcite isn't growing yet" predates the Ca 200→350
  recalibration; the measured run starts marginal (σ 1.61, a trickle by step 2)
  and pulse 1 MULTIPLIES σ 1.34→5.04 — the narration now teaches the
  multiplication, which is also the truer Mammoth story.
- **tools/tutorial-lint.mjs** (passive): JSONC-faithful parse, sim-step
  monotonicity, static-anchor existence, the `//`-inside-strings trap, checked:
  event compatibility; prints each script's trigger sequence + pause junctions.
- **The eye-check the OPEN list asked for ran, and it found the thing**
  (`223a96b`): kernel truth showed ZERO aquamarine meshes in the shigar scene
  while the inventory held all 4 declared aquas — dissolved:true (the HF etch),
  0.13-0.6 mm net. The Q4 renderer gate treated LOST-SOME-MATERIAL as GONE, and
  ran before the replay-history branch, so the pocket's titular gemstones never
  rendered at any playback step. Fixed (one predicate, three sites: signature /
  mesh loop / `_o2PlaceBody`): only effectively-gone remnants (`renderC ≤ 0.05`)
  drop, judged on the size rendered THIS FRAME. Verified: 18 ferrous-blue
  aquamarine meshes, enclosed guests riding the O4a inclusion path; elmwood
  control unchanged. **Plus the sibling find:** Tutorial 2's UV payoff exposed
  the calcite quench gate reading BROTH-scale ppm against ZONE-scale traces
  (partition ~0.08×) — no calcite ever quenched since the bar shipped.
  Recalibrated (`Fe < 0.4`, zone-scale); the tutorial is the calibration anchor.

## Traps — amendments to the section above

- ~~"Don't butt a continue/action step directly after a `step:N` step"~~ —
  RETIRED by v3.1: the fired narration pauses as a pseudo-continue. Cost: one
  Continue press between narration and prompt.
- **No `//` anywhere in tutorial text/hints** — the runtime JSONC strip eats from
  `//` to end-of-line EVEN INSIDE STRINGS. `tutorial-lint` errors on it.
- **The fortress paces its log at narrative tempo** (~2 s/step at 1×); driving
  tutorials headless, call `topoReplaySpeed(10)` first or every Advance click
  after the first is swallowed by the pacing lock.
- **Verify claims against the LIVE run, not the scenario notes** — two of the
  three tutorials' physics narrations had drifted from their own broths (T3's
  σ-story, T2's UV-bar story). The probe replaces the hypothesis here too.
- **After ANY direct index.html edit, run `npm run build` even if no module
  changed** — the edit path can leave the worktree file CRLF; `git status`
  reads clean (autocrlf hides it) but `build:check` compares raw bytes →
  cold-ci RED with `diff length ≈ the file's line count` (~80k). The builder
  is also the normalizer. A diff length suspiciously close to the line count
  = line endings, not content. (Root-cause option for a future pass:
  .gitattributes `eol=lf` pinning — deferred, mass-renormalization noise.)

## Open (updated)

- **Fifth tutorial ✅ SHIPPED** (`b6f55db`) — "Reading a Crystal", 18 steps,
  legends, rides `tn457_barite_pulses` @ seed 42 (the boss's own specimen
  lineage as the teaching rock — the shigar move repeated). Grow → 📀 Record
  Player walk (platter pick = the 103-zone star barite the probe measured;
  drop the needle; the Mn lane IS the pink banding) → 📼 Strip View walk
  (open the auto-recorded flight dataset; ▶ Sonify gets its first
  player-facing mention) → the five-tutorial closing: GROW, KEEP, READ.
  Beat numbers are measured facts of the probed seed-42 run.
- **Menu auto-generation §10.5 — tranche 1 of 3 ✅ SHIPPED** (`6b6e719`):
  the #scenario quick-play dropdown auto-generates from SCENARIOS at
  load-complete (`_populateScenarioDropdowns`, js/94; called from
  `_loadScenariosJSON5`, js/70-events) — the surface whose hand-written
  options were already raw ids, so zero curation lost. Guard test flipped:
  the static select must ship EMPTY (single source of truth) + the
  populator's existence/exclusion/call-site are asserted against source.
  REMAINING (tranches 2-3): the Scenarios picker buttons (50, curated
  prose, GROUPED under Real-locality / Test / Tutorial-broth subheadings),
  the zen #idle-scenario dropdown (curated short names like "MVT
  (Tri-State)"), and the Begin tutorial buttons (now 6 incl. Tutorial 5,
  curated) — all need a menu.group/menu.label data migration (~90 curated
  strings from index.html into scenarios.json5) before they can derive.
  Design sized 2026-07-07; do it as its own pass.
- **NEW — UV palette scale audit** (backlog): the other zoneFluorescence gates
  (ruby Fe<10, apophyllite, willemite, …) are still broth-scale numbers checked
  against zone-scale traces; audit each against the partition. Sibling:
  `predict_fluorescence()` (js/27) has the same disease (its avg_Fe>10 quench
  branch is unreachable) but feeds narrators → baselines — SIM-adjacent,
  instruments-first, own arc.
- **NEW — shigar aquamarine size** (vugg-tune-scenario, pinned census → SIM
  bump): the renderer now tells the truth — the etch leaves 0.13-0.6 mm of
  beryl in the world's-finest-aquamarine pocket. Whether the sim should GROW
  bigger aquas (or etch less) is a calibration question the boss should weigh.

## The mark

**Drive the tutorial before you trust it.** Every defect this pass found — the
never-painted narrations, the double-click skip, the uniformly-glowing UV bar,
the invisible aquamarines, the σ-story drift — was invisible in the source and
obvious in the drive. A tutorial is a claim about what the screen does; the only
verification instrument that counts is the screen doing it. The lint catches the
structural class; the drive catches the truth class; keep both.

**The tutorial is a calibration anchor, not just a lesson.** Twice this pass, the
tutorial's designed story was the thing that exposed a mis-scaled consumer (the
UV quench gate) or a drifted broth (the travertine σ-story). A tutorial that
promises "you will SEE X" is a standing assertion wired to real numbers — the
cheapest regression instrument the game has, because a player runs it every day.

**The dream, continued.** The fourth hand dreamed tutorials that notice what you
haven't done yet. This pass adds the complement: tutorials the ENGINE notices —
scripts whose claims are machine-checkable against a measured run (σ values,
mesh counts, UV segment boundaries), so the nightly sweep tells us when the sim
drifts out from under a lesson before any player does. tutorial-lint checks the
skeleton today; the dream is a drive-lint that checks the promises.

— the builder, fifth hand, the parity pass · 2026-07-07
