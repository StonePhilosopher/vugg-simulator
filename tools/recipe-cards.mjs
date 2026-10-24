#!/usr/bin/env node
/**
 * tools/recipe-cards.mjs — one card per mineral recipe (mineral-recipe review, 2026-10-21).
 *
 * A species' recipe is spread over five places: the spec entry in data/minerals.json, the
 * MINERAL_GATES_<m> constant and the supersaturation_<m>() body in the supersat files
 * js/30–js/41 and js/25-chemistry-conditions.ts (plus any this.<helper>() it delegates to; the Ksp
 * evaluators in js/32b and js/40b are not followed, so σ bodies that delegate there read as
 * reading nothing), the _nuc_<m>() body in js/8x/9x-nucleation-*.ts, and the MINERAL_STOICHIOMETRY
 * entry in js/19. This static extractor joins them per species and flags the mismatches a reviewer
 * would otherwise hunt by hand:
 *
 *   NO_SUPERSAT_FN / NO_GATES / NO_STOICH / NO_GATE_T_BOUNDS  a recipe part is missing
 *   FORMULA_NOT_READ_BY_SIGMA / SIGMA_READS_NON_FORMULA   formula elements vs fluid fields read
 *   FORMULA_ELEMENT_NO_FLUID_FIELD                        a formula element the fluid does not track
 *   STOICH_NOT_IN_FORMULA / FORMULA_NOT_IN_STOICH         booking vs formula
 *   REQUIRED_NOT_IN_FORMULA / FORMULA_NOT_IN_REQUIRED     spec required_ingredients vs formula
 *   T_MIN_DECL_x_VS_GATE_y / T_MAX_...                    spec T_range_C vs the gate constant
 *   DECL_OXIDIZING_NO_O2_GATE / DECL_REDUCING_NO_O2_GATE  spec redox_requirement vs the gate
 *
 * Flags are LEADS, not verdicts: a σ that reads S to decide As(V) availability, or a solid-solution
 * end-member that does not need its partner cation, flags correctly and is fine. PASSIVE: reads
 * only, exits 0. Writes to .local-evidence/recipe-cards/ (excluded from the identity guard).
 *
 * Usage: node tools/recipe-cards.mjs [outdir]
 *   → cards-<class>.md (gate + σ + delegated helpers per species), nucleation.md, flags.md, cards.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = process.argv[2] || path.join(ROOT, '.local-evidence', 'recipe-cards');
fs.mkdirSync(OUT, { recursive: true });
const JS = path.join(ROOT, 'js');
const read = p => fs.readFileSync(p, 'utf8');

function braceSlice(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0, inStr = null, inLine = false, inBlock = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; i++; } continue; }
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && nx === '/') { inLine = true; i++; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return { text: src.slice(open, i + 1), start: open, end: i + 1 }; }
  }
  return null;
}

const files = fs.readdirSync(JS).filter(f => f.endsWith('.ts'));
const supersatFiles = files.filter(f => /^(3\d|39a|40|41)[a-z]?-supersat-/.test(f) && !/Ksp/.test(f));
const nucFiles = files.filter(f => /^(8\d|89a|90|91)[a-z]?-nucleation-/.test(f));
const condFiles = [...supersatFiles, '25-chemistry-conditions.ts'].filter(f => fs.existsSync(path.join(JS, f)));

// ---------- gates ----------
const gates = Object.create(null);
const gateRaw = Object.create(null);
const gateFile = Object.create(null);
for (const f of supersatFiles) {
  const src = read(path.join(JS, f));
  const re = /const\s+MINERAL_GATES_([A-Za-z0-9_]+)\s*:\s*MineralGates\s*=\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const sl = braceSlice(src, m.index + m[0].length - 1);
    if (!sl) continue;
    gateRaw[m[1]] = sl.text;
    gateFile[m[1]] = f;
    try { gates[m[1]] = new Function('return (' + sl.text + ')')(); }
    catch (e) { gates[m[1]] = { _eval_error: String(e.message) }; }
  }
}

// Gate constants are JS identifiers (MINERAL_GATES_meta_autunite); spec keys may be hyphenated.
// One resolver for every lookup, so a card never mixes a found gate with a missing one.
function gateKey(name) {
  if (name in gates) return name;
  const id = name.replace(/-/g, '_');
  return id in gates ? id : null;
}

// ---------- supersat bodies (method + function forms) ----------
const methods = Object.create(null);   // name -> {file, text}
for (const f of condFiles) {
  const src = read(path.join(JS, f));
  // method shorthand inside Object.assign / class: `name(args) {`
  const re = /(?:^|\n)\s*(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)\s*(?::\s*[A-Za-z<>\[\]|, ]+)?\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return'].includes(name)) continue;
    const sl = braceSlice(src, m.index + m[0].length - 1);
    if (!sl) continue;
    if (!methods[name] || sl.text.length > methods[name].text.length) methods[name] = { file: f, text: sl.text };
  }
  const re2 = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  while ((m = re2.exec(src))) {
    const sl = braceSlice(src, m.index + m[0].length);
    if (!sl) continue;
    if (!methods[m[1]]) methods[m[1]] = { file: f, text: sl.text };
  }
}

// ---------- nucleation bodies ----------
const nuc = Object.create(null);
const nucCallers = Object.create(null); // mineral -> Set(fn names that call nucleate('mineral')
for (const f of nucFiles) {
  const src = read(path.join(JS, f));
  const re = /function\s+(_nuc_[A-Za-z0-9_]+|_nucleateClass_[A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const sl = braceSlice(src, m.index + m[0].length);
    if (!sl) continue;
    nuc[m[1]] = { file: f, text: sl.text };
    const re3 = /nucleate\(\s*['"]([A-Za-z0-9_\-]+)['"]/g;
    let k;
    while ((k = re3.exec(sl.text))) (nucCallers[k[1]] ||= new Set()).add(m[1]);
  }
}

// ---------- stoichiometry ----------
let stoich = {};
{
  const src = read(path.join(JS, '19-mineral-stoichiometry.ts'));
  const i = src.indexOf('const MINERAL_STOICHIOMETRY');
  const sl = braceSlice(src, i);
  try { stoich = new Function('return (' + sl.text + ')')(); } catch (e) { stoich = { _eval_error: e.message }; }
}

// ---------- minerals.json ----------
const spec = JSON.parse(read(path.join(ROOT, 'data', 'minerals.json'))).minerals;

// ---------- formula parsing ----------
const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'.split(' '));
const FIELD_OF = { C: 'CO3', Si: 'SiO2', S: 'S', O: null, H: null };
function formulaElements(formula) {
  if (!formula) return [];
  const s = String(formula).replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080));
  const out = new Set();
  const re = /([A-Z][a-z]?)/g;
  let m;
  while ((m = re.exec(s))) if (ELEMENTS.has(m[1])) out.add(m[1]);
  return [...out];
}
const SOLUTES = new Set(['SiO2', 'Ca', 'CO3', 'F', 'Zn', 'S', 'Fe', 'Mn', 'Al', 'Ti', 'Pb', 'U', 'Cu', 'Mo', 'K', 'Na', 'Mg', 'Ba', 'Sr', 'Cr', 'P', 'As', 'Cl', 'V', 'W', 'Ag', 'Bi', 'Sb', 'Ni', 'Co', 'B', 'Li', 'Be', 'Te', 'Se', 'Ge', 'Au', 'Cd', 'Hg', 'Sn', 'Y']);

// helpers that read specific solutes on the caller's behalf
const HELPER_READS = {
  arsenateAvailablePpm: ['As', 'S'], arseniteAvailablePpm: ['As', 'S'], arsenicOxidizedFraction: ['As', 'S'],
  sulfideAvailablePpm: ['S'], sulfateAvailablePpm: ['S'], elementalSulfurAvailablePpm: ['S'],
  reactiveSilicaPpm: ['SiO2'],
};

function fieldsRead(text) {
  const out = new Set();
  const pats = [/\bfluid\??\.([A-Za-z_][A-Za-z0-9_]*)/g, /\bf\??\.([A-Z][A-Za-z0-9_]*)/g, /\bfl\??\.([A-Z][A-Za-z0-9_]*)/g,
    /fluid\??\.?\[\s*['"]([A-Za-z0-9_]+)['"]\s*\]/g, /fluid_min!?\.([A-Za-z0-9_]+)/g];
  for (const re of pats) { let m; while ((m = re.exec(text))) out.add(m[1]); }
  for (const [h, reads] of Object.entries(HELPER_READS)) if (new RegExp('\\b' + h + '\\(').test(text)) reads.forEach(r => out.add(r));
  return out;
}
function helperCalls(text) {
  const out = new Set();
  const re = /\b([a-z][A-Za-z0-9_]*)\(/g;
  let m;
  while ((m = re.exec(text))) {
    const n = m[1];
    if (/^(if|for|while|switch|return|max|min|exp|log|log10|pow|abs|sqrt|floor|ceil|round|random|push|filter|map|some|every|find|reduce|toFixed|includes|has|get|set|keys|values|entries|forEach|slice|concat|isFinite|parseFloat)$/.test(n)) continue;
    out.add(n);
  }
  return out;
}
function thisCalls(text) {
  const out = new Set();
  const re = /this\.([A-Za-z_][A-Za-z0-9_]*)\(/g;
  let m;
  while ((m = re.exec(text))) out.add(m[1]);
  return out;
}

// ---------- assemble ----------
const cards = {};
for (const name of Object.keys(spec)) {
  const sp = spec[name] || {};
  const gk = gateKey(name);
  const g = gk ? gates[gk] : undefined;
  const ssName = 'supersaturation_' + name.replace(/-/g, '_');
  const ss = methods[ssName];
  // include delegated helpers (two levels)
  const delegated = [];
  if (ss) {
    const seen = new Set([ssName]);
    let frontier = [...thisCalls(ss.text)];
    for (let depth = 0; depth < 2 && frontier.length; depth++) {
      const next = [];
      for (const h of frontier) {
        if (seen.has(h)) continue; seen.add(h);
        if (methods[h]) { delegated.push({ name: h, ...methods[h] }); next.push(...thisCalls(methods[h].text)); }
      }
      frontier = next;
    }
  }
  const nucName = '_nuc_' + name.replace(/-/g, '_');
  const nucFns = new Set();
  if (nuc[nucName]) nucFns.add(nucName);
  for (const fn of (nucCallers[name] || [])) nucFns.add(fn);
  const bodyAll = [ss?.text || '', ...delegated.map(d => d.text)].join('\n');
  const read_ = fieldsRead(bodyAll);
  const solutesRead = [...read_].filter(x => SOLUTES.has(x));
  const els = formulaElements(sp.formula);
  const formulaFields = [...new Set(els.map(e => (e in FIELD_OF ? FIELD_OF[e] : e)).filter(Boolean))];
  const formulaFieldsTracked = formulaFields.filter(x => SOLUTES.has(x));
  const formulaFieldsUntracked = formulaFields.filter(x => !SOLUTES.has(x));
  const st = stoich[name] || null;
  const flags = [];
  if (!ss) flags.push('NO_SUPERSAT_FN');
  if (!g) flags.push('NO_GATES');
  const missing = formulaFieldsTracked.filter(x => !solutesRead.includes(x));
  if (ss && missing.length) flags.push('FORMULA_NOT_READ_BY_SIGMA:' + missing.join(','));
  const extra = solutesRead.filter(x => !formulaFields.includes(x));
  if (ss && extra.length) flags.push('SIGMA_READS_NON_FORMULA:' + extra.join(','));
  if (formulaFieldsUntracked.length) flags.push('FORMULA_ELEMENT_NO_FLUID_FIELD:' + formulaFieldsUntracked.join(','));
  if (st) {
    const sk = Object.keys(st);
    const stNotFormula = sk.filter(k => !formulaFields.includes(k));
    const formulaNotSt = formulaFieldsTracked.filter(k => !sk.includes(k));
    if (stNotFormula.length) flags.push('STOICH_NOT_IN_FORMULA:' + stNotFormula.join(','));
    if (formulaNotSt.length) flags.push('FORMULA_NOT_IN_STOICH:' + formulaNotSt.join(','));
  } else flags.push('NO_STOICH');
  const ri = sp.required_ingredients ? Object.keys(sp.required_ingredients) : [];
  const riNotFormula = ri.filter(k => !formulaFields.includes(k));
  const formulaNotRi = formulaFieldsTracked.filter(k => !ri.includes(k));
  if (riNotFormula.length) flags.push('REQUIRED_NOT_IN_FORMULA:' + riNotFormula.join(','));
  if (formulaNotRi.length) flags.push('FORMULA_NOT_IN_REQUIRED:' + formulaNotRi.join(','));
  if (g && sp.T_range_C) {
    const [lo, hi] = sp.T_range_C;
    if (g.T_min !== undefined && lo !== null && g.T_min !== lo) flags.push(`T_MIN_DECL_${lo}_VS_GATE_${g.T_min}`);
    if (g.T_max !== undefined && hi !== null && g.T_max !== hi) flags.push(`T_MAX_DECL_${hi}_VS_GATE_${g.T_max}`);
    if (g.T_min === undefined && g.T_max === undefined) flags.push('NO_GATE_T_BOUNDS');
  }
  if (g && sp.redox_requirement) {
    const rr = sp.redox_requirement;
    if (rr === 'oxidizing' && g.O2_min === undefined && !/RedoxAvailable|O2\s*[<>]/.test(bodyAll)) flags.push('DECL_OXIDIZING_NO_O2_GATE');
    if (rr === 'reducing' && g.O2_max === undefined && !/Anoxic|O2\s*[<>]/.test(bodyAll)) flags.push('DECL_REDUCING_NO_O2_GATE');
  }
  cards[name] = {
    name, class: sp.class, formula: sp.formula,
    declared: {
      T_range_C: sp.T_range_C, T_optimum_C: sp.T_optimum_C, T_behavior: sp.T_behavior,
      redox_requirement: sp.redox_requirement, required_ingredients: sp.required_ingredients,
      pH_dissolution_below: sp.pH_dissolution_below, pH_dissolution_above: sp.pH_dissolution_above,
      thermal_decomp_C: sp.thermal_decomp_C, nucleation_sigma: sp.nucleation_sigma,
      scenarios: sp.scenarios, max_size_cm: sp.max_size_cm, growth_rate_mult: sp.growth_rate_mult,
      description: sp.description,
    },
    gates: g || null, gateFile: (gk && gateFile[gk]) || null,
    stoich: st,
    formulaElements: els, formulaFields,
    solutesRead, helpers: ss ? [...helperCalls(bodyAll)].filter(h => !/^supersaturation_/.test(h)) : [],
    flags,
    supersat: ss ? { name: ssName, file: ss.file, text: ss.text } : null,
    delegated: delegated.map(d => ({ name: d.name, file: d.file, text: d.text })),
    nucleation: [...nucFns].map(fn => ({ name: fn, file: nuc[fn]?.file, text: nuc[fn]?.text })),
  };
}

const specKeysAsIdentifiers = new Set(Object.keys(spec).map(n => n.replace(/-/g, '_')));
const orphanGates = Object.keys(gates).filter(n => !spec[n] && !specKeysAsIdentifiers.has(n));
fs.writeFileSync(path.join(OUT, 'cards.json'), JSON.stringify({ generated: new Date().toISOString(), orphanGates, cards }, null, 1));

const byClass = {};
for (const c of Object.values(cards)) (byClass[c.class || 'unknown'] ||= []).push(c);
const fence = '```';
for (const [cls, list] of Object.entries(byClass)) {
  let md = `# Recipe cards — ${cls} (${list.length})\n\n`;
  for (const c of list.sort((a, b) => a.name.localeCompare(b.name))) {
    md += `## ${c.name} — ${c.formula}\n`;
    md += `- declared: T ${JSON.stringify(c.declared.T_range_C)} opt ${JSON.stringify(c.declared.T_optimum_C)} · redox ${c.declared.redox_requirement} · pH_diss_below ${c.declared.pH_dissolution_below} above ${c.declared.pH_dissolution_above} · decomp ${c.declared.thermal_decomp_C}\n`;
    md += `- required_ingredients: ${JSON.stringify(c.declared.required_ingredients)}\n`;
    md += `- stoich: ${JSON.stringify(c.stoich)}\n`;
    md += `- formula fields: ${c.formulaFields.join(',')} · sigma reads: ${c.solutesRead.join(',')}\n`;
    md += `- helpers: ${c.helpers.join(', ')}\n`;
    md += `- scenarios: ${JSON.stringify(c.declared.scenarios)}\n`;
    md += `- FLAGS: ${c.flags.join(' | ') || '(none)'}\n\n`;
    md += `${fence}js\n// gates (${c.gateFile})\n${gateRaw[gateKey(c.name)] || 'none'}\n${fence}\n\n`;
    if (c.supersat) md += `${fence}js\n// ${c.supersat.name} (${c.supersat.file})\n${c.supersat.text}\n${fence}\n\n`;
    for (const d of c.delegated) md += `${fence}js\n// delegated ${d.name} (${d.file})\n${d.text}\n${fence}\n\n`;
    md += '\n';
  }
  fs.writeFileSync(path.join(OUT, `cards-${cls}.md`), md);
}
let nmd = '# Nucleation bodies\n\n';
for (const c of Object.values(cards).sort((a, b) => a.name.localeCompare(b.name))) {
  nmd += `## ${c.name}\n`;
  for (const n of c.nucleation) nmd += `${fence}js\n// ${n.name} (${n.file})\n${n.text}\n${fence}\n`;
  nmd += '\n';
}
fs.writeFileSync(path.join(OUT, 'nucleation.md'), nmd);

let sum = '# Flag summary\n\n';
sum += `orphan gates (no spec entry): ${orphanGates.join(', ') || 'none'}\n\n`;
for (const c of Object.values(cards).sort((a, b) => (a.class || '').localeCompare(b.class || '') || a.name.localeCompare(b.name))) {
  sum += `- [${c.class}] **${c.name}** \`${c.formula}\` — ${c.flags.join(' | ') || 'ok'}\n`;
}
fs.writeFileSync(path.join(OUT, 'flags.md'), sum);
console.log('cards:', Object.keys(cards).length, 'gates:', Object.keys(gates).length, 'supersat methods found:', Object.values(cards).filter(c => c.supersat).length, 'orphanGates:', orphanGates.length);
console.log('classes:', Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])));
