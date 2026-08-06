# CLAIM CARD — tormiq_alpine_cleft  (v238, seed 42, 200 steps)

**Anchor:** Tormiq Valley, Haramosh Mts., Roundu/Skardu District, Gilgit-Baltistan, Pakistan — the world's premier ALPINE-CLEFT epidote locality (Anthony et al. Handbook of Mineralogy 2001 names Tormiq type-quality, rivaling Knappenwand, Austria). The anchor scenario for epidote (added v196).
**Deposit:** A Himalayan alpine-type cleft: fractures opened by Main Karakoram Thrust activity in AMPHIBOLITE / metabasite, then filled by a LOW-SALINITY, OXIDIZED, meteoric-metamorphic fluid in brittle channelized flow (<450°C, cooling to <200°C). The oxidized character is load-bearing — it keeps iron FERRIC, so the cleft grows lustrous pistachio-green EPIDOTE (the Fe³⁺ phase) rather than Fe-poor clinozoisite, with the doubly-terminated 'Tormiq sword' habit in the open fissure. Paragenesis: quartz lining → Ti-Fe oxides → the epidote main stage → byssolite (fibrous actinolite) sprays → adularia (K-feldspar) → late calcite. NOT a pegmatite (the region's other deposit type) — no tourmaline/beryl/spodumene; this is the metamorphic-fissure Ca-Al-Fe³⁺ assemblage.
**Initial:** 420 °C, 4 kbar, wall=cleft
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1
**Scenario spec hash:** 67ad31564a7715eb085869d7e7f517fd25dbdd7fa35a13d3bd6c7df989ab7cbc

**expects_species (5):** epidote, actinolite, quartz, feldspar, albite

**Cited sources:**
  - Anthony, Bideaux, Bladh & Nichols 2001, Handbook of Mineralogy (epidote sheet — names Tormiq, Pakistan as type-quality)
  - Deer, Howie & Zussman 1986, Rock-Forming Minerals 2nd ed. v.1B, pp.44-134 (epidote group)
  - Liebscher A. & Franz G. eds. 2004, Reviews in Mineralogy & Geochemistry v.56 Epidotes (MSA)
  - Mullis J. 1994, Geochim. Cosmochim. Acta 58:2239 — alpine fissure quartz fluid inclusions (low-salinity, oxidized, meteoric)
  - Bergemann C. et al. 2017, Swiss J. Geosci. — alpine fissure formation episodes (T/fluid regime)
  - Holdaway M.J. 1972, Contrib. Mineral. Petrol. 37:307; Liou J.G. 1973, J. Petrol. 14:381 — epidote stability vs fO2 (why oxidized = Fe³⁺ green epidote)
  - mindat locality 5734 — Tormiq Valley geology (Main Karakoram Thrust clefts in amphibolite)

## Paragenetic order as grown (6 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | epidote | 0 | 5 |
| 3 | feldspar | 0 | 2 |
| 4 | titanite | 0 | 3 |
| 5 | quartz | 24 | 3 |
| 6 | actinolite | 109 | 3 |

**Surprises (grown but NOT in expects_species):** titanite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 419.291 → 369.094 °C  [212.598, 419.291]
  - pH: 7 → 6.614   [6.118, 7]
  - Eh: 289.764 → 289.764 mV  [289.764, 289.764]
  - salinity: 3.15 → 3.15 psu  [3.15, 3.15]
  - O2: 1.496 → 1.496 mg/L  [1.496, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -1.575 → -1.89  [-3.15, -1.071]
  - SI_aragonite: -1.701 → -2.016  [-3.213, -1.197]
  - SI_dolomite: -3.402 → -3.78  [-6.551, -2.394]
  - SI_HMC: -3.339 → -3.591  [-4.913, -2.835]
  - SI_siderite: 0.378 → 0.504  [-0.882, 1.071]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 4 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.813 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 116.80 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Stress/overprint step 188: tormiq_late_shear — authored visual deformation overprint

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 4 → 4 kbar [4, 4], n=200
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=200
  - Temperature: 418.2608943547122 → 369.26494499640523 °C [211.28775661024255, 418.2608943547122], n=200
  - Secure aragonite assessment: 67/200 executed steps; first={"boundary_kbar":3.793290544902517,"secure_aragonite":false}, last={"boundary_kbar":3.288249111111645,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":12,"unconstrained":188}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Anthony, Bideaux, Bladh & Nichols 2001, Handbook of Mineralogy (epidote sheet), which names Tormiq, Pakistan as a type-quality locality. Geology per mindat loc-5734: Tormiq lower valley = granite + amphibolite + ultramafic, central/upper = metasedimentary + metavolcanic; the epidote clefts are tied to the amphibolite/metabasite (the Ca-Al-Fe³⁺ source). Tectonic driver = Main Karakoram Thrust fracturing near the Nanga Parbat-Haramosh massif. Sub-localities Alchuri + Hashupa (Shigar) share the model.

> Fluid: alpine-cleft fissures carry a LOW-SALINITY (~1-3 wt% NaCl eq), OXIDIZED, meteoric-metamorphic fluid in brittle channelized flow at <450°C, retrograde to <200°C (Central-Alps analogue; Mullis 1994 GCA 58:2239 fluid inclusions; Bergemann et al. 2017 Swiss J. Geosci. fissure formation episodes). No published Tormiq fluid-inclusion ppm dataset exists — the broth is an order-of-magnitude design target inferred from alpine-cleft fluid character + epidote stoichiometry, to be calibrated against seed-42 per the tune-scenario loop.

> Engine fit: epidote's discriminator is REDOX (engine v196) — it gates on oxideRedoxAvailable O2>=0.5 on top of Ca/Al/Fe/Si + T 200-450. This broth holds O2 ~1.5 (strongly oxidizing → Fe³⁺ → deep pistachio green) across the run, with an Fe³⁺ pulse at the epidote_main stage. The cooling sweep (420→170°C via the event handlers) carries the fluid through epidote's 250-400 sweet spot for most of the run. byssolite = the actinolite engine (Mg+Fe+Ca+Si, no redox gate); adularia = feldspar (K+Al+Si); the cleft lining = quartz; late = calcite. Titanite, clinozoisite, and zoisite (true Tormiq associates) are not yet in the catalog — magnetite stands in for the Ti-Fe oxide stage; feldspar for adularia; actinolite for byssolite.

> Wallrock: 'basalt' composition as the amphibolite proxy (inert silicate — amphibolite is metamorphosed basalt; the Ca-Al-Fe³⁺ arrives in the FLUID, not from wall dissolution). Architecture CLEFT (W-K V0, SIM 215): the planar-lens Zerrkluft shape — opposed footwall/hangingwall druses, thin rim — replacing the round 'pocket' the scenario wore before the vug-genesis arc. Pocket size class, shape_seed 1990 (the decade Tormiq epidote reached the international market). Growth histories measured bit-identical across the re-genre (0/37 baseline drift), so the seed-42 census below still stands.

> Calibration target: the hand specimen is a lustrous dark-pistachio-green doubly-terminated epidote prism (or a divergent spray on byssolite) perched on a quartz-lined cleft wall, sometimes with adularia + calcite. Epidote IS the star. MEASURED at seed 42 (v227: 18 crystals, 6 species): epidote 5 (the most abundant — capped at max_nucleation 5), actinolite/byssolite 3, quartz 3, titanite 3, albite 2, adularia/feldspar 2. This is a textbook alpine-cleft suite — epidote + byssolite + adularia + albite + quartz are all genuine Tormiq/alpine-fissure associates. CALCITE is aspirational (the late_calcite event raises CO3 but calcite did not nucleate in the final ~30 steps at seed 42) — a vugg-tune-scenario follow-up candidate (bump late CO3 / extend the cooling tail), not shipped as a false expects entry.

> Fluorite de-confabulation (v227, hostile review 2026-07-14 — the mvt-silver precedent at a new locality): this scenario's original notes called 'pink fluorite' a genuine Tormiq associate and expects_species promised it. No source supports that: the documented Tormiq suite (mindat loc-5734) is epidote, clinozoisite, quartz, titanite, apatite, calcite, diopside, ilmenite, byssolite — NO fluorite; Pakistan's famous pink fluorite belongs to the GRANITE/PEGMATITE-hosted pockets (Chumar Bakhoor, Nagar) and the regional fluorite to the Stak Nala pegmatites, while an amphibolite host carries no F reservoir to leach (the Knappenwand archetype holds its fluorine only as trace fluorapatite). The seed-42 fluorite rode the leaked FluidChemistry F=10 default (rung-1 census, PROPOSAL-HOSTILE-REVIEW-2026-07-14.md); broth F is now the researched 3 and the expects_species promise is withdrawn — the expectation, not the engine, was the error.
