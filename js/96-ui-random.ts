// ============================================================
// js/96-ui-random.ts — UI — Random Vugg (procedural scenario + discovery narrative)
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// RANDOM VUGG — procedural scenario + discovery narrative
// ============================================================
// Mirrors vugg.py's scenario_random + _narrate_discovery. Each press of
// "Generate Vugg" picks a geological archetype (or uses the forced one)
// and builds realistic-but-random fluid chemistry. The sim runs; the
// narrative layer reads the resulting assemblage like a specimen tag.
const RANDOM_ARCHETYPES = [
  "hydrothermal", "pegmatite", "supergene", "mvt", "porphyry", "evaporite", "mixed"
];
const ARCHETYPE_SETTING = {
  hydrothermal: "a fracture-fed solution cavity in altered country rock",
  pegmatite:    "the cooled core of a granite pegmatite pocket",
  supergene:    "a shallow oxidation-zone pocket just below the water table",
  mvt:          "a karst dissolution cavity in Paleozoic limestone",
  porphyry:     "a late-stage vug in a porphyry copper stockwork",
  evaporite:    "a desiccated Ca-SO₄ crust near an ancient playa margin",
  mixed:        "an overprinted pocket with two generations of fluid",
};
function _rU(a, b) { return a + rng.uniform(0, 1) * (b - a); }
function _rMaybe(prob, val) { return rng.uniform(0, 1) < prob ? val : 0; }
function _sprinkle(fluid, pool) {
  for (const [elem, prob, lo, hi] of pool) {
    if (rng.uniform(0, 1) < prob) fluid[elem] = _rU(lo, hi);
  }
}

function buildRandomScenario(forcedArchetype) {
  const archetype = (forcedArchetype && forcedArchetype !== 'any')
    ? forcedArchetype
    : RANDOM_ARCHETYPES[Math.floor(rng.uniform(0, RANDOM_ARCHETYPES.length))];

  let T, fluid, events = [], steps;
  if (archetype === 'hydrothermal') {
    T = _rU(220, 380);
    fluid = new FluidChemistry({
      SiO2: _rU(350, 850), Ca: _rU(60, 240), CO3: _rU(40, 180),
      Fe: _rU(8, 45), Mn: _rU(1, 10), Al: _rU(2, 6), Ti: _rU(0.3, 1.2),
      Zn: _rMaybe(0.5, _rU(20, 80)), S: _rMaybe(0.6, _rU(30, 90)),
      Cu: _rMaybe(0.4, _rU(10, 50)), Pb: _rMaybe(0.4, _rU(10, 35)),
      F: _rU(4, 20), pH: _rU(5.5, 7.2), O2: _rU(0, 0.6),
    });
    _sprinkle(fluid, [["Ba",0.30,5,40],["Sr",0.25,3,25],["Ag",0.20,0.5,8],["Sb",0.15,1,10]]);
    events = [{ step: Math.floor(_rU(40,60)), name: 'Fluid Pulse', description: 'Fresh hydrothermal fluid', apply_fn: event_fluid_pulse }];
    steps = Math.floor(_rU(100, 140));
  } else if (archetype === 'pegmatite') {
    T = _rU(520, 780);
    fluid = new FluidChemistry({
      SiO2: _rU(4000, 14000), Ca: _rU(20, 100), CO3: _rU(5, 40),
      K: _rU(50, 130), Na: _rU(35, 90), Al: _rU(20, 50),
      Fe: _rU(20, 80), Mn: _rU(3, 15), F: _rU(10, 40),
      Pb: _rMaybe(0.4, _rU(5, 35)), U: _rMaybe(0.35, _rU(30, 180)),
      pH: _rU(6.0, 7.5), O2: _rU(0, 0.2),
    });
    _sprinkle(fluid, [["Be",0.40,5,40],["Li",0.40,10,80],["B",0.35,5,50],["P",0.20,2,15]]);
    events = [{ step: Math.floor(_rU(25,40)), name: 'Crystallization', description: 'Melt differentiates', apply_fn: (c) => { c.temperature = Math.max(c.temperature - 120, 350); c.fluid.SiO2 += 2500; return 'Pegmatite melt differentiates; volatile-rich residual fluid floods the pocket.'; } }];
    steps = Math.floor(_rU(120, 180));
  } else if (archetype === 'supergene') {
    T = _rU(18, 55);
    fluid = new FluidChemistry({
      SiO2: _rU(20, 80), Ca: _rU(80, 200), CO3: _rU(60, 200),
      Fe: _rU(20, 60), Mn: _rU(2, 12),
      Zn: _rMaybe(0.7, _rU(40, 140)), S: _rU(20, 70),
      Cu: _rMaybe(0.6, _rU(10, 60)), Pb: _rMaybe(0.6, _rU(15, 60)),
      Mo: _rMaybe(0.4, _rU(5, 25)), As: _rMaybe(0.5, _rU(3, 18)),
      Cl: _rU(5, 30), F: _rU(1, 8),
      O2: _rU(1.5, 2.3), pH: _rU(5.8, 7.2),
    });
    _sprinkle(fluid, [["V",0.20,1,10],["Cr",0.15,0.5,6],["Co",0.15,0.5,5],["Cd",0.10,0.2,3]]);
    steps = Math.floor(_rU(140, 200));
  } else if (archetype === 'mvt') {
    T = _rU(90, 170);
    fluid = new FluidChemistry({
      SiO2: _rU(60, 180), Ca: _rU(250, 450), CO3: _rU(150, 280),
      Fe: _rU(15, 45), Mn: _rU(4, 12),
      Zn: _rU(100, 200), S: _rU(80, 150), Pb: _rU(20, 60),
      F: _rU(25, 55), pH: _rU(5.5, 7.0), O2: _rU(0, 0.4),
      salinity: _rU(15, 22),
    });
    _sprinkle(fluid, [["Ba",0.45,15,60],["Ag",0.25,1,8],["Cd",0.30,0.5,4]]);
    events = [{ step: Math.floor(_rU(20,35)), name: 'Fluid Mixing', description: 'Brine meets groundwater', apply_fn: event_fluid_mixing }];
    steps = Math.floor(_rU(100, 150));
  } else if (archetype === 'porphyry') {
    T = _rU(350, 520);
    fluid = new FluidChemistry({
      SiO2: _rU(500, 900), Ca: _rU(50, 150), CO3: _rU(30, 80),
      Fe: _rU(30, 80), Mn: _rU(1, 6), S: _rU(50, 120),
      Cu: _rU(60, 180), Mo: _rMaybe(0.7, _rU(10, 60)),
      Pb: _rU(10, 40), F: _rU(2, 12),
      O2: _rU(0, 0.3), pH: _rU(4.5, 6.2),
    });
    _sprinkle(fluid, [["Ag",0.30,1,8],["Au",0.15,0.1,2],["Bi",0.20,0.5,5],["W",0.15,0.5,6]]);
    events = [{ step: Math.floor(_rU(40,70)), name: 'Late Cu Pulse', description: 'Magmatic copper surge', apply_fn: event_copper_injection }];
    steps = Math.floor(_rU(120, 160));
  } else if (archetype === 'evaporite') {
    T = _rU(25, 58);
    fluid = new FluidChemistry({
      SiO2: _rU(15, 60), Ca: _rU(180, 350), CO3: _rU(40, 120),
      Fe: _rU(2, 20), Mn: _rU(0.5, 4), S: _rU(90, 180),
      O2: _rU(0.8, 1.8), pH: _rU(6.8, 7.8),
      salinity: _rU(5, 14),
    });
    _sprinkle(fluid, [["Sr",0.45,10,50],["Mg",0.50,20,80],["Cl",0.55,15,60]]);
    steps = Math.floor(_rU(160, 220));
  } else { // mixed
    T = _rU(280, 420);
    fluid = new FluidChemistry({
      SiO2: _rU(400, 700), Ca: _rU(100, 250), CO3: _rU(50, 180),
      Fe: _rU(20, 60), Mn: _rU(3, 12),
      Zn: _rU(40, 120), S: _rU(50, 120),
      Cu: _rMaybe(0.5, _rU(20, 80)), Pb: _rU(15, 50),
      F: _rU(8, 25), pH: _rU(5.5, 7.0), O2: _rU(0, 0.4),
    });
    _sprinkle(fluid, [["Ba",0.30,5,40],["Sr",0.20,3,20],["As",0.30,3,15],["Ag",0.20,0.5,5]]);
    events = [
      { step: Math.floor(_rU(30,50)), name: 'Primary Pulse', description: 'Metal-bearing fluid', apply_fn: event_fluid_pulse },
      { step: Math.floor(_rU(80,110)), name: 'Oxidizing Overprint', description: 'Meteoric water incursion', apply_fn: event_oxidation },
    ];
    steps = Math.floor(_rU(160, 220));
  }

  const conditions = new VugConditions({ temperature: T, pressure: _rU(0.3, 2.0), fluid });
  conditions._random_archetype = archetype;
  return { conditions, events, defaultSteps: steps, archetype };
}

// Render the pre-growth fluid as a markdown-style stats block.
function renderFluidTable(conditions) {
  const fluid = conditions.fluid;
  const T = conditions.temperature, P = conditions.pressure, pH = fluid.pH;
  const candidates = [
    'SiO2','Ca','CO3','Fe','Mn','Mg','Al','Ti','F','S','Cl',
    'Zn','Cu','Pb','Mo','U','Na','K','Ba','Sr','Cr','P','As',
    'V','W','Ag','Au','Bi','Sb','Ni','Co','B','Li','Be','Te','Se','Ge'
  ];
  const marquee = new Set(['Zn','Mo','Cu','Pb','W','U','Au','Ag','F','S','As']);
  const present = [], absent = [];
  for (const c of candidates) {
    const val = (fluid[c] || 0);
    if (val > 0.1) present.push([c, val]);
    else if (marquee.has(c)) absent.push(c);
  }
  present.sort((a, b) => b[1] - a[1]);
  const rows = ['| Element | ppm |', '|---------|-----|'];
  for (const [e, v] of present) {
    rows.push(`| ${e.padEnd(7)} | ${Math.round(v).toString().padStart(5)} |`);
  }
  const header = `🌡️ ${T.toFixed(0)}°C at ${P.toFixed(1)} kbar | pH ${pH.toFixed(1)}`;
  const abs = absent.length ? '\n\n' + absent.map(a => `No ${a}`).join('. ') + '. The absence is data too. 🪨' : '';
  return header + '\n\n' + rows.join('\n') + abs;
}

// Text-adventure preamble: second-person scene-setting BEFORE the simulation runs.
function narratePreamble(conditions, archetype) {
  const fluid = conditions.fluid;
  const T = conditions.temperature, P = conditions.pressure, pH = fluid.pH;
  const depth_km = Math.max(P * 1.0, 0.1);
  const have = (e, t = 0.5) => (fluid[e] || 0) > t;
  const ppm = (e) => (fluid[e] || 0);
  const paras = [];

  if (archetype === 'pegmatite') {
    paras.push(`You stand at the mouth of a cavity in cooling granite, deep underground. The rock around you bears the weight of ${depth_km.toFixed(1)} kilometers of crust. The air here isn't air — it's supercritical fluid, ${T.toFixed(0)} degrees, thick with dissolved metal.`);
    const dom = [];
    if (have('Fe', 10)) dom.push(`The walls gleam wet. Not with water — with iron-rich brine, ${ppm('Fe').toFixed(0)} parts per million, the color of old blood if you could see it through the heat shimmer.`);
    if (have('Cu', 5) && have('U', 10)) dom.push(`Copper threads through it at ${ppm('Cu').toFixed(0)} ppm, and uranium glows invisibly at ${ppm('U').toFixed(0)}.`);
    else if (have('U', 10)) dom.push(`Uranium glows invisibly at ${ppm('U').toFixed(0)} ppm — the cavity is faintly radioactive even before anything precipitates.`);
    else if (have('Cu', 5)) dom.push(`Copper threads through it at ${ppm('Cu').toFixed(0)} ppm, a warm-blooded metal in a hotter fluid.`);
    dom.push('The rock itself is warm to the touch. Hot, actually. Everything is hot.');
    paras.push(dom.join(' '));
    paras.push("This pocket formed when the granite cracked as it cooled. Magma doesn't shrink quietly — it fractures, and the last gasp of mineral-rich fluid fills every void. That's where you are now: inside that last gasp.");
    const rare = [];
    if (have('Li', 5)) rare.push(`lithium at ${ppm('Li').toFixed(0)} ppm`);
    if (have('Be', 3)) rare.push(`beryllium at ${ppm('Be').toFixed(0)}`);
    if (have('B', 5))  rare.push(`boron at ${ppm('B').toFixed(0)}`);
    if (have('P', 2))  rare.push(`phosphorus at ${ppm('P').toFixed(0)}`);
    if (rare.length) paras.push('The broth carries the signature of a rare-element pegmatite: ' + rare.join(', ') + '. These elements ride the same fluid path and rarely end up here by accident.');
    paras.push('Nothing has crystallized yet. The walls are bare granite, still dissolving at their margins, feeding K and Al and SiO₂ back into the mix. The fluid is oversaturated with possibility but nothing has tipped over the edge.');
    paras.push('The temperature is falling. Slowly, imperceptibly, but falling. And when it crosses the right threshold — when supersaturation finally exceeds nucleation energy — the first crystal will spark into existence on these bare walls.');
  } else if (archetype === 'hydrothermal') {
    paras.push(`You stand inside a vein cavity split open in foliated country rock, roughly ${depth_km.toFixed(1)} kilometers below daylight. The walls are dark — slate and quartzite shot through with older, gray-white quartz ribbons from earlier fluid pulses. The fluid filling this space is ${T.toFixed(0)} degrees; hot enough to sting, not quite to scald.`);
    const metal = [];
    if (have('Fe', 5)) metal.push(`Iron rides at ${ppm('Fe').toFixed(0)} ppm`);
    if (have('Mn', 2)) metal.push(`manganese at ${ppm('Mn').toFixed(0)}`);
    if (have('Zn', 5)) metal.push(`zinc at ${ppm('Zn').toFixed(0)}`);
    if (have('Cu', 5)) metal.push(`copper at ${ppm('Cu').toFixed(0)}`);
    if (have('Pb', 5)) metal.push(`lead at ${ppm('Pb').toFixed(0)}`);
    if (metal.length) paras.push(metal.join(', ') + `. Silica saturates the fluid at roughly ${ppm('SiO2').toFixed(0)} ppm — enough that a degree of cooling will start to crack out quartz.`);
    paras.push("This cavity opened when tectonic stress bent the host rock and a fracture propagated through. Fluid rose from deeper still, following the path of least resistance, and this particular pocket is where the flow eddied long enough to begin depositing. You're standing in a pause in the plumbing.");
    paras.push(`The walls are not idle. Hot fluid at pH ${pH.toFixed(1)} is slowly stripping Ca and CO₃ from carbonate seams in the country rock and feeding them into the broth. The vug is eating its way larger, one millimeter per millennium.`);
    paras.push("Somewhere upstream, the heat source is dying. This fluid has a finite window. When the broth cools below quartz's solubility curve, or pH climbs past calcite's, the cavity will begin to fill.");
  } else if (archetype === 'supergene') {
    paras.push(`You stand inside a cavity maybe ten meters below the ground surface, in the oxidized zone above the water table. The air is cool — ${T.toFixed(0)} degrees, barely warmer than the bedrock. Oxygen-rich rainwater has been percolating through for a long time, finding its way down through soil and fractures.`);
    paras.push(`The walls are stained. Rust-orange where iron oxidized, patchy green where copper lingered, dark where sulfides are still rotting quietly. Everything here has already been something else — the primary ore that made this zone interesting is being rewritten. The fluid carries those rewrites in solution: Zn ${ppm('Zn').toFixed(0)}, Pb ${ppm('Pb').toFixed(0)}, Cu ${ppm('Cu').toFixed(0)}, O₂ ${fluid.O2.toFixed(1)}.`);
    paras.push('This cavity is a negative-space museum. Oxygen-bearing groundwater attacked the softest parts of the primary ore, and the walls retreated. What remains is the argument that the ore is making with the atmosphere.');
    const sec = [];
    if (have('As', 3)) sec.push(`arsenic at ${ppm('As').toFixed(0)} ppm (from arsenopyrite dying somewhere upslope)`);
    if (have('Mo', 2)) sec.push(`molybdenum at ${ppm('Mo').toFixed(0)} (galena + molybdenite both oxidizing — wulfenite weather)`);
    if (have('Cl', 5)) sec.push(`chloride at ${ppm('Cl').toFixed(0)} (rain carrying salt air, or an evaporite signature)`);
    if (sec.length) paras.push('Trace hints: ' + sec.join('; ') + '.');
    paras.push('The fluid does not have to cool to precipitate here. It only has to change: shift its pH, lose its dissolved oxygen, or meet a fresh surface that will let secondary minerals nucleate. Any of those triggers will do.');
  } else if (archetype === 'mvt') {
    paras.push(`You stand inside a limestone dissolution cavity — karst, the geologist's word for rock with holes. The air is dark and faintly briny. ${T.toFixed(0)} degrees. The walls are pale Paleozoic limestone, still retreating wherever the brine touches them.`);
    paras.push(`The fluid here is a dense saline brine, roughly ${fluid.salinity.toFixed(0)}% NaCl, mineralized with base metals. Zinc at ${ppm('Zn').toFixed(0)} ppm, lead at ${ppm('Pb').toFixed(0)}, sulfur at ${ppm('S').toFixed(0)} — which in this environment means H₂S, the smell of rotten eggs if the brine weren't in the way.`);
    paras.push("This cavity was dissolved into limestone by an earlier, lower-pH brine. Then a second fluid arrived — the one you're standing in — bearing metals from a basin possibly hundreds of kilometers away. Two fluids met; this cavity is where they're still mixing.");
    const hints = [];
    if (have('F', 10)) hints.push(`Fluorite is already saturating (${ppm('F').toFixed(0)} ppm F)`);
    if (have('Ba', 10)) hints.push(`Barium at ${ppm('Ba').toFixed(0)} ppm is a barite near-miss`);
    if (have('Ag', 1)) hints.push(`Silver at ${ppm('Ag').toFixed(0)} hints at argentiferous galena to come`);
    if (hints.length) paras.push(hints.join('; ') + '.');
    paras.push("The limestone doesn't fight back. It dissolves peacefully, releasing Ca²⁺ and CO₃²⁻ into the broth. The vug grows slowly larger, and every Ca²⁺ released is a future growth band waiting to happen.");
  } else if (archetype === 'porphyry') {
    paras.push(`You stand inside a vug at the top of an intrusive porphyry stock — a shallow magma body that crystallized into a cupola of ore-bearing granite. Two kilometers of rock above you, daylight; immediately below, the still-magma continues to exhale metal-laden fluid. ${T.toFixed(0)} degrees here, ${P.toFixed(2)} kbar, on the borderline between supercritical and boiling.`);
    paras.push(`The fluid is metal-rich soup. Copper at ${ppm('Cu').toFixed(0)} ppm, iron at ${ppm('Fe').toFixed(0)}, sulfur at ${ppm('S').toFixed(0)}. The walls weep with it. Everything looks brassy and wet, and the whole pocket smells metallic even through the hiss of pressure.`);
    paras.push("This pocket is one of many. Porphyry systems are lacework: fractures, veins, stockwork cavities all feeding off the same cooling intrusion. Each vug is a local eddy where the flow paused long enough to deposit. You're in one of those eddies.");
    const porp = [];
    if (have('Mo', 5)) porp.push(`Molybdenum at ${ppm('Mo').toFixed(0)} ppm — the Mo pulse has already arrived; molybdenite is likely`);
    if (have('Au', 0.1)) porp.push(`gold at ${ppm('Au').toFixed(1)} (invisible in pyrite, traditionally)`);
    if (have('W', 0.3))  porp.push(`tungsten at ${ppm('W').toFixed(1)} (scheelite-adjacent)`);
    if (have('Bi', 0.3)) porp.push(`bismuth at ${ppm('Bi').toFixed(1)}`);
    if (porp.length) paras.push(porp.join('. ') + '.');
    paras.push("The walls are quartz-feldspar porphyry, potassically altered — the intrusion has already stained them pink with K-feldspar metasomatism. That alteration is older than the fluid you're standing in.");
    paras.push('The first sulfides will form within a few degrees of cooling. Pyrite nucleates fastest, then chalcopyrite settles onto it, then — if the late Mo pulse keeps delivering — molybdenite platelets.');
  } else if (archetype === 'evaporite') {
    paras.push(`You stand inside a crust that hasn't been buried deep. Barely below the surface. ${T.toFixed(0)} degrees — the sun warmed the ground this morning; by night it will cool again. The air is dry and still.`);
    paras.push(`The fluid is a brine so concentrated it feels like syrup. Calcium at ${ppm('Ca').toFixed(0)} ppm, sulfate (as S) at ${ppm('S').toFixed(0)}, with a pH of ${pH.toFixed(1)} — the chemistry of drying out. The walls are pale Ca-SO₄ with streaks of iron where earlier water rusted through.`);
    paras.push("A shallow pond sat here once. Inflow slowed, or stopped; evaporation didn't. The water retreated, concentrating its dissolved ions, until the first crystals formed on the sediment surface and the whole thing went from pond to crust. You're inside the crust.");
    const evap = [];
    if (have('Mg', 20)) evap.push(`Magnesium at ${ppm('Mg').toFixed(0)} ppm hints at dolomite-adjacent chemistry, or epsomite if the brine dries further`);
    if (have('Sr', 10)) evap.push(`Strontium at ${ppm('Sr').toFixed(0)} is a celestine near-miss — the missing SrSO₄ is the ghost sulfate`);
    if (have('Cl', 15)) evap.push(`Chloride at ${ppm('Cl').toFixed(0)} is halite-adjacent; one more round of drying and NaCl will crust out alongside the gypsum`);
    if (evap.length) paras.push(evap.join('. ') + '.');
    paras.push('There are no walls to dissolve here. The cavity IS the fluid, and the fluid is shrinking. The only question is how slowly it shrinks, and whether the temperature holds below 60°C long enough for selenite to finish what anhydrite might otherwise interrupt.');
  } else { // mixed
    paras.push(`You stand inside a pocket that has seen two fluids. The older one left behind mineral coatings on the walls — dull sulfides, margins slightly oxidized. The new fluid is different: cooler, more oxidizing. ${T.toFixed(0)} degrees, and the mix is unsettled.`);
    paras.push(`Metal is in solution: ${ppm('Zn').toFixed(0)} ppm Zn, ${ppm('Pb').toFixed(0)} ppm Pb, ${ppm('Fe').toFixed(0)} ppm Fe. O₂ is ${fluid.O2.toFixed(1)} — enough to attack the old sulfide coatings where it touches them.`);
    paras.push('This is an overprint. A pocket that once equilibrated with reducing brine is being re-visited by something newer. Two timescales meet here: the older paragenesis frozen in the walls, and the new one about to begin on top of it.');
    paras.push("The walls are dissolving where the new fluid is undersaturated, and re-precipitating where it's saturated. You can watch both processes happen at once, on different parts of the same crystal — if you have patience measured in centuries.");
    paras.push("What grows next will tell you which fluid won. Secondary minerals on primary — that's the signature of overprint. The vug is writing its second chapter.");
  }

  return paras.join('\n\n') + '\n\n' + renderFluidTable(conditions);
}

function narrateDiscovery(sim, archetype) {
  const grown = sim.crystals.filter(c => c.total_growth_um > 0);
  if (!grown.length) {
    return "*Discovery tag —* The cavity was opened, and nothing had grown. Sometimes that is the whole story: a chamber where the fluid arrived, lingered, and left without leaving a signature.";
  }
  const fluid = sim.conditions.fluid;
  const setting = ARCHETYPE_SETTING[archetype] || "an unnamed cavity";
  const mineralSize: Record<string, number> = {};
  for (const c of grown) {
    mineralSize[c.mineral] = Math.max(mineralSize[c.mineral] || 0, c.c_length_mm);
  }
  const bySize = Object.entries(mineralSize).sort((a, b) => b[1] - a[1]);
  const assemblage = new Set(bySize.map(([m]) => m));

  const parts = [`*Discovery tag —* This specimen was recovered from ${setting}.`];

  if (bySize.length === 1) {
    const [primary, psize] = bySize[0];
    parts.push(`The pocket is a single-mineral chamber: ${primary} reached ${psize.toFixed(1)} mm and claimed the whole vug.`);
  } else {
    const [primary, psize] = bySize[0];
    const subs = bySize.slice(1, 4).map(([m]) => m).join(', ');
    parts.push(`The dominant mineral is ${primary} (${psize.toFixed(1)} mm), with subordinate ${subs}.`);
  }

  if (assemblage.has('goethite') && sim.crystals.some(c => c.mineral === 'goethite' && c.position.includes('pseudomorph'))) {
    parts.push('Goethite boxwork pseudomorphs after pyrite record a weathering front that moved through the vug long after the primary sulfides formed.');
  }
  if (assemblage.has('wulfenite')) {
    parts.push('The wulfenite is the prize — bright tablets that only formed because both galena and molybdenite oxidized together (Seo et al. 2012).');
  }
  if (assemblage.has('malachite') && assemblage.has('chalcopyrite')) {
    parts.push('A malachite-after-chalcopyrite pathway is evident: the copper walked out of the sulfide and met carbonate on its way to the wall.');
  }
  if (assemblage.has('uraninite') && assemblage.has('quartz')) {
    parts.push('The quartz near the uraninite carries alpha-damage; if this specimen sat in its cradle long enough, the clear crystals darkened into smoky.');
  }
  if (assemblage.has('selenite') && archetype === 'evaporite') {
    parts.push('The selenite blades are the clock: they grew slowly at a steady sub-60°C, the Naica chemistry in miniature.');
  }
  if (assemblage.has('adamite') && assemblage.has('mimetite')) {
    parts.push('Adamite and mimetite together place this pocket near an arsenopyrite weathering body — Zn and Pb fighting over the same arsenate.');
  }

  const traces = [];
  if ((fluid.Ba || 0) > 15) traces.push("The fluid carried enough Ba that barite was a near miss — look in the matrix for the missing sulfate");
  if ((fluid.Sr || 0) > 15) traces.push("Strontium above typical MVT values suggests a celestine-bearing parent brine somewhere upstream");
  if ((fluid.Li || 0) > 20 || (fluid.B || 0) > 20 || (fluid.Be || 0) > 15) traces.push("Trace Li/B/Be hints that the pegmatite parent fluid ran toward the rare-element side of the LCT family");
  if ((fluid.Au || 0) > 0.5) traces.push("Invisible gold in the pyrite is likely — the fluid ran Au-enriched even if no native gold crystallized here");
  if ((fluid.Ag || 0) > 3) traces.push("The galena is argentiferous; a thin-section microprobe traverse would light up with silver");
  if ((fluid.Cr || 0) > 3) traces.push("Chromium in the fluid would have shifted wulfenite toward the classic blood-orange Red Cloud hue");
  if ((fluid.Co || 0) > 1) traces.push("Cobalt traces would pink up any smithsonite that grew here");
  if ((fluid.Mg || 0) > 30 && archetype === 'evaporite') traces.push("High Mg suggests dolomite-adjacent chemistry; epsomite could bloom if the crust evaporated a bit further");
  if (traces.length) {
    parts.push(traces[0] + '.');
    if (traces.length > 1) parts.push('Secondary traces: ' + traces.slice(1, 3).join('; ') + '.');
  }

  let locality = null;
  const has = (...ms) => ms.every(m => assemblage.has(m));
  if (has('adamite','goethite') || has('mimetite','goethite'))  locality = "Ojuela Mine at Mapimí, Durango — the classic oxidation-zone type locality";
  else if (assemblage.has('wulfenite') && assemblage.has('hematite')) locality = "Los Lamentos or Red Cloud Mine — the wulfenite capitals";
  else if (has('sphalerite','galena','fluorite'))              locality = "Cave-in-Rock, Illinois — MVT paragenesis at its textbook best";
  else if (has('chalcopyrite','pyrite','quartz') && archetype === 'porphyry') locality = "Bingham Canyon or Butte — porphyry copper's ground truth";
  else if (has('uraninite','feldspar'))                        locality = "the Bancroft district, Ontario — uraninite-bearing pegmatites";
  else if (has('calcite','sphalerite','galena'))               locality = "the Tri-State district (Joplin, Missouri)";
  if (locality) parts.push(`The assemblage recalls ${locality}.`);

  const closings = [
    "What the rock held, the rock now reveals.",
    "The fluid is long gone; only the crystals remember.",
    "Every face was drawn in slow ink, one layer at a time.",
    "This is what the dark grew when no one was watching.",
    "The cavity is a museum and a letter.",
  ];
  parts.push(closings[Math.floor(rng.uniform(0, closings.length))]);
  return parts.join(' ');
}

let randomSim = null;
let randomSimArchetype = null;
let randomSimSeed = null;

function runRandomVugg() {
  const out = document.getElementById('random-output');
  if (!out) return;
  const seedRaw = document.getElementById('random-seed').value.trim();
  const seed = seedRaw && !isNaN(parseInt(seedRaw, 10)) ? parseInt(seedRaw, 10) : Date.now();
  rng = new SeededRandom(seed);
  const forced = document.getElementById('random-archetype').value;

  const scen = buildRandomScenario(forced);

  // Capture the pre-growth preamble BEFORE the simulation mutates the fluid.
  const preamble = narratePreamble(scen.conditions, scen.archetype);

  const sim = new VugSimulator(scen.conditions, scen.events);
  for (let i = 0; i < scen.defaultSteps; i++) sim.run_step();
  randomSim = sim;
  randomSimArchetype = scen.archetype;
  randomSimSeed = seed;

  const discovery = narrateDiscovery(sim, scen.archetype);
  const full = sim.narrate ? sim.narrate() : '';

  const crystalList = sim.crystals
    .filter(c => c.total_growth_um > 0)
    .sort((a, b) => b.c_length_mm - a.c_length_mm)
    .map(c => `  • ${c.mineral} #${c.crystal_id} — ${c.c_length_mm.toFixed(2)} mm, ${c.habit}${c.twinned ? ', twinned (' + c.twin_law + ')' : ''}`)
    .join('\n');

  const header = `═══ 🎲 Random Vugg — archetype: ${scen.archetype} — seed: ${seed} ═══\n` +
                 `ran ${scen.defaultSteps} steps · events: ${scen.events.length}\n`;
  const rule   = '─'.repeat(70);
  const preambleBlock = `\n┈┈┈┈┈ PREAMBLE ┈┈┈┈┈\n\n${preamble}\n\n${rule}\n`;
  const inventory = crystalList ? `\nCRYSTALS\n${crystalList}\n\n${rule}\n` : `\nCRYSTALS\n  (nothing nucleated)\n\n${rule}\n`;
  const discoveryBlock = `\n${discovery}\n\n${rule}\n`;
  const fullBlock = full ? `\n${full}\n` : '';

  out.textContent = header + preambleBlock + inventory + discoveryBlock + fullBlock;
  out.scrollTop = 0;

  // Build interactive inventory below the text output (per-crystal Collect).
  renderRandomInventory();

  // Final wall state for the topo map.
  if (typeof topoRender === 'function') topoRender();
}

