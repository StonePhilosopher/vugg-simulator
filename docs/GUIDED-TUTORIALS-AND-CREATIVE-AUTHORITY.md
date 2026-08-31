# Guided tutorials and Creative controls — current executable authority

This is the current map of the teaching surface. Historical proposals and
handoffs explain how it evolved; when they disagree with this page or the
runtime, this page points to the executable authority that wins.

## Player entry and the five lessons

Guided tutorials live at the top of **Begin / New Game**, not in the Scenarios
picker and not in a separate game mode. `data/scenarios.json5` owns the
`menu_layout.begin_tutorials` order and the tutorial scripts:

1. **The Grand Tour** — `tutorial_first_crystal`, Creative/fortress. Its
   top-down interface tour includes the six-door quick-nav bar and the real
   Saves contract: rolling autosave, named manual copies, geological replay,
   and tutorial UI that intentionally does not resurrect on load.
   Breadcrumb: the complete scenario hash authenticates authored/evidence
   bytes, while `scenarioReplaySpecHash` excludes only description, notes, and
   tutorial presentation so those corrections do not invalidate unchanged
   geology in `js/93a-ui-saves.ts`.
2. **A Mn-Doped Calcite** — `tutorial_mn_calcite`, Creative/fortress.
3. **How CO₂ Builds a Calcite Crust** — `tutorial_travertine`,
   Creative/fortress.
4. **Collecting** — `shigar_pegmatite`, Simulation/legends seed 42; the
   executed lesson collects topaz and visits it in the Library. Aquamarine is
   geologically permitted at Shigar but is not fabricated when that run grows
   no beryl.
5. **Reading a Crystal** — `tn457_barite_pulses`, Simulation/legends seed 42;
   the lesson opens the commissioned Record Player/Strip View record.

The tutorials are overlays on real Creative or Simulation runs. A lesson owns
its exact run, action targets, callouts, listeners, and temporary control locks.
Reset, New Game, Home, Skip, completion, or a replacement run tears those
surfaces down. The geological save is deliberately separate: loading an
autosave restores the authenticated run recipe and state, but does **not**
resurrect tutorial progress or UI locks.

## Creative authority

Creative exposes **48 canonical chemistry levers** in both setup and live broth
editing. `CREATIVE_CHEMISTRY_CONTROLS` in `js/97-ui-fortress.ts` is the registry;
`tests-js/creative-controls.test.ts` requires its 48 entries to equal every
authored non-metadata fluid coordinate, verifies setup/live round trips, and
requires provenance, coupling, a production consumer, and a causal gameplay
probe for every lever. Boundary-authority toggles and geological action buttons
are separate controls; they are not padded into the chemistry count.

## Choose-your-own-adventure map

- **Author or reorder a lesson:** `data/scenarios.json5` →
  `js/70a-tutorial-overlay.ts` → generated Begin menu in `js/94-ui-menu.ts`.
- **Change run ownership or teardown:** `js/70a-tutorial-overlay.ts` → async
  constructors in `js/94-ui-menu.ts`, `js/97-ui-fortress.ts`, and Simulation
  launch code → `tests-js/tutorial-guidance.test.ts`.
- **Change an action that advances prose:** product receipt at the owning UI
  (`js/97-ui-fortress.ts`, `js/99i-renderer-three.ts`,
  `js/99j-helix-overlay.ts`, Library/Strip handlers) → exact matcher in
  `js/70a-tutorial-overlay.ts` → controlled witness in
  `tools/gen-mechanism-witnesses.mjs`.
- **Change a chemistry lever:** `CREATIVE_CHEMISTRY_CONTROLS` →
  `FluidChemistry` and its production supersaturation/growth consumer →
  `tests-js/creative-controls.test.ts`.
- **Change the player journey:** `tools/browser-workflow.mjs` drives only public
  controls through a complete Creative lesson, a complete Simulation lesson,
  pause, Skip, completion teardown, and the save/load policy. Its durable
  receipt is exact-executable evidence, explicitly scoped as a local owned-
  browser result rather than independent attestation.

## Evidence boundary

Unit tests prove hostile branches and exact product schemas. The mechanism
witness executes controlled product paths and rejects self-rehashed forgeries.
The owned-browser journey proves that a player can traverse the public UI; it
must not call `_tutorialAdvance()` or other internal progression helpers as a
substitute for clicks, keys, prompts, and committed product events.
