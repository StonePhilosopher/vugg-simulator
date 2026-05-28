# js/ — TypeScript source for the Vugg Simulator bundle

This directory holds the source-of-truth for everything inside the inline
`<script>` block in `index.html`. The shipped HTML is **generated** by
`npm run build` — edit files here, not `index.html` directly.

Files use a **two-digit numeric prefix** to control concatenation order.
After concat the entire bundle is one big `<script>`, so prefix order =
top-of-file load order. Top-level `let` / `const` / `Object.assign(...)`
calls run in lex-sorted order; `function` declarations are hoisted bundle-
wide and can be defined anywhere.

See the parent project's [ARCHITECTURE.md](../ARCHITECTURE.md) for the
build pipeline, the three-runtimes-on-purpose framing, and the canonical-
source table for non-code facts (mineral spec, scenarios, locality
chemistry, etc.).

---

## Quick task lookup

**Adding a new mineral** (≤ 4 file touches):

| File                            | What to add                                  |
|---------------------------------|----------------------------------------------|
| `data/minerals.json`            | the spec entry (formula, twin laws, …)       |
| `js/3x-supersat-<class>.ts`     | `supersaturation_<name>(self)` method        |
| `js/5x-engines-<class>.ts`      | `grow_<name>(crystal, conditions, step)`     |
| `js/65-mineral-engines.ts`      | `<name>: grow_<name>` registry entry         |

Optional extras:

| File                            | When to add                                  |
|---------------------------------|----------------------------------------------|
| `js/8x-nucleation-<class>.ts`   | mineral has its own nucleation gate logic    |
| `js/92x-narrators-<class>.ts`   | per-mineral `_narrate_<name>(c)` prose       |
| `js/05-narratives.ts` (manifest)| add `<name>` so `narratives/<name>.md` is fetched |
| `narratives/<name>.md`          | the actual prose (frontmatter + variants)    |

**Adding a new scenario** (≤ 2 file touches typically):

| File                            | What to add                                  |
|---------------------------------|----------------------------------------------|
| `data/scenarios.json5`          | scenario entry (id, initial fluid, events)   |
| `js/70x-<scenario-family>.ts`   | per-scenario event handlers (one per phase)  |

If the scenario reuses generic events only (`fluid_pulse`, `oxidation`,
`acidify`, …), no JS edit is needed — they all live in `js/70-events.ts`.

**Adding a new event handler** (existing scenario family):

1. `js/70x-<family>.ts` — the `event_<name>(c)` function
2. `js/70-events.ts` — register it in `EVENT_REGISTRY` (if it should be
   addressable from `data/scenarios.json5` by string id)

**Adding a new UI mode:**

1. `js/9x-ui-<mode>.ts` — mode-specific UI + handlers (state vars,
   start/stop/begin functions)
2. `js/92-ui-mode-switch.ts` — wire the mode into `switchMode()` if it's
   a top-level mode the player can navigate to
3. HTML structure for the mode goes in `index.html`'s `<body>` (this is
   the only reason to ever edit `index.html` directly).

**Tightening types in a single module:**

The bundle is intentionally loose — see `js/_typings.d.ts` for the
global widening of `document.getElementById` etc., and the `[key: string]: any;`
index signatures on dataclass-style classes (FluidChemistry, VugConditions,
WallState, Crystal, VugSimulator, …). Tightening per-file is a pure
local change: add explicit field declarations to a class, or replace
`any`-typed function parameters with their real shape. Run
`npm run typecheck` to catch regressions.

---

## Load-order index

Files are listed in the order they concatenate. Every file is SCRIPT-mode
TS (no `import` / `export`); top-level declarations become globals
visible to later files.

### Foundations (00–18)

| Prefix | File                       | What lives here                           |
|--------|----------------------------|-------------------------------------------|
| 00     | `00-mineral-spec.ts`       | `MINERAL_SPEC` (live + fallback) + `onSpecReady` + `maxSizeCm` |
| 05     | `05-narratives.ts`         | per-species narrative loader (`narrative_blurb` / `_closing` / `_variant`); `_NARRATIVE_MANIFEST` lists every species whose `narratives/<name>.md` is fetched |
| 07     | `07-habit-variant.ts`      | `selectHabitVariant(mineral, sigma, T, spaceConstrained)` |
| 10     | `10-seeded-random.ts`      | `SeededRandom` class (Mulberry32 PRNG)    |
| 12     | `12-mineral-art.ts`        | `MINERAL_ASCII` / `MINERAL_THUMBS` / `MINERAL_GAME_COLORS` |
| 13     | `13-runtime-state.ts`      | `let rng = new SeededRandom(...)` + `let timeScale` |
| 15     | `15-version.ts`            | `SIM_VERSION` constant + per-bump history |
| 18     | `18-constants.ts`          | `DEFAULT_INTER_RING_DIFFUSION_RATE`, `WATER_LEVEL_DRAIN_RATE`, `EVAPORATIVE_CONCENTRATION_FACTOR` |
| 18a    | `18a-mineral-gates-types.ts` | `MineralGates` interface — the shared shape consumed by the gates registry (42) |

### Chemistry + geometry (19–27)

| Prefix | File                       | What lives here                           |
|--------|----------------------------|-------------------------------------------|
| 19     | `19-mineral-stoichiometry.ts` | per-mineral fluid stoichiometry (which solutes a growth step debits) |
| 20     | `20-chemistry-fluid.ts`    | `FluidChemistry` class (38+ solute fields) + `_cloneFluid` |
| 20a    | `20a-chemistry-activity.ts` | ion activities + Davies-equation activity coefficients |
| 20b    | `20b-chemistry-carbonate-system.ts` | DIC + Bjerrum carbonate speciation (open-system carbonate engine) |
| 20c    | `20c-chemistry-carbonate-Ksp.ts` | Ksp(T) lookups for the carbonate minerals |
| 20c    | `20c-chemistry-redox.ts`   | Nernst-equation redox infrastructure (Eh / pe) |
| 20d    | `20d-localization-resolvers.ts` | wall-mesh localization — resolve a crystal/cell to its local fluid sample |
| 22     | `22-geometry-wall.ts`      | `VugWall` + `WallCell` + `WallState` + the bubble-merge profile init helpers |
| 23     | `23-geometry-wall-mesh.ts` | `WallMesh` — per-vertex cavity surface mesh (`mesh.cells[]`, the live fluid store) |
| 24     | `24-geometry-voxel-grid.ts` | `CavityVoxelGrid` — interior 3D fluid store ((r,c,d) voxels) + `_diffuseFull` 3D diffusion |
| 25     | `25-chemistry-conditions.ts` | `VugConditions` class (T/P/fluid/wall/ring fields + small helpers like `effective_temperature`, `silica_equilibrium`, `ring_water_state`) |
| 26     | `26-mineral-paragenesis.ts` | substrate-affinity + paragenesis tables (which minerals seed on which) |
| 27     | `27-geometry-crystal.ts`   | `GrowthZone` + `Crystal` classes          |

### Per-class supersat methods (30–41)

Each is `Object.assign(VugConditions.prototype, { supersaturation_<mineral>(): … })`.

| Prefix | Class       | Mineral count |
|--------|-------------|---------------|
| 30     | arsenate    | 6             |
| 31     | borate      | 2             |
| 32     | carbonate   | 11            |
| 33     | halide      | 2             |
| 34     | hydroxide   | 2             |
| 35     | molybdate   | 4             |
| 36     | native      | 7             |
| 37     | oxide       | 7             |
| 38     | phosphate   | 11            |
| 39     | silicate    | 13 + 2 family helpers |
| 40     | sulfate     | 12            |
| 41     | sulfide     | 20            |

> Two extra files ride alongside the class tables: `32b-supersat-carbonate-Ksp.ts`
> (Ksp-based saturation-index helpers feeding the carbonate SI engine) and
> `39a-supersat-amphibole.ts` (amphibole-family supersat, split from silicate).

### Mineral gates + competition (42–44)

| Prefix | File                            | What lives here                       |
|--------|---------------------------------|---------------------------------------|
| 42     | `42-mineral-gates-registry.ts`  | `MINERAL_GATES_REGISTRY` — per-mineral nucleation-gate params (σ_crit, …); consumed by the per-cell strangulation gate (85b) + nucleation dispatchers |
| 43     | `43-initiative.ts`              | initiative scaffold (read-only as of v127) |
| 44     | `44-graduated-competition.ts`   | graduated-competition allocation — how co-nucleating minerals split a shared solute budget |

### Per-class growth engines (50–61)

Each is a set of top-level `grow_<mineral>(crystal, conditions, step)`
functions that mutate the crystal in place and return a `GrowthZone`.

| Prefix | Class       | Mineral count |
|--------|-------------|---------------|
| 50     | arsenate    | 6             |
| 51     | borate      | 1 + tincalconite stub (paramorph-only) |
| 52     | carbonate   | 11            |
| 53     | halide      | 2             |
| 54     | hydroxide   | 2             |
| 55     | molybdate   | 4             |
| 56     | native      | 7             |
| 57     | oxide       | 7             |
| 58     | phosphate   | 11            |
| 59     | silicate    | 13 + family helpers (beryl + corundum) |
| 60     | sulfate     | 12            |
| 61     | sulfide     | 20            |
| 65     | `65-mineral-engines.ts` | `MINERAL_ENGINES` registry — name → `grow_<name>` |

> Extra engine files: `52b-engines-carbonate-kinetics.ts` (PWP rate law +
> metastability for the carbonate SI engine) and `59a-engines-amphibole.ts`
> (amphibole grow engines, split from silicate).

### Events + transitions + preferences (70–78)

| Prefix | File                            | What lives here                       |
|--------|---------------------------------|---------------------------------------|
| 70     | `70-events.ts`                  | generic chemistry events (`fluid_pulse`, `oxidation`, `acidify`, …) + `EVENT_REGISTRY` + `_loadScenariosJSON5` + `let SCENARIOS = {}` |
| 70a    | `70a-tutorial-overlay.ts`       | tutorial overlay UI (`showCallout`, `startTutorial`, …) |
| 70b    | `70b-marble.ts`                 | 3 marble metamorphism events           |
| 70c    | `70c-reactive-wall.ts`          | 4 reactive_wall acid pulses            |
| 70d    | `70d-pegmatite-radioactive.ts`  | 10 events (radioactive_pegmatite + schneeberg) |
| 70e    | `70e-pegmatite-gem.ts`          | 15 events (ouro_preto + gem_pegmatite) |
| 70f    | `70f-colorado-plateau.ts`       | 5 sandstone roll-front events          |
| 70g    | `70g-tutorial-scenarios.ts`     | 3 tutorial-scenario events             |
| 70h    | `70h-deccan-zeolite.ts`         | 5 Deccan basalt events                 |
| 70i    | `70i-supergene.ts`              | 9 generic supergene events             |
| 70j    | `70j-bisbee.ts`                 | 9 Bisbee Cu-oxidation events           |
| 70k    | `70k-evaporite.ts`              | 9 events (sabkha + naica + searles)    |
| 70l    | `70l-co2-events.ts`             | CO₂ degas + charge event handlers (open-system carbonate) |
| 70m    | `70m-sulphur-bank.ts`           | Sulphur Bank Mine events               |
| 70n    | `70n-sicily.ts`                 | Sicilian Solfifera Series events       |
| 70p    | `70p-sunnyside.ts`              | Sunnyside Mine / American Tunnel events |
| 70q    | `70q-roughten-gill.ts`          | Roughten Gill Mine events              |
| 70r    | `70r-jeffrey-mine.ts`           | Jeffrey Mine (Val-des-Sources) events  |
| 70s    | `70s-tn457.ts`                  | `tn457_barite_pulses` event handler    |
| 75     | `75-transitions.ts`             | `PARAMORPH_TRANSITIONS` + `DEHYDRATION_TRANSITIONS` + `applyParamorphTransitions` |
| 78     | `78-preferences.ts`             | `ORIENTATION_PREFERENCE` + `WATER_STATE_PREFERENCE` nucleation tables |

### Per-class nucleation gates (80–91)

Each is a set of top-level `_nuc_<mineral>(sim)` helpers + a class
dispatcher `_nucleateClass_<class>(sim)`. `VugSimulator.check_nucleation`
calls each dispatcher in turn.

| Prefix | Class       | Mineral count |
|--------|-------------|---------------|
| 80     | arsenate    | 6             |
| 81     | borate      | 1             |
| 82     | carbonate   | 11            |
| 83     | halide      | 2             |
| 84     | hydroxide   | 2             |
| 85     | molybdate   | 3 (raspite+stolzite collapsed via kinetic-fork) |
| 86     | native      | 7             |
| 87     | oxide       | 4             |
| 88     | phosphate   | 11            |
| 89     | silicate    | 8             |
| 90     | sulfate     | 12            |
| 91     | sulfide     | 20            |

> Extra: `89a-nucleation-amphibole.ts` holds the per-amphibole nucleation
> gates (split from silicate).

### VugSimulator + strip-view infra (85–85h)

| Prefix | File                            | What lives here                       |
|--------|---------------------------------|---------------------------------------|
| 85     | `85-simulator.ts`               | `class VugSimulator` — `constructor` + `run_step` + `narrate` (the orchestration trio) |
| 85a    | `85a-simulator-narrators.ts`    | the 3 cross-cutting narrator helpers (`_narrate_mixing_event`, `_narrate_tectonic`, `_narrate_collectors_view`) |
| 85b    | `85b-simulator-nucleate.ts`     | `nucleate` + `_assignWallCell` + `_assignWallRing` + `_atNucleationCap` + `_wallStrangledFor` (per-cell strangulation gate) + `_spaceIsCrowded` + `_runEngineForCrystal` + `_rollSpontaneousTwin` |
| 85c    | `85c-simulator-state.ts`        | snapshot / propagate / drift / diffuse / repaint / blocked-cells / vug_fill / enclosure / liberation |
| 85d    | `85d-simulator-step.ts`         | `apply_events` + `dissolve_wall` + `ambient_cooling` + `check_nucleation` |
| 85e    | `85e-simulator-format.ts`       | `format_header` + `format_summary` (text-mode reporting) |
| 85f    | `85f-strip-dataset.ts`          | strip-view dataset format + uint8 codecs (4D `[step][angle][height][depth][chip]` tensor, `stripDataIndex`) |
| 85g    | `85g-strip-recorder.ts`         | helicoid-as-recorder — captures per-step chip readings into a strip dataset |
| 85h    | `85h-strip-storage.ts`          | IndexedDB persistence for strip datasets (count-capped eviction) |

> Note on the prefix collision: `85-nucleation-molybdate.ts` (a per-class
> nucleation file) sorts before `85-simulator.ts` alphabetically (`n` < `s`).
> That order is correct — the nucleation helpers don't depend on the
> simulator class definition (they take `sim` as a parameter; the class
> is hoisted by reference). Same story for `91-nucleation-sulfide.ts`
> sorting before `91-ui-legends.ts`.

### Per-class narrators (92x)

Each is `Object.assign(VugSimulator.prototype, { _narrate_<mineral>(c) { … } })`.
Loads after the simulator class is defined.

| Prefix | Class       | Mineral count |
|--------|-------------|---------------|
| 92a    | arsenate    | 6             |
| 92b    | carbonate   | 11            |
| 92c    | halide      | 1 (fluorite)  |
| 92d    | hydroxide   | 2             |
| 92e    | molybdate   | 4             |
| 92f    | native      | 7             |
| 92g    | oxide       | 7             |
| 92h    | phosphate   | 11            |
| 92i    | silicate    | 13            |
| 92j    | sulfate     | 10            |
| 92k    | sulfide     | 20            |
| 92l    | borate      | (borax / tincalconite) |

> A borate narrator (`92l-narrators-borate.ts`) now exists; any minerals
> still lacking a JS narrator fall through to `''` in `narrate()`'s dynamic
> dispatch. The current gap list is tracked in `proposals/BACKLOG.md`.

### UI modes + shared widgets (91x – 98d)

| Prefix | File                            | What lives here                       |
|--------|---------------------------------|---------------------------------------|
| 91     | `91-ui-legends.ts`              | Simulation (legends) mode             |
| 92     | `92-ui-mode-switch.ts`          | `showTitleScreen` + cross-mode switch |
| 93     | `93-ui-collection.ts`           | crystal-collection localStorage records (`buildCrystalRecord`, `reconstructCrystalFromRecord`, …) |
| 94     | `94-ui-menu.ts`                 | New Game menu + Scenarios picker      |
| 95     | `95-ui-library.ts`              | Library mineral browser               |
| 96     | `96-ui-random.ts`               | Random Vugg + discovery narrative     |
| 97     | `97-ui-fortress.ts`             | Creative (fortress) mode              |
| 97a    | `97a-ui-broth.ts`               | broth-control sliders                 |
| 97b    | `97b-ui-sigma-panel.ts`         | σ-by-class pill panel                 |
| 97c    | `97c-ui-crystal-card.ts`        | crystal thumbnails + inventory rows (shared across modes) |
| 97d    | `97d-ui-zone-modal.ts`          | zone-history deep-dive modal          |
| 98     | `98-ui-groove.ts`               | Record Groove (turntable) mode        |
| 98a    | `98a-ui-zen.ts`                 | Zen / Idle mode                       |
| 98c    | `98c-ui-zone-bars.ts`           | zone-by-zone horizontal-bar visualizers (chemistry / UV / generic) |
| 98d    | `98d-ui-zone-shape.ts`          | per-zone full-shape canvas renderers  |

> **Strip View** is also a top-level mode (`switchMode('stripview')`, wired
> in `94-ui-menu.ts`), but its panel + render code live in the renderer
> block at `99k-strip-view.ts` rather than a `9x-ui-` file.

### Renderer + 3D / helicoid / strip view (99 – 99z)

`99` loads first among the renderer files because its module-level
state (constants, hover/lock targets, zoom/pan/tilt globals) needs to
exist before later renderer modules read it.

| Prefix | File                            | What lives here                       |
|--------|---------------------------------|---------------------------------------|
| 99     | `99-renderer-state.ts`          | `TOPO_*` constants, `_topoZoom`/`_topoPan`/`_topoTilt`, hover/lock targets, `topoActiveSim` |
| 99a    | `99a-renderer-textures.ts`      | `drawHabitTexture` + 3 texture painters (botryoidal / saddle-rhomb / sawtooth) |
| 99b    | `99b-renderer-topo-2d.ts`       | flat-unwrapped 2D wall view + `topoRender` master function |
| 99c    | `99c-renderer-primitives.ts`    | `PRIM_*` wireframe primitive geometry tables + `HABIT_TO_PRIMITIVE` |
| 99d    | `99d-renderer-wireframe.ts`     | wireframe crystal renderer            |
| 99e    | `99e-renderer-topo-3d.ts`       | 3D ring projection + canvas frame + hit-test |
| 99f    | `99f-renderer-interaction.ts`   | tooltip + zoom/drag/recenter handlers |
| 99g    | `99g-renderer-replay.ts`        | `topoReplay` history scrubber         |
| 99h    | `99h-renderer-idle-chart.ts`    | Zen-mode chart drawing + tick logic   |
| 99i    | `99i-renderer-three.ts`         | Three.js mesh renderer — the **default 3D vug model** (`state.cavity` + `state.crystals` on `#topo-canvas-three`); habit→geometry resolution |
| 99j    | `99j-helix-overlay.ts`          | **Helicoid Manifold** — opt-in overlay into the Three.js scene (radar trails + spinning helicoid). `_helixOverlayEnabled` defaults OFF (toolbar ⌇ button opts in); legend hides when off |
| 99k    | `99k-strip-view.ts`             | strip-view UI tab — renders the recorded 4D strip dataset (radial sub-strips) |
| 99z    | `99z-agent-interface.ts`        | agent-friendly programmatic interface (run/inspect/switchMode hooks) |

> The 3D model (99i) and the Helicoid Manifold (99j) share one Three.js
> scene: when the overlay is on it hides `state.cavity` and reveals the
> radar trail; when off, the toggle path restores cavity + crystal
> visibility. The standard 3D model is the default view (merge 2026-05-28).

### Type declarations

| File                            | What lives here                                 |
|---------------------------------|-------------------------------------------------|
| `_typings.d.ts`                 | Global TS overrides (loose `getElementById`, etc.) — pure type-level, no emit |

---

## Conventions

**Mixin pattern.** Methods that logically belong to a class but are
extracted to their own file are attached via:

```ts
Object.assign(SomeClass.prototype, {
  methodA() { … },
  methodB() { … },
});
```

This works because the file loads after the class definition. Both
direct calls (`this.methodA()`) and dynamic dispatch
(`this[\`prefix_${suffix}\`]`) keep working.

**Per-mineral helper functions.** Functions that are not class methods
but vary per mineral (`grow_<X>`, `_nuc_<X>`) live as plain top-level
functions in their per-class file. They get registered in a registry
dict (e.g. `MINERAL_ENGINES`) for dispatch.

**No `import` / `export`.** `tsconfig.json` sets `"module": "none"`, so
every `.ts` file is a SCRIPT — top-level declarations are globals. This
matches the original inline-`<script>` shape and avoids needing a real
bundler.

**Type-error tolerance.** `tsconfig.json` keeps `"strict": false` and
`"noEmitOnError": false` so the bundle still ships when types regress.
The CI guard is `npm run typecheck` which exits non-zero on any error,
plus `npm run ci` (typecheck + bundle-staleness check). At time of
writing the bundle is at 0 type errors — keep it that way.

**Numeric prefixes can have letter suffixes** (e.g. `97a`, `97b`, `97c`).
The build uses lex sort, so `97a` < `97b` < `97c` — letters maintain
load order without disturbing the existing numeric scheme.

---

## Build pipeline

```
npm install              # once — pulls in TypeScript as a devDependency
npm run build            # tsc + splice → updates index.html in place
npm run typecheck        # tsc --noEmit; CI guard for type regressions
npm run build:check      # exits 1 if index.html is out-of-date
npm run ci               # typecheck + build:check (combined regression guard)
```

See [ARCHITECTURE.md](../ARCHITECTURE.md#build-pipeline) for internals.

---

## History

The whole `js/` tree was created during PROPOSAL-MODULAR-REFACTOR
Phase B (commits B1–B20, summer 2026). Before that, every line of code
in this directory was inline inside one giant `<script>` block at the
bottom of `index.html`. See `proposals/PROPOSAL-MODULAR-REFACTOR.md` for
the original plan and the SHIPPED footer for what actually landed.

**Merge (2026-05-28).** vugg-simulator forked at v142 into a separate
`multidimensional-space-simulator` repo, which carried the line forward to
v160: the carbonate SI engines (calcite/dolomite/HMC/aragonite), the
cavity-interior voxel grid + real 3D diffusion (`24-geometry-voxel-grid.ts`),
the per-cell nucleation strangulation gate, the Helicoid Manifold
(`99j`) + Three.js renderer (`99i`), and the strip-view recorder/renderer
(`85f`–`85h`, `99k`). That work was merged back here; vugg-simulator stays
canonical. The lone divergent vugg commit (the v143 twin-law schema fixes)
was folded into the merged data layer — see `js/15-version.ts` for the
collision note.
