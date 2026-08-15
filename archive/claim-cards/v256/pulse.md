# CLAIM CARD — pulse  (v256, seed 42, 100 steps)

**Anchor:** (generic testing scaffold — no specific locality)
**Deposit:** Cooling with a fluid pulse mid-growth + a cooling pulse later. Tests event-driven chemistry perturbation.
**Initial:** 350 °C, 1.2 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 7703c131164c85391310268eb8e57397b65ec715fe1e1397b0e0a4dfceb1d68d

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** quartz
**Statistical (0):** (none)
**Aspirational (1):** calcite — Geologically plausible late gangue, but absent from the release seed audit; a future carbonate-bearing pulse must deliver it before it becomes deterministic.
**Locality exclusions (0):** (none)

**Cited sources:**
  - (testing scaffold — no published source)

## Paragenetic order as grown (3 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | quartz | 40 | 1 | 0 | nucleation |
| 2 | siderite | 40 | 1 | 0 | nucleation |
| 3 | rhodochrosite | 71 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** siderite, rhodochrosite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** calcite
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 348.26089435471005 → 293.4105698366198 °C  [244.6589021680856, 348.26089435471005] (raw_simulation_state)
  - pH: 6.5 → 6.52236314290925   [6.138293144199998, 6.691300541884266] (raw_simulation_state)
  - Eh: -200 → -200 mV  [-200, -200] (raw_simulation_state)
  - salinity: 5 → 5 psu  [5, 5] (raw_simulation_state)
  - O2: 0 → 0 mg/L  [0, 0] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -2.394 → -2.394  [-3.15, -1.953]
  - SI_aragonite: -2.52 → -2.457  [-3.213, -2.016]
  - SI_dolomite: -5.039 → -4.976  [-7.118, -4.346]
  - SI_HMC: -2.331 → -2.331  [-3.087, -1.89]
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
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-250 C promoted Ksp(T) envelope; no extrapolation.
    - siderite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - rhodochrosite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - anhydrite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-300 C promoted Ksp(T) envelope; no extrapolation.
    - barite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-300 C promoted Ksp(T) envelope; no extrapolation.
    - celestine: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1.2 → 1.2 kbar [1.2, 1.2], n=100
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=100
  - Temperature: 348.26089435471005 → 293.4105698366198 °C [244.6589021680856, 348.26089435471005], n=100
  - Secure aragonite assessment: 0/100 executed steps; first={"boundary_kbar":3.1070299398706682,"secure_aragonite":false}, last={"boundary_kbar":2.733646495312292,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":100}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Generic testing scenario — not anchored to a real locality. Acts as a slightly more interesting twin of `cooling`: a single fluid pulse plus a cooling pulse halfway through to test event-driven chemistry perturbation.

> Audit treats this as a testing scaffold (per the user's clarification on the audit brief), so the only gap-fill here is the brief-required non-zero Mg.
