// ============================================================
// tools/tutorial-lint.mjs — static lint for tutorial overlay scripts
// ============================================================
// Born in the 2026-07-07 tutorial-parity pass (T2/T3 rework + engine
// v3.1). Parses data/scenarios.json5 exactly the way the game does
// (the minimal JSONC strip in js/70-events.ts) and checks every
// scenario that carries a `tutorial` block:
//
//   1. sim-step `step:` numbers are strictly increasing within a script
//      (the burst-consume loop walks forward only — a step:N that never
//      becomes "due" after an earlier step:M>N stalls the machine).
//   2. every anchor that is a plain #id exists in index.html (class /
//      compound selectors are noted, not checked — jsdom-free static
//      pass; the engine falls back #topo-panel → body at runtime, so a
//      missing anchor is a soft bug: the callout points at the wrong
//      thing).
//   3. no `//` inside step text/hint — the JSONC parser strips from
//      any `//` to end-of-line EVEN INSIDE STRINGS (the known URL
//      gotcha), so text containing it would truncate the whole line
//      and usually break the parse.
//   4. action steps carry a selector; `checked:` only with
//      event 'change'/'input'; typed dataset/value/selection authority uses
//      the exact runtime schema from 70a-tutorial-overlay.ts.
//   5. reports the trigger sequence + sim-step→(action|continue)
//      junctions (v3.1 PAUSE points — informational, they're legal
//      now; listed so an author can see where a Continue press lands).
//
// Usage: node tools/tutorial-lint.mjs           (exit 1 on hard errors)
//        node tools/tutorial-lint.mjs --quiet   (errors only)
//
// PASSIVE instrument: warnings never gate; only structural errors
// (1, 3-parse, 4) exit non-zero.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');

// Mirror of _parseJSON5 in js/70-events.ts — keep in sync.
function parseJSON5(text) {
  text = text.replace(/\/\/[^\n]*/g, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  text = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

const rawSpec = readFileSync(join(root, 'data', 'scenarios.json5'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

let doc;
try {
  doc = parseJSON5(rawSpec);
} catch (err) {
  console.error(`[tutorial-lint] data/scenarios.json5 does not survive the game's JSONC parse: ${err.message}`);
  console.error('[tutorial-lint] (most common cause: a // inside a string — the parser strips to end-of-line)');
  process.exit(1);
}

// The raw (pre-strip) text still holds the strings; `//` inside a JSON
// string survives into parsed values only if the parse succeeded DESPITE
// it (e.g. the strip happened to leave valid JSON) — so check parsed
// values too, belt and braces.
function findDoubleSlash(str) {
  return typeof str === 'string' && str.includes('//');
}

const idExists = (id) => html.includes(`id="${id}"`);
const runtimeAnchorIds = new Set([
  'narrative-speed-cluster',
  'sat-hover-pop',
]);

function validDatasetExpectation(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length > 0
    && Object.entries(value).every(([key, expected]) =>
      /^[A-Za-z][A-Za-z0-9]*$/.test(key) && typeof expected === 'string');
}

function validViewProductState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys) === JSON.stringify([
    'control', 'beforeEnabled', 'afterEnabled',
  ].sort())
    && ['topo-three-renderer', 'helix-overlay'].includes(value.control)
    && typeof value.beforeEnabled === 'boolean'
    && typeof value.afterEnabled === 'boolean'
    && value.beforeEnabled !== value.afterEnabled;
}

function validTargetAuthority(action, allowContext = true) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'dataset')
      && !validDatasetExpectation(action.dataset)) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'within')) {
    const within = action.within;
    if (!within || typeof within !== 'object' || Array.isArray(within)
        || typeof within.selector !== 'string' || !within.selector.trim()
        || !validDatasetExpectation(within.dataset)) return false;
  }
  if (Object.prototype.hasOwnProperty.call(action, 'valueNormalized')
      && (typeof action.valueNormalized !== 'string' || !action.valueNormalized.trim())) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'valueExact')
      && typeof action.valueExact !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(action, 'selectedDataset')
      && !validDatasetExpectation(action.selectedDataset)) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'latestStoredStrip')
      && action.latestStoredStrip !== true) return false;
  if (Object.prototype.hasOwnProperty.call(action, 'context')) {
    if (!allowContext || !Array.isArray(action.context) || !action.context.length) return false;
    for (const condition of action.context) {
      if (!condition || typeof condition.selector !== 'string' || !condition.selector.trim()
          || !validTargetAuthority(condition, false)) return false;
      const predicates = ['dataset', 'within', 'valueNormalized', 'valueExact', 'selectedDataset']
        .filter(key => Object.prototype.hasOwnProperty.call(condition, key));
      if (!predicates.length) return false;
    }
  }
  return true;
}

let errors = 0, warnings = 0;
const scenarios = Object.entries(doc.scenarios || {}).filter(([, s]) => s.tutorial);

for (const [id, spec] of scenarios) {
  const tut = spec.tutorial;
  const steps = Array.isArray(tut.steps) ? tut.steps : [];
  const seq = [];
  let lastSim = -Infinity;
  const junctions = [];

  if (tut.mode === 'legends') {
    const preset = tut.preset;
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)
        || !Object.prototype.hasOwnProperty.call(preset, 'seed')
        || !Object.prototype.hasOwnProperty.call(preset, 'steps')
        || typeof preset.shapeSeed !== 'string'
        || typeof preset.cavitySize !== 'string' || !preset.cavitySize.trim()) {
      console.error(`[tutorial-lint] ${id}: Simulation tutorial preset must own seed, steps, shapeSeed, and cavitySize`);
      errors++;
    }
    const growAction = steps.find(st => st?.action?.selector === '#btn-grow')?.action;
    const commandSelectors = new Map((growAction?.context || []).map(row => [row?.selector, row]));
    const required = ['#scenario', '#seed', '#steps', '#shape-seed', '#cavity-size'];
    if (!growAction || required.some(selector => !commandSelectors.has(selector))
        || commandSelectors.get('#shape-seed')?.valueExact !== preset?.shapeSeed
        || commandSelectors.get('#cavity-size')?.valueExact !== preset?.cavitySize) {
      console.error(`[tutorial-lint] ${id}: Grow authority must bind the complete authored Simulation command`);
      errors++;
    }
  }

  steps.forEach((st, i) => {
    const trig = (typeof st.step === 'number') ? 'simstep'
      : (st.action && st.action.selector) ? 'action' : 'continue';
    seq.push(trig === 'simstep' ? `step:${st.step}` : trig);

    if (trig === 'simstep') {
      if (st.step <= lastSim) {
        console.error(`[tutorial-lint] ${id} step[${i}]: sim-step ${st.step} not greater than previous ${lastSim} — the machine walks forward only; this step can never fire in order`);
        errors++;
      }
      lastSim = st.step;
      const nx = steps[i + 1];
      if (nx && typeof nx.step !== 'number') {
        junctions.push(`step:${st.step}→${(nx.action && nx.action.selector) ? 'action' : 'continue'}[${i + 1}]`);
      }
    }

    if (st.action && !st.action.selector) {
      console.error(`[tutorial-lint] ${id} step[${i}]: action without selector`);
      errors++;
    }
    if (st.action && typeof st.action.checked === 'boolean'
        && st.action.event !== 'change' && st.action.event !== 'input') {
      console.error(`[tutorial-lint] ${id} step[${i}]: checked: expectation with event '${st.action.event || 'click'}' — checkbox state is only committed on change/input`);
      errors++;
    }
    if (st.action && Object.prototype.hasOwnProperty.call(st.action, 'dataset')
        && !validDatasetExpectation(st.action.dataset)) {
      console.error(`[tutorial-lint] ${id} step[${i}]: dataset authority must be a nonempty string map`);
      errors++;
    }
    if (st.action && Object.prototype.hasOwnProperty.call(st.action, 'within')) {
      const within = st.action.within;
      if (!within || typeof within !== 'object' || Array.isArray(within)
          || typeof within.selector !== 'string' || !within.selector.trim()
          || !validDatasetExpectation(within.dataset)) {
        console.error(`[tutorial-lint] ${id} step[${i}]: within authority requires selector + nonempty string dataset map`);
        errors++;
      }
    }
    if (st.action && Object.prototype.hasOwnProperty.call(st.action, 'valueNormalized')
        && (typeof st.action.valueNormalized !== 'string' || !st.action.valueNormalized.trim())) {
      console.error(`[tutorial-lint] ${id} step[${i}]: valueNormalized authority must be a nonempty string`);
      errors++;
    }
    if (st.action && Object.prototype.hasOwnProperty.call(st.action, 'valueExact')
        && typeof st.action.valueExact !== 'string') {
      console.error(`[tutorial-lint] ${id} step[${i}]: valueExact authority must be a string`);
      errors++;
    }
    if (st.action && Object.prototype.hasOwnProperty.call(st.action, 'selectedDataset')
        && !validDatasetExpectation(st.action.selectedDataset)) {
      console.error(`[tutorial-lint] ${id} step[${i}]: selectedDataset authority must be a nonempty string map`);
      errors++;
    }
    if (st.action && !validTargetAuthority(st.action)) {
      console.error(`[tutorial-lint] ${id} step[${i}]: malformed target/context authority`);
      errors++;
    }
    if (st.action?.event === 'vugg:crystal-collected'
        && (!st.action.within || !validDatasetExpectation(st.action.within.dataset))) {
      console.error(`[tutorial-lint] ${id} step[${i}]: collection success must bind an exact crystal owner`);
      errors++;
    }
    if (st.action?.event === 'vugg:strip-opened' && st.action.latestStoredStrip !== true) {
      console.error(`[tutorial-lint] ${id} step[${i}]: strip success must bind the latest durable production run`);
      errors++;
    }
    if (st.action?.event === 'vugg:fortress-fluid-action-committed'
        && (st.action.selector !== '.action-grid'
          || st.action.productAction !== 'carbonate-acid-titration')) {
      console.error(`[tutorial-lint] ${id} step[${i}]: fluid action success must bind the carbonate titration product`);
      errors++;
    }
    if (st.action?.event === 'vugg:tutorial-view-state-committed'
        && !validViewProductState(st.action.productState)) {
      console.error(`[tutorial-lint] ${id} step[${i}]: viewer action must bind an exact changing product state`);
      errors++;
    }
    if (Object.prototype.hasOwnProperty.call(st, 'requiresCapability')
        && st.requiresCapability !== 'three-renderer') {
      console.error(`[tutorial-lint] ${id} step[${i}]: unknown tutorial capability ${String(st.requiresCapability)}`);
      errors++;
    }
    if (Object.prototype.hasOwnProperty.call(st, 'capabilityFallbackText')
        && (typeof st.capabilityFallbackText !== 'string'
          || !st.capabilityFallbackText.trim())) {
      console.error(`[tutorial-lint] ${id} step[${i}]: capability fallback text must be nonempty`);
      errors++;
    }
    for (const field of ['text', 'hint', 'capabilityFallbackText']) {
      if (findDoubleSlash(st[field])) {
        console.error(`[tutorial-lint] ${id} step[${i}]: ${field} contains '//' — the JSONC strip eats it (URL gotcha)`);
        errors++;
      }
    }
    const anchor = st.anchor || '';
    if (/^#[\w-]+$/.test(anchor)) {
      if (!idExists(anchor.slice(1)) && !runtimeAnchorIds.has(anchor.slice(1))) {
        // Soft: some anchors are created at runtime (#helix-legend).
        console.warn(`[tutorial-lint] ${id} step[${i}]: anchor ${anchor} has no static id in index.html (runtime-created, or a typo — engine falls back to #topo-panel)`);
        warnings++;
      }
    }
  });

  if (id === 'tutorial_first_crystal') {
    const diagnosisIdx = steps.findIndex(st => st.action?.event === 'click'
      && st.action?.selector === '#f-sat-bar .sat-indicator');
    if (diagnosisIdx < 0) {
      console.error('[tutorial-lint] tutorial_first_crystal: Grand Tour must require the player to open a mineral formation diagnosis');
      errors++;
    } else {
      const explanation = steps[diagnosisIdx + 1];
      const text = explanation?.text || '';
      const requiredConcepts = ['saturation', 'limiting reagents', 'temperature', 'pH', 'redox', 'substrate', 'competition'];
      const missing = requiredConcepts.filter(term => !text.toLowerCase().includes(term.toLowerCase()));
      if (explanation?.anchor !== '#sat-hover-pop' || missing.length) {
        console.error(`[tutorial-lint] tutorial_first_crystal: formation diagnosis follow-up must anchor to #sat-hover-pop and teach every causal group (missing: ${missing.join(', ') || 'anchor'})`);
        errors++;
      }
    }
  }

  if (!quiet) {
    console.log(`[tutorial-lint] ${id}: ${steps.length} steps — ${seq.join(' · ')}`);
    if (junctions.length) console.log(`[tutorial-lint]   v3.1 pause junctions: ${junctions.join(', ')}`);
  }
}

if (!quiet || errors || warnings) {
  console.log(`[tutorial-lint] ${scenarios.length} tutorial scripts · ${errors} error(s) · ${warnings} warning(s)`);
}
process.exit(errors ? 1 : 0);
