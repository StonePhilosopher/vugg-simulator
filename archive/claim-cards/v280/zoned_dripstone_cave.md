# CLAIM CARD — zoned_dripstone_cave  (v280, seed 42, 150 steps)

**Anchor:** Mg/Ca-zoned dripstone cave — composite of Frasassi (Italy, Mg-rich ceiling aragonite), Carlsbad Caverns (NM, calcite floor), and Reed Flute Cave (Guilin, twin morphologies). The geochemistry of cave dripstone where the drip-water Mg/Ca ratio differs between ceiling-percolation pathways and floor-puddle re-precipitation, producing aragonite stalactites + calcite stalagmites in the same cavity.
**Deposit:** Tranche 6 of PROPOSAL-CAVITY-MESH §14 demo scenario. Demonstrates per-vertex nucleation: with wall.per_vertex_nucleation=true, calcite and aragonite engines both fire from the global broth, but each crystal's anchor cell is chosen by the per-cell σ for THAT mineral. Result: calcite nucleates at high-Ca floor cells (molar Mg/Ca << 1.1 keeps calcite σ high and leaves no aragonite selector); aragonite nucleates at high-Mg ceiling cells (molar Mg/Ca > 7 stunts calcite and strongly selects aragonite). Same chemistry, same engines — only spatial sampling differs.
**Initial:** 18 °C, 0.01 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+continuous-temperature-edge-hold+no-pressure-extrapolation-v2|sulfate-Ksp:USGS-PHREEQC-wateq4f-analytic5+explicit-temperature-envelope-v1|carbonate-rate:PWP-omega2over3-raw+production-positive-affinity-series-resistance-Aover1plusA+molarMgCa+pKwTP-hydroxycarbonates-v2|chemistry-evidence:ppm-mgkg-solvent+carbonate-equivalent-mass-labels-v1|SCI02-locality:PHREEQC-SUPCRTBL-anhydrite-classification+ledgered-carbonate-pulses-v1|aragonite-selector:hard-molarMgCa>=1.1-OR-explicit-open-spring+shallowP<=0.10kbar+40..100C-OR-Co5e-4..<1e-2molal+CoCa<0.6+20..30C-OR-highPstable-v5|aragonite-Sr:Wassenburg16-DSr1.38+/-0.53+accepted-zone-booked-return-v1|aragonite-Co:Barber75+GonzalezLopez18+equilibrium-and-effective-booked-DCo0.1+accepted-zone-booked-return-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:locality-authored-material-transform+canonical-catalog-deep-match+owner-bound-MVT-90sulfide-30sulfate+receipted-exact-pore-fluid-export-replacement+atomic-heat-only-default-v4|elmwood-barite:explicit-sulfate-floor+receipted-Ba-hiatus-replacement+causal-next-pulse-masked-layers+terminal-clay-rind-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed+solved-pCO2-uncertainty-v3|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|surface-anchor:position+void-normal+authenticated-triangle-barycentric+immutable-source-snapshot+constructor-fixed-production-provider+field-position-neighborhood-remap+separate-nearest-WallMesh-chemistry-projection+physical-host-anchor-inheritance+derived-live-remap-cache+exact-origin-edge-geodesic-occupancy+physical-normal-architecture-placement+source-qualified-fabrics+provider-timeline-replay+historical-helper-cursor+renderer-authority-lock+replay-shape-tessellation-fail-closed-v7|cavity-shape:seeded-exact-bubble-union+immutable-authored-radial-masks+pole-regular-sin2phi-cos2theta+analytic-pole-caps+digest-ledger-star-shaped-cartesian-production-v4|cavity-authority:default-before-water-chemistry-nucleation+fixed48-world-frame+zero-isovalue+Freudenthal-closed-manifold+signed-spacingOver4096-near-zero-scalar-floor+critical-contact-rejection+exact-volume-transaction+subresolution-chemistry-withheld+atomic-preflight+64-convergence+field-agreement+exact-contract-cache+semantic-startup-receipt+authenticated-replay-v4|water-boundary:mm-above-authenticated-current-floor+legacy-ring-to-authenticated-span-conversion+actual-vertex-chemistry-bands+topology-independent-wall-tint+field-clipped-interface+append-only-historical-appearance-ledger-v1|tiger-eye:HeaneyFisher03-antitaxial-crack-seal+GutzmerBeukesCairncross04-e44-surficial-alteration+BIF-physics-host+booked-NaFeSi-substrate+zeroSiO2-cumulative-O2closed-overprint+HF-only+local-tiger-iron+enum-fail-closed-v2|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+valence-specific-supersaturation+whole-scenario-authored-inputs+authenticated-midrun-activation+phase-resolved-testimony-v6|fluid-boundary:declaration-driven-exact-replacement+automatic-voxel-population+complete-raw-target+net-only-total-closure+claim-card-declaration+scenario-scale+exact-transaction-set+full-replacement-authority+schema-closed-containers-v7|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:atomic-preattack-local-pH+fractional-full-surface-shielding+geodesic-feeder+USGS1248-26C-molar-volume+reported-uncertainty-per1kg+exact-Cartesian-Freudenthal-volume-ledger+validated-depth-closure+capacity-derived-equivalent-diameter+atomic-prerun-creative-reauthoring-v4|solid-occupancy:all-nondissolved+positive-only-size-cap+growth-shadowing-not-chemical-seal+dissolution-remains-local-mass-balanced+zone-integrated-volume+chalcanthite-cell-local-salinity-pH-CuSO4-decay+truthful-trigger-mode+authenticated-current-enclosure-only-v4|cavity-seal:repeatable-transition+accepted-dissolution-immediate-below95pct-rearm+same-or-later-refill-testimony-v2|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|HMC-solid-solution:Mucci87-seawater-DMgT+MucciMorse83-MgCa7.5..20-seawater25C+unknown-outside+BP89-metastable-miscibility+25C-activity-calibration+bounded-RT-extrapolation+omegaGT1-four-tier-locality-dispatch+heterogeneous-wall-approximation+zone-formula+dynamic-competition-stoichiometry+booked-return-v6|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+zone-formula-ratio+booked-return-v7|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|dissolution-overprint:flat-face-rate+coupled-return-dGgate+render-geometry+enforced-booked-return+replay-healing-v3|fluorite-etch:Godinho12-{100}-21C-pH3.6-I0.05-468h+Cama-dG<=-7+NaCl-closed-analogue+250x-schematic-pores+growth-shadow-access+authenticated-current-enclosure-withhold-v4|carbonate-boundary:conserved-only+explicit-initial-DIC-alk+fail-closed-open-reservoir+sabkha-recharge+zero-charge+truthful-reverse-flow-v3|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+actual-zone-formula+residual-round-redistribution+single-evaluation-full-fill-negative-v5|thermal-field:LTE-voxel+geometry-weighted-finite-volume-k<=1/6+order-independent-sources+rock-boundary+per-voxel-one-way-authored-ambient+pause-retain+local-nucleation-growth-morphology+replay-v3|diagnosis:production-nucleator+local-max-context+causal-supersat+calibrated-budget-v5|scenario-contracts:headline-deterministic+accessory-deterministic-with-rationale+3seed-statistical+aspirational+fail-closed-four-tier-locality-license-all-production-nucleators+owner-bound-events+canonical-locality-event-deep-match+causal-event-prerequisite+valence-correct-commissioning-reconciliation-v11|bingham:RedmondEinaudi10-pulsed-hypogene+copper-history-before-gold+gold-aspirational-without-bornite+step85-exhumation+P0.001kbar+35to25C+no-reheat+supergene-malachite-v3|bisbee:Graeme-district+post-mining-inventories+alunite-statistical+jarosite-deterministic+siderite-aspirational+zero-CoNi+8-locality-exclusions+no-forced-halite-brine-v3|tsumeb:TSNB159-confirmed-gypsum-recharge+exact-authored-acid-stage-sulfate+Cu-only-enrichment+Ca-sulfate-recharge+generic-fluid-receipts+secondary-sulfides-aspirational-until-parent-replacement+TSNB301-questionable-rhodochrosite-excluded-v3|wittichen:authored-cooling-through-step170+ambient-thermal-pulses-disabled+step170-vadose-boundary+oxidized-sulfate-does-not-sulfidize-silver-v3|weathering-epilogue:strict-normalized-schema+inclusive-bounded-window+invalid-product-block+authored-drainage+3D-vadose+S-conserved+O2-receipt+CO2-light+same-site-precursor-history-v2|cation-sinks:accepted-shell-return-only+schneeberg-zero-Zn-all-step-finite-voxel-receipt+pharmacolite-dissolved-molar-cation-proxy+48-field-consumer-audit-v2|koettigite:Ciesielczuk20-pH<3+dissolved-molar-Zn-majority-proxy+Co-solid-solution+Hill79-Ni<=5molpct+Bowell14-Tsumeb-third-zone-only-v3|roughton-gill:Bridges11-quartz-carbonate-primary+carbonate-buffered-malachite-cerussite+silica-hemimorphite+step215-pyromorphite-encrusting-plumbogummite+signed-boundary-receipts-v3|run-testimony:actual-step+sample-index+nucleation+positive-layer-formula+returned-dissolution-inventory+habit-extent+hydration-transfer+competition-allocation+solid-solution+CDR+enclosure-liberation-lifecycle+player-movement-choice+controlled-production-engine-witness+solid-state-transformation+morphology-completeness+basis+null-confining-pressure-v8|morphology-sampling:post-step-terminal+finite-depletion-explicit+nonfinite-and-derived-and-no-interface-unavailable+complete-positive-layer-testimony+replay-bound-live-state-v2|locality-boundary:authored-pH-buffer+heat-only-ambient-pulse+creative-exact-authority-v1|crystal-size:individual-record-vs-aggregate-habit+celestine46cm+unresolved-wulfenite-v1|replacement:actual-parent-loss+matching-route-trigger+outline-inheritance-v1|enclosure:positive-nonphantom-solid-guest+same-step-net-positive-host-material+exact-substrate-contact-or-0.5mm-physical-lateral-front+substrate-first-deterministic-host+physical-solid-geometric-reach+shared-chemistry-current-topology-receipt-strict-chronological-lifecycle-authority+authenticated-same-crystal-host-phase-lineage-and-trigger-receipts+slowing-guest+physical-solid-threshold-partial-retreat-liberation+source-specific-front-film-reversal+replay-authenticated-lifecycle-v10|transformation-reactivity:product-only-acid-retreat+LIFO-booked-return+explicit-light-realgar+authenticated-controlled-product-witness-v2|agent-runtime:explicit-sulfur-valence+ambiguous-S-rejected+owner-bound-MVT-90sulfide-30sulfate+narrow-parity-v1|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|evidence-binding:exact-browser-dist-runtime-data+producer-contracts+timestamp-free-strips+mechanism-witness-artifact+player-choice-divergence+aggregate-artifact-sha256-v4|creative-replenishment:run-owned-recipe+exact-canonical-wet-voxel-replacement+fail-closed-target-domains+signed-pH-Eh+explicit-legacy-sulfur-authority+whole-sulfur-constructor-baseline+spatial-fluid-pool-and-authority-receipts+partial-flood-replacement-refused-v3|save-identity:version+model+scenario+origin-bound-replenishment+fluid-and-sulfur-boundary-receipts+voxel-fluids+dedicated-rng+nucleation-shared-seed+movement-state+player-movement-receipts+growth-shadow-state+live-morphology+water-height+full-zone-ledgers+enclosure-lifecycle+transformation-histories-and-exposure-counters+cavity-evolution-chain+wall-depths+replay-cursor-fail-closed-v11|gameplay-choice:authored-absolute-global-movement-plus-persistent-field-offset-map-after-texture-clamp+overlap-handoff+dynamic-add-and-controller-rebuild-inheritance+baseless-net-offset-capture+generic-visible-control-reconciliation+authenticated-water-state-scoped-pore-fluid-closure+declared-pointwise-add-scale-set-max-laws-including-zero-bulk-delta+coupled-carbonate-pH-DIC-exact-titration+explicit-rejected-field-exclusion+atomic-multifield-plus-carbonate-solver-ring-voxel-rollback+action-wide-nonsulfur-coordinate-propagation+nonvadose-broth-exact-replacement+vadose-drain-evaporate-oxygen+legacy-shortcuts-no-uncited-sulfur-boundary+recipe-action-cursor-coalesced-control-replay+post-action-cursor-seal+authored-vs-player-scheduled-source-testimony+cell-feeder-and-refused-carbonate-movement-exclusion+full-populated-simulation-random-v11
**Scenario spec hash:** 95662f87855219cfdd89defa5d35b325415301cef2f2b6f623de38221e7616d2
**Archived strip SHA-256:** 14439705029666501a90e4e62657a1ace16b85dabd63cf097bcaef9960d6f404

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic headline (2):** calcite, aragonite
**Deterministic accessories (1):** dolomite — A plausible minor Mg-carbonate sink in the spatially zoned cave dripwater, subordinate to the calcite-aragonite teaching contrast.
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Frisia S., Borsato A., Fairchild I.J., et al. (2002) — Aragonite-calcite relationships in speleothems (Grotte de Clamouse, France, and Italian cave systems). Lithos 65 (1-2): 119-133.
  - Wassenburg J.A. et al. (2016) — Determination of aragonite trace-element distribution coefficients from speleothem calcite-aragonite transitions. Geochimica et Cosmochimica Acta 190:347-367, doi:10.1016/j.gca.2016.06.036 (D_Sr=1.38+/-0.53).
  - Wassenburg J.A. et al. (2024) — Trace element partitioning controls on cave drip water compositions through prior calcite and aragonite precipitation. Communications Earth & Environment 5:488, doi:10.1038/s43247-024-01648-5 (direct dripwater Sr-Ca relation and D_Sr=1.31+/-0.11).
  - Sherwin C.M., Baldini J.U.L. (2011) — Cave air and hydrological controls on prior calcite precipitation and stalagmite growth rates. Chem. Geol. 290: 79-87.
  - Railsback L.B., Brook G.A., Liang F. et al. (1994) — Speleothem fabric record of aragonite-calcite transitions. Carbonates and Evaporites 9: 217-230.
  - Spötl C., Mangini A. (2007) — Speleothems and paleoclimates: aragonite vs calcite as climate archives. Quaternary Science Reviews 26: 1488-1499.

**Claim-level citations:**
  - (none authored)

## Paragenetic order as grown (3 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | dolomite | 1 | 1 | 0 | nucleation |
| 2 | calcite | 11 | 4 | 0 | nucleation |
| 3 | aragonite | 15 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** (none)
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 18 → 18 °C  [18, 18] (raw_simulation_state)
  - pH: 8.4 → 8.4   [8.4, 8.4] (raw_simulation_state)
  - Eh: 499.5880017344075 → 499.5880017344075 mV  [499.5880017344075, 499.5880017344075] (raw_simulation_state)
  - salinity: 0.5 → 0.5 psu  [0.5, 0.5] (raw_simulation_state)
  - O2: 5 → 5 ppm (mg/kg solvent)  [5, 5] (raw_simulation_state)
  - concentration: 1 → 1 ×  [1, 1] (raw_simulation_state)

## Saturation drivers
  - SI_calcite: 2.646 → 2.646  [2.646, 2.646]
  - SI_aragonite: 2.457 → 2.457  [2.457, 2.457]
  - SI_dolomite: 5.291 → 5.291  [5.291, 5.291]
  - SI_HMC: 2.583 → 2.583  [2.583, 2.583]
  - SI_siderite: 1.575 → 1.575  [1.575, 1.575]
  - SI_selenite: -1.638 → -1.638  [-1.638, -1.638]
  - SI_anhydrite: -1.89 → -1.89  [-1.89, -1.89]
  - SI_barite: 0.504 → 0.504  [0.504, 0.504]
  - SI_celestine: -3.087 → -3.087  [-3.087, -3.087]

## Authored pressure/stress/phase context (claim, not run testimony)
  - Fluid pressure: 0.01 kbar — cavity-fluid pressure; never silently substituted for rock pressure or differential stress
  - Rock pressure: unspecified kbar — unspecified; metamorphic phase field is reported unconstrained
  - Calcite/aragonite boundary: 3.042 kbar; secure aragonite=false
  - Al2SiO5: unconstrained (nominal n/a) — Rock/confining pressure is not specified; fluid pressure cannot substitute for it.
  - Gypsum/anhydrite pure-water boundary: 58.15 °C; initial a_w=1.000 ±0.010 (calibrated-proxy)
  - Ksp pressure rule: reaction-specific SUPCRTBL delta-logK grid; bilinear only inside density and per-reaction temperature masks; no constant reaction-volume proxy
    - calcite: active; active=true; ΔlogK=0.009963972666666668; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.010 relative to 1 bar at the same temperature.
    - aragonite: active; active=true; ΔlogK=0.009519926000000001; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.010 relative to 1 bar at the same temperature.
    - dolomite: active; active=true; ΔlogK=0.018936008666666667; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.019 relative to 1 bar at the same temperature.
    - siderite: active; active=true; ΔlogK=0.009375906; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - rhodochrosite: active; active=true; ΔlogK=0.008828912; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - anhydrite: active; active=true; ΔlogK=0.008524968666666667; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - barite: active; active=true; ΔlogK=0.008690605333333334; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.009 relative to 1 bar at the same temperature.
    - celestine: active; active=true; ΔlogK=0.008439841333333333; SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by +0.008 relative to 1 bar at the same temperature.
    - selenite: unsupported-reaction; active=false; ΔlogK=0; Gypsum is absent from the SUPCRTBL solid-species set; the Hardie water-activity/temperature phase selector remains active, but no Ksp pressure correction is fabricated.
  - Differential stress: no authored stress event.

## Executed pressure/stress/phase testimony (archived run)
**Source:** archived executed run state; not reconstructed from scenario definition
  - Fluid pressure: 0.01 → 0.01 kbar [0.01, 0.01], n=150
  - Rock/confining pressure: not recorded
  - Temperature: 18 → 18 °C [18, 18], n=150
  - Secure aragonite assessment: 0/150 executed steps; first={"boundary_kbar":3.04181614,"secure_aragonite":false}, last={"boundary_kbar":3.04181614,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":150}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Transformation reactivity commissioning: controlled production-engine boundary; not a locality trajectory; artifact vugg-mechanism-witnesses-v3/08706cf324d031ac02d8bad04bdf1dcc4b6aaae2bd1d830e1ba2b0e73c4023e7.
    - No controlled reactivity witness is applicable to a transformation product in this locality run.
  - Conserved carbonate boundary: not enabled for this archived run.

## Declared non-sulfur fluid-boundary transactions (archived run)
**Source:** archived declared non-sulfur fluid-boundary transactions; exact net spatial closure is authenticated by the strip SHA-256; gross per-voxel replacement exchange is intentionally not claimed
  - No declared non-sulfur fluid-boundary transaction was executed.

## Player interventions against authored movements (archived run)
**Source:** visible player interventions accepted against active authored absolute movements; exact rows are authenticated by the strip SHA-256
  - No player intervention was applied in this automatic reference run.

## Crystal enclosure receipts (archived run)
**Source:** accepted host-over-guest and later liberation events from the archived executed run
  - No host-over-guest enclosure was accepted in this run.

## Sulfur reservoir identity and conservation (archived run)
**Source:** archived phase-resolved sulfur ledger; exact samples are authenticated by the strip SHA-256
  - Sulfur ledger: explicit valence-resolved sulfur pools were not enabled for this scenario.

## Layer, solid-solution, competition, and habit testimony
  - Accepted layers: 878; formula-bearing=0; solid-solution=0; binding competition=0; reactive transformation etches=0; masked horizons=0.
  - Registered-mineral morphology: positive=234; classified=234; unavailable=0; terminal-depleted=0; regimes={"hopper_skeletal":16,"stepped_macro":218}; bases={"post-step":234}.
  - Habit crystal 1: dolomite; coarse_rhomb; extent=individual; forms=["planar rhombohedral {104}","ambient-temperature dolomite"]; size authority={"extent_kind":"individual","cap_cm":30,"record_cm":15}; CDR=null.
  - Habit crystal 2: calcite; stepped_rhombohedral; extent=individual; forms=["e{104} rhombohedron with macrostep terraces","pagoda-stacked faces"]; size authority={"extent_kind":"individual","cap_cm":2000,"record_cm":1000}; CDR=null.
  - Habit crystal 3: aragonite; acicular_needle; extent=individual; forms=["acicular needles","radiating spray"]; size authority={"extent_kind":"individual","cap_cm":30,"record_cm":15}; CDR=null.
  - Habit crystal 4: aragonite; acicular_needle; extent=individual; forms=["acicular needles","radiating spray"]; size authority={"extent_kind":"individual","cap_cm":30,"record_cm":15}; CDR=null.
  - Habit crystal 5: aragonite; acicular_needle; extent=individual; forms=["acicular needles","radiating spray"]; size authority={"extent_kind":"individual","cap_cm":30,"record_cm":15}; CDR=null.
  - Habit crystal 6: aragonite; acicular_needle; extent=individual; forms=["acicular needles","radiating spray"]; size authority={"extent_kind":"individual","cap_cm":30,"record_cm":15}; CDR=null.
  - Habit crystal 7: calcite; stepped_scalenohedral; extent=individual; forms=["v{211} scalenohedron with macrostep terraces","stepped dog-tooth"]; size authority={"extent_kind":"individual","cap_cm":2000,"record_cm":1000}; CDR=null.
  - Habit crystal 8: calcite; stepped_scalenohedral; extent=individual; forms=["v{211} scalenohedron with macrostep terraces","stepped dog-tooth"]; size authority={"extent_kind":"individual","cap_cm":2000,"record_cm":1000}; CDR=null.
  - Habit crystal 9: calcite; rhombohedral; extent=individual; forms=["e{104}","possibly nail-head"]; size authority={"extent_kind":"individual","cap_cm":2000,"record_cm":1000}; CDR=null.

## Scenario notes (author's own rationale)
> Real-world precedent: Frasassi Cave's Sala 200 carries ceiling aragonite frostwork over floor calcite popcorn; Reed Flute Cave (Guilin) shows the same vertical sort. The driver is dripwater Mg/Ca, which on ceiling-percolation pathways gets concentrated by prior dolomite dissolution and selective calcite preprecipitation upstream, while floor-puddle re-precipitation drops Mg as Mg-Mg carbonates / clay along the way and arrives Ca-rich. Frisia et al. 2002 Lithos paper is the canonical Italian cave-aragonite geochem reference; Sherwin & Baldini 2011 reviewed the global pattern.

> Scenario chemistry — global broth (= equator): Ca=2000, Mg=1000, CO3=2200, pH=8.4. The aqueous molar Mg/Ca is 0.82, below the evidence-bounded aragonite selector, so the equatorial wall stays calcite-favoring while the local ceiling override opens the aragonite route. Zone overrides then split the cavity:

>   Floor: Ca=3500, Mg=30. Molar Mg/Ca = 0.014 — calcite σ is unstunted and the aragonite Mg selector is physically absent. Result: calcite-only cells.

>   Ceiling: Ca=800, Mg=3500. Molar Mg/Ca = 7.21 — calcite is strongly poisoned and the aragonite selector is saturated. Dissolved Sr is 0.59 ppm, scaled from the measured modern Grotte de Piste dripwater molar Sr/Ca relation rather than copied from solid speleothem ppm; accepted aragonite shells debit it at Wassenburg et al.'s D_Sr=1.38+/-0.53. Result: aragonite-only cells without unlicensed strontianite.

>   Wall: stays at the global broth. Calcite σ slightly preferred at the boundary.

> Per-vertex nucleation closes the loop: without this flag, nucleation engines read only the equator chemistry, the gate fires on the global broth, and the crystal lands at a random area-weighted cell — which means a calcite stalagmite might end up where the aragonite-favoring chemistry is, and vice versa. With wall.per_vertex_nucleation=true, each nucleation picks the cell whose local σ for THAT mineral is highest. The spatial result tracks the chemistry.

> inter_ring_diffusion_rate=0 pins the zones across the 150-step run; with the default 0.05 the Laplacian would homogenize the Mg/Ca gradient over ~20 steps and the differentiation would wash out before either engine fires twice.

> air_mode_default=true so PROPOSAL-HABIT-BIAS Slice 1 kicks in: ceiling aragonite crystals point downward (stalactite c-axis world-down), floor calcite crystals point upward (stalagmite c-axis world-up). The combination of per-vertex placement + air-mode habit gives the full Frasassi-style spatial sort visually.

> Sources cited are the genuine references for Italian cave aragonite-on-calcite paragenesis; this scenario is the simulator's first that puts Mg/Ca zoning and habit-bias together in one cavity.
