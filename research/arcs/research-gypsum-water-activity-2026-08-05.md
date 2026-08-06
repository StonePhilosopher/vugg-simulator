# Gypsum water activity — implementation note (2026-08-05)

## Decision

Gypsum/selenite saturation now includes the two-water term for the
dissolution reaction:

`CaSO4·2H2O(s) = Ca2+ + SO4^2- + 2 H2O`

Therefore `log10(IAP)` contains `2 log10(a_w)`. Anhydrite has no water term.

## Water-activity model

The simulator's `salinity` field is bulk per-mille salinity, not a complete
electrolyte analysis. It is converted to a deliberately labelled
**NaCl-equivalent weight percent** (`salinity / 10`) and linearly interpolated
against Chirife and Resnik's 0.5 wt% table. Their paper reports that the
underlying experimental compilations and Pitzer predictions agree within
0.0007 at 25 C, and that values from 15–50 C remain within about 0.002.

This is not called a full Pitzer model. Natural Na-Ca-Mg-Cl-SO4 bitterns with
the same total salinity can have different water activity. The UI and returned
assessment therefore expose a proxy status and uncertainty. Above the paper's
26 wt% NaCl table, the final tabulated slope is extrapolated only through the
Creative-mode maximum (30 wt%) and labelled composition extrapolation.

## Primary sources

- Chirife, J. & Resnik, S. L. (1984), “Unsaturated Solutions of Sodium
  Chloride as Reference Sources of Water Activity at Various Temperatures,”
  *Journal of Food Science* 49, 1486–1488. DOI:
  https://doi.org/10.1111/j.1365-2621.1984.tb12827.x
- Harvie, C. E. & Weare, J. H. (1980), “The prediction of mineral
  solubilities in natural waters: the Na-K-Mg-Ca-Cl-SO4-H2O system from zero
  to high concentration at 25 C,” and associated gypsum/anhydrite equilibrium
  treatment. The high-concentration multicomponent formulation remains the
  upgrade path; this tranche does not pretend bulk salinity supplies its
  required composition.

## Tests

`tests-js/sulfate-water-activity.test.ts` pins pure water, seawater-like
35 per mille, 26 wt% NaCl, and the disclosed 30 wt% extrapolation. It also
pins the gypsum SI shift to exactly `2 log10(a_w)` while anhydrite is unchanged.
