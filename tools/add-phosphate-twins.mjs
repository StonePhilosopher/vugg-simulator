// v138 phosphate twin_laws batch — copy of tools/add-sulfide-twins.mjs
// with the TWIN_LAWS / TWIN_LAWS_NOTES dicts swapped for phosphate
// targets. Same in-place block-anchored edit pattern.
//
// 8 twin_laws + 5 _twin_laws_note → 13 phosphates total.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'minerals.json');

const TWIN_LAWS = {
  // === APATITE-GROUP (hexagonal, rarely twin) ===
  pyromorphite: {
    laws: [
      {
        name: 'contact_1122',
        miller_indices: '{11-22}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV (phosphates) + Frondel 1958 apatite-group section. Pyromorphite (hexagonal P6₃/m, apatite-group) rarely twins — apatite-group structures have low intrinsic twin propensity. Sparse {11-22} or {10-11} contact twins are reported at Bad Ems (Germany) and Leadhills (Scotland). Conservative p=0.005 (rare-twin floor).',
      },
    ],
  },
  vanadinite: {
    laws: [
      {
        name: 'contact_1122',
        miller_indices: '{11-22}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV + Mindat vanadinite habit notes. Isostructural with pyromorphite (apatite-group, hexagonal P6₃/m, V endmember). Same low twin propensity; rare {11-22} contact twins documented at Mibladen (Morocco) and Old Yuma Mine (Arizona). Conservative p=0.005 floor.',
      },
    ],
  },

  // === DESCLOIZITE-GROUP (orthorhombic vanadates, {110} contact) ===
  descloizite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV (vanadates) + Frondel 1958. Descloizite (orthorhombic Pnma, PbZn(VO₄)(OH)) shows {110} contact twins documented at Berg Aukas (Namibia) and Sierra de Cordoba (Argentina). Prismatic crystals with sector-pair twins. Conservative p=0.02 (rare-to-minor in field specimens).',
      },
    ],
  },
  mottramite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV. Isostructural with descloizite (orthorhombic Pnma, Cu endmember). Same twin behavior; documented at Mottram St Andrew (England, type locality) and Tsumeb. Conservative p=0.02 matching descloizite.',
      },
    ],
  },
  clinobisvanite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.IV + Mindat clinobisvanite (BiVO₄, monoclinic I2/a) habit notes. Data sparse — clinobisvanite typically occurs as fine yellow micro-plates at supergene Bi-Cu vein zones (Hingston Down Quarry, Sardinian Mt. Cobre). Rare twinning reported but not well-characterized; conservative p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },

  // === URANYL PHOSPHATE/ARSENATE GROUP (tetragonal autunite-group, {001} contact) ===
  // Note: torbernite already has twin_laws (v9c). Same Frondel 1958 monograph
  // applies to all autunite-group entries below.
  autunite: {
    laws: [
      {
        name: 'contact_001',
        miller_indices: '{001}',
        trigger: 'growth',
        probability: 0.01,
        status: 'newly_added',
        _source:
          'Frondel 1958 The Systematic Mineralogy of Uranium and Thorium §autunite-group + Anthony Handbook v.IV. Autunite (tetragonal I4/mmm, Ca(UO₂)₂(PO₄)₂·11H₂O) shows {001} basal contact twins documented at Margnac (France) and Mt. Spokane (Washington). The autunite-group ditetragonal-dipyramidal habit produces square tablets where contact twins appear as paired basal flakes. Conservative p=0.01.',
      },
    ],
  },
  zeunerite: {
    laws: [
      {
        name: 'contact_001',
        miller_indices: '{001}',
        trigger: 'growth',
        probability: 0.01,
        status: 'newly_added',
        _source:
          'Frondel 1958 + Anthony Handbook v.IV. Zeunerite (Cu(UO₂)₂(AsO₄)₂·12H₂O, tetragonal P4/nmm) is the Cu-As analog of autunite-group; isostructural with torbernite (Cu-P). Same {001} basal contact twin behavior. Documented at Schneeberg/Walpurgis Flacher (As-rich uranium vein zone). p=0.01 matching autunite.',
      },
    ],
  },
  uranospinite: {
    laws: [
      {
        name: 'contact_001',
        miller_indices: '{001}',
        trigger: 'growth',
        probability: 0.01,
        status: 'newly_added',
        _source:
          'Frondel 1958. Uranospinite (Ca(UO₂)₂(AsO₄)₂·10H₂O, tetragonal P4/nmm) is the Ca-As member of autunite-group; isostructural with autunite (Ca-P endmember). Same basal {001} contact twins. Sparser field documentation than autunite/zeunerite — most uranospinite is collected at Schneeberg + a few Bohemian localities. p=0.01.',
      },
    ],
  },
};

const TWIN_LAWS_NOTES = {
  // Paramorph dehydration products — inherit parent geometry, don't nucleate fresh.
  'meta-autunite':
    "Intentionally empty — meta-autunite (Ca(UO₂)₂(PO₄)₂·8H₂O, tetragonal P4₂/n) is the dehydration paramorph of autunite at T > 80°C. It inherits autunite's basal {001} contact twin geometry through the paramorph transition (PARAMORPH_TRANSITIONS dispatch in 16-paramorph-transitions.ts) rather than nucleating fresh — so adding its own twin_laws entry would double-count and isn't engine-correct. The parent autunite carries the twin signal. v137 sulfide convention extended to v138 phosphate paramorphs.",
  metatorbernite:
    "Intentionally empty — metatorbernite (Cu(UO₂)₂(PO₄)₂·8H₂O, tetragonal P4/nmm) is the dehydration paramorph of torbernite at T > 75°C. Inherits torbernite's documented twin geometry through paramorph transition rather than nucleating fresh. Same rationale as meta-autunite (v138).",

  // Non-euhedral habits.
  tyuyamunite:
    "Intentionally empty — tyuyamunite (Ca(UO₂)₂(VO₄)₂·5-8H₂O, orthorhombic Pnnm) habit code 'earthy_crust' signals non-euhedral aggregate. Typical occurrence is canary-yellow earthy coatings on Colorado-Plateau sandstone, not individual tabular crystals. No documented growth twinning at this habit scale. v138 phosphate batch.",
  turquoise:
    "Intentionally empty — turquoise (CuAl₆(PO₄)₄(OH)₈·4H₂O, triclinic P1̄) habit code 'botryoidal_crust' signals non-euhedral aggregate. Forms cryptocrystalline nodular/botryoidal masses in Cu supergene zones (Cerrillos NM, Sleeping Beauty AZ, Neyshabur Iran), virtually never as individual euhedral crystals. The rare microscopic crystals (Bishop Mine VA) are too small for twinning to be observed. v138 phosphate batch.",
  plumbogummite:
    "Intentionally empty — plumbogummite (PbAl₃(PO₄)₂(OH)₅·H₂O, trigonal R3̄m) habit code 'pseudomorph_after_pyromorphite' captures its typical occurrence as a supergene pseudomorph replacing earlier pyromorphite. Doesn't nucleate fresh as euhedral individuals at vugg-scale; the pseudomorph inherits external habit from pyromorphite but no twin behavior is documented for either the replacement or the rare primary occurrences. v138 phosphate batch.",
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
    // Escape special regex chars in mineral name (meta-autunite has a hyphen).
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
