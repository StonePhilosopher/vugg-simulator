// ============================================================
// js/70u-wittichen.ts — Wittichen five-element vein event handlers
// ============================================================
// Scenario: `wittichen` (v189) — Kloster Wittichen, Schwarzwald, Germany.
// The classic Bi-Co-Ni-Ag-As-(Ba) "five-element" vein association
// (Kissin 1992's class), mined for cobalt pigment + silver in the
// 1730s–40s boom around the convent. Markl-group home turf — the
// skutterudite engine's own Cobalt-Canada/Markl citation describes the
// texture this scenario exists to grow: zoned arsenide rosettes ON
// native Bi-Ag cores.
//
// THE MECHANISM (why this deposit class exists at all): a hot, saline,
// S-STARVED basement brine carries Bi/Co/Ni/Ag/As. Sulfur starvation is
// load-bearing — with S ~3 ppm, bismuthinite and acanthite never gate
// open, so the metals stay NATIVE and the arsenides (not sulfides) are
// the metal sinks. The deposit-defining moment is a REDUCING SHOCK:
// hydrocarbon/methane influx along the fault (Burisch et al. 2017 —
// fluid inclusions in Schwarzwald five-element veins carry CH4 exactly
// at the native-metal stage; Scharrer, Kreissl & Markl 2019) crashes Eh
// in hours-to-days. Native-metal σ slams to its structural ceiling and
// the metals precipitate as DENDRITES — fast, branching, extreme-
// disequilibrium growth that the morphology registry (js/45,
// MORPH_TH.native_bismuth, SIM 188) now classifies and renders. The
// arsenides rim the fresh dendrites (safflorite's T window overlaps the
// shock), then carbonate + barite gangue seal the vein as cooling
// meteoric water arrives.
//
// In the sim the shock is a DECLARED fluid.Eh movement (the
// event-subsumption alphabet, v185/v186 — base mildly reducing, one
// deep pulse, late oxidizing trend); the handlers below carry only the
// LATE-STAGE chemistry beats that aren't redox:
//   1. wittichen_hydrocarbon_influx — NARRATIVE-ONLY log marker at the
//      shock step (no fluid writes; the movement owns the redox — the
//      v185 lesson, never re-confound what subsumption separated).
//   2. wittichen_meteoric_sulfate — cooled meteoric water brings
//      oxidized sulfate: S 3 → 30 at T ~165°C. With the Eh trend now
//      positive, barite gates open (Ba has been waiting in the broth
//      since step 0 — 75 ppm since v191, the Barytgänge correction).
//      Geologically the vein-top barite stage.
//   3. wittichen_carbonate_gangue — CO3 + Ca influx; calcite seals the
//      vug. The hand-specimen truth of the class: silver-white Bi
//      dendrites embedded IN white carbonate, read in cross-section.

function event_wittichen_hydrocarbon_influx(c) {
  // No chemistry — the declared fluid.Eh movement carries the shock.
  // This marker exists so the step log narrates what the strip's Eh
  // chip + bismuth_morph chip are about to show.
  return `Hydrocarbon influx along the fault — CH₄-bearing fluid floods the vein. Eh is crashing (the declared redox movement); native-metal σ heads for its structural ceiling. Watch the bismuth.`;
}

function event_wittichen_meteoric_sulfate(c) {
  // S +27 (not the +37 first tried): 40 ppm sulfidized ALL the native
  // silver to acanthite in one stage; 30 leaves the conversion partial,
  // which is the hand-specimen truth (acanthite-coated native silver).
  c.fluid.S = Math.min(30, c.fluid.S + 27);
  // v191: broth Ba is 75 (the Barytgänge correction — the gate census
  // proved barite was BARIUM-limited, not oxidation-limited; see the
  // scenario notes). The floor tracks it so earlier-stage nibbling
  // can't starve the barite stage.
  c.fluid.Ba = Math.max(c.fluid.Ba, 70);
  c.temperature = Math.min(c.temperature, 170);
  return `Meteoric water reaches the vein — oxidized sulfate arrives (S ${c.fluid.S.toFixed(0)} ppm, T ${c.temperature.toFixed(0)}°C). The barite stage opens; the arsenide stage is over; the silver begins to tarnish.`;
}

function event_wittichen_carbonate_gangue(c) {
  c.fluid.CO3 = Math.min(140, c.fluid.CO3 + 95);
  c.fluid.Ca = Math.min(420, c.fluid.Ca + 160);
  // Carbonate-buffered late water — without the pH shift calcite never
  // opened at the first observation (pH 6.2 throughout the run).
  c.fluid.pH = Math.min(7.4, c.fluid.pH + 1.1);
  return `Carbonate gangue stage — CO₃ ${c.fluid.CO3.toFixed(0)}, Ca ${c.fluid.Ca.toFixed(0)} ppm, pH ${c.fluid.pH.toFixed(1)}. Calcite seals the dendrites into the vein: the cross-section specimen assembles itself.`;
}
