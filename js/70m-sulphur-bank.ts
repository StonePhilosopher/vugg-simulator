// ============================================================
// js/70m-sulphur-bank.ts — events for Sulphur Bank Mine
// ============================================================
// Pleistocene hot-spring sulfur deposit, Lake County, California.
// Active hot springs at the south shore of Clear Lake. Mined for
// mercury 1865-1957 (one of California's largest Hg producers; now
// an EPA Superfund site). The native sulfur is the byproduct of
// H₂S meeting atmospheric O₂ in the acid mixing zone at the vents.
//
// Mechanism (White & Roberson 1962, USGS PP 432-A):
//   1. Hot reduced fluid rises from depth carrying H₂S, CO₂, Hg⁰ vapor
//      + minor metals.
//   2. Near surface, partial oxidation transfers reduced sulfur into
//      elemental S: 2 H₂S + O₂ → 2 S° + 2 H₂O. This branch produces
//      no H+; measured source-fluid acidity is carried independently.
//   3. Native sulfur precipitates from the acidic, partially-oxidized
//      hot fluid in cavities + on vent walls.
//
// Engine fit: supersaturation_native_sulfur in js/36-supersat-native.ts
// gates on (S_elemental ≥ 100, O₂ in [0.1, 0.7], pH ≤ 5,
// metal_sum ≤ 100, T 20-95°C
// optimal). Sulphur Bank fluid matches all five.
//
// 3 handlers — fresh H₂S pulse, surface O₂ ingress, late cooling.

function event_sulphur_bank_h2s_recharge(c) {
  // Fresh hot fluid rises from the underlying Pleistocene volcanic
  // source. H₂S replenishes, T rebounds. The recharge gives the
  // vent a fresh S supply after the previous batch oxidized to S°.
  //
  // flow_rate kept low (0.2) — Sulphur Bank vents are slow-flowing,
  // and ambient_cooling's pH-recovery clause scales with flow_rate
  // (recovery = 0.1 × min(flow/1.0, 2.0) per step). Higher
  // flow_rates would push pH up faster than the recharge pushes it
  // down, defeating the synproportionation window.
  addSulfurToPool(c.fluid, 'sulfide', 150, c.temperature);
  c.fluid.Fe += 5;             // minor Fe co-pulse (pyrite/marcasite contribution)
  c.fluid.As += 2;             // trace As (Sulphur Bank ores carry minor arsenopyrite/realgar)
  c.fluid.pH = Math.max(1.5, c.fluid.pH - 1.0);  // hard acidification — H₂S overwhelms recovery
  c.temperature = Math.min(85, c.temperature + 8);
  c.flow_rate = 0.2;
  return `Hot H₂S-rich pulse rises from the underlying volcanic source. S replenishes to ${c.fluid.S.toFixed(0)} ppm; pH drops to ${c.fluid.pH.toFixed(1)}; T rebounds to ${c.temperature.toFixed(0)}°C. Synproportionation cycle restarts.`;
}

function event_sulphur_bank_surface_oxidation(c) {
  // Atmospheric O₂ infiltrates the vent zone (open hot spring, not
  // sealed cavity). O₂ stays IN the [0.1, 0.7] synproportionation
  // window — the native_sulfur engine fires here. Above 0.7 the
  // engine shuts off (excess O₂ oxidizes S° to SO₄²⁻ instead of
  // leaving it as S°); above 1.0 dissolution kicks in.
  //
  // O₂ pinned to 0.4 = the peak of nativeRedoxTent(peakO2=0.4).
  // This is the synproportionation sweet spot.
  const reaction = oxidizeReducedSulfurToElemental(c.fluid, 0.20, 0.40);
  c.flow_rate = 0.3;
  return `Atmospheric O₂ ingress transfers ${reaction.sulfurTransferredPpm.toFixed(1)} ppm reduced S into an elemental-S precursor pool. The open boundary imports ${reaction.oxygenImportedPpm.toFixed(1)} ppm O₂-equivalent and consumes ${reaction.oxygenConsumedPpm.toFixed(1)} ppm, leaving O₂=${c.fluid.O2.toFixed(2)}. H₂S + ½O₂ → S° + H₂O produces no H⁺; source-fluid acidity remains ${c.fluid.pH.toFixed(1)}.`;
}

function event_sulphur_bank_cooling(c) {
  // Surface cooling — winter / reduced vent activity. T drops to
  // 50-55°C, the α-sulfur bipyramidal sweet spot per the engine's
  // habit dispatcher (T < 60 → bipyramidal_alpha; T 60-95 + high σ →
  // sublimation_crust; T ≥ 95 → prismatic_beta). Lower T favors the
  // iconic {111} dipyramid habit.
  c.temperature = Math.max(45, c.temperature - 20);
  c.flow_rate = 0.1;            // vent flow slows further during cool spell
  return `Surface cools to ${c.temperature.toFixed(0)}°C. Below 60°C, native_sulfur switches to the iconic α-bipyramidal habit (the {111} dipyramid form, bright yellow). The vent flow slows as the thermal pulse fades.`;
}
