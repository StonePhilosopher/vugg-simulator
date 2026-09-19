# HOSTILE REVIEW — how true to life do the rendered crystals look? (2026-09-04)

**Ask (boss):** a hostile review of the simulator judged on one question — could a rendered crystal
pass for a photograph of a real one? 10/10 = indistinguishable from a photograph. Target: **7/10**.
Include an actionable plan; build whatever testing tools are needed; fix bugs on sight.

**Verdict: 2/10 today.** The picture is a schematic of the science, not a photograph of a rock.
Every one of the 40 frames photographed from the shipped renderer contains **zero specular
highlight pixels**, where the boss's own specimen photographs carry a median of one percent.
Transparent minerals are alpha-blended cellophane, sulfides are matte plastic, the wall is a
lathe-turned wooden bowl, and — the finding that changes the priority list — in most scenarios
the largest thing on screen is not a crystal at all but a carpet of 17 mm octagonal "coins"
standing in for coatings. Three of those defects were bugs and are fixed in this commit; the
rest is a render-layer plan whose first two rungs were prototyped live in the review rig and are
shown below with numbers.

**The science is not the problem.** The engine already holds per-face Wulff distances, phantom
horizons, inclusions, sector zoning, trace chemistry, lustre and diaphaneity for 95 species, and
crystallographic systems for 179. The camera simply never sees most of it. Getting to 7/10 is a
rendering programme, and none of it moves a baseline.

Evidence lives under `.local-evidence/photos/` (never committed; regenerate with the commands in
§9). Every claim below names the frame it was read from.

---

## 0. What 10/10, 7/10 and 2/10 mean

| score | reads as | what it needs |
|---|---|---|
| 10 | a photograph of a specimen, at any zoom | path-traced glass, measured BRDFs, micro-geometry, real matrix, lens/sensor model |
| **7 (target)** | obviously a mineral specimen; a careful viewer notices it is CG on close inspection | image-based lighting + shadows, physically-based transmission with body colour, lustre-driven materials, true crystallographic forms for the common species, mm-scale coatings, a rock-textured wall, a photographic camera (exposure, DOF, background) |
| 5 | a good game render of crystals | everything in 7 minus DOF/matrix texture |
| **2 (today)** | a labelled diagram of a geode | — |

Frames were scored against the boss's own catalog photographs (twelve, listed in §3.2) rather
than against literature: the specimen is the terminal verification
(`feedback_terminal_verification_specimens`).

---

## 1. Method — the instrument built for this review

**`tools/photo-rig.mjs`** runs the *built* game in a headless Chrome it owns (the
`browser-workflow.mjs` launch recipe), drives the real Creative-mode entry point
(`startScenarioInCreative` → `run_step` × the scenario's own duration), forces the Three.js path,
and reads the WebGL framebuffer back as PNG in the same task as the draw call. Nothing is
re-implemented; what is photographed is what the player gets (`feedback_photograph_the_real_renderer`).

- **Shots.** `cavity` = the game's own camera rig at a fixed tilt/zoom. `hero` = the N largest
  crystal bodies framed 3/4 from their own c-axis, camera kept inside the cavity, the game's
  inside/outside lighting switch applied. `druse` = the densest patch of crystals.
- **Roster.** Every mesh: kind (crystal body / satellite / coating swath / phantom band),
  mineral, habit → token, material (colour, opacity, roughness, metalness, transmission, IOR),
  rendered extent, instance count. The material census a review can quote.
- **Statistics** on every frame and on reference photographs through one definition (in-page
  canvas readback for JPEGs): mean luminance, mean saturation, **highlight fraction** (pixels
  brighter than 235 — specular pops), dark fraction, **edge fraction** (strong-gradient pixels —
  how busy a surface is), a 16-bin histogram. A picture can be argued with; a number can be
  tracked across rungs (`feedback_measure_the_artefact`).
- **Prototype experiments** (`--experiment envlight,glass,halfcut,swathoff`) mutate the live
  scene after the game's own render pass so a recommendation can be *shown*: an environment
  map with shadows and filmic tone mapping; physically-based transmission with per-species IOR;
  the cut-geode presentation; and an ablation that hides the coating swaths.
- Manifests, contact sheets and PNGs are written to `.local-evidence/photos/<scenario>-s<seed>[-label]/`,
  the one directory the identity hash excludes, so the rig never kills a running test suite.
- **Rig facts:** Chrome 152, ANGLE D3D11 on an RTX 3080, three r163, 1200×900, seed 42,
  scenario-default durations. ~20 s per scenario.

**Rubric** (nine axes, §4) was drawn from what the reference photographs actually contain:
Fresnel highlights and sparkle on every fresh face; transparency with depth (inclusions,
cleavage flashes, deeper colour in thicker parts, the substrate seen *through* the crystal);
face micro-texture (striations, hillocks, frosting, chipped edges); colour variation within one
crystal (zoning, phantoms, iron stain); messy aggregates (size distribution, sub-parallel
groups, interpenetration); a textured matrix; contact shadows; and a camera (exposure, depth
of field, a background).

---

## 2. Findings — what the player sees today, and which code draws it

Each finding: **what the frame shows → why (code) → severity for the 7/10 goal.**
Severity: ★★★ blocks 7/10 on its own · ★★ large · ★ visible.

### F1 ★★★ Coatings render as a carpet of 17 mm octagonal coins — FIXED (three parts)
*Frames:* `elmwood-s42/cavity.png`, `elmwood-s42-hidden/hero-1-fluorite.png`, `mvt-s42/druse.png`,
`deccan_zeolite-s42/cavity.png`, `schneeberg-s42/cavity.png`, `sicily_solfifera-s42/cavity.png`.

The SIM 246 surface-fabric tranche (`4e7e77d` → `2312c33`, 2026-08-06/08) represents every
area-covering aggregate as an `InstancedMesh` of "representative" patches. Three things went
wrong at once, and together they dominated eleven of the twenty-eight scenarios photographed:

1. **Size.** The instance cap was 128 (56 mobile), and each patch's radius was derived from
   *covered area ÷ count*. A 90%-covered 45 mm cavity therefore needs ~17 mm patches to add up,
   and `SphereGeometry(0.5, 8, 5)` flattened to a plate is an octagon. Result: coins.
2. **Classification.** `surfaceGrowthRegimeFor` trusted the nucleation `vector` over the habit.
   The Elmwood **14 mm scalenohedral calcite** — the dogtooth the boss eye-checked on 2026-07-24 —
   carried a stale `vector:'coating'` from its druzy birth, was classed `botryoidal_crust`, had
   its body *suppressed* (`_addCrystalParentRepresentation` returns false for any
   `_surfaceGrowth`) and was painted as 116 cream coins. Stilbite plates, heulandite, pectolite,
   prehnite, greenockite and cassiterite met the same fate.
3. **Mass.** Coverage was `wall_spread × maturity` with no reference to booked volume. A
   **0.008 mm cassiterite grain** in `gem_pegmatite` claimed 23% of the wall (38 coins of 50 mm
   extent); `deccan` carried 17 swaths of 1620 instances.

**Fix (this commit, render-facing only — `_surfaceGrowth` has no simulator consumer, so every
baseline is untouched):**
- `js/45`: a euhedral habit (`prismatic|tabular|bladed|rhombohedral|scalenohedral|cubic|octahedral|
  tetrahedral|dodecahedral|dipyramid|pyramidal|sheaf|bowtie|coffin`) is never a crust; with a
  coating vector it is a *druse* of small individuals below 2 mm and a single body (no swath) at
  or above. The dogtooth is back (`elmwood-s42-fixed2/hero-2-calcite.png`).
- `js/45`: coverage is capped by mass — the booked volume must cover the claimed area at least
  2 µm thick (`SURFACE_GROWTH_MIN_FILM_MM`), else the crystal has no fabric yet. Dust no longer
  paints walls: schneeberg 22 → 4 swaths, deccan 17 → 9, gem_pegmatite 1 → 0.
- `js/99i`: instances are sized at a physical 1.5 mm footprint with caps 1536/384, the lobe is a
  12×8 sphere, and a botryoidal lobe's height is bounded by 3× the record's mean thickness (a
  hemisphere's mean thickness is 2r/3) — a 2 µm blanket is a thin bumpy skin, a thick malachite
  crust grows real lobes. (The first cut of this fix let lobes grow to their footprint and buried
  the dogtooth under balloons — `elmwood-s42-fixed/hero-2-calcite.png` — hence the mass bound.)
- Tests: `tests-js/surface-growth.test.ts` (two new cases, caps re-pinned with the reason),
  `surface-growth-three-integration.test.ts` green.

**Still open under F1 (plan R3):** a laminated lining is a *continuous* shell, not overlapping
tiles; a druse's teeth should be sized from the aggregate's own crystal size; the "representative
instance" idea should give way to wall-conformal displacement + normal maps for thin coatings.

### F2 ★★★ No specular reflection anywhere — ADDRESSED (R1 light + R2 materials; the residue is facets, R4)
*(R1 gave every material something to reflect; R2 gave the materials their real F0 and
roughness. Highlight fraction now depends on whether a face happens to mirror the lamp —
fluorite hero 0.0009, galena under the studio mood 0.0068; the whole-frame ≥ 0.002 line waits
on R4's face count and R6's lamp placement.)*
*Every frame.* Highlight fraction is **0.0000 in all 40 frames**; the reference photographs run
0.0002–0.036 (median 0.010). Cause: one `AmbientLight(0.55)` + one `DirectionalLight(0.9)`, no
`scene.environment`, `toneMapping = NoToneMapping`, `shadowMap` off (`js/99i _topoInitThree`).
A `MeshPhysicalMaterial` with nothing to reflect is a Lambert surface; the sulfides' `metalness
0.45` merely darkens them. **Prototype `envlight`** (procedural three-panel studio baked through
`PMREMGenerator`, ACES filmic, PCF shadows): highlight fraction 0 → 0.0028 on the elmwood cavity,
edge fraction 0.010 → 0.030, contact shadows appear between crystals
(`elmwood-s42-envlight/cavity.png`). One afternoon of work; render-only.

### F3 ★★ Cubic minerals drawn as hexagonal prisms — FIXED
*Frames:* `tn457_barite_pulses-s42/hero-1-sphalerite.png` (honey sphalerite as six-sided
translucent columns), `elmwood-s42` roster (`sphalerite … token prism`).
`_habitGeomToken` fell to the hexagonal default for `tetrahedral`, `disphenoidal_{112}`,
`cubic_high_T`, `cubic_galena_structure`, `cubo_octahedral`, `pseudo_cubic`, `equant_octahedral`.
**Fix:** a `tetrahedron` token + `_makeTetrahedron()` (regular, face-attached, apex to the void),
wired through every isometric gate (uniform scale, satellites, half-form, O2 convex set, cluster
pattern, aspect table); cubic-named habits route to the cube. `tn457_barite_pulses-s42-sph-solid3/
hero-1-sphalerite.png` shows the amber tetrahedra against the wall (and `-sph-hidden` without it).
Test: `tests-js/sphalerite-tetrahedron.test.ts`.

### F4 ★★ The shape audit was reporting fixed things as broken — FIXED
`tools/morph-fidelity-audit.mjs` listed **75 mis-shaped minerals**; 51 of them had been redirected
to system-aware prisms by `CRYSTAL_SYSTEM` (`js/99i`, 2026-06-23) for ten weeks. The instrument
did not model the gate it audits (`feedback_aid_must_match_the_gate`). It now reads the renderer's
own map from source, reports the redirect, warns when the map disagrees with `structural.json`,
and knows the tetrahedron/cube routes. Honest residue: **21 mis-shaped**, all `spike` tokens
(needle habits of monoclinic/orthorhombic minerals — a hex-pyramid needle is a minor sin) plus 5
cubic-as-prism natives/grains, plus tigers_eye/tincalconite with no sourced system.

### F5 ★★★ Transparency is an alpha ghost, not glass — FIXED (R2, 2026-09-06)
*(R2: real transmission with the species' measured mean IOR and Beer–Lambert attenuation over
the crystal's own extent, opacity 1, depth write on; the alpha ghost survives only as the
low-performance tier. See §5 R2.)*
*Frames:* `tn457_barite_pulses-s42/hero-2-barite.png`, `amethyst_geode-s42/druse.png`,
`elmwood-s42-hidden/hero-1-fluorite.png`. Depth-A maps clarity to `opacity = 1 − 0.70·clarity`
with `transmission 0` — the boss's fixed decision of 2026-07-01 ("NO faked refraction"). Real
transmission is not faked refraction: it *is* refraction, with the species' measured IOR (quartz
1.55, calcite 1.66, fluorite 1.43, sphalerite 2.37, cerussite 2.08…) and Beer–Lambert body colour
over the crystal's own thickness. **Prototype `glass`** applies exactly that to the ten
transparent bodies in elmwood; because the alpha ghosts also wrote depth, overlapping translucent
crystals today read as paper cut-outs (`tn457 … hero-2-barite.png`). **This needs a new boss
decision** (§7-D1); the rest of the plan does not depend on it.

### F6 ★★ Lustre is data, not pixels — FIXED (R2, 2026-09-06)
*(R2: `optics.lustre` → one roughness/metalness/sheen table; metals at their measured
reflectance `optics.reflectance`; dielectric F0 from `optics.ior`. See §5 R2.)*
94 species carry verified `optics.lustre` (metallic / adamantine / vitreous / pearly / resinous /
silky / dull) that nothing consumes; materials use two class heuristics (`metalness 0.45` for
sulfide/native else 0.08; `roughness 0.42/0.62`). Galena and pyrite are grey and brass matte
lumps (`mvt-s42-fixed2/cavity.png`); cerussite has no fire; selenite has no pearly {010}. Boss
called Depth-B "really low priority" on 2026-07-03 — at a 7/10 target that priority inverts
(§7-D2), and the consumer is ~40 lines in `buildCrystalMaterial`.

### F7 ★★ Bodies are minimal primitives, not crystallographic forms
Only six Wulff tenants (fluorite, galena, calcite, wulfenite, barite, titanite) carry real face
sets. **Quartz** — the most common species in the catalog (179 specimens) and in 13 scenarios —
is a hexagonal prism with a *pyramid* (`_makeHexPrismWithPyramid`): six equal triangles meeting at
a point, not the r/z rhombohedra at 38° with unequal development, no horizontal striations.
Selenite is a beveled octagonal tablet; dolomite a stretched octahedron; halite/fluorite a
`BoxGeometry`. Edges are razor-sharp everywhere; faces are perfectly flat; nothing is chipped.

### F8 ★★ The wall is a lathe-turned bowl with a golf-ball skin — FIXED (R5, 2026-09-07; diagnosis corrected in §5 R5)
*Frames:* `wittichen-s42/druse.png` (parallel ridges — the ring tessellation), `mvt-s42-fixed2/
druse.png` and `elmwood-s42/druse.png` (honeycomb dimples — the per-cell relief AO). The cavity is
a per-ring/per-cell radial mesh with a normal+AO map tiled by cell; no albedo texture, no
roughness map, no rock. A real vug wall is granular host rock with a drusy micro-crust and iron
stain. Also: `cooling-s42/cavity.png` shows the whole orb honeycombed from outside. **R5 found the
ridges were the basin/comb/cleft relief families (not the mesh) and the colour a hard-coded orange
orientation palette (not the lithology); both are gone (§5 R5).**

### F9 ★★ Presentation: a translucent orb in a black void — FIXED (R6, 2026-09-06)
The default view (`wallDisplay 0`: BackSide at 0.40 opacity) reads as a sci-fi sphere, not a
geode. Real geodes are photographed cut open. **Prototype `halfcut`** (a clip plane through the
origin facing the camera, wall opaque) turns the elmwood orb into a bowl with a druse rim
(`elmwood-s42-envlight+glass+halfcut/cavity.png`), and edge fraction rises to the photograph range
(0.04–0.08). **R6 ships the specimen view beside the orb (D3): a broken geode on a photographer's
cloth — ragged break, rind, fracture face, contact shadow, studio key, exposure, grain (§5 R6).**

### F10 ★ Cluster and coating artefacts
Satellites share the parent's material and scale (0.25–0.95×) — a druse has no size distribution
tail; the barite tablet rosettes stack into visible moiré (`tn457 … hero-2-barite.png`); the
2 mm/1.5 mm visibility floor turns sub-mm nucleates into uniform pebbles; hopper texture draws as
thin white polygon outlines on halite (`searles_lake-s42/druse.png`).

### F11 ★ Naica reads as grey cardboard boxes
`naica_geothermal-s42/hero-1-selenite.png`: the giant selenite blades are beveled octagonal
tablets at clarity 0.95 → opacity 0.34, grey-beige over a brown wall. No blade taper, no
pearly sheen, no water-clear read (the goal Depth-A named). Halite/selenite in
`great_salt_plains-s42/hero-1-selenite.png`: the frame is filled by the ridged wall.

### F13 ★ (canonical debt) the guided-tutorial receipt binds UI ids to the render's allocation count
Found during the transplant onto SIM 285. Two constants in the guided-tutorial receipt moved;
the simulation-state fingerprint (the science) matched byte for byte.

1. **The simulation run id is the durable strip DATASET digest**, and the strip recorder writes
   each crystal's surface-growth record into that dataset as testimony (`js/85g` line 489,
   `surface_growth: c._surfaceGrowth`). F1 changed that record (euhedral crystals are no longer
   crusts; coverage is mass-floored), so the digest moved. This is the honest consequence of
   correcting recorded testimony, and it sharpens the F1 claim: `_surfaceGrowth` has no
   *simulator* consumer, but it is *recorded* as testimony. The v271 archive had no such field
   (hence the fork-base rebake was byte-identical); the SIM 285 archive does, so the canonical
   rebake moved it — **30 of 41 stories and all 41 claim cards, with every differing leaf under
   `surface_growth`** (regime ×220, whole-record null↔record ×214, coverage/area/thickness ×344,
   stratigraphy lists ×6176) plus the envelope hashes; the seed-42 scenario baseline and the
   12-story chemistry digest came back byte-identical and all four simulation fingerprints in
   the guided receipt are unchanged. Drift from corrected testimony, not from moved science
   (`feedback_accuracy_over_determinism`).
2. **The collection record id draws from the QA-pinned `Math.random` stream**, which three.js
   also consumes for every object UUID it allocates; a render change that allocates a different
   number of geometries or materials before the "Collect topaz" click shifts the suffix
   (`cry-16-33x` → `cry-16-rt2`). That is a position-not-identity coupling
   (`feedback_identity_not_index`): every render rung will re-pin it. The durable fix is to draw
   UI ids from a stream the renderer cannot touch — canonical's call.

Both constants are re-pinned in this branch with the mechanism recorded beside them.

### F14 ★★★ Inside the cavity, the wall was not drawn at all — FIXED (R1, 2026-09-05)

Every hero and druse frame in §3 has a black background. The review read that as F9
(presentation) and moved on; it was a culling bug. `_topoApplyWallDisplay` switched the
cavity material to `FrontSide` whenever the camera crossed inside (the E4 "flythrough"
contract), but the shipped W-K cavity surface (`js/23-geometry-wall-mesh.ts`) builds its
normals **outward** by construction, and the photo rig's `wall2side` probe measured them so
on the live geometry (mean n·p > 0). From inside a closed shell with outward normals every
face is a back face, so FrontSide drew nothing: slivers of wall where the surface folded,
void everywhere else. The proof was in the statistic before it was in the picture — the
hero frame's dark fraction was 0.59123 under the legacy lights and 0.59123 under the R1
rig, identical to five decimals, which no lit surface produces. Two-sided, the same frame
is rock from edge to edge (elmwood s42 hero: mean L 46 → 106, dark fraction 0.59 → 0.00).
`DoubleSide` is winding-agnostic (the legacy ring mesh may wind the other way) and free from
inside a closed shell. Every zoomed-in view the player has reached since the MC wall landed
has been the void; this is the single largest change to what the eye sees in R1.

### F12 ★ Photo-rig limitations found while using it (kept honest)
The hero camera can end up behind a cavity bump, looking at the wall's matrix skin (the tn457
`hero-1-sphalerite` frames in `-s42` and `-s42-fixed2` are that wall). Fixed this session with a
two-sided raycast from the subject toward the camera — which also had to borrow
`THREE.Mesh.prototype.raycast`, because the game disables the cavity's raycast for its own
crystal-only hit tests (`-sph-solid3` is the corrected frame). The druse picker chooses the
densest cluster *including* satellites and often lands on a wall patch. Both are tool debts,
not renderer findings.

---

## 3. Measurements

### 3.1 Renders (seed 42, cavity shot) — before this commit → after
| scenario | swaths before → after | instances before → after | mean L | edge fraction | highlight |
|---|---|---|---|---|---|
| elmwood | 8 → 6 (calcite/chalcedony bodies restored) | 663 → 3750 (thin skin, 1.5 mm lobes) | 23.5 → 21.6 | 0.010 → 0.021 | 0 → 0 |
| mvt | 6 → 4 | 544 → 451 | 18.1 → 14.9 | 0.011 → 0.021 | 0 → 0 |
| deccan_zeolite | 17 → 9 | 1620 → 639 | 16.3 → 8.5 | 0.014 → 0.009 | 0 → 0 |
| schneeberg | 22 → 4 | 1686 → 143 | 18.0 → 12.0 | 0.009 → 0.014 | 0 → 0 |
| gem_pegmatite | 1 → 0 (cassiterite dust) | 38 → 0 | 16.5 → 15.8 | 0.008 → 0.007 | 0 → 0 |
| sicily_solfifera | 4 → 4 | 444 → 1560 | 20.2 → 20.1 | 0.008 → 0.013 | 0 → 0 |
| amethyst_geode | 2 → 0 (chalcedony below the mass floor) | 203 → 0 | 14.6 → 6.8 | 0.019 → 0.0004 | 0 → 0 |
| tn457 / naica | 0 → 0 | — | unchanged | unchanged | 0 |

The amethyst geode going dark is *honest*: the sim books almost no chalcedony there (c 0.08–0.15 mm),
so the agate rind the real geode has is a science gap, not a render one (§8).

### 3.2 Renders vs the boss's photographs (same statistic, same code path)
| set | n | highlight fraction (median, range) | edge fraction (median, range) | mean L (median) |
|---|---|---|---|---|
| shipped renders, all shots | 40 | **0 (0–0)** | 0.009 (0.0003–0.024) | 23 |
| after F1/F3 fixes, cavity | 10 | 0 | 0.013 | 14 |
| + prototype `envlight` (elmwood) | 3 | 0.0028 / 0.0012 / 0 | 0.030 / 0.024 / 0.001 | 27 / 141 / 124 |
| + `envlight,glass,halfcut` (elmwood, fixed build) | 4 | 0 / 0 / 0 / 0 | **0.043 / 0.078 / 0.084 / 0.081** | 22 / 106 / 109 / 119 |
| catalog photographs | 12 | **0.010 (0.0002–0.036)** | **0.081 (0.026–0.243)** | 120 |

Photographs used (catalog ids): 1061 Elmwood calcite on fluorite · 853 Elmwood calcite cluster ·
1135 pink saddle dolomite · 553 Chittenango celestine (microscope) · 1309 amethyst sceptre · 1229
vanadinite on barite (microscope) · 922 Mexican sphalerite · 1079 Kelly smithsonite · 923 Papiol
green fluorite · 907 Carlsbad hopper halite · 858 Cumberland barite · 1342 Guanajuato amethyst.
Caveat: the photographs include mats, boxes and hands; the numbers bracket, they do not certify.
Highlight fraction in the `halfcut` frames is 0 because the cut faces the studio's dark side —
the environment's panels need to face the opening (plan R1 places the key at the cut).

### 3.3 Rubric scored
| axis | today | evidence | 7/10 needs |
|---|---|---|---|
| form / crystallography | 3 | six Wulff tenants; quartz is prism+pyramid; sphalerite was hex (fixed) | Wulff quartz/sphalerite/pyrite/gypsum/dolomite/aragonite/topaz; chamfers |
| aggregate / druse | 2 | coins (fixed to lobes/skin), uniform satellites, no size tail | lognormal sizes, sub-parallel groups, mm coatings as displacement |
| surface micro-texture | 1 | flat faces, razor edges (striations only on pyrite/quartz gwindel) | striation/hillock normal maps per face family, edge wear |
| transparency / interior | 2 | alpha 0.3–0.7, depth-written; phantoms as shells | transmission + IOR + attenuation; inclusions through glass |
| lustre / specular | 0 | highlight fraction 0 everywhere | IBL + shadows (R1); lustre→material (R2) |
| body colour | 6 | D1a/D1b lexicon is right; zoning not visible | per-crystal clarity modulation, zoning bands under glass |
| lighting / shadow | 1 | ambient + one directional, no shadows | three-panel studio env, shadow-casting key, AO |
| wall / matrix | 1 | ridged honeycomb, no albedo | triplanar rock albedo/normal/roughness, drusy micro-crust, stain |
| camera / presentation | 1 | orb in a void, no exposure/DOF | cut-geode, exposure, DOF for macro, background cloth |

---

### 3.4 R1 fleet sweep (2026-09-05) — orb view, every scenario, one build

The R1 cave mood against the pre-R1 lights on the SAME build (`--experiment legacylight`), so only the lighting differs. The orb view is the process view the player opens on: a translucent shell in a black void, so the frame mean tracks orb size and the void-stripped subject mean is the number that lighting moves. Hero/druse pairs for the two gate scenarios are in §5 R1 (elmwood) and below (tn457).

| scenario | void | legacy L | R1 L | legacy subject L | R1 subject L | ratio | legacy edge | R1 edge |
|---|---|---|---|---|---|---|---|---|
| amethyst_geode | 0.91 | 6.8 | 6.3 | 21 | 25 | 1.19 | 0.0004 | 0.0006 |
| asbestos_hills_crack_seal | 0.89 | 15.5 | 15.9 | 96 | 112 | 1.17 | 0.0254 | 0.0455 |
| asbestos_hills_surficial_alteration | 0.82 | 21.0 | 21.8 | 82 | 103 | 1.26 | 0.0368 | 0.0607 |
| bisbee | 0.83 | 17.7 | 17.8 | 70 | 81 | 1.16 | 0.0329 | 0.0512 |
| chiastolite_hornfels | 0.92 | 7.6 | 6.8 | 33 | 33 | 1.00 | 0.0063 | 0.0064 |
| colorado_plateau | 0.86 | 12.2 | 10.9 | 48 | 48 | 1.00 | 0.0169 | 0.0183 |
| cooling | 0.85 | 9.7 | 9.6 | 32 | 38 | 1.19 | 0.0007 | 0.0011 |
| deccan_zeolite | 0.91 | 8.6 | 7.8 | 34 | 40 | 1.18 | 0.0090 | 0.0111 |
| elmwood | 0.86 | 11.8 | 11.0 | 48 | 51 | 1.06 | 0.0065 | 0.0095 |
| epithermal_telluride | 0.89 | 11.3 | 9.4 | 50 | 48 | 0.96 | 0.0088 | 0.0141 |
| gem_pegmatite | 0.84 | 15.8 | 12.5 | 62 | 55 | 0.89 | 0.0070 | 0.0144 |
| great_salt_plains | 0.95 | 8.1 | 7.3 | 54 | 64 | 1.19 | 0.0019 | 0.0024 |
| grimsel_alpine_cleft | 0.98 | 6.6 | 5.6 | 36 | 55 | 1.53 | 0.0025 | 0.0028 |
| jeffrey_mine | 0.85 | 13.3 | 12.4 | 54 | 58 | 1.07 | 0.0348 | 0.0385 |
| marble_contact_metamorphism | 0.84 | 10.9 | 11.2 | 38 | 48 | 1.26 | 0.0012 | 0.0011 |
| mvt | 0.84 | 13.7 | 12.7 | 49 | 55 | 1.12 | 0.0153 | 0.0194 |
| naica_geothermal | 0.87 | 10.1 | 9.8 | 38 | 45 | 1.18 | 0.0049 | 0.0057 |
| ouro_preto | 0.88 | 14.5 | 14.2 | 69 | 88 | 1.28 | 0.0069 | 0.0125 |
| porphyry | 0.83 | 15.3 | 14.8 | 62 | 66 | 1.06 | 0.0232 | 0.0463 |
| pulse | 0.86 | 9.7 | 9.3 | 33 | 39 | 1.18 | 0.0009 | 0.0013 |
| radioactive_pegmatite | 0.81 | 18.8 | 16.0 | 75 | 66 | 0.88 | 0.0070 | 0.0164 |
| reactivated_fluorite_vein | 0.88 | 14.4 | 15.3 | 86 | 97 | 1.13 | 0.0255 | 0.0346 |
| reactive_wall | 0.87 | 9.6 | 9.3 | 35 | 41 | 1.17 | 0.0042 | 0.0049 |
| roughten_gill | 0.78 | 20.0 | 19.4 | 69 | 71 | 1.03 | 0.0148 | 0.0420 |
| sabkha_dolomitization | 0.90 | 16.2 | 15.3 | 115 | 108 | 0.94 | 0.0146 | 0.0369 |
| schneeberg | 0.86 | 11.7 | 10.3 | 45 | 47 | 1.04 | 0.0108 | 0.0203 |
| searles_lake | 0.92 | 14.4 | 14.7 | 121 | 133 | 1.10 | 0.0112 | 0.0267 |
| shigar_pegmatite | 0.88 | 15.9 | 13.7 | 85 | 81 | 0.95 | 0.0040 | 0.0066 |
| sicily_solfifera | 0.85 | 20.1 | 19.2 | 104 | 100 | 0.96 | 0.0131 | 0.0435 |
| stalactite_demo | 0.87 | 9.4 | 9.1 | 33 | 40 | 1.21 | 0.0009 | 0.0013 |
| sulphur_bank | 0.94 | 7.3 | 5.9 | 29 | 30 | 1.03 | 0.0060 | 0.0052 |
| sunnyside_american_tunnel | 0.86 | 15.4 | 15.2 | 68 | 82 | 1.21 | 0.0200 | 0.0297 |
| supergene_oxidation | 0.87 | 13.6 | 11.2 | 56 | 56 | 1.00 | 0.0268 | 0.0340 |
| tn457_barite_pulses | 0.88 | 9.6 | 9.2 | 34 | 42 | 1.24 | 0.0053 | 0.0086 |
| tormiq_alpine_cleft | 0.98 | 6.6 | 6.2 | 78 | 84 | 1.08 | 0.0022 | 0.0032 |
| tutorial_first_crystal | 0.85 | 9.8 | 9.5 | 32 | 39 | 1.22 | 0.0007 | 0.0012 |
| tutorial_mn_calcite | 0.85 | 10.1 | 9.6 | 32 | 38 | 1.19 | 0.0009 | 0.0014 |
| tutorial_travertine | 0.83 | 10.8 | 10.9 | 35 | 42 | 1.20 | 0.0022 | 0.0031 |
| ultramafic_supergene | 0.84 | 21.9 | 20.7 | 112 | 106 | 0.95 | 0.0150 | 0.0469 |
| wittichen | 0.89 | 8.4 | 8.3 | 35 | 40 | 1.14 | 0.0020 | 0.0025 |
| zoned_dripstone_cave | 0.84 | 10.4 | 10.2 | 33 | 40 | 1.21 | 0.0021 | 0.0026 |

n = 41 scenarios (seed 42, cavity/orb view, same build; legacy = `--experiment legacylight`; subject L = mean over non-void pixels, derived as (mean L − void·4.5)/(1 − void) with the clear colour at L 4.5). R1 subject luminance 25–133 (median 55); R1/legacy subject-luminance ratio min 0.88, median 1.14, max 1.53 over 41 pairs; edge fraction higher under R1 on 39/41; frame mean L below 10 on 17 (R1) vs 14 (legacy) — that floor measured orb size, not light. Highlight fraction 0 in every orb frame under both (alpha ghosts behind a translucent shell; see R1's acceptance note). No exceptions and no shadow step-downs in any run.

**tn457_barite_pulses s42, same build (legacy → R1 cave):** hero-1 sphalerite L 96.8 → 102.0, edges 0.023 → 0.033; hero-2 barite 102.9 → 112.7, 0.020 → 0.025; druse 85.8 → 94.7, 0.019 → 0.027; orb 9.6 → 9.2, 0.0053 → 0.0086. Contact sheets: `.local-evidence/photos/{elmwood,tn457_barite_pulses}-s42-r1{,-before}/contact-sheet.html`.

### 3.5 R2 fleet sweep (2026-09-06) — orb view, every scenario, one build

R2 materials vs `--experiment legacylustre` (the pre-R2 class heuristics painted over the same
scene), seed 42, cavity/orb shot. In the orb view the active tier is **alpha on all 41** (the
translucent shell is no opaque backdrop for the transmission buffer — §5 R2), so this sweep
isolates the lustre consumer: roughness per term, metals at their measured reflectance,
dielectric F0 from the IOR. Subject L = the rig's `subject_luminance` (pixels above the dark bin).

| statistic | value |
|---|---|
| R2 / legacy subject-luminance ratio | min 1.00 · median 1.02 · max 2.76 (41 pairs) |
| edge fraction | higher under R2 on 33/41, lower on 6 (all six within 0.001) |
| highlight fraction > 0 in an orb frame | 4 scenarios under R2 (epithermal_telluride, mvt, sunnyside_american_tunnel, supergene_oxidation); 0 under legacy — the first orb highlights the rig has ever recorded |
| shadow step-downs / runtime exceptions | 0 / 0 |

The scenarios that move are the metal- and adamantine-bearing ones, as the mechanism predicts:
sulphur_bank ×2.76 (cinnabar at n 3.02 reflects 25 % from a 0.06-rough face; native sulfur at
n 2.08), sunnyside_american_tunnel ×1.51, deccan_zeolite ×1.39, porphyry ×1.36, bisbee ×1.32,
sicily_solfifera ×1.31, sabkha_dolomitization ×1.27, reactivated_fluorite_vein ×1.21,
supergene_oxidation ×1.20, mvt ×1.17. The tutorial, cooling, pulse and stalactite scenes are
unchanged to two decimals (no metals, alpha on both). Per-scenario rows are in the run
manifests (`.local-evidence/photos/<scenario>-s42-r2f{,-legacy}/manifest.json`, `gl.optics`
carries the tier receipt). One legacy run (ouro_preto) produced no manifest in the paired
sweep and was rerun alone (ratio 1.01, edges up, no step-down).

### 3.6 R6 fleet sweep (2026-09-06) — the specimen view, every scenario, one build

`--view specimen --shots specimen`, seed 42, the shipped pose (30° above, the half filling ⅔ of
the frame), the studio mood, the post pass on. Every scenario is a broken geode on the cloth: the
same cut rule, rind, fracture face and stage, sized by its own r0 and skinned by its own
lithology (13 lithologies in the fleet).

| statistic | value |
|---|---|
| edge fraction | median 0.036 · min 0.011 · max 0.111 · **26/41 in the photograph band [0.03, 0.12]** |
| below the band | 15: marble_contact_metamorphism 0.011, amethyst_geode 0.012, tormiq_alpine_cleft 0.016, cooling 0.019, chiastolite_hornfels 0.020, tutorial_first_crystal 0.020, pulse 0.022, deccan_zeolite 0.023, tutorial_mn_calcite 0.025, tutorial_travertine 0.026, naica_geothermal 0.026, stalactite_demo 0.026, reactive_wall 0.027, tn457_barite_pulses 0.028, colorado_plateau 0.028 |
| highest | shigar_pegmatite 0.111, supergene_oxidation 0.092, bisbee 0.082, roughten_gill 0.079, porphyry 0.074, schneeberg 0.072 |
| mean luminance | median 70.5 (48.8–88.0); the whole-vug photographs sit at 100–145 — the specimen frames run darker (the cloth is a third of the frame) |
| highlight fraction > 0 | 13/41 frames (median 0 — a whole-specimen frame at 0 EV; the metal criterion is measured on hero frames at +1 EV, §5 R6) |
| crystal bodies culled by the break | median 40 % of the bodies per scenario (a half, plus the rim band) |
| fracture quads | 305–748 per scenario |
| post pass on / transmission tier active | 41/41 · 41/41 (616 glass materials across the fleet — the opaque wall is the backdrop R2's glass needs) |
| shadow step-downs / runtime exceptions / shot errors | 0 / 0 / 0 |

Reading: the scenarios below the band are the ones whose interiors are a smooth lining with few
or tiny crystals (the laminated and stalactitic cavities), which is R3/R5 content, not the
presentation; the highest edge fractions are the crystal-rich pegmatite and druse cavities.
Per-scenario rows are in `.local-evidence/photos/<scenario>-s42-r6g/manifest.json`
(`camera.specimen` carries the receipt) and `sweep-r6g.log`.

### 3.7 R5 fleet sweep (2026-09-07) — the wall alone, every scenario, one build

`--view specimen --shots specimen,druse --probe wallperiod`, seed 42, the shipped build. For each
scenario the specimen frame and the druse frame were taken with the wall alone (crystals, water and
stage hidden) and measured through the whitened radial power spectrum; the nine reference photographs
of §10 read **peak ratio 1.19–1.48** through the same statistic. Relief families in the fleet:
scallops 12, comb 9, boxwork 4, smooth 4, basin 4, druse 3, botryoidal 3, cleft 2; lithologies:
limestone 14, basalt 5, dolomite 4, granite 4, pegmatite 3, banded_iron_formation 2, sandstone 2, ultramafic 2, hornfels 1, phonolite 1, marble 1, phyllite 1, amphibolite 1.

| statistic | specimen wall | druse (macro) wall |
|---|---|---|
| peak ratio | median 1.36 · max 1.93 · **31/41 ≤ 1.5** (the photograph band's top) | median 1.46 · max 2.84 · 25/41 ≤ 1.5 |
| above 1.5 | asbestos_hills_crack_seal 1.74 (comb), asbestos_hills_surficial_alteration 1.58 (comb), bisbee 1.51 (boxwork), chiastolite_hornfels 1.59 (smooth), colorado_plateau 1.81 (smooth), jeffrey_mine 1.52 (comb), searles_lake 1.52 (basin), sicily_solfifera 1.93 (basin), sunnyside_american_tunnel 1.86 (comb), tormiq_alpine_cleft 1.52 (cleft) | asbestos_hills_crack_seal 1.73 (comb), asbestos_hills_surficial_alteration 2.01 (comb), chiastolite_hornfels 1.83 (smooth), great_salt_plains 2.21 (basin), mvt 1.75 (scallops), ouro_preto 2.07 (comb), sabkha_dolomitization 2.84 (basin), searles_lake 1.69 (basin), shigar_pegmatite 2.25 (druse), sicily_solfifera 2.03 (basin), sulphur_bank 1.60 (botryoidal), tormiq_alpine_cleft 1.88 (cleft), tutorial_first_crystal 1.71 (scallops), tutorial_mn_calcite 1.78 (scallops), ultramafic_supergene 1.72 (botryoidal) |
| wall edge fraction | median 0.042 · **25/41 in [0.02, 0.06]** | median 0.0032 (a bare wall at macro scale has no drusy crust — R3) |
| wall mean luminance | median 47.6 | median — |
| specimen frame (with crystals) | edges median 0.046 · L median 76.5 | |
| runtime exceptions / shot errors | 0 | |

Reading: 31 of 41 specimen walls sit in the photograph band; the ten above it are the comb, basin
and cleft families — palisades, laminae and striations, periodic in nature (max 1.93) — and two
smooth-family walls (colorado_plateau sandstone 1.81, chiastolite hornfels 1.59) where the residue is
the skin painter's bedding bands at the 20 mm tile, the next thing to de-periodise. The macro walls
of the comb and basin families keep their structure; none is above 2.9 where the honeycomb read 4–9. Per-scenario rows
are in `.local-evidence/photos/<scenario>-s42-r5fleet/manifest.json` (`gl.wall` carries the
lithology, relief family and rock parameters; each shot's `probe.wallperiod` the spectrum).

## 4. Fixed in this commit

| id | change | files | tests | baseline |
|---|---|---|---|---|
| F1a | euhedral habit ≠ crust; macro body renders, small = druse | js/45 | surface-growth (+2) | byte-identical (no sim consumer) |
| F1b | coverage mass floor: 2 µm min film, 0.5% min coverage | js/45 | surface-growth | byte-identical |
| F1c | instances at a 1.5 mm footprint, caps 1536/384, 12×8 lobe, lobe height ≤ 3× mean thickness | js/99i | surface-growth, three-integration | render-only |
| F3 | tetrahedron token/builder/gates; cubic-named habits → cube | js/99i | sphalerite-tetrahedron (new) | render-only |
| F4 | shape audit reads the renderer's real system map | tools/morph-fidelity-audit.mjs | — | tool |
| F12 | photo rig: cleanup, tolerant polling, camera inside the cavity + raycast, experiments, photo stats | tools/photo-rig.mjs (new) | — | tool |

Verification run: `npm run typecheck`, `build:check` (bundle current), 28 render/morphology test
files / 310 tests green on the fork base and 319 on the canonical base (`vitest run` on the files
named in §9). Baking: on the fork base (SIM 271) `science:rebake` reproduced every seed-42
artifact byte for byte; on canonical (SIM 285) it moved only the corrected surface-growth
testimony (F13 has the leaf audit) and passed its verify phase. Cold CI on the canonical
transplant passed at `6a82949b` in GitHub Actions run `33953918483`; repository PR #7 is an
unrelated older canvas-lockfile change and is not evidence for this review.

---

## 5. The plan to 7/10 — render rungs

Ordered by (visual gain ÷ cost). Each rung is render-only unless marked, must show a photo-rig
before/after contact sheet, and carries a numeric acceptance on the rig's statistics. R1 and R2
were prototyped in `tools/photo-rig.mjs --experiment` this session; the pictures are in §3.

**Execution order as decided 2026-09-05 (§10): R1 → R2 → R6 → R5 → R3 → R4 → R7.** The rung
numbers below are kept as names; the sequence is the decided one.

### R1 — Light like a photograph (env map, shadows, tone mapping, exposure) · **SHIPPED 2026-09-05**
As planned:
- `scene.environment` from a procedural room baked once through `PMREMGenerator.fromScene`
  (vendored three r163; no CDN, no asset), rebaked on context restore.
- ACES filmic + `toneMappingExposure`; ambient floor 0.10 (the environment supplies ambient).
- Shadow-casting key (PCF-soft 2048² desktop, PCF 1024² on the mobile profile the
  surface-growth budget already recognises; frustum ±1.6·r0), crystals/swaths/satellites cast
  and receive, wall and water receive, phantom bands receive only.
- Inside/outside is an **exposure** change (cave ×1.3 inside); the environment is never removed.

As decided (D4/D5) and as learned building it:
- **Two moods**, `cave` (process view, default) and `studio` (for the specimen view, R6): the
  `LIGHTING_MOODS` table in `js/99i`. A `_topoApplyLightingMood(state, mood)` switch exists for R6.
- **The key rides the camera frame** (`_topoLightingSyncKey`: viewer's upper-left, aimed at the
  orbit target, shadow frustum sized to r0), so pan/zoom keep shadow texels on the subject and a
  hero frame is lit the way the player would see it. The old light was parked at a fixed offset.
- **Small, hot source.** A glass face mirrors ~4 % (F0), so a white highlight needs a source ≥ 25×
  the diffuse white level — a lamp or flash tube, not a softbox. Each mood has one 5–6 mm panel at
  intensity 45–60 beside a large soft one; the PMREM blurs the lamp by roughness on its own, so a
  rough face sees a sheen and a polished face a glint. The environment does not decide lustre;
  R2's materials do.
- **A measured step-down gate** (`_topoLightingNoteRenderTime`): four consecutive renders over
  120 ms halve the shadow map (2048 → 1024 → 512), then drop shadows; recorded in
  `state.lightingRig` and printed by the rig. CPU submission time only — a coarse guard, not the
  D4 frame-time gate proper.
- **Honest fallback**: if the PMREM cannot be baked (no generator, lost context) the rig records
  the reason and restores the pre-R1 two-light look. `tests-js/lighting-rig.test.ts` (15 tests)
  covers the contract; the bake itself is measured live by the rig's `gl.lighting` receipt.
- **F14 fixed on the way** (§2): the interior wall is drawn again from inside the cavity.

Measured (elmwood s42, ONE build; "legacy" = `--experiment legacylight`, the pre-R1 lights on the
same build, so the wall fix is in both columns — the wall's own before/after is in F14):

| frame | legacy L · edge | R1 cave L · edge | R1 studio L · edge | R1 + R2-preview highlights (cave · studio) |
|---|---|---|---|---|
| cavity (orb) | 11.85 · 0.0065 | 10.99 · 0.0095 | 13.82 · 0.0140 | 0.0000 · 0.0001 |
| hero-1 fluorite | 84.8 · 0.0072 | 94.1 · 0.0096 | 129.5 · 0.0099 | **0.0023 · 0.0024** |
| hero-2 calcite | 75.2 · 0.0043 | 93.0 · 0.0056 | 114.3 · 0.0069 | 0 · 0 |
| druse | 83.5 · 0.0073 | 97.3 · 0.0100 | 134.7 · 0.0105 | 0 · 0 |

`R2-preview` = `--experiment opaque,polish` (alpha off, roughness 0.12 on crystal bodies): the
materials R2 will ship. A mirror-ball body (`--experiment mirror`) shows the room's panels at
highlight fraction 0.016, so the environment reaches every material.

**Acceptance, restated honestly.** The planned "cavity highlight ≥ 0.002" cannot be met by
lighting alone and was never going to be: (1) the shipped bodies are 30–70 % alpha over the wall,
and a 50 % alpha caps a fully clipped reflection near L 200 — below the 235 bin; (2) roughness
0.42/0.62 spreads the lamp into a sheen. Under the R2-preview materials the hero frames sit in
the whole-vug photo band (median 0.004, floor 0.0005) in both moods; the orb view stays at
~0.0001 because its translucent shell halves the far wall (by design — D3 keeps the orb as the
process view). So the criterion moves to R2, where it belongs: **R1 is accepted on (a) the
environment reaching the materials (mirror ball), (b) the R2-preview hero highlights ≥ 0.002,
(c) the fleet's orb-view mean luminance within 10–60 (table §3.4), (d) `mineral-optics` green
and the 10 render test files green.**

### R2 — Materials that behave like minerals · **SHIPPED 2026-09-06** (D1 transmission, D2 lustre)

**Mechanism (js/99i `buildCrystalMaterial`, one pure resolver `opticsMaterialParamsFor`).**
- **Data first.** `optics.ior` — the mean principal refractive index (uniaxial (2ω+ε)/3, biaxial
  (α+β+γ)/3, isotropic n) — added to 85 optics blocks from webmineral's Optical Data line by
  `tools/optics-ior-verify.mjs` (82 machine-verified; spodumene, wollastonite and pararealgar
  typed from the Handbook of Mineralogy where webmineral has no line), cross-read against the
  Handbook values; `--gate` refuses a drift > 0.03. `optics.reflectance` — R at 589 nm in air,
  interpolated from the Handbook of Mineralogy R tables (`tools/optics-reflectance-verify.mjs`,
  pdftotext over rruff.net's HoM pages; R1–R2 pairs averaged) — on the 12 metallic/submetallic
  blocks (pyrite 55.1, chalcopyrite 47.4, galena 42.8, native silver 93.8, gold 88.1, …). The
  Depth-A1 lint now requires an index on every block that can transmit and a reflectance on
  every metallic one. Class defaults cover the 89 species without a block.
- **Lustre → one table.** metallic: metalness 1, roughness 0.28, F0 = the lexicon hue scaled to
  the measured reflectance's linear luminance (a hand-specimen swatch is dark *because* a metal
  mirrors a dark surround — using it as F0 counted that darkness twice: galena's swatch is 0.18,
  its R is 0.43); submetallic 0.6/0.42; adamantine 0.06, subadamantine 0.10, vitreous 0.09,
  subvitreous 0.15, resinous 0.22, subresinous 0.28, greasy 0.30, waxy 0.38, silky 0.45 + sheen,
  pearly 0.20 + sheen + thin clearcoat, dull 0.85, earthy 0.95 (both with damped specular). The
  first listed term is the characteristic one (chalcedony is waxy). Dielectric F0 comes from the
  IOR through `material.ior` (cerussite at n 1.98 reflects 11 %, quartz 4.6 %).
- **Transmission tier.** clarity > 0.15 → `transmission = 0.35 + 0.65·clarity`, opacity 1, depth
  write ON (the paper cut-outs of F5 are gone), `attenuationColor` = body colour,
  `attenuationDistance = extent·(0.6 + 1.4·clarity)` and `thickness = 0.9·extent` from the
  mesh's own smallest scaled extent once the scale is known (a 0.5 mm barite plate stays clear,
  a 20 mm fluorite cube is body-coloured across its depth; coating instances get their patch
  footprint); the base colour is lifted toward white so the body colour rides as attenuation.
  Species opaque in hand specimen (malachite 0.08) are simply opaque — no 94 % ghost. State
  modifiers stack as before (etched +0.30 roughness and clarity ×0.35 — still glassy at 0.32,
  frosted; CDR; inclusions opaque; hourglass cap 0.30; perimorph casts stay alpha shells).
  Three r163 draws the back faces of DoubleSide transmissive bodies into its buffer, so a
  crystal reads thick. Dispersion is not drawn (r163 has no `dispersion`).
- **Alpha tier = Depth-A verbatim** (`opacity = 1 − 0.70·clarity`): mobile viewports, the
  lighting rig's own fallback, and the step-down gate's second rung (2048 → 1024 → **glass →
  alpha** → 512 → shadows off; `tests-js/optics-r2-materials.test.ts` pins the ladder).
  `_topoOpticsApplyTier` moves a live scene between tiers in place; every material carries its
  resolved params in `userData.optics` for the rig's receipt (`manifest.gl.optics`).
- **Found on the way — glass needs an opaque backdrop.** three.js renders only opaque objects
  into the transmission buffer, so in the orb view (translucent BackSide shell) or with the wall
  hidden, transmissive crystals showed the clear colour through themselves (black holes with
  reflections; `elmwood-s42-r2/cavity.png`, first cut). The ACTIVE tier therefore follows the
  wall (`_topoOpticsSyncView`, called from `_topoApplyWallDisplay`): alpha in the orb view,
  glass inside the cavity and in the R6 specimen view where the wall is opaque. `tier` records
  the capability, `active` what is painted. A second rig lesson: the see-through probe's
  no-wall frame must hide the cavity mesh directly — going through the display function
  retiers the scene and the delta measures the tier change, not the wall.

**Measured (photo rig, seed 42, one build, R2 vs `--experiment legacylustre` = the pre-R2
class heuristics painted over the same scene; "inside" = the see-through probe's statistics
inside the hero body's own silhouette; wall Δ = mean |ΔL| inside the silhouette when the wall
behind is hidden, i.e. how much of the crystal's look is the substrate seen through it).**

| frame | R2: L / inside L / wall Δ / edges / hl | legacy: L / inside L / wall Δ / edges / hl |
|---|---|---|---|
| elmwood hero fluorite (cube, clarity 0.85, n 1.433) | 79.7 / 67.5 / 11.1 / 0.0187 / **0.0009** | 94.1 / 104.6 / 16.7 / 0.0096 / 0 |
| elmwood hero calcite (scalenohedron, 0.85, 1.595) | 91.5 / 84.9 / 12.0 / 0.0087 / 0 | 93.0 / 113.4 / 22.2 / 0.0056 / 0 |
| elmwood hero celestine (0.80, 1.625) | 107.2 / 89.9 / 9.8 / 0.0133 / 0 | 121.5 / 136.3 / 25.7 / 0.0024 / 0 |
| elmwood druse | 86.3 / – / – / 0.0207 / 0 | 97.3 / – / – / 0.0101 / 0 |
| tn457 hero sphalerite (tetrahedron, 0.40, 2.40) | 96.5 / 104.0 / 31.8 / 0.0293 / 0 | 102.0 / 99.8 / 30.6 / 0.0328 / 0 |
| tn457 hero barite (plates, 0.70, 1.640) | 107.8 / 113.3 / 17.1 / 0.0265 / 0.0001 | 112.7 / 145.1 / 4.0 / 0.0248 / 0 |
| naica hero selenite (blade, 0.95, 1.524) | 102.9 / 95.4 / 33.2 / 0.0066 / 0 | 120.1 / 121.7 / 46.7 / 0.0061 / 0 |
| mvt hero galena (cave mood, R 42.8 %) | 83.5 / **37.3** / 1.3 / 0.0108 / 0 | 92.1 / 57.0 / 1.3 / 0.0090 / 0 |
| mvt hero galena, `--mood studio` | 102.0 / – / – / 0.0133 / **0.0068** | – |
| mvt hero pyrite (cave mood, R 55.1 %) | 65.0 / 50.3 / 7.7 / 0.0126 / 0.0001 | – |

Reading: a transparent crystal is now *darker* inside its silhouette than its alpha ghost
(0.65–0.75×) because it shows the attenuated, refracted, Fresnel-weighted wall — including its
own shadow — instead of a 50 % blend; its edge structure rises ×1.5–5.5; the substrate is
sampled inside every transparent silhouette on both tiers (wall Δ 10–33), and on the legacy
tier barite's Δ 4 was the stacked plates hiding the wall from each other. Metals: galena's
inside luminance 11 → 37 once F0 became its measured reflectance (first cut used the swatch);
a mirror in the cave room is still darker than the legacy Lambert grey — physically right, and
the studio mood (the R6 specimen light) puts 0.0068 of the frame in the highlight bin.

**Acceptance, restated honestly.** *Substrate through the crystal:* met on both tiers and now
measured by the probe. *Galena/pyrite highlight ≥ 0.01:* not met in the cave mood by the
materials alone — a metal's highlight needs a lamp it can mirror, and the cave room's is a
small fixed panel; under `--mood studio` galena reaches 0.0068 in a single un-posed frame, so
the criterion moves to R6's specimen view, where the light faces the specimen. *Whole-frame
highlight ≥ 0.002 (carried from R1):* fluorite 0.0009 with the crystal alone; the rest is
facet count — a scalenohedron with 12 faces catches a 5 × 5 lamp rarely; R4's forms are the
remaining lever. Eye-check (`elmwood-s42-r2/hero-1-fluorite.png` vs `-r2-legacy`): the cube
shows its far faces and the wall through itself, with weight and a shadow; the barite plates
in tn457 read as stacked translucent glass; the Naica blade as smoky translucent gypsum. The
whole-vug photo set still wins on facets and wall texture (R4, R5).

### R3 — Coatings at physical scale · 2–4 days · no decision
- **R3a implemented 2026-09-07:** `laminated_lining` now copies the authenticated patch's
  triangles into a continuous shell, displaced into the void by mean thickness (including
  replay maturity). Shared vertices share normals and underburden; the last triangle is
  shortened to its booked area. The source geometry and surface-growth record stay unchanged.
  Fine triplanar grain reuses the wall texture at a 2 mm scale and low amplitude; polygon
  depth bias replaces the old 60 µm display-thickness floor. The patch remains raycastable,
  follows the specimen fragment/depth cut, and disposes its owned geometry on rebuild.
  Desktop/mobile draw identical shells; this does not increase the instance budget.
  Deccan seed 42 replaces the three chalcedony tile carpets with continuous grey-blue patches;
  the patch perimeter still reflects the authenticated mesh's triangle resolution. Remaining
  botryoidal coins and sparse teeth belong to the next two R3 items below. This is a partial
  R3 delivery, not a new overall realism score.
  Photo pairs: `.local-evidence/photos/deccan_zeolite-s42-{before-r3,lining-r3a}/`;
  specimen edges 0.03611 → 0.03366 (removing tile edges), luminance 62.17 → 62.41;
  druse frame identical because it frames another part of the cavity. Elmwood and tn457
  use the same before/after labels as regression controls. The rig roster now distinguishes
  `wall-conformal-lining` and records its actual thickness and covered area.
  Tests: `surface-growth-three-integration` (7), `specimen-view` (20), `surface-growth` (15).
  The full owned-browser journey and exact receipt audit passed without UI ID re-pins.
  The fresh science rebake passed (128 artifacts, zero locality violations, 55 focused
  science tests); all 41 stories, the three-seed frequency baseline, seed-42 scenario
  baseline and chemistry digest are byte-identical to R5. Only the executable-bound
  evidence envelopes and release manifest change. Cold CI is a publication gate on
  the frozen evidence commit; its local verdict belongs in
  `.local-evidence/test-workflow-last-pass-v2.json`, not in a rewritten science receipt.
- **R3b implemented 2026-09-07:** `botryoidal_crust` at ≤60 µm mean thickness uses the
  authenticated continuous shell and shared normal grain, replacing the minimum-height coins.
  Thicker crusts retain instances with a renderer-local, deterministic bounded lognormal
  diameter distribution (σ 0.32), overlapping at canonical desktop spacing, capped at 5 mm.
  Mobile reduces count without inflating diameter; lobe relief and later-layer underburden
  are bounded by three times recorded thickness, including replay maturity. Thin skins and
  lobes are alternative representations of the same booked aggregate, never extra parents.
  This is a visual sampling heuristic, not a new growth law or a claim of volumetric closure.
  Bisbee seed 42 before/after: 14 thin skins and two lobe swaths; druse edge fraction
  0.07938 → 0.03637, specimen 0.07887 → 0.07030. Photos at
  `.local-evidence/photos/bisbee-s42-{before-r3b,crust-r3b}/`; Deccan and Elmwood have
  `crust-r3b` captures against their R3a photos. The plate carpet is removed; close-up
  triangle-boundary seams and some exposed bulbous mineral forms remain. No overall
  realism-score claim. Nine surface integration tests cover physical films, disposal,
  repeatable size tails, the 5 mm bound, replay relief, and LOD-independent dimensions.
  F13 coupling: the first completed browser journey differs from R3a only in the
  collection ID (`cry-16-15q` → `cry-16-ie2`) and skip-save ID (`save-16-zkp` →
  `save-16-evi`), because shell geometry allocations change Three.js UUID consumption.
  The producer expectations are re-pinned; geology fingerprints and all other journey
  fields are identical. The receipt must be generated by another full owned-browser run.
  The fresh owned-browser rerun and receipt audit passed. The science rebake passed:
  128 authenticated artifacts, zero locality violations, and 55 focused science tests.
  All 41 stories, the three-seed and seed-42 baselines, and the strip/chemistry digest
  are unchanged. The new browser receipt digest propagates through the mechanism
  witness's browser-authority link and the 41 claim-card pairs; witness science is unchanged.
  Uninterrupted cold CI gates publication of the frozen evidence commit; its exact
  verdict belongs in `.local-evidence/test-workflow-last-pass-v2.json`.
- **R3c hostile-review PASS 2026-09-07:** supersedes R3b's disconnected
  thick-crust ellipsoids with a basal skin and merged mound relief on the authenticated
  footprint. The deterministic lobe kernels retain the 5 mm diameter bound; the complete
  representative envelope is capped by three times recorded mean thickness. This is a
  representative surface, not a new scientific volume or growth law.
  Later coatings inherit the actual piecewise-linear contact, including troughs and
  partially booked triangles. Scattered teeth/fibres no longer lift a whole later coating
  by a nominal blanket height. Canonical shared-edge interpolation and explicit microscopic
  risers preserve contact across earlier film boundaries. The same geometry supplies
  mobile, replay, picking, specimen cuts and disposal.
  Hostile iterations exposed slope-biased buried faces, normal-offset folds and excessive
  rebuild cost. Slope bias is now zero; smooth local curvature limits reduce only the new
  representative relief, and unresolved folds fail closed. Diagnostics distinguish target
  mean thickness/envelope from measured relief and the minimum local attenuation factor.
  Source geometry, chemistry and booked surface-growth records remain immutable.
  Independent hostile review rejected the earlier torn, folded, pinched and globally
  flattened candidates, then passed V11 after actual Bisbee, Deccan and Elmwood captures.
  All 20 Bisbee continuous coats have zero measured top-face folds. Malachite's inherited
  2 µm steps have 168 explicit bridge quads; the independent edge probe finds zero uncovered
  paired steps. Gold/malachite measured maximum relief is 0.853/0.829 mm against a 0.88 mm
  target envelope. Deccan's seven continuous coats remain 1.998–2.002 µm at a 2 µm target,
  with zero folds; Elmwood's ordinary-body control has no material visual regression.
  Photos: `.local-evidence/photos/{bisbee,deccan_zeolite,elmwood}-s42-connected-r3c-v11/`.
  Review: `.local-evidence/r3-hostile-review.md`; 48 focused tests pass (13 surface
  integration, 20 specimen, 15 surface science), including reviewer-authored curved-edge
  and microscopic-riser regressions. This is a connected-crust pass, not completion of
  every R3 item or a new photorealism score. Source faceting and patch borders remain.
  **Performance limitation:** Bisbee rebuild is 10.972 s versus R3b's 1.859 s; shared contact
  calculations reduce the earlier 62 s candidate substantially but do not restore baseline
  rebuild speed. Warm reuse is 14.5 ms and five-frame GPU-synchronized median is 6.7 ms on
  RTX 3080. Deccan/Elmwood builds are 754/305 ms. No mobile hardware timing claim.
  Local fold checks do not prove absence of all possible global self-intersections.
  The full owned-browser journey and exact receipt audit pass with no expectation re-pins;
  its journey payload is identical to R3b, including geology fingerprints and UI IDs.
  The fresh science rebake passes: 128 authenticated artifacts, zero locality violations,
  and 55 focused science tests. All 41 stories, both scenario baselines, the strip digest,
  mechanism testimony and all claim cards are unchanged. Only executable-bound hashes
  and receipt links change. Uninterrupted cold CI gates publication of the frozen delivery
  commit; its exact local verdict belongs in `.local-evidence/test-workflow-last-pass-v2.json`.
- `euhedral_druse` → teeth sized from the aggregate's own zone record, thousands of instances
  where the mass allows, orientation jitter ±20°.
- **Acceptance:** no swath instance larger than 5 mm across on any scenario (rig roster check);
  Elmwood dogtooth silhouette visible in its hero shot at ≥ 20% of frame height.

### R4 — Crystallographic forms for the species that matter · 4–6 days · no decision
**R4a first implementation, 2026-09-07 (`codex/visual-realism-r4`):** ordinary
prismatic quartz now uses point-group-32 m/r/z planes with a flat attachment scar,
three larger r and three smaller z termination faces, and a slightly displaced
apex. Plane distances develop the aspect; parent and satellite transforms are
uniform, so the metric face angles survive rendering. Geometry is cached by
bounded aspect, family-contrast and phase buckets. Scientific records are unchanged.

Prism faces carry shallow, anti-aliased transverse normal relief at a nominal
0.18 mm pitch with irregular modulation. Up to 16 strong changes in recorded
positive growth increments add broader bands; future zones never enter replay.
The physical scale comes from each mesh's transform, including satellites.
Unresolved fine lines fade rather than alias. See [van Praagh & Willis (1952)](https://doi.org/10.1038/169623b0)
for the transverse growth-sheet texture; the rendering does not claim that every
line is an oscillatory prism/rhombohedron combination. The mapping from scalar
growth history to band position and r/z contrast is an explicit visual model,
not measured per-face kinetics. The deterministic lateral phase is representative
habit variation, not an inferred directional fluid history.

Production captures: `.local-evidence/photos/cooling-s42-r4-before` versus
`cooling-s42-r4-final`; the final hero has edge fraction 0.00762 versus 0.00581,
with mean luminance 182.11 versus 182.35. The first prototype was rejected locally
for double-stretched satellites and excessive stripe relief; both were corrected.
The final capture is pixel-identical to the accepted V2 image after the live-history
invalidation fix. Grimsel control photos are in `grimsel-s42-r4-v2`; its specialized
quartz forms keep their existing builders. Focused checks: 7 quartz geometry/history/
shader/renderer tests, 10 Grimsel, 5 deformation, and 20 specimen tests pass.
**Validation completed 2026-09-08:** 97 focused tests pass (the 42 above, 9 browser
receipt, 4 contact-render wiring, 28 cluster and 14 mesh tests). The full owned-browser
journey and receipt audit pass. Its only payload change is F13's collection record
ID (`cry-16-ie2` → `cry-16-wr2`, in two references), re-pinned only after the exact
journey comparison and a second complete execution. All geology fingerprints and
player controls remain unchanged. Fresh science rebake passes: 128 authenticated
artifacts, zero locality violations, 55 science tests. Both baselines and all 41
story archives are byte-identical; claim-card edits only update evidence hashes.
Typecheck, exact generated-bundle check and release audit pass. This validation is
the focused suite plus full science rebake, not a new all-files cold CI run.
Cooling renderer timing: 248 ms cold build (184 ms before), 1.8 ms warm reuse,
1.1 ms median GPU frame on RTX 3080; no slower-hardware timing claim.

**R4b sulfide implementation, 2026-09-08 (`codex/visual-realism-r4`):** ordinary
sphalerite now combines separate positive/negative {111} tetrahedra with {110}
faces, respecting point group -43m. Pyrite now combines {100}, {111} and the
twelve {210} planes of point group m-3. Its pyritohedron has unequal pentagonal
edges, replacing the regular Platonic dodecahedron. Sources:
[sphalerite](https://www.handbookofmineralogy.org/pdfs/sphalerite.pdf) and
[pyrite](https://www.handbookofmineralogy.org/pdfs/pyrite.pdf), Handbook of Mineralogy.
Face distances develop the declared habit with eight bounded representative
variants; these are render choices, not measured kinetic coefficients or new
inferences about the fluid history. Parent and satellite scales remain uniform.

Pyrite {100}/{210} faces carry shallow normal relief at a nominal 0.08 mm pitch,
with irregular modulation and pixel-footprint fading. Groove directions cycle
with pyritohedral symmetry; octahedral faces, attachment scars and new neighbor
contacts stay smooth. Neighbor clipping transfers attributes only to surviving
growth faces. Etched cubes, iron-cross twins, surface-growth representations,
and recorded skeletal terraces retain priority. Ordinary stepped pyrite uses
the new faces instead of the square-section terrace stack. No growth records,
random draws, thermodynamic inputs or SIM version were changed.

The photo rig adds an explicitly diagnostic `--probe isolated` image with
neighboring crystals hidden; geometry, material, camera, wall and lighting remain
the shipped renderer's. Normal gameplay captures remain alongside it. Its job
launcher now yields before synchronous GPU readbacks, allowing the existing
long-job polling deadline to govern auxiliary captures.

Production comparison: `.local-evidence/photos/mvt-s42-r4b-before` versus
`mvt-s42-r4b-final` (seed 42, specimen view). The final pyrite hero has mean
luminance 77.52 versus 69.63, edge fraction 0.01561 versus 0.01239. The first
0.22 mm relief prototype was rejected visually as too corrugated; the final
0.08 mm pattern is finer and shallower. Full-specimen mean luminance stays
80.15 versus 80.14. Final capture: zero exceptions and zero failed shots;
766 ms cold renderer build, 7.2 ms cached redraw, 3.7 ms median GPU frame
on RTX 3080 (before: 788 / 10.9 / 4.5 ms; single runs, not a speedup claim).
Sphalerite diagnostics in `mvt-s42-r4b-sphalerite` and `elmwood-s42-r4b-detail`
confirm developed faces; normal hero views remain heavily obscured by neighbors.
The isolation probe is not evidence that those faces are visible in gameplay.

109 focused tests pass: 7 new sulfide geometry/shader/clipping/renderer checks,
4 existing sphalerite, 14 pyrite morphology, 11 iron-cross twin, 7 quartz,
4 contact-render wiring, 28 cluster, 14 mesh, and 20 specimen tests.
The full owned-browser journey and receipt audit pass; the browser payload is
byte-for-byte unchanged and no semantic expectation was re-pinned. Its 9 contract
tests also pass, bringing focused validation to 118 tests. Fresh science rebake
PASS: 41 scenarios at seeds 1/2/42, 128 authenticated artifacts, zero locality
contract violations, and 55 science tests. Both baselines, all 41 story archives,
the strip digest, mechanism testimony and claim cards are byte-identical;
only executable hashes and evidence links change. Validation is the focused
suite plus full science rebake, not a new all-files cold CI run. Typecheck,
exact generated-bundle check, release audit and diff whitespace check pass.

**R4c gypsum/dolomite work, 2026-09-08 (`codex/visual-realism-r4`):** gypsum's
selenite variety is the production tenant. Ordinary blades combine {010}, {120},
{-111} and {011}, using the De Jong/Bouman C2/c morphological setting from
[Aquilano et al. (2022)](https://doi.org/10.1039/D2CE00508E): a=5.63, b=15.201,
c=6.23 Å, beta=113.80 degrees. The Handbook's alternative I2/a cell must not
be mixed with these indices. A rigid rotation places c on renderer Y and b
on -Z; plane distances develop width and thickness without stretching the
finished face angles. The exact scalar dimensions invalidate live geometry.

Ordinary dolomite uses six {10-14} planes under point group -3 and its own
structural hexagonal cell (a=4.812, c=16.020 Å; see the
[dolomite (104) surface study](https://www.sciencedirect.com/science/article/abs/pii/S0039602810003055)), rather than the generic
pointed prism reached by the engine's `coarse_rhomb` habit. Its species-scoped
token correction retains the air-mode override. Both new forms normalize by
their growth-axis extent and scale uniformly, including satellites. Attachment
scars coincide with the existing anchor offset; the neighbor-contact bound
includes the full dolomite rhomb, including visibility-enlarged tiny crystals.
Face distances are representative render parameters, not measured kinetics.

Recorded twins, hourglass sectors, deformations, saddle/curved forms and
aggregate routes retain priority. Before captures are in
`.local-evidence/photos/naica-s42-r4c-before` and `sabkha-s42-r4c-before`.
Reviewed final captures are `naica-s42-r4c-v1` and `sabkha-s42-r4c-v1`, both
with zero exceptions and zero failed shots. Naica's generic slab becomes an
oblique, thin blade; sabkha's pointed dolomite becomes a rhomb. Normal and
explicitly isolated diagnostics are both retained: crowding, existing optics,
and visibility floors remain limitations, not claims of specimen-scale fidelity.
Full-scene mean luminance: Naica 82.93 -> 82.95; sabkha 61.79 -> 61.79.
Cold build / cached redraw / median GPU frame (RTX 3080, single runs):
Naica 198/4.0/2.3 -> 211/6.1/2.7 ms; sabkha 2469/11.1/5.5 -> 2449/11.5/5.5 ms.

116 focused tests pass: 9 new form/attachment/cache/contact checks, 3 saddle
dolomite, 13 swallowtail, 6 hourglass, 5 deformation, 4 contact-render wiring,
28 cluster, 14 mesh, 20 specimen, 7 quartz and 7 sulfide tests.
The full owned-browser journey passes with an identical payload and no
expectation re-pin. Receipt audit and its 9 tests also pass (125 focused tests
in total). The fresh science rebake passes: 55 tests in 7 files, 128 authenticated
artifacts, and zero locality-contract violations. Three-seed frequencies,
canonical seed-42 baselines, all 41 story archives, strip digest, mechanism
testimony and claim cards are unchanged; only executable-bound hashes and
evidence links change. No new all-files cold CI run is claimed. Typecheck,
exact build and release audits pass.

**R4c recognition correction, 2026-09-08:** Rock Bot rejected the original
selenite capture as too thick, equant and isolated. The earlier geometry checks
did not establish mineral recognition. Ordinary gypsum/selenite now develops
narrower {010} lamellae through plane distances, retaining the metric and fixed
face angles. The user's four natural-reference photos, especially the radial
South Dakota intergrowth in photo 4, supersede the overly regular coplanar fan
prototype. Representative members now form three related orientation groups
around one compact root patch: upright leaders, crossing intermediate blades,
and nearly horizontal peripheral blades. Length, width, end-face development
and burial fraction vary deterministically. Three short, broad basal intergrowth
members fill the center. They remain display members of the same Crystal
record, not new nucleations or asserted swallowtail twins. Recorded twins,
sectors, deformations and surface-growth aggregates retain priority.

Broad cleavage faces receive restrained satin roughness and lengthwise optical
veils. The basal intergrowth is cloudier with localized warm coloration; these
are representative display details, not new deposits, inclusions or growth
history. Uniform geometry scaling now supplies the actual local blade thickness
to the optics model. Alpha layers accumulate without depth writing, including
after optics-tier changes and helix restore; transmission retains depth writing.
The separate shared basal material has an explicit helix owner.

The actual Naica seed-42 assemblage contains one selenite and six celestine
records; the surrounding blocky celestine must not be relabeled as gypsum.
Photo manifests expose actual twin law, blade geometry, spray groups and depth
policy. The optional `cluster` probe frames the whole intergrowth from a broad
side without changing scene geometry/materials; the original hero camera remains
available for comparison. The `isolated` probe hides all other crystal meshes,
including satellites, and is labeled accordingly. References are retained only
locally as `.local-evidence/selenite-reference-{1..4}.png`.
Broader wall warmth/contact shading, surface damage and encrustations remain
open. The rejected original is `naica-s42-r4c-v1`; the regular fan is
`naica-s42-r4c-correction-v3`. Reviewed starburst captures are
`naica-s42-r4c-spray-v10`, including the unchanged hero-camera comparison and
the broadside full-cluster diagnostic. Zero exceptions/failed shots; 7 simulated
crystals remain, with 58 display meshes. This remains cleaner and less weathered
than reference photo 4, not a claim of complete specimen fidelity.
145 focused tests pass (12 form/spray/optics/helix, 13 swallowtail, 6 hourglass,
5 deformation, 4 contact wiring, 14 mesh, 20 specimen, 28 cluster, 34 optics,
9 browser-receipt). The owned-browser workflow and exact browser-receipt audit
pass. The required fresh science rebake passes: 55 science tests in 7 files,
128 authenticated artifacts, 41 scenarios and zero locality-contract violations.
Three-seed frequencies, canonical seed-42 counts, all 41 stories, strip digest,
mechanism testimony and claim cards are unchanged. Only executable-bound hashes
and evidence links change. The earlier fan rebake was deliberately interrupted
after the user supplied the radial-intergrowth references. No new all-files
cold CI run is claimed. Typecheck, exact build and release audits pass.

**R4c interpenetration follow-up, 2026-09-08:** The user found the first radial
spray closer but still missing selenite interpenetration. Shared roots and nearly
parallel pairs left the blades reading as attached props. Projecting members now
cross through the parent body at two interior heights, retaining visible length
on both sides of the junction. Subsidiary blades have oblique axes and cleavage
faces so they interrupt the larger faces in depth. The basal mass remains the
cluster's foot. These are representative intergrowths within the existing record,
not additional nucleations or asserted formal twin laws.

Reviewed actual-render capture: `naica-s42-r4c-penetration-v4`, including the
original hero camera and full-cluster broadside diagnostic. The new geometry
regression requires strict shared solid interiors for at least four projecting
members across multiple identities and tabular/prismatic proportions; projected
overlap or root-only contact cannot satisfy it. The user accepted this increment
as "much better" and requested a reusable skill for suitable barite/calcite forms.
The personal `mineral-intergrowth` skill records the before/after case and keeps
aggregate arrangement separate from species-specific geometry. Surface weathering
and complete specimen fidelity remain open.

Validation: 146 focused tests pass (137 renderer/special-form/optics tests plus
9 browser-receipt tests), owned-browser workflow and exact receipt audit pass.
Fresh science rebake passes with 55 science tests, 128 authenticated artifacts,
all 41 scenarios and zero locality-contract violations. Frequencies, canonical
counts, all stories, strip digest, mechanism testimony and claim cards remain
unchanged; only executable-bound hashes and evidence references change. No new
all-files cold CI run is claimed. Typecheck, exact build and release audits pass.

**R4d barite habit separation, 2026-09-09:** The user explicitly cautioned that
selenite-style intergrowth is only one possible barite arrangement. This slice
does not install a species-wide spray. Ordinary fallback tabular, bladed,
cockscomb and prismatic records now receive orthorhombic face geometry using the
existing barite cell (8.879, 5.450, 7.152 Å). Plate forms use b along renderer Y;
prismatic forms retain c along Y. {001}, {210}, {101}, {011} and supplementary
pinacoids develop through plane distances, with uniform mesh scaling and the
existing attachment policy. The proportions/bevel development are representative
rendering parameters, not calibrated face kinetics. See the
[Handbook of Mineralogy](https://www.handbookofmineralogy.org/pdfs/baryte.pdf)
for barite's diverse tabular, prismatic and crested habits.

Only the recorded `cockscomb` habit gets a compact crested row of overlapping
plates with unequal heights and related lean. No formal twin law or new
nucleation is asserted. Tabular/bladed/prismatic records retain their existing
population layout. Used Wulff geometry, deformation, twins, split growth and
surface aggregates keep priority. A Wulff tag on a cockscomb previously had no
matching tablet route and still fell through to a generic pointed prism; that
fallback now receives the crest. Snowball barite remains unchanged.

Reviewed captures: `wittichen-s42-r4d-before` and `wittichen-s42-r4d-final`, crystal
39; the final hero reuses the before manifest's camera (coordinates rounded to
0.01 mm), with a separate broadside cluster diagnostic. `mvt-s42-r4d-tabular`
shows crystal 8 remaining tabular. `elmwood-s42-r4d-control` retains snowballs;
`tn457-s42-r4d-prismatic` retains a specialized growth form, so it is a preservation
control, not visual acceptance of the new ordinary prismatic fallback. Ordinary
prismatic proportions are geometry-tested; broader specimen-fidelity acceptance
remains open. No material or weathering upgrade is claimed. Photo tooling now
supports stable `--crystal-id` and `--camera-from` selection and reports barite
form/crest metadata.

The first browser evidence run completed its journeys but rejected the stale
Chrome environment pin: the installed browser had updated from 152.0.7977.76 to
152.0.7977.83. The executable SHA-256 was re-measured and the explicit pin updated;
DevTools port-owner attestation and exact receipt verification remain required.

158 focused tests pass (149 renderer, including 8 barite; 9 browser-receipt),
covering metric normals, habit distinction, scars, shared solid interiors,
routing and unchanged records. Fresh owned-browser generation/audit and the full
Node 24.15.0 science rebake pass: 128 authenticated artifacts, 41 localities with
zero unclassified products/contract violations, and 55 science tests. Frequency
and seed-42 baselines, growth archives and strip digest are unchanged. The Chrome
pin changes the browser authority hash in the mechanism receipt; regenerated
claim cards change only their linked evidence hashes, not scientific testimony.
Release generation/audit, typecheck and exact 182-module build check pass. This is
focused validation plus the full science rebake, not an all-files cold CI run,
and does not close R4.

**R4e aragonite cyclic twin, 2026-09-09:** Replace the Three.js cyclic-sextet
builder's three exact-60-degree rectangular boxes with adjoining orthorhombic
sectors. The existing structural cell (4.9598, 7.9641, 5.7379 Å, c on renderer Y)
sets reciprocal-metric {110} normals. Repeated reflection gives the derived
116.17-degree sector orientation step (equivalent basal orientation difference
63.83 degrees about their shared c-axis), rather than exact hexagonal symmetry.
{110} sector boundaries overlap
slightly at the core; unequal {001} termination heights expose the members.
{010} planes remain in the construction. Face distances, small boundary overlap
and relative heights are representative display parameters, not calibrated twin
domain growth or a new simulation mechanism. Reference:
[Handbook of Mineralogy: aragonite](https://www.handbookofmineralogy.org/pdfs/aragonite.pdf).

Routing remains restricted to the existing fluid-mode `cyclic_sextet` record.
Air-mode frostwork, ordinary habits, contact twins and the legacy 2D schematic
remain unchanged. No species-wide aggregate substitution or material change.

Visual evidence: `aragonite-r4e-clean-before` versus `aragonite-r4e-final` reuses
the same saved hero camera (rounded coordinates), with isolated and broadside
diagnostics. These are **controlled display fixtures**, not naturally simulated
trillings: the photo rig substitutes a fresh 8-by-5-mm twinned aragonite record at
the travertine aragonite anchor and labels its manifest accordingly. The first
fixture attempt inherited specialized-growth tags and was invalid for this
comparison; the fresh record fixes that. An intermediate full-prism arrangement
still looked star-shaped and was replaced by the adjoining sectors. Unmodified
`aragonite-r4e-travertine-control` and `aragonite-r4e-cave-control` preserve their
existing forms; all final captures report zero browser exceptions. Broader
natural-specimen fidelity, contact-twin correction and ordinary aragonite forms
remain open.

Validation: 185 focused tests pass (176 renderer/geometry, 9 browser-receipt),
including metric normals, outward winding, connected solid interiors, stepped
terminations, production mesh routing at two sizes, preserved records and the
existing air/contact-twin dispatch guards. Fresh owned-browser generation/audit
and the complete Node 24.15.0 science rebake pass: 128 authenticated artifacts,
41 localities with zero unclassified products or contract violations, and 55
science tests. Frequency/seed-42 baselines, growth archives, strip digest, claim
cards and scientific receipt payloads are unchanged; receipt differences are
renderer/execution hashes and their manifest links. Release generation/audit,
typecheck and exact 182-module build check pass. This is focused validation plus
the full science rebake, not an all-files cold CI run; R4 remains open.

**Still open in R4:** true doubly terminated quartz routing, accessory s/x faces,
full per-face growth histories, richer striations on specialized quartz forms,
the other mineral tenants, chamfers, and the fleet-wide mis-shape acceptance gate.
These delivered slices do not mark the whole R4 rung complete.

**Next tranche selected 2026-09-07:** begin with quartz (R4a), following the
R3c connected-crust delivery `f1440235`. R3's remaining mass-sized druse work
stays open; selecting R4 does not close it. Graphics quality controls and
progressive rendering are deferred to final visual polish (ledger).

**R4a implementation constraints from the initial code review:**
- Introduce quartz's point group 32 separately from calcite's existing `trigonalR`
  expansion, which includes inversion. Keep m, r and z as distinct families;
  larger r faces mean slower advance / smaller central distance, not larger rates.
- Use the measured cell (a = 4.9135 Å, c = 5.4050 Å) to derive the face normals.
  Sources: [Handbook of Mineralogy](https://www.handbookofmineralogy.org/pdfs/quartz.pdf)
  and [Gault (1949), The Frequency of Twin Types in Quartz Crystals](https://www.minsocam.org/msa/collectors_corner/arc/qtztwin.htm).
  Relative face development remains a declared rendering model, not a measured
  growth-rate calibration.
- Preserve face angles through the final mesh transform. The generic prism's
  separate width/length scaling would distort a crystallographic termination;
  develop the aspect using plane distances, then scale the body uniformly.
- Keep quartz's gwindel, sceptre, deformation, twin and replay precedence intact.
  Photograph ordinary and doubly terminated quartz on the shipped renderer, with
  a specialized-habit control, before claiming the tenant complete.
- Acceptance for this first slice: three large r and three small z faces at the
  free termination, correct normals at the actual renderer parameters, stable
  attachment and scientific records, and a same-camera production before/after.
  The fleet mis-shape target and other tenants below remain the wider R4 gate.

- Extend the Wulff tenancy (`js/46`) to **quartz** (m {10-10}, r {10-11}, z {01-11} at the real
  38° with r > z, plus optional s/x), **sphalerite** ({111} + {-1-1-1} tetrahedra + {110}),
  **pyrite** (cube/pyritohedron/octahedron with {210} striations), **gypsum** ({010} tabular with
  {120} and {-111}), **dolomite** (rhomb {10-14}), **aragonite** (pseudo-hex trilling), **topaz**,
  **apatite**. The kernel is generic; each tenant is a face table + a calibration sweep at the
  live g-range (`feedback_render_upgrade_visible` — verify at the params the renderer passes).
- Edge chamfer (0.5–2% of extent) on every convex body; per-face vicinal hillock normal map at
  low amplitude (proposal §5 said "only if it reads" — at R1 lighting it will).
- **Acceptance:** `morph-fidelity-audit` mis-shaped count ≤ 10; a quartz hero shot shows six
  alternating termination faces of two sizes (rig can count the distinct face normals).

### R5 — A wall that is rock · **SHIPPED 2026-09-07**

**The census corrected F8.** The review read the parallel ridges as the ring tessellation and the
honeycomb as "a normal+AO map tiled by cell". Neither is what the pixels showed. The ridges are the
`basin` / `comb` / `cleft` relief families — seven sharp bedding risers per tile, six tiles up the
lat-long shell (`_wallReliefHeight`, `_wallReliefRepeat`) — and the dimples are the `scallops`
family's 4×4 Worley grid at 5×5 repeats. And the wall's colour was never the lithology's: every
authenticated surface paints its vertices with a fixed orientation palette (floor 0xA85820, wall
0xD2691E, ceiling 0xE8782C — js/23 `WallMesh` and js/23b `_surfaceColor`, the 2-D map's legibility
cue) multiplied over the skin, so a limestone geode, a basalt vesicle and a pegmatite pocket were all
chocolate-orange inside. The 16 × 120 mesh itself was fine, and `computeVertexNormals` stays.

**Mechanism (js/99a, js/99i; every surface buffer, digest and receipt untouched).**
- **Albedo is the lithology's.** `_topoWallRockTint` decodes the palette — its six candidates,
  including the 35 % water blend — into a ±8 % orientation shade (floor 0.92 / wall 1.0 / ceiling
  0.96) with the water tint kept, at both colour-write sites; the skin painter sets the colour.
- **Object-millimetre triplanar for the wall mesh too** (`WALL_ROCK_TRIPLANAR_ALL_SURFACES`): the
  lat-long uv path stretched skin and relief around the shell; the wall mesh's positions are object
  == world millimetres exactly like the marching-cubes surface. The material-space receipt reads
  `triplanar-object-millimetres` for both (`cavity-material-space.test.ts` re-pinned).
- **Nothing repeats in step with itself.** Skin, relief AO, relief normal and grain are sampled at
  two scales (1× and 0.37× / 0.61×, offset) and blended by a 40 mm / 13 mm noise
  (`wallTriplanarSampleAT`, `wallGrainSlope`); the genesis relief keeps its family and its paleo-flow
  tiling but at 0.5× strength, normal scale 2.0 → 1.2 and AO depth 0.6 → 0.35 — one octave of a rock,
  not the rock.
- **The rock under the relief — by spectral synthesis.** `_wallGrainNormalMap` is a 256² height
  field of ~190 random-phase sinusoids on integer wave-vectors |k| = 3..48 with amplitude |k|^-1.1
  (3 mm .. 0.2 mm at the 9 mm tile), exactly periodic, isotropic, plus a 25 % rounded-grain term;
  sampled as a normal octave scaled by the lithology's grain amount, darkening the albedo at its
  slopes and modulating roughness after `<roughnessmap_fragment>` (base per lithology: 0.70 phyllite
  … 0.92 sandstone; metalness 0). Two grains failed the eye first: a lattice value noise showed its
  rows as streaks, and Worley grain populations read as hammered pewter — the golf ball again,
  smaller. Rock has a 1/f spectrum with no characteristic cell.
- **Iron stain / clay film.** A 25 mm noise mask tinting toward iron oxide (0.86 / 0.56 / 0.34 as a
  multiplier) at the lithology's stain amount (BIF 0.85, sandstone 0.55, basalt 0.45 … marble
  0.06, `WALL_ROCK_PARAMS`) plus a genesis term (supergene +0.35 gossan, evaporite +0.10 clay),
  clamped 0.9. No Fe reaches the renderer from chemistry today; the table is the host-rock prior.
- **The instrument.** `--probe wallperiod`: the frame with the wall alone (crystals, water, stage
  hidden — a second CDP job, since two full frames in one result hung the specimen shot), its 256²
  radially averaged power spectrum, whitened — each ring against the geometric median of its ±10
  neighbours (own ±1 excluded), searched from k = 12 (1/12 of the frame) up — `peak_ratio` and the
  peak's period; `--wallperiod FILE…` measures saved frames offline; `--photo-stats` carries the
  same statistic (`period`) for the reference photographs, which set the band: **peak ratio
  1.19–1.48** on the nine whole-vug frames of §10.

**Measured (photo rig, seed 42, one build vs the R6 tip through the same probe).**
| frame (wall-only) | before: peak ratio @ period · wall edges · L | after |
|---|---|---|
| elmwood druse | **9.09** @ 100 px · 0 · 103 | **1.25** @ 16 px · 0.005 · 158 |
| elmwood specimen | 2.12 @ 300 px (whole frame, R6) | **1.34** @ 14 px · **0.056** · 58 |
| mvt specimen | **3.45** @ 35 px · 0.022 · 35 | see §3.7 |
| cooling specimen | **3.84** @ 33 px · 0.016 · 36 | see §3.7 |
| wittichen druse (comb) | **6.16** @ 100 px · 0.209 · 68 | see §3.7 |
| tn457 druse (basin) | 4.02 @ 100 px · 0.001 · 91 | see §3.7 |
| reference photographs (9, whole frame) | peak ratio 1.19–1.48 (median 1.39) | — |

**Acceptance, restated honestly.** *No periodic ridges (no dominant spatial frequency):* met — the
elmwood druse wall drops from 9.1 to 1.25 and the specimen wall reads 1.34, both inside the
photograph band; the fleet is in §3.7. *Wall edge fraction 0.02–0.06:* met on the specimen wall
(0.056); NOT met on the druse (macro) wall, 0.005 — at that magnification a bare rock wall has no
luminance edges to give; the photographs' walls have theirs from the drusy micro-crust, which is
R3's teeth. Pushing the grain until the macro frame reached 0.02 pushed the specimen wall past
0.06 and the look toward sandpaper; the reviewer's caution (a noisy render scores wonderfully)
decided it. *Eye:* the bowl is now a pale fine-grained dolomite interior with the crystals' shadows
on it — no honeycomb, no lathe rings, no orange — and each lithology keeps its own skin (§3.7).
Left for R3: the drusy micro-crust; for the science queue: Fe from chemistry into the stain.
Tests: `tests-js/wall-rock.test.ts` (9) + `cavity-material-space.test.ts` re-pinned.

### R6 — Photograph the specimen · **SHIPPED 2026-09-06** (D3 beside the orb, D5 studio mood)

**What the reference decided.** The whole-vug photo set (§10) is not sawn thunder eggs but
broken geodes: catalog 851 — the R6 presentation reference — is a Keokuk-type half on a cutting
mat with a ragged brown rind, a fracture face showing a pale lining band, rim crystals standing
proud of the break, and a soft contact shadow. So the specimen view models a BROKEN geode, not
the `halfcut` prototype's saw cut: the break wanders and goes *around* the rim crystals. A sawn
presentation with flat caps (thunder eggs) is the natural follow-up, not this rung.

**Mechanism (js/99i, the SPECIMEN VIEW section; ◐ beside ▦ in the camera row, ☼ = exposure).**
- **The cut.** A plane through the cavity origin whose normal is the camera's forward direction
  at entry, pulled 0.8 toward −y (the half lies on the cloth, opening upward and toward the
  viewer — 851 frame 1); a periodic 1-D value noise around the rim (6/12/24 lobes, ±0.12·r0)
  makes the edge wander. A world point is cut away when `dot(n, p) < amp·rag(θ)`. The SAME
  integer hash runs on the CPU and in GLSL over uint arithmetic (`Math.imul` + `>>> 0` is
  GLSL ES 3.00 unsigned multiplication mod 2³²), so the fracture band meets the discarded edge
  without a hairline; `tests-js/specimen-view.test.ts` pins the hash against a BigInt reference.
- **What the cut touches.** The wall discards per fragment (its relief-AO injection gains the
  test). Crystal BODIES are culled whole by their wall anchor — a crystal is never sawn, and the
  rim crystals project past the break as in every photograph. Instanced coating swaths discard
  per fragment and carry a depth material with the same test, so the removed half casts no
  ghost shadow on the cloth. Only meshes the view hid are ever re-shown.
- **The rind.** The cavity surface offset outward along 0.55·n + 0.45·p̂ by 0.13·r0·(1 ± 0.35
  lumps ± 0.14 warts): a weathered lithology skin (the matrix-skin texture darkened and
  iron-tinted, albedo ≈ 0.13), discarded by its SOURCE wall vertex — an attribute — so its edge
  is exactly the wall's; it casts the contact shadow through a depth material with the cut.
- **The fracture face.** Every wall triangle the rag crosses contributes one quad from its inner
  crossing segment to the same segment on the rind (identical lerp factors: exact at both edges,
  no loop chaining), three rows across, roughened along n, shared crossing points merged and
  wound consistently so the normals average across the band; vertex-coloured — a pale lining
  band (18 % of the depth: the wall colour lifted, albedo 0.32) then the fresh-break brown
  (0.55× the skin); planar UVs for its bump.
- **The stage.** A cloth plane at the kept half's lowest point (charcoal, roughness 1, a weave
  bump), a cyclorama, fog for the falloff; the studio mood on entry (D5); the key keeps riding
  the camera, so it lights the opening from the viewer's upper left; the shadow frustum widens to
  3·r0 for the cloth; the water sheet is off; the wall is opaque and two-sided in every wall
  mode (mode 2 hides wall and stage together) — the opaque backdrop R2's glass needs, so the
  transmission tier is ACTIVE here (16 glass materials in elmwood's receipt).
- **Exposure and the post pass.** ½-EV stops (☼; `2^EV` folded into the lighting rig's exposure
  rule, so the inside/outside rule keeps it); an HDR half-float target → ACES → 1.5 % grain
  after tone mapping → gentle vignette → sRGB, on desktop WebGL2 with float colour buffers and
  refused honestly otherwise (reason in the receipt). No depth of field: the reference
  photographs are stopped down or focus-stacked — every one is sharp through the interior — so
  DoF would be a lie about the subject.
- Everything is allocated on first entry (F13: the guided-tutorial receipt pins ids that shift
  with the render allocation count). ⊙ returns to the entry pose while the view is on.
  Render-only: no simulator consumer, no strip testimony.

**Measured (photo rig `--view specimen`, seed 42, the shipped pose; the reference is the nine
whole-vug frames of §10 through the same statistic).**

| frame | L / highlights / edges | note |
|---|---|---|
| elmwood specimen | 72.7 / 0 / **0.041** | in band |
| mvt specimen | 67.2 / 0.0003 / **0.032** | in band |
| tn457 specimen | 69.9 / 0 / 0.028 | just under: a laminated bowl with a dozen small barites |
| mvt hero galena, EV 0 → +1 | 99.8 / 0.0068 / 0.013 → 139.1 / **0.0204** / 0.013 | the metal criterion carried from R2 |
| mvt hero pyrite, EV 0 → +1 | 60.2 / 0.0027 / 0.013 → 91.3 / **0.0149** / 0.014 | |
| reference: nine whole-vug frames | 100–145 / median 0.0043 / median 0.085 (0.006–0.238) | catalog 851, 1256, 1257 ×2, 1258, 948, 1096, 1098, 1344 |

**Acceptance, restated honestly.** *Default-view edge fraction in the photograph band
(0.03–0.12):* elmwood and mvt yes; tn457 0.028 — its interior is a smooth laminated lining with a
dozen tiny barites, which is content (R3/R5), not framing: the pose (30° above, the half filling
⅔ of the frame) is a photographer's, not a search for the number. *Galena/pyrite highlight ≥
0.01 (carried from R2):* met in the specimen view at +1 EV (0.020 / 0.015; 0.0068 / 0.0027 at
0 EV) — the exposure control is part of the rung, and a stop up is what a photographer gives a
dark sulfide. *The boss eye-check on Pages of elmwood, tn457 and mvt:* pending merge. My own eye
against 851: the rind, the ragged break, the lining band, the contact shadow and the rim crystals
read; the bowl's interior is still the hammered honeycomb (R5) with sparse crystals (R3), which
are the rungs that follow — in the specimen frame the wall is now the largest thing on screen.
**Found on the way:** a surface that stays pale after its colour data is darkened is usually
overexposed, not mis-wired — the cloth (albedo 0.023) rendered at sRGB 55, i.e. irradiance ≈ 2
on the horizontal and ≈ 3 on a face turned to the key; a 0.30-albedo rock there is cream under
ACES. Read the grey card before blaming the data; the rock albedos were set from it. Rig:
`--view specimen`, `--ev`, the `specimen` shot, `--experiment specimenoff:<part>|fracflat`
ablations, `manifest.gl.specimen` and per-shot `camera.specimen` receipts; hero/druse cameras
stand on the open side of the cut. Tests: `tests-js/specimen-view.test.ts` (20).

### R7 — Aggregates with a history · 3–5 days · no decision
- Lognormal satellite sizes with a tail; sub-parallel groups; per-generation tint (older
  generations stained, younger clean); contact facets (O2) rendered matte with a darker rim;
  visibility floor made zoom-aware (a 0.3 mm crystal is 0.3 mm at macro zoom).
- Zoning made visible under glass: the O5c phantom shells and D1b chemistry variants read
  through transmission (R2) — amethyst tips, smoky cores, iron-stained bases.

Rung sum ≈ 17–27 working days; R1+R2+R3 alone (≈ 6–11 days) is my estimate of the 5/10 line;
R4–R6 carry it to 7.

---

## 6. What the rig must gate from now on

- Every render-layer commit runs `node tools/photo-rig.mjs --scenario elmwood --shots cavity,hero,druse`
  and `--scenario tn457_barite_pulses` and links the contact sheet in the commit message.
- The manifest's `census` and `stats` are the numbers the commit quotes (highlight/edge fractions
  before → after). A render change that moves nothing on the rig is a silent no-op
  (`feedback_render_upgrade_visible`).
- Reference statistics are re-measured with `--photo-stats` whenever the photograph set changes.

---

## 7. Decisions for the boss

- **D1 — Transmission.** The 2026-07-01 decision was "plain % translucency, no faked refraction".
  R2 proposes *real* refraction (screen-space transmission with measured IOR and Beer–Lambert
  attenuation). It is the single largest step toward "glass". Yes/no.
- **D2 — Lustre consumer.** Depth-B was deprioritised to "text only" on 2026-07-03. At a 7/10
  target the data must reach the pixels. Yes/no.
- **D3 — Presentation.** Ship a "specimen view" (cut geode, opaque wall, studio key, dark cloth)
  beside the process orb, or replace the orb. My recommendation: beside.
- **D4 — Instance budgets.** 1536 desktop / 384 mobile shipped today under the bug-fix mandate;
  R3 wants up to 4096 desktop for druse teeth. Any mobile-perf floor you want held?
- **D5 — The three-panel studio look.** Warm key / cool fill / rim is a photographer's default;
  the code comments asked for "moonlit cavity, not studio". R1 keeps the mood through exposure;
  say if you want the cave mood as the default instead.

---

## 8. Not done, and honest about it

- **Evidence chain, done twice.** Fork base: rebake byte-identical. Canonical SIM 285: the
  guided-tutorial receipt had to be regenerated first (`npm run gen:browser-receipt`) and four
  of its pinned constants re-pinned — two stream-position ids, the testimony dataset digest, and
  the box's Chrome version (F13) — then the rebake moved the corrected testimony only. Cold CI
  on the canonical transplant passed at `6a82949b` in GitHub Actions run `33953918483`.
- The laminated lining still tiles (R3); the druse camera is weak (F12). (The `halfcut` prototype
  is superseded by R6's specimen view, whose key rides the camera and faces the opening.)
- Amethyst geode and deccan chalcedony rinds are *booked* too thin to be fabrics — a science gap
  surfaced by the mass floor, not a render one; it belongs to the scenario-tuning queue.
- The 21 residual `spike` mis-shapes and the five cubic natives (F4) are left for R4.
- No specimen photograph of a *whole* vug interior was in the catalog set at review time; §10
  names the set that arrived, and R6 was built against catalog 851 from it.

---

## 10. Decisions taken (2026-09-05, reviewer verdict relayed by the boss)

The review was approved as "the right programme"; the original branch tip was **not** merged
because it was cut from a fork main 103 canonical commits behind, so its rebake authenticated
an old formation. The work was transplanted onto canonical `a9d32a53` (SIM 285) as
`review/visual-realism-canonical`, rebaked there, and put through cold CI (see the commit
that carries this section).

| # | decision | answer |
|---|---|---|
| D1 | transmission | **YES** — real Three.js transmission with measured mineral IOR and Beer–Lambert body colour; the old alpha path stays only as the low-performance fallback. This does not violate the 2026-07-01 ruling, which was against *fake-looking* refraction. |
| D2 | lustre consumer | **YES, emphatically** — metallic, adamantine, vitreous, pearly, resinous, silky and dull must visibly behave differently; load-bearing, not decorative. |
| D3 | presentation | **BESIDE** — the orb stays as the geological/process view; a cut-open, opaque-walled, photographically lit *specimen view* is added. Neither replaces the other. |
| D4 | instance budget | **4096 desktop as a ceiling, not a quota** — adaptive density, distance/zoom culling, a measured frame-time gate; mobile stays at 384 for now. |
| D5 | lighting | **cave mood by default in process view; restrained studio in specimen view.** Warm key / cool fill / rim physically present without the jewellery-advert look; moonlit darkness and readable specular highlights are compatible. |
| 6 | rung order | **R1 → R2 → R6 → R5 → R3 → R4 → R7.** Lighting and mineral materials give the largest immediate gain; specimen presentation lets you see it; the wooden-bowl wall is then the next illusion-breaker; the coating bugs are contained enough that their deeper rewrite need not delay the first convincing specimen image. |
| 7 | integration | **transplant onto current canonical before integration; rebake there; run cold CI; never merge the stale tip.** |

**Reviewer's caution, adopted as method:** highlight fraction and edge fraction are regression
guardrails, not a realism measure — a noisy, over-sharpened render would score wonderfully.
The terminal test is the eye against a **fixed set of whole-vug photographs**. That set now
exists in the catalog snapshot (all boss-owned): 1257 and 1258 (Keokuk-type citrine geodes,
17 + 12 frames — quartz druse sparkle, goethite-after-pyrite, hollow interior in focus),
1256 (druzy quartz vug, 9 frames), 851 (a whole cut geode: brown rind, white druse, orange
calcite — the R6 presentation reference), 946–950 (cut thunder-egg halves: agate lining and
quartz-filled centre), 1096 (septarian), 1098 (calcite geode), 1342–1345 (Guanajuato druzy
amethyst on chalcedony/calcite). Every rung's eye-check compares its specimen-view frame
against these before its numbers are read. Measured through the rig's statistic (nine
frames from that set): highlight fraction median 0.004 (0.0005–0.023), edge fraction median
0.085 (0.006–0.238), mean luminance 100–145 — the same band as the hand-specimen photographs
in §3.2, so the guardrail thresholds stand; the eye does the rest.

**Transplant check (SIM 285, `elmwood-s42-canon`, `tn457_barite_pulses-s42-canon`):** the
fixes hold on canonical — sphalerite renders as tetrahedra, no coating swath exceeds the mass
floor in either scenario, no runtime exceptions; the rig's process cleanup now uses canonical's
receipt-authenticated browser-descendant API. 28 render/morphology test files / 319 tests
green on the canonical base.

## 9. Reproduce

```
node tools/photo-rig.mjs --list
node tools/photo-rig.mjs --scenario elmwood --seed 42 --shots cavity,hero,druse --hero-n 2
node tools/photo-rig.mjs --scenario elmwood --experiment envlight,glass,halfcut --label demo
node tools/photo-rig.mjs --scenario elmwood --view specimen --shots specimen,hero --hero-n 2        # R6
node tools/photo-rig.mjs --scenario mvt --view specimen --shots hero --mineral galena --hero-n 1 --ev 1
node tools/photo-rig.mjs --scenario elmwood --shots druse,specimen --probe wallperiod                  # R5
node tools/photo-rig.mjs --wallperiod .local-evidence/photos/elmwood-s42-r2/druse.png                 # offline
node tools/photo-rig.mjs --photo-stats "<catalog>/photos/1061/front.jpg" ...
node tools/morph-fidelity-audit.mjs
npx vitest run tests-js/lighting-rig.test.ts tests-js/optics-r2-materials.test.ts tests-js/specimen-view.test.ts tests-js/wall-rock.test.ts tests-js/cavity-material-space.test.ts tests-js/wall-relief.test.ts tests-js/surface-growth.test.ts tests-js/surface-growth-three-integration.test.ts tests-js/sphalerite-tetrahedron.test.ts tests-js/habit-bias.test.ts tests-js/pyrite-morphology.test.ts tests-js/fluorite-morphology.test.ts tests-js/cluster-spec.test.ts tests-js/manganese-surface-family.test.ts tests-js/mineral-optics.test.ts tests-js/twin-cluster-patterns.test.ts tests-js/fan-cluster-pattern.test.ts tests-js/dendrite-tree-render.test.ts tests-js/d1-body-colour.test.ts tests-js/facestep.test.ts tests-js/hopper-texture.test.ts tests-js/cleft-halfform.test.ts tests-js/mesh.test.ts tests-js/cavity-render.test.ts tests-js/matrix-skin.test.ts tests-js/etch-overprint.test.ts tests-js/o5-band-render.test.ts tests-js/o5-split.test.ts tests-js/aragonite-contact-twin-three.test.ts tests-js/galena-spinel-twin-three.test.ts tests-js/fluorite-twin-three.test.ts tests-js/o2-render-wiring.test.ts tests-js/o4-engulfment.test.ts tests-js/local-color.test.ts
```

Evidence index (all under `.local-evidence/photos/`): `<scenario>-s42/` = shipped renderer before
this commit (28 scenarios); `-hidden` = wall hidden; `-fixed` = first cut of F1 (balloons);
`-fixed2` = this commit; `-envlight`, `-envlight+glass`, `-envlight+glass+swathoff`,
`-envlight+glass+halfcut`, `-fixed2-envlight+glass`, `-fixed2-envlight+glass+halfcut` =
prototypes; `photo-refs/photo-stats.json` = the twelve reference photographs' statistics.
