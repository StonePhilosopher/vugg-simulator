# CLAIM CARD — porphyry  (v256, seed 42, 120 steps)

**Anchor:** Bingham Canyon Cu-Mo-Au, Oquirrh Mountains, UT (late-Eocene quartz-monzonite porphyry, ~38 Ma)
**Deposit:** Copper porphyry — high-T high-pressure brine with discrete Cu and Mo pulses. Quartz + chalcopyrite + bornite + molybdenite + pyrite + tetrahedrite/tennantite paragenesis.
**Initial:** 400 °C, 2 kbar, wall=tabular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 06bb7b5e56109fea53d953ccd521b90e0b0db6be3f410d4a72e7f79f0580a48a

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (3):** chalcopyrite, pyrite, molybdenite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Landtwing et al. 2010 (Econ. Geol. 105) — Bingham fluid evolution + Au content
  - Seo et al. 2012 — Mo pulse timing in porphyry systems
  - Heinrich 2007 — porphyry fluid chemistry compendium
  - Kouzmanov & Pokrovski 2012 — As activity in epithermal Cu systems

## Paragenetic order as grown (18 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | albite | 1 | 2 | 0 | nucleation |
| 2 | argentite | 1 | 4 | 0 | nucleation |
| 3 | bismuthinite | 1 | 4 | 0 | nucleation |
| 4 | feldspar | 1 | 2 | 0 | nucleation |
| 5 | native_gold | 1 | 1 | 0 | nucleation |
| 6 | arsenopyrite | 4 | 4 | 0 | nucleation |
| 7 | titanite | 18 | 3 | 0 | nucleation |
| 8 | stibnite | 23 | 2 | 0 | nucleation |
| 9 | chalcopyrite | 25 | 1 | 0 | nucleation |
| 10 | galena | 25 | 4 | 0 | nucleation |
| 11 | pyrite | 25 | 1 | 0 | nucleation |
| 12 | tennantite | 25 | 1 | 0 | nucleation |
| 13 | tetrahedrite | 25 | 1 | 0 | nucleation |
| 14 | molybdenite | 45 | 3 | 0 | nucleation |
| 15 | magnetite | 60 | 1 | 0 | nucleation |
| 16 | epidote | 85 | 5 | 0 | nucleation |
| 17 | quartz | 92 | 1 | 0 | nucleation |
| 18 | malachite | 95 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** albite, argentite, bismuthinite, feldspar, native_gold, arsenopyrite, titanite, stibnite, galena, tennantite, tetrahedrite, magnetite, epidote, quartz, malachite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 398.26089435471107 → 311.21570973591787 °C  [235.9267717086237, 398.26089435471107] (raw_simulation_state)
  - pH: 4.6 → 6.6619797101942755   [4.6, 6.6619797101942755] (raw_simulation_state)
  - Eh: 0.2574989159953134 → 322.1090020413224 mV  [0.2574989159953134, 322.1090020413224] (raw_simulation_state)
  - salinity: 10 → 10 psu  [10, 10] (raw_simulation_state)
  - O2: 0.2 → 1.8 mg/L  [0.2, 1.8] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -7.118 → -3.15  [-7.118, -2.961]
  - SI_aragonite: -7.181 → -3.218  [-7.181, -3.026]
  - SI_dolomite: -8 → -5.367  [-8, -5.354]
  - SI_HMC: -6.929 → -2.963  [-6.929, -2.78]
  - SI_siderite: -4.409 → 0.186  [-4.409, 0.252]
  - SI_selenite: -4.031 → -0.882  [-4.031, -0.882]
  - SI_anhydrite: -3.591 → -0.567  [-3.654, -0.504]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.592 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 87.40 °C; initial a_w=0.994 ±0.020 (temperature-extrapolation)
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
  - Fluid pressure: 2 → 2 kbar [2, 2], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 398.26089435471107 → 311.21570973591787 °C [235.9267717086237, 398.26089435471107], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":3.5732160863219815,"secure_aragonite":false}, last={"boundary_kbar":2.83902142105555,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":120}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Bingham Canyon Cu-Mo-Au deposit, Oquirrh Mountains, UT. Late-Eocene (~38 Ma) quartz-monzonite-porphyry intrusion with classic potassic-core / phyllic-shell / propylitic-rim alteration zoning.

> Fluid evolution from Landtwing et al. 2010 (Econ. Geol. 105) LA-ICP-MS study: deep central brine ~7 wt% NaCl-eq with subequal Na/K/Fe/Cu, upper brine endmember ~45 wt% NaCl-eq coexisting with a low-density vapor (~0.2 g/cm³). Mo arrives in a distinct later pulse from Cu (Seo et al. 2012; encoded in event_molybdenum_pulse).

> Chemistry-audit gap-fill pass (Apr 2026): added Na, K, Cl, Mg, Ag, Te to populate the brine-element baseline that was missing. Initial Cu and Mo remain zero by design — delivered by event_copper_injection (steps 25, 60) and event_molybdenum_pulse (step 45) respectively, modeling the discrete pulse pattern documented at Bingham.

> Existing values (SiO2, Ca, CO3, Fe, Mn, Pb, Sb, As, Bi, S, F, pH, salinity, O2) were intentional and were not retuned. This is a gap-fill audit, not a rewrite.

> v184 T-rollout verdict: ambient thermal pulses KEPT, deliberately (do not re-litigate without new geology). Porphyry systems are THE textbook episodic magmatic-hydrothermal deposit class — repeated dike/fluid injections over 10⁵-10⁶ yr (Sillitoe 2010) — so the ambient fracture-valve pulses are geologically NATIVE here, modeling the smaller unscripted injections between the big scripted Cu/Mo events. Measured anyway (tools/t-story-observe.mjs, 3 seeds): removal would be harmless to expects (all three intact) and lets late supergene Mo/Cu phases through as the system cools lower — but those belong to a future supergene-blanket arc, not to deleting the deposit class's defining behavior.
