# CLAIM CARD — sicily_solfifera  (v243, seed 42, 200 steps)

**Anchor:** Cianciana / Caltanissetta district, Agrigento province, Sicily — Solfifera Series (Messinian, 6-5.3 Ma). The canonical sedimentary BSR native-sulfur deposit. World's primary sulfur production center 1860s-1950s, when the Sicilian fields supplied ~80% of global elemental sulfur. Type for 'bacterial-mediated sedimentary sulfur' per Ziegenbalg et al. 2010.
**Deposit:** Sedimentary native sulfur associated with anaerobic microbial sulfate reduction of Messinian gypsum and hydrocarbons. This is deliberately distinct from Sulphur Bank's oxic hot-spring interface: the vug inherits a separately sourced elemental-S reservoir produced over geological time in sulfur-bearing carbonate, while in-run BSR transfers sulfate to reduced sulfur and raises carbonate alkalinity. Mineable S° crystallizes with secondary carbonates in the Solfifera Series. Co-products: calcite cement, residual selenite, and celestine from gypsum-derived Sr trace.
**Initial:** 30 °C, 0.001 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:opal5..100C+quartz100..700C-no-cosmetic-relabel-v1|sulfur-ledger:sulfide+sulfate+elemental-independent+pathway-gated-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** bbbe0ef1ec42869c9d5a099d1f0f87c8720be56ece5392b7cdd6baabf1af5bbf

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (4):** native_sulfur, calcite, selenite, celestine

**Cited sources:**
  - Ziegenbalg S.B., Brunner B., Birgel D., Voigt M., Strauss H., Peckmann J. (2010) — Formation of secondary carbonates and native sulphur in sulphate-rich Messinian strata, Sicily. Sedimentary Geology 227: 37-50.
  - Rouwendaal E.A. et al. (2025) — An Anaerobic Microbial Community Mediates Epigenetic Native Sulfur and Carbonate Formation During Replacement of Messinian Gypsum at Monte Palco, Sicily. Geobiology. doi:10.1111/gbi.70015.
  - Manzi V., Lugli S., Roveri M., Schreiber B.C. (2009) — A new facies model for the Upper Gypsum of Sicily (Italy): chronological and palaeoenvironmental constraints. Sedimentology 56: 1937-1960.
  - Garcia-Veigas J., Ortí F., Rosell L., Ayora C., Rouchy J.M., Lugli S. (1995) — The Messinian salt of the Mediterranean: geochemical study of the salt from the central Sicily basin. Bulletin Société Géologique de France 166: 699-710.
  - Decima A., Wezel F.C. (1971) — Osservazioni sulle evaporiti messiniane della Sicilia centro-meridionale. Rivista Mineraria Siciliana 22 (130-132): 172-187.
  - Aharon P. (2000) — Microbial processes and products fueled by hydrocarbons at submarine seeps. Microbial Sediments (Springer): 270-281. (Sulfur-isotope evidence for BSR in Sicilian Solfifera Series.)
  - Wikipedia — Sicilian sulfur mining (history + production figures 1860-1950).

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | native_sulfur | 0 | 1 |
| 2 | selenite | 0 | 2 |
| 3 | celestine | 4 | 1 |

**Surprises (grown but NOT in expects_species):** (none)
**No-shows (expected but never nucleated):** calcite

## Environment trajectory (first → last, [min,max])
  - T: 29.528 → 23.622 °C  [23.622, 29.528]
  - pH: 6.118 → 6.504   [6.008, 6.614]
  - Eh: -192.126 → -192.126 mV  [-192.126, -192.126]
  - salinity: 4.724 → 4.724 psu  [4.724, 4.724]
  - O2: 0.039 → 0.039 mg/L  [0.039, 0.039]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -1.638 → -0.189  [-1.638, -0.189]
  - SI_aragonite: -1.764 → -0.315  [-1.764, -0.315]
  - SI_dolomite: -3.969 → -1.449  [-3.969, -1.449]
  - SI_HMC: -2.709 → -1.323  [-2.709, -1.323]
  - SI_siderite: -1.449 → -0.315  [-1.449, -0.315]
  - SI_selenite: 0.063 → 0.441  [0.063, 0.441]
  - SI_anhydrite: -0.126 → 0.252  [-0.126, 0.252]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: 0.504 → 0.756  [0.504, 0.756]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.001 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.953 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.01 °C; initial a_w=0.997 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.001 → 0.001 kbar [0.001, 0.001], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 28.260894354712217 → 25 °C [25, 28.260894354712217], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.965038602582306,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Sicilian Solfifera Series, Cianciana / Caltanissetta. Microbial sulfate reduction of Messinian gypsum and hydrocarbons produced secondary carbonate and native sulfur under anoxic conditions. Ziegenbalg et al. (2010) establish the microbial sulfate-reduction association; Rouwendaal et al. (2025) demonstrate that molecular O₂ is not required at Monte Palco. The simulator therefore carries inherited microbial S° separately from sulfate and sulfide instead of reusing the Sulphur Bank oxic-interface mechanism.

> Engine mode: this scenario fires the BSR-near-surface peak of the v80 bimodal pH factor (peaks at 2.5 Sulphur-Bank-style and 6.0 Sicily-style). The pH = 6.0 initial condition is dead-center on the BSR peak. The engine's metal_sum ≤ 100 gate fits Sicilian fluid — Messinian marls are clean (metal_sum ≈ 25, dominated by trace Fe).

> Co-products: the simulator's calcite + selenite + celestine + aragonite engines fire under the same broth: calcite from the 600 ppm Ca + 80 ppm CO₃ supersat; selenite (gypsum) from the same Ca + 400 ppm S (sulfate fraction); celestine from the trace Sr; aragonite as the calcite polymorph at low T + appropriate Mg/Ca. This is the geologically-real Sicilian assemblage — the same minerals you'd identify in a hand specimen from Cianciana.

> Wall composition: 'limestone' — Sicily IS literally hosted in calcite/gypsum matrix. The Solfifera Series sits on the Trubi Formation (Pliocene pelagic chalk) and is interbedded with limestone marls. The wall's dissolve() releases Ca + CO₃ which models the actual gypsum/calcite matrix dissolution. reactivity = 0.5 keeps the buffer gentle so pH stays in the BSR window.
