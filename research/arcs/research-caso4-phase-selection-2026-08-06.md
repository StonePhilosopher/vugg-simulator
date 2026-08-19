# CaSO4 phase selection and replacement research (2026-08-06)

## Decision

The simulator must treat three questions separately and expose all three in the
Creative-mode formation diagnosis:

1. Is the fluid saturated with gypsum or anhydrite?
2. Which solid is the equilibrium phase at the current temperature, water
   activity, and fluid pressure?
3. Is the relevant kinetic route available: primary gypsum, primary anhydrite,
   or replacement of an existing CaSO4 precursor?

No locality-specific switch is permitted. The same evaluator drives
nucleation, replacement, and the “Why did—or didn’t—this mineral form?” panel.

## Equilibrium selector

Hardie (1967) measured reversible gypsum/anhydrite equilibrium points at one
atmosphere:

| water activity | boundary temperature |
|---:|---:|
| 0.770 | 23 C |
| 0.845 | 39 C |
| 0.960 | 55 C |
| 1.000 | 58 +/- 2 C (extrapolated pure-water reversal) |

The model piecewise-linearly interpolates these points and labels values below
`a_w=0.770` as extrapolation. The existing pressure packet contributes the
Clapeyron approximation `+14.7 C/kbar` using fluid pressure. Water activity is
the existing Chirife & Resnik NaCl-equivalent salinity proxy; its uncertainty is
propagated through the local Hardie slope. A multicomponent Pitzer treatment is
still a future refinement, not something this implementation claims to be.

Primary source: Hardie, L.A. (1967), *The gypsum-anhydrite equilibrium at one
atmosphere pressure*, American Mineralogist 52, 171-200.
https://paperzz.com/doc/8963128/the-gypsum-anhydrite-equilibrium-at-one-atmosphere-pressure1

## Kinetic routes

Ossorio et al. (2014) observed gypsum as the sole primary phase below 80 C;
between 80 and 120 C gypsum and bassanite were primary products, while
anhydrite appeared only later by transformation. No primary anhydrite was
observed in their experiments, and conversion at 60 C required more than two
years. The simulator therefore keeps a conservative 100 C floor for direct
anhydrite nucleation while allowing an equilibrium-favored anhydrite to replace
an existing gypsum precursor on the simulator’s geologic time step.

Primary source: Ossorio et al. (2014), *The gypsum-anhydrite paradox revisited*,
Chemical Geology 386, 16-21. https://doi.org/10.1016/j.chemgeo.2014.07.026

Sabkha observations show gypsum mush progressively replaced by anhydrite as
brine chlorinity rises, and rehydration where later freshening lowers
chlorinity. This is a dissolution-reprecipitation texture, not direct cold
anhydrite nucleation and not a zero-mass cosmetic relabel.

Primary field source: Shearman (1978 archive record), *Evaporites of coastal
sabkhas*. https://archives.datapages.com/data/sepm/journals/v38-41/data/039/039001/0070.htm

## Balance convention

Gypsum and anhydrite both book one Ca and one sulfate sulfur in the calibrated
axial-growth ledger. An in-place replacement therefore leaves every booked Ca
and sulfate shell untouched. The transition separately records `+2` structural
waters released per formula unit for gypsum -> anhydrite and `-2` for the
reverse hydration. The represented formula amount is the same calibrated
mmol/kg-per-accepted-micron proxy used by the growth ledger; it is not asserted
to be rendered physical mass or volume.

The external gypsum outline is preserved as a replacement pseudomorph. Using
PHREEQC molar volumes (gypsum about 73.9 cm3/mol; anhydrite about 46.1 cm3/mol),
the model records a solid-volume ratio of 0.624 and the complementary internal
porosity, without shrinking the external envelope or inventing/removing CaSO4.
