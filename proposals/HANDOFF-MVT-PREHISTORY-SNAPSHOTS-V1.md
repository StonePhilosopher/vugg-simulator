# MVT prehistory and shared boundary snapshots v1

Base: `576a6ceeb81f590618d4974a30612bf9c5177d1d` (merged PR #39, SIM 286).

Connected and sealed are successive boundary states of one history-bearing
specimen. This isolated pilot derives a mixed host, removed material, void,
exposed mineral faces, incoming fluid parcels and trapped component inventories
from that shared history. It does not initialize an unrelated finite pore at
sealing, or fit a water mass or calcite amount to the old reference ledger.

**Natural-MVT physical commissioning remains HOLD.** The new numerical example
is an authored conservation control. It is not a reconstructed Tri-State
specimen, a calibrated brine, or a production migration. Both shipped runtimes,
scenario declarations, saves, RNG, old receipts and science producers remain
unchanged. Production mapping, local reactions and transport remain disabled.

## What the geological and repository sources establish

The [Kansas Geological Survey Tri-State description](https://www.kgs.ku.edu/Publications/pic17/pic17_2.html)
describes cherty limestone, preferential limestone dissolution, resistant chert,
and collapse/broken-rock porosity before mineral deposition. This supports a
multiphase host with material history; it supplies neither a phase map for our
vug nor its source-fluid volumes. The [USGS MVT framework](https://pubs.usgs.gov/publication/sir20105070A)
is qualitative context here, not a quantitative initial-condition recipe.

The actual MVT authoring declares a limestone proxy, shape seed 3, 180 C,
0.3 kbar, mixing at step 20, a pulse at 60 and tectonic activity at 80. Its
procedural cavity volume is 68,226.21551819511 mm3. It does not record how much
of each host mineral was removed to form that void, finite incoming parcel
volumes, or a physical sealing event. The `reactive_wall` scenario seals at 90;
the separate reactivated vein has seal/reopen events. Those demonstrate existing
narrative vocabulary. Their histories and quantities are not transferred to
Tri-State. Existing salinity is a NaCl-equivalent water-activity proxy, not an
analytical brine composition, density or solvent fraction.

`source-audit.mjs` reads these actual declarations and the prior authenticated
geometry observation. It retains six missing authorities, and leaves actual
connected/sealed physical snapshots `null`. `requireMvtPhysicalPrehistory()`
fails with those exact gaps; no synthetic snapshot is substituted.

## Executable causal contract

The compiler starts with a bounded explicit cuboid material map: calcite,
dolomite and quartz parcels, dimensions in mm, a named host, and a disclosure of
prior alteration. A lithology name cannot imply pure calcite or a reactive
fraction. The control has one connected cavity and one mixed component account;
disconnected cavities are rejected. These material parcels are **not** the
legacy 7,680 fluid-cell addresses.

1. Mechanical removal exports the selected phase volume to an external breccia
   ledger and creates that exact void. It creates no aqueous solute.
2. A recorded feeder connects existing void to named finite external sources.
3. Each incoming pulse depletes that source. Its solvent and component amounts
   derive from its solution volume, explicit solvent/solution-volume coefficient
   and declared molal component vector. No direct pore-water mass or wall-calcite
   initialization is accepted.
4. Sealing changes the external interface only. It preserves the host, void,
   resident solvent, components and remaining external stocks byte-for-byte.
5. The sealed control prescribes contact and removal of one exposed calcite
   parcel. Its geometry determines moles; moles determine the Ca/C/alkalinity
   transfer and crystalline volume. Other host phases and grown crystals are
   unavailable to that operation.
6. The external-reservoir comparison branches at the same pre-seal prefix.
   The same pulse is refused while sealed. Reopening retains the history and
   permits it again if the solution-volume boundary is still defined.

Every input and event has provenance. Snapshots are deeply immutable. Save/load
stores causes, model/source digest and record digest; reconstruction replays
those causes and verifies derived state. Edited history or stale model bytes
are refused. These digests establish causal consistency, not geological truth.

The seal/reopen mechanism is explicitly `imposed-outside-pore-isolation`.
It models an external control valve, not cement precipitation, fracture
mechanics, lost pore volume or a naturally predicted seal time. Mechanical
breccia export is likewise a prescribed event, not a predictive collapse law.

## Quantities, ownership and closure

| Quantity | Meaning and owner | Permitted use |
| --- | --- | --- |
| Host phase volume, mm3 | Explicit surviving material parcels; exported pieces retain phase ownership | Geometry and finite prescribed phase transfer in this control |
| Void capacity, mm3 | Sum of parcels removed from that same host | Capacity, never kg solvent |
| External source volume, mm3 solution | Finite named source, depleted once by admission | Pulse bound under the declared volume approximation |
| Water, kg solvent | Admitted solution volume times its source solvent/volume coefficient | Denominator for control component amounts; unchanged by sealing/removal |
| Components, mol; alkalinity, eq | Ca, C, Fe, Zn, Pb, S(VI), S(-II), O2, Na, Cl and alkalinity separately | Conservation, not uncomputed speciation or pH |
| Potential exposed calcite, mol CaCO3 | Parcel volume divided by the disclosed calcite molar volume | Upper stock for **prescribed** contact; not a wetting/accessibility prediction |
| Crystalline removal/new void, mm3 | Removed calcite moles times Vm times 1000, under whole-parcel removal | Explicit conversion closure for this control only |
| Legacy mmol/kg-reference and booked crystals | Existing production owners, untouched | No automatic conversion into any new physical inventory |

All host phase-volume budgets close across remaining, mechanical export and
calcite transfer. All source water and all modeled component amounts close
across resident plus remaining donors; Ca and carbon also close against the
calcite segment. Dolomite/quartz volumes close separately; their complete
elemental inventories are not claimed. Calcite dissolution adds one Ca, one C
and two equivalents alkalinity per mole, without assigning carbon species,
reaction affinity, pH or a rate. The [USGS PHREEQC input conventions](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-5.htm)
distinguish absolute reactant moles from water amount. A prescribed
[REACTION extent](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-40.htm)
does not establish time-dependent kinetics.

The crystalline calcite reference remains **36.934 cm3/mol**, at 26 C with no
pressure correction, from the previously retained [USGS B1248 source](https://pubs.usgs.gov/bul/1248/report.pdf).
Its reported error and limitations remain in the source record. This is not a
new T/P model for production MVT.

Numerical closure allows 128 binary64 epsilons times the actual magnitude of
each budget; there is no fixed absolute tolerance that could hide small stocks.
Ca/C/alkalinity transfer is independently tested at the transfer scale. A
difference of two large cavity volumes uses their original scale. The Python
witness propagates coordinate-subtraction scale through cuboid volumes. These
are numerical tolerances, **not geological uncertainty** or fit allowances.
Underflow, overflow, unrepresentable debits, duplicate material consumption and
negative finite balances fail closed. A final donor withdrawal consumes its
actual remaining inventory rather than leaving floating-point ghost solute.

## What the control proves, and its limits

The explicitly authored mixed-host case mechanically removes one parcel to
create about 1 mm3 void. It admits 0.5 mm3 of a named metal-brine analogue and
0.25 mm3 of a sulfur-water analogue, deriving **6.70e-7 kg solvent**. Sealing
retains this exact inventory. Prescribed removal of the adjacent approximately
0.0001 mm3 calcite parcel transfers **2.7075323550113443e-9 mol**. A pre-seal
0.125 mm3 brine pulse gives **7.7625e-7 kg**; the sealed state refuses it.

The fluid coefficients, component vectors, additive parcel volumes and event
choices are authored arithmetic stimuli. The vectors are not commissioned
electroneutral natural-fluid recipes. No pH, charge-balance, speciation, redox,
mixing enthalpy, pressure, diffusion, exposure duration or physical clock is
claimed. All unselected fixture components are **explicitly zero by control
definition**, never inferred absent from a natural fluid.

Partial filling does not establish which mineral surface is wetted. The
reaction event therefore requires an explicit prescribed contact model. After
reaction, solution volume becomes **unresolved (`null`)**: the original parcel
volume approximation cannot determine dissolved-solution partial volumes.
New void does not create solvent or trigger refill. Further admission is
refused even after reopening until that missing constitutive law is supplied.

This closes a control's causal bookkeeping seam. It does **not** resolve PR #39's
conditional one-reference-kilogram versus physical-pore mismatch by fitting a
factor, changing the erosion convention, or borrowing a pure-water sphere.

## Evidence and reproduction

The [new receipt](../pilots/mvt-prehistory/receipt.json) binds model, fixture,
test, CI, reference witness and existing source bytes. It records all five
boundary cases, the common prefix, sealing identity, finite stocks, closure and
actual-MVT gaps. Receipt generation is commissioned only on Windows x64 /
Node 24.15.0. The Python standard-library Decimal witness independently derives
water, components, host volumes, transfer and pulse budgets from the causal
inputs at 60 digits; it does not independently validate the geological inputs.

```text
node pilots/mvt-prehistory/receipt.mjs --check
python pilots/mvt-prehistory/reference.py
npm test -- --file tests-js/mvt-prehistory.test.ts --file tests-js/reservoir-reference-preflight.test.ts --file tests-js/physical-reservoir-mapping.test.ts --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
npm run typecheck
npm run build
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --check
```

Only the new pilot receipt is generated with `receipt.mjs --write`; do not
rebake existing production evidence for this isolated addition. CI extends the
existing finite-reservoir step with the focused tests and Python witness, while
retaining existing viewer/fallback, browser cleanup and calibration gates.

Validation results and exact-head CI are recorded in
`evidence/MVT-PREHISTORY-SNAPSHOTS-V1.md`.

## Next authority required

To commission real connected/sealed MVT snapshots, supply a sourced phase map
and alteration/void-formation history; named fluid amounts and complete
analyses; a solvent/solution-volume and mixed-fluid constitutive relation at
the declared T/P; feeder/closure provenance; and physical wet-surface/cell
allocation. Until then the natural snapshots remain absent, and production
mapping, buffering, erosion reconciliation and transport remain on HOLD.
