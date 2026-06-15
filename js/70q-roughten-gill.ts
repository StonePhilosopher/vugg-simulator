// ============================================================
// js/70q-roughten-gill.ts — events for Roughten Gill Mine
// ============================================================
// Caldbeck Fells, Lake District, Cumbria, England. Polymetallic Pb-Cu
// fissure-vein deposit in the Eycott Volcanic Group + Carrock Fell
// Intrusive Complex (granophyre footwall + gabbro hangingwall; common
// derivative-literature error attributes this to the Borrowdale
// Volcanic Group — that's the wrong unit. Eycott Volcanic Group is
// the actual Ordovician basaltic-andesitic-to-rhyolitic host). Worked
// 1700s-1894 for lead + minor copper; dumps reworked for barite
// post-1894; now a classic specimen-collector locality. Documented
// exhaustively in Cooper M.P. & Stanley C.J. (1990) "Minerals of the
// English Lake District: Caldbeck Fells" (Natural History Museum,
// London) — the canonical multi-volume monograph per mine — and in
// the Russell Society three-part review (Bridges et al. 2011 Part 3
// is the modern definitive paper on Roughten Gill specifically).
//
// TYPE LOCALITY for plumbogummite (PbAl3(PO4)2(OH)5·H2O) — first
// described by Hartley 1882 from material collected here.
// Plumbogummite is NOT yet wired in the simulator; flagged as a
// future add-mineral commit. The scenario documents the type-locality
// status in the notes for now.
//
// HEADLINE PARAGENESIS (Cooper & Stanley 1990; see also Symes &
// Young 2008 "Minerals of Northern England" BGS):
//
//   Primary stage (~150°C, sulfide-buffered acidic, reducing) —
//     galena + sphalerite + chalcopyrite + pyrite + tetrahedrite +
//     tennantite + minor argentiferous galena. Quartz gangue.
//
//   Cooling + initial oxidation (~40°C, neutral → acid) —
//     pyrite oxidizes → SO4 + H+, pH crashes to ~4. Sulfide budget
//     consumed. Cu + Pb mobilized into oxidizing fluid.
//
//   Linarite stage (T ~30°C, pH 5-6, CO3:SO4 << 0.3) —
//     PbCu(SO4)(OH)2 deep azure-blue. THE Roughten Gill collector
//     mineral. Carbonate budget still low (no limestone wallrock to
//     buffer; only meteoric CO2 input).
//
//   Caledonite + brochantite stage (T ~30°C, pH ~6, CO3:SO4 0.3-1) —
//     CO3 rises from atmospheric/meteoric source; Pb5Cu2(CO3)(SO4)3
//     (OH)6 caledonite epitactic on linarite. Brochantite
//     Cu4(SO4)(OH)6 fires alongside as Cu sulfate end-member.
//
//   Leadhillite stage (T ~25°C, pH 6.5-7, CO3:SO4 > 1.5) —
//     Cu depletes (consumed by prior Cu-bearing phases); CO3
//     continues rising; Pb4(SO4)(CO3)2(OH)2 leadhillite caps.
//     Cerussite (PbCO3) + pyromorphite (Pb5(PO4)3Cl) + mimetite
//     (Pb5(AsO4)3Cl) round out the late Pb suite.
//
//   Bayldonite + mottramite accessories — Pb-Cu-As + Pb-Cu-V
//     respectively. Mottramite needs V trace (Borrowdale Volcanic
//     wallrock V content ~10-20 ppm leaches in supergene window).
//
// Refs: Cooper & Stanley 1990; Symes & Young 2008; Russell 1925 +
// 1986 various MinMag papers; Goldring 1991 "Cumbria's Underground
// Heritage"; Hartley 1882 (plumbogummite type description).

function event_roughten_gill_primary_lockup(c) {
  // Stage 1 → Stage 2 transition: T drops 130 → 45°C (Lake District
  // primary stage is cooler than Pennine-Yorkshire 150-250°C — BGS
  // fluid-inclusion T 110-130°C per Earthwise compilation; calibrated
  // to the 130 °C upper bound). Primary sulfides lock in (galena +
  // sphalerite + chalcopyrite + pyrite + tetrahedrite/tennantite),
  // S budget consumed by primary phase, Fe sequestered in pyrite.
  // pH neutralizes slightly as sulfide buffering ends. Salinity drops
  // (15-30 wt% NaCl-eq primary brine → meteoric mixing dilutes).
  c.temperature = Math.max(45, c.temperature - 85);
  c.fluid.S = Math.max(40, c.fluid.S * 0.3);
  c.fluid.Fe = Math.max(2.0, c.fluid.Fe * 0.2);
  c.fluid.pH = Math.min(5.5, c.fluid.pH + 0.5);
  c.fluid.O2 = Math.min(0.3, c.fluid.O2 + 0.15);
  c.fluid.salinity = Math.max(1.5, c.fluid.salinity * 0.5);
  c.flow_rate = 0.3;
  return `Primary stage closes: galena + sphalerite + chalcopyrite + pyrite + tetrahedrite + tennantite lock in. T drops to ${c.temperature.toFixed(0)}°C; S consumed (now ${c.fluid.S.toFixed(0)} ppm); pH neutralizes to ${c.fluid.pH.toFixed(1)}. Caldbeck supergene window opens.`;
}

function event_roughten_gill_pyrite_oxidation(c) {
  // v109 tune: bump Cu/Pb mobilization to clear linarite/caledonite/
  // brochantite gates (Cu > 50 needed for mottramite + brochantite
  // sweet spot); bump CO3 enough for cerussite gate but keep CO3:SO4
  // << 0.3 so linarite still wins the early window. As suppressed
  // somewhat to give pyromorphite + mimetite headroom over the
  // As-sulfide routing.
  //
  // Acid mine drainage pulse: residual pyrite oxidizes to SO4 + H+,
  // pH crashes briefly to 4.2, Cu mobilized from chalcopyrite +
  // tetrahedrite breakdown. Cerussite + anglesite + mimetite +
  // pyromorphite begin nucleating on residual galena. Plumbogummite
  // gates also clear here (Pb 90 + Al 15 + P 8 + pH 4.2 + T 35).
  c.temperature = Math.max(30, c.temperature - 10);
  // v180: surge +80 → +110. The v109 value left the wall-cell CO3:SO4
  // ratio at 0.33-0.36 through the ENTIRE linarite window — over the
  // 0.30 fork by a whisker, for 75 consecutive steps (gate-census
  // probe). A stronger pyrite-derived SO4 surge is this event's own
  // mechanism; it also lands the caledonite stage ratio at ~0.8,
  // BETTER inside its 0.3-1.0 sweet spot than the old marginal 1.06.
  c.fluid.S = Math.min(220, c.fluid.S + 110);           // SO4 surge from pyrite breakdown
  c.fluid.Cu = Math.min(75, c.fluid.Cu + 35);           // bump to mottramite + brochantite sweet spot
  c.fluid.Pb = Math.min(95, c.fluid.Pb + 20);           // Pb mobilized from galena
  c.fluid.As = Math.min(18, c.fluid.As + 5);            // As(V) mobilized but less than v107 (give pyromorphite the win)
  // v193: SUPERGENE V-LEACH — the missing half of the mottramite story.
  // This scenario's own header (and the v180 V-axis note) say Caldbeck
  // wallrock carries V ~10-20 ppm that "leaches in the supergene window,"
  // yet fluid.V sat STATIC at 6 the entire run — the leach was described
  // but never modelled. V⁵⁺ vanadate mobilizes precisely at oxidation
  // onset (this event is where O2 jumps 0.05→1.2), so the leach belongs
  // HERE, not in the initial broth. Critically it fires at step 70 —
  // AFTER the step-25 primary lockup — so it canNOT reproduce the v180
  // failure (that was an INITIAL-broth V bump from step 0 that re-rolled
  // the primary-suite RNG and halved sphalerite). 6→14 lands inside the
  // header's 10-20 ppm wallrock range; with the v193 descloizite-group
  // V-economics correction (gate 10→4, v_f /20→/8) this clears mottramite
  // honestly. Same supergene-leach shape as supergene_v_bearing_seep
  // (Tsumeb). Kingsbury & Hartley 1956 + Stanley et al. 1991 document
  // the Caldbeck vanadinite-mottramite-descloizite V suite.
  c.fluid.V = Math.min(14, c.fluid.V + 8);              // red-bed/wallrock V⁵⁺ leach at oxidation onset
  c.fluid.O2 = Math.min(1.4, c.fluid.O2 + 1.0);         // full atmospheric oxidation
  c.fluid.pH = Math.max(4.2, c.fluid.pH - 1.3);         // acid pulse (gentler than v107 to keep linarite pH window in range)
  c.fluid.CO3 = Math.min(40, c.fluid.CO3 + 15);         // CO3 builds — bigger early input helps cerussite + caledonite
  c.flow_rate = 0.4;
  return `Pyrite oxidation pulse — AMD-style acid window. T ${c.temperature.toFixed(0)}°C, pH crashes to ${c.fluid.pH.toFixed(1)}, SO4 surges to ${c.fluid.S.toFixed(0)} ppm. Cu (${c.fluid.Cu.toFixed(0)}) + Pb (${c.fluid.Pb.toFixed(0)}) + As (${c.fluid.As.toFixed(0)}) + V (${c.fluid.V.toFixed(0)}, wallrock leach) mobilized. CO3 builds to ${c.fluid.CO3.toFixed(0)} (cerussite gate clears). Plumbogummite gates clear (Pb=${c.fluid.Pb.toFixed(0)}, Al=${c.fluid.Al.toFixed(0)}, P=${c.fluid.P.toFixed(0)}).`;
}

function event_roughten_gill_linarite_stage(c) {
  // HISTORY: v109 diagnosed linarite as Shape B (RNG-cascade
  // displacement — σ ~6.5 cleared but pyromorphite + Ag-sulfosalts
  // consumed the budget first) and documented it as structural. That
  // diagnosis predated the per-vertex/per-cell architecture (v160) and
  // the v177 competition cell-key fix. RE-PROBED v180: the displacement
  // is GONE — the actual blocker was the CO3:SO4 fork missing 0.30 by
  // 0.03-0.06 for the entire window (the v109 AMD surge left the wall
  // ratio at 0.33-0.36). With the v180 surge (+110), LINARITE FIRES
  // (2x at seed 42, ~2 mm) — the headline azure-blue specimen grows.
  //
  // Linarite window: pH recovers to 5.5-6 (acid neutralized by minor
  // wallrock dissolution + meteoric mixing), CO3 still low.
  c.temperature = Math.max(28, c.temperature - 2);
  c.fluid.pH = Math.min(5.8, c.fluid.pH + 1.5);
  c.fluid.O2 = Math.max(0.8, c.fluid.O2 - 0.3);
  c.flow_rate = 0.2;
  return `Linarite window: T ${c.temperature.toFixed(0)}°C, pH ${c.fluid.pH.toFixed(1)}, CO3:SO4 = ${(c.fluid.CO3 / Math.max(c.fluid.S, 1)).toFixed(2)} (sulfate-dominant). PbCu(SO4)(OH)2 — deep azure-blue, THE Roughten Gill collector specimen.`;
}

function event_roughten_gill_caledonite_transition(c) {
  // v109 tune: bigger CO3 surge (60 -> 100) so CO3:SO4 lands in
  // caledonite sweet spot 0.3-1.0 even with S consumed by linarite.
  // Cu only partially consumed (40 -> 30, vs v107 -30) so brochantite
  // still has Cu budget.
  //
  // Caledonite + brochantite window: CO3 rises (continued atmospheric
  // CO2 + minor calcite from background lime-stained jointing),
  // pH rises to 6.2, CO3:SO4 enters the 0.3-1.0 caledonite sweet spot.
  // Caledonite epitactic on linarite; brochantite as the Cu sulfate
  // end-member firing alongside.
  c.temperature = Math.max(25, c.temperature - 3);
  c.fluid.CO3 = Math.min(110, c.fluid.CO3 + 55);       // bigger CO3 surge for caledonite sweet spot
  c.fluid.Cu = Math.max(30, c.fluid.Cu - 20);          // partial Cu consumption (brochantite needs it)
  c.fluid.pH = Math.min(6.3, c.fluid.pH + 0.4);
  c.fluid.S = Math.max(80, c.fluid.S - 40);            // SO4 consumed (less than v107; keep caledonite ratio in band)
  c.flow_rate = 0.15;
  return `Caledonite + brochantite window: T ${c.temperature.toFixed(0)}°C, pH ${c.fluid.pH.toFixed(1)}, CO3 rises to ${c.fluid.CO3.toFixed(0)} ppm (CO3:SO4 = ${(c.fluid.CO3 / Math.max(c.fluid.S, 1)).toFixed(2)} — caledonite sweet spot). Caledonite epitactic on linarite + brochantite Cu sulfate end-member.`;
}

function event_roughten_gill_leadhillite_cap(c) {
  // Leadhillite + pyromorphite + late Pb-CO3 cap. Cu has been
  // depleted by linarite + brochantite + caledonite consumption,
  // dropping below the leadhillite Cu < 50 gate (already there).
  // CO3:SO4 climbs past 1.5; Pb4(SO4)(CO3)2(OH)2 leadhillite caps
  // as the terminal Pb-Cu-CO3 phase. Pyromorphite + mimetite fire
  // alongside as Pb-PO4 and Pb-AsO4 phases on whatever P + As is left.
  c.temperature = Math.max(22, c.temperature - 3);
  // v180: flood +50 → +70, ceiling 110 → 165. Two reasons: (1) the cap's
  // σ was 0.774 — limited by the carbonate term (co3_f = CO3/100 = 1.1);
  // (2) the v180 AMD S-surge leaves more residual sulfate, and the
  // CO3:SO4 ≥ 1.5 leadhillite fork must still hold (165/~97 ≈ 1.7 ✓).
  // A carbonate FLOOD is this event's whole identity — meteoric CO2 +
  // lime-stained jointing at pH 7 supports the higher ceiling.
  c.fluid.CO3 = Math.min(165, c.fluid.CO3 + 70);
  c.fluid.S = Math.max(40, c.fluid.S - 20);
  c.fluid.Cu = Math.max(8, c.fluid.Cu * 0.3);          // Cu fully depleted now
  c.fluid.pH = Math.min(7.0, c.fluid.pH + 0.5);
  c.flow_rate = 0.05;
  return `Leadhillite cap: T ${c.temperature.toFixed(0)}°C, pH ${c.fluid.pH.toFixed(1)}, CO3:SO4 = ${(c.fluid.CO3 / Math.max(c.fluid.S, 1)).toFixed(2)} (carbonate-dominant). Cu depleted to ${c.fluid.Cu.toFixed(0)} ppm (leadhillite gate Cu<50 clear). Pb4(SO4)(CO3)2(OH)2 + pyromorphite + cerussite cap the Roughten Gill paragenesis.`;
}
