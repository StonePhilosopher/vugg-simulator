# BUG: Tooltip offset scales with zoom — double-positioning from viewport/ancestor mismatch

## Reproduction
1. Open any vug simulation
2. Hover over a crystal in the groove/record player
3. Tooltip appears far from cursor — offset proportional to zoom/scale level
4. At center-screen, tooltip corner touches opposite corner of viewport

## Root Cause
The tooltip (`#groove-tooltip`) uses `position: absolute` but positions itself using `e.clientX` / `e.clientY`, which are viewport-relative coordinates. `position: absolute` interprets `left`/`top` relative to the nearest positioned ancestor (the modal/container), not the viewport. This causes double-offset: the coordinates assume viewport positioning but the browser positions relative to the container.

CSS transforms (canvas scaling) amplify the mismatch, which is why the offset grows proportionally with zoom.

## Affected Locations
All tooltip positioning in index.html uses the same pattern. Search for:
```
tooltip.style.left = (e.clientX + 12) + 'px';
tooltip.style.top = (e.clientY - 10) + 'px';
```
Known instances (line numbers approximate):
- Groove/Record Player crystal zone hover (~line 19524)
- Chem-bar segment hover (~line 17758)
- UV-bar segment hover (~line 17806)
- Bar-graph zone hover (~line 17863)
- Detail canvas zone hover (~line 19425)

## Fix
**Option A (recommended):** Change `.groove-tooltip` CSS from `position: absolute` to `position: fixed`. `fixed` positions relative to the viewport, which matches `clientX`/`clientY`. This is a one-line CSS change and fixes all instances at once.

**Option B:** Keep `position: absolute` but subtract the container offset:
```javascript
const containerRect = tooltip.offsetParent.getBoundingClientRect();
tooltip.style.left = (e.clientX - containerRect.left + 12) + 'px';
tooltip.style.top = (e.clientY - containerRect.top - 10) + 'px';
```
This would need to be applied at every tooltip positioning call site.

Option A is cleaner — one CSS change, zero JS changes, fixes every tooltip consistently.

## Verification
After fix: hover over crystals at various zoom levels and screen positions. Tooltip should appear ~12px right and ~10px above the cursor regardless of scale or where the canvas is on screen.
