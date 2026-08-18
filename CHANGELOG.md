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

- The tranche is commissioned as **SIM 271**. SIM 268 separated sulfate,
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
- Idle mode now reports fresh zero-volume nuclei and inactive capped/buried
  solids without treating dissolved crystals as booked pie-chart volume.
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
