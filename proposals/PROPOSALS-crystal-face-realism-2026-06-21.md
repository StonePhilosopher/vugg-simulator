# PROPOSALS — crystal-face realism (the next morphology candidates)

Date: 2026-06-21. Builder: still the builder. Status: **PROPOSALS** (design stage,
not built). Boss asked "is there other science we can implement for more realistic
crystal faces?" → "write proposals for all of them." This is that set.

Citations here are flagged by confidence: **[concept-solid]** = the phenomenon and
mechanism are textbook/uncontested (safe to assert); **[cite-verify]** = the exact
author/year/page should be web-checked before it enters a shipped doc (the cross-
check-research discipline — research passes fabricate citations, so no DOI-grade
claim ships unverified). Each section ends with a VERIFY-BEFORE-BUILD list.

## 0. What faces already do (so these don't re-propose)
Shipped morphology infra: σ-band classifier (smooth→stepped→hopper→dendrite, js/45
MORPH_TH registry), visible terraces (zone-stack ziggurat), saddle-dolomite curved
faces (js/99i `_makeSaddleRhomb`), gwindel twist / sceptre / Tessin, post-growth
bend overprint (`_makeBentPrism` + classifyDeformation), pyrite striations (step-
bunching overlay on {100}), twin geometries (fluorite penetration, selenite
swallowtail), trace-cation colour dispatch, per-mineral habit alphabet. Render
contract: **one material/crystal** (class_color), geometry from a habit token, with
per-crystal render tags (`_saddle`/`_gwindel`/`_sceptre`/`_deformation`) overriding
the token at the mesh-sync hook (js/99i ~3120). Zones carry per-*layer* data;
there is **no per-*face* (sector) state** today. Dissolution state exists
(`crystal.dissolved`, resorption zones) but renders as uniform shrink.

The architectural fault line that decides cost for everything below:
**per-zone (have) vs per-face/sector (don't have); one-material (have) vs
spatially-varying surface colour (don't have).**

---

## 1. SECTOR (HOURGLASS) ZONING — the standout new axis
**Rank 1 (most novel).**

### Science
Different crystal *faces* incorporate trace elements at different rates during
growth, because the atomic configuration of each growing surface differs — so
composition (and colour) is partitioned by **growth sector**, producing hourglass /
Maltese-cross / sector patterns. Canonical examples: **chiastolite** (andalusite
with the dark carbonaceous cross), **titanaugite** hourglass zoning, sector-zoned
**elbaite/tourmaline**, **betafite**, sector-zoned calcite & topaz. The mechanism
is differential surface-site partitioning, not a fluid-history effect — i.e. it is
intrinsically a *per-face* phenomenon.
- Dowty, E. (1976) "Crystal structure and crystal growth: II. Sector zoning in
  minerals," *American Mineralogist* 61:460–469. **[cite-verify]** (the classic
  treatment of why sectors partition differently).
- Sector zoning of andalusite/chiastolite + augite hourglass: standard in Deer,
  Howie & Zussman, *Rock-Forming Minerals*. **[concept-solid]**

### Real driver vs sim state
The sim has **no per-face/sector state** — the deepest gap. Growth is radial zones,
blind to which crystallographic face a given increment belongs to. Sector zoning is
the phenomenon that most exposes this.

### Implementation — two honest tiers
- **Tier A (cheap, honest abstraction): baked hourglass render for named minerals.**
  Treat it like a twin: a habit_variant `sector_zoned` (or per-mineral default, e.g.
  chiastolite andalusite) that the render draws with a baked sector colour pattern
  (a dark cross / hourglass) via vertex colours on the existing mesh. Pure render +
  a habit tag → SIM-neutral, byte-identical (the saddle/gwindel precedent). Says
  loudly it's a habit variant, not a derived partition. **This is the recommended
  first step** — it gets the iconic look (chiastolite cross, augite hourglass)
  without claiming a partition model we didn't compute.
- **Tier B (deep, real): a per-sector partition engine.** Assign each face-family a
  partition coefficient per trace element; record per-sector trace concentration as
  the crystal grows; render colours each sector from its own composition. This is a
  genuine new state axis (per-face) + a render that tints by sector. The honest full
  version — but the render lift (spatially-varying surface colour, vertex-colour or
  multi-material) is the real cost, and the engine adds per-crystal sector arrays.

### Cost / risk
Tier A: render + tag, ~1 session, SIM-neutral. Tier B: engine + render, multi-step
arc, SIM bump (new per-crystal state), needs a dark-observe pass. The render's
**per-face colour** is the shared prerequisite and the gating unknown — prototype a
vertex-colour hourglass on one mesh before committing to Tier B.

### Verify before build
- [cite-verify] Dowty 1976 exact pages + that it's the canonical sector-zoning ref.
- Confirm chiastolite cross is sector zoning (carbon partitioned to sectors), not
  inclusion banding — both are cited in the wild; get the mechanism right.
- Render spike: can js/99i's BufferGeometry carry per-vertex colour cleanly through
  the existing material path? (decides Tier B feasibility.)

---

## 2. ETCH-PIT / DISSOLUTION SCULPTURE — best value-per-effort
**Rank 2.**

### Science
Undersaturation does not shrink a face uniformly. Dissolution nucleates at
dislocation outcrops and high-energy sites → **etch pits** (often crystallographic-
ally oriented, negative-pyramid shaped), **rounded edges/corners**, frosting, and
in the limit **negative crystals** (etched cavities with crystal faces). Etch-pit
geometry is a classic dislocation-mapping tool.
- Sangwal, K. (1987) *Etching of Crystals: Theory, Experiment and Application*,
  North-Holland. **[cite-verify]** (the standard monograph).
- Honevyte/edge-rounding by surface-energy minimisation during dissolution:
  **[concept-solid]**.

### Real driver vs sim state
The sim **already tracks dissolution** (`crystal.dissolved`, negative resorption
zones — it's the mechanism behind sceptres and acid-dissolution paths). It just
renders the result as a smaller version of the same solid. Making dissolved faces
*look* etched is high-fit: the state is there, only the render is missing.

### Implementation
A mesh-sync render hook gated on dissolution state (`crystal.dissolved` or a net-
resorption tag), perturbing the geometry: round the edges/corners (shrink toward a
Wulff-rounded form) and/or stipple shallow oriented pits into faces (a face-normal
inward bump field, the inverse of the saddle outward bow — the `_makeSaddleRhomb`
perturbation machinery directly transfers). Optionally a "frosted" material flag
(higher roughness). Render-only → **SIM-neutral, byte-identical**.

### Cost / risk
Low–medium, render-only, reuses the saddle/bent perturbation pattern. Risk: pits
too small to read at thumbnail (tune amplitude; lead with edge-rounding, which
reads better than pits). Composes naturally with the just-shipped resorption/
deformation work.

### Verify before build
- [cite-verify] Sangwal 1987 monograph details.
- Confirm etch-pit *orientation* convention (pits are crystallographically aligned)
  so the stipple isn't random-looking; or stay with edge-rounding (safer).
- Decide the trigger: any dissolved crystal, or only net-resorbed ones above a
  threshold (avoid frosting every tiny acid-touched crystal).

---

## 3. STRIATION EXTENSION — cheap, real increment
**Rank 3 (low-risk).**

### Science
Striations are sub-parallel grooves from oscillatory alternation of two face forms
during growth. Beyond the shipped pyrite {100} case: **quartz** horizontal
striations across prism faces (alternating prism {1010} / rhombohedral growth —
diagnostic, perpendicular to c); **tourmaline** vertical striations along the prism;
also striated faces on beryl, spodumene, etc.
- Quartz horizontal striations as the diagnostic trigonal-prism signature; tourmaline
  vertical prism striae: standard descriptive mineralogy (Frondel, *Dana's System*
  v.III for quartz). **[concept-solid]** / **[cite-verify]** for exact Frondel pages.

### Real driver vs sim state
Pyrite striations already exist as a render overlay on the cube token. The infra
generalises to other tokens/minerals — the science (which direction, which faces)
is the only per-mineral input.

### Implementation
Extend the pyrite striation overlay: gate on (mineral, token) and draw grooves in
the mineral-correct orientation — quartz prism → horizontal (⊥ c), tourmaline prism
→ vertical (∥ c). Render-only → **SIM-neutral**.

### Cost / risk
Low. Mostly a per-mineral orientation table + reusing the existing groove render.
Risk: none material; purely incremental realism.

### Verify before build
- Confirm striation *orientation* per mineral (quartz ⊥ c; tourmaline ∥ c) —
  [concept-solid] but worth a one-line check so the grooves aren't rotated wrong.
- Confirm the existing pyrite groove render is orientation-parameterisable.

---

## 4. α-FACTOR FACETING FRAMEWORK — principled but risks over-reach
**Rank 4 (deep; may be a deliberate non-build).**

### Science
Jackson's α-factor (α = ξ·ΔH_f / kT, with ξ a face-anisotropy factor) predicts
whether a given face grows **faceted (smooth, α≳2)** or **roughened (non-faceted,
rounded/hopper, α≲2)**. It is the unifying thermodynamics behind: saddle-dolomite
roughening (already shipped, ad-hoc via Gregg–Sibley CRT), hopper onset, and
equilibrium edge-rounding.
- Jackson, K.A. (1958) "Mechanism of growth" (the α-factor), in *Liquid Metals and
  Solidification*, ASM. **[cite-verify]**.
- Sunagawa, I. (2005) *Crystals: Growth, Morphology and Perfection*, Cambridge —
  ties α-factor, vicinal faces, and morphodromes together. **[cite-verify]**.

### Real driver vs sim state
The sim decides faceting ad-hoc per phenomenon (σ-bands for hopper; a clamped T
formula for saddle). An α-factor classifier in MORPH_TH would compute facet-vs-
rough per (mineral, face, T) from ΔH_f, unifying these — a principled driver.

### Implementation
A classifier-metadata pass (js/45): compute α per mineral/face from a ΔH_f table +
T, tag each face facet/rough; the render reads the tag (rough → rounded/hopper geom,
facet → flat). Could *replace* the saddle ad-hoc gate with the principled one.

### Cost / risk
Deep (a ΔH_f table + reworking existing ad-hoc gates) for **little new visible
output** beyond what σ-bands + saddle already produce. Honest verdict: this may be a
**deliberate non-build** (document the framework, keep the working ad-hoc gates) —
the fenster lesson: build it only if it changes the science-truth of the picture,
not just its derivation. Worth writing down so the next builder doesn't re-derive it.

### Verify before build
- [cite-verify] Jackson 1958 + Sunagawa 2005 exact refs.
- A/B check: would an α-factor classifier change ANY current facet/rough call, or
  just re-derive the same answers? If the latter, don't build.

---

## 5. VICINAL HILLOCKS / SPIRAL-GROWTH SURFACE — subtle realism
**Rank 5 (honest but low-drama).**

### Science
Real faces are not mirror-flat: screw-dislocation growth spirals raise shallow
**vicinal hillocks** (low-angle slopes off the singular face), the surface signature
of spiral growth under low driving force. (This is the same Eshelby/spiral-growth
physics family as the gwindel twist — see the deformation dossier §1.)
- Sunagawa, I. (2005) *Crystals: Growth, Morphology and Perfection*, Cambridge —
  the canonical treatment of vicinal faces & growth hillocks. **[cite-verify]**.

### Real driver vs sim state
No surface micro-texture today (faces are flat). A subtle face-normal perturbation
(shallow centred hillocks) would add realism, generalising the saddle perturb at
small amplitude.

### Implementation
Render-only: a low-amplitude hillock bump field on flat faces (reuse the saddle
face-perturb at small amplitude), optionally keyed to a low-σ / spiral-growth
condition. **SIM-neutral.**

### Cost / risk
Low effort, but **subtle** — may not read at the sim's zoom. Honest: ship only if a
preview shows it actually registers; otherwise it's invisible polish.

### Verify before build
- Preview spike FIRST: does a hillock perturbation read at all at render scale? If
  not, shelve it (don't ship invisible work).

---

## 6. HONEST GAPS — documented, deliberately NOT proposed for build
Same discipline as fenster (an honest gap beats a dishonest band):
- **BFDH / attachment-energy habit prediction** (Bravais–Friedel–Donnay–Harker;
  Hartman & Perdok 1955 PBC theory, *Acta Cryst.* 8:49 **[cite-verify]**). The real
  reason slow-growing faces dominate the final form. But the sim's habit *dispatch*
  already produces the visible habits; a full attachment-energy rebuild wouldn't
  clearly beat it and is a large undertaking. **Documented, not built** unless we
  want derivation-from-structure as a goal in itself.
- **Rendered phantoms** — the sim tracks `phantom_count` (ghost crystal outlines
  from a dust/pause layer). Rendering the internal ghost face needs a translucent
  internal-surface render the current solid mesh can't do cheaply. **Deferred on
  render cost**, not on science.
- **Re-entrant-angle twin growth** (twins grow faster at re-entrant angles —
  [concept-solid]) — niche; fold into future twin work, not its own arc.

---

## 7. Recommended sequencing
1. **Etch-pit / dissolution sculpture (§2)** — highest value-per-effort, render-only,
   SIM-neutral, composes with shipped resorption/deformation. Best first build.
2. **Striation extension (§3)** — cheap increment on shipped striation infra.
3. **Sector zoning Tier A (§1)** — the iconic new look (chiastolite/augite) as a
   render+tag; prototype per-face colour here, which de-risks Tier B.
4. **Sector zoning Tier B (§1)** — the deep per-face partition engine, only after the
   Tier-A render spike proves per-face colour.
5. **Vicinal hillocks (§5)** — only if the preview spike shows it reads.
6. **α-factor (§4)** — likely a deliberate non-build; revisit only if it changes a
   facet/rough *call*, not just its derivation.

Every render-only item (§2/§3/§5, §1-Tier-A) is SIM-neutral and byte-identical, the
saddle precedent. The one engine-state item (§1-Tier-B) is the only SIM bump + rebake.
Each gets its citation-verification pass (per the flags) before a line of code —
research-first, the move that caught the §8 shear-field error.
