# Hostile Review — Dr. Michael Wise — SIM259

Date: 2026-08-09  
Scope: cation sinks, pharmacolite competition, köttigite selection, Tsumeb
locality enforcement, and Creative analytical controls  
Reviewer: AI hostile-review role “Dr. Michael Wise”

## Initial verdict

`REJECTED` pending correction of four material defects:

1. The köttigite selector treated mass ppm as cation proportions, allowing a
   dimensionally invalid Zn-majority and Ni-substitution decision.
2. The Tsumeb first-stage restriction existed as descriptive metadata rather
   than an enforced scenario-local exclusion.
3. The original cation receipt sampled only the final spatial field and could
   coerce missing or non-finite values to zero.
4. Pharmacolite competition also used raw mass-ppm shares and its provenance
   pointed to a retired working-note path.

## Corrections required and verified

- Convert Ca, Zn, Co, Ni, Cu, and Pb mass-ppm concentrations to dissolved
  cation mole proxies before comparing competition shares.
- Retain empirical thresholds only as plainly disclosed calibration proxies;
  do not describe them as equilibrium allocation, speciation, partitioning, or
  crystallographic site occupancy.
- Enforce Tsumeb's köttigite exclusion in production scenario logic and prove
  it holds under adversarial chemistry that would otherwise nucleate the
  mineral.
- Audit all 161 Schneeberg trajectory rows and all 7,680 addressable Zn control
  volumes per row; reject missing, non-numeric, null, undefined, or non-finite
  bulk and spatial values.
- Remove phantom pharmacolite provenance paths and regenerate all versioned
  strips, claim cards, and the science manifest.
- Prove every accepted Creative analytical lever reaches a production consumer
  and survives save/replay.

## Final evidence

- `npm run audit:cations`: PASS — 161 × 7,680 finite Zn values, zero bulk and
  spatial Zn, five pharmacolite crystals, final Ca molar proxy 0.618402.
- Independent seeds 1 and 7: zero Zn throughout; final Ca molar proxies
  0.622471 and 0.624060.
- Tsumeb adversarial test: chemistry exceeds the global köttigite selector but
  production reports `scenario-locality exclusion` and grows no köttigite.
- `npm run audit:creative`: PASS — 48/48 setup levers reach production and
  48/48 survive save/replay.
- Generated evidence: 39 strips, 39 JSON cards, 39 Markdown cards, and a
  39-scenario/226-citation manifest, all with the current model identity.
- Independent focused artifact gate: 3 files/16 tests PASS.
- Full local `npm run ci`: PASS — typecheck, reproducible build, Creative,
  cation, and science audits, then 203/203 files and 2,744/2,744 tests in
  9,062.58 seconds with one Vitest worker.

## Final verdict

`SATISFIED — no material blocker remains.`

The reviewer accepts the remaining limitation: dissolved-cation molar shares
are calibrated selectors rather than a full activity/speciation/partition
model. That limitation is explicit, bounded, and future-replaceable; it is not
misrepresented as first-principles thermodynamics.
