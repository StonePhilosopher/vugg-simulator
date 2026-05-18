// ============================================================
// js/91-ui-legends.ts — UI — Legends (Simulation) mode
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// UI LOGIC — LEGENDS MODE (unchanged)
// ============================================================

let running = false;
// =====================================================================
// Simulation mode (internal name: "legends")
// =====================================================================
// User-visible label is "Simulation" (title card "🔬 Simulation", menu
// button "Simulation."). The `legends*` token is the pre-rename
// internal name still in this global, scenario-list helpers
// (legendsSimSource, etc.), and various comments. Token kept stable
// because the rename happened only at the user-visible surface — see
// commit 467e8c4. The post-game source field uses 'Simulation'.
// See proposals/BACKLOG.md "Internal token cleanup" for the deferred
// thorough rename.
let legendsSim = null;
// =====================================================================
// Record Player (internal name: "groove")
// =====================================================================
// User-visible label is "📀 Record Player" (title card, mode-switcher
// button). The `groove*` token is the pre-rename internal name spread
// across switchMode('groove'), playCollectedInGroove, mode-groove
// button ID, .groove-tooltip / .groove-canvas-wrap CSS classes, and
// the modal stand-in below. NOTE: the term "groove" is genuinely
// correct for the *visualization primitive* inside the Record Player
// — it really is a record's groove, read radially. So even if we
// rename the mode codepath, the rainbow-lane drawing routines stay
// "groove". See proposals/BACKLOG.md "Internal token cleanup".
let grooveModalCrystal = null;

function runSimulation() {
  if (running) return;
  const scenarioName = document.getElementById('scenario').value;
  // Tier 1 B: scenario data lives in data/scenarios.json5 and is
  // fetched asynchronously by _loadScenariosJSON5() at boot. If the
  // user clicks Grow before that completes (cold load, slow
  // connection, file:// protocol, fetch failure for any reason),
  // SCENARIOS[scenarioName] is undefined and the destructuring on
  // line ~65 below throws "Cannot read properties of undefined". This
  // guard catches that race: emit a friendly status into the output
  // panel + bail. The user can retry once the fetch finishes (it's
  // typically <100ms on warm cache, so the message is rarely seen).
  //
  // The guard checks the per-scenario callable rather than the global
  // _scenariosJson5Ready flag — covers the same race AND degrades
  // gracefully if a single scenario was malformed (the others still
  // load and the dropdown still works for those).
  if (!SCENARIOS || !SCENARIOS[scenarioName]) {
    const outputEl = document.getElementById('output');
    if (outputEl) {
      const msg = _scenariosJson5Ready
        ? `Scenario "${scenarioName}" is not registered. Reload the page to retry, or pick a different scenario.`
        : 'Scenarios are still loading from data/scenarios.json5 — try again in a moment.';
      // Append a line rather than wiping the panel; the output panel
      // is column-reverse + sticky-autoscroll, so the new line lands
      // at the visible top (see 711cc0e for the scrollTop sign-
      // convention lesson). Wrap in a <div> so it gets its own row.
      const line = document.createElement('div');
      line.textContent = `⚠ ${msg}`;
      line.style.color = '#c47';
      outputEl.appendChild(line);
    }
    return;
  }
  const seedInput = document.getElementById('seed').value;
  const stepsInput = document.getElementById('steps').value;
  // Boss directive 2026-05-11: cavity shape and crystal growth are
  // independently seeded so the player can lock one and vary the
  // other. The 'shape-seed' input (optional, separate UI field)
  // overrides the scenario's authored shape_seed when set; left
  // blank, the scenario's own shape_seed wins (so authored
  // localities — e.g. shape_seed=58 for Naica = 58°C — keep their
  // canonical cavities).
  const shapeSeedEl = document.getElementById('shape-seed') as HTMLInputElement | null;
  const shapeSeedInput = shapeSeedEl ? shapeSeedEl.value : '';

  const seed = seedInput ? parseInt(seedInput, 10) : Math.floor(Math.random() * 2147483647);
  rng = new SeededRandom(seed);

  const scenarioOverrides: any = {};
  if (shapeSeedInput) {
    const parsedShape = parseInt(shapeSeedInput, 10);
    if (Number.isFinite(parsedShape)) {
      scenarioOverrides.wall = { shape_seed: parsedShape };
    }
  }
  // Size-class override (2026-05). When the player picks a non-default
  // cavity-size in the Simulation Mode UI, we add BOTH size_class +
  // an explicit vug_diameter_mm to the override. The explicit mm has
  // to be supplied because _resolveVugDiameter prioritises explicit
  // vug_diameter_mm over size_class — and shipped scenarios all set
  // vug_diameter_mm in their wallKwargs, so a size_class-only override
  // would be silently ignored by the merge. The mm value comes from
  // resolveSizeClassToMm's literature midpoint so the player sees a
  // consistent number across modes.
  const sizeClassEl = document.getElementById('cavity-size') as HTMLSelectElement | null;
  const sizeClassOverride = sizeClassEl ? sizeClassEl.value : 'any';
  if (sizeClassOverride && sizeClassOverride !== 'any') {
    const mm = resolveSizeClassToMm(sizeClassOverride);
    if (mm != null) {
      scenarioOverrides.wall = {
        ...(scenarioOverrides.wall || {}),
        size_class: sizeClassOverride,
        vug_diameter_mm: mm,
      };
    }
  }
  const { conditions, events, defaultSteps } = SCENARIOS[scenarioName](scenarioOverrides);
  const parsedSteps = stepsInput ? parseInt(stepsInput, 10) : NaN;
  const totalSteps = (parsedSteps && parsedSteps > 0) ? parsedSteps : defaultSteps;

  const allLines = [];
  // Narrative-tempo Phase 1: track which line indices are step-header
  // sync points + their sim step number. displayLines() reads this map
  // and advances the topo cavity to the historical snapshot for that
  // step as the line scrolls in — reading and watching become the same
  // activity instead of "text scrolls while cavity sits frozen at the
  // final state". See proposals/PROPOSAL-NARRATIVE-TEMPO.md.
  const lineToStep: Record<number, number> = {};
  // Per-step line counts. boss 2026-05-11: each step takes a fixed
  // duration regardless of how many lines it has; line delays are
  // computed as stepDuration / lineCount inside displayLines.
  const stepLineCounts: Record<number, number> = {};
  // Click-to-continue gates: the prologue (title / fluid / events
  // list) shouldn't fire by under the user before they've registered
  // the setup; the epilogue (summary / narrative box) deserves the
  // same deliberate pacing as a payoff. We record the line index of
  // the first step-header (prologue ends just before it) and the line
  // index where the summary begins (epilogue starts there). Both are
  // -1 if not applicable (e.g. zero-step run or no summary lines).
  let prologueEndIdx = -1;
  let epilogueStartIdx = -1;

  allLines.push(`🪨 Vugg Simulator — ${scenarioName} scenario (seed: ${seed})`);
  allLines.push(`   ${totalSteps} time steps, starting at ${conditions.temperature.toFixed(0)}°C, ${conditions.pressure.toFixed(1)} kbar`);
  allLines.push(`   Initial fluid: ${conditions.fluid.describe()}`);
  allLines.push(`   Events: ${events.length}`);
  for (const e of events) allLines.push(`     Step ${e.step}: ${e.name}`);
  allLines.push('═'.repeat(70));

  const sim = new VugSimulator(conditions, events);
  legendsSim = sim;

  for (let s = 0; s < totalSteps; s++) {
    const log = sim.run_step();
    const show = (s % 5 === 0) || log.some(l => l.includes('EVENT') || l.includes('NUCLEATION') || l.includes('🧱'));
    if (show && log.length) {
      // The line index ABOUT TO BE PUSHED is the header for sim step (s+1).
      // run_step() advances this.step from s to s+1 internally, so the
      // header naturally reads "═══ Step N ═══" where N = s+1.
      if (prologueEndIdx === -1) prologueEndIdx = allLines.length;
      lineToStep[allLines.length] = s + 1;
      allLines.push(sim.format_header());
      let stepLines = 1;  // the header line counts toward the step's budget
      for (const line of log) {
        allLines.push(line);
        stepLines++;
      }
      stepLineCounts[s + 1] = stepLines;
    }
  }

  // Where the epilogue begins. Skipped (left at -1) when format_summary
  // returns no lines, which can happen for zero-crystal scenarios.
  const summaryLines = sim.format_summary();
  if (summaryLines.length) epilogueStartIdx = allLines.length;
  allLines.push(...summaryLines);

  // Boss directive 2026-05-12 (Phase 6 tempo polish):
  //  (1) Force scrollTo(0,0) so the user starts at the top of the page
  //      where the WALL PROFILE lives. The Begin-menu→Simulation path
  //      could leave the page scrolled down.
  //  (2) Hide the scenario controls panel while playback runs — that
  //      frees ~160 px of vertical space so cavity + output text fit
  //      in the viewport together. Both styling routes are handled:
  //      the body class enables the CSS rule for the topo-canvas-wrap
  //      max-height, AND we set legendsControls.style.display = 'none'
  //      directly because switchMode('legends') wrote an inline
  //      style='display:flex' that would otherwise trump the CSS rule
  //      by specificity. Restored to '' (clear inline override → CSS
  //      class .controls rule applies) in displayLines's cleanup tail.
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo(0, 0);
  }
  document.body.classList.add('legends-playing');
  const legendsControlsEl = document.getElementById('legends-controls');
  if (legendsControlsEl) legendsControlsEl.style.display = 'none';

  displayLines(allLines, lineToStep, sim, prologueEndIdx, epilogueStartIdx, undefined, undefined, stepLineCounts);

  // No updateLegendsInventory(sim) here — displayLines now seeds the
  // inventory at the first snapshot's step (so it starts empty / sparsely
  // populated) and walks it forward at each step-header line. The final
  // (live) re-paint happens in the displayLines cleanup tail when the
  // narrative finishes scrolling. Same for topoRender(final): the
  // cleanup-tail path inside displayLines handles it.
}

function runRandom() {
  const scenarios = ['cooling', 'pulse', 'mvt', 'porphyry'];
  const pick = scenarios[Math.floor(Math.random() * scenarios.length)];
  document.getElementById('scenario').value = pick;
  const seed = Math.floor(Math.random() * 2147483647);
  (document.getElementById('seed') as HTMLInputElement).value = String(seed);
  // Boss directive 2026-05-11: cavity-shape seed is independent.
  // Random run randomizes BOTH seeds — same scenario, fresh cavity
  // shape AND fresh crystal growth. Locking one and re-rolling the
  // other is what the per-input typed values are for.
  const shapeSeed = Math.floor(Math.random() * 2147483647);
  const shapeSeedEl = document.getElementById('shape-seed') as HTMLInputElement | null;
  if (shapeSeedEl) shapeSeedEl.value = String(shapeSeed);
  (document.getElementById('steps') as HTMLInputElement).value = '';
  document.getElementById('steps').setAttribute('value', '');
  runSimulation();
}

// Narrative-tempo: insert a "click to continue" pill at a story
// boundary (prologue→main or main→epilogue). The pill responds to
// click, Enter, or Space and removes itself before calling onResume.
// The keyboard listener is one-shot — installed when the pill mounts,
// removed when the user advances OR when the pill is replaced.
function _insertContinuePrompt(output: any, position: 'prologue' | 'epilogue', onResume: () => void) {
  const pill = document.createElement('div');
  pill.className = 'narrative-continue-pill';
  pill.dataset.position = position;
  pill.textContent = position === 'prologue'
    ? '▸ click to begin'
    : '▸ click to read the summary';
  pill.setAttribute('role', 'button');
  pill.setAttribute('tabindex', '0');
  output.appendChild(pill);
  // Focus the pill so screen readers announce it AND keyboard users
  // can press Enter / Space without an extra click. preventScroll:true
  // stops the browser from auto-scrolling the page to bring the pill
  // into view — when the output panel sits below the fold, focus()
  // without that flag yanks the page down ~250 px, which the user
  // reads as "the page automatically scrolls to the bottom"
  // (2026-05-11 boss bug report).
  try { pill.focus({ preventScroll: true } as any); } catch (_) {}

  let consumed = false;
  const resume = () => {
    if (consumed) return;
    consumed = true;
    document.removeEventListener('keydown', onKey, true);
    if (pill.parentNode) pill.parentNode.removeChild(pill);
    onResume();
  };
  const onKey = (ev: any) => {
    // Don't hijack typing in inputs.
    const tgt = ev.target as HTMLElement | null;
    if (tgt) {
      const tag = (tgt.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((tgt as any).isContentEditable) return;
    }
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      ev.stopPropagation();
      resume();
    }
  };
  pill.addEventListener('click', resume);
  // capture: true so the keydown listener fires before the replay-
  // shortcut listener in 99g-renderer-replay.ts, preventing Space
  // from triggering replay play/pause during the narrative pause.
  document.addEventListener('keydown', onKey, true);
}

// Narrative-tempo speed cluster — three discrete settings the boss
// specified 2026-05-11: "each step should take 2 seconds for the
// default speed, and a fast speed of 1 seconds, and one setting
// that is .2 of a second."
//
// The time unit is PER STEP, not per line. A step's lines are
// distributed uniformly across the step's allotted duration:
//   speed 1.0  →  step takes 2000 ms  →  default reading pace
//   speed 2.0  →  step takes 1000 ms  →  "fast"
//   speed 10.0 →  step takes  200 ms  →  "quick" / power-user skim
//
// Lives in the shared `_topoPlaybackSpeed` global so the replay bar's
// own speed buttons (still 0.5× / 1× / 2× / 4×) also move text rate,
// per the same boss directive.
function _showNarrativeSpeedCluster() {
  let cluster = document.getElementById('narrative-speed-cluster');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.id = 'narrative-speed-cluster';
    cluster.className = 'narrative-speed-cluster';
    // Three speeds, each labelled by per-step duration. Speed value
    // is the multiplier consumed by both narrative tempo (step
    // duration = 2000 / speed) and replay (frameMs / speed).
    const presets = [
      { speed: 1.0,  label: '2s',   title: 'Default — each step takes 2 seconds (reading pace)' },
      { speed: 2.0,  label: '1s',   title: 'Fast — each step takes 1 second (watching pace)' },
      { speed: 10.0, label: '0.2s', title: 'Quick — each step takes 0.2 seconds (skim pace)' },
    ];
    for (const p of presets) {
      const btn = document.createElement('button');
      btn.className = 'speed-btn';
      btn.dataset.speed = String(p.speed);
      btn.textContent = p.label;
      btn.title = p.title;
      btn.addEventListener('click', () => {
        if (typeof topoReplaySpeed === 'function') topoReplaySpeed(p.speed);
        _syncNarrativeSpeedCluster();
      });
      cluster.appendChild(btn);
    }
    document.body.appendChild(cluster);
  }
  cluster.style.display = 'flex';
  _syncNarrativeSpeedCluster();
}
function _hideNarrativeSpeedCluster() {
  const cluster = document.getElementById('narrative-speed-cluster');
  if (cluster) cluster.style.display = 'none';
}
function _syncNarrativeSpeedCluster() {
  const cluster = document.getElementById('narrative-speed-cluster');
  if (!cluster) return;
  const speed = (typeof _topoPlaybackSpeed === 'number') ? _topoPlaybackSpeed : 1.0;
  for (const btn of Array.from(cluster.querySelectorAll('.speed-btn'))) {
    const v = parseFloat((btn as HTMLElement).dataset.speed || '1');
    if (v === speed) (btn as HTMLElement).classList.add('active');
    else (btn as HTMLElement).classList.remove('active');
  }
}

// outputEl + onDone parameterise the tempo-aware narrative renderer so
// other modes (Quick Play / Phase 2; eventually Fortress / Phase 3)
// can drive the same scrolling rhythm into their own output panels.
// Defaults preserve the original Simulation-mode behaviour exactly.
//
// stepLineCounts: Record<simStep, lineCount> distributes a step's
// total lines uniformly across the step's allotted duration (the
// per-step model the boss specified 2026-05-11). Without it, we
// fall back to per-line fixed pacing.
// Phase 4 (2026-05-11): `displayLines` is now the SHARED narrative-
// tempo engine — used by Simulation, Quick Play, AND Fortress (which
// delegates via _fortressPaceLines). Mode-specific concerns become
// option params + callbacks:
//
//   clearOutput   - default true (Simulation/QuickPlay clear the
//                   panel); false makes Fortress's accumulating log
//                   work without wiping prior content.
//   appendLine    - per-mode line render. Default emits a generic
//                   span with class-based styling; Fortress passes
//                   appendFortressLine so its log keeps its tagged
//                   styling.
//   onStart/onDone- per-mode setup + teardown. Default Simulation
//                   behaviour (disable btn-grow + btn-random) runs
//                   when neither is supplied. Callers that need
//                   extra setup (e.g. Fortress's action-grid lock)
//                   provide their own and inherit the running-lock
//                   semantics from this engine.
//
// Pre-Phase 4 the Fortress version was ~150 duplicated lines in
// _fortressPaceLines. Now it's ~30. The replay timer in 99g stays
// separate (it iterates snapshots, not lines, and has its own scrub-
// bar UI). Replay unification is deferred to a future phase if
// the appetite for it materialises.
function displayLines(
  lines,
  lineToStep?: Record<number, number>,
  sim?: any,
  prologueEndIdx: number = -1,
  epilogueStartIdx: number = -1,
  outputEl?: HTMLElement | null,
  onDone?: () => void,
  stepLineCounts?: Record<number, number>,
  clearOutput: boolean = true,
  appendLine?: (out: HTMLElement, line: string) => void,
  onStart?: () => void,
) {
  // Resolve the target panel first — if it's missing we can't render
  // anything. Bail before setting running=true so the lock isn't left
  // stuck on an early exit. Callers that supplied an onDone get fired
  // so their post-render housekeeping still runs.
  const output = outputEl || document.getElementById('output');
  if (!output) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  running = true;
  if (typeof onStart === 'function') {
    onStart();
  } else {
    const grow = document.getElementById('btn-grow') as HTMLButtonElement | null;
    const random = document.getElementById('btn-random') as HTMLButtonElement | null;
    if (grow) grow.disabled = true;
    if (random) random.disabled = true;
  }
  if (clearOutput !== false) output.innerHTML = '';

  // Narrative-tempo Phase 1: walk the sim's wall_state_history once
  // to build a step→snapshot index, so addLine() can look up the
  // cavity state for any step in O(1) without re-scanning each tick.
  // History is decimated (v67 _replayStride), so not every step has
  // its own snapshot; the lookup returns the nearest-not-greater snap.
  const snapByStep: Map<number, any> = new Map();
  let stepOrder: number[] = [];
  if (sim && sim.wall_state_history) {
    for (const s of sim.wall_state_history) {
      if (s && s.step != null) {
        snapByStep.set(s.step, s);
        stepOrder.push(s.step);
      }
    }
    stepOrder.sort((a, b) => a - b);
  }
  function snapForStep(target: number): any {
    if (snapByStep.has(target)) return snapByStep.get(target);
    // Decimation gap — find the latest snapshot whose step <= target.
    // stepOrder is short (<100), linear scan from end is faster than
    // bsearch overhead for these sizes.
    for (let k = stepOrder.length - 1; k >= 0; k--) {
      if (stepOrder[k] <= target) return snapByStep.get(stepOrder[k]);
    }
    return null;
  }

  // Narrative-tempo Phase 6 (2026-05-12 boss report): per-line cavity
  // sync. Pre-fix, the cavity only re-rendered at lineToStep entries —
  // i.e., shown step-header lines, which fire every 5 sim steps or on
  // event/nucleation steps. Between two shown headers (step A → step B,
  // commonly 5 steps apart), the cavity sat frozen at step A while text
  // read through step A's detail lines, then JUMPED instantly to step B
  // at the next header. Boss wanted "the vugg crystal growth at the
  // same time and speed as its happening in the text."
  //
  // The fix is to advance the cavity through ALL intermediate snapshots
  // during a text block. We precompute, for every line index, the
  // cavity step that should be active when that line renders: start at
  // the current shown step at the header line, linearly interpolate
  // through hidden snapshots, end at the NEXT shown step on the final
  // line of the block. By the time the next shown step's header
  // arrives, the cavity is already there — no jump.
  //
  // Result: while the user reads "Step 1: Cu Pulse arrives" + several
  // detail lines, the cavity smoothly progresses through steps 1→2→
  // 3→4→5, showing the crystals actually growing during the moments
  // the text describes. Text describes the geological events at step
  // A; cavity shows the geological progression FROM step A toward step
  // B. They land aligned at every shown-step header.
  const headerLineIndices: number[] = [];
  if (lineToStep) {
    for (const key of Object.keys(lineToStep)) {
      headerLineIndices.push(+key);
    }
    headerLineIndices.sort((a, b) => a - b);
  }
  const lineToCavityStep: number[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    // Find bracketing shown-step headers: current (most recent at or
    // before i) and next (first one strictly after i). Both may be -1
    // if i is in the prologue or epilogue tail.
    let curIdx = -1, curStep = 0;
    let nextIdx = -1, nextStep = 0;
    for (const h of headerLineIndices) {
      if (h <= i) { curIdx = h; curStep = lineToStep![h]; }
      else { nextIdx = h; nextStep = lineToStep![h]; break; }
    }
    if (curIdx < 0 && nextIdx < 0) {
      // No headers at all — zero-event scenario. Hold at first
      // available snapshot.
      lineToCavityStep[i] = stepOrder.length ? stepOrder[0] : 1;
    } else if (curIdx < 0) {
      // Prologue lines before the first shown header. Hold the cavity
      // at the first shown step's pre-event state; the firstSnap
      // render in the block above already showed this state.
      lineToCavityStep[i] = nextStep;
    } else if (nextIdx < 0) {
      // Epilogue lines after the final shown header. Hold at the
      // simulation's last shown step.
      lineToCavityStep[i] = curStep;
    } else {
      // Within a block [curIdx, nextIdx). Linearly interpolate the
      // target step across the block's lines, landing on nextStep at
      // the line just before nextIdx. The header line itself (i ===
      // curIdx) gets curStep; the line immediately before the next
      // header gets ≈ nextStep.
      const blockLen = nextIdx - curIdx;
      const positionInBlock = i - curIdx;
      const t = blockLen > 0 ? positionInBlock / blockLen : 0;
      lineToCavityStep[i] = Math.round(curStep + t * (nextStep - curStep));
    }
  }

  // Render the first snapshot up front so the user sees the initial
  // cavity while the header lines (title / fluid / events list) scroll
  // in, instead of an empty panel. Falls through to live render if
  // history is empty.
  //
  // Skipped when clearOutput=false (Fortress) — that mode appends to
  // an accumulating log and the cavity is already showing the prior
  // step's state; rolling it back to the start of THIS action's range
  // would be jarring.
  if (clearOutput !== false && sim && stepOrder.length && typeof topoRender === 'function') {
    const firstSnap = snapByStep.get(stepOrder[0]);
    if (typeof _topoReplayActiveSnap !== 'undefined') _topoReplayActiveSnap = firstSnap;
    topoRender(firstSnap);
    // Narrative-tempo Phase 5 (2026-05-11 follow-up to boss bug report):
    // the Crystal Inventory panel was painting all crystals at their
    // FINAL grown sizes the moment runSimulation finished, even though
    // the narrative text was still scrolling Step 1. Sync the inventory
    // to the same step as the cavity so reading + watching land
    // together. updateLegendsInventory is also called at every step-
    // header line below + at the cleanup tail. (clearOutput truthiness
    // is already guaranteed by the outer if at line 341.)
    if (typeof updateLegendsInventory === 'function'
        && firstSnap && firstSnap.step != null) {
      updateLegendsInventory(sim, firstSnap.step);
    }
  }

  // Reverse-flow layout: new events go to the TOP, older content pushes
  // down. Boss directive 2026-05-11 — "thats the key to getting the
  // tempo to match." With flex column-reverse, the latest-prepended
  // line is read at the top, where the user's eye is already focused
  // on the cavity above. Old content drifts visibly downward as time
  // advances. The narrative-box's INTERNAL prose still reads
  // top-to-bottom (the box itself is one positioned child of #output,
  // its paragraphs flow normally inside it).
  //
  // Implementation: tag the output element + reuse CSS that sets
  // flex-direction:column-reverse. appendChild still appends to the
  // model order; CSS flips the visual order. This keeps the narrative-
  // box treatment (which would be awkward to prepend-line-by-line
  // because internal prose has logical top-to-bottom order) working
  // unchanged.
  output.classList.add('narrative-flow-reverse');

  // Per-step pacing (boss 2026-05-11). When the current line belongs
  // to a sim step (we track this via currentSimStep below + the
  // stepLineCounts map), per-line delay is the step's allotted time
  // divided by the number of lines in that step — so a step with 4
  // lines and a 2s budget gets 500 ms/line; a step with 12 lines and
  // the same budget gets ~167 ms/line. Step ALWAYS takes its full
  // duration regardless of line density.
  //
  // For framing lines (prologue, epilogue, separators between
  // steps) we fall back to baseMs / speed — same as v66 cadence,
  // but only for the framing.
  let currentSimStep: number | null = null;
  // Last cavity step we issued topoRender() for. Tracked independently
  // of currentSimStep so per-line interpolation can advance the cavity
  // through hidden snapshots within a shown-step block; see Phase 6
  // comment block below.
  let lastCavityStep: number | null = null;
  const stepDurationMs = () => {
    const speed = (typeof _topoPlaybackSpeed === 'number' && _topoPlaybackSpeed > 0)
      ? _topoPlaybackSpeed : 1.0;
    return 2000 / speed;
  };
  const perLineDelay = () => {
    if (currentSimStep != null && stepLineCounts && stepLineCounts[currentSimStep]) {
      return Math.max(4, Math.round(stepDurationMs() / stepLineCounts[currentSimStep]));
    }
    const speed = (typeof _topoPlaybackSpeed === 'number' && _topoPlaybackSpeed > 0)
      ? _topoPlaybackSpeed : 1.0;
    // Framing lines pace at 60 ms / speed — fast enough to feel
    // snappy through prologue/epilogue, slow enough that the user
    // sees them flow rather than blink.
    return Math.max(4, Math.round(60 / speed));
  };
  // Legacy helper kept for the narrative-box (inside-prose) handlers
  // below; those scroll at a fixed pace because they're block-level
  // prose, not per-step events.
  const baseSetTimeoutFor = (baseMs: number) => {
    const speed = (typeof _topoPlaybackSpeed === 'number' && _topoPlaybackSpeed > 0)
      ? _topoPlaybackSpeed : 1.0;
    return Math.max(4, Math.round(baseMs / speed));
  };

  // Sticky autoscroll (2026-05-12 boss bug report v2): originally I
  // assumed scrollTop=0 was the "newest visible at top" position in
  // a column-reverse panel. EMPIRICALLY WRONG in Chromium:
  //
  //   scrollTop = 0
  //     → viewport at the BOTTOM of the layout
  //     → in column-reverse that's where the FIRST DOM child sits,
  //       i.e. the OLDEST line (welcome / title)
  //
  //   scrollTop = -(scrollHeight - clientHeight)
  //     → viewport at the TOP of the layout
  //     → where the LAST DOM child sits, i.e. the NEWEST line
  //
  // Boss reported "the text box should follow the new text so its
  // always visible" — because the previous sticky-autoscroll logic
  // snapped to scrollTop=0 on each append, which actually pinned the
  // panel to OLDEST content. New lines kept appending above the
  // visible region. The welcome message stayed glued to the panel
  // bottom while everything interesting played off-screen.
  //
  // Correct contract:
  //   live position  = -(scrollHeight - clientHeight)  (newest at panel top)
  //   wasAtLive(x)   = x is within STICK_TOLERANCE_PX of live
  //   snapIfLive     = set scrollTop to live (= -(scrollHeight - clientHeight))
  //
  // The tolerance still handles pixel jitter. User scrolling UP from
  // live (toward scrollTop=0) brings older content into view; the
  // wasAtLive check returns false once they've moved past the
  // tolerance, and the auto-snap suspends so they can read in peace.
  // Once they scroll back toward the most-negative scrollTop, snap
  // resumes — same UX as before, just with the sign convention right.
  const STICK_TOLERANCE_PX = 24;
  const liveScrollTop = () => -(output.scrollHeight - output.clientHeight);
  const wasAtLive = () => Math.abs(output.scrollTop - liveScrollTop()) <= STICK_TOLERANCE_PX;
  const snapIfLive = (wasLive: boolean) => {
    if (wasLive) output.scrollTop = liveScrollTop();
  };

  let i = 0;
  let inNarrative = false;
  let narrativeEl = null;

  function addLine() {
    if (i >= lines.length) {
      running = false;
      // Default cleanup re-enables the Simulation buttons. Callers
      // that supplied an onStart get to do their own teardown via
      // onDone — Fortress uses this to re-enable its action grid.
      if (typeof onStart !== 'function') {
        const grow = document.getElementById('btn-grow') as HTMLButtonElement | null;
        const random = document.getElementById('btn-random') as HTMLButtonElement | null;
        if (grow) grow.disabled = false;
        if (random) random.disabled = false;
      }
      // Tempo cleanup: clear the replay-active snap so subsequent
      // renders read live sim state again, then paint the final
      // (live) topo. The user has finished reading; cavity sits on
      // the actual final state, ready for replay or further actions.
      if (typeof _topoReplayActiveSnap !== 'undefined') _topoReplayActiveSnap = null;
      if (typeof topoRender === 'function') topoRender();
      // Narrative-tempo Phase 5: re-paint the inventory at live state
      // so the Collect buttons re-enable and the final sizes appear.
      // Only for the Simulation engine (clearOutput=true); Fortress
      // tracks its own inventory outside this engine.
      if (clearOutput !== false && sim && typeof updateLegendsInventory === 'function') {
        updateLegendsInventory(sim);
      }
      // Phase 6 layout: narrative is done playing — restore the
      // scenario controls panel so the user can pick a new scenario,
      // tweak seeds, etc. without first re-clicking Grow. The empty
      // inline display lets the CSS .controls rule's display:flex
      // take effect, matching the original switchMode('legends')
      // state.
      if (clearOutput !== false) {
        document.body.classList.remove('legends-playing');
        const lcEl = document.getElementById('legends-controls');
        if (lcEl) lcEl.style.display = 'flex';
      }
      _hideNarrativeSpeedCluster();
      if (typeof onDone === 'function') onDone();
      return;
    }

    // Click-to-continue gates at the prologue→main and main→epilogue
    // boundaries. The user clicks the in-line prompt (or presses Space
    // / Enter) to advance. Without the gate, the title / fluid / event
    // list scrolls past too fast to register, and the summary blends
    // into the main scroll instead of landing as a payoff.
    //
    // Each gate fires exactly once. We disarm by setting the index to
    // -1 BEFORE inserting the pill, so when the pill's resume callback
    // re-enters addLine() with the same `i`, the gate check is false
    // and the line actually renders. Without this disarm, addLine
    // would re-insert the same pill on resume and lock in an infinite
    // pause loop.
    if (i === prologueEndIdx || i === epilogueStartIdx) {
      const isPrologue = (i === prologueEndIdx);
      if (isPrologue) prologueEndIdx = -1;
      else epilogueStartIdx = -1;
      // Capture scroll-state BEFORE _insertContinuePrompt's appendChild
      // so the sticky-autoscroll decision reflects the user's intent.
      const live = wasAtLive();
      _insertContinuePrompt(output, isPrologue ? 'prologue' : 'epilogue', () => {
        // Defer one tick so the click event finishes propagating before
        // the next addLine renders — prevents a double-advance if the
        // click also lands on a subsequently-rendered line.
        setTimeout(addLine, 0);
      });
      // Sticky snap — only force-scroll to the pill if the user was at
      // the live edge. Scrolled-away users keep their reading position.
      // (Pill is also focused via preventScroll:true so focus() doesn't
      // independently yank the page — see _insertContinuePrompt.)
      snapIfLive(live);
      return;
    }

    const line = lines[i];

    // Per-line cavity sync (Phase 6, boss 2026-05-12). Two distinct
    // step trackers must update here:
    //
    //   currentSimStep — the SHOWN step. Updates only at shown-step
    //     header lines (where lineToStep[i] is defined). Drives
    //     perLineDelay()'s line-budget lookup against stepLineCounts,
    //     which is keyed by shown step. Must stay equal to the header
    //     step throughout the block or pacing falls back to the
    //     framing rate.
    //
    //   lastCavityStep — the INTERPOLATED step the cavity should be
    //     rendering. Updates every line from the precomputed
    //     lineToCavityStep[] map. Drives topoRender + inventory sync.
    //     Advances through hidden snapshots within a block so crystals
    //     visibly grow during the text that describes them.
    if (lineToStep && lineToStep[i] != null) {
      currentSimStep = lineToStep[i];
    }
    const targetCavityStep = lineToCavityStep[i];
    if (targetCavityStep != null && targetCavityStep !== lastCavityStep) {
      lastCavityStep = targetCavityStep;
      const snap = snapForStep(targetCavityStep);
      if (snap) {
        if (typeof _topoReplayActiveSnap !== 'undefined') _topoReplayActiveSnap = snap;
        if (typeof topoRender === 'function') topoRender(snap);
      }
      // Sync Crystal Inventory at the same target step. clearOutput=false
      // (Fortress) keeps its own accumulating inventory outside this
      // engine, so we gate on that condition.
      if (clearOutput !== false && typeof updateLegendsInventory === 'function') {
        updateLegendsInventory(sim, targetCavityStep);
      }
    }

    i++;

    if (line === 'GEOLOGICAL HISTORY') {
      const live = wasAtLive();
      const box = document.createElement('div');
      box.className = 'narrative-box';
      const title = document.createElement('div');
      title.className = 'narrative-title';
      title.textContent = 'GEOLOGICAL HISTORY';
      box.appendChild(title);
      narrativeEl = document.createElement('div');
      box.appendChild(narrativeEl);
      output.appendChild(box);
      inNarrative = true;
      snapIfLive(live);
      setTimeout(addLine, baseSetTimeoutFor(20));
      return;
    }

    if (inNarrative && line.startsWith('═'.repeat(10))) {
      const live = wasAtLive();
      inNarrative = false;
      const span = document.createElement('div');
      span.textContent = line;
      span.className = 'line-header';
      output.appendChild(span);
      snapIfLive(live);
      setTimeout(addLine, baseSetTimeoutFor(20));
      return;
    }

    if (inNarrative && line.startsWith('─'.repeat(10))) {
      setTimeout(addLine, baseSetTimeoutFor(5));
      return;
    }

    if (inNarrative) {
      const live = wasAtLive();
      // Within a narrative-box, paragraphs flow top-to-bottom inside
      // the box (normal reading order). Use appendChild so the box's
      // internal layout stays natural, even though the outer #output
      // is column-reverse.
      const span = document.createElement('div');
      span.textContent = line;
      span.style.marginBottom = line === '' ? '0.5em' : '0';
      narrativeEl.appendChild(span);
      snapIfLive(live);
      setTimeout(addLine, baseSetTimeoutFor(20));
      return;
    }

    // Append the line using the caller's renderer if provided,
    // otherwise the default span+class styling. Fortress passes
    // appendFortressLine so its log keeps its line-event / line-
    // dissolution / etc. classes plus its fortressLogLines.push side
    // effect.
    const live = wasAtLive();
    if (appendLine) {
      appendLine(output, line);
    } else {
      const span = document.createElement('div');
      span.textContent = line;
      if (line.includes('🧱')) span.className = 'line-wall';
      else if (line.includes('⚡')) span.className = 'line-event';
      else if (line.includes('✦')) span.className = 'line-nucleation';
      else if (line.includes('═══ Step') || line.startsWith('═')) span.className = 'line-header';
      else if (line.includes('⬇') || line.includes('DISSOLUTION')) span.className = 'line-dissolution';
      output.appendChild(span);
    }
    // Sticky autoscroll: column-reverse puts the latest appendChild at
    // the visual top, so scrollTop=0 keeps the newest line in view —
    // but only if the user hasn't scrolled away to read history.
    // Scrolled-away users keep their position so they can finish
    // reading; once they scroll back to within STICK_TOLERANCE_PX of
    // the live edge, auto-snap resumes.
    snapIfLive(live);
    setTimeout(addLine, perLineDelay());
  }

  // Mount the speed cluster so the user can change the scroll rate
  // mid-stream. The buttons live on the replay bar; we surface only
  // the speed cluster (not play/pause/scrub which don't apply during
  // live narrative play). Hidden again in onDone or on resume after a
  // click-to-continue pill if the next phase needs it suppressed.
  _showNarrativeSpeedCluster();

  addLine();
}

function copyOutput() {
  const output = document.getElementById('output');
  const text = output.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = document.getElementById('btn-copy');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

