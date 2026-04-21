# Handoff: Adding Minerals to Vugg Simulator

You've just picked up the vugg-simulator project to add new minerals. Read this end-to-end before touching any files — there are three runtimes that need to stay in lockstep and a fork workflow to respect.

---

## What this project is

**Vugg Simulator** is a text-and-topo-map crystal-growth engine. A player picks a geological scenario (MVT brine, porphyry copper, supergene oxidation, etc.) or uses Creative mode to inject chemistry manually. The sim runs in discrete steps: each step the fluid cools, acid pulses attack the wall, crystals nucleate when their supersaturation clears the threshold, existing crystals grow (or dissolve), and the narrator generates a geological history at the end. The topographic map (upper-left panel on any game screen) shows the vug from above — amber wall outline, crystal-colored arcs where something's coating the wall, inclusion dots inside host crystals.

It's a collector's game. Every species is real, every mechanic maps to real geochemistry, and the audience is people who know what a "scepter overgrowth" or "Seo et al. 2012 wulfenite condition" means. Don't hand-wave the science.

---

## Repo topology and push workflow

Two GitHub remotes matter:

- **`origin` = `Syntaxswine/vugg-simulator`** — this is where you push. Auth is set up on the machine you're working on.
- **`canonical` = `StonePhilosopher/vugg-simulator`** — this is the review/canonical repo. You **cannot push** to it (403). The human reviews your Syntaxswine commits and promotes to StonePhilosopher.

**Before starting any new feature, fetch from canonical:**

```bash
git fetch canonical
git merge canonical/main   # resolve any conflicts, then proceed
```

The human may have pushed data updates (e.g. new spec fields on `minerals.json`) from their other machine since your last session. Working against a stale base will eat your afternoon.

Git identity is set globally as `StonePhilosopher <270513546+StonePhilosopher@users.noreply.github.com>`. Don't change it.

**Push after every meaningful commit.** The human's workflow is: you push to Syntaxswine, they review and promote. They've explicitly said rollback is fine if something's wrong — don't hoard commits locally.

---

## The three runtimes

Every feature touches 2-3 places. Keep them in sync or `tools/sync-spec.js` will yell at you.

| File | Role | When to touch |
|---|---|---|
| `vugg.py` | Server-side Python simulator. Runs via CLI (`python vugg.py --scenario <name>`), used for offline runs, tests, and research. | Source of truth for growth physics. Port changes here first. |
| `web/index.html` | Browser simulator + UI. Single-file vanilla JS + canvas. This is what the player actually plays. Serves at `localhost:8000/web/index.html` via the preview server. | Mirror every sim-logic change from `vugg.py`. Any UI work lives only here. |
| `docs/index.html` | **Exact mirror** of `web/index.html`, served by GitHub Pages. Copy `web/` → `docs/` on every web-side commit: `cp web/index.html docs/index.html`. Forgetting this ships a broken live site. |
| `agent-api/vugg-agent.js` | Node-side reader that loads `data/minerals.json` via `require`. No embedded spec — just reads. | Rarely needs changes. If you add a new top-level mineral field, verify this still works. |
| `data/minerals.json` | Single source of truth for mineral data. Both runtimes read this (Python at import, browser via fetch). | Every new mineral gets an entry here FIRST. |

---

## The source of truth: `data/minerals.json`

Every mineral declares:
- Formula, class, class_color (from the 12-hue palette — do NOT invent new hex values).
- `nucleation_sigma`, `max_nucleation_count`, `max_size_cm`, `growth_rate_mult`.
- Temperature window and optimum, T behavior (prograde / retrograde / wide / window).
- pH dissolution thresholds, redox requirement.
- `required_ingredients` (ppm thresholds all species need to reach).
- `trace_ingredients` (decorative — color, fluorescence, etc.).
- `thermal_decomp_C` + reaction + release fractions.
- `fluorescence` object (activator, threshold, color, optional quencher).
- `twin_laws` array.
- `acid_dissolution` object (pH threshold + reaction + products).
- `habit` (primary), `habit_variants` (array of **objects** — see below).
- `color_rules`, `narrate_function` name, `runtimes_present`, `audit_status`.
- `scenarios` — which scenario IDs this mineral can nucleate in.

**The single most important gotcha:** `habit_variants` is an **array of objects**, not strings. Each variant has `{name, vector, wall_spread, void_reach, trigger}`. See `proposals/vugg-mineral-template.md` for the full schema and the controlled `trigger` vocabulary — the habit-selection scorer won't pick a variant whose trigger doesn't contain one of its recognized keywords.

The 12-class color palette (don't deviate):

| Class | Hex |
|---|---|
| Oxide | `#eb1313` |
| Carbonate | `#eb7f13` |
| Arsenate | `#ebeb13` |
| Sulfide | `#7feb13` |
| Uranium | `#13eb13` |
| Phosphate | `#13eb7f` |
| Hydroxide | `#13ebeb` |
| Molybdate | `#137feb` |
| Silicate | `#1313eb` |
| Halide | `#7f13eb` |
| Native | `#eb13eb` |
| Sulfate | `#eb137f` |

**Wall amber** is `#D2691E` — reserved for the vug wall, no mineral should use it.

---

## Adding a new mineral — full checklist

Assume you're adding, say, **barite (BaSO₄)**. Here's the full sequence.

### 1. Data first — `data/minerals.json`

Add a complete entry inside `"minerals": { ... }`. Model it on an existing species with similar behavior (e.g. fluorite for a halide-ish precipitate, smithsonite for a carbonate). Check `_schema` for the full field list — every field there is required.

Pay special attention to:
- `class`, `class_color` (from the palette table above)
- `max_nucleation_count` (typical range 2–10; use higher for swarm species like sphalerite)
- `habit_variants` — 2–6 objects with the five required fields. Use the controlled `trigger` vocabulary (see `proposals/vugg-mineral-template.md`).
- `scenarios` array — which of the seven fixed scenarios can produce this. Also add to `_audit_summary.scenarios_that_can_nucleate` under the same keys.
- `runtimes_present` — list the files you'll update. If you don't update all three, the sync check will flag it.

### 2. Implement supersaturation in BOTH simulators

In `vugg.py`, add a method to `VugConditions`:

```python
def supersaturation_barite(self) -> float:
    if self.fluid.Ba < 5 or self.fluid.S < 20 or self.fluid.O2 < 0.3:
        return 0
    sigma = (self.fluid.Ba / 30.0) * (self.fluid.S / 80.0) * (self.fluid.O2 / 1.0)
    # pH / T adjustments as appropriate
    return max(sigma, 0)
```

Mirror to `web/index.html`'s `VugConditions` class. The formulas should be **character-identical**. If you tune denominators, tune both.

### 3. Implement the growth engine in BOTH simulators

In `vugg.py`:

```python
def grow_barite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    sigma = conditions.supersaturation_barite()
    if sigma < 1.0:
        # handle dissolution / undersaturation
        return None
    # compute growth rate, trace incorporation, fluid inclusions, twinning
    return GrowthZone(step=step, ...)
```

Register it:

```python
MINERAL_ENGINES["barite"] = grow_barite
```

Mirror in `web/index.html` (search for the existing `MINERAL_ENGINES` object). Same logic, same constants.

### 4. Add a narrator method in BOTH simulators

```python
def _narrate_barite(self, c: Crystal) -> str:
    ...
```

Mirror in `web/index.html`. The spec's `narrate_function` field names this method — keep them consistent.

### 5. Wire nucleation in BOTH simulators' `check_nucleation`

In both `vugg.py` (search `def check_nucleation`) and `web/index.html` (search `check_nucleation(vugFill)`), add a nucleation block. Pattern to follow:

```python
sigma_ba = self.conditions.supersaturation_barite()
existing_ba = [c for c in self.crystals if c.mineral == "barite" and c.active]
if sigma_ba > 1.0 and not existing_ba and not self._at_nucleation_cap("barite"):
    pos = "vug wall"
    # Optional: nucleate on substrate (e.g. pyrite surface) with some probability
    c = self.nucleate("barite", position=pos, sigma=sigma_ba)
    self.log.append(f"  ✦ NUCLEATION: Barite #{c.crystal_id} on {c.position} ...")
```

**Crucial:** always add `and not self._at_nucleation_cap("<mineral>")` (Python) / `&& !this._atNucleationCap('<mineral>')` (JS). Without this, enclosure will trigger runaway nucleation (previously caused hosts to accumulate 600 inclusions instead of a realistic 5-20).

### 6. Add `dominant_forms` to `nucleate()` in BOTH simulators

In `vugg.py`'s `VugSimulator.nucleate()` method (the long `if mineral == "X":` chain) and web's equivalent, add:

```python
elif mineral == "barite":
    crystal.dominant_forms = ["{001} tabular plates", "{011} modifications"]
```

These are crystallographic face strings — separate from the habit variant. The variant selector sets `crystal.habit` from the spec; `dominant_forms` stays per-mineral.

### 7. Verify with `tools/sync-spec.js`

```bash
node tools/sync-spec.js
```

This validates:
- Every mineral has every required field.
- Web embed's `MINERAL_SPEC_FALLBACK` agrees on `max_size_cm` / `thermal_decomp_C` / `nucleation_sigma` / `growth_rate_mult`.
- `docs/` mirrors `web/`.
- Every declared `narrate_function` exists in `vugg.py`.

If you haven't installed Node, the Python CLI will run fine — but push anyway; CI will catch drift.

### 8. Smoke test

**Python CLI** (fast, shows nucleation + growth logs):
```bash
PYTHONIOENCODING=utf-8 python vugg.py --scenario <relevant-scenario> --steps 200 --seed 42
```

**Browser** (necessary — this is what the player sees):
- Start the preview server (`.claude/launch.json` has `vugg-static`).
- Navigate to `localhost:8000/web/index.html`.
- Start a scenario or use Creative mode to dial up the right chemistry.
- Confirm your mineral nucleates, grows, shows correct `class_color` on the topo map, appears in the inventory, gets narrated.

### 9. Sync docs and commit

```bash
cp web/index.html docs/index.html
git add data/minerals.json vugg.py web/index.html docs/index.html
git commit -m "Add <mineral>: <brief what-it-does>"
git push origin main
```

The commit message should explain the geological setting, trigger chemistry, and any unusual habit behavior — this repo's commit log doubles as the design doc.

---

## Recent architecture changes you should know about

Things that weren't in the original codebase and that affect any mineral you add:

### Topographic map (April 2026)
- `WallState` class tracks cells around the vug circumference (120 cells / 1 ring by default, multi-ring data model for future 3D).
- Each cell has `wall_depth` (dissolution erosion), `crystal_id`, `mineral`, `thickness_um`.
- Rendered as an unwrapped circle (view-from-above) with per-cell arc strokes colored by mineral class and radial wedges showing inward growth.
- Dissolution is **per-cell**: acid-resistant crystals shield their slice, unblocked cells erode faster (acid budget conserved).
- Inclusion dots show enclosed crystals inside their host's radial band.

**Implication for new minerals:** your mineral's `acid_dissolution.pH_threshold` determines whether cells it occupies shield the wall. A permanently acid-stable mineral (`acid_dissolution: null`) always shields.

### Growth vector footprint (April 2026)
- Each crystal gets `wall_spread`, `void_reach`, `vector` chosen at nucleation from one of its `habit_variants`.
- Selection scores each variant against current σ, T, and whether the vug is crowded.
- `wall_spread × total_growth × FOOTPRINT_SCALE` (4.0) = arc coverage on the wall.
- `void_reach × total_growth` = inward projection on the topo map.

**Implication for new minerals:** pick `wall_spread`/`void_reach` values that match the real habit. A botryoidal coating should be `wall_spread ≥ 0.7, void_reach ≤ 0.3`. A prismatic tower should be `wall_spread ≤ 0.3, void_reach ≥ 0.8`.

### Enclosure and liberation
- When a growing crystal is 3× larger than an adjacent slower one, it envelops the smaller crystal (`check_enclosure`).
- Candidate must have ≥3 growth zones (otherwise a just-nucleated crystal gets instantly eaten).
- Enclosed crystals don't count against `max_nucleation_count` — new ones can nucleate as old ones are buried.
- Dissolving hosts can free enclosed crystals (`check_liberation`).

**Implication:** don't hand-tune `max_nucleation_count` expecting "this is the max ever." It's the max *currently exposed on the wall*. Runs can accumulate hundreds of inclusions of a species (e.g. Sweetwater-style pyrite-in-calcite — the human collector confirmed 600+ chalcopyrite inclusions in a real MVT calcite twin).

### Radiation damage
- Any quartz near an active (or enclosed — still emitting) uraninite accumulates alpha-dose in its growth zones.
- `avg_radiation_damage > 0.3` reads as smoky; cross-referenced with Al traces.

### Fluid chemistry elements
`FluidChemistry` now tracks 35+ elements. Many default to 0 for ordinary scenarios. Six recent scenario-chemistry updates added Ba/Pb to reactive_wall and Be/Li/B/P to pegmatite — see [48f38d7](https://github.com/Syntaxswine/vugg-simulator/commit/48f38d7). If your mineral needs a new element, add it to the `FluidChemistry` dataclass in `vugg.py` AND the `FluidChemistry` class in `web/index.html`.

---

## Don'ts

1. **Don't invent `class_color` hex values.** Use the 12-hue table. If your mineral doesn't fit a class, ask first.
2. **Don't add a mineral with string-array `habit_variants`.** That format predates the growth-vector system and will skip habit selection entirely. Objects with all five fields.
3. **Don't skip `max_nucleation_count`.** Without it, `_at_nucleation_cap` returns false and enclosure causes runaway.
4. **Don't forget to sync `docs/index.html`.** The live site serves from there.
5. **Don't push to `canonical` remote.** You can't anyway, but also don't try.
6. **Don't tune sim physics in only one runtime.** Python and web must stay behaviorally identical. The `sync-spec.js` drift check catches spec drift but not formula drift.
7. **Don't add scenario-specific mineral behavior.** Nucleation preferences (e.g. "pyrite prefers sphalerite surfaces") go in `check_nucleation`. Scenario chemistry goes in the scenario function. Keep them separate.
8. **Don't remove old inline count caps** (`total_py < 3` etc.) — they're belt-and-braces with `_at_nucleation_cap`. Leave both.

---

## Reference files at a glance

| File | You'll touch it |
|---|---|
| `data/minerals.json` | **Every time** — primary entry. |
| `vugg.py` | **Every time** — `supersaturation_X`, `grow_X`, `_narrate_X`, `check_nucleation`, `nucleate` dispatch, `MINERAL_ENGINES` map. |
| `web/index.html` | **Every time** — mirror all of the above. |
| `docs/index.html` | Copy from `web/` before commit. |
| `agent-api/vugg-agent.js` | Rarely — only if you add a top-level spec field. |
| `proposals/vugg-mineral-template.md` | Reference for habit-variant schema. |
| `proposals/HANDOFF-ADDING-MINERALS.md` | This document. |
| `ARCHITECTURE.md` | Older overview, partially stale (lists 10 minerals; we're at 19+). Useful for mental model of game modes. |
| `tools/sync-spec.js` | Run after any spec change. |

Good luck. If a spec-driven change breaks something unexpectedly, check `git log data/minerals.json` first — the file has been through several phases and some historic commits are instructive.
