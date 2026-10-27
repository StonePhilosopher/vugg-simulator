# Production local-state foundation v1

Base: PR #35 merge `db2c17bdac4e7fd3dbcdad1fd03d23f6654d661d`.
This tranche provides explicit cell inventories and an initial-state checkpoint.
It does **not** activate acid plumes or change an existing scenario's chemistry.

## Authority and units

`js/24e-local-conserved-state.ts` owns the separately versioned
`vugg-local-cell-inventory-v1` and `vugg-local-state-foundation-v1` contracts.
Each canonical `[ring, cell, depth]` has exactly one explicitly supplied record:

| Field | Meaning and units |
| --- | --- |
| `waterKg` | kg of solvent water; authored, never inferred from cavity volume |
| `dicMolC` | mol of dissolved inorganic carbon atoms across carbonate species |
| `alkalinityEq` | signed acid-neutralizing equivalents; independent of pH |
| `calciumMol` | mol of dissolved calcium atoms |
| `ironMol` | mol of total dissolved iron atoms; oxidation state is **unresolved** |
| `sulfateMol` | mol of the dissolved sulfate component; one mol S per mol sulfate |
| `oxygenMol` | mol of dissolved O2 molecules, not mol of oxygen atoms |
| `temperatureC`, `fluidPressureKbar` | explicitly supplied thermodynamic coordinates |
| `pHModel` | `unresolved` or the explicitly selected existing reduced-carbonate diagnostic |

Amounts are extensive, finite and nonnegative except signed alkalinity.
A dry cell cannot hold dissolved inventory in this schema. No missing field is
defaulted to zero. No conversion from legacy ppm/pH is available. A provenance
reference is required, but its presence does not certify the scientific accuracy
of the supplied numbers. This is not a complete aqueous composition, charge
balance, Fe redox model, or solvent H/O ledger.

## Closed feature boundary

Every checkpoint must declare the fixed `inventory-only` capabilities:
reactions, transport, carbonate buffering, and legacy projection are all false.
Attempts to enable one in a saved document are rejected. No shipped scenario
installs this state; ordinary legacy objects acquire no inventory properties.

Installation is permitted only on a fresh, unadvanced simulator with a canonical
cavity grid. Inventories are copied, deeply frozen, and published atomically
after validation and exact initialization/geometry matching. They are held by
simulator/grid lifetime in weak maps. Their values enter the simulation state
fingerprint only when installed; absent state adds no key to legacy projections.

An installed foundation refuses legacy `run_step` and grid `diffuse` before
state or RNG changes. This deliberately non-ticking foundation prevents old ppm
fields from silently evolving alongside a second chemical authority. Direct
out-of-band changes to legacy initialization cause checkpoint export to fail;
this API boundary is not a sandbox against arbitrary writes to internal objects.

## pH is a derived diagnostic

`localCellInventoryPH` takes no pH input. For the explicitly selected
`existing-reduced-carbonate-v1` model it divides DIC and alkalinity by water kg
and calls the unchanged `solvePHForReducedCarbonateAlkalinityResult` kernel.
The reduced relation is carbonate alkalinity plus OH minus H, under the
existing ideal-dilute approximation. The returned residual is eq/kg.

Numerical results are labelled `model-estimate`, diagnostic only, and cannot
feed back into production fluids. This is not a new full speciation solver.
Nonzero Fe or sulfate, dry cells, an unresolved model, conditions outside
0–90 C / 0.00101325 kbar, or an unbracketed solution return `unresolved` with
`pH: null`. The diagnostic explicitly excludes ion activities, calcium
complexation, unrecorded buffers/redox, and full solvent H/O closure. In
particular it must not be used to estimate an active sulfide-oxidation plume.

## Save/load and conservation

`createLocalStateFoundationSnapshot(sim, cells, reference)` supplies binding
metadata, never chemical values. `installLocalStateFoundation` accepts only
complete, canonically ordered coverage. `serializeLocalStateFoundation` and
`restoreLocalStateFoundation` round-trip the initial checkpoint onto the exact
same fresh initialization, including legacy fluids, geometry and RNG binding.
An unsupported schema, incomplete inventory, changed dimensions, wrong
initialization, duplicate installation or enabled capability fails visibly.

All stored finite numeric quantities must round-trip through JSON without quantization;
there is no transport/reaction tolerance, conversion, or lossy quantization.
Immutability and pre-mutation guards conserve every recorded amount in this
tranche. A future evolving-state format must specify its own reaction and
transport conservation tests and tolerances rather than relaxing this claim.

Legacy v286 recipe saves keep their existing schema and replay behavior.
They are **not** silently upgraded: pH cannot determine DIC and alkalinity,
and the legacy voxel grid does not supply an authoritative finite water mass.
The legacy recipe save/seal paths refuse an installed foundation so they cannot
discard its inventories. New checkpoints are a separate initial-state API,
not a claim that gameplay autosave or Record Player supports evolving local
chemistry. No UI opt-in or migration button is introduced.

## Held scientific decisions

Activation requires an evidenced clock and transport coefficient; explicit
finite water/reservoir ownership and legacy migration; Fe oxidation endpoints;
the provenance and debit authority for finite calcite; and supported local
speciation/reaction coupling. Neither booked calcite mass nor completed
geometric solid is chosen as a buffer source here. Full competing pathways and
solvent H/O closure remain outside v1. UV has no photochemical rate law here.

## Verification

`tests-js/local-state-foundation.test.ts` exercises strict inventories, signed
alkalinity, reduced diagnostic limits, independent cells, atomic failure,
exact checkpoint persistence, capability guards, real save refusal, and replay
of a legacy save captured before any runtime edits at the pinned base.
The fixture records the original runtime digest and physical fingerprint.
The focused file is a durable Windows CI step.

Reproduce on the commissioned Windows x64 / Node 24.15.0 runtime, serially:

```text
npm run build
npm test -- --file tests-js/local-state-foundation.test.ts --file tests-js/fortress-saves.test.ts --file tests-js/carbonate-boundary-conservation.test.ts
npm run gen:browser-receipt
npm run science:rebake
npm run gen:release
node pilots/calcite/census.mjs --output pilots/calcite/volume-census.json
node pilots/calcite/golden.mjs
node pilots/calcite/record.mjs
node pilots/calcite/factor-report.mjs
node proposals/evidence/local-state-foundation-compare.mjs
npm run typecheck
npm run build:check
```

The [comparison script](evidence/local-state-foundation-compare.mjs) checks
complete seed-42 baselines, 41 strip stories, 41 claim cards, the three-seed
occurrence panel, all 41 final simulation fingerprints in the calcite census,
complete recorded specimens, reconstruction/factors, and browser/mechanism
payloads against the pinned base. It changes only a runtime identity on a
comparison copy to recover the prior authenticated Elmwood specimen hash; no
physical field is normalized or accepted as an expected drift.

Validation results and commands are recorded in the
[delivery receipt](evidence/production-local-state-v1-receipt.md) and
[comparison report](evidence/local-state-foundation-validation.json). Runtime
receipt updates must come from the real producers above, never manual hash
substitution.
