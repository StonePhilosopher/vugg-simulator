# CLAIM CARD — gem_pegmatite  (v239, seed 42, 230 steps)

**Anchor:** Cruzeiro mine, São José da Safira, Doce Valley, Minas Gerais (Variant A — Brasiliano-age miarolitic gem pegmatite, 700-450 Ma).
**Deposit:** Miarolitic cavity in a complex zoned pegmatite. The residual pocket where incompatible elements (Be, B, Li, F) accumulate beyond belief, then cross saturation in cascade — schorl → beryl → spodumene + elbaite → late topaz, with kaolinization of the microcline walls at the end.
**Initial:** 650 °C, 3 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** 8c9d7bf20652add1cacc53053972f84aaf98388381d0a9f8a91775b759aade81

**expects_species (7):** tourmaline, spodumene, topaz, feldspar, albite, lepidolite, cassiterite

**Cited sources:**
  - Morteani et al. 2002 — fluid chemistry of Brazilian gem pegmatites
  - Cassedanne 1991 — Cruzeiro mine paragenesis
  - Proctor 1985 — Cruzeiro tourmaline + beryl mineralogy
  - London 2008 — pegmatite fluid Al partition (~150 ppm upper bound)

## Paragenetic order as grown (8 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | emerald | 0 | 1 |
| 3 | feldspar | 0 | 2 |
| 4 | lepidolite | 0 | 3 |
| 5 | quartz | 0 | 3 |
| 6 | spodumene | 0 | 1 |
| 7 | tourmaline | 0 | 3 |
| 8 | cassiterite | 5 | 4 |

**Surprises (grown but NOT in expects_species):** emerald, quartz
**No-shows (expected but never nucleated):** topaz

## Environment trajectory (first → last, [min,max])
  - T: 649.606 → 277.559 °C  [277.559, 649.606]
  - pH: 6.78 → 4.409   [3.528, 7]
  - Eh: -74.016 → -74.016 mV  [-74.016, -74.016]
  - salinity: 6.299 → 6.299 psu  [6.299, 6.299]
  - O2: 0.118 → 0.118 mg/L  [0.118, 0.118]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.78 → -8  [-8, -3.402]
  - SI_aragonite: -3.906 → -8  [-8, -3.528]
  - SI_dolomite: -7.181 → -8  [-8, -6.425]
  - SI_HMC: -5.48 → -8  [-8, -5.102]
  - SI_siderite: -0.441 → -5.417  [-7.118, -0.063]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 7.743 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 102.10 °C; initial a_w=0.996 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 3 → 3 kbar [3, 3], n=230
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=230
  - Temperature: 648.2608943547123 → 276.1096062884666 °C [276.1096062884666, 648.2608943547123], n=230
  - Secure aragonite assessment: 0/230 executed steps; first={"boundary_kbar":7.7041468185785416,"secure_aragonite":false}, last={"boundary_kbar":2.6458322675189927,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":135,"unconstrained":95}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Cruzeiro is the type-locality for fine schorl-elbaite tourmaline + smoky quartz pockets, with documented beryl, spodumene, lepidolite, and accessory apatite. Brasiliano-age (Neoproterozoic) pegmatite field cutting Macaúbas Group meta-sediments. Morteani et al. 2002 covers fluid chemistry; Cassedanne (1991) and Proctor (1985) cover the Cruzeiro-specific paragenesis.

> Thermal regime: 650 → 300°C over ~230 steps in three phases. Phase 1 (650-550°C): wall-zone crystallization (microcline, quartz, early schorl). Phase 2 (550-400°C): main pocket growth — beryl finally nucleates when Be crosses threshold; spodumene when Li crosses; schorl transitions to elbaite as Fe depletes and Li accumulates. Phase 3 (400-300°C): late hydrothermal — topaz if F survives, then kaolinization of microcline walls.

> Saturation cascade mechanic: there is no explicit 'nucleate beryl now' command. Each mineral's supersaturation formula reads the current fluid, and the nucleation gates fire in order naturally as chemistry evolves — microcline first (K-feldspar = feldspar here), then the Be/Li/B gates cross as incompatible elements build up.

> v183 thermal_pulses:false — the PEGMATITE-SHAPE T story (contrast naica's v182 movement): all eight events SET temperature (620→560→500→450→420→360→320→300), so the three-phase curve is already fully event-anchored and a declared movement would clobber it. The fix is silencing the ambient noise around it: a sealed miarolitic pocket has no fracture-valve hot injections (the pocket IS the isolated residual chamber), the pulses' Fe riders (+2-15 ppm) directly fight the li_phase event's documented Fe depletion (Fe→5 is what turns schorl into elbaite), and a late pulse was re-warming the ended system to ~476°C against the design's 300°C floor (dark-observed, tools/t-story-observe.mjs: end T 476→276 with the flag; assemblage and crystal counts IDENTICAL at 3 seeds — the v181 dedicated thermal stream means a thermal-regime change no longer re-rolls the nucleation cascade). Topaz remains aspirational at seed 42 (absent in BASE too — its tuning is a separate vugg-tune-scenario arc; the honest T floor can only help it).

> Audit gap-fills (Apr 2026): P=8 (pegmatite residual P; enables Cruzeiro accessory apatite per Cassedanne 1991). Mg=5 (brief-required non-zero baseline; pegmatite pocket fluids are Mg-poor since Mg partitions strongly into outer-shell biotite/chlorite during pegmatite differentiation).
