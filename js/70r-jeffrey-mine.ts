// ============================================================
// js/70r-jeffrey-mine.ts — events for Jeffrey Mine (Val-des-Sources)
// ============================================================
// Jeffrey Mine, Val-des-Sources (formerly Asbestos), Quebec, Canada.
// Operated 1881-2011 as one of the world's largest chrysotile-asbestos
// mines; produced ~40% of world chrysotile for most of the 20th
// century. Among MINERAL COLLECTORS, Jeffrey is NOT famous for asbestos
// — it's famous for the RODINGITE assemblage. The open-pit excavation
// exposed hundreds of meters of serpentinized ultramafics + cross-
// cutting mafic dikes that had been metasomatically altered to
// rodingite. Contact zones between dike and serpentinite host produced
// spectacular Ca-Al-Mg silicate cabinet specimens 1880s through 2011.
// The mine closed 2011; town renamed itself in 2020 (Val-des-Sources,
// "Valley of Springs") to step out from under the asbestos-health-
// crisis baggage. The 1949 Quebec Asbestos Strike is a labor-history
// flashpoint; these cultural-historical facts are real but secondary
// to the geological story — the rodingite assemblage IS the cabinet
// story.
//
// TYPE LOCALITY FOR: arguably none of the canonical minerals (awaruite
// is type-Awaroa NZ; cyprine vesuvianite is type-Norway 1799 though
// Jeffrey is the WORLD'S BEST cyprine), but Jeffrey is the world's
// premier locality for cabinet-grade CYPRINE vesuvianite (Bernardini
// 1981 MR 12(5):277 figs 12-15) and one of the top localities for
// rodingite-suite grossular + diopside + pectolite + datolite.
//
// GEOLOGICAL CONTEXT:
//
//   Tectonic setting    Quebec Appalachians, Thetford Mines ophiolite
//                       complex. Ordovician oceanic crust + mantle
//                       obducted during the Taconian Orogeny, ~470 Ma.
//   Host rock           Serpentinite (lizardite + chrysotile +
//                       antigorite + minor olivine + chromite);
//                       protolith was mantle peridotite (harzburgite/
//                       dunite)
//   Mineralization      RODINGITE METASOMATISM — Ca-Al-rich fluid from
//                       serpentinization-driven dehydration reacts
//                       with crosscutting mafic dikes (basaltic to
//                       gabbroic composition). Mafic dike chemistry
//                       (Ca+Al+Si) + serpentinite Mg + alkaline-pH
//                       fluid + low Eh → rodingite (Ca-Al-Mg-Si
//                       calc-silicate suite) replaces the dike
//                       chemistry.
//   T                   ~200-400°C primary alteration (low-grade
//                       metamorphic / metasomatic). Some specimens
//                       formed at higher T early then re-equilibrated
//                       cooler.
//   pH                  HYPERALKALINE 10-12 — serpentinization
//                       produces Ca(OH)2 + Mg(OH)2-rich fluid.
//                       (The discriminator vs. ALL other scenarios
//                       in the catalog — most others run pH 4-8.)
//   Eh                  REDUCING (O2 < 0.3); awaruite stability
//                       requires this.
//   Salinity            Low (1-3 wt% NaCl-eq); metamorphic fluid.
//   Pressure            0.5-2 kbar (mid-crustal obducted ophiolite).
//   Wall composition    'ultramafic' (NEW wall type, v115) — broader
//                       than 'serpentinite'; covers peridotite +
//                       dunite + harzburgite hosts. Future scenarios
//                       at Cassiar BC + New Idria CA + Italian Alps
//                       can reuse.
//
// HEADLINE PARAGENESIS (Bernardini 1981; O'Hanley 1996; Coleman 1977):
//
//   Stage 1 — SERPENTINIZATION ONSET (steps 1-30, T 380→340°C):
//     The protolith (olivine + pyroxene) hydrates to serpentine
//     minerals. Mg + SiO2 released to fluid; pH rises sharply. Reducing
//     conditions establish. Chrysotile + brucite + magnetite + awaruite
//     fire as the serpentinization byproducts. Awaruite stays
//     microscopic in the chrysotile matrix.
//
//   Stage 2 — MAFIC DIKE ALTERATION BEGINS (steps 30-70, T 340→300°C):
//     The mafic dikes (basalt to gabbro composition) are invaded by
//     the alkaline serpentinizing fluid. Ca + Al + Si released from
//     dike plagioclase + clinopyroxene. The rodingite chemistry now
//     in play — grossular + diopside fire as the high-T garnet +
//     clinopyroxene endmember pair. Trace Cr from chromite enables
//     chrome-diopside + chromian grossular varieties.
//
//   Stage 3 — MID-RODINGITE / VESUVIANITE (steps 70-120, T 300→260°C):
//     The trio mineral fires — vesuvianite as the Ca-Mg-Al sorosilicate
//     that defines the rodingite paragenesis. Trace Cu (from background
//     mafic-dike chalcopyrite) enables CYPRINE — the world-reference
//     sky-blue Cu-bearing vesuvianite per Bernardini 1981. This is the
//     headline aesthetic.
//
//   Stage 4 — LATE Ca-SILICATES (steps 120-160, T 260→230°C):
//     Na trace appears (from late-stage albitization of dike feldspar);
//     pectolite spray-radiating habit on grossular substrate fires.
//     Wollastonite acicular sprays. Prehnite pale-green botryoidal
//     (Fe³⁺ trace from continued dike-matrix exchange).
//
//   Stage 5 — TERMINAL DATOLITE (steps 160-200, T 230→200°C):
//     Trace B (from late hydrothermal fluid concentration) drives
//     datolite gemmy_vitreous_terminated on prehnite or wollastonite
//     substrate. This is the final-stage cabinet aesthetic — colorless
//     to pale-yellow gemmy datolite crystals.
//
// PRIMARY REFERENCES:
//   * Bernardini GP (1981) The Jeffrey Mine, Asbestos, Quebec.
//     Mineralogical Record 12(5):277-291. CANONICAL Jeffrey paper.
//   * Hudson RGS (1922) Quebec chrysotile geology.
//   * Coleman RG (1977) Ophiolites: Ancient Oceanic Lithosphere?
//     Springer. RODINGITE + SERPENTINE FRAMEWORK.
//   * Wares R (1987) PhD thesis (McGill or Univ. Sherbrooke), Thetford
//     Mines complex geology.
//   * Wicks FJ & Plant AG (1979) Electron-microprobe + TEM study of
//     serpentine minerals. Canadian Mineralogist 17:785-830.
//   * O'Hanley DS (1996) Serpentinites: Records of Tectonic and
//     Petrological History. Oxford.
//   * Manning CE & Bird DK (1990) Hydrothermal clinopyroxenes from
//     rodingites. Journal of Petrology 31:1-37.

// v123 (2026-05-21) — Jeffrey arc stoichiometry tune.
// Pre-v123, these events used `Math.max(floor, fluid.X - decrement)`
// patterns that HAND-MODELED consumption (because MINERAL_STOICHIOMETRY
// was missing for chrysotile / diopside / grossular / vesuvianite /
// etc., so growth didn't actually debit the fluid). With v123's
// stoichiometry additions, growth correctly debits the fluid AND the
// old hand-modeled decrements double-debit. Tune: flip all consumption-
// pattern lines to RELEASE-pattern lines; bump release magnitudes to
// counter the now-active stoichiometry debits across 35-step inter-
// event intervals. Caps lifted where mass balance creates more
// headroom-pressure than before.

function event_jeffrey_mine_serpentinization_onset(c) {
  // Stage 1 (step 25): Olivine + pyroxene hydration releases Mg + SiO2
  // to fluid; the serpentinization reaction itself.
  //   3 Mg2SiO4 + SiO2 + 4 H2O → 2 Mg3Si2O5(OH)4
  //   (forsterite + silica + water → chrysotile-serpentine)
  // pH rises sharply (Ca(OH)2 + Mg(OH)2 production). O2 drops to anoxic.
  // Ni + Fe released as serpentinization redistributes Ni from olivine.
  //
  // v123 tune: Mg release 30 → 120, cap 280 → 400. SiO2 release 80 → 150,
  // cap 280 → 400. Chrysotile + brucite + tremolite all debit Mg now;
  // generous release keeps chrysotile gate (Mg >= 100) cleared through
  // step 60.
  c.temperature = Math.max(340, c.temperature - 40);
  c.fluid.pH = Math.min(11.2, c.fluid.pH + 0.7);
  c.fluid.Mg = Math.min(400, c.fluid.Mg + 120);
  c.fluid.SiO2 = Math.min(400, c.fluid.SiO2 + 150);
  c.fluid.O2 = Math.max(0.05, c.fluid.O2 - 0.05);
  c.fluid.Ni = Math.min(150, c.fluid.Ni + 30);
  c.fluid.Fe = Math.min(90, c.fluid.Fe + 15);
  c.fluid.S = Math.max(0, c.fluid.S - 0.5);     // serpentinization consumes S to magnetite (NOT mass-balance double-debit; sulfide minerals dispatch separately)
  c.fluid.CO3 = Math.max(2, c.fluid.CO3 - 1);   // CO2 driven off in alkaline fluid
  c.flow_rate = 0.4;
  return `Serpentinization onset: T ${c.temperature.toFixed(0)}°C, pH ${c.fluid.pH.toFixed(1)} hyperalkaline. Mg ${c.fluid.Mg.toFixed(0)} + SiO2 ${c.fluid.SiO2.toFixed(0)} released; Ni ${c.fluid.Ni.toFixed(0)} + Fe mobilized. Chrysotile + brucite + magnetite + awaruite gates open.`;
}

function event_jeffrey_mine_dike_alteration(c) {
  // Stage 2 (step 60): Mafic dike alteration begins. Plagioclase +
  // clinopyroxene + chlorite of the basalt-to-gabbro dike react with
  // the alkaline serpentinizing fluid. Ca + Al + Si released; trace Cr
  // from chromite enables chrome varieties. Manning & Bird 1990.
  //
  // v123 tune: Ca release 100 → 220, cap 450 → 650. Al release 20 → 50,
  // cap 50 → 100. SiO2 release 60 → 130, cap 380 → 500. Mg "consumption"
  // line REMOVED (mass balance handles it via diopside/vesuvianite/
  // tremolite/actinolite stoichiometry). Fe release bumped 15 → 25.
  c.temperature = Math.max(300, c.temperature - 30);
  c.fluid.Ca = Math.min(650, c.fluid.Ca + 220);
  c.fluid.Al = Math.min(100, c.fluid.Al + 50);
  c.fluid.SiO2 = Math.min(500, c.fluid.SiO2 + 130);
  // Mg consumption REMOVED — mass balance via stoichiometry now does it
  c.fluid.Cr = Math.min(2.5, c.fluid.Cr + 1.2);
  c.fluid.Fe = Math.min(120, c.fluid.Fe + 25);
  c.fluid.pH = Math.min(11.0, c.fluid.pH - 0.1);
  c.flow_rate = 0.35;
  return `Mafic dike alteration: T ${c.temperature.toFixed(0)}°C. Ca ${c.fluid.Ca.toFixed(0)} + Al ${c.fluid.Al.toFixed(0)} + Si ${c.fluid.SiO2.toFixed(0)} released from dike; trace Cr ${c.fluid.Cr.toFixed(1)} enables chrome-diopside + chromian grossular. Manning & Bird 1990 rodingite window opens.`;
}

function event_jeffrey_mine_mid_rodingite(c) {
  // Stage 3 (step 100): Mid-rodingite — vesuvianite stage. The
  // signature Ca-Mg-Al sorosilicate dominates. Trace Cu (1-4 ppm) from
  // background dike chalcopyrite enables CYPRINE — Bernardini 1981.
  //
  // v123 tune: previously this event REDUCED Ca/Al/SiO2 to model their
  // consumption by vesuvianite. With mass balance, vesuvianite debits
  // them automatically. Flipped to RELEASE pattern: bump Ca/Al/SiO2
  // to sustain vesuvianite + continued grossular/diopside through
  // step 140.
  c.temperature = Math.max(260, c.temperature - 25);
  c.fluid.Cu = Math.min(4.0, c.fluid.Cu + 2.5);   // trace Cu for cyprine
  c.fluid.Ca = Math.min(550, c.fluid.Ca + 80);    // FLIPPED: was consumption, now release
  c.fluid.Al = Math.min(80, c.fluid.Al + 20);     // FLIPPED
  c.fluid.SiO2 = Math.min(450, c.fluid.SiO2 + 80);// FLIPPED
  c.fluid.Mg = Math.min(380, c.fluid.Mg + 40);    // NEW — vesuvianite debits Mg too
  c.fluid.pH = Math.min(10.8, c.fluid.pH - 0.1);
  c.flow_rate = 0.25;
  return `Mid-rodingite — vesuvianite stage: T ${c.temperature.toFixed(0)}°C. Cu ${c.fluid.Cu.toFixed(2)} ppm drives CYPRINE (Bernardini 1981). Ca ${c.fluid.Ca.toFixed(0)} + Al ${c.fluid.Al.toFixed(0)} + Si ${c.fluid.SiO2.toFixed(0)} + Mg ${c.fluid.Mg.toFixed(0)} in window for vesuvianite + continued grossular/diopside.`;
}

function event_jeffrey_mine_late_ca_silicates(c) {
  // Stage 4 (step 140): Late-stage Ca-silicates. Na rises as late-stage
  // dike feldspar albitizes; pectolite gate (Na >= 30) clears.
  // Wollastonite + prehnite fire alongside as Ca-Si + Ca-Al-Si end-
  // members.
  //
  // v123 tune: Mg "consumption" REMOVED (mass balance handles it). Ca
  // + SiO2 + Al releases bumped to sustain wollastonite/prehnite/
  // pectolite through step 170.
  c.temperature = Math.max(230, c.temperature - 20);
  c.fluid.Na = Math.min(80, c.fluid.Na + 60);     // pectolite gate
  c.fluid.Fe = Math.min(120, c.fluid.Fe + 8);     // prehnite color
  c.fluid.Ca = Math.min(500, c.fluid.Ca + 80);    // NEW — sustain wollastonite/prehnite
  c.fluid.SiO2 = Math.min(400, c.fluid.SiO2 + 60);// NEW — sustain late silicates
  c.fluid.Al = Math.min(70, c.fluid.Al + 15);     // NEW — prehnite needs Al
  // Mg consumption REMOVED (mass balance via tremolite/actinolite/diopside)
  c.fluid.pH = Math.min(10.5, c.fluid.pH - 0.2);
  c.flow_rate = 0.15;
  return `Late Ca-silicates: T ${c.temperature.toFixed(0)}°C. Na ${c.fluid.Na.toFixed(0)} for pectolite; Fe ${c.fluid.Fe.toFixed(0)} for prehnite green; Ca ${c.fluid.Ca.toFixed(0)} + Si ${c.fluid.SiO2.toFixed(0)} + Al ${c.fluid.Al.toFixed(0)} sustain the trio.`;
}

function event_jeffrey_mine_terminal_datolite(c) {
  // Stage 5 (step 170): Terminal datolite stage. Trace B appears
  // (concentrated from late hydrothermal fluid; B is incompatible in
  // most rodingite minerals so it accumulates in residual fluid).
  // Datolite fires on prehnite/wollastonite substrate as the final-
  // stage cabinet aesthetic.
  //
  // v123 tune: Ca + SiO2 "consumption" FLIPPED to release. B release
  // bumped slightly to ensure terminal-stage gate clears reliably after
  // 170 steps of cumulative growth-driven Ca + SiO2 depletion.
  c.temperature = Math.max(200, c.temperature - 15);
  c.fluid.B = Math.min(10.0, c.fluid.B + 9.0);    // bumped slightly for datolite gate
  c.fluid.Ca = Math.min(450, c.fluid.Ca + 80);    // FLIPPED: was consumption, now release
  c.fluid.SiO2 = Math.min(380, c.fluid.SiO2 + 60);// FLIPPED
  c.fluid.pH = Math.min(10.2, c.fluid.pH - 0.2);
  c.flow_rate = 0.05;
  return `Terminal datolite: T ${c.temperature.toFixed(0)}°C. Trace B ${c.fluid.B.toFixed(1)} ppm drives datolite gemmy_vitreous_terminated. Ca ${c.fluid.Ca.toFixed(0)} + Si ${c.fluid.SiO2.toFixed(0)} sustain late nucleation. Caps the Jeffrey rodingite paragenesis.`;
}
