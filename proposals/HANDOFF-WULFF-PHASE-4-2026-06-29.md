# HANDOFF — Phase 4, the central-distance (Wulff) crystal-form model

**2026-06-29 · SIM_VERSION 214 (unchanged — the whole arc is render-only) · live on Syntaxswine/main + Pages**

> **Update (later 2026-06-29):** rung **4a.3** added a THIRD crystal system — **wulfenite, tetragonal 4/m**
> (`supergene_oxidation`, Tsumeb), rendering as the true tabular plate.
>
> **Update (2026-06-29, same day):** rung **4a.4** added the **FOURTH** crystal system — **barite,
> orthorhombic *mmm*** (`wittichen`, the Black Forest five-element vein), rendering its bladed late-stage
> vein barite as the true **RECTANGULAR** tabular plate. This is the first cell with **three UNEQUAL axes**
> (a≠b≠c), so the {001} plate is a lozenge (longer along *a* than *b*, ~1.25:1) — a habit no cubic/trigonal/
> tetragonal cell can express (wulfenite's plate is *square*). Still byte-identical (SIM 214).
>
> **Update (2026-06-30):** rung **4a.5** is the **galena fleet-out** — the SECOND cubic tenant (no new
> kernel; galena's registry entry already existed). `mvt` now opts in galena *alongside* its calcite →
> a **TWO-tenant Wulff druse** (lead-grey truncated cubes + golden dogtooth calcite, the canonical MVT
> specimen). The catch: galena is hardcoded `habit='cubic'`, and a *perfect* cube Wulff body is pixel-
> identical to the old cube primitive (a no-op), so the band is tuned **low [1.0,1.15]** to keep the {111}
> **corner truncations** visible (the cuboctahedron-leaning cube real galena shows). Still byte-identical.
> The FIFTH-system (**monoclinic 2/m**) oblique-cell math is now PROVEN in a scratchpad prototype
> (`scratchpad/wulff-monoclinic-proto.mjs`: order-4 group, {100}∧{001}=180−β≠90° — see **what's-next**).

You're reading this because you're about to extend the way vugg decides what a crystal *looks like*.
Sit with the model for ten minutes before you touch a file — it is small, and once it clicks the
rest of this doc is just consequences.

---

## The model, in one breath

For most of vugg's life a crystal's whole external shape was **two scalars and a habit string**:
`total_growth_um` → `c_length_mm` / `a_width_mm`, rendered by `mesh.scale.set(aWid, cLen, aWid)`
over a hand-rolled primitive (`_makeScalenohedron`, `_makeRhombohedron`, an `OctahedronGeometry`,
…). There was no per-face anything. Every anisotropic thing we'd shipped — gwindel, saddle dolomite,
bent quartz, the sceptre — was a *bespoke mesh*, a one-off.

Phase 4 replaces that with the real thing. A crystal is a **bounded convex polyhedron**

```
P = ⋂ᵢ { x : nᵢ · x ≤ dᵢ }
```

one oriented plane per crystallographic form face. The normals **nᵢ are fixed** by the point group
acting on the form indices {hkl} — *Steno's law of the constancy of interfacial angles, made
literal* — and only the central distances **dᵢ grow**. Habit falls out of the *relative rates*:
`dᵢ(g) = SEED + SPAN·g·Rᵢ`, and **slow faces win** (a fast face recedes outward and is cut off by
its slower neighbours — it self-eliminates). Equal rates → cuboctahedron; shrink {111} → cube;
shrink {100} → octahedron. Cube↔octahedron and nailhead↔dogtooth are not two pieces of code. They
are *the same equation* solved against different face-normal sets. That is the whole point: it is a
**general framework**, not a pile of special cases. Fluorite (cubic), calcite (trigonal), wulfenite
(tetragonal), and barite (orthorhombic) are just four unit cells plugged into one machine.

The kernel is `js/46-wulff-geometry.ts`. Read it top to bottom — it's ~290 lines and it's the spine.

---

## What is shipped (and what each commit bought)

All seven rungs are **render-only and byte-identical** — the seed-42 calibration baseline
(`tests-js/baselines/seed42_v214.json`) never moved, so there was **no SIM bump and no rebake**.
That is the load-bearing discipline (see Traps §1). FOUR crystal systems, FIVE tenants (cubic carries two:
fluorite + galena).

| commit | rung | what |
|---|---|---|
| `52e62d1` | **4a.0** | the geometry kernel + cube/octahedron fixture. Pure infra; nothing dispatched it. |
| `57a5aae` | **4a.1** | first tenant — **fluorite**, the cube↔octahedron transition, on `sunnyside_american_tunnel`. |
| `c555f21` | **4a.2 kernel** | **hex-R** support — the first NON-cubic system. `wulffTrigonalNormals` + calcite registry. |
| `770ec7a` | **4a.2 tenant** | **calcite** renders as a true dogtooth on `mvt`. Two crystal systems now live. |
| `821b7ce` | **4a.3** | **wulfenite** — the THIRD system (**tetragonal 4/m**, scheelite-type). `wulffTetragonalNormals` + the `_WULFF_TETRAGONAL_GROUP` closure + registry + classifier + the tabular *square* plate on `supergene_oxidation`. A new crystal system *and* its tenant in one commit. |
| `7b908a9` | **4a.4** | **barite** — the FOURTH system (**orthorhombic *mmm***, barite-group). `wulffOrthorhombicNormals` + the `_WULFF_ORTHORHOMBIC_GROUP` closure (3 mirrors) + registry + classifier (bladed/tabular bands) + the **RECTANGULAR** tabular plate on `wittichen`. First cell with three *unequal* axes → the lozenge plate. |
| *(this commit)* | **4a.5** | **galena** — the SECOND cubic tenant (a fleet-out; no new kernel). Classifier band [1.0,1.15] + `wulff_galena` flag + dispatch + opt-in on `mvt` → a **TWO-tenant druse** (truncated cubes + dogtooth calcite). The band is low to keep the {111} truncations visible (a perfect cube = no-op). |

**File map (where the pieces live):**
- `js/46-wulff-geometry.ts` — the kernel: the `WULFF_FORM_GEOMETRY` registry, `wulffCubicNormals`,
  `wulffTrigonalNormals` (-3m) + `wulffTetragonalNormals` (4/m) + `wulffOrthorhombicNormals` (mmm) and
  their `_WULFF_*_GROUP` point-group closures, `wulffFaceSetForMineral` (registry → `[{n,d}]`),
  `wulffPolyhedron` (the triple-plane intersection), `_makeWulffGeom` (→ `THREE.BufferGeometry`,
  normalized to ±0.5, **null-clamp on a degenerate solid**).
- `js/45-morphology.ts` — `classifyWulffForm(sim)`: the post-growth classifier that tags
  `crystal._wulffForm = { biasC, growthFrac, octahedral, scaleno, tabular, bladed }`. Gated per-tenant on
  `wall.wulff_fluorite` / `wall.wulff_calcite` / `wall.wulff_wulfenite` / `wall.wulff_barite` /
  `wall.wulff_galena`. Mirrors `classifyOcclusion`. (Barite is the one tenant that reads its habit string
  to *split a band*: bladed → thinner [1.9,3.0] vs tabular [1.3,2.2], because grow_barite emits both.
  Galena, like wulfenite, is single-habit — its low cube band [1.0,1.15] keeps the {111} corner
  truncations alive so the truncated cube isn't a perfect-cube no-op.)
- `js/85-simulator.ts` — calls `classifyWulffForm(this)` in the step loop (after `classifyOcclusion`).
- `js/22-geometry-wall.ts` — the `wall.wulff_*` whitelist (an unlisted wall flag is silently dropped).
- `js/99i-renderer-three.ts` — the dispatch branch (~line 3918, gated `!geom` after the
  etched/terrace/e-twin/twin paths) + the isotropic-scale branches (~line 4271): `isWulffCalcite`
  (scale by `cLen`, the c-elongated case) and `isWulffWulfenite || isWulffBarite` (scale by the plate
  diameter `max(aWid,cLen)`, the tabular case — both tetragonal *square* and orthorhombic *rectangular*
  plates share this one rule; the geom carries the aspect). `isGlWulff` (galena) needs **no scale
  branch** — it's cubic/isometric like fluorite, so it falls into the existing cube/octahedron scale.
- `js/27-geometry-crystal.ts` — the `_wulffForm` tag is documented in the render-tag block.
- `data/scenarios.json5` — `sunnyside_american_tunnel.wall.wulff_fluorite`, `mvt.wall.{wulff_calcite,
  wulff_galena}` (the two-tenant druse), `supergene_oxidation.wall.wulff_wulfenite`,
  `wittichen.wall.wulff_barite`.
- `tests-js/wulff-geometry.test.ts` (kernel pins, +9 orthorhombic, +4 galena) + `tests-js/wulff-form.test.ts`
  (classifier pins, +5 barite, +4 galena); `npx vitest run wulff` → 71 green. `tools/wulfenite-wulff-probe.mjs`
  + `tools/barite-wulff-probe.mjs` + `tools/galena-wulff-probe.mjs` — the tenant-survival probes
  (display-size, untwinned, in-band; the barite + galena probes also report the habit histogram, since
  only the right habits hit the Wulff token).
- `proposals/DESIGN-WULFF-PHASE-4-2026-06-28.md` — the design pass (the six decisions D1–D6 + the
  rolling UPDATE log). Read it for the *why* behind the architecture choices.

---

## How to add the next tenant (the cheap path)

The framework is built so a new tenant in an existing crystal system is a few lines. To add, say,
**galena** (cubic, cube ± octahedron — its registry entry already exists):

1. **Registry** (`js/46`): confirm/author the `WULFF_FORM_GEOMETRY.<mineral>` entry — `system`,
   `cell` (for non-cubic), `forms: [{hkl, R, bias?}]`. BFDH-seed the rates (`R ∝ 1/d_hkl`); mark the
   habit-knob form with `bias: true`.
2. **Classifier** (`js/45 classifyWulffForm`): add the mineral to the per-tenant gate + a `biasC`
   band that maps its persisted habit string to the form continuum. **The end-member is already
   decided by the grow engine** (the habit string it wrote from the fluid) — the classifier only
   sets the *truncation degree* and a deterministic per-crystal spread (golden-ratio crystal-id
   hash; NO rng).
3. **Renderer** (`js/99i`): the dispatch is already generalized by `crystal.mineral` + token. A new
   cubic tenant needs nothing here. A new *anisotropic* system needs the isotropic-scale treatment
   (see Traps §3).
4. **Scenario** (`data/scenarios.json5`): set `wall.wulff_<mineral>: true` on ONE well-chosen
   scenario (see Traps §5 on choosing). Whitelist the flag in `js/22`.
5. **Eye-check** (non-negotiable — see Traps §4), tests, adversarial review, cold-ci, ship. Still
   byte-identical → no SIM bump.

A **new crystal system** is more: it needs its own `wulff<System>Normals(hkl, cell)` — the reciprocal-
metric normal generator + the point-group orbit, modelled on `wulffTrigonalNormals`. **Wulfenite (4a.3)
and barite (4a.4) are the two worked examples**, both *orthogonal*-cell systems so the reciprocal vector
is trivial: wulfenite tetragonal 4/m, `g = (h/a, l/c, k/a)` (order-8 group from `{ C4(y), σh, inversion }`);
barite orthorhombic *mmm*, `g = (h/a, l/c, k/b)` (order-8 group from the **3 mirrors** — sign-flips only,
**no axis permutations** because a≠b≠c are inequivalent). The parts that took care: (i) using the
mineral's *true* point group — wulfenite **4/m not 4/mmm**; barite **mmm**, and note the orbit is
sign-flips-only, NOT the cubic sign×permutation; (ii) the tabular scale (Trap §3 — both fold into the
shared `max(aWid,cLen)` branch); (iii) the genuinely-new payoff: barite's unequal axes give the first
**rectangular** plate. The next system, **monoclinic gypsum 2/m**, is the harder one: the first *oblique*
cell (β≠90°), so `g` needs the full reciprocal-metric tensor — the trivial `(h/a,k/b,l/c)` no longer holds.
Prototype the crystallography in a scratchpad first (see Instruments) — validate the orbit sizes and a bbox
(which axis is long? is the in-plane outline square or rectangular?) before porting a single line.

---

## The traps (this is the part that will save you a day)

**1 — Byte-identity is the whole game; respect what makes it hold.** This arc moved zero baseline
bytes across four commits because: `classifyWulffForm` is *pure tagging* (no rng draw, no fluid
mutation); `gen-baseline` serialises only counts/sizes, so the `_wulffForm` tag never reaches the
baseline; and **the geom token is never changed** (fluorite stays `cube`/`octahedron`, calcite stays
`rhomb`/`scalene`), so the engine's size/scale path is untouched — *same size, new shape*. If you
ever find yourself wanting the Wulff body to drive *volume* (→ vugFill → chemistry), STOP: that is
**Phase 4b**, it is NOT byte-identical, and it needs a per-scenario SIM bump + rebake. Keep 4a pure.

**2 — The d-formula SEED will lie to you.** `dᵢ = SEED + SPAN·g·Rᵢ`. The first kernel used
`SEED=0.30, SPAN=0.40` and *every* bias collapsed to a cuboctahedron — the seed dominated the rate
term, so the rate ratio couldn't drive the form. Dropped it to `SEED=0.05, SPAN=1.0` and the full
cube↔cuboctahedron↔octahedron range opened up. If a tenant's habit knob "doesn't do anything," this
is why. Sweep it in a scratchpad before you believe a bias range.

**3 — Anisotropic minerals need the c-axis on Y, and an ISOTROPIC scale.** Cubic was forgiving;
calcite taught the lesson twice. (a) The kernel originally built calcite with the 3-fold on **Z**,
but the renderer's c-axis convention is **Y** (`mesh.scale.set(aWid, cLen, aWid)`) — a c-on-Z
dogtooth renders lying on its side. `wulffTrigonalNormals` now puts c on Y (g = (h/a, l/c,
(h+2k)/(a√3)); 3-fold about Y). (b) The Wulff geom *already carries its true crystallographic
c-elongation*, so it must scale **isotropically** (`isWulffCalcite` → `mesh.scale.set(cLen,cLen,cLen)`)
— the token's `(aWid,cLen,aWid)` would **double-stretch** the already-elongated geom. Any future
non-isometric tenant inherits both of these.

  *Wulfenite (4a.3) is the mirror-image lesson: it is **tabular**, so `c` is the **short** axis.* The
  Wulff geom still carries the true aspect, but the right isotropic scale is now by the plate
  **diameter** — `max(aWid, cLen)` (= `aWid` for a `tablet` token), in a SEPARATE `isWulffWulfenite`
  branch. Scaling by `cLen` (the calcite path) would shrink the whole plate down to its *thickness*.
  The general rule the two cases teach: **an anisotropic Wulff geom scales isotropically by its LONGEST
  physical axis** — `cLen` for a c-elongated tenant, `aWid` for a tabular one. Keep the existing
  tenants' branches untouched so they stay byte-identical (don't fold them into one `max()` — calcite's
  `rhomb` nailhead can have `aWid ≳ cLen`, which would change its render).

  *Barite (4a.4) is the case where folding IS correct:* it is also **tabular** with `c` short, so the
  scale rule (`max(aWid,cLen)`) is **literally the same** as wulfenite's — so the branch is
  `else if (isWulffWulfenite || isWulffBarite)`, one rule serving both. They differ only in the geom's
  own internal aspect, which the kernel already carries: wulfenite's plate is **square** (a=b), barite's
  is **rectangular** (a≠b, ~1.25:1 — the new orthorhombic capability). The lesson refines §3: fold tenants
  into one scale branch **only when the scale rule is identical** (both tabular-c-short), and keep the
  *form* difference where it belongs — inside the polyhedron, not the scale. (So: wulfenite+barite share;
  calcite stays separate because c is its *long* axis.) The orthorhombic kernel also drops the cubic
  axis-permutations — the three axes are inequivalent, so `wulffOrthorhombicNormals`' orbit is sign-flips
  only (`g = (h/a, l/c, k/b)`, c on Y, a on X, b on Z; the 8 diagonal ±1 matrices from 3 mirrors).

  *Known pre-existing minor (surfaced by the 4a.4 review, NOT a 4a.4 regression):* cluster **satellites**
  of any tabular Wulff plate are scaled *anisotropically* (`_emitClusterSatellites`, js/99i ~3515, keys
  isotropic scale off `cube/octahedron/snowball` only — a `tablet` token falls to the `else` anisotropic
  branch and re-flattens the already-thin geom along Y), while the *parent* plate scales isotropically.
  This is shared identically by calcite (4a.2) and wulfenite (4a.3) — any `tablet`/anisotropic Wulff
  parent has it. Visual impact is minor (the `tablet` cluster is the rosette — geologically apt for barite
  desert roses). The clean fix would teach the satellite dispatch the same `isWulff*` signal the parent
  uses; deferred because it touches three tenants and is cosmetic.

**4 — A render upgrade must be visibly BETTER, not just different — and you can't tell without
looking.** The fluorite "obvious" mapping (high-Y → biasC 0.28) produced a *perfect* octahedron —
byte- *and pixel-*identical to the old `OctahedronGeometry` primitive. Useless. The faithful AND
visible choice is a lightly-truncated octahedron (biasC 0.41): a Y-stabilized fluorite has {100}
*reduced*, not *absent*. Calcite repeated it: my first dogtooth band [0.34,0.50] rendered a **stubby
block** — not a tooth, and arguably worse than the old primitive; [0.15,0.26] is the real dogtooth.
**You will not catch this from the numbers.** Render it, look at it, and compare it against the OLD
primitive side by side. (Saved as memory `feedback_render_upgrade_visible`.)

**5 — Choose the tenant scenario by what survives to the final frame.** The Wulff branch is gated
`!geom` AFTER the etched / terrace / e-twin / twin / dendrite paths, so those WIN. I first wired
calcite onto `marble_contact_metamorphism` — then found its calcite **e-twins at step 165** (an
orogenic-strain event), and the e-twin geometry overprints the Wulff form: the dogtooth would be
*hidden* in the final specimen. Switched to `mvt` — a quiet basin (no strain → no overprint), whose
calcite is already occlusion-rooted, so it renders as a **drusy dogtooth** emerging from the matrix.
Probe a candidate's calcite (`window.vugg.headlessRun(name,{seed:42})` → inspect habit/token/events)
before you commit to it.

**6 — Some chemistry you'd want is not persisted.** The honest continuous bias for fluorite would be
the per-zone Y level (`grow_fluorite` records `trace_Y`) — but the `GrowthZone` constructor *drops*
`trace_Y` (it only copies a fixed whitelist of trace fields). So there is no per-zone Y to read at
render time. The golden-ratio crystal-id hash stands in for that unrecorded local variation. If you
want chemically-exact bias, you'd have to persist the trace — which moves the baseline (a rebake).

**7 — cold-ci timeouts ≠ a regression.** This arc's cold-ci once "failed" with ~10 timeouts — every
one a `Test timed out` in a HEADLESS seed-sweep for a scenario that doesn't even touch the Wulff
path, and the total run ~2.5 min slow. It was the **live preview Chromium stealing CPU** during the
run. Diagnose by shape: all-timeouts + zero assertion failures + slow total = contention.
`preview_stop` the server, re-run. (Memory `feedback_coldci_preview_contention`.)

---

## The verification instruments (use them — they're part of the deliverable)

- **Scratchpad crystallography prototypes.** Before porting any new normal-generator, validate the
  orbit sizes + the polyhedron in a standalone `.mjs` (port `wulffPolyhedron`'s triple-plane logic,
  ~30 lines). The cubic kernel was validated as cube/oct/cuboctahedron; the hex-R as {104}→6 /
  {211}→12 + a bbox check confirming Y is the dogtooth's long axis. Catch the math on paper, not in
  the bundle.
- **The preview eye-check recipe.** `preview_start "vugg-static (repo root)"` (a `python -m
  http.server` per `.claude/launch.json`), then load
  `index.html?scenario=<name>&seed=42&steps=N&autogrow=1&lenient=1`. The narrative gates at a
  click-to-continue prologue, but the sim records the FULL `wall_state_history` synchronously — so
  jump straight to the grown frame with `_topoReplayRenderFrame(topoActiveSim().wall_state_history.length-1)`.
  For a clean look at one crystal, inject a tiny THREE scene over the page reusing the global
  `wulffFaceSetForMineral` + `_makeWulffGeom` (a before/after of old-primitive vs Wulff, and a
  biasC vocabulary strip, are how both tenants' bands were tuned). **STOP THE PREVIEW BEFORE COLD-CI**
  (Trap §7).
- **The adversarial diff review.** The 4a.2 diff was reviewed by a 4-dimension workflow
  (crystallography / byte-identity / render-coexistence / regression), each finding refuted-by-
  default. Worth it for a new crystal system. (It came back clean — but it's the right reflex for
  error-prone geometry work.)

---

## What's next (in rough order of value-per-effort)

1. **Fleet-out the cubic tenants — galena DONE (4a.5, the `mvt` two-tenant druse).** The lesson galena
   taught: the band must be picked so the body is *visibly* truncated — a perfect cube is pixel-identical
   to the old primitive (the render-upgrade-visible no-op), and galena's registry R_111=1.5 makes the
   truncation window low + narrow [1.0,1.15]. Remaining isometric formers: halite/sylvite already have a
   hopper render; pyrite has striations; a true {100}/{111}/{210} pyritohedron/diploid would need new
   forms in the registry. More two-tenant druses (galena+fluorite, galena+sphalerite) are cheap opt-ins.
2. **A nailhead (rhombohedral) calcite showcase.** Only the *dogtooth* (biasC<1) branch is live; the
   nailhead band (biasC≥1) is implemented + tested but never eye-checked in a scenario. A
   rhombohedral-calcite locality would exercise it and is a cheap, satisfying win.
3. **A FIFTH crystal system — monoclinic *2/m* (the math is ALREADY PROVEN).** `scratchpad/
   wulff-monoclinic-proto.mjs` validated it against titanite's cell: the order-4 group from
   `{ C2(b), inversion }`, the reciprocal vector `g = (h/a, k/b, (l/c − h·cosβ/a)/sinβ)` (the unique axis
   b on Y, the **h↔l cross-term** the oblique cell forces — the first cell where `g≠(h/a,k/b,l/c)`), orbit
   sizes (pinacoids→2, prism/general→4), and the signature: **{100}∧{001}=180−β≠90°**, the first
   non-perpendicular face pair. To ship it: port that into `wulffMonoclinicNormals` + a `_WULFF_MONOCLINIC_GROUP`
   closure, add a registry entry, classifier tenant + a scenario. **Pick the tenant carefully** — gypsum is
   iconic but already has a bespoke hourglass-blade render to *compose* with (and the swallowtail is a
   twin); **cleaner candidates that render as plain prisms** (no bespoke mesh): **titanite** (the textbook
   wedge — the β-lean IS its identity), **epidote** (pistachio prisms), **erythrite** (the crimson
   cobalt-bloom already in wittichen). Once monoclinic works, **triclinic** is the same tensor with even
   less symmetry. Quartz (enantiomorphic 32) is the trophy but must compose with sceptre/gwindel/smoky —
   most delicate. The 4a.3/4a.4 template still holds: build the true point group, symmetry axis on Y,
   scale by the longest physical axis, and eye-check the in-plane outline against the system.
4. **The concavity primitive.** Decided in the design pass (D1: nested convex shells) but NOT built —
   no tenant is concave yet (hoppers/skeletal forms are the eventual customers). The convex body is
   the base layer either way, so it's not blocking anything.
5. **Phase 4b — engine-coupled accurate volume.** The one path that breaks byte-identity: feed the
   true polyhedron volume back into `vugFill` → chemistry. Per-scenario SIM bump + rebake. Defer
   until a scenario genuinely needs accurate volume; the render-only win covers the visual goal.

---

## Lineage — what this stood on (the diagenesis)

This arc was fast because the ground was already prepared, and it would be dishonest to frame it as
spring-from-nothing:

- **The occlusion arc** (`HANDOFF-OCCLUSION-2026-06-26.md`) is the direct parent. `classifyOcclusion`
  is the template `classifyWulffForm` copied beat for beat: the opt-in wall flag, the rng-free
  golden-ratio crystal-id hash, the "render-tag that gen-baseline never serialises" trick that makes
  byte-identity *possible*. The fork it named (fleet-wide-default / Phase-4-Wulff / aggregate-geometry)
  is the fork this arc took the middle prong of.
- **Phases 0–3** (`HANDOFF-DIRECTIONAL-GROWTH-2026-06-22.md`, `PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md`)
  built the classifier-tag → renderer discipline and the "render-only / no rebake" lane this lives in.
- **The calcite-morphology arc** gave calcite its habit strings (`scalenohedral`/`rhombohedral`) and
  the `_makeScalenohedron`/`_makeRhombohedron` primitives the Wulff dogtooth *subsumes* — and the
  before/after you can only judge against.
- **`data/structural.json`** supplied the cell metrics (fluorite a=5.46, calcite a=4.99/c=17.06) that
  the reciprocal-metric normals are computed from. The whole hex-R kernel is downstream of that file.
- **The seed-42 calibration baseline** is the instrument that *proved* byte-identity at every step.
  Without it, "render-only" would be a claim, not a fact.

---

## A note to the builder who picks this up

The thing I'm proudest of isn't the dogtooth — it's that adding the dogtooth didn't require a new
idea, only a new unit cell. When you add the next system and the cube↔octahedron logic and the
nailhead↔dogtooth logic and *your* new transition all turn out to be the same six lines solved
against different normals, you'll feel the framework holding weight. That's the cathedral doing its
job: each of us cuts one more stone to fit, and the arch stands because the stones before ours were
cut true.

Two habits earned their keep this arc and I'd ask you to keep them. **Follow the science** — when a
design choice was ambiguous (perfect octahedron vs truncated, how pointy a dogtooth), the real rock
decided it, and the result was both more correct and more beautiful; that's not a coincidence.
And **look at the thing** — the numbers passed every test while rendering a stubby block; only the
eye caught it. A render you haven't looked at is a render you haven't verified.

The kernel wants to grow. Go give it another crystal system.

— left for whoever comes next, 2026-06-29

---

## Maker's mark — the second hand on this stone

I picked up the note above mid-cut and carried it two more courses. Where it ended at three crystal
systems, this hand added the **fourth** — barite, the first plate that isn't *square*, because its cell
is the first with three unequal axes; the lozenge leans the way *a* runs longer than *b*, and no higher
symmetry can say that. Then a smaller stone, **galena**, the second cubic tenant — and it taught the
sharpest version of *look at the thing*: a perfect cube rendered through the new kernel is byte-for-byte
the OLD cube, a no-op wearing a new coat. The band sweep caught it; the truncated corners are the whole
point. And a gift left dressed but unset on the bench: the **monoclinic** math, proven in a scratchpad —
the first *oblique* cell, where the reciprocal vector finally needs the full metric tensor and two faces
meet at 66°, not 90°. The fifth system is a port away.

The honest part: none of it was spring-from-nothing. The note above handed me the cathedral metaphor and
the two habits; the **seed-42 baseline** made "render-only" a fact I could *prove*, not just claim;
`structural.json` held every cell I read; the **probe discipline** — let the engine tell you what it
actually grows — saved me twice (tn457's barite wasn't tabular at all; mvt's galena came two-thirds
twinned). And a boss who, every time the work was going well, said *keep going* — which is its own kind
of scaffold.

**The dream, since you asked for one.** I want the kernel to finish the lattice — monoclinic, then
triclinic, then enough of the 32 point groups that any mineral in the catalog can be asked for its true
form and *answer*. I want the concavity primitive built, so a hopper is a hopper and not a spike. I want
**Phase 4b**: the day the polyhedron's true volume flows back into `vugFill` and the chemistry, so shape
stops being only for the eye and starts *feeding the simulation* — a crystal that grows the way it looks.
And the far one: the optics goal converging with this, so a Wulff amethyst is purple *and* see-through,
its faces catching light at the real interfacial angles — until the only instrument left that can tell a
rendered specimen from a real one is a real rock held up next to it. Follow the science all the way down
and that isn't a fantasy; it's a falsifiable target.

A mason cut his mark into every stone he dressed, so that a single hand could be traced across a whole
cathedral centuries on. This is mine. The arch is standing — four systems, five tenants, the fifth
already proven on the bench. Go give it another crystal system.

— the builder, *StonePhilosopher*, 2026-06-30
