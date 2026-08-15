# Aragonite selectors, Sr partitioning, and cold environmental boundaries

Date: 2026-08-08  
Scope: SIM 256 hostile-review corrections  
Runtime: authoritative TypeScript simulator only

## Decisions

1. A smooth selector may weight evidence only inside its documented domain.
   Logistic tails no longer let high carbonate saturation create aragonite when
   the Mg, spring, and pressure selectors are all absent.
2. The Mg selector is evaluated as aqueous **molar** Mg/Ca. Concentrations in
   the simulator are mg/kg, so the conversion is
   `(Mg/24.305)/(Ca/40.078)`. The existing 1.1 mol/mol evidence boundary is a
   hard presence test; the sigmoid weights values at and above it.
3. The low-Mg thermal selector requires the explicit `wall.open_spring`
   geological boundary and is then confined to pressure <= 0.10 kbar and
   40-100 C. Identical shallow P-T chemistry in a sealed vein has exactly zero
   spring-selector contribution. The independently evaluated high-pressure
   aragonite stability field remains authoritative.
4. Passive cooling approaches an authorable far-field temperature and is
   one-way in every voxel. It can cool a warmer cell but cannot heat or drag an
   already-colder cell farther below ambient; a separately recorded positive
   fracture pulse can still heat the field. The four
   shipped scenarios starting below 25 C now author their actual boundary:
   stalactite demo 15 C, zoned dripstone 18 C, Searles Lake 18 C, and Colorado
   Plateau 22 C.
5. Aragonite Sr uptake is a conserved accepted-zone trace substitution. The
   engine records and debits the local fluid at `D_Sr=1.38 +/- 0.53`; exact
   booked Sr returns if that shell dissolves.

## Primary evidence

- Wassenburg et al. (2016), *Geochimica et Cosmochimica Acta* 190, 347-367,
  doi:10.1016/j.gca.2016.06.036. Nine calcite-aragonite transitions yield
  `D_Sr(Ar)=1.38 +/- 0.53` (1 sigma). The coefficient is
  `(Sr/Ca)_aragonite/(Sr/Ca)_solution` on a molar basis.
- Wassenburg et al. (2024), *Communications Earth & Environment* 5, 488,
  doi:10.1038/s43247-024-01648-5. Direct high-resolution Grotte de Piste
  dripwater data give `D_Sr=1.31 +/- 0.11` and explicitly model
  `delta Sr = delta Ca * (Sr/Ca)_solution * D_Sr`. The observed PAP regression
  slope is `0.443e-3`; divided by `D=1.31`, this implies a representative
  solution molar Sr/Ca of about `3.38e-4` for the modeled PAP subset.

## Zoned-cave dissolved Sr calibration

The prior scenario values (`Sr=25` globally and `Sr=60` at the ceiling) were
solid-speleo-style numbers placed in an aqueous ppm field. They also exceeded
the simulator's strontianite ingredient gate and produced four large cave
strontianites with no geological source.

To preserve the scenario's intentionally concentrated Ca scale while importing
the measured dripwater relation, convert molar Sr/Ca to a mass ratio:

`Sr/Ca_mass = 3.38e-4 * 87.62 / 40.078 = 7.39e-4`

- Global `Ca=2000 ppm` -> `Sr=1.48 ppm`.
- Ceiling `Ca=800 ppm` -> `Sr=0.59 ppm`.

This is a ratio transfer, not a claim that the scenario's absolute Ca is a
literal Grotte de Piste measurement. It eliminates the unlicensed strontianite
reservoir while retaining a primary-data-bounded aragonite trace budget.

## Conservation contract

For each accepted aragonite shell:

`nu_Sr = D_Sr * (Sr/Ca)_solution,molar`

`nu_Sr` is stored in `zone.trace_stoichiometry.Sr`. The standard accepted-zone
budget debits only the final thickness after time scaling, competition, and
cavity clamps. The exact accepted ppm per micrometre is stored in
`zone._budget_inventory_per_um.Sr`, and LIFO dissolution returns that exact
inventory. If dissolved Sr is exhausted, Sr is optional and the shell may
continue as purer aragonite; the receipt records the resulting effective D and
an inventory-limited flag.

## Reproducibility note

The game runtime and its test suite are TypeScript/Node. Historical Python-game
and pytest instructions are retired documentation and are not part of this
work. The separately named pressure-grid generator remains optional offline
research tooling and does not participate in gameplay or ordinary tests.
