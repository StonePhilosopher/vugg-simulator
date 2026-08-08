# CLAIM CARD — tutorial_travertine  (v252, seed 42, 60 steps)

**Anchor:** Mammoth Hot Springs (Yellowstone) — travertine is the canonical CO₂-degas calcite
**Deposit:** Tutorial 3: How CO₂ Builds a Calcite Crust. CO₂-rich groundwater rises into a hot-spring pool, loses CO₂ as gas, and every pH step multiplies calcite's supersaturation until crust plates every available surface. The same mechanism that grows speleothems in caves and travertine terraces at hot springs.
**Initial:** 70 °C, 0.00101325 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 6c3b3d0f3275c5c11510f7efa4c002d53810ee31a4474103f907a3c0f5ba7ac7

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
| 2 | aragonite | 25 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** aragonite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 67.913 → 38.386 °C  [38.386, 67.913]
  - pH: 6.504 → 8.213   [6.504, 8.268]
  - Eh: -201.575 → -201.575 mV  [-201.575, -201.575]
  - salinity: 2.362 → 2.362 psu  [2.362, 2.362]
  - O2: 0 → 0 mg/L  [0, 0]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.189 → 1.575  [0.063, 1.953]
  - SI_aragonite: 0.063 → 1.386  [0, 1.827]
  - SI_dolomite: -0.441 → 2.394  [-0.567, 3.087]
  - SI_HMC: -1.26 → 0.378  [-1.26, 0.504]
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
  - Temperature: 68.26089435471222 → 38.805042618047445 °C [38.805042618047445, 68.69096292895264], n=60
  - Secure aragonite assessment: 0/60 executed steps; first={"boundary_kbar":2.713987519743353,"secure_aragonite":false}, last={"boundary_kbar":2.8914065217737654,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":60}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: 60 samples; mode closed→closed; DIC 0.00833194467588735→0.005077303295801526 mol/kg; export 0.01128295753964744 mol/kg; reduced alkalinity 0.005071945725527851 eq/kg; blocked=false; failed latest transactions=0; uncertainties=["full_alkalinity_systems_omitted"]

## Scenario notes (author's own rationale)
> Tutorial scenario for the conserved carbonate boundary. Three downstream vent stages (steps 10, 25, 40) lower the authored pCO₂ boundary while DIC, reduced carbonate alkalinity, and a 1 L/kg pedagogical headspace remain separate inventories. pH is solved from the carbonate system; no pulse adds Ca and no fixed pH shift is authored.

> Scope: this is a reduced pedagogical analogue of the Mammoth Hot Springs degassing pathway, not a sample-for-sample reconstruction. USGS Bulletin 1444's outlet-water analysis (69 °C, pH 7.2, Ca 323, Mg 67, HCO3 755, SO4 563 mg/L) is compared field by field in research/arcs/mammoth-travertine-benchmark-receipt-2026-08-08.md; the deliberately authored differences and omitted sulfate alkalinity are visible there.

> REWORKED 2026-07-07 (tutorial-parity pass): legacy 8-beat sim-step script rebuilt in the Grand Tour's engine-v2 vocabulary — continue-step framing on the σ forecast, Begin ⏎ handoff, sim-step beats riding the pulses, then the INVERSE EXPERIMENT: the 🧪 acid verbs unlock and the player runs the cascade backwards, watching σ(calcite) fall (the cave-dissolution lesson for free). Broth + events byte-identical. TEXT RE-TRUED against the observed run: the old script's claims ('Ca 200 ppm', 'calcite isn't growing yet', 'crossed the line at step 20') predate the Ca 200→350 recalibration — measured seed run shows σ(calcite) 1.61 at t0 (one crystal creeping from step ~2) and pulse 1 multiplying σ 1.34→5.04, so the lesson is narrated as barely-viable-trickle → multiplication, which is also the truer Mammoth story (vent water arrives near saturation; degassing drives the plating downstream).

> Initial fluid uses CO3 = 500 mg/kg as the simulator's CO3-equivalent DIC surrogate, exactly 8.332 mmol C/kg, at pH 6.5. Ca = 350 mg/kg represents the measured high-Ca Mammoth water family. The source pool is marginally supersaturated; progressive open-boundary loss, not an invented reagent addition, drives downstream coating.

> The three `co2_degas_with_reheat` events vent toward 0.08, 0.02, then 0.004 bar pCO2. Each event reports its computed mmol C/kg export, resulting DIC, and solved pH. Reduced carbonate alkalinity is conserved during gas exchange. The 1 L/kg headspace is an authored pedagogical control volume, not a claim about a measured Mammoth bubble volume.

> Geological reference: Mammoth Hot Springs (Yellowstone, USA), Pamukkale (Turkey), Pancake Hot Springs (CA). All build travertine via this exact cascade. Cave flowstone uses the same chemistry but with cooler fluid and lower flow.
