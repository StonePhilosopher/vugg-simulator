# Bug Report: Vug Fill > 100% — Seal Not Reset + No Crystal Size Cap

**Status:** ✅ MOSTLY RESOLVED 2026-08-15 (audit). The reported
321,248% runaway is closed in the **browser** runtime as well as
agent-api. Root Cause 2 (size cap) verified present. Root Cause 1's
suggested `_vug_sealed` reset never landed — residual is seal-message
re-fire only, not unbounded growth. Paths updated off the pre-flatten
`projects/vugg-simulator/web/index.html` cite (layout flattened
2026-04-29 → `index.html`; source lives in `js/`).

**Date:** 2026-04-14
**Reported by:** Professor (screenshot showing fluorite at 321,248%)
**Severity:** Core simulation accuracy (runaway symptom fixed; seal-message residual remains)

---

## 2026-08-15 audit (post-flatten paths)

| Cause | Status | Evidence |
|---|---|---|
| RC2 — no max crystal size cap | **RESOLVED** (browser + agent-api) | Browser: `js/00-mineral-spec.ts` `maxSizeCm()` + growth-loop check in `js/85-simulator.ts` (~374–387) reading `MINERAL_SPEC.max_size_cm` / `data/minerals.json`. Same helper + loop in `agent-api/vugg-agent.js` (~56–58, ~2086–2091). Generated `index.html` mirrors the browser check. `data/minerals.json` documents the field as the fix for the 321248% bug. |
| RC1 — `_vug_sealed` never resets | **Still true; residual only** | `js/85-simulator.ts` sets `_vug_sealed = true` in two places (~281, ~765) and **never** sets it back to `false` (repo-wide: zero assignments). Growth already gates on **live** `currentFill` / `vugFill`, not the sticky flag, so a dissolution-opened cavity can grow again — and re-seal will **not** log a second "VUG SEALED" line. High-fill arc (Proposal A dampener + Proposal D interlocking clamp + habit-stability zone-integrated volume) additionally keeps peak `vugFill` ≤ 1.0. Suggested reset below was never implemented. |

**Do not treat RC1 as geology-fixed** — only path/status audited here; no seal-reset patch in this pass.

---

## Description

After 34,630 steps in Groove mode, crystal fill percentage exceeds 321,000%. Two root causes.

## Root Cause 1: `_vug_sealed` Never Resets

**File (current):** `js/85-simulator.ts` (`run_step` / growth loop — formerly `projects/vugg-simulator/web/index.html`)

The `_vug_sealed` flag fires once when `vugFill >= 1.0`. But when wall dissolution expands the vug (acid events increase `vug_diameter_mm`), the fill ratio drops back below 1.0. The seal flag is NEVER reset, so:

- Vug seals at 100%
- Wall dissolution creates new space
- Fill drops to (say) 85%
- `_vug_sealed` is still `true`
- Crystal growth resumes (the `currentFill >= 1.0` check uses the LIVE fill, so it allows growth)
- But the seal message never fires again
- Over thousands of steps, crystals grow far beyond the vug *(runaway half closed by RC2 + high-fill clamps; message half still open)*

**Fix (still not landed):** Reset `_vug_sealed` when `get_vug_fill()` drops below 0.95. This allows re-sealing if it fills again, and the seal message fires again (which is correct — a vug CAN re-seal after wall dissolution creates new space).

```javascript
// Reset seal if wall dissolution opened new space
if (this._vug_sealed && this.get_vug_fill() < 0.95) {
  this._vug_sealed = false;
}
```

## Root Cause 2: No Maximum Crystal Size Cap — ✅ RESOLVED

Max crystal size was discussed but (as of the 2026-04-14 report) never implemented. Over 34,630 steps (~173 million years at timeScale=5), even slow growth rates produce geologically absurd crystals.

**Landed fix:** `max_size_cm` on each mineral in `data/minerals.json`, enforced via `maxSizeCm(mineral)` in the browser growth loop (`js/85-simulator.ts`) and agent-api. Growth halts when uncapped chemistry size (`total_growth_um` in browser; `c_length_mm` in agent-api) reaches the cap; dissolution still allowed. Caps are 2× world-record per mineral-accuracy audit, not the April sketch list below.

Original suggested sketch (historical — superseded by `data/minerals.json`):
```
quartz:       1000mm (1m — large vug quartz)
fluorite:     300mm (large vug fluorite)
calcite:      500mm (large vug calcite)
...
```

## Standardization Check

**Good news:** Simulation and Groove modes share the same `VugSimulator.run_step()` path in `js/85-simulator.ts`. One code path for fill checking, sealing, growth, and the size cap.

## Priority

~~High — this makes long runs produce meaningless data.~~ Runaway closed. Remaining: optional seal-flag reset so the seal log can re-fire after dissolution.
