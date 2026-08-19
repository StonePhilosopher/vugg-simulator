# CLAIM CARD — tutorial_mn_calcite  (v258, seed 42, 30 steps)

**Anchor:** (tutorial scaffold — generic carbonate broth)
**Deposit:** Tutorial 2: A Mn-Doped Calcite. Grow a calcite, then mix in manganese and watch the next zones glow orange-red under UV. Iron quenches; the boundary records the broth-history.
**Initial:** 100 °C, 0.5 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 4d907c8a28feb90ea854da4ae7aee2819e6e5aefd320e889f517a190d9583ac6

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** calcite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - (tutorial scaffold — no published source)
  - Franklin / Sterling Hill (NJ) — type locality for Mn-activated calcite fluorescence

## Paragenetic order as grown (4 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | quartz | 1 | 1 | 0 | nucleation |
| 3 | rhodochrosite | 1 | 1 | 0 | nucleation |
| 4 | siderite | 1 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** quartz, rhodochrosite, siderite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 98.26089435471212 → 74.08204307449064 °C  [74.08204307449064, 98.26089435471212] (raw_simulation_state)
  - pH: 7 → 6.534818014968186   [6.534818014968186, 7] (raw_simulation_state)
  - Eh: -200 → -200 mV  [-200, -200] (raw_simulation_state)
  - salinity: 8 → 8 psu  [8, 8] (raw_simulation_state)
  - O2: 0 → 0 mg/L  [0, 0] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.819 → -0.378  [-0.378, 0.819]
  - SI_aragonite: 0.693 → -0.504  [-0.504, 0.756]
  - SI_dolomite: -0.567 → -1.953  [-1.953, -0.567]
  - SI_HMC: 0.693 → -0.063  [-0.063, 0.693]
  - SI_siderite: 2.016 → 0.567  [0.567, 2.016]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.569 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.995 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.86274994; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.863 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.43494203; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.435 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.40945316; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.409 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.3501189; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.350 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.3377287; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.338 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.34752569; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.348 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=30
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=30
  - Temperature: 98.26089435471212 → 74.08204307449064 °C [74.08204307449064, 98.26089435471212], n=30
  - Secure aragonite assessment: 0/30 executed steps; first={"boundary_kbar":2.5760992076141394,"secure_aragonite":false}, last={"boundary_kbar":2.6838539388156937,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":30}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Tutorial scenario. Teaches how additives change a growing crystal's properties: Mn²⁺ activates orange fluorescence in calcite (threshold 2 ppm) and Fe²⁺ quenches it. The carbonate broth ships with Fe:10 already at the quencher range and Mn:8 just past the activator threshold — early calcite zones incorporate Mn but stay dim under UV. The Mn pulse at step 8 pushes Mn well past the activator threshold; the Fe drop at step 16 clears the quencher. The boundary between dim early zones and bright late zones records the moment the broth changed.

> REWORKED 2026-07-07 (tutorial-parity pass): legacy 7-beat sim-step script rebuilt in the Grand Tour's engine-v2 vocabulary — continue-step framing, a Begin ⏎ handoff with progressive unlock, and an action-step payoff: the player taps their calcite card and reads the dim-vs-bright stratigraphy off the zone modal's 'Under UV' fluorescence bar instead of being told about it. Broth + events byte-identical to the original.

> Surfaced in the New Game Menu under Tutorials. Not anchored to a real locality — it's a teaching scaffold. The Franklin/Sterling Hill (NJ) Mn-activated calcite glow is the real-world reference for the lesson.

> Broth shape mirrors FLUID_PRESETS.carbonate so the lesson generalizes to that picker entry.
