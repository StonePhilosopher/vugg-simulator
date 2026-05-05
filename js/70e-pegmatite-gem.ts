// ============================================================
// js/70e-pegmatite-gem.ts — events for pegmatite gem
// ============================================================
// Extracted from 70-events.ts. 15 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- ouro_preto (Imperial Topaz veins, Minas Gerais BR) ---
function event_ouro_preto_vein_opening(c) {
  c.fluid.SiO2 += 150;
  c.temperature = 380;
  c.flow_rate = 1.5;
  return 'The fracture opens. Fluid pressure exceeded lithostatic pressure and the vein propagated upward — narrow, barely wider than your hand. Fresh hot brine floods in at 380°C and quartz starts lining the walls. The fluorine in the fluid is still below saturation; topaz holds its breath.';
}

function event_ouro_preto_f_pulse(c) {
  c.fluid.F += 30.0;
  c.fluid.Al += 8.0;
  c.temperature = 365;
  c.flow_rate = 1.2;
  return `A deeper wall of phyllite reaches the dehydration point. Fluorine-bearing micas break down and release F⁻ into the vein fluid — F jumps to ${c.fluid.F.toFixed(0)} ppm, past the topaz saturation threshold. The chemistry has just tipped. Imperial topaz is now thermodynamically inevitable.`;
}

function event_ouro_preto_cr_leach(c) {
  c.fluid.Cr += 4.0;
  c.temperature = 340;
  return `The vein system intersects an ultramafic dike on its way up. Chromium leaches into the fluid — Cr now ${c.fluid.Cr.toFixed(1)} ppm, above the imperial-color window. Any topaz growing from this pulse forward will catch Cr³⁺ in its structure. Golden-orange is committed to the crystal.`;
}

function event_ouro_preto_steady_cooling(c) {
  c.temperature = 320;
  c.flow_rate = 1.0;
  return 'The main topaz growth phase. The vein cools steadily — 320°C now — and topaz is happily projecting from the quartz-lined walls. Slow, clean layer-by-layer growth. The crystals are recording the thermal history in their growth zones and fluid inclusions; a microprobe traverse across one of these crystals would read like a barometer.';
}

function event_ouro_preto_late_hydrothermal(c) {
  c.temperature = 220;
  c.fluid.pH = 5.5;
  c.flow_rate = 0.6;
  return "Late-stage dilute hydrothermal fluid — pH falling, F depleted by topaz growth. Kaolinite begins replacing any remaining feldspar in the wall rock; the vein walls soften. Topaz's perfect basal cleavage means any shift in the wall can snap a crystal off its base. Cleavage fragments will accumulate on the pocket floor.";
}

function event_ouro_preto_oxidation_stain(c) {
  c.temperature = 90;
  c.fluid.O2 = 1.6;
  c.fluid.Fe += 20;
  c.flow_rate = 0.3;
  return 'Surface water finds the vein. The system oxidizes — meteoric O₂ reaches the pocket, iron precipitates as goethite, and the final topaz generation sits in a limonite-stained matrix. The assemblage that garimpeiros will find in 400 Ma is now fully set.';
}

function event_ouro_preto_final_cooling(c) {
  c.temperature = 50;
  c.flow_rate = 0.05;
  return 'The vein cools to near-ambient. What remains is the assemblage: milky quartz lining the walls, imperial topaz prisms projecting inward, fluid inclusion planes across every crystal, iron-stained fractures. The exhalation has finished. The vug now waits for time.';
}

// --- gem_pegmatite (Cruzeiro mine, Doce Valley MG) ---
function event_gem_pegmatite_outer_shell(c) {
  c.temperature = 620;
  c.flow_rate = 1.0;
  return "The outer pegmatite shell is already cooling. Microcline and quartz dominate the wall zone, growing inward into the void. The pocket fluid inside is enriched in the elements nothing else wanted: beryllium, boron, lithium, fluorine. They haven't crossed any saturation thresholds yet — they are simply accumulating.";
}

function event_gem_pegmatite_first_schorl(c) {
  c.temperature = 560;
  c.flow_rate = 0.9;
  return "The pocket has cooled enough that tourmaline can form. Boron has been accumulating in the fluid for thousands of years; with Fe²⁺ still abundant, the schorl variety nucleates. Deep black prisms begin projecting from the wall. Each new zone records a fluid pulse — the striations are the pocket's diary.";
}

function event_gem_pegmatite_albitization(c) {
  c.fluid.K = Math.max(c.fluid.K - 30, 10);
  c.fluid.Na += 40;
  c.fluid.Al += 10;
  c.fluid.pH += 0.2;
  c.temperature = 500;
  return "Albitization event. The pocket's K has depleted faster than its Na — microcline starts dissolving and albite begins precipitating in its place. K²⁺ returns to the fluid, enabling a second generation of mica-like phases. This replacement cascade is the most Minas Gerais thing about a Minas Gerais pegmatite: the pocket is rearranging itself.";
}

function event_gem_pegmatite_be_saturation(c) {
  c.temperature = 450;
  c.flow_rate = 0.8;
  return "Beryllium has been accumulating for a dozen thousand years. Every earlier mineral refused it. Now σ crosses 1.8 and the first beryl crystal nucleates. Because Be had so long to build, the crystal has a lot of material waiting — this is how meter-long beryls form. What color depends on who else is in the fluid. Morganite if Mn won the lottery; aquamarine if Fe did; emerald if Cr leached in from an ultramafic contact somewhere.";
}

function event_gem_pegmatite_li_phase(c) {
  c.temperature = 420;
  c.fluid.Fe = Math.max(c.fluid.Fe - 20, 5);
  return "Temperature drops into the 400s. Lithium, which has been accumulating since the beginning, is now abundant enough to nucleate Li-bearing minerals. Spodumene will take most of it — the Li pyroxene wants its own crystals. Any remaining Li goes into elbaite overgrowths on the schorl cores: the crystals become color-zoned as iron depletes and lithium takes its place.";
}

function event_gem_pegmatite_late_hydrothermal(c) {
  c.temperature = 360;
  c.fluid.pH = 5.5;
  c.flow_rate = 0.5;
  return "Late hydrothermal phase. Temperature drops into topaz's optimum window (340–400°C). Fluorine has been sitting unused — nothing else in this pocket consumed it — and enough Al remains in the residual pocket fluid after the main silicate crop has taken its share. Topaz nucleates, projecting from the quartz lining.";
}

function event_gem_pegmatite_clay_softening(c) {
  c.temperature = 320;
  c.fluid.pH = 3.5;
  c.flow_rate = 0.3;
  return "pH drops into the kaolinization window. Microcline in the pocket walls starts breaking down into kaolinite — the signature 'clay gloop' that coats every Minas Gerais gem pocket by the time garimpeiros crack it open. The reaction 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite + 2 K⁺ + 4 SiO₂ releases potassium and silica to the fluid, but the aluminum stays locked in the new kaolinite. Albite is more acid-resistant and survives intact — a field observation preserved in the sim.";
}

function event_gem_pegmatite_final(c) {
  c.temperature = 300;
  c.flow_rate = 0.1;
  return "The system cools to 300°C, below spodumene's window and approaching topaz's lower edge. Growth slows to near-zero. Deep time will do the rest: this pocket will wait half a billion years before human hands crack it open, and the garimpeiros will sort the crystals by color in the order the fluid deposited them.";
}
