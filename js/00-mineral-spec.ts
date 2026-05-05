// ============================================================
// js/00-mineral-spec.ts — MINERAL_SPEC fallback + live-fetch loader
// ============================================================
// Phase B2 of the modular refactor. The very first thing the page
// needs is a mineral spec it can read synchronously, so this file
// sorts to the front of the build via its 00- prefix.
//
// Pulled out of 99-legacy-bundle.ts verbatim — no logic changes.
// Symbols exposed as globals (no import/export — see tsconfig.json
// for why this is a SCRIPT file, not an ES module): MINERAL_SPEC,
// MINERAL_SPEC_FALLBACK, MINERAL_SPEC_READY, onSpecReady, maxSizeCm.

// ============================================================
// MINERAL SPEC — single source of truth is ../data/minerals.json
// ============================================================
// At startup the browser fetches data/minerals.json and assigns the
// result to MINERAL_SPEC. This inline FALLBACK block only exists so
// that if the fetch fails (file:// protocol, offline), the simulator's
// size-cap and nucleation threshold logic can still function. The
// Library Mode always waits for the fetched version.
//
// Keep MINERAL_SPEC_FALLBACK in sync with data/minerals.json via
// `node tools/sync-spec.js` — the drift checker will flag mismatches.
const MINERAL_SPEC_FALLBACK = {
  quartz: { formula: "SiO2", nucleation_sigma: 1.0, max_size_cm: 1200, growth_rate_mult: 0.3, thermal_decomp_C: 1713, fluorescence: { activator: "Al", threshold_ppm: 5, color: "weak_blue_LW" }, twin_laws: [{ name: "Dauphine", probability: 0.15 }], acid_dissolution: { pH_threshold: 4.0, requires: { F: 20 } } },
  calcite: { formula: "CaCO3", nucleation_sigma: 1.0, max_size_cm: 2000, growth_rate_mult: 1.0, thermal_decomp_C: 840, fluorescence: { activator: "Mn", threshold_ppm: 2, color: "orange_red", quencher: { species: "Fe", threshold_ppm: 10 } }, twin_laws: [{ name: "c_twin", probability: 0.10 }], acid_dissolution: { pH_threshold: 5.5 } },
  aragonite: { formula: "CaCO3", nucleation_sigma: 1.0, max_size_cm: 30, growth_rate_mult: 0.5, thermal_decomp_C: 520, fluorescence: { activator: "Mn", threshold_ppm: 2, color: "orange_yellow", quencher: { species: "Fe", threshold_ppm: 10 } }, twin_laws: [{ name: "cyclic_sextet", probability: 0.40 }], acid_dissolution: { pH_threshold: 5.5 } },
  rhodochrosite: { formula: "MnCO3", nucleation_sigma: 1.0, max_size_cm: 25, growth_rate_mult: 0.5, thermal_decomp_C: 600, fluorescence: { activator: "intrinsic", color: "red_pink_LW" }, twin_laws: [{ name: "polysynthetic", probability: 0.02 }], acid_dissolution: { pH_threshold: 5.5 } },
  siderite: { formula: "FeCO3", nucleation_sigma: 1.0, max_size_cm: 20, growth_rate_mult: 0.5, thermal_decomp_C: 550, fluorescence: null, twin_laws: [{ name: "polysynthetic", probability: 0.02 }], acid_dissolution: { pH_threshold: 5.5 } },
  dolomite: { formula: "CaMg(CO3)2", nucleation_sigma: 1.0, max_size_cm: 30, growth_rate_mult: 0.45, thermal_decomp_C: 700, fluorescence: null, twin_laws: [{ name: "polysynthetic", probability: 0.02 }], acid_dissolution: { pH_threshold: 6.0 } },
  sphalerite: { formula: "ZnS", nucleation_sigma: 1.0, max_size_cm: 80, growth_rate_mult: 0.6, thermal_decomp_C: 1020, fluorescence: { activator: "Mn", threshold_ppm: 5, color: "orange_or_blue_variable", quencher: { species: "Fe", threshold_ppm: 10 } }, twin_laws: [{ name: "spinel_law", probability: 0.015 }], acid_dissolution: { pH_threshold: 2.0 } },
  wurtzite: { formula: "(Zn,Fe)S", nucleation_sigma: 1.0, max_size_cm: 20, growth_rate_mult: 0.55, thermal_decomp_C: 1020, fluorescence: { activator: "Mn", threshold_ppm: 5, color: "orange_or_blue_variable", quencher: { species: "Fe", threshold_ppm: 10 } }, twin_laws: [{ name: "basal_contact", probability: 0.008 }], acid_dissolution: { pH_threshold: 2.0 } },
  fluorite: { formula: "CaF2", nucleation_sigma: 1.0, max_size_cm: 400, growth_rate_mult: 0.5, thermal_decomp_C: 1360, fluorescence: { activator: "REE_or_defects", color: "blue_violet_LW_and_SW" }, twin_laws: [{ name: "penetration", probability: 0.008 }], acid_dissolution: { pH_threshold: 4.0 } },
  pyrite: { formula: "FeS2", nucleation_sigma: 1.0, max_size_cm: 40, growth_rate_mult: 0.3, thermal_decomp_C: 743, fluorescence: null, twin_laws: [{ name: "iron_cross", probability: 0.008 }], acid_dissolution: { pH_threshold: 3.0 } },
  marcasite: { formula: "FeS2", nucleation_sigma: 1.0, max_size_cm: 15, growth_rate_mult: 0.3, thermal_decomp_C: 240, fluorescence: null, twin_laws: [{ name: "spearhead", probability: 0.05 }], acid_dissolution: { pH_threshold: 1.5 } },
  chalcopyrite: { formula: "CuFeS2", nucleation_sigma: 1.0, max_size_cm: 30, growth_rate_mult: 0.3, thermal_decomp_C: 880, fluorescence: null, twin_laws: [{ name: "penetration", probability: 0.012 }], acid_dissolution: { pH_threshold: 3.0 } },
  hematite: { formula: "Fe2O3", nucleation_sigma: 1.5, max_size_cm: 60, growth_rate_mult: 0.5, thermal_decomp_C: 1560, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  malachite: { formula: "Cu2(CO3)(OH)2", nucleation_sigma: 1.0, max_size_cm: 200, growth_rate_mult: 0.8, thermal_decomp_C: 200, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 } },
  uraninite: { formula: "UO2", nucleation_sigma: 1.5, max_size_cm: 10, growth_rate_mult: 0.1, thermal_decomp_C: 2800, fluorescence: { activator: null, color: null }, twin_laws: [], acid_dissolution: null },
  galena: { formula: "PbS", nucleation_sigma: 1.0, max_size_cm: 60, growth_rate_mult: 0.5, thermal_decomp_C: 1115, fluorescence: null, twin_laws: [{ name: "spinel_law", probability: 0.008 }], acid_dissolution: { pH_threshold: 2.0 } },
  smithsonite: { formula: "ZnCO3", nucleation_sigma: 1.0, max_size_cm: 60, growth_rate_mult: 0.7, thermal_decomp_C: 300, fluorescence: { activator: "Mn", threshold_ppm: 2, color: "pink_LW" }, twin_laws: [{ name: "cyclic", probability: 0.01 }], acid_dissolution: { pH_threshold: 4.0 } },
  wulfenite: { formula: "PbMoO4", nucleation_sigma: 1.0, max_size_cm: 20, growth_rate_mult: 0.2, thermal_decomp_C: 1120, fluorescence: null, twin_laws: [{ name: "penetration", probability: 0.03 }], acid_dissolution: { pH_threshold: 3.5 } },
  ferrimolybdite: { formula: "Fe2(MoO4)3·nH2O", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.5, thermal_decomp_C: 150, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
  arsenopyrite: { formula: "FeAsS", nucleation_sigma: 1.2, max_size_cm: 15, growth_rate_mult: 0.3, thermal_decomp_C: 720, fluorescence: null, twin_laws: [{ name: "trillings_120", miller_indices: "{120}", trigger: "growth (uncommon)", probability: 0.01 }], acid_dissolution: null },
  scorodite: { formula: "FeAsO4·2H2O", nucleation_sigma: 1.0, max_size_cm: 8, growth_rate_mult: 0.25, thermal_decomp_C: 160, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 5.5 } },
  molybdenite: { formula: "MoS2", nucleation_sigma: 1.0, max_size_cm: 40, growth_rate_mult: 0.3, thermal_decomp_C: 1185, fluorescence: null, twin_laws: [], acid_dissolution: null },
  adamite: { formula: "Zn2(AsO4)(OH)", nucleation_sigma: 1.0, max_size_cm: 10, growth_rate_mult: 0.3, thermal_decomp_C: 500, fluorescence: { activator: "intrinsic", color: "green_yellow_SW", quencher: { species: "Cu", threshold_ppm: 10 } }, twin_laws: [], acid_dissolution: { pH_threshold: 3.5 } },
  mimetite: { formula: "Pb5(AsO4)3Cl", nucleation_sigma: 1.0, max_size_cm: 10, growth_rate_mult: 0.3, thermal_decomp_C: 400, fluorescence: { activator: "intrinsic", color: "orange_SW" }, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  erythrite: { formula: "Co3(AsO4)2·8H2O", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.25, thermal_decomp_C: 200, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 } },
  annabergite: { formula: "Ni3(AsO4)2·8H2O", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.25, thermal_decomp_C: 200, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 } },
  tetrahedrite: { formula: "Cu12Sb4S13", nucleation_sigma: 1.0, max_size_cm: 12, growth_rate_mult: 0.4, thermal_decomp_C: 650, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  tennantite: { formula: "Cu12As4S13", nucleation_sigma: 1.0, max_size_cm: 12, growth_rate_mult: 0.4, thermal_decomp_C: 620, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  apophyllite: { formula: "KCa4Si8O20(F,OH)·8H2O", nucleation_sigma: 1.0, max_size_cm: 18, growth_rate_mult: 0.5, thermal_decomp_C: 350, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 5.0 } },
  feldspar: { formula: "KAlSi3O8", nucleation_sigma: 1.0, max_size_cm: 1400, growth_rate_mult: 0.4, thermal_decomp_C: 1170, fluorescence: { activator: "Pb_amazonite", threshold_ppm: 5, color: "weak_yellow_green" }, twin_laws: [{ name: "Carlsbad", probability: 0.12 }, { name: "Baveno", probability: 0.04 }, { name: "Manebach", probability: 0.02 }], acid_dissolution: { pH_threshold: 4.0 } },
  albite: { formula: "NaAlSi3O8", nucleation_sigma: 1.0, max_size_cm: 40, growth_rate_mult: 0.4, thermal_decomp_C: 1118, fluorescence: { activator: "intrinsic", color: "weak_white_LW" }, twin_laws: [{ name: "albite", probability: 0.20 }, { name: "pericline", probability: 0.05 }], acid_dissolution: { pH_threshold: 3.0 } },
  selenite: { formula: "CaSO4·2H2O", nucleation_sigma: 1.0, max_size_cm: 2400, growth_rate_mult: 0.7, thermal_decomp_C: 150, fluorescence: null, twin_laws: [{ name: "swallowtail", probability: 0.08 }], acid_dissolution: { pH_threshold: 5.0 } },
  barite: { formula: "BaSO4", nucleation_sigma: 1.0, max_size_cm: 60, growth_rate_mult: 0.3, thermal_decomp_C: 1149, fluorescence: { activator: "intrinsic", color: "creamy_white_SW_Sterling" }, twin_laws: [{ name: "cyclic_cockscomb", probability: 0.05 }], acid_dissolution: null },
  celestine: { formula: "SrSO4", nucleation_sigma: 1.0, max_size_cm: 30, growth_rate_mult: 0.3, thermal_decomp_C: 1100, fluorescence: null, twin_laws: [], acid_dissolution: null },
  jarosite: { formula: "KFe3(SO4)2(OH)6", nucleation_sigma: 1.0, max_size_cm: 3, growth_rate_mult: 0.4, thermal_decomp_C: 250, fluorescence: null, twin_laws: [], acid_dissolution: null },
  alunite: { formula: "KAl3(SO4)2(OH)6", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.35, thermal_decomp_C: 450, fluorescence: null, twin_laws: [], acid_dissolution: null },
  brochantite: { formula: "Cu4(SO4)(OH)6", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.35, thermal_decomp_C: 250, fluorescence: null, twin_laws: [], acid_dissolution: null },
  antlerite: { formula: "Cu3(SO4)(OH)4", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.35, thermal_decomp_C: 200, fluorescence: null, twin_laws: [], acid_dissolution: null },
  anhydrite: { formula: "CaSO4", nucleation_sigma: 1.0, max_size_cm: 200, growth_rate_mult: 0.35, thermal_decomp_C: 1450, fluorescence: null, twin_laws: [], acid_dissolution: null },
  goethite: { formula: "FeO(OH)", nucleation_sigma: 1.0, max_size_cm: 60, growth_rate_mult: 0.4, thermal_decomp_C: 300, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 }, nucleation_preferences: { grows_on: ["pyrite", "chalcopyrite", "marcasite"], forms_pseudomorph_after: ["pyrite"] } },
  topaz: { formula: "Al2SiO4(F,OH)2", nucleation_sigma: 1.4, max_size_cm: 200, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: { activator: "trace Ti", threshold_ppm: 2, color: "weak_greenish_LW" }, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
  tourmaline: { formula: "Na(Fe,Li,Al)3Al6(BO3)3Si6O18(OH)4", nucleation_sigma: 1.3, max_size_cm: 300, growth_rate_mult: 0.4, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  beryl: { formula: "Be3Al2Si6O18", nucleation_sigma: 1.8, max_size_cm: 1200, growth_rate_mult: 0.25, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  emerald: { formula: "Be3Al2Si6O18", nucleation_sigma: 1.6, max_size_cm: 120, growth_rate_mult: 0.25, thermal_decomp_C: null, fluorescence: "weak red (Cr³⁺ emission)", twin_laws: [], acid_dissolution: null },
  aquamarine: { formula: "Be3Al2Si6O18", nucleation_sigma: 1.3, max_size_cm: 200, growth_rate_mult: 0.25, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  morganite: { formula: "Be3Al2Si6O18", nucleation_sigma: 1.4, max_size_cm: 80, growth_rate_mult: 0.25, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  heliodor: { formula: "Be3Al2Si6O18", nucleation_sigma: 1.4, max_size_cm: 60, growth_rate_mult: 0.25, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  corundum: { formula: "Al2O3", nucleation_sigma: 1.3, max_size_cm: 30, growth_rate_mult: 0.35, thermal_decomp_C: null, fluorescence: null, twin_laws: ["0001 basal (polysynthetic)", "10̄11 rhombohedral"], acid_dissolution: null },
  ruby: { formula: "Al2O3", nucleation_sigma: 1.5, max_size_cm: 20, growth_rate_mult: 0.35, thermal_decomp_C: null, fluorescence: "strong red under LW + SW UV (Cr³⁺ emission at 694 nm) — diagnostic", twin_laws: ["0001 basal (polysynthetic)", "10̄11 rhombohedral"], acid_dissolution: null },
  sapphire: { formula: "Al2O3", nucleation_sigma: 1.4, max_size_cm: 25, growth_rate_mult: 0.35, thermal_decomp_C: null, fluorescence: "weak — Fe quenches emission; yellow sapphire shows weak orange (Fe³⁺)", twin_laws: ["0001 basal", "10̄11 rhombohedral"], acid_dissolution: null },
  spodumene: { formula: "LiAlSi2O6", nucleation_sigma: 1.5, max_size_cm: 1400, growth_rate_mult: 0.35, thermal_decomp_C: null, fluorescence: { activator: "Mn", threshold_ppm: 2, color: "strong_pink_orange_SW" }, twin_laws: [], acid_dissolution: null },
  anglesite: { formula: "PbSO4", nucleation_sigma: 1.1, max_size_cm: 15, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: { activator: "intrinsic", color: "weak_yellow_LW" }, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
  cerussite: { formula: "PbCO3", nucleation_sigma: 1.0, max_size_cm: 20, growth_rate_mult: 0.3, thermal_decomp_C: 315, fluorescence: { activator: "intrinsic", color: "weak_yellow_LW" }, twin_laws: [{ name: "cyclic_sixling", probability: 0.4 }], acid_dissolution: { pH_threshold: 4.0 } },
  pyromorphite: { formula: "Pb5(PO4)3Cl", nucleation_sigma: 1.2, max_size_cm: 15, growth_rate_mult: 0.4, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.5 } },
  vanadinite: { formula: "Pb5(VO4)3Cl", nucleation_sigma: 1.3, max_size_cm: 10, growth_rate_mult: 0.35, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.5 } },
  bornite: { formula: "Cu5FeS4", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.4, thermal_decomp_C: 550, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  chalcocite: { formula: "Cu2S", nucleation_sigma: 1.1, max_size_cm: 15, growth_rate_mult: 0.6, thermal_decomp_C: 1130, fluorescence: null, twin_laws: [{ name: "cyclic_sixling", probability: 0.15 }], acid_dissolution: { pH_threshold: 3.0 } },
  covellite: { formula: "CuS", nucleation_sigma: 1.2, max_size_cm: 10, growth_rate_mult: 0.45, thermal_decomp_C: 507, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  cuprite: { formula: "Cu2O", nucleation_sigma: 1.2, max_size_cm: 15, growth_rate_mult: 0.35, thermal_decomp_C: 1235, fluorescence: null, twin_laws: [{ name: "spinel_law", probability: 0.05 }], acid_dissolution: { pH_threshold: 3.5 } },
  azurite: { formula: "Cu3(CO3)2(OH)2", nucleation_sigma: 1.4, max_size_cm: 25, growth_rate_mult: 0.3, thermal_decomp_C: 220, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 5.0 } },
  chrysocolla: { formula: "Cu2H2Si2O5(OH)4", nucleation_sigma: 1.2, max_size_cm: 30, growth_rate_mult: 0.45, thermal_decomp_C: 100, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 } },
  native_copper: { formula: "Cu", nucleation_sigma: 1.6, max_size_cm: 300, growth_rate_mult: 0.2, thermal_decomp_C: 1083, fluorescence: null, twin_laws: [{ name: "spinel_law", probability: 0.04 }], acid_dissolution: { pH_threshold: 4.0 } },
  native_gold: { formula: "Au", nucleation_sigma: 1.0, max_size_cm: 30, growth_rate_mult: 0.15, thermal_decomp_C: 1064, fluorescence: null, twin_laws: [{ name: "spinel_law", probability: 0.05 }], acid_dissolution: null },
  magnetite: { formula: "Fe3O4", nucleation_sigma: 1.0, max_size_cm: 15, growth_rate_mult: 0.35, thermal_decomp_C: 1590, fluorescence: null, twin_laws: [{ name: "spinel_law", probability: 0.03 }], acid_dissolution: { pH_threshold: 2.5 } },
  lepidocrocite: { formula: "FeO(OH)-gamma", nucleation_sigma: 1.1, max_size_cm: 0.5, growth_rate_mult: 0.5, thermal_decomp_C: 300, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  stibnite: { formula: "Sb2S3", nucleation_sigma: 1.2, max_size_cm: 60, growth_rate_mult: 0.35, thermal_decomp_C: 550, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
  bismuthinite: { formula: "Bi2S3", nucleation_sigma: 1.3, max_size_cm: 5, growth_rate_mult: 0.4, thermal_decomp_C: 760, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.0 } },
  native_bismuth: { formula: "Bi", nucleation_sigma: 1.4, max_size_cm: 5, growth_rate_mult: 0.4, thermal_decomp_C: 271, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 3.0 } },
  clinobisvanite: { formula: "BiVO4", nucleation_sigma: 1.5, max_size_cm: 0.1, growth_rate_mult: 0.2, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 2.5 } },
  acanthite: { formula: "Ag2S", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  argentite: { formula: "Ag2S", nucleation_sigma: 1.0, max_size_cm: 3.0, growth_rate_mult: 0.4, thermal_decomp_C: null, fluorescence: null, twin_laws: [{ name: "spinel_111", miller_indices: "{111}", trigger: "growth", probability: 0.04, description: "Penetration twin on {111} (spinel law)", habits: ["octahedral"] }], acid_dissolution: null },
  native_silver: { formula: "Ag", nucleation_sigma: 1.2, max_size_cm: 30.0, growth_rate_mult: 0.5, thermal_decomp_C: null, fluorescence: null, twin_laws: [{ name: "111_penetration", miller_indices: "{111}", trigger: "growth at specific localities (Batopilas/Chanarcillo style)", probability: 0.05, description: "Penetration twin on {111}", habits: ["cubic_crystal"] }], acid_dissolution: null },
  native_arsenic: { formula: "As", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.3, thermal_decomp_C: 615, fluorescence: null, twin_laws: [], acid_dissolution: null },
  native_sulfur: { formula: "S", nucleation_sigma: 1.0, max_size_cm: 30.0, growth_rate_mult: 0.4, thermal_decomp_C: 115, fluorescence: null, twin_laws: [], acid_dissolution: null },
  native_tellurium: { formula: "Te", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.3, thermal_decomp_C: 449, fluorescence: null, twin_laws: [], acid_dissolution: null },
  nickeline: { formula: "NiAs", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  millerite: { formula: "NiS", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.4, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  cobaltite: { formula: "CoAsS", nucleation_sigma: 1.2, max_size_cm: 3.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  descloizite: { formula: "PbZnVO4(OH)", nucleation_sigma: 1.0, max_size_cm: 3.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  mottramite: { formula: "PbCu(VO4)(OH)", nucleation_sigma: 1.0, max_size_cm: 3.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  raspite: { formula: "PbWO4", nucleation_sigma: 1.4, max_size_cm: 1.0, growth_rate_mult: 0.2, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  stolzite: { formula: "PbWO4", nucleation_sigma: 1.0, max_size_cm: 2.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  olivenite: { formula: "Cu2AsO4(OH)", nucleation_sigma: 1.0, max_size_cm: 5.0, growth_rate_mult: 0.3, thermal_decomp_C: null, fluorescence: null, twin_laws: [], acid_dissolution: null },
  chalcanthite: { formula: "CuSO4·5H2O", nucleation_sigma: 1.0, max_size_cm: 10.0, growth_rate_mult: 0.5, thermal_decomp_C: null, fluorescence: null, twin_laws: [{ name: "cruciform_010", miller_indices: "{010}", trigger: "growth (rare)", probability: 0.005, description: "Rare cruciform twin (twin plane {010}, corrected from earlier {110} placeholder per Mindat handbook)", habits: ["tabular"] }], acid_dissolution: null },
  rosasite: { formula: "(Cu,Zn)2(CO3)(OH)2", nucleation_sigma: 1.0, max_size_cm: 6, growth_rate_mult: 0.4, thermal_decomp_C: 200, fluorescence: null, twin_laws: [{ name: "rosasite_100", miller_indices: "{100}", trigger: "growth", probability: 0.05 }], acid_dissolution: { pH_threshold: 5.0 }, class: "carbonate" },
  aurichalcite: { formula: "(Zn,Cu)5(CO3)2(OH)6", nucleation_sigma: 1.0, max_size_cm: 4, growth_rate_mult: 0.4, thermal_decomp_C: 200, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 5.0 }, class: "carbonate" },
  torbernite: { formula: "Cu(UO2)2(PO4)2·12H2O", nucleation_sigma: 1.0, max_size_cm: 5, growth_rate_mult: 0.4, thermal_decomp_C: 75, fluorescence: null, twin_laws: [{ name: "torbernite_110", miller_indices: "{110}", trigger: "growth (rare)", probability: 0.03 }], acid_dissolution: { pH_threshold: 4.5 }, class: "phosphate" },
  zeunerite: { formula: "Cu(UO2)2(AsO4)2·12H2O", nucleation_sigma: 1.0, max_size_cm: 3, growth_rate_mult: 0.4, thermal_decomp_C: 75, fluorescence: null, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 }, class: "phosphate" },
  carnotite: { formula: "K2(UO2)2(VO4)2·3H2O", nucleation_sigma: 1.0, max_size_cm: 1, growth_rate_mult: 0.4, thermal_decomp_C: 100, fluorescence: null, twin_laws: [{ name: "carnotite_001", miller_indices: "{001}", trigger: "twin and composition plane in rare crystals", probability: 0.04 }], acid_dissolution: { pH_threshold: 4.5 }, class: "phosphate" },
  autunite: { formula: "Ca(UO2)2(PO4)2·11H2O", nucleation_sigma: 1.0, max_size_cm: 6, growth_rate_mult: 0.4, thermal_decomp_C: 80, fluorescence: { activator: "U", color: "intense_apple_green_LW" }, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 }, class: "phosphate" },
  uranospinite: { formula: "Ca(UO2)2(AsO4)2·10H2O", nucleation_sigma: 1.0, max_size_cm: 3, growth_rate_mult: 0.4, thermal_decomp_C: 80, fluorescence: { activator: "U", color: "bright_yellow_green_LW" }, twin_laws: [], acid_dissolution: { pH_threshold: 4.5 }, class: "phosphate" },
  tyuyamunite: { formula: "Ca(UO2)2(VO4)2·5-8H2O", nucleation_sigma: 1.0, max_size_cm: 1, growth_rate_mult: 0.4, thermal_decomp_C: 100, fluorescence: { activator: "U", color: "yellow_green_LW_weak_to_moderate" }, twin_laws: [], acid_dissolution: { pH_threshold: 5.0 }, class: "phosphate" },
};

// Live spec — swapped in by the fetch below if data/minerals.json loads.
// Typed as any because the live spec (post-fetch) has many more fields
// than the inline fallback (class, scenarios, required_ingredients,
// trace_ingredients, …); narrowing to the fallback shape would break
// every Library/Random caller that reads them.
let MINERAL_SPEC: Record<string, any> = MINERAL_SPEC_FALLBACK;
let MINERAL_SPEC_READY = false;
const _specListeners = [];

function onSpecReady(cb) {
  if (MINERAL_SPEC_READY) cb(MINERAL_SPEC);
  else _specListeners.push(cb);
}

// Fetch real spec; replaces MINERAL_SPEC with the full JSON (description,
// class, scenarios, habit_variants, full fluorescence structure, etc.).
// Safe to call before other init: MINERAL_SPEC_FALLBACK covers the gap.
// Try multiple paths so the spec loads regardless of where the file is
// served from: root (current GitHub Pages + local preview), one level
// up (agent-api Node context), or absolute /data (some kiosk setups).
// Pre-flatten this also covered web/ and docs/ subtrees — see ARCHITECTURE.md.
async function _loadSpec(paths) {
  for (const p of paths) {
    try {
      // cache: 'no-store' — the spec changes during development and the
      // browser's disk cache was masking updates (stale habit_variants,
      // missing class_color, etc.). Always pull fresh.
      const r = await fetch(p, { cache: 'no-store' });
      if (r.ok) return { doc: await r.json(), path: p };
    } catch (e) { /* try next */ }
  }
  throw new Error('all spec paths failed');
}
_loadSpec(['./data/minerals.json', '../data/minerals.json', '/data/minerals.json'])
  .then(({ doc, path }) => {
    MINERAL_SPEC = doc.minerals;
    MINERAL_SPEC_READY = true;
    console.info(`[spec] loaded ${Object.keys(MINERAL_SPEC).length} minerals from ${path}`);
    _specListeners.splice(0).forEach(cb => { try { cb(MINERAL_SPEC); } catch (e) { console.error(e); } });
  })
  .catch(err => {
    MINERAL_SPEC_READY = true; // resolve with fallback
    console.warn(`[spec] fetch failed (${err.message}); using compact fallback — Library Mode will render with limited data`);
    _specListeners.splice(0).forEach(cb => { try { cb(MINERAL_SPEC); } catch (e) { console.error(e); } });
  });

function maxSizeCm(mineral) {
  const entry = MINERAL_SPEC[mineral];
  return entry ? entry.max_size_cm : null;
}
