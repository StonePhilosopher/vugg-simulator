// ============================================================
// js/98-ui-groove.ts — UI — Record Groove mode (the turntable)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// RECORD GROOVE MODE — The Turntable
// ============================================================

let grooveCrystal = null;
let groovePlaying = false;
let grooveAnimFrame = null;
let grooveProgress = 0; // 0..1 (fraction of zones drawn)
let grooveSpeed = 8; // zones per second
let grooveDensity = 10; // steps per revolution
let grooveAmplitude = 40; // max wobble in px
let grooveLastTime = 0;
let groovePoints = []; // precomputed [{x,y,zone,angle,radius}]

// Parameter axes — evenly spaced around 360°
const GROOVE_AXES = [
  { name: 'Temperature', key: 'temperature', color: '#ff8844' },
  { name: 'Growth rate', key: 'thickness_um', color: '#50e0c0' },
  { name: 'Fe', key: 'trace_Fe', color: '#cc6644' },
  { name: 'Mn', key: 'trace_Mn', color: '#ffaa44' },
  { name: 'Al', key: 'trace_Al', color: '#8888cc' },
  { name: 'Ti', key: 'trace_Ti', color: '#88cc88' },
];

// Loaded-from-collection stand-ins, set by playCollectedInGroove. Takes
// priority over live sims when present so the user actually sees the
// crystal they asked for.
let grooveCollectionCrystals = null;

function grooveGetAvailableCrystals() {
  // Collection-loaded crystals take priority — user explicitly requested them.
  if (grooveCollectionCrystals && grooveCollectionCrystals.length) {
    return { crystals: grooveCollectionCrystals, source: 'Library' };
  }
  // Otherwise prefer idle (Zen Mode), then fortress, then legends, then random.
  if (idleSim && idleSim.crystals && idleSim.crystals.length) {
    return { sim: idleSim, crystals: idleSim.crystals, source: 'Zen' };
  }
  if (fortressSim && fortressSim.crystals && fortressSim.crystals.length) {
    return { sim: fortressSim, crystals: fortressSim.crystals, source: 'Creative' };
  }
  if (legendsSim && legendsSim.crystals && legendsSim.crystals.length) {
    return { sim: legendsSim, crystals: legendsSim.crystals, source: 'Simulation' };
  }
  if (randomSim && randomSim.crystals && randomSim.crystals.length) {
    return { sim: randomSim, crystals: randomSim.crystals, source: 'Random Vugg' };
  }
  return null;
}

// Called by the ▶ Play button on each Library collected row.
// Stashes the reconstructed stand-in, switches to Groove, and selects it.
function playCollectedInGroove(id) {
  const rec = loadCrystals().find(c => c.id === id);
  if (!rec) { alert('Collected crystal not found.'); return; }
  if (!rec.zones || !rec.zones.length) {
    alert('This specimen was collected before zone data was saved, so the Record Player has nothing to spiral. Collect a fresh one to play it.');
    return;
  }
  const stand = reconstructCrystalFromRecord(rec);
  stand._libraryName = rec.name;
  grooveCollectionCrystals = [stand];
  grooveCrystal = stand;
  switchMode('groove');
}

// When leaving Groove, drop the collection pointer so live sims show up
// again next time. Called from switchMode.
function clearGrooveCollection() {
  grooveCollectionCrystals = null;
}

function groovePopulateCrystals() {
  const select = document.getElementById('groove-crystal-select');
  const noData = document.getElementById('groove-no-data');
  const canvas = document.getElementById('groove-canvas');
  const info = document.getElementById('groove-crystal-info');

  select.innerHTML = '';
  const data = grooveGetAvailableCrystals();

  if (!data) {
    select.innerHTML = '<option value="">— no crystals —</option>';
    noData.style.display = 'block';
    canvas.style.display = 'none';
    info.style.display = 'none';
    return;
  }

  for (let i = 0; i < data.crystals.length; i++) {
    const c = data.crystals[i];
    const opt = document.createElement('option');
    opt.value = String(i);
    let label = `${capitalize(c.mineral)} #${c.crystal_id} — ${c.c_length_mm.toFixed(1)}mm, ${c.zones.length} zones`;
    if (c.twinned) label += ' ⟁';
    opt.textContent = label;
    select.appendChild(opt);
  }

  // Auto-select first or the one we came from modal with
  if (grooveCrystal && data.crystals.includes(grooveCrystal)) {
    select.value = data.crystals.indexOf(grooveCrystal);
  } else {
    select.value = 0;
  }
  grooveSelectCrystal();
}

function grooveSelectCrystal() {
  const select = document.getElementById('groove-crystal-select');
  const noData = document.getElementById('groove-no-data');
  const canvas = document.getElementById('groove-canvas');
  const info = document.getElementById('groove-crystal-info');
  const data = grooveGetAvailableCrystals();

  if (!data || select.value === '') {
    noData.style.display = 'block';
    canvas.style.display = 'none';
    info.style.display = 'none';
    return;
  }

  const idx = parseInt(select.value);
  grooveCrystal = data.crystals[idx];
  noData.style.display = 'none';
  canvas.style.display = 'block';

  // Show crystal info
  info.style.display = 'block';
  const libraryName = grooveCrystal._libraryName
    ? `<span class="gci-mineral">“${grooveCrystal._libraryName}”</span><br>`
    : '';
  let infoHtml = libraryName + `<span class="gci-mineral">${grooveCrystal.mineral} #${grooveCrystal.crystal_id}</span>`;
  infoHtml += ` — ${grooveCrystal.describe_morphology()}`;
  infoHtml += `<br>${grooveCrystal.zones.length} growth zones, nucleated step ${grooveCrystal.nucleation_step} at ${grooveCrystal.nucleation_temp.toFixed(0)}°C`;
  if (grooveCrystal.twinned) infoHtml += `<br><span style="color:#bb66ee">⟁ ${grooveCrystal.twin_law}</span>`;
  infoHtml += `<br>Fluorescence: ${grooveCrystal.predict_fluorescence()}`;
  infoHtml += `<br><span style="color:#5a4a30;font-size:0.65rem">Source: ${data.source}${data.source === 'Library' ? ' collection' : ' mode'}</span>`;
  info.innerHTML = infoHtml;

  // Reset playback
  grooveStop();
  grooveProgress = 0;
  grooveComputePoints();
  grooveDraw();
}

function grooveComputePoints() {
  groovePoints = [];
  if (!grooveCrystal || !grooveCrystal.zones.length) return;

  const zones = grooveCrystal.zones;
  const n = zones.length;

  // Compute normalization ranges
  const temps = zones.map(z => z.temperature);
  const thicks = zones.map(z => Math.abs(z.thickness_um));
  const fes = zones.map(z => z.trace_Fe);
  const mns = zones.map(z => z.trace_Mn);
  const als = zones.map(z => z.trace_Al);
  const tis = zones.map(z => z.trace_Ti);

  const norm = (arr) => {
    const mn = Math.min(...arr);
    const mx = Math.max(...arr);
    const range = mx - mn || 1;
    return arr.map(v => (v - mn) / range);
  };

  const nTemp = norm(temps);
  const nThick = norm(thicks);
  const nFe = norm(fes);
  const nMn = norm(mns);
  const nAl = norm(als);
  const nTi = norm(tis);

  const cx = 320, cy = 320;
  const maxRadius = 280;
  const minRadius = 30;
  const stepsPerRev = grooveDensity;

  for (let i = 0; i < n; i++) {
    const z = zones[i];
    const t = i / Math.max(n - 1, 1); // 0..1 through the crystal
    const baseRadius = minRadius + t * (maxRadius - minRadius);
    const angle = (i / stepsPerRev) * Math.PI * 2;

    // Compute wobble: each parameter modulates radius independently
    // based on which "sector" of the spiral we're in (angle mod axes)
    const nAxes = GROOVE_AXES.length;
    const vals = [nTemp[i], nThick[i], nFe[i], nMn[i], nAl[i], nTi[i]];

    // Method: composite wobble from all parameters
    // Each axis contributes a sine wave at its own frequency,
    // amplitude proportional to that parameter's normalized value.
    // This creates a complex waveform — the "sound" of the crystal.
    let wobbleR = 0;
    for (let a = 0; a < nAxes; a++) {
      // Each axis oscillates at a different frequency along the spiral
      const freq = a + 1; // frequencies 1,2,3,4,5,6
      const phase = (a / nAxes) * Math.PI * 2;
      // Deviation from 0.5 (center) — amplifies CHANGE, not absolute value
      const deviation = (vals[a] - 0.5) * 2; // range -1 to 1
      wobbleR += deviation * Math.sin(angle * freq + phase) * grooveAmplitude * 0.4;
    }
    const wobbleX = wobbleR * Math.cos(angle + Math.PI / 2);
    const wobbleY = wobbleR * Math.sin(angle + Math.PI / 2);

    // Dissolution zones dip inward
    let dissolutionDip = 0;
    if (z.thickness_um < 0) {
      dissolutionDip = -Math.min(Math.abs(z.thickness_um) * 0.5, grooveAmplitude * 0.8);
    }

    const r = baseRadius + dissolutionDip;
    const x = cx + (r * Math.cos(angle)) + wobbleX;
    const y = cy + (r * Math.sin(angle)) + wobbleY;

    groovePoints.push({
      x, y, zone: z, index: i, angle, radius: r,
      baseRadius, t,
      vals,
      isDissolution: z.thickness_um < 0,
      isPhantom: z.is_phantom,
      hasInclusion: z.fluid_inclusion,
      isTwin: !!(z.note && z.note.toLowerCase().includes('twin')),
    });
  }
}

function grooveDraw() {
  const canvas = document.getElementById('groove-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Clear
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, w, h);

  if (!groovePoints.length) return;

  const drawUpTo = Math.max(1, Math.floor(grooveProgress * groovePoints.length));

  // Draw axis guides (faint)
  const cx = 320, cy = 320;
  ctx.globalAlpha = 0.08;
  for (let a = 0; a < GROOVE_AXES.length; a++) {
    const axisAngle = (a / GROOVE_AXES.length) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 300 * Math.cos(axisAngle), cy + 300 * Math.sin(axisAngle));
    ctx.strokeStyle = GROOVE_AXES[a].color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Draw the groove — Rainbow Mellan: six parallel lanes running side by side
  // along the spiral, each pulsing in width based on its parameter's prominence.
  // No overlap. All six visible simultaneously like a ribbon cable.
  if (drawUpTo >= 2) {
    const nAxes = GROOVE_AXES.length;
    const laneSpacing = 2.5; // px between lane centers
    const totalRibbonWidth = (nAxes - 1) * laneSpacing;
    const maxLineWidth = 4;
    const minLineWidth = 0.3;

    // For each segment, compute the perpendicular direction to offset lanes
    for (let i = 0; i < drawUpTo - 1; i++) {
      const p1 = groovePoints[i];
      const p2 = groovePoints[Math.min(groovePoints.length - 1, i + 1)];

      // Direction vector along the groove
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // Perpendicular (normal) — rotate 90° CCW
      const nx = -dy / len;
      const ny = dx / len;

      // Bezier control points (same Catmull-Rom as before)
      const p0 = groovePoints[Math.max(0, i - 1)];
      const p3 = groovePoints[Math.min(groovePoints.length - 1, i + 2)];
      const tension = 0.3;

      // Draw each lane offset perpendicular to the groove direction
      for (let a = 0; a < nAxes; a++) {
        const laneOffset = (a - (nAxes - 1) / 2) * laneSpacing; // centered ribbon
        const ox = nx * laneOffset;
        const oy = ny * laneOffset;

        const val = p1.vals[a];
        // Cube root curve: quiet parameters stay visible, dominant ones still swell
        const width = minLineWidth + Math.cbrt(val) * (maxLineWidth - minLineWidth);
        if (width < 0.15) continue;

        // Offset all four control points by the same perpendicular
        const s1x = p1.x + ox, s1y = p1.y + oy;
        const s2x = p2.x + ox, s2y = p2.y + oy;
        const cp1x = s1x + (p2.x + ox - (p0.x + ox)) * tension;
        const cp1y = s1y + (p2.y + oy - (p0.y + oy)) * tension;
        const cp2x = s2x - (p3.x + ox - (p1.x + ox)) * tension;
        const cp2y = s2y - (p3.y + oy - (p1.y + oy)) * tension;

        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, s2x, s2y);
        ctx.strokeStyle = GROOVE_AXES[a].color;
        ctx.globalAlpha = 0.4 + val * 0.6;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // Draw dissolution segments in red (overlay)
  for (let i = 1; i < drawUpTo; i++) {
    if (groovePoints[i].isDissolution) {
      ctx.beginPath();
      ctx.moveTo(groovePoints[i - 1].x, groovePoints[i - 1].y);
      ctx.lineTo(groovePoints[i].x, groovePoints[i].y);
      ctx.strokeStyle = '#cc4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(204, 68, 68, 0.5)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Draw phantom boundaries
  for (let i = 0; i < drawUpTo; i++) {
    if (groovePoints[i].isPhantom) {
      const p = groovePoints[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90, 74, 48, 0.8)';
      ctx.fill();
      ctx.strokeStyle = '#5a4a30';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Draw fluid inclusions as teal dots
  for (let i = 0; i < drawUpTo; i++) {
    if (groovePoints[i].hasInclusion) {
      const p = groovePoints[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#50e0c0';
      ctx.shadowColor = 'rgba(80, 224, 192, 0.6)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Draw twin events as purple flashes
  for (let i = 0; i < drawUpTo; i++) {
    if (groovePoints[i].isTwin) {
      const p = groovePoints[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#bb66ee';
      ctx.shadowColor = 'rgba(187, 102, 238, 0.7)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Cross marker
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y);
      ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4);
      ctx.strokeStyle = '#ddaaff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Draw center dot (nucleation point)
  const center = groovePoints[0];
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c050';
  ctx.shadowColor = 'rgba(240, 192, 80, 0.6)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Draw needle (current position during playback)
  if (groovePlaying || grooveProgress > 0 && grooveProgress < 1) {
    const needleIdx = Math.min(drawUpTo - 1, groovePoints.length - 1);
    if (needleIdx >= 0) {
      const np = groovePoints[needleIdx];
      ctx.beginPath();
      ctx.arc(np.x, np.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f0c050';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(np.x, np.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c050';
      ctx.fill();
    }
  }

  // Label: zone count / total
  ctx.fillStyle = '#5a4a30';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Zone ${drawUpTo} / ${groovePoints.length}`, w - 10, h - 10);

  // Label nucleation
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a7a40';
  ctx.font = '10px monospace';
  ctx.fillText('nucleation', center.x, center.y + 16);
}

function grooveTogglePlay() {
  if (groovePlaying) {
    grooveStop();
  } else {
    groovePlay();
  }
}

function groovePlay() {
  if (!groovePoints.length) return;
  if (grooveProgress >= 1) grooveProgress = 0;
  groovePlaying = true;
  document.getElementById('groove-play-btn').textContent = '⏸ Pause';
  document.getElementById('groove-play-btn').classList.add('groove-playing');
  grooveLastTime = performance.now();
  grooveAnimate();
}

function grooveStop() {
  groovePlaying = false;
  if (grooveAnimFrame) cancelAnimationFrame(grooveAnimFrame);
  grooveAnimFrame = null;
  const btn = document.getElementById('groove-play-btn');
  if (btn) {
    btn.textContent = '▶ Play';
    btn.classList.remove('groove-playing');
  }
}

function grooveReset() {
  grooveStop();
  grooveProgress = 0;
  grooveDraw();
}

function grooveAnimate(now?) {
  if (!groovePlaying) return;
  if (!now) now = performance.now();
  const dt = (now - grooveLastTime) / 1000;
  grooveLastTime = now;

  const zonesPerSec = grooveSpeed;
  const increment = (zonesPerSec * dt) / Math.max(groovePoints.length, 1);
  grooveProgress = Math.min(1, grooveProgress + increment);

  grooveDraw();

  if (grooveProgress >= 1) {
    grooveStop();
    return;
  }

  grooveAnimFrame = requestAnimationFrame(grooveAnimate);
}

function grooveUpdateDensity(val) {
  grooveDensity = parseInt(val);
  document.getElementById('groove-density-val').textContent = `1 rev / ${val} steps`;
  grooveComputePoints();
  grooveDraw();
}

function grooveUpdateAmplitude(val) {
  grooveAmplitude = parseInt(val);
  document.getElementById('groove-amplitude-val').textContent = `${val} px`;
  grooveComputePoints();
  grooveDraw();
}

function grooveUpdateSpeed(val) {
  grooveSpeed = parseInt(val);
  document.getElementById('groove-speed-val').textContent = `${val} zones/sec`;
}

function grooveFromModal() {
  if (grooveModalCrystal) {
    grooveCrystal = grooveModalCrystal;
    closeZoneModal();
    switchMode('groove');
  }
}

// ---- Detail Strip: click-to-unroll ----
let detailDragStart = null;
let detailSelectedRange = null;

function findNearestZone(mx, my) {
  const drawUpTo = Math.max(1, Math.floor(grooveProgress * groovePoints.length));
  let bestDist = 25;
  let bestIdx = -1;
  for (let i = 0; i < drawUpTo; i++) {
    const p = groovePoints[i];
    const dx = p.x - mx, dy = p.y - my;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

function grooveCanvasCoords(e) {
  const canvas = document.getElementById('groove-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

(function() {
  const canvas = document.getElementById('groove-canvas');

  canvas.addEventListener('mousedown', function(e) {
    const {x, y} = grooveCanvasCoords(e);
    const idx = findNearestZone(x, y);
    if (idx >= 0) {
      detailDragStart = idx;
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    if (detailDragStart === null) return;
    const {x, y} = grooveCanvasCoords(e);
    let endIdx = findNearestZone(x, y);
    if (endIdx < 0) endIdx = detailDragStart;

    const lo = Math.max(0, Math.min(detailDragStart, endIdx) - 2);
    const hi = Math.min(groovePoints.length - 1, Math.max(detailDragStart, endIdx) + 2);

    // If single click (no drag), show ±5 zones around the click
    if (lo === hi || Math.abs(detailDragStart - endIdx) <= 1) {
      const center = detailDragStart;
      const radius = 5;
      detailSelectedRange = [
        Math.max(0, center - radius),
        Math.min(groovePoints.length - 1, center + radius)
      ];
    } else {
      detailSelectedRange = [lo, hi];
    }

    detailDragStart = null;
    renderDetailStrip(detailSelectedRange[0], detailSelectedRange[1]);
  });
})();


function renderDetailStrip(startIdx, endIdx) {
  if (!grooveCrystal || !grooveCrystal.zones.length) return;

  const strip = document.getElementById('groove-detail-strip');
  const label = document.getElementById('detail-range-label');
  const hint = document.getElementById('detail-hint');
  const zonesDiv = document.getElementById('detail-zones');
  const detailCanvas = document.getElementById('detail-canvas');

  strip.style.display = 'block';
  hint.style.display = 'none';
  label.textContent = `Zones ${startIdx + 1}–${endIdx + 1} of ${grooveCrystal.zones.length}`;

  const zones = grooveCrystal.zones.slice(startIdx, endIdx + 1);
  const nZones = zones.length;

  // Render via shared bar-graph canvas — minZoneWidth 12 keeps the
  // Record-Player-zoom UX (dragging to select a range) legible.
  renderZoneBarCanvas(detailCanvas, zones, {
    height: 120,
    maxWidth: 800,
    minZoneWidth: 12,
    maxZoneWidth: 60,
    showLaneLabels: true,
    showFIGlyphs: true,
  });
  // Derive zoneW from the canvas width the renderer committed to (honest
  // under minZoneWidth/maxZoneWidth clamping). Only used by the hover
  // tooltip mapping below.
  const zoneW = detailCanvas.width / nZones;

  // Add hover tooltip to the detail canvas
  detailCanvas.onmousemove = function(e) {
    const rect = detailCanvas.getBoundingClientRect();
    const scaleX = detailCanvas.width / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const zoneIdx = Math.floor(mx / zoneW);
    const tooltip = document.getElementById('groove-tooltip');

    if (zoneIdx >= 0 && zoneIdx < nZones) {
      const z = zones[zoneIdx];
      const globalIdx = startIdx + zoneIdx;
      let html = `<b>Zone ${globalIdx + 1}</b> · Step ${z.step}<br>`;
      html += `🌡️ ${z.temperature.toFixed(0)}°C<br>`;
      html += z.thickness_um >= 0
        ? `📏 +${z.thickness_um.toFixed(1)} µm<br>`
        : `<span style="color:#cc4444">📏 ${z.thickness_um.toFixed(1)} µm (dissolution)</span><br>`;
      html += `<span style="color:#cc6644">Fe: ${z.trace_Fe.toFixed(1)}</span> · `;
      html += `<span style="color:#ffaa44">Mn: ${z.trace_Mn.toFixed(1)}</span> · `;
      html += `<span style="color:#8888cc">Al: ${z.trace_Al.toFixed(1)}</span> · `;
      html += `<span style="color:#88cc88">Ti: ${z.trace_Ti.toFixed(3)}</span><br>`;
      if (z.fluid_inclusion) html += `💧 ${z.inclusion_type}<br>`;
      if (z.note) html += `<span style="color:#8a7a40">${z.note}</span>`;

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  };
  detailCanvas.onmouseleave = function() {
    document.getElementById('groove-tooltip').style.display = 'none';
  };

  // Render the number readouts below
  zonesDiv.innerHTML = '';
  for (let i = 0; i < nZones; i++) {
    const z = zones[i];
    const globalIdx = startIdx + i;
    const div = document.createElement('div');
    div.className = 'groove-detail-zone';
    if (z.thickness_um < 0) div.classList.add('dissolution');
    if (z.fluid_inclusion || (z.note && z.note.toLowerCase().includes('twin'))) div.classList.add('has-event');

    // Title tooltip for the whole zone card
    let titleParts = [`Zone ${globalIdx + 1} · Step ${z.step}`, `T: ${z.temperature.toFixed(0)}°C`];
    titleParts.push(z.thickness_um >= 0 ? `Growth: +${z.thickness_um.toFixed(1)} µm` : `Dissolution: ${z.thickness_um.toFixed(1)} µm`);
    if (z.trace_Fe > 0.1) titleParts.push(`Fe: ${z.trace_Fe.toFixed(1)} ppm`);
    if (z.trace_Mn > 0.05) titleParts.push(`Mn: ${z.trace_Mn.toFixed(1)} ppm`);
    if (z.trace_Al > 0.1) titleParts.push(`Al: ${z.trace_Al.toFixed(1)} ppm`);
    if (z.trace_Ti > 0.005) titleParts.push(`Ti: ${z.trace_Ti.toFixed(3)} ppm`);
    if (z.fluid_inclusion) titleParts.push(`Inclusion: ${z.inclusion_type}`);
    if (z.note) titleParts.push(z.note);
    div.title = titleParts.join('\n');

    let html = `<div class="dz-header">Z${globalIdx + 1}</div>`;
    html += `<div class="dz-temp">🌡${z.temperature.toFixed(0)}°</div>`;
    if (z.thickness_um >= 0) {
      html += `<div class="dz-rate">+${z.thickness_um.toFixed(1)}µm</div>`;
    } else {
      html += `<div style="color:#cc4444">${z.thickness_um.toFixed(1)}µm</div>`;
    }
    if (z.trace_Fe > 0.1) html += `<div class="dz-fe">Fe ${z.trace_Fe.toFixed(1)}</div>`;
    if (z.trace_Mn > 0.05) html += `<div class="dz-mn">Mn ${z.trace_Mn.toFixed(1)}</div>`;
    if (z.trace_Al > 0.1) html += `<div class="dz-al">Al ${z.trace_Al.toFixed(1)}</div>`;
    if (z.trace_Ti > 0.005) html += `<div class="dz-ti">Ti ${z.trace_Ti.toFixed(2)}</div>`;
    if (z.fluid_inclusion) html += `<div class="dz-event">💧 ${z.inclusion_type}</div>`;
    if (z.note && z.note.toLowerCase().includes('twin')) html += `<div class="dz-event">⟁ twin</div>`;
    if (z.note && !z.note.toLowerCase().includes('twin')) html += `<div class="dz-note">${z.note}</div>`;

    div.innerHTML = html;
    zonesDiv.appendChild(div);
  }
}

// Tooltip on hover
(function() {
  const canvas = document.getElementById('groove-canvas');
  const tooltip = document.getElementById('groove-tooltip');

  canvas.addEventListener('mousemove', function(e) {
    if (!groovePoints.length) { tooltip.style.display = 'none'; return; }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const drawUpTo = Math.max(1, Math.floor(grooveProgress * groovePoints.length));

    // Find nearest point
    let bestDist = 20; // pixel threshold
    let bestPt = null;
    for (let i = 0; i < drawUpTo; i++) {
      const p = groovePoints[i];
      const dx = p.x - mx, dy = p.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        bestPt = p;
      }
    }

    if (bestPt) {
      const z = bestPt.zone;
      let html = `<b>Zone ${bestPt.index + 1}</b> · Step ${z.step}<br>`;
      html += `🌡️ ${z.temperature.toFixed(0)}°C<br>`;
      if (z.thickness_um >= 0) {
        html += `📏 +${z.thickness_um.toFixed(1)} µm<br>`;
      } else {
        html += `<span style="color:#cc4444">📏 ${z.thickness_um.toFixed(1)} µm (dissolution)</span><br>`;
      }
      if (z.trace_Fe > 0.5) html += `Fe: ${z.trace_Fe.toFixed(1)} ppm · `;
      if (z.trace_Mn > 0.3) html += `Mn: ${z.trace_Mn.toFixed(1)} · `;
      if (z.trace_Al > 0.5) html += `Al: ${z.trace_Al.toFixed(1)} · `;
      if (z.trace_Ti > 0.01) html += `Ti: ${z.trace_Ti.toFixed(3)} · `;
      html = html.replace(/ · $/, '<br>');
      if (z.fluid_inclusion) html += `💧 ${z.inclusion_type}<br>`;
      if (z.note) html += `<span style="color:#8a7a40">${z.note}</span>`;

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', function() {
    tooltip.style.display = 'none';
  });
})();

