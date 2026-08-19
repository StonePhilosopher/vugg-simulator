# Local diagnostics and backups

Run:

```powershell
npm run diagnostics:local
```

The command prints a timestamp-free JSON receipt containing the Git commit and
dirty path names, SIM/model hashes, exact browser and runtime-execution hashes,
Node runtime identity, and whether the current science evidence receipt matches
those executable bytes. It makes **no network** request, includes no absolute
user path, and sends no telemetry. To retain it locally:

```powershell
node tools/local-diagnostics.mjs --out .local-evidence/diagnostic.json
```

The output-path guard keeps the receipt inside this repository. Review the JSON
before sharing it; sharing is always a human action outside the tool.

## Player data

The Saves screen can export one checksum-bound **local backup** containing
saves, recovery generations, quarantine bytes, Library specimens, lifetime
statistics, and Settings. Import authenticates the envelope and its inner save
generations, journals the intended replacement, verifies every write, and
restores the previous generation if storage fails. The file stays on the
device unless the player deliberately moves it.

An import is a replacement, not a merge. Export current data before importing
if both generations may matter. Format-v1/v2 recipes can be preserved and
exported but remain replay-incompatible under the current authority contract.

For a defect report, retain the local diagnostic receipt, exported backup (only
if the player consents), viewport/device details, exact steps, and screenshot.
Never request an entire browser profile.
