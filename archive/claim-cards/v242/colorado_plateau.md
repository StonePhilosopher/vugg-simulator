# CLAIM CARD — colorado_plateau  (v242, seed 42, 180 steps)

**Anchor:** Uravan Mineral Belt, Colorado Plateau — sandstone-hosted roll-front uranium-vanadium deposits (Triassic-Jurassic Morrison Formation). Includes the Carnotite-Eldorado, Uravan, and Moab districts; the V+U bonanza that drove the early-twentieth-century uranium industry decades before the Manhattan Project.
**Deposit:** Uravan Mineral Belt sandstone roll-front uranium-vanadium deposit (Roc Creek, Montrose County, CO — carnotite type locality, Friedel & Cumenge 1899). Oxidizing groundwater carries U + V + K + Ca through Triassic-Jurassic Morrison Formation sandstones until it meets a reducing barrier (petrified wood, carbonaceous shale), where the metals drop out as bright canary-yellow uranyl-vanadate crusts. Carnotite + tyuyamunite are the two diagnostic species — interconvertible by cation exchange, drawn apart by whichever of K/Ca dominates the local pore fluid.
**Initial:** 22 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 5cab102612d3f5e119a65c2327ad533de10af1126ed829f4dd085a0f21c6ac71

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (2):** carnotite, tyuyamunite

**Cited sources:**
  - Friedel & Cumenge 1899 — original carnotite description (Roc Creek)
  - Nenadkevich 1912 — tyuyamunite type description (Tyuya-Muyun)
  - Hess 1924 — V-U-Ca-K paragenesis review
  - Stern et al. 1956 — meta-tyuyamunite (American Mineralogist v.41)
  - research/minerals/research-tyuyamunite.md (May 2026) — Colorado Plateau roll-front geology + simulator design

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | tyuyamunite | 0 | 5 |
| 2 | uranophane | 0 | 3 |
| 3 | carnotite | 103 | 4 |

**Surprises (grown but NOT in expects_species):** uranophane
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 23.622]
  - pH: 7 → 7   [7, 7]
  - Eh: 251.969 → 218.898 mV  [218.898, 289.764]
  - salinity: 7.874 → 7.874 psu  [7.874, 7.874]
  - O2: 1.181 → 0.984 mg/L  [0.984, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -0.945 → -0.945  [-1.386, -0.945]
  - SI_aragonite: -1.071 → -1.071  [-1.512, -1.071]
  - SI_dolomite: -2.331 → -2.331  [-2.772, -2.331]
  - SI_HMC: -1.953 → -2.016  [-2.394, -1.953]
  - SI_siderite: 0.252 → 0.441  [0.252, 0.504]
  - SI_selenite: -2.205 → -2.205  [-2.709, -2.205]
  - SI_anhydrite: -2.457 → -2.457  [-2.898, -2.457]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.011 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.995 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 25 → 25 °C [25, 25], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":180}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Colorado Plateau uranium districts (Uravan Mineral Belt). Mineralogy first described by Friedel & Cumenge (1899) at Roc Creek (Montrose County, CO); Hess (1924) characterized the V-U-Ca-K paragenesis. The Vanadium Corporation of America (VCA) operated the Uravan mill from 1915-1944 turning carnotite into V₂O₅ (steel alloy) before the Manhattan Project shifted demand to uranium.

> Mechanic: 5-event sandstone roll-front lifecycle. Initial: oxidizing surface groundwater carries U+V+K+Ca at ambient T. Step 20 (groundwater pulse): more U + V flushes through the system, Ca dominates K initially → tyuyamunite plates. Step 60 (roll-front contact): Fe rises (organic-iron proxy for petrified wood / carbonaceous shale), T drops, slight reducing pulse — concentrates carnotite + tyuyamunite at the redox front. Step 100 (cation oscillation): K rises (evaporite-style salt concentration in the arid surface zone), K/(K+Ca) crosses 0.5 → carnotite plates. Step 140 (Ca recovery): Ca returns dominant → second tyuyamunite phase. Step 165 (arid stabilization): system stabilizes, both species coexist.

> First scenario to fire carnotite + tyuyamunite, completing the autunite-group cation+anion fork coverage when paired with Schneeberg (which fires the Cu/Ca pair on the P+As branches).
