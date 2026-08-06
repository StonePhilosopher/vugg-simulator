# CLAIM CARD — sicily_solfifera  (v239, seed 42, 200 steps)

**Anchor:** Cianciana / Caltanissetta district, Agrigento province, Sicily — Solfifera Series (Messinian, 6-5.3 Ma). The canonical sedimentary BSR native-sulfur deposit. World's primary sulfur production center 1860s-1950s, when the Sicilian fields supplied ~80% of global elemental sulfur. Type for 'bacterial-mediated sedimentary sulfur' per Ziegenbalg et al. 2010.
**Deposit:** Sedimentary native sulfur from bacterial sulfate reduction of Messinian gypsum + Pleistocene meteoric O₂ infiltration. The OTHER half of the native_sulfur story (Sulphur Bank = acid-sulfate hot-spring; Sicily = alkaline-buffered BSR-near-surface). Mineable S° crystallizes in the upper few meters of the Solfifera Series, the gypsum-marl-sulfur sequence deposited during the Mediterranean salinity crisis. Co-products: calcite cement from the BSR-generated H₂CO₃, residual selenite (Messinian gypsum), celestine from gypsum-derived Sr trace, sometimes aragonite.
**Initial:** 30 °C, 0.5 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** 3a2a33bb61a4cac07c1f9ea9ec98e69cc732e602f7e70227e53aad2e20d34dea

**expects_species (4):** native_sulfur, calcite, selenite, celestine

**Cited sources:**
  - Ziegenbalg S.B., Brunner B., Birgel D., Voigt M., Strauss H., Peckmann J. (2010) — Formation of secondary carbonates and native sulphur in sulphate-rich Messinian strata, Sicily. Sedimentary Geology 227: 37-50.
  - Manzi V., Lugli S., Roveri M., Schreiber B.C. (2009) — A new facies model for the Upper Gypsum of Sicily (Italy): chronological and palaeoenvironmental constraints. Sedimentology 56: 1937-1960.
  - Garcia-Veigas J., Ortí F., Rosell L., Ayora C., Rouchy J.M., Lugli S. (1995) — The Messinian salt of the Mediterranean: geochemical study of the salt from the central Sicily basin. Bulletin Société Géologique de France 166: 699-710.
  - Decima A., Wezel F.C. (1971) — Osservazioni sulle evaporiti messiniane della Sicilia centro-meridionale. Rivista Mineraria Siciliana 22 (130-132): 172-187.
  - Aharon P. (2000) — Microbial processes and products fueled by hydrocarbons at submarine seeps. Microbial Sediments (Springer): 270-281. (Sulfur-isotope evidence for BSR in Sicilian Solfifera Series.)
  - Wikipedia — Sicilian sulfur mining (history + production figures 1860-1950).

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | native_sulfur | 0 | 3 |
| 2 | selenite | 0 | 2 |
| 3 | celestine | 4 | 3 |

**Surprises (grown but NOT in expects_species):** (none)
**No-shows (expected but never nucleated):** calcite

## Environment trajectory (first → last, [min,max])
  - T: 29.528 → 23.622 °C  [23.622, 29.528]
  - pH: 6.118 → 6.504   [6.008, 6.614]
  - Eh: 77.165 → 86.614 mV  [77.165, 86.614]
  - salinity: 4.724 → 4.724 psu  [4.724, 4.724]
  - O2: 0.394 → 0.433 mg/L  [0.394, 0.433]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -1.638 → -0.504  [-1.638, -0.504]
  - SI_aragonite: -1.764 → -0.63  [-1.764, -0.63]
  - SI_dolomite: -3.969 → -2.016  [-3.969, -2.016]
  - SI_HMC: -2.772 → -1.638  [-2.772, -1.638]
  - SI_siderite: -1.449 → -0.63  [-1.512, -0.63]
  - SI_selenite: 0.063 → 0.567  [0.063, 0.567]
  - SI_anhydrite: -0.126 → 0.378  [-0.189, 0.378]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: 0.441 → 0.882  [0.441, 0.882]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.953 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.997 ±0.010 (calibrated-proxy)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 28.260894354712217 → 25 °C [25, 28.260894354712217], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.965038602582306,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Sicilian Solfifera Series, Cianciana / Caltanissetta. The Messinian salinity crisis (6-5.3 Ma) precipitated a thick gypsum + halite + marl sequence in the central Sicilian basin (Decima & Wezel 1971; Manzi et al. 2009). Bacterial sulfate reduction at depth, fueled by organic-C burial, converted gypsum sulfate to H₂S + CaCO₃ over millions of years (Ziegenbalg et al. 2010 — sedimentary geology evidence; Aharon 2000 — isotope record). Pleistocene meteoric water infiltrated the upper meters, bringing dissolved O₂. The H₂S met O₂ in the upper oxidation zone and precipitated as native S° via synproportionation. Cianciana alone produced ~2 Mt of sulfur 1840-1950.

> Engine mode: this scenario fires the BSR-near-surface peak of the v80 bimodal pH factor (peaks at 2.5 Sulphur-Bank-style and 6.0 Sicily-style). The pH = 6.0 initial condition is dead-center on the BSR peak. The engine's metal_sum ≤ 100 gate fits Sicilian fluid — Messinian marls are clean (metal_sum ≈ 25, dominated by trace Fe).

> Co-products: the simulator's calcite + selenite + celestine + aragonite engines fire under the same broth: calcite from the 600 ppm Ca + 80 ppm CO₃ supersat; selenite (gypsum) from the same Ca + 400 ppm S (sulfate fraction); celestine from the trace Sr; aragonite as the calcite polymorph at low T + appropriate Mg/Ca. This is the geologically-real Sicilian assemblage — the same minerals you'd identify in a hand specimen from Cianciana.

> Wall composition: 'limestone' — Sicily IS literally hosted in calcite/gypsum matrix. The Solfifera Series sits on the Trubi Formation (Pliocene pelagic chalk) and is interbedded with limestone marls. The wall's dissolve() releases Ca + CO₃ which models the actual gypsum/calcite matrix dissolution. reactivity = 0.5 keeps the buffer gentle so pH stays in the BSR window.
