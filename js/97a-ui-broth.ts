// ============================================================
// js/97a-ui-broth.ts — UI — Broth control panel
// ============================================================
// SCRIPT-mode TS: top-level declarations stay global for cross-file use.

let brothSnapshots = [];

function toggleBrothPanel() {
  const toggle = document.getElementById('broth-toggle');
  const body = document.getElementById('broth-body');
  toggle.classList.toggle('open');
  body.classList.toggle('open');
}

// Map slider ids to canonical sim state. Fluid entries are generated from the
// same registry as setup, so setup/live/save coverage cannot drift apart.
const BROTH_MAP: Record<string, any> = {
  temp: {
    path: 'temperature',
    get: () => fortressSim.conditions.temperature,
    set: v => { fortressSim.conditions.temperature = v; },
    fmt: v => v.toFixed(1) + ' °C',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  pressure: {
    path: 'pressure',
    get: () => fortressSim.conditions.pressure,
    set: v => { fortressSim.conditions.pressure = clampFluidPressureKbar(v); },
    fmt: v => v.toFixed(3) + ' kbar fluid',
    parse: v => parseFloat(v) / 100,
    toSlider: v => v * 100,
  },
  confining_pressure: {
    path: 'wall.confining_pressure_kbar',
    get: () => fortressSim.conditions.wall.confining_pressure_kbar,
    set: v => {
      fortressSim.conditions.wall.confining_pressure_kbar = Number.isFinite(v)
        ? Math.max(0.01, v) : null;
    },
    fmt: v => Number.isFinite(v) ? v.toFixed(2) + ' kbar rock' : 'unspecified',
    parse: v => parseFloat(v) / 100,
    // An HTML range cannot display null. Park its thumb at the neutral setup
    // default, but keep the readout explicit and do not write that value into
    // physics until the player actually emits an input event.
    toSlider: v => Number.isFinite(v) ? v * 100 : 150,
  },
  flow: {
    path: 'flow_rate',
    get: () => fortressSim.conditions.flow_rate,
    set: v => { fortressSim.conditions.flow_rate = v; },
    fmt: v => v.toFixed(1),
    parse: v => parseFloat(v) / 10,
    toSlider: v => v * 10,
  },
  water: {
    path: 'fluid_surface_height_percent',
    get: () => {
      const surface = fortressSim.conditions.fluid_surface_height_mm;
      return surface == null ? 100 : 100 * surface / fortressSim.wall_state.ring_count;
    },
    set: v => {
      const pct = Math.max(0, Math.min(100, v));
      fortressSim.conditions.fluid_surface_height_mm = pct >= 100
        ? null
        : fortressSim.wall_state.ring_count * pct / 100;
    },
    fmt: v => v.toFixed(1) + '% cavity height',
    parse: v => parseFloat(v) / 10,
    toSlider: v => v * 10,
  },
  porosity: {
    path: 'porosity',
    get: () => fortressSim.conditions.porosity,
    set: v => { fortressSim.conditions.porosity = Math.max(0, Math.min(1, v)); },
    fmt: v => (v * 100).toFixed(0) + '%',
    parse: v => parseFloat(v) / 100,
    toSlider: v => v * 100,
  },
  cooling: {
    path: 'wall.cooling_rate',
    get: () => fortressSim.conditions.wall.cooling_rate,
    set: v => { fortressSim.conditions.wall.cooling_rate = Math.max(0, v); },
    fmt: v => v.toFixed(1) + ' °C/step',
    parse: v => parseFloat(v) / 10,
    toSlider: v => v * 10,
  },
  reactivity: {
    path: 'wall.reactivity',
    get: () => fortressSim.conditions.wall.reactivity,
    set: v => { fortressSim.conditions.wall.reactivity = Math.max(0, v); },
    fmt: v => v.toFixed(1) + '×',
    parse: v => parseFloat(v) / 10,
    toSlider: v => v * 10,
  },
  diameter: {
    path: 'wall.vug_diameter_mm',
    get: () => fortressSim.conditions.wall.vug_diameter_mm,
    set: v => {
      fortressSim.conditions.wall.vug_diameter_mm = Math.max(1, v);
      fortressSim.wall_state.updateDiameter(fortressSim.conditions.wall.vug_diameter_mm);
    },
    fmt: v => v.toFixed(0) + ' mm',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  thickness: {
    path: 'wall.thickness_mm',
    get: () => fortressSim.conditions.wall.thickness_mm,
    set: v => { fortressSim.conditions.wall.thickness_mm = Math.max(0, v); },
    fmt: v => v.toFixed(0) + ' mm',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  wall_fe: {
    path: 'wall.wall_Fe_ppm',
    get: () => fortressSim.conditions.wall.wall_Fe_ppm,
    set: v => { fortressSim.conditions.wall.wall_Fe_ppm = Math.max(0, v); },
    fmt: v => v.toFixed(0) + ' ppm',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  wall_mn: {
    path: 'wall.wall_Mn_ppm',
    get: () => fortressSim.conditions.wall.wall_Mn_ppm,
    set: v => { fortressSim.conditions.wall.wall_Mn_ppm = Math.max(0, v); },
    fmt: v => v.toFixed(0) + ' ppm',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  wall_mg: {
    path: 'wall.wall_Mg_ppm',
    get: () => fortressSim.conditions.wall.wall_Mg_ppm,
    set: v => { fortressSim.conditions.wall.wall_Mg_ppm = Math.max(0, v); },
    fmt: v => v.toFixed(0) + ' ppm',
    parse: v => parseFloat(v),
    toSlider: v => v,
  },
  diffusion: {
    path: 'inter_ring_diffusion_rate',
    get: () => fortressSim.inter_ring_diffusion_rate,
    set: v => {
      const rate = Math.max(0, Math.min(1, v));
      fortressSim.inter_ring_diffusion_rate = rate;
      fortressSim.conditions.wall.inter_ring_diffusion_rate = rate;
    },
    fmt: v => v.toFixed(2) + '/step',
    parse: v => parseFloat(v) / 100,
    toSlider: v => v * 100,
  },
  gamma: {
    path: 'wall.gamma_host',
    get: () => fortressSim.conditions.wall.gamma_host,
    set: v => { fortressSim.conditions.wall.gamma_host = Math.max(0, Math.min(1, v)); },
    fmt: v => v.toFixed(2),
    parse: v => parseFloat(v) / 100,
    toSlider: v => v * 100,
  },
  pco2: {
    path: '_scenario.atmospheric_pCO2_bar',
    get: () => fortressSim.conditions._scenario?.atmospheric_pCO2_bar ?? 4.2e-4,
    set: v => {
      fortressSim.conditions._scenario ||= {};
      fortressSim.conditions._scenario.atmospheric_pCO2_bar = v;
    },
    fmt: v => v.toExponential(2) + ' bar',
    parse: v => Math.pow(10, parseFloat(v) / 100),
    toSlider: v => Math.log10(Math.max(1e-6, v)) * 100,
  },
  host: {
    path: 'wall.composition',
    get: () => fortressSim.conditions.wall.composition,
    set: v => {
      fortressSim.conditions.wall.composition = v;
      // WallState is the renderer/mesh mirror of the same physical host.
      // Keep it synchronized so the display does not claim the old lithology
      // after a live Creative-mode host change.
      if (fortressSim.wall_state) fortressSim.wall_state.composition = v;
    },
    fmt: v => String(v),
    parse: v => String(v),
    toSlider: v => String(v),
    valid: v => typeof v === 'string' && v.length > 0,
  },
  open_atmosphere: {
    path: '_scenario.open_to_atmosphere',
    get: () => !!fortressSim.conditions._scenario?.open_to_atmosphere,
    set: v => {
      fortressSim.conditions._scenario ||= {};
      fortressSim.conditions._scenario.open_to_atmosphere = !!v;
    },
    fmt: v => v ? 'open' : 'closed',
    parse: v => String(v) === '1',
    toSlider: v => v ? '1' : '0',
    valid: v => typeof v === 'boolean',
  },
  open_system: {
    path: 'wall.open_system',
    get: () => !!fortressSim.conditions.wall.open_system,
    set: v => { fortressSim.conditions.wall.open_system = !!v; },
    fmt: v => v ? 'open' : 'finite cavity',
    parse: v => String(v) === '1',
    toSlider: v => v ? '1' : '0',
    valid: v => typeof v === 'boolean',
  },
  graphitic: {
    path: 'wall.graphitic',
    get: () => !!fortressSim.conditions.wall.graphitic,
    set: v => { fortressSim.conditions.wall.graphitic = !!v; },
    fmt: v => v ? 'graphitic' : 'non-graphitic',
    parse: v => String(v) === '1',
    toSlider: v => v ? '1' : '0',
    valid: v => typeof v === 'boolean',
  },
  thermal_pulses: {
    path: 'wall.thermal_pulses',
    get: () => !!fortressSim.conditions.wall.thermal_pulses,
    set: v => { fortressSim.conditions.wall.thermal_pulses = !!v; },
    fmt: v => v ? 'enabled' : 'disabled',
    parse: v => String(v) === '1',
    toSlider: v => v ? '1' : '0',
    valid: v => typeof v === 'boolean',
  },
  sulfur_explicit: {
    path: 'fluid.sulfurPoolsExplicit',
    get: () => !!fortressSim.conditions.fluid.sulfurPoolsExplicit,
    set: v => {
      const fluid = fortressSim.conditions.fluid;
      if (v) ensureExplicitSulfurPools(fluid, fortressSim.conditions.temperature);
      else fluid.sulfurPoolsExplicit = false;
    },
    fmt: v => v ? 'explicit reservoirs' : 'legacy bulk proxy',
    parse: v => String(v) === '1',
    toSlider: v => v ? '1' : '0',
    valid: v => typeof v === 'boolean',
  },
  native_sulfur_pathway: {
    path: 'fluid.nativeSulfurPathway',
    get: () => fortressSim.conditions.fluid.nativeSulfurPathway || 'none',
    set: v => {
      const fluid = fortressSim.conditions.fluid;
      fluid.nativeSulfurPathway = v === 'none' ? null : v;
      if (v !== 'none') fluid.sulfurPoolsExplicit = true;
    },
    fmt: v => String(v || 'none').replaceAll('_', ' '),
    parse: v => String(v),
    toSlider: v => String(v || 'none'),
    valid: v => ['none', 'oxidative_interface', 'oxidative_closed_fluid', 'anaerobic_microbial_inherited'].includes(String(v)),
  },
};

for (const [prop, control] of Object.entries(CREATIVE_CHEMISTRY_CONTROLS)) {
  const decimals = control.decimals ?? 0;
  BROTH_MAP[control.liveKey] = {
    path: `fluid.${prop}`,
    get: () => fortressSim.conditions.fluid[prop],
    set: v => {
      const fluid = fortressSim.conditions.fluid;
      fluid[prop] = v;
      if (prop === 'S_sulfide' || prop === 'S_sulfate' || prop === 'S_elemental') {
        fluid.sulfurPoolsExplicit = true;
        syncExplicitSulfurTotal(fluid);
      } else if (prop === 'S' && fluid.sulfurPoolsExplicit) {
        const dissolvedBefore = Math.max(0, fluid.S_sulfide) + Math.max(0, fluid.S_sulfate);
        if (dissolvedBefore > 0) {
          const scale = Math.max(0, v) / dissolvedBefore;
          fluid.S_sulfide *= scale;
          fluid.S_sulfate *= scale;
        } else {
          fluid.S_sulfide = Math.max(0, v);
        }
        syncExplicitSulfurTotal(fluid);
      }
    },
    fmt: v => `${v.toFixed(decimals)}${control.unit ? ` ${control.unit}` : ''}`,
    parse: v => parseFloat(v) / control.scale,
    toSlider: v => v * control.scale,
    exact: {
      label: control.label,
      unit: control.unit,
      min: control.min,
      max: control.max,
      step: control.step,
      rawMin: control.min * control.scale,
      rawMax: control.max * control.scale,
      rawStep: control.step * control.scale,
    },
  };
}

function _brothExactBounds(key: string, m: any, slider: HTMLInputElement) {
  if (m.exact) return m.exact;
  const rawMin = Number(slider.min);
  const rawMax = Number(slider.max);
  const rawStep = Number(slider.step || 1);
  const min = m.parse(rawMin);
  const max = m.parse(rawMax);
  const next = m.parse(Math.min(rawMax, rawMin + rawStep));
  return {
    label: slider.closest('.broth-slider-row')?.querySelector('label')?.textContent?.trim() || key,
    unit: '',
    min: Math.min(min, max),
    max: Math.max(min, max),
    step: key === 'pco2' ? 'any' : Math.abs(next - min) || 'any',
    rawMin,
    rawMax,
    rawStep,
  };
}

function _brothExactString(value: any, step: number | 'any') {
  if (!Number.isFinite(value)) return '';
  if (step === 'any') return Number(value).toPrecision(8).replace(/(?:\.0+|(?:(\.\d*?)0+))(?=e|$)/, '$1');
  const decimals = Math.min(10, Math.max(0, Math.ceil(-Math.log10(step))));
  return Number(value).toFixed(decimals);
}

function installBrothExactInputs() {
  for (const [key, mEntry] of Object.entries(BROTH_MAP)) {
    const m = mEntry as any;
    const id = 'broth-' + key;
    const sliders = Array.from(document.querySelectorAll(`input[type="range"][id="${id}"]`)) as HTMLInputElement[];
    const byId = document.getElementById(id);
    if (sliders.length === 0 && byId instanceof HTMLInputElement && byId.type === 'range') sliders.push(byId);
    for (const slider of sliders) {
      if (m.exact) {
        // Chemistry bounds are canonical registry data. This also eliminates the
        // old live/setup range drift (for example Fe 200 vs 500 ppm).
        slider.min = String(m.exact.rawMin);
        slider.max = String(m.exact.rawMax);
        slider.step = String(m.exact.rawStep);
      }
      const bounds = _brothExactBounds(key, m, slider);
      m._exactBounds = bounds;
      const exactId = id + '-exact';
      const sibling = slider.nextElementSibling;
      const rowExact = slider.closest('.broth-slider-row')?.querySelector(`input[id="${exactId}"]`);
      const exact = sibling instanceof HTMLInputElement && sibling.id === exactId
        ? sibling
        : rowExact instanceof HTMLInputElement
          ? rowExact
          : document.createElement('input');
      const isNew = !exact.isConnected;
      exact.type = 'number';
      exact.id = exactId;
      exact.className = 'creative-exact-input broth-exact-input';
      exact.inputMode = bounds.step === 1 ? 'numeric' : 'decimal';
      exact.min = String(bounds.min);
      exact.max = String(bounds.max);
      exact.step = String(bounds.step);
      exact.setAttribute('aria-label', `Exact ${bounds.label}${bounds.unit ? ` (${bounds.unit})` : ''}`);
      exact.title = `Enter the exact physical value${bounds.unit ? ` in ${bounds.unit}` : ''}`;
      if (isNew) slider.insertAdjacentElement('afterend', exact);
      if (exact.dataset.brothExactBound !== '1') {
        exact.dataset.brothExactBound = '1';
        exact.addEventListener('change', () => setBrothExactValue(key, exact.value));
        exact.addEventListener('keydown', event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          setBrothExactValue(key, exact.value);
          exact.blur();
        });
      }
    }
  }
}

function setBrothExactValue(key: string, exactText: string) {
  if (!fortressSim || !fortressActive) return;
  const m = BROTH_MAP[key];
  const exact = document.getElementById('broth-' + key + '-exact') as HTMLInputElement | null;
  const value = Number(exactText);
  const bounds = m?._exactBounds;
  if (!m || !Number.isFinite(value) || !bounds) {
    if (exact) exact.value = _brothExactString(m?.get?.(), bounds?.step ?? 'any');
    return;
  }
  const clamped = Math.max(bounds.min, Math.min(bounds.max, value));
  const sliderValue = m.toSlider ? m.toSlider(clamped) : clamped;
  setBrothValue(key, String(sliderValue));
  syncBrothSliders();
}

function filterBrothControls(query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const groups = Array.from(document.querySelectorAll('#broth-body .broth-group')) as HTMLElement[];
  for (const group of groups) {
    const label = group.querySelector('.broth-group-label')?.textContent?.toLocaleLowerCase() || '';
    const groupMatch = words.length > 0 && words.every(word => label.includes(word));
    const rows = Array.from(group.querySelectorAll('.broth-slider-row')) as HTMLElement[];
    let shown = 0;
    for (const row of rows) {
      const haystack = `${row.textContent || ''} ${row.title || ''}`.toLocaleLowerCase();
      const match = words.length === 0 || groupMatch || words.every(word => haystack.includes(word));
      row.hidden = !match;
      if (match) shown++;
    }
    group.hidden = words.length > 0 && rows.length > 0 && shown === 0;
  }
}

// Only actual player edits belong in the event-sourced save. Synchronizing the
// UI from the sim is an observer operation and must never become a geological
// write-back path.
let _brothPendingPlayerChanges: Record<string, string> = {};

function _isBrothValueValid(mapping, value) {
  return mapping?.valid ? !!mapping.valid(value) : Number.isFinite(value);
}

function _consumeBrothPlayerChanges() {
  const out = _brothPendingPlayerChanges;
  _brothPendingPlayerChanges = {};
  return out;
}

function _peekBrothPlayerChanges() {
  return Object.assign({}, _brothPendingPlayerChanges);
}

function _clearBrothPlayerChanges() {
  _brothPendingPlayerChanges = {};
}

function setBrothValue(key, sliderVal) {
  if (!fortressSim || !fortressActive) return;
  const m = BROTH_MAP[key];
  if (!m) return;
  const realVal = m.parse(sliderVal);
  if (!_isBrothValueValid(m, realVal)) return;
  m.set(realVal);
  _brothPendingPlayerChanges[key] = String(sliderVal);
  const valueEl = document.getElementById('broth-' + key + '-val');
  if (valueEl) valueEl.textContent = m.fmt(realVal);
  const exact = document.getElementById('broth-' + key + '-exact') as HTMLInputElement | null;
  if (exact) exact.value = _brothExactString(realVal, m._exactBounds?.step ?? 'any');
  updateFortressStatus();
  // Persist the edit even if the player saves or leaves before taking another
  // geological action. The next action still consumes it into that action's
  // event delta, preserving deterministic replay order.
  if (typeof _savePersistActive === 'function') _savePersistActive();
}

function syncBrothSliders() {
  if (!fortressSim) return;
  installBrothExactInputs();
  for (const [key, mEntry] of Object.entries(BROTH_MAP)) {
    const m = mEntry as any;
    const val = m.get();
    const sliderVal = m.toSlider ? m.toSlider(val) : val;
    const slider = document.getElementById('broth-' + key) as HTMLInputElement | null;
    if (slider) {
      // Browsers may visually clamp a value outside an HTML range. This echo is
      // never fed back to physics unless the player emits an input event.
      slider.value = String(sliderVal);
    }
    const valEl = document.getElementById('broth-' + key + '-val');
    if (valEl) valEl.textContent = m.fmt(val);
    const exact = document.getElementById('broth-' + key + '-exact') as HTMLInputElement | null;
    if (exact) exact.value = _brothExactString(val, m._exactBounds?.step ?? 'any');
  }
  if (typeof refreshCreativeGeologyEditors === 'function') refreshCreativeGeologyEditors();
}

function takeBrothSnapshot() {
  if (!fortressSim) return;
  const name = prompt('Name this broth snapshot:', 'Step ' + fortressSim.step);
  if (!name) return;

  const snapshot = { name };
  for (const [key, m] of Object.entries(BROTH_MAP)) snapshot[key] = (m as any).get();
  brothSnapshots.push(snapshot);

  const row = document.getElementById('broth-snapshots');
  const btn = document.createElement('button');
  btn.className = 'broth-preset-btn';
  btn.textContent = name;
  btn.title = 'Restore: ' + name;
  const idx = brothSnapshots.length - 1;
  btn.onclick = () => restoreBrothSnapshot(idx);
  row.appendChild(btn);
}

function restoreBrothSnapshot(idx) {
  if (!fortressSim || !fortressActive) return;
  const snap = brothSnapshots[idx];
  if (!snap) return;
  for (const [key, mEntry] of Object.entries(BROTH_MAP)) {
    const m = mEntry as any;
    if (snap[key] === undefined) continue;
    m.set(snap[key]);
    const sliderValue = m.toSlider ? m.toSlider(snap[key]) : snap[key];
    _brothPendingPlayerChanges[key] = String(sliderValue);
  }
  syncBrothSliders();
  updateFortressStatus();
  if (typeof _savePersistActive === 'function') _savePersistActive();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeZoneModal();
});
