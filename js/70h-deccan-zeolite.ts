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
  c.fluid.Fe += 50;
  c.fluid.O2 = 0.9;
  c.temperature = 200;
  return "Stage I — hot post-eruption hydrothermal fluid coats the vesicle wall with chalcedony. Silica activity peaks; iron stripped from the basalt groundmass deposits as hematite needles on the chalcedony rind. These needles will become the seeds for the 'bloody apophyllite' phantom inclusions in Stage III.";
}

function event_deccan_zeolite_hematite_pulse(c) {
  c.fluid.Fe += 80;
  c.fluid.O2 = 1.0;
  c.temperature = 175;
  return "An iron-bearing pulse threads through the vesicle. Hematite needles seed the surfaces of any growing apophyllite. When the apophyllite resumes crystallization, those needles get trapped in the next growth zone — the Nashik 'bloody apophyllite' phantom band.";
}

function event_deccan_zeolite_stage_ii(c) {
  c.fluid.Ca += 80;
  c.fluid.K += 10;
  c.fluid.SiO2 += 200;
  c.fluid.pH = 8.5;
  c.temperature = 130;
  return 'Stage II — zeolite blades begin to fill the vesicle. Stilbite, scolecite, heulandite (modeled here as the zeolite paragenesis pH/Si signature). Calcite forms as a late-stage carbonate. The vug is filling slowly.';
}

function event_deccan_zeolite_apophyllite_stage_iii(c) {
  c.fluid.K += 25;
  c.fluid.Ca += 50;
  c.fluid.SiO2 += 300;
  c.fluid.F += 4;
  c.fluid.pH = 8.8;
  c.temperature = 150;
  return "Stage III — the apophyllite-bearing pulse arrives, alkaline K-Ca-Si-F groundwater. Per Ottens et al. 2019 this is the long-lasting late stage, 21–58 Ma after the original eruption. The pseudo-cubic apophyllite tablets begin to crystallize on the wall, on the chalcedony, on the hematite needles already present — wherever a nucleation site offers itself.";
}

function event_deccan_zeolite_late_cooling(c) {
  c.temperature = 80;
  c.fluid.pH = 8.0;
  c.flow_rate = 0.1;
  return 'Late cooling. The vesicle fluid drops back toward ambient. Apophyllite growth slows but doesn\'t stop entirely; the remaining K-Ca-Si-F supersaturation keeps adding micron-thin growth zones on the existing crystals. Time, not chemistry, becomes the limiting reagent.';
}
