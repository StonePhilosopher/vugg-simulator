# RESEARCH: Naturalistic Crystals — homework synthesis

**Author:** Claude (Opus 4.7, 1M context), 2026-05-22
**Origin:** Boss request to "make crystals more naturalistic" in four loose phases:
  1. Crystal shape variable on all minerals (with multi-variant where conditions diverge)
  2. Improve the models of the crystals themselves
  3. Orientation variation, twinning, and clustering — grounded in science
  4. Naturalistic epimorphs
  (Skeletal etching = graphic texture, not geometry)

**Status:** Homework / research synthesis. Drafted as no-code; 2026-05-22 session subsequently shipped §7 items 1–5 (commits `f125c13` / `3bd4472` / `a7dc360` / `b573915` / `57a9108`) plus a handoff doc (`e905eaa`). See `proposals/HANDOFF-CRYSTAL-NATURALISM-ARC.md` for what's done, what's queued, and how to pick up. Companion proposal `PROPOSAL-CRYSTAL-HABIT.md` (the Rockbot draft) is reframed here against the actual codebase state.

**Reading order:** §1 (gap summary, two pages) → §3 (positioning physics) → §4 (cluster taxonomy) → §5 (per-mineral table) → §7 (proposed phasing). §2 documents what already exists and is the longest section; skim unless you're picking up implementation.

---

## 1. The actual gap (executive summary)

The Rockbot proposal framed this as a foundation-build: "the simulator models real geochemistry but the visual output is crystallographically agnostic." That framing undercounts heavily. The codebase already has:

- **170 minerals** in `data/minerals.json` (not 145), **all of them with `habit` and `habit_variants[]` populated** — Phase 1 in the boss's framing is structurally done; what's left is variant *richness* on the thin entries.
- **13 wireframe primitives** in `99c-renderer-primitives.ts` covering cube, octahedron, tetrahedron, rhombohedron, scalenohedron, hex-prism, hex-prism-terminated, dipyramid, pyritohedron, tabular, acicular, dripstone, botryoidal. Plus ~140 habit-string→primitive mappings in `HABIT_TO_PRIMITIVE` with a fuzzy-substring fallback. Phase 2 is refinement, not rebuild.
- **Substrate-perpendicular orientation with Gaussian σ=12° scatter**, σ=3° lock for epitaxial overgrowths (`enclosed_by` set), gravity-aligned air-mode rendering (stalactites + stalagmites), all in `99d-renderer-wireframe.ts` and the Three.js parity layer `99i`.
- **An entire paragenesis campaign Q1–Q5 fully shipped and visually verified** per `HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md` (2026-05-06): substrate-affinity table (`SUBSTRATE_NUCLEATION_DISCOUNT`), pseudomorph routes (`PSEUDOMORPH_ROUTES`), CDR outline inheritance (Q3a), perimorph hollow casts (Q4 — translucent double-sided meshes), snowball-as-sphere (Q5).
- **Substrate-aware nucleation hooks** in `85b-simulator-nucleate.ts`: `_assignWallCell`, `_assignWallRing`, `_pickSubstrate`, `_sigmaDiscountForPosition`, `_rollSpontaneousTwin`, plus `ORIENTATION_PREFERENCE` (13 minerals: floor/ceiling/wall bias) and `WATER_STATE_PREFERENCE` (6 evaporites: meniscus bias).
- **Druzy cluster mode** in `99d` via `_druzyClusterCount` (16 children for `druz`, 22 for `earthy`, 18 for `granular`, etc.) — and **dripstone mode** for air-cavity ceiling/floor crystals (5 slices shipped in `PROPOSAL-HABIT-BIAS.md`, 2026-05-11).
- **CDR pseudomorph schema**: `Crystal.cdr_replaces_crystal_id` and `Crystal.perimorph_eligible` fields, set at nucleation by `findPseudomorphRoute` and read by both wireframe and Three.js renderers.

So the four-phase frame collapses to a smaller research arc:

| Boss phase | Actual gap |
|------------|------------|
| Phase 1 — shape variable on all minerals | **Done in data.** 170/170 covered. Variant *richness* could improve on the 15 minerals with ≤2 variants. |
| Phase 2 — improve crystal models | **Partial.** 13 primitives cover most cases; 5–7 refinements + 4–6 new primitives would close known gaps. Skeletal/hopper-as-texture is the right call (not geometry). |
| Phase 3 — orientation, twinning, clustering | **Partial.** Positioning physics is mostly in place. **Twin coverage is the biggest concrete gap: 109/170 minerals lack `twin_laws`.** Cluster modes beyond druzy + dripstone don't exist (spherulitic, radiating, parallel-stack, dendritic, reticulated, orbicular). |
| Phase 4 — naturalistic epimorphs | **Mostly shipped.** Q3a outline inheritance + Q4 perimorph hollow cast both verified end-to-end in `bisbee` seed 42. What's left: more `PSEUDOMORPH_ROUTES` entries, Q3b encrustation shell (optional), and surface-texture polish (boxwork overlay on perimorphs). |

**The largest single research task is twin-law coverage** — 109 minerals × roughly 30 minutes of Mindat/Frondel/Dana research each = ~50 hours. Grouped by class for batchability: silicate 25, sulfide 22, phosphate 13, arsenate 12, sulfate 9, carbonate 5, native 5, amphibole 5, oxide 4, molybdate 4, hydroxide 2, borate 2, halide 1. The amphibole group can probably be done as one entry (they all twin on similar laws).

**The largest single design task is cluster modes** — designing spherulitic, radiating, parallel-stack, dendritic, reticulated, orbicular as additions to the existing druzy/dripstone dispatch, each grounded in real growth physics (Sunagawa 2005, Wertheim et al. 2021 for spherulites, Hayba et al. 1985 for vein textures). ~1 week of design + per-mode implementation if shipped one-mode-per-version.

---

## 2. What's already shipped (the inventory)

### 2.1 Habit / variant infrastructure

**`MINERAL_SPEC[mineral].habit`** — primary default habit string. 170/170 minerals.

**`MINERAL_SPEC[mineral].habit_variants[]`** — array of `{ name, wall_spread, void_reach, vector, trigger }` entries:
- `wall_spread` ∈ [0,1] — lateral coverage on the wall (0 = pinpoint, 1 = drusy carpet)
- `void_reach` ∈ [0,1] — projection into vug interior (0 = thin coating, 1 = long needle)
- `vector` ∈ {projecting, coating, tabular, equant, dendritic}
- `trigger` — condition string evaluated by `selectHabitVariant`. Vocabulary in active use:
  - σ thresholds: `low σ`, `low-moderate σ`, `moderate σ`, `moderate-high σ`, `high σ`, `very high σ`
  - T thresholds: `low T` (<150°C), `moderate T` (150–300°C), `high T` (>300°C)
  - Fill: `high fill` / `drusy` (vugFill > 0.75), `low fill` (<0.7), `post-seal` (>0.95)
  - Space: scored against `spaceConstrained` flag
  - `default` — fallback bonus
- Selection: weighted-random by score² (in `js/07-habit-variant.ts`). The DSL is keyword-substring; new triggers register simply by adding a `trig.includes('…')` branch.

Variant counts per mineral (the richness distribution):

| variants | minerals |
|----------|----------|
| 1        | 5 (raspite, tincalconite, meta-autunite, metatorbernite, metazeunerite — paramorph products, inherit shape) |
| 2        | 10 |
| 3        | 52 |
| 4        | 76 |
| 5        | 22 |
| 6        | 5 |

Median is 4. The thin entries (2 variants) are candidates for enrichment but aren't an emergency — the variant system *exists*, it just doesn't have many alternatives for those minerals. Likely many of those minerals genuinely have one dominant habit and a single variant is fine (e.g. cubic-only sulfosalts).

**Twin laws**: `MINERAL_SPEC[mineral].twin_laws[]` — array of `{ name, miller_indices, trigger, probability }`. 61/170 minerals have entries. `_rollSpontaneousTwin` in `85b` rolls once per nucleation per declared law; triggers containing `thermal_shock` or `tectonic` skip the spontaneous roll (those fire from event handlers).

**Late-stage propensity**: `MINERAL_SPEC[mineral].late_stage_propensity` ∈ [0,1] continuous gradient (Proposal C, 2026-05). Literature-anchored per `RESEARCH-GROWTH-AT-HIGH-FILL.md` §11–12.

### 2.2 Wireframe primitives

In `js/99c-renderer-primitives.ts`. Each primitive declares `vertices` (3-tuples in unit-cube coordinates) and `edges` (vertex-index pairs). Renderer projects through `_topoProject3D` and draws as silhouette fill + edge strokes.

The 13 primitives:

| Primitive | Geometry | Real species use |
|-----------|----------|------------------|
| PRIM_CUBE | 8 verts, 12 edges | galena, fluorite, halite, pyrite (cubic), native_copper hopper |
| PRIM_OCTAHEDRON | 6 verts, 12 edges | spinel, magnetite, fluorite (high-σ variant), gold |
| PRIM_TETRAHEDRON | 4 verts, 6 edges | sphalerite (when {111} dominant), helvite |
| PRIM_RHOMBOHEDRON | 8 verts, 12 edges (top rotated 60° from base) | calcite, dolomite, siderite, magnesite |
| PRIM_SCALENOHEDRON | 8 verts, 12 edges (dogtooth zigzag waist) | calcite "dog-tooth spar", T>200°C scenarios |
| PRIM_HEX_PRISM | 12 verts, 18 edges (no termination) | apatite, beryl barrel, short prismatic forms |
| PRIM_HEX_PRISM_TERMINATED | 13 verts, 24 edges (6-fold pyramidal cap) | quartz, tourmaline, beryl, apatite normal |
| PRIM_DIPYRAMID | 8 verts, 18 edges (hex equator + two apices) | scheelite, anhydrite, cyclic twins |
| PRIM_PYRITOHEDRON | 14 verts, 30 edges (8 cube corners + 6 face-axis "stretch") | pyrite pyritohedral form |
| PRIM_TABULAR | 8 verts (flat plate) | barite, wulfenite, selenite, micas |
| PRIM_ACICULAR | 7 verts (slim hex needle + apex) | stibnite, mesolite, natrolite, gypsum sword |
| PRIM_DRIPSTONE | 25 verts, 4 rings × 6 longitudes + apex (tapered icicle) | air-mode ceiling/floor variants of compatible canonicals (Hill & Forti 1997) |
| PRIM_BOTRYOIDAL | 26 verts, hemisphere of fiber tips (Wertheim et al. 2021 spherulite mechanism) | chrysocolla, malachite, hematite kidney ore, framboidal pyrite |

The `HABIT_TO_PRIMITIVE` dispatch table is unexpectedly thorough — ~140 entries mapping every habit string seen in `data/minerals.json` to a primitive, with documented intent (e.g. `'flos_ferri': PRIM_ACICULAR  // aragonite "iron flowers"`). The fuzzy-substring fallback in `_canonicalPrimitive` (in `99d`) catches anything not in the explicit map.

### 2.3 Habit textures (edge-painting layer)

Independent of the primitive dispatch, `js/99a-renderer-textures.ts` paints per-cell edge textures on the topo 2D view. Six texture functions:

| Texture | Habit triggers | Mechanism |
|---------|----------------|-----------|
| `dogtooth` | scalenohedral (T>200°C calcite) | sharp tall sawtooth, amplitude 1.5× thickness |
| `rhomb` | rhombohedral (T<200°C, MVT calcite) | shorter wider sawtooth, amplitude 0.7× |
| `cube_edge` | cubic, pyritohedral, cubo-pyritohedral, pseudo_cubic | sawtooth capped at 90° peaks (max ratio 0.5) |
| `cube_edge_deep` | galena, fluorite cubic | taller V's, max ratio 1.0 — stepped cubic cleavage |
| `botryoidal` | botryoidal, spherulitic, framboidal, reniform_globules, botryoidal_crust | smooth half-circle bumps |
| `saddle_rhomb` | dolomite default | curved-face bowed sawtooth — Kim 2023 sabkha dolomite signature |
| `acicular` (placeholder) | acicular, needle, radiating, spray, cockscomb, plumose | currently aliases to dogtooth pending dedicated function |

There's also `bulge_factor` on saddle_rhomb (0.4 default = textbook saddle) that's only used by that texture. **`acicular` is a known placeholder** — flagged in source for a denser, spikier dedicated function.

### 2.4 Orientation + clustering

**Universal layer** in `99d-renderer-wireframe.ts` (`_renderWireframeInstance`):
- c-axis defaults to substrate-perpendicular (inward sphere normal at anchor cell)
- Gaussian scatter σ=12° around that normal, σ=3° if `crystal.enclosed_by != null` (epitaxial lock)
- Citation in source: "Mathematical Geosciences 1989; mature druse σ ≈ 10–15° around substrate normal, capped at ±30° before extinction" (this is the **competitive growth fabric** — off-axis crystals get crowded out)
- Deterministic Box-Muller seeded by `crystal_id` so reloads stay reproducible
- Per-crystal rotation around c-axis: seeded uniform on [0, 2π]

**Air-mode override** (`growth_environment === 'air'`):
- Ceiling cells (z < -0.4 in the Z-up wireframe convention): c-axis = world-down
- Floor cells (z > +0.4): c-axis = world-up
- Wall cells (|z| ≤ 0.4): fall through to substrate-perpendicular
- All five slices of `PROPOSAL-HABIT-BIAS.md` landed 2026-05-11 — Three.js parity, cluster-satellite propagation, PRIM_DRIPSTONE port, `stalactite_demo` scenario.

**Per-mineral orientation preference** (`js/78-preferences.ts`, `ORIENTATION_PREFERENCE`):

| Mineral | Bias | Strength | Source |
|---------|------|----------|--------|
| selenite | floor | 3.0 | Naica subaqueous pool growth |
| galena, malachite, azurite, barite, celestine, goethite, native_gold, native_silver, smithsonite | floor | 1.5 | density / micro-cluster settling, supergene fluid pooling |
| hematite | ceiling | 1.5 | iron-rose specular rosettes from convective Fe transport |
| stibnite, bismuthinite | wall | 1.5 | acicular sprays grow perpendicular to lateral substrate |

**Water-state preference** (`WATER_STATE_PREFERENCE`):

| Mineral | Bias | Strength |
|---------|------|----------|
| halite | meniscus | 4.0 |
| borax | meniscus | 3.0 |
| mirabilite, thenardite | meniscus | 3.0 |
| selenite | meniscus | 2.5 |
| anhydrite | meniscus | 2.0 |

**Cluster-satellite layer** in `99d`'s `_druzyClusterCount`:

| Habit substring | Child count | Geometry meaning |
|-----------------|-------------|------------------|
| `druz` | 16 | drusy quartz/calcite carpets |
| `crust` | 12 | sublimation/efflorescent crusts |
| `granular` | 18 | massive granular aggregates |
| `earthy` | 22 | earthy crust (loose powder, max children) |
| `arborescent`, `dendritic` | 20 | tree-like branching |
| `massive` | 14 | undifferentiated mass |
| `sugar`, `coating` | 14 | sugary thin films |
| (size < 0.4mm) | 4 | sparse mini-cluster so dust doesn't render as one pixel |

Children scatter in the tangent plane around parent anchor with `sqrt-radius` weighted uniform-area density, cluster radius capped at 9 × mmToPx, child sizes uniform on [0.3, 0.7] of parent, fill alpha × 0.55 so overlap reads as sparkly carpet.

### 2.5 Paragenesis layer (Q1–Q5, shipped + visually verified)

In `js/26-mineral-paragenesis.ts`:

**`SUBSTRATE_NUCLEATION_DISCOUNT`** — ~30 host minerals, each with a sub-map of `{ nucleating_mineral: discount_factor }`. Two tiers per boss directive 2026-05-06:
- 0.5× — low-misfit lattice match or strong CDR (sphalerite-on-pyrite at ~0.2% misfit per Ramdohr 1980; azurite→malachite as Putnis canonical CDR)
- 0.7× — moderate misfit / facet-selective heterogeneous nucleation (calcite-on-fluorite Cave-in-Rock stack; MVT pairs)

Wired into nucleation via `_sigmaDiscountForPosition` — engine's position-string is parsed for `on <mineral> #<id>`, host is looked up, σ-threshold is multiplied by the discount.

**`EPITAXY_PAIRS`** — 6 documented strict-epitaxy pairs (sphalerite↔pyrite, marcasite↔pyrite, sphalerite↔marcasite, pyrite↔marcasite, sphalerite↔marcasite). Scaffolded but currently unused — boss directive 2026-05-06 left orientation-independent for v1.

**`PSEUDOMORPH_ROUTES`** — 18 documented Putnis CDR routes (pyrite→goethite, marcasite→goethite, sphalerite→smithsonite, galena→cerussite, galena→anglesite, cobaltite→erythrite, nickeline→annabergite, arsenopyrite→scorodite, azurite→malachite, azurite→chrysocolla, malachite→chrysocolla, cuprite→malachite, cuprite→chrysocolla, native_copper→cuprite, native_silver→acanthite, plus several Fe-OOH polymorph variants). Every entry is `shape_preserved: true`.

**Visual verification**: confirmed in `HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md` (2026-05-06) on seed 42:
- mvt: 9 snowball-habit barites on pyrite #6 + sphalerite #29 substrates
- bisbee: 3 CDR pseudomorphs (chrysocolla×2 after cuprite, lepidocrocite after pyrite), with 2 of them perimorph-cast translucent meshes
- supergene_oxidation: 1 CDR (smithsonite after sphalerite, outline inherited — 22× vertex-count drop from default botryoidal)

### 2.6 Transitions layer (paramorph + dehydration + light)

In `js/75-transitions.ts`:

- **`PARAMORPH_TRANSITIONS`** — argentite (cubic) → acanthite (monoclinic) at 173°C. Only entry. The Crystal preserves `habit + dominant_forms + zones` (external shape + growth history), inverts mineral identity. Library + narrator flag the "acanthite-after-argentite" cubic-monoclinic curiosity.
- **`DEHYDRATION_TRANSITIONS`** — 6 entries (borax→tincalconite, mirabilite→thenardite, autunite→meta-autunite, torbernite→metatorbernite, zeunerite→metazeunerite, pharmacolite→haidingerite). Triggered by vadose-ring exposure (threshold steps) OR by T exceeding T_max (instantaneous, 80% probability).
- **`LIGHT_TRANSITIONS`** — realgar→pararealgar at 60 light-exposure steps (Bonazzi et al. 1996). Gated by `conditions.wall.is_lit`.

All three preserve `paramorph_origin` for library/narrator. None modify habit (correct — paramorph by definition preserves external shape).

### 2.7 Snowball habit (Q5)

`habit: 'snowball'` is a real habit string in `data/minerals.json` for barite (and extensible to other minerals). Renders as `THREE.SphereGeometry` in the 3D renderer, not as a faceted primitive. Verified: mvt seed 42 produces 9 snowball barites with 221-vertex spheres around pyrite/sphalerite seeds. Per boss directive 2026-05-06, the sphere primitive is an approximation of the radiating-blade aggregate — v2 polish would be a true radial spray of N blade primitives.

---

## 3. Universal positioning physics (Phase 3 foundation)

This section documents what nature uses to decide where and how a crystal nucleates and grows, and which factors already have code in the sim versus which are gaps.

### 3.1 Substrate-asperity nucleation

**Science:** Heterogeneous nucleation on a substrate has a much lower interfacial-energy barrier than homogeneous nucleation in bulk fluid. Within a substrate, **asperities and roughness features (both concave nooks and convex corners) further reduce the barrier**. Concave features wet preferentially (capillary effect); convex corners offer multi-face contact area that locks the early embryo geometrically. Reference: Sunagawa 2005 §3.4 (heterogeneous nucleation), Mullin 2001 *Crystallization* 4th ed. §5.

**In the sim:** Currently nucleation picks wall cells by area-weighted ring + uniform-random cell. There's no substrate-roughness modifier — the wall is geometrically smooth (sphere-tessellation cells) so roughness preference would need a model that *introduces* surface heterogeneity rather than just reads it. Could be added as a "rugosity field" per cell, sampled from blue noise or set by host-rock type.

**Status:** Not in the sim. Low priority — area-weighting + ring orientation preference already produces visually plausible distribution. Add only if a specific scenario calls for it (e.g. roughened acid-etched cavity wall).

### 3.2 Epitaxy

**Science:** Lattice-matched substrates impose orientation on the nucleating crystal. Misfit < ~5% gives coherent epitaxy with strong orientation locking; 5–15% is semi-coherent with weaker locking; >15% is effectively heterogeneous nucleation with no orientation memory. Documented MVT/sulfide pairs from Ramdohr 1980 *The Ore Minerals and Their Intergrowths*:

| Pair | Misfit | Type |
|------|--------|------|
| Sphalerite (ZnS, a=5.41 Å) on pyrite (FeS₂, a=5.42 Å) | ~0.2% | Strong coherent |
| Galena (PbS, a=5.94 Å) on pyrite | ~9% | Semi-coherent |
| Marcasite on pyrite | shared S–S geometry | Structural twin |
| Galena ↔ sphalerite | ~10% | Semi-coherent |

**In the sim:** `SUBSTRATE_NUCLEATION_DISCOUNT` covers the energetics (σ-threshold reduction). `EPITAXY_PAIRS` scaffolds the orientation side (which pairs should orient to host facets) but is currently *unused* — boss directive 2026-05-06 left orientation-independent for v1. The `enclosed_by` field already locks σ=3° scatter for any overgrowth crystal, which is the universal "this is on a host" handler.

**Status:** Energetics done. Orientation alignment to specific host facets is the gap — would need wireframe primitives that read the host crystal's orientation and align the child's c-axis or specific face to it. Probably v2 polish after more visible wins.

### 3.3 Cleavage-aligned growth on host

**Science:** Crystals growing on a cleaved substrate (mica plates, gypsum cleavage, marble bedding) align their growth axis to the cleavage direction. Distinct from epitaxy (which requires lattice match) — this is geometric alignment to a planar surface. Examples: wulfenite tabular {001} on calcite cleavage; barite blades parallel to marl bedding; muscovite stacks on biotite.

**In the sim:** No cleavage-orientation handling. The wall is treated as a smooth sphere; there's no "cleavage direction" field on cells.

**Status:** Not in the sim. Lower priority — would need a host-rock cleavage descriptor that propagates to wall cells, then a per-mineral "follow cleavage" flag. Only matters for a handful of minerals (gypsum, mica-group, barite).

### 3.4 Fluid flow tilt

**Science:** During growth (not nucleation), flow brings fresh nutrients preferentially to the up-flow face of a crystal — that face grows faster, the crystal tilts slightly upstream. Inclusion trails in growth zones can record paleo-flow direction. Reference: Sunagawa 2005 §5.6 (impurity and convection effects).

**In the sim:** No fluid flow direction field. Diffusion is treated isotropically (inter-ring diffusion rate, but not directional).

**Status:** Not in the sim. Probably permanently out of scope — the sim's wall-tessellation cavity model doesn't have a coherent flow geometry. Could be faked at render time as a small global tilt vector but feels like polish.

### 3.5 Gravity

**Science:** Gravity matters during early growth in still fluid (settling) and in air-filled cavities (dripstones). In submerged cavities with vigorous convection, gravity is negligible at crystal scale — buoyancy and drag dominate.

**In the sim:** Implemented as the air-mode dripstone system (5 shipped slices of habit-bias, 2026-05-11). Ceiling cells get c-axis world-down; floor cells get c-axis world-up; wall cells fall through to substrate-normal. `growth_environment` field is set at nucleation based on ring water state (vadose or `wall.air_mode_default: true`).

**Status:** Done. Edge cases worth knowing about: gravity-settling of dense crystals to vug floor during early fluid-mode growth isn't modeled (the `ORIENTATION_PREFERENCE['floor', 1.5]` for galena/native_gold/etc. approximates the outcome without modeling the mechanism).

### 3.6 Free-space competition (competitive growth fabric)

**Science:** Crystals nucleate at random orientations on a substrate. As they grow, those whose fast-growth axis is roughly perpendicular to the substrate extend furthest; those tilted off-axis hit neighbors and stop growing within microns. The result: a "comb" or "palisade" fabric where surviving crystals are within ~10–15° of the substrate normal even though nucleation had no orientation preference. Hayba, Bethke, Heald & Foley 1985 (USGS Bull. 1646) is the canonical reference for epithermal vein textures.

**In the sim:** The Gaussian σ=12° scatter in `_renderWireframeInstance` is exactly this — the surviving distribution after competitive selection, not the initial nucleation distribution. The source cites "Mathematical Geosciences 1989" for the 10–15° figure. The mechanism (extinction of off-axis crystals during growth) isn't modeled explicitly; the outcome distribution is rendered directly.

**Status:** Outcome done. Modeling the mechanism (per-step extinction check against neighbors) would add geological honesty but probably no visible improvement, since the current rendered distribution is already correct.

### 3.7 Crystal–crystal truncation

**Science:** When two crystals grow into each other, the faces in contact get truncated. The crystal that started later or grew slower gets the larger truncation. Real specimens show this everywhere — every druzy carpet has thousands of mutual-truncation faces.

**In the sim:** The sim tracks `enclosed_crystals` and `enclosed_by` (one crystal swallowing another) but doesn't render face truncation at neighbor contact. The wireframe renderer shows each crystal as its own complete primitive, with overlaps appearing as overlap rather than mutual clipping.

**Status:** Not in the sim. Low-medium priority. Would require neighbor-aware per-vertex clipping in the renderer — moderately involved but visually impactful. Easier first pass: in the cavity-clip shader, also clip against neighbor sphere bounds (every crystal as an ellipsoid, fragments inside another crystal's volume get discarded).

### Summary of Phase 3 positioning state

| Factor | Status | Priority for naturalism |
|--------|--------|--------------------------|
| Substrate asperity | Not in sim | Low |
| Epitaxy energetics | Done (Q1c) | — |
| Epitaxy orientation | Scaffolded, unused | Low (visual polish) |
| Cleavage alignment | Not in sim | Low (few minerals affected) |
| Fluid flow tilt | Not in sim | Very low (out of model scope) |
| Gravity (air-mode) | Done (habit-bias 1–5) | — |
| Competitive growth fabric | Outcome modeled | — |
| Crystal–crystal truncation | Not rendered | **Medium-high** (visible everywhere) |

The single highest-leverage positioning addition is **neighbor-aware face truncation**. Every other positioning factor is either done, very low priority, or applies to a handful of minerals only.

---

## 4. Cluster mode taxonomy (Phase 3 design)

The sim has two cluster modes: **druzy** (many parallel children spread across a tangent disc, in `_druzyClusterCount`) and **dripstone** (single tapered icicle, gravity-aligned). Every other clustering pattern in nature currently renders as either a single primitive or a druzy carpet — losing the diagnostic morphology.

Below is the proposed taxonomy with science grounding for each mode and a sketch of how it would attach to the existing renderer dispatch.

### 4.1 Loner

**Pattern:** Single isolated crystal, no clustering. The default for most minerals when none of the other modes apply.

**Science:** Low nucleation density, fast extension along a dominant growth axis. Galena cubes, garnet dodecahedra, gem-quality tourmaline are loners by virtue of slow nucleation kinetics + space to extend.

**Implementation:** Already the default behavior (`_druzyClusterCount` returns 0 → single primitive). No work needed.

### 4.2 Druzy / palisade

**Pattern:** Dense parallel-oriented children covering a substrate. The competitive-growth-fabric outcome rendered directly. **Spans a wide size spectrum**, from microcrystalline sugar coatings (individual crystals invisible at hand-specimen scale) to macrocrystalline *comb quartz* (each crystal a recognizable hex prism + pyramidal point, mm-scale, growing in distinct ranks). Same mechanism, different parameter regime.

**Science:** Triggered by sudden σ pulse (high nucleation rate → many seeds), then competitive selection prunes off-axis ones. The σ=12° Gaussian scatter is the residual distribution after pruning. Hayba et al. 1985 is canonical. Real druzy:
- **Microcrystalline end** — drusy quartz dust on agate vug interiors, chalcedony coatings, "sugary" sphalerite/calcite linings. Individual crystals 0.1–0.5 mm; reads as glittery surface texture.
- **Macrocrystalline end** — comb quartz in veins (the "vein-quartz comb" of epithermal Au/Ag districts), drusy calcite lining MVT vugs, vein-comb fluorite. Individual crystals 1–10 mm, each is its own recognizable euhedral primitive; reads as a forest of upright points.
- **Banded multi-stage** — when the cavity sees multiple σ pulses separated by sediment/chalcedony layers, comb druzy stacks into ranks. Each rank is its own palisade following the substrate at the time it grew (Hill & Forti for cave settings; Hayba et al. for vein settings).

**Substrate-following property:** Adjacent crystals each orient to the *local* substrate normal, so a curved or folded wall produces ranks of crystals that fan with the wall topology — the wavy comb-ridge pattern visible in field specimens. The existing per-anchor substrate-normal computation already implements this; what it needs is sub-mode tuning to keep individual crystals at recognizable size rather than collapsing to micro-cluster sparkle.

**Implementation:** PARTIAL. `_druzyClusterCount` exists and returns N children for habit strings containing `druz`, `crust`, `granular`, `earthy`, `arborescent`, `massive`, `sugar`, `coating`, or for very small crystals (<0.4mm). **It's currently tuned for the microcrystalline end only** — children scale 0.3–0.7× of parent with fill alpha × 0.55, producing the sparkly-carpet aesthetic. Macrocrystalline comb druzy needs a different parameterization in the same dispatch path:

| Parameter | Micro drusy (current) | Macro comb (proposed) |
|-----------|-----------------------|------------------------|
| Child count | 12–22 | 6–12 (fewer, more recognizable) |
| Child size multiplier | 0.3–0.7× of parent | 0.7–1.0× of parent (each is a hand-specimen-visible euhedron) |
| Fill alpha multiplier | 0.55 (sparkle) | 1.0 (opaque individuals) |
| Cluster radius | parent a-width × 0.9 | parent a-width × 1.5–2.0 (spread across more cells) |
| Trigger habits | `druz`, `crust`, `granular`, `sugar`, `coating` | new triggers needed: `comb`, `vein_comb`, `palisade`, `comb_druzy` — or run off a per-mineral size threshold |

**Why this matters:** the photo case (a real vug cross-section showing macro comb quartz growing in stacked ranks with wavy ridges following wall topology) currently would render as either one big quartz hex prism (loner mode) or as a sparkly micro-cluster (current druzy mode). Neither captures the diagnostic "forest of upright mm-scale points growing perpendicular to the local wall." Adding the macro-comb sub-mode is roughly half a day of work in `_druzyClusterCount` — single dispatch, two parameter sets, switch on habit string or crystal-size threshold.

**Suggested new habit-string triggers** for the macro path: `comb`, `vein_comb`, `palisade`, `comb_quartz`, `comb_calcite` — plus extending the existing `_canonicalPrimitive` fuzzy fallback to recognize them. Multi-stage banded comb (the photo's stacked ranks) is the orbicular/banded mode (§4.9) composed with macro comb — they layer naturally if both ship.

### 4.3 Dripstone (gravity-aligned)

**Pattern:** Single tapered icicle from ceiling, inverted from floor. Hill & Forti 1997 *Cave Minerals of the World*.

**Implementation:** Already done. `PRIM_DRIPSTONE` primitive + air-mode c-axis override.

### 4.4 Spherulitic / radial-from-seed

**Pattern:** Single nucleation point + hundreds-to-thousands of acicular fibers radiating over a hemisphere. Convex-hull silhouette is a smooth dome (botryoidal). Wertheim et al. 2021 is the modern mechanism reference (Quartz Page chalcedony has similar phenomenology).

**Science:** Branching becomes favorable over single-crystal extension at moderate σ when surface-energy considerations make many small extensions cheaper than one large one. Fiber-to-fiber misorientation 0–22° within a spherulite — distinct from druzy because all fibers share one nucleation point rather than many distinct nucleation events. Real spherulites: chalcedony, malachite (often), hematite kidney ore, smithsonite, wavellite, prehnite.

**Implementation:** PARTIAL. `PRIM_BOTRYOIDAL` already exists as a single primitive (hemisphere of fiber tips from one anchor). What's missing is the *cluster* form — multiple spherulites side by side forming a botryoidal mass rather than one isolated dome. Could be added as a new mode in `_druzyClusterCount` that returns ~4–8 children spaced ~0.5× parent-width apart, each rendered as a separate `PRIM_BOTRYOIDAL` instance.

Suggested habit-string triggers for a new `'spherulitic_cluster'` mode: `botryoidal`, `mammillary`, `reniform`, `kidney` (when crystal size > some threshold so adjacency makes sense).

### 4.5 Radiating fan / spray (single-seed acicular)

**Pattern:** Many acicular crystals nucleating at a single point and fanning outward into a cone or hemisphere. Distinct from spherulitic in that individual fibers are *visible* as separate crystals (not blurred into a smooth dome) and the radiating pattern is the diagnostic feature.

**Science:** Same single-nucleation-point mechanism as spherulitic, but for minerals whose c-axis dominates so strongly that individual fibers don't blur into a dome — they remain visually distinct. Real radiating sprays: stibnite (Ichinokawa sprays), mesolite, scolecite, natrolite, millerite, wavellite (both spherulitic and radiating depending on conditions), aragonite (flos ferri), erythrite (plumose).

**Implementation:** Currently these habits fall through to `PRIM_ACICULAR` (single needle) or `PRIM_BOTRYOIDAL` (smooth dome) — both lose the radiating-spray diagnostic. Proposed: new mode that renders N (10–20) `PRIM_ACICULAR` instances sharing a single anchor point, with c-axes spread over a cone (default half-angle 30–60°, declared per-mineral).

Suggested habit-string triggers: `radiating_spray`, `radiating_columnar`, `radiating_cluster`, `radiating_fibrous`, `plumose_rosette`, `tufted_spray`, `cockscomb` (cockscomb is currently mapped to dipyramid but that's not quite right — real marcasite cockscombs are radiating-blade aggregates).

### 4.6 Parallel-stack books

**Pattern:** Multiple crystals nucleating along a single cleavage or twin plane, all with the same orientation. Selenite "books," mica stacks, barite rose petals.

**Science:** Heterogeneous nucleation along a planar feature (cleavage of host, twin plane of an earlier crystal) — each new crystal templates off the previous one's exposed face. Cody & Hull on selenite-book growth in Naica is the modern reference.

**Implementation:** New mode rendering N (3–8) parallel primitives stacked along a single axis with small lateral offset and shared orientation. Habit-string triggers: `micaceous_book`, `tabular_plates`, `rosette_bladed`, `radiating_blade` (when the radiating geometry is in-plane rather than 3D fan).

### 4.7 Dendritic / arborescent

**Pattern:** Branching at large angles (60–90°), snowflake-like. Native silver dendrites, native copper trees, manganese-oxide dendrites on fracture surfaces.

**Science:** Diffusion-limited aggregation (DLA) regime at high σ + low mobility. Branches form because the tip of a growing protrusion sees fresher solution than the base. Mathematically modeled as the Saffman-Taylor instability; geologically described in Sunagawa 2005 §6.

**Implementation:** PARTIAL. Currently `arborescent` and `dendritic` map to `PRIM_ACICULAR` (single needle). Real dendrites need a fractal-branching renderer — start with a trunk acicular primitive, spawn branch primitives at random angles every N units along the trunk, recurse 2–3 levels. Computationally manageable since branch count plateaus quickly.

Habit-string triggers: `arborescent`, `dendritic`. Specifically native_silver and native_copper would benefit; current handling reads them as "long needles" which loses the iconic branching.

### 4.8 Reticulated / lattice

**Pattern:** Interpenetrating angular bars forming a mesh. Cerussite reticulated meshes, rutile sagenite networks in quartz (titanium-oxide needles forming a 60°/120° lattice).

**Science:** Twin-controlled growth — two or three twin orientations grow simultaneously and intersect at fixed angles. Reticulated cerussite shows the orthorhombic 60° twin angle as a triangular mesh; rutile sagenite shows the {101} twin as 60°/120°.

**Implementation:** Currently `reticulated` maps to `PRIM_HEX_PRISM_TERMINATED` (one prism). Real reticulated needs N intersecting primitives at fixed angles. Specialized renderer — probably worth doing only for cerussite, rutile, possibly trapiche emerald (which is its own thing).

### 4.9 Orbicular / concentric

**Pattern:** Inward concentric growth from wall, banded. Geodes, banded agate, concentric malachite, banded fluorite (Cave-in-Rock).

**Science:** Cyclic chemistry — repeated fluid pulses produce successive growth shells with different composition. L'Heureux 1993 onward documents self-organized oscillatory banding in hydrothermal systems. The simulator already has `zones[]` per crystal recording per-step growth + trace chemistry — the data is there, the visual isn't.

**Implementation:** This is the Phase 4 "Q3b encrustation shell" item flagged as optional in `HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md`. Would render each `GrowthZone` as a visible concentric shell with per-zone color from trace chemistry — similar to how `98d-ui-zone-shape.ts` already does per-zone canvases for the deep-dive modal, but in the 3D scene.

Suggested triggers: `banding_agate`, `banded` — plus a global "show growth zones" toggle for any crystal whose zones have meaningful chemistry differences.

### Summary cluster-mode table

| Mode | Status | Effort to add | Visual impact |
|------|--------|---------------|----------------|
| Loner | Done (default) | — | — |
| Druzy / palisade — micro end | Done | — | — |
| **Druzy / palisade — macro comb end** | Same dispatch, missing parameterization | Half-day | **High** (vein-comb quartz, MVT comb calcite, banded vug interiors all unlock) |
| Dripstone | Done | — | — |
| **Spherulitic-cluster** | Primitive exists, cluster missing | Small | Medium-high (botryoidal masses look smoother) |
| **Radiating-spray** | Missing | Medium | **High** (stibnite, mesolite, marcasite become diagnostic) |
| **Parallel-stack books** | Missing | Small-medium | High (selenite Naica look, mica stacks) |
| **Dendritic branching** | Missing (renders as needle) | Medium-large | High (native silver/copper become iconic) |
| Reticulated | Missing | Medium | Low (few minerals) |
| Orbicular / banded | Data exists, visual missing | Medium-large | Medium-high (agates + Cave-in-Rock fluorite look authentic) |

**Suggested phase order:** parallel-stack books (smallest) → radiating-spray (high impact) → spherulitic-cluster (small) → dendritic (medium-large, big payoff) → orbicular banded (medium-large) → reticulated (last, niche).

---

## 5. Per-mineral research (the long-tail work)

This is the per-species deliverable: for each mineral, document the dominant habit, condition-dependent variants, dominant cluster mode, common twin laws, common paramorph/epimorph relationships. Below is a seed of well-characterized minerals to establish the table format and reference style; the long tail of 130+ minerals needs the same treatment in subsequent sessions.

**Reference codes** used below:
- **F** = Frondel's *System of Mineralogy* (Vol III silica is most cited; vol II for other classes)
- **D** = Dana's *New Mineralogy* 8th ed.
- **S** = Sunagawa 2005 *Crystals: Growth, Morphology, and Perfection*
- **R** = Ramdohr 1980 *The Ore Minerals and Their Intergrowths*
- **P** = Putnis 2002 *Mineralogical Magazine* 66; 2009 *Reviews in Mineralogy and Geochemistry* 70
- **Mindat** = Mindat.org per-species habit/twin section
- **HBM** = Anthony, Bideaux, Bladh, Nichols *Handbook of Mineralogy*

### 5.1 Carbonate class (14 minerals)

| Mineral | Crystal system | Dominant habit(s) | Condition variants | Cluster mode | Twin laws | Status in sim |
|---------|----------------|-------------------|--------------------|--------------|-----------|----------------|
| **calcite** | trigonal | scalenohedral (T>200°C, "dogtooth"), rhombohedral (T<200°C, "nailhead"), prismatic, botryoidal (Mn-rich), flos-ferri acicular (very high σ), druzy crust (late-stage) | Already 6 variants in spec | druzy + spherulitic (botryoidal) | {0001} (basal), {01-12} (e-twin), {10-14} (r-twin), {-1018} (k-twin) — all common (F vol II) | Habit + variants in spec ✓; twin_laws ✓ |
| **aragonite** | orthorhombic | acicular, columnar, flos-ferri (radiating-acicular), pseudo-hexagonal cyclic twin | exists in spec | radiating-spray (flos ferri) | {110} cyclic-trilling pseudo-hex (signature aragonite twin) | Habit ✓ twin ✓ |
| **dolomite** | trigonal | saddle-rhomb (hydrothermal MVT), coarse rhomb (hydrothermal high-T), rhombohedral euhedral | exists | druzy | none common | Habit ✓; sim has dedicated saddle_rhomb texture |
| **siderite** | trigonal | rhombohedral, saddle-rhomb, botryoidal (oxidized weathering), spherulitic | partial | spherulitic + druzy | rare {01-12} | Habit ✓; no twin_laws |
| **rhodochrosite** | trigonal | rhombohedral, scalenohedral (rare), botryoidal (banded — Wutong / Sweet Home) | partial | spherulitic | rare | Habit ✓; no twin_laws |
| **magnesite** | trigonal | rhombohedral, prismatic, granular | minimal | druzy | rare | Habit ✓ |
| **smithsonite** | trigonal | botryoidal (canonical — Kelly Mine), rhombohedral (rare euhedral), stalactitic, druzy | exists | spherulitic-cluster | none common | Habit ✓; CDR after sphalerite verified |
| **azurite** | monoclinic | prismatic, tabular, botryoidal, azurite-sun rosette (radiating disc) | exists | spherulitic / radiating-rosette | rare {101} | Habit ✓; no twin_laws — gap |
| **malachite** | monoclinic | acicular tuft, fibrous coating, botryoidal, pseudomorph-after-azurite (cubic outline) | exists | spherulitic + radiating-acicular | rare | Habit ✓; CDR routes done |
| **cerussite** | orthorhombic | tabular, acicular, reticulated lattice (60° twin), prismatic, snowflake-twin star | exists | reticulated + parallel-books | {110} cyclic-trilling pseudo-hex (snowflake twin — signature), {130} cruciform | Habit ✓; no twin_laws — gap |
| **aurichalcite** | monoclinic | acicular tuft, fibrous mat, sky-blue spherulites | partial | spherulitic | rare | Habit ✓; no twin_laws |
| **hydrozincite** | monoclinic | massive, earthy, botryoidal, fibrous | minimal | druzy + spherulitic | rare | Habit ✓; no twin_laws |
| **chrysocolla** | (amorphous to fine-grained) | botryoidal, enamel-on-cuprite, micro-plates | exists | spherulitic | n/a (typically amorphous) | Habit ✓; CDR after azurite/cuprite |
| **rosasite** | monoclinic | botryoidal (canonical Mapimi), spherulitic, fibrous | minimal | spherulitic | rare | Habit ✓ |

**Highest-leverage carbonate gaps**: cerussite twin_laws (snowflake-trilling is iconic and currently missing), aurichalcite cluster mode (spherulitic gap), siderite weathering→goethite paramorph route (already in PSEUDOMORPH_ROUTES if siderite gets added).

### 5.2 Silicate class (31 minerals) — partial seed

| Mineral | Crystal system | Dominant habit(s) | Common twin laws | Cluster mode | Status |
|---------|----------------|-------------------|------------------|--------------|--------|
| **quartz** | trigonal | prismatic + pyramidal terminations, scepter, skeletal-fenster, amethyst-druse, microcrystalline | Dauphiné {001} (thermal_shock — already in spec), Brazil {11-20} (penetration), Japan {11-22} (contact — Tsujikawa-mura) | druzy (amethyst) / single (mature) | Habit ✓, 5 variants, twin_laws ✓ partial (Dauphiné only — add Brazil + Japan) |
| **feldspar** (orthoclase) | monoclinic | prismatic, tabular, Carlsbad twin penetration | Carlsbad {010} penetration (canonical), Baveno {021} contact, Manebach {001} contact — all 3 are textbook | druzy/single | Habit ✓; twin_laws — gap |
| **albite** | triclinic | tabular, lamellar twin striations | Albite {010} polysynthetic (the namesake), Pericline {hkl varies} polysynthetic — both diagnostic of triclinic feldspars | parallel-books (lamellar twins) | Habit ✓; twin_laws — gap |
| **topaz** | orthorhombic | prismatic, water-clear etched, scepter | rare | single | Habit ✓; no twin_laws |
| **tourmaline** | trigonal | prismatic with striations + trigonal cross-section, watermelon zoning | rare | single + parallel-bundles | Habit ✓; no twin_laws |
| **beryl / emerald / aquamarine / goshenite** | hexagonal | prismatic with striations, barrel (olive_hex_barrel, yellow_hex_barrel — endlichite) | rare | single | Habit ✓; no twin_laws |
| **spodumene** | monoclinic | prismatic, fibrous (hiddenite — gem variety) | rare | single | Habit ✓; no twin_laws |
| **apophyllite** | tetragonal | bipyramidal, tabular with bipyramid, divergent groups (Deccan zeolite-facies) | rare | parallel-books + divergent | Habit ✓; no twin_laws |
| **chrysocolla** | (amorphous) | botryoidal, enamel-on-cuprite, micro-plates | n/a | spherulitic | (see carbonate row) |
| **prehnite** | orthorhombic | botryoidal, bowtie aggregate, tabular | rare | spherulitic + radiating-bowtie | Habit ✓; no twin_laws |
| **mesolite, scolecite, natrolite** | orthorhombic/monoclinic | acicular radiating sprays (the iconic Deccan zeolite habit) | rare | **radiating-spray (the diagnostic mode)** | Habit ✓ (acicular sprays); no twin_laws |

**Highest-leverage silicate gaps**:
1. **Feldspar Carlsbad twin** — penetration twins are the textbook feldspar identifier and currently invisible
2. **Albite polysynthetic twin striations** — diagnostic of triclinic plagioclase, currently invisible
3. **Quartz Brazil + Japan twins** — Dauphiné is in spec but the other two are iconic
4. **Radiating-spray cluster mode** for mesolite/scolecite/natrolite — currently rendered as straight acicular needles, losing the Deccan-zeolite radial fan

### 5.3 Sulfide class (39 minerals) — partial seed

| Mineral | Crystal system | Dominant habit(s) | Common twin laws | Cluster mode | Status |
|---------|----------------|-------------------|------------------|--------------|--------|
| **galena** | cubic | cubic, octahedral, cubo-octahedral, "spinel-twin" octahedral contact | {111} spinel-law (octahedral contact twin — Ramdohr 1980 §4.3.6) | single + druzy | Habit ✓; no twin_laws — gap |
| **sphalerite** | cubic | tetrahedral, dodecahedral, cleiophane wedge | {111} spinel-law (very common), {112} disphenoidal | single + epitaxy on pyrite | Habit ✓; no twin_laws |
| **pyrite** | cubic | cubic with striations, pyritohedral, octahedral, iron-cross penetration twin | {110} iron-cross penetration (the famous habit) | single + framboidal cluster | Habit ✓; has twin_laws via spec (verify) |
| **marcasite** | orthorhombic | cockscomb (radiating-blade aggregate), spear-twin, tabular | {110} contact twin (cockscomb is repeated {110}) — Ramdohr | **radiating-blade-cluster (cockscomb)** | Habit ✓; twin_laws may exist |
| **chalcopyrite** | tetragonal | disphenoidal pseudotetrahedral, pseudo-cubic high-T, sphenoidal | {112} sphenoidal contact, {102} penetration | single + epitaxy on pyrite | Habit ✓; no twin_laws — gap |
| **molybdenite** | hexagonal | tabular hex plates, micaceous books | rare | parallel-books | Habit ✓; no twin_laws |
| **tetrahedrite / tennantite** | cubic | tetrahedral, cubo-tetrahedral, dodecahedral | rare | single | Habit ✓; no twin_laws |
| **stibnite** | orthorhombic | acicular sprays (Ichinokawa), prismatic, columnar | rare | **radiating-spray** | Habit ✓; no twin_laws |
| **bismuthinite** | orthorhombic | acicular, prismatic, radiating | rare | radiating-spray | Habit ✓; no twin_laws |
| **realgar / orpiment** | monoclinic | prismatic short, tabular, micaceous (orpiment) | rare | parallel-books (orpiment) | Habit ✓; no twin_laws; realgar→pararealgar light transition ✓ |
| **cinnabar** | trigonal | rhombohedral, scalenohedral-acute (dauphiné-like in cinnabar) | {0001} dauphiné-analog (Ramdohr) | single | Habit ✓; no twin_laws |
| **acanthite** | monoclinic | prismatic, cubic paramorph from argentite | argentite paramorph signature (cubic shape) | single + parallel-books | Habit ✓; paramorph from argentite ✓; no twin_laws |
| **bornite / chalcocite / covellite** | cubic / orthorhombic / hexagonal | massive, tabular (covellite is iconic hex platy), iridescent peacock (bornite) | rare | druzy + parallel-books (covellite) | Habit ✓; no twin_laws |

**Highest-leverage sulfide gaps**:
1. **Pyrite iron-cross twin** — the iconic textbook penetration twin
2. **Galena {111} spinel-twin** — diagnostic in many MVT deposits
3. **Marcasite cockscomb cluster** — currently maps to dipyramid texture; real marcasite cockscombs are radiating blade aggregates
4. **Sphalerite/chalcopyrite spinel/sphenoidal twins** — common in mining specimens, currently absent

### 5.4 Sulfate class (15 minerals) — partial seed

| Mineral | Crystal system | Dominant habit(s) | Common twin laws | Cluster mode | Status |
|---------|----------------|-------------------|------------------|--------------|--------|
| **barite** | orthorhombic | tabular {001}, prismatic, bladed rosette ("desert rose"), snowball-radiating | rare | parallel-books + snowball ✓ | Habit ✓; snowball Q5 done |
| **celestine** | orthorhombic | tabular, prismatic, fibrous, bladed | rare | parallel-books | Habit ✓; no twin_laws |
| **anglesite** | orthorhombic | tabular, prismatic, pyramidal | rare | single | Habit ✓; no twin_laws |
| **gypsum / selenite** | monoclinic | tabular, prismatic, swallowtail twin (canonical!), satin spar (acicular fibrous), naica book | **{100} swallowtail contact twin** (textbook gypsum twin), {101} cyclic | parallel-books (Naica) | Habit ✓; twin_laws? |
| **anhydrite** | orthorhombic | tabular, prismatic, granular | rare | single | Habit ✓; no twin_laws |
| **alunite / jarosite** | trigonal | rhombohedral pseudocubic, tabular | rare | druzy | Habit ✓; no twin_laws |
| **brochantite / antlerite** | monoclinic | acicular, prismatic, tabular, blue-green needles | rare | radiating-cluster | Habit ✓; no twin_laws |
| **mirabilite / thenardite** | monoclinic / orthorhombic | acicular efflorescence, tabular, granular | rare | crust (efflorescent) | Habit ✓; no twin_laws; dehydration transition ✓ |
| **chalcanthite** | triclinic | tabular, fibrous, stalactitic | rare | parallel-books | Habit ✓; no twin_laws |

**Highest-leverage sulfate gap**: **gypsum swallowtail twin {100}** — the textbook gypsum identifier, currently absent. Should be the first sulfate twin added.

### 5.5 Native element class (8 minerals)

| Mineral | Crystal system | Dominant habit(s) | Common twin laws | Cluster mode | Status |
|---------|----------------|-------------------|------------------|--------------|--------|
| **native_gold** | cubic | octahedral, dendritic, wire, leaf, nugget | {111} spinel-law (octahedral) | dendritic (if branching) + nugget (massive) | Habit ✓; no twin_laws |
| **native_silver** | cubic | dendritic (wire-cluster), octahedral, herringbone (Kongsberg) | {111} spinel-law | **dendritic** (currently maps to acicular) | Habit ✓; no twin_laws; tarnish→acanthite ✓ |
| **native_copper** | cubic | dendritic, arborescent, leaf, cubo-dodecahedral | {111} spinel-law (very common) | **dendritic** | Habit ✓; no twin_laws |
| **native_bismuth** | trigonal | hopper-growth iridescent cube (lab-grown only), reticulated, granular | rare | reticulated + framboidal | Habit ✓; no twin_laws |
| **native_arsenic** | trigonal | mammillary, botryoidal, granular | rare | spherulitic | Habit ✓; no twin_laws |
| **native_sulfur** | orthorhombic | dipyramidal, tabular, encrusting | rare | druzy | Habit ✓; no twin_laws |
| **native_tellurium** | trigonal | acicular, prismatic, columnar | rare | single | Habit ✓; no twin_laws |
| **awaruite** (Fe-Ni alloy) | cubic | cubic, granular | rare | single | Habit ✓; no twin_laws |

**Highest-leverage native gap**: **dendritic cluster mode** for silver/copper/gold — currently rendered as acicular needles, losing the iconic branching morphology.

### 5.6 Arsenate class (15 minerals) — partial seed

| Mineral | Crystal system | Dominant habit(s) | Common twin laws | Cluster mode | Status |
|---------|----------------|-------------------|------------------|--------------|--------|
| **erythrite** ("cobalt bloom") | monoclinic | acicular, bladed, plumose-rosette, prismatic | rare | radiating-acicular + plumose-rosette | Habit ✓; no twin_laws |
| **annabergite** ("nickel bloom") | monoclinic | acicular, fibrous, cabrerite (Mg-bearing) | rare | radiating + crust | Habit ✓; no twin_laws |
| **scorodite** | orthorhombic | bipyramidal, tabular, botryoidal-crust | rare | druzy + spherulitic | Habit ✓; no twin_laws; CDR from arsenopyrite ✓ |
| **adamite / olivenite** | orthorhombic | prismatic, radiating, druzy | rare | radiating | Habit ✓; no twin_laws |
| **mimetite** | hexagonal | prismatic, hex-barrel (campylite — endlichite_yellow in spec), botryoidal | rare | druzy + radiating | Habit ✓; no twin_laws |
| **pharmacolite** | monoclinic | acicular, fibrous, tufted | rare | radiating | Habit ✓; dehydration→haidingerite ✓ |
| **conichalcite / duftite** | orthorhombic | botryoidal, fibrous-crust, mammillary | rare | spherulitic | Habit ✓ |
| **legrandite** | monoclinic | prismatic radiating clusters (canonical Ojuela) | rare | radiating | Habit ✓; no twin_laws |

### 5.7 Other classes (summary)

The remaining classes (phosphate 16, oxide 12, molybdate 7, halide 4, hydroxide 2, borate 2, amphibole 5) need the same per-mineral treatment. Notable highlights:

- **Phosphate** — vivianite (radiating bladed, twin laws rare), apatite (hexagonal prismatic, rare twins), wavellite (spherulitic-radial — *the* canonical example), pyromorphite/vanadinite (hex barrel — endlichite-style), turquoise (botryoidal). **Wavellite spherulites** are diagnostic.
- **Oxide** — hematite (specular tabular vs reniform-kidney botryoidal — already two variants per spec; ceiling bias for specular rosettes ✓), magnetite (octahedral, dodecahedral; rare {111} spinel-law twin), rutile (sagenite reticulated network, {101} twin elbow — *iconic*), cassiterite (bipyramidal, {101} elbow-twin), uraninite (cubic, botryoidal pitchblende), chromite (octahedral), corundum (hex prism, sapphire/ruby barrel).
- **Molybdate / tungstate** — wulfenite (tabular {001}, sometimes prismatic; rare twins), scheelite (bipyramidal {112} disphenoidal; {112} twin "pseudo-octahedron"), stolzite/raspite (paramorph pair).
- **Halide** — fluorite (cubic, octahedral, dodecahedral; {111} penetration twin = "spinel-law" cube — iconic and currently missing in spec), halite (cubic, hopper-growth), sylvite (cubic), villiaumite (cubic).
- **Hydroxide** — goethite (acicular, botryoidal, mammillary), lepidocrocite (tabular, fibrous, micaceous).
- **Borate** — borax (prismatic, cottonball), tincalconite (paramorph product of borax).
- **Amphibole** — tremolite/actinolite (acicular columnar, fibrous), anthophyllite/amosite/crocidolite (asbestiform fibrous — these are the asbestos forms). Habits ✓; twin laws rare in amphiboles (the {100} simple twin is common but minor visually).

**The fluorite penetration twin** ({111} interpenetrating cubes — the Cumbrian / Cave-in-Rock textbook habit) is probably the single most iconic mineral twin currently missing from the sim. Should be prioritized.

---

## 6. Phase 2 primitive refinements

Audit of the 13 existing primitives vs what real mineral habits need:

### 6.1 Refinements to existing primitives

| Primitive | Current state | Suggested refinement |
|-----------|---------------|----------------------|
| PRIM_CUBE | 8 verts, perfect cube | Could grow a striated variant for pyrite (parallel {100} face striations encode the cube-pyritohedron transition direction). Texture-only addition. |
| PRIM_HEX_PRISM_TERMINATED | 13 verts, 6-fold pyramidal cap | Add longitudinal striations for tourmaline (vertical grooves on the prism faces are diagnostic). Texture-only. |
| PRIM_TABULAR | 8-vert square plate | Two refinements: (a) **orthorhombic-aspect** — currently the plate is roughly square but barite/wulfenite tablets have explicit a:b ratios that differ; would need parametric a-width vs b-width. (b) **bipyramidal cap** for wulfenite (which can be tabular *with* a small pyramidal modification on the basal pinacoid). |
| PRIM_ACICULAR | 7 verts (slim hex needle) | Currently maps to gypsum needles, marcasite spears, stibnite blades — all of which are different. Specifically: marcasite/cerussite "spear" twins need a doubly-pointed variant (PRIM_DIPYRAMID is too symmetric). Acicular needles are fine for stibnite-style; spear needs its own primitive. |
| PRIM_DIPYRAMID | 8 verts, hex equator + two apices | Used for scheelite, anhydrite, marcasite cockscomb. For scheelite the canonical form is actually tetragonal disphenoidal `{112}` (4-fold not 6-fold). Could split into PRIM_TET_DIPYRAMID vs PRIM_HEX_DIPYRAMID. |
| PRIM_RHOMBOHEDRON | calcite-style 60° twist | Fine for calcite/dolomite. For rhodochrosite/siderite (same crystal class) it's also fine. |
| PRIM_SCALENOHEDRON | dogtooth zigzag | Calcite-specific. Could use a less-zigzaggy variant for rhodochrosite (rhodochrosite scalenohedra are less extreme). |

### 6.2 New primitives needed

| Suggested primitive | Use case | Effort |
|---------------------|----------|--------|
| **PRIM_ORTHO_PRISM** (true orthorhombic prism with rectangular cross-section) | Topaz, andalusite, sillimanite, danburite — currently use PRIM_HEX_PRISM which is symmetric | Small |
| **PRIM_MONOCLINIC_PRISM** (oblique top face, classic monoclinic look) | Gypsum, augite, hornblende, malachite, azurite — currently use PRIM_HEX_PRISM | Small |
| **PRIM_TRIGONAL_PRISM** (3-fold cross-section, vertical striations) | Tourmaline (the iconic trigonal cross-section + striations) | Small-medium |
| **PRIM_TRAPEZOHEDRON** (24-face isometric polyhedron) | Garnet, analcime, leucite — currently map to dodecahedron or octahedron | Medium |
| **PRIM_DODECAHEDRON** (rhombic dodecahedron) | Garnet, sodalite, magnetite (when {110} dominates) — currently map to octahedron | Medium |
| **PRIM_SPEAR** (doubly-pointed thin blade) | Marcasite spear-twin, cerussite snowflake-trilling | Small |
| **PRIM_TET_DIPYRAMID** (4-fold disphenoidal) | Scheelite, chalcopyrite, anatase | Small (split from hex dipyramid) |
| **PRIM_FLUORITE_OCT_CONTACT_TWIN** (two interpenetrating octahedra at {111}) | Fluorite penetration twin (the textbook habit) | Medium — needs proper twin geometry |

### 6.3 Skeletal / etched-face texture (per boss directive, not geometry)

Boss directive: "skeletal etching can just be a graphic texture." Per Tanaka et al. 2018 (J. Phys. Chem. Lett. — halite cubic-to-hopper transition at growth rate ~6.5 µm/s, scaling as σ³ above threshold), hopper/skeletal forms emerge at high σ × low mobility. Currently `hopper_growth` and `hopper_cube` are habit variants for halite/sylvite triggered by `rapid evaporation — Death Valley playa surface`, and they map to PRIM_CUBE in the renderer. The visual cue is missing.

**Proposed texture:** add a `hopper` texture function to `99a-renderer-textures.ts` that draws a stepped or notched inset along each cube edge — looks like the cube is hollow. Triggered by habit string `hopper_growth`, `hopper_cube`, `skeletal_fenster`, `skeletal`, or by any crystal whose nucleation σ was above a per-mineral skeletal threshold. Composes with existing primitive dispatch — no geometry change.

Same approach for **etched faces** (a hatching texture for crystals that nucleated and then dissolved partially — uses the existing `is_phantom` zones data).

---

## 7. Suggested phasing (the actual roadmap)

The boss's four-phase frame stays useful as the organizing principle. Below, each phase is reformulated against the actual gaps documented above:

### Phase 1 (revised) — Variant richness on the thin entries

**Goal:** Audit the 15 minerals with ≤2 `habit_variants[]` and add documented variants where literature supports them.

**Out of scope:** The 5 paramorph products (raspite, tincalconite, etc.) — they inherit shape, single variant is correct.

**Effort:** ~10 minerals × ~1 hour of Mindat/Frondel research each = ~10 hours. Per-mineral commits.

**Visual impact:** Low individually, but compounds across scenarios. Mostly invisible to players unless they spend time with a specific mineral.

### Phase 2 (revised) — Primitive refinements + new primitives

**Goal:** Add 4–8 new primitives covering trigonal striations, orthorhombic prism, monoclinic prism, trapezohedron, dodecahedron, spear, tet-dipyramid, fluorite penetration twin. Refine existing primitives where simple texture additions improve them (pyrite striations, tourmaline striations, wulfenite bipyramidal cap).

**Effort:** Per-primitive ~2–4 hours. Eight primitives ≈ 2–3 days. Could ship one per commit.

**Visual impact:** Medium-high. Tourmaline finally has its trigonal cross-section; fluorite has its penetration twin; garnet has a dodecahedron not an octahedron.

**Skeletal texture (boss directive):** Add a `hopper` texture function to `99a-renderer-textures.ts`. Half-day work. **High impact for halite/sylvite/bismuth scenarios.**

### Phase 3a — Twin-law coverage (the big research arc)

**Goal:** Add `twin_laws[]` entries to the 109 minerals currently missing them. Group by class for batchability.

**Effort:** ~30 minutes per mineral × 109 = ~55 hours. Realistically split across 3–6 sessions.

**Suggested batches** (in descending impact order):
1. **Iconic missing twins** (single session, ~10 entries): fluorite penetration {111}, gypsum swallowtail {100}, pyrite iron-cross {110}, galena spinel {111}, cerussite snowflake-trilling {110}, aragonite cyclic {110}, feldspar Carlsbad {010}, albite polysynthetic {010}, quartz Brazil + Japan, marcasite cockscomb {110}
2. **Sulfide batch** (one session, ~22 entries): the 22 sulfides lacking twin_laws — most have only minor twins, batch as small entries
3. **Silicate batch** (one session, ~25 entries — minus the iconic ones already done)
4. **Phosphate / arsenate / sulfate** (one session each, 13/12/9 entries)
5. **Carbonate / native / oxide tail** (one session, ~14 entries)
6. **Amphibole / molybdate / hydroxide / borate / halide tail** (one session, ~14 entries)

**Visual impact:** **Highest of any phase here.** Most-recognized natural-history mineral habits are twin geometries (the textbook habits photographed in field guides). Currently 64% of minerals have no twin behavior at all.

### Phase 3b — Cluster mode expansion

**Goal:** Add cluster modes beyond druzy + dripstone. Per §4 above:

1. **Parallel-stack books** (single mode, smallest) — selenite books, mica stacks
2. **Radiating-spray** (highest visual impact) — stibnite, mesolite, scolecite, natrolite, marcasite cockscomb (when combined with twin), erythrite/annabergite plumose
3. **Spherulitic-cluster** (small) — multi-spherulite botryoidal masses
4. **Dendritic branching** (medium-large) — native silver/copper trees
5. **Orbicular / banded shells** (medium-large, partial overlap with Q3b encrustation from paragenesis proposal) — agate, Cave-in-Rock fluorite
6. **Reticulated** (last, niche) — cerussite mesh, rutile sagenite

**Effort:** ~2–3 days per mode if shipped independently with per-mode tests + baseline regen. Total ~2 weeks.

**Visual impact:** Each mode unlocks 5–10 minerals' diagnostic habits. Radiating-spray alone makes Deccan zeolite scenarios visibly real.

### Phase 4 — Pseudomorph route expansion + texture polish

**Goal:** Extend `PSEUDOMORPH_ROUTES` beyond the current 18 entries with additional documented CDR pairs. Add surface texture cues for perimorph casts (boxwork hatching) and CDR pseudomorphs (porosity stippling per Putnis 2002 "product porosity").

**Specific additions to research:**
- Goethite/limonite after siderite (FeCO₃ → FeOOH, the rusty cube cast)
- Calcite after fluorite (Cave-in-Rock / Elmwood) — calcite inherits the fluorite cube outline
- Quartz after fluorite (Cornwall / Cumbria) — quartz inherits the fluorite cube, often hollow
- Quartz after barite (sand-rose rosettes from Oklahoma)
- Smithsonite after calcite (rhombohedral smithsonite)
- Limonite after pyrite — already in routes as goethite-after-pyrite; both are correct
- Cerussite after galena — already covered? verify
- Hematite after magnetite (martitization)
- Boulangerite/jamesonite after each other (sulfosalt CDR)

**Effort:** ~1 day for the route table additions + ~2 days for the surface texture work in the renderer.

**Visual impact:** Medium. Most epimorph scenarios already work — the polish refines the textures.

### Total estimated effort

- Phase 1: ~10 hours
- Phase 2 (primitives): ~3 days
- Phase 2 (skeletal texture): half-day
- Phase 3a (twin coverage): ~55 hours, 4–6 sessions
- Phase 3b (cluster modes): ~2 weeks
- Phase 4 (pseudomorph polish): ~3 days

**Total:** ~5–6 weeks of focused work if everything gets done. The cluster-mode and twin-coverage arcs are the bulk of it.

### Recommended start order

If shipping one arc at a time, the highest naturalism-per-day order is:

1. ✅ **Macro comb druzy sub-mode** — SHIPPED `f125c13` (2026-05-22). Wireframe cluster-spec port to parity with 99i. Adds the parameter regime that vein-comb quartz + MVT comb calcite + parallel-forest prismatic all needed; resolves the photo-correction case.
2. ✅ **Iconic twins batch** — SHIPPED `3bd4472` (v133, SIM_VERSION 132→133, 2026-05-22). 7 twin_laws across 6 minerals: quartz Brazil + Japan (NEW), galena spinel-law (NEW), marcasite cockscomb (NEW), fluorite penetration / pyrite iron-cross / albite polysynthetic retuned to literature values. Drifted 29 of 30 scenarios; assertion updates in roughten-gill + calibration-assertions tests document the cascade.
3. ✅ **Hopper / skeletal texture** — SHIPPED `a7dc360` (2026-05-22). New `_texture_hopper` function in 99a-renderer-textures.ts paints stepped right-angle notches on cell edges for the 6 hopper-variant minerals (halite/sylvite/galena/quartz/apophyllite/pyromorphite). Tanaka et al. 2018 cited.
4. ✅ **Radiating-spray cluster mode (subset)** — SHIPPED `b573915` (2026-05-22). Re-routed 4 habits (radiating_spray / radiating_cluster / radiating_fibrous / plumose_rosette) from PRIM_BOTRYOIDAL to PRIM_ACICULAR so they get the spike cluster pattern (8 satellite needles around parent). Stibnite + bismuthinite + erythrite plumose now render as fans instead of domes.
   - DEFERRED to a follow-up commit: the full radiating-spray mode (tiltMax plumbing through `_renderWireframeInstance` + 'fan' pattern with single-anchor satellites + per-pattern satellite primitive override).
5. ✅ **Fluorite penetration twin as dedicated primitive** — SHIPPED `57a9108` (2026-05-22). `PRIM_FLUORITE_PENETRATION_TWIN` (two interpenetrating cubes rotated 60° around their shared body diagonal). Dispatched via `_lookupCrystalPrimitive` when crystal.mineral === 'fluorite' && crystal.twinned && crystal.twin_law === 'penetration'. Dispatch precedence: twin override → air-mode dripstone → canonical. **Wireframe only — Three.js parity (5b) is the next half-day task.**
6. ⏳ **Three.js parity for fluorite twin** (5b) — half-day. `_buildFluoriteTwinGeom` BufferGeometry builder + dispatch via `_resolveCrystalGeomToken` in 99i. See `HANDOFF-CRYSTAL-NATURALISM-ARC.md` for the 9-step playbook.
7. ⏳ **More iconic twin primitives** — half-day each, same pattern as #5. In rough impact order: gypsum swallowtail (selenite, fires in many scenarios), marcasite cockscomb ({110} repeated, v133 set p=0.55), cerussite cyclic_sixling (snowflake-trilling habit, existing p=0.4), pyrite iron-cross ({110}, v133 retuned to p=0.07), galena spinel-law ({111} contact, v133 added at p=0.10), aragonite cyclic_sextet (pseudo-hex, existing p=0.4). Six twins, can batch 2-3 per session.
8. ⏳ **True 'fan' cluster mode** — 1 day. Plumb `tiltMax` through `_renderWireframeInstance`, add 'fan' pattern with shared-anchor satellites. Completes the radiating-spray work from #4.
9. ⏳ **Dendritic branching cluster mode** — 1-2 days. Native silver/copper tree-like geometry. Fractal-branch primitive.
10. ⏳ **Orbicular / banded shell rendering** — medium-large. Surface `Crystal.zones[]` in main scene as concentric shells. Port from `98d-ui-zone-shape.ts`.
11. ⏳ **Per-class twin data coverage** — 4-6 sessions, ~15-25 mineral spec entries per session. Silicate 25, sulfide 22, phosphate 13, arsenate 12, sulfate 9, others 28. Each batch drifts baselines, needs SIM_VERSION bump.
12. ⏳ **Phase 1 variant enrichment** — small, non-blocking. 10 minerals with ≤2 habit_variants[].

See `proposals/HANDOFF-CRYSTAL-NATURALISM-ARC.md` for the full pickup playbook, gotchas encountered during items 1-5, and a seam map of every file the next agent will touch.

---

## 8. What this doc doesn't do

- **It doesn't write any code.** Per boss instruction, this is the homework phase.
- **It doesn't enumerate every mineral.** §5 has ~40 representative entries; the long tail of ~130 needs the same treatment in subsequent sessions.
- **It doesn't commit to architecture decisions.** §4's cluster-mode dispatch sketch and §6's primitive list are suggestions — the actual code design happens at implementation time.
- **It doesn't address the cavity-clip leak bug** (BUG-CRYSTALS-CLIP-VUG-WALL.md, second instance found in supergene_oxidation per the paragenesis visual verification handoff). Separate issue, queued.

---

## 9. Bibliography

**Foundational physics:**
- Sunagawa, I. (2005). *Crystals: Growth, Morphology, and Perfection*. Cambridge University Press. The canonical modern reference for crystal habit + growth mechanism.
- Sunagawa, I. (1987). *Morphology of Crystals*. Terra Scientific. Predecessor to the 2005 volume; still cited for specific morphologies.
- Mullin, J.W. (2001). *Crystallization* (4th ed.). Butterworth-Heinemann. §5 on nucleation; §6 on growth mechanism.
- Hartman, P. & Perdok, W.G. (1955). "On the relations between structure and morphology of crystals." *Acta Crystallographica* 8(1), 49–52. The PBC / BFDH foundation paper.

**Per-mineral / per-deposit:**
- Frondel, C. (1962). *The System of Mineralogy Vol. III: Silica Minerals* (7th ed.). The quartz/silica reference; habits, twin laws, varieties.
- Palache, C., Berman, H., & Frondel, C. (1944, 1951). *The System of Mineralogy Vols. I and II*. Pre-Dana-8th classic; cited specifically for pharmacolite→haidingerite in current sim sources.
- Anthony, J.W., Bideaux, R.A., Bladh, K.W., & Nichols, M.C. *Handbook of Mineralogy* (5 vols., 1990–2003). Per-mineral data; freely available online (handbookofmineralogy.org).
- Dana, J.D. & Dana, E.S. *Dana's New Mineralogy* (8th ed., 1997). Modern Dana revision. Less cited than the Handbook but useful for systematic comparison.
- Mindat.org per-species pages. Photographic + habit + twin data, not citation-grade but indispensable for the long tail.

**Vein and cavity textures:**
- Hayba, D.O., Bethke, P.M., Heald, P., & Foley, N.K. (1985). "Geologic, mineralogic, and geochemical characteristics of volcanic-hosted epithermal precious-metal deposits." *USGS Bulletin 1646*, 129–162. The competitive-growth-fabric reference.
- Ramdohr, P. (1980). *The Ore Minerals and Their Intergrowths* (2nd ed.). The sulfide texture + epitaxial pair reference.
- Stanton, R.L. (1972). *Ore Petrology*. Texture interpretation and epitaxial relationships.
- Grigor'ev, D.P. (1965). *Ontogeny of Minerals*. Pre-Sunagawa Russian text on growth-stage interpretation; cited in PROPOSAL-PARAGENESIS for encrustation framework.

**Specific phenomena:**
- Wertheim, J., et al. (2021). [spherulite mechanism — referenced in 99c-renderer-primitives.ts PRIM_BOTRYOIDAL]. The modern spherulite-fiber-misorientation reference.
- Tanaka, K., et al. (2018). "Halite crystallization in confined geometries." *J. Phys. Chem. Lett.* / PMC5994728. The cubic-to-hopper σ-transition threshold.
- Tenthorey, E. & Cox, S.F. (1998). "Cataclastic flow and diffusive mass transfer in quartz-rich gouge during seismic-slip-style deformation." *JGR* 103(B9). The 10× permeability reduction at 80–85% fill reference (used in `RESEARCH-GROWTH-AT-HIGH-FILL.md`).
- Putnis, A. (2002). "Mineral replacement reactions: from macroscopic observations to microscopic mechanisms." *Mineralogical Magazine* 66(5), 689–708.
- Putnis, A. (2009). "Mineral replacement reactions." *Reviews in Mineralogy and Geochemistry* 70, 87–124. The modern CDR framework.
- Bonazzi, P., Menchetti, S., & Pratesi, G. (1996). "The crystal structure of pararealgar, As₄S₄." *Mineralogical Magazine* 60(401), 401–409. The realgar→pararealgar light-induced isomerization.
- Cody, R.D. & Hull, A.B. (selenite-book growth literature for Naica). Specific paper to be confirmed when used in implementation.
- Proust, D. & Fontan, F. (2007). "Late-stage celadonite/calcite/lepidocrocite paragenesis in Brazilian amethyst geodes." *Mineralium Deposita* 42 — referenced in `RESEARCH-GROWTH-AT-HIGH-FILL.md` for the "skunk calcite" terminal patina.
- Sangster, D.F. (1983, 1990). MVT framework papers. *Mineralium Deposita* 18 and the 1990 review.
- L'Heureux, I. (1993 onward). Self-organized oscillatory banding in hydrothermal systems. Multiple papers; specific citations on implementation.
- Hill, C. & Forti, P. (1997). *Cave Minerals of the World* (2nd ed.). National Speleological Society. The dripstone reference; cited in `PROPOSAL-HABIT-BIAS.md`.

**Existing project research (for cross-reference):**
- `proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md` — late-stage growth, hopper transitions, `late_stage_propensity`
- `proposals/PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md` — Q1–Q5 paragenesis arc (approved + shipped)
- `proposals/PROPOSAL-HABIT-BIAS.md` — gravity-aware orientation, dripstones (5 slices shipped 2026-05-11)
- `proposals/PROPOSAL-CAVITY-MESH.md` — wall_anchor scheme, per-vertex chemistry
- `proposals/HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md` — paragenesis end-to-end verification (2026-05-06)
- `proposals/PROPOSAL-CRYSTAL-HABIT.md` — Rockbot draft this doc is reframing
