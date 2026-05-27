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

// CSS injection — strip view's styles live alongside helicoid styles.
// One-shot inject at first show.
function _ensureStripViewStyles(): void {
  if (document.getElementById('strip-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'strip-view-styles';
  style.textContent = `
    .strip-view-panel {
      position: fixed;
      top: 50px;
      right: 20px;
      width: 920px;
      max-width: calc(100vw - 60px);
      max-height: calc(100vh - 80px);
      background: rgba(8, 10, 14, 0.96);
      border: 1px solid rgba(140, 160, 200, 0.35);
      border-radius: 6px;
      color: #cde;
      font-family: 'Consolas', monospace;
      font-size: 11px;
      z-index: 1500;
      box-shadow: 0 6px 32px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .strip-view-panel.is-hidden { display: none; }
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
      /* v151 (2026-05-26): 20 → 72 to match main strip height. Per-
         angle resolution stays high; expanded time unit takes 24× the
         vertical space (boss-accepted in 2026-05-26 design conversation). */
      height: 72px;
      background: rgba(20, 25, 35, 0.5);
      border: 1px solid rgba(60, 80, 110, 0.25);
      position: relative;
      overflow: hidden;
    }
    .strip-view-substrip-canvas svg { display: block; width: 100%; height: 100%; }
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
      /* v151 (2026-05-26): 24 → 72 (3× taller) per boss feedback.
         Lines spread visibly; bundle ribbons readable; nucleation
         markers no longer pinned to bottom edge. */
      height: 72px;
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

// Sample a chip's normalized value (0..1) at one (step, angle, height).
// If angle is null, returns the MEAN across all angles. Returns null
// when the value is null/missing.
function _stripSampleChipNormalized(
  ds: StripDataset, step: number, angle: number | null, height: number, k: number
): number | null {
  const axes = ds.manifest.axes;
  const chipCount = ds.manifest.chips.length;
  if (angle !== null) {
    const idx = stripDataIndex(step, angle, height, k, axes, chipCount);
    if (idx < 0) return null;
    const b = ds.chip_data[idx];
    if (b === 255) return null;
    return b / 254;
  }
  // mean across angles
  let sum = 0, count = 0;
  for (let a = 0; a < axes.angular_indices; a++) {
    const idx = stripDataIndex(step, a, height, k, axes, chipCount);
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

// Render a single strip (one row OR one angular sub-strip). When
// `angle` is null, renders the mean across angles (collapsed view).
// When `angle` is a specific index, renders that one angular slice.
function _stripRenderStripSVG(
  ds: StripDataset, step: number, angle: number | null, width: number, height: number
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
      const norm = _stripSampleChipNormalized(ds, step, angle, h, k);
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
      // v151 (2026-05-26): stroke-width 1 → 1.5 to remain visible at
      // the 3× taller strip height. Bundled lines stack opacity
      // naturally (each in the bundle paints its own stroke).
      segs.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${colorHex}" stroke-width="1.5" stroke-opacity="0.65"/>`);
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
      <div class="strip-view-substrip-canvas">${_stripRenderStripSVG(ds, step, a, width, 72)}</div>
    `;
    container.appendChild(sub);
  }
  return container;
}

// Build / refresh the dataset list view.
async function _stripRenderDatasetList(bodyEl: HTMLElement): Promise<void> {
  bodyEl.innerHTML = '';
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
    empty.innerHTML = 'No recordings yet. Run a Random scenario to capture one.<br><br>The helicoid is now a recording instrument; every Random run writes a dataset to IndexedDB for review here.';
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
  backBtn.addEventListener('click', () => { _stripActiveDataset = null; _stripRenderDatasetList(bodyEl); });

  // Chip selector — grouped by system. Per-chip toggles.
  const selector = document.createElement('div');
  selector.className = 'strip-view-chipselector';
  const systems = ['wall', 'special', 'carbonate', 'ion'];
  for (const sys of systems) {
    const inSys = ds.manifest.chips.filter(c => c.system === sys);
    if (!inSys.length) continue;
    const groupLabel = document.createElement('div');
    groupLabel.style.cssText = 'display:flex; gap:2px; align-items:center; padding-right:6px;';
    groupLabel.innerHTML = `<span style="color:#99b; font-size:10px; padding-right:3px;">${sys}:</span>`;
    selector.appendChild(groupLabel);
    for (const chip of inSys) {
      const chipEl = document.createElement('span');
      chipEl.className = 'strip-view-chipchip' + (_stripVisibleChips[chip.id] === false ? ' is-off' : '');
      const colorHex = '#' + (chip.color | 0).toString(16).padStart(6, '0');
      chipEl.style.borderLeftColor = colorHex;
      chipEl.style.borderLeftWidth = '3px';
      chipEl.title = chip.id + (chip.units ? ' (' + chip.units + ')' : '') + ' range [' + chip.range[0] + ', ' + chip.range[1] + ']';
      chipEl.textContent = chip.label;
      chipEl.addEventListener('click', () => {
        _stripVisibleChips[chip.id] = !(_stripVisibleChips[chip.id] !== false);
        chipEl.classList.toggle('is-off', _stripVisibleChips[chip.id] === false);
        _stripRefreshFilmstrip(bodyEl, ds);
      });
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
  const stripW = 860;
  // v151 (2026-05-26): 24 → 72 per boss feedback. Must match
  // .strip-view-row-canvas CSS height to avoid SVG aspect-ratio stretch.
  const stripH = 72;
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
        // Expand
        const container = _stripBuildExpandedContainer(ds, step, stripW);
        row.appendChild(container);
        row.classList.add('is-expanded');
        target.textContent = '▾';
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
      c.innerHTML = _stripRenderStepSVG(ds, step, 860, 24);
    }
  });
}

// ============================================================
// Public entry point — called from page init
// ============================================================

function initStripView(): void {
  _ensureStripViewStyles();
  // Create the panel if it doesn't exist yet.
  let panel = document.getElementById('strip-view-panel') as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'strip-view-panel';
    panel.className = 'strip-view-panel is-hidden';
    panel.innerHTML = `
      <div class="strip-view-header">
        <span class="strip-view-title">Strip View</span>
        <span class="strip-view-sub">helicoid recordings — paragenesis viewer</span>
        <div class="strip-view-header-actions">
          <button class="strip-view-btn" id="strip-view-refresh">Refresh</button>
          <button class="strip-view-btn" id="strip-view-close">✕</button>
        </div>
      </div>
      <div class="strip-view-body" id="strip-view-body"></div>
    `;
    document.body.appendChild(panel);
    const closeBtn = panel.querySelector('#strip-view-close') as HTMLButtonElement;
    const refreshBtn = panel.querySelector('#strip-view-refresh') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => panel!.classList.add('is-hidden'));
    refreshBtn.addEventListener('click', () => {
      const body = panel!.querySelector('#strip-view-body') as HTMLElement;
      if (_stripActiveDataset) _stripRenderDataset(body, _stripActiveDataset);
      else _stripRenderDatasetList(body);
    });
  }
  // Expose toggle for the tab-bar button (#mode-stripview in
  // index.html invokes window.toggleStripView in its onclick handler).
  // The button itself lives in the mode-toggle bar (between Record
  // Player and Library) per boss feedback 2026-05-26. No floating
  // button created here — the bar handles it.
  (window as any).toggleStripView = () => {
    panel!.classList.toggle('is-hidden');
    if (!panel!.classList.contains('is-hidden')) {
      const body = panel!.querySelector('#strip-view-body') as HTMLElement;
      if (_stripActiveDataset) _stripRenderDataset(body, _stripActiveDataset);
      else _stripRenderDatasetList(body);
    }
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
