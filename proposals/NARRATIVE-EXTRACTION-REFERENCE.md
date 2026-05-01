# Narrative-as-data: reference & post-mortem

**Status:** ✅ Complete (2026-04-30). All 89 species extracted; narrators are now data.
This file replaces the earlier handoff doc — preserved as a reference for anyone editing
narrative prose, adding new minerals, or extending the schema.

## What "narrators are data" means

The simulator has three runtimes (`vugg.py`, `index.html`, `agent-api/vugg-agent.js`)
that each used to carry inline narrator strings. Those strings are now in
`narratives/<species>.md` — one file per mineral, ~89 files total. Each runtime's
`_narrate_<species>` method is a thin dispatcher: it inspects the crystal state,
decides which markdown sections apply, and asks the loader for them.

Editing prose for any mineral now means editing one markdown file. Code change not
required.

## Loader API (Python + JS, identical surface)

```
narrative_blurb(species, **ctx)   → always-shown opening section (## blurb)
narrative_closing(species, **ctx) → always-shown tail section (## closing)
narrative_variant(species, name, **ctx) → conditional middle section (## variant: <name>)
```

All three accept `{key}` placeholders in the markdown that get interpolated from
ctx. Missing keys leave `{key}` literal in the output (visible spec-bug signal,
useful for `{Miller indices}` notation that genuinely shouldn't substitute).

## Markdown file format

```markdown
---
species: <name>
formula: <chemistry>
description: <one-line summary>
---

## blurb
Always-emitted opening prose (optional — some narrators are entirely conditional).

## variant: <variant_name>
Conditional middle prose. The dispatcher in code decides when to fire it.
Can use {placeholder} interpolation.

## closing
Always-emitted tail prose (optional — boss-design schema, sibling to blurb).
```

The boss's adamite + feldspar (commits `fca14e6`, `34ed3e8`) introduced the
optional `## closing` section as a structural sibling to `## blurb`. Both are
now first-class concepts in the loader.

## The shape catalog

Every narrator fits into one of these patterns. Pick the matching reference
when extending or editing.

| Shape | When | Reference |
|---|---|---|
| **Static blurb + flag conditionals** | Single always-shown blurb plus 1-3 boolean-conditional appendix sentences | `chalcopyrite.md`, `cerussite.md`, `galena.md`, `bornite.md` |
| **Two-named-variants for computed branch** | Code computes a value, picks one of two whole sentences | `sphalerite.md` (`fe_zoning_increasing` / `fe_zoning_decreasing`) |
| **3-way habit + default** | `if habit == X / elif Y / else default` | `aurichalcite.md`, `pyrite.md`, `magnetite.md` |
| **4-way habit + default** | Same pattern, four habit branches plus default | `marcasite.md`, `hematite.md`, `cuprite.md`, `native_silver.md` |
| **Multi-tier with `{value}` templates** | 3+ tiers picked by computed threshold + multiple template variables | `dolomite.md` (kim_ordered/partial/disordered with `{cycle_count}` + `{f_ord}`) |
| **Habit + dissolved-with-conversion-note** | Habit dispatch + dissolved-branch reading zone notes for paramorph vs acid | `aragonite.md`, `siderite.md`, `azurite.md` |
| **Always-emitted tail variant** | Closing always-shown variant after conditional middle | `covellite.md` (`stoichiometry`), `native_copper.md` (`statue_of_liberty_tail`), `native_gold.md` (`noble_tail`) |
| **`## closing` structural section** | Boss-design schema: closing-tail accessed via `narrative_closing()` | `adamite.md`, `feldspar.md`, `clinobisvanite.md`, `spodumene.md`, `tourmaline.md` |
| **Independent `if`-not-`elif` habit substring matches** | Multiple habit components in one habit string fire BOTH variants | `chalcocite.md` (pseudomorph + sooty) |
| **Paired branches on a binary condition** | `if X: variant_A else: variant_B` — both meaningful | `marcasite.md` (`dissolved_inversion` / `kept_orthorhombic`), `native_silver.md` (`tarnishing_full` / `tarnishing_early`) |
| **Dispatch on `dominant_forms`** | Crystal carries a `dominant_forms` list; dispatch reads it | `native_gold.md` (`alloy_electrum` / `alloy_cuproauride`) |
| **Habit + zone-note color tints** | Last zone's `note` substring-matched for color variant | `smithsonite.md`, `hematite.md` (`specular_iridescent` sub-branch) |
| **Final-color summary via `predict_color()`** | Code calls method, interpolates result into `{color}` template | `malachite.md` (`color`) |
| **No always-shown blurb (entirely conditional)** | No blurb — every emission is conditional | `calcite.md`, `goethite.md`, `pyrite.md`, `wurtzite.md`, `quartz.md`, `fluorite.md` |
| **Paragenetic-source sim-state scan** | Dispatcher reads `self.crystals` to find dissolving upstream minerals | `vanadinite.md` (vanadate_companions), `erythrite.md` (paragenetic_source_cobaltite), `annabergite.md`, `adamite.md` (olivenite_companion) |
| **Boss schema: blurb-as-opening + closing-tail** | Blurb IS the opening line (with {crystal_id}), no separate "#N grew to X mm" preamble; closing always emits | `adamite.md`, `feldspar.md` |

## File map

| File | Purpose |
|---|---|
| `narratives/chalcopyrite.md` | Simplest reference (blurb + flag conditionals) |
| `narratives/dolomite.md` | Multi-tier + `{Miller indices}` literal preservation |
| `narratives/sphalerite.md` | Two-named-variants for computed branch |
| `narratives/native_silver.md` | 4-way habit + paired tarnish + paragenesis position note |
| `narratives/quartz.md` | Most computed-value variants in one narrator (TitaniQ, fluid inclusions, growth oscillation, α-radiation tints, final size) |
| `narratives/topaz.md` | Sub-branched fluid_inclusions (geothermometer vs regular) + computed phantom pluralization |
| `narratives/feldspar.md` | Boss-canonical: blurb-with-{polymorph}-{crystal_id} + 5-way twin dispatch + closing |
| `narratives/adamite.md` | Boss-canonical: full blurb+closing schema with sim-state scan for olivenite_companion |
| `narratives/goethite.md` | No-blurb pattern (entirely conditional) |
| `narratives/chalcocite.md` | Independent-if habit substring matching |
| `vugg.py` (loader near line 320) | `_load_narrative`, `narrative_blurb`, `narrative_closing`, `narrative_variant`, `_interpolate` |
| `index.html` (loader ~line 3274) | Same 3 public functions, plus `_NARRATIVE_MANIFEST` and async fetch |

## Boss-confirmed design decisions (don't relitigate)

1. **Logic stays in code, prose stays in markdown.** No mini-languages inside markdown beyond `{key}` placeholders.
2. **Per-species files** (89 small files, not grouped). Cleaner, independently editable, git-friendly.
3. **Hardcoded `_NARRATIVE_MANIFEST` array — auto-generation deferred to BACKLOG.** See "post-completion follow-ups" below.
4. **Inline JS fallbacks preserved** for offline/file:// boot resilience. Drop-or-keep decision deferred to boss.
5. **Richer-canonical preference for divergent narrators** (memory `feedback_narrative_canonical_richer.md`): when Python and JS diverge, pick the more-evolved version regardless of runtime, then bring the other up to match.
6. **Boss's blurb+closing schema** (2026-04-30, commits `1ec52d9` / `fca14e6` / `34ed3e8`): blurb may be the opening line itself with ctx interpolation; closing is the always-emitted tail. Adopted via merge.

## Verification commands (still apply for any narrative edit)

```bash
# Run from C:/Users/baals/Local Storage/AI/vugg/vugg-simulator/
PYTHONIOENCODING=utf-8 python -m pytest --tb=line -q
node tools/sync-spec.js
# Browser smoke: reload preview, eval Object.keys(_NARRATIVE_CACHE).length === 89
```

## Post-completion follow-ups (now in BACKLOG)

- **Drop inline JS fallbacks** — the `narrative_*(...) || 'fallback string'` paragraphs in every JS dispatcher. Useful while extraction was in progress; now that all 89 are loaded into the manifest, fallbacks only matter for `file://` boots before the async fetch resolves. Boss-call whether to keep them.
- **Auto-generate `_NARRATIVE_MANIFEST`** from `data/minerals.json` keys instead of hardcoding the array. The hardcoded list is now stable but easy to forget when adding a new mineral.

Both moved to `proposals/BACKLOG.md` under the narrative-extraction follow-ups section.

## Divergent narratives still resolved per the rule

Both selenite and adamite (the two cases the boss flagged in commit `1ec52d9`) used **JS tone with Python facts**. Selenite kept JS's poetry ("the crystal that grows when everything else is ending", "epilogue crystal") with Python's cathedral_blade habit + swallowtail twin + dissolved branches folded in. Adamite went the other way — boss-pushed canonical adamite.md uses JS tone but Python's `avg_Cu` dispatch logic for the fluorescent / non_fluorescent branch. Same rule, both directions.

## Final commit chain (last 10)

```
e731f1f  Narrative-as-data (87+88+89/89): quartz + topaz + tourmaline — 89/89 COMPLETE
209aa7a  Narrative-as-data (84+85+86/89): wurtzite + spodumene + chrysocolla
1339d14  Narrative-as-data (81+82+83/89): native_tellurium + native_sulfur + native_arsenic
5f0a2cf  Narrative-as-data (79+80/89): acanthite + argentite — Ag₂S polymorph pair
9ca3698  Narrative-as-data (77+78/89): native_bismuth + clinobisvanite — Bi oxidation pair
8bbf264  Merge canonical: boss's adamite + feldspar + narrative-direction memo
9fb4ea6  Narrative-as-data (73+74+75/89): stibnite + arsenopyrite + bismuthinite
1ec52d9  Narrative direction: JS tone + Python facts (boss, on canonical)
fca14e6  Narrative: adamite — JS tone + Python facts blend (boss)
34ed3e8  Narrative: feldspar — JS canonical (boss)
```

89/89 shipped over 2 sessions. ~30 commits the second session. The boss's two
canonical files (adamite + feldspar) shaped the schema for everything that
came after.
