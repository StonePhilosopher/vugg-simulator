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
  cinnabar: grow_cinnabar,
  realgar: grow_realgar,
  orpiment: grow_orpiment,
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
  // v63 brief-19 engines (May 2026) — 19 minerals from canonical's a7b312e
  // research drop + the priority three (rutile / turquoise / chrysoprase).
  rutile: grow_rutile,
  chromite: grow_chromite,
  apatite: grow_apatite,
  turquoise: grow_turquoise,
  chrysoprase: grow_chrysoprase,
  atacamite: grow_atacamite,
  sylvite: grow_sylvite,
  strontianite: grow_strontianite,
  witherite: grow_witherite,
  scheelite: grow_scheelite,
  powellite: grow_powellite,
  wolframite: grow_wolframite,
  calaverite: grow_calaverite,
  sylvanite: grow_sylvanite,
  hessite: grow_hessite,
  naumannite: grow_naumannite,
  clausthalite: grow_clausthalite,
  greenockite: grow_greenockite,
  hawleyite: grow_hawleyite,
  // v86 (2026-05-19): Li-mica from late-pegmatite F-rich residual fluid.
  // Mn-purple chromophore + spodumene-replacement paragenesis.
  // Thermoluminescence property carried on the spec (not a runtime
  // mechanic — flagged for future render hook).
  lepidolite: grow_lepidolite,
  // v87 (2026-05-19): Ca-Cu arsenate, cation analog of olivenite.
  // Vivid emerald-green from Cu²⁺ chromophore + Ca-Cu cation-fork
  // mechanic (Ca/(Ca+Cu) > 0.4 routes to conichalcite; Cu-dominant
  // stays with olivenite). Tsumeb / Bisbee supergene oxidation zone.
  conichalcite: grow_conichalcite,
  // v88 (2026-05-19): hydrated Ca-only arsenate, the Jáchymov /
  // Schneeberg / Cobalt-Ontario five-element-vein bloom. Radiating
  // acicular "starburst" habit; thermal dehydration at >80°C drives
  // conversion to haidingerite (modeled as dissolution since
  // haidingerite isn't in the catalog).
  pharmacolite: grow_pharmacolite,
  // v89 (2026-05-19): primary tin ore SnO2. New Sn fluid field added
  // alongside (the first new chemistry field since v62's Cd/Hg). Three
  // habit dispatch paths by T at nucleation: prismatic dipyramid
  // (>500°C pegmatite), equant blocky (300-500°C greisen), botryoidal
  // wood tin (<300°C low-T). Cassiterite is inert -- no acid
  // dissolution, no thermal decomposition, no oxidation.
  cassiterite: grow_cassiterite,
  // v93 (2026-05-19): Cu-silicate pair for Tsumeb / Bisbee supergene.
  // dioptase: emerald-green, type loc. Altyn-Tyube Kazakhstan, world
  //   reference Tsumeb 2nd oxidation zone. Forms when carbonate is
  //   locally exhausted (CO₃ < 50) leaving Cu-Si pore fluid; pH 6.5-8.
  // shattuckite: deep azure-blue, type loc. Shattuck mine Bisbee
  //   (Schaller 1915). Replaces malachite/azurite when CO₂ escapes
  //   vadose vug; higher pH (7.5-9.0) than dioptase.
  // Per research dossier 2026-05 (Ribbe/Gibbs/Hamil 1977, Evans &
  // Mrose 1977, Keller 1977).
  dioptase: grow_dioptase,
  shattuckite: grow_shattuckite,
  // v94 (2026-05-19): Cu₃AsS₄ high-sulfidation primary sulfosalt.
  // Distinguishes from tennantite via pH + sulfidation-state proxy
  // (enargite: pH < 4.5, log10(S)-pH > 0.5; tennantite: pH 3-7,
  // proxy 0.5-1.5). Polymorph dispatch: enargite > 320°C, luzonite
  // < 320°C (Posfai & Buseck 1998). Refs: Einaudi/Hedenquist/Inan
  // 2003 SEG SP10; Sack & Loucks 1985 Am. Min. 70:1270.
  enargite: grow_enargite,
  // v95 (2026-05-19): Diarsenide quartet — the five-element vein
  // primary arsenide stage. Schneeberg / Jachymov / Cobalt-Ontario /
  // Bou Azzer canonical. Each fires in a distinct T + dominant-metal
  // window per the Kissin (1992) + Markl et al. (2016) Co-Ni-Fe
  // fractionation paragenesis:
  //   skutterudite   (Co,Ni,Fe)As₃  T 280-500 highest, on native Bi-Ag
  //   safflorite     (Co,Fe)As₂     T 200-380 mantles, star-twin
  //   rammelsbergite NiAs₂          T 250-420 Ni-dominant, pink tint
  //   loellingite    FeAs₂          T 150-450 Fe-dominant, outermost rim
  // All require As >> S (proxy for X_As > 0.95) and reducing.
  // Loellingite has the sharpest S gate (S < 1) — above that, flips
  // to arsenopyrite (Kretschmar & Scott 1976 Can. Min. 14:364).
  skutterudite: grow_skutterudite,
  safflorite: grow_safflorite,
  rammelsbergite: grow_rammelsbergite,
  loellingite: grow_loellingite,
};
