# Directional / Polar / Stepped Crystal Growth — Design Proposal

*Lead author synthesis of the representation / kinetics / polarity / calcite-{104} research package, reconciled against the live engine and the critic's readiness review. Citation discipline: only verified/partial sources are presented as solid; anything self-flagged speculative or unpinned is labelled inline.*

> **Provenance.** Produced 2026-06-22 from a multi-agent research workflow (11 agents, ~928K tokens): 4 parallel science passes (representation / kinetics / polarity / calcite-{104}) + 1 engine-integration pass over the live code, every citation adversarially web-verified, a completeness critic, then synthesis. **40+ citations, zero outright fabrications**; the verifiers caught only minor locus slips (Dowty page off-by-one; Reeder 1991→1990 misdate; Kaminsky title/locus splice; Hartman-vs-Sunagawa editor), all corrected in §5. The builder cross-checked the physics end-to-end against independent knowledge (Wulff/BFDH/Hartman-Perdok, BCF/Frank/Cabrera-Vermilyea/Berg/Mullins-Sekerka, the 10 polar point groups, calcite R-3c centrosymmetry, the 78°/102° cleavage-rhomb step pair) — all confirmed.
>
> **Catalog point-group audit — EXECUTED 2026-06-22** (the proposal flagged this as "answerable now"; it is now answered):
> - **Real intrinsic-polar tenants present: FOUR, not three.** hemimorphite (`data/minerals.json:13048`, Imm2, explicitly annotated "POLAR — the hemimorphic class"); wurtzite (1251, P6₃mc, "polar c-axis, one end pointed one end flat"); tourmaline (5115, 3m); **and greenockite** (CdS, 13984, hexagonal 6mm, "Hemimorphic crystals diagnostic") — a fourth tenant the research did not name.
> - **Quartz mislabel check: PASSES.** Quartz (221) is correctly treated as *enantiomorphic* (class 32 — Brazil/Japan penetration twins across {11-20}, `_source` Frondel 1962), **not** polar. No bug to fix.
> - **Point group is stored as PROSE** in `description`/`audit_status` (e.g. "Imm2 (POLAR…)", "P6₃mc") — there is no structured field. Several polar tenants **already declare hemimorphic habit variants** ("one end pointed, one end flat": wurtzite `hemimorphic_crystal`, hemimorphite `large_prismatic_hemimorphic`, greenockite "hemimorphic six-sided pyramid") that **currently render symmetrically** — so Phase 3 would make existing, already-authored declarations finally render true. A structured `point_group` field is the clean enabler.

---

## 0. Problem statement (what we can't represent today, grounded in current engine)

A vugg crystal's **entire external shape is two numbers and a string**. In `js/27-geometry-crystal.ts`, each `GrowthZone` carries only a scalar `thickness_um` (a linear increment along c). `Crystal.add_zone` accumulates `total_growth_um`, integrates an **ellipsoid** shell at the habit's aspect ratio, and derives both outer dimensions from those scalars: `c_length_mm = total_growth_um/1000` and `a_width_mm = sqrt(6V/(π·c))`. `_habitAspectRatio` maps the habit string → **one** a/c scalar (verified at `js/27:33–75`). The renderer (`js/99i-renderer-three.ts`) picks a unit primitive by habit token and applies a **symmetric** scale, `mesh.scale.set(aWid, cLen, aWid)` (99i:3881), with the base placed at the wall anchor.

Five consequences, each a thing we cannot represent:

1. **No second termination.** Both ends of the c-axis are the same length. We cannot show a singly-terminated drusy crystal with a buried base — the universal vug habit.
2. **No per-face distance.** Every face of a given form shares one size. We cannot show one face-set developed and the opposite suppressed.
3. **No frozen-end vs free-end.** The "attached" end is merely where the primitive base sits; there is no fluid-access asymmetry in the *data* (the engine analysis confirms this).
4. **No crystallographic polarity.** Hemimorphite, tourmaline, and wurtzite — all **present in `data/minerals.json`** (verified: hemimorphite line 13048 with an explicit "Imm2 POLAR … hemimorphic" annotation in its `description`; tourmaline 5115; wurtzite 1251) — are rendered with identical +c/−c terminations, which is wrong for these species.
5. **Directional stepping exists only along c, not per-face.** `_makeTerracedCalciteGeom` (99i:2367) builds a non-uniform silhouette from zone-stack regime tags, but the terraces are concentric-in-time **bands stacked along c**; the relief is identical on every face of the ring. Opposite face-sets are byte-identical.

The team has **already named this**: the version contract (`js/15-version.ts:1521`) records that decoupling growth "would require splitting `total_growth_um` into chemistry-counter + geometry-counter fields" and deferred it. Per-face is the natural generalization of that same split. This proposal is that split, staged.

**This is a scalar→per-face foundational shift.** It is not a habit rename and not a render token. It touches the core data model. The honest framing below stages it so each step ships independently and the first tenant is small.

---

## 1. The science

### 1.1 Representation: the central-distance / Wulff model (data model + the math)

The field-standard, simulation-ready representation of a crystal's external shape is the **central-distance (Wulff-body) model**. The crystal is a bounded convex polyhedron:

> **P = ⋂ᵢ Hᵢ⁻,  Hᵢ⁻ = { x ∈ ℝ³ : nᵢ·x ≤ dᵢ }**

where each face *i* is one oriented plane: an outward unit normal **nᵢ** and a scalar **central distance dᵢ** (perpendicular distance from a fixed interior origin O to the face plane). Boundedness requires the normals to positively span 3-space.

Two properties make this the canonical choice:

- **Steno's law of constancy of interfacial angles** (Steno 1669, *verified*): for a species, `angle(nᵢ, nⱼ) = const` regardless of size or relative face development. So the **normal directions are fixed**, not free parameters — they come from the crystal's point group acting on the form indices {hkl}, mapped to real-space via the reciprocal-lattice metric: **n_hkl ∝ h·a\* + k·b\* + l·c\***. Only the **distances dᵢ are dynamic**. This cleanly splits *immutable geometry* (computed once at mineral-load) from *mutable state* (driven by growth).
- **Forms expand by symmetry.** A "form" {hkl} is the orbit of one face under the point group: `Form({hkl}) = { R·n_hkl : R ∈ pointGroup }`. An author writes a handful of forms (e.g. cube {100} + octahedron {111}); the symmetry operator list auto-generates the 6 + 8 faces, which share one d in the ideal crystal.

**Rendering** turns {nᵢ, dᵢ} into geometry by half-space intersection, two methods:
- *Direct (triple-plane):* solve every triple of planes for its common point `v = solve[nᵢ,nⱼ,nₖ | dᵢ,dⱼ,dₖ]`, keep v only if `nₗ·v ≤ dₗ ∀l` (inside all half-spaces), group surviving vertices by active planes into faces, angle-sort each face. O(n⁴) but trivially correct for the ≤~24 faces a crystal has.
- *Dual (production):* map each plane to a dual point `pᵢ = nᵢ/dᵢ`; convex hull of {pᵢ}, dualize back. Scalable path.

A **grown-out face contributes no vertices automatically** — no special-casing needed.

This is exactly how SHAPE (Dowty 1980, *partial* — off-by-one end page), KrystalShaper, WinXMorph (Kaminsky, *partial* — spliced locus), and VESTA are parameterized: point group + forms {hkl} + one central distance per form, rendered by half-space clipping.

### 1.2 Growth kinetics: the per-face growth law (σ → distance advance; smooth vs stepped vs skeletal)

Growth is a per-face scalar advance: **dᵢ(t+Δt) = dᵢ(t) + Rᵢ·Δt**, and a scenario's scalar growth amount g maps in as **dᵢ(g) = dᵢ⁰ + g·Rᵢ**, cleanly separating *how much it has grown* (g, drivable by the rest of the sim) from *what shape it grows into* (the fixed rate vector {Rᵢ}). Uniform Rᵢ → self-similar inflation (today's behavior); species-specific Rᵢ → correct habit emerging with g. **Only relative rates matter** ("slow faces win": a fast face shrinks in area and self-eliminates; the persistent habit is the slowest faces). Which faces appear and how fast, in increasing fidelity:

- **BFDH** (Donnay–Harker 1937, *verified*): morphological importance ∝ interplanar spacing d_hkl, with screw/glide extinction divisors ÷{2,4}. `MI(hkl) ∝ d_hkl(corrected)`. Energy-free, computable from cell + space group for **every** catalog species — the zero-chemistry default rate seed: `Rᵢ ∝ 1/d_hkl`.
- **Hartman–Perdok PBC / attachment energy** (Hartman–Perdok 1955 trilogy + Hartman–Bennema 1980, *verified*): faces classed **F** (≥2 PBCs in slice, flat, slow, dominant), **S** (1 PBC), **K** (0 PBCs, kinked, fast, absent). `R ∝ E_att` (monotone; exact form mechanism/σ/T-dependent). The quantitative successor to BFDH, but E_att is not tabulated for most catalog minerals.

**Whether a face is smooth, stepped, or skeletal** is set by three coupled controls — supersaturation σ, impurity load, transport regime:

- **Spiral (BCF) growth** (Burton–Cabrera–Frank 1951, *verified*) at low σ: a screw dislocation emits an endless step train; growth needs no 2D nucleation, proceeds at arbitrarily low σ, and the face looks **SMOOTH** (steps are unit-cell height, invisible). The rate law spans the whole σ range:
  > **R = C·σ²·tanh(σ₁/σ)** — parabolic (R∝σ²) at low σ, crossing to linear (R∝σ) at high σ.
  > (The step-spacing constant y₀ ≈ 19·ρc with ρc = aγ/(kT·σ) is a correct **standard textbook form** but the verifier could not re-derive the exact constant — *treat 19 as illustrative, not a hard-coded magnitude*.)
- **2D nucleation (birth-and-spread)** above a critical σ\*: islands nucleate faster than the spiral paves → **STEPPED/layered**.
  > **R ∝ σ^(5/6)·exp(−B/σ)** (the 5/6 exponent is the *standard* Hillig/Chernov form — verified as a literature form, not re-derived). The exponential threshold gives a clean gate. Below a finite σ there is a **dead zone** of no growth, sharpened by impurities.
- **Step bunching** is what makes steps **VISIBLE**: elementary steps merge into tall macrosteps via (a) **kinematic-wave shocks** (Frank 1958, *verified*) when step velocity falls with step density (traffic-jam analogy), or (b) **impurity pinning** (Cabrera–Vermilyea 1958, *verified*): steps bow between adsorbed pins of spacing d; growth needs σ > σ_dead ∝ aγ/(kT·d), leading steps stall, trailing catch up, bunch forms. **Caveat (load-bearing):** Ristić–DeYoreo–Chew 2008 (*verified*) shows CV rests on incomplete physics — macrostep-mediated recovery contradicts its elementary-step reactivation assumption. **σ_dead ∝ 1/d is calibratable, not exact** — never hard-code it as ground truth.
- **Transport limitation → SKELETAL/HOPPER**: the **Berg effect** (Berg 1938, *verified*) makes σ highest at edges/corners, lowest at stagnant face centers; above a critical σ the gradient self-amplifies (edges outrun centers → hopper), and at extreme limitation tips run away into dendrites (**Mullins–Sekerka** 1963, *verified*). Flow biases which face steps (up-current face sees fresher, higher-σ solution).

**The deliverable per-face decision rule** (a calibratable engineering distillation of the Sunagawa/Chernov σ-regime synthesis — *a design heuristic, not a quoted single-source equation*): compute `σ_face = σ_bulk − Δσ_transport(L, flow)`; then **SKELETAL** if transport-limited (large Berg gradient); else **STEPPED** if `σ_face > σ_2Dnuc` OR bunching index B high; else **SMOOTH** (spiral).

### 1.3 Polarity & anisotropy drivers (crystallographic vs environmental; what dominates in a vug)

There are **two physically distinct families** of reasons opposite ends/face-sets grow differently. **The science is emphatic they must not be conflated** — and this is the single most important design constraint in the proposal.

**(A) INTRINSIC crystallographic polarity.** Only the **10 polar point groups** — 1, 2, m, mm2, 3, 3m, 4, 4mm, 6, 6mm — possess a unique polar axis with structurally inequivalent +/− ends (these are exactly the pyroelectric classes; *verified*). Neumann's principle: a non-zero pyroelectric vector is allowed only in these 10. The **11 centrosymmetric** classes contain an inversion centre mapping +d → −d, so the two ends are symmetry-equivalent — **zero intrinsic polarity**. Textbook polar minerals: **tourmaline (3m)**, **hemimorphite (mm2, Imm2)**, **zincite/wurtzite ZnO (6mm)** — all three in the catalog. For these, +c and −c carry different forms, growth rates, etch rates, and opposite pyroelectric charge, *independent of environment*.

**(B) EXTRINSIC environmental anisotropy** — applies to **every** mineral in a cavity because the cavity breaks the environment's symmetry. Ranked by dominance for vug growth:

1. **Substrate occlusion (DOMINANT, universal).** A wall-nucleated crystal is sealed against the host over its attachment region; that interface is feed-starved and frozen (flux ≈ 0), while only the void-facing termination grows. This produces the singly-terminated drusy habit in **any** species, centrosymmetric or not — and typically **swamps intrinsic polarity in magnitude**. Modeled as a boundary condition, not a symmetry property.
2. **Geometric/evolutionary selection** ("survival of the fastest", van der Drift 1967, *verified*): in a druse of random nuclei, crystals whose fastest direction points into the void bury their neighbours → palisade/comb/columnar crusts. Aggregate-scale, symmetry-agnostic.
3. **Supersaturation/diffusion gradient** (Sunagawa; Berg): up-gradient faces grow and step-bunch faster; extreme gradients → hopper/skeletal.
4. **Gravity/convection/sedimentation** (*partial*): solutal Rayleigh convection modulates the σ field by orientation vs gravity — secondary, acts *through* the gradient term.

**Rank order to encode:** occlusion (universal, dominant) > geometric selection (aggregate) > σ/diffusion gradient (per-face stepping) > intrinsic polarity (only the ~10-class minerals) > gravity/convection (modulating).

**Audit items (raised by the science, actionable now):** quartz is class **32** — enantiomorphic, piezoelectric, **NOT polar** (no unique polar axis; three 2-folds). Its terminations differ for habit/occlusion reasons. The catalog must not flag quartz polar. A full point-group audit of the catalog against the 10-class list should precede any intrinsic-polarity flagging.

### 1.4 The calcite {104} case (the concrete deterministic feature; obtuse/acute step anisotropy + occlusion/gradient)

**Resolved cross-dimension point, stated plainly: calcite is centrosymmetric — point group −3m (3̄ 2/m), space group R-3c (No. 167), which contains an inversion centre** (confirmed across the package and independently via Materials Project mp-3953). **Therefore calcite's directional stepping in a vug is NOT crystal polarity.** It is the sum of environmental drivers + an *intrinsic surface-step anisotropy* — a different sense of "intrinsic" (a property of the face's Miller index on a centrosymmetric crystal, **not** a bulk polar axis). The engine must not collapse these into one "polar" flag.

The rigorous, citable basis for "steps run along one set of directions, not the other":

- The **(104) surface has twofold site symmetry** (lower than the crystal's threefold), so its monolayer steps split into **two non-equivalent counter-propagating families** along [481]/[441]-type PBC directions: an **ACUTE step (~78°, upper-terrace overhang)** and an **OBTUSE step (~102°)**. (The 78°/102° pair = the cleavage-rhomb diamond angle. Geometry confirmed across the AFM literature but **no single primary locus is pinned** — *anchor to De Yoreo–Vekilov RiMG 54, 2003, verified, or a Reeder review before this becomes load-bearing in code*.)
- The two families **propagate at different velocities** at the same σ, and the **anisotropy reverses with the Ca²⁺:CO₃²⁻ activity ratio** r: obtuse faster when Ca-rich (r>1), acute faster when CO₃-rich (r<1) — obtuse governed by Ca²⁺ hydration/attachment, acute by kink nucleation + dehydration (Teng–Dove 1998, 2000; Teng et al. 1998 *verified*). This makes directional **sense** a deterministic function of broth stoichiometry. **Caveat:** the *reversal* is cited; a **numerical ratio-vs-r curve is NOT pulled** — the "tilt knob" has no calibrated magnitude yet (open).
- Trace cations sort by radius into the non-equivalent sectors: **Mg²⁺ (small) → acute**, **Sr²⁺ (large) → obtuse**, K_eff differing up to **~4×** (Paquette–Reeder 1995, *verified*; intrasectoral-zoning concept = Paquette–Reeder 1990, *the package mis-dated this as "Reeder 1991" — corrected*).
- **Mg²⁺ inhibits calcite primarily THERMODYNAMICALLY** — incorporation raises solubility, lowering effective σ, widening terraces (Davis–Dove–De Yoreo 2000, *verified*). So Mg is a **σ_eff suppressor** wired through the existing Ksp(T)/pK(T) engine + the documented Mg elongation axis — distinct from the geometric obtuse/acute split.
- **Visible relief = macrostep bunching** (CV pinning, generalized by Ristić 2008 — *which is KDP/paracetamol, cite as MECHANISM only, not a calcite measurement*). Render coarse macrosteps, not monolayers.

**The environmental bridge (self-flagged SPECULATIVE / design synthesis):** for a vug calcite, directional relief should appear on **free-facing** faces exposed to the σ gradient while **attachment-occluded** faces stay smooth: `relief(face) ~ f(σ_face) · g(orientation of slow-step axis vs local feed gradient) · free_facing_mask`. **This rests on no direct specimen study** — per the project's terminal-verification-by-specimen norm, a real calcite specimen showing free-vs-attached macrostep contrast should be found before this ships as cited.

---

## 2. Architecture

### 2.1 Data-model change (smallest change that captures the mechanism)

The MVP adds **render-only tags** to `Crystal` (js/27), default null, written by a **pure post-growth classifier** (no rng, no fluid mutation), exactly mirroring `classifyDeformation`/`classifyEtch`/`classifySectorZoning` (45:552/590/726). `add_zone` keeps writing `total_growth_um`/`c_length_mm`/`a_width_mm` **unchanged** — engine math (volume/fill/chemistry) keeps reading the two scalars, so the baseline is byte-identical whether or not a crystal is tagged.

**Correcting the package's single-field proposal (critic-flagged, science-mandated):** the package proposed one `_polarRatio` scalar for *both* intrinsic polarity *and* substrate occlusion. **§1.3 forbids this conflation.** The two are split into distinct fields:

1. **`crystal._occlusion`** (extrinsic, **universal**) — the frozen-attached-end boundary condition. Minimal form: a single scalar or `{ attachedFraction }` giving how much of the −c (anchor) half is feed-starved/frozen. Applies to **all** wall-nucleated crystals regardless of point group. This is the **dominant** driver and gets its own home (the package never gave it one — critic gap closed).
2. **`crystal._polarAxis`** (intrinsic, **10-class only**) — `{ plusC_rate, minusC_rate }` or a single +c/−c ratio, set **only** for minerals whose point group ∈ {1,2,m,mm2,3,3m,4,4mm,6,6mm}. Zero for calcite, quartz-32, fluorite, pyrite, etc. A wall-nucleated tourmaline can now carry **both** `_occlusion` (buried base) AND `_polarAxis` (+c structurally faster) — stacking, which a single ratio could not express.
3. **`crystal._faceStep`** (directional stepping) — `{ steppedFaceSet, knots }`: the existing `morphTerraceKnots` list applied to an up-gradient face-SET, smooth on the opposite set. The only new datum vs today is the **per-face-set selector**.

No new `GrowthZone` field is required for the MVP — the existing per-zone `morph_regime` tags (27:125) feed the knot list; the new thing is the crystal-level face-set selector.

### 2.2 Minimal viable first tenant (one calcite scenario, byte-identical elsewhere)

**First tenant: calcite {104} directional macrostepping on `elmwood`** — already the stepped-golden-calcite showcase (project_vugg_calcite_morphology). This is the lowest-risk, most-citable choice **and it is decoupled from the polarity conflation** (calcite is not polar). Steps:

1. New pure classifier in `js/45` (mirror `classifySectorZoning`): for calcite crystals whose zone stack carries `stepped_macro` relief **AND** the scenario opted in (wall flag / event directive), stamp `_faceStep = { steppedFaceSet:'up', knots: <existing morphTerraceKnots output> }`. No rng, no fluid → byte-identical to everything not opted in.
2. Renderer (`js/99i`): a **directional-terrace variant** of `_makeTerracedCalciteGeom` (2367) that carves risers/treads on **only the up-gradient half** of the SEG=6 face ring (e.g. faces 0–2 stepped, 3–5 smooth), dispatched in the calcite terrace block (99i:3549) when `_faceStep` is present; fall back to the symmetric terrace otherwise. **Extend the cache sig (2713) with a face-set token** (the risk noted at 2708–2712 is exactly this class of stale-geometry bug).

**Honest fidelity caveat the proposal owns (critic gap):** the renderer applies a random per-crystal yaw `_crystalYaw` about c (99i:3910), so "faces 0–2" is crystallographically arbitrary and will **not correlate with any physical σ/flow gradient**. The MVP produces directional-*looking* relief without the directional *cause*. This is acceptable for a {104} aesthetic read, but the science says **which** faces step is set by the **world-frame** gradient — and the renderer/engine does not currently expose a world-direction feed vector to the classifier. If a scenario ever needs steps to face a real gravity/flow direction, that coupling must be **designed in, not assumed** (deferred to Phase 4).

### 2.3 Full central-distance path (the destination; renderer half-space→polyhedron)

The destination replaces the (c_length, a_width, habit-string) triple with a per-crystal **face set**: `crystal._faceSet = [{ normal:[x,y,z], d, regime }]`, one entry per form face (calcite rhomb = 6, scalenohedron = 12, cube = 6). The crystal is `⋂ᵢ {x : nᵢ·x ≤ dᵢ}`; each step adds Δdᵢ from that face's own driving force. **Polarity and directional stepping both fall out naturally** — unequal Δd across opposite normals, or different regime per normal. The MVP tags (`_occlusion`, `_polarAxis`, `_faceStep`) are a **forward-compatible low-dimensional projection** of the full face-set, so the full model subsumes them.

**Renderer:** compute half-space-intersection vertices (each vertex solves 3 face-plane equations, kept if it satisfies all other inequalities), feed surviving vertices to Three.js `ConvexGeometry`. O(faces³) but faces ≤ 24, trivial. Δdᵢ must be **deterministic** — derive from the per-(mineral,step) RNG stream (`_makeNucRng`/`_makeThermalRng` pattern, project_vugg_redox_census + canary keystone), never the shared rng. Validate with the canonical fixture: cube {100} + octahedron {111} at point group m3m, equal d → cuboctahedron; shrink {111} → cube; shrink {100} → octahedron (exercises symmetry expansion, distance-driven habit change, and face self-elimination in one test).

**The concavity gap (critic, high-priority decision before generalizing):** **neither the convex MVP nor the convex full-model (ConvexGeometry is convex-only) can represent hopper/skeletal/stepped-terrace concavity.** The Berg/transport regime (§1.2) is a *primary* high-σ class with named targets (hopper halite/bismuth, dendritic copper) that have **no geometric home** in either path. The concavity primitive must be decided **before** the stepped/skeletal class is generalized beyond calcite. Two options: **(a) nested convex shells** (replay-accumulating shells at successive g — the approach already used for calcite terraces here, the recommended general primitive), or **(b) a CSG/displacement layer** on the convex Wulff base. The convex body stays the base layer either way. **Recommendation: adopt (a) nested shells** — it reuses proven plumbing and matches the existing ziggurat render.

### 2.4 Byte-identical / flag-gating / determinism strategy

Four gating layers, all proven precedents in this codebase:

1. **Classifier-tag-driven, render-only by default.** The new tags live as crystal tags from a **pure** classifier (no rng, no fluid) — the saddle-dolomite / sector-zoning precedent. `gen-baseline` serializes only counts + sizes, which are **left unchanged**, so the baseline is byte-identical whether or not a crystal is tagged. **SIM-neutral render additions need no SIM bump and no rebake.**
2. **Flag-gated opt-in.** The classifier fires only for a mineral on a scenario declaring a wall flag (`wall.directional_steps`, later `wall.polar_growth`, `wall.occlusion`) or an event directive recorded in `apply_events` (mirror `_deformationEvents`/`_etchEvents`). All 37 scenarios untouched until one opts in.
3. **Engine-affecting only if a scenario chooses.** If a tenant ever needs the split to change volume/fill/chemistry (full model), that scenario alone gets a SIM bump + single-scenario rebake (the per-scenario commit pattern). The MVP keeps engine math on the unchanged scalars → stays in layer-1 byte-identity.
4. **Aspect-ratio rename firewall.** Any new habit string MUST route through `_habitAspectRatio` (js/27:33) carrying its parent form's **exact** ratio (verified keystone at 27:39–73) so a rename cannot move `_volume_mm3 → a_width → vugFill → chemistry`.

**Determinism is the highest-probability footgun:** any engine-affecting variant must stay rng-free (pure tagging) OR use the per-(mineral,step) derived stream — drawing from the shared rng displaces every downstream draw and rebakes the whole fleet. **Verification:** `tools/cold-ci.mjs` must be GREEN with zero diff after the infra commit; the vugg-canary nightly sweep confirms longitudinally. Only after a scenario opts in does a baseline legitimately move.

### 2.5 Reuse of existing plumbing

The genuinely new code is small; the rest is forking proven infrastructure:

- **Terrace replay:** `morphTerraceKnots` (45:416) → `calciteTerraceBands` (52:65) → `_getTerracedCalciteGeom` cache (99i:2706) — already produces accumulating, replay-truncated, cache-busted relief. The face-set variant is a fork.
- **Classifier-overprint pattern:** `classifyDeformation`/`classifyEtch`/`classifySectorZoning` (45:552/590/726) — pure, idempotent, byte-identical. The new classifiers copy this shape.
- **Mesh builders to fork:** `_makeTerracedCalciteGeom` (2367), `_makeTerracedCubeGeom` (2484); `_makeScalenohedron` (1284)/`_makeRhombohedron` as base envelopes. **Non-symmetric single-crystal precedents already dispatched:** `_makeBentPrism` (1111), `_makeSaddleRhomb` (1232), `_makeGwindelGeom` — the polar-scale path joins these.
- **Geometry cache + sig invalidation** (99i:2700–2721) — extend the sig with a face-set/polar token; disposal/bounding reused verbatim.
- **Event-directive plumbing:** `apply_events → sim._deformationEvents/_etchEvents` (recorded with firing step) — template for the opt-in directives, including the `replayStep >= atStep` gate (99i:3525/3541/3596) so a tagged crystal does not appear directional/polar before its directive fires.
- **Wall-flag pattern:** `VugWall`/`WallState` one-line boolean gates (22:243–278: `thermal_pulses`, `graphitic`, `open_system`, `alpine_cleft`) — the new flags mirror these.

---

## 3. Staged plan (phases, each shippable, with the no-regression gate)

| Phase | Deliverable | Engine touch | No-regression gate |
|---|---|---|---|
| **0 — Infra (SIM-neutral)** | `_occlusion`, `_polarAxis`, `_faceStep` fields (default null) + the pure classifiers in js/45 + cache-sig extension. No scenario opts in. | js/27 (fields), js/45 (classifiers), js/99i (cache sig only) | `cold-ci.mjs` **zero diff**; no SIM bump. Canary green. |
| **1 — First tenant: calcite {104} directional stepping** | `elmwood` opts in via `wall.directional_steps`; one-sided ring-carve in a `_makeTerracedCalciteGeom` variant. **Anchor 78°/102° geometry to RiMG 54 first.** Acknowledge yaw-vs-world-gradient coupling in comments. | js/52 (grow_calcite flag write), js/99i (directional terrace builder), scenarios.json5 + js/85d | All 36 non-elmwood scenarios byte-identical; elmwood is render-only (counts/sizes unchanged) → **no SIM bump**. Probe `polar-growth-observe.mjs` (jsdom can't see 3D). |
| **2 — Substrate occlusion (universal extrinsic)** | `_occlusion` boundary condition: render the buried −c half / single termination for opted-in drusy scenarios. The DOMINANT driver, finally homed. | js/99i (split cLen into up/down display halves by attachedFraction; shift the base offset) | Render-only display split → byte-identical if engine math stays on c_length_mm. Watch the offset math (risk). |
| **3 — Intrinsic polarity (the real polar tenants)** | `_polarAxis` for **hemimorphite (Imm2)**, then **tourmaline (3m)**, **wurtzite (6mm)**, **greenockite (6mm)** — all verified present (catalog audit DONE, see Provenance; quartz cleared). Several already declare hemimorphic habit variants that today render symmetrically — this makes them true. Stacks with Phase-2 occlusion. | js/99i (asymmetric +c/−c scale) | Render-only → byte-identical until a scenario opts a polar mineral in. Specimen check per species. |
| **4 — Full central-distance model** | `_faceSet` + half-space intersection → `ConvexGeometry`; per-face Δd from derived RNG stream. **Decide concavity primitive (nested shells) before generalizing stepped/skeletal.** Wire world-frame gradient → face selection. | Replaces the symmetric-scale path for opted-in crystals; js/27 engine math may change per scenario | Cube+octahedron fixture test; per-opting-scenario SIM bump + single-scenario rebake. Degenerate/empty-polyhedron clamp → fallback to symmetric primitive. |

Each phase is independently shippable. Phases 0–3 are render-only and byte-identical; only Phase 4 touches engine math, and then only per opting scenario.

---

## 4. Open questions & risks

**Open questions (must-resolve before the dependent phase):**
- **Concavity primitive (Phase 4 blocker).** Nested convex shells (recommended) vs CSG/displacement. Hopper/skeletal has no home until decided.
- **Numerical obtuse/acute ratio-vs-r curve (Phase 1 calibration).** The *reversal* is cited (Teng/Dove); the *magnitude* is not pulled. The Ca:CO₃ tilt knob is uncalibrated — until then the directional sense is hard-coded, losing the cited determinism. Pull from Teng & Dove 2000 + the "reversed calcite morphologies" paper before hard-coding.
- **Is a(Ca):a(CO₃) computable from existing fields?** `FluidChemistry` tracks Ca and CO₃, but the package never confirms an *activity ratio* is derivable, nor that a per-face σ exists (today: one σ per crystal). The cited sense-flip depends on this being real.
- **Per-mineral thresholds (general stepping).** σ_2Dnuc, step-edge γ, Δσ_transport coefficients "are rarely tabulated for vugg's species." The general smooth/stepped/skeletal classifier is a **calibration project per mineral** (match the CALCITE_MORPH_TH registry pattern), **not** first-principles deployable. Scope it as hand-tuned-per-species, not physics-derived.
- **Catalog point-group audit — DONE 2026-06-22** (see Provenance). FOUR polar tenants present: hemimorphite (Imm2), wurtzite (P6₃mc), tourmaline (3m), **greenockite (6mm)** — the research named three; the audit found the fourth. Quartz-32 is **not** mislabelled (correctly enantiomorphic). Point group is stored as **prose in `description`** — a structured `point_group` field is the clean enabler for Phase 3 and should be added with it.
- **van der Drift aggregate selection.** Palisade/comb/columnar druse linings (2nd-strongest driver) have **zero engine mapping** — the proposal is single-crystal throughout. Acknowledged as out of MVP scope; a future aggregate-fabric mechanism.
- **Dissolution morphology.** Representation says dissolution does NOT reverse growth-rate order — needs a separate R_dissolve profile. Unreconciled against the existing `classifyEtch` / σ<1 resorption proxy. Out of scope unless etch morphology must be geometrically real on the new model.

**Risks (engineering):**
- **RNG cascade** (highest probability) — see §2.4. Pure tagging or derived stream only.
- **Aspect-ratio firewall** — any new habit string not routed through `_habitAspectRatio` silently rebakes the fleet.
- **Polar volume bookkeeping** — keep MVP polar/occlusion render-only; if `_polarRatio`/`_occlusion` ever feeds `_volume_mm3`, `get_vug_fill` drifts → chemistry drift.
- **Cache-sig completeness** — extend the terrace sig with face-set/polar params or serve stale geometry (the latent 2708–2712 class).
- **Replay correctness** — directional/polar geometry must accumulate under the scrubber and respect the per-event firing step.
- **ConvexGeometry robustness** — degenerate/empty polyhedra from inconsistent face distances; needs a clamp + symmetric-primitive fallback.
- **Orientation coupling** — `_crystalYaw` vs world-frame gradient (§2.2); fine for {104} aesthetic, must be designed for any gravity/flow-directed scenario.

**Load-bearing claims still needing confirmation (do not cite as exact in code until checked):**
- BCF constant y₀ ≈ 19·ρc and 2D-nuc exponent σ^(5/6) — correct *standard forms*, not re-derived; confirm against Markov/Chernov before any code comment quotes them.
- Calcite (104) 78°/102° geometry — confirmed across literature, **no single primary locus**; anchor to De Yoreo–Vekilov RiMG 54 (2003) or a Reeder review.
- The vug occlusion + σ-gradient asymmetry (the MVP's one-sided-carve premise) — **self-flagged speculative**, no direct specimen study; per the terminal-verification norm, find a real calcite specimen showing free-vs-attached macrostep contrast before shipping it as cited.

---

## 5. References (only verified/partial, formatted; mark any 'unconfirmed')

**Representation:**
- Wulff, G. (1901). *Zur Frage der Geschwindigkeit des Wachsthums und der Auflösung der Krystallflächen.* Z. Kristallogr. Mineral. 34, 449–530. DOI 10.1524/zkri.1901.34.1.449. **[verified]**
- Steno (N. Stensen), N. (1669). *De solido intra solidum naturaliter contento dissertationis prodromus.* Florence. **[verified — page-level locus approximate]**
- Donnay, J.D.H. & Harker, D. (1937). *A new law of crystal morphology extending the Law of Bravais.* Am. Mineral. 22(5), 446–467. **[verified]**
- Hartman, P. & Perdok, W.G. (1955). *On the relations between structure and morphology of crystals. I/II/III.* Acta Cryst. 8, 49–52; 521–524; 525–529. **[verified]**
- Hartman, P. & Bennema, P. (1980). *The attachment energy as a habit controlling factor. I.* J. Cryst. Growth 49(1), 145–156. **[verified]**
- Hartman, P. (1980). *The attachment energy as a habit controlling factor. III. Corundum.* J. Cryst. Growth 49(1), 166–170. **[verified — distinct from the 1955 Part III]**
- Bravais, A. (1866). *Études cristallographiques.* Gauthier-Villars, Paris. **[verified]**
- Friedel, G. (1907). *Études sur la loi de Bravais.* Bull. Soc. fr. Minéral. 30, 326–455. **[verified]**
- Dowty, E. (1980). *Computing and drawing crystal shapes.* Am. Mineral. 65, 465–**471** (cited as 472 — off-by-one). **[partial]**
- Kaminsky, W. (2005). *WinXMorph…* J. Appl. Cryst. 38, 566–567; **and** Kaminsky, W. (2007). *From CIF to virtual morphology using the WinXMorph program.* J. Appl. Cryst. 40, 382–385. **[partial — original cite spliced the 2005 title onto the 2007 locus]**
- Sunagawa, I. (2005). *Crystals: Growth, Morphology and Perfection.* Cambridge Univ. Press. ISBN 0-521-84189-5. **[verified]**
- Sunagawa, I. (ed.) (1987). *Morphology of Crystals, Part A.* Terra Scientific / D. Reidel. [Hartman contributed the modern-PBC chapter, ~pp. 269–319.] **[partial — original cite mis-attributed editorship to Hartman]**

**Kinetics:**
- Burton, W.K., Cabrera, N. & Frank, F.C. (1951). *The growth of crystals and the equilibrium structure of their surfaces.* Phil. Trans. R. Soc. A 243(866), 299–358. DOI 10.1098/rsta.1951.0006. **[verified — the y₀≈19·ρc constant unconfirmed against primary text]**
- Cabrera, N. & Vermilyea, D.A. (1958). *The growth of crystals from solution.* In *Growth and Perfection of Crystals*, Wiley, pp. 393–410. **[verified]**
- Frank, F.C. (1958). *On the kinematic theory of crystal growth and dissolution processes.* Same volume, pp. 411–419. **[verified]**
- Berg, W.F. (1938). *Crystal growth from solutions.* Proc. R. Soc. Lond. A 164(916), 79–95. DOI 10.1098/rspa.1938.0006. **[verified]**
- Chernov, A.A. (1984). *Modern Crystallography III: Crystal Growth.* Springer SSSS vol. 36. **[verified — R∝σ^(5/6)exp(−B/σ) is the standard form, locus not pin-checked]**
- Mullins, W.W. & Sekerka, R.F. (1963). *Morphological stability of a particle growing by diffusion or heat flow.* J. Appl. Phys. 34(2), 323–329. DOI 10.1063/1.1702607. **[verified]**
- Vekilov, P.G. (2007). *What determines the rate of growth of crystals from solution?* Cryst. Growth Des. 7(12), 2796–2810. DOI 10.1021/cg070427i. **[verified]**
- Ristić, R.I., DeYoreo, J.J. & Chew, C.M. (2008). *Does impurity-induced step-bunching invalidate key assumptions of the Cabrera–Vermilyea model?* Cryst. Growth Des. 8(4), 1119–1122. DOI 10.1021/cg7010474. **[verified — KDP/paracetamol; cite as bunching MECHANISM, not calcite]**

**Polarity & anisotropy:**
- Hahn, T. (ed.). *International Tables for Crystallography, Vol. A*, Ch. 3.2 "Point Groups and Crystal Classes." IUCr/Wiley. **[verified]**
- van der Drift, A. (1967). *Evolutionary Selection, A Principle Governing Growth Orientation in Vapour-Deposited Layers.* Philips Research Reports 22, 267–288. **[verified]**
- "Polar point group" — the 10 polar = pyroelectric classes {1,2,m,mm2,3,3m,4,4mm,6,6mm}. **[verified, corroborated by standard tables]**
- Hawthorne, F.C. & Dirlam, D.M. (2011). *Tourmaline the Indicator Mineral.* Elements 7(5), 307–312. DOI 10.2113/gselements.7.5.307. **[verified — "+c faster" is the standard simplification; sign/magnitude condition-dependent]**
- Yang, P. & Rivers, T. (2002). *Compositional asymmetry in replacement tourmaline — Tauern Window.* Geological Materials Research 4(2), MSA. **[partial — supports compositional core-rim asymmetry, NOT a "+c preferential-nucleation" growth law; original cite mis-named the journal]**
- Calcite CaCO₃, space group R-3c (No. 167), point group −3m, centrosymmetric. **[verified — Materials Project mp-3953 + standard refs]**
- ZnO wurtzite (6mm): Zn-(0001)/O-(000̄1) polar faces with different etch rates (O-polar ~3.8 µm/min in acid). **[verified]**
- Nesse, W.D., *Introduction to Mineralogy* (OUP); Klein, C. & Dutrow, B., *Manual of Mineral Science* (Wiley). **[verified — general textbook grounding]**
- Solutal (Rayleigh) natural-convection crystal-growth literature. **[partial — science sound; the specific article locus S0022024898011660 unconfirmed]**

**Calcite {104}:**
- Paquette, J. & Reeder, R.J. (1995). *Relationship between surface structure, growth mechanism, and trace element incorporation in calcite.* GCA 59(4), 735–749. **[verified]**
- Reeder, R.J. & Paquette, J. (1989). *Sector zoning in natural and synthetic calcites.* Sedimentary Geology; **and** Paquette, J. & Reeder, R.J. (1990). *New type of compositional zoning in calcite.* Geology 18, 1244. **[corrected from the original "Reeder 1991" mis-dating]**
- Teng, H.H., Dove, P.M., Orme, C.A. & De Yoreo, J.J. (1998). *Thermodynamics of calcite growth…* Science 282(5389), 724–727. **[verified]**
- Teng, H.H., Dove, P.M. & De Yoreo, J.J. (2000). *Kinetics of calcite growth…* GCA 64(13), 2255–2266. **[verified]**
- Davis, K.J., Dove, P.M. & De Yoreo, J.J. (2000). *The role of Mg²⁺ as an impurity in calcite growth.* Science 290(5494), 1134–1137. **[verified]**
- De Yoreo, J.J. & Vekilov, P.G. (2003). *Principles of crystal nucleation and growth.* Rev. Mineral. Geochem. 54, 57–93. DOI 10.2113/0540057. **[verified — recommended anchor for the {104} step framework]**
- *Calcite (104) acute ~78° / obtuse ~102° step geometry, twofold surface symmetry, [481]/[441] step directions* — **[unconfirmed primary locus: confirmed across the AFM literature but no single source pinned; anchor to De Yoreo–Vekilov RiMG 54 or a Reeder review before use in code]**.
- *Numerical obtuse/acute velocity ratio as f(r = a(Ca²⁺)/a(CO₃²⁻))* — **[unconfirmed: the reversal is cited (Teng/Dove); a calibrated ratio-vs-r curve has NOT been pulled]**.
- *Vug occlusion + σ-gradient free-vs-attached macrostep asymmetry* — **[unconfirmed / speculative design synthesis; no direct specimen or experimental study]**.

---

## 6. Recommended first step

**Ship Phase 0 (infra) as a single byte-identical commit, then Phase 1 (calcite {104} directional stepping on elmwood) as the first tenant — and nothing polar yet.**

Concretely, the first PR:
1. Add the three null-default fields to `Crystal` (js/27), keeping `_occlusion` and `_polarAxis` **distinct** (correcting the package's conflated `_polarRatio`).
2. Add the pure `classifyFaceStep` classifier in js/45 (mirror `classifySectorZoning`), rng-free.
3. Extend the terrace cache sig (99i:2713) with a face-set token.
4. **Before writing the carve:** anchor the 78°/102° step geometry to De Yoreo–Vekilov RiMG 54 (2003) in a code comment, and add a comment owning the `_crystalYaw`-vs-world-gradient fidelity caveat.
5. Verify `cold-ci.mjs` is **green with zero diff** and canary is clean — this proves the infra is byte-identical across all 37 scenarios.

Only after that green gate, the second PR opts `elmwood` in via `wall.directional_steps` and adds the one-sided ring-carve. This sequences content on stable infra (refactor-vs-content principle), keeps the first ship small and citable, and **defers the two things the science says are hard**: the polarity/occlusion split (Phases 2–3, gated on the catalog point-group audit) and the concavity primitive (Phase 4, gated on the nested-shell decision). The calcite-{104} MVP is sound, low-risk, and stands alone — exactly the foundational first cut a scalar→per-face shift should begin with.