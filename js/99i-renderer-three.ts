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
//
// v65 (May 2026): Three.js mode is the DEFAULT now. The canvas-vector
// 2D path is still reachable via the toggle button for users on
// hardware that can't run WebGL or for the 'topo strip' aesthetic;
// boot path expects _topoUseThreeRenderer=true and falls back to 2D
// gracefully if Three.js is unavailable (CDN blocked, file://, etc.).

let _topoUseThreeRenderer = true;
// Diagnostic override for the production Cartesian cavity renderer. The
// scientific authority itself is fixed at zero-isovalue 48^3 since v266;
// query/debug switches may force a truthful fallback or comparison view but
// cannot change chemistry, anchors, booked volume, or model resolution.
let _topoMarchingCubesCavityOverride: boolean | null = null;
let _topoMarchingCubesResolutionOverride: number | null = null;
// Has the default-on initialization run yet? On the FIRST topoRender
// where Three.js is actually available, we force drag mode to 'rotate'
// and color the toggle button. Done as one-shot so subsequent renders
// don't keep clobbering user-driven mode changes.
let _topoThreeDefaultApplied = false;

// Maximum supported ring count for the polar-aware cavity clip. Sized
// well above the simulator's default (16) and the practical upper bound
// for 3D scenarios. Overflows fall back to the spherical bound. Must
// match the GLSL array size in _applyCavityClip.
const _MAX_CLIP_RINGS = 32;

// Lazy-init handle. Holds { renderer, scene, camera, cavity, lights }.
// Built on first call to _topoRenderThree once the canvas is mounted.
let _topoThreeState: any = null;

// Did the CDN fail? If true, the toggle button stays disabled and
// topoRender's branch never enters the Three.js path. Only set on the
// first enable attempt — the script tag's async load might still be
// in flight at boot.
let _topoThreeUnavailable = false;
let _topoThreeInitializationFailure: string | null = null;
const _CAVITY_R32F_PROBE_CACHE = new WeakMap<object, any>();

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
  let renderer: any;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch (error) {
    _topoThreeInitializationFailure = error instanceof Error
      ? error.message : String(error || 'webgl-initialization-failed');
    return null;
  }
  _topoThreeUnavailable = false;
  _topoThreeInitializationFailure = null;
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

  // Lighting (R1, 2026-09-05 — see the LIGHTING RIG section below). The
  // ambient is a floor so the shadow side never clips to black; the
  // directional is the shadow-casting KEY, re-aimed every frame from the
  // camera frame by _topoLightingSyncKey (its target must live in the scene
  // for the shadow camera to follow the orbit aim). The image-based
  // environment, tone mapping and shadow map are installed by
  // _topoInstallLightingRig once the state object exists; if that fails
  // (no PMREM support, lost context) the two lights fall back to the
  // pre-R1 intensities (0.55 / 0.9) and the picture is the old one.
  const ambient = new THREE.AmbientLight(0xffffff, LIGHTING_MOODS.cave.ambient);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(LIGHTING_MOODS.cave.keyColor, LIGHTING_MOODS.cave.key);
  directional.position.set(150, 300, 400);
  scene.add(directional);
  scene.add(directional.target);

  // Cavity mesh — populated by _topoBuildCavityGeometry from wall.rings
  // on the first _topoRenderThree call once a sim exists. Empty geometry
  // here so the scene has something to add to scene.children before
  // wall data arrives. DoubleSide so the user can see the cavity from
  // both inside (geode flythrough) and outside (the view E2 ships
  // with). Vertex colors carry orientation + water-state tints.
  // R6 specimen view: the cut uniforms are shared by the cavity material (below), the rind and
  // every crystal material (through clipUniforms). Plain uniform objects — no allocation the
  // guided-tutorial receipt could see.
  const specimenCut = _specimenCutUniforms();
  const cavityGeom = new THREE.BufferGeometry();
  const cavityMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.BackSide,    // only render the cavity's interior face
                              // — the user is conceptually peering INTO
                              // a hollow geode. BackSide hides the outer
                              // hemisphere from the camera so crystals
                              // on the near interior wall stay visible.
    flatShading: false,
    transparent: true,
    opacity: 0.40,            // translucent so crystals on the far
                              // interior wall stay readable through
                              // the near wall. E4 polish: switch to
                              // opaque + camera-inside flythrough mode.
  });
  // W-K V1b: shared uniform objects for the genesis-relief albedo AO (js/99i
  // _applyWallReliefAO). The arch-change block in _topoSyncCavityMesh mutates these
  // in place per scenario, so the swap needs no recompile. Seed with the scallops
  // family at strength 0 (no effect) until the first cavity sync assigns the real
  // architecture — avoids a null sampler bind on the first frame.
  cavityMat.userData.reliefAO = {
    uReliefAO: { value: (typeof _wallReliefAOMap === 'function' ? _wallReliefAOMap('scallops') : null) },
    uReliefAORepeat: { value: new THREE.Vector2(5, 5) },
    uReliefAOAmt: { value: 0 },
    uWallMaterialSpaceEnabled: { value: 0 },
    uWallMatrixScale: { value: new THREE.Vector2(0.05, 0.05) },
    uWallReliefScale: { value: new THREE.Vector2(0.1, 0.1) },
    // R5 rock: grain normal map (object-mm scale), relief/AO strengths, roughness base, stain
    uWallGrain: { value: (typeof _wallGrainNormalMap === 'function' ? _wallGrainNormalMap() : null) },
    uWallGrainScale: { value: new THREE.Vector2(1 / 9, 1 / 9) },   // a 9 mm tile: 0.75 mm grains (sucrosic dolomite, micrite clots)
    uWallGrainAmt: { value: 0.7 },
    uWallReliefAmt: { value: 1.0 },
    uWallStainAmt: { value: 0.25 },
    uWallStainScale: { value: 1 / 25 },
  };
  cavityMat.userData.specimenCut = specimenCut;
  if (typeof _applyWallReliefAO === 'function') _applyWallReliefAO(cavityMat);
  const cavity = new THREE.Mesh(cavityGeom, cavityMat);
  cavity.renderOrder = 0;     // paint cavity first; crystals layer on top
  // R1: the wall RECEIVES the crystals' shadows (the contact darkening that
  // makes a druse read as relief) but never casts — the key light must reach
  // the interior through the near wall from the orb view, and from inside the
  // wall is behind the viewer anyway.
  cavity.receiveShadow = true;
  cavity.castShadow = false;
  // Exclude the cavity from raycaster intersections — bare-wall
  // hovers in Three mode don't get a tooltip (parity with the
  // canvas-vector `_topoView3D` short-circuit), only crystal hits do.
  cavity.raycast = function() {};
  scene.add(cavity);

  // Crystal group — one mesh per Crystal, anchored at the cell's
  // surface position and oriented along the substrate normal. Cleared
  // and rebuilt by _topoSyncCrystalMeshes whenever the crystal-set
  // signature changes (new nucleations, growth steps, dissolutions).
  // Subgroup of `scene` so render-order stays simple.
  const crystals = new THREE.Group();
  crystals.name = 'crystals';
  scene.add(crystals);

  // Track the geometry signature so we only rebuild when it'd actually
  // change (ring_count, cells_per_ring, dissolution edits, water level).
  // Cheap regeneration is fine but skipping the work entirely is
  // cheaper at 60 fps.
  _topoThreeState = {
    renderer, scene, camera, cavity, crystals, ambient, directional,
    cavitySig: '',
    crystalsSig: '',
    // WALL DISPLAY (2026-07-06): 0 solid (default contract) · 1 translucent
    // shell (druse-portrait view) · 2 hidden. Cycled by topoToggleWallDisplay;
    // composed with insideMode in _topoApplyWallDisplay.
    wallDisplay: 0,
    // Cache geometries per habit shape — many crystals can share the
    // same primitive geometry, only the per-mesh transform differs.
    geomCache: new Map<string, any>(),
    // Shared uniforms for the cavity-clip shader injection. Crystal
    // materials reference these directly so updating the cavity hull
    // radius (when the cavity rebuilds) immediately reflects in every
    // crystal's clip plane. The default radius is huge so the first
    // frame before the cavity has been built doesn't clip anything.
    // Shared uniforms for the cavity-clip shader injection. Two tiers:
    //   * uVugCellRadii — DataTexture (cellsPerRing × ringCount, R-float)
    //     of every cell's wall radius. The fragment shader maps its
    //     world-space (phi, theta) to a UV on this texture, samples,
    //     and discards fragments past the LOCAL cell radius. This is
    //     what stops crystal corners and tilted bodies from poking
    //     into the host rock when the cavity is asymmetrically eroded.
    //   * uVugRadiiByRing — fallback per-ring max array. Used when the
    //     texture isn't yet built (first frame before cavity exists)
    //     or when the float-texture path is unsupported on this driver.
    //   * uVugRadius — global max distance, ultimate fallback.
    clipUniforms: {
      uVugRadius: { value: 1e6 },
      uVugCenter: { value: new THREE.Vector3(0, 0, 0) },
      uVugRingCount: { value: 0 },
      uVugRadiiByRing: { value: new Float32Array(_MAX_CLIP_RINGS) },
      uVugCellRadii: { value: null as any },  // THREE.DataTexture
      uVugCellTexW: { value: 0 },  // = N (cellsPerRing)
      uVugCellTexH: { value: 0 },  // = ringCount
      // Tranche 3 Cartesian clip. Mode 0 is the canonical polar path;
      // mode 1 samples the exact immutable field snapshot paired with the MC
      // wall. A mixed wall/clip pair is never installed.
      uCavityClipMode: { value: 0 },
      uCavityField: { value: null as any },
      uCavityFieldDimensions: { value: new THREE.Vector3(1, 1, 1) },
      uCavityFieldWorldScale: { value: new THREE.Vector3(1, 1, 1) },
      uCavityFieldWorldBias: { value: new THREE.Vector3(0, 0, 0) },
      uCavityFieldIsovalue: { value: 0 },
      // === HELIX-OVERLAY-FORK ADDITION (v19) =========================
      // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
      // breadcrumb. Per-fragment "helix skin" on crystal materials:
      // each surface point computes its own age relative to the
      // helicoid leading edge AT THAT Y, so the crystal is revealed
      // segment-by-segment along its height as the spiral sweeps
      // past, instead of fading uniformly. Pre-v19 used per-mesh
      // opacity (whole crystal fades together), which the boss
      // flagged as not matching the sweep visually. Updated by the
      // helix overlay's per-frame tick (uHelixEnabled = 0 when the
      // overlay is off, in which case the shader short-circuits).
      uHelixEnabled: { value: 0 },
      uHelixSweep: { value: 0 },
      uHelixYCenter: { value: 0 },
      uHelixYSpan: { value: 1 },
      uHelixNTurns: { value: 1 },
      uHelixFade: { value: Math.PI / 2 },
      // === END HELIX-OVERLAY-FORK ADDITION ===========================
      // R6 specimen view — the ragged cut (see the SPECIMEN VIEW section); the swath
      // materials test it per fragment, the wall and the rind through their own injections.
      uSpecimenCut: specimenCut.uSpecimenCut,
      uSpecimenCutN: specimenCut.uSpecimenCutN,
      uSpecimenCutU: specimenCut.uSpecimenCutU,
      uSpecimenCutV: specimenCut.uSpecimenCutV,
      uSpecimenCutAmp: specimenCut.uSpecimenCutAmp,
      uSpecimenCutSeed: specimenCut.uSpecimenCutSeed,
    },
  };
  // R1 lighting rig: environment map, tone mapping, shadow map (cave mood is
  // the process-view default, decision D5). Needs the renderer + state, so it
  // runs here rather than beside the lights above.
  _topoInstallLightingRig(_topoThreeState, 'cave');
  // R2 optics rig: transmission tier on desktop, alpha (Depth-A) on mobile or when the
  // lighting rig fell back. Materials read the tier at build time (buildCrystalMaterial);
  // the step-down gate can move the live scene to alpha in place (_topoOpticsApplyTier).
  _topoOpticsInstallRig(_topoThreeState);
  // A lost WebGL context invalidates both the lazy Three.js upload and the raw
  // capability probe. Keep the Cartesian wall/clip pair fail-closed until the
  // restored context has independently passed the probe and upload receipt.
  canvas.addEventListener('webglcontextlost', (event: Event) => {
    event.preventDefault();
    const state = _topoThreeState;
    if (!state || state.renderer !== renderer) return;
    _topoHandleCavityContextLost(state);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    const state = _topoThreeState;
    if (!state || state.renderer !== renderer) return;
    _topoResetCavityFieldFailures(state);
    state.cavityFieldFallbackReason = null;
    state.cavityFieldCapabilityReceipt = null;
    state.cavitySig = '';
    state.crystalsSig = '';
    if (state.crystals) state.crystals.visible = true;
    // The PMREM environment and the shadow map died with the context; bake
    // the current mood again on the restored one.
    _topoInstallLightingRig(state, (state.lightingRig && state.lightingRig.mood) || 'cave', { rebuild: true });
    if (typeof requestAnimationFrame === 'function' && typeof topoRender === 'function') {
      requestAnimationFrame(() => topoRender());
    }
  });
  return _topoThreeState;
}

// ---------------------------------------------------------------------------
// R1 LIGHTING RIG (2026-09-05) — light like a photograph.
// Visual-realism review §5 R1 (proposals/PROPOSAL-HOSTILE-REVIEW-VISUAL-REALISM-
// 2026-09-04.md) + decisions D4/D5 (§10). The shipped renderer lit every frame
// with one ambient + one directional light — no environment, no shadows, no
// tone mapping — so a MeshPhysicalMaterial had nothing to reflect: 40/40
// photographed frames had a highlight fraction of 0 against a photograph
// median of 0.010 (finding F2). This rig adds the three things a photograph
// of a specimen has:
//   1. an ENVIRONMENT — a procedural room of soft emissive panels baked once
//      through PMREMGenerator into scene.environment. Every PBR face now
//      carries a specular highlight, a Fresnel rim and image-based ambient.
//   2. a SHADOW-CASTING KEY riding the camera frame (upper-left of the viewer,
//      the way a cave is lit from its opening or the photographer's lamp).
//      Its target and orthographic shadow frustum follow the orbit aim in
//      _topoApplyCameraFromTilt, so pan and zoom keep the shadow texels on
//      the subject.
//   3. ACES filmic tone mapping + exposure, so the HDR result compresses the
//      way film does instead of clipping. The inside-cavity "moonlit" feel is
//      an EXPOSURE change; the environment is never removed (§5 R1).
// Two moods (D5): `cave` is the process-view default — a dark rock room, one
// warm key, a faint cool fill from the opening; darkness between readable
// highlights. `studio` is the restrained photographic set the specimen view
// (R6) will ask for; the review's prototype numbers (elmwood cavity highlights
// 0 → 0.003, edges 0.010 → 0.030) were measured with those panels.
// Failure is recorded, never fatal: a renderer that cannot bake the PMREM
// (or has just lost its context) falls back to the pre-R1 two-light look and
// says why in state.lightingRig.reason, which tools/photo-rig.mjs prints.
// Performance (D4 spirit): the shadow map is 2048² on desktop, 1024² on the
// mobile profile the surface-growth budget already recognises, and a measured
// gate steps it down (2048 → 1024 → 512 → off) after four consecutive slow
// renders. Render-only: no simulator consumer, no strip testimony.
// ---------------------------------------------------------------------------
type _LightingMood = 'cave' | 'studio';
interface _LightingPanel { w: number; h: number; color: number; intensity: number; pos: [number, number, number]; }
interface _LightingMoodSpec {
  ambient: number;        // AmbientLight floor (the environment supplies the real ambient)
  key: number;            // DirectionalLight intensity (physical lights: lux-like)
  keyColor: number;
  exposure: number;       // toneMappingExposure outside the cavity
  insideExposure: number; // × when the camera is inside (the wall goes opaque and the scene darkens)
  room: number;           // colour of the room shell the panels sit in (what dark faces reflect)
  panels: _LightingPanel[];
}
const LIGHTING_MOODS: Record<_LightingMood, _LightingMoodSpec> = {
  // Process view. A cave photographed by lamp: one warm key, a cool faint
  // skylight fill from the opening, the barest rim; the room is dark rock so
  // the reflections carry darkness between the highlights (D5: "moonlit
  // darkness and readable specular highlights are compatible").
  // Why the source is SMALL and INTENSE: a glass face reflects ~4 % of what it
  // mirrors (F0 of quartz/calcite), so a white highlight needs a source ≥ 25×
  // the diffuse white level — a lamp or a flash tube, not a softbox. A large
  // soft panel gives the broad grey "windows" on faces; the small hot one gives
  // the sparkle a druse shows in every photograph. The PMREM blurs the lamp by
  // roughness on its own, so a rough face sees a sheen and a polished one a
  // glint — the environment does not decide lustre, R2's materials do.
  cave: {
    ambient: 0.10, key: 1.4, keyColor: 0xffe2c4, exposure: 1.0, insideExposure: 1.3,
    room: 0x0c0b0a,
    panels: [
      { w: 5, h: 5, color: 0xffe3c0, intensity: 60, pos: [16, 24, 22] },     // the lamp: small, hot, warm
      { w: 26, h: 20, color: 0xffe8cf, intensity: 3.0, pos: [14, 22, 24] },  // its soft spill (a hand-held softbox)
      { w: 34, h: 24, color: 0xc8d8f4, intensity: 1.2, pos: [-30, 4, 16] },  // cool fill from the opening
      { w: 8, h: 4, color: 0xffffff, intensity: 8, pos: [-6, 12, -32] },     // a thin rim from behind
      { w: 60, h: 60, color: 0x221e1a, intensity: 0.8, pos: [0, -44, 0] },   // floor bounce (dark rock)
    ],
  },
  // Specimen view (R6). Restrained photographic studio: one flash head with a
  // softbox, a cool fill, a rim — the review's prototype geometry with the
  // source split into hot core + soft spill; not the jewellery-advert look.
  studio: {
    ambient: 0.12, key: 1.6, keyColor: 0xfff1dc, exposure: 1.0, insideExposure: 1.0,
    room: 0x1a1816,
    panels: [
      { w: 6, h: 6, color: 0xfff1dc, intensity: 45, pos: [18, 26, 20] },     // flash head
      { w: 30, h: 22, color: 0xfff1dc, intensity: 6.0, pos: [16, 24, 22] },  // its softbox
      { w: 34, h: 26, color: 0xdfe9ff, intensity: 2.5, pos: [-30, 6, 14] },  // cool fill
      { w: 24, h: 12, color: 0xffffff, intensity: 6.0, pos: [-6, 14, -32] }, // rim
      { w: 60, h: 60, color: 0x2a2622, intensity: 1.2, pos: [0, -44, 0] },   // floor bounce
    ],
  },
};
const LIGHTING_SHADOW_MAP_DESKTOP = 2048;
const LIGHTING_SHADOW_MAP_MOBILE = 1024;
const LIGHTING_SHADOW_MAP_MIN = 512;
const LIGHTING_SHADOW_BOUNDS_R0 = 1.6;   // orthographic half-extent of the shadow frustum, × cavity r0
const LIGHTING_KEY_DISTANCE_R0 = 4.0;    // the key sits this many r0 from the aim along its direction
const LIGHTING_SHADOW_BIAS = -0.0004;
const LIGHTING_SHADOW_NORMAL_BIAS = 0.02; // mm — well under the 2 mm crystal floor
// Step-down gate. CPU submission time of renderer.render; GPU stalls surface
// here only when the command queue fills, so this is a coarse guard, not the
// D4 frame-time gate proper. Four consecutive slow renders (the first frame's
// shader compiles are excused by the streak) halve the map, then drop it.
const LIGHTING_SLOW_RENDER_MS = 120;
const LIGHTING_SLOW_RENDER_STREAK = 4;

function _topoLightingIsMobile(): boolean {
  return typeof window !== 'undefined'
    && ((window.innerWidth || 1024) <= SURFACE_GROWTH_MOBILE_MAX_WIDTH_CSS_PX
      || (window.devicePixelRatio || 1) >= SURFACE_GROWTH_MOBILE_MIN_DEVICE_PIXEL_RATIO);
}

// Exposure = the mood's base × the inside factor × 2^EV (the specimen view's ½-stop control).
function _topoLightingExposure(state: any, spec: _LightingMoodSpec, inside: boolean): number {
  const ev = state && state.specimen ? (Number(state.specimen.ev) || 0) : 0;
  return spec.exposure * (inside ? spec.insideExposure : 1) * Math.pow(2, ev);
}

// The procedural room, baked to a prefiltered environment. Radiance panels are
// MeshBasicMaterial colours scaled past 1 (PMREM keeps HDR); the room shell is
// what a dark, rough face reflects. Everything built here is disposed once the
// texture exists — only the PMREM texture stays on the GPU.
function _topoBuildEnvironmentTexture(renderer: any, spec: _LightingMoodSpec): any {
  const room = new THREE.Scene();
  const disposables: any[] = [];
  const shellGeom = new THREE.SphereGeometry(50, 32, 16);
  const shellMat = new THREE.MeshBasicMaterial({ color: spec.room, side: THREE.BackSide });
  room.add(new THREE.Mesh(shellGeom, shellMat));
  disposables.push(shellGeom, shellMat);
  for (const p of spec.panels) {
    const geom = new THREE.PlaneGeometry(p.w, p.h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
    disposables.push(geom, mat);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(room, 0.04).texture;
  } finally {
    pmrem.dispose();
    for (const d of disposables) d.dispose();
  }
}

// Tone mapping and environment changes need every program rebuilt; three
// does not do that for a scene.environment swap on already-compiled materials.
function _topoLightingMarkMaterials(state: any) {
  if (!state || !state.scene) return;
  state.scene.traverse((o: any) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) m.needsUpdate = true;
  });
}

// Shadow casting on the key follows the gate (castShadow toggles the light
// count hash, so three refreshes programs by itself; renderer.shadowMap.enabled
// stays true throughout — toggling THAT needs a manual needsUpdate sweep).
function _topoLightingApplyGate(state: any) {
  const light = state && state.directional;
  const gate = state && state.lightingGate;
  if (!light || !gate) return;
  light.castShadow = !!gate.shadows;
  if (!gate.shadows || !light.shadow) return;
  if (light.shadow.mapSize.x !== gate.shadow_map) {
    light.shadow.mapSize.set(gate.shadow_map, gate.shadow_map);
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
  }
  light.shadow.bias = LIGHTING_SHADOW_BIAS;
  light.shadow.normalBias = LIGHTING_SHADOW_NORMAL_BIAS;
}

function _topoInstallLightingRig(state: any, mood: _LightingMood, opts: { rebuild?: boolean } = {}): any {
  if (!state || !state.renderer || !state.scene) return null;
  const spec = LIGHTING_MOODS[mood] || LIGHTING_MOODS.cave;
  const prior = state.lightingRig;
  if (prior && prior.mood === mood && prior.environment && !opts.rebuild) return prior;
  const renderer = state.renderer;
  const mobile = _topoLightingIsMobile();
  const rig: any = {
    mood, environment: false, reason: null, tone_mapping: 'none', exposure: 1,
    shadows: false, shadow_map: 0, mobile, step_downs: 0,
  };
  // The previous mood's PMREM texture is GPU memory; drop it before baking the next.
  if (state.scene.environment && typeof state.scene.environment.dispose === 'function') {
    try { state.scene.environment.dispose(); } catch (_) { /* a lost context has nothing to free */ }
  }
  state.scene.environment = null;
  try {
    if (!THREE.PMREMGenerator) throw new Error('PMREMGenerator unavailable in this three build');
    state.scene.environment = _topoBuildEnvironmentTexture(renderer, spec);
    rig.environment = true;
  } catch (error) {
    rig.reason = error instanceof Error ? error.message : String(error || 'environment-bake-failed');
    state.scene.environment = null;
  }
  if (rig.environment) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = _topoLightingExposure(state, spec, !!state.insideMode);
    rig.tone_mapping = 'aces';
    rig.exposure = renderer.toneMappingExposure;
    if (state.ambient) state.ambient.intensity = spec.ambient;
    if (state.directional) {
      state.directional.color.set(spec.keyColor);
      state.directional.intensity = spec.key;
    }
    const gate = state.lightingGate || (state.lightingGate = {
      shadows: true,
      shadow_map: mobile ? LIGHTING_SHADOW_MAP_MOBILE : LIGHTING_SHADOW_MAP_DESKTOP,
      slow_renders: 0, step_downs: 0, last_render_ms: null,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    _topoLightingApplyGate(state);
    rig.shadows = gate.shadows;
    rig.shadow_map = gate.shadows ? gate.shadow_map : 0;
    rig.step_downs = gate.step_downs;
  } else {
    // Pre-R1 two-light look, kept as the honest fallback: the picture the old
    // code drew, with the old inside/outside intensities.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = false;
    if (state.ambient) state.ambient.intensity = state.insideMode ? 0.85 : 0.55;
    if (state.directional) {
      state.directional.color.set(0xffe6c0);
      state.directional.intensity = state.insideMode ? 1.2 : 0.9;
      state.directional.castShadow = false;
    }
  }
  state.lightingRig = rig;
  _topoLightingMarkMaterials(state);
  return rig;
}

// Mood switch for the specimen view (R6) and the photo rig's A/B; re-renders.
function _topoApplyLightingMood(state: any, mood: _LightingMood): any {
  const rig = _topoInstallLightingRig(state, mood);
  if (typeof topoRender === 'function') topoRender();
  return rig;
}

// Inside/outside: an exposure change on the rig (the wall goes opaque and the
// scene darkens; the environment stays). Without an environment, the pre-R1
// intensity swap.
function _topoLightingApplyInsideMode(state: any, inside: boolean) {
  const rig = state && state.lightingRig;
  if (rig && rig.environment && state.renderer) {
    const spec = LIGHTING_MOODS[rig.mood as _LightingMood] || LIGHTING_MOODS.cave;
    state.renderer.toneMappingExposure = _topoLightingExposure(state, spec, inside);
    rig.exposure = state.renderer.toneMappingExposure;
    return;
  }
  if (state && state.ambient) state.ambient.intensity = inside ? 0.85 : 0.55;
  if (state && state.directional) state.directional.intensity = inside ? 1.2 : 0.9;
}

// Aim the key from the viewer's upper-left (back·1 + up·0.9 − right·0.6 in the
// camera frame ≈ 42° above, 31° left of the view axis — the classic key), at
// the orbit aim, and size the shadow frustum to the cavity. Called with the
// game camera from _topoApplyCameraFromTilt and with a directly placed camera
// by the photo rig, so a hero frame is lit the way the player would see it.
function _topoLightingSyncKey(state: any, aimX: number, aimY: number, aimZ: number, r0: number) {
  const light = state && state.directional;
  const cam = state && state.camera;
  if (!light || !cam) return;
  cam.updateMatrixWorld(true);
  const e = cam.matrixWorld.elements;
  const rx = e[0], ry = e[1], rz = e[2];      // camera right
  const ux = e[4], uy = e[5], uz = e[6];      // camera up
  const bx = e[8], by = e[9], bz = e[10];     // camera back (toward the viewer)
  let dx = bx + 0.9 * ux - 0.6 * rx;
  let dy = by + 0.9 * uy - 0.6 * ry;
  let dz = bz + 0.9 * uz - 0.6 * rz;
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  const safeR0 = Math.max(5, Number(r0) || 25);
  const dist = safeR0 * LIGHTING_KEY_DISTANCE_R0;
  light.position.set(aimX + dx * dist, aimY + dy * dist, aimZ + dz * dist);
  if (light.target) {
    light.target.position.set(aimX, aimY, aimZ);
    light.target.updateMatrixWorld(true);
  }
  if (light.castShadow && light.shadow && light.shadow.camera) {
    const R = safeR0 * (state.specimen ? SPECIMEN_SHADOW_BOUNDS_R0 : LIGHTING_SHADOW_BOUNDS_R0);
    const far = dist + R * 2;   // reaches the far wall of a lumpy (≤ 1.67·r0) cavity
    const sc = light.shadow.camera;
    if (sc.right !== R || sc.far !== far) {
      sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R;
      sc.near = 0.5; sc.far = far;
      sc.updateProjectionMatrix();
    }
  }
}

// Shadow flags at mesh birth (cheaper than a per-frame traverse; the crystal
// group is rebuilt only when its signature changes).
function _topoLightingTagMesh(obj: any, cast: boolean) {
  if (!obj) return;
  obj.castShadow = !!cast;
  obj.receiveShadow = true;
}

function _topoLightingNoteRenderTime(state: any, ms: number) {
  const gate = state && state.lightingGate;
  const rig = state && state.lightingRig;
  if (!gate || !rig || !rig.environment) return;
  gate.last_render_ms = ms;
  const optics = state.opticsRig;
  const canRetier = !!(optics && optics.tier === 'transmission');
  if (!gate.shadows && !canRetier) return;
  if (ms > LIGHTING_SLOW_RENDER_MS) gate.slow_renders++; else gate.slow_renders = 0;
  if (gate.slow_renders < LIGHTING_SLOW_RENDER_STREAK) return;
  gate.slow_renders = 0;
  gate.step_downs++;
  // Ladder: 2048 → 1024, then transmission → alpha (R2: the extra scene pass is the
  // larger cost, and the alpha tier is the decided low-performance fallback), then
  // 1024 → 512, then shadows off.
  if (gate.shadows && gate.shadow_map > LIGHTING_SHADOW_MAP_MOBILE) gate.shadow_map = gate.shadow_map >> 1;
  else if (canRetier) _topoOpticsApplyTier(state, 'alpha', 'step-down gate: ' + LIGHTING_SLOW_RENDER_STREAK + ' renders over ' + LIGHTING_SLOW_RENDER_MS + ' ms');
  else if (gate.shadows && gate.shadow_map > LIGHTING_SHADOW_MAP_MIN) gate.shadow_map = gate.shadow_map >> 1;
  else gate.shadows = false;
  _topoLightingApplyGate(state);
  rig.shadows = gate.shadows;
  rig.shadow_map = gate.shadows ? gate.shadow_map : 0;
  rig.step_downs = gate.step_downs;
}

// ---------------------------------------------------------------------------
// SPECIMEN VIEW (R6, 2026-09-06 — visual-realism review §5 R6; decisions D3
// "beside the orb" and D5 "restrained studio in the specimen view").
//
// The orb view is the PROCESS view: a translucent shell in a dark room, the
// geology as it happens. A geode is photographed after it is broken open, and
// that is the picture the review's fixed whole-vug photo set holds (doc §10:
// catalog 851 — a Keokuk-type half on a cutting mat — and 1257/1258/1256):
//   * the break is a ragged line, not a saw cut, and it goes AROUND the rim
//     crystals — they stay whole and stand proud of the edge;
//   * the rind is a thick weathered band around the white lining, and its
//     fracture face shows the pale inner band and the brown outer band;
//   * the half rests on a cloth under a soft key, with a contact shadow.
// So the specimen view models a BROKEN geode (a sawn-thunder-egg presentation
// with flat caps is the natural follow-up, not this rung):
//   1. The cut: a plane through the cavity origin whose normal is the camera's
//      forward direction at entry (the opening faces the viewer), with a
//      periodic 1-D value noise around the rim so the edge wanders by
//      ±SPECIMEN_RAG_FRACTION·r0. A world point is cut away when
//      dot(n, p) < amp·rag(θ(p)). The SAME hash runs on the CPU (culling, the
//      fracture band) and in GLSL (the wall, the rind, the coating swaths): an
//      integer hash over uint arithmetic, bit-exact on both sides, so the
//      fracture band meets the discarded edge without a hairline.
//   2. The wall discards per fragment (cavity material); rim crystal BODIES are
//      culled whole by their wall anchor (a crystal is never sawn); instanced
//      coating swaths discard per fragment, with a depth material so the
//      removed half casts no ghost shadow on the cloth.
//   3. The rind: the cavity surface offset outward by rind_mm·(1 ± knob), a
//      weathered lithology skin, discarded by its SOURCE wall position
//      (an attribute) so its edge is exactly the wall's edge.
//   4. The fracture face: every wall triangle the rag crosses contributes one
//      quad from its inner crossing segment to the same segment on the rind
//      (identical lerp factors — exact at both edges); subdivided and roughened
//      across; vertex-coloured pale-inside → brown-outside.
//   5. The stage: a cloth plane at the half's lowest point and a cyclorama
//      behind it, fog for the falloff; the studio mood; the key rides the
//      camera so it lights the opening; a wider shadow frustum for the cloth.
//   6. Exposure in ½-EV stops (☼ button); a post pass (HDR target → ACES →
//      1.5 % grain → gentle vignette) on desktop WebGL2 with float colour
//      buffers, recorded honestly when unavailable. No depth of field: the
//      reference photographs are focus-stacked or stopped down; every one is
//      sharp through the interior, so DoF would be a lie about the subject.
// Everything is allocated on first entry (the guided-tutorial receipt pins
// stream-position ids that shift with the render allocation count — F13).
// Render-only: no simulator consumer, no strip testimony.
// ---------------------------------------------------------------------------
const SPECIMEN_RAG_FRACTION = 0.12;      // break-line wander around the rim, × r0
const SPECIMEN_RAG_LOBES = 6;            // lowest octave: lobes per turn (then 12, 24)
const SPECIMEN_RIND_FRACTION = 0.13;     // rind thickness, × r0 (Keokuk 0.06–0.2; catalog 851 ≈ 0.3)
const SPECIMEN_RIND_MIN_MM = 2.5;
const SPECIMEN_RIND_MAX_MM = 30;
const SPECIMEN_RIND_KNOB = 0.35;         // ± thickness modulation (the lumpy outside)
const SPECIMEN_RIND_KNOB_WAVELENGTH_R0 = 0.45;
const SPECIMEN_RIND_WART = 0.14;         // ± finer modulation (the warty botryoidal skin of a Keokuk geode)
const SPECIMEN_RIND_WART_WAVELENGTH_R0 = 0.11;
const SPECIMEN_RIND_TINT = 0x6b4d36;     // iron-stained weathering mixed into the lithology skin (catalog 851: a brown, warty rind)
const SPECIMEN_RIND_TINT_MIX = 0.7;
const SPECIMEN_RIND_DARKEN = 0.28;       // weathered skin albedo ≈ 0.13 after the lithology map (851: dark brown)
const SPECIMEN_FRACTURE_INNER_LIFT = 0.2;    // the pale lining band: wall colour lifted toward white
const SPECIMEN_FRACTURE_INNER_BAND = 0.18;   // its share of the fracture face (then the rind's brown)
const SPECIMEN_FRACTURE_FRESH = 0.55;    // fracture-face albedo, × the skin colour: under the studio key (irradiance ≈ 3) a
                                         // mid-brown reads at ~0.09 linear (catalog 851's band ≈ sRGB 150/120/100)
const SPECIMEN_FRACTURE_LINING_ALBEDO = 0.32;   // the pale lining band: wall colour lifted, then scaled to an albedo
const SPECIMEN_CUT_TILT_DOWN = 0.8;      // the break faces between the camera and straight up: the half lies on the cloth,
                                         // opening upward, photographed from above (851 frame 1), not a bowl held at the lens
const SPECIMEN_FRACTURE_ROUGH = 0.2;     // fracture relief across the band, × rind_mm
const SPECIMEN_CLOTH_COLOR = 0x2a2825;
const SPECIMEN_CLOTH_SPAN_R0 = 44;
const SPECIMEN_CYCLO_RADIUS_R0 = 22;
const SPECIMEN_CYCLO_HEIGHT_R0 = 22;
const SPECIMEN_FOG_COLOR = 0x0a0908;
const SPECIMEN_FOG_NEAR_R0 = 8;
const SPECIMEN_FOG_FAR_R0 = 34;
const SPECIMEN_SHADOW_BOUNDS_R0 = 3.0;   // the cloth needs the whole contact shadow (cave view: 1.6)
const SPECIMEN_POSE = { tiltX: -0.52, tiltY: 0.42, zoom: 1.4 };    // 30° above, a little to the side, the half filling ~⅔ of the frame
const SPECIMEN_EV_STOPS = [-1, -0.5, 0, 0.5, 1];
const SPECIMEN_GRAIN = 0.015;
const SPECIMEN_VIGNETTE = 0.22;

// ---- the rag noise: one hash, two languages -------------------------------
// uint arithmetic on both sides: JS Math.imul + >>> 0 is exactly GLSL ES 3.00
// unsigned multiplication mod 2^32. Lattice indices are non-negative.
function _specimenHash(i: number, seed: number): number {
  let h = (Math.imul(i >>> 0, 374761393) + Math.imul(seed >>> 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xffffff) / 16777216;
}
// Periodic 1-D value noise around the cut, three octaves (6/12/24 lobes), in [-1, 1].
function _specimenRagNoise(theta: number, seed: number): number {
  let t = theta / (2 * Math.PI);
  t -= Math.floor(t);
  let sum = 0, norm = 0, amp = 1;
  for (let o = 0; o < 3; o++) {
    const P = SPECIMEN_RAG_LOBES << o;
    const x = t * P;
    const i0f = Math.floor(x);
    const f = x - i0f;
    const i0 = i0f | 0;
    const i1 = (i0 + 1) % P;
    const s = f * f * (3 - 2 * f);
    const a = _specimenHash(i0, seed + o * 7919);
    const b = _specimenHash(i1, seed + o * 7919);
    sum += amp * (a + (b - a) * s);
    norm += amp;
    amp *= 0.5;
  }
  return (sum / norm) * 2 - 1;
}
const SPECIMEN_CUT_GLSL_PARS = `
uniform float uSpecimenCut;
uniform vec3 uSpecimenCutN;
uniform vec3 uSpecimenCutU;
uniform vec3 uSpecimenCutV;
uniform float uSpecimenCutAmp;
uniform int uSpecimenCutSeed;
float specimenHash(int i, int seed) {
  uint h = uint(i) * 374761393u + uint(seed) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return float(h & 16777215u) / 16777216.0;
}
float specimenRagNoise(float theta, int seed) {
  float t = theta / 6.28318530718;
  t -= floor(t);
  float sum = 0.0; float norm = 0.0; float amp = 1.0;
  for (int o = 0; o < 3; o++) {
    int P = ${SPECIMEN_RAG_LOBES} << o;
    float x = t * float(P);
    float i0f = floor(x);
    float f = x - i0f;
    int i0 = int(i0f);
    int i1 = (i0 + 1) % P;
    float s = f * f * (3.0 - 2.0 * f);
    float a = specimenHash(i0, seed + o * 7919);
    float b = specimenHash(i1, seed + o * 7919);
    sum += amp * (a + (b - a) * s);
    norm += amp;
    amp *= 0.5;
  }
  return (sum / norm) * 2.0 - 1.0;
}
bool specimenCutAway(vec3 p) {
  if (uSpecimenCut < 0.5) return false;
  float th = atan(dot(p, uSpecimenCutV), dot(p, uSpecimenCutU));
  return dot(p, uSpecimenCutN) < uSpecimenCutAmp * specimenRagNoise(th, uSpecimenCutSeed);
}`;
// The shared uniform objects (created once per Three state in _topoInitThree, before the
// cavity material, and mirrored into clipUniforms for the crystal materials).
function _specimenCutUniforms(): any {
  return {
    uSpecimenCut: { value: 0 },
    uSpecimenCutN: { value: new THREE.Vector3(0, 0, -1) },
    uSpecimenCutU: { value: new THREE.Vector3(1, 0, 0) },
    uSpecimenCutV: { value: new THREE.Vector3(0, 1, 0) },
    uSpecimenCutAmp: { value: 0 },
    uSpecimenCutSeed: { value: 0 },
  };
}
// Inject the cut into a material's shader. `mode` names where the tested position comes from:
//   crystal   — the cavity-clip varying vCavityWorldPos (crystal materials, _applyCavityClip)
//   wall      — vWallMaterialPos, the cavity mesh's object == world position (_applyWallReliefAO)
//   attribute — aSpecimenSrc, the rind's source wall vertex (exact edge match with the wall)
//   world     — its own world-position varying (the swath depth material; instancing-aware)
function _specimenCutInject(shader: any, uniforms: any, mode: string) {
  if (!shader || !uniforms) return;
  for (const k of Object.keys(uniforms)) shader.uniforms[k] = uniforms[k];
  let posExpr = 'vCavityWorldPos';
  if (mode === 'wall') posExpr = 'vWallMaterialPos';
  else if (mode === 'attribute' || mode === 'world') {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vSpecimenSrc;' + (mode === 'attribute' ? '\nattribute vec3 aSpecimenSrc;' : ''),
    );
    if (mode === 'attribute') {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpecimenSrc = aSpecimenSrc;');
    } else {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 _specimenW = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  _specimenW = batchingMatrix * _specimenW;
#endif
#ifdef USE_INSTANCING
  _specimenW = instanceMatrix * _specimenW;
#endif
vSpecimenSrc = ( modelMatrix * _specimenW ).xyz;`,
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpecimenSrc;');
    posExpr = 'vSpecimenSrc';
  }
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + SPECIMEN_CUT_GLSL_PARS);
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {\n  if (specimenCutAway(${posExpr})) discard;`);
}

// ---- the cut in world space (CPU mirror) ----------------------------------
function _specimenCutFromNormal(nx: number, ny: number, nz: number, amp: number, seed: number): any {
  const n = new THREE.Vector3(nx, ny, nz).normalize();
  const helper = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(helper, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { n, u, v, amp: Math.max(0, Number(amp) || 0), seed: (Number(seed) >>> 0) & 0x7fffffff };
}
function _specimenCutSigned(cut: any, x: number, y: number, z: number): number {
  const n = cut.n, u = cut.u, v = cut.v;
  const th = Math.atan2(x * v.x + y * v.y + z * v.z, x * u.x + y * u.y + z * u.z);
  return (x * n.x + y * n.y + z * n.z) - cut.amp * _specimenRagNoise(th, cut.seed);
}
function _specimenCutAway(cut: any, x: number, y: number, z: number): boolean {
  return _specimenCutSigned(cut, x, y, z) < 0;
}
function _specimenApplyCutUniforms(uniforms: any, cut: any, on: boolean) {
  if (!uniforms) return;
  uniforms.uSpecimenCut.value = on ? 1 : 0;
  if (cut) {
    uniforms.uSpecimenCutN.value.copy(cut.n);
    uniforms.uSpecimenCutU.value.copy(cut.u);
    uniforms.uSpecimenCutV.value.copy(cut.v);
    uniforms.uSpecimenCutAmp.value = cut.amp;
    uniforms.uSpecimenCutSeed.value = cut.seed;
  }
}

// 3-D value noise in [-1, 1] for the rind's knobbly thickness (CPU only — the rind's
// outer vertices are built once; the fracture band interpolates them, never re-samples).
function _specimenKnob(x: number, y: number, z: number, wavelength: number, seed: number): number {
  const s = 1 / Math.max(1e-6, wavelength);
  const fx = x * s + 4096, fy = y * s + 4096, fz = z * s + 4096;
  const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
  const tx = fx - ix, ty = fy - iy, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), sz = tz * tz * (3 - 2 * tz);
  const h = (i: number, j: number, k: number) => _specimenHash((i * 73856093) ^ (j * 19349663) ^ (k * 83492791), seed);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c00 = lerp(h(ix, iy, iz), h(ix + 1, iy, iz), sx);
  const c10 = lerp(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), sx);
  const c01 = lerp(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), sx);
  const c11 = lerp(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), sx);
  return lerp(lerp(c00, c10, sy), lerp(c01, c11, sy), sz) * 2 - 1;
}

// A cached greyscale value-noise canvas texture for bump maps (rind knobs, fracture
// grain, the cloth's weave). Null without a 2-D canvas (headless tests).
let _specimenNoiseTex: any = undefined;
function _specimenNoiseTexture(): any {
  if (_specimenNoiseTex !== undefined) return _specimenNoiseTex;
  _specimenNoiseTex = null;
  try {
    if (typeof document === 'undefined' || typeof THREE === 'undefined') return null;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // two octaves, periodic by construction of the lattice (256 = 8 × 32 = 32 × 8)
      const a = _specimenKnob(x / 32, y / 32, 0.5, 1, 11);
      const b = _specimenKnob(x / 8, y / 8, 1.5, 1, 23);
      const v = 128 + 70 * a + 35 * b;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v | 0));
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    _specimenNoiseTex = tex;
  } catch (_) { _specimenNoiseTex = null; }
  return _specimenNoiseTex;
}
function _specimenNoiseTextureRepeat(rx: number, ry: number): any {
  const base = _specimenNoiseTexture();
  if (!base) return null;
  const tex = base.clone();
  tex.repeat.set(rx, ry);
  tex.needsUpdate = true;
  return tex;
}

// ---- the rind: the cavity surface offset outward ---------------------------
// Returns { geometry, outer (Float32Array), src (Float32Array) }. Normals are taken
// outward (the cavity mesh's own point outward — F14 — but the legacy ring mesh may
// wind the other way, so each is flipped toward +p when needed).
function _specimenBuildRindGeometry(cavityGeom: any, rindMm: number, r0: number, seed: number): any {
  const pos = cavityGeom && cavityGeom.attributes && cavityGeom.attributes.position;
  if (!pos || !pos.count) return null;
  const nrm = cavityGeom.attributes.normal;
  const nV = pos.count;
  const outer = new Float32Array(nV * 3);
  const src = new Float32Array(nV * 3);
  const wavelength = Math.max(1, r0 * SPECIMEN_RIND_KNOB_WAVELENGTH_R0);
  for (let i = 0; i < nV; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const pr = Math.sqrt(x * x + y * y + z * z) || 1;
    const px = x / pr, py = y / pr, pz = z / pr;
    let nx = nrm ? nrm.getX(i) : px, ny = nrm ? nrm.getY(i) : py, nz = nrm ? nrm.getZ(i) : pz;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (nx * px + ny * py + nz * pz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    let mx = 0.55 * nx + 0.45 * px, my = 0.55 * ny + 0.45 * py, mz = 0.55 * nz + 0.45 * pz;
    const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    mx /= ml; my /= ml; mz /= ml;
    const t = rindMm * (1 + SPECIMEN_RIND_KNOB * _specimenKnob(x, y, z, wavelength, seed)
      + SPECIMEN_RIND_WART * _specimenKnob(x, y, z, Math.max(0.5, r0 * SPECIMEN_RIND_WART_WAVELENGTH_R0), seed + 31));
    outer[i * 3] = x + mx * t; outer[i * 3 + 1] = y + my * t; outer[i * 3 + 2] = z + mz * t;
    src[i * 3] = x; src[i * 3 + 1] = y; src[i * 3 + 2] = z;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(outer, 3));
  geom.setAttribute('aSpecimenSrc', new THREE.BufferAttribute(src, 3));
  if (cavityGeom.attributes.uv) geom.setAttribute('uv', cavityGeom.attributes.uv.clone());
  if (cavityGeom.index) geom.setIndex(cavityGeom.index.clone());
  geom.computeVertexNormals();
  return { geometry: geom, outer, src };
}

// ---- the fracture face: one quad per wall triangle the rag crosses ---------
// Non-indexed so computeVertexNormals gives flat facets (a fracture is faceted).
function _specimenBuildFractureGeometry(cavityGeom: any, outer: Float32Array, cut: any, rindMm: number, rindColour: any, seed: number): any {
  const pos = cavityGeom && cavityGeom.attributes && cavityGeom.attributes.position;
  if (!pos || !pos.count) return null;
  const col = cavityGeom.attributes.color;
  const index = cavityGeom.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const P: number[] = [], C: number[] = [];
  const ROWS = 3;
  const rough = rindMm * SPECIMEN_FRACTURE_ROUGH;
  const rc = rindColour;
  const s = new Float64Array(3);
  const idx = [0, 0, 0];
  const qx: number[] = [], qy: number[] = [], qz: number[] = [], ox: number[] = [], oy: number[] = [], oz: number[] = [], cr: number[] = [], cg: number[] = [], cb: number[] = [];
  let quads = 0;
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      idx[k] = index ? index.getX(t * 3 + k) : t * 3 + k;
      s[k] = _specimenCutSigned(cut, pos.getX(idx[k]), pos.getY(idx[k]), pos.getZ(idx[k]));
      if (s[k] === 0) s[k] = 1e-9;
    }
    if ((s[0] < 0) === (s[1] < 0) && (s[1] < 0) === (s[2] < 0)) continue;
    qx.length = 0; qy.length = 0; qz.length = 0; ox.length = 0; oy.length = 0; oz.length = 0; cr.length = 0; cg.length = 0; cb.length = 0;
    for (let e = 0; e < 3; e++) {
      const i = idx[e], j = idx[(e + 1) % 3];
      const si = s[e], sj = s[(e + 1) % 3];
      if ((si < 0) === (sj < 0)) continue;
      const tq = si / (si - sj);
      qx.push(pos.getX(i) + (pos.getX(j) - pos.getX(i)) * tq);
      qy.push(pos.getY(i) + (pos.getY(j) - pos.getY(i)) * tq);
      qz.push(pos.getZ(i) + (pos.getZ(j) - pos.getZ(i)) * tq);
      ox.push(outer[i * 3] + (outer[j * 3] - outer[i * 3]) * tq);
      oy.push(outer[i * 3 + 1] + (outer[j * 3 + 1] - outer[i * 3 + 1]) * tq);
      oz.push(outer[i * 3 + 2] + (outer[j * 3 + 2] - outer[i * 3 + 2]) * tq);
      if (col) {
        cr.push(col.getX(i) + (col.getX(j) - col.getX(i)) * tq);
        cg.push(col.getY(i) + (col.getY(j) - col.getY(i)) * tq);
        cb.push(col.getZ(i) + (col.getZ(j) - col.getZ(i)) * tq);
      } else { cr.push(0.85); cg.push(0.82); cb.push(0.78); }
    }
    if (qx.length !== 2) continue;
    // Consistent winding across the band: the face normal (inner edge × across) must point to
    // the open side (−n) for every quad, or the shared-vertex normals average to nothing.
    {
      const e1x = qx[1] - qx[0], e1y = qy[1] - qy[0], e1z = qz[1] - qz[0];
      const e2x = ox[0] - qx[0], e2y = oy[0] - qy[0], e2z = oz[0] - qz[0];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      if (nx * cut.n.x + ny * cut.n.y + nz * cut.n.z > 0) {
        for (const arr of [qx, qy, qz, ox, oy, oz, cr, cg, cb]) { const t0 = arr[0]; arr[0] = arr[1]; arr[1] = t0; }
      }
    }
    quads++;
    // Two rows of ROWS+1 points from the inner edge (row 0) to the outer edge (row ROWS);
    // interior rows are pushed along the cut normal by the knob noise (a rough face).
    const rows: number[][] = [];
    for (let e = 0; e < 2; e++) {
      const row: number[] = [];
      for (let r = 0; r <= ROWS; r++) {
        const f = r / ROWS;
        let x = qx[e] + (ox[e] - qx[e]) * f, y = qy[e] + (oy[e] - qy[e]) * f, z = qz[e] + (oz[e] - qz[e]) * f;
        if (r > 0 && r < ROWS) {
          const d = rough * _specimenKnob(x, y, z, Math.max(0.5, rindMm * 0.45), seed + 101);
          x += cut.n.x * d; y += cut.n.y * d; z += cut.n.z * d;
        }
        // colour across the band: pale lining band, then the rind's brown
        const lift = SPECIMEN_FRACTURE_INNER_LIFT;
        const la = SPECIMEN_FRACTURE_LINING_ALBEDO;
        const ir = (cr[e] + (1 - cr[e]) * lift) * la, ig = (cg[e] + (1 - cg[e]) * lift) * la, ib = (cb[e] + (1 - cb[e]) * lift) * la;
        const w = f < SPECIMEN_FRACTURE_INNER_BAND ? 0 : Math.min(1, (f - SPECIMEN_FRACTURE_INNER_BAND) / 0.3);
        const fr = Math.min(1, rc.r * SPECIMEN_FRACTURE_FRESH), fg = Math.min(1, rc.g * SPECIMEN_FRACTURE_FRESH), fb = Math.min(1, rc.b * SPECIMEN_FRACTURE_FRESH);
        row.push(x, y, z, ir + (fr - ir) * w, ig + (fg - ig) * w, ib + (fb - ib) * w);
      }
      rows.push(row);
    }
    const A = rows[0], B = rows[1];
    for (let r = 0; r < ROWS; r++) {
      const a0 = r * 6, a1 = (r + 1) * 6;
      // triangle (A_r, B_r, B_r+1) and (A_r, B_r+1, A_r+1)
      P.push(A[a0], A[a0 + 1], A[a0 + 2], B[a0], B[a0 + 1], B[a0 + 2], B[a1], B[a1 + 1], B[a1 + 2]);
      C.push(A[a0 + 3], A[a0 + 4], A[a0 + 5], B[a0 + 3], B[a0 + 4], B[a0 + 5], B[a1 + 3], B[a1 + 4], B[a1 + 5]);
      P.push(A[a0], A[a0 + 1], A[a0 + 2], B[a1], B[a1 + 1], B[a1 + 2], A[a1], A[a1 + 1], A[a1 + 2]);
      C.push(A[a0 + 3], A[a0 + 4], A[a0 + 5], B[a1 + 3], B[a1 + 4], B[a1 + 5], A[a1 + 3], A[a1 + 4], A[a1 + 5]);
    }
  }
  if (!quads) return { geometry: null, quads: 0 };
  // Adjacent quads share their crossing points exactly (same edge, same lerp factor, same
  // row) — merge them by quantised position so the normals average across the band and the
  // face reads as one rough surface, not radial strips.
  const keyOf = new Map<string, number>();
  const VP: number[] = [], VC: number[] = [], IDX: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const key = Math.round(P[i] * 1e4) + ',' + Math.round(P[i + 1] * 1e4) + ',' + Math.round(P[i + 2] * 1e4);
    let vi = keyOf.get(key);
    if (vi === undefined) { vi = VP.length / 3; keyOf.set(key, vi); VP.push(P[i], P[i + 1], P[i + 2]); VC.push(C[i], C[i + 1], C[i + 2]); }
    IDX.push(vi);
  }
  const UV: number[] = [];
  const uvScale = 1 / Math.max(1, rindMm * 2);
  for (let i = 0; i < VP.length; i += 3) UV.push((VP[i] * cut.u.x + VP[i + 1] * cut.u.y + VP[i + 2] * cut.u.z) * uvScale, (VP[i] * cut.v.x + VP[i + 1] * cut.v.y + VP[i + 2] * cut.v.z) * uvScale);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(VP, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(VC, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geom.setIndex(IDX);
  geom.computeVertexNormals();
  return { geometry: geom, quads };
}

function _specimenRindColour(): any {
  return new THREE.Color(1, 1, 1).multiplyScalar(SPECIMEN_RIND_DARKEN).lerp(new THREE.Color(SPECIMEN_RIND_TINT), SPECIMEN_RIND_TINT_MIX);
}

// ---- the scene objects -------------------------------------------------------
function _specimenDisposeObject(obj: any) {
  if (!obj) return;
  if (obj.parent) obj.parent.remove(obj);
  if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
  const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
  for (const m of mats) if (m && m.dispose) m.dispose();
  if (obj.customDepthMaterial && obj.customDepthMaterial.dispose) obj.customDepthMaterial.dispose();
}
function _specimenRebuildObjects(state: any) {
  const sp = state.specimen;
  if (!sp) return;
  for (const k of ['rind', 'fracture', 'cloth', 'cyclo']) { _specimenDisposeObject(sp[k]); sp[k] = null; }
  const cavGeom = state.cavity && state.cavity.geometry;
  const rind = _specimenBuildRindGeometry(cavGeom, sp.rind_mm, sp.r0, sp.cut.seed);
  sp.fracture_quads = 0;
  if (!rind) return;
  const litho = state._matrixLitho || 'limestone';
  sp.lithology = litho;
  const rindColour = _specimenRindColour();
  const skin = typeof _matrixSkinTexture === 'function' ? _matrixSkinTexture(litho) : null;
  const rindMat = new THREE.MeshStandardMaterial({
    color: rindColour, map: skin || null, roughness: 0.96, metalness: 0, side: THREE.FrontSide,
  });
  const bump = _specimenNoiseTextureRepeat(8, 4);
  if (bump) { rindMat.bumpMap = bump; rindMat.bumpScale = Math.max(3, sp.rind_mm * 1.2); }
  const cutU = sp.uniforms;
  rindMat.onBeforeCompile = (shader: any) => { _specimenCutInject(shader, cutU, 'attribute'); };
  rindMat.customProgramCacheKey = () => 'vugg-specimen-rind';
  const rindMesh = new THREE.Mesh(rind.geometry, rindMat);
  rindMesh.name = 'specimen-rind';
  rindMesh.castShadow = true; rindMesh.receiveShadow = true;
  rindMesh.raycast = function() {};
  const rindDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  rindDepth.onBeforeCompile = (shader: any) => { _specimenCutInject(shader, cutU, 'attribute'); };
  rindDepth.customProgramCacheKey = () => 'vugg-specimen-rind-depth';
  rindMesh.customDepthMaterial = rindDepth;
  sp.group.add(rindMesh);
  sp.rind = rindMesh;
  // the fracture face
  const frac = _specimenBuildFractureGeometry(cavGeom, rind.outer, sp.cut, sp.rind_mm, rindColour, sp.cut.seed);
  sp.fracture_quads = frac ? frac.quads : 0;
  sp.colours = { rind: [rindColour.r, rindColour.g, rindColour.b].map((v: number) => +v.toFixed(3)), fracture_inner: null, fracture_outer: null };
  if (frac && frac.geometry) {
    const fc = frac.geometry.attributes.color;
    if (fc && fc.count >= 4) {
      sp.colours.fracture_inner = [fc.getX(0), fc.getY(0), fc.getZ(0)].map((v: number) => +v.toFixed(3));
      sp.colours.fracture_outer = [fc.getX(3), fc.getY(3), fc.getZ(3)].map((v: number) => +v.toFixed(3));
    }
    const fracMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0, side: THREE.DoubleSide });
    const fb = _specimenNoiseTextureRepeat(1, 1);
    if (fb) { fracMat.bumpMap = fb; fracMat.bumpScale = Math.max(0.8, sp.rind_mm * 0.25); }
    const fracMesh = new THREE.Mesh(frac.geometry, fracMat);
    fracMesh.name = 'specimen-fracture';
    fracMesh.castShadow = true; fracMesh.receiveShadow = true;
    fracMesh.raycast = function() {};
    sp.group.add(fracMesh);
    sp.fracture = fracMesh;
  }
  // the stage: the cloth at the kept half's lowest point, the cyclorama around it
  let yMin = Infinity;
  for (let i = 0; i < rind.src.length; i += 3) {
    if (_specimenCutAway(sp.cut, rind.src[i], rind.src[i + 1], rind.src[i + 2])) continue;
    if (rind.outer[i + 1] < yMin) yMin = rind.outer[i + 1];
  }
  if (!Number.isFinite(yMin)) yMin = -(sp.r0 + sp.rind_mm);
  const yFloor = yMin - 0.3;
  sp.floor_y = yFloor;
  const span = sp.r0 * SPECIMEN_CLOTH_SPAN_R0;
  const clothMat = new THREE.MeshStandardMaterial({ color: SPECIMEN_CLOTH_COLOR, roughness: 1.0, metalness: 0 });
  const weave = _specimenNoiseTextureRepeat(span / 6, span / 6);
  if (weave) { clothMat.bumpMap = weave; clothMat.bumpScale = 1.2; }
  const clothGeom = new THREE.PlaneGeometry(span, span, 1, 1);
  clothGeom.rotateX(-Math.PI / 2);
  const cloth = new THREE.Mesh(clothGeom, clothMat);
  cloth.name = 'specimen-cloth';
  cloth.position.set(0, yFloor, 0);
  cloth.receiveShadow = true; cloth.castShadow = false;
  cloth.raycast = function() {};
  sp.group.add(cloth);
  sp.cloth = cloth;
  const R = sp.r0 * SPECIMEN_CYCLO_RADIUS_R0, H = sp.r0 * SPECIMEN_CYCLO_HEIGHT_R0;
  const cycloGeom = new THREE.CylinderGeometry(R, R, H, 48, 1, true);
  const cycloMat = new THREE.MeshStandardMaterial({ color: SPECIMEN_CLOTH_COLOR, roughness: 1.0, metalness: 0, side: THREE.BackSide });
  const cyclo = new THREE.Mesh(cycloGeom, cycloMat);
  cyclo.name = 'specimen-cyclorama';
  cyclo.position.set(0, yFloor + H / 2, 0);
  cyclo.receiveShadow = true; cyclo.castShadow = false;
  cyclo.raycast = function() {};
  sp.group.add(cyclo);
  sp.cyclo = cyclo;
}

// Rim crystal bodies are culled whole by their wall anchor; instanced swaths get the
// per-fragment cut (already in their shader) plus a depth material so the removed half
// casts nothing. Only meshes THIS view hid are ever re-shown.
function _specimenSyncCrystals(state: any) {
  const sp = state.specimen;
  if (!sp || !state.crystals) return;
  for (const m of sp.hidden) { if (m.parent) m.visible = true; }
  sp.hidden.clear();
  let culled = 0, kept = 0;
  for (const m of state.crystals.children) {
    if (!m) continue;
    if (m.isInstancedMesh || m.userData?.surfaceGrowth) {
      if (!m.customDepthMaterial && sp.uniforms) {
        const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        depth.onBeforeCompile = (shader: any) => { _specimenCutInject(shader, sp.uniforms, 'world'); };
        depth.customProgramCacheKey = () => 'vugg-specimen-swath-depth';
        m.customDepthMaterial = depth;
        sp.depthMats.add(m);
      }
      continue;
    }
    if (!m.visible) continue;   // hidden by someone else — not ours to touch
    const p = m.position;
    if (_specimenCutAway(sp.cut, p.x, p.y, p.z)) { m.visible = false; sp.hidden.add(m); culled++; }
    else kept++;
  }
  sp.culled = culled; sp.kept = kept;
}

function _specimenReceipt(state: any): any {
  const sp = state && state.specimen;
  if (!sp) { state.specimenRig = { on: false }; return state.specimenRig; }
  const rig = state.lightingRig || {};
  state.specimenRig = {
    on: true,
    cut_normal: [sp.cut.n.x, sp.cut.n.y, sp.cut.n.z].map((v: number) => +v.toFixed(4)),
    rag_mm: +sp.cut.amp.toFixed(2), rind_mm: +sp.rind_mm.toFixed(2), seed: sp.cut.seed,
    r0_mm: +sp.r0.toFixed(2), lithology: sp.lithology || null,
    culled: sp.culled | 0, kept: sp.kept | 0, fracture_quads: sp.fracture_quads | 0,
    stage: !!sp.cloth, floor_y_mm: sp.floor_y != null ? +sp.floor_y.toFixed(2) : null,
    colours: sp.colours || null,
    mood: rig.mood || null, ev: sp.ev, exposure: state.renderer ? state.renderer.toneMappingExposure : null,
    post: sp.post ? { ok: !!sp.post.ok, reason: sp.post.reason || null, grain: sp.post.ok ? SPECIMEN_GRAIN : 0, vignette: sp.post.ok ? SPECIMEN_VIGNETTE : 0 } : null,
    pose: { ...sp.pose },
  };
  return state.specimenRig;
}

// ---- entry / exit / per-frame sync ---------------------------------------------
// r0 as the camera rig sees it (cached by _topoApplyCameraFromTilt); a caller can pass
// its own (tests, the rig) via opts.r0. The cut normal defaults to the camera's forward
// direction — the opening faces the viewer at entry.
function _topoSpecimenEnter(state: any, opts: any = {}): any {
  if (!state || !state.scene) return null;
  if (state.specimen) return state.specimen;
  const r0 = Math.max(5, Number(opts.r0) || Number(state.cameraR0) || 25);
  const seed = opts.seed != null ? Number(opts.seed) : Number(state.specimenSeed) || 42;
  let nx = 0, ny = 0, nz = -1;
  if (opts.normal) { nx = opts.normal[0]; ny = opts.normal[1]; nz = opts.normal[2]; }
  else if (state.camera) {
    const dir = new THREE.Vector3();
    state.camera.getWorldDirection(dir);
    // n points INTO the kept half: the camera's forward, pulled toward −y so the half rests on the
    // cloth with its opening up and toward the viewer (opts.tilt overrides the pull)
    const pull = opts.tilt != null ? Number(opts.tilt) : SPECIMEN_CUT_TILT_DOWN;
    dir.y -= pull;
    dir.normalize();
    nx = dir.x; ny = dir.y; nz = dir.z;
  }
  const cut = _specimenCutFromNormal(nx, ny, nz, r0 * SPECIMEN_RAG_FRACTION, seed);
  const rindMm = Math.max(SPECIMEN_RIND_MIN_MM, Math.min(SPECIMEN_RIND_MAX_MM, r0 * SPECIMEN_RIND_FRACTION));
  const uniforms = state.clipUniforms && state.clipUniforms.uSpecimenCut ? {
    uSpecimenCut: state.clipUniforms.uSpecimenCut, uSpecimenCutN: state.clipUniforms.uSpecimenCutN,
    uSpecimenCutU: state.clipUniforms.uSpecimenCutU, uSpecimenCutV: state.clipUniforms.uSpecimenCutV,
    uSpecimenCutAmp: state.clipUniforms.uSpecimenCutAmp, uSpecimenCutSeed: state.clipUniforms.uSpecimenCutSeed,
  } : null;
  const group = new THREE.Group();
  group.name = 'specimen-stage';
  state.scene.add(group);
  const sp: any = {
    on: true, cut, r0, rind_mm: rindMm, lithology: null, uniforms, group,
    rind: null, fracture: null, cloth: null, cyclo: null, fracture_quads: 0, floor_y: null,
    hidden: new Set<any>(), depthMats: new Set<any>(), culled: 0, kept: 0,
    cavitySig: undefined, crystalsSig: undefined,
    ev: 0, pose: { ...SPECIMEN_POSE }, post: null,
    prevMood: state.lightingRig ? state.lightingRig.mood : 'cave',
    prevFog: state.scene.fog || null,
  };
  state.specimen = sp;
  _specimenApplyCutUniforms(uniforms, cut, true);
  state.scene.fog = new THREE.Fog(SPECIMEN_FOG_COLOR, r0 * SPECIMEN_FOG_NEAR_R0, r0 * SPECIMEN_FOG_FAR_R0);
  // D5: the restrained studio; the key keeps riding the camera (_topoLightingSyncKey), so it
  // lights the opening from the viewer's upper left, and the shadow frustum widens for the cloth.
  if (typeof _topoInstallLightingRig === 'function') _topoInstallLightingRig(state, 'studio');
  if (typeof _topoApplyWallDisplay === 'function') _topoApplyWallDisplay(state);
  _topoSpecimenSyncFrame(state);
  _specimenReceipt(state);
  return sp;
}
function _topoSpecimenExit(state: any): boolean {
  const sp = state && state.specimen;
  if (!sp) return false;
  for (const m of sp.hidden) { if (m.parent) m.visible = true; }
  sp.hidden.clear();
  for (const m of sp.depthMats) { if (m.customDepthMaterial && m.customDepthMaterial.dispose) m.customDepthMaterial.dispose(); m.customDepthMaterial = undefined; }
  sp.depthMats.clear();
  for (const k of ['rind', 'fracture', 'cloth', 'cyclo']) { _specimenDisposeObject(sp[k]); sp[k] = null; }
  if (sp.group && sp.group.parent) sp.group.parent.remove(sp.group);
  _specimenApplyCutUniforms(sp.uniforms, null, false);
  state.scene.fog = sp.prevFog || null;
  _topoSpecimenPostDispose(state);
  state.specimen = null;
  if (typeof _topoInstallLightingRig === 'function') _topoInstallLightingRig(state, sp.prevMood === 'studio' ? 'cave' : (sp.prevMood || 'cave'));
  else if (typeof _topoLightingApplyInsideMode === 'function') _topoLightingApplyInsideMode(state, !!state.insideMode);
  if (typeof _topoApplyWallDisplay === 'function') _topoApplyWallDisplay(state);
  _specimenReceipt(state);
  return true;
}
// Called every frame from _topoRenderFrame (and from entry): rebuild the rind/fracture/
// stage when the cavity geometry changed, re-cull when the crystal set changed, keep
// the water sheet off (a specimen on a cloth holds no fluid).
function _topoSpecimenSyncFrame(state: any) {
  const sp = state && state.specimen;
  if (!sp) return;
  if (sp.cavitySig !== state.cavitySig || !sp.rind) {
    sp.cavitySig = state.cavitySig;
    _specimenRebuildObjects(state);
    _specimenReceipt(state);
  }
  if (sp.crystalsSig !== state.crystalsSig) {
    sp.crystalsSig = state.crystalsSig;
    _specimenSyncCrystals(state);
    _specimenReceipt(state);
  }
  if (state.waterInterface) state.waterInterface.visible = false;
}
// The entry pose, also what ⊙ recentre returns to while the view is on.
function _topoSpecimenPose(pose: any = SPECIMEN_POSE) {
  _topoTiltX = pose.tiltX; _topoTiltY = pose.tiltY; _topoZoom = pose.zoom;
  _topoPanX = 0; _topoPanY = 0;
  const label = document.getElementById('topo-zoom-label');
  if (label) label.textContent = `${Math.round(_topoZoom * 100)}%`;
}

// ---- the post pass: HDR target → ACES → grain → vignette ---------------------
function _topoSpecimenPostAllowed(state: any): { ok: boolean; reason: string | null } {
  if (!state || !state.renderer) return { ok: false, reason: 'no renderer' };
  if (typeof _topoLightingIsMobile === 'function' && _topoLightingIsMobile()) return { ok: false, reason: 'mobile viewport: no post pass' };
  if (!state.lightingRig || !state.lightingRig.environment) return { ok: false, reason: 'lighting rig fell back: no tone-mapped post pass' };
  const r = state.renderer;
  if (!r.capabilities || !r.capabilities.isWebGL2) return { ok: false, reason: 'WebGL1 context: no float colour buffer' };
  const ext = r.extensions;
  if (!ext || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return { ok: false, reason: 'no EXT_color_buffer_float: no HDR target' };
  return { ok: true, reason: null };
}
function _topoSpecimenPostEnsure(state: any, w: number, h: number): any {
  const sp = state.specimen;
  if (!sp) return null;
  let created = false;
  if (!sp.post) {
    created = true;
    const allowed = _topoSpecimenPostAllowed(state);
    sp.post = { ok: allowed.ok, reason: allowed.reason, rt: null, scene: null, camera: null, material: null, quad: null, w: 0, h: 0, frame: 0 };
    if (allowed.ok) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null }, uGrain: { value: SPECIMEN_GRAIN }, uVignette: { value: SPECIMEN_VIGNETTE },
          uFrame: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse;
uniform float uGrain;
uniform float uVignette;
uniform float uFrame;
uniform vec2 uResolution;
varying vec2 vUv;
float specimenGrainHash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334677u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334677u;
  n = (n ^ (n >> 13u)) * 1274126177u;
  return float(n & 16777215u) / 16777216.0;
}
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  float g = specimenGrainHash(gl_FragCoord.xy + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
  float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb += g * uGrain * (0.5 + 2.0 * lum * (1.0 - lum));
  vec2 d = (vUv - 0.5) * vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  gl_FragColor.rgb *= 1.0 - uVignette * smoothstep(0.35, 1.1, length(d));
  #include <colorspace_fragment>
}`,
        depthTest: false, depthWrite: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(quad);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      sp.post.material = material; sp.post.quad = quad; sp.post.scene = scene; sp.post.camera = camera;
    }
  }
  const post = sp.post;
  if (created) _specimenReceipt(state);
  if (!post.ok) return post;
  if (!post.rt || post.w !== w || post.h !== h) {
    if (post.rt) post.rt.dispose();
    post.rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    post.w = w; post.h = h;
    post.material.uniforms.tDiffuse.value = post.rt.texture;
    post.material.uniforms.uResolution.value.set(w, h);
  }
  return post;
}
function _topoSpecimenPostDispose(state: any) {
  const sp = state && state.specimen;
  const post = sp && sp.post;
  if (!post) return;
  if (post.rt) post.rt.dispose();
  if (post.material) post.material.dispose();
  if (post.quad && post.quad.geometry) post.quad.geometry.dispose();
  sp.post = null;
}
// The one place the scene is drawn (the game's render path and the photo rig): the
// specimen view's per-frame sync, then either the direct draw or the post-pass pair.
function _topoRenderFrame(state: any) {
  if (!state || !state.renderer) return;
  _topoSpecimenSyncFrame(state);
  const sp = state.specimen;
  const renderer = state.renderer;
  if (!sp) { renderer.render(state.scene, state.camera); return; }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const post = _topoSpecimenPostEnsure(state, Math.max(1, size.x | 0), Math.max(1, size.y | 0));
  if (!post || !post.ok || !post.rt) { renderer.render(state.scene, state.camera); return; }
  renderer.setRenderTarget(post.rt);
  renderer.render(state.scene, state.camera);
  renderer.setRenderTarget(null);
  post.frame = (post.frame + 1) % 4096;
  post.material.uniforms.uFrame.value = post.frame;
  renderer.render(post.scene, post.camera);
}

// ---- UI --------------------------------------------------------------------------
function _topoSyncSpecimenButtons(state: any) {
  const on = !!(state && state.specimen);
  const btn = document.getElementById('topo-specimen-btn');
  if (btn) {
    btn.style.color = on ? '#f0c050' : '';
    btn.title = on ? 'Specimen view: on (click: back to the process view)' : 'Specimen view: off (click: break the geode open on the cloth)';
    btn.setAttribute('aria-pressed', String(on));
  }
  const ev = document.getElementById('topo-exposure-btn');
  if (ev) {
    ev.style.display = on ? '' : 'none';
    const stop = on ? state.specimen.ev : 0;
    const label = (stop > 0 ? '+' : '') + stop + ' EV';
    ev.title = `Exposure: ${label} (click: next ½-stop)`;
    ev.style.color = stop !== 0 ? '#f0c050' : '';
  }
}
// The topo-specimen-btn onclick (index.html camera-ctrls row). Needs the Three renderer;
// turns it on first when the flat view is showing.
function topoToggleSpecimenView(force?: boolean): boolean {
  if (_topoExactFlatPresentationActive) return false;
  if (!_topoThreeState && typeof topoSetThreeRendererEnabled === 'function') {
    topoSetThreeRendererEnabled(true);
    if (typeof topoRender === 'function') topoRender();
  }
  const state = _topoThreeState;
  if (!state) return false;
  const want = force == null ? !state.specimen : !!force;
  if (want && !state.specimen) {
    _topoSpecimenPose();
    // place the camera at the pose so the cut faces it
    const sim = typeof topoActiveSim === 'function' ? topoActiveSim() : null;
    const wall = sim ? sim.wall_state : null;
    if (wall && typeof _topoApplyCameraFromTilt === 'function') _topoApplyCameraFromTilt(state, wall);
    state.specimenSeed = sim && Number.isFinite(Number(sim.seed)) ? Number(sim.seed) : 42;
    _topoSpecimenEnter(state);
  } else if (!want && state.specimen) {
    _topoSpecimenExit(state);
  }
  _topoSyncSpecimenButtons(state);
  if (typeof topoRender === 'function') topoRender();
  return !!state.specimen;
}
function topoSetSpecimenExposure(ev: number): boolean {
  const state = _topoThreeState;
  if (!state || !state.specimen) return false;
  const stop = Number(ev);
  if (!Number.isFinite(stop)) return false;
  state.specimen.ev = stop;
  if (typeof _topoLightingApplyInsideMode === 'function') _topoLightingApplyInsideMode(state, !!state.insideMode);
  _specimenReceipt(state);
  _topoSyncSpecimenButtons(state);
  return true;
}
// The topo-exposure-btn onclick: cycles the ½-EV stops.
function topoCycleSpecimenExposure(): boolean {
  const state = _topoThreeState;
  if (!state || !state.specimen) return false;
  const i = SPECIMEN_EV_STOPS.indexOf(state.specimen.ev);
  const next = SPECIMEN_EV_STOPS[(i + 1) % SPECIMEN_EV_STOPS.length];
  topoSetSpecimenExposure(next);
  if (typeof topoRender === 'function') topoRender();
  return true;
}

// Inject a sphere-distance discard into a MeshStandardMaterial via
// onBeforeCompile, so fragments outside the cavity hull radius drop
// out. The vug becomes a natural slice volume — crystals that grew
// past the wall (the feldspar-#7 bug) get cleanly cut at the wall
// instead of bursting visibly into the host rock. The cavity itself
// is centered at world origin (vertices computed as radiusMm × dir
// from origin in _topoBuildCavityGeometry), so distance from origin
// is the right metric. clipUniforms is shared across all crystal
// materials; updating uVugRadius on cavity rebuild updates every
// crystal's clip in one assignment.
//
// Pegmatite cavities have base_radius_mm uniform across cells (no
// dissolution erosion at nucleation), so a single sphere clip
// matches the cavity geometry exactly. Eroded scenarios with
// per-cell wall_depth produce an irregular cavity. Two clip tiers:
//   1. Per-cell: uVugCellRadii is a (cellsPerRing × ringCount) R-float
//      DataTexture — every cell's actual world radius. Sampling gives
//      the LOCAL wall radius at the fragment's (phi, theta), so
//      crystal corners and tilted bodies in narrow-wall directions
//      get clipped at the actual wall instead of the per-ring max.
//   2. Per-ring fallback (uVugRadiiByRing): the per-ring max hull,
//      used until the texture is built (first frame). Generous in
//      asymmetric cavities — leaks "brighter saturated" patches
//      where corners stick past the local cell.
function _applyCavityClip(material: any, clipUniforms: any, opts: any = {}) {
  // This capability is a compile-time shader variant. If sampler3D fails to
  // link, fallback must build a different polar-only program which contains no
  // 3-D sampler declaration or sample instruction.
  const useCavityField = Number(clipUniforms?.uCavityClipMode?.value || 0) === 1;
  const useHelix = opts.helix !== false;
  // R6 specimen view: coating swaths (instanced) are cut per fragment; crystal BODIES are
  // never sawn — the view culls them whole by their wall anchor instead.
  const useFragmentCut = opts.specimenFragmentCut === true;
  const shaderVariant = (useCavityField
    ? 'field-r32f-freudenthal-v2' : 'polar-r32f-free-v1')
    + (useHelix ? '|helix' : '|no-helix') + (useFragmentCut ? '|fragcut' : '');
  if (!material.userData) material.userData = {};
  material.userData.vuggCavityClipVariant = shaderVariant;
  material.customProgramCacheKey = () => `vugg-cavity-clip:${shaderVariant}`;
  material.onBeforeCompile = (shader: any) => {
    if (useCavityField) {
      shader.uniforms.uCavityField = clipUniforms.uCavityField;
      shader.uniforms.uCavityFieldDimensions = clipUniforms.uCavityFieldDimensions;
      shader.uniforms.uCavityFieldWorldScale = clipUniforms.uCavityFieldWorldScale;
      shader.uniforms.uCavityFieldWorldBias = clipUniforms.uCavityFieldWorldBias;
      shader.uniforms.uCavityFieldIsovalue = clipUniforms.uCavityFieldIsovalue;
    } else {
      shader.uniforms.uVugRadius = clipUniforms.uVugRadius;
      shader.uniforms.uVugCenter = clipUniforms.uVugCenter;
      shader.uniforms.uVugRingCount = clipUniforms.uVugRingCount;
      shader.uniforms.uVugRadiiByRing = clipUniforms.uVugRadiiByRing;
      shader.uniforms.uVugCellRadii = clipUniforms.uVugCellRadii;
      shader.uniforms.uVugCellTexW = clipUniforms.uVugCellTexW;
      shader.uniforms.uVugCellTexH = clipUniforms.uVugCellTexH;
    }
    // === HELIX-OVERLAY-FORK ADDITION (v19) =========================
    shader.uniforms.uHelixEnabled = useHelix
      ? clipUniforms.uHelixEnabled : { value: 0 };
    shader.uniforms.uHelixSweep   = clipUniforms.uHelixSweep;
    shader.uniforms.uHelixYCenter = clipUniforms.uHelixYCenter;
    shader.uniforms.uHelixYSpan   = clipUniforms.uHelixYSpan;
    shader.uniforms.uHelixNTurns  = clipUniforms.uHelixNTurns;
    shader.uniforms.uHelixFade    = clipUniforms.uHelixFade;
    // === END HELIX-OVERLAY-FORK ADDITION ===========================
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vCavityWorldPos;'
    );
    // `transformed` is only object-local after <begin_vertex>. Three applies
    // batching and instanceMatrix inside <project_vertex>, so derive the clip
    // position with the same transform order after morphing/skinning/
    // displacement have already changed `transformed`. This is required for
    // InstancedMesh surface films and ordinary crystal meshes to clip in the
    // same world frame.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
vec4 _cavityClipWorld = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  _cavityClipWorld = batchingMatrix * _cavityClipWorld;
#endif
#ifdef USE_INSTANCING
  _cavityClipWorld = instanceMatrix * _cavityClipWorld;
#endif
vCavityWorldPos = ( modelMatrix * _cavityClipWorld ).xyz;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vCavityWorldPos;
uniform vec3 uVugCenter;
uniform float uVugRadius;
uniform int uVugRingCount;
uniform float uVugRadiiByRing[${_MAX_CLIP_RINGS}];
uniform sampler2D uVugCellRadii;
uniform float uVugCellTexW;
uniform float uVugCellTexH;
uniform int uCavityClipMode;
uniform sampler3D uCavityField;
uniform vec3 uCavityFieldDimensions;
uniform vec3 uCavityFieldWorldScale;
uniform vec3 uCavityFieldWorldBias;
uniform float uCavityFieldIsovalue;
${useCavityField ? `
float cavityFieldGridValue(vec3 gridIndex) {
  return texture(uCavityField,
    (gridIndex + vec3(0.5)) / uCavityFieldDimensions).r;
}

float cavityFreudenthalValue(vec3 gridPosition) {
  vec3 base = min(floor(gridPosition), uCavityFieldDimensions - vec3(2.0));
  base = max(base, vec3(0.0));
  vec3 t = gridPosition - base;
  vec3 pCorner;
  vec3 pqCorner;
  float tp;
  float tq;
  float tr;
  if (t.x >= t.y) {
    if (t.y >= t.z) {
      pCorner = base + vec3(1.0, 0.0, 0.0);
      pqCorner = base + vec3(1.0, 1.0, 0.0);
      tp = t.x; tq = t.y; tr = t.z;
    } else if (t.x >= t.z) {
      pCorner = base + vec3(1.0, 0.0, 0.0);
      pqCorner = base + vec3(1.0, 0.0, 1.0);
      tp = t.x; tq = t.z; tr = t.y;
    } else {
      pCorner = base + vec3(0.0, 0.0, 1.0);
      pqCorner = base + vec3(1.0, 0.0, 1.0);
      tp = t.z; tq = t.x; tr = t.y;
    }
  } else {
    if (t.x >= t.z) {
      pCorner = base + vec3(0.0, 1.0, 0.0);
      pqCorner = base + vec3(1.0, 1.0, 0.0);
      tp = t.y; tq = t.x; tr = t.z;
    } else if (t.y >= t.z) {
      pCorner = base + vec3(0.0, 1.0, 0.0);
      pqCorner = base + vec3(0.0, 1.0, 1.0);
      tp = t.y; tq = t.z; tr = t.x;
    } else {
      pCorner = base + vec3(0.0, 0.0, 1.0);
      pqCorner = base + vec3(0.0, 1.0, 1.0);
      tp = t.z; tq = t.y; tr = t.x;
    }
  }
  float c000 = cavityFieldGridValue(base);
  float cp = cavityFieldGridValue(pCorner);
  float cpq = cavityFieldGridValue(pqCorner);
  float c111 = cavityFieldGridValue(base + vec3(1.0));
  return c000 * (1.0 - tp) + cp * (tp - tq)
    + cpq * (tq - tr) + c111 * tr;
}
` : ''}
// === HELIX-OVERLAY-FORK ADDITION (v19) — helix skin uniforms =====
uniform float uHelixEnabled;
uniform float uHelixSweep;
uniform float uHelixYCenter;
uniform float uHelixYSpan;
uniform float uHelixNTurns;
uniform float uHelixFade;
// === END HELIX-OVERLAY-FORK ADDITION ============================

// Per-cell cavity hull lookup. The cavity build (see
// _topoBuildCavityGeometry) places ring r at world-y = -radius * cos(phi_cav)
// where phi_cav = PI * (r + 0.5) / ringCount. So ring 0 sits at -y
// (south pole), ring (ringCount-1) at +y (north pole). The shader's
// natural phi_shader = acos(d.y/r) is measured from +y (north), so
// phi_shader = PI - phi_cav. Texture v=1 → cavity ring (ringCount-1)
// at +y. Texture u: theta_cav = 2*PI*c/N matches atan2(z, x); wraps
// at 0/2π (the texture's S-wrap mode is RepeatWrapping so the seam
// filters correctly). Twist (per-ring rotation) is ignored — most
// scenarios keep twist=0; if a cavity ever sets it, the per-ring
// fallback still works conservatively. Falls back to per-ring when
// the texture is unset (first frame, or unsupported driver).
float cavityHullRadiusAt(vec3 worldPos) {
  vec3 d = worldPos - uVugCenter;
  float r = length(d);
  if (r < 1e-4) return uVugRadius;
  float cosPhi = clamp(d.y / r, -1.0, 1.0);
  float phi = acos(cosPhi);
  // Per-cell texture lookup (preferred when populated).
  if (uVugCellTexW > 0.5 && uVugCellTexH > 0.5) {
    float v = clamp((3.14159265 - phi) / 3.14159265, 0.0, 1.0);
    float thetaShader = atan(d.z, d.x);  // [-PI, PI]
    if (thetaShader < 0.0) thetaShader += 6.28318530;
    float u = thetaShader / 6.28318530;  // [0, 1)
    return texture2D(uVugCellRadii, vec2(u, v)).r;
  }
  // Per-ring fallback — generous (per-ring max), used only until the
  // per-cell texture is populated.
  if (uVugRingCount <= 0 || uVugRingCount > ${_MAX_CLIP_RINGS}) return uVugRadius;
  float ringF = float(uVugRingCount) - 0.5 - phi * float(uVugRingCount) / 3.14159265;
  float maxIdx = float(uVugRingCount - 1);
  float idxClamped = clamp(ringF, 0.0, maxIdx);
  int i0 = int(floor(idxClamped));
  int i1 = int(min(float(i0) + 1.0, maxIdx));
  float t = idxClamped - float(i0);
  return mix(uVugRadiiByRing[i0], uVugRadiiByRing[i1], t);
}`
    );
    // Remove the unused capability from the source itself. This is what makes
    // the polar fallback safe on a WebGL2 driver that rejects sampler3D.
    if (useCavityField) {
      for (const declaration of [
        'uniform vec3 uVugCenter;\n',
        'uniform float uVugRadius;\n',
        'uniform int uVugRingCount;\n',
        `uniform float uVugRadiiByRing[${_MAX_CLIP_RINGS}];\n`,
        'uniform sampler2D uVugCellRadii;\n',
        'uniform float uVugCellTexW;\n',
        'uniform float uVugCellTexH;\n',
        'uniform int uCavityClipMode;\n',
      ]) shader.fragmentShader = shader.fragmentShader.replace(declaration, '');
      const helperStart = shader.fragmentShader.indexOf('// Per-cell cavity hull lookup.');
      const helperEnd = helperStart >= 0
        ? shader.fragmentShader.indexOf('\n}', helperStart) : -1;
      if (helperStart >= 0 && helperEnd >= 0) {
        shader.fragmentShader = shader.fragmentShader.slice(0, helperStart)
          + shader.fragmentShader.slice(helperEnd + 2);
      }
    } else {
      for (const declaration of [
        'uniform int uCavityClipMode;\n',
        'uniform sampler3D uCavityField;\n',
        'uniform vec3 uCavityFieldDimensions;\n',
        'uniform vec3 uCavityFieldWorldScale;\n',
        'uniform vec3 uCavityFieldWorldBias;\n',
        'uniform float uCavityFieldIsovalue;\n',
      ]) shader.fragmentShader = shader.fragmentShader.replace(declaration, '');
    }
    const cavityDiscard = useCavityField
      ? `vec3 _cavityTexCoord = vCavityWorldPos * uCavityFieldWorldScale
    + uCavityFieldWorldBias;
  vec3 _cavityGridPosition = _cavityTexCoord * uCavityFieldDimensions - vec3(0.5);
  // The affine map addresses texel centres. Test the actual lattice bounds,
  // not [0,1], which includes a half-voxel unauthenticated halo.
  if (any(lessThan(_cavityGridPosition, vec3(0.0)))
      || any(greaterThan(_cavityGridPosition, uCavityFieldDimensions - vec3(1.0)))) discard;
  if (cavityFreudenthalValue(_cavityGridPosition) < uCavityFieldIsovalue) discard;`
      : `float _vugHullR = cavityHullRadiusAt(vCavityWorldPos);
  if (length(vCavityWorldPos - uVugCenter) > _vugHullR) discard;`;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `void main() {
  ${cavityDiscard}
  // === HELIX-OVERLAY-FORK ADDITION (v19) — per-fragment helix skin ====
  // Each surface point on the crystal computes its own age relative to
  // the helicoid leading edge AT THAT Y. The leading-edge world angle
  // at world-y is sweep + u·2π·N where u is the fragment's Y-fraction
  // along the cavity's vertical extent — so different parts of a tall
  // crystal get hit by the sweep at different sweep moments, revealing
  // the crystal segment-by-segment along its height instead of all at
  // once. Discards fragments fully outside the half-turn visible
  // window (saves the rest of the lighting math); alpha multiplied at
  // the bottom of main(). Short-circuits when uHelixEnabled < 0.5.
  float _helixSkinAlpha = 1.0;
  if (uHelixEnabled > 0.5) {
    float _hu = clamp((vCavityWorldPos.y - uHelixYCenter) / uHelixYSpan + 0.5, 0.0, 1.0);
    float _hLead = uHelixSweep + _hu * 6.28318530718 * uHelixNTurns;
    float _hTheta = atan(vCavityWorldPos.z, vCavityWorldPos.x);
    float _hAge = mod(_hLead - _hTheta, 6.28318530718);
    if (_hAge > 3.14159265359) _hAge -= 6.28318530718;
    float _hAbs = abs(_hAge);
    if (_hAbs > uHelixFade) discard;
    _helixSkinAlpha = 1.0 - _hAbs / uHelixFade;
  }
  // === END HELIX-OVERLAY-FORK ADDITION ===============================`
    );
    // === HELIX-OVERLAY-FORK ADDITION (v19) — alpha multiply at end ====
    // Insert before <dithering_fragment> (reliably near end of main).
    // gl_FragColor.a is final at this point; multiplying by skinAlpha
    // gives the smooth ramp across the helicoid fade window. The early
    // discard above keeps the multiplied alpha visible (no skin
    // contribution if uHelixEnabled is off; skinAlpha stays 1.0).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.a *= _helixSkinAlpha;
  #include <dithering_fragment>`
    );
    // === END HELIX-OVERLAY-FORK ADDITION ===============================
    if (useFragmentCut && clipUniforms.uSpecimenCut) {
      _specimenCutInject(shader, {
        uSpecimenCut: clipUniforms.uSpecimenCut, uSpecimenCutN: clipUniforms.uSpecimenCutN,
        uSpecimenCutU: clipUniforms.uSpecimenCutU, uSpecimenCutV: clipUniforms.uSpecimenCutV,
        uSpecimenCutAmp: clipUniforms.uSpecimenCutAmp, uSpecimenCutSeed: clipUniforms.uSpecimenCutSeed,
      }, 'crystal');
    }
  };
  // Force shader rebuild on next render.
  material.needsUpdate = true;
}

function _topoSyncCavityWaterAppearance(state: any, source: any,
                                        appearance: any): void {
  if (!state?.cavity || !source?.buffers || !appearance?.receipt) return;
  const receipt = appearance.receipt;
  if (state.cavityAppearanceSig !== receipt.appearance_digest) {
    const colors = CavityWaterAppearance.colorsForSurface(source.buffers, receipt);
    const colorAttribute = state.cavity.geometry?.getAttribute?.('color');
    if (!colorAttribute || colorAttribute.array.length !== colors.length) {
      throw new RangeError('cavity appearance color buffer differs from geometry');
    }
    colorAttribute.array.set(_topoWallRockTint(colors));
    colorAttribute.needsUpdate = true;
    state.cavityAppearanceSig = receipt.appearance_digest;
  } else return;

  const showInterface = receipt.explicit_surface
    && !receipt.fully_submerged && !receipt.fully_drained;
  if (!showInterface) {
    if (state.waterInterface) state.waterInterface.visible = false;
    return;
  }
  const clipVariant = Number(state.clipUniforms?.uCavityClipMode?.value || 0) === 1
    ? 'field' : 'polar';
  if (!state.waterInterface || state.waterInterfaceClipVariant !== clipVariant) {
    if (state.waterInterface) {
      state.scene.remove(state.waterInterface);
      state.waterInterface.geometry?.dispose?.();
      state.waterInterface.material?.dispose?.();
    }
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x56aaf0,
      roughness: 0.16,
      metalness: 0,
      transmission: 0.18,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    _applyCavityClip(material, state.clipUniforms, { helix: false });
    const water = new THREE.Mesh(new THREE.BufferGeometry(), material);
    water.name = 'authenticated-cavity-water-interface';
    water.renderOrder = 1;
    water.raycast = function() {};
    water.receiveShadow = true;   // R1: crystals above the water line shade it; the sheet casts nothing
    state.scene.add(water);
    state.waterInterface = water;
    state.waterInterfaceClipVariant = clipVariant;
  }
  const min = receipt.bounds_min_mm;
  const max = receipt.bounds_max_mm;
  const width = Math.max(Number(max[0]) - Number(min[0]), 1e-9);
  const depth = Math.max(Number(max[2]) - Number(min[2]), 1e-9);
  const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const previous = state.waterInterface.geometry;
  state.waterInterface.geometry = geometry;
  previous?.dispose?.();
  state.waterInterface.position.set(
    (Number(min[0]) + Number(max[0])) * 0.5,
    Number(receipt.water_plane_y_mm),
    (Number(min[2]) + Number(max[2])) * 0.5,
  );
  state.waterInterface.visible = true;
}

// W-K V1b (wall depth THROUGH translucency, 2026-07-07): the cavity wall's genesis
// relief as ALBEDO ambient occlusion. V1 gave the wall a normal map (js/99a
// _wallReliefNormalMap), but a normal map only perturbs LIGHTING — washed out by the
// wall's 0.18–0.40 translucency + the ambient-heavy rig, so the scallops/striations/
// rind are invisible in the two views the boss actually inspects specimens in (the
// WIRED≠VISIBLE lesson from V1). This multiplies a grayscale AO (js/99a
// _wallReliefAOMap, the SAME height field + tiling) into diffuseColor — darker pigment
// in the recesses, which reads through ANY opacity at ANY light angle. Sampled at RAW
// uv (own vReliefUv varying, NOT vMapUv — the skin map's 6×3 transform must not scale
// it) × the relief's own per-family repeat, so the shade lands exactly in the normal
// map's pits. Shared uniform objects live on material.userData.reliefAO; the arch-change
// block in _topoSyncCavityMesh swaps map/repeat/strength by mutating those objects, so
// no recompile is needed. The cavity material carries no other onBeforeCompile (the
// _applyCavityClip hull-clip is on the CRYSTAL materials), so there's no chunk-anchor
// collision. Render-only, byte-identical.
const WALL_RELIEF_AO_AMT = 0.35;  // recess-darkening depth (0=off, 1=recess→black); R5 (2026-09-06): 0.6 → 0.35 —
                                   // under R1's lit environment the pits read as a golf ball; eye-checked 2026-07-07 at 0.6:
                                   // 0.6 reads clearly through the 0.40 default view, hints at 0.18 druse-portrait,
                                   // and stays tasteful (not black-pitted) at full opacity where V1's normal map
                                   // also fires. Isolated-AO A/B (normalScale 0) confirmed it carries the relief
                                   // through translucency on its own — the acceptance test a normal map fails.
function _applyWallReliefAO(material: any) {
  if (!material || !material.userData || !material.userData.reliefAO) return;
  const u = material.userData.reliefAO;
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uReliefAO = u.uReliefAO;
    shader.uniforms.uReliefAORepeat = u.uReliefAORepeat;
    shader.uniforms.uReliefAOAmt = u.uReliefAOAmt;
    shader.uniforms.uWallMaterialSpaceEnabled = u.uWallMaterialSpaceEnabled;
    shader.uniforms.uWallMatrixScale = u.uWallMatrixScale;
    shader.uniforms.uWallReliefScale = u.uWallReliefScale;
    shader.uniforms.uWallGrain = u.uWallGrain;
    shader.uniforms.uWallGrainScale = u.uWallGrainScale;
    shader.uniforms.uWallGrainAmt = u.uWallGrainAmt;
    shader.uniforms.uWallReliefAmt = u.uWallReliefAmt;
    shader.uniforms.uWallStainAmt = u.uWallStainAmt;
    shader.uniforms.uWallStainScale = u.uWallStainScale;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec2 vReliefUv;\nvarying vec3 vWallMaterialPos;\nvarying vec3 vWallMaterialNormal;\nvarying vec3 vWallNormalBasisX;\nvarying vec3 vWallNormalBasisY;\nvarying vec3 vWallNormalBasisZ;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvReliefUv = uv;\n\tvWallMaterialPos = position;\n\tvWallMaterialNormal = normal;\n\tvWallNormalBasisX = normalMatrix * vec3(1.0, 0.0, 0.0);\n\tvWallNormalBasisY = normalMatrix * vec3(0.0, 1.0, 0.0);\n\tvWallNormalBasisZ = normalMatrix * vec3(0.0, 0.0, 1.0);'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uReliefAO;
uniform vec2 uReliefAORepeat;
uniform float uReliefAOAmt;
uniform float uWallMaterialSpaceEnabled;
uniform vec2 uWallMatrixScale;
uniform vec2 uWallReliefScale;
varying vec2 vReliefUv;
varying vec3 vWallMaterialPos;
varying vec3 vWallMaterialNormal;
varying vec3 vWallNormalBasisX;
varying vec3 vWallNormalBasisY;
varying vec3 vWallNormalBasisZ;
uniform sampler2D uWallGrain;
uniform vec2 uWallGrainScale;
uniform float uWallGrainAmt;
uniform float uWallReliefAmt;
uniform float uWallStainAmt;
uniform float uWallStainScale;
// R5: low-frequency lattice value noise in object millimetres (anti-tiling blend, stain mask)
float wallHash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float wallNoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = wallHash3(i), n100 = wallHash3(i + vec3(1.0, 0.0, 0.0)), n010 = wallHash3(i + vec3(0.0, 1.0, 0.0)), n110 = wallHash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = wallHash3(i + vec3(0.0, 0.0, 1.0)), n101 = wallHash3(i + vec3(1.0, 0.0, 1.0)), n011 = wallHash3(i + vec3(0.0, 1.0, 1.0)), n111 = wallHash3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
// two scales of the same map, blended by a 40 mm noise: a tile never repeats in step with itself
float wallAntiTileMix(vec3 p) { return smoothstep(0.3, 0.7, wallNoise3(p * 0.025 + vec3(7.0, 3.0, 11.0))); }
// R5: a domain warp for the genesis relief (up to ±4 mm over a ~30 mm wavelength): comb palisades,
// cleft grooves and basin bedding risers become wavy lines, as the real ones are, and the tiled
// pattern loses its straight repeats (wittichen druse: comb ridges read 4.3 unwarped)
vec3 wallReliefWarp(vec3 p) {
  return p + 7.0 * (vec3(wallNoise3(p * 0.02 + vec3(1.0, 9.0, 4.0)), wallNoise3(p * 0.02 + vec3(6.0, 2.0, 8.0)), wallNoise3(p * 0.02 + vec3(3.0, 7.0, 5.0))) - 0.5);
}
vec3 wallTriplanarWeights(vec3 sourceNormal) {
  vec3 weights = pow(abs(normalize(sourceNormal)), vec3(4.0));
  return weights / max(weights.x + weights.y + weights.z, 1e-6);
}
vec4 wallTriplanarSample(sampler2D sourceMap, vec3 sourcePosition,
                         vec3 sourceNormal, vec2 physicalScale) {
  vec3 weights = wallTriplanarWeights(sourceNormal);
  vec4 alongX = texture2D(sourceMap, vec2(sourcePosition.z, sourcePosition.y) * physicalScale);
  vec4 alongY = texture2D(sourceMap, vec2(sourcePosition.x, sourcePosition.z) * physicalScale);
  vec4 alongZ = texture2D(sourceMap, vec2(sourcePosition.x, sourcePosition.y) * physicalScale);
  return alongX * weights.x + alongY * weights.y + alongZ * weights.z;
}
// R5: the same map at two scales (1× and 0.37×, offset), blended by the anti-tile noise
vec4 wallTriplanarSampleAT(sampler2D sourceMap, vec3 sourcePosition, vec3 sourceNormal, vec2 physicalScale) {
  vec4 a = wallTriplanarSample(sourceMap, sourcePosition, sourceNormal, physicalScale);
  vec4 b = wallTriplanarSample(sourceMap, sourcePosition + vec3(37.0, 19.0, 53.0), sourceNormal, physicalScale * 0.37);
  return mix(a, b, wallAntiTileMix(sourcePosition));
}
// R5: the grain's tangent-space slope (xy of the grain normal map), triplanar and anti-tiled
// (two scales, 1× and 0.61×, blended by the anti-tile noise at a finer wavelength)
vec2 wallGrainSlope(vec3 p, vec3 n) {
  vec3 wts = wallTriplanarWeights(n);
  float m = wallAntiTileMix(p * 3.1);
  vec3 q = p + vec3(11.0, 29.0, 5.0);
  vec2 a = (texture2D(uWallGrain, vec2(p.z, p.y) * uWallGrainScale).xy * wts.x + texture2D(uWallGrain, vec2(p.x, p.z) * uWallGrainScale).xy * wts.y + texture2D(uWallGrain, vec2(p.x, p.y) * uWallGrainScale).xy * wts.z) * 2.0 - 1.0;
  vec2 b = (texture2D(uWallGrain, vec2(q.z, q.y) * uWallGrainScale * 0.61).xy * wts.x + texture2D(uWallGrain, vec2(q.x, q.z) * uWallGrainScale * 0.61).xy * wts.y + texture2D(uWallGrain, vec2(q.x, q.y) * uWallGrainScale * 0.61).xy * wts.z) * 2.0 - 1.0;
  return mix(a, b, m);
}`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  vec4 sampledDiffuseColor = uWallMaterialSpaceEnabled > 0.5
    ? wallTriplanarSampleAT(map, vWallMaterialPos, vWallMaterialNormal, uWallMatrixScale)
    : texture2D(map, vMapUv);
  diffuseColor *= sampledDiffuseColor;
#endif
  vec3 _reliefP = wallReliefWarp(vWallMaterialPos);
  float _reliefAO = uWallMaterialSpaceEnabled > 0.5
    ? wallTriplanarSampleAT(uReliefAO, _reliefP, vWallMaterialNormal, uWallReliefScale).r
    : texture2D(uReliefAO, vReliefUv * uReliefAORepeat).r;
  diffuseColor.rgb *= (1.0 - uReliefAOAmt * uWallReliefAmt * (1.0 - _reliefAO));
  // R5: the grain's slopes darken the albedo — pits and grain boundaries are darker than the flats
  if (uWallMaterialSpaceEnabled > 0.5) {
    vec2 _gs = wallGrainSlope(vWallMaterialPos, vWallMaterialNormal);
    diffuseColor.rgb *= 1.0 - 0.4 * uWallGrainAmt * min(1.0, length(_gs));
  }
  // R5: iron-oxide / clay film — a low-frequency mask darkening and warming the rock
  float _stain = uWallStainAmt * smoothstep(0.35, 0.85, wallNoise3(vWallMaterialPos * uWallStainScale + vec3(3.0, 5.0, 7.0)));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.56, 0.34), _stain);`
    );
    // R5: roughness = the lithology's base (material.roughness) modulated by the grain slope
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
  if (uWallMaterialSpaceEnabled > 0.5) {
    vec2 _g = wallGrainSlope(vWallMaterialPos, vWallMaterialNormal);
    roughnessFactor = clamp(roughnessFactor - 0.06 + 0.35 * uWallGrainAmt * length(_g), 0.3, 1.0);
  }`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#if defined(USE_NORMALMAP_TANGENTSPACE)
  if (uWallMaterialSpaceEnabled > 0.5) {
    vec3 baseObjectNormal = normalize(vWallMaterialNormal);
    #ifdef FLAT_SHADED
      baseObjectNormal = normalize(cross(
        dFdx(vWallMaterialPos), dFdy(vWallMaterialPos)));
    #endif
    vec3 baseViewFromObject = normalize(
      vWallNormalBasisX * baseObjectNormal.x
      + vWallNormalBasisY * baseObjectNormal.y
      + vWallNormalBasisZ * baseObjectNormal.z);
    if (dot(baseViewFromObject, normal) < 0.0) baseObjectNormal = -baseObjectNormal;
    vec3 axisSign = step(vec3(0.0), baseObjectNormal) * 2.0 - 1.0;
    vec3 weights = wallTriplanarWeights(baseObjectNormal);
    vec3 _pW = wallReliefWarp(vWallMaterialPos);
    float _atMix = wallAntiTileMix(_pW);
    vec3 _pB = _pW + vec3(37.0, 19.0, 53.0);
    vec3 mapX = mix(texture2D(normalMap, vec2(_pW.z, _pW.y) * uWallReliefScale).xyz, texture2D(normalMap, vec2(_pB.z, _pB.y) * uWallReliefScale * 0.37).xyz, _atMix) * 2.0 - 1.0;
    vec3 mapY = mix(texture2D(normalMap, vec2(_pW.x, _pW.z) * uWallReliefScale).xyz, texture2D(normalMap, vec2(_pB.x, _pB.z) * uWallReliefScale * 0.37).xyz, _atMix) * 2.0 - 1.0;
    vec3 mapZ = mix(texture2D(normalMap, vec2(_pW.x, _pW.y) * uWallReliefScale).xyz, texture2D(normalMap, vec2(_pB.x, _pB.y) * uWallReliefScale * 0.37).xyz, _atMix) * 2.0 - 1.0;
    mapX.xy *= normalScale * uWallReliefAmt; mapY.xy *= normalScale * uWallReliefAmt; mapZ.xy *= normalScale * uWallReliefAmt;
    // R5: the granular host rock under the genesis relief — a non-periodic grain octave at its own scale
    float _gm = wallAntiTileMix(vWallMaterialPos * 3.1);
    vec3 _gq = vWallMaterialPos + vec3(11.0, 29.0, 5.0);
    vec3 gX = mix(texture2D(uWallGrain, vec2(vWallMaterialPos.z, vWallMaterialPos.y) * uWallGrainScale).xyz, texture2D(uWallGrain, vec2(_gq.z, _gq.y) * uWallGrainScale * 0.61).xyz, _gm) * 2.0 - 1.0;
    vec3 gY = mix(texture2D(uWallGrain, vec2(vWallMaterialPos.x, vWallMaterialPos.z) * uWallGrainScale).xyz, texture2D(uWallGrain, vec2(_gq.x, _gq.z) * uWallGrainScale * 0.61).xyz, _gm) * 2.0 - 1.0;
    vec3 gZ = mix(texture2D(uWallGrain, vec2(vWallMaterialPos.x, vWallMaterialPos.y) * uWallGrainScale).xyz, texture2D(uWallGrain, vec2(_gq.x, _gq.y) * uWallGrainScale * 0.61).xyz, _gm) * 2.0 - 1.0;
    mapX.xy += gX.xy * uWallGrainAmt; mapY.xy += gY.xy * uWallGrainAmt; mapZ.xy += gZ.xy * uWallGrainAmt;
    // Blend tangent-plane perturbations, not three axis normals. A flat
    // normal-map texel is exactly zero and therefore preserves the geometric
    // normal, including the derivative normal used by FLAT_SHADED.
    vec3 perturbX = vec3(0.0, mapX.y, -axisSign.x * mapX.x);
    vec3 perturbY = vec3(mapY.x, 0.0, -axisSign.y * mapY.y);
    vec3 perturbZ = vec3(axisSign.z * mapZ.x, mapZ.y, 0.0);
    vec3 mappedObjectPerturbation = perturbX * weights.x
      + perturbY * weights.y + perturbZ * weights.z;
    vec3 mappedViewPerturbation =
      vWallNormalBasisX * mappedObjectPerturbation.x
      + vWallNormalBasisY * mappedObjectPerturbation.y
      + vWallNormalBasisZ * mappedObjectPerturbation.z;
    normal = normalize(normal + mappedViewPerturbation);
  } else {
    #include <normal_fragment_maps>
  }
#else
  #include <normal_fragment_maps>
#endif`
    );
    // R6 specimen view: the wall discards on the cut-away side of the ragged break.
    if (material.userData && material.userData.specimenCut) _specimenCutInject(shader, material.userData.specimenCut, 'wall');
  };
  material.needsUpdate = true;
}

const CAVITY_MATERIAL_SPACE_SCHEMA = 'cavity-material-space-v1';

// CPU mirror of the GLSL perturbation blend. Besides making the coordinate
// convention reviewable, this pins the most important invariant numerically:
// a flat normal map leaves every geometric normal unchanged.
function _topoTriplanarPerturbObjectNormal(baseNormal: number[], maps: any,
                                            normalScale = [1, 1]): number[] {
  const length = Math.hypot(baseNormal[0], baseNormal[1], baseNormal[2]);
  if (!(length > 0) || !Number.isFinite(length)) {
    throw new RangeError('triplanar normal requires a finite non-zero base normal');
  }
  const n = baseNormal.map(value => value / length);
  const weights = n.map(value => Math.abs(value) ** 4);
  const weightSum = weights[0] + weights[1] + weights[2] || 1;
  for (let axis = 0; axis < 3; axis++) weights[axis] /= weightSum;
  const sign = n.map(value => value < 0 ? -1 : 1);
  const decode = (value: any): number[] => {
    const sample = Array.isArray(value) ? value : [0, 0];
    return [Number(sample[0]) * normalScale[0], Number(sample[1]) * normalScale[1]];
  };
  const x = decode(maps?.x), y = decode(maps?.y), z = decode(maps?.z);
  const perturb = [
    y[0] * weights[1] + sign[2] * z[0] * weights[2],
    x[1] * weights[0] + z[1] * weights[2],
    -sign[0] * x[0] * weights[0] - sign[1] * y[1] * weights[1],
  ];
  const out = n.map((value, axis) => value + perturb[axis]);
  const outLength = Math.hypot(out[0], out[1], out[2]);
  return out.map(value => value / outLength);
}

// R5 rock constants (see js/99a WALL_ROCK_PARAMS for the per-lithology table).
const WALL_ROCK_TRIPLANAR_ALL_SURFACES = true;
const WALL_ROCK_NORMAL_SCALE = 1.2;      // was 2.0: the genesis relief is one octave of a rock, not the rock
const WALL_ROCK_RELIEF_STRENGTH = 0.5;   // × the family relief (normal + AO); 0.7 left the 5×5 tile faintly periodic at druse scale (peak 1.52)
const WALL_ROCK_GRAIN_STRENGTH = 0.8;    // × the lithology grain amount into the grain normal octave (0.55 read soft)
// The authenticated surfaces colour their vertices with a fixed orientation palette (floor 0xA85820,
// wall 0xD2691E, ceiling 0xE8782C — the 2-D map's legibility cue) and blend a water tint (35 %)
// below the water plane. The rock's colour is the lithology skin's; the renderer DECODES the palette
// into a ±8 % orientation shade and keeps the water blend, leaving the surface buffers untouched.
const WALL_ROCK_LEGACY_PALETTE: Array<[string, number, number, number]> = [
  ['floor', 0xA8 / 255, 0x58 / 255, 0x20 / 255],
  ['wall', 0xD2 / 255, 0x69 / 255, 0x1E / 255],
  ['ceiling', 0xE8 / 255, 0x78 / 255, 0x2C / 255],
];
const WALL_ROCK_ORIENT_SHADE: Record<string, number> = { floor: 0.92, wall: 1.0, ceiling: 0.96 };
const WALL_ROCK_WATER_TINT = [0.43, 0.74, 0.96];
const WALL_ROCK_WATER_MIX = 0.35;
const WALL_ROCK_DECODE_TOLERANCE = 0.02;   // squared distance; the six candidates are ≥ 0.05 apart
function _topoWallRockTint(colors: Float32Array): Float32Array {
  if (!colors || colors.length % 3 !== 0) return colors;
  const cand: Array<{ r: number; g: number; b: number; shade: number; water: boolean }> = [];
  for (const [orient, r, g, b] of WALL_ROCK_LEGACY_PALETTE) {
    const shade = WALL_ROCK_ORIENT_SHADE[orient];
    cand.push({ r, g, b, shade, water: false });
    const w = WALL_ROCK_WATER_TINT, k = 1 - WALL_ROCK_WATER_MIX, m = WALL_ROCK_WATER_MIX;
    cand.push({ r: r * k + w[0] * m, g: g * k + w[1] * m, b: b * k + w[2] * m, shade, water: true });
  }
  const out = new Float32Array(colors.length);
  const w = WALL_ROCK_WATER_TINT, k = 1 - WALL_ROCK_WATER_MIX, m = WALL_ROCK_WATER_MIX;
  for (let i = 0; i < colors.length; i += 3) {
    const r = colors[i], g = colors[i + 1], b = colors[i + 2];
    let best: any = null, bestD = Infinity;
    for (const c of cand) {
      const d = (c.r - r) * (c.r - r) + (c.g - g) * (c.g - g) + (c.b - b) * (c.b - b);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best || bestD > WALL_ROCK_DECODE_TOLERANCE) { out[i] = r; out[i + 1] = g; out[i + 2] = b; continue; }
    if (best.water) { out[i] = best.shade * k + w[0] * m; out[i + 1] = best.shade * k + w[1] * m; out[i + 2] = best.shade * k + w[2] * m; }
    else { out[i] = best.shade; out[i + 1] = best.shade; out[i + 2] = best.shade; }
  }
  return out;
}

function _topoConfigureCavityWallMaterial(state: any, source: any, wall: any,
                                           expectedState: any = null): any {
  const target = state?.cavity;
  const material = target?.material;
  if (!material) return null;
  const materialState = expectedState
    ? CavityWallMaterialState.assertReceipt(wall, expectedState)
    : CavityWallMaterialState.create(wall);
  const litho = materialState.lithology;
  if (state._matrixLitho !== litho && typeof _matrixSkinTexture === 'function') {
    state._matrixLitho = litho;
    material.map = _matrixSkinTexture(litho) || null;
    material.needsUpdate = true;
  }
  const fam = materialState.relief_family;
  const rep = materialState.relief_repeat;
  const key = `${fam}|${rep[0]}x${rep[1]}`;
  const ru = material.userData?.reliefAO;
  if (state._wallReliefKey !== key) {
    const famChanged = state._wallReliefFam !== fam;
    state._wallReliefKey = key;
    if (famChanged) {
      state._wallReliefFam = fam;
      const nrm = typeof _wallReliefNormalMap === 'function'
        ? _wallReliefNormalMap(fam) : null;
      material.normalMap = nrm || null;
      if (nrm && material.normalScale?.set) material.normalScale.set(WALL_ROCK_NORMAL_SCALE, WALL_ROCK_NORMAL_SCALE);
      if (ru && typeof _wallReliefAOMap === 'function') {
        const ao = _wallReliefAOMap(fam);
        if (ao) { ru.uReliefAO.value = ao; ru.uReliefAOAmt.value = WALL_RELIEF_AO_AMT; }
        else ru.uReliefAOAmt.value = 0;
      }
    }
    if (material.normalMap?.repeat?.set) material.normalMap.repeat.set(rep[0], rep[1]);
    if (ru?.uReliefAORepeat?.value) ru.uReliefAORepeat.value.set(rep[0], rep[1]);
    material.needsUpdate = true;
  }
  // R5: object-millimetre triplanar for BOTH surface sources. The lat-long uv path stretched the
  // skin and relief around the shell (the golf-ball dimples and the parallel ridges of F8 were
  // the 5×5 / 1×6 repeats seen around the poles and the equator); the wall mesh's positions are
  // object == world millimetres exactly like the marching-cubes surface.
  const materialSpace = WALL_ROCK_TRIPLANAR_ALL_SURFACES || source?.mode === 'marching-cubes';
  const rock = typeof wallRockParamsFor === 'function' ? wallRockParamsFor(litho, materialState.genesis) : null;
  if (rock) {
    if (material.roughness !== rock.roughness) { material.roughness = rock.roughness; material.needsUpdate = true; }
    material.metalness = 0;
    if (ru) {
      if (ru.uWallGrainAmt) ru.uWallGrainAmt.value = rock.grain * WALL_ROCK_GRAIN_STRENGTH;
      if (ru.uWallStainAmt) ru.uWallStainAmt.value = rock.stain;
      if (ru.uWallReliefAmt) ru.uWallReliefAmt.value = WALL_ROCK_RELIEF_STRENGTH;
      if (ru.uWallGrain && !ru.uWallGrain.value && typeof _wallGrainNormalMap === 'function') ru.uWallGrain.value = _wallGrainNormalMap();
    }
    if (material.normalScale?.set && material.normalMap) material.normalScale.set(WALL_ROCK_NORMAL_SCALE, WALL_ROCK_NORMAL_SCALE);
  }
  const reliefScale = [
    rep[0] / materialState.relief_reference_span_mm,
    rep[1] / materialState.relief_reference_span_mm,
  ];
  if (ru) {
    ru.uWallMaterialSpaceEnabled.value = materialSpace ? 1 : 0;
    ru.uWallMatrixScale.value.set(
      materialState.matrix_scale_uv_per_mm[0], materialState.matrix_scale_uv_per_mm[1],
    );
    ru.uWallReliefScale.value.set(reliefScale[0], reliefScale[1]);
  }
  const receipt = Object.freeze({
    schema: CAVITY_MATERIAL_SPACE_SCHEMA,
    mapping: materialSpace ? 'triplanar-object-millimetres' : 'legacy-spherical-uv',
    blend_exponent: materialSpace ? 4 : null,
    rock: rock ? { roughness: rock.roughness, grain: +(rock.grain * WALL_ROCK_GRAIN_STRENGTH).toFixed(3), stain: rock.stain, relief: WALL_ROCK_RELIEF_STRENGTH, normal_scale: WALL_ROCK_NORMAL_SCALE, palette: 'orientation-shade' } : null,
    matrix_scale_uv_per_mm: materialState.matrix_scale_uv_per_mm,
    relief_scale_uv_per_mm: Object.freeze(reliefScale),
    lithology: litho,
    relief_family: fam,
    material_state_digest: materialState.material_state_digest,
    source_surface_digest: source?.buffers?.buffer_digest || source?.buffers?.sig || null,
  });
  state.cavityMaterialSpaceReceipt = receipt;
  return receipt;
}

// PHASE-2-CAVITY-MESH: signature delegates to WallMesh._signature so
// the renderer and the mesh agree on staleness. Kept as a thin
// indirection so the renderer's call sites don't change shape.
function _topoCavitySignature(wall: any, sim: any): string {
  if (!wall) return '';
  if (typeof WallMesh !== 'undefined' && (WallMesh as any)._signature) {
    return (WallMesh as any)._signature(wall, sim);
  }
  // Fallback (shouldn't hit in production — the bundle always loads 23
  // before this code runs — but keep the legacy formula handy for any
  // headless harness that skips the mesh module).
  if (!wall.rings || !wall.rings.length) return '';
  const ring0 = wall.rings[0];
  const N = ring0 ? ring0.length : 0;
  if (Number.isSafeInteger(wall._geometry_revision)) {
    return `${wall.ring_count}|${N}|rev:${wall._geometry_revision}`;
  }
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  const scratch = new DataView(new ArrayBuffer(8));
  for (let r = 0; r < wall.rings.length; r++) {
    const ring = wall.rings[r];
    if (!ring) continue;
    for (let c = 0; c < N; c++) {
      const cell = ring[c];
      if (!cell) continue;
      const radius = (Number(cell.base_radius_mm) || 0) + (Number(cell.wall_depth) || 0);
      scratch.setFloat64(0, radius, true);
      for (let byte = 0; byte < 8; byte++) {
        const value = scratch.getUint8(byte);
        hashA = Math.imul(hashA ^ value, 0x01000193) >>> 0;
        hashB = (Math.imul(hashB ^ value, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
      }
    }
  }
  return `${wall.ring_count}|${N}|${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
}

function _topoMarchingCubesCavityEnabled(): boolean {
  if (_topoMarchingCubesCavityOverride != null) return _topoMarchingCubesCavityOverride;
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const value = new URLSearchParams(window.location.search || '').get('mc_cavity');
    return value === '1' || value === 'true' || value === 'on';
  } catch (_) {
    return false;
  }
}

function _topoMarchingCubesResolution(): number {
  if (_topoMarchingCubesResolutionOverride != null) return _topoMarchingCubesResolutionOverride;
  if (typeof window !== 'undefined' && window.location) {
    try {
      const raw = Number(new URLSearchParams(window.location.search || '').get('mc_resolution'));
      if (Number.isFinite(raw) && raw >= 8 && raw <= 128) return Math.round(raw);
    } catch (_) { /* retain the measured 48^3 default */ }
  }
  return 48;
}

function _topoSetMarchingCubesCavity(enabled: boolean, resolution = 48): void {
  const parsed = Math.round(Number(resolution));
  if (!Number.isFinite(parsed) || parsed < 8 || parsed > 128) {
    throw new RangeError('Marching Cubes cavity resolution must be from 8 through 128');
  }
  // Validate the complete request before changing either override. A rejected
  // debug command must not accidentally enable the shadow renderer.
  _topoMarchingCubesCavityOverride = !!enabled;
  _topoMarchingCubesResolutionOverride = parsed;
  if (_topoThreeState) {
    // This is also the explicit operator retry after a driver/context change.
    // A frame loop alone must never hammer a previously rejected snapshot.
    _topoResetCavityFieldFailures(_topoThreeState);
    _topoThreeState.cavityFieldFallbackReason = null;
    _topoThreeState.cavityFieldCapabilityReceipt = null;
    _topoThreeState.cavitySig = '';
  }
}

function _topoResetCavityFieldFailures(state: any): void {
  if (!state) return;
  const gl = state.renderer && state.renderer.getContext && state.renderer.getContext();
  if (gl) _CAVITY_R32F_PROBE_CACHE.delete(gl);
  if (state.cavityFieldFailedDigests) state.cavityFieldFailedDigests.clear();
  if (state.cavityFieldFailedReasons) state.cavityFieldFailedReasons.clear();
  // This function is called only for explicit operator retry and restored
  // context. Those are the two events allowed to re-arm a terminally failed
  // Three shader path; animation frames must remain on canvas.
  state.threeShaderUnusable = false;
}

function _topoThreeRendererEffective(state = _topoThreeState): boolean {
  // The exact Cartesian cavity authority chooses which geometry is truthful;
  // it must not choose the player's presentation. A prior repair used
  // `cavityAuthorityActive` as an implicit WebGL override so the legacy polar
  // painter could never misrepresent a Cartesian cavity. That also made the
  // visible ⬚ control lie: its state flipped to off while WebGL stayed on.
  // js/99b owns the complementary fail-closed route: when the operator selects
  // flat presentation for an exact cavity it draws the authenticated CPU
  // Cartesian cross-section, never the legacy polar/unwrapped wall.
  return _topoUseThreeRenderer === true
    && _topoThreeAvailable()
    && _topoThreeInitializationFailure === null
    && !(state && (state.threeShaderUnusable || state.cavityAuthorityUnrenderable));
}

function _topoAttemptEffectiveThree(state: any, attempt: () => boolean): boolean {
  if (state && state.threeShaderUnusable) return false;
  return attempt();
}

function _topoCavityClipCapabilityReceipt(state = _topoThreeState): any {
  const renderer = state && state.renderer;
  const gl = renderer && typeof renderer.getContext === 'function' ? renderer.getContext() : null;
  if (!gl) {
    return Object.freeze({
      schema: 'cavity-clip-capability-v2',
      available: false,
      reason: 'webgl-context-unavailable',
    });
  }
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined'
    && gl instanceof WebGL2RenderingContext;
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  const r32fProbe = isWebGL2 ? _topoProbeCavityR32F(gl, renderer) : {
    passed: false,
    reason: 'webgl2-required',
  };
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const vertexPrecision = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
  const fragmentPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const maxTextureSize = Number(gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) || 0);
  const maxTextureUnits = Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 0);
  const requiredTextureUnits = 4;
  const highpAvailable = !!(vertexPrecision && vertexPrecision.precision > 0
    && fragmentPrecision && fragmentPrecision.precision > 0);
  const dimensions = state && state.cavityFieldContract
    ? state.cavityFieldContract.dimensions : null;
  const resolutionFits = !!(dimensions && dimensions.every((value: number) => value <= maxTextureSize));
  const supported = isWebGL2 && r32fProbe.passed
    && maxTextureSize > 0 && maxTextureUnits >= requiredTextureUnits && highpAvailable
    && (!dimensions || resolutionFits);
  return Object.freeze({
    schema: 'cavity-clip-capability-v2',
    available: supported,
    reason: supported ? 'r32f-nearest-freudenthal-sampling-supported' : (
      !isWebGL2 ? 'webgl2-required'
        : !r32fProbe.passed ? `r32f-probe-failed:${r32fProbe.reason}`
          : !resolutionFits && dimensions ? 'field-exceeds-max-3d-texture-size'
            : !highpAvailable ? 'highp-float-required'
              : 'insufficient-texture-units'
    ),
    webgl_version: String(gl.getParameter(gl.VERSION) || ''),
    shading_language_version: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''),
    vendor: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '') : null,
    renderer: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : null,
    max_3d_texture_size: maxTextureSize,
    max_fragment_texture_units: maxTextureUnits,
    required_fragment_texture_units: requiredTextureUnits,
    oes_texture_float_linear: floatLinear,
    r32f_sampling_probe: { ...r32fProbe },
    vertex_highp_precision_bits: vertexPrecision ? vertexPrecision.precision : 0,
    fragment_highp_precision_bits: fragmentPrecision ? fragmentPrecision.precision : 0,
    field_dimensions: dimensions ? Array.from(dimensions) : null,
    field_resolution_fits: dimensions ? resolutionFits : null,
    active_clip_mode: state && state.clipUniforms
      ? Number(state.clipUniforms.uCavityClipMode.value || 0) : 0,
    field_snapshot_digest: state && state.cavityFieldContract
      ? state.cavityFieldContract.snapshot_digest : null,
    upload_receipt: state && state.cavityFieldUploadReceipt
      ? { ...state.cavityFieldUploadReceipt } : null,
    fallback_reason: state && state.cavityFieldFallbackReason
      ? String(state.cavityFieldFallbackReason) : null,
  });
}

function _topoPublishCavityClipReceipt(state: any, receipt?: any): void {
  const canvas = state && state.renderer && state.renderer.domElement;
  if (!canvas || !canvas.dataset) return;
  try {
    const base = receipt || state.cavityFieldCapabilityReceipt
      || _topoCavityClipCapabilityReceipt(state);
    const contract = state.cavityFieldContract;
    canvas.dataset.cavityClipReceipt = JSON.stringify({
      ...base,
      field_dimensions: contract ? Array.from(contract.dimensions) : null,
      field_resolution_fits: contract && base.max_3d_texture_size != null
        ? contract.dimensions.every((value: number) => value <= base.max_3d_texture_size)
        : null,
      active_clip_mode: state.clipUniforms
        ? Number(state.clipUniforms.uCavityClipMode.value || 0) : 0,
      field_snapshot_digest: contract ? contract.snapshot_digest : null,
      upload_receipt: state.cavityFieldUploadReceipt
        ? { ...state.cavityFieldUploadReceipt } : null,
      fallback_reason: state.cavityFieldFallbackReason
        ? String(state.cavityFieldFallbackReason) : null,
    });
  } catch (_) {
    canvas.dataset.cavityClipReceipt = JSON.stringify({
      schema: 'cavity-clip-capability-v2',
      available: false,
      reason: 'receipt-serialization-failed',
    });
  }
}

function _topoHandleCavityContextLost(state: any): void {
  if (!state) return;
  state.cavityFieldFallbackReason = 'webgl-context-lost';
  state.cavityFieldCapabilityReceipt = null;
  _topoDisposeCavityFieldTexture(state);
  state.cavitySig = '';
  state.crystalsSig = '';
  if (state.cavity) state.cavity.visible = false;
  if (state.crystals) state.crystals.visible = false;
  _topoPublishCavityClipReceipt(state, Object.freeze({
    schema: 'cavity-clip-capability-v2',
    available: false,
    reason: 'webgl-context-lost',
  }));
}

function _topoProbeCavityR32F(gl: any, renderer?: any): any {
  if (!gl || typeof gl.createTexture !== 'function') {
    return Object.freeze({ passed: false, reason: 'invalid-context' });
  }
  const cached = _CAVITY_R32F_PROBE_CACHE.get(gl);
  if (cached) return cached;
  let volume: any = null;
  let target: any = null;
  let framebuffer: any = null;
  let vertexShader: any = null;
  let fragmentShader: any = null;
  let program: any = null;
  const finish = (receipt: any) => {
    try { if (program) gl.deleteProgram(program); } catch (_) {}
    try { if (vertexShader) gl.deleteShader(vertexShader); } catch (_) {}
    try { if (fragmentShader) gl.deleteShader(fragmentShader); } catch (_) {}
    try { if (framebuffer) gl.deleteFramebuffer(framebuffer); } catch (_) {}
    try { if (volume) gl.deleteTexture(volume); } catch (_) {}
    try { if (target) gl.deleteTexture(target); } catch (_) {}
    try { if (renderer && typeof renderer.resetState === 'function') renderer.resetState(); } catch (_) {}
    const frozen = Object.freeze(receipt);
    _CAVITY_R32F_PROBE_CACHE.set(gl, frozen);
    return frozen;
  };
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(String(gl.getShaderInfoLog(shader) || 'shader-compile-failed'));
      }
      return shader;
    };
    vertexShader = compile(gl.VERTEX_SHADER, `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`);
    fragmentShader = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uVolume;
out vec4 outColor;
float gridValue(vec3 gridIndex) {
  return texture(uVolume, (gridIndex + vec3(0.5)) / vec3(2.0)).r;
}
void main() {
  float px = gl_FragCoord.x;
  float value = px < 1.0 ? gridValue(vec3(0.0, 0.0, 0.0))
    : px < 2.0 ? gridValue(vec3(1.0, 0.0, 0.0))
    : px < 3.0 ? gridValue(vec3(0.0, 1.0, 0.0))
    : px < 4.0 ? gridValue(vec3(0.0, 0.0, 1.0))
    : 0.25 * gridValue(vec3(0.0, 0.0, 0.0))
      + 0.5 * gridValue(vec3(1.0, 0.0, 1.0))
      + 0.25 * gridValue(vec3(1.0, 1.0, 1.0));
  outColor = vec4(value, value, value, 1.0);
}`);
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(String(gl.getProgramInfoLog(program) || 'program-link-failed'));
    }

    // x-fastest asymmetric landmarks: x + 2y + 4z, normalized by 7.
    // Four texel centres independently pin all three positive axes; the fifth
    // pins manual Freudenthal weighting using nearest texel-centre reads.
    const samples = new Float32Array([0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7, 1]);
    gl.activeTexture(gl.TEXTURE0);
    volume = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, volume);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R32F, 2, 2, 2, 0, gl.RED, gl.FLOAT, samples);

    target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 5, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('probe-framebuffer-incomplete');
    }
    gl.viewport(0, 0, 5, 1);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uVolume'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(5 * 4);
    gl.readPixels(0, 0, 5, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const expected = [0, 36, 73, 146, 155];
    const observed = [pixels[0], pixels[4], pixels[8], pixels[12], pixels[16]];
    const errors = observed.map((value, index) => Math.abs(value - expected[index]));
    const maxError = Math.max(...errors);
    const glError = gl.getError();
    return finish({
      passed: glError === gl.NO_ERROR && maxError <= 2,
      reason: glError === gl.NO_ERROR ? (maxError <= 2 ? 'ok' : 'sample-mismatch') : `gl-error-${glError}`,
      format: 'R32F',
      filter: 'NEAREST',
      interpolation: 'freudenthal-piecewise-linear-v1',
      sample_coordinates: [
        [0.25, 0.25, 0.25], [0.75, 0.25, 0.25], [0.25, 0.75, 0.25],
        [0.25, 0.25, 0.75], [0.625, 0.375, 0.625],
      ],
      expected_red_u8: expected,
      observed_red_u8: observed,
      absolute_error_u8: errors,
      max_absolute_error_u8: maxError,
    });
  } catch (error) {
    return finish({
      passed: false,
      reason: error instanceof Error ? error.message : String(error),
      format: 'R32F',
      filter: 'NEAREST',
      interpolation: 'freudenthal-piecewise-linear-v1',
    });
  }
}

// Pure renderer-facing adapter used by both the Three.js path and integration
// tests. `clipMesh` remains the chemistry/cell topology bridge while MC wall,
// crystal clipping, and explicit anchor authority consume one immutable field /
// surface pair. The developer shadow flag is still independent while WallMesh
// owns anchors, but it may never override or suppress an activated provider.
function _topoCavitySurfaceSource(wall: any, sim: any,
                                  useMarchingCubes = _topoMarchingCubesCavityEnabled(),
                                  resolution = _topoMarchingCubesResolution()): any {
  if (!wall) return null;
  const clipMesh = wall.meshFor ? wall.meshFor(sim) : null;
  if (!clipMesh) return null;
  const active = wall.activeCavitySurfaceAnchorProvider
    ? wall.activeCavitySurfaceAnchorProvider() : null;
  if (active?.receipt?.kind === 'cavity-field') {
    const field = active.field;
    const buffers = active.surface;
    MarchingCubesExtractor.verifyBuffers(buffers);
    if (!field || field.sig !== active.receipt.field_signature
        || field.snapshotDigest !== active.receipt.field_snapshot_digest
        || buffers.sig !== active.receipt.surface_signature
        || buffers.buffer_digest !== active.receipt.surface_buffer_digest
        || field.surfaceSignature(active.receipt.isovalue) !== buffers.sig) {
      throw new Error('active cavity surface authority is not one authenticated field/surface pair');
    }
    return {
      mode: 'marching-cubes', buffers, clipMesh, clipField: field,
      providerAuthority: true, providerReceipt: active.receipt,
      sig: `mc-authority|${buffers.sig}|clip-field:${field.snapshotDigest}`,
    };
  }
  if (wall._cavityProductionAuthorityContract) {
    throw new Error('production cavity authority is unavailable: '
      + (wall._cavitySurfaceAuthorityFailure || 'authenticated surface missing'));
  }
  if (useMarchingCubes && !wall._disableMarchingCubesCavity && wall.cavitySurfaceFor) {
    try {
      const buffers = wall.cavitySurfaceFor({ resolution, isovalue: 0 });
      if (buffers) {
        MarchingCubesExtractor.verifyBuffers(buffers);
        // clipMesh.sig may change for wall_depth even though the authored base MC
        // buffers stay cached. Include it so clip uniforms refresh without
        // paying for a byte-identical field/extraction rebuild.
        const field = wall.cavityFieldFor({ resolution });
        if (!field || field.snapshotDigest !== buffers.source_field_snapshot_digest
            || field.surfaceSignature(buffers.isovalue) !== buffers.sig) {
          throw new Error('Marching Cubes wall and clip field are not the same immutable snapshot');
        }
        return { mode: 'marching-cubes', buffers, clipMesh, clipField: field,
          providerAuthority: false,
          sig: `mc|${buffers.sig}|clip-field:${field.snapshotDigest}` };
      }
      const failure = wall._cavitySurfaceFailure;
      if (failure && !failure.reported) {
        failure.reported = true;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[marching-cubes] shadow surface rejected; using WallMesh', failure.error);
        }
      }
    } catch (error) {
      // Malformed field inputs also fail closed to the canonical renderer.
      // Expected extraction rejections are cached/reported above.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[marching-cubes] shadow surface rejected; using WallMesh', error);
      }
    }
  }
  return { mode: 'wall-mesh', buffers: clipMesh, clipMesh, clipField: null,
    sig: `wall-mesh|${clipMesh.sig}` };
}

function _topoDisposeCavityFieldTexture(state: any): void {
  const texture = state && state.clipUniforms && state.clipUniforms.uCavityField.value;
  const wasFieldVariant = !!(state && state.clipUniforms
    && state.clipUniforms.uCavityClipMode.value === 1);
  if (texture && texture.dispose) texture.dispose();
  if (state && state.clipUniforms) {
    state.clipUniforms.uCavityField.value = null;
    state.clipUniforms.uCavityClipMode.value = 0;
  }
  if (state) {
    state.cavityFieldContract = null;
    state.cavityFieldUploadReceipt = null;
    state.cavityFieldCapabilityReceipt = null;
    state.cavityClipField = null;
    if (wasFieldVariant) state.crystalsSig = '';
  }
}

function _topoRejectActiveCavityFieldClip(
  state: any, reason: string, texture?: any, scheduleFallback = true,
): void {
  if (!state) return;
  const digest = state.cavityFieldContract && state.cavityFieldContract.snapshot_digest;
  state.cavityFieldFallbackReason = String(reason || 'cavity-field-clip-rejected');
  if (digest) {
    if (!state.cavityFieldFailedDigests) state.cavityFieldFailedDigests = new Set<string>();
    if (!state.cavityFieldFailedReasons) state.cavityFieldFailedReasons = new Map<string, string>();
    state.cavityFieldFailedDigests.add(digest);
    state.cavityFieldFailedReasons.set(digest, state.cavityFieldFallbackReason);
  }
  if (state.clipUniforms) state.clipUniforms.uCavityClipMode.value = 0;
  state.cavityClipField = null;
  state.cavitySig = '';
  if (state.cavity) state.cavity.visible = false;
  if (state.crystals) state.crystals.visible = false;
  if (texture && texture.dispose) texture.dispose();
  _topoPublishCavityClipReceipt(state);
  if (scheduleFallback && typeof requestAnimationFrame === 'function' && typeof topoRender === 'function') {
    requestAnimationFrame(() => topoRender());
  }
}

function _topoCavityShaderProgramsRunnable(programs: any[]): boolean {
  if (!Array.isArray(programs)) return false;
  for (const program of programs) {
    const diagnostics = program && program.diagnostics;
    if (diagnostics && diagnostics.runnable === false) return false;
  }
  return true;
}

function _topoCompileCavityShaderPrograms(state: any): boolean {
  const renderer = state && state.renderer;
  if (!renderer || typeof renderer.compile !== 'function') return false;
  try {
    const materials = renderer.compile(state.scene, state.camera);
    if (!materials || typeof materials[Symbol.iterator] !== 'function') return false;
    const programs: any[] = [];
    for (const material of materials) {
      if (!material?.userData?.vuggCavityClipVariant) continue;
      const properties = renderer.properties && typeof renderer.properties.get === 'function'
        ? renderer.properties.get(material) : null;
      const materialPrograms = properties && properties.programs;
      if (materialPrograms && typeof materialPrograms.values === 'function') {
        for (const program of materialPrograms.values()) programs.push(program);
      } else if (properties && properties.currentProgram) {
        programs.push(properties.currentProgram);
      } else {
        return false;
      }
    }
    // Three defers link diagnostics until its first uniform/attribute access.
    // Force that access during compile, before any cavity-clipped draw is
    // permitted. Only programs owned by current traversed, tagged materials
    // participate; stale/unrelated renderer.info programs cannot poison it.
    for (const program of programs) {
      if (program && typeof program.getUniforms === 'function') program.getUniforms();
    }
    return _topoCavityShaderProgramsRunnable(programs);
  } catch (_) {
    return false;
  }
}

function _topoRenderPreparedCavityScene(state: any, installFallback: () => boolean | void): boolean {
  if (!state || !state.renderer) return false;
  let runnable = _topoCompileCavityShaderPrograms(state);
  if (state.clipUniforms.uCavityClipMode.value === 1 && !runnable) {
    _topoRejectActiveCavityFieldClip(
      state, 'cavity-field-shader-link-failed', undefined, false,
    );
    if (installFallback() === false) return false;
    runnable = _topoCompileCavityShaderPrograms(state);
  }
  // The field failure rebuilds every clipped material as the distinct
  // polar-r32f-free shader variant. Validate that fallback too. If even the
  // canonical polar program is unrunnable, the caller must use canvas 2-D;
  // never draw a known-bad WebGL program.
  if (!runnable) {
    state.cavityFieldFallbackReason = 'polar-cavity-shader-link-failed';
    state.threeShaderUnusable = true;
    _topoPublishCavityClipReceipt(state);
    return false;
  }
  state.threeShaderUnusable = false;
  const t0 = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : 0;
  _topoRenderFrame(state);
  if (t0) _topoLightingNoteRenderTime(state, performance.now() - t0);
  return true;
}

function _topoInstallCavityFieldClip(state: any, field: CavityScalarField, surface: any): boolean {
  if (!state || !field || !surface) return false;
  const contract = field.textureContract(surface.isovalue);
  if (state.cavityFieldFailedDigests
      && state.cavityFieldFailedDigests.has(contract.snapshot_digest)) {
    state.cavityFieldFallbackReason = state.cavityFieldFailedReasons
      && state.cavityFieldFailedReasons.get(contract.snapshot_digest)
      || 'previous-field-install-failed';
    _topoPublishCavityClipReceipt(state);
    return false;
  }
  if (state.cavityFieldContract
      && state.cavityFieldContract.snapshot_digest === contract.snapshot_digest
      && state.cavityFieldContract.isovalue === contract.isovalue
      && state.clipUniforms.uCavityField.value
      && state.clipUniforms.uCavityClipMode.value === 1) {
    return true;
  }
  if (!state.cavityFieldContract
      || state.cavityFieldContract.snapshot_digest !== contract.snapshot_digest
      || state.cavityFieldContract.isovalue !== contract.isovalue) {
    state.cavityFieldUploadReceipt = null;
  }
  state.cavityFieldContract = contract;
  const capability = _topoCavityClipCapabilityReceipt(state);
  state.cavityFieldCapabilityReceipt = capability;
  if (!capability.available) {
    state.cavityFieldFallbackReason = capability.reason;
    if (!state.cavityFieldFailedDigests) state.cavityFieldFailedDigests = new Set<string>();
    if (!state.cavityFieldFailedReasons) state.cavityFieldFailedReasons = new Map<string, string>();
    state.cavityFieldFailedDigests.add(contract.snapshot_digest);
    state.cavityFieldFailedReasons.set(contract.snapshot_digest, capability.reason);
    _topoDisposeCavityFieldTexture(state);
    _topoPublishCavityClipReceipt(state, capability);
    return false;
  }
  const upload = field.createTextureUpload(surface.isovalue);
  let texture: any = null;
  try {
    upload.consume((values: Float32Array) => {
      texture = new THREE.Data3DTexture(
        values,
        contract.dimensions[0], contract.dimensions[1], contract.dimensions[2],
      );
    });
  } catch (error) {
    state.cavityFieldFallbackReason = `texture-construction-failed:${
      error instanceof Error ? error.message : String(error)}`;
    if (!state.cavityFieldFailedDigests) state.cavityFieldFailedDigests = new Set<string>();
    if (!state.cavityFieldFailedReasons) state.cavityFieldFailedReasons = new Map<string, string>();
    state.cavityFieldFailedDigests.add(contract.snapshot_digest);
    state.cavityFieldFailedReasons.set(contract.snapshot_digest, state.cavityFieldFallbackReason);
    _topoDisposeCavityFieldTexture(state);
    _topoPublishCavityClipReceipt(state);
    return false;
  }
  if (!texture) return false;
  const previous = state.clipUniforms.uCavityField.value;
  texture.format = THREE.RedFormat;
  texture.type = THREE.FloatType;
  texture.internalFormat = 'R32F';
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  // Force the lazy Three upload before publishing either half of the MC/field
  // pair. A constructor, allocation, byte-integrity, or GL error falls back to
  // WallMesh while the previous pair is still untouched.
  try {
    const uploadGl = state.renderer && state.renderer.getContext
      ? state.renderer.getContext() : null;
    if (!state.renderer || typeof state.renderer.initTexture !== 'function' || !uploadGl) {
      throw new Error('forced GPU texture initialization is unavailable');
    }
    let priorError = uploadGl.NO_ERROR;
    for (let i = 0; i < 16; i++) {
      priorError = uploadGl.getError();
      if (priorError === uploadGl.NO_ERROR) break;
    }
    if (priorError !== uploadGl.NO_ERROR) {
      throw new Error(`WebGL error state could not be cleared (${priorError})`);
    }
    state.renderer.initTexture(texture);
    const glError = uploadGl.getError();
    if (glError !== uploadGl.NO_ERROR) {
      throw new Error(`R32F cavity texture GPU upload failed (GL error ${glError})`);
    }
    state.cavityFieldUploadReceipt = upload.verifyAfterUpload();
  } catch (error) {
    state.cavityFieldFallbackReason = error instanceof Error ? error.message : String(error);
    if (!state.cavityFieldFailedDigests) state.cavityFieldFailedDigests = new Set<string>();
    if (!state.cavityFieldFailedReasons) state.cavityFieldFailedReasons = new Map<string, string>();
    state.cavityFieldFailedDigests.add(contract.snapshot_digest);
    state.cavityFieldFailedReasons.set(contract.snapshot_digest, state.cavityFieldFallbackReason);
    texture.dispose();
    _topoDisposeCavityFieldTexture(state);
    _topoPublishCavityClipReceipt(state, capability);
    return false;
  }
  const wasFieldVariant = state.clipUniforms.uCavityClipMode.value === 1;
  state.clipUniforms.uCavityField.value = texture;
  if (!state.clipUniforms.uCavityFieldDimensions) {
    state.clipUniforms.uCavityFieldDimensions = { value: new THREE.Vector3() };
  }
  state.clipUniforms.uCavityFieldDimensions.value.fromArray(contract.dimensions);
  state.clipUniforms.uCavityFieldWorldScale.value.fromArray(contract.world_to_texture_scale);
  state.clipUniforms.uCavityFieldWorldBias.value.fromArray(contract.world_to_texture_bias);
  state.clipUniforms.uCavityFieldIsovalue.value = contract.isovalue;
  state.clipUniforms.uCavityClipMode.value = 1;
  if (!wasFieldVariant) state.crystalsSig = '';
  state.cavityClipField = field;
  state.cavityFieldFallbackReason = null;
  _topoPublishCavityClipReceipt(state, capability);
  if (previous && previous !== texture && previous.dispose) previous.dispose();
  return true;
}

// PHASE-2-CAVITY-MESH: cavity geometry now sources from WallMesh
// (js/23-geometry-wall-mesh.ts). The renderer's job here is reduced
// to: ask the wall for its mesh, copy the mesh's buffers into a
// THREE.BufferGeometry, push it onto state.cavity, and update clip
// uniforms. The vertex math (positions, colors, normals,
// triangulation) lives in WallMesh.recompute — same formulas as
// before, just centralized so future tessellations (icosphere,
// geodesic, irregular) can swap in without touching this file.
function _topoBuildCavityGeometry(state: any, wall: any, sim: any,
                                  forceWallMesh = false,
                                  renderConditions: any = sim?.conditions,
                                  expectedAppearance: any = null,
                                  expectedMaterialState: any = null) {
  if (!wall || !wall.rings || !wall.rings.length) return false;
  let source: any;
  try {
    source = _topoCavitySurfaceSource(
      wall, sim, forceWallMesh ? false : _topoMarchingCubesCavityEnabled(),
    );
  } catch (error) {
    state.cavityFieldFallbackReason = error instanceof Error ? error.message : String(error);
    state.cavityAuthorityUnrenderable = true;
    if (state.cavity) state.cavity.visible = false;
    if (state.crystals) state.crystals.visible = false;
    _topoPublishCavityClipReceipt(state);
    return false;
  }
  if (!source) return false;
  if (source.mode === 'marching-cubes'
      && !_topoInstallCavityFieldClip(state, source.clipField, source.buffers)) {
    if (source.providerAuthority) {
      // Renderer capability is presentation state, never geological state. An
      // incapable device withholds the view instead of drawing a different wall
      // or mutating the deterministic provider command/fingerprint.
      state.cavityAuthorityUnrenderable = true;
      if (state.cavity) state.cavity.visible = false;
      if (state.crystals) state.crystals.visible = false;
      _topoPublishCavityClipReceipt(state);
      return false;
    }
    source = _topoCavitySurfaceSource(wall, sim, false, _topoMarchingCubesResolution());
  }
  const mesh = source.clipMesh;
  const surface = source.buffers;
  let appearance: any;
  try {
    appearance = CavityWaterAppearance.create(wall, renderConditions, {
      activeProvider: source.providerAuthority
        ? wall.activeCavitySurfaceAnchorProvider?.() : null,
      providerReceipt: source.providerReceipt || { kind: 'wall-mesh' },
      surface,
      sim,
    });
    if (expectedAppearance
        && appearance.receipt.appearance_digest !== expectedAppearance.appearance_digest) {
      throw new RangeError('rendered cavity appearance differs from authenticated replay');
    }
  } catch (error) {
    state.cavityFieldFallbackReason = error instanceof Error ? error.message : String(error);
    state.cavityAuthorityUnrenderable = true;
    if (state.cavity) state.cavity.visible = false;
    if (state.crystals) state.crystals.visible = false;
    if (state.waterInterface) state.waterInterface.visible = false;
    return false;
  }
  try {
    _topoConfigureCavityWallMaterial(state, source, wall, expectedMaterialState);
  } catch (error) {
    state.cavityFieldFallbackReason = error instanceof Error ? error.message : String(error);
    state.cavityAuthorityUnrenderable = true;
    if (state.cavity) state.cavity.visible = false;
    if (state.crystals) state.crystals.visible = false;
    return false;
  }
  if (source.sig === state.cavitySig) {
    _topoSyncCavityWaterAppearance(state, source, appearance);
    return true;
  }
  state.cavityAuthorityUnrenderable = false;
  state.cavityAuthorityActive = source.providerAuthority === true;
  state.cavitySig = source.sig;
  state.cavityAppearanceSig = '';
  // Crystal placement resolves against the live cavity provider. A surface
  // revision must invalidate meshes even if size/mineral fields are unchanged.
  state.crystalsSig = '';
  if (source.mode === 'wall-mesh') _topoDisposeCavityFieldTexture(state);

  const ringCount = wall.ring_count;
  const ring0 = wall.rings[0];
  const N = ring0 ? ring0.length : 0;
  if (!N || ringCount < 1) return;

  const numVerts = surface.positions.length / 3;
  const geom = new THREE.BufferGeometry();
  // mesh.positions / mesh.colors / mesh.normals are Float32Arrays the
  // mesh owns and rebuilds in-place; copy-on-write into the
  // BufferAttribute so a future mesh recompute doesn't mutate this
  // geometry's data behind Three.js's back. The slice() costs
  // ~75 KB per cavity rebuild at the default 16×120 resolution
  // (≈ once per dissolution event), which is well under the budget.
  geom.setAttribute('position', new THREE.BufferAttribute(surface.positions.slice(), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(_topoWallRockTint(surface.colors.slice()), 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(surface.normals.slice(), 3));
  // MATRIX SKIN (2026-07-06): static lat-long texture coords (js/23) so the
  // per-lithology wall skin can map. Guarded — an old cached mesh without uvs
  // just skips the attribute and the material renders un-mapped.
  if (surface.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(surface.uvs.slice(), 2));
  const indexAttr = numVerts > 65535
    ? new THREE.Uint32BufferAttribute(surface.indices.slice(), 1)
    : new THREE.Uint16BufferAttribute(surface.indices.slice(), 1);
  geom.setIndex(indexAttr);
  // The MC path carries scalar-gradient normals. Recomputing them from
  // triangles would discard the shared field oracle and reintroduce seams.
  if (source.mode === 'wall-mesh') {
    geom.computeVertexNormals();  // legacy mesh placeholders need this pass
  }

  const target = state.cavity;
  const prev = target.geometry;
  target.geometry = geom;
  if (prev && prev.dispose) prev.dispose();
  // An asynchronous upload failure hides both consumers for one fail-closed
  // frame. A completed rebuild restores the selected wall display and crystals.
  if (typeof _topoApplyWallDisplay === 'function') _topoApplyWallDisplay(state);
  else target.visible = true;
  if (state.crystals) state.crystals.visible = true;
  _topoPublishCavityClipReceipt(state);

  // Tier 1 C (post-v69): toggle cavity material between smooth Phong-
  // like shading (default) and flat-faceted sphere-union polyhedron
  // shading. `wall.cavity_render === 'sharp'` surfaces the underlying
  // dihedral creases between primary/secondary/tertiary bubbles —
  // geologically right for brittle silicate hosts (pegmatite miarolitic
  // cavities, chalcedony-lined agate vugs) where the original dissolution
  // boundary is preserved. Smooth is right for carbonate caves and
  // basalt vesicles where calcite/zeolite linings round the corners.
  //
  // flatShading uses fragment-shader derivatives (dFdx/dFdy of view
  // position) to compute face normals, so the `normal` attribute is
  // ignored when true and `computeVertexNormals` above becomes vestigial
  // for sharp mode but harmless. material.needsUpdate forces shader
  // recompile so the FLAT_SHADED define is honored.
  const renderMode = (wall && wall.cavity_render === 'sharp') ? 'sharp' : 'smooth';
  const wantFlat = (renderMode === 'sharp');
  if (target.material && target.material.flatShading !== wantFlat) {
    target.material.flatShading = wantFlat;
    target.material.needsUpdate = true;
  }

  // Update the cavity hull radius uniforms for the per-crystal clip
  // shader. Two values get computed:
  //   1. uVugRadius — global max vertex distance. Conservative spherical
  //      bound; used as a fallback when ring count exceeds the uniform
  //      array (and as a sanity floor).
  //   2. uVugRadiiByRing[i] — per-ring max vertex distance. The clip
  //      shader linear-interpolates between adjacent rings using the
  //      fragment's polar angle phi, so a crystal at sub-equatorial
  //      latitude gets clipped against the actual hull radius at that
  //      latitude (not the equatorial max). This is what makes the
  //      "wall acts as a slice" intent honest — the cavity geometry
  //      drives the clip, not a bounding sphere.
  // PHASE-2-CAVITY-MESH: globalMax + per-ring max come from the
  // WallMesh directly (recompute already iterated the vertices).
  state.clipUniforms.uVugRadius.value = mesh.max_radius_mm;

  // Per-ring max radii — copy from mesh.maxRadiusByRing into the
  // fixed-length uVugRadiiByRing uniform slot (capped at
  // _MAX_CLIP_RINGS).
  const radiiByRing: Float32Array = state.clipUniforms.uVugRadiiByRing.value;
  const supportedRings = Math.min(ringCount, _MAX_CLIP_RINGS);
  for (let r = 0; r < supportedRings; r++) {
    radiiByRing[r] = mesh.maxRadiusByRing ? mesh.maxRadiusByRing[r] : 0;
  }
  // Zero-fill any unused slots so a stale value doesn't leak into the
  // shader if a future rebuild has fewer rings.
  for (let r = supportedRings; r < _MAX_CLIP_RINGS; r++) radiiByRing[r] = 0;
  state.clipUniforms.uVugRingCount.value = supportedRings;

  //   3. uVugCellRadii[c, r] — per-cell wall radius DataTexture, sampled
  //      by the fragment shader at the fragment's (phi, theta). Without
  //      this, the per-ring max in #2 leaks: a cell at narrow-wall theta
  //      in a ring whose max sits at wide-wall theta passes the clip
  //      conservatively, and crystal corners / tilted bodies poke into
  //      the host rock as "bright saturated" patches. Per-cell sampling
  //      compares against the actual local cell radius, closing the gap.
  // PHASE-2-CAVITY-MESH: read straight from mesh.positions — same
  // vertex layout (row-major (r, c)) as before, just lives on the
  // mesh now.
  if (source.mode === 'wall-mesh') {
  const meshPositions: Float32Array = mesh.positions;
  const cellRadiiBuf = new Float32Array(ringCount * N);
  for (let r = 0; r < ringCount; r++) {
    for (let c = 0; c < N; c++) {
      const idx = r * N + c;
      const x = meshPositions[idx * 3 + 0];
      const y = meshPositions[idx * 3 + 1];
      const z = meshPositions[idx * 3 + 2];
      cellRadiiBuf[idx] = Math.sqrt(x * x + y * y + z * z);
    }
  }
  const prevTex = state.clipUniforms.uVugCellRadii.value;
  // Float texture with linear filtering — most modern WebGL2 drivers
  // support OES_texture_float_linear. Three.js falls back to nearest
  // when unavailable; the per-cell granularity is still a major
  // improvement over per-ring max.
  const cellTex = new THREE.DataTexture(cellRadiiBuf, N, ringCount, THREE.RedFormat, THREE.FloatType);
  cellTex.minFilter = THREE.LinearFilter;
  cellTex.magFilter = THREE.LinearFilter;
  // Theta wraps at 2π — RepeatWrapping makes the seam (cell N-1 ↔ cell
  // 0) filter without a bright artifact. Phi clamps at the poles.
  cellTex.wrapS = THREE.RepeatWrapping;
  cellTex.wrapT = THREE.ClampToEdgeWrapping;
  cellTex.needsUpdate = true;
  state.clipUniforms.uVugCellRadii.value = cellTex;
  state.clipUniforms.uVugCellTexW.value = N;
  state.clipUniforms.uVugCellTexH.value = ringCount;
  if (prevTex && prevTex.dispose) prevTex.dispose();
  }
  _topoSyncCavityWaterAppearance(state, source, appearance);
  return true;
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

// Habit → primitive-geometry token. Three.js mesh is generated once
// per habit token and reused across crystals; the per-mesh transform
// scales it to the right size. E3 uses simple primitives (cones for
// prismatic / acicular, boxes for tabular, octahedra for rhombo /
// equant); E4 will replace with hand-rolled vertex generators that
// match the canvas-vector wireframe primitives more closely.
function _habitGeomToken(habit: string): string {
  const h = (habit || 'prismatic').toLowerCase();
  // Substring matching — sim-side habit strings are sometimes multi-word
  // ("tabular blades", "fibrous (satin spar)", "chalcedony
  // (microcrystalline)", "chalcedony_pseudomorph"). Exact-equality
  // checks miss those; substring checks pick them up. Order matters:
  // more specific tokens first (e.g. "rhombic dodec" before "dodec").
  if (h === 'snowball') return 'snowball';
  // Calcite-morphology arc Phase 2 (2026-06-11): dendritic_<form> must
  // dispatch BEFORE the rhombohedral/scalenohedral substring checks —
  // 'dendritic_rhombohedral' contains 'rhombohedral' and would land on
  // the solid rhomb. Branches render as the spike geom (same routing as
  // the generic dendritic check further down). The stepped_/hopper_
  // families intentionally FALL THROUGH to their parent-form tokens
  // here; the Phase 3 zone-stack terrace geometry overrides at the
  // mesh-sync level, and this token stays the graceful fallback.
  if (h.startsWith('dendritic_')) return 'spike';
  if (h.includes('rhombic dodec') || h.includes('rhombic-dodec') || h === 'garnet' || h === 'trapezohedral') return 'rhombic_dodec';
  if (h === 'dodecahedral' || h === 'dodecahedron') return 'dodecahedron';
  if (h === 'cubic' || h === 'cuboid' || h === 'cube') return 'cube';
  // Halide morphology wave (2026-06-12): the cube regime family falls
  // through to the parent cube token (terrace geometry overrides at
  // mesh-sync, same contract as the calcite stepped_/hopper_ families
  // above). Without this, 'stepped_cube'/'hopper_cube' miss the EXACT
  // 'cubic' check and land on the default 'prism' — a hex prism. The
  // legacy 'hopper_growth' string (old halite saves) had been doing
  // exactly that since v27; routed home as a courtesy.
  if (h === 'stepped_cube' || h === 'hopper_cube' || h === 'hopper_growth') return 'cube';
  // Pyrite striation overlay: striated cubes keep the cube token (the
  // terrace path renders the striations as fine grooves).
  if (h === 'striated_cubic') return 'cube';
  // Pyritohedral family → pentagonal dodecahedron (THREE's
  // DodecahedronGeometry is the regular Platonic form — the closest
  // primitive to {210}'s twelve pentagons; 99c's 2D path already maps
  // the whole family to PRIM_PYRITOHEDRON). Substring catches
  // 'pyritohedral', 'cubo-pyritohedral', 'cubic_or_pyritohedral' and
  // both striated_ overlays — all of which defaulted to a HEX PRISM
  // before this. Striated pyritohedra render without grooves (the
  // terrace path is cube-token-gated); the envelope is the fix.
  if (h.includes('pyritohedral')) return 'dodecahedron';
  // REE-octahedron family (incl. the σ-graded stepped_/hopper_ renames,
  // fix-backlog 2026-06-12): plain 'octahedral_REE' had missed the
  // exact 'octahedral' check below and fallen to the PRISM default
  // since v103 — sunnyside's green Y-fluorite octahedra rendered as
  // hex prisms. Same wart family as pyritohedral, same cure.
  // ('dendritic_octahedral_REE' is caught by the dendritic_ route at
  // the top of this function and gets the tree — correct.)
  if (h.includes('octahedral_ree')) return 'octahedron';
  if (h === 'octahedral' || h === 'octahedron') return 'octahedron';
  // Visual-realism review 2026-09-04 (finding F3): the cubic minerals that the default
  // fell to a HEXAGONAL prism. Sphalerite/chalcopyrite tetrahedra (Td / disphenoid) get a
  // tetrahedron; 'cubic_*' / 'cubo_*' / pseudo-cubic habit names (hessite, naumannite,
  // clausthalite, skutterudite, cassiterite equant) route to the cube. The pyritohedral
  // family is caught above, so 'cubo-pyritohedral' keeps its dodecahedron.
  if (h.includes('tetrahedr') || h.includes('disphenoid')) return 'tetrahedron';
  if (h.startsWith('cubic') || h.startsWith('cubo') || h === 'pseudo_cubic' || h === 'equant_octahedral') {
    return h === 'equant_octahedral' ? 'octahedron' : 'cube';
  }
  if (h.includes('rhombohedral')) return 'rhomb';
  if (h.includes('scalenohedral')) return 'scalene';
  // S2 celestine tranche (SIM 236): the Ba-fibrous blanket is a wall-spreading
  // COATING (the Elmwood "glue"), not a needle spray — route to the botryoidal
  // lateral-crust scaling. MUST precede the generic 'fibrous' → spike check
  // below, which would otherwise catch the substring and render needles.
  if (h === 'fibrous_blanket') return 'botryoidal';
  // Wall-spreading crusts — chalcedony, malachite (banded), agate, smithsonite
  // botryoidal, rosasite crusts. Chalcedony is the user-flagged case:
  // microcrystalline silica spreads on the wall like malachite, NOT a quartz
  // point. The habit string is "chalcedony (microcrystalline)" or
  // "chalcedony_pseudomorph" — match on substring.
  if (h.includes('chalcedony')) return 'botryoidal';
  if (h.includes('botryoidal') || h.includes('reniform') || h.includes('mammillary') || h.includes('globular')) return 'botryoidal';
  // Banded — malachite-style concentric bands. Renders flat on the wall.
  if (h.includes('banded') || h === 'massive' || h.includes('massive')) return 'botryoidal';
  // Tabular family — tablets, plates, blades, foliated sheets. "tabular
  // blades" was falling through to default 'prism' before the substring
  // match; tabular plate is the right primitive. NOTE: rosette is
  // intentionally NOT in this list — selenite rosettes are sprays of
  // BLADES, where the parent mesh is one blade (vertical-ish prism with
  // c >> a per the sim's c_length=56.7, a_width=28.3 selenite values)
  // and the rosette fan comes from _emitClusterSatellites's rosette
  // pattern (evenAngles=true). Routing rosette → tablet collapsed the
  // blade into a tall plate that doesn't read as the radial fan.
  if (h.includes('tabular') || h === 'platy' || h === 'foliated' || h.includes('blade')) return 'tablet';
  // Acicular / capillary / fibrous all share the spike geom; satin spar
  // is fibrous selenite, gets the same treatment.
  if (h.includes('acicular') || h.includes('capillary') || h.includes('fibrous') || h.includes('satin')) return 'spike';
  if (h.includes('dendritic') || h.includes('arborescent')) return 'spike';
  // v134 (2026-05-22): radiating / plumose needle-fan habits route to
  // spike (matching js/99c HABIT_TO_PRIMITIVE re-routing + js/99d fuzzy
  // fallback). 'radiating_blade' is caught by the 'blade' tabular check
  // above. 'radiating_columnar' should stay as prism (forest of columns
  // radiating from a base — hemimorphite signature). Everything else
  // 'radiating' / 'plumose' is a needle-fan: radiating_spray (stibnite),
  // radiating_cluster (bismuthinite), radiating_fibrous (erythrite),
  // plumose_rosette (erythrite plumose).
  if (h.includes('plumose')) return 'spike';
  if (h.includes('radiating')) {
    if (h.includes('columnar')) return 'prism';
    return 'spike';
  }
  if (h === 'prismatic' || h === 'columnar' || h === 'bladed') return 'prism';
  return 'prism';  // sensible default — most cavity habits are vaguely prismatic
}

// Habit → expected (a-axis / c-axis) ratio. Mirrors the formulas in
// 27-geometry-crystal.ts:_update_dimensions but indexed by HABIT TOKEN
// (after _habitGeomToken collapsed sim-side variants), so the renderer
// can re-derive a sensible aspect when the sim-side dimensions are
// floored to visibility minimums and would otherwise produce a near-cube.
const _GEOM_TOKEN_RATIO: Record<string, number> = {
  spike: 0.15,        // acicular / fibrous / dendritic — long thin
  prism: 0.4,         // prismatic — quartz-like
  rhomb: 0.8,         // rhombohedral — calcite chunks
  scalene: 0.6,       // scalenohedral — calcite dogtooth (taller than rhomb)
  tablet: 1.5,        // tabular — flat plate, a > c
  cube: 1.0,          // isometric
  tetrahedron: 1.0,   // isometric (sphalerite Td) — review 2026-09-04
  fluorite_penetration_twin: 1.0,  // two cubes interpenetrating — same envelope
  selenite_swallowtail_twin: 1.5,  // tabular blades — c > a like 'tablet' family
  octahedron: 1.0,
  galena_octahedron_twin: 1.0,  // two octahedra sharing a face — isometric
  aragonite_pseudohex_twin: 0.6,  // tall pseudo-hex column — c > a, prism family
  cerussite_sixling_twin: 1.8,  // flat stellate — wider than tall, like botryoidal crusts
  marcasite_cockscomb_twin: 0.3,  // thin needle blades — c >> a, acicular family
  pyrite_iron_cross_twin: 1.0,  // interpenetrating pyritohedra — isometric envelope
  marcasite_spearhead_twin: 0.4,  // elongated bipyramid — c >> a, spike-like aspect
  aragonite_contact_twin: 0.5,  // V of prismatic blades — prism-like aspect
  rhombic_dodec: 1.0,
  dodecahedron: 1.0,
  snowball: 1.0,
  botryoidal: 1.5,    // wall-crust — wider than tall
  dripstone: 0.25,    // PROPOSAL-HABIT-BIAS Slice 4 — slim icicle, c >> a
  aragonite_frostwork: 0.5,  // Phase 1c (v156) — radiating spray; envelope
                             // is roughly square (cluster spreads as much
                             // laterally as vertically) so c/a is moderate
                             // even though individual needles are slim.
};

// PROPOSAL-HABIT-BIAS Slice 4 — which canonical habit tokens can
// morph into the dripstone primitive when growth_environment === 'air'.
// Mirrors _isDripstoneEligibleCanonical in js/99d-renderer-wireframe.ts
// so the two renderers agree on which crystals taper into stalactites.
// Isometric tokens (cube/octahedron/rhombic_dodec/dodecahedron/snowball)
// are NOT eligible: those crystal shapes don't drip in real caves.
// Tabular is also NOT eligible: tablets in air-mode have no clean
// geological analog, fall through to the canonical primitive.
const _DRIPSTONE_ELIGIBLE_TOKENS = new Set([
  'prism', 'spike', 'rhomb', 'scalene', 'botryoidal',
]);

// W-F O2 — the tokens whose emitted geometry is a single CONVEX body, so a
// neighbour plane cut yields one convex contact cap (_clipConvexGeom). Concave
// forms (botryoidal / dripstone / frostwork / the *_twin composites — none of
// these tokens appear here) and stepped/hoppered/etched overprints opt out at
// the clip site. Mirrors the probe's CONVEX_TOKENS (tools/o2-contact-probe.mjs).
const _O2_CONVEX_TOKENS = new Set([
  'cube', 'octahedron', 'tetrahedron', 'rhomb', 'scalene', 'tablet', 'prism', 'spike', 'rhombic_dodec', 'dodecahedron',
]);

// PROPOSAL-HABIT-BIAS Slice 4 — choose the geometry token for a
// crystal, honoring air-mode dripstone override. Centralizes the
// "fluid → canonical primitive, air → dripstone (when eligible)"
// decision so the call site stays a one-liner. Mirrors
// _lookupCrystalPrimitive in js/99d-renderer-wireframe.ts.
//
// Dispatch precedence (matches the wireframe side):
//   1. Twin override — mineral-specific iconic twins (v134 onward)
//   2. Air-mode dripstone override (Slice 4)
//   3. Canonical habit-string token
//
// Twins win over air-mode because real twinned cubes don't drip into
// stalactites just because the cavity drained. Future iconic twin
// primitives (gypsum swallowtail, marcasite cockscomb, cerussite
// trilling, pyrite iron-cross, galena octahedron-twin, aragonite
// pseudo-hex) plug into this same gate.
function _resolveCrystalGeomToken(crystal: any, habitForGeom: string): string {
  // Air-mode aragonite → frostwork, twinned OR not (the v156 override
  // was scoped to !twinned; BUG-aragonite-twin-cave-morphology.md closed
  // that gap). Real cave aragonite (Hill & Forti 1997 — Cave Minerals of
  // the World §5.3.4, §10) grows as radiating acicular sprays from a
  // central anchor — diagnostic cave-aragonite morphology at Frasassi,
  // Carlsbad, Wind Cave, and dozens of other cave systems worldwide.
  // This is geologically distinct from smooth-stalactite 'dripstone'
  // morphology (which models calcite-family speleothems).
  //
  // The override is UNCONDITIONAL on twin state because the cyclic-sextet
  // pseudo-hex twin in caves manifests as a 6-fold radiating NEEDLE
  // cluster, not a smooth 6-faceted column (Frisia et al. 2002, Grotte de
  // Clamouse). The structural twin operation is still there — it just
  // doesn't render as a column at cave growth conditions (low T, low σ,
  // vapor-deposition). Placed ABOVE the twin-geom branches so air-mode
  // aragonite hits frostwork first; the aragonite twin branches below
  // (cyclic_sextet, contact) now catch only FLUID-mode aragonite, where
  // the smooth pseudo-hex column IS correct (metamorphic, sea-floor
  // cement, hydrothermal vent settings).
  if (crystal && crystal.mineral === 'aragonite'
      && crystal.growth_environment === 'air') {
    return 'aragonite_frostwork';
  }
  if (crystal && crystal.mineral === 'fluorite' && crystal.twinned
      && crystal.twin_law === 'penetration') {
    return 'fluorite_penetration_twin';
  }
  if (crystal && crystal.mineral === 'selenite' && crystal.twinned
      && crystal.twin_law === 'swallowtail') {
    return 'selenite_swallowtail_twin';
  }
  if (crystal && crystal.mineral === 'galena' && crystal.twinned
      && crystal.twin_law === 'spinel_law') {
    return 'galena_octahedron_twin';
  }
  if (crystal && crystal.mineral === 'aragonite' && crystal.twinned
      && crystal.twin_law === 'cyclic_sextet') {
    return 'aragonite_pseudohex_twin';
  }
  if (crystal && crystal.mineral === 'cerussite' && crystal.twinned
      && crystal.twin_law === 'cyclic_sixling') {
    return 'cerussite_sixling_twin';
  }
  if (crystal && crystal.mineral === 'marcasite' && crystal.twinned
      && crystal.twin_law === 'cockscomb') {
    return 'marcasite_cockscomb_twin';
  }
  if (crystal && crystal.mineral === 'pyrite' && crystal.twinned
      && crystal.twin_law === 'iron_cross') {
    return 'pyrite_iron_cross_twin';
  }
  if (crystal && crystal.mineral === 'marcasite' && crystal.twinned
      && crystal.twin_law === 'spearhead') {
    return 'marcasite_spearhead_twin';
  }
  if (crystal && crystal.mineral === 'aragonite' && crystal.twinned
      && crystal.twin_law === 'contact') {
    return 'aragonite_contact_twin';
  }
  // The dolomite engine's ordinary rhomb name is not a generic habit token.
  // Keep the mineral scope and the air-mode override below.
  const canonical = crystal?.mineral === 'dolomite' && habitForGeom === 'coarse_rhomb'
    ? 'rhomb' : _habitGeomToken(habitForGeom);
  if (crystal && crystal.growth_environment === 'air'
      && _DRIPSTONE_ELIGIBLE_TOKENS.has(canonical)) {
    return 'dripstone';
  }
  return canonical;
}

// ----- Phase E5 hand-rolled habit geometries -----
//
// Each helper returns a non-indexed BufferGeometry with one vertex
// triple per face triangle, so flat-shading reads each crystal face
// as its own facet (the visual signature of real crystals). Unit
// size: ~1 along the c-axis (Y), ~1 across the a-axes (XZ). The
// instance transform downstream scales by c_length / a_width.
//
// The hand-rolled geometries replace E3's Three.js primitives —
// quartz / calcite / beryl now read as real hexagonal prisms with
// pyramidal terminations instead of flat-topped cylinders, etc.

// Push a triangle into a position list (flat-shaded, no shared verts).
function _pushTri(out: number[], ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) {
  out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
}

// Hexagonal prism with pyramidal cap — the quartz / calcite / beryl
// workhorse. 6 prism side faces + 6 pyramid faces. Bottom is anchored
// against the wall so we omit the base hex (saves 6 triangles).
function _makeHexPrismWithPyramid(): any {
  const r = 0.50;             // prism / pyramid base radius (a-axis)
  const yBase = -0.50;        // anchored at the wall
  const yShoulder = 0.20;     // top of prism / start of pyramid (60% up)
  const yApex = 0.50;         // top of pyramid (free tip)
  const positions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    // Prism side face — two triangles
    _pushTri(positions, x0, yBase, z0, x1, yBase, z1, x1, yShoulder, z1);
    _pushTri(positions, x0, yBase, z0, x1, yShoulder, z1, x0, yShoulder, z0);
    // Pyramid face — one triangle to the apex
    _pushTri(positions, x0, yShoulder, z0, x1, yShoulder, z1, 0, yApex, 0);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// SECTOR-ZONED PRISM — TOURMALINE (the only tenant routed here: js/45 SECTOR_ZONING
// registers tourmaline as kind 'hourglass'; andalusite/apophyllite/selenite branch to
// their own builders). Crystal-face realism arc 2026-06-21, PROPOSALS-crystal-face-realism
// §1; cross-section CORRECTED 2026-06-23 (specimen-debt verification pass).
//
// MORPHOLOGY. Tourmaline is point group 3m, so the prism zone is DITRIGONAL — the
// cross-section is a ROUNDED TRIANGLE with convex sides, NOT a hexagon: "cross sections
// typically triangular with curved convex sides" (Handbook of Mineralogy, dravite, after
// Dana). The species is famous precisely because no other common mineral has three sides;
// a regular hexagon (the render before 2026-06-23) implied 6-fold prism symmetry and
// erased that diagnostic feature, so the ring radius now carries a 3-fold cos(3θ)
// modulation (corners at rMax, convex sides pulled in to rMax·kEdge). 3m is POLAR, so the
// two c-axis ends differ: a pyramid apex over a flat basal pedion (anchored in the wall)
// — qualitatively hemimorphic. (Which physical pole carries the steep pyramid is left
// UNLABELLED: the analogous/antilogous → ±c mapping is reported inconsistently across
// sources, so the render shows the two-different-ends fact without asserting a sign.)
//
// COLOUR. A baked per-VERTEX colour paints the PYRAMID (termination) sector a hue-rotated
// contrast of the PRISM body, with a SHARP geometry-locked boundary at the shoulder ring
// (non-indexed verts keep it sharp) — different growth sectors take up trace elements at
// different rates (Dowty 1976, Am.Min. 61:460; Ferguson 1973 hourglass). For tourmaline
// this IS the iconic bicolor elbaite (green prism / pink tip). Colours are ABSOLUTE (the
// material runs vertexColors with color=white): body = class_color, termination = the
// hue-rotated contrast. A Tier A render abstraction — says "habit variant", not a computed
// per-element partition. `bodyRGB`/`termRGB` linear-space [r,g,b]; cached per base colour.
function _makeSectorZonedPrism(bodyRGB: number[], termRGB: number[]): any {
  const SEG = 18;             // smooth rounded-triangle ring (÷3 → clean 3-fold)
  const rMax = 0.50;          // corner radius (a-axis max)
  const kEdge = 0.58;         // edge-midpoint radius = rMax·kEdge → convex-sided triangle
  const rho = (a: number) => rMax * (kEdge + (1 - kEdge) * (0.5 + 0.5 * Math.cos(3 * a)));
  const yBase = -0.50;        // flat basal pedion (anchored at the wall)
  const yShoulder = 0.20;     // top of prism / start of pyramid
  const yApex = 0.50;         // pyramid apex (free tip)
  const positions: number[] = [];
  const colors: number[] = [];
  const pc = () => colors.push(bodyRGB[0], bodyRGB[1], bodyRGB[2]);  // prism sector
  const tc = () => colors.push(termRGB[0], termRGB[1], termRGB[2]);  // termination sector
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2;
    const a1 = ((i + 1) / SEG) * Math.PI * 2;
    const r0 = rho(a0), r1 = rho(a1);
    const x0 = Math.cos(a0) * r0, z0 = Math.sin(a0) * r0;
    const x1 = Math.cos(a1) * r1, z1 = Math.sin(a1) * r1;
    // prism side face — two triangles, all verts in the prism (body) sector
    _pushTri(positions, x0, yBase, z0, x1, yBase, z1, x1, yShoulder, z1); pc(); pc(); pc();
    _pushTri(positions, x0, yBase, z0, x1, yShoulder, z1, x0, yShoulder, z0); pc(); pc(); pc();
    // pyramid face — one triangle to the apex, termination sector
    _pushTri(positions, x0, yShoulder, z0, x1, yShoulder, z1, 0, yApex, 0); tc(); tc(); tc();
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// CHIASTOLITE PRISM — the carbon-cross variety of andalusite (crystal-face realism
// arc 2026-06-21). A near-SQUARE {110} prism (andalusite is orthorhombic, ~square
// section) carrying a baked per-VERTEX COLOUR attribute that paints the dark
// carbonaceous CROSS: chiastolite concentrates graphite into the corner/diagonal
// growth SECTORS, so a transverse section shows the Maltese cross (Mason et al.
// 2010, Gondwana Res. 18(1):222-229; Dowty 1976 sector-zoning). ONE rule does it —
// a cross-section point (x,z) is in the carbon sector when it lies near a diagonal,
// |‖x‖−‖z‖| < BAND: on a side face that darkens the two edge-columns (the 4 vertical
// corner columns of the prism), and on the top cap it draws the X. Colours are
// ABSOLUTE (material runs vertexColors with color=white): body = class_color (pale
// metapelite grey-tan), cross = near-black graphite. Per-CELL flat colouring keeps
// the sector boundaries crisp. Cached per base colour.
function _makeChiastolitePrism(bodyRGB: number[], crossRGB: number[]): any {
  const r = 0.50;             // half-width (square a-b section)
  const yBase = -0.50, yTop = 0.50;
  const BAND = 0.17;          // diagonal half-width of the dark cross
  const N = 12;               // subdivision (crisp blocky sectors)
  const positions: number[] = [];
  const colors: number[] = [];
  const isCross = (x: number, z: number) => Math.abs(Math.abs(x) - Math.abs(z)) < BAND;
  const pushQuad = (
    ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
    col: number[],
  ) => {
    _pushTri(positions, ax, ay, az, bx, by, bz, cx, cy, cz);
    _pushTri(positions, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 6; k++) colors.push(col[0], col[1], col[2]);
  };
  // 4 side faces — each subdivided into N horizontal strips; colour depends only
  // on the cross-section position (constant up the c-axis → vertical columns).
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < N; i++) {
      const t0 = -r + (2 * r) * (i / N), t1 = -r + (2 * r) * ((i + 1) / N);
      const tc = (t0 + t1) / 2;
      let x0, z0, x1, z1, col;
      if (f === 0) { x0 = r;  z0 = t0; x1 = r;  z1 = t1; col = isCross(r, tc); }       // +x face
      else if (f === 1) { x0 = -r; z0 = t0; x1 = -r; z1 = t1; col = isCross(-r, tc); }  // -x face
      else if (f === 2) { x0 = t0; z0 = r;  x1 = t1; z1 = r;  col = isCross(tc, r); }   // +z face
      else { x0 = t0; z0 = -r; x1 = t1; z1 = -r; col = isCross(tc, -r); }               // -z face
      pushQuad(x0, yBase, z0, x1, yBase, z1, x1, yTop, z1, x0, yTop, z0, col ? crossRGB : bodyRGB);
    }
  }
  // top cap (y = yTop) — N×N grid, the X reads here
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = -r + (2 * r) * (i / N), x1 = -r + (2 * r) * ((i + 1) / N);
      const z0 = -r + (2 * r) * (j / N), z1 = -r + (2 * r) * ((j + 1) / N);
      const col = isCross((x0 + x1) / 2, (z0 + z1) / 2) ? crossRGB : bodyRGB;
      pushQuad(x0, yTop, z0, x1, yTop, z0, x1, yTop, z1, x0, yTop, z1, col);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// GREEN POONA APOPHYLLITE — a tetragonal square prism rendered as a UNIFORM V⁴⁺
// green body (Rossman 1974), the {101} pyramidal tips a hair lighter from
// transparency and the {001} basal face a pearly green-white LUSTER. Image-corpus
// verified (Pune specimens, 2026-06-21): the green is a uniform body colour with NO
// visible prism-vs-pyramid sector partition. Apophyllite IS genuinely sector-zoned,
// but only OPTICALLY (anomalous birefringence, crossed-polars) — it does not show as
// visible colour, so this is NOT a colour hourglass (see js/45). Per-
// CELL flat ABSOLUTE vertex colours (material runs vertexColors with color=white). Same unit box (y −0.5..+0.5) as the other prism builders
// so the per-crystal transform scales it identically.
function _makeApophyllitePrism(prismRGB: number[], pyramidRGB: number[], basalRGB: number[]): any {
  const r = 0.50;             // prism half-width (a-axis)
  const rTop = 0.24;          // flat {001} top half-width
  const yBase = -0.50;        // anchored at the wall
  const yShoulder = 0.14;     // top of prism / base of the {101} pyramidal shoulders
  const yTop = 0.50;          // flat top
  const positions: number[] = [];
  const colors: number[] = [];
  const pushQuad = (
    ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
    col: number[],
  ) => {
    _pushTri(positions, ax, ay, az, bx, by, bz, cx, cy, cz);
    _pushTri(positions, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 6; k++) colors.push(col[0], col[1], col[2]);
  };
  const corn = [[r, r], [-r, r], [-r, -r], [r, -r]];          // square prism corners (CCW)
  const top = [[rTop, rTop], [-rTop, rTop], [-rTop, -rTop], [rTop, -rTop]];  // flat-top corners
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // prism side face (green {100} prism sector) — yBase..yShoulder
    pushQuad(
      corn[i][0], yBase, corn[i][1], corn[j][0], yBase, corn[j][1],
      corn[j][0], yShoulder, corn[j][1], corn[i][0], yShoulder, corn[i][1], prismRGB,
    );
    // {101} pyramidal shoulder face (intermediate sector) — yShoulder(r) -> yTop(rTop)
    pushQuad(
      corn[i][0], yShoulder, corn[i][1], corn[j][0], yShoulder, corn[j][1],
      top[j][0], yTop, top[j][1], top[i][0], yTop, top[i][1], pyramidRGB,
    );
  }
  // flat {001} basal pinacoid top — pale-pearly clear "waist" sector
  pushQuad(
    top[0][0], yTop, top[0][1], top[1][0], yTop, top[1][1],
    top[2][0], yTop, top[2][1], top[3][0], yTop, top[3][1], basalRGB,
  );
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// GYPSUM HOURGLASS BLADE — the genuinely VISIBLE sector tenant (crystal-face-realism
// arc 2026-06-22). A tabular selenite blade (thin in x, wide in z, elongated up the
// c-axis y) carrying the iconic "hourglass selenite" of the Great Salt Plains: clay +
// sand stained chocolate-brown by soil iron oxide, mechanically trapped on the fast-
// growing terminal growth SECTORS, forming a sandglass of inclusions inside an
// otherwise water-clear blade (USFWS Salt Plains NWR; Oklahoma state crystal). ONE
// rule paints it, chiastolite-style: on each broad {010} face, a cell at normalized
// (yn, zn) is in the inclusion sector when |zn| < |yn| — two cones meeting apex-to-apex
// at the crystal centre (wide at both terminations, pinched to a clear waist). The apex
// sits at the geometric centre so the hourglass is self-similar along the c-axis — the
// boss's stepped-growth specimen, where the internal order survives the outer envelope
// changing. `flooded` collapses the whole blade to solid brown (the overgrown variant —
// heavy inclusion load buries the contrast; boss: "the brown ones are overgrown").
// Colours are ABSOLUTE per-CELL (material runs vertexColors with color=white): body =
// pale clear gypsum, sector = amber→chocolate by trapped-load intensity. Same unit box
// (y −0.5..+0.5) as the other prism builders so the per-crystal transform scales it.
function _makeHourglassSeleniteBlade(bodyRGB: number[], sectorRGB: number[], flooded: boolean, steps: number): any {
  const a = 0.09;             // half-thickness (x) — tabular blade, constant thin
  const bMax = 0.34;          // max half-width (z) at the base/body
  const yBase = -0.50, yTop = 0.50;
  const yShoulder = 0.02;     // body below (full width); tapering chisel tip above
  const Nz = 14;              // z-cells across the broad face (the hourglass)
  const Ny = 26;              // y-slices up the c-axis
  const positions: number[] = [];
  const colors: number[] = [];
  // Inclusion sector: |zn| < |yn| — the sandglass (apex at centre, wide at the tips).
  // Normalized against the FULL bMax so the bowtie stays geometrically fixed as the
  // outer envelope tapers/steps — the boss's "internal hourglass survives the envelope".
  const isSector = (yn: number, zn: number) => flooded || Math.abs(zn) < Math.abs(yn);
  const pushQuad = (
    ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
    col: number[],
  ) => {
    _pushTri(positions, ax, ay, az, bx, by, bz, cx, cy, cz);
    _pushTri(positions, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 6; k++) colors.push(col[0], col[1], col[2]);
  };
  const edgeCol = flooded ? sectorRGB : bodyRGB;
  // Half-width at a given y: full below the shoulder, then taper to a chisel tip. When
  // `steps` ≥ 2 the taper is quantized into discrete narrowing terraces (the stepped-
  // growth ziggurat); otherwise it is a fine smooth chisel.
  const halfWidth = (y: number): number => {
    if (y <= yShoulder) return bMax;
    let t = (y - yShoulder) / (yTop - yShoulder);        // 0..1 up the tip
    if (steps >= 2) { const lvl = Math.min(steps - 1, Math.floor(t * steps)); t = lvl / (steps - 1); }
    return bMax * (1 - 0.9 * t);                          // 1.0 → 0.1 (a thin tip, not a degenerate point)
  };
  let prevBB = -1;
  for (let i = 0; i < Ny; i++) {
    const y0 = yBase + (yTop - yBase) * (i / Ny), y1 = yBase + (yTop - yBase) * ((i + 1) / Ny);
    const yc = (y0 + y1) / 2, yn = yc / 0.5;
    const bb = halfWidth(yc);
    // Broad faces (x = ±a) — z-cells across −bb..bb, coloured by the fixed hourglass rule.
    for (let j = 0; j < Nz; j++) {
      const z0 = -bb + (2 * bb) * (j / Nz), z1 = -bb + (2 * bb) * ((j + 1) / Nz);
      const zn = ((z0 + z1) / 2) / bMax;
      const col = isSector(yn, zn) ? sectorRGB : bodyRGB;
      pushQuad(a, y0, z0, a, y1, z0, a, y1, z1, a, y0, z1, col);        // +x face
      pushQuad(-a, y0, z0, -a, y0, z1, -a, y1, z1, -a, y1, z0, col);   // −x face
    }
    // Side faces at z = ±bb for this slice.
    pushQuad(-a, y0, bb, a, y0, bb, a, y1, bb, -a, y1, bb, edgeCol);          // +z side
    pushQuad(-a, y0, -bb, -a, y1, -bb, a, y1, -bb, a, y0, -bb, edgeCol);      // −z side
    // Step tread (horizontal ledge facing up) where the width shrank from the slice below.
    if (prevBB > bb + 1e-6) {
      pushQuad(-a, y0, bb, -a, y0, prevBB, a, y0, prevBB, a, y0, bb, edgeCol);        // +z ledge
      pushQuad(-a, y0, -prevBB, -a, y0, -bb, a, y0, -bb, a, y0, -prevBB, edgeCol);    // −z ledge
    }
    prevBB = bb;
  }
  // Base cap (full width, sits on the matrix) + thin tip cap.
  const bTip = halfWidth(yTop - 1e-4);
  pushQuad(-a, yBase, -bMax, a, yBase, -bMax, a, yBase, bMax, -a, yBase, bMax, sectorRGB);   // base
  pushQuad(-a, yTop, -bTip, -a, yTop, bTip, a, yTop, bTip, a, yTop, -bTip, sectorRGB);       // tip
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// Quartz SCEPTRE — gen-1 stem + a wider gen-2 cap grown over the resorbed
// tip (alpine-cleft arc SIM 206; the sim tags crystal._sceptre.capFrac after
// the resorption→renewal phantom boundary). Two stacked hexagonal prisms: a
// NARROW stem (r 0.30) for the lower (1−capFrac) of the height, a WIDER cap
// (r 0.50) with a pyramidal tip for the upper capFrac, joined by a horizontal
// shoulder ring — the corrosion surface the cap overgrew, the defining sceptre
// silhouette. Same unit box (y −0.5..+0.5) as _makeHexPrismWithPyramid so the
// per-crystal transform scales it identically.
//
// ECCENTRIC CAP (boss observation on the ametrine reference specimen, 2026-07-09:
// "the center point of the growth shifts throughout the scepter"). A renewal cap
// does NOT re-center on the stem axis — it nucleates where feeding is best (the
// flow side; Sizaret 2006 growth-rate asymmetry maps paleo-flow), so real caps
// sit visibly off-axis. `eccX` displaces the whole cap (ring + apex) laterally in
// local +X — the per-crystal yaw then scatters the azimuth, so a druse shows caps
// leaning every which way. Bounded ≤ rCap−rStem so the shoulder ring never turns
// inside-out (the stem-top circle stays inside the cap footprint). v1 is a
// deterministic per-crystal render read (the _crystalYaw idiom); the EARNED
// version — offset along the LOCAL paleo-flow direction the wall already records
// (wall.paleo_flow_accum, the V1b-flow speedometer) — is named in the backlog.
function _makeSceptreHexPrism(capFrac: number, eccX?: number): any {
  const cf = Math.max(0.25, Math.min(0.7, capFrac || 0.5));
  const rStem = 0.30, rCap = 0.50;
  const ecc = Math.max(0, Math.min(rCap - rStem, eccX || 0));   // cap-axis lateral offset
  const yBase = -0.50, yApex = 0.50;
  const yBound = yBase + (1 - cf);          // top of stem / base of cap
  const yShoulder = yBound + cf * 0.62;     // cap prism top / start of tip pyramid
  const positions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    const sx0 = Math.cos(a0) * rStem, sz0 = Math.sin(a0) * rStem, sx1 = Math.cos(a1) * rStem, sz1 = Math.sin(a1) * rStem;
    const cx0 = ecc + Math.cos(a0) * rCap, cz0 = Math.sin(a0) * rCap, cx1 = ecc + Math.cos(a1) * rCap, cz1 = Math.sin(a1) * rCap;
    // stem side face
    _pushTri(positions, sx0, yBase, sz0, sx1, yBase, sz1, sx1, yBound, sz1);
    _pushTri(positions, sx0, yBase, sz0, sx1, yBound, sz1, sx0, yBound, sz0);
    // shoulder ring (stem radius → displaced cap radius) — the overgrown boundary
    _pushTri(positions, sx0, yBound, sz0, sx1, yBound, sz1, cx1, yBound, cz1);
    _pushTri(positions, sx0, yBound, sz0, cx1, yBound, cz1, cx0, yBound, cz0);
    // cap side face
    _pushTri(positions, cx0, yBound, cz0, cx1, yBound, cz1, cx1, yShoulder, cz1);
    _pushTri(positions, cx0, yBound, cz0, cx1, yShoulder, cz1, cx0, yShoulder, cz0);
    // cap pyramid tip — apex follows the displaced cap axis
    _pushTri(positions, cx0, yShoulder, cz0, cx1, yShoulder, cz1, ecc, yApex, 0);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Quartz GWINDEL — the alpine-fissure twisted column (SIM 207; sim tags
// crystal._gwindel.twistDeg). A FLATTENED prism (wide a-axis, thin b-axis)
// extruded vertically with each level progressively rotated about the long axis
// — the stack-of-rotated-individuals silhouette. Same unit box (y -0.5..+0.5) as
// the other quartz primitives so the per-crystal transform scales it identically.
function _makeGwindelGeom(twistDeg: number): any {
  const tw = (Math.max(30, Math.min(150, twistDeg || 75))) * Math.PI / 180;
  const ra = 0.46, rb = 0.17;     // flattened rectangular cross-section (a >> b)
  const yBase = -0.50, yTop = 0.50;
  const SEG = 14;
  const corner = (i: number, ang: number): [number, number] => {
    const cx = (i === 0 || i === 3) ? ra : -ra;   // ±a
    const cz = (i < 2) ? rb : -rb;                 // ±b
    return [cx * Math.cos(ang) - cz * Math.sin(ang), cx * Math.sin(ang) + cz * Math.cos(ang)];
  };
  const positions: number[] = [];
  for (let s = 0; s < SEG; s++) {
    const y0 = yBase + (yTop - yBase) * (s / SEG);
    const y1 = yBase + (yTop - yBase) * ((s + 1) / SEG);
    const a0 = tw * (s / SEG), a1 = tw * ((s + 1) / SEG);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const [x0i, z0i] = corner(i, a0), [x0j, z0j] = corner(j, a0);
      const [x1i, z1i] = corner(i, a1), [x1j, z1j] = corner(j, a1);
      _pushTri(positions, x0i, y0, z0i, x0j, y0, z0j, x1j, y1, z1j);
      _pushTri(positions, x0i, y0, z0i, x1j, y1, z1j, x1i, y1, z1i);
    }
  }
  // flat-cap the top quad (two triangles) at the final twist
  const tc = [0, 1, 2, 3].map((i) => corner(i, tw));
  _pushTri(positions, tc[0][0], yTop, tc[0][1], tc[1][0], yTop, tc[1][1], tc[2][0], yTop, tc[2][1]);
  _pushTri(positions, tc[0][0], yTop, tc[0][1], tc[2][0], yTop, tc[2][1], tc[3][0], yTop, tc[3][1]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// BENT PRISM — post-growth deformation overprint (deformation/shear arc
// 2026-06-20, RESEARCH-deformation-shear §5.3). A hexagonal prism whose long
// axis arcs sideways: the crystal grew straight, then a later tectonic shear
// bent it (bent quartz = post-growth bend-gliding, NOT a growth habit). Built
// like _makeGwindelGeom's SEG loop, but each ring is TRANSLATED laterally along
// a cantilever arc (offsetX ∝ t², base fixed, tip swung) instead of twisted —
// the generic "deformation transform on a finished mesh" the arc was after. The
// pyramidal termination follows the bend so the tip stays on-axis with its ring.
// `bend` is the lateral tip offset (unit box). Gated in the mesh-sync hook on
// crystal._deformation.kind === 'bend'.
function _makeBentPrism(bend: number): any {
  const b = Math.max(0.0, Math.min(0.6, bend || 0.3));
  const r = 0.26;                       // columnar (quartz-like) cross-section
  const yBase = -0.5, yShoulder = 0.32, yApex = 0.5;
  const SEG = 14, N = 6;
  const offX = (y: number): number => { const t = (y - yBase) / (yApex - yBase); return b * t * t; };
  const ring = (y: number): number[][] => {
    const cx = offX(y); const out: number[][] = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; out.push([cx + r * Math.cos(a), y, r * Math.sin(a)]); }
    return out;
  };
  const positions: number[] = [];
  for (let s = 0; s < SEG; s++) {
    const y0 = yBase + (yShoulder - yBase) * (s / SEG);
    const y1 = yBase + (yShoulder - yBase) * ((s + 1) / SEG);
    const r0 = ring(y0), r1 = ring(y1);
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      _pushTri(positions, r0[k][0], r0[k][1], r0[k][2], r0[j][0], r0[j][1], r0[j][2], r1[j][0], r1[j][1], r1[j][2]);
      _pushTri(positions, r0[k][0], r0[k][1], r0[k][2], r1[j][0], r1[j][1], r1[j][2], r1[k][0], r1[k][1], r1[k][2]);
    }
  }
  // pyramidal termination (apex rides the bend)
  const rs = ring(yShoulder);
  const apex = [offX(yApex), yApex, 0];
  for (let k = 0; k < N; k++) { const j = (k + 1) % N; _pushTri(positions, rs[k][0], rs[k][1], rs[k][2], rs[j][0], rs[j][1], rs[j][2], apex[0], apex[1], apex[2]); }
  // base cap (fan)
  const rb = ring(yBase);
  for (let k = 1; k < N - 1; k++) { _pushTri(positions, rb[0][0], rb[0][1], rb[0][2], rb[k + 1][0], rb[k + 1][1], rb[k + 1][2], rb[k][0], rb[k][1], rb[k][2]); }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Dissolution-sculpted {100} fluorite cube. Godinho et al. (2012) report that
// near-{100} top surfaces remain comparatively flat while pre-existing pores
// evolve into cubic pits bounded by {100} walls at 90 degrees. The accepted
// receipt selects that morphology. Crystal scale carries measured volume loss.
// The two deterministic pores per face are an explicitly RECEIPTED schematic
// defect assumption, not inferred natural-crystal defect density; their relief
// is vertically exaggerated 250× so sub-micrometre retreat can be inspected.
// The player-facing zone panel states that magnification and the physical
// silhouette remains unchanged by this overlay. The optional round parameter
// exists only for old cosmetic save tags and is zero for physical {100} receipts.
function _makeEtchedCube(round: number, pitStrength: number = 0.5, morphology = ''): any {
  const t = Math.max(0.0, Math.min(0.85, round ?? 0.3));
  const pitAmp = Math.max(0, Math.min(1, pitStrength || 0));
  const SEG = 12;
  const geom = new THREE.BoxGeometry(0.8, 0.8, 0.8, SEG, SEG, SEG);
  const pos = geom.attributes.position;
  const R = 0.47;                         // target sphere radius (slightly > inscribed 0.4 so faces stay flattish)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, y, z) || 1e-6;
    let nx = x * (1 - t) + (x / r) * R * t;
    let ny = y * (1 - t) + (y / r) * R * t;
    let nz = z * (1 - t) + (z / r) * R * t;
    // Deterministic cubic pits on the original cube faces. A broad flat floor
    // and narrow transition approximate the observed 90-degree {100} walls at
    // this deliberately low mesh resolution.
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let u = 0, v = 0, axis = 0;
    if (ax >= ay && ax >= az) { axis = 1; u = y / 0.4; v = z / 0.4; }
    else if (ay >= ax && ay >= az) { axis = 2; u = x / 0.4; v = z / 0.4; }
    else { axis = 3; u = x / 0.4; v = y / 0.4; }
    const crater = (cx: number, cy: number, radius: number) => {
      if (morphology.includes('cubic-{100}-pits')) {
        const squareRadius = Math.max(Math.abs(u - cx), Math.abs(v - cy)) / radius;
        if (squareRadius <= 0.62) return 1;
        return squareRadius < 1 ? (1 - squareRadius) / 0.38 : 0;
      }
      const normalized = Math.hypot(u - cx, v - cy) / radius;
      return normalized < 1 ? Math.pow(1 - normalized, 1.35) : 0;
    };
    const pit = Math.min(1,
      crater(-0.35, 0.20, 0.38) + crater(0.30, -0.28, 0.30));
    const inset = 0.055 * pitAmp * pit;
    if (axis === 1) nx -= Math.sign(nx || x) * inset;
    else if (axis === 2) ny -= Math.sign(ny || y) * inset;
    else nz -= Math.sign(nz || z) * inset;
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

// Preserve progressive healing in the geometry cache. A 0.1 bucket collapsed
// the seed-42 etched (0.1036), first-healed (0.0854), and final (0.0658)
// surfaces into one identical mesh. Thousandth-resolution keeps replay depth
// within 0.0005 of the receipt-derived 250× schematic magnitude.
function _physicalEtchReliefBucket(intensity: number): number {
  const bounded = Math.max(0, Math.min(1, Number(intensity) || 0));
  return Math.round(bounded * 1000) / 1000;
}

// Calcite cleavage rhombohedron — 6 rhombic faces, 8 vertices, 3-fold
// symmetric around the c-axis. Two apex vertices on the c-axis at
// y=±h; 6 equatorial vertices in two staggered triangles at y=±t,
// 60° rotated from each other. This produces the classic Iceland-spar
// "stretched cube" silhouette.
function _makeRhombohedron(): any {
  const h = 0.50;             // apex height
  const t = 0.18;             // equatorial height (closer to apex than to center → "stretched" look)
  const r = 0.42;             // equatorial radius
  // Equatorial vertices: 3 upper (at y=+t) staggered 60° from 3 lower (at y=-t)
  const upper = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;  // offset 30° so a vertex faces +X
    return [Math.cos(a) * r, t, Math.sin(a) * r];
  });
  const lower = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6 + Math.PI / 3;  // 60° rotated
    return [Math.cos(a) * r, -t, Math.sin(a) * r];
  });
  const apexT = [0, h, 0];
  const apexB = [0, -h, 0];
  // 6 rhombic faces, each split into 2 triangles. Top 3 faces connect
  // top apex + adjacent upper vertices + a lower vertex between them;
  // bottom 3 mirror.
  const positions: number[] = [];
  for (let i = 0; i < 3; i++) {
    const u0 = upper[i], u1 = upper[(i + 1) % 3];
    const lBetween = lower[i];  // the lower vertex tucked between u0 and u1
    // Top rhombus: apexT, u0, lBetween, u1 — split as (apexT, u0, lBetween) + (apexT, lBetween, u1)
    _pushTri(positions, apexT[0], apexT[1], apexT[2], u0[0], u0[1], u0[2], lBetween[0], lBetween[1], lBetween[2]);
    _pushTri(positions, apexT[0], apexT[1], apexT[2], lBetween[0], lBetween[1], lBetween[2], u1[0], u1[1], u1[2]);
  }
  for (let i = 0; i < 3; i++) {
    const l0 = lower[i], l1 = lower[(i + 1) % 3];
    const uBetween = upper[(i + 1) % 3];  // matched by 60° offset
    // Bottom rhombus mirror
    _pushTri(positions, apexB[0], apexB[1], apexB[2], l1[0], l1[1], l1[2], uBetween[0], uBetween[1], uBetween[2]);
    _pushTri(positions, apexB[0], apexB[1], apexB[2], uBetween[0], uBetween[1], uBetween[2], l0[0], l0[1], l0[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Saddle (baroque) dolomite — CURVED-FACE rhombohedron. Deformation/shear arc
// (proposals/RESEARCH-deformation-shear-2026-06-20.md §2): the saddle curvature
// is a GROWTH-DEFECT — Ca-excess lattice strain + surface roughening above the
// ~50–60 °C critical roughening temperature (Gregg & Sibley 1984; Barber,
// Reeder & Smith 1985 TEM) — NOT external tectonic shear. The {104} faces bow
// convexly into the diagnostic "saddle"/baroque silhouette. Same 8-vertex
// topology as _makeRhombohedron, but each of the 6 rhombic faces is grid-
// subdivided and bulged OUTWARD along its normal, pinned to zero at the four
// edges (bump = 16·s(1-s)·t(1-t)) so adjacent faces still share exact edges and
// the solid stays watertight. `curvature` (≈0.06–0.20) is the bow amplitude;
// the mesh-sync hook keys it gently to growth T (the literature gives no
// quantitative curvature law, so the scaling is mild + clamped).
function _makeSaddleRhomb(curvature: number): any {
  const amp = Math.max(0.0, Math.min(0.30, curvature || 0.12));
  const h = 0.50, t = 0.18, r = 0.42;   // matches _makeRhombohedron
  const upper: any[] = [0, 1, 2].map(i => { const a = (i / 3) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * r, t, Math.sin(a) * r]; });
  const lower: any[] = [0, 1, 2].map(i => { const a = (i / 3) * Math.PI * 2 + Math.PI / 6 + Math.PI / 3; return [Math.cos(a) * r, -t, Math.sin(a) * r]; });
  const apexT = [0, h, 0], apexB = [0, -h, 0];
  // 6 rhombic faces as perimeter-ordered quads [A,B,C,D] (A→B→C→D→A). Top 3
  // hang off the upper apex, bottom 3 off the lower — mirror of the triangle
  // split in _makeRhombohedron, but kept as quads so bilinear gridding works.
  const faces: any[] = [];
  for (let i = 0; i < 3; i++) faces.push([apexT, upper[i], lower[i], upper[(i + 1) % 3]]);
  for (let i = 0; i < 3; i++) faces.push([apexB, lower[(i + 1) % 3], upper[(i + 1) % 3], lower[i]]);
  const positions: number[] = [];
  const G = 4;
  for (const f of faces) {
    const A = f[0], B = f[1], C = f[2], D = f[3];
    // flat-face normal (edges A→B, A→D), flipped to point outward from origin
    let nx = (B[1] - A[1]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[1] - A[1]);
    let ny = (B[2] - A[2]) * (D[0] - A[0]) - (B[0] - A[0]) * (D[2] - A[2]);
    let nz = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const cx = (A[0] + B[0] + C[0] + D[0]) / 4, cy = (A[1] + B[1] + C[1] + D[1]) / 4, cz = (A[2] + B[2] + C[2] + D[2]) / 4;
    if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const P = (s: number, tt: number): number[] => {
      const w00 = (1 - s) * (1 - tt), w10 = s * (1 - tt), w11 = s * tt, w01 = (1 - s) * tt;
      const x = w00 * A[0] + w10 * B[0] + w11 * C[0] + w01 * D[0];
      const y = w00 * A[1] + w10 * B[1] + w11 * C[1] + w01 * D[1];
      const z = w00 * A[2] + w10 * B[2] + w11 * C[2] + w01 * D[2];
      const bump = amp * 16 * s * (1 - s) * tt * (1 - tt);
      return [x + nx * bump, y + ny * bump, z + nz * bump];
    };
    for (let si = 0; si < G; si++) {
      for (let ti = 0; ti < G; ti++) {
        const p00 = P(si / G, ti / G), p10 = P((si + 1) / G, ti / G);
        const p11 = P((si + 1) / G, (ti + 1) / G), p01 = P(si / G, (ti + 1) / G);
        _pushTri(positions, p00[0], p00[1], p00[2], p10[0], p10[1], p10[2], p11[0], p11[1], p11[2]);
        _pushTri(positions, p00[0], p00[1], p00[2], p11[0], p11[1], p11[2], p01[0], p01[1], p01[2]);
      }
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Calcite scalenohedron ("dogtooth") — 12 scalene triangle faces, two
// pointed apices on the c-axis. Geometrically a tall stretched
// bipyramid where the equatorial belt is two staggered triangles
// rather than a regular hexagon, so each face is a non-equilateral
// (scalene) triangle. Sharper and more elongated than the cleavage
// rhombohedron.
function _makeScalenohedron(): any {
  const h = 0.50;             // apex height (full c-axis range ±0.5)
  const tBelt = 0.05;         // equatorial-belt half-height (small → narrow waist)
  const r = 0.30;             // equatorial radius (skinnier than rhomb at r=0.42)
  // 6 equatorial vertices in two staggered triangles at slightly
  // different heights — this asymmetry is what makes the faces scalene.
  const upper = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * r, +tBelt, Math.sin(a) * r];
  });
  const lower = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6 + Math.PI / 3;
    return [Math.cos(a) * r, -tBelt, Math.sin(a) * r];
  });
  const apexT = [0, h, 0];
  const apexB = [0, -h, 0];
  const positions: number[] = [];
  // 6 upper scalene triangles: top apex + adjacent (upper, lower) pair
  for (let i = 0; i < 3; i++) {
    const u = upper[i];
    const lL = lower[(i + 2) % 3];  // lower vertex to the "left" of u
    const lR = lower[i];             // lower vertex to the "right" of u
    _pushTri(positions, apexT[0], apexT[1], apexT[2], lL[0], lL[1], lL[2], u[0], u[1], u[2]);
    _pushTri(positions, apexT[0], apexT[1], apexT[2], u[0], u[1], u[2], lR[0], lR[1], lR[2]);
  }
  // 6 lower scalene triangles: bottom apex + adjacent pair (mirror)
  for (let i = 0; i < 3; i++) {
    const l = lower[i];
    const uL = upper[i];                  // upper vertex to the "left"
    const uR = upper[(i + 1) % 3];        // upper vertex to the "right"
    _pushTri(positions, apexB[0], apexB[1], apexB[2], l[0], l[1], l[2], uL[0], uL[1], uL[2]);
    _pushTri(positions, apexB[0], apexB[1], apexB[2], uR[0], uR[1], uR[2], l[0], l[1], l[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Calcite mechanical e-TWIN lamellae (deformation arc §5.3 tenant, 2026-06-22). A
// post-growth crystal-plastic OVERPRINT: tectonic strain glides the finished calcite on
// its e-twin plane {01-12}, filling it with parallel mechanical-twin lamellae — the
// textbook calcite paleostress/paleotemperature gauge (Ferrill et al. 2004 Type I-IV;
// Burkhard 1993; Turner 1953). Built by subdividing the scalenohedron (dogtooth — the
// marble-calcite habit) enough to bake crisp parallel dark stripes (the lamella traces)
// into vertex colours along an oblique-to-c lamella normal, the chiastolite/sector idiom.
// `density` (∝ strain, the directive magnitude) drives BOTH the lamella count (Ferrill
// Type I few → Type IV many) and their thickness. Material runs vertexColors with
// color=white so the baked stripes render directly. Gated in the mesh-sync hook on
// crystal._deformation.kind === 'etwin' + mineral calcite.
function _makeTwinnedCalcite(density: number): any {
  const base = _makeScalenohedron();
  let pos: number[] = Array.from(base.attributes.position.array as Float32Array);
  // Subdivide each triangle (midpoint 1→4) so the bands resolve crisply, not as gradients.
  const LEVELS = 3;
  for (let lv = 0; lv < LEVELS; lv++) {
    const next: number[] = [];
    for (let i = 0; i < pos.length; i += 9) {
      const a = [pos[i], pos[i + 1], pos[i + 2]];
      const b = [pos[i + 3], pos[i + 4], pos[i + 5]];
      const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
      const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      const push3 = (p: number[], q: number[], r: number[]) => next.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
      push3(a, ab, ca); push3(ab, b, bc); push3(ca, bc, c); push3(ab, bc, ca);
    }
    pos = next;
  }
  const d = Math.max(0, Math.min(1, density));
  // Lamella normal — oblique to the c-axis (y), the e-twin {01-12} trace direction.
  const nx = 0.32, ny = 1.0, nz = 0.0, nlen = Math.hypot(nx, ny, nz);
  const freq = 5 + d * 9;              // band count: Ferrill Type I (few) → Type IV (many)
  const bandFrac = 0.30 + d * 0.12;    // lamella thickness fraction (thicker at higher strain)
  const body = new THREE.Color('#f1ece1');   // pale calcite body (warm white)
  const twin = new THREE.Color('#b09a78');   // the lamella trace — a darker tan line
  const colors: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const t = (pos[i] * nx + pos[i + 1] * ny + pos[i + 2] * nz) / nlen;
    let frac = ((t + 0.5) * freq) % 1; if (frac < 0) frac += 1;
    const col = frac < bandFrac ? twin : body;
    colors.push(col.r, col.g, col.b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// PROPOSAL-HABIT-BIAS Slice 4 — cave dripstone primitive. Tapered
// hexagonal icicle for air-mode crystals (stalactites + stalagmites)
// on dripstone-eligible canonicals (prism / spike / rhomb / scalene /
// botryoidal). Mirrors PRIM_DRIPSTONE in js/99c-renderer-primitives.ts
// so the Three.js and wireframe renderers produce a congruent silhouette
// — Hill & Forti 1997 (Cave Minerals of the World): mature stalactites
// taper from a wide ceiling-anchored base to a narrow drip tip, 5-10:1
// aspect ratio with vertical surface ridges from streaming water down
// the flanks.
//
// Local +Y is the c-axis. y ∈ [-0.5, +0.5] (unit-scale matching the
// other primitives). Base ring at y=-0.5 hugs the substrate (ceiling
// for stalactite, floor for stalagmite); apex at y=+0.5 is the drip
// tip. The instance transform (Three.js `mesh.scale.set(aWid, cLen,
// aWid)`) stretches y by c_length_mm and x/z by a_width_mm; combined
// with the primitive's slim 0.30 max radius and prismatic crystals'
// natural 2.5:1 c/a ratio, the final aspect lands in the 5-10:1
// realistic-stalactite band.
//
// Geometry: 4 latitude rings × 6 longitudes + 1 apex = 25 unique
// vertices; 36 side triangles (3 ring-to-ring bands × 12) + 6 apex
// fan triangles + 4 base hex-cap triangles = 46 triangles total.
// Vertices are duplicated where needed for flat-shaded faceted look
// (matches the wireframe's ridge silhouette).
function _makeDripstoneIcicle(): any {
  // y-axis tapering profile — matches PRIM_DRIPSTONE's relative radii
  // and y positions, remapped from the wireframe's [-0.1, 1.0] range
  // to the standard [-0.5, +0.5] Three.js half-unit. Base at -0.5,
  // apex at +0.5. Radii taper non-linearly: more shrinkage near the
  // base, less near the tip, so the lower 60% is nearly cylindrical
  // and the apex acts like a separate "drip nozzle."
  const rings = [
    { y: -0.50, r: 0.30 },   // base (substrate-anchored)
    { y: -0.14, r: 0.22 },   // upper shoulder
    { y:  0.18, r: 0.13 },   // mid-shaft
    { y:  0.41, r: 0.06 },   // sub-tip neck
  ];
  const apexY = 0.50;
  const NLON = 6;
  const positions: number[] = [];
  // Pre-compute ring vertex coordinates.
  const ringPts: number[][][] = rings.map(({ y, r }) => {
    const pts: number[][] = [];
    for (let k = 0; k < NLON; k++) {
      const a = (k / NLON) * Math.PI * 2;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return pts;
  });
  // 3 ring-to-ring bands: each quad split into 2 triangles. Vertices
  // are pushed per-triangle (faceted look) so adjacent faces don't
  // smooth-shade across the ridges.
  for (let band = 0; band < rings.length - 1; band++) {
    const ringA = ringPts[band];
    const ringB = ringPts[band + 1];
    for (let k = 0; k < NLON; k++) {
      const kNext = (k + 1) % NLON;
      const a0 = ringA[k], a1 = ringA[kNext];
      const b0 = ringB[k], b1 = ringB[kNext];
      _pushTri(positions, a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], b0[0], b0[1], b0[2]);
      _pushTri(positions, a1[0], a1[1], a1[2], b1[0], b1[1], b1[2], b0[0], b0[1], b0[2]);
    }
  }
  // Apex fan: 6 triangles from the topmost ring (ringPts[3]) up to
  // the drip-tip apex.
  const topRing = ringPts[rings.length - 1];
  for (let k = 0; k < NLON; k++) {
    const kNext = (k + 1) % NLON;
    const v0 = topRing[k], v1 = topRing[kNext];
    _pushTri(positions, v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], 0, apexY, 0);
  }
  // Base hex cap: 4 triangles fanning from base vertex 0 across the
  // hex. This faces the substrate and is mostly hidden inside the
  // wall by the mesh anchor offset, but closes the mesh so any
  // partial-clip render doesn't show through to the inside.
  const base = ringPts[0];
  for (let k = 1; k < NLON - 1; k++) {
    _pushTri(positions, base[0][0], base[0][1], base[0][2],
                        base[k + 1][0], base[k + 1][1], base[k + 1][2],
                        base[k][0], base[k][1], base[k][2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Hexagonal pyramid — sharper, more crystal-like spike than
// Three.js's ConeGeometry (which interpolates between segments and
// reads as a smooth cone). 6 faceted triangle faces. For acicular,
// dendritic, fibrous habits.
function _makeHexPyramid(): any {
  const r = 0.18;             // narrow base — needles are thin
  const yBase = -0.50;
  const yApex = 0.50;
  const positions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    _pushTri(positions, x0, yBase, z0, x1, yBase, z1, 0, yApex, 0);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// HEMIMORPHIC PRISM — intrinsic crystallographic polarity (central-distance arc Phase 3,
// 2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md). The 10 polar point
// groups have a unique polar axis with structurally INEQUIVALENT ends, so a polar crystal
// terminates DIFFERENTLY at +c vs -c — independent of environment (unlike the extrinsic
// occlusion/stepping drivers). Tenants (catalog audit 2026-06-22): tourmaline (3m),
// hemimorphite (mm2 / Imm2), wurtzite & greenockite (6mm). Render: a dominant pointed
// PYRAMID at one polar end and a flat PINACOID cap at the other (pyramid-DOMINANT, so the
// silhouette differs sharply from the prism-dominant generic hex prism —
// _makeHexPrismWithPyramid is 70% prism / 30% tip; this is the inverse). Which physical
// pole carries the pyramid (the analogous/antilogous → ±c mapping) is reported
// inconsistently across sources, so it is deliberately NOT asserted here — the render shows
// the two-different-ends FACT, not a sign. Also CORRECTS the greenockite token wart:
// 'hexagonal_pyramidal' mapped to 'prism' and rendered as a generic hex prism (the
// pyritohedral/octahedral_REE wart family). Specimen-debt pass 2026-06-23 VERIFIED the hex
// prism + pyramid/flat schematic against the Handbook of Mineralogy for the two 6mm
// wurtzite-structure sulfides (greenockite, wurtzite — both genuinely hexagonal; euhedral
// crystals are the minority habit, coatings/fibrous masses dominate, but the prized form is
// faithful). CAVEAT: hemimorphite is ORTHORHOMBIC (mm2), NOT hexagonal — a hex cross-section
// is wrong for it (real habit: thin tabular crystals in fan-shaped sheaves / botryoidal
// crusts); flagged for its own verification pass. Tourmaline keeps its (now ditrigonal)
// sector-zoned hourglass; this builder catches the others.
function _makeHemimorphicPrism(): any {
  const r = 0.42;
  const yBase = -0.50;        // one polar end — flat basal pinacoid (anchored in the wall)
  const yShoulder = -0.05;    // short prism body (~45%), then a tall pyramid (~55%): polar
  const yApex = 0.50;         // the other polar end — the dominant pyramid termination
  const positions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    // short prism side
    _pushTri(positions, x0, yBase, z0, x1, yBase, z1, x1, yShoulder, z1);
    _pushTri(positions, x0, yBase, z0, x1, yShoulder, z1, x0, yShoulder, z0);
    // tall pyramid to the +c apex (the dominant termination)
    _pushTri(positions, x0, yShoulder, z0, x1, yShoulder, z1, 0, yApex, 0);
    // flat -c pinacoid cap (the distinct analogous pole; fan from base centre)
    _pushTri(positions, 0, yBase, 0, x1, yBase, z1, x0, yBase, z0);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// HEMIMORPHITE FAN — the signature divergent fan / sheaf of thin tabular blades (the Tsumeb
// "bowtie"). Hemimorphite is ORTHORHOMBIC (Imm2, mm2) — NOT hexagonal: single crystals are thin
// tabular on {010}, elongated on c, and hemimorphic (a pointed pyramidal/chisel free end, a flat
// pedion base). Here several blades radiate from a low common attachment — flat ends converge,
// pointed ends splay out and up — the recognizable crystalline habit (Handbook of Mineralogy:
// "sheaflike or fan-shaped aggregates"; thin tabular {010} striated ∥ [001]). Replaces the WRONG
// hexagonal _makeHemimorphicPrism for hemimorphite (greenockite/wurtzite are genuinely 6mm and
// keep that one). Specimen-debt verification pass 2026-06-23. Deterministic (index-varied, no RNG).
function _makeHemimorphiteFan(splay: number = 0.80): any {
  // `splay` = the half-angle (rad) from vertical of the outermost blade. The
  // O5-splitting render (S-c) drives it continuously from `_split.index` so a
  // just-split crystal is a narrow bundle and a mature sheaf a wide wheat-sheaf;
  // the default 0.80 keeps the hemimorphite habit render byte-identical.
  const positions: number[] = [];
  // one thin tabular blade: base point o, unit long axis a, unit broad-face normal n; width dir
  // e = a×n. Rectangular section (hw along e, ht along n) base→shoulder, then a chisel ridge (a
  // thin tabular crystal terminates as a roof-edge, not a 4-faced point). Flat pedion base cap.
  const blade = (o: number[], a: number[], n: number[], len: number, hw: number, ht: number) => {
    const e = [a[1]*n[2]-a[2]*n[1], a[2]*n[0]-a[0]*n[2], a[0]*n[1]-a[1]*n[0]];
    const P = (t: number, u: number, v: number) => [
      o[0] + a[0]*t*len + e[0]*u + n[0]*v,
      o[1] + a[1]*t*len + e[1]*u + n[1]*v,
      o[2] + a[2]*t*len + e[2]*u + n[2]*v,
    ];
    const tS = 0.78, hwT = hw * 0.35;
    const B = [P(0,-hw,-ht), P(0,hw,-ht), P(0,hw,ht), P(0,-hw,ht)];      // base ring (pedion)
    const S = [P(tS,-hw,-ht), P(tS,hw,-ht), P(tS,hw,ht), P(tS,-hw,ht)];  // shoulder ring
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      _pushTri(positions, B[i][0],B[i][1],B[i][2], B[j][0],B[j][1],B[j][2], S[j][0],S[j][1],S[j][2]);
      _pushTri(positions, B[i][0],B[i][1],B[i][2], S[j][0],S[j][1],S[j][2], S[i][0],S[i][1],S[i][2]);
    }
    _pushTri(positions, B[0][0],B[0][1],B[0][2], B[2][0],B[2][1],B[2][2], B[1][0],B[1][1],B[1][2]);  // flat pedion base
    _pushTri(positions, B[0][0],B[0][1],B[0][2], B[3][0],B[3][1],B[3][2], B[2][0],B[2][1],B[2][2]);
    const t0 = P(1,-hwT,0), t1 = P(1,hwT,0);                             // chisel ridge edge (ht→0)
    _pushTri(positions, S[3][0],S[3][1],S[3][2], S[2][0],S[2][1],S[2][2], t1[0],t1[1],t1[2]);        // +n broad face → ridge
    _pushTri(positions, S[3][0],S[3][1],S[3][2], t1[0],t1[1],t1[2], t0[0],t0[1],t0[2]);
    _pushTri(positions, S[0][0],S[0][1],S[0][2], t0[0],t0[1],t0[2], t1[0],t1[1],t1[2]);              // -n broad face → ridge
    _pushTri(positions, S[0][0],S[0][1],S[0][2], t1[0],t1[1],t1[2], S[1][0],S[1][1],S[1][2]);
    _pushTri(positions, S[1][0],S[1][1],S[1][2], t1[0],t1[1],t1[2], S[2][0],S[2][1],S[2][2]);        // +e chisel end
    _pushTri(positions, S[0][0],S[0][1],S[0][2], S[3][0],S[3][1],S[3][2], t0[0],t0[1],t0[2]);        // -e chisel end
  };
  const N = 6;
  for (let k = 0; k < N; k++) {
    const f = k / (N - 1);                          // 0..1 across the fan
    const ang = -splay + 2 * splay * f;             // -splay..+splay from vertical, splayed in x-y
    const a = [Math.sin(ang), Math.cos(ang), 0];    // unit long axis (fans in the x-y plane)
    const n = [0, 0, 1];                            // broad face ≈ ±z → a flat bowtie spray
    const len = 0.74 + 0.09 * Math.cos(k * 1.7);    // slight deterministic length variation
    const o = [(f - 0.5) * 0.05, -0.5, (k % 2 === 0 ? 0.015 : -0.015)];
    blade(o, a, n, len, 0.10, 0.03);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Phase 1c (v156, 2026-05-27): aragonite cave frostwork — radiating
// spray of acicular needles from a central anchor. Real cave aragonite
// morphology per Hill & Forti 1997 (Cave Minerals of the World §5.3.4,
// §10). Used when growth_environment === 'air' and mineral === 'aragonite'
// (see _resolveCrystalGeomToken). Distinguished from the generic
// 'dripstone' icicle: frostwork is a splayed multi-needle cluster, not
// a single tapered cone. Five needles radiating from a common base —
// one central (straight up), four tilted at ~30° in the four cardinal
// directions. Deterministic geometry (no RNG); identical across runs.
function _makeAragoniteFrostwork(): any {
  const positions: number[] = [];
  const baseY = -0.50;
  const needleLen = 1.0;       // each needle reaches roughly unit height
  const needleR = 0.04;        // very thin — acicular
  // 5 needles radiating from the base nucleus. Axes give needle
  // direction in unit-cube coordinates; each is normalized below.
  const needleAxes: Array<[number, number, number]> = [
    [0,     1.00, 0    ],     // central spike (straight up)
    [0.45,  0.90, 0    ],     // tilt +x
    [-0.45, 0.90, 0    ],     // tilt -x
    [0,     0.90, 0.45 ],     // tilt +z
    [0,     0.90, -0.45],     // tilt -z
  ];
  for (const ax of needleAxes) {
    const m = Math.hypot(ax[0], ax[1], ax[2]);
    const nx = ax[0] / m, ny = ax[1] / m, nz = ax[2] / m;
    // Build a perpendicular basis (a, b) for the needle's cross-section.
    let ux = -ny, uy = nx, uz = 0;
    const ulen = Math.hypot(ux, uy, uz);
    if (ulen < 1e-6) { ux = 1; uy = 0; uz = 0; }
    else { ux /= ulen; uy /= ulen; uz /= ulen; }
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    // Square cross-section ring at the needle's base; tip at base + len * axis
    const tipX = nx * needleLen;
    const tipY = baseY + ny * needleLen;
    const tipZ = nz * needleLen;
    const ring: Array<[number, number, number]> = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const ru = Math.cos(a) * needleR;
      const rv = Math.sin(a) * needleR;
      ring.push([
        ru * ux + rv * vx,
        baseY + ru * uy + rv * vy,
        ru * uz + rv * vz,
      ]);
    }
    // 4 pyramid faces — each ring edge to the tip.
    for (let i = 0; i < 4; i++) {
      const p0 = ring[i], p1 = ring[(i + 1) % 4];
      _pushTri(positions,
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        tipX, tipY, tipZ);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Beveled tablet — flat plate with chamfered edges. Reads as the
// "fish-tail" wulfenite or wedge-edged baryte tabular habit better
// than a flat box. 8 vertices on the top face (octagon-shaped after
// bevel), 8 on the bottom — 8 large square + 4 trapezoidal faces.
function _makeBeveledTablet(): any {
  const halfW = 0.50;         // half-width along x and z
  const bevel = 0.10;         // bevel offset (chamfered corners)
  const halfH = 0.20;         // half-thickness (c-axis short)
  // 8 top vertices: octagonal outline at y=+halfH
  const yT = +halfH, yB = -halfH;
  const top = [
    [+halfW - bevel, yT, +halfW],         // edge
    [+halfW, yT, +halfW - bevel],         // corner inset
    [+halfW, yT, -halfW + bevel],
    [+halfW - bevel, yT, -halfW],
    [-halfW + bevel, yT, -halfW],
    [-halfW, yT, -halfW + bevel],
    [-halfW, yT, +halfW - bevel],
    [-halfW + bevel, yT, +halfW],
  ];
  const bot = top.map(v => [v[0], yB, v[2]]);
  const positions: number[] = [];
  // Top face — fan from center (octagonal, 8 triangles)
  for (let i = 0; i < 8; i++) {
    const a = top[i], b = top[(i + 1) % 8];
    _pushTri(positions, 0, yT, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  // Bottom face — fan from center, reversed winding
  for (let i = 0; i < 8; i++) {
    const a = bot[i], b = bot[(i + 1) % 8];
    _pushTri(positions, 0, yB, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
  }
  // 8 side faces — rectangle quads as triangle pairs between corresponding top/bottom verts
  for (let i = 0; i < 8; i++) {
    const t0 = top[i], t1 = top[(i + 1) % 8];
    const b0 = bot[i], b1 = bot[(i + 1) % 8];
    _pushTri(positions, t0[0], t0[1], t0[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2]);
    _pushTri(positions, t0[0], t0[1], t0[2], b1[0], b1[1], b1[2], t1[0], t1[1], t1[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Garnet rhombic dodecahedron — 12 rhombic faces, 14 vertices
// (6 axial + 8 cube-corner). The classic "garnet" silhouette,
// distinct from the regular pentagonal Platonic dodecahedron that
// Three.js's DodecahedronGeometry produces. Each rhombic face has
// 4 coplanar vertices: 2 axial verts on adjacent coordinate axes +
// 2 cube-corner verts diagonally between them.
function _makeRhombicDodecahedron(): any {
  const r = 0.50;             // axial radius
  const c = 0.25;             // cube-corner half-coordinate (axial verts further from origin → r > c√3 keeps the rhombi planar; r=0.5 c=0.25 gives the regular form scaled to fit a unit-ish bounding box)
  // 6 axial vertices
  const A = {
    px: [+r, 0, 0], nx: [-r, 0, 0],
    py: [0, +r, 0], ny: [0, -r, 0],
    pz: [0, 0, +r], nz: [0, 0, -r],
  };
  // 8 cube-corner vertices
  const C = (sx: number, sy: number, sz: number) => [sx * c, sy * c, sz * c];
  // 12 rhombic faces — each spans 2 axial verts on adjacent axes +
  // 2 cube corners between them. Defined as quads (4 verts in cyclic
  // order); each quad becomes 2 triangles in the position list.
  const faces: number[][][] = [
    // +x with +y, +y with -x, -x with -y, -y with +x   (top z half + bottom z half)
    [A.px, C(+1,+1,+1), A.py, C(+1,+1,-1)],   // +x +y
    [A.py, C(-1,+1,+1), A.nx, C(-1,+1,-1)],   // +y -x
    [A.nx, C(-1,-1,+1), A.ny, C(-1,-1,-1)],   // -x -y
    [A.ny, C(+1,-1,+1), A.px, C(+1,-1,-1)],   // -y +x
    // ±x with ±z
    [A.px, C(+1,+1,+1), A.pz, C(+1,-1,+1)],   // +x +z
    [A.pz, C(-1,+1,+1), A.nx, C(-1,-1,+1)],   // +z -x
    [A.nx, C(-1,+1,-1), A.nz, C(-1,-1,-1)],   // -x -z
    [A.nz, C(+1,+1,-1), A.px, C(+1,-1,-1)],   // -z +x
    // ±y with ±z
    [A.py, C(+1,+1,+1), A.pz, C(-1,+1,+1)],   // +y +z
    [A.pz, C(+1,-1,+1), A.ny, C(-1,-1,+1)],   // +z -y
    [A.ny, C(+1,-1,-1), A.nz, C(-1,-1,-1)],   // -y -z
    [A.nz, C(+1,+1,-1), A.py, C(-1,+1,-1)],   // -z +y
  ];
  const positions: number[] = [];
  for (const f of faces) {
    const [a, b, c2, d] = f;
    _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c2[0], c2[1], c2[2]);
    _pushTri(positions, a[0], a[1], a[2], c2[0], c2[1], c2[2], d[0], d[1], d[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Botryoidal cluster — 4 hemispheres of varying size welded into a
// bumpy mass. Reads as a malachite kidney / hematite blob far better
// than a single sphere. Each "bubble" is just a low-poly sphere
// translated; the geometries get merged at the end so the cluster
// is one BufferGeometry per token.
function _makeBotryoidalCluster(completeness: number = 1): any {
  // `completeness` in [0,1] = how CLOSED the radial sphere is. The O5-splitting
  // render (S-c) drives it from `_split.index` past the spherulite onset: a
  // just-crossed spherulite is a tighter central mass with under-grown lobes, a
  // full-index one closes into the round botryoidal rosette. The peripheral lobe
  // radii scale 0.35→1.0 with completeness (central bump always full); default 1
  // keeps the botryoidal habit render byte-identical.
  const c = Math.max(0, Math.min(1, completeness));
  const lobeScale = 0.35 + 0.65 * c;
  const bubbles = [
    { r: 0.42,             x: 0.00, y: 0.05, z: 0.00 },   // dominant central bump
    { r: 0.26 * lobeScale, x: 0.30, y: -0.10, z: 0.10 },  // small lobe
    { r: 0.30 * lobeScale, x: -0.18, y: 0.00, z: 0.22 },  // medium lobe
    { r: 0.22 * lobeScale, x: 0.12, y: -0.05, z: -0.30 }, // small lobe (back)
  ];
  // Build each sphere, translate, accumulate positions.
  const positions: number[] = [];
  for (const b of bubbles) {
    const sph = new THREE.SphereGeometry(b.r, 10, 6);
    sph.translate(b.x, b.y, b.z);
    const arr = sph.attributes.position.array;
    // SphereGeometry is indexed — need to expand to triangles per the index buffer.
    const idx = sph.index ? sph.index.array : null;
    if (idx) {
      for (let i = 0; i < idx.length; i++) {
        const v = idx[i] * 3;
        positions.push(arr[v], arr[v + 1], arr[v + 2]);
      }
    } else {
      for (let i = 0; i < arr.length; i++) positions.push(arr[i]);
    }
    sph.dispose();
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Fluorite penetration twin — two interpenetrating cubes rotated 60°
// around their shared body diagonal [1,1,1]/√3 (Sunagawa 2005 §6.4;
// Dana 8th ed. CaF2 section). The Weardale Cumbria / Cave-in-Rock /
// Berbes signature visible in real specimens as a 14-pointed star
// silhouette. Mirrors PRIM_FLUORITE_PENETRATION_TWIN in
// js/99c-renderer-primitives.ts so the wireframe and Three.js renderers
// agree on the twin geometry (PROPOSAL-HABIT-BIAS.md §11 cross-renderer
// parity rule).
//
// Math: cube A has 8 corners at (±c, ±c, ±c) for half-extent c = 0.4
// (matching the cube case's BoxGeometry(0.8) so a twinned fluorite is
// the same overall envelope as an untwinned one). Cube B is cube A
// rotated by R = (1/3) × [[2,2,-1],[-1,2,2],[2,-1,2]], the 60°-around-
// [1,1,1]/√3 rotation derived from Rodrigues' formula. The body-
// diagonal endpoints (-c,-c,-c) and (+c,+c,+c) sit on the rotation
// axis and are invariant under R; the other 6 corners of each cube map
// to NEW positions, producing the interpenetrating-cube silhouette.
//
// Flat-shaded: 6 faces × 2 triangles per cube × 2 cubes = 24 triangles,
// 72 vertex triples in the position attribute. No shared verts between
// faces — each face reads as its own facet, matching the convention of
// the other _make* builders in this file.
function _makeFluoritePenetrationTwin(): any {
  const c = 0.4;  // half-extent — matches cube case's BoxGeometry(0.8)
  // Cube A: 8 corners ordered by (sx, sy, sz) loops to match
  // PRIM_FLUORITE_PENETRATION_TWIN's vertex indexing on the wireframe
  // side. 0:(-,-,-) 1:(-,-,+) 2:(-,+,-) 3:(-,+,+) 4:(+,-,-) 5:(+,-,+)
  // 6:(+,+,-) 7:(+,+,+). Body-diagonal axis is 0 → 7.
  const A: number[][] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        A.push([c * sx, c * sy, c * sz]);
      }
    }
  }
  // Cube B: rotate each cube-A vertex by R around the origin (which
  // is on the body-diagonal axis, so the (-,-,-) and (+,+,+) corners
  // stay fixed). Centered at origin to match the cube case's anchoring;
  // the wireframe's y=0.45 offset is its own convention.
  const B = A.map(([x, y, z]) => [
    (2 * x + 2 * y - z) / 3,
    (-x + 2 * y + 2 * z) / 3,
    (2 * x - y + 2 * z) / 3,
  ]);
  // Emit 6 cube faces as 12 triangles, CCW from outside (so flat-shaded
  // normals point outward). Indexing is consistent across both cubes
  // because both share the (sx, sy, sz) ordering above.
  const pushCube = (out: number[], v: number[][]): void => {
    const tri = (a: number, b: number, c: number) => {
      _pushTri(out, v[a][0], v[a][1], v[a][2], v[b][0], v[b][1], v[b][2], v[c][0], v[c][1], v[c][2]);
    };
    tri(0, 1, 3); tri(0, 3, 2);  // -X face
    tri(4, 6, 7); tri(4, 7, 5);  // +X face
    tri(0, 4, 5); tri(0, 5, 1);  // -Y face
    tri(2, 3, 7); tri(2, 7, 6);  // +Y face
    tri(0, 2, 6); tri(0, 6, 4);  // -Z face
    tri(1, 5, 7); tri(1, 7, 3);  // +Z face
  };
  const positions: number[] = [];
  pushCube(positions, A);
  pushCube(positions, B);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Selenite swallowtail twin — two thin tabular blades joined on a
// {100} contact plane at the base, opening upward in a V (Dana 8th
// ed. CaSO4·2H2O section; Hurlbut & Klein 23rd ed. §13). The iconic
// "fishtail" / "swallowtail" gypsum twin, present in Bohemian +
// Naica + Mojave specimens. Mirrors PRIM_SELENITE_SWALLOWTAIL_TWIN
// in js/99c-renderer-primitives.ts so both renderers agree on the
// twin geometry (PROPOSAL-HABIT-BIAS.md §11 cross-renderer parity).
//
// Math: each blade is a thin rectangular block in its local coords
// (xl ∈ {-2a, 0} for blade A; yl ∈ {0, L} long axis; zl ∈ {-b, +b}
// width). Blade A is rotated +30° around the world z-axis; blade B
// is rotated -30°. The contact-base edge (xl=0, yl=0) stays fixed
// at the origin; the rest of each blade tilts outward. Total V
// opening angle 60°.
//
// Anchoring: centered at origin (not y=-0.1 like the wireframe) to
// match the 99i convention where geometries are centered and the
// instance transform handles wall placement. The outer base corners
// of each blade sit BELOW y=0; the instance transform anchors the
// blade-pair such that the visible V opens above the wall.
//
// Flat-shaded: 6 faces × 2 triangles per blade × 2 blades = 24
// triangles, 72 vertex triples — matches fluorite-twin geometry count.
function _makeSeleniteSwallowtailTwin(): any {
  const a = 0.05;             // half-thickness (perpendicular to broad face)
  const L = 0.95;             // blade length along c-axis
  const b = 0.15;             // half-width (along contact edge, Z)
  const theta = Math.PI / 6;  // 30° tilt per blade — 60° total V
  const c30 = Math.cos(theta);
  const s30 = Math.sin(theta);
  // Build the 8 world-space corners of each blade. Indexing matches
  // the wireframe PRIM_SELENITE_SWALLOWTAIL_TWIN: (xl, yl, zl) loop
  // order in {-2a, 0} × {0, L} × {-b, +b}. The contact-base corners
  // are 4, 5 (blade A) and 12, 13 (blade B) — they coincide at the
  // origin.
  const buildBladeA = (): number[][] => {
    const out: number[][] = [];
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * c30 - yl * s30;
          const wy = xl * s30 + yl * c30;
          out.push([wx, wy, zl]);
        }
      }
    }
    return out;
  };
  const buildBladeB = (): number[][] => {
    // Mirror of blade A across X=0.
    const out: number[][] = [];
    for (const xl of [0, 2 * a]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * c30 + yl * s30;
          const wy = -xl * s30 + yl * c30;
          out.push([wx, wy, zl]);
        }
      }
    }
    return out;
  };
  const A = buildBladeA();
  const B = buildBladeB();
  // Emit 6 box faces as 12 triangles per blade, CCW from outside so
  // flat-shaded normals point outward. Same face indexing as the
  // fluorite twin's cube helper: faces are pairs of constant
  // xl/yl/zl coords, vertex indices follow the (xl, yl, zl) loops.
  const pushBlade = (out: number[], v: number[][]): void => {
    const tri = (a: number, b: number, c: number) => {
      _pushTri(out, v[a][0], v[a][1], v[a][2], v[b][0], v[b][1], v[b][2], v[c][0], v[c][1], v[c][2]);
    };
    // Vertices in (xl, yl, zl) loop order:
    //   0: (-2a, 0, -b)  1: (-2a, 0, +b)  2: (-2a, L, -b)  3: (-2a, L, +b)
    //   4: (0, 0, -b)    5: (0, 0, +b)    6: (0, L, -b)    7: (0, L, +b)
    // (For blade B, replace -2a with 0 and 0 with +2a; indices match.)
    tri(0, 1, 3); tri(0, 3, 2);  // xl = -2a face (outer broad face for blade A)
    tri(4, 6, 7); tri(4, 7, 5);  // xl = 0 face (contact-side broad face)
    tri(0, 4, 5); tri(0, 5, 1);  // yl = 0 face (base)
    tri(2, 3, 7); tri(2, 7, 6);  // yl = L face (top)
    tri(0, 2, 6); tri(0, 6, 4);  // zl = -b face (one side edge)
    tri(1, 5, 7); tri(1, 7, 3);  // zl = +b face (other side edge)
  };
  const positions: number[] = [];
  pushBlade(positions, A);
  pushBlade(positions, B);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Galena spinel-law octahedron twin — two octahedra sharing a {111}
// triangular face, the classic contact twin documented in Ramdohr
// 1980 §4.3.6 + Boyle 1968's Cobalt-Ontario silver-galena ores.
// Mirrors PRIM_GALENA_OCTAHEDRON_TWIN in js/99c-renderer-primitives.ts
// for cross-renderer parity. v133's twin_laws[].probability=0.10
// means ~10% of galena crystals have crystal.twinned=true +
// crystal.twin_law='spinel_law' set by _rollSpontaneousTwin.
//
// Math: first octahedron with vertices at (±c, 0, 0), (0, ±c, 0),
// (0, 0, ±c) for c=0.55 (matches THREE.OctahedronGeometry(0.55, 0)
// envelope). Second octahedron = reflection across the {111} plane
// x+y+z = c, which leaves 3 vertices (the contact-face vertices) on
// the plane and maps the other 3 to new positions in the +X+Y+Z
// octant. Reflection formula: P' = P - 2*(P·n - d)/|n|² * n with
// n=(1,1,1), d=c, |n|²=3.
//
// Flat-shaded triangulation: each octahedron has 8 triangular faces.
// The contact face ({+x, +y, +z} octant face of both octahedra) is
// SKIPPED for both octahedra — it's hidden inside the twin body and
// would otherwise be drawn as a zero-thickness sheet with opposite-
// facing normals. That leaves 7 faces per octahedron × 2 = 14
// triangles, 42 vertex triples in the position attribute.
//
// Face winding: CCW from outside. For the second octahedron (which
// is a mirror image of the first), winding is REVERSED to maintain
// outward-pointing normals.
function _makeGalenaOctahedronTwin(): any {
  const c = 0.55;            // equatorial radius
  // Vertex layout follows the wireframe convention:
  //   0: +y (top apex)   1: -y (bottom apex)
  //   2: +x (east)       3: -x (west)
  //   4: +z (north)      5: -z (south)
  // Centered at origin to match the 99i convention; instance
  // transform handles wall placement.
  const oct1: number[][] = [
    [0,  c, 0],   // 0 top apex (+y)
    [0, -c, 0],   // 1 bottom apex (-y)
    [ c, 0, 0],   // 2 east (+x)
    [-c, 0, 0],   // 3 west (-x)
    [0, 0,  c],   // 4 north (+z)
    [0, 0, -c],   // 5 south (-z)
  ];
  // Contact plane: {0, 2, 4} face — top + east + north — has plane
  // equation x + y + z = c (each contact vertex satisfies this).
  // Reflect non-contact vertices (1, 3, 5) across the plane; the
  // contact vertices (0, 2, 4) stay fixed.
  const reflect = (p: number[]): number[] => {
    const k = 2 * (p[0] + p[1] + p[2] - c) / 3;
    return [p[0] - k, p[1] - k, p[2] - k];
  };
  const oct2: number[][] = oct1.map(reflect);
  // Faces of an octahedron labeled (top=0, bot=1, E=2, W=3, N=4, S=5).
  // Each face is on a (sx, sy, sz) octant. For our labeling:
  //   octant (+y, +x, +z) → face {0, 2, 4} = top-east-north (the
  //                            CONTACT face — skipped)
  //   octant (+y, +x, -z) → face {0, 2, 5} = top-east-south
  //   octant (+y, -x, +z) → face {0, 3, 4} = top-west-north
  //   octant (+y, -x, -z) → face {0, 3, 5} = top-west-south
  //   octant (-y, +x, +z) → face {1, 2, 4} = bot-east-north
  //   octant (-y, +x, -z) → face {1, 2, 5}
  //   octant (-y, -x, +z) → face {1, 3, 4}
  //   octant (-y, -x, -z) → face {1, 3, 5}
  // CCW-from-outside order for each face (verified via cross-product
  // outward-normal sign), with the {0, 2, 4} contact face omitted:
  const faces: number[][] = [
    // [0, 2, 4]  // contact face — SKIPPED
    [0, 5, 2],   // top-east-south
    [0, 4, 3],   // top-north-west
    [0, 3, 5],   // top-west-south
    [1, 2, 5],   // bot-east-south
    [1, 5, 3],   // bot-south-west
    [1, 3, 4],   // bot-west-north
    [1, 4, 2],   // bot-north-east
  ];
  const positions: number[] = [];
  // First octahedron — emit each face in CCW-from-outside order.
  for (const f of faces) {
    const A = oct1[f[0]], B = oct1[f[1]], C = oct1[f[2]];
    _pushTri(positions, A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  // Second octahedron — same face list, but REVERSED winding because
  // reflection flips orientation. (A, B, C) → (A, C, B) keeps the
  // outward normal pointing outward in the mirrored coordinate frame.
  for (const f of faces) {
    const A = oct2[f[0]], B = oct2[f[1]], C = oct2[f[2]];
    _pushTri(positions, A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// R4e: metric aragonite prisms in the recorded cyclic twin's common c-axis
// frame. Repeated {110} reflection gives ~63.8 degrees between equivalent
// orientations, not exact hexagonal symmetry. Cell matches structural.json.
// Habit/twin reference: handbookofmineralogy.org/pdfs/aragonite.pdf.
// Adjoining sectors use the same {110} planes at their boundaries. A small
// overlap closes the display core; this is not a calibrated domain reconstruction.
// Unequal face development exposes the separate terminations.
function _makeAragonitePseudohexTwin(): any {
  const a = 4.9598, b = 7.9641, c = 5.7379;
  const angle = 2 * Math.atan(a / b);
  const positions: number[] = [], normals: number[] = [];
  const members: any[] = [];
  for (let k = 0; k < 3; k++) {
    const top = [0.5, 0.44, 0.47][k];
    const faces: any[] = [];
    for (const [hkl, family, distance] of [
      [[1, 1, 0], '110', 0.24], [[0, 1, 0], '010', 0.28],
      [[0, 0, 1], '001', 0.5],
    ] as any[]) {
      for (const n of wulffOrthorhombicNormals(hkl, a, b, c)) {
        const d = family === '110' && n[0] > 0 ? 0.025
          : family === '001' && n[1] > 0 ? top : distance;
        faces.push({ n, d, family });
      }
    }
    const poly = wulffPolyhedron(faces);
    const theta = k * (Math.PI - angle), ct = Math.cos(theta), st = Math.sin(theta);
    const rotate = (v: number[]) => [v[0] * ct - v[2] * st, v[1], v[0] * st + v[2] * ct];
    const first = positions.length / 3;
    for (const face of poly.faces) {
      const n = rotate(faces[face.plane].n);
      for (let j = 1; j < face.verts.length - 1; j++) {
        for (const vi of [face.verts[0], face.verts[j], face.verts[j + 1]]) {
          positions.push(...rotate(poly.vertices[vi])); normals.push(...n);
        }
      }
    }
    members.push({ theta, top, first, count: positions.length / 3 - first });
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.userData.aragoniteR4 = { members, angle, families: ['110', '010', '001'] };
  return geom;
}
// Cerussite stellate-sixling — the flat-star counterpart to the
// aragonite pseudo-hex column. Three thin blades lying in the wall
// plane (XZ), each rotated 60° from the next around y-axis. Each
// blade extends through origin in both radial directions, so 3
// blades × 2 arms = 6 arms (the "sixling" of the law name).
// Documented in Dana 8th ed. PbCO3 section; Heinrich & Vian 1967
// reported stellate trillings as the dominant cerussite twin habit
// in MVT districts. Mirrors PRIM_CERUSSITE_SIXLING_TWIN in
// 99c-renderer-primitives.ts. v133 set the probability to 0.40.
//
// Math: each blade in its local frame has xl as the long axis
// (radial after rotation), yl as the thin wall-perpendicular
// dimension, zl as the thin tangential dimension. Rotation by
// θ_k = k · 60° around the y-axis spreads the blades in the wall
// plane.
//
// Flat-shaded: 6 box faces × 2 triangles × 3 blades = 36 triangles,
// 108 vertex triples (matches the aragonite twin's vertex count;
// the math is parallel, just with different axis convention).
function _makeCerussiteSixlingTwin(): any {
  const c_long = 0.5;        // radial half-length (long axis in XZ)
  const b_tan = 0.08;        // tangential half-width (narrow)
  const thin_y = 0.05;       // half-thickness in Y (very thin — flat on wall)
  const positions: number[] = [];
  const pushBlade = (theta: number): void => {
    const cT = Math.cos(theta);
    const sT = Math.sin(theta);
    const v: number[][] = [];
    // 8 corners in (xl, yl, zl) loop order — same indexing as the
    // aragonite twin's pushPrism helper. Difference: here xl is the
    // long axis (the radial direction in XZ), not the thin direction.
    for (const xl of [-c_long, c_long]) {
      for (const yl of [-thin_y, thin_y]) {
        for (const zl of [-b_tan, b_tan]) {
          v.push([xl * cT - zl * sT, yl, xl * sT + zl * cT]);
        }
      }
    }
    const tri = (i: number, j: number, k: number) => {
      _pushTri(positions, v[i][0], v[i][1], v[i][2], v[j][0], v[j][1], v[j][2], v[k][0], v[k][1], v[k][2]);
    };
    tri(0, 1, 3); tri(0, 3, 2);  // xl = -c face (outer arm 1 endcap)
    tri(4, 6, 7); tri(4, 7, 5);  // xl = +c face (outer arm 2 endcap)
    tri(0, 4, 5); tri(0, 5, 1);  // yl = -thin face (bottom against wall)
    tri(2, 3, 7); tri(2, 7, 6);  // yl = +thin face (top, facing into cavity)
    tri(0, 2, 6); tri(0, 6, 4);  // zl = -b face (tangential side 1)
    tri(1, 5, 7); tri(1, 7, 3);  // zl = +b face (tangential side 2)
  };
  for (let k = 0; k < 3; k++) {
    pushBlade(k * Math.PI / 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Marcasite cockscomb — thin needle blades joined on {110}, opening
// in a tight V. The diagnostic morphology distinguishing marcasite
// from pyrite (Ramdohr 1980 FeS2 dimorph section). Mirrors
// PRIM_MARCASITE_COCKSCOMB_TWIN in 99c-renderer-primitives.ts.
//
// Same construction as the selenite swallowtail builder, with two
// param differences:
//   a = 0.025  (thinner — was 0.05 for swallowtail)
//   b = 0.08   (narrower — was 0.15)
//   theta = π/9  (20° tilt → 40° V — tighter than swallowtail's 60°)
//
// L kept the same as swallowtail (~0.95) for the blade length.
// Centered at origin per the 99i convention.
function _makeMarcasiteCockscombTwin(): any {
  const a = 0.025;            // half-thickness (perpendicular to broad face)
  const L = 0.95;             // blade length along c-axis
  const b = 0.08;             // half-width along contact edge
  const theta = Math.PI / 9;  // 20° tilt per blade — 40° total V
  const c30 = Math.cos(theta);
  const s30 = Math.sin(theta);
  const buildBladeA = (): number[][] => {
    const out: number[][] = [];
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          out.push([xl * c30 - yl * s30, xl * s30 + yl * c30, zl]);
        }
      }
    }
    return out;
  };
  const buildBladeB = (): number[][] => {
    const out: number[][] = [];
    for (const xl of [0, 2 * a]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          out.push([xl * c30 + yl * s30, -xl * s30 + yl * c30, zl]);
        }
      }
    }
    return out;
  };
  const A = buildBladeA();
  const B = buildBladeB();
  const pushBlade = (out: number[], v: number[][]): void => {
    const tri = (i: number, j: number, k: number) => {
      _pushTri(out, v[i][0], v[i][1], v[i][2], v[j][0], v[j][1], v[j][2], v[k][0], v[k][1], v[k][2]);
    };
    tri(0, 1, 3); tri(0, 3, 2);  // xl = -2a face
    tri(4, 6, 7); tri(4, 7, 5);  // xl = 0 face (contact)
    tri(0, 4, 5); tri(0, 5, 1);  // yl = 0 face (base)
    tri(2, 3, 7); tri(2, 7, 6);  // yl = L face (top)
    tri(0, 2, 6); tri(0, 6, 4);  // zl = -b face
    tri(1, 5, 7); tri(1, 7, 3);  // zl = +b face
  };
  const positions: number[] = [];
  pushBlade(positions, A);
  pushBlade(positions, B);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Pyrite iron-cross twin — two chiral {120} pyritohedra interpenetrating
// at 90° around the c-axis (Ramdohr 1980 §4 FeS2 section; Dana 8th ed.;
// Mindat pyrite habits). v133 retuned the probability from 0.008 → 0.07
// to match the field-observation 5-10% twin frequency. Mirrors
// PRIM_PYRITE_IRON_CROSS_TWIN in 99c-renderer-primitives.ts.
//
// The trick: a proper chiral {120} pyritohedron has m-3 (Th) symmetry —
// NO 4-fold axis along c. So 90° rotation around c-axis is NOT a
// symmetry, and the rotated pyritohedron occupies distinct positions.
// (The simplified PRIM_PYRITOHEDRON used for non-twin pyrite has cubic
// over-symmetry — 90° rotation around any axis maps it to itself —
// which is why this twin needs its own non-shared geometry.)
//
// 20 vertices per pyritohedron × 2 = 40 vertices.
// 12 pentagonal faces × 3 triangles per fan × 2 = 72 triangles.
// 72 × 3 = 216 vertex triples in the position attribute (648 floats).
function _makePyriteIronCrossTwin(): any {
  // Unscaled pyritohedron parameters then scaled so max coord = 0.5
  // (99i centered convention). b is the long edge param; max coord is b.
  const s = 0.5 / (Math.sqrt(5) / 2);
  const a = (Math.sqrt(5) / 3) * s;      // cube corner extent
  const b = 0.5;                          // long edge param (max coord)
  const c = (Math.sqrt(5) / 4) * s;      // short edge param
  // "+" pyritohedron: 20 vertices, centered at origin (no y-shift —
  // 99i convention).
  const plus: number[][] = [];
  // Cube corners (0-7) in (sx, sy, sz) loop order.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        plus.push([sx * a, sy * a, sz * a]);
      }
    }
  }
  // Edge verts in 3 cyclic groups (indices 8-19).
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      plus.push([0, sy * b, sz * c]);  // 8-11: YZ-plane (x=0)
    }
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      plus.push([sx * b, sy * c, 0]);  // 12-15: XY-plane (z=0)
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      plus.push([sx * c, 0, sz * b]);  // 16-19: ZX-plane (y=0)
    }
  }
  // "-" pyritohedron: rotation by 90° around y-axis. (x, y, z) → (z, y, -x).
  const minus: number[][] = plus.map(v => [v[2], v[1], -v[0]]);
  // 12 pentagonal faces per pyritohedron, with face normals for winding-
  // direction verification. Each pentagon is a 5-vertex sequence; the
  // emitter checks the cross product of (v1-v0)×(v2-v0) and reverses
  // the pentagon order if the result points opposite the face normal
  // (i.e., if the pentagon would render with inward-pointing flat-shaded
  // normals).
  const facesPlus: { vs: number[]; n: number[] }[] = [
    { vs: [7, 15, 6, 10, 11],    n: [ 1,  2,  0] },  // (1, 2, 0)
    { vs: [3, 13, 2, 10, 11],    n: [-1,  2,  0] },  // (-1, 2, 0)
    { vs: [5, 14, 4, 8, 9],      n: [ 1, -2,  0] },  // (1, -2, 0)
    { vs: [1, 12, 0, 8, 9],      n: [-1, -2,  0] },  // (-1, -2, 0)
    { vs: [7, 11, 3, 17, 19],    n: [ 0,  1,  2] },  // (0, 1, 2)
    { vs: [6, 10, 2, 16, 18],    n: [ 0,  1, -2] },  // (0, 1, -2)
    { vs: [5, 9, 1, 17, 19],     n: [ 0, -1,  2] },  // (0, -1, 2)
    { vs: [4, 8, 0, 16, 18],     n: [ 0, -1, -2] },  // (0, -1, -2)
    { vs: [7, 19, 5, 14, 15],    n: [ 2,  0,  1] },  // (2, 0, 1)
    { vs: [3, 17, 1, 12, 13],    n: [-2,  0,  1] },  // (-2, 0, 1)
    { vs: [6, 18, 4, 14, 15],    n: [ 2,  0, -1] },  // (2, 0, -1)
    { vs: [2, 16, 0, 12, 13],    n: [-2,  0, -1] },  // (-2, 0, -1)
  ];
  // For "-" pyritohedron: same vertex indices (offset by 20) but face
  // normals rotated 90° around y. Normal (nx, ny, nz) → (nz, ny, -nx).
  const facesMinus = facesPlus.map(f => ({
    vs: f.vs.map(i => i + 20),
    n: [f.n[2], f.n[1], -f.n[0]],
  }));
  const positions: number[] = [];
  const emitPentagon = (verts: number[][], face: { vs: number[]; n: number[] }) => {
    const o = face.vs;
    const n = face.n;
    const v0 = verts[o[0]], v1 = verts[o[1]], v2 = verts[o[2]];
    // (v1 - v0) × (v2 - v0)
    const e1x = v1[0] - v0[0], e1y = v1[1] - v0[1], e1z = v1[2] - v0[2];
    const e2x = v2[0] - v0[0], e2y = v2[1] - v0[1], e2z = v2[2] - v0[2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const dot = cx * n[0] + cy * n[1] + cz * n[2];
    const seq = dot >= 0 ? o : [o[0], o[4], o[3], o[2], o[1]];
    // Fan-triangulate from seq[0]: (seq[0], seq[1], seq[2]),
    // (seq[0], seq[2], seq[3]), (seq[0], seq[3], seq[4]).
    for (let i = 1; i < 4; i++) {
      const a = verts[seq[0]], b = verts[seq[i]], c = verts[seq[i + 1]];
      _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  };
  for (const f of facesPlus) emitPentagon(plus, f);
  for (const f of facesMinus) emitPentagon([...plus, ...minus], f);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Marcasite spearhead twin — the {101} contact twin produces a single
// elongated rhombic bipyramid. Mirrors PRIM_MARCASITE_SPEARHEAD_TWIN
// in 99c. Distinct from cube/octahedron/dipyramid: stretched along c
// AND rhombic in cross-section (a ≠ b) to reflect marcasite's
// orthorhombic symmetry. Dana 8th ed. + Mindat marcasite habit.
// v133 sets spearhead probability to 0.05 (path-1: rolls before
// cockscomb's 0.55).
//
// 6 vertices, 8 flat-shaded triangular faces — same topology as a
// regular octahedron but with a > b equatorial radii (rhombic cross-
// section). 8 triangles × 3 verts = 24 vertex triples.
function _makeMarcasiteSpearheadTwin(): any {
  const a = 0.18;    // broad equatorial half-extent (a-axis)
  const b = 0.10;    // narrow equatorial half-extent (b-axis) — rhombic
  const L = 0.5;     // c-axis half-length (centered at origin)
  // 6 vertices: 2 apexes + 4 equator (rhombic).
  const v: number[][] = [
    [0,  L, 0],   // 0 top apex (+y)
    [0, -L, 0],   // 1 bottom apex (-y)
    [a, 0, 0],    // 2 +x (a-axis east)
    [-a, 0, 0],   // 3 -x (a-axis west)
    [0, 0, b],    // 4 +z (b-axis north)
    [0, 0, -b],   // 5 -z (b-axis south)
  ];
  // 8 triangular faces — same octant pattern as a regular octahedron.
  // CCW winding from outside (sx·sy·sz parity rule).
  const faces: number[][] = [
    [2, 0, 4],   // (+x, +y, +z) — top-east-north
    [2, 5, 0],   // (+x, +y, -z) — top-east-south
    [2, 4, 1],   // (+x, -y, +z) — bot-east-north
    [2, 1, 5],   // (+x, -y, -z) — bot-east-south
    [3, 4, 0],   // (-x, +y, +z) — top-west-north
    [3, 0, 5],   // (-x, +y, -z) — top-west-south
    [3, 1, 4],   // (-x, -y, +z) — bot-west-north
    [3, 5, 1],   // (-x, -y, -z) — bot-west-south
  ];
  const positions: number[] = [];
  for (const f of faces) {
    const A = v[f[0]], B = v[f[1]], C = v[f[2]];
    _pushTri(positions, A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Aragonite contact twin — the single-contact {110} variant (vs
// aragonite's 3-fold cyclic-sextet). Two prismatic orthorhombic
// crystals joined at base, opening in a 60° V. Mirrors
// PRIM_ARAGONITE_CONTACT_TWIN in 99c. Dana 8th ed. CaCO3 section,
// Speer 1983 Reviews in Mineralogy v.11.
//
// Visual distinction from the other V-twin builders:
//   _makeSeleniteSwallowtailTwin: tabular blades (a=0.05, b=0.15)
//   _makeMarcasiteCockscombTwin:  needle blades (a=0.025, b=0.08)
//   _makeAragoniteContactTwin:    prismatic blades (a=0.06, b=0.06 — square)
//
// 24 triangles, 72 vertex triples (matches selenite + marcasite V-pair
// counts — same box-pair flat-shaded emission pattern).
function _makeAragoniteContactTwin(): any {
  const a = 0.06;             // half-thickness (square cross-section)
  const L = 0.95;             // blade length along c-axis
  const b = 0.06;             // half-width along contact (square)
  const theta = Math.PI / 6;  // 30° tilt per blade — 60° total V
  const cT = Math.cos(theta);
  const sT = Math.sin(theta);
  const buildBladeA = (): number[][] => {
    const out: number[][] = [];
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          out.push([xl * cT - yl * sT, xl * sT + yl * cT, zl]);
        }
      }
    }
    return out;
  };
  const buildBladeB = (): number[][] => {
    const out: number[][] = [];
    for (const xl of [0, 2 * a]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          out.push([xl * cT + yl * sT, -xl * sT + yl * cT, zl]);
        }
      }
    }
    return out;
  };
  const A = buildBladeA();
  const B = buildBladeB();
  const pushBlade = (out: number[], v: number[][]): void => {
    const tri = (i: number, j: number, k: number) => {
      _pushTri(out, v[i][0], v[i][1], v[i][2], v[j][0], v[j][1], v[j][2], v[k][0], v[k][1], v[k][2]);
    };
    tri(0, 1, 3); tri(0, 3, 2);  // xl = -2a face
    tri(4, 6, 7); tri(4, 7, 5);  // xl = 0 face (contact)
    tri(0, 4, 5); tri(0, 5, 1);  // yl = 0 face (base)
    tri(2, 3, 7); tri(2, 7, 6);  // yl = L face (top)
    tri(0, 2, 6); tri(0, 6, 4);  // zl = -b face
    tri(1, 5, 7); tri(1, 7, 3);  // zl = +b face
  };
  const positions: number[] = [];
  pushBlade(positions, A);
  pushBlade(positions, B);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Build a unit-sized geometry for a given habit token, oriented so
// its long axis (= c-axis) lies along +Y. The instance transform
// later places the base at the wall and scales by c_length / a_width.
// ----- Calcite-morphology arc Phase 3 (2026-06-11): VISIBLE TERRACES -----
//
// The boss's ask: WATCH stepped calcite grow. The geometry is built from
// the crystal's own zone stack (calciteTerraceBands in js/52 reads the
// per-zone regime tags): every macrostep band becomes a ledge, so the
// crystal's recorded σ history is literally its silhouette — the steps
// are the chemistry curve made solid. Because the band walk truncates at
// the replay step, terraces ACCUMULATE live as the crystal grows and as
// the replay scrubber advances.
//
// Construction: hex cross-section ziggurat under the parent form's
// envelope. Lower half (in the druse/wall) stays smooth; the upper
// (tip-ward) half maps cumulative growth fraction → height, and each
// band quantizes the envelope profile into ledges — fine shallow steps
// for stepped_mild, bold deep steps for stepped_macro, one massive step
// for mid-stack hopper bands. A crystal whose LAST band is hopper gets
// its apex hollowed into a funnel (the hollow-but-faceted instability
// onset — Sunagawa order, 17th catch) instead of a solid tip.

// Envelope profile of the parent form at height y (unit form, y ∈ [-0.5, 0.5]).
function _calciteEnvelopeR(form: string, y: number): number {
  const ay = Math.abs(y);
  if (ay >= 0.5) return 0;
  if (form === 'rhomb') {
    // rhombohedron-like: full width through the mid-belt, linear taper to apex
    return ay <= 0.18 ? 0.42 : 0.42 * (0.5 - ay) / (0.5 - 0.18);
  }
  // scalenohedron-like: waist at the equator, long linear taper (dogtooth)
  return 0.30 * (0.5 - ay) / 0.5;
}

function _makeTerracedCalciteGeom(terr: any): any {
  const form = terr.form === 'rhomb' ? 'rhomb' : 'scalene';
  const R = (y: number) => _calciteEnvelopeR(form, y);
  const SEG = 6;
  const positions: number[] = [];
  const mkRing = (y: number, r: number) => {
    const out: number[][] = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2 + Math.PI / 6;
      out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return out;
  };
  const band = (r0: number[][], r1: number[][]) => {
    for (let i = 0; i < SEG; i++) {
      const a = r0[i], b = r0[(i + 1) % SEG], c = r1[(i + 1) % SEG], d = r1[i];
      _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      _pushTri(positions, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
  };

  // Lower half — smooth (it sits in the wall / druse carpet).
  const yWaist = form === 'rhomb' ? -0.18 : 0.0;
  let prev = mkRing(yWaist, R(yWaist));
  for (let i = 0; i < SEG; i++) {
    const a = prev[i], b = prev[(i + 1) % SEG];
    _pushTri(positions, 0, -0.5, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
  }
  if (form === 'rhomb') {
    const r0 = mkRing(0, R(0));
    band(prev, r0);
    prev = r0;
  }

  // Upper half — the terraced stack. Cumulative growth fraction maps to
  // height: early bands sit low (the old, wide plates), late bands climb
  // toward the tip — the pagoda read.
  const yStart = 0;
  const yTipBase = terr.hopperTip ? 0.44 : 0.40;
  let yA = yStart;
  let fracA = 0;
  for (const k of terr.knots) {
    const yB = yStart + k.frac * (yTipBase - yStart);
    const span = yB - yA;
    if (span <= 1e-4) { fracA = k.frac; continue; }
    if (k.regime === 'stepped_macro' || k.regime === 'hopper_skeletal' || k.regime === 'stepped_mild') {
      const mild = k.regime === 'stepped_mild';
      // A macrostep band is a TRAIN of bunched steps, not one cliff —
      // ledge pitch sized so a typical band reads as 2-4 terraces
      // (pagoda stack), mild bands as finer shallower treads.
      const stepH = k.regime === 'hopper_skeletal' ? span : (mild ? 0.022 : 0.04);
      const n = Math.max(1, Math.min(10, Math.round(span / stepH)));
      for (let s = 0; s < n; s++) {
        const ya = yA + (s / n) * span;
        const yb = yA + ((s + 1) / n) * span;
        // Tread radius: macro/hopper hold the OLD radius the whole riser
        // (bold ledge); mild splits the difference (gentle ledge).
        const rTread = mild ? (R(ya) + R(yb)) / 2 : R(ya);
        const riser0 = mkRing(ya, rTread);
        const riser1 = mkRing(yb, rTread);
        band(prev, riser0);          // step up onto the tread (ledge in/out)
        band(riser0, riser1);        // vertical riser
        prev = riser1;
      }
      const closeRing = mkRing(yB, R(yB));
      band(prev, closeRing);         // ledge in to the envelope
      prev = closeRing;
    } else {
      // smooth band — follow the envelope in two segments
      const mid = mkRing((yA + yB) / 2, R((yA + yB) / 2));
      const end = mkRing(yB, R(yB));
      band(prev, mid);
      band(mid, end);
      prev = end;
    }
    yA = yB;
    fracA = k.frac;
  }

  // The tip: solid apex, or a hopper funnel (apex pulled INSIDE — the
  // hollow face read; DoubleSide material lights the bowl interior).
  if (terr.hopperTip) {
    const rim = mkRing(yTipBase + 0.03, R(yTipBase) * 0.92);
    band(prev, rim);
    const sink = yTipBase - 0.14;
    for (let i = 0; i < SEG; i++) {
      const a = rim[i], b = rim[(i + 1) % SEG];
      _pushTri(positions, 0, sink, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  } else {
    for (let i = 0; i < SEG; i++) {
      const a = prev[i], b = prev[(i + 1) % SEG];
      _pushTri(positions, 0, 0.5, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// DIRECTIONAL calcite {104} stepping — central-distance arc Phase 1 (2026-06-22;
// proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md). Identical band-walk to
// _makeTerracedCalciteGeom, but the macrostep relief is carved onto ONE face-SET
// (terr.steppedSet) while the opposite set follows the smooth envelope — so the
// crystal reads stepped on one side, smooth on the other, instead of the
// azimuthally-uniform ziggurat.
//
// THE SCIENCE (corrected 2026-06-23 vs. the literature — specimen-debt verification pass).
// The VISIBLE one-sidedness — one set of faces step-bunched into macro ledges, the
// opposite set glassy — is TRANSPORT-driven, NOT an intrinsic property of the faces: the
// six {104} faces are symmetry-equivalent, but under diffusion-limited growth their feed
// is not (Berg 1938, Proc.R.Soc.A 164:79; Wang/Gilbert et al. 2022 Science 376:abm1748
// found symmetry-related {104} facets break symmetry "solely controlled by the diffusion
// of ions"). Better-fed / up-gradient faces step-bunch; sheltered or substrate-shadowed
// faces stay smooth. The famous calcite (104) ACUTE(~78°)/OBTUSE(~102°) step anisotropy
// (Teng & Dove 1998 Science 282:724, 2000 GCA 64:2255; De Yoreo & Vekilov 2003 RiMG 54:57)
// is a DIFFERENT, finer-scale effect — it distinguishes the two step DIRECTIONS within a
// SINGLE {104} face at the AFM/vicinal scale and surfaces as intrasectoral trace-element
// zoning; it does NOT by itself make one whole face step while the opposite stays smooth.
// Calcite is CENTROSYMMETRIC (R-3c), so none of this is polarity.
//
// CAVEAT (honest, render-only). terr.steppedSet is a face-SET selector, not a world
// direction — the renderer applies a random per-crystal yaw (_crystalYaw), so which
// physical side carries the relief is arbitrary: directional-LOOKING without the
// directional CAUSE. Acceptable for the {104} aesthetic read; the reactive-morphology
// arc (proposal Phase 4: void-normal → flow/gravity → diffusion field) is the fix.
function _makeDirectionalTerracedCalciteGeom(terr: any): any {
  const form = terr.form === 'rhomb' ? 'rhomb' : 'scalene';
  const R = (y: number) => _calciteEnvelopeR(form, y);
  const SEG = 6;
  const set: number[] = terr.steppedSet && terr.steppedSet.length ? terr.steppedSet : [0, 1, 2];
  const stepped: boolean[] = [];
  for (let i = 0; i < SEG; i++) stepped.push(set.indexOf(i) >= 0);
  const positions: number[] = [];
  // Per-segment radius: stepped segments take rStep (the bold held ledge), smooth
  // segments take rSmooth (the envelope at the true height → no riser). The transition
  // segment between the two sets carries the gradient boundary as a diagonal face.
  const mkRingDir = (y: number, rStep: number, rSmooth: number) => {
    const out: number[][] = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2 + Math.PI / 6;
      const r = stepped[i] ? rStep : rSmooth;
      out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return out;
  };
  const mkRing = (y: number, r: number) => mkRingDir(y, r, r);   // uniform fallback
  const band = (r0: number[][], r1: number[][]) => {
    for (let i = 0; i < SEG; i++) {
      const a = r0[i], b = r0[(i + 1) % SEG], c = r1[(i + 1) % SEG], d = r1[i];
      _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      _pushTri(positions, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
  };

  // Lower half — smooth both sides (sits in the wall / druse carpet).
  const yWaist = form === 'rhomb' ? -0.18 : 0.0;
  let prev = mkRing(yWaist, R(yWaist));
  for (let i = 0; i < SEG; i++) {
    const a = prev[i], b = prev[(i + 1) % SEG];
    _pushTri(positions, 0, -0.5, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
  }
  if (form === 'rhomb') {
    const r0 = mkRing(0, R(0));
    band(prev, r0);
    prev = r0;
  }

  // Upper half — the terraced stack, carved directionally.
  const yStart = 0;
  const yTipBase = terr.hopperTip ? 0.44 : 0.40;
  let yA = yStart;
  for (const k of terr.knots) {
    const yB = yStart + k.frac * (yTipBase - yStart);
    const span = yB - yA;
    if (span <= 1e-4) continue;
    if (k.regime === 'stepped_macro' || k.regime === 'hopper_skeletal' || k.regime === 'stepped_mild') {
      const mild = k.regime === 'stepped_mild';
      const stepH = k.regime === 'hopper_skeletal' ? span : (mild ? 0.022 : 0.04);
      const n = Math.max(1, Math.min(10, Math.round(span / stepH)));
      for (let s = 0; s < n; s++) {
        const ya = yA + (s / n) * span;
        const yb = yA + ((s + 1) / n) * span;
        const rTread = mild ? (R(ya) + R(yb)) / 2 : R(ya);
        // stepped set holds rTread across the riser (the bold ledge); smooth set
        // follows R(y) so it has no riser — the one-sided carve.
        const riser0 = mkRingDir(ya, rTread, R(ya));
        const riser1 = mkRingDir(yb, rTread, R(yb));
        band(prev, riser0);          // ledge in/out (flat on the smooth set)
        band(riser0, riser1);        // vertical riser (stepped set only)
        prev = riser1;
      }
      const closeRing = mkRing(yB, R(yB));
      band(prev, closeRing);
      prev = closeRing;
    } else {
      const mid = mkRing((yA + yB) / 2, R((yA + yB) / 2));
      const end = mkRing(yB, R(yB));
      band(prev, mid);
      band(mid, end);
      prev = end;
    }
    yA = yB;
  }

  // Tip — solid apex or hopper funnel (uniform; the directional carve is a face-set
  // sidewall feature, not a tip one).
  if (terr.hopperTip) {
    const rim = mkRing(yTipBase + 0.03, R(yTipBase) * 0.92);
    band(prev, rim);
    const sink = yTipBase - 0.14;
    for (let i = 0; i < SEG; i++) {
      const a = rim[i], b = rim[(i + 1) % SEG];
      _pushTri(positions, 0, sink, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  } else {
    for (let i = 0; i < SEG; i++) {
      const a = prev[i], b = prev[(i + 1) % SEG];
      _pushTri(positions, 0, 0.5, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Halide render wave (2026-06-12): square-section variant for the cube
// regime family (halite/sylvite — and any future cubic tenant, fluorite
// is next on the list). Same band-walk input (halideTerraceBands /
// morphTerraceKnots in js/45), different silhouette grammar:
//
// A cube's envelope is CONSTANT, so calcite's taper-quantizing ledges
// have nothing to quantize. Instead the bands carve INTO the prism:
//   stepped_mild  → fine inset grooves (the chevron fluid-inclusion
//                   banding read — Lowenstein & Hardie's tree rings)
//   stepped_macro → deeper, coarser setbacks
//   hopper bands  → deepest inset (cavernous face episode)
//   smooth bands  → full-width prism
// A crystal whose LAST band is hopper gets the canonical halite read:
// the top face sunk into a stepped funnel (rim → sunken apex), instead
// of a flat cap. DoubleSide material lights the bowl, as with calcite.
function _makeTerracedCubeGeom(terr: any): any {
  const SEG = 4;
  const R0 = 0.42;                       // unit half-extent (corner radius)
  const INSET: Record<string, number> = {
    spiral_smooth: 0, stepped_mild: 0.035, stepped_macro: 0.07, hopper_skeletal: 0.11, dendritic: 0.11,
  };
  const positions: number[] = [];
  const mkRing = (y: number, r: number) => {
    const out: number[][] = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2 + Math.PI / 4;  // axis-aligned square faces
      out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return out;
  };
  const band = (r0: number[][], r1: number[][]) => {
    for (let i = 0; i < SEG; i++) {
      const a = r0[i], b = r0[(i + 1) % SEG], c = r1[(i + 1) % SEG], d = r1[i];
      _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      _pushTri(positions, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
  };

  // Base: square bottom cap at y=-0.5, smooth lower half (in the druse).
  const yStart = 0;
  const base = mkRing(-0.5, R0);
  for (let i = 0; i < SEG; i++) {
    const a = base[i], b = base[(i + 1) % SEG];
    _pushTri(positions, 0, -0.5, 0, b[0], b[1], b[2], a[0], a[1], a[2]);
  }
  let prev = mkRing(yStart, R0);
  band(base, prev);

  // Upper half — banded prism. Cumulative growth fraction → height; each
  // band's groove pitch matches the calcite tread grammar (mild = fine
  // treads 0.022, macro = bold 0.04, hopper = one episode-deep inset).
  const yTipBase = terr.hopperTip ? 0.46 : 0.5;
  let yA = yStart;
  for (const k of terr.knots) {
    const yB = yStart + k.frac * (yTipBase - yStart);
    const span = yB - yA;
    if (span <= 1e-4) continue;
    const inset = INSET[k.regime] || 0;
    if (inset > 0) {
      const stepH = k.regime === 'hopper_skeletal' ? span : (k.regime === 'stepped_mild' ? 0.022 : 0.04);
      const n = Math.max(1, Math.min(10, Math.round(span / stepH)));
      const rIn = R0 - inset;
      for (let s = 0; s < n; s++) {
        const ya = yA + (s / n) * span;
        const yb = yA + ((s + 1) / n) * span;
        // groove: step in, run the recessed riser, step back out
        const in0 = mkRing(ya, rIn);
        const in1 = mkRing(yb, rIn);
        band(prev, in0);
        band(in0, in1);
        const out1 = mkRing(yb, R0);
        band(in1, out1);
        prev = out1;
      }
    } else {
      // smooth band — full-width prism segment
      const end = mkRing(yB, R0);
      band(prev, end);
      prev = end;
    }
    yA = yB;
  }

  // The top face: flat square cap, or the hopper funnel (rim ledge, then
  // the apex sunk INTO the cube — the canonical skeletal-halite read).
  if (terr.hopperTip) {
    const rim = mkRing(yTipBase, R0);
    band(prev, rim);
    const inner = mkRing(yTipBase, R0 * 0.78);
    band(rim, inner);
    const sink = yTipBase - 0.30;
    for (let i = 0; i < SEG; i++) {
      const a = inner[i], b = inner[(i + 1) % SEG];
      _pushTri(positions, 0, sink, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  } else {
    const top = mkRing(0.5, R0);
    band(prev, top);
    for (let i = 0; i < SEG; i++) {
      const a = top[i], b = top[(i + 1) % SEG];
      _pushTri(positions, 0, 0.5, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Dendrite TREE geometry (morphology fix-backlog, 2026-06-12): the
// dendritic/arborescent habits had been riding the acicular-spike
// fallback — a single thin pyramid, which reads as a needle, not a
// tree. This builds a true branching skeleton in unit space:
//
//   * trunk along +Y (the c-axis/substrate-normal contract every other
//     habit primitive follows), y ∈ [-0.5, 0.5]
//   * primary branches at nodes up the trunk, azimuth QUANTIZED to 90°
//     steps with small jitter — native-metal dendrites branch
//     crystallographically along {100} (the Bisbee/Cornish copper
//     fishbone), not at random angles like a biological tree
//   * lower branches longer (the depletion-field taper — the oldest
//     branches have eaten the most halo), secondaries on the longer
//     primaries with the same quantized grammar
//
// Deterministic per crystal: seeded from crystal_id via _clusterRand
// (the _crystalYaw idiom) — NO Math.random, replay-stable, satellites
// inherit the parent's tree. The shape is STATIC per crystal; the
// watch-it-grow read comes free from envelope scaling (replay scales
// the mesh by the historical dimensions, so the tree grows out of the
// wall without per-step geometry churn). Each branch is a 4-sided
// tapered prism (~10 tris); a full tree lands around 200 tris —
// cheaper than the hex ziggurat.
function _makeDendriteTreeGeom(crystalId: number): any {
  const rand = _clusterRand(((crystalId | 0) * 0x9E3779B1 + 0xD3AD) | 0);
  const positions: number[] = [];

  // Tapered square-section segment from p along unit dir, with a
  // pyramidal tip cap. Basis vectors are built around dir so branches
  // work at any angle.
  const segment = (p: number[], dir: number[], len: number, r0: number, r1: number) => {
    let ux = dir[2], uy = 0, uz = -dir[0];           // dir × ŷ (lateral)
    const ul = Math.sqrt(ux * ux + uz * uz);
    if (ul < 1e-6) { ux = 1; uy = 0; uz = 0; } else { ux /= ul; uz /= ul; }
    // v = dir × u
    const vx = dir[1] * uz - dir[2] * uy;
    const vy = dir[2] * ux - dir[0] * uz;
    const vz = dir[0] * uy - dir[1] * ux;
    const ring = (t: number, r: number): number[][] => {
      const cx = p[0] + dir[0] * len * t, cy = p[1] + dir[1] * len * t, cz = p[2] + dir[2] * len * t;
      const out: number[][] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i + 0.5) / 4 * Math.PI * 2;
        const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        out.push([cx + ux * ca + vx * sa, cy + uy * ca + vy * sa, cz + uz * ca + vz * sa]);
      }
      return out;
    };
    const b0 = ring(0, r0), b1 = ring(1, Math.max(r1, 0.002));
    for (let i = 0; i < 4; i++) {
      const a = b0[i], b = b0[(i + 1) % 4], c = b1[(i + 1) % 4], d = b1[i];
      _pushTri(positions, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      _pushTri(positions, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    }
    // tip cap (small pyramid to the segment end point + a bit beyond)
    const tip = [p[0] + dir[0] * len * 1.04, p[1] + dir[1] * len * 1.04, p[2] + dir[2] * len * 1.04];
    for (let i = 0; i < 4; i++) {
      const a = b1[i], b = b1[(i + 1) % 4];
      _pushTri(positions, tip[0], tip[1], tip[2], a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  };

  // Trunk: base slightly below anchor plane so it roots in the druse.
  segment([0, -0.5, 0], [0, 1, 0], 1.0, 0.05, 0.012);

  // Primary branches. Node fractions run up the trunk; azimuth steps
  // around the four {100} quadrants with jitter; elevation ~55° off
  // the trunk. Length tapers toward the tip (lower = older = longer).
  const nPrim = 6 + Math.floor(rand() * 3);
  let quadrant = Math.floor(rand() * 4);
  for (let i = 0; i < nPrim; i++) {
    const frac = 0.18 + (i / nPrim) * 0.74 + (rand() - 0.5) * 0.04;  // 0..1 up the trunk
    const y = -0.5 + frac;
    quadrant = (quadrant + 1 + (rand() < 0.25 ? 1 : 0)) % 4;
    const az = quadrant * (Math.PI / 2) + (rand() - 0.5) * 0.5;
    const elev = 0.96 + (rand() - 0.5) * 0.25;                        // ~55° from trunk
    const dir = [Math.cos(az) * Math.sin(elev), Math.cos(elev), Math.sin(az) * Math.sin(elev)];
    const len = 0.42 * (1 - frac * 0.72) * (0.85 + rand() * 0.3);
    if (len < 0.05) continue;
    const r0 = 0.026 * (1 - frac * 0.4);
    segment([0, y, 0], dir, len, r0, 0.006);
    // Secondaries on the longer primaries — same grammar one level down,
    // forking ±90° in azimuth from the parent (the fishbone rib read).
    if (len > 0.16) {
      for (const t of [0.45, 0.75]) {
        const p2 = [dir[0] * len * t, y + dir[1] * len * t, dir[2] * len * t];
        const az2 = az + (rand() < 0.5 ? 1 : -1) * (Math.PI / 2) + (rand() - 0.5) * 0.4;
        const elev2 = elev - 0.25 + (rand() - 0.5) * 0.2;
        const dir2 = [Math.cos(az2) * Math.sin(elev2), Math.cos(elev2), Math.sin(az2) * Math.sin(elev2)];
        const len2 = len * (0.45 - 0.15 * t) * (0.8 + rand() * 0.4);
        if (len2 < 0.04) continue;
        segment(p2, dir2, len2, r0 * 0.5, 0.004);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Habit-string gate for the tree path. Token-level 'spike' serves
// acicular/fibrous/plumose too — those stay needles; only the
// dendritic/arborescent family gets branches.
function _isDendriticHabit(habit: string): boolean {
  const h = String(habit || '').toLowerCase();
  return h === 'dendritic' || h.startsWith('dendritic_') || h.includes('arborescent');
}

// Per-crystal tree cache (static shape — no sig churn; the entry lives
// as long as the crystal renders, same lifecycle as the terrace cache).
function _getDendriteTreeGeom(state: any, crystal: any): any {
  if (!state._treeGeoms) state._treeGeoms = new Map();
  const hit = state._treeGeoms.get(crystal.crystal_id);
  if (hit) return hit;
  const geom = _makeDendriteTreeGeom(crystal.crystal_id | 0);
  state._treeGeoms.set(crystal.crystal_id, geom);
  return geom;
}

// Per-crystal terrace-geometry cache. Keyed by crystal_id; the signature
// (form + knot list + hopper tip) busts the entry the moment a new band
// forms or the replay scrubber crosses a band boundary — old geometry is
// disposed, not leaked. Bounded by live tagged-crystal count. Dispatches
// the builder on the form token ('cube' → square ziggurat; otherwise the
// calcite hex builder).
function _getTerracedCalciteGeom(state: any, crystal: any, terr: any): any {
  if (!state._terraceGeoms) state._terraceGeoms = new Map();
  // Sig uses the regime ORDINAL, not regime[0] — three regimes share the
  // letter 's' (spiral_smooth / stepped_mild / stepped_macro), so the
  // first-letter sig could fail to bust the cache when a band changes
  // regime at an unchanged fraction (found during the halide render
  // verification, 2026-06-12; latent since the calcite arc).
  const sig = `${terr.form}:${terr.hopperTip ? 'H' : 's'}:`
    + terr.knots.map((k: any) => `${MORPH_REGIMES.indexOf(k.regime)}${k.frac.toFixed(3)}`).join('|')
    // Directional-stepping discriminator (central-distance arc Phase 0, 2026-06-22):
    // appends NOTHING when _faceStep is absent → existing sigs byte-identical; busts
    // the cache only once a crystal carries a directional face-set tag (Phase 1 carve).
    + (crystal._faceStep ? `:FS${crystal._faceStep.steppedFaceSet}` : '');
  const hit = state._terraceGeoms.get(crystal.crystal_id);
  if (hit && hit.sig === sig) return hit.geom;
  if (hit && hit.geom && hit.geom.dispose) hit.geom.dispose();
  const geom = terr.form === 'cube' ? _makeTerracedCubeGeom(terr)
    : (terr.steppedSet ? _makeDirectionalTerracedCalciteGeom(terr) : _makeTerracedCalciteGeom(terr));
  state._terraceGeoms.set(crystal.crystal_id, { sig, geom });
  return geom;
}

// CRYSTAL_SYSTEM — citation-backed crystal systems (from data/structural.json `system`, NON-
// hexagonal only; regenerate with `node tools/morph-fidelity-audit.mjs --systemmap`). Drives the
// system-aware prism cross-section. The default 'prism' primitive is a HEXAGONAL prism
// (_makeHexPrismWithPyramid) — faithful ONLY for hexagonal/trigonal minerals; a tetragonal
// mineral must read SQUARE, orthorhombic RECTANGULAR, monoclinic/triclinic SHEARED. Specimen-debt
// fidelity arc 2026-06-23 (the audit found 72 non-hex minerals rendered hexagonal — tourmaline &
// hemimorphite were the first two caught + fixed). Only minerals that resolve to the 'prism' token
// are redirected (below); entries that render via other tokens (tablet/botryoidal/rhomb/spike/
// special) are inert. Render-only / byte-identical — gen-baseline serialises only counts/sizes.
const CRYSTAL_SYSTEM: Record<string, string> = {
  acanthite: 'monoclinic', actinolite: 'monoclinic', adamite: 'orthorhombic', albite: 'triclinic',
  andalusite: 'orthorhombic', anglesite: 'orthorhombic', anhydrite: 'orthorhombic', annabergite: 'monoclinic',
  antlerite: 'orthorhombic', apophyllite: 'tetragonal', aragonite: 'orthorhombic', arsenopyrite: 'monoclinic',
  atacamite: 'orthorhombic', aurichalcite: 'monoclinic', austinite: 'orthorhombic', autunite: 'tetragonal',
  azurite: 'monoclinic', barite: 'orthorhombic', bismuthinite: 'orthorhombic', borax: 'monoclinic',
  brochantite: 'monoclinic', calaverite: 'monoclinic', caledonite: 'orthorhombic', carnotite: 'monoclinic',
  cassiterite: 'tetragonal', celestine: 'orthorhombic', cerussite: 'orthorhombic', chalcanthite: 'triclinic',
  chalcocite: 'monoclinic', chalcopyrite: 'tetragonal', clinobisvanite: 'monoclinic', conichalcite: 'orthorhombic',
  datolite: 'monoclinic', descloizite: 'orthorhombic', diopside: 'monoclinic', enargite: 'orthorhombic',
  epidote: 'monoclinic', erythrite: 'monoclinic', feldspar: 'monoclinic', ferrimolybdite: 'orthorhombic',
  gypsum: 'monoclinic', haidingerite: 'orthorhombic', hemimorphite: 'orthorhombic', hessite: 'monoclinic',
  heulandite: 'monoclinic', koettigite: 'monoclinic', leadhillite: 'monoclinic', legrandite: 'monoclinic',
  lepidocrocite: 'orthorhombic', lepidolite: 'monoclinic', linarite: 'monoclinic', loellingite: 'orthorhombic',
  malachite: 'monoclinic', marcasite: 'orthorhombic', mesolite: 'orthorhombic', mirabilite: 'monoclinic',
  mottramite: 'orthorhombic', native_sulfur: 'orthorhombic', naumannite: 'orthorhombic', olivenite: 'monoclinic',
  orpiment: 'monoclinic', orthoclase: 'monoclinic', pectolite: 'triclinic', pharmacolite: 'monoclinic',
  powellite: 'tetragonal', prehnite: 'orthorhombic', pyrolusite: 'tetragonal', rammelsbergite: 'orthorhombic',
  raspite: 'monoclinic', realgar: 'monoclinic', rosasite: 'monoclinic', rutile: 'tetragonal',
  safflorite: 'orthorhombic', scheelite: 'tetragonal', scolecite: 'monoclinic', scorodite: 'orthorhombic',
  selenite: 'monoclinic', shattuckite: 'orthorhombic', spodumene: 'monoclinic', staurolite: 'monoclinic',
  stibnite: 'orthorhombic', stilbite: 'monoclinic', stolzite: 'tetragonal', strontianite: 'orthorhombic',
  sylvanite: 'monoclinic', thenardite: 'orthorhombic', thomsonite: 'orthorhombic', titanite: 'monoclinic',
  topaz: 'orthorhombic', torbernite: 'tetragonal', tremolite: 'monoclinic', uranophane: 'monoclinic',
  uranospinite: 'tetragonal', vesuvianite: 'tetragonal', witherite: 'orthorhombic', wolframite: 'monoclinic',
  wollastonite: 'triclinic', wulfenite: 'tetragonal', zeunerite: 'tetragonal',
};

// SYSTEM-AWARE prism+pyramid — a 4-faced cross-section matching the crystal system: SQUARE
// (tetragonal), RECTANGULAR (orthorhombic), or rectangular with an oblique/leaning character
// (monoclinic = beta-inclined termination; triclinic = leaning column + skewed apex). Replaces the
// hexagonal prism for non-hex minerals. Deterministic; cached per system. Hex/trigonal minerals
// never reach here (not in CRYSTAL_SYSTEM) so they keep _makeHexPrismWithPyramid -> byte-identical.
// REGULAR TETRAHEDRON — the {111} form of the hemihedral cubic minerals (sphalerite Td,
// chalcopyrite's pseudo-tetrahedral disphenoid). Face-attached: the base triangle lies in
// y = −0.5 (the wall), the apex is at y = +0.5, so the isometric uniform scale by c_length
// gives a crystal c tall and 1.22·c on edge (true regular-tetrahedron proportions). Flat
// faces via non-indexed triangles (computeVertexNormals yields per-face normals). Reviewer
// 2026-09-04: sphalerite had rendered as a hexagonal prism since the token default.
function _makeTetrahedron(): any {
  const apex = [0, 0.5, 0];
  const rb = Math.sqrt(2) / 2;           // base circumradius for height 1 (edge = √1.5)
  const b = [0, 1, 2].map(i => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return [Math.cos(a) * rb, -0.5, Math.sin(a) * rb];
  });
  const positions: number[] = [];
  const push = (p: number[], q: number[], r: number[]) =>
    _pushTri(positions, p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
  push(apex, b[1], b[0]);
  push(apex, b[2], b[1]);
  push(apex, b[0], b[2]);
  push(b[0], b[1], b[2]);                // base, outward (−y) winding
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function _makeSystemPrism(system: string): any {
  const yBase = -0.5, yShoulder = 0.2, yApex = 0.5;
  let rx = 0.40, rz = 0.40;     // tetragonal default = square section
  let apexX = 0, apexZ = 0;     // oblique termination (monoclinic / triclinic)
  let shearX = 0, shearZ = 0;   // leaning column (triclinic)
  if (system === 'orthorhombic') { rx = 0.48; rz = 0.30; }
  else if (system === 'monoclinic') { rx = 0.46; rz = 0.32; apexX = 0.24; }
  else if (system === 'triclinic') { rx = 0.46; rz = 0.32; apexX = 0.22; apexZ = 0.14; shearX = 0.10; }
  // 4-corner rectangular cross-section (flat faces toward +-x and +-z); shear leans upper rings.
  const ring = (y: number, s: number) => {
    const dx = shearX * s, dz = shearZ * s;
    return [[rx + dx, y, rz + dz], [-rx + dx, y, rz + dz], [-rx + dx, y, -rz + dz], [rx + dx, y, -rz + dz]];
  };
  const positions: number[] = [];
  const B = ring(yBase, 0);
  const S = ring(yShoulder, (yShoulder - yBase) / (yApex - yBase));
  const apex = [apexX + shearX, yApex, apexZ + shearZ];
  for (let i = 0; i < 4; i++) {     // prism walls
    const j = (i + 1) % 4;
    _pushTri(positions, B[i][0], B[i][1], B[i][2], B[j][0], B[j][1], B[j][2], S[j][0], S[j][1], S[j][2]);
    _pushTri(positions, B[i][0], B[i][1], B[i][2], S[j][0], S[j][1], S[j][2], S[i][0], S[i][1], S[i][2]);
  }
  for (let i = 0; i < 4; i++) {     // pyramid to the (possibly offset) apex
    const j = (i + 1) % 4;
    _pushTri(positions, S[i][0], S[i][1], S[i][2], S[j][0], S[j][1], S[j][2], apex[0], apex[1], apex[2]);
  }
  _pushTri(positions, B[0][0], B[0][1], B[0][2], B[2][0], B[2][1], B[2][2], B[1][0], B[1][1], B[1][2]); // base cap
  _pushTri(positions, B[0][0], B[0][1], B[0][2], B[3][0], B[3][1], B[3][2], B[2][0], B[2][1], B[2][2]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function _buildHabitGeom(token: string): any {
  switch (token) {
    case 'spike':
      // Acicular — narrow hexagonal pyramid. Phase E5 batch 2:
      // replaces ConeGeometry's smooth-shaded cone.
      return _makeHexPyramid();
    case 'prism':
      // Prismatic — hexagonal prism with pyramidal termination.
      // Phase E5 batch 1: replaces the flat-topped CylinderGeometry.
      return _makeHexPrismWithPyramid();
    case 'tablet':
      // Tabular — flat plate with chamfered edges. Phase E5 batch 2
      // replaces the rectangular BoxGeometry.
      return _makeBeveledTablet();
    case 'rhomb':
      // Rhombohedral — Iceland-spar-style stretched cube with 6
      // rhombic faces. Phase E5 batch 1.
      return _makeRhombohedron();
    case 'scalene':
      // Scalenohedral — calcite "dogtooth", 12 scalene-triangle faces
      // with sharp pointed apices. Phase E5 batch 2: was previously
      // mapped to the rhombohedron token (geologically wrong).
      return _makeScalenohedron();
    case 'cube':
      return new THREE.BoxGeometry(0.8, 0.8, 0.8);
    case 'fluorite_penetration_twin':
      // v134 (2026-05-22) — first iconic twin to render its own
      // geometry. Two interpenetrating cubes rotated 60° around the
      // body diagonal. Dispatch is gated by _resolveCrystalGeomToken
      // on mineral='fluorite' + twinned=true + twin_law='penetration'.
      return _makeFluoritePenetrationTwin();
    case 'selenite_swallowtail_twin':
      // v134 (2026-05-22) — second iconic twin. Two tabular gypsum
      // blades joined on {100} at the base, opening upward in a V
      // (60° total). Dispatch gated on mineral='selenite' + twinned
      // + twin_law='swallowtail'.
      return _makeSeleniteSwallowtailTwin();
    case 'galena_octahedron_twin':
      // v134 (2026-05-22) — third iconic twin. Two octahedra sharing
      // a {111} triangular face — Ramdohr 1980 spinel-law contact
      // twin, common in MVT galena (5-15% twin frequency per Boyle
      // 1968). Dispatch gated on mineral='galena' + twinned +
      // twin_law='spinel_law'.
      return _makeGalenaOctahedronTwin();
    case 'aragonite_pseudohex_twin':
      // v134 (2026-05-22) — fourth iconic twin. Three tabular
      // metric orthorhombic prisms related by {110} twinning, producing
      // pseudo-hex column. Dispatch gated on mineral='aragonite' +
      // twinned + twin_law='cyclic_sextet'.
      return _makeAragonitePseudohexTwin();
    case 'cerussite_sixling_twin':
      // v134 (2026-05-22) — fifth iconic twin. The flat-star (stellate)
      // counterpart to aragonite's vertical pseudo-hex column: 3 thin
      // blades in the wall plane (XZ), each rotated 60° → 6 visible
      // arms. Dispatch gated on mineral='cerussite' + twinned +
      // twin_law='cyclic_sixling'.
      return _makeCerussiteSixlingTwin();
    case 'marcasite_cockscomb_twin':
      // v134 (2026-05-22) — sixth iconic twin. Two thin needle blades
      // joined on {110}, opening in a tight 40° V — the diagnostic
      // marcasite morphology. Dispatch gated on mineral='marcasite'
      // + twinned + twin_law='cockscomb'.
      return _makeMarcasiteCockscombTwin();
    case 'pyrite_iron_cross_twin':
      // v134 (2026-05-22) — seventh and final iconic twin (completes
      // the 7 listed in RESEARCH-CRYSTAL-NATURALISM.md §7). Two chiral
      // {120} pyritohedra interpenetrating at 90° around c-axis —
      // canonical "Eisernes Kreuz" twin (Ramdohr 1980). Dispatch gated
      // on mineral='pyrite' + twinned + twin_law='iron_cross'.
      return _makePyriteIronCrossTwin();
    case 'marcasite_spearhead_twin':
      // v134 (2026-05-22) — secondary marcasite twin. Single elongated
      // rhombic bipyramid {101} (vs the cockscomb's V-pair). Dispatch
      // gated on mineral='marcasite' + twinned + twin_law='spearhead'.
      return _makeMarcasiteSpearheadTwin();
    case 'aragonite_contact_twin':
      // v134 (2026-05-22) — secondary aragonite twin. Two prismatic
      // (square cross-section) crystals joined in a {110} contact V
      // (vs the cyclic-sextet's 3-fold pseudo-hex column). Dispatch
      // gated on mineral='aragonite' + twinned + twin_law='contact'.
      return _makeAragoniteContactTwin();
    case 'octahedron':
      return new THREE.OctahedronGeometry(0.55, 0);
    case 'tetrahedron':
      // Sphalerite / chalcopyrite (review 2026-09-04, F3): a regular tetrahedron, one
      // face sealed to the wall (base y = −0.5), apex toward the void (y = +0.5).
      return _makeTetrahedron();
    case 'snowball':
      // Q5 — population-level epitaxy aggregate (boss-approved sphere
      // primitive). Radius 0.5 → diameter 1.0 → unit-scale sphere
      // that the per-mesh isometric scale dispatch stretches to
      // c_length_mm uniform. 16x12 segmentation gives a smooth-
      // enough silhouette without the vertex cost of 32x16.
      return new THREE.SphereGeometry(0.5, 16, 12);
    case 'rhombic_dodec':
      // Garnet-style 12 rhombic faces. Phase E5 batch 3.
      return _makeRhombicDodecahedron();
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(0.55, 0);
    case 'botryoidal':
      // Botryoidal — multi-bubble cluster reads as malachite kidney
      // or hematite blob. Phase E5 batch 1.
      return _makeBotryoidalCluster();
    case 'dripstone':
      // PROPOSAL-HABIT-BIAS Slice 4 — cave stalactite/stalagmite
      // tapered icicle. Used when growth_environment === 'air' and
      // canonical token is dripstone-eligible (see
      // _resolveCrystalGeomToken).
      return _makeDripstoneIcicle();
    case 'aragonite_frostwork':
      // Phase 1c (v156, 2026-05-27): cave aragonite frostwork —
      // radiating acicular spray from a central anchor. Real cave
      // aragonite morphology per Hill & Forti 1997. Dispatch gated on
      // mineral='aragonite' + growth_environment='air'.
      return _makeAragoniteFrostwork();
    default:
      return _makeHexPrismWithPyramid();
  }
}

// ----- Phase E5b: cluster instancing -----
//
// Real crystal clusters are aggregates — drusy carpets, sprays,
// rosettes. Phase E5 gave each crystal one solo facet-correct mesh;
// E5b multiplies that into a small cluster of satellites around each
// parent so the visible scene reads as crystal aggregates rather than
// dotted singletons. Satellites share the parent's geometry +
// material (cheap to instance) and inherit the parent's userData
// (tagged with isSatellite=true) so the raycaster resolves a click
// on a satellite back to the parent crystal.
//
// Determinism: the satellite shape is seeded by crystal_id, so
// reloading the same scene always produces the same cluster.

// Mulberry32 — 32-bit splittable PRNG. Tiny, fast, deterministic per
// seed. Used per-crystal so each cluster's offsets/rotations/scales
// are reproducible across reloads.
function _clusterRand(seed: number) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-crystal yaw around the c-axis (the local +Y
// post-orientation, which is aligned with the substrate normal).
// Without this, every cube/octahedron/prism in a cluster faces the
// camera with the same vertex on top — even though real crystals
// nucleate with random crystallographic orientation around the c-axis.
// Hex prisms get 6 visually-distinct rotations, cubes 4, etc., but the
// continuous random angle reads more naturally than snapping to lattice
// symmetry. Seed combines crystal_id with a different prime than
// _emitClusterSatellites uses (0x9E3779B9 vs 0x85EBCA77) so the parent's
// yaw isn't correlated with its satellites' offsets.
function _crystalYaw(crystal_id: number): number {
  const rand = _clusterRand(((crystal_id | 0) * 0x85EBCA77 + 0x67890) | 0);
  return rand() * Math.PI * 2;
}

// Per-habit cluster pattern. Different habits aggregate differently
// in real specimens: acicular crystals fan out as sprays, prismatic
// crystals stand parallel as forests of needles, cubic crystals carpet
// the wall in many small replicas, etc.
//
// Pattern fields:
//   countScale:   multiplier on the size-driven baseline count
//                 (1.0 = default drusy, 2.0 = denser carpet, etc.)
//   spreadMul:    multiplier on the spread radius (1.0 default)
//   tiltMax:      max satellite tilt off parent normal (radians)
//   scaleMin/Max: satellite scale range
//   evenAngles:   if true, satellites spaced equally around the
//                 tangent circle (rosette-like)
type ClusterPattern = {
  countScale: number;
  spreadMul: number;
  tiltMax: number;
  scaleMin: number;
  scaleMax: number;
  evenAngles: boolean;
};

const _CLUSTER_PATTERNS: Record<string, ClusterPattern> = {
  // Acicular spray — needles fanning out from a single nucleation
  // point. Tighter spread + much wider tilt = the stibnite spray look.
  spike: {
    countScale: 1.3,
    spreadMul: 0.6,
    tiltMax: 0.55,           // ±31°
    scaleMin: 0.35,
    scaleMax: 0.75,
    evenAngles: false,
  },
  // Prismatic forest — quartz druse, beryl forest. Parallel alignment
  // dominates; satellites stand close, tilted only slightly, mostly
  // matching the parent's height.
  prism: {
    countScale: 1.5,
    spreadMul: 1.1,
    tiltMax: 0.12,           // ±7°
    scaleMin: 0.55,
    scaleMax: 0.95,
    evenAngles: false,
  },
  // Cubic carpet — fluorite / halite / pyrite druse. Many small cubes
  // packed against the wall, no tilt.
  cube: {
    countScale: 1.8,
    spreadMul: 1.4,
    tiltMax: 0.08,           // near-flat carpet
    scaleMin: 0.25,
    scaleMax: 0.55,
    evenAngles: false,
  },
  // Octahedral / dodecahedral / rhombic-dodec — chunky isometric crystals.
  // Slightly fewer satellites, modest tilt, larger relative scale.
  octahedron: {
    countScale: 0.8,
    spreadMul: 1.0,
    tiltMax: 0.20,
    scaleMin: 0.40,
    scaleMax: 0.75,
    evenAngles: false,
  },
  // Tetrahedral sphalerite druse — chunky, modest tilt (the octahedron pattern).
  tetrahedron: {
    countScale: 0.8,
    spreadMul: 1.0,
    tiltMax: 0.20,
    scaleMin: 0.40,
    scaleMax: 0.75,
    evenAngles: false,
  },
  rhombic_dodec: {
    countScale: 0.8,
    spreadMul: 1.0,
    tiltMax: 0.20,
    scaleMin: 0.40,
    scaleMax: 0.75,
    evenAngles: false,
  },
  // Tabular rosette — petals fanned with even angular spacing so
  // satellites read as a flower-like arrangement (gypsum desert rose,
  // hematite rose). Wider tilt to face the petals outward.
  tablet: {
    countScale: 1.2,
    spreadMul: 1.3,
    tiltMax: 0.40,           // ±23° — petals open outward
    scaleMin: 0.50,
    scaleMax: 0.85,
    evenAngles: true,        // rosette signature
  },
  // Botryoidal — already a multi-bubble cluster geometry; adding
  // satellites would just clutter. Skip with countScale=0.
  botryoidal: {
    countScale: 0,
    spreadMul: 1,
    tiltMax: 0,
    scaleMin: 1, scaleMax: 1,
    evenAngles: false,
  },
  // v134 (2026-05-22): fan cluster. Denser + tighter + more parallel
  // than 'spike'. Tuned for the marcasite cockscomb chain — multiple
  // sub-parallel V-twins standing close on a shared baseline. Higher
  // countScale + lower spreadMul + lower tiltMax + narrower size span
  // give the chain-of-similar-units look that real cockscomb specimens
  // show.
  //
  // KNOWN LIMITATION: the satellite-emission code in
  // _emitClusterSatellites positions each satellite in a polar disc
  // around the parent (chord offset r·(cosθ·t1 + sinθ·t2)) and tilts
  // each off its own normal axis. A real cockscomb chain has
  // satellites lined up along ONE tangent direction with tilts all
  // in the SAME plane — that's a fundamentally different positioning
  // mode (linear array, not polar disc). The 'fan' pattern below
  // approximates the chain look via density + tightness + uniformity,
  // but the literal serrated-row arrangement is future work that
  // needs per-satellite arrangement logic (a linearArray field or
  // similar in ClusterPattern + branching in _emitClusterSatellites).
  fan: {
    countScale: 1.5,        // denser than spike (1.3)
    spreadMul: 0.4,         // tighter than spike (0.6) — chain bunches close
    tiltMax: 0.30,          // ±17° — more parallel than spike's ±31°
    scaleMin: 0.50,         // less variation than spike's 0.35-0.75
    scaleMax: 0.80,         //   — chain units are similar-sized siblings
    evenAngles: false,
  },
};

const _CLUSTER_PATTERN_DEFAULT: ClusterPattern = {
  countScale: 1.0,
  spreadMul: 1.0,
  tiltMax: 0.20,
  scaleMin: 0.40,
  scaleMax: 0.80,
  evenAngles: false,
};

// v134 (2026-05-22): twin primitives reuse their underlying-form cluster
// pattern. Mirrors 99d's _clusterPatternKeyForPrim mapping. The dispatch
// in this file lookups _CLUSTER_PATTERNS[geomToken] directly, so without
// these entries the twin tokens would fall through to
// _CLUSTER_PATTERN_DEFAULT — habit-appropriate but not habit-specific.
//
// Why each twin maps where it does:
//   fluorite penetration → cube     (Weardale/Cave-in-Rock fluorite carpets
//                                    contain many twinned cubes)
//   selenite swallowtail → tablet   (tabular blade rosette — Bohemian +
//                                    Naica clusters of fishtails)
//   galena spinel-law → octahedron  (Cobalt-Ontario octahedral galena groups)
//   aragonite pseudo-hex → prism    (vertical pseudo-hex columns cluster
//                                    as prismatic forests)
//   cerussite sixling → botryoidal  (count=0, skip; the primitive already
//                                    emits 6 visible arms — adding satellites
//                                    would clutter)
//   marcasite cockscomb → spike     (THE payoff: 'spike' pattern emits 4-8
//                                    satellite cockscomb-twins in a tight
//                                    spray, which IS the comb morphology)
//   pyrite iron-cross → cube        (twinned pyrite still grows in cubic
//                                    carpets — Elba, Pyrite Hill)
_CLUSTER_PATTERNS.fluorite_penetration_twin = _CLUSTER_PATTERNS.cube;
_CLUSTER_PATTERNS.selenite_swallowtail_twin = _CLUSTER_PATTERNS.tablet;
_CLUSTER_PATTERNS.galena_octahedron_twin = _CLUSTER_PATTERNS.octahedron;
_CLUSTER_PATTERNS.aragonite_pseudohex_twin = _CLUSTER_PATTERNS.prism;
_CLUSTER_PATTERNS.cerussite_sixling_twin = _CLUSTER_PATTERNS.botryoidal;  // skip cluster
_CLUSTER_PATTERNS.marcasite_cockscomb_twin = _CLUSTER_PATTERNS.fan;  // v134: dense tight chain of sub-parallel V-twins — the cockscomb morphology
_CLUSTER_PATTERNS.pyrite_iron_cross_twin = _CLUSTER_PATTERNS.cube;
_CLUSTER_PATTERNS.marcasite_spearhead_twin = _CLUSTER_PATTERNS.fan;  // v134: dense cluster of sub-parallel spear arrowheads — fan morphology like cockscomb
_CLUSTER_PATTERNS.aragonite_contact_twin = _CLUSTER_PATTERNS.prism;

// Number of satellite meshes per crystal — scales inversely with
// crystal size. Big gem crystals (>60 mm) read as solo specimens;
// small ones build into drusy carpets. Multiplied by the per-habit
// countScale.
function _clusterSatelliteCount(crystal: any, pattern: ClusterPattern, cLenOverride?: number): number {
  // v65: cLenOverride lets the replay path size the cluster count from
  // the historical c_length, not the live one. Without this, a replay
  // frame of a tiny crystal would still spawn its full live-size
  // cluster of satellites and pile them all on top of each other.
  const cLen = cLenOverride != null ? cLenOverride : crystal.c_length_mm;
  let base;
  if (cLen > 60) base = 0;
  else if (cLen > 20) base = 2;
  else if (cLen > 8) base = 4;
  else base = 6;
  return Math.round(base * pattern.countScale);
}

// Generate satellite meshes around a parent crystal. Each satellite
// is the same geometry/material; positioned within ~1.5× the parent's
// a-axis tangentially around the substrate normal, scaled to 0.4-0.8×
// parent, tilted up to ±11° off the parent's c-axis. Satellites are
// added to state.crystals alongside the parent.
// AREA-COVERING SURFACE GROWTH (SIM 246)
// ---------------------------------------
// A surface-growth Crystal is one mass-booked aggregate, not N extra crystals.
// The instance cloud below is therefore representative geometry: one draw call,
// no additions to sim.crystals, no extra accepted volume, and a hard mobile cap.
// The physical coverage/thickness/volume record is crystal._surfaceGrowth (js/45).
// Visual-realism review 2026-09-04 (finding F1): with a 128-instance cap the representative
// patches of a 90%-covered 45 mm cavity had to be ~17 mm coins to add up to the covered area,
// so every coating read as a carpet of octagonal plates. Representatives are now sized at a
// physical footprint (SURFACE_GROWTH_REPRESENTATIVE_MM — a botryoidal lobe / druse tooth) and
// the budget is what an InstancedMesh draws for free; the mobile cap stays strict, just larger.
const SURFACE_GROWTH_INSTANCE_CAP_DESKTOP = 1536;
const SURFACE_GROWTH_INSTANCE_CAP_MOBILE = 384;
const SURFACE_GROWTH_REPRESENTATIVE_MM = 1.5;
const SURFACE_GROWTH_THIN_CRUST_MM = 0.06;
const SURFACE_GROWTH_MESH_SPACING_MM = 0.9;
const SURFACE_GROWTH_MOBILE_MAX_WIDTH_CSS_PX = 720;
const SURFACE_GROWTH_MOBILE_MIN_DEVICE_PIXEL_RATIO = 2.5;

function _surfaceGrowthInstanceCount(coverage: number, mobile = false, coveredAreaMm2?: number): number {
  const cap = mobile ? SURFACE_GROWTH_INSTANCE_CAP_MOBILE : SURFACE_GROWTH_INSTANCE_CAP_DESKTOP;
  if (coveredAreaMm2 > 0) {
    const footprint = Math.PI * SURFACE_GROWTH_REPRESENTATIVE_MM * SURFACE_GROWTH_REPRESENTATIVE_MM;
    return Math.max(12, Math.min(cap, Math.round(coveredAreaMm2 / footprint)));
  }
  return Math.max(12, Math.min(cap, Math.round(12 + coverage * (cap - 12))));
}

// Equal-area deterministic points inside a spherical cap. `center` is the
// outward wall direction; cap area / whole-sphere area is exactly `coverage`.
// The golden-angle azimuth avoids both grid seams and random clumping.
function _surfaceGrowthSampleDirections(
  center: [number, number, number], count: number, coverage: number, seed = 0,
): Array<[number, number, number]> {
  let [cx, cy, cz] = center;
  const cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  cx /= cl; cy /= cl; cz /= cl;
  const ref = Math.abs(cy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let t1x = ref[1] * cz - ref[2] * cy;
  let t1y = ref[2] * cx - ref[0] * cz;
  let t1z = ref[0] * cy - ref[1] * cx;
  const tl = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1;
  t1x /= tl; t1y /= tl; t1z /= tl;
  const t2x = cy * t1z - cz * t1y;
  const t2y = cz * t1x - cx * t1z;
  const t2z = cx * t1y - cy * t1x;
  const cov = Math.max(0.001, Math.min(0.999, coverage));
  const cosEdge = 1 - 2 * cov;
  const phase = ((seed * 0.6180339887498949) % 1 + 1) % 1 * Math.PI * 2;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const cosA = 1 - u * (1 - cosEdge);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const az = phase + i * golden;
    const ca = Math.cos(az), sa = Math.sin(az);
    out.push([
      cx * cosA + (t1x * ca + t2x * sa) * sinA,
      cy * cosA + (t1y * ca + t2y * sa) * sinA,
      cz * cosA + (t1z * ca + t2z * sa) * sinA,
    ]);
  }
  return out;
}

function _surfaceGrowthWallPoint(
  wall: any, dir: [number, number, number], ringCount: number, N: number, initR: number,
): any {
  let [dx, dy, dz] = dir;
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  const phi = Math.acos(Math.max(-1, Math.min(1, -dy)));
  const ringIdx = Math.max(0, Math.min(ringCount - 1,
    Math.round((phi / Math.PI) * ringCount - 0.5)));
  const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1;
  const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0;
  let theta = Math.atan2(dz, dx) - twist;
  while (theta < 0) theta += 2 * Math.PI;
  while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;
  const cellIdx = Math.max(0, Math.min(N - 1, Math.floor(theta / (2 * Math.PI) * N)));
  const cell = wall.rings[ringIdx] && wall.rings[ringIdx][cellIdx];
  const baseR = cell && cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
  const radius = (baseR + (cell ? cell.wall_depth : 0)) * polar;
  return {
    x: radius * dx, y: radius * dy, z: radius * dz,
    // Cavity-facing normal points inward.
    nx: -dx, ny: -dy, nz: -dz,
    ringIdx, cellIdx, radius,
  };
}

// Single-representation gate used by production sync and executed Three.js
// integration tests. A surface aggregate owns one instanced swath; adding its
// legacy trophy parent as well would depict one booked solid twice.
function _addCrystalParentRepresentation(state: any, crystal: any, mesh: any): boolean {
  if (crystal?._surfaceGrowth) return false;
  _topoLightingTagMesh(mesh, true);
  state.crystals.add(mesh);
  return true;
}

function _surfaceGrowthContactAt(layer: any, triangle: number, point: number[]): number[] | null {
    const sourceTriangles = layer.sourceTriangles, partitions = layer.partitions, p = layer.sourcePositions;
    if (!sourceTriangles || !partitions || !p) return null;
    const positionAt = (t: any, uv: number[]) => [0, 1, 2].map(k => p[t.ia * 3 + k] * (1 - uv[0] - uv[1]) + p[t.ib * 3 + k] * uv[0] + p[t.ic * 3 + k] * uv[1]);
    const cross2 = (a: number[], b: number[], q: number[]) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    const t = sourceTriangles.get(triangle), faces = partitions.get(triangle);
    if (!t || !faces) return null;
    const a = positionAt(t, [0, 0]), b = positionAt(t, [1, 0]), c = positionAt(t, [0, 1]);
    const ab = b.map((v: number, k: number) => v - a[k]), ac = c.map((v: number, k: number) => v - a[k]);
    const aq = point.map((v: number, k: number) => v - a[k]);
    const dot = (u: number[], v: number[]) => u.reduce((sum, x, k) => sum + x * v[k], 0);
    const bb = dot(ab, ab), bc = dot(ab, ac), cc = dot(ac, ac), qb = dot(aq, ab), qc = dot(aq, ac);
    const denominator = bb * cc - bc * bc;
    if (Math.abs(denominator) < 1e-20) return null;
    const uv = [(qb * cc - qc * bc) / denominator, (qc * bb - qb * bc) / denominator];
    for (const face of faces) {
      const area = cross2(face[0].uv, face[1].uv, face[2].uv);
      const weights = [cross2(face[1].uv, face[2].uv, uv) / area,
        cross2(face[2].uv, face[0].uv, uv) / area, cross2(face[0].uv, face[1].uv, uv) / area];
      if (weights.every(w => w >= -1e-8)) return [0, 1, 2].map(k => weights.reduce((sum, w, i) => sum + w * face[i].top[k], 0));
    }
    return null;
}

// Normal offsets can fold on a tightly curved substrate. Reduce only the new
// representative relief toward its actual basal contact; subsequent deposits
// inherit this repaired surface. The scientific thickness/volume are untouched.
function _surfaceGrowthPreventFolds(positions: number[], bases: number[][],
  source: number[][], indices: number[], samples?: any[][]): any {
  const limited = new Set<number>();
  const area = (a: number, b: number, c: number, scale: number) => {
    const ax = bases[a][0] + (positions[a * 3 + 0] - bases[a][0]) * scale;
    const ay = bases[a][1] + (positions[a * 3 + 1] - bases[a][1]) * scale;
    const az = bases[a][2] + (positions[a * 3 + 2] - bases[a][2]) * scale;
    const bx = bases[b][0] + (positions[b * 3 + 0] - bases[b][0]) * scale - ax;
    const by = bases[b][1] + (positions[b * 3 + 1] - bases[b][1]) * scale - ay;
    const bz = bases[b][2] + (positions[b * 3 + 2] - bases[b][2]) * scale - az;
    const cx = bases[c][0] + (positions[c * 3 + 0] - bases[c][0]) * scale - ax;
    const cy = bases[c][1] + (positions[c * 3 + 1] - bases[c][1]) * scale - ay;
    const cz = bases[c][2] + (positions[c * 3 + 2] - bases[c][2]) * scale - az;
    const sbx = source[b][0] - source[a][0];
    const sby = source[b][1] - source[a][1];
    const sbz = source[b][2] - source[a][2];
    const scx = source[c][0] - source[a][0];
    const scy = source[c][1] - source[a][1];
    const scz = source[c][2] - source[a][2];
    return (by * cz - bz * cy) * (sby * scz - sbz * scy) + (bz * cx - bx * cz) * (sbz * scx - sbx * scz) + (bx * cy - by * cx) * (sbx * scy - sby * scx);
  };
  const models = samples || source.map((point, id) => [{ point, weight: 1,
    vector: point.map((_, k) => positions[id * 3 + k] - bases[id][k]) }]);
  const hazards = new Map<string, any>(), buckets = new Map<string, any[]>();
  const pointKey = (point: number[]) => point.map(v => Math.round(v * 1e7)).join(',');
  let fieldCache = new Map<string, number>();
  const attenuation = (point: number[]) => {
    const key = pointKey(point), cached = fieldCache.get(key);
    if (cached != null) return cached;
    let value = 1;
    const cell = point.map(v => Math.floor(v / 5));
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      const nearby = buckets.get((cell[0] + x) + ',' + (cell[1] + y) + ',' + (cell[2] + z));
      if (!nearby) continue;
      for (const h of nearby) {
        const distance2 = point.reduce((sum, v, k) => sum + (v - h.point[k]) ** 2, 0);
        if (distance2 > 25) continue;
        value = Math.min(value, 1 - (1 - h.cap) * Math.exp(-distance2 / 4.5));
      }
    }
    fieldCache.set(key, value); return value;
  };
  let unresolved = 0, minimumScale = 1;
  for (let iteration = 0; iteration < 24; iteration++) {
    const pending = new Map<string, any>();
    unresolved = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      if (area(a, b, c, 1) >= -1e-12) continue;
      unresolved++;
      let low = 0, high = 1;
      for (let step = 0; step < 16; step++) {
        const middle = (low + high) * 0.5;
        if (area(a, b, c, middle) >= 0) low = middle; else high = middle;
      }
      // Smooth the safe MIN over a 1.5 mm neighborhood. Re-evaluate the original
      // displacement field, not a pinched mesh. Canonical edge samples retain
      // their shared interpolation even where an older footprint added vertices.
      for (const id of [a, b, c]) for (const sample of models[id]) {
        const key = pointKey(sample.point), cap = attenuation(sample.point) * low * 0.7;
        const old = pending.get(key);
        if (!old || cap < old.cap) pending.set(key, { point: sample.point, cap });
      }
    }
    if (!unresolved) break;
    for (const [key, h] of pending) {
      const existing = hazards.get(key);
      if (existing) existing.cap = Math.min(existing.cap, h.cap);
      else {
        hazards.set(key, h);
        const cell = h.point.map((v: number) => Math.floor(v / 5)).join(',');
        const bucket = buckets.get(cell) || []; bucket.push(h); buckets.set(cell, bucket);
      }
    }
    fieldCache = new Map();
    for (let id = 0; id < bases.length; id++) {
      const displacement = [0, 0, 0];
      for (const sample of models[id]) {
        const scale = attenuation(sample.point);
        minimumScale = Math.min(minimumScale, scale);
        if (scale < 0.999999) limited.add(id);
        for (let k = 0; k < 3; k++) displacement[k] += sample.vector[k] * sample.weight * scale;
      }
      for (let k = 0; k < 3; k++) positions[id * 3 + k] = Math.fround(bases[id][k] + displacement[k]);
    }
  }
  unresolved = 0;
  for (let i = 0; i < indices.length; i += 3) if (area(indices[i], indices[i + 1], indices[i + 2], 1) < -1e-12) unresolved++;
  return { limited_vertices: limited.size, relief_scale: minimumScale, unresolved };
}

// A later deposit also coats the microscopic riser at an earlier film's edge.
// Match collinear source intervals, including unequal subdivisions, then bridge
// their actual top profiles. These side faces add no projected booked footprint.
function _surfaceGrowthBridgeContactSteps(positions: number[], source: number[][],
  indices: number[], edges: any[]): number {
  const buckets = new Map<string, number[]>(), bounds: number[][] = [];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a: number[], b: number[]) => a.map((v, k) => v - b[k]);
  for (let i = 0; i < edges.length; i++) {
    const a = source[edges[i].a], b = source[edges[i].b];
    const bound = [0, 1, 2].flatMap(k => [Math.floor((Math.min(a[k], b[k]) - 1e-6) / 2), Math.floor((Math.max(a[k], b[k]) + 1e-6) / 2)]);
    bounds.push(bound);
    for (let x = bound[0]; x <= bound[1]; x++) for (let y = bound[2]; y <= bound[3]; y++) for (let z = bound[4]; z <= bound[5]; z++) {
      const key = `${x},${y},${z}`, bucket = buckets.get(key) || [];
      bucket.push(i); buckets.set(key, bucket);
    }
  }
  let bridges = 0;
  const top = (edge: any, t: number) => [0, 1, 2].map(k => positions[edge.a * 3 + k] * (1 - t) + positions[edge.b * 3 + k] * t);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i], a = source[e.a], ab = sub(source[e.b], a), length2 = dot(ab, ab);
    if (length2 < 1e-20) continue;
    const bound = bounds[i], candidates = new Set<number>();
    for (let x = bound[0]; x <= bound[1]; x++) for (let y = bound[2]; y <= bound[3]; y++) for (let z = bound[4]; z <= bound[5]; z++) {
      for (const j of buckets.get(`${x},${y},${z}`) || []) if (j > i) candidates.add(j);
    }
    for (const j of candidates) {
      const f = edges[j], ac = sub(source[f.a], a), ad = sub(source[f.b], a);
      const tc = dot(ac, ab) / length2, td = dot(ad, ab) / length2;
      if (Math.abs(tc - td) < 1e-10) continue;
      if (Math.hypot(...ac.map((v, k) => v - ab[k] * tc)) > 1e-6
        || Math.hypot(...ad.map((v, k) => v - ab[k] * td)) > 1e-6) continue;
      const lo = Math.max(0, Math.min(tc, td)), hi = Math.min(1, Math.max(tc, td));
      if (hi - lo < 1e-8) continue;
      const ea = top(e, lo), eb = top(e, hi), fa = top(f, (lo - tc) / (td - tc)), fb = top(f, (hi - tc) / (td - tc));
      if (Math.max(Math.hypot(...sub(ea, fa)), Math.hypot(...sub(eb, fb))) <= 1e-5) continue;
      const start = positions.length / 3;
      positions.push(...ea, ...eb, ...fa, ...fb);
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
      bridges++;
    }
  }
  return bridges;
}

function _surfaceGrowthCrustField(wall: any, crystal: any, sim: any,
  coverage: number, thickness: number, area: number): any {
  const count = _surfaceGrowthInstanceCount(coverage, false, area * 1.5);
  const samples = wall.sampleSurfacePatchForCrystal?.(crystal, count, coverage,
    crystal.crystal_id || 0, sim);
  if (!samples?.samples?.length) return null;
  const rand = _clusterRand((crystal.crystal_id || 0) * 0x9E3779B9 + 0x523b);
  const buckets = new Map<string, any[]>();
  let maxDiameter = 0;
  for (const p of samples.samples) {
    const logSize = Math.exp(0.32 * Math.sqrt(-2 * Math.log(Math.max(1e-9, rand())))
      * Math.cos(2 * Math.PI * rand()) - 0.32 * 0.32 / 2);
    const radius = Math.min(2.5, 1.8 * Math.max(0.55, Math.min(1.8, logSize)));
    const key = `${Math.floor(p.x / 5)},${Math.floor(p.y / 5)},${Math.floor(p.z / 5)}`;
    const bucket = buckets.get(key) || [];
    bucket.push({ x: p.x, y: p.y, z: p.z, radius2: radius * radius });
    buckets.set(key, bucket);
    maxDiameter = Math.max(maxDiameter, radius * 2);
  }
  // A representative envelope, not an extra volume booked by the simulation.
  // Basal skin plus all merged relief together stay below 3× mean thickness.
  const base = Math.min(0.08, thickness * 0.25);
  const amplitude = Math.min(0.8, thickness * 2.75);
  const heightAt = (point: number[]) => {
    const [x, y, z] = point;
    const bx = Math.floor(x / 5), by = Math.floor(y / 5), bz = Math.floor(z / 5);
    let sum = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const bucket = buckets.get(`${bx + i},${by + j},${bz + k}`);
      if (!bucket) continue;
      for (const p of bucket) {
        const q = 1 - ((x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2) / p.radius2;
        if (q > 0) sum += q * q * q;
      }
    }
    // Compact smooth kernels merge without full-sphere silhouettes or seams.
    return base + amplitude * (1 - Math.exp(-sum));
  };
  return { heightAt, base, maxRelief: base + amplitude, maxDiameter,
    count: samples.samples.length, source_signature: samples.source_signature };
}

// Stable renderer-private growth directions. The authenticated field gradients
// may turn sharply between nearby vertices; displacing along them folds a thick
// shell. Smooth geometric normals without moving or editing the source surface.
function _surfaceGrowthSourceFrame(surface: any, patch: any): any {
  const positions = Float32Array.from(surface.positions);
  if (!surface.indices && surface.normals?.length === positions.length) {
    return { positions, normals: Float32Array.from(surface.normals) };
  }
  const count = positions.length / 3, normals = new Float32Array(positions.length);
  const neighbors: Set<number>[] = Array.from({ length: count }, () => new Set<number>());
  const indices = surface.indices ? Array.from(surface.indices) as number[]
    : patch.triangles.flatMap((t: any) => [t.ia, t.ib, t.ic]);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const bx = positions[b * 3] - positions[a * 3], by = positions[b * 3 + 1] - positions[a * 3 + 1], bz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const cx = positions[c * 3] - positions[a * 3], cy = positions[c * 3 + 1] - positions[a * 3 + 1], cz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const n = [by * cz - bz * cy, bz * cx - bx * cz, bx * cy - by * cx];
    for (const id of [a, b, c]) { for (let k = 0; k < 3; k++) normals[id * 3 + k] += n[k]; }
    for (const [u, v] of [[a, b], [b, c], [c, a]]) { neighbors[u].add(v); neighbors[v].add(u); }
  }
  const normalize = (buffer: Float32Array) => {
    for (let i = 0; i < count; i++) {
      const length = Math.hypot(buffer[i * 3], buffer[i * 3 + 1], buffer[i * 3 + 2]) || 1;
      for (let k = 0; k < 3; k++) buffer[i * 3 + k] /= length;
    }
  };
  normalize(normals);
  let smooth = normals;
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(smooth.length);
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
      next[i * 3 + k] = smooth[i * 3 + k] * 2;
      for (const neighbor of neighbors[i]) next[i * 3 + k] += smooth[neighbor * 3 + k];
    }
    normalize(next); smooth = next;
  }
  return { positions, normals: smooth };
}

// R3: one authenticated patch carries thin films or connected mound relief.
// Later deposits inherit the rendered contact triangulation. Scientific records
// and source buffers stay immutable; this remains a representative envelope.
function _emitSurfaceGrowthLining(state: any, crystal: any, parentMat: any,
  wall: any, sim: any, coverage: number, maturity: number, earlierLayers: any[]): any {
  const patch = wall.surfacePatchForCrystal?.(crystal, coverage, sim);
  const surface = wall.surfaceForCrystal?.(crystal, sim);
  if (!patch?.triangles?.length || !surface?.positions
      || patch.source_signature !== surface.sig) return null;
  const record = crystal._surfaceGrowth;
  const thickness = Math.max(0, Number(record.mean_thickness_um) || 0) / 1000 * maturity;
  if (!(thickness > 0)) return null;
  const thickCrust = record.regime === 'botryoidal_crust'
    && Number(record.mean_thickness_um) / 1000 > SURFACE_GROWTH_THIN_CRUST_MM;
  const crust = thickCrust
    ? _surfaceGrowthCrustField(wall, crystal, sim, coverage, thickness, patch.area_mm2) : null;
  if (thickCrust && !crust) return null;
  if (crust && crust.source_signature !== patch.source_signature) return null;
  const frameCache = (earlierLayers as any).sourceFrames || ((earlierLayers as any).sourceFrames = new Map());
  let frame = frameCache.get(surface.sig);
  if (!frame) { frame = _surfaceGrowthSourceFrame(surface, patch); frameCache.set(surface.sig, frame); }
  const p = frame.positions, sourceNormals = frame.normals;
  const triangleKeys = new Set<string>();
  const domains = new Map<number, number[][]>();
  const sourceTriangles = frame.triangles || (frame.triangles = new Map<number, any>());
  const sourceKeys = frame.triangleKeys || (frame.triangleKeys = new Map<number, string>());
  const fullDomain = [[0, 0], [1, 0], [0, 1]];
  const boundary = new Map<string, any>();
  const positionAt = (t: any, uv: number[]) => [0, 1, 2].map(k =>
    p[t.ia * 3 + k] * (1 - uv[0] - uv[1]) + p[t.ib * 3 + k] * uv[0] + p[t.ic * 3 + k] * uv[1]);
  const normalAt = (t: any, uv: number[]) => {
    const n = sourceNormals?.length === p.length
      ? [0, 1, 2].map(k => -sourceNormals[t.ia * 3 + k] * (1 - uv[0] - uv[1])
        - sourceNormals[t.ib * 3 + k] * uv[0] - sourceNormals[t.ic * 3 + k] * uv[1])
      : t.void_normal.slice();
    const length = Math.hypot(...n) || 1;
    return n.map((v: number) => v / length);
  };
  const pointKey = (point: number[]) => `${Math.round(point[0] * 1e7)},${Math.round(point[1] * 1e7)},${Math.round(point[2] * 1e7)}`;
  for (const t of patch.triangles) {
    if (!sourceKeys.has(t.triangle_index)) sourceKeys.set(t.triangle_index, patch.source_signature + ':' + t.triangle_index);
    triangleKeys.add(sourceKeys.get(t.triangle_index));
    if (!sourceTriangles.has(t.triangle_index)) sourceTriangles.set(t.triangle_index, t);
    const fraction = Math.max(0, Math.min(1, t.weight_mm2 / t.area_mm2));
    const domain = fraction < 1 ? fullDomain.map(uv => uv.slice()) : fullDomain;
    if (fraction < 1) {
      const ids = [t.ia, t.ib, t.ic];
      let apex = 2;
      for (const neighbor of patch.triangles) {
        if (neighbor === t) continue;
        const shared = [neighbor.ia, neighbor.ib, neighbor.ic];
        const opposite = ids.findIndex(id => !shared.includes(id));
        if (opposite >= 0 && ids.filter(id => shared.includes(id)).length === 2) { apex = opposite; break; }
      }
      const a = (apex + 1) % 3, b = (apex + 2) % 3;
      domain[apex] = [0, 1].map(k => (domain[a][k] + domain[b][k]) * 0.5 * (1 - fraction) + domain[apex][k] * fraction);
    }
    if (fraction < 1) domains.set(t.triangle_index, domain);
    for (let i = 0; crust && i < 3; i++) {
      const a = positionAt(t, domain[i]), b = positionAt(t, domain[(i + 1) % 3]);
      const ka = pointKey(a), kb = pointKey(b), key = ka < kb ? ka + ':' + kb : kb + ':' + ka;
      if (boundary.has(key)) boundary.delete(key); else boundary.set(key, { a, b });
    }
  }
  // A crust feathers into its substrate at the booked perimeter. Interior skin
  // remains positive; no vertical full-sphere rim or step for a later film to bridge.
  const boundaryBuckets = new Map<string, any[]>();
  for (const edge of crust ? boundary.values() : []) {
    const length = Math.hypot(...edge.a.map((v: number, k: number) => v - edge.b[k]));
    const steps = Math.max(1, Math.ceil(length)), visited = new Set<string>();
    for (let step = 0; step <= steps; step++) {
      const cell = edge.a.map((v: number, k: number) => Math.floor((v + (edge.b[k] - v) * step / steps) / 2));
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const key = `${cell[0] + x},${cell[1] + y},${cell[2] + z}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const bucket = boundaryBuckets.get(key) || [];
        bucket.push(edge); boundaryBuckets.set(key, bucket);
      }
    }
  }
  const reliefCache = new Map<string, number>();
  const ownReliefAt = (point: number[]) => {
    if (!crust) return thickness;
    const key = pointKey(point), cached = reliefCache.get(key);
    if (cached != null) return cached;
    let distance2 = 0.6 * 0.6;
    const nearby = boundaryBuckets.get(point.map(v => Math.floor(v / 2)).join(',')) || [];
    for (const { a, b } of nearby) {
      if ([0, 1, 2].some(k => point[k] < Math.min(a[k], b[k]) - 0.6 || point[k] > Math.max(a[k], b[k]) + 0.6)) continue;
      const ab = b.map((v: number, k: number) => v - a[k]);
      const length2 = ab.reduce((sum: number, v: number) => sum + v * v, 0);
      const along = Math.max(0, Math.min(1, ab.reduce((sum: number, v: number, k: number) => sum + (point[k] - a[k]) * v, 0) / Math.max(1e-20, length2)));
      distance2 = Math.min(distance2, ab.reduce((sum: number, v: number, k: number) => sum + (point[k] - a[k] - along * v) ** 2, 0));
    }
    const x = Math.min(1, Math.sqrt(distance2) / 0.6);
    const relief = crust.heightAt(point) * x * x * (3 - 2 * x);
    reliefCache.set(key, relief);
    return relief;
  };
  const growthProfileAt = (t: any, uv: number[]) => {
    const weights = [1 - uv[0] - uv[1], uv[0], uv[1]];
    const zero = weights.findIndex(w => Math.abs(w) < 1e-9);
    if (zero < 0 || !sourceNormals) {
      const point = positionAt(t, uv), direction = normalAt(t, uv);
      return { point, samples: [{ point, direction, weight: 1 }] };
    }
    const ids = [t.ia, t.ib, t.ic], edge = [0, 1, 2].filter(i => i !== zero).sort((a, b) => ids[a] - ids[b]);
    const a = ids[edge[0]], b = ids[edge[1]], along = weights[edge[1]];
    const length = Math.hypot(...[0, 1, 2].map(k => p[b * 3 + k] - p[a * 3 + k]));
    const segments = Math.min(4096, 2 ** Math.max(0, Math.ceil(Math.log2(length / SURFACE_GROWTH_MESH_SPACING_MM))));
    const lower = Math.min(segments - 1, Math.floor(along * segments)), blend = along * segments - lower;
    const sample = (fraction: number) => {
      const point = [0, 1, 2].map(k => p[a * 3 + k] * (1 - fraction) + p[b * 3 + k] * fraction);
      const n = [0, 1, 2].map(k => -sourceNormals[a * 3 + k] * (1 - fraction) - sourceNormals[b * 3 + k] * fraction);
      const scale = 1 / (Math.hypot(...n) || 1);
      return { point, direction: n.map(v => v * scale) };
    };
    const first = sample(lower / segments), second = sample((lower + 1) / segments);
    // Inherited partial footprints can insert extra vertices on a shared source
    // edge. Interpolate the common edge profile instead of resampling its mound.
    return { point: positionAt(t, uv),
      samples: [{ ...first, weight: 1 - blend }, { ...second, weight: blend }].filter(sample => sample.weight > 0) };
  };
  const displacementAt = (t: any, v: any) => {
    // Carry renderer-private source coordinates and growth directions forward
    // with the contact vertices. Later films need only evaluate their own height.
    const profile = v.growthProfile || (v.growthProfile = growthProfileAt(t, v.uv));
    const vector = [0, 0, 0];
    const samples = profile.samples.map((sample: any) => {
      const relief = ownReliefAt(sample.point);
      const delta = sample.direction.map((n: number, k: number) => {
        const value = n * relief; vector[k] += value * sample.weight; return value;
      });
      return { point: sample.point, vector: delta, weight: sample.weight };
    });
    return { vector, samples, profile };
  };
  // Every deposit uses the same source grid. Subsequent layers inherit and split
  // its actual rendered triangles, including previous partial-footprint edges.
  // Each contact entry stores the cumulative top once, never a sum of absolute tops.
  const partitions = new Map<number, any[]>();
  const positions: number[] = [], indices: number[] = [];
  const sourcePoints: number[][] = [], basalPositions: number[][] = [];
  const newContactVertices: any[] = [], displacementSamples: any[][] = [];
  const nodeMap = new Map<string, number>(), edges = new Map<number | string, any>();
  const displacedContacts = new Map<string, any>();
  const addEdge = (a: number, b: number) => {
    // Pack the same unordered pair exactly into a safe integer. Large meshes
    // retain the string path rather than risk a numeric collision.
    const low = Math.min(a, b), high = Math.max(a, b);
    const edgeKey = high < 0x200000 ? high * 0x100000000 + low : low + ':' + high;
    const edge = edges.get(edgeKey);
    if (edge) edge.count++; else edges.set(edgeKey, { a, b, count: 1 });
  };
  const cross2 = (a: number[], b: number[], q: number[]) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
  const mixVertex = (a: any, b: any, f: number) => ({
    uv: a.uv.map((v: number, k: number) => v + (b.uv[k] - v) * f),
    top: a.top.map((v: number, k: number) => v + (b.top[k] - v) * f),
  });
  const splitPolygon = (poly: any[], a: number[], b: number[]) => {
    const inside: any[] = [], outside: any[] = [];
    for (let i = 0; i < poly.length; i++) {
      const v = poly[i], w = poly[(i + 1) % poly.length];
      const dv = cross2(a, b, v.uv), dw = cross2(a, b, w.uv);
      if (dv >= -1e-10) inside.push(v);
      if (dv <= 1e-10) outside.push(v);
      if ((dv > 1e-10 && dw < -1e-10) || (dv < -1e-10 && dw > 1e-10)) {
        const intersection = mixVertex(v, w, dv / (dv - dw));
        inside.push(intersection); outside.push(intersection);
      }
    }
    return { inside, outside };
  };
  const triangulate = (poly: any[]) => {
    const faces: any[][] = [];
    for (let i = 1; i + 1 < poly.length; i++) {
      if (Math.abs(cross2(poly[0].uv, poly[i].uv, poly[i + 1].uv)) > 1e-12) faces.push([poly[0], poly[i], poly[i + 1]]);
    }
    return faces;
  };
  const addNode = (v: any, t: any, base: number[]) => {
    // A contact vertex is shared by several faces in this build. Its assigned
    // node is stable until the fold repair below; avoid re-encoding its position.
    if (v.renderNode != null) return v.renderNode;
    const key = pointKey(v.top);
    const found = nodeMap.get(key);
    if (found != null) { v.renderNode = found; return found; }
    const id = positions.length / 3;
    nodeMap.set(key, id);
    positions.push(...v.top);
    sourcePoints.push(v.growthProfile.point); basalPositions.push(base); displacementSamples.push(v.samples);
    v.renderNode = id;
    return id;
  };
  for (const t of patch.triangles) {
    const key = sourceKeys.get(t.triangle_index);
    let previous: any[] | undefined;
    for (let layerIndex = earlierLayers.length - 1; layerIndex >= 0; layerIndex--) {
      const layer = earlierLayers[layerIndex];
      if (!layer.triangle_keys.has(key)) continue;
      const inherited = layer.partitions?.get(t.triangle_index);
      if (inherited) { previous = inherited; break; }
      // Scattered teeth/fibres have no continuous top to inherit. Their nominal
      // instance height must not lift a whole later coating into a false blanket.
    }
    if (!previous) {
      previous = [];
      const canonicalVertices = new Map<string, any>();
      const vertex = (u: number, v: number) => {
        const key = `${u}:${v}`, cached = canonicalVertices.get(key);
        if (cached) return cached;
        const uv = [u, v];
        const result = { uv, top: positionAt(t, uv) };
        canonicalVertices.set(key, result);
        return result;
      };
      const subdivide = (face: any[], depth: number) => {
        const lengths = face.map((v: any, i: number) => v.top.reduce((sum: number, x: number, k: number) => sum + (x - face[(i + 1) % 3].top[k]) ** 2, 0));
        const longest = lengths.indexOf(Math.max(...lengths));
        if (lengths[longest] <= SURFACE_GROWTH_MESH_SPACING_MM ** 2 || depth >= 12) { previous!.push(face); return; }
        const a = face[longest], b = face[(longest + 1) % 3], c = face[(longest + 2) % 3];
        const middle = vertex((a.uv[0] + b.uv[0]) * 0.5, (a.uv[1] + b.uv[1]) * 0.5);
        subdivide([a, middle, c], depth + 1); subdivide([middle, b, c], depth + 1);
      };
      // Split only edges longer than the common physical spacing. Short source
      // triangles need no detail; adjacent triangles make the same edge split.
      subdivide([vertex(0, 0), vertex(1, 0), vertex(0, 1)], 0);
    }
    const domain = domains.get(t.triangle_index)!;
    const output: any[] = [];
    const topVertices = new Map<any, any>();
    const fullTriangle = t.weight_mm2 >= t.area_mm2 * (1 - 1e-12);
    for (const face of previous) {
      let covered = face;
      const uncovered: any[] = [];
      for (let edge = 0; !fullTriangle && edge < 3 && covered.length >= 3; edge++) {
        const result = splitPolygon(covered, domain[edge], domain[(edge + 1) % 3]);
        uncovered.push(...triangulate(result.outside)); covered = result.inside;
      }
      output.push(...uncovered);
      for (const inner of fullTriangle ? [face] : triangulate(covered)) {
        const bases = inner.map((v: any) => v.top);
        const top = inner.map((v: any, i: number) => {
          const cached = topVertices.get(v);
          if (cached) return cached;
          const contactKey = pointKey(v.top);
          let contact = displacedContacts.get(contactKey);
          if (!contact) {
            const displacement = displacementAt(t, v);
            contact = { samples: displacement.samples, growthProfile: displacement.profile,
              top: bases[i].map((x: number, k: number) => Math.fround(x + displacement.vector[k])) };
            displacedContacts.set(contactKey, contact);
          }
          // A fixed object shape avoids a spread/copy and later shape changes
          // for every contact vertex; all geometric values remain shared.
          const result = { uv: v.uv, samples: contact.samples, growthProfile: contact.growthProfile,
            top: contact.top, renderNode: undefined as number | undefined };
          topVertices.set(v, result);
          newContactVertices.push(result);
          return result;
        });
        output.push(top);
        const ids = top.map((v: any, i: number) => addNode(v, t, bases[i]));
        indices.push(ids[0], ids[2], ids[1]);
        addEdge(ids[0], ids[2]); addEdge(ids[2], ids[1]); addEdge(ids[1], ids[0]);
      }
    }
    partitions.set(t.triangle_index, output);
  }
  const topVertexCount = positions.length / 3, topTriangleCount = indices.length / 3;
  const foldGuard = _surfaceGrowthPreventFolds(positions, basalPositions, sourcePoints, indices, displacementSamples);
  // Never publish inverted triangles if an exceptional substrate defeats the
  // bounded local repair. Earlier authenticated contacts remain available.
  if (foldGuard.unresolved) return null;
  let minimumRelief = Infinity, maximumRelief = 0;
  for (let i = 0; i < topVertexCount; i++) {
    const relief = Math.hypot(positions[i * 3] - basalPositions[i][0],
      positions[i * 3 + 1] - basalPositions[i][1], positions[i * 3 + 2] - basalPositions[i][2]);
    minimumRelief = Math.min(minimumRelief, relief);
    maximumRelief = Math.max(maximumRelief, relief);
  }
  const repairedTops = basalPositions.map((_, id) => positions.slice(id * 3, id * 3 + 3));
  for (const v of newContactVertices) {
    v.top = repairedTops[v.renderNode];
    // Release transient references without deleting fields from every shared
    // contact vertex (which turns these hot objects into dictionary objects).
    v.samples = undefined; v.renderNode = undefined;
  }
  let interiorOpenEdges = 0;
  for (const edge of edges.values()) if (edge.count === 1) {
    if (crust && [edge.a, edge.b].every(id => ownReliefAt(sourcePoints[id]) > 1e-5)) interiorOpenEdges++;
    const start = positions.length / 3;
    positions.push(...positions.slice(edge.a * 3, edge.a * 3 + 3), ...positions.slice(edge.b * 3, edge.b * 3 + 3),
      ...basalPositions[edge.a], ...basalPositions[edge.b]);
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  }
  const contactStepBridges = _surfaceGrowthBridgeContactSteps(positions, sourcePoints,
    indices, [...edges.values()].filter(edge => edge.count === 1));
  const footprint = patch.triangles.reduce((sum: number, t: any) => sum + t.weight_mm2, 0);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  const mat = parentMat.clone();
  mat.side = THREE.DoubleSide;
  mat.flatShading = false;
  mat.roughness = Math.max(0.38, Math.min(0.65, mat.roughness || 0.5));
  // Physical displacement separates films. A constant depth unit handles the
  // feather's coincident perimeter; slope bias would pull buried steep faces
  // through later micrometre coatings and draw false blue/black seams.
  mat.polygonOffset = true; mat.polygonOffsetFactor = 0; mat.polygonOffsetUnits = -1;
  _opticsApplyExtent(mat, thickness);
  _applyCavityClip(mat, state.clipUniforms, { specimenFragmentCut: true });
  const clipCompile = mat.onBeforeCompile;
  const clipKey = mat.customProgramCacheKey();
  const grain = typeof _wallGrainNormalMap === 'function' ? _wallGrainNormalMap() : null;
  if (grain) {
    // Fine triplanar normal grain: millimetre coordinates, no UV seams or new
    // texture allocation per crystal. The shared wall grain remains cache-owned.
    mat.onBeforeCompile = (shader: any) => {
      clipCompile(shader);
      shader.uniforms.uLiningGrain = { value: grain };
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform sampler2D uLiningGrain;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 liningN = inverseTransformDirection(normal, viewMatrix);
        vec3 liningW = pow(abs(liningN), vec3(4.0));
        liningW /= max(0.0001, liningW.x + liningW.y + liningW.z);
        vec2 liningX = texture2D(uLiningGrain, vCavityWorldPos.zy / 2.0).xy * 2.0 - 1.0;
        vec2 liningY = texture2D(uLiningGrain, vCavityWorldPos.xz / 2.0).xy * 2.0 - 1.0;
        vec2 liningZ = texture2D(uLiningGrain, vCavityWorldPos.xy / 2.0).xy * 2.0 - 1.0;
        vec3 liningG = vec3(0.0, liningX.y, -sign(liningN.x) * liningX.x) * liningW.x
          + vec3(liningY.x, 0.0, -sign(liningN.y) * liningY.y) * liningW.y
          + vec3(sign(liningN.z) * liningZ.x, liningZ.y, 0.0) * liningW.z;
        normal = normalize(normal + mat3(viewMatrix) * liningG * 0.08);`);
    };
    mat.customProgramCacheKey = () => `${clipKey}|lining-grain-v1`;
  }
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData = {
    surfaceGrowth: true, surfaceLining: true, ownsGeometry: true,
    crystal_id: crystal.crystal_id, mineral: crystal.mineral, regime: record.regime,
    coverage_fraction: coverage, physical_mean_thickness_um: record.mean_thickness_um,
    target_mean_thickness_mm: thickness, represented_area_mm2: footprint,
    rendered_relief_range_mm: [minimumRelief, maximumRelief],
    representation: crust ? 'connected-botryoidal-crust'
      : record.regime === 'botryoidal_crust' ? 'wall-conformal-crust-skin' : 'wall-conformal-lining', representative_only: true,
    area_basis: record.area_basis, stratigraphic_index: record.stratigraphic_index,
    source_signature: patch.source_signature, triangle_indices: [...patch.triangle_indices],
    representative_relief_mm: maximumRelief,
    target_relief_envelope_mm: crust ? crust.maxRelief : thickness,
    max_lobe_diameter_mm: crust?.maxDiameter, max_lobe_relief_mm: crust ? maximumRelief : undefined,
    target_basal_skin_mm: crust?.base, mound_count: crust?.count,
    top_vertex_count: topVertexCount, top_triangle_count: topTriangleCount,
    interior_open_edges: crust ? interiorOpenEdges : undefined,
    contact_step_bridges: contactStepBridges,
    curvature_limited_vertices: foldGuard.limited_vertices,
    curvature_min_relief_scale: foldGuard.relief_scale,
    unresolved_folds: foldGuard.unresolved,
    source_points: sourcePoints,
  };
  mesh.renderOrder = 0.55 + Math.min(0.1, Number(record.stratigraphic_index || 0) * 0.001);
  _topoLightingTagMesh(mesh, true);
  state.crystals.add(mesh);
  // The new partition includes prior uncovered portions too. Retain only the
  // current contact per source triangle, so a long coating history cannot keep
  // every transient JS triangulation alive after its GPU buffers are built.
  for (const layer of earlierLayers) if (layer.source_signature === patch.source_signature && layer.partitions) {
    for (const triangle of partitions.keys()) layer.partitions.delete(triangle);
  }
  earlierLayers.push({ crystal_id: crystal.crystal_id, source_signature: patch.source_signature,
    triangle_indices: new Set(patch.triangle_indices), triangle_keys: triangleKeys,
    representative_relief_mm: maximumRelief,
    partitions, sourceTriangles, sourcePositions: p });
  return mesh;
}

function _emitSurfaceGrowthSwath(
  state: any, crystal: any, parentMat: any,
  ax: number, ay: number, az: number,
  wall: any, ringCount: number, N: number, initR: number,
  renderC: number,
  sim: any,
  earlierLayers: any[],
): any {
  const record = crystal && crystal._surfaceGrowth;
  if (!record || !(record.coverage_fraction > 0) || !wall || !wall.rings) return null;
  const liveC = Math.max(1e-9, Number(crystal.c_length_mm) || 0);
  // Replay grows the footprint from the historical size rather than painting
  // the final shell on the first frame.
  const replayMaturity = Math.max(0.02, Math.min(1, renderC / liveC));
  const coverage = Math.max(0.005, Math.min(0.98,
    record.coverage_fraction * Math.sqrt(replayMaturity)));
  // Films and thick botryoidal crusts share one continuous patch. Only thick
  // crusts add merged mound relief, bounded together with their basal skin.
  const physicalThickness = Math.max(0, Number(record.mean_thickness_um) || 0) / 1000;
  if (record.regime === 'laminated_lining' || record.regime === 'botryoidal_crust') {
    return _emitSurfaceGrowthLining(state, crystal, parentMat, wall, sim,
      coverage, replayMaturity, earlierLayers);
  }
  const mobile = typeof window !== 'undefined'
    && ((window.innerWidth || 1024) <= SURFACE_GROWTH_MOBILE_MAX_WIDTH_CSS_PX
      || (window.devicePixelRatio || 1) >= SURFACE_GROWTH_MOBILE_MIN_DEVICE_PIXEL_RATIO);
  const coveredAreaForBudget = Number(record.cavity_area_mm2) > 0
    ? Number(record.cavity_area_mm2) * coverage : 0;
  const count = _surfaceGrowthInstanceCount(coverage, mobile, coveredAreaForBudget);
  const anchorNormal = wall?.surfaceNormalForCrystal?.(crystal) || [ax, ay, az];
  const al = Math.sqrt(anchorNormal[0] * anchorNormal[0]
    + anchorNormal[1] * anchorNormal[1] + anchorNormal[2] * anchorNormal[2]) || 1;
  const directions = _surfaceGrowthSampleDirections(
    [anchorNormal[0] / al, anchorNormal[1] / al, anchorNormal[2] / al],
    count, coverage, crystal.crystal_id || 0,
  );
  const exactPatch = wall && typeof wall.sampleSurfacePatchForCrystal === 'function'
    ? wall.sampleSurfacePatchForCrystal(
      crystal, count, coverage, crystal.crystal_id || 0, sim,
    )
    : null;

  let key = '__surface_patch_lowpoly';
  let geom = state.geomCache.get(key);
  if (!geom) {
    // 12×8 keeps a lobe round at the new ~3–5 mm representative size (8×5 read as octagons).
    geom = new THREE.SphereGeometry(0.5, 12, 8);
    state.geomCache.set(key, geom);
  }
  if (record.regime === 'euhedral_druse') {
    key = crystal.mineral === 'calcite' ? '__surface_calcite_tooth' : '__surface_quartz_point';
    geom = state.geomCache.get(key);
    if (!geom) {
      geom = _buildHabitGeom(crystal.mineral === 'calcite' ? 'scalene' : 'prism');
      state.geomCache.set(key, geom);
    }
  } else if (record.regime === 'fibrous_mat') {
    key = '__surface_fiber';
    geom = state.geomCache.get(key);
    if (!geom) { geom = _buildHabitGeom('spike'); state.geomCache.set(key, geom); }
  } else if (record.regime === 'dendritic_film') {
    // A wall dendrite is a branching two-dimensional film, not a forest of
    // pyrolusite needles. Reuse the deterministic tree skeleton, then flatten
    // it into the local tangent plane below.
    geom = _getDendriteTreeGeom(state, crystal);
  }

  const mat = parentMat.clone();
  mat.roughness = record.regime === 'fibrous_mat' ? 0.72
    : record.regime === 'dendritic_film' ? 0.78 : Math.max(0.48, mat.roughness || 0.5);
  _applyCavityClip(mat, state.clipUniforms, { specimenFragmentCut: true });

  const swath = new THREE.InstancedMesh(geom, mat, count);
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const cavityR = Math.max(1, Number(state.clipUniforms?.uVugRadius?.value) || initR);
  const fallbackArea = 4 * Math.PI * cavityR * cavityR * coverage;
  const representedArea = exactPatch && exactPatch.area_mm2 > 0
    ? exactPatch.area_mm2
    : (Number(record.cavity_area_mm2) > 0
      ? Number(record.cavity_area_mm2) * coverage
      : fallbackArea);
  const areaPerRepresentative = representedArea / count;
  const patchRadius = Math.max(0.22, Math.sqrt(areaPerRepresentative / Math.PI) * 1.08);
  const trueThicknessMm = physicalThickness;
  const displayThickness = Math.max(0.06, Math.min(patchRadius * 0.45,
    trueThicknessMm > 0 ? Math.max(trueThicknessMm, 0.06) : 0.06));
  // R2: a coating instance is patchRadius-scale; its transmissive path length follows.
  _opticsApplyExtent(mat, patchRadius * 0.6);

  // Canonical spacing keeps the legacy druse/fibre/film relief independent of LOD.
  const canonicalCount = _surfaceGrowthInstanceCount(coverage, false, coveredAreaForBudget);
  const canonicalPatchRadius = Math.max(0.22,
    Math.sqrt(representedArea / canonicalCount / Math.PI) * 1.08);

  for (let i = 0; i < count; i++) {
    const p = exactPatch && exactPatch.samples && exactPatch.samples[i]
      ? exactPatch.samples[i]
      : _surfaceGrowthWallPoint(wall, directions[i], ringCount, N, initR);
    let underburdenDisplayMm = 0;
    let contactBase = [p.x, p.y, p.z];
    if (p.triangle_index != null) {
      const triangleKey = `${exactPatch?.source_signature}:${p.triangle_index}`;
      for (const layer of earlierLayers) {
        if (layer.triangle_keys.has(triangleKey)) {
          const contact = _surfaceGrowthContactAt(layer, p.triangle_index, [p.x, p.y, p.z]);
          if (contact) { contactBase = contact; underburdenDisplayMm = 0; }
          else if (!layer.partitions) underburdenDisplayMm += layer.representative_relief_mm;
        }
      }
    }
    const h = Math.abs(Math.sin((crystal.crystal_id + 1) * 17.17 + i * 9.73)) % 1;
    if (record.regime === 'euhedral_druse') {
      const height = Math.max(0.24, Math.min(1.6, patchRadius * (0.28 + 0.22 * h)));
      const width = height * (crystal.mineral === 'calcite' ? 0.42 : 0.28);
      axis.set(p.nx, p.ny, p.nz);
      dummy.quaternion.setFromUnitVectors(up, axis);
      dummy.rotateY(h * Math.PI * 2);
      dummy.position.set(
        contactBase[0] + p.nx * (underburdenDisplayMm + height * 0.5),
        contactBase[1] + p.ny * (underburdenDisplayMm + height * 0.5),
        contactBase[2] + p.nz * (underburdenDisplayMm + height * 0.5),
      );
      dummy.scale.set(width, height, width);
    } else if (record.regime === 'dendritic_film') {
      // Build a right-handed local frame with tree +Y along the wall tangent
      // and tree +Z along the cavity-facing normal, then crush Z to a genuine
      // film. This retains the branch silhouette across a wide swath without
      // inventing free-standing museum-scale Mn crystals.
      let tx = -p.nz, ty = 0, tz = p.nx;
      let tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tl < 1e-6) { tx = 1; ty = 0; tz = 0; tl = 1; }
      tx /= tl; ty /= tl; tz /= tl;
      const spin = h * Math.PI * 1.2 - Math.PI * 0.6;
      const bx = p.ny * tz - p.nz * ty;
      const by = p.nz * tx - p.nx * tz;
      const bz = p.nx * ty - p.ny * tx;
      axis.set(
        tx * Math.cos(spin) + bx * Math.sin(spin),
        ty * Math.cos(spin) + by * Math.sin(spin),
        tz * Math.cos(spin) + bz * Math.sin(spin),
      ).normalize();
      normal.set(p.nx, p.ny, p.nz).normalize();
      lateral.crossVectors(axis, normal).normalize();
      basis.makeBasis(lateral, axis, normal);
      dummy.quaternion.setFromRotationMatrix(basis);
      const length = Math.max(0.65, Math.min(3.2, patchRadius * (1.0 + h * 0.6)));
      const filmRelief = Math.max(0.035, Math.min(0.10, displayThickness));
      dummy.position.set(
        contactBase[0] + p.nx * (underburdenDisplayMm + filmRelief * 0.5),
        contactBase[1] + p.ny * (underburdenDisplayMm + filmRelief * 0.5),
        contactBase[2] + p.nz * (underburdenDisplayMm + filmRelief * 0.5),
      );
      dummy.scale.set(length * 0.58, length, filmRelief);
    } else if (record.regime === 'fibrous_mat') {
      // Slip-/felt-fibre representation: lay each bundle in the local tangent
      // plane instead of making a forest of needles normal to the wall.
      let tx = -p.nz, ty = 0, tz = p.nx;
      let tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tl < 1e-6) { tx = 1; ty = 0; tz = 0; tl = 1; }
      tx /= tl; ty /= tl; tz /= tl;
      const bx = p.ny * tz - p.nz * ty;
      const by = p.nz * tx - p.nx * tz;
      const bz = p.nx * ty - p.ny * tx;
      const spin = h * Math.PI * 0.7 - Math.PI * 0.35;
      axis.set(tx * Math.cos(spin) + bx * Math.sin(spin),
        ty * Math.cos(spin) + by * Math.sin(spin),
        tz * Math.cos(spin) + bz * Math.sin(spin)).normalize();
      const length = Math.max(0.45, Math.min(2.4, patchRadius * (0.8 + h * 0.5)));
      const width = Math.max(0.035, Math.min(0.11, length * 0.055));
      dummy.quaternion.setFromUnitVectors(up, axis);
      dummy.position.set(
        contactBase[0] + p.nx * (underburdenDisplayMm + width),
        contactBase[1] + p.ny * (underburdenDisplayMm + width),
        contactBase[2] + p.nz * (underburdenDisplayMm + width),
      );
      dummy.scale.set(width, length, width);
    } else {
      const lateral = patchRadius * 1.55, relief = displayThickness;
      axis.set(p.nx, p.ny, p.nz);
      dummy.quaternion.setFromUnitVectors(up, axis);
      dummy.position.set(
        contactBase[0] + p.nx * (underburdenDisplayMm + relief * 0.5),
        contactBase[1] + p.ny * (underburdenDisplayMm + relief * 0.5),
        contactBase[2] + p.nz * (underburdenDisplayMm + relief * 0.5),
      );
      dummy.scale.set(lateral, relief, lateral);
    }
    dummy.updateMatrix();
    swath.setMatrixAt(i, dummy.matrix);
  }
  swath.instanceMatrix.needsUpdate = true;
  if (typeof swath.computeBoundingSphere === 'function') swath.computeBoundingSphere();
  swath.renderOrder = 0.8
    + Math.min(0.1, Number(record.stratigraphic_index || 0) * 0.001);
  swath.userData = {
    surfaceGrowth: true,
    crystal_id: crystal.crystal_id,
    mineral: crystal.mineral,
    regime: record.regime,
    coverage_fraction: coverage,
    physical_mean_thickness_um: record.mean_thickness_um,
    representative_only: true,
    area_basis: record.area_basis,
    stratigraphic_index: record.stratigraphic_index,
    representation: 'instanced-swath',
  };
  _topoLightingTagMesh(swath, true);
  state.crystals.add(swath);
  // Canonical desktop-density relief is intentionally independent of mobile
  // LOD; subsequent layers therefore sit on the same depicted substrate on
  // every viewport even when this layer uses fewer representatives.
  const canonicalDisplayThickness = Math.max(0.06, Math.min(canonicalPatchRadius * 0.45,
    trueThicknessMm > 0 ? Math.max(trueThicknessMm, 0.06) : 0.06));
  const representativeRelief = record.regime === 'euhedral_druse'
      ? Math.max(0.24, Math.min(1.6, canonicalPatchRadius * 0.39))
      : record.regime === 'fibrous_mat'
        ? Math.max(0.035, Math.min(0.11, canonicalPatchRadius * 0.055))
        : record.regime === 'dendritic_film'
          ? Math.max(0.035, Math.min(0.10, canonicalDisplayThickness))
        : canonicalDisplayThickness;
  const layer = {
    crystal_id: crystal.crystal_id,
    source_signature: exactPatch?.source_signature || null,
    triangle_indices: new Set(exactPatch && exactPatch.triangle_indices
      ? exactPatch.triangle_indices : []),
    triangle_keys: new Set(exactPatch && exactPatch.triangle_indices
      ? exactPatch.triangle_indices.map((triangleIndex: number) =>
        `${exactPatch.source_signature}:${triangleIndex}`) : []),
    representative_relief_mm: representativeRelief,
  };
  swath.userData.representative_relief_mm = representativeRelief;
  swath.userData.triangle_indices = Array.from(layer.triangle_indices);
  swath.userData.source_signature = layer.source_signature;
  earlierLayers.push(layer);
  return swath;
}

function _emitClusterSatellites(
  state: any, crystal: any, geom: any, mat: any,
  ax: number, ay: number, az: number,
  nx: number, ny: number, nz: number,
  parentCLen: number, parentAWid: number,
  geomToken: string,
  wall: any, ringCount: number, N: number, initR: number,
  // W-F O0: the parent's attachment fraction. Satellites share the parent's
  // GEOM — for a half-form (clipped) geom the scar cap sits at the mesh
  // origin, so the satellite offset must sink by the same fraction or the
  // cap floats visibly above the wall. 0 / undefined = legacy base-at-anchor.
  parentOccF?: number,
  parentMesh?: any,
) {
  const pattern = _CLUSTER_PATTERNS[geomToken] || _CLUSTER_PATTERN_DEFAULT;
  const bladeSpray = !!parentMesh && (geom.userData.bladeRhombR4?.mineral === 'selenite'
    || geom.userData.bladeRhombR4?.mineral === 'gypsum');
  const count = _clusterSatelliteCount(crystal, pattern, parentCLen);
  const bariteCrest = !!parentMesh && geom.userData.bariteR4?.habit === 'cockscomb';
  const n = bladeSpray && count > 0 ? Math.min(9, count + 2) : bariteCrest && count > 0 ? Math.min(7, Math.max(5, count)) : count;
  if (n === 0) return;
  const rand = _clusterRand((crystal.crystal_id || 0) * 0x9E3779B9 + 0x12345);
  // Build an orthonormal tangent frame perpendicular to the substrate
  // normal — used to spread satellites in a chord direction, then
  // re-projected back onto the curved wall (see below).
  const refUp = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let t1x = refUp[1] * nz - refUp[2] * ny;
  let t1y = refUp[2] * nx - refUp[0] * nz;
  let t1z = refUp[0] * ny - refUp[1] * nx;
  const t1len = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1;
  t1x /= t1len; t1y /= t1len; t1z /= t1len;
  const t2x = ny * t1z - nz * t1y;
  const t2y = nz * t1x - nx * t1z;
  const t2z = nx * t1y - ny * t1x;
  // Spread of cluster satellites around the parent anchor — chord-
  // distance bound. The chord is then re-projected onto the cavity
  // wall, so what this really controls is angular spread: 0.4 × R
  // chord ≈ ±22° around the parent on the sphere. That keeps clusters
  // tight while letting the wall do the wrapping.
  const cavityRadius = state.clipUniforms?.uVugRadius?.value ?? Infinity;
  const spreadCap = Number.isFinite(cavityRadius) ? cavityRadius * 0.4 : Infinity;
  const spread = Math.min(parentAWid * 1.5 * pattern.spreadMul, spreadCap);
  const scaleSpan = pattern.scaleMax - pattern.scaleMin;
  const tiltSpan = pattern.tiltMax * 2;  // span around 0 (i.e. ±tiltMax)
  const upVec = new THREE.Vector3(0, 1, 0);
  const targetVec = new THREE.Vector3();
  const wallProjOk = !!(wall && wall.rings && ringCount > 0 && N > 0);
  let gypsumRootMaterial: any = null;
  for (let i = 0; i < n; i++) {
    const r = (0.5 + 0.5 * rand()) * spread;
    // Even angular spacing for rosette habits, random for everything else.
    const angle = pattern.evenAngles
      ? (i / n) * Math.PI * 2 + rand() * 0.3
      : rand() * Math.PI * 2;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    // Chord-direction offset (flat tangent plane). On a curved cavity
    // this point sits at distance √(R² + r²) > R — past the wall, into
    // the host rock. Boss-spotted: the cluster spread should follow
    // the curve, not plane off it. Re-project onto the actual wall by
    // taking the chord point's angular direction, looking up the cell
    // that lives in that direction, and using its (base + wall_depth)
    // × polar as the satellite's anchor radius. Each satellite then
    // grows along its OWN local inward normal, so a cluster wraps
    // around the cavity instead of all sharing the parent's normal.
    let satAx = ax + r * (ca * t1x + sa * t2x);
    let satAy = ay + r * (ca * t1y + sa * t2y);
    let satAz = az + r * (ca * t1z + sa * t2z);
    let satNx = nx, satNy = ny, satNz = nz;
    if (wallProjOk) {
      const offDist = Math.sqrt(satAx * satAx + satAy * satAy + satAz * satAz) || 1;
      const dirX = satAx / offDist;
      const dirY = satAy / offDist;
      const dirZ = satAz / offDist;
      // Cavity build (line ~352): y = -radius × cos(phi). So phi = acos(-dirY).
      const cosPhiCav = Math.max(-1, Math.min(1, -dirY));
      const phiCav = Math.acos(cosPhiCav);
      // Cavity build: phi = PI × (r + 0.5) / ringCount → r = phi*ringCount/PI − 0.5.
      const ringIdxF = (phiCav / Math.PI) * ringCount - 0.5;
      const satRingIdx = Math.max(0, Math.min(ringCount - 1, Math.round(ringIdxF)));
      const polarFac = wall.polarProfileFactor ? wall.polarProfileFactor(phiCav) : 1.0;
      const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phiCav) : 0.0;
      let theta = Math.atan2(dirZ, dirX) - twist;
      while (theta < 0) theta += 2 * Math.PI;
      while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;
      const satCellIdx = Math.min(N - 1, Math.max(0, Math.floor((theta / (2 * Math.PI)) * N)));
      const ringRow = wall.rings[satRingIdx];
      const satCell = ringRow ? ringRow[satCellIdx] : null;
      const baseR = (satCell && satCell.base_radius_mm > 0) ? satCell.base_radius_mm : initR;
      const depthAt = satCell ? satCell.wall_depth : 0;
      const wallRadius = (baseR + depthAt) * polarFac;
      satAx = wallRadius * dirX;
      satAy = wallRadius * dirY;
      satAz = wallRadius * dirZ;
      satNx = -dirX;
      satNy = -dirY;
      satNz = -dirZ;
    }
    const spray = bladeSpray ? gypsumSprayMember(crystal.crystal_id || 0, i) : null;
    const crest = bariteCrest ? bariteCrestMember(crystal.crystal_id || 0, i, n) : null;
    const sScale = crest ? crest.scale : spray ? (spray.basal ? 0.20 + spray.group * 0.015 : spray.scale) : pattern.scaleMin + scaleSpan * rand();
    const sCLen = parentCLen * sScale;
    const sAWid = parentAWid * sScale;
    // Tilt off the satellite's OWN local normal — magnitude per-habit.
    // For rosettes the tilt direction is the OUTWARD radial (petals
    // open outward); for everything else the tilt axis is randomized
    // so the spray looks irregular rather than synchronized.
    const tiltAngle = (rand() - 0.5) * tiltSpan;
    const tiltAxisAngle = pattern.evenAngles
      ? angle + Math.PI / 2     // rosette: tilt axis perpendicular to radial direction
      : rand() * Math.PI * 2;

    const tax = Math.cos(tiltAxisAngle) * t1x + Math.sin(tiltAxisAngle) * t2x;
    const tay = Math.cos(tiltAxisAngle) * t1y + Math.sin(tiltAxisAngle) * t2y;
    const taz = Math.cos(tiltAxisAngle) * t1z + Math.sin(tiltAxisAngle) * t2z;
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
    // PROPOSAL-HABIT-BIAS Slice 3: gravity-bias propagates to cluster
    // satellites. Resolve each satellite's intended c-axis through
    // _topoCAxisForCrystal using its OWN re-projected substrate
    // normal — for an air-mode parent, ceiling-band satellites get
    // (0, -1, 0) and floor-band satellites get (0, 1, 0); wall-band
    // and fluid-mode satellites keep their substrate normal. Per-
    // satellite resolution (not parent inheritance) is what handles
    // the "spread across a curved ceiling" case correctly: a cluster
    // with a parent at the apex may have satellites spilling onto
    // upper-wall cells where ny ∈ (-0.4, 0), and those should stay
    // radial rather than snapping to gravity-down.
    const [baseNx, baseNy, baseNz] = _topoCAxisForCrystal(crystal, satNx, satNy, satNz);
    const kDotN = tax * baseNx + tay * baseNy + taz * baseNz;
    // Rodrigues' rotation formula — rotate the satellite's gravity-
    // resolved c-axis around the tilt axis. For air-mode crystals
    // this means a stalactite cluster has each child hanging slightly
    // tilted off vertical (the same way fluid-mode children tilt off
    // the substrate normal); for fluid-mode crystals this collapses
    // to the legacy behavior since _topoCAxisForCrystal is the
    // identity on (satNx, satNy, satNz).
    let sNx = baseNx * cosT + (tay * baseNz - taz * baseNy) * sinT + tax * kDotN * (1 - cosT);
    let sNy = baseNy * cosT + (taz * baseNx - tax * baseNz) * sinT + tay * kDotN * (1 - cosT);
    let sNz = baseNz * cosT + (tax * baseNy - tay * baseNx) * sinT + taz * kDotN * (1 - cosT);
    const nLen = Math.sqrt(sNx * sNx + sNy * sNy + sNz * sNz) || 1;
    sNx /= nLen; sNy /= nLen; sNz /= nLen;
    const sOffset = sCLen * (0.5 - (spray ? spray.burial : (parentOccF || 0)));   // W-F O0 — see param doc
    let satelliteGeom = geom;
    if (spray) {
      const info = geom.userData.bladeRhombR4;
      const ratio = Math.round(info.widthRatio * (spray.basal ? 1 : spray.width) * 40) / 40;
      const development = spray.basal ? 3 : 1.5;
      spray.burial = Math.round(spray.burial * 20) / 20;
      const key = '__blade_rhomb_r4_' + info.mineral + '_' + info.token + '_' + ratio + '_' + spray.burial + '_' + development + '_' + spray.endBias;
      satelliteGeom = state.geomCache.get(key);
      if (!satelliteGeom) {
        satelliteGeom = makeBladeRhombRenderGeometry(info.mineral, info.token, ratio, spray.burial, development, spray.endBias) || geom;
        state.geomCache.set(key, satelliteGeom);
      }
    }
    const satMesh = new THREE.Mesh(satelliteGeom, mat);
    if (spray?.basal) {
      // A cloudy intergrown base gives the clear blades a common optical body.
      // Representative display cloudiness/staining, not a new mineral deposit.
      if (!gypsumRootMaterial) {
        gypsumRootMaterial = mat.clone();
        const body = new THREE.Color('#d8c9ae');
        const p = gypsumRootMaterial.userData.optics;
        if (p) {
          Object.assign(p, { clarity: 0, transmissive: false, transmission: 0, alpha_opacity: 1, body: body.getHex() });
          _opticsPaintTier(gypsumRootMaterial, p, body);
        }
        gypsumRootMaterial.roughness = 0.45;
        _applyCavityClip(gypsumRootMaterial, state.clipUniforms);
        applyGypsumCleavage(gypsumRootMaterial);
      }
      satMesh.material = gypsumRootMaterial;
    }
    if (geomToken === 'cube' || geomToken === 'octahedron' || geomToken === 'tetrahedron' || geomToken === 'rhombic_dodec' || geomToken === 'dodecahedron' || geomToken === 'snowball') {
      satMesh.scale.set(sCLen, sCLen, sCLen);
    } else if (geomToken === 'scalene') {
      // Same display-width cap as the parent-mesh 'scalene' scale branch
      // (2026-07-24): sAWid derives from the parent's volume-derived
      // a_width_mm, which reads a≈c on mature calcite — without the cap
      // the cluster's teeth render as even-square gems around a properly
      // toothed parent.
      const sATooth = Math.min(sAWid, sCLen * _GEOM_TOKEN_RATIO.scalene);
      satMesh.scale.set(sATooth, sCLen, sATooth);
    } else {
      // R4 geometry already contains quartz's aspect and fixed face angles.
      // Satellites must preserve the parent's uniform-scale contract too.
      if (geom.userData.quartzR4 || geom.userData.bladeRhombR4 || geom.userData.bariteR4) satMesh.scale.setScalar(sCLen);
      else satMesh.scale.set(sAWid, sCLen, sAWid);
    }
    satMesh.position.set(
      satAx + sNx * sOffset,
      satAy + sNy * sOffset,
      satAz + sNz * sOffset,
    );
    targetVec.set(sNx, sNy, sNz);
    satMesh.quaternion.setFromUnitVectors(upVec, targetVec);
    // Per-satellite yaw around c-axis — drawn from the same cluster
    // PRNG so each satellite gets a distinct rotation around its own
    // local +Y (world-space substrate normal).
    satMesh.rotateY(rand() * Math.PI * 2);
    if (spray) {
      // These are representative members of the existing display cluster, not
      // new simulation crystals or invented twin laws. Small related groups
      // cross in depth, with overlapping roots sunk into the same matrix patch.
      const substrate = new THREE.Vector3(nx, ny, nz).normalize();
      const radial = new THREE.Vector3(t1x, t1y, t1z).multiplyScalar(Math.cos(spray.azimuth))
        .addScaledVector(new THREE.Vector3(t2x, t2y, t2z), Math.sin(spray.azimuth));
      const axis = substrate.clone().multiplyScalar(Math.cos(spray.tilt)).addScaledVector(radial, Math.sin(spray.tilt)).normalize();
      // Retain a related cleavage orientation while c axes radiate in 3-D.
      // Independent roll made every peripheral blade edge-on in the hero view.
      const face = new THREE.Vector3(0, 0, 1).applyQuaternion(parentMesh.quaternion);
      face.addScaledVector(axis, -face.dot(axis));
      if (face.lengthSq() < 1e-6) face.set(1, 0, 0).applyQuaternion(parentMesh.quaternion).cross(axis);
      face.normalize().applyAxisAngle(axis, [0, 0.65, -0.70][spray.group] + (spray.basal ? 0 : (i % 2) * 0.65));
      const cross = axis.clone().cross(face).normalize();
      satMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross, axis, face));
      const root = new THREE.Vector3(...spray.root).multiplyScalar(parentCLen).applyQuaternion(parentMesh.quaternion);
      if (!spray.basal) {
        // Cross through the parent's body, rather than meeting tip-to-root
        // at a common foot. The proximal part remains behind the intersection.
        root.multiplyScalar(0.12)
          .add(new THREE.Vector3(0, (i % 2 ? 0.38 : 0.22) * parentCLen, 0).applyQuaternion(parentMesh.quaternion))
          .addScaledVector(axis, -Math.min(0.12 * parentCLen, sCLen * (1 - spray.burial) * 0.45));
      }
      satMesh.position.set(ax, ay, az).add(root).addScaledVector(axis, sCLen * (0.5 - spray.burial));
    }
    if (crest) {
      // A crested row of overlapping plates, not a radial selenite spray.
      // The habit record supplies the crest; no formal twin law is invented.
      satMesh.quaternion.copy(parentMesh.quaternion);
      satMesh.rotateZ(crest.lean); satMesh.rotateY(crest.roll);
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(satMesh.quaternion);
      const root = new THREE.Vector3(crest.x, crest.y, 0).multiplyScalar(parentCLen).applyQuaternion(parentMesh.quaternion);
      satMesh.position.set(ax, ay, az).add(root).addScaledVector(axis, sCLen * (0.5 - (parentOccF || 0)));
    }
    // Inherit parent userData so raycaster hit-test resolves a satellite
    // hit back to the parent crystal — clicking a satellite tooltips
    // the parent mineral, no per-satellite identity surfaced.
    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the only
    // positional field on Crystal; legacy fields retired.
    const _address = wall?.chemistryAddressForCrystal?.(crystal)
      || { ringIdx: 0, cellIdx: 0 };
    satMesh.userData = {
      crystal_id: crystal.crystal_id,
      mineral: crystal.mineral,
      ringIdx: _address.ringIdx,
      cellIdx: _address.cellIdx,
      surfaceAnchorKey: wall?.surfaceAnchorKey?.(crystal),
      isSatellite: true,
      ...(spray ? { bladeSpray: true, sprayGroup: spray.group } : {}),
      ...(crest ? { bariteCrest: true } : {}),
      ...(spray?.basal && i === 6 ? { ownsSatelliteMaterial: true } : {}),
      // === HELIX-OVERLAY-FORK ADDITION (v13) =========================
      // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
      // breadcrumb. Satellites share the parent's material reference,
      // so the parent's opacity write also moves the satellites. The
      // naturalOpacity here is for completeness; the helix update
      // iterates parents only.
      naturalOpacity: satMesh.material.transparent ? satMesh.material.opacity : 1.0,
      // === END HELIX-OVERLAY-FORK ADDITION ===========================
    };
    satMesh.renderOrder = 1;
    _topoLightingTagMesh(satMesh, true);
    state.crystals.add(satMesh);
  }
}

// Convert a #RRGGBB or rgb(...) string to THREE.Color. Falls back to
// the bare-wall amber so unknown minerals don't render as black.
// ============================================================
// OPTICS Depth-A — the ONE crystal-material builder (the STANDING GOAL's
// first consuming rung; design + verified data: proposals/RESEARCH-
// optical-realism-2026-07-02.md §4). Diaphaneity → plain % translucency,
// the boss's fixed decision: opacity = 1 − SPAN·clarity (clarity 1 →
// 0.30, water-clear but present; clarity 0 → the exact opaque pipeline
// this replaced, transparent flag off). transmission stays 0 — NO faked
// refraction ever without a new decision. clarity comes from the
// per-mineral optics block (data/minerals.json — 47 verified species
// after research batches 1-2, more en route) else the class default.
// Lustre is IN the data but NOT consumed (Depth-B); metalness/roughness
// keep the class heuristics so the opaque path is bit-stable.
// MeshPhysicalMaterial (the named builder): a strict superset of
// Standard at transmission 0, so Depth-B lustre (clearcoat, sheen)
// lands in the same object without a second migration.
// _applyCavityClip's chunk anchors (#include <common> / begin_vertex /
// void main) exist identically in the physical shaders.
const OPTICS_TRANSLUCENCY_SPAN = 0.70;
// Class-default clarity for species WITHOUT a verified optics block —
// the safety net for the never-showcased tail + future species (every
// scenario-expected species is getting a verified row; tools/
// optics-audit.mjs exposes every resolved value for opportunistic
// verification). Values lean on the verified table's class means;
// bimodal classes (sulfide carries both galena 0 and sphalerite 0.40)
// default to their OPAQUE-majority end because the translucent members
// are exactly the famous ones that carry verified rows.
const _OPTICS_CLASS_CLARITY: Record<string, number> = {
  sulfide: 0.0, native: 0.0,               // metallic-opaque majorities
  oxide: 0.10, hydroxide: 0.10,            // dark-translucent lean (Fe oxides verified 0 individually)
  amphibole: 0.30,                          // fibrous/bladed aggregates
  silicate: 0.45,
  arsenate: 0.45, phosphate: 0.45, molybdate: 0.45,
  carbonate: 0.55, sulfate: 0.55,
  halide: 0.60, borate: 0.60,
};
function opticsClarityFor(spec: any): number {
  if (spec && spec.optics && typeof spec.optics.clarity === 'number') {
    return Math.max(0, Math.min(1, spec.optics.clarity));
  }
  const d = spec ? _OPTICS_CLASS_CLARITY[spec.class] : undefined;
  return typeof d === 'number' ? d : 0.35;  // unknown class: cautious translucent lean
}
// The single assembly point for every crystal mesh material. Everything
// the old inline block did (class_color, class metalness/roughness, the
// CDR-porosity/etched/perimorph/sector-zoned/hourglass state modifiers)
// plus the Depth-A translucency. State modifiers also DAMP clarity —
// a corroded or porous surface scatters (physically right, and it keeps
// the etched read distinct from the pristine one):
//   etched ×0.35 · CDR pseudomorph ×0.5 · hourglass min(·,0.30) (the
//   retired 0.82 magic number lives HERE now: 1−0.70·0.30 ≈ 0.79, the
//   shipped inclusion-sandglass legibility — while pristine selenite is
//   free to read water-clear, the goal's named fix).
// Perimorph casts keep their shipped 0.42 ceiling (hollow-shell read).
// depthWrite stays at the default TRUE for every opacity — the helix
// overlay's restore path (js/99j _helixRestoreCrystalOpacity) imposes
// exactly that on all crystal materials whenever it runs (incl. at
// init), and it was the shipped behavior for the perimorph/hourglass
// transparents; one policy, no divergence. Accept minor blend-order
// softness in deep druses (doc §4.2 mitigation note updated).
// LOCAL CRYSTAL COLOUR (2026-07-07, boss queued: "local color for crystals,
// that will resolve your concern about minerals that share space blending
// together invisibly"). Two honest layers on top of spec.class_color, so
// same-species neighbours and translucent overlaps read as SEPARATE individuals:
//
//   (1) CHEMISTRY — bedrock, generically true. A crystal's growth-weighted
//       chromophore trace load (Fe/Mn/Ti, normalized by the fleet's own q90 —
//       tools/localcolor-signal-probe.mjs) DEEPENS its colour (lightness down,
//       saturation up) via a saturating tanh. Higher-impurity crystals read
//       deeper; a pure one reads paler/clearer. NO mineral-specific HUE claim —
//       that (Mn→pink calcite, Fe→amber sphalerite) is Depth-C / D1's job, boss-
//       gated; this tone modulation composes UNDER it when D1 lands. The probe
//       showed chemistry mostly separates SPECIES/scenarios, not same-broth
//       neighbours (they share the broth) — so:
//   (2) LEGIBILITY FLOOR — a small DETERMINISTIC per-crystal_id hue+value jitter
//       (two low-discrepancy hashes, RNG-free) guarantees the boss's GOAL for the
//       trace-free / flat-broth majority (halite cubes, galena, barite). This is
//       the "later layer" the bedrock-over-effect-hacks rule sanctions — a
//       legibility aid, explicitly NOT a chemistry claim. Field-guide subtle.
//
// Render-only (only matOpts.color), reads zones + id, RNG-free → byte-identical.
// Chemistry-driven NEIGHBOUR separation (traces from the local depleting cell) is
// the pre-registered B4 upgrade (solid-solution trace partitioning).
const LOCAL_COLOR = {
  REF_FE: 3.6, REF_MN: 1.75, REF_TI: 1.24,   // fleet q90 trace levels (ppm) — the tint reference
  CHEM_K: 0.7, CHEM_DARKEN: 0.13, CHEM_SAT: 0.10,   // field-guide restraint: even q99-trace crystals stay subtle
  FLOOR_HUE: 0.04, FLOOR_SAT: 0.12, FLOOR_VAL: 0.13,  // ±0.02 hue / ±0.06 sat / ±0.065 value — 3-axis so
                                                       // worst-case neighbour separation stays up without any
                                                       // single axis reading garish (per-axis stays subtle)
};
function _localCrystalColor(crystal: any, spec: any): any {
  // D1a — the BASE hue is now the color_rules-resolved real body colour
  // (js/12a resolveBodyColour), not the class-taxonomy class_color. Falls back
  // to class_color for anything unresolved. The chemistry tone + legibility
  // floor below compose OVER it, unchanged.
  const base = _topoParseColor(resolveBodyColour(crystal, spec));
  const hsl: any = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  // (1) chemistry — growth-weighted chromophore trace load → tone deepening
  let feG = 0, mnG = 0, tiG = 0, G = 0;
  for (const z of (crystal.zones || [])) {
    const w = z.thickness_um;
    if (!(w > 0)) continue;
    feG += (z.trace_Fe || 0) * w; mnG += (z.trace_Mn || 0) * w; tiG += (z.trace_Ti || 0) * w; G += w;
  }
  if (G > 0) {
    const load = (feG / G) / LOCAL_COLOR.REF_FE + (mnG / G) / LOCAL_COLOR.REF_MN + (tiG / G) / LOCAL_COLOR.REF_TI;
    const chem = Math.tanh(LOCAL_COLOR.CHEM_K * load);
    hsl.l = Math.max(0, hsl.l - LOCAL_COLOR.CHEM_DARKEN * chem);
    hsl.s = Math.min(1, hsl.s + LOCAL_COLOR.CHEM_SAT * chem);
  }
  // (2) legibility floor — deterministic per-id micro-jitter across 3 axes
  // (hue, saturation, value) from three low-discrepancy hashes, so two
  // same-broth neighbours rarely collide on all three at once.
  const id = crystal && crystal.crystal_id ? crystal.crystal_id : 0;
  const h1 = ((id * 0.6180339887498949) % 1 + 1) % 1;   // golden-ratio conjugate
  const h2 = ((id * 0.7548776662466927) % 1 + 1) % 1;   // second low-discrepancy constant
  const h3 = ((id * 0.5698402909980532) % 1 + 1) % 1;   // third (plastic-number related)
  hsl.h = ((hsl.h + (h1 - 0.5) * LOCAL_COLOR.FLOOR_HUE) % 1 + 1) % 1;
  hsl.s = Math.max(0, Math.min(1, hsl.s + (h3 - 0.5) * LOCAL_COLOR.FLOOR_SAT));
  hsl.l = Math.max(0.03, Math.min(0.97, hsl.l + (h2 - 0.5) * LOCAL_COLOR.FLOOR_VAL));
  const out = new THREE.Color();
  out.setHSL(hsl.h, hsl.s, hsl.l);
  return out;
}

// ============================================================
// OPTICS R2 — materials that behave like minerals (2026-09-06; the visual-realism
// review's D1 TRANSMISSION + D2 LUSTRE decisions, PROPOSAL-HOSTILE-REVIEW-VISUAL-
// REALISM-2026-09-04.md §10). Supersedes Depth-A's "transmission stays 0 — NO faked
// refraction ever without a new decision" (RESEARCH-optical-realism-2026-07-02.md §4.3):
// the decision was taken, and what ships is not faked — it IS refraction, with the
// species' measured mean refractive index and Beer–Lambert body colour over the
// crystal's own rendered thickness.
//
// Two tiers, one builder:
//   'transmission' — MeshPhysicalMaterial.transmission for every species whose verified
//                    clarity exceeds OPTICS_TRANSMISSION_MIN_CLARITY: `ior` = optics.ior
//                    (data/minerals.json, the mean principal index; verified against
//                    webmineral's Optical Data line by tools/optics-ior-verify.mjs),
//                    `thickness` and `attenuationDistance` from the mesh's own extent
//                    (_opticsApplyExtent, after the scale is known), `attenuationColor` =
//                    the body colour, opacity 1, depth write ON — the alpha ghost's paper
//                    cut-outs (finding F5) are gone, and a species that is opaque in hand
//                    specimen (malachite 0.08) no longer ghosts at 94 % alpha.
//   'alpha'        — Depth-A's plain % translucency, opacity = 1 − 0.70·clarity, the exact
//                    2026-07-02 contract; the LOW-PERFORMANCE fallback: mobile by default
//                    (OPTICS_MOBILE_TIER), the lighting rig's own fallback, and the landing
//                    of the frame-time step-down gate (_topoLightingNoteRenderTime).
// Lustre (optics.lustre, 95 verified species, recorded 2026-07-02 and consumed HERE):
// OPTICS_LUSTRE_TABLE maps each term to roughness / metalness / specular — metallic
// species take metalness 1 so their own body colour becomes F0 (galena lead-grey, pyrite
// pale brass, chalcopyrite gold — the 2026-07-07 colour lexicon supplies the hue);
// dielectrics take their F0 from the IOR through material.ior (adamantine cerussite at
// n 1.98 reflects 11 %, vitreous quartz at 1.55 reflects 4.6 %); pearly adds sheen and a
// thin clearcoat; dull/earthy are rough with damped specular. The FIRST listed term is the
// characteristic one (chalcedony "waxy, dull, vitreous" is waxy). Class fallbacks cover the
// 89 species without a block. Every material carries `userData.optics` — the resolved
// parameters — so the photo rig can receipt them and _topoOpticsApplyTier can move a
// live scene between tiers in place.
type _OpticsTier = 'transmission' | 'alpha';
interface _LustreParams { roughness: number; metalness: number; specular: number; sheen?: number; clearcoat?: number; }
const OPTICS_LUSTRE_TABLE: Record<string, _LustreParams> = {
  metallic:      { roughness: 0.28, metalness: 1.0, specular: 1.0 },
  submetallic:   { roughness: 0.42, metalness: 0.6, specular: 1.0 },
  adamantine:    { roughness: 0.06, metalness: 0.0, specular: 1.0 },
  subadamantine: { roughness: 0.10, metalness: 0.0, specular: 1.0 },
  vitreous:      { roughness: 0.09, metalness: 0.0, specular: 1.0 },
  subvitreous:   { roughness: 0.15, metalness: 0.0, specular: 1.0 },
  resinous:      { roughness: 0.22, metalness: 0.0, specular: 1.0 },
  subresinous:   { roughness: 0.28, metalness: 0.0, specular: 0.9 },
  greasy:        { roughness: 0.30, metalness: 0.0, specular: 0.8 },
  waxy:          { roughness: 0.38, metalness: 0.0, specular: 0.7 },
  silky:         { roughness: 0.45, metalness: 0.0, specular: 0.8, sheen: 0.5 },
  pearly:        { roughness: 0.20, metalness: 0.0, specular: 0.9, sheen: 0.8, clearcoat: 0.3 },
  dull:          { roughness: 0.85, metalness: 0.0, specular: 0.4 },
  earthy:        { roughness: 0.95, metalness: 0.0, specular: 0.2 },
};
// Class-default lustre for the 89 species without a verified block — the class's
// opaque-majority end for sulfide/native (the translucent sulfides carry verified rows).
const OPTICS_CLASS_LUSTRE: Record<string, string> = {
  sulfide: 'metallic', native: 'metallic', oxide: 'submetallic', hydroxide: 'submetallic',
  silicate: 'vitreous', carbonate: 'vitreous', sulfate: 'vitreous', halide: 'vitreous',
  borate: 'vitreous', phosphate: 'vitreous', arsenate: 'vitreous', molybdate: 'adamantine',
  amphibole: 'vitreous',
};
// Class-default mean refractive index (Handbook-of-Mineralogy class ranges, the tail's
// safety net — every transmissive species with a verified block carries its own ior).
const OPTICS_CLASS_IOR: Record<string, number> = {
  silicate: 1.55, carbonate: 1.62, sulfate: 1.60, halide: 1.50, borate: 1.47,
  phosphate: 1.65, arsenate: 1.72, molybdate: 1.95, oxide: 2.10, hydroxide: 2.20,
  sulfide: 2.50, native: 2.00, amphibole: 1.63,
};
const OPTICS_IOR_DEFAULT = 1.55;
const OPTICS_TRANSMISSION_MIN_CLARITY = 0.15;   // ≤ this the species is opaque in hand specimen: no ghost
const OPTICS_TRANSMISSION_FLOOR = 0.35;          // transmission = FLOOR + (1 − FLOOR)·clarity
const OPTICS_ATTENUATION_BASE = 0.6;             // attenuationDistance = extent·(BASE + SPAN·clarity):
const OPTICS_ATTENUATION_SPAN = 1.4;             //   cloudy → body-coloured within its own thickness; water-clear → barely tinted
const OPTICS_THICKNESS_FRACTION = 0.9;           // thickness = 0.9 × the mesh's smallest scaled extent
const OPTICS_BODY_TINT_ON_COLOUR = 0.35;         // transmissive base colour = white → body by 0.35·(1 − clarity); the rest rides as attenuation
const OPTICS_MOBILE_TIER: _OpticsTier = 'alpha';
// Metallic lustre: F0 IS the species' reflectance at normal incidence, so the metal's base
// colour is the lexicon's hue scaled to the MEASURED reflectance (optics.reflectance, per
// cent, R at 589 nm in air — the Handbook of Mineralogy R tables, verified by
// tools/optics-reflectance-verify.mjs). A hand-specimen swatch is dark because a metal
// mirrors a dark surround; using it as F0 counts that darkness twice (galena swatch
// luminance 0.18 vs R 43 %). Class defaults cover the tail.
const OPTICS_CLASS_REFLECTANCE: Record<string, number> = { sulfide: 40, native: 60, oxide: 20, hydroxide: 20 };
const OPTICS_REFLECTANCE_DEFAULT = 40;
function opticsReflectanceFor(spec: any): number {
  if (spec && spec.optics && typeof spec.optics.reflectance === 'number') {
    return Math.max(0.03, Math.min(1, spec.optics.reflectance / 100));
  }
  const d = spec ? OPTICS_CLASS_REFLECTANCE[spec.class] : undefined;
  return (typeof d === 'number' ? d : OPTICS_REFLECTANCE_DEFAULT) / 100;
}
function _opticsMetalColour(body: any, reflectance: number): any {
  const out = body.clone();
  const y = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b;   // linear luminance
  const k = reflectance / Math.max(1e-4, y);
  out.r = Math.min(1, out.r * k); out.g = Math.min(1, out.g * k); out.b = Math.min(1, out.b * k);
  return out;
}

function opticsIorFor(spec: any): number {
  if (spec && spec.optics && typeof spec.optics.ior === 'number') {
    return Math.max(1.0, Math.min(3.5, spec.optics.ior));
  }
  const d = spec ? OPTICS_CLASS_IOR[spec.class] : undefined;
  return typeof d === 'number' ? d : OPTICS_IOR_DEFAULT;
}
function opticsLustreFor(spec: any): string {
  const terms = spec && spec.optics && spec.optics.lustre;
  if (Array.isArray(terms)) for (const t of terms) if (OPTICS_LUSTRE_TABLE[t]) return t;
  const d = spec ? OPTICS_CLASS_LUSTRE[spec.class] : undefined;
  return d && OPTICS_LUSTRE_TABLE[d] ? d : 'vitreous';
}
// The PURE resolution — no THREE — so tools/optics-audit.mjs and the tests read exactly
// what the renderer will build. `f` carries the state modifiers (etched, CDR, perimorph
// cast, sector-zoned, gypsum hourglass, inclusion) as before; they stack in the same order.
function opticsMaterialParamsFor(spec: any, f: any, tier: _OpticsTier): any {
  const fl = f || {};
  const lustre = opticsLustreFor(spec);
  const L = OPTICS_LUSTRE_TABLE[lustre];
  let roughness = L.roughness, metalness = L.metalness;
  // Q3a porosity boost for CDR pseudomorphs — Putnis 2009: CDR products are typically porous
  // (volume-mismatch accommodation). Boss directive 2026-05-06 #4: renderer-roughness is the
  // right fidelity level; the visual cue (less lustre, more matte) is what reads.
  if (fl.isCdrPseudomorph) roughness = Math.min(1.0, roughness + 0.18);
  // Etched crystal — a corroded/dissolved surface is matte, not lustrous (face-realism arc §2).
  if (fl.isEtched) roughness = Math.min(1.0, roughness + 0.30);
  // W-F O4a — an engulfed inclusion is a solid embedded grain: slightly matte (no free
  // euhedral face to take a polish) and OPAQUE, so it reads THROUGH the translucent host.
  if (fl.isInclusion) roughness = Math.min(1.0, roughness + 0.22);
  // Q4 perimorph cast — the hollow shell after dissolution: translucent + matte.
  if (fl.isPerimorphCast) { roughness = Math.min(1.0, roughness + 0.25); metalness = 0; }
  let clarity = opticsClarityFor(spec);
  if (fl.isEtched) clarity *= 0.35;
  if (fl.isCdrPseudomorph) clarity *= 0.5;
  if (fl.isGypsumHourglass) clarity = Math.min(clarity, 0.30);
  if (fl.isInclusion) clarity = 0;
  const alphaOpacity = 1 - OPTICS_TRANSLUCENCY_SPAN * clarity;
  const transmissive = tier === 'transmission' && !fl.isPerimorphCast
    && metalness < 0.5 && clarity > OPTICS_TRANSMISSION_MIN_CLARITY;
  return {
    tier, lustre, clarity, roughness, metalness,
    specular: L.specular, sheen: L.sheen || 0, clearcoat: L.clearcoat || 0,
    ior: opticsIorFor(spec),
    reflectance: opticsReflectanceFor(spec),
    transmissive,
    transmission: transmissive ? Math.min(1, OPTICS_TRANSMISSION_FLOOR + (1 - OPTICS_TRANSMISSION_FLOOR) * clarity) : 0,
    alpha_opacity: alphaOpacity,
    attenuation_span: OPTICS_ATTENUATION_BASE + OPTICS_ATTENUATION_SPAN * clarity,
    perimorph: !!fl.isPerimorphCast, sector: !!fl.isSectorZoned,
  };
}
function _topoOpticsTier(): _OpticsTier {
  const s = (typeof _topoThreeState !== 'undefined') ? _topoThreeState : null;
  const rig = s && s.opticsRig;
  return (rig && (rig.active || rig.tier)) || 'transmission';
}
// Paint the tier-dependent part of a material from its resolved params — used at build
// and by the in-place retier. `body` is the local crystal colour (THREE.Color).
function _opticsPaintTier(mat: any, p: any, body: any) {
  if (p.transmissive) {
    mat.transmission = p.transmission;
    mat.opacity = 1.0; mat.transparent = false; mat.depthWrite = true;
    mat.attenuationColor.copy(body);
    // Pale base: the body colour rides through the crystal as attenuation, not as a tint
    // painted on the surface (a dark surface colour would swallow the transmitted light).
    if (!p.sector) mat.color.setRGB(1, 1, 1).lerp(body, OPTICS_BODY_TINT_ON_COLOUR * (1 - p.clarity));
  } else {
    mat.transmission = 0;
    if (!p.sector) {
      if (p.metalness >= 0.5) mat.color.copy(_opticsMetalColour(body, p.reflectance));
      else mat.color.copy(body);
    }
    if (p.perimorph) {
      // Diaphaneity can only make the hollow shell MORE see-through, never less.
      mat.transparent = true; mat.opacity = Math.min(p.alpha_opacity, 0.42);
    } else if (p.tier === 'alpha' && p.clarity > 0) {
      mat.transparent = true; mat.opacity = p.alpha_opacity;
    } else {
      mat.transparent = false; mat.opacity = 1.0;
    }
    mat.depthWrite = !(mat.transparent && mat.userData.gypsumCleavage);
  }
}
// Called once the mesh's scale is known: thickness and attenuation distance are the
// crystal's own smallest rendered extent (mm) — a 0.5 mm barite plate stays clear, a 20 mm
// fluorite cube is body-coloured across its depth. Satellites share the parent's material
// (the parent's extent); swath clones get their instance footprint.
function _opticsApplyExtent(mat: any, extentMm: number) {
  const p = mat && mat.userData && mat.userData.optics;
  if (!p) return;
  const ext = Math.max(mat.userData.gypsumCleavage ? 0.005 : 0.2, Number(extentMm) || 0);
  p.extent_mm = ext;
  mat.thickness = ext * OPTICS_THICKNESS_FRACTION;
  mat.attenuationDistance = ext * p.attenuation_span;
}
function _opticsExtentOfScale(scale: any): number {
  if (!scale) return 1;
  return Math.max(0.2, Math.min(Math.abs(scale.x) || 1, Math.abs(scale.y) || 1, Math.abs(scale.z) || 1));
}
// Install the optics rig on a fresh Three state: desktop starts on transmission, mobile and
// a failed lighting rig start on alpha. `tier` is the CAPABILITY; `active` is what the scene
// is painted with right now — glass needs an opaque backdrop in three.js's transmission
// buffer (only opaque objects are drawn into it), so with the orb's translucent shell or a
// hidden wall the active tier drops to alpha and comes back when the wall is drawn opaque
// (inside the cavity; the R6 specimen view). Records the decision like the lighting rig does.
function _topoOpticsInstallRig(state: any) {
  if (!state) return null;
  let tier: _OpticsTier = 'transmission';
  let reason = 'desktop default';
  if (typeof _topoLightingIsMobile === 'function' && _topoLightingIsMobile()) { tier = OPTICS_MOBILE_TIER; reason = 'mobile viewport: alpha tier (low-performance fallback)'; }
  else if (state.lightingRig && !state.lightingRig.environment) { tier = 'alpha'; reason = 'lighting rig fell back (' + (state.lightingRig.reason || 'no environment') + '): alpha tier'; }
  state.opticsRig = { tier, active: null, backdrop: null, reason, retiers: 0, transmissive: 0, alpha: 0, opaque: 0 };
  _topoOpticsSyncView(state);
  return state.opticsRig;
}
// Is there an opaque backdrop for the transmission buffer? No cavity object at all counts
// as yes (nothing translucent stands between the crystals and the clear colour to lose).
function _topoOpticsBackdrop(state: any): boolean {
  const cav = state && state.cavity;
  if (!cav) return true;
  return !!(cav.visible && cav.material && !cav.material.transparent);
}
// Paint every crystal material in the live scene to `active` in place and count what is
// there. Materials keep their resolved params in userData.optics; only the tier-dependent
// part moves.
function _topoOpticsPaintScene(state: any, active: _OpticsTier) {
  const rig = state.opticsRig;
  let transmissive = 0, alpha = 0, opaque = 0, moved = 0;
  const seen = new Set<any>();
  const body = new THREE.Color();
  const children = state.crystals && state.crystals.children;
  if (children) for (let i = 0; i < children.length; i++) {
    const mesh = children[i];
    if (!mesh) continue;
    const mats = Array.isArray(mesh.material) ? mesh.material : (mesh.material ? [mesh.material] : []);
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const p = mat.userData && mat.userData.optics;
      if (!p) continue;
      if (p.tier !== active) {
        p.tier = active;
        p.transmissive = active === 'transmission' && !p.perimorph && p.metalness < 0.5 && p.clarity > OPTICS_TRANSMISSION_MIN_CLARITY;
        p.transmission = p.transmissive ? Math.min(1, OPTICS_TRANSMISSION_FLOOR + (1 - OPTICS_TRANSMISSION_FLOOR) * p.clarity) : 0;
        body.setHex(p.body);
        _opticsPaintTier(mat, p, body);
        mat.needsUpdate = true;
        moved++;
      }
      if (p.transmissive) transmissive++; else if (mat.transparent) alpha++; else opaque++;
    }
    // The helix overlay restores to naturalOpacity — keep it the tier's truth.
    if (mesh.userData && mats[0] && mats[0].userData && mats[0].userData.optics) {
      mesh.userData.naturalOpacity = mats[0].transparent ? mats[0].opacity : 1.0;
    }
  }
  rig.transmissive = transmissive; rig.alpha = alpha; rig.opaque = opaque;
  return moved;
}
// Bring the active tier in line with the capability and the backdrop. Called by
// _topoApplyWallDisplay (inside/outside, wall mode) and after a capability change.
function _topoOpticsSyncView(state: any) {
  const rig = state && state.opticsRig;
  if (!rig) return null;
  const backdrop = _topoOpticsBackdrop(state);
  const want: _OpticsTier = (rig.tier === 'transmission' && backdrop) ? 'transmission' : 'alpha';
  const changed = rig.active !== want;
  if (changed && rig.active != null) rig.retiers++;
  rig.active = want;
  rig.backdrop = backdrop;
  _topoOpticsPaintScene(state, want);
  return rig;
}
// Set the CAPABILITY tier (the step-down gate, the photo rig's A/B) and repaint.
function _topoOpticsApplyTier(state: any, tier: _OpticsTier, reason?: string) {
  if (!state) return null;
  if (!state.opticsRig) state.opticsRig = { tier: null, active: null, backdrop: null, reason: null, retiers: 0, transmissive: 0, alpha: 0, opaque: 0 };
  const rig = state.opticsRig;
  rig.tier = tier;
  if (reason) rig.reason = reason;
  _topoOpticsSyncView(state);
  return rig;
}

function buildCrystalMaterial(crystal: any, spec: any, f: any, tierOverride?: _OpticsTier): any {
  const fl = f || {};
  const tier: _OpticsTier = tierOverride || _topoOpticsTier();
  const p = opticsMaterialParamsFor(spec, fl, tier);
  // LOCAL CRYSTAL COLOUR — per-crystal chemistry tone + deterministic legibility floor so
  // same-species neighbours read apart (isSectorZoned overrides to white — its baked vertex
  // colours are absolute — so no double-tint).
  const body = _localCrystalColor(crystal, spec);
  const matOpts: any = {
    color: body.clone(),
    roughness: p.roughness,
    metalness: p.metalness,
    // DoubleSide for every crystal — inside-the-cavity camera angles cull front-side-only
    // meshes into hollow outlines; both faces keep terminations solid from any view. Perimorph
    // casts additionally need it for the translucent-shell read; transmission draws the back
    // face into its buffer so a crystal reads thick, not as a film.
    side: THREE.DoubleSide,
  };
  if (p.metalness < 0.5) { matOpts.ior = p.ior; matOpts.specularIntensity = p.specular; }
  if (p.sheen > 0) { matOpts.sheen = p.sheen; matOpts.sheenColor = new THREE.Color(0xffffff); matOpts.sheenRoughness = 0.55; }
  if (p.clearcoat > 0) { matOpts.clearcoat = p.clearcoat; matOpts.clearcoatRoughness = 0.15; }
  // Sector (hourglass) zoning — the geom bakes ABSOLUTE per-vertex colours; colour=white so the
  // material doesn't tint them (transmitted light is multiplied by the vertex colour too, so
  // the sandglass stays legible through the blade).
  if (fl.isSectorZoned) { matOpts.color = new THREE.Color(0xffffff); matOpts.vertexColors = true; }
  const mat = new THREE.MeshPhysicalMaterial(matOpts);
  mat.userData.optics = { ...p, body: body.getHex() };
  _opticsPaintTier(mat, mat.userData.optics, body);
  // Provisional thickness until the mesh scale is known (_opticsApplyExtent).
  if (p.transmissive) _opticsApplyExtent(mat, 4);
  return mat;
}

function _topoParseColor(s: string): any {
  if (!s) return new THREE.Color(0xd2691e);
  try {
    return new THREE.Color(s);
  } catch (e) {
    return new THREE.Color(0xd2691e);
  }
}

// v65: historical crystal size for replay. Walks zones[] up to
// `replayStep` and returns the accumulated c_length_mm / a_width_mm at
// that historical point — or null if the crystal hadn't nucleated yet
// or had no positive size by replayStep (in which case the caller skips
// rendering it entirely so replay shows growth order).
//
// Negative-thickness zones net directly into the historical sum. Do not cap
// an earlier frame to the smaller live total: that erased the larger
// pre-dissolution body and made sharp → etched → healed replay impossible.
//
// Habit ratio mirrors Crystal.add_zone in 27-geometry-crystal.ts; if
// either file shifts the habit:a_ratio table, both sites need to move
// together.
function _topoHistoricalCrystalSize(crystal: any, replayStep: number): { c_length_mm: number; a_width_mm: number } | null {
  if (!crystal) return null;
  if (crystal.nucleation_step != null && crystal.nucleation_step > replayStep) return null;
  if (!crystal.zones || !crystal.zones.length) return null;
  let totalUm = 0;
  let zoneCount = 0;
  for (const z of crystal.zones) {
    if (z.step != null && z.step > replayStep) break;
    totalUm += z.thickness_um;
    zoneCount++;
  }
  if (zoneCount === 0) return null;
  if (totalUm <= 0) return null;
  let c = totalUm / 1000.0;
  let a;
  if (crystal.habit === 'prismatic') a = c * 0.4;
  else if (crystal.habit === 'tabular') a = c * 1.5;
  else if (crystal.habit === 'acicular') a = c * 0.15;
  else if (crystal.habit === 'rhombohedral') a = c * 0.8;
  // Calcite-morphology arc Phase 2: σ-regime rhomb-family habits keep
  // the parent rhomb aspect in replay (mirrors _habitAspectRatio).
  else if (crystal.habit === 'stepped_rhombohedral'
        || crystal.habit === 'hopper_rhombohedral'
        || crystal.habit === 'dendritic_rhombohedral') a = c * 0.8;
  else if (crystal.habit === 'snowball') a = c;
  else a = c * 0.5;
  // W-K VOL-NEUTRAL (v226) — mirror the live add_zone compaction in the NARRATIVE
  // REPLAY. Without this a split crystal plays back as its raw needle and then
  // SNAPS shorter+wider at the live frame (live renderC = the compacted c_length_mm;
  // this path rebuilt c from raw growth). Per-step index history isn't recorded, so
  // we apply the FINAL _split.index: the last replay frame then matches the live
  // render exactly, and earlier frames sit at that same compaction (a mild
  // approximation — the crystal was already splitting as it grew). Constant volume:
  // c×m with a÷√m conserves the ellipsoid (c·a²), mirroring add_zone's a_width widen.
  if (O5_VOLNEUTRAL_ENABLED && crystal._split && crystal._split.index > 0) {
    const m = splitGrowthMult(crystal._split.index, _habitAspectRatio(crystal.habit));
    c *= m;
    a /= Math.sqrt(m);
  }
  return { c_length_mm: c, a_width_mm: a };
}

// PHASE-D-HABIT-BIAS — 3D-VISION plan Phase D / PROPOSAL-3D-SIMULATION
// Phase 3 (stalactite paragenesis). Pure function: given a crystal
// and its substrate normal (nx, ny, nz), return the c-axis direction
// the mesh should align to.
//
// For `growth_environment === 'fluid'` (the legacy default), c-axis
// = substrate normal (radial inward from the cavity wall — this is
// what the renderer did before Phase D).
//
// For `growth_environment === 'air'` (vadose / drained-cavity), c-axis
// becomes gravity-aligned:
//   * ceiling cells (substrate normal ny < -0.4): c-axis world-down
//     → stalactite hangs from the apex regardless of wall slope.
//   * floor cells   (substrate normal ny > +0.4): c-axis world-up
//     → stalagmite stands vertical regardless of wall slope.
//   * wall cells (|ny| ≤ 0.4): keep substrate normal — wall crystals
//     in air-mode have no clean geological analog (no real cave
//     dripstone forms on a horizontal wall), fall back to
//     perpendicular. Matches the wireframe renderer's 99d logic.
//
// Three.js coord system: south pole at -y (floor), north at +y
// (ceiling). World-down = -y for stalactites, world-up = +y for
// stalagmites. (The wireframe renderer 99d uses +z for gravity-down
// because its canvas coords differ from Three.js's.)
//
// Returns a length-3 tuple [cx, cy, cz] — the helper is shared with
// tests so they can assert the math without spinning up Three.js.
function _topoCAxisForCrystal(
  crystal: any, nx: number, ny: number, nz: number,
): [number, number, number] {
  if (crystal && crystal.growth_environment === 'air') {
    if (ny < -0.4) return [0, -1, 0];   // ceiling → stalactite
    if (ny > 0.4)  return [0, 1, 0];    // floor → stalagmite
  }
  // W-F O3b — geometric selection: lean the c-axis to the crystal's RECORDED
  // nucleation tilt (rigid whole-body rotation off the substrate normal, Steno-
  // safe). Gated; when off, the raw normal (the legacy forced-normal comb) is
  // returned. Survivors nucleated near-normal read tall + upright; buried losers
  // (arrested small by the burial pass) read as short tilted stubs — the palisade
  // earned, not painted.
  if (GEOMETRIC_SELECTION_ENABLED && crystal && crystal._nucTilt) {
    return o3TiltedAxis([nx, ny, nz], crystal._nucTilt);
  }
  return [nx, ny, nz];
}

// Compose a deterministic signature of the crystals that affects
// their meshes — id, mineral, habit, c_length_mm, ring/cell anchor.
// PHASE-D-HABIT-BIAS: now also folds in growth_environment so the
// cache busts when a crystal transitions fluid → air (currently set
// at nucleation, but if a future scenario adds drainage-mid-life
// retagging this stays honest). The `a` / `f` / `d` suffix encodes
// air, fluid, and dissolved — one character so the signature stays
// compact.
//
// v65: replayStep folded in so replay frames bust the cache and pull
// the historical c_length per crystal. When undefined (live render),
// the signature reduces to the v64 form so live caching is unchanged.
function _topoCrystalsSignature(sim: any, wall: any, replayStep?: number): string {
  if (!sim || !sim.crystals || !sim.crystals.length) return '';
  const parts: string[] = [];
  for (const c of sim.crystals) {
    if (!c) continue;
    // Q4: dissolved crystals normally drop from the scene, BUT a
    // dissolved crystal flagged perimorph_eligible persists as a
    // hollow cast — its outline is the geological signature. Include
    // such casts in the signature so the cache busts when one
    // appears (and so its mesh gets built in _topoSyncCrystalMeshes).
    // AMENDED 2026-07-07 (shigar eye-check): `dissolved` means the
    // crystal LOST material, not that it's gone — the HF-etched
    // shigar aquamarines end at 0.13-0.6 mm net and were being culled
    // wholesale, so the scenario's titular gemstones never rendered.
    // Only an effectively-zero remnant drops; partially-dissolved
    // crystals stay in the scene (and get the etched-matte surface
    // the face-realism arc already ships for them).
    if (c.dissolved && !c.perimorph_eligible && !(c.c_length_mm > 0.05)) continue;
    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the truth.
    const _anchorKey = wall?.surfaceAnchorKey
      ? wall.surfaceAnchorKey(c) : CavitySurfaceAnchors.key(c.wall_anchor);
    // PHASE-D-HABIT-BIAS: encode growth_environment into the signature
    // so the cache busts when an air-mode crystal's orientation
    // (radial → gravity) flips. 'a' = air, 'f' = fluid (default).
    const _envKey = c.growth_environment === 'air' ? 'a' : 'f';
    if (replayStep != null) {
      // Replay path: skip pre-nucleation crystals so they don't
      // contribute their final-size key during early replay frames.
      // Use historical size in the signature so each frame's cache
      // key reflects the rendered size at that step.
      const hist = _topoHistoricalCrystalSize(c, replayStep);
      // v66: rewind mineral to paramorph_origin if replayStep is
      // before the paramorph transition (argentite at step < paramorph_step).
      // Folding into the signature ensures the cache busts the moment
      // the replay timeline crosses paramorph_step.
      const effectiveMineral = mineralAtReplayStep(c, replayStep);
      if (!hist) {
        // Perimorph casts persist at live size as hollow shells —
        // keep them in the signature so the cache key still busts
        // when one appears.
        if (!(c.dissolved && c.perimorph_eligible)) continue;
        parts.push(`${c.crystal_id}:${effectiveMineral}:${c.habit}:cast:${c.c_length_mm.toFixed(2)}:${_anchorKey}:${_envKey}`);
        continue;
      }
      parts.push(`${c.crystal_id}:${effectiveMineral}:${c.habit}:${hist.c_length_mm.toFixed(2)}:${_anchorKey}:${_envKey}:r${replayStep}`);
      continue;
    }
    // Quartz's surface history can gain a striation before its length crosses
    // the 0.01 mm display bucket. Include that history in live invalidation.
    const quartzHistoryKey = c.mineral === 'quartz'
      ? `:q${c.zones?.length || 0}:${c.total_growth_um || 0}:${c.a_width_mm || 0}` : '';
    // Gypsum's fixed-plane shape develops with width as well as length.
    const bladeAspectKey = c.mineral === 'selenite' || c.mineral === 'gypsum'
      ? `:b${c.a_width_mm || 0}:${c.c_length_mm || 0}` : '';
    parts.push(`${c.crystal_id}:${c.mineral}:${c.habit}:${c.c_length_mm.toFixed(2)}:${_anchorKey}:${_envKey}:${c.dissolved ? 'd' : 'a'}${quartzHistoryKey}${bladeAspectKey}`);
  }
  return parts.join('|');
}

// W-F O2 — neighbour placement for the induction-surface clip. Returns a
// crystal's WORLD centre + a generous (circumscribed-sphere) bounding reach,
// using the SAME anchor→cAxis→occlusion-offset math the mesh loop applies at
// mesh.position, so the meeting planes computed below sit consistently with
// where each crystal actually renders. (The loop's wasFloored aspect
// re-derivation for sub-floor crystals is skipped here — a <2 mm centre shift
// on invisible crystals.) Returns null for the crystals the loop also skips
// (dissolved non-perimorphs, un-anchored floaters, not-yet-nucleated in replay).
function _o2PlaceBody(crystal: any, wall: any, replayStep: number | undefined, ringCount: number, N: number, initR: number): any {
  if (!crystal) return null;
  let renderC = crystal.c_length_mm, renderA = crystal.a_width_mm;
  if (replayStep != null) {
    const hist = _topoHistoricalCrystalSize(crystal, replayStep);
    if (hist) { renderC = hist.c_length_mm; renderA = hist.a_width_mm; }
    else if (!(crystal.dissolved && crystal.perimorph_eligible)) return null;
  }
  // Mirrors the mesh loop's amended Q4 gate (2026-07-07): partially-
  // dissolved remnants render, so they must also occupy space in the
  // O2 neighbour pre-pass; only effectively-gone remnants drop.
  if (crystal.dissolved && !crystal.perimorph_eligible && !(renderC > 0.05)) return null;
  const anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
  if (!anchor) return null;
  const point = wall.surfacePointForCrystal?.(crystal);
  const normal = wall.surfaceNormalForCrystal?.(crystal);
  if (!point || !normal) return null;
  const [ax, ay, az] = point;
  const [cAxisX, cAxisY, cAxisZ] = _topoCAxisForCrystal(
    crystal, normal[0], normal[1], normal[2],
  );
  const token = _resolveCrystalGeomToken(crystal, crystal.habit);
  const inReplay = (replayStep != null);
  let cLen = Math.max(inReplay ? 0.0 : 2.0, renderC);
  const aWid = Math.max(inReplay ? 0.0 : 1.5, renderA);
  const dolomiteRhomb = crystal.mineral === 'dolomite' && token === 'rhomb' && crystal.habit === 'coarse_rhomb';
  if (dolomiteRhomb && !inReplay && (renderC < 2 || renderA < 1.5)) cLen = Math.max(cLen, aWid / _GEOM_TOKEN_RATIO.rhomb);
  const equant = token === 'cube' || token === 'octahedron' || token === 'tetrahedron' || token === 'rhomb'
    || token === 'scalene' || token === 'tablet' || token === 'rhombic_dodec' || token === 'dodecahedron';
  const simOccF = (crystal._occlusion && typeof crystal._occlusion.attachedFraction === 'number') ? crystal._occlusion.attachedFraction : null;
  const occF = simOccF != null ? simOccF : (equant && crystal.growth_environment !== 'air' ? 0.5 : 0);
  const off = cLen * (0.5 - occF);
  return {
    id: crystal.crystal_id,
    enclosed: crystal.enclosed_by != null,
    cx: ax + cAxisX * off, cy: ay + cAxisY * off, cz: az + cAxisZ * off,
    reach: Math.max(0.5 * Math.sqrt(2 * aWid * aWid + cLen * cLen),
      dolomiteRhomb ? cLen * dolomiteRenderRadius() : 0),
    // C1 O2 upgrade — gross integrated linear growth (already depletion-aware:
    // the growth loop reads cell σ, so a starved crystal's total_growth_um is
    // already smaller). The meeting-plane weight below prefers this over `reach`
    // (current circumscribed size), which differs for dissolved-and-regrown or
    // strongly anisotropic bodies — the drift population O2's header pre-registered.
    growth: crystal.total_growth_um > 0 ? crystal.total_growth_um : 0,
  };
}

// W-F O1b — neighbour shadow (C1 directional tranche, 2026-07-07). A crystal
// packed among neighbours grows preferentially into open space; in a wall druse
// the neighbours are lateral and the open direction is cavity-ward, so the crowd
// REINFORCES O1a's radial exposure. This reduces the true per-face directional
// shadow to the radial scalar the kernel expresses today (per-face is the
// pre-registered upgrade). Reuses the O2 neighbour pre-pass (_o2Bodies: world
// centre + circumscribed reach). Shadow = summed overlap fraction with touching
// neighbours (enclosed guests excluded — they're O4). Returns a kExp boost in
// [0, MAX]. Measured reach is small (tools/c1-exposure-calibration-probe.mjs).
const O1B_SHADOW = { SCALE: 0.10, MAX: 0.15, KEXP_CAP: 0.32 };

// W-F O4a — engulfment made visible. Inclusions are placed in a SECOND pass off
// the host's ACTUAL rendered bounds (bounding sphere × scale), not the sim's
// uncapped c_length — for a capped giant blade (Naica selenite: 66 mm sim vs
// ~13 mm rendered) the latter overshoots the visible mesh 3×, spilling guests
// outside the host. A deterministic per-id radial fraction fills the interior.
const O4_INCLUSION_MIN_MM = 0.4;         // visibility floor (bypass the 2 mm crystal floor)
const O4_INCLUSION_RMIN_FRAC = 0.12;     // guests fill the host interior between these radial
const O4_INCLUSION_RMAX_FRAC = 0.62;     //   fractions of the host's RENDERED reach
const O4_INCLUSION_SIZE_CAP_FRAC = 0.5;  // a guest never renders bigger than this × host reach

// W-F O4a — pure inclusion-placement helper (shared with tests). Given a guest's
// own wall anchor (ax,ay,az), its host's rendered centre (hcx,hcy,hcz) + rendered
// reach (hostR), and the guest's crystal id, return the guest's local position
// INSIDE the host. Direction = from host centre toward the guest's anchor (the
// side it nucleated on), with a deterministic id-based fallback when that is
// degenerate (guest nucleated ~at the host centre). Radius = a deterministic
// per-id fraction of hostR in [RMIN, RMAX], so guests fill the interior rather
// than sit on one shell. INVARIANT: the result is always within RMAX·hostR (< hostR)
// of the host centre — an inclusion never escapes its host. Pure (no THREE).
function _o4InclusionLocalPos(
  ax: number, ay: number, az: number,
  hcx: number, hcy: number, hcz: number,
  hostR: number, id: number,
): [number, number, number] {
  let dx = ax - hcx, dy = ay - hcy, dz = az - hcz;
  let dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dl < 1e-3) {
    const a = _crystalYaw(id || 1);
    dx = Math.cos(a); dy = 0.2; dz = Math.sin(a);
    dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  }
  // Deterministic [0,1) from id → radial fraction (no Math.random; replay-safe).
  const h01 = Math.abs(Math.sin((id || 1) * 12.9898)) % 1;
  const rf = O4_INCLUSION_RMIN_FRAC + (O4_INCLUSION_RMAX_FRAC - O4_INCLUSION_RMIN_FRAC) * h01;
  const r = hostR * rf;
  return [hcx + (dx / dl) * r, hcy + (dy / dl) * r, hcz + (dz / dl) * r];
}

// W-F O5c — emit the masked-horizon bands for one host crystal. Reads the
// recorded zone stack via maskedHorizonBands (js/44b, pure) and adds one thin
// concentric shell CHILD per horizon: SAME geometry as the host (post-O2-clip,
// finalized before add(mesh) — so the band matches the visible silhouette),
// uniform local scale = the horizon's radial fraction, local position 0. As a
// child it inherits the host's world transform (including a tabular blade's
// non-uniform scale), so the shell is similar-and-concentric inside — a smaller
// copy of the same form at the depth the film was buried. Tinted by filmBandRGB,
// semi-opaque + double-sided + depthWrite off so it reads THROUGH the host's
// Depth-A translucency without punching the transparent sort; an OPAQUE host
// hides it (honest, the O4a contract). Non-raycastable — a band is an internal
// feature, not a hit target, so hovers fall through to the host shell.
// Render-only: no crystal mutated, no sim state touched (byte-identical).
function _o5EmitMaskedBands(hostMesh: any, crystal: any, state?: any): void {
  if (!hostMesh || !hostMesh.geometry) return;
  const bands = maskedHorizonBands(crystal);
  if (!bands.length) return;
  for (const band of bands) {
    const f = band.frac;
    if (!(f > 0 && f < 1)) continue;
    const [br, bg, bb] = filmBandRGB(band.mineral);
    const bandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(br, bg, bb),
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (state && state.clipUniforms) _applyCavityClip(bandMat, state.clipUniforms);
    const bandMesh = new THREE.Mesh(hostMesh.geometry, bandMat);
    bandMesh.scale.setScalar(f);
    // PHANTOMS SHARE THE BASE (boss observation on the ametrine reference
    // specimen, 2026-07-09: "the center point of the growth shifts throughout
    // the scepter"). A wall-attached crystal grows on its FREE faces only — the
    // attached end is dead — so the geometric centre of each successive shell
    // migrates tipward and the buried growth states stack like nested cones
    // sharing the base, NOT concentric shells. Anchor the band's base to the
    // host's base (bounding-box min.y in the host's local space): after a
    // uniform scale f the child's base sits at minY·f, so offsetting by
    // minY·(1−f) re-pins it to minY. The concentric first cut put the horizon
    // floating mid-crystal — the idealization the specimen contradicts.
    if (!hostMesh.geometry.boundingBox) hostMesh.geometry.computeBoundingBox();
    const hbb = hostMesh.geometry.boundingBox;
    bandMesh.position.y = (hbb ? hbb.min.y : -0.5) * (1 - f);
    bandMesh.renderOrder = (hostMesh.renderOrder || 0) + 1;
    bandMesh.raycast = function () {};
    bandMesh.userData = { o5Band: true, crystal_id: crystal.crystal_id, filmMineral: band.mineral };
    // R1: a phantom band sits inside its host, which already casts; receive only.
    _topoLightingTagMesh(bandMesh, false);
    hostMesh.add(bandMesh);
  }
}

function _o1bNeighborShadow(crystal: any, bodies: any[]): number {
  if (!bodies || bodies.length < 2) return 0;
  let me: any = null;
  for (const b of bodies) { if (b.id === crystal.crystal_id) { me = b; break; } }
  if (!me || me.enclosed) return 0;
  let shadow = 0;
  for (const b of bodies) {
    if (b.id === crystal.crystal_id || b.enclosed) continue;
    const dx = b.cx - me.cx, dy = b.cy - me.cy, dz = b.cz - me.cz;
    const D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const sum = me.reach + b.reach;
    if (sum <= 0 || D >= sum) continue;           // not overlapping → no shadow
    shadow += (sum - D) / sum;                     // overlap fraction (0..1 per neighbour)
  }
  return Math.min(O1B_SHADOW.MAX, O1B_SHADOW.SCALE * shadow);
}

// W-F O2 — the matte material for the anhedral contact facet (group 1): the
// crystal's own colour, but a rough, opaque, non-metallic ground surface with
// no euhedral gloss. Cloned from the euhedral material so the cavity clip and
// colour carry over; the clip uniforms are re-bound to be safe.
function _o2ContactMaterial(mat: any, state: any): any {
  const m = mat.clone();
  m.roughness = 0.92;
  m.metalness = 0.0;
  m.transparent = false;
  m.opacity = 1.0;
  m.transmission = 0;               // R2: a contact face is an interface, not glass
  if (m.userData) m.userData.optics = null;   // the retier leaves it alone
  if (typeof _applyCavityClip === 'function') _applyCavityClip(m, state.clipUniforms);
  return m;
}

// Build (or rebuild) crystal meshes inside `state.crystals`. One mesh
// per non-dissolved Crystal, positioned at its anchor cell's surface,
// oriented so the c-axis points outward from the cavity center, scaled
// by c_length_mm / a_width_mm. Material color comes from
// MINERAL_SPEC[mineral].class_color.
function _topoSyncCrystalMeshes(state: any, sim: any, wall: any, replayStep?: number) {
  if (!sim || !wall || !wall.rings || !wall.rings.length) return;
  const sig = _topoCrystalsSignature(sim, wall, replayStep);
  if (sig === state.crystalsSig) return;
  state.crystalsSig = sig;

  // Cached shapes are borrowed and survive rebuilds. Lining meshes and
  // contact-clipped parents own their fresh geometry and must release its
  // GPU buffers when replaced; garbage collection alone does not do that.
  while (state.crystals.children.length) {
    const child = state.crystals.children.pop();
    if (child.userData?.ownsGeometry && child.geometry?.dispose) child.geometry.dispose();
    if (child.customDepthMaterial?.dispose) child.customDepthMaterial.dispose();
    if (state.specimen?.depthMats) state.specimen.depthMats.delete(child);
    // O2-contacted crystals carry a [euhedral, contact] material array.
    if (Array.isArray(child.material)) { for (const m of child.material) if (m && m.dispose) m.dispose(); }
    else if (child.material && child.material.dispose) child.material.dispose();
  }

  if (!sim.crystals) return;
  const ringCount = wall.ring_count;
  const N = wall.cells_per_ring;
  const initR = wall.initial_radius_mm || 25;

  // W-F O2 — neighbour pre-pass: every crystal's world centre + reach, so the
  // per-crystal clip below can find who it grew into (Self & Hill competitive
  // growth). One O(N) scan builds the map; the clip then does an O(N) overlap
  // test per crystal (N is per-cavity, tens–low-hundreds). Enclosed guests are
  // flagged so O2 skips them — they're O4 engulfment, not competitive contact.
  const _o2Bodies: any[] = [];
  for (const c of sim.crystals) {
    const b = c ? _o2PlaceBody(c, wall, replayStep, ringCount, N, initR) : null;
    if (b) _o2Bodies.push(b);
  }
  // W-F O4a — engulfment made visible (2026-07-07). Host lookup so an enclosed
  // guest can be repositioned INSIDE its host body (below) instead of rendering
  // at its own stale wall anchor. The Sweetwater enclosure mechanic (js/85c
  // _check_enclosure) has tagged enclosed_by / enclosed_crystals all along; the
  // 2D topo map already dots these (js/99b:488) and O1b/O2 already flag+skip
  // them ("they're O4"). This is the 3D face. Render-only: reads existing sim
  // state, mutates no crystal → byte-identical, no baseline drift.
  // W-F O4a pass-1 collectors — a guest can render before OR after its host in
  // this loop, so inclusions are positioned in a SECOND pass (after the loop)
  // once every host mesh exists. _hostMeshById lets a guest find its host mesh;
  // _pendingInclusions holds the guests to place.
  const _hostMeshById: Map<any, any> = new Map();
  const _pendingInclusions: any[] = [];
  const _surfaceLayers: any[] = [];

  for (const crystal of sim.crystals) {
    if (!crystal) continue;
    // v65 replay: rendered c_length / a_width come from history when a
    // replayStep is active. Skips crystals that hadn't nucleated yet
    // (or whose net size at replayStep is non-positive) so replay
    // shows growth order. Perimorph casts persist at live size as
    // hollow shells regardless — that's their whole point geologically.
    let renderC = crystal.c_length_mm;
    let renderA = crystal.a_width_mm;
    if (replayStep != null) {
      const hist = _topoHistoricalCrystalSize(crystal, replayStep);
      if (hist) {
        renderC = hist.c_length_mm;
        renderA = hist.a_width_mm;
      } else if (!(crystal.dissolved && crystal.perimorph_eligible)) {
        // Not yet nucleated / no positive size at this step → skip.
        continue;
      }
      // else: perimorph cast — fall through with live (= dissolution-time) size.
    }

    // Q4 — dissolved crystals normally drop from the scene, BUT a
    // dissolved crystal flagged perimorph_eligible (Q2a tagged via
    // shape-preserving CDR route) persists as a hollow cast. The
    // mesh body is the inherited shape; the material is translucent
    // double-sided so the user reads the void inside the shell.
    // AMENDED 2026-07-07 (shigar eye-check): judge on the size being
    // rendered THIS FRAME (post-history), and only drop EFFECTIVELY-
    // GONE remnants. Two bugs fell together: (1) partially-dissolved
    // crystals — the HF-etched shigar aquamarines end at 0.13-0.6 mm
    // net, "sculpted, pitted, frosted", still physically there — were
    // culled from the live scene entirely; (2) the skip ran BEFORE the
    // replay-history branch, so a to-be-etched crystal never appeared
    // at ANY playback step even while alive (Tutorial 4 narrates blue
    // beryl onto a wall that never showed one).
    if (crystal.dissolved && !crystal.perimorph_eligible && !(renderC > 0.05)) continue;

    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the sole
    // positional field; _resolveAnchor reads only from it.
    const _anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
    if (!_anchor) continue;
    // `_anchor` is already authenticated and live-remapped. Reuse it rather
    // than independently resolving the same crystal for each projection.
    const chemistry = CavitySurfaceAnchors.chemistryAddress(_anchor);
    const point = _anchor.position;
    const normal = _anchor.normal;
    if (!chemistry || !point || !normal) continue;
    const ringIdx = chemistry.ringIdx;
    const cellIdx = chemistry.cellIdx;

    const ring = wall.rings[ringIdx];
    if (!ring || !ring[cellIdx]) continue;

    // Anchor point on the cavity wall — same math as
    // _topoBuildCavityGeometry uses, applied to one cell.
    const [ax, ay, az] = point;

    // Substrate normal: from wall center (the origin, since the
    // cavity is built around 0,0,0) outward through the anchor.
    // c-axis lies along this normal — crystal grows INTO the cavity
    // (toward origin) for fluid environments. Negate so the c-axis
    // points from anchor toward origin.
    const [nx, ny, nz] = normal;
    // PHASE-D-HABIT-BIAS — pure helper centralizes the gravity bias.
    // See _topoCAxisForCrystal definition below for the full
    // contract; tests live in tests-js/habit-bias.test.ts.
    const [cAxisX, cAxisY, cAxisZ] = _topoCAxisForCrystal(crystal, nx, ny, nz);

    // W-F O4a — a guest crystal (enclosed_by set) is sealed inside its host.
    // Flag it here so its material reads as a solid opaque grain (buildCrystal-
    // Material), it skips O2 contact-clipping + cluster satellites, and pass 2
    // (after the loop) repositions it INSIDE the host's rendered body. The host's
    // Depth-A translucency then reveals it (poikilotopic — pyrite grains in clear
    // calcite); an OPAQUE host rightly hides its inclusions, which is honest.
    const isInclusion = crystal.enclosed_by != null;

    // Q3a — CDR pseudomorph outline inheritance. When a crystal was
    // born via a coupled-dissolution-precipitation route (Q2a tagged
    // it with cdr_replaces_crystal_id), inherit the parent's habit
    // for the geometry primitive — malachite-after-azurite renders
    // with the azurite cube silhouette filled in malachite's color;
    // goethite-after-pyrite renders as a "limonite cube" not a free
    // botryoidal blob. Material color stays the child's. Per Putnis
    // 2002/2009: CDR preserves external form because the dissolution-
    // precipitation interface is sharp on scales below the precipitate
    // grain size. The sim already tags eligible crystals (Q2a); the
    // renderer just consumes the pointer.
    let habitForGeom = crystal.habit;
    let isCdrPseudomorph = false;
    if (crystal.cdr_replaces_crystal_id != null) {
      const parent = sim.crystals.find((c: any) => c.crystal_id === crystal.cdr_replaces_crystal_id);
      if (parent && parent.habit) {
        habitForGeom = parent.habit;
        isCdrPseudomorph = true;
      }
    }

    // Pick the habit primitive and cache it. PROPOSAL-HABIT-BIAS
    // Slice 4: _resolveCrystalGeomToken adds the air-mode override
    // (canonical → 'dripstone' for ceiling/floor crystals on a
    // prism/spike/rhomb/scalene/botryoidal habit).
    const token = _resolveCrystalGeomToken(crystal, habitForGeom);

    // W-F O0 — attached-crystal truth (ontogeny arc, 2026-07-03). A wall-
    // nucleated EQUANT CLOSED form grew FROM the substrate, not ON it: its
    // growth center sits at the nucleation site, so the buried half of the
    // ideal polyhedron never existed (Grigor'ev's half-form) and the old
    // base-at-anchor float rendered a museum figurine set down on the wall.
    // Default the attachment fraction to 0.5 for those forms; a sim-declared
    // _occlusion.attachedFraction (classifyOcclusion, occlusion-opted
    // scenarios) stays authoritative when present. Prism/spike/needle
    // families keep base-at-anchor — their growth is unidirectional along c
    // and the flat base IS the scar. Snowball (clast-grown floater — the one
    // doubly-terminated-by-right context), the crafted twin composites,
    // air-mode dripstone, and the special builders keep their own contracts.
    // Render-only: SIM state and baselines are untouched by construction.
    const _simOccF = (crystal._occlusion && typeof crystal._occlusion.attachedFraction === 'number')
      ? crystal._occlusion.attachedFraction : null;
    const _o0Equant = token === 'cube' || token === 'octahedron' || token === 'tetrahedron' || token === 'rhomb'
      || token === 'scalene' || token === 'tablet' || token === 'rhombic_dodec'
      || token === 'dodecahedron';
    let occF = _simOccF != null ? _simOccF
      : (_o0Equant && crystal.growth_environment !== 'air' ? 0.5 : 0);

    let geom: any = null;
    let _o2ConvexGeom = false;   // W-F O2: set by the convex geom paths (Wulff / system-prism / token primitive); the concave/special builders leave it false so the contact clip skips them
    let isSectorZoned = false;   // sector (hourglass) zoning → vertexColors material
    let isWulffCalcite = false;  // calcite Wulff polyhedron → isotropic scale (geom carries c-elongation)
    let isWulffWulfenite = false;  // wulfenite Wulff tabular plate → isotropic scale by plate diameter (rung 4a.3)
    let isWulffBarite = false;  // barite Wulff RECTANGULAR tabular plate → isotropic scale by plate diameter (rung 4a.4)
    let isWulffTitanite = false;  // titanite Wulff monoclinic sphenoid WEDGE → isotropic scale by diameter (rung 4a.6)
    // PHYSICAL ETCH — the accepted receipt selects a measured face-specific
    // surface morphology. It runs before growth terraces because dissolution
    // relief is the exposed surface at that replay step; later positive zones
    // progressively bury it. The current {100} fluorite model produces
    // cubic pits with near-90° {100} sidewalls and no corner rounding. Pit
    // depth is a receipt-labelled 250× schematic overlay of assumed
    // pre-existing pores; mass and silhouette dimensions remain physical.
    let isEtched = false;
    const physicalEtch = typeof physicalEtchVisualStateAtStep === 'function'
      ? physicalEtchVisualStateAtStep(crystal, replayStep) : crystal._etch;
    if (physicalEtch && token === 'cube') {
      const intensity = Math.max(0, Math.min(1, physicalEtch.amount || 0));
      const morphology = String(physicalEtch.morphology || 'unresolved');
      const round = morphology.includes('cubic-{100}-pits')
        ? 0 : Math.max(0.08, Math.min(0.6, 0.08 + intensity * 0.52));
      const q = Math.round(round * 100) / 100;
      const pq = _physicalEtchReliefBucket(intensity);
      const key = `__etched_cube_${q}_pit_${pq}_${morphology}`;
      geom = state.geomCache.get(key);
      if (!geom) { geom = _makeEtchedCube(round, pq, morphology); state.geomCache.set(key, geom); }
      isEtched = true;
    }
    // CALCITE e-TWIN — post-growth mechanical-twin overprint (deformation arc §5.3 tenant,
    // 2026-06-22). classifyDeformation tags _deformation.kind='etwin' on calcite that grew
    // before a scenario strain event (marble orogenic strain). Renders parallel {01-12}
    // twin lamellae as baked dark stripes (Ferrill 2004 Type I-IV: density rises with
    // strain). Runs BEFORE the terrace render — the twin overprint dominates the late
    // texture. Cached per density bucket; sets isSectorZoned so the vertex-colour stripes
    // render. A replay before the strain step keeps the un-twinned crystal.
    if (!geom && crystal.mineral === 'calcite' && crystal._deformation && crystal._deformation.kind === 'etwin'
        && (replayStep == null || replayStep >= crystal._deformation.atStep)) {
      const dens = Math.max(0.15, Math.min(1, crystal._deformation.amount || 0.6));
      const q = Math.round(dens * 10) / 10;   // quantize for cache reuse
      const key = '__etwin_calcite_' + q;
      geom = state.geomCache.get(key);
      if (!geom) { geom = _makeTwinnedCalcite(dens); state.geomCache.set(key, geom); }
      isSectorZoned = true;   // baked vertex-colour lamellae → vertexColors material
    }
    // Calcite-morphology arc Phase 3: a calcite crystal whose zone stack
    // carries real stepped/hopper relief renders zone-stack TERRACES
    // instead of the smooth parent form. Gated on the parent-form tokens
    // so twins, manganocalcite botryoids, and air-mode dripstone all keep
    // their own geometry. Replay passes the frame's step so terraces
    // accumulate as the scrubber advances — the watch-it-grow read.
    if (crystal.mineral === 'calcite' && (token === 'scalene' || token === 'rhomb')
        && typeof calciteTerraceBands === 'function') {
      const terr = calciteTerraceBands(crystal, replayStep);
      if (terr) {
        // Directional {104} stepping (central-distance arc Phase 1): a crystal the
        // sim tagged with _faceStep (js/45 classifyFaceStep, gated on
        // wall.directional_steps) carves its macrosteps onto ONE face-set. SEG=6, so
        // the 'up' set is the contiguous half {0,1,2}; the opposite half stays smooth.
        // The set is yaw-arbitrary (see _makeDirectionalTerracedCalciteGeom caveat).
        if (crystal._faceStep) (terr as any).steppedSet = [0, 1, 2];
        geom = _getTerracedCalciteGeom(state, crystal, terr);
      }
    }
    // Halide render wave (2026-06-12): banded/hoppered cubes get the
    // square-section ziggurat (grooved bands + funnel-sunk top face).
    // Same accumulate-on-replay contract as the calcite terraces.
    // Fluorite joined as the fourth tenant — its REE octahedra resolve
    // to the 'octahedron' token and correctly skip this path.
    if (!geom && (crystal.mineral === 'halite' || crystal.mineral === 'sylvite'
        || crystal.mineral === 'fluorite' || crystal.mineral === 'pyrite')
        && token === 'cube' && typeof halideTerraceBands === 'function') {
      const terr = halideTerraceBands(crystal, replayStep);
      // Pyrite's ordinary step relief belongs on its crystallographic faces.
      // Retain the existing non-convex builder for recorded skeletal episodes.
      if (terr && (crystal.mineral !== 'pyrite'
          || terr.knots.some((k: any) => k.regime === 'hopper_skeletal'))) {
        geom = _getTerracedCalciteGeom(state, crystal, terr);
      }
    }
    // CENTRAL-DISTANCE (Wulff) FORM (central-distance arc Phase 4, 2026-06-28): the arc's
    // DESTINATION. A crystal the sim tagged _wulffForm (js/45 classifyWulffForm) renders as the
    // TRUE convex polyhedron of its growing form faces (js/46 wulffFaceSetForMineral →
    // _makeWulffGeom) instead of a fixed primitive:
    //   fluorite (4a.1, token cube/octahedron) — the cube↔octahedron transition fluid.Y drives
    //     (Bosze & Rakovan 2002, REE-stabilized {111}). ISOMETRIC: token stays cube/octahedron, so
    //     the downstream uniform scale is unchanged → byte-identical.
    //   calcite (4a.2, token rhomb/scalene) — the {104} rhombohedron↔{21-31} scalenohedron
    //     (nailhead↔dogtooth), the first NON-cubic tenant. ANISOTROPIC: the Wulff geom already
    //     carries the true c-elongation (kernel builds c on Y), so the scale block below treats it
    //     ISOTROPICALLY (isWulffCalcite) instead of the token's mesh.scale.set(aWid,cLen,aWid),
    //     which would DOUBLE-stretch it.
    // Gated on the matching tokens so the twin / etched / terrace / e-twin / dendrite paths above
    // keep their geometry, and on !geom so they all win. Cached by quantized (mineral, form, biasC,
    // growth); _makeWulffGeom null-clamps a degenerate polyhedron → fall through to the primitive.
    if (!geom && crystal._wulffForm && typeof wulffFaceSetForMineral === 'function') {
      const wf = crystal._wulffForm;
      const isFlWulff = crystal.mineral === 'fluorite' && (token === 'cube' || token === 'octahedron');
      const isCalWulff = crystal.mineral === 'calcite' && (token === 'rhomb' || token === 'scalene');
      const isWfWulff = crystal.mineral === 'wulfenite' && token === 'tablet';   // rung 4a.3 (tetragonal)
      const isBaWulff = crystal.mineral === 'barite' && token === 'tablet';      // rung 4a.4 (orthorhombic) — tabular/bladed only
      const isGlWulff = crystal.mineral === 'galena' && (token === 'cube' || token === 'octahedron');   // rung 4a.5 (cubic, like fluorite — isometric, no new scale branch)
      const isTiWulff = crystal.mineral === 'titanite' && (token === 'prism' || token === 'tablet');   // rung 4a.6 (monoclinic) — sphenoid_wedge/prismatic→prism, flattened_tabular→tablet
      if (isFlWulff || isCalWulff || isWfWulff || isBaWulff || isGlWulff || isTiWulff) {
        // O0: the titanite sphenoid resolves to the prism token (outside the
        // equant sink set above) but is an equant closed Wulff body — same
        // half-form default as its tablet-token sibling.
        if (isTiWulff && _simOccF == null && crystal.growth_environment !== 'air') occF = 0.5;
        // W-F O1a — exposure. Wall-anchored fluid crystals grow their fed
        // (cavity-facing) faces ahead of their starved (wall-facing) faces —
        // the kernel's f_geo = 1 + k·(n·û) per-face rate modifier (js/46).
        // C1 (2026-07-07, the directional-σ tranche) retires the fleet-wide
        // kExp=0.18 constant: o1aExposureK reads each crystal's OWN
        // growth-weighted base(d=0)/tip(d=max) gradient from the interior voxel
        // field (js/45 _o1aExp accumulator) and maps it to a per-crystal kExp.
        // The c1-depletion-ev-probe showed the 0.18 was a fiction — the Wulff
        // tenants are the calm well-fed minerals (base/tip ≈ 0.93), so this
        // gently SYMMETRIZES them toward their true near-isotropic form, with
        // O1b's neighbor shadow (below) adding back the crowd's asymmetry.
        // Air-mode keeps k = 0 (dripstone is a gravity film, not a bath gradient).
        let kExp = 0;
        if (crystal.growth_environment !== 'air') {
          kExp = o1aExposureK(crystal);                                   // O1a radial exposure (own depletion field)
          kExp = Math.min(O1B_SHADOW.KEXP_CAP, kExp + _o1bNeighborShadow(crystal, _o2Bodies));  // O1b crowd reinforcement
        }
        const formKey = (isFlWulff || isGlWulff) ? (wf.octahedral ? 'o' : 'c')   // cubic cube↔octahedron (galena octahedral is always false → 'c')
          : isCalWulff ? (wf.scaleno ? 's' : 'r') : 't';   // wulfenite + barite + titanite are single-body → 't' (mineral is in the key)
        const key = '__wulff_' + crystal.mineral + '_' + formKey
          + '_' + Math.round(wf.biasC * 100) + '_' + Math.round(wf.growthFrac * 10)
          + '_h' + Math.round(occF * 20)    // O0 attachment-fraction bucket (0.05 steps)
          + '_e' + Math.round(kExp * 100);  // O1a exposure bucket
        geom = state.geomCache.get(key);
        if (!geom) {
          // crystalId 0 → the kernel's internal jitter is a harmless constant (the per-crystal
          // spread already lives in biasC), so the quantized cache key dedupes cleanly.
          const faces = wulffFaceSetForMineral(crystal.mineral, wf.growthFrac, 0, wf.biasC, kExp);
          // O0 half-form: clip at the attachment plane + real scar cap
          // (js/46 _makeWulffHalfFormGeom). Degenerate clip → full
          // polyhedron → primitive: the D2 robustness ladder, one rung longer.
          const g2 = faces
            ? (occF > 0
                ? (_makeWulffHalfFormGeom(faces, occF, _simOccF == null) || _makeWulffGeom(faces))
                : _makeWulffGeom(faces))
            : null;
          if (g2) { geom = g2; state.geomCache.set(key, geom); }
        }
        if (isCalWulff && geom) isWulffCalcite = true;     // signal the isotropic scale below
        if (isWfWulff && geom) isWulffWulfenite = true;    // signal the isotropic-by-diameter scale below
        if (isBaWulff && geom) isWulffBarite = true;       // signal the isotropic-by-diameter scale below (rung 4a.4)
        if (isTiWulff && geom) isWulffTitanite = true;     // signal the isotropic-by-diameter scale below (rung 4a.6)
        if (geom) _o2ConvexGeom = true;   // W-F O2: Wulff polyhedra + O0 half-forms are convex (cache hit or miss)
      }
    }
    // Dendrite TREE (morphology fix-backlog, 2026-06-12): dendritic /
    // arborescent habits get the branching skeleton instead of the
    // acicular-spike fallback. Gated on token === 'spike' so the
    // dripstone air-mode override and the twin tokens keep their own
    // geometry, and on the habit string so acicular/fibrous needles
    // stay needles. Mineral-agnostic by design — wittichen bismuth,
    // bisbee copper/gold, silver dendrites, and halite's efflorescent
    // dendritic_cube all read as trees.
    if (!geom && token === 'spike' && _isDendriticHabit(habitForGeom)) {
      geom = _getDendriteTreeGeom(state, crystal);
    }
    // Quartz GWINDEL (alpine-cleft arc SIM 207): the twisted column showpiece.
    // Takes render precedence over the sceptre (the crystal may carry both tags;
    // the twist is the dominant visual). Gated on the prism token.
    if (!geom && crystal.mineral === 'quartz' && crystal._gwindel && token === 'prism') {
      const td = Math.round((crystal._gwindel.twistDeg || 75) / 5) * 5;  // quantize for cache reuse
      if (crystal._gwindelGeomTd !== td) { crystal._gwindelGeom = _makeGwindelGeom(td); crystal._gwindelGeomTd = td; }
      geom = crystal._gwindelGeom;
    }
    // Quartz SCEPTRE (alpine-cleft arc SIM 206): a crystal the sim tagged with
    // _sceptre renders as the two-body stem+cap silhouette. Gated on the prism
    // token so twins / air-mode dripstone keep their own geometry, and skipped
    // when the crystal is also a gwindel (twist wins). Replay guard: before the
    // resorption boundary step the crystal is still a plain gen-1 prism.
    if (!geom && crystal.mineral === 'quartz' && crystal._sceptre && !crystal._gwindel && token === 'prism'
        && (replayStep == null || replayStep >= crystal._sceptre.boundaryStep)) {
      const cf = Math.round((crystal._sceptre.capFrac || 0.5) * 20) / 20;  // quantize for cache reuse
      // Eccentric cap (growth-centre migration — see _makeSceptreHexPrism): a
      // deterministic per-id lateral offset in 0.06..0.15 (never dead-coaxial —
      // real caps aren't), azimuth-scattered by the per-crystal yaw. Pure fn of
      // the id, so the cf-keyed per-crystal cache stays valid.
      const eccH = Math.abs(Math.sin((crystal.crystal_id || 1) * 12.9898)) % 1;
      const ecc = 0.06 + 0.09 * eccH;
      if (crystal._sceptreGeomCf !== cf) { crystal._sceptreGeom = _makeSceptreHexPrism(cf, ecc); crystal._sceptreGeomCf = cf; }
      geom = crystal._sceptreGeom;
    }
    // W-F O5 SPLITTING (S-b + S-c) — a crystal that EARNED a rung on the two-route
    // cumulative-misorientation ladder (js/44c _split) renders its divergent /
    // radial form, and (S-c) the FORM VARIES CONTINUOUSLY with `_split.index`
    // rather than snapping between fixed meshes:
    //   • curved  → the saddle-rhomb curved-face render, curvature = f(index),
    //     for the rhombohedral-carbonate / saddle set only (a curved gypsum keeps
    //     its blade — a rhomb would be wrong-shaped). This RETIRES the T-painted
    //     saddle constant FOR THE SPLIT-DRIVEN SET: placed before the T-driven
    //     saddle-habit hook below so it supersedes; a rung-'none' saddle dolomite
    //     still falls through to that hook.
    //   • split + sheaf → ONE continuous blade fan, splay = f(index): a just-split
    //     crystal is a narrow bundle (few subindividuals / splayed terminations),
    //     a mature sheaf a wide wheat-sheaf. The split→sheaf boundary no longer snaps.
    //   • spherulite → the radial botryoidal cluster, completeness = f(index): a
    //     just-crossed spherulite is tighter/under-grown, a full-index one a closed
    //     rosette — continuous with the widest sheaf.
    // Mineral-agnostic for the fan/sphere (a stilbite sheaf, an aragonite flos-ferri
    // sphere, a byssolite spray all read from the one form). SKIP when _deformation
    // is present — the shear-bent saddle is a SEPARATE cause (§9a #4;
    // tools/o5-split-census.mjs certifies these two sets do not collide). Gated by
    // O5_SPLITTING_ENABLED (js/44c); splitAbility-0 minerals (quartz/feldspar) never
    // carry _split, so their gwindel/sceptre hooks above are untouched. Params are
    // quantized before the cache key so the geom cache stays small.
    if (!geom && O5_SPLITTING_ENABLED && crystal._split && !crystal._deformation) {
      const _spIdx = Math.max(0, Math.min(1, crystal._split.index || 0));
      const _spRung = crystal._split.rung;
      const _isSaddleHabit = typeof crystal.habit === 'string' && crystal.habit.indexOf('saddle') >= 0;
      if (_spRung === 'curved' && (token === 'rhomb' || _isSaddleHabit)) {
        // curved band 0.08..0.25 → curvature 0.05..0.16 (gentle bow, clamped by the mesh)
        const curv = Math.round((0.05 + 0.11 * Math.max(0, Math.min(1, (_spIdx - 0.08) / 0.17))) * 100) / 100;
        const key = '__split_saddle_' + curv;
        geom = state.geomCache.get(key);
        if (!geom) { geom = _makeSaddleRhomb(curv); state.geomCache.set(key, geom); }
      } else if (_spRung === 'split' || _spRung === 'sheaf') {
        // split+sheaf band 0.25..0.85 → splay 0.30..1.08 rad (narrow bundle → wide sheaf)
        const splay = Math.round((0.30 + 0.78 * Math.max(0, Math.min(1, (_spIdx - 0.25) / 0.60))) * 20) / 20;
        const key = '__split_fan_' + splay;
        geom = state.geomCache.get(key);
        if (!geom) { geom = _makeHemimorphiteFan(splay); state.geomCache.set(key, geom); }
      } else if (_spRung === 'spherulite') {
        // spherulite band 0.85..1.0 → completeness 0..1 (tight → closed rosette)
        const comp = Math.round(Math.max(0, Math.min(1, (_spIdx - 0.85) / 0.15)) * 20) / 20;
        const key = '__split_sph_' + comp;
        geom = state.geomCache.get(key);
        if (!geom) { geom = _makeBotryoidalCluster(comp); state.geomCache.set(key, geom); }
      }
    }
    // Saddle (baroque) DOLOMITE curved-face rhombohedron (deformation arc
    // 2026-06-20). Gated on the habit string 'saddle_rhomb' — mineral-agnostic
    // so a future saddle siderite/rhodochrosite inherits it for free. RENDER-
    // ONLY: the engine already assigns this habit, and only to warm hydrothermal
    // dolomite (tools/saddle-dolomite-observe.mjs confirms ambient scenarios
    // stay 'massive', so the science gate is in grow_dolomite, not here).
    // Before this hook 'saddle_rhomb' missed the 'rhombohedral' substring in
    // _habitGeomToken and fell to the default hex prism — a token wart.
    if (!geom && typeof crystal.habit === 'string' && crystal.habit.indexOf('saddle') >= 0) {
      let tSum = 0, tN = 0;
      for (const z of (crystal.zones || [])) { if (z.thickness_um > 0 && isFinite(z.temperature)) { tSum += z.temperature; tN++; } }
      const tRep = tN ? tSum / tN : 90;  // representative growth T
      // bow amplitude rises gently with T above the ~60 °C roughening band
      // (Gregg & Sibley 1984) — qualitative in the literature, so clamped.
      const amp = Math.max(0.06, Math.min(0.20, 0.06 + 0.0016 * (tRep - 60)));
      const q = Math.round(amp * 100) / 100;  // quantize for cache reuse
      if (crystal._saddleGeomAmp !== q) { crystal._saddleGeom = _makeSaddleRhomb(q); crystal._saddleGeomAmp = q; }
      geom = crystal._saddleGeom;
    }
    // BENT crystal — post-growth deformation overprint (deformation/shear arc
    // 2026-06-20). The sim tags crystal._deformation when a scenario shear event
    // bent a crystal that had already grown (js/45 classifyDeformation). Gated on
    // the prism token (the quartz tenant); the bend transform replaces the
    // straight prism with an arced one. Takes precedence over gwindel/sceptre is
    // unnecessary — those are quartz-cleft features and the bend tenant (tormiq)
    // shares none of them, so order doesn't collide; placed last among the quartz
    // hooks. (A replay before the shear step keeps the straight prism.)
    if (!geom && crystal._deformation && crystal._deformation.kind === 'bend' && token === 'prism'
        && (replayStep == null || replayStep >= crystal._deformation.atStep)) {
      const bend = Math.max(0.15, Math.min(0.6, 0.15 + (crystal._deformation.amount || 0.5) * 0.45));
      const q = Math.round(bend * 100) / 100;  // quantize for cache reuse
      if (crystal._bentGeomAmt !== q) { crystal._bentGeom = _makeBentPrism(q); crystal._bentGeomAmt = q; }
      geom = crystal._bentGeom;
    }
    // GYPSUM HOURGLASS (selenite) — the visible sandglass of trapped clay/Fe sediment
    // inside a water-clear blade (Great Salt Plains; js/45 _seleniteHourglassParams).
    // NOT gated on the prism token: selenite has its own bladed geometry. The body is
    // pale clear gypsum, the inclusion sector amber→chocolate by trapped-load intensity;
    // `flooded` buries the contrast to solid brown (the overgrown variant). Bucketed
    // cache key (intensity rounded to 0.1) keeps the geom cache small.
    let isGypsumHourglass = false;
    if (!geom && crystal._sectorZoned && crystal._sectorZoned.kind === 'gypsum_hourglass') {
      const hg = crystal._sectorZoned;
      const inten = Math.max(0.15, Math.min(1, hg.intensity || 0.5));
      const bucket = Math.round(inten * 10) / 10;
      const flooded = !!hg.flooded;
      const steps = hg.steps | 0;                   // 0 = smooth chisel tip; ≥2 = stepped ziggurat
      const key = '__gypsum_hg_' + bucket + (flooded ? '_f' : '') + '_s' + steps;
      geom = state.geomCache.get(key);
      if (!geom) {
        // amber (#c89a5b, light load) → chocolate (#5a3621, heavy load), per USFWS
        // "reddish to chocolate brown" iron-oxide staining.
        const sector = new THREE.Color('#c89a5b').lerp(new THREE.Color('#5a3621'), bucket);
        const clear = new THREE.Color('#e8e2d4');     // pale water-clear gypsum body
        // Flooded: body collapses most of the way toward the sector colour (solid brown).
        const bodyCol = flooded ? clear.clone().lerp(sector, 0.8) : clear;
        geom = _makeHourglassSeleniteBlade(
          [bodyCol.r, bodyCol.g, bodyCol.b], [sector.r, sector.g, sector.b], flooded, steps);
        state.geomCache.set(key, geom);
      }
      isSectorZoned = true;
      isGypsumHourglass = !crystal._sectorZoned.flooded;   // clear blade reads translucent; flooded reads opaque
    }
    // SECTOR (HOURGLASS) ZONING — crystals tagged by js/45 classifySectorZoning
    // (tourmaline + future sector minerals) render with the pyramid termination
    // sector painted a contrasting colour from the prism body (Dowty 1976 / Ferguson
    // 1973 hourglass; for tourmaline this IS the iconic bicolor elbaite). Gated on
    // the prism token so twins / dripstone keep their geometry. The geom bakes
    // ABSOLUTE per-vertex colours (body = class_color, termination = hue-rotated
    // contrast); the matOpts block below sets color=white + vertexColors so the baked
    // colours render directly. Cached per base colour.
    if (!geom && crystal._sectorZoned && token === 'prism') {
      const szSpec = (typeof MINERAL_SPEC !== 'undefined' && MINERAL_SPEC) ? MINERAL_SPEC[crystal.mineral] : null;
      const szBase = (szSpec && szSpec.class_color) || '#2f9e5e';
      const body = new THREE.Color(szBase);
      if (crystal._sectorZoned.kind === 'cross') {
        // CHIASTOLITE — square prism + dark carbon cross (the corner growth sectors).
        const key = '__chiastolite_' + szBase;
        geom = state.geomCache.get(key);
        if (!geom) {
          const cross = new THREE.Color('#161410');   // graphite near-black
          geom = _makeChiastolitePrism([body.r, body.g, body.b], [cross.r, cross.g, cross.b]);
          state.geomCache.set(key, geom);
        }
      } else if (crystal._sectorZoned.kind === 'apophyllite_green') {
        // GREEN POONA APOPHYLLITE — a tetragonal square prism, UNIFORM V⁴⁺ green body
        // (Rossman 1974, Am.Min. 59:621), tips a hair lighter (transparency), {001}
        // basal face a pearly green-white luster. Image-corpus verified (Pune, 2026-06-21):
        // green is a uniform body colour, NO visible prism-vs-pyramid sector partition.
        // Apophyllite's sector zoning is real but OPTICAL-only (anomalous birefringence,
        // crossed-polars) — not visible colour, so NOT a colour hourglass (see js/45).
        // Fixed baked vertex colours (NOT class_color, a placeholder blue). One geom for
        // all green apophyllite.
        const key = '__apophyllite_green';
        geom = state.geomCache.get(key);
        if (!geom) {
          // UNIFORM V⁴⁺ green body (image-corpus verified: Pune apophyllite green is
          // a uniform body colour, NOT a visible colour-sector partition). Tips read
          // slightly lighter from TRANSPARENCY; the basal {001} face is the one real
          // visible face contrast — a pearly (green-tinted, not white) LUSTER.
          const prism = new THREE.Color('#5fb87a');    // green prism body
          const pyramid = new THREE.Color('#74c191');   // same green, a hair lighter (transparent tips)
          const basal = new THREE.Color('#cfe6d6');     // pearly green-white {001} basal-face luster
          geom = _makeApophyllitePrism([prism.r, prism.g, prism.b], [pyramid.r, pyramid.g, pyramid.b], [basal.r, basal.g, basal.b]);
          state.geomCache.set(key, geom);
        }
      } else {
        // HOURGLASS (tourmaline) — hex prism + tinted termination sector. The
        // termination is a hue-rotated contrast of the mineral colour (green body
        // → pink/magenta tip — the iconic bicolor elbaite).
        const key = '__sectorzoned_' + szBase;
        geom = state.geomCache.get(key);
        if (!geom) {
          const term = body.clone().offsetHSL(0.45, 0.12, -0.04);
          geom = _makeSectorZonedPrism([body.r, body.g, body.b], [term.r, term.g, term.b]);
          state.geomCache.set(key, geom);
        }
      }
      isSectorZoned = true;
    }
    // HEMIMORPHITE — orthorhombic (mm2), NOT hexagonal: render the signature divergent fan /
    // sheaf of thin tabular hemimorphic blades (the Tsumeb "bowtie"), pointed free ends / flat
    // pedion bases. Catches hemimorphite BEFORE the generic hexagonal hemimorphic-prism below
    // (which is right only for the genuinely 6mm tenants greenockite/wurtzite). It still carries
    // _polarAxis (correctly — mm2 is polar); only the geometry differs. Specimen-debt fix
    // 2026-06-23. Render-only; one cached geom.
    if (!geom && crystal.mineral === 'hemimorphite') {
      geom = state.geomCache.get('__hemimorphite_fan');
      if (!geom) { geom = _makeHemimorphiteFan(); state.geomCache.set('__hemimorphite_fan', geom); }
    }
    // HEMIMORPHIC polar termination (central-distance arc Phase 3, 2026-06-22) — the hexagonal
    // polar tenants (wurtzite/greenockite 6mm, tagged _polarAxis by js/45 classifyPolarAxis;
    // hemimorphite is caught above) render with DIFFERENT terminations: a dominant +c pyramid +
    // flat -c pinacoid. Gated on a prism/spike token + !geom so tourmaline's sector-zoned
    // hourglass (set above, already pyramid-top/flat-base) wins and other specials are untouched.
    // Also fixes the greenockite 'hexagonal_pyramidal' → 'prism' token wart (it fell to a generic
    // hex prism). Render-only; one cached geom for the polar hexagonal prisms.
    if (!geom && crystal._polarAxis && (token === 'prism' || token === 'spike')) {
      geom = state.geomCache.get('__hemimorphic');
      if (!geom) { geom = _makeHemimorphicPrism(); state.geomCache.set('__hemimorphic', geom); }
    }
    // R4b: ordinary sulfides use their own symmetry-restricted face families.
    // Specials above (etches, twins, skeletal growth, deformation) keep priority.
    if (!geom && !crystal.twinned && !crystal._surfaceGrowth
        && ((crystal.mineral === 'sphalerite' && ['tetrahedron', 'rhombic_dodec', 'dodecahedron'].includes(token))
          || (crystal.mineral === 'pyrite' && ['cube', 'octahedron', 'dodecahedron'].includes(token)))) {
      const variant = Math.abs(Math.trunc(crystal.crystal_id || 0)) % 8;
      const key = '__sulfide_r4_' + crystal.mineral + '_' + token + '_' + variant
        + '_' + occF + '_' + (_simOccF == null);
      geom = state.geomCache.get(key);
      if (!geom) {
        geom = makeSulfideRenderGeometry(crystal.mineral, token, variant, occF, _simOccF == null);
        if (geom) state.geomCache.set(key, geom);
      }
      if (geom) _o2ConvexGeom = true;
    }
    // Ordinary gypsum/selenite and dolomite: defer until display dimensions
    // are known; recorded twins, hourglass sectors and curved forms keep priority.
    const bariteR4 = !geom && crystal.mineral === 'barite' && !crystal.twinned && !crystal._surfaceGrowth
      && !crystal._deformation
      && ['tabular', 'bladed', 'cockscomb', 'prismatic'].includes(crystal.habit);
    const bladeRhombR4 = !geom && !crystal.twinned && !crystal._surfaceGrowth
      && (((crystal.mineral === 'gypsum' || crystal.mineral === 'selenite') && ['tablet', 'prism'].includes(token))
        || (crystal.mineral === 'dolomite' && token === 'rhomb'));
    // Only ordinary quartz enters R4: all recorded special forms above retain
    // precedence. Defer its geometry until the final display dimensions are known.
    const quartzR4 = !geom && crystal.mineral === 'quartz' && token === 'prism'
      && !crystal.twinned && !crystal._surfaceGrowth;
    // SYSTEM-AWARE prism cross-section (specimen-debt fidelity arc 2026-06-23): a NON-hexagonal
    // mineral that resolves to the generic 'prism' token must not render as a hexagonal prism.
    // Redirect by crystal system (square / rectangular / sheared) before the hex fallback below.
    // Hex/trigonal/unknown minerals aren't in CRYSTAL_SYSTEM → they keep the hex builder
    // (byte-identical). Gated on !geom so all the special builders above still win.
    if (!geom && token === 'prism') {
      const sys = CRYSTAL_SYSTEM[crystal.mineral];
      if (sys) {
        const skey = '__sysprism_' + sys;
        geom = state.geomCache.get(skey);
        if (!geom) { geom = _makeSystemPrism(sys); state.geomCache.set(skey, geom); }
        _o2ConvexGeom = true;   // W-F O2: square/rectangular/sheared prisms are convex
      }
    }
    if (!geom) {
      geom = state.geomCache.get(token);
      if (!geom) {
        geom = _buildHabitGeom(token);
        state.geomCache.set(token, geom);
      }
      // W-F O2: the primitive habit builders are convex for the convex tokens
      // (the token gate at the clip site filters botryoidal/dripstone/spike-fan).
      if (geom && _O2_CONVEX_TOKENS.has(token)) _o2ConvexGeom = true;
    }

    // v66 paramorph rewind — argentite → acanthite (and dehydration
    // transitions like borax → tincalconite) flip a crystal's mineral
    // mid-life at a recorded step. During replay before that step we
    // want the ORIGINAL mineral's color/material (pre-cooled argentite
    // looks different from acanthite), so swap to paramorph_origin
    // when replayStep < paramorph_step.
    const effectiveMineral = mineralAtReplayStep(crystal, replayStep);

    // Material — the ONE optics builder (Depth-A, RESEARCH-optical-realism-2026-07-02.md §4.2).
    // All the former inline assembly (class_color, class metalness/roughness heuristics, the
    // CDR/etched/perimorph/sector-zoned/hourglass state modifiers) lives in
    // buildCrystalMaterial now, PLUS the new per-mineral diaphaneity → % translucency (clarity
    // from the verified optics blocks; class default for the tail). The hourglass 0.82 magic
    // number retired into the builder's inclusion-body clarity cap.
    const spec = (typeof MINERAL_SPEC !== 'undefined' && MINERAL_SPEC) ? MINERAL_SPEC[effectiveMineral] : null;
    const isPerimorphCast = crystal.dissolved && crystal.perimorph_eligible;
    const mat = buildCrystalMaterial(crystal, spec, {
      isCdrPseudomorph, isEtched, isPerimorphCast, isSectorZoned, isGypsumHourglass, isInclusion,
    });
    _applyCavityClip(mat, state.clipUniforms);
    if (geom.userData.sulfideR4?.mineral === 'pyrite') applyPyriteStriations(mat);

    const mesh = new THREE.Mesh(geom, mat);

    // Scale: c-axis along Y in the unit primitive → scale Y by
    // c_length_mm. a-axis (perpendicular) scales by a_width_mm.
    // Floor at 2 mm c / 1.5 mm a so a typical 30 mm cavity reads as
    // dotted with macro-crystals rather than dusted with invisible
    // ones. Aesthetic-over-accurate trade-off; E4 can revisit once
    // the camera supports zoom-into-cavity for true scale.
    //
    // Isometric tokens (cube, octahedron, rhombic_dodec) override to
    // uniform scale: the crystal-side `a_width_mm = c × 0.5` fallback
    // in 27-geometry-crystal.ts treats every habit not in its
    // {prismatic, tabular, acicular, rhombohedral} set as 2:1 elongate,
    // so a fluorite cube ends up rendered as a 2:1 rectangle. Geologically
    // wrong (cubic-system crystals are 1:1:1 by definition); the dispatch
    // is part of the v48 baseline so we override at the renderer rather
    // than touching the sim. cLen is the larger floor so isometric
    // crystals don't shrink below visible.
    // Visibility floor — tiny crystals (sub-millimeter) need a minimum
    // rendered size or they vanish in a 30+ mm vug. Independent floors
    // on c and a (the previous approach) produce near-cube proportions
    // when both are below their floors, which is wrong for tabular,
    // botryoidal, acicular, etc. Boss-spotted: tiny barites + selenites
    // looked like cubes instead of plates; chalcedony rendered as a
    // quartz point instead of a wall crust.
    //
    // Fix: compute the rendered aspect from the habit's expected ratio
    // when either dimension is at the floor. The geomToken-keyed ratio
    // table mirrors 27-geometry-crystal.ts:_update_dimensions but indexed
    // post-token-mapping so multi-word habit strings collapse to the
    // right shape.
    //
    // Narrative-tempo Phase 5 (2026-05-11 boss bug report): during
    // narrative playback (replayStep != null) the floor was making
    // crystals look fully grown at step 1 because their 0.01-0.1 mm
    // historical sizes were floored UP to 2.0 mm — defeating the whole
    // point of the step-paced replay. During replay we skip the floor,
    // so crystals genuinely appear small at first and grow naturally as
    // the step advances. They may still be sub-pixel for the first few
    // steps; that's the right look (a real cavity looks empty at the
    // moment of first nucleation too). Live render keeps the floor for
    // aesthetic readability of tiny mature crystals.
    const inReplay = (replayStep != null);
    const C_FLOOR = inReplay ? 0.0 : 2.0;
    const A_FLOOR = inReplay ? 0.0 : 1.5;
    const targetRatio = _GEOM_TOKEN_RATIO[token] ?? 0.5;
    let cLen = Math.max(C_FLOOR, renderC);
    let aWid = Math.max(A_FLOOR, renderA);
    const wasFloored = !inReplay && (renderC < C_FLOOR || renderA < A_FLOOR);
    if (wasFloored) {
      // Re-derive aspect from habit so the floor doesn't squash everything
      // toward 1:1. For tablet-like habits (ratio >= 1) widen aWid; for
      // prism-like habits (ratio < 1) lengthen cLen.
      if (targetRatio >= 1.0) {
        aWid = Math.max(aWid, cLen * targetRatio);
      } else {
        cLen = Math.max(cLen, aWid / targetRatio);
      }
    }
    // W-F O4a — an inclusion keeps its true (small) frozen size but bypasses the
    // 2 mm visibility floor above (which would burst it out of the host). A final
    // cap relative to the host's RENDERED reach is applied in pass 2 (below).
    if (isInclusion) {
      cLen = Math.max(renderC, O4_INCLUSION_MIN_MM);
      aWid = Math.max(renderA, O4_INCLUSION_MIN_MM);
    }
    let bariteGeometry: any = null;
    if (bariteR4 && cLen > 0) {
      const key = '__barite_r4_' + crystal.habit + '_' + occF;
      bariteGeometry = state.geomCache.get(key);
      if (!bariteGeometry) {
        bariteGeometry = makeBariteRenderGeometry(crystal.habit, occF);
        if (bariteGeometry) state.geomCache.set(key, bariteGeometry);
      }
      if (bariteGeometry) { geom = bariteGeometry; mesh.geometry = geom; _o2ConvexGeom = true; }
    }
    let bladeRhombGeometry: any = null;
    if (bladeRhombR4 && cLen > 0) {
      const ratio = Math.round(Math.max(0.25, Math.min(token === 'tablet' ? 0.9 : 0.6, aWid / cLen)) * 40) / 40;
      const key = '__blade_rhomb_r4_' + crystal.mineral + '_' + token + '_' + ratio + '_' + occF;
      bladeRhombGeometry = state.geomCache.get(key);
      if (!bladeRhombGeometry) {
        bladeRhombGeometry = makeBladeRhombRenderGeometry(crystal.mineral, token, ratio, occF);
        if (bladeRhombGeometry) state.geomCache.set(key, bladeRhombGeometry);
      }
      if (bladeRhombGeometry) {
        geom = bladeRhombGeometry; mesh.geometry = geom; _o2ConvexGeom = true;
        if (crystal.mineral !== 'dolomite') applyGypsumCleavage(mat);
      }
    }
    let quartzGeometry: any = null;
    if (quartzR4 && cLen > 0) {
      const history = quartzRenderHistory(crystal, replayStep);
      const ratio = Math.round(Math.max(0.2, Math.min(1.1, aWid / cLen)) * 100) / 100;
      const key = '__quartz_r4_' + ratio + '_' + history.contrast + '_' + history.phase;
      quartzGeometry = state.geomCache.get(key);
      if (!quartzGeometry) {
        quartzGeometry = makeQuartzRenderGeometry(ratio, history.contrast, history.phase);
        if (quartzGeometry) state.geomCache.set(key, quartzGeometry);
      }
      if (quartzGeometry) {
        geom = quartzGeometry;
        mesh.geometry = geom;
        _o2ConvexGeom = true;
        applyQuartzStriations(mat, history);
      }
    }
    if (quartzGeometry || bladeRhombGeometry || bariteGeometry) {
      mesh.scale.set(cLen, cLen, cLen);
    } else if (token === 'cube' || token === 'octahedron' || token === 'tetrahedron' || token === 'rhombic_dodec' || token === 'dodecahedron' || token === 'snowball' || isWulffCalcite) {
      // isWulffCalcite (rung 4a.2): the calcite Wulff polyhedron already carries its true
      // crystallographic c-elongation (kernel builds c on Y, normalized to ±0.5), so it scales
      // UNIFORMLY by cLen — the geom's own aspect gives the nailhead-vs-dogtooth shape. Applying
      // the token's anisotropic (aWid,cLen,aWid) here would double-stretch the already-elongated geom.
      mesh.scale.set(cLen, cLen, cLen);
    } else if (isWulffWulfenite || isWulffBarite || isWulffTitanite) {
      // isWulffWulfenite (4a.3, tetragonal) + isWulffBarite (4a.4, orthorhombic) + isWulffTitanite (4a.6,
      // MONOCLINIC): all carry their full shape INTERNALLY in the normalized ±0.5 polyhedron, so they
      // scale ISOTROPICALLY by the max extent = max(aWid, cLen). The token's (aWid,cLen,aWid) would
      // re-flatten the geom; scaling by cLen alone (the calcite path) would shrink it to one axis. The
      // bodies differ only in the geom's own aspect: wulfenite is a SQUARE tabular plate (a=b), barite a
      // RECTANGULAR one (a≠b ≈ 1.28:1), and titanite the OBLIQUE SPHENOID WEDGE (b the long axis, the
      // {100}∧{001}=66.19° lean baked into the faces) — one scale rule serves all three.
      const s = Math.max(aWid, cLen);
      mesh.scale.set(s, s, s);
    } else if (token === 'botryoidal') {
      // Botryoidal crusts spread laterally on the wall — the c-axis (along
      // the substrate normal) should be SHORTER than the a-axis. Sim-side
      // a_width is c × 0.5 by default for non-tabular habits, which gives
      // wrong-direction proportions for crusts. Override here so chalcedony
      // / banded malachite / smithsonite botryoidal crusts read as flat
      // domes instead of vertical spikes.
      const crustLat = Math.max(aWid, cLen * 1.5);
      const crustH = Math.min(cLen, crustLat * 0.4);
      mesh.scale.set(crustLat, crustH, crustLat);
    } else if (token === 'scalene') {
      // Scalenohedral (dogtooth) — display width CAPPED at the family's
      // declared aspect (_GEOM_TOKEN_RATIO.scalene = 0.6, already the table's
      // stated truth but previously consulted only on the visibility-floor
      // path). a_width_mm is the ellipsoid-volume MEASUREMENT (feeds vug
      // fill — the js/27 byte-identity keystone), not a shape statement: a
      // mature calcite that integrated ~900 mm³ reads back a≈c (the elmwood
      // 19 mm hero measured 13.3 × 11.5 mm, ratio 1.16) and rendered as an
      // even-square double pyramid. Boss eye-check vs Elmwood #103941
      // (2026-07-24): dogtooth calcite is "taller than they are wide", and
      // double-terminated ones are never an even square. Mirror-image of the
      // botryoidal override above — sim-side dimensions untouched, the
      // display honors the form.
      const aTooth = Math.min(aWid, cLen * _GEOM_TOKEN_RATIO.scalene);
      mesh.scale.set(aTooth, cLen, aTooth);
    } else {
      mesh.scale.set(aWid, cLen, aWid);
    }
    mesh.renderOrder = 1;
    // R2: the transmissive path length is the crystal's own smallest rendered extent.
    if (bladeRhombGeometry && crystal.mineral !== 'dolomite') {
      bladeRhombGeometry.computeBoundingBox();
      const dims = bladeRhombGeometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);
      _opticsApplyExtent(mat, Math.min(dims.x, dims.y, dims.z));
    } else _opticsApplyExtent(mat, _opticsExtentOfScale(mesh.scale));

    // Position the BASE of the primitive at the anchor (instead of
    // the centroid), so the crystal projects into the cavity rather
    // than half-buried in the wall. Translate along the c-axis
    // direction by half the c-length — for fluid crystals this is
    // substrate-normal; for air-mode crystals it's gravity-aligned
    // (so stalactites drop straight down from the ceiling anchor).
    //
    // SUBSTRATE OCCLUSION (central-distance arc Phase 2, 2026-06-22): a wall-nucleated crystal
    // is sealed against the host over its attachment footprint, so the buried -c fraction does
    // NOT project into the cavity. Sink the base by occF·cLen — pulling the centroid back toward
    // the wall by the same amount — so only the emergent (1-occF) length + the free termination
    // show: the singly-terminated drusy read. occF comes from the W-F O0 block above the geom
    // chain: sim-declared _occlusion.attachedFraction when present, the 0.5 half-form default
    // for equant closed forms, 0 (exact base-at-anchor float) for everything else.
    const offsetMm = cLen * (0.5 - occF);
    if (isInclusion) {
      // W-F O4a — provisional spot; pass 2 (after the loop) moves it inside the
      // host once every mesh exists. No base-projection offset (an inclusion is
      // entombed, not projecting from a substrate).
      mesh.position.set(ax, ay, az);
    } else {
      mesh.position.set(
        ax + cAxisX * offsetMm,
        ay + cAxisY * offsetMm,
        az + cAxisZ * offsetMm,
      );
    }

    // Orient so the local +Y axis aligns with the c-axis direction.
    // Three.js Object3D.lookAt orients local -Z toward the target;
    // we want local +Y. quaternion.setFromUnitVectors handles it.
    const up = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Vector3(cAxisX, cAxisY, cAxisZ);
    mesh.quaternion.setFromUnitVectors(up, target);
    // Per-crystal yaw around c-axis — real crystals nucleate with
    // random crystallographic orientation around their growth axis;
    // without this every cube/prism in a cluster shares the same
    // face-toward-camera rotation. rotateY composes the local +Y
    // rotation AFTER the substrate orientation, so the spin happens
    // around the (now world-space) substrate normal.
    mesh.rotateY(_crystalYaw(crystal.crystal_id || 0));

    // W-F O2 — induction surfaces. Clip this crystal against the neighbours it
    // grew into and cap each cut with a matte contact facet (Self & Hill 2003;
    // competitive growth). Convex tenants only (_o2ConvexGeom + the token gate —
    // concave hopper/botryoidal/twin have no single convex cap); stepped/etched/
    // e-twin/hourglass overprints and enclosed guests (O4's job) opt out. The
    // meeting plane uses INTEGRATED-GROWTH weights (C1, 2026-07-07): the plane
    // sits at the growth-ratio point gA/(gA+gB), gross linear growth — faithful
    // for dissolved-and-regrown or anisotropic bodies where current size ≠ growth
    // history, and depletion-aware because the growth loop already reads cell σ.
    // Falls back to current-size (reach, Diggle first-order) when either body
    // lacks a growth scalar. Render-only: replaces mesh.geometry with a fresh
    // clipped geom, leaving the cached form intact for the satellites + geomCache.
    let ownsContactGeometry = false;
    if (_o2ConvexGeom && _O2_CONVEX_TOKENS.has(token)
        && !isEtched && !isSectorZoned && !isGypsumHourglass
        && crystal.enclosed_by == null && _o2Bodies.length > 1 && mesh.geometry) {
      const meX = mesh.position.x, meY = mesh.position.y, meZ = mesh.position.z;
      const myReach = Math.max(0.5 * Math.sqrt(2 * aWid * aWid + cLen * cLen),
        bladeRhombGeometry && crystal.mineral === 'dolomite' ? cLen * dolomiteRenderRadius() : 0);
      const worldPlanes: any[] = [];
      for (const b of _o2Bodies) {
        if (b.id === crystal.crystal_id || b.enclosed) continue;
        const dx = b.cx - meX, dy = b.cy - meY, dz = b.cz - meZ;
        const D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (D < 1e-3 || D >= myReach + b.reach) continue;   // no overlap → no contact (current-size bound)
        const inv = 1 / D, nX = dx * inv, nY = dy * inv, nZ = dz * inv;   // A→B
        // C1 — integrated-growth meeting point gA/(gA+gB); current-size fallback
        // (reach) when either body has no growth scalar, keeping the weight
        // unit-consistent (never mix mm-reach with µm-growth in one ratio).
        const gA = crystal.total_growth_um > 0 ? crystal.total_growth_um : 0;
        const gB = b.growth;
        const dA = (gA > 0 && gB > 0)
          ? D * gA / (gA + gB)
          : D * myReach / (myReach + b.reach);
        worldPlanes.push({ n: [nX, nY, nZ], d: nX * meX + nY * meY + nZ * meZ + dA });   // keep A: n·x ≤ d
      }
      if (worldPlanes.length) {
        const e = new THREE.Matrix4().makeRotationFromQuaternion(mesh.quaternion).elements;
        const xf = {
          R: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]],   // row-major rotation
          sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z, tx: meX, ty: meY, tz: meZ,
        };
        const local = worldPlanes.map((p) => _o2WorldPlaneToNative(p.n, p.d, xf, 1));
        const clipped = _clipConvexGeom(mesh.geometry, local);
        if (clipped && clipped.contactTris > 0) {
          if (mesh.geometry.userData.sulfideR4) transferSulfideGrooves(mesh.geometry, clipped.geom);
          if (mesh.geometry.userData.bladeRhombR4) {
            clipped.geom.userData.bladeRhombR4 = mesh.geometry.userData.bladeRhombR4;
            if (crystal.mineral !== 'dolomite') gypsumCleavageHeight(clipped.geom, mesh.geometry.userData.bladeRhombR4.attachFrac);
          }
          if (mesh.geometry.userData.bariteR4) clipped.geom.userData.bariteR4 = mesh.geometry.userData.bariteR4;
          mesh.geometry = clipped.geom;
          ownsContactGeometry = true;
          mesh.material = [mat, _o2ContactMaterial(mat, state)];
        }
      }
    }

    // userData carries the original Crystal (and its id) so the
    // raycaster in _topoHitTestThree can resolve a hit back to a
    // mineral name + cell shape that matches the canvas-vector
    // hit-test return contract. Subset of fields — enough for
    // tooltip + lock-target consumers, the full crystal is also
    // findable by id via sim.crystals if a consumer needs more.
    mesh.userData = {
      crystal_id: crystal.crystal_id,
      ownsGeometry: ownsContactGeometry,
      // v66: report the effectiveMineral (paramorph-rewound during
      // replay) so hit-test tooltips match what the user sees.
      mineral: effectiveMineral,
      ringIdx,
      cellIdx,
      surfaceAnchorKey: wall.surfaceAnchorKey?.(crystal),
      // === HELIX-OVERLAY-FORK ADDITION (v13) =========================
      // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
      // breadcrumb. Sweep-writes-crystals mode: the helix overlay
      // multiplies this mesh's material opacity by a 0→1 sweep factor
      // as the leading edge passes this anchor. naturalOpacity is the
      // builder's RESOLVED opacity (Depth-A: diaphaneity translucency,
      // perimorph 0.42 ceiling, …) so the overlay-off restore path
      // returns exactly what buildCrystalMaterial decided — the same
      // generic capture the satellites already used.
      naturalOpacity: mat.transparent ? mat.opacity : 1.0,
      // === END HELIX-OVERLAY-FORK ADDITION ===========================
    };

    // An aggregate surface fabric is represented by its swath, not by the old
    // trophy-sized parent body as well. Keeping both would visually double one
    // booked Crystal and contradict the mass ledger.
    _addCrystalParentRepresentation(state, crystal, mesh);
    // A booked aggregate can occupy a broad wall swath even though it is one
    // Crystal record. Emit one instanced representative layer; it neither adds
    // simulation entities nor multiplies the accepted mineral volume.
    if (!isInclusion && crystal._surfaceGrowth) {
      _emitSurfaceGrowthSwath(
        state, crystal, mat, ax, ay, az,
        wall, ringCount, N, initR, renderC, sim, _surfaceLayers,
      );
    }
    // W-F O4a — register every crystal as a possible host, and defer inclusion
    // placement to pass 2 (the host mesh may build later in this same loop).
    _hostMeshById.set(crystal.crystal_id, mesh);
    if (isInclusion) {
      _pendingInclusions.push({ mesh, ax, ay, az, hostId: crystal.enclosed_by, cid: crystal.crystal_id });
    }

    // W-F O5c — the phantom band made visible. Each masked_horizon zone (a
    // front that grew THROUGH a foreign film, js/85 gate) renders as a thin
    // concentric shell at its recorded radial depth. Free-standing crystals
    // only — an engulfed guest (O4a) is a tiny grain inside a host, its own
    // internal bands invisible and not worth the meshes. Render-only.
    if (!isInclusion) _o5EmitMaskedBands(mesh, crystal, state);

    // Phase E5b: emit cluster satellites around this parent. Same
    // geometry + material; inherits parent userData so hit-tests
    // resolve a satellite click back to the parent crystal. The
    // geomToken selects a per-habit cluster pattern (acicular spray,
    // tabular rosette, prismatic forest, cubic carpet, etc.). An engulfed
    // inclusion has no free druse spray, so it opts out (W-F O4a).
    if (!isInclusion && !crystal._surfaceGrowth) {
      _emitClusterSatellites(state, crystal, geom, mat, ax, ay, az, nx, ny, nz, cLen, aWid, token, wall, ringCount, N, initR, occF, mesh);
    }
  }

  // === W-F O4a pass 2 — engulfment placement ==========================
  // Each guest sits INSIDE its host, positioned off the host's ACTUAL rendered
  // bounds (bounding sphere × scale), not the sim's uncapped c_length — for a
  // capped giant blade (Naica selenite: 66 mm sim vs ~13 mm rendered) the latter
  // overshoots 3×, spilling guests outside the visible host. A deterministic
  // per-id radial fraction fills the interior; direction = the side the guest
  // nucleated on (its own wall anchor), with an id-based fallback when that is
  // degenerate. Guests whose host didn't render (dissolved) keep their
  // provisional anchor spot. Render-only — mutates no crystal.
  for (const inc of _pendingInclusions) {
    const hm = _hostMeshById.get(inc.hostId);
    if (!hm || !hm.geometry) continue;
    hm.geometry.computeBoundingSphere();
    const bs = hm.geometry.boundingSphere;
    const hostR = (bs ? bs.radius : 1) * Math.max(hm.scale.x, hm.scale.y, hm.scale.z);
    const hc = hm.position;
    const [px, py, pz] = _o4InclusionLocalPos(inc.ax, inc.ay, inc.az, hc.x, hc.y, hc.z, hostR, inc.cid);
    inc.mesh.position.set(px, py, pz);
    // Never let a guest render bigger than half the host — keep it enclosed.
    const cap = hostR * O4_INCLUSION_SIZE_CAP_FRAC;
    const s = inc.mesh.scale;
    const mx = Math.max(s.x, s.y, s.z);
    if (cap > 0 && mx > cap) { const k = cap / mx; s.set(s.x * k, s.y * k, s.z * k); }
  }
  // === END W-F O4a pass 2 =============================================
}

// Cached raycaster + NDC vector — both reusable across calls,
// avoiding per-pointer-move allocations.
const _topoThreeRaycaster: { ray?: any; ndc?: any } = {};

function _topoSelectVisibleCavityHit(intersects: any[], clipField: any, isovalue = 0): any {
  if (!Array.isArray(intersects) || !intersects.length) return null;
  if (!clipField || typeof clipField.sampleTextureWorld !== 'function') return intersects[0];
  const iso = Number(isovalue);
  if (!Number.isFinite(iso)) throw new TypeError('cavity hit-test isovalue must be finite');
  for (const candidate of intersects) {
    const point = candidate && candidate.point;
    if (!point) continue;
    const value = clipField.sampleTextureWorld(point.x, point.y, point.z);
    // The shader retains the equality case (`discard` is strictly below iso).
    if (value >= iso) return candidate;
  }
  return null;
}

// Three.js hit-test. Resolves a screen-space pointer to a
// `{ mineral, isInclusion, cell }` triple shaped like the canvas-
// vector hit-test, so _topoTooltipFromEvent / _topoClickFromEvent
// don't need a Three-specific path. Returns null if the pointer
// isn't over any crystal.
//
// The cavity mesh is intentionally excluded from intersection
// checks (set `cavity.raycast = function(){}` at init) — bare-wall
// hovers in Three mode don't get a tooltip (matches the
// `_topoView3D` short-circuit in _topoTooltipFromEvent), only
// crystal hits do.
function _topoHitTestThree(ev: any): any {
  if (!_topoThreeState || !_topoThreeAvailable()) return null;
  const canvas = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  // Normalized device coords ∈ [-1, +1].
  const ndcX = (mx / rect.width) * 2 - 1;
  const ndcY = -((my / rect.height) * 2 - 1);

  if (!_topoThreeRaycaster.ray) {
    _topoThreeRaycaster.ray = new THREE.Raycaster();
    _topoThreeRaycaster.ndc = new THREE.Vector2();
  }
  _topoThreeRaycaster.ndc.set(ndcX, ndcY);
  _topoThreeRaycaster.ray.setFromCamera(
    _topoThreeRaycaster.ndc,
    _topoThreeState.camera,
  );
  const intersects = _topoThreeRaycaster.ray.intersectObjects(
    _topoThreeState.crystals.children,
    false,  // crystals are flat meshes, no recursion needed
  );
  if (!intersects.length) return null;
  // Raycaster sees the undiscarded CPU triangles. Mirror the active scalar
  // clip on each distance-sorted hit and skip GPU-discarded candidates.
  const clipField = _topoThreeState.cavityClipField;
  const clipIso = Number(_topoThreeState.clipUniforms.uCavityFieldIsovalue.value || 0);
  const hit = _topoSelectVisibleCavityHit(intersects, clipField, clipIso);
  if (!hit) return null;
  const data = hit.object && hit.object.userData;
  if (!data || !data.mineral) return null;
  // Synthesize a cell-like object so _topoTooltipFromEvent's existing
  // `cell.crystal_id` / `cell.mineral` / `cell.thickness_um` reads
  // resolve. _topoTooltipFromEvent only reads .crystal_id and .mineral
  // from the cell, plus `cell.wall_depth` for bare-wall hits (which
  // never fires here because the cavity is excluded).
  const synthCell = {
    crystal_id: data.crystal_id,
    mineral: data.mineral,
    thickness_um: 0,
    wall_depth: 0,
    base_radius_mm: 0,
  };
  return { mineral: data.mineral, isInclusion: false, cell: synthCell };
}

// Drive the camera from the existing tilt/zoom globals so toggling
// between canvas-vector and Three.js modes preserves the user's view.
// camera orbits a fixed lookAt(0,0,0) at a radius proportional to the
// cavity size + zoom. World units are mm (= the units cavity vertices
// were emitted in by _topoBuildCavityGeometry).
function _topoApplyCameraFromTilt(state: any, wall: any) {
  // r0: half the mean diameter, but bubble-merge profiles produce
  // bumps that extend ~2× past the mean — use max_seen_radius_mm if
  // available (it tracks the largest base+depth across all cells)
  // so the camera stays outside the cavity even on lumpy geodes.
  let r0 = wall && wall.meanDiameterMm ? wall.meanDiameterMm() / 2 : 25;
  if (wall && typeof wall.max_seen_radius_mm === 'number') {
    r0 = Math.max(r0, wall.max_seen_radius_mm * 0.6);
  }
  const baseRadius = r0 * 3.0;  // 3× outer radius keeps the cavity comfortably framed
  const radius = baseRadius / Math.max(0.2, _topoZoom);
  state.cameraR0 = r0;   // R6: the specimen view sizes its cut, rind and stage from this
  // Yaw around Y, then pitch around X — same convention as
  // _topoProject3D so the user's drag input behaves identically.
  const cy = Math.cos(_topoTiltY), sy = Math.sin(_topoTiltY);
  const cx = Math.cos(_topoTiltX), sx = Math.sin(_topoTiltX);
  const camX = sy * cx * radius;
  const camY = -sx * radius;
  const camZ = cy * cx * radius;
  // PAN (2026-07-24, boss report): _topoPanX/_topoPanY were 2D-canvas offsets
  // this camera never read — the ✥ pan mode was INERT in the mesh view, and
  // deep-zoom (where the orbit target is far from what you're looking at) is
  // exactly where pan is needed. Map the screen-px pan to a camera-space
  // translation of the WHOLE orbit rig (position + aim move together, so
  // orbit-after-pan still rotates around what you're looking at). Scaled by
  // radius so the hand-feel tracks zoom: one screen-height of drag ≈ one
  // view-height of travel at any zoom level.
  //   camera right (yaw frame): ( cy, 0, −sy)
  //   camera true up (pitched): ( sy·sx, cx, cy·sx )   [right × forward]
  const panScale = radius / 600;
  const panPx = -_topoPanX * panScale;   // drag right → scene follows cursor
  const panPy =  _topoPanY * panScale;   // drag down  → scene follows cursor
  const aimX = cy * panPx + sy * sx * panPy;
  const aimY =              cx * panPy;
  const aimZ = -sy * panPx + cy * sx * panPy;
  state.camera.position.set(camX + aimX, camY + aimY, camZ + aimZ);
  state.camera.up.set(0, 1, 0);
  state.camera.lookAt(aimX, aimY, aimZ);
  // R1: the key rides the camera frame (upper-left of the viewer) and aims at
  // the orbit target, so its shadow frustum follows pan and zoom.
  _topoLightingSyncKey(state, aimX, aimY, aimZ, r0);
  // Phase E4 inside-out detection. r0 already accounts for bubble-
  // merge bumps (max_seen_radius_mm × 0.6 is the conservative cavity
  // skin); when the camera distance falls below that we're inside the
  // cavity and the BackSide+translucent trick from E3 needs flipping
  // to FrontSide+opaque so the user sees the interior wall surface
  // properly. Hysteresis (5% ratio band) avoids flicker right at the
  // boundary.
  const inside = radius < r0 * 0.95;
  const outside = radius > r0 * 1.05;
  if (inside && !state.insideMode) {
    state.insideMode = true;
    _topoApplyWallDisplay(state);
    // Inside the cavity is darker (the wall is now an opaque shell around the
    // camera) — R1 opens the exposure; the environment stays (§5 R1).
    _topoLightingApplyInsideMode(state, true);
  } else if (outside && state.insideMode) {
    state.insideMode = false;
    _topoApplyWallDisplay(state);
    _topoLightingApplyInsideMode(state, false);
  }
}

// WALL DISPLAY (2026-07-06, boss ask: "turn the display of the vugg wall on or
// off"). One composition point for the cavity material: (insideMode ×
// wallDisplay) → side/opacity/visibility. wallDisplay cycles 0 SOLID (the
// pre-existing contract: translucent-0.40 shell outside, opaque interior
// inside) → 1 TRANSLUCENT (0.18 see-through shell — the druse-portrait view;
// depthWrite off so crystals behind the near wall stay readable) → 2 HIDDEN
// (cavity mesh invisible; the matrix skin and wall both gone, bare druse).
// The camera inside/outside transition handler above routes through here so
// the two axes compose instead of fighting.
function _topoApplyWallDisplay(state: any) {
  if (!state || !state.cavity) return;
  const mode = state.wallDisplay | 0;
  const mat = state.cavity.material;
  const specimenGroup = state.specimen && state.specimen.group;
  if (mode === 2) { state.cavity.visible = false; if (specimenGroup) specimenGroup.visible = false; _topoOpticsSyncView(state); return; }
  state.cavity.visible = true;
  if (specimenGroup) specimenGroup.visible = true;
  if (!mat) { _topoOpticsSyncView(state); return; }
  if (state.specimen) {
    // R6: a specimen is opaque rock from every side; the translucent shell has no meaning
    // on a broken geode (mode 2 above still hides it — the bare druse on the cloth).
    mat.side = THREE.DoubleSide;
    mat.opacity = 1.0;
    mat.transparent = false;
    mat.depthWrite = true;
  } else if (mode === 1) {
    mat.side = THREE.BackSide;
    mat.opacity = 0.18;
    mat.transparent = true;
    mat.depthWrite = false;
  } else if (state.insideMode) {
    // R1 FIX (2026-09-05, photo-rig `wall2side` probe on elmwood s42): the
    // shipped cavity surface's normals point OUTWARD (mean n·p > 0 over the
    // vertices), so from inside the cavity every wall face is a back face and
    // FrontSide culled the whole interior — hero/zoomed views floated in the
    // clear colour with slivers of wall where it folded (dark fraction 0.59,
    // identical under any lighting: nothing was drawn). Two-sided is correct
    // for either winding (the legacy ring mesh may wind the other way), and
    // from inside a closed shell it costs nothing extra: there are no front
    // faces to draw. Measured: hero mean L 46 → 106, dark fraction 0.59 → 0.
    mat.side = THREE.DoubleSide;
    mat.opacity = 1.0;
    mat.transparent = false;
    mat.depthWrite = true;
  } else {
    mat.side = THREE.BackSide;
    mat.opacity = 0.40;
    mat.transparent = true;
    mat.depthWrite = true;
  }
  mat.needsUpdate = true;
  // R2: the active optics tier follows the wall — glass only over an opaque backdrop.
  _topoOpticsSyncView(state);
}

// The topo-wall-btn onclick (index.html camera-ctrls row). Cycles the three
// display states; amber button color marks the non-default states (the
// topo-three-btn convention).
function topoToggleWallDisplay() {
  if (_topoExactFlatPresentationActive) return false;
  const state = _topoThreeState;
  if (!state) return;
  state.wallDisplay = ((state.wallDisplay | 0) + 1) % 3;
  _topoApplyWallDisplay(state);
  const btn = document.getElementById('topo-wall-btn');
  if (btn) {
    const mode = state.wallDisplay | 0;
    btn.style.color = mode !== 0 ? '#f0c050' : '';
    btn.title = mode === 0 ? 'Vug wall: solid (click: translucent)'
      : mode === 1 ? 'Vug wall: translucent (click: hidden)'
      : 'Vug wall: hidden (click: solid)';
  }
  if (typeof topoRender === 'function') topoRender();
}

// One-time default-on setup. Runs the first time _topoRenderThree
// succeeds — colors the toggle button and forces drag mode to 'rotate'
// so dragging the panel orbits the scene out-of-the-box.
function _topoApplyThreeDefaultOnce() {
  if (_topoThreeDefaultApplied) return;
  _topoThreeDefaultApplied = true;
  _topoSyncThreeButtonState();
  if (typeof topoSetDragMode === 'function' && _topoDragMode !== 'rotate') {
    topoSetDragMode('rotate');
  }
}

// Build a snapshot-cavity wall for replay.
//
// v65 (May 2026): consumes the multi-ring snapshot
//   { step, rings: [ring0_cells, ring1_cells, ...] }
// written by _repaintWallState in 85c-simulator-state.ts. Each ring's
// cells go directly into synth.rings[r] so the cavity profile reflects
// honest 3D history — ring[0]..ring[15] each evolve independently in
// replay, not the v60 vertically-uniform projection of ring[0].
//
// Legacy flat-array snapshot (the v60 schema) is still tolerated for
// any in-memory state that predates v65: the flat ring is projected
// across all rings, matching the previous placeholder behavior.
function _topoRejectReplayWall(synth: any, reason: any): any {
  synth._cavityEvolutionLedger = null;
  delete synth._cavityEvolutionCursor;
  synth._disableMarchingCubesCavity = true;
  synth._cavitySurfaceAnchorProvider = Object.freeze({ kind: 'wall-mesh' });
  synth._activeCavitySurfaceAnchorProvider = null;
  synth._replayAuthenticationFailure = String(
    reason instanceof Error ? reason.message : reason || 'unknown replay authentication failure',
  );
  return synth;
}

function _topoSnapshotWall(liveWall: any, snapshot: any): any {
  if (!liveWall || !liveWall.rings || !liveWall.rings.length) return liveWall;
  const ringCount = liveWall.ring_count;
  const N = liveWall.cells_per_ring;
  // Synthetic wall — reuse method shapes from liveWall via Object.assign
  // so polarProfileFactor, ringTwistRadians, etc. still work.
  const synth: any = Object.assign(Object.create(Object.getPrototypeOf(liveWall) || null), liveWall);
  // Object.assign intentionally skips WallState's non-enumerable immutable
  // authored-shape authority. Restore that exact construction receipt before
  // recomputing ledger identity; otherwise every honest snapshot would appear
  // to have `authored_shape: null`.
  if (liveWall._cavity_shape) {
    Object.defineProperty(synth, '_cavity_shape', {
      value: liveWall._cavity_shape,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
  // Never inherit geometry identity or a live mesh. The rings below are a
  // distinct historical surface, so they must take the exact all-cell
  // signature path and build their own WallMesh. Otherwise every replay frame
  // can silently render the live wall's cached vertices.
  delete synth._geometry_revision;
  delete synth._mesh;
  delete synth._cavityField;
  delete synth._cavitySurface;
  // Object.assign inherited the live authority. A historical surface must not
  // expose it until both cursor authentication and depth projection succeed.
  synth._cavityEvolutionLedger = null;
  synth._cavitySurfaceAnchorProvider = Object.freeze({ kind: 'wall-mesh' });
  synth._activeCavitySurfaceAnchorProvider = null;
  delete synth._cavityEvolutionCursor;
  // Fail closed by default. Only an authenticated cavity-evolution prefix
  // below may opt a replay frame into the default-off MC comparison path.
  synth._disableMarchingCubesCavity = true;

  // Detect snapshot shape:
  //   * Multi-ring (v65+): { step, rings: [...] } — use directly.
  //   * Legacy flat array (v60..v64): project across all rings.
  let snapRings: any[];
  const modernSnapshot = !Array.isArray(snapshot);
  if (Array.isArray(snapshot)) {
    snapRings = new Array(ringCount);
    for (let r = 0; r < ringCount; r++) snapRings[r] = snapshot;
  } else if (snapshot && Array.isArray(snapshot.rings)) {
    snapRings = snapshot.rings;
    let exactDimensions = snapRings.length === ringCount;
    for (let r = 0; exactDimensions && r < ringCount; r++) {
      if (!Object.prototype.hasOwnProperty.call(snapRings, r)
          || !Array.isArray(snapRings[r]) || snapRings[r].length !== N) {
        exactDimensions = false;
        break;
      }
      for (let i = 0; i < N; i++) {
        if (!Object.prototype.hasOwnProperty.call(snapRings[r], i)) {
          exactDimensions = false;
          break;
        }
      }
    }
    if (!exactDimensions) {
      return _topoRejectReplayWall(
        synth, `replay dimensions must be exactly ${ringCount}x${N}`,
      );
    }
  } else {
    return _topoRejectReplayWall(synth, 'unsupported or missing replay rings');
  }

  const rings: any[] = [];
  let invalidGeometry = '';
  for (let r = 0; r < ringCount; r++) {
    // Fall through to ring 0 if the snapshot is short on rings — keeps
    // mid-life ring_count migrations from crashing.
    const sourceRing = snapRings[r];
    const ring = new Array(N);
    for (let i = 0; i < N; i++) {
      const snap = sourceRing[i] || {};
      const wallDepth = Number(snap.wall_depth);
      const baseRadius = Number(snap.base_radius_mm);
      if (!Number.isFinite(wallDepth)
          || (modernSnapshot && (!(baseRadius > 0) || !Number.isFinite(baseRadius)))) {
        invalidGeometry = `non-finite or missing replay geometry at ring ${r}, cell ${i}`;
      }
      ring[i] = {
        wall_depth: Number.isFinite(wallDepth) ? wallDepth : 0,
        crystal_id: snap.crystal_id ?? null,
        mineral: snap.mineral ?? null,
        thickness_um: snap.thickness_um || 0,
        base_radius_mm: Number.isFinite(baseRadius) ? baseRadius : 0,
      };
    }
    rings[r] = ring;
  }
  synth.rings = rings;
  if (invalidGeometry) return _topoRejectReplayWall(synth, invalidGeometry);
  const ledger = liveWall.cavityEvolutionLedger ? liveWall.cavityEvolutionLedger() : null;
  const cursor = snapshot && !Array.isArray(snapshot)
    ? snapshot.cavity_evolution_cursor : null;
  const expectedSignature = snapshot && !Array.isArray(snapshot)
    ? snapshot.cavity_evolution_signature : null;
  if (ledger && Number.isInteger(cursor) && cursor >= 0 && cursor <= ledger.cursor) {
    try {
      if (ledger.signatureAt(cursor) !== expectedSignature) {
        throw new Error('replay cavity evolution signature mismatch');
      }
      const identity = CavityEvolutionLedger.identityForWall(synth);
      if (identity.shape !== ledger.shape_identity
          || identity.tessellation !== ledger.tessellation_identity) {
        throw new Error('replay cavity shape or tessellation identity mismatch');
      }
      ledger.assertProjection(synth, cursor);
      synth._cavityEvolutionLedger = ledger;
      synth._cavityEvolutionCursor = cursor;
      synth._disableMarchingCubesCavity = false;
      if (synth._cavityProductionAuthorityContract) {
        _installHistoricalWallProductionAuthorityOwnership(
          synth, liveWall, ledger, cursor,
        );
      }

      // Replay the provider command that was authoritative at this snapshot,
      // then independently rebuild and compare every identity field. Legacy
      // snapshots omitted this receipt and therefore remain on canonical
      // WallMesh; they must never inherit the provider active on `liveWall`.
      const storedProvider = snapshot?.cavity_surface_provider;
      if (storedProvider?.kind === 'cavity-field') {
        const productionContract = synth._cavityProductionAuthorityContract;
        const storedContractDigest = snapshot?.cavity_production_contract_digest ?? null;
        if ((productionContract?.contract_digest ?? null) !== storedContractDigest
            || (storedProvider.production_contract_digest ?? null) !== storedContractDigest) {
          throw new Error('replay cavity production contract mismatch');
        }
        const rebuilt = synth.activateCavitySurfaceAnchorProvider({
          resolution: storedProvider.resolution,
          isovalue: storedProvider.isovalue,
          ledgerCursor: cursor,
        });
        const identityKeys = [
          'kind', 'resolution', 'isovalue', 'field_signature',
          'field_snapshot_digest', 'surface_signature',
          'surface_buffer_digest', 'cavity_evolution_signature',
          'production_contract_digest',
          'authoritative_volume_mm3', 'max_field_agreement_voxels',
        ];
        const mismatchedKeys = identityKeys.filter(
          key => rebuilt[key] !== storedProvider[key],
        );
        if (rebuilt.cavity_evolution_signature !== expectedSignature) {
          mismatchedKeys.push('expected_evolution_signature');
        }
        if (mismatchedKeys.length) {
          throw new Error('replay cavity provider receipt mismatch: '
            + mismatchedKeys.map(key => `${key}=${String(rebuilt[key])}`
              + ` (stored ${String(storedProvider[key])})`).join(', '));
        }
      } else if (storedProvider && storedProvider.kind !== 'wall-mesh') {
        throw new Error('unknown replay cavity provider kind');
      }
    } catch (_error) {
      // A corrupt frame is withheld. Falling back to its untrusted WallMesh
      // would turn authentication failure into plausible-looking geology.
      return _topoRejectReplayWall(synth, _error);
    }
  } else if (modernSnapshot) {
    return _topoRejectReplayWall(synth, 'missing or invalid replay cavity evolution receipt');
  }
  const storedAppearance = snapshot && !Array.isArray(snapshot)
    ? snapshot.cavity_appearance : null;
  // Current runtime policy is trusted; a snapshot's own version field is not.
  // Every modern object frame rendered by v265+ must authenticate against the
  // live wall's append-only history. Only the explicit legacy flat-array shape
  // remains outside this contract.
  const requiresWaterHistory = modernSnapshot && SIM_VERSION >= 265;
  if (requiresWaterHistory) {
    try {
      const waterHistory = liveWall._cavityWaterAppearanceLedger;
      if (!(waterHistory instanceof CavityWaterAppearanceLedger)) {
        throw new Error('replay lacks append-only cavity water history');
      }
      waterHistory.assertSnapshot(synth, snapshot);
    } catch (error) {
      return _topoRejectReplayWall(synth, error);
    }
  }
  if (storedAppearance) {
    try {
      const replayConditions = CavityWaterAppearance.replayConditions(
        snapshot.conditions, synth,
      );
      const active = synth.activeCavitySurfaceAnchorProvider?.();
      const surface = active?.surface || synth.meshFor?.();
      const appearance = CavityWaterAppearance.assertReceipt(
        synth, replayConditions, storedAppearance, {
          activeProvider: active,
          providerReceipt: snapshot.cavity_surface_provider,
          surface,
        },
      );
      synth._replayCavityAppearance = appearance.receipt;
      synth._replayConditions = replayConditions;
    } catch (error) {
      return _topoRejectReplayWall(synth, error);
    }
  } else if (requiresWaterHistory
      || snapshot?.cavity_surface_provider?.kind === 'cavity-field') {
    return _topoRejectReplayWall(synth, 'exact replay lacks cavity appearance receipt');
  }
  if (modernSnapshot && SIM_VERSION >= 265) {
    try {
      const materialHistory = liveWall._cavityWallMaterialHistoryLedger;
      if (!(materialHistory instanceof CavityWallMaterialHistoryLedger)) {
        throw new Error('replay lacks append-only cavity wall material history');
      }
      materialHistory.assertSnapshot(synth, snapshot);
      const storedMaterial = CavityWallMaterialState.assertReceipt(
        synth, snapshot.cavity_material_state,
      );
      // Object.assign inherited today's display-only paleo-flow. Replace it
      // only after the independent append-only history authenticates the
      // historical value and its evolution cursor.
      synth.paleo_flow = storedMaterial.paleo_flow;
      synth._replayCavityMaterialState = storedMaterial;
    } catch (error) {
      return _topoRejectReplayWall(synth, error);
    }
  }
  return synth;
}

// One decision boundary shared by canvas and WebGL dispatch. Tests exercise
// this function directly so failure behavior cannot regress behind renderer or
// hardware availability branches.
function _topoReplayRenderDecision(liveWall: any, snapshot: any): any {
  if (snapshot && (!liveWall || !Array.isArray(liveWall.rings) || !liveWall.rings.length)) {
    return Object.freeze({
      mode: 'corrupt', wall: null,
      message: 'Replay frame withheld: live cavity authority is unavailable.',
    });
  }
  const wall = snapshot ? _topoSnapshotWall(liveWall, snapshot) : liveWall;
  if (wall?._replayAuthenticationFailure) {
    return Object.freeze({
      mode: 'corrupt', wall,
      message: `Replay frame withheld: ${wall._replayAuthenticationFailure}.`,
    });
  }
  let provider = null;
  try {
    provider = wall?.activeCavitySurfaceAnchorProvider?.();
  } catch (error) {
    return Object.freeze({
      mode: 'corrupt', wall,
      message: `Cavity frame withheld: ${error instanceof Error ? error.message : String(error)}.`,
    });
  }
  if (wall?._cavityProductionAuthorityContract
      && provider?.receipt?.kind !== 'cavity-field') {
    return Object.freeze({
      mode: 'corrupt', wall,
      message: `Cavity frame withheld: ${wall._cavitySurfaceAuthorityFailure
        || 'production Cartesian surface authority is unavailable'}.`,
    });
  }
  return Object.freeze({
    mode: provider?.receipt?.kind === 'cavity-field' ? 'cavity-field' : 'wall-mesh',
    wall,
    conditions: snapshot ? wall?._replayConditions || null : null,
    appearance: snapshot ? wall?._replayCavityAppearance || null : null,
    materialState: snapshot ? wall?._replayCavityMaterialState || null : null,
    message: null,
  });
}

function _topoThreeRenderAuthorityDecision(liveWall: any, snapshot: any): any {
  return _topoReplayRenderDecision(liveWall, snapshot);
}

// Public render entry. Called from topoRender's branch when
// _topoUseThreeRenderer is true. Lazily inits on first call; renders
// the scene every frame the wrapper invokes us. Returns true on
// success so topoRender can short-circuit; false (=> fallback) when
// Three.js is unavailable or the canvas hasn't mounted yet.
//
// optOverrideSnap — replay snapshot. When provided, the cavity is
// rebuilt from the snapshot's per-ring per-cell wall_depth and the
// crystals are sized from their zones[] history up to optReplayStep.
// v65 schema: snapshot is { step, rings: [...] } with one ring per
// wall_state.ring_count. Legacy flat-array snapshots (v60..v64) are
// still accepted by _topoSnapshotWall — they project across all
// rings, matching the v64 placeholder behavior.
//
// optReplayStep is the step number associated with the snapshot;
// _topoSyncCrystalMeshes uses it to skip crystals that hadn't
// nucleated yet and to sum zone thicknesses up to that step. When
// undefined, the Three.js path renders LIVE crystal sizes (regular
// frame).
function _topoRenderThree(sim: any, wall: any, optOverrideSnap?: any,
                          optReplayStep?: number): boolean {
  // Authenticate a supplied historical frame before renderer/canvas/hardware
  // checks. A malformed payload must never turn into today's live geology just
  // because WebGL is absent or initialization exits early.
  const replayDecision = _topoThreeRenderAuthorityDecision(wall, optOverrideSnap);
  const renderWall = replayDecision.wall;
  if (replayDecision.mode === 'corrupt' || renderWall?._replayAuthenticationFailure) {
    if (_topoThreeState?.cavity) _topoThreeState.cavity.visible = false;
    if (_topoThreeState?.crystals) _topoThreeState.crystals.visible = false;
    if (_topoThreeState) _topoThreeState.cavityAuthorityUnrenderable = true;
    const canvas2d = document.getElementById('topo-canvas') as HTMLCanvasElement | null;
    if (canvas2d) _topoPaintPlaceholder(canvas2d, replayDecision.message
      || `Replay frame withheld: ${renderWall._replayAuthenticationFailure}.`);
    return false;
  }
  const canvas = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!canvas) return false;
  // Terminal shader failure holds the effective renderer on canvas until the
  // explicit retry/context-restore lifecycle clears it. Avoid recompiling the
  // same known-bad program on every animation frame.
  if (!_topoAttemptEffectiveThree(_topoThreeState, () => true)) return false;
  if (!_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    return false;
  }
  const state = _topoInitThree(canvas);
  if (!state) return false;
  let renderConditions = sim?.conditions;
  if (optOverrideSnap) {
    try {
      renderConditions = replayDecision.conditions
        || CavityWaterAppearance.replayConditions(
          Array.isArray(optOverrideSnap)
            ? { fluid_surface_height_mm: null, fluid_surface_ring: null }
            : optOverrideSnap.conditions,
          renderWall,
        );
    } catch (error) {
      state.cavityAuthorityUnrenderable = true;
      if (state.cavity) state.cavity.visible = false;
      if (state.crystals) state.crystals.visible = false;
      if (state.waterInterface) state.waterInterface.visible = false;
      _topoPaintPlaceholder(
        document.getElementById('topo-canvas') as HTMLCanvasElement,
        `Replay frame withheld: ${error instanceof Error ? error.message : String(error)}.`,
      );
      return false;
    }
  }
  _topoApplyThreeDefaultOnce();
  _topoSyncThreeSize(state, canvas);
  // During replay, build cavity from the snapshot rings so the wall
  // profile reflects the historical step. Force a fresh build each
  // replay frame by invalidating the cached signatures.
  if (optOverrideSnap) {
    state.cavitySig = null;
    state.crystalsSig = null;
  }
  if (!_topoBuildCavityGeometry(
    state, renderWall, sim, false, renderConditions, replayDecision.appearance,
    replayDecision.materialState,
  )) return false;
  _topoSyncCrystalMeshes(state, sim, renderWall, optReplayStep);
  _topoApplyCameraFromTilt(state, renderWall);
  // === HELIX-OVERLAY-FORK ADDITION (v0–v17) =========================
  // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
  // breadcrumb. Single integration point for the helicoid overlay
  // module (js/99j-helix-overlay.ts) into the 3D render pipeline.
  // Defensive typeof so the bundle still boots if 99j is ever
  // removed during a merge.
  if (typeof _topoHelixOverlayDraw === 'function') {
    _topoHelixOverlayDraw(state, sim, renderWall);
  }
  // === END HELIX-OVERLAY-FORK ADDITION ==============================
  const rendered = _topoRenderPreparedCavityScene(state, () => {
    const failedDigest = state.cavityFieldContract?.snapshot_digest || null;
    if (failedDigest) {
      if (!state.cavityFieldFailedDigests) state.cavityFieldFailedDigests = new Set<string>();
      if (!state.cavityFieldFailedReasons) state.cavityFieldFailedReasons = new Map<string, string>();
      state.cavityFieldFailedDigests.add(failedDigest);
      state.cavityFieldFailedReasons.set(failedDigest, 'cavity-field-shader-link-failed');
    }
    if (renderWall.activeCavitySurfaceAnchorProvider?.()?.receipt?.kind === 'cavity-field') {
      state.cavityAuthorityUnrenderable = true;
      if (state.cavity) state.cavity.visible = false;
      if (state.crystals) state.crystals.visible = false;
      return false;
    }
    state.cavitySig = '';
    // A failed field shader cannot be replaced by an independently selected MC
    // shadow extraction in the same fallback. Anchors and the visible wall both
    // return to canonical WallMesh before the polar shader is compiled.
    _topoBuildCavityGeometry(
      state, renderWall, sim, true, renderConditions, replayDecision.appearance,
      replayDecision.materialState,
    );
    state.crystalsSig = '';
    _topoSyncCrystalMeshes(state, sim, renderWall, optReplayStep);
    return true;
  });
  if (!rendered) {
    // Let topoRender continue into its established canvas renderer. Keep the
    // user's renderer preference intact so a later explicit retry can restore
    // Three after a context/driver change.
    if (state.cavity) state.cavity.visible = false;
    if (state.crystals) state.crystals.visible = false;
    _topoSyncThreeCanvasVisibility();
    _topoPublishCavityClipReceipt(state);
    return false;
  }
  // Three uploads Data3DTexture lazily during render. Publish after the draw so
  // the DOM receipt observed by browser automation includes verification of
  // the exact bytes retained until the GPU consumed them.
  _topoPublishCavityClipReceipt(state);
  return true;
}

// Show/hide the WebGL canvas vs the canvas-2D canvas. Called by both
// the toggle button and topoRender (so an off→on→off cycle leaves the
// DOM in a coherent state regardless of which path triggered the
// change).
function _topoSyncThreeCanvasVisibility(state = _topoThreeState) {
  const c2 = document.getElementById('topo-canvas') as HTMLCanvasElement | null;
  const c3 = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!c2 || !c3) return;
  if (_topoThreeRendererEffective(state)) {
    c3.style.display = 'block';
    c2.style.visibility = 'hidden';  // keep layout but don't paint
  } else {
    c3.style.display = 'none';
    c2.style.visibility = '';
  }
  _topoSyncThreeButtonState();
}

// Toggle button handler — wired in index.html to the ⬚ button. Flips
// the renderer tier and forces drag-mode to 'rotate' on enable so
// clicking once and dragging immediately orbits the scene. Disabled
// when Three.js failed to load (CDN blocked / offline file://).
function topoThreeRendererEnabled(): boolean {
  return _topoThreeRendererEffective();
}

function _topoSyncThreeButtonState(): void {
  const btn = document.getElementById('topo-three-btn');
  if (!btn) return;
  const available = _topoThreeAvailable();
  const presented = topoThreeRendererEnabled();
  const tutorialLocked = (btn as HTMLElement).dataset.tutorialLocked === 'true';
  (btn as HTMLElement).style.color = presented ? '#f0c050' : '';
  (btn as HTMLButtonElement).disabled = !available || tutorialLocked;
  (btn as HTMLElement).style.opacity = available ? '' : '0.4';
  btn.setAttribute('aria-pressed', String(presented));
  const label = !available
    ? 'Three.js renderer unavailable (offline or unsupported)'
    : presented
    ? 'Show authenticated flat cavity cross-section'
    : 'Show 3D cavity mesh';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

// Exact state setter shared by the toolbar and the guided-tour commissioner.
// `emitProduct=false` is reserved for boot canonicalization; player changes
// emit a state receipt from the owner control after the product state lands.
function topoSetThreeRendererEnabled(enabled: boolean, emitProduct = true): boolean {
  const desired = enabled === true;
  const before = topoThreeRendererEnabled();
  if (desired) _topoSyncFlatPresentationControls(false);
  else if (typeof helixSetOverlayEnabled === 'function') {
    // Helicoid is Three-owned. Do not carry an invisible enabled overlay
    // behind the authenticated CPU slice and surprise the player on return.
    helixSetOverlayEnabled(false, false);
  }
  _topoUseThreeRenderer = desired;
  if (desired) _topoThreeInitializationFailure = null;
  if (_topoUseThreeRenderer && _topoThreeState?.threeShaderUnusable) {
    _topoResetCavityFieldFailures(_topoThreeState);
    _topoThreeState.cavitySig = '';
    _topoThreeState.crystalsSig = '';
  }
  const btn = document.getElementById('topo-three-btn');
  _topoSyncThreeButtonState();
  if (_topoUseThreeRenderer && typeof topoSetDragMode === 'function'
      && _topoDragMode !== 'rotate') {
    topoSetDragMode('rotate');
  } else if (!_topoUseThreeRenderer && typeof topoSetDragMode === 'function'
      && _topoDragMode !== 'default') {
    // A flat product must not retain a highlighted orbit tool whose drags have
    // no honest meaning in the CPU cross-section. Default mode restores the
    // ordinary canvas pan behavior; exact-field dispatch separately withholds
    // the legacy ring stepper because this is one fixed Cartesian plane.
    topoSetDragMode('default');
  }
  topoRender();
  _topoSyncThreeCanvasVisibility();
  _topoSyncThreeButtonState();
  const after = topoThreeRendererEnabled();
  const changed = before !== after;
  if (changed && emitProduct && typeof _dispatchTutorialViewStateProduct === 'function') {
    _dispatchTutorialViewStateProduct(
      btn, 'topo-three-renderer', before, after,
    );
  }
  return changed;
}

function topoToggleThreeRenderer() {
  if (!topoThreeRendererEnabled() && !_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    const btn = document.getElementById('topo-three-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.title = 'Three.js renderer unavailable (CDN blocked or offline)';
      btn.style.opacity = '0.4';
    }
    return;
  }
  // Retry an unavailable/failed 3-D presentation in one click. The requested
  // preference may still be true after WebGL initialization failed, while the
  // player is truthfully looking at the CPU cross-section.
  topoSetThreeRendererEnabled(!topoThreeRendererEnabled(), true);
}
