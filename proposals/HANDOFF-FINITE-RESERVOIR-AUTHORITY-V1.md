# Finite reservoir authority v1

Baseline: `c2651d4f2c2526b4944ef853ea6676bd9b4afd97` (SIM 286).

This tranche establishes an executable **initial declaration** contract and
audits the production sources that a physical mapping would need. It does not
activate reactions, transport, wall buffering, or a new water/solid volume model.
The reference compiler is outside both shipped runtimes. Existing scenarios,
mass rules, recipes, rendering, and evidence receipts retain their original bytes.

## What the raw sources actually supply

The [source audit](../pilots/finite-reservoir-authority/source-audit.json) covers
all 41 authored scenario declarations, including absent/defaulted input fields.
None declares finite cell-water masses. Two explicitly declare DIC and reduced
carbonate alkalinity. Fifteen explicitly name limestone wall proxies and four
name dolomite. These are raw declaration counts, not measured mineral abundances.

| Source | Existing quantity and owner | What it does not establish |
| --- | --- | --- |
| `FluidChemistry` | mg solute/kg solvent; DIC uses the model's CO3 mass-equivalent convention | Physical kg of water; mg/L; independent alkalinity; a missing input's measured absence |
| Canonical voxel grid | Addressed local concentrations; d=0 aliases wall-cell fluid; deeper cells clone concentrations | A physical water mass or an independently supplied bulk/ring reservoir in addition to the canonical cells |
| Fully mixed carbonate boundary | Equal-volume reference averaging and reduced DIC/alkalinity accounting | A calibrated physical wet-volume/density partition; complete aqueous speciation |
| `conditions.wall` | **One global** calibrated carbonate formula ledger, mmol/kg solvent reference | One stock per cell; a measured reactive phase fraction; absolute local pure-calcite moles |
| Crystal accepted zones | Remaining thickness times actual booked uptake, in reference-normalized chemical units | Moles inferred from display size or a reconciled physical calcite solid |
| Completed calcite surface | Recorded geometric mm3, under the existing held volume contract | Chemical mass or a buffering reservoir |

The relevant owners are `js/20-chemistry-fluid.ts`,
`js/19-mineral-stoichiometry.ts`, `js/22-geometry-wall.ts`,
`js/22a-geometry-cavity-evolution.ts`, `js/24-geometry-voxel-grid.ts`,
`js/85c-simulator-state.ts`, and `pilots/calcite/volume-contract.js`.
The audit binds their exact source hashes. Constructor defaults remain defaults;
the audit records absent authored values as `null`, never as scientific zeros.

The [wall reference census](../pilots/finite-reservoir-authority/wall-reference-census.json)
reads the actual constructors for all 41 scenarios, checks reference closure and
proves inspection did not mutate each wall. It constructs no `VugSimulator`,
advances no growth, and installs no geometry authority.

| Constructor | Modeled host formula | Remaining reference extent |
| --- | --- | --- |
| MVT | limestone proxy, CaCO3 | 187.13508658116672 mmol formula/kg solvent reference |
| Bisbee | limestone proxy, CaCO3 | 187.13508658116672 mmol formula/kg solvent reference |
| Elmwood | dolomite proxy, CaMg(CO3)2 | 187.13508658116672 mmol formula/kg solvent reference |

The repeated extent follows the existing wall calibration, not measurements of
three equal physical reservoirs. The ledger's reference kilogram is not proof
that the cavity or every voxel contains a kilogram of water. Dolomite cannot be
renamed calcite. The reference inspector preserves these units and returns
`physicalWaterKg: null`, `physicalCalciteMol: null`, and eligibility false.

## Explicit initial declarations

`pilots/finite-reservoir-authority/contract.mjs` compiles one calcite-only
declaration. There are no defaults for amounts, units, or provenance.
Its tracked-component subset is not a complete aqueous charge/speciation,
iron-valence, or solvent H/O ledger.

- Each named water source declares finite **kg solvent water** and all six
  component molalities: mol C, Ca, total Fe, S(VI), and O2 molecules per kg water,
  plus signed alkalinity equivalents per kg water. Every quantity carries its
  own provenance kind and reference.
- Each canonical `[ring, cell, depth]` receives an explicit allocation from one
  named water source. Its component amounts are `molality * allocated kg water`;
  alkalinity becomes equivalents by the same extensive conversion.
- The optional single global wall-carbonate source independently declares
  **mol CaCO3**, not a concentration,
  dimension, mesh volume, acid capacity, dolomite amount, or HMC amount.
- A cell names its calcite parent source and its finite local allotment. The
  future buffer debit target is that cell's allotment, identified as
  `sourceId@ring,cell,depth`. It is never a fresh copy of the global parent stock.
  Explicit `null` plus zero records that no calcite stock is assigned.
- Source identities are unique across water and solid namespaces. Every source
  must be fully allocated once; overdrafts and unrecorded remainders fail.
- The solid owner must be `wall-carbonate`. A second global wall stock or a
  grown-crystal source is rejected by schema v1. Grown calcite remains separate.
- Temperature, pressure, and the diagnostic pH model are explicit initial inputs.
  This is allocation of analytical inventories, not a mixing-energy calculation.

Water resizing changes aqueous amounts at fixed molality; it does not resize
independently declared calcite moles. These separate dimensions follow the USGS
[SOLUTION water-mass definition](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-48.htm)
and [finite pure-phase amount definition](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-13.htm).
The reference compiler does not import PHREEQC's concentration shorthands or
default phase amount. Vugg's existing ppm convention is not changed.

Provenance kinds are `authored-experiment` and `external-declaration`. They
describe asserted input origins, not independent scientific certification.
Compilation cannot prove an external measurement is correct. The full values
and references are retained; deterministic reconstruction is not evidence of
geological warrant. Legacy wall references, booked volumes, geometry, and
density defaults cannot be promoted by assigning them a source-kind label.

## Conservation and executable refusals

All finite amounts are nonnegative except signed alkalinity. Dry sources cannot
carry a nonzero composition. Sparse records, duplicate addresses, missing
components/provenance, ambiguous units, nonfinite numbers, and unrepresentable
products/sums fail before installation. pH is never an input or transport stock.

Allocations and component totals use compensated sums. Closure tolerance is
64 machine epsilons times the relevant magnitude; there is no absolute floor
that could forgive exhausting a tiny reservoir. Signed-component cancellation
uses the sum of absolute terms as its roundoff scale. Reports retain expected,
allocated, residual, and tolerance. No stock or cell is rescaled or silently
rounded to make a physically incompatible model agree.

The wall inspector separately uses the **existing** reference-ledger tolerance
of 1e-9 mmol/kg reference. That is not the new allocation tolerance and does not
grant physical mass authority.

## Checkpoint and existing foundation boundary

`createFiniteReservoirCheckpoint(h, sim, declaration)` retains the complete
declaration and a PR #36 initial foundation snapshot. The canonical declaration
hash binds the provenance, allocations, calcite source amounts and owner IDs.
It enters the foundation's provenance reference and therefore the whole
simulation fingerprint, including when aqueous values alone remain identical.

`restoreFiniteReservoirCheckpoint(h, sim, text)` recompiles the retained inputs,
verifies dimensions, every projected amount, the source hash, and the original
fresh-simulator binding before installing anything. Wrong initials, modified
stocks/provenance, and foundation-only legacy documents fail atomically.
Object-key order has no scientific significance. Sources and outputs are frozen.

This is an initial checkpoint, not an evolving gameplay save format. The existing
foundation still refuses growth, legacy diffusion, and recipe persistence.
The compiler creates no alternative mutable chemistry or stock debit path.
No UI, renderer, current fluid classifier, or RNG supplies missing quantities.

## Production decision still required

The user selected wall carbonate as the first buffering source to investigate,
with grown calcite kept separate. The production candidate is the global
wall-carbonate ledger.
Mapping it into finite **physical** buffering requires evidence for:

1. Actual water mass and its canonical wet-cell allocation. If mass is derived
   from geometry, name the wet volume, displaced physical solids, fluid density,
   temperature/pressure/composition model and its uncertainty. No one-kg or
   pure-water-density default is authorized.
2. The relationship between calibrated global wall formula extent and absolute
   reactive calcite stock, including phase identity/fraction and spatial access.
   Preserve the original stock owner; allocate it rather than cloning it.
3. A debit transaction that would consume that source and update the appropriate
   wall/aqueous records once. Grown-crystal uptake and completed surfaces remain
   separate sources; they cannot fill a missing wall quantity.

This tranche exposes those gaps rather than choosing density, porosity, reactive
fraction, or a new calibration. Declared experimental initialization is executable;
automatic legacy-to-physical mapping and production buffering remain **HOLD**.
Reactions, transport, clock calibration, Fe endpoint/speciation, full H/O closure,
UV kinetics, and calcite renderer opt-in are not introduced here.

## Reproduction and evidence

Use commissioned Windows x64 / Node 24.15.0, serially:

```text
node pilots/finite-reservoir-authority/audit.mjs --write
node pilots/finite-reservoir-authority/audit.mjs --wall-census --write
node pilots/finite-reservoir-authority/audit.mjs --check
node pilots/finite-reservoir-authority/audit.mjs --wall-census --check
npm test -- --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
npm run typecheck
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --check
```

The source and constructor censuses are new, separately generated evidence.
They prove coverage/ownership facts, **not** a fresh 41-scenario growth replay.
Production execution digest remains
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`;
all nine registered science-producer contracts remain identical. Existing
science receipts are verified, not rebaked or manually rebound.

Validation counts, retries and limitations belong to the accompanying
[delivery receipt](evidence/finite-reservoir-authority-v1-receipt.md).
