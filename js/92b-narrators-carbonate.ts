// ============================================================
// js/92b-narrators-carbonate.ts — VugSimulator._narrate_<mineral> (carbonate)
// ============================================================
// Per-mineral narrators for carbonate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (11): aragonite, aurichalcite, azurite, calcite, cerussite, dolomite, malachite, rhodochrosite, rosasite, siderite, smithsonite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_calcite(c) {
  // Prose lives in narratives/calcite.md.
  const parts = [];
  if (c.zones.length) {
    const mn_zones = c.zones.filter(z => z.trace_Mn > 1.0 && z.trace_Fe < 2.0);
    const fe_zones = c.zones.filter(z => z.trace_Fe > 3.0);
    if (mn_zones.length && fe_zones.length) {
      const mn_end = mn_zones[mn_zones.length - 1].step;
      const fe_start = fe_zones[0].step;
      if (fe_start > mn_end - 5) {
        parts.push(narrative_variant('calcite', 'mn_fe_quench', { fe_start }) || `Early growth zones are manganese-rich and would fluoresce orange under UV light. After step ${fe_start}, iron flooded the system and quenched the fluorescence — later zones would appear dark under cathodoluminescence. The boundary between glowing and dark records the moment the fluid chemistry changed.`);
      }
    } else if (mn_zones.length) {
      parts.push(narrative_variant('calcite', 'mn_only') || `The crystal incorporated manganese throughout growth and would fluoresce orange under shortwave UV — a classic Mn²⁺-activated calcite.`);
    }
  }
  if (c.twinned) {
    parts.push(narrative_variant('calcite', 'twinned', { twin_law: c.twin_law }) || `The crystal is twinned on ${c.twin_law}, a common deformation twin in calcite that can form during growth or post-crystallization stress.`);
  }
  const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 2 ? 'small' : 'well-developed';
  parts.push(narrative_variant('calcite', 'final_size', { size_desc, mm: c.c_length_mm.toFixed(1), habit: c.habit }) || `Final size: ${size_desc} (${c.c_length_mm.toFixed(1)} mm), ${c.habit} habit.`);
  return parts.filter(p => p).join(' ');
},

  _narrate_aragonite(c) {
  // Prose lives in narratives/aragonite.md.
  const parts = [`Aragonite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aragonite') || "CaCO₃ — same composition as calcite, different crystal structure. The orthorhombic polymorph that exists by kinetic favor, not thermodynamic stability: at vug T/P, calcite is the ground-state phase. Folk 1974 / Morse 1997 — Mg/Ca ratio is the dominant control on which polymorph nucleates.");
  if (c.habit === 'acicular_needle') {
    parts.push(narrative_variant('aragonite', 'acicular_needle') || 'Acicular needles — the high-supersaturation form. Long thin prisms radiating from a common nucleation point, often forming sprays that look like frozen explosions in cabinet specimens.');
  } else if (c.habit === 'twinned_cyclic') {
    parts.push(narrative_variant('aragonite', 'twinned_cyclic') || 'Cyclic twin on {110} — three crystals interpenetrating at 120° to produce a pseudo-hexagonal six-pointed prism. This is the diagnostic aragonite habit, easily mistaken for a true hexagonal mineral until the re-entrant angles between the twin lobes give it away.');
  } else if (c.habit === 'flos_ferri') {
    parts.push(narrative_variant('aragonite', 'flos_ferri') || "'Flos ferri' — the iron flower variety. Fe-rich aragonite forms delicate dendritic / coral-like white branches, named for the famous Eisenerz, Austria specimens.");
  } else {
    parts.push(narrative_variant('aragonite', 'columnar_prisms') || 'Columnar prisms — the default low-σ habit. Transparent to white blades easily confused with calcite at first glance, until the chemistry (Mg/Ca, Sr/Pb signatures, lack of perfect rhombohedral cleavage) gives it away.');
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('polymorphic conversion')) {
      parts.push(narrative_variant('aragonite', 'polymorphic_conversion') || 'The crystal underwent polymorphic conversion to calcite — the thermodynamic sink. Aragonite metastability has limits: above 100°C with water present, the structure inverts on geologic-short timescales (Bischoff & Fyfe 1968, half-life ~10³ yr at 80°C). What remains is a calcite pseudomorph after aragonite, preserving the original orthorhombic outline filled with trigonal cleavage.');
    } else {
      parts.push(narrative_variant('aragonite', 'acid_dissolution') || "Acid attack dissolved the crystal — aragonite shares calcite's vulnerability below pH 5.5. Ca²⁺ + CO₃²⁻ returned to the fluid.");
    }
  } else {
    parts.push(narrative_variant('aragonite', 'preserved') || 'The crystal is preserved at vug-scale geologic moment. In nature, aragonite from cold marine settings can survive millions of years; from hot springs it converts to calcite in centuries to millennia.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_dolomite(c) {
  // Prose lives in narratives/dolomite.md. Code keeps the
  // cycle_count → f_ord computation and threshold dispatch (Kim 2023
  // ordering tiers); markdown owns the words. Inline fallbacks for offline.
  const parts = [`Dolomite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  const cycle_count = this.conditions._dol_cycle_count;
  const f_ord = cycle_count > 0 ? 1.0 - Math.exp(-cycle_count / 7.0) : 0.0;
  parts.push(narrative_blurb('dolomite') || "CaMg(CO₃)₂ — the ordered double carbonate, with Ca and Mg in alternating cation layers (R3̄ space group, distinct from calcite's R3̄c). The host rock of MVT deposits and a major sedimentary carbonate. The 'dolomite problem' — that modern surface oceans should but don't precipitate it — was partly resolved by Kim, Sun et al. (2023, Science 382:915) who showed that periodic dissolution-precipitation cycles strip disordered Ca/Mg surface layers and ratchet ordering up over many cycles.");
  if (cycle_count > 0) {
    const ctx = { cycle_count, f_ord: f_ord.toFixed(2) };
    let variant, fallback;
    if (f_ord > 0.7) { variant = 'kim_ordered'; fallback = `The vug fluid cycled across dolomite saturation ${cycle_count} times during this crystal's growth (f_ord=${f_ord.toFixed(2)}). Each cycle stripped the disordered surface layer that steady precipitation would otherwise lock in, leaving an ordered Ca/Mg template for the next growth pulse. The result is true ordered dolomite, not a Mg-calcite intermediate.`; }
    else if (f_ord > 0.3) { variant = 'kim_partial'; fallback = `The vug fluid cycled ${cycle_count} times across saturation (f_ord=${f_ord.toFixed(2)}) — partially ordered. Some growth zones are well-ordered dolomite, others disordered HMC; X-ray diffraction would show a smeared peak rather than the sharp dolomite signature.`; }
    else { variant = 'kim_disordered'; fallback = `Only ${cycle_count} saturation cycle(s) (f_ord=${f_ord.toFixed(2)}) — most of this crystal is disordered high-Mg calcite, not true ordered dolomite. With more cycles it would have ratcheted up; the system sealed too quickly.`; }
    parts.push(narrative_variant('dolomite', variant, ctx) || fallback);
  } else {
    parts.push(narrative_variant('dolomite', 'no_cycling') || "No saturation cycles occurred — this is steady-state growth, which Kim 2023 predicts will be disordered Mg-calcite rather than true ordered dolomite. In nature the ratio of true dolomite to disordered HMC depends on how oscillatory the fluid history was.");
  }
  if (c.habit === 'saddle_rhomb') {
    parts.push(narrative_variant('dolomite', 'saddle_rhomb') || "Saddle-shaped curved rhombohedra — the most extreme example of the calcite-group curved-face signature. Each {104} face bows so sharply that the crystal looks twisted, which it isn't — it's the lattice strain from cation ordering expressed in surface geometry.");
  } else if (c.habit === 'coarse_rhomb') {
    parts.push(narrative_variant('dolomite', 'coarse_rhomb') || 'Coarse textbook rhombohedra — the slow-growth high-T form. Transparent to white, the crystal looks like calcite at first glance until you check the cleavage and density.');
  } else {
    parts.push(narrative_variant('dolomite', 'massive_granular') || 'Massive granular aggregate — the rock-forming form. White to gray sugary texture, no individual crystal faces visible.');
  }
  if (c.position && c.position.includes('calcite')) {
    parts.push(narrative_variant('dolomite', 'on_calcite') || `Growing on calcite — classic dolomitization texture, the Mg-bearing fluid converting earlier calcite to dolomite as the system evolves.`);
  }
  if (c.dissolved) {
    parts.push(narrative_variant('dolomite', 'dissolved') || 'Acid attack dissolved the crystal — dolomite is somewhat more acid-resistant than calcite (the Mg slows the reaction), but pH < 6 still releases Ca²⁺ + Mg²⁺ + 2 CO₃²⁻.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_siderite(c) {
  // Prose lives in narratives/siderite.md.
  const parts = [`Siderite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('siderite') || "FeCO₃ — the iron carbonate, a calcite-group mineral (R3̄c) with Fe²⁺ in the Ca site. Tan to deep brown, depending on Fe content and trace substitution. Forms only in REDUCING conditions because Fe²⁺ must stay reduced to be soluble; the moment O₂ rises above ~0.5, siderite begins converting to goethite/limonite.");
  if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('siderite', 'rhombohedral') || "Curved 'saddle' rhombohedra — the diagnostic siderite habit. The {104} faces aren't flat; they bow outward into a saddle shape, parallel to the curved-rhomb signature shared with rhodochrosite and dolomite.");
  } else if (c.habit === 'scalenohedral') {
    parts.push(narrative_variant('siderite', 'scalenohedral') || "Sharp scalenohedral 'dog-tooth' crystals — the high-σ habit. Less common than the rhombohedral form; sharp brown crystals that resemble brown calcite at distance.");
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('siderite', 'botryoidal') || 'Botryoidal mammillary crusts — the colloidal habit, formed when supersaturation outruns ordered crystal growth. Tan-brown rounded aggregates, often coating fracture walls.');
  } else {
    parts.push(narrative_variant('siderite', 'spherulitic_concretion') || "Spherulitic concretions — sedimentary 'spherosiderite,' the concretionary habit found in coal seams and Fe-rich shales. Each sphere is a radial fibrous internal structure capped by a thin smooth surface.");
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('oxidative breakdown')) {
      parts.push(narrative_variant('siderite', 'oxidative_breakdown') || "Oxidative breakdown destroyed the crystal — the textbook diagenetic story. Rising O₂ pushed Fe²⁺ → Fe³⁺, which is insoluble as carbonate; the lattice collapsed and Fe + CO₃ moved on to grow goethite/limonite elsewhere. In nature this is the mechanism behind the 'limonite cube after siderite' diagenetic pseudomorphs.");
    } else {
      parts.push(narrative_variant('siderite', 'acid_dissolution') || 'Acid attack dissolved the crystal — like all calcite-group carbonates, siderite fizzes in HCl. Fe²⁺ + CO₃²⁻ released.');
    }
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_rhodochrosite(c) {
  // Prose lives in narratives/rhodochrosite.md.
  const parts = [`Rhodochrosite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('rhodochrosite') || "MnCO₃ — the rosy manganese carbonate, structurally identical to calcite (R3̄c) but with Mn²⁺ replacing Ca²⁺. The pink-to-raspberry color is intrinsic to the Mn²⁺ chromophore, not a trace activator. Forms in epithermal Mn-bearing veins (Capillitas, Sweet Home), metamorphosed Mn sediments (N'Chwaning), and low-T carbonate replacement zones.");
  if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('rhodochrosite', 'rhombohedral') || "Curved 'button' rhombohedra — the diagnostic rhodochrosite habit. The {104} faces aren't quite flat; they bow outward, giving each crystal a domed, button-like profile that's hard to mistake for anything else.");
  } else if (c.habit === 'scalenohedral') {
    parts.push(narrative_variant('rhodochrosite', 'scalenohedral') || "Sharp scalenohedral 'dog-tooth' crystals — the high-σ habit. Deep-rose to raspberry-red where Mn is dominant. Visually similar to scalenohedral calcite at distance, but the color settles the identification.");
  } else if (c.habit === 'stalactitic') {
    parts.push(narrative_variant('rhodochrosite', 'stalactitic') || 'Stalactitic / mammillary aggregates — the famous Capillitas, Argentina habit. Concentric rose-pink banding when sliced; reflects rhythmic drip-water deposition over geologically short intervals.');
  } else {
    parts.push(narrative_variant('rhodochrosite', 'rhythmic_banding') || 'Rhythmic Mn/Ca banding — the agate-like layered cross-section. Each band records a slight shift in the Mn:Ca ratio of the incoming fluid, captured in the kutnohorite (CaMn carbonate) solid-solution series between rhodochrosite and calcite.');
  }
  if (c.position && (c.position.includes('sphalerite') || c.position.includes('pyrite') || c.position.includes('galena'))) {
    parts.push(narrative_variant('rhodochrosite', 'on_sulfide', { position: c.position }) || `Growing on ${c.position} — classic epithermal vein paragenesis: the carbonate fills space between earlier sulfides as the system cools, Mn-bearing fluids replacing or coating the sulfide phases.`);
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('oxidative breakdown')) {
      parts.push(narrative_variant('rhodochrosite', 'oxidative_breakdown') || 'Oxidative breakdown destroyed the crystal — Mn²⁺ is unstable above O₂ ~1.0; it flips to Mn³⁺/Mn⁴⁺ and the surface converts to a black manganese-oxide rind (pyrolusite, psilomelane). The rosy crystal goes black from the outside in. This is why rhodochrosite specimens require careful storage.');
    } else {
      parts.push(narrative_variant('rhodochrosite', 'acid_dissolution') || 'Acid attack dissolved the crystal — like calcite, rhodochrosite fizzes in HCl, releasing Mn²⁺ and CO₃²⁻.');
    }
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_malachite(c) {
  // Prose lives in narratives/malachite.md.
  const parts = [`Malachite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.position.includes('chalcopyrite')) {
    parts.push(narrative_variant('malachite', 'on_chalcopyrite') || 'It nucleated directly on chalcopyrite — the classic oxidation paragenesis. As oxygenated water attacked the copper sulfide, Cu²⁺ combined with carbonate to form malachite. This is the green stain that led ancient prospectors to copper deposits.');
  }
  if (c.habit === 'banded') {
    parts.push(narrative_variant('malachite', 'banded') || 'The crystal developed the famous banded texture — concentric layers of alternating light and dark green, prized in decorative stonework since the Bronze Age.');
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('malachite', 'botryoidal') || 'Botryoidal habit — smooth, rounded green masses. Cross-sections would reveal concentric banding.');
  } else if (c.habit === 'fibrous/acicular') {
    parts.push(narrative_variant('malachite', 'fibrous_acicular') || 'Rapid growth produced fibrous, acicular malachite — sprays of needle-like green crystals radiating from nucleation points.');
  }
  if (c.dissolved) parts.push(narrative_variant('malachite', 'acid_dissolution') || 'Acid attack dissolved some malachite — it fizzes in acid like calcite, releasing Cu²⁺ and CO₂.');
  const color = c.predict_color ? c.predict_color() : '';
  if (color) parts.push(narrative_variant('malachite', 'color', { color }) || `Color: ${color}.`);
  return parts.filter(p => p).join(' ');
},

  _narrate_smithsonite(c) {
  // Prose lives in narratives/smithsonite.md.
  const parts = [`Smithsonite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('smithsonite'));
  if (c.position.includes('sphalerite')) {
    const oxidized = c.position.includes('oxidized');
    if (oxidized) {
      parts.push(narrative_variant('smithsonite', 'on_sphalerite_oxidized') || 'It nucleated directly on oxidized sphalerite — the classic supergene paragenesis. As oxygenated groundwater destroyed the zinc sulfide, liberated Zn²⁺ combined with carbonate to precipitate smithsonite. The grape-like clusters grew from the corpse of the sphalerite that donated its zinc.');
    } else {
      parts.push(narrative_variant('smithsonite', 'on_sphalerite_fresh') || 'It nucleated on sphalerite, the zinc source mineral. Smithsonite is the oxidized alter ego of sphalerite — same zinc, different anion, different world.');
    }
  }
  if (c.habit === 'botryoidal' || c.habit === 'botryoidal/stalactitic') {
    parts.push(narrative_variant('smithsonite', 'botryoidal') || 'Botryoidal habit — grape-like clusters of rounded, bubbly masses. Cross-sections reveal concentric growth banding like tiny onions.');
  } else if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('smithsonite', 'rhombohedral') || 'Rhombohedral crystals with curved, pearly faces — the "dry bone" ore that frustrated miners who mistook it for calcite.');
  }
  const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
  if (lastZone && lastZone.note) {
    if (lastZone.note.includes('apple-green')) parts.push(narrative_variant('smithsonite', 'color_apple_green') || 'Copper impurities give it an apple-green color — smithsonite is a chameleon, its color entirely dependent on trace chemistry.');
    else if (lastZone.note.includes('pink')) parts.push(narrative_variant('smithsonite', 'color_pink') || 'Manganese impurities lend a rare pink color — among the most prized smithsonite varieties.');
    else if (lastZone.note.includes('blue-green')) parts.push(narrative_variant('smithsonite', 'color_blue_green') || 'A blue-green translucence that collectors prize — the kelly green of Tsumeb, the turquoise of Lavrion.');
  }
  if (c.dissolved) parts.push(narrative_variant('smithsonite', 'acid_dissolution') || 'Acid attack dissolved some of the smithsonite — it fizzes in hydrochloric acid, a quick field test to distinguish it from prehnite or hemimorphite.');
  return parts.filter(p => p).join(' ');
},

  _narrate_cerussite(c) {
  // Prose lives in narratives/cerussite.md.
  const parts = [`Cerussite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cerussite') || "PbCO₃ — orthorhombic lead carbonate. Water-clear with adamantine luster and extreme birefringence — a thin slice doubles every image behind it. Final stable product of the lead oxidation sequence in carbonate-rich water. The Latin name 'cerussa' means 'white lead', a pigment used since antiquity (and poisonous — painters\u2019 death).");
  if (c.twinned && (c.twin_law || '').includes('sixling')) {
    parts.push(narrative_variant('cerussite', 'sixling_twin') || 'Six-ray stellate cyclic twin — three individuals intergrown at 120° on {110}. Among mineralogy\u2019s most iconic forms; a sharp cerussite star commands four-figure prices at a show. This twin happened because growth ran at moderate supersaturation for a sustained window — fast enough to initiate the twin, slow enough to let it develop cleanly.');
  }
  if ((c.position || '').includes('galena')) {
    parts.push(narrative_variant('cerussite', 'on_galena') || 'Pseudomorphs after galena — the cube outline survives as cerussite precipitates into it. Occasionally galena relics persist inside, slowly oxidizing.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('cerussite', 'acid_dissolution') || 'Acid dissolution — cerussite is a carbonate and fizzes in acid just like calcite: PbCO₃ + 2H⁺ → Pb²⁺ + H₂O + CO₂. Any released Pb may find pyromorphite or vanadinite if P or V is available.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_azurite(c) {
  // Prose lives in narratives/azurite.md. Code dispatches on habit
  // + paramorph-conversion zone-note signal. Inline fallbacks are the
  // existing (shorter) JS strings; markdown is canonical and matches
  // Python's longer version, so live runtime now converges on the
  // canonical text — fixes a small Python/JS drift in this narrator.
  const parts = [`Azurite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('azurite') || "Cu₃(CO₃)₂(OH)₂ — the deepest blue in the common mineral kingdom. Requires high pCO₂ groundwater — typically a limestone-hosted supergene system. Chessy-les-Mines (France) gave us 'chessylite', an old synonym; Tsumeb and Bisbee (Arizona) produced the showpiece blue prisms.");
  if (c.habit === 'azurite_sun') {
    parts.push(narrative_variant('azurite', 'azurite_sun') || 'Azurite-sun — radiating flat disc, grown in a narrow fracture where the c-axis was forced perpendicular to the fracture plane. The Malbunka (Australia) azurite-suns in siltstone are the classic.');
  } else if (c.habit === 'rosette_bladed') {
    parts.push(narrative_variant('azurite', 'rosette_bladed') || 'Radiating rosette — multiple blades nucleating at a common center.');
  } else {
    parts.push(narrative_variant('azurite', 'monoclinic_prismatic') || 'Monoclinic prismatic — the flagship azurite habit. Deep blue trending to midnight-blue in thick crystals.');
  }
  const has_conversion = c.zones.some(z => (z.note || '').includes('→ malachite'));
  if (has_conversion) {
    parts.push(narrative_variant('azurite', 'malachite_conversion') || "Azurite → malachite conversion — CO₂ has been escaping from the pocket fluid and the CO₃ inventory dropped below azurite's stability. The crystal shape will persist (pseudomorph after azurite) but fill with the green lower-carbonate mineral. Most Chessy and Morenci azurite sits frozen mid-conversion — half blue, half green — the geochemist's equivalent of a butterfly emerging.");
  }
  if (c.dissolved && !has_conversion) {
    parts.push(narrative_variant('azurite', 'dissolved') || 'Acid dissolution — fizzes like calcite. Cu²⁺ and CO₃²⁻ released.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_rosasite(c) {
  // Prose lives in narratives/rosasite.md (mirror of aurichalcite).
  const parts = [`Rosasite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('rosasite') || "(Cu,Zn)₂(CO₃)(OH)₂ — monoclinic supergene carbonate, the Cu-dominant member of the rosasite-aurichalcite pair. Velvety blue-green spheres on the weathered face of Cu-Zn sulfide deposits. The crystal exists because chalcopyrite and sphalerite weathered together upstream and released their metals into the same carbonate-rich groundwater — and at the moment of nucleation, the fluid carried more Cu than Zn. A single ratio decides which species forms; the same broth with reversed proportions would have produced aurichalcite instead. Mohs 4, blue-green streak.");
  if (c.habit === 'acicular_radiating') {
    parts.push(narrative_variant('rosasite', 'acicular_radiating') || "Acicular radiating habit — the slow-grown, low-T form. Needle-like aggregates fanning out from a common origin, fibrous internal structure visible under magnification.");
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('rosasite', 'botryoidal') || "Botryoidal habit — the diagnostic rosasite form. Velvety spherical aggregates, mammillary crusts; the textbook specimens from Mapimi (Mexico) are sky-blue spheres on red limonite that look like planets in a rusted solar system.");
  } else {
    parts.push(narrative_variant('rosasite', 'encrusting_mammillary') || "Encrusting mammillary habit — thin crust at low supersaturation. Less aesthetic than the diagnostic spheres but more abundant in the field.");
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_aurichalcite(c) {
  // Prose lives in narratives/aurichalcite.md. Code dispatches on
  // habit; markdown owns the words. Inline fallbacks for offline.
  const parts = [`Aurichalcite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aurichalcite') || "(Zn,Cu)₅(CO₃)₂(OH)₆ — monoclinic supergene carbonate, the Zn-dominant mirror of rosasite. Pale blue-green tufted sprays so delicate that hardness 2 means a fingernail scratches them. Named for orichalcum, the mythical gold-alloy of Atlantis. The crystal formed because the weathering fluid happened to carry more Zn than Cu at the moment of nucleation; in a parallel run with the ratio inverted, this same broth would have grown rosasite instead. The two species are typically intergrown wherever both elements are present, the ratio drawing a chemical boundary through the mineral assemblage.");
  if (c.habit === 'tufted_spray') {
    parts.push(narrative_variant('aurichalcite', 'tufted_spray') || "Tufted divergent sprays — the diagnostic aurichalcite habit. Acicular crystals fanning out from a common origin, looking like frozen fireworks or sea anemones; the type material from Loktevskoye (1839) and the most aesthetic specimens from Mapimi are this form.");
  } else if (c.habit === 'radiating_columnar') {
    parts.push(narrative_variant('aurichalcite', 'radiating_columnar') || "Radiating spherical aggregates — denser than the default sprays, formed at higher supersaturation.");
  } else {
    parts.push(narrative_variant('aurichalcite', 'laminar_crust') || "Thin laminar crust — low-σ encrusting habit, common on mine walls where weathering supplied a steady but modest flux of Zn + Cu + CO₃.");
  }
  return parts.filter(p => p).join(' ');
},
});
