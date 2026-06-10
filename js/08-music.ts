// ============================================================
// js/08-music.ts — looping background music + persisted audio settings
// ============================================================
// Two tracks (boss-supplied 2026-06-09, repo root):
//
//   'Vugg Simulator.mp3' — every TITLE-family screen (title screen, the
//                          New Game menu, the Scenarios picker)
//   'salt-circuit.mp3'   — every BUILDING screen: anything with the wall
//                          preview box (Simulation, Creative, Random,
//                          Zen) plus Library and Record Player
//
// STRIP VIEW is deliberately SILENT: the sonifier owns that room — the
// rocks sing there and the soundtrack steps aside.
//
// CONTEXT MODEL. Navigation calls musicSetContext('title' | 'building' |
// 'silent') — showTitleScreen / openNewGameMenu / openScenariosPicker
// say 'title', switchMode says 'building' (or 'silent' for stripview).
// The engine owns ONE reused <audio> element and swaps src only when the
// target track actually changes, so title → New Game → Scenarios doesn't
// restart the song, and neither does Creative → Library → Record Player.
// Tracks loop natively (audio.loop).
//
// SETTINGS. {enabled, volume} persist under localStorage
// 'vugg-settings-v1'. The stored object is a settings ROOT — music lives
// at .music so future settings (font scale, palette, …) sit beside it
// in the same key instead of sprawling new keys.
//
// AUTOPLAY. Browsers refuse audio before the first user gesture. Every
// failed play() arms a one-shot pointerdown/keydown unlock that retries
// the CURRENT context — the title song starts on the first click or
// keypress, and a context that changed while locked plays the right
// track, not the stale one.
//
// jsdom-SAFE: tests have no real Audio playback — every entry point
// guards, and play() rejections/throws are swallowed into the unlock
// path. SIM-NEUTRAL: no engine code touched, no RNG, no baselines.

const _MUSIC_TRACKS: Record<string, string> = {
  title: 'Vugg Simulator.mp3',
  building: 'salt-circuit.mp3',
};

const _VUGG_SETTINGS_KEY = 'vugg-settings-v1';

// Module state. _musicContext is what navigation last asked for;
// _musicApply() reconciles the audio element to (context × settings).
let _musicContext: string = 'silent';
let _musicAudio: HTMLAudioElement | null = null;
let _musicUnlockArmed = false;

// VOLUME PATH (boss bug report 2026-06-10: "the volume slider doesn't
// work"). HTMLMediaElement.volume is a SILENT NO-OP on iOS/iPadOS (the
// setter is hardware-locked) and unreliable in a few other embeds — the
// element kept playing at full blast while the slider, the stored
// setting, and the % label all updated correctly. The fix is the same
// trick the strip sonifier uses: route the element through a Web Audio
// GainNode and set LOUDNESS on the gain, which works everywhere.
// The graph is wired on the FIRST USER GESTURE (never earlier: a
// MediaElementSource captures the element's output, and an AudioContext
// created without a gesture sits 'suspended' — wiring early would
// SILENCE autoplay-allowed playback until the first click). Until the
// gesture, element.volume carries loudness (correct on desktop); after
// it, gain owns loudness and element.volume pins to 1.0.
// createMediaElementSource is once-per-element — _musicGraphWired guards.
let _musicCtx: any = null;
let _musicGain: any = null;
let _musicGraphWired = false;

function _musicWireGraphOnGesture(): void {
  if (_musicGraphWired) return;
  if (!_musicAudio) return;  // stays armed; retries on the next gesture
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  try {
    _musicCtx = new AC();
    const src = _musicCtx.createMediaElementSource(_musicAudio);
    _musicGain = _musicCtx.createGain();
    src.connect(_musicGain);
    _musicGain.connect(_musicCtx.destination);
    _musicGraphWired = true;
    _musicGain.gain.value = musicGetSettings().volume;
    _musicAudio.volume = 1.0;  // gain owns loudness from here on
    if (_musicCtx.state === 'suspended') _musicCtx.resume().catch(() => { /* retried in _musicApply */ });
    document.removeEventListener('pointerdown', _musicWireGraphOnGesture);
    document.removeEventListener('keydown', _musicWireGraphOnGesture);
  } catch (_) { /* element.volume fallback stays in charge */ }
}

// Arm the graph-wiring gesture hook at load (separate from the autoplay
// unlock — that one is one-shot per blocked play; this one persists
// until the graph is wired).
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', _musicWireGraphOnGesture);
  document.addEventListener('keydown', _musicWireGraphOnGesture);
}

// Debug/probe surface — lets the preview harness and future field
// debugging see which volume path is live without reaching closures.
function musicDebugState(): any {
  return {
    context: _musicContext,
    graphWired: _musicGraphWired,
    ctxState: _musicCtx ? _musicCtx.state : null,
    gainValue: _musicGain ? _musicGain.gain.value : null,
    elementVolume: _musicAudio ? _musicAudio.volume : null,
    playing: _musicAudio ? !_musicAudio.paused : false,
  };
}

// ---- settings (root object shared by future settings groups) ----

function _vuggSettingsLoad(): any {
  try {
    const raw = localStorage.getItem(_VUGG_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* corrupt / unavailable → defaults */ }
  return {};
}

function _vuggSettingsSave(root: any): void {
  try { localStorage.setItem(_VUGG_SETTINGS_KEY, JSON.stringify(root)); } catch (_) { /* quota / private mode */ }
}

function musicGetSettings(): { enabled: boolean, volume: number } {
  const root = _vuggSettingsLoad();
  const m = root.music || {};
  return {
    enabled: (m.enabled !== undefined) ? !!m.enabled : true,
    // Default 0.25 (boss 2026-06-10: half the original 0.5 — the music
    // sits under the game, not on top of it).
    volume: (typeof m.volume === 'number' && isFinite(m.volume)) ? Math.max(0, Math.min(1, m.volume)) : 0.25,
  };
}

function musicSetEnabled(on: boolean): void {
  const root = _vuggSettingsLoad();
  root.music = Object.assign({}, root.music, { enabled: !!on });
  _vuggSettingsSave(root);
  _musicApply();
}

function musicSetVolume(v: number): void {
  const vol = Math.max(0, Math.min(1, Number(v) || 0));
  const root = _vuggSettingsLoad();
  root.music = Object.assign({}, root.music, { volume: vol });
  _vuggSettingsSave(root);
  // Gain owns loudness once the graph is wired (iOS ignores
  // element.volume); element.volume is the pre-gesture desktop path.
  if (_musicGraphWired && _musicGain) _musicGain.gain.value = vol;
  else if (_musicAudio) _musicAudio.volume = vol;
}

// ---- context + playback ----

// Which track (filename) should be sounding for a context, or null for
// silence. Pure — the test suite pins the boss's room→song map here.
function musicTrackForContext(ctx: string): string | null {
  return _MUSIC_TRACKS[ctx] || null;
}

function musicSetContext(ctx: string): void {
  _musicContext = ctx;
  _musicApply();
}

function _musicApply(): void {
  if (typeof Audio === 'undefined') return;  // jsdom / headless: no-op
  const settings = musicGetSettings();
  const track = settings.enabled ? musicTrackForContext(_musicContext) : null;

  if (!track) {
    if (_musicAudio && !_musicAudio.paused) {
      try { _musicAudio.pause(); } catch (_) { /* jsdom */ }
    }
    return;
  }

  if (!_musicAudio) {
    _musicAudio = new Audio();
    _musicAudio.loop = true;
  }
  if (_musicGraphWired && _musicGain) {
    _musicGain.gain.value = settings.volume;
    _musicAudio.volume = 1.0;
    // The wired graph only sounds while its context runs; resume is a
    // no-op when already running and queues behind a gesture otherwise.
    if (_musicCtx && _musicCtx.state === 'suspended') _musicCtx.resume().catch(() => {});
  } else {
    _musicAudio.volume = settings.volume;
  }

  // Swap src only on a real track change — same-context renavigation
  // (title → New Game) must not restart the song.
  const want = encodeURI(track);
  if (!_musicAudio.src || !_musicAudio.src.endsWith(want)) {
    _musicAudio.src = track;
  }
  if (_musicAudio.paused) {
    let p: any;
    try { p = _musicAudio.play(); } catch (_) { _musicArmUnlock(); return; }
    if (p && typeof p.catch === 'function') p.catch(() => _musicArmUnlock());
  }
}

// BOOT: the page always opens on the title screen, but it does so via
// static HTML — showTitleScreen() is NOT called at load, so without
// this the title theme would only start after the first navigation.
// (Autoplay is blocked pre-gesture anyway; this arms the unlock so the
// song starts on the first click/keypress.)
if (typeof document !== 'undefined' && document.body) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => musicSetContext('title'), { once: true });
  } else {
    musicSetContext('title');
  }
}

// One-shot gesture unlock: retry the CURRENT context on the first
// pointerdown/keydown after a blocked play(). Re-arms itself only via
// the next blocked play, so it never leaks listeners.
function _musicArmUnlock(): void {
  if (_musicUnlockArmed || typeof document === 'undefined') return;
  _musicUnlockArmed = true;
  const retry = () => {
    _musicUnlockArmed = false;
    document.removeEventListener('pointerdown', retry);
    document.removeEventListener('keydown', retry);
    _musicApply();
  };
  document.addEventListener('pointerdown', retry, { once: true });
  document.addEventListener('keydown', retry, { once: true });
}
