// ============================================================
// js/99b-renderer-topo-2d.ts — Canvas-2D topo painter — flat unwrapped wall view
// ============================================================
// _topoPaintPlaceholder, _topoProject3D math helper, _topoAggregateRing, _topoActiveRingForRender, topoCycleSlice, _topoUpdateSliceLabel, and the master topoRender function.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

function _topoPaintPlaceholder(canvas, text) {
  const ctx = canvas.getContext('2d');
  const { cssW, cssH, dpr } = _topoResize(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  // The visible window is cssW/STAGE × cssH/STAGE because the canvas is
  // inside a 200%-sized stage; place the placeholder in the centre of
  // that window so it appears centered regardless of the 2× canvas
  // headroom that exists for 3D rotation.
  const visW = cssW / TOPO_STAGE_SCALE;
  const visH = cssH / TOPO_STAGE_SCALE;
  const cx = cssW / 2;
  const cy = cssH / 2;
  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = '#5a4a30';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Wrap the text manually — split on the em-dash if too long for the
  // visible window.
  const maxLineW = visW * 0.85;
  const measure = ctx.measureText(text);
  if (measure.width > maxLineW && text.includes(' — ')) {
    const [a, b] = text.split(' — ');
    ctx.fillText(a, cx, cy - 9);
    ctx.fillText('— ' + b, cx, cy + 9);
  } else {
    ctx.fillText(text, cx, cy);
  }
}

// Phase B (Tier 1.5) — per-vertex 3D projection helper.
// Maps a world-space point (relative to the scene origin) to a screen-
// space point via Yaw → Pitch rotation + perspective. Replaces the
// tier-1 CSS transform: projection done in canvas math instead of GPU
// composite, so per-cell vertices land where the user actually sees
// them (and depth-sorting / multi-ring stacking become possible).
//
//   wx, wy, wz : world-space coords in px (z+ toward camera at zero tilt)
//   tiltX, tiltY : pitch and yaw in radians
//   F : perspective focal length in px (1200 matches tier-1's CSS perspective())
//
// Returns [screenX, screenY, projectedZ] — screenX/Y are offsets from
// the scene origin (caller adds cx/cy). projectedZ is post-rotation z,
// useful for back-to-front depth sorting (smallest first = farthest).
function _topoProject3D(wx, wy, wz, tiltX, tiltY, F) {
  // Yaw around Y first, so x rotates with z.
  const cy_ = Math.cos(tiltY), sy_ = Math.sin(tiltY);
  const x1 = cy_ * wx + sy_ * wz;
  const y1 = wy;
  const z1 = -sy_ * wx + cy_ * wz;
  // Pitch around X next, so y rotates with z.
  const cx_ = Math.cos(tiltX), sx_ = Math.sin(tiltX);
  const x2 = x1;
  const y2 = cx_ * y1 - sx_ * z1;
  const z2 = sx_ * y1 + cx_ * z1;
  // Perspective divide. Clamp denominator so points at/behind the
  // camera don't flip wildly — they'll be pushed off-screen but still
  // produce finite numbers the canvas API accepts.
  const denom = F - z2;
  const scale = F / (denom < 1 ? 1 : denom);
  return [x2 * scale, y2 * scale, z2];
}

// Phase C v1 made crystals scatter across all rings, but the 2D topo
// strip and the hit-test were still reading rings[0] only — which
// after scatter is mostly empty. Result: 2D mode mostly hid crystals,
// and hover-tooltip mostly returned "vugg wall" because the queried
// ring 0 cell was empty. This helper builds a synthetic "aggregate
// ring": for each cell index, the most-prominent crystal across any
// ring is collapsed onto one slot. Geometry (base_radius_mm) is taken
// from rings[0] since that's uniform across rings. Lossy — the 2D
// view can't tell which ring a crystal was on — but it makes
// everything visible and hover-clickable.
function _topoAggregateRing(wall) {
  if (!wall || !wall.rings || !wall.rings.length) return [];
  const ring0 = wall.rings[0];
  const N = ring0.length;
  // Shallow-copy ring 0 so we can overlay other rings without mutating
  // the simulation state.
  const out = ring0.map(c => ({
    wall_depth: c.wall_depth,
    crystal_id: c.crystal_id,
    mineral: c.mineral,
    thickness_um: c.thickness_um,
    base_radius_mm: c.base_radius_mm,
  }));
  // For each cell index, walk rings[1..] and take the thickest
  // crystal seen. Ties go to the lowest ring index (deterministic).
  for (let r = 1; r < wall.rings.length; r++) {
    const ring = wall.rings[r];
    if (!ring || !ring.length) continue;
    for (let i = 0; i < N; i++) {
      const cell = ring[i];
      if (cell.crystal_id == null) continue;
      if (cell.thickness_um > out[i].thickness_um) {
        out[i].crystal_id = cell.crystal_id;
        out[i].mineral = cell.mineral;
        out[i].thickness_um = cell.thickness_um;
      }
    }
  }
  return out;
}

// Slice resolver: returns the ring data the 2D path should display
// based on `_topoActiveSlice`. 'aggregate' → aggregate ring (post-
// scatter default); int N → wall.rings[N] directly. Out-of-range
// indices clamp back to aggregate so the stepper can never wedge
// itself on a stale ring count after a scenario reload.
function _topoActiveRingForRender(wall) {
  if (!wall || !wall.rings || !wall.rings.length) return [];
  if (_topoActiveSlice === 'aggregate') return _topoAggregateRing(wall);
  const idx = _topoActiveSlice | 0;
  if (idx < 0 || idx >= wall.rings.length) {
    _topoActiveSlice = 'aggregate';
    _topoUpdateSliceLabel(wall);
    return _topoAggregateRing(wall);
  }
  return wall.rings[idx];
}

// Cycle through [aggregate, 0, 1, ..., ring_count-1, aggregate, ...]
// in either direction. dir=+1 advances; dir=-1 goes back. Wraps at
// both ends. Re-renders and updates the label after each step.
function topoCycleSlice(dir) {
  const sim = topoActiveSim();
  const wall = sim ? sim.wall_state : null;
  const n = wall ? wall.ring_count : 0;
  if (n <= 1) {
    // Single-ring sim — no stepper to cycle. Stay aggregated.
    _topoActiveSlice = 'aggregate';
    _topoUpdateSliceLabel(wall);
    return;
  }
  // The state space has n + 1 entries: 'aggregate', 0, 1, ..., n-1.
  // Encode as integers 0..n where 0 = 'aggregate'; cycle there, then
  // decode back to either 'aggregate' or an int.
  const cur = (_topoActiveSlice === 'aggregate') ? 0 : (_topoActiveSlice + 1);
  const next = ((cur + dir) % (n + 1) + (n + 1)) % (n + 1);
  _topoActiveSlice = (next === 0) ? 'aggregate' : (next - 1);
  _topoUpdateSliceLabel(wall);
  topoRender();
}

// Repaint the slice-stepper label to match `_topoActiveSlice`.
// Called from topoCycleSlice and from topoRender (so the label stays
// in sync if a scenario reload trims the ring count under us).
function _topoUpdateSliceLabel(wall) {
  const lab = document.getElementById('topo-slice-label');
  if (!lab) return;
  if (_topoActiveSlice === 'aggregate') {
    lab.textContent = 'All slices';
    return;
  }
  const idx = _topoActiveSlice | 0;
  const orient = (wall && wall.ringOrientation)
    ? wall.ringOrientation(idx) : '';
  const total = wall ? wall.ring_count : 0;
  // "5/16 wall" — compact; the orientation tag tells the player
  // they're looking at a floor / wall / ceiling slice without a
  // separate UI element.
  lab.textContent = `${idx + 1}/${total} ${orient}`.trim();
}

function topoRender(optOverrideRing?) {
  const canvas = document.getElementById('topo-canvas');
  const panel = document.getElementById('topo-panel');
  if (!canvas || !panel || panel.style.display === 'none') return;

  const sim = topoActiveSim();
  const wall = sim ? sim.wall_state : null;
  // Slice stepper resolves to either the aggregate (default) or a
  // specific ring index. Replay snapshots are already a single ring
  // shape, so optOverrideRing falls through unchanged.
  const ring0 = optOverrideRing || (wall && _topoActiveRingForRender(wall));
  // Keep the stepper label in sync — cheap, runs every render.
  if (wall) _topoUpdateSliceLabel(wall);

  // Empty-state guard: no active sim or no ring data yet (fresh page,
  // pre-first-Grow). Paint a centered placeholder so the panel reads as
  // 'waiting for a vug' rather than a 340px-tall void. Without this the
  // first impression of Current Game is a cavernous empty box, which
  // looks like a render bug.
  if (!sim && !optOverrideRing) {
    _topoPaintPlaceholder(canvas, 'Press Grow to generate a vug — the wall profile will appear here');
    const btn = document.getElementById('topo-replay-btn');
    if (btn) btn.style.display = 'none';
    const sizeLabel = document.getElementById('topo-vug-size');
    if (sizeLabel) sizeLabel.textContent = '';
    return;
  }
  if (!ring0 || !ring0.length) {
    _topoPaintPlaceholder(canvas, 'Vug initialized — waiting for first growth step…');
    return;
  }

  // Only show the Replay button once there's history to play back.
  const btn = document.getElementById('topo-replay-btn');
  if (btn) btn.style.display = (sim && sim.wall_state_history && sim.wall_state_history.length) ? 'flex' : 'none';
  // Legacy `topoBuildLegend()` call lived here. The legend was a
  // class-swatch list; that role moved into the fortress-status sigma
  // panel (each class group's swatch + the per-pill hover-highlight),
  // and the legacy <details class="topo-legend-drop"> element is gone.

  const ctx = canvas.getContext('2d');
  const { cssW, cssH, dpr } = _topoResize(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const N = ring0.length;
  const initR = wall ? wall.initial_radius_mm : 25;

  // Scale monotonically: use max_seen_radius_mm (seeded at 2× initial
  // radius, only grows) so the rendered vug doesn't shrink back when
  // new dissolution doesn't push further than the running max.
  let maxWallR = wall ? wall.max_seen_radius_mm : initR * 2;
  for (const c of ring0) {
    const r = initR + c.wall_depth;
    if (r > maxWallR) maxWallR = r;
  }
  if (wall && maxWallR > wall.max_seen_radius_mm) wall.max_seen_radius_mm = maxWallR;
  const centerPad = 48;  // leave room for the scale bar and legend
  // The canvas lives inside a 2×-sized stage inside the overflow:hidden
  // wrap. cssW/cssH are the CANVAS buffer dimensions (2× the visible
  // window); fit the slice to the VISIBLE window (cssW/STAGE, cssH/STAGE)
  // so it occupies the same on-screen area as before. The extra canvas
  // area becomes "rotation headroom" — slice can tilt freely within the
  // buffer and the wrap's overflow:hidden clips the view to the window.
  const viewW = cssW / TOPO_STAGE_SCALE;
  const viewH = cssH / TOPO_STAGE_SCALE;
  const fit = Math.min(viewW, viewH - centerPad) * 0.82 / 2;
  const mmToPx = (fit / maxWallR) * _topoZoom;

  // Pan offsets let the user drag the vug around the canvas. Hit-test
  // and tooltip code below MUST apply the same offsets or clicks will
  // miss what the user sees on screen.
  const cx = cssW / 2 + _topoPanX;
  const cy = (cssH - centerPad) / 2 + 8 + _topoPanY;

  // Per-cell outer radius in px. Phase 1: each cell has its own
  // base_radius_mm baked from the Fourier profile, so cellR[i] already
  // varies cell-to-cell even on a pristine vug. Dissolution stacks on
  // top via wall_depth. Fallback to initR for snapshots saved before
  // the Phase-1 schema (base_radius_mm=0 by default).
  const cellR = new Array(N);
  for (let i = 0; i < N; i++) {
    const cell = ring0[i];
    const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
    cellR[i] = (baseR + cell.wall_depth) * mmToPx;
  }

  // Boundary radii — average the two adjacent cell radii so each cell's
  // wedge shares its endpoints with its neighbors'. Without this the
  // outline would render as disconnected circular arcs with radial
  // "teeth" at every cell boundary once the bubble-merge profile puts
  // neighbouring cells at different radii.
  const boundaryR = new Array(N);
  for (let i = 0; i < N; i++) {
    const prev = (i - 1 + N) % N;
    boundaryR[i] = (cellR[prev] + cellR[i]) / 2;
  }

  // Find the heaviest crystal on the wall so stroke widths scale to
  // something meaningful (1 big crystal vs. 1 microcrystal).
  let maxT = 0;
  for (const c of ring0) if (c.thickness_um > maxT) maxT = c.thickness_um;
  if (maxT <= 0) maxT = 1;

  const arcStep = 2 * Math.PI / N;

  // Phase E1 branch — Three.js mesh renderer. When the user has
  // toggled it on AND Three.js loaded, the WebGL canvas takes over
  // and the canvas-vector path is skipped. Falls through silently if
  // _topoRenderThree returns false (CDN blocked, canvas missing) so
  // the user is never left staring at an empty panel.
  if (_topoUseThreeRenderer && wall && wall.rings && wall.rings.length) {
    if (_topoRenderThree(sim, wall)) {
      _topoSyncThreeCanvasVisibility();
      return;
    }
  } else if (typeof _topoSyncThreeCanvasVisibility === 'function') {
    // Renderer toggled off — make sure the WebGL canvas isn't masking
    // the 2D one from a prior session.
    _topoSyncThreeCanvasVisibility();
  }

  // Phase B branch — 3D mode renders all rings stacked along a vertical
  // axis using per-vertex projection. Hands off to _topoRenderRings3D
  // and short-circuits the rest of the 2D path. 2D mode falls through
  // unchanged. See PROPOSAL-3D-TOPO-VUG.md ("Tier 1.5") for design.
  if (_topoView3D && wall && wall.rings && wall.rings.length) {
    _topoRenderRings3D(ctx, sim, wall, ring0, cellR, boundaryR, cx, cy,
                       mmToPx, maxT, arcStep, N, viewW, viewH);
    return;
  }

  // Radial wedges: each occupied cell gets a Bezier-bounded wedge.
  // Outer edge arcs from boundary_start → cell_midpoint → boundary_end
  // via quadraticCurveTo (cell midpoint = control point), which matches
  // the next cell's starting boundary and yields a smooth curve through
  // the cell instead of a V-shaped two-segment polyline. Inner edge
  // mirrors the outer with an absolute inward offset.
  //
  // Inner offset is thickness × void_reach in mm, scaled to pixels.
  // Adjacent cells painted by the same crystal share thickness, so they
  // share the inward offset → inner edges line up at shared boundaries
  // and the band stays annular even across dip/bulge neighbours.
  // Inner edge is floored at 15% of each point's outer radius so a
  // very thick crystal in a dip cell still leaves a visible void.
  for (let i = 0; i < N; i++) {
    const cell = ring0[i];
    if (cell.crystal_id == null) continue;
    const a0 = _topoAngleFor(i, N) - arcStep / 2;
    const aMid = _topoAngleFor(i, N);
    const a1 = a0 + arcStep;
    const rStart = boundaryR[i];
    const rMid = cellR[i];
    const rEnd = boundaryR[(i + 1) % N];
    const crystal = sim?.crystals?.find(c => c.crystal_id === cell.crystal_id);
    const voidReach = crystal ? Math.max(crystal.void_reach, 0.05) : 0.5;
    const inwardMm = (cell.thickness_um / 1000.0) * voidReach;
    const inwardPx = Math.max(inwardMm * mmToPx, TOPO_WALL_STROKE_PX + 1);
    const rStartIn = Math.max(rStart - inwardPx, rStart * (1 - TOPO_CRYSTAL_CAP_FRAC));
    const rMidIn = Math.max(rMid - inwardPx, rMid * (1 - TOPO_CRYSTAL_CAP_FRAC));
    const rEndIn = Math.max(rEnd - inwardPx, rEnd * (1 - TOPO_CRYSTAL_CAP_FRAC));
    // The Bezier control point needs to be PLACED so the curve actually
    // passes through (rMid, aMid). For a quadratic Bezier parametrised
    // at t=0.5, the curve point = (start + 2·control + end) / 4. So
    // control = 2·target − (start + end)/2. Applied to each of outer
    // and inner edges.
    const sx = cx + rStart * Math.cos(a0), sy = cy + rStart * Math.sin(a0);
    const mx = cx + rMid * Math.cos(aMid), my = cy + rMid * Math.sin(aMid);
    const ex = cx + rEnd * Math.cos(a1), ey = cy + rEnd * Math.sin(a1);
    const outerCpX = 2 * mx - (sx + ex) / 2;
    const outerCpY = 2 * my - (sy + ey) / 2;
    const sxIn = cx + rStartIn * Math.cos(a0), syIn = cy + rStartIn * Math.sin(a0);
    const mxIn = cx + rMidIn * Math.cos(aMid), myIn = cy + rMidIn * Math.sin(aMid);
    const exIn = cx + rEndIn * Math.cos(a1), eyIn = cy + rEndIn * Math.sin(a1);
    const innerCpX = 2 * mxIn - (sxIn + exIn) / 2;
    const innerCpY = 2 * myIn - (syIn + eyIn) / 2;
    ctx.globalAlpha = topoAlphaFor(cell.mineral);
    ctx.fillStyle = topoClassColor(cell.mineral);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(outerCpX, outerCpY, ex, ey);
    ctx.lineTo(exIn, eyIn);
    // Inner (fluid-facing) edge — dispatched on crystal habit. Unknown
    // habits fall through to 'smooth' (the original Bezier). Each cell
    // draws its own complete teeth on the local chord; for typical 5°
    // arcs the chord/arc difference is <0.5%, visually invisible.
    const thicknessMmForTex = cell.thickness_um / 1000.0;
    const cellArcMmForTex = (rMidIn * arcStep) / mmToPx;
    drawHabitTexture(ctx, cell.mineral, crystal?.habit, exIn, eyIn, sxIn, syIn, innerCpX, innerCpY, thicknessMmForTex, cellArcMmForTex, mmToPx, cx, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Wall outline — one quadratic Bezier per cell, with the cell's
  // midpoint as the de-facto pass-through. Control point is placed so
  // the curve passes exactly through (rMid, aMid) at t=0.5:
  //   control = 2·midpoint − (start + end)/2
  // Adjacent cells share boundary endpoints, so the outline flows as
  // a smooth continuous curve instead of a V-polyline. Bare cells
  // stroke thin amber; occupied cells stroke thicker in the mineral's
  // class_color, scaled to crystal thickness.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < N; i++) {
    const a0 = _topoAngleFor(i, N) - arcStep / 2;
    const aMid = _topoAngleFor(i, N);
    const a1 = a0 + arcStep;
    const rStart = boundaryR[i];
    const rMid = cellR[i];
    const rEnd = boundaryR[(i + 1) % N];
    const cell = ring0[i];
    let stroke, width, alpha;
    if (cell.crystal_id == null) {
      // Bare wall — amber, always fully opaque (wall is the substrate,
      // not a mineral; it shouldn't ghost with the highlight).
      stroke = TOPO_WALL_COLOR;
      width = TOPO_WALL_STROKE_PX;
      alpha = 1;
    } else {
      stroke = topoClassColor(cell.mineral);
      const t = Math.min(cell.thickness_um / maxT, 1);
      width = TOPO_WALL_STROKE_PX + t * (TOPO_WALL_STROKE_MAX_PX - TOPO_WALL_STROKE_PX);
      alpha = topoAlphaFor(cell.mineral);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    const sx = cx + rStart * Math.cos(a0), sy = cy + rStart * Math.sin(a0);
    const mx = cx + rMid * Math.cos(aMid), my = cy + rMid * Math.sin(aMid);
    const ex = cx + rEnd * Math.cos(a1), ey = cy + rEnd * Math.sin(a1);
    const cpX = 2 * mx - (sx + ex) / 2;
    const cpY = 2 * my - (sy + ey) / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpX, cpY, ex, ey);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Inclusion dots — render each host's swallowed crystals as small
  // colored circles WITHIN the host's currently-painted wall band.
  //
  // Placement model:
  //   * Find every ring-0 cell the host actually paints (crystal_id
  //     matches). That set IS the host's visible footprint on the topo.
  //   * Spread the inclusions across those cells, one-per-cell until
  //     we run out (then round-robin).
  //   * Each inclusion's radius uses its assigned cell's OWN local wall
  //     radius + the host's band offset at that cell. That way the dot
  //     sits inside the host's painted band at that cell, even when the
  //     bubble-merge profile makes adjacent cells differ by 10×.
  //   * Ghost alpha follows the inclusion's own mineral (highlight
  //     brief: "if you highlight the inclusion's mineral species, those
  //     dots go to 100% everywhere they appear").
  //
  // Why not use enc.wall_center_cell directly? Because that's where the
  // inclusion was anchored BEFORE the host engulfed it — once swallowed,
  // the inclusion moves with the host's spatial extent, and using its
  // old anchor angle puts the dot wherever the inclusion USED to be.
  // On a bubble-merge wall, that's often nowhere near the host's
  // current footprint, and with the old (host-radius × inclusion-angle)
  // combination the dot lands outside the wall entirely.
  _topoInclusions.length = 0;
  if (sim && sim.crystals) {
    for (const host of sim.crystals) {
      if (!host.enclosed_crystals || !host.enclosed_crystals.length) continue;
      if (host.dissolved || host.wall_center_cell == null) continue;

      // Build the host's painted-cell set. Fall back to its center cell
      // if nothing paints (a smaller overlapping crystal may have
      // overwritten its paint — rare but possible).
      const hostPaintedCells = [];
      for (let i = 0; i < N; i++) {
        if (ring0[i].crystal_id === host.crystal_id) hostPaintedCells.push(i);
      }
      if (!hostPaintedCells.length) hostPaintedCells.push(host.wall_center_cell);
      const mCells = hostPaintedCells.length;

      const voidReach = Math.max(host.void_reach, 0.05);
      const allIds = host.enclosed_crystals;
      // Cap visible dots per host — real Sweetwater-style calcite can
      // carry hundreds of pyrite or chalcopyrite inclusions and a
      // pointillist cluster reads as "this crystal is full of them."
      // Still cap high enough to avoid the canvas turning into noise.
      const MAX_PER_HOST = 80;
      const renderedIds = allIds.length > MAX_PER_HOST
        ? allIds.slice(0, MAX_PER_HOST)
        : allIds;
      const n = renderedIds.length;
      for (let k = 0; k < n; k++) {
        const enc = sim.crystals.find(c => c.crystal_id === renderedIds[k]);
        if (!enc) continue;

        // Spread inclusions evenly across painted cells. Floating index
        // gives a sub-cell offset used to fan dots within one cell when
        // more inclusions than cells.
        const cellPos = (k + 0.5) * mCells / n;
        const cellIdx = hostPaintedCells[Math.min(mCells - 1, Math.floor(cellPos))];
        const withinCell = cellPos - Math.floor(cellPos) - 0.5;  // −0.5 .. +0.5
        const cell = ring0[cellIdx];
        const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
        const rOuterCell = (baseR + cell.wall_depth) * mmToPx;
        const inwardMm = (cell.thickness_um / 1000.0) * voidReach;
        const inwardPx = Math.max(inwardMm * mmToPx, TOPO_WALL_STROKE_PX + 1);
        const rInnerCell = Math.max(rOuterCell - inwardPx, rOuterCell * (1 - TOPO_CRYSTAL_CAP_FRAC));
        const rMid = (rOuterCell + rInnerCell) / 2;
        // Cell angular centre, plus a small fan when multiple inclusions
        // land in the same cell (otherwise they'd stack exactly).
        const baseAngle = -Math.PI / 2 + (cellIdx / N) * 2 * Math.PI;
        const angle = baseAngle + withinCell * arcStep * 0.8;

        const x = cx + rMid * Math.cos(angle);
        const y = cy + rMid * Math.sin(angle);
        const dotR = Math.max(2.5, Math.min(5.5, enc.c_length_mm * mmToPx * 0.4));
        ctx.globalAlpha = topoAlphaFor(enc.mineral);
        ctx.fillStyle = topoClassColor(enc.mineral);
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(10, 10, 8, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
        _topoInclusions.push({ x, y, r: dotR + 2, crystal_id: enc.crystal_id, mineral: enc.mineral });
      }
    }
  }
  ctx.globalAlpha = 1;

  // (Removed the dotted initial-radius reference ring — with the
  // bubble-merge profile the wall is already irregular from t=0, so a
  // perfect-circle reference at initial_radius_mm misleads the eye
  // into reading crystals on near-nominal cells as "on the circle"
  // rather than "on the wall.")

  // Scale bar across the bottom: total wall circumference in mm.
  const circMm = wall ? Math.PI * wall.meanDiameterMm() : 0;
  if (circMm > 0) {
    // Scale bar sits at the bottom of the VISIBLE window (wrap), not
    // the bottom of the oversized canvas. Visible window is vertically
    // centered in the canvas; its bottom edge is at cssH/2 + viewH/2
    // = (cssH + viewH)/2.
    const barY = (cssH + viewH) / 2 - 18;
    const tenPx = 10 * mmToPx;
    const barX0 = cssW / 2 - tenPx / 2;
    ctx.strokeStyle = '#5a4a30';
    ctx.fillStyle = '#5a4a30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX0, barY);
    ctx.lineTo(barX0 + tenPx, barY);
    ctx.moveTo(barX0, barY - 3);
    ctx.lineTo(barX0, barY + 3);
    ctx.moveTo(barX0 + tenPx, barY - 3);
    ctx.lineTo(barX0 + tenPx, barY + 3);
    ctx.stroke();
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('10 mm', cssW / 2, barY + 14);
    // Overall diameter readout lives OUTSIDE the canvas — as an HTML
    // overlay on the wrap — so it stays fixed to the background while
    // the slice rotates in 3D mode. It's a description of the slice,
    // not content of the slice.
  }
  const sizeLabel = document.getElementById('topo-vug-size');
  if (sizeLabel) {
    if (wall) sizeLabel.textContent = `Vug ⌀ ${wall.meanDiameterMm().toFixed(1)} mm`;
    else sizeLabel.textContent = '';
  }
}

// ─── Wireframe-crystal primitive library ─────────────────────────────
// Hand-crafted polyhedra for the 3D-mode wireframe-crystal renderer.
// Convention (see proposals/PROPOSAL-WIREFRAME-CRYSTALS.md addendum A):
//   * c-axis = +y, base-anchored at y=-0.1, free tip at y=+1.0.
//   * equatorial extent = roughly ±0.5 (or wider for cube-ish shapes
//     so they read as cubic when c_length ≈ a_width).
//   * Each primitive scales by (a_width, c_length, a_width) at render
//     time and rotates around its c-axis (= inward sphere normal at
//     anchor cell) by a crystal_id-seeded random angle.
