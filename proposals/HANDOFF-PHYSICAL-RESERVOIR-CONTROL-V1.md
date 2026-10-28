# Physical reservoir mapping: one analytical calcite-wall control

Baseline `ba0204ddba27067146d28ba5d53dbb6c15943788` (SIM 286, after PR #37).

This tranche closes an **analytical initialization control**, not physical
legacy-scenario migration. Geometry and material properties now produce finite
water and calcite amounts, rather than taking those amounts as unexplained
fixture constants. Neither shipped runtime imports this module. Reactions,
transport, growth, buffering, UV, recipes and renderer authority remain unchanged.

## The case and the authority of each input

The retained [control](../pilots/physical-reservoir-mapping/control.json) declares
a fully flooded spherical pore of radius 10 mm, surrounded by a 1 mm nonporous
pure-calcite shell. It contains degassed pure ordinary water, no other solids,
and no dissolved analytical components. The temperature is uniformly 26 C and
pressure 100000 Pa (1 bar absolute); hydrostatic variation is excluded.

These are **authored experimental definitions**, not measurements of a natural
specimen or inferred facts about a legacy limestone wall. The shell is a finite
inventory; allocating it does not assert instantaneous access or dissolution.

| Quantity | Units, source and owner | Meaning and limits |
| --- | --- | --- |
| Cavity radius, shell thickness | mm, retained control inputs | Exact analytical geometry by definition; no mesh, Wulff volume, booked crystal volume or camera input |
| Wet cell volume | mm3, analytical angular/radial integration | Full flooding and no displaced solids are explicit conditions, not defaults for existing cells |
| Water density | kg/m3, IAPWS SR6-08(2011) Eq. 2 | Pure ordinary liquid water at 0.1 MPa; not a brine or general-pressure equation |
| Cell water | kg solvent water, `density * volume * 1e-9` | Solution mass equals solvent mass only because this control declares pure water |
| Calcite molar volume | cm3/mol, existing USGS reference 36.934 | Retains the existing value at 26 C and its approximation; no hidden constants update or pressure correction |
| Global wall stock | mol CaCO3, `shell mm3 / (1000 * molar volume)` | One physical shell parent, allocated to boundary cells only; grown calcite remains separate |
| Analytical components | mol C, Ca, Fe, S(VI), O2 and eq alkalinity | Initially zero from the declared degassed pure-water experiment, never from a legacy field being absent |
| Legacy wall stock | mmol formula/kg solvent reference, existing wall owner | Used only for an explicit dimensional discrepancy report; never relabeled as absolute moles |

The [source record](../pilots/physical-reservoir-mapping/source-evidence.json)
retains primary-document URLs, PDF SHA-256 values, equation/table locations,
coefficients, verification values and uncertainty qualifications.

The [IAPWS release](https://iapws.org/technical-guidance/release/LiquidWater.download)
supplies Eq. 2/Table 1 and three density check values in Table 8. All three are
reproduced to their published rounding precision. The 260 K and 375 K liquid
checks are metastable verification points; the physical control uses 299.15 K.
Section 2.3 gives a stable-liquid density uncertainty of 1e-6 relative with
coverage factor k=2. This is kept separate from arithmetic closure tolerances.

The [USGS table](https://pubs.usgs.gov/bul/1248/report.pdf), printed page 58
(PDF page 64), gives calcite 36.934 +/- 0.015 cm3/mol at 26 C. The table does
not state pressure. This control retains the existing ambient/standard-state
approximation, without claiming a measured 1-bar pressure correction. Its
reported standard-error estimate is not a k=2 interval. The historical value
is retained; atomic weights and Avogadro's constant are not silently modernized.

Geometry has no measurement-error distribution in this exact authored case.
The receipt reports water-mass uncertainty conditional on that definition,
and calcite-stock sensitivity to the reported molar-volume error. It does not
combine different uncertainty conventions or claim complete physical bounds.

## Physical partition and reconstruction

`mapping.mjs` uses polar boundaries `phi = pi*r/rings`, azimuth boundaries
`theta = 2*pi*c/cellsPerRing`, and explicit decreasing radial boundaries from
the cavity radius to zero. These form a complete analytical partition:

```text
sector volume = (theta1-theta0) * (cos(phi0)-cos(phi1))
                * (outerRadius^3-innerRadius^3) / 3
```

The implementation evaluates stable equivalent forms for thin shells and
angular intervals. Each boundary cell receives its shell sector; deeper cells
receive no wall stock. The stock is not copied to every radial layer. Splitting
angular and radial cells preserves each parent's water and calcite inventories.
The global totals also agree for 1, 64 and 512 cells. No normalization or
rescaling is applied to force closure.

These analytical volumes do **not** assign physical control volumes to existing
legacy voxels. Matching address order is not proof of matching geometry. Legacy
irregular surfaces, saline fluids, partial flooding, porosity and crystal
displacement are outside this version and are refused as control input modes.

The mapper feeds the PR #37 declaration compiler, retaining one water source,
one `wall-carbonate` parent, local allotments and property provenance. Diagnostic
pH remains unresolved; pure-water component amounts do not authorize pH guessing.

`serializePhysicalRecord()` retains causal inputs and an exact record digest.
`restorePhysicalRecord()` reconstructs bounds, quantities, source ownership and
the declaration, then checks that digest before returning anything. Source-data
or model-output drift fails; altered derived values cannot become a checkpoint.
This is an initial physical-control record, not a production gameplay save or
an adapter that installs spherical quantities onto a legacy simulator.

## Independent numerical evidence and the reference conflict

The checked-in [Python witness](../pilots/physical-reservoir-mapping/reference.py)
uses 60-digit Decimal arithmetic, global outer-minus-inner sphere volumes and
the published density equation. The JS mapper instead sums local sectors and
uses stable shell polynomials. The actual Python output is retained in
`reference.json`; `--check` reruns the independent arithmetic. JS totals agree
within 64 machine epsilons relative. This checks arithmetic and implementation;
the authorship of the ideal geometry is still the declared experiment.

| Controlled total | Result |
| --- | --- |
| Water volume | 4188.790204786391 mm3 |
| Pure-water density | 996.785745611544 kg/m3 |
| Water mass | 0.004175326367488335 kg |
| Calcite-shell volume | 1386.4895577842954 mm3 |
| Calcite inventory | 0.03753965337586764 mol |

For comparison, the producer constructs the actual legacy limestone wall at
the same **nominal** 20 mm diameter and 1 mm remaining thickness. Its reference
inventory is still defined by the existing `15 / 40.078` mmol/kg-reference/mm
calibration. The legacy irregular shape is not equated to the analytical sphere.

If that reference kilogram were asserted to equal the actual 0.0041753 kg of
water, its stock would be about **24022.3014 times smaller** than the declared
physical shell. The diagnostic records both quantities and the implied reference
mass needed to represent the shell. That implied reference mass is not water.
This conditional mismatch does not establish that the old calibration is wrong;
it establishes that an unproved identity between the two quantities is unsafe.
No legacy wall, chemical ledger, geometry or calibration is modified.

## What remains HOLD

The controlled physical calculation is executable and evidence-bearing.
Production mapping remains **HOLD**, because no evidence yet connects a
legacy scenario's wet control volumes, actual solvent mass, reactive wall phase
fraction/porosity, and spatial access to its calibrated reference transactions.
Changing the reference-to-physical relationship could change chemical debits,
wall erosion and subsequent growth. That is a separate scientific decision.

The next production decision must name that relationship and its validation
case; it must not rescale inventories to erase this diagnostic. A future debit
transaction must consume a named finite stock once and reconcile wall/aqueous
records. Rates, transport coefficients, physical clock, redox pathways and UV
remain separate gates. Grown calcite and completed surfaces cannot fill a
missing wall-stock authority.

## Reproduce

Use commissioned Windows x64 / Node 24.15.0 for the receipt and baseline checks.
Python 3's standard-library Decimal supplies the separate arithmetic witness.
CI replays the committed witness and verifies its source binding; it does not
claim to execute Python or reacquire the primary PDFs.

```text
python pilots/physical-reservoir-mapping/reference.py --write
python pilots/physical-reservoir-mapping/reference.py --check
node pilots/physical-reservoir-mapping/receipt.mjs --write
node pilots/physical-reservoir-mapping/receipt.mjs --check
npm test -- --file tests-js/physical-reservoir-mapping.test.ts --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
npm run typecheck
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --check
```

Existing production bytes and all nine registered evidence-producer contracts
are unchanged. The execution digest remains
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`.
No science receipt was rebaked/rebound and no fresh 41-scenario growth fleet was
claimed. Exact validation and retries are in the
[delivery receipt](evidence/physical-reservoir-control-v1-receipt.md).
