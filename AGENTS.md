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
  narratives) at runtime via **relative paths**, so it must be served over
  HTTP from the repo root — opening `index.html` via `file://` will not work.
  Serve it with any static server, e.g. `python3 -m http.server 8000` from the
  repo root, then open `http://localhost:8000/index.html`.
- Non-fatal console noise: the JSON loaders (`js/00-mineral-spec.ts`,
  `js/20c`/`20d`) try several candidate paths (`./data/…`, `../data/…`,
  `/data/…`) and stop at the first hit, so a stray 404 for a fallback path in
  DevTools is expected and harmless. There is **no** `data/thermo.json`; the
  real files are `data/thermo-carbonates.json` and `data/thermo-sulfates.json`.
- The 3D/strip-view canvases are heavy; the "Quick Play" auto-run can briefly
  trip Chrome's "Page Unresponsive" dialog under load — click "Wait", it
  recovers. Prefer the plain "New Game"/"Simulation" flow for quick checks.

### Headless agent CLI (`agent-api/`)

- Second runtime for AI agents; deps are separate (`agent-api/package.json`).
  Its `canvas` dependency is a **native module** built from source against
  system libraries (cairo, pango, pixman, jpeg, gif, rsvg) that are provided by
  the VM image — a plain `npm install` in `agent-api/` compiles it.
- Run it by piping newline-delimited JSON commands to stdin, e.g.
  `echo '{"cmd":"help"}' | node vugg-agent.js` (see `agent-api/README.md`).

### Testing

- `npm test` runs the full vitest suite (~176 files, 2400+ assertions) and is
  **slow (~12 minutes)** because it evals the whole bundle in jsdom per file.
  Use `npx vitest run tests-js/<file>.test.ts` to iterate on a single file.
- `npm run typecheck` and `npm run build:check` are fast and are the quickest
  regression guards.
