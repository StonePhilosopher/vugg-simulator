#!/usr/bin/env node
/**
 * tools/redox-gate-census.mjs — find supersaturation engines whose species
 * class implies a redox requirement but whose code carries NO redox gate.
 *
 * THE LESSON THIS AUTOMATES (HANDOFF-VSUITE-AND-KSP §2): vanadinite
 * (Pb5(VO4)3Cl, a V⁵⁺ vanadate) nucleated in reducing fluid for ~175
 * sim-versions because its σ formula was cloned from pyromorphite (PO4 — P
 * is always +5, no redox gate needed) and the vanadate redox requirement
 * never came along. The fix (v193) added it. The question this tool answers:
 * how many OTHER cloned-formula engines inherited the same omission?
 *
 * METHOD. For every `supersaturation_<mineral>()` method in js/*supersat*.ts:
 *   1. extract the method body (brace-matched), strip comments;
 *   2. detect whether the CODE calls any redox gate — the *RedoxAvailable /
 *      *RedoxAnoxic / *RedoxFactor / *RedoxLinearFactor helpers, or a direct
 *      this.fluid.O2 / this.fluid.Eh comparison;
 *   3. look up the mineral's curated redox class (REDOX_CLASS below — the
 *      geology: which oxidation state the diagnostic ion sits in, and which
 *      redox window that demands);
 *   4. verdict: a redox-sensitive class with NO gate is a CANDIDATE BUG.
 *
 * The map is the science; the gate detection is mechanical. A ⚠ is a
 * candidate, NOT a confirmed bug — confirm by dark-observing whether the
 * mineral currently nucleates in the wrong redox window in any live scenario
 * (an inert gate is a safe correctness fix; a firing gate is a real bug AND
 * a rebake event). Run: node tools/redox-gate-census.mjs [--all]
 *   default  — show only ⚠ candidates + the map-coverage gaps
 *   --all    — full table (every method, its class, gate state, verdict)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JS = path.join(ROOT, 'js');
const ALL = process.argv.includes('--all');

// ── The geology. need: which redox window the diagnostic species demands.
//   'red-sulfide' : S²⁻ sulfide — needs reducing/anoxic (sulfideRedoxAnoxic).
//   'ox-cation'   : a redox-active CATION stable only when OXIDIZED
//                   (Cu²⁺, Fe³⁺, Mn⁴⁺, U⁶⁺, V⁵⁺, As⁵⁺-arsenate).
//   'red-cation'  : a redox-active cation stable only when REDUCED
//                   (Fe²⁺ siderite, U⁴⁺ uraninite/coffinite, Cu¹⁺ cuprite).
//   'sulfate'     : sulfate of a redox-inert cation — needs S as SULFATE
//                   (oxidizing enough), but cation isn't redox-active.
//   'native'      : native element — forms in a specific redox window
//                   (reduction of the dissolved metal, or H₂S oxidation).
//   'none'        : redox-insensitive (the cation has one common state and
//                   the anion is not a redox couple) — no gate expected.
// sev: HIGH = a missing gate lets the phase form in the wrong window
//      (vanadinite class); INFO = weaker (sulfate S-speciation, native windows).
const REDOX_CLASS = {
  // ── sulfides (41) — all S²⁻, need reducing/anoxic ──────────────────────
  sphalerite: ['red-sulfide', 'HIGH', 'ZnS — S²⁻'],
  wurtzite: ['red-sulfide', 'HIGH', 'ZnS hexagonal dimorph — S²⁻'],
  pyrite: ['red-sulfide', 'HIGH', 'FeS₂ — S²⁻/S₂²⁻'],
  marcasite: ['red-sulfide', 'HIGH', 'FeS₂ dimorph'],
  chalcopyrite: ['red-sulfide', 'HIGH', 'CuFeS₂'],
  galena: ['red-sulfide', 'HIGH', 'PbS — the v13 precedent ("clear physics bug")'],
  molybdenite: ['red-sulfide', 'HIGH', 'MoS₂'],
  acanthite: ['red-sulfide', 'HIGH', 'Ag₂S'],
  argentite: ['red-sulfide', 'HIGH', 'Ag₂S high-T'],
  nickeline: ['red-sulfide', 'HIGH', 'NiAs — arsenide, reducing'],
  millerite: ['red-sulfide', 'HIGH', 'NiS'],
  cobaltite: ['red-sulfide', 'HIGH', 'CoAsS'],
  arsenopyrite: ['red-sulfide', 'HIGH', 'FeAsS'],
  tetrahedrite: ['red-sulfide', 'HIGH', 'Cu sulfosalt'],
  tennantite: ['red-sulfide', 'HIGH', 'Cu sulfosalt'],
  cinnabar: ['red-sulfide', 'HIGH', 'HgS'],
  realgar: ['red-sulfide', 'HIGH', 'As₄S₄ — As²⁺/reducing'],
  orpiment: ['red-sulfide', 'HIGH', 'As₂S₃'],
  stibnite: ['red-sulfide', 'HIGH', 'Sb₂S₃'],
  bismuthinite: ['red-sulfide', 'HIGH', 'Bi₂S₃'],
  bornite: ['red-sulfide', 'HIGH', 'Cu₅FeS₄'],
  chalcocite: ['red-sulfide', 'HIGH', 'Cu₂S'],
  covellite: ['red-sulfide', 'HIGH', 'CuS'],
  calaverite: ['red-sulfide', 'HIGH', 'AuTe₂ — telluride, reducing'],
  sylvanite: ['red-sulfide', 'HIGH', '(Au,Ag)Te₂'],
  hessite: ['red-sulfide', 'HIGH', 'Ag₂Te'],
  naumannite: ['red-sulfide', 'HIGH', 'Ag₂Se — selenide'],
  clausthalite: ['red-sulfide', 'HIGH', 'PbSe'],
  greenockite: ['red-sulfide', 'HIGH', 'CdS'],
  hawleyite: ['red-sulfide', 'HIGH', 'CdS dimorph'],
  metacinnabar: ['red-sulfide', 'HIGH', 'HgS dimorph'],
  skutterudite: ['red-sulfide', 'HIGH', 'CoAs₃ arsenide'],
  safflorite: ['red-sulfide', 'HIGH', '(Co,Fe)As₂'],
  rammelsbergite: ['red-sulfide', 'HIGH', 'NiAs₂'],
  loellingite: ['red-sulfide', 'HIGH', 'FeAs₂'],
  proustite: ['red-sulfide', 'HIGH', 'Ag₃AsS₃ ruby silver'],
  pyrargyrite: ['red-sulfide', 'HIGH', 'Ag₃SbS₃ ruby silver'],
  enargite: ['red-sulfide', 'HIGH', 'Cu₃AsS₄'],

  // ── native elements (36) — specific redox windows ─────────────────────
  native_tellurium: ['native', 'INFO', 'Te⁰'],
  native_sulfur: ['native', 'INFO', 'S⁰ — H₂S oxidation, mild-ox'],
  native_arsenic: ['native', 'INFO', 'As⁰ — reducing'],
  native_silver: ['native', 'INFO', 'Ag⁰ — reduction of Ag⁺'],
  native_bismuth: ['native', 'INFO', 'Bi⁰ — strongly reducing'],
  native_gold: ['native', 'INFO', 'Au⁰'],
  native_copper: ['native', 'INFO', 'Cu⁰ — reduction of Cu²⁺/Cu⁺'],
  awaruite: ['native', 'INFO', 'Ni-Fe alloy — ultra-reducing'],

  // ── arsenates (30) — As⁵⁺, oxidizing ─────────────────────────────────
  olivenite: ['ox-cation', 'HIGH', 'Cu₂(AsO₄)(OH) — As⁵⁺ + Cu²⁺'],
  scorodite: ['ox-cation', 'HIGH', 'FeAsO₄ — As⁵⁺ + Fe³⁺'],
  erythrite: ['ox-cation', 'HIGH', 'Co₃(AsO₄)₂ — As⁵⁺'],
  annabergite: ['ox-cation', 'HIGH', 'Ni₃(AsO₄)₂ — As⁵⁺'],
  adamite: ['ox-cation', 'HIGH', 'Zn₂(AsO₄)(OH) — As⁵⁺'],
  pharmacolite: ['ox-cation', 'HIGH', 'CaHAsO₄ — As⁵⁺'],
  conichalcite: ['ox-cation', 'HIGH', 'CaCu(AsO₄)(OH) — As⁵⁺ + Cu²⁺'],
  mimetite: ['ox-cation', 'HIGH', 'Pb₅(AsO₄)₃Cl — As⁵⁺'],
  austinite: ['ox-cation', 'HIGH', 'CaZn(AsO₄)(OH) — As⁵⁺'],
  legrandite: ['ox-cation', 'HIGH', 'Zn₂(AsO₄)(OH) — As⁵⁺'],
  koettigite: ['ox-cation', 'HIGH', 'Zn₃(AsO₄)₂ — As⁵⁺'],
  duftite: ['ox-cation', 'HIGH', 'PbCu(AsO₄)(OH) — As⁵⁺ + Cu²⁺'],
  bayldonite: ['ox-cation', 'HIGH', 'PbCu₃(AsO₄)₂(OH)₂ — As⁵⁺ + Cu²⁺'],

  // ── phosphates / vanadates / uranyl (38) ──────────────────────────────
  plumbogummite: ['none', '', 'PbAl₃(PO₄)₂ — P⁵⁺ always, Pb/Al inert'],
  pyromorphite: ['none', '', 'Pb₅(PO₄)₃Cl — P⁵⁺ always (the clone PARENT)'],
  apatite: ['none', '', 'Ca₅(PO₄)₃ — P⁵⁺ always'],
  descloizite: ['ox-cation', 'HIGH', 'PbZn(VO₄)(OH) — V⁵⁺ vanadate'],
  mottramite: ['ox-cation', 'HIGH', 'PbCu(VO₄)(OH) — V⁵⁺ + Cu²⁺'],
  clinobisvanite: ['ox-cation', 'HIGH', 'BiVO₄ — V⁵⁺'],
  vanadinite: ['ox-cation', 'HIGH', 'Pb₅(VO₄)₃Cl — V⁵⁺ (the v193 catch)'],
  torbernite: ['ox-cation', 'HIGH', 'Cu(UO₂)₂(PO₄)₂ — uranyl U⁶⁺'],
  autunite: ['ox-cation', 'HIGH', 'Ca(UO₂)₂(PO₄)₂ — uranyl U⁶⁺'],
  zeunerite: ['ox-cation', 'HIGH', 'Cu(UO₂)₂(AsO₄)₂ — uranyl U⁶⁺'],
  uranospinite: ['ox-cation', 'HIGH', 'Ca(UO₂)₂(AsO₄)₂ — uranyl U⁶⁺'],
  carnotite: ['ox-cation', 'HIGH', 'K₂(UO₂)₂(VO₄)₂ — uranyl U⁶⁺ + V⁵⁺'],
  tyuyamunite: ['ox-cation', 'HIGH', 'Ca(UO₂)₂(VO₄)₂ — uranyl U⁶⁺ + V⁵⁺'],
  turquoise: ['ox-cation', 'HIGH', 'CuAl₆(PO₄)₄ — Cu²⁺'],

  // ── molybdates / tungstates (35) ──────────────────────────────────────
  wulfenite: ['ox-cation', 'HIGH', 'PbMoO₄ — Mo⁶⁺ (supergene oxidizing)'],
  ferrimolybdite: ['ox-cation', 'HIGH', 'Fe₂(MoO₄)₃ — Fe³⁺ + Mo⁶⁺'],
  powellite: ['ox-cation', 'HIGH', 'CaMoO₄ — Mo⁶⁺'],
  raspite: ['none', '', 'PbWO₄ — W⁶⁺ (W not a redox couple here)'],
  stolzite: ['none', '', 'PbWO₄ — W⁶⁺'],
  scheelite: ['none', '', 'CaWO₄ — W⁶⁺'],
  wolframite: ['none', '', '(Fe,Mn)WO₄ — hydrothermal, Fe²⁺ stable; low signal'],

  // ── hydroxides (34) — Fe³⁺, oxidizing ─────────────────────────────────
  goethite: ['ox-cation', 'HIGH', 'FeO(OH) — Fe³⁺'],
  lepidocrocite: ['ox-cation', 'HIGH', 'FeO(OH) — Fe³⁺'],

  // ── oxides (37) ───────────────────────────────────────────────────────
  cassiterite: ['none', '', 'SnO₂ — Sn⁴⁺ but hydrothermal Sn is robust; low signal'],
  hematite: ['ox-cation', 'HIGH', 'Fe₂O₃ — Fe³⁺'],
  uraninite: ['red-cation', 'HIGH', 'UO₂ — U⁴⁺ REDUCED (opposite of uranyl!)'],
  magnetite: ['none', '', 'Fe₃O₄ — mixed Fe²⁺/Fe³⁺, forms across a wide band; low signal'],
  cuprite: ['red-cation', 'HIGH', 'Cu₂O — Cu¹⁺ (transitional, below Cu²⁺ minerals)'],
  corundum: ['none', '', 'Al₂O₃'],
  ruby: ['none', '', 'Al₂O₃:Cr'],
  sapphire: ['none', '', 'Al₂O₃:Fe,Ti'],
  rutile: ['none', '', 'TiO₂'],
  chromite: ['none', '', 'FeCr₂O₄ — Cr³⁺ robust'],
  pyrolusite: ['ox-cation', 'HIGH', 'MnO₂ — Mn⁴⁺ (strongly oxidizing)'],
  brucite: ['none', '', 'Mg(OH)₂'],

  // ── carbonates (32) ───────────────────────────────────────────────────
  calcite: ['none', '', 'CaCO₃'],
  aragonite: ['none', '', 'CaCO₃'],
  dolomite: ['none', '', 'CaMg(CO₃)₂'],
  HMC: ['none', '', 'high-Mg calcite'],
  siderite: ['red-cation', 'HIGH', 'FeCO₃ — Fe²⁺ REDUCED (oxidizes to goethite)'],
  rhodochrosite: ['red-cation', 'INFO', 'MnCO₃ — Mn²⁺ (oxidizes to pyrolusite); mild'],
  malachite: ['ox-cation', 'HIGH', 'Cu₂CO₃(OH)₂ — Cu²⁺'],
  smithsonite: ['none', '', 'ZnCO₃ — Zn²⁺ inert'],
  azurite: ['ox-cation', 'HIGH', 'Cu₃(CO₃)₂(OH)₂ — Cu²⁺'],
  cerussite: ['none', '', 'PbCO₃ — Pb²⁺ inert'],
  rosasite: ['ox-cation', 'HIGH', '(Cu,Zn)₂CO₃(OH)₂ — Cu²⁺'],
  aurichalcite: ['ox-cation', 'HIGH', '(Zn,Cu)₅(CO₃)₂(OH)₆ — Cu²⁺'],
  strontianite: ['none', '', 'SrCO₃'],
  witherite: ['none', '', 'BaCO₃'],
  hydrozincite: ['none', '', 'Zn₅(CO₃)₂(OH)₆ — Zn²⁺ inert'],

  // ── halides (33) ──────────────────────────────────────────────────────
  fluorite: ['none', '', 'CaF₂'],
  halite: ['none', '', 'NaCl'],
  atacamite: ['ox-cation', 'HIGH', 'Cu₂Cl(OH)₃ — Cu²⁺'],
  sylvite: ['none', '', 'KCl'],

  // ── borates (31) ──────────────────────────────────────────────────────
  borax: ['none', '', 'Na borate'],
  tincalconite: ['none', '', 'Na borate'],

  // ── sulfates (40) ─────────────────────────────────────────────────────
  barite: ['sulfate', 'INFO', 'BaSO₄ — Ba inert, needs S as sulfate'],
  celestine: ['sulfate', 'INFO', 'SrSO₄ — Sr inert'],
  anhydrite: ['sulfate', 'INFO', 'CaSO₄ — Ca inert'],
  brochantite: ['ox-cation', 'HIGH', 'Cu₄SO₄(OH)₆ — Cu²⁺'],
  antlerite: ['ox-cation', 'HIGH', 'Cu₃SO₄(OH)₄ — Cu²⁺'],
  jarosite: ['ox-cation', 'HIGH', 'KFe₃(SO₄)₂(OH)₆ — Fe³⁺'],
  alunite: ['sulfate', 'INFO', 'KAl₃(SO₄)₂(OH)₆ — Al inert, acidic-oxidizing'],
  chalcanthite: ['ox-cation', 'HIGH', 'CuSO₄·5H₂O — Cu²⁺'],
  mirabilite: ['none', '', 'Na₂SO₄·10H₂O — evaporite'],
  thenardite: ['none', '', 'Na₂SO₄ — evaporite'],
  selenite: ['sulfate', 'INFO', 'CaSO₄·2H₂O gypsum — Ca inert'],
  anglesite: ['sulfate', 'INFO', 'PbSO₄ — oxidation rind on galena'],
  linarite: ['ox-cation', 'HIGH', 'PbCu(SO₄)(OH)₂ — Cu²⁺'],
  caledonite: ['ox-cation', 'HIGH', 'Pb₂Cu... sulfate-carbonate — Cu²⁺'],
  leadhillite: ['sulfate', 'INFO', 'Pb₄(SO₄)(CO₃)₂(OH)₂ — Pb inert, oxidizing secondary'],

  // ── silicates (39) ────────────────────────────────────────────────────
  chrysocolla: ['ox-cation', 'HIGH', 'Cu silicate — Cu²⁺'],
  dioptase: ['ox-cation', 'HIGH', 'CuSiO₃ — Cu²⁺'],
  shattuckite: ['ox-cation', 'HIGH', 'Cu₅(SiO₃)₄(OH)₂ — Cu²⁺'],
  chrysoprase: ['none', '', 'Ni-bearing chalcedony — low signal'],
  coffinite: ['red-cation', 'HIGH', 'USiO₄ — U⁴⁺ REDUCED'],
  uranophane: ['ox-cation', 'HIGH', 'Ca(UO₂)₂(SiO₃)₂ — uranyl U⁶⁺'],
  willemite: ['none', '', 'Zn₂SiO₄ — Zn inert'],
  hemimorphite: ['none', '', 'Zn₄Si₂O₇(OH)₂ — Zn inert'],
  // remaining silicates: gem/rock-forming, redox-inert
  quartz: ['none', '', 'SiO₂'], feldspar: ['none', '', ''], apophyllite: ['none', '', ''],
  albite: ['none', '', ''], lepidolite: ['none', '', ''], spodumene: ['none', '', ''],
  beryl: ['none', '', ''], emerald: ['none', '', ''], aquamarine: ['none', '', ''],
  morganite: ['none', '', ''], heliodor: ['none', '', ''], tourmaline: ['none', '', ''],
  topaz: ['none', '', ''], opal: ['none', '', ''], tigers_eye: ['none', '', ''],
  chrysotile: ['none', '', ''], pectolite: ['none', '', ''], wollastonite: ['none', '', ''],
  prehnite: ['none', '', ''], grossular: ['none', '', ''], diopside: ['none', '', ''],
  vesuvianite: ['none', '', ''], datolite: ['none', '', ''],
  // amphiboles (39a) — metamorphic, redox-inert
  tremolite: ['none', '', ''], actinolite: ['none', '', ''], anthophyllite: ['none', '', ''],
  amosite: ['none', '', ''], crocidolite: ['none', '', ''],
};

// Strip // line comments and /* */ block comments so prose mentions of O2/Eh
// don't count as a code gate.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const GATE_RE = /Redox(Available|Anoxic|Factor|LinearFactor|Tent)\s*\(|this\.fluid\.O2\s*[<>]=?|this\.fluid\.Eh\s*[<>]=?/;

// Extract supersaturation_<name>() bodies by brace-matching from each file.
function extractMethods(src) {
  const out = [];
  const re = /supersaturation_(\w+)\s*\(\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    let i = re.lastIndex - 1, depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    out.push({ name, body: src.slice(m.index, i) });
  }
  return out;
}

const files = fs.readdirSync(JS).filter((f) => /supersat.*\.ts$/.test(f) && !/-Ksp\.ts$/.test(f));
const methods = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(JS, f), 'utf8');
  for (const mth of extractMethods(src)) {
    methods.push({ ...mth, file: f, hasGate: GATE_RE.test(stripComments(mth.body)) });
  }
}

// Verdicts.
const rows = methods.map((m) => {
  const cls = REDOX_CLASS[m.name];
  if (!cls) return { ...m, klass: '??', sev: '', need: 'UNMAPPED', verdict: 'UNMAPPED' };
  const [need, sev, note] = cls;
  let verdict;
  if (need === 'none') verdict = m.hasGate ? 'gate (class=none)' : 'ok';
  else if (m.hasGate) verdict = 'ok';
  else verdict = `⚠ MISSING (${need})`;
  return { ...m, need, sev, note, verdict };
});

const candidates = rows.filter((r) => r.verdict.startsWith('⚠'));
const unmapped = rows.filter((r) => r.verdict === 'UNMAPPED');
const overGated = rows.filter((r) => r.verdict === 'gate (class=none)');

const pad = (s, n) => String(s).padEnd(n);
if (ALL) {
  console.log('\n=== full redox-gate census ===');
  for (const r of rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))) {
    console.log(`  ${pad(r.name, 18)} ${pad(r.file.replace('-supersat', '').replace('.ts', ''), 16)} `
      + `${pad(r.need, 12)} gate=${r.hasGate ? 'Y' : 'n'}  ${r.verdict}`);
  }
}

console.log(`\n=== ⚠ CANDIDATE OMISSIONS (redox-sensitive class, no code gate) — ${candidates.length} ===`);
const bySev = { HIGH: [], INFO: [] };
for (const r of candidates) (bySev[r.sev] || (bySev[r.sev] = [])).push(r);
for (const sev of ['HIGH', 'INFO']) {
  if (!bySev[sev] || !bySev[sev].length) continue;
  console.log(`\n  [${sev}]`);
  for (const r of bySev[sev].sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`    ${pad(r.name, 18)} ${pad(r.need, 12)} ${r.file.replace('-supersat', '').replace('.ts', '')}`);
    console.log(`    ${pad('', 18)} ${r.note}`);
  }
}

if (unmapped.length) {
  console.log(`\n=== UNMAPPED methods (add to REDOX_CLASS) — ${unmapped.length} ===`);
  for (const r of unmapped) console.log(`    ${pad(r.name, 18)} ${r.file}`);
}
console.log(`\n  (${overGated.length} engines gate a class=none mineral — usually fine, e.g. evaporite O2 proxies)`);
console.log(`\n  totals: ${methods.length} engines, ${rows.filter(r=>r.need!=='none'&&r.need!=='UNMAPPED').length} redox-sensitive, `
  + `${candidates.length} candidate omissions (${(bySev.HIGH||[]).length} HIGH).`);
