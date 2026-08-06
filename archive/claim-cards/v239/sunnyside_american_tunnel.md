# CLAIM CARD — sunnyside_american_tunnel  (v239, seed 42, 200 steps)

**Anchor:** Sunnyside Mine / American Tunnel, Silverton caldera, San Juan County, Colorado. Intermediate-sulfidation polymetallic epithermal vein deposit hosted in the Crystal Lake Tuff (27.5 Ma San Juan ignimbrite). The American Tunnel (driven 1959, plugged 2003) was the principal modern source of Silverton-district display rhodochrosite + octahedral REE-fluorite + manganocalcite specimens. Per Casadevall & Ohmoto 1977 Econ. Geol. 72:1285 six-stage paragenesis (compressed to four stages here).
**Deposit:** Late-stage carbonate-fluoride paragenesis at the Sunnyside-American Tunnel vein system. The scenario runs primary sulfide-Au-quartz (Casadevall Stages I-IV at 280-260°C) → Stage V Mn-carbonate (pale-pink small rhodochrosite at 215-245°C, Fe-poor signature) → Stage VI early fluoride pulse (octahedral REE-fluorite at 195-230°C with grass-green visible color + brilliant blue SW UV from Eu²⁺ activator per Bosze & Rakovan 2002 GCA 66:997) → Stage VI late manganocalcite cap (cauliflower botryoidal Mn²⁺-bright-fluorescing calcite at 175-200°C). The REE source is leaching of devitrified ignimbrite glass from the Carpenter Ridge Tuff host per Bachmann et al. 2014 — Eu²⁺ from feldspar at residence T, Y³⁺ general. Headline specimens: pale-pink rhodochrosite + manganocalcite cabinet pieces; octahedral REE-fluorite (~1-2 cm, sometimes with rhodochrosite + manganocalcite associates); native gold in milky quartz from the primary Stage IV ore. Many of these specimens carry dealer labels reading 'Standard Mine, Silverton' — but the only documented Standard Mine in Colorado is in Gunnison County (Ruby District, EPA Superfund, ~80 mi NE, different deposit). The 'Standard Mine, Silverton' label is dealer-conflation; the actual source is American Tunnel material from the 1959-1991 production window.
**Initial:** 280 °C, 0.5 kbar, wall=pocket
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:accepted-zone-stoich-ledger-v3|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-supplement-v1|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1
**Scenario spec hash:** 764372cddeb34b947b7dc938be5151405091c82c64d372567b08022cf59447aa

**expects_species (9):** pyrite, galena, sphalerite, chalcopyrite, quartz, rhodochrosite, fluorite, calcite, native_gold

**Cited sources:**
  - Burbank W.S. & Luedke R.G. (1968) — Geology and Ore Deposits of the Eureka and Adjoining Districts, San Juan Mountains, Colorado. USGS Professional Paper 535.
  - Casadevall T. & Ohmoto H. (1977) — Sunnyside Mine, Eureka mining district, San Juan County, Colorado; geochemistry of gold and base metal ore deposition in a volcanic environment. Economic Geology 72: 1285-1320. DOI 10.2113/gsecongeo.72.7.1285.
  - Burbank W.S. (1933) — Geology and Ore Deposits of the South Silverton Mining Area, San Juan County, Colorado. USGS Professional Paper 378-A.
  - Bachmann O. et al. (2014) — Building zoned ignimbrites by recycling silicic cumulates: insight from the Carpenter Ridge Tuff, CO. Contrib. Min. Pet. 167: 1025. DOI 10.1007/s00410-014-1025-3. (REE/Eu source rock for the Y³⁺/Eu²⁺ leached during the Stage VI fluoride pulse.)
  - Bosze S. & Rakovan J. (2002) — Surface-structure-controlled sectoral zoning of REE in fluorite from Long Lake NY and Bingham NM. Geochim. Cosmochim. Acta 66: 997-1009. DOI 10.1016/S0016-7037(01)00822-5. (Octahedral fluorite habit mechanism; Y³⁺ partition coefficient 1.4-3.5x into {111} vs {100}.)
  - Naumov V.A. & Naumova S.S. (1980) — Optical spectra of rare-earth-bearing fluorites. (Russian literature; original yttrofluorite green color-mechanism description.)
  - Pierce M.L. (1990) — Color centers and rare-earth substitution in Pikes Peak fluorite. (HREE-cluster green color mechanism distinct from F-center blue.)
  - Bill H. & Calas G. (1978) — Color centers, associated rare-earth ions and the origin of coloration in natural fluorites. Phys. Chem. Min. 3: 117-131. (F-center photobleaching kinetics; SW UV REE fluorescence bleach-stability.)
  - Pohl W.L. (2011) — Economic Geology of Mineral Deposits. Schweizerbart. (Manganocalcite paragenesis + Mn²⁺ activator fluorescence brightness.)
  - Research dossier 2026-05-19 — internal research-agent compilation anchoring the scenario broth on Casadevall fluid-inclusion data + Bachmann REE-source-rock budget + boss specimen calibration targets.

## Paragenetic order as grown (15 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | argentite | 0 | 4 |
| 2 | galena | 0 | 4 |
| 3 | sphalerite | 0 | 1 |
| 4 | tennantite | 0 | 1 |
| 5 | tetrahedrite | 0 | 1 |
| 6 | proustite | 6 | 2 |
| 7 | rhodochrosite | 20 | 1 |
| 8 | quartz | 49 | 3 |
| 9 | albite | 74 | 1 |
| 10 | siderite | 74 | 1 |
| 11 | arsenopyrite | 83 | 4 |
| 12 | fluorite | 109 | 1 |
| 13 | pyrite | 111 | 1 |
| 14 | realgar | 149 | 1 |
| 15 | titanite | 171 | 1 |

**Surprises (grown but NOT in expects_species):** argentite, tennantite, tetrahedrite, proustite, albite, siderite, arsenopyrite, realgar, titanite
**No-shows (expected but never nucleated):** chalcopyrite, calcite, native_gold

## Environment trajectory (first → last, [min,max])
  - T: 277.559 → 248.031 °C  [150.591, 277.559]
  - pH: 4.575 → 6.614   [4.575, 6.669]
  - Eh: -149.606 → -45.669 mV  [-149.606, -45.669]
  - salinity: 4.724 → 2.362 psu  [2.362, 4.724]
  - O2: 0.039 → 0.118 mg/L  [0.039, 0.118]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -6.74 → -2.268  [-6.74, -0.504]
  - SI_aragonite: -6.866 → -2.331  [-6.866, -0.567]
  - SI_dolomite: -8 → -4.78  [-8, -1.89]
  - SI_HMC: -8 → -4.031  [-8, -2.268]
  - SI_siderite: -4.913 → 0.189  [-4.913, 1.323]
  - SI_selenite: -0.504 → -0.693  [-0.696, -0.504]
  - SI_anhydrite: -0.189 → -0.381  [-0.567, -0.189]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.664 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 65.35 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.5 → 0.5 kbar [0.5, 0.5], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 278.2608943547122 → 248.57323318193664 °C [150.03542106919926, 278.2608943547122], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":2.655969334838852,"secure_aragonite":false}, last={"boundary_kbar":2.535698116022769,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":200}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Sunnyside Mine / American Tunnel, Silverton caldera, San Juan County, Colorado. The Silverton caldera nests inside the older San Juan caldera, both in the Oligocene San Juan Volcanic Field. Crystal Lake Tuff erupted at 27.5 Ma collapsing the Silverton caldera; resurgent doming reopened the ring-fracture system; mineralization peaked ~22.5 Ma (Lake City caldera granite porphyry intrusion). Two K-Ar sericite events bracket the hydrothermal history at 22.5 Ma (district-wide propylitic) and 21 Ma (focused sericite). References: Burbank & Luedke 1968 USGS PP 535 (canonical district geology); Casadevall & Ohmoto 1977 Econ. Geol. 72:1285 (the six-stage Sunnyside paragenesis + fluid inclusion data).

> Labeling note (CORRECTED v106 2026-05-20): specimens labeled 'Standard Mine, Silverton' refer to Sunnyside mine material from the Standard Metals Corporation lease period (1959-1978). Standard Metals leased Sunnyside in 1959, drove the American Tunnel from the Gold King portal at Gladstone, and operated until the June 4 1978 Lake Emma disaster (surface lake drained into upper workings; mine flooded; lease ended). The label is accurate to a 19-year production window and identifies the operator — the '[Operator] Mine' convention is well-attested (Hecla Mine for Sunshine material, Anaconda Mine for various Butte properties, etc.). The v105 commit originally described this as 'dealer-conflation' with the unrelated Standard Mine in Gunnison County (Ruby District near Crested Butte) — that interpretation was wrong; corrected here. The Silverton-Standard label is its own legitimate provenance anchor referencing Standard Metals' tenure. Casadevall & Ohmoto 1977 Econ. Geol. 72:1285, the canonical Sunnyside paragenesis paper, studied Standard-Metals-era ore (the paper precedes the 1978 disaster by one year), so the simulator's science anchor and the boss's specimens come from the same operating window.

> Six-stage compressed to four: Casadevall & Ohmoto 1977 documented six paragenetic stages (I pyrite-quartz, II banded quartz-sulfide, III massive galena-sphalerite-chalcopyrite-bornite-hematite, IV Au-Te-quartz, V Mn ores rhodochrosite-rich, VI quartz-fluorite-carbonate-sulfate). Stages I-IV are compressed into a single primary-ore phase in this scenario (steps 1-30) because the simulator's nucleation cap doesn't reward fine-grained sequencing of the primary sulfides. Stages V and VI map directly to the late-stage carbonate + fluoride pulses (steps 30-185).

> Engine fit (v103 + v104 infra commits): the Y fluid field (added v103) drives the REE-octahedral fluorite habit per Bosze & Rakovan 2002. The manganocalcite branch (v103) fires when Mn>5 + Fe<2 + low supersaturation; bright Mn²⁺ SW UV fluorescence note (graduated v103). The v104 fluorite color correction makes Y-rich fluorite display grass-green (yttrofluorite character per Naumov & Naumova 1980 + Pierce 1990 Pikes Peak HREE-fluorite mechanism), not blue (blue is the LOW-Y F-center mechanism). The boss's Silverton specimens (pale-blue-with-green-tint in white light, brilliant blue under SW UV) are photobleached display material — original was richer green, fluorescence preserved.

> Wallrock: 'basalt' proxy for the Crystal Lake Tuff silicate ignimbrite host. Reactivity 0.0 keeps the wall inert (the San Juan tuffs are crystalline silicate, not carbonate-buffered) — late-stage neutralization comes from CO₂ degassing of the cooling fluid, not from wallrock dissolution. Vug diameter 50 mm matches typical American Tunnel cabinet-pocket scale (boss's specimens range thumbnail to small miniature). Architecture 'pocket' for the vein-bounded cavity. Shape_seed 1959 (the year the American Tunnel was driven from the Gold King portal at Gladstone).

> Boss specimen calibration: 15 rhodochrosites from Silverton (most pale-pink, small ~3-10 mm rhombs); two with fluorite; one with calcite manganocalcite cap; the fluorites pale-blue-with-green-tint visible (probably photobleached from original richer green); SW UV brilliant blue fluorescence on fluorite (Eu²⁺/Y³⁺ activator); brilliant salmon fluorescence on manganocalcite (Mn²⁺ activator, 'much brighter than most' per boss observation). Plus a native gold in quartz from the primary ore phase. The scenario aims to reproduce this assemblage at seed 42.
