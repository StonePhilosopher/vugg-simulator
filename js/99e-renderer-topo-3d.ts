// ============================================================
// js/99e-renderer-topo-3d.ts — 3D ring projection + canvas frame + hit-test
// ============================================================
// _topoRenderRings3D (the cylindrical-band painter), _topoCanvasFrame helper, _hitTest3D + _topoHitTest pointer→cell resolution.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

//     ambiguous when the disc is tilted.
function _topoRenderRings3D(ctx, sim, wall, ring0, cellR, boundaryR,
                             cx, cy, mmToPx, maxT, arcStep, N, viewW, viewH) {
  const F = 1200;  // perspective focal length, matches tier-1's CSS perspective(1200px)
  const ringCount = wall.ring_count;
  // Spherical cavity profile (renderer-only for now — the engine's
  // ring data stays uniform until Phase D distributes crystals by
  // orientation). Each ring k sits at a latitude φ_k around a sphere
  // whose center is the canvas center; its radial-radius scales as
  // sin(φ_k) and its vertical offset as -cos(φ_k)·R. Half-step offsets
  // (k+0.5 instead of k) keep the polar rings small but non-zero so
  // the engine math (cell_arc_mm, paint_crystal) — which still reads
  // ring[0] — doesn't divide by zero. With 16 rings the smallest
  // radius is sin(π/32) ≈ 0.098 (the south-pole "cap" ring) and the
  // largest is sin(15.5π/32) ≈ 0.998 (the equator).
  const cavityDiameterPx = wall.meanDiameterMm() * mmToPx;
  const sphereRadiusPx = cavityDiameterPx / 2;
  // Fallback radius for cells whose base_radius_mm is still 0 (legacy
  // saves predating the irregular-profile init). Was implicitly closed
  // over from the topoRender caller's scope before B12 split this
  // function out — restore it locally now.
  const initR = wall.initial_radius_mm;

  // Per-ring metadata: world-space z, latitude-derived radius factor,
  // θ twist, and the projected z used for painter's-order sorting.
  // For a ring center at (0,0,wz) the post-rotation z is
  // cos(tiltX)·cos(tiltY)·wz; pulling it from _topoProject3D directly
  // keeps it consistent with crystal sort keys (which use the same
  // function on off-axis points).
  const ringMeta = new Array(ringCount);
  for (let r = 0; r < ringCount; r++) {
    // Ring 0 is the south pole (floor), ring N-1 is the north pole
    // (ceiling). φ runs from π/(2N) at ring 0 to π(2N-1)/(2N) at
    // ring N-1 — full latitude sweep with half-step offsets at each
    // end so neither pole collapses to a point. Cross-axis polar
    // factor adds vertical irregularity.
    const phi = Math.PI * (r + 0.5) / ringCount;
    const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
    const ringRadiusFactor = Math.sin(phi) * polar;
    const wz = -Math.cos(phi) * sphereRadiusPx;
    const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0.0;
    const projZ = _topoProject3D(0, 0, wz, _topoTiltX, _topoTiltY, F)[2];
    ringMeta[r] = { ringIdx: r, wz, ringRadiusFactor, twist, projZ };
  }

  // Build the painter's-order item list: rings + crystals interleaved.
  // Rings paint atomically (entire outline in one shot); crystals
  // paint as wireframe primitives anchored to their wall cell. Sort
  // ascending by post-rotation z so far things paint first.
  const paintItems = [];
  for (const meta of ringMeta) {
    paintItems.push({ kind: 'ring', meta, sortZ: meta.projZ });
  }

  // v24 water line. If conditions.fluid_surface_ring is set, the
  // meniscus sits at φ = π·s/ringCount along the polar axis. Build a
  // 64-segment polyline tracing the cavity outline at that latitude,
  // pre-projected to screen, and sort the disc as a single paint item
  // at its centre's projected z. Polar profile + per-cell wall depth
  // are folded in so the water line wobbles with the cavity shape.
  let waterDisc = null;
  if (sim && sim.conditions
      && sim.conditions.fluid_surface_ring != null
      && ringCount > 1) {
    const s = sim.conditions.fluid_surface_ring;
    const sClamped = Math.max(0, Math.min(ringCount, s));
    const phiW = Math.PI * sClamped / ringCount;
    const polarW = wall.polarProfileFactor ? wall.polarProfileFactor(phiW) : 1.0;
    const rrfW = Math.sin(phiW) * polarW;
    const wzW = -Math.cos(phiW) * sphereRadiusPx;
    const twistW = wall.ringTwistRadians ? wall.ringTwistRadians(phiW) : 0.0;
    // Sample N_W points around θ. Use the same per-cell base_radius
    // ring0 carries — without per-ring radius variation in the engine
    // this is the best the renderer has for "what shape is the cavity
    // at this height". Wall_depth on ring0 also folds in.
    const N_W = 64;
    const pts = new Array(N_W);
    for (let j = 0; j < N_W; j++) {
      const theta = (2 * Math.PI * j) / N_W + twistW;
      // Sample ring0's per-cell radius at the matching θ index.
      const cellIdx = Math.floor((j / N_W) * N) % N;
      const cell = ring0[cellIdx];
      const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
      const rPx = (baseR + cell.wall_depth) * mmToPx * rrfW;
      const wx = rPx * Math.cos(theta);
      const wy = rPx * Math.sin(theta);
      pts[j] = [wx, wy, wzW];
    }
    const projZW = _topoProject3D(0, 0, wzW, _topoTiltX, _topoTiltY, F)[2];
    waterDisc = { points: pts, sortZ: projZW };
    paintItems.push({ kind: 'water', disc: waterDisc, sortZ: projZW });
  }
  if (sim && sim.crystals) {
    for (const crystal of sim.crystals) {
      if (crystal.dissolved) continue;
      const ringIdx = crystal.wall_ring_index;
      const cellIdx = crystal.wall_center_cell;
      if (ringIdx == null || cellIdx == null) continue;
      const meta = ringMeta[ringIdx];
      if (!meta) continue;
      const ring = wall.rings[ringIdx];
      if (!ring || !ring.length) continue;
      const aMid = _topoAngleFor(cellIdx, N) + meta.twist;
      const rrf = meta.ringRadiusFactor;
      const cellMidR = cellR[cellIdx] * rrf;
      const cellWx = cellMidR * Math.cos(aMid);
      const cellWy = cellMidR * Math.sin(aMid);
      const cellWz = meta.wz;
      const projected = _topoProject3D(cellWx, cellWy, cellWz,
                                        _topoTiltX, _topoTiltY, F);
      paintItems.push({
        kind: 'crystal',
        crystal,
        cellWorld: [cellWx, cellWy, cellWz],
        sortZ: projected[2],
      });
    }
  }
  paintItems.sort((a, b) => {
    if (a.sortZ !== b.sortZ) return a.sortZ - b.sortZ;
    if (a.kind !== b.kind) return a.kind === 'ring' ? -1 : 1;
    if (a.kind === 'ring') return a.meta.ringIdx - b.meta.ringIdx;
    // Tie-break crystals by id so pseudomorphs / overgrowths (later
    // crystal_id) paint on top of their host — typically correct since
    // overgrowths are later in paragenesis.
    return (a.crystal.crystal_id | 0) - (b.crystal.crystal_id | 0);
  });

  // Project a (canvasX, canvasY) point at this ring's height to screen.
  function projAt(wz) {
    return (canvasX, canvasY) => {
      const wx = canvasX - cx;
      const wy = canvasY - cy;
      const [px, py] = _topoProject3D(wx, wy, wz, _topoTiltX, _topoTiltY, F);
      return [cx + px, cy + py];
    };
  }

  // Render one ring's wall outline. Replaces the wedge-fill block from
  // pre-wireframe versions — wedges are now wireframe primitives drawn
  // as separate paint items above. The wall stroke still varies width
  // by crystal thickness so a heavily-grown ring reads as "encrusted"
  // through line weight alone.
  function renderRingOutline(meta) {
    const { ringIdx, wz, ringRadiusFactor, twist } = meta;
    const ring = wall.rings[ringIdx];
    if (!ring || !ring.length) return;
    const proj = projAt(wz);
    const rrf = ringRadiusFactor;
    const ringTwist = twist || 0;
    const orient = wall.ringOrientation(ringIdx);
    let bareWallColor = TOPO_WALL_COLOR;
    if (orient === 'floor') bareWallColor = TOPO_WALL_COLOR_FLOOR;
    else if (orient === 'ceiling') bareWallColor = TOPO_WALL_COLOR_CEILING;
    // v24: ring is submerged below the meniscus → after stroking the
    // canonical wall colour for each cell, re-stroke the same path with
    // a thin translucent blue companion line. Reads at-a-glance as
    // "this ring is underwater". Meniscus + vadose rings get no extra
    // line; the meniscus disc itself communicates the surface and the
    // dry rings keep their canonical orange.
    const wstate = (sim && sim.conditions && sim.conditions.ringWaterState)
      ? sim.conditions.ringWaterState(ringIdx, ringCount)
      : 'submerged';
    const isSubmerged = wstate === 'submerged'
      && sim && sim.conditions && sim.conditions.fluid_surface_ring != null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < N; i++) {
      const a0 = _topoAngleFor(i, N) - arcStep / 2 + ringTwist;
      const aMid = _topoAngleFor(i, N) + ringTwist;
      const a1 = a0 + arcStep;
      const rStart = boundaryR[i] * rrf;
      const rMid = cellR[i] * rrf;
      const rEnd = boundaryR[(i + 1) % N] * rrf;
      const cell = ring[i];
      let stroke, width, alpha;
      if (cell.crystal_id == null) {
        stroke = bareWallColor;
        width = TOPO_WALL_STROKE_PX;
        alpha = 1;
      } else {
        stroke = topoClassColor(cell.mineral);
        const t = Math.min(cell.thickness_um / maxT, 1);
        width = TOPO_WALL_STROKE_PX + t * (TOPO_WALL_STROKE_MAX_PX - TOPO_WALL_STROKE_PX);
        alpha = topoAlphaFor(cell.mineral);
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      const sxW = cx + rStart * Math.cos(a0), syW = cy + rStart * Math.sin(a0);
      const mxW = cx + rMid * Math.cos(aMid), myW = cy + rMid * Math.sin(aMid);
      const exW = cx + rEnd * Math.cos(a1),  eyW = cy + rEnd * Math.sin(a1);
      const [psx, psy] = proj(sxW, syW);
      const [pmx, pmy] = proj(mxW, myW);
      const [pex, pey] = proj(exW, eyW);
      const cpX = 2 * pmx - (psx + pex) / 2;
      const cpY = 2 * pmy - (psy + pey) / 2;
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.quadraticCurveTo(cpX, cpY, pex, pey);
      ctx.stroke();
      if (isSubmerged) {
        // Re-stroke the same path with a thin blue companion line.
        // Lower alpha + lineCap=butt so it reads as a tint along the
        // wall colour, not a competing outline. Width capped at the
        // base wall stroke so heavily-encrusted cells (very thick
        // wall colour) don't drown out the underwater cue.
        const prevCap = ctx.lineCap;
        ctx.lineCap = 'butt';
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = 'rgba(110, 190, 245, 1.0)';
        ctx.lineWidth = Math.min(width, TOPO_WALL_STROKE_PX) * 0.55;
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.lineCap = prevCap;
      }
    }
    ctx.globalAlpha = 1;
  }

  // v24: render the meniscus disc — translucent blue fill with a
  // brighter outline, projected through the same camera transform as
  // rings/crystals. Painter's order puts the disc at its meniscus
  // latitude's z, so back-half occluded by far rings/crystals and
  // front-half occludes near rings/crystals. Imperfect for objects
  // straddling the disc's z (single sortZ for the whole disc), but
  // reads correctly at typical tilt angles.
  function renderWaterDisc(disc) {
    const proj = projAt(0); // wz baked into points already
    const screen = disc.points.map(([wx, wy, wz]) => {
      const [px, py] = _topoProject3D(wx, wy, wz, _topoTiltX, _topoTiltY, F);
      return [cx + px, cy + py];
    });
    if (!screen.length) return;
    ctx.beginPath();
    ctx.moveTo(screen[0][0], screen[0][1]);
    for (let j = 1; j < screen.length; j++) {
      ctx.lineTo(screen[j][0], screen[j][1]);
    }
    ctx.closePath();
    ctx.save();
    ctx.fillStyle = 'rgba(86, 170, 240, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  for (const item of paintItems) {
    if (item.kind === 'ring') renderRingOutline(item.meta);
    else if (item.kind === 'water') renderWaterDisc(item.disc);
    else _renderCrystalWireframe(ctx, item.crystal, item.cellWorld,
                                  sphereRadiusPx, mmToPx, cx, cy, F);
  }

  // Vug size readout — same HTML overlay as 2D mode.
  const sizeLabel = document.getElementById('topo-vug-size');
  if (sizeLabel) {
    sizeLabel.textContent = `Vug ⌀ ${wall.meanDiameterMm().toFixed(1)} mm × ${ringCount} rings`;
  }
}

// Hit-test: resolve (mouseX, mouseY) on the canvas into a mineral
// under the cursor. Returns { mineral, isInclusion, cell } or null
// if the cursor is not on a crystal. Called by both the tooltip and
// the highlight hover/click handlers so their geometry stays in sync.
// Reconstruct the (mmToPx, cx, cy) the renderer is using for the
// current canvas + zoom + pan state. Used by both 2D and 3D hit-test
// paths so cursor coords map to the same world the user sees.
function _topoCanvasFrame(rect, wall, ring0) {
  const cssW = rect.width, cssH = rect.height;
  const initR = wall.initial_radius_mm;
  let maxWallR = wall.max_seen_radius_mm || initR * 2;
  for (const c of ring0) {
    const baseR = c.base_radius_mm > 0 ? c.base_radius_mm : initR;
    const r = baseR + c.wall_depth;
    if (r > maxWallR) maxWallR = r;
  }
  const centerPad = 48;
  const viewW = cssW / TOPO_STAGE_SCALE;
  const viewH = cssH / TOPO_STAGE_SCALE;
  const fit = Math.min(viewW, viewH - centerPad) * 0.82 / 2;
  const mmToPx = (fit / maxWallR) * _topoZoom;
  const cx = cssW / 2 + _topoPanX;
  const cy = (cssH - centerPad) / 2 + 8 + _topoPanY;
  return { cssW, cssH, mmToPx, cx, cy, initR, maxWallR };
}

// 3D hit-test. The cavity surface is NOT a true sphere — each ring
// has its own latitude-dependent radius factor (sin(φ)·polar_profile)
// and per-cell base_radius wobble, so it's a stretched-and-bumped
// sphere. Ray-vs-sphere math gives wrong answers when polar pinches
// pull cells far inside the mean sphere.
//
// Brute-force approach: forward-project every cell's anchor center
// to screen, find the cell whose projection is nearest to the cursor.
// This is naturally correct for the bumpy surface AND handles the
// wireframe-occlusion case (both front and back hemispheres visible)
// without explicit hemisphere math — the nearest-projection cell is
// the one the user is hovering over.
//
// Cost: 1 projection + 1 distance² per cell × 16 rings × 120 cells =
// ~2k operations per hit-test. Negligible at hover-event frequency.
//
// Returns { mineral, isInclusion, cell, ringIdx, cellIdx } or null
// (cursor too far from any cell). Crystal-on-cell follows the same
// engine semantic as 2D mode: a cell's crystal_id is the occupant;
// null means bare wall.
function _hitTest3D(ev, sim, rect) {
  const wall = sim.wall_state;
  if (!wall || !wall.rings || wall.rings.length < 2) return null;
  const ringCount = wall.ring_count;
  const ring0 = wall.rings[0];
  const N = ring0.length;
  const F = 1200;  // matches _topoRenderRings3D
  const { mmToPx, cx, cy, initR } = _topoCanvasFrame(rect, wall, ring0);
  const sphereRadiusPx = wall.meanDiameterMm() * mmToPx / 2;

  // Cursor in canvas-relative coords (matches what _topoProject3D's
  // output adds cx/cy back to).
  const ux = (ev.clientX - rect.left) - cx;
  const uy = (ev.clientY - rect.top) - cy;

  // Walk every cell, project its anchor, track the nearest in screen
  // space. Two candidates kept: the absolute nearest, AND the nearest
  // crystal-bearing cell (so a wireframe crystal sitting near a bare
  // cell's projected center wins on user-intent grounds — they almost
  // certainly meant to hover the visible crystal, not its bare-wall
  // neighbor).
  let bestAny = null, bestAnyD2 = Infinity;
  let bestCrystal = null, bestCrystalD2 = Infinity;
  for (let r = 0; r < ringCount; r++) {
    const phi = Math.PI * (r + 0.5) / ringCount;
    const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
    const rrf = Math.sin(phi) * polar;
    const wz = -Math.cos(phi) * sphereRadiusPx;
    const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0;
    const ring = wall.rings[r];
    if (!ring || !ring.length) continue;
    for (let i = 0; i < N; i++) {
      const c = ring[i];
      const baseR = c.base_radius_mm > 0 ? c.base_radius_mm : initR;
      const cellOuter = (baseR + c.wall_depth) * mmToPx;
      const aMid = -Math.PI / 2 + (i / N) * 2 * Math.PI + twist;
      const wx = cellOuter * rrf * Math.cos(aMid);
      const wy = cellOuter * rrf * Math.sin(aMid);
      const p = _topoProject3D(wx, wy, wz, _topoTiltX, _topoTiltY, F);
      const dx = ux - p[0], dy = uy - p[1];
      const d2 = dx * dx + dy * dy;
      if (d2 < bestAnyD2) {
        bestAnyD2 = d2; bestAny = { ringIdx: r, cellIdx: i, cell: c };
      }
      if (c.crystal_id != null && d2 < bestCrystalD2) {
        bestCrystalD2 = d2; bestCrystal = { ringIdx: r, cellIdx: i, cell: c };
      }
    }
  }
  if (!bestAny) return null;

  // User-intent rule: if a crystal-bearing cell is reasonably close to
  // the cursor (within 14 px, ~2 cells worth of arc at typical scale),
  // prefer it over an even-closer bare-wall cell. Otherwise the bare
  // wall wins. The threshold is small enough that the user has to be
  // visually on a crystal silhouette for this to fire.
  const CRYSTAL_PREFERENCE_PX = 14;
  if (bestCrystal && bestCrystalD2 <= CRYSTAL_PREFERENCE_PX * CRYSTAL_PREFERENCE_PX) {
    const { ringIdx, cellIdx, cell } = bestCrystal;
    return { mineral: cell.mineral, isInclusion: false, cell, ringIdx, cellIdx };
  }
  const { ringIdx, cellIdx, cell } = bestAny;
  if (cell.crystal_id == null) {
    return { mineral: null, isInclusion: false, cell, ringIdx, cellIdx };
  }
  return { mineral: cell.mineral, isInclusion: false, cell, ringIdx, cellIdx };
}

function _topoHitTest(ev) {
  const canvas = document.getElementById('topo-canvas');
  const sim = topoActiveSim();
  if (!canvas || !sim) return null;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;

  // Inclusion hit-test first — dots take priority over host wall cell.
  // Inclusions are 2D-rendered only (see _topoInclusions populate path);
  // in 3D mode the array stays empty, so the loop is a no-op.
  for (const inc of _topoInclusions) {
    const dx = mx - inc.x, dy = my - inc.y;
    if (dx * dx + dy * dy <= inc.r * inc.r) {
      if (inc.mineral) return { mineral: inc.mineral, isInclusion: true };
      const crystal = sim.crystals.find(c => c.crystal_id === inc.crystal_id);
      if (crystal) return { mineral: crystal.mineral, isInclusion: true };
    }
  }

  // Phase E4: when the Three.js renderer is the active path, hit-test
  // against the actual scene meshes via the WebGL raycaster — gives
  // us pixel-accurate per-crystal hits across any orbit angle, free
  // of the inverse-projection math the canvas-vector path needs.
  if (typeof _topoUseThreeRenderer !== 'undefined' && _topoUseThreeRenderer
      && typeof _topoHitTestThree === 'function') {
    return _topoHitTestThree(ev);
  }

  // 3D mode: ray-cast against the cavity sphere instead of inverting
  // the 2D polar transform (which ignores tilt + per-ring twist).
  if (_topoView3D && sim.wall_state && sim.wall_state.rings &&
      sim.wall_state.rings.length > 1) {
    return _hitTest3D(ev, sim, rect);
  }

  // 2D path: hit-test reads whatever ring the renderer is currently
  // showing. Aggregate (post-scatter default) → resolves any crystal
  // on any ring at the cursor's angular position. Single-slice mode →
  // resolves only crystals on that specific ring.
  const ring0 = _topoActiveRingForRender(sim.wall_state);
  if (!ring0 || !ring0.length) return null;
  const { mmToPx, cx, cy, initR } = _topoCanvasFrame(rect, sim.wall_state, ring0);
  const N = ring0.length;
  const dx = mx - cx, dy = my - cy;
  const rMouse = Math.hypot(dx, dy);
  let a = Math.atan2(dy, dx) + Math.PI / 2;
  while (a < 0) a += 2 * Math.PI;
  while (a >= 2 * Math.PI) a -= 2 * Math.PI;
  const idx = Math.min(N - 1, Math.max(0, Math.round((a / (2 * Math.PI)) * N) % N));
  const cell = ring0[idx];
  const baseR = cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
  const cellOuterPx = (baseR + cell.wall_depth) * mmToPx;
  if (rMouse > cellOuterPx + 10 || rMouse < cellOuterPx * 0.15) return null;
  if (cell.crystal_id == null) return { mineral: null, isInclusion: false, cell };
  return { mineral: cell.mineral, isInclusion: false, cell };
}

// Hover: shared 2D + 3D path. _topoHitTest already resolves the cursor
// to either an inclusion, a wall cell on the cavity sphere (3D), or a
// wall cell via 2D polar inversion (2D). We just turn its result into
// tooltip HTML — no duplicated geometry math here. Inclusion hits get
// the "◆ inside host" framing; wall hits get the standard mineral /
// habit / size readout.
