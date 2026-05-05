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
  };
  return _topoThreeState;
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
  if (h === 'rhombohedral' || h === 'scalenohedral') return 'rhomb';
  if (h === 'cubic' || h === 'cuboid') return 'cube';
  if (h === 'octahedral') return 'octahedron';
  if (h === 'dodecahedral') return 'dodecahedron';
  if (h === 'botryoidal' || h === 'reniform' || h === 'mammillary' || h === 'globular') return 'botryoidal';
  if (h === 'dendritic' || h === 'arborescent') return 'spike';  // splay handled per-instance later
  if (h === 'fibrous') return 'spike';
  return 'prism';  // sensible default — most cavity habits are vaguely prismatic
}

// Build a unit-sized primitive geometry for a given habit token,
// oriented so its long axis (= c-axis) lies along +Y. The instance
// transform later places the apex at the wall, base inside the
// cavity, and scales by c_length / a_width.
function _buildHabitGeom(token: string): any {
  switch (token) {
    case 'spike':
      // Acicular — long thin needle. Pointy on both ends to read as
      // an isolated needle rather than a stub stuck in the wall.
      return new THREE.ConeGeometry(0.5, 1.0, 6, 1, false);
    case 'prism':
      // Prismatic — hexagonal prism with a slight taper toward the
      // free tip. Captures the dominant calcite / quartz / beryl shape.
      return new THREE.CylinderGeometry(0.45, 0.55, 1.0, 6, 1, false);
    case 'tablet':
      // Tabular — flattened rectangular plate, c-axis the short
      // dimension. 1.5× wider than tall when scaled by a_width
      // (the c_length × 1.5 factor comes from the Crystal class).
      return new THREE.BoxGeometry(1.0, 0.4, 1.0);
    case 'rhomb':
      // Rhombohedral — octahedron rotated by 45° around c-axis reads
      // as a steeply-pointed "dogtooth" calcite scalenohedron. Six
      // faces meeting at two pointed apices.
      return new THREE.OctahedronGeometry(0.55, 0);
    case 'cube':
      return new THREE.BoxGeometry(0.8, 0.8, 0.8);
    case 'octahedron':
      return new THREE.OctahedronGeometry(0.55, 0);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(0.55, 0);
    case 'botryoidal':
      // Botryoidal — bumpy half-sphere clinging to the wall. E4 may
      // replace with multi-bubble geometry; for E3 a single sphere
      // reads cleanly.
      return new THREE.SphereGeometry(0.5, 12, 8);
    default:
      return new THREE.CylinderGeometry(0.45, 0.55, 1.0, 6, 1, false);
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
    if (!c || c.dissolved) continue;
    parts.push(`${c.crystal_id}:${c.mineral}:${c.habit}:${c.c_length_mm.toFixed(2)}:${c.wall_ring_index}:${c.wall_center_cell}`);
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
    if (!crystal || crystal.dissolved) continue;
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

    // Pick the habit primitive and cache it.
    const token = _habitGeomToken(crystal.habit);
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
    const roughness = (klass === 'silicate' || klass === 'oxide') ? 0.42 : 0.62;
    const mat = new THREE.MeshStandardMaterial({
      color: _topoParseColor(colorStr),
      roughness,
      metalness,
    });

    const mesh = new THREE.Mesh(geom, mat);

    // Scale: c-axis along Y in the unit primitive → scale Y by
    // c_length_mm. a-axis (perpendicular) scales by a_width_mm.
    // Floor at 2 mm c / 1.5 mm a so a typical 30 mm cavity reads as
    // dotted with macro-crystals rather than dusted with invisible
    // ones. Aesthetic-over-accurate trade-off; E4 can revisit once
    // the camera supports zoom-into-cavity for true scale.
    const cLen = Math.max(2.0, crystal.c_length_mm);
    const aWid = Math.max(1.5, crystal.a_width_mm);
    mesh.scale.set(aWid, cLen, aWid);
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

    state.crystals.add(mesh);
  }
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
