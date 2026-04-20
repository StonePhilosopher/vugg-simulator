# Vugg Mineral Template

Reference for declaring a new mineral in `data/minerals.json`. Every field in the `_schema` block is required; the growth-vector fields below are required on **every** habit variant.

## Top-level mineral record

See `data/minerals.json#_schema` for the authoritative field list. Beyond the template fields, every mineral must declare:

- `class` — one of: `oxide`, `carbonate`, `arsenate`, `sulfide`, `uranium`, `phosphate`, `hydroxide`, `molybdate`, `silicate`, `halide`, `native`, `sulfate`.
- `class_color` — the mineral's visualization hex (pulled from the 12-hue wheel in the topo-map palette; do not invent ad-hoc hex values).
- `max_nucleation_count` — per-run cap on how many crystals of this species may ever nucleate.
- `habit_variants` — array of habit objects (see next section).

## Habit variant schema

Each entry in `habit_variants` must be an object with these five fields:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Short habit name (e.g. `"prismatic"`, `"scepter_overgrowth"`). Sets `crystal.habit`. |
| `wall_spread` | number 0.0–1.0 | Lateral spread along the vug wall surface. 1.0 = hugs the wall across a wide arc; 0.0 = point attachment. |
| `void_reach` | number 0.0–1.0 | Projection into the vug interior. 1.0 = long crystal reaching far into the cavity; 0.0 = stays flush with wall. |
| `vector` | enum string | One of `"projecting"`, `"coating"`, `"tabular"`, `"equant"`, `"dendritic"`. The categorical growth style — drives topo-map thickness and space-vs-vector scoring. |
| `trigger` | string | Condition phrase the habit selector matches against. Use the controlled vocabulary below so scoring works. |

### Required trigger vocabulary

The habit selector (`select_habit_variant` in `vugg.py` / `selectHabitVariant` in `web/index.html`) scans the trigger string for these tokens. Use them (alone or combined) so your habit can actually be chosen:

- Supersaturation: `"very high σ"`, `"high σ"`, `"moderate-high σ"`, `"moderate σ"`, `"low-moderate σ"`, `"low σ"`.
- Temperature: `"high T"` (> 300°C), `"moderate T"` (150–300°C), `"low T"` (< 150°C).
- Fallback: `"default — …"` — used when no other habit scores well.

Additional free-text after the tokens is fine for human readability (e.g. `"high σ, Fe³⁺ present, space-constrained"`), but the tokens are what the selector sees. A habit with no recognized token will only ever be picked as a random tiebreaker.

### Vector guide

| Vector | wall_spread | void_reach | When to use |
|---|---|---|---|
| `projecting` | low (≤ 0.4) | high (≥ 0.6) | Prismatic, acicular, needle-like crystals reaching into the void. |
| `coating` | high (≥ 0.7) | low (≤ 0.3) | Botryoidal, druzy, encrusting growths that hug the wall. |
| `tabular` | moderate (0.3–0.6) | low (≤ 0.4) | Flat plates lying against the wall (wulfenite, selenite blades). |
| `equant` | moderate | moderate | Cubes, rhombs — roughly balanced in both directions. |
| `dendritic` | high | moderate | Skeletal, fractal, space-filling (skeletal quartz, manganese dendrites). |

The scorer penalizes `projecting` variants when the vug is crowded and rewards `coating` — keep the vector honest so your mineral behaves sensibly under space pressure.

## Example

From `quartz` in `data/minerals.json`:

```json
"habit_variants": [
  {"name": "prismatic",           "vector": "projecting", "wall_spread": 0.2, "void_reach": 0.9,  "trigger": "low σ, steady growth"},
  {"name": "scepter_overgrowth",  "vector": "projecting", "wall_spread": 0.3, "void_reach": 0.95, "trigger": "σ pulse after initial prism growth"},
  {"name": "skeletal_fenster",    "vector": "dendritic",  "wall_spread": 0.4, "void_reach": 0.5,  "trigger": "high σ, rapid cooling"},
  {"name": "amethyst_druse",      "vector": "coating",    "wall_spread": 0.8, "void_reach": 0.2,  "trigger": "high σ, Fe³⁺ present, space-constrained"}
]
```

At low σ the spiral-growth prism wins; pulse σ unlocks scepter overgrowths; rapid cooling drives skeletal fenster; if the vug is crowded and Fe is present, amethyst druse coats the remaining space.

## Checklist for a new mineral PR

- [ ] 2–6 `habit_variants`, each with all five fields.
- [ ] At least one habit has `"default — …"` trigger as the safety net.
- [ ] `class` matches one of the 12 classes in the topo-map palette.
- [ ] `class_color` matches the hex for that class (don't pick a new hue).
- [ ] `max_nucleation_count` set (typical range: 2–10).
- [ ] Grow engine in `vugg.py` + `web/index.html` + `agent-api/vugg-agent.js`.
- [ ] `_narrate_<mineral>` method present in both runtimes.
- [ ] Entry in `_audit_summary.scenarios_that_can_nucleate` if scenario-gated.
