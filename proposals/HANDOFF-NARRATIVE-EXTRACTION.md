# HANDOFF: Narrative-as-Data extraction — extend from 28/89 to 89/89

Picking up from commit `4bd241b` (2026-04-30). 28 species extracted; 61 remain. The hard design work is done — what's left is mechanical pattern-matching against the characterized shapes.

## Where we are

**Loader infrastructure** (commit `e308ada`):
- Python: `vugg.py` near MINERAL_SPEC — `_load_narrative(species)`, `narrative_blurb(species)`, `narrative_variant(species, variant_name, **ctx)`. ~80 lines.
- JS: `index.html` near MINERAL_SPEC fetch — same three functions plus `_NARRATIVE_MANIFEST = [...]` array of pre-fetched species. Markdown loaded async at startup.
- Markdown: `narratives/<species>.md` — frontmatter (`---`...`---`), `## blurb` (optional), `## variant: <name>` sections, `{key}` placeholders interpolated from ctx dict.

**Species extracted** (28):

- **Carbonates (13)**: chalcopyrite, sphalerite, aurichalcite, dolomite, rosasite, azurite, calcite, aragonite, siderite, rhodochrosite, cerussite, smithsonite, malachite
- **Sulfides (9)**: pyrite, galena, marcasite, hematite, molybdenite, bornite, chalcocite, covellite, cuprite
- **Native metals (3)**: native_copper, native_gold, native_silver
- **Fe oxides (3)**: magnetite, lepidocrocite, goethite

**Per-extraction commit cadence**: 1-3 species per commit (max 4, boss policy). Total of ~15 narrative-extraction commits so far.

## The extraction shapes catalog (read this first)

Open the matching example to see the pattern in action.

| Shape | When to use | Reference |
|---|---|---|
| **Static blurb + flag conditionals** | Single always-shown blurb plus 1-3 boolean-conditional appendix sentences (twinned, dissolved, etc.) | `chalcopyrite.md`, `cerussite.md`, `galena.md`, `bornite.md`, `molybdenite.md` |
| **Two-named-variants for computed branch** | Code computes a value (e.g. early-vs-late zone Fe), picks one of two whole sentences | `sphalerite.md` — `fe_zoning_increasing` / `fe_zoning_decreasing` |
| **3-way habit + default** | `if habit == X / elif Y / else default` — three named variants, all standalone | `aurichalcite.md`, `rosasite.md`, `azurite.md`, `pyrite.md`, `magnetite.md`, `lepidocrocite.md` |
| **4-way habit + default** | Same pattern, four habit branches plus default catch-all | `marcasite.md`, `hematite.md`, `cuprite.md`, `native_copper.md`, `native_silver.md` |
| **Multi-tier with `{value}` templates** | 3+ tiers picked by computed threshold + multiple template variables interpolated | `dolomite.md` — kim_ordered/kim_partial/kim_disordered with `{cycle_count}` + `{f_ord}` |
| **Habit + dissolved-with-conversion-note** | Habit dispatch + dissolved branch that reads a zone note string to pick paramorph variant vs acid_dissolution | `aragonite.md`, `siderite.md`, `rhodochrosite.md`, `azurite.md` |
| **Always-emitted tail variant** | Closing always-shown variant after the conditional middle (NOT the same as blurb — fires after habit dispatch) | `covellite.md` (`stoichiometry`), `native_copper.md` (`statue_of_liberty_tail`), `native_gold.md` (`noble_tail`), `lepidocrocite.md` (`conversion_tail`) |
| **Independent `if`-not-`elif` habit substring matches** | Multiple habit components in one habit string (e.g. `pseudomorph_sooty`) fire BOTH variants. Watch for this — easy to mis-extract as elif | `chalcocite.md` (pseudomorph + sooty) |
| **Paired branches on a binary condition** | `if X: variant_A else: variant_B` — both always emit one of two; default branch is meaningful prose, not omission | `marcasite.md` (`dissolved_inversion` / `kept_orthorhombic`), `native_silver.md` (`tarnishing_full` / `tarnishing_early`) |
| **Dispatch on `dominant_forms` (alloy/composition)** | Crystal carries a `dominant_forms` list; dispatch reads it for alloy variants | `native_gold.md` (`alloy_electrum` / `alloy_cuproauride`) |
| **Habit + zone-note color tints** | Last zone's `note` string substring-matched for color variant | `smithsonite.md` (`color_apple_green` / `color_pink` / `color_blue_green`), `hematite.md` (`specular_iridescent` sub-branch on specular) |
| **Final-color summary via `predict_color()`** | Code calls `c.predict_color()` and interpolates into a `{color}` template | `malachite.md` (`color`) |
| **No always-shown blurb (entirely conditional)** | Some narrators have NO blurb — every emission is conditional | `calcite.md`, `goethite.md`, `pyrite.md`, `marcasite.md`, `malachite.md` |

If a narrator doesn't fit any shape: it's probably an edge case worth flagging. Stop, look at it carefully, and either extend the existing patterns or split the narrator (some logic stays code, some prose moves to markdown).

## The mechanical extraction recipe

For each species:

1. **Read the existing narrator.** `grep -n "^    def _narrate_<species>" vugg.py` and `grep -n "_narrate_<species>\b" index.html`. Compare them — JS-side may be drift-shortened from Python (the markdown becomes canonical → live JS converges on Python text; inline JS fallback strings preserve old behavior for offline boot).

2. **Identify the shape.** Match against the five above. New shape only if you genuinely can't fit existing ones.

3. **Write `narratives/<species>.md`.** Use frontmatter format from existing files. Pick variant names that describe the condition (e.g. `kim_ordered`, `acid_dissolution`, `botryoidal`) — these become the dispatch keys.

4. **Refactor Python `_narrate_<species>`.** Code keeps the conditional dispatch logic; markdown holds the prose. Pattern:
   ```python
   parts = [f"<Species> #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
   parts.append(narrative_blurb("<species>"))  # if there's an always-shown blurb
   if c.habit == "X":
       parts.append(narrative_variant("<species>", "X"))
   ...
   return " ".join(p for p in parts if p)  # filter empty for missing variants
   ```

5. **Refactor JS `_narrate_<species>`.** Mirror the Python structure with `narrative_blurb('<species>')` and `narrative_variant('<species>', 'X', { ctx_key: val })`. Keep inline strings as fallbacks (`narrative_blurb(...) || 'fallback string'`) per boss policy ("don't solve a problem you don't have yet"). Use `parts.filter(p => p).join(' ')` to drop empties.

6. **Add to `_NARRATIVE_MANIFEST`** in index.html. (This is the easy-to-forget step — the loader pre-fetches only species in the manifest.)

7. **Verify.**
   - `python -m pytest --tb=line -q` — must pass 1130/1130 (narrative changes don't shift baselines unless you accidentally changed semantics)
   - `node tools/sync-spec.js` — must show 0 drift across 89 minerals
   - Browser smoke (preview server already running): reload, then `_NARRATIVE_CACHE[species]` should populate; call `sim._narrate_<species>(synthetic_crystal)` and check output is byte-identical to prior run

8. **Commit + push.** One commit per 1-2 species, conventional message style ("Narrative-as-data (N+1/89): species — pattern note"). Push to Syntaxswine `origin/main`.

## Edge cases already validated

- **Literal `{Miller indices}` preservation**: variants like dolomite's `saddle_rhomb` contain `{104}` as crystallographic notation. The renderer's `{(\w+)}` regex matches `{104}`, finds no `104` key in ctx, falls back to preserving `{104}` literal. Same in JS. **Don't escape these — they survive automatically.**

- **Calcite has no `## blurb`**: some narrators don't have an always-shown reference card; they're entirely conditional. The loader handles this — `narrative_blurb("calcite")` returns `""`, code path is unchanged because we filter empties at the end (`p for p in parts if p`).

- **Multiple ctx variables in one variant**: `final_size` in calcite passes 3 values (`size_desc`, `mm`, `habit`) into one variant. Just pass them all as kwargs.

- **Position-string match**: rhodochrosite's `on_sulfide` variant fires when `c.position` contains "sphalerite"/"pyrite"/"galena", and the variant template interpolates `{position}` (which can be the full string "on pyrite" or similar — the prose says "Growing on {position}" which renders as "Growing on on pyrite" — that's expected, the position string in the engine is supposed to be a complete phrase).

- **JS drift catch as side effect**: azurite + aragonite JS narrators had drifted shorter than Python. With the markdown extraction, live JS now produces the longer canonical Python text via the loader; offline JS gets the shorter text via fallback. This is a feature — flagging more drifts as you go is normal and good.

- **JS narrator gap (drift-gap fix)**: native_gold had NO `_narrate_native_gold` method on the JS class — dispatch silently produced no story. When you find a similar gap, ADD the JS method as part of the extraction commit (mirror Python's structure, read from the same markdown). See `index.html` `_narrate_native_gold` for the template.

- **JS file uses `’` literal escape sequences**: The right single quote appears as the literal 6-char sequence `’` in `index.html` source, not the Unicode character itself. The Edit tool's auto-swap can fail when the surrounding text mixes em-dashes and other special chars. Workaround: do smaller surgical edits one chunk at a time when full-block replace fails.

- **`{Miller indices}` literal preservation**: variants like dolomite's `saddle_rhomb` contain `{104}` as crystallographic notation. The renderer's `{(\w+)}` regex finds no `104` key in ctx, falls back to preserving `{104}` literal. Same in JS. **Don't escape these — they survive automatically.**

## Recommended sequencing for the remaining 61

Group by similarity to the established patterns. Order doesn't matter for correctness, only for cadence.

**Sulfides remaining** (~6): pyrrhotite (no narrator declared — skip until added), arsenopyrite, stibnite (no narrator declared), bismuthinite (no narrator declared), native_bismuth (no narrator declared), uraninite, acanthite, argentite

**Sulfates** (~12): barite, celestine, anhydrite, gypsum/selenite, jarosite, alunite, brochantite, antlerite, chalcanthite, melanterite, scorodite, ferrimolybtite

**Halides** (~3): fluorite, halite, chlorargyrite

**Phosphates / arsenates / vanadates** (~10+): adamite, olivenite, mimetite, pyromorphite, vanadinite, descloizite, mottramite, erythrite, annabergite, torbernite, zeunerite, carnotite, apatite

**Silicates** (~10+): quartz, feldspar, albite, tourmaline, beryl, morganite/aquamarine/emerald/heliodor variants, spodumene, kunzite, chrysocolla, hemimorphite, willemite, apophyllite

**Oxides remaining** (~5): wulfenite, raspite, stolzite, clinobisvanite

**Special** (~6): ruby, sapphire, topaz

(Counts approximate — see `data/minerals.json` for the canonical list. 89 minerals × 1 narrator each = 89 narrators total; 89 minus 28 done = 61 remaining. Some minerals lack a `_narrate_*` method even on Python — those are content gaps; flag in commit message but don't block on them.)

**Suggested batch size**: 1-3 species per commit when shape is established; standalone commit for new edge cases. Don't blow past 4 in a single commit — boss prefers reviewable units. The current pace has held steady at ~3 commits per "round" of effort.

## Verification commands (cheat sheet)

```bash
# Run from C:/Users/baals/Local Storage/AI/vugg/vugg-simulator/

PYTHONIOENCODING=utf-8 python -m pytest --tb=line -q
node tools/sync-spec.js

# Browser smoke (preview server already running):
# - reload the page in the preview
# - eval `Object.keys(_NARRATIVE_CACHE).length` — should equal manifest length
# - eval `narrative_blurb('species_just_added')` — should return the prose
# - eval `sim._narrate_<species>(synthetic_crystal)` — should byte-match prior

# When done extracting all 89:
# - Drop the inline JS fallbacks if and only if the boss approves
# - Consider auto-generating _NARRATIVE_MANIFEST from data/minerals.json
#   keys (BACKLOG entry "Internal token cleanup" sequencing-cousin)
```

## File map

| File | Purpose |
|---|---|
| `narratives/chalcopyrite.md` | Simplest reference (blurb + flag conditionals) |
| `narratives/dolomite.md` | Multi-tier + `{Miller indices}` edge case |
| `narratives/sphalerite.md` | Two-named-variants for computed branch |
| `narratives/native_gold.md` | Most variants in one file (3 habit + 2 alloy + 2 always-emitted, total 7 variants) |
| `narratives/native_silver.md` | Paired tarnish branches + paragenesis position note |
| `narratives/chalcocite.md` | Independent-if habit substring matching |
| `narratives/marcasite.md` | Paired binary-condition branches (dissolved_inversion / kept_orthorhombic) |
| `narratives/goethite.md` | No-blurb pattern (entirely conditional) |
| `vugg.py` (~line 248) | Python narrative loader (`_load_narrative`, `narrative_blurb`, `narrative_variant`) |
| `vugg.py` (~14000+) | The 89 `_narrate_<species>` methods being migrated |
| `index.html` (~line 3274) | JS narrative loader — same 3 functions, plus `_NARRATIVE_MANIFEST` and async manifest fetch |
| `index.html` (~13000+) | The 89 JS `_narrate_<species>` methods being migrated |

## Boss-confirmed design decisions (don't relitigate)

From `commit 38a78fc` discussion:

1. **Two named variants for branching narrators** — logic stays in code, markdown stays markdown. No mini-languages inside markdown.
2. **Keep inline JS fallbacks for now** — drift risk is real but manageable; don't solve a problem you don't have yet. Auto-generate later if it gets annoying.
3. **Hardcoded `_NARRATIVE_MANIFEST` array → auto-generate from `data/minerals.json` keys later.** Same pattern as everything else — start manual, automate when the pattern is proven.
4. **Per-species files** (89 small files, not 10 grouped). Cleaner, independently editable, git-friendly.

## Recent commit chain

```
4bd241b  Narrative-as-data (26+27+28/89): magnetite + lepidocrocite + goethite
bcc02bd  Narrative-as-data (23+24+25/89): native metals trio + JS narrator gap closed
0d22b6e  Narrative-as-data (20+21+22/89): chalcocite + covellite + cuprite — Cu trio
b4db0b9  Narrative-as-data (18+19/89): molybdenite + bornite — Cu-Mo paragenesis pair
8e3560d  Narrative-as-data (16+17/89): marcasite + hematite — sulfide group continues
32c11a7  Narrative-as-data (14+15/89): pyrite + galena — sulfide group begins
dd62449  Narrative-as-data (11+12+13/89): cerussite + smithsonite + malachite — carbonate stragglers
9a1adce  HANDOFF: narrative-as-data extraction — playbook for the next 79 species
c551a5e  Narrative-as-data (9+10/89): siderite + rhodochrosite — carbonate group continues
e47b7a7  Narrative-as-data (7+8/89): calcite + aragonite — carbonate group begins
38a78fc  Narrative-as-data (5+6/89): rosasite + azurite — drift fix as side effect
```

## Project context the next session needs

- **Boss**: StonePhilosopher; canonical repo (`canonical/main`) is read-only here. Push to Syntaxswine origin (`origin/main`). Boss promotes from Syntaxswine to canonical at review time.
- **Auto-push**: per memory `feedback_auto_push.md`, push commits to origin after each meaningful step.
- **Sequencing principle** (memory `feedback_refactor_vs_content_sequencing.md`): ship content on stable infra first, then refactor on stable content. This narrative extraction is a refactor — don't bundle new minerals or new mechanics into the commits.
- **Bug spotted mid-task → fix it** (memory `feedback_fix_bugs_when_seen.md`). The Python/JS drift in azurite + aragonite narrators was a "fix on sight" case — markdown extraction made Python canonical, drift resolved automatically. Watch for similar drifts in upcoming species.
- **No emoji unless requested** (memory). The file uses some, but don't add new ones unprompted.

## Where to start reading

1. `narratives/chalcopyrite.md` — the simplest example, see what the format looks like
2. `narratives/dolomite.md` — the most complex example, see the edge cases
3. `narratives/native_silver.md` — most-complex extracted so far (4-way habit + paired tarnish + paragenesis position note)
4. `narratives/goethite.md` — example of no-blurb pattern (entirely conditional)
5. `vugg.py` — search for `# NARRATIVE TEMPLATES` to find the loader, then `_narrate_chalcopyrite` to see the simplest call site
6. `index.html` — search for `_NARRATIVE_MANIFEST` to find the JS loader, then `_narrate_chalcopyrite` for the JS call-site shape (note inline fallbacks)
7. Pick the next species — sulfates (barite, celestine, anhydrite, gypsum/selenite) are the natural next batch. Then halides (fluorite, halite). The `data/minerals.json` keys are the canonical species list.
