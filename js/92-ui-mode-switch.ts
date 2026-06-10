// ============================================================
// js/92-ui-mode-switch.ts — UI — Mode switching (showTitleScreen)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// MODE SWITCHING
// ============================================================

function showTitleScreen() {
  hideAllMenuAndModePanels();
  document.body.classList.add('title-on');
  const titleScreen = document.getElementById('title-screen');
  if (titleScreen) titleScreen.style.display = 'block';
  idleStop(); // stop any running idle simulation
  if (typeof grooveStop === 'function' && groovePlaying) grooveStop();
  // Going Home tears down any active tutorial overlay + restores
  // hidden Creative-mode controls. No-op if no tutorial running.
  if (typeof endTutorial === 'function') endTutorial();
  currentGameMode = null;
  // Title family → title theme ('Vugg Simulator.mp3'). See js/08-music.ts.
  if (typeof musicSetContext === 'function') musicSetContext('title');
  // Home resets the map: with currentGameMode null, topoActiveSim()
  // returns null even if a fortressSim or randomSim is still alive in
  // memory, so a subsequent topoRender paints the placeholder rather
  // than a stale crystal layout. Belt-and-suspenders for the
  // topoActiveSim fix in 99-renderer-state.ts.
  if (typeof topoRender === 'function') topoRender();
  refreshTitleLoadButton();
}

