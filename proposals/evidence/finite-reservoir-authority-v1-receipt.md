# Finite reservoir authority v1 — delivery receipt

2026-10-27. Baseline `c2651d4f2c2526b4944ef853ea6676bd9b4afd97`.
Commissioned Windows x64 / Node 24.15.0, V8 13.6.233.17-node.48,
ICU 78.2, locale en-US. Local commands used
`NODE_OPTIONS=--max-old-space-size=1536` and the ordinary one-file/one-worker
RSS foreman, with its 2048 MB ceiling. No unbounded Vitest run was used.

The implementation is a standalone initial-declaration compiler and source
audit. Neither shipped runtime imports it. No reaction, transport, scenario,
mass, morphology, abundance, clock, UV, or rendering rule changed. Automatic
physical mapping of legacy reference stocks remains withheld.
The user selected wall carbonate first: schema v1 admits one global
`wall-carbonate` source and rejects grown-crystal stocks at this boundary.

## Evidence producers actually executed

| Command | Result |
| --- | --- |
| `node pilots/finite-reservoir-authority/audit.mjs --write` | New raw-declaration receipt for all 41 authored scenarios; 0 finite water declarations; 2 explicit DIC/reduced-alkalinity declarations; 15 limestone and 4 dolomite declarations |
| `node pilots/finite-reservoir-authority/audit.mjs --wall-census --write` | New constructor-state receipt for all 41 scenarios; each global reference ledger inspected without mutation; no simulator, growth or geometry authority installed |
| The same two commands with `--check` instead of `--write` | Both receipts reproduced exactly |

The receipts bind raw source hashes, the commissioned runtime and the unchanged
production execution set. The wall census preserves mmol/kg-reference, the
global owner, and the dolomite/calcite distinction. It emits no fabricated
physical kg water or mol calcite. It is not a fresh fleet growth comparison.

## Tests and checks

Final implementation test coverage: **128 passing tests** across these five
bounded files. The finite-reservoir file was rerun after adding conservation,
roundoff, and the selected wall-only ownership constraints; earlier versions
are not counted again.

```text
npm test -- --file tests-js/finite-reservoir-authority.test.ts
  32 passed; latest monitored peak 734 MB RSS

npm test -- --file tests-js/local-state-foundation.test.ts
  28 passed
npm test -- --file tests-js/local-acid-buffer.test.ts
  25 passed
npm test -- --file tests-js/carbonate-boundary-conservation.test.ts
  30 passed
npm test -- --file tests-js/cavity-evolution-ledger.test.ts
  13 passed
```

The latter four ran serially in a five-file batch together with the earlier
29-test reservoir file. That batch passed all 125 tests and peaked at 743 MB RSS.
Only the reservoir test file was subsequently extended; implementation and
affected legacy files were unchanged. The final 32-test run supersedes that
file's earlier 29-test count, giving the 128 total above.

The tests include unequal water stocks, independent solid moles, rejection of
a second global wall stock despite a matching total, transparent floating-point
residuals, tiny-stock overdraft refusal, strict units/provenance, sparse and
legacy-input rejection, immutable sources, modified-checkpoint refusal, and
source-sensitive state identity, and isolation from caller edits. A fresh real tutorial simulator round-trips the
complete declaration and owner IDs through the PR #36 foundation; growth,
legacy diffusion and recipe persistence remain refused.

`npm run typecheck`, `npm run build:check`, `npm run audit:science`,
`npm run audit:evidence`, and `npm run audit:release` all passed. The generated
page exactly matches the same 187 compiled production modules. The new focused
test command is a durable CI step; the fresh PR CI result belongs to its exact
published head and run, separately from this local receipt.

## Retries, identity and boundaries

The first sandboxed test attempt ended **INCONCLUSIVE / exit 2** because
`tasklist.exe` access for the mandatory RSS monitor was denied. No PASS or cost
result from it was adopted. Its log/process record was preserved. The same
bounded command was rerun with process-monitor access and passed 26 tests.
Additional real-model/census tests then passed in the 125-test batch. An expanded
31-test run passed before the selected wall-owner boundary was finalized; the
final 32-test file above passed afterward. The initial 26 and intermediate
29/31 versions are excluded from the final 128 count. Both new receipts were
regenerated with their real producers after the final contract source changed.
Absent raw sulfur-pool declarations remain `null`, rather than an inferred
boolean or chemical zero.

The new receipts were emitted by their real producer; no existing science
receipt was edited or rebound. Production execution remains
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`.
All nine registered science-producer digests still equal their authenticated
values. Runtime, data, generated game page and registered producer sources are
unchanged, so there was no science rebake, new full-growth fleet, or new browser
benchmark. Existing science/release evidence was checked in place.

All validation helpers were foreground disposable commands with normal
completion as their end condition. Their process identities and logs are kept
under `.local-evidence/finite-reservoir-authority/`; no new server or real
browser was launched or retained. The existing user preview on port 8786 was
left untouched.

Physical water/reference reconciliation, reactive wall-stock mapping and spatial
access remain explicit scientific gates. An input label or reproducible compiler
does not close them. Declared experimental initial inventories are executable;
production reactions remain disabled.
