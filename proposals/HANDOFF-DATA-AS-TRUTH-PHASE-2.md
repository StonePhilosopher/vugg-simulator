# HANDOFF: Data-as-Truth Phase 2 — migrate the remaining 9 scenarios

Picking up from Phase 1 (commit `2feb338`, 2026-04-30).

## Where Phase 1 left off

`data/scenarios.json5` is canonical for **4 scenarios**: cooling, pulse, mvt, porphyry. Both runtimes load and interpret it via:

- **Python**: `EVENT_REGISTRY` + `_build_scenario_from_spec` + `_load_scenarios_json5` in `vugg.py`
- **JS**: same shape in `index.html`, with a regex-based JSONC parser (no full json5 dep) and async fetch mirroring `MINERAL_SPEC`

`SCENARIOS` registry in both runtimes has Phase 1 entries pointing to JSON5-loaded callables; the other 9 scenarios still point to in-code `scenario_*` functions.

## Phase 2 goal

Migrate the remaining 9 scenarios to `data/scenarios.json5`. Their inline event closures (50 total, listed below) need promotion to module-level handlers first, then registration in both `EVENT_REGISTRY` tables.

`scenario_random` opts out — RNG-driven, stays procedural.

## Inline closure inventory

Surveyed via `grep '^    def '` inside each scenario function in `vugg.py`:

| Scenario | Closures | Names | Notes |
|---|---|---|---|
| **marble_contact_metamorphism** | 3 | `ev_peak_metamorphism`, `ev_retrograde_cooling`, `ev_fracture_seal` | **Start here** — 3 plain closures, no factory pattern |
| **reactive_wall** | 4 | `acid_pulse_1/2/3`, `seal_event` | Simple. Only one not using `ev_*` naming convention |
| **radioactive_pegmatite** | 4 | `ev_pegmatite_crystallization`, `ev_deep_time`, `ev_oxidizing`, `ev_final_cooling` | Simple |
| **deccan_zeolite** | 5 | `ev_silica_veneer`, `ev_zeolite_stage_ii`, `ev_apophyllite_stage_iii`, `ev_hematite_pulse`, `ev_late_cooling` | Simple |
| **ouro_preto** | 7 | `ev_vein_opening`, `ev_f_pulse`, `ev_cr_leach`, `ev_steady_cooling`, `ev_late_hydrothermal`, `ev_oxidation_stain`, `ev_final_cooling` | One name (`ev_final_cooling`) collides with rad_pegmatite — promote with scenario-prefixed names: `event_ouro_preto_final_cooling` etc. |
| **gem_pegmatite** | 8 | `ev_outer_shell`, `ev_first_schorl`, `ev_albitization`, `ev_be_saturation`, `ev_li_phase`, `ev_late_hydrothermal`, `ev_clay_softening`, `ev_final` | `ev_late_hydrothermal` also in ouro_preto — prefix per scenario |
| **supergene_oxidation** | 9 | `ev_supergene_acidification` (×4 events same closure), `ev_meteoric_flush`, `ev_pb_mo_pulse`, `ev_dry_spell`, `ev_as_rich_seep`, `ev_cu_enrichment`, `ev_phosphate_seep`, `ev_v_bearing_seep`, `ev_fracture_seal` | Watch: same closure scheduled multiple times (acid pulses at steps 5/8/12/16). One handler, four event entries pointing to it. |
| **bisbee** | 9 | `ev_primary_cooling`, `ev_uplift_weathering`, `ev_enrichment_blanket`, `ev_reducing_pulse`, `ev_oxidation_zone`, `ev_azurite_peak`, `ev_co2_drop`, `ev_silica_seep`, `ev_final_drying` | Largest scenario (281 lines). Heaviest provenance comments to preserve. |
| **sabkha_dolomitization** | 1 + 2 factories | `ev_final_seal`, plus `make_flood(idx)` and `make_evap(idx)` factory functions | **Defer to last; needs special handling.** Factories generate N flood + N evap events procedurally. Promote each instance to a named module-level handler (e.g., `event_sabkha_flood_1`, `..._2`, etc.) — the JSON5 schema doesn't support parameterized handlers, so unroll the factory at migration time. |

**Total closures to promote:** ~50 across 9 scenarios.

## Pattern (per scenario)

For each scenario:

1. **Promote closures.** Copy each `def ev_X(cond):` from inside the scenario function to module-level, rename to `event_<scenario>_<X>` (or just `event_X` if unique across scenarios). Watch for name collisions across scenarios — prefix with the scenario name in those cases.

2. **Register in EVENT_REGISTRY.** Add an entry in BOTH `vugg.py` (around line ~10625) AND `index.html` (~line 10770). Both must match exactly — Python validates at module import time, JS at scenario-call time.

3. **Add scenario entry to `data/scenarios.json5`.** Match the Phase 1 schema (anchor / description / duration_steps / notes / initial / events / sources). Preserve full provenance comments inline as JSONC `//` comments per chemistry value.

4. **Remove in-code `scenario_X` function** from both runtimes.

5. **Update SCENARIOS dict.**
   - Python: change `"X": scenario_X` to `"X": _JSON5_SCENARIOS["X"]`
   - JS: remove the `X: scenario_X` line — `_loadScenariosJSON5` will populate it on fetch

6. **Verify.**
   - `python -m pytest --tb=line -q` — seed-42 baseline tests must pass byte-identical (the test harness regenerates baselines if SIM_VERSION changes; these migrations should NOT change SIM_VERSION since they're refactors with identical behavior)
   - `node tools/sync-spec.js` — 0 drift across 89 minerals in 3 runtimes
   - Browser smoke: load `index.html`, run the migrated scenario, no console errors. For supergene_oxidation specifically: seed-42 200-step should produce ~70 crystals with 3 rosasite + 6 aurichalcite (Round 9a regression check).

## JS-side gotchas (caught during Phase 1 — avoid these)

1. **No sim `Event` class on the JS side.** The global DOM `Event` shadows any local. Use plain object literals: `{step, name, description, apply_fn}`. The Phase 1 `_buildScenarioFromSpec` already does this correctly — match it.

2. **JS scenarios return an OBJECT, not an array.** `runSimulation` destructures `{conditions, events, defaultSteps}` by name. Returning `[conditions, events, duration]` will throw "Cannot read properties of undefined (reading 'temperature')".

3. **JSONC parser limits** (the inline regex stripper in `index.html`):
   - `// line` and `/* block */` comments — supported
   - Trailing commas before `}` or `]` — supported
   - Unquoted keys — NOT supported; keys must be quoted
   - Single-quoted strings — NOT supported; use double quotes
   - The regex won't break on `//` inside a string in our spec because we control the spec content, but be aware if you add freeform user strings

4. **The async load race.** JS loads scenarios.json5 asynchronously. Reloading the page and immediately running a Phase 1 scenario can hit `SCENARIOS["cooling"]` before fetch completes. Phase 2 doesn't make this worse, but worth knowing. Adding a guard in `runSimulation` is filed for later — not blocking Phase 2.

## File map

| File | Lines | What |
|---|---|---|
| `data/scenarios.json5` | top-level | Append new scenario entries inside `"scenarios": {...}` |
| `vugg.py` | ~10620 | `EVENT_REGISTRY` dict — add entries here |
| `vugg.py` | ~10646 | `_build_scenario_from_spec` (don't touch — it's generic) |
| `vugg.py` | ~12527 | `SCENARIOS` dict — flip `scenario_X` → `_JSON5_SCENARIOS["X"]` |
| `index.html` | ~10770 | `EVENT_REGISTRY` (JS) — add entries |
| `index.html` | ~10800 | `_buildScenarioFromSpec` (don't touch) |
| `index.html` | ~11550 | JS `let SCENARIOS = {...}` — remove migrated entries |

Line numbers will shift as functions are deleted; re-grep for `^def scenario_X` (Python) or `^function scenario_X` (JS) to stay current.

## Recommended sequencing

Each scenario is its own commit (or batch 2-3 simple ones). Suggested order:

1. **marble_contact_metamorphism** — simplest, validates the multi-closure pattern
2. **reactive_wall** — `acid_pulse_*` naming is a good test of name-collision avoidance
3. **radioactive_pegmatite**
4. **deccan_zeolite**
5. **ouro_preto** — first with name collision (ev_final_cooling)
6. **gem_pegmatite** — second collision (ev_late_hydrothermal)
7. **supergene_oxidation** — large but self-contained
8. **bisbee** — largest; budget extra time for provenance comment migration
9. **sabkha_dolomitization** — last; needs design decision on the factory pattern

Trade-off on commit granularity: per-scenario commits are easy to review but slower; 2-3 per commit is faster but bigger reviews. Boss prefers reviewable units; default to per-scenario commits.

## Open follow-ups (not blocking Phase 2 but worth filing)

1. **`tools/sync-spec.js` Check 7**: validate Python + JS `EVENT_REGISTRY` have identical key sets. Currently no cross-runtime drift detection for event handlers. Add this as part of (or right after) Phase 2.

2. **Async-load guard in `runSimulation`**: gate scenario execution on `_scenariosJson5Ready === true`, show a "loading scenarios..." message if not ready yet. Edge case but worth fixing.

3. **`scenario_random` Python/JS gap**: Python has `scenario_random()` (in vugg.py); JS doesn't (the title-screen Random Vugg mode does its own thing per `index.html` line ~16660). Pre-existing intentional drift, not new.

## Project context the next session needs

- **Boss**: StonePhilosopher; canonical repo (`canonical/main`) is read-only here. Push to Syntaxswine origin (`origin/main`). Boss promotes from Syntaxswine to canonical at review time.
- **Auto-push**: per memory `feedback_auto_push.md`, push commits to origin after each meaningful step. Don't hold locally.
- **Sequencing principle**: per memory `feedback_refactor_vs_content_sequencing.md`, ship content on stable infra first, then refactor. Phase 2 is a refactor, not content — don't bundle new minerals or new mechanics into these commits.
- **Test-cases workflow**: per `proposals/TASK-BRIEF-DATA-AS-TRUTH.md` item 6, new minerals come with `test_cases` in `data/minerals.json`. Phase 2 doesn't add minerals, but if the tooling pass calls for new event-handler test coverage, file it as a separate item.
- **Bug spotted mid-task → fix it** (per memory `feedback_fix_bugs_when_seen.md`). Don't flag-and-ask. The Phase 1 JS Event-class collision was a "fix on sight" case.

## Verification commands (cheat sheet)

```bash
# Run from C:/Users/baals/Local Storage/AI/vugg/vugg-simulator/

PYTHONIOENCODING=utf-8 python -m pytest --tb=line -q
PYTHONIOENCODING=utf-8 python tools/twin_rate_check.py
node tools/sync-spec.js

# Smoke: confirm a migrated scenario still runs
PYTHONIOENCODING=utf-8 python vugg.py --scenario marble_contact_metamorphism --seed 42 --steps 60
```

For the browser smoke, use `mcp__Claude_Preview__preview_*` tools — server is `vugg-static (repo root)` per `.claude/launch.json`.

## Where to start reading

1. `data/scenarios.json5` — see the Phase 1 schema by example
2. `vugg.py` `EVENT_REGISTRY` (line ~10625) and `_build_scenario_from_spec` (line ~10646)
3. `index.html` JS counterparts (line ~10770)
4. Pick `scenario_marble_contact_metamorphism` (~150 lines) as the first migration target — it's the cleanest entry point
5. After that scenario migrates cleanly + tests pass, the pattern is set; the rest follow.

## Recent commit chain (for `git log` orientation)

```
2feb338  Data-as-truth Phase 1: scenarios → data/scenarios.json5 (4 of 13)
67e55f2  BACKLOG: deferred twin-prevalence retune entry
16b39ee  Twin probabilities: populate four placeholders with researched values
8b8449b  Fix: twin probability rolls once at nucleation, not per growth step
e721d34  Round 9c: carnotite + completes the anion-competition trio
42ab71a  Round 9b: torbernite + zeunerite + anion-competition mechanic
8ba1df8  Round 9a: rosasite + aurichalcite + broth-ratio branching mechanic
3bce063  test_cases: spec-level test declarations (brief + template + scaffold)
c122010  TASK-BRIEF: data/-as-truth — extract tables from procedural code
```

Phase 2 builds directly on `2feb338`. Read that commit's diff for the fully-worked example of the migration pattern.
