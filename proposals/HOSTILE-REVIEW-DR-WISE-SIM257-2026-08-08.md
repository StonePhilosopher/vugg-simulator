# AI Dr. Michael Wise hostile review — SIM 257

Date: 2026-08-08  
Scope: Roughton Gill mine-specific reconciliation  
Reviewer role: adversarial AI simulation reviewer, not the real scientist or
Smithsonian  
Canonical RNG seed: 42  
Authored Roughton shape seed: 1882

## Round 1 verdict: UNSATISFIED

The reviewer accepted the reconstructed mineral hierarchy, sulfur and carbon
closure, deterministic expected-suite delivery, and exclusions, but identified
three release blockers:

1. Plumbogummite nucleated at steps 100, 105, and 114 in the same early interval
   as pyromorphite rather than as the claimed late phase after the
   step-215 cap.
2. The step-140 carbonate-buffer event silently raised Cu from 70 to 150 ppm
   without identifying or recording a source, materially supporting the later
   Cu–Zn carbonates.
3. The generated science-provenance manifest still described SIM 256 and the
   superseded Red Gill-derived carbonate-deficient interpretation.

## Remediation

- The Roughton contract now opens plumbogummite nucleation at step 215 only.
  The first Roughton plumbogummite is placed on an older active pyromorphite.
- A generic `declareFluidBoundaryAddition` receipt records named imported
  metal/silica sources and checks declared amounts against actual bulk deltas.
  Roughton receipts close at steps 100, 140, 180, and 215. The step-140 receipt
  records exactly 80 ppm Cu from carbonate-buffered upgradient
  Cu-weathering drainage, separate from the 145 ppm local gangue-carbon release.
- The SIM 257 baseline, 39 strip stories, 12-scenario strip digest, 39 Markdown
  plus 39 JSON claim cards, and 39-scenario/220-citation provenance manifest
  were regenerated from the post-fix bundle.
- The archived Roughton trace records pyromorphite at steps
  100/101/104/105/109/113 and plumbogummite at 215/221/223.

## Reviewed blast radius

Baseline comparison moves three of 39 scenarios:

- `roughten_gill`: the intended mine-specific reconstruction, 81→89 crystals
  and 25→30 species, with the old sulfate/As-sulfide headline replaced by the
  documented primary and supergene hierarchy.
- `radioactive_pegmatite`: 42→40 crystals and 12→11 species because two
  zero-growth, parentless plumbogummite nuclei are now forbidden. No legitimate
  pegmatite phase is lost.
- `supergene_oxidation`: 110→111 crystals with the same 34 species; the shared
  phosphate-dispatch correction shifts one lepidocrocite birth and minor final
  sizes without changing the Tsumeb phase set or expectation contract.

## Verification before round 2

- Roughton scenario suite: 8/8.
- Combined calibration/archive/provenance/claim-card/expectation/plumbogummite/
  Roughton gate: 8 files, 82/82 tests, one worker, 857.27 s.
- `npm run typecheck`: PASS.
- `npm run build:check`: PASS, 165 modules current.
- `npm run audit:creative`: PASS; 50/50 live authored fluid fields, 20/20 live
  environmental controls, 25/25 setup controls, 23/23 advanced history
  editors, and no silent input drops.
- `npm run audit:science`: PASS; 39 scenarios current.
- `npm run check:pressure-grid`: PASS; Node-only digest-pinned artifact.
- `git diff --check`: no whitespace errors (Windows line-ending notices only).

## Round 2 verdict: UNSATISFIED

The first three blockers were repaired. The reviewer then found three valid
residual defects:

1. Step 180 silently reduced Cu from 150 to 70 ppm while its generic receipt
   declared only silica and Zn additions.
2. The new pyromorphite-parent requirement was global, incorrectly making the
   catalog's mimetite, cerussite, anglesite, dissolving-galena, and wall routes
   unreachable.
3. The UI and tests called the plumbogummite relationship a "true pseudomorph"
   even though pyromorphite remained active and no transformation was booked.

## Round 2 remediation

- Generic fluid-boundary testimony is now signed. Ordered additions and
  replacements report target, net delta, imports, exports, actual delta, and
  closure. The step-180 silica-rich seep books the 80 ppm Cu export; the
  step-60 solute replacement and step-215 low-chloride replacement are also
  explicit rather than relying on implicit propagation.
- The older-pyromorphite requirement is scenario-local to Roughton Gill. The
  global plumbogummite dispatcher again exposes every catalog substrate route.
- The physical model is now stated accurately: cobalt-blue plumbogummite is an
  encrusting botryoidal overgrowth on an older, still-active pyromorphite. Habit,
  engine testimony, scenario prose, research note, and regression contract no
  longer claim mass-balanced replacement that the engine does not perform.

## Round 3 verdict: UNSATISFIED

The scientific and mass-balance defects were closed, but the reviewer found one
remaining global reproducibility leak. First-parent selection and the
older-parent filter were still partly global. Although counts matched, the
changed phosphate-dispatch RNG consumption shifted maximum duftite and mimetite
sizes in `supergene_oxidation`.

## Round 3 remediation

- Both special rules are now Roughton-local: only Roughton requires an older
  pyromorphite and deterministically chooses it for the first plumbogummite.
  Other scenarios retain same-tick parent eligibility and the historical 0.65
  substrate-selection RNG draw.
- A regression with a same-tick non-Roughton pyromorphite asserts exactly one
  historical selection draw. The bare-wall route remains separately tested.
- Full JSON comparison of the seed-42 v256 and final v257 baselines reports
  `exact_changed_scenarios=["roughten_gill"]`; both
  `supergene_exact=true` and `radioactive_exact=true`.
- The affected supergene strip, 12-scenario digest, and supergene claim-card
  pair were regenerated from the final bundle.

## Round 4 verdict: SATISFIED

The AI Dr. Michael Wise hostile-review role independently confirmed that no
concrete scientific-integrity, mass-balance, locality-scope, or reproducibility
blocker remains. The final canonical baseline changes only Roughton Gill;
`supergene_oxidation` and `radioactive_pegmatite` are exact JSON matches to
SIM 256. Parent timing and RNG consumption are scenario-scoped, all 39 strips
and 39 Markdown plus 39 JSON claim cards are current, and the 39-scenario /
220-citation provenance manifest passes with zero errors.
