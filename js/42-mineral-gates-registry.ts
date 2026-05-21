// ============================================================
// js/42-mineral-gates-registry.ts — MINERAL_GATES_REGISTRY
// ============================================================
// Flat lookup: mineral name → MINERAL_GATES_<mineral> constant. Lets the
// initiative module (js/43-initiative.ts), library card, and tests
// iterate gates without parsing source files. Cross-cuts the per-class
// MINERAL_GATES_* declarations in js/3x-supersat-*.ts.
//
// Load order: this file MUST sit after every js/3x-supersat-*.ts (30–41)
// because `const` declarations are not hoisted — TDZ on each entry
// before its supersat file declares it. Prefix 42 is the first free slot
// after sulfide (41). Anything that reads the registry (initiative,
// library card, guard test) must load LATER than this file.
//
// Coverage invariant: every key in MINERAL_ENGINES (js/65) has a matching
// entry here. Enforced by tests-js/engine-gates-coverage.test.ts. Adding
// a new mineral requires touching this registry alongside the engine
// dispatch table — same rule the README's mineral-add table will gain.
//
// v127 (2026-05-21): introduced as the consolidator for the engine-gates
// refactor. 165 entries at landing, grouped by class to match the
// supersat file layout.

const MINERAL_GATES_REGISTRY: Record<string, MineralGates> = {
  // ---- Arsenate (js/30-supersat-arsenate.ts) ----
  olivenite: MINERAL_GATES_olivenite,
  scorodite: MINERAL_GATES_scorodite,
  erythrite: MINERAL_GATES_erythrite,
  annabergite: MINERAL_GATES_annabergite,
  adamite: MINERAL_GATES_adamite,
  pharmacolite: MINERAL_GATES_pharmacolite,
  conichalcite: MINERAL_GATES_conichalcite,
  mimetite: MINERAL_GATES_mimetite,
  austinite: MINERAL_GATES_austinite,
  legrandite: MINERAL_GATES_legrandite,
  koettigite: MINERAL_GATES_koettigite,
  duftite: MINERAL_GATES_duftite,
  bayldonite: MINERAL_GATES_bayldonite,

  // ---- Borate (js/31-supersat-borate.ts) ----
  borax: MINERAL_GATES_borax,
  tincalconite: MINERAL_GATES_tincalconite,

  // ---- Carbonate (js/32-supersat-carbonate.ts) ----
  calcite: MINERAL_GATES_calcite,
  aragonite: MINERAL_GATES_aragonite,
  dolomite: MINERAL_GATES_dolomite,
  siderite: MINERAL_GATES_siderite,
  rhodochrosite: MINERAL_GATES_rhodochrosite,
  malachite: MINERAL_GATES_malachite,
  smithsonite: MINERAL_GATES_smithsonite,
  azurite: MINERAL_GATES_azurite,
  cerussite: MINERAL_GATES_cerussite,
  rosasite: MINERAL_GATES_rosasite,
  aurichalcite: MINERAL_GATES_aurichalcite,
  strontianite: MINERAL_GATES_strontianite,
  witherite: MINERAL_GATES_witherite,
  hydrozincite: MINERAL_GATES_hydrozincite,

  // ---- Halide (js/33-supersat-halide.ts) ----
  fluorite: MINERAL_GATES_fluorite,
  halite: MINERAL_GATES_halite,
  atacamite: MINERAL_GATES_atacamite,
  sylvite: MINERAL_GATES_sylvite,

  // ---- Hydroxide (js/34-supersat-hydroxide.ts) ----
  goethite: MINERAL_GATES_goethite,
  lepidocrocite: MINERAL_GATES_lepidocrocite,

  // ---- Molybdate / tungstate (js/35-supersat-molybdate.ts) ----
  wulfenite: MINERAL_GATES_wulfenite,
  ferrimolybdite: MINERAL_GATES_ferrimolybdite,
  raspite: MINERAL_GATES_raspite,
  stolzite: MINERAL_GATES_stolzite,
  scheelite: MINERAL_GATES_scheelite,
  powellite: MINERAL_GATES_powellite,
  wolframite: MINERAL_GATES_wolframite,

  // ---- Native (js/36-supersat-native.ts) ----
  native_tellurium: MINERAL_GATES_native_tellurium,
  native_sulfur: MINERAL_GATES_native_sulfur,
  native_arsenic: MINERAL_GATES_native_arsenic,
  native_silver: MINERAL_GATES_native_silver,
  native_bismuth: MINERAL_GATES_native_bismuth,
  native_gold: MINERAL_GATES_native_gold,
  native_copper: MINERAL_GATES_native_copper,
  awaruite: MINERAL_GATES_awaruite,

  // ---- Oxide (js/37-supersat-oxide.ts) ----
  cassiterite: MINERAL_GATES_cassiterite,
  hematite: MINERAL_GATES_hematite,
  uraninite: MINERAL_GATES_uraninite,
  magnetite: MINERAL_GATES_magnetite,
  cuprite: MINERAL_GATES_cuprite,
  corundum: MINERAL_GATES_corundum,
  ruby: MINERAL_GATES_ruby,
  sapphire: MINERAL_GATES_sapphire,
  rutile: MINERAL_GATES_rutile,
  chromite: MINERAL_GATES_chromite,
  pyrolusite: MINERAL_GATES_pyrolusite,
  brucite: MINERAL_GATES_brucite,

  // ---- Phosphate / vanadate (js/38-supersat-phosphate.ts) ----
  plumbogummite: MINERAL_GATES_plumbogummite,
  descloizite: MINERAL_GATES_descloizite,
  mottramite: MINERAL_GATES_mottramite,
  clinobisvanite: MINERAL_GATES_clinobisvanite,
  pyromorphite: MINERAL_GATES_pyromorphite,
  vanadinite: MINERAL_GATES_vanadinite,
  torbernite: MINERAL_GATES_torbernite,
  autunite: MINERAL_GATES_autunite,
  zeunerite: MINERAL_GATES_zeunerite,
  uranospinite: MINERAL_GATES_uranospinite,
  carnotite: MINERAL_GATES_carnotite,
  tyuyamunite: MINERAL_GATES_tyuyamunite,
  apatite: MINERAL_GATES_apatite,
  turquoise: MINERAL_GATES_turquoise,

  // ---- Silicate (js/39-supersat-silicate.ts) ----
  quartz: MINERAL_GATES_quartz,
  feldspar: MINERAL_GATES_feldspar,
  apophyllite: MINERAL_GATES_apophyllite,
  albite: MINERAL_GATES_albite,
  lepidolite: MINERAL_GATES_lepidolite,
  spodumene: MINERAL_GATES_spodumene,
  chrysocolla: MINERAL_GATES_chrysocolla,
  beryl: MINERAL_GATES_beryl,
  emerald: MINERAL_GATES_emerald,
  aquamarine: MINERAL_GATES_aquamarine,
  morganite: MINERAL_GATES_morganite,
  heliodor: MINERAL_GATES_heliodor,
  tourmaline: MINERAL_GATES_tourmaline,
  topaz: MINERAL_GATES_topaz,
  opal: MINERAL_GATES_opal,
  coffinite: MINERAL_GATES_coffinite,
  uranophane: MINERAL_GATES_uranophane,
  hemimorphite: MINERAL_GATES_hemimorphite,
  willemite: MINERAL_GATES_willemite,
  dioptase: MINERAL_GATES_dioptase,
  shattuckite: MINERAL_GATES_shattuckite,
  chrysoprase: MINERAL_GATES_chrysoprase,
  tigers_eye: MINERAL_GATES_tigers_eye,
  chrysotile: MINERAL_GATES_chrysotile,
  pectolite: MINERAL_GATES_pectolite,
  wollastonite: MINERAL_GATES_wollastonite,
  prehnite: MINERAL_GATES_prehnite,
  grossular: MINERAL_GATES_grossular,
  diopside: MINERAL_GATES_diopside,
  vesuvianite: MINERAL_GATES_vesuvianite,
  datolite: MINERAL_GATES_datolite,

  // ---- Amphibole (js/39a-supersat-amphibole.ts) ----
  tremolite: MINERAL_GATES_tremolite,
  actinolite: MINERAL_GATES_actinolite,
  anthophyllite: MINERAL_GATES_anthophyllite,
  amosite: MINERAL_GATES_amosite,
  crocidolite: MINERAL_GATES_crocidolite,

  // ---- Sulfate (js/40-supersat-sulfate.ts) ----
  barite: MINERAL_GATES_barite,
  celestine: MINERAL_GATES_celestine,
  anhydrite: MINERAL_GATES_anhydrite,
  brochantite: MINERAL_GATES_brochantite,
  antlerite: MINERAL_GATES_antlerite,
  jarosite: MINERAL_GATES_jarosite,
  alunite: MINERAL_GATES_alunite,
  chalcanthite: MINERAL_GATES_chalcanthite,
  mirabilite: MINERAL_GATES_mirabilite,
  thenardite: MINERAL_GATES_thenardite,
  selenite: MINERAL_GATES_selenite,
  anglesite: MINERAL_GATES_anglesite,
  linarite: MINERAL_GATES_linarite,
  caledonite: MINERAL_GATES_caledonite,
  leadhillite: MINERAL_GATES_leadhillite,

  // ---- Sulfide (js/41-supersat-sulfide.ts) ----
  sphalerite: MINERAL_GATES_sphalerite,
  wurtzite: MINERAL_GATES_wurtzite,
  pyrite: MINERAL_GATES_pyrite,
  marcasite: MINERAL_GATES_marcasite,
  chalcopyrite: MINERAL_GATES_chalcopyrite,
  galena: MINERAL_GATES_galena,
  molybdenite: MINERAL_GATES_molybdenite,
  acanthite: MINERAL_GATES_acanthite,
  argentite: MINERAL_GATES_argentite,
  nickeline: MINERAL_GATES_nickeline,
  millerite: MINERAL_GATES_millerite,
  cobaltite: MINERAL_GATES_cobaltite,
  arsenopyrite: MINERAL_GATES_arsenopyrite,
  tetrahedrite: MINERAL_GATES_tetrahedrite,
  tennantite: MINERAL_GATES_tennantite,
  cinnabar: MINERAL_GATES_cinnabar,
  realgar: MINERAL_GATES_realgar,
  orpiment: MINERAL_GATES_orpiment,
  stibnite: MINERAL_GATES_stibnite,
  bismuthinite: MINERAL_GATES_bismuthinite,
  bornite: MINERAL_GATES_bornite,
  chalcocite: MINERAL_GATES_chalcocite,
  covellite: MINERAL_GATES_covellite,
  calaverite: MINERAL_GATES_calaverite,
  sylvanite: MINERAL_GATES_sylvanite,
  hessite: MINERAL_GATES_hessite,
  naumannite: MINERAL_GATES_naumannite,
  clausthalite: MINERAL_GATES_clausthalite,
  greenockite: MINERAL_GATES_greenockite,
  hawleyite: MINERAL_GATES_hawleyite,
  metacinnabar: MINERAL_GATES_metacinnabar,
  skutterudite: MINERAL_GATES_skutterudite,
  safflorite: MINERAL_GATES_safflorite,
  rammelsbergite: MINERAL_GATES_rammelsbergite,
  loellingite: MINERAL_GATES_loellingite,
  proustite: MINERAL_GATES_proustite,
  pyrargyrite: MINERAL_GATES_pyrargyrite,
  enargite: MINERAL_GATES_enargite,
};
