// ============================================================
// js/39-supersat-silicate.ts — supersaturation methods for silicate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/silicate.py. Minerals (13): albite, apophyllite, aquamarine, beryl, chrysocolla, emerald, feldspar, heliodor, morganite, quartz, spodumene, topaz, tourmaline. Family helpers: _beryl_base_sigma, _corundum_base_sigma.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Silicate MINERAL_GATES exports ----

const MINERAL_GATES_quartz: MineralGates = {
  sigma_crit: 1.2,
  T_min: 50, T_max: 600, T_optimal: 300,
  fluid_min: { SiO2: 50 },
  surface_energy: 'high',
  _sources: ['quartz engine v17+', 'Rimstidt & Barnes 1980 GCA 44:1683', 'Brantley et al. 2008'],
  _notes: 'SiO2 trigonal. ΔH° = +22 kJ/mol — strongly T-sensitive (corrected v127). σ_crit 1.2 is the heterogeneous value vug nucleation uses; homogeneous σ_crit is 6-20+.',
};

const MINERAL_GATES_feldspar: MineralGates = {
  sigma_crit: 1.0,
  T_max: 800, T_optimal: 500,
  fluid_min: { K: 10, Al: 3, SiO2: 200 },
  pH_min: 4.0,
  surface_energy: 'medium',
  _sources: ['feldspar engine v17+ K-only'],
  _notes: 'KAlSi3O8 (sanidine/orthoclase/microcline polymorphs). Pre-v17 fold Na into K-or-Na fork removed — Na fluids route to albite.',
};

const MINERAL_GATES_apophyllite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 50, T_max: 250, T_optimal: 150,
  fluid_min: { K: 5, Ca: 30, SiO2: 800, F: 2 },
  pH_min: 7.0, pH_max: 10.0,
  surface_energy: 'low',
  _sources: ['apophyllite engine v17+'],
  _notes: 'KCa4Si8O20(F,OH)·8H2O — zeolite-facies sheet silicate. Pressure ≤ 0.5 kbar required.',
};

const MINERAL_GATES_albite: MineralGates = {
  sigma_crit: 1.0,
  T_optimal: 400,
  fluid_min: { Na: 10, Al: 3, SiO2: 200 },
  pH_min: 3.0,
  surface_energy: 'medium',
  _sources: ['albite engine v17+'],
  _notes: 'NaAlSi3O8 — Na-feldspar. More acid-resistant than K-feldspar (pH 3 vs 4 cutoff).',
};

const MINERAL_GATES_lepidolite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 350, T_max: 700, T_optimal: 450,
  fluid_min: { K: 10, Li: 15, Al: 10, SiO2: 200, F: 5 },
  pH_min: 6.0, pH_max: 9.0,
  surface_energy: 'medium',
  _sources: ['lepidolite engine v17+', 'research-lepidolite.md', 'Evans & Raftery 1982'],
  _notes: 'K(Li,Al)3(Al,Si)4O10(F,OH)2 — Li-mica. Mn → pink/purple coloration. Fe > 100 ppm routes to zinnwaldite.',
};

const MINERAL_GATES_spodumene: MineralGates = {
  sigma_crit: 1.5,
  T_min: 400, T_max: 800, T_optimal: 525,
  fluid_min: { Li: 8, Al: 5, SiO2: 40 },
  surface_energy: 'medium',
  _sources: ['spodumene engine v17+'],
  _notes: 'LiAlSi2O6 — Li-pyroxene. Gem variety kunzite (Mn), hiddenite (Cr).',
};

const MINERAL_GATES_chrysocolla: MineralGates = {
  sigma_crit: 1.2,
  T_min: 5, T_max: 80, T_optimal: 28,
  fluid_min: { Cu: 5, SiO2: 20 },
  O2_min: 0.3,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'very_low',
  _sources: ['chrysocolla engine v17+'],
  _notes: '(Cu,Al)2H2Si2O5(OH)4·nH2O — cyan supergene Cu silicate. CO3 > SiO2 routes to malachite.',
};

const MINERAL_GATES_beryl: MineralGates = {
  sigma_crit: 1.0,
  T_min: 300, T_max: 700, T_optimal: 450,
  fluid_min: { Be: 10, Al: 6, SiO2: 50 },
  surface_energy: 'medium',
  _sources: ['beryl engine v17+', '_beryl_base_sigma family helper'],
  _notes: 'Be3Al2Si6O18 — pegmatite cyclosilicate. Chromophore-free variant. Cr/V → emerald, Mn → morganite, Fe → aquamarine/heliodor.',
};

const MINERAL_GATES_emerald: MineralGates = {
  sigma_crit: 1.0,
  T_min: 300, T_max: 700, T_optimal: 450,
  fluid_min: { Be: 10, Al: 6, SiO2: 50, Cr: 0.5 },
  surface_energy: 'medium',
  _sources: ['emerald variant of _beryl_base_sigma'],
  _notes: 'Cr or V chromophore-bearing beryl. V ≥ 1.0 also fires.',
};

const MINERAL_GATES_aquamarine: MineralGates = {
  sigma_crit: 1.0,
  T_min: 300, T_max: 700, T_optimal: 450,
  fluid_min: { Be: 10, Al: 6, SiO2: 50, Fe: 8 },
  surface_energy: 'medium',
  _sources: ['aquamarine variant of _beryl_base_sigma'],
  _notes: 'Fe2+ chromophore beryl. Fe ≥ 15 with O2 > 0.5 routes to heliodor instead.',
};

const MINERAL_GATES_morganite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 300, T_max: 700, T_optimal: 450,
  fluid_min: { Be: 10, Al: 6, SiO2: 50, Mn: 2.0 },
  surface_energy: 'medium',
  _sources: ['morganite variant of _beryl_base_sigma'],
  _notes: 'Mn2+ chromophore beryl — pink-peach variant.',
};

const MINERAL_GATES_heliodor: MineralGates = {
  sigma_crit: 1.0,
  T_min: 300, T_max: 700, T_optimal: 450,
  fluid_min: { Be: 10, Al: 6, SiO2: 50, Fe: 15 },
  O2_min: 0.5,
  surface_energy: 'medium',
  _sources: ['heliodor variant of _beryl_base_sigma'],
  _notes: 'Fe3+ chromophore beryl — yellow-gold variant. Requires oxidizing conditions for Fe(III) state.',
};

const MINERAL_GATES_tourmaline: MineralGates = {
  sigma_crit: 1.3,
  T_min: 350, T_max: 700, T_optimal: 500,
  fluid_min: { Na: 3, B: 6, Al: 8, SiO2: 60 },
  surface_energy: 'medium',
  _sources: ['tourmaline engine v17+'],
  _notes: 'Na(Mg,Fe,Mn,Li,Al)3Al6(Si6O18)(BO3)3(OH,F)4 — pegmatite cyclo-borosilicate. Schorl/dravite/elbaite/uvite varieties.',
};

const MINERAL_GATES_topaz: MineralGates = {
  sigma_crit: 1.4,
  T_min: 300, T_max: 600, T_optimal: 370,
  fluid_min: { Al: 3, SiO2: 200, F: 20 },
  pH_min: 2.0,
  surface_energy: 'high',
  _sources: ['topaz engine v17+'],
  _notes: 'Al2SiO4(F,OH)2 — F-bearing pegmatite/greisen. Imperial topaz (Cr trace) gold-orange variety.',
};

const MINERAL_GATES_opal: MineralGates = {
  sigma_crit: 0.8,                          // v131 (2026-05-21): literature value per Iler 1979 — heterogeneous σ_crit range 0.5-1.0, midpoint 0.8. Was 1.0 (v101 engine-matched calibration); v127 engine-gates refactor surfaced the engine/literature mismatch as a v129 calibration target.
  T_min: 5, T_max: 100, T_optimal: 40,
  fluid_min: { SiO2: 200 },
  pH_min: 6.5, pH_max: 10.0,
  surface_energy: 'very_low',
  _sources: ['opal engine v101+', 'Jones & Segnit 1971', 'Iler 1979', 'Fournier 1977 Geothermics 5:41'],
  _notes: 'SiO2·nH2O amorphous-to-CT mineraloid. γ_sl ~0.05-0.10 J/m² (very_low — lowest in catalog). ΔH° corrected to +14 kJ/mol (v127 science fix). Geyser sinter at 30-85°C optimum. σ_crit set to 0.8 per Iler 1979 heterogeneous nucleation midpoint (v131 calibration); was 1.0 v101-v130 (engine-matched, pre-literature-grounding).',
};

const MINERAL_GATES_coffinite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 100, T_max: 350, T_optimal: 200,
  fluid_min: { U: 1, SiO2: 60 },
  O2_max: 0.3,                  // reducing
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['coffinite engine v99+', 'Stieff et al. 1955', 'Finch & Murakami 1999'],
  _notes: 'USiO4·nH2O — primary U(IV) silicate (zircon-isostructural). CO3 > 60 routes to uranyl-carbonate.',
};

const MINERAL_GATES_uranophane: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 60, T_optimal: 25,
  fluid_min: { U: 0.5, Ca: 20, SiO2: 30 },
  O2_min: 0.5,
  pH_min: 5.0, pH_max: 8.0,
  surface_energy: 'medium',
  _sources: ['uranophane engine v99+', 'Burns 2005', 'Ginderow 1988'],
  _notes: 'Ca(UO2)2(SiO3)2(OH)2·5H2O — supergene uranyl silicate. Bright SW+LW UV fluorescent.',
};

const MINERAL_GATES_hemimorphite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 50, T_optimal: 27,
  fluid_min: { Zn: 10, SiO2: 200 },
  O2_min: 0.5,
  pH_min: 5.5, pH_max: 8.0,
  surface_energy: 'low',
  _sources: ['hemimorphite engine v98+', 'Hitzman et al. 2003'],
  _notes: 'Zn4Si2O7(OH)2·H2O — supergene "nonsulfide" Zn silicate. CO3 > SiO2 routes to smithsonite.',
};

const MINERAL_GATES_willemite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 50, T_max: 700, T_optimal: 115,
  fluid_min: { Zn: 50, SiO2: 100 },
  O2_min: 0.3,
  pH_min: 6.0, pH_max: 9.0,
  surface_energy: 'medium',
  _sources: ['willemite engine v98+', 'Franklin/Sterling NJ + Skorpion literature'],
  _notes: 'Zn2SiO4 phenakite-group. Bimodal: primary 500-600°C metamorphic OR supergene 50-200°C. Mn fluoresces SW UV green.',
};

const MINERAL_GATES_dioptase: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 120, T_optimal: 50,
  fluid_min: { Cu: 1, SiO2: 10 },
  O2_min: 1.0,
  pH_min: 6.5, pH_max: 8.5,
  surface_energy: 'medium',
  _sources: ['dioptase engine v93+', 'Hauy 1797 (type description)', 'Ribbe/Gibbs/Hamil 1977'],
  _notes: 'CuSiO3·H2O — Tsumeb world reference Cu cyclosilicate. CO3 > 50 + Cl > 5000 suppress.',
};

const MINERAL_GATES_shattuckite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 90, T_optimal: 40,
  fluid_min: { Cu: 5, SiO2: 20 },
  O2_min: 0.5,
  pH_min: 7.5, pH_max: 9.5,
  surface_energy: 'medium',
  _sources: ['shattuckite engine v93+', 'Schaller 1915 (type description Bisbee)'],
  _notes: 'Cu5(SiO3)4(OH)2 — deep azure Cu inosilicate. Higher pH window than dioptase (5:4 Cu/Si ratio needs more OH).',
};

const MINERAL_GATES_chrysoprase: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 80, T_optimal: 32,
  fluid_min: { SiO2: 100, Ni: 50, Mg: 50 },
  O2_min: 0.5,
  pH_min: 7.5, pH_max: 9.5,
  surface_energy: 'low',
  _sources: ['chrysoprase engine v63+'],
  _notes: 'Ni-bearing chalcedony (microfibrous SiO2 + pimelite/willemseite nano-inclusions). Cr > 30 routes to mtorolite.',
};

const MINERAL_GATES_tigers_eye: MineralGates = {
  sigma_crit: 1.0,
  T_min: 20, T_max: 200, T_optimal: 65,
  fluid_min: { SiO2: 200, Fe: 30 },
  O2_min: 0.4,
  pH_min: 5.5, pH_max: 9.5,
  surface_energy: 'low',
  _sources: ['tigers_eye engine v116+', 'Cairncross & Beukes 2013', 'Heaney & Fisher 2003'],
  _notes: 'SiO2 after crocidolite — chalcedony pseudomorph. Gold-brown chatoyant from Fe3+ trace + preserved fiber framework.',
};

const MINERAL_GATES_chrysotile: MineralGates = {
  sigma_crit: 1.0,
  T_min: 50, T_max: 500, T_optimal: 300,
  fluid_min: { Mg: 100, SiO2: 50 },
  pH_min: 8.5, pH_max: 13.0,
  surface_energy: 'low',
  _sources: ['chrysotile engine v114+', 'Wicks & Plant 1979', 'O\'Hanley 1996'],
  _notes: 'Mg3Si2O5(OH)4 — serpentine asbestos. Hyperalkaline serpentinization fluid. Ca > 100 routes to diopside/wollastonite.',
};

const MINERAL_GATES_pectolite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 100, T_max: 350, T_optimal: 215,
  fluid_min: { Na: 30, Ca: 80, SiO2: 100 },
  pH_min: 8.5, pH_max: 12.0,
  surface_energy: 'medium',
  _sources: ['pectolite engine v113+', 'Bernardini 1981 MR 12(5):277', 'Filipos & Frantz 1979'],
  _notes: 'NaCa2Si3O8(OH) — Jeffrey radiating-spray habit. Larimar (Cu) is the Dominican gem variety.',
};

const MINERAL_GATES_wollastonite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 180, T_max: 600, T_optimal: 310,
  fluid_min: { Ca: 80, SiO2: 200 },
  pH_min: 7.5, pH_max: 12.0,
  surface_energy: 'medium',
  _sources: ['wollastonite engine v113+', 'Trommsdorff & Connolly 1996'],
  _notes: 'CaSiO3 — skarn contact metamorphism + rodingite. Acicular-white habit. Mg/Al > 100/50 routes to diopside/grossular.',
};

const MINERAL_GATES_prehnite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 100, T_max: 350, T_optimal: 215,
  fluid_min: { Ca: 60, Al: 8, SiO2: 100 },
  pH_min: 7.5, pH_max: 11.5,
  surface_energy: 'low',
  _sources: ['prehnite engine v113+', 'Liou 1971'],
  _notes: 'Ca2Al2Si3O10(OH)2 — Lake Superior amygdale + Alpine fissure botryoidal pale-green (Fe3+ trace).',
};

const MINERAL_GATES_grossular: MineralGates = {
  sigma_crit: 1.0,
  T_min: 250, T_max: 600, T_optimal: 375,
  fluid_min: { Ca: 80, Al: 15, SiO2: 150 },
  pH_min: 7.0, pH_max: 12.0,
  surface_energy: 'high',
  _sources: ['grossular engine v112+', 'Manning & Bird 1990'],
  _notes: 'Ca3Al2(SiO4)3 — calcic garnet. Cr → tsavorite (green), Mn → hessonite (orange).',
};

const MINERAL_GATES_diopside: MineralGates = {
  sigma_crit: 1.0,
  T_min: 200, T_max: 600, T_optimal: 365,
  fluid_min: { Ca: 60, Mg: 40, SiO2: 150 },
  pH_min: 7.0, pH_max: 12.0,
  surface_energy: 'medium',
  _sources: ['diopside engine v112+', 'Bernardini 1981', 'Cameron & Papike 1981'],
  _notes: 'CaMgSi2O6 — clinopyroxene rodingite/skarn. Cr → chrome-diopside (emerald-green gem).',
};

const MINERAL_GATES_vesuvianite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 180, T_max: 500, T_optimal: 325,
  fluid_min: { Ca: 100, Mg: 30, Al: 10, SiO2: 200 },
  pH_min: 8.5, pH_max: 12.0,
  surface_energy: 'medium',
  _sources: ['vesuvianite engine v111+', 'Allen & Burnham 1992', 'Groat et al. 1992', 'Bernardini 1981 (cyprine)'],
  _notes: 'Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4 — sorosilicate. Cu trace 0.5-5 ppm = cyprine (Jeffrey sky-blue).',
};

const MINERAL_GATES_datolite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 50, T_max: 350, T_optimal: 175,
  fluid_min: { Ca: 60, B: 1, SiO2: 50 },
  pH_min: 7.0, pH_max: 12.0,
  surface_energy: 'medium',
  _sources: ['datolite engine v110+', 'Hawthorne Burns Grice 1996', 'Bornhorst 2017'],
  _notes: 'CaB(SiO4)(OH) — Lake Superior basalt amygdale + Jeffrey rodingite. Gemmy colorless.',
};

const MINERAL_GATES_epidote: MineralGates = {
  sigma_crit: 1.0,
  T_min: 200, T_max: 450, T_optimal: 320,
  fluid_min: { Ca: 80, Al: 4, Fe: 5, SiO2: 100 },
  pH_min: 6.5, pH_max: 9.0,
  O2_min: 0.5,
  surface_energy: 'medium',
  _sources: ['epidote engine v196', 'Anthony et al. Handbook of Mineralogy 2001', 'Armbruster et al. 2006 EJM 18:551', 'Holdaway 1972 CMP 37:307', 'Liou 1973 J.Petrol 14:381'],
  _notes: 'Ca2(Al,Fe3+)3(SiO4)(Si2O7)O(OH) sorosilicate, monoclinic P2_1/m. Fe3+ endmember of clinozoisite-epidote series — needs OXIDIZED fluid (near HM buffer) for the pistachio-green Fe3+; reducing sends Fe to magnetite/actinolite (Fe2+). Al-rich Ca-silicate, alpine-cleft Tormiq/Knappenwand. The O2_min gate is the discriminator. Twin {100} lamellar.',
};

// v205 (2026-06-19): titanite (sphene) CaTiSiO5 — the Aar-massif / Grimsel
// alpine-cleft Ti-nesosilicate, the new mineral that de-orphans PROPOSALS-
// LEDGER §A #13 and joins BOTH the new grimsel cleft AND the existing tormiq
// cleft (where magnetite had stood in for the Ti-Fe oxide stage). Ti is the
// LIMITING (rare) nutrient — most broths carry no Ti, so the Ti floor is the
// discriminator; Ca + Si are abundant in cleft fluids. Redox-INSENSITIVE
// (Ti4+ regardless of fO2 — unlike epidote, NO redox gate; the green vs brown
// variety is a Cr/Fe COLOR dispatch in grow, not a gate). Alpine-cleft titanite
// is the LOW-T hydrothermal end (late on quartz, ≤~400°C), near-end-member
// Ca-Ti-Si, low-F (Göschener Alp: Ca1.00(Ti0.97Fe0.03)Si1.00O4.96 — Handbook of
// Mineralogy 2001; Oberti et al. 1991 EJM 3:777). Magmatic/metamorphic titanite
// runs hotter (690-740°C) — the broad T window covers both, the sweet spot
// favors the cleft band.
const MINERAL_GATES_titanite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 150, T_max: 700, T_optimal: 350,
  fluid_min: { Ca: 40, Ti: 0.5, SiO2: 80 },
  pH_min: 6.0, pH_max: 9.5,
  surface_energy: 'medium',
  _sources: ['titanite engine v205', 'Anthony et al. Handbook of Mineralogy 2001 (titanite sheet — Göschener Alp alpine-cleft analysis)', 'Deer Howie Zussman 1982 RFM v.1A:443-466', 'Oberti Smith Rossi & Caucia 1991 EJM 3:777-792'],
  _notes: 'CaTiSiO5 (CaTiO[SiO4]) nesosilicate, monoclinic P2_1/a. Wedge-shaped (sphenoid) — the classic alpine-cleft habit. Ti is the rare ingredient (the discriminator); Ca+Si abundant. Redox-INSENSITIVE (no redox gate; green=Cr, brown=Fe color dispatch in grow). Alpine-cleft = low-T near-end-member Ca-Ti-Si (late on quartz). Twin {100} contact/penetration.',
};

// v200 (2026-06-17): the Deccan Stage-II zeolite pair. stilbite + heulandite
// are the stilbite/heulandite dehydration couple (Kiseleva, Navrotsky,
// Belitsky & Fursenko 2001, Am.Mineral. 86:448: Ca-stilbite = Ca-heulandite + H2O).
// Stilbite is the COOLER, more-hydrated member (28 H2O, moderate silica);
// heulandite is the WARMER dehydration product (6 H2O, higher silica
// activity). Both: Ca-dominant exchangeable cation, alkaline basalt-buffered
// fluid, low-T zeolite facies, redox-insensitive (no redox-active ion → no
// redox gate, like prehnite). The T-window + silica-activity split is the
// discriminator. fluid_min.Ca is the essential-cation gate; the supersat
// uses (Ca+Na) as the exchangeable budget so stilbite-Na can still fire in
// Na-dominant brines (the Deccan endmember is overwhelmingly the -Ca form).
const MINERAL_GATES_stilbite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 40, T_max: 150, T_optimal: 90,
  fluid_min: { Ca: 60, Al: 4, SiO2: 250 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['stilbite engine v200', 'Coombs et al. 1997 Can.Mineral. 35:1571', 'Kiseleva Navrotsky Belitsky & Fursenko 2001 Am.Mineral. 86:448', 'Ottens et al. 2019 (Deccan paragenesis)'],
  _notes: 'Stilbite-Ca NaCa4(Si27Al9)O72·28H2O — monoclinic C2/m. The cooler, more-hydrated member of the stilbite/heulandite couple; dehydrates to heulandite as T rises. Deccan amygdale Stage-II peach sheaves/bowties (twinned {001} cruciform). Moderate silica (lower-Si than heulandite). Redox-insensitive framework silicate.',
};

const MINERAL_GATES_heulandite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 95, T_max: 210, T_optimal: 150,
  fluid_min: { Ca: 60, Al: 4, SiO2: 400 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['heulandite engine v200', 'Coombs et al. 1997 Can.Mineral. 35:1571 (Si/Al=4.0 boundary)', 'Kiseleva Navrotsky Belitsky & Fursenko 2001 Am.Mineral. 86:448', 'Anthony et al. Handbook of Mineralogy 2001'],
  _notes: 'Heulandite-Ca (Ca,Na)Al2Si7O18·6H2O — monoclinic C2/m. The warmer, dehydrated member (the dehydration product of stilbite). Higher silica activity than stilbite; Si/Al<4 (Si/Al>=4 is clinoptilolite, not wired — the boundary is compositional per Coombs 1997, not modeled as a hard fluid gate because the sim SiO2 ppm is dissolved silica, not framework Si/Al). Coffin-shaped tabular {010}. Twin {100}.',
};

// v201 (2026-06-17): the FIBROUS natrolite-group zeolites — scolecite + mesolite.
// They form EARLIER in the Deccan amygdale paragenesis than the sheet zeolites
// (sequence: ...natrolite -> analcime -> scolecite/mesolite -> stilbite ->
// heulandite -> apophyllite). The natrolite group is LOW-Si (Si/Al~1.5), so in
// nature it forms at lower silica activity than stilbite/heulandite — BUT the
// sim's SiO2 ppm is dissolved silica, not framework Si/Al, and Deccan (a silica-
// rich fluid) is THE world locality for scolecite, so the group is gated on a
// LOW silica FLOOR (150, vs stilbite's 250), NOT a low-Si ceiling. The
// discriminator within the group is the Na/Ca FORK (the Na<->Ca coupled
// substitution): scolecite = Ca endmember (Na/(Na+Ca)<=0.5), mesolite = the
// ordered Na-Ca intermediate (needs BOTH Na and Ca, 0.2<=Na/(Na+Ca)<=0.8;
// natrolite, the Na endmember, is not wired). Both alkaline + redox-insensitive
// (no redox gate). Refs: Anthony et al. Handbook of Mineralogy (scolecite +
// mesolite sheets); Alberti Pongiluppi & Vezzalini 1982 N.Jb.Min.Abh. 143:231
// (natrolite/mesolite/scolecite crystal chemistry); Coombs et al. 1997.
const MINERAL_GATES_scolecite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 40, T_max: 150, T_optimal: 95,
  fluid_min: { Ca: 60, Al: 4, SiO2: 150 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['scolecite engine v201', 'Anthony et al. Handbook of Mineralogy', 'Alberti Pongiluppi & Vezzalini 1982 N.Jb.Min.Abh. 143:231', 'Smith & Walls 1971 Mineral.Mag. 38:72'],
  _notes: 'CaAl2Si3O10·3H2O — monoclinic Cc, the Ca endmember of the fibrous natrolite group. Radiating acicular sprays/puffballs + square prisms. Twin {100} (axis [001]) near-ubiquitous. Deccan (Poona/Nashik) is the premier locality. Na/(Na+Ca)<=0.5 fork suppresses it in Na-rich (mesolite/natrolite) fluid.',
};

const MINERAL_GATES_mesolite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 40, T_max: 140, T_optimal: 90,
  fluid_min: { Ca: 60, Na: 40, Al: 4, SiO2: 150 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['mesolite engine v201', 'Anthony et al. Handbook of Mineralogy', 'Artioli Smith & Pluth 1986 Acta Cryst. C42:937', 'Alberti Pongiluppi & Vezzalini 1982'],
  _notes: 'Na2Ca2Al6Si9O30·8H2O — orthorhombic Fdd2 with a GIANT b-axis (~56.6 A, the ordered 1-natrolite:2-scolecite layer stack). The ordered Na-Ca intermediate — needs BOTH Na and Ca (0.2<=Na/(Na+Ca)<=0.8). Finest hair-like/cottony fibrous tufts. Twin {010}/{100} (secondary vs scolecite). The mixed-cation gate is the discriminator from scolecite (Ca-only) + natrolite (Na-only).',
};

// v202 (2026-06-17): Thomsonite — the EARLIEST, most-aluminous amygdule zeolite.
// NaCa2Al5Si5O20·6H2O, Si/Al~1 (the LOWEST silica of the common amygdule
// zeolites; cf. natrolite-group ~1.5, sheet zeolites ~2.7-3.5). First zeolite in
// the Deccan cavity sequence (smectite -> calcite -> THOMSONITE -> natrolite ->
// analcime -> scolecite/mesolite -> sheets). THE DISCRIMINATOR is SILICA
// ACTIVITY, not Na/Ca: thomsonite is favored at LOW silica (high Al relative to
// Si); the natrolite-group Na/Ca fork does NOT cleanly separate it from mesolite
// (both are Na-Ca; thomsonite is just more-Ca + lower-Si). So the engine gives
// thomsonite a SOFT low-silica preference (boost when Al-rich-relative-to-Si,
// mild attenuation when silica-flooded) over a low floor — NOT a hard low-Si
// ceiling (Deccan + Lake Superior are silica-rich yet thomsonite-bearing; the
// fluid SiO2 ppm is dissolved silica, not framework Si/Al). Ca-dominant, Na
// essential-minor (NaCa2), alkaline, redox-insensitive. Refs: Anthony et al.
// Handbook of Mineralogy (thomsonite-Ca); Wise & Tschernich 1978 Can.Mineral.
// 16:487 (habits); Coombs et al. 1997; Gatta et al. 2010 Am.Mineral. 95:495.
const MINERAL_GATES_thomsonite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 40, T_max: 150, T_optimal: 90,
  fluid_min: { Ca: 60, Na: 20, Al: 4, SiO2: 120 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['thomsonite engine v202', 'Anthony et al. Handbook of Mineralogy (thomsonite-Ca)', 'Wise & Tschernich 1978 Can.Mineral. 16:487', 'Coombs et al. 1997 Can.Mineral. 35:1571'],
  _notes: 'NaCa2Al5Si5O20·6H2O — orthorhombic Pncn (Pbmn disordered), pseudotetragonal. The most-aluminous (Si/Al~1) + earliest amygdule zeolite. Famous "thomsonite eyes" — concentric botryoidal nodules (Lake Superior gem / lintonite green variety). Soft low-silica preference is the discriminator from the higher-Si natrolite group. Twin {110}.',
};

// v203 (2026-06-17): Chabazite — the LATE, intermediate-Si amygdule zeolite.
// Ca2Al2Si4O12·6H2O (chabazite-Ca), Si/Al~2 — intermediate between the fibrous
// group/thomsonite (~1-1.5) and the sheet zeolites stilbite/heulandite
// (~2.7-3.5). A LATE perching phase in the cavity sequence (...stilbite ->
// heulandite -> apophyllite -> CHABAZITE -> mordenite -> late calcite). Cation-
// FLEXIBLE: the extra-framework cation runs Ca > Na > K in frequency, and K is
// NOT required (chabazite-Ca is the basalt-amygdule default; K-dominance is a
// rare special case). So the engine gates on a JOINT (Ca+Na+K) charge budget
// with Ca dominant -> chabazite-Ca; high Na shifts HABIT toward herschelite/
// phacolite, not species failure. Famous for the rhombohedral pseudo-cube (the
// near-90 rhombohedron that mimics a cube) + phacolite penetration twins
// ({0001}). Alkaline, redox-insensitive. Refs: Passaglia & Sheppard 2001 RiMG
// 45:69 (crystal chemistry, Ca-DEC, R=0.67); Coombs et al. 1997 (chabazite-Ca/
// -Na/-K series); Akizuki & Konno 1987 Mineral.Mag. 51:427 (phacolite twinning).
const MINERAL_GATES_chabazite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 40, T_max: 150, T_optimal: 80,
  fluid_min: { Ca: 60, Al: 4, SiO2: 200 },
  pH_min: 7.0, pH_max: 10.5,
  surface_energy: 'low',
  _sources: ['chabazite engine v203', 'Passaglia & Sheppard 2001 RiMG 45:69', 'Coombs et al. 1997 Can.Mineral. 35:1571', 'Calligaris et al. 1982 Zeolites (R-3m)'],
  _notes: 'Ca2Al2Si4O12·6H2O — trigonal R-3m, hex cell a13.83 c15.02. Intermediate Si/Al~2; LATE perching amygdule phase. Cation-flexible Ca>Na>K (K NOT required); chabazite-Ca is the amygdule default. Rhombohedral pseudo-cube + phacolite penetration twins. Looks like calcite but {1011} cleavage is POOR (calcite perfect) + no effervescence + harder (4-5 vs 3) + lighter (2.1 vs 2.71).',
};

Object.assign(VugConditions.prototype, {
  supersaturation_quartz() {
  const eq = this.silica_equilibrium(this.effectiveTemperature);
  if (eq <= 0) return 0;
  let sigma = this.fluid.SiO2 / eq;

  // HF attack on quartz: low pH + high F = dissolution
  if (this.fluid.pH < 4.0 && this.fluid.F > 20) {
    const hf_attack = (4.0 - this.fluid.pH) * (this.fluid.F / 50.0) * 0.3;
    sigma -= hf_attack;
  }

  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'quartz');
  return Math.max(sigma, 0);
},

  supersaturation_feldspar() {
  // K-feldspar (sanidine/orthoclase/microcline polymorphs).
  // v17 reconciliation (May 2026): pre-v17 JS folded Na into a
  // K-or-Na fork using max(K,Na), but albite has its own
  // supersaturation_albite engine — Na fluids should route there,
  // not double-fire here. Python's K-only design has been canonical
  // since the data model split feldspar/albite as separate species.
  // JS now matches Python's K-only structure, with a hard 800°C
  // upper cap (sanidine→melt boundary) added.
  if (this.fluid.K < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  // Hard upper cap — feldspar melts above 800°C.
  if (this.temperature > 800) return 0;
  let sigma = (this.fluid.K / 40.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
  // Feldspars need HIGH temperature — they're igneous/metamorphic
  if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
  // Acid destabilization — kaolinization regime, mirrors grow_feldspar
  // dissolution at pH < 4. KAlSi₃O₈ + H⁺ → kaolinite + K⁺ + SiO₂.
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 2.0;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'feldspar');
  return Math.max(sigma, 0);
},

  supersaturation_apophyllite() {
  if (this.fluid.K < 5 || this.fluid.Ca < 30 || this.fluid.SiO2 < 800 || this.fluid.F < 2) return 0;
  if (this.temperature < 50 || this.temperature > 250) return 0;
  if (this.fluid.pH < 7.0 || this.fluid.pH > 10.0) return 0;
  if (this.pressure > 0.5) return 0;
  const product = (this.fluid.K / 30.0) * (this.fluid.Ca / 100.0) * (this.fluid.SiO2 / 1500.0) * (this.fluid.F / 8.0);
  let T_factor;
  if (this.temperature >= 100 && this.temperature <= 200) T_factor = 1.4;
  else if ((this.temperature >= 80 && this.temperature < 100) || (this.temperature > 200 && this.temperature <= 230)) T_factor = 1.0;
  else T_factor = 0.6;
  const pH_factor = (this.fluid.pH >= 7.5 && this.fluid.pH <= 9.0) ? 1.2 : 0.8;
  let sigma = product * T_factor * pH_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'apophyllite');
  return sigma;
},

  supersaturation_albite() {
  if (this.fluid.Na < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  let sigma = (this.fluid.Na / 35.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
  if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
  // Acid destabilization — albite kaolinizes at pH < 3 (more
  // resistant than K-feldspar). Mirrors grow_albite dissolution gate.
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 2.0;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'albite');
  return Math.max(sigma, 0);
},

  supersaturation_lepidolite() {
  // K(Li,Al)₃(Al,Si)₄O₁₀(F,OH)₂ — trioctahedral lithium mica, the
  // polylithionite–trilithionite solid-solution series. Late-stage
  // pegmatite mineral: forms when residual fluid is enriched in Li
  // + F + K simultaneously, typically AFTER spodumene/early micas
  // have nucleated. Mn²⁺ substitution produces the diagnostic
  // pink-to-purple coloration (Evans & Raftery 1982); the engine
  // does not require Mn but the variety dispatch in grow_lepidolite
  // reads f.Mn / f.Fe for color routing.
  //
  // Gates: K, Li, Al, SiO2, F all required. pH 6.5-8.5 (mildly
  // alkaline pegmatite fluid signature). T optimum 400-500°C
  // (late-magmatic to early-hydrothermal). Per research-lepidolite.md.
  if (this.fluid.K < 10 || this.fluid.Li < 15 || this.fluid.Al < 10
      || this.fluid.SiO2 < 200 || this.fluid.F < 5) return 0;
  if (this.fluid.pH < 6.0 || this.fluid.pH > 9.0) return 0;
  const k_f  = Math.min(this.fluid.K   / 40.0, 1.5);
  const li_f = Math.min(this.fluid.Li  / 25.0, 1.8);
  const al_f = Math.min(this.fluid.Al  / 30.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 500.0, 1.5);
  const f_f  = Math.min(this.fluid.F   / 15.0, 1.5);
  let sigma = k_f * li_f * al_f * si_f * f_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 400 && T <= 500) T_factor = 1.0;
  else if (T >= 350 && T < 400) T_factor = 0.5 + 0.01 * (T - 350);
  else if (T > 500 && T <= 600) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 500));
  else if (T > 600) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.5 - 0.008 * (350 - T));
  sigma *= T_factor;
  // Fe-suppression: high Fe pushes the chemistry toward zinnwaldite
  // (Fe-Li mica), out of the lepidolite stability field.
  if (this.fluid.Fe > 100) sigma *= Math.max(0.3, 1.0 - (this.fluid.Fe - 100) / 500.0);
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'lepidolite');
  return Math.max(sigma, 0);
},

  supersaturation_spodumene() {
  if (this.fluid.Li < 8 || this.fluid.Al < 5 || this.fluid.SiO2 < 40) return 0;
  const li_f = Math.min(this.fluid.Li / 20.0, 2.0);
  const al_f = Math.min(this.fluid.Al / 10.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
  let sigma = li_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 450 && T <= 600) T_factor = 1.0;
  else if (T >= 400 && T < 450) T_factor = 0.5 + 0.01 * (T - 400);
  else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
  else if (T > 700) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.5 - 0.008 * (400 - T));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'spodumene');
  return Math.max(sigma, 0);
},

  supersaturation_chrysocolla() {
  if (this.fluid.Cu < 5 || this.fluid.SiO2 < 20 || !silicateRedoxAvailable(this.fluid, 0.3)) return 0;
  if (this.temperature < 5 || this.temperature > 80) return 0;
  if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
  if (this.fluid.CO3 > this.fluid.SiO2) return 0;
  const cu_f = Math.min(this.fluid.Cu / 30.0, 3.0);
  const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.5);
  const o_f  = silicateRedoxFactor(this.fluid, 1.0, 1.5);
  const T = this.temperature;
  let t_f;
  if (T >= 15 && T <= 40) t_f = 1.0;
  else if (T < 15) t_f = Math.max(0.3, T / 15.0);
  else t_f = Math.max(0.3, 1.0 - (T - 40) / 40.0);
  const pH = this.fluid.pH;
  let ph_f;
  if (pH >= 6.0 && pH <= 7.5) ph_f = 1.0;
  else if (pH < 6.0) ph_f = Math.max(0.4, 1.0 - (6.0 - pH) * 0.6);
  else ph_f = Math.max(0.4, 1.0 - (pH - 7.5) * 0.6);
  let sigma = cu_f * si_f * o_f * t_f * ph_f;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chrysocolla');
  return Math.max(sigma, 0);
},

  _beryl_base_sigma() {
  if (this.fluid.Be < 10 || this.fluid.Al < 6 || this.fluid.SiO2 < 50) return 0;
  const be_f = Math.min(this.fluid.Be / 15.0, 2.5);
  const al_f = Math.min(this.fluid.Al / 12.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 350.0, 1.5);
  let sigma = be_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 350 && T <= 550) T_factor = 1.0;
  else if (T >= 300 && T < 350) T_factor = 0.6 + 0.008 * (T - 300);
  else if (T > 550 && T <= 650) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 550));
  else if (T > 650) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.6 - 0.006 * (300 - T));
  sigma *= T_factor;
  // Activity correction at the family-base helper applies uniformly to
  // beryl/emerald/aquamarine/morganite/heliodor (same Be₃Al₂Si₆O₁₈
  // shared-cation set; chromophore traces don't move I).
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'beryl');
  return Math.max(sigma, 0);
},

  supersaturation_beryl() {
  const f = this.fluid;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;       // emerald priority
  if (f.Mn >= 2.0) return 0;                     // morganite priority
  if (f.Fe >= 15 && f.O2 > 0.5) return 0;        // heliodor priority
  if (f.Fe >= 8) return 0;                       // aquamarine priority
  return this._beryl_base_sigma();
},

  supersaturation_emerald() {
  if (this.fluid.Cr < 0.5 && this.fluid.V < 1.0) return 0;
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const chrom_f = Math.max(
    Math.min(this.fluid.Cr / 1.5, 1.8),
    Math.min(this.fluid.V / 3.0, 1.5)
  );
  return base * chrom_f;
},

  supersaturation_aquamarine() {
  const f = this.fluid;
  if (f.Fe < 8) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  if (f.Mn >= 2.0) return 0;                 // morganite
  if (f.Fe >= 15 && f.O2 > 0.5) return 0;    // heliodor
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const fe_f = Math.min(f.Fe / 12.0, 1.8);
  return base * fe_f;
},

  supersaturation_morganite() {
  const f = this.fluid;
  if (f.Mn < 2.0) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const mn_f = Math.min(f.Mn / 4.0, 1.8);
  return base * mn_f;
},

  supersaturation_heliodor() {
  const f = this.fluid;
  if (f.Fe < 15 || f.O2 <= 0.5) return 0;
  if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
  if (f.Mn >= 2.0) return 0;                 // morganite
  const base = this._beryl_base_sigma();
  if (base <= 0) return 0;
  const fe_f = Math.min(f.Fe / 20.0, 1.6);
  const o2_f = Math.min(f.O2 / 1.0, 1.3);
  return base * fe_f * o2_f;
},

  _corundum_base_sigma() {
  if (this.fluid.Al < 15) return 0;
  if (this.fluid.SiO2 > 50) return 0;  // UPPER gate — defining constraint
  if (this.fluid.pH < 6 || this.fluid.pH > 10) return 0;
  const T = this.temperature;
  if (T < 400 || T > 1000) return 0;
  const al_f = Math.min(this.fluid.Al / 25.0, 2.0);
  let sigma = al_f;
  let T_factor;
  if (T >= 600 && T <= 900) T_factor = 1.0;
  else if (T >= 400 && T < 600) T_factor = 0.4 + 0.003 * (T - 400);
  else if (T > 900 && T <= 1000) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 900));
  else T_factor = 0.2;
  sigma *= T_factor;
  const pH_factor = (this.fluid.pH >= 7 && this.fluid.pH <= 9) ? 1.0 : 0.6;
  sigma *= pH_factor;
  // Activity correction at the family-base helper applies uniformly to
  // corundum/ruby/sapphire (shared Al₂O₃ formula; trace chromophores
  // don't move I).
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'corundum');
  return Math.max(sigma, 0);
},

  supersaturation_tourmaline() {
  if (this.fluid.Na < 3 || this.fluid.B < 6 || this.fluid.Al < 8 || this.fluid.SiO2 < 60) return 0;
  const na_f = Math.min(this.fluid.Na / 20.0, 1.5);
  const b_f  = Math.min(this.fluid.B / 15.0, 2.0);
  const al_f = Math.min(this.fluid.Al / 15.0, 1.5);
  const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
  let sigma = na_f * b_f * al_f * si_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 400 && T <= 600) T_factor = 1.0;
  else if (T >= 350 && T < 400) T_factor = 0.5 + 0.01 * (T - 350);
  else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
  else if (T > 700) T_factor = 0.2;
  else T_factor = Math.max(0.1, 0.5 - 0.008 * (350 - T));
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tourmaline');
  return Math.max(sigma, 0);
},

  supersaturation_topaz() {
  if (this.fluid.F < 20 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
  const al_f = Math.min(this.fluid.Al / 8.0, 2.0);
  const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
  const f_f  = Math.min(this.fluid.F / 25.0, 1.5);
  let sigma = al_f * si_f * f_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 340 && T <= 400) T_factor = 1.0;
  else if (T >= 300 && T < 340) T_factor = 0.6 + 0.01 * (T - 300);
  else if (T > 400 && T <= 500) T_factor = Math.max(0.2, 1.0 - 0.008 * (T - 400));
  else if (T > 500 && T <= 600) T_factor = Math.max(0.1, 0.4 - 0.003 * (T - 500));
  else T_factor = 0.1;
  sigma *= T_factor;
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.4;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'topaz');
  return Math.max(sigma, 0);
},

  // v93 (2026-05-19): dioptase + shattuckite — Cu-silicates of the
  // Tsumeb / Bisbee supergene oxidation zone. Both fire when carbonate
  // has been locally exhausted by prior malachite/azurite precipitation,
  // leaving residual Cu-Si fluid. The discriminator between them is pH +
  // Cu:Si stoichiometry: dioptase (1:1) at pH 6.5-8.0, shattuckite (5:4)
  // at pH 7.5-9.0. Refs: Ribbe/Gibbs/Hamil 1977 (dioptase structure),
  // Evans & Mrose 1977 Am. Min. 62:491 (Cu-silicate family), Schaller 1915
  // (shattuckite type description, Shattuck mine Bisbee), Keller 1977
  // MinRec 8 (Tsumeb paragenesis).
  // v101 (2026-05-19): Opal SiO2·nH2O — amorphous-to-short-range-
  // ordered silica MINERALOID. Three structural varieties (Jones &
  // Segnit 1971 J. Geol. Soc. Aust. 18:57; Langer & Flörke 1974
  // Fortschr. Mineral. 52:17):
  //   opal-A:   amorphous (no Bragg peaks); fresh hot-spring sinter
  //   opal-CT:  disordered cristobalite-tridymite stacking
  //   opal-C:   ordered cristobalite (terminal pre-quartz)
  // Engine fires across the three; T sweet spot < 80°C (geyser sinter
  // regime). High SiO2 supersaturation required (> 200 ppm — Fournier
  // 1977 Geothermics 5:41 amorphous silica solubility curve).
  //
  // NOTE: separate from the existing grow_quartz polymorph dispatch
  // (which can label a quartz crystal mineral_display='opal' at very
  // low T). This standalone opal engine fires nucleation as opal-A
  // directly, with a higher growth rate and the diagenesis-ladder
  // mechanic flagged for future POLYMORPH_DIAGENESIS expansion.
  supersaturation_opal() {
    if (this.fluid.SiO2 < 200) return 0;
    if (this.temperature < 5 || this.temperature > 100) return 0;
    if (this.fluid.pH < 6.5 || this.fluid.pH > 10.0) return 0;
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 3.0);
    let sigma = si_f;
    const T = this.temperature;
    // Sweet spot 30-85°C (geyser sinter regime, Yellowstone /
    // Steamboat Springs / Sulphur Bank / Wairakei NZ)
    if (T >= 30 && T <= 85) sigma *= 1.4;
    else if (T < 30) sigma *= Math.max(0.5, T / 30.0);
    else sigma *= Math.max(0.4, 1.0 - (T - 85) / 30.0);
    // pH sweet spot 7-9 alkaline-silica regime
    const pH = this.fluid.pH;
    if (pH >= 7.0 && pH <= 9.0) sigma *= 1.2;
    else sigma *= Math.max(0.6, 1.0 - Math.abs(pH - 8.0) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'opal');
    return Math.max(sigma, 0);
  },

  // v99 (2026-05-19): Uranyl silicates — coffinite (U(IV), primary,
  // reducing) + uranophane (U(VI), supergene, oxidizing). Opposite
  // sides of the U redox boundary. Both consume U + SiO2 + (Ca for
  // uranophane); discriminator is the Eh/O2 + T regime.
  // Refs: Finch & Murakami 1999 RIMG 38:91-179 (canonical uranyl
  // paragenesis); Burns 2005 Can. Mineral. 43:1839 (uranyl chemistry);
  // Stieff et al. 1955 Science 121:608 (coffinite); Ginderow 1988
  // Acta Cryst. C44:421 (uranophane structure).

  supersaturation_coffinite() {
    // USiO4·nH2O — tetragonal I41/amd (zircon-isostructural). PRIMARY
    // U(IV) silicate; replaces uraninite where pore-water SiO2 rises.
    // Reducing (HS⁻ buffer), 100-300°C, ΣCO2 must be LOW (high
    // carbonate mobilizes U(VI) and dissolves coffinite/uraninite).
    if (this.fluid.U < 1 || this.fluid.SiO2 < 60) return 0;
    if (this.fluid.O2 > 0.3) return 0;  // REDUCING
    if (this.temperature < 100 || this.temperature > 350) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    if (this.fluid.CO3 > 60) return 0;  // high CO3 = uranyl-carbonate, U mobile
    if (this.fluid.P > 1) return 0;     // phosphate → ningyoite U(IV) phosphate
    const u_f = Math.min(this.fluid.U / 5.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 100.0, 2.0);
    let sigma = u_f * si_f;
    const T = this.temperature;
    if (T >= 150 && T <= 250) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 200) / 100);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'coffinite');
    return Math.max(sigma, 0);
  },

  supersaturation_uranophane() {
    // Ca(UO2)2(SiO3)2(OH)2·5H2O — monoclinic P21, BRIGHT yellow-green
    // SW+LW UV fluorescent (uranyl). Forms supergene from oxidation
    // of uraninite/coffinite when Ca + SiO2 + low CO3 available.
    if (this.fluid.U < 0.5 || this.fluid.Ca < 20 || this.fluid.SiO2 < 30) return 0;
    if (this.fluid.O2 < 0.5) return 0;  // OXIDIZING (uranyl UO2^2+)
    if (this.temperature < 5 || this.temperature > 60) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    if (this.fluid.CO3 > 60) return 0;  // high CO3 → liebigie/andersonite
    if (this.fluid.S > 1000) return 0;  // high SO4 → johannite/zippeite
    if (this.fluid.P > 5) return 0;     // P → autunite/torbernite
    const u_f  = Math.min(this.fluid.U / 3.0, 2.5);
    const ca_f = Math.min(this.fluid.Ca / 40.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.0);
    let sigma = u_f * ca_f * si_f;
    const pH = this.fluid.pH;
    if (pH >= 6.0 && pH <= 7.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 6.75) * 0.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uranophane');
    return Math.max(sigma, 0);
  },

  // v98 (2026-05-19): Zn supergene silicates — hemimorphite + willemite.
  // The two Zn silicates of supergene "nonsulfide" Zn deposits
  // (Tsumeb, Skorpion Namibia, Franklin/Sterling NJ). Discriminator:
  //   hemimorphite Zn4Si2O7(OH)2·H2O   <50°C  hydrated  SiO2-rich
  //   willemite    Zn2SiO4              50-200°C anhydrous wider pH
  // Per Hitzman et al. 2003 Econ. Geol. 98:685-714 (nonsulfide Zn
  // synthesis) + Boni & Mondillo 2015 Ore Geol. Rev. 67:208-233.

  supersaturation_hemimorphite() {
    // Zn4Si2O7(OH)2·H2O — orthorhombic Imm2 polar (hemimorphic). Forms
    // strictly low-T (<50°C) in Zn-supergene zones with SiO2 ≥ 200 ppm.
    // The CO3:SiO2 ratio is the discriminator from smithsonite —
    // smithsonite wins above; hemimorphite below.
    if (this.fluid.Zn < 10 || this.fluid.SiO2 < 200) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.5 || this.fluid.pH > 8.0) return 0;
    // CO3 > SiO2 → smithsonite wins
    if (this.fluid.CO3 > this.fluid.SiO2) return 0;
    const zn_f = Math.min(this.fluid.Zn / 30.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 300.0, 2.0);
    let sigma = zn_f * si_f;
    const pH = this.fluid.pH;
    if (pH >= 6.0 && pH <= 7.5) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 6.75) * 0.5);
    const T = this.temperature;
    if (T < 15) sigma *= Math.max(0.5, T / 15.0);
    else if (T > 40) sigma *= Math.max(0.4, 1.0 - (T - 40) / 20.0);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hemimorphite');
    return Math.max(sigma, 0);
  },

  supersaturation_willemite() {
    // Zn2SiO4 — trigonal R-3 phenakite-group. Two formation modes:
    //   PRIMARY/metamorphic 500-600°C (Franklin/Sterling NJ)
    //   SUPERGENE "nonsulfide" 50-200°C (Skorpion Namibia)
    // Engine fires across both regimes; T sweet spot bifurcates.
    if (this.fluid.Zn < 50 || this.fluid.SiO2 < 100) return 0;
    if (this.fluid.O2 < 0.3) return 0;  // less strict than hemimorphite
    // Wide T window covering both modes
    if (this.temperature < 50 || this.temperature > 700) return 0;
    if (this.fluid.pH < 6.0 || this.fluid.pH > 9.0) return 0;
    const zn_f = Math.min(this.fluid.Zn / 80.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 200.0, 2.0);
    let sigma = zn_f * si_f;
    const T = this.temperature;
    // Bimodal T sweet spots:
    //   80-150 supergene (Skorpion); 500-600 primary/metamorphic
    if ((T >= 80 && T <= 150) || (T >= 500 && T <= 600)) sigma *= 1.3;
    else if (T < 80) sigma *= Math.max(0.5, 1.0 - (80 - T) / 40);
    else if (T < 500) sigma *= 0.6;  // intermediate-T gap (rarer)
    else sigma *= Math.max(0.4, 1.0 - (T - 600) / 100);
    // Mn²⁺ activator — willemite famously fluoresces bright green
    // under SW UV. Tracked here for narrative; not gating.
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'willemite');
    return Math.max(sigma, 0);
  },

  supersaturation_dioptase() {
    // CuSiO₃·H₂O — emerald-green cyclosilicate, Tsumeb world reference
    // (type loc. Altyn-Tyube, Kazakhstan; Hauy 1797).
    // Gates: Cu+Si oxidizing low-T, near-neutral, low CO₃ (otherwise
    // malachite/azurite win), low Cl (otherwise CuCl complexes suppress).
    if (this.fluid.Cu < 1 || this.fluid.SiO2 < 10) return 0;
    if (this.fluid.O2 < 1.0) return 0;
    if (this.temperature < 5 || this.temperature > 120) return 0;
    if (this.fluid.pH < 6.5 || this.fluid.pH > 8.5) return 0;
    if (this.fluid.CO3 > 50) return 0;
    if (this.fluid.Cl > 5000) return 0;
    const cu_f = Math.min(this.fluid.Cu / 20.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.0);
    let sigma = cu_f * si_f;
    const pH = this.fluid.pH;
    if (pH >= 7.0 && pH <= 7.5) sigma *= 1.3;
    else if (pH < 7.0) sigma *= Math.max(0.4, 1.0 - (7.0 - pH) * 0.8);
    else sigma *= Math.max(0.4, 1.0 - (pH - 7.5) * 0.8);
    const T = this.temperature;
    if (T < 30) sigma *= Math.max(0.5, T / 30.0);
    else if (T > 80) sigma *= Math.max(0.4, 1.0 - (T - 80) / 60.0);
    // CO3 inhibition (smooth) — competes with malachite past 20 ppm
    if (this.fluid.CO3 > 20) sigma *= Math.max(0.3, 1.0 - (this.fluid.CO3 - 20) / 40.0);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'dioptase');
    return Math.max(sigma, 0);
  },

  supersaturation_shattuckite() {
    // Cu₅(SiO₃)₄(OH)₂ — deep azure-blue inosilicate. Type locality
    // Shattuck mine, Bisbee, Arizona (Schaller 1915). Replaces malachite
    // when CO₂ escapes a vadose vug: 5 Cu₂(CO₃)(OH)₂ + 8 SiO₂ →
    // 2 Cu₅(SiO₃)₄(OH)₂ + 5 CO₂↑ + 3 H₂O. Tighter pH/CO₃ window than
    // dioptase (higher Cu:Si ratio → needs alkaline OH-rich pore fluid).
    if (this.fluid.Cu < 5 || this.fluid.SiO2 < 20) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    if (this.temperature < 5 || this.temperature > 90) return 0;
    if (this.fluid.pH < 7.5 || this.fluid.pH > 9.5) return 0;
    if (this.fluid.CO3 > 30) return 0;
    if (this.fluid.Cl > 1000) return 0;
    if (this.fluid.S > 500 && this.fluid.O2 > 0.5) return 0;  // sulfate-rich → brochantite/antlerite competition
    const cu_f = Math.min(this.fluid.Cu / 30.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.0);
    let sigma = cu_f * si_f;
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 8.5) sigma *= 1.3;
    else if (pH < 8.0) sigma *= Math.max(0.5, 1.0 - (8.0 - pH) * 0.8);
    else sigma *= Math.max(0.5, 1.0 - (pH - 8.5) * 0.8);
    const T = this.temperature;
    if (T < 25) sigma *= Math.max(0.4, T / 25.0);
    else if (T > 65) sigma *= Math.max(0.4, 1.0 - (T - 65) / 30.0);
    // CO3 inhibition (smooth) — sharper than dioptase's
    if (this.fluid.CO3 > 10) sigma *= Math.max(0.3, 1.0 - (this.fluid.CO3 - 10) / 20.0);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'shattuckite');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: Ni-bearing chalcedony — microfibrous SiO2 + nano-inclusion
  // Ni-clay (pimelite/willemseite/kerolite). First chalcedony habit in the
  // sim; substrate for future agate/carnelian/onyx variants. Strict
  // supergene T + alkaline ultramafic groundwater chemistry.
  supersaturation_chrysoprase() {
    if (this.fluid.SiO2 < 100 || this.fluid.Ni < 50 || this.fluid.Mg < 50) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    let sigma = (this.fluid.SiO2 / 300.0) * (this.fluid.Ni / 200.0) * (this.fluid.Mg / 200.0);
    const T = this.temperature;
    if (T > 80) return 0;
    let T_factor = 1.0;
    if (T >= 15 && T <= 50) T_factor = 1.2;
    else if (T < 15) T_factor = 0.4 + 0.05 * T;
    else T_factor = Math.max(0.4, 1.2 - 0.025 * (T - 50));
    sigma *= T_factor;
    // pH window 7.5-9.5 (alkaline serpentinite groundwater)
    if (this.fluid.pH < 7.5) sigma *= Math.max(0.2, 1.0 - 0.4 * (7.5 - this.fluid.pH));
    if (this.fluid.pH > 9.5) sigma *= Math.max(0.2, 1.0 - 0.4 * (this.fluid.pH - 9.5));
    // Quartz competition above 80°C is structural; chrysoprase loses
    // when Si is high and chalcedony fabric can't lock the Ni
    if (this.fluid.Cr > 30) sigma *= 0.5; // mtorolite (Cr-chalcedony) takes over
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chrysoprase');
    return Math.max(sigma, 0);
  },

  // v116 (2026-05-20): Tiger's eye — chalcedony pseudomorph AFTER
  // crocidolite. The famous gold-brown chatoyant gemstone variety;
  // Cu2+-bearing chalcedony fibers preserve the crocidolite-asbestos
  // fiber-bundle morphology, producing the characteristic silky-chatoyant
  // cat's-eye effect. Type-locality Northern Cape South Africa BIF
  // (Hamersley + Mt. Brockman + Asbestos Hills); also Wittenoom WA,
  // Cherokee NC. Three habit variants:
  //   chatoyant_pseudomorph (default) — fully oxidized; gold-brown
  //                                      classic gemstone aesthetic
  //   hawks_eye (partial)             — crocidolite + chalcedony coexist;
  //                                      blue-grey-gold intermediate
  //   tiger_iron (BIF context)        — hematite + jasper + tiger's eye
  //                                      banded; the BIF assemblage rock
  // Geological process: supergene oxidation of crocidolite Fe2+ to Fe3+
  // releases the Na, replaces the silicate fiber framework with
  // microcrystalline SiO2 (chalcedony), with Fe3+ trace giving the
  // gold-brown chatoyant color. Engine reads crocidolite_dissolving
  // substrate; pure-SiO2 alternative path (Fe ≥ 50 + O2 > 0.5 + low T)
  // captures the "tiger iron" BIF context.
  // Refs: Cairncross B & Beukes NJ (2013) "The Northern Cape diamond
  // route — geology + gemstones." Geological Society of South Africa;
  // Heaney PJ & Fisher DM (2003) Am. Min. 88:1-14 "New interpretation
  // of the origin of tiger's-eye."
  supersaturation_tigers_eye() {
    if (this.fluid.SiO2 < 200 || this.fluid.Fe < 30) return 0;
    if (this.temperature < 20 || this.temperature > 200) return 0;
    if (this.fluid.pH < 5.5 || this.fluid.pH > 9.5) return 0;
    // OXIDIZING required — the supergene weathering condition
    if (this.fluid.O2 < 0.4) return 0;
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 80.0, 2.0);
    let sigma = si_f * fe_f;
    // T sweet spot 30-100°C (surface-supergene weathering of BIF)
    const T = this.temperature;
    if (T >= 30 && T <= 100) sigma *= 1.3;
    else if (T < 30) sigma *= Math.max(0.4, T / 30);
    else sigma *= Math.max(0.4, 1.0 - (T - 100) / 100);
    // pH sweet spot 6.5-8.0
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 8.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.25) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tigers_eye');
    return Math.max(sigma, 0);
  },

  // v114 (2026-05-20): Chrysotile Mg3Si2O5(OH)4 — monoclinic serpentine-
  // group phyllosilicate. THE asbestos of commerce. Fibrous habit
  // diagnostic (parallel-bundle silky fibers); platy lizardite form is
  // a related-not-identical sister-mineral (separate engine if added).
  // Forms by serpentinization — hydration of olivine + pyroxene from
  // ultramafic protolith (peridotite/dunite/harzburgite) by alkaline
  // hydrous fluid at T 200-500°C. Jeffrey Mine (Val-des-Sources Quebec
  // — 1881-2011 produced ~40% of world chrysotile-asbestos; town
  // renamed 2020 from Asbestos; Bernardini 1981 MR 12(5):277 puts the
  // commercial chrysotile in geological context). Other major
  // producers: Thetford Mines QC, Cassiar BC, Coalinga CA, Sverdlovsk
  // Russia, Zhetygara Kazakhstan. Asbestos health concerns are real
  // (mesothelioma + asbestosis from prolonged inhalation) but the
  // mineral itself is geologically interesting + the rodingite
  // assemblage at Jeffrey is the cabinet-collector story, not the
  // asbestos. Refs: Anthony Handbook v.IIA Phyllosilicates; Deer Howie
  // Zussman v.1B Sheet Silicates; Wicks FJ & Plant AG (1979) Electron-
  // microprobe + TEM study of serpentine minerals. Can. Min. 17:785;
  // O'Hanley DS (1996) Serpentinites Records of Tectonic + Petrological
  // History. Oxford. RODINGITE + SERPENTINE FRAMEWORK.
  supersaturation_chrysotile() {
    if (this.fluid.Mg < 100 || this.fluid.SiO2 < 50) return 0;
    if (this.temperature < 50 || this.temperature > 500) return 0;
    if (this.fluid.pH < 8.5 || this.fluid.pH > 13.0) return 0;
    const mg_f = Math.min(this.fluid.Mg / 200.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 250.0, 1.5);
    let sigma = mg_f * si_f;
    // T sweet spot 200-400°C (serpentinization window per Wicks & Plant 1979)
    const T = this.temperature;
    if (T >= 200 && T <= 400) sigma *= 1.3;
    else if (T < 200) sigma *= Math.max(0.4, (T - 50) / 150 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 400) / 100);
    // pH sweet spot 9-12 (hyperalkaline serpentinization fluid)
    const pH = this.fluid.pH;
    if (pH >= 9.0 && pH <= 12.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.5) * 0.3);
    // Ca > 100 suppresses chrysotile in favor of diopside/wollastonite
    if (this.fluid.Ca > 100) sigma *= Math.max(0.5, 1.0 - (this.fluid.Ca - 100) / 200);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chrysotile');
    return Math.max(sigma, 0);
  },

  // v113 (2026-05-20): Pectolite NaCa2Si3O8(OH) — triclinic
  // single-chain inosilicate; Na-Ca silicate with the iconic radiating-
  // spray habit. The CABBAGE-PETAL JEFFREY MINE specimen is one of the
  // signature aesthetics; spray aggregates of acicular crystals on
  // grossular/diopside matrix. Three settings: (1) Rodingite metasomatism
  // (Jeffrey + Italian Alps + New Idria; Bernardini 1981 MR 12(5):277
  // documents the spray habit), (2) Late-stage basalt-amygdale fillings
  // (Bay of Fundy NS for blue larimar-similar specimens though larimar
  // proper is Dominican), (3) Larimar Dominican Republic Cu-pectolite
  // gem variety (Filipos & Frantz 1979 — separate mineralogical character
  // from Jeffrey pectolite but same engine). Gates: Na + Ca + Si + low-T
  // alkaline.
  supersaturation_pectolite() {
    if (this.fluid.Na < 30 || this.fluid.Ca < 80 || this.fluid.SiO2 < 100) return 0;
    if (this.temperature < 100 || this.temperature > 350) return 0;
    if (this.fluid.pH < 8.5 || this.fluid.pH > 12.0) return 0;
    const na_f = Math.min(this.fluid.Na / 80.0, 2.0);
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
    let sigma = na_f * ca_f * si_f;
    // T sweet spot 150-280°C (post-vesuvianite Ca-silicate stage)
    const T = this.temperature;
    if (T >= 150 && T <= 280) sigma *= 1.3;
    else if (T < 150) sigma *= Math.max(0.4, (T - 100) / 50 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 280) / 70);
    // pH sweet spot 9.5-11 (alkaline rodingite/skarn)
    const pH = this.fluid.pH;
    if (pH >= 9.5 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.25) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pectolite');
    return Math.max(sigma, 0);
  },

  // v113 (2026-05-20): Wollastonite CaSiO3 — triclinic Ca-silicate
  // (single-chain inosilicate); the simplest Ca-Si stoichiometry of
  // the calc-silicates. Forms in: (1) Skarn contact metamorphism
  // (most common — Crestmore CA, Willsboro NY, Helan Mountains China,
  // industrially mined as a ceramic filler), (2) Rodingite metasomatism
  // (Jeffrey, Bernardini 1981; usually as acicular sprays + radiating
  // aggregates), (3) Carbonatite alteration (rare). Acicular-white
  // habit dominant; can fire at lower T than grossular (180+ vs 250+).
  // Refs: Anthony Handbook v.IIB; Deer Howie Zussman 2A; Trommsdorff
  // & Connolly 1996 Schweiz.Min.Petr.Mitt. 76:135 (wollastonite-
  // metamorphism phase relations).
  supersaturation_wollastonite() {
    if (this.fluid.Ca < 80 || this.fluid.SiO2 < 200) return 0;
    if (this.temperature < 180 || this.temperature > 600) return 0;
    if (this.fluid.pH < 7.5 || this.fluid.pH > 12.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 250.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = ca_f * si_f;
    // T sweet spot 220-400°C
    const T = this.temperature;
    if (T >= 220 && T <= 400) sigma *= 1.3;
    else if (T < 220) sigma *= Math.max(0.4, (T - 180) / 40 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 400) / 200);
    // pH sweet spot 8.5-11
    const pH = this.fluid.pH;
    if (pH >= 8.5 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 9.75) * 0.3);
    // Mg or Al > 100 marginally suppresses — Mg-Al-rich systems favor
    // grossular/diopside over pure wollastonite
    if (this.fluid.Mg > 100) sigma *= Math.max(0.6, 1.0 - (this.fluid.Mg - 100) / 200);
    if (this.fluid.Al > 50) sigma *= Math.max(0.7, 1.0 - (this.fluid.Al - 50) / 100);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'wollastonite');
    return Math.max(sigma, 0);
  },

  // v113 (2026-05-20): Prehnite Ca2Al2Si3O10(OH)2 — orthorhombic
  // Ca-Al phyllosilicate (sheet silicate). The classic LAKE SUPERIOR
  // basalt-amygdale + ICELAND amygdale + ALPINE FISSURE pale-green
  // botryoidal habit. Also major in rodingite (Jeffrey + Italian Alps
  // + Outokumpu). Common substrate for datolite + epidote + zeolite-
  // group minerals. The signature green color is from Fe³⁺ trace at
  // ~5-50 ppm (pure prehnite is colorless-to-white but is rare in
  // practice; Fe-bearing pale-green is the default field aesthetic).
  // Gates: Ca + Al + Si + alkaline-low-T window. Refs: Anthony Handbook
  // v.IIA; Deer Howie Zussman v.1B; Liou JG (1971) Am. Min. 56:507
  // (prehnite stability + zeolite-facies parageneses).
  supersaturation_prehnite() {
    if (this.fluid.Ca < 60 || this.fluid.Al < 8 || this.fluid.SiO2 < 100) return 0;
    if (this.temperature < 100 || this.temperature > 350) return 0;
    if (this.fluid.pH < 7.5 || this.fluid.pH > 11.5) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 25.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
    let sigma = ca_f * al_f * si_f;
    // T sweet spot 150-280°C (basalt amygdale + rodingite contact)
    const T = this.temperature;
    if (T >= 150 && T <= 280) sigma *= 1.3;
    else if (T < 150) sigma *= Math.max(0.4, (T - 100) / 50 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 280) / 70);
    // pH sweet spot 9-11
    const pH = this.fluid.pH;
    if (pH >= 9.0 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.0) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'prehnite');
    return Math.max(sigma, 0);
  },

  // v200 (2026-06-17): Stilbite — the COOLER, more-hydrated member of the
  // Deccan Stage-II zeolite couple. Ca-dominant, alkaline, moderate silica.
  // T sweet spot 60-110°C (stilbite precedes heulandite on a cooling path).
  // Redox-insensitive: no redox gate. See MINERAL_GATES_stilbite.
  supersaturation_stilbite() {
    const g = MINERAL_GATES_stilbite;
    const exch = this.fluid.Ca + this.fluid.Na;   // exchangeable cation budget
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Al < g.fluid_min!.Al
        || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    const ca_f = Math.min(exch / 200.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 12.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 600.0, 1.5);
    let sigma = ca_f * al_f * si_f;
    // T sweet spot 60-110°C (the cool member)
    const T = this.temperature;
    if (T >= 60 && T <= 110) sigma *= 1.3;
    else if (T < 60) sigma *= Math.max(0.4, (T - 40) / 20 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 110) / 40);
    // pH sweet spot 8-9.5 (alkaline basalt groundwater)
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'stilbite');
    return Math.max(sigma, 0);
  },

  // v200 (2026-06-17): Heulandite — the WARMER, dehydrated member (the
  // dehydration product of stilbite). Higher silica activity (SiO2 gate 400
  // vs stilbite's 250); T sweet spot 120-180°C. Ca-dominant, alkaline,
  // redox-insensitive. See MINERAL_GATES_heulandite.
  supersaturation_heulandite() {
    const g = MINERAL_GATES_heulandite;
    const exch = this.fluid.Ca + this.fluid.Na;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Al < g.fluid_min!.Al
        || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    const ca_f = Math.min(exch / 200.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 12.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 700.0, 1.6);   // higher-silica member
    let sigma = ca_f * al_f * si_f;
    // T sweet spot 120-180°C (the warm member — the dehydration product)
    const T = this.temperature;
    if (T >= 120 && T <= 180) sigma *= 1.3;
    else if (T < 120) sigma *= Math.max(0.4, (T - 95) / 25 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 180) / 30);
    // pH sweet spot 8-9.5
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'heulandite');
    return Math.max(sigma, 0);
  },

  // v201 (2026-06-17): Scolecite — the Ca-endmember fibrous natrolite-group
  // zeolite. Na/(Na+Ca)<=0.5 fork (Ca-dominant). Low-Si floor (150), broad
  // low-T window, alkaline, redox-insensitive. See MINERAL_GATES_scolecite.
  supersaturation_scolecite() {
    const g = MINERAL_GATES_scolecite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Al < g.fluid_min!.Al
        || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Na/Ca fork — scolecite is the Ca ENDMEMBER; suppress when Na approaches
    // dominance (that's mesolite -> natrolite territory).
    const naFrac = this.fluid.Na / (this.fluid.Na + this.fluid.Ca);
    if (naFrac > 0.5) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 12.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);   // low-Si zeolite saturates lower
    let sigma = ca_f * al_f * si_f;
    // Ca-purity bonus: the most-Ca fluids favor scolecite most strongly.
    sigma *= Math.max(0.7, 1.3 - naFrac);
    // T sweet spot 70-120 (low-T fibrous zeolite)
    const T = this.temperature;
    if (T >= 70 && T <= 120) sigma *= 1.3;
    else if (T < 70) sigma *= Math.max(0.4, (T - 40) / 30 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 120) / 40);
    // pH sweet spot 8-9.5
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'scolecite');
    return Math.max(sigma, 0);
  },

  // v201 (2026-06-17): Mesolite — the ordered Na-Ca intermediate of the
  // natrolite group. Needs BOTH Na and Ca (0.2<=Na/(Na+Ca)<=0.8). Finest
  // fibrous tufts. See MINERAL_GATES_mesolite.
  supersaturation_mesolite() {
    const g = MINERAL_GATES_mesolite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Na < g.fluid_min!.Na
        || this.fluid.Al < g.fluid_min!.Al || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Na/Ca fork — mesolite is the MIXED member; below 0.2 it's scolecite,
    // above 0.8 it's natrolite (not wired).
    const naFrac = this.fluid.Na / (this.fluid.Na + this.fluid.Ca);
    if (naFrac < 0.2 || naFrac > 0.8) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 1.8);
    const na_f = Math.min(this.fluid.Na / 80.0, 1.8);
    const al_f = Math.min(this.fluid.Al / 12.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = Math.sqrt(ca_f * na_f) * al_f * si_f;   // geometric mean — needs BOTH
    // intermediate-fraction bonus: strongest near the ordered Na2Ca2 (~0.45)
    sigma *= Math.max(0.6, 1.2 - Math.abs(naFrac - 0.45) * 1.5);
    // T sweet spot 70-110
    const T = this.temperature;
    if (T >= 70 && T <= 110) sigma *= 1.3;
    else if (T < 70) sigma *= Math.max(0.4, (T - 40) / 30 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 110) / 30);
    // pH sweet spot 8-9.5
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'mesolite');
    return Math.max(sigma, 0);
  },

  // v202 (2026-06-17): Thomsonite — the earliest, most-aluminous amygdule
  // zeolite. Ca-dominant + Na-essential-minor + high Al; the discriminator from
  // the natrolite group is a SOFT low-silica preference (not Na/Ca, not a hard
  // ceiling). See MINERAL_GATES_thomsonite.
  supersaturation_thomsonite() {
    const g = MINERAL_GATES_thomsonite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Na < g.fluid_min!.Na
        || this.fluid.Al < g.fluid_min!.Al || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Ca-dominant gate (NaCa2): suppress strongly Na-dominant fluids.
    const naFrac = this.fluid.Na / (this.fluid.Na + this.fluid.Ca);
    if (naFrac > 0.6) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 10.0, 2.0);     // most-aluminous zeolite
    // Low-Si zeolite: silica need saturates at the low floor (~200), so beyond
    // it more silica does NOT favor thomsonite — the siAlPref penalty below then
    // cleanly expresses the low-silica preference.
    const si_f = Math.min(this.fluid.SiO2 / 200.0, 1.0);
    let sigma = ca_f * al_f * si_f;
    // LOW-silica preference — thomsonite (Si/Al~1) is favored when Al is plentiful
    // relative to Si; attenuated when the fluid is silica-flooded (the hand-off to
    // the higher-Si zeolites). SOFT, not a hard ceiling — Deccan/Lake Superior are
    // silica-rich yet thomsonite-bearing.
    const siAlPref = Math.max(0.5, Math.min(1.4, 1.6 - this.fluid.SiO2 / 600.0));
    sigma *= siAlPref;
    // T sweet spot 60-110 (low-T, early)
    const T = this.temperature;
    if (T >= 60 && T <= 110) sigma *= 1.3;
    else if (T < 60) sigma *= Math.max(0.4, (T - 40) / 20 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 110) / 40);
    // pH sweet spot 8-9.5
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'thomsonite');
    return Math.max(sigma, 0);
  },

  // v203 (2026-06-17): Chabazite — the late, intermediate-Si amygdule zeolite.
  // Cation-flexible (Ca>Na>K, K NOT required); Ca-dominant chabazite-Ca is the
  // amygdule default. Late/cool T sweet spot. See MINERAL_GATES_chabazite.
  supersaturation_chabazite() {
    const g = MINERAL_GATES_chabazite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Al < g.fluid_min!.Al
        || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Extra-framework cation: Ca > Na > K, K NOT required (Passaglia & Sheppard
    // 2001). Joint (Ca+Na+K) charge budget; Ca-dominant selects chabazite-Ca.
    const exch = this.fluid.Ca + this.fluid.Na + (this.fluid.K || 0);
    const ca_f = Math.min(exch / 220.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 12.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 500.0, 1.5);   // intermediate Si/Al~2
    let sigma = ca_f * al_f * si_f;
    // T sweet spot 50-110 (LATE, cool amygdule phase)
    const T = this.temperature;
    if (T >= 50 && T <= 110) sigma *= 1.3;
    else if (T < 50) sigma *= Math.max(0.4, (T - 40) / 10 * 0.6 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 110) / 40);
    // pH sweet spot 8-9.5
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chabazite');
    return Math.max(sigma, 0);
  },

  // v196 (2026-06-15): Epidote Ca2(Al,Fe3+)3(SiO4)(Si2O7)O(OH) — the Fe3+
  // endmember of the clinozoisite-epidote sorosilicate series, monoclinic
  // P2_1/m. The classic alpine-cleft / greenschist-facies mineral: lustrous
  // pistachio-green prisms striated ∥b, the famous Tormiq (Gilgit-Baltistan,
  // Pakistan) gem swords (Handbook of Mineralogy, Anthony et al. 2001 — which
  // names Tormiq as type-quality, rivaling Knappenwand). THE GATE THAT MATTERS
  // is redox: epidote needs FERRIC iron, so an OXIDIZING fluid near the
  // hematite-magnetite buffer — under reducing conditions Fe partitions into
  // magnetite + actinolite (Fe2+) and you get clinozoisite, not green epidote
  // (Holdaway 1972 CMP 37:307; Liou 1973 J.Petrol 14:381; the Fe3+>=0.5 apfu
  // boundary is Armbruster et al. 2006 EJM 18:551). Ca-Al-Si backbone like
  // prehnite/grossular; the oxidizing + Al-bearing + moderate-T window is the
  // discriminator. More oxidizing = more Fe3+ = deeper-green epidote.
  supersaturation_epidote() {
    const g = MINERAL_GATES_epidote;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Al < g.fluid_min!.Al
        || this.fluid.Fe < g.fluid_min!.Fe || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Fe3+ gate — epidote needs OXIDIZED iron (near HM buffer). Reducing
    // fluid → magnetite + clinozoisite/actinolite instead. THE discriminator.
    if (!oxideRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    const ca_f = Math.min(this.fluid.Ca / 400.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 8.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 20.0, 1.8);
    const si_f = Math.min(this.fluid.SiO2 / 250.0, 1.5);
    let sigma = ca_f * al_f * fe_f * si_f;
    // more oxidizing → more Fe3+ → stronger (deeper-green) epidote vs clinozoisite
    sigma *= Math.max(0.6, Math.min(oxideRedoxFactor(this.fluid, 1.0), 1.6));
    // T sweet spot 250-400°C (alpine-cleft main stage)
    const T = this.temperature;
    if (T >= 250 && T <= 400) sigma *= 1.3;
    else if (T < 250) sigma *= Math.max(0.4, (T - 200) / 50 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 400) / 50);
    // pH sweet spot 6.5-8.5 (near-neutral; coexists with calcite + adularia)
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 8.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'epidote');
    return Math.max(sigma, 0);
  },

  // v205 (2026-06-19): titanite (sphene) CaTiSiO5 — Aar/Grimsel alpine-cleft
  // Ti-nesosilicate (gate MINERAL_GATES_titanite above). Ti is the LIMITING
  // nutrient (rare in broths → the discriminator); Ca + Si are abundant in
  // cleft fluids. No redox gate (Ti4+ is fO2-insensitive). T sweet spot is the
  // alpine-cleft / hydrothermal band 250-450°C (late, low-T on quartz); the
  // wide [150,700] window also admits the hotter magmatic/metamorphic type at
  // attenuated σ. Mass balance debits Ti, so a Ti-trace fluid self-limits to a
  // few crystals — the correct "minor accessory" footprint.
  supersaturation_titanite() {
    const g = MINERAL_GATES_titanite;
    if (this.fluid.Ca < g.fluid_min!.Ca || this.fluid.Ti < g.fluid_min!.Ti
        || this.fluid.SiO2 < g.fluid_min!.SiO2) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    const ti_f = Math.min(this.fluid.Ti / 1.0, 2.5);   // Ti=1 → 1.0; the rare ingredient
    const ca_f = Math.min(this.fluid.Ca / 200.0, 1.8);
    const si_f = Math.min(this.fluid.SiO2 / 200.0, 1.5);
    let sigma = ti_f * ca_f * si_f;
    // T sweet spot: alpine-cleft / hydrothermal titanite 250-450°C (late on quartz)
    const T = this.temperature;
    if (T >= 250 && T <= 450) sigma *= 1.3;
    else if (T < 250) sigma *= Math.max(0.4, (T - 150) / 100 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 450) / 250);
    // pH sweet spot near-neutral (coexists with adularia + calcite + epidote)
    const pH = this.fluid.pH;
    if (pH >= 6.5 && pH <= 8.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 7.5) * 0.25);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'titanite');
    return Math.max(sigma, 0);
  },

  // v112 (2026-05-20): Grossular garnet Ca3Al2(SiO4)3 — Ca-Al endmember
  // of the garnet group (orthosilicate). Cubic Ia-3d. The classic rodingite
  // garnet (Jeffrey Mine + Asbestos Hill NL + Italian Alps Val d'Ala
  // hessonite). Also a major skarn mineral (Vesuvius, Crestmore CA,
  // Sierra de Cruces MX). Trace-cation color dispatch: Cr -> green
  // chromian grossular ("tsavorite" sensu lato), Mn -> hessonite (orange-
  // pink), Fe -> hessonite-leuco intermediate, pure -> colorless/pale-
  // yellow. Standard skarn/rodingite gates: Ca + Al + Si + alkaline,
  // T 250-500°C. Refs: Anthony Handbook v.IA Orthosilicates; Deer Howie
  // Zussman 1.A; Manning & Bird 1990 J.Petrol. 31:1; Bernardini 1981
  // MR 12(5):277 (Jeffrey hessonite + green chromian).
  supersaturation_grossular() {
    if (this.fluid.Ca < 80 || this.fluid.Al < 15 || this.fluid.SiO2 < 150) return 0;
    if (this.temperature < 250 || this.temperature > 600) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 12.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 250.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 35.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 350.0, 1.5);
    let sigma = ca_f * al_f * si_f;
    // T sweet spot 300-450°C (rodingite + skarn prograde)
    const T = this.temperature;
    if (T >= 300 && T <= 450) sigma *= 1.3;
    else if (T < 300) sigma *= Math.max(0.4, (T - 250) / 50 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 450) / 150);
    // pH sweet spot 9-11 (alkaline calc-silicate regime)
    const pH = this.fluid.pH;
    if (pH >= 9.0 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.0) * 0.25);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'grossular');
    return Math.max(sigma, 0);
  },

  // v112 (2026-05-20): Diopside CaMgSi2O6 — Ca-Mg endmember of the
  // clinopyroxene group (single-chain inosilicate). Monoclinic C2/c.
  // The classic rodingite + skarn pyroxene; chrome-diopside (Cr trace)
  // is the gem-grade variety. Forms in three settings sharing
  // Ca + Mg + Si chemistry: (1) rodingite metasomatism (Jeffrey Mine
  // chrome-diopside per Bernardini 1981 MR 12(5):277; Italian Alps;
  // Outokumpu Finland), (2) contact metamorphism of dolomitic
  // limestone (skarns — Crestmore CA, De Kalb NY, Pakistan), (3)
  // ultramafic-host kimberlite xenoliths (the gemstone source — Tanzania,
  // Russia Yakutia). Trace dispatch: Cr -> chrome-diopside emerald
  // green, Fe -> grey-green-brown, pure -> colorless/white. Refs:
  // Deer Howie Zussman 2A Single-Chain Silicates; Cameron & Papike 1981
  // RIMG 7 Pyroxene Mineralogy; Bernardini 1981 (Jeffrey chrome-diopside).
  supersaturation_diopside() {
    if (this.fluid.Ca < 60 || this.fluid.Mg < 40 || this.fluid.SiO2 < 150) return 0;
    if (this.temperature < 200 || this.temperature > 600) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 12.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const mg_f = Math.min(this.fluid.Mg / 100.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 350.0, 1.5);
    let sigma = ca_f * mg_f * si_f;
    // T sweet spot 280-450°C
    const T = this.temperature;
    if (T >= 280 && T <= 450) sigma *= 1.3;
    else if (T < 280) sigma *= Math.max(0.4, (T - 200) / 80 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 450) / 150);
    // pH sweet spot 9-11 (alkaline rodingite/skarn)
    const pH = this.fluid.pH;
    if (pH >= 9.0 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.0) * 0.25);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'diopside');
    return Math.max(sigma, 0);
  },

  // v111 (2026-05-20): Vesuvianite Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4
  // (also called idocrase). Tetragonal P4/nnc Ca-Mg-Al sorosilicate
  // (Allen FM & Burnham CW 1992 Am. Min. 77:268; Groat LA, Hawthorne FC,
  // Ercit TS 1992 Can. Min. 30:19 vesuvianite crystal chemistry).
  // Forms in three settings, all sharing high-Ca + Mg-or-Al + Si chemistry
  // + alkaline conditions:
  //   1. Rodingite metasomatism (Jeffrey Mine Quebec, Italian Alps Val
  //      di Fassa, New Idria CA, Cassiar BC) — Bernardini 1981 MR
  //      12(5):277. The Jeffrey aesthetic — cyprine variety (Cu-bearing
  //      sky-to-deep-blue) is the world reference material.
  //   2. Contact metamorphism of impure limestone (skarns —
  //      Vesuvius Italy type locality 1795; Crestmore CA; Tellemark
  //      Norway). Brown-to-green-to-yellow varieties.
  //   3. Carbonatite-syenite alteration zones (Kovdor Russia,
  //      Magnet Cove AR). Rare; brown-yellow varieties.
  // Cyprine = Cu-bearing sky-blue vesuvianite. Cu²⁺-O charge transfer
  // analogous to dioptase + turquoise blue mechanism. Cu trace 0.5-5 ppm
  // gives the diagnostic Jeffrey color; > 5 ppm drives deeper blue end-
  // member (the most-prized cabinet material — Bernardini 1981 figs
  // 12-15).
  supersaturation_vesuvianite() {
    if (this.fluid.Ca < 100 || this.fluid.Mg < 30 || this.fluid.Al < 10 || this.fluid.SiO2 < 200) return 0;
    if (this.temperature < 180 || this.temperature > 500) return 0;
    if (this.fluid.pH < 8.5 || this.fluid.pH > 12.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 300.0, 2.0);
    const mg_f = Math.min(this.fluid.Mg / 80.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 30.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = ca_f * mg_f * al_f * si_f;
    // T sweet spot 250-400°C (rodingite + skarn both)
    const T = this.temperature;
    if (T >= 250 && T <= 400) sigma *= 1.3;
    else if (T < 250) sigma *= Math.max(0.4, (T - 180) / 70 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 400) / 100);
    // pH sweet spot 9.5-11.5 (rodingite hyperalkaline)
    const pH = this.fluid.pH;
    if (pH >= 9.5 && pH <= 11.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 10.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'vesuvianite');
    return Math.max(sigma, 0);
  },

  // v110 (2026-05-20): Datolite CaB(SiO4)(OH) — calcium boronosilicate
  // (sorosilicate with B replacing Si in one tetrahedral site;
  // Hawthorne FC, Burns PC, Grice JD 1996 Can. Min. 34:1255). Low-T
  // hydrothermal vug filling in two distinct settings:
  //   1. Basaltic amygdales (Lake Superior native-copper district,
  //      Keweenaw Peninsula MI/Isle Royale; Butler & Burbank 1929
  //      USGS PP 144; Bornhorst 2017 GSA Mem 213). Gemmy colorless
  //      to pale-yellow crystals with prehnite + calcite + native
  //      copper. T ~100-200°C, pH 7-9 (basalt amygdale alkaline).
  //   2. Rodingite metasomatic contacts (Jeffrey Mine Quebec
  //      Bernardini 1981 MR 12(5):277; Italian Alps Val Malenco;
  //      New Idria CA; Coleman 1977 Springer ophiolite framework).
  //      Gemmy colorless crystals with vesuvianite + grossular +
  //      prehnite + pectolite. T ~100-300°C, pH 10-12 (serpentinite-
  //      driven hyperalkaline fluid).
  // Wide alkaline tolerance (pH 7-12) reflects the two settings;
  // T window 50-350°C bounded below by precipitation kinetics and
  // above by datolite breakdown to wollastonite + boric acid.
  // Anthony Handbook v.IV silicates is the standard reference;
  // Bernardini 1981 is Jeffrey-specific.
  supersaturation_datolite() {
    if (this.fluid.Ca < 60 || this.fluid.B < 1 || this.fluid.SiO2 < 50) return 0;
    if (this.temperature < 50 || this.temperature > 350) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 12.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const b_f  = Math.min(this.fluid.B / 5.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 200.0, 1.5);
    let sigma = ca_f * b_f * si_f;
    // T sweet spot 100-250°C (both Lake Superior + Jeffrey regimes)
    const T = this.temperature;
    if (T >= 100 && T <= 250) sigma *= 1.3;
    else if (T < 100) sigma *= Math.max(0.4, T / 100.0);
    else sigma *= Math.max(0.4, 1.0 - (T - 250) / 100.0);
    // pH sweet spot 8-11 (alkaline)
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 9.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'datolite');
    return Math.max(sigma, 0);
  },
});
