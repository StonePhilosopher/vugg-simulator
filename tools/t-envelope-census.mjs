#!/usr/bin/env node
/**
 * tools/t-envelope-census.mjs — the T-gate census (hostile-review fix ladder, rung 2).
 *
 * The review's smoking gun #3: "the T envelope exists as metadata but is never read
 * at the gate." This instrument measures that gap fleet-wide, two ways:
 *
 *   STATIC — for every MINERAL_GATES_<m> declaring T_min/T_max, classify how the
 *   matching supersaturation_<m>() treats temperature:
 *     gates-read    reads g.T_min / g.T_max (the house idiom — declared = enforced)
 *     inline-hard   hard-zeros on literal temperature bounds (enforced, but the
 *                   numbers live inline; 18a says gates should carry them)
 *     soft-only     temperature appears only in attenuation math (declared bound
 *                   NOT enforced — the leak class)
 *     none          function never reads temperature at all (the leak class)
 *
 *   DYNAMIC (--strips) — walk archive/strips/v<N>/*.json and list every nucleation
 *   event whose T-at-step falls OUTSIDE the nucleating species' declared envelope:
 *   the fleet-wide blast-radius map for enforcing what's declared.
 *
 * PASSIVE instrument: reads, reports, exits 0 regardless of findings (the
 * passive-instrument-not-gate rule). Run on demand; not part of the rebake ritual.
 *
 * Usage:
 *   node tools/t-envelope-census.mjs            # static matrix
 *   node tools/t-envelope-census.mjs --strips   # + dynamic census (latest archive)
 *   node tools/t-envelope-census.mjs --strips --version 227
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JS = path.join(ROOT, 'js');

// ---------- shared: brace-matched slice starting at the first '{' at/after `from` ----------
function braceSlice(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

// ---------- STATIC: parse gates + supersat bodies from every supersat file ----------
function collectStatic() {
  const files = fs.readdirSync(JS).filter((f) => /^\d+a?-supersat-.*\.ts$/.test(f));
  const gates = new Map();   // mineral -> {T_min,T_max,T_optimal,file}
  const fns = new Map();     // mineral -> {body,file}
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    for (const m of src.matchAll(/const MINERAL_GATES_(\w+)\s*:\s*MineralGates\s*=/g)) {
      const body = braceSlice(src, m.index + m[0].length);
      if (!body) continue;
      const num = (key) => {
        const mm = body.match(new RegExp(`\\b${key}\\s*:\\s*(-?[\\d.]+)`));
        return mm ? parseFloat(mm[1]) : undefined;
      };
      gates.set(m[1], { T_min: num('T_min'), T_max: num('T_max'), T_optimal: num('T_optimal'), file: f });
    }
    for (const m of src.matchAll(/supersaturation_(\w+)\s*\(\)\s*\{/g)) {
      const body = braceSlice(src, m.index + m[0].length - 1);
      if (body) fns.set(m[1], { body, file: f });
    }
  }
  return { gates, fns };
}

function classifyEnforcement(mineral, body) {
  // strip comments so a cited bound in prose doesn't count as enforcement
  const code = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const readsGates = new RegExp(`(g|MINERAL_GATES_${mineral})\\.(T_min|T_max)`).test(code);
  // temperature may be gated through a local alias (`const T = this.temperature;`
  // ... `if (T < 100 || T > 450) return 0;`) — collect alias names first, or the
  // classifier under-counts enforcement (the calaverite/sylvanite false negative).
  const aliases = ['this\\.temperature', 'this\\.effectiveTemperature'];
  for (const m of code.matchAll(/const\s+(\w+)\s*=\s*this\.(?:effectiveT|t)emperature\b/g)) {
    aliases.push(`\\b${m[1]}\\b`);
  }
  const tRef = `(?:${aliases.join('|')})`;
  // inline hard-zero: a temperature comparison whose statement returns 0
  const inlineHard = new RegExp(
    `if\\s*\\([^)]*${tRef}[^)]*[<>]=?[^)]*\\)\\s*(\\{\\s*)?return 0`).test(code)
    || new RegExp(`if\\s*\\([^)]*[<>]=?[^)]*${tRef}[^)]*\\)\\s*(\\{\\s*)?return 0`).test(code);
  const touchesT = new RegExp(tRef).test(code);
  if (readsGates) return 'gates-read';
  if (inlineHard) return 'inline-hard';
  if (touchesT) return 'soft-only';
  return 'none';
}

function runStatic() {
  const { gates, fns } = collectStatic();
  const rows = [];
  for (const [mineral, g] of gates) {
    if (g.T_min === undefined && g.T_max === undefined) continue;   // no envelope declared
    const fn = fns.get(mineral);
    const cls = fn ? classifyEnforcement(mineral, fn.body) : 'no-supersat-fn';
    rows.push({ mineral, T_min: g.T_min, T_max: g.T_max, cls, file: g.file });
  }
  rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.mineral.localeCompare(b.mineral));

  const leak = rows.filter((r) => r.cls === 'soft-only' || r.cls === 'none');
  console.log(`T-ENVELOPE STATIC CENSUS — ${rows.length} minerals declare T_min/T_max`);
  const byCls = {};
  for (const r of rows) byCls[r.cls] = (byCls[r.cls] || 0) + 1;
  console.log(Object.entries(byCls).map(([k, v]) => `${k}: ${v}`).join('  |  '));
  console.log('\nDECLARED-BUT-UNENFORCED (the leak class):');
  console.log('  mineral                | T_min | T_max | class     | file');
  console.log('  -----------------------|-------|-------|-----------|-----');
  for (const r of leak) {
    console.log(`  ${r.mineral.padEnd(22)} | ${String(r.T_min ?? '—').padStart(5)} | ${String(r.T_max ?? '—').padStart(5)} | ${r.cls.padEnd(9)} | ${r.file}`);
  }
  console.log('\nFULL MATRIX:');
  for (const r of rows) {
    console.log(`  ${r.mineral.padEnd(22)} | ${String(r.T_min ?? '—').padStart(5)} | ${String(r.T_max ?? '—').padStart(5)} | ${r.cls.padEnd(9)} | ${r.file}`);
  }
  return { gates, rows };
}

// ---------- DYNAMIC: nucleation events vs declared envelope, from the strip archive ----------
function latestStripVersion() {
  const dir = path.join(ROOT, 'archive', 'strips');
  const vs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
    .map((d) => parseInt(d.name.slice(1), 10))
    .sort((a, b) => a - b);
  return vs[vs.length - 1];
}

function runStrips(gates, version) {
  const dir = path.join(ROOT, 'archive', 'strips', `v${version}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const violations = [];
  const speciesT = new Map();   // species -> {min,max,events}
  for (const f of files) {
    const strip = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const scenario = f.replace(/\.json$/, '');
    const Tseries = strip.chips?.T?.wall;
    if (!Array.isArray(Tseries)) continue;
    for (const ev of strip.nucleation_events || []) {
      const T = Tseries[Math.min(ev.step, Tseries.length - 1)];
      if (typeof T !== 'number') continue;
      const st = speciesT.get(ev.mineral) || { min: Infinity, max: -Infinity, events: 0 };
      st.min = Math.min(st.min, T); st.max = Math.max(st.max, T); st.events++;
      speciesT.set(ev.mineral, st);
      const g = gates.get(ev.mineral);
      if (!g) continue;
      const below = g.T_min !== undefined && T < g.T_min;
      const above = g.T_max !== undefined && T > g.T_max;
      if (below || above) {
        violations.push({ scenario, mineral: ev.mineral, step: ev.step, T,
          bound: below ? `T_min ${g.T_min}` : `T_max ${g.T_max}` });
      }
    }
  }
  console.log(`\nDYNAMIC CENSUS — strips v${version}: nucleation events OUTSIDE the declared envelope`);
  console.log(`  ${violations.length} violating events across ${new Set(violations.map(v => v.scenario)).size} scenarios`);
  console.log('  scenario                   | mineral         | step | T(°C)  | violated bound');
  console.log('  ---------------------------|-----------------|------|--------|---------------');
  for (const v of violations.sort((a, b) => a.mineral.localeCompare(b.mineral) || a.scenario.localeCompare(b.scenario) || a.step - b.step)) {
    console.log(`  ${v.scenario.padEnd(26)} | ${v.mineral.padEnd(15)} | ${String(v.step).padStart(4)} | ${v.T.toFixed(1).padStart(6)} | ${v.bound}`);
  }
  return violations;
}

// ---------- main ----------
const args = process.argv.slice(2);
const doStrips = args.includes('--strips');
const vIdx = args.indexOf('--version');
const version = vIdx >= 0 ? parseInt(args[vIdx + 1], 10) : null;

const { gates } = runStatic();
if (doStrips) runStrips(gates, version ?? latestStripVersion());
process.exit(0);
