// ============================================================
// js/70v-tormiq.ts — Tormiq Valley alpine-cleft epidote
// ============================================================
// TORMIQ VALLEY, Haramosh Mts., Roundu/Skardu District, Gilgit-Baltistan,
// PAKISTAN — the world's premier alpine-cleft EPIDOTE locality (Anthony et
// al. Handbook of Mineralogy 2001 names Tormiq type-quality, rivaling
// Knappenwand, Austria). The v197 anchor scenario for epidote (added v196).
//
// SETTING (NOT a pegmatite). Gilgit-Baltistan hosts three distinct deposit
// types: (1) Li-B-Be GEM PEGMATITES (Nuristan/Shigar tourmaline, kunzite,
// aquamarine — magmatic), (2) ALPINE-TYPE CLEFTS (epidote, titanite, zoisite,
// axinite, quartz, adularia — metamorphic fissure, aqueous fluid — THIS
// SCENARIO), (3) metamorphosed marble (ruby/spinel — contact). Tormiq is type
// (2): fractures opened by Main Karakoram Thrust activity in amphibolite /
// metabasite / gneiss, then filled by a LOW-SALINITY, OXIDIZED, meteoric-
// metamorphic fluid in brittle channelized flow (<450°C, retrograde to
// <200°C; Central-Alps analogue per Mullis 1994, Bergemann et al. 2017).
// The OXIDIZED character is what makes Fe³⁺-rich green epidote (not the
// Fe-poor clinozoisite) — see the epidote engine v196.
//
// PARAGENESIS (cleft opening, higher T → cooling):
//   1. quartz lining (cleft walls)              ~420°C
//   2. Ti–Fe oxides — magnetite (+ titanite,    ~380°C
//      not yet modelled) on the walls
//   3. EPIDOTE main stage — pistachio prisms,    350→290°C  (the star)
//      doubly-terminated Tormiq swords, oxidized
//   4. byssolite (fibrous actinolite) sprays,    ~270°C
//      epidote nucleates on the mats as fans
//   5. adularia (K-feldspar), low-T cleft        ~250°C
//   6. calcite + late zeolites, cooling stops    <200°C
//
// REFERENCES:
//   * Anthony, Bideaux, Bladh & Nichols 2001, Handbook of Mineralogy
//     (epidote sheet — names Tormiq, Pakistan as type-quality)
//   * Deer Howie Zussman 1986, Rock-Forming Minerals v.1B pp.44-134
//   * Liebscher & Franz eds. 2004, Reviews in Mineralogy v.56 Epidotes
//   * Mullis J 1994, GCA 58:2239 (alpine-fissure quartz fluid inclusions)
//   * Bergemann et al. 2017, Swiss J. Geosci. (alpine fissure T/fluid)
//   * mindat loc-5734 (Tormiq geology: Main Karakoram Thrust clefts)

function event_tormiq_quartz_lining(c) {
  c.temperature = Math.max(380, c.temperature - 40);
  c.fluid.SiO2 = Math.min(420, c.fluid.SiO2 + 40);
  c.fluid.O2 = Math.max(1.3, c.fluid.O2);            // hold the cleft oxidizing (Fe³⁺)
  c.flow_rate = 1.0;
  return `A cleft opens along a Main Karakoram Thrust fracture; low-salinity, oxidized metamorphic fluid floods the fissure and lines the walls with quartz. T ${c.temperature.toFixed(0)}°C, oxidizing (O₂ ${c.fluid.O2.toFixed(1)}).`;
}

function event_tormiq_oxide_stage(c) {
  c.temperature = Math.max(340, c.temperature - 40);
  c.fluid.Fe = Math.min(60, c.fluid.Fe + 10);        // amphibolite yields Fe
  c.fluid.Ti = (c.fluid.Ti || 0) + 1.0;
  return `Ti–Fe oxides crust the cleft walls — magnetite (and titanite, not yet modelled) — as the amphibolite host yields Fe and Ti. T ${c.temperature.toFixed(0)}°C.`;
}

function event_tormiq_epidote_main(c) {
  c.temperature = Math.max(290, c.temperature - 50);
  c.fluid.Fe = Math.min(75, c.fluid.Fe + 15);        // Fe³⁺ pulse from amphibolite leaching
  c.fluid.Al = Math.min(20, c.fluid.Al + 4);
  c.fluid.Ca = Math.min(900, c.fluid.Ca + 100);
  c.fluid.O2 = Math.max(1.5, c.fluid.O2);            // strongly oxidizing → Fe³⁺ → deep green
  c.flow_rate = 1.3;
  return `THE EPIDOTE STAGE: oxidized Ca–Al–Fe³⁺ fluid in an open cleft at T ${c.temperature.toFixed(0)}°C — lustrous pistachio-green prisms strike out from the quartz, the doubly-terminated Tormiq gem swords. Fe³⁺ ${c.fluid.Fe.toFixed(0)} ppm, strongly oxidizing.`;
}

function event_tormiq_byssolite(c) {
  c.temperature = Math.max(260, c.temperature - 30);
  c.fluid.Mg = Math.min(48, c.fluid.Mg + 20);        // modest Mg → byssolite stays secondary to epidote
  return `Byssolite — fibrous actinolite — sprays through the cleft, and epidote nucleates on the amphibole mats as radiating fans. T ${c.temperature.toFixed(0)}°C.`;
}

function event_tormiq_adularia(c) {
  c.temperature = Math.max(230, c.temperature - 30);
  c.fluid.K = Math.min(280, c.fluid.K + 90);         // low-T cleft K-feldspar
  return `Lower-temperature cleft feldspar: adularia (K-feldspar) crystallizes as the fluid cools and K builds up. T ${c.temperature.toFixed(0)}°C.`;
}

function event_tormiq_late_calcite(c) {
  c.temperature = Math.max(170, c.temperature - 50);
  c.fluid.CO3 = Math.min(220, c.fluid.CO3 + 90);
  c.flow_rate = 0.2;
  return `The cleft cools below ~200°C: calcite + late zeolites close the paragenesis and growth winds down. T ${c.temperature.toFixed(0)}°C.`;
}
