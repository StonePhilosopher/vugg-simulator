# PROPOSAL: Topology-independent cavity surface anchors

> **Status:** Implemented as SIM 264; the simulation authority passed its AI
> hostile review, while the hardened reproducibility-evidence review and final
> uninterrupted evidence workflow remain in progress for
> `PROPOSAL-MARCHING-CUBES-CAVITY.md` Tranche 4.
>
> **Decision rule:** Follow the science. A crystal is attached to a physical
> point and local substrate normal, not to an accident of tessellation.

## 1. Problem

`Crystal.wall_anchor` is currently `{phi, theta, ringIdx, cellIdx}`. The first
pair survives a denser star-shaped tessellation, but no spherical direction can
distinguish two wall crossings on an undercut, throat, or connected chamber.
The second pair is a chemistry-grid address, not a surface identity. Treating
either as the crystal's position would make non-star-shaped cavities visually
possible while leaving nucleation, growth, occupancy, and replay on the old
sphere.

Tranche 4 therefore changes the positional contract before any production
scenario is allowed to depend on non-star topology.

## 2. Authoritative contract

Every newly created wall anchor uses this versioned record:

```ts
interface CavitySurfaceAnchorV1 {
  schema: 'cavity-surface-anchor-v1';
  position: [number, number, number];       // millimetres, cavity-local
  normal: [number, number, number];         // unit vector into the open void
  triangleIndex: number;                    // cache within source snapshot
  barycentric: [number, number, number];    // cache within that triangle
  fieldCell?: [number, number, number];     // source scalar cell, if present
  source: {
    kind: 'wall-mesh' | 'cavity-field';
    signature: string;
    fieldSignature?: string;
    snapshotDigest?: string;
    bufferDigest?: string;
    isovalue?: number;
  };
  chemistry: {
    vertexIndex: number;
    ringIdx: number;
    cellIdx: number;
    meshSignature: string;
    mapping: 'nearest-wall-mesh-vertex-v1';
  };
}
```

`position + normal + source identity` are authoritative. Triangle index and
barycentric coordinates are authenticated reconstruction caches. They may be
used directly only while the source signature/digest still matches. `fieldCell`
is a local remap hint, never a globally stable id.

The normal points into the void because that is the physical mineral-growth
direction. Both WallMesh and Marching Cubes store rock-facing surface normals,
so anchor construction reverses them once at the boundary.

## 3. Chemistry projection is deliberately separate

The scalar surface can be finer and topologically richer than the current
16x120 transport lattice. Tranche 4 does not invent sub-voxel chemistry.
Instead, every anchor records a deterministic nearest WallMesh interior vertex
as its `chemistry` projection. Local fluid, temperature, water state,
competition, occupancy, and dissolution shielding resolve through that named
projection.

This approximation is honest and testable:

- positional/orientation truth comes from the selected physical surface;
- transport truth comes from the existing mass-balanced boundary voxel;
- multiple nearby surface patches may share one chemistry reservoir;
- ties choose the lowest vertex index;
- no consumer is allowed to mistake a chemistry address for surface identity.

A later transport refinement can replace the mapping without changing crystal
identity or save schema.

## 4. Producers

### 4.1 WallMesh compatibility provider

Existing ring/cell nucleation keeps its RNG order and scientific calibration.
The selected chemistry vertex is converted immediately into a complete surface
anchor: exact current vertex position, an incident triangle with deterministic
lowest-index tie-break, one-hot barycentric coordinates, area-weighted
void-facing normal, and the chemistry projection.

This provider is cheap and remains the default while Marching Cubes has open
ambiguity and performance promotion gates.

### 4.2 Cartesian-field provider

An extracted Marching Cubes triangle and barycentric point produce the same
contract, plus scalar-field signature, immutable snapshot digest, buffer
digest, isovalue, and containing field cell. Chemistry is projected by nearest
WallMesh vertex. This API must work before any scenario opts into arbitrary
surface nucleation.

Area-weighted arbitrary-triangle nucleation belongs to the field provider, not
to a latitude/longitude compatibility shim. It may be activated only when the
same authenticated extraction is accepted for rendering and clipping.

## 5. Remapping after wall evolution or re-extraction

1. If source identity still matches, reconstruct the cached barycentric point
   and verify it agrees with stored position within a scale-aware tolerance.
2. If the surface changed, find the closest point on the new authenticated
   surface to the prior physical position. Search the prior scalar cell and its
   neighbours first when `fieldCell` is available, then fall back to the full
   surface. Ties choose the lowest triangle index.
3. Recompute the void-facing normal, source receipt, field cell, and chemistry
   projection atomically. Never update only a triangle index.
4. A rejected/missing Marching Cubes extraction fails closed to an explicit
   WallMesh remap. The fallback is recorded by `source.kind`; it is not silent.

Crystals keep their birth anchor in replay snapshots. Live remap caches are
derived state and must not rewrite historical frames.

## 6. Required consumer migration

All positional consumers use small WallState helpers instead of unpacking an
anchor shape:

- `surfacePointForCrystal` / `surfaceNormalForCrystal` for render transforms,
  hit testing, tooltips, morphology, and surface fabrics;
- `chemistryAddressForCrystal` / `chemistryVertexForCrystal` for local fluid,
  temperature, water state, competition, voxel access, occupancy, shielding,
  and transition engines;
- `surfaceAnchorKey` for render caches and replay/testimony signatures.

Legacy `{ringIdx, cellIdx}` fixtures are accepted at the input boundary and
upgraded deterministically. New runtime crystals never emit the legacy shape.

## 7. Verification gates

- schema validation rejects non-finite, non-unit, out-of-triangle, or
  unauthenticated anchors;
- WallMesh vertex anchors reconstruct exactly and preserve seed-42 scenario
  outputs;
- Marching Cubes anchors reconstruct from barycentric coordinates, carry the
  correct field cell, and survive re-extraction with deterministic remapping;
- nearest-chemistry projection is deterministic, bounded, and used by every
  local chemistry/occupancy consumer;
- renderer placement and hit-test identity use the same point/normal/key;
- command-protocol and replay projections contain the full anchor receipt;
- focused tests, full sequential `npm test`, browser seed-42 verification, and
  an AI Dr. Michael Wise hostile review all pass before the tranche closes.

## 8. Versioning

The compatibility provider is intended to preserve seeded geological outputs,
but the serialized crystal schema and rendered transforms change. Bump
`SIM_VERSION` once the new contract becomes the runtime default, regenerate
the checked-in bundle, and rebake only the baselines whose projection includes
the changed anchor schema. Record exact evidence in the Marching Cubes parent
proposal and the open-improvements ledger.

## 9. SIM 264 implementation record

The runtime contract is now `cavity-surface-anchor-v1`. Newly nucleated
crystals receive exact cavity-local position, a normalized void-facing normal,
authenticated triangle/barycentric reconstruction data, a source signature,
and an explicitly separate nearest-WallMesh chemistry projection. The
WallMesh provider remains the production default; a scalar-field provider and
deterministic remap API establish the contract required before arbitrary
Marching Cubes triangles can become production nucleation sites.

Consumers no longer derive physical placement from transport coordinates.
Render transforms, hit testing, morphology, strip testimony, and identity
caches use physical position/normal/source data. Local fluid, temperature,
water state, competition, occupancy, dissolution shielding, and host
inheritance request the chemistry projection explicitly. Wall coverage uses
exact incident-triangle areas and shortest-path mesh distance rather than
same-latitude offsets and a mean spherical wedge.

The migration exposed three scientifically meaningful defects that were fixed
before the evidence gate:

1. tiger-eye local-substrate lookup used a ring-neighbour approximation near
   the poles; it now uses the nearest nonzero physical geodesic spacing;
2. cleft/basin architecture gates used ring labels and were bypassed by joint
   per-vertex and feeder samplers; all paths now apply the actual local
   void-facing normal; and
3. an etch test assumed visible pits must survive indefinitely, although later
   booked regrowth exceeded booked removal. The contract now pins progressive
   healing, final visual disappearance, and retention of the historical
   reaction boundary.

The physical-normal correction intentionally changes deterministic placement
and downstream competition. The SIM 263 to SIM 264 seed-42 rebake records:

- `reactivated_fluorite_vein`: 59 to 62 nuclei, still 12 species;
- `sabkha_dolomitization`: 19 to 55 nuclei, still 5 species, because its joint
  sampler now actually composes the authored `floor_only` gate;
- `searles_lake`: 116 to 115 nuclei, still 6 species;
- `tormiq_alpine_cleft`: 20 to 18 nuclei, still 6 species;
- `wittichen`: 46 to 45 nuclei; and
- `grimsel_alpine_cleft`: 25 nuclei and 10 species unchanged, with corrected
  physical attachment points.

The Node-only science rebake passed all 41 scenarios at seeds 1, 2, and 42,
all 41 seed-42 strips and claim cards, the seed-42 and 12-scenario digest
tripwires, 236 provenance citations, 40 focused science tests, and zero
locality-envelope violations. Its aggregate v264 receipt authenticates 126
artifacts to the exact executable bytes, runtime identity, scenario
specifications, producer contracts, and output hashes. The final integrated
`science:verify` repeated those gates successfully. A memory-bounded resumed
sweep covered all 217 test files after each discovered regression was fixed;
slow count-only tests now consume authenticated seed-42/frequency evidence,
while unique morphology, weathering, placement, and causality paths remain
live. Focused topology, architecture, sulfate, host-inheritance, rendering,
and responsive-shell gates also pass. Thirteen hostile-review correction
rounds then closed every exposed
authority boundary: immutable extraction buffers, exact provider activation,
renderer/clip pairing, historical cursor/provider replay, shape and
tessellation authentication, corrupt-frame withholding, exact dense replay
dimensions, and removal of render-wall injection. The AI Dr. Michael Wise role
returned `SATISFIED` on simulation authority. A subsequent evidence-layer
review closed executable/data hashing, producer/runtime identity, resumable
checkpoint identity, deterministic timestamps, and aggregate artifact
authentication. After the complete v264 rebake and post-bake verification, the
AI Dr. Michael Wise role returned `SATISFIED` with no remaining material
scientific or reproducibility defect. A final test-integrity pass then routed
every evidence-backed contract through one fail-closed loader that verifies the
current built model, executable/data digest, Node runtime, producer contract,
artifact hash, and (for strips) authored scenario-spec hash. The O3 fixed-seed
proof now runs an independent uncached replay, and the descloizite-group
commissioning test again requires alive, positively grown final-state crystals
in at least three of five independent seeds. Those heavy proofs passed in
isolated workers, and the AI hostile-review role again returned `SATISFIED`.

Real-browser QA loaded the locally saved v264 bundle and ran the authored
Grimsel scenario with growth seed 42 and its scenario-owned `shape_seed`.
Desktop playback emitted no browser warnings or errors. At 390 by 844 pixels,
the QA pass found that the side-by-side simulation log and inventory collapsed
the log to a sliver; the mobile rule now stacks those panels. The rebuilt page
has zero horizontal overflow, full-width narrative and inventory panels, and
no browser warnings or errors.

This is an AI-reviewed engineering record, not review by the real Dr. Michael
Wise or the Smithsonian.
