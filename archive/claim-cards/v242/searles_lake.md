# CLAIM CARD — searles_lake  (v242, seed 42, 300 steps)

**Anchor:** Searles Lake, San Bernardino County, California — Pleistocene-Holocene closed-basin alkaline-saline brine, the textbook locality for sodium-borate / sodium-sulfate / sodium-chloride evaporites. ~70 evaporite mineral species documented (Smith 1979 USGS PP 1043). Type locality for hanksite, sulfohalite, borax (commercially), tincalconite.
**Deposit:** Mojave desert closed basin with Sierra Nevada snowmelt feed. Wet/dry seasonal cycling drives the full evaporite cascade: halite crusts in the drying windows, borax + mirabilite in cold winter, thenardite paramorphs in summer heat, and tincalconite where hot saline brine or exposed dry air dehydrates surviving borax. The 20-mule team era of American borate commerce ran on chemistry like this.
**Initial:** 18 °C, 0.05 kbar, wall=basin
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** bf38a32c8628c1704fefa35ea09a73b5d13f8d7e74953913b5c37dcba6105fb7

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (5):** halite, borax, tincalconite, mirabilite, thenardite

**Cited sources:**
  - Smith 1979 USGS Professional Paper 1043 — Subsurface Stratigraphy and Geochemistry of Late Quaternary Evaporites, Searles Lake, California
  - Smith & Pratt 1957 USGS Bull. 1045-A — Hanksite from Searles Lake
  - Eugster 1980 Annu. Rev. Earth Planet. Sci. 8:35 — Lake Magadi-Searles brine geochemistry
  - Boron, CA + Death Valley — adjacent commercially-active borate localities in the same basin family

## Paragenetic order as grown (9 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | calcite | 0 | 65 |
| 2 | selenite | 0 | 2 |
| 3 | celestine | 4 | 9 |
| 4 | mirabilite | 30 | 12 |
| 5 | halite | 31 | 32 |
| 6 | borax | 35 | 7 |
| 7 | thenardite | 42 | 7 |
| 8 | quartz | 59 | 5 |
| 9 | tincalconite | 65 | 2 |

**Surprises (grown but NOT in expects_species):** calcite, selenite, celestine, quartz
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 53.15]
  - pH: 9.48 → 9.48   [9.48, 9.48]
  - Eh: 303.937 → 289.764 mV  [285.039, 322.835]
  - salinity: 180.315 → 180.315 psu  [180.315, 180.315]
  - O2: 1.614 → 1.496 mg/L  [1.457, 1.772]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: 0.693 → 0.693  [0.693, 1.071]
  - SI_aragonite: 0.504 → 0.504  [0.504, 0.945]
  - SI_dolomite: 1.89 → 1.89  [1.89, 2.646]
  - SI_HMC: -0.252 → -0.315  [-0.315, -0.126]
  - SI_siderite: 1.575 → 1.512  [1.512, 2.016]
  - SI_selenite: -1.512 → -1.449  [-1.89, -1.449]
  - SI_anhydrite: -1.575 → -1.575  [-2.016, -1.449]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -0.378 → -0.315  [-0.756, -0.315]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.042 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.862 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=300
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=300
  - Temperature: 25 → 25 °C [25, 53.704463973874226], n=300
  - Secure aragonite assessment: 0/300 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":300}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Smith 1979 USGS Professional Paper 1043 — the canonical Searles Lake mineralogy + paragenesis reference. ~70 mineral species; the simulator covers the major Na-sulfate/borate/chloride suite (halite, borax, tincalconite, mirabilite, thenardite). Trona, hanksite, sulfohalite, glauberite, gaylussite, pirssonite, ulexite, colemanite, kernite are all real and worth adding later.

> Initial T = 18°C (Mojave October — playa temps span 5°C winter to 50°C summer). Initial chemistry seeds the alkaline-saline brine: Na 1500, B 100, S 400, Cl 1500, alkaline pH 9.5, low Ca (Ca > 50 would steal borate as colemanite). Salinity high (180 g/L) reflects the ~4× seawater concentration of mid-Pleistocene Searles brine.

> Five seasonal cycles over 300 steps. Each cycle: winter_freeze (steps 30, 90, 150, 210, 270) drops T to 8°C and bumps soluble species; summer_bake (steps 60, 120, 180, 240) heats to 55°C, firing mirabilite → thenardite (its incongruent-melting boundary is 32.4°C) and borax → tincalconite where the brine reaches the halite-saturated strength represented by the dry-down. The borax transition is 60.8°C in the pure Na2B4O7-H2O system but falls to 39.6°C in saturated NaCl-Na2B4O7 solution (Bowser 1964); controlled-RH measurements independently place the borax/tincalconite boundary near 59±6% RH at 25°C and 88±8% at 55–65°C (Ruhl et al. 2007). Inter-cycle fresh_pulse events flood the basin briefly.

> fluid_surface_ring isn't set in initial state — the basin starts fully saturated. The summer_bake events drop it through evaporation; fresh_pulse refills. The vadose-transition concentration boost (×3 per drying) is what brings borax + mirabilite into supersaturation.

> Death Valley (Furnace Creek) and Boron, CA also belong to this basin family but with slightly different brine-chemistry signatures. Searles is the most chemically diverse — chosen as the sim's anchor because more of its minerals are already plumbed.

> SIM 239 SCIENCE CORRECTION TO THE SIM 234 WITHDRAWAL: exact LIFO shell dissolution removed the old all-or-nothing crystal flag and showed that grown borax remnants survive some flushes, then dehydrate during later dry/hot windows. Primary literature supports that result: tincalconite occurs at Searles both as clear 1–3 mm crystals in contact with lake brine and as an alteration product of large borax crystals (Christ, Truesdell & Jones 1967, citing Pabst & Sawyer 1948 and Smith & Haines 1964). Bowser's saline-system measurements lower the transition from 60.8°C in pure Na-borate solution to 39.6°C in saturated NaCl-Na-borate solution. The old 'museum drawer only' interpretation was therefore too narrow. Tincalconite is restored to expects_species because the scenario now has a mechanism-backed saline summer transition plus its dry-exposure path; this is not a locality-scoreboard restoration.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots + reference list, 2026-07-27 — 'Searles Lake, San Bernardino County, California, USA'; full citation transcription in research/scenarios/searles/citations-mindat-searles-lake-2026-07-27.md; 37 valid, 10 type-locality): Analcime, Anhydrite, Aphthitalite, Aragonite, Borax, BURKEITE (TL), Calcite, Celestine, Chlorargyrite (+ var. Bromian), Dolomite, GALEITE (TL), Gaylussite, Glauberite, GYPSUM (var. SELENITE), Halite, HANKSITE (TL), 'Heulandite Subgroup', 'K Feldspar' ('var. Adularia'), Merlinoite, Mirabilite, Nahcolite, Native Sulphur, Natron, Niter, NORTHUPITE (TL), Opal, Orthoclase, 'Phillipsite Subgroup', PIRSSONITE (TL), Quartz, Realgar, SCHAIRERITE (TL), SEARLESITE (TL), SULPHOHALITE (TL), Teepleite, Thenardite, TINCALCONITE (TL), Trona, TYCHITE (TL), Ulexite. WHAT THE LIST VOTES ON (vs seed-42 v236 sim output): (a) THE CLEANEST SHEET IN THE SWEEP — all 8 sim species licensed: borax ✓ (23.5 mm), calcite ✓, celestine ✓ (255 µm), halite ✓, mirabilite ✓, quartz ✓, selenite ✓ (34.2 mm — the S2-selenite migration's searles tenant is record-LICENSED, cross-mine selenite tally now 5-YES/2-NO), thenardite ✓ (40.2 mm); zero census flags. (b) SYLVITE IS NOT ON THE LIST — the rung-5 fleet-wide sylvite extinction (SIM 234, bittern-window physics) is retroactively record-licensed at the scenario that once grew it. (c) TINCALCONITE TL TENSION, resolved honestly: the list licenses the SPECIES at the locality (it IS the type locality) but the rung-5 withdrawal was mechanism-based — real tincalconite is dry-air alteration of grown borax (museum-drawer chemistry), not in-brine growth, so a locality license does not overturn a nucleation-mechanism withdrawal; both records are correct at their own layer. (d) documented-unfired = the famous saline double-salt suite (trona, hanksite, gaylussite, glauberite, pirssonite, northupite, nahcolite, burkeite, sulphohalite, schairerite, galeite, tychite, aphthitalite, teepleite, natron, niter, ulexite, searlesite) — no sim engines yet; the note-1 'worth adding later' list gains mindat corroboration; also anhydrite/aragonite/dolomite/opal + the authigenic silicate tail (analcime, merlinoite, phillipsite/heulandite, K-feldspar — Hay & Moiola 1962 sediment authigenesis, a different growth regime than the vug). (e) realgar + chlorargyrite + native sulphur are valid here but trace/exotic — no vote against the sim's hypogene-free evaporite scope.
