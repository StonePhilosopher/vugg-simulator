# CLAIM CARD — chiastolite_hornfels  (v241, seed 42, 120 steps)

**Anchor:** Bimbowrie / Mount Howden, Olary district, South Australia — classic chiastolite (the 'cross stone') in contact-metamorphic hornfels; the Zhoukoudian aureole (Beijing) of Mason et al. 2010 is the peer-reviewed analogue.
**Deposit:** Low-pressure CONTACT-METAMORPHIC hornfels — a graphitic aluminous metapelite baked in the aureole of a shallow intrusion. Andalusite (Al₂SiO₅) porphyroblasts grow with quartz; because the metapelite carries reduced organic carbon, the andalusite grows as CHIASTOLITE — carbonaceous matter swept into the corner growth sectors → the dark cross.
**Initial:** 600 °C, 2.5 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|mass:mmol-formula-to-mgkg+proportional-poolcap+trace-ledger-v5|dissolution:LIFO-shell-inventory+5um-floor-v1|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:physical-timescale+mass-weighted-budget-v2|diagnosis:production-nucleator+causal-supersat+route-capacity-v3|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** 4af4c17ea9991b5d736b1706aa1ccdc465296a3e2f8b195dcfd0a41632838f37

**expects_species (2):** andalusite, feldspar

**Cited sources:**
  - Mason, Burton, Yuan & She 2010 (Gondwana Research 18(1):222-229) — Chiastolite: quartz+graphite co-precipitation into andalusite growth sectors, graphite-buffered H₂O–CO₂ fluid (Zhoukoudian aureole)
  - Dowty 1976 (American Mineralogist 61:460-469) — Crystal structure and crystal growth II: sector zoning in minerals (the protosite model)
  - Holdaway 1971 (American Journal of Science 271:97-131) — Stability of andalusite and the aluminum silicate phase diagram (the Al₂SiO₅ triple point)

## Paragenetic order as grown (3 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | albite | 0 | 1 |
| 2 | andalusite | 0 | 5 |
| 3 | feldspar | 0 | 1 |

**Surprises (grown but NOT in expects_species):** albite
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 599.409 → 422.244 °C  [422.244, 599.409]
  - pH: 6.504 → 6.504   [6.504, 6.504]
  - Eh: -149.606 → -149.606 mV  [-149.606, -149.606]
  - salinity: 0.787 → 0.787 psu  [0.787, 0.787]
  - O2: 0.039 → 0.039 mg/L  [0.039, 0.039]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -3.969 → -3.969  [-3.969, -3.969]
  - SI_aragonite: -4.094 → -4.094  [-4.094, -4.094]
  - SI_dolomite: -6.677 → -6.677  [-6.677, -6.677]
  - SI_HMC: -5.606 → -5.606  [-5.606, -5.606]
  - SI_siderite: -1.071 → -1.071  [-1.071, -1.071]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 2.5 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: 2.5 kbar — rock/confining pressure used by metamorphic phase fields
  - Calcite/aragonite boundary: 6.673 kbar; secure aragonite=false
  - Al2SiO5: andalusite (nominal andalusite) — Ky-Sil line; uncertainty propagates Pattison triple-point T and P bounds.
  - Gypsum/anhydrite pure-water boundary: 94.75 °C; initial a_w=0.999 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 2.5 → 2.5 kbar [2.5, 2.5], n=120
  - Rock/confining pressure: 2.5 → 2.5 kbar [2.5, 2.5], n=120
  - Temperature: 598.2608943547123 → 421.0706241640729 °C [421.0706241640729, 598.2608943547123], n=120
  - Secure aragonite assessment: 0/120 executed steps; first={"boundary_kbar":6.637960672127232,"secure_aragonite":false}, last={"boundary_kbar":3.8257461734970803,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"andalusite":102,"uncertain":18}; first=andalusite, last=uncertain
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: chiastolite is the variety of andalusite with a sector-zoned carbonaceous cross. South Australian (Bimbowrie/Mt Howden) hornfels is the classic collector locality; Mason, Burton, Yuan & She (2010, Gondwana Research 18(1):222-229) is the peer-reviewed mechanism study (Zhoukoudian aureole, Beijing): quartz + graphite inclusions co-precipitate into the andalusite growth sectors from an internally graphite-buffered H₂O–CO₂ fluid.

> Chemistry signature: PERALUMINOUS and SILICA-SATURATED (the opposite of marble_contact's SiO2-undersaturated corundum field). Al high + SiO2 high → Al₂SiO₅ (andalusite), NOT corundum. Alkalis (Na, K) and B are kept LOW — in a pegmatite Al would be locked into feldspar/tourmaline/mica, so andalusite is diagnostic of an alkali-poor metasediment. That alkali/B gate is also what keeps andalusite out of every other scenario.

> wall.graphitic:true — the host is a carbonaceous metapelite. grow_andalusite + classifySectorZoning read this flag to render the CHIASTOLITE carbon cross (a transverse 4-corner sector mask, js/99i _makeChiastolitePrism). Without it, andalusite renders as a plain square prism.

> Thermal regime: contact-metamorphic peak ~600°C cooling gently through the andalusite stability window (400-700°C, below the Holdaway 1971 Al₂SiO₅ triple point ~500°C/0.4 GPa at low P). thermal_pulses:false — one intrusive episode, no magmatic fracture-valve reheats (PEGMATITE-SHAPE, the marble_contact idiom).

> Wall composition 'pegmatite' is the inert aluminous-silicate proxy (the sim branches dissolution only on limestone/dolomite); a true metapelite host is not modeled, this is the closest aluminous silicate flavor.

> O2 low / pH near-neutral — graphite-buffered reducing fluid (Mason et al. 2010).
