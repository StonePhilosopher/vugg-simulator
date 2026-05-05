// ============================================================
// js/99-renderer-state.ts — Renderer module-level state + small helpers
// ============================================================
// TOPO_* constants (colors, zoom limits, drag thresholds), _topoZoom + _topoPan + _topoTilt globals, hover/lock target machinery, topoActiveSim. Loads first among 99* so the constants are defined before any other renderer module uses them.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

// TOPO MAP — unwrapped wall line, canvas renderer
// ============================================================
// The wall-state ring[0] is drawn as a single continuous line, left to
// right, representing the vug's circumference unwrapped. Bare wall is
// amber (#D2691E, reserved — never a mineral class color). Crystal cells
// stroke in the mineral's class_color from MINERAL_SPEC, with stroke
// width proportional to crystal thickness. Hover → tooltip.

const TOPO_WALL_COLOR = '#D2691E';   // warm amber — the wall's color. No mineral touches this hue.
// Phase D: tint wall outlines by ring orientation in 3D mode. Floor
// rings get a slightly cooler amber; ceiling rings a slightly warmer
// reddish amber; wall rings stay TOPO_WALL_COLOR. Subtle enough not
// to scream "different mineral", strong enough to read floor / wall /
// ceiling at a glance once you know what you're looking at.
const TOPO_WALL_COLOR_FLOOR = '#A85820';      // cooler amber
const TOPO_WALL_COLOR_CEILING = '#E8782C';    // warmer amber
const TOPO_CRYSTAL_CAP_FRAC = 0.85;   // crystals can fill at most this fraction of a cell's radius
const TOPO_WALL_STROKE_PX = 2;        // bare wall stroke width
const TOPO_WALL_STROKE_MAX_PX = 10;   // cell stroke width ceiling when a crystal sits on the wall
const TOPO_ZOOM_MIN = 0.3;
const TOPO_ZOOM_MAX = 6.0;
const TOPO_ZOOM_STEP = 1.25;          // one click / wheel tick multiplies by this
let _topoZoom = 1.0;                  // multiplier applied to mmToPx in the renderer
// Pan offsets — added to (cx, cy) so the user can drag the vug
// around the canvas. Set by the pan drag handlers in topoEnsureWired.
let _topoPanX = 0;
let _topoPanY = 0;
// Drag state. Drag starts on mousedown over a non-crystal area and
// ends on mouseup (or mouseleave). Document-level handlers are
// attached only while a drag is in flight so they don't interfere
// with other UI when idle.
let _topoDragging = false;
let _topoDragStartClientX = 0;
let _topoDragStartClientY = 0;
let _topoDragOriginPanX = 0;
let _topoDragOriginPanY = 0;
const TOPO_DRAG_THRESHOLD_PX = 4;     // movement before drag starts (lets clicks still fire)
// Canvas lives inside a stage that's this multiple of the wrap's size.
// The extra area gives 3D-rotated content room to extend past the
// visible window without clipping against the canvas buffer edge.
// MUST match the CSS width/height percentages on .topo-canvas-stage.
const TOPO_STAGE_SCALE = 2;
// Camera drag mode. 'default' = current 2D hit-test-aware behavior
// (drag on non-crystal pans; click on crystal tooltips). 'rotate' =
// drag from anywhere rotates the 3D tilted canvas. 'pan' = drag from
// anywhere pans (ignores hit-test so user can drag even when starting
// over a crystal). Mode buttons are in the .topo-camera-ctrls cluster
// next to the play button; clicking an already-active button returns
// to 'default'.
let _topoDragMode = 'default';
// _topoView3D is derived: true iff _topoDragMode === 'rotate'. Kept
// around as a variable because render/hit-test still read it.
let _topoView3D = false;
// Phase C v1+: 2D mode can show either the aggregate ring (every
// crystal across every ring projected to a single slice — the post-
// scatter default) or one specific ring index. `'aggregate'` ⇄ ints
// 0..ring_count-1. The stepper buttons in `.topo-slice-ctrls` cycle
// through them. Hidden in 3D mode (where every ring is rendered
// stacked anyway) via `body.topo-view-3d` CSS.
let _topoActiveSlice: number | 'aggregate' = 'aggregate';
let _topoTiltX = 0;                   // pitch (viewer above/below)
let _topoTiltY = 0;                   // yaw   (viewer left/right of disc)
const TOPO_TILT_X_MAX = Math.PI / 2 - 0.05;   // don't flip past vertical
// Cache of inclusion-dot hitboxes built each render. Hover checks
// this first so the tooltip shows the enclosed crystal instead of
// falling through to the host's wall cell.
const _topoInclusions = [];

// ---- Selective-highlight state (TASK-BRIEF-TOPO-HIGHLIGHT) -----------
// A highlight "target" narrows the map: matching crystals render at
// full opacity, non-matching crystals ghost to 25%, wall and scale
// stay opaque. Target shape is { type: 'mineral' | 'class', value: str }
// or null. Canvas hover sets _topoHoverTarget (transient), legend hover
// sets _topoLegendHoverTarget (transient, lower priority than canvas),
// clicks toggle _topoLockTarget (persistent). Effective target = lock
// if set, else canvas hover, else legend hover. When null → no ghosting.
const TOPO_GHOST_ALPHA = 0.25;
let _topoHoverTarget = null;
let _topoLegendHoverTarget = null;
let _topoLockTarget = null;

function topoEffectiveTarget() {
  return _topoLockTarget || _topoHoverTarget || _topoLegendHoverTarget;
}

// Does the given mineral match the active highlight target?
// With no active target, everything matches (no ghosting).
function topoMineralHighlighted(mineral) {
  const t = topoEffectiveTarget();
  if (!t) return true;
  if (t.type === 'mineral') return t.value === mineral;
  if (t.type === 'class') {
    const spec = MINERAL_SPEC[mineral];
    return !!(spec && spec.class === t.value);
  }
  return false;
}

// Alpha multiplier for a given mineral under the current highlight.
function topoAlphaFor(mineral) {
  return !topoEffectiveTarget() || topoMineralHighlighted(mineral)
    ? 1.0 : TOPO_GHOST_ALPHA;
}

function topoSetHoverTarget(target) {
  if (JSON.stringify(_topoHoverTarget) === JSON.stringify(target)) return;
  _topoHoverTarget = target;
  topoRender();
}
function topoSetLegendHoverTarget(target) {
  if (JSON.stringify(_topoLegendHoverTarget) === JSON.stringify(target)) return;
  _topoLegendHoverTarget = target;
  topoRender();
}
function topoToggleLockTarget(target) {
  // null target → clear lock. Same as current lock → toggle off.
  // Different target → switch lock.
  if (!target) { _topoLockTarget = null; }
  else if (_topoLockTarget
           && _topoLockTarget.type === target.type
           && _topoLockTarget.value === target.value) {
    _topoLockTarget = null;
  } else {
    _topoLockTarget = target;
  }
  topoRender();
}

// The 12-class order from the topo palette in the brief. Used by the
// legend. We render all 12 even if not all present in the current run so
// the color vocabulary is visible.
const TOPO_CLASS_ORDER = [
  'oxide', 'carbonate', 'arsenate', 'sulfide', 'uranium', 'phosphate',
  'hydroxide', 'molybdate', 'silicate', 'halide', 'native', 'sulfate',
];

function topoActiveSim() {
  // Prefer the simulator whose mode is currently on-screen. Without this
  // a stale sim from a previous mode (e.g. randomSim from a Quick Play
  // before switching to Simulation) wins and the topo shows stale data.
  const mode = (typeof currentGameMode === 'string') ? currentGameMode : null;
  if (mode === 'fortress' && typeof fortressSim !== 'undefined' && fortressSim) return fortressSim;
  if (mode === 'idle'     && typeof idleSim     !== 'undefined' && idleSim)     return idleSim;
  if (mode === 'random'   && typeof randomSim   !== 'undefined' && randomSim)   return randomSim;
  if (mode === 'legends'  && typeof legendsSim  !== 'undefined' && legendsSim)  return legendsSim;
  // Fallback: any sim at all.
  if (typeof fortressSim !== 'undefined' && fortressSim) return fortressSim;
  if (typeof idleSim !== 'undefined' && idleSim) return idleSim;
  if (typeof randomSim !== 'undefined' && randomSim) return randomSim;
  if (typeof legendsSim !== 'undefined' && legendsSim) return legendsSim;
  return null;
}

function topoClassColor(mineral) {
  const entry = MINERAL_SPEC[mineral];
  return (entry && entry.class_color) || TOPO_WALL_COLOR;
}

// Legacy `topoBuildLegend()` and `_wireTopoLegendEvents()` lived here.
// They built the class-swatch legend and drove hover/click highlight
// from a separate "classes" details element below the topo strip.
// Removed in favor of the fortress-status sigma panel doing both jobs:
// per-class swatches sit in each group's <summary>, and hover/click
// delegation is wired in `_wireFortressSigmaEvents`. See the post-
// 2026-05 retire-classes-tab commit for the rationale.

// Resize the canvas backing store to match its CSS size so the line is
// crisp on any window width. Called on each render; cheap if unchanged.
//
// IMPORTANT: uses clientWidth/clientHeight (CSS layout box, unaffected
// by CSS transforms) rather than getBoundingClientRect() (which returns
// the transformed visual box). With the 3D tilt feature, using rect.width
// creates a positive-shrink feedback loop: each render reads a smaller
// transformed rect, writes it to canvas.width, flex layout shrinks the
// container, next rect is even smaller. clientWidth breaks that cycle
// because it's the pre-transform layout size.
function _topoResize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { cssW, cssH, dpr };
}

// Cell i maps to an angle around the vug. 0 starts at the top (12 o'clock)
// and increases clockwise so left-right hover motion feels natural.
function _topoAngleFor(i, N) {
  return -Math.PI / 2 + (i / N) * 2 * Math.PI;
}

// ─── Habit-driven edge textures ──────────────────────────────────────
// Maps each crystal habit string to a texture token. Missing entries
// fall through to 'smooth' (the existing Bezier — no visible change).
// Populated incrementally per stage. See
// proposals/PROPOSAL-EDGE-TEXTURES.md.
