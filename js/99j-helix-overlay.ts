// ============================================================
// js/99j-helix-overlay.ts — Helix Record overlay for the 3D vug
// ============================================================
// Boss picture: "picture one ring, but it's a helicoid, it spins
// through the vugg. this is kind of like layering record mode over
// the 3D vug." So this module takes the existing groove-mode record
// concept (per-crystal growth history, one entry per zone) and lifts
// it into a 3D helicoid threaded through the cavity in the topo
// Three.js scene.
//
// v0 behavior:
//   - picks the largest crystal in the active sim (by c_length_mm)
//   - draws a helix curve at radius = 70% of cavity max
//   - one bead per zone along the helix, color = temperature
//     (blue cold → red hot), size = sqrt(|thickness_um|), red for
//     dissolution zones (negative thickness)
//   - hooks into _topoRenderThree right before the final render call
//
// Scope intentionally narrow — no 6-lane ribbon yet, no per-crystal
// switching UI yet. Once the boss confirms the geometric picture,
// v1 adds the Rainbow Mellan 6-lane ribbon (Temperature / growth /
// Fe / Mn / Al / Ti, same as 98-ui-groove.ts) and a crystal-picker.
//
// Bundle integration: SCRIPT-mode TS, top-level decls become globals.
// Numeric prefix 99j puts this after 99i (the renderer's _topoInitThree
// + _topoRenderThree). _topoHelixOverlayDraw is called by hand-edited
// line in 99i — see the "HELIX OVERLAY" marker there.

let _helixOverlayEnabled = true;   // v0 default ON; UI toggle lands later
const _HELIX_N_TURNS = 3;

// Dispose every geometry and material owned by a Three.Group / mesh so
// GPU memory doesn't leak when we rebuild the overlay. Three.js does
// NOT auto-dispose on remove(), only on explicit .dispose() calls.
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

// Pick the crystal whose growth record we display. v0: largest by
// c_length_mm with a non-empty zones array. Deterministic given a sim,
// stable across frames (so we don't rebuild the overlay every tick).
function _helixPickCrystal(sim: any): any {
  if (!sim || !sim.crystals) return null;
  let best: any = null;
  for (const c of sim.crystals) {
    if (!c || !c.zones || !c.zones.length) continue;
    if (!best || (c.c_length_mm || 0) > (best.c_length_mm || 0)) best = c;
  }
  return best;
}

// Compute helix radius + axial span from the cavity dimensions.
//
// Per boss model: the outer edge of the helicoid IS the vugg wall for
// physically-grounded parameters (e.g., distance-from-center). So R
// matches max_seen_radius_mm — not a fraction of it. And the vertical
// span matches the full vugg diameter so "Y on helicoid = Y in vugg"
// holds literally.
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

// Main entry — called by _topoRenderThree once per frame. Cheap when
// nothing changed (signature compare short-circuits rebuild).
function _topoHelixOverlayDraw(state: any, sim: any, wall: any) {
  if (!state) return;

  // Disabled → tear down any existing overlay and stop.
  if (!_helixOverlayEnabled) {
    if (state.helixGroup) {
      state.scene.remove(state.helixGroup);
      _helixDisposeGroup(state.helixGroup);
      state.helixGroup = null;
      state.helixSig = '';
    }
    return;
  }

  const crystal = _helixPickCrystal(sim);
  if (!crystal) return;
  const zones = crystal.zones;
  if (zones.length < 2) return;

  // Signature: rebuild only when the displayed crystal or its zone
  // count changes. Mineral name guards against the "two crystals same
  // id across mode switches" edge case.
  const sig = `${crystal.mineral}|${crystal.crystal_id}|${zones.length}`;
  if (state.helixGroup && state.helixSig === sig) return;

  if (state.helixGroup) {
    state.scene.remove(state.helixGroup);
    _helixDisposeGroup(state.helixGroup);
  }

  const { R, ySpan } = _helixGeometry(wall);

  const group = new THREE.Group();
  group.name = 'helix-record';

  // Helicoid surface — boss redefinition: not just an edge curve but
  // the actual 2D ruled surface around the central axis. Radial
  // parameter sweeps from r=0 (the cavity's vertical axis) out to R
  // (the outer-edge curve drawn below). Angular parameter traces the
  // same spiral as the curve. The surface looks like a spiral ramp /
  // screw thread inside the cavity.
  //
  // NU radial × NV angular vertices. NV scales with turn count so a
  // long helix doesn't get blocky. DoubleSide so the surface is
  // visible from above and below; depthWrite: false to avoid biasing
  // the transparency sort against the cavity wall behind it.
  {
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
        // Two triangles per quad.
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
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const surfMesh = new THREE.Mesh(surfGeom, surfMat);
    group.add(surfMesh);
  }

  // Outer-edge curve — finely sampled so the helix reads as smooth even
  // at sparse zone counts. Sits on the r=R boundary of the helicoid
  // surface above; the brighter line defines the edge clearly.
  const SAMPLES = Math.max(120, Math.min(800, zones.length * 6));
  const pts: any[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    const phi = u * _HELIX_N_TURNS * Math.PI * 2;
    const y = (u - 0.5) * ySpan;
    pts.push(new THREE.Vector3(R * Math.cos(phi), y, R * Math.sin(phi)));
  }
  const curveGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const curveMat = new THREE.LineBasicMaterial({ color: 0xf0d5a0, transparent: true, opacity: 0.45 });
  group.add(new THREE.Line(curveGeom, curveMat));

  // Per-zone bead — color = temperature, size = sqrt(|thickness_um|).
  const temps: number[] = [];
  const thicks: number[] = [];
  for (const z of zones) {
    if (typeof z.temperature === 'number') temps.push(z.temperature);
    thicks.push(Math.abs(z.thickness_um || 0));
  }
  const tmin = temps.length ? Math.min.apply(null, temps) : 100;
  const tmax = temps.length ? Math.max.apply(null, temps) : 200;
  const trange = Math.max(tmax - tmin, 1);
  const wmax = Math.max(1, Math.max.apply(null, thicks));

  // Min/max bead radius in cavity-mm units. Tuned so a 50mm pocket vug
  // gets visible-but-not-clobbering beads. Helix radius R is ~17mm in
  // that case, so 0.25-1.4mm beads look right.
  const BEAD_MIN = Math.max(0.2, R * 0.012);
  const BEAD_MAX = Math.max(BEAD_MIN * 3, R * 0.085);

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const u = i / Math.max(zones.length - 1, 1);
    const phi = u * _HELIX_N_TURNS * Math.PI * 2;
    const y = (u - 0.5) * ySpan;
    const sx = R * Math.cos(phi);
    const sz = R * Math.sin(phi);

    const tempNorm = (typeof z.temperature === 'number')
      ? (z.temperature - tmin) / trange
      : 0.5;
    const hue = (1 - tempNorm) * 240 / 360;  // 240° (blue) cold → 0° (red) hot

    const isDissolution = (z.thickness_um || 0) < 0;
    const sizeNorm = Math.sqrt(Math.abs(z.thickness_um || 0) / wmax);
    const rBead = BEAD_MIN + sizeNorm * (BEAD_MAX - BEAD_MIN);

    const color = new THREE.Color();
    if (isDissolution) color.setHex(0xcc4444);
    else color.setHSL(hue, 0.7, 0.55);
    const emissive = color.clone().multiplyScalar(0.25);

    const beadGeom = new THREE.SphereGeometry(rBead, 10, 7);
    const beadMat = new THREE.MeshStandardMaterial({
      color, emissive, roughness: 0.55, metalness: 0.1,
    });
    const bead = new THREE.Mesh(beadGeom, beadMat);
    bead.position.set(sx, y, sz);
    bead.userData.zoneIndex = i;
    bead.userData.zone = z;
    group.add(bead);
  }

  state.scene.add(group);
  state.helixGroup = group;
  state.helixSig = sig;

  // Carry over the in-flight rotation so a rebuild (crystal change,
  // zone-count tick) doesn't snap the helix back to angle 0.
  if (typeof _helixRotationY === 'number') group.rotation.y = _helixRotationY;
  _helixStartSpin();
}

// =========== SPINNING ==========================================
// Boss model: θ = time, advanced by spinning. The helicoid rotates
// rigidly around the central (Y) axis; data inscriptions ride with it.
//
// v2 implements the rotation only. The data the helicoid carries
// (per-tick chemistry traces at literal vugg heights, crystal plotter
// points) lands in v3 — until then the existing per-zone outer-edge
// beads ride along as visible eye-candy. They're geometrically wrong
// per the boss model (one crystal's zones spread across Y instead of
// living at the crystal's actual height); flagged for replacement.

let _helixSpinRAF: number | null = null;
let _helixSpinPrevTime = 0;
let _helixRotationY = 0;
const _HELIX_RPM = 6;  // 6 revolutions per minute → 36°/sec — visible
                       // but not dizzying. Single tunable for now.

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
  // Only spin when the WebGL canvas is actually visible — pauses the
  // RAF cost on the title screen, in Creative mode, etc. Checks the
  // canvas's offsetParent (null when display:none anywhere in the
  // ancestor chain).
  const c3 = document.getElementById('topo-canvas-three') as HTMLCanvasElement | null;
  const visible = c3 && c3.offsetParent != null && c3.style.display !== 'none';
  if (visible) {
    const dt = Math.max(0, Math.min(0.1, (now - _helixSpinPrevTime) / 1000));
    const omega = (_HELIX_RPM / 60) * 2 * Math.PI;  // rad/sec
    _helixRotationY = (_helixRotationY + dt * omega) % (Math.PI * 2);
    state.helixGroup.rotation.y = _helixRotationY;
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  }
  _helixSpinPrevTime = now;
  _helixSpinRAF = requestAnimationFrame(_helixSpinTick);
}

// Toggle handler — surfaced to the eventual UI button. Forces a rebuild
// on next render by clearing the cached signature.
function helixOverlayToggle() {
  _helixOverlayEnabled = !_helixOverlayEnabled;
  // Force the next _topoRenderThree to actually run helix logic even
  // if the sim didn't change.
  if (typeof topoRender === 'function') topoRender();
}
