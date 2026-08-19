# AI Dr. Michael Wise hostile-review receipt — SIM 255

Date: 2026-08-08  
Role: adversarial AI review persona, not the real scientist or Smithsonian  
Verdict: **SATISFIED**

## Scope reviewed

- Zone-resolved `Ca(1-x)Mg(x)CO3` HMC composition, accepted-shell formula
  receipts, calibrated growth booking, LIFO dissolution return, and the
  remaining-shell crystal composition summary.
- Mucci (1987) temperature-dependent Mg partitioning and Mucci & Morse (1983)
  parent-fluid composition dependence.
- Busenberg–Plummer / Glynn–Reardon nonideal calcite–disordered-dolomite
  component activities and the official PHREEQC solid-solution equations.
- Creative mode's live HMC composition, saturation, limiting-reagent, phase
  stability, uncertainty, production, substrate, and competition explanation.
- Rosasite and aurichalcite evidence boundaries; neither empirical engine was
  promoted into an unsupported solid-solution thermodynamic model.

## Hostile findings and resolutions

The first review rejected a universal Mg-partition calculation and a stable
equilibrium interpretation of the HMC branch. The implementation now supports
only a standard-seawater proxy (molar Mg/Ca 4.5–6, 30–40‰, 5–40 °C) and the
measured high-ratio plateau (Mg/Ca 7.5–20, 30–40‰, 25±0.25 °C). Every other
parent fluid receives a named coverage gap, null composition, and no HMC
presence/absence verdict.

The PHREEQC 25 °C miscibility gap contains the promoted HMC compositions.
Accordingly, the calculation is explicitly a metastable fixed-composition
kinetic saturation screen with `stableEquilibriumClaim:false`, not a stable
homogeneous-solution equilibrium. Outside 25 °C, use of dimensional interaction
parameters divided by RT is separately labeled a bounded activity-model
extrapolation.

The second review found that the high-ratio plateau was still unbounded above
Mg/Ca 7.5 and that Creative converted unsupported composition into apparent
`σ=0`, blocked, or not-formed verdicts. The plateau now stops at the measured
Mg/Ca=20 ceiling and requires a seawater-like solution matrix. Creative uses an
amber `composition/saturation unresolved` pill, suppresses numeric saturation,
production probes, and causal counterfactuals, and returns top-level `unknown`
verdicts for both never-formed and formed-earlier histories.

Live instructions that still told maintainers to mirror the TypeScript game
into the retired Python prototype were removed. Historical audit notes remain
as provenance; Node/Vitest is the game and test architecture.

## Verification presented

- Focused HMC/carbonate/nucleation-hover suite: 104/104.
- Independent hostile-review suite: 93/93.
- Expanded calibration/evidence suite: 11 files, 181/181; archived artifact
  identity and claim-card follow-up: 4/4.
- Seed-42 baseline: 39 authored scenarios at their authored `shape_seed`.
- Baseline drift: 3/39 scenarios, each removing unsupported HMC; no authored
  expected species disappeared.
- Compact strip chemistry digest: numerically identical to SIM 254 after
  version/model identity normalization.
- Full strip archive: 39 stories, 6.4 MB, with direct drift reviewed in the
  three affected scenarios.
- Claim-card archive: 39 Markdown + 39 JSON cards generated from the
  identity-checked SIM 255 strip stories.
- TypeScript build and `build:check`, Creative audit, science/provenance audit,
  and `git diff --check`: PASS.
- Final hostile verdict: `SATISFIED`; no remaining material scientific defect
  in the SIM 255 mixed-carbonate tranche.
