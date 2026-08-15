# CLAIM CARD — reactive_wall  (v241, seed 42, 120 steps)

**Anchor:** Sweetwater Mine (Reynolds County, MO), Viburnum Trend Pb-Zn district. Host: Cambrian Bonneterre Formation dolomitic limestone.
**Deposit:** Acid-into-carbonate paragenesis — repeated acid pulses dissolve the limestone wall, then pH recovery drives supersaturation and growth bursts. Sphalerite-galena-marcasite ± barite, dolomite-calcite gangue.
**Initial:** 140 °C, 0.2 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:mmol-formula-to-mgkg+proportional-poolcap+trace-ledger-v5|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:physical-timescale+mass-weighted-budget-v2|diagnosis:production-nucleator+causal-supersat+route-capacity-v3|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 6ef52f04e4c6a9d0dffdbe2fb92706accbaf0d17cdabdbacb609bcec49625ec5

**expects_species (4):** sphalerite, pyrite, barite, dolomite

**Cited sources:**
  - Sverjensky 1981 (Econ. Geol. 76) — Viburnum Trend brine geochemistry
  - Stoffell et al. 2008 — LA-ICP-MS fluid-inclusion brine analyses (Tri-State vs Viburnum distinction)
  - Leach et al. 2010 — MVT genesis review
  - Anderson & Macqueen 1982 — MVT mineralogy review
  - Hanor 1994 — basinal-brine compendium (Sr/Ba tracers)

## Paragenetic order as grown (13 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | calcite | 0 | 1 |
| 2 | acanthite | 7 | 4 |
| 3 | sphalerite | 14 | 1 |
| 4 | barite | 15 | 6 |
| 5 | celestine | 17 | 10 |
| 6 | siderite | 17 | 1 |
| 7 | quartz | 37 | 3 |
| 8 | galena | 39 | 1 |
| 9 | marcasite | 39 | 1 |
| 10 | pyrite | 40 | 1 |
| 11 | selenite | 40 | 2 |
| 12 | rhodochrosite | 42 | 2 |
| 13 | dolomite | 89 | 1 |

**Surprises (grown but NOT in expects_species):** calcite, acanthite, celestine, siderite, quartz, galena, marcasite, selenite, rhodochrosite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 138.78 → 94.488 °C  [70.866, 138.78]
  - pH: 7 → 6.724   [4.189, 7.11]
  - Eh: 25.197 → 25.197 mV  [25.197, 25.197]
  - salinity: 18.11 → 18.11 psu  [18.11, 18.11]
  - O2: 0.236 → 0.236 mg/L  [0.236, 0.236]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.315 → 0.378  [-4.346, 0.756]
  - SI_aragonite: 0.189 → 0.31  [-4.472, 0.693]
  - SI_dolomite: 0.693 → 0.252  [-8, 1.134]
  - SI_HMC: -1.323 → -1.26  [-5.858, -0.882]
  - SI_siderite: 1.449 → 2.079  [-2.772, 2.52]
  - SI_selenite: -0.945 → -0.504  [-0.945, -0.504]
  - SI_anhydrite: -0.882 → -0.504  [-0.882, -0.378]
  - SI_barite: 1.575 → 2.331  [1.575, 2.583]
  - SI_celestine: -0.378 → -0.126  [-0.441, -0.063]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.2 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.456 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 60.94 °C; initial a_w=0.990 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.2 → 0.2 kbar [0.2, 0.2], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 138.2608943547122 → 94.92713943878192 °C [70.49107971857299, 138.2608943547122], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":2.4594481247751863,"secure_aragonite":false}, last={"boundary_kbar":2.589288499479153,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":120}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Sweetwater Mine, Viburnum Trend MVT district (high-Ba endmember vs Tri-State, distinguished by Stoffell et al. 2008 LA-ICP-MS).

> Mechanic: acid entering a carbonate vug doesn't just dissolve crystals — it dissolves the WALL. The wall neutralizes the acid AND releases Ca2+/CO3 2- back into solution. When pH recovers, that dissolved carbonate supersaturates and precipitates as rapid growth bands on existing crystals. The acid is both destroyer and creator. The vug enlarges as the crystals grow.

> Repeated acid pulses (steps 15/40/70) model the Viburnum dissolution → supersaturation → growth burst cycle. Final fracture seal at step 90 closes the system.

> Chemistry-audit gap-fill pass (Apr 2026): Na, K, Cl (NaCl-CaCl2 brine baseline), Ag (Viburnum galena carries minor Ag — the Trend is one of the 'some deposits' where Leach et al. 2010 allow a byproduct Ag credit, UNLIKE silver-poor Tri-State whose Ag was de-confabulated v195), Sr (basinal-brine tracer + minor celestine documented in Viburnum). v5 gap-fill: O2=0.25 to allow barite + galena coexistence per the MVT-Eh window.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Sweetwater Mine, Ellington, Reynolds Co., MO; 23 valid + 1 erroneous): Anilite, Bornite, Calcite, Carrollite, Chalcocite, Chalcopyrite (var. Blistered Copper), Covellite, Dickite, Digenite, Djurleite, Dolomite, Erythrite, Fletcherite, Galena, Malachite, Marcasite, Millerite, 'Petroleum' (var. Bitumen), Polydymite, Pyrite, Quartz, Siegenite, Sphalerite, Vaesite. LINNAEITE struck through as an ERRONEOUS literature entry — mindat's own flag; never cite it as license. Page text worth keeping: Viburnum differs from other MVT in being shallower, carrying Ni-Co minerals + some Cu-Fe sulfides, with REPETITIVE PRECIPITATION-DISSOLUTION of the sulfides (base metals transported WITH reduced S in the same solutions — cf. the fluid.S split's own two-pool story) — the scenario's acid-pulse mechanic models exactly this. WHAT THE LIST VOTES ON (vs seed-42 v236): (a) THE HEADLINE GAP — the entire Viburnum Ni-Co-Cu sulfide suite is documented here and the sim grows NONE of it: carrollite, fletcherite, millerite, polydymite, siegenite, vaesite (+ the Cu ladder anilite/bornite/chalcocite/covellite/digenite/djurleite + erythrite as the Co bloom). Siegenite is ALREADY on the missing-engines want list — this is its reference locality; a Ni-Co arc would make this scenario the Viburnum showcase its anchor promises. (b) Census flags (sim grows, list lacks): ACANTHITE ×4 @1.8mm — NO discrete Ag species at Sweetwater; the Apr-2026 note's Leach byproduct-Ag credit defends broth Ag / Ag-IN-galena, NOT discrete acanthite crystals (v195-silver family? BOSS ADJUDICATION); BARITE ×6 — unlisted despite the 'high-Ba endmember' anchor (Stoffell's high-Ba is the FLUID-INCLUSION brine, not precipitated barite at this mine; expects_species includes barite — adjudicate before any kill); CELESTINE ×9 (S2-flipped; unlisted — Ba-blanket record-licensed only at elmwood so far); SELENITE ×2 (unlisted — selenite census now reads elmwood NO / picher YES / sweetwater NO); RHODOCHROSITE + SIDERITE (unlisted — the Fe/Mn-carbonate over-fire flag is now 3-for-3 across the MVT family). (c) Licensed ✓: calcite, dolomite, galena, marcasite, pyrite, quartz, sphalerite; dickite + malachite + bitumen = candidates.
