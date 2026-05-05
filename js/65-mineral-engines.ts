// ============================================================
// js/65-mineral-engines.ts — MINERAL_ENGINES dispatch table
// ============================================================
// Mineral name → grow_<mineral> function. Read by VugSimulator.runStep when nucleating + growing crystals. Each grow_* lives in its js/5x-engines-<class>.ts module.
//
// Phase B9 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

const MINERAL_ENGINES = {
  quartz: grow_quartz,
  calcite: grow_calcite,
  aragonite: grow_aragonite,
  siderite: grow_siderite,
  rhodochrosite: grow_rhodochrosite,
  dolomite: grow_dolomite,
  sphalerite: grow_sphalerite,
  wurtzite: grow_wurtzite,
  fluorite: grow_fluorite,
  pyrite: grow_pyrite,
  marcasite: grow_marcasite,
  chalcopyrite: grow_chalcopyrite,
  hematite: grow_hematite,
  malachite: grow_malachite,
  uraninite: grow_uraninite,
  galena: grow_galena,
  molybdenite: grow_molybdenite,
  smithsonite: grow_smithsonite,
  wulfenite: grow_wulfenite,
  ferrimolybdite: grow_ferrimolybdite,
  arsenopyrite: grow_arsenopyrite,
  scorodite: grow_scorodite,
  barite: grow_barite,
  celestine: grow_celestine,
  jarosite: grow_jarosite,
  alunite: grow_alunite,
  brochantite: grow_brochantite,
  antlerite: grow_antlerite,
  anhydrite: grow_anhydrite,
  selenite: grow_selenite,
  halite: grow_halite,
  borax: grow_borax,
  tincalconite: grow_tincalconite,  // paramorph-only stub
  mirabilite: grow_mirabilite,
  thenardite: grow_thenardite,
  feldspar: grow_feldspar,
  adamite: grow_adamite,
  mimetite: grow_mimetite,
  erythrite: grow_erythrite,
  annabergite: grow_annabergite,
  tetrahedrite: grow_tetrahedrite,
  tennantite: grow_tennantite,
  apophyllite: grow_apophyllite,
  goethite: grow_goethite,
  albite: grow_albite,
  topaz: grow_topaz,
  tourmaline: grow_tourmaline,
  beryl: grow_beryl,          // goshenite / generic colorless (post-R7)
  emerald: grow_emerald,      // Cr/V chromophore variety
  aquamarine: grow_aquamarine,  // Fe²⁺ reducing variety
  morganite: grow_morganite,  // Mn²⁺ variety
  heliodor: grow_heliodor,    // Fe³⁺ oxidizing variety
  corundum: grow_corundum,    // Al2O3 colorless/generic (SiO2-undersaturated)
  ruby: grow_ruby,            // Al2O3 + Cr chromium variety
  sapphire: grow_sapphire,    // Al2O3 + Fe/Ti multi-color variety
  spodumene: grow_spodumene,
  anglesite: grow_anglesite,
  cerussite: grow_cerussite,
  pyromorphite: grow_pyromorphite,
  vanadinite: grow_vanadinite,
  bornite: grow_bornite,
  chalcocite: grow_chalcocite,
  covellite: grow_covellite,
  cuprite: grow_cuprite,
  azurite: grow_azurite,
  chrysocolla: grow_chrysocolla,
  native_copper: grow_native_copper,
  native_gold: grow_native_gold,
  magnetite: grow_magnetite,
  lepidocrocite: grow_lepidocrocite,
  stibnite: grow_stibnite,
  bismuthinite: grow_bismuthinite,
  native_bismuth: grow_native_bismuth,
  clinobisvanite: grow_clinobisvanite,
  acanthite: grow_acanthite,
  argentite: grow_argentite,
  native_silver: grow_native_silver,
  native_arsenic: grow_native_arsenic,
  native_sulfur: grow_native_sulfur,
  native_tellurium: grow_native_tellurium,
  nickeline: grow_nickeline,
  millerite: grow_millerite,
  cobaltite: grow_cobaltite,
  descloizite: grow_descloizite,
  mottramite: grow_mottramite,
  raspite: grow_raspite,
  stolzite: grow_stolzite,
  olivenite: grow_olivenite,
  chalcanthite: grow_chalcanthite,
  rosasite: grow_rosasite,           // Round 9a: Cu-dominant broth-ratio carbonate
  aurichalcite: grow_aurichalcite,   // Round 9a: Zn-dominant broth-ratio carbonate
  torbernite: grow_torbernite,       // Round 9b: P-branch anion-competition uranyl phosphate (Cu-cation)
  zeunerite: grow_zeunerite,         // Round 9b: As-branch anion-competition uranyl arsenate
  carnotite: grow_carnotite,         // Round 9c: V-branch anion-competition uranyl vanadate (K-cation)
  autunite: grow_autunite,           // Round 9d: P-branch with Cu-vs-Ca cation fork — Ca-uranyl phosphate
  uranospinite: grow_uranospinite,   // Round 9e: As-branch / Ca-cation — autunite-group Ca-uranyl arsenate
  tyuyamunite: grow_tyuyamunite,     // Round 9e: V-branch / Ca-cation — orthorhombic Ca-uranyl vanadate
};
