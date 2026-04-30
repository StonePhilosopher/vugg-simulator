# HANDOFF: Narrative-as-Data extraction — extend from 10/89 to 89/89

Picking up from commit `c551a5e` (2026-04-30). 10 species extracted; 79 remain. The hard design work is done — what's left is mechanical pattern-matching against five characterized shapes.

## Where we are

**Loader infrastructure** (commit `e308ada`):
- Python: `vugg.py` near MINERAL_SPEC — `_load_narrative(species)`, `narrative_blurb(species)`, `narrative_variant(species, variant_name, **ctx)`. ~80 lines.
- JS: `index.html` near MINERAL_SPEC fetch — same three functions plus `_NARRATIVE_MANIFEST = [...]` array of pre-fetched species. Markdown loaded async at startup.
- Markdown: `narratives/<species>.md` — frontmatter (`---`...`---`), `## blurb` (optional), `## variant: <name>` sections, `{key}` placeholders interpolated from ctx dict.

**Species extracted** (10): chalcopyrite, sphalerite, aurichalcite, dolomite, rosasite, azurite, calcite, aragonite, siderite, rhodochrosite.

**Per-extraction commit cadence**: 1-2 species per commit when shapes are similar; standalone commit for genuinely new patterns. Total of 7 narrative-extraction commits so far.

## The five extraction shapes (read this first)

Open the matching example to see the pattern in action.

| Shape | When to use | Reference |
|---|---|---|
| **Static blurb + flag conditionals** | Single always-shown blurb plus 1-3 boolean-conditional appendix sentences (twinned, dissolved, etc.) | `chalcopyrite.md` — simplest |
| **Two-named-variants for computed branch** | Code computes a value (e.g. early-vs-late zone Fe), picks one of two whole sentences | `sphalerite.md` — `fe_zoning_increasing` / `fe_zoning_decreasing` |
| **3-way habit + default** | `if habit == X / elif Y / else default` — three named variants, all standalone | `aurichalcite.md`, `rosasite.md`, `azurite.md` |
| **Multi-tier with `{value}` templates** | 3+ tiers picked by computed threshold + multiple template variables interpolated | `dolomite.md` — kim_ordered/kim_partial/kim_disordered with `{cycle_count}` + `{f_ord}` |
| **Habit + dissolved-with-conversion-note** | Habit dispatch + dissolved branch that reads a zone note string to pick paramorph variant vs acid_dissolution | `aragonite.md`, `siderite.md`, `rhodochrosite.md`, `azurite.md` |

If a narrator doesn't fit any shape: it's probably the design's edge-case test. Stop, look at it carefully, and either extend the existing patterns or split the narrator (some logic stays code, some prose moves to markdown).

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

## Recommended sequencing for the remaining 79

Group by similarity to the established patterns. Order doesn't matter for correctness, only for cadence.

**Carbonates remaining** (5): smithsonite, cerussite, malachite + supergene_ones if not done

**Sulfides — chalcopyrite-shape simple** (~15): galena, pyrite, marcasite, hematite, molybdenite, bornite, chalcocite, covellite, cuprite, pyrrhotite, native_copper, native_gold, native_silver, electrum, etc.

**Sulfates** (~12): barite, celestine, anhydrite, gypsum/selenite, jarosite, alunite, brochantite, antlerite, chalcanthite, melanterite, scorodite, ferrimolybdite

**Halides** (~3): fluorite, halite, chlorargyrite

**Phosphates / arsenates / vanadates** (~10): adamite, olivenite, mimetite, pyromorphite, vanadinite, descloizite, mottramite, erythrite, annabergite, torbernite, zeunerite, carnotite, apatite

**Silicates** (~10): quartz, feldspar, albite, tourmaline, beryl, morganite/aquamarine/emerald/heliodor variants, spodumene, kunzite, chrysocolla, hemimorphite, willemite, apophyllite

**Oxides** (~5): wulfenite, magnetite, raspite, stolzite, clinobisvanite

**Special** (~6): ruby, sapphire, topaz, uraninite, acanthite, argentite

(Counts approximate — see `data/minerals.json` for the canonical list. 89 minerals × 1 narrator each = 89 narrators total; 89 minus 10 done = 79 remaining.)

**Suggested batch size**: 1-2 species per commit when shape is established; standalone commit for new edge cases. Don't blow past 4 in a single commit — boss prefers reviewable units.

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
| `narratives/chalcopyrite.md` | Simplest reference |
| `narratives/dolomite.md` | Multi-tier + `{Miller indices}` edge case |
| `narratives/sphalerite.md` | Two-named-variants for computed branch |
| `vugg.py` (~line 248) | Python narrative loader (`_load_narrative`, `narrative_blurb`, `narrative_variant`) |
| `vugg.py` (~14000+) | The 89 `_narrate_<species>` methods being migrated |
| `index.html` (~line 3257) | JS narrative loader — same 3 functions, plus `_NARRATIVE_MANIFEST` and async manifest fetch |
| `index.html` (~13000+) | The 89 JS `_narrate_<species>` methods being migrated |

## Boss-confirmed design decisions (don't relitigate)

From `commit 38a78fc` discussion:

1. **Two named variants for branching narrators** — logic stays in code, markdown stays markdown. No mini-languages inside markdown.
2. **Keep inline JS fallbacks for now** — drift risk is real but manageable; don't solve a problem you don't have yet. Auto-generate later if it gets annoying.
3. **Hardcoded `_NARRATIVE_MANIFEST` array → auto-generate from `data/minerals.json` keys later.** Same pattern as everything else — start manual, automate when the pattern is proven.
4. **Per-species files** (89 small files, not 10 grouped). Cleaner, independently editable, git-friendly.

## Recent commit chain

```
c551a5e  Narrative-as-data (9+10/89): siderite + rhodochrosite — carbonate group continues
e47b7a7  Narrative-as-data (7+8/89): calcite + aragonite — carbonate group begins
38a78fc  Narrative-as-data (5+6/89): rosasite + azurite — drift fix as side effect
815b0d8  Narrative-as-data (4/89): dolomite — multi-branch + {Miller indices} edge case
699c091  Narrative-as-data (3/89): aurichalcite — habit-dispatch pattern
6597f0f  Narrative-as-data (2/89): sphalerite — validates two-named-variants design
e308ada  Narrative-as-data proof-of-concept: chalcopyrite extracted to markdown
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
3. `vugg.py` — search for `# NARRATIVE TEMPLATES` to find the loader, then `_narrate_chalcopyrite` to see the simplest call site
4. `index.html` — search for `_NARRATIVE_MANIFEST` to find the JS loader, then `_narrate_chalcopyrite` for the JS call-site shape (note inline fallbacks)
5. Pick the next species — siderite-shape sister carbonates (smithsonite, cerussite, malachite) are the natural next batch. Then move into the simple sulfide group (galena, pyrite, hematite, etc.)
