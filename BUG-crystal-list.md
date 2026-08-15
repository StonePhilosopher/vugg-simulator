# Bug Report: Crystals Exist But Pie Chart Label Shows "empty vug"

**Status:** ⚠️ STILL OPEN 2026-08-15 (audit). Issue is real in current
`js/99h-renderer-idle-chart.ts` (and generated `index.html` mirror).
Path updated off the pre-flatten `projects/vugg-simulator/web/index.html`
cite. No geology/UI fix in this pass — path/status only.

**Date:** 2026-04-13
**Reported by:** Professor
**Severity:** UI — incorrect display

---

## 2026-08-15 audit (post-flatten paths)

| Check | Result |
|---|---|
| Current source | `js/99h-renderer-idle-chart.ts` `idleDrawPie()` (~245–252) |
| Generated bundle | `index.html` still has the same `s.pct > 0.001` filter + `'empty vug'` fallback |
| Suggested crystal-list label | **Not implemented** — label still derived from pie `slices`, not `idleSim.crystals` |
| Partial history | Commit `9c56f48` (2026-04-01) only lowered the threshold from `0.1` → `0.001` and added a microcrystal string for sub-0.1% slices; it did not switch the label to the crystal list |

`s.pct` is percent of vug volume (`(vol / vugVolume) * 100`). Fresh nucleations start at `c_length_mm = 0` / `_volume_mm3` unset until growth (`js/27-geometry-crystal.ts`, `js/85b-simulator-nucleate.ts`), so volume can be 0 while the step counter already shows crystals — exactly the reported mismatch.

---

## Description

When crystals have nucleated and are actively growing in the vug, the label below the pie chart still shows "empty vug" instead of listing the minerals present.

## Expected Behavior

If there are 3 quartz crystals in the vug, the label should show at minimum "quartz microcrystals" — something to indicate that crystals exist.

## Actual Behavior

The label shows "empty vug" even when the step counter shows active crystals (e.g., "3/3 crystals").

## Root Cause

The pie chart label is filtered from the `slices` array (`js/99h-renderer-idle-chart.ts`):

```javascript
.filter(s => s.label !== 'open' && s.pct > 0.001)
```

The threshold `s.pct > 0.001` (0.001% of vug volume) means any mineral whose volume is below that cutoff is filtered out entirely. Zero-volume / earliest-stage microcrystals are physically present in `idleSim.crystals` but disappear from the label.

The pie chart and the crystal list serve different purposes — the pie shows volume fill, the label should show what's *in* the vug regardless of size.

## Suggested Fix

The label should draw from the actual crystal list, not the pie chart slices:

```javascript
const activeCrystals = idleSim.crystals.filter(c => c.active);
if (activeCrystals.length === 0) {
  labelEl.textContent = 'empty vug';
} else {
  // Group by mineral, show count
  const byMineral = {};
  activeCrystals.forEach(c => {
    const name = c.mineral.charAt(0).toUpperCase() + c.mineral.slice(1);
    byMineral[name] = (byMineral[name] || 0) + 1;
  });
  const mineralList = Object.entries(byMineral)
    .map(([name, count]) => count > 1 ? `${count} ${name} microcrystals` : `${name} microcrystal`)
    .join(' · ');
  labelEl.textContent = mineralList;
}
```

This would show: `3 Quartz microcrystals` or `2 Quartz microcrystals · Calcite microcrystal`

## Location

File: `js/99h-renderer-idle-chart.ts` (was `projects/vugg-simulator/web/index.html` before 2026-04-29 flatten + modular extract)
Function: `idleDrawPie()` pie chart label update
Element: `#idle-pie-label`
