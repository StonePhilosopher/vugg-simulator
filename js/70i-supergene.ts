// ============================================================
// js/70i-supergene.ts — events for supergene
// ============================================================
// Extracted from 70-events.ts. 9 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- supergene_oxidation (Tsumeb 1st-stage gossan) ---
// Note: event_supergene_acidification is referenced 4× in the JSON5 spec
// (steps 5/8/12/16) to hold pH near 4 against the limestone wall's
// carbonate buffering. One handler, four event entries.
function event_supergene_acidification(c) {
  c.fluid.pH = 4.0;
  c.fluid.O2 = 1.5;
  c.fluid.S += 20;
  return 'Early acidic supergene phase. Primary sulfides oxidize and release H₂SO₄ — pH drops to 4.0, opening the acid window for the arsenate + sulfate suite (scorodite, jarosite, alunite). Carbonate buffering will reverse this at the meteoric flush; the acid-stable phases form during this short ~15-step window.';
}

function event_supergene_meteoric_flush(c) {
  c.fluid.O2 = 2.2;
  c.fluid.CO3 += 30;
  c.fluid.pH = 6.2;
  c.flow_rate = 1.5;
  return 'Rain infiltrates the soil zone and percolates down, picking up CO₂ and oxygen. Fresh supergene brine — cold, oxygen-rich, slightly acidic. Any remaining primary sulfides are on borrowed time.';
}

function event_supergene_pb_mo_pulse(c) {
  c.fluid.Pb += 40;
  c.fluid.Mo += 25;
  c.fluid.O2 = 2.0;
  c.flow_rate = 2.0;
  return 'A weathering rind breaches: Pb²⁺ and MoO₄²⁻ released simultaneously from an oxidizing galena+molybdenite lens. The Seo et al. (2012) condition for wulfenite formation — both parents dying at once — is met.';
}

function event_supergene_cu_enrichment(c) {
  c.fluid.Cu += 50.0;
  c.fluid.S += 30.0;
  c.fluid.Fe += 10.0;
  c.fluid.O2 = 0.6;
  return 'A primary chalcopyrite lens upslope finishes oxidizing. Cu²⁺ descends with the water table and hits the reducing layer below — the supergene enrichment blanket, where mineable copper ore gets made. Bornite precipitates on the upgradient edge, chalcocite in the core, covellite where S activity is highest. Real orebodies are often 5–10× richer here than in the primary sulfide below.';
}

function event_supergene_dry_spell(c) {
  c.fluid.Ca += 40;
  c.fluid.S += 30;
  c.fluid.O2 = 1.5;
  c.temperature = 50;
  c.flow_rate = 0.3;
  // v25: water table drops to mid-cavity → upper rings go vadose.
  c.fluid_surface_ring = 8.0;
  return "Dry season. Flow slows, evaporation concentrates the brine. Water table drops to mid-cavity. Ca²⁺ and SO₄²⁻ climb toward selenite's window — the desert-rose chemistry, the Naica chemistry. Above the meniscus, the air-exposed walls start to oxidize.";
}

function event_supergene_as_rich_seep(c) {
  c.fluid.As += 8;
  c.fluid.Cl += 10;
  c.fluid.Zn += 20;
  c.fluid.Co += 20;
  c.fluid.Ni += 20;
  c.fluid.pH = 6.0;
  c.temperature = 25;
  return 'An arsenic-bearing seep arrives from a weathering arsenopyrite body upslope, carrying trace cobalt and nickel from parallel oxidizing arsenides. Zn²⁺ saturates adamite; Pb²⁺ saturates mimetite; Co²⁺ and Ni²⁺ begin to bloom as crimson erythrite and apple-green annabergite.';
}

function event_supergene_phosphate_seep(c) {
  c.fluid.P += 6.0;
  c.fluid.Cl += 5.0;
  c.fluid.pH = 6.4;
  return "A phosphate-bearing groundwater seeps in from the soil zone — organic decay, weathered apatite bedrock, bat guano from above. P jumps past pyromorphite's saturation threshold, and any Pb still in solution has a new home.";
}

function event_supergene_v_bearing_seep(c) {
  c.fluid.V += 6.0;
  c.fluid.Cl += 8.0;
  c.temperature = 45;
  return "A vanadium-bearing seep arrives from a weathering red-bed ironstone upslope. V⁵⁺ leaches from oxidizing roll-front vanadates, and at Pb + V + Cl saturation the bright red-orange vanadinite nucleates — the classic 'vanadinite on goethite' habit of the Morocco / Arizona desert deposits.";
}

function event_supergene_fracture_seal(c) {
  c.flow_rate = 0.05;
  c.fluid.O2 = 1.0;
  return 'The feeding fractures seal. The vug becomes a closed cold oxidizing system. Whatever is supersaturated will precipitate; whatever is undersaturated will quietly corrode.';
}
