# MVT reservoir reference preflight v1

Baseline: `01903bbe84766aa8b795047b363a8e38ba03d9b2` (merged PR #38, SIM 286).

This tranche traces one **actual initial MVT cavity**, its one global wall
reference ledger, and a noncommitting dissolution preview. It makes the next
physical-mapping decision executable. It does not resolve that decision by
assuming a kilogram of water, a brine equation of state, or an accessible calcite
fraction. Both shipped runtimes, all scenarios and existing receipts are unchanged.

## What the raw path says

1. `js/20-chemistry-fluid.ts` explicitly defines ppm as mg solute per kg solvent.
2. `VugWall.previewDissolve()` in `js/22-geometry-wall.ts` converts its reference
   thickness decrement using `15 / 40.078` mmol CaCO3 per kg reference per mm.
   It computes a Ca/CO3 release and a crystalline volume per reference kilogram.
3. `cavityFormulaExtentVolumeMm3PerKg()` in `js/22a-geometry-cavity-evolution.ts`
   returns extent in mmol/kg times the molar volume in cm3/mol, numerically mm3/kg.
4. `CavityProductionAuthority.previewErosion()` in
   `js/23d-geometry-cavity-production-authority.ts` adds that numeric target to
   the cavity's absolute mm3. `commitDissolvePreview()` uses the achieved volume
   the same way. This is the existing **reference-normalized model convention**;
   it is not a declaration of physical solvent mass.

The observer requests a 0.5 mm reference decrement with uniform preview weights.
That is an authored inspection stimulus, not a new physical rate, exposure
distribution or accepted event. No chemical or geometry commit is executed.
It verifies the complete scientific fingerprint, wall serialization and active
geometry receipt are unchanged afterward. It draws no RNG after initialization.

The current MVT constructor uses 180 C, 0.3 kbar and salinity index 15. Its wall
is a limestone/CaCO3 proxy. Its 500 mm thickness comes from the existing default,
not a measured shell. It has no authored finite water masses, cell wet domains,
accessible calcite phase inventory or commissioned conversion of its salinity
index into a complete fluid composition. Neither the prior pure-water sphere
nor a camera-visible crystal surface can supply those missing quantities.

## The measured relationship

The [retained receipt](../pilots/reservoir-reference-preflight/receipt.json)
binds the actual scientific geometry and runtime, calibration sources, producer
bytes and original scenario declarations.

| Quantity | Result and meaning |
| --- | --- |
| Initial scientific cavity capacity | 68,226.21551819511 mm3, authenticated 48-cubed Cartesian surface |
| Canonical cells | 16 rings x 120 columns x 4 depths = 7,680 addresses; physical wet volumes remain unknown |
| One remaining global wall stock | 187.13508658116672 mmol formula/kg solvent reference |
| Preview formula extent | 0.1871350865811667 mmol CaCO3/kg reference |
| Preview Ca release | 7.5 mg/kg reference |
| Preview C release | 11.229789410649232 mg CO3-equivalent/kg reference |
| Standard-state calcite molar volume | 36.934 cm3/mol, the existing disclosed approximation |
| Numeric geometry target | 6.911647287788811, produced in mm3/kg reference and consumed as absolute mm3 |
| Achieved absolute volume gain | 6.911244849499781 mm3; preview only |
| Inherited numerical geometry tolerance | 0.2746536045242863 mm3; not a source/material uncertainty |

For the **same reference extent and dense-crystalline volume convention**,
dimensional closure requires:

```text
n_calcite [mol] = extent [mmol/kg] * solvent [kg] / 1000
dV [mm3] = n_calcite [mol] * Vm [cm3/mol] * 1000
         = extent [mmol/kg] * Vm [cm3/mol] * solvent [kg]
```

The unchanged nominal target is consequently equivalent to **1 kg** of solvent
per represented cavity. The achieved volume gives 0.9999417738966887 kg;
the inherited numerical tolerance permits approximately 0.96020--1.03968 kg.
That interval is only an algebraic expression of the geometry tolerance. It is
not a physical water measurement or a confidence interval.

One kilogram divided by this cavity's entire volume is
**14,657.122521083 kg solvent per m3 of cavity**. This is a conditional quotient,
not an estimated brine density. No fluid equation of state was applied. The
calculation does not independently falsify the existing gameplay calibration:
its reference kilogram was never established as actual water in this pore.

Molality's denominator is solvent mass, as defined by
[IUPAC](https://goldbook.iupac.org/terms/view/M03970). Density is a mass/volume
ratio ([IUPAC](https://goldbook.iupac.org/terms/view/D01590)). For a declared
water-solvent solution, a physical mapping would therefore need:

```text
solvent_kg = wet_mm3 * 1e-9 * solution_density_kg_m3 * solvent_mass_fraction
```

Solution mass must not silently become solvent mass. A saline-fluid density,
solvent fraction and spatial wet volume each need evidence. The molar-volume
approximation at MVT's T/P remains the existing one; this tranche does not add
a mineral pressure/temperature correction. The existing USGS source and its
limitations remain in PR #38's primary-source record.

## Executable contract and downstream use

`preflightWallReference(observation)` validates phase, reference units, canonical
cell count, capacity/geometry agreement, Ca and CO3 stoichiometry, target-volume
conversion, finite stock and inherited geometry residual/tolerance. It returns
an immutable diagnostic with unknown physical quantities left `null`. A digest
identifies that diagnostic; a digest alone does not authenticate its geology.
Only the commissioned receipt producer binds an observation to the actual source
and runtime bytes.

`evaluatePhysicalHypothesis(observation, hypothesis)` accepts **explicitly
conditional** kg solvent and mol wall-CaCO3. It reports independently:

- the physical amount implied by the reference chemical release;
- the corresponding dense-calcite volume and its residual against existing
  geometric erosion;
- whether the proposed finite wall stock matches the reference inventory and
  suffices for that one preview;
- the geometric void-gain/crystalline-calcite-volume quotient required to retain
  the existing erosion. This quotient is not silently interpreted as porosity,
  a reactive fraction, access, or a calibrated correction.

Even a numerically compatible hypothesis cannot authorize installation, reaction,
transport or depletion. There is no install/debit API, migration or new gameplay
save format. Existing physical and legacy checkpoints remain unchanged. Missing
water/alkalinity cannot be inferred from pH; grown crystals are not the wall stock;
the stock is not multiplied by 7,680; addresses do not become measured volumes.

Downstream researchers and tests may use this record to compare **conditional
models** and identify incompatible conversions. Production chemistry, erosion,
fill, narration and renderer consumers may not use it as physical authority.

## The exact scientific HOLD

Before enabling a local production reaction, specify and evidence the system
boundary and its finite water: pore water, a named external reservoir, or another
explicit domain. Establish the actual wet-cell/solvent partition and finite
accessible wall calcite separately. Then choose the relationship between that
physical system and the calibrated transactions:

- If local solvent kg scales the accepted formula amount, dense-crystalline
  erosion must scale with that amount too; keeping the old numeric erosion
  would change its interpretation.
- If bulk-host void gain differs from crystalline calcite removal because of
  phase fraction, porosity or an inert framework, define and evidence that
  conversion and its finite stock/access rules. It cannot be fitted merely to
  erase this mismatch.
- If the legacy reference kilogram represents a larger connected reservoir,
  name and conserve that reservoir rather than cloning it into every cell.

These are model/system-boundary choices with consequences for wall recession,
solute supply and later growth. **No choice is made or commissioned here.** This
tranche establishes the decision boundary instead of changing the science.
Reactions, transport, UV and physical clocks remain disabled/outside scope.

## Reproduce

The receipt requires Windows x64 / Node 24.15.0. The independent Python witness
uses standard-library Decimal with 60 digits and derives nine quantities from
the existing calibration and observed cavity capacity. It independently checks
arithmetic, not the cavity geometry or MVT's geological validity.

```text
node pilots/reservoir-reference-preflight/receipt.mjs --write
node pilots/reservoir-reference-preflight/receipt.mjs --check
python pilots/reservoir-reference-preflight/reference.py
npm test -- --file tests-js/reservoir-reference-preflight.test.ts --file tests-js/physical-reservoir-mapping.test.ts --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
npm run typecheck
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --check
```

CI extends the existing reservoir step with this one focused file and the Decimal
witness. It adds no scheduler, new production architecture or rebake. The
[delivery receipt](evidence/mvt-reservoir-reference-preflight-v1-receipt.md)
records the actual checks, runtime, retry and unverified boundaries.
