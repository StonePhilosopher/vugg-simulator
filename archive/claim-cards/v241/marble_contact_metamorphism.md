# CLAIM CARD — marble_contact_metamorphism  (v241, seed 42, 180 steps)

**Anchor:** Mogok Stone Tract, Mandalay Region, Burma — type locality for marble-hosted ruby + 2000+-year source of 'pigeon's blood' rubies
**Deposit:** Marble-hosted contact metamorphic vug — Al-rich, SiO2-undersaturated skarn fluid drives corundum-family (ruby/sapphire) paragenesis.
**Initial:** 500 °C, 3 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:mmol-formula-to-mgkg+proportional-poolcap+trace-ledger-v5|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:physical-timescale+mass-weighted-budget-v2|diagnosis:production-nucleator+causal-supersat+route-capacity-v3|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 6760433d44fe528ba3fa583418f7b3b8d10d6df705c0c3022aa242ca69439a11

**expects_species (2):** calcite, ruby

**Cited sources:**
  - Ferrill D.A. et al. 2004 (J. Struct. Geol. 26:1521) — calcite twin morphology Type I-IV geothermometer
  - Burkhard M. 1993 (J. Struct. Geol. 15:351) — calcite twins as strain/T gauge; Turner 1953 (Am. J. Sci. 251:276)
  - Garnier et al. 2008 (Ore Geology Reviews 34:169-191) — Marble-hosted ruby deposits from Central and Southeast Asia
  - Peretti et al. 2018 (Gems & Gemology special issue) — Update on corundum and its gem varieties
  - Searle et al. 2007 (Journal of Geology 115:1-23) — Tectonic evolution of the Mogok metamorphic belt, Burma (Myanmar)

## Paragenetic order as grown (2 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | ruby | 19 | 1 |
| 2 | calcite | 149 | 1 |

**Surprises (grown but NOT in expects_species):** (none)
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 499.016 → 304.134 °C  [304.134, 699.803]
  - pH: 7.992 → 8.323   [7.992, 8.323]
  - Eh: 44.094 → 44.094 mV  [44.094, 44.094]
  - salinity: 2.362 → 2.362 psu  [2.362, 2.362]
  - O2: 0.315 → 0.315 mg/L  [0.315, 0.315]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 0.126 → 0.504  [0.126, 0.504]
  - SI_aragonite: 0 → 0.378  [0, 0.378]
  - SI_dolomite: 0.567 → 1.323  [0.567, 1.323]
  - SI_HMC: -1.575 → -1.197  [-1.575, -1.197]
  - SI_siderite: 1.26 → 1.638  [1.26, 1.638]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 4.892 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 102.10 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Stress/overprint step 165: marble_tectonic_strain — authored visual deformation overprint

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 3 → 3 kbar [3, 3], n=180
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=180
  - Temperature: 498.2608943547122 → 302.91959656914685 °C [302.91959656914685, 698.5688353108242], n=180
  - Secure aragonite assessment: 0/180 executed steps; first={"boundary_kbar":4.865588379224611,"secure_aragonite":false}, last={"boundary_kbar":2.788029798255387,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":125,"unconstrained":55}; first=andalusite, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchored to the Mogok Stone Tract: dolomitic marble of the Mogok Metamorphic Belt was regionally metamorphosed during the Himalayan orogeny (~30 Ma) to amphibolite-to-granulite grade, then intruded by leucogranite dykes at 17-22 Ma that drove contact metamorphic ruby/sapphire/spinel crystallization in skarn envelopes.

> Chemistry signature: SiO2 undersaturation (the defining corundum-family constraint). Al and Ca are high, SiO2 is low — opposite of every other scenario in the sim. When SiO2 is scarce, Al3+ cannot form feldspar/mica/Al2SiO5 polymorphs and instead crystallizes as pure corundum; with Cr trace from adjacent ultramafic country rock, ruby forms; with Fe+Ti, blue sapphire; with Fe alone, yellow sapphire.

> Thermal regime: 500 → 700 → 500 → 350°C over 180 steps. Phase 1 (initial warmup): contact metamorphic pulse approaches; marble starts to fluid-saturate. Phase 2 (700°C peak, step 20): corundum family nucleates; Cr partitions to ruby, Fe+Ti to blue sapphire. Phase 3 (retrograde cooling, step 60, 700→500°C): main growth window; fluid migrates along skarn bleaching front. Phase 4 (fracture seal, step 150): system closes.

> v184 thermal_pulses:false (PEGMATITE-SHAPE, T-rollout close-out): the events anchor the single-intrusion arc (700@20, 500@60) and the default ambient drift correctly carries the 500→350 retrograde slope — but the random ambient pulses had no geological home here (the scenario models ONE leucogranite contact episode; designed reheats belong in events) and their Fe riders (+2-15 ppm) poison the chromophore budget this scenario exists to control (Cr→ruby vs Fe/Ti→blue vs Fe-alone→yellow partitioning at a wall with deliberately Fe-poor 200 ppm). Dark-observed clean at 3 seeds (tools/t-story-observe.mjs): expects (calcite, ruby) intact, retrograde end honest (403→303).

> Wall composition is 'limestone' as a proxy for dolomitic marble — sim currently models limestone + pegmatite + basalt; marble is the metamorphosed limestone end-member, closest fit available.
