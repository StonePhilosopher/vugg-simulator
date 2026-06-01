// ============================================================
// js/99k-strip-view.ts — strip view UI tab (helicoid-as-recorder)
// ============================================================
// Phase B (post-Phase-1 carbonate): strip view bedrock — V1 minimal.
//
// THE HELICOID-AS-RECORDER REFRAME (Shy's framing, 2026-05-26)
//
// This module is the VIEWER for the helicoid recording. Companion to
// 85f-strip-dataset.ts (format), 85g-strip-recorder.ts (recorder),
// and 85h-strip-storage.ts (IndexedDB persistence). Together they
// constitute the strip view bedrock for v149.
//
// V1 SCOPE (what ships):
//
//   - Floating panel toggled by a toolbar button (#strip-view-toggle)
//   - Dataset list from IndexedDB (newest first; click to load)
//   - Filmstrip render: one row per captured time step, full-width SVG
//   - Per-chip normalized lines stacked within each row (all chips
//     overlaid; visual crowding accepted; line bundling DEFERRED to
//     future iteration but the data path supports it)
//   - Variance dot on the LEFT of each row (green/yellow/red, per
//     locked design — max per-chip-normalized-spread)
//   - Expand arrow (visual only in v1 — expansion to 24 sub-strips
//     is a future iteration; the dataset already supports it)
//   - Star button for favoriting (visual only — turns yellow; no
//     wired downstream behavior in v1 per locked design)
//   - Mineral nucleation markers (small colored dots at the
//     height-position of each nucleation event)
//   - Fixed-position "jump to top" / "jump to bottom" buttons
//   - Variable selector at top — mirrors helicoid chip grouping;
//     per-system + per-chip toggles
//   - Delete-dataset button (clear from IndexedDB)
//
// V2+ FUTURE (NOT in v1; documented for the next builder):
//
//   - Expand-to-24-sub-strips when arrow is clicked
//   - Cross-sub-strip cursor on hover
//   - Line bundling algorithm (Sankey-style merge for coincident lines)
//   - Star functional integration (filter / export favorites / compare)
//   - Adaptive height-resolution (zoom on a row to subdivide bins)
//   - Download dataset as gzipped file via stripSerialize
//   - Load dataset from file (upload + stripDeserialize)
//
// PREREQUISITES SATISFIED (or accepted-thin):
//
//   - Per-vertex spatial chemistry: NOT YET — see handoff §1.
//     v1 strip view will show angularly-uniform data for every chip
//     EXCEPT wall (which already varies per cell). When spatial
//     chemistry expansion ships, the same viewer comes alive with
//     real angular variation without any UI changes.
//
// ============================================================

// === HELIX-OVERLAY-FORK ADDITION (strip view bedrock, v149+) =========

// Hover-to-isolate (ported from helicoid legend, 2026-05-27). When the
// cursor sits on a chip in the selector, every OTHER chip's lines dim
// across all strips + sub-strips so the hovered chip stands out. The
// helicoid does this by setting _helixHoveredParam and having the live
// trail renderer read it each frame; the strip view is static SVG, so
// instead we swap a single dynamic stylesheet rule. CSS does the
// matching against data-chip-id — no per-line DOM walk, scales to
// thousand-step scenarios.
//
// _stripSetHoverIsolate(chipId): dim all .strip-chip-line except the
// one matching chipId. Pass null to clear (restore full opacity).
function _stripSetHoverIsolate(chipId: string | null): void {
  let el = document.getElementById('strip-view-hover-style') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'strip-view-hover-style';
    document.head.appendChild(el);
  }
  if (!chipId) {
    el.textContent = '';
    return;
  }
  // Escape the chip id for the attribute selector. Chip ids are simple
  // tokens (Ca, CO3, SI_calcite, etc.) so a CSS.escape is belt-and-
  // suspenders, but cheap and correct for any future id with odd chars.
  const safe = (typeof (window as any).CSS !== 'undefined' && (window as any).CSS.escape)
    ? (window as any).CSS.escape(chipId)
    : chipId.replace(/["\\]/g, '\\$&');
  el.textContent =
    `.strip-chip-line { stroke-opacity: 0.05 !important; }\n` +
    `.strip-chip-line[data-chip-id="${safe}"] { stroke-opacity: 0.95 !important; stroke-width: 2 !important; }`;
}

// CSS injection — strip view's styles live alongside helicoid styles.
// One-shot inject at first show.
function _ensureStripViewStyles(): void {
  if (document.getElementById('strip-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'strip-view-styles';
  style.textContent = `
    /* v153 (2026-05-26): promoted from floating overlay to full mode
       panel per boss feedback ("should be a separate window, like how
       record player mode works"). #strip-view-mode-panel is the HTML
       container; we render the header + body inside it. */
    .strip-view-mode-panel {
      width: calc(100vw - 32px);
      max-width: 1600px;
      margin: 16px auto;
      background: rgba(8, 10, 14, 0.96);
      border: 1px solid rgba(140, 160, 200, 0.35);
      border-radius: 6px;
      color: #cde;
      font-family: 'Consolas', monospace;
      font-size: 11px;
      box-shadow: 0 6px 32px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 600px;
      max-height: calc(100vh - 80px);
    }
    .strip-view-header {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(140, 160, 200, 0.25);
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .strip-view-title { font-weight: bold; letter-spacing: 0.04em; color: #ddf; }
    .strip-view-sub { color: #88a; font-size: 10px; }
    .strip-view-header-actions { margin-left: auto; display: flex; gap: 6px; }
    .strip-view-btn {
      background: rgba(80, 100, 140, 0.25);
      border: 1px solid rgba(120, 140, 180, 0.4);
      color: #cde;
      padding: 3px 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      border-radius: 3px;
    }
    .strip-view-btn:hover { background: rgba(120, 140, 180, 0.4); }
    .strip-view-body {
      flex: 1;
      overflow: auto;
      padding: 8px 12px;
      position: relative;
    }
    .strip-view-datasetlist { display: flex; flex-direction: column; gap: 4px; }
    .strip-view-datasetrow {
      padding: 6px 8px;
      background: rgba(40, 50, 70, 0.4);
      border: 1px solid rgba(80, 100, 140, 0.3);
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .strip-view-datasetrow:hover { background: rgba(60, 80, 120, 0.5); }
    .strip-view-datasetrow .ds-name { font-weight: bold; flex: 1; color: #def; }
    .strip-view-datasetrow .ds-meta { color: #99b; font-size: 10px; }
    .strip-view-datasetrow .ds-delete {
      color: #b66; cursor: pointer; padding: 0 6px;
    }
    .strip-view-datasetrow .ds-delete:hover { color: #f88; }
    .strip-view-empty {
      padding: 20px;
      text-align: center;
      color: #889;
      font-style: italic;
    }
    .strip-view-chipselector {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 6px 0; margin-bottom: 6px;
      border-bottom: 1px solid rgba(80, 100, 140, 0.25);
      position: sticky; top: 0; background: rgba(8, 10, 14, 0.96); z-index: 2;
    }
    .strip-view-chipchip {
      padding: 2px 6px;
      border: 1px solid rgba(120, 140, 180, 0.35);
      border-radius: 2px;
      cursor: pointer;
      font-size: 10px;
      user-select: none;
      background: rgba(40, 50, 70, 0.3);
    }
    .strip-view-chipchip.is-off { opacity: 0.32; }
    .strip-view-chipchip:hover { background: rgba(80, 100, 140, 0.45); }
    .strip-view-filmstrip { display: flex; flex-direction: column-reverse; gap: 1px; }
    .strip-view-row {
      display: grid;
      grid-template-columns: 30px 1fr;
      gap: 4px;
      align-items: stretch;
    }
    .strip-view-row.is-expanded > .strip-view-expanded-container {
      display: flex;
    }
    .strip-view-expanded-container {
      display: none;
      flex-direction: column;
      gap: 1px;
      grid-column: 1 / -1;
      padding-left: 14px;
      border-left: 2px solid rgba(120, 140, 180, 0.4);
      margin-left: 12px;
      margin-top: 2px;
      margin-bottom: 4px;
    }
    .strip-view-substrip {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 4px;
      align-items: stretch;
    }
    .strip-view-substrip-label {
      font-size: 10px;
      color: #99b;
      display: flex;
      align-items: center;
      gap: 2px;
      padding-left: 4px;
    }
    .strip-view-substrip-label .ss-num { font-weight: bold; color: #cde; }
    .strip-view-substrip-label .ss-deg { color: #889; }
    .strip-view-substrip-label .strip-view-favorite-btn { margin-left: auto; }
    .strip-view-substrip-canvas {
      /* v152: matches main strip at 100 px. Expanded time unit now
         takes ~2400 px scroll (24 × 100 + gaps), boss-accepted. */
      height: 100px;
      background: rgba(20, 25, 35, 0.5);
      border: 1px solid rgba(60, 80, 110, 0.25);
      position: relative;
      overflow: hidden;
    }
    .strip-view-substrip-canvas svg { display: block; width: 100%; height: 100%; }
    /* v154 (2026-05-26): cross-sub-strip cursor. Hovering at vug-height
       X on one sub-strip shows a vertical guide at the same X across
       all 24 sub-strips for that time unit. Per locked v2 design. */
    .strip-view-cursor {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: rgba(220, 230, 255, 0.55);
      pointer-events: none;
      display: none;
      box-shadow: 0 0 4px rgba(140, 180, 255, 0.4);
    }
    .strip-view-cursor.is-on { display: block; }
    .strip-view-row-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding-top: 2px;
    }
    .strip-view-variance-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4a4; /* green default */
      box-shadow: 0 0 3px currentColor;
    }
    .strip-view-variance-dot.yellow { background: #cc6; }
    .strip-view-variance-dot.red { background: #c44; }
    .strip-view-expand-btn {
      width: 16px; height: 12px;
      background: transparent;
      border: none;
      color: #88a;
      cursor: pointer;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .strip-view-expand-btn:hover { color: #cde; }
    /* Radial expansion (wall → center depth slices). Same footprint as
       the angular expand button; tinted teal to read as the "other axis". */
    .strip-view-radial-btn {
      width: 16px; height: 12px;
      background: transparent;
      border: none;
      color: #6aa;
      cursor: pointer;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .strip-view-radial-btn:hover { color: #9dd; }
    /* The radial container borrows the angular expanded-container layout;
       a faint teal left-edge marks it as the radial (depth) expansion. */
    .strip-view-radial-container { box-shadow: inset 2px 0 0 rgba(80,160,160,0.5); }
    .strip-view-favorite-btn {
      width: 14px; height: 14px;
      background: transparent;
      border: none;
      color: #555;
      cursor: pointer;
      padding: 0;
      font-size: 11px;
      line-height: 1;
    }
    .strip-view-favorite-btn:hover { color: #aaa; }
    .strip-view-favorite-btn.is-on { color: #cc6; }
    .strip-view-row-canvas {
      /* v152 (2026-05-26): 72 → 100 per second boss tune. Roomier
         vertical axis for chip variation; bundle vs. divergence reads
         even cleaner. */
      height: 100px;
      background: rgba(20, 25, 35, 0.6);
      border: 1px solid rgba(60, 80, 110, 0.3);
      position: relative;
      overflow: hidden;
    }
    .strip-view-row-canvas svg { display: block; width: 100%; height: 100%; }
    .strip-view-fixedbtns {
      position: absolute;
      bottom: 12px;
      right: 28px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 3;
    }
    .strip-view-fixedbtns button {
      background: rgba(40, 60, 90, 0.85);
      border: 1px solid rgba(120, 140, 180, 0.5);
      color: #cde;
      width: 26px; height: 26px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .strip-view-fixedbtns button:hover { background: rgba(80, 110, 160, 0.9); }
  `;
  document.head.appendChild(style);
}

// Active dataset cache (for hover / cursor logic that wants the bytes
// without re-loading from IDB).
let _stripActiveDataset: StripDataset | null = null;
// Per-chip on/off state, indexed by chip.id. Default: all on.
let _stripVisibleChips: { [chipId: string]: boolean } = {};
// Favorites annotation layer. Keyed by dataset key.
let _stripFavorites: {
  [datasetKey: string]: { time_slices: Set<number>, sub_strips: Set<string> }
} = {};

// Compute the variance level for one time step: max chip-normalized
// spread across angles, across all chips, across all height positions.
// Returns 'green' | 'yellow' | 'red' per locked thresholds.
function _stripComputeVarianceLevel(
  ds: StripDataset, step: number
): 'green' | 'yellow' | 'red' {
  const axes = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  if (axes.angular_indices <= 1) return 'green';
  let maxSpread = 0;
  for (let k = 0; k < chipCount; k++) {
    for (let h = 0; h < axes.height_positions; h++) {
      let lo = 256, hi = -1;
      for (let a = 0; a < axes.angular_indices; a++) {
        const idx = stripDataIndex(step, a, h, k, axes, chipCount);
        if (idx < 0) continue;
        const b = ds.chip_data[idx];
        if (b === 255) continue; // null
        if (b < lo) lo = b;
        if (b > hi) hi = b;
      }
      if (hi < 0 || lo > 254) continue;
      const spread = (hi - lo) / 254;
      if (spread > maxSpread) maxSpread = spread;
    }
  }
  if (maxSpread > 0.5) return 'red';
  if (maxSpread > 0.1) return 'yellow';
  return 'green';
}

// Sample a chip's normalized value (0..1) at one (step, angle, height,
// depth). If angle is null, returns the MEAN across all angles (at the
// given depth). depth defaults to 0 (the wall slab); for v1 datasets it
// must be 0 (stripDataIndex returns -1 otherwise). Returns null when the
// value is null/missing.
function _stripSampleChipNormalized(
  ds: StripDataset, step: number, angle: number | null, height: number, k: number,
  depth: number = 0
): number | null {
  const axes = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  if (angle !== null) {
    const idx = stripDataIndex(step, angle, height, k, axes, chipCount, depth);
    if (idx < 0) return null;
    const b = ds.chip_data[idx];
    if (b === 255) return null;
    return b / 254;
  }
  // mean across angles (at this depth)
  let sum = 0, count = 0;
  for (let a = 0; a < axes.angular_indices; a++) {
    const idx = stripDataIndex(step, a, height, k, axes, chipCount, depth);
    if (idx < 0) continue;
    const b = ds.chip_data[idx];
    if (b === 255) continue;
    sum += b; count++;
  }
  if (count === 0) return null;
  return (sum / count) / 254;
}

// Line bundling helper. For each height position, sort the (chip, y)
// pairs and group ones within `tolerance` of each other on the y axis.
// Returns one polyline per chip but the same y value when chips bundle —
// the rendering naturally draws them on top of each other. To make
// bundled lines visually thicker, we adjust stroke-opacity proportional
// to bundle size — when N chips bundle, each contributes 1/N to the
// total but together they paint a more opaque line.
//
// Locked design (boss 2026-05-26): "they should overlap gracefully,
// perhaps by just linking together to form a shared wider line where
// neither line overlaps the other." The implementation here uses
// y-snapping (chips within tolerance share the exact same y) so the
// rendered polylines coincide pixel-for-pixel rather than fighting at
// adjacent pixels — letting the eye read "bundle" vs. "diverge" cleanly.
// _STRIP_BUNDLE_TOLERANCE is in normalized chip units (0..1). 0.02
// means chips within 2% of each chip's range bundle together.
const _STRIP_BUNDLE_TOLERANCE = 0.02;

// Render a single strip (one row OR one angular/radial sub-strip). When
// `angle` is null, renders the mean across angles (collapsed view). When
// `angle` is a specific index, renders that one angular slice. `depth`
// selects the radial slab (0 = wall, depth_count-1 = center); default 0,
// and for v1 datasets it stays 0.
function _stripRenderStripSVG(
  ds: StripDataset, step: number, angle: number | null, width: number, height: number,
  depth: number = 0
): string {
  const axes = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  const segs: string[] = [];
  segs.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`);

  // First pass: gather all (chip, height) -> normalized values into a
  // matrix so we can bundle per-height.
  // valuesByHeight[h] = array of { k, norm } for visible chips.
  const valuesByHeight: { k: number, norm: number }[][] = [];
  for (let h = 0; h < axes.height_positions; h++) valuesByHeight.push([]);
  for (let k = 0; k < chipCount; k++) {
    const meta = ds.manifest.chips[k];
    if (_stripVisibleChips[meta.id] === false) continue;
    for (let h = 0; h < axes.height_positions; h++) {
      const norm = _stripSampleChipNormalized(ds, step, angle, h, k, depth);
      if (norm === null) continue;
      valuesByHeight[h].push({ k, norm });
    }
  }

  // Second pass: y-snap. For each height, sort by norm, then snap chips
  // that fall within tolerance to the bundle's centroid. Track bundle
  // size per (h, k) so the polyline can render thicker where bundled.
  // snapped[k][h] = { y, bundleSize } | undefined
  const snapped: ({ y: number, bundleSize: number } | undefined)[][] = [];
  for (let k = 0; k < chipCount; k++) snapped.push(new Array(axes.height_positions));
  for (let h = 0; h < axes.height_positions; h++) {
    const arr = valuesByHeight[h];
    arr.sort((a, b) => a.norm - b.norm);
    let i = 0;
    while (i < arr.length) {
      let j = i + 1;
      let sum = arr[i].norm;
      while (j < arr.length && (arr[j].norm - arr[i].norm) <= _STRIP_BUNDLE_TOLERANCE) {
        sum += arr[j].norm;
        j++;
      }
      const bundleSize = j - i;
      const centroid = sum / bundleSize;
      for (let q = i; q < j; q++) {
        const y = height - centroid * height;
        snapped[arr[q].k][h] = { y, bundleSize };
      }
      i = j;
    }
  }

  // Third pass: emit one polyline per chip, with x = height position.
  // Opacity scales with bundle size — solo lines render at 0.6 opacity;
  // a bundle of N draws N stacked lines for cumulative opacity ~0.9 at
  // N=4 (1 - 0.4^4).
  for (let k = 0; k < chipCount; k++) {
    const meta = ds.manifest.chips[k];
    if (_stripVisibleChips[meta.id] === false) continue;
    const colorHex = '#' + (meta.color | 0).toString(16).padStart(6, '0');
    const pts: string[] = [];
    for (let h = 0; h < axes.height_positions; h++) {
      const s = snapped[k][h];
      if (!s) continue;
      const x = (h / Math.max(1, axes.height_positions - 1)) * width;
      pts.push(`${x.toFixed(1)},${s.y.toFixed(2)}`);
    }
    if (pts.length > 1) {
      // v152 (2026-05-26): stroke-width 1.5 → 1.25 per boss tune.
      // Slightly thinner reads cleaner at the now-100 px height; bundle
      // stacking still cumulative.
      //
      // data-chip-id (2026-05-27): tags the line for the hover-to-isolate
      // behavior ported from the helicoid legend. On chip hover, a
      // dynamic stylesheet dims every .strip-chip-line except the
      // hovered chip's data-chip-id. CSS does the matching — no
      // per-element DOM walk.
      segs.push(`<polyline class="strip-chip-line" data-chip-id="${meta.id}" points="${pts.join(' ')}" fill="none" stroke="${colorHex}" stroke-width="1.25" stroke-opacity="0.65"/>`);
    }
  }

  // Mineral nucleation markers. When `angle` is null (collapsed view),
  // show every event whose step matches (OR across angles). When `angle`
  // is specified, show only events at that exact angle.
  if (ds.nucleation_events && ds.nucleation_events.length) {
    const cellsPerAngle = 120 / axes.angular_indices; // 5 native cells per 15° bin
    for (const ev of ds.nucleation_events) {
      if (ev.step !== step) continue;
      if (angle !== null) {
        // Filter to events whose native cell falls in this angular bin
        const eventAngle = Math.floor(ev.cell / cellsPerAngle);
        if (eventAngle !== angle) continue;
      }
      const x = (ev.ring / Math.max(1, axes.height_positions - 1)) * width;
      // v151: bigger marker radius (2.2 → 3.5) for the taller strip;
      // nudge upward from bottom edge so it sits in the strip body
      // rather than against the border.
      segs.push(`<circle cx="${x.toFixed(1)}" cy="${(height - 5).toFixed(1)}" r="3.5" fill="#fc6" stroke="#fff" stroke-width="0.6"><title>${ev.mineral} @ step ${ev.step}, ring ${ev.ring}, cell ${ev.cell}</title></circle>`);
    }
  }

  segs.push('</svg>');
  return segs.join('');
}

// Convenience wrapper for the collapsed (mean) view.
function _stripRenderStepSVG(
  ds: StripDataset, step: number, width: number, height: number
): string {
  return _stripRenderStripSVG(ds, step, null, width, height);
}

// Compute the angle label "n / deg°" per locked design (n = 1..24,
// deg = 0..345 in 15° steps).
function _stripAngleLabel(angle: number, angular_indices: number): string {
  const n = angle + 1;
  const deg = Math.round((angle / angular_indices) * 360);
  return `${n} / ${deg}°`;
}

// Build the expanded sub-strip container for a given step. Called on
// expand-arrow click.
function _stripBuildExpandedContainer(ds: StripDataset, step: number, width: number): HTMLElement {
  const axes = ds.manifest.axes;
  const datasetKey = stripStorageKey(ds.manifest);
  const favSet = (_stripFavorites[datasetKey] = _stripFavorites[datasetKey] || { time_slices: new Set(), sub_strips: new Set() });
  const container = document.createElement('div');
  container.className = 'strip-view-expanded-container';
  for (let a = 0; a < axes.angular_indices; a++) {
    const sub = document.createElement('div');
    sub.className = 'strip-view-substrip';
    const subKey = `${step}#${a}`;
    const isFav = favSet.sub_strips.has(subKey);
    sub.innerHTML = `
      <div class="strip-view-substrip-label">
        <span class="ss-num">${a + 1}</span>
        <span class="ss-deg">/ ${Math.round((a / axes.angular_indices) * 360)}°</span>
        <button class="strip-view-favorite-btn ${isFav ? 'is-on' : ''}" data-step="${step}" data-angle="${a}" title="Favorite ${_stripAngleLabel(a, axes.angular_indices)}">★</button>
      </div>
      <div class="strip-view-substrip-canvas">
        ${_stripRenderStripSVG(ds, step, a, 1500, 100)}
        <div class="strip-view-cursor"></div>
      </div>
    `;
    container.appendChild(sub);
  }
  // v154 (2026-05-26): cross-sub-strip cursor — shared with the radial
  // container via _stripWireCrossCursor. Hovering at vug-height X on one
  // sub-strip shows a vertical guide at the same X across all sub-strips
  // for that time unit. Per locked v2 design.
  _stripWireCrossCursor(container);
  return container;
}

// Depth-slice label for radial sub-strips. The 4-slice scheme's
// geological semantics (PROPOSAL-CAVITY-INTERIOR-VOXELS [FIRM] A):
//   d=0 boundary layer (wall) · d=1 near-wall buffer · d=2 interior bulk
//   · d=3 center baseline. Other slice counts fall back to wall/center
//   endpoints + a bare index in between.
function _stripDepthLabel(d: number, depthCount: number): string {
  if (depthCount === 4) {
    return ['wall', 'near-wall', 'interior', 'center'][d] || `d${d}`;
  }
  if (d === 0) return 'wall';
  if (d === depthCount - 1) return 'center';
  return `d${d}`;
}

// Shared cross-sub-strip cursor wiring (used by both the angular and the
// radial expanded containers). On mousemove inside any sub-strip canvas,
// draw a vertical guide at the same relative X across every sub-strip —
// so the user can compare chip values at one vug-height across all
// rotation angles (angular) OR all radial depths (radial) at a glance.
function _stripWireCrossCursor(container: HTMLElement): void {
  container.addEventListener('mousemove', (ev) => {
    const target = ev.target as HTMLElement;
    const canvas = target.closest('.strip-view-substrip-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = (ev.clientX - rect.left) / Math.max(1, rect.width);
    if (relX < 0 || relX > 1) return;
    const cursors = container.querySelectorAll('.strip-view-cursor');
    cursors.forEach((c) => {
      const cur = c as HTMLElement;
      const parentRect = (cur.parentElement as HTMLElement).getBoundingClientRect();
      cur.style.left = (relX * parentRect.width).toFixed(1) + 'px';
      cur.classList.add('is-on');
    });
  });
  container.addEventListener('mouseleave', () => {
    const cursors = container.querySelectorAll('.strip-view-cursor');
    cursors.forEach((c) => c.classList.remove('is-on'));
  });
}

// Build the expanded RADIAL sub-strip container for a given step
// (PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 3). Parallels
// _stripBuildExpandedContainer but expands along the radial DEPTH axis
// instead of the angular axis: one sub-strip per stored cavity slice,
// wall (d=0) at the top → center at the bottom, each rendered as the mean
// across angles at that depth. Reading top→bottom shows the wall→center
// chemistry gradient — the depletion halo at the wall vs the replenishing
// interior reservoir that v160's per-voxel diffusion produces. Only built
// for format_version-2 datasets (depth_positions > 1).
function _stripBuildRadialContainer(ds: StripDataset, step: number, _width: number): HTMLElement {
  const axes = ds.manifest.axes;
  const depthCount = (axes.depth_positions && axes.depth_positions > 0) ? axes.depth_positions : 1;
  const container = document.createElement('div');
  container.className = 'strip-view-expanded-container strip-view-radial-container';
  for (let d = 0; d < depthCount; d++) {
    const sub = document.createElement('div');
    sub.className = 'strip-view-substrip';
    sub.innerHTML = `
      <div class="strip-view-substrip-label">
        <span class="ss-num">d${d}</span>
        <span class="ss-deg">/ ${_stripDepthLabel(d, depthCount)}</span>
      </div>
      <div class="strip-view-substrip-canvas">
        ${_stripRenderStripSVG(ds, step, null, 1500, 100, d)}
        <div class="strip-view-cursor"></div>
      </div>
    `;
    container.appendChild(sub);
  }
  _stripWireCrossCursor(container);
  return container;
}

// Build / refresh the dataset list view.
async function _stripRenderDatasetList(bodyEl: HTMLElement): Promise<void> {
  bodyEl.innerHTML = '';
  // v154: disable download button while on the list (no active dataset).
  const dl = document.getElementById('strip-view-download') as HTMLButtonElement | null;
  if (dl) dl.disabled = true;
  if (typeof stripStorageAvailable !== 'function' || !stripStorageAvailable()) {
    const empty = document.createElement('div');
    empty.className = 'strip-view-empty';
    empty.textContent = 'IndexedDB unavailable in this environment.';
    bodyEl.appendChild(empty);
    return;
  }
  let entries: StripListEntry[];
  try {
    entries = await stripStorageList();
  } catch (err) {
    const fail = document.createElement('div');
    fail.className = 'strip-view-empty';
    fail.textContent = 'Failed to list datasets: ' + (err as Error).message;
    bodyEl.appendChild(fail);
    return;
  }
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'strip-view-empty';
    empty.innerHTML = 'No recordings yet. Run a Simulation, Random, or Fortress scenario to capture one.<br><br>The helicoid is now a recording instrument; every run writes a dataset for review here. Browser storage holds the 5 most recent — use ⬇ Download to keep anything you care about as a <code>.stripview</code> file on disk, and ⬆ Upload to bring it back later.';
    bodyEl.appendChild(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'strip-view-datasetlist';
  for (const e of entries) {
    const row = document.createElement('div');
    row.className = 'strip-view-datasetrow';
    const date = new Date(e.manifest.recorded_at);
    row.innerHTML = `
      <div class="ds-name">${e.manifest.scenario_id}</div>
      <div class="ds-meta">seed ${e.manifest.seed} · ${e.manifest.duration_steps} steps · ${e.manifest.chips.length} chips · v${e.manifest.sim_version}</div>
      <div class="ds-meta">${date.toLocaleString()}</div>
      <span class="ds-delete" title="Delete">✕</span>
    `;
    row.addEventListener('click', async (ev) => {
      if ((ev.target as HTMLElement).classList.contains('ds-delete')) {
        ev.stopPropagation();
        try { await stripStorageDelete(e.key); } catch (_e) {}
        await _stripRenderDatasetList(bodyEl);
        return;
      }
      try {
        const ds = await stripStorageLoad(e.key);
        if (ds) _stripRenderDataset(bodyEl, ds);
      } catch (err) {
        bodyEl.innerHTML = '<div class="strip-view-empty">Load failed: ' + (err as Error).message + '</div>';
      }
    });
    list.appendChild(row);
  }
  bodyEl.appendChild(list);
}

// Render a loaded dataset as the filmstrip.
function _stripRenderDataset(bodyEl: HTMLElement, ds: StripDataset): void {
  _stripActiveDataset = ds;
  // v154: enable download button now that we have an active dataset.
  const dl = document.getElementById('strip-view-download') as HTMLButtonElement | null;
  if (dl) dl.disabled = false;
  // sonify MVP (2026-05-31): enable the ♪ Play button too.
  const sn = document.getElementById('strip-view-sonify') as HTMLButtonElement | null;
  if (sn) sn.disabled = false;
  // Initialize chip visibility — all on first time.
  for (const c of ds.manifest.chips) {
    if (!(c.id in _stripVisibleChips)) _stripVisibleChips[c.id] = true;
  }

  bodyEl.innerHTML = '';

  // Back button
  const back = document.createElement('div');
  back.style.cssText = 'display:flex; gap:8px; padding-bottom:6px;';
  back.innerHTML = `
    <button class="strip-view-btn" id="strip-view-back">← Datasets</button>
    <span style="color:#cde; font-weight:bold;">${ds.manifest.scenario_id}</span>
    <span style="color:#99b;">seed ${ds.manifest.seed} · ${ds.manifest.duration_steps} steps · ${ds.manifest.axes.angular_indices} angular sub-strips × ${ds.manifest.axes.height_positions} heights</span>
  `;
  bodyEl.appendChild(back);
  const backBtn = back.querySelector('#strip-view-back') as HTMLButtonElement;
  backBtn.addEventListener('click', () => {
    _stripActiveDataset = null;
    const dl = document.getElementById('strip-view-download') as HTMLButtonElement | null;
    if (dl) dl.disabled = true;
    // sonify MVP: stop + disable sonify when leaving a dataset.
    if (typeof stripSonifyStop === 'function') stripSonifyStop();
    const sn = document.getElementById('strip-view-sonify') as HTMLButtonElement | null;
    if (sn) { sn.disabled = true; sn.textContent = '♪ Play'; }
    _stripRenderDatasetList(bodyEl);
  });

  // Chip selector — grouped by system. Per-chip toggles plus
  // bulk-action buttons mirroring the helicoid legend's all/none
  // pattern (boss-requested 2026-05-27 — "the same grouping buttons
  // that you see in the game").
  const selector = document.createElement('div');
  selector.className = 'strip-view-chipselector';

  // Helper to repaint chip state without rebuilding the whole row.
  // Walks every .strip-view-chipchip in the selector and syncs its
  // is-off class to _stripVisibleChips. Cheap (~60 nodes); avoids the
  // O(steps) cost of rebuilding the filmstrip until the user actually
  // wants to see the change.
  const syncChipChrome = () => {
    const chips = selector.querySelectorAll('.strip-view-chipchip[data-chip-id]');
    chips.forEach((el) => {
      const id = el.getAttribute('data-chip-id') || '';
      el.classList.toggle('is-off', _stripVisibleChips[id] === false);
    });
  };

  // Top-level bulk-action buttons (left of all chip groups).
  const bulkBar = document.createElement('div');
  bulkBar.style.cssText = 'display:flex; gap:3px; align-items:center; padding-right:8px; border-right:1px solid rgba(80,100,140,0.3); margin-right:4px;';
  const mkBulkBtn = (label: string, title: string, action: () => void) => {
    const b = document.createElement('button');
    b.className = 'strip-view-btn';
    b.style.cssText = 'padding:1px 6px; font-size:10px;';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', () => {
      action();
      syncChipChrome();
      _stripRefreshFilmstrip(bodyEl, ds);
    });
    return b;
  };
  bulkBar.appendChild(mkBulkBtn('all', 'Show all chips', () => {
    for (const chip of ds.manifest.chips) _stripVisibleChips[chip.id] = true;
  }));
  bulkBar.appendChild(mkBulkBtn('none', 'Hide all chips', () => {
    for (const chip of ds.manifest.chips) _stripVisibleChips[chip.id] = false;
  }));
  selector.appendChild(bulkBar);

  const systems = ['wall', 'special', 'carbonate', 'ion'];
  for (const sys of systems) {
    const inSys = ds.manifest.chips.filter(c => c.system === sys);
    if (!inSys.length) continue;
    const groupLabel = document.createElement('div');
    groupLabel.style.cssText = 'display:flex; gap:2px; align-items:center; padding-right:6px;';
    // System name is now a clickable toggle: click cycles the whole
    // system on/off (helicoid-legend style). Hover hint shows the
    // mass-action; a small dim/bright state mirrors the section
    // enable state.
    const sysAnyOn = inSys.some(c => _stripVisibleChips[c.id] !== false);
    const sysAllOn = inSys.every(c => _stripVisibleChips[c.id] !== false);
    const sysLabel = document.createElement('span');
    sysLabel.style.cssText = 'color:#99b; font-size:10px; padding-right:3px; cursor:pointer; user-select:none;'
      + (sysAnyOn ? '' : 'opacity:0.4;');
    sysLabel.textContent = sys + ':';
    sysLabel.title = `Toggle all ${sys} chips (${sysAllOn ? 'currently all on — click to hide' : sysAnyOn ? 'mixed — click to show all' : 'currently all off — click to show all'})`;
    sysLabel.setAttribute('data-strip-sys', sys);
    sysLabel.addEventListener('click', () => {
      // Cycle logic: if any are off, turn ALL on (most-permissive).
      // If all are on, turn ALL off. Predictable single-click toggle.
      const anyOff = inSys.some(c => _stripVisibleChips[c.id] === false);
      const newState = anyOff ? true : false;
      for (const chip of inSys) _stripVisibleChips[chip.id] = newState;
      sysLabel.style.opacity = newState ? '1' : '0.4';
      syncChipChrome();
      _stripRefreshFilmstrip(bodyEl, ds);
    });
    groupLabel.appendChild(sysLabel);
    selector.appendChild(groupLabel);
    for (const chip of inSys) {
      const chipEl = document.createElement('span');
      chipEl.className = 'strip-view-chipchip' + (_stripVisibleChips[chip.id] === false ? ' is-off' : '');
      chipEl.setAttribute('data-chip-id', chip.id);
      const colorHex = '#' + (chip.color | 0).toString(16).padStart(6, '0');
      chipEl.style.borderLeftColor = colorHex;
      chipEl.style.borderLeftWidth = '3px';
      chipEl.title = chip.id + (chip.units ? ' (' + chip.units + ')' : '') + ' range [' + chip.range[0] + ', ' + chip.range[1] + ']';
      chipEl.textContent = chip.label;
      chipEl.addEventListener('click', () => {
        _stripVisibleChips[chip.id] = !(_stripVisibleChips[chip.id] !== false);
        chipEl.classList.toggle('is-off', _stripVisibleChips[chip.id] === false);
        // Sync the system label opacity to reflect the new per-system mix.
        const sysAnyOnNow = inSys.some(c => _stripVisibleChips[c.id] !== false);
        sysLabel.style.opacity = sysAnyOnNow ? '1' : '0.4';
        _stripRefreshFilmstrip(bodyEl, ds);
      });
      // Hover-to-isolate (ported from helicoid legend, boss-requested
      // 2026-05-27). On hover, dim every other chip's lines so the
      // hovered chip stands out across all strips + sub-strips. Uses
      // pointerenter/leave (fire once per chip; don't bubble like
      // pointerover/out) + a dynamic stylesheet so the dimming is a
      // single CSS rule swap rather than a per-line DOM walk.
      chipEl.addEventListener('pointerenter', () => _stripSetHoverIsolate(chip.id));
      chipEl.addEventListener('pointerleave', () => _stripSetHoverIsolate(null));
      selector.appendChild(chipEl);
    }
  }
  bodyEl.appendChild(selector);

  // Filmstrip container
  const film = document.createElement('div');
  film.className = 'strip-view-filmstrip';
  film.id = 'strip-view-filmstrip';
  bodyEl.appendChild(film);

  // Pre-build all rows (older-at-bottom via column-reverse on .filmstrip)
  // v153 (2026-05-26): widened from 860 to 1500 to fill mode-panel
  // real estate (was 920 popup width, now full-page). SVG scales to
  // container so this is mostly a viewBox tweak — but bumping the
  // logical width gives finer point spacing for taller scenarios.
  const stripW = 1500;
  // v152 (2026-05-26): 72 → 100 per second boss tune. Must match
  // .strip-view-row-canvas CSS height to avoid SVG aspect-ratio stretch.
  const stripH = 100;
  for (let step = 0; step < ds.manifest.axes.steps; step++) {
    const row = document.createElement('div');
    row.className = 'strip-view-row';
    row.setAttribute('data-row-step', String(step));
    const variance = _stripComputeVarianceLevel(ds, step);
    const datasetKey = stripStorageKey(ds.manifest);
    const favSet = (_stripFavorites[datasetKey] = _stripFavorites[datasetKey] || { time_slices: new Set(), sub_strips: new Set() });
    const isFav = favSet.time_slices.has(step);
    row.innerHTML = `
      <div class="strip-view-row-controls">
        <span class="strip-view-variance-dot ${variance === 'green' ? '' : variance}" title="step ${step} — variance: ${variance}"></span>
        <button class="strip-view-expand-btn" data-step="${step}" title="Expand to 24 angular sub-strips">▸</button>
        ${((ds.manifest.axes.depth_positions || 1) > 1)
          ? `<button class="strip-view-radial-btn" data-step="${step}" title="Expand to radial sub-strips (wall → center)">⊙</button>`
          : ''}
        <button class="strip-view-favorite-btn ${isFav ? 'is-on' : ''}" data-step="${step}" title="Favorite step ${step}">★</button>
      </div>
      <div class="strip-view-row-canvas" data-step="${step}">${_stripRenderStepSVG(ds, step, stripW, stripH)}</div>
    `;
    film.appendChild(row);
  }

  // Wire favorite + expand buttons
  film.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (target.classList.contains('strip-view-favorite-btn')) {
      const step = Number(target.getAttribute('data-step'));
      if (!Number.isFinite(step)) return;
      const datasetKey = stripStorageKey(ds.manifest);
      const favSet = _stripFavorites[datasetKey];
      const angleAttr = target.getAttribute('data-angle');
      if (angleAttr !== null) {
        // Sub-strip favorite — keyed by "step#angle"
        const angle = Number(angleAttr);
        const subKey = `${step}#${angle}`;
        if (favSet.sub_strips.has(subKey)) {
          favSet.sub_strips.delete(subKey);
          target.classList.remove('is-on');
        } else {
          favSet.sub_strips.add(subKey);
          target.classList.add('is-on');
        }
      } else {
        // Whole-step favorite
        if (favSet.time_slices.has(step)) {
          favSet.time_slices.delete(step);
          target.classList.remove('is-on');
        } else {
          favSet.time_slices.add(step);
          target.classList.add('is-on');
        }
      }
      ev.stopPropagation();
      return;
    }
    if (target.classList.contains('strip-view-expand-btn')) {
      const step = Number(target.getAttribute('data-step'));
      if (!Number.isFinite(step)) return;
      const row = target.closest('.strip-view-row') as HTMLElement;
      if (!row) return;
      const existing = row.querySelector('.strip-view-expanded-container');
      if (existing) {
        // Collapse
        existing.remove();
        row.classList.remove('is-expanded');
        target.textContent = '▸';
        target.setAttribute('title', 'Expand to 24 angular sub-strips');
      } else {
        // Expand. Collapse any open radial container first so the two
        // expansion modes don't stack.
        const radial = row.querySelector('.strip-view-radial-container');
        if (radial) {
          radial.remove();
          const rbtn = row.querySelector('.strip-view-radial-btn') as HTMLElement | null;
          if (rbtn) { rbtn.textContent = '⊙'; rbtn.setAttribute('title', 'Expand to radial sub-strips (wall → center)'); }
        }
        const container = _stripBuildExpandedContainer(ds, step, stripW);
        row.appendChild(container);
        row.classList.add('is-expanded');
        target.textContent = '▾';
        target.setAttribute('title', 'Collapse');
      }
      ev.stopPropagation();
      return;
    }
    if (target.classList.contains('strip-view-radial-btn')) {
      // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 3 — radial expansion
      // (wall → center depth slices). Mirrors the angular expand handler.
      const step = Number(target.getAttribute('data-step'));
      if (!Number.isFinite(step)) return;
      const row = target.closest('.strip-view-row') as HTMLElement;
      if (!row) return;
      const existing = row.querySelector('.strip-view-radial-container');
      if (existing) {
        existing.remove();
        // Only drop is-expanded if no angular container remains.
        if (!row.querySelector('.strip-view-expanded-container')) row.classList.remove('is-expanded');
        target.textContent = '⊙';
        target.setAttribute('title', 'Expand to radial sub-strips (wall → center)');
      } else {
        // Collapse any open angular container first (don't stack modes).
        const angular = row.querySelector('.strip-view-expanded-container:not(.strip-view-radial-container)');
        if (angular) {
          angular.remove();
          const ebtn = row.querySelector('.strip-view-expand-btn') as HTMLElement | null;
          if (ebtn) { ebtn.textContent = '▸'; ebtn.setAttribute('title', 'Expand to 24 angular sub-strips'); }
        }
        const container = _stripBuildRadialContainer(ds, step, stripW);
        row.appendChild(container);
        row.classList.add('is-expanded');
        target.textContent = '◉';
        target.setAttribute('title', 'Collapse');
      }
      ev.stopPropagation();
    }
  });

  // Jump-to-top / jump-to-bottom fixed buttons
  const fixed = document.createElement('div');
  fixed.className = 'strip-view-fixedbtns';
  fixed.innerHTML = `
    <button id="strip-view-jumpnew" title="Jump to newest (top)">▲</button>
    <button id="strip-view-jumpold" title="Jump to oldest (bottom)">▼</button>
  `;
  bodyEl.appendChild(fixed);
  fixed.querySelector('#strip-view-jumpnew')!.addEventListener('click', () => {
    bodyEl.scrollTop = 0;
  });
  fixed.querySelector('#strip-view-jumpold')!.addEventListener('click', () => {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  });
}

// Refresh all strip-row canvases (e.g., after chip toggle).
function _stripRefreshFilmstrip(bodyEl: HTMLElement, ds: StripDataset): void {
  const film = bodyEl.querySelector('#strip-view-filmstrip');
  if (!film) return;
  const canvases = film.querySelectorAll('.strip-view-row-canvas');
  canvases.forEach(c => {
    const step = Number(c.getAttribute('data-step'));
    if (Number.isFinite(step)) {
      c.innerHTML = _stripRenderStepSVG(ds, step, 1500, 100);
    }
  });
}

// ============================================================
// Public entry point — called from page init
// ============================================================

function initStripView(): void {
  _ensureStripViewStyles();
  // v153 (2026-05-26): promoted from overlay to mode panel. The
  // container div #strip-view-mode-panel lives in index.html;
  // switchMode('stripview') makes it visible and calls
  // window.stripViewModeShow(), which populates the header + body
  // skeleton (one-time) and refreshes the dataset list (every time).
  // Re-rendering the skeleton is idempotent; we only build it once.
  (window as any).stripViewModeShow = () => {
    const panel = document.getElementById('strip-view-mode-panel');
    if (!panel) return;
    // First-time scaffold inside the mode panel
    if (!panel.querySelector('#strip-view-body')) {
      panel.innerHTML = `
        <div class="strip-view-header">
          <span class="strip-view-title">Strip View</span>
          <span class="strip-view-sub">helicoid recordings — paragenesis viewer</span>
          <div class="strip-view-header-actions">
            <button class="strip-view-btn" id="strip-view-upload" title="Load a .stripview file from disk">⬆ Upload</button>
            <button class="strip-view-btn" id="strip-view-download" title="Download the active dataset as a .stripview file (gzipped)" disabled>⬇ Download</button>
            <button class="strip-view-btn" id="strip-view-sonify" title="Play the selected chip's trajectory as sound — value→pitch, pentatonic. Let the rocks speak their truth." disabled>♪ Play</button>
            <button class="strip-view-btn" id="strip-view-refresh">Refresh</button>
          </div>
          <input type="file" id="strip-view-upload-input" accept=".stripview,.gz,.bin" style="display:none"/>
        </div>
        <div class="strip-view-body" id="strip-view-body"></div>
      `;
      const refreshBtn = panel.querySelector('#strip-view-refresh') as HTMLButtonElement;
      const uploadBtn = panel.querySelector('#strip-view-upload') as HTMLButtonElement;
      const downloadBtn = panel.querySelector('#strip-view-download') as HTMLButtonElement;
      const sonifyBtn = panel.querySelector('#strip-view-sonify') as HTMLButtonElement;
      const uploadInput = panel.querySelector('#strip-view-upload-input') as HTMLInputElement;
      refreshBtn.addEventListener('click', () => {
        const body = panel.querySelector('#strip-view-body') as HTMLElement;
        if (_stripActiveDataset) _stripRenderDataset(body, _stripActiveDataset);
        else _stripRenderDatasetList(body);
      });
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', async () => {
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          const ds = await stripDeserialize(buf);
          // Stash to IDB so it persists across page reloads + appears in
          // the dataset list. Safe to fail silently if IDB unavailable.
          if (typeof stripStorageSave === 'function' && typeof stripStorageAvailable === 'function' && stripStorageAvailable()) {
            stripStorageSave(ds).catch(() => { /* silent */ });
          }
          const body = panel.querySelector('#strip-view-body') as HTMLElement;
          _stripRenderDataset(body, ds);
        } catch (err) {
          const body = panel.querySelector('#strip-view-body') as HTMLElement;
          body.innerHTML = '<div class="strip-view-empty">Failed to load file: ' + (err as Error).message + '</div>';
        }
        // Reset so re-selecting the same file fires the change handler again.
        uploadInput.value = '';
      });
      downloadBtn.addEventListener('click', async () => {
        if (!_stripActiveDataset) return;
        try {
          const blob = await stripSerialize(_stripActiveDataset, true);
          const url = URL.createObjectURL(new Blob([blob as BlobPart], { type: 'application/octet-stream' }));
          const fname = `${_stripActiveDataset.manifest.scenario_id}@seed${_stripActiveDataset.manifest.seed}.stripview`;
          const a = document.createElement('a');
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          a.remove();
          // Revoke after a short delay (browser may still be reading).
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
          alert('Strip view export failed: ' + (err as Error).message);
        }
      });
      // ♪ Play (sonify MVP): sonify the trajectory (let the rocks speak). One
      // chip → one oscillator (value→pitch, pentatonic; step→time). Plays
      // the first VISIBLE chip — the one you're looking at — and its line
      // color sets the voice (hue→register, brightness→loudness). Toggles
      // Play/Stop; flips back to Play when playback finishes on its own.
      sonifyBtn.addEventListener('click', () => {
        if (typeof stripSonifyIsPlaying === 'function' && stripSonifyIsPlaying()) {
          stripSonifyStop();
          sonifyBtn.textContent = '♪ Play';
          return;
        }
        if (!_stripActiveDataset) return;
        let chipId: string | null = null;
        for (const c of _stripActiveDataset.manifest.chips) {
          if (_stripVisibleChips[c.id]) { chipId = c.id; break; }
        }
        if (!chipId && _stripActiveDataset.manifest.chips.length) {
          chipId = _stripActiveDataset.manifest.chips[0].id;
        }
        if (!chipId) return;
        const handle = stripSonify(_stripActiveDataset, chipId, {}, () => {
          sonifyBtn.textContent = '♪ Play';
        });
        if (handle) sonifyBtn.textContent = '■ Stop';
        else alert('Audio is unavailable in this browser (no Web Audio support).');
      });
    }
    const body = panel.querySelector('#strip-view-body') as HTMLElement;
    if (_stripActiveDataset) _stripRenderDataset(body, _stripActiveDataset);
    else _stripRenderDatasetList(body);
  };
}

// Auto-init on DOM ready when running in the browser. Tests + harness
// without a DOM body skip cleanly.
if (typeof document !== 'undefined' && document.body) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStripView, { once: true });
  } else {
    initStripView();
  }
}

// === END HELIX-OVERLAY-FORK ADDITION ==================================
