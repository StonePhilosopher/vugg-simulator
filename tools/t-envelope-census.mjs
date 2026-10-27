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
 *   event whose step falls OUTSIDE the nucleating species' declared envelope at
 *   both its start and its end, then the boundary steps outside at only one end:
 *   the fleet-wide blast-radius map for enforcing what's declared. The archive
 *   names a crystal by its FINAL species at its birth step, so a converted
 *   crystal is checked against the wrong envelope (sabkha_dolomitization's five
 *   "anhydrite" rows are selenite births, 25–31 °C, converted by js/75).
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
    // Parameterised methods count too (`supersaturation_HMC(mg_content?: number)`
    // was invisible to the old `\(\)` pattern — recipe review M13).
    for (const m of src.matchAll(/supersaturation_(\w+)\s*\([^)]*\)\s*\{/g)) {
      const body = braceSlice(src, m.index + m[0].length - 1);
      if (body) fns.set(m[1], { body, file: f });
    }
    // Every other method body, so a σ that delegates (`this._beryl_base_sigma(…)`)
    // is classified on what its helper does, one level deep.
    for (const m of src.matchAll(/^\s+(_\w+)\s*\([^)]*\)\s*\{/gm)) {
      const body = braceSlice(src, m.index + m[0].length - 1);
      if (body && !helpers.has(m[1])) helpers.set(m[1], body);
    }
  }
  return { gates, fns };
}

const helpers = new Map();   // helper method name -> body (filled by collectStatic)

// The CaSO4 phases are admitted by evaluateCaSO4System (js/40b), a free function
// whose T conditions sit inside boolean admissibility flags rather than an
// `if (…) return 0`. This census does not parse it, so the two hard bounds are
// stated here, and both halves are ASSERTED in their written form: the σ's own
// guard on the primary flag, and that flag's definition with its T conjunct.
// If either changes, the census refuses to run rather than misclassify (recipe
// review M13). Gypsum→anhydrite conversion (js/75) reads a separate flag that
// the σ does not; it is why anhydrite can exist below 100 °C at all.
const EVALUATOR_HARD_T = {
  anhydrite: {
    file: '40b-supersat-sulfate-Ksp.ts',
    guard: /if\s*\(\s*!evaluation\.anhydritePrimaryAdmissible\s*\)\s*return 0/,
    flag: /anhydritePrimaryAdmissible\s*=\s*anhydriteSI\s*>\s*0\s*&&\s*temperatureC\s*>=\s*100\b/,
  },
  selenite: {
    file: '40b-supersat-sulfate-Ksp.ts',
    guard: /if\s*\(\s*!evaluation\.gypsumPrimaryAdmissible\s*\)\s*return 0/,
    flag: /gypsumPrimaryAdmissible\s*=\s*gypsumSI\s*>\s*0\s*&&\s*temperatureC\s*<=\s*80\b/,
  },
};
function evaluatorHardT(mineral, code) {
  const rule = EVALUATOR_HARD_T[mineral];
  if (!rule) return false;
  const src = fs.readFileSync(path.join(JS, rule.file), 'utf8');
  if (!rule.guard.test(code) || !rule.flag.test(src)) {
    throw new Error(`t-envelope-census: the ${mineral} override no longer matches its σ guard or the flag in ${rule.file} — re-derive it`);
  }
  return true;
}

function classifyEnforcement(mineral, body) {
  // strip comments so a cited bound in prose doesn't count as enforcement
  const strip = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  let code = strip(body);
  if (/^\{\s*return 0;?\s*\}$/.test(code)) return 'always-zero';   // e.g. tincalconite (paramorph only)
  if (evaluatorHardT(mineral, code)) return 'inline-hard';
  for (const m of code.matchAll(/this\.(_\w+)\s*\(/g)) {
    if (helpers.has(m[1])) code += '\n' + strip(helpers.get(m[1]));
  }
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

// Which bound a temperature crosses, or null.
function crossedBound(g, T) {
  if (g.T_min !== undefined && T < g.T_min) return `T_min ${g.T_min}`;
  if (g.T_max !== undefined && T > g.T_max) return `T_max ${g.T_max}`;
  return null;
}

function runStrips(gates, version) {
  const dir = path.join(ROOT, 'archive', 'strips', `v${version}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const definite = [];   // outside at both the start and the end of the birth's step
  const boundary = [];   // outside at only one of them: the archive cannot say which the birth saw
  for (const f of files) {
    const strip = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const scenario = f.replace(/\.json$/, '');
    // raw_environment.T is each step's exact end state; the chips' T series
    // is quantised for display (~3 °C steps), too coarse at a bound.
    const Tseries = strip.raw_environment?.T;
    if (!Array.isArray(Tseries)) continue;
    for (const ev of strip.nucleation_events || []) {
      // Sample k holds the END of step k + 1, and an event carries its own
      // step's sample: sample_index = step − 1. A birth's T lies between its
      // step's start (sample n − 2) and end (n − 1), and the archive cannot
      // order it within the step: events apply before births (bisbee's step-65
      // births at 25–35 °C, start 259.9), the ambient thermal path after
      // (jeffrey_mine's step-153 pectolite at 267.7, end 361.0). So neither
      // sample alone is right. Against the exact T of all 1,212 seed-42 births
      // (tools/birth-census.mjs, SIM 285), no birth is outside its envelope,
      // yet reading n − 2 alone flags 18, n − 1 alone 4, and sample n — what
      // this census used to read, the end of the NEXT step — 8, porphyry's
      // step-84 stibnite among them (33.7 °C, born at 351.1). Requiring both
      // samples flags none of those births past step 1, whose start is not
      // archived; the definite rows left are the final-species quirk in the
      // header (recipe review M12).
      const end = ev.sample_index ?? ev.step - 1;
      if (end < 0 || end >= Tseries.length) continue;
      const Tend = Tseries[end];
      const Tstart = end >= 1 ? Tseries[end - 1] : undefined;
      if (typeof Tend !== 'number') continue;
      const g = gates.get(ev.mineral);
      if (!g) continue;
      const atEnd = crossedBound(g, Tend);
      const atStart = Tstart === undefined ? null : crossedBound(g, Tstart);
      if (!atEnd && !atStart) continue;
      const row = { scenario, mineral: ev.mineral, step: ev.step, Tstart, Tend, bound: atEnd || atStart };
      if (atEnd && atStart) definite.push(row);
      else boundary.push(row);
    }
  }
  const fmt = (x) => (typeof x === 'number' ? x.toFixed(1) : '—').padStart(6);
  const order = (a, b) => a.mineral.localeCompare(b.mineral) || a.scenario.localeCompare(b.scenario) || a.step - b.step;
  const table = (rows) => {
    console.log('  scenario                   | mineral         | step | start  | end    | bound');
    console.log('  ---------------------------|-----------------|------|--------|--------|------');
    for (const v of rows.sort(order)) {
      console.log(`  ${v.scenario.padEnd(26)} | ${v.mineral.padEnd(15)} | ${String(v.step).padStart(4)} | ${fmt(v.Tstart)} | ${fmt(v.Tend)} | ${v.bound}`);
    }
  };
  console.log(`\nDYNAMIC CENSUS — strips v${version}: nucleation events OUTSIDE the declared envelope`);
  console.log(`  outside at both the start and the end of the birth's step: ${definite.length} events across ${new Set(definite.map(v => v.scenario)).size} scenarios`);
  table(definite);
  console.log(`\n  BOUNDARY STEPS — outside at only one end of the step (confirm with tools/birth-census.mjs): ${boundary.length}`);
  table(boundary);
  return { definite, boundary };
}

// ---------- main ----------
const args = process.argv.slice(2);
const doStrips = args.includes('--strips');
const vIdx = args.indexOf('--version');
const version = vIdx >= 0 ? parseInt(args[vIdx + 1], 10) : null;

const { gates } = runStatic();
if (doStrips) runStrips(gates, version ?? latestStripVersion());
process.exit(0);
