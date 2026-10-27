# Production local-state foundation v1 — delivery receipt

2026-10-27. Base: `db2c17bdac4e7fd3dbcdad1fd03d23f6654d661d`.
Scope: explicit initial cell inventories and checkpoint custody; chemistry
activation remains withheld. No recipe, abundance, morphology, mass rule or
scenario input changed.

## Housekeeping

[PR #35](https://github.com/Syntaxswine/vugg-simulator/pull/35) merged at the
authorized head `42dad27b355825c7e74e940790119fbd1fcc3b99`, producing the base
above. [Exact-head approval record](https://github.com/Syntaxswine/vugg-simulator/pull/35#pullrequestreview-5661657828)
is a COMMENTED review: GitHub prohibits the signed-in PR author from issuing an
APPROVED review on their own PR. It records the human authorization and technical
decision without claiming independent approval.

Main [CI](https://github.com/Syntaxswine/vugg-simulator/actions/runs/40440457613)
and [Pages deployment](https://github.com/Syntaxswine/vugg-simulator/actions/runs/40440456826)
both succeeded at `db2c17bd`.

## Formation and identity

Windows x64; Node 24.15.0; V8 13.6.233.17-node.48; ICU 78.2; locale en-US.
SIM 286 and its semantic model digest remain unchanged. Final execution set:
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`.
Serialized validation stages used `NODE_OPTIONS=--max-old-space-size=1536`.
Ordinary focused tests used the existing one-file/one-worker RSS foreman.

The new cell/snapshot schemas are versioned separately from legacy recipe saves.
Their inventories are explicit, immutable and initialization-only. They cannot
tick the legacy engine, diffuse, or be silently discarded by recipe persistence.
No existing scenario installs them. No pH-to-alkalinity migration exists.

## Final-byte checks

| Command / check | Result |
| --- | --- |
| `npm test -- --file tests-js/local-state-foundation.test.ts` | 28 passed; peak 585 MB RSS; includes a fresh-real-simulator checkpoint round-trip and a pre-change save witness |
| `npm run gen:browser-receipt` | 18 real-Chrome journeys passed; entire browser payload equals the base |
| `npm run science:rebake` | Full real producer execution and authentication passed; 55 science tests passed across 7 files |
| `npm run gen:release` | Fresh content/asset manifests passed |
| `node pilots/calcite/census.mjs --output pilots/calcite/volume-census.json` | 41 authored seed-42 runs completed, no capture errors; all final-state fingerprints unchanged |
| `node pilots/calcite/golden.mjs` | Exact original golden specimen, booked volumes and geometry hashes |
| `node pilots/calcite/record.mjs` | Recording noninterference and save/load/reconstruction passed |
| `node pilots/calcite/factor-report.mjs` | Fresh factor/replay evidence; production remains withheld |
| `node proposals/evidence/local-state-foundation-compare.mjs` | 92 payload checks, zero physical changes |
| `npm run typecheck`; `npm run build:check` | Passed; generated page exactly matches all 187 compiled modules |
| `npm run audit:science`, `audit:evidence`, `audit:release`, `audit:localities`, `audit:browser-receipt`, `audit:cations`, `audit:bif` | All passed; 128 authenticated science artifacts |
| `git diff --check` | Passed |

The final compatibility command was `npm test --` with these repeated `--file`
arguments (11 separate bounded batches, **185 passed**):

```text
tests-js/local-acid-buffer.test.ts
tests-js/calcite-solid-authority.test.ts
tests-js/celestine-lineage.test.ts
tests-js/wall-display-control.test.ts
tests-js/tutorial-guidance.test.ts
tests-js/cavity-field-fallback.test.ts
tests-js/quartz-form-history.test.ts
tests-js/quartz-form-strip.test.ts
tests-js/quartz-form-collection.test.ts
tests-js/quartz-form-display.test.ts
tests-js/guided-tutorial-browser-receipt.test.ts
```

Thus the final local test groups above contain **268 passing tests**. GitHub CI
is a separate fresh-checkout check on the published PR head/merge tree; its run
and exact SHA belong to the PR checks and delivery message, not this local
reproduction claim.

The [machine-readable comparison](local-state-foundation-validation.json) binds
its [comparison source](local-state-foundation-compare.mjs), runtime and both
artifact hashes for every check. It covers all 41 scenarios at seeds 1/2/42,
all 41 strip stories and claim cards, 41 final-state fingerprints, complete
calcite specimens, geometry/factors, and browser/mechanism payloads. Only a
runtime identity on an in-memory comparison copy changes when recovering the
old authenticated Elmwood specimen hash. No physical field is normalized.

## Attempts and remaining boundaries

An initial 122-test focused run passed before a sparse-array validation gap was
found in manual review. One bake was deliberately stopped after three completed
scenario checkpoints to repair it. Those old checkpoints and logs were retained
under execution identity `1dc55706a33800729e02cc67f13e1f6eacc67a52457d9ffce294b030b2687e32`;
none were adopted for the final identity. The sparse-array regression passed,
the browser commissioning was repeated, and the complete final bake above ran
again. The initial run is excluded from the 268 final-byte test count.

Real Chrome exercised both 3D and flat viewers. The non-WebGL path has focused
fallback regression coverage; this is not a claim of testing every physical
device. All owned browser lifetimes exited after the browser workflows. The
validation stages are foreground disposable helpers with normal completion as
their end condition; their nonsecret sources, process identities and logs are
retained in `.local-evidence/local-state-foundation/` for local audit/restart.

No chemistry clock, transport coefficient, finite calcite reservoir, Fe valence
or UV rate law is commissioned. Fe/sulfate-bearing local pH remains explicitly
unresolved. Legacy gameplay saves stay legacy; the new checkpoint API does not
claim evolving gameplay autosave or Record Player integration. Calcite's booked
inventory and completed surface remain distinct, and physical-solid production
authority remains **HOLD**. Canonical promotion and held PR #26 remain separate.
