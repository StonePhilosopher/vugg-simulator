// ============================================================
// js/70j-bisbee.ts — events for bisbee
// ============================================================
// Extracted from 70-events.ts. 9 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- bisbee (Warren Mining District, AZ — Cu porphyry + supergene + azurite/malachite/chrysocolla cascade) ---
function event_bisbee_primary_cooling(c) {
  c.temperature = 320;
  c.fluid.SiO2 += 100;
  c.fluid.Cu -= 50;
  c.fluid.O2 = 0.08;
  c.flow_rate = 1.2;
  return 'The Sacramento Hill porphyry finishes its main crystallization pulse. Chalcopyrite and bornite precipitate in the vein selvages of the Escabrosa mantos — Cu:Fe:S in the magmatic ratio. Pyrite frames the assemblage, locked in at 300+ °C. The ore body is set. For 180 million years, nothing will happen.';
}

function event_bisbee_uplift_weathering(c) {
  c.temperature = 35;
  c.fluid.pH = 4.0;
  c.fluid.O2 = 0.8;
  c.fluid.S += 80;
  c.fluid.Cu += 100;
  c.fluid.Fe += 50;
  c.flow_rate = 1.8;
  return 'Mesozoic–Cenozoic uplift tips the Warren basin and strips the Cretaceous cover. Meteoric water percolates down through fractures, hitting pyrite; sulfuric acid is the first product. The pH crashes to 4, and Cu²⁺ starts descending with the water table. This is the enrichment pulse — primary ore above is dissolving, concentrating its copper at the redox interface below.';
}

function event_bisbee_enrichment_blanket(c) {
  c.temperature = 30;
  c.fluid.Cu += 80;
  c.fluid.S += 40;
  c.fluid.O2 = 0.6;
  c.fluid.pH = 4.5;
  c.flow_rate = 1.3;
  return 'The descending Cu²⁺-bearing fluid reaches the reducing layer just below the water table. Chalcocite replaces chalcopyrite atom-for-atom — the Bisbee enrichment blanket, 5–10× the primary grade. Covellite forms where S activity is highest. This is the mineable ore. For two generations of miners, this is what Bisbee MEANS.';
}

function event_bisbee_reducing_pulse(c) {
  c.fluid.O2 = 0.05;
  c.fluid.S = 15;
  c.fluid.Cu += 150;
  c.fluid.pH = 6.0;
  c.temperature = 28;
  c.flow_rate = 1.1;
  return "A barren reducing fluid pulses up from depth — lower than any water table. For a few thousand years the pocket's Eh is below cuprite stability. Native copper precipitates in the fracture selvages as arborescent sheets and wire. The Bisbee native-copper specimens — the Cornish-style copper trees — are products of exactly these brief windows.";
}

function event_bisbee_oxidation_zone(c) {
  c.temperature = 25;
  c.fluid.O2 = 1.0;
  c.fluid.pH = 6.2;
  c.fluid.S = Math.max(c.fluid.S - 60, 20);
  c.fluid.Cu += 40;
  c.fluid.Fe -= 30;
  c.fluid.CO3 += 30;
  c.flow_rate = 1.0;
  return 'The water table drops another 50 meters. The enrichment blanket is now in the unsaturated zone — oxygen reaches it directly. Cuprite forms where the Eh is still low; native copper sheets grow in the fractures where reducing pockets survive. The limestone walls are finally participating — pH climbs toward neutral, and CO₃ rises with it.';
}

function event_bisbee_azurite_peak(c) {
  c.fluid.CO3 += 80;
  c.fluid.Cu += 30;
  c.fluid.O2 = 1.3;
  c.fluid.pH = 7.0;
  c.flow_rate = 0.9;
  return "A monsoon season — the first in many. CO₂-charged rainwater infiltrates fast, dissolves limestone aggressively, and hits the copper pocket at pH 7 with CO₃ at 110+ ppm. Azurite — deep midnight-blue monoclinic prisms and radiating rosettes — nucleates from the supersaturated brine. This phase produces the showpiece 'Bisbee Blue' specimens.";
}

function event_bisbee_co2_drop(c) {
  c.fluid.CO3 = Math.max(c.fluid.CO3 - 120, 50);
  c.fluid.O2 = 1.4;
  c.fluid.pH = 6.8;
  c.flow_rate = 0.7;
  return "The climate dries. Without CO₂-charged infiltration the pocket's pCO₂ falls below azurite's stability — every azurite crystal in the vug starts converting. The color shift creeps crystal-by-crystal: deep blue → green rind → green core. Vink (1986) put the crossover at log(pCO₂) ≈ −3.5 at 25 °C, right where we are. Malachite pseudomorphs after azurite are the diagnostic Bisbee specimen — frozen mid-transition.";
}

function event_bisbee_silica_seep(c) {
  c.fluid.SiO2 += 90;
  c.fluid.Cu += 20;
  c.fluid.CO3 = Math.max(c.fluid.CO3 - 30, 20);
  c.fluid.pH = 6.5;
  c.fluid.O2 = 1.3;
  c.flow_rate = 0.8;
  return 'A new seep arrives — from weathering of the Sacramento Hill quartz-monzonite porphyry uphill, not the limestone. It brings dissolved SiO₂ at 100+ ppm. Where this fluid meets the Cu²⁺ still in solution the cyan enamel of chrysocolla precipitates: thin films over cuprite, botryoidal crusts on native copper, and — the Bisbee centerpiece — pseudomorphs replacing the last azurite blues.';
}

function event_bisbee_final_drying(c) {
  c.temperature = 20;
  c.flow_rate = 0.1;
  c.fluid.O2 = 1.0;
  // v25: complete drain — every ring becomes vadose.
  c.fluid_surface_ring = 0.0;
  return "The fractures seal with calcite cement. Groundwater stops. The pocket is a closed system again, this time with the full oxidation assemblage frozen in place: chalcopyrite cores wrapped in chalcocite, those wrapped in cuprite, those overgrown by native copper, those overgrown by azurite, those converted to malachite, those pseudomorphed by chrysocolla. A million years from now, when a mining shaft intersects this pocket, an assayer will photograph the specimen and write 'Bisbee, Cochise County' on the label.";
}
