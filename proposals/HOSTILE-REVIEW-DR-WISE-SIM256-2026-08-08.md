# AI Dr. Michael Wise hostile-review receipt — SIM 256

Date: 2026-08-08  
Role: adversarial AI review persona, not the real scientist or Smithsonian  
Verdict: **SATISFIED**

## Scope reviewed

- Per-voxel local-thermal-equilibrium temperature storage, geometry-weighted
  control volumes, finite-volume conduction, directional source transport,
  wall-rock exchange, and authored ambient boundaries.
- Local temperature consumption by saturation, nucleation, growth, zoning,
  dissolution, phase replacement, morphology, Wulff form, and Creative
  formation diagnosis.
- Aragonite selector domains, explicit open-spring geology, cold scenario
  boundaries, and mass-balanced aragonite Sr partition/dissolution receipts.
- Immutable thermal commands, checkpoint replay, and future-state fingerprints.

## Hostile findings and resolutions

The first review found four material defects. A bulk cooling delta could drive
an already-cold voxel farther below ambient; the corrected boundary now cools
each warm voxel only toward ambient, leaves colder voxels unchanged, applies a
separate positive fracture-pulse contribution, and immediately recomputes
geometry-weighted bulk and ring temperatures.

The shallow aragonite temperature route originally inferred a spring from P-T
coordinates alone. It now requires the explicit `wall.open_spring` geological
boundary in addition to pressure <= 0.10 kbar and 40-100 C. Identical sealed
chemistry has zero spring-selector contribution.

The first thermal discretization treated every latitude/depth cell as equal
volume. The accepted solver attributes exact tessellated surface shares and
radial-shell volume factors, then exchanges equal and opposite `wT` across each
face. Receipts are normalized control-volume x temperature proxies and
explicitly are not joules or calibrated fluid volumes.

The checkpoint fingerprint initially omitted local fluids, complete accepted-
zone dissolution/Sr inventories, and several hidden random states. The final
projection includes every voxel fluid and temperature, thermal and orientation
cursors, movement cursor/spec/state, the shared per-mineral nucleation seed,
and full zone ledgers. Legacy mulberry callables expose a restorable cursor
without changing their sequence. Mutation regressions prove each field changes
the fingerprint.

## Verification presented

- Independent hostile-review run: 58/58 focused tests across aragonite,
  thermal localization, simulation commands, and movements.
- TypeScript typecheck and generated browser build: PASS.
- Creative gameplay/save/replay audit: PASS, including 20/20 live and 25/25
  setup environmental controls.
- Seed-42 evidence regenerated: 39-scenario baseline, 39 complete strip stories,
  12 curated strip digests, and 39 claim cards. The generated science manifest
  is current for 39 scenarios and 220 citations.
- Archive/calibration/provenance verification: 117 unaffected assertions passed.
  Two pre-v256 stale strip-contract assertions were then corrected and their
  focused rerun passed 2/2: well-mixed sabkha recharge does not invent a terminal
  depth gradient, and the authored low-Mg MVT brine correctly favors calcite over
  dolomite despite positive dolomite SI.
- `git diff --check`: no whitespace errors.
- Python gameplay parity and pytest are retired and were not acceptance gates.
  The separately identified Reaktoro pressure-grid generator is optional
  offline research tooling, not a gameplay or ordinary-test dependency.

Final hostile verdict: **SATISFIED**; no material scientific or reproducibility
defect remains in the SIM 256 thermal/aragonite tranche.
