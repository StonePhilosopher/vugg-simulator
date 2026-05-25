// ============================================================
// js/99j-helix-overlay.ts — Helix Record overlay for the 3D vug
// ============================================================
// Boss model:
//
//   - r ∈ [0, R] where R = cavity wall radius. r=0 = MIN of each
//     dimension; r=R = MAX. Per-parameter polarity:
//        T:  cold at axis,    hot at outer edge
//        pH: basic at axis,   acidic at outer edge
//        any cation:          low at axis, high at outer edge
//        distance-from-center is literal (r=R IS the wall).
//   - Y = vugg height literally — a point at Y=10mm on the helicoid
//     sits at Y=10mm in the cavity.
//   - θ = time, advanced by the spin at 40 RPM (1 rev / 1.5 s real
//     time = 2 rev / sim-time-unit at the sim's 3 s/unit cadence).
//   - Each (parameter, ring) carries a radar-style trailing line:
//        - new sample plotted at the current sweep angle every frame
//        - sample held in WORLD frame at its plot-time angle
//        - fades from full opacity to full transparency over 1/4 turn
//        - "its the same trailing line as radar has"
//
// v4 implementation:
//   - Helicoid SURFACE is the static backdrop / chart paper. Doesn't
//     rotate visibly any more — the trails carry the time semantics.
//   - Trails are world-anchored (separate scene group, not children
//     of the helix group). RGBA vertex colors carry the alpha fade.
//   - Trails sample at every 2° of sweep advance — 45 segments per
//     trail × 16 rings × 6 parameters = 4320 segments max.

let _helixOverlayEnabled = true;
const _HELIX_N_TURNS = 3;

// Parameters surfaced as radar trails. Add params here — no other
// change needed. Each entry: id (used in the chemistry signature),
// [min, max] normalization window, colour, and reader that pulls the
// per-ring value from the sim.
const _HELIX_CHEM_PARAMS: Array<{
  id: string,
  label: string,
  min: number,
  max: number,
  color: number,
  read: (sim: any, i: number) => number | null | undefined,
}> = [
  { id: 'T',   label: 'temperature', min: 50,  max: 250,  color: 0xff5544,
    read: (sim, i) => (sim.ring_temperatures || [])[i] },
  { id: 'pH',  label: 'pH',          min: 2,   max: 12,   color: 0x9966ee,
    read: (sim, i) => ((sim.ring_fluids || [])[i] || {}).pH },
  { id: 'sal', label: 'salinity',    min: 0,   max: 30,   color: 0x44ccdd,
    read: (sim, i) => ((sim.ring_fluids || [])[i] || {}).salinity },
  { id: 'Ca',  label: 'Ca',          min: 0,   max: 1000, color: 0x66cc77,
    read: (sim, i) => ((sim.ring_fluids || [])[i] || {}).Ca },
  { id: 'Fe',  label: 'Fe',          min: 0,   max: 200,  color: 0xee9944,
    read: (sim, i) => ((sim.ring_fluids || [])[i] || {}).Fe },
  { id: 'Mn',  label: 'Mn',          min: 0,   max: 100,  color: 0xffdd55,
    read: (sim, i) => ((sim.ring_fluids || [])[i] || {}).Mn },
];

const _HELIX_FADE_ANGLE = Math.PI / 2;   // 1/4 turn — boss spec
const _HELIX_SAMPLE_STEP = Math.PI / 90;  // sample every 2° of sweep

function _helixDisposeGroup(g: any) {
  if (!g) return;
  g.traverse((obj: any) => {
    if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose && m.dispose());
      else if (obj.material.dispose) obj.material.dispose();
    }
  });
}

function _helixGeometry(wall: any): { R: number, ySpan: number } {
  let R: number;
  if (wall && typeof wall.max_seen_radius_mm === 'number' && wall.max_seen_radius_mm > 0) {
    R = wall.max_seen_radius_mm;
  } else if (wall && wall.vug_diameter_mm) {
    R = wall.vug_diameter_mm * 0.5;
  } else {
    R = 25;
  }
  const ySpan = (wall && wall.vug_diameter_mm) ? wall.vug_diameter_mm : 50;
  return { R, ySpan };
}

function _helixRingY(ringIndex: number, ringCount: number, wallRadius: number): number {
  const phiCav = Math.PI * (ringIndex + 0.5) / ringCount;
  return -wallRadius * Math.cos(phiCav);
}

function _helixChemSig(sim: any): string {
  if (!sim) return 'none';
  const rt = sim.ring_temperatures || [];
  const rf = sim.ring_fluids || [];
  const parts: string[] = [];
  for (let i = 0; i < Math.max(rt.length, rf.length); i++) {
    parts.push((rt[i] || 0).toFixed(0));
    const f = rf[i] || {};
    parts.push(
      (f.pH || 0).toFixed(1),
      (f.salinity || 0).toFixed(0),
      (f.Ca || 0).toFixed(0),
      (f.Fe || 0).toFixed(0),
      (f.Mn || 0).toFixed(0),
    );
  }
  return parts.join('|');
}

// ----- Main entry — called by _topoRenderThree once per frame -----

function _topoHelixOverlayDraw(state: any, sim: any, wall: any) {
  if (!state) return;
  if (!_helixOverlayEnabled) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
      state.helixGroup = null;
      state.helixSig = '';
    }
    if (_helixTrailGroup) {
      state.scene.remove(_helixTrailGroup);
      _helixDisposeGroup(_helixTrailGroup);
      _helixTrailGroup = null;
      _helixTrails = [];
      _helixTrailLines.length = 0;
    }
    state.helixContext = null;
    return;
  }
  if (!sim || !wall || !wall.ring_count) return;

  const { R, ySpan } = _helixGeometry(wall);

  // The surface is static now — rebuild only when geometry changes
  // (ring_count, R, ySpan). Trail content updates every frame via
  // the spin tick, independent of this signature.
  const sig = `${R.toFixed(2)}|${ySpan.toFixed(2)}|${wall.ring_count}`;
  const sigChanged = state.helixSig !== sig;

  if (sigChanged) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
    }
    const group = new THREE.Group();
    group.name = 'helix-record';
    _helixAddSurface(group, R, ySpan);
    state.scene.add(group);
    state.helixGroup = group;
    state.helixSig = sig;

    // Geometry change → reset trails too, otherwise stale dots persist
    // at the old wall radius / ring positions.
    _helixClearTrails();
  }

  _helixEnsureTrailInfra(state.scene, wall.ring_count, _HELIX_CHEM_PARAMS.length);

  // Stash context so the spin tick can update trails every frame
  // without re-running topoRender.
  state.helixContext = { sim, wall, R };

  _helixStartSpin();
}

// ----- Sub-builders ------------------------------------------------

function _helixAddSurface(group: any, R: number, ySpan: number) {
  const NU = 16;
  const NV = Math.max(180, _HELIX_N_TURNS * 60);
  const surfPositions = new Float32Array((NU + 1) * (NV + 1) * 3);
  const surfIndices: number[] = [];
  for (let i = 0; i <= NU; i++) {
    const ri = (i / NU) * R;
    for (let j = 0; j <= NV; j++) {
      const u = j / NV;
      const phi = u * _HELIX_N_TURNS * Math.PI * 2;
      const y = (u - 0.5) * ySpan;
      const vIdx = (i * (NV + 1) + j) * 3;
      surfPositions[vIdx + 0] = ri * Math.cos(phi);
      surfPositions[vIdx + 1] = y;
      surfPositions[vIdx + 2] = ri * Math.sin(phi);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (NV + 1) + j;
      const d = c + 1;
      surfIndices.push(a, c, b, b, c, d);
    }
  }
  const surfGeom = new THREE.BufferGeometry();
  surfGeom.setAttribute('position', new THREE.BufferAttribute(surfPositions, 3));
  surfGeom.setIndex(surfIndices);
  surfGeom.computeVertexNormals();
  const surfMat = new THREE.MeshBasicMaterial({
    color: 0xf0d5a0,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(surfGeom, surfMat));
}

// =========== TRAIL STATE (radar sweep + fading trails) ===================

// _helixTrails[paramIdx][ringIdx] = ordered list of recent samples,
// pruned to within _HELIX_FADE_ANGLE behind the sweep.
let _helixTrails: Array<Array<Array<{ angle: number, r: number, y: number }>>> = [];

// One LineSegments per parameter — every ring's per-frame segment
// concatenated into the parameter's buffer. RGBA vertex colors carry
// the per-vertex alpha (1 at the sweep edge, 0 at the fade boundary).
let _helixTrailGroup: any = null;
const _helixTrailLines: any[] = [];

// Generous per-parameter vertex budget. Caps at:
//   ringCount × ceil(_HELIX_FADE_ANGLE / _HELIX_SAMPLE_STEP) × 2
// = 32 rings × 46 samples × 2 (line-segment expansion) = 2944 verts
// at the most. Round up to 4096 for headroom.
const _TRAIL_MAX_VERTS_PER_PARAM = 4096;

function _helixClearTrails() {
  for (let p = 0; p < _helixTrails.length; p++) {
    if (!_helixTrails[p]) continue;
    for (let i = 0; i < _helixTrails[p].length; i++) {
      _helixTrails[p][i] = [];
    }
  }
}

function _helixEnsureTrailInfra(scene: any, ringCount: number, nParams: number) {
  const sized = _helixTrailGroup
    && _helixTrails.length === nParams
    && (_helixTrails[0] && _helixTrails[0].length === ringCount);
  if (sized) return;

  if (_helixTrailGroup) {
    scene.remove(_helixTrailGroup);
    _helixDisposeGroup(_helixTrailGroup);
  }
  _helixTrailGroup = new THREE.Group();
  _helixTrailGroup.name = 'helix-trails';
  scene.add(_helixTrailGroup);

  _helixTrails = [];
  _helixTrailLines.length = 0;

  for (let p = 0; p < nParams; p++) {
    _helixTrails[p] = [];
    for (let i = 0; i < ringCount; i++) _helixTrails[p][i] = [];

    const positions = new Float32Array(_TRAIL_MAX_VERTS_PER_PARAM * 3);
    const colors = new Float32Array(_TRAIL_MAX_VERTS_PER_PARAM * 4);
    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(colors, 4);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);
    geom.setAttribute('color', colAttr);
    geom.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geom, mat);
    _helixTrailGroup.add(lines);
    _helixTrailLines.push(lines);
  }
}

// Per-frame trail update. Called from the spin tick. Adds a new
// sample at the current sweep angle for every (param, ring), prunes
// samples older than _HELIX_FADE_ANGLE, rewrites the LineSegments
// buffers with positions and per-vertex alpha.
function _helixUpdateTrails(sim: any, wall: any, R: number) {
  if (!sim || !wall || !wall.ring_count) return;
  const ringCount = wall.ring_count;
  const nParams = _HELIX_CHEM_PARAMS.length;
  if (!_helixTrailGroup || _helixTrails.length !== nParams) return;

  const wallRadius = wall.max_seen_radius_mm
                   || (wall.vug_diameter_mm ? wall.vug_diameter_mm * 0.5 : R);
  const sweep = _helixSweepAngle;

  for (let p = 0; p < nParams; p++) {
    const param = _HELIX_CHEM_PARAMS[p];

    // Sample / prune per ring.
    for (let i = 0; i < ringCount; i++) {
      const raw = param.read(sim, i);
      if (typeof raw !== 'number' || isNaN(raw)) continue;
      const norm = Math.max(0, Math.min(1, (raw - param.min) / (param.max - param.min)));
      const r = norm * R;
      const y = _helixRingY(i, ringCount, wallRadius);
      const trail = _helixTrails[p][i];
      const last = trail[trail.length - 1];
      if (!last || (sweep - last.angle) > _HELIX_SAMPLE_STEP) {
        trail.push({ angle: sweep, r, y });
      } else {
        // Refresh the leading sample so live-sim value drift between
        // sample steps still appears.
        last.r = r;
        last.y = y;
      }
      while (trail.length && (sweep - trail[0].angle) > _HELIX_FADE_ANGLE) {
        trail.shift();
      }
    }

    // Rewrite the LineSegments buffer for this parameter from all
    // rings' current trail buffers.
    const lines = _helixTrailLines[p];
    if (!lines) continue;
    const posArr = lines.geometry.attributes.position.array as Float32Array;
    const colArr = lines.geometry.attributes.color.array as Float32Array;
    const cr = ((param.color >> 16) & 0xff) / 255;
    const cg = ((param.color >> 8) & 0xff) / 255;
    const cb = (param.color & 0xff) / 255;

    let v = 0;
    for (let i = 0; i < ringCount; i++) {
      const trail = _helixTrails[p][i];
      for (let k = 0; k < trail.length - 1; k++) {
        if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
        const a = trail[k];
        const b = trail[k + 1];
        const ageA = (sweep - a.angle) / _HELIX_FADE_ANGLE;
        const ageB = (sweep - b.angle) / _HELIX_FADE_ANGLE;
        const aA = Math.max(0, 1 - ageA);
        const aB = Math.max(0, 1 - ageB);

        posArr[v * 3 + 0] = a.r * Math.cos(a.angle);
        posArr[v * 3 + 1] = a.y;
        posArr[v * 3 + 2] = a.r * Math.sin(a.angle);
        colArr[v * 4 + 0] = cr;
        colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb;
        colArr[v * 4 + 3] = aA;
        v++;

        posArr[v * 3 + 0] = b.r * Math.cos(b.angle);
        posArr[v * 3 + 1] = b.y;
        posArr[v * 3 + 2] = b.r * Math.sin(b.angle);
        colArr[v * 4 + 0] = cr;
        colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb;
        colArr[v * 4 + 3] = aB;
        v++;
      }
    }

    lines.geometry.setDrawRange(0, v);
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.attributes.color.needsUpdate = true;
  }
}

// =========== SPINNING ==========================================
// θ = time. The spin advances the sweep angle. Trail samples are
// stamped at the current sweep angle in world frame and fade over
// 1/4 turn. The helicoid surface itself does NOT visibly rotate in
// v4 — it's the static chart paper; the trails carry the motion.

let _helixSpinRAF: number | null = null;
let _helixSpinPrevTime = 0;
let _helixSweepAngle = 0;   // monotonic, never modded — trail age math
                            // needs unwrapped angles.
const _HELIX_RPM = 40;       // 1 rev / 1.5 s real time

function _helixStartSpin() {
  if (_helixSpinRAF != null) return;
  _helixSpinPrevTime = performance.now();
  _helixSpinRAF = requestAnimationFrame(_helixSpinTick);
}

function _helixSpinTick(now: number) {
  const state = (typeof _topoThreeState !== 'undefined') ? _topoThreeState : null;
  if (!_helixOverlayEnabled || !state || !state.helixGroup) {
    _helixSpinRAF = null;
    return;
  }
  const c3 = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  const visible = c3 && c3.offsetParent != null && c3.style.display !== 'none';
  if (visible) {
    const dt = Math.max(0, Math.min(0.1, (now - _helixSpinPrevTime) / 1000));
    const omega = (_HELIX_RPM / 60) * 2 * Math.PI;
    _helixSweepAngle += dt * omega;
    if (state.helixContext) {
      _helixUpdateTrails(state.helixContext.sim, state.helixContext.wall, state.helixContext.R);
    }
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  }
  _helixSpinPrevTime = now;
  _helixSpinRAF = requestAnimationFrame(_helixSpinTick);
}

function helixOverlayToggle() {
  _helixOverlayEnabled = !_helixOverlayEnabled;
  if (typeof topoRender === 'function') topoRender();
}
