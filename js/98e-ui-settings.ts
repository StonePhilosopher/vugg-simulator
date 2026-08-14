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

type VuggMotionPreference = 'system' | 'reduced';

function displayGetSettings(): { fontScale: number, motion: VuggMotionPreference } {
  const root = (typeof _vuggSettingsLoad === 'function') ? _vuggSettingsLoad() : {};
  const display = root.display || {};
  const allowedScales = [1, 1.25, 1.5];
  return {
    fontScale: allowedScales.includes(display.fontScale) ? display.fontScale : 1,
    motion: display.motion === 'reduced' ? 'reduced' : 'system',
  };
}

function _displayApply(settings = displayGetSettings()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${Math.round(settings.fontScale * 100)}%`;
  document.documentElement.dataset.vuggMotion = settings.motion;
}

function displaySetFontScale(value: number): void {
  const scale = [1, 1.25, 1.5].includes(Number(value)) ? Number(value) : 1;
  const root = (typeof _vuggSettingsLoad === 'function') ? _vuggSettingsLoad() : {};
  root.display = Object.assign({}, root.display, { fontScale: scale });
  if (typeof _vuggSettingsSave === 'function') _vuggSettingsSave(root);
  _displayApply({ ...displayGetSettings(), fontScale: scale });
}

function displaySetMotion(value: string): void {
  const motion: VuggMotionPreference = value === 'reduced' ? 'reduced' : 'system';
  const root = (typeof _vuggSettingsLoad === 'function') ? _vuggSettingsLoad() : {};
  root.display = Object.assign({}, root.display, { motion });
  if (typeof _vuggSettingsSave === 'function') _vuggSettingsSave(root);
  _displayApply({ ...displayGetSettings(), motion });
}

function initSettingsUI(): void {
  const btn = document.getElementById('settings-btn');
  const panel = document.getElementById('settings-panel');
  if (!btn || !panel) return;  // harness / stub DOM

  const closeBtn = document.getElementById('settings-close');
  const musicEnabled = document.getElementById('settings-music-enabled') as HTMLInputElement | null;
  const musicVolume = document.getElementById('settings-music-volume') as HTMLInputElement | null;
  const musicVolumePct = document.getElementById('settings-music-volume-pct');
  const textScale = document.getElementById('settings-text-scale') as HTMLSelectElement | null;
  const motion = document.getElementById('settings-motion') as HTMLSelectElement | null;

  // Reflect persisted settings into the controls.
  const syncFromSettings = () => {
    if (typeof musicGetSettings !== 'function') return;
    const s = musicGetSettings();
    if (musicEnabled) musicEnabled.checked = s.enabled;
    if (musicVolume) musicVolume.value = String(Math.round(s.volume * 100));
    if (musicVolumePct) musicVolumePct.textContent = Math.round(s.volume * 100) + '%';
    const display = displayGetSettings();
    if (textScale) textScale.value = String(display.fontScale);
    if (motion) motion.value = display.motion;
    _displayApply(display);
  };

  const setOpen = (open: boolean, restoreFocus = false) => {
    panel.style.display = open ? 'block' : 'none';
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      syncFromSettings();
      if (closeBtn instanceof HTMLElement) closeBtn.focus();
    } else if (restoreFocus && btn instanceof HTMLElement) {
      btn.focus();
    }
  };

  btn.addEventListener('click', () => setOpen(panel.style.display === 'none'));
  if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false, true));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.style.display === 'none') return;
    event.preventDefault();
    setOpen(false, true);
  });

  if (musicEnabled) musicEnabled.addEventListener('change', () => {
    if (typeof musicSetEnabled === 'function') musicSetEnabled(musicEnabled.checked);
  });
  // 'input' fires per-drag-tick on every modern browser; 'change' is the
  // end-of-drag fallback for the odd embed that only fires the latter.
  const onVolume = () => {
    const pct = Number(musicVolume!.value) || 0;
    if (musicVolumePct) musicVolumePct.textContent = pct + '%';
    if (typeof musicSetVolume === 'function') musicSetVolume(pct / 100);
  };
  if (musicVolume) {
    musicVolume.addEventListener('input', onVolume);
    musicVolume.addEventListener('change', onVolume);
  }
  if (textScale) textScale.addEventListener('change', () => {
    displaySetFontScale(Number(textScale.value));
  });
  if (motion) motion.addEventListener('change', () => {
    displaySetMotion(motion.value);
  });

  syncFromSettings();
  setOpen(false);
}

// Apply persisted presentation preferences before the panel first opens.
// These settings affect CSS only, never the geological model.
_displayApply();

// Auto-init on DOM ready in the browser; harness DOMs without the panel
// no-op inside initSettingsUI.
if (typeof document !== 'undefined' && document.body) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsUI, { once: true });
  } else {
    initSettingsUI();
  }
}
