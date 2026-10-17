# Contact geometry lifecycle measurement

The shared crystal renderer now releases fresh contact-clipped geometry when
rebuilding its crystal group. Cached base shapes remain borrowed by parents and
satellites. This applies to every scenario that takes the existing contact path.
The reference is `59d9c409a79d9631792e789c63248262e5519150` (the Bisbee construction
optimization); the production change adds explicit disposal ownership and leaves
the geometric calculations intact.

## Observed result

Each row is four constructions of the same completed specimen, with no growth
between constructions. There is no manual disposal between measured rebuilds.

| Specimen, seed 42 | Authored steps / cavity seed | Reference GPU geometries | Fixed GPU geometries |
| --- | --- | --- | --- |
| MVT | 120 / 3 | 23 → 26 → 29 → 32 | 23 → 23 → 23 → 23 |
| Gem pegmatite | 230 / 8 | 23 → 35 → 47 → 59 | 23 → 23 → 23 → 23 |
| Bisbee | 340 / 13 | 50 → 62 → 74 → 86 | 50 → 50 → 50 → 50 |

Every retired contact receives exactly one disposal event with the fix. The
reference receives none. Texture and program counts remain constant. Draw
counts, geometry buffers, transforms, instance matrices, recorded material properties,
scientific-state fingerprints, camera and quality settings match exactly.
Only the intended `userData.ownsGeometry` metadata difference is excluded.
Bisbee still draws 415 calls and 1,145,910 triangles.

These are Three.js/WebGL geometry counts, not VRAM bytes, total-memory savings,
or an FPS claim. Recorded elapsed times are diagnostic only. The workload is one
Windows x64 host, Node 24.15.0, Chrome 155.0.8059.41, Three.js r163, and an NVIDIA
RTX 3080 through ANGLE/D3D11. The drawing buffer is 1000 by 760 pixels at DPR 1;
transmission optics and 2048 shadow maps remain enabled throughout.

## Image repeatability

Bisbee's matched frames are pixel-identical. MVT and pegmatite show small
variation even when rebuilding with unchanged reference code. MVT's maximum
8-bit RGB difference is one level for baseline/baseline and candidate/baseline
comparisons; pegmatite's is three levels for both. Alpha is identical.

The initial exact-PNG gate and the subsequent universal one-level gate were
rejected by those controls. Their complete samples, original probe sources and
images are retained under `controls/`. The final comparison measures all six
pairs of baseline images before comparing each of four candidate images with
all four baselines. Candidate maximum per-channel difference may not exceed the
baseline's own maximum. An exact baseline still requires exact candidate pixels.
This is an amplitude bound, not a claim that every pixel or changed-pixel count
is identical. The raw counts are in `summary.json` and each sample file.

`independent-pixel-check.json` verifies the archived PNGs through a separate
Pillow/NumPy decoder. This checks the browser probe's reported differences;
geometry equality and unchanged scientific records remain separate evidence.

## Verification and scope

The new regressions fail against the reference at the missing-disposal
assertions and pass after the fix. The guarded focused run passes 93 tests in
nine files, including both real-scenario contact cases, contact math, buried
bands, surface lining, cavity clipping/fallback, calcite, native metals and
selenite. It also checks unchanged-signature no-op behavior and retained cached
shape identities. `verification.json` and the test logs record those results.

All 17 commissioned browser checks pass. The complete commissioned science
workflow also passes, including 55 focused tests in seven files, for 148 passing
local tests across the two test runs. These are bounded checks, not a full-suite
cold-CI certification.

Typecheck, exact generated-build verification, and the release, evidence and
science audits pass against the resulting runtime and generated receipts.

Commissioned browser/science receipts are regenerated for the changed runtime.
`scientific-preservation.json` records the completed regeneration and comparisons
of the three baseline artifacts, all 41 full strip histories, SIM/model identity,
mechanism results and browser journeys with the reference. All are unchanged,
including both witness payloads and all 41 claim cards. Receipt bindings change
to identify the new runtime; scientific outputs do not. Text comparisons use the
repository's canonical LF normalization policy.

No growth, contact-plane selection, clipping formula, inclusion placement,
historical surface, shader, camera, visibility threshold or quality setting is
changed. Existing procedural approximations retain their existing status.
This fixes disposal of transient contact geometry; it does not claim to solve
cache growth as a specimen evolves, nested band material ownership, or every
resource-lifecycle issue in the renderer.

## Reproduction

Build the repository and run:

```text
npm run build
node tools/contact-geometry-lifecycle-benchmark.mjs
```

The pinned reference commit must be available locally. The probe captures exact
input hashes, all samples and an isolated browser's hardware/runtime identity.
It clears display resources only between independent variants. Its temporary
server and browser close on success or failure, with a 20-minute browser deadline.
It writes only local measurement evidence. `identity.json` binds the tested
production bytes; `benchmark-source.mjs.gz` preserves the exact producer.

All final samples, all 24 final PNGs, three geometry witnesses, and the three
earlier control runs are retained here. Geometry-witness JSON and producer
sources are gzip-compressed without modification. Host command lines, temporary
DevTools addresses and process-owner records remain local; GPU/browser identity
and cleanup results are preserved. `files.json` records hashes for every archive file.
