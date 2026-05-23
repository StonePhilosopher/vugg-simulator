# HANDOFF: Crystal Naturalism Arc — picking up after v133–v136

**Author:** Claude (Opus 4.7, 1M context), 2026-05-22 (updated end-of-session)
**Session output:** 18 commits, `5433aea` through `05cf3e0`, all pushed
**Companion doc:** `proposals/RESEARCH-CRYSTAL-NATURALISM.md` (the homework, ~6000 words, read first if you haven't)
**Skill:** `.claude/skills/vugg-add-twin-law/SKILL.md` (workflow for data batches)

---

## What this is

You are picking up a multi-arc effort to make vugg crystals more naturalistic. The boss framed it as four loose phases (shape variable / improve models / orientation+twinning+clustering / naturalistic epimorphs). The first session of this arc (5 commits, `f125c13` → `57a9108`) mapped the gaps + shipped the first iconic twin (fluorite penetration, wireframe-only). The continuation (commits `5433aea` → `05cf3e0`, the bulk of what this doc documents) shipped the full iconic-twin set, two secondary twins, the cluster-pattern wiring, a data-batch skill + two skill-validated class batches, a vector-taxonomy fix, a fan cluster mode, and a UI bug-fix. SIM_VERSION advanced 133 → 134 → 135 → 136.

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

### Pattern 3: The skill-driven data batch — VALIDATED 3 TIMES

Commit `84919eb` introduced `.claude/skills/vugg-add-twin-law/SKILL.md` — a workflow document for adding twin_laws entries to minerals missing them. The skill documents:

- Entry JSON schema (`name`, `miller_indices`, `trigger`, `probability`, `status`, `_source`, `_retune_note`)
- Probability calibration bands (0.005-0.02 rare, 0.05-0.10 minor, 0.15-0.30 regular, 0.40-0.55 dominant, 0.60+ defining)
- Per-class common twin laws (silicate, sulfide, oxide, sulfate, carbonate, phosphate, arsenate, halide, native, etc.)
- Source citation conventions (Dana 8th, Ramdohr 1980, Hurlbut & Klein, Strunz, Mindat)
- **The cascade workflow** (this is the durable part — see below)
- Commit message pattern

The cascade workflow, validated by v134 (skill validation, 6 minerals), v135 (silicate batch #1, 10 minerals), v136 (silicate batch #2, 9 + 6 metadata, closed the class):

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

### Pattern 4: User-reported visual bugs via in-game hovertext

The boss caught two bugs this session by looking at the live game. Both started with "I think this might be wrong" and both were exactly right. The hovertext is the primary surface for mineral identity; when something visible looks off, the spec or UI usually has a real precision issue worth fixing.

- **`67a9721`**: galena hopper crystal showed `vector: dendritic` in hovertext. Real galena hopper isn't dendritic (branching); it's skeletal/hopper (stepped-face cube). 13 habit_variants conflated two geologically distinct morphologies under the `dendritic` tag. Split into `dendritic` (true branching) + `skeletal` (stepped-face). Two JSON edits + a categorization test. No cascade.
- **`05cf3e0`**: zone history modal for a 1-zone crystal rendered the "Temperature" lane label at ~110px tall, overflowing the modal. Canvas was 30px intrinsic, CSS stretched it 20× to fill the modal width, and in-canvas text scaled along. Fix: drop in-canvas labels, render HTML legend below the canvas at fixed 0.65rem font-size, switch canvas display to `max-width:100%` (native pixel width up to container).

Both bugs were single-glance instinct from the boss. The pattern: when something visible reads as broken, investigate before assuming it's intentional. The `_twin_laws_note` convention came directly from this — the skeletal/dendritic split made me realize the spec needed a way to say "intentionally empty, here's why."

---

## What's queued (start order, post-v136 state)

Source: `RESEARCH-CRYSTAL-NATURALISM.md` §7. Items 1-8 SHIPPED this session. Remainder:

| Item | Effort | Description |
|------|--------|-------------|
| **9** | 1-2 days | True linear fan cluster mode. The `835f371` 'fan' pattern is parameter-tuned approximation; a literal cockscomb chain (sub-parallel V-twins on a shared baseline) needs per-satellite arrangement logic. Add `linearArray: boolean` to ClusterPattern + branching in `_emitClusterSatellites` (99i) and `_renderCrystalWireframe` (99d). When true: position satellites along ONE tangent direction with tilts all in the same plane. The fan-cluster commit documents the gap explicitly. |
| **10** | 1-2 days | Dendritic branching cluster mode for native silver/copper/gold. Currently maps to acicular (= straight needle), losing the iconic branching morphology. Needs fractal-branch geometry — trunk acicular primitive, spawn branch primitives at random angles every N units along the trunk, recurse 2-3 levels. With the v135 vector taxonomy split (commit `67a9721`), the dispatch can key on `vector === 'dendritic'` cleanly. |
| **11** | Medium-large | Orbicular / banded shell rendering. `Crystal.zones[]` already records per-step growth + trace chemistry; the main scene renderer doesn't surface it (only the deep-dive modal via `98d-ui-zone-shape.ts`). Porting to the main scene is the work. Would let agate banding + Cave-in-Rock fluorite layering render visibly. |
| **12** | 4-6 sessions | **Per-class twin data coverage — REMAINING.** 77 of 170 minerals still lack twin_laws[]. The vugg-add-twin-law skill makes this mechanical: ~8-12 minerals per session, predictable cascade + SIM_VERSION bump. Use the skill. Per-class status: silicate **COMPLETE (31/31)**, sulfide **21 remaining**, phosphate 13, arsenate 11, sulfate 9, others 23 (oxide/carbonate/molybdate/hydroxide/etc.). Sulfide is the largest single remaining class. |
| **13** | Small | Marcasite spearhead + aragonite contact were the post-iconic-7 secondaries this session shipped. Future secondary twins could include: pyrite octahedral twin (rare, p=0.005?), additional marcasite/pyrite forms documented in Ramdohr. Mostly nice-to-haves. |
| **14** | Small | Variant richness on 10 thin entries (minerals with ≤2 `habit_variants[]` per `RESEARCH-CRYSTAL-NATURALISM.md` §1 table). Mostly enrichment-by-research. Low priority. |
| **15** | Small | Pharmacolite seed-sample stability. The v136 test (`tests-js/pharmacolite.test.ts` "at least one pharmacolite crystal appears across the seed sample") is widened to 16 seeds but still cascade-borderline — flaked once during this session's full-suite parallel run. Either widen further to 32 seeds OR investigate whether the chemistry gate's RNG-cascade sensitivity has a real engine bug behind it. The flake passed on retry so it's not blocking, just noisy. |

**Recommended next pickup:** **item 12 sulfide batch.** Largest remaining class, well-documented twin laws (chalcocite {110} + {111} inversion, sphalerite {111} spinel-law, arsenopyrite {100}, stibnite {130}, tetrahedrite/tennantite {111}, chalcopyrite {112}, covellite {0001} cleavage twins, etc.). Same cascade workflow as v134-v136, should be one commit with SIM_VERSION 136 → 137. Mechanical execution per the skill.

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

### The pharmacolite test flake (open issue)

`tests-js/pharmacolite.test.ts > "at least one pharmacolite crystal appears across the seed sample"` is widened to 16 seeds at v136 but cascade-borderline. Passed in isolation, flaked once during full-suite parallel run, passed on retry. Probably widening to 32 seeds would stabilize it. Not blocking but flagged in item 15.

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
| Spec data | `data/minerals.json` | 170 minerals. 87 with twin_laws (silicate class complete). 6 with `_twin_laws_note` metadata. |
| Tests | `tests-js/*.test.ts` | 91 test files, 1334 tests. New conventions: read JSON directly for data-quality tests (vector-taxonomy.test.ts pattern). |
| Test setup | `tests-js/setup.ts` | `EXPORTS` array. Now also loads THREE module for 99i geometry tests. |
| Version log | `js/15-version.ts` | SIM_VERSION 136. v133-v136 doc blocks document each cascade-triggering batch. |
| Baselines | `tests-js/baselines/seed42_v<N>.json` | v95-v136 preserved. Auto-loaded by calibration test via readSimVersion(). |
| **Skill** | `.claude/skills/vugg-add-twin-law/SKILL.md` | **The workflow for the long-tail data work.** Read first if you're doing a class batch. |
| Zone modal | `js/97d-ui-zone-modal.ts` | Crystal Zone History modal. Recently fixed: in-canvas labels → HTML legend below, native-pixel canvas display. |

---

## How to pick up — playbook for item 12 (sulfide batch)

If you want to do **the sulfide twin_laws batch (largest remaining class)**, here's the playbook:

1. **Read the skill:** `.claude/skills/vugg-add-twin-law/SKILL.md`. The entry schema, probability calibration, common laws by class, and cascade workflow are all documented there.

2. **Audit which sulfides are missing:**
   ```bash
   node -e "const m=JSON.parse(require('fs').readFileSync('data/minerals.json','utf8'));
   const sulf = Object.keys(m.minerals).filter(k => m.minerals[k].class === 'sulfide');
   const missing = sulf.filter(k => !m.minerals[k].twin_laws || m.minerals[k].twin_laws.length === 0);
   console.log('Missing:', missing.length); for (const k of missing) console.log(' -', k);"
   ```
   Expect ~21 sulfides.

3. **Group by twin-law family.** Most sulfides cluster around a few standard laws:
   - {111} spinel-law (cubic sulfides — sphalerite, chalcocite, bornite already done; tetrahedrite, tennantite, etc. share)
   - {110} or {100} (orthorhombic/monoclinic sulfides — arsenopyrite, stibnite, bismuthinite)
   - {0001} cleavage twins (layered sulfides — covellite, molybdenite — rare)

4. **For each mineral, choose probability per the skill's calibration bands.** Most sulfide twins are at p=0.02-0.10 (rare to minor common). The dominant cases (sphalerite if missed, chalcocite {110} inversion at 105°C transition) can go higher.

5. **Edit data/minerals.json.** Add the twin_laws[] entry alongside the existing fields. Cite Ramdohr 1980 §4 (FeS2/Cu2S/PbS/ZnS sections — depending on mineral) + Dana 8th as primary sources.

6. **For sulfides that DON'T form individual crystals** (typically the rare ones — millerite hair, capillary forms): use `_twin_laws_note` per the v136 convention.

7. **Run the cascade workflow** (skill step 1-9). Expect SIM_VERSION 136 → 137, baseline regeneration, 1-3 pinned test loosenings (likely in scenarios involving the modified minerals).

8. **Commit + push** with a field-notes message matching v134/v135/v136 structure.

9. **Update this handoff doc** to reflect the new state (mark sulfide done, update class status, point to the next class).

Expected effort: 30-60 min if the rhythm is in. The first pass tends to be longer (re-orient to data file structure, find each mineral's twin_laws line); subsequent batches are faster.

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

### This session's commits (18 total)

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
- `2c6eb7a` (v136) — silicate batch #2 (9 + 6 metadata, closes class)

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

The arc has moved from "we have 7 iconic twins to ship" to "we have 9 iconic + 2 secondary shipped, 1 class data-complete, 5 classes remaining at ~8-12 mineral batches each." The shape is now clear. The path is mechanical. The skill is real. The momentum is yours.

Welcome to the arc. Read RESEARCH-CRYSTAL-NATURALISM.md first, then `.claude/skills/vugg-add-twin-law/SKILL.md`, then this doc. Build something the rocks would recognize.
