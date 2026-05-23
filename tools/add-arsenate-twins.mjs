// v139 arsenate twin_laws batch — near-copy of tools/add-phosphate-twins.mjs
// with the TWIN_LAWS / TWIN_LAWS_NOTES dicts swapped for arsenate targets.
// Same regex-anchored in-place edit pattern.
//
// 8 twin_laws + 3 _twin_laws_note → 11 arsenates total.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'minerals.json');

const TWIN_LAWS = {
  // === VIVIANITE-GROUP MONOCLINIC ({010} contact, the iconic Co/Ni/Zn blooms) ===
  erythrite: {
    laws: [
      {
        name: 'contact_010',
        miller_indices: '{010}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV (arsenates) + Frondel 1962 The System of Mineralogy v.III §vivianite-group. Erythrite (monoclinic C2/m, Co₃(AsO₄)₂·8H₂O) — iconic cobalt-bloom species. {010} contact twins documented in classic Schneeberg + Cobalt (Ontario) + Bou Azzer (Morocco) acicular sprays. The vivianite-group all share this twin law; p=0.05 reflects the minor-common frequency in well-formed sprays.',
      },
    ],
  },
  annabergite: {
    laws: [
      {
        name: 'contact_010',
        miller_indices: '{010}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV + Frondel 1962. Annabergite (monoclinic C2/m, Ni₃(AsO₄)₂·8H₂O) is the Ni endmember of the erythrite-annabergite series; isostructural, same {010} contact twins documented at Annaberg (type) + Lavrion + Bou Azzer. Conservative p=0.05 matching erythrite.',
      },
    ],
  },
  koettigite: {
    laws: [
      {
        name: 'contact_010',
        miller_indices: '{010}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV. Koettigite (monoclinic C2/m, Zn₃(AsO₄)₂·8H₂O) is the Zn endmember of the vivianite-group. Less common in field collections than erythrite/annabergite; documented at Mapimí + Schneeberg. Same {010} contact twin behavior but rarer in observed specimens (data sparser); conservative p=0.02.',
      },
    ],
  },

  // === ADAMITE-GROUP ORTHORHOMBIC ({101} or {110} contact) ===
  adamite: {
    laws: [
      {
        name: 'heart_twin_101',
        miller_indices: '{101}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Frondel 1948 (American Mineralogist 33:545) — type description of "heart-shaped" adamite twins from Mapimí (Ojuela Mine, Durango, Mexico) + Anthony Handbook v.IV adamite section. Orthorhombic Pnnm, Zn₂(AsO₄)(OH). The {101} contact twin produces the diagnostic V-pair "heart twin" morphology that defines collector-grade Mapimí adamite. p=0.05 reflects the minor-common frequency of visible heart twins among well-formed Mapimí specimens; the lime-green/yellow Ojuela material is the field reference.',
      },
    ],
  },
  olivenite: {
    laws: [
      {
        name: 'contact_101',
        miller_indices: '{101}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV. Olivenite (orthorhombic Pnnm, Cu₂(AsO₄)(OH)) is isostructural with adamite — Cu endmember of the adamite-olivenite series. Same {101} contact twin behavior but less commonly observed than adamite hearts; documented at Cornwall (type) + Tsumeb + Cap Garonne. Conservative p=0.02.',
      },
    ],
  },
  austinite: {
    laws: [
      {
        name: 'contact_101',
        miller_indices: '{101}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV. Austinite (orthorhombic P2₁2₁2₁, CaZn(AsO₄)(OH)) is the Ca-Zn member of the adamite-group, often forming acicular sprays at Mapimí + Tsumeb + Gold Hill (Utah). {101} contact twins reported but data sparse — acicular habit dominates over visible twin morphology. Conservative p=0.02.',
      },
    ],
  },

  // === APATITE-GROUP ARSENATE (low-twin floor, matches pyromorphite/vanadinite at v138) ===
  mimetite: {
    laws: [
      {
        name: 'contact_1122',
        miller_indices: '{11-22}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV + Mindat mimetite habit notes. Mimetite (hexagonal P6₃/m, Pb₅(AsO₄)₃Cl) is the As endmember of the pyromorphite-mimetite-vanadinite apatite-group series. Same low intrinsic twin propensity as pyromorphite + vanadinite (both shipped at v138); rare {11-22} contact twins documented at Tsumeb + Bad Ems + Wheal Alfred. p=0.005 matching the apatite-group floor.',
      },
    ],
  },

  // === SCORODITE-GROUP ORTHORHOMBIC (sparse) ===
  scorodite: {
    laws: [
      {
        name: 'contact_001',
        miller_indices: '{001}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV + Mindat scorodite habit notes. Scorodite (orthorhombic Pbca, FeAsO₄·2H₂O) is the iconic supergene As-oxide species — pyramidal blue-green crystals at Ojuela (Mexico), Tsumeb, Hemerdon. Twin behavior data-sparse; rare {001} contact twins reported but most scorodite is untwinned pyramidal/dipyramidal. Conservative p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },
};

const TWIN_LAWS_NOTES = {
  // Tsumeb supergene non-euhedral
  duftite:
    "Intentionally empty — duftite (orthorhombic P2₁2₁2₁, PbCu(AsO₄)(OH)) habit code 'botryoidal_crust' signals microcrystalline aggregate. The Tsumeb supergene specimens are pistachio-green crusts/botryoidal coatings on bayldonite/mimetite, not individual euhedral crystals. No documented growth twinning at this habit scale. v139 arsenate batch.",
  bayldonite:
    "Intentionally empty — bayldonite (monoclinic C2/c, PbCu₃(AsO₄)₂(OH)₂) habit code 'spheroidal_mammillary' signals non-euhedral aggregate. Forms green spheroidal/mammillary masses at Tsumeb + Wheal Carpenter (Cornwall type), classic supergene Pb-Cu-As habit. No individual euhedral crystals to twin. v139 arsenate batch.",

  // Paramorph (v138 paramorph-inheritance convention)
  metazeunerite:
    "Intentionally empty — metazeunerite (Cu(UO₂)₂(AsO₄)₂·8H₂O, tetragonal P4/nmm) is the dehydration paramorph of zeunerite at T > 75°C. Inherits zeunerite's documented {001} basal contact twin geometry through PARAMORPH_TRANSITIONS dispatch (16-paramorph-transitions.ts) rather than nucleating fresh. Adding own twin_laws would double-count the cascade. Same paramorph-inheritance rationale as meta-autunite + metatorbernite (v138 phosphate batch).",
};

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
    if (!match) {
      throw new Error(`Could not find block start for ${mineral}`);
    }
    const blockStart = match.index + 1;
    let depth = 0;
    let i = blockStart;
    let inStr = false;
    let esc = false;
    for (; i < updated.length; i++) {
      const c = updated[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const blockEnd = i;
    const block = updated.slice(blockStart, blockEnd);

    const twinLineRe = /\n(\s*)"twin_laws": \[\],/;
    const twinMatch = twinLineRe.exec(block);
    if (!twinMatch) {
      throw new Error(`Could not find twin_laws in ${mineral}`);
    }
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
    } else {
      continue;
    }

    updated = updated.slice(0, blockStart) + newBlock + updated.slice(blockEnd);
    editedCount++;
  }

  try {
    JSON.parse(updated);
  } catch (e) {
    throw new Error(`Result no longer valid JSON: ${e.message}`);
  }

  fs.writeFileSync(FILE, updated);
  console.log(`Edited ${editedCount} mineral entries (${Object.keys(TWIN_LAWS).length} twin_laws + ${Object.keys(TWIN_LAWS_NOTES).length} _twin_laws_note).`);
}

processFile();
