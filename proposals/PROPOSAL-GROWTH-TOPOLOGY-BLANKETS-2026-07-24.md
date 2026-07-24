# PROPOSAL - growth topology: blankets, coatings, crusts, and aggregates

Date: 2026-07-24. Status: **proposal / audit-first**. Trigger: Elmwood
Ba-bearing celestine exposed the deeper problem. Boss said every locality
carve-out feels like missing the science, then named "blanket" as the missing
descriptor for massive microcrystalline coatings: chalcedony, hematite, and
manganese oxide surfaces are the obvious non-celestine examples.

## 0. Thesis

The sim currently overloads `habit` with at least three different geological
concepts:

1. **Crystal form** - the ideal individual crystal shape: tabular, prismatic,
   acicular, rhombohedral, scalenohedral, cubic, etc.
2. **Aggregate texture** - the population-scale texture: druzy, botryoidal,
   fibrous, mammillary, earthy, massive microcrystalline, plumose, granular.
3. **Surface relationship** - how the material occupies the vug: free-standing
   crystal, wall lining, rind, coating, blanket, replacement, interstitial fill.

This works for isolated euhedral crystals. It fails for "blanket" minerals
because a blanket is not a weird crystal shape. It is a surface-mode plus an
aggregate texture. Chalcedony is not a quartz prism with a strange aspect ratio;
hematite or Mn oxide coatings are not individual oxide crystals standing upright;
Elmwood barian celestine is probably not simply "fibrous celestine" but a
Ba-Sr sulfate fibrous/microcrystalline aggregate blanketing earlier gangue.

The proposal: split the concept space before adding more exceptions.

## 1. Proposed model vocabulary

Keep `habit` for the individual-form tendency, but introduce two new explicit
axes:

```ts
aggregate_texture:
  | 'single_crystal'
  | 'druzy'
  | 'botryoidal'
  | 'mammillary'
  | 'fibrous'
  | 'plumose'
  | 'microcrystalline'
  | 'massive'
  | 'earthy'
  | 'granular'
  | 'colloform'
  | 'dendritic'
  | 'skeletal'

surface_mode:
  | 'free'
  | 'wall_lining'
  | 'rind'
  | 'coating'
  | 'blanket'
  | 'interstitial_fill'
  | 'replacement'
  | 'pseudomorph'
```

These are descriptive first, behavioral second. The first tranche should be
able to tag and render without changing chemistry. Later tranches may let
blankets consume surface area, occlude substrates, bridge older crystals, and
alter nucleation opportunities.

## 2. Why `blanket` deserves first-class status

Blanket growth has different physics and a different visual contract from
free euhedral growth:

- It spreads laterally over an existing substrate more than outward into open
  vug space.
- It may bridge multiple older crystals or smooth the space between them.
- It often appears as a texture/color skin, not as discrete crystals.
- It can preserve the underlying object's silhouette while changing its surface
  read.
- Its limiting resource is often usable surface area / boundary-layer supply,
  not only bulk vug volume.
- It may be built from many tiny crystallites whose individual habit is not
  visible at normal render scale.

This gives a science-shaped replacement for locality carve-outs:

```text
Ba-Sr sulfate + MVT carbonate vug + existing sphalerite/calcite/barite substrate
+ coating/interstitial topology -> fibrous/plumose celestine blanket
```

Elmwood becomes a tenant of a general axis, not a special-case exception.

## 3. Existing partial handles in the code

Do not build blind. The code already contains partial, overlapping machinery:

- `js/07-habit-variant.ts` has `vector` classes including `coating`, and
  space-constrained scoring favors coating/tabular over projecting forms.
- `js/98d-ui-zone-shape.ts` has a zone-viz dispatcher and explicitly lists
  future renderers for `projecting`, `tabular`, `coating`, and `dendritic`.
- `js/45-morphology.ts` has `OCCLUSION_SKIP_HABIT`, which already treats
  crusts/coatings/films/massive/fibrous/sprays/rosettes as non-euhedral
  aggregates that should not be rooted like individual crystals.
- `js/26-mineral-paragenesis.ts` has substrate discounts and pseudomorph routes,
  including shape-preserving surface skins.
- Growth engines already use words like `drusy_crust`, `fibrous_coating`,
  `earthy_crust`, `botryoidal`, `massive_granular`, `pseudomorph_after_*`,
  and `coating` inside `crystal.habit`, `dominant_forms`, `position`, and notes.
- Some render paths already know about cluster/aggregate overrides, but the
  concepts are not centralized.

That means the work is not "invent blankets." The work is "audit the existing
blanket/coating vocabulary, separate the axes, then migrate carefully."

## 4. Required audit before implementation

**This audit is mandatory. No behavior-moving commit should happen before it.**

The audit must list every file, field, and test surface that reads, writes, or
infers any of:

```text
habit
habit_variants
vector
dominant_forms
position
growth_environment
wall_spread
void_reach
_occlusion
cdr_replaces_crystal_id
perimorph_eligible
_volume_mm3
a_width_mm
c_length_mm
vugFill
```

The audit must also grep and classify every existing habit/name/note containing
these texture/surface words:

```text
blanket
coat
coating
crust
drusy
druzy
botryoidal
mammillary
reniform
colloform
fibrous
plumose
microcrystalline
massive
earthy
powder
granular
sinter
film
rind
skin
replacement
pseudomorph
interstitial
```

For each hit, classify it into one of four buckets:

1. **True habit/form** - keep in `habit`.
2. **Aggregate texture** - candidate for `aggregate_texture`.
3. **Surface mode** - candidate for `surface_mode`.
4. **Narrative-only descriptor** - keep in notes/narrator, not state.

The audit output should be a checked-in document before build work begins:

```text
research/AUDIT-growth-topology-blankets-2026-07-24.md
```

Minimum audit sections:

- Engine writes by mineral and file.
- Nucleation/substrate writes by mineral and file.
- Render reads and geometry dispatch.
- UI/card/narrator reads.
- Baseline/strip serialization impact.
- Scenario tenants that should change or should explicitly stay unchanged.
- Proposed first tenants.
- Risks and unknowns.

## 5. Suggested tranches

### B0 - Audit only, byte-identical

Deliver `research/AUDIT-growth-topology-blankets-2026-07-24.md`.

No code behavior changes. No SIM bump. Required commands:

```bash
rg -n "habit|habit_variants|vector|dominant_forms|position|growth_environment|wall_spread|void_reach|_occlusion|cdr_replaces_crystal_id|perimorph_eligible|_volume_mm3|a_width_mm|c_length_mm|vugFill" js tests-js tools data
rg -n "blanket|coat|coating|crust|drusy|druzy|botryoidal|mammillary|reniform|colloform|fibrous|plumose|microcrystalline|massive|earthy|powder|granular|sinter|film|rind|skin|replacement|pseudomorph|interstitial" js tests-js tools data
```

The audit should name exactly which later commits can be render-only and which
must be baseline-moving.

### B1 - State fields, inert / backfilled, byte-identical

Add optional fields to `Crystal` or its persisted shape:

```ts
aggregate_texture?: string;
surface_mode?: string;
```

Backfill them from existing `habit`/`vector` only for display/debug, or keep them
undefined until B2. The preferred first commit is inert: fields may exist but no
render, growth, fill, nucleation, or serialized baselines should move.

Acceptance:

- Full baseline byte-identical.
- Save/load tolerant of missing fields.
- Crystal cards can display the fields only if present.

### B2 - Classifier / extractor, render-neutral

Add a deterministic classifier that derives texture/mode tags from the existing
habit/vector/position words without changing behavior:

```ts
classifyGrowthTopology(crystal, sim) -> {
  aggregate_texture,
  surface_mode,
  confidence,
  source
}
```

This should run after growth/habit selection, like the existing morphology
classifiers. It must not change volume or nucleation. This is the safe bridge
from scattered words to a stable axis.

Acceptance:

- Baselines byte-identical if tags are not serialized into count/size digests.
- A topology census prints counts by mineral/scenario/texture/mode.
- Tests pin representative classifications:
  - chalcedony -> microcrystalline + blanket/coating
  - chrysocolla/malachite skins -> botryoidal or microcrystalline + coating
  - hematite/goethite/Mn oxide coatings -> earthy/microcrystalline + rind/coating
  - Elmwood Ba-bearing celestine -> fibrous/plumose + blanket/interstitial_fill
  - free celestine geode/evaporite -> tabular/bladed/prismatic + free/wall_lining

### B3 - Render-only blanket/coating visual

Add a visual treatment for `surface_mode in {'coating','blanket','rind'}`.

Initial target: render-only, SIM-neutral. The renderer should not build a forest
of upright needles. It should draw a low-relief surface layer:

- lateral spread over host/wall,
- texture noise or stipple for microcrystalline material,
- optional fibrous/plumose directional strokes,
- color/opacity skin over the substrate,
- thickness derived from crystal size but capped so it reads as a layer.

Likely touchpoints:

- `js/99i-renderer-three.ts`
- `js/99d-renderer-wireframe.ts`
- `js/99c-renderer-primitives.ts`
- `js/98d-ui-zone-shape.ts`
- interaction/hover text if it reports geometry.

Acceptance:

- SIM baselines unchanged.
- Desktop/browser visual check for at least one blanket tenant.
- Coating crystals are not occlusion-rooted like euhedral crystals.
- No existing euhedral crystal loses its expected form.

### B4 - Behavior-moving topology, SIM bump

Only after B0-B3 are stable, allow topology to affect growth behavior:

- blankets consume/cover surface area,
- blankets can bridge older crystals,
- blankets may reduce available substrate for later nucleation,
- blankets may create new substrate for later phases,
- vug fill may need a surface-area component separate from volume.

This is a SIM bump and rebake. It must include a baseline plan and a casualty
list before coding.

## 6. First tenants

Recommended first tenants, in order:

1. **Chalcedony / agate / jasper-like silica** - the canonical microcrystalline
   blanket/lining axis. This teaches the renderer without confusing sulfate
   chemistry.
2. **Hematite/goethite/limonite and manganese oxide coatings** - color/skin
   blankets over existing surfaces; important for specimen realism.
3. **Chrysocolla/malachite/brochantite Cu coatings** - supergene skins and
   botryoidal crusts; good surface-mode tenants because substrate is known.
4. **Elmwood Ba-bearing celestine** - fibrous/plumose blanket/interstitial fill
   after the sulfate split is handled.

Elmwood should not be the first code tenant unless the S2 sulfate work is already
underway; otherwise the topology arc gets entangled with sulfate availability.

## 7. Explicit non-goals

- Do not implement `if locality === 'elmwood'`.
- Do not make all celestine fibrous.
- Do not make `Ba > threshold` a universal fibrous rule.
- Do not replace habit with texture; keep crystal form when it matters.
- Do not move `_volume_mm3`, `vugFill`, or nucleation behavior in the render-only
  tranches.
- Do not add more habit strings like `fibrous_blanket_coating_crust` as the final
  architecture. Compound words are a symptom of the missing axes.

## 8. Required verification

Every tranche must say whether it is:

- byte-identical / no SIM bump,
- render-only / no SIM bump but visual check required,
- baseline-moving / SIM bump required.

Minimum command set for behavior-moving tranches:

```bash
npm run build
npm test
node tools/gen-js-baseline.mjs
node tools/gen-strip-digest.mjs
node tools/gen-strip-archive.mjs
node tools/baseline-diff.mjs
```

If the tranche touches sulfate, redox, brine, nucleation, or fill behavior, also
run the standing specialty censuses that apply in the current handoff. Do not
guess: the B0 audit must name them.

Visual verification is mandatory for render tranches:

- at least one free euhedral control,
- at least one wall lining,
- at least one blanket/coating tenant,
- at least one pseudomorph/replacement tenant if touched,
- desktop and narrow viewport if the browser UI is involved.

## 9. Success criterion

The success state is not "Elmwood celestine is fibrous." That is too small.

The success state is:

```text
Vugg can represent a mineral as either a free crystal or a surface-bound
aggregate, without lying about its crystal form.
```

Then chalcedony blankets, oxide coatings, supergene skins, pseudomorph rinds,
and Elmwood barian celestine all use the same scientific axis. The carve-out
turns into bedrock.
