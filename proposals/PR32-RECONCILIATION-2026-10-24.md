# PR 32 — measurement precision and evidence reuse

Local validation is complete. Fresh configured CI and ordered integration after
PR28 remain delivery gates; no full local cold-suite verdict is claimed.

The original audit is passive: it observes nucleation, engine candidates, stored
zones, and surviving dimensions, then reports the distinctions. It does not
change mineral rules, growth, rendering, or the declared 0.1/1 mm thresholds.
The latest reviewed incoming head is `f0a4bb5970cad7a0832e86194e5022093dec0790`.

Two executable defects prevented approval:

- Stored length was rounded to four decimals before classification, promoting
  0.09996 mm to the 0.1 mm tier and 0.99996 mm to the 1 mm tier. Measurements now
  retain their full numeric precision; only printed lengths are rounded, with
  an approximation marker when the printed number differs.
- A cached green comparison could survive a changed reference baseline. Cache
  identity now includes the current seed-42 baseline bytes/presence, dependency
  lock, and actual Node/V8/ICU/OS/architecture/locale formation, alongside the
  existing runtime/data/harness/tool identities. Audit version is 2. Old rows
  are not relabeled. External story roles remain a fresh report-only join.

The focused tests execute the actual CLI with synthetic crystals in isolated,
owned temporary directories. They cover both threshold boundaries, printed
approximations, stale-baseline rejection, runtime-context separation, and role
refresh without replaying unchanged physical rows. Runtime-label overrides in
that fixture test cache plumbing; they are not cross-runtime scientific runs.
The new test is required in configured CI.

Historical SIM285
numbers in the recipe review remain historical; they are not rebound to SIM286.
No birth-census comparison is claimed without its independently supplied input.
The visibility tiers are size proxies, not testimony that the camera can see
an enclosed crystal. Exposed and enclosed counts remain separate. The audit
reports the existing fahlore growth restriction; it does not repair that model.

## Completed validation

The incoming head was selectively reconciled with validated PR28 head
`f38459a8a28dcb6470a74622f6bf6f9464829b77`; both focused CI groups are retained.
The scientific runtime, data, official receipts, baselines, release assets and
generated bundle are byte-identical to that release. Its execution identity is
`d1944009b39d0dee86ede656a15c0b98d2be5e56dcc0d6a77d9b94f27be2bb77`.

Commissioned Windows x64 / Node24.15.0 / V8 13.6.233.17-node.48 / ICU78.2 /
en-US was used. The final instrument source SHA-256 is
`dea0d8132f09dc7598c1eac66c7621a387266d1fbcfc8af9362fc2b2e097bbfd`.

```
npm run build:check
node --max-old-space-size=1024 tools/born-grown-audit.mjs --seeds 42 --fresh --story-targets <exact targets from 940ee35c>
npm run typecheck
npm test -- --file tests-js/born-grown-audit.test.ts
npm run audit:science
npm run audit:evidence
npm run audit:release
npm run audit:browser-receipt
node tools/check-viewer-paths.mjs
git diff --check
```

- All 41 fresh scenario runs reproduced their seed-42 calibration baseline.
- All nine production control pairs passed; zero capture-integrity failures.
- 359 contracted pairs inspected; zero births in aspirational/excluded tiers.
- None of this fleet's size tiers changed under the old rounding rule. The
  synthetic boundary fixtures prove both false promotions and their correction.
- All nine end-to-end synthetic CLI tests passed, before and after integration.
  These are repeated groups, not 18 unique tests. No failed test was retried.
- Typecheck, exact build, all four audits and diff hygiene passed.
- Both real viewer cases passed, including native WebGL construction, existing
  wall controls, the flat cavity view and actual disabled-WebGL fallback.
  Scientific fingerprints remained unchanged; profiles/processes/ports closed.

The [raw measurement rows](evidence/born-grown-visible-v286-runs.jsonl) and
[derived report](evidence/born-grown-visible-v286.json) are copied byte-for-byte
from the fresh run. The [validation receipt](evidence/born-grown-reconciliation-validation.json)
records their SHA-256 values, exact commands/environment and viewer proofs.

External story roles were pinned to held PR26 head
`940ee35ca0b7a78c2eeb0567d48dcae1c53caafd`, targets SHA-256
`2cba1c894649ef632cb6d73d34cc680202b444e10575674161c9d6268f1fe994`.
They remain report-only labels, not approved calibration or evidence that PR26
is ready. The independent birth-census input was absent, so that comparison is
explicitly **not compared**. This audit does not certify physical occurrence,
machine cleanliness, ownership, reservation, or cold-CI completeness.

CI and deployed-byte evidence are linked separately at the exact delivered head.
