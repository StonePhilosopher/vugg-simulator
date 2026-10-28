# Shared MVT prehistory control: validation

Base: `576a6ceeb81f590618d4974a30612bf9c5177d1d`, tree
`c987d3409f9ed0d21b834fadbaeef52bd35709d0`.
Branch: `feature/mvt-prehistory-snapshots`.

This is evidence for an isolated causal arithmetic control. The actual MVT
physical initial conditions remain uncommissioned. See the
[authority handoff](../proposals/HANDOFF-MVT-PREHISTORY-SNAPSHOTS-V1.md) and
[source-bound receipt](../pilots/mvt-prehistory/receipt.json).

## Local execution

2026-10-28, Windows x64, Node 24.15.0, V8 13.6.233.17-node.48, ICU 78.2,
locale en-US. Python 3.12.14, standard-library Decimal precision 60.
`NODE_OPTIONS=--max-old-space-size=1536` for the guarded affected-test run.
Dependencies reused the installed lockfile-backed workspace dependency junction;
no installation or dependency change was performed.

| Check | Result |
| --- | --- |
| New shared-history/transfer tests | 38/38 pass |
| Existing MVT reference-preflight tests | 30/30 pass |
| Existing physical-reservoir control | 33/33 pass |
| Existing finite-reservoir authority | 32/32 pass |
| Existing local-state/save foundation | 28/28 pass |
| Existing local acid control | 25/25 pass |
| Existing carbonate conservation | 30/30 pass |
| Existing cavity evolution ledger | 13/13 pass |
| Total, eight serial one-worker guarded files | **229/229 pass**, no skipped tests; highest observed batch RSS 736 MB |
| Independent Python causal arithmetic | **99/99 quantities** agree within disclosed roundoff bounds |
| Typecheck | pass |
| Full generated build + exact drift check | pass, 187 modules; generated game page unchanged |
| Science manifest | pass, all 41 scenario declarations current |
| Science evidence | pass, 128 authenticated artifacts; execution and all nine producer contracts unchanged |
| Release audit | pass |
| New pilot receipt replay | exact match |
| Diff hygiene | pass |

Exact commands:

```text
node pilots/mvt-prehistory/receipt.mjs --write
node pilots/mvt-prehistory/receipt.mjs --check
python pilots/mvt-prehistory/reference.py
npm test -- --file tests-js/mvt-prehistory.test.ts --file tests-js/reservoir-reference-preflight.test.ts --file tests-js/physical-reservoir-mapping.test.ts --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
npm run typecheck
npm run build
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --check
```

Python executable used locally:
`C:/Users/baals/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`.
The test foreman used its existing one-file/one-worker, 2,048 MB RSS watchdog.
No heavy runs overlapped. Task-owned test shells exited; no server, browser or
retained helper was started. Existing user previews were left alone.

Local logs and shell lifetime identities are retained under
`.local-evidence/mvt-prehistory/`. These are local execution records, not
committed scientific authorities. The earliest transfer-only draft was run
before the user clarified the shared-history boundary: 13/15 assertions passed;
two used inappropriate literal binary floating equality. They were corrected
to scale-aware roundoff assertions, with the failed log retained at
`.local-evidence/finite-pore-reconciliation/transfer-tests.log`. The later first
history run passed 36/36; the final extended run passed all 38 new tests. No
scientific tolerance or production rule was changed to make a test pass.

## Production identity and CI boundary

Unchanged production execution digest:
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`.

There are no changes under `js/`, `data/`, `agent-api/`, `tools/`, generated
`index.html`, package/lock files, existing pilot receipts, baselines or archived
science evidence. Only the new pilot, focused tests, handoff/evidence documents
and the existing CI step's invocation change. This is a source-identity proof
of no production change, **not a newly executed 41-scenario growth comparison**.

The PR's validation section records the published exact head, fresh Actions
run, attempt, tested merge tree and any retry. CI retains existing specimen,
flat/3D/fallback compatibility tests, the six real-Chrome cleanup cases and
calibration sentinel. It additionally executes these new tests and the Python
witness. Local checks above are not a claim that fresh remote CI has run.
The feature branch does not deploy; deployment validation belongs to the
reviewed merge, not to an unchanged old main deployment.

## Unverified physical boundary

Neither the authored component vectors nor their solvent/volume coefficients
are measured natural-fluid inputs. The control does not independently prove
geology, wetting, a brine EOS, pH/speciation, charge or full H/O balance,
sealing/fracture kinetics, physical time or transport. Post-reaction solution
volume remains unresolved. It does not map the legacy reference kilogram,
booked calcite or completed surfaces onto physical pore stocks.

Actual MVT remains HOLD on its sourced host/alteration/void history, finite
fluid amounts and analyses, constitutive volume relations, feeder provenance
and wet-cell/access allocation. Connected and sealed natural snapshots remain
`null`; production reactions and transport remain disabled.
