# Contact geometry lifecycle

This follow-up to the Bisbee construction optimization covers the shared O2
contact-clipping path in every scenario. Its reference is
`59d9c409a79d9631792e789c63248262e5519150`.

`_clipConvexGeom` returns a fresh shape for a contacted parent. Previously the
parent did not mark that geometry as owned, so the existing crystal-group
rebuild discarded it without releasing its GPU buffers. Marking only the fresh
contact shape as owned lets the existing cleanup dispose it. Satellites still
borrow the cached base shape. No cache eviction or geometric reconstruction
rule changes.

## Authority

Ownership is a display-resource property. Chemistry, growth, contact-plane
selection, clipping, inclusion placement, historical surfaces, materials,
visibility scaling, camera and quality settings are unchanged. This work
preserves existing procedural approximations; it does not promote renderer
decisions into scientifically resolved facts.

## Acceptance

- Regression tests fail against the reference because retired contacts receive
  zero disposal events, then pass with exactly one event per retired contact.
- An unchanged-signature redraw retains its objects and disposes nothing.
- Shared cached shapes retain their identities and receive no disposal events
  during repeated reconstruction of the same specimen.
- Geometry buffers, transforms, material settings and scientific-state
  fingerprints are unchanged through repeated reconstruction.
- Production WebGL measurements use full authored MVT, gem pegmatite and Bisbee
  specimens, seed 42, authored cavity seeds, 1000 by 760 pixels and DPR 1.
  Four constructions of each variant use the same completed specimen, with
  no growth steps between samples. The reference must reproduce missing
  contact disposal; the candidate must dispose each retired contact once and
  maintain constant geometry, texture and program counts. Geometry, material,
  camera and quality witnesses must agree exactly. Only `userData.ownsGeometry` is
  excluded from the metadata comparison because it is the intended change.
- The first MVT browser run failed an exact-PNG gate. A separate unchanged-code
  control showed its own rebuilds differing by one 8-bit RGB level, while a
  second capture of the same frame was exact. Keep that control and all images.
  The initial one-level ceiling was not transferable: the untouched pegmatite
  baseline varied by three levels, as did its candidate. Use the baseline
  measured before the candidate for each specimen, preserving those raw samples.
  For the final comparison, compare every candidate image with all four baseline
  images: maximum RGB difference must not exceed that baseline's own pairwise
  maximum; alpha must be identical. A baseline
  with exact images still requires exact candidate pixels. Record changed-pixel
  counts separately; do not describe a one-level result as pixel-identical.
- Commissioned browser and science evidence are regenerated and authenticated;
  scientific baselines and full strip histories must remain identical under
  the repository's canonical LF normalization policy.

Run `node tools/contact-geometry-lifecycle-benchmark.mjs` after `npm run build`.
It records exact input hashes, browser/GPU identity, every sample and cleanup
receipts under `.local-evidence/contact-geometry-lifecycle/`. It clears display
resources only between independent variants, never between measured rebuilds.
It owns an isolated browser profile and server, with a 20-minute browser deadline
and explicit cleanup. It does not write science receipts or baselines.

GPU geometry counts establish bounded resource retention, not VRAM bytes or an
FPS improvement. Recorded elapsed times are diagnostic only. Cache growth while
the specimen actually changes, nested band material ownership, and replacement
of per-crystal deformation caches remain separate lifecycle questions.
