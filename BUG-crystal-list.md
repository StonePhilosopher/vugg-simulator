# Bug Report: Crystals Exist But Pie Chart Label Shows "empty vug"

**Date:** 2026-04-13
**Reported by:** Professor
**Severity:** UI — incorrect display

---

## Description

When crystals have nucleated and are actively growing in the vug, the label below the pie chart still shows "empty vug" instead of listing the minerals present.

## Expected Behavior

If there are 3 quartz crystals in the vug, the label should show at minimum "quartz microcrystals" — something to indicate that crystals exist.

## Actual Behavior

The label shows "empty vug" even when the step counter shows active crystals (e.g., "3/3 crystals").

## Root Cause

The pie chart label is filtered from the `slices` array (line ~7842):

```javascript
.filter(s => s.label !== 'open' && s.pct > 0.001)
```

The threshold `s.pct > 0.001` (0.1%) means any mineral whose volume is less than 0.1% of the vug gets filtered out entirely. Early-stage microcrystals are physically present but too small to register on the pie chart, so they disappear from the label too.

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

File: `projects/vugg-simulator/web/index.html`
Function: pie chart label update (around line 7840-7846)
Element: `#idle-pie-label`
