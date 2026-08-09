# CLAIM CARD — tn457_barite_pulses  (v257, seed 42, 110 steps)

**Anchor:** TN457 (boss collection proxy designation) — pink barite on sphalerite, England (probable Cumbria; lineage points to the Caldbeck Fells / North Pennines orefield: Carboniferous-limestone-hosted post-Variscan Pb-Zn-Ba MVT-style mineralization). Thousands of pink tabular barite crystals coin-stacked on sphalerite substrate, 5+ macroscopically-visible growth stages, mild blue/white UV fluorescence (late hydrozincite). Pink color is Mn²⁺-activated; the coin-stack morphology is the mineralogical signature of episodic fluid pulse precipitation (Putnis & Perthuisot 2001, Jamtveit et al. 2000). DOGFOOD: PROPOSAL-EVENT-DRIVEN-PRECIPITATION (Rock Bot + Professor, 2026-05-20) as the forcing-function test — does the engine already produce the TN457 signature from event chemistry alone, or are the missing pieces all renderer-side?
**Deposit:** Cumbria-style MVT cavity: initial sphalerite nucleates on the limestone wall (steps 1-4, Zn + S high, mildly reducing, T ~120°C), then 50 fluid pulses inject Ba + rng-varied Mn across steps 5-103. Each pulse drives one barite growth zone with that pulse's Mn loading; over 50 pulses the trace_Mn time-series is the pink-banding pattern. Cumulative pulse effect: T cools 120 → 95°C, O2 climbs 0.15 → 0.40 (mild oxidation), pH drops slightly (acidic incoming fluid, dissolution-then-precipitation candidate per Crystal.is_phantom). The engine should produce sphalerite-first then barite-on-sphalerite paragenesis with per-zone Mn variation; the open question is whether the renderer's single-ellipsoid-per-crystal output captures the coin-stack visual or needs ('stacked_tablets') as a new habit-variant token.
**Initial:** 120 °C, 0.4 kbar, wall=?
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-highPstable-v4|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+zone-formula+booked-return-v3|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores-v3|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+full-zone-ledgers-fail-closed-v3
**Scenario spec hash:** 7c99d569c9bf1655dfda86132ea2d78d6825a48ec998568415cc83254ee7e211

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** sphalerite, barite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Alderton D.H.M. & Bevins R.E. (1996) — Fluid inclusion microthermometry of Pb-Zn-Ba veins, Cumbrian orefield, England. Journal of the Geological Society 153: 91-104. Brine T 100-150°C, salinity ~20 wt% NaCl eq., post-Variscan timing.
  - Bouch J.E., Naden J., Shepherd T.J., McKervey J.A., Young B., Benham A.J., Sloane H.J. (2006) — Direct evidence of fluid mixing in the formation of stratabound Pb-Zn-Ba-F mineralisation in the Alston Block, North Pennines orefield. Mineralogical Magazine 70: 567-588. PRIMARY REFERENCE — multi-stage fluid mixing produces the oscillatory chemistry, Mn²⁺ partitioning into barite tracks the pulse history.
  - Sherlock R.L., Tosdal R.M., Lehrman N.J., Graney J.R., Losh S., Jowett E.C., Kesler S.E. (1999) — Origin of the McLaughlin Mine sheeted vein complex: metal zoning, fluid inclusion, and isotopic evidence. Economic Geology 90: 2156-2181. Comparison framework for low-T brine MVT-style mineralization.
  - Putnis A. & Perthuisot J-P. (2001) — A model of oscillatory zoning in solid solutions grown from aqueous solutions: applications to the (Ba,Sr)SO4 system. Geochimica et Cosmochimica Acta 65: 3387-3399. THE oscillatory-zoning mechanism — episodic fluid pulses + boundary-layer feedback. The same Putnis whose CDR work is already in Crystal.cdr_replaces_crystal_id (vugg-simulator follows-the-science).
  - Jamtveit B., Wogelius R.A., Fraser D.G. (2000) — Noise and oscillatory zoning of minerals. Geochimica et Cosmochimica Acta 64: 2347-2360. Information-theoretic framework for oscillatory zoning in barite + calcite + plagioclase.
  - Reich M., Mateo S., Barra F., Deditius A., Roberts M.P., Bilenker L.D., Simon A.C., Skidmore C., González R., Tardani D. (2023) — Formation of giant iron oxide-copper-gold deposits by superimposed episodic hydrothermal pulses. Scientific Reports 13: 11669. Modern framework for episodic-pulse formation of giant ore systems — the same mechanism scales from TN457's hand-specimen barite stacks to district-scale orogenic systems.
  - L'Heureux I. (1993) — Oscillatory zoning in crystal growth: a constitutional undercooling mechanism. Physical Review E 48: 4460-4469. Self-organization mechanism — the engine implements this implicitly through per-step rng-driven supersaturation noise.
  - Heaney P.J. & Davis A.M. (1995) — Observation and origin of self-organized textures in agates. Science 269: 1562-1565. Adjacent literature for oscillatory chalcedony banding; cross-applies to barite tabs as a Mn-banded analog.

## Paragenetic order as grown (2 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | sphalerite | 1 | 1 | 0 | nucleation |
| 2 | barite | 8 | 6 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 118.26089435471242 → 58.092733033746526 °C  [58.092733033746526, 118.26089435471242] (raw_simulation_state)
  - pH: 6.5 → 6.5   [6.5, 6.66] (raw_simulation_state)
  - Eh: -30.977185236079677 → 75.51499783199066 mV  [-30.977185236079677, 75.51499783199066] (raw_simulation_state)
  - salinity: 4.5 → 4.5 psu  [4.5, 4.5] (raw_simulation_state)
  - O2: 0.15 → 0.4000000000000002 mg/L  [0.15, 0.4000000000000002] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: -2.016 → -2.583  [-2.583, -1.701]
  - SI_aragonite: -2.142 → -2.709  [-2.709, -1.827]
  - SI_dolomite: -4.913 → -5.291  [-5.291, -4.409]
  - SI_HMC: -2.016 → -2.268  [-2.268, -1.701]
  - SI_siderite: -0.63 → -0.945  [-0.945, -0.378]
  - SI_selenite: -1.638 → -1.512  [-1.638, -1.512]
  - SI_anhydrite: -1.827 → -1.953  [-1.953, -1.827]
  - SI_barite: 0.567 → 3.213  [0.567, 3.213]
  - SI_celestine: -8 → -8  [-8, -8]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.4 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 2.503 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 63.88 °C; initial a_w=0.997 ±0.020 (temperature-extrapolation)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - aragonite: outside-temperature-envelope; active=false; ΔlogK=0; Pressure correction inactive outside this reaction's 10-90 C promoted Ksp(T) envelope; no extrapolation.
    - dolomite: active; active=true; ΔlogK=0.7085133975000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.709 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.35787184; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.358 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.337999584; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.338 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.2882520565000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.288 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.276640211; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.277 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.2859393945; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.286 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.4 → 0.4 kbar [0.4, 0.4], n=110
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=110
  - Temperature: 118.26089435471242 → 58.092733033746526 °C [58.092733033746526, 118.26089435471242], n=110
  - Secure aragonite assessment: 0/110 executed steps; first={"boundary_kbar":2.508173666194662,"secure_aragonite":false}, last={"boundary_kbar":2.770525678739546,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":110}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Anchor: Cumbria, England — Caldbeck Fells (Brandlehow, Greenside, Force Crag) and the North Pennines orefield (Alston Block, Weardale, Hilton Mine in Scordale) are the Pb-Zn-Ba lineage that produces pink-barite-on-sphalerite specimens of the TN457 type. Carboniferous limestone host, post-Variscan brine-driven MVT-style mineralization (~100-150°C), late-stage barite + fluorite + calcite gangue with documented oscillatory Mn²⁺ zoning. Reference frame: Alderton & Bevins 1996, Bouch et al. 2006, Sherlock et al. 1999.

> Forcing-function test scope: this scenario adds ONE event handler (tn457_mn_ba_pulse in js/70s-tn457.ts) + scenario data only. Zero changes to supersaturation, nucleation, growth, or renderer code. The test answers: with chemistry alone, what does the engine produce for a 50-pulse Mn+Ba scenario? Whatever paragenetic signature comes out becomes the baseline for the next sub-arc (per-zone color rendering vs. coin-stack render primitive vs. mass-nucleation bypass, sequenced per the gap-analysis).

> Chemistry: initial broth is classic Cumbrian MVT — T 120°C, pH 6.5, Cl-Na brine (Na 250, Cl 800), Zn 180 + S 200 for sphalerite nucleation, Ca 40 + CO3 20 for limestone-wall equilibrium, Ba 2 (BELOW barite's Ba>=5 gate so first pulse is the trigger), Mn 0.3 (background trace), O2 0.15 (just above the sulfateRedoxAvailable 0.1 threshold so the very first barite pulse can fire; cumulative oxidation across 50 pulses walks O2 to 0.40, the sulfateRedoxFactor optimum).

> Event chemistry per pulse (50× fire): Ba +15 ppm (barite stoichiometry 1:1 in MINERAL_STOICHIOMETRY debits this back as crystals grow, so the fluid doesn't runaway), Mn +0.3-1.5 ppm rng-driven (the pink-banding source — each zone's trace_Mn captures that pulse's Mn), pH -0.08 (acidic incoming fluid; floor 4.5 well above the pH<4 penalty), T -0.5°C (50 pulses × 0.5 = -25°C cumulative cooling), O2 +0.005 (mild progressive oxidation toward sulfateRedoxFactor center 0.4), flow_rate spike (diagnostic for narrators). The seeded rng makes the 50-pulse Mn time-series byte-stable per (scenario, seed) — composes cleanly with v117 ?seed=N shareable-URL contract.

> Determinism: ?seed=42&scenario=tn457_barite_pulses&dump=specimen is byte-stable per the v117 agent-friendly interface. Guard test tests-js/tn457-barite-pulses.test.ts pins (a) sphalerite + barite both fire, (b) barite nucleates AFTER sphalerite (paragenetic order), (c) barite zones carry per-zone trace_Mn variation (not all same value), (d) same seed twice produces identical zone_count + paragenetic_sequence.

> What this DOES NOT test (deferred): coin-stack rendering as N stacked thin tablets vs. one integrated tablet (renderer-side, slated for next sub-arc); per-zone color band paint (renderer-side, slated for next sub-arc); mass-nucleation bypass at high sigma (engine-side, needs MINERAL_STOICHIOMETRY backfill); epitaxy-vs-nucleation tilt during high-pulse-density windows (engine-side, deferred). Those are precisely the gaps the boss's gap-analysis-after-this-runs will surface.

> Wall: 'limestone' composition (carbonate-reactive — barite's acidic pulses dissolve a tiny rim of the wall each pulse, releasing trace Ca that may affect Mn²⁺ chemistry indirectly). vug_diameter_mm 25 (pocket-scale — the TN457 specimen is hand-sized). shape_seed 457 (= specimen number, traditional anchor).
