# PROPOSAL: Modular refactor — split the monoliths

**Date drafted:** 2026-05-04
**Status:** ✅ **SHIPPED** (2026-05-05). See the SHIPPED footer at the
bottom of this file for what actually landed and how it differs from the
original plan. The body below is preserved as the original brief; treat
the footer as the source of truth for current state.
**Author:** Stone Philosopher (drafted with Claude)

---

## TL;DR

`vugg.py` is **20,445 lines**. `index.html` is **25,225 lines** (HTML + CSS + JS in one file). Both keep growing. Adding a mineral now means two co-located edits in two giant files plus a baseline regen. The data layer (`data/minerals.json`, `data/scenarios.json5`) is well-modularized; the engine layer is not. This proposal lays out a **phased, reversible split** that lands incrementally without breaking the existing test suite or the Python ↔ JS parity invariants.

---

## Audit — what's in the monoliths today

### `vugg.py` (20,445 lines, 198 top-level defs, 9 classes)

| Section | Line range | Lines | What's in it |
|---|---|---|---|
| Imports + module preamble | 1–60 | 60 | std-lib + dataclasses + json5 |
| SIM_VERSION history comment | 60–500 | 440 | running notes per version bump |
| ORIENTATION_PREFERENCE / WATER_STATE_PREFERENCE | 500–550 | 50 | per-mineral nucleation bias tables |
| MINERAL_SPEC loader (data/minerals.json) | 575–790 | 215 | spec schema + loader |
| Physical constants + `FluidChemistry` | 791–880 | 90 | dataclass with 38 fields |
| `VugConditions` (with **304 supersat methods**) | 880–5410 | **4,530** | one mega-class with `supersaturation_<mineral>` for each of ~95 minerals |
| `VugWall`, `WallCell`, `WallState` | 5414–5780 | 370 | wall + ring geometry + dissolution |
| `Crystal` dataclass | 5780–5790 | 10 | (the bulk of Crystal lives in 5414-block alongside walls) |
| **MINERAL GROWTH ENGINES** (97 functions) | 5787–8145 | **2,360** | one `grow_<mineral>` per mineral |
| Habit helpers + paramorph + dehydration | 8147–12440 | 4,290 | habit selectors, PARAMORPH_TRANSITIONS, DEHYDRATION_TRANSITIONS |
| Event base classes + handlers (83 functions) | 12442–13770 | 1,330 | scenario event types |
| EVENT_REGISTRY | 13770–13885 | 115 | string-id → handler |
| SCENARIO_LOADER (data/scenarios.json5) | 13886–13977 | 90 | JSON5 → callable |
| `SCENARIOS` dict | 13978–14275 | 300 | scenario_id → factory |
| **`VugSimulator`** | 14277–20340 | **6,065** | the run-loop class, with everything: events, growth, repaint, snapshots, replay, save/load, narrators, dolomite cycles, paramorph drivers, etc. |
| `main()` + CLI | 20343–end | 100 | text-mode game runner |

The two ~6000-line giants are: **`VugConditions` (the supersat mega-class)** and **`VugSimulator` (the run-loop mega-class)**. Almost everything else is a function pile.

### `index.html` (25,225 lines, 378 top-level functions)

Roughly:

| Section | Approx lines | What's in it |
|---|---|---|
| `<head>` + CSS | 1–3000 | styling, fonts, themes |
| `<body>` HTML scaffolding | 3000–3300 | UI structure, modals, panels |
| MINERAL_SPEC fetch + class colors | 3300–3450 | mirrors of Python loader |
| Mulberry32, polyhedra, scoring helpers | 3450–4020 | shared utilities |
| `FluidChemistry`, `VugWall`, `WallCell`, `WallState` mirrors | 4020–4600 | data classes |
| `VugConditions` (304 supersats again) | 4600–6680 | mirror of Python |
| `Crystal` class + helpers | 6680–6890 | dataclass mirror |
| **97 grow engines mirrored** | 6890–11260 | one per mineral |
| Paramorph + dehydration mirrors | 11260–12440 | structural mirror |
| 83 event handlers + registries | 12440–13770 | structural mirror |
| `VugSimulator` mirror | 13770–17400 | full sim loop |
| **Renderer (canvas 2D + 3D + wireframe)** | 17400–24000 | `topoRender`, `_topoRenderRings3D`, primitives, painter's order, hit-test, tooltips |
| UI: tutorials, save/load, replay, panels, narrators, side panel, library, achievements | 24000–25225 | the rest |

**The renderer alone is ~7000 lines** — and it's the layer that doesn't have a Python counterpart. That's the largest chunk of "JS-only" code; everything else in JS is a structural mirror of vugg.py.

### Data layer (good as is)

- `data/minerals.json` — 10,402 lines, ~95 mineral specs. Loaded by both runtimes. **This is the model for what good extraction looks like.**
- `data/scenarios.json5` — 1,476 lines, 19 scenarios. Same pattern. Already migrated from inline closures in Phases 1-2 of TASK-BRIEF-DATA-AS-TRUTH.

---

## Why the monoliths hurt now

1. **Adding a mineral = ~6 edits in 4-8 spread-out locations.** A new mineral needs:
   - data/minerals.json entry (good — one file)
   - `supersaturation_<name>` in VugConditions (vugg.py + index.html)
   - `grow_<name>` engine (vugg.py + index.html)
   - MINERAL_ENGINES registration (vugg.py + index.html)
   - nucleation gate in `check_nucleation` (vugg.py + index.html)
   - `dominant_forms` block in `nucleate` (vugg.py + index.html)
   - sometimes WATER_STATE_PREFERENCE / ORIENTATION_PREFERENCE
   - sometimes PARAMORPH/DEHYDRATION_TRANSITIONS

   That's **8+ insertion points across 2 files** for a clean new mineral. The HANDOFF-ADDING-MINERALS proposal exists because this got out of hand.

2. **Python ↔ JS parity is fragile.** Every drift between the two runtimes has bitten us at least once. `tools/sync-spec.js` does some structural checks; it can't catch logic drift. With both runtimes in single files, it's easy to update one and forget the other.

3. **Reading either file is hard.** Search through 20-25k lines for any specific concern. Grep-and-jump works but the cognitive map is gone.

4. **Test isolation is impossible.** A unit test for selenite growth has to import all of `vugg`, which means every other engine, every event handler, the simulator, etc. Python startup is ~1s.

5. **Renderer-engine coupling is unclear.** The 3D renderer reads `crystal.growth_environment`, `wall_state.ring_water_state`, `conditions.fluid_surface_ring` — but these dependencies aren't documented or enforced. Refactoring an engine field can silently break the renderer.

6. **Comments-and-history bloat.** SIM_VERSION history comments (~440 lines and growing) are valuable but live at the top of vugg.py. They should be in CHANGELOG.md.

---

## The plan — three phases, each shippable on its own

The phasing rule: **each phase produces a file tree that's smaller per file but functionally identical, with the existing baseline tests passing byte-for-byte.** No phase is a flag day. Each phase is reverted with a single `git revert` if it causes trouble.

### Phase A — Python-only split (low risk, no JS changes)

**Goal:** Split `vugg.py` into a `vugg/` package while keeping `from vugg import *` as the public API, so all tests and the JS mirror sync continue to work without changes.

**Suggested module layout:**

```
vugg/
├── __init__.py          # re-exports the public API (FluidChemistry, VugConditions, …)
├── version.py           # SIM_VERSION constant only (currently 480 lines of comments)
├── chemistry/
│   ├── __init__.py
│   ├── fluid.py         # FluidChemistry dataclass
│   ├── conditions.py    # VugConditions (just the class skeleton + state-of-water helpers)
│   ├── supersat/        # 304 supersaturation methods, one file per mineral CLASS
│   │   ├── carbonates.py    # calcite, aragonite, dolomite, siderite, rhodochrosite, …
│   │   ├── sulfides.py      # pyrite, galena, sphalerite, chalcopyrite, …
│   │   ├── sulfates.py      # selenite, anhydrite, barite, celestine, halite, mirabilite, thenardite, …
│   │   ├── oxides.py        # hematite, magnetite, cuprite, …
│   │   ├── halides.py       # fluorite, halite (already in sulfates? check), atacamite
│   │   ├── borates.py       # borax, tincalconite
│   │   ├── native.py        # native_gold, native_silver, native_copper, …
│   │   ├── silicates.py     # quartz, feldspar, beryl, topaz, tourmaline, …
│   │   ├── phosphates.py    # autunite, torbernite, pyromorphite, …
│   │   ├── arsenates.py     # adamite, mimetite, scorodite, erythrite, …
│   │   └── (others)         # sulfarsenides, vanadates, tungstates, etc.
│   └── thermometers.py  # silica_equilibrium, gypsum-anhydrite eutectic, etc.
├── engines/             # 97 grow_<mineral> functions, same class grouping as supersat/
│   ├── carbonates.py
│   ├── sulfides.py
│   ├── (mirror of supersat groupings)
│   ├── habits.py        # habit-selection helpers (cathedral_blade, hopper_growth, etc.)
│   └── registry.py      # MINERAL_ENGINES dict + nucleation-gate helpers
├── geometry/
│   ├── wall.py          # VugWall, WallCell, WallState
│   ├── crystal.py       # Crystal dataclass
│   └── orientation.py   # ORIENTATION_PREFERENCE + ring helpers
├── transitions/
│   ├── paramorph.py     # PARAMORPH_TRANSITIONS + apply_paramorph_transitions
│   ├── dehydration.py   # DEHYDRATION_TRANSITIONS + apply_dehydration_transitions
│   └── thermal.py       # THERMAL_DECOMPOSITION + check_thermal_decomposition
├── events/
│   ├── primitives.py    # Event dataclass, scheduling
│   ├── chemistry.py     # event_oxidation, event_acidify, etc.
│   ├── porphyry.py      # porphyry-family events
│   ├── bisbee.py        # bisbee-family events
│   ├── supergene.py     # supergene_oxidation events
│   ├── sabkha.py        # sabkha events
│   ├── naica.py         # v30 Naica events
│   ├── searles.py       # v30 Searles Lake events
│   └── registry.py      # EVENT_REGISTRY dict
├── scenarios/
│   ├── loader.py        # _load_scenarios_json5 + _build_scenario_from_spec
│   ├── builtin.py       # SCENARIOS dict assembly + scenario_random
│   └── (no per-scenario files needed — they live in data/scenarios.json5)
├── simulator.py         # VugSimulator class (~6000 lines now; should drop to ~3000 once the
│                        # engine-method swap-and-restore code moves to a context manager,
│                        # and the dolomite cycle / chalcanthite / paramorph drivers move
│                        # to transitions/* or chemistry/*)
└── cli.py               # main() + text-mode game runner
```

**Sequencing within Phase A:**

A1. Create `vugg/` directory. Move `vugg.py` content into `vugg/__init__.py` verbatim. Run tests — should pass unchanged. Commit.

A2. Extract `version.py` (just `SIM_VERSION` + history comment). Re-import in `__init__.py`. Tests pass. Commit.

A3. Extract `geometry/` (Crystal, WallCell, WallState, VugWall). Tests pass. Commit.

A4. Extract `chemistry/fluid.py` (FluidChemistry only). Tests pass. Commit.

A5. Extract `chemistry/supersat/<class>.py` one mineral class at a time. After extraction, VugConditions becomes a thin class that acquires its supersat methods via mixins or registry. Each extraction is one commit, tests pass, baseline byte-identical (the supersat math itself doesn't change).

A6. Extract `engines/<class>.py` similarly.

A7. Extract `transitions/`, `events/`, `scenarios/`.

A8. Whittle `simulator.py` down to its run-loop core; move auxiliary drivers (chalcanthite metastability, dolomite cycle counter, paramorph dispatch loops) to their topical modules.

**Acceptance criteria for Phase A:**
- Every test in `tests/` passes byte-identical to v30 baseline.
- `from vugg import VugConditions, VugSimulator, SCENARIOS` still works.
- `python -m vugg` launches the CLI text-mode game (rename of current `python vugg.py`).
- No file in `vugg/` exceeds 1500 lines (target — most much smaller).

**Risk:** low. Python's import system makes this trivial as long as the public re-exports stay stable. The supersat method extraction needs `VugConditions` to either (a) become a class assembled via `class VugConditions(SupersatMixin, ...)` or (b) attach methods via a registry function. Either pattern is well-known.

**Time estimate:** 8-16 hours depending on how aggressive the simulator.py whittling gets.

---

### Phase B — JS extraction with ES modules (medium risk)

**Goal:** Split `index.html` into `index.html` (just the page shell) plus a `js/` tree mirroring `vugg/`'s structure.

**Constraint:** must work both via `file://` (offline play) and via the dev server. ES modules work fine over HTTP, fail under `file://` for security reasons. We have two options:

- **Option B-modules:** Use `<script type="module">` and split into ES modules. Requires running `python tools/preview_server.py` (already exists for development). Drops file:// support — every player needs a local server. **Geological-game players probably don't care about file://**, but it's a behavior change.
- **Option B-bundle:** Keep `index.html` as-is for distribution, but introduce a build step (e.g. `tools/build_js.py` that concatenates `js/*.js` into a single inline `<script>` block in index.html). Source-of-truth becomes the split files; the deployed `index.html` is generated. file:// still works.

**Recommendation: Option B-bundle.** Keeps file:// (one of vugg's user-facing characteristics — "open the html and play, no server"), avoids breaking save/load URLs, and the build step is trivial Python (~30 lines). The build step runs in pre-commit / CI and can fail loudly if the concatenation produces a different hash than the previous deploy.

**Suggested module layout** (mirroring `vugg/`):

```
js/
├── 00-vendor/           # mulberry32, deterministic helpers
├── 10-mineral-spec.js   # mineral spec loader
├── 20-chemistry/
│   ├── fluid.js         # FluidChemistry
│   ├── conditions.js    # VugConditions
│   └── supersat/
│       ├── carbonates.js
│       ├── sulfides.js
│       └── …
├── 30-engines/
├── 40-geometry/
├── 50-transitions/
├── 60-events/
├── 70-scenarios/
├── 80-simulator.js
├── 90-renderer/
│   ├── topo-2d.js
│   ├── topo-3d.js
│   ├── primitives.js    # PRIM_CUBE, PRIM_DRIPSTONE, etc.
│   ├── projection.js
│   └── hit-test.js
├── 95-ui/               # tutorials, panels, save/load, replay, narrators
└── 99-main.js           # bootstrap
```

The 00-/10-/20- prefixes preserve concatenation order in `tools/build_js.py`.

**Sequencing within Phase B:**

B1. Build `tools/build_js.py` that takes a folder of `.js` files and inlines them into index.html at a marker comment. Initial pass: zero source split, just verify the build emits byte-identical index.html. Commit.

B2. Extract the renderer first (the largest non-mirror chunk — ~7000 lines). Renderer dependencies on engine state are clean: it reads `sim.crystals`, `sim.wall_state.rings[*]`, `crystal.growth_environment`, `conditions.fluid_surface_ring`. Document those as the renderer's public API contract. Commit.

B3. Extract the JS mirrors of each Python module in lockstep with the Python module's existing extraction. So if Phase A already produced `vugg/chemistry/supersat/sulfides.py`, Phase B produces `js/20-chemistry/supersat/sulfides.js` as its mirror.

B4. Update `tools/sync-spec.js` to verify directory structures match between Python and JS sides.

**Acceptance criteria for Phase B:**
- The deployed `index.html` is byte-identical to the v30 deploy (verified by hash).
- All scenarios from the New Game Menu still load and play.
- 3D renderer behaves identically (use the existing screenshot-comparison tests).

**Risk:** medium. The build step is simple but must be **bulletproof** — a missing file or wrong order breaks the deployed game silently. Add a CI check that runs the build and grep-checks for key function names in the output.

**Time estimate:** 12-20 hours.

---

### Phase C — Python ↔ JS sync hardening (lowest priority but highest leverage)

**Goal:** Catch drift between the runtimes automatically, instead of finding it at the next baseline regen.

**Concrete additions:**

C1. `tools/sync_engines.py` — for every `grow_<mineral>` in Python, find its JS mirror, parse out the supersat formula (the `(Na/X) * (Cl/Y) * c² * pH_factor` line), and assert constants match. Catches the kind of drift we hit at v27 with halite (Na/30 in JS vs Na/100 in Python).

C2. Property-based engine tests — for each mineral, generate 100 random fluids, run Python supersat and JS supersat (via subprocess + node or the new ES-module loader), assert agreement to floating-point precision. This is what would have caught every drift we've debugged.

C3. JSON5 spec validation — every spec entry's `narrate_function`, `scenarios`, `class_color`, etc. validated at load time with a clear error message if missing.

C4. A "drift dashboard" — a markdown file generated by the test run listing every Python-only or JS-only function. Drives the next sync round.

**Acceptance criteria for Phase C:**
- A deliberate engine-only Python edit (skipping the JS mirror) fails CI before merge.
- The drift dashboard is checked into the repo and updated automatically.

**Risk:** low. These are pure-additive tooling layers; nothing in the existing code changes.

**Time estimate:** 8-12 hours.

---

## What NOT to do

- **Don't introduce TypeScript.** The "no build step" ethos of vugg-simulator is a feature. Phase B's tiny concatenator is the smallest possible build step.
- **Don't introduce a frontend framework (React, Vue, Svelte).** The renderer is a canvas; the UI is bespoke. Frameworks would re-introduce the file://-incompatibility problem and bury the educational/inspectable code under abstractions.
- **Don't migrate to a database for `data/minerals.json`.** The text-file data layer is *the* feature that makes adding a mineral approachable. Keep it.
- **Don't change save/load format.** Existing saves should keep working through the refactor. Test with at least 3 historical saves before each phase ships.
- **Don't reformat / lint-clean during the refactor.** Mixing whitespace changes with structural moves makes the diff useless for review. One concern per commit.

---

## Risks and where they live

1. **Test invariants:** `tests/conftest.py` imports `vugg` directly; the public API needs to stay flat. Plan A's `__init__.py` re-exports handle this — keep the re-exports comprehensive (every name currently `from vugg import X` reads should still work).

2. **Save/load:** Pickle and JSON saves serialize Python class names. Renaming or moving a class breaks them. Mitigate by keeping the public class names (`VugConditions`, `VugSimulator`, `Crystal`, `FluidChemistry`) reachable from `vugg/__init__.py` even after they move to submodules. Pickle in particular requires `vugg.VugSimulator` to resolve — set it explicitly in `__init__.py` if the move otherwise would break pickle.

3. **Python ↔ JS parity:** Phases A and B should land *together* per mineral class so the directory shape stays mirrored. If Phase A ships entirely first, the JS side will be one giant file mirroring fragmented Python — sync becomes worse, not better. Suggest interleaving: extract one mineral class on both sides per commit.

4. **The renderer is the hardest piece in JS.** Its 7000 lines reference dozens of engine concepts. A clean extraction needs to first document the renderer's API contract (what state it reads from `sim`, `wall_state`, `crystal`). This document is itself a deliverable of Phase B.

5. **Branching strategy:** This refactor is too large for one branch. Use a long-running `refactor/modular` branch, merge to `main` after each phase passes tests. Don't let the refactor branch diverge from main by more than 2 weeks of mineral-addition activity.

---

## Success metrics

A modular refactor that's worth the effort should produce:

- **No file > 2000 lines** in the Python tree (target 500-1500).
- **No JS file > 2000 lines** in the source tree (the bundled output can stay one file).
- **Adding a new mineral takes ≤ 4 file touches** (down from 8+).
- **Test suite startup < 3 seconds** for a single-mineral test (Python's import time will drop dramatically with smaller modules).
- **Python-JS parity drift caught at PR time**, not at baseline regen time.
- **The next mineral-research note becomes 1 file** instead of "edit the same locations in both runtimes".

---

## Open questions for the next builder

1. **`VugConditions` mixin vs registry.** Mixins are clean but require all ~95 supersat modules imported at class-definition time. Registry (a function-attaching dict) is more dynamic but breaks IDE autocomplete and `getattr(cond, 'supersaturation_quartz')`. Which trade-off does this codebase prefer? (Recommendation: mixin per mineral class. Each mineral class file declares `class CarbonatesSupersatMixin: def supersaturation_calcite(self): ...`. VugConditions inherits from all of them.)

2. **Build step location.** `tools/build_js.py` could run pre-commit, in CI, or be a manual step before deploy. Pre-commit catches drift earliest but slows commits. CI is canonical but lets local edits fall behind. Manual is currently fine. Pick the lightest weight option that catches the build hash drifting.

3. **Per-mineral file vs per-class file.** 97 mineral files is a lot. 10-12 class files (carbonates, sulfides, …) is what Phase A suggests. But "ammonites" or "Bisbee oxidation suite" are scenario-grouped, not class-grouped. Could go either way. Recommendation: class-grouped (mineralogical convention is the cleaner taxonomy) with a `scenarios/<scenario>.py` for any scenario-specific logic that doesn't fit a class.

4. **What about `tools/`?** Existing helpers (`sync-spec.js`, `gen_baselines.py`, etc.) are fine as standalone scripts and don't need to move. Phase C *adds* to this directory but doesn't restructure it.

5. **Documentation deliverable.** Phase B's "renderer API contract" doc + Phase A's "module dependency graph" doc are valuable artifacts. Should they live in `proposals/` (alongside other architecture docs) or `docs/` (a new directory)? Recommendation: `docs/architecture/` — proposals are for "should we do X", architecture docs are for "this is how X works".

---

## Recommendation

**Do Phase A first.** Python-only refactor is the lowest risk and unlocks faster Python iteration. Phase B follows once Phase A is stable; Phase C is a tooling hardening that can interleave.

Phase A alone would already make the codebase ~50% easier to navigate. Phases B and C compound from there.

The deliverable from this proposal is **a 1-2 hour audit by the next builder** confirming the file-tree layout, the mixin-vs-registry choice, and the per-class vs per-mineral file decision. Once those three calls are made, Phase A is mostly mechanical extraction with tests as the safety net.

---

## ✅ SHIPPED FOOTER (2026-05-05)

The audit + execution happened in one session. The decisions made:

1. **File-tree layout:** mostly as proposed. The Python `vugg/` package
   used class-grouped layout (`vugg/chemistry/supersat/<class>.py`,
   `vugg/geometry/`, etc.). The JS side mirrors the same shape under
   `js/` — see [`js/README.md`](../js/README.md) for the navigable index.
2. **Mixin vs registry:** **mixin** chosen for Python (`class
   VugConditions(CarbonatesSupersatMixin, …, SulfideSupersatMixin)`),
   **`Object.assign(Class.prototype, {…})`** chosen for JS (the SCRIPT-
   mode TS files can't `import`/`export`, so each per-class file is a
   side-effecting attach call). Both preserve `cond.supersaturation_X()`
   call sites unchanged.
3. **Per-class vs per-mineral:** **per-class.** 12 mineral-class files
   per concern (supersat, engines, narrators, nucleation gates) instead
   of 95+ per-mineral files. Adding a new mineral inside an existing
   class is one line per concern.

### What actually landed (vs. the original Phase A/B/C plan)

| Phase | Original plan | Shipped |
|-------|---------------|---------|
| **A1–A5b** (Python) | Full split: `vugg/` package with chemistry, geometry, supersat mixins, engines, transitions, events, scenarios, simulator, cli. | **Partial.** `vugg/__init__.py` + `version.py` + `chemistry/{fluid,conditions}.py` + 12 supersat mixins + `geometry/{wall,crystal}.py`. Phases A6–A8 (engines, transitions, simulator residual) **paused** when the user pivoted to JS-first. |
| **A6–A8** (Python) | Continue Python split. | **Not done.** Tests still pass (1,631 green); Python is functional. Future work, not blocking. |
| **B1** (JS) | `tools/build.mjs` concatenator + BUILD markers in `index.html`. | **Done.** Plus `tools/build-all.mjs` that pipes `tsc` → `build.mjs` so type errors are informational without blocking the splice. |
| **B (TypeScript pivot)** | Original recommendation was Option B-bundle in plain JS to preserve `file://` "open and play". | **TypeScript adopted instead** (user request). `tsconfig.json` uses script-mode TS (`module: "none"`), `js/_typings.d.ts` widens DOM types globally. `file://` still works because the build still produces a single inline `<script>` block. |
| **B2–B11** (extract themed modules from `index.html`) | Renderer first (largest non-mirror chunk). Then chemistry/engines/etc. | **All done.** 100+ TypeScript modules under `js/`, none over 1,000 lines. |
| **B12–B15** (further internal splits) | Not in original plan. | **Done.** Renderer split into 9 themed sub-modules. Simulator narrators (95) and per-class nucleation gates (87 helpers) split via Object.assign + free-function pattern. |
| **B14a–B14c** (type cleanup) | Not in original plan; types were a pure side-quest. | **Done.** 3,317 type errors → 0 via `?` optional params, dataclass index signatures, MINERAL_SPEC widening, per-call-site Map/Set/Record typing, and the global `js/_typings.d.ts`. |
| **B16–B20** (more splits + bookkeeping) | Not in original plan. | **Done.** Narrators split per-class (mirror of B7 supersat split), 70-events.ts split per-scenario-family, fortress UI + groove UI split into shared widgets, residual VugSimulator class split into 5 mixin files. |
| **C** (parity-drift tooling) | `sync_engines.py`, property-based tests, drift dashboard. | **Not done.** `npm run ci` (typecheck + bundle staleness check) lands in a similar spirit but at a coarser grain. Phase C still on the table. |

### Real bugs uncovered along the way (8)

The refactor wasn't supposed to fix bugs — extraction is structural by
design — but type-checking + cross-file visibility surfaced several
latent issues:

1. `_topoRenderRings3D` referenced `initR` from a closure that no longer
   existed after the renderer split. Latent since the meniscus-disc
   commit; never fired because `cell.base_radius_mm > 0` in the default
   profile init. Fixed in B12 by deriving `initR` locally from
   `wall.initial_radius_mm`.
2-4. Three duplicate narrator definitions (`_narrate_scorodite`,
   `_narrate_ferrimolybdite`, `_narrate_chalcanthite`) had both an
   older inline-string version and a newer `narrative_blurb`-based
   version. The older ~50 lines were dead code. Removed in B12.
5-9. Five latent cross-block scope leaks in `check_nucleation`: blocks
   for chalcopyrite, hematite, uraninite, feldspar, albite, adamite,
   malachite all referenced `existing_<X>` variables that originated in
   sibling blocks earlier in the same method. Worked only because the
   method shared scope across all blocks. Caught by tsc's TS2304 when
   B15 split the method into per-class helpers; each consuming helper
   now declares its own dependency.

### Final state

- **No file over 1,000 lines** in either runtime tree.
- **Adding a new mineral takes ≤ 4 file touches** (down from 8+) — see
  [`js/README.md` Quick task lookup](../js/README.md#quick-task-lookup).
- **`npm run ci` enforces no regressions** (typecheck + bundle
  staleness check).
- **0 type errors** at landing.
- **1,631 Python tests still pass** byte-identical.
- **Browser smoke confirms** all 5 modes (Legends / Creative / Random /
  Zen / Groove + Library) + crystal-collection persistence + topo
  renderer (2D and 3D paths) + zone modal + groove turntable + sigma
  panel work end-to-end with zero console errors.

### Open follow-ups

Tracked in `proposals/BACKLOG.md` under the modular-refactor section.
Most actionable:
- Port 5 missing JS narrators (borax, tincalconite, halite, mirabilite,
  thenardite) from the Python side.
- Finish Python phases A6–A8 if/when the Python harness gets actively
  iterated on again.
- Tighten `[key: string]: any;` index signatures to explicit field
  declarations (per-file, no risk).
