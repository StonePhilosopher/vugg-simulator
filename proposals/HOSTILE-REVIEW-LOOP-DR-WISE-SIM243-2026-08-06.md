# Hostile-review loop handoff — SIM 243

Date: 2026-08-06
Local repository only: `C:\Users\baals\Local Storage\AI\GTP\Vugg-Simulator`

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

## Known open blockers intentionally not hidden

- The authoritative gypsum/anhydrite selector and mass-balanced gypsum-to-anhydrite replacement remain the next tranche.
- Sunnyside promises and Tsumeb host/scenario reconciliation remain open.
- Generic chalcedony/agate is explicitly unimplemented as a phase; named chalcedony-class engines remain separate.

The reviewer should return `SATISFIED` only when no unresolved science, correctness, mobile, gameplay, or provenance blocker remains. Otherwise return `NOT SATISFIED` with ranked, executable findings.
