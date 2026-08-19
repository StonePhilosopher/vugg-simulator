# Research brief: pressure as a geological control

Date: 2026-08-05
Audience: research agent preparing an implementation-grade science packet for Vugg Simulator

## Objective

Determine how pressure should affect the simulator's mineral formation, fluid evolution, phase stability, and deformation systems across the pressure range actually represented by the game. Produce a source-traceable model proposal that a coding agent can implement without inventing coefficients.

Do **not** modify game code in this assignment. The deliverable is the scientific basis, equations/data, applicability limits, uncertainty, and a staged implementation recommendation.

## Current state and problem

- Shipping scenarios span **0.01–4.4 kbar**.
- Creative setup currently spans only **0.1–3.0 kbar** and has no exact live decompression control.
- Pressure is displayed like a general environmental variable, but the current supersaturation system has only one direct pressure gate: apophyllite is suppressed above 0.5 kbar.
- Tap/Shock change pressure and apply an engineering twinning probability, but pressure is not broadly coupled to aqueous equilibria, boiling/phase separation, reaction volumes, polymorph stability, or deformation.

The golden rule is **follow the science**. Pressure must not become a universal arbitrary multiplier on growth or saturation.

## Research questions

### 1. Thermodynamic framework

Identify the smallest defensible pressure correction for mineral-fluid equilibrium over 0.01–4.4 kbar and roughly 10–800 °C.

Address:

- the pressure dependence of equilibrium constants through reaction molar volume, including the usable form of `d(ln K)/dP = -ΔV°/(RT)` and when constant `ΔV°` is inadequate;
- water density/dielectric changes and pressure-dependent aqueous activity/speciation;
- whether the existing ppm/activity-correction model can support a pressure correction honestly, or whether pressure dependence must be limited to selected reactions until a fuller aqueous model exists;
- data sources that provide internally consistent `K(T,P)`, standard molar volumes, or equations of state.

Prefer an internally consistent dataset/framework over mixing unrelated coefficients.

### 2. Highest-value mineral systems

Prioritize systems already central to the game:

1. silica: quartz/chalcedony/opal solubility and quartz polymorph stability;
2. carbonate: calcite/aragonite/dolomite/siderite and dissolved CO2-carbonate speciation;
3. sulfate: gypsum/anhydrite/barite/celestine;
4. fluoride/halide and major hydrothermal gangue minerals;
5. pegmatite and metamorphic index minerals where pressure selects assemblages or polymorphs;
6. hydrothermal sulfides and oxides only where a measurable pressure effect is supported.

For every proposed pressure dependency, state whether pressure changes:

- equilibrium/saturation;
- aqueous speciation or gas solubility;
- phase/polymorph stability;
- nucleation kinetics;
- growth habit;
- or only the geological process that changes fluid composition.

Do not conflate those mechanisms.

### 3. Volatiles, boiling, and open systems

Research pressure-controlled boiling, fluid phase separation, and volatile exsolution in hydrothermal systems.

The result should specify:

- how to determine whether a water-dominated fluid boils at a given T/P;
- what pressure drop should do to H2O, CO2, H2S, salinity, pH, redox, and dissolved metals;
- how open versus sealed cavities change the result;
- what can be represented with the current fluid schema and what requires new conserved volatile pools;
- a defensible decompression/boiling event model for Creative mode.

### 4. Metamorphic and structural pressure

Separate lithostatic/confining pressure from transient differential stress.

Research:

- relevant pressure-temperature phase boundaries for minerals already present, especially Al2SiO5 polymorphs and silica phases;
- whether pressure alone should influence twinning, fracture, deformation, dissolution-reprecipitation, or whether those require stress/strain-rate variables;
- how a pressure drop can open fractures and change permeability without treating pressure as identical to tectonic shock.

Recommend distinct state variables if scientifically necessary: e.g. confining pressure, fluid pressure, differential stress, and strain event.

### 5. Numerical and UX boundaries

Recommend:

- the valid simulation range and resolution for pressure controls;
- whether the base unit should remain kbar or use MPa internally with kbar/MPa display options;
- safe extrapolation behavior outside sourced data ranges;
- what the live “Why did—or didn’t—this mineral form?” panel should report about pressure;
- which pressure effects should be direct controls, derived observations, boundary conditions, or process actions.

## Required evidence standard

- Use primary research, authoritative thermodynamic databases, or official scientific documentation wherever possible.
- Provide full citations and direct links/DOIs.
- Quote sparingly; summarize the actual equation, dataset, experimental range, and uncertainty.
- Clearly label measured relationships, thermodynamic derivations, empirical approximations, and implementation inferences.
- Reject or flag any source that cannot be verified. Do not preserve a claim merely because a current comment or gameplay behavior says it is true.
- Note incompatible standard states, units, reference temperatures, and activity conventions.

Candidate source families to evaluate—not blindly accept—include SUPCRT/Deep Earth Water models, Holland–Powell datasets, Helgeson–Kirkham–Flowers equations, IAPWS water properties, PHREEQC pressure capabilities/data limitations, and mineral-specific experimental solubility/phase-equilibrium literature.

## Deliverable

Create one Markdown research packet containing:

1. an executive verdict on what pressure can honestly control in the current model;
2. a table of pressure-dependent mechanisms by mineral/process;
3. sourced equations and required constants/data, with units;
4. validity ranges and uncertainty;
5. a recommended architecture distinguishing fluid pressure, confining pressure, and stress if needed;
6. a staged implementation plan:
   - Stage A: high-confidence, low-cascade corrections;
   - Stage B: volatile/boiling and open-system coupling;
   - Stage C: broader P–T thermodynamics;
7. calibration and verification cases with expected qualitative and, where available, quantitative outcomes;
8. explicit “do not implement” shortcuts that would misrepresent the science;
9. a machine-ready appendix listing each proposed coefficient/data table and its source.

## Acceptance criteria

The research is ready for implementation only if:

- every proposed equation has defined variables, units, source, and validity range;
- pressure effects are mineral/process-specific rather than a universal multiplier;
- fluid pressure is not confused with differential stress;
- at least one verification case covers near-surface boiling/degas, one hydrothermal case, and one metamorphic phase-boundary case;
- the proposal states what **cannot** yet be modeled honestly with the existing fluid schema;
- no coefficient is chosen solely to make a shipping scenario produce a desired mineral.

## Suggested first verification targets

- Near-surface cave/evaporite fluid at 0.01 kbar: no deep-hydrothermal pressure behavior.
- Apophyllite-bearing Deccan-style fluid: verify whether the current 0.5 kbar cutoff is supported, should be graded, or should be removed.
- Quartz-rich hydrothermal fluid during decompression: test solubility plus boiling/phase-separation consequences separately.
- Carbonate fluid connected versus closed to CO2 during decompression.
- Grimsel alpine-cleft conditions near 4.4 kbar: verify the relevant P–T assemblage and decompression path.
- Al2SiO5 stability: prove the model selects andalusite/kyanite/sillimanite from sourced P–T boundaries rather than temperature-only or label-based routing.
