# Mixed-carbonate solid solutions: promoted scope and limits

Date: 2026-08-08  
Decision rule: follow measured chemistry; do not promote a convenient
composition proxy into an equilibrium model.

## Decision

Promote high-magnesium calcite (HMC) from a fixed 10 mol% Mg proxy to a
zone-resolved calcite–disordered-dolomite solid solution. Each candidate shell
now has:

- `x = Mg/(Ca+Mg)` predicted from the aqueous **molar** Mg/Ca ratio and the
  measured temperature-dependent Mg distribution coefficient;
- nonideal solid-component activities from the calcite–Ca0.5Mg0.5CO3
  subregular model;
- an exact `Ca(1-x)Mg(x)CO3` growth-budget formula;
- a serialized thermodynamic and partition receipt; and
- exact shell-by-shell dissolution return of the Ca, Mg, and carbonate that
  precipitation booked.

The crystal-level `_mg_content` value is no longer treated as the composition
of every growth increment. It is a remaining-shell thickness-weighted display
summary; the zone is the authoritative scientific record.

Do **not** promote rosasite or aurichalcite to production solid-solution
thermodynamics in this tranche. Their variable Cu/Zn compositions do not make
them interchangeable endmembers of the HMC model, and the implemented source
set does not provide a defensible composition/activity/partition relation.
Aurichalcite's published representative 25 °C values differ by about 14 log
units under different composition/speciation treatments. Both therefore stay
explicit Tier-C observers; the simulator will not infer solid composition from
the aqueous Cu/Zn ratio and call that equilibrium.

## Composition model

Mucci (1987) measured:

`D_Mg = (Mg/Ca)_solid / (Mg/Ca)_aqueous`

for standard-composition seawater with anchors:

| Temperature | D_Mg |
|---:|---:|
| 5 °C | 0.0121 |
| 25 °C | 0.0172 |
| 40 °C | 0.0271 |

Mucci (1987) explicitly warns that these temperature values apply to the
standard-composition seawater series, not arbitrary parent fluids. Mucci &
Morse (1983) further show that D_Mg changes with parent Mg/Ca below roughly
7.5 and approaches a separate ~0.0123 plateau only at high Mg/Ca at 25 °C.
The runtime therefore supports two bounded domains only:

- a declared proxy for standard seawater: molar Mg/Ca 4.5–6.0, salinity
  30–40‰, and 5–40 °C, with interpolation between the three temperature
  anchors; or
- the measured high-ratio plateau: molar Mg/Ca 7.5–20, a seawater-like
  30–40‰ solution-matrix proxy, and 25±0.25 °C, using D_Mg=0.0123.

All other parent fluids return `compositionDomainSupported=false`, a named
domain status, and no composition/presence/absence verdict. They do not hold
temperature endpoints or silently turn an unsupported partition calculation
into low-Mg calcite. With `r_s = D_Mg r_a`, a supported shell composition is
`x = r_s/(1+r_s)`. The supported partition domains produce values within the
promoted HMC screen of 0.04–0.30 Mg mole fraction. Parent-fluid ratios above
the measured Mg/Ca=20 ceiling are unresolved; they are not clipped into a
fabricated HMC prediction.

The aqueous ratio is molar, using Ca and Mg molar masses. The former mass-ratio
shortcut was not a partition coefficient and is retired.

## Nonideal solid activity model

The official PHREEQC calcite–Ca0.5Mg0.5CO3 example supplies the dimensional
Guggenheim parameters `12.593` and `4.70 kJ/mol` (equivalent to dimensionless
`5.08` and `1.90` at 25 °C). HMC `x` maps to the disordered-dolomite
half-formula component fraction `y2 = 2x`; `y1 = 1-y2` is calcite.

At runtime, dimensional parameters are converted with `A = G/(RT)` and the
documented subregular relations are evaluated:

`ln(gamma1) = [A0 - A1(4y1-1)] y2^2`

`ln(gamma2) = [A0 + A1(4y2-1)] y1^2`

The interaction parameters and PHREEQC example are calibrated at 25 °C.
Applying the same dimensional parameters from 5–40 °C and dividing by RT is a
bounded activity-model extrapolation, not a measured temperature calibration;
the zone/UI receipt names that assumption separately from miscibility status.

Component activity is `ai = yi gammai`. The fixed-composition dissolution
constant is the stoichiometric combination of calcite and half-dolomite
component constants plus their solid activities. At `x=0`, the calculation
recovers pure calcite exactly. Inside the solution, response may be
non-monotonic; tests intentionally do not reimpose the retired linear Ksp ramp.

The same official PHREEQC example reports a 25 °C miscibility gap of
`y2=0.0428–0.9991`. Because `y2=2x`, the entire promoted HMC interval lies
inside that gap. The computed homogeneous branch is therefore explicitly a
**metastable fixed-composition kinetic saturation screen**, not a stable
homogeneous solid-solution equilibrium. At 25 °C the runtime records whether a
composition is inside that documented gap; at other temperatures it reports
that miscibility has not been evaluated rather than extrapolating the 25 °C
binodal. `stableEquilibriumClaim` is always false for this screen.

This is the nondefective Group-I metastable branch discussed by Busenberg &
Plummer. Growth defects, transport limitation, adsorption enrichment at low
aqueous Mg/Ca, and the distinction between measured overgrowth experiments and
all natural HMC fabrics remain kinetic/interpretive uncertainties. The UI and
zone receipts state those limits.

## Scenario consequence

`zoned_dripstone_cave` has a bulk broth of Ca 2000 and Mg 1500 mg/kg. The old
mass-ratio proxy promoted that broth to HMC. Its molar Mg/Ca is about 1.24,
which lies precisely in the parent-composition-dependent region where the
constant-D shortcut is invalid. SIM 255 therefore makes **no HMC presence or
absence claim** for that bulk broth and records the coverage gap. Its authored
`expects_species` remains calcite + aragonite; absence from a deterministic run
must not be misread as a scientific exclusion.

The sabkha's 35‰ tidal-seawater endmember falls inside the bounded seawater
proxy and can form compositionally receipted HMC. Its 120–250‰ evaporative
brines remain outside this partition model, consistent with their separately
declared high-salinity activity-model limitation. The ultramafic parent fluid
is also outside the partition domain; no HMC verdict is inferred there.

## Primary sources

- Busenberg, E. & Plummer, L. N. (1989), *Thermodynamics of magnesian calcite
  solid-solutions at 25 °C and 1 atm total pressure*, Geochimica et
  Cosmochimica Acta 53:1189–1208. USGS record:
  <https://pubs.usgs.gov/publication/70015640>
- Glynn, P. D. & Reardon, E. J. (1990), *Solid-solution aqueous-solution
  equilibria: thermodynamic theory and representation*, American Journal of
  Science 290:164–201. USGS record:
  <https://pubs.usgs.gov/publication/70016423>
- USGS PHREEQC 3 manual, `SOLID_SOLUTIONS` equations and calcite–dolomite
  example:
  <https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3-47.htm>
- Mucci, A. (1987), *Influence of temperature on the composition of magnesian
  calcite overgrowths precipitated from seawater*, Geochimica et Cosmochimica
  Acta 51:1977–1984. <https://doi.org/10.1016/0016-7037(87)90186-4>
- Mucci, A. & Morse, J. W. (1983), *The incorporation of Mg2+ and Sr2+ into
  calcite overgrowths: influences of growth rate and solution composition*,
  Geochimica et Cosmochimica Acta 47:217–233.
  <https://doi.org/10.1016/0016-7037(83)90135-7>
- Davis, K. J., Dove, P. M. & De Yoreo, J. J. (2000), *The role of Mg2+ as an
  impurity in calcite growth*, Science 290:1134–1137.
  <https://pubmed.ncbi.nlm.nih.gov/11073446/>
