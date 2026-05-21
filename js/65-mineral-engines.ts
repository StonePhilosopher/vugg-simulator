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
  // v96 (2026-05-19): Ruby silvers — late epithermal Ag, the As:Sb
  // fork. proustite Ag₃AsS₃ (scarlet, As-end) vs pyrargyrite Ag₃SbS₃
  // (cherry-red, Sb-end). Trigonal R3c isostructural; near-complete
  // solid solution > 300°C, miscibility gap < 200°C (Sack & Loucks
  // 1985). Use arseniteAvailablePpm + fluid.Sb fork. Photodecomposes.
  // Refs: Sack & Loucks 1985 Am. Min. 70:1270; Ondrus et al. 2003;
  // Keighin & Honea 1969 (phase diagram); Handbook of Mineralogy.
  proustite: grow_proustite,
  pyrargyrite: grow_pyrargyrite,
  // v97 (2026-05-19): Tsumeb arsenate suite — austinite + legrandite +
  // koettigite + duftite + bayldonite. The 2nd-oxidation-zone
  // signature arsenates from Gebhard 1999 monograph. Cation-ratio
  // fork gates (Ca:Zn, Cu:Pb, Cu vs Zn fraction, Co/Ni-vs-Zn) per
  // Magalhães et al. 1988 + Gebhard 1999 paragenesis. All use
  // arsenateAvailablePpm (As(V)) + oxidizing supergene window.
  austinite: grow_austinite,
  legrandite: grow_legrandite,
  koettigite: grow_koettigite,
  duftite: grow_duftite,
  bayldonite: grow_bayldonite,
  // v98 (2026-05-19): Zn supergene suite — hemimorphite + willemite +
  // hydrozincite. The Zn-silicate + Zn-carbonate-hydroxide triad of
  // nonsulfide Zn deposits (Tsumeb, Skorpion, Franklin, Iglesiente).
  // hemimorphite & willemite go in silicate engine file; hydrozincite
  // in carbonate engine file. Discriminators per Hitzman 2003 + Boni
  // & Mondillo 2015:
  //   hemimorphite  <50°C  pH 5.5-8  SiO2 >> CO3
  //   willemite     50-200°C primary OR 500-600°C metamorphic
  //   hydrozincite  <30°C  pH 7-9 alkaline  CO3 >> SiO2
  hemimorphite: grow_hemimorphite,
  willemite: grow_willemite,
  hydrozincite: grow_hydrozincite,
  // v99 (2026-05-19): Uranyl silicates — coffinite (U(IV) primary,
  // reducing, hot, replaces uraninite) + uranophane (U(VI) supergene,
  // oxidizing, cool, brilliant UV-fluorescent yellow). Opposite redox
  // sides. Per Finch & Murakami 1999 RIMG 38:91-179; Burns 2005
  // Can. Mineral. 43:1839.
  coffinite: grow_coffinite,
  uranophane: grow_uranophane,
  // v100 (2026-05-19): Pb-Cu supergene sulfate trio — linarite +
  // caledonite + leadhillite. Late-stage Pb-Cu oxidation cycle from
  // Tsumeb / Bisbee / Leadhills Scotland. Discriminator: pH +
  // CO3:SO4 ratio + Cu:Pb fraction. Per Williams 1990, Smith 1994,
  // Wilson & Dunn 1978.
  linarite: grow_linarite,
  caledonite: grow_caledonite,
  leadhillite: grow_leadhillite,
  // v101 (2026-05-19): The two Sulphur Bank-style minerals from the
  // boss's research gap analysis.
  //   metacinnabar β-HgS — black cubic polymorph of cinnabar (red
  //     trigonal α-HgS). Sphalerite-type F-43m. Sulphur Bank surface
  //     signature. Forms <200°C from acidic sulfide fluids; kinetically
  //     favored over cinnabar at low T per Potter & Barnes 1978.
  //   opal SiO2·nH2O — amorphous-to-short-range-ordered silica
  //     mineraloid. Hot-spring sinter host (Yellowstone, Sulphur Bank,
  //     Steamboat Springs). Three structural varieties opal-A/CT/C
  //     per Jones & Segnit 1971 + Langer & Flörke 1974; diagenesis-
  //     ladder flagged for future POLYMORPH_DIAGENESIS expansion.
  metacinnabar: grow_metacinnabar,
  opal: grow_opal,
  // v102 (2026-05-19): pyrolusite β-MnO2 — supergene Mn(IV) oxide, the
  // default Mn4+ phase when Ba/K/Pb low and Fe doesn't dominate. Two
  // modes: continental weathering (mode A, 95%) + low-T hydrothermal
  // vein (mode B, 5%). Discriminator gates encode the canonical Mn4+
  // fork (romanechite Ba > 100, cryptomelane K > 50, coronadite Pb > 30,
  // hausmannite T > 250, manganite at lower Eh) AND the Fe-Mn supergene
  // separation (Fe > 2*Mn → goethite captures the oxidation budget).
  // Per Potter & Rossman 1979 we do NOT ship a dendritic habit — most
  // textbook "dendritic pyrolusite" is actually cryptomelane.
  // First dogfood test of the vugg-add-mineral skill (~/.claude/skills/
  // vugg-add-mineral/SKILL.md).
  pyrolusite: grow_pyrolusite,
  // v108 (2026-05-20): plumbogummite PbAl3(PO4)2(OH)5·H2O —
  // trigonal alunite-supergroup Pb-Al-PO4 supergene endmember.
  // Type locality Roughten Gill, Caldbeck Fells (Hartley 1882
  // MinMag 5:21; Förtsch 1967 MinMag 36:530 type-material correction
  // to plumbogummite-hinsdalite-hidalgoite mix-crystal). The terminal
  // Pb-Al-PO4 phase of the supergene paragenesis; pseudomorphs
  // pyromorphite as the iconic cobalt-blue Roughten Gill cabinet
  // aesthetic. Completes the type-locality story for v107
  // roughten_gill scenario.
  plumbogummite: grow_plumbogummite,
  // v110 (2026-05-20): datolite CaB(SiO4)(OH) — Jeffrey Mine
  // rodingite arc opener. Calcium boronosilicate (sorosilicate
  // with B replacing Si in one tetrahedral site). Low-T alkaline
  // hydrothermal vug filling in TWO settings: Lake Superior basalt
  // amygdales (Bornhorst 2017; Butler & Burbank 1929) and rodingite
  // metasomatic contacts (Bernardini 1981 MR 12(5):277 for Jeffrey;
  // Coleman 1977 for the global rodingite framework). B field was
  // already in FluidChemistry from a pre-v89-era speculative add
  // for tourmaline — so no add-broth infra commit needed, just
  // the mineral. The Jeffrey arc plans v110-v116 (datolite,
  // vesuvianite/cyprine, grossular+diopside, pectolite+wollastonite+
  // prehnite, chrysotile+brucite+awaruite, scenario+ultramafic
  // wall type, calibration tune). Pre-existing B field discovery
  // collapsed the arc from 8 to 6 commits; documented in the new
  // vugg-add-broth skill's "pre-existing speculative fields" gotcha.
  datolite: grow_datolite,
  // v111 (2026-05-20): vesuvianite Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4
  // — tetragonal Ca-Mg-Al sorosilicate, also called idocrase. Three
  // settings: rodingite metasomatism (Jeffrey Mine — world's best
  // cyprine variety per Bernardini 1981 MR 12(5):277), contact-
  // metamorphic skarns (Vesuvius type locality 1795), carbonatite-
  // syenite alteration zones. CYPRINE = Cu-bearing sky-blue variety;
  // Cu²⁺-O charge transfer at 0.5-5 ppm gives sky-blue, > 5 ppm
  // deep azure (the Jeffrey best material). Structurally analogous
  // to v103 Y→fluorite + v62-era Cr→ruby trace-cation dispatch:
  // pure cation field exists (Cu, already there for many engines);
  // the dispatch logic reads it as a habit/color discriminator,
  // not a gate.
  vesuvianite: grow_vesuvianite,
  // v112 (2026-05-20): Paired Ca-Al-Mg calc-silicates for the
  // Jeffrey Mine rodingite arc. Both rodingite + skarn, both early-
  // stage in the prograde sequence. Paired commit per vugg-add-
  // mineral skill grouped-commit rule (shared family, shared gates,
  // shared paragenesis).
  //   grossular Ca3Al2(SiO4)3 — cubic Ca-Al garnet endmember; varieties
  //     by trace dispatch: chromian green (Cr trace, "tsavorite" sensu
  //     lato), hessonite (Mn + Fe combo per Manning 1967 Min.Mag.
  //     36:572), colorless/pale-yellow pure.
  //   diopside CaMgSi2O6 — monoclinic Ca-Mg clinopyroxene; chrome-
  //     diopside (Cr trace) is the gem-grade emerald-green variety,
  //     Jeffrey + kimberlite-xenolith origin per Bernardini 1981.
  // Refs: Anthony Handbook v.IA + v.IIB; Manning & Bird 1990 J.Petrol.
  // 31:1 (grossular); Cameron & Papike 1981 RIMG 7 (pyroxene); Manning
  // 1967 Min.Mag. 36:572 (hessonite color); Bernardini 1981 MR 12(5):277.
  grossular: grow_grossular,
  diopside: grow_diopside,
  // v113 (2026-05-20): Late-stage Ca-silicate trio for the Jeffrey
  // Mine rodingite arc + (collateral) Lake Superior amygdale +
  // skarn classics. Triple commit per shared family + chemistry
  // (Ca + Si + alkaline + low-T).
  //   pectolite NaCa2Si3O8(OH) — triclinic Na-Ca inosilicate;
  //     iconic radiating-spray habit; Cu trace gives Larimar tint
  //     (Filipos & Frantz 1979). Jeffrey spray-on-grossular is the
  //     cabinet signature per Bernardini 1981.
  //   wollastonite CaSiO3 — triclinic Ca-Si inosilicate; skarn
  //     workhorse (Crestmore CA, Willsboro NY, Helan Mountains CN);
  //     simplest stoichiometry of the suite.
  //   prehnite Ca2Al2Si3O10(OH)2 — orthorhombic Ca-Al phyllosilicate;
  //     Lake Superior + Alpine + Italian basalt-amygdale pale-green
  //     botryoidal classic; substrate for datolite + epidote +
  //     zeolites.
  // Refs: Anthony Handbook v.IIA + v.IIB; Deer Howie Zussman v.1B + 2A;
  // Liou 1971 Am.Min. 56:507 (prehnite stability); Trommsdorff &
  // Connolly 1996 Schweiz.Min.Petr.Mitt. 76:135 (wollastonite); Filipos
  // & Frantz 1979 (larimar/blue pectolite); Bernardini 1981 MR 12(5):277.
  pectolite: grow_pectolite,
  wollastonite: grow_wollastonite,
  prehnite: grow_prehnite,
  // v114 (2026-05-20): Mg-matrix family completing the Jeffrey Mine
  // rodingite assemblage. Three minerals in three different chemistry
  // classes:
  //   chrysotile Mg3Si2O5(OH)4 — fibrous serpentine asbestos (silicate
  //     class). Jeffrey Mine 1881-2011 produced ~40% of world chrysotile.
  //     Per Wicks & Plant 1979 Can.Min. 17:785 + O'Hanley 1996 Oxford.
  //   brucite Mg(OH)2 — Mg hydroxide (oxide class). Serpentinization
  //     byproduct; tabular hexagonal habit. Per Schramke et al. 1982
  //     GCA 46:1581.
  //   awaruite (Ni,Fe) — Ni-Fe alloy (native class). Microscopic grains
  //     in serpentine matrix; serpentinization-derived metal. Per Bird
  //     & Bassett 1980 GCA 44:1659; Frost 1985 Contrib.Min.Petr. 91:139.
  // Ni field for awaruite was already in FluidChemistry (pre-v89
  // speculative for millerite/annabergite/pentlandite); no add-broth
  // needed (the v110 lesson). Three engines, three classes — no
  // single-class grouped commit possible; ships as a 3-mineral triple
  // commit per shared family + paragenesis.
  chrysotile: grow_chrysotile,
  brucite: grow_brucite,
  awaruite: grow_awaruite,
  // v116 (2026-05-20): Commercial-asbestos quintet + tiger's eye.
  // Closes the asbestiform-family gap the Jeffrey arc was missing.
  // Per WHO 1986/2014: six commercial asbestos minerals — chrysotile
  // (serpentine, v114) + five amphiboles (this commit). Crocidolite +
  // tremolite are the most carcinogenic; amphibole-asbestos is more
  // dangerous than chrysotile per Frank et al. 2002. The mineral
  // engines encode the GEOLOGY; health context lives in minerals.json
  // descriptions. Five amphibole engines live in new amphibole-class
  // files (js/39a / 59a / 89a) per Hawthorne et al. 2012 supergroup
  // nomenclature.
  //
  // Tiger's eye = chalcedony pseudomorph AFTER crocidolite (supergene
  // oxidation of Fe2+ → Fe3+; the famous chatoyant gemstone). Lives
  // in silicate class since structurally chalcedony. Three habit
  // variants: chatoyant_pseudomorph (gold-brown classic), hawks_eye
  // (partial oxidation), tiger_iron (BIF-banded with hematite+jasper).
  tremolite: grow_tremolite,
  actinolite: grow_actinolite,
  anthophyllite: grow_anthophyllite,
  amosite: grow_amosite,
  crocidolite: grow_crocidolite,
  tigers_eye: grow_tigers_eye,
};
