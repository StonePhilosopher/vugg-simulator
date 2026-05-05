// ============================================================
// js/97d-ui-zone-modal.ts — Zone-history modal (showZoneHistory + closeZoneModal)
// ============================================================
// The deep-dive modal for any single crystal, opened by clicking a crystal card. Shared across modes.
//
// Phase B18 of PROPOSAL-MODULAR-REFACTOR. Lifted out of
// 97-ui-fortress.ts.

function showZoneHistory(crystal) {
  const overlay = document.getElementById('zone-overlay');
  const title = document.getElementById('zone-modal-title');
  const body = document.getElementById('zone-modal-body');

  const cColor = crystalColor(crystal);
  title.textContent = `${capitalize(crystalDisplayName(crystal))} #${crystal.crystal_id} — Zone History`;
  title.style.color = cColor;
  body.innerHTML = '';

  // Crystal summary
  const summary = document.createElement('div');
  summary.style.cssText = 'margin-bottom:0.8rem;font-size:0.8rem;color:#c0a848;line-height:1.5';
  summary.innerHTML = `
    <div>Nucleated: step ${crystal.nucleation_step} at ${crystal.nucleation_temp.toFixed(0)}°C</div>
    <div>Morphology: ${crystal.describe_morphology()}</div>
    <div>Total growth: ${crystal.total_growth_um.toFixed(0)} µm (${crystal.c_length_mm.toFixed(1)} mm)</div>
    ${crystal.twinned ? `<div style="color:#bb66ee">Twinned: ${crystal.twin_law}</div>` : ''}
    ${crystal.dissolved ? `<div style="color:#cc4444">Partially dissolved</div>` : ''}
    <div>Fluorescence: ${crystal.predict_fluorescence()}</div>
    ${MINERAL_ASCII[crystal.mineral] ? `<pre style="margin:0.8rem 0;font-size:0.45rem;line-height:1.1;color:${cColor};overflow-x:auto;text-align:center">${MINERAL_ASCII[crystal.mineral]}</pre>` : (MINERAL_THUMBS[crystal.mineral] ? `<div style="margin:0.8rem 0;text-align:center">${mineralThumbHTML(crystal.mineral, 160, crystal)}</div>` : '')}
    <div style="margin-top:0.5rem"><button onclick="grooveFromModal()" style="background:#2a2510;border:1px solid #5a4a20;color:#d4a843;padding:0.3rem 0.8rem;font-size:0.75rem;border-radius:3px;cursor:pointer">📀 Play Record</button></div>
  `;
  grooveModalCrystal = crystal;
  body.appendChild(summary);

  if (!crystal.zones.length) {
    const noZones = document.createElement('div');
    noZones.className = 'inv-empty';
    noZones.textContent = 'No growth zones recorded yet.';
    body.appendChild(noZones);
  } else {
    // ── Zone-viz Phase 1: bar graph replaces the zone-by-zone text list.
    //    Time reads left (nucleation, zone 1) → right (rim, zone N).
    //    Six stacked lanes (Temperature, Growth rate, Fe/Mn/Al/Ti) via
    //    the shared GROOVE_AXES palette — same color language as the
    //    Record Player. Text list moves into a collapsible below for
    //    precise-value lookup.
    // Phase 2a: shape-aware rendering ABOVE the bar graph. For habit
    // vectors with a shape renderer (currently: equant), we paint the
    // crystal-shape nested-zone view first — the poetic "this is what
    // the crystal looks like inside" view. The bar graph below stays as
    // the data-precise companion. For vectors without a shape renderer
    // yet, the dispatcher falls back to the bar graph silently, so the
    // modal just shows one bar (current Phase 1 behavior).
    const hasShapeRender = getCrystalVector(crystal) === 'equant';
    if (hasShapeRender) {
      const shapeHeader = document.createElement('div');
      shapeHeader.style.cssText = 'color:#8a7a40;font-size:0.7rem;border-bottom:1px solid #2a2518;padding-bottom:0.3rem;margin-bottom:0.4rem;display:flex;justify-content:space-between;align-items:baseline';
      shapeHeader.innerHTML = `
        <span>The specimen</span>
        <span style="font-size:0.65rem;color:#5a4a30">nucleation → rim outward</span>
      `;
      body.appendChild(shapeHeader);

      const shapeCanvas = document.createElement('canvas');
      shapeCanvas.style.cssText = 'display:block;margin:0 auto 0.8rem auto;max-width:100%;height:auto;background:#070706;border:1px solid #1a1a14;border-radius:3px';
      body.appendChild(shapeCanvas);
      renderZoneShapeCanvas(shapeCanvas, crystal, { size: 240 });
    }

    // Chemistry bar — the "story" view. Each segment is one chromophore
    // regime (dominant trace + the color color_rules produces for it).
    // Watermelon-tourmaline reads at a glance: wide green segment + thin
    // pink segment.
    const chemHeader = document.createElement('div');
    chemHeader.style.cssText = 'color:#8a7a40;font-size:0.7rem;border-bottom:1px solid #2a2518;padding-bottom:0.3rem;margin-bottom:0.4rem;display:flex;justify-content:space-between;align-items:baseline';
    chemHeader.innerHTML = `
      <span>By chromophore — visible color</span>
      <span style="font-size:0.65rem;color:#5a4a30">nucleation ← → rim</span>
    `;
    body.appendChild(chemHeader);
    const chemCanvas = document.createElement('canvas');
    chemCanvas.style.cssText = 'display:block;width:100%;max-width:600px;height:auto;background:#070706;border:1px solid #1a1a14;border-radius:3px;margin-bottom:0.8rem';
    body.appendChild(chemCanvas);
    const chemSegs = renderChemistryBar(chemCanvas, crystal, { width: 600, height: 36 });

    // Hover tooltip for chem-bar segments — reuses the Record Player's
    // #groove-tooltip element. Hover shows the chromophore regime + how
    // many zones it spans + cumulative thickness.
    const chemSegW = (canvas) => canvas.width;
    chemCanvas.onmousemove = function(e) {
      const tooltip = document.getElementById('groove-tooltip');
      if (!tooltip) return;
      const rect = chemCanvas.getBoundingClientRect();
      const scaleX = chemCanvas.width / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const hit = chemSegs.find(s => mx >= s.x && mx < s.x + s.w);
      if (!hit) { tooltip.style.display = 'none'; return; }
      const seg = hit.seg;
      const firstZ = seg.zones[0];
      const lastZ = seg.zones[seg.zones.length - 1];
      let html = `<b>${seg.isDissolution ? 'Dissolution event' : 'Chromophore regime'}</b><br>`;
      html += `${seg.zones.length} zone${seg.zones.length > 1 ? 's' : ''} · `;
      html += `step ${firstZ.step}–${lastZ.step}<br>`;
      html += `<span style="display:inline-block;width:10px;height:10px;background:${seg.color};border:1px solid #555;vertical-align:middle"></span> `;
      html += `${seg.color}<br>`;
      html += `±${seg.totalThickness.toFixed(1)} µm cumulative`;
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    };
    chemCanvas.onmouseleave = function() {
      const tooltip = document.getElementById('groove-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    // UV bar — the "ghost under the lamp" view. Same stratigraphic
    // primitive as the chem bar but each segment represents a
    // fluorescence regime instead of a visible-color regime.
    const uvHeader = document.createElement('div');
    uvHeader.style.cssText = 'color:#8a7a40;font-size:0.7rem;border-bottom:1px solid #2a2518;padding-bottom:0.3rem;margin-bottom:0.4rem;display:flex;justify-content:space-between;align-items:baseline';
    uvHeader.innerHTML = `
      <span>Under UV — fluorescence response</span>
      <span style="font-size:0.65rem;color:#5a4a30">${uvSummary(crystal.mineral)}</span>
    `;
    body.appendChild(uvHeader);
    const uvCanvas = document.createElement('canvas');
    uvCanvas.style.cssText = 'display:block;width:100%;max-width:600px;height:auto;background:#181822;border:1px solid #1a1a14;border-radius:3px;margin-bottom:0.8rem';
    body.appendChild(uvCanvas);
    const uvSegs = renderUVBar(uvCanvas, crystal, { width: 600, height: 36 });

    // Hover tooltip for UV-bar segments — shows whether the segment
    // emits, what color, what activator/quencher likely caused it.
    uvCanvas.onmousemove = function(e) {
      const tooltip = document.getElementById('groove-tooltip');
      if (!tooltip) return;
      const rect = uvCanvas.getBoundingClientRect();
      const scaleX = uvCanvas.width / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const hit = uvSegs.find(s => mx >= s.x && mx < s.x + s.w);
      if (!hit) { tooltip.style.display = 'none'; return; }
      const seg = hit.seg;
      const firstZ = seg.zones[0];
      const lastZ = seg.zones[seg.zones.length - 1];
      let html = `<b>${seg.color ? 'Fluorescent regime' : 'Inert under UV'}</b><br>`;
      html += `${seg.zones.length} zone${seg.zones.length > 1 ? 's' : ''} · `;
      html += `step ${firstZ.step}–${lastZ.step}<br>`;
      if (seg.color) {
        html += `<span style="display:inline-block;width:10px;height:10px;background:${seg.color};border:1px solid #555;vertical-align:middle"></span> `;
        html += `emission ${seg.color}<br>`;
      } else {
        html += `<span style="color:#888">no emission — activator below threshold or quencher present</span><br>`;
      }
      html += `±${seg.totalThickness.toFixed(1)} µm cumulative`;
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    };
    uvCanvas.onmouseleave = function() {
      const tooltip = document.getElementById('groove-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    // Dashboard bar — the "data" view. 6 stacked lanes per zone.
    const barHeader = document.createElement('div');
    barHeader.style.cssText = 'color:#8a7a40;font-size:0.7rem;border-bottom:1px solid #2a2518;padding-bottom:0.3rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:baseline';
    barHeader.innerHTML = `
      <span>${crystal.zones.length} growth zone${crystal.zones.length > 1 ? 's' : ''} · by chemistry axis</span>
      <span style="font-size:0.65rem;color:#5a4a30">nucleation ← → rim</span>
    `;
    body.appendChild(barHeader);

    // Canvas sized to the modal's effective content width (~600px after
    // padding on a 650px-max modal).
    const barCanvas = document.createElement('canvas');
    barCanvas.style.cssText = 'width:100%;max-width:600px;height:auto;display:block;margin-bottom:0.3rem;background:#070706;border:1px solid #1a1a14;border-radius:3px';
    body.appendChild(barCanvas);
    renderZoneBarCanvas(barCanvas, crystal.zones, {
      height: 160,
      maxWidth: 600,
      minZoneWidth: 1,
      maxZoneWidth: 30,
      showLaneLabels: true,
      showFIGlyphs: true,
    });

    // Hover tooltip for bar-graph zones — reuses the Record Player's
    // #groove-tooltip element when present, otherwise no-op.
    const nZones = crystal.zones.length;
    const zoneWPx = barCanvas.width / nZones;
    barCanvas.onmousemove = function(e) {
      const tooltip = document.getElementById('groove-tooltip');
      if (!tooltip) return;
      const rect = barCanvas.getBoundingClientRect();
      const scaleX = barCanvas.width / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const zoneIdx = Math.floor(mx / zoneWPx);
      if (zoneIdx < 0 || zoneIdx >= nZones) { tooltip.style.display = 'none'; return; }
      const z = crystal.zones[zoneIdx];
      let html = `<b>Zone ${zoneIdx + 1}</b> · Step ${z.step}<br>`;
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
    };
    barCanvas.onmouseleave = function() {
      const tooltip = document.getElementById('groove-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    // Collapsible precise-value list below the bar graph. Kept for
    // players who want to read exact numbers; default closed so the
    // bar graph is the primary narrative.
    const details = document.createElement('details');
    details.style.cssText = 'margin-top:0.6rem';
    const summaryEl = document.createElement('summary');
    summaryEl.style.cssText = 'cursor:pointer;color:#8a7a40;font-size:0.7rem;padding:0.3rem 0';
    summaryEl.textContent = 'Zone-by-zone details';
    details.appendChild(summaryEl);

    for (const z of crystal.zones) {
      const entry = document.createElement('div');
      entry.className = 'zone-entry';
      let html = `<span class="z-step">Step ${z.step}</span> · `;
      html += `<span class="z-temp">${z.temperature.toFixed(0)}°C</span> · `;
      if (z.thickness_um >= 0) {
        html += `<span class="z-thick">+${z.thickness_um.toFixed(1)} µm</span>`;
      } else {
        html += `<span style="color:#cc4444">${z.thickness_um.toFixed(1)} µm (dissolution)</span>`;
      }

      const traces = [];
      if (z.trace_Fe > 0.5) traces.push(`Fe ${z.trace_Fe.toFixed(1)}`);
      if (z.trace_Mn > 0.3) traces.push(`Mn ${z.trace_Mn.toFixed(1)}`);
      if (z.trace_Ti > 0.01) traces.push(`Ti ${z.trace_Ti.toFixed(3)}`);
      if (z.trace_Al > 0.5) traces.push(`Al ${z.trace_Al.toFixed(1)}`);
      if (traces.length) html += ` · <span style="color:#a89040">${traces.join(', ')} ppm</span>`;

      if (z.fluid_inclusion) html += ` · <span class="z-fi">FI: ${z.inclusion_type}</span>`;
      if (z.note) html += `<div class="z-note">${z.note}</div>`;

      entry.innerHTML = html;
      details.appendChild(entry);
    }
    body.appendChild(details);
  }

  overlay.classList.add('visible');
}

function closeZoneModal() {
  document.getElementById('zone-overlay').classList.remove('visible');
}
