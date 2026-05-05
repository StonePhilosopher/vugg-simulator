# Vugg Simulator — Architecture Pointer

**This file is intentionally short.** Earlier versions tried to inventory minerals,
scenarios, modes, and code line-ranges; that content drifted faster than anyone
could maintain it (see commit history of this file). It now points at the
canonical source for each kind of fact instead.

If a section below is wrong, update the canonical source — not this file.

---

## What lives where

| Topic                          | Canonical source                                     |
|--------------------------------|------------------------------------------------------|
| Mineral spec (every field)     | `data/minerals.json`                                 |
| Locality fluid chemistry       | `data/locality_chemistry.json`                       |
| Scenarios (initial fluid + events) | `data/scenarios.json5` (loaded by both runtimes) |
| Open work / backlog            | `proposals/BACKLOG.md`                               |
| Current SIM_VERSION            | `vugg/version.py` (Python); `js/15-version.ts` (JS)  |
| Roadmap and decisions          | `proposals/BACKLOG.md` and individual `proposals/*.md` briefs |
| Build pipeline                 | "Build pipeline" section below                       |
| Module index (JS source)       | `js/README.md` — every prefix annotated, "find X by purpose" |
| Modes shown to the player      | the title screen — open `index.html` and look       |

---

## Three runtimes, on purpose

The simulation engine is implemented three times:

- **`vugg/`** — dev/test harness (Python package; was `vugg.py` before the
  PROPOSAL-MODULAR-REFACTOR Phase A1–A5b split). The builder iterates
  here first; `tests/` exercises this package (1,631 tests). Read
  `vugg/__init__.py` top-of-file docstring for the keep-or-drop decision
  and trigger conditions. Public surface unchanged: `from vugg import …`
  still works.
- **`index.html`** — the shipped product, **generated** by the build
  pipeline (see "Build pipeline" below). GitHub Pages serves repo root.
  Edit source files under `js/`, not `index.html` directly.
- **`agent-api/vugg-agent.js`** — headless CLI for AI agents. Intentionally
  simpler. Read the top-of-file comment for what "intentionally simpler"
  means and how its lag relative to the other two is policed.

Cross-runtime drift is detected by **`tools/sync-spec.js`** (run with
`node tools/sync-spec.js`). The "make these three converge" project is
tracked in `proposals/TASK-BRIEF-DATA-AS-TRUTH.md` (declarative tables in
`data/`) and the longer-term option-3 plan in the architecture review
(2026-04-29 session): cross-engine baseline tests that diff seed-42 output
between runtimes.

---

## Layout

```
vugg-simulator/
├── index.html                  # GENERATED — the shipped game
│                                  (GitHub Pages serves this; rebuild via
│                                  `npm run build`)
├── js/                         # TypeScript source — edit files here
│   ├── 00-mineral-spec.ts      # MINERAL_SPEC fallback + live-fetch
│   ├── 1x-…                    # deterministic helpers + early state
│   ├── 2x-chemistry-…          # FluidChemistry, VugConditions
│   ├── 22-geometry-wall.ts
│   ├── 27-geometry-crystal.ts
│   ├── 3x-supersat-<class>.ts  # 12 per-class supersat mixin files
│   ├── 5x-engines-<class>.ts   # 12 per-class grow_<mineral> files
│   ├── 65-mineral-engines.ts   # MINERAL_ENGINES dispatch dict
│   ├── 7x-events…              # 12 per-scenario-family event files
│   ├── 75-transitions.ts
│   ├── 78-preferences.ts
│   ├── 8x-nucleation-<class>.ts # 12 per-class nucleation gates
│   ├── 85-simulator.ts          # VugSimulator core (constructor +
│   │                              run_step + narrate)
│   ├── 85a-…85e-               # VugSimulator method mixins
│   │                              (narrators, nucleate, state, step,
│   │                              format)
│   ├── 92x-narrators-<class>.ts # 11 per-class narrator mixin files
│   ├── 9x-ui-…                 # mode UIs + shared crystal/zone widgets
│   ├── 99-…99h-renderer-…      # canvas 2D + 3D + wireframe + idle chart
│   └── _typings.d.ts           # global TS type declarations
├── tools/
│   ├── build.mjs                # concatenator: dist/**/*.js → index.html
│   ├── build-all.mjs            # tsc + build.mjs in one go
│   ├── sync-spec.js             # cross-runtime drift detector
│   ├── new-mineral.py           # scaffolding for new mineral entries
│   ├── make-thumbnails.py       # photo pipeline
│   └── ...
├── package.json                 # npm scripts (build / typecheck / ci)
├── tsconfig.json                # script-mode TS config
├── vugg/                        # dev/test harness (Python package)
│   ├── __init__.py
│   ├── version.py               # SIM_VERSION + history
│   ├── chemistry/               # FluidChemistry, VugConditions, supersat/<class>
│   ├── geometry/                # VugWall, WallCell, WallState, Crystal
│   └── …                        # remaining engines + simulator inline (Phase A6+ pending)
├── data/
│   ├── minerals.json            # canonical mineral spec
│   └── locality_chemistry.json  # per-locality fluid + audit notes
├── photos/                      # mineral photos + thumbs (served at runtime)
├── agent-api/
│   └── vugg-agent.js            # headless agent CLI
├── tests/                       # pytest suite (exercises vugg/)
├── proposals/                   # design briefs + backlog
└── research/                    # per-mineral research notes
```

---

## Build pipeline

`index.html` is **generated** from `js/**/*.ts`. The build is a tiny
TypeScript compile + concatenation, no bundler or framework.

```
npm install              # once — pulls in TypeScript as a devDependency
npm run build            # tsc + splice → updates index.html in place
npm run typecheck        # tsc --noEmit; CI guard for type regressions
npm run build:check      # exits 1 if index.html is out-of-date
npm run ci               # typecheck + build:check (combined regression guard)
```

Internals: `tools/build-all.mjs` runs `tsc -p tsconfig.json` (which emits
`dist/**/*.js`), then `tools/build.mjs` walks `dist/` in lex order,
concatenates with file-marker headers, and splices the result into
`index.html` between BUILD markers inside the inline `<script>`. The
markers (`// === BUILD:bundle:start ===` / `…end ===`) live in the HTML;
do not remove them.

**Adding a new module:** drop a `.ts` file under `js/` with a numeric
prefix that puts it in the right load order (everything is one big
script after concatenation, so file order = top-of-file load order).
Top-level `let`/`const` evaluation is order-sensitive; `function`
declarations are hoisted bundle-wide.

**Adding a new mineral** is now ≤4 file touches:
1. `data/minerals.json` (the spec)
2. `js/3x-supersat-<class>.ts` (the supersat method)
3. `js/5x-engines-<class>.ts` (the grow function)
4. `js/65-mineral-engines.ts` (the registry entry)

Plus optionally a narrator (`js/92x-narrators-<class>.ts`) and a
nucleation gate (`js/8x-nucleation-<class>.ts`) if the mineral wants
them.

### History note: web/ → root flatten (2026-04-29)

This used to be a `web/index.html` source plus a curated `docs/` mirror that
GitHub Pages served. The mirror was retired in favor of root-served Pages —
single layout, no per-commit `cp web/index.html docs/index.html` ritual.
**Pages source folder must be set to `/(root)`** for the live site to work
after this change.

---

## What goes in this file going forward

- Pointers (you are reading them).
- Cross-cutting decisions that don't fit anywhere else (e.g., the
  three-runtimes-on-purpose framing above).
- Layout maps when something non-obvious moves.

What does NOT go here:
- Mineral / scenario / mode counts. These belong to the canonical source.
- Code line-range maps. They drift in days.
- Roadmap. That's `BACKLOG.md`.
