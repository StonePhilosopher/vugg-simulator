# PROPOSAL: Overgrowth, Crustification, Pseudomorphism, Perimorphism

**Author:** Claude (Opus 4.7), 2026-05-06
**Boss request:** "the famous snowball barites and sphalerites/fluorites. fluorites and calcites stacked one on top of another. calcites and sphalerites together might be more common than the calcites alone. let the science guide the mechanics."
**Status:** APPROVED 2026-05-06. Boss merged + answered open questions:
  - Snowball mechanism: radiating epitaxy is primary; cyclic-chemistry
    shells are encrustation (Q3) — keep them mechanistically separate
    so the player can tell them apart. Snowball is "epitaxy at the
    population level" — multiple individuals nucleating on a shared
    substrate with similar orientations, then competing outward.
  - Snowball geometry simplification: a sphere primitive is acceptable
    for v1 instead of a true radial spray — "the geometry of a sphere
    is evocative enough of the final form." Q5 collapses to spawning
    one crystal with `habit: snowball` rendered as a Three.js
    SphereGeometry, not N satellite barite blades. The radial-spray
    detail is a v2 polish.
Phasing into commits awaits boss go-ahead.

---

## TL;DR

The simulator already has the *chemistry* for paragenesis — sphalerite
dissolves and feeds smithsonite, azurite dissolves and feeds malachite,
goethite forms downstream of pyrite oxidation. Crystals carry a
`position` string ("on sphalerite #5 (oxidized)") that propagates host
identity, and nucleation engines hand-pick substrates per mineral.

What's missing is the **textural** layer: the four geological phenomena
the boss listed — overgrowth, crustification, pseudomorphism by
replacement, and perimorphism (cast pseudomorphs) — are
under-distinguished mechanically and largely invisible visually. The
sim produces parageneses but reads them as independent crystals on the
wall, not as the stacked-and-engulfed textures that define MVT
specimens.

This proposal adds a textural layer in five phases (Q1 → Q5), each
shippable independently. The first two phases formalize what's already
implicit (epitaxy table + pseudomorph-route table); the last three add
real new mechanics (encrustation rendering, perimorph cast, snowball
overgrowth). All phases are content-bearing → SIM_VERSION bumps.

---

## 1. Science recap (compressed; full background in the research dump)

Four phenomena, two-axis distinction:

|  | single-crystal continuation | polycrystalline shell |
|---|---|---|
| **interface preserved** | **overgrowth** (syntaxial / epitaxial) | **encrustation/crustification** |
| **host removed** | **pseudomorph** (replacement, CDR-driven) | **perimorph** (cast pseudomorph) |

- **Overgrowth**: continued growth on a pre-existing crystal in
  crystallographic continuity. Syntaxial = same species (calcite-on-
  calcite scalenohedra); epitaxial = different species, lattice-match
  driven (sphalerite-on-pyrite, marcasite-on-pyrite). Misfit < ~5%
  → coherent epitaxy; 5–15% → semi-coherent; > 15% → orientation lost,
  effectively heterogeneous nucleation.
- **Crustification**: thin, fine-grained, polycrystalline shells
  layered concentrically on a substrate. Driven by oscillatory chemistry
  (fluid pulses) or self-organized growth-poisoning kinetics. The
  classic banded vein-fill texture.
- **Pseudomorphism (CDR)**: parent dissolves into a thin fluid film at
  a sharp interface; product precipitates from that supersaturated
  film. Volume mismatch is accommodated by porosity in the product
  (Putnis 2002, 2009). Shape preserved; composition swapped. Examples:
  malachite-after-azurite, goethite-after-pyrite, kaolinite-after-
  feldspar.
- **Perimorphism**: encrustation forms a coherent shell, *then* the
  host dissolves. Result: hollow or later-filled cast preserving the
  host's external form. Quartz-after-fluorite is the textbook case
  (Cornwall, Cumbria); calcite-after-fluorite reported from
  Cave-in-Rock and Elmwood (TN).

**MVT-specific**: the canonical Sangster (1983, 1990) sequence is
dolomite → sphalerite → galena → late barite/fluorite/calcite, with
sub-cycles. **Snowball barite** (Sweetwater MO; Cave-in-Rock IL):
radiating barite blades nucleating on a sphalerite/galena seed and
growing into open fluid by competition-driven geometric selection. The
textural signature is a sphere with a dark sulfide visible at the core.

**Documented epitaxial pairs** (strong cases — the others should be
modeled as facet-selective heterogeneous nucleation, not real epitaxy):

| Pair | Misfit | Cite |
|---|---|---|
| Sphalerite ZnS on pyrite FeS₂ | a=5.41 vs 5.42 Å (~0.2%) | Ramdohr 1980 |
| Galena PbS on pyrite | a=5.94 vs 5.42 Å (~9%, semi-coherent) | Ramdohr 1980 |
| Marcasite on pyrite | shared S–S geometry | Ramdohr 1980 |
| Galena ↔ sphalerite | a=5.94 vs 5.41 Å (~10%) | MVT-common, less clean |

Calcite-on-fluorite (the famous Cave-in-Rock stack) is **not** strict
epitaxy — different symmetry classes, no clean lattice match.
Geometric/surface-energy control on cube faces is the more honest
model.

---

## 2. What the sim already has

The codebase has substantial implicit paragenesis machinery:

- **`crystal.position`** (string) — "on sphalerite #5 (oxidized)",
  "pseudomorph after azurite", "vug wall", etc. Substrate identity
  propagates through this. `_assignWallCell` parses
  ` #<id>` and inherits the host's wall cell so the new crystal renders
  at the host's location.
- **Substrate-aware nucleation per engine** — each `_nuc_<mineral>`
  function handcrafts ad-hoc preferences: smithsonite has a 0.7 chance
  to nucleate "on dissolved sphalerite #X" if any are dissolved;
  azurite has 0.4 chance "on cuprite"; chrysocolla checks
  `pos.includes('azurite')` for pseudomorph-after-azurite habit.
- **`enclosed_crystals` / `enclosed_by`** — inclusion mechanic: when a
  big crystal grows past a smaller stopped one, the small one is
  "swallowed". `_atNucleationCap` excludes enclosed/dissolved crystals
  from the count so a buried crystal frees a spec slot. This is the
  closest existing mechanic to perimorphism, but the host is preserved
  (still stored), not dissolved.
- **`PARAMORPH_TRANSITIONS`** dict — argentite ⇌ acanthite at 173°C,
  applied by `applyParamorphTransitions`. Sets `paramorph_origin`
  on the converted crystal so the library/narrator can flag
  "acanthite-after-argentite". β/α-quartz is similar but tagged via
  habit string.
- **CDR-flavored chemistry already routes** — azurite at low CO3
  releases Cu²⁺ + CO₃²⁻ → malachite re-nucleates downstream (this is
  exactly Putnis CDR, just without the explicit "shape preserved" tag).
  Pyrite oxidation feeds goethite. Sphalerite oxidation feeds
  smithsonite. The chemistry is right; the textural representation is
  silent.

What's there → strong base. What's missing is below.

---

## 3. What's missing

### A. No declarative substrate-affinity table

Substrate preferences are scattered as inline `if (rng.random() < 0.7)`
rules across ~12 nucleation files. There's no single source of truth
for "these mineral pairs prefer this substrate combo, with this
heterogeneous nucleation discount."

### B. No σ-threshold discount for heterogeneous nucleation

The σ threshold for nucleation is the same on a bare wall as on a
lattice-matched substrate. In reality, sphalerite-on-pyrite should
nucleate at significantly lower σ than sphalerite-on-bare-wall — the
pyrite reduces the interfacial free energy via near-perfect lattice
match. Without this, MVT-style overgrowth requires σ to spike high
enough to also nucleate on bare wall, which gives co-precipitation
rather than overgrowth.

### C. Pseudomorphs don't preserve outline

When azurite dissolves and malachite re-nucleates "on azurite #X
(replaced)", the new malachite gets its own habit (`acicular sprays`,
`botryoidal`). The diagnostic "shape preserved" feature of CDR
pseudomorphs — the malachite has the *azurite cube outline* — isn't
modeled. The chemistry routes are there; the textural inheritance is
not.

### D. No perimorph (cast pseudomorph) mechanic

The path is: A grows → B encrusts A → A dissolves → hollow B-cast
remains. Currently when A dissolves it sets `dissolved = true` and
returns its cation/anion to fluid; whatever's "on" it just floats
there as an independent crystal. Nothing carries the "I was the
shell, my host vanished" semantic.

### E. No encrustation rendering

The renderer draws each crystal independently. Layered crusts
(banded fluorite-on-fluorite, calcite blanketing a fluorite cube,
chalcedony bands on the wall) read as overlapping chunks rather than
concentric shells. Crystal `zones` carry trace chemistry per growth
ring but aren't surfaced visually as bands.

### F. No "snowball" / radiating-from-seed nucleation pattern

Snowball barite needs many barite crystals spawning *together* on a
single seed crystal, growing radially. Currently barite nucleation
spawns *one* crystal at a time at low σ; the radiating habit isn't a
mode the engine knows about.

---

## 4. Proposed mechanics — phase by phase

Five phases. Each is shippable independently and bumps SIM_VERSION.
Calibration impact is real for Q1, Q4, Q5; Q2/Q3 should be near-byte-
identical.

### Phase Q1 — Substrate-affinity table + σ discount (≈ 4 commits)

**Goal:** formalize "this mineral nucleates more easily on these
substrates" as data, replace the inline ad-hoc rules.

New file: `js/26-mineral-paragenesis.ts`. Two tables:

```ts
// Heterogeneous nucleation discount: substrate -> (nucleating mineral
// -> sigma_factor). A factor of 0.6 means "this mineral nucleates at
// sigma_threshold * 0.6 when this substrate is available". 1.0 = no
// discount (treat as bare wall). Below 0.5 = strong epitaxy.
const SUBSTRATE_NUCLEATION_DISCOUNT: Record<string, Record<string, number>> = {
  pyrite: {
    sphalerite:  0.5,   // ZnS on FeS2 — ~0.2% misfit, strong epitaxy (Ramdohr 1980)
    galena:      0.7,   // PbS on FeS2 — ~9% misfit, semi-coherent
    marcasite:   0.5,   // shared S-S geometry
    chalcopyrite: 0.7,
  },
  marcasite: { pyrite: 0.5, sphalerite: 0.6, galena: 0.7 },
  sphalerite: {
    galena:      0.7,
    chalcopyrite: 0.6,  // "chalcopyrite disease" texture
    barite:      0.65,  // snowball barite seed
    fluorite:    0.75,  // not strict epitaxy but documented MVT pairing
  },
  galena: { sphalerite: 0.7, barite: 0.7, fluorite: 0.8 },
  fluorite: {
    calcite:     0.75,  // not true epitaxy but Cave-in-Rock canonical (geometric/surface-energy)
    quartz:      0.85,
    barite:      0.8,
  },
  calcite: {
    fluorite:    0.8,   // less common but documented MVT
    sphalerite:  0.85,
    barite:      0.85,
  },
  cuprite:    { native_copper: 0.6, malachite: 0.7, azurite: 0.65, chrysocolla: 0.7 },
  azurite:    { malachite: 0.4, chrysocolla: 0.5 },     // primary CDR routes
  malachite:  { chrysocolla: 0.6 },
  // ... (one entry per documented MVT-relevant pair; ~30-50 entries total)
};

// Documented epitaxial pairs only — used for an additional "strict
// epitaxy" flag on the resulting crystal (drives habit + renderer).
// Pairs not in here use heterogeneous nucleation (no orientation match).
const EPITAXY_PAIRS = new Set([
  'sphalerite>pyrite', 'galena>pyrite', 'marcasite>pyrite',
  'sphalerite>marcasite', 'pyrite>marcasite',
  'sphalerite>galena',
]);
```

Engine integration: replace the existing `if (rng.random() < 0.7) pos
= 'on X #Y'` patterns with a new helper `sim._pickSubstrate(mineral)`
that consults the table, computes per-eligible-substrate weights from
the discount factor + substrate availability, and returns the chosen
host (or 'vug wall'). The σ-threshold check uses the discounted
threshold when a host is selected.

**Effect:** sphalerite preferentially nucleates on pyrite at lower σ;
calcite preferentially on fluorite. Snowball seeds form naturally
because the σ discount makes the seed-to-shell transition energetically
favorable when one host is available.

### Phase Q2 — Pseudomorph routes table (≈ 3 commits)

**Goal:** formalize the dissolve-then-replace chemistry that already
runs implicitly. Tag the replacement crystal so it inherits the
host's outline.

New table in `js/26-mineral-paragenesis.ts`:

```ts
// Pseudomorph routes: when the parent dissolves under a specific
// trigger, the child preferentially nucleates "after the parent" with
// outline-preservation enabled. Mirrors Putnis CDR: parent dissolves
// at a sharp interface, child precipitates from the local film, child
// inherits parent's external form.
const PSEUDOMORPH_ROUTES: Array<{
  parent: string;
  child: string;
  trigger: string;          // 'oxidative' | 'low_co3' | 'thermal' | 'acid' | 'hydration'
  shape_preserved: boolean; // default true; false for "feeds chemistry but new shape"
}> = [
  { parent: 'azurite',      child: 'malachite',    trigger: 'low_co3',   shape_preserved: true },
  { parent: 'azurite',      child: 'chrysocolla',  trigger: 'silica_pulse', shape_preserved: true },
  { parent: 'pyrite',       child: 'goethite',     trigger: 'oxidative', shape_preserved: true },
  { parent: 'marcasite',    child: 'goethite',     trigger: 'oxidative', shape_preserved: true },
  { parent: 'sphalerite',   child: 'smithsonite',  trigger: 'oxidative', shape_preserved: true },
  { parent: 'galena',       child: 'cerussite',    trigger: 'acid',      shape_preserved: true },
  { parent: 'galena',       child: 'anglesite',    trigger: 'acid',      shape_preserved: true },
  { parent: 'cuprite',      child: 'malachite',    trigger: 'low_co3',   shape_preserved: true },
  { parent: 'native_copper', child: 'cuprite',     trigger: 'oxidative', shape_preserved: true },
  // aragonite -> calcite is paramorph not pseudomorph (same composition)
  // — handled by PARAMORPH_TRANSITIONS, not here.
];
```

New crystal field: `cdr_replaces_crystal_id` (number | null). When a
crystal nucleates via a pseudomorph route, this is set to the parent's
id. The renderer reads this to inherit the parent's outline geometry
when `shape_preserved` is true.

**Effect:** the existing chemistry routes get explicit textural
semantics. Library and narrator can list "malachite-after-azurite
pseudomorph" instead of "malachite at position 'on azurite #X'". The
renderer in Q3 uses this to draw the outline.

### Phase Q3 — Encrustation rendering + outline-inherited pseudomorphs (≈ 3 commits)

**Goal:** make the textures visible.

Two renderer additions:

**(a) Encrusting shell visualization.** When a crystal has
`substrate_relationship === 'encrustation'` (set in nucleation when a
crystal nucleates "on X" with a thin-shell habit like
`botryoidal_crust`, `enamel_on_cuprite`), the renderer draws the
host as a "core" mesh and the encrustation as a slightly-larger,
slightly-translucent shell mesh. Three.js implementation: an outer
mesh with same geometry as the host but scaled +5% and given the
encrustation mineral's color/material. Optional: stippled outer edge
to read as polycrystalline.

**(b) Outline-inherited pseudomorphs.** When a crystal has
`cdr_replaces_crystal_id != null` and the route is `shape_preserved`,
the renderer uses the *parent's* habit primitive scaled to the
*child's* dimensions instead of the child's habit. Malachite-after-
azurite cube renders with the azurite cube outline; goethite-after-
pyrite renders with the pyritohedron silhouette filled in goethite's
color. Material color stays the child's; texture/material can carry
"porous" cue (Putnis's product porosity) via a roughness boost.

The geometry token resolution becomes:

```ts
const geomToken = (cdr_parent && shape_preserved)
  ? _habitGeomToken(cdr_parent.habit)   // inherit outline
  : _habitGeomToken(crystal.habit);     // own habit
```

No baseline impact — purely visual.

### Phase Q4 — Perimorph mechanic (≈ 2 commits)

**Goal:** allow a host crystal to fully dissolve while leaving its
encrusting shell as a hollow cast.

Crystal fields:
- `is_perimorph_shell` (boolean) — set when a crystal nucleates as
  encrustation. Means "if my host dissolves later, I become a cast,
  not orphaned debris".
- `host_dissolved` (boolean) — set when the host of a perimorph shell
  dissolves. Triggers renderer to draw with the "hollow cast" cue
  (slightly translucent, thin-shell geometry).

New simulator step: at the end of each `run_step`, scan crystals; for
any with `is_perimorph_shell && host` where `host.dissolved && !host_dissolved`,
flip `host_dissolved = true` and emit a narration event ("Quartz #14
became a perimorph cast — the fluorite host dissolved away, leaving
the silica shell.").

Eligibility for perimorph formation: only crystals nucleated as
`encrustation` substrate-relationship — not pseudomorph-replacement
(those have already replaced the host) and not standalone wall
nucleations.

Renderer: a perimorph shell mesh is drawn with `transparent: true,
opacity: 0.4, side: DoubleSide` so the user sees the hollow interior.

**Effect:** late-stage dissolution events that previously just removed
crystals now produce textures — the documented Cave-in-Rock and Cornish
quartz-after-fluorite type, plus emergent cases when the chemistry
favors host-only dissolution.

### Phase Q5 — Snowball habit (≈ 1-2 commits)

**Goal:** the snowball barite specifically. Radiating-epitaxy at the
population level — multiple individuals nucleating on a shared
substrate with similar orientations, then competing outward into a
spherical envelope. Boss directive: render as a sphere primitive, not
a true radial spray. The sphere geometry is evocative enough of the
final form for v1; the spray detail is v2 polish.

Mechanism (epitaxy at the population level):
- When a host mineral in `SNOWBALL_HOSTS` (sphalerite, galena, pyrite)
  has reached size threshold, AND the snowballing mineral (barite as
  the canonical case; extensible) has σ above its nucleation threshold,
  AND the host's surface area allows it, spawn ONE snowball-habit
  crystal positioned at the host with `habit: snowball`.
- The snowball crystal grows uniformly in all dimensions
  (c_length_mm == a_width_mm), rather than 1.5× tabular or 0.4×
  prismatic. The sim already has uniform-growth handling for cubic
  habits — extend it to snowball.

New habit token: `snowball`. Rendered as `THREE.SphereGeometry` with
the snowballing mineral's color, scaled by `c_length_mm` uniformly.
The host crystal is rendered underneath via the existing renderer
path; its location is the sphere's center. Cavity-clip from the
prior commit handles the case where the snowball outgrows the cavity.

This is *epitaxy at the population level* (boss's framing) — the
mechanism is `SUBSTRATE_NUCLEATION_DISCOUNT[host][snowballing_mineral]`
from Q1, just with a habit override that produces the spherical
aggregate visual instead of a single-crystal blade. The chemistry
runs as one nucleation; the visual shorthand reads as the
characteristic snowball.

Crystallographically separate from cyclic-chemistry shells:
- Snowball (Q5) — *epitaxy*, single nucleation event, one crystal,
  spherical shape derived from radiating-from-seed habit truncated to
  a sphere primitive.
- Cyclic-chemistry banded shells (Q3 encrustation) — *oscillation*,
  multiple nucleation generations, layered concentric bands, distinct
  composition zones from fluid-pulse history.

Both produce roughly spherical aggregates but for different reasons,
and the player should tell them apart by inspection (snowball has a
visible sulfide core + matrix; banded has visible color zones in the
sphere body itself).

**Effect:** the diagnostic Sweetwater barite snowball appears as a
sphere of barite around its sphalerite seed. Cave-in-Rock-style
banded barite (when cyclic chemistry triggers) appears as concentric
shells via Q3 — a different visual texture for a different mechanism.

---

## 5. Scenarios that get richer

| Scenario | Current state | After Q1+Q2 | After Q3 | After Q4 | After Q5 |
|---|---|---|---|---|---|
| `mvt` (Tri-State) | sphalerite + galena + barite + calcite as independent crystals | sphalerite-on-pyrite epitaxy, calcite-on-fluorite stacking | encrustation visible (bands) | (no perimorph in MVT typical) | snowball barite |
| `bisbee` (supergene) | malachite/azurite/chrysocolla/cuprite as independent | CDR routes formal | pseudomorph outlines render | rare cuprite-cast textures | — |
| `ouro_preto` (topaz) | topaz/quartz | quartz-on-topaz overgrowth | overgrowth bands | — | — |
| `sweetwater` (MVT, Viburnum) | barite/sphalerite/galena/calcite | snowball seed nucleation | banded barite | — | snowball barite (signature texture) |
| `colorado_plateau` | uranyl minerals | clearer route paths | — | — | — |

The three "snowball" / "stacked" scenarios (mvt, sweetwater,
cave-in-rock-equivalent) gain their diagnostic textures. Bisbee /
supergene scenarios get explicit pseudomorph outlines. Pegmatite
scenarios mostly unaffected (pegmatites are competition-grown
free-floating crystals, not stacked phases).

---

## 6. Phasing

Recommended commit order, dependency-honoring:

1. **Q1a** — empty `26-mineral-paragenesis.ts`, table type definitions,
   no entries. Wire `sim._pickSubstrate` helper. (byte-identical)
2. **Q1b** — populate table with 30+ documented pairs. Replace inline
   substrate-pick in 5–6 nucleation files. (calibration shift —
   SIM_VERSION bump, baseline regen)
3. **Q1c** — wire σ-discount into nucleation threshold check.
   (calibration shift — bigger; expect MVT scenarios to nucleate more
   sulfide-on-sulfide overgrowths than before)
4. **Q2a** — add `PSEUDOMORPH_ROUTES` table; tag existing implicit
   routes with explicit `cdr_replaces_crystal_id`. (byte-identical
   if I'm careful — no chemistry change)
5. **Q2b** — narrator + library: surface "X-after-Y" framing in
   tooltips and inventory.
6. **Q3a** — renderer outline-inherit for shape-preserved
   pseudomorphs.
7. **Q3b** — renderer encrustation shells (separate mesh).
8. **Q4** — perimorph mechanic.
9. **Q5** — snowball / radiating-from-seed habit.

Q1c and Q5 are the big calibration impacts. Plan a baseline regen pass
after each, run the calibration sweep, document drift in the
SIM_VERSION changelog with the Phase 1e per-scenario table format.

---

## 7. Open questions

### Resolved by boss 2026-05-06

1. **Scope of snowball**: ANSWERED — radiating epitaxy is primary
   (Q5). Cyclic-chemistry shells are encrustation (Q3). Mechanisms
   stay separate; player should tell the textures apart by sight.
2. **Snowball geometry detail**: ANSWERED — sphere primitive is
   acceptable for v1. Radial-spray detail is v2 polish. Q5 collapses
   accordingly.

### Open for boss

3. **Strict-epitaxy flag**: I've proposed an `EPITAXY_PAIRS` set
   alongside the soft-discount table. The flag would unlock
   crystallographically aligned habit (e.g. sphalerite-on-pyrite
   tetrahedra aligned to pyrite's cube faces). Worth the modeling
   cost, or skip for v1 and treat all overgrowths as orientation-
   independent?

4. **Pseudomorph porosity**: Putnis 2009 emphasizes that CDR
   pseudomorphs are *porous* in the product phase (volume mismatch
   accommodation). I've proposed treating this as a renderer-only
   roughness boost. Do we want a real `porosity` field on the
   crystal, surfaced in the library / used by later water-soluble
   re-dissolution mechanics?

5. **Perimorph eligibility**: as proposed, only encrustation-shells
   become perimorphs. Should pseudomorph-replacement products be
   eligible too if late chemistry dissolves them in turn? (i.e.
   malachite-after-azurite later dissolves → empty cavity. Does the
   azurite outline "ghost" persist?)

6. **Calibration target**: Q1c (σ discount) is the biggest drift.
   I'd like to commit it then iterate the discount values until the
   per-scenario crystal counts fall back within ±10% of v53 baselines.
   Worth it, or should the discount be smaller (more conservative —
   epitaxial pairs at 0.7 instead of 0.5) to keep scenarios closer to
   their existing tuning?

7. **MVT-specific perimorph cite**: I want to ground Q4 in a
   documented MVT specimen rather than just borrowing the Cumbria
   quartz-after-fluorite case. Heyl 1968 (UMV district textures) and
   Hagni's Tri-State petrography papers are the candidates — worth a
   targeted literature dive, or accept the analog from Cumbria/
   Cornwall as good enough?

---

## References

- **Sangster** 1983, *Mineralium Deposita* 18 — MVT framework. 1990
  review.
- **Putnis** 2002, *Mineralogical Magazine* 66 (Vol 5, pp689-708);
  2009, *Reviews in Mineralogy and Geochemistry* 70 — coupled
  dissolution-precipitation, the modern CDR framework.
- **Ramdohr** 1980, *The Ore Minerals and Their Intergrowths* — the
  pseudomorph and sulfide intergrowth catalog.
- **Stanton** 1972, *Ore Petrology* — texture interpretation and
  epitaxial relationships.
- **Grigor'ev** 1965, *Ontogeny of Minerals*; Sunagawa 2005, *Crystals:
  Growth, Morphology, and Perfection* — encrustation as growth-front
  competition.
- **Hagni** Tri-State petrography papers; **Heyl** 1968 UMV district —
  MVT-specific texture documentation.
- **L'Heureux** 1993 onward — self-organized oscillatory banding in
  hydrothermal systems.

Frenzel-on-snowball and specific Cave-in-Rock / Elmwood lattice-match
data: marked "verify" in the science layer; should be checked before
the corresponding entries land in the table.

---

*The simulator already grows the right minerals in the right order in
the right scenarios. This proposal makes the resulting specimens look
like the real thing.* 🪨
