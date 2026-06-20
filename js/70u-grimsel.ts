// ============================================================
// js/70u-grimsel.ts — Grimsel / Aar-massif alpine-cleft (Zerrkluft) events
// ============================================================
// The Swiss Central-Alps quartz-cleft showcase (SIM 206, 2026-06-19) — the
// content home for the quartz-morphology arc (RESEARCH-quartz-morphology
// §6: the arc is content-blocked; this cleft manufactures the σ-signatures).
// Research: research-grimsel-alpine-cleft.md.
//
// GEOLOGY. Zerrklüfte = extensional tension fissures in the Variscan Aar
// granite (Central Aar Granite / Grimsel Granodiorite), opened + RE-OPENED
// episodically during late-Alpine collision + retrograde exhumation. The
// fissure fluid is DILUTE (~1-3 wt% NaCl eq), OXIDIZING (hematite "iron
// roses" = Fe³⁺), CO₂-bearing, near-neutral; quartz nucleates ~450 °C and
// grows down the retrograde path, stopping ~200 °C, at 0.3-0.45 GPa
// (Mullis, Dubessy, Poty & O'Neil 1994 GCA 58:2239; Mullis 1996 Schweiz.
// Mineral. Petrogr. Mitt. 76:159; Gnos, Mullis & Bergemann 2025 Swiss J.
// Geosci. 118:12 — the D1/D2/D3 deformation-stage crack-seal spine).
//
// THE T SENTENCE IS A MOVEMENT, NOT EVENTS. Per the v181 T-reconciliation
// idiom (naica v182), the retrograde 450→200 °C decline is a declared
// `temperature` movement (scenarios.json5) with thermal_pulses:false +
// cooling_rate:0.4. These EVENTS are the chemistry BEATS that compose with
// it (different fields → no same-field clobber): the crack-seal SiO₂
// sawtooth + the Fe/CO₃ stage pulses.
//
// THE SCEPTRE MECHANISM (the point). σ_quartz = SiO₂ / silica_equilibrium(T),
// and eq(T) FALLS as the cleft cools (1400 ppm @450 °C → 300 @200 °C). The
// seal/breach SiO₂ targets are written RELATIVE to the live eq(T) (the engine
// exposes silica_equilibrium) so the σ targets hold as the cleft cools:
//   stem σ≈1.15 (a SLOW gen-1 termination) → SEAL σ≈0.5 (deep HIATUS held
//   through the cooling) → BREACH σ≈1.8 (a FAST, wide cap). Because the cap's
//   growth rate (∝ excess σ ~0.8) far exceeds the stem's (~0.15), the renewal
//   overgrows the tip wider = the alpine SCEPTRE (caps grow cooler + faster
//   than stems; mindat / quartzpage.de). Two cycles → two sceptre generations.
//   The slow-stem / fast-cap split is what makes the census renewal ratio
//   clear ≥1.3; a fast stem (the first dark-observe) made the bar unbeatable.
//   Verified by tools/quartz-hiatus-census.mjs (#108).

// SiO₂ target = factor × the silica solubility at the current temperature,
// so a σ target holds as eq(T) falls through the run. eq is read on the same
// basis the supersat engine uses (effectiveTemperature when present).
function _grimselSiO2ForSigma(c, sigmaTarget) {
  const T = (c.effectiveTemperature != null) ? c.effectiveTemperature : c.temperature;
  const eq = c.silica_equilibrium(T);
  return Math.max(1, Math.round(sigmaTarget * eq));
}

function event_grimsel_cleft_open(c) {
  // D1 (~450 °C): the first fissure opens; oxidized metamorphic fluid lines
  // the walls with a SLOW gen-1 smoky-quartz stem (σ≈1.15) + early adularia.
  c.fluid.SiO2 = _grimselSiO2ForSigma(c, 1.15);
  c.flow_rate = 0.5;
  return `Cleft opens (D1) — oxidized Aar-granite fluid; slow gen-1 smoky quartz stem + adularia. SiO₂ ${c.fluid.SiO2.toFixed(0)} (σ≈1.15), T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_seal_1(c) {
  // The fissure seals: silica supply cut → SiO₂ → 0.5×eq (σ≈0.5, well below
  // saturation) → the gen-1 termination HALTS (the hiatus the cap overgrows).
  c.fluid.SiO2 = _grimselSiO2ForSigma(c, 0.88);
  c.flow_rate = 0.1;
  return `Fissure seals — SiO₂ → ${c.fluid.SiO2.toFixed(0)} (σ≈0.88, a gentle pause that the stem SURVIVES) → quartz growth halts (hiatus 1). T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_breach_1(c) {
  // D2 re-opening (~395 °C): a fresh silica-charged pulse, SiO₂ → 1.8×eq
  // (σ≈1.8) → a FAST, wide cap nucleates on the gen-1 tip = SCEPTRE gen-2.
  c.fluid.SiO2 = _grimselSiO2ForSigma(c, 1.8);
  c.fluid.Fe = Math.min(c.fluid.Fe + 10, 40);   // the oxidized pulse also seeds Fe³⁺
  c.flow_rate = 0.5;
  return `Cleft re-opens (D2) — fresh silica pulse, SiO₂ → ${c.fluid.SiO2.toFixed(0)} (σ≈1.8) → fast wide sceptre cap. T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_oxide_roses(c) {
  // Mid-stage oxidizing pulse: Fe³⁺ rosettes (hematite "Eisenrosen") perch on
  // the quartz. O₂ held high — the Aar redox tell (Mullis et al. 1994: H₂O-CO₂
  // epizone, NOT the reducing CH₄ zone).
  c.fluid.Fe = Math.min(c.fluid.Fe + 170, 200);   // a concentrated Fe³⁺ accumulation — the iron-rose pulse
  c.fluid.O2 = Math.max(c.fluid.O2, 1.5);
  return `Iron-rose stage — hematite Fe³⁺ rosettes (Eisenrosen) on quartz; Fe ${c.fluid.Fe.toFixed(0)}, O₂ ${c.fluid.O2.toFixed(1)} (oxidizing). T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_seal_2(c) {
  // Second seal (~321 °C): SiO₂ → 0.5×eq → σ≈0.5 → hiatus 2.
  c.fluid.SiO2 = _grimselSiO2ForSigma(c, 0.88);
  c.flow_rate = 0.1;
  return `Fissure re-seals — SiO₂ → ${c.fluid.SiO2.toFixed(0)} (σ≈0.88, gentle pause) → second growth hiatus. T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_breach_2(c) {
  // D3 re-opening (~289 °C): the coolest fresh pulse, SiO₂ → 1.9×eq (σ≈1.9) →
  // the tallest cap (gen-3). Slightly stronger than breach 1 — the coolest
  // pulse is the most supersaturated (the cap-grows-cooler rule).
  c.fluid.SiO2 = _grimselSiO2ForSigma(c, 1.9);
  c.flow_rate = 0.4;
  return `Cleft re-opens (D3) — coolest fresh pulse, SiO₂ → ${c.fluid.SiO2.toFixed(0)} (σ≈1.9) → tallest sceptre cap. T ${c.temperature.toFixed(0)}°C.`;
}

function event_grimsel_late_carbonate(c) {
  // Late, low-T (~241 °C → 200 °C): the fissure fluid turns carbonate-bearing;
  // CO₂ + Ca → calcite seals the paragenesis, with late fluorite + apatite +
  // the wedge titanite (Ca-Ti-Si) that have been waiting on the cooling tail.
  // SiO₂ left at the breach-2 level (no seal) so a final quartz generation
  // grows out as it cools.
  c.fluid.CO3 = Math.min(c.fluid.CO3 + 120, 160);
  c.fluid.F = Math.min(c.fluid.F + 14, 28);
  c.fluid.pH = Math.min(c.fluid.pH + 1.3, 8.3);   // CO₂ degassing drives the late fluid alkaline → calcite
  c.flow_rate = 0.2;
  return `Late carbonate stage — CO₃ → ${c.fluid.CO3.toFixed(0)}, F → ${c.fluid.F.toFixed(0)}, pH → ${c.fluid.pH.toFixed(1)}: calcite + fluorite + apatite + titanite wedges close the cleft. T ${c.temperature.toFixed(0)}°C.`;
}
