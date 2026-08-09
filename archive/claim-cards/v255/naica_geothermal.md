# CLAIM CARD — naica_geothermal  (v255, seed 42, 320 steps)

**Anchor:** Naica, Chihuahua, Mexico — Cueva de los Cristales, 290 m below surface. Lead-Zinc-Silver mine (Industrias Peñoles); the giant selenite cave was breached in April 2000 when a mine drift broke through into the chamber. Selenite blades up to 12 m × 1 m × 55 tonnes.
**Deposit:** Slow geothermal pool that grew the largest crystals on Earth. Anhydrite-saturated water cools by hundredths of a degree per year through the gypsum-anhydrite boundary at ~58°C and holds just below it (~54-57°C), where gypsum reprecipitates from anhydrite dissolving at depth. Stable for ~500,000 years (Garcia-Ruiz et al. 2007). Mining begun 1985 dewatered the cave; pumping stopped 2017 and the cave reflooded.
**Initial:** 56 °C, 0.08 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 0b14ccebf230fbfd26ddcfd880ad714d08956ebccf3967b41e3229d08ca6abd5

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (1):** selenite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Garcia-Ruiz, Villasuso, Ayora, Canals, Otálora 2007 (Geology 35:327) — Formation of natural gypsum megacrystals in Naica, Mexico
  - Otálora & Garcia-Ruiz 2014 (Chem. Soc. Rev. 43:2013) — Nucleation and growth of the Naica giant gypsum crystals
  - Forti & Sanna 2010 (NSS Bull.) — The Naica caves and their crystals: a unique speleological problem
  - Van Driessche, Garcia-Ruiz, Tsukamoto, Patiño-Lopez, Satoh 2011 (PNAS 108:15721) — Ultraslow growth rates of giant gypsum crystals (the measured stability the v182 thermal movement models: no-noise pool at marginal saturation)

## Paragenetic order as grown (4 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | selenite | 1 | 1 | 0 | nucleation |
| 2 | celestine | 5 | 6 | 0 | nucleation |
| 3 | chalcedony | 260 | 1 | 0 | nucleation |
| 4 | thenardite | 265 | 3 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** celestine, chalcedony, thenardite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 55.99986720527993 → 26.934425352476534 °C  [26.934425352476534, 55.99986720527993] (raw_simulation_state)
  - pH: 7.2 → 7.2   [7.2, 7.2] (raw_simulation_state)
  - Eh: 290.4365036222725 → 322.1090020413224 mV  [290.4365036222725, 322.1090020413224] (raw_simulation_state)
  - salinity: 4 → 4 psu  [4, 4] (raw_simulation_state)
  - O2: 1.5 → 1.8 mg/L  [1.5, 1.8] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 3] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -0.567 → -0.945  [-0.945, -0.567]
  - SI_aragonite: -0.693 → -1.071  [-1.071, -0.693]
  - SI_dolomite: -2.079 → -2.772  [-2.772, -2.079]
  - SI_HMC: -0.63 → -1.008  [-1.008, -0.63]
  - SI_siderite: -0.504 → -0.945  [-0.945, -0.504]
  - SI_selenite: 0.063 → -0.063  [-0.315, 0.063]
  - SI_anhydrite: -0.126 → -0.315  [-0.567, -0.126]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -0.189 → -0.381  [-0.651, -0.189]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.08 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.783 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 59.18 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.07765726864; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.078 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.07426468384; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.074 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.148797774; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.149 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.07466584344; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.075 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.07009980119999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.070 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.0622666072; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.062 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.06164185815999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.062 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.062059444400000004; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.062 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.08 → 0.08 kbar [0.08, 0.08], n=320
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=320
  - Temperature: 55.99986720527993 → 26.934425352476534 °C [26.934425352476534, 55.99986720527993], n=320
  - Secure aragonite assessment: 0/320 executed steps; first={"boundary_kbar":2.782778524126686,"secure_aragonite":false}, last={"boundary_kbar":2.9746795282888745,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":320}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Garcia-Ruiz et al. 2007 (Geology 35:327) — the canonical paper on Naica's growth mechanism. Anhydrite at depth (T > 58°C) dissolves slightly; rising water cools to ~54°C; gypsum reprecipitates. The cooling rate is critical: at hundredths of a degree per year, the brine stays close enough to the boundary that crystals grow over geological timescales without significant nucleation of new seeds. Old crystals just keep adding layers.

> v182 THERMAL STORY (the first consumer of the v181 T-unlock): the buffered pool is now a DECLARED temperature movement — base 56°C, smoothstep trend −3 over steps 0-260, no OU texture (Naica's signature is thermal stability; fluid-inclusion work shows a remarkably steady bath, so the no-noise choice IS the science, not a simplification). Ambient drift + pulses stand down for the window (pre-v182 they were bulldozing the design: drift crashed 56→25°C in ~21 steps and ~19 random thermal pulses bounced T between the floor and 53°C — the 55-58°C selenite sweet-spot fired ~2 steps per run and the 54-57 Garcia-Ruiz band was occupied 0% of the time; now 31% and 50%). Dark-observed (tools/naica-thermal-observe.mjs, 3 seeds): total crystal count DROPS ~40-60% (27→11, 39→16) while the cavity still seals — fewer nuclei, larger individuals — which is the Garcia-Ruiz mechanism emerging from the engines rather than being scripted. The low-T noise feeders (opal, goethite, lepidocrocite, tigers_eye, pyrolusite) drop out; the cave trends toward its real near-monomineralic character.

> The six slow_cooling events keep their CHEMISTRY half under the movement — the anhydrite-at-depth resupply holds the measured Ca≈600 ppm and SO4≈1500 ppm (S≈500 ppm) floors plus O2/pH/flow resets; their -0.7°C drops are superseded by the movement's trend (the handler's T>51 guard goes inert inside the window). Events are chemistry testimony; the movement is the thermal sentence.

> Mining-drainage event at step 260 (1985 in real time) fires fluid_surface_ring → 0 and SETS T=35; recharge at step 290 (2017) refloods at T=30. The movement window deliberately ENDS at 260: the thermal buffer was the WATER, so once the cave drains the pool era is over and the mining events own T. Ambient resumes post-260 with cooling_rate 0.1 (a drained cave at 290 m in warm country rock cools gently — observed end T ~27°C, matching the recharge note's 'cooler bath'), and thermal_pulses:false (no fracture-valve reheats in a conductively buffered system; same flag family as bisbee/roughten_gill/schneeberg/reactivated_vein).

> The default vug_diameter_mm of 50 mm grossly understates Naica reality (the chamber is ~30m × 10m × 10m). The simulator's max_size_cm cap on selenite is 2400 cm = 24m, double the real-world record (Garcia-Ruiz). Both are intentional — the sim isn't trying to reproduce Naica scale, it's reproducing Naica chemistry.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Naica Mine, Saucillo Municipality, Chihuahua; 113 valid; questioned entries Rhodonite? + Fowlerite? — questioned ≠ license). THE SELENITE POSITIVE CONTROL, CONFIRMED: Gypsum (var. Selenite) prominently listed + the page's own Cave-of-the-Crystals text (14 m × 2 m selenite, <200 ka, grown underwater where hot CaCO3+sulfide-saturated Naica-fault fluids mixed with cooler surface water) → the sim's 66 mm selenite giant is record-licensed, and the S2 selenite census closes its sixth locality: elmwood NO / picher YES / sweetwater NO / tsumeb YES / copper-queen YES / NAICA YES. Verdicts vs seed-42 v236 (4 sim species — the cleanest sheet of the sweep): selenite ✓, CELESTINE ✓ (listed at Naica — the 138 µm pair is licensed), quartz ✓, thenardite ×3 @0.6 µm dust FLAGGED (not on the list; the list's efflorescent-sulfate suite is the Mg/Fe family — blödite/kieserite/epsomite/hexahydrite/starkeyite/szmikite/rozenite/szomolnokite — not Na). SPATIAL-GRAIN NOTE (the vertical/temporal variant): this scenario models the CAVE STAGE, not the ore body — the list's 100+ skarn/sulfide species (pyrite/galena/sphalerite gross ore + chalcopyrite/arsenopyrite/pyrrhotite/matildite/kobellite-tintinaite/molybdenite + ECONOMIC SCHEELITE + the calc-silicate suite) are CORRECT ABSENCES here; they'd matter only for a hypothetical naica_skarn ore-stage scenario (the page text is a ready-made brief: felsite dikes → calc-silicate mantos → massive-sulfide 'chimneys', the Benavides seal forcing inverted-tree orebodies, 3 controlling faults, granitic stock westward — even the mantos/chimneys-by-COMPOSITION terminology trap). ANHYDRITE ✓ listed — the Garcia-Ruiz at-depth reservoir is on the record, supporting the slow_cooling events' Ca/S resupply floors. PROVENANCE GEM for the catalog side: the page corrects a famous mislabeling — most 'Cave of the Swords' gypsum specimens (including the Denver Museum's) actually came from XOCHITL CAVE (found second; five major caves total: Swords 1912, Xochitl, Crystals 2000, Queen's Eye, Sails). Mine status notes: 60,000 L/min pumping ('40 t water per t ore'), the 2015 flood never came within 100 m of the Cave of the Crystals, 2026 restart underway with new orebodies west of the historic mine.
