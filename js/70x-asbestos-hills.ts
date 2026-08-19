// ============================================================
// js/70x-asbestos-hills.ts — paired tiger's-eye origin models
// ============================================================
// Both scenarios begin with low-grade metamorphic crocidolite in banded
// iron formation, consistent with Miyano & Klein (1983). They then diverge:
//
//  * Heaney & Fisher (2003): quartz and crocidolite grow synchronously in
//    an antitaxial crack-seal vein; later oxidation changes colour while the
//    fibre bands remain.
//  * Gutzmer, Beukes & Cairncross (2004): an older crocidolite seam is
//    altered in a shallow silicified/goethitized zone. The code requires a
//    real, accepted oxidative crocidolite loss zone before tiger's eye can
//    nucleate.
//
// The 40–60 C weathering temperatures are declared numerical proxies for a
// near-surface reaction window, not locality fluid-inclusion thermometry.

function _asbestosHillsAddSilicaBoundary(c, source, targetPpm) {
  const before = Math.max(0, Number(c.fluid.SiO2) || 0);
  const added = Math.max(0, targetPpm - before);
  if (typeof c.fluid.addReactiveSilica === 'function') c.fluid.addReactiveSilica(added);
  else c.fluid.SiO2 += added;
  declareFluidBoundaryAddition(c, source, { SiO2: added });
  return added;
}

function event_asbestos_hills_crack_seal_oxidation(c) {
  if (c._scenario) c._scenario.tiger_eye_stage = 'post_growth_oxidation';
  c.temperature = 60;
  c.pressure = 0.001;
  c.wall.confining_pressure_kbar = 0.001;
  c.fluid.pH = 7.3;
  c.fluid.O2 = 0.78;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  declareFluidBoundaryReplacement(
    c,
    'Asbestos Hills oxidizing meteoric-water replacement',
    { O2: c.fluid.O2 },
  );
  c.flow_rate = 0.18;
  return `Exhumation brings the crack-seal vein to the atmospheric pressure floor (0.001 kbar) for its later oxidation stage. Oxygen rises to ${c.fluid.O2.toFixed(2)} at a declared 60°C weathering proxy. Crocidolite fibres and the synchronous SiO₂ framework are preserved: a booked Fe-state colour overprint records oxidation with zero later quartz growth.`;
}

function event_asbestos_hills_surficial_silicification(c) {
  if (c._scenario) c._scenario.tiger_eye_stage = 'surficial_silicification';
  c.temperature = 60;
  c.pressure = 0.001;
  c.wall.confining_pressure_kbar = 0.001;
  c.fluid.pH = 7.2;
  c.fluid.O2 = 0.82;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  declareFluidBoundaryReplacement(
    c,
    'Asbestos Hills planation-surface oxidizing-water replacement',
    { O2: c.fluid.O2 },
  );
  c.flow_rate = 0.3;
  const silicaAdded = _asbestosHillsAddSilicaBoundary(
    c,
    'Asbestos Hills planation-surface silicification boundary',
    900,
  );
  return `Exhumation reaches the planation-surface alteration zone at the simulator's atmospheric pressure floor (0.001 kbar). At a declared 60°C process proxy, oxidizing water adds ${silicaAdded.toFixed(0)} ppm reactive SiO₂. Tiger's eye remains blocked until the growth ledger accepts an oxidative crocidolite loss zone.`;
}

function event_asbestos_hills_surficial_maturation(c) {
  c.temperature = 40;
  c.fluid.pH = 6.9;
  c.fluid.O2 = 1.0;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  declareFluidBoundaryReplacement(
    c,
    'Asbestos Hills waning oxidizing-water replacement',
    { O2: c.fluid.O2 },
  );
  c.flow_rate = 0.12;
  const silicaAdded = _asbestosHillsAddSilicaBoundary(
    c,
    'Asbestos Hills waning silica-rich weathering boundary',
    1000,
  );
  return `Silicification matures in the shallow weathering zone: T 40°C proxy, O₂ ${c.fluid.O2.toFixed(2)}, and ${silicaAdded.toFixed(0)} ppm additional reactive SiO₂. Hematite/goethite colour and quartz growth overprint the accepted alteration fabric.`;
}
