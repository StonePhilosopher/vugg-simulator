# CLAIM CARD — amethyst_geode  (v242, seed 42, 110 steps)

**Anchor:** Ametista do Sul, Rio Grande do Sul, Brazil — amethyst geodes in the Serra Geral Formation high-Ti basalt (Paraná Continental Flood Basalt Province, Lower Cretaceous ~134 Ma)
**Deposit:** A Brazilian amethyst geode. A basalt gas cavity fills inward — celadonite rim → agate → clear quartz → amethyst. Mid-growth a green celadonite film frosts the amethyst prism faces; the tip renews a wider cap THROUGH the film — a MASKING SCEPTRE (the non-corrosive masking counterpart to grimsel's corrosion sceptre). Goethite staining at the base.
**Initial:** 160 °C, 0.3 kbar, wall=?
**Model digest:** Pfluid:kbar-0.01..4.4|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** aa3cba05d1e4a62a3259180ddda8fffa974280a7a6bd9de7029c6bc9b103aef8

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

**expects_species (1):** quartz

**Cited sources:**
  - Gilg H.A., Morteani G., Kostitsyn Y., Preinfalk C., Gatter I., Strieder A.J. (2003) — Genesis of amethyst geodes in basaltic rocks of the Serra Geral Formation (Ametista do Sul, Rio Grande do Sul, Brazil): a fluid inclusion, REE, oxygen, carbon, and Sr isotope study on basalt, quartz, and calcite. Mineralium Deposita 38: 1009-1025. Geode structure celadonite→agate→quartz→amethyst; LOW-T (<100°C, prob <50°C) low-salinity sedimentary-brine model.
  - Amethyst geodes in the basaltic flow from Triz quarry at Ametista do Sul (Rio Grande do Sul, Brazil): magmatic source of silica for the amethyst crystallizations. Geological Magazine 144(4): 731. Primary amethyst fluid inclusions 152-238°C; magmatic silica source — the high-T camp the scenario's warm nucleation phase reflects.
  - Rossman G.R. (1994) — Colored varieties of the silica minerals. Reviews in Mineralogy 29: 433-468. Amethyst = Fe³⁺ colour centre activated by natural γ-irradiation (the same Rossman already cited by the js/59 smoky/morion Al-centre path).
  - Proust D. & Fontan F. (2007) — Brazilian amethyst-geode late-stage mineralogy (the same Proust & Fontan cited in minerals.json for the amethyst-pocket late euhedral / lepidocrocite-patina sequence).
  - Takahashi K. & Sunagawa I. (2004) — sceptre quartz by epitaxial-like overgrowth (ELO) after a masking film: the masking-sceptre mechanism, distinct from corrosion-then-regeneration.

## Paragenetic order as grown (2 species)
| # | mineral | first step | # events |
|--|--|--|--|
| 1 | quartz | 0 | 3 |
| 2 | opal | 78 | 5 |

**Surprises (grown but NOT in expects_species):** opal
**No-shows (expected but never nucleated):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 159.449 → 67.913 °C  [67.913, 159.449]
  - pH: 7.22 → 6.724   [6.724, 7.22]
  - Eh: 77.165 → 77.165 mV  [77.165, 77.165]
  - salinity: 3.937 → 3.937 psu  [3.937, 3.937]
  - O2: 0.394 → 0.394 mg/L  [0.394, 0.394]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: -1.071 → -1.575  [-1.575, -0.819]
  - SI_aragonite: -1.197 → -1.701  [-1.701, -0.882]
  - SI_dolomite: -2.016 → -3.339  [-3.339, -1.764]
  - SI_HMC: -2.772 → -2.961  [-3.15, -2.457]
  - SI_siderite: 1.575 → 1.197  [1.197, 1.638]
  - SI_selenite: -8 → -8  [-8, -8]
  - SI_anhydrite: -8 → -8  [-8, -8]
  - SI_barite: -8 → -8  [-8, -8]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.3 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.428 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 62.41 °C; initial a_w=0.998 ±0.020 (temperature-extrapolation)
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.3 → 0.3 kbar [0.3, 0.3], n=110
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=110
  - Temperature: 159.97782118707738 → 68.28307316763484 °C [68.28307316763484, 159.97782118707738], n=110
  - Secure aragonite assessment: 0/110 executed steps; first={"boundary_kbar":2.4282827966260294,"secure_aragonite":false}, last={"boundary_kbar":2.713869622834345,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":110}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.

## Scenario notes (author's own rationale)
> Anchor: Ametista do Sul, Rio Grande do Sul — the classic Brazilian amethyst-geode district, hosted in a ~40-50 m subhorizontal high-Ti basalt flow of the Serra Geral Formation (Paraná flood basalts, Lower Cretaceous ~134 Ma). Geode structure INWARD: celadonite rim → agate/chalcedony → colourless quartz → amethyst (Gilg et al. 2003).

> Formation temperature is genuinely debated in the literature and the scenario bridges the two camps. Monophase liquid inclusions with low ice-melting depressions argue a LOW-T, low-salinity fluid (<100°C, probably <50°C — a sedimentary-brine / paleo-aquifer model; Gilg et al. 2003). Primary inclusions in the amethyst itself yield 152-238°C with a MAGMATIC silica source (Triz-quarry study, Geol. Mag. 144:731). The scenario nucleates amethyst in a warm early phase (~160°C) and finishes the cavity cool (~70°C via the declared cooling trend), with the celadonite film + goethite stain as the late low-T overprint.

> AMETHYST COLOUR is Fe³⁺ substituting for Si⁴⁺, activated by a natural γ-dose (Rossman 1994). The Serra Geral basalt is mafic — low K/U/Th per unit time — but the geode has sat in it for ~134 Ma, so cumulative background dose tips the Fe centres to amethyst (NOT the granite-hosted morion of a Grimsel cleft). The sim expresses this via wall.gamma_host (js/59, added with this scenario): a modest 0.45 accrues radiation_damage into the amethyst band (>0.1) without reaching smoky (>0.3). No pegmatite/phonolite host is claimed — the scenario declares its own low, long background; every existing basalt scenario leaves gamma_host unset and is byte-identical.

> THE MASKING SCEPTRE: the celadonite (green K-Fe mica-clay) that rims these geodes also settles on the growing amethyst as a film. A PRISM-dominant celadonite film (prism 0.45, term 0.08 — frosts the {10-10} prism, spares the tip) arrests the sides; the Silica Renewal Pulse then lifts σ over the dead-zone barrier σ*(φ_prism) and the tip renews a wider {10-11}-capped termination THROUGH the film — a masking-route sceptre (classifyQuartzSceptre js/45; Takahashi & Sunagawa 2004 ELO). grimsel stays the clean CORROSION-sceptre reference; this is the non-corrosive masking counterpart. The renderer widens the cap from a length fraction and does not calculate or claim conserved solid mass.

> The late iron-oxide film is the diagnostic base staining — a termination/uniform film (prism 0.3, term 0.3), NOT a second sceptre; real Brazilian points are commonly goethite/hematite-stained at the matrix contact.
