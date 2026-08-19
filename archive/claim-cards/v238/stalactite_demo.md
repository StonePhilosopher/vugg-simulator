# CLAIM CARD — stalactite_demo  (v238, seed 42, 100 steps)

**Anchor:** Generic limestone-cave dripstone — Carlsbad Caverns / Lechuguilla / Mammoth Cave family. Cave-air-filled cavity (vadose throughout), calcite precipitating from CO₂-degassed drip water on ceiling, floor, and walls in three different morphologies.
**Deposit:** PROPOSAL-HABIT-BIAS Slice 5 — proof-by-screenshot that the gravity-aware c-axis works. Cave-style cavity: every crystal nucleates in air-mode (wall.air_mode_default), so ceiling calcite renders as stalactite (c-axis world-down) and floor calcite as stalagmite (c-axis world-up). Multiple speleothems grow concurrently (cave-mode nucleation probability fires every step σ > threshold). Per-vertex sampling + zone chemistry route each nucleation to the calcite-favoring floor/ceiling cells.
**Initial:** 15 °C, 0.01 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1
**Scenario spec hash:** 8194b4d9167ddcdad00e87386ec86796793df8cba4d313c8ed97c626480f0a56

**expects_species (1):** calcite

**Cited sources:**
  - Pentecost A. (2005), Travertine — comprehensive review of CO₂-degas calcite (cave + spring)
  - Hill & Forti (1997), Cave Minerals of the World, 2nd ed. — speleothem morphology reference
  - Ford & Williams (2007), Karst Hydrogeology and Geomorphology — cave drip-water chemistry

## Paragenetic order as grown (1 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | calcite | 10 | 2 |

**Surprises (grown but NOT in expects_species):** (none)
**No-shows (expected but never nucleated):** (none)

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
  - SI_selenite: -1.764 → -1.764  [-1.764, -1.764]
  - SI_anhydrite: -1.953 → -1.953  [-1.953, -1.953]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.01 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.065 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.15 °C; initial a_w=1.000 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.01 → 0.01 kbar [0.01, 0.01], n=100
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=100
  - Temperature: 25 → 25 °C [25, 25], n=100
  - Secure aragonite assessment: 0/100 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":100}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Habit-bias proof scenario. The whole point: walk into the cave, look up at the ceiling, see crystals HANGING (stalactites); look down at the floor, see crystals STANDING (stalagmites). All are the same calcite mineral and the same precipitation chemistry — only the ANCHOR ORIENTATION differs, and that drives the rendered c-axis via PROPOSAL-HABIT-BIAS Slice 1.

> Chemistry is generic dripstone: Ca²⁺ + HCO₃⁻ from limestone dissolution upstream, CO₂ degasses in the cave air, pH rises, CO₃²⁻ fraction climbs, calcite saturates and precipitates. The simulator's calcite engine handles this cascade.

> Zone chemistry (PROPOSAL-CAVITY-MESH Phase 3): ceiling + floor are Ca-rich (drip-source ceiling, drop-collector floor), wall is calcite-cuspy. With inter_ring_diffusion_rate=0 the gradient persists across the 100-step run; without that, Laplacian diffusion would average the zones over ~20 steps and the differentiation would wash out.

> Per-vertex nucleation (PROPOSAL-CAVITY-MESH Tranche 6, 2026-05): the calcite engine still gates on the equator's σ, but cell assignment uses the joint σ-weighted sample so each calcite anchors at a cell where its local σ is highest. With the sharp wall-cuspy zoning, this routes every nucleation to the floor or ceiling — no wall calcite. Without this flag, area-weighted random placement would put most calcites on wall cells (wall has ~2× more cells than floor or ceiling combined) and the speleothem morphologies would be invisible.

> Air-mode nucleation probability (2026-05): cave-mode scenarios use a Bernoulli per-step roll (_AIR_MODE_NUCLEATION_PROB = 0.06) instead of the strict serial !existing_calcite gate. Real caves grow multiple stalactites + stalagmites concurrently; the serial gate produced exactly 1 calcite per run and was the reason this scenario shipped with only 1 visible speleothem at v69. Calibrated to give ~4-7 nucleations over 100 steps, bounded by max_nucleation_count.

> Temperature: 15°C — generic cave. Pressure: 0.01 kbar (atmospheric — cave air above the water table). Wall: pocket archetype at 60 mm diameter.
