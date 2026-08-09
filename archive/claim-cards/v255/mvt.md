# CLAIM CARD — mvt  (v255, seed 42, 120 steps)

**Anchor:** Tri-State district (Joplin / Picher / Galena MO-KS-OK) — Pb-Zn in Mississippian Boone Formation cherty limestone
**Deposit:** Mississippi Valley-type Pb-Zn deposit. NaCl-CaCl2 basinal brine, sphalerite + galena + barite + fluorite paragenesis.
**Initial:** 180 °C, 0.3 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 89a09a533cc8a0310803590948ed092c50d9496688b7d94918711ae9dc03e556

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (5):** sphalerite, galena, fluorite, barite, calcite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Roedder 1976 — Tri-State fluid-inclusion microthermometry
  - Ohle 1959 — Tri-State district geology
  - Hagni 1976 — Tri-State paragenesis
  - Stoffell et al. 2008 — LA-ICP-MS fluid-inclusion brine analyses
  - Anderson & Macqueen 1982 — MVT mineralogy review
  - Schwartz 2000 (Econ. Geol. 95) — Cd in MVT sphalerite
  - Hanor 1994 — basinal-brine compendium (Sr/Ba tracers)

## Paragenetic order as grown (12 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | calcite | 1 | 1 | 0 | nucleation |
| 2 | rhodochrosite | 1 | 1 | 0 | nucleation |
| 3 | siderite | 1 | 1 | 0 | nucleation |
| 4 | fluorite | 20 | 1 | 0 | nucleation |
| 5 | galena | 20 | 4 | 0 | nucleation |
| 6 | pyrite | 20 | 1 | 0 | nucleation |
| 7 | sphalerite | 20 | 1 | 0 | nucleation |
| 8 | barite | 21 | 6 | 0 | nucleation |
| 9 | greenockite | 22 | 5 | 0 | nucleation |
| 10 | celestine | 23 | 2 | 0 | nucleation |
| 11 | quartz | 28 | 3 | 0 | nucleation |
| 12 | hawleyite | 45 | 1 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** rhodochrosite, siderite, pyrite, greenockite, celestine, quartz, hawleyite
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 178.2608943547122 → 137.43649824522439 °C  [90.49107971857299, 178.2608943547122] (raw_simulation_state)
  - pH: 7.2 → 6.633286356183933   [6.174134203569265, 7.2] (raw_simulation_state)
  - Eh: 40.28940581998064 → -230.40917574741053 mV  [-246.20234885448465, 59.70497947810308] (raw_simulation_state)
  - salinity: 15 → 15 psu  [15, 15] (raw_simulation_state)
  - O2: 0.2891729219067179 → 0.007868795207043642 mg/L  [0.005469863786785064, 0.34579596230104137] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 0.378 → 0  [-1.197, 1.008]
  - SI_aragonite: 0.315 → -0.126  [-1.323, 0.945]
  - SI_dolomite: 0.252 → -0.945  [-3.15, 0.756]
  - SI_HMC: 0.441 → 0  [-1.197, 0.945]
  - SI_siderite: 1.575 → 2.016  [0.945, 2.142]
  - SI_selenite: -8 → -1.449  [-8, -0.882]
  - SI_anhydrite: -8 → -1.575  [-8, -1.008]
  - SI_barite: -8 → 0.63  [-8, 1.512]
  - SI_celestine: -8 → -1.197  [-8, -0.63]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.420 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 62.41 °C; initial a_w=0.991 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.6131692409999999; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.613 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.310786303; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.311 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.296897945; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.297 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.254547565; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.255 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.241655511; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.242 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.251729373; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.252 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Stress/overprint step 80: tectonic_shock — resolved-shear threshold pulse; fluid pressure unchanged; no creep law

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.3 → 0.3 kbar [0.3, 0.3], n=120
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=120
  - Temperature: 178.2608943547122 → 137.43649824522439 °C [90.49107971857299, 178.2608943547122], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":2.4195970419362336,"secure_aragonite":false}, last={"boundary_kbar":2.4610771830762657,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":120}; first=unconstrained, last=unconstrained
  - Executed stress step 80: σdiff=50 MPa; affected crystal IDs=[]; outcomes={"below_crss":1}
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Tri-State Pb-Zn mining district. Brines per Roedder 1976, Ohle 1959, Hagni 1976, and the Stoffell et al. 2008 LA-ICP-MS fluid-inclusion study: NaCl-CaCl2 basinal brine, 18-24 wt% NaCl-eq total salinity, 150-200,000 ppm Cl raw, Mg/Ca ~0.05-0.1 (low-Mg → favors calcite over aragonite). Tri-State is diagnostically silver-POOR: the district produced lead and zinc only, and low-Ag galena is an MVT fingerprint — Ag-in-galena rides Sb/Bi substitution, a high-temperature vein phenomenon absent from a ~150°C basinal brine (Leach et al. 2010 USGS MVT deposit model: Ag 'generally absent in most deposits').

> Chemistry-audit gap-fill pass (Apr 2026): added Na, K, Cl (the NaCl-CaCl2 brine baseline), Ag (argentiferous-galena signature — an UNCITED confabulation, removed v195, see next note), Ba (barite documented locally), Sr (basinal-brine tracer + minor celestine), Cu (trace chalcopyrite). Also drift-fixed Pb=40 from JS-side intent into Python init.

> Silver de-confabulation (v195, boss catch 2026-06-12): the Apr-2026 gap-fill claim 'Tri-State galena is documented argentiferous; Ag was historically a meaningful smelter byproduct' cited no source because none exists — none of this scenario's references (Roedder/Ohle/Hagni/Stoffell) report district Ag, and the district record is Pb+Zn only. The claim was a v139-adamite-family fabrication that survived two rebake reviews because per-pin verdicts inherited it as ground truth. Broth Ag 5 → 0; the baseline's acanthite + native_silver were artifacts riding it (expects_species never promised a silver mineral). Greenockite STAYS — Cd-in-sphalerite is genuinely documented at Tri-State (Schwartz 2000).

> Existing values (SiO2, Ca, CO3, Fe, Mn, F, Mg, pH, salinity) and the event sequence (fluid_mixing step 20, fluid_pulse step 60, tectonic_shock step 80) preserved untouched — gap-fill only.

> MINDAT VALID-SPECIES REFERENCE (boss-supplied screenshots, 2026-07-25 — Picher Field, Tri-State Mining District, mindat locality 12395; boss picked the iconic sub-locality deliberately 'so the data is more consistent'; 44 valid incl. sub-localities): Albite (var. Anorthoclase), Allophane, Anglesite, Aragonite, Arsenopyrite, Aurichalcite, Baryte, 'Calamine', Calcite, Caledonite, Cerussite, Chalcopyrite, Chrysocolla, Copiapite, Covellite, Cuprite, Diadochite, Dolomite, Enargite, Epsomite, Fluorapatite, Galena, Gedrite, Goslarite (var. Cuprogoslarite), Greenockite, GYPSUM (var. SELENITE), Hemimorphite, Hydroniumjarosite, Hydrozincite, Kaolinite, Ktenasite, Linarite, Luzonite, Malachite, Marcasite, Melanterite, Native Sulphur, 'Petroleum' (var. Bitumen), Plumbojarosite, Pyrite, Pyromorphite, Pyrophyllite, Quartz, Smithsonite, Sphalerite, Szomolnokite, Vivianite. WHAT THE LIST VOTES ON (vs seed-42 v236 sim output): (a) GYPSUM var. SELENITE IS VALID HERE — the S2 selenite migration's mvt tenant is record-LICENSED (the exact opposite of elmwood; the per-locality instrument earning its keep); (b) sim species NOT on the list — census flags: FLUORITE (11.9 mm + in expects_species! Picher Field lists none; the anchor spans the whole Tri-State so a Joplin-side sub-locality may still license it — BOSS ADJUDICATION needed before any kill), CELESTINE (39.7 µm, freshly Ba-flipped in S2 — unlisted here), RHODOCHROSITE (5.7 mm, unlisted), SIDERITE (3.7 mm, unlisted — SAME flag as elmwood: the Fe/Mn carbonates may be over-firing in MVT broths), hawleyite (CdS cubic polymorph unlisted; greenockite is), anhydrite (6.3 µm dust; gypsum listed instead); (c) DOUBLE-LICENSED: greenockite (Schwartz 2000 in the v195 note AND the Picher list) — the de-confabulation instrument and the literature agree; (d) the list's big supergene tail (smithsonite/hemimorphite/cerussite/anglesite/malachite/aurichalcite/hydrozincite/native sulphur/the jarosites) is largely post-mining oxidation — the scenario models the hypogene ore stage and ends before the gossan, so their absence from the sim is CORRECT, not a gap; they become relevant only if a Picher supergene-epilogue stage is ever authored.
