// ============================================================
// js/70a-tutorial-overlay.ts — events for tutorial overlay
// ============================================================
// Extracted from 70-events.ts. Originally Phase B17 of
// PROPOSAL-MODULAR-REFACTOR; rebuilt as ENGINE v2 for the
// Grand Tour tutorial rework (2026-07-04).
//
// ENGINE v2 — a linear state machine over `tutorial.steps[]` from
// the scenario spec, with THREE trigger types per step:
//
//   { step: N, ... }            — SIM-STEP trigger (legacy, unchanged):
//                                 fires when fortressSim.step reaches N.
//                                 Consecutive due steps fire as a burst;
//                                 only the last one's callout stays
//                                 (authors: one callout per trigger).
//   { action: {...}, ... }      — ACTION trigger: waits for the player
//                                 to actually do a thing. Shape:
//                                   { event: 'click'|'change',   // default 'click'
//                                     selector: '#some-el',      // matched via closest()
//                                     checked: true|false,       // optional checkbox state
//                                     dataset: {mineral:'quartz'},
//                                     within: { selector: '.inv-crystal',
//                                               dataset: {mineral:'topaz'} },
//                                     valueNormalized: 'topaz',
//                                     selectedDataset: {mineral:'barite'} }
//                                                               // optional exact target authority
//   (neither)                   — CONTINUE trigger: advances on the
//                                 callout's Continue button, Enter,
//                                 or Space.
//
// v3.1 PAUSE SEMANTICS: when a fired sim-step's SUCCESSOR is an
// action/continue step, the machine PAUSES on the fired narration as a
// pseudo-continue (Continue ⏎ / Enter / Space) instead of letting the
// trailing step supersede it. Pre-v3.1 the fired callout never even
// painted (the rAF renderedIdx guard killed it before first frame) —
// the Grand Tour's step:9 temperature beat and Collecting's step:70
// pocket-is-quiet beat were both invisible. Authors may now freely
// follow a `step: N` beat with an action/continue beat; the narration
// costs one Continue press.
//
// Optional per-step fields:
//   anchor, side, text          — as before (anchor falls back to
//                                 #topo-panel then body if missing,
//                                 so a bad selector can never stall
//                                 the machine invisibly)
//   hint: '...'                 — small italic line under the text
//                                 (action steps get a default hint)
//   buttonLabel: '...'          — Continue-button label override
//   unlock: ['.sel', ...]       — selectors granted .tutorial-allow
//                                 when this step renders (accumulates;
//                                 cleared by endTutorial)
//   spotlight: '#sel'           — element(s) given .tutorial-spotlight
//                                 while this step is showing (used to
//                                 un-dim the mode-toggle bar)
//
// Optional tutorial-level fields:
//   tutorial.unlock: [...]      — controls whitelisted at start.
//                                 DEFAULTS to ['#f-advance'] so the
//                                 legacy sim-step tutorials keep their
//                                 Advance button; the Grand Tour sets
//                                 [] and unlocks progressively.
//   tutorial.mode: 'legends'    — ENGINE v3: run the tutorial in
//                                 Simulation (legends) mode instead of
//                                 Creative. Boot switches to legends and
//                                 PRESETS the setup row (see preset);
//                                 the player presses Grow themselves.
//                                 `step: N` triggers read the NARRATIVE
//                                 PLAYBACK position (_legendsPlaybackStep,
//                                 ticked from displayLines), not the
//                                 sim's final step counter — legends
//                                 runs the whole sim up front and paces
//                                 the story afterwards.
//   tutorial.preset: {...}      — legends boot presets: {scenario, seed,
//                                 steps} written into #scenario / #seed /
//                                 #steps so the player's Grow press runs
//                                 the intended deterministic run.
//
// Optional per-step field (v3):
//   allowModes: ['library']     — mode switches the CURRENT step
//                                 sanctions. switchMode() consults
//                                 _tutorialAllowsMode(); a switch to the
//                                 tutorial's home mode or a sanctioned
//                                 mode keeps the tutorial alive (this is
//                                 how a tour walks Simulation → Library
//                                 without self-destructing). Home always
//                                 ends the tutorial.
//
// v3 caveat for authors: legends narration pauses on its own
// .narrative-continue-pill at the prologue/epilogue boundaries (Enter/
// Space activate the focused pill). The tutorial keydown ignores
// keypresses targeting the pill — but still avoid authoring a
// continue-trigger tutorial step that would sit on screen while a pill
// is armed; use playback-step or action triggers around those beats.
//
// Control locking is visible in CSS and enforced here in the capture phase.
// Pointer-events alone does not stop keyboard/programmatic activation, so
// locked controls also receive accessible state + a semantic input gate.

// Async tutorial boots wait for narratives. Reset/New Game during that wait
// must invalidate the pending lesson so its state cannot reappear over the
// replacement run after the await resumes.
let _tutorialStartEpoch = 0;
// Every async run launcher (Scenario, Starter, Custom, tutorial boot) claims
// this shared generation before awaiting narratives. Home/Reset/New Game and
// every synchronous constructor advance it, so a stale continuation cannot
// resurrect geology or a save after a newer boundary has won.
let _runLaunchEpoch = 0;
const _tutorialControlLockState = new Map<any, any>();
let _tutorialViewerCommissioningReceipt: any = null;

function _runLaunchClaim(): number {
  return ++_runLaunchEpoch;
}

function _runLaunchTokenCurrent(token): boolean {
  return Number.isSafeInteger(token) && token === _runLaunchEpoch;
}

function _tutorialLockableControl(target) {
  if (!target || typeof target.closest !== 'function') return null;
  try {
    return target.closest(
      '.action-btn, #btn-grow, #btn-random, #topo-three-btn, #helix-overlay-btn',
    );
  } catch (_) { return null; }
}

function _tutorialRestoreControlAttributes(control, prior) {
  if (!control || !prior) return;
  if (prior.hadAriaDisabled) control.setAttribute('aria-disabled', prior.ariaDisabled);
  else control.removeAttribute('aria-disabled');
  if (prior.hadTabIndex) control.setAttribute('tabindex', prior.tabIndex);
  else control.removeAttribute('tabindex');
  if (prior.hasDisabledProperty) control.disabled = prior.disabled;
  delete control.dataset.tutorialLocked;
}

function _tutorialSyncControlLocks() {
  const controls = document.querySelectorAll(
    '.action-btn, #btn-grow, #btn-random, #topo-three-btn, #helix-overlay-btn',
  );
  controls.forEach((control: any) => {
    if (!_tutorialControlLockState.has(control)) {
      _tutorialControlLockState.set(control, {
        hadAriaDisabled: control.hasAttribute('aria-disabled'),
        ariaDisabled: control.getAttribute('aria-disabled'),
        hadTabIndex: control.hasAttribute('tabindex'),
        tabIndex: control.getAttribute('tabindex'),
        hasDisabledProperty: 'disabled' in control,
        disabled: 'disabled' in control ? control.disabled : false,
      });
    }
    const prior = _tutorialControlLockState.get(control);
    if (control.classList.contains('tutorial-allow')) {
      _tutorialRestoreControlAttributes(control, prior);
      return;
    }
    control.setAttribute('aria-disabled', 'true');
    control.setAttribute('tabindex', '-1');
    if ('disabled' in control) control.disabled = true;
    control.dataset.tutorialLocked = 'true';
  });
}

function _tutorialGrantPermanentAllow(selector) {
  document.querySelectorAll(selector).forEach((control: any) => {
    control.classList.add('tutorial-allow', 'tutorial-permanent-allow');
  });
}

function _tutorialClearStepAllows() {
  document.querySelectorAll('.tutorial-step-allow').forEach((control: any) => {
    control.classList.remove('tutorial-step-allow');
    if (!control.classList.contains('tutorial-permanent-allow')) {
      control.classList.remove('tutorial-allow');
    }
  });
}

function _tutorialRestoreControlLocks() {
  for (const [control, prior] of _tutorialControlLockState.entries()) {
    _tutorialRestoreControlAttributes(control, prior);
  }
  _tutorialControlLockState.clear();
}

function _tutorialLockedControlEvent(event) {
  if (!_tutorialState || !document.body.classList.contains('tutorial-active')) return;
  const control = _tutorialLockableControl(event.target);
  if (!control || control.classList.contains('tutorial-allow')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
  if (typeof control.blur === 'function') control.blur();
}

function _dispatchTutorialViewStateProduct(target, control, beforeEnabled, afterEnabled): boolean {
  if (!target || typeof target.dispatchEvent !== 'function'
      || typeof control !== 'string' || !control
      || typeof beforeEnabled !== 'boolean' || typeof afterEnabled !== 'boolean'
      || beforeEnabled === afterEnabled) return false;
  target.dispatchEvent(new CustomEvent('vugg:tutorial-view-state-committed', {
    bubbles: true,
    detail: Object.freeze({
      schema: 'tutorial-view-state-product-v1',
      control,
      before_enabled: beforeEnabled,
      after_enabled: afterEnabled,
    }),
  }));
  return true;
}

function _tutorialTopoPresentationMatches(afterEnabled: boolean): boolean {
  const flat = document.getElementById('topo-canvas') as any;
  const mesh = document.getElementById('topo-canvas-three') as any;
  if (!flat || !mesh) return false;
  if (afterEnabled) {
    return mesh.style?.display === 'block'
      && flat.style?.visibility === 'hidden'
      && typeof _topoThreeRendererEffective === 'function'
      && _topoThreeRendererEffective() === true;
  }
  const sim = typeof topoActiveSim === 'function' ? topoActiveSim() : null;
  const active = sim?.wall_state?.activeCavitySurfaceAnchorProvider?.();
  const receipt = flat._cavityFieldCrossSectionReceipt;
  return mesh.style?.display === 'none'
    && flat.style?.visibility !== 'hidden'
    && active?.receipt?.kind === 'cavity-field'
    && receipt?.schema === 'cavity-field-cross-section-v1'
    && receipt.field_snapshot_digest === active.field?.snapshotDigest
    && receipt.surface_buffer_digest === active.surface?.buffer_digest
    && receipt.crystal_policy
      === 'withheld-with-explicit-label-without-authenticated-cpu-field-clipping';
}

// One commissioner is shared by live tutorial boot and the controlled
// mechanism witness. This makes the persistent prior-run state and the exact
// post-boot product visible without emitting a player-action receipt.
function _tutorialCanonicalizeViewerState() {
  const before = Object.freeze({
    topo_three_renderer_enabled: typeof topoThreeRendererEnabled === 'function'
      ? topoThreeRendererEnabled() : null,
    helix_overlay_enabled: typeof helixOverlayEnabled === 'function'
      ? helixOverlayEnabled() : null,
  });
  if (typeof topoSetThreeRendererEnabled !== 'function'
      || typeof helixSetOverlayEnabled !== 'function') {
    throw new Error('Guided tutorial viewer authority is unavailable');
  }
  topoSetThreeRendererEnabled(true, false);
  helixSetOverlayEnabled(false, false);
  _tutorialViewerCommissioningReceipt = Object.freeze({
    schema: 'tutorial-viewer-commissioning-v1',
    before,
    after: Object.freeze({
      topo_three_renderer_enabled: topoThreeRendererEnabled(),
      helix_overlay_enabled: helixOverlayEnabled(),
    }),
  });
  return _tutorialViewerCommissioningReceipt;
}

function tutorialViewerCommissioningReceipt() {
  return _tutorialViewerCommissioningReceipt;
}

function _tutorialStepsForViewerCapability(steps, commissioning) {
  if (!Array.isArray(steps)) return [];
  const hasThree = commissioning?.after?.topo_three_renderer_enabled === true;
  if (hasThree) return steps.slice();
  return steps
    .filter(step => step?.requiresCapability !== 'three-renderer')
    .map(step => {
      if (typeof step?.capabilityFallbackText !== 'string') return step;
      return Object.freeze({ ...step, text: step.capabilityFallbackText });
    });
}


function showCallout(opts) {
  hideCallout();
  const { anchor, text, side, highlight, progress, button, hint, onButton, onSkip } =
    Object.assign(
      { side: 'auto', highlight: true, progress: null, button: null,
        hint: null, onButton: null, onSkip: null },
      opts || {}
    );
  let anchorEl = (typeof anchor === 'string') ? document.querySelector(anchor) : anchor;
  if (!anchorEl) {
    // Fallback chain — a missing anchor must never stall the tutorial
    // machine with an invisible step (e.g. #helix-legend before the
    // overlay has ever been toggled, or #topo-replay-btn pre-sim).
    console.warn('showCallout: anchor not found, using fallback:', anchor);
    anchorEl = document.querySelector('#topo-panel') || document.body;
  }
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'tutorial-callout';
  tooltipEl.setAttribute('role', 'region');
  tooltipEl.setAttribute('aria-label', 'Tutorial guidance');
  tooltipEl.setAttribute('aria-live', 'polite');
  tooltipEl.setAttribute('aria-atomic', 'true');

  const textEl = document.createElement('div');
  textEl.className = 'tutorial-callout-text';
  textEl.textContent = text || '';
  tooltipEl.appendChild(textEl);

  if (hint) {
    const hintEl = document.createElement('div');
    hintEl.className = 'tutorial-callout-hint';
    hintEl.textContent = hint;
    tooltipEl.appendChild(hintEl);
  }

  if (progress || button) {
    const footEl = document.createElement('div');
    footEl.className = 'tutorial-callout-footer';
    const progEl = document.createElement('span');
    progEl.className = 'tutorial-callout-progress';
    progEl.textContent = progress || '';
    footEl.appendChild(progEl);
    if (button) {
      const btnEl = document.createElement('button');
      btnEl.className = 'tutorial-callout-btn';
      btnEl.textContent = button;
      btnEl.addEventListener('click', (e) => {
        e.stopPropagation(); // don't let the action listener see chrome clicks
        if (onButton) onButton();
      });
      footEl.appendChild(btnEl);
    }
    tooltipEl.appendChild(footEl);
  }

  if (onSkip) {
    const skipEl = document.createElement('button');
    skipEl.className = 'tutorial-callout-skip';
    skipEl.title = 'Skip tutorial';
    skipEl.setAttribute('aria-label', 'Skip tutorial');
    skipEl.textContent = '✕';
    skipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      onSkip();
    });
    tooltipEl.appendChild(skipEl);
  }

  // Interactive chrome needs pointer events; plain informational
  // callouts stay click-through (showCallout remains usable as a
  // standalone primitive from any code path).
  if (button || onSkip) tooltipEl.classList.add('has-chrome');

  document.body.appendChild(tooltipEl);
  const arrowEl = document.createElement('div');
  arrowEl.className = 'tutorial-callout-arrow';
  document.body.appendChild(arrowEl);
  if (highlight) anchorEl.classList.add('tutorial-callout-anchor-highlight');
  _calloutState = { tooltipEl, arrowEl, anchorEl: highlight ? anchorEl : null, side };
  _positionCallout(anchorEl, tooltipEl, arrowEl, side);
  window.addEventListener('resize', _onCalloutResize);
  window.addEventListener('scroll', _onCalloutResize, true);
}

function hideCallout() {
  if (_calloutState.tooltipEl) _calloutState.tooltipEl.remove();
  if (_calloutState.arrowEl) _calloutState.arrowEl.remove();
  if (_calloutState.anchorEl) {
    _calloutState.anchorEl.classList.remove('tutorial-callout-anchor-highlight');
  }
  _calloutState = { tooltipEl: null, arrowEl: null, anchorEl: null, side: 'auto' };
  window.removeEventListener('resize', _onCalloutResize);
  window.removeEventListener('scroll', _onCalloutResize, true);
}

function _onCalloutResize() {
  const s = _calloutState;
  // Use the element that matters for positioning: anchorEl if highlighting,
  // else look up via the tooltip's stored data (we only support resize on
  // anchored callouts — no anchor means no reposition needed).
  if (s.tooltipEl && s.anchorEl) {
    _positionCallout(s.anchorEl, s.tooltipEl, s.arrowEl, s.side);
  }
}

function _positionCallout(anchorEl, tooltipEl, arrowEl, side) {
  const ar = anchorEl.getBoundingClientRect();
  const cw = tooltipEl.offsetWidth;
  const ch = tooltipEl.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 14; // space between anchor and tooltip (room for arrow)

  if (side === 'auto') {
    const room = {
      top: ar.top,
      bottom: vh - ar.bottom,
      left: ar.left,
      right: vw - ar.right,
    };
    side = Object.entries(room).sort((a, b) => b[1] - a[1])[0][0];
  }

  let top, left, arrowTop, arrowLeft, arrowClass;
  switch (side) {
    case 'top':
      top = ar.top - ch - gap;
      left = ar.left + ar.width / 2 - cw / 2;
      arrowTop = ar.top - 11 - 1;
      arrowLeft = ar.left + ar.width / 2 - 9;
      arrowClass = 'from-bottom'; // arrow on bottom of tooltip points down to anchor
      break;
    case 'bottom':
      top = ar.bottom + gap;
      left = ar.left + ar.width / 2 - cw / 2;
      arrowTop = ar.bottom + 1;
      arrowLeft = ar.left + ar.width / 2 - 9;
      arrowClass = 'from-top';
      break;
    case 'left':
      top = ar.top + ar.height / 2 - ch / 2;
      left = ar.left - cw - gap;
      arrowTop = ar.top + ar.height / 2 - 9;
      arrowLeft = ar.left - 11 - 1;
      arrowClass = 'from-right';
      break;
    case 'right':
    default:
      top = ar.top + ar.height / 2 - ch / 2;
      left = ar.right + gap;
      arrowTop = ar.top + ar.height / 2 - 9;
      arrowLeft = ar.right + 1;
      arrowClass = 'from-left';
      break;
  }
  // Clamp tooltip to viewport (8px margin)
  left = Math.max(8, Math.min(left, vw - cw - 8));
  top = Math.max(8, Math.min(top, vh - ch - 8));

  tooltipEl.style.top = top + 'px';
  tooltipEl.style.left = left + 'px';
  arrowEl.style.top = arrowTop + 'px';
  arrowEl.style.left = arrowLeft + 'px';
  arrowEl.className = 'tutorial-callout-arrow ' + arrowClass;
}

async function startTutorial(scenarioName) {
  const make = (typeof SCENARIOS !== 'undefined') ? SCENARIOS[scenarioName] : null;
  const spec = make && make._json5_spec;
  const tut = spec && spec.tutorial;
  const tutMode = (tut && tut.mode) || 'fortress';

  // A second lesson is a run boundary too. Clear the old lexical state before
  // booting; fortress constructors also call endTutorial so ordinary New Game
  // paths get the same ownership rule.
  const startEpoch = ++_tutorialStartEpoch;
  endTutorial();

  // Boot the stage. Both boot paths run BEFORE _tutorialState is set,
  // so their internal endTutorial() calls are no-ops.
  if (tutMode === 'legends') {
    // ENGINE v3 — Simulation-mode tutorial: switch to legends and preset
    // the setup row; the player presses Grow themselves (that's a lesson).
    if (typeof switchMode !== 'function') {
      console.error('startTutorial: switchMode not available');
      return;
    }
    switchMode('legends');
    const preset = (tut && tut.preset) || {};
    const scenEl = document.getElementById('scenario');
    if (scenEl) scenEl.value = preset.scenario || scenarioName;
    if (preset.seed != null) {
      const seedEl = document.getElementById('seed');
      if (seedEl) seedEl.value = String(preset.seed);
    }
    if (preset.steps != null) {
      const stepsEl = document.getElementById('steps');
      if (stepsEl) stepsEl.value = String(preset.steps);
    }
    // Shape/cavity are part of the scientific command, not presentation.
    // Write even an authored empty shape seed so Random's previous setup
    // cannot silently change the controlled pocket this lesson narrates.
    if (Object.prototype.hasOwnProperty.call(preset, 'shapeSeed')) {
      const shapeSeedEl = document.getElementById('shape-seed');
      if (shapeSeedEl) shapeSeedEl.value = String(preset.shapeSeed);
    }
    if (Object.prototype.hasOwnProperty.call(preset, 'cavitySize')) {
      const cavitySizeEl = document.getElementById('cavity-size');
      if (cavitySizeEl) cavitySizeEl.value = String(preset.cavitySize);
    }
    _legendsPlaybackStep = 0;
  } else {
    // Legacy path — boot the underlying scenario in Creative Mode.
    if (typeof startScenarioInCreative !== 'function') {
      console.error('startTutorial: startScenarioInCreative not available');
      return;
    }
    await startScenarioInCreative(scenarioName, undefined, startEpoch);
  }

  // A newer Reset/New Game won while this async boot waited. Fail closed
  // instead of reinstalling its stale locks and progress over that run.
  if (_tutorialStartEpoch !== startEpoch) return;

  if (!tut || !Array.isArray(tut.steps) || !tut.steps.length) {
    console.warn('startTutorial: scenario has no tutorial.steps:', scenarioName);
    return; // scenario still runs, just without overlay
  }
  // The Grand Tour teaches transitions, so its persistent viewer controls
  // start from one commissioned state rather than whatever the previous run
  // left behind. These silent setters change presentation only; the player's
  // later accepted toggles emit the product receipts that advance the lesson.
  let commissionedSteps = tut.steps.slice();
  if (scenarioName === 'tutorial_first_crystal') {
    const viewerCommissioning = _tutorialCanonicalizeViewerState();
    commissionedSteps = _tutorialStepsForViewerCapability(
      commissionedSteps, viewerCommissioning,
    );
  }
  _tutorialState = {
    steps: commissionedSteps, stepIdx: 0, renderedIdx: -1, pausedAt: -1,
    mode: tutMode, legendsRunClaimed: false,
  };
  document.body.classList.add('tutorial-active');

  // Starting whitelist. Legacy tutorials (no tutorial.unlock field) keep
  // their Advance button; the Grand Tour passes [] and unlocks per-step.
  const startAllow = Array.isArray(tut.unlock) ? tut.unlock : ['#f-advance'];
  for (const sel of startAllow) {
    _tutorialGrantPermanentAllow(sel);
  }
  _tutorialSyncControlLocks();

  // Engine-v2/v3 listeners: Enter/Space for continue steps; delegated
  // click/change/input for action steps, on the CAPTURE phase so the
  // match is recorded BEFORE the game's own handler can detach the
  // target (the collect button re-renders the inventory synchronously,
  // which would kill a bubble-phase listener — engine v3). The advance
  // itself is DEFERRED one tick so the game handler still runs first
  // (e.g. the ⌇ toggle creates #helix-legend before the next step
  // anchors to it).
  document.addEventListener('keydown', _tutorialLockedControlEvent, true);
  document.addEventListener('click', _tutorialLockedControlEvent, true);
  document.addEventListener('keydown', _tutorialKeydown, true);
  document.addEventListener('click', _tutorialActionEvent, true);
  document.addEventListener('change', _tutorialActionEvent, true);
  document.addEventListener('input', _tutorialActionEvent, true);
  document.addEventListener('vugg:crystal-collected', _tutorialActionEvent, true);
  document.addEventListener('vugg:strip-opened', _tutorialActionEvent, true);
  document.addEventListener('vugg:fortress-fluid-action-committed', _tutorialActionEvent, true);
  document.addEventListener('vugg:tutorial-view-state-committed', _tutorialActionEvent, true);

  // Fire any steps whose trigger is already satisfied (typically the
  // welcome step, or step:0 in the legacy tutorials).
  _maybeAdvanceTutorial();
}

function endTutorial() {
  // Tutorial locking and exact-flat presentation can own the same controls.
  // Release the inner flat snapshot before restoring the tutorial snapshot,
  // then reacquire it from the restored values when the player merely Skips
  // or finishes while keeping the same geological presentation. Run-lifecycle
  // boundaries release flat first in _tutorialRunBoundary, so they do not
  // reacquire a product belonging to the retired run.
  const resumeExactFlatPresentation =
    typeof _topoExactFlatPresentationActive === 'boolean'
    && _topoExactFlatPresentationActive
    && typeof _topoSyncFlatPresentationControls === 'function';
  if (resumeExactFlatPresentation) _topoSyncFlatPresentationControls(false);
  _tutorialState = null;
  _tutorialViewerCommissioningReceipt = null;
  document.body.classList.remove('tutorial-active');
  document.querySelectorAll('.tutorial-allow, .tutorial-permanent-allow, .tutorial-step-allow')
    .forEach(el => el.classList.remove(
      'tutorial-allow', 'tutorial-permanent-allow', 'tutorial-step-allow',
    ));
  document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
  _tutorialRestoreControlLocks();
  document.removeEventListener('keydown', _tutorialLockedControlEvent, true);
  document.removeEventListener('click', _tutorialLockedControlEvent, true);
  document.removeEventListener('keydown', _tutorialKeydown, true);
  document.removeEventListener('click', _tutorialActionEvent, true);
  document.removeEventListener('change', _tutorialActionEvent, true);
  document.removeEventListener('input', _tutorialActionEvent, true);
  document.removeEventListener('vugg:crystal-collected', _tutorialActionEvent, true);
  document.removeEventListener('vugg:strip-opened', _tutorialActionEvent, true);
  document.removeEventListener('vugg:fortress-fluid-action-committed', _tutorialActionEvent, true);
  document.removeEventListener('vugg:tutorial-view-state-committed', _tutorialActionEvent, true);
  hideCallout();
  if (resumeExactFlatPresentation) _topoSyncFlatPresentationControls(true);
}

// Shared by 94/97 run constructors and Reset. Only the exact pending token
// supplied by startTutorial may complete that boot; ordinary boundaries
// invalidate all pending work before clearing the live lesson.
function _tutorialRunBoundary(tutorialBootToken?, runLaunchToken?) {
  const ownsPendingLaunch = _runLaunchTokenCurrent(runLaunchToken);
  if (!ownsPendingLaunch) _runLaunchEpoch++;
  const ownsPendingBoot = Number.isSafeInteger(tutorialBootToken)
    && tutorialBootToken === _tutorialStartEpoch;
  if (!ownsPendingBoot) _tutorialStartEpoch++;
  // A run replacement/Home/Reset retires the flat product as well as the
  // tutorial. Release the newer (inner) owner first so endTutorial restores
  // the older tutorial snapshot second. This prevents a stale disabled=true
  // exact-flat snapshot from being replayed after both owners have ended.
  if (typeof _topoExactFlatPresentationActive === 'boolean'
      && _topoExactFlatPresentationActive
      && typeof _topoSyncFlatPresentationControls === 'function') {
    _topoSyncFlatPresentationControls(false);
  }
  endTutorial();
  return ownsPendingBoot;
}

function _tutorialBootTokenCurrent(tutorialBootToken) {
  return Number.isSafeInteger(tutorialBootToken)
    && tutorialBootToken === _tutorialStartEpoch;
}

// Read-only lifecycle breadcrumb for tests, browser QA, and durable tutorial
// testimony. The overlay state itself remains lexical so callers cannot forge
// progress; this projection intentionally exposes no mutable step objects.
function tutorialStateSnapshot() {
  const s = _tutorialState;
  if (!s) return null;
  return Object.freeze({
    mode: String(s.mode || 'fortress'),
    step_index: Number(s.stepIdx),
    step_count: Array.isArray(s.steps) ? s.steps.length : 0,
    rendered_index: Number(s.renderedIdx),
    paused_at: Number(s.pausedAt),
    current_trigger: _tutCurrentTrigger(),
  });
}

// ENGINE v3 — consulted by switchMode() (js/94-ui-menu.ts) before it
// tears down a running tutorial. A switch to the tutorial's home mode
// or to a mode the CURRENT step sanctions (allowModes) keeps the
// tutorial alive; anything else ends it. With no tutorial running the
// return value preserves the legacy shape (endTutorial no-ops anyway).
function _tutorialAllowsMode(mode) {
  const s = _tutorialState;
  if (!s) return mode === 'fortress';
  const home = s.mode || 'fortress';
  if (mode === home) return true;
  const st = (s.stepIdx < s.steps.length) ? s.steps[s.stepIdx] : null;
  return !!(st && Array.isArray(st.allowModes) && st.allowModes.includes(mode));
}

// ---- trigger classification -------------------------------------

function _tutStepTrigger(st) {
  if (st && typeof st.step === 'number') return 'simstep';
  if (st && st.action && st.action.selector) return 'action';
  return 'continue';
}

function _tutCurrentStep() {
  const s = _tutorialState;
  if (!s || s.stepIdx >= s.steps.length) return null;
  return s.steps[s.stepIdx];
}

// The current step's trigger as the machine treats it: a sim-step the
// machine has PAUSED on (v3.1 — fired narration whose successor waits
// on the player) behaves as a continue step for rendering + keyboard.
function _tutCurrentTrigger() {
  const s = _tutorialState;
  if (!s || s.stepIdx >= s.steps.length) return null;
  const trig = _tutStepTrigger(s.steps[s.stepIdx]);
  return (trig === 'simstep' && s.pausedAt === s.stepIdx) ? 'continue' : trig;
}

// ---- the state machine ------------------------------------------

// Advance past the current (continue/action) step: the player clicked
// Continue, pressed Enter/Space, or performed the awaited action.
function _tutorialAdvance() {
  const s = _tutorialState;
  if (!s) return;
  s.pausedAt = -1; // release any v3.1 narration pause
  s.stepIdx++;
  if (s.stepIdx >= s.steps.length) {
    // Explicit finish (last step was continue/action) — clean teardown.
    endTutorial();
    return;
  }
  // The click consumed this button's purpose. If the new current step
  // renders, showCallout replaces the chrome anyway; if it's a sim-step
  // still waiting (the Begin ⏎ handoff pattern), the old callout
  // deliberately LINGERS as the standing instruction — but its button
  // must die with its step, or a second click silently skips the
  // waiting beat (pre-v3.1 bug, caught in the 2026-07-07 parity pass).
  const staleBtn = document.querySelector('.tutorial-callout-btn');
  if (staleBtn) staleBtn.disabled = true;
  _maybeAdvanceTutorial();
}

// Settle the machine: render the current step if it's continue/action;
// consume any due sim-step steps as a burst (legacy semantics — last
// one's callout wins). Called from startTutorial, _tutorialAdvance, and
// the two fortress tick sites in 97-ui-fortress.ts. No-op when idle.
function _maybeAdvanceTutorial() {
  const s = _tutorialState;
  if (!s) return;
  if (s.stepIdx >= s.steps.length) return; // exhausted via sim-steps: final callout stays up (legacy)
  const trig = _tutCurrentTrigger(); // paused narration reads as 'continue'
  if (trig !== 'simstep') {
    // Waiting on the player — render once (fortress ticks re-enter here;
    // renderedIdx keeps the callout from flickering on every action).
    if (s.renderedIdx !== s.stepIdx) _renderTutorialStep(s.stepIdx, trig);
    return;
  }
  // v3: legends tutorials trigger off the narrative PLAYBACK position
  // (ticked from displayLines); fortress tutorials off the live sim.
  const isLegends = (s.mode === 'legends');
  if (!isLegends && (typeof fortressSim === 'undefined' || !fortressSim)) return;
  const cur = isLegends
    ? ((typeof _legendsPlaybackStep !== 'undefined') ? _legendsPlaybackStep : 0)
    : (fortressSim.step || 0);
  // Walk forward, consuming every due sim-step step; the last fired
  // one's callout is shown. Stop at the first continue/action step or
  // undue threshold.
  let lastFiredIdx = -1;
  while (s.stepIdx < s.steps.length) {
    const nx = s.steps[s.stepIdx];
    if (_tutStepTrigger(nx) !== 'simstep' || (nx.step || 0) > cur) break;
    lastFiredIdx = s.stepIdx;
    s.stepIdx++;
  }
  if (lastFiredIdx >= 0) {
    // v3.1: if the step after the fired burst waits on the player
    // (action/continue), PAUSE on the fired narration as a pseudo-
    // continue instead of letting the trailing step supersede it —
    // pre-v3.1 the fired callout never painted (the rAF renderedIdx
    // guard killed it before first frame) and the narration was lost.
    const trailing = (s.stepIdx < s.steps.length)
      ? _tutStepTrigger(s.steps[s.stepIdx]) : null;
    if (trailing && trailing !== 'simstep') {
      s.stepIdx = lastFiredIdx; // stand on the narration…
      s.pausedAt = lastFiredIdx; // …as a pseudo-continue
      _renderTutorialStep(lastFiredIdx, 'continue');
    } else {
      _renderTutorialStep(lastFiredIdx, 'simstep');
    }
  }
}

function _renderTutorialStep(idx, trig) {
  const s = _tutorialState;
  if (!s) return;
  s.renderedIdx = idx;
  const st = s.steps[idx];

  // The previous action target loses its temporary authority as soon as the
  // lesson advances. Authored `unlock` entries remain cumulative; the current
  // action target is independently enabled only for this exact step.
  _tutorialClearStepAllows();
  for (const sel of (st.unlock || [])) {
    _tutorialGrantPermanentAllow(sel);
  }
  if (trig === 'action' && typeof st.action?.selector === 'string') {
    document.querySelectorAll(st.action.selector).forEach((control: any) => {
      if (_tutorialLockableControl(control) === control) {
        control.classList.add('tutorial-allow', 'tutorial-step-allow');
      }
    });
  }
  _tutorialSyncControlLocks();
  // Spotlight — exclusive to the showing step.
  document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
  if (st.spotlight) {
    document.querySelectorAll(st.spotlight).forEach(el => el.classList.add('tutorial-spotlight'));
  }

  const progress = (idx + 1) + ' / ' + s.steps.length;
  // The final step of ANY tutorial gets a Finish button — even a
  // sim-step-triggered one (the legacy tutorials used to end with the
  // overlay lingering until Home; now they close cleanly in place).
  const isLast = (idx === s.steps.length - 1);
  let button = null, onButton = null;
  if (trig === 'continue') {
    button = st.buttonLabel || (isLast ? 'Finish tutorial' : 'Continue ⏎');
    onButton = _tutorialAdvance; // past-the-end advance IS endTutorial
  } else if (isLast) {
    button = st.buttonLabel || 'Finish tutorial';
    onButton = endTutorial;
  }
  // Defer one frame: action steps render right after the player's click
  // mutated the DOM (viewer toggles, legend creation) — let layout land
  // before we measure anchor rects.
  requestAnimationFrame(() => {
    if (_tutorialState !== s || s.renderedIdx !== idx) return; // superseded meanwhile
    showCallout({
      anchor: st.anchor || '#f-advance',
      text: st.text || '',
      side: st.side || 'auto',
      progress,
      button,
      hint: st.hint || (trig === 'action' ? 'do the highlighted thing to continue' : null),
      onButton,
      onSkip: endTutorial,
    });
  });
}

// ---- player-input listeners (installed by startTutorial) ---------

function _tutorialKeydown(e) {
  if (_tutCurrentTrigger() !== 'continue') return;
  if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'Space') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' || t.isContentEditable)) return;
  // v3: the legends narrative's own continue-pill is a focused
  // role=button div that activates on Enter/Space — never steal its
  // keypress (see the authoring caveat in the header).
  if (t && t.closest && t.closest('.narrative-continue-pill')) return;
  // A focused game button would ALSO activate on Space/Enter — blur it
  // so one keypress can't both advance the tutorial and press a button.
  if (t && t.tagName === 'BUTTON') t.blur();
  e.preventDefault();
  e.stopPropagation();
  _tutorialAdvance();
}

function _tutorialDatasetMatches(node, expected) {
  if (!node || !expected || typeof expected !== 'object' || Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  if (!keys.length) return false;
  for (const key of keys) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key) || typeof expected[key] !== 'string') return false;
    if (!node.dataset || typeof node.dataset[key] !== 'string'
        || node.dataset[key] !== expected[key]) return false;
  }
  return true;
}

function _tutorialStripReceiptMatches(hit, receipt) {
  if (!receipt || !_tutorialDatasetMatches(hit, {
    scenarioId: receipt.scenario_id,
    seed: String(receipt.seed),
    simVersion: String(receipt.sim_version),
    modelDigest: receipt.model_digest,
    scenarioSpecHash: receipt.scenario_spec_hash,
    storageKey: receipt.key,
    recordedAt: String(receipt.recorded_at),
    manifestDigestSha256: receipt.manifest_digest_sha256,
    datasetDigestSha256: receipt.dataset_digest_sha256,
  })) return false;
  return receipt.sim_version === SIM_VERSION && receipt.model_digest === MODEL_DIGEST;
}

// A CSS selector identifies the control shape; these optional predicates bind
// a lesson to the scientific/product object its prose describes. This keeps a
// quartz card from satisfying a calcite lesson, a random dataset from
// satisfying a TN457 lesson, or the first keystroke from satisfying a named
// Library search. Data attributes are installed by 97c, 98, and 99k—the three
// UI producers this state-machine consumer depends on.
function _tutorialActionTargetMatches(action, hit) {
  if (!action || !hit) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'dataset')
      && !_tutorialDatasetMatches(hit, action.dataset)) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'within')) {
    const within = action.within;
    if (!within || typeof within !== 'object' || Array.isArray(within)
        || typeof within.selector !== 'string' || !within.selector.trim()
        || typeof hit.closest !== 'function') return false;
    let owner = null;
    try { owner = hit.closest(within.selector); } catch (_error) { return false; }
    if (!owner || !_tutorialDatasetMatches(owner, within.dataset)) return false;
  }
  if (Object.prototype.hasOwnProperty.call(action, 'valueNormalized')) {
    if (typeof action.valueNormalized !== 'string' || !action.valueNormalized.trim()
        || typeof hit.value !== 'string'
        || hit.value.trim().toLowerCase() !== action.valueNormalized.trim().toLowerCase()) {
      return false;
    }
  }
  if (Object.prototype.hasOwnProperty.call(action, 'valueExact')) {
    // Empty is meaningful here: it commissions the scenario-defined shape
    // instead of accepting a shape seed retained from an earlier run.
    if (typeof action.valueExact !== 'string'
        || typeof hit.value !== 'string'
        || hit.value !== action.valueExact) return false;
  }
  if (Object.prototype.hasOwnProperty.call(action, 'selectedDataset')) {
    // Read by selectedIndex from the owning select. selectedOptions can be a
    // live cross-realm collection in embedded browsers; the index is the
    // stable product state grooveSelectCrystal consumes too (98-ui-groove).
    const selected = hit.options && typeof hit.selectedIndex === 'number'
      && Number.isSafeInteger(hit.selectedIndex) && hit.selectedIndex >= 0
      ? hit.options[hit.selectedIndex] : null;
    if (!_tutorialDatasetMatches(selected, action.selectedDataset)) return false;
  }
  if (Object.prototype.hasOwnProperty.call(action, 'context')) {
    if (!Array.isArray(action.context) || !action.context.length) return false;
    for (const condition of action.context) {
      if (!condition || typeof condition !== 'object' || Array.isArray(condition)
          || typeof condition.selector !== 'string' || !condition.selector.trim()
          || Object.prototype.hasOwnProperty.call(condition, 'context')) return false;
      let node = null;
      try { node = document.querySelector(condition.selector); } catch (_error) { return false; }
      if (!node || !_tutorialActionTargetMatches(condition, node)) return false;
    }
  }
  if (Object.prototype.hasOwnProperty.call(action, 'latestStoredStrip')) {
    if (action.latestStoredStrip !== true
        || typeof stripLatestDurableRunReceipt !== 'function') return false;
    const receipt = stripLatestDurableRunReceipt();
    if (!_tutorialStripReceiptMatches(hit, receipt)) return false;
  }
  return true;
}

// Simulation-mode tutorials boot the setup panel first and let the player
// press Grow. The exact current Grow action may commission that one run; a
// second Grow, or a Grow after editing the preset away from its authored
// scenario/seed/steps, is an ordinary replacement and clears the lesson.
function _tutorialRunBoundaryForAction(selector, runLaunchToken?) {
  const s = _tutorialState;
  const st = _tutCurrentStep();
  const action = st && st.action;
  let target = null;
  try { target = document.querySelector(selector); } catch (_error) { target = null; }
  const exactTutorialRun = !!(s && s.mode === 'legends'
    && _tutStepTrigger(st) === 'action' && action.selector === selector
    && target && _tutorialActionTargetMatches(action, target));
  if (exactTutorialRun && !s.legendsRunClaimed) {
    // Claim synchronously. The action event advances on a timer, and two fast
    // clicks must not both commission the tutorial's one geological run.
    s.legendsRunClaimed = true;
    return true;
  }
  if (!exactTutorialRun) _tutorialRunBoundary(undefined, runLaunchToken);
  return false;
}

function _tutorialProductEventMatches(event, action, hit) {
  if (event.type === 'vugg:crystal-collected') {
    const detail = event.detail;
    const owner = typeof hit.closest === 'function' && action.within?.selector
      ? hit.closest(action.within.selector) : null;
    return !!(detail && typeof detail === 'object' && !Array.isArray(detail)
      && typeof detail.mineral === 'string' && detail.mineral.length > 0
      && typeof detail.crystal_id === 'number' && Number.isSafeInteger(detail.crystal_id)
      && typeof detail.record_id === 'string' && detail.record_id.length > 0
      && owner && owner.dataset?.mineral === detail.mineral
      && owner.dataset?.crystalId === String(detail.crystal_id)
      && owner.dataset?.collectedRecordId === detail.record_id);
  }
  if (event.type === 'vugg:strip-opened') {
    return _tutorialStripReceiptMatches(hit, event.detail);
  }
  if (event.type === 'vugg:fortress-fluid-action-committed') {
    const detail = event.detail;
    const keys = detail && typeof detail === 'object' && !Array.isArray(detail)
      ? Object.keys(detail).sort() : [];
    const expectedKeys = [
      'schema', 'product', 'action', 'accepted_at_step', 'before_pH', 'after_pH',
      'spatial_authority_schema', 'spatial_authority_scope',
      'spatial_authority_count', 'spatial_authority_closed',
      'carbonate_transaction_kind', 'carbonate_transaction_index',
      'carbonate_transactions_before_action', 'carbonate_preparation_transfer_count',
    ].sort();
    return action.productAction === 'carbonate-acid-titration'
      && JSON.stringify(keys) === JSON.stringify(expectedKeys)
      && detail.schema === 'fortress-fluid-action-product-v1'
      && detail.product === 'carbonate-acid-titration'
      && ['tweak_acidify', 'shift_acidify', 'acidify'].includes(detail.action)
      && Number.isSafeInteger(detail.accepted_at_step) && detail.accepted_at_step >= 0
      && typeof detail.before_pH === 'number' && Number.isFinite(detail.before_pH)
      && typeof detail.after_pH === 'number' && Number.isFinite(detail.after_pH)
      && detail.after_pH < detail.before_pH
      && detail.spatial_authority_schema === 'player-fluid-spatial-intervention-v1'
      && detail.spatial_authority_scope === 'canonical-nonvadose-voxel-volume'
      && Number.isSafeInteger(detail.spatial_authority_count)
      && detail.spatial_authority_count > 0
      && detail.spatial_authority_closed === true
      && detail.carbonate_transaction_kind === 'ph_titration'
      && Number.isSafeInteger(detail.carbonate_transaction_index)
      && detail.carbonate_transaction_index >= 0
      && Number.isSafeInteger(detail.carbonate_transactions_before_action)
      && detail.carbonate_transactions_before_action >= 0
      && Number.isSafeInteger(detail.carbonate_preparation_transfer_count)
      && detail.carbonate_preparation_transfer_count >= 0
      && detail.carbonate_transaction_index
        === detail.carbonate_transactions_before_action
          + detail.carbonate_preparation_transfer_count;
  }
  if (event.type === 'vugg:tutorial-view-state-committed') {
    const detail = event.detail;
    const authority = action.productState;
    const keys = detail && typeof detail === 'object' && !Array.isArray(detail)
      ? Object.keys(detail).sort() : [];
    const authorityKeys = authority && typeof authority === 'object' && !Array.isArray(authority)
      ? Object.keys(authority).sort() : [];
    if (JSON.stringify(keys) !== JSON.stringify([
      'schema', 'control', 'before_enabled', 'after_enabled',
    ].sort())
        || JSON.stringify(authorityKeys) !== JSON.stringify([
          'control', 'beforeEnabled', 'afterEnabled',
        ].sort())
        || detail.schema !== 'tutorial-view-state-product-v1'
        || !['topo-three-renderer', 'helix-overlay'].includes(detail.control)
        || detail.control !== authority.control
        || typeof detail.before_enabled !== 'boolean'
        || typeof detail.after_enabled !== 'boolean'
        || detail.before_enabled === detail.after_enabled
        || detail.before_enabled !== authority.beforeEnabled
        || detail.after_enabled !== authority.afterEnabled) return false;
    if (detail.control === 'topo-three-renderer'
        && typeof topoThreeRendererEnabled !== 'function') return false;
    if (detail.control === 'helix-overlay'
        && typeof helixOverlayEnabled !== 'function') return false;
    const current = detail.control === 'topo-three-renderer'
      ? topoThreeRendererEnabled() : helixOverlayEnabled();
    if (current !== detail.after_enabled) return false;
    return detail.control !== 'topo-three-renderer'
      || _tutorialTopoPresentationMatches(detail.after_enabled);
  }
  return true;
}

function _tutorialActionEvent(e) {
  const s = _tutorialState;
  if (!s) return;
  const stepIdx = s.stepIdx;
  const st = _tutCurrentStep();
  if (!st || _tutStepTrigger(st) !== 'action') return;
  const a = st.action;
  const wanted = a.event || 'click';
  if (e.type !== wanted) return;
  const t = e.target;
  if (!t || typeof t.closest !== 'function') return;
  let hit = null;
  try { hit = t.closest(a.selector); } catch (_error) { return; }
  if (!hit) return;
  if (!_tutorialActionTargetMatches(a, hit)) return;
  if (!_tutorialProductEventMatches(e, a, hit)) return;
  // Optional checkbox-state expectation (e.g. Dormant must be UNchecked).
  // On the 'input'/'change' events the value is already committed; on a
  // raw 'click' of a checkbox it may not be — but our checkbox actions
  // use 'change', so reading hit.checked here is correct.
  if (typeof a.checked === 'boolean'
      && (!('checked' in hit) || hit.checked !== a.checked)) return;
  // DEFER the advance one tick (capture phase — the target's own handler
  // hasn't run yet). This lets the game react first (create #helix-legend,
  // save the collected crystal + re-render the inventory, open the zone
  // modal, switch mode) before the next step renders + anchors. Guard on
  // stepIdx so a stray second event in the same tick can't double-advance.
  setTimeout(() => {
    if (_tutorialState === s && s.stepIdx === stepIdx) _tutorialAdvance();
  }, 0);
}
