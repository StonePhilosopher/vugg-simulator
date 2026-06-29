# DESIGN PASS — Phase 4: the full per-face central-distance (Wulff) model (2026-06-28)

**This is the design pass + greenlight document the central-distance arc parked Phase 4 behind.** The science is settled in `PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md` (§1.1 representation, §2.3 destination, §3 staging table row 4, §4 open questions); the occlusion handoff (`HANDOFF-OCCLUSION-2026-06-26.md`) names Phase 4 "the arc's destination / Big lift" and says it *needs a design pass + greenlight first*. This doc resolves the six open decisions that gate the lift, grounded in the live code, and decomposes Phase 4 into byte-identical shippable rungs.

The proposal already did the hard science. This pass answers the engineering questions it deferred: **how the polyhedron renders, where the crystallography data lives, and how to ship the first rung without a rebake.**

---

## What Phase 4 is (one paragraph)

Replace the `(c_length_mm, a_width_mm, habit-string)` triple — which renders every crystal as a symmetric primitive scaled `(aWid, cLen, aWid)` — with a per-crystal **face set** `[{ normal:[x,y,z], d }]`, one entry per crystallographic form face. The crystal is the bounded convex polyhedron **P = ⋂ᵢ { x : nᵢ·x ≤ dᵢ }**. Face *normals* are fixed by the point group + form indices (Steno's law — constant interfacial angles); only the *central distances dᵢ* are dynamic, advancing `dᵢ(g) = dᵢ⁰ + g·Rᵢ` with the scenario's scalar growth `g`. Habit emerges from the *relative* rates {Rᵢ} ("slow faces win"): equal d → cuboctahedron, shrink {111} → cube, shrink {100} → octahedron — a real distance-driven habit transition the habit-token path cannot express. The MVP tags already shipped (`_occlusion`, `_polarAxis`, `_faceStep`) are a forward-compatible low-dimensional projection of this face set, so the full model subsumes them.

---

## The greenlight asks (decisions in this doc)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Concavity primitive (the proposal's flagged blocker) | **Nested convex shells** — confirm the proposal's rec; convex body is the base layer; concavity deferred until stepped/skeletal generalizes (not needed by the convex tenants) |
| D2 | Polyhedron rendering method | **Direct triple-plane half-space intersection → hand-rolled `BufferGeometry`. NO `ConvexGeometry` / new Three.js dependency.** |
| D3 | Crystallography data home | **Curated `FORM_GEOMETRY` registry** (per-tenant point-group operators + forms {hkl} + BFDH rates), normals computed from the existing `data/structural.json` cell metric |
| D4 | Growth law + determinism | **`dᵢ(g)=dᵢ⁰+g·Rᵢ`, fixed Rᵢ + golden-ratio per-crystal hash → fully rng-free** (purer than the proposal's "derived stream"; matches occlusion/polarAxis) |
| D5 | Render-only vs engine-coupled staging | **Phase 4a render-only** (Wulff mesh scaled into the existing `c_length_mm × a_width_mm` envelope → byte-identical, NO rebake, NO SIM bump). **Phase 4b engine-coupled** (accurate volume → vugFill) is a separate later per-scenario step, only if a scenario needs it |
| D6 | First tenant | **fluorite** (cubic m3m, forms {100}+{111}) — the textbook cube↔octahedron transition we already drive by REE/Y — after the cube+octahedron fixture test validates the kernel |

The only rung that produces a visible change (and so wants the boss's eyes) is **4a.1, the first tenant opt-in**. Everything before it (the kernel + the fixture test) is pure byte-identical infra in the Phase-0 lane and is pre-authorized by the arc's discipline — I build that without waiting.

> **UPDATE 2026-06-28 — 4a.0 + 4a.1 SHIPPED (still SIM 214, byte-identical, no rebake).** 4a.0 kernel `js/46-wulff-geometry.ts` + `tests-js/wulff-geometry.test.ts` (14 pins) committed `52e62d1`. **4a.1 fluorite tenant SHIPPED:** `js/45 classifyWulffForm` (opt-in gate on `wall.wulff_fluorite`, rng-free crystal-id hash, byte-identical tag) + `js/85` call + `js/99i` dispatch (gated on the cube/octahedron tokens + !geom; **token unchanged → the existing isometric scale path is untouched → calibration baseline unmoved**, the byte-identity proof) + `js/22` whitelist + `js/27` tag doc + `tests-js/wulff-form.test.ts` (8 pins). **Tenant = sunnyside_american_tunnel** (Bosze & Rakovan already cited). **Aesthetic resolution (the boss-eye gate, eye-checked in the live preview):** the d-formula seed was retuned 0.30→0.05 (span →1.0) so the rate ratio drives the form; sunnyside's Y-rich octahedral fluorite maps to **biasC 0.41 — an octahedron with small {100} truncations** (band [0.32,0.52]), NOT a perfect {111}-only octahedron — both more faithful (a Y-stabilized fluorite is octahedron-*dominant*, {100} reduced not absent) and visibly distinct from the old `OctahedronGeometry` primitive (a perfect octahedron would be byte-AND-pixel-identical, wasting the kernel). The before/after + a full octahedron→cube form-vocabulary strip were rendered in the live app for sign-off.

---

## Decisions, resolved

### D1 — Concavity primitive: nested convex shells (confirm)

The proposal flags (§2.3) that **neither the convex MVP nor a convex Wulff body can represent hopper/skeletal concavity** (ConvexGeometry is convex-only), and that the primitive must be decided *before* the stepped/skeletal class generalizes beyond calcite. Two options: (a) nested convex shells — replay-accumulating shells at successive g, the approach already proven for the calcite terraces (`_makeTerracedCalciteGeom`, 99i:2480) — or (b) a CSG/displacement layer.

**Decision: adopt (a) nested convex shells, as recommended.** Rationale:
- It reuses proven plumbing — the calcite ziggurat terrace render (99i:2480, 2608) is already a nested-shell concavity primitive; the Wulff body simply becomes the per-shell envelope instead of a stretched rhomb.
- It is *decision-independent for the convex base layer*: the convex Wulff body is the base layer either way (proposal §2.3), and **none of the first tenants (cube/octahedron fluorite, calcite rhomb/scalenohedron) are concave** — so the concavity primitive does not block any rung I'm proposing to ship. It's confirmed now so the later stepped/skeletal generalization inherits a decided primitive, but it is not on the 4a critical path.

CSG (option b) is rejected: no CSG layer exists in the bundle, it would add a heavy dependency, and it does not match the existing nested-shell render the codebase already ships.

### D2 — Rendering: direct triple-plane, no ConvexGeometry

`ConvexGeometry` (Three.js examples) is **not imported anywhere in the bundle** (verified — grep for `ConvexGeometry|ConvexHull` across `js/` is empty; the renderer builds every solid by hand). It would require pulling `ConvexGeometry` + `ConvexHull` from `three/examples/jsm`, a new dependency in a hand-rolled-geometry codebase.

The proposal's *direct (triple-plane)* method is "trivially correct for the ≤~24 faces a crystal has" (§1.1). It needs no library:

1. For each unordered triple of face planes (i,j,k), solve the 3×3 system `[nᵢ;nⱼ;nₖ]·v = [dᵢ;dⱼ;dₖ]` (skip near-singular triples by determinant threshold).
2. Keep `v` only if it satisfies `nₗ·v ≤ dₗ + ε` for **all** planes l (it's a real polyhedron vertex).
3. Group surviving vertices by the planes they lie on → one polygon per face; angle-sort each face's vertices about the face normal; fan-triangulate.
4. Emit the triangles through the existing `_pushTri` → `new THREE.BufferGeometry()` → `Float32BufferAttribute` → `computeVertexNormals()` idiom (the exact shape of `_makeRhombohedron` 99i:1194, `_makeScalenohedron` 1297, `_makeSaddleRhomb` 1245).

`O(faces³)` triple solves with `faces ≤ 24` ≈ ≤2024 solves — negligible, and cached per `(mineral, form-distance signature)` exactly like `_getTerracedCalciteGeom` (99i:2947). **A grown-out face contributes no vertices automatically** — no special-casing. This is the same hand-rolled, deterministic, dependency-free approach as every sibling builder.

**Robustness (proposal §4 risk):** degenerate / empty polyhedra (inconsistent distances, fewer than 4 surviving vertices) **clamp to the symmetric-primitive fallback** — the builder returns `null` and the dispatch falls through to today's habit-token primitive. No render path can crash on a bad face set.

### D3 — Crystallography data: a curated `FORM_GEOMETRY` registry over `structural.json`

Phase 4 needs, per tenant mineral: a point group (→ symmetry operators), a set of forms {hkl} with relative rates Rᵢ, and the cell metric (→ real-space normals). Today `dominant_forms` is **prose** ("rhombohedron", "scalenohedron"), not Miller indices, and there is no structured `point_group` field (the proposal calls one "the clean enabler").

**Decision: a curated `FORM_GEOMETRY` registry** (new, mirrors the `CALCITE_MORPH_TH` / `MINERAL_GATES` per-tenant pattern — encode what we use, not a universal-first 32-point-group engine):

```
FORM_GEOMETRY = {
  fluorite: { system:'cubic', forms:[ {hkl:[1,0,0], R:1.0}, {hkl:[1,1,1], R:1.7} ] },
  calcite:  { system:'hex-R', forms:[ {hkl:[1,0,4], R:1.0}, /* scalenohedron */ {hkl:[2,1,1], R:1.4} ] },
  ...
}
```

- **Normals** come from the cell metric already in `data/structural.json` (verified present: `fluorite` Fm-3m a=5.4626; `galena` Fm-3m a=5.9362; `calcite` R-3c a=4.99 c=17.06; `quartz` P3_121 a=4.913 c=5.405). For **cubic** tenants no metric is needed — the system is isotropic, so {100} normals are the ±axes and {111} are (±1±1±1)/√3 directly. For **rhombohedral/hexagonal** calcite the hexagonal reciprocal metric `n_hkl ∝ h·a* + k·b* + l·c*` (|a*|=2/(a√3), |c*|=1/c, a*–b* at 120°) gives the correct {104} interfacial angle from a/c. So **start cubic (metric-free), add the hex-R metric helper with the calcite rung.**
- **Symmetry operators**: encode the operator sets we actually use — the cubic m3m set (24 rotations × inversion → 48, but the form orbit only needs the proper rotation subgroup to enumerate the 6/8 faces) first; the −3m set with the calcite rung. Not a general 32-group machine — curated, like every other registry in this codebase.
- **BFDH-seed rates** Rᵢ ∝ 1/d_hkl come straight from the cell: `d_hkl = a/√(h²+k²+l²)` (cubic) → d_100=a, d_111=a/√3, so cube faces are more important (slower, larger) than octahedron faces — which is why fluorite defaults to cubes. Real Rᵢ values are hand-tuned per tenant against the specimen record (the established calibration-registry pattern), seeded by BFDH.

A structured `point_group` field on `minerals.json` (proposal §4) is the clean long-term enabler and can be backfilled as tenants are added; the registry does not block on it.

### D4 — Growth law + determinism: fully rng-free

`dᵢ(g) = dᵢ⁰ + g·Rᵢ`. The scalar growth `g` is the **already-tracked `total_growth_um`** (js/27:206) — no new engine field. With Rᵢ **fixed** per mineral (the registry above), the face set is a pure deterministic function of `(mineral, total_growth_um)`. Per-crystal natural variation (one fluorite blockier than its neighbour) comes from a **golden-ratio hash of `crystal_id`** nudging the {111}:{100} rate ratio — the exact rng-free pattern `classifyOcclusion` uses (`h = ((id*0.618…)%1+1)%1`).

**This is purer than the proposal's "derive Δd from the per-(mineral,step) RNG stream."** A derived stream is only needed for *stochastic per-step* face advance, which the MVP does not want. Fixed-rate + id-hash means **zero rng draws → zero cascade risk → trivially byte-identical**, the same guarantee the rest of the arc runs on. (If a future rung wants stochastic facet roughening, *then* it takes the derived stream — not before.)

### D5 — Render-only first (the key de-risking call)

The proposal's Phase 4 table row says engine math "may change per scenario" + "per-opting-scenario SIM bump + single-scenario rebake." That is true for **accurate-volume** Wulff (the polyhedron's real volume differs from the ellipsoid the engine integrates, so `_volume_mm3 → a_width_mm → get_vug_fill → chemistry` would drift). But it is **not required for the first ship.**

**Decision: split Phase 4 into 4a (render-only) and 4b (engine-coupled).**

- **Phase 4a — render-only, byte-identical, NO rebake.** The face set drives the *visible mesh only*. The mesh is scaled to fit the existing `c_length_mm × a_width_mm` envelope (the Wulff body is computed in normalized units, then scaled like every other primitive at the `mesh.scale.set(aWid, cLen, aWid)` site). Engine math (`add_zone`, `_volume_mm3`, `get_vug_fill`, chemistry) keeps reading the **unchanged scalars** — exactly the layer-1 byte-identity of Phases 0–3 (proposal §2.4). The seed-42 baseline never moves; cold-ci stays green with zero diff; no SIM bump. **This is the rung that ships the visible win — real cube↔octahedron fluorite — for free of a rebake.**
- **Phase 4b — engine-coupled, per-scenario rebake.** *Only if* a scenario needs the polyhedron's true volume to drive fill/chemistry. That scenario alone gets the `_volume_mm3`-from-polyhedron change + SIM bump + single-scenario rebake (the per-scenario commit pattern). Deferred until a tenant demonstrably needs it — most won't, because the envelope-scaled mesh already looks right.

This staging is the whole point of the design pass: it lets the "big lift" deliver its most visible payoff under the same no-rebake discipline the arc has used for every phase, and quarantines the rebake-bearing change to a later, opt-in, single-scenario step.

### D6 — First tenant: fluorite (after the fixture)

The canonical validation **fixture** (proposal §2.3) is cube {100} + octahedron {111} at m3m: equal d → cuboctahedron; shrink {111} → cube; shrink {100} → octahedron. This is a *unit test*, not a scenario — it exercises symmetry expansion, distance-driven habit change, and face self-elimination in one go, with no scenario opting in (trivially byte-identical).

The first *scenario* tenant is **fluorite**: cubic m3m, forms {100}+{111}, the textbook cube↔octahedron mineral, and **we already dispatch its octahedral-vs-cubic habit by REE/Y** (the calcite-morphology arc's `octahedral_REE` family, js/27:69–73). Wiring fluorite through the Wulff kernel turns that token dispatch into a *true* distance-driven cubo-octahedral transition. Candidate scenarios that already grow fluorite: `sunnyside_american_tunnel` (REE-octahedral fluorite), `gem_pegmatite`, `elmwood`. Pick one at the 4a.1 checkpoint with the boss.

---

## Decomposition (each rung shippable; 4a byte-identical throughout)

| Rung | Deliverable | Opts in? | Gate |
|---|---|---|---|
| **4a.0 — geometry kernel + fixture** | `js/` Wulff kernel: `formNormals(reg, cell)` (symmetry-expand forms → world normals), `wulffVertices(faces)` (triple-plane intersection + interior test + face grouping), `_makeWulffGeom(faceSet)` (→ BufferGeometry via `_pushTri`). Cube+octahedron unit test (cuboctahedron / cube / octahedron / degenerate-clamp). **Nothing opts in.** | No | cold-ci zero diff (trivially — no dispatch reads it yet); fixture test green. **← building now** |
| **4a.1 — first tenant: fluorite** | `FORM_GEOMETRY.fluorite`; dispatch `_makeWulffGeom` when a crystal is fluorite on an opted-in scenario, scaled into the `(aWid,cLen,aWid)` envelope; cache-sig extension (mirror 99i:2947); REE/Y → {111}:{100} rate bias. One scenario opts in via a `wall.*` flag. | Yes (1 scenario) | All other scenarios byte-identical; opted scenario render-only (counts/sizes unchanged → no SIM bump). **← greenlight + boss aesthetic check** |
| **4a.2 — calcite via Wulff** | hex-R metric helper; `FORM_GEOMETRY.calcite` {104}+scalenohedron; subsume `_makeRhombohedron`/`_makeScalenohedron` under the distance-driven kernel (rhomb when {104} wins, dogtooth when the scalenohedron wins). | Yes | byte-identical (render-only); fixture + calcite-angle test |
| **4b — engine-coupled (deferred)** | polyhedron-true `_volume_mm3` for a scenario that needs accurate fill; SIM bump + single-scenario rebake. | Per scenario | per-scenario baseline moves legitimately |

---

## Gates & risks (all have proven precedents)

- **Byte-identity (4a):** render-only tag → mesh; engine math stays on the scalars. cold-ci zero-diff is the gate, the vugg-canary nightly sweep confirms longitudinally. (proposal §2.4 layer-1.)
- **Determinism:** rng-free (D4) — no cascade risk at all.
- **Cache-sig completeness:** extend the geometry cache signature with the face-distance signature (the latent stale-geometry class at 99i:2947 / the proposal's 2708–2712 note).
- **Degenerate polyhedron:** <4 vertices or empty interior → return `null` → symmetric-primitive fallback (D2). A unit-test case.
- **Aspect-ratio firewall:** 4a never introduces a new habit *string* into the engine path — the Wulff dispatch is render-side only; `_habitAspectRatio` (js/27:33) is untouched, so no rename can move volume/fill/chemistry.
- **Replay correctness:** the face set is a pure function of `total_growth_um`, which the scrubber already replays — geometry accumulates correctly under the scrubber for free.

---

## What I'm building this session vs what waits for greenlight

- **Building now (pre-authorized, byte-identical infra):** rung **4a.0** — the geometry kernel + the cube+octahedron fixture unit test. Nothing opts in, so cold-ci stays zero-diff; this is the same lane Phase 0 shipped in. It proves the math and is the artifact the boss greenlights *against*.
- **Waiting for greenlight:** rung **4a.1** (first tenant opt-in) — the first visible change, and per the arc's discipline an aesthetic call only an eye can sign (same gate as the occlusion fleet-wide default). I stop at 4a.0 + this doc and show the working fixture.

— the builder
