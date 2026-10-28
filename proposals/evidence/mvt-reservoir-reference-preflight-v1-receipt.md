# MVT reservoir reference preflight v1 — delivery evidence

Base `01903bbe84766aa8b795047b363a8e38ba03d9b2`; branch
`feature/reservoir-reference-preflight`. Source identity and numerical evidence
are retained in `pilots/reservoir-reference-preflight/receipt.json`.

Environment: Windows x64, Node 24.15.0, V8 13.6.233.17-node.48, ICU 78.2,
locale en-US. Independent witness: bundled Python 3.12.14, standard-library
Decimal precision 60. No dependencies or lockfiles changed.

Scope: one seed-42 MVT initialization and a noncommitting 0.5 mm **reference**
attack preview, uniform diagnostic weights. No growth run, accepted dissolution,
physical water/solid migration, scenario tuning, production imports, renderer
changes, reactions, transport, or scientific-authority opt-in.

## Completed observations

The authentic scientific cavity has capacity 68,226.21551819511 mm3 and 7,680
canonical addresses. The existing reference-to-geometry target is algebraically
equivalent to one kilogram if interpreted as dense calcite removal. The nominal
required solvent/cavity-volume quotient is 14,657.122521083 kg/m3; it is not a
fluid-density estimate. Actual solvent kg, density, solvent fraction, wet-cell
volumes and accessible wall calcite remain unknown. See the handoff for the
separate numerical geometry tolerance and scientific holds.

The scientific fingerprint, wall serialization, active provider and RNG remain
unchanged by inspection. One wall parent stays global; grown calcite is excluded.
The independent Decimal witness checks nine derived quantities using the actual
capacity and existing 15 / 40.078 and 36.934 reference constants. It does not
independently remeasure geometry or authenticate those model inputs as nature.

## Validation and retries

Initial bounded command:

```text
npm test -- --file tests-js/reservoir-reference-preflight.test.ts
```

It exited **2 / INCONCLUSIVE** because sandboxed `tasklist.exe` RSS sampling
received `ERROR: Access denied` twice. No pass or cost witness was accepted.
The same bounded test command was rerun with access to its required RSS monitor:
**29/29 passed**, one worker, peak 692 MB, watchdog ceiling 2,048 MB. No test
assertion or monitoring rule was relaxed. A subsequent clarification adds the
explicit void/crystalline-volume quotient; final affected validation follows.

Final affected validation passed **191/191** tests in seven sequential,
single-worker batches: new preflight 30, physical control 33, finite reservoir
32, local foundation 28, acid pilot 25, carbonate conservation 30, cavity
evolution 13. Peak RSS was 698 MB; all seven batches retained the 2,048 MB
watchdog. These final results include the explicit quotient and source guards;
the earlier 29-test run is not counted again. No assertion failed.

```text
node pilots/reservoir-reference-preflight/receipt.mjs --write
python pilots/reservoir-reference-preflight/reference.py
npm test -- --file tests-js/reservoir-reference-preflight.test.ts --file tests-js/physical-reservoir-mapping.test.ts --file tests-js/finite-reservoir-authority.test.ts --file tests-js/local-state-foundation.test.ts --file tests-js/local-acid-buffer.test.ts --file tests-js/carbonate-boundary-conservation.test.ts --file tests-js/cavity-evolution-ledger.test.ts
node pilots/reservoir-reference-preflight/receipt.mjs --check
npm run typecheck
npm run build:check
npm run audit:science
npm run audit:evidence
npm run audit:release
git diff --exit-code 01903bbe -- js index.html data tools archive release agent-api pilots/calcite pilots/local-acid-buffer pilots/finite-reservoir-authority pilots/physical-reservoir-mapping package.json package-lock.json
git diff --cached --check
```

Every final command passed. The exact build checked all 187 modules. The science,
evidence and release audits verified the current 41-scenario manifest, 128
evidence artifacts and unchanged execution/producer identities. This is byte/
receipt verification, not a new 41-scenario simulation run. The base main CI
also passed at `01903bbe` (Actions run `40637188113`). Fresh PR CI results will
be linked in the PR after publication; no CI success is preclaimed here.

## Publication and limits

The feature branch does not deploy. Merge is a separate review action. The
execution digest must remain
`d2171e7e44e1e0b53aa70761511684b68c03a88020bce45f75625ef71b03c93e`, and
all nine registered science-producer contracts must remain unchanged. No
science receipt is rebaked or rebound and no fresh 41-scenario fleet is claimed.

Production physical-mapping HOLD remains. Numerical compatibility of a proposed
water/stock hypothesis is not evidence for its physical or spatial authority.
