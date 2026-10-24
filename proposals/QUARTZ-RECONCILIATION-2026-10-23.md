# Selective quartz observation, persistence and replay reconciliation

Baseline: `91e5cc1102b453acac1638adb40b51587b75115e`. Branch:
`codex/quartz-observation-reconciliation`. Source material, selectively adapted:
`3751060e94bc9ba8aba9a3b488d454b4f5ec4897`,
`0f0be7f7f94c9f8d5b2f7806504914c818f2da93`,
`c045bb62802dec95504ccb97c7de53a0af8572b8`.
The divergent branch and its broader R4/R7 graphics, surface, population and
general enclosure-history changes are not merged. No new growth model, RNG,
mass rule, scenario, recipe, abundance or mineral tuning is introduced.

## Recorded authority and bounded display

The observer runs after existing classifiers finalize a step, regardless of
whether a renderer or strip recorder exists. Its frozen, bounded ledger stores
initial descriptors, changes, observed coverage, accepted zone coordinates and
explicit unavailable suffixes. It owns a non-enumerable property so growth
transactions and scientific state projections never deep-copy or consume it.
Observation failure does not alter growth; persistence cannot pretend the last
successful capture covered an unseen suffix. Saving never creates observations.

The reconciled `quartz-form-observations-v2` also dates topology scope (enclosure,
cast/replacement identity) and nucleation tilt. This baseline lacks R7's general
replay layer: reading final scope would otherwise alter the eligibility or
orientation of a past quartz frame. These additions observe the existing model,
not new reactions or a new enclosure rule. Earlier quartz testimony can survive
an observed transition to another mineral as an explicitly closed prefix.

New Library records carry an optional `collection-quartz-form-v1` envelope.
Source identity survives the display specimen's new local ID. Old records retain
their original fields, display behavior and lack of chronology; old authenticated
collection/finish receipts explicitly select their old producer. New receipts
include the additional testimony in their existing digest and are replay-checked.
The producer is selected from the actual staged or pre-collected Library record,
not guessed from the presence of a staging row. Strip v4/v5 codecs and authenticated
storage preserve the optional quartz channel, validate bounded identities,
coordinates/coverage and payload sizes, and refuse malformed channels. A
self-rehashed imported strip remains imported; syntax is not origin authentication.

The Three replay path selects recorded quartz descriptors at the requested
cursor before route, cache, historical aspect and placement decisions. Supported
fluid-grown, untwinned plain/double prisms, sceptres and gwindels use the existing
builders; changing final descriptors cannot rewrite their earlier form selection.
The baseline prism builder ignored double termination. Only the source branch's
existing C2-related opposite-termination option is carried over, selected solely
for a recorded double-ended replay; live/default builder behavior is unchanged.
The regression checks both actual ends and absence of a basal scar, not merely
a route label. No accessory faces, new normals/shading or other R4 polish is
transplanted. Scene-owned special-form caches avoid borrowing a later live crystal's geometry.
Source IDs seed quartz display variation independently of Library display IDs.
Other minerals keep their existing ID/coercion behavior and renderer routes.
Existing owned-vs-borrowed GPU disposal is preserved.

The status is **recorded form selection**, not a scientifically resolved physical
solid. The renderer keeps its existing signed-zone length and habit-based display
width approximation, quantized special-form parameters and representative
clusters/materials. Color is not a reconstruction of dated solid composition.
Collection placement is an isolated display, not a recovered original wall.
Undated attachment depth, neighbor contact cuts, sector/polar overprints and
deformation-application time are withheld for the supported route. Twins,
split/fabric growth, casts, enclosed-host geometry, CDR parent inheritance,
unrecognized forms, absent/invalid/late/closed coverage retain explicitly labeled
latest-form display fallbacks. No missing geology is synthesized as authority.

## Compatibility and evidence

Both viewer choices, the exact flat cavity, the non-WebGL CPU fallback, current
wall modes/controls and authored tutorial timing are retained. Flat cavity output
continues to disclose withheld individual-crystal shapes; it does not acquire a
new claim to quartz specimen reconstruction. No old visual-branch receipts or
generated artifacts are transplanted.

Use the commissioned Windows x64 / Node 24.15.0 runtime, V8
13.6.233.17-node.48, ICU 78.2, en-US. Run heavy evidence serially:

```text
npm test -- --file tests-js/quartz-form-history.test.ts --file tests-js/quartz-form-strip.test.ts --file tests-js/quartz-form-collection.test.ts --file tests-js/quartz-form-display.test.ts --file tests-js/wall-display-control.test.ts --file tests-js/tutorial-guidance.test.ts --file tests-js/cavity-field-fallback.test.ts
npm test -- --file tests-js/fortress-saves.test.ts --file tests-js/quartz-form-collection.test.ts
npm test -- --file tests-js/collection-player-names.test.ts
npm run typecheck
npm run build
npm run gen:browser-receipt -- --quartz-reconciliation-proof
node tools/check-viewer-paths.mjs
npm run science:rebake
node --max-old-space-size=512 pilots/calcite/census.mjs --output pilots/calcite/volume-census.json
node pilots/calcite/record.mjs
node pilots/calcite/factor-report.mjs
node tools/check-quartz-reconciliation.mjs
npm run build:check
npm run gen:release
npm run audit:release
```

The existing CI workflow durably runs the quartz files, Library/save compatibility,
calcite/celestine history, viewer/tutorial/fallback tests, cleanup regressions,
real-Chrome ownership cases, science/evidence/release audits and calibration
sentinel. The full cold all-files suite is not claimed. Exact results, retries,
commit/check/deployment links and remaining boundaries belong to the delivery PR
and [fresh comparison receipt](evidence/quartz-reconciliation-validation.json).

Preflight corrections are retained in local logs: one display assertion exposed
the missing double-termination dependency described above, one
new test fixture had no collectible solid, and the existing save suite caught the
pre-collected producer-selection defect described above. These were investigated
before commissioning scientific receipts; failures are not treated as passes.

The first browser run completed all 18 journeys but correctly refused the old
strip/collection pins. The eight changed journey leaves are two display ID
occurrences and the strip dataset/download identities derived from the added
quartz channel. An attempted Node recreation did not reproduce that browser
run and was discarded as non-equivalent evidence. The retained proof instead
decodes the actual owned Chrome download in Chrome, removes only
`quartz_form_testimony`, and recovers the exact old raw and compressed hashes.
All geological fingerprints and every other journey leaf remain unchanged.
Only after that byte proof are the explicit hash/ID pins updated and the owned
journeys rerun. Raw before/after downloads remain under
`.local-evidence/quartz-browser-payload/`; the compact
[byte proof](evidence/quartz-browser-payload-validation.json) binds them.
The separate [real viewer receipt](evidence/quartz-reconciliation-viewers.json)
binds both normal WebGL and genuinely disabled-WebGL cases to the same bundle.
It records all wall modes, return from flat to Three, the exact visible CPU
cavity, unchanged scientific fingerprints, zero uncaught exceptions, and verified
browser/server cleanup. This is a local Chrome compatibility result, not a claim
that every GPU or browser has been validated.

The [execution receipt](evidence/quartz-reconciliation-execution.json) records
the exact serial commands, UTC intervals, runtime, exit statuses, test counts,
log hashes, five browser attempts (two refused stale pins; two superseded
successful preflights; one final success), corrections and remaining boundaries.
Final post-rebake checks passed 167 focused tests; the unchanged save/name suites
separately passed 66 and 11. Science rebake passed its 55 tests. The fresh
comparison finds 41 unchanged existing histories, all three unchanged numerical
baselines, and 41 unchanged calcite census results/fingerprints. New quartz
channels cover 42 crystal histories in 19 scenarios: 579 snapshots and 346
supported recorded-form projection checks. Release/evidence updates are generated
through the existing producers, with no manual authentication-hash edits.

Calcite's physical-solid production hold and canonical PR #11's owner-side merge
are independent gates. Passing quartz replay tests cannot close either one.
