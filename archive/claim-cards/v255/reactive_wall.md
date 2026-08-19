# CLAIM CARD — reactive_wall  (v255, seed 42, 120 steps)

**Anchor:** Sweetwater Mine (Reynolds County, MO), Viburnum Trend Pb-Zn district. Host: Upper Cambrian Bonneterre Dolomite/dolostone.
**Deposit:** Acid-into-carbonate paragenesis — repeated acid pulses dissolve the Bonneterre dolostone wall, then pH recovery drives supersaturation and growth bursts. Sphalerite-galena-marcasite with dolomite-calcite gangue; Ba and Sr remain dissolved brine tracers at this mine.
**Initial:** 140 °C, 0.2 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 99dbfb7bfd21d0c653a8a032135716d6628c1207aaf2945d8adeabdc0257ca7b

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (6):** sphalerite, pyrite, dolomite, calcite, galena, marcasite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (6):** acanthite — Sweetwater records Ag chiefly as trace lattice substitution in galena; no discrete Ag2S phase is documented in the mine species record.; barite — The high-Ba value is a fluid-inclusion brine tracer, not evidence for precipitated barite at Sweetwater.; celestine — Dissolved Sr is a basinal-brine tracer; discrete celestine is absent from the Sweetwater mine record.; selenite — Gypsum/selenite is absent from the Sweetwater mine record.; rhodochrosite — The Sweetwater mine record does not document a discrete Mn-carbonate phase.; siderite — The Sweetwater mine record does not document a discrete Fe-carbonate phase.

**Cited sources:**
  - Sverjensky 1981 (Econ. Geol. 76) — Viburnum Trend brine geochemistry
  - Stoffell et al. 2008 — LA-ICP-MS fluid-inclusion brine analyses (Tri-State vs Viburnum distinction)
  - Leach et al. 2010 — MVT genesis review
  - Anderson & Macqueen 1982 — MVT mineralogy review
  - Hanor 1994 — basinal-brine compendium (Sr/Ba tracers)
  - Rowan & Leach 1989, Economic Geology 84:1948-1963 — 105-125 C saline inclusions in Bonneterre hydrothermal dolomite; regional advective heat transport and cooling rejected as the primary sulfide driver

## Paragenetic order as grown (6 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | sphalerite | 15 | 1 | 0 | nucleation |
| 3 | galena | 40 | 1 | 0 | nucleation |
| 4 | marcasite | 40 | 1 | 0 | nucleation |
| 5 | pyrite | 41 | 1 | 0 | nucleation |
| 6 | dolomite | 90 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 139.8840596236475 → 84.76076934103855 °C  [84.76076934103855, 139.8840596236475] (raw_simulation_state)
  - pH: 7 → 7.024038533000001   [4.2, 7.024038533000001] (raw_simulation_state)
  - Eh: -150.10299956639813 → -150.10299956639813 mV  [-150.10299956639813, -150.10299956639813] (raw_simulation_state)
  - salinity: 18 → 18 psu  [18, 18] (raw_simulation_state)
  - O2: 0.05 → 0.05 mg/L  [0.05, 0.05] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.315 → 0.693  [-4.535, 0.945]
  - SI_aragonite: 0.189 → 0.567  [-4.661, 0.819]
  - SI_dolomite: 0.252 → 1.071  [-8, 1.134]
  - SI_HMC: 0.315 → 0.819  [-4.535, 0.882]
  - SI_siderite: 1.197 → 2.205  [-2.898, 2.331]
  - SI_selenite: -1.701 → -1.071  [-1.701, -1.071]
  - SI_anhydrite: -1.701 → -1.197  [-1.701, -1.197]
  - SI_barite: 0.756 → 1.764  [0.756, 1.764]
  - SI_celestine: -1.26 → -0.819  [-1.26, -0.756]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.456 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 60.94 °C; initial a_w=0.990 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.3687937775; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.369 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.18671954999999998; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.187 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.176938479; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.177 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.15063440150000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.151 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.14405516200000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.144 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.1494945895; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.149 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.2 → 0.2 kbar [0.2, 0.2], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 139.8840596236475 → 84.76076934103855 °C [84.76076934103855, 139.8840596236475], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":2.4563359957489337,"secure_aragonite":false}, last={"boundary_kbar":2.632803513669158,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":120}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Sweetwater Mine, Viburnum Trend MVT district (high-Ba endmember vs Tri-State, distinguished by Stoffell et al. 2008 LA-ICP-MS).

> Mechanic: acid entering a carbonate vug doesn't just dissolve crystals — it dissolves the WALL. Bonneterre dolostone neutralizes the acid and releases formula-balanced Ca2+, Mg2+, and two carbonate units back into solution. When pH recovers, that inventory crosses the dolomite saturation barrier and precipitates as a hydrothermal saddle-dolomite lining. The acid is both destroyer and creator; the vug enlarges as the replacement front advances.

> Repeated acid pulses (steps 15/40/70) model the Viburnum dissolution → supersaturation → growth burst cycle. Final fracture seal at step 90 closes the system.

> SIM 247 locality reconciliation: Sweetwater's valid-species record licenses calcite, dolomite, galena, marcasite, pyrite and sphalerite but not acanthite, barite, celestine, selenite, rhodochrosite or siderite. Ba and Sr stay in solution as fluid-inclusion/basinal-brine tracers; Ag is reduced to a lattice-trace inventory and the reducing MVT baseline is restored to O2=0.05. The explicit exclusions are mine-specific negative evidence, not global engine bans.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Sweetwater Mine, Ellington, Reynolds Co., MO; 23 valid + 1 erroneous): Anilite, Bornite, Calcite, Carrollite, Chalcocite, Chalcopyrite (var. Blistered Copper), Covellite, Dickite, Digenite, Djurleite, Dolomite, Erythrite, Fletcherite, Galena, Malachite, Marcasite, Millerite, 'Petroleum' (var. Bitumen), Polydymite, Pyrite, Quartz, Siegenite, Sphalerite, Vaesite. LINNAEITE struck through as an ERRONEOUS literature entry — mindat's own flag; never cite it as license. Page text worth keeping: Viburnum differs from other MVT in being shallower, carrying Ni-Co minerals + some Cu-Fe sulfides, with REPETITIVE PRECIPITATION-DISSOLUTION of the sulfides (base metals transported WITH reduced S in the same solutions — cf. the fluid.S split's own two-pool story) — the scenario's acid-pulse mechanic models exactly this. WHAT THE LIST VOTES ON (vs seed-42 v236): (a) THE HEADLINE GAP — the entire Viburnum Ni-Co-Cu sulfide suite is documented here and the sim grows NONE of it: carrollite, fletcherite, millerite, polydymite, siegenite, vaesite (+ the Cu ladder anilite/bornite/chalcocite/covellite/digenite/djurleite + erythrite as the Co bloom). Siegenite is ALREADY on the missing-engines want list — this is its reference locality; a Ni-Co arc would make this scenario the Viburnum showcase its anchor promises. (b) Census flags (sim grows, list lacks): ACANTHITE ×4 @1.8mm — NO discrete Ag species at Sweetwater; the Apr-2026 note's Leach byproduct-Ag credit defends broth Ag / Ag-IN-galena, NOT discrete acanthite crystals (v195-silver family? BOSS ADJUDICATION); BARITE ×6 — unlisted despite the 'high-Ba endmember' anchor (Stoffell's high-Ba is the FLUID-INCLUSION brine, not precipitated barite at this mine; expects_species includes barite — adjudicate before any kill); CELESTINE ×9 (S2-flipped; unlisted — Ba-blanket record-licensed only at elmwood so far); SELENITE ×2 (unlisted — selenite census now reads elmwood NO / picher YES / sweetwater NO); RHODOCHROSITE + SIDERITE (unlisted — the Fe/Mn-carbonate over-fire flag is now 3-for-3 across the MVT family). (c) Licensed ✓: calcite, dolomite, galena, marcasite, pyrite, quartz, sphalerite; dickite + malachite + bitumen = candidates.
