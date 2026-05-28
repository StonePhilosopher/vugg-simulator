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

  // Cavity mesh — populated by _topoBuildCavityGeometry from wall.rings
  // on the first _topoRenderThree call once a sim exists. Empty geometry
  // here so the scene has something to add to scene.children before
  // wall data arrives. DoubleSide so the user can see the cavity from
  // both inside (geode flythrough) and outside (the view E2 ships
  // with). Vertex colors carry orientation + water-state tints.
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
  const cavity = new THREE.Mesh(cavityGeom, cavityMat);
  cavity.renderOrder = 0;     // paint cavity first; crystals layer on top
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
    },
  };
  return _topoThreeState;
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
function _applyCavityClip(material: any, clipUniforms: any) {
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uVugRadius = clipUniforms.uVugRadius;
    shader.uniforms.uVugCenter = clipUniforms.uVugCenter;
    shader.uniforms.uVugRingCount = clipUniforms.uVugRingCount;
    shader.uniforms.uVugRadiiByRing = clipUniforms.uVugRadiiByRing;
    shader.uniforms.uVugCellRadii = clipUniforms.uVugCellRadii;
    shader.uniforms.uVugCellTexW = clipUniforms.uVugCellTexW;
    shader.uniforms.uVugCellTexH = clipUniforms.uVugCellTexH;
    // === HELIX-OVERLAY-FORK ADDITION (v19) =========================
    shader.uniforms.uHelixEnabled = clipUniforms.uHelixEnabled;
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
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCavityWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
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
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `void main() {
  float _vugHullR = cavityHullRadiusAt(vCavityWorldPos);
  if (length(vCavityWorldPos - uVugCenter) > _vugHullR) discard;
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
  };
  // Force shader rebuild on next render.
  material.needsUpdate = true;
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
  let depthSum = 0;
  for (let r = 0; r < wall.rings.length; r++) {
    const ring = wall.rings[r];
    if (!ring) continue;
    const stride = Math.max(1, Math.floor(N / 8));
    for (let c = 0; c < N; c += stride) {
      const cell = ring[c];
      if (!cell) continue;
      depthSum += (cell.base_radius_mm + cell.wall_depth) * (r * 31 + c);
    }
  }
  const surf = sim && sim.conditions ? sim.conditions.fluid_surface_ring : null;
  return `${wall.ring_count}|${N}|${depthSum.toFixed(2)}|${surf}`;
}

// PHASE-2-CAVITY-MESH: cavity geometry now sources from WallMesh
// (js/23-geometry-wall-mesh.ts). The renderer's job here is reduced
// to: ask the wall for its mesh, copy the mesh's buffers into a
// THREE.BufferGeometry, push it onto state.cavity, and update clip
// uniforms. The vertex math (positions, colors, normals,
// triangulation) lives in WallMesh.recompute — same formulas as
// before, just centralized so future tessellations (icosphere,
// geodesic, irregular) can swap in without touching this file.
function _topoBuildCavityGeometry(state: any, wall: any, sim: any) {
  if (!wall || !wall.rings || !wall.rings.length) return;
  const mesh = wall.meshFor ? wall.meshFor(sim) : null;
  if (!mesh) return;
  if (mesh.sig === state.cavitySig) return;
  state.cavitySig = mesh.sig;

  const ringCount = wall.ring_count;
  const ring0 = wall.rings[0];
  const N = ring0 ? ring0.length : 0;
  if (!N || ringCount < 1) return;

  const numVerts = mesh.numInterior + 2;
  const geom = new THREE.BufferGeometry();
  // mesh.positions / mesh.colors / mesh.normals are Float32Arrays the
  // mesh owns and rebuilds in-place; copy-on-write into the
  // BufferAttribute so a future mesh recompute doesn't mutate this
  // geometry's data behind Three.js's back. The slice() costs
  // ~75 KB per cavity rebuild at the default 16×120 resolution
  // (≈ once per dissolution event), which is well under the budget.
  geom.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(mesh.colors.slice(), 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(mesh.normals.slice(), 3));
  const indexAttr = numVerts > 65535
    ? new THREE.Uint32BufferAttribute(mesh.indices, 1)
    : new THREE.Uint16BufferAttribute(mesh.indices, 1);
  geom.setIndex(indexAttr);
  geom.computeVertexNormals();  // overwrite the placeholder normals with
                                // mesh-aware ones for proper shading

  const target = state.cavity;
  const prev = target.geometry;
  target.geometry = geom;
  if (prev && prev.dispose) prev.dispose();

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
  if (h.includes('rhombic dodec') || h.includes('rhombic-dodec') || h === 'garnet' || h === 'trapezohedral') return 'rhombic_dodec';
  if (h === 'dodecahedral' || h === 'dodecahedron') return 'dodecahedron';
  if (h === 'cubic' || h === 'cuboid' || h === 'cube') return 'cube';
  if (h === 'octahedral' || h === 'octahedron') return 'octahedron';
  if (h.includes('rhombohedral')) return 'rhomb';
  if (h.includes('scalenohedral')) return 'scalene';
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
  const canonical = _habitGeomToken(habitForGeom);
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
function _makeBotryoidalCluster(): any {
  const bubbles = [
    { r: 0.42, x: 0.00, y: 0.05, z: 0.00 },   // dominant central bump
    { r: 0.26, x: 0.30, y: -0.10, z: 0.10 },  // small lobe
    { r: 0.30, x: -0.18, y: 0.00, z: 0.22 },  // medium lobe
    { r: 0.22, x: 0.12, y: -0.05, z: -0.30 }, // small lobe (back)
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

// Aragonite pseudo-hex sextet — three tabular orthorhombic prisms at
// 60° rotation around the c-axis (+Y), interpenetrating to produce a
// pseudo-hexagonal column (Dana 8th ed. CaCO3 section; Speer 1983
// "Aragonite" Reviews in Mineralogy v.11). Mirrors
// PRIM_ARAGONITE_PSEUDOHEX_TWIN in 99c-renderer-primitives.ts for
// cross-renderer parity. v133's twin_laws[].probability=0.40 means
// ~40% of aragonite crystals carry crystal.twinned=true +
// crystal.twin_law='cyclic_sextet'.
//
// Math: each prism is a tabular box with half-thickness a=0.10 and
// half-width b=0.30 in its local (xl, zl) frame. Long axis +Y from
// y=-L to y=+L (L=0.5 for the 99i convention centered at origin).
// Prism k is rotated by k·60° around the y-axis:
//   wx = xl·cos(θ_k) - zl·sin(θ_k)
//   wz = xl·sin(θ_k) + zl·cos(θ_k)
// for θ_k = k·π/3, k ∈ {0, 1, 2}.
//
// Why 3 crystals = "sextet": each tabular crystal contributes 2
// {110}-type broad faces (one on each side), so 3 crystals × 2 = 6
// visible faces around the column. The "sextet" terminology counts
// faces, not crystals.
//
// Flat-shaded: 6 box faces × 2 triangles × 3 prisms = 36 triangles,
// 108 vertex triples in the position attribute (324 floats).
function _makeAragonitePseudohexTwin(): any {
  const a = 0.10;          // half-thickness (perp to broad face)
  const b = 0.30;          // half-width (parallel to broad face)
  const L = 0.5;           // half-length along c-axis (centered at origin)
  const positions: number[] = [];
  // Build each prism's 8 corners then emit 6 box faces as 12
  // flat-shaded triangles. Same face-winding pattern as the
  // fluorite-twin / swallowtail builders.
  const pushPrism = (theta: number): void => {
    const cT = Math.cos(theta);
    const sT = Math.sin(theta);
    // 8 corners in (xl, yl, zl) loop order — xl ∈ {-a, +a},
    // yl ∈ {-L, +L}, zl ∈ {-b, +b}. Same indexing as the cube helper
    // in _makeFluoritePenetrationTwin so the face-winding rule
    // transfers directly.
    const v: number[][] = [];
    for (const xl of [-a, a]) {
      for (const yl of [-L, L]) {
        for (const zl of [-b, b]) {
          v.push([xl * cT - zl * sT, yl, xl * sT + zl * cT]);
        }
      }
    }
    const tri = (i: number, j: number, k: number) => {
      _pushTri(positions, v[i][0], v[i][1], v[i][2], v[j][0], v[j][1], v[j][2], v[k][0], v[k][1], v[k][2]);
    };
    tri(0, 1, 3); tri(0, 3, 2);  // xl = -a face
    tri(4, 6, 7); tri(4, 7, 5);  // xl = +a face
    tri(0, 4, 5); tri(0, 5, 1);  // yl = -L face (bottom)
    tri(2, 3, 7); tri(2, 7, 6);  // yl = +L face (top)
    tri(0, 2, 6); tri(0, 6, 4);  // zl = -b face
    tri(1, 5, 7); tri(1, 7, 3);  // zl = +b face
  };
  for (let k = 0; k < 3; k++) {
    pushPrism(k * Math.PI / 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
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
      // orthorhombic prisms at 60° rotation around c-axis, producing
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
function _emitClusterSatellites(
  state: any, crystal: any, geom: any, mat: any,
  ax: number, ay: number, az: number,
  nx: number, ny: number, nz: number,
  parentCLen: number, parentAWid: number,
  geomToken: string,
  wall: any, ringCount: number, N: number, initR: number,
) {
  const pattern = _CLUSTER_PATTERNS[geomToken] || _CLUSTER_PATTERN_DEFAULT;
  const n = _clusterSatelliteCount(crystal, pattern, parentCLen);
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
    const sScale = pattern.scaleMin + scaleSpan * rand();
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
    const sOffset = sCLen * 0.5;
    const satMesh = new THREE.Mesh(geom, mat);
    if (geomToken === 'cube' || geomToken === 'octahedron' || geomToken === 'rhombic_dodec' || geomToken === 'dodecahedron' || geomToken === 'snowball') {
      satMesh.scale.set(sCLen, sCLen, sCLen);
    } else {
      satMesh.scale.set(sAWid, sCLen, sAWid);
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
    // Inherit parent userData so raycaster hit-test resolves a satellite
    // hit back to the parent crystal — clicking a satellite tooltips
    // the parent mineral, no per-satellite identity surfaced.
    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the only
    // positional field on Crystal; legacy fields retired.
    const _anchor = crystal.wall_anchor || { ringIdx: 0, cellIdx: 0 };
    satMesh.userData = {
      crystal_id: crystal.crystal_id,
      mineral: crystal.mineral,
      ringIdx: _anchor.ringIdx,
      cellIdx: _anchor.cellIdx,
      isSatellite: true,
      // === HELIX-OVERLAY-FORK ADDITION (v13) =========================
      // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
      // breadcrumb. Satellites share the parent's material reference,
      // so the parent's opacity write also moves the satellites. The
      // naturalOpacity here is for completeness; the helix update
      // iterates parents only.
      naturalOpacity: mat.transparent ? mat.opacity : 1.0,
      // === END HELIX-OVERLAY-FORK ADDITION ===========================
    };
    satMesh.renderOrder = 1;
    state.crystals.add(satMesh);
  }
}

// Convert a #RRGGBB or rgb(...) string to THREE.Color. Falls back to
// the bare-wall amber so unknown minerals don't render as black.
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
// Caps the historical total at the live total_growth_um so a
// dissolution event later in life can't accidentally inflate replay
// size for steps past dissolution. Negative-thickness phantom zones
// (dissolution) already net into the running sum, so the same
// accumulator handles both growth and dissolution paths.
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
  if (crystal.total_growth_um != null && totalUm > crystal.total_growth_um) {
    totalUm = crystal.total_growth_um;
  }
  if (totalUm <= 0) return null;
  const c = totalUm / 1000.0;
  let a;
  if (crystal.habit === 'prismatic') a = c * 0.4;
  else if (crystal.habit === 'tabular') a = c * 1.5;
  else if (crystal.habit === 'acicular') a = c * 0.15;
  else if (crystal.habit === 'rhombohedral') a = c * 0.8;
  else if (crystal.habit === 'snowball') a = c;
  else a = c * 0.5;
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
function _topoCrystalsSignature(sim: any, replayStep?: number): string {
  if (!sim || !sim.crystals || !sim.crystals.length) return '';
  const parts: string[] = [];
  for (const c of sim.crystals) {
    if (!c) continue;
    // Q4: dissolved crystals normally drop from the scene, BUT a
    // dissolved crystal flagged perimorph_eligible persists as a
    // hollow cast — its outline is the geological signature. Include
    // such casts in the signature so the cache busts when one
    // appears (and so its mesh gets built in _topoSyncCrystalMeshes).
    if (c.dissolved && !c.perimorph_eligible) continue;
    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the truth.
    const _a = c.wall_anchor;
    const _ringKey = _a ? _a.ringIdx : 0;
    const _cellKey = _a ? _a.cellIdx : 0;
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
      const effectiveMineral = (c.paramorph_step != null
                                 && replayStep < c.paramorph_step
                                 && c.paramorph_origin)
        ? c.paramorph_origin
        : c.mineral;
      if (!hist) {
        // Perimorph casts persist at live size as hollow shells —
        // keep them in the signature so the cache key still busts
        // when one appears.
        if (!(c.dissolved && c.perimorph_eligible)) continue;
        parts.push(`${c.crystal_id}:${effectiveMineral}:${c.habit}:cast:${c.c_length_mm.toFixed(2)}:${_ringKey}:${_cellKey}:${_envKey}`);
        continue;
      }
      parts.push(`${c.crystal_id}:${effectiveMineral}:${c.habit}:${hist.c_length_mm.toFixed(2)}:${_ringKey}:${_cellKey}:${_envKey}:r${replayStep}`);
      continue;
    }
    parts.push(`${c.crystal_id}:${c.mineral}:${c.habit}:${c.c_length_mm.toFixed(2)}:${_ringKey}:${_cellKey}:${_envKey}:${c.dissolved ? 'd' : 'a'}`);
  }
  return parts.join('|');
}

// Build (or rebuild) crystal meshes inside `state.crystals`. One mesh
// per non-dissolved Crystal, positioned at its anchor cell's surface,
// oriented so the c-axis points outward from the cavity center, scaled
// by c_length_mm / a_width_mm. Material color comes from
// MINERAL_SPEC[mineral].class_color.
function _topoSyncCrystalMeshes(state: any, sim: any, wall: any, replayStep?: number) {
  if (!sim || !wall || !wall.rings || !wall.rings.length) return;
  const sig = _topoCrystalsSignature(sim, replayStep);
  if (sig === state.crystalsSig) return;
  state.crystalsSig = sig;

  // Clear out the old children. Geometries are cached at the state
  // level (geomCache) so we keep them; only materials per crystal
  // need disposing — but materials are MeshStandardMaterial with no
  // textures, so the GC handles the rest.
  while (state.crystals.children.length) {
    const child = state.crystals.children.pop();
    if (child.material && child.material.dispose) child.material.dispose();
  }

  if (!sim.crystals) return;
  const ringCount = wall.ring_count;
  const N = wall.cells_per_ring;
  const initR = wall.initial_radius_mm || 25;

  for (const crystal of sim.crystals) {
    if (!crystal) continue;
    // Q4 — dissolved crystals normally drop from the scene, BUT a
    // dissolved crystal flagged perimorph_eligible (Q2a tagged via
    // shape-preserving CDR route) persists as a hollow cast. The
    // mesh body is the inherited shape; the material is translucent
    // double-sided so the user reads the void inside the shell.
    if (crystal.dissolved && !crystal.perimorph_eligible) continue;

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

    // PHASE-4-CAVITY-MESH Tranche 4b — wall_anchor is the sole
    // positional field; _resolveAnchor reads only from it.
    const _anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
    if (!_anchor) continue;
    let ringIdx = _anchor.ringIdx;
    if (ringIdx == null || ringIdx < 0 || ringIdx >= ringCount) ringIdx = 0;
    const cellIdx = _anchor.cellIdx;
    if (cellIdx == null) continue;

    const ring = wall.rings[ringIdx];
    if (!ring) continue;
    const cell = ring[cellIdx];
    if (!cell) continue;

    // Anchor point on the cavity wall — same math as
    // _topoBuildCavityGeometry uses, applied to one cell.
    const phi = Math.PI * (ringIdx + 0.5) / ringCount;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
    const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0.0;
    const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
    const radiusMm = (baseR + cell.wall_depth) * polar;
    const theta = (2 * Math.PI * cellIdx) / N + twist;
    const ax = radiusMm * sinPhi * Math.cos(theta);
    const ay = -radiusMm * cosPhi;
    const az = radiusMm * sinPhi * Math.sin(theta);

    // Substrate normal: from wall center (the origin, since the
    // cavity is built around 0,0,0) outward through the anchor.
    // c-axis lies along this normal — crystal grows INTO the cavity
    // (toward origin) for fluid environments. Negate so the c-axis
    // points from anchor toward origin.
    const len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    const nx = -ax / len, ny = -ay / len, nz = -az / len;
    // PHASE-D-HABIT-BIAS — pure helper centralizes the gravity bias.
    // See _topoCAxisForCrystal definition below for the full
    // contract; tests live in tests-js/habit-bias.test.ts.
    const [cAxisX, cAxisY, cAxisZ] = _topoCAxisForCrystal(crystal, nx, ny, nz);

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
    let geom = state.geomCache.get(token);
    if (!geom) {
      geom = _buildHabitGeom(token);
      state.geomCache.set(token, geom);
    }

    // v66 paramorph rewind — argentite → acanthite (and dehydration
    // transitions like borax → tincalconite) flip a crystal's mineral
    // mid-life at a recorded step. During replay before that step we
    // want the ORIGINAL mineral's color/material (pre-cooled argentite
    // looks different from acanthite), so swap to paramorph_origin
    // when replayStep < paramorph_step.
    let effectiveMineral = crystal.mineral;
    if (replayStep != null
        && crystal.paramorph_step != null
        && replayStep < crystal.paramorph_step
        && crystal.paramorph_origin) {
      effectiveMineral = crystal.paramorph_origin;
    }

    // Material — class_color from the mineral spec. Crystals lit by
    // the same scene lights as the cavity, with a touch more
    // metalness for sulfides / native elements (rough heuristic — E4
    // can read a per-mineral material spec if needed).
    const spec = (typeof MINERAL_SPEC !== 'undefined' && MINERAL_SPEC) ? MINERAL_SPEC[effectiveMineral] : null;
    const colorStr = (spec && spec.class_color) || '#d2691e';
    const klass = spec && spec.class;
    const metalness = (klass === 'sulfide' || klass === 'native') ? 0.45 : 0.08;
    let roughness = (klass === 'silicate' || klass === 'oxide') ? 0.42 : 0.62;
    // Q3a porosity boost for CDR pseudomorphs — Putnis 2009 emphasizes
    // that CDR products are typically porous (volume mismatch
    // accommodation between parent and child phases). Boss directive
    // 2026-05-06 #4: renderer-roughness boost is the right level of
    // fidelity rather than a separate sim field; real pseudomorphs
    // vary widely between dense and porous, and the visual cue (less
    // metallic luster, more matte surface) is what reads to the
    // viewer.
    if (isCdrPseudomorph) {
      roughness = Math.min(1.0, roughness + 0.18);
    }
    // Q4 — perimorph cast. When a perimorph_eligible crystal has
    // dissolved, it persists as a hollow shell (Cumbria/Cornwall
    // quartz-after-fluorite type, Cave-in-Rock calcite-after-fluorite).
    // The mesh body is the inherited (Q3a) outline; the material is
    // translucent + double-sided so the viewer reads the void inside.
    // metalness goes to 0 (luster is gone), roughness pushes to nearly
    // matte (etched cast surface).
    const isPerimorphCast = crystal.dissolved && crystal.perimorph_eligible;
    const matOpts: any = {
      color: _topoParseColor(colorStr),
      roughness: isPerimorphCast ? Math.min(1.0, roughness + 0.25) : roughness,
      metalness: isPerimorphCast ? 0.0 : metalness,
      // DoubleSide for every crystal — when the camera is INSIDE the
      // cavity (zoomed in past the wall, orbiting from a vantage near
      // the center) the front-side-only default culls the camera-
      // facing back of each crystal mesh, leaving the user looking at
      // the inside of the far wall and reading the crystal as a
      // hollow outline. With DoubleSide both faces draw and the cube/
      // prism termination stays solid from any view angle. Perimorph
      // casts already needed this for the translucent-shell read; now
      // every habit gets it. Per-fragment cost is small relative to
      // the cavity-clip discard test that already runs anyway.
      side: THREE.DoubleSide,
    };
    if (isPerimorphCast) {
      matOpts.transparent = true;
      matOpts.opacity = 0.42;
    }
    const mat = new THREE.MeshStandardMaterial(matOpts);
    _applyCavityClip(mat, state.clipUniforms);

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
    if (token === 'cube' || token === 'octahedron' || token === 'rhombic_dodec' || token === 'dodecahedron' || token === 'snowball') {
      mesh.scale.set(cLen, cLen, cLen);
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
    } else {
      mesh.scale.set(aWid, cLen, aWid);
    }
    mesh.renderOrder = 1;

    // Position the BASE of the primitive at the anchor (instead of
    // the centroid), so the crystal projects into the cavity rather
    // than half-buried in the wall. Translate along the c-axis
    // direction by half the c-length — for fluid crystals this is
    // substrate-normal; for air-mode crystals it's gravity-aligned
    // (so stalactites drop straight down from the ceiling anchor).
    const offsetMm = cLen * 0.5;
    mesh.position.set(
      ax + cAxisX * offsetMm,
      ay + cAxisY * offsetMm,
      az + cAxisZ * offsetMm,
    );

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

    // userData carries the original Crystal (and its id) so the
    // raycaster in _topoHitTestThree can resolve a hit back to a
    // mineral name + cell shape that matches the canvas-vector
    // hit-test return contract. Subset of fields — enough for
    // tooltip + lock-target consumers, the full crystal is also
    // findable by id via sim.crystals if a consumer needs more.
    mesh.userData = {
      crystal_id: crystal.crystal_id,
      // v66: report the effectiveMineral (paramorph-rewound during
      // replay) so hit-test tooltips match what the user sees.
      mineral: effectiveMineral,
      ringIdx,
      cellIdx,
      // === HELIX-OVERLAY-FORK ADDITION (v13) =========================
      // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
      // breadcrumb. Sweep-writes-crystals mode: the helix overlay
      // multiplies this mesh's material opacity by a 0→1 sweep factor
      // as the leading edge passes this anchor. naturalOpacity (1.0
      // for ordinary crystals, 0.42 for perimorph casts) is captured
      // here so the overlay-off restore path doesn't have to re-derive.
      naturalOpacity: isPerimorphCast ? 0.42 : 1.0,
      // === END HELIX-OVERLAY-FORK ADDITION ===========================
    };

    state.crystals.add(mesh);

    // Phase E5b: emit cluster satellites around this parent. Same
    // geometry + material; inherits parent userData so hit-tests
    // resolve a satellite click back to the parent crystal. The
    // geomToken selects a per-habit cluster pattern (acicular spray,
    // tabular rosette, prismatic forest, cubic carpet, etc.).
    _emitClusterSatellites(state, crystal, geom, mat, ax, ay, az, nx, ny, nz, cLen, aWid, token, wall, ringCount, N, initR);
  }
}

// Cached raycaster + NDC vector — both reusable across calls,
// avoiding per-pointer-move allocations.
const _topoThreeRaycaster: { ray?: any; ndc?: any } = {};

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
  // First hit = nearest crystal (intersectObjects returns by distance).
  const hit = intersects[0];
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
  // Yaw around Y, then pitch around X — same convention as
  // _topoProject3D so the user's drag input behaves identically.
  const cy = Math.cos(_topoTiltY), sy = Math.sin(_topoTiltY);
  const cx = Math.cos(_topoTiltX), sx = Math.sin(_topoTiltX);
  const camX = sy * cx * radius;
  const camY = -sx * radius;
  const camZ = cy * cx * radius;
  state.camera.position.set(camX, camY, camZ);
  state.camera.up.set(0, 1, 0);
  state.camera.lookAt(0, 0, 0);
  // Light sits on the camera-side of the scene so the front face
  // catches the highlight. Subtle moonlit-cavity vibe, not studio.
  if (state.directional) {
    state.directional.position.set(camX * 0.7 + 50, camY * 0.7 + 200, camZ * 0.7 + 100);
  }
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
    if (state.cavity && state.cavity.material) {
      state.cavity.material.side = THREE.FrontSide;
      state.cavity.material.opacity = 1.0;
      state.cavity.material.transparent = false;
      state.cavity.material.needsUpdate = true;
    }
    // Inside the cavity is darker — boost the ambient + warm the
    // directional so crystal faces catch a flame-side glow.
    if (state.ambient) state.ambient.intensity = 0.85;
    if (state.directional) state.directional.intensity = 1.2;
  } else if (outside && state.insideMode) {
    state.insideMode = false;
    if (state.cavity && state.cavity.material) {
      state.cavity.material.side = THREE.BackSide;
      state.cavity.material.opacity = 0.40;
      state.cavity.material.transparent = true;
      state.cavity.material.needsUpdate = true;
    }
    if (state.ambient) state.ambient.intensity = 0.55;
    if (state.directional) state.directional.intensity = 0.9;
  }
}

// One-time default-on setup. Runs the first time _topoRenderThree
// succeeds — colors the toggle button and forces drag mode to 'rotate'
// so dragging the panel orbits the scene out-of-the-box.
function _topoApplyThreeDefaultOnce() {
  if (_topoThreeDefaultApplied) return;
  _topoThreeDefaultApplied = true;
  const btn = document.getElementById('topo-three-btn');
  if (btn) (btn as HTMLElement).style.color = '#f0c050';
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
function _topoSnapshotWall(liveWall: any, snapshot: any): any {
  if (!liveWall || !liveWall.rings || !liveWall.rings.length) return liveWall;
  const ringCount = liveWall.ring_count;
  const N = liveWall.cells_per_ring;
  // Synthetic wall — reuse method shapes from liveWall via Object.assign
  // so polarProfileFactor, ringTwistRadians, etc. still work.
  const synth: any = Object.assign(Object.create(Object.getPrototypeOf(liveWall) || null), liveWall);

  // Detect snapshot shape:
  //   * Multi-ring (v65+): { step, rings: [...] } — use directly.
  //   * Legacy flat array (v60..v64): project across all rings.
  let snapRings: any[];
  if (Array.isArray(snapshot)) {
    snapRings = new Array(ringCount);
    for (let r = 0; r < ringCount; r++) snapRings[r] = snapshot;
  } else if (snapshot && Array.isArray(snapshot.rings)) {
    snapRings = snapshot.rings;
  } else {
    return liveWall;
  }

  const rings: any[] = [];
  for (let r = 0; r < ringCount; r++) {
    // Fall through to ring 0 if the snapshot is short on rings — keeps
    // mid-life ring_count migrations from crashing.
    const sourceRing = snapRings[r] || snapRings[0] || [];
    const ring = new Array(N);
    for (let i = 0; i < N; i++) {
      const snap = sourceRing[i] || {};
      ring[i] = {
        wall_depth: snap.wall_depth || 0,
        crystal_id: snap.crystal_id ?? null,
        mineral: snap.mineral ?? null,
        thickness_um: snap.thickness_um || 0,
        base_radius_mm: snap.base_radius_mm || 0,
      };
    }
    rings[r] = ring;
  }
  synth.rings = rings;
  return synth;
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
function _topoRenderThree(sim: any, wall: any, optOverrideSnap?: any, optReplayStep?: number): boolean {
  const canvas = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  if (!canvas) return false;
  if (!_topoThreeAvailable()) {
    _topoThreeUnavailable = true;
    return false;
  }
  const state = _topoInitThree(canvas);
  if (!state) return false;
  _topoApplyThreeDefaultOnce();
  _topoSyncThreeSize(state, canvas);
  // During replay, build cavity from the snapshot rings so the wall
  // profile reflects the historical step. Force a fresh build each
  // replay frame by invalidating the cached signatures.
  const renderWall = optOverrideSnap ? _topoSnapshotWall(wall, optOverrideSnap) : wall;
  if (optOverrideSnap) {
    state.cavitySig = null;
    state.crystalsSig = null;
  }
  _topoBuildCavityGeometry(state, renderWall, sim);
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
