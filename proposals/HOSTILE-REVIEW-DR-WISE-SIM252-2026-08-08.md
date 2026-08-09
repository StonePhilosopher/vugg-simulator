# AI Dr. Michael Wise hostile-review receipt — SIM 252

Date: 2026-08-08
Role: adversarial AI review persona, not the real scientist or Smithsonian
Verdict: **SATISFIED**

## Scope reviewed

- Reaction-specific SUPCRTBL pressure corrections for five carbonate and three
  sulfate dissolution reactions.
- One-bar-relative `Δlog10 K`, exact species/reaction mapping, bounded bilinear
  interpolation, water-density masking, and forbidden extrapolation.
- Explicit non-promotion of gypsum, HMC, variable Cu–Zn carbonates, and solids
  absent from the selected database.
- Pressure threading through saturation, PWP growth/dissolution, CaSO4 phase
  selection/replacement, strip/helix instruments, and Creative formation
  diagnosis.
- Sweetwater and generic-MVT reconciliation, including removal of the
  open-spring aragonite selector from sealed veins while preserving the shallow,
  Mg-driven, and high-pressure aragonite paths.
- Seed-42 baseline/digest, all 39 strips and claim cards, and science provenance.

## Reproducibility clarification

The simulator's former Python runtime and pytest suite had already been
retired; Python/JavaScript parity is not a release or science gate. The shipped
game, authoritative engine tests, build, and CI are TypeScript/JavaScript.

The pressure-grid work introduced a separate, offline scientific-data compiler,
not a restored game runtime. It records the exact external thermodynamic model
used to commission the versioned grid:

- `environment-pressure-grid.yml` pinning Python 3.12.13 and Reaktoro 2.13.0;
- `tools/run-pressure-grid.mjs`, which probes candidate interpreters and rejects
  every environment that does not import exactly Reaktoro 2.13.0;
- an opt-in pressure-grid artifact check, outside the ordinary CI path;
- digest-pinned generator, launcher, and environment receipts in the generated
  science manifest.

The runtime tests consume only the digest-pinned generated artifact. They do not
require Python, Reaktoro, or an interpreter on the player's/developer's PATH.
Any older references to Python game/runtime parity remain historical fossils,
as documented in `ARCHITECTURE.md`.

## Verification presented

- Pressure/mechanism/evidence suite: 171/171.
- Seed-42 calibration: 40/40.
- Multi-seed qualitative assertions: 10/10.
- Reproducibility/provenance focused rerun: 10/10.
- `npm run build:check`: PASS.
- `npm run audit:creative`: PASS.
- `npm run audit:science`: PASS.
- `npm run check:pressure-grid`: artifacts current through Reaktoro 2.13.0.
