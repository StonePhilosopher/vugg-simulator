// ============================================================
// js/37-supersat-oxide.ts — supersaturation methods for oxide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/oxide.py. Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

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
  if (this.fluid.Sn < 20) return 0;
  if (this.fluid.pH < 1.5 || this.fluid.pH > 8.0) return 0;
  if (this.temperature < 200 || this.temperature > 700) return 0;
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
  if (this.fluid.Fe < 20 || !oxideRedoxAvailable(this.fluid, 0.5)) return 0;
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
  if (this.fluid.U < 5 || !oxideRedoxAnoxic(this.fluid, 0.3)) return 0;
  let sigma = (this.fluid.U / 20.0) * oxideRedoxAnoxicFactor(this.fluid, 0.5);
  if (this.temperature > 200) sigma *= 1.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'uraninite');
  return Math.max(sigma, 0);
},

  supersaturation_magnetite() {
  if (this.fluid.Fe < 25 || !oxideRedoxWindow(this.fluid, 0.1, 1.0)) return 0;
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
  if (this.fluid.Cu < 20 || !oxideRedoxWindow(this.fluid, 0.3, 1.2)) return 0;
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
  if (f.Cr >= 2.0) return 0;  // ruby priority
  if (f.Fe >= 5) return 0;    // sapphire priority
  return this._corundum_base_sigma();
},

  supersaturation_ruby() {
  if (this.fluid.Cr < 2.0) return 0;
  const base = this._corundum_base_sigma();
  if (base <= 0) return 0;
  const cr_f = Math.min(this.fluid.Cr / 5.0, 2.0);
  return base * cr_f;
},

  supersaturation_sapphire() {
  const f = this.fluid;
  if (f.Cr >= 2.0) return 0;  // ruby priority
  if (f.Fe < 5) return 0;
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
    if (this.fluid.Ti < 25) return 0;
    let sigma = (this.fluid.Ti / 60.0);
    const T = this.temperature;
    if (T < 200 || T > 1000) return 0;
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
    if (this.fluid.Mn < 0.2) return 0;
    if (this.temperature < 5 || this.temperature > 250) return 0;
    if (this.fluid.pH < 5.5 || this.fluid.pH > 9.5) return 0;
    // Oxidizing required — pyrolusite is the highest-Eh Mn field
    // endmember. Use oxideRedoxAvailable like hematite/magnetite/cuprite.
    if (!oxideRedoxAvailable(this.fluid, 0.5)) return 0;
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
    if (this.fluid.Fe < 100 || this.fluid.Cr < 30) return 0;
    if (this.fluid.O2 > 1.0) return 0;
    let sigma = (this.fluid.Fe / 200.0) * (this.fluid.Cr / 80.0);
    const T = this.temperature;
    if (T < 800) return 0;
    let T_factor = 1.0;
    if (T >= 1200 && T <= 1400) T_factor = 1.3;
    else if (T < 1200) T_factor = Math.max(0.4, 0.5 + 0.0015 * (T - 800));
    else T_factor = Math.max(0.5, 1.3 - 0.002 * (T - 1400));
    sigma *= T_factor;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chromite');
    return Math.max(sigma, 0);
  },
});
