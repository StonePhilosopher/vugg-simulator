// v140 sulfate twin_laws batch — near-copy of tools/add-arsenate-twins.mjs
// with the TWIN_LAWS dict swapped for sulfate targets. 9 minerals, all
// get twin_laws (none have non-euhedral habit codes that would warrant
// _twin_laws_note).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'minerals.json');

const TWIN_LAWS = {
  // === BARITE-GROUP ORTHORHOMBIC ({110} contact — the canonical barite-group twin) ===
  celestine: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V (sulfates) + Dana 8th. Celestine (orthorhombic Pnma, SrSO4) is in the barite-group; {110} contact twins documented at Maybee (Michigan), Agrigento (Sicily), and Sakoany (Madagascar) tabular specimens. Less twin-frequent than barite itself; conservative p=0.02 (rare-to-minor).',
      },
    ],
  },
  anglesite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V. Anglesite (orthorhombic Pnma, PbSO4) is the Pb endmember of the barite-group, isostructural with celestine. Same {110} contact twins documented at Monteponi (Sardinia) and Sierra de Cordoba (Argentina) supergene oxidation specimens. Conservative p=0.02 matching celestine.',
      },
    ],
  },
  anhydrite: {
    laws: [
      {
        name: 'contact_011',
        miller_indices: '{011}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V anhydrite section. Anhydrite (orthorhombic Amma, CaSO4) is barite-group-adjacent but with a distinct space group; {011} and {110} contact twins documented in salt-dome specimens (Tarka, German Zechstein evaporites). Conservative p=0.02 — most anhydrite is tabular massive but well-formed crystals carry visible twins.',
      },
    ],
  },

  // === ALUNITE-JAROSITE GROUP TRIGONAL ({10-12} rare contact) ===
  jarosite: {
    laws: [
      {
        name: 'contact_1012',
        miller_indices: '{10-12}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V + Stoffregen et al. 2000 (Reviews in Mineralogy 40:454) alunite-jarosite-group review. Jarosite (trigonal R-3m, KFe3(SO4)2(OH)6) has the alunite-supergroup pseudocubic rhombohedral habit; {10-12} contact twins are reported but rare. Most jarosite occurs as fine drusy crusts in acid-mine-drainage and supergene zones, with twinning vanishingly uncommon at visible scale. p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },
  alunite: {
    laws: [
      {
        name: 'contact_1012',
        miller_indices: '{10-12}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V + Stoffregen et al. 2000. Alunite (trigonal R-3m, KAl3(SO4)2(OH)6) is isostructural with jarosite — the Al-end of the alunite-supergroup. Same {10-12} rare contact twins; documented at Tolfa (Italy, type) and the Yellow Mountain alunite deposits. p=0.005 matching jarosite.',
      },
    ],
  },

  // === MONOCLINIC Cu-SUPERGENE SULFATES ===
  brochantite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V brochantite section. Brochantite (monoclinic P21/a, Cu4(SO4)(OH)6) shows {100} contact twins documented in the iconic Chuquicamata (Chile) Atacama-desert supergene zone — the largest brochantite-bearing deposit on Earth. Also Mt Lyell (Tasmania) and Tsumeb. p=0.02 reflects the rare-to-minor field frequency in well-formed prismatic specimens.',
      },
    ],
  },
  antlerite: {
    laws: [
      {
        name: 'contact_010',
        miller_indices: '{010}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V antlerite section. Antlerite (orthorhombic Pnam, Cu3(SO4)(OH)4) is the more-acid sister of brochantite — Chuquicamata\'s dominant supergene Cu sulfate in the deeper acid zone where brochantite would dissolve. Twin documentation sparse; rare {010} contact reported. p=0.005 (rare-twin floor, data sparse).',
      },
    ],
  },

  // === MONOCLINIC Na-SULFATES (efflorescent / soluble) ===
  mirabilite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V mirabilite section. Mirabilite (monoclinic P21/c, Na2SO4·10H2O — Glauber\'s salt) shows rare {100} contact twins. Most mirabilite is rapidly-precipitated efflorescent crust at saline-lake margins (Searles Lake CA, Mono Lake) and rarely persists long enough at room T (it dehydrates to thenardite above 32.4°C) for visible twinning to develop. p=0.005 (rare-twin floor with solubility-limited-observation caveat).',
      },
    ],
  },
  thenardite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V thenardite section. Thenardite (orthorhombic Fddd, Na2SO4) is the dehydration product of mirabilite (>32.4°C) and the dominant Na-sulfate phase in arid evaporites (Soda Lake CA, Searles Lake, Espartinas Spain). {110} contact twins documented but rare — like mirabilite, most field thenardite is efflorescent rather than euhedral. p=0.005 (rare-twin floor).',
      },
    ],
  },
};

const TWIN_LAWS_NOTES = {};

function indent(obj, baseIndent) {
  const raw = JSON.stringify(obj, null, 2);
  return raw
    .split('\n')
    .map((line, i) => (i === 0 ? line : baseIndent + line))
    .join('\n');
}

function buildLawsBlock(laws, fieldIndent) {
  const itemIndent = fieldIndent + '  ';
  const items = laws.map((law) => indent(law, itemIndent));
  return `[\n${itemIndent}${items.join(`,\n${itemIndent}`)}\n${fieldIndent}]`;
}

function processFile() {
  const text = fs.readFileSync(FILE, 'utf8');
  let updated = text;
  const allMinerals = new Set([
    ...Object.keys(TWIN_LAWS),
    ...Object.keys(TWIN_LAWS_NOTES),
  ]);
  let editedCount = 0;
  for (const mineral of allMinerals) {
    const safe = mineral.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const blockStartRe = new RegExp(`(\\n    "${safe}": \\{)`);
    const match = blockStartRe.exec(updated);
    if (!match) throw new Error(`Could not find block start for ${mineral}`);
    const blockStart = match.index + 1;
    let depth = 0, i = blockStart, inStr = false, esc = false;
    for (; i < updated.length; i++) {
      const c = updated[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    const blockEnd = i;
    const block = updated.slice(blockStart, blockEnd);
    const twinLineRe = /\n(\s*)"twin_laws": \[\],/;
    const twinMatch = twinLineRe.exec(block);
    if (!twinMatch) throw new Error(`Could not find twin_laws in ${mineral}`);
    const fieldIndent = twinMatch[1];
    let newBlock;
    if (TWIN_LAWS[mineral]) {
      const laws = TWIN_LAWS[mineral].laws;
      const lawsStr = buildLawsBlock(laws, fieldIndent);
      newBlock =
        block.slice(0, twinMatch.index) +
        `\n${fieldIndent}"twin_laws": ${lawsStr},` +
        block.slice(twinMatch.index + twinMatch[0].length);
    } else if (TWIN_LAWS_NOTES[mineral]) {
      const note = TWIN_LAWS_NOTES[mineral];
      const noteLine = `\n${fieldIndent}"_twin_laws_note": ${JSON.stringify(note)},`;
      newBlock =
        block.slice(0, twinMatch.index) +
        noteLine +
        `\n${fieldIndent}"twin_laws": [],` +
        block.slice(twinMatch.index + twinMatch[0].length);
    } else continue;
    updated = updated.slice(0, blockStart) + newBlock + updated.slice(blockEnd);
    editedCount++;
  }
  try { JSON.parse(updated); } catch (e) { throw new Error(`Result no longer valid JSON: ${e.message}`); }
  fs.writeFileSync(FILE, updated);
  console.log(`Edited ${editedCount} mineral entries (${Object.keys(TWIN_LAWS).length} twin_laws + ${Object.keys(TWIN_LAWS_NOTES).length} _twin_laws_note).`);
}

processFile();
