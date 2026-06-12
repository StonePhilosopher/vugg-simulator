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
  // v185: redox is now the declared fluid.Eh movement's sentence (steps
  // 0-110); inside that window the Eh-canonical sync re-derives O2 every
  // step, so this write is superseded (harmlessly — it matches the
  // movement's −200 mV floor). Events keep the chemistry beats.
  c.fluid.O2 = 0.0;
  c.fluid.SiO2 = Math.max(c.fluid.SiO2, 6000);
  return 'The Schneeberg pegmatite differentiates. A reducing residual fluid floods the pocket with uranium, copper, iron, and arsenic. Uraninite grows as pitch-black masses; chalcopyrite plates as brassy disphenoids; arsenopyrite forms steel-gray rhombs. Bismuth is everywhere — Schneeberg\'s first ore was bismuth, three centuries before pitchblende became uranium.';
}

function event_schneeberg_cooling(c) {
  // v163: the post-magmatic vein cools THROUGH the ~180°C bismuth-arsenide
  // window, not straight to ambient. Five-element-vein native bismuth + the
  // Co-Ni arsenides (skutterudite/safflorite/nickeline) crystallize at
  // ~200-150°C during cooling (Markl et al. 2016; Kissin 1992) — the
  // supersaturation_native_bismuth T_factor is 1.0 only in [100,250]°C. The
  // old jump 350→30 skipped this window entirely, so native_bismuth only ever
  // nucleated when the (now-removed) ambient_cooling thermal pulses happened
  // to reheat a ring back into range. T=180 puts the cooling vein squarely in
  // the bismuth-arsenide window; the supergene oxidation onset is deferred to
  // cu_p_phase (step 85, T=25).
  c.temperature = 180;
  c.flow_rate = 0.5;
  return 'The pegmatite system cools through the bismuth-arsenide window (~180°C). Native bismuth crystallizes as silver-white arborescent sheets alongside the Co-Ni arsenides (skutterudite, safflorite, nickeline) — the Erzgebirge "Fünfelementformation". Black uraninite and brassy chalcopyrite are locked in; the vein is not yet touched by oxidation.';
}

function event_schneeberg_cu_p_phase(c) {
  c.temperature = 25;
  // v185: SUPERSEDED by the declared fluid.Eh movement — the meteoric
  // front now arrives as a continuous ~8-step sulfide-buffer-exhaustion
  // swing (steps 84→92) instead of this single-step flip. The event keeps
  // its chemistry half (the P/As/Cu/Ca fork below); the movement is the
  // redox sentence. (Inside the window the Eh-canonical sync overwrites
  // O2 each step, so this write is dead — kept for the narrative record.)
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

// v163: late uplift exhumes the vein — the water table drops and the supergene
// uranyl-mica crusts pass into the vadose zone (dry Erzgebirge mine air). This
// is the geologically-correct VADOSE driver for the meta- forms (torbernite →
// metatorbernite, zeunerite → metazeunerite, autunite → meta-autunite): "the
// trip from a damp mine to a dry display case" (research-autunite.md), the
// dry_exposure_steps path in DEHYDRATION_TRANSITIONS (75-transitions). Pre-v163
// the meta- forms relied on the SPURIOUS ambient_cooling thermal-pulse heat
// path (rings reheated >75°C inside a 20°C supergene pocket); v162 turned those
// pulses off for schneeberg (wall.thermal_pulses:false) and this event supplies
// the honest mechanism. Fires at step 110 — after torbernite (85) + zeunerite
// (105) have nucleated, with 50 steps left so their host rings clear the
// 40-step vadose threshold; the remaining Ca-uranyl chemistry (cu_depletion
// 125, as_pulse_late 145) then plays out in the oxidizing vadose zone.
function event_schneeberg_vadose_exhumation(c) {
  c.temperature = 20;
  c.fluid_surface_ring = 2.0;
  c.flow_rate = 0.1;
  return 'Late uplift exhumes the Schneeberg vein. The water table drops below the pocket; the emerald torbernite and brassy zeunerite plates pass into the vadose zone and begin losing their structural water in the dry mine air — torbernite → metatorbernite, zeunerite → metazeunerite. Weisbach\'s 1872 type material was already the meta- form by the time it reached his bench.';
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
