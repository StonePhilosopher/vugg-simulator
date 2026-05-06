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
    opacity: 0.55,            // translucent so crystals on the far
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
    clipUniforms: {
      uVugRadius: { value: 1e6 },
      uVugCenter: { value: new THREE.Vector3(0, 0, 0) },
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
// per-cell wall_depth produce an irregular cavity; v1 uses the
// cavity's max hull radius, which means crystals can occasionally
// extend slightly past the wall in directions where wall_depth is
// below max. That's a refinement for v2 (per-direction radius via
// a 2D sampler texture indexed by phi/theta).
function _applyCavityClip(material: any, clipUniforms: any) {
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uVugRadius = clipUniforms.uVugRadius;
    shader.uniforms.uVugCenter = clipUniforms.uVugCenter;
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
      '#include <common>\nvarying vec3 vCavityWorldPos;\nuniform vec3 uVugCenter;\nuniform float uVugRadius;'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      'void main() {\n  if (length(vCavityWorldPos - uVugCenter) > uVugRadius) discard;'
    );
  };
  // Force shader rebuild on next render.
  material.needsUpdate = true;
}

// Compose a deterministic signature of the wall + sim conditions that
// affect cavity geometry. If unchanged across renders, skip the
// rebuild. Wall mutates rarely — every dissolution event, every
// fluid-level change — but topoRender fires every step.
function _topoCavitySignature(wall: any, sim: any): string {
  if (!wall || !wall.rings || !wall.rings.length) return '';
  const ring0 = wall.rings[0];
  const N = ring0 ? ring0.length : 0;
  // Cheap fingerprint: ring_count, max_seen_radius, fluid_surface, plus
  // a sampled wall_depth checksum so dissolution events bust the cache.
  let depthSum = 0;
  for (let r = 0; r < wall.rings.length; r++) {
    const ring = wall.rings[r];
    if (!ring) continue;
    // Sample 8 cells per ring (every N/8 steps) for a ~16 × 8 = 128-call
    // checksum. Enough fidelity to catch erosion fronts; still O(1) per
    // render on typical 16×120 cavities.
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

// Build (or rebuild) the cavity mesh from wall.rings. Vertex layout:
//   * One vertex per (ring, cell) pair → ringCount × cellsPerRing
//   * One pole vertex at south pole (φ=0)
//   * One pole vertex at north pole (φ=π)
// Triangulation: south cap fan + inter-ring quads + north cap fan.
// Vertex colors: ring orientation tint (floor/wall/ceiling), submerged
// rings shifted toward blue per the canvas-vector water-line cue.
//
// Mirror of the math in 99e-renderer-topo-3d.ts so the two renderers
// produce visually congruent cavities at zero tilt.
function _topoBuildCavityGeometry(state: any, wall: any, sim: any) {
  if (!wall || !wall.rings || !wall.rings.length) return;
  const sig = _topoCavitySignature(wall, sim);
  if (sig === state.cavitySig) return;
  state.cavitySig = sig;

  const ringCount = wall.ring_count;
  const ring0 = wall.rings[0];
  const N = ring0 ? ring0.length : 0;
  if (!N || ringCount < 1) return;
  const initR = wall.initial_radius_mm || 25;

  // 1 mm = 1 world-unit; the camera scales out from there so framing
  // matches the canvas-vector renderer's `mmToPx`-fitted view.
  const numInterior = ringCount * N;
  const numVerts = numInterior + 2;  // +2 for south/north pole vertices
  const positions = new Float32Array(numVerts * 3);
  const colors = new Float32Array(numVerts * 3);
  const normals = new Float32Array(numVerts * 3);

  // Convert hex color to (r, g, b) ∈ [0, 1].
  const hexToRgb = (hex: number) => [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];

  // Color palette — same triplet the canvas-vector renderer uses, plus
  // a submerged-blue tint for rings under the meniscus.
  const wallColors = {
    floor:   hexToRgb(0xA85820),
    wall:    hexToRgb(0xD2691E),
    ceiling: hexToRgb(0xE8782C),
  };
  const submergedTint = [0.43, 0.74, 0.96];  // rgba(110, 190, 245, 1)

  // Mix two RGB triplets: returns a*(1-t) + b*t.
  const mix = (a: number[], b: number[], t: number) => [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t,
  ];

  // Place the interior ring × cell vertices.
  for (let r = 0; r < ringCount; r++) {
    const phi = Math.PI * (r + 0.5) / ringCount;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
    const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0.0;
    const ring = wall.rings[r];

    // Determine ring orientation + water state once per ring.
    const orient = wall.ringOrientation ? wall.ringOrientation(r) : 'wall';
    const baseColor = wallColors[orient] || wallColors.wall;
    const wstate = (sim && sim.conditions && sim.conditions.ringWaterState)
      ? sim.conditions.ringWaterState(r, ringCount)
      : 'submerged';
    const isSubmerged = wstate === 'submerged'
      && sim && sim.conditions && sim.conditions.fluid_surface_ring != null;
    const tinted = isSubmerged ? mix(baseColor, submergedTint, 0.35) : baseColor;

    for (let c = 0; c < N; c++) {
      const cell = ring && ring[c];
      const baseR = cell && cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
      const depth = cell ? cell.wall_depth : 0;
      const radiusMm = (baseR + depth) * polar;
      const theta = (2 * Math.PI * c) / N + twist;
      const x = radiusMm * sinPhi * Math.cos(theta);
      const y = -radiusMm * cosPhi;          // south pole at -y, north at +y
      const z = radiusMm * sinPhi * Math.sin(theta);
      const idx = r * N + c;
      positions[idx * 3 + 0] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      colors[idx * 3 + 0] = tinted[0];
      colors[idx * 3 + 1] = tinted[1];
      colors[idx * 3 + 2] = tinted[2];
      // Outward normal — radial from origin. computeVertexNormals would
      // overwrite this but we set sensible defaults so the first frame
      // before normals are recomputed isn't black.
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      normals[idx * 3 + 0] = x / len;
      normals[idx * 3 + 1] = y / len;
      normals[idx * 3 + 2] = z / len;
    }
  }

  // Pole vertices — average ring radii at the closest ring, projected
  // onto the pole axis. Inherit the closest ring's color so the cap
  // matches the floor/ceiling tint.
  const southIdx = numInterior;
  const northIdx = numInterior + 1;
  const meanRingRadius = (rIdx: number) => {
    const ring = wall.rings[rIdx];
    if (!ring) return initR;
    let sum = 0;
    for (let c = 0; c < N; c++) {
      const cell = ring[c];
      sum += (cell && cell.base_radius_mm > 0 ? cell.base_radius_mm : initR)
             + (cell ? cell.wall_depth : 0);
    }
    return sum / N;
  };
  const southR = meanRingRadius(0) * Math.cos(Math.PI / (2 * ringCount));
  const northR = meanRingRadius(ringCount - 1) * Math.cos(Math.PI / (2 * ringCount));
  positions[southIdx * 3 + 0] = 0;
  positions[southIdx * 3 + 1] = -southR;
  positions[southIdx * 3 + 2] = 0;
  positions[northIdx * 3 + 0] = 0;
  positions[northIdx * 3 + 1] = +northR;
  positions[northIdx * 3 + 2] = 0;
  // Pole colors borrow ring 0 / ring N-1 average — small enough effect
  // to approximate as the orientation color directly.
  const southOrient = wall.ringOrientation ? wall.ringOrientation(0) : 'floor';
  const northOrient = wall.ringOrientation ? wall.ringOrientation(ringCount - 1) : 'ceiling';
  const southCol = wallColors[southOrient] || wallColors.floor;
  const northCol = wallColors[northOrient] || wallColors.ceiling;
  colors.set(southCol, southIdx * 3);
  colors.set(northCol, northIdx * 3);
  normals.set([0, -1, 0], southIdx * 3);
  normals.set([0, +1, 0], northIdx * 3);

  // Triangulate. Index buffer is small enough to stay 16-bit (the
  // 16×120 default produces 3,840 triangles → 11,520 indices, well
  // under 65,535).
  const indices: number[] = [];
  // South cap: fan from south pole to ring 0.
  for (let c = 0; c < N; c++) {
    const a = southIdx;
    const b = 0 * N + c;
    const cNext = 0 * N + ((c + 1) % N);
    indices.push(a, cNext, b);  // wind so outward-normal faces away from origin
  }
  // Inter-ring quads: each (k, c) → (k, c+1) → (k+1, c) → (k+1, c+1).
  for (let k = 0; k < ringCount - 1; k++) {
    for (let c = 0; c < N; c++) {
      const cNext = (c + 1) % N;
      const a = k * N + c;
      const b = k * N + cNext;
      const c2 = (k + 1) * N + c;
      const d = (k + 1) * N + cNext;
      indices.push(a, b, c2);
      indices.push(b, d, c2);
    }
  }
  // North cap: fan from ring N-1 to north pole.
  for (let c = 0; c < N; c++) {
    const a = northIdx;
    const b = (ringCount - 1) * N + c;
    const cNext = (ringCount - 1) * N + ((c + 1) % N);
    indices.push(a, b, cNext);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const indexAttr = numVerts > 65535
    ? new THREE.Uint32BufferAttribute(indices, 1)
    : new THREE.Uint16BufferAttribute(indices, 1);
  geom.setIndex(indexAttr);
  geom.computeVertexNormals();  // overwrite the placeholder normals with
                                // mesh-aware ones for proper shading

  const target = state.cavity;
  const prev = target.geometry;
  target.geometry = geom;
  if (prev && prev.dispose) prev.dispose();

  // Update the cavity hull radius for the per-crystal clip shader.
  // Use the actual max world-space distance from origin across the
  // generated vertex positions (already accounts for polarProfileFactor,
  // cell.wall_depth, and any other per-cell radius modifier the build
  // step applied). Crystals get clipped at this radius — the vug
  // becomes the slice surface.
  let maxR2 = 0;
  for (let i = 0; i < numVerts; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const r2 = x * x + y * y + z * z;
    if (r2 > maxR2) maxR2 = r2;
  }
  state.clipUniforms.uVugRadius.value = Math.sqrt(maxR2);
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
  if (h === 'acicular' || h === 'capillary') return 'spike';
  if (h === 'prismatic' || h === 'columnar' || h === 'bladed') return 'prism';
  if (h === 'tabular' || h === 'platy' || h === 'foliated') return 'tablet';
  if (h === 'rhombohedral') return 'rhomb';
  if (h === 'scalenohedral') return 'scalene';  // E5 batch 2: distinct from rhomb (calcite dogtooth)
  if (h === 'cubic' || h === 'cuboid') return 'cube';
  if (h === 'octahedral') return 'octahedron';
  // E5 batch 3: garnet-style rhombic dodecahedron (12 rhombic faces,
  // 14 vertices) is the dominant garnet/almandine habit. The regular
  // Platonic dodecahedron (12 pentagonal faces) is what 'dodecahedral'
  // produces — kept for any mineral that genuinely needs that.
  if (h === 'rhombic dodecahedral' || h === 'rhombic-dodecahedral' || h === 'garnet' || h === 'trapezohedral') return 'rhombic_dodec';
  if (h === 'dodecahedral') return 'dodecahedron';
  if (h === 'botryoidal' || h === 'reniform' || h === 'mammillary' || h === 'globular') return 'botryoidal';
  if (h === 'dendritic' || h === 'arborescent') return 'spike';  // splay handled per-instance later
  if (h === 'fibrous') return 'spike';
  return 'prism';  // sensible default — most cavity habits are vaguely prismatic
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
    case 'octahedron':
      return new THREE.OctahedronGeometry(0.55, 0);
    case 'rhombic_dodec':
      // Garnet-style 12 rhombic faces. Phase E5 batch 3.
      return _makeRhombicDodecahedron();
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(0.55, 0);
    case 'botryoidal':
      // Botryoidal — multi-bubble cluster reads as malachite kidney
      // or hematite blob. Phase E5 batch 1.
      return _makeBotryoidalCluster();
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
};

const _CLUSTER_PATTERN_DEFAULT: ClusterPattern = {
  countScale: 1.0,
  spreadMul: 1.0,
  tiltMax: 0.20,
  scaleMin: 0.40,
  scaleMax: 0.80,
  evenAngles: false,
};

// Number of satellite meshes per crystal — scales inversely with
// crystal size. Big gem crystals (>60 mm) read as solo specimens;
// small ones build into drusy carpets. Multiplied by the per-habit
// countScale.
function _clusterSatelliteCount(crystal: any, pattern: ClusterPattern): number {
  const cLen = crystal.c_length_mm;
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
) {
  const pattern = _CLUSTER_PATTERNS[geomToken] || _CLUSTER_PATTERN_DEFAULT;
  const n = _clusterSatelliteCount(crystal, pattern);
  if (n === 0) return;
  const rand = _clusterRand((crystal.crystal_id || 0) * 0x9E3779B9 + 0x12345);
  // Build an orthonormal tangent frame perpendicular to the substrate
  // normal so satellite offsets stay in the wall plane.
  const refUp = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let t1x = refUp[1] * nz - refUp[2] * ny;
  let t1y = refUp[2] * nx - refUp[0] * nz;
  let t1z = refUp[0] * ny - refUp[1] * nx;
  const t1len = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1;
  t1x /= t1len; t1y /= t1len; t1z /= t1len;
  const t2x = ny * t1z - nz * t1y;
  const t2y = nz * t1x - nx * t1z;
  const t2z = nx * t1y - ny * t1x;
  const spread = parentAWid * 1.5 * pattern.spreadMul;
  const scaleSpan = pattern.scaleMax - pattern.scaleMin;
  const tiltSpan = pattern.tiltMax * 2;  // span around 0 (i.e. ±tiltMax)
  const upVec = new THREE.Vector3(0, 1, 0);
  const targetVec = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const r = (0.5 + 0.5 * rand()) * spread;
    // Even angular spacing for rosette habits, random for everything else.
    const angle = pattern.evenAngles
      ? (i / n) * Math.PI * 2 + rand() * 0.3
      : rand() * Math.PI * 2;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const ox = ax + r * (ca * t1x + sa * t2x);
    const oy = ay + r * (ca * t1y + sa * t2y);
    const oz = az + r * (ca * t1z + sa * t2z);
    const sScale = pattern.scaleMin + scaleSpan * rand();
    const sCLen = parentCLen * sScale;
    const sAWid = parentAWid * sScale;
    // Tilt off parent normal — magnitude per-habit. For rosettes the
    // tilt direction is the OUTWARD radial (so petals open outward);
    // for everything else the tilt axis is randomized so the spray
    // looks irregular rather than synchronized.
    const tiltAngle = (rand() - 0.5) * tiltSpan;
    const tiltAxisAngle = pattern.evenAngles
      ? angle + Math.PI / 2     // rosette: tilt axis perpendicular to radial direction
      : rand() * Math.PI * 2;

    const tax = Math.cos(tiltAxisAngle) * t1x + Math.sin(tiltAxisAngle) * t2x;
    const tay = Math.cos(tiltAxisAngle) * t1y + Math.sin(tiltAxisAngle) * t2y;
    const taz = Math.cos(tiltAxisAngle) * t1z + Math.sin(tiltAxisAngle) * t2z;
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
    const kDotN = tax * nx + tay * ny + taz * nz;
    // Rodrigues' rotation formula — rotate normal around tilt axis.
    let sNx = nx * cosT + (tay * nz - taz * ny) * sinT + tax * kDotN * (1 - cosT);
    let sNy = ny * cosT + (taz * nx - tax * nz) * sinT + tay * kDotN * (1 - cosT);
    let sNz = nz * cosT + (tax * ny - tay * nx) * sinT + taz * kDotN * (1 - cosT);
    const nLen = Math.sqrt(sNx * sNx + sNy * sNy + sNz * sNz) || 1;
    sNx /= nLen; sNy /= nLen; sNz /= nLen;
    const sOffset = sCLen * 0.5;
    const satMesh = new THREE.Mesh(geom, mat);
    if (geomToken === 'cube' || geomToken === 'octahedron' || geomToken === 'rhombic_dodec' || geomToken === 'dodecahedron') {
      satMesh.scale.set(sCLen, sCLen, sCLen);
    } else {
      satMesh.scale.set(sAWid, sCLen, sAWid);
    }
    satMesh.position.set(
      ox + sNx * sOffset,
      oy + sNy * sOffset,
      oz + sNz * sOffset,
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
    satMesh.userData = {
      crystal_id: crystal.crystal_id,
      mineral: crystal.mineral,
      ringIdx: crystal.wall_ring_index,
      cellIdx: crystal.wall_center_cell,
      isSatellite: true,
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

// Compose a deterministic signature of the crystals that affects
// their meshes — id, mineral, habit, c_length_mm, ring/cell anchor.
// Excludes growth_environment because all current crystals use
// 'fluid' (geometric-selection orientation along the substrate
// normal); E4 will fold in 'air' as it activates.
function _topoCrystalsSignature(sim: any): string {
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
    parts.push(`${c.crystal_id}:${c.mineral}:${c.habit}:${c.c_length_mm.toFixed(2)}:${c.wall_ring_index}:${c.wall_center_cell}:${c.dissolved ? 'd' : 'a'}`);
  }
  return parts.join('|');
}

// Build (or rebuild) crystal meshes inside `state.crystals`. One mesh
// per non-dissolved Crystal, positioned at its anchor cell's surface,
// oriented so the c-axis points outward from the cavity center, scaled
// by c_length_mm / a_width_mm. Material color comes from
// MINERAL_SPEC[mineral].class_color.
function _topoSyncCrystalMeshes(state: any, sim: any, wall: any) {
  if (!sim || !wall || !wall.rings || !wall.rings.length) return;
  const sig = _topoCrystalsSignature(sim);
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
    let ringIdx = crystal.wall_ring_index;
    if (ringIdx == null || ringIdx < 0 || ringIdx >= ringCount) ringIdx = 0;
    const cellIdx = crystal.wall_center_cell;
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

    // Pick the habit primitive and cache it.
    const token = _habitGeomToken(habitForGeom);
    let geom = state.geomCache.get(token);
    if (!geom) {
      geom = _buildHabitGeom(token);
      state.geomCache.set(token, geom);
    }

    // Material — class_color from the mineral spec. Crystals lit by
    // the same scene lights as the cavity, with a touch more
    // metalness for sulfides / native elements (rough heuristic — E4
    // can read a per-mineral material spec if needed).
    const spec = (typeof MINERAL_SPEC !== 'undefined' && MINERAL_SPEC) ? MINERAL_SPEC[crystal.mineral] : null;
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
    };
    if (isPerimorphCast) {
      matOpts.transparent = true;
      matOpts.opacity = 0.42;
      matOpts.side = THREE.DoubleSide;
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
    const cLen = Math.max(2.0, crystal.c_length_mm);
    const aWid = Math.max(1.5, crystal.a_width_mm);
    if (token === 'cube' || token === 'octahedron' || token === 'rhombic_dodec' || token === 'dodecahedron') {
      mesh.scale.set(cLen, cLen, cLen);
    } else {
      mesh.scale.set(aWid, cLen, aWid);
    }
    mesh.renderOrder = 1;

    // Position the BASE of the primitive at the anchor (instead of
    // the centroid), so the crystal projects into the cavity rather
    // than half-buried in the wall. Translate along the substrate
    // normal by half the c-length.
    const offsetMm = cLen * 0.5;
    mesh.position.set(
      ax + nx * offsetMm,
      ay + ny * offsetMm,
      az + nz * offsetMm,
    );

    // Orient so the local +Y axis aligns with the substrate normal.
    // Three.js Object3D.lookAt orients local -Z toward the target;
    // we want local +Y. quaternion.setFromUnitVectors handles it.
    const up = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Vector3(nx, ny, nz);
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
      mineral: crystal.mineral,
      ringIdx,
      cellIdx,
    };

    state.crystals.add(mesh);

    // Phase E5b: emit cluster satellites around this parent. Same
    // geometry + material; inherits parent userData so hit-tests
    // resolve a satellite click back to the parent crystal. The
    // geomToken selects a per-habit cluster pattern (acicular spray,
    // tabular rosette, prismatic forest, cubic carpet, etc.).
    _emitClusterSatellites(state, crystal, geom, mat, ax, ay, az, nx, ny, nz, cLen, aWid, token);
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
      state.cavity.material.opacity = 0.55;
      state.cavity.material.transparent = true;
      state.cavity.material.needsUpdate = true;
    }
    if (state.ambient) state.ambient.intensity = 0.55;
    if (state.directional) state.directional.intensity = 0.9;
  }
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
  _topoBuildCavityGeometry(state, wall, sim);
  _topoSyncCrystalMeshes(state, sim, wall);
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
