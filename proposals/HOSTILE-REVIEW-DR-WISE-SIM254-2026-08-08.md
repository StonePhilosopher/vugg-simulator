# AI Dr. Michael Wise hostile-review receipt — SIM 254

Date: 2026-08-08
Role: adversarial AI review persona, not the real scientist or Smithsonian
Verdict: **SATISFIED**

## Scope reviewed

- Conserved DIC, reduced carbonate alkalinity, aqueous/headspace carbon, and
  explicit open, closed, charge, vent, and replacement-water transactions.
- Removal of every live fixed-DIC/pH-only atmospheric fallback.
- Per-carbon alkalinity bookkeeping for calcite, aragonite, dolomite, and HMC;
  basic and hydroxycarbonates remain explicitly unsupported.
- Travertine vent receipts and sabkha replacement-water transactions.
- Raw salinity testimony through 250 psu, alongside the deliberately clipped
  display chip and `salinity_model_missing` uncertainty.
- Seed-42 baseline, strip digest, all 39 strip stories and claim cards, Creative
  audit, science manifest, and deterministic calibration.

## Hostile findings and resolutions

The review loop found and required four surface corrections: removal of the
last event fallbacks, full four-phase Creative configuration, validation of
authored alkalinity against initial DIC/pH, and preservation of raw sabkha
salinity outside the display range.

The second review found that initialization/configuration blocking was not
sticky: the first clean spatial audit could clear `state.blocked`. The final
implementation distinguishes initialization, configuration, and permanent
blocks from recoverable spatial blocks. The spatial audit returns before
consuming receipts, reconciling fields, or clearing the block.

Two real `VugSimulator.run_step()` regressions now prove that both an authored
alkalinity/pH mismatch and an unsupported transfer phase preserve fluid DIC/pH,
headspace carbon, initial system carbon, last-DIC fields, and the transaction
ledger, while emitting no open or closed boundary solve.

## Verification presented

- `tests-js/carbonate-boundary-conservation.test.ts`: 25/25.
- Calibration plus strip digest: 53/53.
- Focused evidence/claim-card suite: 97/97.
- Build, Creative audit, science audit, and `git diff --check`: PASS.
- Final hostile verdict: `SATISFIED`; no remaining concrete science or
  reproducibility defect in the SIM 254 carbonate tranche.
