# BUG: Tooltip offset scales with zoom — position:absolute ancestor chain with CSS transforms

## Reproduction
1. Open any simulation in Creative/Simulation mode (topo map view)
2. Hover over a crystal on the topo map
3. Tooltip appears far from cursor — offset proportional to zoom level
4. At center-screen, tooltip is near the opposite corner
5. Issue is proportional to zoom/scale — confirmed by user

## Root Cause
The topo tooltip (`#topo-tooltip`) uses `position: absolute` and tries to account for container offset:
```javascript
const wrapRect = canvas.parentElement.getBoundingClientRect();
const tipX = ev.clientX - wrapRect.left + 12;
const tipY = ev.clientY - wrapRect.top + 12;
```

However, the canvas lives inside a `TOPO_STAGE_SCALE = 2` oversized container with CSS transforms for zoom (`_topoZoom`) and pan (`_topoPanX`, `_topoPanY`). These transforms create a mismatch between `getBoundingClientRect()` (which returns the transformed/visible rect) and the coordinate space that `position: absolute` uses for `left`/`top`.

Each level of CSS transform (stage scale + user zoom + pan offset) multiplies the positioning error. This is why the offset is proportional to zoom level.

The groove tooltips (`#groove-tooltip`) have the same `position: absolute` + `clientX/clientY` pattern but may or may not exhibit the bug depending on whether their containers are also transformed.

## Affected Locations
1. **Topo tooltip** (Simulation/Creative mode) — `.topo-tooltip` / `#topo-tooltip`
   - Positioned at ~line 20806 and ~line 20741 in index.html
   - Container has CSS transforms from TOPO_STAGE_SCALE + _topoZoom + pan offsets

2. **Groove tooltips** (Record Player mode) — `.groove-tooltip` / `#groove-tooltip`
   - Positioned at ~lines 17758, 17806, 17863, 19425, 19524
   - May or may not be affected (depends on container transforms)
   - User has not confirmed whether this mode has the bug

## Key Clue
The groove/Record Player tooltip works perfectly. It uses the simpler positioning:
```javascript
tooltip.style.left = (e.clientX + 12) + 'px';
tooltip.style.top = (e.clientY - 10) + 'px';
```
The topo tooltip tries to be smarter by subtracting container offset via `getBoundingClientRect()` — and that's exactly what breaks under CSS transforms. The working code is simpler than the broken code.

## Fix
**Recommended: Change topo tooltip to `position: fixed` and use the same simple positioning as groove mode.**

`position: fixed` positions relative to the viewport, which matches `clientX`/`clientY` regardless of ancestor transforms.

For the topo tooltip, simplify the positioning to:
```javascript
tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 6, ev.clientX + 12)}px`;
tip.style.top = `${Math.min(window.innerHeight - 40, ev.clientY - 10)}px`;
```

For the groove tooltips, same simplification applies.

CSS changes needed:
```css
.topo-tooltip { position: fixed; }   /* was absolute */
.groove-tooltip { position: fixed; }  /* was absolute */
```

## Verification
- Hover over crystals in Simulation mode at default zoom → tooltip near cursor
- Zoom in (multiple levels) → tooltip stays near cursor
- Zoom out → tooltip stays near cursor
- Pan the vug around → tooltip stays near cursor
- Check Record Player mode → tooltip near cursor there too
- Edge cases: tooltip near screen edges shouldn't clip off-screen
