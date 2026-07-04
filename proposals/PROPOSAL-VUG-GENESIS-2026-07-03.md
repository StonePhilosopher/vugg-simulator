# PROPOSAL — VUG GENESIS: the cavity's own ontogeny (W-K)

**2026-07-03 · workstream W-K of the roadmap · researched + citation-verified this session
(8 agents: cavity-code census + 4 literature sweeps + adversarial verification) · boss ask:
"we need to scope out more realistic vuggs too. there's such a large variety of shapes and
textures. realistic vuggs is important because botryoidal forms grow differently on highly
modeled surfaces. i imagine there's some that start out as veins of some other material and
that gets worn away first, making an empty cavity."**

Both of the boss's claims came back from the literature VERIFIED, not merely plausible:

- **"Starts as a body of other material that gets worn away"** is the canonical geode-genesis
  model: Chowns & Elkins 1974 (J. Sed. Petrology 44(3):885-903, ✓ Crossref-confirmed to the
  DOI) — quartz geodes are pseudomorphs after sabkha ANHYDRITE NODULES: silica rinds the
  nodule before compaction, the anhydrite core later dissolves, and the vug is literally the
  interior of the silicified nodule. Fort Payne/"Warsaw" formations, Woodbury, **Tennessee**.
- **"Botryoidal forms grow differently on highly modeled surfaces"** is Self & Hill 2003's
  SUBSTRATE SELECTION, verbatim (✓ fetched): the individual "growing from a convex substrate
  protrusion during competitive growth will continue its growth at the expense of its
  neighbors growing from flat or concave surfaces" — and for branching aggregates the effect
  is "very strong."

W-F gave the crystals their biography; W-K gives the CAVITY its own — exsolved as a bubble,
opened as a fissure, dissolved as karst, cracked as a concretion, or inherited as the negative
of a body that existed first and left.

---

## 1. What the tree does today (census, file:line verified — more than the lore suggested, less than nature needs)

The cavity machinery is real: `_buildProfile3D` (js/22:784-905) builds a deterministic 3-stage
SPHERE-UNION (primary + secondaries + tertiaries, mulberry32(shape_seed)), with per-scenario
knobs (vug_diameter/size_class, bubble counts, shape_seed) and five ARCHITECTURE archetypes
(spherical / irregular / tabular / pocket / basin) carrying elongation (tabular: equatorial
1+0.55·cos2θ) and polar_collapse (basin sigmoid). Dissolution recedes the wall per-cell
(erodeCells adds wall_depth; the mesh signature rebuilds; acid-shielding by crystal footprints
and feeder-column lopsidedness already work). That is a solid foundation. The gaps:

1. **One generation path, five costumes.** All 38 scenarios flow through the same sphere-union;
   the only true shape FAMILIES in play are basin and tabular-lens — "everything else is the
   same bumpy sphere at different lumpiness" (census). Worst case found: **grimsel_alpine_cleft
   and tormiq use architecture 'pocket'** — the alpine CLEFT scenarios have round-pocket
   cavities (scenarios.json5:2308-2312, 2380-2384), while real clefts are planar slabs with
   aperture cm–1.2m and in-plane extent to metres (✓ fetched).
2. **Hard topology ceiling:** one radius per direction from one origin (star-convex, js/23:
   515-556). No overhangs, no multi-chamber (the raycast explicitly skips disconnected
   spheres), no true polar-flattened fissure (elongation is equator-only, capped 0.85; the
   polar floor is 0.5).
3. **Dissolution sculpting is confined to RING 0** — the only wall_depth writers touch
   `rings[0]` (js/22:1283-1300). Fifteen of sixteen rings are frozen at init forever; the "3D"
   cavity is dynamically 2D.
4. **Zero 3D wall microtexture.** No bump/normal/displacement maps exist anywhere in the
   renderer; the 2D topo canvas has scallop/sawtooth edge textures (js/99a) that the 3D wall
   never got. The one surface knob is flat-shading ('sharp').
5. **The 4-blob botryoid ignores the wall.** `_makeBotryoidalCluster` is a standalone 4-sphere
   blob at a single anchor cell's radius along a RADIAL normal (js/99i:1758-1787, 3881-3905) —
   it does not mantle topography. (Cluster satellites DO reproject per-cell — the better
   pattern already exists in-tree.)
6. **Nucleation is geometry-blind.** Nothing reads curvature, protrusion, or mesh normals as a
   nucleation/growth input — "a bubble-union promontory and an alcove with identical chemistry
   are indistinguishable to the engine" (census). The WallMesh normals + adjacency
   infrastructure exists (js/23:249-273) and is consumed only by rendering and diffusion.

Ready substrates the census flagged: the post-rescale `bubbles` array is retained explicitly
for future renderer modes (js/22:893-895); `uVugCellRadii` already ships per-cell radii to the
shader; per-vertex-nucleation machinery exists (chemistry-weighted) and is the natural carrier
for a geometry weight.

## 2. The genesis taxonomy (verified; the shape families nature actually uses)

| genesis | shape family | wall character | scale | sim tenant |
|---|---|---|---|---|
| **basalt vesicle/amygdale** (✓ MTU fetched) | equant spheres in the flow TOP, vertical pipe tubes at the BASE, barren core — shape is f(height in flow) | glassy, then the GREEN PRIMER (below) | ~5–15mm, tail to 10cm | deccan_zeolite |
| **miarolitic pocket** (✓) | blocky irregular, seeded on the body's CORE/centerline | coarse crystal substrate; LOW nucleation density → few large euhedral gems | cm–m | gem_pegmatite, tormiq |
| **lithophysa/thunderegg** (✓) | spherulite shell enclosing an angular STAR void; agate inward | radial-fiber shell interior | 5–20cm | future |
| **MVT hydrothermal karst** (✓) | collapse-breccia void networks + bedding-parallel dissolution lenses; m-scale "crystal caverns" | corroded carbonate; low nucleation density → giant crystals | dm–m | mvt, elmwood |
| **alpine cleft** (✓ Ricchi 2021 SJG fetched) | PLANAR SLAB perpendicular to host foliation; aperture cm–1.2m, extent to metres; two facing walls, opposed druses meeting at a median seam; RE-OPENED repeatedly over Myr (each re-opening = resorption + renewal — the sceptre arc's mechanism, now with its tectonic justification) | angular fracture steps (the ANTI-scallop), chlorite dusting [from-memory flag] | dm–m | grimsel, tormiq |
| **septarian cracks** (✓) | radial + polygonal crack network inside an ellipsoid; aperture taper direction is SOURCE-DEPENDENT → a tunable, not a law | mud/carbonate; wall-to-center size-graded fill | 15–70cm host | future |
| **fossil mold** (✓ NPS) | the ORGANISM'S surface — ribbed shell, ringed crinoid column; geopetal half-fills | ornament biases nucleation | mm–dm | future (boss delight territory) |
| **boxwork** (✓ NPS Wind Cave) | the INVERSE: vein fins standing after host removal | mm fins, cm projection | — | render-mode only, far future |

## 3. Precursor dissolution — the boss's hypothesis, made architecture

The research's unifying law (✓ verified as synthesis): **the vug's bounding surface is the
negative of an earlier body, so cavity shape families map one-to-one onto precursor-body
shapes** — nodule (subspherical/cauliflower), euhedral crystal mold (halite hopper, gypsum
swallowtail — a POPULATION of small crystal-shaped voids), tabular vein, leached-sulfide
cellular lattice (gossan boxwork, whose cell geometry is DIAGNOSTIC of the parent sulfide —
Blanchard Bull. 66), shell. Three consequences worth building around:

1. **Factor genesis as (precursor shape generator) × (dissolution) × (lining/fill).** Adding a
   new genesis = one shape generator; the lining kernel is shared. And the precursor shape
   generators for crystal molds ALREADY EXIST — they are the habit meshers, run in reverse as
   voids.
2. **The two-clock rigidity law** (Chowns & Elkins's own argument): a rigid shell (silica rind,
   oxide septa, cement) must form BEFORE the core dissolves, or the host collapses into the
   void. Model as rigidity clock vs dissolution clock; if dissolution wins, the open geode
   degrades to a squashed mold — a failure mode that is itself geologically real and renderable.
3. **fill_fraction spans the whole observed spectrum** — the same genesis yields open mold
   (f≈0), lined geode (intermediate), geopetal half-fill, or solid pseudomorph/cauliflower
   chert (f=1). One knob, four specimen types.

Negative results kept honest: Keokuk pseudocubic quartz is NOT reliably a calcite-mold
pseudomorph (the fetched source favors direct precipitation — do not model it as inherited);
dissolved carbonate VEINS widen into generic planes rather than preserving crystal shapes
(only boxwork septa preserve the parent's geometry).

## 4. Botryoidal on a modeled world — the coupling, now a law set

The full verified spec for the substrate-aware colloform engine (all Self & Hill 2003 ✓
fetched unless noted):

- **Substrate selection:** seeds and growth favor CONVEX protrusions; hollow-growers are
  entrapped by neighbors. (The quantitative curvature→probability form is a modeling choice —
  the literature is qualitative; flagged.)
- **The atomic unit is a wall-clipped hemisphere of radiating fibers** (sphere in free fluid);
  fiber count grows ∝ cap area (space-filling requires continuous re-nucleation — Sun/Gilbert
  2020 ✓); fibers freeze on impingement; off-radial fibers prune — geometric selection at
  fiber scale.
- **Bands follow the wall contour, then RELAX:** "a leveling out of the growth front and a
  progressive trend toward more closely parallel growth" — successive shells = normal dilation
  + curvature-proportional smoothing (a low-pass filter on wall roughness with thickness).
  Never stamp identical offset copies of the wall.
- **Convex fans diverge; concave hollows converge and choke;** where lobes meet, a contact
  face — the SAME induction-surface concept as W-F O2. One suture mathematics serves both
  workstreams.
- **Lobe size = weighted growth tessellation** of seed spacing × start times × rates
  (primogeniture + protrusion advantage) [flagged as synthesis — Johnson-Mehl mapping is ours].
- **Band thickness is a SUPPLY record, not a Liesegang clock** (✓ — and agate spacing
  explicitly does not follow Jablczynski's law): the existing event-pulse machinery IS the
  band driver. Symmetric supply → equal concentric bands; directional supply → lopsided
  spheroidalite banding. Interruptions re-run selection — crustiform banding for free.
- **Colloform is CRYSTALLINE** — Roedder 1968 (Econ. Geol. 63(5):451-471, ✓ verified to the
  abstract): dense euhedral micro-druses under high supersaturation, not gels. So the
  botryoidal engine anchors to the existing Wulff/fiber kernel — the 4-blob hack retires onto
  bedrock, exactly as `feedback_bedrock_over_effect_hacks` demands.
- **Texture-vs-σ ladder** (✓ IAGI/Fournier): σ≫quartz-saturation → colloform band; moderate →
  comb; low → isolated euhedral overgrowths. The per-layer texture selector keys to the σ the
  engine already computes.
- **Druse coarsening has exact exponents** (Krapivsky 2019 ✓, PDF read: survivors n ~
  h^(−2/3) prismatic / h^(−4/3) widening, tilt spread ~ h^(−1/3), surface grain ~ n^(−1/2)) —
  the same analytic oracle W-F O3 uses; one instrument serves both.

## 5. Wall character — the missing texture layer (verified laws)

- **Karst scallops carry a quantitative law** (Blumberg & Curl via a fetched thesis that
  reproduces the equations): scallop length L32 = 2200·ν/v — ONE scalar (paleo-flow velocity)
  plus one azimuth fully parameterizes the microtexture, and the asymmetry records flow
  direction (a hidden diagnostic readable off the render). Honest limit kept: the law is for
  flowing conduits; near-stagnant vugs should show smooth rounded etch relief, NOT scallops.
- **The primer coat** (Deccan ✓ ODP-fetched): basalt cavities never offer bare rock — Stage 0
  is a green celadonite/smectite film (with filamentous, probably biogenic fabrics!) before
  any crystal nucleates; and vesicles freeze at every stage (unfilled / primer-only / lined /
  filled) within one flow — a per-vesicle progress draw.
- **Substrate conditioning decays:** first-layer species are WALL-controlled (leached Ca/Fe/Mg
  → clays, Ca-zeolites), later layers FLUID-controlled once the lining seals the wall
  (Patagonia zeolite review ✓ fetched). Modelable as one multiplier: s(d) = exp(−d/d₀), the
  wall as a transient reagent that self-extinguishes. This is a NUCLEATION-engine hook, cheap.
- **Cleft walls are the anti-scallop:** angular fracture steps along foliation; chlorite dust
  as both wall primer and inter-generation phantom layer [chlorite specifics from-memory —
  quartzpage.de unreachable, TLS expired].
- **The Keokuk rind ladder** (✓ fetched): chalcedony rind → anhedral mosaic → subhedral comb →
  free terminations → sparse perched ACCENT species of a different mineral. That last rule —
  late-stage low-count accent crystals ON the druse — is a one-line nucleation-placement change
  with high specimen-realism yield.

## 6. The rungs

| rung | what ships | SIM impact | size |
|---|---|---|---|
| **V0 — archetype truth pass** | Give clefts a CLEFT: extend the profile builder with polar flattening (a true planar-lens family within the star-convex ceiling), move grimsel/tormiq off 'pocket'; audit all 38 wall blocks against §2's taxonomy (vesicle equant-vs-pipe, MVT bedding-lens, miarolitic core-pocket); per-scenario staging so baselines move one scenario at a time | SIM bump per scenario touched | M |
| **V1 — wall microtexture** | Displacement/normal-map layer per genesis: Blumberg-Curl scallops (flow-velocity-parameterized) for karst, fracture steps for clefts, smooth rind for sediment pockets, glassy+primer for vesicles; the 2D renderer's texture vocabulary finally reaches 3D | render-only | M |
| **V2 — primer coat + conditioning** | Stage-0 wall films (Deccan green celadonite first) + the s(d)=exp(−d/d₀) substrate-conditioning multiplier in nucleation; per-vesicle stage-freeze draws | SIM bump (nucleation weights) | M |
| **V3 — substrate-aware botryoidal** | The §4 engine: convexity-biased hemisphere seeds on the real wall field, weighted-tessellation lobes, contour-then-relax banding, σ-keyed texture ladder, supply-pulse band driver; **retires `_makeBotryoidalCluster`** (render-upgrade-visible rule: pick a wall where the difference SHOWS) | render-first (reads existing wall + anchors); full fidelity after V4 | L |
| **V4 — geometry-aware nucleation** | Curvature/protrusion as a nucleation+growth input (the WallMesh normals+adjacency finally consumed by the engine); unifies with W-F O3's geometric selection; Krapivsky exponents as the shared oracle | SIM bump | M–L |
| **V5 — precursor-dissolution genesis** | The §3 architecture: precursor shape library (habit meshers in reverse) × two-clock rigidity × fill_fraction lining. First tenants: **silicified-anhydrite-nodule geode** (Fort Payne, Tennessee — Chowns & Elkins as the scenario's paper), gypsum-mold population, gossan boxwork-lite. W-J's first paying customer (fill → event → dissolve → line is a `then:` sequence) | SIM bump + new scenarios | L |
| **V6 — whole-wall dynamics** | erodeCells beyond ring 0 (retire the dynamically-2D limitation); dissolution re-sculpting anywhere acid reaches | SIM bump | M |
| **V7 — topology breakers** | True fissure-with-two-walls, multi-chamber, standing boxwork fins — requires leaving the one-radius-per-direction representation (SDF/marching-cubes successor). HONESTLY DEFERRED; the `bubbles` array and clip-texture are the prepared substrates when it's time | architectural | XL, unscheduled |

> **V0 ✅ SHIPPED SIM 215, cleft tranche (2026-07-03)** — new `'cleft'` archetype (js/22):
> exact oblate lens `q/√(q²sin²φ+cos²φ)` at polar_flatten 0.22 in `polarProfileFactor` (the
> basin-precedent consumer-side mechanic) + in-plane elongation 0.35 → slab aspect ~4.5–6:1;
> cleft-aware `ringOrientation` (faces = footwall/hangingwall, two rim rings = 'wall') + new
> `floor_ceiling` nucleation bias → the opposed druses meeting at the median seam. grimsel +
> tormiq re-genred off 'pocket' (§1 gap 1 closed); pole caps now honor the polar profile
> (js/23 — kills the lens needle AND the latent basin north-pole spike). Growth histories
> measured bit-identical (0/37 baseline drift — anchor-geometry re-genre, zero assemblage
> churn); the structural change is pinned in tests-js/cleft-halfform.test.ts. REMAINING V0
> TRANCHE: the all-38 wall-block audit against §2's taxonomy (vesicle equant-vs-pipe, MVT
> bedding-lens, miarolitic core-pocket).

**Sequencing.** V0+V1 are the visible foundation (the cleft fix alone re-genres two scenarios).
V2 is cheap bedrock with immediate Deccan character. V3/V4 pair naturally with W-F's O2/O3 —
same induction-surface and selection mathematics, shared oracle; build them in the same era.
V5 pairs with W-J. Boss stones unchanged, as always.

## 7. Bench + catalog tie-in

Vug walls are FREE ground truth — nearly every plate photo in the catalog shows the wall
around the crystals, and nobody has to shoot anything new for V1's falsification. The geodes
in the collection are V5's acceptance specimens (fill_fraction diversity on the shelf), and a
scallop-azimuth or rind-sequence read is a new A3 metric class that costs one extra glance per
Tier-D record.

## 8. Risks + blind spots

1. **Cavity shape moves EVERYTHING** — nucleation positions, fill, occlusion. V0 ships one
   scenario at a time behind per-scenario staging, never a fleet-wide flip; every touched
   scenario gets the full rebake ritual.
2. **The topology ceiling is real and stated** — V7's honest answer is a successor
   representation, not a hack inside the current one. Until then, clefts are flattened lenses
   (good enough for the render) and boxwork stays unbuilt.
3. **Microtexture vs mesh budget** — 16×120 cells cannot carry scallops as geometry;
   displacement/normal maps carry them in the shader (zero vertex cost). If we ever densify,
   probe performance first.
4. **The stagnant-vug scallop gap** — the literature quantifies scallops for FLOWING conduits
   only; small still vugs get smooth etch relief, and pretending otherwise would be an
   effect-hack. Flagged in V1's spec.
5. **Field-guide restraint** — the cavity is the stage, not the star. Genesis character should
   read at a glance (green Deccan film, planar cleft, scalloped karst) without upstaging the
   crystals.
6. **Synthesis flags carried forward:** the curvature→probability form and the Johnson-Mehl
   lobe tessellation are OUR modeling choices over qualitative literature; the chlorite-dust
   specifics await a reachable quartzpage. If a specimen contradicts a synthesis, the
   synthesis yields.

---

The boss saw both of this arc's load-bearing truths from the drawers: cavities are inherited
as often as they are opened, and the wall teaches the crust how to grow. The literature
agreed with the rocks. It usually does.
