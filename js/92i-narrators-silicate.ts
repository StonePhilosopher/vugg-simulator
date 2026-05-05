// ============================================================
// js/92i-narrators-silicate.ts — VugSimulator._narrate_<mineral> (silicate)
// ============================================================
// Per-mineral narrators for silicate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (13): albite, apophyllite, aquamarine, beryl, chrysocolla, emerald, feldspar, heliodor, morganite, quartz, spodumene, topaz, tourmaline.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_quartz(c) {
  // Prose lives in narratives/quartz.md. JS dispatches a subset of the
  // Python branches — radiation_damage variants are Python-only because
  // JS tracks radiation at the crystal level rather than zones.
  if (!c.zones.length) return narrative_variant('quartz', 'failed_to_develop', { crystal_id: c.crystal_id, nucleation_temp: c.nucleation_temp.toFixed(0) }) || `Quartz #${c.crystal_id} nucleated but failed to develop — growth kinetics were too slow at ${c.nucleation_temp.toFixed(0)}°C.`;
  const parts = [];
  const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
  if (ti_vals.length && Math.max(...ti_vals) > 0.01) {
    parts.push(narrative_variant('quartz', 'titanium_zoning', { max_ti: Math.max(...ti_vals).toFixed(3), min_ti: Math.min(...ti_vals).toFixed(3) }) || `Titanium incorporation decreases through the growth zones from ${Math.max(...ti_vals).toFixed(3)} to ${Math.min(...ti_vals).toFixed(3)} ppm.`);
  }
  const fi_zones = c.zones.filter(z => z.fluid_inclusion);
  if (fi_zones.length) {
    const fi_types = [...new Set(fi_zones.map(z => z.inclusion_type))];
    parts.push(narrative_variant('quartz', 'fluid_inclusions', { count: fi_zones.length, types: fi_types.join(', ') }) || `The crystal trapped ${fi_zones.length} fluid inclusions (${fi_types.join(', ')}).`);
  }
  if (c.twinned) {
    parts.push(narrative_variant('quartz', 'twinned', { twin_law: c.twin_law }) || `A ${c.twin_law} twin formed during growth.`);
  }
  const fast_zones = c.zones.filter(z => z.growth_rate > 15);
  const slow_zones = c.zones.filter(z => z.growth_rate > 0 && z.growth_rate < 2);
  if (fast_zones.length && slow_zones.length) {
    parts.push(narrative_variant('quartz', 'growth_oscillation', { max_rate: Math.max(...fast_zones.map(z => z.growth_rate)).toFixed(0) }) || 'Growth alternated between rapid pulses and slow, high-quality periods near equilibrium.');
  }
  const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 5 ? 'thumbnail' : 'cabinet-sized';
  parts.push(narrative_variant('quartz', 'final_size', { size_desc, mm: c.c_length_mm.toFixed(1), a_width_mm: c.a_width_mm.toFixed(1) }) || `Final size: ${size_desc} (${c.c_length_mm.toFixed(1)} × ${c.a_width_mm.toFixed(1)} mm).`);
  return parts.filter(p => p).join(' ');
},

  _narrate_feldspar(c) {
  // Prose lives in narratives/feldspar.md (boss-pushed 2026-04-30 commit
  // 34ed3e8). JS canonical, polymorph storytelling, per-twin-law prose.
  const polymorph = c.mineral_display || 'feldspar';
  const parts = [];
  parts.push(narrative_blurb('feldspar', { polymorph: capitalize(polymorph), crystal_id: c.crystal_id }));
  if (polymorph === 'sanidine') parts.push(narrative_variant('feldspar', 'sanidine'));
  else if (polymorph === 'orthoclase') parts.push(narrative_variant('feldspar', 'orthoclase'));
  else if (polymorph === 'microcline') parts.push(narrative_variant('feldspar', 'microcline'));
  else if (polymorph === 'adularia') parts.push(narrative_variant('feldspar', 'adularia'));
  if (c.zones.some(z => z.note && z.note.includes('amazonite'))) parts.push(narrative_variant('feldspar', 'amazonite'));
  if (c.zones.some(z => z.note && z.note.includes('perthite'))) parts.push(narrative_variant('feldspar', 'perthite'));
  if (c.twinned) {
    const tl = c.twin_law || '';
    if (tl.includes('Carlsbad')) parts.push(narrative_variant('feldspar', 'carlsbad_twin'));
    else if (tl.includes('Baveno')) parts.push(narrative_variant('feldspar', 'baveno_twin'));
    else if (tl.includes('cross-hatched')) parts.push(narrative_variant('feldspar', 'cross_hatch_twin'));
    else if (tl.includes('albite')) parts.push(narrative_variant('feldspar', 'albite_twin'));
    else parts.push(narrative_variant('feldspar', 'generic_twin', { twin_law: tl }));
  }
  if (c.dissolved) parts.push(narrative_variant('feldspar', 'dissolved'));
  parts.push(narrative_closing('feldspar'));
  return parts.filter(p => p).join(' ');
},

  _narrate_albite(c) {
  // Prose lives in narratives/albite.md.
  const parts = [`Albite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('albite') || "NaAlSi₃O₈ — sodium end-member of the plagioclase series. At T < 450°C, albite orders to 'low-albite' (fully ordered Al/Si). Platy cleavelandite habit is the pegmatite signature.");
  const peristerite = c.zones.some(z => (z.note || '').includes('peristerite'));
  if (peristerite) parts.push(narrative_variant('albite', 'peristerite') || 'Ca²⁺ intergrowth produced peristerite — fine albite/oligoclase exsolution lamellae that scatter light into blue-white adularescence. The moonstone shimmer.');
  if (c.habit && c.habit.includes('cleavelandite')) parts.push(narrative_variant('albite', 'cleavelandite') || 'Cleavelandite habit — platy, lamellar blades curved like book-pages, the low-T hydrothermal signature.');
  if (c.twinned) parts.push(narrative_variant('albite', 'twinned', { twin_law: c.twin_law }) || `Twinned on the ${c.twin_law} — polysynthetic albite twinning creates the characteristic striped appearance of plagioclase in thin section.`);
  if (c.dissolved) parts.push(narrative_variant('albite', 'dissolved') || 'Acid released Na⁺, Al³⁺, and SiO₂ — albite is slightly more resistant than K-feldspar but still weathers to kaolinite under persistent acid attack.');
  return parts.filter(p => p).join(' ');
},

  _narrate_topaz(c) {
  // Prose lives in narratives/topaz.md.
  const parts = [`Topaz #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('topaz') || 'Al₂SiO₄(F,OH)₂ — orthorhombic, prismatic with steep pyramidal terminations.');

  const imperial_pink = c.zones.some(z => (z.note || '').includes('pink imperial'));
  const imperial_gold = c.zones.some(z => (z.note || '').includes('imperial golden-orange'));
  const pale_blue = c.zones.some(z => (z.note || '').includes('pale blue'));
  const pale_yellow = c.zones.some(z => (z.note || '').includes('pale yellow'));

  if (imperial_pink) {
    parts.push(narrative_variant('topaz', 'pink_imperial') || "Pink imperial — the rarest topaz coloration.");
  } else if (imperial_gold) {
    parts.push(narrative_variant('topaz', 'imperial_gold') || 'Imperial golden-orange — Cr³⁺ substituting for Al³⁺ in the topaz structure. The chromium came not from the main fluid but from nearby ultramafic country rock dissolving in trace. This is the signature of Ouro Preto / Capão do Lana — the only place on Earth where it\u2019s a commercial color.');
  } else if (pale_blue) {
    parts.push(narrative_variant('topaz', 'pale_blue') || 'Pale blue, F-rich and Cr-starved. In nature this coloration is often enhanced by subsequent radiation exposure — the sky-blue topaz flooded onto the market after Iapetos-age pegmatites started being deliberately irradiated.');
  } else if (pale_yellow) {
    parts.push(narrative_variant('topaz', 'pale_yellow') || "Pale yellow from Fe³⁺ in the Al site — the common 'imperial' knockoff. Without the Cr chromophore, this color is merely pretty, not legendary.");
  } else {
    parts.push(narrative_variant('topaz', 'colorless_default') || 'Colorless — the default for topaz grown in a Cr-poor, Fe-poor fluid.');
  }

  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    const geothermometer = inclusion_zones.some(z => (z.inclusion_type || '').includes('geothermometer'));
    if (geothermometer) {
      const avg_T = inclusion_zones.reduce((s, z) => s + z.temperature, 0) / inclusion_zones.length;
      parts.push(narrative_variant('topaz', 'fluid_inclusions_geothermometer', { count: inclusion_zones.length, avg_T: avg_T.toFixed(0) }) || `${inclusion_zones.length} fluid inclusion horizons at ~${avg_T.toFixed(0)}°C.`);
    } else {
      parts.push(narrative_variant('topaz', 'fluid_inclusions', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons preserved.`);
    }
  }

  const avg_Ti = c.zones.reduce((s, z) => s + (z.trace_Ti || 0), 0) / Math.max(c.zones.length, 1);
  if (avg_Ti > 0.05) {
    parts.push(narrative_variant('topaz', 'trace_ti_rutile') || 'Trace Ti hints at microscopic rutile needles.');
  }

  if (c.phantom_count >= 1) {
    const phantomPhrase = `${c.phantom_count} phantom boundar${c.phantom_count > 1 ? 'ies' : 'y'}`;
    parts.push(narrative_variant('topaz', 'phantom_boundary', { phantom_phrase: phantomPhrase }) || `${phantomPhrase} preserved.`);
  }

  if (c.dissolved) {
    parts.push(narrative_variant('topaz', 'dissolved') || 'Strong acid attack etched the surface.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tourmaline(c) {
  // Prose lives in narratives/tourmaline.md.
  const parts = [`Tourmaline #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tourmaline') || 'Complex cyclosilicate, trigonal — elongated prisms.');
  const notes = c.zones.map(z => (z.note || '').toLowerCase());
  const varieties = new Set();
  for (const n of notes) {
    if (n.includes('schorl')) varieties.add('schorl');
    if (n.includes('rubellite')) varieties.add('rubellite');
    if (n.includes('verdelite')) varieties.add('verdelite');
    if (n.includes('indicolite')) varieties.add('indicolite');
    if (n.includes('paraíba') || n.includes('paraiba')) varieties.add('paraiba');
    if (n.includes('achroite')) varieties.add('achroite');
  }
  if (varieties.has('schorl') && varieties.size > 1) {
    const other = [...varieties].filter(v => v !== 'schorl').sort();
    parts.push(narrative_variant('tourmaline', 'color_zoned_schorl', { others: other.join(', ') }) || `Color-zoned: started as schorl and transitioned to ${other.join(', ')}.`);
  } else if (varieties.has('paraiba')) {
    parts.push(narrative_variant('tourmaline', 'paraiba') || 'Paraíba blue — the Cu²⁺-activated glow.');
  } else if (varieties.has('rubellite')) {
    parts.push(narrative_variant('tourmaline', 'rubellite') || "Rubellite — Li-rich elbaite with Mn²⁺.");
  } else if (varieties.has('verdelite')) {
    parts.push(narrative_variant('tourmaline', 'verdelite') || "Verdelite — green elbaite.");
  } else if (varieties.has('indicolite')) {
    parts.push(narrative_variant('tourmaline', 'indicolite') || 'Indicolite — blue elbaite.');
  } else if (varieties.has('schorl')) {
    parts.push(narrative_variant('tourmaline', 'schorl') || 'Schorl — the black Fe²⁺-dominant end-member.');
  } else if (varieties.has('achroite')) {
    parts.push(narrative_variant('tourmaline', 'achroite') || 'Achroite — colorless elbaite.');
  }
  parts.push(narrative_closing('tourmaline') || 'The cross-section reads like a tree-ring record.');
  return parts.filter(p => p).join(' ');
},

  _narrate_beryl(c) {
  // Prose lives in narratives/beryl.md. Goshenite / generic colorless
  // fallback; variety crystals are emerald/aquamarine/morganite/heliodor.
  const parts = [`Goshenite (beryl) #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('beryl') || "Be₃Al₂Si₆O₁₈ — hexagonal cyclosilicate, colorless variety. Beryllium is the most incompatible common element in magmatic systems: no rock-forming mineral will take it, so Be accumulates in residual pegmatite fluid until beryl finally nucleates at high threshold. That's why beryl crystals can be enormous — by the time the first crystal fires, there's a lot of beryllium waiting.");
  parts.push(narrative_variant('beryl', 'goshenite_clean') || 'Goshenite is the truly colorless beryl: no chromophore above the variety-gate thresholds (Cr < 0.5 ppm, Mn < 2 ppm, Fe < 8 ppm, V < 1 ppm).');
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('beryl', 'fluid_inclusions', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons preserved at growth-zone boundaries — beryl is notorious for these, including the stepped "growth tubes" that make hexagonal cat's-eye chatoyancy possible.`);
  }
  parts.push(narrative_variant('beryl', 'c_axis_thermal_history') || 'If you sliced this goshenite perpendicular to the c-axis, the growth rings would map the pegmatite\'s thermal history. Wider bands mark warmer, faster growth; tight bands mark slow cool periods.');
  if (c.dissolved) {
    parts.push(narrative_variant('beryl', 'hf_dissolution') || 'HF-assisted dissolution etched the surface — beryl is very resistant, but fluoride-rich acid fluids will eventually eat it, releasing Be²⁺ and SiO₂ back to the pocket.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_emerald(c) {
  // Prose lives in narratives/emerald.md.
  const parts = [`Emerald #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('emerald') || "Be₃Al₂Si₆O₁₈ + Cr³⁺ (or V³⁺) — the chromium variety of beryl. The 'emerald paradox': Cr is an ultramafic element (peridotite/komatiite), Be is the most incompatible of common pegmatitic elements. These two chemistries almost never coexist in the same fluid.");
  const is_trapiche = c.zones.some(z => (z.note || '').includes('trapiche')) || c.habit === 'trapiche';
  if (is_trapiche) {
    parts.push(narrative_variant('emerald', 'trapiche') || 'Trapiche pattern — the 6-spoke wheel of dark inclusion rays between six green sector-crystals. A Colombian Muzo specialty.');
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('emerald', 'jardin', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons preserved — emerald is famous for its 'jardin' (French for garden), the dense field of primary 3-phase fluid inclusions that every natural emerald carries.`);
  }
  if (c.dissolved) {
    parts.push(narrative_variant('emerald', 'hf_dissolution') || 'HF-assisted dissolution etched the surface — emerald shares beryl\'s acid resistance and only dissolves under fluoride.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_aquamarine(c) {
  // Prose lives in narratives/aquamarine.md.
  const parts = [`Aquamarine #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aquamarine') || 'Be₃Al₂Si₆O₁₈ + Fe²⁺ — the blue variety of beryl. Most abundant gem beryl variety; every gem-producing pegmatite yields aquamarine. Fe²⁺ substitutes in the channel sites and the Al octahedral site.');
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('aquamarine', 'fluid_inclusions', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons at zone boundaries. Aquamarine's 'growth tubes' — stepped hexagonal negative-crystal voids — are what make the cat's-eye chatoyancy effect possible when the crystal is cut en cabochon.`);
  }
  if (c.habit === 'stubby_tabular') {
    parts.push(narrative_variant('aquamarine', 'stubby_tabular') || 'Stubby tabular habit — late-stage, T < 380°C. The flat basal pinacoid dominates over the hexagonal prism, making this crystal look more like a squat bar than the cigarette-shape of hotter Cruzeiro aquamarines.');
  } else if (c.habit === 'hex_prism_long') {
    parts.push(narrative_variant('aquamarine', 'hex_prism_long') || "Long hexagonal-prism habit — the Cruzeiro 'cigarette' shape. Classic higher-T (>400°C) pegmatite pocket signature, where the c-axis growth outpaces the a-axis by a factor of several.");
  }
  if (c.dissolved) {
    parts.push(narrative_variant('aquamarine', 'hf_dissolution') || 'HF-assisted dissolution etched the surface — aquamarine shares beryl\'s acid resistance.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_morganite(c) {
  // Prose lives in narratives/morganite.md.
  const parts = [`Morganite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('morganite') || 'Be₃Al₂Si₆O₁₈ + Mn²⁺ — the pink-to-peach variety of beryl. Mn²⁺ substitutes in the Al octahedral site; natural alpha-particle irradiation oxidizes Mn²⁺ to Mn³⁺ producing the pink hue. Named by George F. Kunz of Tiffany & Co (1911) after J.P. Morgan.');
  parts.push(narrative_variant('morganite', 'late_stage_pegmatite') || 'Morganite is late in the pegmatite sequence. Mn accumulates in residual fluid while earlier phases (feldspar, quartz, aquamarine) crystallize — when the pocket is finally late enough for Mn > 2 ppm, morganite fires. Pala District California, Madagascar, and Minas Gerais Brazil are the top gem sources.');
  if (c.habit === 'tabular_hex') {
    parts.push(narrative_variant('morganite', 'tabular_hex') || "Tabular hexagonal habit — morganite's signature flat pinacoid-dominated plate, unlike the prismatic habit of aquamarine and emerald. The Urucum pocket (Minas Gerais, 1995) yielded the largest gem morganite crystal at 35+ kg in this habit.");
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('morganite', 'fluid_inclusions', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons — morganite is usually cleaner than aquamarine or emerald because it grew so late in the pegmatite sequence.`);
  }
  if (c.dissolved) {
    parts.push(narrative_variant('morganite', 'hf_dissolution') || 'HF-assisted dissolution etched the surface. Unusual for morganite — the pocket must have received a late fluorine-rich acid pulse after the main morganite growth ceased.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_heliodor(c) {
  // Prose lives in narratives/heliodor.md.
  const parts = [`Heliodor #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('heliodor') || 'Be₃Al₂Si₆O₁₈ + Fe³⁺ — the yellow variety of beryl. Same iron as aquamarine but oxidized to the Fe³⁺ state; the aquamarine/heliodor split is the cleanest redox record in the gem world.');
  if (c.zones.some(z => (z.note || '').includes('Namibian'))) {
    parts.push(narrative_variant('heliodor', 'namibian_deep_yellow') || 'Namibian deep-yellow — high-Fe strongly-oxidizing pocket signature. The Volodarsk pegmatite cross-cuts Fe-rich country rock, delivering both the Fe source and the late oxidizing pulse that converts Fe²⁺ to Fe³⁺.');
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('heliodor', 'fluid_inclusions', { count: inclusion_zones.length }) || `${inclusion_zones.length} fluid inclusion horizons — the oxidizing pocket often contains primary CO₂-rich 2-phase inclusions, distinguishing heliodor from the more aqueous-inclusion-rich aquamarine.`);
  }
  parts.push(narrative_variant('heliodor', 'color_stability') || 'Color stability note: natural heliodor is radiation-sensitive. Deep-yellow specimens often lose color on heating above 400°C, reverting to goshenite.');
  if (c.dissolved) {
    parts.push(narrative_variant('heliodor', 'hf_dissolution') || 'HF-assisted dissolution etched the surface — heliodor shares beryl\'s acid resistance; dissolution means a late fluorine-rich acid pulse.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_spodumene(c) {
  // Prose lives in narratives/spodumene.md.
  const parts = [`Spodumene #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('spodumene') || "LiAlSi₂O₆ — monoclinic pyroxene. Two cleavage directions intersect at ~87°, and that's the diagnostic feature: when spodumene survives dissolution events, parting fragments from those cleavage planes litter the pocket floor. The 'book shape' flattened tabular habit is the signature. Can reach 14 meters in real pegmatites (Etta mine, South Dakota) — among the longest single crystals on Earth.");

  const notes = c.zones.map(z => (z.note || '').toLowerCase());
  const varieties = new Set();
  for (const n of notes) {
    if (n.includes('kunzite')) varieties.add('kunzite');
    if (n.includes('hiddenite')) varieties.add('hiddenite');
    if (n.includes('triphane')) varieties.add('triphane');
  }

  if (varieties.has('kunzite')) {
    parts.push(narrative_variant('spodumene', 'kunzite') || "Kunzite — the pink-lilac Mn²⁺ variety, named for George Kunz, Tiffany & Co.'s mineralogist who bought Minas Gerais specimens by the crate in the early 1900s. Kunzite fluoresces strongly pink-orange under SW UV, a diagnostic test no other pink gem material passes. Color depth correlates with growth rate — faster growth traps more color-causing impurity.");
  } else if (varieties.has('hiddenite')) {
    parts.push(narrative_variant('spodumene', 'hiddenite') || 'Hiddenite — the green Cr³⁺ variety, named for William Earl Hidden, who discovered the North Carolina locality in 1879. Much rarer than kunzite because Cr³⁺ needs to diffuse from country rock into the pegmatite fluid at just the right moment. Minas Gerais produces the world\u2019s best hiddenite.');
  } else if (varieties.has('triphane')) {
    parts.push(narrative_variant('spodumene', 'triphane') || "Triphane — pale yellow-green or colorless, the iron-trace end-member. The name means 'three-appearing' (Greek), for the dichroism that shifts the hue depending on viewing angle. The default spodumene species when no strong chromophore is present.");
  }

  parts.push(narrative_closing('spodumene') || 'A cross-section of this crystal perpendicular to the c-axis would show the pyroxene chain silicate structure: SiO₄ tetrahedra linked into single chains along c, with Li and Al occupying the M1 and M2 octahedral sites between them.');
  return parts.filter(p => p).join(' ');
},

  _narrate_chrysocolla(c) {
  // Prose lives in narratives/chrysocolla.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Chrysocolla #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('chrysocolla'));
  if (c.habit === 'pseudomorph_after_azurite') parts.push(narrative_variant('chrysocolla', 'pseudomorph_after_azurite'));
  else if (c.habit === 'enamel_on_cuprite') parts.push(narrative_variant('chrysocolla', 'enamel_on_cuprite'));
  else if (c.habit === 'botryoidal_crust') parts.push(narrative_variant('chrysocolla', 'botryoidal_crust'));
  else if (c.habit === 'reniform_globules') parts.push(narrative_variant('chrysocolla', 'reniform_globules'));
  else parts.push(narrative_variant('chrysocolla', 'silica_gel_default'));
  if (c.dissolved) parts.push(narrative_variant('chrysocolla', 'dissolved'));
  return parts.filter(p => p).join(' ');
},

  _narrate_apophyllite(c) {
  // Prose lives in narratives/apophyllite.md.
  const parts = [`Apophyllite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('apophyllite') || "KCa₄Si₈O₂₀(F,OH)·8H₂O — a tetragonal sheet silicate, technically a phyllosilicate that's classed with the zeolites because of its hydrated, vesicle-filling behavior. Stage III Deccan Traps mineral.");
  if (c.habit === 'prismatic_tabular') parts.push(narrative_variant('apophyllite', 'prismatic_tabular') || 'Pseudo-cubic tabular habit — the hallmark apophyllite block.');
  else if (c.habit === 'hopper_growth') parts.push(narrative_variant('apophyllite', 'hopper_growth') || 'Stepped/terraced faces — high-supersaturation hopper habit.');
  else if (c.habit === 'druzy_crust') parts.push(narrative_variant('apophyllite', 'druzy_crust') || 'Fine-grained drusy coating — the very-high-σ form.');
  else parts.push(narrative_variant('apophyllite', 'chalcedony_pseudomorph') || "Chalcedony pseudomorph — at low σ the crystal grew over an earlier zeolite blade.");
  const hematite_zones = c.zones.filter(z => z.note && z.note.includes('hematite needle phantom'));
  if (hematite_zones.length) {
    parts.push(narrative_variant('apophyllite', 'bloody_phantoms', { count: hematite_zones.length }) || `${hematite_zones.length} growth zones carry hematite needle phantoms — this is the 'bloody apophyllite' variety from Nashik.`);
  }
  if (c.position && c.position.includes('hematite')) {
    parts.push(narrative_variant('apophyllite', 'on_hematite') || 'Nucleated directly on a pre-existing hematite — the iron oxide became the seed for vesicle filling.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('apophyllite', 'dissolved') || 'Acid attack dissolved the crystal — apophyllite is an alkaline-stable phase.');
  }
  return parts.filter(p => p).join(' ');
},
});
