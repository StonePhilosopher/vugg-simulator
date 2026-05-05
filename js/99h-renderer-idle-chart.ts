// ============================================================
// js/99h-renderer-idle-chart.ts — Zen / Idle mode chart drawing + tick/play/pause logic
// ============================================================
// idleDrawChart, idleAppendLog, idleDrawPie, idleUpdateStatus, idleTogglePlay, idleTogglePause, idleStop, idleFinish, idleTick, idleDoStep, idleUpdateSpeed, idlePickScenario. Reads from idleSim state declared in 98a-ui-zen.ts.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.


function idleDrawChart() {
  const canvas = document.getElementById('idle-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, W, H);

  if (idleHistory.length < 2) return;

  const padding = { left: 50, right: 15, top: 15, bottom: 30 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  // Find Y range — supersaturation typically 0 to ~5, but can spike
  let maxSigma = 3.0;
  for (const h of idleHistory) {
    for (const val of Object.values(h.supersats) as number[]) {
      if (val > maxSigma) maxSigma = Math.min(val, 15);
    }
  }
  maxSigma = Math.ceil(maxSigma);

  const xScale = chartW / (idleMaxHistory - 1);
  const yScale = chartH / maxSigma;

  // Grid lines
  ctx.strokeStyle = '#1a1a14';
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= maxSigma; y++) {
    const py = padding.top + chartH - y * yScale;
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(W - padding.right, py);
    ctx.stroke();

    ctx.fillStyle = '#5a4a30';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(y.toString(), padding.left - 5, py + 3);
  }

  // Nucleation threshold line at σ = 1.0
  const threshY = padding.top + chartH - 1.0 * yScale;
  ctx.strokeStyle = '#3a3520';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, threshY);
  ctx.lineTo(W - padding.right, threshY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#5a4a30';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('σ=1 nucleation', W - padding.right - 80, threshY - 4);

  // X axis labels (step numbers)
  ctx.fillStyle = '#5a4a30';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (idleHistory.length > 0) {
    const first = idleHistory[0].step;
    const last = idleHistory[idleHistory.length - 1].step;
    ctx.fillText(String(first), padding.left, H - 5);
    ctx.fillText(String(last), W - padding.right, H - 5);
    if (idleHistory.length > 50) {
      const mid = idleHistory[Math.floor(idleHistory.length / 2)].step;
      ctx.fillText(String(mid), padding.left + chartW / 2, H - 5);
    }
  }

  // Y axis label
  ctx.save();
  ctx.fillStyle = '#5a4a30';
  ctx.font = '9px monospace';
  ctx.translate(12, padding.top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Supersaturation (σ)', 0, 0);
  ctx.restore();

  // Draw lines for each mineral
  const startIdx = Math.max(0, idleHistory.length - idleMaxHistory);
  for (const [mineral, color] of Object.entries(IDLE_MINERAL_COLORS)) {
    const points = [];
    for (let i = startIdx; i < idleHistory.length; i++) {
      const val = idleHistory[i].supersats[mineral];
      if (val === undefined) continue;
      const x = padding.left + (i - startIdx) * xScale;
      const y = padding.top + chartH - Math.min(val, maxSigma) * yScale;
      points.push({ x, y });
    }
    if (points.length < 2) continue;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // Temperature overlay (right side, subtle)
  if (idleHistory.length > 1) {
    let minT = 600, maxT = 25;
    for (const h of idleHistory) {
      if (h.temp < minT) minT = h.temp;
      if (h.temp > maxT) maxT = h.temp;
    }
    const tRange = Math.max(maxT - minT, 10);

    ctx.strokeStyle = '#ff884422';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = startIdx; i < idleHistory.length; i++) {
      const x = padding.left + (i - startIdx) * xScale;
      const y = padding.top + chartH - ((idleHistory[i].temp - minT) / tRange) * chartH;
      if (i === startIdx) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Temperature label
    ctx.fillStyle = '#ff884466';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    const lastT = idleHistory[idleHistory.length - 1].temp;
    ctx.fillText(`${lastT.toFixed(0)}°C`, W - padding.right, padding.top + 10);
  }
}

function idleAppendLog(logEl, text, className) {
  if (!logEl) return;
  const line = document.createElement('div');
  line.className = 'idle-log-line' + (className ? ' ' + className : '');
  line.textContent = text;
  // Insert at top — newest first, old text pushes down
  logEl.insertBefore(line, logEl.firstChild);
  // Keep only last 100 lines
  while (logEl.children.length > 100) {
    logEl.removeChild(logEl.lastChild);
  }
}

function idleDrawPie() {
  if (!idleSim) return;
  const canvas = document.getElementById('idle-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, radius = Math.min(cx, cy) - 8;

  ctx.clearRect(0, 0, W, H);

  // Calculate vug volume (sphere) in mm³
  const vugDiam = idleSim.conditions.wall.vug_diameter_mm;
  const vugRadius = vugDiam / 2;
  const vugVolume = (4 / 3) * Math.PI * Math.pow(vugRadius, 3);

  // Estimate crystal volumes — approximate as ellipsoids
  const mineralVolumes: Record<string, number> = {};
  let totalCrystalVolume = 0;
  for (const crystal of idleSim.crystals) {
    if (!crystal.active) continue;
    const a = crystal.c_length_mm / 2; // semi-major
    const b = crystal.a_width_mm / 2;  // semi-minor
    const vol = (4 / 3) * Math.PI * a * b * b; // prolate ellipsoid
    const mineral = crystal.mineral;
    mineralVolumes[mineral] = (mineralVolumes[mineral] || 0) + vol;
    totalCrystalVolume += vol;
  }

  const rawFillPct = (totalCrystalVolume / vugVolume) * 100;
  const fillPct = Math.min(100, rawFillPct);
  const openPct = Math.max(0, 100 - fillPct);

  // Build slices: minerals + open space
  const slices = [];
  for (const [mineral, vol] of Object.entries(mineralVolumes)) {
    const pct = (vol / vugVolume) * 100;
    const color = MINERAL_GAME_COLORS[mineral] || '#d4a843';
    slices.push({ label: mineral, pct, color });
  }
  // Sort by size descending
  slices.sort((a, b) => b.pct - a.pct);
  // Add open space
  slices.push({ label: 'open', pct: Math.max(0, openPct), color: '#1a1a14' });

  // Draw pie — minimum visible angle for tiny minerals
  const minAngle = 0.05; // ~3 degrees, enough to see a sliver
  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    if (slice.pct <= 0) continue;
    let sweepAngle = (slice.pct / 100) * 2 * Math.PI;
    // Ensure non-open slices are visible even when tiny
    if (slice.label !== 'open' && sweepAngle < minAngle && sweepAngle > 0) {
      sweepAngle = minAngle;
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweepAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    // Border between slices
    ctx.strokeStyle = '#0a0a08';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    startAngle += sweepAngle;
  }

  // Open space ring outline
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = '#3a3520';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center label
  ctx.fillStyle = '#d4a843';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${fillPct.toFixed(1)}%`, cx, cy - 6);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#8a7a40';
  ctx.fillText('filled', cx, cy + 10);

  // Update label
  const labelEl = document.getElementById('idle-pie-label');
  if (labelEl) {
    const mineralList = slices
      .filter(s => s.label !== 'open' && s.pct > 0.001)
      .map(s => s.pct >= 0.1 ? `${s.label} ${s.pct.toFixed(1)}%` : `${s.label} microcrystals`)
      .join(' · ');
    labelEl.textContent = mineralList || 'empty vug';
    // Agate detection!
    if (fillPct > 90) {
      const quartzPct = (mineralVolumes['quartz'] || 0) / vugVolume * 100;
      if (quartzPct > fillPct * 0.8) {
        labelEl.textContent = '🪨 AGATE — vug filled with quartz!';
        labelEl.style.color = '#f0c050';
      }
    }
  }
}

function idleUpdateStatus() {
  const el = document.getElementById('idle-step-counter');
  if (!el || !idleSim) return;
  const activeCrystals = idleSim.crystals.filter(c => c.active).length;
  const totalCrystals = idleSim.crystals.length;
  const yearsPerStep = timeScale * 10000;
  const totalYears = idleSim.step * yearsPerStep;
  const timeStr = totalYears >= 1e6 ? `${(totalYears / 1e6).toFixed(1)}My` : `${(totalYears / 1000).toFixed(0)}ky`;
  el.textContent = `Step ${idleSim.step} · ${activeCrystals}/${totalCrystals} crystals · ${idleSim.conditions.temperature.toFixed(0)}°C · ${timeStr}`;
}

function idleTogglePlay() {
  if (idleRunning && !idlePaused) return;

  if (!idleSim) {
    const scenario = document.getElementById('idle-scenario').value;
    idleSim = idleCreateSim(scenario);
    if (!idleSim) return;
    const logEl = document.getElementById('idle-log');
    logEl.innerHTML = '';
    idleAppendLog(logEl, `🌀 Zen Mode — endless crystal growth begins`, 'log-step');
    idleAppendLog(logEl, `   Starting at ${idleSim.conditions.temperature.toFixed(0)}°C, pH ${idleSim.conditions.fluid.pH.toFixed(1)}`, '');
    idleAppendLog(logEl, `   ${idleSim.conditions.fluid.describe()}`, '');
    idleAppendLog(logEl, `${'═'.repeat(60)}`, '');
  }

  idleRunning = true;
  idlePaused = false;
  idleLastTick = performance.now();

  document.getElementById('idle-play-btn').classList.add('active');
  document.getElementById('idle-play-btn').disabled = true;
  document.getElementById('idle-pause-btn').disabled = false;
  document.getElementById('idle-pause-btn').classList.remove('active');
  document.getElementById('idle-finish-btn').disabled = false;
  document.getElementById('idle-scenario').disabled = true;

  idleAnimFrame = requestAnimationFrame(idleTick);
}

function idleTogglePause() {
  if (!idleRunning) return;
  idlePaused = !idlePaused;

  const pauseBtn = document.getElementById('idle-pause-btn');
  const playBtn = document.getElementById('idle-play-btn');

  if (idlePaused) {
    pauseBtn.classList.add('active');
    pauseBtn.textContent = '⏸️ Paused';
    playBtn.disabled = false;
    playBtn.classList.remove('active');
    if (idleAnimFrame) cancelAnimationFrame(idleAnimFrame);
  } else {
    pauseBtn.classList.remove('active');
    pauseBtn.textContent = '⏸️ Pause';
    playBtn.disabled = true;
    playBtn.classList.add('active');
    idleLastTick = performance.now();
    idleAnimFrame = requestAnimationFrame(idleTick);
  }
}

function idleStop() {
  idleRunning = false;
  idlePaused = false;
  if (idleAnimFrame) {
    cancelAnimationFrame(idleAnimFrame);
    idleAnimFrame = null;
  }
}

function idleFinish() {
  idleStop();
  const logEl = document.getElementById('idle-log');

  if (idleSim) {
    idleAppendLog(logEl, '', '');
    idleAppendLog(logEl, `${'═'.repeat(60)}`, '');
    const summary = idleSim.format_summary();
    for (const line of summary.split('\n')) {
      idleAppendLog(logEl, line, '');
    }

    // Make finished game available to Record Player
    if (typeof groovePopulateCrystals === 'function') {
      groovePopulateCrystals();
    }
  }

  // Reset buttons
  document.getElementById('idle-play-btn').classList.remove('active');
  document.getElementById('idle-play-btn').disabled = false;
  document.getElementById('idle-play-btn').textContent = '▶️ New';
  document.getElementById('idle-pause-btn').disabled = true;
  document.getElementById('idle-pause-btn').classList.remove('active');
  document.getElementById('idle-pause-btn').textContent = '⏸️ Pause';
  document.getElementById('idle-finish-btn').disabled = true;
  document.getElementById('idle-scenario').disabled = false;

  idleSim = null;
}

function idleTick(now) {
  if (!idleRunning || idlePaused) return;

  const speed = IDLE_SPEED_MAP[idleSpeed];
  const interval = 1000 / speed;

  if (now - idleLastTick >= interval) {
    idleLastTick = now;
    idleDoStep();
  }

  idleAnimFrame = requestAnimationFrame(idleTick);
}

function idleDoStep() {
  if (!idleSim) return;

  // Apply stochastic drift before physics
  idleApplyDrift();

  // Run the physics step
  const prevCrystalCount = idleSim.crystals.length;
  const log = idleSim.run_step();

  // Record supersaturation history
  idleRecordHistory();

  // Log output
  const logEl = document.getElementById('idle-log');
  if (idleSim.step % 10 === 0 || log.length > 0) {
    if (idleSim.step % 25 === 0) {
      idleAppendLog(logEl, `── Step ${idleSim.step} │ T=${idleSim.conditions.temperature.toFixed(0)}°C │ pH=${idleSim.conditions.fluid.pH.toFixed(1)} │ ${idleSim.crystals.filter(c => c.active).length} crystals`, 'log-step');
    }
    for (const line of log) {
      let cls = '';
      if (line.includes('NUCLEATION')) cls = 'log-nucleation';
      else if (line.includes('DISSOLUTION') || line.includes('⬇')) cls = 'log-dissolution';
      else if (line.includes('▲')) cls = 'log-growth';
      idleAppendLog(logEl, line, cls);
    }
  }

  // Update chart and status
  idleDrawChart();
  idleDrawPie();
  idleUpdateStatus();
  if (typeof topoRender === 'function') topoRender();
}

function idleUpdateSpeed(val) {
  idleSpeed = parseInt(val);
  document.getElementById('idle-speed-val').textContent = IDLE_SPEED_MAP[idleSpeed] + ' step/s';
}

function idlePickScenario(val) {
  // Reset if not running
  if (!idleRunning) {
    idleSim = null;
    idleHistory = [];
    const logEl = document.getElementById('idle-log');
    logEl.innerHTML = '<div style="color:#5a4a30; font-style:italic; text-align:center; padding:1rem;">Press ▶️ Play to start the simulation.</div>';
    document.getElementById('idle-step-counter').textContent = 'Step 0 · 0 crystals · 0°C';
    document.getElementById('idle-play-btn').textContent = '▶️ Play';
    const canvas = document.getElementById('idle-chart');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#070706';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// On initial page load, update the title-screen Load Game button state
// based on whether any individual crystals are in the collection.
(function titleInit() {
  try { refreshTitleLoadButton(); } catch (e) { /* ignore */ }
})();

