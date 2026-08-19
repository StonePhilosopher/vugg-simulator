# Weathering/vadose epilogues — evidence and implementation boundary

Date: 2026-08-08  
Runtime: authoritative TypeScript/Node path only  
Calibration seed: 42; scenario cavity seeds remain authored in `data/scenarios.json5`

## Question

Can the deferred Wittichen cobalt bloom and the Naica dewatering interval be
represented as executed histories — drainage, O2, CO2, light, dissolution, and
secondary growth — without forcing a locality label into the mineral engines?

## Wittichen evidence resolution

Staude, Bons & Markl (2012), *Multi-stage Ag-Bi-Co-Ni-U and Cu-Bi vein
mineralization at Wittichen, Schwarzwald, SW Germany*, documents a final
supergene oxidation stage producing secondary arsenates, carbonates, and
sulfates after the hydrothermal vein stages. It does **not** name erythrite or
cobaltoan aragonite in the text searched for this tranche, so it supports the
stage architecture but is not cited as direct occurrence/texture evidence.

- Paper/DOI: 10.1007/s00126-011-0365-4
- Accessible manuscript:
  https://i2mconsultants.com/downloads/corp/Multi_stage_Ag_Bi_Co_Ni_U_and_Cu_Bi_vein.pdf

Wittichen/Sophia Mine occurrence catalogs support erythrite and cobalt-bearing
aragonite as secondary minerals. These are locality-grade occurrence records,
not sufficient by themselves to specify a reaction path or substrate texture.
Accordingly, the scenario does not quote either as “observed over” a named
arsenide. It requires the simulator itself to demonstrate same-site precursor
dissolution before either product can nucleate.

### Cobalt selection and partitioning

Barber, Malone & Larson (1975) precipitated CaCO3 at 25 C and found:

- below 5e-4 M Co: calcite/vaterite;
- 5e-4 to 2e-3 M: mixed products including aragonite;
- about 3e-3 M: mostly aragonite;
- at or above 1e-2 M: amorphous material only.

DOI: 10.1016/0009-2541(75)90032-7

González-López et al. (2018) independently showed Co/Ca-controlled pathways
from amorphous CaCO3 through monohydrocalcite to aragonite at ambient
conditions, with the reported pathway domain below aqueous Co/Ca 0.6.

DOI: 10.1016/j.chemgeo.2018.02.003

Brazier & Mavromatis (2022) measured Co incorporation in aragonite at 25 C and
1 bar pCO2. Their equilibrium intercept gives approximately log DCo = -1,
therefore DCo about 0.1. The implementation uses that conservative equilibrium
coefficient, books accepted trace Co into each shell, and returns it on later
dissolution through the existing accepted-shell ledger.

DOI: 10.1016/j.chemgeo.2022.120863

### Model boundary

- The Co selector is hard-present only from 20–30 C, Co >= 5e-4 mol/kg,
  aqueous Co/Ca < 0.6, and Co < 1e-2 mol/kg.
- It cannot fire in the 150–340 C hypogene Wittichen stage.
- At step 170 the authored event changes T to 25 C, fluid pressure to
  0.001 kbar, water-surface height to 2 mm, and disables the buried-stage
  fracture reheating generator. The local field therefore stays inside the
  selector's measured 20–30 C domain for the whole epilogue.
- Only vadose 3-D voxels receive the atmospheric O2 boundary. The submerged
  floor remains the preservation control.
- The carbonate pool is inherited from the separately receipted step-142
  gangue fluid. Atmospheric carbonate import is explicitly zero; light is
  explicitly absent in the underground weathering pocket.
- Erythrite requires returned Co **and** As from an accepted negative shell on
  its local Co-arsenide parent. Co aragonite requires returned Co on its local
  parent. Bulk locality licensing cannot bypass either predicate.

## Naica evidence resolution

Forti, Galli & Rossi (2007), *Mineralogical Study on Cueva de las Velas, Naica,
Mexico*, documents thick Fe-Mn-Pb oxide/hydroxide deposits that **precede**
giant gypsum and post-dewatering sulfate growth in Cueva de las Velas.

- DOI: 10.3986/ac.v36i3.171
- https://ojs.zrc-sazu.si/carsologica/article/view/171

That is a distinct cave from the Cueva de los Cristales scenario. Transplanting
the Las Velas oxide sequence as a “late oxide stage” in the giant-crystal cave
would collapse spatial facies and reverse the cited chronology. The current
scenario therefore records only the documented mining drainage (step 260),
air exposure, and recharge (step 290). It explicitly excludes the Las Velas
oxide outcome rather than pretending absence of an authored engine proves
geological absence across the Naica mine.

The drainage boundary uses concentration factor 1.0: an industrially drained
gypsum chamber is not a residual evaporating Na brine. Seed 42 retains selenite
and produces no thenardite.

## Conservation and receipts

The former generic vadose override multiplied dissolved S by 0.3, deleting 70%
of the element. The replacement boundary:

1. raises O2 to the explicit residual target and records the atmospheric import;
2. applies the authored concentration factor to every depth voxel in a newly
   vadose ring;
3. preserves total sulfur exactly (explicit pool reactions must use a separate
   balanced transfer); and
4. records drying/reflooding transactions and per-step environmental,
   dissolution, replacement, CO2, and light testimony.

Oxygen imports are reported as sums of concentration deltas across canonical
equal-weight voxel handles (ppm-equivalents), not as a fabricated cavity mass.
The legacy ring-fluid mirrors required by bulk nucleation gates are itemized
separately so they cannot be mistaken for additional canonical control volume.
Each weathering step also records the min/mean/max temperature of the canonical
vadose voxels, rather than presenting only a bulk temperature label.

Unknown spatial target strings now fail closed rather than silently applying a
localized event to all cavity voxels.

The scenario declaration itself is normalized through a semantic schema before
any behavior can consume it. Empty modes, nonfinite or negative boundary
values, incoherent step bounds, wrong light types, and malformed product,
parent, tracked-product, or exclusion structures block the declaration. Known
and explicitly named weathering products remain blocked even when a production
nucleator is called before the normal activation phase. One inclusive
`start_step..end_step` predicate controls chemistry, recording, light, and
precursor nucleation; after the window, ordinary light returns but
scenario-restricted products do not silently revert to bulk nucleation.

The cobalt partition receipt now reports both the experimental equilibrium
coefficient and the effective coefficient actually booked. They remain 0.1
through the declared Co/Ca < 0.6 selector domain; no hidden solid-fraction cap
reduces uptake near the upper boundary.

## Seed-42 fleet drift review

The v257 to v258 baseline changes numerical receipts in 10 of 39 scenarios. The
two headline changes are intended: Naica loses three unsupported thenardite
nuclei (11 to 8 total nucleations), while Wittichen gains the executed ambient
supergene suite (30 to 45). Bisbee, Great Salt Plains, Schneeberg, Searles Lake,
the generic supergene scenario, and ultramafic supergene change counts under the
all-depth drying and sulfur-conservation boundary. Roughton Gill and the zoned
dripstone cave retain identical mineral inventories and total counts; only
maximum-size receipts move slightly after the shared spatial-boundary and local
carbonate-selector corrections.

Searles ends with no crystal still labelled borax, but this is not a failure to
form borax: borax reaches seed-42 sigma about 37, and eight surviving crystals
carry the executed borax-to-tincalconite dehydration history. The full 300-step
strip preserves that testimony. This is consistent with the high-borate,
high-ionic-strength Searles brine rather than grounds to restore the old sulfur
deletion. Independent primary constraints put total borate near 0.46–0.50 molal
and sulfate near 0.73 molal:

- Felmy & Weare (1986), DOI 10.1016/0016-7037(86)90226-7
- Kulp et al. (2007), DOI 10.1128/AEM.00771-07

## Remaining limitation

O2 is an open-reservoir boundary/gate here; the simulator still lacks a general
conserved oxygen/hydrogen reaction inventory capable of balancing proton
production for every arsenide oxidation reaction. Metal and arsenic transfer is
mass-balanced exactly through accepted shell inventories. The receipt states
that scope rather than manufacturing a pH change from unbooked protons.

The AI Dr. Michael Wise hostile-review role returned `SATISFIED` after four
correction rounds covering semantic fail-closed declarations, full-domain Co
booking testimony, complete SIM 258 release artifacts, optional precursor
structures, shared end-step behavior, and the pre-activation nucleator path.
