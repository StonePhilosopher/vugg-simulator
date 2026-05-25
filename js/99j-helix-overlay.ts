// ============================================================
// js/99j-helix-overlay.ts — Helix Record overlay for the 3D vug
// ============================================================
// Boss model (final, post-v7 feedback):
//
//   "picture radar screens stacked up like a spiral staircase, all
//   slightly offset in their timing so they form a helicoid. each
//   one of those radar lines tells the story of everything that's
//   happening in that straight line. if in the moment of time that
//   it's illuminated the temperature is high there will be a
//   temperature line at the far end. the vugg wall depiction should
//   basically be invisible at this point. the way you see the vugg
//   wall is as the helicoid spins around and intersects with the
//   wall."
//
// So the overlay is N radar screens, one per vugg height (using the
// 16 simulator rings as the discrete Y levels for v8 — finer Y
// resolution later if needed). Each screen has its own current
// sweep angle: sweep_world(Y) = global_sweep + θ_offset(Y), where
// θ_offset(Y) maps Y back onto the helicoid spiral so the leading
// edges of the screens collectively trace the helicoid as they
// rotate. Each (parameter, ring) gets its own radar trail that
// fades over 1/4 turn behind its leading edge.
//
// What's plotted on each screen:
//   - One dot per chemistry parameter at (r=normalized-value, Y_ring,
//     world_angle = sweep + θ_offset(Y_ring)). High value = far end
//     (near outer edge); low value = near axis.
//   - A 1/4-turn trailing arc behind each dot, fading from full
//     opacity at the leading edge to zero at the fade boundary.
//
// What's NOT plotted any more:
//   - The wall-distance primary. Boss: "the vugg wall depiction
//     should basically be invisible at this point." The cavity wall
//     is already visible from the topo 3D cavity mesh; the helicoid
//     spinning around and intersecting the wall is the wall reading.
//
// Helicoid surface still rotates visibly at 40 RPM. The 6 parameter
// trails sit on the rotating surface at the leading edge and trail
// behind in world frame for 1/4 turn.

let _helixOverlayEnabled = true;
const _HELIX_N_TURNS = 1;   // one full revolution = bottom to top of cavity

// 6 chemistry parameters. Each gets its own colour and per-ring
// trail. `read(sim, wall, ringIdx, cellIdx)` returns the current
// value at that ring (cellIdx is currently ignored — chemistry is
// per-ring in this simulator).
const _HELIX_CHEM_PARAMS: Array<{
  id: string,
  label: string,
  min: number,
  max: number,
  color: number,
  read: (sim: any, wall: any, ringIdx: number, cellIdx: number) => number | null | undefined,
}> = [
  { id: 'T',   label: 'temperature', min: 50,  max: 250,  color: 0xff5544,
    read: (s, w, i, c) => (s.ring_temperatures || [])[i] },
  { id: 'pH',  label: 'pH',          min: 2,   max: 12,   color: 0x9966ee,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).pH },
  { id: 'sal', label: 'salinity',    min: 0,   max: 30,   color: 0x44ccdd,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).salinity },
  { id: 'Ca',  label: 'Ca',          min: 0,   max: 1000, color: 0x66cc77,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).Ca },
  { id: 'Fe',  label: 'Fe',          min: 0,   max: 200,  color: 0xee9944,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).Fe },
  { id: 'Mn',  label: 'Mn',          min: 0,   max: 100,  color: 0xffdd55,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).Mn },
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

function _helixGeometry(wall: any): { R: number, ySpan: number, wallRadius: number } {
  let R: number;
  if (wall && typeof wall.max_seen_radius_mm === 'number' && wall.max_seen_radius_mm > 0) {
    R = wall.max_seen_radius_mm;
  } else if (wall && wall.vug_diameter_mm) {
    R = wall.vug_diameter_mm * 0.5;
  } else {
    R = 25;
  }
  const ySpan = (wall && wall.vug_diameter_mm) ? wall.vug_diameter_mm : 50;
  const wallRadius = (wall && typeof wall.max_seen_radius_mm === 'number' && wall.max_seen_radius_mm > 0)
                   ? wall.max_seen_radius_mm
                   : R;
  return { R, ySpan, wallRadius };
}

function _helixRingY(ringIndex: number, ringCount: number, wallRadius: number): number {
  const phiCav = Math.PI * (ringIndex + 0.5) / ringCount;
  return -wallRadius * Math.cos(phiCav);
}

// Per-ring angular offset on the helicoid surface — the local θ
// where the spiral passes through that ring's Y. Adding sweep_global
// to this gives the world angle of that ring's leading-edge dot at
// the current moment.
//
//   y = (θ_local / (2π·N) − 0.5) · ySpan
//   θ_local = ((y / ySpan) + 0.5) · 2π · N
function _helixComputeRingOffsets(ringCount: number, wallRadius: number, ySpan: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ringCount; i++) {
    const y = _helixRingY(i, ringCount, wallRadius);
    const theta = ((y / ySpan) + 0.5) * 2 * Math.PI * _HELIX_N_TURNS;
    out.push(theta);
  }
  return out;
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

  const { R, ySpan, wallRadius } = _helixGeometry(wall);
  const ringCount = wall.ring_count;

  const sig = `${R.toFixed(2)}|${ySpan.toFixed(2)}|${ringCount}`;
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
    _helixClearTrails();
  }

  _helixEnsureTrailInfra(state.scene, ringCount, _HELIX_CHEM_PARAMS.length);

  const ringOffsets = _helixComputeRingOffsets(ringCount, wallRadius, ySpan);
  state.helixContext = { sim, wall, R, ySpan, wallRadius, ringCount, ringOffsets };
  _helixStartSpin();
}

// ----- Sub-builders ------------------------------------------------

function _helixAddSurface(group: any, R: number, ySpan: number) {
  const NU = 16;
  const NV = Math.max(120, _HELIX_N_TURNS * 120);
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
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(surfGeom, surfMat));
}

// =========== TRAIL STATE (per-ring radar trails) ========================
// Nested [paramIdx][ringIdx] — each ring has its own trail per param.
// Each ring's leading-edge dot sits at world_angle = sweep + θ_offset[ring]
// so the 16 leading dots per parameter sit along the helicoid spiral.

let _helixTrails: Array<Array<Array<{ sweep: number, r: number }>>> = [];
let _helixTrailGroup: any = null;
const _helixTrailLines: any[] = [];

// 16 rings × ~45 samples × 2 verts per segment = 1440 verts per param.
// 2048 budget gives ~40% headroom.
const _TRAIL_MAX_VERTS_PER_PARAM = 2048;

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
    && _helixTrails[0] && _helixTrails[0].length === ringCount;
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

// Per-frame trail update. For each (param, ring), sample current
// chemistry, push a new {sweep, r} sample, prune old samples beyond
// the fade window, rewrite the LineSegments buffer with positions
// (computed as world_angle = sweep + ringOffset) and per-vertex alpha.
function _helixUpdateTrails(sim: any, wall: any, R: number, ySpan: number, wallRadius: number, ringCount: number, ringOffsets: number[]) {
  if (!sim || !wall || !ringCount || !ringOffsets) return;
  const nParams = _HELIX_CHEM_PARAMS.length;
  if (!_helixTrailGroup || _helixTrails.length !== nParams) return;

  const sweep = _helixSweepAngle;
  const TWO_PI = Math.PI * 2;
  const sweepWrapped = ((sweep % TWO_PI) + TWO_PI) % TWO_PI;

  for (let p = 0; p < nParams; p++) {
    const param = _HELIX_CHEM_PARAMS[p];
    const lines = _helixTrailLines[p];
    if (!lines) continue;

    const posArr = lines.geometry.attributes.position.array as Float32Array;
    const colArr = lines.geometry.attributes.color.array as Float32Array;
    const cr = ((param.color >> 16) & 0xff) / 255;
    const cg = ((param.color >> 8) & 0xff) / 255;
    const cb = (param.color & 0xff) / 255;

    let v = 0;

    for (let i = 0; i < ringCount; i++) {
      // Sample value at this ring
      const ringArr = (wall.rings && wall.rings[i]) || null;
      const N = ringArr && ringArr.length ? ringArr.length : 0;
      const cellIdx = N > 0 ? Math.floor(sweepWrapped / (TWO_PI / N)) % N : 0;

      const raw = param.read(sim, wall, i, cellIdx);
      if (typeof raw !== 'number' || isNaN(raw)) continue;
      const norm = Math.max(0, Math.min(1, (raw - param.min) / (param.max - param.min)));
      const r = norm * R;
      const y = _helixRingY(i, ringCount, wallRadius);
      const offset = ringOffsets[i] || 0;

      const trail = _helixTrails[p][i];
      const last = trail[trail.length - 1];
      if (!last || (sweep - last.sweep) > _HELIX_SAMPLE_STEP) {
        trail.push({ sweep, r });
      } else {
        last.r = r;
      }
      while (trail.length && (sweep - trail[0].sweep) > _HELIX_FADE_ANGLE) {
        trail.shift();
      }

      // Build segments for this ring's trail. Each segment connects
      // two consecutive samples in (world_angle = sweep + offset, y)
      // with per-vertex alpha = 1 − age/fade.
      for (let k = 0; k < trail.length - 1; k++) {
        if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
        const a = trail[k];
        const b = trail[k + 1];
        const ageA = (sweep - a.sweep) / _HELIX_FADE_ANGLE;
        const ageB = (sweep - b.sweep) / _HELIX_FADE_ANGLE;
        const aA = Math.max(0, 1 - ageA);
        const aB = Math.max(0, 1 - ageB);
        const angleA = a.sweep + offset;
        const angleB = b.sweep + offset;

        posArr[v * 3 + 0] = a.r * Math.cos(angleA);
        posArr[v * 3 + 1] = y;
        posArr[v * 3 + 2] = a.r * Math.sin(angleA);
        colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aA;
        v++;

        posArr[v * 3 + 0] = b.r * Math.cos(angleB);
        posArr[v * 3 + 1] = y;
        posArr[v * 3 + 2] = b.r * Math.sin(angleB);
        colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
        colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aB;
        v++;
      }
    }

    lines.geometry.setDrawRange(0, v);
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.attributes.color.needsUpdate = true;
  }
}

// =========== SPINNING ==========================================

let _helixSpinRAF: number | null = null;
let _helixSpinPrevTime = 0;
let _helixSweepAngle = 0;
const _HELIX_RPM = 40;

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
    state.helixGroup.rotation.y = _helixSweepAngle;
    if (state.helixContext) {
      const c = state.helixContext;
      _helixUpdateTrails(c.sim, c.wall, c.R, c.ySpan, c.wallRadius, c.ringCount, c.ringOffsets);
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
