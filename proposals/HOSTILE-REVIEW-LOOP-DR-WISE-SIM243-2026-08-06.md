# Hostile-review loop handoff — SIM 243 through SIM 245

Date: 2026-08-06
Local repository only: `C:\Users\baals\Local Storage\AI\GTP\Vugg-Simulator`
Status: **complete** — the independent AI hostile-review role returned
`SATISFIED` for the exact SIM 245 code commit
`e4c3df273e54d71fb0a779d148d10e5d6afd0095`.

## Role disclosure

“Dr. Michael Wise” is an independent AI hostile-review role used to test the simulator against a demanding mineralogical standard. It is not participation by, correspondence with, or endorsement from the real Dr. Michael Wise or the Smithsonian Institution.

## Why this tranche exists

The post-SIM-242 review returned NOT SATISFIED. SIM 243 addresses its silica phase-identity and sulfur conservation blockers before touching scenario yield targets.

## Claims to attack

1. Low-temperature opal and crystalline quartz are selected as distinct phases before supersaturation and nucleation.
2. No quartz object is cosmetically relabelled opal or generic chalcedony.
3. Sulfide, sulfate, and elemental sulfur are independently conserved in explicit scenarios.
4. Sulphur Bank's native sulfur follows a balanced H2S/O2 interface reaction with no fabricated acid.
5. Sicily's native sulfur follows a separate anoxic microbial/inherited pathway.
6. Creative Mode exposes the oxidation-state reservoirs and pathway choice as real setup/live levers.
7. Surface scenarios at about one atmosphere are no longer clipped to 0.01 kbar.

## Evidence and executable gates

- Research: `research/arcs/research-silica-sulfur-correction-2026-08-06.md`
- Core acceptance: `tests-js/silica-sulfur-reservoirs.test.ts`
- Scenario checks: `tests-js/sulphur-bank.test.ts`, `tests-js/sicily.test.ts`
- UI and pressure checks: `tests-js/creative-controls.test.ts`, `tests-js/pressure-science.test.ts`
- Full suite, regenerated seed-42 baseline, strip archive/digest, and v243 claim cards must all be green before review.

## Follow-on blockers and closure record

- SIM 244 (`294ee5d4bd6eb6b3563a97de24ca8adf160fca9a`)
  implemented one authoritative gypsum/anhydrite evaluator and a replayable,
  mass-balanced gypsum-to-anhydrite replacement. It also reconciled Sunnyside's
  retained chalcopyrite/Au/Mn-bearing calcite promises and made Tsumeb's
  dolomite host composition explicit. Primary and replacement anhydrite remain
  distinct. Acceptance lives in `tests-js/caso4-phase-selection.test.ts`,
  `tests-js/sunnyside-american-tunnel.test.ts`, and
  `tests-js/host-rock-composition.test.ts`.
- The SIM 244 hostile review accepted those former blockers but returned
  `NOT SATISFIED` on three new conservation defects: native-sulfur oxidation
  was not proven through the production engine, sulfur boundary flux was
  residual-inferred rather than declaration-driven, and Sicily's carbonate
  buffer invented carbon outside its stated 1C:1S SD-AOM reaction.
- SIM 245 (`e4c3df273e54d71fb0a779d148d10e5d6afd0095`)
  closed those findings. Native-sulfur oxidation now has production-path open
  and O2-limited closed-fluid tests with sulfur/oxygen closure and explicitly
  diagnostic-only proton accounting. Sulfur boundary additions/replacements
  are declaration-driven and undeclared creation fails closed. Sicily carries
  a whole-scenario carbon ledger, with methane, wall-rock carbon, and boundary
  carbon separated; its pH buffers repartition existing DIC without creating
  carbonate. The final full gate passed typecheck, generated-bundle parity,
  the complete Creative geological-lever audit, **188/188 test files**, and
  **2,572/2,572 tests**. The independent reviewer separately passed the focused
  four-file **78/78** suite and the same full TypeScript/Vitest aggregate.
- Sulphur Bank cinnabar/native-sulfur association is represented as documented
  fracture/sinter and vertical alteration zoning, not as unsupported native-S
  epitaxy. This was checked against USGS Bulletin 922-L and Bulletin 1693.
- Generic chalcedony/agate remains an explicit model boundary rather than a
  false phase label. Named chalcedony-class engines remain separate; no current
  shipped scenario or UI claim presents generic chalcedony as implemented.

Final independent verdict: **SATISFIED**. This closes the science-accuracy
handoff that began at SIM 243. It does not convert the internal AI review into
professional sign-off and does not close the separate long-term AAA production
gates in `proposals/PLAN-AAA-SCIENCE-FIRST.md`.
