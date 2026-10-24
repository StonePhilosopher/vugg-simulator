# PR 32 — measurement precision and evidence reuse

Validation in progress; this is not yet a promotion receipt.

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

Fresh production controls, the full seed-42 scenario panel, exact source and
runtime identities, commands, pass/fail counts, CI, deployment, and remaining
unverified boundaries will be recorded before promotion. Historical SIM285
numbers in the recipe review remain historical; they are not rebound to SIM286.
No birth-census comparison is claimed without its independently supplied input.
The visibility tiers are size proxies, not testimony that the camera can see
an enclosed crystal. Exposed and enclosed counts remain separate. The audit
reports the existing fahlore growth restriction; it does not repair that model.
