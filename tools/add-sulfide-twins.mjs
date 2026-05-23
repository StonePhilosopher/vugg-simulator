// One-shot script to add twin_laws entries to the 20 missing sulfides + 4 _twin_laws_note
// metadata entries. Runs once for v137 sulfide batch. After use, delete or keep as
// reference for future class batches.
//
// Strategy: read minerals.json as STRING, for each target mineral find the entry block
// via regex anchored on `"<mineral>": {`, then within that block do a string replacement
// of `"twin_laws": []` → new content. Preserves all other formatting since we never
// reparse/restringify the whole file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'minerals.json');

// Each entry is the new twin_laws array contents (or null for "use _twin_laws_note instead").
// 16 ship twin_laws (most rare-twin floor at p=0.005-0.05); 4 ship _twin_laws_note explaining
// why empty (non-euhedral / pseudomorph / sooty).
//
// Indentation matches existing file (6 spaces for field level, 8 for array contents, 10 for
// object fields inside array).
const TWIN_LAWS = {
  // === Cubic-family (spinel-law {111}) ===
  tetrahedrite: {
    laws: [
      {
        name: 'contact_111',
        miller_indices: '{111}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I (sulfides) + Ramdohr 1980 §4.4 fahlore section. Tetrahedrite is cubic I4̄3m; the diagnostic {111} tetrahedral habit twins by contact-twin on a tetrahedral face, observed in well-developed Schwaz/Freiberg/Cornwall specimens. Conservative p=0.05 (minor common) — twins are visible but not dominant in field-collected specimens.',
      },
    ],
  },
  tennantite: {
    laws: [
      {
        name: 'contact_111',
        miller_indices: '{111}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I + Ramdohr 1980 §4.4. Isostructural with tetrahedrite (cubic I4̄3m, As endmember of fahlore solid solution). Same {111} contact twins reported in Butte / Tsumeb / Bingham specimens. Conservative p=0.05 matching tetrahedrite.',
      },
    ],
  },
  clausthalite: {
    laws: [
      {
        name: 'spinel_law',
        miller_indices: '{111}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.2 selenide section. PbSe is isostructural with galena (cubic Fm3̄m). Twinning data sparse — most clausthalite occurrences are massive replacement bodies. Conservative p=0.005 (rare-twin floor) mirroring galena (where spinel-law twins are documented but uncommon).',
      },
    ],
  },

  // === Tetragonal/orthorhombic with pyrite-group affinities ===
  cobaltite: {
    laws: [
      {
        name: 'iron_cross',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I + Ramdohr 1980 §4.5 cobalt-arsenide section. Cobaltite is pseudo-cubic (orthorhombic Pca2₁ but cubic in habit) and shares pyritohedral / iron-cross-like twinning behavior with the pyrite group. Documented at Tunaberg (Sweden), Cobalt (Ontario). Conservative p=0.02 — twins visible in well-formed specimens but not common.',
      },
    ],
  },

  // === Orthorhombic Sb/Bi sulfides ({130} contact) ===
  stibnite: {
    laws: [
      {
        name: 'contact_130',
        miller_indices: '{130}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Dana 8th ed. + Anthony Handbook v.I + Ramdohr 1980 §4.6 antimony-sulfide section. Stibnite (orthorhombic Pbnm) shows contact + cyclic twins on {130}, documented at Ichinokawa (Japan) and Felsőbánya (Romania) where the bladed habit occasionally produces V-pair contact twins. Conservative p=0.02 — most acicular stibnite is untwinned.',
      },
    ],
  },
  bismuthinite: {
    laws: [
      {
        name: 'contact_130',
        miller_indices: '{130}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I + Ramdohr 1980 §4.6. Isostructural with stibnite (orthorhombic Pbnm). Twinning behavior parallels stibnite; conservative p=0.02 reflects the same rare-but-documented field frequency.',
      },
    ],
  },

  // === Monoclinic As-sulfides ({100} contact) ===
  realgar: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I (sulfide section). Realgar (monoclinic P2₁/n) shows {100} contact twins, documented in Mercur (Utah), Allchar (North Macedonia), and Shimen (China) low-T epithermal specimens. Conservative p=0.02 — twins visible in prismatic specimens but rare.',
      },
    ],
  },
  orpiment: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.01,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I. Orpiment is monoclinic P2₁/n, foliated golden masses dominated by {010} cleavage. {100} contact twinning is reported but less common than in realgar because orpiment crystals are typically foliated/columnar rather than equant. Conservative p=0.01 (data sparse — most field orpiment is foliated/massive).',
      },
    ],
  },

  // === Trigonal / hexagonal (cinnabar, nickeline, millerite) ===
  cinnabar: {
    laws: [
      {
        name: 'contact_0001',
        miller_indices: '{0001}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Dana 8th + Anthony Handbook v.I. Cinnabar (trigonal P3₂21) shows {0001} simple contact twins ("penetration twins" of older usage) and twins on {10-11}, well documented in Almadén (Spain) and Idrija (Slovenia) specimens. The contact twin on basal pinacoid is the most-cited variety; p=0.05 reflects the minor-common field frequency at the classic localities.',
      },
    ],
  },
  nickeline: {
    laws: [
      {
        name: 'contact_1011',
        miller_indices: '{10-11}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.5 nickel-arsenide section + Anthony Handbook v.I. Nickeline (NiAs, hexagonal P6₃/mmc) shows {10-11} contact twins at Cobalt (Ontario) and Schneeberg (Saxony). Conservative p=0.02 — most nickeline occurs as massive replacement of cobalt-nickel veins; visible euhedral twins are uncommon.',
      },
    ],
  },
  millerite: {
    laws: [
      {
        name: 'contact_3034',
        miller_indices: '{30-34}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I + Mindat millerite habit notes. Millerite (NiS, trigonal R3m) is famous for hair-fine acicular tufts (Sterling Mine, Iowa, the classic geode locality). Twinning on {30-34} is documented but vanishingly rare — most millerite is capillary and untwinned. Conservative p=0.005 (rare-twin floor with data-sparse caveat).',
      },
    ],
  },

  // === Other (acanthite, hessite, naumannite, sylvanite) ===
  acanthite: {
    laws: [
      {
        name: 'paramorphic_111',
        miller_indices: '{111}',
        trigger: 'growth (paramorphic from cubic argentite)',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.7 silver-sulfide section. Acanthite (monoclinic P2₁/n, stable below 177°C) commonly inherits paramorphic {111} twin geometry from the high-T cubic argentite phase (Ag₂S inverts on cooling). At Freiberg / Kongsberg, acanthite preserves the cubic-habit external shape with internal paramorphic twins. p=0.02 reflects rare visible-twin frequency — most acanthite is massive or wire-form.',
      },
    ],
  },
  hessite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.8 telluride section + Anthony Handbook v.I. Hessite (Ag₂Te, monoclinic at room T, cubic above 150°C) shows {110} polysynthetic twin lamellae from the inversion + growth twins on contact planes. Documented at Săcărâmb (Romania) and Calaveras (California). Conservative p=0.02 — visible twins moderate in well-formed specimens.',
      },
    ],
  },
  naumannite: {
    laws: [
      {
        name: 'inversion_110',
        miller_indices: '{110}',
        trigger: 'cooling',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.2 selenide section. Naumannite (Ag₂Se) has an inversion analogous to hessite (orthorhombic at room T, pseudo-cubic above ~133°C). Twin behavior data-sparse — Ramdohr notes inversion lamellae but no detailed twin-law characterization. Conservative p=0.005 (rare-twin floor).',
      },
    ],
  },
  sylvanite: {
    laws: [
      {
        name: 'graphic_twin_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Ramdohr 1980 §4.8 telluride section + Anthony Handbook v.I. Sylvanite ((Au,Ag)Te₂, monoclinic P2/c) takes its name from the diagnostic "graphic" intergrowth at Sacarîmb (formerly Nagyág) — bladed crystals whose {100} contact twins produce hieroglyph-like outlines. The graphic twin is the species visual signature; p=0.05 reflects that the morphology is common in well-formed specimens but the underlying twin probability per nucleation is still moderate.',
      },
    ],
  },

  // === Cleavage-twin only (covellite) ===
  covellite: {
    laws: [
      {
        name: 'cleavage_twin_1122',
        miller_indices: '{11-22}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I (CuS section) + Ramdohr 1980 §4.3 copper-sulfide section. Covellite (hexagonal P6₃/mmc, micaceous basal cleavage) has rare {11-22} contact twins documented at Butte and Calabona. Most covellite occurs as iridescent plates without visible twins because the basal cleavage dominates the surface morphology. p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },
};

const TWIN_LAWS_NOTES = {
  molybdenite:
    "Intentionally empty — molybdenite (hexagonal P6₃/mmc, MoS₂) forms platy/foliated crystals dominated by perfect basal {0001} cleavage. Glide twinning on {0001} is documented microscopically (Mindat) but no macroscopic growth twin law is recorded in Dana 8th or Ramdohr 1980. v137 sulfide batch: documented intentionally-empty per the v136 convention.",
  metacinnabar:
    "Intentionally empty — metacinnabar (cubic F4̄3m, HgS) occurs almost exclusively as massive/sooty replacement of cinnabar, low-T supergene crusts, or fine-grained black coatings. The habit code 'massive_sooty' signals non-individual at vugg-scale; no documented growth twin law. v137 sulfide batch.",
  hawleyite:
    "Intentionally empty — hawleyite (cubic F4̄3m, CdS) is the powdery cubic CdS dimorph of greenockite, occurring only as yellow powdery coatings on sphalerite/marcasite in oxidation zones. Never forms individual euhedral crystals; habit code 'powdery_coating' signals non-individual. v137 sulfide batch.",
  pararealgar:
    "Intentionally empty — pararealgar (monoclinic P2₁/c, As₄S₄) is a photodecomposition pseudomorph after realgar, forming as a yellow surface alteration crust rather than as primary euhedral crystals. Habit code 'yellow_pseudomorph' signals non-individual. v137 sulfide batch.",
};

function indent(obj, baseIndent) {
  // JSON.stringify with 2-space indent, then re-indent each line by baseIndent.
  const raw = JSON.stringify(obj, null, 2);
  return raw
    .split('\n')
    .map((line, i) => (i === 0 ? line : baseIndent + line))
    .join('\n');
}

function buildLawsBlock(laws, fieldIndent) {
  // fieldIndent is the indent of the "twin_laws" key (e.g. "      ").
  // Each law object goes one level deeper.
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
    // Find the mineral's block: from `"mineral": {` to its matching close brace.
    // Use a regex that grabs the block boundaries.
    const blockStartRe = new RegExp(`(\\n    "${mineral}": \\{)`);
    const match = blockStartRe.exec(updated);
    if (!match) {
      throw new Error(`Could not find block start for ${mineral}`);
    }
    const blockStart = match.index + 1; // skip leading \n
    // Find the matching close brace by counting braces from blockStart.
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
          i++; // include the close brace
          break;
        }
      }
    }
    const blockEnd = i;
    const block = updated.slice(blockStart, blockEnd);

    // Within this block, find `      "twin_laws": [],`
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
      // Add _twin_laws_note BEFORE twin_laws line, then keep twin_laws empty.
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

  // Validate by parsing back
  try {
    JSON.parse(updated);
  } catch (e) {
    throw new Error(`Result no longer valid JSON: ${e.message}`);
  }

  fs.writeFileSync(FILE, updated);
  console.log(`Edited ${editedCount} mineral entries (${Object.keys(TWIN_LAWS).length} twin_laws + ${Object.keys(TWIN_LAWS_NOTES).length} _twin_laws_note).`);
}

processFile();
