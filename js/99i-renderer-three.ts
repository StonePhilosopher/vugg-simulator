// ============================================================
// js/99i-renderer-three.ts — Three.js mesh renderer (Phase E1 scaffolding)
// ============================================================
// PROPOSAL-3D-TOPO-VUG Tier 2 / "Phase E" of the 3D vision plan. The
// canvas-vector renderer in 99e- is honest 3D over honest data; this
// module replaces the projection step with a real WebGL scene driven
// by Three.js so the renderer can layer real lighting, real meshes,
// and inside-out flythrough on top of the same wall_state data.
//
// Phase E1 (this file): scaffolding only. Builds the scene/camera/lights
// and renders the cavity as a wireframe sphere so we can verify the
// wiring end-to-end before committing to mesh generation. Crystals and
// per-cell wall geometry land in E2/E3.
//
// Loading semantics: Three.js arrives via a CDN <script> tag in
// index.html; THREE becomes a global before this bundle runs. If the
// CDN is blocked (file://, offline, network blip) THREE stays
// undefined and topoRender's branch falls through to the canvas-vector
// path — every feature here gates on a typeof check first so the page
// never throws at boot.
//
// Mode toggle: _topoUseThreeRenderer is the single source of truth.
// Wired to the ⬚ button in .topo-camera-ctrls. Forces drag mode to
// 'rotate' on enable so dragging actually orbits the scene; the
// existing _topoTiltX/_topoTiltY/_topoZoom globals drive the camera.

let _topoUseThreeRenderer = false;

// Lazy-init handle. Holds { renderer, scene, camera, cavity, lights }.
// Built on first call to _topoRenderThree once the canvas is mounted.
let _topoThreeState: any = null;

// Did the CDN fail? If true, the toggle button stays disabled and
// topoRender's branch never enters the Three.js path. Only set on the
// first enable attempt — the script tag's async load might still be
// in flight at boot.
let _topoThreeUnavailable = false;

function _topoThreeAvailable(): boolean {
  return typeof THREE !== 'undefined' && THREE && THREE.WebGLRenderer;
}

// One-time init. Re-uses the WebGL canvas the HTML scaffolds in topo-
// canvas-stage. Returns null if Three.js isn't loaded — caller falls
// through to the canvas-vector path.
function _topoInitThree(canvas: HTMLCanvasElement): any {
  if (_topoThreeState) return _topoThreeState;
  if (!_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    return null;
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor(0x050504, 1.0);

  const scene = new THREE.Scene();

  // Camera: perspective with a focal length that mirrors the
  // canvas-vector renderer's `F = 1200` so the apparent zoom matches
  // when the user toggles between modes. fov derived from the wrap's
  // aspect ratio at first render in _topoSyncThreeSize.
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  camera.position.set(0, 0, 600);
  camera.lookAt(0, 0, 0);

  // Lighting: ambient fills shadow side so the wireframe stays visible
  // even on the back of the cavity; directional acts as the "opening"
  // of the geode lighting the front face. Intensity tuned for a dim
  // cavity vibe rather than studio-bright.
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffe6c0, 0.9);
  directional.position.set(150, 300, 400);
  scene.add(directional);

  // Cavity placeholder: wireframe sphere. E2 replaces this with a real
  // mesh built from wall.rings — for E1 just enough geometry to prove
  // the camera + lighting + canvas pipeline is wired correctly.
  const cavityGeom = new THREE.SphereGeometry(100, 32, 16);
  const cavityMat = new THREE.MeshStandardMaterial({
    color: 0xd2691e,
    wireframe: true,
    roughness: 0.85,
    metalness: 0.05,
  });
  const cavity = new THREE.Mesh(cavityGeom, cavityMat);
  scene.add(cavity);

  _topoThreeState = { renderer, scene, camera, cavity, ambient, directional };
  return _topoThreeState;
}

// Sync the renderer's drawing-buffer size to the canvas's CSS size and
// keep the camera aspect in sync. Called every render — cheap when
// nothing changed (Three.js no-ops setSize when dims match).
function _topoSyncThreeSize(state: any, canvas: HTMLCanvasElement) {
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
  const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
  state.renderer.setSize(cssW, cssH, false);
  state.camera.aspect = cssW / cssH;
  state.camera.updateProjectionMatrix();
}

// Replace the placeholder sphere's radius with one derived from the
// current wall state, so the cavity in Three.js mode roughly matches
// the canvas-vector mode's apparent size. Cheap geometry rebuild — we
// don't yet care about per-ring detail (that's E2).
function _topoUpdateCavityForWall(state: any, wall: any) {
  if (!wall || !wall.meanDiameterMm) return;
  const rPx = (wall.meanDiameterMm() / 2) * 4;  // arbitrary mm→world-unit scale
  const target = state.cavity;
  const prev = target.geometry;
  const next = new THREE.SphereGeometry(rPx, 48, 24);
  target.geometry = next;
  if (prev && prev.dispose) prev.dispose();
}

// Drive the camera from the existing tilt/zoom globals so toggling
// between canvas-vector and Three.js modes preserves the user's view.
// camera orbits a fixed lookAt(0,0,0) at a radius proportional to the
// cavity size + zoom.
function _topoApplyCameraFromTilt(state: any, wall: any) {
  const r0 = wall && wall.meanDiameterMm ? wall.meanDiameterMm() : 50;
  const baseRadius = r0 * 4 * 3.0;  // 3× cavity radius gives a comfortable framing
  const radius = baseRadius / Math.max(0.2, _topoZoom);
  // Yaw around Y, then pitch around X — same convention as
  // _topoProject3D so the user's drag input behaves identically.
  const cy = Math.cos(_topoTiltY), sy = Math.sin(_topoTiltY);
  const cx = Math.cos(_topoTiltX), sx = Math.sin(_topoTiltX);
  // Start with camera on +Z, then apply (X-pitch, Y-yaw) to its position.
  const camX = sy * cx * radius;
  const camY = -sx * radius;
  const camZ = cy * cx * radius;
  state.camera.position.set(camX, camY, camZ);
  state.camera.up.set(0, 1, 0);
  state.camera.lookAt(0, 0, 0);
}

// Public render entry. Called from topoRender's branch when
// _topoUseThreeRenderer is true. Lazily inits on first call; renders
// the scene every frame the wrapper invokes us. Returns true on
// success so topoRender can short-circuit; false (=> fallback) when
// Three.js is unavailable or the canvas hasn't mounted yet.
function _topoRenderThree(sim: any, wall: any): boolean {
  const canvas = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!canvas) return false;
  if (!_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    return false;
  }
  const state = _topoInitThree(canvas);
  if (!state) return false;
  _topoSyncThreeSize(state, canvas);
  _topoUpdateCavityForWall(state, wall);
  _topoApplyCameraFromTilt(state, wall);
  state.renderer.render(state.scene, state.camera);
  return true;
}

// Show/hide the WebGL canvas vs the canvas-2D canvas. Called by both
// the toggle button and topoRender (so an off→on→off cycle leaves the
// DOM in a coherent state regardless of which path triggered the
// change).
function _topoSyncThreeCanvasVisibility() {
  const c2 = document.getElementById('topo-canvas') as HTMLCanvasElement | null;
  const c3 = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!c2 || !c3) return;
  if (_topoUseThreeRenderer) {
    c3.style.display = 'block';
    c2.style.visibility = 'hidden';  // keep layout but don't paint
  } else {
    c3.style.display = 'none';
    c2.style.visibility = '';
  }
}

// Toggle button handler — wired in index.html to the ⬚ button. Flips
// the renderer tier and forces drag-mode to 'rotate' on enable so
// clicking once and dragging immediately orbits the scene. Disabled
// when Three.js failed to load (CDN blocked / offline file://).
function topoToggleThreeRenderer() {
  if (!_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    const btn = document.getElementById('topo-three-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.title = 'Three.js renderer unavailable (CDN blocked or offline)';
      btn.style.opacity = '0.4';
    }
    return;
  }
  _topoUseThreeRenderer = !_topoUseThreeRenderer;
  const btn = document.getElementById('topo-three-btn');
  if (btn) (btn as HTMLElement).style.color = _topoUseThreeRenderer ? '#f0c050' : '';
  // Force rotate mode on enable so the existing pointer handlers
  // already update _topoTiltX/_topoTiltY — the Three camera reads
  // those globals every render. On disable, leave drag mode untouched
  // (user might want to keep orbit mode on the canvas-vector path).
  if (_topoUseThreeRenderer && typeof topoSetDragMode === 'function'
      && _topoDragMode !== 'rotate') {
    topoSetDragMode('rotate');
  }
  _topoSyncThreeCanvasVisibility();
  topoRender();
}
