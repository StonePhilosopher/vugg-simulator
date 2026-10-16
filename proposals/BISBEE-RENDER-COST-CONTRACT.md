# Bounded Bisbee rendering cost contract

This tranche addresses CPU construction of surface-growth lining meshes in
`_emitSurfaceGrowthLining`. It changes lookup and allocation work only.

The workload is the production Bisbee scenario at step 340, simulation seed 42,
authored cavity seed 13, and a 1000 by 760 drawing buffer at device pixel ratio 1.
The reference is commit `ce93e2fd20d2d50d7f4ffcfa82c67ae1b95737f5`.
One Windows host and its hardware WebGL renderer are the measurement envelope.

## Authority and fidelity

| Property | Existing authority | Required preservation |
| --- | --- | --- |
| Crystal identities, chemistry, accepted growth, zones and history | Simulation records | No inputs or growth code changes; unchanged record witnesses |
| Cavity surface and booked footprint | Existing authenticated surface and patch | Same source, coverage and triangle membership |
| Recorded mean layer thickness and layering relationships | Existing surface-growth records | Same values and layer ordering |
| Exact lining triangulation, mound relief, feathering and fold repair | Existing procedural display completion | Same geometry bytes, topology, contacts and metadata; preserve `representative_only` |
| Materials, lighting, camera, subdivision and quality | Presentation | No altered settings, resolution, visibility thresholds or simplification |

Bitwise agreement proves preservation of the existing result, not geological
validation of its procedural details. No new physical claim is made about the
crust's exact relief, interior zoning or inclusion positions. There is no change
to the mass/volume authority or to the scientific model.

The differential comparison uses the same specimen and matches pipeline stages:
construction is compared with construction. Initial construction and later
reconstruction are recorded separately. Subsequent camera/material state updates
must not be mistaken for a difference in geometry construction.

## Acceptance thresholds

The construction and steady-frame thresholds were recorded before the first
candidate timing comparison:

- Exact equality of geometry attributes and indices, transforms, instance
  matrices, representation metadata and material settings at matched stages.
- Focused physical-thickness, footprint, contact, fold, replay and viewport
  invariance tests pass. Disposing and reconstructing geometry preserves it.
- At least 15% improvement in median crystal mesh construction time across six
  alternating pairs on the same specimen. Profiling runs are separate from
  timed comparisons; repeated construction uses warm caches.
- No steady CPU/GPU regression exceeding the greater of 10% and 1 ms. Unavailable
  or disjoint GPU timings are reported as unavailable, never inferred from CPU
  submission time. Compare identical camera paths and quality settings.
- No retained geometry/texture/program count increase. Heap observations include
  forced-GC retained samples; they are not a claim to measure VRAM or peak RSS.

Keep raw samples and CPU profiles with exact input hashes, browser/GPU/runtime
identity and commands. No fleet-wide speedup or interactive frame-rate improvement
is inferred from faster mesh construction. The initial profile measured about
10 seconds in crystal mesh construction; subsequent CPU redraws were about
5–12 ms on this host. They are different costs.

## Reproduction

After building the current sources, run `node tools/bisbee-render-benchmark.mjs`.
The pinned base commit must be available locally. Output is measurement-only
under `.local-evidence/bisbee-render-benchmark/`; the tool owns an isolated browser
profile and loopback server, records their identities, and closes them in `finally`.
It does not write scientific baselines or receipts.

Use `--cold baseline` or `--cold candidate` for a separate first-construction
CPU profile. Cold profiles include profiler overhead and are diagnostic samples,
not the six-pair acceptance statistic. Each invocation creates a new UUID output
directory and preserves the exact measurement-tool source and input hashes.

## Measurement boundaries

The reference function comes from the pinned commit; the candidate is loaded
from the current generated game. Only this one function is swapped. Both use the
same completed specimen, production renderer, quality, drawing buffer and camera
path. No growth steps run between construction samples. There are six alternating
AB/BA pairs, with no discarded timing samples. Host CPU occupancy is recorded;
this is not a claim that the entire workstation was idle or reserved.

The scientific witness serializes enumerable crystal state as JSON, plus the
bulk-fluid projection, RNG state, step and cavity-evolution signature. Shared
object references have explicit paths. The explicitly excluded crystal fields
are existing disposable display caches:
`_gwindelGeom`, `_gwindelGeomTd`, `_sceptreGeom`, `_sceptreGeomCf`, `_saddleGeom`,
`_saddleGeomAmp`, `_bentGeom`, and `_bentGeomAmt`. Geometry witnesses hash every
attribute/index buffer and instance matrix, and retain transforms, groups,
representation metadata and selected material properties. These comparisons
test preservation; the analytic contact/thickness tests and the existing science
audits provide separate checks of the modeled quantities.

The existing full-group rebuild can retain some shared geometries. The probe
explicitly disposes its crystal geometries and clears the display geometry cache
between independent constructions so this pre-existing behavior cannot give a
later sample a different resource burden. That lifecycle issue is outside this
tranche. Scientific surface caches remain warm.

Steady CPU submission and GPU elapsed time are measured over the same 36 camera
positions. GPU timer-query polling introduces gaps between frames: these are
elapsed-cost samples, not an interactive FPS measurement. Missing or disjoint GPU
queries make the GPU gate inconclusive. Retained V8 heap uses
`Runtime.getHeapUsage` after forced garbage collection; the comparison rejects a
regression above 10%. Post-construction `performance.memory` observations are
also retained, but are neither peak RSS nor VRAM measurements. Both kinds of heap
sample include measurement state shared by the two variants.
