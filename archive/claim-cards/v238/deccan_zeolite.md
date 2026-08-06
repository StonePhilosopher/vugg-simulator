# CLAIM CARD — deccan_zeolite  (v238, seed 42, 200 steps)

**Anchor:** Deccan Traps zeolite vesicle (Stage III, ~21-58 Ma post-eruption). Nashik 'bloody apophyllite' is the type expression. Per Ottens et al. 2019.
**Deposit:** Patient zeolite-stage paragenesis in cooled basalt vesicles. Stage I silica veneer + Stage II zeolite blades + Stage III alkaline K-Ca-Si-F pulse builds pseudo-cubic apophyllite around hematite-needle phantoms.
**Initial:** 250 °C, 0.05 kbar, wall=spherical
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1
**Scenario spec hash:** 1d6148ec0993db4b796ee2610ac388104df2ea84e7444b775027d271b6ecfd04

**expects_species (9):** hematite, quartz, apophyllite, stilbite, heulandite, scolecite, mesolite, thomsonite, chabazite

**Cited sources:**
  - Ottens et al. 2019 — Deccan zeolite paragenesis + Stage III timing (21-58 Ma)
  - Pinch & Wilson 1977 — Nashik 'bloody apophyllite' phantom inclusions

## Paragenetic order as grown (16 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | epidote | 0 | 5 |
| 3 | hematite | 0 | 1 |
| 4 | quartz | 0 | 3 |
| 5 | calcite | 6 | 1 |
| 6 | heulandite | 27 | 5 |
| 7 | chabazite | 69 | 5 |
| 8 | scolecite | 69 | 5 |
| 9 | thomsonite | 79 | 5 |
| 10 | apophyllite | 109 | 1 |
| 11 | pectolite | 109 | 1 |
| 12 | stilbite | 109 | 5 |
| 13 | aragonite | 159 | 1 |
| 14 | goethite | 159 | 1 |
| 15 | mesolite | 159 | 6 |
| 16 | opal | 159 | 5 |

**Surprises (grown but NOT in expects_species):** albite, epidote, calcite, pectolite, aragonite, goethite, opal
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 250.984 → 67.913 °C  [67.913, 250.984]
  - pH: 8.213 → 7.992   [7.992, 8.819]
  - Eh: 289.764 → 218.898 mV  [200, 289.764]
  - salinity: 2.362 → 2.362 psu  [2.362, 2.362]
  - O2: 1.496 → 0.984 mg/L  [0.906, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.126 → 1.134  [0.126, 2.016]
  - SI_aragonite: 0.063 → 1.008  [0.063, 1.89]
  - SI_dolomite: 0.126 → 0.882  [0.126, 2.835]
  - SI_HMC: -1.575 → -0.378  [-1.575, 0.252]
  - SI_siderite: 3.276 → 3.465  [3.276, 4.598]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.541 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 249.65217887094244 → 67.68840124993582 °C [67.68840124993582, 249.65217887094244], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.5393283473579826,"secure_aragonite":false}, last={"boundary_kbar":2.717038917670087,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Per Ottens et al. 2019, the Deccan basalt vesicles fill in stages over tens of millions of years. Stage I (early): silica veneers, chalcedony coating. Stage II: zeolite blades (stilbite, scolecite, heulandite) and early calcite. Stage III: the apophyllite stage — alkaline K-Ca-Si-F fluid percolates through cooled basalt vesicles and crystallizes pseudo-cubic apophyllite blocks, sometimes carrying hematite-needle phantoms (the 'bloody apophyllite' of Nashik).

> Compared to the metamorphic / hydrothermal scenarios, this is gentle: no acid pulses, no dramatic T excursions. The story is patient crystallization in alkaline groundwater over geologic time.

> v184 thermal honesty (T-rollout close-out) — THREE coupled changes, dark-observed together (tools/t-story-observe.mjs, 3 seeds): (1) thermal_pulses:false — the note above says 'no dramatic T excursions' and the ambient mechanic was firing 5-8 of them per run; (2) cooling_rate 0.3 — with pulses gone, the default 1.5°C/step crashed the vesicle to the floor between the stage events (a cooling flow stack declines gently over ~37 My, the scenario's own 'patient' thesis); (3) the movements block below — a sustained fluid.SiO2 setpoint (950) through the Stage III window. The dark observation EXPOSED a structural noise-dependence: apophyllite's gate needs SiO2 ≥ 800 and the random pulses' +50-300 SiO2 riders were the scenario's de-facto silica budget (the stage_iii event's one-shot +600 — already bumped from 300 once for exactly this reason — gets eaten by background quartz depletion). Ottens calls Stage III 'the long-lasting late stage' (21-58 Ma): a SUSTAINED groundwater regime is the honest model, and on vesicle timescales the percolating aquifer is an infinite reservoir — so the movement PINS SiO2 at 950 for the window rather than shooting it once. Result: all three expects at all seeds (apophyllite was LOST under flag-only variants), fill IMPROVES 0.07-0.18 → 0.28-0.30, and the noise-fed extras (rhodochrosite = pulse-Mn, wollastonite = a skarn mineral that never belonged in an amygdale) drop out.

> Audit gap-fill (Apr 2026): Sr=2 — Deccan zeolites (heulandite, stilbite, mesolite) carry Sr substituting for Ca, sometimes 100s of ppm in the mineral. Sim-scale 2 ppm in the parent fluid documents the source. Brief-required non-zero Mg already covered by Mg=8.
