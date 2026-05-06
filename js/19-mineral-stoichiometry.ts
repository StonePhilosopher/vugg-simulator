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
//   - Trace elements (Mn, Fe in calcite zones) and special-mode
//     constants (aragonite polymorphic conversion) STAY inline —
//     they're zone-dependent or mode-dependent, not table-able.
//   - Migration progresses class-by-class. Minerals with multi-mode
//     dissolution (different rates for acid vs oxidative) keep their
//     inline credits until per-mode dispatch is added.
const MINERAL_DISSOLUTION_RATES: Record<string, Record<string, number>> = {
  // ---- Halides (Phase 1e batch 1) ----
  // Filled in the migration commit; empty in the infrastructure
  // commit so seed-42 stays byte-identical.
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
    const rates = MINERAL_DISSOLUTION_RATES[crystal.mineral];
    if (!rates) return null;  // unmigrated mineral — engine still credits inline
    const dissolved_um = -zone.thickness_um;
    const fluid = conditions.fluid;
    for (const species in rates) {
      if (typeof fluid[species] !== 'number') continue;
      fluid[species] += dissolved_um * rates[species];
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
