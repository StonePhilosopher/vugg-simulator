// tools/d1-bodycolor-probe.mjs — D1 (Depth-C body colour) scoping probe.
// Commits nothing; run: node tools/d1-bodycolor-probe.mjs
//
// THE QUESTION (probe-before-build, the standing discipline)
// ----------------------------------------------------------
// Body colour today is spec.class_color, documented as "Derived from mineral
// class — all classes of the same type share one hue on a 12-color wheel." So
// galena, sphalerite, pyrite render ONE grey-green. D1 replaces that base hue
// (the _localCrystalColor seed, js/99i) with a REAL body colour.
//
// The first probe pass found the bedrock is ALREADY IN THE TREE: `color_rules`
// (180/180 species) is a chemistry-cause -> colour-NAME map whose triggers read
// the sim's own fields (Fe, Mn, radiation_damage, Li, Y...): sphalerite
// pale_yellow(Fe<2)/honey_brown(Fe 2-10)/black_marmatite(Fe>15); quartz
// clear/smoky/amethyst; fluorite colorless/purple/green/blue. So D1 = RESOLVE
// color_rules into colour, not author 180 hexes. This probe sizes that build:
//
//   [1] class_color collision groups — the wrong-colour problem's shape.
//   [2] IN-SCENE collisions BY HEX — same class_color co-occurring in one
//       scenario (the blend the boss actually sees). Corrected from the class
//       grouping: ~73 species already escaped the wheel with unique class_colors.
//   [3] colour-NAME lexicon — the bounded, verifiable data task: distinct names
//       across all color_rules (each -> one sourced sRGB), + default coverage.
//   [4] trigger MACHINE-PARSEABILITY — what fraction of variant triggers are
//       comparisons over known chem fields (evaluable per-crystal now) vs prose
//       (fall back to default). Sizes the evaluator + the fallback rate.
//   [5] does resolving color_rules BREAK the big collisions? (distinct default
//       colour-names within each class_color group — if yes, D1 is a pure win.)

import { readFileSync } from 'fs';

const root = new URL('..', import.meta.url);
const SPEC = JSON.parse(readFileSync(new URL('data/minerals.json', root), 'utf8')).minerals;
const species = Object.keys(SPEC);
const N = species.length;

// ---------- 1. class_color collision census ----------
const byCC = new Map();
for (const s of species) {
  const cc = (SPEC[s].class_color || '').toLowerCase();
  if (!cc) continue;
  if (!byCC.has(cc)) byCC.set(cc, []);
  byCC.get(cc).push(s);
}
const groups = [...byCC.entries()].sort((a, b) => b[1].length - a[1].length);
const bigGroups = groups.filter(g => g[1].length > 1);
console.log(`\n=== D1 BODY-COLOUR PROBE ===`);
console.log(`species: ${N}   distinct class_color hues: ${byCC.size}   multi-species (colliding) hues: ${bigGroups.length}`);
console.log(`\n[1] BIG class_color COLLISION GROUPS (>1 species on one hue):`);
for (const [hex, list] of bigGroups) {
  console.log(`  ${hex} x${String(list.length).padStart(2)} (${SPEC[list[0]].class})  ${list.slice(0, 8).join(', ')}${list.length > 8 ? ` +${list.length - 8}` : ''}`);
}
const collN = bigGroups.reduce((a, g) => a + g[1].length, 0);
console.log(`  -> ${collN}/${N} species stuck on a shared hue; ${N - collN} already unique.`);

// ---------- 2. in-scene collisions BY HEX (the honest visible measure) ----------
const scen2sp = new Map();
for (const s of species) for (const sc of (SPEC[s].scenarios || [])) {
  if (!scen2sp.has(sc)) scen2sp.set(sc, new Set());
  scen2sp.get(sc).add(s);
}
const inSceneColliders = new Set();
const scenRows = [];
for (const [sc, set] of scen2sp) {
  const byHex = new Map();
  for (const s of set) {
    const h = (SPEC[s].class_color || '').toLowerCase(); if (!h) continue;
    if (!byHex.has(h)) byHex.set(h, []);
    byHex.get(h).push(s);
  }
  let colliders = 0;
  for (const [, list] of byHex) if (list.length > 1) { colliders += list.length; list.forEach(s => inSceneColliders.add(s)); }
  if (colliders) scenRows.push({ sc, colliders, nsp: set.size });
}
scenRows.sort((a, b) => b.colliders - a.colliders);
console.log(`\n[2] IN-SCENE collisions BY HEX (same class_color co-occurring -> literally one colour in one vug):`);
console.log(`  scenarios with a real collision: ${scenRows.length}/${scen2sp.size}`);
for (const r of scenRows.slice(0, 12)) console.log(`  ${r.sc.padEnd(26)} ${String(r.colliders).padStart(2)} colliding / ${String(r.nsp).padStart(2)} spp`);
console.log(`  -> ${inSceneColliders.size} DISTINCT species collide with a same-HEX sibling in >=1 scenario (D1's visible target set).`);

// ---------- 3. colour-name lexicon ----------
const nameCount = new Map();      // colour-name -> occurrences
let defaultCovered = 0, noDefault = [];
for (const s of species) {
  const cr = SPEC[s].color_rules || {};
  const keys = Object.keys(cr);
  let hasDefault = false;
  for (const variant of keys) {
    nameCount.set(variant, (nameCount.get(variant) || 0) + 1);
    if (cr[variant] && cr[variant].default) hasDefault = true;
  }
  if (hasDefault) defaultCovered++; else if (keys.length) noDefault.push(s);
}
const names = [...nameCount.entries()].sort((a, b) => b[1] - a[1]);
console.log(`\n[3] colour-NAME LEXICON (the bounded data task — each name -> one sourced sRGB):`);
console.log(`  distinct variant names across all color_rules: ${names.length}`);
console.log(`  species with an explicit {default:true}: ${defaultCovered}/${N}   without: ${noDefault.length} (${noDefault.slice(0,12).join(', ')}${noDefault.length>12?'…':''})`);
console.log(`  most common names: ${names.slice(0, 22).map(([n, c]) => `${n}(${c})`).join(', ')}`);
const singletons = names.filter(([, c]) => c === 1).map(([n]) => n);
console.log(`  one-off names (${singletons.length}): ${singletons.slice(0, 30).join(', ')}${singletons.length > 30 ? ` +${singletons.length - 30}` : ''}`);

// ---------- 4. trigger machine-parseability ----------
const CHEM = ['Fe', 'Mn', 'Al', 'Ti', 'Pb', 'Cu', 'Zn', 'Mg', 'Ca', 'Sr', 'Ba', 'Cr', 'V', 'Co', 'Ni', 'Y', 'Sm', 'Li', 'REE', 'radiation_damage', 'radiation'];
const cmpRe = /(>=|<=|>|<|=)\s*\d/;                 // has a numeric comparison
const rangeRe = /\b\d+\s*-\s*\d+\b/;                // "2-10" range form
const chemRe = new RegExp(`\\b(${CHEM.join('|')})\\b`);
let parseable = 0, prose = 0, defaultOnly = 0, total = 0;
const proseSamples = [];
const parseableNames = new Map();   // variant name -> [species]
const parseableSpecies = new Set();
for (const s of species) {
  const cr = SPEC[s].color_rules || {};
  for (const v of Object.keys(cr)) {
    const rule = cr[v] || {};
    if (rule.default) { defaultOnly++; continue; }
    const trig = String(rule.trigger || '');
    total++;
    const looksParseable = chemRe.test(trig) && (cmpRe.test(trig) || rangeRe.test(trig)) &&
      !/type|rare|early|late|heated|damage_|,|\bor\b.*\bor\b/i.test(trig.replace(/radiation_damage/g, 'RD'));
    if (looksParseable) { parseable++; if (!parseableNames.has(v)) parseableNames.set(v, []); parseableNames.get(v).push(s); parseableSpecies.add(s); }
    else { prose++; if (proseSamples.length < 12) proseSamples.push(`${s}:${v} "${trig}"`); }
  }
}
console.log(`\n[4] TRIGGER parseability (of ${total} non-default variants; ${defaultOnly} defaults need no trigger):`);
console.log(`  machine-parseable (chem field + numeric cmp/range): ${parseable}   prose/complex -> fall back to default: ${prose}`);
console.log(`  parseable across ${parseableSpecies.size} species; distinct variant names: ${parseableNames.size}`);
console.log(`  parseable variant names: ${[...parseableNames.keys()].sort().join(', ')}`);
console.log(`  prose samples: \n    ${proseSamples.join('\n    ')}`);

// ---------- 5. does color_rules resolution break the big collisions? ----------
console.log(`\n[5] DOES color_rules BREAK the collisions? (distinct default/first colour-name within each big hex group):`);
function baseName(s) {
  const cr = SPEC[s].color_rules || {};
  for (const v of Object.keys(cr)) if (cr[v] && cr[v].default) return v;
  const ks = Object.keys(cr); return ks.length ? ks[0] : '(none)';
}
for (const [hex, list] of bigGroups.slice(0, 8)) {
  const distinct = new Set(list.map(baseName));
  console.log(`  ${hex} x${list.length} -> ${distinct.size} distinct base names: ${[...distinct].slice(0, 10).join(', ')}`);
}
console.log(`\n=== D1 = resolve color_rules (name->sRGB lexicon + trigger eval + render seed). Scope: [3] lexicon size, [4] evaluator + fallback, [5] confirms the win. ===\n`);
