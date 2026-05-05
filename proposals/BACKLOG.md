# BACKLOG — Vugg Simulator

Living list of open work items, captured from session conversations so context survives compaction. Each item has enough detail that someone picking it up cold can act without re-discovering the rationale.

Order is rough priority — top of each section is most-actionable, but explicit user direction reorders freely.

---

## 🐞 Bugs / pending diagnostic

### 3D viewer bug list
**Status:** awaiting user's enumeration.
**Context:** during the 3D viewer work earlier in the project, several specific bugs were noted but never logged with reproduction steps. User has the list; this todo is the placeholder until they share it.

---

## 🌀 Twin probability retune — measure prevalence by per-mineral lifetime

**Status:** deferred, raised by user during the twin bug-fix commits (commits `8b8449b` per-nucleation roll fix + `16b39ee` four-placeholder population).

**Why:** the values currently in `data/minerals.json:twin_laws[].probability` are the per-roll rates derived from total natural prevalence numbers in the literature ("X% of natural specimens are twinned"). But:
- **The game rolls once per crystal at nucleation** (post-fix), so the realized in-game twin frequency is exactly the per-roll value.
- **Real-world prevalence partly reflects lifetime opportunity** for stress/thermal events to induce secondary twinning during growth, which the single-roll model doesn't capture.
- **Different minerals accumulate different growth-step counts** in typical scenarios — quartz might run 100 zones, a late-nucleating wulfenite gets 10 — so the multiplier between "per-roll rate" and "observed in-game prevalence" varies by mineral.

The four placeholders just populated (arsenopyrite 0.01, native_silver 0.05, argentite 0.04, chalcanthite 0.005) are research-grounded floors, not tuned for game-visible behavior. Likely too low for some minerals once the lifetime asymmetry is taken into account.

**What to build:**
1. Extend `tools/twin_rate_check.py` (or write a sibling tool) that runs each baseline scenario at seed 42, counts twinned vs untwinned crystals per mineral, and reports observed in-game frequencies. Compare to literature target ranges.
2. For each mineral that's "common-twinned in nature" but observed-rare in the sim (or vice versa), note the per-mineral average growth-step count and propose an adjusted per-roll probability that lands the observed rate within target.
3. Don't blanket-multiply — different minerals have different lifetime distributions, and some twins (Carlsbad, cyclic-sextet) are genuinely birth-time decisions where per-roll = lifetime rate.

**Out of scope for the retune itself:**
- Event-driven twins (thermal shock, tectonic event) — those remain in their grow_*() functions as event-conditional logic and aren't subject to this asymmetry. Currently quartz Dauphiné + the fortress-mode tectonic event.
- Habit-conditional twins (e.g., aragonite cyclic_sextet's "growth in twinned_cyclic habit" trigger) — these are nucleation-time decisions; the per-roll rate already matches the lifetime rate by construction.

**Relevant minerals to revisit during the retune** (from the commits' candid notes):
- cerussite cyclic_sixling at 0.4 — well-formed cerussite is nearly always cyclic-twinned in nature; per-roll 40% may underrepresent observed rate.
- sphalerite spinel-law at 0.015 — common in well-formed crystals; per-roll 1.5% looks low.
- calcite c-twin at 0.1 — common in many specimens; literature suggests 10-30% lifetime, may need bumping for short-lived calcite crystals.
- arsenopyrite trillings at 0.01 — "uncommon" but if observed-zero across baseline runs, likely needs bumping.
- chalcanthite cruciform at 0.005 — "rare" is consistent with the chalcanthite metastability mechanic (re-dissolves frequently), so observed-zero is geologically right; verify with the tool before bumping.

**Sequencing:** lands after the data-as-truth Option A refactor (initial fluid/T/P/wall → JSON5) so the retune can lean on stable declarative chemistry without conflating with infrastructure changes.

---

## 🧱 Data-as-truth Phase 2 — infrastructure follow-ups

Phase 1 (commit `2feb338`) and Phase 2 (commits `69f8acb..ce3dd5a`) migrated all 13 declarative scenarios + ~50 inline event closures to `data/scenarios.json5` + module-level handlers in `EVENT_REGISTRY`. The following items were noted in the Phase 2 handoff doc (`proposals/HANDOFF-DATA-AS-TRUTH-PHASE-2.md`) as out-of-scope for the migration itself but worth filing.

### `tools/sync-spec.js` Check 7 — cross-runtime EVENT_REGISTRY parity

**Why:** every event-type string in `data/scenarios.json5` must be registered in BOTH `vugg.py` and `index.html` `EVENT_REGISTRY`. Today the JSON5 loader validates each runtime against the spec at import/fetch time (loud failure if a referenced type is missing), but no cross-runtime check guarantees Python and JS register identical key sets. A missing/typo'd key on one side is caught only when that scenario is actually run in that runtime.

**What to build:** add Check 7 to `tools/sync-spec.js` — parse `EVENT_REGISTRY = {...}` literal from both `vugg.py` and `index.html` and assert identical key sets. Same idea as the existing mineral drift checks (Checks 1-6), just over the event-handler dimension.

**Effort:** small. The key-set extraction is regex-tractable (the registry is a contiguous dict literal in both files, with one key per line in the Phase 2 layout).

### `runSimulation` async-load guard (JS-only)

**Why:** JS loads `data/scenarios.json5` asynchronously via `_loadScenariosJSON5()`. After page reload, if the user clicks "Run" before the fetch completes, `SCENARIOS[scenarioName]` is undefined and `runSimulation` throws `Cannot read properties of undefined (reading 'temperature')`. Edge case in normal use (the fetch is fast on localhost), but reproducible on slow connections or first cold load. Phase 2 made every scenario JSON5-loaded, so this affects all 13 scenarios now, not just the original 4 from Phase 1.

**What to build:** in `runSimulation`, gate scenario execution on `_scenariosJson5Ready === true`. If not ready, show a "loading scenarios..." status message and either retry or block the click. Or — simpler — disable the Run button until ready and re-enable on fetch completion.

**Effort:** small.

### `scenario_random` JS-side parity gap

**Why:** Python has `scenario_random()` (in `vugg.py`); JS doesn't. JS exposes a "Random Vugg" button on the title screen that does its own thing (`index.html` ~line 16470). Pre-existing intentional drift, not introduced by Phase 2 — but now that all 13 declarative scenarios are unified through JSON5, `scenario_random` is the only remaining procedural divergence between the two runtimes. Worth either reconciling (port the Python scenario_random into JS so `SCENARIOS.random` works in both) or formally documenting the asymmetry in `ARCHITECTURE.md`.

**Effort:** medium if porting. Python's `scenario_random` is ~200 lines of archetype dispatch + per-archetype fluid construction. The JS title-screen Random Vugg uses a different (simpler) generative model. Reconciling them = pick one, port to the other side.

**Sequencing:** none of these block. File and pick up when convenient.

---

## 📜 Narrative-extraction post-completion follow-ups

The 89/89 narrative-as-data extraction landed in commit `e731f1f` (2026-04-30). Two items were deferred during the extraction itself; both are now actionable:

### Drop inline JS fallbacks

**Why:** every JS dispatcher in `index.html` carries `narrative_blurb('species') || 'fallback prose...'` and `narrative_variant(...) || 'fallback prose...'` for each branch. These were defensive — if the async markdown fetch hadn't resolved by the time the narrator fired, the inline fallback prose would render instead. Now that all 89 species are in `_NARRATIVE_MANIFEST` and the fetch is awaited at startup, the fallbacks are useful only for `file://` boots before the fetch completes (rare).

**What to build:** decide policy with the boss — keep fallbacks as `file://` resilience, OR strip them all (~1500 lines saved across 89 narrators) and trust the loader. If stripping, do it as a single mechanical commit: `narrative_blurb('x') || '...'` → `narrative_blurb('x')` for every narrator. Tests + sync-spec confirm no regressions.

**Effort:** small if stripping (mechanical pattern). Zero if keeping.

**Where to find:** every `_narrate_<species>` method in `index.html` (search for `|| '`).

### Auto-generate `_NARRATIVE_MANIFEST` from `data/minerals.json`

**Why:** `_NARRATIVE_MANIFEST` is a hardcoded array of 89 species names in `index.html` (~line 3274). Adding a new mineral now requires both adding it to `data/minerals.json` AND remembering to append it to the manifest. Easy to forget. The pattern matches the rest of the data-as-truth arc: hardcode while small, automate when stable.

**What to build:** at module-load time, derive the manifest from `Object.keys(MINERAL_SPEC)` (the JS-side parse of `data/minerals.json`). Filter for species that have a `narratives/<species>.md` file (or skip the filter and let missing files return empty strings — already handled gracefully by the loader).

**Effort:** small. ~5 lines change. Consider whether the python-side wants a parallel cleanup (Python doesn't have a manifest — it loads on first call — so just JS).

**Where to find:** `index.html` `const _NARRATIVE_MANIFEST = [...]` declaration.

**Sequencing:** neither blocks. Both are quality-of-life cleanups for narrative-edit ergonomics.

---

## 🔬 Supersat drift follow-ups (post-v13 audit)

The v13 audit (`tools/supersat_drift_audit.py`, May 2026) found 11 mineral supersaturation formulas with structural drift between vugg.py and index.html. Two real physics bugs (galena + molybdenite missing O2 gates) and chalcopyrite's T-window were fixed in v13. The remaining 10 divergences are filed here — none are obvious bugs, but the drift means the browser sim and the Python sim give measurably different sigmas for the same fluid, which is its own problem.

### `effectiveTemperature` feature gap (Python lacks Mo-flux T modifier)

**Status:** structural drift, JS-only feature.
**Why:** index.html + agent-api/vugg-agent.js define `effectiveTemperature` on VugConditions — a Mo-flux modifier that widens the T window for porphyry sulfides (chalcopyrite, galena, pyrite, molybdenite, quartz). Python's VugConditions has no such field; supersats use `self.temperature` directly. Net effect: a Mo-rich vug in JS shifts the chalcopyrite/galena/pyrite T sweet spots; in Python it doesn't.
**What to build:** decide whether effectiveTemperature is a real geochemical concept worth porting (Seo et al. 2012 documents Mo-flux thermal effects) or a JS-side decoration that should be removed. If porting: add `effective_temperature` property to VugConditions in vugg.py + thread through the 4-5 sulfide supersats. If removing: replace `this.effectiveTemperature` with `this.temperature` in JS. Either way, one runtime should be canonical and the other should match.
**Affected species:** chalcopyrite, galena, pyrite, molybdenite (already aligned in v13 except for eT), quartz.
**Effort:** medium. ~4 hours of research + porting + test regen.

### `silica_equilibrium` field — JS quartz uses, Python doesn't

**Status:** structural drift.
**Why:** the audit shows JS quartz supersat references `this.silica_equilibrium` (a precomputed field?) while Python's `supersaturation_quartz` inlines `50.0 * math.exp(0.008 * T)`. Same formula presumably, but the JS version reuses a cached value. Verify whether the cache is updated correctly when temperature changes.
**Affected species:** quartz.
**Effort:** small. Read the JS cache update path; either inline it (match Python) or add a cache to Python. ~1 hour.

### Substantive formula divergence (5 species, design-choice review)

**Status:** structural drift, design-choice review needed.
**Why:** these 5 supersats have substantively different formulas between vugg.py and index.html — different hard gates, different scaling constants, different T windows, different pH logic. Each needs a focused read with the boss to decide which side is canonical.

| Species | Python | JS | Decision needed |
|---|---|---|---|
| feldspar | K-only (K<10/Al<3/SiO2<200), exp T decay below 300, pH<4 acid attack | K OR Na (`hasK \|\| hasNa`), 150-800 hard T window, 5.5-9 pH window, 250-500 sweet spot | Python keeps K and Na separate (supersaturation_albite); JS forks them in feldspar. Pick one design. |
| fluorite | 3-tier T (sweet 100-250 + ramp + decline), fluoro-complex penalty above F=80, pH<5 acid | 5-tier T (slow<50 + warming + sweet 100-250 + viable 250-350 + fade>350), pH<5 acid; NO fluoro-complex penalty | Each side has a feature the other lacks. Merge both? |
| selenite | not yet read; likely simpler | Ca>20+S>10+O2>0.3+T<80+pH 5-8, T<40 sweet ×1.5 | Read Python; choose richer formulation. |
| smithsonite | Zn<15+CO3<30+O2<0.3, T>100 decay (rate 0.02) | Zn<20+CO3<50+O2<0.2, T>200 hard fail, pH<5 hard fail, T>100 decay (rate 0.008), pH>7 ×1.2 | JS richer (pH window + alkaline boost + hard T cap). Port to Python. |
| wulfenite | constants 0.025/0.3/0.4/0.5/15.0/3.5/40.0/80/9.0 | constants 0.006/0.2/10/150/250/30.0/4/60.0/7 | Need full read of both; significant divergence in scaling. |

**Affected species:** feldspar, fluorite, selenite, smithsonite, wulfenite.
**Effort:** medium-large. Per-species reconciliation + baseline regen + test parity.

### `calcite` 500°C JS-inline thermal cap

**Status:** known-acceptable architectural divergence (not really a bug, documented for completeness).
**Why:** JS calcite has `if (this.temperature > 500) return 0;` inline. Python handles thermal decomposition via the top-level `THERMAL_DECOMPOSITION` table at line ~10639, which fires regardless of supersat returning >0. Same effective behavior, different mechanism. No action needed unless the dual mechanism causes confusion later.
**Effort:** zero (already aligned in effect).

### Sequencing

The `effectiveTemperature` gap is the most consequential — it touches 5 species and any new sulfide that arrives. Resolve that first before tackling the per-species divergences, since a Mo-flux decision affects how each one is reconciled.

---

## 🏷️ Internal token cleanup — finish the mode renames

**Status:** deferred. User-visible labels were renamed in commit `467e8c4` (and earlier — Fortress→Creative, Legends→Simulation, The Groove→Zen Mode/Record Player). Internal tokens (`fortress*`, `legends*`, `idle*`, `groove*`) still use the pre-rename names because renaming hundreds of CSS classes / DOM IDs / function names for no UX gain wasn't worth the churn.

**Token map** (canonical entry point → user-visible name):

| Internal token | User-visible | Notes |
|---|---|---|
| `fortressSim`, `#fortress-panel`, `.fortress-*`, `fortressBegin()`, `fortressStep()`, `fortressFinish()` | **Creative** | ~199 occurrences |
| `legendsSim`, `legendsSimSource` | **Simulation** | far fewer occurrences (~10s) |
| `idleSim`, `#idle-panel`, `.idle-*`, `idleTogglePlay()`, `idleAppendLog()`, `idleStep()`, `menuGo('idle')` | **Zen Mode** | ~40 occurrences |
| `grooveCollectionCrystals`, `playCollectedInGroove()`, `switchMode('groove')`, `#mode-groove`, `.groove-tooltip`, `.groove-canvas-wrap` | **Record Player** | ~30 occurrences. **Caveat:** the term "groove" is genuinely correct for the rainbow-lane visualization primitive inside the Record Player — that should keep the name even if the mode codepath is renamed. The boundary is the codepath/mode tokens vs. the visualization-routine tokens. |

**Discoverability breadcrumbs already in place** (so future devs greppin' a token find the rename context):
- Header comment block above each global declaration: `let fortressSim`, `let legendsSim`, `let idleSim`, `let grooveModalCrystal` (all in `index.html`)
- Section comments at `/* ---- Creative Mode Styles (internal: fortress-* IDs/classes — pre-rename token, kept) ---- */` and the matching `<!-- Creative Mode Panel -->` HTML comment
- Pre-rename source tokens scrubbed: `source: 'Fortress'` → `'Creative'`, `source: 'Legends'` → `'Simulation'`, `source: 'The Groove'` → `'Zen'`. The post-game info panel's "Source: ___ mode" line now matches the title-card labels.

**What the thorough cleanup looks like** (when someone wants to take it on):
1. Pick one mode at a time (start with `legendsSim` — fewest occurrences, lowest blast radius)
2. Rename the global, then the DOM IDs, then the CSS classes, then the function names — each as its own commit
3. Verify after each: pytest 1130/1130, sync-spec 0/89, browser smoke
4. The `groove → recordplayer` rename is the most carefully-scoped — keep `.groove-tooltip` and the rainbow-lane drawing routines named `groove*` (visualization primitive), only rename the mode-control surface

**Out of scope:** Python `vugg.py` doesn't have UI modes (it's the dev/test runtime); no rename needed there. agent-api/vugg-agent.js similarly headless.

The Creative mode setup panel currently exposes ~30 FluidChemistry sliders + temperature + pressure + new wall reactivity. These items extend the player's control over the rest of the wall + fluid surface.

### Wall porosity slider
**Status:** designed, ready to implement.
**Why:** porosity is geologically distinct from reactivity. Three coupled effects, each with its own engine hook:

| Effect | What it does | Hook |
|---|---|---|
| **(1) Surface area** | Multiplies wall dissolution rate (effective_rate × reactivity × porosity_multiplier) | `VugWall.dissolve()` rate calc |
| **(2) Matrix leaching** | Per-step ion influx from surrounding rock's wall_*_ppm reservoir into vug fluid, gated by porosity. Even at neutral pH, K/Ca/Si/Al migrate in. The Deccan zeolite mechanism — K/Ca/Si/Al arrive via porosity, not direct wall contact. | New per-step `leach_from_matrix()` method on `VugWall`, called alongside `dissolve()` |
| **(3) Residence time** | Controls fluid drainage / refresh. High porosity = fluid replaced often (dilute output). Low porosity = fluid sits, evaporates if exposed (concentrates → evaporites — the sabkha mechanic). | Modulates `flow_rate` and possibly an evaporation-concentration multiplier |

**Slider design sketch:**
- 0% (dense) — only vug-facing wall surface attacked. Default for Herkimer-style massive dolostone.
- 10% (typical limestone) — current implicit behavior baked into reactivity=1.0.
- 30% (chalky / oolitic) — ~3× effective surface area; faster dissolution + ion release.
- 50%+ (vuggy / cavernous) — fluid percolates through; might allow secondary nucleation IN wall pore space rather than only on the vug surface (interesting rendering question).

**Schema work needed for effect (2):** the `wall_*_ppm` fields only cover Fe/Mn/Mg today. Matrix leaching needs at minimum `wall_K_ppm`, `wall_Na_ppm`, `wall_Si_ppm`, `wall_Al_ppm` — and ideally per-composition profiles (limestone vs dolomite vs basalt vs granite vs phyllite each have different ion reservoirs). That naturally pushes toward the wall-composition-picker item below.

### Wall composition picker (Creative mode)
**Status:** queued behind reactivity slider.
**Why:** wall composition is currently hardcoded by FLUID_PRESET in `fortressBegin`. Player can't pick limestone vs dolomite vs silicate. With the reactivity slider live, exposing composition is the natural next wall control. Limestone / dolomite / silicate (with a sub-pick of pegmatite / granite / quartzite / phyllite / basalt) covers all the scenario use cases.

### Creative mode rework — full element-slider exposure
**Status:** flagged but not designed in detail.
**Why:** Creative mode setup exposes ~30 FluidChemistry elements as sliders, but some preset starter fluids contain trace chemistry the user can't see or modify until they're already in-game. Per the user's framing — starter fluids represent "what's in the rocks", so every element they define should be exposed at setup time. Bigger surgery than a single-slider add; needs a full UX pass on the setup panel layout.

---

## 🧪 Schema additions — new FluidChemistry fields + mineral engines

Each item below has the locality chemistry **pre-researched** during the chemistry audit. The work is engineering (add field + mineral engines + minerals.json entry + nucleation block) — no more literature pass needed.

### Cd field + grow_greenockite
**Status:** chemistry pre-researched, engine pending.
**Pre-researched value:** `Cd=2` for Tri-State (sphalerite carries Cd substituting for Zn — typically 1000-5000 ppm Cd in mineral, raw fluid Cd ~1-10 ppm). Greenockite (CdS) is the diagnostic yellow coating on Tri-State sphalerite.
**Source:** Schwartz 2000 (Econ. Geol. 95) on Cd in MVT sphalerite + Tri-State greenockite occurrence in Hagni 1976.
**Engineering needed:**
- `Cd: float = 0.0` field in FluidChemistry (Python @dataclass + JS class)
- `grow_greenockite` (CdS) implementation following the pattern of grow_native_gold (commit `e13d7f1`) — see that as template
- `supersaturation_greenockite` method
- Nucleation block in `check_nucleation` (substrate preference: on sphalerite)
- `MINERAL_GROW_FUNCS` dispatch entry
- `minerals.json` entry — yellow class_color, formula CdS, T tolerance similar to sphalerite
- Optionally: Cd-in-sphalerite trace tracking in `grow_sphalerite` (TitaniQ-analog)
- **Au audit pattern reminder:** when Cd lands, run the gap-check across all 10 anchored localities. Most will be `intentionally_zero`; Tsumeb / supergene scenarios may carry trace Cd (greenockite is reported there too).

**Minerals unlocked:** greenockite, hawleyite, Cd-trace in sphalerite.

### Au-Te coupling — grow_calaverite + grow_sylvanite (Bingham telluride cap)
**Status:** all upstream chemistry already in place; pure engine work.
**Why:** Bingham `scenario_porphyry` already has Au=2 + Te=2 + Ag=8 in init. Currently all the Au precipitates as native_gold; adding Au-Te competition would partition some Au into telluride growth instead. Bingham upper-level epithermal cap hosts these tellurides (Landtwing 2010 + Cook et al. 2009 Au-Ag-Te systematics).
**Engineering needed:**
- `supersaturation_calaverite` (AuTe2) and `supersaturation_sylvanite` ((Au,Ag)Te2) methods
- `grow_calaverite` and `grow_sylvanite` functions
- Nucleation blocks
- `MINERAL_GROW_FUNCS` dispatch entries
- `minerals.json` entries
- Update `grow_native_gold` to compete against tellurides when both Au and Te are present (currently Au always goes native)

**Minerals unlocked:** calaverite, sylvanite, krennerite (potentially).

### Auriferous-chalcocite trace tracking (Bisbee mode)
**Status:** schema mostly in place; modeling work needed.
**Why:** Bisbee's supergene Au literature (Graeme et al. 2019) emphasizes that much of the Au is hosted as a trace within chalcocite rather than as discrete native_gold crystals. Currently all Au in Bisbee precipitates as discrete native_gold instead of partitioning into chalcocite.
**Engineering needed:**
- Add Au-trace tracker on `grow_chalcocite` (parallel to how Mn/Fe traces are tracked in calcite — see `grow_calcite` for pattern)
- Add `trace_Au` field to GrowthZone if not already present
- Update narration / inventory output to surface auriferous-chalcocite vs pure-chalcocite distinction

**Effect:** Bisbee output would record both native gold pockets AND ppm-Au-bearing chalcocite zones — the latter being the more economically significant mode in real Bisbee.

### Ag/Ge mineral engines (Tsumeb downstream)
**Status:** Tsumeb fluid chemistry already populates Ag=8, Ge=5, Sb=5 (commit `684f035`). Mineral engines for the Ag-sulfosalts and Ge-sulfides don't exist yet — those are pure engine work.
**Engineering needed:**
- `grow_proustite` (Ag3AsS3) — ruby silver, As-end
- `grow_pyrargyrite` (Ag3SbS3) — ruby silver, Sb-end
- `grow_native_silver` (Ag) — analog of grow_native_gold
- `grow_chlorargyrite` (AgCl) — supergene Ag halide
- `grow_germanite` (Cu26Fe4Ge4S32) — Tsumeb type-locality Ge mineral
- `grow_renierite` ((Cu,Zn)11(Ge,As)2Fe4S16) — companion Ge mineral
- (Optionally) `grow_briartite` (Cu2(Fe,Zn)GeS4)
- Each needs supersaturation, growth, nucleation, dispatch, minerals.json entry
- **Au audit pattern reminder:** when each lands, run gap-check across all 10 anchored localities for Ag specifically (Bingham Ag=8 and Bisbee Ag=40 already populate; some MVT scenarios may need Ag promoted from "documented but no engine" to active).

---

## 📋 Audit-trail patterns established (reference, not work)

These aren't todos — they're conventions to follow when doing the work above:

- **`pending_schema_additions`** in `data/locality_chemistry.json` — for "value pre-researched, schema/engine not yet there". Includes value, unit, rationale, source, blockers, minerals_unlocked. See bingham_canyon entry as canonical example before Au shipped.
- **`intentionally_zero`** in `data/locality_chemistry.json` — for "we checked and zero is the right answer for this locality". Established in commit `e2048e9` for the Au audit. When any new schema field lands, run the per-locality gap-check and document zero values explicitly so future audits don't re-flag them.
- **Three-place note pattern** — when a new schema element is researched but engine pending, leave cross-referenced notes in: vugg.py scenario comment + index.html mirror comment + data/locality_chemistry.json `pending_schema_additions` block. See bingham_canyon Au notes (pre-commit `e13d7f1`) for the reference shape.
- **Push to Syntaxswine origin** — the user's fork is the push target; StonePhilosopher canonical is read-only here, boss promotes from Syntaxswine.

> **Layout flatten (2026-04-29, commit `4950ffa`):** the prior "per-commit docs/ mirror" pattern is retired. `web/` and `docs/` were collapsed into repo root; GitHub Pages now serves from root, no mirror needed. References to `web/index.html` or `docs/index.html` in completed-work briefs under `build/` are historical — current path is `index.html`.

---

## 🎯 SIM_VERSION
Currently **7** (bumped in commit `97cb088` for Round 7 Commit 3 — corundum family + marble_contact_metamorphism scenario added; previous commit `a2f8f94` was the 5→6 bump for Round 7 Commit 2, beryl family split).

Bump to 8 when:
- Cd field shipped (would shift Tri-State seed-42 output)
- Wall porosity slider shipped (changes existing scenario dissolution behavior at default settings)
- Au-Te coupling lands (would partition Bingham Au into telluride growth)
- Halide-expansion round (atacamite, halite, chlorargyrite, etc.)

Defer the version bump decision to whoever ships those changes.

History:
- v1: pre-audit defaults
- v2: scenario-chemistry audit (Apr 2026; commit `77d999a`)
- v3: arsenate/molybdate supergene cascade engines — arsenopyrite + scorodite + ferrimolybdite (Apr 2026; commits `1c9cd29` → `0cd182f`)
- v4: Round 5 sulfate expansion — barite + celestine + jarosite + alunite + brochantite + antlerite + anhydrite (Apr 2026; commits `ccb8ac6` → `a044e81`). Engine count 55 → 62. Coorong sabkha now produces the textbook gypsum + anhydrite + celestine + dolomite + aragonite assemblage. Brings the sulfate class from 1 mineral (selenite) to 8.
- v5: Round 5 gap-fill follow-ups (Apr 2026; commits `c8056ef` + `8b9c831`). Tri-State + Sweetwater O2 0.0→0.25 (mildly reducing MVT brine — barite + celestine activate); barite + celestine supersat O2 saturation retuned to /0.4 (saturates at SO₄/H₂S boundary). Tsumeb early ev_supergene_acidification 4-pulse event + Al 3→25 + jarosite/alunite per-check 0.45 — unlocks scorodite + jarosite + alunite + brochantite at Tsumeb. Engine count unchanged (62); chemistry tweaks only.
- v6: Round 7 Commit 2 — beryl family split (Apr 2026; commit `a2f8f94`). Split the inline-variety detector in `grow_beryl` into 5 first-class species: `beryl` (narrowed to goshenite/generic colorless), `emerald`, `aquamarine`, `morganite`, `heliodor`. Priority chain emerald > morganite > heliodor > aquamarine > goshenite baked into supersaturation gates via exclusion preconditions. `check_nucleation` uses one-per-step dispatch to prevent shared-Be-pool over-nucleation. Seed-42 `gem_pegmatite` now nucleates 4 emerald + 4 aquamarine + 3 morganite (goshenite naturally suppressed by chromophore priority). Engine count 62 → 66.
- v7: Round 7 Commits 3+4 — corundum family + marble_contact_metamorphism scenario (Apr 2026; commit `97cb088`). First **UPPER-BOUND gate** in the sim: SiO2 < 50 is the defining corundum constraint (with any more silica, Al + SiO2 drives to feldspar/kyanite/sillimanite). Shared `_corundum_base_sigma()` helper. Three new species: `corundum` (colorless/generic), `ruby` (Cr ≥ 2), `sapphire` (Fe ≥ 5 with in-engine color dispatch). New scenario anchored to Mogok Stone Tract (Al=50, SiO2=20, Ca=800, Cr=3, Fe=8, Ti=1, pH=8). Violet-sapphire (V-only path) deferred — would break necessity-of-Fe gate test. Engine count 66 → 69. Total baseline scenarios 12 → 13.

---

## 🧪 Scenario-tune follow-ups (deferred from v3 mineral expansion)

### ~~Tsumeb pH gap (now affects scorodite + jarosite + alunite)~~ ✅ **RESOLVED (v5, commit `8b9c831`)**
**Resolution:** Added `ev_supergene_acidification` event scheduled 4× (steps 5/8/12/16) in `scenario_supergene_oxidation` — drops pH to 4.0 + adds H₂SO₄ each pulse, holding the acid window against the limestone wall's carbonate buffering for ~15 steps before `ev_meteoric_flush` (step 20) neutralizes. Plus Tsumeb Al bumped 3→25 to clear alunite's Al/25 cap. Plus jarosite + alunite per-check probabilities bumped 0.18/0.15→0.45 to reflect their fast acid-sulfate kinetics in brief windows.

Now active at Tsumeb: scorodite (95% seed hit rate), jarosite (95%), alunite (70%), brochantite (already worked, now coexists). Antlerite correctly stays absent — Tsumeb is brochantite-dominant per geology, not antlerite-dominant (antlerite is the Atacama/Chuquicamata signature). See `data/locality_chemistry.json:tsumeb.mineral_realizations_v3_expansion.scorodite` + `mineral_realizations_v4_sulfate_expansion.jarosite/alunite/antlerite` for full citation tags.

### ~~Tri-State + Sweetwater O2=0.0 gap~~ ✅ **RESOLVED (v5, commit `c8056ef`)**
**Resolution:** Bumped Tri-State + Sweetwater O2 from default 0.0 to 0.25 — mildly reducing brine matching real MVT chemistry at the SO₄/H₂S boundary. Plus barite + celestine supersaturation O2 factor retuned from O2/1.0 to O2/0.4 (saturates at the SO₄/H₂S boundary, geochemically correct).

Verified seed-42:
- Tri-State (was 0/0): 6 active barite (max 32 µm), 10 celestine (max 111 µm)
- Sweetwater (was 0/0): 14 active barite (max 63 µm — Viburnum is the high-Ba MVT endmember per Stoffell 2008), 8 celestine (max 56 µm)

Coorong sabkha behavior unchanged (O2=1.5 was already saturated; engine retune is a no-op above O2=0.6).

### Bingham/Bisbee scorodite + ferrimolybdite end-to-end verification
**Status:** engines are wired and chemistry should produce both, but no full-scenario seed-42 run was executed during the v3 expansion (porphyry/Bisbee runtimes are slow). When time permits, run seed-42 porphyry (120 steps) and bisbee (340 steps) and confirm the realization predictions in `mineral_realizations_v3_expansion`:
- Bingham: arsenopyrite forms early, oxidizes after step 85, scorodite + ferrimolybdite nucleate post-oxidation
- Bisbee: arsenopyrite forms strongly (Fe=200 → enormous σ), oxidizes after step 65 ev_uplift_weathering, scorodite nucleates from arsenopyrite oxidation products

Failures would point to either (a) chemistry tuning needed (rare given the audit) or (b) σ thresholds need adjustment.

---

## 🔗 Canonical-only research / proposals (not yet folded into engine work)

These exist on `canonical/main` (StonePhilosopher) but were not merged into Syntaxswine fork during the recent rounds. Read and either implement, fold into BACKLOG, or merge:

- `proposals/MINERALS-RESEARCH-UNIMPLEMENTED.md` (canonical commit `41183b9`) — **DONE**: arsenopyrite/scorodite/ferrimolybdite engines shipped (commits `1c9cd29`–`0cd182f`). Expanded paragenetic notes on molybdenite + wulfenite from this file are reference-only (no engine changes needed).
- `proposals/MINERALS-RESEARCH-SULFATES.md` (Syntaxswine commit `ca6d710`, written this session) — **DONE**: all 7 sulfates (barite, celestine, jarosite, alunite, brochantite, antlerite, anhydrite) shipped (commits `ccb8ac6`–`a044e81`). The research doc remains the canonical citation source for narrators.
- `proposals/Gibbs-Thompson dissolution cycling — crystal quality mechanic` (canonical commit `6577442`) — **NOT YET READ**. Crystal-quality mechanic proposal. Action: read the file and decide whether to implement, scope into BACKLOG, or punt.

---

## 🔮 Round 6 candidates (not yet pre-researched)

Now that Round 5 sulfates are done, the next natural class expansion is **halides**. Candidates with chemistry already in FluidChemistry (Cl, Cu, Ag, Na, K all populated):

- **halite** (NaCl) — Coorong sabkha activation; salinity field already drives it
- **atacamite** (Cu₂Cl(OH)₃) — Cl-rich Cu oxide; Bisbee Cl=200 + Atacama; competes with brochantite (already flagged in `grow_brochantite`'s Cl>100 trace note)
- **chlorargyrite** (AgCl) — Tsumeb supergene Ag halide; activates the Ag pool that Tsumeb already populates
- **boleite** (KPb₂₆Ag₉Cu₂₄Cl₆₂(OH)₄₈ — extremely Cl-rich, deep blue; rare display target)

Plus possible follow-on Cu sulfates (chalcanthite — CuSO₄·5H₂O, the extreme-acid Cu sulfate that competes with antlerite below pH 1) and natrojarosite (Na variant of jarosite, common in salty AMD).

A research doc following the `MINERALS-RESEARCH-SULFATES.md` shape would be the next logical artifact.

---

## 💎 Round 7 — Gemstones ✅ SHIPPED (Apr 2026)

**Completed: beryl family + corundum family.** Per `proposals/MINERALS-PROPOSAL-GEMSTONES.md` + `proposals/MINERALS-RESEARCH-GEMSTONES.md`, 7 new first-class species (mineral count 62 → 69) landed across 4 commits:

- `a5fbaf6` — Commit 1: research compendium
- `a2f8f94` — Commit 2: beryl family split (SIM_VERSION 5→6)
- `97cb088` — Commits 3+4: corundum family + marble_contact_metamorphism scenario (SIM_VERSION 6→7)
- (this commit) — Commit 5: locality chemistry realizations + BACKLOG cleanup

Notable outcomes:
- **First upper-bound gate** in the sim: corundum family's SiO₂ < 50 constraint. This opens the door for the Al₂SiO₅ polymorph family (kyanite/andalusite/sillimanite) and other Si-undersaturated chemistry in future rounds.
- **Scaffolding tool proved out**: `tools/new-mineral.py` reliably inserted 7 JSON entries, generated paste-ready code stubs, and the auto-added entries passed all 48 parameterized per-mineral tests after engine code landed. ~15 minutes per species (down from ~45 min pre-tool).
- **Violet sapphire deferred**: V-only Tanzania variety would break the Fe-necessity gate test. Noted in Round 8+ candidates.
- **Mogok marble-contact scenario**: seed-42 nucleates 1 ruby + 1 calcite + 2 aragonite. Ruby wins the Cr=3 priority race; sapphire needs Cr depletion + Fe>=5 before it fires, which the 180-step window doesn't always afford. Further scenario tuning may be needed if we want seed-42 sapphire — consider ev_chromium_depletion event scheduled mid-run.

Deferred to a future round:
- Violet sapphire (V-only Tanzania) — separate `violet_sapphire` species with V-gate
- Color-change sapphire (Umba Valley, Cr+V+Fe) — could be a sub-variety of violet
- Alexandrite (BeAl₂O₄ + Cr) — chrysoberyl family; needs Be+Al+Cr with no Si (related to corundum SiO₂-undersaturation)
- Garnet supergroup (pyrope, almandine, spessartine, grossular, andradite, uvarovite) — clustered with D3
- Tanzanite (Ca₂Al₃Si₃O₁₂(OH) + V) — zoisite/epidote family
- Jade (jadeite = NaAlSi₂O₆ high-P + nephrite = Ca₂Mg₅Si₈O₂₂(OH)₂) — pressure-gated, clustered with D3
- Chrysoberyl (BeAl₂O₄) — related to corundum SiO₂-undersaturation; could be its own small cluster

---

## 🪨 Round 8 — Mineral expansion ✅ SHIPPED (Apr 2026)

**Completed: 15 new species across 5 sub-rounds.** Per the boss's 61-file research drop (canonical commit `f2939da`) + `proposals/ROUND-8-IMPLEMENTATION-KICKOFF.md`, mineral count 69 → 84, tests 842 → 1037 (+195), SIM_VERSION 7 → 8.

**Sub-rounds shipped:**
- 8a — silver suite (acanthite, argentite + 173°C paramorph mechanic, native_silver) — commits `3345bf1` → `aebeea6`
- 8b — native element trio (native_arsenic, native_sulfur synproportionation, native_tellurium) — commits `da76464` → `1b29ba0`
- 8c — Ni-Co sulfarsenide cascade (nickeline, millerite, cobaltite three-element gate + Bisbee Co=80/Ni=70) — commit `f050bb3`
- 8d — VTA suite (descloizite, mottramite, raspite, stolzite, olivenite + Tsumeb W=20) — commit `afc41e6`
- 8e — chalcanthite + water-solubility metastability mechanic — commit `a017844`

**Three new mineral-mechanic patterns added to the sim:**
1. **PARAMORPH_TRANSITIONS** (8a-2) — module-level dict + apply_paramorph_transitions hook in run_step. First non-destructive polymorph mechanic: argentite cooling past 173°C converts in-place to acanthite while preserving habit + dominant_forms + zones. Distinct from THERMAL_DECOMPOSITION (which destroys the crystal). 10 regression tests in `tests/test_paramorph_transitions.py`.
2. **Three-element gate** (8c-4) — cobaltite (CoAsS) requires Co + As + S all present simultaneously at minimum thresholds. First three-reagent gate; pattern available for future minerals (e.g., proustite Ag₃AsS₃, pyrargyrite Ag₃SbS₃).
3. **Water-solubility metastability** (8e) — chalcanthite re-dissolves when fluid.salinity<4 OR fluid.pH>5. Per-step hook in run_step distinct from THERMAL_DECOMPOSITION + PARAMORPH_TRANSITIONS — this is just chemistry. 5 regression tests in `tests/test_metastability.py`.

**Five new chemistry-dispatch patterns:**
1. **Depletion / overflow gate** (8a-3, 8b) — native_silver (S<2), native_arsenic (S+Fe<thresholds), native_tellurium (Au+Ag<thresholds). Inverse of normal supersaturation logic.
2. **Synproportionation Eh window** (8b-2) — native_sulfur fires only in the H₂S/SO₄²⁻ boundary (0.1<O2<0.7). First Eh-window engine.
3. **Mutual-exclusion priority gate** (8c-3) — millerite (NiS) returns 0 when As>30 + T>200 (nickeline NiAs takes priority).
4. **Cu/Zn-ratio fork** (8d) — descloizite/mottramite + olivenite/adamite both use Cu>Zn vs Zn≥Cu dispatchers.
5. **Kinetic-preference dispatcher** (8d-2) — raspite/stolzite both PbWO₄, kinetic preference favors stolzite ~90% of rolls.

**Backlog items unblocked or ready:**
- **Au-Te coupling round** (calaverite + sylvanite + hessite + altaite + tetradymite + coloradoite) — natural Round 9 lift. Te is now plumbed in FluidChemistry; native_tellurium's Au>1 gate becomes the dispatcher's Au-rich path → calaverite. Hg field needed for coloradoite (HgTe). Once Au is consumed by calaverite, residual Te will fire as native_tellurium.
- **Tarnish clock for native silver/arsenic/tellurium** (deferred from 8a + 8b) — per-step acanthite/arsenolite/tellurite-rind accumulation regardless of S availability. Should also apply to existing native_bismuth.
- **Cobalt-Ontario / Freiberg silver vein scenario** — would activate the primary nickeline + cobaltite + native_silver suite at seed-42 (currently absent; Bisbee chemistry isn't As-rich enough for sulfarsenide formation).
- **Acid mine drainage scenario** — would activate chalcanthite at seed-42 (currently absent_at_seed_42 in declared scenarios).

**Outstanding work from the boss's research drop (NOT in Round 8):**
- 41 expanded-research narrator refresh sweep — the boss's 61-file commit included richer research for 41 already-shipped species. Folding the new detail into existing narrators is a multi-session task; lower priority than next-round species expansion.

---

## 💎💎 Round ~end-of-list (positions ~185-200) — Diamond + mantle/high-P plumbing cluster

**RESERVED SLOTS**: diamond is the last mineral on the target list of 200, and ~15-20 slots adjacent to it are reserved for minerals that share the same plumbing investment (the "D3 option" from `proposals/MINERALS-PROPOSAL-GEMSTONES.md`). Rationale: the infrastructure to model diamond (carbon field in FluidChemistry + pressure-as-chemistry-driver + mantle T+P regime) is heavy; single-use for diamond would be wasteful. Clustering lets the plumbing pay for itself ~15-20 times.

**Reserved cluster (tentative order, all share the D3 plumbing):**

### Class 1 — carbon-field additions (C added to FluidChemistry)
- **graphite** (C) — metamorphic schists; a legitimate vug mineral (unlike diamond)
- **moissanite** (SiC) — rare, mostly meteoritic; scientific novelty
- **anthraxolite** (solid hydrocarbon) — already partially implemented via Herkimer narrative; could be a real inclusion mineral

### Class 2 — pressure-gated polymorphs (making `VugConditions.pressure` a real supersaturation driver instead of cosmetic)
- **kyanite** (Al₂SiO₅, high-P) — blue-blade gem
- **andalusite** (Al₂SiO₅, low-P) — chiastolite cross-pattern gem
- **sillimanite** (Al₂SiO₅, high-T) — completes the classic Al₂SiO₅ phase-diagram triangle
- **coesite** (SiO₂ high-P polymorph) — meteor-crater + UHP subduction indicator
- **stishovite** (SiO₂ extreme-P polymorph) — shock metamorphism
- **jadeite** (NaAlSi₂O₆) — jade; low-T high-P subduction
- **omphacite** (eclogite pyroxene) — deep subduction
- **lawsonite** (CaAl₂Si₂O₇(OH)₂·H₂O) — blueschist facies indicator
- **glaucophane** (Na₂(Mg,Fe)₃Al₂Si₈O₂₂(OH)₂) — the amphibole that names blueschist

### Class 3 — mantle / kimberlite xenolith minerals (needs mantle T+P + the above plumbing)
- **olivine / peridot** (Mg₂SiO₄) — the most abundant mineral on Earth by volume; its absence is the biggest gap in the current sim; gem variety is peridot
- **enstatite** (MgSiO₃) — mantle orthopyroxene
- **diopside / chrome diopside** (CaMgSi₂O₆) — mantle clinopyroxene; bright-green gem
- **pyrope garnet** (Mg₃Al₂Si₃O₁₂) — blood-red gem; Bohemian garnet
- **spinel** (MgAl₂O₄) — gem (Black Prince's "Ruby" in the Crown Jewels is actually a spinel); uses corundum's SiO₂-undersaturated gate
- **phlogopite** (KMg₃AlSi₃O₁₀(F,OH)₂) — bronze-brown mica xenocryst
- **ilmenite** (FeTiO₃) — kimberlite prospecting indicator
- **chromite** (FeCr₂O₄) — source of the Cr that gives emerald its color; black octahedra
- **perovskite** (CaTiO₃) — mantle; eponymous to the perovskite structure family
- **diamond** (C) — the capstone

### New scenarios enabled by Class 2 + 3 plumbing
- `scenario_blueschist_subduction` — lawsonite, glaucophane, jadeite, omphacite
- `scenario_impact_crater` — coesite, stishovite, shocked quartz, meteoritic moissanite
- `scenario_kimberlite` — diamond + pyrope + chrome diopside + olivine + phlogopite + ilmenite + chromite xenocryst suite

### Interim placeholder plan
Until the D3 plumbing round arrives (late in the 200-mineral runway), diamond stays on hold. If the user wants a visible diamond before the plumbing round, Option D2 (xenocryst event in a lightweight kimberlite scenario) can ship as a bridge — 2-4 hours; `scenario_kimberlite` created as a shell, diamond teleports in as a pre-formed crystal, narrator explains the xenocryst origin honestly. When the D3 plumbing lands, diamond gets retrofitted to mantle-grown-in-sim and the shell scenario fills out with the rest of the cluster.

---

## 🌐 3D simulation — loose ends from the multi-ring rollout (May 2026)

**Context:** the 3D-track session that landed Phases A → D v1 + canvas fix + sphere shape + cross-axis polar + per-latitude twist (commits `03625b0` through `1c77950`, ten commits) left a few intentional gaps. Listing them here so they don't fall through. Tutorial 3 (the "Fourth Door" oxidation breach) is also deferred, but is tracked separately in the tutorial proposal docs.

### Sim-version 20 mineral drop — bornite + magnetite

**Status:** known regression from Phase C v1, accepted at the time, expects_species lists updated with a comment pointing back here.

**Why:** Phase C v1 (commit `375adcf`) wired growth to per-ring chemistry. Each crystal's growth now reads `ring_fluids[crystal.wall_ring_index]` instead of the global, with mass-balance consumption hitting that ring's fluid. Inter-ring diffusion homogenizes slowly, so per-ring chemistry diverges briefly from the bulk during fast nucleation bursts. At seed 42 this shifted two borderline minerals out of the "fires reliably" window:
- `bornite` in `porphyry`
- `magnetite` in `deccan_zeolite`

Their engines and chemistry data are unchanged. Their gates just don't get crossed at seed 42 under sim_version 20+. The expects_species lists in `data/scenarios.json5` were trimmed (with comments referencing this entry) so the tests pass.

**What to build:**
1. Pick a chemistry-tuning approach for these two scenarios. Options:
   - Tune the scenario's initial fluid so the engine's σ for the dropped mineral is comfortably above its nucleation threshold by step ~50, even with per-ring fragmentation
   - Add a small event nudge mid-scenario (e.g. `magnetite_seed_pulse` at step 60 in deccan_zeolite) to push σ over the gate at the right moment
   - Bias `_assign_wall_ring` so minerals with strong scenario-anchor expectations land on the equator ring (which shares storage with conditions.fluid via aliasing — stronger event coupling)
2. Restore the dropped expects_species entries when the tuning lands.

**Out of scope:** changing the per-ring fluid mechanic itself. The fragmentation is the design intent.

### Habit textures missing in 3D mode — RESOLVED by wireframe crystals

**Status:** **superseded** by `proposals/PROPOSAL-WIREFRAME-CRYSTALS.md`. Wireframe rendering replaces wedge+habit-texture entirely in 3D mode — each habit now resolves to a hand-crafted polyhedron primitive (cube, hex_prism_terminated, scalenohedron, …), painted as silhouette fill + wireframe edges. Habit fidelity in 3D is now structural (the geometry IS the habit) instead of textural.

The original `drawHabitTexture` 2D textures (`_texture_sawtooth`, `_texture_rhomb`, etc.) stay in the codebase for the 2D topo strip — that path is untouched.

**If 2D-mode wireframes are ever wanted** (top-down orthographic of one slice), the same primitive library projects orthographically just as well; would respect the slice stepper state. Out of scope for v0.

### Hit-test broken in 3D mode — RESOLVED

**Status:** **resolved** in commit `f77a757`.

The original plan (cast a ray, intersect with the sphere shell, recover phi/theta) didn't survive contact with the actual cavity geometry: rings have latitude-dependent radius factors (`sin(φ)·polar_profile`) and per-cell base_radius wobble, so a ray-vs-mean-sphere intersection lands beyond where the cells actually sit. Switched to brute-force nearest-projected-cell — forward-project every cell's anchor center and pick the one whose projection is closest to the cursor in screen space. Naturally correct for the bumpy surface and handles both front and back hemispheres without explicit hemisphere math. ~2k operations per hit-test, negligible at hover-event frequency.

User-intent rule: prefer crystal-bearing cells over bare-wall ones within 14 px of the cursor (the user almost certainly meant the visible crystal, not its bare neighbor). Bare-wall tooltip itself is suppressed in 3D mode — the wireframe topo map shows the wall directly, so the readout was friction without information.

Same change refactored `_topoTooltipFromEvent` to consume `_topoHitTest`'s cell directly instead of duplicating the geometry math (the duplication was 2D-only and wouldn't have worked in 3D anyway).

### Water-level mechanic — partial-fill vugs (foundation)

**Status:** **foundation shipped 2026-05-04** (SIM_VERSION 23 → 24). Companion: `PROPOSAL-EVAPORITE-WATER-LEVELS.md`. Bridges directly into `PROPOSAL-AIR-MODE.md`'s air-mode end-to-end.

What landed:
- `VugConditions.fluid_surface_ring: float | None` — the meniscus position along the polar axis. None = fully submerged (legacy default; existing scenarios stay byte-identical).
- `VugConditions.ring_water_state(ring_idx, ring_count) -> 'submerged' | 'meniscus' | 'vadose'` classifier on both Python and JS sides.
- Nucleation reads the ring's water state and stamps `Crystal.growth_environment` accordingly (`vadose → 'air'`, otherwise `'fluid'`). The dormant air-mode plumbing from v22 now has a real trigger.
- 3D renderer paints a translucent blue meniscus disc at the surface latitude, sorted into the painter's order so it occludes correctly with rings/crystals.
- Tests: `tests/test_water_levels.py` covers default-submerged, partial-fill, integer-boundary, fully-drained, fully-flooded, single-ring, and the air/fluid stamping invariant. Baseline `seed42_v24.json` is byte-identical to v23 (legacy default keeps behavior stable).

What's NOT in the foundation (deferred to follow-on stages, in order of likely-next):
1. **Renderer tier-2 polish:** disc Z-occlusion is done at disc-centre granularity; objects straddling the disc's z get a coarse painter's-order tie. Per-segment splitting if it reads wrong at extreme tilts.
2. **~~Scenario events that mutate `fluid_surface_ring`~~** — **shipped 2026-05-04** (SIM_VERSION 24 → 25). `event_supergene_dry_spell` now drops the surface to mid-cavity (ring 8) and `event_bisbee_final_drying` fully drains (ring 0). Engine helper `_apply_vadose_oxidation_override` runs at the top of every `run_step` after events have applied: rings that just transitioned wet → vadose get O2 ratcheted to 1.8 (oxidizing) and S × 0.3 (sulfide oxidation depletes solute sulfur). Submerged rings keep the scenario's chemistry, so the floor stays reducing while the ceiling oxidizes — matching real supergene paragenesis. Existing oxidation-product engines (limonite, cerussite, malachite, autunite, scorodite, …) fire naturally because they already read each crystal's ring fluid via Phase C v1 plumbing. Verified in browser preview: post-drainage bisbee has 12 air-stamped supergene crystals (lepidocrocite, chrysocolla, hematite, annabergite, erythrite, quartz). Baseline `seed42_v25.json` regenerated; full suite 1376/1376 green.

   **Follow-up shipped 2026-05-04** (SIM_VERSION 25 → 26): host-rock porosity. New `VugConditions.porosity: float` (default 0.0 = sealed cavity, no drainage). Per-step continuous drift: `fluid_surface_ring -= porosity × WATER_LEVEL_DRAIN_RATE` (currently 0.05 rings/step at porosity=1.0 — drains 16 rings in 320 steps, matching typical scenario length). Asymmetric on purpose — porosity is a pure sink, refilling stays event-driven. Two example events for sudden fill/drain: `event_tectonic_uplift_drains` (snaps to 0) and `event_aquifer_recharge_floods` (snaps to ceiling via a 1e6 sentinel that the drift method clamps to ring_count). Default `porosity=0.0` keeps existing scenarios sealed and byte-identical to v25. Full suite 1386/1386 green.

   **Open polish — scaled / depth-proportional drainage:** the v26 drift uses a constant rate. A more physically-faithful model is RC-circuit-like: drainage proportional to depth above some equilibrium (the regional water table the cavity is sitting in). High when the cavity is full, slowing as it empties. The constant-rate model is simpler to reason about and reads correctly for most scenarios; the proportional model better captures cavities that sit near the regional water table and re-equilibrate to a non-zero level. Pick up if a scenario's drainage curve doesn't read right.
3. **~~Air-mode habit consequences~~** — **shipped 2026-05-04** (commit `4f71bbc`). `PRIM_DRIPSTONE` is now in the wireframe library; `_lookupCrystalPrimitive` overrides eligible habits (prismatic, acicular, rhombohedral, scalenohedral, botryoidal, plus their compound variants) to dripstone when `Crystal.growth_environment === 'air'`. Cubic / octahedral / tetrahedral / tabular / dipyramidal / pyritohedral habits stay canonical (galena cubes don't form icicles). The renderer's existing c-axis flip handles ceiling-vs-floor orientation: ceiling cells get c-axis world-down (stalactite hanging), floor cells get c-axis world-up (stalagmite standing). Reuses one primitive for both via the orientation logic, per PROPOSAL-AIR-MODE.md Stage A.
4. **~~Evaporite-specific minerals + concentration multiplier~~** — **shipped 2026-05-04** (SIM_VERSION 26 → 27). New per-ring `FluidChemistry.concentration` multiplier (default 1.0 — byte-identical legacy behavior) boosted by 3× at every wet → vadose transition; models the geological reality that water leaving a ring concentrates the remaining solutes. New `WATER_STATE_PREFERENCE` table biases evaporite minerals (selenite ×2.5, anhydrite ×2, halite ×4) toward the meniscus ring — bathtub-ring chemistry. Halite added (NaCl, cubic + hopper-growth habit, supersaturation reads Na × Cl × concentration² so it stays dormant in scenarios that don't drain). Bisbee post-drain and sabkha cycling now grow halite naturally; mvt / reactive_wall / porphyry don't (gates correctly tuned to require evaporative drainage). Full suite 1562/1562 green.

   **Borax + dehydration paramorph follow-up shipped 2026-05-04** (SIM_VERSION 27 → 28). Adds borax (Na₂[B₄O₅(OH)₄]·8H₂O) — alkaline-brine borate evaporite with Na + B + pH ≥ 7 + T ≤ 60°C + `concentration ≥ 1.5` hard gate (active-evaporation only; submerged rings can't nucleate). Three habits per the research file: prismatic (Boron CA museum specimens), cottonball (Death Valley playa surface), massive (tincal nodules). New DEHYDRATION_TRANSITIONS framework — environment-triggered paramorph (counterpart to PARAMORPH_TRANSITIONS' temperature trigger). Borax in a vadose ring accumulates `Crystal.dry_exposure_steps`; once ≥ 25 steps, it pseudomorphs to tincalconite (Na₂B₄O₇·5H₂O) with external shape preserved. Heat path fires immediate dehydration above 75°C. Tincalconite is a paramorph-only product — has supersat=0 stub + no-op grow function so it satisfies the spec coverage tests but never nucleates from solution. The signature "borax effloresces in your collection drawer" mechanic, geologically authentic. Concentration is also now excluded from inter-ring diffusion (it's per-ring evaporation-history state, not a diffusable solute) — small drift in bisbee halite max-size as a result. 16 new tests; full suite 1595/1595 green.
6. **Dripstone aspect-ratio refinement:** primitive radius taper (0.30 → 0 across 4 latitude rings) yields ~5-10:1 once multiplied by typical prismatic crystal ratios. Photographs of mature cave stalactites show even slimmer (10-20:1) — bias future dripstone crystals' a_width_mm via a per-habit override if it reads too stubby in scenarios. Soda-straw variant for very young dripstone (hollow tube the diameter of a water drop) is a separate primitive worth adding when a scenario actually grows dripstone from t=0.

### Phase D v2 — mineral-spec orientation hints

**Status:** **shipped 2026-05-04**. See companion `PROPOSAL-AIR-MODE.md` for the air-mode-specific extension (a separate future task).

Geological background corrected: in a fully fluid-filled vug at depth, gravity-driven settling is weak and most minerals are spatially neutral. Documented preferences trace to density-driven convection, gravity-assisted micro-cluster settling before nucleation, or substrate-chemistry effects — NOT direct gravity on growing crystals. (The original BACKLOG framing of "calcite scalenohedra hang from the ceiling under gravity" was the cave-mode story; in fluid-filled vugs the bias is much subtler.)

Implementation: per-mineral `ORIENTATION_PREFERENCE` table in `vugg.py` with strong/weak factors (3.0× / 1.5×), consumed by `_assign_wall_ring` to bias the area-weighted sampling. Spatially neutral minerals (most species) stay area-weighted as before.

Documented preferences applied:
- **Floor (subtle):** galena, malachite, azurite, barite, celestine, goethite, native_gold, native_silver, smithsonite — density-driven micro-cluster settling or supergene fluid pooling
- **Floor (strong):** selenite (gypsum) — Naica-style subaqueous pool growth
- **Ceiling (subtle):** hematite (specular rosette / "iron rose")
- **Wall:** stibnite, bismuthinite — acicular sprays grow perpendicular to substrate

Sources: Sangster 1990 (MVT paragenesis), Garcia-Ruiz et al. 2007 (Naica selenite), Hanor 2000 (barite brine density), Hill & Forti 1997 (cave mineralogy).
