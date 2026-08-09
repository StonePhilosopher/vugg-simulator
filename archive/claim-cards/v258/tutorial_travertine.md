# CLAIM CARD — tutorial_travertine  (v258, seed 42, 60 steps)

**Anchor:** Mammoth Hot Springs (Yellowstone) — travertine is the canonical CO₂-degas calcite
**Deposit:** Tutorial 3: How CO₂ Builds a Calcite Crust. CO₂-rich groundwater rises into a hot-spring pool, loses CO₂ as gas, and every pH step multiplies calcite's supersaturation until crust plates every available surface. The same mechanism that grows speleothems in caves and travertine terraces at hot springs.
**Initial:** 70 °C, 0.00101325 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** fb5a87f3736a228ed49a107fc094b169d9050adb762f16e64caefcd6b7179ed3

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
  - Mammoth Hot Springs, Yellowstone NP — type locality for actively-forming travertine
  - Pentecost A. (2005), Travertine — comprehensive review of CO₂-degas calcite
  - Stumm & Morgan, Aquatic Chemistry (3rd ed.), Bjerrum partition + Henry's-Law CO₂

## Paragenetic order as grown (2 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | aragonite | 10 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** aragonite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 68.26089435471219 → 38.80504261804729 °C  [38.80504261804729, 68.69096292895321] (raw_simulation_state)
  - pH: 6.5 → 8.216821368139342   [6.5, 8.249717547339703] (raw_simulation_state)
  - Eh: -200 → -200 mV  [-200, -200] (raw_simulation_state)
  - salinity: 2 → 2 psu  [2, 2] (raw_simulation_state)
  - O2: 0 → 0 mg/L  [0, 0] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.189 → 1.575  [0.063, 1.953]
  - SI_aragonite: 0.063 → 1.386  [0, 1.827]
  - SI_dolomite: -0.441 → 2.394  [-0.567, 3.087]
  - SI_HMC: 0.063 → 1.449  [0, 1.827]
  - SI_siderite: 0.693 → 2.016  [0.63, 2.457]
  - SI_selenite: -1.575 → -1.512  [-1.575, -1.512]
  - SI_anhydrite: -1.638 → -1.701  [-1.701, -1.575]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.00101325 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.705 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.01 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.000012869277444444467; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.000012327113944444465; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.000024750119611111155; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.000012464584166666687; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.000011707714722222244; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.000010233522666666685; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.00001006802722222224; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.000010221220777777795; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.000 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.00101325 → 0.00101325 kbar [0.00101325, 0.00101325], n=60
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=60
  - Temperature: 68.26089435471219 → 38.80504261804729 °C [38.80504261804729, 68.69096292895321], n=60
  - Secure aragonite assessment: 0/60 executed steps; first={"boundary_kbar":2.713987519743353,"secure_aragonite":false}, last={"boundary_kbar":2.891406521773767,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":60}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: 60 samples; mode closed→closed; DIC 0.00833194467588735→0.005077263067508055 mol/kg; export 0.011282976926666015 mol/kg; reduced alkalinity 0.0050719044424696255 eq/kg; blocked=false; failed latest transactions=0; uncertainties=["full_alkalinity_systems_omitted"]

## Scenario notes (author's own rationale)
> Tutorial scenario for the conserved carbonate boundary. Three downstream vent stages (steps 10, 25, 40) lower the authored pCO₂ boundary while DIC, reduced carbonate alkalinity, and a 1 L/kg pedagogical headspace remain separate inventories. pH is solved from the carbonate system; no pulse adds Ca and no fixed pH shift is authored.

> Scope: this is a reduced pedagogical analogue of the Mammoth Hot Springs degassing pathway, not a sample-for-sample reconstruction. USGS Bulletin 1444's outlet-water analysis (69 °C, pH 7.2, Ca 323, Mg 67, HCO3 755, SO4 563 mg/L) is compared field by field in research/arcs/mammoth-travertine-benchmark-receipt-2026-08-08.md; the deliberately authored differences and omitted sulfate alkalinity are visible there.

> REWORKED 2026-07-07 (tutorial-parity pass): legacy 8-beat sim-step script rebuilt in the Grand Tour's engine-v2 vocabulary — continue-step framing on the σ forecast, Begin ⏎ handoff, sim-step beats riding the pulses, then the INVERSE EXPERIMENT: the 🧪 acid verbs unlock and the player runs the cascade backwards, watching σ(calcite) fall (the cave-dissolution lesson for free). Broth + events byte-identical. TEXT RE-TRUED against the observed run: the old script's claims ('Ca 200 ppm', 'calcite isn't growing yet', 'crossed the line at step 20') predate the Ca 200→350 recalibration — measured seed run shows σ(calcite) 1.61 at t0 (one crystal creeping from step ~2) and pulse 1 multiplying σ 1.34→5.04, so the lesson is narrated as barely-viable-trickle → multiplication, which is also the truer Mammoth story (vent water arrives near saturation; degassing drives the plating downstream).

> Initial fluid uses CO3 = 500 mg/kg as the simulator's CO3-equivalent DIC surrogate, exactly 8.332 mmol C/kg, at pH 6.5. Ca = 350 mg/kg represents the measured high-Ca Mammoth water family. The source pool is marginally supersaturated; progressive open-boundary loss, not an invented reagent addition, drives downstream coating.

> The three `co2_degas_with_reheat` events vent toward 0.08, 0.02, then 0.004 bar pCO2. Each event reports its computed mmol C/kg export, resulting DIC, and solved pH. Reduced carbonate alkalinity is conserved during gas exchange. The 1 L/kg headspace is an authored pedagogical control volume, not a claim about a measured Mammoth bubble volume.

> Geological reference: Mammoth Hot Springs (Yellowstone, USA), Pamukkale (Turkey), Pancake Hot Springs (CA). All build travertine via this exact cascade. Cave flowstone uses the same chemistry but with cooler fluid and lower flow.
