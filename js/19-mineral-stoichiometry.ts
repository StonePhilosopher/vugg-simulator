// ============================================================
// js/19-mineral-stoichiometry.ts — per-mineral fluid stoichiometry
// ============================================================
// Maps each growth-engine mineral name to the moles of each fluid species
// represented by one formula unit. applyStoichiometricGrowthBudget converts
// those mole ratios to each species' mg/kg fluid field using its molar mass
// and STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM.
//
// This is deliberately a calibrated axial-growth budget proxy. It preserves
// mole ratios and exact closure of what it books, but does not scale demand by
// grain size, habit, density, or rendered shell volume and is therefore not a
// physical extensive mass-conservation calculation. See the canonical
// STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE in 18-constants.ts.
//
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1.
//
// HISTORICAL HEADER (kept for context): "Default flag OFF — these
// values do not affect any scenario until the calibration pass flips
// the flag."
//
// **THE FLAG IS ON AND HAS BEEN FOR A LONG TIME.** See
// js/18-constants.ts:39 — STOICHIOMETRIC_GROWTH_BUDGET_ENABLED = true. The historical
// header above is stale; do NOT trust it. Adding a new entry HERE
// immediately starts debiting fluid composition for that mineral's
// growth in every scenario where it fires. That's good (correct
// chemistry) but the cascade ripples may shift paragenesis in
// other scenarios. See HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md
// for the v120-v124 lesson on disciplined per-scenario tuning.
//
// Conventions:
// - Coefficients are per formula unit. Solid solutions use mid-range
//   end-member fractions (will refine in Phase 5 when crystals carry
//   continuous composition vectors).
// - Anion species use the simulator's fluid field names: 'CO3' is
//   total dissolved carbonate (Phase 3 will split into HCO3⁻/CO3²⁻ via
//   Bjerrum); 'S' is total dissolved sulfur (carries both sulfide and
//   sulfate equivalents in v17); 'P' is phosphate (P fluid field
//   represents PO₄³⁻ moiety); 'V' is vanadate (VO₄³⁻); 'As' is
//   arsenate or arsenide depending on redox.
// - O is NOT debited: fluid.O2 is a redox proxy in v17, not a mass
//   reservoir. Phase 4 (Eh) will reframe this; Phase 1 leaves it alone.
// - H is NOT debited: fluid.pH is an activity, not a mole reservoir.
//   Phase 4 (proton balance) handles H+ accounting separately.
// - Hydration waters (·nH₂O) are not tracked — water is the solvent.
// - Native elements have a single coefficient; sulfides carry their
//   metal + sulfur; oxyhydroxides debit their cation only (oxygen +
//   hydroxyl come from water, not the fluid solute pool).

const MINERAL_STOICHIOMETRY: Record<string, Record<string, number>> = {
  // ---- Carbonates ----
  calcite:        { Ca: 1, CO3: 1 },                 // CaCO3
  aragonite:      { Ca: 1, CO3: 1 },                 // CaCO3 (orthorhombic)
  dolomite:       { Ca: 1, Mg: 1, CO3: 2 },          // CaMg(CO3)2
  // Legacy/save fallback only. New HMC zones carry their measured-partition
  // Ca(1-x)Mg(x)CO3 formula in `zone.formula_stoichiometry`; the budget and
  // dissolution ledger use that exact per-zone map instead of this midpoint.
  HMC:            { Ca: 0.9, Mg: 0.1, CO3: 1 },
  siderite:       { Fe: 1, CO3: 1 },                 // FeCO3
  rhodochrosite:  { Mn: 1, CO3: 1 },                 // MnCO3
  smithsonite:    { Zn: 1, CO3: 1 },                 // ZnCO3
  cerussite:      { Pb: 1, CO3: 1 },                 // PbCO3
  // v120 backfill (2026-05-21, inactive-firing subset): Sr/Ba/Zn/Pb
  // carbonates registered in MINERAL_ENGINES but never firing in any
  // current baseline scenario. Adding stoichiometry is pure infra —
  // zero cascade risk — and ensures future scenarios that DO fire
  // these don't ship a silent free-energy gift. Per Option 1
  // disciplined-increment plan (boss-approved 2026-05-21).
  strontianite:   { Sr: 1, CO3: 1 },                 // SrCO3
  witherite:      { Ba: 1, CO3: 1 },                 // BaCO3
  hydrozincite:   { Zn: 5, CO3: 2 },                 // Zn5(CO3)2(OH)6 — late-stage Zn supergene; fluorescent
  leadhillite:    { Pb: 4, S: 1, CO3: 2 },           // Pb4SO4(CO3)2(OH)2 — multi-anion Pb supergene (Leadhills type)
  malachite:      { Cu: 2, CO3: 1 },                 // Cu2CO3(OH)2
  azurite:        { Cu: 3, CO3: 2 },                 // Cu3(CO3)2(OH)2
  aurichalcite:   { Zn: 3.5, Cu: 1.5, CO3: 2 },      // (Zn,Cu)5(CO3)2(OH)6 — solid solution mid-range
  rosasite:       { Cu: 1.3, Zn: 0.7, CO3: 1 },      // (Cu,Zn)2(CO3)(OH)2 — solid solution mid-range

  // ---- Sulfides ----
  pyrite:         { Fe: 1, S: 2 },                   // FeS2
  marcasite:      { Fe: 1, S: 2 },                   // FeS2 (orthorhombic)
  sphalerite:     { Zn: 1, S: 1 },                   // ZnS (Phase 5 will track Fe substitution)
  wurtzite:       { Zn: 1, S: 1 },                   // ZnS (hexagonal)
  galena:         { Pb: 1, S: 1 },                   // PbS
  chalcopyrite:   { Cu: 1, Fe: 1, S: 2 },            // CuFeS2
  molybdenite:    { Mo: 1, S: 2 },                   // MoS2
  bornite:        { Cu: 5, Fe: 1, S: 4 },            // Cu5FeS4
  chalcocite:     { Cu: 2, S: 1 },                   // Cu2S
  covellite:      { Cu: 1, S: 1 },                   // CuS
  arsenopyrite:   { Fe: 1, As: 1, S: 1 },            // FeAsS
  stibnite:       { Sb: 2, S: 3 },                   // Sb2S3
  cinnabar:       { Hg: 1, S: 1 },                   // HgS
  // v125 P3 Tsumeb supergene probe — start: metacinnabar fires
  // sulphur_bank only (3 crystals, max_um=24827.4 @ v124). Adding
  // stoichiometry tightens Hg accounting (cinnabar already debits Hg;
  // metacinnabar joins). Net: max_um shifts down as the Hg-15-ppm
  // budget is shared more honestly. No paragenesis pin breaks
  // expected — sulphur_bank's metacinnabar is gated by σ on Hg≥1,
  // T<200, O2<0.8, pH<6.5 only; growth budget affects depth, not the
  // nucleation gate. Sulphur Bank is sulphide-rich (S=400 + 6 H2S
  // recharges +150 each), so S debit is irrelevant.
  metacinnabar:   { Hg: 1, S: 1 },                   // β-HgS (cubic polymorph of cinnabar; Sulphur Bank Mine)
  realgar:        { As: 1, S: 1 },                   // AsS (α-realgar; As4S4 unit cell)
  orpiment:       { As: 2, S: 3 },                   // As2S3
  bismuthinite:   { Bi: 2, S: 3 },                   // Bi2S3
  acanthite:      { Ag: 2, S: 1 },                   // Ag2S (monoclinic)
  argentite:      { Ag: 2, S: 1 },                   // Ag2S (cubic)
  tetrahedrite:   { Cu: 9, Fe: 1.5, Zn: 1.5, Sb: 4, S: 13 }, // (Cu,Fe,Zn)12Sb4S13 — fahlore mid-range
  tennantite:     { Cu: 9, Fe: 1.5, Zn: 1.5, As: 4, S: 13 }, // (Cu,Fe,Zn)12As4S13 — fahlore mid-range
  nickeline:      { Ni: 1, As: 1 },                  // NiAs
  millerite:      { Ni: 1, S: 1 },                   // NiS
  cobaltite:      { Co: 1, As: 1, S: 1 },            // CoAsS
  // v120 backfill (inactive subset): di-arsenide quartet + Sb-sulfosalt
  // + Cu-arsenosulfide. All registered in MINERAL_ENGINES but never
  // firing in any current baseline scenario.
  loellingite:    { Fe: 1, As: 2 },                  // FeAs2
  rammelsbergite: { Ni: 1, As: 2 },                  // NiAs2 (Ni analog of loellingite)
  safflorite:     { Co: 1, As: 2 },                  // CoAs2 (Co analog of loellingite)
  skutterudite:   { Co: 1, As: 3 },                  // (Co,Ni,Fe)As3 — Co-end approximation
  pyrargyrite:    { Ag: 3, Sb: 1, S: 3 },            // Ag3SbS3 — "dark ruby silver" sister to proustite
  enargite:       { Cu: 3, As: 1, S: 4 },            // Cu3AsS4 — Cu-arsenosulfide
  // v67 — Brief-19 sulfide back-fill (telluride / selenide / Cd-suite)
  greenockite:    { Cd: 1, S: 1 },                   // CdS (hexagonal)
  hawleyite:      { Cd: 1, S: 1 },                   // CdS (cubic)
  // Tellurides: Te is a fluid-field anion in v62+ (mirrors S/As/Se).
  calaverite:     { Au: 1, Te: 2 },                  // AuTe2
  sylvanite:      { Au: 1, Ag: 1, Te: 4 },           // (Au,Ag)Te2 — mid-range Au:Ag = 1:1
  hessite:        { Ag: 2, Te: 1 },                  // Ag2Te
  // Selenides: Se is a fluid-field anion (added v62 for clausthalite).
  naumannite:     { Ag: 2, Se: 1 },                  // Ag2Se
  clausthalite:   { Pb: 1, Se: 1 },                  // PbSe

  // ---- Oxides ----
  quartz:         { SiO2: 1 },                       // SiO2
  chalcedony:     { SiO2: 1 },                       // cryptocrystalline fibrous SiO2 aggregate
  // v125 P3 Tsumeb-adjacent probe: opal — amorphous silica, same
  // stoichiometry as quartz. Fires in 6 scenarios; SiO2 broths in
  // each are thousands of ppm so the debit is sub-percent of budget.
  // Verified byte-identical across all 6 firing scenarios — the
  // cascade-perturbation mechanism is about magnitude relative to
  // σ-gate sensitivity, not just any non-zero debit.
  opal:           { SiO2: 1 },                       // SiO2·nH2O — amorphous silica mineraloid (Sulphur Bank-style hot-spring sinter)
  hematite:       { Fe: 2 },                         // Fe2O3 (O comes from water/redox)
  magnetite:      { Fe: 3 },                         // Fe3O4
  cuprite:        { Cu: 2 },                         // Cu2O
  corundum:       { Al: 2 },                         // Al2O3
  andalusite:     { Al: 2, SiO2: 1 },                // Al2SiO5 (the silica-saturated Al2SiO5 polymorph)
  ruby:           { Al: 2, Cr: 0.01 },               // Al2O3 + trace Cr (chromophore)
  sapphire:       { Al: 2, Fe: 0.01, Ti: 0.01 },     // Al2O3 + Fe/Ti
  uraninite:      { U: 1 },                          // UO2
  // v120 backfill (inactive subset): Cr-spinel + Ti + uranyl-silicate
  // oxide. Registered but never firing in any current baseline.
  chromite:       { Fe: 1, Cr: 2 },                  // FeCr2O4 (Cr-spinel)
  rutile:         { Ti: 1 },                         // TiO2
  coffinite:      { U: 1, SiO2: 1 },                 // U(SiO4)·nH2O — uranyl silicate (roll-front Colorado Plateau)

  // ---- Hydroxides / oxyhydroxides ----
  goethite:       { Fe: 1 },                         // FeO(OH)
  lepidocrocite:  { Fe: 1 },                         // γ-FeO(OH)

  // ---- Silicates ----
  feldspar:       { K: 1, Al: 1, SiO2: 3 },          // KAlSi3O8 (sanidine/orthoclase/microcline)
  albite:         { Na: 1, Al: 1, SiO2: 3 },         // NaAlSi3O8
  // chrysoprase: Ni-bearing chalcedony (SiO2 with nano-inclusions of
  // Ni-phyllosilicate). Growth budget debits SiO2 primarily; the Ni in
  // the colored nano-inclusions is a trace (Marlborough bulk Ni ~0.4-4
  // wt% NiO ≈ 0.05-0.5 Ni per SiO2 unit). Conservative 0.1 Ni captures
  // the trapping mechanism without over-debiting Ni at high growth rates.
  // Added 2026-05 — applyStoichiometricGrowthBudget warning surfaced during stale-mineral
  // retune. Without this entry, chrysoprase growth was a free-energy gift.
  chrysoprase:    { SiO2: 1, Ni: 0.1 },              // SiO2 + Ni nano-inclusion trap
  chrysocolla:    { Cu: 2, SiO2: 2 },                // (Cu,Al)2H2Si2O5(OH)4·nH2O
  apophyllite:    { K: 1, Ca: 4, SiO2: 8, F: 0.5 },  // KCa4Si8O20(F,OH)·8H2O
  topaz:          { Al: 2, SiO2: 1, F: 1.5 },        // Al2SiO4(F,OH)2
  tourmaline:     { Na: 1, Al: 6, Fe: 3, B: 3, SiO2: 6 }, // schorl end-member; will refine Phase 5
  beryl:          { Be: 3, Al: 2, SiO2: 6 },         // Be3Al2Si6O18
  emerald:        { Be: 3, Al: 2, SiO2: 6, Cr: 0.01 },
  aquamarine:     { Be: 3, Al: 2, SiO2: 6, Fe: 0.01 },
  morganite:      { Be: 3, Al: 2, SiO2: 6, Mn: 0.01 },
  heliodor:       { Be: 3, Al: 2, SiO2: 6, Fe: 0.01 },
  spodumene:      { Li: 1, Al: 1, SiO2: 2 },         // LiAlSi2O6
  // v120 backfill (inactive subset): silicate entries that don't fire
  // in any current baseline scenario. Registered in MINERAL_ENGINES
  // (engine code shipped) but no scenario clears their supersaturation
  // gates yet. Stoichiometry now in place so future scenarios that DO
  // fire them don't ship a silent free-energy gift.
  hemimorphite:   { Zn: 4, SiO2: 2 },                // Zn4Si2O7(OH)2·H2O — Tsumeb supergene
  shattuckite:    { Cu: 5, SiO2: 4 },                // Cu5(SiO3)4(OH)2 — Tsumeb deep blue Cu silicate
  // Amphibole asbestos quintet (v116). Solid solutions use mid-range
  // coefficients matching the v116 supersat gate defaults.
  amosite:        { Fe: 6, Mg: 1, SiO2: 8 },         // (Fe,Mg)7Si8O22(OH)2 Fe-cummingtonite-grunerite asbestos
  anthophyllite:  { Mg: 6, Fe: 1, SiO2: 8 },         // (Mg,Fe)7Si8O22(OH)2 ortho-amphibole (Mg-end)
  crocidolite:    { Na: 2, Fe: 5, SiO2: 8 },         // Na2Fe²⁺3Fe³⁺2Si8O22(OH)2 sodic Fe-amphibole (Witwatersrand)
  // v123 Jeffrey arc rodingite tune (2026-05-21): 11 silicate engines
  // that fire in jeffrey_mine and would silently free-energy-gift the
  // Mg/Ca/SiO2/Al/Fe/B/Ni cation budget. Adding them MUST be
  // accompanied by event-chemistry tunes in js/70r-jeffrey-mine.ts to
  // restore the canonical paragenesis (chrysotile + brucite + awaruite
  // + grossular + diopside + vesuvianite + wollastonite + prehnite +
  // datolite + tremolite + actinolite). All formulas per Bernardini
  // 1981 + Manning & Bird 1990 + Liou 1971. Hydroxyl + hydration H2O
  // not debited per file convention.
  chrysotile:     { Mg: 3, SiO2: 2 },                // Mg3Si2O5(OH)4 — asbestos serpentine (Wicks & Plant 1979)
  brucite:        { Mg: 1 },                         // Mg(OH)2 — serpentinization byproduct
  diopside:       { Ca: 1, Mg: 1, SiO2: 2 },         // CaMgSi2O6 — clinopyroxene rodingite endmember (Manning & Bird 1990)
  grossular:      { Ca: 3, Al: 2, SiO2: 3 },         // Ca3Al2(SiO4)3 — calcic garnet
  vesuvianite:    { Ca: 10, Mg: 1, Fe: 1, Al: 4, SiO2: 9 }, // Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4 — Bernardini 1981 cyprine host
  wollastonite:   { Ca: 1, SiO2: 1 },                // CaSiO3
  prehnite:       { Ca: 2, Al: 2, SiO2: 3 },         // Ca2Al2Si3O10(OH)2 — zeolite-facies sorosilicate (Liou 1971)
  epidote:        { Ca: 2, Al: 2, Fe: 1, SiO2: 3 },  // Ca2(Al,Fe3+)3(SiO4)(Si2O7)O(OH) — Fe3+ endmember (2 Al + 1 Fe at M-sites), alpine-cleft (v196)
  titanite:       { Ca: 1, Ti: 1, SiO2: 1 },          // CaTiSiO5 — Aar/Grimsel + Tormiq alpine-cleft Ti-nesosilicate (v205)
  stilbite:       { Na: 1, Ca: 4, Al: 9, SiO2: 27 },  // NaCa4Si27Al9O72·28H2O — Deccan Stage-II zeolite, cooler member (v200)
  heulandite:     { Ca: 1, Al: 2, SiO2: 7 },          // (Ca,Na)Al2Si7O18·6H2O — Deccan Stage-II zeolite, warmer dehydration product (v200)
  scolecite:      { Ca: 1, Al: 2, SiO2: 3 },          // CaAl2Si3O10·3H2O — fibrous natrolite-group, Ca endmember (v201)
  mesolite:       { Na: 2, Ca: 2, Al: 6, SiO2: 9 },   // Na2Ca2Al6Si9O30·8H2O — fibrous natrolite-group, ordered Na-Ca intermediate (v201)
  thomsonite:     { Na: 1, Ca: 2, Al: 5, SiO2: 5 },   // NaCa2Al5Si5O20·6H2O — earliest, most-aluminous amygdule zeolite, Si/Al~1 (v202)
  chabazite:      { Ca: 1, Al: 2, SiO2: 4 },          // Ca2Al2Si4O12·6H2O (per-Ca) — late intermediate-Si amygdule zeolite, Si/Al~2 (v203)
  datolite:       { Ca: 1, B: 1, SiO2: 1 },          // CaB(SiO4)(OH) — terminal-stage cabinet aesthetic
  tremolite:      { Ca: 2, Mg: 5, SiO2: 8 },         // Ca2Mg5Si8O22(OH)2 — Mg-end calcic amphibole
  actinolite:     { Ca: 2, Mg: 4, Fe: 1, SiO2: 8 }, // Ca2(Mg,Fe)5Si8O22(OH)2 — Mg:Fe mid-range 4:1

  // ---- Sulfates ----
  barite:         { Ba: 1, S: 1 },                   // BaSO4
  celestine:      { Sr: 1, S: 1 },                   // SrSO4
  selenite:       { Ca: 1, S: 1 },                   // CaSO4·2H2O (gypsum variety)
  anhydrite:      { Ca: 1, S: 1 },                   // CaSO4
  jarosite:       { K: 1, Fe: 3, S: 2 },             // KFe3(SO4)2(OH)6
  alunite:        { K: 1, Al: 3, S: 2 },             // KAl3(SO4)2(OH)6
  brochantite:    { Cu: 4, S: 1 },                   // Cu4(SO4)(OH)6
  antlerite:      { Cu: 3, S: 1 },                   // Cu3(SO4)(OH)4
  anglesite:      { Pb: 1, S: 1 },                   // PbSO4
  chalcanthite:   { Cu: 1, S: 1 },                   // CuSO4·5H2O
  mirabilite:     { Na: 2, S: 1 },                   // Na2SO4·10H2O
  thenardite:     { Na: 2, S: 1 },                   // Na2SO4

  // ---- Halides ----
  fluorite:       { Ca: 1, F: 2 },                   // CaF2
  halite:         { Na: 1, Cl: 1 },                  // NaCl
  sylvite:        { K: 1, Cl: 1 },                   // KCl — v67 brief-19 back-fill
  atacamite:      { Cu: 2, Cl: 1 },                  // Cu2Cl(OH)3 — OH from water, not solute

  // ---- Phosphates / arsenates / vanadates ----
  // v67 brief-19 back-fill: turquoise + apatite. (apatite spec-class
  // is phosphate; the v64 engine grows it in supergene_oxidation.)
  apatite:        { Ca: 5, P: 3 },                   // Ca5(PO4)3(OH,F,Cl) — fluorapatite OH-end-member; F/Cl trace, not debited
  turquoise:      { Cu: 1, Al: 6, P: 4 },            // CuAl6(PO4)4(OH)8·4H2O
  pyromorphite:   { Pb: 5, P: 3, Cl: 1 },            // Pb5(PO4)3Cl
  vanadinite:     { Pb: 5, V: 3, Cl: 1 },            // Pb5(VO4)3Cl
  mimetite:       { Pb: 5, As: 3, Cl: 1 },           // Pb5(AsO4)3Cl
  adamite:        { Zn: 2, As: 1 },                  // Zn2(AsO4)(OH)
  olivenite:      { Cu: 2, As: 1 },                  // Cu2(AsO4)(OH)
  erythrite:      { Co: 3, As: 2 },                  // Co3(AsO4)2·8H2O
  annabergite:    { Ni: 3, As: 2 },                  // Ni3(AsO4)2·8H2O
  // v120 backfill (inactive subset): supergene arsenate analogs +
  // sulfate hybrid. Registered in MINERAL_ENGINES but not firing in
  // any current baseline scenario.
  austinite:      { Ca: 1, Zn: 1, As: 1 },           // CaZn(AsO4)(OH) — Ca-Zn analog of conichalcite
  bayldonite:     { Cu: 3, Pb: 1, As: 2 },           // Cu3PbO(AsO3OH)2(OH)2 — Cu-Pb arsenate (Tsumeb)
  legrandite:     { Zn: 2, As: 1 },                  // Zn2(AsO4)(OH)·H2O — Mapimi yellow Zn arsenate
  linarite:       { Pb: 1, Cu: 1, S: 1 },            // PbCu(SO4)(OH)2 — Roughten Gill / Cumbria blue Pb-Cu sulfate
  // v124 Cumbria P2 tune — 1 of 4 shipped (pharmacolite only). The
  // Roughten Gill scenario hit Shape-B RNG-cascade displacement when
  // any of {caledonite, plumbogummite, proustite} stoichiometry was
  // added — brochantite + caledonite + plumbogummite all dropped from
  // paragenesis even with generous Pb releases (initial 70 + event
  // boosts to ~340 ppm total). The cascade-shift breaks test pins.
  // This is the same structural issue the file-level comment in
  // js/70q-roughten-gill.ts already documents for linarite. Three
  // P2 minerals stay DEFERRED (caledonite, plumbogummite, proustite);
  // they need either dedicated nucleation-cap tuning or class-
  // iterator-order changes, both out of scope for a single tune commit.
  // Pharmacolite fires only in schneeberg, doesn't affect roughten_gill.
  pharmacolite:   { Ca: 1, As: 1 },                  // CaHAsO4·2H2O — Schneeberg supergene Ca-arsenate
  scorodite:      { Fe: 1, As: 1 },                  // FeAsO4·2H2O
  descloizite:    { Pb: 1, Zn: 1, V: 1 },            // PbZn(VO4)(OH)
  mottramite:     { Pb: 1, Cu: 1, V: 1 },            // PbCu(VO4)(OH)
  torbernite:     { Cu: 1, U: 2, P: 2 },             // Cu(UO2)2(PO4)2·12H2O
  zeunerite:      { Cu: 1, U: 2, As: 2 },            // Cu(UO2)2(AsO4)2·12H2O
  carnotite:      { K: 2, U: 2, V: 2 },              // K2(UO2)2(VO4)2·3H2O
  autunite:       { Ca: 1, U: 2, P: 2 },             // Ca(UO2)2(PO4)2·11H2O
  uranospinite:   { Ca: 1, U: 2, As: 2 },            // Ca(UO2)2(AsO4)2·10H2O
  tyuyamunite:    { Ca: 1, U: 2, V: 2 },             // Ca(UO2)2(VO4)2·5H2O

  // ---- Borates ----
  borax:          { Na: 2, B: 4 },                   // Na2B4O7·10H2O
  tincalconite:   { Na: 2, B: 4 },                   // Na2B4O7·5H2O (paramorph stub — never grows)

  // ---- Native elements ----
  native_copper:    { Cu: 1 },
  native_gold:      { Au: 1 },
  native_silver:    { Ag: 1 },
  native_arsenic:   { As: 1 },
  native_sulfur:    { S: 1 },
  native_tellurium: { Te: 1 },
  native_bismuth:   { Bi: 1 },
  // v123 Jeffrey arc: Ni-Fe intermetallic alloy (rendered through
  // native dispatch). Range Ni2Fe to Ni3Fe per Krenn & Hauzenberger
  // 2007 awaruite thermometry; mid-range coefficients used.
  awaruite:         { Ni: 2.5, Fe: 1 },

  // ---- Molybdates / tungstates / vanadates ----
  wulfenite:      { Pb: 1, Mo: 1 },                  // PbMoO4
  ferrimolybdite: { Fe: 2, Mo: 3 },                  // Fe2(MoO4)3·8H2O
  raspite:        { Pb: 1, W: 1 },                   // PbWO4 (monoclinic)
  stolzite:       { Pb: 1, W: 1 },                   // PbWO4 (tetragonal)
  clinobisvanite: { Bi: 1, V: 1 },                   // BiVO4
  // v67 brief-19 back-fill: powellite + scheelite/wolframite hygiene.
  powellite:      { Ca: 1, Mo: 1 },                  // CaMoO4
  scheelite:      { Ca: 1, W: 1 },                   // CaWO4 — classed molybdate per existing convention
  wolframite:     { Fe: 0.5, Mn: 0.5, W: 1 },        // (Fe,Mn)WO4 — solid-solution mid-range

  // ---- v128d cascade-stuck stoichiometry add (2026-05-21) ----
  // The 5 minerals targeted by the proposal §4.1 calibration assertions.
  // Adding stoichiometry for these under fixed-order growth (v126 and
  // earlier) caused Shape-B RNG-cascade displacement — empirically
  // confirmed by the v125 + v126 probe arc. Under v128 graduated
  // competition (proposals/PROPOSAL-INITIATIVE-VARIABLE.md §3.1 rev 2),
  // per-cation rationing should let these fire as small shares of the
  // cation budget rather than displacing the existing paragenesis.
  //
  // The 5 calibration assertions (v128d test) check the qualitative
  // outcome: each mineral fires under graduated competition without
  // killing its scenario's prior paragenesis. Coefficients per the
  // formula (mid-range for solid-solution minerals).
  //
  // dioptase    CuSiO3·H2O    — Tsumeb Cu-silicate (P3)
  // koettigite  Zn3(AsO4)2·8H2O — Tsumeb Zn-arsenate, vivianite-group (P3)
  // lepidolite  K(Li,Al)3(Al,Si)4O10(F,OH)2 — LCT pegmatite Li mica (P5)
  // cassiterite SnO2          — pegmatite / greisen / hydrothermal Sn (P5)
  // uranophane  Ca(UO2)2(SiO3)2(OH)2·5H2O — Colorado Plateau / Schneeberg U-silicate (P4)
  dioptase:       { Cu: 1, SiO2: 1 },                // CuSiO3·H2O — emerald-green Cu silicate
  koettigite:     { Zn: 3, As: 2 },                  // Zn3(AsO4)2·8H2O — vivianite-group, Tsumeb supergene
  // lepidolite solid solution: (Li,Al)3(Al,Si)4 — Al appears in two
  // sites with variable occupancy. Mid-range: Li 1.5 + Al 1.5 in the
  // first site; Al 1 + Si 3 in the second site → total Al ≈ 2.5,
  // SiO2 ≈ 3, F ≈ 1.5 (F/OH 1.5/0.5 typical pegmatite). Per Černý &
  // Burt 1984 RIMG 13 + Foord et al. 1986 Min.Mag. 50:529.
  lepidolite:     { K: 1, Li: 1.5, Al: 2.5, SiO2: 3, F: 1.5 },  // K(Li,Al)3(Al,Si)4O10(F,OH)2
  cassiterite:    { Sn: 1 },                         // SnO2 — Cornwall / Erzgebirge / Bolivia tin
  uranophane:     { Ca: 1, U: 2, SiO2: 2 },          // Ca(UO2)2(SiO3)2(OH)2·5H2O — yellow uranyl silicate

  // ---- v128e final deferred-mineral sweep (2026-05-21) ----
  // The 8 remaining cascade-stuck minerals from DEFERRED_TUNE_REQUIRED
  // are shipped under the same v128 graduated-competition mechanism
  // that landed v128d's first batch (dioptase, koettigite, lepidolite,
  // cassiterite, uranophane). With per-cation rationing replacing
  // fixed-order growth, none of the v109-v126 Shape-B cascade events
  // should recur. v128e closes the cascade-probe arc — every engine
  // now has a stoichiometry entry; DEFERRED_TUNE_REQUIRED is empty.
  //
  // Class breakdown of the 8:
  //   - 3 sulfates with carbonate/Pb/Cu mix (caledonite + duftite + linarite-adjacent)
  //   - 1 phosphate (plumbogummite)
  //   - 1 sulfide (proustite, Ag-As)
  //   - 2 silicates (willemite, tigers_eye)
  //   - 1 oxide (pyrolusite)
  //
  // caledonite    Pb5Cu2(CO3)(SO4)3(OH)6 — Cumbria oxidation zone Pb-Cu sulfate-carbonate
  // plumbogummite PbAl3(PO4)2(OH)5·H2O   — Cumbria type-locality Pb-Al phosphate
  // proustite     Ag3AsS3                 — Ag-As sulfosalt (light ruby silver)
  // willemite     Zn2SiO4                 — Franklin / Tsumeb fluorescent Zn-silicate
  // conichalcite  CaCu(AsO4)(OH)          — Tsumeb Ca-Cu arsenate, paired with austinite
  // duftite       PbCu(AsO4)(OH)          — Tsumeb Pb-Cu arsenate
  // pyrolusite    MnO2                    — Mn supergene oxide
  // tigers_eye    SiO2                    — SiO2-rich quartz-crocidolite aggregate.
  //                                         Quartz growth itself debits SiO2 only;
  //                                         crocidolite retains its own booked Na-Fe-Si
  //                                         inventory in either origin model.
  caledonite:     { Pb: 5, Cu: 2, CO3: 1, S: 3 },     // Pb5Cu2(CO3)(SO4)3(OH)6
  plumbogummite:  { Pb: 1, Al: 3, P: 2 },             // PbAl3(PO4)2(OH)5·H2O
  proustite:      { Ag: 3, As: 1, S: 3 },             // Ag3AsS3 — light ruby silver
  willemite:      { Zn: 2, SiO2: 1 },                 // Zn2SiO4
  conichalcite:   { Ca: 1, Cu: 1, As: 1 },            // CaCu(AsO4)(OH)
  duftite:        { Pb: 1, Cu: 1, As: 1 },            // PbCu(AsO4)(OH)
  birnessite:     { Mn: 1 },                          // (Na,Ca,K)x(Mn4+,Mn3+)O2·nH2O — variable interlayer cations excluded from fixed framework debit
  romanechite:    { Ba: 1, Mn: 5 },                   // BaMn5O10·xH2O — Ba-bearing 2×3 tunnel oxide
  todorokite:     { Mg: 1, Mn: 6 },                   // (Mg,Na,Ca)(Mn,Mg)6O12·3–4H2O — Mg-templated 3×3 tunnel approximation
  pyrolusite:     { Mn: 1 },                          // MnO2 — crystalline Mn(IV) endmember
  tigers_eye:     { SiO2: 1 },                        // SiO2-rich chatoyant aggregate; origin model is explicit, not a settled pseudomorph

  // ---- v126 P1-holdout backfill (pectolite, no-fire pure-infra add) ----
  // pectolite is the one P1 Jeffrey-arc mineral that v123 deferred
  // because it doesn't reliably fire in any current baseline scenario
  // (sensitive to the late_ca_silicates Na/Ca window; σ-gates don't
  // clear under current event tunes). Probe-verified zero baseline
  // drift in all 30 scenarios — no firings means no cascade. Pure
  // infra add per the v120 inactive-subset pattern. If a future
  // scenario or jeffrey_mine tune flips the σ-gate so pectolite
  // fires, the stoichiometry is already in place — no silent free-
  // energy gift.
  pectolite:      { Na: 1, Ca: 2, SiO2: 3 },         // NaCa2Si3O8(OH) — calcic-sodic chain silicate (Jeffrey rodingite holdout)
};

// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1e (May 2026): per-mineral
// dissolution rates. Engines used to hand-code their dissolution
// credits inline as `fluid.X += dissolved_um * RATE` blocks across
// 12 engine files (~185 lines pre-migration). Phase 1e moves the
// rate-scaled credits into this table so the wrapper can credit
// fluid uniformly the way it debits during precipitation.
//
// Conventions:
//   - Each entry maps mineral → species → ppm-per-µm-dissolved rate.
//   - Rates here are NOT scaled by the precipitation formula-amount constant — they are the
//     exact per-µm coefficients the legacy inline credits used.
//     Calcite Ca=0.5 means "1 µm of calcite dissolution releases 0.5
//     ppm Ca²⁺ to the fluid in this ring."
//   - Rates differ per mineral because they reflect kinetic
//     stoichiometry (what fraction of each species actually
//     redissolves under the dominant dissolution mechanism), not
//     formula stoichiometry. Calcite's Ca:CO3 = 0.5:0.3 reflects
//     CO₂ outgassing during acid attack — some carbonate exits the
//     fluid as gas rather than aqueous bicarbonate.
//   - Trace elements (Mn, Fe in calcite zones) STAY inline —
//     they're zone-data-driven, not rate-scaled.
//
// Two entry shapes:
//   1. Single-mode rate-scaled (legacy):
//        fluorite: { Ca: 0.4, F: 0.6 }
//      Values are numbers. Wrapper applies `fluid[k] += dissolved_um * rate`.
//      Negative rates (consumption) are allowed; the wrapper clamps to ≥0.
//
//   2. Multi-mode dispatch (Phase 1e completion, v46):
//        pyrite: { __modes: {
//          oxidative: { rates: { Fe: 1.0, S: 0.5 } },         // rate-scaled
//          acid:      { constants: { Fe: 2.0, S: 1.5 } },     // added once, regardless of |thickness_um|
//        }}
//      Each mode is { rates: {...} } (rate-scaled by dissolved_um) OR
//      { constants: {...} } (literal credits, applied once). The 'constants'
//      flavor preserves byte-identicality where the engine emits a fixed
//      thickness like -1.2 — IEEE-754 doesn't generally let `1.2 * (k/1.2)`
//      round-trip back to `k`, so for those modes we keep the literal credits
//      rather than back-deriving a rate.
//
//      Engines emit `dissolutionMode: '<mode_name>'` as a GrowthZone field
//      so the wrapper can dispatch. If the field is missing, the wrapper
//      uses the first declared mode (so single-mode-with-constants entries
//      like wurtzite need no engine change).
type DissolutionRates = Record<string, number>;
type DissolutionMode = { rates: DissolutionRates } | { constants: DissolutionRates };
type DissolutionEntry = DissolutionRates | { __modes: Record<string, DissolutionMode> };

const MINERAL_DISSOLUTION_RATES: Record<string, DissolutionEntry> = {
  // ---- Halides (Phase 1e batch 1, v39) ----
  fluorite: { Ca: 0.4, F: 0.6 },          // acid dissolution: CaF₂ + 2H⁺ → Ca²⁺ + 2HF
  halite:   { Na: 0.4, Cl: 6.0 },         // meteoric flush — Cl is dominant in NaCl re-dissolution

  // ---- Borates (Phase 1e batch 1, v39) ----
  borax:    { Na: 0.4, B: 0.15 },         // generic borate re-dissolution

  // ---- Hydroxides (Phase 1e batch 1, v39) ----
  goethite:      { Fe: 0.5 },             // FeO(OH) + 3H⁺ → Fe³⁺ + 2H₂O
  lepidocrocite: { Fe: 0.4 },             // γ-FeO(OH) acid attack

  // ---- Molybdates (Phase 1e batch 2, v40) ----
  wulfenite:      { Pb: 0.5, Mo: 0.3 },   // acid dissolution releases Pb²⁺ + MoO₄²⁻
  ferrimolybdite: { Fe: 0.5, Mo: 0.4 },   // dehydration crumble — Fe³⁺ + MoO₄²⁻

  // ---- Oxides (Phase 1e batch 2, v40) ----
  hematite:  { Fe: 1.5 },                 // strong-acid pH<2 dissolution
  uraninite: { U: 0.6 },                  // oxidative dissolution → uranyl mobility
  magnetite: { Fe: 0.5 },                 // acid dissolution
  cuprite:   { Cu: 0.5 },                 // acid attack

  // ---- Native elements (Phase 1e batch 2, v40) ----
  // native_silver and native_gold have no inline dissolution credit
  // in the engines; they remain absent from the table.
  native_tellurium: { Te: 0.5 },          // oxidative dissolution
  native_sulfur:    { S: 0.6 },           // sublimation / re-dissolution
  native_arsenic:   { As: 0.5 },          // oxidative weathering
  native_bismuth:   { Bi: 0.5 },          // acid dissolution
  native_copper:    { Cu: 0.5 },          // oxidative weathering to soluble Cu²⁺

  // ---- Sulfates (Phase 1e batch 3, v41) ----
  // barite/celestine/chalcanthite have no inline dissolution credits
  // in engines — they simply persist when σ<1, no recycling pathway.
  anhydrite:    { Ca: 0.5, S: 0.4 },                   // acid dissolution
  brochantite:  { Cu: 0.5, S: 0.3 },                   // acid attack
  antlerite:    { Cu: 0.5, S: 0.4 },                   // acid attack
  jarosite:     { K: 0.3, Fe: 0.5, S: 0.4 },           // alkaline-driven dissolution
  alunite:      { K: 0.3, Al: 0.4, S: 0.4 },           // alkaline-driven dissolution
  mirabilite:   { Na: 0.4, S: 0.25 },                  // dehydration / re-dissolution
  thenardite:   { Na: 0.4, S: 0.25 },                  // re-dissolution under low concentration
  selenite:     { Ca: 0.4, S: 0.3 },                   // acid dissolution / phase boundary
  anglesite:    { Pb: 0.3, S: 0.3 },                   // two engine triggers (acid + reductive), same rates

  // ---- Arsenates (Phase 1e batch 4, v42 — single-mode subset) ----
  scorodite:  { Fe: 0.5, As: 0.5 },                    // acid dissolution
  adamite:    { Zn: 0.5, As: 0.3 },                    // acid attack
  mimetite:   { Pb: 0.8, As: 0.3, Cl: 0.1 },           // acid dissolution

  // ---- Arsenates (Phase 1e batch 11, v50 — erythrite + annabergite multi-mode) ----
  // Both have two dissolution modes, both using {constants} flavor:
  //   thermal: T>200°C dehydration, constants {Co/Ni:0.4, As:0.3} @ dT=-1.0µm
  //   acid:    pH<4.5,             constants {Co/Ni:0.6, As:0.4} @ dT=-1.2µm
  // The acid mode at thickness=-1.2 hits an IEEE-754 round-trip trap:
  // the rate-equivalent is As=0.4/1.2=0.333…, and 1.2*(0.4/1.2) ≠ 0.4
  // exactly. Storing the literal credits via {constants} preserves
  // byte-identicality with the engine's hand-coded credit. (The thermal
  // mode at thickness=-1.0 would multiply through cleanly as rates,
  // but we keep both modes in the same flavor for symmetry.)
  erythrite: { __modes: {
    thermal: { constants: { Co: 0.4, As: 0.3 } },      // T>200°C dehydration, dT=-1.0
    acid:    { constants: { Co: 0.6, As: 0.4 } },      // pH<4.5, dT=-1.2
  }},
  annabergite: { __modes: {
    thermal: { constants: { Ni: 0.4, As: 0.3 } },      // T>200°C dehydration, dT=-1.0
    acid:    { constants: { Ni: 0.6, As: 0.4 } },      // pH<4.5, dT=-1.2
  }},

  // ---- Phosphates / arsenates / vanadates (Phase 1e batch 4, v42) ----
  // descloizite + mottramite have no inline dissolution credit.
  torbernite:    { Cu: 0.2, U: 0.4, P: 0.3 },           // dehydration / pH
  zeunerite:     { Cu: 0.2, U: 0.4, As: 0.3 },
  carnotite:     { K: 0.2,  U: 0.4, V: 0.3 },
  autunite:      { Ca: 0.2, U: 0.4, P: 0.3 },
  uranospinite:  { Ca: 0.2, U: 0.4, As: 0.3 },
  tyuyamunite:   { Ca: 0.2, U: 0.4, V: 0.3 },
  clinobisvanite: { Bi: 0.4, V: 0.3 },
  pyromorphite:  { Pb: 0.3, P: 0.2, Cl: 0.3 },
  vanadinite:    { Pb: 0.3, V: 0.2, Cl: 0.3 },

  // ---- Silicates (Phase 1e batch 5, v43 — single-mode subset) ----
  quartz:       { SiO2: 0.8 },                         // OH⁻-assisted dissolution
  chalcedony:   { SiO2: 0.8 },                         // undersaturation / solution-mediated quartz maturation
  feldspar:     { K: 0.3, Al: 0.05, SiO2: 0.5 },       // most Al stays in kaolinite
  albite:       { Na: 0.3, Al: 0.05, SiO2: 0.3 },      // most Al stays in kaolinite
  topaz:        { Al: 0.3, SiO2: 0.2, F: 0.4 },        // HF-assisted etch
  apophyllite:  { K: 0.25, Ca: 1.0, SiO2: 4.0, F: 0.25 }, // constants/2.0µm: K += 0.5, Ca += 2.0, SiO2 += 8.0, F += 0.5
  // beryl-family — all five variants share _beryl_family_dissolution helper
  // (same rates regardless of chromophore), so identical per-mineral entries.
  beryl:        { Be: 0.2, Al: 0.2, SiO2: 0.4 },       // HF-assisted (pH<3, F>30)
  emerald:      { Be: 0.2, Al: 0.2, SiO2: 0.4 },
  aquamarine:   { Be: 0.2, Al: 0.2, SiO2: 0.4 },
  morganite:    { Be: 0.2, Al: 0.2, SiO2: 0.4 },
  heliodor:     { Be: 0.2, Al: 0.2, SiO2: 0.4 },

  // ---- Silicates (Phase 1e batch 12, v51 — chrysocolla multi-mode) ----
  // chrysocolla has two dissolution modes, both rate-scaled:
  //   acid:        pH<4.5, rates {Cu:0.4, SiO2:0.4}
  //   dehydration: T>120°C, rates {Cu:0.3, SiO2:0.3}
  // The two paths reflect different mechanisms — acid attack releases
  // free Cu²⁺ + silicic acid; thermal dehydration is a strict-low-T-phase
  // breakdown that releases less of each (the gel structure traps some).
  chrysocolla: { __modes: {
    acid:        { rates: { Cu: 0.4, SiO2: 0.4 } },    // sigma<1, pH<4.5
    dehydration: { rates: { Cu: 0.3, SiO2: 0.3 } },    // sigma<1, T>120°C
  }},

  // ---- Carbonates (Phase 1e batch 6, v44 — single-mode subset) ----
  // Calcite has rate-scaled credits for Ca/CO3 (single-mode, table-able)
  // PLUS trace-element credits for Mn/Fe computed from zone history
  // (zone-dependent, stays inline).
  calcite:      { Ca: 0.5, CO3: 0.3 },                 // major species only; trace Mn/Fe stay inline
  dolomite:     { Ca: 0.3, Mg: 0.3, CO3: 0.5 },        // acid dissolution
  HMC:          { Ca: 0.7, Mg: 0.15, CO3: 0.7 },       // v146 Week 11 — pH<6 acid dissolution; faster than calcite (Mg-substituted lattice less stable per Bischoff 1987)
  siderite:     { Fe: 0.5, CO3: 0.4 },                 // two engine triggers (oxidative + acid), same rates
  malachite:    { Cu: 0.8, CO3: 0.5 },                 // acid dissolution
  smithsonite:  { Zn: 0.6, CO3: 0.4 },                 // acid attack
  rosasite:     { Cu: 0.3, Zn: 0.2, CO3: 0.25 },       // pH < 5.5
  aurichalcite: { Zn: 0.4, Cu: 0.15, CO3: 0.3 },       // pH < 5.5
  cerussite:    { Pb: 0.5, CO3: 0.4 },                 // strong-acid pH < 4

  // ---- Carbonates (Phase 1e batch 9, v48 — aragonite multi-mode) ----
  // aragonite has two dissolution modes: polymorph (constants @
  // thickness=-2.0, T>100 + sigma<0.8 -> calcite paramorph) and acid
  // (rate-scaled, pH<5.5).
  aragonite: { __modes: {
    polymorph: { constants: { Ca: 2.0, CO3: 1.5 } },     // T>100, sigma<0.8 -> calcite, dT=-2.0
    acid:      { rates:     { Ca: 0.5, CO3: 0.3 } },     // pH<5.5
  }},

  // ---- Carbonates (Phase 1e batch 10, v49 — rhodochrosite + azurite multi-mode) ----
  // rhodochrosite has two dissolution modes, both rate-scaled but with
  // different per-µm coefficients: oxidative (Mn²⁺ -> MnO₂ surface
  // coating, releases less Mn) and acid (releases more Mn).
  rhodochrosite: { __modes: {
    oxidative: { rates: { Mn: 0.4, CO3: 0.4 } },         // sigma<1, O2>1.0
    acid:      { rates: { Mn: 0.5, CO3: 0.4 } },         // sigma<1, pH<5.5
  }},
  // azurite has two dissolution modes, both rate-scaled. The acid path
  // releases more CO3 (full carbonate dissolution); the low-CO3 path
  // is the diagnostic azurite -> malachite pseudomorph (less CO3 lost
  // to gas because the conversion is more efficient).
  azurite: { __modes: {
    acid:    { rates: { Cu: 0.5, CO3: 0.4 } },           // sigma<1, pH<5.0
    low_co3: { rates: { Cu: 0.5, CO3: 0.3 } },           // sigma<1, CO3<80 (-> malachite)
  }},

  // ---- Sulfides (Phase 1e batch 7, v45 — single-mode subset) ----
  // galena + argentite have no inline dissolution credit at all. Sphalerite's
  // oxidative path is table-mediated so its recorded trace Ge can return.
  // For acanthite + cobaltite, the table handles only the positive cation
  // credits (Ag / Co + As); the inline negative S consumption stays for now
  // pending negative-rate design extension.
  // Arsenopyrite's Fe/As/S and actual accepted invisible-Au uptake all return
  // through the exact shell inventory. Only its non-mass pH adjustment remains
  // inline in the engine.

  // ---- Sulfides (Phase 1e batch 8, v47 — multi-mode pyrite + marcasite) ----
  // pyrite has two dissolution modes: oxidative (rate-scaled, low-σ +
  // O₂>1.0) and acid (constants @ thickness=-2.0, low-σ + pH<3.0).
  // marcasite has three: inversion (constants @ thickness=-1.5,
  // pH≥5 OR T>240 -> pyrite paramorph), oxidative (rate-scaled), acid
  // (constants @ thickness=-2.0). Constants modes use the {constants}
  // flavor to preserve byte-identicality (the legacy engines added the
  // raw constants directly, so storing them as "rate × thickness" risks
  // IEEE-754 drift in marcasite inversion's 1.5×0.8 = 1.2 corner).
  pyrite: { __modes: {
    oxidative: { rates:     { Fe: 1.0, S: 0.5 } },
    acid:      { constants: { Fe: 2.0, S: 1.5 } },
  }},
  marcasite: { __modes: {
    inversion: { constants: { Fe: 1.5, S: 1.2 } },  // pH>=5 or T>240, -> pyrite
    oxidative: { rates:     { Fe: 1.0, S: 0.5 } },
    acid:      { constants: { Fe: 2.0, S: 1.5 } },
  }},
  // wurtzite has a single dissolution mode — polymorphic inversion to
  // sphalerite when T drops below 95°C. Constants @ thickness=-1.5.
  // Wrapped in __modes for uniformity with pyrite/marcasite even
  // though there's only one mode (the wrapper defaults to first when
  // dissolutionMode is undefined, so the engine doesn't strictly need
  // to tag the zone — but it does for readability).
  wurtzite: { __modes: {
    inversion: { constants: { Zn: 1.5, S: 1.2 } },  // T<=95°C -> sphalerite, dT=-1.5
  }},
  sphalerite: { __modes: {
    // Exact inverse of booked precipitation: ZnS debits 1:1 at the
    // historical axial-growth calibration per accepted micrometre.
    oxidative: { rates: { Zn: 0.02, S: 0.02 } },
  }},
  chalcopyrite: { Cu: 0.8, Fe: 0.5, S: 0.3 },          // acid attack
  molybdenite:  { Mo: 0.8, S: 0.2 },                   // oxidative — MoO₄²⁻ released
  nickeline:    { Ni: 0.4, As: 0.4 },                  // oxidative weathering
  millerite:    { Ni: 0.4, S: 0.3 },                   // acid attack
  stibnite:     { Sb: 0.3, S: 0.3 },                   // oxidative
  cinnabar:     { Hg: 0.3, S: 0.2 },                   // oxidative sublimation (Hg° vapor + SO₄²⁻)
  realgar:      { As: 0.3, S: 0.3 },                   // alkaline dissolution (thioarsenite complex)
  orpiment:     { As: 0.4, S: 0.4 },                   // alkaline dissolution (AsS₃³⁻ complex)
  bismuthinite: { Bi: 0.3, S: 0.3 },                   // oxidative
  bornite:      { Cu: 0.4, Fe: 0.2, S: 0.3 },          // supergene oxidation
  chalcocite:   { Cu: 0.5, S: 0.3 },                   // strong oxidation
  covellite:    { Cu: 0.4, S: 0.4 },                   // strong oxidation
  tetrahedrite: { Cu: 0.6, Sb: 0.3, S: 0.4 },          // acid + oxidative
  tennantite:   { Cu: 0.6, As: 0.3, S: 0.4 },          // acid + oxidative
  arsenopyrite: { Fe: 0.5, As: 0.4, S: 0.4 },          // legacy rates; exact shell ledger is authoritative
  // Phase 1e batch 14, v53: extended with S consumption (negative rate).
  // The wrapper applies Math.max(0, fluid + delta) when rate<0, matching
  // the legacy inline `fluid.S = Math.max(fluid.S - dissolved_um*0.1, 0)`
  // pattern. Now fully table-mediated — no inline credits remain.
  acanthite:    { Ag: 0.4, S: -0.1 },                  // oxidative; S consumed
  cobaltite:    { Co: 0.4, As: 0.4, S: -0.1 },         // oxidative; S consumed
  // native_silver tarnish — both species are CONSUMED (negative rates).
  // Engine had: fluid.Ag = Math.max(fluid.Ag - dissolved_um*0.3, 0);
  //             fluid.S  = Math.max(fluid.S  - dissolved_um*0.4, 0);
  native_silver: { Ag: -0.3, S: -0.4 },                // tarnish/skin to acanthite
};

// Apply the calibrated stoichiometric axial-growth budget for one finalized
// growth or dissolution zone. Called only after time scaling, burial/fill
// damping, and volume clamps are frozen. Positive thickness books/debits fluid
// via mole-ratio stoichiometry × species molar mass. Negative thickness returns
// the exact previously booked shell inventory. This closes the proxy ledger;
// it does not assert physical solid mass or volume conservation.
//
// Two layers of safety while the flag is OFF:
//   1. The early `if (!STOICHIOMETRIC_GROWTH_BUDGET_ENABLED) return;` short-circuit.
//   2. Even when flipped on, missing-mineral entries log a warning
//      once and skip — so a new mineral added before its
//      stoichiometry is filed never crashes a run.
const _growthBudgetMissingWarned: Record<string, boolean> = {};

// q [mmol formula/kg/µm] × ν [mol species/mol formula] × M [g/mol]
// equals mg species/kg/µm, numerically the ppm debit per accepted µm.
// Keep this as the one conversion primitive used by precipitation,
// legacy-shell reconstruction, graduated competition, and UI capacity.
function stoichiometricBudgetDebitPpmPerUm(species: string, coefficient: number): number {
  const props = (typeof SPECIES_PROPERTIES !== 'undefined')
    ? SPECIES_PROPERTIES[species]
    : null;
  const molarMass = Number(props?.molarMass);
  const nu = Number(coefficient);
  if (!(nu > 0) || !(molarMass > 0) || !Number.isFinite(molarMass)) return 0;
  return STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM * nu * molarMass;
}

// Speleothem-aragonite Sr partitioning. Wassenburg et al. (2016, GCA 190,
// 347-367, doi:10.1016/j.gca.2016.06.036) derived D_Sr(Ar)=1.38 +/-0.53,
// where D=(Sr/Ca)_solid/(Sr/Ca)_solution on a molar basis. Keep the measured
// distribution coefficient separate from the scenario's dissolved inventory:
// the latter must be real dripwater Sr, not solid-speleo ppm copied into water.
const ARAGONITE_SR_PARTITION_MODEL = Object.freeze({
  id: 'Wassenburg2016-speleothem-aragonite-DSr',
  distributionCoefficient: 1.38,
  oneSigma: 0.53,
  // Match the simulator's canonical SPECIES_PROPERTIES values exactly so a
  // booked Ca/Sr mole ratio closes bit-for-bit in the proxy ledger.
  caMolarMass: 40.08,
  srMolarMass: 87.62,
  aragoniteFormulaMass: 100.0869,
});

function aragoniteSrPartitioning(fluid: any) {
  const caPpm = Math.max(0, Number(fluid?.Ca) || 0);
  const srPpm = Math.max(0, Number(fluid?.Sr) || 0);
  const solutionMolarRatio = caPpm > 0
    ? (srPpm / ARAGONITE_SR_PARTITION_MODEL.srMolarMass)
      / (caPpm / ARAGONITE_SR_PARTITION_MODEL.caMolarMass)
    : 0;
  const formulaCoefficient = ARAGONITE_SR_PARTITION_MODEL.distributionCoefficient
    * solutionMolarRatio;
  const targetSolidSrPpm = formulaCoefficient
    * ARAGONITE_SR_PARTITION_MODEL.srMolarMass
    / ARAGONITE_SR_PARTITION_MODEL.aragoniteFormulaMass
    * 1e6;
  return {
    model: ARAGONITE_SR_PARTITION_MODEL.id,
    distributionCoefficient: ARAGONITE_SR_PARTITION_MODEL.distributionCoefficient,
    oneSigma: ARAGONITE_SR_PARTITION_MODEL.oneSigma,
    solutionCaPpm: caPpm,
    solutionSrPpm: srPpm,
    solutionMolarSrCa: solutionMolarRatio,
    formulaCoefficientSr: formulaCoefficient,
    targetSolidSrPpm,
  };
}

function finalizeAragoniteSrPartitionReceipt(crystal: any, zone: any) {
  if (crystal?.mineral !== 'aragonite' || !zone?.sr_partition) return;
  const requested = zone.sr_partition;
  const actualSrPerUm = Math.max(0, Number(zone._budget_inventory_per_um?.Sr) || 0);
  const actualCaPerUm = Math.max(0, Number(zone._budget_inventory_per_um?.Ca) || 0);
  const solidMolarSrCa = actualCaPerUm > 0
    ? (actualSrPerUm / ARAGONITE_SR_PARTITION_MODEL.srMolarMass)
      / (actualCaPerUm / ARAGONITE_SR_PARTITION_MODEL.caMolarMass)
    : 0;
  const effectiveD = requested.solutionMolarSrCa > 0
    ? solidMolarSrCa / requested.solutionMolarSrCa
    : 0;
  const formulaMassPerUm = STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM
    * ARAGONITE_SR_PARTITION_MODEL.aragoniteFormulaMass;
  zone.trace_Sr = formulaMassPerUm > 0
    ? actualSrPerUm / formulaMassPerUm * 1e6
    : 0;
  zone.sr_partition = {
    ...requested,
    acceptedSrPpmPerUm: actualSrPerUm,
    acceptedCaPpmPerUm: actualCaPerUm,
    acceptedSolidMolarSrCa: solidMolarSrCa,
    effectiveDistributionCoefficient: effectiveD,
    inventoryLimited: actualSrPerUm + 1e-15
      < stoichiometricBudgetDebitPpmPerUm('Sr', requested.formulaCoefficientSr),
  };
}

// Explicit sulfur fluids book each mineral family against a chemically
// distinct reservoir. Legacy fluids continue to use `S`, preserving their
// historical calibration until their scenario chemistry is explicitly
// migrated.
const SULFATE_STOICHIOMETRY_MINERALS = new Set([
  'leadhillite', 'barite', 'celestine', 'selenite', 'anhydrite', 'jarosite',
  'alunite', 'brochantite', 'antlerite', 'anglesite', 'chalcanthite',
  'mirabilite', 'thenardite', 'linarite', 'caledonite',
]);

function stoichiometricReservoirSpecies(mineral: string, species: string, fluid: any): string {
  if (species !== 'S' || !fluid?.sulfurPoolsExplicit) return species;
  if (mineral === 'native_sulfur') return 'S_elemental';
  if (SULFATE_STOICHIOMETRY_MINERALS.has(mineral)) return 'S_sulfate';
  return 'S_sulfide';
}

function _recordAcceptedCarbonateTransferReceipt(
  conditions: any,
  crystal: any,
  zone: any,
  beforePpm: number,
): void {
  if (!conditions?._carbonateBoundaryState || !Number.isFinite(beforePpm)) return;
  const afterPpm = Number(conditions.fluid?.CO3);
  if (!Number.isFinite(afterPpm) || afterPpm === beforePpm) return;
  (conditions._pending_carbonate_boundary_transfers ||= []).push({
    schema: 'accepted-carbonate-transfer-v1',
    step: Number(conditions._sim_step) || null,
    crystalId: crystal?.crystal_id ?? null,
    mineral: String(crystal?.mineral || 'unknown'),
    acceptedThicknessUm: Number(zone?.thickness_um) || 0,
    localAqueousCarbonDeltaPpm: afterPpm - beforePpm,
    touchedBulkFluidHandle: conditions.fluid === conditions._carbonateBoundaryBulkFluid,
  });
}

function _formulaStoichiometryForZone(crystal: any, zone: any): Record<string, number> | null {
  const zoned = zone?.formula_stoichiometry;
  if (zoned && typeof zoned === 'object' && Object.keys(zoned).length) return zoned;
  return MINERAL_STOICHIOMETRY[crystal?.mineral] || null;
}

// HMC is a solid solution, so a crystal-wide single x is meaningful only as
// the remaining-shell thickness-weighted mean.  The thermodynamic decision
// and mass balance remain on each individual zone; this aggregate is for
// morphology, display, and legacy consumers that still read `_mg_content`.
function _refreshRemainingSolidSolutionComposition(crystal: any, pendingZone: any = null): void {
  if (crystal?.mineral !== 'HMC') return;
  let weightedMg = 0;
  let totalThickness = 0;
  const include = (z: any, remaining: number) => {
    if (!(remaining > 0)) return;
    const formula = _formulaStoichiometryForZone(crystal, z) || {};
    const formulaCa = Math.max(0, Number(formula.Ca) || 0);
    const formulaMg = Math.max(0, Number(formula.Mg) || 0);
    const formulaX = formulaCa + formulaMg > 0 ? formulaMg / (formulaCa + formulaMg) : NaN;
    const recordedX = Number(z?.solid_solution?.mgMoleFraction);
    const x = Number.isFinite(recordedX) ? recordedX : formulaX;
    if (!Number.isFinite(x)) return;
    weightedMg += remaining * Math.max(0, Math.min(0.30, x));
    totalThickness += remaining;
  };
  for (const z of (crystal.zones || [])) {
    if (!(Number(z?.thickness_um) > 0)) continue;
    const remaining = Number.isFinite(Number(z._remaining_solid_um))
      ? Math.max(0, Number(z._remaining_solid_um))
      : Math.max(0, Number(z.thickness_um) || 0);
    include(z, remaining);
  }
  if (pendingZone && Number(pendingZone.thickness_um) > 0) {
    include(pendingZone, Number(pendingZone.thickness_um));
  }
  if (totalThickness > 0) {
    crystal._mg_content = weightedMg / totalThickness;
    crystal._solid_solution_model = 'calcite_disordered_dolomite_subregular_v1';
    crystal._solid_solution_bulk = {
      schema: 'remaining-shell-thickness-weighted-v1',
      mgMoleFraction: crystal._mg_content,
      remainingThicknessUm: totalThickness,
    };
  } else {
    crystal._mg_content = null;
    crystal._solid_solution_bulk = {
      schema: 'remaining-shell-thickness-weighted-v1',
      mgMoleFraction: null,
      remainingThicknessUm: 0,
      status: 'no_remaining_solid',
    };
  }
}

// Pure preview of the exact inventory that a negative zone would return.
// Physical dissolution uses this during coupled reaction-path integration:
// each trial retreat changes the local fluid, which changes saturation and
// therefore the next rate. Keep this reconstruction byte-for-byte aligned
// with the accepted negative-zone path below, but never mutate historic zone
// `_remaining_solid_um` fields or the fluid during a preview.
function previewBookedDissolutionReturn(
  crystal: any,
  dissolvedUm: number,
  fluid: any,
): Record<string, number> {
  const requested = Math.max(0, Number(dissolvedUm) || 0);
  if (!(requested > 0) || !crystal) return {};
  const shells: Array<{ zone: any, remainingUm: number }> = [];
  for (const historic of (crystal.zones || [])) {
    const thickness = Number(historic?.thickness_um) || 0;
    if (thickness > 0) {
      shells.push({ zone: historic, remainingUm: thickness });
      continue;
    }
    let historicRemoval = -thickness;
    for (let si = shells.length - 1; si >= 0 && historicRemoval > 0; si--) {
      const removed = Math.min(shells[si].remainingUm, historicRemoval);
      shells[si].remainingUm -= removed;
      historicRemoval -= removed;
    }
  }

  const returned: Record<string, number> = {};
  let remainingToRemove = requested;
  for (let si = shells.length - 1; si >= 0 && remainingToRemove > 0; si--) {
    const shell = shells[si];
    const removedHere = Math.min(shell.remainingUm, remainingToRemove);
    shell.remainingUm -= removedHere;
    remainingToRemove -= removedHere;
    let inventory = shell.zone._budget_inventory_per_um;
    if (!inventory || typeof inventory !== 'object') {
      inventory = {};
      const formula = _formulaStoichiometryForZone(crystal, shell.zone) || {};
      for (const species in formula) {
        const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
        inventory[reservoir] = (inventory[reservoir] || 0)
          + stoichiometricBudgetDebitPpmPerUm(species, formula[species]);
      }
      for (const species in (shell.zone.trace_stoichiometry || {})) {
        inventory[species] = (inventory[species] || 0)
          + stoichiometricBudgetDebitPpmPerUm(
            species,
            shell.zone.trace_stoichiometry[species],
          );
      }
    }
    for (const species in inventory) {
      const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
      returned[reservoir] = (returned[reservoir] || 0)
        + removedHere * (Number(inventory[species]) || 0);
    }
  }
  return returned;
}

// Returns the list of species names that just transitioned from positive
// to zero (depletion events), or null on no-op / missing stoichiometry.
// _runEngineForCrystal uses this to emit "Fe²⁺ depleted in ring 4 —
// pyrite nucleation halted" log lines so players can see when the fluid
// runs out, instead of crystals silently stopping growth.
function applyStoichiometricGrowthBudget(crystal: any, zone: any, conditions: any): string[] | null {
  if (!STOICHIOMETRIC_GROWTH_BUDGET_ENABLED) return null;
  if (!zone || !zone.thickness_um) return null;
  // Dissolution returns the inventory that precipitation actually removed
  // from the fluid, shell by shell. The historical
  // MINERAL_DISSOLUTION_RATES table used unrelated empirical credit numbers;
  // it could return five or fifty times more material than the solid ever
  // contained and could not distinguish grow A → etch → grow B. Keep that
    // table as legacy reaction documentation, but never use it as an inventory source.
  const carbonateBeforePpm = Number(conditions.fluid?.CO3);
  if (zone.thickness_um < 0) {
    const dissolved_um = -zone.thickness_um;
    const fluid = conditions.fluid;
    // Rebuild remaining positive-shell inventory in chronological order. This
    // is migration-safe for legacy saves and correctly handles
    // grow A → dissolve → regrow B → dissolve without charging A's earlier loss
    // against the newer B shell.
    const priorZones = crystal.zones || [];
    const shells: any[] = [];
    for (const historic of priorZones) {
      if (!historic || !historic.thickness_um) continue;
      if (historic.thickness_um > 0) {
        historic._remaining_solid_um = historic.thickness_um;
        shells.push(historic);
        continue;
      }
      let historicRemoval = -historic.thickness_um;
      for (let si = shells.length - 1; si >= 0 && historicRemoval > 0; si--) {
        const available = Math.max(0, Number(shells[si]._remaining_solid_um) || 0);
        const removed = Math.min(available, historicRemoval);
        shells[si]._remaining_solid_um = available - removed;
        historicRemoval -= removed;
      }
    }
    let remainingToRemove = dissolved_um;
    const returned: Record<string, number> = {};
    for (let zi = shells.length - 1; zi >= 0 && remainingToRemove > 0; zi--) {
      const z = shells[zi];
      const available = Math.max(0, Number(z._remaining_solid_um) || 0);
      const removedHere = Math.min(available, remainingToRemove);
      z._remaining_solid_um = available - removedHere;
      remainingToRemove -= removedHere;
      // New zones carry their measured fluid debit. For legacy saves, rebuild
      // the best available inventory from the mineral formula + trace record.
      let inventory = z._budget_inventory_per_um;
      if (!inventory || typeof inventory !== 'object') {
        inventory = {};
        const formula = _formulaStoichiometryForZone(crystal, z) || {};
        for (const species in formula) {
          const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
          inventory[reservoir] = (inventory[reservoir] || 0)
            + stoichiometricBudgetDebitPpmPerUm(species, formula[species]);
        }
        for (const species in (z.trace_stoichiometry || {})) {
          inventory[species] = (inventory[species] || 0)
            + stoichiometricBudgetDebitPpmPerUm(species, z.trace_stoichiometry[species]);
        }
      }
      for (const species in inventory) {
        const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
        returned[reservoir] = (returned[reservoir] || 0)
          + removedHere * inventory[species];
      }
    }
    // Native sulfur oxidation is a transfer, not a generic S0 return:
    //   S0 + 1.5 O2 + H2O -> SO4(2-) + 2 H+
    // An explicitly open air-water interface imports exactly the oxygen it
    // consumes. A closed fluid oxidizes only the fraction its existing O2 can
    // support and returns the oxygen-limited remainder to S_elemental.
    let handledNativeSulfurOxidation = false;
    if (crystal.mineral === 'native_sulfur'
        && zone.dissolutionMode === 'oxidative_to_sulfate'
        && fluid.sulfurPoolsExplicit) {
      const returnedElemental = Math.max(0, Number(returned.S_elemental) || 0);
      const oxygenPerSulfurMass = 1.5 * 32.00 / 32.07;
      const oxygenBefore = Math.max(0, Number(fluid.O2) || 0);
      const openBoundary = fluid.nativeSulfurPathway === 'oxidative_interface'
        || !!conditions?._scenario?.open_to_atmosphere
        || !!conditions?.wall?.open_system;
      const oxygenNeeded = returnedElemental * oxygenPerSulfurMass;
      const oxygenImported = openBoundary ? oxygenNeeded : 0;
      const sulfurOxidized = Math.min(
        returnedElemental,
        (oxygenBefore + oxygenImported) / oxygenPerSulfurMass,
      );
      const oxygenConsumed = sulfurOxidized * oxygenPerSulfurMass;
      const elementalRemainder = returnedElemental - sulfurOxidized;
      fluid.O2 = Math.max(0, oxygenBefore + oxygenImported - oxygenConsumed);
      fluid.S_sulfate += sulfurOxidized;
      fluid.S_elemental += elementalRemainder;
      if (typeof ehFromO2 === 'function') fluid.Eh = ehFromO2(fluid.O2);
      const reaction = {
        pathway: 'native_sulfur_oxidative_dissolution',
        sulfurReturnedPpm: returnedElemental,
        sulfurOxidizedToSulfatePpm: sulfurOxidized,
        sulfurElementalRemainderPpm: elementalRemainder,
        oxygenBeforePpm: oxygenBefore,
        oxygenImportedPpm: oxygenImported,
        oxygenConsumedPpm: oxygenConsumed,
        oxygenAfterPpm: fluid.O2,
        // pH is an activity proxy and the simulator has no conserved H/DIC
        // acidity inventory. Report the reaction extent honestly as a
        // diagnostic rather than pretending those protons were booked.
        diagnosticProtonsProducedMmolKg: 2 * sulfurOxidized / 32.07,
        protonAccounting: 'diagnostic_only_no_conserved_hydrogen_inventory',
        fluidPhUpdated: false,
        openBoundary,
      };
      (fluid._sulfur_oxidation_ledger ||= []).push(reaction);
      zone._sulfur_oxidation = reaction;
      returned.S_sulfate = sulfurOxidized;
      returned.S_elemental = elementalRemainder;
      handledNativeSulfurOxidation = true;
    }
    for (const species in returned) {
      if (handledNativeSulfurOxidation
          && (species === 'S_sulfate' || species === 'S_elemental')) continue;
      if (typeof fluid[species] !== 'number') continue;
      if (species === 'SiO2' && typeof fluid.addReactiveSilica === 'function') {
        fluid.addReactiveSilica(returned[species]);
      } else {
        fluid[species] += returned[species];
      }
    }
    if (fluid.sulfurPoolsExplicit) syncExplicitSulfurTotal(fluid);
    zone._returned_budget_inventory = returned;
    _refreshRemainingSolidSolutionComposition(crystal);
    _recordAcceptedCarbonateTransferReceipt(conditions, crystal, zone, carbonateBeforePpm);
    return null;  // depletion narration is precipitation-only
  }
  const stoich = _formulaStoichiometryForZone(crystal, zone);
  if (!stoich) {
    if (!_growthBudgetMissingWarned[crystal.mineral]) {
      _growthBudgetMissingWarned[crystal.mineral] = true;
      console.warn(
        `[growth-budget] no stoichiometry for ${crystal.mineral} — ` +
        `growth will not debit fluid composition. Add to ` +
        `MINERAL_STOICHIOMETRY in 19-mineral-stoichiometry.ts.`
      );
    }
    return null;
  }
  // thickness_um is positive (precipitation). Major formula species are
  // mandatory: if any reservoir cannot supply the requested formula amount,
  // shrink the entire zone before booking anything so the solid remains
  // stoichiometric instead of independently clamping its components.
  const fluid = conditions.fluid;
  const requestedThickness = zone.thickness_um;
  let acceptedThickness = requestedThickness;
  let limitingSpecies: string | null = null;
  for (const species in stoich) {
    const demandPerUm = stoichiometricBudgetDebitPpmPerUm(species, stoich[species]);
    if (!(demandPerUm > 0)) continue;
    const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
    const available = reservoir === 'SiO2' && typeof fluid.reactiveSilicaPpm === 'function'
      ? fluid.reactiveSilicaPpm()
      : (typeof fluid[reservoir] === 'number' && Number.isFinite(fluid[reservoir]))
        ? Math.max(0, fluid[reservoir])
        : 0;
    const supported = available / demandPerUm;
    if (supported < acceptedThickness) {
      acceptedThickness = supported;
      limitingSpecies = reservoir;
    }
  }
  acceptedThickness = Math.max(0, Math.min(requestedThickness, acceptedThickness));
  if (acceptedThickness < requestedThickness) {
    const fraction = requestedThickness > 0 ? acceptedThickness / requestedThickness : 0;
    zone.thickness_um = acceptedThickness;
    if (typeof zone.growth_rate === 'number') zone.growth_rate *= fraction;
    zone._stoichiometric_budget_cap = {
      requested_thickness_um: requestedThickness,
      accepted_thickness_um: acceptedThickness,
      limiting_species: limitingSpecies,
    };
    zone.note = `${zone.note || 'growth'} [stoichiometric pool cap: ${limitingSpecies || 'unknown'}]`;
  }

  const bookedInventoryPerUm: Record<string, number> = {};
  let depleted: string[] | null = null;
  for (const species in stoich) {
    const reservoir = stoichiometricReservoirSpecies(crystal.mineral, species, fluid);
    const previous = reservoir === 'SiO2' && typeof fluid.reactiveSilicaPpm === 'function'
      ? fluid.reactiveSilicaPpm()
      : fluid[reservoir];
    if (typeof previous !== 'number') continue;
    const demandPerUm = stoichiometricBudgetDebitPpmPerUm(species, stoich[species]);
    const proposed = previous - zone.thickness_um * demandPerUm;
    // Depletion narration fires when the species crosses below the
    // trace threshold from above. 1 ppm is the order of magnitude
    // where further precipitation is no longer meaningful (saturation
    // cratered, σ ≪ 1 for cation-paired anions). Single-shot per
    // event: previous > 1 && proposed ≤ 1 catches the transition,
    // not the steady-state "already exhausted" case.
    if (previous > STOICHIOMETRIC_GROWTH_BUDGET_DEPLETION_THRESHOLD &&
        proposed <= STOICHIOMETRIC_GROWTH_BUDGET_DEPLETION_THRESHOLD) {
      (depleted ||= []).push(reservoir);
    }
    if (reservoir === 'SiO2' && typeof fluid.debitReactiveSilica === 'function') {
      fluid.debitReactiveSilica(zone.thickness_um * demandPerUm);
    } else {
      fluid[reservoir] = Math.max(0, proposed);
    }
    const remaining = reservoir === 'SiO2' && typeof fluid.reactiveSilicaPpm === 'function'
      ? fluid.reactiveSilicaPpm()
      : fluid[reservoir];
    bookedInventoryPerUm[reservoir] = zone.thickness_um > 0
      ? (previous - remaining) / zone.thickness_um
      : demandPerUm;
  }
  // Trace substitutions are optional rather than formula-limiting. Incorporate
  // only what exists and record the exact accepted ppm/µm for dissolution.
  const traceStoich = zone.trace_stoichiometry;
  if (traceStoich && typeof traceStoich === 'object') {
    for (const species in traceStoich) {
      const previous = fluid[species];
      const coefficient = Number(traceStoich[species]);
      if (typeof previous !== 'number' || !(coefficient > 0)) continue;
      const demandPerUm = stoichiometricBudgetDebitPpmPerUm(species, coefficient);
      const proposed = previous - zone.thickness_um * demandPerUm;
      if (previous > STOICHIOMETRIC_GROWTH_BUDGET_DEPLETION_THRESHOLD
          && proposed <= STOICHIOMETRIC_GROWTH_BUDGET_DEPLETION_THRESHOLD) {
        (depleted ||= []).push(species);
      }
      fluid[species] = Math.max(0, proposed);
      bookedInventoryPerUm[species] = (bookedInventoryPerUm[species] || 0)
        + (zone.thickness_um > 0 ? (previous - fluid[species]) / zone.thickness_um : 0);
    }
  }
  if (fluid.sulfurPoolsExplicit) syncExplicitSulfurTotal(fluid);
  zone._budget_inventory_per_um = bookedInventoryPerUm;
  zone._remaining_solid_um = zone.thickness_um;
  _refreshRemainingSolidSolutionComposition(crystal, zone);
  _recordAcceptedCarbonateTransferReceipt(conditions, crystal, zone, carbonateBeforePpm);
  return depleted;
}

function remainingBookedInventory(crystal: any, species: string): number {
  if (!crystal || !species) return 0;
  let total = 0;
  for (const zone of (crystal.zones || [])) {
    if (!(zone && zone.thickness_um > 0)) continue;
    const remaining = Number.isFinite(Number(zone._remaining_solid_um))
      ? Math.max(0, Number(zone._remaining_solid_um))
      : Math.max(0, Number(zone.thickness_um) || 0);
    const perUm = Number(zone._budget_inventory_per_um?.[species]) || 0;
    total += remaining * perUm;
  }
  return total;
}

function bookedSolidSulfurPpm(crystals: any[]): number {
  const sulfurKeys = ['S', 'S_sulfide', 'S_sulfate', 'S_elemental'];
  let total = 0;
  for (const crystal of (crystals || [])) {
    for (const zone of (crystal?.zones || [])) {
      if (!(zone && zone.thickness_um > 0)) continue;
      const remaining = Number.isFinite(Number(zone._remaining_solid_um))
        ? Math.max(0, Number(zone._remaining_solid_um))
        : Math.max(0, Number(zone.thickness_um) || 0);
      for (const key of sulfurKeys) {
        total += remaining * Math.max(0, Number(zone._budget_inventory_per_um?.[key]) || 0);
      }
    }
  }
  return total;
}

function bookedSolidCarbonPpm(crystals: any[]): number {
  let total = 0;
  for (const crystal of (crystals || [])) {
    for (const zone of (crystal?.zones || [])) {
      if (!(zone && zone.thickness_um > 0)) continue;
      const remaining = Number.isFinite(Number(zone._remaining_solid_um))
        ? Math.max(0, Number(zone._remaining_solid_um))
        : Math.max(0, Number(zone.thickness_um) || 0);
      total += remaining * Math.max(0, Number(zone._budget_inventory_per_um?.CO3) || 0);
    }
  }
  return total;
}

// Whole-simulator sulfur audit in the same ppm-equivalent units used by the
// accepted-zone ledger. Canonical voxel fluids plus booked solid inventory
// must equal the constructor inventory plus declared boundary imports minus
// exports. Internal redox transfers cannot change the total.
function simulatorSulfurLedgerSnapshot(sim: any): any {
  const grid = sim?.wall_state?.voxelGridFor?.(sim);
  const fluids = grid?.voxels
    ? grid.voxels.map((voxel: any) => voxel?.fluid).filter(Boolean)
    : [sim?.conditions?.fluid].filter(Boolean);
  const fluidPpm = fluids.reduce(
    (sum: number, fluid: any) => sum + sulfurSystemTotalPpm(fluid),
    0,
  );
  const solidPpm = bookedSolidSulfurPpm(sim?.crystals || []);
  const initialPpm = Math.max(0, Number(sim?._sulfurLedgerInitialPpm) || 0);
  const importsPpm = Math.max(0, Number(sim?._sulfurBoundaryImportsPpm) || 0);
  const exportsPpm = Math.max(0, Number(sim?._sulfurBoundaryExportsPpm) || 0);
  const expectedPpm = initialPpm + importsPpm - exportsPpm;
  const actualPpm = fluidPpm + solidPpm;
  const errorPpm = actualPpm - expectedPpm;
  const propagationViolations = Array.isArray(sim?._sulfurPropagationViolations)
    ? sim._sulfurPropagationViolations.length : 0;
  const tolerancePpm = Math.max(1e-7, Math.abs(expectedPpm) * 1e-9);
  return {
    step: Number(sim?.step) || 0,
    initialPpm,
    importsPpm,
    exportsPpm,
    fluidPpm,
    solidPpm,
    expectedPpm,
    actualPpm,
    errorPpm,
    tolerancePpm,
    propagationViolations,
    closed: Math.abs(errorPpm) <= tolerancePpm && propagationViolations === 0,
  };
}

// Whole-scenario Sicily carbon audit. CO3 is the simulator's total-DIC proxy;
// methane SD-AOM and host dissolution are declared sources, while accepted
// carbonate growth is the booked solid sink. pH/speciation changes contribute
// no carbon term.
function simulatorCarbonLedgerSnapshot(sim: any): any {
  const grid = sim?.wall_state?.voxelGridFor?.(sim);
  const fluids = grid?.voxels
    ? grid.voxels.map((voxel: any) => voxel?.fluid).filter(Boolean)
    : [sim?.conditions?.fluid].filter(Boolean);
  const fluidPpm = fluids.reduce(
    (sum: number, fluid: any) => sum + Math.max(0, Number(fluid?.CO3) || 0),
    0,
  );
  const solidPpm = bookedSolidCarbonPpm(sim?.crystals || []);
  const initialPpm = Math.max(0, Number(sim?._carbonLedgerInitialPpm) || 0);
  const methaneImportsPpm = Math.max(0, Number(sim?._carbonMethaneImportsPpm) || 0);
  const wallReleasePpm = Math.max(0, Number(sim?._carbonWallReleasePpm) || 0);
  const externalImportsPpm = Math.max(0, Number(sim?._carbonExternalImportsPpm) || 0);
  const exportsPpm = Math.max(0, Number(sim?._carbonExportsPpm) || 0);
  const expectedPpm = initialPpm + methaneImportsPpm + wallReleasePpm
    + externalImportsPpm - exportsPpm;
  const actualPpm = fluidPpm + solidPpm;
  const errorPpm = actualPpm - expectedPpm;
  const tolerancePpm = Math.max(1e-7, Math.abs(expectedPpm) * 1e-9);
  const propagationViolations = Array.isArray(sim?._carbonPropagationViolations)
    ? sim._carbonPropagationViolations.length : 0;
  return {
    step: Number(sim?.step) || 0,
    initialPpm,
    methaneImportsPpm,
    wallReleasePpm,
    externalImportsPpm,
    exportsPpm,
    fluidPpm,
    solidPpm,
    expectedPpm,
    actualPpm,
    errorPpm,
    tolerancePpm,
    propagationViolations,
    closed: Math.abs(errorPpm) <= tolerancePpm && propagationViolations === 0,
  };
}
