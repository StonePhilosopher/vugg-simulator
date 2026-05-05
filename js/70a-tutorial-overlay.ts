// ============================================================
// js/70a-tutorial-overlay.ts — events for tutorial overlay
// ============================================================
// Extracted from 70-events.ts. 7 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


function showCallout(opts) {
  hideCallout();
  const { anchor, text, side, highlight } = Object.assign(
    { side: 'auto', highlight: true }, opts || {}
  );
  const anchorEl = (typeof anchor === 'string') ? document.querySelector(anchor) : anchor;
  if (!anchorEl) {
    console.warn('showCallout: anchor not found:', anchor);
    return;
  }
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'tutorial-callout';
  tooltipEl.textContent = text || '';
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
  _tutorialState = { steps: tut.steps.slice(), stepIdx: 0 };
  document.body.classList.add('tutorial-active');

  // Whitelist the Advance button so it survives the control-locking CSS.
  const adv = document.getElementById('f-advance');
  if (adv) adv.classList.add('tutorial-allow');

  // Fire any steps whose trigger is already satisfied (typically step:0).
  _maybeAdvanceTutorial();
}

function endTutorial() {
  _tutorialState = null;
  document.body.classList.remove('tutorial-active');
  document.querySelectorAll('.tutorial-allow').forEach(el => el.classList.remove('tutorial-allow'));
  hideCallout();
}

function _maybeAdvanceTutorial() {
  if (!_tutorialState) return;
  if (typeof fortressSim === 'undefined' || !fortressSim) return;
  const s = _tutorialState;
  const cur = fortressSim.step || 0;
  // Walk forward, firing every step whose trigger is satisfied.
  // showCallout replaces, so only the last one in the burst stays
  // visible — authors should put one callout per sim-step trigger.
  let lastFired = null;
  while (s.stepIdx < s.steps.length && (s.steps[s.stepIdx].step || 0) <= cur) {
    lastFired = s.steps[s.stepIdx];
    s.stepIdx++;
  }
  if (lastFired) {
    showCallout({
      anchor: lastFired.anchor || '#f-advance',
      text: lastFired.text || '',
      side: lastFired.side || 'auto',
    });
  }
}
