# PR 28 — explicit recipe corrections on the current baseline

Local validation is complete for execution digest `d1944009…bb77`. Publication
and promotion additionally require fresh configured CI at the published head.
This is not a claim that the full local cold suite ran.

The seven model corrections remain isolated in
`b4b575b6c6d930ff7cf38d9a7bf8457ef2763b3c`. Their acceptance requires
pure-endmember controls, an initiative-delta audit, and a multi-seed comparison
with changed outcomes reported. That original commit is preserved; it has not
been squashed, rewritten, or expanded.

PR head before reconciliation: `c2ffade1d696fb43a8a73f7a0112f8544eea6e2f`.
Pinned current-main comparison: `e2142582c5fa69e6b0dff306ccdc84597533ad1f`.
Reconciliation merges that main into the existing branch. All 17 original
recipe source/data files remain byte-identical after LF normalization to the
reviewed PR head. Existing celestine lineage, quartz recording/replay, viewers,
and browser ownership fixes come from the current baseline.

The incoming branch advanced during measurement to
`d8b420b2b9505bfa934cc782ad433bcd9b373baf` (merge `97d9157e`, evidence updates
`ffa0610d` and `d8b420b2`). Those commits are also preserved as ancestors. They
add no runtime/data differences beyond the already inspected recipe edits.

## The scientific seam

| Existing correction | What changes | What still constrains it |
|---|---|---|
| Olivenite: remove Zn >= 0.5 ppm | Zn-free fluids can produce nonzero sigma | Dominant Cu/As floors, Cu fraction, redox, and the existing rate model |
| Adamite: remove Cu >= 0.5 ppm | Cu-free fluids can produce nonzero sigma | Dominant Zn/As floors, Zn fraction, redox, and the existing rate model |
| Descloizite: remove Cu >= 0.5 ppm | Cu-free fluids can produce nonzero sigma | Pb/Zn/V floors, Zn fraction, redox, and the existing rate model |
| Pyrite: remove T_min 100 C | Low-temperature initiative penalty disappears | Existing sigma/rate behavior and T_max remain |
| Chalcopyrite: remove T_min 180 C | Same | Same |
| Bornite: remove T_min 80 C | Same | Same |
| Native silver: remove T_min 50 C | Same | Same |

The four temperature edits also change the initiative bonus normalization:
300/420/420/250 C becomes the existing 50 C fallback. That narrows the bonus
window and can lower initiative at moderate temperatures. Both signs of delta
are consequences of the inspected seven edits; this tranche preserves them
and adds no further tuning. It does not imply that every crystal gains priority
or independently validate the geological calibration of the 50 C bonus span.

The earlier seed-42-only agreement was insufficient to establish a wider
behavioral boundary. The new comparison is against the *current reconciled*
model, not the obsolete original branch baseline.

## Release identity

The original PR reused SIM 285 and its model token. That is a delivery defect:
`docs/RELEASE-MIGRATION-POLICY.md` requires a new simulation identity when rules
can change geological results, and a new semantic token for a load-bearing
interpretation. An unchanged seed panel does not waive that requirement.

Delivery therefore requires SIM 286, explicit endmember-admission and
temperature-initiative tokens, and core content pack 1.0.3. The seven original
rule edits stay in `b4b575b6`; the identity repair adds no new numerical rule.
The compiled runtime change is checked independently: only the version module
may differ, and its executable differences must be exactly the declared
version/model literals after comments are removed by the compiler.

The comparison has two stages. The first measures the reconciled corrections
before the identity repair. The second compares fresh SIM 286 candidate runs
against the same pinned baseline observations. Those baseline facts may be
reused only with identical execution, harness, runtime and worker-source
identities, verified raw/gzip/timeline hashes, and observed successful exits.
Files and timestamps are copied verbatim; no receipt is rebound. This is local
measurement reuse, not a new cold-CI verdict or independent attestation.

The versioned comparison must report the changed `projection.simVersion` and
`projection.modelDigest` explicitly. Every other changed state value and every
growth-timeline difference remains visible and requires investigation. The
older v285 archives stay historical; normal producers create the v286 evidence.

Checksum-valid checkpoints bearing the old version, old model, or both must be
refused by replay without changing the supplied record. Current checkpoints
must still round-trip. The existing save policy preserves incompatible records
for diagnosis/export; this tranche does not relabel them as new-model runs.

## Required evidence

Runtime: commissioned Windows x64 / Node 24.15.0 / V8 13.6.233.17-node.48 /
ICU 78.2 / en-US. Heavy comparisons and regeneration run serially.

```
npm run build:check
npm test -- --file tests-js/recessive-floor-removal.test.ts --file tests-js/recipe-rung1-initiative.test.ts
node --max-old-space-size=512 tools/recipe-rung1-audit.mjs --base-root <checkout of e2142582>
npm run gen:browser-receipt
npm run science:rebake
npm run gen:release
node pilots/calcite/census.mjs --output pilots/calcite/volume-census.json
node pilots/calcite/record.mjs
node pilots/calcite/golden.mjs
node pilots/calcite/factor-report.mjs
node --max-old-space-size=1024 tools/recipe-rung1-mechanism-proof.mjs
```

`recipe-rung1-audit.mjs` compares all 41 authored scenarios at seeds 1, 2, and
42: 123 pairs, 246 independent runs. Each child has a bounded heap and duration,
records its native lifetime, and exits before the next child starts. Cache reuse
requires exact runtime, execution, harness, and audit-source identities; saved
state and timeline digests are checked on reuse. Local checkpoints remain local
reproduction evidence, not independent attestation.

The scenario comparison uses the canonical scientific projection, including
RNG, chemistry, zones, lineage, contacts, and boundary history, plus explicit
booked crystal volumes. Intermediate growth timelines are hashed separately.
It does not equate different growth histories merely because final mineral
counts match. Changed runs retain the raw states and report changed leaves;
they are not silently rebased or rounded into agreement.

The initiative audit evaluates both sides of every changed decision boundary
and verifies that total initiative changes by exactly the temperature modifier
delta. Tests exercise removed penalties, the narrowed bonus window, retained
ceilings, and finite pure-endmember sigma above the admission threshold, with
the original dominant-floor and fraction controls retained.
These endmember tests establish admission, not a universal promise of later
growth through every competition and mass-budget stage. The existing booking
formulas also require no recessive cation: olivenite books Cu/As, adamite Zn/As,
and descloizite Pb/Zn/V. No consumption rule is changed here.

The two specific control files also run in GitHub CI. The expensive fleet audit
and evidence generation remain local commissioning operations; CI validates
committed evidence and never rebakes it.

## Completed scenario and rule measurements

The first panel completed 123/123 pairs with identical raw scientific state,
booked volumes, summaries, and intermediate growth timelines. The SIM286 panel
completed 123 fresh candidate runs against the same 123 byte-verified baseline
observations. Every pair has exactly two changed leaves:
`projection.simVersion` and `projection.modelDigest`; every other scientific
value and all 123 growth timelines agree. This is 369 actual engine evaluations,
not a claim of 492 fresh evaluations. No case timed out or was retried.

The measured execution digest is
`d1944009b39d0dee86ede656a15c0b98d2be5e56dcc0d6a77d9b94f27be2bb77`.
The original audit producer remains
`723fd754113087bee45844ca531a7aca01ea0dc1983bad5a75ee8137ba8338d7`.
The identity repair changed only `dist/15-version.js`; 283 other execution inputs
are unchanged. After the compiler removes comments, the executable differences
are exactly the version literal and the two appended semantic tokens.

All 22 endmember/initiative/identity controls passed. The first new fixture test
attempt failed because JSDOM supplied a non-file `import.meta` URL; reading the
repository-relative historical fixture repaired that test plumbing. The failed
attempt is retained. Neither the fix nor the retry changed a mineral rule.

The first browser commissioning attempt completed the public-control journeys,
then correctly refused the SIM286 fingerprints against the old SIM285 pins.
The replacement commissioning command uses `--recipe-identity-proof`: in the
actual producing Chrome it must recover each exact prior fingerprint by changing
only SIM/model fields on a comparison copy. It must also recover the prior raw
and compressed download hashes with only those two manifest fields substituted.
The actual run, saves, specimen data, and published download retain SIM286.
No verifier check is removed. The first refusal and owned cleanup verification
are retained separately from the successful commissioning receipt.

Normal science generation and its verification suite passed: 55 tests in seven
files. Release generation then correctly refused the omitted SIM286 changelog
entry. That failed command is retained. After adding the release notes, the
normal release/calcite stages resumed and passed; the completed science outputs
were preserved rather than rebound or relabelled.

The final artifact comparison passed these separate checks:

| Artifact | Observed change |
|---|---|
| Seed-42 calibration baseline | No numerical changes |
| Three-seed occurrence and chemistry tripwire baselines | Only root SIM/model identity |
| All 41 full recording payloads | Only root SIM/model identity |
| Actual controlled Chrome journeys | 15 identity-derived fields, hashes and keys; eight state observations recover exact old fingerprints on comparison copies |
| Production mechanism witnesses | Seven identity-derived fields/hashes, including the browser-proof reference; the observed producer exactly reproduces the normal receipt |
| Calcite fleet | 41 changed fingerprints, each matched to the independent raw projection; every other census field unchanged |
| Calcite geometry and booked-volume goldens | Unchanged |
| Historical v285 artifacts | All 129 files preserved |

The mechanism proof observes the unchanged producer through its shared harness
API, always returns the original values, and restores the observed references
in `finally`. Only separate comparison copies receive old identity fields.
No official receipt, simulator state, zone, or source is rewritten by that
proof. See the [browser proof](evidence/recipe-identity-browser-validation.json)
and [mechanism proof](evidence/recipe-identity-mechanism-validation.json).

The incoming D8 quartz-browser proof remains historical SIM285/R1 evidence at
its recorded execution digest. Current SIM286 download/replay coverage is the
new browser identity proof; the historical receipt is not relabelled as current.

The Test Quarry cost label also advances to SIM286 so old measurement rows are
not presented as current-model measurements. Its existing rejection path is
tested; this adds no scheduler or science authority.

## Evidence and production boundaries

The rebuilt bundle and regenerated receipts must describe the reconciled bytes.
Old receipt sides were used only as starting files during conflict resolution;
their hashes are not manually rebound to claim new execution.

Calcite's existing source-bound census and coverage must be regenerated because
the execution identity changed. This does not close the physical volume-model
discrepancy or opt calcite into production. Booked mass volume and completed
surface volume remain distinct, and the production hold remains in force.

PR 26's separate census-cache defect is outside this correction. PR 32's audit
has its own stacked integration boundary; neither is closed merely by this
scientific approval.

## Final local checks

| Check group | Passed | Files |
|---|---:|---:|
| Endmember / initiative / identity controls | 22 | 2 |
| Normal science verification | 55 | 7 |
| Save and command replay | 79 | 2 |
| Release data / offline bundle | 10 | 2 |
| Browser receipt / native cleanup / cost label | 73 | 4 |
| Affected model and calcite regressions | 270 | 16 |

Groups overlap; these are per-command results, not a summed unique-test count.
Typecheck, exact generated build, science/evidence/release/browser-receipt audits,
and diff hygiene passed. Both real viewer cases passed: existing Three wall
controls and flat view, plus actual disabled-WebGL fallback. All six real-Chrome
ownership/cleanup probe cases passed. Owned test profiles, browser lifetimes,
and temporary ports closed; no new retained helper was created.

The three failed attempts are preserved: the fixture URL plumbing error, the
expected old browser-pin refusal, and the missing changelog token. Their fixes
and successful follow-ups are recorded in the
[machine-readable receipt](evidence/recipe-rung1-validation.json), with exact
commands, runtime, source identities, per-case hashes, and remaining boundaries.
No scenario comparison was retried, and no physical value or tolerance was
changed to make a result agree.

Fresh PR CI, the tested merge tree, main CI, and deployed bytes are verified
separately at delivery and linked from the PR. These local measurements do not
borrow a green CI verdict from the earlier C2/D8 heads.

## Cation commissioning follow-up

Configured CI at `f38459a8` failed at `audit:cations`: the guard still named only
SIM285's exact commissioning identity. This was an identity refusal, not a
failed conservation check. The dependent PR32 run was canceled after that
shared cause was confirmed; neither run is reported as green.

Before adding the SIM286 checkpoint, normal producer runs on pinned baseline
`e2142582` and `f38459a8` were compared exactly. Only `sim_version` and
`model_digest_sha256` changed. Every reported physical field and compact
trajectory agreed: 161 audited rows, 7,680 finite zero-Zn control volumes,
five pharmacolites and final Ca proxy `0.581977988422356`. This does not claim
that every voxel at every step was persisted.

The old SIM285 entry remains intact. The new entry requires the exact SIM286
version **and** model hash, with the same numerical targets and `5e-7` proxy
tolerance. Unknown identities still fail closed. Six focused tests pass,
including actual CLI runs that reject independently mismatched reported
version/model identities while retaining all physical checks. Those fixtures
change reported metadata only; they are not scientific runs of another model
or Node version. CI now runs this focused file explicitly.

The [commissioning receipt](evidence/cation286-commissioning.json) retains the
failed CI, the test plumbing failure, the inconclusive sandbox RSS-monitor
attempt, successful controls, normal producer outputs, unchanged-runtime
proof and normal science-workflow verification. Unchanged, exact-input cached
facts remain cached facts; they are not described as fresh cold executions.
