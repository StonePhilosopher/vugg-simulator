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

// Per-param on/off — parallel to _HELIX_CHEM_PARAMS (lazily sized on
// first legend build). Click a legend row to flip the bool; the trail
// updater empties that param's draw range when off, so toggled-off
// params disappear without disturbing anyone else's verts.
let _helixParamEnabled: boolean[] = [];

// Pure-JS HSL → hex, no THREE dependency at module-load time. Used
// to spread the 41 ion trail colours evenly around the hue wheel.
function _hexFromHSL(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | b;
}

// First entry is the PRIMARY: wall distance per (ring, cell), white,
// plotted at literal world-mm (no normalization). v11: future-fade
// too — the wall is static during a scenario, so we can predict its
// position 1/4 turn ahead and render those segments with the same
// alpha ramp as the past. Boss: "its a known constant, so it makes
// sense that you could predict where it will be relatively."
//
// Then specials: temperature (from ring_temperatures), then pH / Eh
// / salinity / O2 (from ring_fluids).
//
// Then 41 ions covering the full simulator fluid vocabulary
// (_fluidFieldNames). Each ion's [min, max] range is set from
// observed typical concentrations grouped into majors (0-500 mg/L),
// commons (0-200), low (0-50), trace (0-10), ultra-trace (0-5).
// Colours auto-distributed via HSL hue spread so 41 lines stay
// distinguishable.
type ChemParam = {
  id: string,
  label: string,
  min: number,
  max: number,
  color: number,
  primary?: boolean,
  read: (sim: any, wall: any, ringIdx: number, cellIdx: number) => number | null | undefined,
};

const _HELIX_CHEM_PARAMS: ChemParam[] = (function() {
  const params: ChemParam[] = [];

  // Primary
  params.push({
    id: 'wall', label: 'wall distance', min: 0, max: 0, color: 0xffffff,
    primary: true,
    read: (sim, wall, i, c) => {
      if (!wall || !wall.rings) return null;
      const ring = wall.rings[i];
      if (!ring || !ring.length) return null;
      const cell = ring[c % ring.length];
      if (!cell) return null;
      return (cell.base_radius_mm || 0) + (cell.wall_depth || 0);
    },
  });

  // Specials
  params.push({ id: 'T',        label: 'temperature', min: 50,   max: 250,  color: 0xff5544,
    read: (s, w, i, c) => (s.ring_temperatures || [])[i] });
  params.push({ id: 'pH',       label: 'pH',          min: 2,    max: 12,   color: 0x9966ee,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).pH });
  params.push({ id: 'Eh',       label: 'Eh',          min: -400, max: 800,  color: 0xddee44,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).Eh });
  params.push({ id: 'salinity', label: 'salinity',    min: 0,    max: 30,   color: 0x44ccdd,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).salinity });
  params.push({ id: 'O2',       label: 'O2',          min: 0,    max: 10,   color: 0xaaccff,
    read: (s, w, i, c) => ((s.ring_fluids || [])[i] || {}).O2 });

  // Ions — id, min, max. Ranges chosen from observed typical values
  // in MVT-seed-42 sample fluid (see the helix-record data dump).
  const ION_DEFS: Array<[string, number, number]> = [
    // Majors (0-500 mg/L)
    ['SiO2', 0, 500], ['Ca', 0, 500], ['CO3', 0, 500], ['Cl', 0, 500],
    ['Na', 0, 200],   ['Mg', 0, 100], ['K', 0, 50],    ['S', 0, 100], ['F', 0, 100],
    // Common metals (0-200)
    ['Fe', 0, 200],   ['Mn', 0, 200], ['Zn', 0, 200],  ['Pb', 0, 200], ['Cu', 0, 50],
    // Common others
    ['Ba', 0, 50],    ['Sr', 0, 50],  ['Al', 0, 50],   ['P', 0, 50],   ['As', 0, 50],
    // Trace (0-10)
    ['Ti', 0, 10],    ['U', 0, 10],   ['Mo', 0, 10],   ['Cr', 0, 10],  ['V', 0, 10],
    ['W', 0, 10],     ['Ag', 0, 20],  ['Bi', 0, 10],   ['Sb', 0, 10],  ['Ni', 0, 10],
    ['Co', 0, 10],    ['B', 0, 10],   ['Li', 0, 10],   ['Cd', 0, 10],  ['Y', 0, 10],
    // Ultra-trace (0-5)
    ['Be', 0, 5],     ['Te', 0, 5],   ['Se', 0, 5],    ['Ge', 0, 5],   ['Au', 0, 5],
    ['Hg', 0, 5],     ['Sn', 0, 5],
  ];

  for (let i = 0; i < ION_DEFS.length; i++) {
    const [ionId, mn, mx] = ION_DEFS[i];
    const hue = i / ION_DEFS.length;          // even hue spread
    const color = _hexFromHSL(hue, 0.7, 0.55);
    params.push({
      id: ionId, label: ionId, min: mn, max: mx, color,
      read: (s: any, w: any, ri: number, c: number) =>
        ((s.ring_fluids || [])[ri] || {})[ionId],
    });
  }

  return params;
})();

const _HELIX_FADE_ANGLE = Math.PI / 2;   // 1/4 turn — boss spec
const _HELIX_SAMPLE_STEP = Math.PI / 90;  // sample every 2° of sweep

// =========== LEGEND ====================================================
// Boss v12 ask: side legend, hover-to-identify, show-only-active, and
// highlight-movers — and the legend rows toggle individual params on
// and off. The toggle is the foundation; the focus modes (active /
// movers / hover) layer on top later. This block handles legend build
// + enable-array + click-toggle + bulk all/none.

let _helixLegendBuilt = false;

function _helixHexFromColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function _helixBuildLegend() {
  const panel = document.getElementById('helix-legend');
  if (!panel) return;
  if (_helixParamEnabled.length !== _HELIX_CHEM_PARAMS.length) {
    _helixParamEnabled = _HELIX_CHEM_PARAMS.map(() => true);
  }
  // Section boundaries inside _HELIX_CHEM_PARAMS (matches the IIFE
  // build order: 1 primary, 5 specials, then 41 ions).
  const sections: Array<{ title: string, start: number, end: number }> = [
    { title: 'Wall',      start: 0, end: 1 },
    { title: 'Conditions', start: 1, end: 6 },
    { title: 'Ions',       start: 6, end: _HELIX_CHEM_PARAMS.length },
  ];

  const html: string[] = [];
  html.push('<div class="helix-legend-header">'
    + '<span>Helix params</span>'
    + '<span style="display:flex;gap:3px">'
    + '<button class="legend-bulk" data-helix-bulk="all"  title="Show all params">all</button>'
    + '<button class="legend-bulk" data-helix-bulk="none" title="Hide all params">none</button>'
    + '</span></div>');
  for (const sec of sections) {
    html.push(`<div class="helix-legend-section">${sec.title}</div>`);
    for (let i = sec.start; i < sec.end; i++) {
      const p = _HELIX_CHEM_PARAMS[i];
      const swatch = _helixHexFromColor(p.color);
      const off = _helixParamEnabled[i] ? '' : ' is-off';
      html.push(
        `<div class="helix-legend-row${off}" data-helix-idx="${i}" title="${p.label}">`
        + `<span class="helix-legend-swatch" style="background:${swatch}"></span>`
        + `<span class="helix-legend-label">${p.label}</span>`
        + '</div>'
      );
    }
  }
  panel.innerHTML = html.join('');

  panel.addEventListener('click', _helixLegendClickHandler);
  _helixLegendBuilt = true;
}

function _helixLegendClickHandler(ev: Event) {
  const t = ev.target as HTMLElement | null;
  if (!t) return;
  // Bulk all/none buttons short-circuit before per-row handling.
  const bulkBtn = t.closest('[data-helix-bulk]') as HTMLElement | null;
  if (bulkBtn) {
    const mode = bulkBtn.getAttribute('data-helix-bulk');
    const val = mode === 'all';
    for (let i = 0; i < _helixParamEnabled.length; i++) _helixParamEnabled[i] = val;
    _helixRefreshLegendRows();
    return;
  }
  const row = t.closest('[data-helix-idx]') as HTMLElement | null;
  if (!row) return;
  const idx = parseInt(row.getAttribute('data-helix-idx') || '-1', 10);
  if (idx < 0 || idx >= _helixParamEnabled.length) return;
  _helixParamEnabled[idx] = !_helixParamEnabled[idx];
  row.classList.toggle('is-off', !_helixParamEnabled[idx]);
}

function _helixRefreshLegendRows() {
  const panel = document.getElementById('helix-legend');
  if (!panel) return;
  const rows = panel.querySelectorAll('[data-helix-idx]');
  rows.forEach(r => {
    const idx = parseInt(r.getAttribute('data-helix-idx') || '-1', 10);
    if (idx < 0) return;
    (r as HTMLElement).classList.toggle('is-off', !_helixParamEnabled[idx]);
  });
}

function _helixSyncLegendVisibility() {
  const panel = document.getElementById('helix-legend');
  if (panel) panel.style.display = _helixOverlayEnabled ? 'block' : 'none';
  // Keep the toolbar button colour in sync — overlay defaults to
  // enabled on load, but the button starts uncoloured until first
  // draw. Setting here covers both the initial render and the
  // toggle callback path.
  const btn = document.getElementById('helix-overlay-btn');
  if (btn) (btn as HTMLElement).style.color = _helixOverlayEnabled ? '#f0c050' : '';
}

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

// Helicoid geometry derived from the cavity mesh. R = cavity equatorial
// wall radius (used for value normalization). yMin/yMax = actual
// vertical extent of the cavity from its mesh bounding box — NOT
// assumed from wallRadius, because scenarios with polar_collapse,
// elongation, asymmetric architecture, etc. can put the cavity's true
// top/bottom far inside ±wallRadius. The v8 bug: rings were stacked
// from -wallRadius to +wallRadius which floated trails clear off both
// ends of an oblate or collapsed cavity. ySpan is computed from
// yMax−yMin so the helicoid and the rings track the actual cavity.
function _helixGeometry(state: any, wall: any): {
  R: number, wallRadius: number, yMin: number, yMax: number, ySpan: number,
} {
  let R: number;
  if (wall && typeof wall.max_seen_radius_mm === 'number' && wall.max_seen_radius_mm > 0) {
    R = wall.max_seen_radius_mm;
  } else if (wall && wall.vug_diameter_mm) {
    R = wall.vug_diameter_mm * 0.5;
  } else {
    R = 25;
  }
  const wallRadius = R;

  // Pull actual Y extent from the cavity mesh's bounding box. Falls
  // back to centred ±R if the cavity geometry isn't built yet.
  let yMin = -R, yMax = R;
  const geom = state && state.cavity && state.cavity.geometry;
  if (geom) {
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb && isFinite(bb.min.y) && isFinite(bb.max.y) && bb.max.y > bb.min.y) {
      yMin = bb.min.y;
      yMax = bb.max.y;
    }
  }
  const ySpan = yMax - yMin;
  return { R, wallRadius, yMin, yMax, ySpan };
}

// Ring index → world Y, using the cavity's actual yMin/yMax (not
// assumed ±wallRadius). Mirrors the cavity mesh's spherical phi_cav
// distribution centred on the cavity's actual midpoint.
function _helixRingY(ringIndex: number, ringCount: number, yMin: number, yMax: number): number {
  const phiCav = Math.PI * (ringIndex + 0.5) / ringCount;
  const yCenter = (yMin + yMax) * 0.5;
  const yHalf = (yMax - yMin) * 0.5;
  return yCenter - yHalf * Math.cos(phiCav);
}

// Per-ring angular offset on the helicoid surface — the local θ
// where the spiral passes through that ring's Y. The spiral's
// parametric Y is yCenter + (u − 0.5) · ySpan with u = θ_local/(2π·N),
// so:
//
//   u = (y − yCenter) / ySpan + 0.5
//   θ_local = u · 2π · N
//
// Adding sweep_global to this gives the world angle of that ring's
// leading-edge dot at the current moment.
function _helixComputeRingOffsets(ringCount: number, yMin: number, yMax: number): number[] {
  const ySpan = yMax - yMin;
  const yCenter = (yMin + yMax) * 0.5;
  const out: number[] = [];
  for (let i = 0; i < ringCount; i++) {
    const y = _helixRingY(i, ringCount, yMin, yMax);
    const u = (y - yCenter) / ySpan + 0.5;
    const theta = u * 2 * Math.PI * _HELIX_N_TURNS;
    out.push(theta);
  }
  return out;
}

// ----- Main entry — called by _topoRenderThree once per frame -----

function _topoHelixOverlayDraw(state: any, sim: any, wall: any) {
  if (!state) return;
  if (!_helixLegendBuilt) _helixBuildLegend();
  _helixSyncLegendVisibility();
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
    // Restore the cavity + crystal meshes hidden while the overlay
    // was running — leaving them invisible after toggle-off would
    // leave the topo view empty.
    if (state.cavity) state.cavity.visible = true;
    if (state.crystals) state.crystals.visible = true;
    return;
  }
  if (!sim || !wall || !wall.ring_count) return;

  // Boss v10: "no visible 3d vug, the only indication of the vugg
  // shape is the reading at the wall of the vugg where it intersects
  // with the helicoid at that moment in time." Hide both the cavity
  // mesh and crystal meshes — the white primary wall-distance trail
  // (per-cell, fading 1/4 turn behind the sweep) reveals the cavity
  // shape from radar returns alone.
  if (state.cavity) state.cavity.visible = false;
  if (state.crystals) state.crystals.visible = false;

  const { R, wallRadius, yMin, yMax, ySpan } = _helixGeometry(state, wall);
  const ringCount = wall.ring_count;

  const sig = `${R.toFixed(2)}|${yMin.toFixed(2)}|${yMax.toFixed(2)}|${ringCount}`;
  const sigChanged = state.helixSig !== sig;

  if (sigChanged) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
    }
    const group = new THREE.Group();
    group.name = 'helix-record';
    _helixAddSurface(group, R, yMin, yMax);
    state.scene.add(group);
    state.helixGroup = group;
    state.helixSig = sig;
    _helixClearTrails();
  }

  _helixEnsureTrailInfra(state.scene, ringCount, _HELIX_CHEM_PARAMS.length);

  const ringOffsets = _helixComputeRingOffsets(ringCount, yMin, yMax);
  state.helixContext = { sim, wall, R, wallRadius, yMin, yMax, ySpan, ringCount, ringOffsets };
  _helixStartSpin();
}

// ----- Sub-builders ------------------------------------------------

function _helixAddSurface(group: any, R: number, yMin: number, yMax: number) {
  const NU = 16;
  const NV = Math.max(120, _HELIX_N_TURNS * 120);
  const ySpan = yMax - yMin;
  const yCenter = (yMin + yMax) * 0.5;
  const surfPositions = new Float32Array((NU + 1) * (NV + 1) * 3);
  const surfIndices: number[] = [];
  for (let i = 0; i <= NU; i++) {
    const ri = (i / NU) * R;
    for (let j = 0; j <= NV; j++) {
      const u = j / NV;
      const phi = u * _HELIX_N_TURNS * Math.PI * 2;
      const y = yCenter + (u - 0.5) * ySpan;
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

// 16 rings × ~45 past samples × 2 verts per segment = 1440 verts per
// secondary param. PRIMARY also renders 45 future segments (wall is
// static so we can predict): 16 × (45 past + 45 future) × 2 = 2880
// verts. 4096 budget gives ~40% headroom for primary, plenty for
// secondaries.
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
function _helixUpdateTrails(sim: any, wall: any, R: number, yMin: number, yMax: number, ringCount: number, ringOffsets: number[]) {
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

    // Param toggled off in the legend — collapse its draw range and
    // skip sampling entirely. Trail history is preserved (re-enabling
    // resumes from existing samples on the next frame).
    if (!_helixParamEnabled[p]) {
      lines.geometry.setDrawRange(0, 0);
      continue;
    }

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
      // Primary plots at literal world-mm (traces the actual wall);
      // secondaries normalize their value into [0, R].
      let r: number;
      if (param.primary) {
        r = raw;
      } else {
        const norm = Math.max(0, Math.min(1, (raw - param.min) / (param.max - param.min)));
        r = norm * R;
      }
      const y = _helixRingY(i, ringCount, yMin, yMax);
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

      // Build PAST segments for this ring's trail. Each segment
      // connects two consecutive samples in (world_angle = sweep +
      // offset, y) with per-vertex alpha = 1 − age/fade.
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

      // FUTURE segments — only for primary (wall). The wall is
      // static during a scenario, so we can sample it at angles ahead
      // of the current sweep and render them with the same alpha ramp
      // as the past. Boss v11: "the line that represents the vugg
      // wall distance should fade in both the past as well as the
      // future direction so it stands out a bit more visually. its a
      // known constant, so it makes sense that you could predict
      // where it will be relatively."
      if (param.primary && N > 0) {
        const futureSteps = Math.floor(_HELIX_FADE_ANGLE / _HELIX_SAMPLE_STEP);
        let rPrev = r;  // start from the current value at sweep
        for (let k = 0; k < futureSteps; k++) {
          if (v + 2 > _TRAIL_MAX_VERTS_PER_PARAM) break;
          const futureSweepA = sweep + k * _HELIX_SAMPLE_STEP;
          const futureSweepB = sweep + (k + 1) * _HELIX_SAMPLE_STEP;
          const angleA = futureSweepA + offset;
          const angleB = futureSweepB + offset;
          const futureAgeA = (k * _HELIX_SAMPLE_STEP) / _HELIX_FADE_ANGLE;
          const futureAgeB = ((k + 1) * _HELIX_SAMPLE_STEP) / _HELIX_FADE_ANGLE;
          const aFA = Math.max(0, 1 - futureAgeA);
          const aFB = Math.max(0, 1 - futureAgeB);

          // Cell at future angles — wall geometry is static so this
          // is exact prediction, not extrapolation.
          const wrappedB = ((futureSweepB % TWO_PI) + TWO_PI) % TWO_PI;
          const cellB = Math.floor(wrappedB / (TWO_PI / N)) % N;
          const rawB = param.read(sim, wall, i, cellB);
          const rNext = (typeof rawB === 'number' && !isNaN(rawB)) ? rawB : rPrev;

          posArr[v * 3 + 0] = rPrev * Math.cos(angleA);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rPrev * Math.sin(angleA);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aFA;
          v++;

          posArr[v * 3 + 0] = rNext * Math.cos(angleB);
          posArr[v * 3 + 1] = y;
          posArr[v * 3 + 2] = rNext * Math.sin(angleB);
          colArr[v * 4 + 0] = cr; colArr[v * 4 + 1] = cg;
          colArr[v * 4 + 2] = cb; colArr[v * 4 + 3] = aFB;
          v++;
          rPrev = rNext;
        }
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
      _helixUpdateTrails(c.sim, c.wall, c.R, c.yMin, c.yMax, c.ringCount, c.ringOffsets);
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
  const btn = document.getElementById('helix-overlay-btn');
  if (btn) (btn as HTMLElement).style.color = _helixOverlayEnabled ? '#f0c050' : '';
  _helixSyncLegendVisibility();
  if (typeof topoRender === 'function') topoRender();
}
