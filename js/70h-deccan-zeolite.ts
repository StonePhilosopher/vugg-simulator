// ============================================================
// js/70h-deccan-zeolite.ts — events for deccan zeolite
// ============================================================
// Extracted from 70-events.ts. 5 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- deccan_zeolite ---
function event_deccan_zeolite_silica_veneer(c) {
  c.fluid.SiO2 += 400;
  c.fluid.O2 = 0.9;
  c.temperature = 200;
  return 'Stage I — hot post-eruption hydrothermal fluid coats the vesicle wall with a fibrous chalcedony lining. This silica-only veneer establishes the substrate before the separately authored iron pulse arrives.';
}

function event_deccan_zeolite_hematite_pulse(c) {
  // This is an Fe-Si hydrothermal replenishment, not an iron-only paint
  // operation. The dissolved-silica rise creates a measured activity reversal
  // in the agate; the later maturation event lowers it into the quartz window.
  c.fluid.addReactiveSilica(150);
  // Fe is delivered here rather than preloaded into the initial fluid. That
  // makes the preserved hematite generation testimony of this authored pulse,
  // not an engine-permitted step-zero precursor that contradicts the story.
  c.fluid.Fe += 310;
  c.fluid.O2 = 1.0;
  c.temperature = 175;
  return "An iron- and silica-bearing pulse threads through the vesicle, recording a genuine silica-activity reversal in the agate rind. Hematite needles seed the surfaces of any growing apophyllite. When the apophyllite resumes crystallization, those needles get trapped in the next growth zone — the Nashik 'bloody apophyllite' phantom band.";
}

function event_deccan_quartz_maturation(c) {
  const qEq = c.silica_equilibrium(c.effectiveTemperature);
  const chEq = c.chalcedony_equilibrium(c.effectiveTemperature);
  c.fluid.SiO2 = Math.max(qEq * 1.25, Math.min(chEq * 1.08, qEq * 1.35));
  c.fluid.reactiveSilicaFraction = 1.0;
  c.flow_rate = 0.35;
  return `Stage I maturation — silica activity falls below the fresh-chalcedony barrier while remaining ${(c.fluid.SiO2 / qEq).toFixed(2)}× quartz equilibrium; inward euhedral quartz now grows on the fibrous lining.`;
}

function event_deccan_zeolite_stage_ii(c) {
  c.fluid.Ca += 80;
  c.fluid.Na = Math.max(c.fluid.Na, 150);
  // Basalt-derived Al and carbonate belong to the Stage-II groundwater
  // regime. Holding them back until this event prevents albite/epidote,
  // calcite and zeolites from pre-empting the Stage-I silica lining.
  c.fluid.Al += 15;
  c.fluid.CO3 += 80;
  c.fluid.SiO2 += 200;
  c.fluid.pH = 8.5;
  c.temperature = 130;
  return 'Stage IIa — the first zeolite generation enters the middle-zone cavity. Radiating scolecite sprays and hair-like mesolite tufts crystallize on the silica lining. Sukheswala et al. (1974) observed these two as the first zeolites in this Deccan cavity sequence; the authored nucleation window keeps the later sheet zeolites from pre-empting their testimony.';
}

function event_deccan_zeolite_stage_ii_sheets(c) {
  // A distinct higher-silica recharge expresses the observed hand-off
  // from the fibrous natrolite group to the more hydrous sheet zeolites. It is
  // not an arbitrary clock delay: the event changes the controlling fluid.
  c.fluid.K += 10;
  c.fluid.Al += 8;
  c.fluid.SiO2 += 300;
  c.fluid.pH = 8.5;
  c.temperature = 130;
  return 'Stage IIb — a more silica-rich recharge follows the fibrous generation. Coffin-shaped heulandite tablets and peach stilbite sheaves now overgrow the earlier scolecite–mesolite lining. This pairwise order follows the Western Deccan cavity observations of Sukheswala et al. (1974); their exact order within each coeval pair is intentionally not claimed.';
}

function event_deccan_zeolite_apophyllite_stage_iii(c) {
  c.fluid.K += 25;
  c.fluid.Ca += 50;
  c.fluid.SiO2 += 600;  // bumped from 300 to 600 (canonical 5740371) — apophyllite gate needs SiO2 >= 800, and background quartz depletes SiO2 aggressively (v17 silica_equilibrium fix). 600 gives headroom above the gate.
  c.fluid.F += 4;
  c.fluid.pH = 8.8;
  c.temperature = 150;
  return "Stage III — the apophyllite-bearing pulse arrives, alkaline K-Ca-Si-F groundwater. Per Ottens et al. 2019 this is the long-lasting late stage, 21–58 Ma after the original eruption. The pseudo-cubic apophyllite tablets begin to crystallize on the wall, on the chalcedony, on the hematite needles already present — wherever a nucleation site offers itself.";
}

function event_deccan_zeolite_late_cooling(c) {
  c.temperature = 80;
  // The long-lived Stage-III aquifer has shut off. Preserve enough dissolved
  // silica for continued growth of the documented lining while staying below
  // amorphous-silica equilibrium throughout
  // the modeled 80-to-68 C cooling interval (about 281-to-238 ppm). This is a
  // depleted residual fluid, not a fresh opal-sinter pulse.
  c.fluid.SiO2 = Math.min(c.fluid.SiO2, 230);
  // The terminal zeolite-bearing groundwater is compositionally distinct from
  // the exhausted Stage-III apophyllite aquifer. Retain the documented Na-Ca-
  // Al framework supply without restoring silica to opal supersaturation.
  c.fluid.Ca = Math.max(c.fluid.Ca, 200);
  c.fluid.Na = Math.max(c.fluid.Na, 150);
  c.fluid.Al = Math.max(c.fluid.Al, 30);
  c.fluid.reactiveSilicaFraction = 1.0;
  c.fluid.pH = 8.0;
  c.flow_rate = 0.1;
  return 'Late cooling after the Stage-III aquifer shuts off. The depleted residual fluid remains below amorphous-silica saturation, so the established lining can finish without inventing a terminal opal-sinter stage. Apophyllite growth slows to micron-thin zones; time becomes the limiting reagent.';
}
