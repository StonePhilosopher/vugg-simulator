// ============================================================
// js/98e-ui-settings.ts — the ⚙ settings overlay
// ============================================================
// Wires the fixed settings button + panel declared in index.html's body
// (v-music 2026-06-09). Today the panel holds the MUSIC controls (enable
// toggle + volume); it is intentionally a general settings surface —
// future settings (font scale, palette, reduced motion, …) add rows here
// and persist beside music:{} in the same 'vugg-settings-v1' root (see
// js/08-music.ts for the storage shape).
//
// Auto-inits on DOM ready, same pattern as 99k's initStripView. Tests /
// harness without the panel elements skip cleanly.

function initSettingsUI(): void {
  const btn = document.getElementById('settings-btn');
  const panel = document.getElementById('settings-panel');
  if (!btn || !panel) return;  // harness / stub DOM

  const closeBtn = document.getElementById('settings-close');
  const musicEnabled = document.getElementById('settings-music-enabled') as HTMLInputElement | null;
  const musicVolume = document.getElementById('settings-music-volume') as HTMLInputElement | null;
  const musicVolumePct = document.getElementById('settings-music-volume-pct');

  // Reflect persisted settings into the controls.
  const syncFromSettings = () => {
    if (typeof musicGetSettings !== 'function') return;
    const s = musicGetSettings();
    if (musicEnabled) musicEnabled.checked = s.enabled;
    if (musicVolume) musicVolume.value = String(Math.round(s.volume * 100));
    if (musicVolumePct) musicVolumePct.textContent = Math.round(s.volume * 100) + '%';
  };

  btn.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (!open) syncFromSettings();
  });
  if (closeBtn) closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });

  if (musicEnabled) musicEnabled.addEventListener('change', () => {
    if (typeof musicSetEnabled === 'function') musicSetEnabled(musicEnabled.checked);
  });
  if (musicVolume) musicVolume.addEventListener('input', () => {
    const pct = Number(musicVolume.value) || 0;
    if (musicVolumePct) musicVolumePct.textContent = pct + '%';
    if (typeof musicSetVolume === 'function') musicSetVolume(pct / 100);
  });

  syncFromSettings();
}

// Auto-init on DOM ready in the browser; harness DOMs without the panel
// no-op inside initSettingsUI.
if (typeof document !== 'undefined' && document.body) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsUI, { once: true });
  } else {
    initSettingsUI();
  }
}
