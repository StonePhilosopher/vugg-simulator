# Authoritative open-improvements ledger — 2026-08-08

This file supersedes stale “open” labels in `BACKLOG.md`, old handoffs, and
individual proposals. Those documents remain historical evidence; this is the
single execution ledger for the science-first AAA completion branch.

## Already delivered — do not reimplement

- Creative mode exposes the full authored geological control surface; the audit
  currently covers 50 fields rather than hiding “advanced” chemistry.
- The nucleation hover explains saturation, limiting inventory, T/pH/redox gates,
  substrate, competition, and survival/dissolution reversal.
- Scenario geometry uses each scenario's authored `shape_seed`; deterministic
  test runs use run seed 42.
- Pressure and differential stress are distinct controls; quartz pressure
  solubility uses the researched Manning correction.
- Explicit sulfur pools, silica provenance, stoichiometric growth inventories,
  authoritative gypsum/anhydrite selection, carbonate ledgers for Sicily, surface
  coating fabrics, and broad Mn/oxide coatings have shipped with tests.
- Sunnyside, Tsumeb, gypsum/anhydrite replacement, Deccan chalcedony testimony,
  and the v247 surface-fabric tranche passed the previous AI Dr. Wise review.
- The former Python/runtime parity backlog is obsolete: the browser TypeScript
  runtime and JSON5 content are authoritative.

## P0 — simulation integrity and architecture

- [x] Conserved DIC / reduced alkalinity / CO2-headspace boundary with explicit
  open, closed, charge, vent, recharge, and uncertainty semantics. Evidence:
  `research/arcs/research-carbonate-boundary-science-2026-08-08.md`,
  `tools/carbonate-boundary-observe.mjs`, 39 regenerated v254 strips, and
  `proposals/HOSTILE-REVIEW-DR-WISE-SIM254-2026-08-08.md`.
- [x] Retire every fixed-DIC pH-only atmospheric consumer. Open reservoirs now
  fail closed without conserved DIC + reduced alkalinity, and Creative always
  constructs the conserved state; the false “solver off” control is gone.
  Initialization/configuration failures remain permanently blocked through the
  real run loop. Evidence: SIM 254,
  `tests-js/carbonate-boundary-conservation.test.ts`,
  `tests-js/carbonate-localization-equilibration.test.ts`, and
  `tests-js/creative-controls.test.ts`.
- [x] Immutable, serializable simulation commands and snapshots; worker-compatible
  progressive execution, cancellation, deterministic parity, and recovery.
  Evidence: `js/85l-simulation-command-protocol.ts` and
  `tests-js/simulation-command-protocol.test.ts` (one-shot/chunk/replay parity,
  cancellation/resume, tamper rejection, two-generation corrupt-save recovery).
- [x] One generated science/provenance manifest that rejects missing citations,
  unsupported ranges, unregistered handlers, and stale scenario metadata.
  Evidence: `tools/gen-science-provenance-manifest.mjs`,
  `data/generated/science-provenance-manifest.json` (39 scenarios, 220 citations),
  and `tests-js/science-provenance-manifest.test.ts`.

## P1 — remaining scientific mechanisms

- [x] Carbonate and sulfate pressure corrections on evidence-backed thermodynamic
  grids; no constant reaction-volume shortcut outside a demonstrated envelope.
  Evidence: `research/arcs/research-thermo-pressure-grid-2026-08-08.md`,
  the digest-pinned generated artifact, Node-only `tools/check-pressure-grid.mjs`,
  bounded runtime consumers, `tests-js/thermo-pressure-grid.test.ts`, and AI Dr.
  Wise `SATISFIED` after the pinned-environment reproducibility rerun on
  2026-08-08.
- [x] Physical etch/dissolution: mass-balanced solid loss, surface retreat/pits,
  solution return, habit-specific kinetics, and reversible visual history.
  Evidence: `research/arcs/research-physical-dissolution-2026-08-08.md`,
  `js/44d-physical-dissolution.ts`, `tools/physical-etch-observe.mjs`,
  `tests-js/etch-overprint.test.ts`, v253 seed-42 baseline/strip/digest/claim-card
  archives, and AI Dr. Wise `SATISFIED` after the ΔG, surface-state,
  bath-protocol, mass-closure, Creative-duration, and schematic-relief hostile
  review loop on 2026-08-08.
- [x] Mixed-carbonate solid solutions with composition-dependent activity and
  recorded zoning where evidence supports it. HMC now uses parent-fluid-bounded
  Mucci partitioning, metastable nonideal calcite–disordered-dolomite component
  activities, exact per-zone `Ca(1-x)Mg(x)CO3` booking/dissolution, and explicit
  unknown Creative verdicts outside measured domains. Rosasite and aurichalcite
  remain Tier-C empirical/observer models because the reviewed evidence does not
  license aqueous-to-solid Cu/Zn partition inference. Evidence:
  `research/arcs/research-mixed-carbonate-solid-solutions-2026-08-08.md`,
  `tests-js/hmc-solid-solution.test.ts`, SIM 255 seed-42 baseline/digest/39-story
  archive, and `proposals/HOSTILE-REVIEW-DR-WISE-SIM255-2026-08-08.md`.
- [x] Thermal field localization: geometry-weighted per-voxel LTE transport,
  finite-volume conservative conduction, explicit rock/source/advection and
  one-way ambient boundaries, immutable source/configuration commands, and
  local nucleation/growth/morphology/diagnosis consumption. Reproducibility
  fingerprints cover voxel fluids/temperatures, dedicated RNG cursors,
  nucleation seed, movement state, and complete zone ledgers. Evidence:
  `research/arcs/research-thermal-field-localization-2026-08-08.md`,
  `research/arcs/research-aragonite-sr-and-ambient-boundaries-2026-08-08.md`,
  `tests-js/thermal-localization.test.ts`, SIM 256 seed-42 baseline,
  39-story archive, 12-story digest, 39 claim cards, and
  `proposals/HOSTILE-REVIEW-DR-WISE-SIM256-2026-08-08.md`.
- [x] Complete open-system carbonate migration for travertine and sabkha.
  Travertine pins its initial DIC/alkalinity and authored vent receipts; sabkha
  runs 24 explicit replacement-water transactions with no unresolved transfer,
  while `salinity_model_missing` keeps its high-salinity results qualitative.
  Evidence: `tools/carbonate-boundary-observe.mjs`,
  `tools/sabkha-carbonate-observe.mjs`, and
  `tests-js/carbonate-boundary-conservation.test.ts`; AI Dr. Wise returned
  `SATISFIED` after the permanent fail-closed and raw-salinity review loop.

## P2 — scenario and content science

- [ ] Weathering/vadose epilogues with explicit O2, CO2, drainage, light, and
  dissolution/replacement histories rather than final-state labels.
- [ ] Roughten Gill primary-stage reconstruction before its supergene sequence.
- [ ] Zn/cation competition sinks and remaining orphaned analytical solutes.
- [ ] BIF/crocidolite/tiger's-eye scenario built from locality-grade evidence.
- [ ] Re-run every locality envelope and negative-evidence constraint against the
  current engine; resolve Bingham/Bisbee and any remaining species mismatches.
- [ ] Retire stale inline narrative fallbacks and generate the narrative manifest.

## P3 — product quality gates that can be completed locally

- [ ] Browser automation for start/run/pause/cancel/save/reload/replay, scenario
  selection, Creative edits, hover diagnosis, keyboard use, and reduced motion.
- [ ] Responsive UI repair across narrow/tall and landscape phone viewports;
  touch targets, safe-area insets, no clipped controls, readable overlays.
- [ ] Performance and memory budgets with repeatable traces; no orphaned local
  server or worker processes.
- [ ] Save migration, corrupt-save recovery, deterministic replay digests, and
  crash-safe local persistence.
- [ ] Progression/tutorial pass that teaches causal geology while preserving the
  complete Creative laboratory.
- [ ] Accessible audiovisual controls, captioned/visual event equivalents,
  contrast/focus audits, and scalable text.
- [ ] Scenario-authoring validation, preview, deterministic fixture generation,
  provenance fields, and content regression receipts.

## P4 — release systems that can be prepared locally

- [ ] Versioned content packs, changelog/migration policy, telemetry-free local
  diagnostics, export/import, and stewardship documentation.
- [ ] Production asset manifest, level-of-detail policy, audio mix states, and
  art-direction briefs for the remaining human-made assets.

## External gates — evidence can be prepared, certification cannot be invented

- [ ] Real iOS/Android device, browser, thermal, battery, and assistive-technology
  matrix performed by humans on physical hardware.
- [ ] Human causality/usability study with representative players.
- [ ] Review/sign-off by an actual mineralogist/geochemist; the AI “Dr. Michael
  Wise” is a hostile-review role, not the real scientist or Smithsonian.
- [ ] Human art direction, licensed final assets, store/legal/privacy review, and
  deployment approval.

## Definition of planned-complete

All local P0–P4 boxes are checked with linked tests/receipts and repeated AI Dr.
Wise review returns `SATISFIED`. External gates must have a runnable protocol and
evidence pack, but remain honestly marked external until humans execute them.
