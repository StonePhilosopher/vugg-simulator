# CLAIM CARD — stalactite_demo  (v253, seed 42, 100 steps)

**Anchor:** Generic limestone-cave dripstone — Carlsbad Caverns / Lechuguilla / Mammoth Cave family. Cave-air-filled cavity (vadose throughout), calcite precipitating from CO₂-degassed drip water on ceiling, floor, and walls in three different morphologies.
**Deposit:** PROPOSAL-HABIT-BIAS Slice 5 — proof-by-screenshot that the gravity-aware c-axis works. Cave-style cavity: every crystal nucleates in air-mode (wall.air_mode_default), so ceiling calcite renders as stalactite (c-axis world-down) and floor calcite as stalagmite (c-axis world-up). Multiple speleothems grow concurrently (cave-mode nucleation probability fires every step σ > threshold). Per-vertex sampling + zone chemistry route each nucleation to the calcite-favoring floor/ceiling cells.
**Initial:** 15 °C, 0.01 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 8194b4d9167ddcdad00e87386ec86796793df8cba4d313c8ed97c626480f0a56

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
  - Pentecost A. (2005), Travertine — comprehensive review of CO₂-degas calcite (cave + spring)
  - Hill & Forti (1997), Cave Minerals of the World, 2nd ed. — speleothem morphology reference
  - Ford & Williams (2007), Karst Hydrogeology and Geomorphology — cave drip-water chemistry

## Paragenetic order as grown (1 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 11 | 2 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 23.622]
  - pH: 8.323 → 8.323   [8.323, 8.323]
  - Eh: 497.638 → 497.638 mV  [497.638, 497.638]
  - salinity: 0.787 → 0.787 psu  [0.787, 0.787]
  - O2: 5 → 5 mg/L  [5, 5]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 1.89 → 1.89  [1.89, 1.89]
  - SI_aragonite: 1.764 → 1.764  [1.764, 1.764]
  - SI_dolomite: 2.709 → 2.709  [2.709, 2.709]
  - SI_HMC: 0.819 → 0.819  [0.819, 0.819]
  - SI_siderite: 1.386 → 1.386  [1.386, 1.386]
  - SI_selenite: -1.827 → -1.827  [-1.827, -1.827]
  - SI_anhydrite: -2.079 → -2.079  [-2.079, -2.079]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.01 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.065 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.15 °C; initial a_w=1.000 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.010090406666666668; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.010 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.00964121; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.010 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.019160326666666668; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.019 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.00947094; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.00892382; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.008705006666666668; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.008899973333333333; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.008608913333333332; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.01 → 0.01 kbar [0.01, 0.01], n=100
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=100
  - Temperature: 25 → 25 °C [25, 25], n=100
  - Secure aragonite assessment: 0/100 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":100}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Habit-bias proof scenario. The whole point: walk into the cave, look up at the ceiling, see crystals HANGING (stalactites); look down at the floor, see crystals STANDING (stalagmites). All are the same calcite mineral and the same precipitation chemistry — only the ANCHOR ORIENTATION differs, and that drives the rendered c-axis via PROPOSAL-HABIT-BIAS Slice 1.

> Chemistry is generic dripstone: Ca²⁺ + HCO₃⁻ from limestone dissolution upstream, CO₂ degasses in the cave air, pH rises, CO₃²⁻ fraction climbs, calcite saturates and precipitates. The simulator's calcite engine handles this cascade.

> Zone chemistry (PROPOSAL-CAVITY-MESH Phase 3): ceiling + floor are Ca-rich (drip-source ceiling, drop-collector floor), wall is calcite-cuspy. With inter_ring_diffusion_rate=0 the gradient persists across the 100-step run; without that, Laplacian diffusion would average the zones over ~20 steps and the differentiation would wash out.

> Per-vertex nucleation (PROPOSAL-CAVITY-MESH Tranche 6, 2026-05): the calcite engine still gates on the equator's σ, but cell assignment uses the joint σ-weighted sample so each calcite anchors at a cell where its local σ is highest. With the sharp wall-cuspy zoning, this routes every nucleation to the floor or ceiling — no wall calcite. Without this flag, area-weighted random placement would put most calcites on wall cells (wall has ~2× more cells than floor or ceiling combined) and the speleothem morphologies would be invisible.

> Air-mode nucleation probability (2026-05): cave-mode scenarios use a Bernoulli per-step roll (_AIR_MODE_NUCLEATION_PROB = 0.06) instead of the strict serial !existing_calcite gate. Real caves grow multiple stalactites + stalagmites concurrently; the serial gate produced exactly 1 calcite per run and was the reason this scenario shipped with only 1 visible speleothem at v69. Calibrated to give ~4-7 nucleations over 100 steps, bounded by max_nucleation_count.

> Temperature: 15°C — generic cave. Pressure: 0.01 kbar (atmospheric — cave air above the water table). Wall: pocket archetype at 60 mm diameter.
