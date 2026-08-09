# CLAIM CARD — colorado_plateau  (v255, seed 42, 180 steps)

**Anchor:** Uravan Mineral Belt, Colorado Plateau — sandstone-hosted roll-front uranium-vanadium deposits (Triassic-Jurassic Morrison Formation). Includes the Carnotite-Eldorado, Uravan, and Moab districts; the V+U bonanza that drove the early-twentieth-century uranium industry decades before the Manhattan Project.
**Deposit:** Uravan Mineral Belt sandstone roll-front uranium-vanadium deposit (Roc Creek, Montrose County, CO — carnotite type locality, Friedel & Cumenge 1899). Oxidizing groundwater carries U + V + K + Ca through Triassic-Jurassic Morrison Formation sandstones until it meets a reducing barrier (petrified wood, carbonaceous shale), where the metals drop out as bright canary-yellow uranyl-vanadate crusts. Carnotite + tyuyamunite are the two diagnostic species — interconvertible by cation exchange, drawn apart by whichever of K/Ca dominates the local pore fluid.
**Initial:** 22 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** e4a2d307e08a3cbe350d14be77a7dca977d822ec665e78a9c619b41e6472169d

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** carnotite, tyuyamunite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Friedel & Cumenge 1899 — original carnotite description (Roc Creek)
  - Nenadkevich 1912 — tyuyamunite type description (Tyuya-Muyun)
  - Hess 1924 — V-U-Ca-K paragenesis review
  - Stern et al. 1956 — meta-tyuyamunite (American Mineralogist v.41)
  - research/minerals/research-tyuyamunite.md (May 2026) — Colorado Plateau roll-front geology + simulator design

## Paragenetic order as grown (4 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | opal | 1 | 5 | 0 | nucleation |
| 2 | tyuyamunite | 1 | 5 | 0 | nucleation |
| 3 | uranophane | 1 | 3 | 0 | nucleation |
| 4 | carnotite | 104 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** opal, uranophane
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 25 → 25 °C  [25, 25] (raw_simulation_state)
  - pH: 7 → 7   [7, 7] (raw_simulation_state)
  - Eh: 251.67249841904993 → 220 mV  [220, 290.4365036222725] (raw_simulation_state)
  - salinity: 8 → 8 psu  [8, 8] (raw_simulation_state)
  - O2: 1.2 → 1 mg/L  [1, 1.5] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -0.945 → -1.008  [-1.449, -0.945]
  - SI_aragonite: -1.134 → -1.134  [-1.575, -1.134]
  - SI_dolomite: -2.394 → -2.457  [-2.835, -2.394]
  - SI_HMC: -1.008 → -1.071  [-1.449, -1.008]
  - SI_siderite: 0.189 → 0.378  [0.189, 0.441]
  - SI_selenite: -2.394 → -2.399  [-2.898, -2.394]
  - SI_anhydrite: -2.646 → -2.709  [-3.15, -2.646]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.011 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.995 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.053052338000000004; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.053 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.050672056; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.051 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.10089529200000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.101 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.050051432; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.050 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.047091532; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.047 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.044851961999999995; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.045 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.045518697999999996; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.046 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.044442487999999995; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.044 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 25 → 25 °C [25, 25], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":180}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Colorado Plateau uranium districts (Uravan Mineral Belt). Mineralogy first described by Friedel & Cumenge (1899) at Roc Creek (Montrose County, CO); Hess (1924) characterized the V-U-Ca-K paragenesis. The Vanadium Corporation of America (VCA) operated the Uravan mill from 1915-1944 turning carnotite into V₂O₅ (steel alloy) before the Manhattan Project shifted demand to uranium.

> Mechanic: 5-event sandstone roll-front lifecycle. Initial: oxidizing surface groundwater carries U+V+K+Ca at ambient T. Step 20 (groundwater pulse): more U + V flushes through the system, Ca dominates K initially → tyuyamunite plates. Step 60 (roll-front contact): Fe rises (organic-iron proxy for petrified wood / carbonaceous shale), T drops, slight reducing pulse — concentrates carnotite + tyuyamunite at the redox front. Step 100 (cation oscillation): K rises (evaporite-style salt concentration in the arid surface zone), K/(K+Ca) crosses 0.5 → carnotite plates. Step 140 (Ca recovery): Ca returns dominant → second tyuyamunite phase. Step 165 (arid stabilization): system stabilizes, both species coexist.

> First scenario to fire carnotite + tyuyamunite, completing the autunite-group cation+anion fork coverage when paired with Schneeberg (which fires the Cu/Ca pair on the P+As branches).
