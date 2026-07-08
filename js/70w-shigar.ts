// ============================================================
// js/70w-shigar.ts — Shigar Valley aquamarine pegmatite events
// ============================================================
// Shigar Valley, Skardu District, Gilgit-Baltistan, Pakistan (Dassu /
// Nyet / Yuno pocket zone). Miarolitic gem pockets in Cenozoic
// Karakoram leucogranite pegmatites — the world's premier source of
// sharp, glassy, often ETCHED aquamarine on cleavelandite + muscovite,
// with schorl, microcline, and smoky quartz (the pegmatite host's own
// radiogenic dose supplies the smoke — see grow_quartz's Rossman
// [AlO₄]⁰ path, which keys off wall composition 'pegmatite').
//
// Seven events compress the pocket story (~70 steps, tutorial-tempo —
// this scenario doubles as the stage for Tutorial 4, collecting):
//
//   stage 1  outer_shell      600→555°C  wall-zone microcline + quartz
//   stage 2  first_schorl     →520°C     B crosses — black tourmaline
//   stage 3  cleavelandite    →490°C     albitization: K→Na flip, the
//                                        platy albite the aquas perch on
//   stage 4  aqua_saturation  →430°C     Be finally crosses; Fe held in
//                                        the aquamarine window (Fe≥8,
//                                        O2 low → Fe²⁺ blue, not
//                                        heliodor's oxidized gold).
//                                        T per the pocket-stage window:
//                                        435→355°C (London, Hunt &
//                                        Duval 2020); Luumäki analog
//                                        380±80°C (Michallik et al. 2021)
//   stage 5  topaz_window     →380°C     F builds past the topaz gate
//   stage 6  hf_etch          →310°C     the SHIGAR SIGNATURE: late
//                                        Be-exhausted HF-rich fluid
//                                        (pH<3, F>30) sculpts the
//                                        aquas — _beryl_family_
//                                        dissolution's etch branch.
//                                        Etched Pakistani blue beryl:
//                                        G&G 57(2) 2021 Quarterly Crystal
//   stage 7  final_cooling    →265°C     pH recovers, system dies
//
// The variety dispatch is held to AQUAMARINE by broth design: Cr+V at
// trace (no emerald), Mn<2 (no morganite), O2≤0.3 (heliodor's Fe³⁺
// gate needs O2>0.5), Fe≥8 (plain beryl/goshenite returns 0).
//
// Fe-budget routing (the §4 walk): schorl debits Fe from stage 2 on —
// the same budget aquamarine's Fe≥8 gate reads. Stage 4 explicitly
// re-floors Fe at 12 (fresh reduced fluid accompanying pocket rupture)
// so the blue is guaranteed regardless of how hungry the tourmaline
// was. Without that floor the scenario ships an occasional goshenite
// on Fe-starved seeds — the v107 lesson applied at design time.


function event_shigar_outer_shell(c) {
  c.temperature = Math.max(555.0, c.temperature - 45.0);
  return 'The pocket seals. Around it the pegmatite\'s wall zone crystallizes — graphic microcline and quartz lock in the chamber. Inside, the residual melt-fluid keeps every element the feldspars refused: beryllium, boron, fluorine, iron. The incompatibles have nowhere left to go.';
}

function event_shigar_first_schorl(c) {
  c.temperature = Math.max(520.0, c.temperature - 35.0);
  c.fluid.B = Math.min(60, c.fluid.B + 15.0);
  return 'Boron crosses saturation first. Schorl — black iron tourmaline — needles out from the pocket walls. Every schorl prism is quietly eating iron; remember that, it matters for the blue to come.';
}

function event_shigar_cleavelandite(c) {
  // Albitization by cooling alkali-fluoride fluids at <2 kbar; platy
  // cleavelandite is the volatile-escape product of pocket rupture in
  // the Stak Nala analog (Laurs et al. 1998).
  c.temperature = Math.max(490.0, c.temperature - 30.0);
  c.fluid.Na = Math.min(120, c.fluid.Na + 45.0);
  c.fluid.K = Math.max(25.0, c.fluid.K - 50.0);
  return 'The pocket vents — a first rupture bleeds off volatiles, and the escaping alkali-fluoride fluid albitizes as it cools. Platy white albite — cleavelandite — sheets across the earlier feldspar. This is the shelf the aquamarines will stand on: nearly every great Shigar specimen is a blue prism perched on white cleavelandite blades.';
}

function event_shigar_aqua_saturation(c) {
  c.temperature = Math.max(430.0, c.temperature - 60.0);
  // Door 1 (SIM 219): the pocket-rupture pulse delivers the ACCUMULATED
  // Be inventory, not a nudge — beryl saturation runs ~250 ppm Be in
  // granitic melts at 650°C (Evensen, London & Wallace 1999) and the
  // last melt fraction hoards Be for the whole crystallization history.
  // The wallet law (tools/shigar-aqua-growth-probe.mjs): star size ≈
  // cell Be × 200 µm/unit, so ~118 in the cells buys the 21 mm
  // showpiece the locality is famous for. The old +8 (cap 45) grew a
  // 0.6 mm namesake.
  c.fluid.Be = Math.min(125, c.fluid.Be + 110.0);
  // Fresh reduced fluid with the rupture — re-floor Fe into the
  // aquamarine window (schorl has been eating it since stage 2).
  c.fluid.Fe = Math.max(12.0, c.fluid.Fe);
  c.fluid.O2 = Math.min(0.3, c.fluid.O2);
  return 'Beryllium finally crosses. Everything before this refused Be — now the pocket owes it a crystal, and the debt is enormous. With Fe²⁺ in the fluid and oxygen scarce, the beryl that grows is BLUE: aquamarine. Not the golden heliodor of oxidized pockets — the reducing Karakoram fluid keeps the iron ferrous.';
}

function event_shigar_topaz_window(c) {
  c.temperature = Math.max(380.0, c.temperature - 55.0);
  c.fluid.F = Math.min(60, c.fluid.F + 20.0);
  c.fluid.pH = Math.max(5.6, c.fluid.pH - 0.5);
  return 'The pocket cools into topaz territory and fluorine — hoarded all this time — finally matters. Where F pools against aluminous walls, topaz nucleates alongside the last quartz.';
}

function event_shigar_hf_etch(c) {
  c.temperature = Math.max(310.0, c.temperature - 70.0);
  // Late-stage HF-rich fluid: Be crashes (the ×0.15 on the bulk
  // broadcasts as a large negative delta to the growth cells, which the
  // big crystals had already drained — σ_cell < 1 + pH < 3 + F > 30 =
  // the etch branch, trigonal pits, sculpted terminations). Door 1
  // NOTE: post-crash bulk Be (~17 with the SIM 219 wallet) sits ABOVE
  // the Be≥10 floor, so σ(bulk) recovers after the acid passes and one
  // LATE runt nucleates ~step 62 — a pristine unetched second
  // generation beside its etched elders. Emergent, measured, kept.
  c.fluid.Be = Math.max(2.0, c.fluid.Be * 0.15);
  c.fluid.F = Math.min(60, Math.max(35.0, c.fluid.F + 10.0));
  c.fluid.pH = Math.min(2.8, c.fluid.pH);
  return 'The pocket turns on its own children. The late fluid is beryllium-exhausted and hydrofluoric-acid-rich — undersaturated in the very mineral it grew. It begins to dissolve the aquamarines: trigonal etch pits, sculpted terminations, faces frosted into steps. Half the character of a Shigar aqua is what the acid took back.';
}

function event_shigar_final_cooling(c) {
  c.temperature = Math.max(265.0, c.temperature - 45.0);
  c.fluid.pH = Math.min(5.2, c.fluid.pH + 2.4);
  c.flow_rate = 0.2;
  return 'Meteoric water finds the system as the range lifts and erodes. The acid is flushed, the chemistry goes quiet, and the pocket waits — barely a few million years; these upper-valley dikes are almost Pliocene-young — for a miner\'s hammer at four thousand meters.';
}
