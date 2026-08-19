# Reaction-specific carbonate and sulfate pressure grids — 2026-08-08

## Decision

Promote pressure dependence only where the game reaction has an exact solid
endmember and aqueous product set in SUPCRTBL. Generate the pressure response
offline from standard molal reaction Gibbs energies, preserve the existing
evidence-backed 1-bar `Ksp(T)` calibration, and apply only

`Δlog10 K(T,P) = log10 K_SUPCRTBL(T,P) - log10 K_SUPCRTBL(T,1 bar)`.

This avoids the rejected universal multiplier and the rejected constant
reaction-volume extrapolation. Runtime interpolation is bilinear only inside the
generated grid, only inside each game's already promoted temperature envelope,
and only when all four water-density corners are at least 0.35 g/cm³.

## Versioned research artifact

- The supported repository workflow is Node.js/TypeScript-only. The old Python
  gameplay/testing runtime is retired, and this pressure work does not restore
  a Python toolchain.
- The checked-in numeric table records an offline Reaktoro 2.13.0 + SUPCRTBL
  commissioning calculation. It is treated as an immutable research artifact,
  not as an executable generator maintained by this repository.
- `tools/check-pressure-grid.mjs` verifies the canonical payload digest, the
  browser runtime copy, the source-model receipt, and the promoted reactions.
- Output: `data/generated/thermo-pressure-grid.json`
- Synchronous runtime artifact: `js/20e-thermo-pressure-grid.generated.ts`
- Axes: 10–800°C; 0.001–4.4 kbar
- Reference pressure: 0.001 kbar (1 bar)
- Reaction equation:
  `log10 K = -ΔG°reaction / (R T ln 10)`
- Water-density mask: `molar_mass(H2O) / V°(H2O)` from the same SUPCRT model.
  The resulting values reproduce the commissioned IAPWS anchors, including
  0.77648 g/cm³ at 300°C/0.5 kbar and 0.87877 g/cm³ at 450°C/4.4 kbar.

The official Geochemical Modeling Gateway exposes SUPCRTBL, but its interactive
service requires a signed-in, administrator-approved account. Ordinary builds,
tests, audits, and releases do not depend on that service or a second language
runtime; any future recommissioning is a separate research task.

## Promoted exact reactions

| Game mineral | SUPCRTBL dissolution reaction | Runtime T envelope |
|---|---|---:|
| calcite | Calcite = Ca+2 + CO3-2 | 10–90°C |
| aragonite | Aragonite = Ca+2 + CO3-2 | 10–90°C |
| dolomite | Dolomite,ordered = Ca+2 + Mg+2 + 2 CO3-2 | 10–250°C |
| siderite | Siderite = Fe+2 + CO3-2 | 10–200°C |
| rhodochrosite | Rhodochrosite = Mn+2 + CO3-2 | 10–200°C |
| anhydrite | Anhydrite = Ca+2 + SO4-2 | 10–300°C |
| barite | Barite = Ba+2 + SO4-2 | 10–300°C |
| celestine | Celestite = Sr+2 + SO4-2 | 10–200°C |

The narrower runtime envelopes are deliberate. A generated high-temperature
SUPCRTBL node does not validate the game's independent 1-bar `Ksp(T)` curve
outside its cited range.

## Numerical spot checks

At 25°C and 4.4 kbar, relative to 1 bar at 25°C:

| Reaction | Δlog10 K |
|---|---:|
| calcite dissolution | +3.3476 |
| aragonite dissolution | +3.1356 |
| ordered-dolomite dissolution | +6.1699 |
| siderite dissolution | +2.9641 |
| rhodochrosite dissolution | +2.7805 |
| anhydrite dissolution | +2.6962 |
| barite dissolution | +2.6457 |
| celestine dissolution | +2.5507 |

These different shifts are the test that the implementation is reaction
specific. A positive dissolution `ΔlogK` raises Ksp and lowers saturation index
by the same amount.

## Explicit non-promotions

- Gypsum/selenite: no gypsum solid exists in the selected SUPCRTBL species set.
  Its existing Hardie water-activity/temperature equilibrium selector and
  pressure-shifted gypsum/anhydrite phase boundary remain active, but gypsum Ksp
  receives no fabricated pressure correction.
- HMC: requires a continuous Mg-calcite activity/composition model.
- Rosasite and aurichalcite: variable Cu–Zn compositions require a solid-solution
  model rather than a chosen proxy endmember.
- Smithsonite, cerussite, witherite, strontianite, malachite, azurite, and
  hydrozincite: their exact solids are absent from this SUPCRTBL dataset.

Every non-promotion is encoded in the artifact and visible in Creative's
formation diagnosis. Unsupported reactions return a zero correction and an
explicit status; they never inherit calcite, barite, or a constant-ΔV family
proxy.

## Runtime consumers

- Carbonate SI and promoted nucleation engines
- PWP net precipitation/dissolution rates
- Sulfate SI and the authoritative CaSO4 evaluator
- Gypsum/anhydrite replacement (anhydrite SI pressure response plus the existing
  phase boundary)
- Helicoid/strip SI instruments
- Creative “Why did—or didn't—this mineral form?” pressure evidence
- Science/provenance manifest and model digest

## Verification

- `tests-js/thermo-pressure-grid.test.ts` validates the generated digest,
  reaction identities, density, reaction-specific values, bounded interpolation,
  unsupported paths, SI shifts, CaSO4 consumption, and Creative diagnosis.
- Focused pressure/carbonate/sulfate suite: 107/107 passing after integration.
- `tools/gen-science-provenance-manifest.mjs` rejects missing/tampered pressure
  data, runtime/data digest drift, missing citations, or an undeclared model
  identity.
- `npm run check:pressure-grid` verifies both checked-in artifacts through the
  pinned Node verifier; it does not probe for or invoke an external interpreter.

## Fleet reconciliation found by the pressure promotion

The first v252 bake correctly lowered carbonate saturation at depth, but it also
exposed an older selector bug. The low-Mg 45–90°C aragonite term represents an
open hot-spring vent/apron pathway; it was nevertheless active whenever a sealed
vein merely cooled through the same temperature. Pressure-aware Sweetwater
calibration briefly made that leak visible as an unlicensed aragonite crystal.

The correction is mechanistic rather than a locality ban: the spring-temperature
selector now requires fluid pressure at or below 0.10 kbar. Mg-driven aragonite
selection and the independently assessed high-pressure aragonite stability field
remain available at depth. A direct regression test compares identical low-Mg
fluids at 0.05 and 0.20 kbar. The shallow fluid retains the spring path; the
sealed-vein fluid does not.

Sweetwater's documented hydrothermal dolomite is retained by allowing the last
dolostone-neutralized brine to rebound only 0.45 pH unit at sealing. The measured
seed-42 post-seal state is pH 7.024 with pressure-corrected dolomite Ω = 14.46
against the executable nucleation threshold of 10; aragonite's maximum effective
σ is only 0.182. The final assemblage is the same six licensed species as v251.
Generic `mvt` loses one 6.6-µm aragonite nucleus, consistent with its authored
low-Mg brine note and calcite gangue interpretation. The shallow travertine and
high-Mg cave/sabkha aragonite homes remain present.

## Primary/model sources

- Johnson, Oelkers & Helgeson (1992), SUPCRT92:
  <https://www.sciencedirect.com/science/article/pii/009830049290029Q>
- Zimmer et al. (2016), SUPCRTBL:
  <https://par.nsf.gov/servlets/purl/10020692>
- Wagner & Pruss (2002), IAPWS-95 water equation of state,
  DOI 10.1063/1.1461829.
- Indiana University Geochemical Modeling Gateway:
  <https://js2-gateway.ear180013.projects.jetstream-cloud.org/>
- Reaktoro database-loading documentation:
  <https://reaktoro.org/tutorials/basics/loading-databases.html>
- Reaktoro standard thermodynamic-property documentation:
  <https://reaktoro.org/tutorials/basics/computing-thermo-props-of-species.html>
