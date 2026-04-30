# TASK-BRIEF: Narrative Readability Pass

**Priority:** UX cleanup. No new minerals, no engine changes, no chemistry changes. Tightens the narrator output and the collector's view, plus one ARCHITECTURE.md refresh and one event-narrator bug note.

**Why now:** Reviewing seed-42 MVT (60 steps, 27 crystals) surfaced ~750 words of duplicated mineral-template prose, two-line event repeats, and a long flat narrative that's getting hard to read in one scroll. The data is good; the presentation is the bottleneck.

**Source observations:** session 2026-04-29 review pass. All examples below are from the seed-42 MVT run.

---

## 1. Per-crystal mineral blurb dedupe

**Symptom:** in the seed-42 MVT run, Acanthite #9, #10, and #15 each got the same ~250-word "Ag₂S — monoclinic silver sulfide, the most important silver ore on Earth at 87% Ag by weight…" paragraph. Same problem will hit any scenario where one species nucleates 3+ times.

**Rule:** print the full species blurb on the **first** occurrence of that species in the run, AND once more in the closing summary (where it reads like a mineralogist's reference card). Subsequent same-species crystals get a one-liner.

**Implementation sketch:**
- In `narrate()`, track `species_blurb_printed: set[str]` across the per-crystal walk.
- `_narrate_<species>(crystal, first_of_species: bool)` — full text on first, terse on later.
- Terse form: `"Acanthite #10 grew to 0.6 mm, same paramorphic story."` (size + "same X story" hook back to the first blurb).
- The closing summary (the "GEOLOGICAL HISTORY" / "collector examining this specimen would find" block) re-prints the full species blurbs once, grouped by species, as a reference appendix.

**Effect:** ~750 → ~280 words of mineral-template prose in a 3-acanthite run. Casual reader sees one full description; reference-seeker still gets every blurb in the appendix.

**Out of scope:** the tarnish paragraph stays as-is per user — it's short enough and reinforces the freshness/age contrast.

---

## 2. Sub-visible crystal aggregation

**Symptom:** the collector's view currently lists `a 0.0mm sphalerite`, `a 0.0mm barite`, `a 0.0mm siderite` — nuclei that fired but never grew enough to be visible to a human collector. They clutter the list and break the conceit of "what a collector would find."

**Rule:** crystals below the visibility threshold (suggested cutoff: max dimension < 0.1 mm) are aggregated into a single fuzzy-output line at the end of the collector's view, naming the species but not the individual crystals.

**Form:**
> "…and microcrystals of sphalerite, barite, and siderite are also present in the vug — too small to display but recorded in the data."

**Implementation sketch:**
- In the collector-view formatter, partition crystals into `visible` (≥ 0.1 mm) and `submicro` (< 0.1 mm).
- Visible: render as today.
- Submicro: collect species names (deduped), join with commas, emit one fuzzy line.
- Underlying `Crystal` data is unchanged — they're still in the inventory, still in the JSON dump, still tap-for-history.

**Effect:** preserves data, simplifies the human-facing list, honors "what a collector would actually find."

---

## 3. Collapsible narrative sections (UI)

**Symptom:** the 7,500-character output for a 60-step MVT run is a single dense scroll. Per-crystal blurbs, event lines, and the closing summary all mix together. Even after item (1) cuts the dupes, a 100+ step run will still produce a wall of text.

**Rule:** keep all the data — but make narrative sections collapsible/expandable in the UI. Default-open vs default-collapsed is a tuning choice; suggested defaults below.

**Sections:**
| Section | Default | Notes |
|---|---|---|
| Top header (scenario, seed, step count, initial fluid) | open | always visible context |
| Step-by-step log (the `Step N │ T=… σ=…` lines + nucleation events) | **collapsed** | the densest part; collector wants summary, not telemetry |
| GEOLOGICAL HISTORY narrative | open | the "story" block |
| Per-crystal blurbs (one per species after dedupe) | open | reference appendix |
| Collector's view ("a 1.2mm rhombohedral calcite — glows orange under UV…") | open | the payoff |

**Implementation sketch:**
- Wrap each section in a `<details>` element with a `<summary>` header — native HTML, no JS needed for the toggle.
- Style summaries as section headers (bold, slightly larger, chevron indicator).
- Add an "Expand all / Collapse all" pair of small buttons at the top of the output container.
- For exports (the narrative-as-text save), keep the flat layout — `<details>` is for the live UI only.

**Effect:** opens to a digestible "story + species + collector" view by default; the step log stays one click away for anyone who wants the telemetry.

---

## 4. ARCHITECTURE.md refresh

**Symptom:** `ARCHITECTURE.md` is dated 2026-03-29 and reflects state of that day:
- Says "~4000 lines" — file is 20,904.
- Lists 10 minerals — current count 84.
- Lists 7 scenarios — current count 13.
- Lists 2 modes (Legends / Fortress) — title screen now shows Simulation, Creative, Record Player, The Groove (idle), Random Vugg, Library.
- The "Code Structure" line ranges (CSS 1-200, HTML 200-1150, etc.) are off by ~5×.

**Rule:** refresh in place. Two options, pick one:

**Option A — full rewrite.** Update every section to current state. Higher signal, higher maintenance burden (will go stale again).

**Option B — demote to a pointer (recommended).** Keep the file but trim it to a one-paragraph orientation that points at canonical sources:
- mineral count + table → generated from `data/minerals.json` (or just say "see data/minerals.json")
- scenario count → generated from the `scenario_*` registry (or "see web/index.html scenarios block")
- mode list → "see title screen"
- SIM_VERSION + roadmap → BACKLOG.md
- "Last updated" → drop entirely; replace with "current state lives in code, this file is orientation only"

Option B is more honest about how fast this project moves and removes the doc-rot trap.

**Effect:** new contributors don't get misled by the stale numbers; future drift is structurally prevented.

---

## 5. Event-narrator double-emit bug (note only — diagnose separately)

**Symptom:** in the seed-42 MVT run, the line

> "A fluid mixing event at step 20 transformed the vug's chemistry."

appears **twice consecutively** in the narrative. Looks like the event narrator either (a) iterates over event listeners and emits per-listener, (b) is called once during the step + once during the summary pass and dedupe is missing, or (c) logs the event on both `apply_events()` entry and on the per-crystal walk.

**Status:** noted, not diagnosed. Action when picked up:
- Reproduce: seed=42, scenario=mvt, steps=60. Look at the GEOLOGICAL HISTORY block.
- Likely site: the event-summary section of `narrate()` — search for `fluid mixing` or `transformed the vug's chemistry`.
- Fix: dedupe by `(event_type, step)` tuple before emitting.

Logged here so it doesn't get lost; not gating the rest of this brief.

---

## Sequencing

Items 1, 2, 3 can ship independently. Item 4 is paperwork. Item 5 is a separate small bug.

Suggested order:
1. **Item 1 (blurb dedupe)** — biggest readability win per line of code. Touches `narrate()` only.
2. **Item 2 (sub-visible aggregation)** — small, clean, in the collector-view formatter.
3. **Item 3 (collapsible UI)** — pure HTML/CSS in `web/index.html`; no engine changes.
4. **Item 4 (ARCHITECTURE.md)** — paperwork, do whenever.
5. **Item 5 (event dupe)** — diagnose + fix when convenient.

Per-commit, mirror `web/index.html` → `docs/index.html` (ARCHITECTURE.md requirement). Push to Syntaxswine origin.
