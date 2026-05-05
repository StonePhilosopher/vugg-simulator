// ============================================================
// js/97a-ui-broth.ts — UI — Broth control panel
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// BROTH CONTROL PANEL
// ============================================================

let brothSnapshots = [];

function toggleBrothPanel() {
  const toggle = document.getElementById('broth-toggle');
  const body = document.getElementById('broth-body');
  toggle.classList.toggle('open');
  body.classList.toggle('open');
}

// Map slider ids to sim state paths
const BROTH_MAP = {
  temp:  { get: () => fortressSim.conditions.temperature,     set: v => fortressSim.conditions.temperature = v,     fmt: v => v.toFixed(0) + ' °C',  parse: v => parseFloat(v) },
  sio2:  { get: () => fortressSim.conditions.fluid.SiO2,      set: v => fortressSim.conditions.fluid.SiO2 = v,      fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ca:    { get: () => fortressSim.conditions.fluid.Ca,         set: v => fortressSim.conditions.fluid.Ca = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  co3:   { get: () => fortressSim.conditions.fluid.CO3,        set: v => fortressSim.conditions.fluid.CO3 = v,        fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ph:    { get: () => fortressSim.conditions.fluid.pH,         set: v => fortressSim.conditions.fluid.pH = v,         fmt: v => v.toFixed(1),           parse: v => parseFloat(v) / 10, toSlider: v => Math.round(v * 10) },
  fe:    { get: () => fortressSim.conditions.fluid.Fe,         set: v => fortressSim.conditions.fluid.Fe = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  mn:    { get: () => fortressSim.conditions.fluid.Mn,         set: v => fortressSim.conditions.fluid.Mn = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  cu:    { get: () => fortressSim.conditions.fluid.Cu,         set: v => fortressSim.conditions.fluid.Cu = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  zn:    { get: () => fortressSim.conditions.fluid.Zn,         set: v => fortressSim.conditions.fluid.Zn = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  s:     { get: () => fortressSim.conditions.fluid.S,          set: v => fortressSim.conditions.fluid.S = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  f:     { get: () => fortressSim.conditions.fluid.F,          set: v => fortressSim.conditions.fluid.F = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  o2:    { get: () => fortressSim.conditions.fluid.O2,         set: v => fortressSim.conditions.fluid.O2 = v,         fmt: v => v.toFixed(1),           parse: v => parseFloat(v) / 10, toSlider: v => Math.round(v * 10) },
  flow:  { get: () => fortressSim.conditions.flow_rate,        set: v => fortressSim.conditions.flow_rate = v,        fmt: v => v.toFixed(1),           parse: v => parseFloat(v) / 10, toSlider: v => Math.round(v * 10) },
  u:     { get: () => fortressSim.conditions.fluid.U,          set: v => fortressSim.conditions.fluid.U = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  pb:    { get: () => fortressSim.conditions.fluid.Pb,         set: v => fortressSim.conditions.fluid.Pb = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  mo:    { get: () => fortressSim.conditions.fluid.Mo,         set: v => fortressSim.conditions.fluid.Mo = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  al:    { get: () => fortressSim.conditions.fluid.Al,         set: v => fortressSim.conditions.fluid.Al = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  k:     { get: () => fortressSim.conditions.fluid.K,          set: v => fortressSim.conditions.fluid.K = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  na:    { get: () => fortressSim.conditions.fluid.Na,         set: v => fortressSim.conditions.fluid.Na = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  mg:    { get: () => fortressSim.conditions.fluid.Mg,         set: v => fortressSim.conditions.fluid.Mg = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ba:    { get: () => fortressSim.conditions.fluid.Ba,         set: v => fortressSim.conditions.fluid.Ba = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  sr:    { get: () => fortressSim.conditions.fluid.Sr,         set: v => fortressSim.conditions.fluid.Sr = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  cr:    { get: () => fortressSim.conditions.fluid.Cr,         set: v => fortressSim.conditions.fluid.Cr = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  p:     { get: () => fortressSim.conditions.fluid.P,          set: v => fortressSim.conditions.fluid.P = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  as:    { get: () => fortressSim.conditions.fluid.As,         set: v => fortressSim.conditions.fluid.As = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  v:     { get: () => fortressSim.conditions.fluid.V,          set: v => fortressSim.conditions.fluid.V = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  w:     { get: () => fortressSim.conditions.fluid.W,          set: v => fortressSim.conditions.fluid.W = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ag:    { get: () => fortressSim.conditions.fluid.Ag,         set: v => fortressSim.conditions.fluid.Ag = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  bi:    { get: () => fortressSim.conditions.fluid.Bi,         set: v => fortressSim.conditions.fluid.Bi = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  sb:    { get: () => fortressSim.conditions.fluid.Sb,         set: v => fortressSim.conditions.fluid.Sb = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ni:    { get: () => fortressSim.conditions.fluid.Ni,         set: v => fortressSim.conditions.fluid.Ni = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  co:    { get: () => fortressSim.conditions.fluid.Co,         set: v => fortressSim.conditions.fluid.Co = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  b:     { get: () => fortressSim.conditions.fluid.B,          set: v => fortressSim.conditions.fluid.B = v,          fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  li:    { get: () => fortressSim.conditions.fluid.Li,         set: v => fortressSim.conditions.fluid.Li = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  be:    { get: () => fortressSim.conditions.fluid.Be,         set: v => fortressSim.conditions.fluid.Be = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  cl:    { get: () => fortressSim.conditions.fluid.Cl,         set: v => fortressSim.conditions.fluid.Cl = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  te:    { get: () => fortressSim.conditions.fluid.Te,         set: v => fortressSim.conditions.fluid.Te = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  se:    { get: () => fortressSim.conditions.fluid.Se,         set: v => fortressSim.conditions.fluid.Se = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
  ge:    { get: () => fortressSim.conditions.fluid.Ge,         set: v => fortressSim.conditions.fluid.Ge = v,         fmt: v => v.toFixed(0) + ' ppm',  parse: v => parseFloat(v) },
};

function setBrothValue(key, sliderVal) {
  if (!fortressSim || !fortressActive) return;
  const m = BROTH_MAP[key];
  const realVal = m.parse(sliderVal);
  m.set(realVal);
  document.getElementById('broth-' + key + '-val').textContent = m.fmt(realVal);
  // Also update the status bar live
  updateFortressStatus();
}

function syncBrothSliders() {
  if (!fortressSim) return;
  for (const [key, mEntry] of Object.entries(BROTH_MAP)) {
    const m = mEntry as any;
    const val = m.get();
    const sliderVal = m.toSlider ? m.toSlider(val) : Math.round(val);
    const slider = document.getElementById('broth-' + key);
    if (slider) {
      // Clamp to slider range
      const clamped = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), sliderVal));
      slider.value = clamped;
    }
    const valEl = document.getElementById('broth-' + key + '-val');
    if (valEl) valEl.textContent = m.fmt(val);
  }
}

function takeBrothSnapshot() {
  if (!fortressSim) return;
  const name = prompt('Name this broth snapshot:', 'Step ' + fortressSim.step);
  if (!name) return;

  const snapshot = { name };
  for (const [key, m] of Object.entries(BROTH_MAP)) {
    snapshot[key] = m.get();
  }
  brothSnapshots.push(snapshot);

  // Add button to snapshot row
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
  for (const [key, m] of Object.entries(BROTH_MAP)) {
    if (snap[key] !== undefined) m.set(snap[key]);
  }
  syncBrothSliders();
  updateFortressStatus();
}

// Handle Escape key for zone modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeZoneModal();
});

