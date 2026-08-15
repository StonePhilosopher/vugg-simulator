# CLAIM CARD — pulse  (v242, seed 42, 100 steps)

**Anchor:** (generic testing scaffold — no specific locality)
**Deposit:** Cooling with a fluid pulse mid-growth + a cooling pulse later. Tests event-driven chemistry perturbation.
**Initial:** 350 °C, 1.2 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 0d7f425d6d6c8ace812412dabb01df2a645455a1a293025852595c524313336c

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (2):** quartz, calcite

**Cited sources:**
  - (testing scaffold — no published source)

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | quartz | 39 | 1 |
| 2 | siderite | 39 | 1 |
| 3 | rhodochrosite | 70 | 1 |

**Surprises (grown but NOT in expects_species):** siderite, rhodochrosite
**No-shows (expected but never nucleated):** calcite

## Environment trajectory (first → last, [min,max])
  - T: 348.425 → 292.323 °C  [245.079, 348.425]
  - pH: 6.504 → 6.504   [6.118, 6.669]
  - Eh: -201.575 → -201.575 mV  [-201.575, -201.575]
  - salinity: 4.724 → 4.724 psu  [4.724, 4.724]
  - O2: 0 → 0 mg/L  [0, 0]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -2.394 → -2.394  [-3.15, -1.953]
  - SI_aragonite: -2.52 → -2.457  [-3.213, -2.016]
  - SI_dolomite: -5.039 → -4.976  [-6.488, -4.094]
  - SI_HMC: -4.157 → -4.157  [-4.913, -3.717]
  - SI_siderite: -0.882 → 0  [-1.008, 0.252]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1.2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.121 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 75.64 °C; initial a_w=1.000 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1.2 → 1.2 kbar [1.2, 1.2], n=100
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=100
  - Temperature: 348.2608943547122 → 293.4105698366183 °C [244.6589021680877, 348.2608943547122], n=100
  - Secure aragonite assessment: 0/100 executed steps; first={"boundary_kbar":3.1070299398706847,"secure_aragonite":false}, last={"boundary_kbar":2.733646495312283,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":100}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Generic testing scenario — not anchored to a real locality. Acts as a slightly more interesting twin of `cooling`: a single fluid pulse plus a cooling pulse halfway through to test event-driven chemistry perturbation.

> Audit treats this as a testing scaffold (per the user's clarification on the audit brief), so the only gap-fill here is the brief-required non-zero Mg.
