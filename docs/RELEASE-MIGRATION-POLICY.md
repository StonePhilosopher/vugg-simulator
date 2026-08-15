# Release and migration policy

Vugg Simulator has three identities with deliberately different jobs.

1. `SIM_VERSION` changes whenever a runtime or authored input can change a
   deterministic geological result. It is monotonic and never reused.
2. `MODEL_DIGEST` names the scientific interpretation. Any change to a
   load-bearing term requires a new token and normally a `SIM_VERSION` bump.
3. The core content pack has its own semantic `content_version`. Tutorials,
   prose, art metadata, or presentation-only content can change without
   pretending the geology changed. Scenario chemistry, events, claims, or
   authored `shape_seed` changes require both the appropriate content-pack
   bump and a new simulation identity.

`release/content-pack-manifest.json` binds the current pack to exact
source-file SHA-256 values, scenario/mineral/narrative counts, browser bundle,
runtime execution set, Node runtime, SIM identity, and producer contract. A
release is not assembled from a stale manifest.

## Save compatibility

- Format v3 is the current replayable format. It binds a stable run identity,
  scientific identity, replay fingerprint, collection epoch and receipts, and
  a finish transaction for terminal records.
- A format v2 or v1 record is preserved for local export and diagnosis. It is
  not silently upgraded or replayed, because a self-consistent format v2
  envelope cannot prove the v3 event/collection authority that it lacks.
- A current v3 record is never accepted after being relabelled as format v2,
  even if public checksums are recomputed.
- `vugg-local-backup-v1` is a checksum-bound transport for the complete local
  browser generation: primary/pending/backup/quarantine saves, Library,
  lifetime statistics, and Settings. Import is journalled, read back, and
  rolled back on failure. It is not a cloud-sync format.

## Release procedure

1. Make the source tree quiescent and run the build.
2. Run `npm run gen:release`, then `npm run audit:release`.
3. Run the bounded test workflow and browser workflow serially.
4. If exact executable bytes or runtime data changed, perform one fresh science
   evidence rebake. Verify its browser, execution, producer, runtime, artifact,
   and content identities; never rewrite only the outer receipt.
5. Commit generated manifests and evidence with the source that produced them.
6. Keep every external gate open until a named human reviewer supplies the
   prescribed evidence.

Rollback is a normal Git revert plus restoration of the matching manifests and
evidence. A release must not pair code from one commit with generated evidence
from another.
