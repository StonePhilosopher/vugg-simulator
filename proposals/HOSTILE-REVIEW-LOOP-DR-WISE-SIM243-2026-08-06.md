# Hostile-review loop handoff — SIM 243 through SIM 246

Date: 2026-08-06
Local repository only: `C:\Users\baals\Local Storage\AI\GTP\Vugg-Simulator`
Status: **reopened for SIM 246 review**. The independent AI hostile-review role
returned `SATISFIED` for SIM 245 commit
`e4c3df273e54d71fb0a779d148d10e5d6afd0095`, then correctly rejected the later
closure handoff because it still described generic chalcedony as unimplemented
while shipped stories and UI text claimed chalcedony/agate. The SIM 246 working
tree resolves that contradiction and adds mass-booked area-covering surface
fabrics; an exact-commit verdict is pending.

## Role disclosure

“Dr. Michael Wise” is an independent AI hostile-review role used to test the simulator against a demanding mineralogical standard. It is not participation by, correspondence with, or endorsement from the real Dr. Michael Wise or the Smithsonian Institution.

## Why this tranche exists

The post-SIM-242 review returned NOT SATISFIED. SIM 243 addresses its silica phase-identity and sulfur conservation blockers before touching scenario yield targets.

## Claims to attack

1. Low-temperature opal and crystalline quartz are selected as distinct phases before supersaturation and nucleation.
2. Opal, chalcedony, and quartz are first-class phase records; none is a cosmetic relabel of another.
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
- SIM 246 replaces the temporary generic-chalcedony boundary with a production
  phase: independently calculated saturation, a gate and nucleator, accepted
  shell/fabric records, a formula ledger, solution-mediated mass-balanced
  maturation, and Creative hover diagnosis. Deccan and Ametista do Sul execute
  real chalcedony before later quartz. The idle renderer and both vug-seal log
  paths have lost the old quartz-fill-to-agate nickname. Mammoth's documented
  carbonate water remains silica-free and exposes the competing water regime.
- SIM 246 verification targets are `tests-js/chalcedony-phase.test.ts`,
  `tests-js/silica-sulfur-reservoirs.test.ts`,
  `tests-js/amethyst-geode.test.ts`, and the updated
  `tools/amethyst-sceptre-probe.mjs`.
- The same tranche now makes aggregate geometry match its geological fabric.
  Chalcedony/agate is a laminated wall lining; appropriate hematite,
  malachite, azurite, and pyrolusite habits are crusts; quartz/calcite coating
  variants are euhedral druse; and only genuinely fibrous/asbestiform members
  of the six-mineral asbestos set become mats. The representative renderer
  instances never enter `sim.crystals` or multiply booked volume. Physical
  mean thickness closes exactly to `_volume_mm3`; mobile is a 56-instance LOD
  of the same state. The Mn-oxide boundary is explicit: traditional dendritic
  “pyrolusite” is not painted as pyrolusite because Potter & Rossman identify
  those coatings as other Mn-oxide families. Evidence and contracts live in
  `research/arcs/research-surface-growth-fabrics-2026-08-06.md` and
  `tests-js/surface-growth.test.ts`.
- Final local verification passed TypeScript, exact generated-bundle parity,
  the full Creative geological-lever audit, **190/190 test files**, and
  **2,597/2,597 tests**. The regenerated evidence set comprises the 39-scenario
  seed-42 baseline, 39 full strip stories (5.6 MB), the 12-scenario spatial
  strip digest, and 39 hostile-review claim cards. Desktop WebGL and responsive
  layouts at 390x844 and 320x568 were inspected in the locally served build;
  both phone widths had zero horizontal overflow and the renderer logged no
  errors.

Current independent verdict for the SIM 246 working tree: **PENDING**. The last
SATISFIED verdict applies to the SIM 245 commit named above, not to these new
changes. No internal AI verdict constitutes professional sign-off, and this
science tranche does not close the separate long-term AAA production gates in
`proposals/PLAN-AAA-SCIENCE-FIRST.md`.
