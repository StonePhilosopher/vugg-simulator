# Germanium in sphalerite: implementation research

Date: 2026-08-05

## Decision

Creative mode's dissolved-Ge control now drives a mass-accounted sphalerite
trace model. It does **not** change sphalerite supersaturation or claim to be a
general equilibrium ore-grade calculator.

The model uses an empirical sphalerite/fluid partition coefficient of
`Kd(Ge) = 1708 +/- 157` measured at 200 C by Belissont. The thesis reports that
at 25, 90, and 150 C essentially the entire experimental dissolved-Ge stock was
scavenged, preventing calculation of a finite Kd at those temperatures. The
simulator therefore labels 1708 as a 200 C proxy whenever it displays it.

The solid-zone estimate is:

`Ge_solid_ppm = min(22,000, Ge_fluid_ppm * 1708)`

The 22,000 ppm ceiling is an approximate mass equivalent of 3 mol% Ge on the
Zn site. Liu et al. found the sphalerite structure remains resilient above
3 mol% substitution in their calculations/experiments. The displayed solid
estimate is converted to Ge atoms per ZnS formula unit and passed through the
same accepted-zone mass-balance scale as Zn and S. A rejected/dry-run growth
zone consumes nothing. Sphalerite dissolution returns Ge using the
thickness-weighted trace inventory of its prior positive zones. The reachable
return path is oxidative weathering of undersaturated sphalerite (`O2 >= 2.5` in
the simulator's dissolved-oxygen proxy); the same dissolution zone returns Zn
and S through the centralized dissolution table.

## Scientific limits

Liu et al. synthesized Ge-bearing sphalerite at 200 C in sediment-hosted
Zn-Pb-like hydrothermal conditions and found Ge(IV) incorporation both with and
without Cu. Cu-coupled substitution is important, but vacancy-assisted and
Fe-associated mechanisms also occur. Consequently the simulator does not make
Cu a hard Ge-uptake gate.

Most importantly, Liu et al. state that a thermodynamic model and properties
for Ge(IV) incorporation in sphalerite are still lacking, so aqueous Ge
solubility cannot yet be quantified rigorously. That rules out presenting this
implementation as a universal thermodynamic partition law. The UI and zone
notes call it an empirical/extrapolated proxy.

## Sources

- Liu, W. et al. (2023), “Germanium speciation in experimental and natural
  sphalerite: Implications for critical metal enrichment in hydrothermal Zn-Pb
  ores,” *Geochimica et Cosmochimica Acta* 342, 198-214.
  DOI: 10.1016/j.gca.2022.11.031.
- Belissont, R. (2016), doctoral thesis, experimental Ge partitioning and
  isotope fractionation in sphalerite, Chapter 8, section 8.6.
- Model and acceptance test: `tests-js/sphalerite-germanium.test.ts`.
