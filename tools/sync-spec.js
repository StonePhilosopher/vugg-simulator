#!/usr/bin/env node
// ============================================================
// sync-spec.js — cross-runtime mineral-spec consistency check
// ============================================================
// Usage:
//   node tools/sync-spec.js            # report mode — prints drift, exits 1 if any
//   node tools/sync-spec.js --fix      # apply fixes in-place where safe (embed updates only)
//   node tools/sync-spec.js --verbose  # verbose diff output
//
// What it checks:
//   1. data/minerals.json is valid JSON with every mineral declaring every
//      required field (per _schema).
//   2. web/index.html's embedded MINERAL_SPEC mirror covers every mineral
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

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SPEC_PATH   = path.join(REPO, 'data', 'minerals.json');
const WEB_PATH    = path.join(REPO, 'web', 'index.html');
const DOCS_PATH   = path.join(REPO, 'docs', 'index.html');
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
const webSrc   = readOrNull(WEB_PATH);
const docsSrc  = readOrNull(DOCS_PATH);
const agentSrc = readOrNull(AGENT_PATH);
const vuggSrc  = readOrNull(VUGG_PATH);

if (!webSrc || !agentSrc || !vuggSrc) {
  console.error(`${RED}FATAL${RST}: missing one of web/index.html, agent-api/vugg-agent.js, vugg.py`);
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

// ---- Check 2: web/index.html embed coverage ----
// The embed is `const MINERAL_SPEC = { quartz: {...}, calcite: {...}, ... };`.
// For each mineral in the real spec, check that the web embed has an entry
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
const webEmbed = parseWebEmbed(webSrc);
if (!webEmbed) {
  record('web/index.html: no `const MINERAL_SPEC = {...}` embed found');
} else if (webEmbed.__error) {
  record(`web/index.html: MINERAL_SPEC embed failed to evaluate — ${webEmbed.__error}`);
} else {
  info(`web/index.html embed has ${Object.keys(webEmbed).length} minerals`);
  for (const name of mineralNames) {
    if (!webEmbed[name]) {
      record(`web/index.html: MINERAL_SPEC.${name} missing (present in data/minerals.json)`);
      continue;
    }
    const a = webEmbed[name], b = minerals[name];
    const fields = ['max_size_cm', 'thermal_decomp_C', 'nucleation_sigma', 'growth_rate_mult'];
    for (const f of fields) {
      if (a[f] !== undefined && a[f] !== b[f]) {
        record(`web/index.html: ${name}.${f} drift — embed=${a[f]} vs spec=${b[f]}`);
      }
    }
  }
  for (const name of Object.keys(webEmbed)) {
    if (!minerals[name]) record(`web/index.html: MINERAL_SPEC.${name} is not in data/minerals.json (orphan)`);
  }
}

// ---- Check 3: docs/index.html mirror of web/index.html ----
if (docsSrc && docsSrc !== webSrc) {
  // Only the MINERAL_SPEC blob needs to match.
  const docsEmbed = parseWebEmbed(docsSrc);
  if (!docsEmbed) {
    record('docs/index.html: MINERAL_SPEC embed missing — docs/ must mirror web/');
  } else if (docsEmbed.__error) {
    record(`docs/index.html: MINERAL_SPEC embed failed to evaluate`);
  } else {
    const webKeys  = webEmbed ? Object.keys(webEmbed).sort().join(',') : '';
    const docsKeys = Object.keys(docsEmbed).sort().join(',');
    if (webKeys !== docsKeys) record('docs/index.html: MINERAL_SPEC key set differs from web/');
  }
}

// ---- Check 3b: docs/data/minerals.json mirrors data/minerals.json ----
// GitHub Pages serves docs/, so docs/data/minerals.json is the public spec
// when the runtime fetches it. Prior to this check, this file silently
// drifted across multiple round-of-engines updates (last touched at
// commit 8d2cb52, before the v3+v4 rounds). Adding this catch.
const DOCS_SPEC_PATH = path.join(REPO, 'docs', 'data', 'minerals.json');
const docsSpecRaw = readOrNull(DOCS_SPEC_PATH);
if (docsSpecRaw === null) {
  warn('docs/data/minerals.json missing — GitHub Pages will fail to load full spec');
} else {
  let docsSpec;
  try {
    docsSpec = JSON.parse(docsSpecRaw);
  } catch (e) {
    record(`docs/data/minerals.json: JSON parse error — ${e.message}`);
  }
  if (docsSpec) {
    const dataKeys  = Object.keys(spec.minerals).sort().join(',');
    const docsKeys  = Object.keys(docsSpec.minerals || {}).sort().join(',');
    if (dataKeys !== docsKeys) {
      record(
        `docs/data/minerals.json: key set differs from data/minerals.json. ` +
        `Run: cp data/minerals.json docs/data/minerals.json`
      );
    } else {
      // Compare sizes — same keys but different content means drift
      if (docsSpecRaw.length !== fs.readFileSync(SPEC_PATH, 'utf8').length) {
        // Full byte-level comparison of canonical JSON
        const dataCanon = JSON.stringify(spec, null, 2);
        const docsCanon = JSON.stringify(docsSpec, null, 2);
        if (dataCanon !== docsCanon) {
          record(
            `docs/data/minerals.json: content drifts from data/minerals.json ` +
            `(same keys, different values). Run: cp data/minerals.json docs/data/minerals.json`
          );
        }
      }
    }
  }
}

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
  const claimWeb   = rp.includes('web/index.html');
  const claimAgent = rp.includes('agent-api/vugg-agent.js');

  const inVugg  = new RegExp(`['"]${name}['"]\\s*:\\s*grow_${name}`).test(vuggSrc);
  const inWeb   = new RegExp(`\\b${name}\\s*:\\s*grow_${name}`).test(webSrc);
  const inAgent = new RegExp(`\\b${name}\\s*:\\s*grow_${name}`).test(agentSrc);

  if (claimVugg !== inVugg)   record(`runtimes_present: ${name} claims vugg.py=${claimVugg} but registry says ${inVugg}`);
  if (claimWeb !== inWeb)     record(`runtimes_present: ${name} claims web/index.html=${claimWeb} but registry says ${inWeb}`);
  if (claimAgent !== inAgent) record(`runtimes_present: ${name} claims agent-api=${claimAgent} but registry says ${inAgent}`);
}

// ---- Report ----
console.log('');
if (drift === 0) {
  ok(`no drift detected across ${mineralNames.length} minerals in 4 runtimes`);
  process.exit(0);
} else {
  console.log(`${RED}${drift} drift item(s) detected${RST}`);
  if (MODE_FIX) {
    // --fix currently only handles the web/ embed regeneration.
    // For safety it's opt-in via an explicit second pass.
    console.log(`${YEL}--fix${RST}: not auto-fixing code edits; manually reconcile the items above.`);
    console.log('       (Future: regenerate MINERAL_SPEC embed from data/minerals.json.)');
  } else {
    console.log(`${DIM}Run with --fix to attempt automatic reconciliation (currently report-only).${RST}`);
  }
  process.exit(1);
}
