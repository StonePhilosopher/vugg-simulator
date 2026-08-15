# CLAIM CARD — great_salt_plains  (v239, seed 42, 250 steps)

**Anchor:** Salt Plains National Wildlife Refuge, Alfalfa County, Oklahoma — a 65-km² salt flat on the Permian red beds (Flowerpot Shale / Cedar Hills Sandstone). The ONLY place on Earth selenite grows the iron-stained 'hourglass' habit. The hourglass selenite is the Oklahoma state crystal; the refuge is the public crystal-digging locality.
**Deposit:** Gypsum-saturated, salt-saturated groundwater wicks up through red-bed sand and evaporates just under a thin salt crust. Wet/dry seasonal cycling grows selenite in fast bursts that trap clay, sand, and Permian iron oxide on the terminal growth sectors — the visible hourglass — and step the blade outward each dry season. The iron-flooded crystals go solid reddish-to-chocolate brown.
**Initial:** 28 °C, 0.05 kbar, wall=basin
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** 7e99203f59f6fde18f92a7c826819bfb1d74554d21333a0b3541bd04e72afa81

**expects_species (3):** selenite, halite, celestine

**Cited sources:**
  - U.S. Fish & Wildlife Service — Salt Plains National Wildlife Refuge, selenite crystal digging (formation mechanism: gypsum-saturated groundwater evaporating under a salt crust; clay/sand/iron-oxide inclusions form the hourglass)
  - Oklahoma Geological Survey / Oklahoma Historical Society — Great Salt Plains; hourglass selenite as the Oklahoma state crystal
  - Ham W.E. (1961) Oklahoma Geological Survey — geology of the Salt Plains / Permian red-bed evaporites of northwestern Oklahoma

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | selenite | 0 | 2 |
| 2 | celestine | 4 | 4 |
| 3 | halite | 53 | 19 |

**Surprises (grown but NOT in expects_species):** (none)
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 26.575 → 23.622 °C  [23.622, 32.48]
  - pH: 7.606 → 7.606   [7.606, 7.606]
  - Eh: 303.937 → 299.213 mV  [251.969, 322.835]
  - salinity: 150.394 → 150.394 psu  [150.394, 150.394]
  - O2: 1.614 → 1.575 mg/L  [1.22, 1.772]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: -1.008 → -1.197  [-1.953, -0.819]
  - SI_aragonite: -1.134 → -1.323  [-2.079, -0.945]
  - SI_dolomite: -2.457 → -2.709  [-3.402, -2.142]
  - SI_HMC: -2.079 → -2.268  [-2.898, -1.953]
  - SI_siderite: 0.063 → 0  [-0.567, 0.189]
  - SI_selenite: -1.134 → -0.945  [-2.835, -0.819]
  - SI_anhydrite: -1.197 → -1.071  [-2.961, -0.945]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -0.756 → -0.504  [-1.575, -0.504]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.967 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.892 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=250
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=250
  - Temperature: 26.260894354712217 → 25 °C [25, 31.765822053607554], n=250
  - Secure aragonite assessment: 0/250 executed steps; first={"boundary_kbar":2.9796071567242537,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":250}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> QUARTZ + ANHYDRITE WITHDRAWN from expects_species (v228, hostile-review rung 2). Quartz: the Salt Plains quartz is DETRITAL — wind/water-blown sand mechanically trapped in the growing selenite (it IS the hourglass inclusion source, which the render already models via the growth-zone sediment record); the broth's SiO2:30 was always a silt proxy, and the sim's chemistry engines were precipitating authigenic quartz from it at 23-27°C, which real kinetics forbid (v228 enforces quartz's T_min 50). Anhydrite: the near-surface crust precipitates halite + selenite ONLY; anhydrite belongs to the deep Permian source beds the brine dissolves, and direct anhydrite nucleation below ~100°C is kinetically impossible (Ossorio 2014, Voigt & Freyer 2023) — the pre-v228 events fired through a saline-low-T branch that modeled REPLACEMENT-after-gypsum as direct nucleation. Both promises were mechanism confabulations, not missing minerals. Celestine kept (documented in the OK evaporite suite) but flagged unverified as a SURFACE precipitate at this locality by the rung-2 pass.

> USFWS Salt Plains NWR + Oklahoma Geological Survey: selenite forms just under a wafer-thin salt crust where gypsum-saturated saline groundwater reaches the surface and evaporates. Fine sand + clay are mechanically included on the fast-growing sectors, producing the hourglass shape; iron oxide in the red-bed soil gives the reddish-to-chocolate-brown colour. This hourglass habit is found NOWHERE else in the world.

> Showcase for the crystal-face-realism arc's hourglass-selenite render (2026-06-22): low-T (<45°C) sediment-laden fast growth → js/45 _seleniteHourglassParams tags the blade gypsum_hourglass; the repeated wet/dry fast-growth pulses drive the stepped-growth ziggurat (steps≥2); accumulated trace_Fe deepens the amber → chocolate brown and floods the heavily-included blades to solid brown. The render machinery already shipped SIM-neutral; this scenario is where it is the centerpiece.

> Initial broth: gypsum-saturated (Ca 120, S 120) salt-saturated (Na 700, Cl 700) oxidized surface brine at 28°C, near-neutral pH 7.6, iron-bearing (Fe 4) with suspended silt (SiO2 30). The DRY events (gsp_dry) spike Ca/S to 150 + concentrate Fe → fast selenite bursts that trap sediment; the WET events (gsp_wet) dilute to Ca/S 35 (σ<1) so growth pauses between pulses. Five wet/dry cycles over 250 steps.

> Halite is a co-product (the literal salt crust of the Salt Plains); minor goethite/iron-oxide staining is geologically the same iron that colours the hourglass. The star is selenite.
