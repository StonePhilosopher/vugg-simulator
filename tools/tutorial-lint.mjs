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
//      event 'change'/'input'.
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

let errors = 0, warnings = 0;
const scenarios = Object.entries(doc.scenarios || {}).filter(([, s]) => s.tutorial);

for (const [id, spec] of scenarios) {
  const tut = spec.tutorial;
  const steps = Array.isArray(tut.steps) ? tut.steps : [];
  const seq = [];
  let lastSim = -Infinity;
  const junctions = [];

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
    for (const field of ['text', 'hint']) {
      if (findDoubleSlash(st[field])) {
        console.error(`[tutorial-lint] ${id} step[${i}]: ${field} contains '//' — the JSONC strip eats it (URL gotcha)`);
        errors++;
      }
    }
    const anchor = st.anchor || '';
    if (/^#[\w-]+$/.test(anchor)) {
      if (!idExists(anchor.slice(1))) {
        // Soft: some anchors are created at runtime (#helix-legend).
        console.warn(`[tutorial-lint] ${id} step[${i}]: anchor ${anchor} has no static id in index.html (runtime-created, or a typo — engine falls back to #topo-panel)`);
        warnings++;
      }
    }
  });

  if (!quiet) {
    console.log(`[tutorial-lint] ${id}: ${steps.length} steps — ${seq.join(' · ')}`);
    if (junctions.length) console.log(`[tutorial-lint]   v3.1 pause junctions: ${junctions.join(', ')}`);
  }
}

if (!quiet || errors || warnings) {
  console.log(`[tutorial-lint] ${scenarios.length} tutorial scripts · ${errors} error(s) · ${warnings} warning(s)`);
}
process.exit(errors ? 1 : 0);
