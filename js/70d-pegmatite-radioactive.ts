// ============================================================
// js/70d-pegmatite-radioactive.ts — events for pegmatite radioactive
// ============================================================
// Extracted from 70-events.ts. 10 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- radioactive_pegmatite ---
function event_radioactive_pegmatite_crystallization(c) {
  c.temperature = 450;
  c.fluid.SiO2 += 3000; // late-stage silica release from melt
  return 'The pegmatite melt differentiates. Volatile-rich residual fluid floods the pocket. Quartz begins to grow in earnest — large, clear crystals claiming space. Uraninite cubes nucleate where uranium concentration is highest.';
}

function event_radioactive_pegmatite_deep_time(c) {
  c.temperature = 300;
  return 'Deep time passes. The uraninite sits in its cradle of cooling rock, silently emitting alpha particles. Each decay transmutes one atom of uranium into lead. The quartz growing nearby doesn\'t know it yet, but it\'s darkening.';
}

function event_radioactive_pegmatite_oxidizing(c) {
  c.fluid.O2 += 0.8;
  c.temperature = 120;
  c.flow_rate = 1.5;
  return 'Oxidizing meteoric fluids seep through fractures. The reducing environment shifts. Sulfides become unstable. The uraninite begins to weather — pitchy edges yellowing as U⁴⁺ goes back into solution as soluble uranyl ion.';
}

function event_radioactive_pegmatite_final_cooling(c) {
  c.temperature = 50;
  c.flow_rate = 0.1;
  return 'The system cools to near-ambient. What remains is a pegmatite pocket: black uraninite cubes, smoky quartz darkened by radiation, and galena crystallized from the lead that uranium became. Time wrote this assemblage. Chemistry just held the pen.';
}

// --- schneeberg (Round 9e mechanic-coverage scenario, May 2026) ---
function event_schneeberg_pegmatite_crystallization(c) {
  c.temperature = 350;
  c.fluid.O2 = 0.0;
  c.fluid.SiO2 = Math.max(c.fluid.SiO2, 6000);
  return 'The Schneeberg pegmatite differentiates. A reducing residual fluid floods the pocket with uranium, copper, iron, and arsenic. Uraninite grows as pitch-black masses; chalcopyrite plates as brassy disphenoids; arsenopyrite forms steel-gray rhombs. Bismuth is everywhere — Schneeberg\'s first ore was bismuth, three centuries before pitchblende became uranium.';
}

function event_schneeberg_cooling(c) {
  c.temperature = 30;
  c.flow_rate = 0.5;
  return 'The pegmatite system cools toward ambient. Primary crystallization closes. The vug holds black uraninite, brassy chalcopyrite, and steel-gray arsenopyrite — a characteristic Erzgebirge primary assemblage, not yet touched by oxidation.';
}

function event_schneeberg_cu_p_phase(c) {
  c.temperature = 25;
  c.fluid.O2 = 1.5;
  c.fluid.pH = 6.0;
  c.flow_rate = 1.5;
  c.fluid.P = Math.max(c.fluid.P, 18.0);
  c.fluid.As = Math.min(c.fluid.As, 4.0);
  c.fluid.Cu = Math.max(c.fluid.Cu, 70.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 35.0);
  return 'Meteoric water seeps through fractures and floods the system with oxygen. Uraninite begins weathering — its U⁴⁺ flips to soluble UO₂²⁺ uranyl. Chalcopyrite oxidizes; Cu²⁺ enters solution alongside the uranyl. Arsenopyrite weathering is delayed (steeper kinetic barrier), so phosphate dominates the anion pool. Emerald-green torbernite plates begin appearing on the dissolving uraninite — the diagnostic Schneeberg habit, the museum-classic.';
}

function event_schneeberg_cu_as_pulse(c) {
  c.temperature = 22;
  c.fluid.As = Math.max(c.fluid.As, 22.0);
  c.fluid.P = Math.min(c.fluid.P, 4.0);
  c.fluid.Cu = Math.max(c.fluid.Cu, 55.0);
  c.fluid.Ca = Math.min(c.fluid.Ca, 35.0);
  return 'The arsenopyrite has been steadily oxidizing in the background, and now it catches up. Arsenate floods the fluid — As pulls past P as the dominant anion. Cu is still in the pool, ahead of Ca. The same chemistry stage as torbernite but with arsenate instead of phosphate: zeunerite, the species Weisbach described from this very mine in 1872. Visually indistinguishable from torbernite; the chemistry is the only honest test.';
}

function event_schneeberg_cu_depletion(c) {
  c.temperature = 20;
  c.fluid.Cu = Math.min(c.fluid.Cu, 5.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.P = Math.max(c.fluid.P, 18.0);
  c.fluid.As = Math.min(c.fluid.As, 4.0);
  return 'Copper has been pulled out of the fluid by the green plates. The cation pool flips: calcium, sourced from the carbonate buffer in the pegmatite country rock, takes over. P replenishes from continuing apatite weathering. The same uranyl-phosphate chemistry that grew torbernite now grows autunite — bright canary yellow instead of emerald green, and crucially, fluorescent. Where Cu²⁺ killed the uranyl emission cold, Ca²⁺ leaves it lit.';
}

function event_schneeberg_as_pulse_late(c) {
  c.temperature = 18;
  c.fluid.As = Math.max(c.fluid.As, 22.0);
  c.fluid.P = Math.min(c.fluid.P, 4.0);
  c.fluid.Ca = Math.max(c.fluid.Ca, 100.0);
  c.fluid.Cu = Math.min(c.fluid.Cu, 5.0);
  c.flow_rate = 0.3;
  return 'The arsenate replenishes one final time as the last arsenopyrite grains weather. Ca is still dominant, As is now dominant: uranospinite, the calcium analog of zeunerite. Same mine, same vein, same uranyl ion — but where zeunerite was dead under UV, this one glows yellow-green. Weisbach described it in 1873, the year after he characterized zeunerite a hundred meters away. Four uranyl species in one vug, the cation+anion fork mechanic finally written into the rock.';
}
