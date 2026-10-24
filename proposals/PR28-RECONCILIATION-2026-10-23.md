# PR 28 — explicit recipe corrections on the current baseline

Validation in progress. The evidence below must be completed before promotion.

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
are intentional parts of the inspected commit, not an inference that every
crystal gains priority. This tranche adds no further tuning of that function.

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
node pilots/calcite/factor-report.mjs
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

Final case counts, changed outcomes, generated-artifact differences, focused
tests, CI/deployment SHAs, retries, and remaining limits will be recorded here
when validation completes.
