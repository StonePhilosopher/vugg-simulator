# Calcite Scientific-Solid Authority v1

This is an **isolated calcite contract**, with production integration held. It
preserves growth history and independently reconstructible surfaces. It does
**not** resolve the disagreement between the current mass model and geometric
completion. A reproducible surface is not necessarily a scientifically resolved
solid.

The explicit scientific decision for this tranche (2026-10-21) is:

> Preserve mass rules; record factors; hold production.

No growth, chemistry, density, fill, calibration, shipped save format, or shipped
renderer changes here. In particular, the shipped recipe-based save/load path
still reruns growth. This pilot's specimen save/load and `CalciteRecordPlayer`
are a separate data boundary, not a claim that production saves already have
that property. No performance improvement is claimed by this tranche.

## Source and delivery boundary

The branch starts at reviewed `ab79f195` (the same tree as `f3d1384a`). Canonical
promotion is [StonePhilosopher PR #11](https://github.com/StonePhilosopher/vugg-simulator/pull/11),
pinned to `f3d1384af266cd6a08a9b24491442204523e2213`. Canonical was still
`e75bb4c6` when this work started; the available account has no write permission
there and its workflow requires owner approval. This work must not be described
as already based on a completed canonical promotion.

Only `capture.mjs`, `specimen.js`, and `render.js` were selectively transplanted
from pilot `5c6f11c80e31a582dbc86863a1418267b0731341`, then adapted. No merge
from that divergent base, old recording, old receipts, benchmark apparatus, or
old browser launcher was imported. PR #21's celestine layer is not included.

## One specimen, with a history

`CalciteAuthorityWriter` writes a frozen JSON-compatible specimen:

- A **nucleation event** records identity, initial habit, anchor, and procedural
  orientation at birth. These are never recomputed from later fluid.
- Each **accepted zone event** immediately copies the actual accepted zone,
  morphology inputs at acceptance, and dimensions/booked volume before and
  after `Crystal.add_zone`. Negative zones are dissolution; renewed positive
  material after a negative zone is regrowth. The growth driver never invents
  these events by differencing a final mesh.
- A **same-step finalization** preserves later receipt additions without
  overwriting the acceptance record. A later mutation of an older zone becomes
  a separate **unresolved overprint**, retaining both values and its observation
  time. Observing the mutation does not establish its geological cause.
- Each **end-of-step frame** preserves contemporaneous morphology inputs,
  orientation, dimensions, accepted material, and completed planes/polygons.
  Earlier frames never consult the final habit, split index, or fluid. Contact
  planes name their neighbors; their approximation status stays with them.

Recording must begin with nucleation; missing early history is rejected rather
than backfilled from a final crystal. Saving this specimen supports inspection
and replay, not resuming the physical solver. This bounded prototype retains
full frames and zone copies; it is not a production memory/storage policy.

The isolated growth adapter installs synchronous hooks only while advancing its
own simulation, then restores them in `finally`. It captures all calcite facts,
including calcite whose surface is unsupported. Only plain untwinned fluid-grown
rhombohedral/scalenohedral Wulff bodies receive completed surfaces. Aggregates,
air growth, twins, enclosed crystals, and unmodeled habits are excluded explicitly.
Contacts with other minerals and cavity clipping remain outside the pilot.

`loadCalciteSpecimen` validates chronology, lineage, zone custody, inventory,
closed oriented surfaces, preserved planes, and volume factors, then freezes its
own copy. `CalciteRecordPlayer.atStep` returns an exact stored frame. It neither
interpolates a past body from a later one nor loads a simulator. `SpecimenView`
receives that frame plus Three.js; its only geometry-quality choice is planar
subdivision. No scaling, smoothing, new contacts, inclusion placement, or
current-fluid classification is available to the adapter.

Historical outer envelopes are **not** surviving buried-zone surfaces. There is
no claim to resolved internal zoning, face arrest/retreat, dissolution
microtopography, or inclusion coordinates. Unresolved surfaces are not filled in
and relabeled as scientifically resolved.

## Authority by property

| Property | Authority in this tranche | Limit |
| --- | --- | --- |
| Mineral identity and origin | Recorded model nucleation | Not independent occurrence validation |
| Accepted zones, composition, dimensions, booked inventory | Existing growth model at acceptance | Dimensions belong to its ellipsoid inventory convention |
| Dissolution and regrowth | Actual accepted negative/positive zones and receipts | Does not resolve face retreat or surviving internal boundaries |
| Habit/form inputs and Wulff surface | Recorded, procedurally completed | Existing calibrated classifiers and envelope; not integrated face trajectories |
| Axis and yaw | Recorded procedural placement/orientation | No inferred crystallographic measurements |
| Attachment and contacts | Recorded procedural planes | Existing half-form/O1b/O2 approximations, not simulated arrest |
| Later mutations of old material | Explicit unresolved overprint | A recorded change is not proof of a modeled cause |
| Subdivision, wireframe, lighting/camera, mesh lifetime | Display only | Cannot change the specimen, inventory, boundaries, or physical scale |

The authored fixture's identity and composition are marked procedural too. A
test author supplying Mn values is not a chemical model predicting them.

## The two volumes and their relationship

`bookedVolumeMm3` is the existing accepted-zone inventory used by chemistry,
cavity fill/occupancy, and dissolution inventory return. For positive growth it
integrates ellipsoid shell coefficients at each zone's then-current aspect
ratio. The present `a_width_mm` is derived from that inventory and `c_length_mm`:

```
V_booked = (pi / 6) * a_width_mm^2 * c_length_mm
```

`completion.volumeMm3` is the enclosed volume of the **completed procedural
surface**, at physical units and with `visibilityScale = 1`. The existing Wulff
completion normalizes its full form by maximum absolute coordinate and scales
isotropically by the captured `c_length_mm`. It does not separately enforce the
mass model's `a_width_mm`. It then applies the attachment and neighbor contact
planes. The half-form construction describes missing growth on the substrate
side; it does not prove that the missing volume exists invisibly behind the wall.

Each recorded completion names these stages and measured factors:

```
F_form       = V_full_Wulff / V_booked
F_attachment = V_attached / V_full_Wulff
F_contact    = V_completed / V_attached
V_completed  = V_booked * F_form * F_attachment * F_contact
```

The full Wulff stage includes the recorded O1a exposure and O1b scalar neighbor
shadow. Contacts are the later O2 clipping stage. `F_form` is a measured
**representation factor** for this particular record, not a universal calcite
shape constant. Factors are not porosity, occupancy, hidden material, a density
correction, or a scientific calibration. Attachment/contact retention cannot
exceed one beyond tolerance. Conversion closure uses `max(1e-10 mm³,
1e-8 * V_completed)`; this checks arithmetic, not geological closure. Mesh
float precision is not fed back into any volume calculation.

The default MVT endpoint makes the conflict concrete: booked inventory is about
5,425.56 mm³, the full Wulff body about 1,363.92 mm³, and the attached completed
body about 813.67 mm³. Thus `F_form ≈ 0.2514`, `F_attachment ≈ 0.5966`, and
`F_contact = 1`. There is substantial disagreement before any contact clipping.
The old pilot's 21.6–31.7% range was not a rounding tolerance or a fleet-wide
constant. No renderer rescale or inventory rebake is used to hide it.

Only booked inventory may feed chemistry, fill, occupancy, and inventory return.
Completed geometry may feed reconstruction and surface inspection. It may not
feed conserved mass, nucleation space, dissolution return, or a physical
porosity claim. Reports must retain both quantities with their authority labels.

## Factor diagnosis and coverage

`factor-coverage.json` provides a second, read-only audit. It re-intersects the
stored form planes, form-plus-attachment planes, and all contact planes to check
each volume independently. Merely multiplying mutually compensating factors is
insufficient: a full-form volume doubled while its attachment factor is halved
still closes algebraically, but this audit rejects it against the saved planes.

For the saved specimens, the audit also compares the full body's measured a/c/b
extents with booked dimensions. An ellipsoid fitted to those extents supplies a
**diagnostic reference**, allowing the full/booked ratio to be written as:

```
(bounding-reference volume / booked volume)
  * (full polyhedron volume / bounding-reference volume)
```

This helps distinguish incompatible extents from the volume of a faceted shape
within those extents. It is a chosen arithmetic comparison, not a unique causal
attribution, a new solid model, a density/porosity inference, or permission to
rescale geometry. O1a/O1b remain included in the recorded full-form stage.

Coverage is kept separate by source:

| Source | Supported crystal-steps | Habit | Contact/dissolution/regrowth evidence |
| --- | ---: | --- | --- |
| Authored two-generation fixture | 9 | Rhombohedral | 8 active-contact samples, 2 dissolution and 2 regrowth samples; authored accepted material |
| Live Elmwood, explicit old-pilot Wulff override | 9 | Scalenohedral | 9 growth samples; no active-contact, dissolution, or regrowth samples in this supported subset |
| Authored-default fleet | 116 | MVT scalenohedral only | No measured contact volume loss; phase labels and contact topology were not captured by the scalar receipt and remain unknown |

All 5 fixture frames and 16 Elmwood frames retain their factors and reconstructed
meshes through save/load and complete teardown. That does not turn the fixture's
contact/dissolution examples into live geological validation. The fleet receipt
lacks preserved planes for this additional extent comparison; the report marks
that limitation rather than reconstructing them from final habits. Other habits
and scientifically modeled contact/dissolution episodes remain evidence gaps.

## Separate acceptance criteria and production gate

1. **Scientific custody:** immutable formation events; contemporaneous inputs;
   explicit procedural/unresolved properties; unchanged existing inventory.
   This is not independent geological validation.
2. **Rendering independence:** growth → specimen serialization → load → exact-step
   replay → complete mesh teardown/rebuild produces the same geometry. Camera,
   wireframe, and planar subdivision do not change recorded facts or boundaries.
3. **Physical solid closure:** currently **unresolved**. `calciteProductionGate`
   remains false in code, and a saved flag cannot open it. A future supported
   decision must reconcile mass, dimensions, full form, attachment, and contacts,
   with a new drift census. Face arrest/retreat and surviving internal boundaries
   remain separately unresolved.
4. **Measured performance:** no new performance claim. Earlier measurements are
   not imported as evidence for this different contract.

Passing custody and replay tests does not open the physical-solid gate. No calcite
path in the shipped renderer opts in here.

## Reproduce

Use the commissioned Windows x64 / Node 24.15.0 runtime for the census and golden
producer. Install dependencies with `npm ci`, then:

```sh
npm run build:check
npm test -- --file tests-js/calcite-solid-authority.test.ts
node pilots/calcite/record.mjs
node pilots/calcite/factor-report.mjs
node --max-old-space-size=512 pilots/calcite/census.mjs --output pilots/calcite/volume-census.json
```

The census runs every baseline scenario, serially, seed 42, at its authored
duration with **no Wulff flags overridden**. It includes empty and unsupported
rows, every eligible historical step, final-stage volumes, source hashes,
runtime identity, and noninterference checks. Excluded calcites do not disappear
from the census denominator. This is an observation receipt, not a rebaked
baseline or a geology certification.

The checked-in census covers 41 authored scenarios and 44 endpoint calcite
records. One endpoint body qualifies for this surface subset; the other 43 are
explicit exclusions. There are 116 supported historical crystal-steps (MVT steps
5–120), with completed/booked ratios from about 14.7% to 32.7%, zero completion
errors, and no observed simulation/crystal mutation. These samples do not
establish a universal shape factor or coverage of the excluded habits.

The regression also replays the old pilot's explicitly Wulff-enabled Elmwood
configuration for 16 steps, comparing every captured trajectory fingerprint and
all crystal bytes against an uncaptured run. That case is distinct from authored
default Elmwood and from the fleet census.

`record.mjs` produces inspectable `controlled.json`, `elmwood.json`, and
`proof.json` in `.local-evidence/calcite-authority-v1/specimens/`. It reconstructs
every frame before and after save/load, destroys the meshes between frames, and
checks that geometry and material groups agree without further growth. The
specimen files can be passed directly to `loadCalciteSpecimen` and
`CalciteRecordPlayer`; no recipe, simulator state, or fluid is needed to play them.

`golden.json` fixes the authored two-generation/contact/dissolution/regrowth
fixture's full specimen digest, five reconstructed geometry digests, and booked
volumes. `node pilots/calcite/golden.mjs` regenerates it from actual model calls;
review a change in those values rather than treating regeneration as a fix.
CI runs the focused authority file through the existing bounded test runner.

## Scientific context, not imported calibration

[Prajapati, Selzer & Nestler (2017)](https://link.springer.com/article/10.1186/s40517-017-0072-1)
validate a calcite phase-field shape using volume preservation, then model growth
and grain interactions. Their method does not supply a conversion coefficient
for Vugg's ellipsoid/Wulff discrepancy. Likewise,
[Sekerka (2005)](https://onlinelibrary.wiley.com/doi/10.1002/crat.200410342)
distinguishes equilibrium and growth shapes; fixed-volume equilibrium reasoning
does not validate Vugg's calibrated kinetic envelope. The present decision is to
expose and preserve the conflict, not borrow an unrelated paper's parameters to
make it disappear.
