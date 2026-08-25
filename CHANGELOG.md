# Changelog

This changelog records player-facing and release-system changes. Scientific
engine changes remain identified separately by `SIM_VERSION`, `MODEL_DIGEST`,
and the exact-execution evidence receipt.

## Unreleased — local AAA completion tranche

### Added

- Responsive browser workflows for title, setup, Creative, saving, reload,
  authenticated replay, narrow/tall phones, landscape phones, keyboard
  diagnosis, safe areas, and reduced motion.
- Crash-safe format-v3 Creative saves, finish and collection write-ahead
  receipts, corrupt-generation recovery, and checksum-bound local
  export/import. Format-v2 recipes remain available for export and diagnosis
  but cannot be replayed under weaker identity rules.
- A causal Grand Tour lesson for saturation, limiting reagents, temperature,
  pH, redox, substrate, competition, and the distinction between eligibility
  and guaranteed growth.
- Persistent 100%, 125%, and 150% text settings; explicit reduced motion;
  keyboard focus restoration; global storage-failure notices; contrast and
  touch-target audits.
- Scenario-authoring validation and timestamp-free seed-42 preview receipts.
- Versioned content and asset manifests, telemetry-free local diagnostics,
  release/migration policy, scientific stewardship policy, and external-gate
  evidence protocols.
- A memory-bounded full-suite runner that checks the complete project identity
  between batches. Resume checkpoints are explicitly untrusted operator
  conveniences and cannot issue an uninterrupted full-suite PASS.

### Scientific identity

- The tranche is commissioned as **SIM 281**. SIM 268 separated sulfate,
  sulfide, and elemental-sulfur admission; SIM 269 authenticated that repair
  through the full evidence path and corrected mid-run reservoir activation.
  SIM 270 replaces the former constant-enthalpy sulfate approximations with
  the cited PHREEQC analytical K(T) expressions, removes fitted-temperature
  pressure discontinuities, and corrects the associated carbonate kinetics,
  molar-ratio, pKw, and evidence-unit seams. It preserves SIM 267's
  Cartesian solid/seal authority while separating sulfate, sulfide, and
  elemental-sulfur admission throughout the supersaturation engines. Carbon
  boundary uncertainty and zero/reverse-flow edge cases are corrected in the
  same scientific identity. SIM 271 keeps the cited raw PWP diagnostic but
  adds the explicit production transport/applicability ceiling needed when a
  single simulator step samples extreme supersaturation without PHREEQC-style
  reaction integration. `MODEL_DIGEST` names these changes explicitly.
- SIM 272 removes universal locality shortcuts: phases require an explicit
  positive locality license, locality events are owner-bound, ambient heat
  pulses carry no solutes without an authored material contract, and pH has
  no hidden neutral attractor. Creative exposes the same exact buffer and
  fracture-fluid authorities. Carbonate wall attacks smaller than the
  authenticated Cartesian lattice's volume resolution are now withheld as a
  complete transaction, so numerical noise cannot produce negative cavity
  growth or unpaired solution chemistry.
- SIM 278 closes the last production-dispatch exception to that locality
  contract. HMC now passes through the same exclusion, four-tier positive
  license, paragenetic-window, prerequisite, and derived-RNG boundary as every
  other carbonate. Eligible chemistry alone cannot introduce HMC into an
  authored scenario that does not positively license it; Creative and custom
  broths remain intentionally unrestricted.
- SIM 279 binds the Creative Replenish action to the exact starting fluid of
  the current simulator instance. Moving from Custom through Home/New Game to
  an authored Scenario or Starter Fluid can no longer carry an invisible
  prior-run recipe into geology, and save replay reconstructs the same recipe
  from its recorded origin before applying any action. Replenish is an exact
  open-system replacement of every canonical wet voxel, not a bulk-display
  reset: numeric chemistry, signed pH/Eh, explicit-versus-legacy sulfur mode,
  sulfate inheritance, and native-sulfur pathway all return to the run-owned
  starting authority. Spatial fluid and sulfur import/export receipts close
  the replacement before later growth reads a WallCell. Legacy one-pool sulfur
  is commissioned at construction too, so switching to explicit valence pools
  cannot rebase or erase earlier open-boundary history.
- SIM 280 makes player intervention compose with authored geology instead of
  disappearing underneath it. An absolute movement remains the cited baseline
  curve, while any visible control that changes a global movement-owned field
  contributes a persistent, receipted offset after authored texture/clamps and
  across overlapping movement handoffs. Spatial cell feeders remain separate.
  Base-less curves capture their baseline net of that offset, and an explicit
  recipe-action cursor prevents same-step slider drags from coalescing across
  an intervening action. Field authority survives Clear/Schedule controller
  rebuilds; receipts distinguish canonical authored curves from later
  player-scheduled trajectories. Save replay uses the same canonical write path,
  strips and claim cards retain the accepted
  action, and the controlled Herkimer witness compares a wait-only run with a
  +25°C Heat branch that produces a different terminal temperature and crystal
  outcome. Simulation Random also draws from every populated non-tutorial
  scenario instead of a private four-scenario list.
  Fluid choices cross the simulator's storage boundary as well: an accepted
  bulk SiO2/Eh coordinate is applied to the authenticated non-vadose canonical
  pore-fluid population and closed inside the same player-action receipt;
  dry-ring stores remain unchanged. Drain/Evaporate oxygen instead targets the
  authenticated vadose population. Absolute broth sliders use an exact
  non-vadose replacement, so a coalesced drag and its saved final value
  reconstruct the same spatial chemistry rather than only the same UI number.
  Multi-field buttons reconcile every changed non-sulfur coordinate, and the
  completed action cursor is sealed before the autosave fingerprints it.
  Each verb now carries its actual pointwise pore-fluid law: additions remain
  additions, Flood/Seep/Evaporate remain per-voxel scales, Drain/Oxidize use
  their bounded or exact oxygen controls, and broth values remain exact sets.
  This matters after partial drainage, where adding one bulk delta cannot
  reproduce scaling a heterogeneous wet/vadose population. The action rolls
  back as a unit if any changed coordinate fails that declared law, and the
  claim-card producer independently checks the action/field/transform tuple.
  Declared max/set laws still execute when the bulk display number is already
  at its target, because newly wet or dry heterogeneous voxels may not be;
  explicitly rejected carbonate, injection, and Replenish branches are marked
  separately so a refusal can never manufacture that spatial write.
  Carbonate-bound acid/base controls declare their solved pH and DIC as one
  exact coupled replacement: the carbonate solver installs both coordinates,
  and the generic action bridge independently verifies both over the canonical
  non-vadose pore-fluid population before accepting the choice. If that
  spatial closure fails, the same atomic before-image restores bulk, voxel,
  ring-fallback, and carbonate solver/transaction authority; the next Advance
  cannot inherit a rejected titration as an unreceipted DIC residual.
  Legacy Brine, Copper, Oxidize, and Evaporate shortcuts no longer invent,
  delete, or ambiguously re-valence combined sulfur: without an authored
  sulfur source or executed redox/water-mass reaction, the explicit sulfur
  reservoirs and their ledger remain unchanged.
  Replenish's v1 equal-volume replacement now refuses partial flooding before
  mutation rather than treating stored vadose chemistry as wet source water.
  Breadcrumb:
  97/97a visible action -> 85c opaque voxel closure -> 85j combined receipt ->
  85g/85h strip transport -> review-claim-card independent validation.
- SIM 281 makes a guided tutorial belong to exactly one run. Reset, New Game,
  save restoration, or a direct run replacement clears its lexical progress,
  callout, delegated listeners, locks, and spotlights. An async boot epoch
  prevents a tutorial from reappearing if Reset wins while scenario narratives
  load. Actions whose explanation names a mineral or recording now require that
  exact semantic target: quartz and calcite cards, Shigar topaz, TN457 barite,
  and the seed-42 TN457 strip cannot be substituted by another matching button,
  card, option, or row. The Shigar collection lesson is reconciled to the
  authenticated seed-42 result: it grows topaz but no beryl, so the documented
  aquamarine window remains permission rather than a fabricated specimen.
  Scenario, Starter, Custom, tutorial, and Simulation launchers share one
  pre-await generation, and the tutorial's first Grow is a synchronous one-use
  claim, so navigation or a rapid second click cannot resurrect a stale run.
  Both Simulation lessons now own and recheck the complete command—including
  an empty scenario-default shape seed and scenario-default cavity size—so a
  Random/manual override left by an earlier run cannot change the crystal
  census underneath the lesson's explanations.
  Tutorial locks are also semantic rather than CSS-only: locked controls leave
  the tab order, advertise `aria-disabled`, and a capture guard blocks keyboard
  or programmatic activation. Travertine advances past its acid experiment
  only after the carbonate titration and exact pore-fluid pH replacement both
  close, using a post-transaction receipt instead of the initiating click.
  The Grand Tour also commissions its persistent viewer state as 3D-on and
  Helicoid-off, temporarily unlocks only the viewer control named by the
  current step, and advances only after an exact before/after state receipt;
  a flat or open viewer retained from an earlier run cannot reverse the prose.
  Collection progress now requires the committed specimen id, and Strip View
  progress reauthenticates the complete serialized dataset after IndexedDB
  readback. Imported files use a distinct key namespace and cannot overwrite or
  inherit the current production-run receipt. The mechanism verifier rebuilds
  that controlled manifest, scenario hash, binary strip, and receipt
  independently rather than trusting self-rehashed witness fields.
  Breadcrumb: 70a state/target authority -> 94/97 run boundaries -> 97c crystal
  rows / 98 platter options -> 99i/99j viewer product state ->
  85h durable byte identity / 99k loaded-byte
  gate -> tutorial authoring lint -> controlled evidence witness /
  owned-browser lifecycle and IndexedDB checks.
  The step-50 acid product now discloses accepted calcite/aragonite solid
  transfers that the carbonate boundary must flush immediately before
  titration instead of falsely requiring the titration to occupy the stale
  pre-action transaction index.
- Tsumeb's four early acid-stage sulfur inputs are now authored, cited sulfate
  boundaries from upgradient sulfide oxidation. The former copper-enrichment
  event no longer invents dissolved sulfide: USGS models place chalcocite and
  covellite in replacement fronts on primary pyrite/chalcopyrite, a solid route
  this scenario does not yet execute. Those documented Tsumeb phases remain
  positively licensed but aspirational. The old combined-S edits had added 110
  ppm per pore-fluid control volume without an open-system receipt; the revised
  whole-scenario ledger exposes and closes the remaining material inputs. The
  step-55 Cu/Fe leachate and step-70 Ca recharge now also emit generic fluid-
  boundary receipts, and the dry-season Ca/sulfate/hydrology row is exact-
  payload authenticated like the four acid events. Generic fluid-boundary
  receipts now close every declared field over the canonical voxel population,
  retain raw-finite/count testimony, and are independently recomputed against
  their one-to-one declarations by the claim-card producer. Tsumeb's declared
  scales/sources are additionally checked against the authored scenario rows;
  a bulk-only, coerced, missing/skipped-voxel, or coordinated rehash cannot
  publish as closed. An authored `replacement` is now physical authority too:
  Asbestos Hills oxidizing-water events set the exact O₂ endmember in every
  heterogeneous voxel instead of broadcasting a bulk delta while claiming a
  replacement.
- Locality expectation tiers were reconciled to the complete SIM 272
  three-seed census: 3/3 products are deterministic, 1–2/3 products are
  statistical, and 0/3 documented possibilities remain positively licensed
  but aspirational. No fluid or engine was tuned merely to preserve an old
  promise.
- Idle mode now reports fresh zero-volume nuclei and inactive capped/buried
  solids without treating dissolved crystals as booked pie-chart volume.
- Enclosure now requires the host to deposit a real positive layer in the
  exact step that records the swallow, with net material gain after any
  same-step etch. A large dormant crystal can no longer turn a newly slowing
  or dissolving neighbor into an inclusion by size and proximity alone.
  Competing hosts are resolved substrate-first rather than by array order, and
  every accepted enclosure now reaches authenticated strips and claim cards.
  Geometric-selection “burial” is explicitly a growth-front shadow, not an
  impermeable chemical seal: shadowed solids still accept ordinary and
  evidence-bounded physical fluid attack, and the shadow state is part of the
  replay fingerprint because it controls future positive growth.
  A physical inclusion now withholds transformation, heterogeneous substrate,
  film deposition, and physical etching only when host topology, the guest
  receipt, and a strictly chronological enclosure/liberation stream agree;
  bare or stale display flags remain chemically accessible.
  An enclosing host may still transform in place without exposing its guest,
  but only through an append-only, replay-bound lineage receipt: CaSO4
  replacements prove their phase boundary, saturation, water transfer, and
  Ca/sulfate closure; birnessite-to-todorokite proves its zone-level Mn/Mg
  allocation; cooling paramorphs and light isomerization prove their measured
  trigger. A renamed mineral label alone cannot act as a chemical seal.
  Exact substrate identity can authorize a sub-millimetre overgrowth while the
  0.5 mm minimum remains fail-closed for uncertain lateral footprint overlap.
  The seed-42 Bisbee path consequently records five oxidative native-copper
  shell losses before a growing chrysocolla rooted on that copper encloses the
  surviving core at step 154.
- Morphology testimony now covers every accepted positive layer in the
  registered mineral families. A finite post-step interface depleted below
  saturation is retained and labeled as terminal-depleted rather than being
  mistaken for the growth-admission condition; non-finite sampling produces
  an explicit unavailable receipt. Invalid derived morphology is likewise
  unavailable, and a shell completely erased in its growth step is retained
  as history without inventing a surviving crystal interface. The corrected MVT pyrite record is a
  smooth-to-finely-striated stack, with no manufactured macrostep rind.
- Chalcanthite's exceptional low-salinity/high-pH water-solubility decay now
  shares the same physical enclosure authority as the general chemistry paths. Authored size caps,
  growth-front burial, and stale inactive display flags remain pore-fluid
  accessible; only reciprocal, receipted, chronological enclosure topology
  can withhold the mass-balanced Cu and sulfate return. The decay gate and its
  narration now read that crystal's exact wall-cell fluid (ring and bulk are
  explicit fallbacks), matching the local reservoir that receives the return.
- Enclosure/liberation lifecycle receipts are replay-authenticated and exported
  with host/guest identity, route, distance/reach, same-step host material,
  guest core/loss/remaining closure, and any growth-front film reversal.
  Partial host retreat can liberate a guest before total host destruction.
  Guest and host sizes are derived from accepted non-phantom solid rather than
  display totals. Front films retain ordered dust/enclosure source operations,
  so liberation removes only its own effective (possibly cap-limited)
  contribution and preserves later dust or other guests. Zero/phantom-only
  guests, phantom or net-zero host layers, and array-order host preemption are
  rejected by focused controls.
- Removed the unsupported Bisbee cuprite-mantle/nested-shell narration. Native
  copper oxidation is booked as Cu loss; cuprite and later carbonates remain
  independently gated phases unless a future researched transformation books
  a linked product. Corrected the false claim that the Statue of Liberty's
  patina is malachite to the XRD-supported cuprite + basic copper
  sulfate/chloride assemblage.
- The exact-browser/execution science receipt must be freshly rebaked after
  the source tree is quiescent. A matching SIM number alone is never treated
  as proof that old evidence executed these bytes.

### External gates

- Physical-device, assistive-technology, representative-player, real
  mineralogist/geochemist, final-art, rights, store, legal, privacy, and
  deployment reviews remain human work. They are not certified by this local
  tranche.

### Fixed

- Replaced combined-total-sulfur admission in sulfur-bearing saturation
  engines with the chemically appropriate sulfate or sulfide reservoir. Large
  wrong-valence pools can no longer admit or inflate the wrong mineral family.
- Added phase-resolved sulfur-ledger testimony to canonical strip archives and
  hostile-review claim cards, with every exact sample covered by the aggregate
  evidence receipt; reconciled locality promises that had depended on the
  former combined-S behavior without inventing new sulfur sources.
- Authenticated mid-run migration from the legacy combined-sulfur shell into
  explicit valence reservoirs, including the Tsumeb dry-season sulfate import,
  so a late ledger activation begins from the exact spatial fluid and booked
  solid inventory instead of reporting an unexplained balance discontinuity.
- Bound closed-carbonate uncertainty to solved rather than target pCO2,
  preserved an explicit zero CO2 charge, and made reverse boundary flow report
  import rather than narrating degassing.
- Restored the generated single-file build's offline `file://` contract. The
  exact scenario, mineral, thermo, and narrative inputs are now embedded with
  a deterministic receipt, so the Simulation selector, Scenarios picker, Zen
  selector, tutorials, and canonical science data load when `index.html` is
  opened directly as well as when the repository is served over HTTP.
- Kept the full Creative-control regression inside its existing memory budget
  by parsing the authored HTML shell rather than twelve redundant copies of
  the generated executable, and by releasing each completed Creative run.
  All 34 control, physics, responsive, and accessibility assertions remain.
- Distinguished individual-crystal record dimensions from aggregate habit
  extents, including the documented 45–46 cm celestine authority; unified the
  celestine census and production habit precedence.
- Required actual parent dissolution plus a matching route before replacement
  products inherit an outline; added mass-balanced reactivity for four
  transformation-only products and explicit excavation/light control for the
  realgar-to-pararealgar route.
- Redistributed unused shared-reagent allocations deterministically and made
  HMC competition consume its actual layer formula instead of a fixed 90/10
  proxy. Strip archives and claim cards now retain layer formula, hydration,
  habit, transformation-boundary, and competition-allocation testimony.

## SIM 274 — causal Elmwood barite masked-layer hypothesis

- Corrected Elmwood's staged barite events to raise the explicit sulfate
  reservoir instead of the derived combined-sulfur compatibility field. The
  sulfate-water import is now visible in the sulfur ledger and cannot inflate
  sulfide phases.
- Made each clay/iron-oxide film a real low-Ba depositional hiatus. Later Ba
  pulses are independently booked and break the preceding film at the next
  authored stage, producing two positive-growth internal horizons; the final
  low-Ba clay rind remains uncleared. Every Ba replacement/recharge and sulfate
  import is spatially propagated and ledger-tested.
- Disclosed the clay/iron masked-layer sequence as a simulator hypothesis based
  on general mineral-ontogeny mechanics, not a documented Elmwood specimen
  texture. Authenticated strips and claim cards now retain every generic fluid
  boundary transaction, each horizon's source film/coverage/step, and the
  terminal surface rind.
- Reconciled the Elmwood fluorite guard with its locality-owned Gratz-Misra
  brine. The former ~22 mm result depended on an uncited Cave-in-Rock material
  package; the corrected seed-42 crystal remains specimen-scale at ~10.4 mm
  without importing another locality's Ca/F inventory. Its accepted layers
  remain smooth under that brine; the late CO3/pH pulse train is retained as
  the cited stepped-calcite driver rather than being misreported as a fluorite
  morphology mechanism.

## SIM 273 — commissioned locality, transformation, and boundary authority

- Reconciled every positive locality licence against the three-seed production
  census without turning an undocumented or absent phase into a deterministic
  promise. Elmwood anhydrite is now explicitly excluded; North Pennine pyrite
  remains licensed but aspirational rather than falsely guaranteed.
- Replaced shared material-bearing ambient pulses with owner-bound, cited
  locality events; canonical locality chemistry, scenario authoring, browser
  runtime, and the narrower headless agent boundary now agree on explicit
  sulfate and sulfide reservoirs.
- Required real parent loss and a matching route for replacement-outline
  inheritance, redistributed unused shared-reagent allocations, and used each
  HMC layer's actual Ca/Mg formula during competition. Transformation-only
  products retain booked-layer acid dissolution without acquiring a fictitious
  independent growth path.
- Added an authenticated production-mechanism witness for all four
  transformation-only reactivity controls. Claim cards link each control only
  through an executed transformation product or an executed surviving parent,
  so a locality seed is never misrepresented as having crossed a controlled
  counterfactual boundary.
- Modeled the Reactivated Fluorite Vein wash and recharge as exact open-system
  pore-fluid replacements. Sulfide, sulfate, and elemental sulfur exported by
  the wash are now booked from every spatial fluid before the replacement is
  applied, closing the sulfur ledger instead of silently deleting inventory.

## SIM 271 — bounded production use of the raw PWP affinity

- Preserved the exact precipitation-positive PHREEQC/PWP diagnostic
  `r_forward * (omega^(2/3) - 1)`, including its finite far-under-saturation
  behavior required by SCI-02.
- Separated production growth from that diagnostic and bounded its
  positive dimensionless affinity with the monotone series-resistance form
  `A / (1 + A)`, where `A = omega^(2/3) - 1`. The asymptotic ceiling is an
  explicit transport/applicability closure for Vugg Simulator's frozen-fluid,
  one-zone-per-step update—not a claim that the PWP dissolution experiments
  measured unlimited precipitation at extreme supersaturation.
- Added wrong-domain controls proving the raw diagnostic remains exact, the
  admitted envelope is unchanged, and extreme supersaturation cannot create a
  single cavity-filling dolomite zone.

## SIM 270 — PHREEQC sulfate thermodynamics and continuous pressure authority

- Replaced the four sulfate constant-enthalpy K(T) approximations with the
  exact five-coefficient analytical expressions published in the USGS
  PHREEQC `wateq4f.dat` database, with explicit per-phase temperature
  envelopes and fail-closed out-of-envelope saturation/admission.
- Removed reaction-grid pressure jumps at fitted temperature edges by holding
  the nearest authenticated SUPCRTBL correction, while retaining the strict
  prohibition on pressure extrapolation and surfacing the evaluated edge in
  the player-facing formation diagnosis.
- Replaced the unbounded far-under-saturation PWP surrogate with the bounded
  PHREEQC omega-to-the-two-thirds affinity term; converted Mg/Ca selectors and
  poisoning factors from stored mass ppm to molar ratios.
- Evaluated hydroxycarbonate OH activity with temperature- and pressure-aware
  water pKw, failing closed where the authenticated water state is absent.
- Corrected chemistry evidence labels to ppm by mass (mg/kg solvent), with
  carbonate partitions explicitly identified as CO3-equivalent mass rather
  than falsely labeled mg/L.
- Reconciled two stale scenario contracts exposed by the corrected physics:
  Mogok calcite remains the marble wall mineral rather than an invented free
  druse, and undocumented Jeffrey dolomite is aspirational while its corrected
  trajectory remains below the heterogeneous-nucleation threshold.
- Reconciled the corrected locality envelope without weakening thermodynamics:
  five reproducible anhydrite results are classified explicitly as modeled
  accessories, while documented calcite in Grimsel, Roughton Gill, and
  Sunnyside is restored by cited, open-boundary carbonate-bearing fluid pulses.
  Every new DIC input is an exact carbon-ledger transaction; the Sunnyside
  terminal branch remains the low-excess botryoidal manganocalcite path.

## SIM 269 — authenticated sulfur testimony and activation

- Exported every phase-resolved sulfur-ledger sample through canonical strip
  archives and hostile-review claim cards; the aggregate evidence receipt now
  authenticates those exact bytes.
- Commissioned legacy combined-S → explicit-reservoir transitions from the
  exact pre-event spatial fluid and booked-solid inventory, then applied only
  declared boundary additions. This removes a first-activation sulfur double
  credit exposed by the new Supergene artifact gate.
- Added authoritative artifact tests for reservoir fields, named phase
  identities, continuous sample coverage, conservation closure, card
  presentation, strip hashes, and aggregate evidence authentication.

## SIM 268 — sulfur valence authority and carbon boundary truth

- Routed every sulfate/sulfide admission gate, factor, ratio, and competing
  sulfur term through the matching valence-specific reservoir.
- Added wrong-valence negative controls and generated per-phase sulfur
  testimony that closes against booked solid sulfur and the aqueous ledger.
- Retired unsupported sulfate-fed Pb/Ag/As sulfide promises in Bisbee,
  Elmwood, Schneeberg, and Wittichen; explicitly licensed or excluded newly
  revealed products using locality evidence.
- Corrected solved-pCO2 uncertainty, explicit-zero CO2 charge handling, and
  reverse-flow event narration.

## SIM 267 — repeatable cavity seal lifecycle

- Re-armed `_vug_sealed` after authenticated dissolution creates more than 5%
  aggregate open capacity, including same-step dissolve/refill sequences, with
  hysteresis below the hard 100% closure boundary.
- Counted buried and size-capped non-dissolved crystals in authoritative fill,
  dominant-mineral testimony, and the idle volume/inventory display.
- Booked chalcanthite's special water-solubility loss through its accepted zone
  history and local Cu/sulfate ledger so chemistry, axial extent, width, solid
  volume, and seal state remain coherent.
- Changed the authored world-record cap to reject only positive growth zones;
  capped exposed solids can still dissolve and return their local inventory.
- Reused graduated competition's first negative candidate at full fill, keeping
  stochastic dissolution to one engine/RNG evaluation per crystal and step.
- Preserved seed 42, every authored scenario `shape_seed`, and the commissioned
  Schneeberg five-pharmacolite/zero-Zn trajectory exactly.
- Separated the idle-mode volume diagram from its physical-solid inventory
  caption, closing the false “empty vug” report for new nuclei.

## SIM 266 — Cartesian production cavity

- Promoted the fixed 48³, zero-isovalue Cartesian cavity to production
  authority, with independent 64³ convergence, exact-volume erosion,
  authenticated anchors/replay/water/materials, and fail-closed rendering.
- Preserved scenario run seed 42 for commissioning and each scenario's
  separately authored `shape_seed` from `data/scenarios.json5`.
