# Vugg Mineral Template

Step-by-step reference for adding a new mineral. Covers the spec entry, the two runtimes (`vugg.py` + `web/index.html`), the inline fallback, and the `docs/` mirror. Informed by the 4-mineral Minas Gerais build-out (topaz, tourmaline, beryl, spodumene) — every pattern below has been battle-tested.

Quick map: one new mineral touches **~7 locations** across 3–5 files. The checklist at the bottom is the definitive "did I get everything" list.

## 1. Pick the class and class_color

Class must be one of the 12 established classes. Every mineral inherits its class color — **never invent a new hex**.

| Class | Hex | Existing examples |
|---|---|---|
| `silicate` | `#1313eb` | quartz, feldspar, albite, topaz, tourmaline, beryl, spodumene |
| `carbonate` | `#eb7f13` | calcite, malachite, smithsonite |
| `sulfide` | `#7feb13` | sphalerite, pyrite, chalcopyrite, galena, molybdenite |
| `oxide` | `#eb1313` | hematite, uraninite |
| `sulfate` | `#eb137f` | selenite |
| `phosphate` | `#13eb7f` | *(vanadates fold here — apatite-group structure)* |
| `hydroxide` | `#13ebeb` | goethite |
| `halide` | `#7f13eb` | fluorite |
| `arsenate` | `#13eb13` | adamite, mimetite |
| `molybdate` | `#eb13eb` | wulfenite |
| `native` | `#eb13eb` | *(shares molybdate hue — native elements are rare)* |
| `uranium` | *special, already covered* | |

Wall amber `#D2691E` is reserved for bare wall — never use for a mineral.

## 2. data/minerals.json entry

Reference `_schema` in that file for the full field list. Required beyond the schema fields:

- `class` — one of the 12 above
- `class_color` — hex from the table
- `max_nucleation_count` — per-run cap (typical 2–10; low for rare minerals, higher for minerals that tend to form crusts)
- `nucleation_sigma` — threshold the fluid must cross. Higher = rarer (topaz 1.4, beryl 1.8, common sulfides 1.0)
- `habit_variants` — see §3
- `required_ingredients` — object keyed by **FluidChemistry field names** (not chemical symbols with superscripts). See §4.
- `scenarios` — array of scenario IDs where this mineral can realistically form
- `runtimes_present` — currently `["vugg.py", "web/index.html"]` is acceptable. Skip `agent-api/vugg-agent.js` unless you're also updating it; flag the gap in `_audit_summary.missing_from_agent_api`.

## 3. Habit variants

Each entry in `habit_variants` must be an object with these five fields:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Short habit name. Becomes `crystal.habit`. |
| `wall_spread` | 0.0–1.0 | Lateral arc along the wall. 1.0 = hugs across wide arc; 0.0 = point attachment. |
| `void_reach` | 0.0–1.0 | Projection into the void. 1.0 = long crystal reaching into cavity; 0.0 = wall-flush. |
| `vector` | enum | `"projecting"` / `"coating"` / `"tabular"` / `"equant"` / `"dendritic"`. Drives topo-map rendering and space-scoring. |
| `trigger` | string | Condition phrase. Use the controlled vocabulary below. |

### Required trigger vocabulary

The habit selector (`select_habit_variant` in `vugg.py` / `selectHabitVariant` in `web/index.html`) scans the trigger string for these tokens. Anything else is noise.

- Supersaturation: `"very high σ"`, `"high σ"`, `"moderate-high σ"`, `"moderate σ"`, `"low-moderate σ"`, `"low σ"`.
- Temperature: `"high T"` (> 300°C), `"moderate T"` (150–300°C), `"low T"` (< 150°C).
- Space: `"space-constrained"` (narrative only — the scorer detects crowding itself via `_space_is_crowded()`).
- Fallback: `"default — …"` — gets a +0.3 bonus when nothing else matches strongly.

Free text after tokens is fine for human readability: `"high σ, Fe³⁺ present, nucleation burst"`. The tokens are what the selector actually scores.

### Vector guide

| Vector | wall_spread | void_reach | When to use |
|---|---|---|---|
| `projecting` | ≤ 0.4 | ≥ 0.6 | Prismatic, acicular, needle-like crystals reaching into void. |
| `coating` | ≥ 0.7 | ≤ 0.3 | Botryoidal, druzy, encrusting. |
| `tabular` | 0.3–0.6 | ≤ 0.4 | Flat plates lying against wall (wulfenite, selenite). |
| `equant` | moderate | moderate | Cubes, rhombs, octahedra — balanced. |
| `dendritic` | 0.3–0.9 | 0.4–0.7 | Skeletal, fractal, space-filling. |

The scorer penalizes `projecting` in crowded vugs and rewards `coating`. Keep the vector honest.

### Worked example

From `quartz`:

```json
"habit_variants": [
  {"name": "prismatic",          "vector": "projecting", "wall_spread": 0.2, "void_reach": 0.9,  "trigger": "low σ, steady growth"},
  {"name": "scepter_overgrowth", "vector": "projecting", "wall_spread": 0.3, "void_reach": 0.95, "trigger": "σ pulse after initial prism growth"},
  {"name": "skeletal_fenster",   "vector": "dendritic",  "wall_spread": 0.4, "void_reach": 0.5,  "trigger": "high σ, rapid cooling"},
  {"name": "amethyst_druse",     "vector": "coating",    "wall_spread": 0.8, "void_reach": 0.2,  "trigger": "high σ, Fe³⁺ present, space-constrained"}
]
```

## 4. FluidChemistry field names (gotcha)

`required_ingredients` keys must match `FluidChemistry` attribute names exactly. The field list is in `vugg.py` (~line 137) and the JS `class FluidChemistry` in `web/index.html`. Common traps:

- Silica is `SiO2`, **not `Si`**.
- Carbonate is `CO3`, **not `CO3²⁻`** or `carbonate`.
- Fluorine is `F`, **not `F⁻`**.
- Metals are single-letter or element symbols: `Fe`, `Cu`, `Pb`, `Mn`, `Al`, `Na`, `K`, `Cl`.
- Oxygen fugacity / redox is `O2` (relative scale 0–2, not atmospheric).

Use `trace_ingredients` descriptions for pretty unicode (`"Fe²⁺": "black schorl color"`), but keep the **keys** plain.

## 5. supersaturation_\<mineral\>() — the chemistry gate

Add a method to `VugConditions` in both `vugg.py` and `web/index.html`. Pattern:

```python
def supersaturation_topaz(self) -> float:
    # Hard threshold on gate element — returns 0 below this.
    if self.fluid.F < 20 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
        return 0
    # Cap each factor so pegmatite-level (thousands of ppm) concentrations
    # don't explode sigma into runaway territory.
    al_f = min(self.fluid.Al / 8.0, 2.0)
    si_f = min(self.fluid.SiO2 / 400.0, 1.5)
    f_f  = min(self.fluid.F / 25.0, 1.5)
    sigma = al_f * si_f * f_f
    # Temperature window. Pick from: window / prograde / retrograde / wide.
    T = self.temperature
    if 340 <= T <= 400:      T_factor = 1.0
    elif 300 <= T < 340:     T_factor = 0.6 + 0.01 * (T - 300)
    elif 400 < T <= 500:     T_factor = max(0.2, 1.0 - 0.008 * (T - 400))
    elif 500 < T <= 600:     T_factor = max(0.1, 0.4 - 0.003 * (T - 500))
    else:                    T_factor = 0.1
    sigma *= T_factor
    # Acid penalty — if this mineral has an acid_dissolution threshold,
    # mirror it here so released ions don't immediately regrow it.
    if self.fluid.pH < 2.0:
        sigma -= (2.0 - self.fluid.pH) * 0.4
    return max(sigma, 0)
```

**Key patterns:**

1. **Gate element** — use a hard `< threshold → return 0` check on the essential-ingredient. Without a gate the mineral would "almost" nucleate at trace concentrations.
2. **Factor capping** — `min(fluid / ref, cap)` prevents pegmatite-level fluids (thousands of ppm) from making sigma astronomical. The cap is typically 1.5–2.5.
3. **Temperature window** — use the `T_range_C` + `T_optimum_C` values from your spec. Four regimes: full-window (T_factor = 1.0), below-optimum ramp, above-optimum decay, out-of-range floor (0.1 or 0.2).
4. **Acid penalty consistency** — if the grow engine dissolves the mineral at pH < X, the supersaturation must also be penalized below pH X. Otherwise released ions re-grow the crystal immediately (bug seen in kaolinization fix).

## 6. grow_\<mineral\>(crystal, conditions, step) — the engine

Add a function in both runtimes and register it in the `MINERAL_ENGINES` dict. Pattern:

```python
def grow_topaz(crystal, conditions, step):
    sigma = conditions.supersaturation_topaz()

    # --- Dissolution branch (only if the mineral has an acid path) ---
    if sigma < 1.0:
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.04)
            # Release ions back to fluid STOICHIOMETRICALLY. If the mineral
            # transforms to a new phase (like feldspar → kaolinite) that
            # retains some ions, use partition < 0.1 for those.
            conditions.fluid.Al += dissolved_um * 0.3
            conditions.fluid.SiO2 += dissolved_um * 0.2
            conditions.fluid.F += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"dissolution (pH {conditions.fluid.pH:.1f}) — Al³⁺, SiO₂, F⁻ released"
            )
        return None

    # --- Growth branch ---
    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)   # µm/step
    if rate < 0.1:
        return None

    # Pick variety / color from current fluid composition. Write the
    # variety into zone note so _narrate_<mineral> can read it later.
    # Set crystal.habit to the variety name.
    if conditions.fluid.Cr > 3.0:
        color_note = f"imperial golden-orange (Cr³⁺ {conditions.fluid.Cr:.1f} ppm)"
        crystal.habit = "prismatic_imperial"
    else:
        color_note = "colorless to water-clear"

    # Update dominant_forms based on T regime.
    if conditions.temperature > 450:
        crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "stubby"]
    else:
        crystal.dominant_forms = ["m{110} prism", "steep {021}+{041} pyramids", "c{001} basal cleavage"]

    # Trace element incorporation (for predict_color averaging)
    trace_Fe = conditions.fluid.Fe * 0.008
    trace_Al = conditions.fluid.Al * 0.02
    trace_Ti = conditions.fluid.Ti * 0.015

    # Deplete fluid — this is what drives paragenesis. Without depletion
    # every mineral grows forever.
    conditions.fluid.Al = max(conditions.fluid.Al - rate * 0.015, 0)
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2 - rate * 0.012, 0)
    conditions.fluid.F = max(conditions.fluid.F - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al, trace_Ti=trace_Ti,
        note=color_note
    )
```

**Key patterns:**

1. **Depletion rates** — typically 0.005–0.025 per µm growth for the main ingredients. Pegmatite-level concentrations deplete fast with 0.02; trace fluids stay stable longer at 0.008.
2. **Color / variety notes** — write them into `zone.note` as substrings the narrator can search (`"pale blue"`, `"imperial golden"`, etc.). This is how `_narrate_<mineral>` can tell which varieties appeared.
3. **Pseudomorphic / transformed dissolution** — if the mineral converts to a new phase (like kaolinite) that retains some ions, use small partition (~0.05) for those retained ions. See `grow_feldspar` kaolinization.
4. **Register in `MINERAL_ENGINES`** at the bottom of the engines block in both runtimes.

## 7. nucleate() dominant_forms dispatch

In both `VugSimulator.nucleate()` (vugg.py) and `nucleate()` (web/index.html), add an `elif` branch assigning `crystal.dominant_forms = [...]` for your mineral. This runs once at nucleation; the grow engine may overwrite later based on T/σ.

## 8. check_nucleation block

Both runtimes have a `check_nucleation()` method on `VugSimulator`. Add a block at the bottom. Pattern:

```python
# Topaz nucleation — Al + SiO₂ + F (F-gated, σ > 1.4).
sigma_tpz = self.conditions.supersaturation_topaz()
existing_tpz = [c for c in self.crystals if c.mineral == "topaz" and c.active]
if sigma_tpz > 1.4 and not self._at_nucleation_cap("topaz"):
    if not existing_tpz or (sigma_tpz > 2.0 and random.random() < 0.3):
        pos = "vug wall"
        # Substrate preference — paragenesis
        if existing_quartz and random.random() < 0.5:
            pos = f"on quartz #{existing_quartz[0].crystal_id}"
        c = self.nucleate("topaz", position=pos, sigma=sigma_tpz)
        self.log.append(f"  ✦ NUCLEATION: Topaz #{c.crystal_id} on {c.position} ...")
```

**Key patterns:**

1. **σ gate** matches `nucleation_sigma` from the spec.
2. **`_at_nucleation_cap`** reads `max_nucleation_count` from the spec — always respect it.
3. **Existing-check + rare extra nucleation** — `not existing OR (high σ AND random chance)`. Keeps the vug from spawning a single species in every step.
4. **Substrate preference** — use `f"on <mineral> #<id>"` position strings for paragenetic overgrowths. The topo renderer inherits the host's wall cell.
5. **Log a variety tag** when the mineral has color/variety flavors so the log tells the story.

## 9. _narrate_\<mineral\>(c) — the voice

Add a method on `VugSimulator`. Called from the narrator dispatcher (`getattr(self, f"_narrate_{c.mineral}", None)`) — zero wiring needed, just needs to exist. Read `c.zones[*].note` to detect which varieties appeared across the crystal's life. Pattern:

```python
def _narrate_topaz(self, c):
    parts = [f"Topaz #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
    # 1-paragraph chemistry/structure blurb
    parts.append("Al₂SiO₄(F,OH)₂ — orthorhombic nesosilicate...")
    # Detect varieties from zone notes
    if any("imperial golden" in (z.note or "") for z in c.zones):
        parts.append("Imperial golden-orange — Cr³⁺ substituting for Al³⁺...")
    # Notes on inclusions, twinning, phantoms, dissolution
    if c.dissolved:
        parts.append("Strong acid attack etched the surface...")
    return " ".join(parts)
```

## 10. MINERAL_SPEC_FALLBACK (web only)

In `web/index.html`, add a one-liner to the `MINERAL_SPEC_FALLBACK` object (before the `_loadSpec` fetch). This is what renders the Library UI if `data/minerals.json` fails to fetch:

```js
topaz: { formula: "Al2SiO4(F,OH)2", nucleation_sigma: 1.4, max_size_cm: 200, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
```

## 11. UI hooks (scenario-specific minerals only)

If the mineral is tied to a new scenario, add:
- A button in the Scenarios panel (`<button onclick="startScenarioInCreative('scenario_id')">...</button>`)
- An option in the Legends-mode `<select id="scenario">` dropdown
- A description line in the output-panel welcome text

Not needed for minerals that grow in existing scenarios based purely on chemistry.

## 12. docs/ mirror

Run `cp web/index.html docs/index.html` and `cp data/minerals.json docs/data/minerals.json` after finishing. GitHub Pages serves `docs/`.

## 13. Verification

```bash
# Python syntax
python -c "import vugg; print('ok')"

# JS syntax
node -e "const fs=require('fs'); const h=fs.readFileSync('web/index.html','utf8'); const s=h.indexOf('<script>'), e=h.lastIndexOf('</script>'); new Function(h.slice(s+8,e)); console.log('ok');"

# Drift check across all 4 runtimes
node tools/sync-spec.js

# Smoke-test all scenarios
python -c "
import random, vugg
for name in vugg.SCENARIOS:
    if name == 'random': continue
    random.seed(42)
    conds, events, steps = vugg.SCENARIOS[name]()
    sim = vugg.VugSimulator(conds, events)
    for _ in range(steps): sim.run_step()
    mins = sorted(set(c.mineral for c in sim.crystals))
    print(f'{name:>22}: {len(sim.crystals):3d} crystals, {len(mins):2d} species | {mins}')
"
```

## 14. Common traps (things the 4-mineral Minas Gerais build learned the hard way)

1. **Pegmatite-fluid runaway sigma** — without factor caps, Al=150 + SiO2=8000 produces sigma=40+. Always cap with `min(value/ref, cap)`.
2. **Floating-point edge on hard thresholds** — `Al < 3` with Al=2.998 is True. Either widen the threshold (`< 2`) or ensure the scenario keeps ingredients well above the gate.
3. **pH penalty asymmetry** — if a mineral dissolves at pH < X, its supersaturation must also drop below pH X. Otherwise released ions re-grow the crystal immediately (see kaolinization fix).
4. **Implicit-sink chemistry** — when a mineral transforms to a phase the sim doesn't track (feldspar → kaolinite), use small (~0.05) partition for conserved ions. Not 0.2 or 0.3.
5. **Silicate-wall scenarios** — set `wall=VugWall(composition="pegmatite", ...)` or similar. The default `limestone` wall buffers acid (pH_recovery = 0.8 × rate_mm) which breaks kaolinization events.
6. **Scenario-name "scenarios" field ≠ nucleation gate** — the `scenarios` array in the spec is documentation. If your mineral's chemistry fires in other scenarios, that's not a bug — update the `scenarios` array to be honest.
7. **Competition math** — multiple silicates drawing on the same Al pool deplete fast. Either boost starting Al or expect smaller crystals.
8. **Narrative ≠ simulation** — don't write flavor text describing mechanics the sim doesn't have. If you want "feldspar breaking down releases Al" to be real, you need the crystal to actually dissolve (not just `cond.fluid.Al += 12`).

## 15. Master checklist

For a new mineral, the following files are touched:

- [ ] `data/minerals.json` — new top-level entry under `minerals`, `_audit_summary.total_minerals` bumped, `_audit_summary.scenarios_that_can_nucleate` updated.
- [ ] `vugg.py`:
  - [ ] `supersaturation_<mineral>()` method on `VugConditions`
  - [ ] `grow_<mineral>()` function + `MINERAL_ENGINES` registry
  - [ ] `dominant_forms` dispatch in `nucleate()`
  - [ ] `_narrate_<mineral>()` method on `VugSimulator`
  - [ ] Nucleation block in `check_nucleation()`
- [ ] `web/index.html` — all 5 of the above mirrored, plus:
  - [ ] `MINERAL_SPEC_FALLBACK` entry
  - [ ] UI button / dropdown option (if scenario-specific)
- [ ] `docs/index.html` — cp from web/index.html
- [ ] `docs/data/minerals.json` — cp from data/minerals.json
- [ ] `tools/sync-spec.js` passes (0 drift)
- [ ] All scenarios smoke-test produces expected assemblages

Commit and push to Syntaxswine (origin). Do **not** push to `canonical` — StonePhilosopher is read-only from this machine; the user's boss reviews and promotes.
