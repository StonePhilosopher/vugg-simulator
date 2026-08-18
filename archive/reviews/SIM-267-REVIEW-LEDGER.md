# Vugg Simulator SIM 267 — Daily Review Ledger

## Purpose

Review Claude's pushed SIM 267 integration candidate in small daily slices, then compare Codex's authored branch/handoff and Flint's revised infrastructure when they arrive. Science precedes gameplay. Findings distinguish actual bugs, deliberate approximations, scientific disagreements, and documentation debt.

## Pinned Candidate

- Review commit: `cbeace5e336ebc46a71f4657a759e73f3ee0d093` (`cbeace5e336e`)
- Builder ref at verification: `syntaxswine/offline-scenario-menus-v267`
- Subject: `fix: restore offline scenario menus`
- Verified fetched and resolvable locally: 2026-08-16 07:23 EDT.
- Every slice must record this exact SHA. A newer builder commit does not silently replace it; update this pin explicitly before reviewing a different formation.

## Daily Slice Contract

- One bounded subsystem, normally 60–90 minutes.
- Read its proposal/research, implementation, tests, generated evidence, and at least one counterexample or control.
- Record commands, observed results, verdict, severity, and the next seam.
- Read-only by default. Do not merge, rebase, regenerate authoritative baselines, or modify the candidate unless Professor authorizes a fix.
- Delegate only concrete independent checks or clearly bounded fixes. Keep cross-system judgment and final verdict here.
- Notify Professor only for a material finding, completed review tranche, blocker, or needed decision.

## State Machine — Prevent Repeated Work

Each slice has one stable ID and exactly one state: `PENDING`, `IN_PROGRESS`, `BLOCKED`, or `DONE`.

1. Before work, scan the queue and entries. Never select a `DONE` slice.
2. If any slice is `IN_PROGRESS`, resume it instead of claiming another. If its prior run stopped, append a continuation note; do not restart its completed checks.
3. Otherwise claim the first eligible `PENDING` science slice by changing it to `IN_PROGRESS` and recording the candidate commit plus start time under Entries.
4. Mark `DONE` only after the ledger contains: scope, files/claims inspected, commands and controls, results, classified findings, verdict, and next seam.
5. If evidence cannot be completed, mark `BLOCKED` with the exact missing condition. Resume that slice when the condition changes.
6. A sub-check delegated to a helper is recorded under the parent slice. It does not create a second review slice or permit the parent to be marked `DONE` before its result is integrated.
7. Before ending each run, reconcile the queue state against Entries. The queue is the index; Entries are the receipt.

## Review Queue

### Science pass

- [x] `SCI-01` — `DONE` — Carbon and sulfur conservation boundaries; phase/reservoir identity.
- [x] `SCI-02` — `DONE` — Carbonate/sulfate thermodynamics, units, pressure and temperature behavior.
- [ ] `SCI-03` — `PENDING` — Locality-specific claims versus universal rules; counterexample scenarios.
- [ ] `SCI-04` — `PENDING` — Mineral identities, transformations, solid solutions, and paragenetic competition.
- [ ] `SCI-05` — `PENDING` — Cavity mass/water/material conservation and dissolution authority.
- [ ] `SCI-06` — `PENDING` — Citations, claim cards, receipts, baselines, and calibration authority.

### Game pass

- [ ] `GAME-01` — `PENDING` — Start → act → save → load → finish → restart core loop.
- [ ] `GAME-02` — `PENDING` — Scenario playability and meaningful player choices.
- [ ] `GAME-03` — `PENDING` — Tutorials and Creative controls.
- [ ] `GAME-04` — `PENDING` — Library, Fortress, strips, Record Groove, topology views, and mobile controls.
- [ ] `GAME-05` — `PENDING` — Agent API/browser parity, performance, autosave, and failure recovery.

### Crossing pass

- [ ] `CROSS-01` — `PENDING` — Science/play seams: correct chemistry producing meaningful choices, and displayed explanations matching state.

## Entries

### 2026-08-17 — SCI-02 — Carbonate/sulfate thermodynamics, units, pressure, and temperature behavior

- State: `DONE`
- Candidate: `cbeace5e336ebc46a71f4657a759e73f3ee0d093`
- Started: 2026-08-17 13:00 EDT (17:00 UTC)
- Finished: 2026-08-17 13:35 EDT (17:35 UTC); bounded parallel review slice.
- Scope: Carbonate/sulfate thermodynamics, units, pressure and temperature behavior.
- Files and claims inspected:
  - Research/proposal and declared authority: `research/arcs/research-carbonate-pressure-thermodynamics-2026-08-11.md`, `research/arcs/research-carbonate-kinetics-2026-08-09.md`, `research/arcs/research-sulfate-thermodynamics-2026-08-12.md`, `proposals/HOSTILE-REVIEW-DR-WISE-SIM254-2026-08-08.md`, `data/generated/science-provenance-manifest.json`, and the committed claim cards/strips under `archive/claim-cards/v267` and `archive/strips/v267`.
  - Carbonate implementation: `data/thermo-carbonates.json`, `js/20a-chemistry-activity.ts`, `js/20b-chemistry-carbonate-system.ts`, `js/20e-thermo-carbonate-Ksp.ts`, `js/20f-thermo-pressure-corrections.ts`, `js/32b-supersat-carbonate-Ksp.ts`, `js/52b-engines-carbonate-kinetics.ts`, and `js/99j-helix-overlay.ts`.
  - Sulfate implementation: `data/thermo-sulfates.json`, `js/20d-chemistry-sulfate-Ksp.ts`, `js/20f-thermo-pressure-corrections.ts`, `js/40b-supersat-sulfate-Ksp.ts`, and `js/60-engines-sulfate.ts`.
  - Tests/evidence/tooling: focused carbonate, sulfate, activity, pressure-grid, pressure-science, promotion, kinetics, and claim-card tests under `tests-js/`; `tools/check-pressure-grid.mjs`, `tools/review-claim-card.mjs`, `tools/audit-evidence.mjs`, `tools/audit-science.mjs`, `archive/evidence/v267.json`, and all 126 receipt-listed artifacts.
  - External controls used the exact cited authorities: USGS PHREEQC `wateq4f.dat` phase definitions and PHREEQC's documented `-analytical_expression` precedence, IAPWS R11-24 water-ionization values, and the Plummer-Wigley-Parkhurst calcite rate law.
- Commands and controls:
  - Fetched remotes and retained the ledger-pinned exact SHA even though `syntaxswine/main` subsequently advanced. Exported `cbeace5e...` into disposable exact-source trees; no merge, source edit, baseline regeneration, or authoritative artifact write occurred. The main worktree's user-owned untracked `grimsel-gwindel-play.{mjs,ts}` files remained untouched.
  - `npm run build` passed. Focused Vitest campaigns passed `13/13` files and `171/171` tests, then `6/6` files and `123/123` tests. Independent bounded helper checks under this parent slice passed carbonate `107/107`, sulfate `36/36` plus `55/55`, and evidence `9/9`; their numerical controls and source claims were independently integrated here.
  - `npm run check:pressure-grid` passed with digest `cf84b9f5da62b9fec0caad8713af24b1845c3f274df18f87eb45cf4c66620c4b`. Supported positive controls included calcite and barite at 25 C/4.4 kbar; unsupported mineral, pressure-unit, and temperature-unit counterexamples failed closed. Water-activity and CaSO4 phase/kinetics separation controls also passed.
  - Independent PHREEQC control evaluated the committed constant-delta-H sulfate equations against each cited database analytical expression at 100 C: gypsum `-4.5961` versus `-4.8515`, anhydrite `-4.6119` versus `-5.3216`, barite `-9.0344` versus `-9.5283`, and celestine `-6.7828` versus `-7.1606`; all four exact controls failed. At 150 C, anhydrite, barite, and celestine errors exceeded one log unit. At 200 C, barite's candidate `-8.2483` versus analytical `-10.1891` reverses the claimed qualitative temperature behavior.
  - Recomputed archived sulfate SI while holding each sample's IAP and pressure term fixed and replacing only K(T) with the cited PHREEQC expressions. Anhydrite changed SI sign in `449` samples across `8` scenarios; barite in `29` across `2`; celestine in `285` across `5`. Within anhydrite's declared 100-300 C kinetic window, `278` stored negative SI values became positive; `275` also had recorded pH 5-9 and nonzero sulfur, crossing the engine's load-bearing `SI > 0` limb (the archive lacks enough sulfate-reservoir testimony to assert the whole gate). Representative changes: MVT at 169.4 C `-1.386 -> +0.697`, reactivated fluorite vein at 152 C `-1.008 -> +0.694`, and Wittichen at 163.8 C `-1.575 -> +0.382`.
  - Pressure-envelope controls held an identical calcite fluid at 4.4 kbar: 90 C applies `+3.0114` delta-logK and gives SI `-0.3303`, while 90.000001 C silently applies zero and gives SI `+2.6812`; sigma jumps from `0.623` to `639.4`. The lower 10 C edge similarly jumps by `3.474` log units. All eight supported reactions have nonzero edge drops. Archive replay found `252` temperature-envelope crossings across `24` scenarios, with per-scenario maxima from about `1.99` to `5.84` SI units.
  - Far-undersaturation PWP counterexamples produced finite forward rates but divergent net rates: one acidic state at SI `-23.7383` returned `-4.87836e16 mol cm^-2 s^-1`; another returned a net/forward magnitude ratio of about `5.2e7`. Existing tests cover sign and equilibrium, not far-under magnitude.
  - Mg control fixed molar Mg/Ca at `2` (`Ca=40.078`, `Mg=48.61 mg/kg`): the implementation read the mass ratio `1.2129` and returned inhibition factor `0.8541` instead of the intended midpoint `0.575`. Fleet initial-state replay showed large changes, including Searles `0.736` versus molar-correct `0.335` and Chiastolite `0.823` versus `0.492`.
  - Unit/source audit traced concentration fields declared as `mg/kg solvent` into overlay/strip testimony labelled `mg/L` for DIC, carbonate species, and O2, with no density or species-molar-mass conversion. All 41 strips and 41 claim cards inherit the label; no focused test asserts it.
  - IAPWS water-ionization control found `_logActivityOH` hard-codes `pOH=14-pH`. At 100 C, official pKw is about `12.25` at low pressure, so two-OH mineral SI is understated by about `3.5` logs and six-OH mineral SI by about `10.5` logs before pressure effects. These hydroxycarbonates are observer-only in this path, so no v267 baseline growth change was demonstrated.
  - Exact-commit evidence control: `npm run science:verify` failed immediately because committed `index.html` is out of date. `npm run audit:evidence` reported a stale receipt and `npm run audit:science` reported ten identity/producer violations. All `126` archived leaf hashes individually match their receipt entries, but the receipt browser/execution roots do not authenticate the exact candidate executable/producers. The committed bundle SHA is `5b577305...`, a fresh exact-source bundle is `396abc44...`, and the receipt claims `d35e2aa...`; Windows CRLF assets and Node/V8 identity differ from the review host. `npm run build:check` passes only after producing the fresh local bundle, not on the untouched exact commit.
  - Range/evidence counterexamples found unflagged evaluation outside per-phase `valid_T_range_C` (for example porphyry anhydrite SI at `398.26 C` despite a declared 300 C maximum). Claim cards assess pressure only at authored initial T/P, while dynamic strips omit per-step pressure-correction/status testimony; six scenarios vary pressure and `tn457_barite_pulses` crosses the 90 C carbonate boundary. The pressure-grid checker proves JSON/runtime equality and declared source strings, but the repository explicitly lacks raw Reaktoro output/generator commissioning material.
- Results and classified findings:
  - **HIGH — actual scientific bug:** sulfate K(T) uses constant-delta-H van't Hoff fits even where the cited PHREEQC database supplies analytical expressions that take precedence. Numerical errors are material by 100 C, exceed one log unit for several phases at higher T, can reverse qualitative barite behavior, and flip hundreds of archived SI signs including the load-bearing anhydrite supersaturation limb. The passing tests check 25 C anchors and loose trends, so they ratify the shortcut rather than the cited equations.
  - **HIGH — actual scientific bug:** pressure correction silently becomes zero immediately outside each fitted temperature envelope. This creates multi-log discontinuities and 1000x-or-larger sigma jumps rather than returning an unsupported state or a justified bounded continuation; dynamic v267 scenarios cross these edges routinely.
  - **HIGH — evidence authentication blocker:** the exact pinned commit cannot pass its own science/evidence verification. Matching leaf hashes do not bind the artifacts to the committed browser executable or declared producers. Root-cause remediation belongs in `SCI-06`, but the generated evidence cannot be accepted for this slice.
  - **MEDIUM — actual kinetics bug/API hazard:** the claimed PWP-equivalent `r_forward * (1 - 1/Omega)` diverges as Omega approaches zero and is not the finite reverse term in the cited PWP law. Current growth code guards the undersaturated path and uses a separate dissolution heuristic, limiting demonstrated v267 baseline impact, but the exposed rate is scientifically false and hazardous for future consumers.
  - **MEDIUM — actual units bug:** calcite Mg poisoning feeds ppm mass Mg/Ca into a model parameterized as molar Mg/Ca, materially underestimating inhibition in several scenarios. Production calcite/HMC rates consume the wrong factor.
  - **MEDIUM — evidence/display units bug:** mg/kg-solvent model values, including carbonate-species values still on a CO3-equivalent basis, are presented as mg/L without density or species-mass conversion.
  - **MEDIUM — observer thermodynamics bug:** hydroxycarbonate SI uses a fixed pKw of 14 despite large temperature/pressure dependence; the error is several to more than ten SI units at 100 C depending on OH stoichiometry. This path is observer-only in v267.
  - **MEDIUM — validity/evidence gap:** per-phase temperature ranges are not enforced or surfaced, and initial-only claim cards plus pressure-opaque strip testimony can hide dynamic correction activation/deactivation. The pressure grid's commissioning calculation is documented as non-reproducible from repository contents.
  - **Deliberate approximations / passing seams:** carbonate analytic Ksp held flat above 90 C, Davies activity clamping above its stated range, NaCl-equivalent water activity, HMC bounding, and reduced carbonate chemistry are disclosed approximations. DIC ionic-strength simplification produced only small initial-state divalent-SI differences in controls. Unsupported pressure reactions and obvious C/kbar unit mistakes fail closed; CaSO4 phase selection is separate from kinetics.
- Verdict: **FAIL / HOLD; do not accept the pinned SIM 267 candidate on SCI-02.** The sulfate temperature-law mismatch and pressure-envelope discontinuities alter phase eligibility and archived supersaturation testimony. Evidence authentication independently prevents acceptance. Correct against the cited PHREEQC analytical expressions (or explicitly cite and validate a different bounded model), make pressure-envelope exits fail closed or smoothly/judiciously continue with visible status, add numerical edge controls, then rebake and authenticate evidence from the exact candidate executable.
- Next seam:
  - Correction acceptance should add exact PHREEQC-value controls at multiple temperatures, dynamic pressure-edge continuity/unsupported-state controls, molar Mg/Ca and far-under PWP magnitude controls, pKw(T,P) controls, and end-to-end evidence-unit assertions. Recalculate affected v267 strips/claim cards and disclose any baseline changes.
  - `SCI-03` is now the first eligible pending science slice: locality-specific claims versus universal rules and counterexample scenarios. Do not start the game pass. Preserve `SCI-06` for the aggregate receipt/build/provenance root-cause review rather than repeating this slice's demonstrated authentication failure.

### 2026-08-17 — SCI-01 correction addendum — Codex SIM 268

- State: `FAIL / correction not yet accepted`
- Correction candidate: `0dd0b05a572cd2a52219411e579fe506318b7222`
- Builder ref: `syntaxswine/codex/sim268-sulfur-valence-authority`
- Subject: `fix(science): enforce sulfur valence authority`
- Verified fetched and resolvable locally: 2026-08-17 08:59 EDT.
- Scope: Verify the SCI-01 repair contract without repeating the completed original review.
- Commands and controls:
  - Tested the exact commit in disposable worktree `/tmp/vugg-sci01-0dd0b05.s4S3j0`; the user's main worktree and its untracked Grimsel files were not changed.
  - `npm run build` completed. Focused Vitest run over sulfur authority, pre-existing sulfur conservation/scenarios, carbon boundary/localization, strip storage, and Wittichen: `8/8` files and `159/159` tests passed.
  - Source control: `rg` found no remaining direct `this.fluid.S` reads in the carbonate, halide, native, silicate, sulfate, or sulfide supersaturation engines covered by the regression test. Sulfate and sulfide admission now route through `sulfateAvailablePpm` and `sulfideAvailablePpm` respectively.
  - The paired brochantite/sphalerite controls prove a huge wrong-valence pool cannot admit or inflate the phase when the correct pool is zero or independently fixed. A legacy inherited-sulfate control also prevents reinterpretation as sulfide.
  - Carbon controls cover solved-vs-target pCO2 uncertainty, explicit zero charge, and reverse-direction degas narration; the implementation tracks `lastSolvedPCO2Bar`, distinguishes absent from explicit-zero charge fields, and narrates import versus export from the signed boundary delta.
  - Generated-evidence control: searched all v268 strip archives, claim cards, and the aggregate evidence receipt for `sulfur_ledger`, `phaseIdentity`, and `fluidReservoirPpm`. No generated artifact contains them. `tools/gen-strip-archive.mjs` exports carbonate testimony at line 213 but has no sulfur testimony export; `tools/review-claim-card.mjs` likewise has no sulfur consumer. The new focused test stops at `StripRecorder.finalize()` and storage round-trip, so it does not test the authoritative archive/claim-card path.
  - Reproducibility observation: after `npm run build`, `npm run audit:science` reported ten aggregate evidence mismatches. Restoring the committed `index.html` then made `audit:science`, `audit:evidence`, and `build:check` fail because the committed browser bundle does not match the freshly built `dist` executable. The visible build delta is in embedded file-asset receipt/content, so this needs reconciliation before the v268 evidence set can be called reproducible.
- Results and classified findings:
  - **PASS — sulfur admission authority:** the original HIGH scientific defect is corrected in production supersaturation consumers and defended by paired wrong-valence controls.
  - **PASS — carbon edge cases:** all three SCI-01 carbon defects are corrected and covered by focused tests.
  - **HIGH — acceptance/evidence blocker:** generated v268 products do not contain the promised sulfur-ledger testimony. Phase identity and conservation remain invisible in the authenticated strip/claim-card archive even though an in-memory recorder field exists. This leaves the original evidence requirement unmet and permits future archive regressions to escape the new test.
  - **MEDIUM — evidence reproducibility blocker:** a clean exact-commit build changes `index.html`, after which science/evidence authentication fails; restoring the committed bundle causes runtime-identity and build-check failures. This may belong to SCI-06 for root-cause classification, but it blocks acceptance of the commit's claim that it commissions an authenticated SIM 268 evidence set.
- Verdict: **FAIL / do not accept `0dd0b05` yet.** The chemistry and carbon corrections are substantively good, but the repair contract explicitly required generated sulfur testimony, not merely an in-memory field. Wire `sulfur_ledger_testimony` through `gen-strip-archive.mjs` and `review-claim-card.mjs`, add archive/claim-card identity tests, rebake the v268 artifacts, and make `build:check`, `audit:science`, and `audit:evidence` agree on the exact commit.
- Next seam: Recheck only the missing generated-evidence/reproducibility path as a second SCI-01 addendum. Do not repeat the already-passing chemistry controls. `SCI-02` remains queued but should not be advanced as if SCI-01 acceptance were clear.

### 2026-08-17 — SCI-01 second correction addendum — Codex SIM 269

- State: `PARTIAL PASS / correction not yet accepted`
- Correction candidate: `0143cb2667740d07d2dc19a17c37568e56391310`
- Builder ref: `syntaxswine/codex/sim268-sulfur-valence-authority`
- Subject: `fix(evidence): authenticate sulfur testimony`
- Verified fetched and resolvable locally: 2026-08-17 22:09 EDT.
- Scope: Recheck only the missing generated sulfur testimony and exact-commit reproducibility path identified by the prior addendum.
- Commands and controls:
  - Tested the exact commit in disposable worktree `/tmp/vugg-269-review.FOwbo0`; the main worktree was not changed.
  - Source/diff inspection confirms `sulfur_ledger_testimony` is projected into canonical strips, summarized with exact samples in JSON claim cards, rendered in Markdown cards, and defended by archive/card identity assertions. The v269 fleet contains 41 strips, 82 claim-card files, and a 126-artifact aggregate receipt.
  - The Supergene mid-run activation now snapshots legacy combined sulfur before the event, projects that inventory through the same explicit split used after activation, and declares the sulfate recharge as a boundary addition. The resulting card exposes 131/131 closed samples from step 70 with phase-resolved reservoirs and activation receipt.
  - After building in the disposable checkout, the focused 8-file suite passed `126/127`; sulfur/scenario/carbon/card tests passed, while `artifact-identity.test.ts` failed because the aggregate receipt did not match the current executable/data bytes.
  - A clean exact-commit `npm run build:check` failed before build because committed `index.html` was out of date. `npm run build` changed two embedded file-asset lines, including the bundle asset digest. After that build, `build:check` passed but `audit:science` failed with ten violations: browser bundle, execution set, Node/V8 runtime, and all seven producer contracts.
  - The committed evidence was produced on Node 24.15.0/V8 13.6 on win32-x64; this verifier used Node 22.23.2 on Linux. Runtime binding explains one mismatch but not the independently demonstrated committed-bundle delta. The current production contract is therefore not clean-clone/cross-platform reproducible.
- Results and classified findings:
  - **PASS — generated sulfur evidence seam:** canonical strips and both claim-card formats now carry substantive phase-resolved sulfur testimony, and the tests assert exact projection, activation, phase totals, and closure.
  - **PASS — honest versioning/baseline disclosure:** the Supergene accounting correction changed canonical output, so commissioning SIM 269 while preserving SIM 268 artifacts is the correct provenance decision.
  - **HIGH — reproducibility/authentication blocker remains:** the pushed exact commit does not pass its own acceptance path in a clean Linux checkout. Building changes the committed browser bundle, then invalidates the aggregate receipt and producer bindings; without building, tests cannot load `dist` and `build:check` fails.
- Verdict: **PARTIAL PASS / do not accept `0143cb2` as fully authenticated yet.** The SCI-01 sulfur science-and-publication contract is now substantively repaired, but the handoff's claim that build/evidence authentication all pass is not reproducible from the pushed commit. Regenerate and commit the bundle/evidence from a deterministic producer contract, or explicitly define and test platform-specific evidence sets; then prove a clean checkout can run `build:check`, artifact identity, `audit:science`, and `audit:evidence` without first mutating authenticated bytes.
- Next seam: Recheck only the clean-checkout bundle/evidence identity path. Do not repeat sulfur chemistry, carbon, or claim-card projection tests. Keep the broader aggregate provenance root-cause work assigned to `SCI-06` if the correction requires architectural changes.

### 2026-08-16 — SCI-01 — Carbon/sulfur conservation and reservoir identity

- State: `DONE`
- Candidate: `cbeace5e336ebc46a71f4657a759e73f3ee0d093`
- Started: 2026-08-16 13:00 EDT (17:00 UTC)
- Finished: 2026-08-16 13:11 EDT (17:11 UTC); bounded parallel review slice.
- Scope: Carbon and sulfur conservation boundaries; phase/reservoir identity.
- Files and claims inspected:
  - Research/proposal: `research/arcs/research-silica-sulfur-correction-2026-08-06.md`, `research/arcs/research-carbonate-boundary-science-2026-08-08.md`, `research/arcs/mammoth-travertine-benchmark-receipt-2026-08-08.md`, `proposals/PROPOSAL-FLUID-S-SPLIT-2026-07-17.md`, `proposals/HOSTILE-REVIEW-DR-WISE-SIM254-2026-08-08.md`, and `proposals/OPEN-IMPROVEMENTS-LEDGER-2026-08-08.md`.
  - Carbon implementation: `js/20b-chemistry-carbonate-system.ts`, `js/19-mineral-stoichiometry.ts`, `js/70l-co2-events.ts`, `js/70k-evaporite.ts`, `js/85c-simulator-state.ts`, and relevant declarations in `data/scenarios.json5`.
  - Sulfur implementation: `js/19-mineral-stoichiometry.ts`, `js/20-chemistry-fluid.ts`, `js/20c-chemistry-redox.ts`, `js/36-supersat-native.ts`, `js/40-supersat-sulfate.ts`, `js/40b-supersat-sulfate-Ksp.ts`, `js/41-supersat-sulfide.ts`, `js/56-engines-native.ts`, `js/60-engines-sulfate.ts`, `js/61-engines-sulfide.ts`, `js/70m-sulphur-bank.ts`, and `js/70n-sicily.ts`.
  - Tests/evidence: `tests-js/carbonate-boundary-conservation.test.ts`, `tests-js/carbonate-localization-equilibration.test.ts`, `tests-js/silica-sulfur-reservoirs.test.ts`, `tests-js/sulphur-bank.test.ts`, `tests-js/sicily.test.ts`, v267 claim cards and strips for travertine, sabkha, Sulphur Bank, and Sicily, `tests-js/baselines/seed42_v267.json`, `archive/evidence/v267.json`, and `data/generated/science-provenance-manifest.json`.
- Commands and controls:
  - `git fetch --all --prune`; verified `syntaxswine/offline-scenario-menus-v267` still resolves to the pinned full SHA. `git log origin/main..cbeace5e...` localized the sulfur/carbon formation commits.
  - Exported the exact SHA with `git archive` to disposable `/tmp/vugg-sci01-cbeace5e.J18v5f`; `npm run build` passed. The first focused Vitest invocation correctly refused the uncompiled archive (`dist/ is empty`), so the disposable copy was built and the same tests rerun. This was setup precondition evidence, not a candidate failure.
  - `vitest run tests-js/silica-sulfur-reservoirs.test.ts tests-js/sulphur-bank.test.ts tests-js/sicily.test.ts tests-js/carbonate-boundary-conservation.test.ts tests-js/carbonate-localization-equilibration.test.ts`: `5/5` files, `111/111` tests passed. Controls included closed/open divergence, no-bracket atomicity, inconsistent DIC/alkalinity and unsupported-phase permanent blocks, partial-fill and unreceipted-DIC fail-closed paths, hydroxycarbonate rejection, native-S exclusion from dissolved sulfide, undeclared sulfur creation rejection, H2S-to-S0 oxygen closure, and full Sulphur Bank/Sicily ledger closure.
  - Independent helper split was bounded under this parent slice: carbon check (`50/50` focused tests plus archive identity calculation) and sulfur check (`61/61` focused tests plus cross-engine source audit). Both results were independently checked against the exact-SHA source before integration.
  - Whole-system archive control: for every carbonate testimony sample, evaluated `DIC + headspace + solid - cumulative imports + cumulative exports` relative to the first sample with `jq`. Maximum drift was `4.73232564246473e-15 mol/kg` for travertine (60 samples) and `7.805388280157644e-15 mol/kg` for sabkha (260 samples); all samples reported `blocked=false`.
  - `sha256sum` for the eight relevant v267 strip/claim-card JSON files matched every corresponding digest in `archive/evidence/v267.json`.
  - Counterexample/source control: exact-SHA `git grep` shows `sulfideAvailablePpm` has no production supersaturation consumer. In `js/41-supersat-sulfide.ts`, sulfate-only explicit fluid can pass a reducing redox gate and drive sulfide sigma from total `fluid.S`; in most `js/40-supersat-sulfate.ts` engines, a trace `S_sulfate` unlocks a sigma dominated by large wrong-valence `S_sulfide`. The correct shell-reservoir debit then caps growth, so conservation tests can pass while phase admission is false. No paired wrong-pool negative test currently exists.
- Results and classified findings:
  - **HIGH — actual scientific bug:** sulfur bookkeeping is reservoir-correct, but phase admission is not. `stoichiometricReservoirSpecies` correctly books sulfate minerals to `S_sulfate`, native sulfur to `S_elemental`, and sulfides to `S_sulfide`; LIFO returns and whole-grid boundary totals close. However, only barite/celestine and the shared CaSO4 evaluator use sulfate availability, while most remaining sulfate engines calculate gates/factors/ratios from observer `fluid.S = S_sulfide + S_sulfate`; the sulfide supersaturation family also calculates from total `fluid.S`, with no production use of `sulfideAvailablePpm`. A wrong-valence pool can therefore admit or strongly inflate the wrong phase. This contradicts the explicit S1/S2 migration proposal and the later SIM 243 research/model-digest claim that each family spends an independently available reservoir. Conservation closure masks the identity defect.
  - **MEDIUM — actual carbon bug:** after a closed boundary solve, `_applyOpenAtmosphereEquilibration` recomputes uncertainty flags from authored `state.targetPCO2Bar` instead of solved headspace `pCO2Bar`. Closed mode can therefore omit `gas_nonideality_missing` when actual pCO2 exceeds 1 bar.
  - **MEDIUM — actual carbon bug:** `event_co2_charge` uses falsy `||` defaults, so an explicitly authored zero charge becomes the default 100 ppm-as-CO3 import (`1.66639 mmol C/kg`). Carbon still closes, but boundary intent/source identity is false.
  - **MEDIUM-LOW — actual carbon semantics bug:** `event_co2_degas` permits a target above current pCO2, which imports carbon while still narrating a vent/export and displaying zero export. Current travertine events are true losses, so archived v267 output is unaffected.
  - **MEDIUM — evidence/documentation debt:** sulfur closure and independent-pool identity appear in the model digest and research claims, but v267 strips/claim cards expose no sulfur-pool or sulfur-ledger trajectory. `archive/evidence/v267.json` authenticates those artifacts but cannot substantiate the hidden sulfur claim. The focused tests prove closure but omit sulfate-vs-sulfide wrong-pool admission controls.
  - **LOW — documentation debt:** stale comments in `js/20b-chemistry-carbonate-system.ts` and `js/70-events.ts` still describe an absent conserved boundary as retaining legacy open-pH behavior; runtime actually fails open reservoirs closed.
  - **Deliberate approximation:** carbonate totals are internally conservative simulator inventories, but solid carbon is the calibrated axial-growth budget rather than a physical whole-cavity mass derived from rendered crystal volume/density. The ideal-dilute PB82/Henry/reduced-alkalinity limits and sabkha's high-salinity qualitative status are disclosed. Sulfur dissolution generally returns the booked reservoir rather than dynamically resolving oxidation/speciation, also a bounded state-vector approximation rather than a full reaction network.
- Verdict: **FAIL / do not accept the candidate on SCI-01 yet.** Carbon conservation itself receives a conditional pass and archived carbon ledgers close at femtomole scale, but the high-severity sulfur phase-admission defect breaks the claimed reservoir identity. Passing conservation tests do not neutralize it.
- Next seam:
  - Acceptance blocker: migrate every sulfur-bearing supersaturation gate, factor, and sulfate/carbonate ratio to `sulfideAvailablePpm` or `sulfateAvailablePpm` as appropriate; add paired zero/trace-correct-pool versus large-wrong-pool negative controls and publish sulfur ledger testimony in generated evidence. Also add carbon controls for closed target-vs-actual pCO2 uncertainty, explicit zero charge, and reverse-direction degas narration.
  - Next queued review slice remains `SCI-02`: carbonate/sulfate thermodynamics, units, pressure, and temperature behavior. Do not begin the game pass.

### 2026-08-16 — Setup

- Candidate: `syntaxswine/main` through `a790e06` at setup time.
- Superseded review pin: Professor identified `cbeace5e336e` as the latest builder commit to check. Fetch verified full SHA `cbeace5e336ebc46a71f4657a759e73f3ee0d093` on `syntaxswine/offline-scenario-menus-v267`; this is now the candidate for all queued slices.
- Claude's inheritance review claims fixed incomplete evidence bake and shebang-triggered early Vitest abort; one low-severity tiger's-eye default remains open.
- Flint compatibility reconnaissance found #4/#8 conflict with SIM 267 and #7 contains a hidden semantic lockfile merge failure.
- First daily science slice: carbon and sulfur conservation/reservoir identity.

### 2026-08-16 — Builder-authored handoff claims for the pinned layer

Professor supplied the builder's own account. Treat these as scoped hypotheses to verify against the relevant commits, not as acceptance evidence:

- `b1983d9` contributed useful testing guidance and bug documentation but no new executable harness.
- The builder carried forward the useful principles into the existing automated workflow and rejected a stale assumption that Python is required to establish operability.
- Creative-control tests were changed to release large generated page/simulation graphs after assertions, intended as memory hygiene without reduced coverage.
- The Marching Cubes performance test now uses bounded identical observations to distinguish persistent regression from a one-sided scheduling/GC pause; claimed thresholds remain 70 ms steady-state and 150/250 ms hard limits.
- The described transport/interface work intentionally did not bump simulation or scientific-model versions because equations, scenario inputs, execution bundle, and evidence outputs are claimed unchanged.

Scope caution: `b1983d9..cbeace5e336e` spans a much larger SIM 267 formation with explicit science, cavity, evidence, release, and interface commits. The no-version-bump claim must therefore be tested against the specific transport/interface layer it describes, not generalized to the entire range.
