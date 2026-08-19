# AGENTS.md

## Cursor Cloud specific instructions

Vugg Simulator ships **two JavaScript runtimes** (see `ARCHITECTURE.md` for
the full picture). Standard build/typecheck/test/run commands already live in
`package.json`, `ARCHITECTURE.md`, `js/README.md`, and `agent-api/README.md` —
this section only records the non-obvious startup/run caveats.

### Browser game (the shipped product)

- `index.html` is **generated** from `js/**/*.ts` by `npm run build`. Edit
  files under `js/`, never `index.html` directly.
- The page fetches `data/*.json` (minerals, structural, thermo-*, scenarios,
  narratives) at runtime via **relative paths**. Serve the repo root over HTTP
  with the Node-only server: `node tools/serve-local.mjs 8765`, then open
  `http://localhost:8765/index.html`. (Python launchers are retired; do not
  restore them.)
- `file://` **does** work: the generated `index.html` embeds the canonical
  scenario, mineral, thermo, and narrative inputs and installs a `fetch` shim
  that serves them, but only when `location.protocol === 'file:'` — over HTTP
  the shim is inert and the loaders read from disk as usual
  (`tools/file-bundle-assets.mjs`, pinned by `tests-js/file-url-bundle.test.ts`).
  So double-clicking `index.html` is a complete offline build. HTTP serving is
  still the preferred development path: browser diagnostics and cache behaviour
  are clearer there.
- Non-fatal console noise: the JSON loaders (`js/00-mineral-spec.ts`,
  `js/20c`/`20d`) try several candidate paths (`./data/…`, `../data/…`,
  `/data/…`) and stop at the first hit, so a stray 404 for a fallback path in
  DevTools is expected and harmless. There is **no** `data/thermo.json`; the
  real files are `data/thermo-carbonates.json` and `data/thermo-sulfates.json`.
- The 3D/strip-view canvases are heavy; the "Quick Play" auto-run can briefly
  trip Chrome's "Page Unresponsive" dialog under load — click "Wait", it
  recovers. Prefer the plain "New Game"/"Simulation" flow for quick checks.

- Simulation tests default to seed 42. Scenario cavities use the authored
  `shape_seed` in `data/scenarios.json5`.

### Headless agent CLI (`agent-api/`)

- Second runtime for AI agents; deps are separate (`agent-api/package.json`).
  Its `canvas` dependency is a **native module** built from source against
  system libraries (cairo, pango, pixman, jpeg, gif, rsvg) that are provided by
  the VM image — a plain `npm install` in `agent-api/` compiles it.
- Run it by piping newline-delimited JSON commands to stdin, e.g.
  `echo '{"cmd":"help"}' | node vugg-agent.js` (see `agent-api/README.md`).

## Verification

- Use **Node 24** for anything that compares against committed baselines or
  receipts — it is the calibration-authority runtime (every baseline in the
  v169→v271 lineage was baked on it; current: `seed42_v271.json`, merged with
  the SIM-270/271 receipts in `cb9830c`). The committed `supergene_oxidation`
  seed-42 check is green under Node 24 and flips deterministic counts under
  Node 20/22/23 (measured at v237 — duftite 8→9, erythrite 5→4; see
  `BUG-supergene-calibration-v237.md`). Never rebake a baseline or receipt
  under another runtime, and never rebake from CI.
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
