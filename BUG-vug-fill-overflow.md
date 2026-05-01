# Bug Report: Vug Fill > 100% — Seal Not Reset + No Crystal Size Cap

**Date:** 2026-04-14
**Reported by:** Professor (screenshot showing fluorite at 321,248%)
**Severity:** Core simulation accuracy

---

## Description

After 34,630 steps in Groove mode, crystal fill percentage exceeds 321,000%. Two root causes.

## Root Cause 1: `_vug_sealed` Never Resets

**File:** `projects/vugg-simulator/web/index.html`
**Location:** `run_step()` around lines 4724-4783

The `_vug_sealed` flag fires once when `vugFill >= 1.0`. But when wall dissolution expands the vug (acid events increase `vug_diameter_mm`), the fill ratio drops back below 1.0. The seal flag is NEVER reset, so:

- Vug seals at 100%
- Wall dissolution creates new space
- Fill drops to (say) 85%
- `_vug_sealed` is still `true`
- Crystal growth resumes (the `currentFill >= 1.0` check on line 4749 uses the LIVE fill, so it allows growth)
- But the seal message never fires again
- Over thousands of steps, crystals grow far beyond the vug

**Fix:** Reset `_vug_sealed` when `get_vug_fill()` drops below 0.95. This allows re-sealing if it fills again, and the seal message fires again (which is correct — a vug CAN re-seal after wall dissolution creates new space).

Add after the growth loop (around line 4783):
```javascript
// Reset seal if wall dissolution opened new space
if (this._vug_sealed && this.get_vug_fill() < 0.95) {
  this._vug_sealed = false;
}
```

## Root Cause 2: No Maximum Crystal Size Cap

Max crystal size was discussed but never implemented. Over 34,630 steps (~173 million years at timeScale=5), even slow growth rates produce geologically absurd crystals.

**Fix:** Add `max_length_mm` property to each mineral engine. When `crystal.c_length_mm >= max_length_mm`, growth rate drops to zero (dissolution still allowed).

Suggested caps (based on real-world maximums in vugs):
```
quartz:       1000mm (1m — large vug quartz)
fluorite:     300mm (large vug fluorite)
calcite:      500mm (large vug calcite)
pyrite:       200mm
galena:       100mm
sphalerite:   100mm
chalcopyrite: 100mm
hematite:     50mm
malachite:    50mm
feldspar:     100mm
selenite:     500mm (desert rose clusters)
goethite:     50mm
uraninite:    20mm
wulfenite:    30mm
smithsonite:  50mm
```

Implementation: check in the growth zone functions or in `add_zone()`:
```javascript
// In add_zone, before applying:
if (zone.thickness_um > 0 && this.c_length_mm >= this.max_length_mm) {
  return; // Skip growth — at size cap. Dissolution still passes through.
}
```

## Standardization Check

**Good news:** Both Simulation and Groove modes share the same `VugSimulator.run_step()` method. There's only one code path for fill checking, sealing, and growth. The fix applies to both modes simultaneously.

**Previously not standardized:** The Groove mode had its own fill cap fix (April 3) that was applied directly in `run_step()`, so it's already shared. No double work needed.

## Priority

High — this makes long runs produce meaningless data. The fix is small (2 changes, ~10 lines total).
