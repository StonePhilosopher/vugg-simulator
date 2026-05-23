// v141 final twin_laws batch — the heterogeneous remainder.
// 24 minerals across 8 classes (amphibole + borate + carbonate +
// halide + hydroxide + molybdate + native + oxide). 15 twin_laws +
// 9 _twin_laws_note. Closes the twin-laws gap entirely (170/170).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'minerals.json');

const TWIN_LAWS = {
  // === AMPHIBOLE (1 — actinolite; the asbestiform 3 get _twin_laws_note) ===
  actinolite: {
    laws: [
      {
        name: 'simple_lamellar_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.II (silicates) + Deer Howie Zussman 2nd ed. amphibole-group monograph. Actinolite (monoclinic C2/m, Ca2(Mg,Fe)5Si8O22(OH)2) shares the tremolite-actinolite series {100} simple + lamellar twin law. Tremolite already has twin_laws at v134 with the same law; this commit pairs them. Documented at Cziklowa (Romania), Ala (Italy), Wyoming Greenstone Belt. Conservative p=0.02 matching tremolite — most actinolite is untwinned bladed columnar.',
      },
    ],
  },

  // === BORATE (1 — borax; tincalconite paramorph) ===
  borax: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V (borates volume) + Dana 8th. Borax (monoclinic C2/c, Na2B4O5(OH)4·8H2O) shows rare {100} contact twins in well-formed prismatic specimens. Documented at Boron (Kramer CA) + Searles Lake + Inder Lake (Kazakhstan). Most field borax is rapidly precipitated efflorescent or recrystallized from saturated brines, with limited residence time for visible twinning. p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },

  // === CARBONATE (4 — malachite/smithsonite/azurite/aurichalcite; hydrozincite spherulitic) ===
  malachite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V (carbonates) + Frondel 1962 v.III carbonate section. Malachite (monoclinic P21/a, Cu2(CO3)(OH)2) shows {100} contact twins in the iconic acicular Mashamba + Kolwezi (DRC) sprays. Botryoidal habit dominates in field specimens (the typical green satin-mass) but well-formed acicular individuals from the Katanga copperbelt routinely twin. p=0.02 reflects minor-common frequency among the visible-crystal acicular fraction.',
      },
    ],
  },
  smithsonite: {
    laws: [
      {
        name: 'contact_0001',
        miller_indices: '{0001}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V + Frondel 1962 v.III. Smithsonite (trigonal R-3c, ZnCO3) is calcite-group-isostructural; the rhombohedral form at Tsumeb + Kelly (NM) + Choix (Mexico) shows {0001} basal contact twins analogous to calcite e-twins. Most smithsonite is botryoidal "bonamite" but rhombohedral varieties carry visible twins. p=0.02.',
      },
    ],
  },
  azurite: {
    laws: [
      {
        name: 'contact_001',
        miller_indices: '{001}',
        trigger: 'growth',
        probability: 0.05,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V + Frondel 1962 v.III — Frondel\'s azurite section gives the most thorough twin documentation of any Cu-carbonate. Azurite (monoclinic P21/c, Cu3(CO3)2(OH)2) shows {001} contact twins commonly at Tsumeb, Bisbee, and Chessy-les-Mines (France, type locality). The "deep blue prismatic" habit is famously twin-prone — collector-grade Bisbee azurite from the Copper Queen routinely shows contact-twin V-pairs. p=0.05 (minor common) reflects the relatively high visible-twin frequency.',
      },
    ],
  },
  aurichalcite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V aurichalcite section. Aurichalcite (orthorhombic Pmcn, (Zn,Cu)5(CO3)2(OH)6) forms pale-blue-green acicular tufts in supergene Zn-Cu zones (Mapimí, Tsumeb, Bisbee). Twin data sparse — most aurichalcite is too acicular + tufted for individual twin observation. Conservative p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },

  // === HALIDE (1 — sylvite) ===
  sylvite: {
    laws: [
      {
        name: 'penetration_111',
        miller_indices: '{111}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.III (halides) + Dana 8th. Sylvite (cubic Fm-3m, KCl) is halite-isostructural; rare {111} penetration twins are documented in some Carlsbad (NM) potash specimens. Most sylvite occurs as cubic massive in evaporite K-salt beds (Stassfurt Germany, Saskatchewan basin) where visible twinning is uncommon. p=0.005 matching halite\'s rare-twin floor (halite has its own twin_laws entry at v9).',
      },
    ],
  },

  // === HYDROXIDE (1 — lepidocrocite; goethite gets _twin_laws_note) ===
  lepidocrocite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V + Mindat lepidocrocite habit notes. Lepidocrocite (orthorhombic Cmcm, gamma-FeO(OH)) forms ruby-red micaceous platy scales at Easton (PA) + Siegen (Germany) + Cornwall. Rare {100} contact twins reported but data sparse — platy aggregates dominate visible morphology. p=0.005 (rare-twin floor with data-sparse note).',
      },
    ],
  },

  // === MOLYBDATE / TUNGSTATE (3 — ferrimolybdite + raspite/stolzite PbWO4) ===
  ferrimolybdite: {
    laws: [
      {
        name: 'contact_010',
        miller_indices: '{010}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V (molybdates + tungstates) + Mindat ferrimolybdite habit notes. Ferrimolybdite (orthorhombic, Fe2(MoO4)3·nH2O) forms canary-yellow acicular tufts at supergene Mo-Fe oxidation zones (Climax CO, Bingham UT). Twin behavior data-sparse; rare contact twins reported. Conservative p=0.005 (rare-twin floor).',
      },
    ],
  },
  raspite: {
    laws: [
      {
        name: 'contact_100',
        miller_indices: '{100}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V. Raspite (monoclinic P21/n, PbWO4) is the monoclinic dimorph of stolzite — rare at most localities, dominant at Broken Hill (NSW, Australia type). Tabular habit shows {100} contact twins per Anthony. Conservative p=0.02 reflecting the visible twins among well-formed Broken Hill specimens.',
      },
    ],
  },
  stolzite: {
    laws: [
      {
        name: 'contact_110',
        miller_indices: '{110}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V. Stolzite (tetragonal I41/a, PbWO4) is the tetragonal scheelite-group dimorph of raspite. Same Broken Hill type-locality; also documented at Tsumeb + Mapimí. {110} contact twins per Anthony — scheelite-group dipyramidal habit favors visible twin formation. p=0.02 matching raspite.',
      },
    ],
  },

  // === NATIVE (3 — native_bismuth + native_sulfur + native_tellurium;
  //                native_arsenic + awaruite get _twin_laws_note) ===
  native_bismuth: {
    laws: [
      {
        name: 'contact_0112',
        miller_indices: '{01-12}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I (native elements). Native bismuth (trigonal R-3m, Bi) shows {01-12} contact + {01-14} rotation twins in well-formed rhombohedral platelets at Schneeberg (Saxony) + Cobalt (Ontario) five-element-vein specimens. Most native bismuth occurs as arborescent / skeletal aggregates of small platelets — the arborescent habit is the cluster pattern, not the individual crystal; per-platelet twinning is rare but documented. Conservative p=0.005 (rare-twin floor reflecting the per-platelet probability).',
      },
    ],
  },
  native_sulfur: {
    laws: [
      {
        name: 'contact_101',
        miller_indices: '{101}',
        trigger: 'growth',
        probability: 0.02,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I. Native alpha-sulfur (orthorhombic Fddd, S) shows {101} and {011} contact twins documented in the classic Sicilian Cianciana + Agrigento bipyramidal crystals (the Sicilian "solfara" sulfur). Maybee + Bolivia (Tarapaca) also produce twinned specimens. p=0.02 reflects the minor-common visible-twin frequency in well-formed bipyramidal specimens.',
      },
    ],
  },
  native_tellurium: {
    laws: [
      {
        name: 'contact_0112',
        miller_indices: '{01-12}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.I + Ramdohr 1980 §3 native elements. Native tellurium (trigonal P3121, Te) forms prismatic hexagonal crystals at the iconic Cresson Vug (Cripple Creek CO) and Săcărâmb (Romania) telluride zones. Rare {01-12} contact twins reported. Conservative p=0.005 (rare-twin floor) — most native tellurium is small-crystal or massive.',
      },
    ],
  },

  // === OXIDE (1 — brucite; uraninite gets _twin_laws_note) ===
  brucite: {
    laws: [
      {
        name: 'contact_1011',
        miller_indices: '{10-11}',
        trigger: 'growth',
        probability: 0.005,
        status: 'newly_added',
        _source:
          'Anthony Handbook v.V brucite section. Brucite (trigonal P-3m1, Mg(OH)2) forms tabular hexagonal platelets at Hoboken (NJ, type) + Wood\'s Chrome Mine (PA) + Asbestos (Quebec). Layered structure with perfect {0001} cleavage; rare {10-11} contact twins reported. Most brucite is foliated/platy aggregates. p=0.005 (rare-twin floor — similar treatment to covellite + molybdenite layered minerals at v137).',
      },
    ],
  },
};

const TWIN_LAWS_NOTES = {
  // === AMPHIBOLE — asbestiform habit precludes individual euhedra ===
  anthophyllite:
    "Intentionally empty — anthophyllite (orthorhombic Pnma, (Mg,Fe)7Si8O22(OH)2) habit code 'fibrous_asbestiform' signals asbestos habit, fibers rather than individual euhedral amphibole crystals. The amphibole-group {100} twin law (carried by tremolite + actinolite) requires single crystals; asbestiform fibers don't admit it. v141 final batch.",
  amosite:
    "Intentionally empty — amosite ((Fe,Mg)7Si8O22(OH)2, asbestiform variety of grunerite-cummingtonite amphibole series) habit code 'fibrous_asbestiform'. Like anthophyllite, the asbestiform habit precludes individual amphibole crystals that could carry the {100} twin law. v141 final batch.",
  crocidolite:
    "Intentionally empty — crocidolite (Na2Fe2+3Fe3+2Si8O22(OH)2, asbestiform variety of riebeckite) habit code 'fibrous_asbestiform' — blue asbestos. The fibrous-aligned riebeckite microfibers don't carry visible twinning. Parent riebeckite would; crocidolite as a habit-variant doesn't. v141 final batch.",

  // === BORATE — paramorph (v138 paramorph-inheritance convention) ===
  tincalconite:
    "Intentionally empty — tincalconite (Na2B4O7·5H2O, hexagonal R-3c) is the dehydration paramorph of borax at low humidity / mild heating. Inherits borax\'s twin geometry through paramorph transition rather than nucleating fresh — same v138 paramorph-inheritance convention used for meta-autunite + metatorbernite + metazeunerite. The parent borax carries the twin signal. v141 final batch.",

  // === CARBONATE — spherulitic habit ===
  hydrozincite:
    "Intentionally empty — hydrozincite (monoclinic, Zn5(CO3)2(OH)6) habit code 'spherulitic_crust' signals non-euhedral aggregate. Forms white spherulitic + reniform coatings in supergene Zn zones (Mendip Hills, Linares Spain, Sardinian deposits). No individual euhedral crystals to twin. v141 final batch.",

  // === HYDROXIDE — botryoidal/mammillary/fibrous habit ===
  goethite:
    "Intentionally empty — goethite (orthorhombic Pnma, alpha-FeO(OH)) habit code 'botryoidal_or_mammillary_or_fibrous' signals non-euhedral aggregate. The dominant field habit is botryoidal/mammillary (Schwartzwald Pikes Peak Cornwall), with rare prismatic individuals (Kongsberg). The simulator renders the dominant non-euhedral form; well-formed Kongsberg-type goethite WOULD twin on {021} per Anthony v.V, but at this habit code those individuals are not produced. v141 final batch.",

  // === NATIVE — massive granular / microscopic ===
  native_arsenic:
    "Intentionally empty — native arsenic (trigonal R-3m, As) habit code 'massive_granular' signals non-euhedral aggregate. Almost always occurs as botryoidal + reniform + sooty masses at Schneeberg + Sankt Andreasberg + Pribram, not as individual euhedra. Anthony Handbook v.I notes native arsenic almost never forms euhedral crystals; the rare crystalline form (Schneeberg pillow specimens) is rhombohedral but the simulator renders the dominant massive habit. v141 final batch.",
  awaruite:
    "Intentionally empty — awaruite (cubic Pm-3m, Ni2Fe to Ni3Fe alloy) habit code 'grains_microscopic' — the species occurs only as microscopic grains in serpentinite, never as visible individual crystals at vugg-scale. No twin observation possible at this scale. v141 final batch.",

  // === OXIDE — pitchblende massive habit ===
  uraninite:
    "Intentionally empty — uraninite (cubic Fm-3m, UO2) habit code 'pitchblende_massive' signals the dominant non-euhedral colloform/massive variety. Well-formed cubic uraninite crystals (Černý Důl Czech Republic, Wölsendorf Germany) DO show {111} contact twins per Anthony v.V, but the simulator renders the pitchblende-massive form — the more common natural occurrence at the vugg vein/replacement scale. v141 final batch.",
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
