// ============================================================
// js/97b-ui-sigma-panel.ts — Saturation panel filters + per-class group renderer
// ============================================================
// _satShowNucleating / _satShowDormant filter state, _onSatFilterToggle, _renderFortressSigmaGroups, _wireFortressSigmaEvents — used by Creative-mode and any other mode that shows the σ-by-class pill panel.
//
// Phase B18 of PROPOSAL-MODULAR-REFACTOR. Lifted out of
// 97-ui-fortress.ts.

// Filter state — both default on. Filters drop pills below the
// nucleation threshold (σ < 1) or above it (σ ≥ 1) from the panel.
// A class group with no surviving pills hides entirely so the panel
// doesn't waste a row on an empty section.
let _satShowNucleating = true;
let _satShowDormant = true;

function _onSatFilterToggle() {
  const a = document.getElementById('sat-filter-nucleating');
  const b = document.getElementById('sat-filter-dormant');
  _satShowNucleating = a ? a.checked : true;
  _satShowDormant = b ? b.checked : true;
  if (typeof fortressSim !== 'undefined' && fortressSim) {
    _renderFortressSigmaGroups(fortressSim.conditions, document.getElementById('f-sat-bar'));
  }
}

function _renderFortressSigmaGroups(c, host) {
  if (!host) return;
  host.innerHTML = '';
  if (typeof MINERAL_SPEC === 'undefined') return;
  // Walk every mineral in the spec; keep those that have a
  // `supersaturation_<name>` method on the conditions object.
  const byClass = {};
  for (const [name, spec] of Object.entries(MINERAL_SPEC)) {
    const fn = c[`supersaturation_${name}`];
    if (typeof fn !== 'function') continue;
    let sigma;
    try { sigma = fn.call(c); } catch (e) { continue; }
    if (typeof sigma !== 'number' || !isFinite(sigma)) continue;
    const cls = spec.class || 'uncategorized';
    const displayName = _SAT_DISPLAY_NAMES[name]
      || (name.charAt(0).toUpperCase() + name.slice(1));
    if (!byClass[cls]) {
      byClass[cls] = {
        entries: [],
        maxSigma: -Infinity,
        color: spec.class_color || '#888',
      };
    }
    byClass[cls].entries.push({ name, displayName, sigma });
    if (sigma > byClass[cls].maxSigma) byClass[cls].maxSigma = sigma;
  }
  // Order: active classes (any σ ≥ 1) first, sorted by max σ
  // descending; then dormant classes by TOPO_CLASS_ORDER, then
  // alphabetically.
  const orderedClasses = Object.keys(byClass).sort((a, b) => {
    const aActive = byClass[a].maxSigma >= 1;
    const bActive = byClass[b].maxSigma >= 1;
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive) return byClass[b].maxSigma - byClass[a].maxSigma;
    const order = (typeof TOPO_CLASS_ORDER !== 'undefined') ? TOPO_CLASS_ORDER : [];
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  for (const cls of orderedClasses) {
    const group = byClass[cls];
    // Apply filter: drop entries the user is currently hiding.
    const filtered = group.entries.filter(e => {
      const isSuper = e.sigma >= 1.0;
      return isSuper ? _satShowNucleating : _satShowDormant;
    });
    if (!filtered.length) continue;  // class hides entirely if all pills filtered out
    // Sort entries within group by σ descending so the "interesting
    // ones" are visually first.
    filtered.sort((a, b) => b.sigma - a.sigma);
    const isActive = group.maxSigma >= 1;
    const maxLabel = Math.min(group.maxSigma, _SAT_DISPLAY_MAX);
    const meta = isActive
      ? `${filtered.length} · σ max ${maxLabel.toFixed(2)}`
      : `${filtered.length}`;
    const summary = `<summary class="sat-class-summary" data-hl-class="${cls}">`
      + `<span class="sat-class-swatch" style="background:${group.color}"></span>`
      + `<span class="sat-class-name">${cls}</span>`
      + `<span class="sat-class-meta${isActive ? ' is-active' : ''}">${meta}</span>`
      + `</summary>`;
    const pills = filtered.map(e => {
      const isSuper = e.sigma >= 1.0;
      const klass = 'sat-indicator ' + (isSuper ? 'sat-super' : 'sat-under');
      const title = isSuper ? 'Supersaturated — will grow' : `Undersaturated (σ=${e.sigma.toFixed(2)})`;
      // data-hl-mineral lets the panel double as the legend: hover
      // a pill → highlight that mineral on the topo (replaces the
      // legacy classes-tab hover behavior, which only highlighted
      // by class).
      return `<span class="${klass}" data-hl-mineral="${e.name}" title="${title}">${e.displayName} σ=${e.sigma.toFixed(2)}</span>`;
    }).join('');
    // All groups open by default. Filters do the visual reduction
    // now; collapsing groups was the pre-filter solution.
    const groupClass = `sat-class-group${isActive ? ' sat-class-active' : ''}`;
    host.insertAdjacentHTML('beforeend',
      `<details class="${groupClass}" open>${summary}<div class="sat-class-pills">${pills}</div></details>`);
  }
  // One-time wire-up of hover/click delegation on the panel.
  _wireFortressSigmaEvents(host);
}

// Idempotent — wires hover/click on the sigma panel host once. Re-
// rendering replaces innerHTML but keeps the listeners on the
// container. Hover/click on a `.sat-indicator[data-hl-mineral]` or
// `.sat-class-summary[data-hl-class]` drives the topo highlight
// system the same way the legacy classes-tab legend did. Replaces
// `_wireTopoLegendEvents` for the user-facing functionality.
let _satEventsWired = false;
function _wireFortressSigmaEvents(host) {
  if (!host || _satEventsWired) return;
  _satEventsWired = true;
  function targetFromEvent(ev) {
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (pill) return { type: 'mineral', value: pill.dataset.hlMineral };
    const summary = ev.target.closest('.sat-class-summary[data-hl-class]');
    if (summary) return { type: 'class', value: summary.dataset.hlClass };
    return null;
  }
  host.addEventListener('mouseover', (ev) => {
    topoSetLegendHoverTarget(targetFromEvent(ev));
  });
  host.addEventListener('mouseleave', () => {
    topoSetLegendHoverTarget(null);
  });
  host.addEventListener('click', (ev) => {
    const target = targetFromEvent(ev);
    // The `<details>` element handles open/close itself on a click
    // anywhere in <summary>. We add legend-toggle on top, but only
    // for clicks on the summary's interactive children — clicking
    // the disclosure caret area still toggles open/close cleanly.
    if (target) {
      topoToggleLockTarget(target);
      // Don't preventDefault on summary clicks — let <details> do its
      // open/close thing. We still want the lock behavior to apply.
    }
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
