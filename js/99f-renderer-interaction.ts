// ============================================================
// js/99f-renderer-interaction.ts — Tooltip + drag/zoom/recenter interaction handlers
// ============================================================
// _topoTooltipFromEvent, _topoHideTooltip, _topoClickFromEvent, topoZoom, topoSetDragMode, topoRecenter, _topoApplyTransform, topoEnsureWired, _topoPan*MouseDown/Move/Up.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

function _topoTooltipFromEvent(ev) {
  const canvas = document.getElementById('topo-canvas');
  const tip = document.getElementById('topo-tooltip');
  const sim = topoActiveSim();
  if (!canvas || !tip || !sim) return;
  const hit = _topoHitTest(ev);
  topoSetHoverTarget(
    hit && hit.mineral ? { type: 'mineral', value: hit.mineral } : null
  );
  if (!hit) { tip.style.display = 'none'; return; }

  let html;
  if (hit.isInclusion) {
    const crystal = sim.crystals.find(c => c.mineral === hit.mineral);
    if (!crystal) { tip.style.display = 'none'; return; }
    const host = sim.crystals.find(c => c.crystal_id === crystal.enclosed_by);
    const spec = MINERAL_SPEC[crystal.mineral] || {};
    const color = spec.class_color || TOPO_WALL_COLOR;
    const lines = [];
    lines.push(`<b style="color:${color}">◆ ${crystal.mineral} #${crystal.crystal_id}</b>`);
    lines.push(`${crystal.habit}${crystal.twinned ? ` (${crystal.twin_law} twin)` : ''}`);
    lines.push(`${crystal.c_length_mm.toFixed(2)} mm — inclusion`);
    if (host) lines.push(`inside ${host.mineral} #${host.crystal_id}`);
    html = lines.join('<br>');
  } else {
    const cell = hit.cell;
    if (!cell) { tip.style.display = 'none'; return; }
    if (cell.crystal_id == null) {
      // 3D mode renders the cavity as a wireframe topo map — the user
      // can SEE the bare wall directly, so the "wall · eroded +Xmm"
      // tooltip just adds friction without information. Suppress it.
      // 2D mode keeps the readout because the strip view doesn't make
      // erosion depth obvious from geometry alone.
      if (_topoView3D) { tip.style.display = 'none'; return; }
      const wallDepthMm = cell.wall_depth || 0;
      const depthNote = wallDepthMm > 0.1 ? ` · eroded +${wallDepthMm.toFixed(1)}mm` : '';
      html = `<b style="color:${TOPO_WALL_COLOR}">${sim.conditions.wall.composition || 'wall'}</b><br>` +
             `bare wall${depthNote}`;
    } else {
      const crystal = sim.crystals.find(c => c.crystal_id === cell.crystal_id);
      const spec = MINERAL_SPEC[cell.mineral] || {};
      const color = spec.class_color || TOPO_WALL_COLOR;
      const lines = [];
      lines.push(`<b style="color:${color}">${cell.mineral} #${cell.crystal_id}</b>`);
      if (crystal) {
        lines.push(`${crystal.habit}${crystal.twinned ? ` (${crystal.twin_law} twin)` : ''}`);
        lines.push(`${crystal.c_length_mm.toFixed(2)} mm · vector: ${crystal.vector}`);
      }
      html = lines.join('<br>');
    }
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  // Viewport-relative positioning (CSS is now position:fixed). Don't
  // subtract container offsets — under TOPO_STAGE_SCALE + _topoZoom + pan
  // transforms, that mismatch is what produces the offset bug.
  tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 6, ev.clientX + 12)}px`;
  tip.style.top = `${Math.min(window.innerHeight - 40, ev.clientY - 10)}px`;
}

function _topoHideTooltip() {
  const tip = document.getElementById('topo-tooltip');
  if (tip) tip.style.display = 'none';
  // Canvas hover also stops contributing to the highlight when the
  // cursor leaves — the legend hover (if any) becomes the effective
  // target, or nothing if neither is active.
  topoSetHoverTarget(null);
}

// Canvas click — toggle lock on the crystal under the cursor, or clear
// the lock if clicking empty space. Brief edge case: clicks on the
// legend propagate up to canvas if not stopped; the legend handler
// calls stopPropagation to prevent that crossover.
function _topoClickFromEvent(ev) {
  const hit = _topoHitTest(ev);
  topoToggleLockTarget(
    hit && hit.mineral ? { type: 'mineral', value: hit.mineral } : null
  );
}

// Zoom — multiplies mmToPx in the renderer. `dir` is +1 (in) or -1 (out).
function topoZoom(dir) {
  const factor = dir > 0 ? TOPO_ZOOM_STEP : (1 / TOPO_ZOOM_STEP);
  _topoZoom = Math.max(TOPO_ZOOM_MIN, Math.min(TOPO_ZOOM_MAX, _topoZoom * factor));
  const label = document.getElementById('topo-zoom-label');
  if (label) label.textContent = `${Math.round(_topoZoom * 100)}%`;
  topoRender();
}

// Set the camera drag mode ('rotate' | 'pan') or toggle it off by
// re-clicking the currently-active one. Updates button highlights,
// flips _topoView3D for the renderer, and applies/clears the CSS 3D
// transform on the canvas.
function topoSetDragMode(mode) {
  // Toggle behavior: re-clicking the active mode returns to default.
  if (_topoDragMode === mode) mode = 'default';
  _topoDragMode = mode;
  _topoView3D = (mode === 'rotate');
  const rotateBtn = document.getElementById('topo-rotate-btn');
  const panBtn = document.getElementById('topo-pan-btn');
  if (rotateBtn) rotateBtn.style.color = (mode === 'rotate') ? '#f0c050' : '';
  if (panBtn) panBtn.style.color = (mode === 'pan') ? '#f0c050' : '';
  // Slice stepper hides in 3D mode (every ring is rendered stacked
  // there anyway; the per-slice navigation only makes sense in the
  // top-down 2D view). CSS `body.topo-view-3d .topo-slice-ctrls`
  // does the actual hiding.
  document.body.classList.toggle('topo-view-3d', _topoView3D);
  _topoApplyTransform();
  topoRender();
}

// Reset pan and tilt to zero. Zoom is preserved (user probably wants
// to keep their zoom level when recentering).
function topoRecenter() {
  _topoPanX = 0;
  _topoPanY = 0;
  _topoTiltX = 0;
  _topoTiltY = 0;
  _topoApplyTransform();
  topoRender();
}

// Phase B (Tier 1.5): tilt is now applied per-vertex inside topoRender's
// 3D branch (_topoRenderRings3D), not via a CSS transform on the canvas
// element. This function stays as a no-op + cleanup hook so existing
// callers (topoSetDragMode, topoRecenter) don't need to change. It also
// clears any leftover CSS transform from a tier-1 build whose state
// somehow survived (e.g. cached page) — defensive.
function _topoApplyTransform() {
  const canvas = document.getElementById('topo-canvas');
  if (!canvas) return;
  if (canvas.style.transform) {
    canvas.style.transform = '';
    canvas.style.transformOrigin = '';
  }
}

// Wire hover + zoom wheel + click-drag pan once — called from the
// panel's first show. Idempotent.
let _topoWired = false;
function topoEnsureWired() {
  if (_topoWired) return;
  const canvas = document.getElementById('topo-canvas');
  if (!canvas) return;
  // Both the canvas-vector canvas and the Phase E Three.js canvas
  // need the same pointer handlers — when the user toggles renderer
  // tier, the Three canvas claims pointer-events from the 2D canvas
  // (the 2D canvas drops to visibility:hidden), so handlers attached
  // only to the 2D canvas would stop firing in Three mode. Both
  // canvases get the same callbacks; _topoHitTest dispatches by
  // active renderer.
  const wireOne = (el: HTMLElement | null) => {
    if (!el) return;
    el.addEventListener('mousemove', _topoTooltipFromEvent);
    el.addEventListener('mouseleave', _topoHideTooltip);
    el.addEventListener('click', _topoClickFromEvent);
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      topoZoom(ev.deltaY < 0 ? +1 : -1);
    }, { passive: false });
    // Click-drag pan / rotate. Pointer events handle BOTH mouse and
    // touch from one code path (vs. the old mousedown/mousemove/
    // mouseup which never fired during touch gestures). Modern
    // browsers (Safari iOS 13+, Chrome, Firefox, Edge) all support
    // Pointer Events; the canvas's touch-action: none CSS lets the
    // gesture reach this handler instead of being eaten by browser
    // page-pan defaults.
    el.addEventListener('pointerdown', _topoPanMouseDown);
  };
  wireOne(canvas);
  wireOne(document.getElementById('topo-canvas-three'));
  window.addEventListener('resize', () => topoRender());
  _topoWired = true;
}

// Drag start. Branches on view mode:
//   2D mode: pan, but only if the click wasn't on a crystal
//            (_topoHitTest returns {mineral: 'X'} → tooltip/click wins)
//   3D mode: rotate, from anywhere on the canvas (hit-tests are
//            inaccurate under CSS 3D transform anyway)
// Stores ORIGIN values for whichever mode we're in so mousemove can
// compute deltas against them.
let _topoDragOriginTiltX = 0;
let _topoDragOriginTiltY = 0;
function _topoPanMouseDown(ev) {
  // For pointer events, button=0 is the primary button (left mouse,
  // first touch contact, primary stylus). Right-click / middle-click
  // / secondary touches are skipped.
  if (ev.button !== 0) return;
  // preventDefault on the pointerdown suppresses the browser's
  // emulated mouse events (which would fire after touchend and
  // double-trigger handlers) and any default page-scroll gesture
  // that might still come from a misconfigured touch-action setting.
  ev.preventDefault();
  // In 'default' mode, clicks on a crystal go to tooltip/click, not drag.
  // In 'rotate' or 'pan' modes, drag starts from anywhere on the canvas.
  if (_topoDragMode === 'default') {
    const hit = _topoHitTest(ev);
    if (hit && hit.mineral) return;  // click on a crystal — let tooltip/click win
  }
  _topoDragging = false;          // becomes true once movement exceeds threshold
  _topoDragStartClientX = ev.clientX;
  _topoDragStartClientY = ev.clientY;
  _topoDragOriginPanX = _topoPanX;
  _topoDragOriginPanY = _topoPanY;
  _topoDragOriginTiltX = _topoTiltX;
  _topoDragOriginTiltY = _topoTiltY;
  document.addEventListener('pointermove', _topoPanMouseMove);
  document.addEventListener('pointerup', _topoPanMouseUp);
  // `pointercancel` covers cases where the OS interrupts the gesture
  // (e.g. iOS palm rejection, system-level edge swipe) — without
  // handling it, the document-level listeners can leak.
  document.addEventListener('pointercancel', _topoPanMouseUp);
}

// Document-level mousemove during a candidate drag. Only commits once
// movement exceeds TOPO_DRAG_THRESHOLD_PX, letting short clicks still
// fire the existing click handler unchanged. In 2D mode updates pan;
// in 3D mode updates tilts (rotateX = vertical drag, rotateY = horiz).
const TOPO_DRAG_ROTATE_RAD_PER_PX = 0.5 * Math.PI / 180;  // 0.5° per px
function _topoPanMouseMove(ev) {
  const dx = ev.clientX - _topoDragStartClientX;
  const dy = ev.clientY - _topoDragStartClientY;
  if (!_topoDragging) {
    if (Math.hypot(dx, dy) < TOPO_DRAG_THRESHOLD_PX) return;
    _topoDragging = true;
    const canvas = document.getElementById('topo-canvas');
    if (canvas) canvas.style.cursor = 'grabbing';
  }
  if (_topoDragMode === 'rotate') {
    // Vertical drag → rotateX (pitch); horizontal drag → rotateY (yaw).
    // Negative dy gives intuitive "pull up to tilt toward viewer" feel.
    // Phase B (Tier 1.5): no tilt clamp — per-vertex projection has no
    // geometric edge cases at vertical (the tier-1 ±86° clamp existed
    // only because CSS transform got weird past edge-on).
    _topoTiltX = _topoDragOriginTiltX + (-dy) * TOPO_DRAG_ROTATE_RAD_PER_PX;
    _topoTiltY = _topoDragOriginTiltY + dx * TOPO_DRAG_ROTATE_RAD_PER_PX;
    topoRender();
  } else {
    // 'default' or 'pan' mode — both translate pan offsets.
    _topoPanX = _topoDragOriginPanX + dx;
    _topoPanY = _topoDragOriginPanY + dy;
    topoRender();
  }
}

// Pointerup / pointercancel ends the drag and tears down the
// document-level listeners. If the user never crossed the movement
// threshold, the click event will still fire on the canvas (browser
// default behavior — pointerup on the same target as pointerdown
// without enough motion triggers a synthetic click).
function _topoPanMouseUp() {
  document.removeEventListener('pointermove', _topoPanMouseMove);
  document.removeEventListener('pointerup', _topoPanMouseUp);
  document.removeEventListener('pointercancel', _topoPanMouseUp);
  if (_topoDragging) {
    _topoDragging = false;
    const canvas = document.getElementById('topo-canvas');
    if (canvas) canvas.style.cursor = '';
  }
}

// Replay: walk the per-step ring[0] snapshots captured during the run,
// rendering each one in sequence so the player watches the wall evolve
// from bare rock to the current state. Click again to stop — the live
// view restores automatically.
