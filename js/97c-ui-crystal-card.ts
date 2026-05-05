// ============================================================
// js/97c-ui-crystal-card.ts — Crystal thumbnail + inventory row rendering (shared across modes)
// ============================================================
// crystalThumbHTML, renderCrystalRow, updateLegendsInventory, updateFortressInventory, renderRandomInventory — used by Legends, Creative, and Random modes.
//
// Phase B18 of PROPOSAL-MODULAR-REFACTOR. Lifted out of
// 97-ui-fortress.ts.

// Zone-viz Phase 1c: bar-graph thumbnail for Crystal Inventory specimen
// cards. Falls back to the generic mineral photo/placeholder thumb only
// when the crystal has zero zones recorded (e.g. legacy serialized
// records from before zone data was persisted). A single zone is still
// real history — the moment of nucleation — and renderZoneBarCanvas
// handles it correctly (single dim stripe, per its all-equal-values
// branch). Pre-2026-04-30 this gated on >= 2, which left sub-resolution
// crystals (1 zone, 0.0 mm) showing the generic 💎 placeholder while
// every other species in the inventory had a real bar-graph thumb —
// surfaced as a topaz #6 visual bug in seed-42 ouro_preto.
//
// Implementation note: renderCrystalRow builds its content as an HTML
// string and commits it via el.innerHTML. A live canvas can't be painted
// via innerHTML — it needs a post-insert JS paint. So we render off-
// screen via renderZoneBarCanvas + toDataURL and embed as an <img>.
// The underlying canvas width may exceed the thumbnail display box (e.g.
// 150 zones × 1px-zone = 150px canvas); the <img> CSS stretches/squashes
// it to the display size, which is the right trade-off — the color
// pattern is the message, not pixel-precise zone boundaries.
function crystalThumbHTML(crystal, size) {
  size = size || 56;
  const cColor = crystalColor(crystal);
  // Twin is crystal-level metadata, not zone-level data — by design
  // (Phase 1b boss call). Render as a small ⟁ badge overlaid on the
  // thumbnail corner so twin status reads at a glance in every surface
  // the thumbnail appears (inventory cards + Library collected rows)
  // without polluting the bar graph itself.
  const twinBadge = crystal && crystal.twinned
    ? `<div style="position:absolute;top:1px;right:1px;background:#3a2044;color:#bb66ee;font-size:${Math.max(9, size*0.22)}px;line-height:1;padding:1px 3px;border-radius:2px;pointer-events:none;font-weight:bold" title="Twinned: ${crystal.twin_law || 'yes'}">⟁</div>`
    : '';
  if (crystal && crystal.zones && crystal.zones.length >= 1) {
    const thumbCanvas = document.createElement('canvas');
    renderZoneBarCanvas(thumbCanvas, crystal.zones, {
      height: size,
      maxWidth: size,
      minZoneWidth: 1,
      maxZoneWidth: 4,
      showLaneLabels: false,
      showFIGlyphs: true,
    });
    const dataUrl = thumbCanvas.toDataURL();
    return `<div style="width:${size}px;height:${size}px;border-radius:4px;overflow:hidden;flex-shrink:0;border:1px solid ${cColor}44;background:#070706;position:relative" title="${crystal.mineral} · ${crystal.zones.length} zones">
      <img src="${dataUrl}" style="width:100%;height:100%;display:block;image-rendering:pixelated" alt="${crystal.mineral} growth history">
      ${twinBadge}
    </div>`;
  }
  // Photo/placeholder fallback — also overlay the twin badge. Wrap the
  // returned HTML in a positioned container so the absolute-positioned
  // badge anchors correctly.
  const base = mineralThumbHTML(crystal.mineral, size, crystal);
  if (!twinBadge) return base;
  return `<div style="position:relative;display:inline-block">${base}${twinBadge}</div>`;
}

// Shared renderer — builds the crystal row HTML + wires click-for-zones
// + per-crystal Collect button. `onCollect` takes (index, event) so
// the caller can route to the right mode's collect helper.
function renderCrystalRow(crystal, idx, onCollect) {
  const el = document.createElement('div');
  el.className = 'inv-crystal';
  el.onclick = () => showZoneHistory(crystal);

  const displayName = crystalDisplayName(crystal);
  const cColor = crystalColor(crystal);

  let html = `<div style="display:flex;gap:0.6rem;align-items:flex-start">`;
  html += crystalThumbHTML(crystal, 56);
  html += `<div style="flex:1;min-width:0">`;
  html += `<div class="inv-mineral" style="color:${cColor}">${displayName} #${crystal.crystal_id}</div>`;
  html += `<div class="inv-size">${crystal.c_length_mm.toFixed(1)} × ${crystal.a_width_mm.toFixed(1)} mm</div>`;
  html += `<div class="inv-habit">${crystal.habit}`;
  if (crystal.dominant_forms.length) html += ` [${crystal.dominant_forms[0]}]`;
  html += `</div>`;
  if (crystal.twinned) html += `<div class="inv-twin">⟁ ${crystal.twin_law}</div>`;
  if (crystal.radiation_damage > 0) html += `<div style="color:#50ff50;font-size:0.65rem">☢️ radiation damage: ${crystal.radiation_damage.toFixed(2)}</div>`;
  html += `<div style="color:#5a4a30;font-size:0.65rem;margin-top:0.2rem">${crystal.zones.length} zones · tap for history</div>`;
  html += `</div></div>`;

  // Collect button — disabled if already collected this session, or if nothing grew.
  const already = !!crystal._collectedRecordId;
  const canCollect = (crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0;
  const btnLabel = already ? '✓ Collected' : '💎 Collect';
  const btnAttrs = already || !canCollect ? 'disabled' : '';
  const btnTitle = already
    ? 'Already in your collection'
    : (canCollect ? 'Add to your collection' : 'No growth yet');
  html += `<div class="inv-collect-row"><button class="inv-collect-btn" ${btnAttrs} title="${btnTitle}" onclick="${onCollect}(${idx}, event)">${btnLabel}</button></div>`;
  // The Collect button is in .inv-collect-row — we need to swap in handler
  el.innerHTML = html;
  return el;
}

function updateLegendsInventory(sim) {
  const col = document.getElementById('legends-inventory-col');
  const panel = document.getElementById('legends-inventory');
  if (!col || !panel || !sim) return;

  panel.innerHTML = '<h4>💎 Crystal Inventory</h4>';

  if (!sim.crystals.length) {
    const empty = document.createElement('div');
    empty.className = 'inv-empty';
    empty.textContent = 'No crystals grew in this simulation.';
    panel.appendChild(empty);
    col.style.display = 'none';
    return;
  }

  col.style.display = '';
  sim.crystals.forEach((crystal, idx) => {
    panel.appendChild(renderCrystalRow(crystal, idx, 'collectFromLegends'));
  });
}

function updateFortressInventory() {
  if (!fortressSim) return;
  const panel = document.getElementById('fortress-inventory');
  panel.innerHTML = '<h4>💎 Crystal Inventory</h4>';

  if (!fortressSim.crystals.length) {
    const empty = document.createElement('div');
    empty.className = 'inv-empty';
    empty.textContent = 'No crystals yet. Conditions may need to reach supersaturation first.';
    panel.appendChild(empty);
    return;
  }

  fortressSim.crystals.forEach((crystal, idx) => {
    panel.appendChild(renderCrystalRow(crystal, idx, 'collectFromFortress'));
  });
}

function renderRandomInventory() {
  const panel = document.getElementById('random-inventory');
  if (!panel) return;
  panel.innerHTML = '';
  if (!randomSim || !randomSim.crystals.length) return;

  const header = document.createElement('h4');
  header.textContent = '💎 Crystal Inventory';
  header.style.cssText = 'color:#f0c050;margin:0.8rem 0 0.5rem 0;letter-spacing:0.08em';
  panel.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'random-inventory-grid';
  randomSim.crystals.forEach((crystal, idx) => {
    if ((crystal.total_growth_um || 0) <= 0) return;
    grid.appendChild(renderCrystalRow(crystal, idx, 'collectFromRandom'));
  });
  panel.appendChild(grid);
}
