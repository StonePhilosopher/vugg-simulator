// ============================================================
// js/36-supersat-native.ts — supersaturation methods for native minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/native.py. Minerals (7): native_arsenic, native_bismuth, native_copper, native_gold, native_silver, native_sulfur, native_tellurium.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_native_tellurium() {
  if (this.fluid.Te < 0.5) return 0;
  if (this.fluid.Au > 1.0) return 0;
  // Hg not currently tracked; coloradoite gate deferred.
  if (!nativeRedoxAnoxic(this.fluid, 0.5)) return 0;
  // Ag was a hard gate at > 5.0; stale-mineral retune (2026-05) replaced
  // it with a soft suppressor matching the engine's existing Pb / Bi
  // pattern. Why:
  //
  //   1. STRUCTURAL: Path C per-cell chemistry meant hessite's Ag
  //      consumption only debited local cell fluids, not the bulk-view
  //      `conditions.fluid = ring_fluids[equator]` that this σ engine
  //      reads. tools/stale_mineral_probe.mjs showed min Ag = 15.0 ppm
  //      (the scenario's initial value) across 540 (seed × step) pairs.
  //      The hard gate was structurally unreachable.
  //
  //   2. GEOLOGICAL: Cripple Creek's Cresson Vug bonanza pockets show
  //      hessite + native_Te coexistence — native_Te grains as inclusions
  //      WITHIN hessite (Saunders 1991; Spry & Thieben 1996 Mineralium
  //      Deposita 31). The strict 5 ppm gate encoded "Ag fully depleted
  //      before Te overflow" which is the simplified end-of-cascade story;
  //      reality has continuous Ag-Te coexistence as Ag locally drops.
  //
  //   3. CONSISTENT: the engine's other cation suppressors (Pb up to
  //      200 ppm, Bi up to 60 ppm) are soft. Treating Ag identically
  //      (capped at 25 ppm) matches the design pattern. Sister-cascade
  //      engines (calaverite/sylvanite) also use soft factors — see
  //      92b9f37 telluride retune from previous session.
  //
  // Denominator 75 tuned against the Cresson Vug coexistence range:
  // Saunders 2008 fluid inclusion data shows Ag 5-50 ppm in alkalic-Au-Te
  // bonanza pockets where hessite + native_Te coexist. At Ag=15 (scenario
  // initial) ag_suppr ≈ 0.8 — significant but not strangling suppression.
  // At Ag=50 (sylvite-coupled high-Ag regimes) ag_suppr ≈ 0.33 — Te
  // tellurides win cleanly. At Ag=0 (fully cascade-depleted) ag_suppr = 1.0.
  // Hessite's own σ formula (Ag/10 × Te/2) is much more Ag-sensitive than
  // native_Te's; in the firing order, hessite still leads, native_Te
  // emerges in parallel as paragenetically secondary.
  const ag_suppr = Math.max(0.0, 1.0 - this.fluid.Ag / 75.0);
  const te_f = Math.min(this.fluid.Te / 2.0, 3.5);
  const pb_suppr = Math.max(0.5, 1.0 - this.fluid.Pb / 200.0);
  const bi_suppr = Math.max(0.5, 1.0 - this.fluid.Bi / 60.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.8, 0.4);
  let sigma = te_f * ag_suppr * pb_suppr * bi_suppr * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) {
    T_factor = 1.2;
  } else if (T < 100) {
    T_factor = 0.3;
  } else if (T < 150) {
    T_factor = 0.3 + 0.018 * (T - 100);
  } else if (T <= 400) {
    T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 300));
  } else {
    T_factor = 0.2;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_tellurium');
  return Math.max(sigma, 0);
},

  supersaturation_native_sulfur() {
  // Native sulfur (S°) precipitates via synproportionation —
  // H₂S + ½O₂ → S° + H₂O — at the interface where reduced sulfide-
  // bearing fluid meets atmospheric / shallow-groundwater O₂. The
  // engine supports TWO geological modes documented in the
  // literature (v79+):
  //
  //   (1) Acid-sulfate hot-spring mode — Sulphur Bank Mine type.
  //       Hot (60-90°C) acidic (pH 1.8-4.0) springs where H₂S vents
  //       meet the atmosphere. Byproduct H₂SO₄ keeps pH low. White
  //       & Roberson 1962 (USGS PP 432-A). Lit by the sulphur_bank
  //       scenario (v79).
  //
  //   (2) Sedimentary BSR-near-surface mode — Sicilian Solfifera
  //       Series type. Mildly acidic to alkaline (pH 5-6.5)
  //       calcite-buffered Messinian evaporite basins. H₂S generated
  //       at depth by bacterial sulfate reduction of gypsum
  //       (CaSO₄ + 2 CH₂O → CaS + 2 H₂CO₃; the CaS converts to S° as
  //       Pleistocene meteoric O₂ infiltrates the upper meters). Cool
  //       (25-40°C). Ziegenbalg et al. 2010 (Sedimentary Geology);
  //       Manzi et al. 2009 (Sedimentary Geology); Decima & Wezel
  //       1971. Lit by the sicily scenario (v80).
  //
  // The gates and σ formula are unified so both modes fire under
  // the same engine. Pre-v80 the pH cap was `pH > 5 → return 0`,
  // which structurally blocked Sicily (real Solfifera fluid pH
  // measurements run 5.5-6.5 in the active oxidation zone). v80
  // broadens to `pH > 6.5 → return 0` AND replaces the monotonic
  // ph_f with a bimodal one peaked at both regimes.
  if (this.fluid.S < 100) return 0;
  if (!nativeRedoxWindow(this.fluid, 0.1, 0.7)) return 0;
  if (this.fluid.pH > 6.5) return 0;     // v80: was 5; broadened for BSR mode
  const metal_sum = this.fluid.Fe + this.fluid.Cu + this.fluid.Pb + this.fluid.Zn;
  if (metal_sum > 100) return 0;
  const s_f = Math.min(this.fluid.S / 200.0, 4.0);
  const eh_f = nativeRedoxTent(this.fluid, 0.4, 2.0, 0.4);
  // Bimodal pH factor: two regime peaks, valley between them.
  //
  //   ph_acid: peaks at pH 2.5 (Sulphur-Bank acid-sulfate), decay rate
  //            0.30/pH unit. Hits 1.0 at 2.5; 0.7 at 1.5/3.5; 0 at 5.8.
  //   ph_bsr:  peaks at pH 6.0 (Sicilian BSR-near-surface), decay 0.50/pH
  //            unit. Hits 1.0 at 6.0; 0.5 at 5.0/7.0; 0 at 4.0/8.0.
  //
  // Floor at 0.0 (not 0.4 like v79) so the valley between modes truly
  // kills σ — the geological reality is that intermediate-pH (4-5)
  // fluid is the WORST for native_sulfur (too acid for BSR mode, too
  // alkaline for synproportionation efficiency). v79's 0.4 floor was a
  // pre-Sicily artifact from the single-mode formula.
  //
  // For Sulphur Bank (pH 1.8): ph_acid = 0.79, ph_bsr = 0, ph_f = 0.79.
  // For Sicily (pH 6.0):       ph_acid = 0,    ph_bsr = 1.0, ph_f = 1.0.
  // Valley at pH 4.0:           ph_acid = 0.55, ph_bsr = 0.0, ph_f = 0.55.
  const ph = this.fluid.pH;
  const ph_acid = Math.max(0, 1.0 - 0.30 * Math.abs(ph - 2.5));
  const ph_bsr  = Math.max(0, 1.0 - 0.50 * Math.abs(ph - 6.0));
  const ph_f = Math.max(ph_acid, ph_bsr);
  let sigma = s_f * eh_f * ph_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 95) {
    T_factor = 1.2;
  } else if (T < 20) {
    T_factor = 0.6;
  } else if (T <= 119) {
    T_factor = Math.max(0.5, 1.2 - 0.025 * (T - 95));
  } else if (T < 200) {
    T_factor = Math.max(0.3, 0.5 - 0.005 * (T - 119));
  } else {
    T_factor = 0.0;
  }
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_sulfur');
  return Math.max(sigma, 0);
},

  supersaturation_native_arsenic() {
  // 2026-05 cascade-gate audit (Arc 2): both `S > 10` and `Fe > 50` hard
  // gates were structurally unreachable under bulk-view chemistry. Even
  // in schneeberg — the canonical five-element As-Co-Ni-Bi-U vein where
  // native_arsenic is supposed to fire — S stays at 30 ppm (the seeded
  // value, since the σ engine reads the equator ring fluid rather than
  // any local cell where arsenopyrite has consumed S). 480 (3 seeds ×
  // 160 steps) probe samples never saw S drop below 30. Same in porphyry
  // (S=60). Same as the native_tellurium Ag-gate problem documented in
  // HANDOFF-CALIBRATION-AND-COVERAGE.md §12.
  //
  // Fix: keep the lower-bound As gate, drop both hard upper gates, and
  // replace them with continuous suppressor factors (the soft-suppressor
  // pattern established by the native_tellurium retune, 2026-05). At
  // schneeberg (S=30, Fe=40):
  //   s_suppr = max(0, 1 - 30/60) = 0.5
  //   fe_suppr = max(0, 1 - 40/200) = 0.8
  // Combined ≈ 0.4× — significant but not strangling. At porphyry (S=60,
  // Fe=30):
  //   s_suppr = max(0, 1 - 60/60) = 0 → σ goes to zero regardless
  // which preserves the geological direction (porphyry brines too S-rich
  // for native arsenic; arsenopyrite + tetrahedrite consume As-S budget).
  //
  // Geological anchor: Cobalt district arsenide veins (Petruk 1971) and
  // Schneeberg five-element veins (Förster & Tischendorf 1989) document
  // native_arsenic — native_bismuth coexistence in the same paragenetic
  // band as arsenopyrite, in bulk fluids where S is present but
  // partitioned to arsenides locally.
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm. Native
  // arsenic is As⁰ — a reduced form that only forms from As(III)-
  // dominant fluids (Schneeberg five-element-vein chemistry). In
  // supergene-oxidized fluids the As is all As(V); arseniteAvailablePpm
  // correctly returns 0, blocking native_arsenic from inappropriately
  // firing in oxidized scenarios.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (as_iii < 5) return 0;
  if (!nativeRedoxAnoxic(this.fluid, 0.5)) return 0;
  // Tightened from (/30, cap 3.0) to (/15, cap 4.0) (2026-05): native_arsenic
  // is a residual-overflow mineral formed when As dominates the local broth,
  // so the "saturation unit" should sit at the geologically-realistic 15 ppm
  // for arsenide-rich veins (Cobalt district + Schneeberg fluid-inclusion
  // baseline) rather than at the diluted 30 ppm typical-hydrothermal level.
  // Cap bumped 3.0 → 4.0 so schneeberg's As=60 ppm can drive as_f to 4.0
  // and clear σ > 1.0 against the new soft S+Fe suppressors + ~0.8 activity
  // correction (calibration math worked out post-Arc-2 gate softening).
  const as_f = Math.min(as_iii / 15.0, 4.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.8, 0.4);
  // Denominators tuned to schneeberg (S=30 → s_suppr=0.5, Fe=40 →
  // fe_suppr=0.8). Lower floor 0.0 (not 0.4 as the pre-audit code had —
  // a 0.4 floor would re-create the structural problem the gate softening
  // was designed to fix).
  const s_suppr = Math.max(0.0, 1.0 - this.fluid.S / 60.0);
  const fe_suppr = Math.max(0.0, 1.0 - this.fluid.Fe / 200.0);
  let sigma = as_f * red_f * s_suppr * fe_suppr;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) {
    T_factor = 1.2;
  } else if (T < 100) {
    T_factor = 0.3;
  } else if (T < 150) {
    T_factor = 0.3 + 0.018 * (T - 100);
  } else if (T <= 350) {
    T_factor = Math.max(0.5, 1.2 - 0.014 * (T - 300));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_arsenic');
  return Math.max(sigma, 0);
},

  supersaturation_native_silver() {
  // 2026-05 cascade-gate audit Arc 3: same Path C softening pattern as
  // native_arsenic + native_bismuth + native_tellurium. The hard `S > 2.0`
  // upper gate was structurally unreachable in every Ag-bearing scenario —
  // schneeberg (S=30), epithermal_telluride (S=8), bisbee (S=50 — fires
  // only later in the run after sulfides consume S to 0). The pre-existing
  // soft `s_f = max(0.2, 1 - S/4)` had its floor at 0.2 but the hard gate
  // at S>2 meant it never engaged on the S>2 side.
  //
  // Geology: native silver in five-element veins coexists with acanthite
  // (Ag2S) and bismuthinite. Bulk-fluid S=30 ppm with native silver
  // present is the local-vs-bulk Path C story — acanthite consumes S
  // locally near its own crystal cells; native silver forms in the
  // micro-domains where bismuthinite (Bi2S3) scavenged S to become Bi-S
  // and left an S-depleted shell. Bulk-view σ engine reads the equator
  // ring fluid which doesn't see this partitioning. The soft suppressor
  // encodes the probabilistic local-domain availability.
  //
  // Fix: drop hard S>2 gate, soft s_f with denom 50 (calibrated so
  // schneeberg S=30 → s_f=0.4, epithermal_telluride S=8 → s_f=0.84,
  // porphyry S=60 → s_f=0 still gated out). Bump ag_f cap 3.0 → 4.0
  // for the same reason native_arsenic + native_bismuth needed cap bumps —
  // realistic five-element-vein Ag concentrations of 8-15 ppm should drive
  // ag_f past the old cap to clear nuc threshold.
  if (this.fluid.Ag < 1.0) return 0;
  if (!nativeRedoxAnoxic(this.fluid, 0.3)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.0, 4.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 2.5, 0.3);
  const s_f = Math.max(0.0, 1.0 - this.fluid.S / 50.0);
  let sigma = ag_f * red_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 100 && T <= 200) {
    T_factor = 1.2;
  } else if (T < 50) {
    T_factor = 0.4;
  } else if (T < 100) {
    T_factor = 0.4 + 0.016 * (T - 50);
  } else if (T <= 300) {
    T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 200));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_silver');
  return Math.max(sigma, 0);
},

  supersaturation_native_bismuth() {
  // 2026-05 cascade-gate audit (Arc 2): twin treatment to native_arsenic.
  // The `S > 12` hard gate was structurally unreachable in schneeberg
  // (S=30 — the canonical Bi-rich five-element-vein scenario explicitly
  // calls out "native_bismuth secondary phases" in its scenario notes)
  // and porphyry (S=60). 480 probe samples saw σ pinned at 0.0 in
  // schneeberg. Additionally, the `Bi < 15` lower gate didn't match
  // bismuthinite's `Bi < 5` lower gate even though native_bismuth is
  // bismuthinite's paragenetic step-down: a Bi-rich fluid that crosses
  // bismuthinite's threshold should also cross native_bismuth's after
  // local S depletion. Schneeberg seeds Bi=10 — historically a Bi-mining
  // district pre-uranium-era — and was unable to clear either gate.
  //
  // Fix: lower `Bi < 15` to `Bi < 5` (matches bismuthinite — bi_f scaling
  // naturally suppresses low-Bi fluids), drop `S > 12` hard gate, replace
  // the s_mask floor (0.4) with a true 0.0 floor so the soft suppressor
  // can actually go to zero in high-S brines.
  if (this.fluid.Bi < 5 || !nativeRedoxAnoxic(this.fluid, 0.6)) return 0;
  // Tightened from /25 to /15 (2026-05) for the same reason as
  // native_arsenic — native_bismuth is paragenetically a residual phase
  // and the saturation unit should reflect arsenide/bismuth-vein
  // realities (Schneeberg + Cobalt district fluid inclusions). Cap
  // bumped 2.0 → 3.0 to let Bi-rich Schneeberg-style fluids reach σ > 1
  // without forcing artificially high seeds.
  const bi_f = Math.min(this.fluid.Bi / 15.0, 3.0);
  // Denominator 80 (was /50 in initial Arc 2 commit, widened during
  // calibration): at schneeberg S=30 → s_mask=0.625 (moderate suppression
  // matching the "S present but partitioned to arsenide phases locally"
  // geology). At porphyry S=60 → s_mask=0.25 → mostly gated out. At
  // ultra-low-S environments (S<5) → s_mask≈0.94 (essentially passthrough).
  const s_mask = Math.max(0.0, 1.0 - this.fluid.S / 80.0);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = bi_f * s_mask * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 100 && T <= 250) T_factor = 1.0;
  else if (T < 100) T_factor = 0.6;
  else if (T <= 270) T_factor = Math.max(0.3, 1.0 - 0.05 * (T - 250));
  else T_factor = 0.1;
  sigma *= T_factor;
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_bismuth');
  return Math.max(sigma, 0);
},

  supersaturation_native_gold() {
  if (this.fluid.Au < 0.5) return 0;
  const au_f = Math.min(this.fluid.Au / 1.0, 4.0);
  const s_f = Math.max(0.2, 1.0 - this.fluid.S / 200.0);
  let sigma = au_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 400) T_factor = 1.0;
  else if (T < 20) T_factor = 0.5;
  else if (T <= 700) T_factor = Math.max(0.5, 1.0 - 0.001 * (T - 400));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_gold');
  return Math.max(sigma, 0);
},

  supersaturation_native_copper() {
  // 2026-05 cascade-gate audit Arc 3: same softening pattern as
  // native_silver. Hard `S > 30` upper gate was structurally unreachable
  // in any S-rich Cu scenario — schneeberg (S=30 borderline), porphyry
  // (S=60), supergene_oxidation (S=50). bisbee was the only scenario
  // where it fired, and only after sulfide consumption dropped bulk S
  // below the gate (~step 130). Soft s_f at /40 with floor 0.3 already
  // existed but the hard gate at S>30 prevented its high-S branch from
  // ever engaging.
  //
  // Geology: native copper forms in basalt amygdules (Keweenaw, Lake
  // Superior — the classic locality) and Cu-supergene oxidation zones
  // (Bisbee, Tsumeb). Both are S-poor relative to Cu — Keweenaw basalt
  // pore fluid carries no significant S because volcanic Cu was reduced
  // by Fe(II) silicates without sulfide intermediates. Bulk S>30 ppm
  // brines DO inhibit native_copper precipitation (chalcopyrite/bornite/
  // chalcocite preferred), so the gate isn't wrong in spirit — just
  // needs softening for the local-vs-bulk Path C case.
  //
  // Fix: drop hard S>30 gate, soft s_f at /60 (calibrated so bisbee
  // S=50 → s_f=0.17 — still significant suppression but no longer hard
  // zero; schneeberg S=30 → s_f=0.5; porphyry S=60 → s_f=0 still gated).
  // Lower floor 0.3 → 0.0 so the soft factor can actually go to zero
  // in S-saturated brines.
  if (this.fluid.Cu < 50 || !nativeRedoxAnoxic(this.fluid, 0.4)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
  const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 2.0, 0.4);
  const s_f = Math.max(0.0, 1.0 - this.fluid.S / 60.0);
  let sigma = cu_f * red_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 150) T_factor = 1.0;
  else if (T < 20) T_factor = 0.7;
  else if (T <= 300) T_factor = Math.max(0.4, 1.0 - 0.004 * (T - 150));
  else T_factor = 0.2;
  sigma *= T_factor;
  if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'native_copper');
  return Math.max(sigma, 0);
},

  // v114 (2026-05-20): Awaruite (Ni,Fe) — Ni-Fe alloy, ranging from
  // Ni2Fe to Ni3Fe stoichiometry. The serpentinization-driven natural
  // metal — forms when olivine + pyroxene of ultramafic protolith
  // serpentinize under STRONGLY REDUCING + hyperalkaline conditions,
  // releasing Ni and Fe in metallic-alloy form. Found as MICROSCOPIC
  // grains in serpentine + chrysotile matrix (rarely visible without
  // microscopy); larger nuggets at exceptional localities (Cassiar BC
  // 1-2 mm grains; Bou Azzer Morocco; Jeffrey + Italian Alps; New
  // Caledonia placers; Awaroa NZ type locality 1885 — the namesake).
  // Coexists with magnetite + chrysotile + chromite in serpentinite
  // matrix. The Ni in FluidChemistry was already added (pre-v89
  // speculative for millerite + annabergite + pentlandite + chrysoprase
  // coloration); awaruite is the second-class consumer. Refs: Anthony
  // Handbook v.I; Bird DK & Bassett WA (1980) GCA 44:1659 (Fe-Ni alloy
  // stability in serpentinite); Krenn K & Hauzenberger CA (2007) Tonga
  // ophiolite Fe-Ni alloy thermometry; Frost BR (1985) Contrib. Min.
  // Petr. 91:139 (oxygen + sulfur fugacity controls).
  supersaturation_awaruite() {
    // STRICT reducing + Ni-rich + serpentinite-style alkaline gates.
    // Native alloy forms only when both Ni and Fe are mobilized AND O2 is
    // essentially absent.
    if (this.fluid.Ni < 50 || this.fluid.Fe < 20) return 0;
    if (this.temperature < 50 || this.temperature > 500) return 0;
    if (this.fluid.pH < 9.0 || this.fluid.pH > 13.0) return 0;
    if (!nativeRedoxAnoxic(this.fluid, 0.3)) return 0;
    // S > 5 strongly suppresses — sulfide preference (millerite +
    // pentlandite + heazlewoodite take the Ni)
    if (this.fluid.S > 5) return 0;
    const ni_f = Math.min(this.fluid.Ni / 100.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 50.0, 2.0);
    const red_f = nativeRedoxLinearFactor(this.fluid, 1.0, 1.8, 0.5);
    let sigma = ni_f * fe_f * red_f;
    // T sweet spot 200-400°C (serpentinization)
    const T = this.temperature;
    if (T >= 200 && T <= 400) sigma *= 1.3;
    else if (T < 200) sigma *= Math.max(0.4, (T - 50) / 150 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 400) / 100);
    // pH sweet spot 10-12 (hyperalkaline)
    const pH = this.fluid.pH;
    if (pH >= 10.0 && pH <= 12.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 11.0) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'awaruite');
    return Math.max(sigma, 0);
  },
});
