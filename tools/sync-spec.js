#!/usr/bin/env node
// ============================================================
// sync-spec.js — cross-runtime mineral-spec consistency check
// ============================================================
// Why this exists:
//   The simulation engine is implemented THREE TIMES — vugg.py (the dev/
//   test harness, where pytest runs), index.html (the shipped product
//   served by GitHub Pages), and agent-api/vugg-agent.js (an intentionally-
//   simpler headless CLI for AI agents). Same 84 grow_*() functions, same
//   84 mineral declarations, same scenarios — three implementations.
//
//   That duplication is real maintenance tax (drift surfaces silently) but
//   the boss has decided the dev-in-Python / ship-as-JS workflow is worth
//   keeping until ~100 minerals or until the natural workflow cycle. Until
//   then, this tool is the drift detector.
//
//   Endgame plan: when Python is dropped, this tool retires with it.
//   Until then: extend it. Cross-engine baseline tests (option-3 in the
//   architecture review) build on top of this — same data, same seeds,
//   diff the inventories at finish, fail loud on drift.
//
// Usage:
//   node tools/sync-spec.js            # report mode — prints drift, exits 1 if any
//   node tools/sync-spec.js --fix      # apply fixes in-place where safe (embed updates only)
//   node tools/sync-spec.js --verbose  # verbose diff output
//
// What it checks:
//   1. data/minerals.json is valid JSON with every mineral declaring every
//      required field (per _schema).
//   2. index.html's embedded MINERAL_SPEC_FALLBACK covers every mineral
//      in data/minerals.json, with consistent max_size_cm,
//      thermal_decomp_C, nucleation_sigma, growth_rate_mult, and class.
//   3. agent-api/vugg-agent.js loads data/minerals.json via require() —
//      no separate embed to drift from. Just verifies the require is there.
//   4. Every mineral's narrate_function field names a method that actually
//      exists in vugg.py (pattern match, not execution).
//   5. Every mineral's runtimes_present claim matches reality.
//
// Exit codes:
//   0 — no drift
//   1 — drift detected (report mode) or fix applied (fix mode)
//   2 — unrecoverable error (missing files, invalid JSON, etc.)
//
// History:
//   Pre-flatten (commit 9625d3a and earlier) this also checked the
//   docs/index.html and docs/data/minerals.json mirrors. GitHub Pages now
//   serves from repo root, so those mirrors are gone — see
//   ARCHITECTURE.md for the layout-flatten note.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SPEC_PATH   = path.join(REPO, 'data', 'minerals.json');
const INDEX_PATH  = path.join(REPO, 'index.html');
const AGENT_PATH  = path.join(REPO, 'agent-api', 'vugg-agent.js');
const VUGG_PATH   = path.join(REPO, 'vugg.py');

const args = new Set(process.argv.slice(2));
const MODE_FIX = args.has('--fix');
const VERBOSE  = args.has('--verbose');

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', RST = '\x1b[0m';
const ok     = (s) => console.log(`${GRN}✓${RST} ${s}`);
const warn   = (s) => console.log(`${YEL}⚠${RST} ${s}`);
const fail   = (s) => console.log(`${RED}✗${RST} ${s}`);
const info   = (s) => VERBOSE && console.log(`${DIM}  ${s}${RST}`);

// ---- Load spec ----
let spec;
try {
  spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
} catch (e) {
  console.error(`${RED}FATAL${RST}: cannot load ${SPEC_PATH}: ${e.message}`);
  process.exit(2);
}
const minerals = spec.minerals;
const mineralNames = Object.keys(minerals);
ok(`loaded ${SPEC_PATH} — ${mineralNames.length} minerals declared`);

// ---- Load runtime files ----
function readOrNull(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
const indexSrc = readOrNull(INDEX_PATH);
const agentSrc = readOrNull(AGENT_PATH);
const vuggSrc  = readOrNull(VUGG_PATH);

if (!indexSrc || !agentSrc || !vuggSrc) {
  console.error(`${RED}FATAL${RST}: missing one of index.html, agent-api/vugg-agent.js, vugg.py`);
  process.exit(2);
}

let drift = 0;
const driftLog = [];
const record = (msg) => { drift++; driftLog.push(msg); fail(msg); };

// ---- Check 1: spec field completeness ----
const REQUIRED_FIELDS = [
  'formula', 'nucleation_sigma', 'max_size_cm', 'growth_rate_mult',
  'thermal_decomp_C', 'fluorescence', 'twin_laws', 'acid_dissolution',
  'habit', 'narrate_function', 'runtimes_present',
  'class', 'description', 'scenarios', 'habit_variants',
];
for (const name of mineralNames) {
  const m = minerals[name];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in m)) record(`spec: ${name}.${f} is missing (required per _schema)`);
  }
}

// ---- Check 2: index.html embed coverage ----
// The embed is `const MINERAL_SPEC_FALLBACK = { quartz: {...}, calcite: {...}, ... };`.
// For each mineral in the real spec, check that the embed has an entry
// with matching max_size_cm.
function parseWebEmbed(src) {
  // After phase-3 the inline embed is `const MINERAL_SPEC_FALLBACK = {...}`
  // (the runtime fetches data/minerals.json and swaps MINERAL_SPEC to the
  // full version). Fall back to the old name for older checkouts.
  const markers = ['const MINERAL_SPEC_FALLBACK = {', 'const MINERAL_SPEC = {'];
  let start = -1, prefix = '';
  for (const m of markers) {
    const idx = src.indexOf(m);
    if (idx >= 0) { start = idx; prefix = m.slice(0, -1); break; }
  }
  if (start < 0) return null;
  let depth = 0, i = start + prefix.length;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const blob = src.slice(start + prefix.length, i);
  try {
    // The embed uses JS object-literal syntax (unquoted keys). Wrap in Function
    // to evaluate it safely (no external references inside the spec).
    // eslint-disable-next-line no-new-func
    return (new Function(`return (${blob});`))();
  } catch (e) {
    return { __error: e.message };
  }
}
const webEmbed = parseWebEmbed(indexSrc);
if (!webEmbed) {
  record('index.html: no `const MINERAL_SPEC_FALLBACK = {...}` embed found');
} else if (webEmbed.__error) {
  record(`index.html: MINERAL_SPEC embed failed to evaluate — ${webEmbed.__error}`);
} else {
  info(`index.html embed has ${Object.keys(webEmbed).length} minerals`);
  for (const name of mineralNames) {
    if (!webEmbed[name]) {
      record(`index.html: MINERAL_SPEC.${name} missing (present in data/minerals.json)`);
      continue;
    }
    const a = webEmbed[name], b = minerals[name];
    const fields = ['max_size_cm', 'thermal_decomp_C', 'nucleation_sigma', 'growth_rate_mult'];
    for (const f of fields) {
      if (a[f] !== undefined && a[f] !== b[f]) {
        record(`index.html: ${name}.${f} drift — embed=${a[f]} vs spec=${b[f]}`);
      }
    }
  }
  for (const name of Object.keys(webEmbed)) {
    if (!minerals[name]) record(`index.html: MINERAL_SPEC.${name} is not in data/minerals.json (orphan)`);
  }
}

// (Pre-flatten this section also validated docs/index.html and
// docs/data/minerals.json mirrors against the web/ source. GitHub Pages
// now serves from repo root and those mirrors no longer exist —
// see ARCHITECTURE.md for the flatten note.)

// ---- Check 4: agent-api/vugg-agent.js loads the spec ----
if (!/require\(['"]\.\.\/data\/minerals\.json['"]\)/.test(agentSrc)) {
  record("agent-api/vugg-agent.js: no require('../data/minerals.json') found — agent-api should read the spec directly");
}

// ---- Check 5: vugg.py has every declared narrate method ----
for (const name of mineralNames) {
  const nf = minerals[name].narrate_function;
  if (!nf) continue;
  const pattern = new RegExp(`def\\s+${nf}\\s*\\(`);
  if (!pattern.test(vuggSrc)) {
    record(`vugg.py: spec says ${name}.narrate_function="${nf}" but no such method defined`);
  }
}

// ---- Check 6: runtimes_present claims ----
for (const name of mineralNames) {
  const rp = minerals[name].runtimes_present || [];
  const claimVugg  = rp.includes('vugg.py');
  // Accept both the new "index.html" and legacy "web/index.html" claim strings
  // during the transition. Once all runtimes_present arrays are migrated this
  // can drop the legacy alias.
  const claimWeb   = rp.includes('index.html') || rp.includes('web/index.html');
  const claimAgent = rp.includes('agent-api/vugg-agent.js');

  const inVugg  = new RegExp(`['"]${name}['"]\\s*:\\s*grow_${name}`).test(vuggSrc);
  const inWeb   = new RegExp(`\\b${name}\\s*:\\s*grow_${name}`).test(indexSrc);
  const inAgent = new RegExp(`\\b${name}\\s*:\\s*grow_${name}`).test(agentSrc);

  if (claimVugg !== inVugg)   record(`runtimes_present: ${name} claims vugg.py=${claimVugg} but registry says ${inVugg}`);
  if (claimWeb !== inWeb)     record(`runtimes_present: ${name} claims index.html=${claimWeb} but registry says ${inWeb}`);
  if (claimAgent !== inAgent) record(`runtimes_present: ${name} claims agent-api=${claimAgent} but registry says ${inAgent}`);
}

// ---- Report ----
console.log('');
if (drift === 0) {
  ok(`no drift detected across ${mineralNames.length} minerals in 3 runtimes`);
  process.exit(0);
} else {
  console.log(`${RED}${drift} drift item(s) detected${RST}`);
  if (MODE_FIX) {
    // --fix currently only handles the index.html embed regeneration.
    // For safety it's opt-in via an explicit second pass.
    console.log(`${YEL}--fix${RST}: not auto-fixing code edits; manually reconcile the items above.`);
    console.log('       (Future: regenerate MINERAL_SPEC_FALLBACK embed from data/minerals.json.)');
  } else {
    console.log(`${DIM}Run with --fix to attempt automatic reconciliation (currently report-only).${RST}`);
  }
  process.exit(1);
}
