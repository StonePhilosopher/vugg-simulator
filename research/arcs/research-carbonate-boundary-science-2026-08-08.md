# Carbonate boundary science contract — 2026-08-08

## Decision

Replace the simulator's fixed `DIC × 0.70` / `pH ± 0.5` CO2 events with an
opt-in, mass-conserving carbonate boundary. The first implementation must keep
aqueous dissolved inorganic carbon (DIC), an acid/base-capacity inventory, and
CO2 in a declared headspace as separate state variables. pH is a solved result,
never a bookkeeping shortcut.

This is the minimum defensible model. PHREEQC treats aqueous solutions, gas
phases, minerals, mixing, specified mole transfers, pressure, and temperature as
distinct reactants/calculations; collapsing those reservoirs into a pH increment
cannot preserve mass or expose the boundary condition. [Parkhurst & Appelo,
PHREEQC v3, USGS Techniques and Methods 6-A43](https://pubs.usgs.gov/tm/06/a43/)

## Evidence used

- DIC and total alkalinity are independent conservative carbonate-system
  variables with respect to mixing and changes of temperature and pressure.
  Gas exchange changes DIC without directly changing alkalinity. The full total
  alkalinity expression also includes non-carbonate acid/base systems.
  [Wolf-Gladrow et al. 2007, *Marine Chemistry* 106, 287–300](https://epic.awi.de/16138/1/Wol2007a.pdf)
- Carbonate alkalinity is `[HCO3-] + 2[CO3--]`; the reduced model may add
  `[OH-] - [H+]`, but it must not call that reduced inventory full analytical TA
  when borate, phosphate, silicate, sulfide, and other buffers are omitted.
  [NOAA/NCEI OCADS alkalinity computation](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/ndp_065/3d.html)
- Henry solubility is properly expressed against fugacity. Near one atmosphere,
  fugacity may be approximated by partial pressure at roughly sub-percent error;
  pressure corrections and gas non-ideality become explicit outside that range.
  Weiss reports the gravimetric solubility relation and measured temperature/
  salinity coefficients rather than treating CO2 as an ideal, salinity-free gas.
  [Weiss 1974, *Marine Chemistry* 2, 203–215](https://frouingroup.ucsd.edu/EEZ_Argentina/1-s2.0-0304420374900152-main.pdf)
- The existing Plummer–Busenberg carbonate constants are grounded in roughly 350
  measurements for CaCO3–CO2–H2O from 0–90 °C at one atmosphere. They do not
  license unrestricted brine or hydrothermal extrapolation.
  [Plummer & Busenberg 1982, *GCA* 46, 1011–1040](https://www.sciencedirect.com/science/article/pii/0016703782900564)
- A later high-T/P brine treatment exists, but it is an equation-of-state plus
  Pitzer-interaction model, not a one-coefficient patch. Its stated envelope is
  273–533 K, 0–2000 bar, and up to 4.3 molal NaCl, with about 7% experimental
  uncertainty. It is a separate implementation tranche.
  [Duan & Sun 2003, *Chemical Geology* 193, 257–271](https://www.sciencedirect.com/science/article/pii/S0009254102002632)
- At Mammoth Hot Springs, the observed causal sequence is pressure release,
  escape of CO2, bicarbonate repartitioning, and CaCO3 precipitation. The source
  water is a high-Ca/high-bicarbonate/high-sulfate limestone water, not a generic
  magmatic-boiling event.
  [USGS Bulletin 1444](https://npshistory.com/publications/geology/bul/1444/sec2.htm)
- The Bulletin 1444 benchmark is approximately pH 7.2, Ca 323 mg/L,
  HCO3 755 mg/L, Mg 67 mg/L, and sulfate 563 mg/L. The tutorial is a reduced
  pedagogical analogue, not a claim to reproduce that analysis sample-for-sample;
  every difference belongs in the benchmark receipt.
- Water ionization uses the Marshall–Franck temperature/density relation, with
  atmospheric-pressure pure-water density from Kell. [Marshall & Franck 1981,
  *JPCRD* 10, 295](https://srd.nist.gov/jpcrdreprint/1.555643.pdf) and
  [Kell 1975, *JCED* 20, 97](https://pubs.acs.org/doi/10.1021/je60064a005)

## State and units

Per kilogram of water:

- `dic_mol_kg`: moles of dissolved inorganic carbon. Existing `fluid.CO3`
  remains the UI/storage surrogate in mg kg-1 as CO3 equivalent, with exact
  conversion `dic_mol_kg = CO3 / (1000 × 60.01)`.
- `reduced_alkalinity_eq_kg`: reduced carbonate-system acid/base capacity,
  `DIC(α1 + 2α2) + [OH-] - [H+]`. The name deliberately does not claim full TA.
- `headspace_co2_mol_kg`: moles of CO2 in the authored gas volume per kg water.
- `headspace_L_kg`: authored gas volume. No implicit cavity-volume conversion.
- `boundary_import_mol_kg` and `boundary_export_mol_kg`: cumulative external
  carbon ledger entries. Closed equilibration leaves both unchanged.
- `uncertainties[]`: machine-readable validity flags, surfaced to the player and
  tests rather than hidden in comments.

## Equations

For `H = 10^-pH`, `K1`, and `K2`:

v1 uses a molal pH/activity convention and the ideal-dilute 1 mol/kg standard-
state approximation, so H+ and OH- activities are used numerically as mol/kg.
That approximation is a declared limitation, not a general identity between
activity and concentration. Temperature is kelvin inside every equilibrium/gas
relation. `R = 0.08314462618 L bar mol-1 K-1`; Henry constants are mol kg-1
atm-1 and convert with `1 atm = 1.01325 bar`.

```text
denom = H^2 + K1 H + K1 K2
alpha0 = H^2 / denom
alpha1 = K1 H / denom
alpha2 = K1 K2 / denom

Ac = DIC (alpha1 + 2 alpha2) + Kw/H - H
[CO2*] = alpha0 DIC
pCO2 ≈ [CO2*] / K0                 (low-pressure v1 approximation)
ngas = pCO2 Vhead / (R T)
```

Closed equilibration solves one monotonic mass-balance root:

```text
Ctotal = DIC + ngas
Ac is fixed
find DIC such that DIC + pCO2(DIC, Ac, T) Vhead/(R T) = Ctotal
```

The nested pH solve finds the pH satisfying `Ac(DIC,pH,T) = Ac_fixed`.
An open boundary fixes `pCO2_target`, solves DIC and pH at fixed `Ac`, and books
the exact change in `DIC + headspace CO2` as import or export. Adding pure CO2
to a closed headspace increases total carbon and leaves `Ac` unchanged.

For replacement-water fraction `f`, outgoing and incoming aqueous carbon are
never collapsed into a net-only edit:

```text
C_export = f DIC_old
C_import = f DIC_in
DIC_mixed = (1-f) DIC_old + f DIC_in
Ac_mixed = (1-f) Ac_old + f Ac_in
```

The retained headspace plus `DIC_mixed` then undergo closed equilibration.
`DIC_in` and `Ac_in` are both mandatory finite inputs. A failed solve commits
neither physical state nor either boundary-ledger leg.

Calcite or aragonite precipitation/dissolution changes reduced alkalinity by
`2 eq` per mole of CaCO3 transferred. This rule is not generalized to dolomite,
basic/hydroxycarbonates, mixed solids, or arbitrary DIC edits. v1 accepts only an
explicit calcite/aragonite transaction; every other observed DIC change emits
`solid_transfer_unresolved`, blocks equilibration, and leaves state unchanged.
Accepted growth/dissolution zones emit mineral-tagged, local-fluid receipts.
The controller converts their signed ppm changes to the equal-volume mean and
requires the receipt sum to match both the canonical-fluid change and the bulk
fluid handle. Merely finding an allowed crystal in the cavity is not evidence
that it caused a DIC change.

Spatial v1 is restricted to a fully flooded, fully mixed control volume. Every
canonical wet voxel has equal volume/weight; its mean DIC is the aqueous
inventory, one shared pCO2 applies, and solved DIC/pH replace every wet voxel.
Partially flooded or heterogeneous-headspace systems fail explicitly. They are
not approximated by broadcasting one bulk concentration delta over local offsets.

## Boundary semantics

- `closed`: aqueous ↔ headspace redistribution only; carbon must close to numeric
  tolerance and alkalinity is unchanged.
- `open`: reservoir at authored `target_pCO2_bar`; exact carbon import/export is
  recorded. The atmosphere is not a free pH setter.
- `charge`: authored moles of pure CO2 enter the headspace; no alkalinity change.
- `vent`: an open equilibration to an authored pCO2, not “remove 30 percent.”
- `recharge`: replacement/mixing must declare both incoming DIC and incoming
  acid/base capacity. Temperature-only reheating is not fluid replacement.
- Creative DIC edits execute as explicit full-volume recharge at the currently
  authored incoming reduced alkalinity. Creative pH is read-only while the
  conserved solver is active; strong-acid/base actions and the reduced-
  alkalinity control book capacity changes and then solve pH.

No v1 event claims boiling. H2O vapor, H2S, CH4, N2/O2 headspace competition,
two-phase flow, and kinetic gas-transfer coefficients are deferred explicitly.

## Validity envelope

The first solver is `supported` only for 0–90 °C, dilute/fresh water, and gas
conditions close enough to one atmosphere that `fCO2 ≈ pCO2` is acceptable.
It reports, without suppressing the calculation:

- `salinity_model_missing` for non-dilute water;
- `gas_nonideality_missing` for high headspace CO2 pressure;
- `temperature_outside_pb82` outside 0–90 °C;
- `full_alkalinity_systems_omitted` whenever B, P, Si, sulfide, or other acid/base
  solutes make the reduced carbonate alkalinity an incomplete proxy;
- `fluid_pressure_not_coupled_to_headspace` when liquid pressure and authored gas
  pressure differ materially.

Duan–Sun/Pitzer support may later turn the first three flags into supported
calculations. Until then, a flagged result is pedagogical/qualitative, not a
high-accuracy geochemical prediction.

## Acceptance tests

1. Closed aqueous + gas carbon closes within `max(1e-12 mol/kg, 1e-9 relative)`.
2. Open loss/recharge equals the signed boundary ledger exactly within tolerance.
3. CO2 exchange leaves reduced alkalinity unchanged; pH emerges from the solve.
4. Open and closed runs diverge deterministically and explain why.
5. Unsupported T/salinity/pressure inputs remain runnable but visibly uncertain.
6. No boiling claim and no implicit H2O/H2S bookkeeping.
7. State survives Creative setup, live edits, save/replay, hover diagnosis, strip
   recording, and the future worker snapshot format.
8. Scenarios without `carbonate_boundary` remain byte-identical.
9. The travertine tutorial replaces fixed-percentage narration with ledger values.
10. Typecheck, full tests, audit, scenario baselines, and conservation tests pass.
11. A numerical root that does not bracket returns `no_bracket`/`nonfinite`,
    records a failed transaction, and does not mutate fluid or ledger state.
12. The legacy fixed-DIC pH-only atmosphere remains baseline-compatible but is
    visibly labeled “legacy heuristic” until each consumer is migrated.
13. Accepted-zone receipts, not mineral presence, must exactly explain spatial
    DIC transfer; a residual on either the canonical mean or bulk handle blocks.
14. Charge, recharge, and titration failures are atomic. Recharge records its
    incoming and outgoing carbon legs separately.
15. The live readout displays `BLOCKED`, the latest failure code/attempt, and no
    in-envelope assurance while blocked.

## Implementation order

1. Pure conversion/speciation/alkalinity and root-solvers with unit tests.
2. Serializable boundary state and transaction receipts.
3. Opt-in simulator controller and Creative controls/readout.
4. Migrate `tutorial_travertine`; observe and retune only against published water
   chemistry and deterministic seed-42 receipts.
5. Migrate sabkha only after replacement events declare DIC + alkalinity and the
   high-salinity uncertainty is visible.
6. Dr. Wise hostile review, then the worker-compatible command/snapshot tranche.
