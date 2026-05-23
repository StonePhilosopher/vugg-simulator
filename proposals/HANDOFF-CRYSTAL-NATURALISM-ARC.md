# HANDOFF: Crystal Naturalism Arc — picking up after v132–v134

**Author:** Claude (Opus 4.7, 1M context), 2026-05-22
**Session output:** 5 commits, `f125c13` through `57a9108`, all pushed
**Companion doc:** `proposals/RESEARCH-CRYSTAL-NATURALISM.md` (the homework, ~6000 words, read first if you haven't)

---

## What this is

You are picking up a multi-arc effort to make vugg crystals more naturalistic. The boss framed it as four loose phases (shape variable / improve models / orientation+twinning+clustering / naturalistic epimorphs). I spent a session mapping the actual gaps against the codebase, then shipped 5 incremental items from the start order in `RESEARCH-CRYSTAL-NATURALISM.md §7`.

This doc is the field notes you need to keep the momentum without re-discovering things I already learned the hard way.

**The first thing you should know:** the codebase is *much* richer than the original Rockbot PROPOSAL-CRYSTAL-HABIT.md let on. 170 minerals all have habit + habit_variants[] populated. 13 wireframe primitives exist. The paragenesis arc Q1–Q5 is fully shipped and visually verified. Don't trust a proposal that says "the renderer is crystallographically agnostic" — it isn't. The research doc §2 documents what's actually there. Read it before you touch anything.

---

## The pattern that works (5 examples this session)

Every commit followed roughly this shape:

1. **Spec-data check first.** Grep `data/minerals.json` for what's already declared. The v133 iconic-twins commit was meant to "add 10 twin laws"; the audit found 7 already shipped (or shipped under different names — e.g. `cyclic_sixling` for cerussite is the snowflake-trilling habit, just spelled cyclically). The actual work was 4 new + 3 retunes, not 10 new.

2. **Find the dispatch seam.** Each visible feature has a single place where rendering or simulation chooses behavior. For twins it's `_lookupCrystalPrimitive` in 99d. For cluster patterns it's `_druzyClusterSpec` in 99d. For textures it's `_resolveTexture` in 99a. Once you find the seam, the change is small.

3. **Mirror across renderers.** Wireframe (99d, canvas-2D) and Three.js (99i) are TWO renderers that have to agree. They drifted apart historically (the cluster pattern system shipped in 99i but not 99d — that's what v132's port fixed). When you ship a renderer feature, check that the other one matches. Per `PROPOSAL-HABIT-BIAS.md` §11: "when one renderer ships a feature, the other should follow within a phase."

4. **Pin with isolation tests.** Every commit added a focused test file:
   - `tests-js/cluster-spec.test.ts` for the cluster spec dispatch
   - `tests-js/hopper-texture.test.ts` for the new texture
   - `tests-js/fluorite-twin.test.ts` for the twin geometry + dispatch
   These pin the contract so the next agent (you) doesn't break them by accident.

5. **Field-notes commit message.** Boss reads commit messages like papers (per the memory file). Don't summarize — document the *why*, the *physics*, the *what's deferred*. Look at any of the 5 commits this session for the template. ~5000-8000 words of dense observational text. Use the `git commit -F <tempfile>` path described in §"Gotchas" below.

---

## What's queued (start order, post-session state)

Source: `RESEARCH-CRYSTAL-NATURALISM.md` §7. Items 1–5 shipped this session. Remainder:

| Item | Effort | Description |
|------|--------|-------------|
| **5b** | Half-day | Three.js parity for fluorite penetration twin. Wireframe shipped in `57a9108`; 99i needs a `_buildFluoriteTwinGeom` BufferGeometry builder + dispatch via `_resolveCrystalGeomToken`. Same geometry math (Rodrigues rotation 60° around [1,1,1]/√3), different mesh format. |
| **6** | Half-day each | More iconic twin primitives. Same dispatch pattern as `57a9108`. Targets, in rough impact order: gypsum swallowtail (`selenite` + twin_law='swallowtail', existing p=0.18, fires in many scenarios), marcasite cockscomb ({110} repeated, v133 set p=0.55), cerussite cyclic_sixling (existing p=0.4, snowflake-trilling habit), pyrite iron-cross ({110}, v133 set p=0.07), galena spinel-law ({111} contact, v133 set p=0.10), aragonite cyclic_sextet (existing p=0.4, pseudo-hex). Each is a self-contained commit. |
| **7** | 1 day | True single-anchor 'fan' cluster mode. Requires plumbing `tiltMax` through `_renderWireframeInstance` (currently uses fixed σ=12° Gaussian). The wireframe spike pattern currently produces tight-parallel "spiky druzy" rather than a true cone-fan. The Three.js version (99i `_CLUSTER_PATTERNS.spike`) already does this via Rodrigues rotation; wireframe needs to catch up. After this lands, radiating-spray habits get a real radial geometry instead of just acicular satellites in a tangent disc. |
| **8** | 1–2 days | Dendritic branching cluster mode for native silver/copper. Currently maps to acicular (= straight needle), losing the iconic branching morphology. Needs fractal-branch geometry — start with a trunk acicular primitive, spawn branch primitives at random angles every N units along the trunk, recurse 2–3 levels. |
| **9** | Medium-large | Orbicular / banded shell rendering. The `Crystal.zones[]` array already records per-step growth + trace chemistry; the renderer doesn't surface it. Would let agate banding + Cave-in-Rock fluorite layering render visibly. `98d-ui-zone-shape.ts` already does this for the deep-dive modal — porting to the main scene is the work. |
| **10** | 4–6 sessions | Per-class twin data coverage. 109 of 170 minerals still lack twin_laws[]. Grouped by class for batchability: silicate 25, sulfide 22, phosphate 13, arsenate 12, sulfate 9, others 28. Each session = one class batch = ~15–25 mineral spec entries with literature citations. Same pattern as v133 — adds RNG draws, drifts baselines, needs SIM_VERSION bump + new baseline. The hardest part is the research per mineral; the code change is trivial JSON edits. |
| **11** | Small | Variant richness on 10 thin entries (minerals with ≤2 `habit_variants[]` per `RESEARCH-CRYSTAL-NATURALISM.md` §1 table). Mostly enrichment-by-research. Low priority. |

**Recommended next pickup:** start with **5b** (Three.js parity for fluorite twin) if you want to honor the cross-renderer parity rule before opening more wireframe-only commits. Or skip ahead to **6/gypsum swallowtail** if you want maximum visible impact next (gypsum fires across every evaporite and supergene scenario, so the visual payoff is larger than fluorite's).

---

## Gotchas I hit (so you don't)

### The drusy/druzy spelling collision

Existing code uses `h.includes('druz')` to catch the cluster-mode drusy habits. This matches `druzy_quartz` (the z-spelling — what `HABIT_TO_PRIMITIVE` uses) and `druze_carpet` but **not** `drusy_quartz` (the s-spelling — what I instinctively typed in my first test pass). I lost ~10 minutes thinking my code was broken before realizing the substring check was working correctly and my test string was the wrong spelling. The codebase has settled on z; honor that.

### The cascade-test interaction

When you ship a data change that affects RNG consumption (e.g., adding twin_laws[] to a mineral that previously had none), `_rollSpontaneousTwin` adds one new `rng.random()` per nucleation. This cascades through every subsequent RNG-dependent decision. v133's 7 twin edits drifted 29 of 30 scenarios. Two tests broke (`roughten-gill.test.ts` had explicit-mineral assertions; `calibration-assertions.test.ts` §4.1 pinned the uranophane 2-of-2 win from v128). I updated both with v133-era retune notes explaining the cascade. **Don't mask the regression** — document it, loosen the seed-42-specific pin to a coverage check, leave a retune note explaining what shifted. The same pattern will repeat every time you ship more twin_laws.

### The `/tmp/` vs `%TEMP%` path collision

The first time I tried to commit with `git commit -F /tmp/commitmsg.tmp`, the file went to a Unix-style /tmp/ path but the actual content was stale from an earlier session. Git happily committed with the stale message. **Use the Windows-style path** for commit message files: `C:\Users\baals\AppData\Local\Temp\<name>.txt`. Bash's `$TEMP=/tmp` and Windows's `%TEMP%=C:\...\Local\Temp` are two different paths; the Write tool uses one, git's `-F` flag uses the other depending on which subprocess opens it. I had to `git commit --amend -F <correct-path>` to fix the first time it bit me. See the per-memory rule: `[PS git commit messages](feedback_powershell_git_commit.md)`.

### The `setup.ts` EXPORTS list

Tests can't access bundle-internal globals unless they're in `tests-js/setup.ts`'s `EXPORTS` array (which gets injected into the IIFE's return object). When you add a new helper function (e.g. `_druzyClusterSpec`, `_resolveTexture`, `PRIM_FLUORITE_PENETRATION_TWIN`), you have to also add it to EXPORTS or the test will fail with `ReferenceError: X is not defined`. Five commits this session, three needed setup.ts additions. The pattern is documented in the file's header comment.

### The macro-comb cluster aesthetic vs sparkle-dust

The boss flagged that the wireframe's existing drusy cluster looked like "sparkle dust" instead of the "forest of recognizable mm-scale points" you see in a real vug cross-section (the photo correction from this session). The fix wasn't a new cluster mode — it was acknowledging that "druzy/palisade" spans a size spectrum from microcrystalline sugar to macrocrystalline comb, and the wireframe was tuned for the micro end only. v132's port to `_druzyClusterSpec` parameterized the spectrum properly. If the boss flags a visual artifact, **read RESEARCH-CRYSTAL-NATURALISM.md §4.2 before assuming you need new infra** — the parameter regime may already be the right shape.

### The Three.js `_habitGeomToken` columnar carve-out

When I added `h.includes('radiating')` to 99i's `_habitGeomToken` to route radiating-needle habits to 'spike', I had to carve out `radiating_columnar` specifically (it's a forest of columns, not a fan of needles). The order of checks matters AND the substring overlap matters. `radiating_blade` was already caught by the earlier `h.includes('blade')` check, but `radiating_columnar` would have fallen into my new radiating branch without the carve-out. Read every existing check before adding a new substring match — you may need to put it earlier, later, or with a sub-condition.

---

## Files you'll touch (the seam map)

| Area | File | What lives here |
|------|------|------------------|
| Wireframe primitives | `js/99c-renderer-primitives.ts` | All `PRIM_*` vertex+edge tables. Add new twin primitives here. |
| Wireframe dispatch | `js/99d-renderer-wireframe.ts` | `_lookupCrystalPrimitive` (twin override → air-mode → canonical), `_canonicalPrimitive` (HABIT_TO_PRIMITIVE + fuzzy fallback), `_druzyClusterSpec` (cluster pattern dispatch), `_renderCrystalWireframe`, `_renderWireframeInstance` (per-instance painter — uses fixed σ=12° scatter; this is where you'd plumb tiltMax for item #7). |
| Wireframe textures | `js/99a-renderer-textures.ts` | `HABIT_TO_TEXTURE`, `TEXTURE_PARAMS`, `drawHabitTexture`, `_resolveTexture`, individual texture painters (`_texture_sawtooth`, `_texture_botryoidal`, `_texture_saddle_rhomb`, `_texture_hopper`). |
| Three.js parity | `js/99i-renderer-three.ts` | `_habitGeomToken`, `_resolveCrystalGeomToken`, `_CLUSTER_PATTERNS`, `_emitClusterSatellites`, per-primitive `_buildXxxGeom` builders. **This is the renderer that needs to catch up** to wireframe for the fluorite twin (item 5b). |
| Habit selection | `js/07-habit-variant.ts` | `selectHabitVariant` — picks a habit variant at nucleation based on σ / T / space / fill triggers. This is where the runtime decides whether a fluorite gets habit='cubic' (the standard) vs. one of its other variants. |
| Twin rolls | `js/85b-simulator-nucleate.ts` | `_rollSpontaneousTwin` — runs rng.random() < prob per declared non-event twin law per nucleation. **This is the function that consumes RNG when you add new twin_laws** and is the source of v133's baseline cascade. |
| Spec data | `data/minerals.json` | 170 minerals. `habit_variants[]`, `twin_laws[]`, `paramorph_origin`, etc. All edits here have potential to drift baselines via RNG cascade. |
| Tests | `tests-js/*.test.ts` | Vitest, jsdom env. Each test file declares the globals it needs from `setup.ts`'s EXPORTS list. Pattern: `declare const X: any;` at top of file. |
| Test setup | `tests-js/setup.ts` | `EXPORTS` array — names exposed to globalThis. **Add new helper names here** when you want tests to access them. |
| Version log | `js/15-version.ts` | `SIM_VERSION` constant + per-bump block comment. **Bump this any time the simulation state changes** (twin_laws add, stoichiometry change, etc.). Renderer-only changes don't bump it. |
| Baselines | `tests-js/baselines/seed42_v<N>.json` | One per SIM_VERSION. **Regen with `node tools/gen-js-baseline.mjs` after a SIM_VERSION bump.** Don't touch the file directly — let the tool write it. |

---

## How to pick up — step-by-step for the next concrete task

If you want to do **item 5b (Three.js parity for fluorite twin)**, here's the playbook:

1. Read `57a9108`'s commit message (`git show 57a9108`) for the geometry math and dispatch precedence.
2. Read `js/99c-renderer-primitives.ts` lines around `PRIM_FLUORITE_PENETRATION_TWIN` to see the rotation matrix and vertex layout.
3. In `js/99i-renderer-three.ts`, find `_resolveCrystalGeomToken` (it's the dispatcher mirror of wireframe's `_lookupCrystalPrimitive`).
4. Add a twin check at the top:
   ```typescript
   if (crystal && crystal.mineral === 'fluorite' && crystal.twinned
       && crystal.twin_law === 'penetration') {
     return 'fluorite_twin';
   }
   ```
5. Add a Three.js mesh builder `_buildFluoriteTwinGeom(geomToken)` that constructs a BufferGeometry with two interpenetrating cubes. Look at how the existing `_buildXxxGeom` functions (e.g. `_buildDripstoneGeom` for slim icicle) are structured. Use the same Rodrigues rotation math from the wireframe primitive.
6. Wire the builder into the dispatch where canonical-cube meshes are built. Search for `'cube'` mesh build calls; add a parallel `'fluorite_twin'` build call.
7. Add tests to `tests-js/fluorite-twin.test.ts` (or a new `fluorite-twin-three.test.ts`) verifying the Three.js path emits the right mesh.
8. Build, full test suite, commit with the field-notes message template.
9. Push (auto-push memory rule).

The commit doesn't need a SIM_VERSION bump (renderer-only) and shouldn't change any baselines.

---

## What to ask the boss before you start

If you have to make a judgment call larger than these patterns can decide, ask. From this session, the boss said yes to:
- Treating skeletal etching as a graphic texture, not geometry (anchored hopper texture as `_texture_hopper`, not as new primitives)
- Loosening calibration assertions when RNG cascades shift seed-42 outcomes (documented v133 regressions as 1-of-2 floor instead of 2-of-2 pin)
- Auto-pushing each commit (per memory rule)

If you encounter a situation where the science says one thing but seed-42 specifics show another, default to **defer to actual geology** (per memory rule) — the science is more durable than the seed pin.

---

## References

- `proposals/RESEARCH-CRYSTAL-NATURALISM.md` — the homework (§3 universal positioning physics, §4 cluster taxonomy with the §4.2 macro-comb correction, §5 per-mineral seed table, §6 primitive list, §7 start order, §9 bibliography)
- `proposals/PROPOSAL-HABIT-BIAS.md` — earlier shipped arc (5 slices, gravity-aware dripstones); §11 cross-renderer parity rule
- `proposals/PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md` — the Q1–Q5 paragenesis arc (shipped)
- `proposals/HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md` — visual verification of Q1–Q5 in mvt/bisbee/supergene
- `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` — late-stage propensity, hopper transition physics (Tanaka et al. 2018 — used as source for v134's hopper texture)
- This session's commits:
  - `f125c13` — wireframe cluster-spec parity + research doc
  - `3bd4472` — v133 iconic twins data (SIM_VERSION 132→133)
  - `a7dc360` — hopper/skeletal stepped-notch texture
  - `b573915` — radiating habits → PRIM_ACICULAR
  - `57a9108` — fluorite penetration twin primitive (first iconic twin geometry)

---

## Closing voice note

The arc started with a Rockbot proposal that mischaracterized the starting state — "the renderer is crystallographically agnostic" — and a real photograph the boss showed me of vein-comb quartz growing in stacked ranks following the local wall normal. The photograph carried more information than the proposal did, because it showed me what I was actually missing (macro-comb scale, not nonexistent infra).

If you find yourself working from a proposal and the result feels wrong against a real specimen, **trust the specimen**. The vugg-sim's design rule is "defer to actual geology"; the same rule applies to the design process. Real rocks settle ambiguities that pure-science prose can't.

Five commits later, the rendered crystals visibly cluster, twin, terrace, fan, and (for fluorite) interpenetrate as two cubes. That's a non-trivial naturalism gain in one session, but the bigger durable contribution is the research doc + this handoff — they make the next session 3x cheaper because you won't have to re-discover that the codebase was already 80% of the way there.

Welcome to the arc. Read RESEARCH-CRYSTAL-NATURALISM.md first.
