# PROPOSAL — THE ONTOGENY ARC: from ideal forms to grown individuals

**2026-07-03 · workstream W-F of `ROADMAP-BYTE-IDENTICAL-NATURE-2026-07-03.md` · research pass
run + citation-verified this session (15 agents; every load-bearing citation adversarially
checked, one translation detail corrected)**

Boss, 2026-07-03: *"the big ask is to mirror the complex realities of nature, the strange
interpenetrations of crystals growing together, the way one side of a crystal may grow
differently than another side. how uneven mineral inclusions can alter later layers of growth.
right now the sim is focused on creating the idealized geometric forms rather than the complex
and incomplete way they form in nature."*

---

## 0. The reframe

The field this ask names has a name: **the ontogeny of minerals** — Grigor'ev's discipline
(Grigor'ev 1965; Grigor'ev & Zhabin 1975): the life history of the mineral INDIVIDUAL
(nucleation → growth → interference → arrest/alteration) and of the AGGREGATE whose texture —
druse, crust, palisade, spherulite — is an emergent property of a population competing on a
shared substrate, not a field authored on any one crystal. Crystallography describes the ideal
form; ontogeny describes the biography. The sim currently ships the ideal form.

The Wulff arc is not wasted — it is the substrate the biography acts on. You cannot starve,
clip, or distort a form you cannot construct, and the census found the kernel is already the
right data structure (§2). The discipline that keeps distortion honest is **Steno's law**:
interfacial ANGLES are fixed by the lattice; face DEVELOPMENT is not. A "distorted" crystal is
the same normal set with unequal central distances. *Never tilt a normal to fake asymmetry* —
the classic beginner error, and this arc's first test pin.

**Prior-art headline** (from the computational survey): competitive-growth simulation exists
for thin films (van der Drift) and crack-seal VEINS (Bons 2001; Nollet et al. 2005 — the
closest engine), and Gray (1984) did generic 2-D aggregates — but **no published simulator
applies competitive faceted-polyhedra growth to mineral druses/vug linings.** This arc is
genuinely novel territory, built on well-verified 75-year-old mathematics.

## 1. The science (citations verified this session unless flagged)

| phenomenon | the law | source (status) |
|---|---|---|
| **Kinetic form** | h_i(t) = ∫R_i dt per face; slow faces dominate; habit = RATIO of face rates; a face dies when neighbors clip it out | kinetic Wulff construction; Sunagawa 2005 CUP (✓ confirmed); the in-tree model already implements the symmetric case |
| **Distortion** | angles invariant, areas free; asymmetry = per-face perturbation of h_i only | Steno 1669 / IUCr dictionary (✓ fetched) |
| **Attachment** | wall crystals are euhedral only toward open space; the substrate side is an anhedral scar; free-floaters are doubly terminated | descriptive mineralogy (✓ fetched) |
| **Geometric selection** | random-orientation seeds + equal rates → survivors are those whose fast axis is most wall-normal; density thins as a power law (d^(−1/2) in Gray's 2-D Monte Carlo; t^(−1/2)…t^(−4/3) analytic in Krapivsky) | **Kolmogorov 1949** Dokl. AN SSSR 65(5):681-684 (✓ confirmed; Engl. transl. = CRREL Draft Translation 1976, DTIC ADA019158 — NOT "AMS No. 53", corrected by the verifier); van der Drift 1967 Philips Res. Repts 22:267-288 (✓ confirmed); Gray 1984 Math. Geol. 16(1):91-100 (✓ fetched); Krapivsky, Nazarov & Tamm 2019 J. Stat. Mech. 073206 (✓ fetched) |
| **Induction surfaces** | the mutual boundary of two simultaneously-growing crystals is a CONTACT FACE, not a crystal face: "contact faces when in direct competition, true crystal faces when in indirect competition"; it sits at the equal-TIME meeting locus of the two fronts — a growth-rate-WEIGHTED surface, planar for constant rate ratio, curved when the ratio drifts (NOT the perpendicular bisector unless rates are equal) | Self & Hill 2003 J. Cave & Karst Studies 65(2):130-151, open-access PDF (✓ fetched); boundary-orientation ∝ velocity ratio: Diggle et al. 2020 (✓ fetched); weighted-Voronoi formalization: Schaudt & Drysdale 1991 SCG'91 (✓ fetched). The clean Apollonius closed form (dist/v = const) is a modeling synthesis, flagged honestly |
| **Facet-death events** | a moving intersection-of-half-spaces surface needs explicit topological handling when a facet shrinks to zero — the one correctness pitfall of the representation | Norris & Watson 2009 arXiv:0910.2207 (✓ fetched); Frank 1958 lineage |
| **Vein regime switch** | R = growth rate / space-supply rate: R≫1 + smooth wall → blocky euhedral + wedging (open vug); R≲1 or rough wall → fibrous tracking growth | Ankit et al. 2013 CMP 166:1709-1723 phase-field (✓ fetched) |
| **Flow one-sidedness** | face rate ∝ 1/δ_c (concentration boundary layer): upstream faces grow faster, leeward faces starve — the crystal records the flow direction | Sizaret et al. 2006 GJI 167(2):1027-1034 (✓ fetched) |
| **Scepter/phantom mechanism** | hiatus dusting masks faces; renewed growth = Epitaxial Lateral Overgrowth where unmasked: thin/permeable film → buried phantom in lattice continuity; masked prism + free termination → scepter cap wider than trunk; reproduced experimentally | Takahashi, Imai, Hosaka, Kawasaki & **Sunagawa** 2004 Eur. J. Mineral. 16(6):1009-1017 (✓ confirmed exact) |
| **Splitting grades** | single crystal → split → sheaf/bowtie → spherulite; split count and divergence angle rise monotonically with σ × impurity load; saddle dolomite = low-grade splitting (strain-rotation: Barber, Reeder & Smith 1985) | Shtukenberg, Punin, Gunn & Kahr 2012 Chem. Rev. 112(3):1805-1838 (✓ confirmed); Grigor'ev 1965 (✓ confirmed) |
| **Hopper/recovery** | above σ* the face center starves (Berg effect) while rims advance → hopper/skeletal; when σ drops below σ*, centers infill — recovery | Desarnaud et al. 2018 JPCL (✓ fetched; the recovery half rests on Sunagawa's framework, flagged) |
| **Engulfment classes** | inert embedded grains are passively overgrown, host stays ONE optically-continuous crystal (poikilotopic; sand calcite = 60% quartz in one rhomb); front-COATING reactive films interrupt the lattice → phantom/renewal branch. One boolean (`coats_front`) separates the physics | carbonate-cement literature (✓ fetched) |
| **Texture vocabulary** | comb / crustiform / colloform / zonal — the classification a druse simulator's OUTPUT should be labeled with | Dong, Morrison & Jaireth 1995 Econ. Geol. 90(6):1841-1856 (✓ confirmed) |
| **Cockade** | same selection law on an isolated interior clast instead of the wall; cockades form where cement growth is SLOW relative to dilational fault slip (episodic, seismic-cycle-paced) | Frenzel & Woodcock 2014 JSG 68(A):194-206, doi:10.1016/j.jsg.2014.09.001 (✓ verified 2026-07-03, post-review — review point #6 closed as VERIFIED, not downgraded) |

**Negative results worth keeping** (they prevent future wrong turns): gravity settling is NOT an
independent face-rate law — it acts through convection (fold into the flow driver) and through
particle DELIVERY for inclusions (the hourglass path), never as a direct face-rate hack. Equal-
weight Voronoi is the WRONG shortcut for unequal-speed neighbors. "Interpenetration" resolves,
FOR THIS SIM'S SCOPE, to two mechanisms: competitive contact (induction) or lattice-controlled
(epitaxy, misfit ≲8%). Real edge cases exist OUTSIDE that scope and are declared out of scope,
not nonexistent (review point #3, accepted): simultaneous co-crystallization intergrowths
(graphic-granite-like textures) and interface-coupled dissolution-reprecipitation replacement
(Putnis 2002 Min. Mag. 66:689 / 2009 RiMG 70:87 [from-memory, verify if ever built]) — if a
specimen presents one, the scope boundary yields, not the specimen.

## 2. What the tree already holds (census, file:line verified)

The census's headline surprises, in the arc's favor:

1. **The Wulff kernel is already per-face.** `wulffPolyhedron` (js/46:443-477) consumes a flat
   `[{n,d}]` list with NO symmetry assumption; the per-family d is broadcast at exactly ONE
   point (js/46:431, inside `wulffFaceSetForMineral`). Unequal face development is a
   data-generation variant, zero kernel-math changes.
2. **Zones can already carry morphology.** GrowthZone has per-zone `morph_regime/morph_form/
   morph_surf_sigma` (js/27:125-127, calcite arc) and `inclusion_type` (js/27:98). Zoned-habit
   and phantom-horizon data models are ready; only render paths are missing.
3. **Engulfment EXISTS sim-side and is invisible.** `_check_enclosure`/`_check_liberation`
   (js/85c:672-751, the Sweetwater mechanism) tag `enclosed_by`, stop the guest — and the
   renderer never reads it (zero matches in js/99i). A whole shipped mechanic with no face.
   (Caveat: its adjacency test is a position-STRING comparison, js/85c:690-693, not geometry.)
4. **Bodies are full ideal polyhedra.** Base-at-anchor, optional occlusion sink, and a
   fragment-shader discard past the wall (js/99i:4355-4376, 195-219) — no contact face, no cap
   at the cut, buried halves still exist as geometry. Neighbors interpenetrate freely; the only
   "intersection" in the file is deliberate twin geometry.
5. **Geometric selection's OUTCOME is hard-coded.** Every crystal's c-axis is forced along the
   wall normal (js/99i:3742-3750) + hash yaw. No crystal is ever mis-oriented, so no selection
   ever happens — the comb texture is painted, not earned.
6. **Neighbor queries are nearly free.** wall_anchor + ring/cell occupancy grid + WallMesh's
   precomputed 4-neighbor adjacency (js/23:257-267, built for diffusion) compose into a
   crystal-neighborhood API in a few lines. Gravity/up already exists (floor/wall/ceiling
   orientation per vertex, air-mode stalactites).

The design consequence: **all six of the boss's phenomena reduce to ONE representational
upgrade — per-face central distances h_i with per-face modifiers (exposure, contact, coverage),
integrated per step — plus an aggregate layer that resolves neighbor collisions.** The kernel
speaks the language already; the sim just never says anything asymmetric in it.

## 3. The rungs

Ordered so each ships alone, byte-identical where marked, and every later rung consumes the
earlier ones' state. Sizes: S/M/L per the roadmap convention.

| rung | what ships | science | SIM impact | size |
|---|---|---|---|---|
| **O0 — attached-crystal truth** | Wall crystals become HALF-FORMS: clip the Wulff polyhedron at the attachment plane, generate a real cap face (the anhedral scar), stop h-integration on buried-hemisphere faces. Doubly-terminated only for floater/clast contexts. | euhedral-toward-cavity (✓) | render-only, byte-identical candidate | M |
| **O1 — unequal development** | Per-face h_i via a `wulffFaceSetForMineral` variant. First modifiers are REAL and already computable: exposure (n_i · wall-outward, cavity solid angle) + neighbor shadow (occupancy grid + adjacency). Steno pin: normals identical to the species table, asserted in tests. | Steno (✓); kinetic Wulff (✓) | render-only first; C1 depletion field later upgrades the modifier from geometry to per-direction chemistry | M |
| **O2 — induction surfaces** | Pairwise neighbor clipping: for each close pair, add a half-space at the growth-rate-weighted meeting surface (weights = the two crystals' integrated growth, NOT the midplane); retag clipped facets `contact` (matte/striated material, no euhedral gloss). Kills mesh interpenetration and births real druse texture in one rung. | Self & Hill (✓); Diggle (✓); Schaudt & Drysdale (✓) | render-only candidate (derived from existing positions/sizes) | L |
| **O3 — geometric selection** | Nucleation gets a REAL orientation draw (tilt distribution); growth arrest when a neighbor's front overtakes (the Kolmogorov rule); survivors converge to wall-normal. The palisade is EARNED, and the base of a druse shows buried tilted losers — exactly what real plates show. Instruments first: survivor-density-vs-height probe checked against Gray's d^(−1/2) and Krapivsky's bounds — an analytic oracle before any render ships. | Kolmogorov (✓); van der Drift (✓); Gray (✓); Krapivsky (✓) | SIM bump + rebake (orientation becomes state) | L |
| **O4 — engulfment made visible** | Renderer reads `enclosed_by`: guest renders inside host, host translucency (Depth-A) reveals it. Inclusion classes split by `coats_front`: embedded-inert (sand calcite, host stays one crystal) vs front-coating (routes to O5). Upgrade enclosure adjacency from string-compare to the O1 neighborhood query. | poikilotopic enclosure (✓) | render + one sim fix (adjacency); the fix moves baselines → bump | M |
| **O5 — perturbed regrowth** | Per-face-class inhibitor coverage φ written by hiatus events: φ<φ_crit → phantom horizon in lattice continuity (zones already record it; renders via D2 rails); masked prism + free termination → the scepter EARNED by ELO (the alpine arc's declared sceptres gain their mechanism); σ×impurity above threshold → split-growth fans (sheaf → spherulite ladder; saddle dolomite is the shipped low-grade case). | Takahashi/ELO (✓); Shtukenberg grades (✓) | SIM bump (event schema + per-face state) | L |
| **O6 — flow one-sidedness** | Per-vug flow vector; R_i scaled by upstream-ness (dot(n_i, −flow) through a boundary-layer factor). Feeds through O1's machinery unchanged. Gravity enters ONLY as convection/delivery per the negative result. | Sizaret (✓) | SIM bump (flow becomes scenario state) | M |
| **O7 — hopper + recovery** | Berg-effect σ* threshold: rim-vs-center velocity within a face → hopper cavities; later low-σ zones infill (recovery generation in the zone record). Needs within-face relief — the biggest render lift; last. | Desarnaud (✓, recovery flagged) | SIM bump | L |
| **O8 — texture classifier + cockade** | Post-hoc aggregate labeler (comb/crustiform/colloform/zonal — Dong et al. vocabulary) for narrator + bench; free interior clasts as substrates (cockade) reusing O3's machinery. | Dong et al. (✓); Frenzel & Woodcock [verify] | classifier render-only; cockade = scenario content | S+M |

> **O0 ✅ SHIPPED SIM 215 (2026-07-03)** — the half-form kernel clip: the attachment plane
> enters `wulffPolyhedron` as ONE MORE HALF-SPACE (js/46 `_makeWulffHalfFormGeom`) and the
> scar cap emerges as a real kernel face — O2's induction mechanism, proven at one plane
> before the aggregate layer consumes it. Render default attachedFraction 0.5 (Grigor'ev)
> for equant closed tokens; sim `_occlusion` stays authoritative; satellites inherit the
> parent's fraction; prisms/snowball/twins/air-mode keep their contracts. Steno pin +
> cap-face reality + buried-half-gone asserted per tenant (tests-js/cleft-halfform.test.ts).
> Co-staged with W-K V0 on grimsel/tormiq per the co-evolution rule; SIM-byte-identity held
> (measured 0/37 baseline drift).

> **O5.0 — FACE STRIATIONS (new small rung, specced 2026-07-04 from specimen TN465).** The
> boss's Lemurian-type quartz (TN465: heavily lined prism faces, sub-faces splitting and
> reconverging) named a texture the ladder had no rung for: **growth striations — the zone
> record's FACE-SIDE rendering.** Mechanism: oscillatory growth between adjacent forms
> (quartz: prism m{10-10} ↔ the rhombohedra; one lamella per flicker; horizontal-striated
> prisms are textbook-diagnostic) — the low-amplitude CONTINUOUS end of the same spectrum
> whose discrete end is O5's hiatus→phantom; the specimen's sub-parallel reconverging faces
> are the Shtukenberg ladder's lowest grade (macromosaic), already in this proposal's science
> table. **Design pin: striations are DATA-DRIVEN, never a noise texture** — the sim already
> records per-crystal per-step zones (σ, T, chemistry); striation density/depth bakes from
> the crystal's OWN recorded σ oscillation ([[feedback_bedrock_over_effect_hacks]]: D2/D3
> rails render the biography internally, O5.0 renders the same record externally). Render-only,
> S-sized, quartz first (tourmaline's along-c striations = second tenant, same family, axis
> differs). **W-H tie:** striation density is a READABLE σ(t) observable on the face — one
> more channel the inverse solver can fit a fluid history to. **Falsifiable prediction left
> with the boss:** if striations come from m↔rhombohedron oscillation and r/z alternate,
> striated and smoother prism faces should ALTERNATE around TN465 — an eye-read datum for its
> record; if the rock disagrees, the alternation story yields. Evidence flags: the m↔r
> oscillation mechanism is textbook; the r/z-alternation asymmetry is [hypothesis — corpus
> check]; Rykart's quartz monograph [from-memory]; quartzpage striation page [unreachable,
> TLS]. Anchor: **TN465** (the tn457→scenario precedent says TN specimens become content).

> **O1a ✅ SHIPPED (2026-07-04, render-only — no SIM bump, the optics-commit idiom): the
> EXPOSURE tranche of O1.** `wulffFaceSetForMineral` gains optional `exposureK`: per-face
> `d_i = SEED + SPAN·g·R_i·max(0.15, 1 + k·n_y)` — the modifier on the RATE inside the
> accumulation (review #1's accepted interface), SEED outside (the nucleus predates the
> gradient), û = local +Y = toward the cavity (spatial, so titanite's b-on-Y frame needs no
> special case). Fed faces advance and tighten the termination toward the pocket; starved
> wall-side faces stay broad for O0's cap to cut. k = 0.18 fleet constant this tranche;
> air-mode k = 0. **Ships as the DECLARED render-time approximation** (f_geo from current
> geometry back-dates by construction — review #1's honest label); tests pin the k=0 path
> bitwise and the closed-form per-face relation `(d(k)−SEED)/(d(0)−SEED) = f_geo(n_y)`
> (tests-js/o1-exposure.test.ts). O0's default cut moved to the NUCLEUS PLANE (y=0) since
> the stretch separates it from the extent midpoint. **Pre-registered re-sweeps:** (a) the
> C1 era replaces render-time f_geo with per-step per-direction σ — re-sweep k against the
> depletion field then; (b) O1b (neighbor shadow via the occupancy grid) makes k per-crystal.
> Steno pin held: normals bitwise-unchanged at every k.

> **O3 ✅ SHIPPED SIM 218 (2026-07-07) — the arc's FIRST SIM bump, in two commits.** The heart
> of the ontogeny arc: the comb the sim always PAINTED (c-axis forced to the wall normal) is now
> EARNED by competition (Kolmogorov 1949 / van der Drift 1967).
> **Instruments first, exactly as promised:** `tools/o3-selection-oracle.mjs` — a STANDALONE
> anisotropic Johnson–Mehl MC that reproduces Gray's d^(−1/2) survivor law (k≈1.5 → p=−0.493,
> R²=0.997; isotropic control → p=0, no selection; survivor tilt collapses 22°→3°) BEFORE any
> engine code — the cheapest strongest verification this project has had.
> **O3a (`1948b3b`, byte-identical):** the nucleation orientation DRAW from an ISOLATED run-seed
> stream (js/44a `_makeOrientRng`, thermal-idiom, zero shared draws), recorded on `_nucTilt`, UNREAD.
> The review's sharpened invariant held — seed42_v217 regenerated 0/38. Steno pin: a rigid whole-body
> rotation, never a perturbed normal.
> **O3b (`03f1582`, SIM bump):** the render leans the c-axis to `_nucTilt` (kernel-truth leanDeg==θ
> exactly); a pre-growth pass (js/85b `_applyGeometricSelection`) marks crystals a more-normal
> neighbor's front overtook. **SEALED-BUT-PRESENT arrest** (the specimen tests shaped it — hard
> arrest culled documented accessory sulfides + a cabinet lepidolite book below their pins): a buried
> crystal stays ACTIVE, grows throttled (0.12×) into a short leaning stub, and is shielded from
> dissolution + double-count enclosure — one coherent "sealed by its neighbor" picture. **ELONGATE-
> ONLY** (O3_SELECT_MIN_ASPECT 1.4): selection is a palisade phenomenon; equant/tabular/botryoidal/
> dendritic forms don't compete (defer-to-geology, the specimen guard's call). Scale-invariant burial
> (a RATIO lead, not an mm gap — the verify probe caught the scale bug). `tools/o3-selection-verify.mjs`
> closes the loop: tilt-collapse survivors 20.7°/buried 32.9°, burial concentrates in elongate dense
> druses (deccan 39%, shigar 29%, gem-peg 16%), 23/38 select, 11.4% fleet. Baseline 21/38 moved (17
> sparse = byte-identical), ±1–6, one v192-precedented pyrite dominance re-pin. The disabled-draw
> invariant attributes the move to selection alone. **NEXT:** a size-scaled neighbor footprint (big
> crystals shadow wider) deepens dense-druse selection; the fleet-wide survivor slope stays confounded
> by the chemical size spread (the clean oracle match lives in tilt-collapse + per-druse concentration).

**Sequencing.** O0 → O1 → O2 is the visible foundation and stays render-only (byte-identity
discipline holds; the probe/sweep/eye-check ritual per rung). O3 is the first SIM bump and the
arc's scientific heart — its analytic oracle (survivor-density power law) is the cheapest
strongest verification this project has ever had available. O4/O5 ride the C1 depletion field's
era (same rebake windows where possible). This arc does NOT displace the boss stones: C0
calcite lever ships first as planned; **C1 depletion field is the bedrock half of O1/O5-O6 —
the boss's "one side grows differently" ask is exactly what C1's local σ exists to drive.**

## 4. The bench closes the loop

Ontogeny is what the specimen bench (W-A) will falsify FIRST: real druse plates are mostly
contact faces, buried losers, and asymmetric individuals — the idealized render fails T2
against nearly any real plate today. New A3 metrics this arc needs: **contact fraction** (facet
area that is induction surface vs euhedral), **asymmetry index** (variance of h_i within a
form), **survivor density vs height** on plate cross-sections, **intergrowth count**. The
catalog being ~1/5th of the accessible collection raises the ceiling: intergrown, imperfect,
"uncatalogable" specimens — the ones a dealer photographs least — are precisely this arc's
ground truth. The boss's drawers are full of induction surfaces.

## 5. Risks + blind spots

1. **Geometry cost.** O2's pairwise clipping is O(pairs) with small constants (druses are
   sparse; the occupancy grid prunes), but facet-death events (Norris & Watson) must be handled
   explicitly or they will surface as render bugs. Budget a probe before committing.
2. **Legibility.** A fully honest druse is a wall of contact faces — the field-guide aesthetic
   must keep the hero termination readable. Tuning knob: scenario-level nucleation density.
3. **RNG discipline.** O3's orientation draw touches the nucleation RNG cascade — the
   redox-census/nuc-seed lessons apply in full (per-mineral seeds isolate the draw).
4. **The verified-vs-synthesized line.** The Apollonius closed form and the hopper-recovery
   half are modeling syntheses flagged above; if a specimen or probe contradicts them, the
   synthesis yields first.
5. **What I couldn't check:** Grigor'ev 1965's full text (attribution rests on fetched
   secondary sources + catalog records); Frenzel & Woodcock from memory; per-mineral splitting
   thresholds have NO literature constants — they will be bench-fitted per tenant, honestly
   labeled as fits.

---

## 6. Review response — rockbot 🪨✍️, 2026-07-03 (`REVIEW-ONTOGENY-rockbot-2026-07-03.md`, mirrored in-tree)

The review's verdict was APPROVED, ship as-is, address in the first rung's design doc; its
ranked "might actually matter" list was #1, #8, #2, #4. Evaluation, point by point — accepted
fixes folded in the same day rather than deferred, since they were documentary:

- **#1 O1–C1 interface (ACCEPTED, with one refinement).** The multiplicative composition is
  right; the refinement is WHERE it applies: modifiers act on the instantaneous per-face RATE,
  inside the accumulation — `h_i = SEED + Σ_steps g_step·R_i·f_geo(step)·g_chem(step)` — never
  on the finished h_i (a current-conditions multiplier applied to accumulated growth re-commits
  the frozen-param sin in mirror image: it back-dates today's environment onto yesterday's
  layers). Consequence, stated honestly: O1's render-only first cut evaluates f_geo at RENDER
  time from current geometry — an approximation that back-dates by construction. It ships
  labeled as such; the exact per-step accumulation arrives when C1 gives per-direction σ state,
  with `g_chem = identity` until then. O1's tests pin the f_geo-only path at g_chem ≡ 1, and
  the C1-era re-sweep is pre-registered NOW (the 4a.8 converse lesson, applied prospectively).
- **#2 O2 render-only scrutiny (ACCEPTED — option C, hybrid).** The review is right that
  integrated growth is history, not visible state. The error budget has a pleasing structure:
  current-size ratio equals integrated-growth ratio EXACTLY when the rate ratio was constant —
  which (Diggle) is exactly when the true boundary is planar; so the plane-from-current-sizes
  approximation is self-consistent at first order, and its error is concentrated in
  drifted-ratio pairs, where the true surface is curved and ANY single plane is wrong. Ship A,
  instrument the drift population, upgrade to exact weights when O3/O5's SIM state lands.
- **#3 "no third mechanism" too absolute (ACCEPTED).** Rephrased above as a scope boundary
  with the edge cases named. One terminology note: the review's "syn-epitaxy" is non-standard —
  the phenomena it points at are simultaneous co-crystallization intergrowth and
  dissolution-reprecipitation replacement (Putnis), now cited as such.
- **#4 O3 RNG sketch (ACCEPTED).** The per-mineral nucleation-seed pattern (SIM 198, js/85j)
  extends: orientation draws from a dedicated stream keyed (seed, mineral, nucleation_index,
  ORIENTATION_BRANCH), consuming ZERO numbers from existing streams. The pinnable invariant is
  sharper than the review's: with selection DISABLED, enabling the orientation DRAW must be
  byte-identical fleet-wide (the draw exists, is recorded, and is unused). Selection ENABLED is
  a SIM bump and baselines move by design — the invariant test is what makes that move
  attributable to selection alone.
- **#5 W-A cross-reference (ACCEPTED).** The four ontogeny metrics are now in the roadmap's A3
  row with a W-F cross-reference; A3 re-sized M→M-L.
- **#6 Frenzel & Woodcock (DONE — verified same day).** JSG 68(A):194-206,
  doi:10.1016/j.jsg.2014.09.001, mechanism as claimed (cement growth slow relative to episodic
  dilational slip). Flag upgraded to verified; O8's cockade needs no downgrade.
- **#7 O8 classifier sizing (PUSHED BACK, scope clarified).** The labeler classifies SIM STATE,
  not photographs: nucleation density, survivor count vs height, band count, orientation
  variance are all kernel-truth quantities the sim can read directly, and Dong et al.'s
  categories map to rule thresholds on them — the same shape as classifyWulffForm/classifyEtch.
  No training data, no ML; S+M stands. The review's deeper concern is real and lands elsewhere:
  whether the labels match what a geologist would say is BENCH work (A5 contact sheets), and
  photo-side classification — which WOULD be ML — is deferred exactly as the review suggests
  (its "W-H"), unscheduled.
- **#8 fidelity budget (ACCEPTED — the review's best point).** Adopted into the roadmap §0
  with credit, including the T4 stop condition verbatim: "adding a new specimen doesn't require
  a new fitted parameter." That is the correct generalization criterion for the whole project
  and the ladder was incomplete without it.
- **W-G atomistic parameterization (ACCEPTED).** Named in the roadmap as a future-research
  stub — the door where open kinetics tables or interlibrary access would plug into C2.

The maker's-mark dream said the only difference left should be which one casts a shadow. The
rocks in the drawers grew crowded, starved on one side, dusted mid-life, and grown together —
this arc is where the sim learns those verbs. The ideal polyhedron was the noun.
