# CLAIM CARD — sabkha_dolomitization  (v241, seed 42, 260 steps)

**Anchor:** Coorong lagoon system (South Australia) and Persian Gulf sabkhas. The classic natural laboratory for direct-from-solution dolomite formation per Kim, Sun et al. 2023 (Science 382:915).
**Deposit:** Cycling-brine sabkha producing ORDERED dolomite at ambient T via the Kim 2023 mechanism. Twelve flood/evap pulses over 240 steps drive Ω across the dolomite saturation boundary repeatedly — the cyclic Ω modulation that's needed to produce ordered dolomite at surface T.
**Initial:** 25 °C, 0.05 kbar, wall=basin
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:mmol-formula-to-mgkg+proportional-poolcap+trace-ledger-v5|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:physical-timescale+mass-weighted-budget-v2|diagnosis:production-nucleator+causal-supersat+route-capacity-v3|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 42ac7b6032433821497eeb5d188c2807539f9ebe9a66308d4b81f3a68048fa4c

**expects_species (3):** dolomite, anhydrite, selenite

**Cited sources:**
  - Kim, Sun et al. 2023 (Science 382:915) — cyclic Ω modulation produces ordered dolomite at ambient T
  - Coorong lagoon (South Australia) + Persian Gulf sabkhas — natural laboratory anchors

## Paragenetic order as grown (5 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | aragonite | 0 | 1 |
| 2 | calcite | 0 | 2 |
| 3 | dolomite | 0 | 1 |
| 4 | HMC | 0 | 5 |
| 5 | selenite | 0 | 2 |

**Surprises (grown but NOT in expects_species):** aragonite, calcite, HMC
**No-shows (expected but never nucleated):** anhydrite

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 26.575]
  - pH: 8.874 → 9.26   [8.102, 9.26]
  - Eh: 289.764 → 289.764 mV  [289.764, 289.764]
  - salinity: 119.685 → 119.685 psu  [119.685, 119.685]
  - O2: 1.496 → 1.496 mg/L  [1.496, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 1.764 → 2.772  [0, 2.772]
  - SI_aragonite: 1.575 → 2.646  [-0.189, 2.646]
  - SI_dolomite: 4.346 → 6.425  [0.819, 6.488]
  - SI_HMC: 0.819 → 1.827  [-0.945, 1.89]
  - SI_siderite: 2.079 → 2.961  [0.567, 3.024]
  - SI_selenite: 0.504 → 0.693  [0.252, 0.693]
  - SI_anhydrite: 0.315 → 0.567  [0.126, 0.567]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: 0.945 → 1.197  [0.693, 1.197]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.989 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.919 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=260
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=260
  - Temperature: 25 → 25 °C [25, 26.79753743512556], n=260
  - Secure aragonite assessment: 0/260 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":260}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Surface T (~25°C), high-Mg evaporative brine, seasonal flood-evaporate cycles. Per Kim, Sun et al. (2023, Science 382:915), exactly this kind of cyclic Ω modulation is what's needed to produce ordered dolomite at ambient T.

> The acid-pulse-and-relax style of reactive_wall produces only DISORDERED HMC because the dissolution events are too aggressive (full dissolution rather than gentle surface etch). Sabkha tidal pumping is the right kind of cycling — gentle, frequent, repeated.

> Twelve flood/evap pairs over 240 steps produce ~12 dissolution-precipitation cycles. With N0=10 in the f_ord formula, this reaches ORDERED (f_ord > 0.7) by mid-scenario. The result: true ordered dolomite, the geological prize the Kim 2023 paper made accessible.

> Schema note: the original Python/JS implementations used factory functions `make_flood(idx)` and `make_evap(idx)` to bake the cycle index into each handler's narrator string. Per the Phase 2 migration, we use one flood handler and one evap handler reused across all 12 cycles (the supergene_acidification precedent — same handler, multiple Event entries pointing to it). Cycle number is preserved via the event `name` field ('Tidal Flood #1', 'Evaporation #1', etc.) instead of an in-handler f-string.
