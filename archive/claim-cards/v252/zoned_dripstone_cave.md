# CLAIM CARD — zoned_dripstone_cave  (v252, seed 42, 150 steps)

**Anchor:** Mg/Ca-zoned dripstone cave — composite of Frasassi (Italy, Mg-rich ceiling aragonite), Carlsbad Caverns (NM, calcite floor), and Reed Flute Cave (Guilin, twin morphologies). The geochemistry of cave dripstone where the drip-water Mg/Ca ratio differs between ceiling-percolation pathways and floor-puddle re-precipitation, producing aragonite stalactites + calcite stalagmites in the same cavity.
**Deposit:** Tranche 6 of PROPOSAL-CAVITY-MESH §14 demo scenario. Demonstrates per-vertex nucleation: with wall.per_vertex_nucleation=true, calcite and aragonite engines both fire from the global broth, but each crystal's anchor cell is chosen by the per-cell σ for THAT mineral. Result: calcite nucleates at high-Ca floor cells (Mg/Ca << 1.5 keeps calcite σ high, aragonite σ near zero); aragonite nucleates at high-Mg ceiling cells (Mg/Ca > 4 stunts calcite via the Mg poisoning sigmoid and peaks the aragonite Mg/Ca favorability factor). Same chemistry, same engines — only spatial sampling differs.
**Initial:** 18 °C, 0.01 kbar, wall=irregular
**Model digest:** Pfluid:kbar-0.001..4.4|Ksp-pressure:SUPCRTBL-delta-logK-reaction-grid+density-mask+no-extrapolation-v1|aragonite-selector:Mg+shallowP<=0.10kbar-spring+highPstable-v2|CaCO3:Hacker05-negative-linear+/-1kbar|Prock:Pattison92-AndSil-16+/-3barC|stress:instant-resolved-shear-stable-grain-v2|event-fluid:absolute-replace-v1|carbonate-boundary:PB82-dilute+DIC+reducedAlk+ideal-headspace+open-ledger+atomic-recharge+titration+accepted-zone-receipts+bulk-guard+equal-volume-mixed-v2|sphalerite-Ge:Belissont-Kd1708-cap22000-mass+dissolution-v2|gypsum-aw:ChirifeResnik84-NaCl-proxy-v1|silica-phase:Fournier-amorphous+chalcedony+quartz-Ostwald+reactive-pool+Manning94-grid-bounded-pressure+booked-transition+chemistry-competition-v5|surface-growth:all-cell-invalidated-exact-triangle-area+connected-patch+mass-booked-thickness+exact-shared-triangle-stratigraphy+executed-raycast+LOD-invariant-relief-v4|Mn-oxide-phase:birnessite-layer+Ba-romanechite-2x3+booked-birnessite-to-Mg-todorokite-3x3-at95-200C+pyrolusite-endmember-v2|CaSO4-phase:Hardie67-aw+P14.7Ckbar+single-evaluator+mass-balanced-replacement-v1|sulfur-ledger:sulfide+sulfate+elemental+declaration-driven-spatial+pathway-gated-v3|native-S-oxidation:production-open+O2limited-closed+diagnostic-H-v1|sulphur-bank-HgS:zoned-association-not-S0-substrate-v1|wall-dissolution:formula-stoich-limestone+dolomite-v1|sicily-SDAOM:methane-1C1S+whole-scenario-carbon-ledger-v2|calcite-Mn:manganocalcite-excess<1.2-v1|CuZn-carbonates:Alwan80+Kaluza24-observer-only-v1|growth-budget:calibrated-axial-mmolkg+formula-ratio+booked-return-v6|dissolution:LIFO-booked-axial-inventory+5um-floor-v2|engine-fluid:transactional-staged-crystal+actual-supplement+Au-ledger-v3|beryl:K36-postHF-recovery-v1|halite:vadose-propensity0.8-v1|borax-tincalconite:pure60.8C+halite-sat39.6C-oneway-v1|competition:accepted-axial-timescale+formula-weighted-budget-v3|diagnosis:production-nucleator+causal-supersat+calibrated-budget-v4|scenario-contracts:deterministic+statistical+aspirational+locality-exclusions+windows-v2|run-testimony:actual-step+sample-index+nucleation+solid-state-transformation-v2|deccan:Savda-Nashik-silica+scolecite-mesolite+heulandite-stilbite+apophyllite-v2|transition-locality-exclusion:target-gated-v1|save-identity:version+model+scenario-fail-closed-v1
**Scenario spec hash:** b721565208220bc2d57012dba9eb6da4268a44e5b797d0618ada184b126e3ffe

## Model boundary: calibrated growth budget
  - Kind: calibrated stoichiometric axial-growth budget proxy
  - Basis: 0.00008 mmol formula/kg solvent per accepted axial micrometre
  - Preserves: formula mole ratios and exact closure of booked inventory on dissolution
  - Limitation: not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume

## Expectation contract
**Deterministic (2):** calcite, aragonite
**Statistical (0):** (none)
**Aspirational (0):** (none)
**Locality exclusions (0):** (none)

**Cited sources:**
  - Frisia S., Borsato A., Fairchild I.J., et al. (2002) — Aragonite-calcite relationships in speleothems (Grotte de Clamouse, France, and Italian cave systems). Lithos 65 (1-2): 119-133.
  - Sherwin C.M., Baldini J.U.L. (2011) — Cave air and hydrological controls on prior calcite precipitation and stalagmite growth rates. Chem. Geol. 290: 79-87.
  - Railsback L.B., Brook G.A., Liang F. et al. (1994) — Speleothem fabric record of aragonite-calcite transitions. Carbonates and Evaporites 9: 217-230.
  - Spötl C., Mangini A. (2007) — Speleothems and paleoclimates: aragonite vs calcite as climate archives. Quaternary Science Reviews 26: 1488-1499.

## Paragenetic order as grown (4 species)
| # | mineral | first step | nucleations | transformations | pathway |
|--|--|--|--|--|--|
| 1 | dolomite | 1 | 1 | 0 | nucleation |
| 2 | HMC | 1 | 4 | 0 | nucleation |
| 3 | calcite | 11 | 4 | 0 | nucleation |
| 4 | aragonite | 15 | 4 | 0 | nucleation |

**Surprises (present but absent from all authored expectation tiers):** dolomite, HMC
**Deterministic no-shows:** (none)
**Statistical no-shows (non-failing):** (none)
**Aspirational no-shows (non-failing):** (none)
**Excluded-locality appearances (failing):** (none)

## Environment trajectory (first → last, [min,max])
  - T: 23.622 → 23.622 °C  [23.622, 23.622]
  - pH: 8.378 → 8.378   [8.378, 8.378]
  - Eh: 497.638 → 497.638 mV  [497.638, 497.638]
  - salinity: 0.787 → 0.787 psu  [0.787, 0.787]
  - O2: 5 → 5 mg/L  [5, 5]
  - concentration: 0.984 → 0.984 ×  [0.984, 0.984]

## Saturation drivers
  - SI_calcite: 2.709 → 2.709  [2.709, 2.709]
  - SI_aragonite: 2.583 → 2.583  [2.583, 2.583]
  - SI_dolomite: 5.669 → 5.669  [5.669, 5.669]
  - SI_HMC: 1.764 → 1.764  [1.764, 1.764]
  - SI_siderite: 1.701 → 1.701  [1.701, 1.701]
  - SI_selenite: -1.701 → -1.701  [-1.701, -1.701]
  - SI_anhydrite: -1.89 → -1.89  [-1.89, -1.89]
  - SI_barite: 0.378 → 0.378  [0.378, 0.378]
  - SI_celestine: -1.89 → -1.89  [-1.89, -1.89]

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
  - Rock/confining pressure: 0 → 0 kbar [0, 0], n=150
  - Temperature: 25 → 25 °C [25, 25], n=150
  - Secure aragonite assessment: 0/150 executed steps; first={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}, last={"boundary_kbar":2.9888905400000003,"secure_aragonite":false}
  - Al2SiO5 executed phase counts: {"unconstrained":150}; first=unconstrained, last=unconstrained
  - Executed stress: no stress event recorded by the run.
  - Mineral transformations: none executed.
  - Conserved carbonate boundary: not enabled for this archived run.

## Scenario notes (author's own rationale)
> Real-world precedent: Frasassi Cave's Sala 200 carries ceiling aragonite frostwork over floor calcite popcorn; Reed Flute Cave (Guilin) shows the same vertical sort. The driver is dripwater Mg/Ca, which on ceiling-percolation pathways gets concentrated by prior dolomite dissolution and selective calcite preprecipitation upstream, while floor-puddle re-precipitation drops Mg as Mg-Mg carbonates / clay along the way and arrives Ca-rich. Frisia et al. 2002 Lithos paper is the canonical Italian cave-aragonite geochem reference; Sherwin & Baldini 2011 reviewed the global pattern.

> Scenario chemistry — global broth (= equator, what the engines see for their gate decisions): Ca=2000, Mg=1500, CO3=2200, pH=8.4. Mg/Ca = 0.75 puts both engines above their nucleation σ thresholds (calcite >1.3, aragonite >1.0) but neither is saturated past its kinetic preferred window. Zone overrides then split the cavity:

>   Floor: Ca=3500, Mg=30. Mg/Ca = 0.009 — calcite σ unstunted (Mg-poisoning sigmoid centered at Mg/Ca=2 gives ~0% inhibition here), aragonite σ ≈ 0 (Mg/Ca << 1.5, aragonite favorability factor near 0). Result: calcite-only cells.

>   Ceiling: Ca=800, Mg=3500. Mg/Ca = 4.4 — calcite σ drops by ~70% (Mg-poisoning sigmoid at high-saturation tail), aragonite σ peaks (favorability factor near 1, plus the Sr/Ba trace boost from the ceiling-percolation history). Result: aragonite-only cells.

>   Wall: stays at the global broth. Calcite σ slightly preferred at the boundary.

> Per-vertex nucleation closes the loop: without this flag, nucleation engines read only the equator chemistry, the gate fires on the global broth, and the crystal lands at a random area-weighted cell — which means a calcite stalagmite might end up where the aragonite-favoring chemistry is, and vice versa. With wall.per_vertex_nucleation=true, each nucleation picks the cell whose local σ for THAT mineral is highest. The spatial result tracks the chemistry.

> inter_ring_diffusion_rate=0 pins the zones across the 150-step run; with the default 0.05 the Laplacian would homogenize the Mg/Ca gradient over ~20 steps and the differentiation would wash out before either engine fires twice.

> air_mode_default=true so PROPOSAL-HABIT-BIAS Slice 1 kicks in: ceiling aragonite crystals point downward (stalactite c-axis world-down), floor calcite crystals point upward (stalagmite c-axis world-up). The combination of per-vertex placement + air-mode habit gives the full Frasassi-style spatial sort visually.

> Sources cited are the genuine references for Italian cave aragonite-on-calcite paragenesis; this scenario is the simulator's first that puts Mg/Ca zoning and habit-bias together in one cavity.
