---
name: vugg-add-twin-law
description: Add or update twin_laws entries in data/minerals.json for the vugg-simulator. Post-v141 the long-tail gap is CLOSED — 170/170 minerals are accounted for (143 with twin_laws + 27 with `_twin_laws_note`). Use this skill when adding a NEW mineral via vugg-add-mineral (every new mineral should ship with twin_laws data from the start), when revising a probability after new field evidence, or when adding new twin entries to a mineral that already has some. Documents the JSON shape, probability calibration, common laws by mineral class, source citation patterns, the cascade workflow, the `_twin_laws_note` convention for intentionally-empty entries, AND (post-v142) the structural fact-check workflow — `tools/twin-law-check.mjs` validates declared Miller indices against structurally-predicted twin candidates from `data/structural.json`, surfacing fabricated citations like the v139 adamite case.
---

# Add twin_laws Entry

You are extending twin coverage in `data/minerals.json` for the vugg-simulator. Each mineral entry needs a `twin_laws` array documenting which twin laws fire during nucleation. This skill makes adding entries fast and consistent.

## Quick Reference

**File:** `data/minerals.json` — top-level structure has a `minerals` object keyed by mineral symbol. Each mineral has fields like `class`, `formula`, `habit_variants`, `twin_laws`.

**Audit which minerals are missing twin_laws:**
```bash
node -e "const m=JSON.parse(require('fs').readFileSync('data/minerals.json','utf8'));
const all = Object.keys(m.minerals);
const missing = all.filter(k => !m.minerals[k].twin_laws || m.minerals[k].twin_laws.length === 0);
console.log('Missing:', missing.length, '/', all.length);
for (const k of missing) console.log(' -', k, '(class:', m.minerals[k].class + ')');"
```

## Entry Schema

Each twin_laws array entry is an object:

```json
{
  "name": "<law_name>",
  "miller_indices": "{<hkl>}",
  "trigger": "<condition>",
  "probability": <0..1>,
  "status": "newly_added",
  "_source": "<reference citation>",
  "_retune_note": "<optional, only when bumping a previous probability>"
}
```

**Required fields:** name, miller_indices, trigger, probability.
**Optional fields:** status, _source, _retune_note (all prefixed `_` are metadata, not consumed by the engine).

### Field conventions

- **name**: snake_case descriptor. Conventions:
  - `contact_twin` or `contact` — single-contact twin on a face
  - `penetration` — interpenetrating crystals
  - `cyclic_sextet` or `cyclic_sixling` — 3- or 6-fold cyclic trilling
  - `polysynthetic` or `lamellar` — repeated parallel twins
  - `spinel_law` — face-contact {111} like spinel
  - `albite_law`, `pericline_law` — feldspar-family specific laws
  - For named twin morphologies, use the geological name (`swallowtail`, `cockscomb`, `iron_cross`, `spearhead`)

- **miller_indices**: Bracketed Miller indices like `"{110}"`, `"{0001}"`, `"{10-11}"`. Curly braces for general form, square brackets `[110]` only for specific axes (rare in twin context).

- **trigger**: When the twin fires. Common values:
  - `"growth"` — standard growth twin (most common)
  - `"growth in twinned_cyclic habit"` — fires only when the habit variant matches
  - `"moderate σ, growth-driven"` — saturation-dependent
  - `"cooling"` — exsolution / inversion twin (bornite, chalcocite)
  - `"deformation"` — mechanical twin (calcite e-twin, some plagioclase)

- **probability**: 0.0 to 1.0 per nucleation. Calibration:
  - 0.005-0.02: rare twin habit, only occasionally seen
  - 0.05-0.10: minor common twin (5-10% of specimens)
  - 0.15-0.30: regular feature (about a quarter to a third)
  - 0.40-0.55: dominant or near-dominant habit
  - 0.60+: defines the species visually (rare — reserve for cases like marcasite cockscomb where the morphology IS the twin)

- **status**: `"newly_added"` for new entries, `"retuned"` when bumping an existing probability.

- **_source**: Reference citation. Prefer Dana 8th ed., Ramdohr 1980, Hurlbut & Klein 23rd ed., Strunz 9th ed., the Anthony et al. Handbook of Mineralogy (v.I-v.V, available free at handbookofmineralogy.org), or peer-reviewed papers. For poorly documented minerals, note `"data sparse — conservative p"`.

  **Citation conservatism rule (post-v142):** specific paper-page combinations (e.g. "Smith 1972 page 245") are the high-risk fabrication zone. WEB-SEARCH any specific citation before shipping it. Default to general references ("Anthony Handbook v.X mineral section", "Mindat habit notes", "Dana 8th ed. — mineral name") when the specific paper isn't directly verifiable. The v142 adamite correction (commit history) documents what happens when you don't follow this rule: a confabulated "Frondel 1948 Amer. Mineral. 33:545" shipped at v139, was caught during v142 verification, and forced a retraction commit + SIM_VERSION bump.

  **Why this matters more for twin_laws than for chemistry data:** twin_laws entries are LEAF data in the engine's constraint graph — they decorate the rendered crystal but don't propagate to other systems. A confabulated value here doesn't trip baseline tests, doesn't show up as a chemistry contradiction. The constraint network can't fact-check it. So the discipline has to come from outside: external verification (web search, Anthony Handbook, Mindat), citation conservatism (general references over specific paper-page combinations), or honest uncertainty marking via `_twin_laws_note` for collector-folklore territory.

- **_retune_note**: Required when bumping an existing entry's probability. Explain why, with field-frequency context if possible.

## Common Twin Laws by Mineral Class

These are starting points — verify each in references before committing.

| Class      | Common twin laws                                  | Notes |
|------------|---------------------------------------------------|-------|
| silicate   | {010} albite (plagioclase); {100} or {001} (mica) | Feldspars often polysynthetic |
| sulfide    | {111} spinel-law (galena, chalcocite, sphalerite, chromite); {0001} (covellite, molybdenite cleavage twins rare) | Cubic sulfides → spinel; layered sulfides usually no twin |
| oxide      | {0001} hematite polysynthetic; {111} spinel-law (magnetite, chromite, spinel); {110} (uraninite) | Many oxides have {111} spinel-law |
| sulfate    | {110} or {001} (barite, anglesite, celestine); {101} (selenite swallowtail — already shipped) | Orthorhombic family shares {110}/{001} |
| carbonate  | {0001} e-twins (calcite — deformation); {10-12} (calcite, dolomite); {001} (azurite) | Calcite group has multiple twin laws |
| phosphate  | {001} or {100} (vivianite); {0001} (apatite — uncommon) | Apatite group rarely twins |
| arsenate   | {010} or {001} (erythrite, annabergite); {110} (mimetite — apatite-group, rare) | Cobalt/nickel arsenates share habits |
| halide     | {111} penetration (fluorite — already shipped) | Cubic halides → spinel/penetration |
| native     | {111} contact (gold, silver, copper — twinning common in dendritic specimens) | Cubic natives often twinned |
| molybdate  | {100} or {001} (wulfenite tabular — rare) | Molybdates rarely twin |
| amphibole  | {100} simple + lamellar (tremolite, actinolite) | Amphiboles often show parallel twins |
| hydroxide  | {021} (goethite sagenitic — rare) | Goethite group rarely twins |
| native     | spinel-law on {111} for cubic natives | gold, silver, copper |
| borate     | rarely twinned (borax, tincalconite) | Use very low p with data-sparse note |

## Probability Decision Tree

For each mineral:
1. **Is the mineral well-documented in Dana 8th / Ramdohr / Mindat?** If yes → look up the field frequency. If not → conservative p=0.02-0.05 with `_source: "data sparse"`.
2. **Is the twin a defining visual feature?** (e.g., cockscomb for marcasite, swallowtail for selenite) → p ≥ 0.40
3. **Is the twin "common" but not dominant?** → p = 0.10-0.30
4. **Is the twin "rare" or "occasional"?** → p = 0.02-0.10
5. **Is the twin only mentioned in passing?** → p = 0.005-0.02 with data-sparse note

## Validation Checklist

After adding entries, run:

```bash
npm run build       # rebuild bundle (data is loaded at runtime, but verify no JSON errors)
npm run typecheck   # 0 errors
npm test            # all tests pass — data-only changes don't trigger baseline regen
                    # unless SIM_VERSION bumps (which it shouldn't for data-only)

# Structural fact-check (Tier 1 of PROPOSAL-STRUCTURE-AS-FACT-CHECK.md, shipped f40db1e):
node tools/twin-law-check.mjs <mineral>     # single-mineral detail
node tools/twin-law-check.mjs --flagged     # all currently-flagged entries
```

The check tool compares declared miller_indices against structurally-predicted
candidates derived from the unit cell + space group in `data/structural.json`.
See the "Structural fact-check" section below for what to do with each verdict
and when to populate structural.json for a new mineral.

**Important:** Adding twin_laws to a mineral with NO previous twin_laws DOES create new RNG draws, because `_rollSpontaneousTwin` calls `rng.random() < prob` per declared twin law per nucleation — regardless of whether the twin fires. Even p=0.0 still consumes the random() draw, so rolling back probabilities does NOT prevent cascade. The only escape paths are:

1. **Pick minerals that never nucleate in any seed42 scenario** (hard to know without running scenarios). Some rare/obscure minerals may fit.
2. **Bump SIM_VERSION + regenerate baseline** — the canonical path, what v133 + v134 did.

For ANY batch that touches commonly-nucleating minerals (hematite, bornite, chromite, etc.), assume cascade and plan to bump.

### Cascade workflow (validated by v134 batch)

```
1. Add twin_laws entries to data/minerals.json
2. npm run build
3. npm test  →  expect calibration.test.ts failures on N scenarios
4. Bump SIM_VERSION in js/15-version.ts (add a doc block matching
   the v133/v134 pattern: list each new mineral + law + p + source,
   explain which scenarios drift)
5. npm run build  (rebuild with new SIM_VERSION)
6. node tools/gen-js-baseline.mjs  (writes tests-js/baselines/seed42_v{N}.json)
7. npm test  →  all green; calibration auto-picks up new baseline file
8. Commit (both data/minerals.json + js/15-version.ts + new baseline file)
9. Push
```

### Cascade observation

When the cascade hits, the failing-test diff often shows changes on minerals you DIDN'T touch (acanthite population shifting, albite max_um drifting, etc.). That's characteristic — the perturbed RNG sequence propagates downstream through every subsequent random() draw. The mineral you added doesn't have to be ACTIVE in the failing scenario for the scenario to drift; just being a candidate for nucleation (which forces a `_rollSpontaneousTwin` evaluation) is enough.

## Workflow

For a session adding N minerals:

1. **Audit** which minerals are missing (use the node oneliner above).
2. **Group** by class — class-shared references save research time.
3. **For each mineral:**
   a. Read its entry in `data/minerals.json`.
   b. Look up its twin behavior. Mental sources: Dana 8th, Ramdohr 1980 (ore minerals), Hurlbut & Klein, Mindat.
   c. Determine 1-3 twin_laws entries.
   d. Edit the mineral's entry to add the `twin_laws` array.
4. **Validate**: `npm run build && npm run typecheck && npm test` (full).
5. **Commit**: dense field-notes-style message, list each mineral with its laws.
6. **Push** per project workflow (push after commit by default for vugg).

## Edge Cases

- **Mineral has multiple distinct twin habits** (like marcasite spearhead + cockscomb): list each as a separate entry. The dispatch is law-scoped, so each will fire on its own roll. Note the path-1 ordering if relevant (which rolls first).
- **Mineral is poorly documented**: conservative p=0.02 with `"_source": "data sparse — conservative p based on related minerals"`. Better to under-shoot than over-twin.
- **Twin is mineral-pair-specific** (epitaxy, not pure twinning): NOT a twin_law. Don't add it here.
- **Mineral never twins** (cleavage flake-only minerals like molybdenite): add ONE entry at p=0.005 with `"_source": "no documented twinning — placeholder"` OR leave twin_laws empty. Both are valid. Empty array is more honest.

## Structural fact-check (post-v142, Tier 1 shipped at f40db1e)

After a twin_laws entry is added, the `tools/twin-law-check.mjs` script
checks whether the declared `miller_indices` match a structurally-predicted
twin candidate derived from the mineral's unit cell + space group (in
`data/structural.json`). This catches confabulated citations like the
v139→v142 adamite case automatically — the v139 `{101}` entry would have
been FLAGGED at commit time, prompting citation verification.

### Verdicts

- **✓ PASS** — the declared plane matches a structurally-predicted candidate
  (pseudo-symmetry, Σ3 CSL for cubic, etc.). Entry is consistent with the
  lattice geometry. Ship.
- **⚠ FLAG** — no specific structural prediction matches this plane. The
  entry needs human review: is the citation real? Or is this a
  legitimately-subtle twin (marcasite spearhead, pyrite iron-cross) where
  the structural origin is at the atom-position level not lattice level?
  - If the citation is real → ship; the FLAG just notes that the entry
    depends on the citation being trustworthy
  - If the citation is fake → that's a v139→v142 catch; pull the entry
- **? SKIP** — no structural data populated for this mineral yet. The
  tool can't check the entry. To turn SKIP into PASS/FLAG, add the
  mineral to `data/structural.json` (see below)
- **✗ PARSE** — `miller_indices` field is unparseable (`b_axis`, `undefined`,
  `{various}`, etc.) — a data bug worth fixing

### When to populate structural.json

If you're adding twin_laws to a mineral that doesn't have a structural
entry yet, **add the structural data in the same commit**. This keeps the
audit coverage growing alongside the twin_laws data. Schema:

```json
{
  "<mineralname>": {
    "system": "cubic" | "tetragonal" | "orthorhombic" | "monoclinic" | "trigonal" | "hexagonal" | "triclinic",
    "space_group": "<Hermann-Mauguin symbol e.g. Fd-3m, Pmcn, C2/m>",
    "lattice": { "a": <Å>, "b": <Å (omit for cubic/tet/trig/hex)>, "c": <Å (omit for cubic)>, "beta": <° (monoclinic only)> },
    "_source": "<citation — author year (journal volume:pages) — web-verified per v142 rule>"
  }
}
```

Sources for lattice data: the same Anthony Handbook PDFs used for twin_laws
citations include cell parameters in the "Crystal Data" block. Wikipedia's
mineral infoboxes usually cite primary refinements. The Crystallography
Open Database (http://www.crystallography.net) has CIFs for most species.
Per the v142 citation conservatism rule, **web-verify every specific paper
citation before adding it to structural.json** — don't synthesize values
from memory.

### What the structural-check does NOT do

- Doesn't predict twin frequencies (that's Tier 2 — needs full atom positions)
- Doesn't fetch CIFs live — `structural.json` is hand-curated
- Doesn't auto-reject FLAGGED entries — it surfaces them for human judgment

See `proposals/PROPOSAL-STRUCTURE-AS-FACT-CHECK.md` for the full framework,
`proposals/THEORY-TEST-3-MINERALS-MANUAL.md` for the 3/3 manual proof, and
`tests-js/twin-law-check.test.ts` for the pinned v142 back-test.

## Cross-References

- **Already-twinned minerals** (62 of 170) → see `data/minerals.json` for examples. Quartz, feldspars, calcite, dolomite, the iconic twins (fluorite, selenite, galena, aragonite, cerussite, marcasite, pyrite) all already have entries.
- **The 9 iconic-twin primitives** in `js/99c-renderer-primitives.ts` (commits 57a9108 → b34bda7) show the visual end-state for the most documented twins. Newly-added twin_laws don't get primitives until someone hand-rolls the geometry. Adding twin_laws alone is the DATA layer; the visual layer needs its own work.
- **Research doc**: `proposals/RESEARCH-CRYSTAL-NATURALISM.md` §6.2 has additional per-mineral twin notes worth cross-referencing.
- **Structural fact-check (post-v142):**
  - `tools/twin-law-check.mjs` — Tier 1 sanity-check script
  - `data/structural.json` — hand-curated lattice + space-group reference data (18 minerals at f40db1e; populate as you go)
  - `tests-js/twin-law-check.test.ts` — unit tests including the pinned v142 adamite back-test
  - `proposals/PROPOSAL-STRUCTURE-AS-FACT-CHECK.md` — the framework
  - `proposals/THEORY-TEST-3-MINERALS-MANUAL.md` — manual proof, 3/3 pass

## Why This Skill Exists

The 7 iconic twins shipped in May 2026 went deep on visualizing the most common twin morphologies. Their data entries took meaningful research time. The remaining ~108 minerals needed _data_ entries (no visualization), which was straightforward but tedious — exactly the kind of work this skill makes mechanical.

**Post-v141 the long-tail gap is CLOSED** — 170/170 minerals accounted for (143 with twin_laws + 27 with `_twin_laws_note`). The project crosses from "gap-filling" into "maintenance":

- When a new mineral is added via `vugg-add-mineral`, ship its twin_laws (or `_twin_laws_note`) from the start. Don't merge a new mineral with `twin_laws: []` and no note.
- When new field evidence updates a probability, use `_retune_note` per the schema.
- When the visual layer adds a hand-rolled twin primitive, the data is already there — the geometry just hangs off the existing twin_laws entry.

The arc that built this gap-fill ran commits `5433aea` → `6228605` (v133-v141, ~30 commits). The `tools/add-<class>-twins.mjs` family (5 scripts: sulfide, phosphate, arsenate, sulfate, final) is the template for any future bulk update.

## Commit Message Pattern

```
twin_laws data — batch <N>: <class>(s) — <count> minerals

Adds twin_laws entries for <count> minerals across <class> class(es).
All entries data-only (no primitive geometry); twin probability ≤ 0.05
for new additions to avoid RNG cascade.

ADDED (no previous twin_laws):
  hematite (oxide):    {0001} polysynthetic p=0.05
  bornite (sulfide):   {111} spinel-law    p=0.02
  ...

REFERENCES
  Dana, J.D. & Dana, E.S. Dana's New Mineralogy (8th ed.)
  Ramdohr, P. 1980. The Ore Minerals and Their Intergrowths

VERIFICATION
  npm run build       <chars>
  npm run typecheck   0 errors
  npm test            <N> passed, 0 failed
  node tools/twin-law-check.mjs <mineral>   ✓ PASS / ⚠ FLAG (with reason)
                                              # if SKIP, populate structural.json too

NEXT
  <which minerals/classes remain>
```
