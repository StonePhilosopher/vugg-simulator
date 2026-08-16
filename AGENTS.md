# Vugg Simulator agent notes

## Browser product

- Edit `js/**/*.ts`, data, styles, and tools; do not hand-edit generated
  `index.html` or `dist/`. Run `npm run build` to regenerate them.
- Serve the repository root with the Node-only server:
  `node tools/serve-local.mjs 8765`.
- The generated `index.html` also embeds the canonical scenario, mineral,
  thermo, and narrative inputs so double-clicking it remains a complete
  offline `file://` build. HTTP serving remains the preferred development
  path because browser diagnostics and cache behavior are clearer there.
- Python launchers and Python test paths are retired and must not be restored.
- Simulation tests default to seed 42. Scenario cavities use the authored
  `shape_seed` in `data/scenarios.json5`.

## Verification

- `npm test` runs one test file and one worker per child with an RSS watchdog.
  Do not replace it with an unbounded all-files Vitest command.
- Run one exact file with `npm test -- --file tests-js/name.test.ts`.
- Resume a stopped run with `npm test -- --start-index N`; derive `N` with
  `collectTestFiles()` from `tools/test-workflow.mjs`, not shell locale sorting.
- Use `npm run typecheck` and `npm run build:check` for fast checks.
- Evidence binds exact runtime bytes. Runtime, runtime-data, or producer changes
  require a fresh `npm run science:rebake`; never rewrite receipts by hand.

## Workstation safety

- Run heavy simulation/evidence work serially and monitor the exact owned
  process tree. Never kill a process merely because it is Node.js.
- Preserve unrelated local changes and keep work products in this local repo
  unless the user explicitly requests publication.
