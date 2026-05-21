// ============================================================
// js/37-supersat-oxide.ts — supersaturation methods for oxide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/oxide.py. Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR. v127 mineral-gates exports added.

// ---- Oxide MINERAL_GATES exports ----
// Note: corundum/ruby/sapphire nucleate via js/89-nucleation-silicate.ts
// (corundum-family-candidates loop with priority ruby > sapphire > corundum)

const MINERAL_GATES_cassiterite: MineralGates = {
  sigma_crit: 1.2,
  T_min: 200, T_max: 700, T_optimal: 525,
  fluid_min: { Sn: 20 },
  pH_min: 1.5, pH_max: 8.0,
  surface_energy: 'high',
  _sources: ['cassiterite engine v89+', 'research-cassiterite.md', 'Williamson 2010', 'Förster 1992'],
  _notes: 'SnO2 tetragonal. Pegmatite/greisen/hydrothermal across 200-700°C. F enhances σ (greisen mechanism). High Ca+Mg suppresses Sn mobility.',
};

const MINERAL_GATES_hematite: MineralGates = {
  sigma_crit: 1.2,
  T_optimal: 200,
  fluid_min: { Fe: 20 },
  O2_min: 0.5,
  pH_min: 3.5,                  // attenuation below; effectively gated
  surface_energy: 'high',
  _sources: ['hematite engine v17+'],
  _notes: 'Fe2O3 ubiquitous oxide. Exponential T-attenuation built in. Substrate preference for active quartz.',
};

const MINERAL_GATES_uraninite: MineralGates = {
  sigma_crit: 1.5,
  T_optimal: 250,
  fluid_min: { U: 5 },
  O2_max: 0.3,                  // anoxic required (reducing)
  surface_energy: 'medium',
  _sources: ['uraninite engine v12+', 'research-uraninite.md'],
  _notes: 'UO2 pegmatitic + reducing. T > 200 boosts σ by 1.3×. Anoxic gate distinguishes from oxidized uranyl phases.',
};

const MINERAL_GATES_magnetite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 100, T_max: 800, T_optimal: 450,
  fluid_min: { Fe: 25 },
  O2_min: 0.1, O2_max: 1.0,     // redox window (Fe2+/Fe3+ both required)
  pH_min: 2.5,
  surface_energy: 'high',
  _sources: ['magnetite engine v17+'],
  _notes: 'Fe3O4 mixed-valence spinel. T sweet spot 300-600°C (skarn/magmatic).',
};

const MINERAL_GATES_cuprite: MineralGates = {
  sigma_crit: 1.2,
  T_optimal: 30,
  fluid_min: { Cu: 20 },
  O2_min: 0.3, O2_max: 1.2,     // window (Cu1+/Cu2+ both needed)
  pH_min: 3.5,
  surface_energy: 'medium',
  _sources: ['cuprite engine v17+'],
  _notes: 'Cu2O — mixed-valence Cu oxide, supergene-zone signature on dissolving native_copper / chalcocite.',
};

const MINERAL_GATES_corundum: MineralGates = {
  sigma_crit: 1.3,
  T_optimal: 700,
  surface_energy: 'very_high',
  _sources: ['corundum-family nucleation js/89-nucleation-silicate:177-181', 'research-corundum.md'],
  _notes: 'α-Al2O3. Fires only when neither Cr (ruby) nor Fe (sapphire) chromophores active. Nucleates via shared _corundum_base_sigma helper.',
};

const MINERAL_GATES_ruby: MineralGates = {
  sigma_crit: 1.3,
  T_optimal: 700,
  fluid_min: { Cr: 2.0 },
  surface_energy: 'very_high',
  _sources: ['corundum-family nucleation js/89-nucleation-silicate:178', 'stale-mineral retune 2026-05'],
  _notes: 'Cr-bearing corundum. Priority over sapphire + corundum (array order in nucleation loop). σ_crit dropped 1.5→1.3 in stale retune to match formula σ ceiling.',
};

const MINERAL_GATES_sapphire: MineralGates = {
  sigma_crit: 1.4,
  T_optimal: 700,
  fluid_min: { Fe: 5 },
  surface_energy: 'very_high',
  _sources: ['corundum-family nucleation js/89-nucleation-silicate:179'],
  _notes: 'Fe-Ti-bearing corundum. Ruby (Cr ≥ 2.0) overrides. Higher σ_crit than ruby/corundum.',
};

const MINERAL_GATES_rutile: MineralGates = {
  sigma_crit: 1.3,
  T_min: 200, T_max: 1000, T_optimal: 500,
  fluid_min: { Ti: 25 },
  surface_energy: 'high',
  _sources: ['rutile engine v63+'],
  _notes: 'TiO2 — strong substrate preference for active quartz (rutilated quartz / Venus hair). Inert otherwise. Titanite competes when Ca+SiO2 high.',
};

const MINERAL_GATES_chromite: MineralGates = {
  sigma_crit: 1.4,
  T_min: 800, T_max: 1500, T_optimal: 1300,
  fluid_min: { Fe: 100, Cr: 30 },
  O2_max: 1.0,
  surface_energy: 'very_high',
  _sources: ['chromite engine v63+'],
  _notes: 'FeCr2O4 spinel. Magmatic-only — requires T > 800°C (no current scenario reaches this). Engine stays dormant until layered-mafic intrusion lands.',
};

const MINERAL_GATES_pyrolusite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 5, T_max: 250, T_optimal: 25,
  fluid_min: { Mn: 0.2 },
  O2_min: 0.5,                  // oxidizing required (highest Eh Mn field)
  pH_min: 5.5, pH_max: 9.5,
  surface_energy: 'medium',
  _sources: ['pyrolusite engine v102+', 'Hem 1963', 'Potter & Rossman 1979', 'Birkner & Navrotsky 2017'],
  _notes: 'β-MnO2 supergene Mn(IV). Mode A 5-40°C continental weathering / Mode B 100-200°C late-stage hydrothermal. Ba/K/Pb tunnel-cations + Fe > 2×Mn suppress.',
};

const MINERAL_GATES_brucite: MineralGates = {
  sigma_crit: 1.0,
  T_min: 30, T_max: 450, T_optimal: 200,
  fluid_min: { Mg: 100 },
  pH_min: 9.5, pH_max: 13.5,    // hyperalkaline only
  surface_energy: 'low',
  _sources: ['brucite engine v114+', 'O\'Hanley 1996', 'Schramke et al. 1982'],
  _notes: 'Mg(OH)2 serpentinization byproduct. CO3 > 50 routes to magnesite/hydromagnesite. Strict hyperalkaline pH 9.5-13.5.',
};

Object.assign(VugConditions.prototype, {
  supersaturation_cassiterite() {
  // SnO₂ — tetragonal tin dioxide, the primary tin ore. Per
  // research-cassiterite.md (boss canonical 2026-05). Sn⁴⁺ only; fully
  // oxidized, no redox transitions; inert under any geological
  // conditions (melts at 1630°C, doesn't dissolve, doesn't decompose).
  //
  // Three formation environments per research §Temperature Window:
  //   pegmatitic   400-700°C (Erzgebirge, Cornwall, San Diego County)
  //   hydrothermal 300-500°C (Bolivia tin belt, Cornwall greisen veins)
  //   greisen      200-400°C (Cornwall stannite zones, Malaysia placers)
  // The engine spans T 200-700 with optimal 450-600°C and a soft
  // T_factor band — habit dispatch (in grow_cassiterite) picks
  // prismatic_dipyramid / equant_octahedral / botryoidal_wood_tin from
  // the same engine output based on the local T.
  //
  // Gates per research:
  //   Sn >= 50 ppm for nucleation; growth tolerates Sn >= 10 ppm
  //   pH 2-5 (acidic to mildly acidic)
  //   Eh oxidizing (Sn²⁺ → Sn⁴⁺ required)
  //   O2 high (>= 20 ppm) — the oxideRedoxAvailable proxy
  //
  // Trace handling: Fe (10-1000 ppm) darkens; Nb/Ta coupled
  // substitution. Inhibitors: high Ca, Mg suppress Sn mobility per
  // research §Inhibitors (soft scaling, not hard block — Sn fluid is
  // unusual enough that the engine should fire reliably when present).
  // Redox handling note: research-cassiterite.md cites "oxidizing"
  // conditions, but the geological record contradicts the literal
  // reading — Erzgebirge / Cornwall greisen cassiterite forms from
  // F-rich REDUCING brines (Förster 1992, Williamson 2010). The
  // simulator's other pegmatite engines (feldspar/beryl/spodumene/
  // tourmaline/topaz) all fire in O2 < 0.3 fluids. The "oxidation"
  // research calls out happens at the wallrock interface, not in
  // bulk fluid. Engine uses no O2 gate; Sn precipitates from the
  // F-rich brine regardless of bulk redox state. Pegmatite-style
  // reducing fluid still drives Sn → SnO₂ via the rxn
  //   SnF₆²⁻ + 2 H₂O → SnO₂ + 4 H⁺ + 6 F⁻
  // (Williamson 2010 §Fluid Chemistry — F-complex destabilization
  // at high pH or upon dilution; not redox-controlled).
  const gcas = MINERAL_GATES_cassiterite;
  if (this.fluid.Sn < gcas.fluid_min!.Sn) return 0;
  if (this.fluid.pH < gcas.pH_min! || this.fluid.pH > gcas.pH_max!) return 0;
  if (this.temperature < gcas.T_min! || this.temperature > gcas.T_max!) return 0;
  const sn_f = Math.min(this.fluid.Sn / 60.0, 3.0);
  // F enhances sigma (F-complex precipitation is the documented
  // greisen mechanism). Cap at 2x to keep the engine well-behaved.
  const f_f = 1.0 + Math.min(this.fluid.F / 30.0, 1.0);
  let sigma = sn_f * f_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 450 && T <= 600) T_factor = 1.0;             // pegmatitic core
  else if (T >= 300 && T < 450) T_factor = 0.7 + 0.002 * (T - 300);  // hydrothermal
  else if (T >= 200 && T < 300) T_factor = 0.4 + 0.003 * (T - 200);  // greisen
  else if (T > 600 && T <= 700) T_factor = Math.max(0.5, 1.0 - 0.005 * (T - 600));
  else T_factor = 0.2;
  sigma *= T_factor;
  // Note: pH window is binary 1.5-8.0 above (no soft scaling).
  // Cassiterite is documented across pH 2-8 in real pegmatite-greisen
  // fluids; the research's "2-5 optimal" is a sweet-spot, not an
  // absolute. Removed the pH-soft-suppression branch during v89
  // calibration — it kept schneeberg sigma below the 1.2 threshold
  // when pH=6.5 (initial pegmatite-phase neutral fluid). Real
  // schneeberg cassiterite forms at exactly that pH per Förster 1992;
  // the engine now matches.
  // Soft Ca + Mg inhibition (research: "High Ca, Mg suppress Sn mobility").
  // The simulator's Sn is a single ppm pool; high Ca + Mg is the proxy for
  // "carbonate-buffered fluid where Sn precipitates early as colloidal
  // SnO₂·xH₂O and doesn't reach the vein cavity". Scales sigma down
  // when both Ca + Mg are high; pegmatite fluids are typically Ca-poor
  // so this doesn't fire in the canonical scenarios.
  if (this.fluid.Ca > 200 && this.fluid.Mg > 50) {
    sigma *= Math.max(0.4, 1.0 - (this.fluid.Ca - 200) / 800 - (this.fluid.Mg - 50) / 400);
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cassiterite');
  return Math.max(sigma, 0);
},

  supersaturation_hematite() {
  const g = MINERAL_GATES_hematite;
  if (this.fluid.Fe < g.fluid_min!.Fe || !oxideRedoxAvailable(this.fluid, g.O2_min!)) return 0;
  let sigma = (this.fluid.Fe / 100.0) * oxideRedoxFactor(this.fluid, 1.0) * Math.exp(-0.002 * this.temperature);
  if (this.fluid.pH < 3.5) {
    sigma -= (3.5 - this.fluid.pH) * 0.3;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hematite');
  return Math.max(sigma, 0);
},

  supersaturation_uraninite() {
  // Reconciled to Python canonical (v12, May 2026). Pre-v12 JS used a
  // T-only formula with no O2 gate — uraninite would form even in
  // oxidizing conditions, contradicting research-uraninite.md.
  // Now: needs reducing + U + (slight high-T preference).
  const g = MINERAL_GATES_uraninite;
  if (this.fluid.U < g.fluid_min!.U || !oxideRedoxAnoxic(this.fluid, g.O2_max!)) return 0;
  let sigma = (this.fluid.U / 20.0) * oxideRedoxAnoxicFactor(this.fluid, 0.5);
  if (this.temperature > 200) sigma *= 1.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uraninite');
  return Math.max(sigma, 0);
},

  supersaturation_magnetite() {
  const g = MINERAL_GATES_magnetite;
  if (this.fluid.Fe < g.fluid_min!.Fe || !oxideRedoxWindow(this.fluid, g.O2_min!, g.O2_max!)) return 0;
  const fe_f = Math.min(this.fluid.Fe / 60.0, 2.0);
  const o_f = oxideRedoxTent(this.fluid, 0.4, 1.5, 0.4);
  let sigma = fe_f * o_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 300 && T <= 600) T_factor = 1.0;
  else if (T >= 100 && T < 300) T_factor = 0.5 + 0.0025 * (T - 100);
  else if (T > 600 && T <= 800) T_factor = Math.max(0.4, 1.0 - 0.003 * (T - 600));
  else T_factor = 0.2;
  sigma *= T_factor;
  if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'magnetite');
  return Math.max(sigma, 0);
},

  supersaturation_cuprite() {
  const g = MINERAL_GATES_cuprite;
  if (this.fluid.Cu < g.fluid_min!.Cu || !oxideRedoxWindow(this.fluid, g.O2_min!, g.O2_max!)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
  const o_f = oxideRedoxTent(this.fluid, 0.7, 1.4, 0.3);
  let sigma = cu_f * o_f;
  if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
  if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cuprite');
  return Math.max(sigma, 0);
},

  supersaturation_corundum() {
  const f = this.fluid;
  if (f.Cr >= MINERAL_GATES_ruby.fluid_min!.Cr) return 0;     // ruby priority
  if (f.Fe >= MINERAL_GATES_sapphire.fluid_min!.Fe) return 0; // sapphire priority
  return this._corundum_base_sigma();
},

  supersaturation_ruby() {
  if (this.fluid.Cr < MINERAL_GATES_ruby.fluid_min!.Cr) return 0;
  const base = this._corundum_base_sigma();
  if (base <= 0) return 0;
  const cr_f = Math.min(this.fluid.Cr / 5.0, 2.0);
  return base * cr_f;
},

  supersaturation_sapphire() {
  const f = this.fluid;
  if (f.Cr >= MINERAL_GATES_ruby.fluid_min!.Cr) return 0;  // ruby priority
  if (f.Fe < MINERAL_GATES_sapphire.fluid_min!.Fe) return 0;
  const base = this._corundum_base_sigma();
  if (base <= 0) return 0;
  let chrom_f = Math.min(f.Fe / 15.0, 1.5);
  if (f.Ti >= 0.5) chrom_f *= Math.min(f.Ti / 1.5, 1.3);
  return base * chrom_f;
},

  // v63 brief-19: TiO2 — tetragonal Ti oxide. The 'needle' mineral. Trace
  // Ti is the gating element; chemically inert otherwise (no acid attack,
  // any redox). Inclusion-in-quartz is the iconic habit.
  supersaturation_rutile() {
    const g = MINERAL_GATES_rutile;
    if (this.fluid.Ti < g.fluid_min!.Ti) return 0;
    let sigma = (this.fluid.Ti / 60.0);
    const T = this.temperature;
    if (T < g.T_min! || T > g.T_max!) return 0;
    let T_factor = 1.0;
    if (T >= 300 && T <= 700) T_factor = 1.2;
    else if (T < 300) T_factor = Math.max(0.5, 0.6 + 0.006 * (T - 200));
    else T_factor = Math.max(0.6, 1.2 - 0.002 * (T - 700));
    sigma *= T_factor;
    // Titanite (CaTiSiO5) competes when Ca + SiO2 are both available
    if (this.fluid.Ca > 50 && this.fluid.SiO2 > 200 && T < 700) {
      sigma *= Math.max(0.5, 1.0 - 0.001 * (this.fluid.Ca - 50));
    }
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'rutile');
    return Math.max(sigma, 0);
  },

  // v63 brief-19: FeCr2O4 — magmatic spinel. Atypical vug mineral; included
  // for cataloging completeness. Requires very high T (>1000°C) which no
  // existing scenario delivers — engine stays dormant until a layered-mafic-
  // intrusion scenario lands.
  // v102 (2026-05-19): pyrolusite β-MnO2 — tetragonal rutile-type Mn(IV)
  // oxide. The default Mn4+ supergene phase when (Ba, K, Pb) low AND Fe
  // doesn't dominate. Two formation modes:
  //   A — low-T supergene / lacustrine / bog (95% of natural occurrences).
  //       T 5-40°C, pH 6.5-9.0, strongly oxidizing (Eh +0.4 to +1.0 V at
  //       pH 7). Continental-weathering endmember of the Mn-oxide family.
  //   B — low-T hydrothermal vein (<250°C, late-stage). Replaces manganite
  //       in cooling vugs. Source of the rare prismatic crystals (Platten,
  //       Ilfeld, Ilmenau).
  //
  // Discriminator fork — pyrolusite occupies the HIGH-Eh corner of the
  // Mn4+ field, with cousins claiming the side cases:
  //   romanechite (Ba,H2O)Mn5O10 — Ba > 100 ppm tunnel cation
  //   cryptomelane K(Mn4+,Mn2+)8O16 — K > 50 ppm tunnel cation
  //   coronadite PbMn8O16 — Pb > 30 ppm tunnel cation
  //   hausmannite Mn3O4 — T > 250°C (higher-T spinel-distorted phase)
  //   manganite γ-MnOOH — lower Eh / cooler; dehydrates TO pyrolusite
  //     (polianite pseudomorph) per Champness 1971 mechanism
  //   goethite α-FeOOH — Fe > 2*Mn captures the oxidation budget (Fe
  //     oxidizes at lower Eh per Hem 1963; pyrolusite usually loses
  //     the Fe-Mn supergene competition)
  //
  // Per Potter & Rossman 1979: most "dendritic pyrolusite" in moss agate
  // and limestone is actually cryptomelane/romanechite/birnessite — DO
  // NOT give pyrolusite a dendritic habit variant. Engine encodes only
  // botryoidal/sooty/radiating-fibrous/prismatic habits.
  //
  // Refs: Anthony Handbook v.III pyrolusite; Dana 7th v.I pp.555-561;
  // Potter & Rossman 1979 Am.Min. 64:1219; Birkner & Navrotsky 2017
  // PNAS 114:E1046; Champness 1971 Min.Mag. 38:245; Hem 1963 USGS WSP
  // 1667-A; Dekoninck et al. 2016 Min.Dep. 51:13; Post 1999 PNAS 96:3447.
  supersaturation_pyrolusite() {
    const g = MINERAL_GATES_pyrolusite;
    if (this.fluid.Mn < g.fluid_min!.Mn) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // Oxidizing required — pyrolusite is the highest-Eh Mn field
    // endmember. Use oxideRedoxAvailable like hematite/magnetite/cuprite.
    if (!oxideRedoxAvailable(this.fluid, g.O2_min!)) return 0;
    // Base sigma from Mn budget. Pyrolusite is autocatalytic on
    // existing MnO2 surfaces (Hem 1963); gate is forgiving once it
    // fires; typical supergene Mn 1-10 ppm.
    const mn_f = Math.min(this.fluid.Mn / 4.0, 3.0);
    const o_f = oxideRedoxFactor(this.fluid, 1.0);
    let sigma = mn_f * o_f;
    // T sweet spot — supergene window 15-35°C is mode A. Mode B
    // hydrothermal at 100-200°C is softer but still fires.
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 35) T_factor = 1.2;        // mode A continental weathering
    else if (T > 35 && T <= 80) T_factor = 1.0;    // warm groundwater / bog
    else if (T > 80 && T <= 200) T_factor = 0.7;   // mode B hydrothermal
    else if (T > 200 && T <= 250) T_factor = 0.4;  // approaching hausmannite field
    else if (T < 15) T_factor = Math.max(0.5, 0.5 + 0.05 * (T - 5));
    else T_factor = 0.3;
    sigma *= T_factor;
    // pH sweet spot — Hem 1963 kinetic optimum at pH 8.5 (autocatalysis
    // + ~10x slower below pH 7 in abiotic systems).
    const pH = this.fluid.pH;
    if (pH >= 7.0 && pH <= 9.0) sigma *= 1.15;
    else if (pH < 7.0) sigma *= Math.max(0.5, 1.0 - (7.0 - pH) * 0.3);
    else sigma *= Math.max(0.6, 1.0 - (pH - 9.0) * 0.2);
    // Fe captures the oxidation budget when Fe > 2*Mn (Hem 1963
    // Eh sequence). Goethite/lepidocrocite form first; pyrolusite is
    // residual. The canonical Fe-Mn supergene separation.
    if (this.fluid.Fe > 2 * this.fluid.Mn) {
      sigma *= 0.3;
    }
    // Tunnel-cation discriminators — Ba/K/Pb would divert Mn4+
    // oxidation to romanechite/cryptomelane/coronadite (none wired
    // yet; the gates encode the suppressor so pyrolusite doesn't
    // pretend to capture the full Mn4+ budget at tunnel-cation
    // localities like Imini). Will route correctly once sister
    // Mn-oxide engines land.
    if (this.fluid.Ba > 100) sigma *= 0.5;
    if (this.fluid.K > 50) sigma *= 0.4;
    if (this.fluid.Pb > 30) sigma *= 0.3;
    // Si > 200: favors todorokite + Mn-silicates (research §3)
    if (this.fluid.SiO2 > 200) sigma *= 0.7;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pyrolusite');
    return Math.max(sigma, 0);
  },

  supersaturation_chromite() {
    const g = MINERAL_GATES_chromite;
    if (this.fluid.Fe < g.fluid_min!.Fe || this.fluid.Cr < g.fluid_min!.Cr) return 0;
    if (this.fluid.O2 > g.O2_max!) return 0;
    let sigma = (this.fluid.Fe / 200.0) * (this.fluid.Cr / 80.0);
    const T = this.temperature;
    if (T < g.T_min!) return 0;
    let T_factor = 1.0;
    if (T >= 1200 && T <= 1400) T_factor = 1.3;
    else if (T < 1200) T_factor = Math.max(0.4, 0.5 + 0.0015 * (T - 800));
    else T_factor = Math.max(0.5, 1.3 - 0.002 * (T - 1400));
    sigma *= T_factor;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chromite');
    return Math.max(sigma, 0);
  },

  // v114 (2026-05-20): Brucite Mg(OH)2 — trigonal Mg hydroxide. The
  // SERPENTINIZATION BYPRODUCT — when olivine + pyroxene react with
  // alkaline hydrous fluid to form serpentine minerals (chrysotile/
  // lizardite/antigorite), excess Mg precipitates as brucite. Jeffrey
  // Mine + Italian Alps + Marmara Turkey + Mt. Lewis NV common.
  // Distinct from carbonate-substituted hydromagnesite (Mg-OH-CO3,
  // separate mineral). Tabular hexagonal {0001} habit; "foliated mass"
  // is the common field aesthetic. Hyperalkaline pH (10-13) is the
  // diagnostic — brucite stable only above the magnesite-carbonate
  // stability boundary. Refs: Anthony Handbook v.III; Deer Howie
  // Zussman v.5 Non-Silicates; O'Hanley 1996 Oxford serpentinite
  // framework; Schramke et al. 1982 GCA 46:1581 (brucite stability
  // experiments).
  supersaturation_brucite() {
    const g = MINERAL_GATES_brucite;
    if (this.fluid.Mg < g.fluid_min!.Mg) return 0;
    if (this.temperature < g.T_min! || this.temperature > g.T_max!) return 0;
    if (this.fluid.pH < g.pH_min! || this.fluid.pH > g.pH_max!) return 0;
    // CO3 > 50 suppresses brucite in favor of magnesite/hydromagnesite
    if (this.fluid.CO3 > 50) return 0;
    const mg_f = Math.min(this.fluid.Mg / 200.0, 2.5);
    let sigma = mg_f;
    // T sweet spot 100-300°C (serpentinization window)
    const T = this.temperature;
    if (T >= 100 && T <= 300) sigma *= 1.3;
    else if (T < 100) sigma *= Math.max(0.4, (T - 30) / 70 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 300) / 150);
    // pH sweet spot 10.5-12.5
    const pH = this.fluid.pH;
    if (pH >= 10.5 && pH <= 12.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 11.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'brucite');
    return Math.max(sigma, 0);
  },
});
