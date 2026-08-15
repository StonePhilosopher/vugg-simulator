# CLAIM CARD — naica_geothermal  (v239, seed 42, 320 steps)

**Anchor:** Naica, Chihuahua, Mexico — Cueva de los Cristales, 290 m below surface. Lead-Zinc-Silver mine (Industrias Peñoles); the giant selenite cave was breached in April 2000 when a mine drift broke through into the chamber. Selenite blades up to 12 m × 1 m × 55 tonnes.
**Deposit:** Slow geothermal pool that grew the largest crystals on Earth. Anhydrite-saturated water cools by hundredths of a degree per year through the gypsum-anhydrite boundary at ~58°C and holds just below it (~54-57°C), where gypsum reprecipitates from anhydrite dissolving at depth. Stable for ~500,000 years (Garcia-Ruiz et al. 2007). Mining begun 1985 dewatered the cave; pumping stopped 2017 and the cave reflooded.
**Initial:** 56 °C, 0.08 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** cc421b0f4b039811b92fd625c3c4f3960215767f00489d7dbc947cc7ce2c7284

**expects_species (1):** selenite

**Cited sources:**
  - Garcia-Ruiz, Villasuso, Ayora, Canals, Otálora 2007 (Geology 35:327) — Formation of natural gypsum megacrystals in Naica, Mexico
  - Otálora & Garcia-Ruiz 2014 (Chem. Soc. Rev. 43:2013) — Nucleation and growth of the Naica giant gypsum crystals
  - Forti & Sanna 2010 (NSS Bull.) — The Naica caves and their crystals: a unique speleological problem
  - Van Driessche, Garcia-Ruiz, Tsukamoto, Patiño-Lopez, Satoh 2011 (PNAS 108:15721) — Ultraslow growth rates of giant gypsum crystals (the measured stability the v182 thermal movement models: no-noise pool at marginal saturation)

## Paragenetic order as grown (4 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | quartz | 0 | 1 |
| 2 | selenite | 0 | 2 |
| 3 | celestine | 4 | 2 |
| 4 | thenardite | 264 | 3 |

**Surprises (grown but NOT in expects_species):** quartz, celestine, thenardite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 56.102 → 26.575 °C  [26.575, 56.102]
  - pH: 7.22 → 7.22   [7.22, 7.22]
  - Eh: 289.764 → 303.937 mV  [289.764, 322.835]
  - salinity: 3.937 → 3.937 psu  [3.937, 3.937]
  - O2: 1.496 → 1.614 mg/L  [1.496, 1.772]
  - concentration: 0.984 → 0.984 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: -0.693 → -1.008  [-1.008, -0.693]
  - SI_aragonite: -0.819 → -1.197  [-1.197, -0.819]
  - SI_dolomite: -2.016 → -2.709  [-2.709, -2.016]
  - SI_HMC: -2.016 → -2.142  [-2.142, -2.016]
  - SI_siderite: -0.315 → -0.756  [-0.756, -0.315]
  - SI_selenite: -0.063 → -0.189  [-0.441, -0.063]
  - SI_anhydrite: -0.189 → -0.378  [-0.63, -0.189]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -0.063 → -0.189  [-0.441, -0.063]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.08 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.783 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 59.18 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.08 → 0.08 kbar [0.08, 0.08], n=320
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=320
  - Temperature: 55.99986720527993 → 26.934425352476534 °C [26.934425352476534, 55.99986720527993], n=320
  - Secure aragonite assessment: 0/320 executed steps; first={"boundary_kbar":2.782778524126686,"secure_aragonite":false}, last={"boundary_kbar":2.9746795282888745,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":320}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Garcia-Ruiz et al. 2007 (Geology 35:327) — the canonical paper on Naica's growth mechanism. Anhydrite at depth (T > 58°C) dissolves slightly; rising water cools to ~54°C; gypsum reprecipitates. The cooling rate is critical: at hundredths of a degree per year, the brine stays close enough to the boundary that crystals grow over geological timescales without significant nucleation of new seeds. Old crystals just keep adding layers.

> v182 THERMAL STORY (the first consumer of the v181 T-unlock): the buffered pool is now a DECLARED temperature movement — base 56°C, smoothstep trend −3 over steps 0-260, no OU texture (Naica's signature is thermal stability; fluid-inclusion work shows a remarkably steady bath, so the no-noise choice IS the science, not a simplification). Ambient drift + pulses stand down for the window (pre-v182 they were bulldozing the design: drift crashed 56→25°C in ~21 steps and ~19 random thermal pulses bounced T between the floor and 53°C — the 55-58°C selenite sweet-spot fired ~2 steps per run and the 54-57 Garcia-Ruiz band was occupied 0% of the time; now 31% and 50%). Dark-observed (tools/naica-thermal-observe.mjs, 3 seeds): total crystal count DROPS ~40-60% (27→11, 39→16) while the cavity still seals — fewer nuclei, larger individuals — which is the Garcia-Ruiz mechanism emerging from the engines rather than being scripted. The low-T noise feeders (opal, goethite, lepidocrocite, tigers_eye, pyrolusite) drop out; the cave trends toward its real near-monomineralic character.

> The six slow_cooling events keep their CHEMISTRY half under the movement — the anhydrite-at-depth resupply (Ca≥280, S≥380 floors) + O2/pH/flow resets are what they contribute now; their -0.7°C drops are superseded by the movement's trend (the handler's T>51 guard goes inert inside the window). Events are the chemistry beats; the movement is the thermal sentence.

> Mining-drainage event at step 260 (1985 in real time) fires fluid_surface_ring → 0 and SETS T=35; recharge at step 290 (2017) refloods at T=30. The movement window deliberately ENDS at 260: the thermal buffer was the WATER, so once the cave drains the pool era is over and the mining events own T. Ambient resumes post-260 with cooling_rate 0.1 (a drained cave at 290 m in warm country rock cools gently — observed end T ~27°C, matching the recharge note's 'cooler bath'), and thermal_pulses:false (no fracture-valve reheats in a conductively buffered system; same flag family as bisbee/roughten_gill/schneeberg/reactivated_vein).

> The default vug_diameter_mm of 50 mm grossly understates Naica reality (the chamber is ~30m × 10m × 10m). The simulator's max_size_cm cap on selenite is 2400 cm = 24m, double the real-world record (Garcia-Ruiz). Both are intentional — the sim isn't trying to reproduce Naica scale, it's reproducing Naica chemistry.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Naica Mine, Saucillo Municipality, Chihuahua; 113 valid; questioned entries Rhodonite? + Fowlerite? — questioned ≠ license). THE SELENITE POSITIVE CONTROL, CONFIRMED: Gypsum (var. Selenite) prominently listed + the page's own Cave-of-the-Crystals text (14 m × 2 m selenite, <200 ka, grown underwater where hot CaCO3+sulfide-saturated Naica-fault fluids mixed with cooler surface water) → the sim's 66 mm selenite giant is record-licensed, and the S2 selenite census closes its sixth locality: elmwood NO / picher YES / sweetwater NO / tsumeb YES / copper-queen YES / NAICA YES. Verdicts vs seed-42 v236 (4 sim species — the cleanest sheet of the sweep): selenite ✓, CELESTINE ✓ (listed at Naica — the 138 µm pair is licensed), quartz ✓, thenardite ×3 @0.6 µm dust FLAGGED (not on the list; the list's efflorescent-sulfate suite is the Mg/Fe family — blödite/kieserite/epsomite/hexahydrite/starkeyite/szmikite/rozenite/szomolnokite — not Na). SPATIAL-GRAIN NOTE (the vertical/temporal variant): this scenario models the CAVE STAGE, not the ore body — the list's 100+ skarn/sulfide species (pyrite/galena/sphalerite gross ore + chalcopyrite/arsenopyrite/pyrrhotite/matildite/kobellite-tintinaite/molybdenite + ECONOMIC SCHEELITE + the calc-silicate suite) are CORRECT ABSENCES here; they'd matter only for a hypothetical naica_skarn ore-stage scenario (the page text is a ready-made brief: felsite dikes → calc-silicate mantos → massive-sulfide 'chimneys', the Benavides seal forcing inverted-tree orebodies, 3 controlling faults, granitic stock westward — even the mantos/chimneys-by-COMPOSITION terminology trap). ANHYDRITE ✓ listed — the Garcia-Ruiz at-depth reservoir is on the record, supporting the slow_cooling events' Ca/S resupply floors. PROVENANCE GEM for the catalog side: the page corrects a famous mislabeling — most 'Cave of the Swords' gypsum specimens (including the Denver Museum's) actually came from XOCHITL CAVE (found second; five major caves total: Swords 1912, Xochitl, Crystals 2000, Queen's Eye, Sails). Mine status notes: 60,000 L/min pumping ('40 t water per t ore'), the 2015 flood never came within 100 m of the Cave of the Crystals, 2026 restart underway with new orebodies west of the historic mine.
