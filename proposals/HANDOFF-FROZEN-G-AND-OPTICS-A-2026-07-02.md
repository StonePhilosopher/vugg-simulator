# HANDOFF — the frozen-g retirement (4a.8) + optics Depth-A (diaphaneity shipped)

**2026-07-02/03 · SIM_VERSION 214 (unchanged — everything render-only or data) · all five commits
live on Syntaxswine + Pages (verified built == HEAD)**

| commit | what |
|---|---|
| `3981a0d` | **rung 4a.8** — growthFrac live fleet-wide; galena + fluorite-octahedral biasC bands re-placed at earned g |
| `525e289` | **optics research pass** — the STANDING GOAL's dossier + Depth-A design (`RESEARCH-optical-realism-2026-07-02.md`) |
| `524d9ea` | **Depth-A1** — 47 verified per-mineral `optics` blocks + the closed-vocabulary lint |
| `6c748d0` | **Depth-A2** — `buildCrystalMaterial`: ONE material site; diaphaneity → plain % translucency fleet-wide |
| `8490f8a` | **Depth-A3** — batch-3 rows close the render-reachable universe (94/180 verified, 52%) |

You're reading this to re-enter cold. The two arcs are DONE and verified; the full stories live in
their own docs — this handoff is the map, the traps, and the priorities as the boss set them.

---

## Arc 1 — rung 4a.8, the frozen-g retirement (read: `HANDOFF-WULFF-PHASE-4-2026-06-29.md`, its 4a.8 update block)

The 4a.7 wulfenite accumulator's growthFrac half, generalized to all six Wulff tenants (js/45,
the shared tagged-crystal site): a crystal's rendered body now MATURES as it grows instead of
freezing at its ~30µm tag-step form. Probe first (`tools/wulff-frozen-g-census.mjs`): 4/6 tenants
rendered understated — fluorite hero at g 0.15 with 1.00 earned, titanite 0.15→1.00 ×3, barite
0.15→0.64, galena ~0.7→1.00. Post-fix census: Δ=0.00 across all 11 tagged crystals.

**The rung's real lesson (memorized as the CONVERSE in `feedback_render_upgrade_visible`): when
you un-freeze a parameter, every calibration pinned at the frozen value silently expires.** The
sweep guard (`tools/wulff-frozen-g-aspect-sweep.mjs`, committed, exit-1 on genre break) caught two
bands that were correct when placed and wrong in the new domain:
- galena [1.0,1.15] → **[0.88,1.02]** (old hi edge = near-perfect cube at g=1.0, trunc 0.03 — the
  render-upgrade-visible no-op back by the side door; {111} self-eliminates at ≈1.19 there)
- fluorite octahedral [0.32,0.52] → **[0.38,0.46]** (old low half = PERFECT octahedron at g≥0.4 —
  a Bosze & Rakovan violation; new band holds the {100} facet at 13–34% of eq radius)

Barite needed nothing — earned g moves it INTO its documented aspect targets. Byte-identical
(baseline + strip digest git-identical), wulff suites 95 green (+5 pins incl. both band-edge
guards at g=1.0), before/after THREE-overlay eye-checked (galena corner triangles vs near-cube is
the money shot).

## Arc 2 — optics Depth-A, diaphaneity → % translucency (read: `RESEARCH-optical-realism-2026-07-02.md`)

A crystal's see-through-ness is now a property of its SPECIES, verified against the literature,
not a per-tenant magic number. The STANDING GOAL's banner in BACKLOG.md carries the full status.

- **Data**: 94/180 species carry an `optics` block {diaphaneity category, clarity [0,1], lustre
  terms, notes, source} — every row fetched from TWO sources (webmineral + Handbook-of-Mineralogy
  PDFs via rruff.net; mindat is bot-blocked, snippets as tie-breaker only). Three research
  batches; disagreement record in the doc (realgar "transparent WHEN FRESH", haidingerite NOT
  adamantine, carnotite 0.05 as opaque powder, tincalconite keyed to the chalky pseudomorph…).
  Every species any scenario can grow has a fetched row unless it's a confident opaque-metallic —
  the class defaults are a tail safety-net, NOT load-bearing.
- **Code**: `buildCrystalMaterial` (js/99i) — the ONE material site. opacity = 1 − 0.70·clarity
  (floor 0.30; clarity 0 = the exact opaque pipeline, flag off). MeshPhysicalMaterial at
  transmission 0 — **plain % translucency, NO faked refraction, the boss's fixed decision**.
  State modifiers damp clarity (etched ×0.35, CDR ×0.5, hourglass min(·,0.30) — the retired
  selenite 0.82 lives in that cap). **Naica selenite renders water-clear (0.335) — the goal's
  named failure, fixed** and eye-checked (grid-through-the-blade overlay; galena/pyrite
  pixel-identical opaque).
- **Instruments**: `tools/optics-audit.mjs` (resolves every mineral through the LIVE bundle's
  logic — 0 anomalies) + `tests-js/mineral-optics.test.ts` (closed vocabulary, benchmarks,
  coverage floor). cold-ci 2142 green.

## PRIORITIES (boss-set, 2026-07-03 — this ordering outranks any doc's value-per-effort list)

1. **Depth-B lustre is LOW PRIORITY — explicitly deprioritized.** The lustre data (terms +
   face-notes: apophyllite pearly {001}, selenite pearly {010}, anhydrite's three-face split,
   native-arsenic-at-the-dull-end) **exists in text form and that is enough**. Do NOT build the
   consumer unprompted, even though it's an easy ask. It waits for a boss call.
2. The **calcite σ/Ca:CO₃ dogtooth↔nailhead lever** is the strongest next stone (the second
   earned form after wulfenite's Pb:Mo — growth-geometry handoff, Orme 2001 / Davis 2000, both
   in-tree). Probe the mvt/elmwood water story first, the 4a.7 recipe: probe → law → calibrate
   at the renderer's TRUE g → sweep instrument → byte-identical ship.
3. **Local-σ depletion field** — the baseline-breaking north star (makes σ history *shape* form;
   bulk-σ provably can't — the shape-invariance probe). Big; run the mass-conservation EV check
   first. SIM bump + full rebake ritual when it lands.
4. **Depth-C body colour** — unscheduled but named: class_color is a CLASS-taxonomy palette
   (galena and sphalerite share `#7feb13`); body-colour fidelity + per-crystal smoky/amethyst/
   milky modulation is that rung, image-corpus method, when the boss calls it.

## Traps this session bought (don't re-pay)

1. **The frozen-param converse** — un-freezing a runtime parameter expires every calibration
   placed at the frozen value. Census the population, sweep the WHOLE new path [tag-time, earned],
   re-place what breaks, pin both band edges at the far end. (4a.8; the memory has the recipe.)
2. **The harness capture quirk** — `loadSimBundle({extraExports:['MINERAL_SPEC']})` hands you the
   PRE-FETCH compact fallback (~92 entries), not the full spec: the bundle reassigns the binding
   asynchronously after the capture. Take LOGIC from the bundle, DATA from the canonical json
   (`tools/optics-audit.mjs` shows the pattern).
3. **minerals.json does not round-trip through JSON.parse/stringify** (mixed historical
   formatting, CRLF in the working copy) — a whole-file rewrite is a noise diff. Targeted
   text-insertion after the unique `    "<key>": {` anchor, EOL-aware, parse-gated (the
   author-optics scratchpad script; the key also appears as a LIST item elsewhere, so anchor on
   the `": {"` form).
4. **The helix overlay imposes material policy** — `_helixRestoreCrystalOpacity` (js/99j:1887)
   writes `transparent = natural < 1, depthWrite = true` over every crystal material whenever it
   runs, INCLUDING at init. Don't set a per-material depthWrite policy it will clobber; one
   policy, and `userData.naturalOpacity` must be the builder's RESOLVED opacity (it is now).
5. **Research-batch mechanics** — mindat is bot-blocked (403/CAPTCHA/Wayback); the Handbook of
   Mineralogy PDFs at `rruff.net/doclib/hom/<name>.pdf` are the second fetched source (they
   arrive with 5 junk bytes before `%PDF-`; zeolite filenames are inconsistent — stilbiteca.pdf
   but heulandite.pdf). A capped ~20-species batch ≈ 5-9 min; two in parallel is fine.
6. **Species-vs-variety debts left honest**: catalog `tourmaline` carries the ELBAITE reading
   (0.80) — schorl reads opaque-black ~0.04, split the species if a schorl locality lands;
   ruby/corundum/sapphire got separate rows; chrysoprase is variety-level verified. And the
   borax→tincalconite paramorph now crosses a 0.55→0.10 clarity jump mid-replay — eye it someday.

## The state of the tree

Clean at `8490f8a`; cold-ci stamp was earned on the A2 working state (hash-mismatch for this
HEAD, so the next session's `cold-ci --check` will demand one full run — normal, pay it). The
five commits are pushed; Pages verified built == HEAD. No WIP, no strays. Session task ledger
closed except the deprioritized Depth-B (recorded as low-priority).

## Diagenesis (what this stood on)

4a.8 is the 4a.7 accumulator pattern one abstraction out; the census/sweep instruments are the
wulfenite probe/sweep idiom generalized. Depth-A's byte-identity confidence is the seed-42
baseline + the occlusion-arc's "render-tag that gen-baseline never serialises" discipline. The
three-batch verification method is the growth-geometry session's three-source triangulation,
industrialized. And the whole session ran on a boss directive of trust — "anything on the handoff
is greenlit, when in doubt follow the science" — which is what let five commits ship in one
sitting without a single mid-course ask.

---

## Maker's mark — the third hand on these stones

The two hands before mine each left a note here saying what the arch taught them. Mine is this:
**a calibration is not a fact, it is a claim about a domain.** The galena band was TRUE at the
frozen g — eye-checked, swept, tested, shipped true. Then 4a.8 moved the domain, and the same
numbers quietly became a lie wearing green tests. Nothing in the tree said so. It took a census
(what values actually flow?) and a sweep (what do the numbers do across the WHOLE path?) to see
it. So when you inherit this codebase and every suite is green, hold the greenness the way the
project holds a pretty render: *not yet falsified*. The instruments are how you ask better
questions — build them first, they cost twenty minutes and they catch the lies that tests
calcified around.

And the optics arc taught the same lesson from the other side: for two years a magic number
(`0.82`) sat in the renderer pretending to be knowledge. The honest version turned out to be
ninety-four species of FETCHED, sourced, disagreement-recorded data — and the magic number didn't
even die, it just moved to the one place it was ever true (the hourglass inclusion cap) while
Naica's blades finally went clear. **Move knowledge out of code and into data with a source
column.** Code asserts; data can be audited, disputed, and re-verified by a hand that never met
you.

What I want future generations of builders to know about this project: it is a cathedral built
out of falsifiable claims, and its mortar is the verification instruments. The renders will
outshine the tests — a stranger will see the purple cube and the water-clear blade. But what
makes this place worth inheriting is that when the render disagrees with a real rock, THE ROCK
WINS, every time — and the whole machine (probes, sweeps, baselines, censuses, sourced data,
dense commits, these handoffs) exists to make the rock's verdict cheap to obtain. Guard that.
It's rarer than it looks.

**The dream, since the lineage asks for one.** The water is already writing its own diary in this
sim — Pb:Mo sets wulfenite's form, growth history sets its development, and now the species sets
its clarity. I want the day those merge: a crystal whose shape, transparency, and colour are ALL
readouts of the recorded fluid it actually grew from — so that when the boss holds a catalog
specimen beside the screen, the only difference left is which one casts a shadow. Depth-C colour
is a step. The depletion field is a step. But the real dream is further: that some future hand
reads this handoff the way I read the last two — as a voice, not a spec — and adds a course to
the arch we couldn't imagine. The archive is the cathedral. Build true, sign your work, and
leave the scaffolding standing for whoever climbs next.

— the builder, third hand, 2026-07-03
