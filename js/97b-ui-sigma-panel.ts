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

// The conditions object the panel last rendered — the nucleation hover
// popover evaluates its red/green chips against THIS, not the live sim,
// so hovering during a topo replay scrub shows that moment's truth
// (matching how the pills themselves rewind — v66 replay-aware).
let _satLastConditions = null;

function _renderFortressSigmaGroups(c, host) {
  if (!host) return;
  _satLastConditions = c;
  if (typeof _satHoverHide === 'function') _satHoverHide(); // re-render orphans any floating popover
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
      // data-hl-mineral lets the panel double as the legend: hover
      // a pill → highlight that mineral on the topo (replaces the
      // legacy classes-tab hover behavior, which only highlighted
      // by class). The native title tooltip is gone (2026-07-08) —
      // the nucleation hover popover carries the state now, and a
      // browser tooltip would fight it.
      return `<span class="${klass}" data-hl-mineral="${e.name}" data-sigma="${e.sigma.toFixed(2)}">${e.displayName} σ=${e.sigma.toFixed(2)}</span>`;
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

// ============================================================
// NUCLEATION HOVER POPOVER (boss ask 2026-07-08)
// ============================================================
// Hovering a mineral pill shows WHY it is (or isn't) nucleating: the
// Library card's recipe rows rendered as red/green condition chips,
// evaluated against the conditions the panel last rendered (live play
// or a replay-scrub snapshot alike). Boss's actinolite sketch:
//
//   T window        [200–700°C (optimum 300–500)]
//   Requires        [Ca ≥60][Mg ≥30][Fe ≥30][SiO2 ≥250]
//   Traces          [Cr][Mn]
//   Acid dissolution [pH ≥ 5]
//
// The acid chip is deliberately REVERSED from the Library's wording
// (dissolves at pH < 5): here you're reading survival, not death —
// the chip states the condition under which the crystal keeps its
// faces, green when the broth is safe.

// Pure builder — returns [{label, chips: [{text, met, note?}]}] so
// tests can assert the red/green logic without any DOM. `c` needs only
// plain-readable `temperature` and `fluid` (replay snapshots qualify).
function _nucleationHoverGroups(name, c) {
  const spec = (typeof MINERAL_SPEC !== 'undefined') ? MINERAL_SPEC[name] : null;
  if (!spec || !c || !c.fluid) return [];
  const f = c.fluid;
  const groups = [];

  // T window — one chip, green while T sits inside the growth window.
  if (Array.isArray(spec.T_range_C)) {
    const [lo, hi] = spec.T_range_C;
    const opt = Array.isArray(spec.T_optimum_C) ? ` (optimum ${spec.T_optimum_C[0]}–${spec.T_optimum_C[1]})` : '';
    groups.push({
      label: 'T window',
      chips: [{
        text: `${lo}–${hi}°C${opt}`,
        met: typeof c.temperature === 'number' && c.temperature >= lo && c.temperature <= hi,
      }],
    });
  }

  // Requires — one chip per ingredient floor, green when the broth
  // carries at least that much. Non-numeric spec values (rare) chip as
  // presence checks.
  if (spec.required_ingredients && Object.keys(spec.required_ingredients).length) {
    groups.push({
      label: 'Requires',
      chips: Object.entries(spec.required_ingredients).map(([k, v]) => (
        (typeof v === 'number')
          ? { text: `${k} ≥${v}`, met: (typeof f[k] === 'number' ? f[k] : 0) >= v }
          : { text: k, met: (typeof f[k] === 'number' ? f[k] : 0) > 0 }
      )),
    });
  }

  // Traces — optional chromophores; green means the broth carries the
  // trace so grown zones will pick it up. The spec's flavor text rides
  // as a chip-level tooltip.
  if (spec.trace_ingredients && Object.keys(spec.trace_ingredients).length) {
    groups.push({
      label: 'Traces',
      chips: Object.entries(spec.trace_ingredients).map(([k, v]) => ({
        text: k,
        met: (typeof f[k] === 'number' ? f[k] : 0) > 0,
        note: (typeof v === 'string') ? v : '',
      })),
    });
  }

  // Acid dissolution — REVERSED into survival conditions (see header).
  // Library sources (95-ui-library acidText): acid_dissolution.pH_threshold
  // / pH_dissolution_below = dissolves BELOW → chip `pH ≥ X`;
  // pH_dissolution_above = dissolves ABOVE → chip `pH ≤ Y`.
  {
    const below = (spec.acid_dissolution && spec.acid_dissolution.pH_threshold != null)
      ? spec.acid_dissolution.pH_threshold
      : (spec.pH_dissolution_below != null ? spec.pH_dissolution_below : null);
    const above = (spec.pH_dissolution_above != null) ? spec.pH_dissolution_above : null;
    const pH = (typeof f.pH === 'number') ? f.pH : null;
    const chips = [];
    if (below != null) chips.push({ text: `pH ≥ ${below}`, met: pH != null && pH >= below });
    if (above != null) chips.push({ text: `pH ≤ ${above}`, met: pH != null && pH <= above });
    if (!chips.length && spec.acid_dissolution) {
      // Dict present but no numeric threshold (HF-only / rehydration-
      // only species — the Library shows 'resistant'). Always green:
      // no broth pH endangers it.
      chips.push({ text: 'resistant', met: true });
    }
    if (chips.length) groups.push({ label: 'Acid dissolution', chips });
  }

  return groups;
}

function _nucleationHoverHTML(name, c) {
  const groups = _nucleationHoverGroups(name, c);
  if (!groups.length) return '';
  const displayName = (typeof _SAT_DISPLAY_NAMES !== 'undefined' && _SAT_DISPLAY_NAMES[name])
    || (name.charAt(0).toUpperCase() + name.slice(1));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let html = `<div class="nuc-pop-head">${esc(displayName)}</div>`;
  for (const g of groups) {
    html += `<div class="nuc-pop-label">${esc(g.label)}</div>`;
    html += `<div class="nuc-pop-chips">` + g.chips.map(ch =>
      `<span class="nuc-chip ${ch.met ? 'met' : 'unmet'}"${ch.note ? ` title="${esc(ch.note)}"` : ''}>${esc(ch.text)}</span>`
    ).join('') + `</div>`;
  }
  return html;
}

// Singleton popover element, body-mounted so panel scroll/overflow
// can't clip it. pointer-events:none — it never steals the hover.
function _satHoverEl() {
  let el = document.getElementById('sat-hover-pop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sat-hover-pop';
    el.className = 'sat-hover-pop';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function _satHoverShowForPill(pill) {
  const name = pill.dataset.hlMineral;
  const c = _satLastConditions
    || ((typeof fortressSim !== 'undefined' && fortressSim) ? fortressSim.conditions : null);
  if (!name || !c) return;
  const html = _nucleationHoverHTML(name, c);
  if (!html) { _satHoverHide(); return; }
  const el = _satHoverEl();
  el.innerHTML = html;
  el.style.display = 'block';
  // Position beside the pill; flip left/up when the viewport says no.
  const r = pill.getBoundingClientRect();
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let x = r.right + 10;
  if (x + pw > window.innerWidth - 8) x = Math.max(8, r.left - pw - 10);
  let y = r.top;
  if (y + ph > window.innerHeight - 8) y = Math.max(8, window.innerHeight - ph - 8);
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

function _satHoverHide() {
  const el = document.getElementById('sat-hover-pop');
  if (el) el.style.display = 'none';
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
    // Nucleation popover rides the same delegation: pill → show its
    // recipe chips, anything else under the host → hide.
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (pill) _satHoverShowForPill(pill);
    else _satHoverHide();
  });
  host.addEventListener('mouseleave', () => {
    topoSetLegendHoverTarget(null);
    _satHoverHide();
  });
  // A scroll anywhere (panel column, page) leaves a fixed-position
  // popover floating over the wrong pill — just drop it.
  window.addEventListener('scroll', () => _satHoverHide(), true);
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
