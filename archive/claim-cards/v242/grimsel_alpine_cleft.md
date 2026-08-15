# CLAIM CARD — grimsel_alpine_cleft  (v242, seed 42, 200 steps)

**Anchor:** Grimsel Pass / central Aar massif, Bernese-Uri Alps, Switzerland — the type region of the Swiss alpine-cleft (Zerrkluft) SMOKY-QUARTZ suite (with Göscheneralp, Furka, Gotthard analogues). The granite-hosted counterpart to the amphibolite-hosted epidote cleft (tormiq_alpine_cleft); the content home for the quartz-morphology arc (sceptre / Tessin / fenster / gwindel).
**Deposit:** A Swiss Central-Alps tension fissure (Zerrkluft) in the Variscan Aar granite, opened and RE-OPENED episodically during late-Alpine collision and retrograde exhumation. A dilute (~1-3 wt% NaCl eq), OXIDIZING, CO2-bearing, near-neutral meteoric-metamorphic fluid lines the walls; smoky quartz nucleates at ~450C and grows down the retrograde path, stopping near 200C at 0.3-0.45 GPa. The crack-seal cycle is the signature: each tectonic re-opening seals (silica supply cut, growth halts) then breaches (a fresh silica-charged pulse at a now-cooler temperature), and because quartz solubility falls as the cleft cools, each breach drives a HIGHER supersaturation than the hot first-generation stem — overgrowing the tip with a wider second-generation cap (the alpine SCEPTRE). Paragenesis: adularia + chlorite coatings -> smoky quartz (the volumetric main stage) -> hematite iron-roses (the Fe3+ oxidizing marker) -> wedge titanite + apatite + pink fluorite -> late calcite. The oxidizing character (hematite, not pyrite) is the Aar redox tell, distinct from the reducing CH4 fissure zone to the north.
**Initial:** 450 °C, 4.4 kbar, wall=cleft
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** f00f4e3804ac427c224b2b37a1ac581a91e3f3b5152170a59b48e9b536e24bb5

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (7):** quartz, feldspar, titanite, hematite, fluorite, apatite, calcite

**Cited sources:**
  - Mullis, Dubessy, Poty & O'Neil 1994, Geochim. Cosmochim. Acta 58(10):2239-2267 — fissure-quartz fluid inclusions, Central Alps geotraverse
  - Mullis 1996, Schweiz. Mineral. Petrogr. Mitt. 76:159-164 — P-T-t path of quartz formation in extensional veins of the Central Alps
  - Gnos, Mullis & Bergemann 2025, Swiss J. Geosci. 118(1):12 — P-T-t of successive deformation stages, Aar Massif (the D1/D2/D3 crack-seal spine)
  - Poty 1969, PhD thesis Univ. Nancy — La croissance des cristaux de quartz dans les filons (La Gardette + Mont-Blanc; fissure quartz 350-420C)
  - Rossman 1994, Reviews in Mineralogy 29:433-467 (MSA) — the colored varieties of silica (smoky-quartz Al + irradiation color-center mechanism)
  - quartzpage.de — alpine-type fissures, quartz habits (Tessin / sceptre / gwindel), smoky quartz (careful secondary synthesis)

## Paragenetic order as grown (10 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 2 |
| 2 | feldspar | 0 | 2 |
| 3 | titanite | 0 | 3 |
| 4 | apatite | 11 | 6 |
| 5 | quartz | 32 | 3 |
| 6 | epidote | 53 | 5 |
| 7 | hematite | 89 | 1 |
| 8 | apophyllite | 164 | 1 |
| 9 | calcite | 164 | 1 |
| 10 | fluorite | 164 | 1 |

**Surprises (grown but NOT in expects_species):** albite, epidote, apophyllite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 448.819 → 200.787 °C  [200.787, 448.819]
  - pH: 7 → 8.323   [7, 8.323]
  - Eh: 289.764 → 289.764 mV  [289.764, 289.764]
  - salinity: 2.362 → 2.362 psu  [2.362, 2.362]
  - O2: 1.496 → 1.496 mg/L  [1.496, 1.496]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -2.142 → 1.134  [-2.142, 1.134]
  - SI_aragonite: -2.205 → 1.008  [-2.268, 1.008]
  - SI_dolomite: -4.346 → 1.827  [-4.472, 1.827]
  - SI_HMC: -3.843 → -0.63  [-3.906, -0.63]
  - SI_siderite: 0.189 → 4.031  [0.189, 4.031]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 4.4 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: 4.4 kbar — rock/confining pressure used by metamorphic phase fields
  - Calcite/aragonite boundary: 4.182 kbar; secure aragonite=false
  - Al2SiO5: kyanite (nominal kyanite) — Ky-And line; uncertainty propagates Pattison triple-point T and P bounds.
  - Gypsum/anhydrite pure-water boundary: 122.68 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 4.399843025 → 2.300156975 kbar [2.300156975, 4.399843025], n=200
  - Rock/confining pressure: 4.399843025 → 2.300156975 kbar [2.300156975, 4.399843025], n=200
  - Temperature: 449.9813125 → 199.5549259945899 °C [199.5549259945899, 449.9813125], n=200
  - Secure aragonite assessment: 0/200 executed steps; first={"boundary_kbar":4.181707476331343,"secure_aragonite":false}, last={"boundary_kbar":2.4297070156426375,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"kyanite":57,"unconstrained":143}; first=kyanite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Mullis, Dubessy, Poty & O'Neil 1994 (Geochim. Cosmochim. Acta 58:2239-2267) — fissure-quartz fluid inclusions along a Central-Alps geotraverse (dilute, oxidizing, H2O-CO2 epizone). Retrograde P-T-t: Mullis 1996 (Schweiz. Mineral. Petrogr. Mitt. 76:159-164) quartz forms ~450-550C cooling to ~200C at 0.3-0.45 GPa; Gnos, Mullis & Bergemann 2025 (Swiss J. Geosci. 118:12) tie the Grimsel cleft path to D1 (~450C/440MPa, ~14.6 Ma) -> D2 (~385C/325MPa) -> D3 (~330->300C/230MPa) deformation stages. Poty 1969 (PhD thesis, Univ. Nancy) measured fissure quartz at 350-420C. Citations web-verified 2026-06-19 per the cross-check discipline.

> T story = a DECLARED temperature movement (retrograde 450->200C trend, no texture, the naica v182 idiom) + thermal_pulses:false + cooling_rate:0.4 (an open feeder advects heat -> slow cooling, not random magmatic re-warm pulses). The events are the chemistry BEATS that compose with it (SiO2 sawtooth + Fe/CO3 stage pulses on different fields -> no same-field clobber).

> The SCEPTRE mechanism: sigma_quartz = SiO2 / silica_equilibrium(T), and eq(T) falls from ~1400 ppm at 450C to ~300 at 200C. A crack-seal SEAL drops SiO2 below eq (sigma<1 -> a growth HIATUS); the following BREACH re-floods fresh silica at a cooler temperature, so the same SiO2 load gives a HIGHER sigma than the hot first-generation stem -> a wider cap nucleates on the tip. Caps grow cooler than stems (the documented alpine-sceptre habit) falls straight out of the engine. Two seal/breach cycles -> two sceptre generations; verified by tools/quartz-hiatus-census.mjs.

> Wallrock: pegmatite (the granite/granitoid inert-silicate proxy — the Aar granite host; the Ca-Al-Fe-Ti-F-P arrive in the FLUID, not from wall dissolution, reactivity 0). Architecture CLEFT (W-K V0, SIM 215): the planar-lens Zerrkluft — a flat slab ~4.5-6:1 against its aperture, opposed druses on the two fissure walls — replacing the round 'pocket' stand-in (the vug-genesis census's worst-case shape lie, now closed). Pocket size class, shape_seed 1932 (the Grimsel hydroelectric era that opened the cleft tunnels to strahlers). Growth histories measured bit-identical across the re-genre (0/37 baseline drift; sceptre scan still 3 robust sceptres at seed 42).

> Calibration target: a free-grown cleft druse — cream blocky adularia + dark-green chlorite coatings, from which rise lustrous SMOKY quartz crystals (Tessin-habit prisms or smoky sceptres with wider darker caps), accented by metallic hematite iron-roses, honey-brown wedge titanite, small apatite prisms, and a late calcite lining. expects_species declared aspirationally where needed; observe seed-42 firing + the hiatus census, then tune (vugg-tune-scenario) before the quartz-morphology work (#109). Smoky quartz color + the sceptre/Tessin/fenster/gwindel morphology are the follow-on tasks #110/#109.
