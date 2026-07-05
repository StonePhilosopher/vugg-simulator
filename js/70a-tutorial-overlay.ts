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
//                                     checked: true|false }      // optional checkbox state
//   (neither)                   — CONTINUE trigger: advances on the
//                                 callout's Continue button, Enter,
//                                 or Space.
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
// Optional tutorial-level field:
//   tutorial.unlock: [...]      — controls whitelisted at start.
//                                 DEFAULTS to ['#f-advance'] so the
//                                 legacy sim-step tutorials keep their
//                                 Advance button; the Grand Tour sets
//                                 [] and unlocks progressively.
//
// Control locking is CSS-driven off body.tutorial-active (see
// index.html): action buttons are now VISIBLE-BUT-INERT (dimmed,
// pointer-events none) rather than display:none — a newcomer should
// see that the instrument panel exists before earning it.


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

function startTutorial(scenarioName) {
  // Boot the underlying scenario in Creative Mode first.
  if (typeof startScenarioInCreative !== 'function') {
    console.error('startTutorial: startScenarioInCreative not available');
    return;
  }
  startScenarioInCreative(scenarioName);

  const make = (typeof SCENARIOS !== 'undefined') ? SCENARIOS[scenarioName] : null;
  const spec = make && make._json5_spec;
  const tut = spec && spec.tutorial;
  if (!tut || !Array.isArray(tut.steps) || !tut.steps.length) {
    console.warn('startTutorial: scenario has no tutorial.steps:', scenarioName);
    return; // scenario still runs, just without overlay
  }
  _tutorialState = { steps: tut.steps.slice(), stepIdx: 0, renderedIdx: -1 };
  document.body.classList.add('tutorial-active');

  // Starting whitelist. Legacy tutorials (no tutorial.unlock field) keep
  // their Advance button; the Grand Tour passes [] and unlocks per-step.
  const startAllow = Array.isArray(tut.unlock) ? tut.unlock : ['#f-advance'];
  for (const sel of startAllow) {
    document.querySelectorAll(sel).forEach(el => el.classList.add('tutorial-allow'));
  }

  // Engine-v2 listeners: Enter/Space for continue steps; delegated
  // click/change for action steps. Bubble phase for the action
  // listeners so the game's own handler runs FIRST (e.g. the ⌇
  // toggle creates #helix-legend before the next step anchors to it).
  document.addEventListener('keydown', _tutorialKeydown, true);
  document.addEventListener('click', _tutorialActionEvent, false);
  document.addEventListener('change', _tutorialActionEvent, false);

  // Fire any steps whose trigger is already satisfied (typically the
  // welcome step, or step:0 in the legacy tutorials).
  _maybeAdvanceTutorial();
}

function endTutorial() {
  _tutorialState = null;
  document.body.classList.remove('tutorial-active');
  document.querySelectorAll('.tutorial-allow').forEach(el => el.classList.remove('tutorial-allow'));
  document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
  document.removeEventListener('keydown', _tutorialKeydown, true);
  document.removeEventListener('click', _tutorialActionEvent, false);
  document.removeEventListener('change', _tutorialActionEvent, false);
  hideCallout();
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

// ---- the state machine ------------------------------------------

// Advance past the current (continue/action) step: the player clicked
// Continue, pressed Enter/Space, or performed the awaited action.
function _tutorialAdvance() {
  const s = _tutorialState;
  if (!s) return;
  s.stepIdx++;
  if (s.stepIdx >= s.steps.length) {
    // Explicit finish (last step was continue/action) — clean teardown.
    endTutorial();
    return;
  }
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
  const st = s.steps[s.stepIdx];
  const trig = _tutStepTrigger(st);
  if (trig !== 'simstep') {
    // Waiting on the player — render once (fortress ticks re-enter here;
    // renderedIdx keeps the callout from flickering on every action).
    if (s.renderedIdx !== s.stepIdx) _renderTutorialStep(s.stepIdx, trig);
    return;
  }
  if (typeof fortressSim === 'undefined' || !fortressSim) return;
  const cur = fortressSim.step || 0;
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
    _renderTutorialStep(lastFiredIdx, 'simstep');
    // A trailing continue/action step supersedes the fired callout
    // immediately (authors: don't butt one right against a sim-step).
    if (s.stepIdx < s.steps.length) {
      const nx = s.steps[s.stepIdx];
      const nt = _tutStepTrigger(nx);
      if (nt !== 'simstep') _renderTutorialStep(s.stepIdx, nt);
    }
  }
}

function _renderTutorialStep(idx, trig) {
  const s = _tutorialState;
  if (!s) return;
  s.renderedIdx = idx;
  const st = s.steps[idx];

  // Progressive unlock — accumulates until endTutorial clears it.
  for (const sel of (st.unlock || [])) {
    document.querySelectorAll(sel).forEach(el => el.classList.add('tutorial-allow'));
  }
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
  const st = _tutCurrentStep();
  if (!st || _tutStepTrigger(st) !== 'continue') return;
  if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'Space') return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' || t.isContentEditable)) return;
  // A focused game button would ALSO activate on Space/Enter — blur it
  // so one keypress can't both advance the tutorial and press a button.
  if (t && t.tagName === 'BUTTON') t.blur();
  e.preventDefault();
  e.stopPropagation();
  _tutorialAdvance();
}

function _tutorialActionEvent(e) {
  const st = _tutCurrentStep();
  if (!st || _tutStepTrigger(st) !== 'action') return;
  const a = st.action;
  const wanted = a.event || 'click';
  if (e.type !== wanted) return;
  const t = e.target;
  if (!t || typeof t.closest !== 'function') return;
  const hit = t.closest(a.selector);
  if (!hit) return;
  // Optional checkbox-state expectation (e.g. Dormant must be UNchecked).
  if (typeof a.checked === 'boolean' && ('checked' in hit) && hit.checked !== a.checked) return;
  _tutorialAdvance();
}
