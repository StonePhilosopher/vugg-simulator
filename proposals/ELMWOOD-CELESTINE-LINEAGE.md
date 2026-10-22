# Elmwood celestine growth history

Elmwood's step 78 fluid change previously relabeled six existing celestine
aggregates as Madagascar nodules. The new lineage receipts preserve the
formation conditions and morphology interpretation of each accepted growth
zone. They also record the dimensions and splitting state that the model
actually had at that step, so replay no longer reconstructs an earlier
celestine using its final habit and splitting index.

This is an observation and presentation change. Growth rates, solute debits,
volume integration, splitting, cavity occupancy, nucleation and abundance
retain their existing arithmetic. In particular, `Crystal.habit` remains a
legacy numerical classifier input. It is explicitly labeled as such in strip
testimony and the browser agent response; it is not the lineage's identity.
SIM 285 remains the numerical model identity. Exact executable and producer
changes require freshly generated browser and science receipts.

## Property authority

| Property | Authority and limitation |
| --- | --- |
| Lineage ID, birth step, local birth conditions | Recorded at nucleation in `celestine_origin`. The initial habit variant is procedural, not a lifetime commitment. |
| Accepted zone and local fluid Ba, Sr, S, Mn, pH, salinity, temperature | Observed inputs to that growth call, before the accepted solute budget. A rejected candidate receives no formation receipt. |
| Solid Ba fraction | Unresolved and stored as `null`. Current celestine books Sr and sulfate; it does not compute Ba incorporation. Null does not mean measured zero Ba. |
| Blanket morphology | A procedural locality analogy from the existing carbonate-host/fluid recognizer. Neither the 0.25 mass-concentration ratio nor the blanket's primitive is a calibrated morphology law. |
| Raw `habit` and `dominant_forms` in agent/strip compatibility output | Results of the legacy classifier, qualified by `habit_authority`. They do not describe an authoritative accumulated surface; use the recorded `celestine_morphology` interpretation for the lineage. |
| Later morphology after leaving the blanket classification | Unresolved. Returning to the earlier fluid ratio cannot resolve intervening material retrospectively. |
| Historical dimensions, volume and splitting | Exact observations of the legacy model at the end of the recorded step. Its ellipsoid envelope and splitting rules remain approximations, not resolved growth faces. |
| New material after the unsupported transition | Its existing numerical growth continues and is recorded. The display holds the last classified blanket and visibly explains that later form is unresolved. It does not expand that blanket to claim unsupported new fibrous material. |
| Replacement | Requires an explicit modeled reaction and inventory transfer. No celestine-to-barite reaction or relabeling is introduced here. |

`celestine_history` receipts on accepted zones are deeply frozen. The mutable
remaining-solid accounting on the surrounding zone remains available to
existing dissolution bookkeeping. Earlier receipts and origin records are
never rewritten when the fluid changes. JSON export preserves the records;
it does not itself certify their authenticity. The simulation replay
fingerprint includes the origin and full zone records.

The Three.js view, hover text, inventory, Library collection, specimen
description and geological narrator consume the recorded presentation. The
flat view uses the recorded habit with its existing schematic cell thickness;
it is not a reconstruction of resolved growth faces. The final inventory still
reports approximate model dimensions separately from the held 3D display. Strip
archives retain both the raw numerical classifier and the qualified lineage
interpretation. Claim cards carry every recorded layer and explain the final
interpretation rather than presenting the legacy classifier as geological
identity.

Legacy objects lacking these receipts remain explicitly approximate. Their
missing historical dimensions cannot be recovered from final habit and final
splitting. This change does not invent records for them or silently upgrade
older save formats.

Pre-change save recipes containing celestine do not have the new origin and
zone receipts in their replay fingerprint. Their old fingerprint will refuse
the new replay, preserving the original save for export and diagnosis; start a
fresh run to obtain authenticated new history. Collected Library objects can
still be viewed, with missing history labeled as approximate. No migration
silently certifies an older recipe as having recorded these new observations.

## Scientific basis

Ba–Sr sulfate experiments support compositional and morphological history
within a persistent crystal. Sánchez-Pastor, Pina and Fernández-Díaz describe
Sr-rich elongated interiors and later Ba-richer, more tabular material under
their experimental conditions. That supports preserving history while allowing
later growth to differ; it supplies no universal Elmwood transition formula.
[Chemical Geology 225, 266–277](https://www.sciencedirect.com/science/article/abs/pii/S0009254105003591).

Prieto, Putnis and Fernández-Díaz show that diffusion and supersaturation can
produce zoning that differs from equilibrium predictions. Fluid Ba/Sr alone
therefore cannot stand in for the solid composition needed by a morphology
model. [Geological Magazine 130, 289–299](https://www.cambridge.org/core/journals/geological-magazine/article/abs/crystallization-of-solid-solutions-from-aqueous-solutions-in-a-porous-medium-zoning-in-ba-srso4/A045B2B58121977074A77D271219B364).

Poonoosamy and colleagues demonstrate celestite dissolution followed by barite
precipitation in Ba-bearing solutions. Such replacement needs an explicit
reaction path; it cannot be represented by switching a habit label.
[Geochimica et Cosmochimica Acta 182, 131–144](https://www.sciencedirect.com/science/article/abs/pii/S001670371630103X).

Forjanes and colleagues' branched/sheaf-like celestine concerns growth on
anhydrite with epitaxial and compositional effects. It is not an Elmwood
growth rule. [CrystEngComm 22, 5743–5759](https://pubs.rsc.org/en/content/articlelanding/2020/ce/d0ce00755b/unauth).
Jensen's Elmwood occurrence article is bibliographically established; its full
text was not available for this work and supplies no quantitative calibration
here. [Mineralogical Record May–June 1996 contents](https://mineralogicalrecord.com/back_issues/may-june-1996-vol-27-no-3/).

## Verification and remaining model work

The regression replays Elmwood seed 42 through 200 steps. It compares all six
final celestine dimensions and volumes against observations made before this
change at `fab4f8cd`, verifies all 930 accepted layers, and compares pre-step-78
receipts byte for byte after the run. It also covers rejected candidates,
JSON export, unresolved status after a fluid-ratio reversal, and presentation
that leaves simulation state unchanged.

Local checks on Windows x64 / Node 24.15.0 passed 199 distinct focused tests:
the 11 lineage regressions, 77 save/Library tests, and 111 existing geometry,
contact, surface-growth and habit tests. The final lineage file was rerun after
the last presentation wording edit. The owned-browser workflow also passed its
17 player-control and responsive-layout checks and produced a fresh guided
tutorial receipt. The final Elmwood browser probe confirmed that the
unresolved-form notice is visible beside the 3D specimen, that live inventory
and collected Library cards keep the qualified blanket interpretation, and
that rendering and collection leave the simulation fingerprint unchanged.

All 41 regenerated seed-42 strip payloads match `fab4f8cd` after removing only
the newly added `celestine_history`, `celestine_origin`,
`celestine_morphology`, `celestine_disclosure`, and `habit_authority` fields.
The added history comprises 6,047 layers across Elmwood, Naica, the reactivated
fluorite vein, Sabkha, Searles Lake, and Sicily. The three-seed occurrence and
first-appearance records also match the original for every scenario and seed
(1, 2, and 42).
The regenerated `seed42_v285.json`, `strip_digest_v285.json`, and
`locality_frequency_v285.json` numerical payloads are unchanged; none of those
baseline files has a Git diff.
The complete `science:rebake` workflow passed, including its 55 focused science
tests and the exact-execution evidence, provenance, and locality checks. Together
with the 199 targeted regressions, this is 254 passing local tests; it is not a
claim that the separate full cold test suite ran.
Final typecheck, exact generated-build, release, evidence, and science audits
also passed on the commissioned runtime.

The separate acceptance boundaries are:

1. Scientific authority: no new Ba uptake, replacement, morphology transition
   law, fiber dimensions, abundance tuning or mass claim.
2. Rendering independence: recorded past form and dimensions survive later
   fluid/habit/splitting changes; disposable views cannot modify the record.
3. Numerical continuity: existing fleet outputs must remain equal; generated
   history annotations and exact-byte receipts are expected to change.

This bounded fix does not resolve exact growth faces, historical neighbor
contacts, individual fibers within aggregates, or every other mineral's
history. Existing display tessellation, visibility scaling and surface
approximations remain display approximations. No rendering speed improvement
is claimed for the additional history recording.

A later scientific tranche must commission an incorporation model within a
defensible temperature, salinity, supersaturation and substrate envelope before
it can determine new solid Ba fractions or external morphology. It must also
separately justify any replacement mechanism or abundance calibration. The six
1–5 mm outputs are aggregate extents; their count and size cannot calibrate
individual fiber width or blanket coverage by themselves.

## Reconciliation with the calcite pilot (2026-10-22)

The integration base is proving-ground main
`6ac66e385df65ac2c4a5509297284d1998d63bae`, after the isolated calcite pilot.
Elmwood's JavaScript remains byte-for-byte the published PR #21 implementation
at `277fc45a490f1931ec4c5c09db8294c3eba18f53`. The generated evidence conflicts
were resolved by actual browser commissioning and the normal science rebake.
No receipt hash was selected by hand and no growth rule was changed.

The new commissioning passed all 17 owned-browser checks, with recorded browser
lifetimes and server ports verified closed. All 123 occurrence runs (41 scenarios
at seeds 1, 2, and 42) were newly executed with `--fresh` before the normal rebake;
the rebake then consumed those exact-identity checkpoints and its authenticated
archived-story caches where supported. Its 55 focused science tests passed.
This does not claim an uncached full cold-suite run.

The calcite diagnostics were regenerated by actual execution of all 41 authored
seed-42 scenarios and the standalone saved-specimen recorder. The continuity
verifier requires all prior lineage histories to match exactly and all previous
main history fields to match after removing only the five explicit lineage
annotations. It also checks all three numerical baselines, the complete calcite
census scalar rows, both examples' factors and reconstruction, the golden
specimen, runtime/source bindings, and the closed production gate. It passed:
41 histories, 6,047 lineage records, three unchanged numerical baselines, and
unchanged calcite measurements across 41 scenarios. Six state fingerprints
change because of the newly recorded celestine history; they are not treated
as evidence of a numerical or geometric change.

Reproduce that comparison on this integration head after installing dependencies
and building the exact bundle:

```sh
node tools/check-elmwood-lineage-integration.mjs
```

The source snapshots it compares are pinned in the verifier and must be present
in the Git object database. The comparison is bounded to this integration;
checking out a later scientific/UI change is not a supported substitute. The
existing bounded CI step now runs the celestine lineage regressions alongside
the calcite authority file. The calcite production hold and all unresolved
scientific boundaries above remain in force.

The reconciliation's 12-file regression run passed 204 tests, covering lineage,
save/Library behavior, contact and surface geometry, fallback, mineral habits,
and calcite authority. Together with the rebake's 55 focused science tests, this
is 259 passing local tests. Typecheck, exact generated build, release, evidence,
and science audits passed, and the diff is clean. The original commissioning
totals above describe the earlier branch review, not an additional new run.
