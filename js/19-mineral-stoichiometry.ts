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

// Apply mass balance for a single growth or dissolution zone. Called
// from VugSimulator._runEngineForCrystal after the engine returns.
// Positive thickness = precipitation (debit fluid); negative thickness
// = dissolution (credit fluid). No-op when MASS_BALANCE_ENABLED is
// false, so v17 baseline scenarios stay byte-identical until the
// calibration pass flips the flag.
//
// Two layers of safety while the flag is OFF:
//   1. The early `if (!MASS_BALANCE_ENABLED) return;` short-circuit.
//   2. Even when flipped on, missing-mineral entries log a warning
//      once and skip — so a new mineral added before its
//      stoichiometry is filed never crashes a run.
const _massBalanceMissingWarned: Record<string, boolean> = {};

function applyMassBalance(crystal: any, zone: any, conditions: any): void {
  if (!MASS_BALANCE_ENABLED) return;
  if (!zone || !zone.thickness_um) return;
  // Phase 1d (May 2026): precipitation-only. Engines hand-code their
  // dissolution credits at per-mineral rates ~50× larger than the
  // wrapper's MASS_BALANCE_SCALE — those rates were tuned to specific
  // recycling stories per scenario (e.g. acid dissolution of calcite
  // releases Ca at 0.5 ppm/µm, not 0.01). Until those manual credits
  // are migrated into per-mineral dissolution rates (Phase 1e or
  // later), the wrapper stays growth-only to avoid double-crediting.
  // Net: the wrapper handles the gap that v17 left open (precipitation
  // didn't debit the fluid), while existing dissolution credits keep
  // their behavior.
  if (zone.thickness_um < 0) return;
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
    return;
  }
  // thickness_um is positive (precipitation). Debit each species.
  const debit = MASS_BALANCE_SCALE * zone.thickness_um;
  const fluid = conditions.fluid;
  for (const species in stoich) {
    if (typeof fluid[species] !== 'number') continue;
    fluid[species] = Math.max(0, fluid[species] - debit * stoich[species]);
  }
}
