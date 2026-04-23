#!/usr/bin/env python3
"""new-mineral.py — scaffold a new mineral entry across all the places it needs to live.

Generates:
  1. data/minerals.json: a complete spec entry skeleton (auto-inserted)
  2. tools/_NEW_<name>.md: Python + JS code stubs to paste into vugg.py + web/index.html

Then prints a checklist of:
  - files to mirror (docs/ from web/)
  - line-by-line paste instructions
  - tests to run (pytest + sync-spec)

Designed to drop new-mineral authoring from ~30 min → ~5 min:
  - JSON entry: 100% generated (was 5 min of typing)
  - Python supersaturation_X: 90% generated (paste + fill chemistry)
  - Python grow_X: 90% generated
  - JS mirrors: 90% generated
  - Test discovery: 100% automatic (paramaterized tests pick up the new
    JSON entry; commit 2 + 4 already cover it)
  - Drift check: 100% automatic (sync-spec.js + the new JSON-mirror check)

USAGE:
    python tools/new-mineral.py \\
      --name barite \\
      --formula "BaSO4" \\
      --class sulfate \\
      --required "Ba=5,S=10,O2=0.1" \\
      --scenarios mvt,porphyry \\
      [--T-range 5,500] [--T-optimum 50,200] \\
      [--redox oxidizing] \\
      [--idle-color "#eb137f"] \\
      [--narrate]   # generate _narrate_<name> stub too

Quick example:
    python tools/new-mineral.py \\
      --name halite \\
      --formula NaCl \\
      --class halide \\
      --required "Na=20,Cl=30" \\
      --scenarios sabkha_dolomitization \\
      --T-range 0,100 --T-optimum 5,40 \\
      --redox any --narrate
"""
import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Per template §1, the 12 valid classes + their canonical class_color
CLASS_COLORS = {
    "silicate":  "#1313eb",
    "carbonate": "#eb7f13",
    "sulfide":   "#7feb13",
    "oxide":     "#eb1313",
    "sulfate":   "#eb137f",
    "phosphate": "#13eb7f",
    "hydroxide": "#13ebeb",
    "halide":    "#7f13eb",
    "arsenate":  "#13eb13",
    "molybdate": "#eb13eb",
    "native":    "#eb13eb",  # shares molybdate hue
    "uranium":   "#44dd44",  # special
}


def parse_required(s):
    """Parse 'Ba=5,S=10,O2=0.1' → {'Ba': 5.0, 'S': 10.0, 'O2': 0.1}."""
    out = {}
    if not s:
        return out
    for pair in s.split(","):
        k, v = pair.strip().split("=")
        out[k.strip()] = float(v) if "." in v or "e" in v.lower() else int(v)
    return out


def parse_pair(s):
    """Parse '5,500' → [5, 500] (or float pair)."""
    if not s:
        return None
    a, b = s.split(",")
    a, b = a.strip(), b.strip()
    return [
        float(a) if "." in a else int(a),
        float(b) if "." in b else int(b),
    ]


def parse_csv_list(s):
    """Parse 'mvt,porphyry' → ['mvt', 'porphyry']."""
    return [x.strip() for x in s.split(",") if x.strip()]


def build_json_entry(args):
    """Construct the data/minerals.json entry skeleton."""
    # Allowed scenarios — load from vugg to validate at scaffold time
    sys.path.insert(0, str(REPO))
    import vugg
    real_scenarios = set(vugg.SCENARIOS) - {"random"}
    bad = [s for s in args.scenarios if s not in real_scenarios]
    if bad:
        sys.exit(f"ERROR: unknown scenarios {bad}. Valid: {sorted(real_scenarios)}")

    entry = {
        "formula": args.formula,
        "nucleation_sigma": args.nucleation_sigma,
        "max_nucleation_count": args.max_nucleation_count,
        "max_size_cm": args.max_size_cm,
        "growth_rate_mult": args.growth_rate_mult,
        "habit_variants": [
            {
                "name": "default_habit",
                "wall_spread": 0.4,
                "void_reach": 0.5,
                "vector": "projecting",
                "trigger": f"default — TODO: describe the standard habit of {args.name}",
            },
            {
                "name": "high_sigma_habit",
                "wall_spread": 0.7,
                "void_reach": 0.3,
                "vector": "coating",
                "trigger": "high σ — TODO: describe the rapid-growth habit",
            },
        ],
        "class": args.cls,
        "description": (
            f"{args.formula} — TODO: 2-3 sentence identity blurb "
            f"covering color/habit/class/significance. Cite a source "
            f"for any geological claims."
        ),
        "scenarios": args.scenarios,
        "T_range_C": args.T_range,
        "T_optimum_C": args.T_optimum,
        "T_behavior": "window",
        "pH_dissolution_below": args.pH_below,
        "pH_dissolution_above": args.pH_above,
        "redox_requirement": args.redox,
        "required_ingredients": args.required,
        "trace_ingredients": {},
        "thermal_decomp_C": args.thermal_decomp_C,
        "thermal_decomp_reaction": (
            f"TODO: describe decomposition reaction at {args.thermal_decomp_C}°C"
            if args.thermal_decomp_C else None
        ),
        "thermal_decomp_products": {},
        "fluorescence": None,
        "twin_laws": [],
        "acid_dissolution": (
            {
                "pH_threshold": args.pH_below,
                "reaction": f"TODO: describe acid dissolution products and pH gate",
                "products": {},
                "status": "newly_added",
            }
            if args.pH_below else None
        ),
        "habit": "default_habit",
        "color_rules": {
            "default_color": {"default": True},
        },
        "narrate_function": f"_narrate_{args.name}" if args.narrate else None,
        "runtimes_present": ["vugg.py", "web/index.html"],
        "audit_status": (
            f"phase-2: scaffolded by tools/new-mineral.py. TODO: replace "
            f"this audit_status string with full citation + scenario "
            f"realization notes once the engine is implemented."
        ),
        "class_color": CLASS_COLORS.get(args.cls, "#888888"),
    }
    return entry


def insert_json_entry(args, entry):
    """Append the entry to data/minerals.json + docs/data/minerals.json."""
    spec_path = REPO / "data" / "minerals.json"
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)
    if args.name in spec["minerals"]:
        sys.exit(
            f"ERROR: {args.name!r} already exists in data/minerals.json. "
            f"To overwrite, manually delete the entry first."
        )
    spec["minerals"][args.name] = entry
    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
    # Mirror to docs
    docs_spec_path = REPO / "docs" / "data" / "minerals.json"
    with open(docs_spec_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
    return spec_path, docs_spec_path


def gen_python_stubs(args):
    """Generate Python supersaturation, grow, dispatch, narrate, decomp stubs."""
    name = args.name
    required = args.required
    gates = " or ".join(
        f"self.fluid.{k} < {v}" for k, v in required.items()
    ) or "False  # TODO: gate condition"

    redox_gate = ""
    if args.redox in ("reducing", "strongly_reducing"):
        redox_gate = "        if self.fluid.O2 > 0.5:\n            return 0  # sulfide/native — needs reducing\n"
    elif args.redox in ("oxidizing", "strongly_oxidizing"):
        if "O2" not in required:
            redox_gate = "        if self.fluid.O2 < 0.5:\n            return 0  # oxide/sulfate — needs oxidizing\n"

    formula_str = ", ".join(f"min(self.fluid.{k} / {float(v) * 5:.1f}, 2.5)" for k, v in required.items())
    sigma_expr = " * ".join(f"min(self.fluid.{k} / {float(v) * 5:.1f}, 2.5)" for k, v in required.items()) or "1.0"

    T_window = ""
    if args.T_optimum:
        lo, hi = args.T_optimum
        T_window = f"""        # T window — peak {lo}-{hi}°C per spec
        if {lo} <= self.temperature <= {hi}:
            sigma *= 1.2
        elif self.temperature < {lo}:
            sigma *= max(0.3, 1.0 - 0.01 * ({lo} - self.temperature))
        elif self.temperature > {hi}:
            sigma *= max(0.3, 1.0 - 0.01 * (self.temperature - {hi}))
"""

    pH_window = ""
    if args.pH_above is not None:
        pH_window += f"""        if self.fluid.pH > {args.pH_above}:
            return 0  # dissolves above pH {args.pH_above}
"""
    if args.pH_below is not None and args.pH_above is None:
        pH_window += f"""        if self.fluid.pH < {args.pH_below}:
            return 0  # dissolves below pH {args.pH_below}
"""

    supersat = f'''    def supersaturation_{name}(self) -> float:
        """{name.title()} ({args.formula}) — TODO: 2-3 sentence chemistry/geology context.

        TODO: cite source(s).
        """
        if {gates}:
            return 0
{redox_gate}{pH_window}        sigma = {sigma_expr}
{T_window}        return max(sigma, 0)
'''

    deplete_lines = "\n".join(
        f"    conditions.fluid.{k} = max(conditions.fluid.{k} - rate * 0.005, 0)"
        for k in required if k != "O2"
    )

    grow = f'''def grow_{name}(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """{name.title()} ({args.formula}) growth. TODO: habit description."""
    sigma = conditions.supersaturation_{name}()

    if sigma < 1.0:
        # TODO: dissolution branch if applicable (acid-side or alkaline-side)
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # TODO: habit selection by σ excess
    if excess > 1.0:
        crystal.habit = "high_sigma_habit"
        crystal.dominant_forms = ["TODO"]
        habit_note = f"high-σ habit"
    else:
        crystal.habit = "default_habit"
        crystal.dominant_forms = ["TODO"]
        habit_note = f"default habit of {name}"

    # Deplete required ingredients
{deplete_lines}

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )
'''

    dispatch = f'    "{name}": grow_{name},'

    nucleation = f'''        # {name.title()} nucleation — TODO: describe substrate preferences
        sigma_{name[:3]} = self.conditions.supersaturation_{name}()
        if sigma_{name[:3]} > {args.nucleation_sigma} and not self._at_nucleation_cap("{name}"):
            if random.random() < 0.18:
                pos = "vug wall"
                # TODO: substrate-preference logic
                c = self.nucleate("{name}", position=pos, sigma=sigma_{name[:3]})
                self.log.append(f"  ✦ NUCLEATION: {name.title()} #{{c.crystal_id}} on {{c.position}} "
                              f"(T={{self.conditions.temperature:.0f}}°C, σ={{sigma_{name[:3]}:.2f}})")
'''

    narrate_stub = ""
    if args.narrate:
        narrate_stub = f'''
    def _narrate_{name}(self, c: Crystal) -> str:
        """Narrate a {name} crystal — TODO: identity blurb."""
        parts = [f"{name.title()} #{{c.crystal_id}} grew to {{c.c_length_mm:.1f}} mm."]
        parts.append(
            "{args.formula} — TODO: 1-paragraph chemistry/structure/significance."
        )
        # TODO: habit-specific paragraphs
        # TODO: dissolution / inclusion / twin notes
        return " ".join(parts)
'''

    thermal_decomp = ""
    if args.thermal_decomp_C:
        prods = ", ".join(f'"{k}": 0.4' for k in required if k != "O2")
        thermal_decomp = f'    "{name}": ({args.thermal_decomp_C}, "TODO: decomp reaction", {{{prods}}}),'

    return {
        "supersaturation": supersat,
        "grow": grow,
        "dispatch": dispatch,
        "nucleation": nucleation,
        "narrate": narrate_stub,
        "thermal_decomp": thermal_decomp,
    }


def gen_js_stubs(args):
    """Generate JS supersaturation, grow, dispatch, MINERAL_SPEC, IDLE_COLOR stubs."""
    name = args.name
    required = args.required
    gates = " || ".join(f"this.fluid.{k} < {v}" for k, v in required.items()) or "false"
    sigma_expr = " * ".join(f"Math.min(this.fluid.{k} / {float(v)*5:.1f}, 2.5)" for k, v in required.items()) or "1.0"

    redox_gate = ""
    if args.redox in ("reducing", "strongly_reducing"):
        redox_gate = "    if (this.fluid.O2 > 0.5) return 0;\n"
    elif args.redox in ("oxidizing", "strongly_oxidizing") and "O2" not in required:
        redox_gate = "    if (this.fluid.O2 < 0.5) return 0;\n"

    T_window = ""
    if args.T_optimum:
        lo, hi = args.T_optimum
        T_window = f"""    if (this.temperature >= {lo} && this.temperature <= {hi}) {{
      sigma *= 1.2;
    }} else if (this.temperature < {lo}) {{
      sigma *= Math.max(0.3, 1.0 - 0.01 * ({lo} - this.temperature));
    }} else {{
      sigma *= Math.max(0.3, 1.0 - 0.01 * (this.temperature - {hi}));
    }}
"""

    pH_window = ""
    if args.pH_above is not None:
        pH_window += f"    if (this.fluid.pH > {args.pH_above}) return 0;\n"
    if args.pH_below is not None and args.pH_above is None:
        pH_window += f"    if (this.fluid.pH < {args.pH_below}) return 0;\n"

    supersat = f'''  // {name.title()} ({args.formula}) — TODO: chemistry/geology context.
  supersaturation_{name}() {{
    if ({gates}) return 0;
{redox_gate}{pH_window}    let sigma = {sigma_expr};
{T_window}    return Math.max(sigma, 0);
  }}'''

    deplete_lines = "\n".join(
        f"  conditions.fluid.{k} = Math.max(conditions.fluid.{k} - rate * 0.005, 0);"
        for k in required if k != "O2"
    )

    grow = f'''// {name.title()} — {args.formula}
// TODO: 1-line habit description
function grow_{name}(crystal, conditions, step) {{
  const sigma = conditions.supersaturation_{name}();
  if (sigma < 1.0) return null;  // TODO: dissolution branch if applicable

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.0) {{
    crystal.habit = 'high_sigma_habit';
    crystal.dominant_forms = ['TODO'];
    habit_note = 'high-σ habit';
  }} else {{
    crystal.habit = 'default_habit';
    crystal.dominant_forms = ['TODO'];
    habit_note = 'default habit of {name}';
  }}

{deplete_lines}

  return new GrowthZone({{
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  }});
}}'''

    dispatch = f"  {name}: grow_{name},"

    # MINERAL_SPEC_FALLBACK one-liner
    fluorescence = "null"
    twins = "[]"
    acid = (
        f'{{ pH_threshold: {args.pH_below or args.pH_above} }}'
        if args.pH_below or args.pH_above else 'null'
    )
    spec_fallback = (
        f'  {name}: {{ formula: "{args.formula}", '
        f'nucleation_sigma: {args.nucleation_sigma}, '
        f'max_size_cm: {args.max_size_cm}, '
        f'growth_rate_mult: {args.growth_rate_mult}, '
        f'thermal_decomp_C: {args.thermal_decomp_C or "null"}, '
        f'fluorescence: {fluorescence}, '
        f'twin_laws: {twins}, '
        f'acid_dissolution: {acid} }},'
    )

    nucleation = f'''    // {name.title()} nucleation — TODO: substrate preferences
    const sigma_{name[:3]} = this.conditions.supersaturation_{name}();
    if (sigma_{name[:3]} > {args.nucleation_sigma} && !this._atNucleationCap('{name}')) {{
      if (rng.random() < 0.18) {{
        const c = this.nucleate('{name}', 'vug wall', sigma_{name[:3]});
        this.log.push(`  ✦ NUCLEATION: {name.title()} #${{c.crystal_id}} on ${{c.position}} (σ=${{sigma_{name[:3]}.toFixed(2)}})`);
      }}
    }}'''

    idle_color_entry = f"  {name}: '{args.idle_color}',  // TODO: pick a representative color"

    return {
        "supersaturation": supersat,
        "grow": grow,
        "dispatch": dispatch,
        "spec_fallback": spec_fallback,
        "nucleation": nucleation,
        "idle_color": idle_color_entry,
    }


def write_stubs_file(args, py_stubs, js_stubs):
    """Write a markdown file with all stubs + paste instructions."""
    out_path = REPO / "tools" / f"_NEW_{args.name}.md"
    name = args.name
    contents = f"""# Scaffold for new mineral: `{name}` ({args.formula})

Generated by `tools/new-mineral.py`. Paste each section into the indicated
location, fill in the TODOs, then run validation.

**JSON entry**: ✅ Already inserted into `data/minerals.json` and
`docs/data/minerals.json` by the scaffold tool. Open and customize the
TODO comments (description, audit_status, habit_variants, etc.).

---

## 1. Python — `vugg.py`

### 1a. Add `supersaturation_{name}` method on `VugConditions`
Find the `class VugConditions:` block. Paste this method anywhere inside,
near other `supersaturation_*` methods (search: `def supersaturation_`).

```python
{py_stubs["supersaturation"]}```

### 1b. Add `grow_{name}` function
Find an existing `def grow_<other>(crystal, conditions, step)` function
(search: `def grow_quartz`). Paste this function nearby (not inside a class).

```python
{py_stubs["grow"]}```

### 1c. Register in `MINERAL_ENGINES` dispatch dict
Find: `MINERAL_ENGINES = {{` (one line, dict literal). Add this entry inside:

```python
{py_stubs["dispatch"]}
```

### 1d. Add nucleation block in `check_nucleation` method
Find: `def check_nucleation(self):` on `VugSimulator`. Paste this near the
end of the method's body (with other `sigma_X = ...` blocks).

```python
{py_stubs["nucleation"]}```

{"### 1e. Add `_narrate_" + name + "` method on `VugSimulator`" if py_stubs["narrate"] else ""}
{"Find the `class VugSimulator:` block. Paste near other `_narrate_*` methods (search: `def _narrate_`)." if py_stubs["narrate"] else ""}

{"```python" + py_stubs["narrate"] + "```" if py_stubs["narrate"] else ""}

{"### 1f. Add to `THERMAL_DECOMPOSITION` dict (optional)" if py_stubs["thermal_decomp"] else ""}
{"Find: `THERMAL_DECOMPOSITION = {`. Add this entry:" if py_stubs["thermal_decomp"] else ""}

{"```python\n" + py_stubs["thermal_decomp"] + "\n```" if py_stubs["thermal_decomp"] else ""}

---

## 2. JavaScript — `web/index.html`

### 2a. Add `supersaturation_{name}` to `VugConditions` JS class
Find: `supersaturation_quartz()` (the JS class method). Paste below or
near it.

```javascript
{js_stubs["supersaturation"]}
```

### 2b. Add `grow_{name}` JS function
Find: `function grow_quartz(crystal, conditions, step)`. Paste nearby.

```javascript
{js_stubs["grow"]}
```

### 2c. Add to JS `MINERAL_ENGINES` dict
Find: `const MINERAL_ENGINES = {{` in JS. Add this entry:

```javascript
{js_stubs["dispatch"]}
```

### 2d. Add nucleation block in `check_nucleation` JS method
Find: `check_nucleation()` on the JS VugSimulator class. Paste near the
end of the method's body.

```javascript
{js_stubs["nucleation"]}
```

### 2e. Add to `MINERAL_SPEC_FALLBACK`
Find: `const MINERAL_SPEC_FALLBACK = {{` (~line 3060 in web/index.html).
Add this one-liner inside:

```javascript
{js_stubs["spec_fallback"]}
```

### 2f. Add to `IDLE_MINERAL_COLORS` (TWO occurrences in the file!)
Find: `IDLE_MINERAL_COLORS = {{` — appears at TWO line numbers in
web/index.html. Add this entry to BOTH (or use sed):

```javascript
{js_stubs["idle_color"]}
```

---

## 3. Mirror to `docs/`

```bash
cp web/index.html docs/index.html
# (data/minerals.json was already mirrored to docs/data/ by the tool)
```

---

## 4. Validate

```bash
python -m pytest                    # all 754 tests should pass + ~8 new ones
node tools/sync-spec.js             # 0 drift
python -c "import vugg; print('SIM:', vugg.SIM_VERSION, 'engines:', len(vugg.MINERAL_ENGINES))"
```

If new tests fail (`tests/test_engine_gates.py::test_fires_with_favorable_fluid[{name}]`),
your supersaturation_{name} has hidden gates not in the spec
required_ingredients. Either fix the engine to match the spec, or update
the spec to match the engine.

---

## 5. Bump SIM_VERSION + regenerate baseline (if scenario output shifts)

If the new mineral fires in any existing scenario, seed-42 output will
shift. Bump SIM_VERSION in `vugg.py` + `web/index.html`, then:

```bash
python tests/gen_baselines.py    # captures the new seed-42 baseline
git add tests/baselines/seed42_v<N>.json
```

Commit with a message documenting which scenarios shifted and how.

---

## 6. Delete this file when done

```bash
rm tools/_NEW_{name}.md
```
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(contents)
    return out_path


def main():
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--name", required=True, help="Lowercase mineral name (used in code)")
    p.add_argument("--formula", required=True, help="Chemical formula, e.g. 'BaSO4'")
    p.add_argument("--class", dest="cls", required=True, choices=sorted(CLASS_COLORS),
                   help="One of the 12 valid classes")
    p.add_argument("--required", default="",
                   help="Required ingredients, e.g. 'Ba=5,S=10,O2=0.1'")
    p.add_argument("--scenarios", required=True, type=parse_csv_list,
                   help="Comma-separated scenario IDs, e.g. 'mvt,porphyry'")
    p.add_argument("--T-range", dest="T_range", type=parse_pair,
                   default=[5, 500], help="T_range_C as 'low,high'")
    p.add_argument("--T-optimum", dest="T_optimum", type=parse_pair,
                   default=[20, 200], help="T_optimum_C as 'low,high'")
    p.add_argument("--redox", default="any",
                   choices=["strongly_reducing", "reducing", "mildly_reducing",
                            "tolerant_both", "any", "oxidizing", "strongly_oxidizing"])
    p.add_argument("--pH-below", dest="pH_below", type=float, default=None,
                   help="pH_dissolution_below threshold")
    p.add_argument("--pH-above", dest="pH_above", type=float, default=None,
                   help="pH_dissolution_above threshold")
    p.add_argument("--nucleation-sigma", type=float, default=1.0)
    p.add_argument("--max-nucleation-count", type=int, default=4)
    p.add_argument("--max-size-cm", type=float, default=10)
    p.add_argument("--growth-rate-mult", type=float, default=0.3)
    p.add_argument("--thermal-decomp-C", type=int, default=None)
    p.add_argument("--idle-color", default="#888888",
                   help="Color for IDLE_MINERAL_COLORS legend (hex)")
    p.add_argument("--narrate", action="store_true",
                   help="Generate _narrate_<name> method stub")
    args = p.parse_args()

    args.required = parse_required(args.required)

    print(f"Scaffolding new mineral: {args.name} ({args.formula}, {args.cls})")
    print(f"  required: {args.required}")
    print(f"  scenarios: {args.scenarios}")
    print()

    # 1. Generate + insert JSON entry
    entry = build_json_entry(args)
    spec_path, docs_spec_path = insert_json_entry(args, entry)
    print(f"  [ok] Inserted JSON entry into {spec_path.relative_to(REPO)}")
    print(f"  [ok] Mirrored to {docs_spec_path.relative_to(REPO)}")

    # 2. Generate stubs
    py_stubs = gen_python_stubs(args)
    js_stubs = gen_js_stubs(args)

    # 3. Write stubs file
    out_path = write_stubs_file(args, py_stubs, js_stubs)
    print(f"  [ok] Wrote stubs guide to {out_path.relative_to(REPO)}")
    print()
    print(f"Next: open {out_path.relative_to(REPO)} and follow the paste instructions.")
    print(f"After pasting + filling TODOs, validate with:")
    print(f"  python -m pytest")
    print(f"  node tools/sync-spec.js")


if __name__ == "__main__":
    main()
