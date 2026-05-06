// ============================================================
// js/19-mineral-stoichiometry.ts — per-mineral fluid stoichiometry
// ============================================================
// Maps each growth-engine mineral name to the moles of each fluid
// species locked into one formula unit. Multiplied by
// MASS_BALANCE_SCALE × zone.thickness_um in applyMassBalance to
// debit/credit the per-ring fluid when MASS_BALANCE_ENABLED is on.
//
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1. Default flag OFF — these
// values do not affect any scenario until the calibration pass flips
// the flag.
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
  siderite:       { Fe: 1, CO3: 1 },                 // FeCO3
  rhodochrosite:  { Mn: 1, CO3: 1 },                 // MnCO3
  smithsonite:    { Zn: 1, CO3: 1 },                 // ZnCO3
  cerussite:      { Pb: 1, CO3: 1 },                 // PbCO3
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
  bismuthinite:   { Bi: 2, S: 3 },                   // Bi2S3
  acanthite:      { Ag: 2, S: 1 },                   // Ag2S (monoclinic)
  argentite:      { Ag: 2, S: 1 },                   // Ag2S (cubic)
  tetrahedrite:   { Cu: 9, Fe: 1.5, Zn: 1.5, Sb: 4, S: 13 }, // (Cu,Fe,Zn)12Sb4S13 — fahlore mid-range
  tennantite:     { Cu: 9, Fe: 1.5, Zn: 1.5, As: 4, S: 13 }, // (Cu,Fe,Zn)12As4S13 — fahlore mid-range
  nickeline:      { Ni: 1, As: 1 },                  // NiAs
  millerite:      { Ni: 1, S: 1 },                   // NiS
  cobaltite:      { Co: 1, As: 1, S: 1 },            // CoAsS

  // ---- Oxides ----
  quartz:         { SiO2: 1 },                       // SiO2
  hematite:       { Fe: 2 },                         // Fe2O3 (O comes from water/redox)
  magnetite:      { Fe: 3 },                         // Fe3O4
  cuprite:        { Cu: 2 },                         // Cu2O
  corundum:       { Al: 2 },                         // Al2O3
  ruby:           { Al: 2, Cr: 0.01 },               // Al2O3 + trace Cr (chromophore)
  sapphire:       { Al: 2, Fe: 0.01, Ti: 0.01 },     // Al2O3 + Fe/Ti
  uraninite:      { U: 1 },                          // UO2

  // ---- Hydroxides / oxyhydroxides ----
  goethite:       { Fe: 1 },                         // FeO(OH)
  lepidocrocite:  { Fe: 1 },                         // γ-FeO(OH)

  // ---- Silicates ----
  feldspar:       { K: 1, Al: 1, SiO2: 3 },          // KAlSi3O8 (sanidine/orthoclase/microcline)
  albite:         { Na: 1, Al: 1, SiO2: 3 },         // NaAlSi3O8
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

  // ---- Phosphates / arsenates / vanadates ----
  pyromorphite:   { Pb: 5, P: 3, Cl: 1 },            // Pb5(PO4)3Cl
  vanadinite:     { Pb: 5, V: 3, Cl: 1 },            // Pb5(VO4)3Cl
  mimetite:       { Pb: 5, As: 3, Cl: 1 },           // Pb5(AsO4)3Cl
  adamite:        { Zn: 2, As: 1 },                  // Zn2(AsO4)(OH)
  olivenite:      { Cu: 2, As: 1 },                  // Cu2(AsO4)(OH)
  erythrite:      { Co: 3, As: 2 },                  // Co3(AsO4)2·8H2O
  annabergite:    { Ni: 3, As: 2 },                  // Ni3(AsO4)2·8H2O
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

  // ---- Molybdates / tungstates / vanadates ----
  wulfenite:      { Pb: 1, Mo: 1 },                  // PbMoO4
  ferrimolybdite: { Fe: 2, Mo: 3 },                  // Fe2(MoO4)3·8H2O
  raspite:        { Pb: 1, W: 1 },                   // PbWO4 (monoclinic)
  stolzite:       { Pb: 1, W: 1 },                   // PbWO4 (tetragonal)
  clinobisvanite: { Bi: 1, V: 1 },                   // BiVO4
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
//   - Rates here are NOT scaled by MASS_BALANCE_SCALE — they are the
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
  // erythrite + annabergite have multi-mode dissolution (thermal +
  // acid at different effective rates) and stay inline pending
  // per-mode dispatch design.
  scorodite:  { Fe: 0.5, As: 0.5 },                    // acid dissolution
  adamite:    { Zn: 0.5, As: 0.3 },                    // acid attack
  mimetite:   { Pb: 0.8, As: 0.3, Cl: 0.1 },           // acid dissolution

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
  // chrysocolla has multi-mode dissolution (two pH-driven paths at
  // different effective rates) and stays inline pending per-mode
  // dispatch.
  quartz:       { SiO2: 0.8 },                         // OH⁻-assisted dissolution
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

  // ---- Carbonates (Phase 1e batch 6, v44 — single-mode subset) ----
  // Multi-mode skipped (different effective rates per dissolution
  // event): aragonite (polymorph + acid), rhodochrosite (acid + O2),
  // azurite (low-CO3 + acid).
  // Calcite has rate-scaled credits for Ca/CO3 (single-mode, table-able)
  // PLUS trace-element credits for Mn/Fe computed from zone history
  // (zone-dependent, stays inline).
  calcite:      { Ca: 0.5, CO3: 0.3 },                 // major species only; trace Mn/Fe stay inline
  dolomite:     { Ca: 0.3, Mg: 0.3, CO3: 0.5 },        // acid dissolution
  siderite:     { Fe: 0.5, CO3: 0.4 },                 // two engine triggers (oxidative + acid), same rates
  malachite:    { Cu: 0.8, CO3: 0.5 },                 // acid dissolution
  smithsonite:  { Zn: 0.6, CO3: 0.4 },                 // acid attack
  rosasite:     { Cu: 0.3, Zn: 0.2, CO3: 0.25 },       // pH < 5.5
  aurichalcite: { Zn: 0.4, Cu: 0.15, CO3: 0.3 },       // pH < 5.5
  cerussite:    { Pb: 0.5, CO3: 0.4 },                 // strong-acid pH < 4

  // ---- Sulfides (Phase 1e batch 7, v45 — single-mode subset) ----
  // pyrite + marcasite are multi-mode (oxidative rate-scaled vs acid
  // constants at different effective rates) — stay inline.
  // wurtzite has constant-rate "sublimation" credits — stays inline pending
  // dispatch design (single-event but non-rate-scaled constants).
  // sphalerite + galena + argentite have no inline dissolution credit at all.
  // For acanthite + cobaltite, the table handles only the positive cation
  // credits (Ag / Co + As); the inline negative S consumption stays for now
  // pending negative-rate design extension.
  // For arsenopyrite, the table handles the standard Fe + As + S
  // rate-scaled credits; the Au-trap (zone-data-driven trace) and the pH
  // adjustment stay inline since neither is rate-scaled.
  chalcopyrite: { Cu: 0.8, Fe: 0.5, S: 0.3 },          // acid attack
  molybdenite:  { Mo: 0.8, S: 0.2 },                   // oxidative — MoO₄²⁻ released
  nickeline:    { Ni: 0.4, As: 0.4 },                  // oxidative weathering
  millerite:    { Ni: 0.4, S: 0.3 },                   // acid attack
  stibnite:     { Sb: 0.3, S: 0.3 },                   // oxidative
  bismuthinite: { Bi: 0.3, S: 0.3 },                   // oxidative
  bornite:      { Cu: 0.4, Fe: 0.2, S: 0.3 },          // supergene oxidation
  chalcocite:   { Cu: 0.5, S: 0.3 },                   // strong oxidation
  covellite:    { Cu: 0.4, S: 0.4 },                   // strong oxidation
  tetrahedrite: { Cu: 0.6, Sb: 0.3, S: 0.4 },          // acid + oxidative
  tennantite:   { Cu: 0.6, As: 0.3, S: 0.4 },          // acid + oxidative
  arsenopyrite: { Fe: 0.5, As: 0.4, S: 0.4 },          // major species; Au-trap stays inline
  acanthite:    { Ag: 0.4 },                           // S consumption stays inline
  cobaltite:    { Co: 0.4, As: 0.4 },                  // S consumption stays inline
};

// Apply mass balance for a single growth or dissolution zone. Called
// from VugSimulator._runEngineForCrystal after the engine returns.
// Positive thickness = precipitation (debit fluid via
// MINERAL_STOICHIOMETRY × MASS_BALANCE_SCALE). Negative thickness =
// dissolution (credit fluid via MINERAL_DISSOLUTION_RATES, when the
// mineral has an entry).
//
// Two layers of safety while the flag is OFF:
//   1. The early `if (!MASS_BALANCE_ENABLED) return;` short-circuit.
//   2. Even when flipped on, missing-mineral entries log a warning
//      once and skip — so a new mineral added before its
//      stoichiometry is filed never crashes a run.
const _massBalanceMissingWarned: Record<string, boolean> = {};

// Returns the list of species names that just transitioned from positive
// to zero (depletion events), or null on no-op / missing stoichiometry.
// _runEngineForCrystal uses this to emit "Fe²⁺ depleted in ring 4 —
// pyrite nucleation halted" log lines so players can see when the fluid
// runs out, instead of crystals silently stopping growth.
function applyMassBalance(crystal: any, zone: any, conditions: any): string[] | null {
  if (!MASS_BALANCE_ENABLED) return null;
  if (!zone || !zone.thickness_um) return null;
  // Phase 1e (May 2026): the wrapper now handles dissolution too,
  // for minerals that have an entry in MINERAL_DISSOLUTION_RATES.
  // Engines whose dissolution credits have NOT yet been migrated
  // keep their inline `fluid.X += dissolved_um * RATE` blocks; the
  // wrapper's table-lookup short-circuits via the empty-entry check
  // so behavior stays byte-identical until the engine's class is
  // migrated. Single-mode dissolution maps cleanly to a per-mineral
  // entry; multi-mode (e.g. pyrite oxidative vs acid at different
  // rates) is left inline pending per-mode dispatch.
  if (zone.thickness_um < 0) {
    const entry = MINERAL_DISSOLUTION_RATES[crystal.mineral];
    if (!entry) return null;  // unmigrated mineral — engine still credits inline
    const dissolved_um = -zone.thickness_um;
    const fluid = conditions.fluid;
    // Resolve credits + flavor (rate-scaled vs constants).
    let credits: DissolutionRates;
    let isConstant: boolean;
    if ((entry as any).__modes) {
      const modes = (entry as any).__modes as Record<string, DissolutionMode>;
      const modeName: string | undefined = zone.dissolutionMode;
      const mode = modeName ? modes[modeName] : modes[Object.keys(modes)[0]];
      if (!mode) return null;  // unknown mode — caller must specify a declared one
      if ((mode as any).constants) {
        credits = (mode as any).constants;
        isConstant = true;
      } else {
        credits = (mode as any).rates;
        isConstant = false;
      }
    } else {
      credits = entry as DissolutionRates;
      isConstant = false;
    }
    // Apply credits. Positive-rate species use the legacy `fluid += delta`
    // path verbatim — preserves byte-identicality with all v45-and-earlier
    // baselines that depend on this exact accumulation order. Negative-rate
    // species (consumption — acanthite/cobaltite S sinks, native_silver
    // tarnish) get the legacy inline pattern `fluid = Math.max(fluid - x, 0)`,
    // which here becomes `fluid = Math.max(0, fluid + delta)` since `delta`
    // is already negative.
    for (const species in credits) {
      if (typeof fluid[species] !== 'number') continue;
      const rate = credits[species];
      const delta = isConstant ? rate : dissolved_um * rate;
      if (rate < 0) {
        fluid[species] = Math.max(0, fluid[species] + delta);
      } else {
        fluid[species] += delta;
      }
    }
    return null;  // depletion narration is precipitation-only
  }
  const stoich = MINERAL_STOICHIOMETRY[crystal.mineral];
  if (!stoich) {
    if (!_massBalanceMissingWarned[crystal.mineral]) {
      _massBalanceMissingWarned[crystal.mineral] = true;
      console.warn(
        `[mass-balance] no stoichiometry for ${crystal.mineral} — ` +
        `growth will not debit fluid composition. Add to ` +
        `MINERAL_STOICHIOMETRY in 19-mineral-stoichiometry.ts.`
      );
    }
    return null;
  }
  // thickness_um is positive (precipitation). Debit each species and
  // collect any that just crossed below the depletion threshold.
  const debit = MASS_BALANCE_SCALE * zone.thickness_um;
  const fluid = conditions.fluid;
  let depleted: string[] | null = null;
  for (const species in stoich) {
    const previous = fluid[species];
    if (typeof previous !== 'number') continue;
    const proposed = previous - debit * stoich[species];
    // Depletion narration fires when the species crosses below the
    // trace threshold from above. 1 ppm is the order of magnitude
    // where further precipitation is no longer meaningful (saturation
    // cratered, σ ≪ 1 for cation-paired anions). Single-shot per
    // event: previous > 1 && proposed ≤ 1 catches the transition,
    // not the steady-state "already exhausted" case.
    if (previous > MASS_BALANCE_DEPLETION_THRESHOLD &&
        proposed <= MASS_BALANCE_DEPLETION_THRESHOLD) {
      (depleted ||= []).push(species);
    }
    fluid[species] = Math.max(0, proposed);
  }
  return depleted;
}
