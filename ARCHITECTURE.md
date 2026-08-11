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
| Scenarios (initial fluid + events) | `data/scenarios.json5`                          |
| Open work / backlog            | `proposals/BACKLOG.md`                               |
| Current SIM_VERSION            | `js/15-version.ts`                                   |
| Roadmap and decisions          | `proposals/BACKLOG.md` and individual `proposals/*.md` briefs |
| Cavity geometry migration      | `proposals/PROPOSAL-MARCHING-CUBES-CAVITY.md`         |
| Build pipeline                 | "Build pipeline" section below                       |
| Module index (JS source)       | `js/README.md` — every prefix annotated, "find X by purpose" |
| Modes shown to the player      | the title screen — open `index.html` and look       |

---

## Two runtimes, on purpose

The simulation engine ships in two places, both JavaScript:

- **`index.html`** — the shipped product, **generated** by the build
  pipeline (see "Build pipeline" below). GitHub Pages serves repo root.
  Edit source files under `js/`, not `index.html` directly.
- **`agent-api/vugg-agent.js`** — headless CLI for AI agents. Intentionally
  simpler. Read the top-of-file comment for what "intentionally simpler"
  means and how its lag relative to the in-browser bundle is policed.

The bundle is the source of truth for chemistry; the agent CLI mirrors
selected engines for the headless-play surface.

History: there was a third runtime — a Python `vugg/` package and
`tests/` pytest suite that the builder iterated against first, with
`tools/sync-spec.js` as the cross-runtime drift detector. The Python
side was retired (2026-05-07) once the JS test surface (`tests-js/`,
vitest) covered the same regressions; the cross-runtime drift checker
retired with it. Older clones still carry the Python tree — see git
history for `vugg/`, `tests/`, `pytest.ini`, `tools/sync-spec.js`,
`tools/supersat_drift_audit.py`, `tools/twin_rate_check.py`,
`tools/check-minerals-diff.py`, `tools/new-mineral.py`. Some legacy
JS comments still cite "mirrors X in vugg.py" — these are fossil
references and can be cleaned up incrementally; the JS itself is now
the source of truth.

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
│   ├── 23a-geometry-cavity-field.ts   # default-off Cartesian cavity field
│   ├── 23b-geometry-marching-cubes.ts # indexed shadow-surface extractor
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
│   ├── gen-js-baseline.mjs      # regenerate JS regression baselines
│   ├── make-thumbnails.py       # photo pipeline (out-of-band)
│   ├── gen-ascii-embeds.py      # photo pipeline (out-of-band)
│   ├── photo-to-ascii.py        # photo pipeline (out-of-band)
│   └── three.module.js          # vendored Three.js
├── package.json                 # npm scripts (build / typecheck / ci)
├── tsconfig.json                # script-mode TS config
├── tests-js/                    # vitest regression suite + seed-42 baselines
├── data/
│   ├── minerals.json            # canonical mineral spec
│   ├── scenarios.json5          # scenario specs (initial fluid + events)
│   └── locality_chemistry.json  # per-locality fluid + audit notes
├── photos/                      # mineral photos + thumbs (served at runtime)
├── agent-api/
│   └── vugg-agent.js            # headless agent CLI (the second runtime)
├── proposals/                   # design briefs + backlog
└── research/                    # per-mineral research notes
```

---

## Build pipeline

`index.html` is **generated** from `js/**/*.ts`. The build is a small
narrative-manifest audit/generation step, TypeScript compile, and
concatenation—no bundler or framework.

```
npm install              # once — pulls in TypeScript as a devDependency
npm run build            # narrative audit + tsc + splice → updates index.html
npm run audit:narratives # fail on manifest, Markdown, or inline-fallback drift
npm run typecheck        # tsc --noEmit; CI guard for type regressions
npm run build:check      # exits 1 if index.html is out-of-date
npm run ci               # typecheck + build:check (combined regression guard)
```

Internals: `tools/build-all.mjs` first runs `tools/narrative-workflow.mjs`,
which derives `js/04-narrative-manifest.generated.ts` from the mineral registry
and Markdown directory, validates every literal code reference, rejects dynamic
variant selectors and inline prose fallbacks, and requires an all-files-loaded
runtime receipt before simulation construction. It then runs
`tsc -p tsconfig.json` (which emits `dist/**/*.js`), and `tools/build.mjs` walks `dist/` in lex order,
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
  two-runtimes-on-purpose framing above).
- Layout maps when something non-obvious moves.

What does NOT go here:
- Mineral / scenario / mode counts. These belong to the canonical source.
- Code line-range maps. They drift in days.
- Roadmap. That's `BACKLOG.md`.
