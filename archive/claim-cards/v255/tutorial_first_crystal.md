# CLAIM CARD — tutorial_first_crystal  (v255, seed 42, 30 steps)

**Anchor:** (tutorial scaffold — generic silica-rich broth)
**Deposit:** Tutorial 1: The Grand Tour + First Crystal. A guided top-down walk of the whole interface, then grow a quartz and watch what happens when conditions drift out of its growth window.
**Initial:** 220 °C, 1 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** d3c5878a944c50d18f99f51912177fb42ccdff69f4edf1bd680090a5a32daf19

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** quartz
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Tutorial scaffold; quartz's prograde aqueous solubility follows the simulator's Fournier & Potter / Rimstidt-Barnes basis.

## Paragenetic order as grown (1 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | quartz | 1 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 218.2608943547122 → 385.68863863251187 °C  [208.75343059925362, 418.3488041042816] (raw_simulation_state)
  - pH: 6.5 → 6.5   [6.5, 6.5] (raw_simulation_state)
  - Eh: -200 → -200 mV  [-200, -200] (raw_simulation_state)
  - salinity: 5 → 5 psu  [5, 5] (raw_simulation_state)
  - O2: 0 → 0 mg/L  [0, 0] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -1.89 → -2.583  [-2.583, -1.701]
  - SI_aragonite: -2.016 → -2.709  [-2.709, -1.827]
  - SI_dolomite: -6.299 → -5.291  [-6.299, -5.291]
  - SI_HMC: -1.89 → -2.52  [-2.52, -1.701]
  - SI_siderite: -0.189 → -0.693  [-0.693, -0.063]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 1 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.460 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 72.70 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=2.190961156; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +2.191 relative to 1 bar at the same temperature.
    - siderite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - rhodochrosite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - anhydrite: active; active=true; ΔlogK=0.9235070120000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.924 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.87020718; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.870 relative to 1 bar at the same temperature.
    - celestine: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-200 C promoted Ksp(T) envelope; no extrapolation.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 1 → 1 kbar [1, 1], n=30
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=30
  - Temperature: 218.2608943547122 → 385.68863863251187 °C [208.75343059925362, 418.3488041042816], n=30
  - Secure aragonite assessment: 0/30 executed steps; first={"boundary_kbar":2.456545959097281,"secure_aragonite":false}, last={"boundary_kbar":3.4447026292433596,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":17,"andalusite":13}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Tutorial scenario. Designed for the guided first-time-player experience. REWORKED 2026-07-04 (the Grand Tour): the overlay script opens with a top-down tour of the screen before handing off to the first-crystal arc. SIM 246 corrects that arc's thermodynamic direction: quartz nucleates above the chalcedony field at 220°C, then a 420°C hot recharge raises quartz solubility enough to make the unchanged 600-ppm fluid undersaturated. The accepted quartz record switches from growth to mass-balanced dissolution. The intended learning is: (1) what every part of the screen is, (2) clicking Advance moves time, (3) phase identity and saturation depend on conditions, and (4) changing conditions can reverse growth.

> Surfaced in the New Game Menu under Tutorials. Not anchored to a real locality — it's a teaching scaffold. Sandbox-testable as a normal scenario (the overlay only engages via startTutorial).

> Broth shape mirrors FLUID_PRESETS.silica (the existing 'Silica-rich' starter fluid) so the lesson generalizes to that picker entry.
