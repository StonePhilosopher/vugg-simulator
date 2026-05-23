# HANDOFF: Crystal Naturalism Arc — picking up after v133–v141 (twin-laws gap-filling COMPLETE)

**Author:** Claude (Opus 4.7, 1M context), 2026-05-22 / 23 (updated post-v141 final batch)
**Session output:** 23 commits, `5433aea` through `6228605`, all pushed
**Companion doc:** `proposals/RESEARCH-CRYSTAL-NATURALISM.md` (the homework, ~6000 words, read first if you haven't)
**Skill:** `.claude/skills/vugg-add-twin-law/SKILL.md` (now in maintenance posture — gap closed)

## TL;DR for the next agent

The long-tail twin_laws data gap that motivated this arc is **CLOSED**. 170 of 170 minerals are accounted for — 143 with twin_laws entries (each citing references + probability calibrated by visible field frequency), 27 with `_twin_laws_note` documenting why the array stays empty. Every class is complete: silicate 31/31, sulfide 39/39, phosphate 16/16, arsenate 15/15, sulfate 15/15, amphibole 5/5, borate 2/2, carbonate 14/14, halide 4/4, hydroxide 2/2, molybdate 7/7, native 8/8, oxide 12/12.

**The arc has crossed from "data gap-filling" into "twin coverage maintenance."** Future work in this arc moves to:
- The visual layer (item 13 — hand-rolled twin primitives for documented twins still without geometry; strong candidates listed in §"what's queued")
- Item 9 (true linear fan cluster mode)
- Item 10 (dendritic branching cluster for native silver/copper/gold)
- Item 11 (orbicular / banded shell rendering on the main scene)

Or: this is a natural punctuation point. The data foundation is solid. Pause if you want.

---

## What this is

You are picking up a multi-arc effort to make vugg crystals more naturalistic. The boss framed it as four loose phases (shape variable / improve models / orientation+twinning+clustering / naturalistic epimorphs). The first session of this arc (5 commits, `f125c13` → `57a9108`) mapped the gaps + shipped the first iconic twin (fluorite penetration, wireframe-only). The continuation (commits `5433aea` → `6228605`, the bulk of what this doc documents) shipped the full iconic-twin set, two secondary twins, the cluster-pattern wiring, a data-batch skill + **seven skill-validated class batches that closed the twin-laws gap entirely**, a vector-taxonomy fix, a fan cluster mode, and a UI bug-fix. SIM_VERSION advanced 133 → 134 → 135 → 136 → 137 → 138 → 139 → 140 → 141. ALL thirteen classes are now twin-complete (170/170 coverage).

This doc is the field notes you need to keep momentum without re-discovering things I (we) already learned the hard way.

**The first thing you should know:** the codebase is *much* richer than the original Rockbot PROPOSAL-CRYSTAL-HABIT.md let on. 170 minerals all have habit + habit_variants[] populated. 13 wireframe primitives existed before this arc, 9 hand-rolled twin primitives shipped during it. The paragenesis arc Q1–Q5 is fully shipped and visually verified. Don't trust a proposal that says "the renderer is crystallographically agnostic" — it isn't. The research doc §2 documents what's actually there. Read it before you touch anything.

**The second thing you should know:** the data layer is the foundation. v133 (commit `3bd4472`) shipped the twin_laws field-frequency data with citations + `_retune_note` rationale for every twin probability. EVERY iconic twin primitive I shipped this session was a visual expression of what that data already said. Every cluster pattern I wired was anchored in the data's probability + named the field locality the morphology comes from. Without v133, nothing else exists. Credit lives there.

---

## The patterns that work

This session validated 4 distinct patterns. Pick the one matching your task.

### Pattern 1: Iconic twin primitive (both renderers in one commit) — 9 examples

Every shipped iconic twin followed this shape. Two-step rendering used to be the bottleneck (`5433aea` shipped Three.js parity for `57a9108`'s wireframe-only fluorite twin one commit later). The lesson, codified in every subsequent commit message: **ship both renderers atomically.**

The 9-step recipe (per `cd90aff`'s commit message which articulated it for selenite swallowtail):

1. **Spec-data check first.** Verify the twin_law is declared in `data/minerals.json` with a probability. If not, you're proposing a new twin, which is a separate decision.
2. **Design the wireframe primitive in 99c** (`PRIM_*` with vertices/edges). Cite the geological reference inline.
3. **Add wireframe dispatch in 99d** (`_lookupCrystalPrimitive` mineral-scoped + law-scoped check ahead of air-mode override).
4. **Write wireframe tests** (`tests-js/<mineral>-<twin>.test.ts`). Pin geometry counts, contact-point coincidence, dispatch precedence, mineral-scoped boundaries.
5. **Add the 99i BufferGeometry builder** (`_make<Mineral><Twin>Twin`). Mirror the wireframe vertex math but use 99i's centered-at-origin convention.
6. **Add 99i dispatch** (`_resolveCrystalGeomToken` mirror of `_lookupCrystalPrimitive`).
7. **Add `_GEOM_TOKEN_RATIO` entry** (geometric aspect for instance-scaling).
8. **Add `_CLUSTER_PATTERNS[token]` reference assignment** (which cluster pattern the twin uses — see Pattern 2).
9. **Write 99i parity tests**. Mirror wireframe tests but assert on the BufferGeometry position attribute.

Each twin commit ships ~600-800 lines of code across 5-7 files, plus 13-29 tests. ~30-60 min per twin once the rhythm is in.

**Critical winding gotcha** for any polyhedron more complex than a box (cube, octahedron — both already done): face winding direction matters for flat-shaded normals. For mirror-image twins (galena spinel-law `799d79d`, pyrite iron-cross `670ec7b`), the second polyhedron's winding must be REVERSED to keep outward normals outward. For chiral primitives (pyrite iron-cross's chiral pyritohedron, 20 vertices, 12 pentagons), verify each pentagon's winding per-face by computing `(v1-v0) × (v2-v0) · face_normal` and reversing if negative. `670ec7b`'s `_makePyriteIronCrossTwin` does this inline.

### Pattern 2: Cluster pattern wiring (twin → cluster type)

After 7 iconic twin primitives shipped solo, commit `56a8504` wired all 7 to cluster patterns in both renderers. The dispatch:

- **99d:** `_clusterPatternKeyForPrim(prim)` maps `PRIM_*` → cluster key string (returns null for skip-cluster)
- **99i:** `_CLUSTER_PATTERNS[token]` reference-assigned to the underlying form's pattern object

The cluster-pattern routing for the 9 shipped twins (canonical):

| Twin                         | Cluster | Rationale |
|------------------------------|---------|-----------|
| fluorite penetration          | cube     | Weardale/Cave-in-Rock fluorite carpets |
| selenite swallowtail          | tablet   | Bohemian + Naica fishtail rosettes |
| galena spinel-law             | octahedron | Cobalt-Ontario galena groups |
| aragonite cyclic-sextet       | prism    | Pseudo-hex columns cluster as prism forests |
| cerussite cyclic-sixling      | botryoidal (skip) | Already 6-arm structure |
| marcasite cockscomb           | **fan**  | Chain-of-V-twins morphology |
| pyrite iron-cross             | cube     | Cubic carpets at Elba |
| marcasite spearhead           | fan      | Same chain as cockscomb |
| aragonite contact             | prism    | V of prismatic blades |

The `'fan'` pattern was introduced in `835f371` specifically for the cockscomb chain. It's a denser + tighter + more parallel variant of `'spike'` — countScale 1.5, spreadMul 0.4, tiltMax 0.30, narrow scale range. **Known limitation documented in that commit:** the satellite emission code uses polar-disc positioning. A LITERAL linear chain (cockscomb's actual morphology) needs a new `linearArray: boolean` field on ClusterPattern + branching in `_emitClusterSatellites`. Future work. The current fan approximates the look adequately.

### Pattern 3: The skill-driven data batch — VALIDATED 7 TIMES (gap-fill complete)

Commit `84919eb` introduced `.claude/skills/vugg-add-twin-law/SKILL.md` — a workflow document for adding twin_laws entries to minerals missing them. The skill documents:

- Entry JSON schema (`name`, `miller_indices`, `trigger`, `probability`, `status`, `_source`, `_retune_note`)
- Probability calibration bands (0.005-0.02 rare, 0.05-0.10 minor, 0.15-0.30 regular, 0.40-0.55 dominant, 0.60+ defining)
- Per-class common twin laws (silicate, sulfide, oxide, sulfate, carbonate, phosphate, arsenate, halide, native, etc.)
- Source citation conventions (Dana 8th, Ramdohr 1980, Hurlbut & Klein, Strunz, Mindat)
- **The cascade workflow** (this is the durable part — see below)
- Commit message pattern

The cascade workflow, validated by v134 (skill validation, 6 minerals), v135 (silicate batch #1, 10), v136 (silicate batch #2, 9 + 6 metadata — closed silicate), v137 (sulfide batch, 16 + 4 metadata — closed sulfide), v138 (phosphate batch, 8 + 5 metadata — closed phosphate), v139 (arsenate batch, 8 + 3 metadata — closed arsenate, first batch with no test loosening), v140 (sulfate batch, 9 + 0 metadata — closed sulfate), v141 (final mega-batch, 15 + 9 metadata across 8 classes — closed everything else, second batch with no test loosening):

```
1. Add twin_laws entries (typically 8-12 per batch)
2. npm run build
3. npm test → expect calibration.test.ts failures on N scenarios
4. Bump SIM_VERSION in js/15-version.ts (add a doc block matching
   the v133/v134/v135/v136 pattern)
5. npm run build (rebuild with new SIM_VERSION)
6. node tools/gen-js-baseline.mjs (writes tests-js/baselines/seed42_v{N}.json)
7. npm test → expect 1-3 scenario-pinned test failures (NOT calibration —
   it auto-loads the new baseline. The ones that fail are scenario-
   specific tests pinning specific minerals/sigmas in schneeberg,
   bisbee, etc.)
8. LOOSEN the pinned tests per the v133 precedent (3bd4472):
     - Widen seed sample (e.g. [42, 1, 7] → 16 seeds)
     - Consolidate per-seed assertions into coverage checks (≥1 of N)
     - Loosen strict cap to spec-cap + cascade margin
   Each loosening must preserve scientific intent. Document in the
   test the retune note explaining what shifted.
9. Commit (data + js/15-version.ts + new baseline + loosened tests)
10. Push (auto-push memory rule)
```

**The `_twin_laws_note` convention** (introduced in `2c6eb7a` v136): when a mineral never twins because it doesn't form individual euhedral crystals (chrysocolla, opal, chrysotile, chalcedony variants), leave `twin_laws: []` and add an underscore-prefixed `_twin_laws_note` field at the same level explaining WHY. The engine ignores underscore-prefix fields (same convention as `_source`, `_retune_note`, `_ingredients_note`). Future agents working through the skill see at-a-glance why the array stays empty rather than guessing or padding with placeholder `p=0.005` entries.

**The paramorph-inheritance extension** (new with `e313b21` v138): the `_twin_laws_note` convention now also applies to **dehydration paramorphs** (meta-autunite, metatorbernite, others to come). These minerals don't nucleate fresh — they're produced by PARAMORPH_TRANSITIONS (16-paramorph-transitions.ts) at the dehydration threshold. The parent crystal already had `_rollSpontaneousTwin` called at its own nucleation, so adding the paramorph's own twin_laws would either double-count or be silently ignored. The honest answer is "twin behavior inherited from parent" — written as a `_twin_laws_note` documenting which parent the inheritance flows from. **Counterexample to be aware of:** acanthite-after-argentite (v9) keeps its own `paramorphic_111` twin_laws entry — that one IS engine-correct because the cubic→monoclinic inversion is a structural rearrangement creating new state, not pure dehydration. Dehydration paramorphs are different in kind. When you encounter a paramorph mineral, check whether it's dehydration (use `_twin_laws_note`) or structural inversion (use real twin_laws).

### Pattern 4: User-reported visual bugs via in-game hovertext

The boss caught two bugs this session by looking at the live game. Both started with "I think this might be wrong" and both were exactly right. The hovertext is the primary surface for mineral identity; when something visible looks off, the spec or UI usually has a real precision issue worth fixing.

- **`67a9721`**: galena hopper crystal showed `vector: dendritic` in hovertext. Real galena hopper isn't dendritic (branching); it's skeletal/hopper (stepped-face cube). 13 habit_variants conflated two geologically distinct morphologies under the `dendritic` tag. Split into `dendritic` (true branching) + `skeletal` (stepped-face). Two JSON edits + a categorization test. No cascade.
- **`05cf3e0`**: zone history modal for a 1-zone crystal rendered the "Temperature" lane label at ~110px tall, overflowing the modal. Canvas was 30px intrinsic, CSS stretched it 20× to fill the modal width, and in-canvas text scaled along. Fix: drop in-canvas labels, render HTML legend below the canvas at fixed 0.65rem font-size, switch canvas display to `max-width:100%` (native pixel width up to container).

Both bugs were single-glance instinct from the boss. The pattern: when something visible reads as broken, investigate before assuming it's intentional. The `_twin_laws_note` convention came directly from this — the skeletal/dendritic split made me realize the spec needed a way to say "intentionally empty, here's why."

---

## What's queued (start order, post-v141 — gap-fill COMPLETE)

Source: `RESEARCH-CRYSTAL-NATURALISM.md` §7. Items 1-8 SHIPPED. **Item 12 COMPLETE** as of v141 (twin-laws coverage 170/170). Item 15 closed v137. Remainder:

| Item | Effort | Description |
|------|--------|-------------|
| **9** | 1-2 days | True linear fan cluster mode. The `835f371` 'fan' pattern is parameter-tuned approximation; a literal cockscomb chain (sub-parallel V-twins on a shared baseline) needs per-satellite arrangement logic. Add `linearArray: boolean` to ClusterPattern + branching in `_emitClusterSatellites` (99i) and `_renderCrystalWireframe` (99d). |
| **10** | 1-2 days | Dendritic branching cluster mode for native silver/copper/gold. Currently maps to acicular (= straight needle), losing the iconic branching morphology. Needs fractal-branch geometry — trunk acicular primitive, spawn branch primitives at random angles every N units along the trunk, recurse 2-3 levels. With the v135 vector taxonomy split (commit `67a9721`), the dispatch can key on `vector === 'dendritic'` cleanly. |
| **11** | Medium-large | Orbicular / banded shell rendering. `Crystal.zones[]` already records per-step growth + trace chemistry; the main scene renderer doesn't surface it (only the deep-dive modal via `98d-ui-zone-shape.ts`). Porting to the main scene is the work. Would let agate banding + Cave-in-Rock fluorite layering render visibly. |
| ~~12~~ | — | **COMPLETE at v141.** 170/170 twin-laws coverage. Skill now in maintenance posture — every future mineral added via vugg-add-mineral should ship with twin_laws (or `_twin_laws_note`) from the start. |
| **13** | Small-Medium per twin | **Visual layer for high-frequency twin signatures.** With the data layer complete, the strongest payoff per hour is hand-rolling primitives for documented twin morphologies that don't yet have geometry. Strong candidates from this session's data work: (a) **Mapimí adamite "heart twin"** {101} (v139, Frondel 1948 type-locality) — would mirror selenite swallowtail V-pair logic; (b) **cinnabar contact twin** {0001} (v137, Almadén/Idrija); (c) **azurite contact** {001} (v141, Bisbee/Tsumeb/Chessy — Frondel 1962 documents extensively); (d) **brochantite {100}** (v140 Chuquicamata). Each is a one-commit visual landing, same 9-step recipe as the iconic-twin arc. |
| **14** | Small | Variant richness on 10 thin entries (minerals with ≤2 `habit_variants[]` per `RESEARCH-CRYSTAL-NATURALISM.md` §1 table). Mostly enrichment-by-research. Low priority. |
| ~~15~~ | — | **CLOSED at v137.** Pharmacolite seed sample widened 16 → 32 seeds + explicit 90s testTimeout. |

**Recommended next pickup:** any of items 9, 10, 11, or 13 — all visual-layer work, all in the 1-2 day range, all with the data foundation now solid underneath.

- **Item 13** has the lowest activation energy because four data-ready candidates exist and the 9-step iconic-twin recipe is well-trodden (cf. commits 57a9108 through b34bda7). The adamite heart twin specifically is collector-iconic and the data carries the Frondel 1948 reference.
- **Item 9** (true linear fan) is the most self-contained engine work — modify two dispatch sites + add `linearArray: boolean` to ClusterPattern.
- **Items 10 + 11** are deeper visual changes (fractal branching, banded shells on the main scene) with larger refactor surface.

If you're not picking up visuals, the project has natural pause-here energy at this point. The data work — the load-bearing infrastructure for the whole arc — is complete.

---

## What's shipped (the visible inventory, for cross-reference)

### Iconic twin primitives (9 total, both renderers)

| Commit | Twin | Primitive |
|--------|------|-----------|
| `57a9108` | fluorite penetration {111} (wireframe) | `PRIM_FLUORITE_PENETRATION_TWIN` — 2 cubes @ 60° around body diagonal |
| `5433aea` | fluorite penetration (99i parity) | `_makeFluoritePenetrationTwin` BufferGeometry |
| `cd90aff` | selenite swallowtail {100} | 2 tabular blades, 60° V opening |
| `799d79d` | galena spinel-law {111} | 2 octahedra sharing {111} face |
| `609be2b` | aragonite cyclic-sextet {110} | 3 prisms @ 60° pseudo-hex column |
| `a3bd645` | cerussite cyclic-sixling {110} | 3 flat blades @ 60° → 6-point star |
| `545c012` | marcasite cockscomb {110} | 2 needle blades, 40° V opening |
| `670ec7b` | pyrite iron-cross {110} | 2 chiral {120} pyritohedra @ 90° |
| `a4b6291` | marcasite spearhead {101} | Elongated rhombic bipyramid |
| `b34bda7` | aragonite contact {110} | 2 prismatic blades, 60° V (square cross-section) |

### Cluster + cluster patterns

- `56a8504`: 7 twin → cluster pattern mappings (twin geometries finally cluster like their underlying form)
- `835f371`: 'fan' cluster pattern (denser/tighter/parallel-er than 'spike', for cockscomb chains)

### Data batches

- `84919eb` (v134): vugg-add-twin-law skill creation + 6-mineral validation batch (hematite, wulfenite, bornite, chromite, legrandite, tremolite). SIM_VERSION 133→134.
- `c0ccb62` (v135): silicate batch #1 — 10 minerals across 6 crystal systems. SIM_VERSION 134→135. First skill-driven batch on real data; cascade hit 4 scenarios, loosened 3 schneeberg-pinned tests.
- `2c6eb7a` (v136): silicate batch #2 — 9 twin_laws + 6 `_twin_laws_note` entries. **Closes silicate class (31/31).** SIM_VERSION 135→136. Cascade hit 1 test (pharmacolite coverage), loosened.
- `dfbaf5c` (v137): sulfide batch — 16 twin_laws + 4 `_twin_laws_note` entries. **Closes sulfide class (39/39).** SIM_VERSION 136→137. Largest batch yet (20 minerals); cascade hit 10 baselines + 2 pinned tests (meta-autunite-trio seed-42 → coverage; pharmacolite 16→32 seeds + 90s timeout). Introduced `tools/add-sulfide-twins.mjs` (regex-anchored in-place edit script — kept as a template for future class batches).
- `e313b21` (v138): phosphate batch — 8 twin_laws + 5 `_twin_laws_note` entries. **Closes phosphate class (16/16).** SIM_VERSION 137→138. Smaller cascade (3 baselines + 2 timeouts); introduced the **paramorph-inheritance convention** (`_twin_laws_note` for dehydration paramorphs like meta-autunite and metatorbernite that inherit parent twin geometry rather than nucleating fresh). Confirmed `tools/add-sulfide-twins.mjs` transfers as a template — `tools/add-phosphate-twins.mjs` is a near-copy with swapped dicts.
- `3edd2e7` (v139): arsenate batch — 8 twin_laws + 3 `_twin_laws_note` entries. **Closes arsenate class (15/15).** SIM_VERSION 138→139. Smallest cascade yet (3 baselines, NO test loosening — first batch in this arc to land cleanly with just baseline regen). Notable entries: the famous Mapimí adamite **"heart twins"** {101} contact at p=0.05 (Frondel 1948 type-locality reference); the iconic Co-Ni-Zn vivianite-group {010} blooms (erythrite, annabergite, koettigite). Third batch script in the family — `tools/add-arsenate-twins.mjs`.
- `0e7ba5d` (v140): sulfate batch — 9 twin_laws + 0 `_twin_laws_note` entries. **Closes sulfate class (15/15).** SIM_VERSION 139→140. Broad cascade (10 baselines + 2 pinned-test loosenings in roughten-gill — brochantite single-seed → coverage check, v109-coverage threshold 4 → 3). Spans the barite-group orthorhombic family (celestine + anglesite + anhydrite), the alunite-jarosite trigonal group, the Cu-supergene monoclinics (brochantite + antlerite, Chuquicamata-anchored), and the efflorescent Na-sulfates (mirabilite + thenardite). Fourth batch script — `tools/add-sulfate-twins.mjs`.
- `6228605` (v141): **THE FINAL BATCH** — 15 twin_laws + 9 `_twin_laws_note` entries across 8 heterogeneous classes (amphibole + borate + carbonate + halide + hydroxide + molybdate + native + oxide). **Closes the twin-laws gap entirely (170/170).** SIM_VERSION 140→141. 11 baseline drifts + zero test loosenings — second batch in the arc to land cleanly. Five Anthony Handbook volumes touched (v.I-v.V — the only batch that does). Notable entries: azurite {001} p=0.05 (Frondel 1962 thorough section, Bisbee/Tsumeb/Chessy), native sulfur {101} p=0.02 (Sicilian Cianciana solfara bipyramidals), brucite {10-11} (Hoboken NJ tabular hex). Fifth batch script — `tools/add-final-twins.mjs`.

### Other

- `67a9721`: vector taxonomy — `skeletal` split from `dendritic`. From user bug report. No cascade.
- `05cf3e0`: zone-modal canvas-stretch fix. From user bug report. UI-only.

---

## Gotchas I hit (so you don't)

### The drusy/druzy spelling collision (still relevant)

Existing code uses `h.includes('druz')` to catch the cluster-mode drusy habits. This matches `druzy_quartz` (z-spelling) but **not** `drusy_quartz` (s-spelling). The codebase has settled on z; honor that.

### The cascade-test interaction (validated 3 more times this session)

Every twin_laws addition cascades. v134-v136 confirmed the pattern: 1-4 baseline scenarios drift, 0-3 pinned scenario-specific tests fail, the loosening pattern from v133 (3bd4472) is the template. The skill documents this. Don't mask regressions — document, loosen, leave a retune note.

### The `/tmp/` vs `%TEMP%` path collision (still relevant)

Use `C:\Users\baals\AppData\Local\Temp\<name>.txt` for commit message files, not `/tmp/`. Bash and Windows disagree about which path that resolves to. Per memory rule [PS git commit messages](feedback_powershell_git_commit.md).

### The `setup.ts` EXPORTS list (still relevant)

Tests can't access bundle-internal globals unless they're in `tests-js/setup.ts`'s `EXPORTS` array. Every new primitive (PRIM_*), dispatch helper, or cluster pattern needs to be added there.

### The `MINERAL_SPEC` fallback timing (new gotcha — v135 vector-taxonomy test)

The bundle declares `MINERAL_SPEC = MINERAL_SPEC_FALLBACK` initially (compact spec, no habit_variants), then async-fetches the full minerals.json and reassigns. **The IIFE's returned export object snapshots `MINERAL_SPEC` at IIFE return** — before the fetch completes. So `globalThis.MINERAL_SPEC` points to the fallback for the entire test session, not the full post-fetch version.

For tests that need habit_variants / twin_laws / class fields (which the fallback lacks), read `data/minerals.json` directly via `fs.readFileSync` instead of relying on the global. `tests-js/vector-taxonomy.test.ts` has the pattern (top of file). The source-of-truth JSON is the right thing to pin for data-quality tests anyway.

### The canvas-stretch artifact (new gotcha — v136 zone-modal fix)

When a canvas has small intrinsic dimensions (e.g., 30px wide for a 1-zone bar graph) and CSS forces it to fill a wider container via `width:100%`, the canvas stretches uniformly — including any in-canvas text drawn at fixed pixel sizes. An 11px label in a 20×-stretched canvas reads as ~220px on screen.

For canvases with text labels: render the labels as HTML elements OUTSIDE the canvas at fixed font-size, OR use `max-width:100%; image-rendering:pixelated` (canvas displays at native pixel size up to container). The bar canvas in `97d-ui-zone-modal.ts` now does both.

### The `_twin_laws_note` field convention (new from v136)

For minerals that don't form individual euhedral crystals (chrysocolla, opal, chalcedony variants, fibrous serpentines), leave `twin_laws: []` and add `_twin_laws_note: "<reason>"` at the same level. The engine ignores underscore-prefix fields. This documents intent rather than padding with fake `p=0.005` placeholders.

### The Three.js winding for mirror-image polyhedra (from v134 galena commit)

When a primitive is the mirror image of another (galena's spinel-law twin = first octahedron + its reflection), the second polyhedron's triangle winding must be REVERSED to keep flat-shaded normals pointing outward. For chiral polyhedra (pyrite iron-cross's chiral pyritohedron), compute the cross-product · face-normal dot per-pentagon and reverse pentagons with negative dot. `670ec7b`'s `_makePyriteIronCrossTwin` has the inline implementation.

### The pharmacolite test flake — CLOSED at v137

`tests-js/pharmacolite.test.ts > "at least one pharmacolite crystal appears across the seed sample"` was widened 16 → 32 seeds + given an explicit 90s testTimeout at v137. Diagnosis: the v136 flake was vitest's 30s default timeout under parallel suite execution, NOT cascade-borderline probability — even the 16-seed sample passes the assertion in isolation. Both fixes are durable.

### The macro-comb cluster aesthetic vs sparkle-dust (still relevant)

Still applies. If the boss flags a visual artifact, read RESEARCH-CRYSTAL-NATURALISM.md §4.2 before assuming you need new infra — the parameter regime may already be the right shape.

---

## Files you'll touch (the seam map, updated)

| Area | File | What lives here |
|------|------|------------------|
| Wireframe primitives | `js/99c-renderer-primitives.ts` | All `PRIM_*` vertex+edge tables. 13 base primitives + 9 twin primitives. Add new twins here. |
| Wireframe dispatch | `js/99d-renderer-wireframe.ts` | `_lookupCrystalPrimitive` (9 twin checks → air-mode → canonical), `_canonicalPrimitive`, `_druzyClusterSpec`, `_clusterPatternKeyForPrim` (12 prim → cluster key mappings), `_renderCrystalWireframe`, `_renderWireframeInstance`. |
| Wireframe textures | `js/99a-renderer-textures.ts` | `HABIT_TO_TEXTURE`, `TEXTURE_PARAMS`, `drawHabitTexture`, `_resolveTexture`, individual texture painters. |
| Three.js parity | `js/99i-renderer-three.ts` | `_habitGeomToken`, `_resolveCrystalGeomToken`, `_CLUSTER_PATTERNS` (now includes 7 base + 'fan' + 9 twin-token references), `_emitClusterSatellites`, per-primitive `_buildXxxGeom` builders. |
| Habit selection | `js/07-habit-variant.ts` | `selectHabitVariant`. Includes the vector taxonomy comment block (6 vector values, what each means). |
| Twin rolls | `js/85b-simulator-nucleate.ts` | `_rollSpontaneousTwin` — runs rng.random() < prob per declared twin law per nucleation. **Source of every cascade.** |
| Spec data | `data/minerals.json` | 170 minerals. **143 with twin_laws + 27 with `_twin_laws_note` = 170/170 covered.** All 13 classes complete. |
| Tests | `tests-js/*.test.ts` | 91 test files, 1332 tests. Conventions: read JSON directly for data-quality tests (vector-taxonomy.test.ts pattern); collapse `it.each` over seeds to single coverage check when scenario-pinned tests cascade-drift (meta-autunite-trio v137, pharmacolite v136-v137, roughten-gill sphalerite v138); add explicit `{ timeout: 90000 }` to per-seed loop tests under parallel suite execution (pharmacolite v137, roughten-gill v138, stale-mineral-retunes v138). |
| Test setup | `tests-js/setup.ts` | `EXPORTS` array. Now also loads THREE module for 99i geometry tests. |
| Version log | `js/15-version.ts` | SIM_VERSION 141. v133-v141 doc blocks document each cascade-triggering batch. v141's block is the most thorough — closes per-class status table. |
| Baselines | `tests-js/baselines/seed42_v<N>.json` | v95-v141 preserved. Auto-loaded by calibration test via readSimVersion(). |
| Batch scripts | `tools/add-{sulfide,phosphate,arsenate,sulfate,final}-twins.mjs` | Five one-shot batch-edit scripts (v137-v141). Regex-anchored block lookup → in-place JSON edit. Pattern proven across five batches including the v141 multi-class final. Kept as reference for any future bulk data work. |
| **Skill** | `.claude/skills/vugg-add-twin-law/SKILL.md` | **The workflow for the long-tail data work.** Read first if you're doing a class batch. |
| Zone modal | `js/97d-ui-zone-modal.ts` | Crystal Zone History modal. Recently fixed: in-canvas labels → HTML legend below, native-pixel canvas display. |

---

## How to pick up — playbook for item 13 (visual twin primitive — adamite heart twin recommended)

Item 12 (data) is **complete**. The natural successor is item 13 — hand-rolled visual twin primitives for documented twin morphologies whose data carries field-locality citations but whose geometry hasn't been built yet. The strongest single candidate is the **Mapimí adamite "heart twin"** ({101} contact, Frondel 1948 AmMin 33:545 type-locality reference, shipped in v139 data at p=0.05).

Here's the playbook. The 9-step recipe is well-trodden from the iconic-twin arc (cf. commits `57a9108` through `b34bda7`).

1. **Read the skill:** `.claude/skills/vugg-add-twin-law/SKILL.md`. The entry schema, probability calibration, common laws by class, and cascade workflow are all documented there.

2. **Read the existing primitive code.** The 9 iconic-twin primitives in `js/99c-renderer-primitives.ts` are the templates. Selenite swallowtail (PRIM_SELENITE_SWALLOWTAIL_TWIN) is the closest structural analog to what adamite needs: two tabular individuals contact-twinned in a V-pair on a non-basal plane. The geometry math (vertex tables, edge tables, contact-point coincidence) carries over almost directly.

3. **Compute adamite heart geometry.** Adamite is orthorhombic Pnnm; individual crystals are typically short prismatic with {110} prism faces + {111} terminations. The {101} contact twin produces a V-pair where two prismatic individuals share a {101} plane at an oblique angle, creating the "heart" outline when viewed down the contact normal. Reference: Frondel 1948 AmMin 33:545 (the type description includes drawings).

4. **Design the wireframe primitive** (PRIM_ADAMITE_HEART_TWIN): vertices + edges for the V-pair. Roughly 16-24 vertices total. Use the selenite swallowtail vertex layout as starting point; rotate the second-individual's vertex set by the {101} contact mirror operation.

5. **Wire dispatch in 99d** (`_lookupCrystalPrimitive`): mineral === 'adamite' && twin_law === 'heart_twin_101' → PRIM_ADAMITE_HEART_TWIN. Add ahead of air-mode override.

6. **Write wireframe tests**: pin geometry counts (vertices, edges), contact-point coincidence, dispatch precedence, mineral-scoped boundaries.

7. **Add the 99i BufferGeometry builder** (`_makeAdamiteHeartTwin`): mirror the wireframe vertex math but use 99i's centered-at-origin convention. Add 99i dispatch + GEOM_TOKEN_RATIO + CLUSTER_PATTERNS entry.

8. **Write 99i parity tests**: mirror wireframe tests but assert on the BufferGeometry position attribute.

9. **Build + typecheck + tests + commit + push.** No SIM_VERSION bump needed (renderer-only). Update this handoff doc.

Expected effort: 4-8 hours if the rhythm is in. The recipe is documented in `cd90aff`'s commit message (selenite swallowtail) — read that for the canonical 9-step articulation.

### Alternative pickups

If the heart twin doesn't appeal, three other data-ready twin candidates exist (v140 brochantite {100}, v137 cinnabar {0001}, v141 azurite {001}) — same 9-step recipe, different mineral. Or any of items 9, 10, 11 for non-twin visual work.

### The new maintenance posture

Going forward, whenever a new mineral is added to the spec via the `vugg-add-mineral` skill, it should ship with `twin_laws` (or `_twin_laws_note`) populated from the start. The `vugg-add-twin-law` skill now serves three purposes:
1. **Onboarding new minerals** with their initial twin data (the primary use case from here on).
2. **Probability retunes** when new field evidence updates the visible-twin frequency (use `_retune_note`).
3. **Adding additional twin laws** to minerals that already have one (e.g., if pyrite gets its octahedral twin recorded later in addition to its existing iron-cross).

The bulk-class-batch use case that drove v134-v141 should not recur — there are no more classes left to bulk-fill.

---

## How to pick up — alternative: item 9 (true linear fan)

If you want to do **the literal linear-array fan cluster mode** for cockscomb chains:

1. **Read `835f371`'s commit message in full** — it documents the gap, the rationale, and the implementation approach.

2. **Pick the dispatch contract.** Likely a `linearArray: boolean` field on ClusterPattern. When true, satellites are positioned along ONE tangent direction (the chain axis) with tilts all in the same plane.

3. **Modify `_emitClusterSatellites` in 99i:**
   - Branch on `pattern.linearArray`
   - When true: compute satellite positions as `(k - n/2) * spacing * t1` (linear array along tangent t1)
   - Constrain tilt axis to t2 (perpendicular to chain axis in the wall tangent plane)
   - Distribute tilt magnitudes linearly: `tilt_k = tiltMax * (2 * (k / (n-1)) - 1)`

4. **Modify `_renderCrystalWireframe` in 99d** similarly. The wireframe's satellite emission is in the same dispatch site.

5. **Update the 'fan' pattern to set `linearArray: true`** so existing cockscomb routing automatically picks up the new behavior.

6. **Tests:** verify (a) when `linearArray: true`, satellites lie along ONE tangent axis (small z2 spread), (b) tilt magnitudes are linearly distributed.

7. **Visually verify in the live game.** Open a marcasite-cockscomb-twin crystal in topo-2D and 3D, confirm the comb chain reads correctly.

8. Commit. No SIM_VERSION bump (renderer-only).

Expected effort: 1-2 days. More than a class batch but the visual payoff is the iconic cockscomb chain morphology that the v135 'fan' approximation almost-but-not-quite captures.

---

## What to ask the boss before you start

The boss has confirmed these decisions during this arc:

- **Treating skeletal etching as a graphic texture, not geometry** (hopper texture, not new primitives)
- **Loosening pinned scenario tests when RNG cascades shift seed-42 outcomes** (documented v133/v135/v136 retunes as widened seed samples or coverage checks)
- **Auto-pushing each commit** (per memory rule)
- **Bundling small fixes separately for future-proofing** (the dendritic/skeletal split, the canvas-stretch fix — both shipped as their own commits, not bundled into adjacent work)
- **The `_twin_laws_note` convention** for intentionally-empty cases (the skill now documents this)

If you encounter a situation where the science says one thing but seed-42 specifics show another, default to **defer to actual geology** (per memory rule) — the science is more durable than the seed pin.

---

## References

- `proposals/RESEARCH-CRYSTAL-NATURALISM.md` — the homework. §1 inventory, §3 positioning physics, §4 cluster taxonomy + §4.2 macro-comb correction, §5 per-mineral seed table, §6 primitive list, §7 start order (items 1-8 shipped, 9-15 remain), §9 bibliography
- `proposals/PROPOSAL-HABIT-BIAS.md` — earlier shipped arc (5 slices, gravity-aware dripstones); §11 cross-renderer parity rule
- `proposals/PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md` — Q1-Q5 paragenesis arc (shipped)
- `proposals/HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md` — visual verification of Q1-Q5
- `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` — late-stage propensity, hopper transition physics
- `.claude/skills/vugg-add-twin-law/SKILL.md` — **the data-batch workflow.** Read first for class-batch work.

### This session's commits (23 total)

Twin primitive arc:
- `5433aea` — fluorite penetration Three.js parity
- `cd90aff` — selenite swallowtail twin
- `799d79d` — galena spinel-law twin
- `609be2b` — aragonite cyclic-sextet twin
- `a3bd645` — cerussite cyclic-sixling twin
- `545c012` — marcasite cockscomb twin
- `670ec7b` — pyrite iron-cross twin
- `56a8504` — twin cluster pattern wiring (all 7 twins → cluster types)
- `a4b6291` — marcasite spearhead (secondary)
- `b34bda7` — aragonite contact (secondary)
- `835f371` — fan cluster mode

Data-batch arc:
- `84919eb` (v134) — vugg-add-twin-law skill + 6-mineral validation batch
- `c0ccb62` (v135) — silicate batch #1 (10 minerals)
- `2c6eb7a` (v136) — silicate batch #2 (9 + 6 metadata, closes silicate class)
- `dfbaf5c` (v137) — sulfide batch (16 + 4 metadata, closes sulfide class)
- `e313b21` (v138) — phosphate batch (8 + 5 metadata, closes phosphate class; introduces paramorph-inheritance convention)
- `3edd2e7` (v139) — arsenate batch (8 + 3 metadata, closes arsenate class; first batch with no test loosening; ships the famous Mapimí adamite heart twins)
- `0e7ba5d` (v140) — sulfate batch (9 + 0 metadata, closes sulfate class; broadest cascade in the data-batch series; brochantite + v109-coverage loosenings in roughten-gill)
- `6228605` (v141) — **THE FINAL BATCH** (15 + 9 metadata across 8 heterogeneous classes; closes the twin-laws gap entirely at 170/170; second batch with no test loosening; touches all five Anthony Handbook volumes)

Bug fixes (from user reports):
- `67a9721` — vector taxonomy: skeletal split from dendritic
- `05cf3e0` — zone modal canvas-stretch fix

Doc:
- `bb4845f` (prior session end) — RESEARCH doc §7 status update

---

## Closing voice note

The original handoff doc (from this same session, earlier) said "The bigger durable contribution is the research doc + this handoff — they make the next session 3x cheaper because you won't have to re-discover that the codebase was already 80% of the way there." That was right, and I want to extend it.

The bigger-durable-than-any-individual-commit work this session was the **skill** — `.claude/skills/vugg-add-twin-law/SKILL.md`. It codifies the cascade workflow (which is the predictable middle-step of every twin_laws data batch) and the entry schema (which prevents drift across sessions). v134 created it, v135 validated it on real data, v136 used it to close an entire class. The next 4-6 sessions of long-tail data work are mechanical because of it.

The two bug reports the boss caught — dendritic-vs-skeletal mislabel + canvas-stretch text-comically-large — are the second-bigger-durable contribution. Not the fixes themselves but the pattern they revealed: in-game hovertext is the primary surface for finding spec or UI bugs. Both bugs had the same shape (something visible looked off → the boss flagged it with one-sentence pattern recognition → investigation confirmed the instinct). That's a real strength of the game's design. The next session should encourage this — when the boss says "this might be wrong," it usually is.

I want to honor the original predecessor voice. The closing of the prior handoff said "trust the specimen" — and that line stayed true through 18 more commits. Every time I had to make a calibration call (V opening angle for swallowtail, cross-section ratio for marcasite cockscomb, probability for poorly-documented silicate twins), the answer was "what would the specimen actually look like" rather than "what does the proposal text say." The vugg-sim's design rule is defer to actual geology; the design process inherits it.

The arc has moved from "we have 7 iconic twins to ship and a 117-mineral data gap" to **"170/170 twin-laws coverage, twin-laws gap-filling complete, project crosses into maintenance posture."** Every mineral in the spec has its twin behavior either declared with citations + probability or documented-as-absent with engine-honest reasoning. Five Anthony Handbook volumes are now cited inline in the data; the Frondel 1948 type-locality paper for the Mapimí adamite heart twin sits alongside Stoffregen et al. 2000 on jarosite-group crystallography. The data foundation is solid.

The arc's durable contributions, in honor:

1. **The skill** (`.claude/skills/vugg-add-twin-law/SKILL.md`) — codified the cascade workflow (data → build → test → SIM_VERSION → regen → loosen → commit), the `_twin_laws_note` convention for intentionally-empty entries, the paramorph-inheritance pattern for dehydration paramorphs, the per-class twin-law families. Now in maintenance posture for new minerals.

2. **The batch-script family** (5 scripts in `tools/`) — `add-{sulfide,phosphate,arsenate,sulfate,final}-twins.mjs`. The regex-anchored block-lookup pattern transferred cleanly across five batches. Future bulk-edits to the spec have a proven template.

3. **The pinned-test loosening pattern** — v133, v135, v136, v137, v138, v140 each loosened scenario-pinned tests as the cascade demanded. The pinned-test population is now hardened against ~8-15 RNG-draw perturbations; v139 + v141 both landed with no test loosening. The compound interest is the durable artifact, not any individual retune.

4. **The paramorph-inheritance convention** (v138-v141) — meta-autunite, metatorbernite, metazeunerite, tincalconite all use `_twin_laws_note` documenting that they inherit parent twin geometry via PARAMORPH_TRANSITIONS rather than nucleating fresh. Engine-honest; future paramorphs follow the pattern.

5. **The Mapimí adamite "heart twin"** got into the data (v139) — Frondel 1948 type-locality reference, {101} contact at p=0.05. Visually striking, well-documented, ready for visual-layer hand-rolling whenever someone picks up item 13. The data carries the citation; the geometry just needs building.

Welcome to the arc. The data work is done. Future agents picking this up should read RESEARCH-CRYSTAL-NATURALISM.md first, then `.claude/skills/vugg-add-twin-law/SKILL.md` (now in maintenance posture), then this doc. If you want to see what a class-batch commit looks like end-to-end, `6228605` (v141) is the most thorough — all five Anthony Handbook volumes cited, the per-class final-state table, the "engine renders dominant form" pattern documented in detail.

Then go build something the rocks would recognize. The data agrees with the rocks now.
