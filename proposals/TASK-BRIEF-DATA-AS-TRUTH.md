# TASK-BRIEF: data/-as-truth — extract tables from procedural code

**Priority:** Highest-leverage architecture move. No new minerals, no new
scenarios, no new mechanics. Pulls procedural state out of `vugg.py` and
`index.html` into declarative `data/*.json` files that both engines (and
`agent-api/vugg-agent.js`) consume. Every table extracted halves the
per-mineral / per-scenario implementation cost and shrinks the surface
where Python and JS can drift.

**Why now:** the architecture review (2026-04-29) endorsed this as the
single most leveraged refactor available. The pattern already works —
`data/minerals.json` is the single source of truth for 84 mineral specs
across three runtimes — but it's only used for the per-mineral fields.
Scenarios, twin laws, paramorph transitions, metastability rules, and
narrator copy are all still hand-written procedural code in two languages.
That's where the duplicated maintenance lives.

**Why this compounds:** when `vugg.py` is eventually retired (per the
architecture decision in `vugg.py`'s top-of-file docstring — trigger:
~100 minerals or natural workflow cycle), the cost of that retirement is
proportional to how much engine-specific procedural code is left. Every
table moved into `data/` shrinks that cost.

**Out of scope:** the grow_*() functions themselves. They stay procedural
in both engines for now. The bridging work is making the *configuration*
declarative, not the simulation logic.

---

## Six items to extract (sequenced by dependency / leverage)

Items 1-5 are tables of declarative state lifted out of procedural code.
Item 6 lifts test setup into the same data files, making each mineral
self-documenting and self-validating.


### 1. `data/scenarios.json` — initial fluid + event timeline

**Today:** 13 (or 14 — Python has `scenario_random`, JS doesn't) hand-written
`scenario_*` functions in each engine. Each one builds a `FluidChemistry(...)`
initializer and registers an event timeline. Adding a scenario means writing
the same function twice in two languages and remembering to register it in
both `SCENARIOS` registries.

**Schema sketch:**
```json
{
  "$schema_version": "1.0.0",
  "scenarios": {
    "mvt": {
      "anchor": "Tri-State district (Joplin / Picher) — Sr-Pb-Zn",
      "initial": {
        "T_C": 180,
        "P_kbar": 0.3,
        "pH": 7.2,
        "fluid": { "Ca": 300, "Mn": 25, "Pb": 40, "Na": 80, "Sr": 15, "Ba": 20, "O2": 0.25 },
        "wall": { "composition": "limestone", "reactivity": 1.0, "diameter_mm": 30 }
      },
      "duration_steps": 200,
      "events": [
        { "step": 20, "type": "fluid_mixing", "label": "Fluid Mixing",
          "delta": { "Zn": 150, "S": 105, "F": 45 } },
        { "step": 60, "type": "fluid_pulse", "label": "Second Pulse",
          "delta": { "Fe": 25, "Mn": 5 } },
        { "step": 80, "type": "tectonic_shock", "label": "Tectonic" }
      ],
      "sources": [
        "Stoffell 2008 — fluid-inclusion microthermometry",
        "Hagni 1976 — Tri-State paragenesis"
      ]
    }
  }
}
```

**Engineering:**
- New `data/scenarios.json` with all 13 (+ random) scenarios migrated.
- Both engines load and run scenarios from this file. Python: `json.load`
  at module import. JS: `fetch('data/scenarios.json')` at startup, fall
  back to a tiny inline copy if the fetch fails (same pattern as
  `MINERAL_SPEC_FALLBACK`).
- Event types are a small enumerated set; both engines have a handler per
  type (`fluid_mixing`, `fluid_pulse`, `cooling_pulse`, `tectonic_shock`,
  `acid_pulse`, `oxidation`, `flood`, `meteoric_flush`, `supergene_acidification`,
  `chromium_depletion`, `uplift_weathering`). Catalog them in the schema.
- Update `tools/sync-spec.js` with a Check 7 that validates scenarios
  declared in JSON match what each engine has wired up.
- Move `scenario_random` into JSON form so the Python/JS drift on this one
  scenario closes simultaneously.

**Effect:** adding a scenario becomes a one-JSON-entry change. Today's
14×2 = 28 hand-written scenario functions become 0 (replaced by one
generic interpreter per engine).

---

### 2. `data/twin_laws.json` — twin probability + law per mineral

**Today:** twin probabilities and twin-law strings are scattered through
each `grow_<mineral>()` function as inline literals. Adding the iron-cross
twin to pyrite required code edits in three places.

**Schema sketch:**
```json
{
  "twin_laws": {
    "pyrite":      { "probability": 0.25, "law": "iron-cross {110}" },
    "sphalerite":  { "probability": 0.18, "law": "spinel-law {111}" },
    "calcite":     { "probability": 0.10, "law": "polysynthetic {012}" },
    "rhodochrosite": { "probability": 0.10, "law": "polysynthetic {012}" },
    "...": "..."
  }
}
```

**Engineering:**
- One JSON file. Both engines look up `twin_laws[mineral]` at the twin-roll
  point. If absent, no twinning.
- Tectonic-shock event is a single multiplier on the same probability.
- `tools/sync-spec.js` adds a check that twin_laws keys are subset of mineral
  spec keys.

**Effect:** twin laws become a one-row-per-mineral table. New twin laws ship
in JSON, not code.

---

### 3. `data/paramorph_transitions.json` and `data/metastability.json`

**Today:** Round 8 added `PARAMORPH_TRANSITIONS` as a module-level dict in
`vugg.py` (and the JS port). The water-solubility metastability mechanic
(8e — chalcanthite re-dissolves below salinity 4 / above pH 5) is a
hard-coded per-step hook. Both are textbook tables masquerading as code.

**Schema sketches:**
```json
// data/paramorph_transitions.json
{
  "transitions": {
    "argentite": {
      "to": "acanthite",
      "trigger": { "T_below_C": 173 },
      "preserve": ["habit", "dominant_forms", "zones"]
    }
  }
}

// data/metastability.json
{
  "rules": {
    "chalcanthite": {
      "dissolves_when": { "any": [{ "salinity_below": 4 }, { "pH_above": 5 }] }
    }
  }
}
```

**Engineering:**
- Both engines load and interpret. Run-step hooks become generic loops over
  the rules.
- Adding a new paramorph (e.g., aragonite → calcite at low T) is one JSON
  entry, not a code change in two languages plus a regression test. (The
  regression test stays — it's checking that the table is honored.)

**Effect:** mechanics that are textbook tables become tables. Round 9+ work
gets cheaper.

---

### 4. `data/narrators/<mineral>.md` — per-species narrator copy

**Today:** the narrator output is generated by `_narrate_<mineral>()`
methods (Python) and matched JS functions. Each one assembles 1-3
paragraphs of mineral-specific copy. Professor has opinions about how his
minerals read; editing copy means a developer has to hand-merge his prose
back into a Python function and then port to JS.

**This also closes the loop on `TASK-BRIEF-NARRATIVE-READABILITY` item 1.**
The blurb-dedupe rule (full on first occurrence + closing summary, terse on
later) becomes "load the markdown once, render twice with different
templates." The data layer makes the dedupe trivial; today it requires
state-tracking inside the narrator function.

**Layout:**
```
data/
└── narrators/
    ├── acanthite.md
    ├── calcite.md
    ├── ... (84 files)
    └── _shared.md      # phrases reused across species (tarnish, fluorescence templates)
```

**File shape (Markdown frontmatter for the structured bits, prose body for
the narrative):**
```markdown
---
mineral: acanthite
hooks:
  short: "Ag₂S monoclinic silver sulfide; the cold-storage form."
  paramorph_note: "above 173°C the same composition crystallizes as cubic argentite"
templates:
  tarnish: "Tarnish — surface oxidation has darkened the original lead-gray luster..."
  habit_massive: "Massive granular — the dominant economic form."
---

# Full blurb (rendered on first occurrence + closing summary)

Ag₂S — monoclinic silver sulfide, the most important silver ore on
Earth at 87% Ag by weight. The cold-storage form: above 173°C the
same composition crystallizes as cubic argentite, and most acanthite
in nature is paramorphic after cooled argentite, retaining the
cubic external form while the lattice underneath inverts to monoclinic.
[...rest of the existing narrator copy...]
```

**Engineering:**
- Both engines fetch / read the markdown set at startup.
- A shared template renderer per engine (small — string interpolation, no
  full templating engine).
- `_narrate_<mineral>()` functions become "load this mineral's hooks; pick
  the appropriate hook for first/repeat/closing context; substitute size,
  habit, traces."
- Professor can edit `data/narrators/acanthite.md` directly without ever
  opening a `.py` or `.html` file.

**Effect:** narrator copy becomes Professor's territory, not the builder's.
Round 8's "41 expanded-research narrator refresh sweep" (deferred from the
boss's research drop) becomes a markdown-edit pass instead of a 41-times-2
function-port pass.

---

### 5. (later) `data/scenarios_events.json` schema for catalog of event types

**Today:** event handlers are dispatched by string in scenario timelines.
The set of valid event types is implicit in the engine code.

**Engineering:** small JSON declaring the event-type vocabulary, what each
type's `delta` block can contain, and which ones are deterministic vs
stochastic. `tools/sync-spec.js` validates scenario timelines reference
only valid event types.

**Defer:** lower-leverage than items 1-4. Add when item 1 has shipped and
the event-type set is stable enough to be worth schematizing.

---

### 6. `test_cases` field on every mineral in `data/minerals.json`

**Today:** mineral specs declare *what* the gates are (`required_ingredients`,
`T_range_C`, `redox_requirement`, etc.) but not *how to test them*. The
generic `tests/test_engine_gates.py` reads `required_ingredients` and
synthesizes one positive case (fluid that just satisfies them, asserts
σ > 0). Mechanic-specific behavior — broth-ratio branching for rosasite/
aurichalcite, anion competition for torbernite/zeunerite, paramorph
transitions for argentite, water-solubility metastability for
chalcanthite — is tested in per-round files (`test_round8a_paramorph.py`,
`test_round9_broth_ratio.py`, `test_round9b_anion_competition.py`, etc.).

That works, but each new mechanic spawns a new test file, and the test
setup lives separate from the spec it's verifying. A reader of
`data/minerals.json` sees the gate prose in `audit_status` but can't
verify the engine matches without grep-hunting for the corresponding
test file.

**Why now (relative to the others):** every Round 9+ mineral pair has
shipped with a corresponding `test_round*.py` file. The pattern is now
repetitive enough that the cost of NOT lifting it into data is visible:
new mechanics keep spawning new test files instead of accumulating into
a generic engine.

**Schema sketch:**
```json
"torbernite": {
  ...
  "test_cases": [
    {
      "name": "p_dominant_fires",
      "fluid": {"Cu": 40, "U": 2.5, "P": 8, "As": 2, "O2": 1.5, "pH": 6.0},
      "T_C": 25,
      "expects": {"sigma": ">1.0"},
      "rationale": "P/(P+As)=0.8 — anion gate passes for the P-branch"
    },
    {
      "name": "as_dominant_blocks",
      "fluid": {"Cu": 40, "U": 2.5, "P": 2, "As": 8, "O2": 1.5, "pH": 6.0},
      "T_C": 25,
      "expects": {"sigma": "==0"},
      "rationale": "As-dominant fluid — anion gate ratio-blocks torbernite"
    },
    {
      "name": "no_uranium_blocks",
      "fluid": {"Cu": 40, "U": 0, "P": 8, "As": 2, "O2": 1.5, "pH": 6.0},
      "T_C": 25,
      "expects": {"sigma": "==0"},
      "rationale": "U=0 fails U>=0.3 ingredient gate"
    }
  ]
}
```

**Schema fields per case:**
- `name` — short snake_case identifier; surfaces in pytest output as
  `test_mineral_cases[torbernite-p_dominant_fires]`.
- `fluid` — partial `FluidChemistry` dict; missing fields default to 0.
- `T_C` — temperature in °C. Optional `pressure_kbar` for pressure-gated
  minerals (kyanite/coesite/diamond when those land).
- `expects.sigma` — operator + value as a string: `">1.0"`, `"==0"`,
  `">=0.5"`, `"<0.3"`. Keeps JSON-friendly without bringing in a real
  expression language.
- `rationale` — short prose; appears in test failure output. Optional
  but recommended; helps the boss read the spec as a self-validating doc.

**Engineering:**
- Add `test_cases: []` (default empty) to `_schema` in `data/minerals.json`.
  Existing minerals get an empty array; new minerals come with cases via
  the scaffold tool (see template update below).
- New `tests/test_mineral_cases.py` — parameterizes over every (mineral,
  case) pair, builds a `VugConditions` from the case, calls
  `supersaturation_<mineral>()`, asserts the operator. Replaces the
  per-round `test_round*_*.py` files (those collapse into the spec
  cases).
- Extend `tools/sync-spec.js` with a Check 7 that runs every mineral's
  cases against the loaded spec and flags any whose engine no longer
  matches its declared cases. Cross-engine baseline tests (architecture
  review's option-3) become trivially derivable: same cases, both
  runtimes, diff results.
- Update `proposals/vugg-mineral-template.md` to require at least 2-3
  cases per new mineral (one positive gate, one ingredient-blocking case,
  one mechanic-specific case if the mineral participates in a special
  gate like broth-ratio / anion-competition / paramorph).
- Update `tools/new-mineral.py` to seed `test_cases` with a 2-case stub
  so future builders can't forget.

**What this does NOT replace (be honest):**
- Multi-step behavior tests (paramorph transitions, metastability hooks,
  dissolution-then-regrowth, growth-zone tracking). Those exercise the
  run-step loop and stay in code-level test files. Estimate ~10% of the
  current test surface.
- Cross-mineral interaction tests (substrate preference, enclosure,
  scenario-specific paragenesis). These are sim-level, not mineral-level.

**Effect:** every mineral entry self-documents AND self-validates. Per-round
test files collapse into spec data. The `tools/sync-spec.js` runtime check
catches engine drift the moment a supersat formula diverges from the case
it claims to satisfy. New mineral additions can't ship without test
coverage because the scaffold tool seeds the cases.

**Cost:** ~5-15 lines per mineral × 88 minerals = +500-1300 lines in
`data/minerals.json`. The file gets bigger but each entry becomes more
honest about its own behavior.

**Sequencing within this brief:** lands after items 1-3 because the
generic `tests/test_mineral_cases.py` runner depends on stable
declarative chemistry (item 1's scenarios, item 3's tables) to verify
behavior consistently across runtimes. Could ship before item 4
(narrators) since narrators are pure prose and don't interact with the
test surface.

---

## Crossing all three runtimes

The same fetch/interpret pattern from `data/minerals.json` extends to all
of these:

| Runtime | Today | After this brief |
|---|---|---|
| `vugg.py` | imports `json`; reads `data/minerals.json` for mineral fields only | Reads scenarios, twin_laws, paramorph_transitions, metastability, narrators from `data/`. |
| `index.html` | fetches `data/minerals.json` at startup; inline `MINERAL_SPEC_FALLBACK` | Fetches all of the above; inline fallbacks for offline/file:// boot. |
| `agent-api/vugg-agent.js` | requires `../data/minerals.json` directly | Same pattern, all new tables. **The intentional lag stays** — agent-api may consume a subset (e.g., scenarios only, no narrators). The point is the lag becomes deliberate per-table opt-in instead of cross-engine drift. |

`tools/sync-spec.js` extends to validate every new table:
- All tables are valid JSON / readable markdown.
- All cross-table references resolve (e.g., `twin_laws` keys exist in `minerals`,
  `paramorph_transitions.to` references valid minerals, etc.).
- Each engine's interpreter is wired up to consume each table.

---

## Sequencing

Six items, not all equal-leverage. Suggested order:

1. **Item 1 (scenarios).** Highest leverage. Closes the `scenario_random`
   drift. Establishes the "engines as interpreters of declarative data"
   pattern for compound work — all 13 scenarios at once.
2. **Item 6 (test_cases).** Best paired with item 1 — once scenarios are
   declarative, test_cases give every mineral a self-validating spec
   that runs against both runtimes. Collapses the per-round
   `test_round*_*.py` files into the spec.
3. **Item 4 (narrators).** Compounds with `TASK-BRIEF-NARRATIVE-READABILITY`
   item 1; ship them together. The dedupe becomes free.
4. **Item 2 (twin laws).** Quick win. ~30 minutes once the pattern is set.
5. **Item 3 (paramorph + metastability).** Round 8-specific tables. Smallest
   set, clearest schema.
6. **Item 5 (event-type catalog).** Defer.

After items 1-4 land, the engine source files are noticeably smaller
(scenarios alone are ~600 lines × 2). Better yet, the per-mineral and
per-scenario delta to add new content is one JSON edit instead of two
function-ports. That's the unit of leverage we're buying here.

---

## Connection to the larger plan

This brief is the **bridging work** between the current "three engines,
duplicated logic" state and the eventual "one engine in JS, vugg.py
retired" end-state described in `vugg.py`'s top-of-file docstring. The
more state lives in `data/`, the cheaper the eventual Python drop becomes
(less procedural code to delete; the JS interpreter already exists).

It also unlocks the option-3 cross-engine baseline tests (per the
architecture review): same scenarios.json + same seed = same output
across runtimes, diffed at finish. Today that test would also need to
diff the scenario *definition* between engines; once scenarios are
declarative JSON, the test only diffs *behavior*. That's what makes the
baseline tests genuinely cheap to add.

---

## Mirror requirement: gone

Per the 2026-04-29 flatten (commit `4950ffa`), `web/` and `docs/` are
collapsed to repo root. No per-commit mirror step. Push to Syntaxswine
origin per usual. Boss promotes to canonical at review time.
