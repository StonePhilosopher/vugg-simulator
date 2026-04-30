# Vugg Simulator — Architecture Pointer

**This file is intentionally short.** Earlier versions tried to inventory minerals,
scenarios, modes, and code line-ranges; that content drifted faster than anyone
could maintain it (see commit history of this file). It now points at the
canonical source for each kind of fact instead.

If a section below is wrong, update the canonical source — not this file.

---

## What lives where

| Topic                          | Canonical source                                     |
|--------------------------------|------------------------------------------------------|
| Mineral spec (every field)     | `data/minerals.json`                                 |
| Locality fluid chemistry       | `data/locality_chemistry.json`                       |
| Scenarios (initial fluid + events) | `scenario_*` registry in `vugg.py` / `index.html` *(slated for `data/scenarios.json` per `proposals/TASK-BRIEF-DATA-AS-TRUTH.md`)* |
| Open work / backlog            | `proposals/BACKLOG.md`                               |
| Current SIM_VERSION            | top-of-file constant in `vugg.py`; history in `proposals/BACKLOG.md` |
| Roadmap and decisions          | `proposals/BACKLOG.md` and individual `proposals/*.md` briefs |
| Modes shown to the player      | the title screen — open `index.html` and look       |

---

## Three runtimes, on purpose

The simulation engine is implemented three times:

- **`vugg.py`** — dev/test harness. The builder iterates here first;
  `tests/` exercises this file (~1037 tests as of SIM_VERSION 8). Read the
  top-of-file docstring for the keep-or-drop decision and trigger conditions.
- **`index.html`** — the shipped product. GitHub Pages serves repo root.
  Read the top-of-file HTML comment for layout history and the role this
  file plays.
- **`agent-api/vugg-agent.js`** — headless CLI for AI agents. Intentionally
  simpler. Read the top-of-file comment for what "intentionally simpler"
  means and how its lag relative to the other two is policed.

Cross-runtime drift is detected by **`tools/sync-spec.js`** (run with
`node tools/sync-spec.js`). The "make these three converge" project is
tracked in `proposals/TASK-BRIEF-DATA-AS-TRUTH.md` (declarative tables in
`data/`) and the longer-term option-3 plan in the architecture review
(2026-04-29 session): cross-engine baseline tests that diff seed-42 output
between runtimes.

---

## Layout

```
vugg-simulator/
├── index.html                  # the game (GitHub Pages serves this)
├── vugg.py                     # dev/test harness for the engine
├── data/
│   ├── minerals.json           # canonical mineral spec
│   └── locality_chemistry.json # per-locality fluid + audit notes
├── photos/                     # mineral photos + thumbs (served at runtime)
├── agent-api/
│   └── vugg-agent.js           # headless agent CLI
├── tools/
│   ├── sync-spec.js            # cross-runtime drift detector
│   ├── new-mineral.py          # scaffolding for new mineral entries
│   ├── make-thumbnails.py      # photo pipeline
│   └── ...
├── tests/                      # pytest suite (exercises vugg.py)
├── proposals/                  # design briefs + backlog
└── research/                   # per-mineral research notes
```

### History note: web/ → root flatten (2026-04-29)

This used to be a `web/index.html` source plus a curated `docs/` mirror that
GitHub Pages served. The mirror was retired in favor of root-served Pages —
single layout, no per-commit `cp web/index.html docs/index.html` ritual.
**Pages source folder must be set to `/(root)`** for the live site to work
after this change.

---

## What goes in this file going forward

- Pointers (you are reading them).
- Cross-cutting decisions that don't fit anywhere else (e.g., the
  three-runtimes-on-purpose framing above).
- Layout maps when something non-obvious moves.

What does NOT go here:
- Mineral / scenario / mode counts. These belong to the canonical source.
- Code line-range maps. They drift in days.
- Roadmap. That's `BACKLOG.md`.
