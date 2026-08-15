# CLAIM CARD — supergene_oxidation  (v246, seed 42, 200 steps)

**Anchor:** Tsumeb mine, Otavi Mountain Land, Namibia. 1st-stage gossan (uppermost supergene zone). One of the most mineralogically diverse deposits ever discovered (~280 species), type locality for germanium.
**Deposit:** Cold, oxygenated supergene weathering of a Pb-Zn-Cu sulfide pipe. Pb+Mo→wulfenite, Zn+CO3→smithsonite, Zn+As→adamite, Pb+As+Cl→mimetite, Fe→goethite, Ca+SO4→selenite, Cu+CO3→malachite. The 1st-stage gossan brings the high-Pb-As-Cl uppermost zone with mimetite, anglesite, cerussite, willemite, and Ge-bearing oxidation phases.
**Initial:** 35 °C, 0.05 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-pressure+booked-transition+chemistry-competition-v4|surface-growth:mass-booked-area+lining+crust+asbestos+druse-representatives-v1|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 9d1ee77e853827347c6c852ad8c8bc5e770f1aa4bb6e0d2c6bc1be93f2f908ea

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (11):** wulfenite, smithsonite, adamite, mimetite, malachite, vanadinite, cerussite, selenite, conichalcite, pharmacolite, haidingerite

**Cited sources:**
  - Pinch & Wilson 1977 — canonical Tsumeb monograph
  - Lombaard et al. 1986 — Tsumeb geology
  - Melcher 2003 — Tsumeb Ge geochemistry
  - Seo et al. 2012 — Pb+Mo simultaneous weathering for wulfenite formation
  - Hemley et al. 1969 — alunite stability + Al solubility under acid-sulfate conditions
  - Stoffregen et al. 2000 — alunite-jarosite paragenesis review
  - Strunz 1959 — Tsumeb deep oxidation zone scheelite + lead-tungstate suite (raspite + stolzite)
  - Bowell 2014, Rev. Mineral. Geochem. 79:589 — Tsumeb hydrogeochemistry + arsenate mineral stability (the acid-front movement)
  - Singer & Stumm 1970, Science 167:1121 — Fe(II)→Fe(III) as the rate-determining step of sulfide-oxidation acid generation
  - Skarpelis 2009, Resource Geology 59(1) — Lavrion Pb-Ag-Zn supergene oxidation profile (carbonate-hosted analogue)

## Paragenetic order as grown (34 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | adamite | 0 | 1 |
| 2 | anglesite | 0 | 8 |
| 3 | cerussite | 0 | 4 |
| 4 | duftite | 0 | 2 |
| 5 | goethite | 0 | 1 |
| 6 | malachite | 0 | 1 |
| 7 | mimetite | 0 | 1 |
| 8 | wulfenite | 0 | 1 |
| 9 | conichalcite | 1 | 4 |
| 10 | pharmacolite | 1 | 5 |
| 11 | stolzite | 1 | 4 |
| 12 | brochantite | 2 | 5 |
| 13 | ferrimolybdite | 3 | 6 |
| 14 | koettigite | 3 | 2 |
| 15 | jarosite | 4 | 1 |
| 16 | scorodite | 7 | 9 |
| 17 | powellite | 12 | 4 |
| 18 | smithsonite | 12 | 1 |
| 19 | alunite | 15 | 1 |
| 20 | azurite | 17 | 4 |
| 21 | lepidocrocite | 19 | 2 |
| 22 | aurichalcite | 23 | 4 |
| 23 | chalcocite | 54 | 4 |
| 24 | covellite | 54 | 5 |
| 25 | cuprite | 54 | 1 |
| 26 | olivenite | 74 | 4 |
| 27 | raspite | 83 | 4 |
| 28 | annabergite | 94 | 1 |
| 29 | erythrite | 94 | 1 |
| 30 | plumbogummite | 114 | 3 |
| 31 | pyromorphite | 114 | 6 |
| 32 | vanadinite | 129 | 6 |
| 33 | descloizite | 138 | 4 |
| 34 | rhodochrosite | 199 | 1 |

**Surprises (grown but NOT in expects_species):** anglesite, duftite, goethite, stolzite, brochantite, ferrimolybdite, koettigite, jarosite, scorodite, powellite, alunite, azurite, lepidocrocite, aurichalcite, chalcocite, covellite, cuprite, olivenite, raspite, annabergite, erythrite, plumbogummite, pyromorphite, descloizite, rhodochrosite
**No-shows (expected but never nucleated):** selenite, haidingerite

## Environment trajectory (first → last, [min,max])
  - T: 32.48 → 23.622 °C  [23.622, 47.244]
  - pH: 6.78 → 5.126   [4.685, 6.89]
  - Eh: 322.835 → 171.654 mV  [129.134, 355.906]
  - salinity: 2.362 → 2.362 psu  [2.362, 2.362]
  - O2: 1.811 → 0.748 mg/L  [0.591, 2.205]
  - concentration: 0.984 → 2.992 ×  [0.984, 2.992]

## Saturation drivers
  - SI_calcite: -0.882 → -2.205  [-4.472, -0.252]
  - SI_aragonite: -1.008 → -2.331  [-4.598, -0.378]
  - SI_dolomite: -2.709 → -4.346  [-8, -0.756]
  - SI_HMC: -2.016 → -3.213  [-5.543, -1.318]
  - SI_siderite: 0.945 → -0.819  [-2.709, 1.386]
  - SI_selenite: -1.449 → -0.63  [-1.449, -0.63]
  - SI_anhydrite: -1.638 → -0.882  [-1.638, -0.882]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.05 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.917 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.73 °C; initial a_w=0.999 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.05 → 0.05 kbar [0.05, 0.05], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 33.26089435471222 → 25 °C [25, 48.604498732602224], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.929457217227437,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Tsumeb mine (Otavi Mountain Land, Namibia). Pipe-shaped Pb-Zn-Cu sulfide body in Neoproterozoic dolomite, with three distinct supergene oxidation zones developed during Mesozoic-Cenozoic uplift. Argentiferous (native Ag, proustite, pyrargyrite, argentiferous galena). References: Pinch & Wilson 1977 (canonical Tsumeb monograph), Lombaard et al. 1986 (geology), Melcher 2003 (Ge geochemistry).

> Acid-window mechanic (steps 5-16): the supergene_acidification handler fires FOUR times (steps 5/8/12/16) to hold pH near 4 against the limestone wall's carbonate buffering. Without the repeated pulses, the buffer neutralizes pH back to 6+ within ~5 steps. The 15-step acid window is when scorodite + jarosite + alunite nucleate. ev_meteoric_flush at step 20 ends the acid phase.

> Chemistry-audit gap-fill pass (Apr 2026): added Ag (Tsumeb's silver suite), Ge (the type-locality element), Sb (proustite-pyrargyrite + tetrahedrite enabling), Na/K (minor groundwater cation traces), Au=0.3 (sub-threshold trace, no nucleation). v5 gap-fills: Al=25 (alunite enabling per Hemley 1969 + Stoffregen 2000), W=20 (Round 8d-1, Tsumeb deep-zone scheelite + raspite + stolzite per Strunz 1959). Existing 8-event sequence preserved untouched.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Tsumeb Mine (Ongopolo), Oshikoto Region, Namibia; the sweep's GIANT: hundreds of valid species, ~70+ type localities (TL) — too large to transcribe; the record below is the SIM-VERDICT TABLE, i.e. every seed-42 v236 species checked against the captures. CAVEAT: screenshot-limited — a 'not visible' flag means verify on the live page before any kill. Conventions from this page: struck-through = mindat-erroneous (here the Co-bearing + Cu-bearing ADAMITE VARIETIES are struck — adamite the species stays valid); italic-? = questioned (Patrónite?, Richardsite?, Stibnite?, Idaite?, 'Tetrahedrite Subgroup'?) — questioned ≠ license. LICENSED ✓ (28/36 sim species visible on the list): adamite, anglesite, aurichalcite, azurite, brochantite, caledonite, cerussite, chalcocite, conichalcite, covellite, cuprite, duftite (TL), goethite, gypsum→SELENITE (the 151 mm giant is record-licensed — selenite census now reads elmwood NO / picher YES / sweetwater NO / TSUMEB YES), jarosite, köttigite, lepidocrocite, malachite, mimetite, olivenite (+ Zn-bearing var.), plumbogummite (+ Ga-rich var.), powellite, pyromorphite, quartz, scorodite, smithsonite, stolzite, vanadinite, wulfenite (+ var. chillagite). NOT VISIBLE IN CAPTURE — flags, live-page check before acting: the ARSENATE-BLOOM pair erythrite ×7 + annabergite ×4 (heterogenite IS listed, so Co is real here — but the blooms are absent from the visible A/E blocks), the Ca-arsenates haidingerite ×4 + pharmacolite ×2 (BOTH in expects_species!), ferrimolybdite ×6 @17.5 mm (molybdenite listed, its oxidation product not visible), raspite ×1 (stolzite listed; raspite carries the Strunz 1959 deep-zone citation in the note above — literature vs list tension, adjudicate), alunite ×1 (2 µm dust). LICENSED-BUT-UNFIRED candidates the sim already has engines/history for: descloizite + mottramite (both listed — the rung-4b fork pair), willemite (listed! extinct at mvt/tn457 by rung 4a but Tsumeb documents it — a legit future tenant HERE), dioptase, rosasite, hemimorphite, hydrozincite, wurtzite, witherite, greenockite, native copper/silver/gold, azurite-suite depth. The 'Mineral GS1 (of Gebhard)' curiosity noted for the boss.
