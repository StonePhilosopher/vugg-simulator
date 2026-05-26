// ============================================================
// js/97c-ui-crystal-card.ts — Crystal thumbnail + inventory row rendering (shared across modes)
// ============================================================
// crystalThumbHTML, renderCrystalRow, updateLegendsInventory, updateFortressInventory, renderRandomInventory — used by Legends, Creative, and Random modes.
//
// Phase B18 of PROPOSAL-MODULAR-REFACTOR. Lifted out of
// 97-ui-fortress.ts.

// Narrative-tempo Phase 5 (2026-05-11): historical-state inventory.
// When displayLines is walking the simulation lines, callers pass
// replayStep ≥ 0 to get the inventory frozen at that sim step:
//   - crystals not yet nucleated are filtered out by the caller;
//   - zones[] is sliced to entries with step <= replayStep;
//   - c_length_mm + a_width_mm are derived from the partial growth
//     (sum of zone thickness_um up to step) using the same habit:a
//     ratio table renderer uses in _topoHistoricalCrystalSize.
// When replayStep is undefined, returns the live crystal unchanged.
// The two callers that want live state (post-render cleanup, Collect
// button update) just omit the second arg.
function _inventoryHistoricalView(crystal, replayStep) {
  if (replayStep == null) return crystal;
  if (!crystal) return crystal;
  if (crystal.nucleation_step != null && crystal.nucleation_step > replayStep) return null;
  const zones = crystal.zones || [];
  let totalUm = 0;
  let lastIncluded = -1;
  for (let k = 0; k < zones.length; k++) {
    const z = zones[k];
    if (z && z.step != null && z.step > replayStep) break;
    if (z) totalUm += z.thickness_um || 0;
    lastIncluded = k;
  }
  if (lastIncluded < 0) return null;
  // Mirror the habit:a_width ratios in _topoHistoricalCrystalSize
  // (99i-renderer-three.ts:1326-1332). When habit/a_width drift,
  // both sites need to move together.
  const c = totalUm / 1000.0;
  let a;
  if (crystal.habit === 'prismatic') a = c * 0.4;
  else if (crystal.habit === 'tabular') a = c * 1.5;
  else if (crystal.habit === 'acicular') a = c * 0.15;
  else if (crystal.habit === 'rhombohedral') a = c * 0.8;
  else if (crystal.habit === 'snowball') a = c;
  else a = c * 0.5;
  // Return a SHALLOW VIEW — same prototype identity, partial growth
  // numbers, sliced zone list. Crystal-level metadata (mineral, habit,
  // twin, color, collected status) stays the live value, since none of
  // those change after nucleation in normal simulator flow.
  return Object.assign(Object.create(crystal), {
    c_length_mm: c,
    a_width_mm: a,
    total_growth_um: totalUm,
    zones: zones.slice(0, lastIncluded + 1),
  });
}

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
//
// Narrative-tempo Phase 5: optional replayStep freezes the row to the
// crystal's state at that sim step (partial c_length / a_width / zone
// count + zone-bar drawn from the sliced zone list). Caller is
// responsible for filtering out crystals that hadn't nucleated yet
// (this function won't render anything for those — _inventoryHistoricalView
// returns null and we bail early).
function renderCrystalRow(crystal, idx, onCollect, replayStep?: number) {
  const view = (replayStep != null) ? _inventoryHistoricalView(crystal, replayStep) : crystal;
  if (!view) return null;

  const el = document.createElement('div');
  el.className = 'inv-crystal';
  // Click-for-zones always reads the LIVE crystal — the user is inspecting
  // the full history regardless of where the narrative tempo is paused.
  el.onclick = () => showZoneHistory(crystal);

  const displayName = crystalDisplayName(crystal);
  const cColor = crystalColor(crystal);

  let html = `<div style="display:flex;gap:0.6rem;align-items:flex-start">`;
  html += crystalThumbHTML(view, 56);
  html += `<div style="flex:1;min-width:0">`;
  html += `<div class="inv-mineral" style="color:${cColor}">${displayName} #${crystal.crystal_id}</div>`;
  html += `<div class="inv-size">${view.c_length_mm.toFixed(1)} × ${view.a_width_mm.toFixed(1)} mm</div>`;
  html += `<div class="inv-habit">${crystal.habit}`;
  if (crystal.dominant_forms.length) html += ` [${crystal.dominant_forms[0]}]`;
  html += `</div>`;
  if (crystal.twinned) html += `<div class="inv-twin">⟁ ${crystal.twin_law}</div>`;
  if (crystal.radiation_damage > 0) html += `<div style="color:#50ff50;font-size:0.65rem">☢️ radiation damage: ${crystal.radiation_damage.toFixed(2)}</div>`;
  html += `<div style="color:#5a4a30;font-size:0.65rem;margin-top:0.2rem">${view.zones.length} zones · tap for history</div>`;
  html += `</div></div>`;

  // Collect button — disabled if already collected this session, or if
  // nothing grew. During narrative playback (replayStep != null) the
  // crystal hasn't reached its full size yet, so we suppress the button
  // until the playback finishes; otherwise a user could "collect" a
  // 0.1-mm partial specimen and the collection records would be a snapshot
  // of mid-growth rather than the final mineral.
  const already = !!crystal._collectedRecordId;
  const canCollect = (crystal.total_growth_um || 0) > 0.1 || (crystal.zones || []).length > 0;
  const replayActive = (replayStep != null);
  const btnLabel = already ? '✓ Collected' : (replayActive ? '… growing' : '💎 Collect');
  const btnAttrs = (already || !canCollect || replayActive) ? 'disabled' : '';
  const btnTitle = already
    ? 'Already in your collection'
    : (replayActive
       ? 'Wait until growth finishes to collect'
       : (canCollect ? 'Add to your collection' : 'No growth yet'));
  html += `<div class="inv-collect-row"><button class="inv-collect-btn" ${btnAttrs} title="${btnTitle}" onclick="${onCollect}(${idx}, event)">${btnLabel}</button></div>`;
  // The Collect button is in .inv-collect-row — we need to swap in handler
  el.innerHTML = html;
  return el;
}

// "Collect all" header button (2026-05-23 — boss request after twin-laws arc).
// Returns the HTML for the row that sits between the inventory's h4 and the
// per-crystal rows. Same has-growth + not-already-collected gate as the
// per-row Collect button (renderCrystalRow:153-154). Hidden entirely
// during a legends narrative replay (replayStep != null) — the per-crystal
// buttons disable there too, and the boss specifically wanted this button
// available "when you finish a game," i.e. once growth is done.
function _inventoryCollectAllHTML(crystals, onCollectAllName, replayStep?: number) {
  if (replayStep != null) return '';
  const uncollected = (crystals || []).filter(c =>
    c
    && !c._collectedRecordId
    && ((c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0)
  );
  const n = uncollected.length;
  if (!crystals || !crystals.length) return ''; // empty inventory — nothing to bulk
  const disabled = n === 0 ? 'disabled' : '';
  const title = n === 0
    ? 'Every collectable crystal is already in your collection'
    : `Add every uncollected crystal (${n}) to your collection in one go`;
  const label = n === 0 ? '✓ All collected' : `💎 Collect all (${n})`;
  return `<div class="inv-collect-all-row"><button class="inv-collect-all-btn" ${disabled} title="${title}" onclick="${onCollectAllName}()">${label}</button></div>`;
}

function updateLegendsInventory(sim, replayStep?: number) {
  const col = document.getElementById('legends-inventory-col');
  const panel = document.getElementById('legends-inventory');
  if (!col || !panel || !sim) return;

  panel.innerHTML = '<h4>💎 Crystal Inventory</h4>';

  // Narrative-tempo Phase 5: when displayLines is mid-scroll, filter
  // out crystals that hadn't nucleated yet at replayStep. Renderer
  // returns null for not-yet-nucleated crystals, but pre-filtering
  // saves the per-row work AND lets the "no crystals yet" empty-state
  // message render correctly while the early steps play.
  let visible = sim.crystals;
  if (replayStep != null) {
    visible = sim.crystals.filter((c: any) =>
      c && (c.nucleation_step == null || c.nucleation_step <= replayStep)
    );
  }

  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'inv-empty';
    empty.textContent = (replayStep != null)
      ? 'No crystals nucleated yet — waiting for first nucleation event.'
      : 'No crystals grew in this simulation.';
    panel.appendChild(empty);
    // Keep the column visible during playback even on zero crystals so
    // the panel doesn't pop in at the first nucleation — that'd be jarring
    // visual jump. Hide only when the FINAL state is empty.
    col.style.display = (replayStep != null) ? '' : 'none';
    return;
  }

  col.style.display = '';

  // Inject the "Collect all" header button between h4 and per-crystal rows.
  // Hidden during replay (matches per-crystal disabled state).
  const collectAllHTML = _inventoryCollectAllHTML(visible, 'collectAllFromLegends', replayStep);
  if (collectAllHTML) {
    const wrap = document.createElement('div');
    wrap.innerHTML = collectAllHTML;
    if (wrap.firstChild) panel.appendChild(wrap.firstChild);
  }

  visible.forEach((crystal: any) => {
    // Find the live-array index for the Collect button's onclick. Slicing
    // visible[] preserves identity, so a lookup is O(visible.length).
    const liveIdx = sim.crystals.indexOf(crystal);
    const row = renderCrystalRow(crystal, liveIdx, 'collectFromLegends', replayStep);
    if (row) panel.appendChild(row);
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

  // "Collect all" header button — visible whenever there are crystals.
  // Creative mode has no formal "finished" state, so the button is
  // always present when inventory has rows; the disabled state when
  // N=0 keeps the placement consistent run-to-run.
  const collectAllHTML = _inventoryCollectAllHTML(fortressSim.crystals, 'collectAllFromFortress');
  if (collectAllHTML) {
    const wrap = document.createElement('div');
    wrap.innerHTML = collectAllHTML;
    if (wrap.firstChild) panel.appendChild(wrap.firstChild);
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

  // "Collect all" header button — random mode runs the sim to completion
  // before render, so the inventory is always in "game finished" state.
  // Filter to grown crystals (matching the grid filter below) so the
  // count reflects what's visible.
  const grown = randomSim.crystals.filter((c: any) => (c.total_growth_um || 0) > 0);
  const collectAllHTML = _inventoryCollectAllHTML(grown, 'collectAllFromRandom');
  if (collectAllHTML) {
    const wrap = document.createElement('div');
    wrap.innerHTML = collectAllHTML;
    if (wrap.firstChild) panel.appendChild(wrap.firstChild);
  }

  const grid = document.createElement('div');
  grid.className = 'random-inventory-grid';
  randomSim.crystals.forEach((crystal, idx) => {
    if ((crystal.total_growth_um || 0) <= 0) return;
    grid.appendChild(renderCrystalRow(crystal, idx, 'collectFromRandom'));
  });
  panel.appendChild(grid);
}
