# CLAIM CARD — great_salt_plains  (v256, seed 42, 250 steps)

**Anchor:** Salt Plains National Wildlife Refuge, Alfalfa County, Oklahoma — a 65-km² salt flat on the Permian red beds (Flowerpot Shale / Cedar Hills Sandstone). The ONLY place on Earth selenite grows the iron-stained 'hourglass' habit. The hourglass selenite is the Oklahoma state crystal; the refuge is the public crystal-digging locality.
**Deposit:** Gypsum-saturated, salt-saturated groundwater wicks up through red-bed sand and evaporates just under a thin salt crust. Wet/dry seasonal cycling grows selenite in fast bursts that trap clay, sand, and Permian iron oxide on the terminal growth sectors — the visible hourglass — and step the blade outward each dry season. The iron-flooded crystals go solid reddish-to-chocolate brown.
**Initial:** 28 °C, 0.05 kbar, wall=basin
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** fc968fd2d0763db80d518bd7f8a1eaaa00297a97c9bb1cf8992e2983293ca210

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (3):** selenite, halite, celestine
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - U.S. Fish & Wildlife Service — Salt Plains National Wildlife Refuge, selenite crystal digging (formation mechanism: gypsum-saturated groundwater evaporating under a salt crust; clay/sand/iron-oxide inclusions form the hourglass)
  - Oklahoma Geological Survey / Oklahoma Historical Society — Great Salt Plains; hourglass selenite as the Oklahoma state crystal
  - Ham W.E. (1961) Oklahoma Geological Survey — geology of the Salt Plains / Permian red-bed evaporites of northwestern Oklahoma
  - Johnson K.S. (2019) Oklahoma Geological Survey Open-File Report 3-2019 — Geologic studies, natural-brine emissions, and hourglass-selenite crystals at Great Salt Plains; reproduces Johnson (1972) brine analyses

## Paragenetic order as grown (6 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 28 | 0 | nucleation |
| 2 | selenite | 1 | 2 | 0 | nucleation |
| 3 | celestine | 5 | 6 | 0 | nucleation |
| 4 | mirabilite | 48 | 8 | 0 | nucleation |
| 5 | halite | 54 | 19 | 0 | nucleation |
| 6 | thenardite | 146 | 2 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** calcite, mirabilite, thenardite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 26.26089435471203 → 25 °C  [22, 31.555848554475073] (raw_simulation_state)
  - pH: 7.6 → 7.6   [7.6, 7.6] (raw_simulation_state)
  - Eh: 301.64799306236995 → 322.1090020413224 mV  [290.4365036222725, 322.1090020413224] (raw_simulation_state)
  - salinity: 200 → 200 psu  [35, 200] (raw_simulation_state)
  - O2: 1.6 → 1.8 mg/L  [1.5, 1.8] (raw_simulation_state)
  - concentration: 1 → 3 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.693 → 0.63  [-1.071, 0.819]
  - SI_aragonite: 0.504 → 0.504  [-1.197, 0.693]
  - SI_dolomite: 1.512 → 1.449  [-2.205, 1.764]
  - SI_HMC: 0.693 → 0.63  [-1.071, 0.819]
  - SI_siderite: 0.693 → 0.63  [-1.134, 0.756]
  - SI_selenite: 1.701 → 2.079  [-0.567, 2.079]
  - SI_anhydrite: 1.575 → 1.953  [-0.819, 1.953]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: 0.945 → 1.323  [-0.882, 1.323]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.967 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.839 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.0519466768; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.052 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.0496191076; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.050 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.0989443644; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.099 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.0492207064; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.049 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.0462716216; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.046 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.043333545599999995; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.043 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.0437489184; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.044 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.0430109948; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.043 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=250
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=250
  - Temperature: 26.26089435471203 → 25 °C [22, 31.555848554475073], n=250
  - Secure aragonite assessment: 0/250 executed steps; first={"boundary_kbar":2.979607156724255,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":250}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> QUARTZ + ANHYDRITE WITHDRAWN from expects_species (v228, hostile-review rung 2). Quartz: the Salt Plains quartz is DETRITAL — wind/water-blown sand mechanically trapped in the growing selenite (it IS the hourglass inclusion source, which the render already models via the growth-zone sediment record); the broth's SiO2:30 was always a silt proxy, and the sim's chemistry engines were precipitating authigenic quartz from it at 23-27°C, which real kinetics forbid (v228 enforces quartz's T_min 50). Anhydrite: the near-surface crust precipitates halite + selenite ONLY; anhydrite belongs to the deep Permian source beds the brine dissolves, and direct anhydrite nucleation below ~100°C is kinetically impossible (Ossorio 2014, Voigt & Freyer 2023) — the pre-v228 events fired through a saline-low-T branch that modeled REPLACEMENT-after-gypsum as direct nucleation. Both promises were mechanism confabulations, not missing minerals. Celestine kept (documented in the OK evaporite suite) but flagged unverified as a SURFACE precipitate at this locality by the rung-2 pass.

> USFWS Salt Plains NWR + Oklahoma Geological Survey: selenite forms just under a wafer-thin salt crust where gypsum-saturated saline groundwater reaches the surface and evaporates. Fine sand + clay are mechanically included on the fast-growing sectors, producing the hourglass shape; iron oxide in the red-bed soil gives the reddish-to-chocolate-brown colour. This hourglass habit is found NOWHERE else in the world.

> Showcase for the crystal-face-realism arc's hourglass-selenite render (2026-06-22): low-T (<45°C) sediment-laden fast growth → js/45 _seleniteHourglassParams tags the blade gypsum_hourglass; the repeated wet/dry fast-growth pulses drive the stepped-growth ziggurat (steps≥2); accumulated trace_Fe deepens the amber → chocolate brown and floods the heavily-included blades to solid brown. The render machinery already shipped SIM-neutral; this scenario is where it is the centerpiece.

> Measured source brine (Johnson 1972; OGS OFR 3-2019): Ca about 1,500 ppm, Mg about 1,000 ppm, sulfate about 7,000 ppm (= about 2,337 ppm as sulfur), chloride 90,000-150,000 ppm, and NaCl 150,000-250,000 ppm. At those concentrations the brine is saturated with both halite and gypsum. The model stores sulfate as sulfur mass, so initial S=2300 ppm. DRY events retain the measured brine range and concentrate it slightly; WET events represent rain mixing and move authoritative gypsum SI just below zero so growth pauses between bursts.

> Halite is a co-product (the literal salt crust of the Salt Plains); minor goethite/iron-oxide staining is geologically the same iron that colours the hourglass. The star is selenite.
