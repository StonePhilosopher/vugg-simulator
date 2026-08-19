// ============================================================
// js/70q-roughten-gill.ts — Roughton Gill Mine events
// ============================================================
// The scenario id preserves the project's historical "roughten_gill"
// spelling; the locality and modern paper use Roughton Gill.
//
// Bridges et al. (2011, Journal of the Russell Society 14:3–23) is the
// mine-specific authority. It overturns the old scenario interpretation:
// quartz is the dominant gangue, dolomite/calcite are significant, and the
// main primary ores are galena + chalcopyrite + sphalerite. Carbonate
// buffering makes malachite and cerussite the dominant supergene products.
// Linarite is fairly rare, caledonite is known from only a few specimens, and
// leadhillite is very rare; none is the mine's deterministic headline.
// Hemimorphite, pyromorphite and plumbogummite record the later Zn/Pb
// weathering sequence. BGS constrains regional Pb-Zn deposition to 110–130°C.

function _roughtenSetSulfurReplacement(c, source, sulfide, sulfate, elemental = 0) {
  c.fluid.sulfurPoolsExplicit = true;
  c.fluid.S_sulfide = Math.max(0, sulfide);
  c.fluid.S_sulfate = Math.max(0, sulfate);
  c.fluid.S_elemental = Math.max(0, elemental);
  syncExplicitSulfurTotal(c.fluid);
  declareSulfurBoundaryReplacement(c, source, { sulfide, sulfate, elemental });
  c._pending_fluid_replace_fields = Array.from(new Set([
    ...(c._pending_fluid_replace_fields || []),
    'S_sulfide', 'S_sulfate', 'S_elemental',
  ]));
}

function _roughtenOxidizeSulfideToSulfate(c, requestedPpm) {
  ensureExplicitSulfurPools(c.fluid, c.temperature);
  const transferred = Math.min(
    Math.max(0, Number(requestedPpm) || 0),
    Math.max(0, Number(c.fluid.S_sulfide) || 0),
  );
  c.fluid.S_sulfide -= transferred;
  c.fluid.S_sulfate += transferred;
  syncExplicitSulfurTotal(c.fluid);
  return transferred;
}

function event_roughten_gill_primary_carbonate_peak(c) {
  // Bridges et al. describe significant calcite/dolomite with the primary
  // quartz gangue. The corrected PHREEQC/SUPCRTBL path needs the carbonate-
  // rich end of that ore fluid before the stage-60 meteoric replacement;
  // book it as an external boundary pulse instead of altering Ksp or the
  // heterogeneous-nucleation gate to force the occurrence.
  const carbonateTarget = 1200;
  const carbonateAdded = Math.max(0, carbonateTarget - c.fluid.CO3);
  c.fluid.CO3 += carbonateAdded;
  c.fluid.pH = Math.max(c.fluid.pH, 6.6);
  declareCarbonLedgerAddition(
    c,
    'external_import',
    'Roughton Gill primary carbonate-gangue ore fluid',
    carbonateAdded,
  );
  c.flow_rate = Math.max(c.flow_rate, 0.3);
  return `A late primary carbonate-gangue pulse imports ${carbonateAdded.toFixed(0)} ppm CO3-equivalent DIC before ore-stage lockup. At pH ${c.fluid.pH.toFixed(1)}, the documented calcite gangue can nucleate without weakening the corrected thermodynamic gate.`;
}

function event_roughten_gill_primary_lockup(c) {
  // Sixty simulated steps at 130→115°C give the documented quartz-carbonate
  // gangue and base-metal sulfides time to form. The transition is an open
  // hydrologic replacement: waning brine is diluted by cool meteoric water,
  // rather than sulfur simply disappearing from a closed fluid.
  c.temperature = 45;
  _roughtenSetSulfurReplacement(
    c,
    'Roughton Gill waning-ore-brine / meteoric-water replacement',
    35,
    5,
  );
  c.fluid.SiO2 = Math.min(c.fluid.SiO2, 65);
  c.fluid.reactiveSilicaFraction = 1;
  c.fluid.Ca = 180;
  c.fluid.Mg = 60;
  c.fluid.CO3 = 150;
  declareCarbonLedgerReplacement(
    c,
    'Roughton Gill waning-ore-brine / meteoric-water replacement',
    c.fluid.CO3,
  );
  c.fluid.Cu = 45;
  c.fluid.Fe = Math.min(c.fluid.Fe, 4);
  c.fluid.pH = 5.5;
  c.fluid.O2 = 0.2;
  c.fluid.salinity = 3;
  declareFluidBoundaryReplacement(
    c,
    'Roughton Gill waning-ore-brine / meteoric-water replacement',
    {
      SiO2: c.fluid.SiO2,
      Ca: c.fluid.Ca,
      Mg: c.fluid.Mg,
      Cu: c.fluid.Cu,
      Fe: c.fluid.Fe,
    },
  );
  c._pending_fluid_replace_fields = Array.from(new Set([
    ...(c._pending_fluid_replace_fields || []),
    'SiO2', 'Ca', 'Mg', 'CO3', 'Cu', 'Fe', 'pH', 'O2', 'salinity',
  ]));
  c.flow_rate = 0.35;
  return `The 110–130°C ore stage closes after quartz + carbonate gangue and galena–sphalerite–chalcopyrite deposition. Cool meteoric water replaces the waning brine: T 45°C, salinity ${c.fluid.salinity.toFixed(1)}, residual S ${c.fluid.S.toFixed(0)} ppm in explicit sulfide/sulfate pools.`;
}

function event_roughten_gill_deep_weathering(c) {
  // An oxygenated seep crosses weathering ore above the displayed cavity.
  // Metals are therefore an explicit upgradient boundary supply; the local
  // residual reduced-S pool is transferred atom-for-atom to sulfate.
  c.temperature = 34;
  const oxidized = _roughtenOxidizeSulfideToSulfate(c, 30);
  const targets = { Cu: 70, Pb: 95, Zn: 105, Al: 18, P: 10, As: 12, V: 12 };
  const additions: Record<string, number> = {};
  for (const [field, target] of Object.entries(targets)) {
    const before = Math.max(0, Number(c.fluid[field]) || 0);
    c.fluid[field] = Math.max(before, target);
    additions[field] = c.fluid[field] - before;
  }
  declareFluidBoundaryAddition(
    c,
    'Roughton Gill upgradient deep-weathering drainage',
    additions,
  );
  c.fluid.O2 = 1.25;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  c.fluid.pH = 4.8;
  c.flow_rate = 0.7;
  return `Deep weathering seep: oxygenated drainage from upgradient galena–sphalerite–chalcopyrite carries Pb, Zn and Cu into the cavity. ${oxidized.toFixed(1)} ppm sulfur transfers from sulfide to sulfate without changing total sulfur; pH falls to ${c.fluid.pH.toFixed(1)} and existing primary surfaces begin physical dissolution.`;
}

function event_roughten_gill_carbonate_buffering(c) {
  // Dissolution of the documented calcite/dolomite gangue neutralizes the
  // acidic seep. Carbon is booked as an external gangue-derived boundary
  // source; it is not invented by changing pH.
  const carbonateAdded = 145;
  c.fluid.CO3 += carbonateAdded;
  // Carbonate-rich seep water has crossed weathering Cu ore upgradient before
  // mixing with the cavity water. Keep that metal source distinct from the
  // local gangue carbon release instead of hiding Cu inside a pH-buffer event.
  const copperImported = Math.max(0, 150 - c.fluid.Cu);
  c.fluid.Cu += copperImported;
  declareFluidBoundaryAddition(
    c,
    'Roughton Gill carbonate-buffered upgradient Cu-weathering drainage',
    { Cu: copperImported },
  );
  declareCarbonLedgerAddition(
    c,
    'wall_release',
    'Roughton Gill calcite/dolomite gangue dissolution',
    carbonateAdded,
  );
  c.temperature = 27;
  c.fluid.pH = 6.45;
  c.fluid.O2 = 1.4;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  c.flow_rate = 0.4;
  return `Carbonate gangue buffers the oxidation water: ${carbonateAdded} ppm carbonate-equivalent carbon is released from documented calcite/dolomite while carbonate-rich upgradient drainage imports ${copperImported.toFixed(0)} ppm Cu from weathering ore. pH recovers to ${c.fluid.pH.toFixed(2)}, and malachite + cerussite become the dominant Cu/Pb sinks.`;
}

function event_roughten_gill_silica_zinc_weathering(c) {
  // Bridges et al. attribute abundant hemimorphite to sphalerite oxidation
  // plus silica supplied by extensive wall-rock weathering. Maintain a
  // SiO2-dominant (not carbonate-dominant) cold seep so the Zn sink is the
  // hydrated silicate rather than an invented high-temperature willemite.
  c.temperature = 22;
  const silicaTarget = 360;
  const silicaAdded = Math.max(0, silicaTarget - c.fluid.SiO2);
  if (typeof c.fluid.addReactiveSilica === 'function') c.fluid.addReactiveSilica(silicaAdded);
  else c.fluid.SiO2 += silicaAdded;
  const zincImported = Math.max(0, 180 - c.fluid.Zn);
  c.fluid.Zn += zincImported;
  declareFluidBoundaryAddition(
    c,
    'Roughton Gill volcanic-wall and upgradient sphalerite weathering seep',
    { SiO2: silicaAdded, Zn: zincImported },
  );
  c.fluid.Cu = 70;
  declareFluidBoundaryReplacement(
    c,
    'Roughton Gill silica-rich Zn-weathering seep replacement',
    { Cu: c.fluid.Cu },
  );
  c.fluid.CO3 = Math.min(c.fluid.CO3, 120);
  declareCarbonLedgerReplacement(
    c,
    'Roughton Gill silica-rich Zn-weathering seep replacement',
    c.fluid.CO3,
  );
  c._pending_fluid_replace_fields = Array.from(new Set([
    ...(c._pending_fluid_replace_fields || []),
    'Cu', 'CO3',
  ]));
  c.fluid.pH = 6.35;
  c.fluid.O2 = 1.35;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  c.flow_rate = 0.35;
  c.fluid_surface_ring = 8;
  return `Silica-rich Zn weathering seep: extensive volcanic-wall alteration adds ${silicaAdded.toFixed(0)} ppm reactive SiO₂ while oxidizing sphalerite maintains Zn ${c.fluid.Zn.toFixed(0)} ppm. At 22°C, pH ${c.fluid.pH.toFixed(2)}, and SiO₂ > carbonate, hemimorphite is the documented Zn sink. The water table now cuts the cavity at ring 8, leaving an oxic vadose roof above the active seep.`;
}

function event_roughten_gill_plumbogummite_cap(c) {
  c.temperature = 20;
  const targets = { Pb: 70, Al: 24, P: 12 };
  const additions: Record<string, number> = {};
  for (const [field, target] of Object.entries(targets)) {
    const before = Math.max(0, Number(c.fluid[field]) || 0);
    c.fluid[field] = Math.max(before, target);
    additions[field] = c.fluid[field] - before;
  }
  declareFluidBoundaryAddition(
    c,
    'Roughton Gill late phosphate-bearing upgradient drainage',
    additions,
  );
  c.fluid.Cl = Math.min(c.fluid.Cl, 24);
  declareFluidBoundaryReplacement(
    c,
    'Roughton Gill late low-chloride phosphate drainage replacement',
    { Cl: c.fluid.Cl },
  );
  c._pending_fluid_replace_fields = Array.from(new Set([
    ...(c._pending_fluid_replace_fields || []),
    'Cl',
  ]));
  c.fluid.pH = 5.8;
  c.fluid.O2 = 1.2;
  c.fluid.Eh = ehFromO2(c.fluid.O2);
  c.flow_rate = 0.08;
  return `Late phosphate-bearing drainage crosses weathered apatite-rich wall rock. Pb–Al–P inventory and mildly acidic oxic water favor plumbogummite crusts encrusting older pyromorphite, Roughton Gill's type-locality relationship; flow wanes without pretending the rare linarite–caledonite–leadhillite suite was dominant.`;
}

// Save compatibility for pre-SIM-257 local histories. Old event ids resolve to
// the nearest corrected stage rather than preserving the superseded narrative.
function event_roughten_gill_pyrite_oxidation(c) { return event_roughten_gill_deep_weathering(c); }
function event_roughten_gill_linarite_stage(c) { return event_roughten_gill_carbonate_buffering(c); }
function event_roughten_gill_caledonite_transition(c) { return event_roughten_gill_silica_zinc_weathering(c); }
function event_roughten_gill_leadhillite_cap(c) { return event_roughten_gill_plumbogummite_cap(c); }
