# Bisbee lining construction: measured result

The bounded change reduces allocation and lookup overhead inside
`_emitSurfaceGrowthLining`. It reuses assigned node IDs, searches backward for
the last matching contact, packs edge IDs without losing integer precision,
and keeps contact vertices in a fixed object layout. It changes no growth rule,
scientific input, geometric formula, fold repair, subdivision, material or
quality setting. The existing `representative_only` designation is preserved.
Edge packing uses `high * 2^32 + low` only when `high < 2^21`, which fits exactly
in a JavaScript safe integer; larger IDs retain the original string key path.

The full production Bisbee scenario was grown to step 340 with simulation seed
42 and authored cavity seed 13: 117 crystals. The reference function is from
`ce93e2fd20d2d50d7f4ffcfa82c67ae1b95737f5`. Both functions run against the same
completed specimen. The candidate was measured before commit; `environment.json`
binds its exact source and generated-bundle bytes rather than claiming the
checkout's base HEAD contains the candidate.

## Result

Six alternating baseline/candidate pairs; all samples retained. Drawing buffer
1000 × 760, DPR 1; Windows x64, Ryzen 7 5800X, RTX 3080/D3D11,
Chrome 155.0.8059.41 (V8 15.5.35.20), Three.js r163. Node 24.15.0 drives the
measurement tool; browser execution uses the separately recorded browser V8.

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Crystal mesh construction, median | 15,993.90 ms | 12,764.55 ms |
| Crystal mesh construction, p95 of 6 | 17,064.40 ms | 13,908.10 ms |
| Retained V8 heap, median after GC | 731.01 MiB | 498.38 MiB |
| Steady CPU submission, median / p95 | 8.60 / 10.80 ms | 8.70 / 10.90 ms |
| Steady GPU elapsed, median / p95 | 5.70 / 11.95 ms | 5.52 / 9.25 ms |
| Geometries / textures / programs | 50 / 7 / 8 | 50 / 7 / 8 |
| Draw calls / triangles | 415 / 1,145,910 | 415 / 1,145,910 |

Construction improves **20.2%**, exceeding the predeclared 15% gate. Retained V8
heap decreases **31.8%**. All acceptance gates in `summary.json` pass. There are
216 valid GPU measurements per variant and no unavailable/disjoint samples.
The different GPU timings are observations, not a claim of a GPU optimization.

Host CPU occupancy during the recorded intervals ranged from about 35% to 47%.
These are measurements on one shared workstation, not a fleet-wide guarantee.
Each pair improved construction time (17.9%–21.5%). Earlier development variants
missed the speed gate and were refined before this accepted run; these files
contain every sample of the final, unchanged candidate.

Separate fresh-browser profiles measured first complete rendering at
15,236.30 ms versus 11,421.50 ms, including 14,213.10 ms versus 10,419.30 ms in
crystal mesh construction. Those are one profiled sample per variant, not a
second statistical performance claim.

In the baseline cold CPU profile, the lining builder and its callees account
for 12.71 seconds of the 13.11 seconds sampled inside crystal construction
(about 97%). This supports the choice of bottleneck. Sampled profile attribution
is diagnostic; acceptance uses the six unprofiled timing pairs above.

## Preservation

- All 241 mesh witnesses match at the same construction stage: attribute/index
  buffer bytes, transforms, instance matrices, groups, representation metadata
  and captured material properties. Cold reconstruction is also identical.
- The JSON witness of enumerable crystal state, projected bulk fluid, RNG, step
  and cavity-evolution signature is unchanged by every construction and camera path. The two cold
  runs produce the same 9,003,963-byte scientific record.
- The matched baseline/candidate PNGs are byte-identical; one copy is retained
  as `matched-frame.png`. Geometry count, draw count and triangle count are
  identical. No visibility scaling, coarser tessellation or reduced quality is
  used to obtain the improvement.
- The independent analytic test checks a two-micrometre film on the latest
  matching 0.4 mm contact, ignores another surface and a scattered later layer,
  then disposes and reconstructs its positions, normals and indices. The
  existing footprint, fold, contact, replay and viewport invariants also pass.

Equality establishes preservation of the incumbent result, not geological
validation of procedural details. The authority table and precise exclusions
from the scientific witness are in
[`BISBEE-RENDER-COST-CONTRACT.md`](../../../proposals/BISBEE-RENDER-COST-CONTRACT.md).
In particular, mound relief and exact lining triangulation remain procedural
display completion; they have not been promoted into measured geological facts.

## Raw evidence and reproduction

`pairs.json` contains all construction, frame, heap and host-load samples.
`summary.json` is reproducible with `summarizeBisbeeRenderComparison` in
`tools/bisbee-render-contract.mjs`. `environment.json` records input/tool hashes
and hardware/runtime identity. `preservation.json` records the equality checks
and uncompressed witness hashes; `files.json` hashes the archived files.

The `.gz` files are ordinary gzip-compressed JSON or Chrome CPU profiles.
Uncompress `.cpuprofile.gz` before importing it into Chrome DevTools.
`measurement-producer.mjs.gz` preserves the exact tool bytes used for this run.
The checked-in launcher subsequently received two bookkeeping guards: use the
calling task/run as helper owner, and reject changed authored seed/step values.
Neither changes the candidate rendering function or the timed comparison.
`scientific-record.json.gz` preserves the underlying specimen witness;
`cold-meshes.json.gz` and `reference-meshes.json.gz` preserve the matched cold
and later construction witnesses. Their different hashes reflect the existing
material-state update between stages, not a baseline/candidate difference.

From the repository root, with the pinned base commit available locally:

```text
npm run build
node tools/bisbee-render-benchmark.mjs
node tools/bisbee-render-benchmark.mjs --cold candidate
```

The tool owns and closes its isolated browser and loopback server. This capture
left neither running. GPU query polling means frame samples are elapsed costs,
not interactive FPS. Heap observations are not peak RSS or VRAM. The probe
disposes its crystal resources between independent constructions to prevent
the existing full-group resource-retention issue from confounding comparisons;
that separate lifecycle issue is not changed by this tranche.

## Completed validation

The fresh commissioned Windows x64 / Node 24.15.0 science workflow passed,
including 55 focused science tests. All three scientific baseline files, all
41 full strip histories, and the SIM/model identity are unchanged from the
reference. The mechanism results and browser journey results are unchanged.
`scientific-preservation.json` records the exact artifact comparisons and the
successful workflow's start/end times.

The installed browser had advanced from Chrome 152.0.7977.83 to 155.0.8059.41.
The required browser evidence was regenerated through the owned-browser workflow
after verifying the actual DevTools owner's executable hash. The environment pin
and dependent evidence references therefore changed. The mechanism payload has
one verified browser-receipt reference update; all 41 claim cards change only
their mechanism-artifact reference. No scientific assertion or semantic gate
was relaxed.

The 54 focused rendering, comparison-contract and browser-receipt tests also
passed, as did typecheck, the exact build check, runtime authentication, the
full owned-browser workflow, science/evidence/locality audits and the generated
release audit. The paired benchmark, separate cold reconstruction, archive
checksums and recalculated acceptance summary passed. Task-owned browser/server
helpers were closed; the science workflow exited successfully.
