# Physical reservoir control v1: delivery receipt

Baseline: `ba0204ddba27067146d28ba5d53dbb6c15943788`, SIM 286.
Commissioned Windows x64 / Node 24.15.0, V8 13.6.233.17-node.48, ICU 78.2,
locale en-US. Runtime is checked by the ordinary evidence guards.

## Primary evidence and actual producer runs

The two original PDFs were downloaded directly from IAPWS and USGS. The web
fetch of the USGS PDF returned 403; the direct public download succeeded with
HTTP 200. The committed source record binds both exact SHA-256 values and
the relevant equation/table locations. Original equations and tables were
visually inspected; text extraction alone was not used to transcribe them.

IAPWS source SHA-256:
`fda79dde9f441a90da755477c6533e23065e4f90c7f59a505f64c394d775bd45`.
USGS source SHA-256:
`0f44f69eec1ed1428211a8c3a7ee1e3233478739d38c5ba756ea4f13de133037`.
The PDFs are retained privately, not redistributed as new project assets.

Actual commands:

```text
python pilots/physical-reservoir-mapping/reference.py --write
python pilots/physical-reservoir-mapping/reference.py --check
node pilots/physical-reservoir-mapping/receipt.mjs --write
node pilots/physical-reservoir-mapping/receipt.mjs --check
```

The Python command used bundled Python 3.12.14 by absolute path. Its checked-in
standard-library source and 60-digit output are reproducible independently of
the JS mapper. The Node producer verifies the three published IAPWS density
checkpoints, five global Decimal comparisons, three partition sizes and the
actual legacy wall constructor without mutation. It binds all its own sources,
the existing source audit and the unchanged production execution set.

The first Node producer attempt failed because its harness did not expose
`VugWall`. The producer was corrected to request `VugWall` and
`cavityMolarVolume` through the supported `extraExports` option and rerun. No
runtime/harness source was edited. After explicit precision refusal guards were
added, the producer was rerun again; no receipt was manually patched.

The bundled `pdftotext` executable was absent. Text extraction used bundled
`pypdf`, with Poppler rendering for visual inspection.
These were read-only source operations and created no retained helper service.

## Validation

The final six-file bounded run passed **161 tests** with peak **731 MB RSS**:

| File | Passed |
| --- | --- |
| `physical-reservoir-mapping.test.ts` | 33 |
| `finite-reservoir-authority.test.ts` | 32 |
| `local-state-foundation.test.ts` | 28 |
| `local-acid-buffer.test.ts` | 25 |
| `carbonate-boundary-conservation.test.ts` | 30 |
| `cavity-evolution-ledger.test.ts` | 13 |

The command is the six-file `npm test -- --file ...` invocation in the handoff.
The initial 33-test physical-control run preceded the final precision guards;
it is excluded from the 161 total above. The final implementation passed the
whole six-file run without a test retry.

The Python reference `--check`, new Node receipt `--check`, and both existing
41-scenario source/constructor receipt checks all passed. `npm run typecheck`,
`npm run build:check`, `npm run audit:science`, `npm run audit:evidence`,
`npm run audit:release`, and diff hygiene passed. The generated page matches
the unchanged 187 production modules. A direct diff against the baseline is
empty for both runtimes, data, tools, existing pilots, evidence and package files.

The existing finite-reservoir Windows CI command now also selects the new
physical-control file, serially. The fresh exact-head CI result belongs to its
published run; it is not represented as an additional local full-suite pass.

The focused tests cover published verification data, independent high-precision
global totals, unequal cell volumes, per-parent subdivision invariance,
independent water/shell geometry, precision loss, explicit scope/units refusal,
checkpoint provenance and ownership, and legacy-reference non-promotion.

The ordinary RSS foreman uses one file and worker at a time, with the 2048 MB
ceiling; `NODE_OPTIONS=--max-old-space-size=1536`. No unbounded suite or fresh
fleet growth comparison was run. This control is outside both shipped runtimes.
All existing scientific data, mass/volume rules, scenarios, RNG, generated game
page and registered evidence-producer sources remain unchanged.

## Boundaries

The case defines geometry and purity; it does not measure natural limestone.
The calcite value retains its historical standard-state approximation, reported
error and unquantified pressure limitation. Water uncertainty is not combined
with that different uncertainty convention or substituted for numerical closure.

The 24022.3014 stock ratio is conditional on equating reference kg with actual
water kg. It is a diagnostic, not a new conversion or a claim that the legacy
calibration is incorrect. Physical legacy mapping and stock debit remain HOLD.
Reactions, transport, rates, clocks, UV and production buffering are disabled.
No grown-crystal stock or completed surface is made a wall buffer.

No new server or real browser is launched or retained locally. Foreground helper
process identities, logs, source acquisition records and execution outcomes are
kept under `.local-evidence/physical-reservoir-mapping/`. The existing user preview
on port 8786 is untouched. A feature branch does not deploy the game; PR CI and
its exact reviewed tree are separate evidence from these local checks.
