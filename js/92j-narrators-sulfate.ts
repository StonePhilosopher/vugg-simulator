// ============================================================
// js/92j-narrators-sulfate.ts — VugSimulator._narrate_<mineral> (sulfate)
// ============================================================
// Per-mineral narrators for sulfate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (10): alunite, anglesite, anhydrite, antlerite, barite, brochantite, celestine, chalcanthite, jarosite, selenite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_anglesite(c) {
  // Prose lives in narratives/anglesite.md.
  const parts = [`Anglesite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('anglesite') || 'PbSO₄ — orthorhombic lead sulfate, brilliant adamantine luster. Intermediate step in the galena → anglesite → cerussite oxidation sequence. Named for Anglesey, the Welsh island where the type specimens were found in the 1830s.');
  if ((c.position || '').includes('galena')) {
    parts.push(narrative_variant('anglesite', 'on_galena') || 'This crystal grew directly on a dissolving galena — the classic pseudomorphic relationship.');
  }
  if (c.zones.some(z => (z.note || '').includes('→ cerussite'))) {
    parts.push(narrative_variant('anglesite', 'converting_to_cerussite') || "Converting to cerussite.");
  }
  if (c.dissolved) {
    // dissolved-fallback shortened slightly to avoid ’ mismatch in fallback text
    parts.push(narrative_variant('anglesite', 'dissolved') || 'The crystal has dissolved. If the pocket\u2019s chemistry continues to evolve the released Pb²⁺ will find a new home — cerussite if carbonate is present, pyromorphite if phosphate arrives.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_barite(c) {
  // Prose lives in narratives/barite.md. JS narrator added in this
  // commit to close a JS-side gap (Python had a narrator; JS dispatch
  // would silently emit nothing for barite).
  const parts = [`Barite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('barite'));
  if (c.habit === 'tabular') parts.push(narrative_variant('barite', 'tabular'));
  else if (c.habit === 'bladed') parts.push(narrative_variant('barite', 'bladed'));
  else if (c.habit === 'cockscomb') parts.push(narrative_variant('barite', 'cockscomb'));
  else if (c.habit === 'prismatic') parts.push(narrative_variant('barite', 'prismatic'));
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  if (anyNote.includes('celestobarite')) parts.push(narrative_variant('barite', 'celestobarite'));
  if (anyNote.includes('honey-yellow')) parts.push(narrative_variant('barite', 'honey_yellow'));
  parts.push(narrative_variant('barite', 'industrial_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_celestine(c) {
  // Prose lives in narratives/celestine.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Celestine #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('celestine'));
  if (c.habit === 'nodular') parts.push(narrative_variant('celestine', 'nodular'));
  else if (c.habit === 'fibrous') parts.push(narrative_variant('celestine', 'fibrous'));
  else if (c.habit === 'bladed') parts.push(narrative_variant('celestine', 'bladed'));
  else parts.push(narrative_variant('celestine', 'tabular_default'));
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  if (anyNote.includes('barytocelestine')) parts.push(narrative_variant('celestine', 'barytocelestine'));
  if (anyNote.includes('Sicilian') || anyNote.includes('sulfur-vug')) parts.push(narrative_variant('celestine', 'sicilian_paragenesis'));
  parts.push(narrative_variant('celestine', 'industrial_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_anhydrite(c) {
  // Prose lives in narratives/anhydrite.md. JS narrator added in this
  // commit to close a JS-side gap. The massive_granular branch splits
  // at c_length_mm < 100 into sabkha vs porphyry sub-variants.
  const parts = [`Anhydrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('anhydrite'));
  if (c.habit === 'massive_granular') {
    parts.push(narrative_variant('anhydrite', c.c_length_mm < 100 ? 'massive_granular_sabkha' : 'massive_granular_porphyry'));
  } else if (c.habit === 'prismatic') {
    parts.push(narrative_variant('anhydrite', 'prismatic'));
  } else if (c.habit === 'fibrous') {
    parts.push(narrative_variant('anhydrite', 'fibrous'));
  } else {
    parts.push(narrative_variant('anhydrite', 'tabular_default'));
  }
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  if (anyNote.includes('angelite')) parts.push(narrative_variant('anhydrite', 'angelite'));
  if (c.dissolved) parts.push(narrative_variant('anhydrite', 'rehydration_to_gypsum'));
  parts.push(narrative_variant('anhydrite', 'industrial_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_jarosite(c) {
  // Prose lives in narratives/jarosite.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Jarosite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('jarosite'));
  if (c.habit === 'earthy_crust') parts.push(narrative_variant('jarosite', 'earthy_crust'));
  else if (c.habit === 'druzy') parts.push(narrative_variant('jarosite', 'druzy'));
  else parts.push(narrative_variant('jarosite', 'pseudocubic_default'));
  if (c.dissolved) parts.push(narrative_variant('jarosite', 'alkaline_shift'));
  parts.push(narrative_variant('jarosite', 'mars_connection'));
  return parts.filter(p => p).join(' ');
},

  _narrate_alunite(c) {
  // Prose lives in narratives/alunite.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Alunite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('alunite'));
  if (c.habit === 'earthy') parts.push(narrative_variant('alunite', 'earthy'));
  else if (c.habit === 'fibrous') parts.push(narrative_variant('alunite', 'fibrous'));
  else if (c.habit === 'tabular') parts.push(narrative_variant('alunite', 'tabular'));
  else parts.push(narrative_variant('alunite', 'pseudocubic_default'));
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  if (anyNote.includes('pinkish') || anyNote.includes('natroalunite')) parts.push(narrative_variant('alunite', 'pinkish_natroalunite'));
  if (c.dissolved) parts.push(narrative_variant('alunite', 'dissolved_alkaline_thermal'));
  parts.push(narrative_variant('alunite', 'ar_ar_geochronology'));
  return parts.filter(p => p).join(' ');
},

  _narrate_brochantite(c) {
  // Prose lives in narratives/brochantite.md. JS narrator added in this
  // commit to close a JS-side gap. Note the dissolved branch interpolates
  // a computed {cause} string (alkalinization vs acidification).
  const parts = [`Brochantite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('brochantite'));
  if (c.habit === 'drusy_crust') parts.push(narrative_variant('brochantite', 'drusy_crust'));
  else if (c.habit === 'acicular_tuft') parts.push(narrative_variant('brochantite', 'acicular_tuft'));
  else if (c.habit === 'short_prismatic') parts.push(narrative_variant('brochantite', 'short_prismatic'));
  else parts.push(narrative_variant('brochantite', 'botryoidal_default'));
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  if (anyNote.includes('Cl-rich')) parts.push(narrative_variant('brochantite', 'cl_rich'));
  if (c.dissolved) {
    const cause = (c.zones || []).some(z => (z.note || '').includes('pH > 7'))
      ? 'alkalinization (pH > 7) → tenorite/malachite stable'
      : 'acidification (pH < 3) → antlerite stable';
    parts.push(narrative_variant('brochantite', 'dissolved_pH_fork', { cause }));
  }
  parts.push(narrative_variant('brochantite', 'patina_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_antlerite(c) {
  // Prose lives in narratives/antlerite.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Antlerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('antlerite'));
  if (c.habit === 'granular') parts.push(narrative_variant('antlerite', 'granular'));
  else if (c.habit === 'acicular') parts.push(narrative_variant('antlerite', 'acicular'));
  else if (c.habit === 'short_prismatic') parts.push(narrative_variant('antlerite', 'short_prismatic'));
  else parts.push(narrative_variant('antlerite', 'drusy_default'));
  if (c.dissolved) parts.push(narrative_variant('antlerite', 'dissolved_neutralization'));
  const anyNote = (c.zones || []).map(z => z.note || '').join(' ');
  const onBrochantite = (c.zones || []).some(z => (z.note || '').includes('on dissolving brochantite')) || anyNote.includes('pH-fork');
  if (onBrochantite) parts.push(narrative_variant('antlerite', 'on_dissolving_brochantite'));
  parts.push(narrative_variant('antlerite', 'pragmatic_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcanthite(c) {
  // Prose lives in narratives/chalcanthite.md. JS narrator added in this
  // commit to close a JS-side gap.
  const parts = [`Chalcanthite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('chalcanthite'));
  if (c.habit === 'stalactitic') parts.push(narrative_variant('chalcanthite', 'stalactitic'));
  else if (c.habit === 'tabular') parts.push(narrative_variant('chalcanthite', 'tabular'));
  else parts.push(narrative_variant('chalcanthite', 'efflorescent_default'));
  if (c.twinned && (c.twin_law || '').includes('cruciform')) parts.push(narrative_variant('chalcanthite', 'cruciform_twin'));
  if (c.dissolved) parts.push(narrative_variant('chalcanthite', 'cyclic_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_selenite(c) {
  // Prose lives in narratives/selenite.md. JS canonical with Python
  // branches added (cathedral_blade habit, swallowtail_twin variant,
  // dissolved variant). User direction 2026-04-30: keep JS poetry,
  // fold Python branches on top.
  const parts = [`Selenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_variant('selenite', 'epigraph') || 'The crystal that grows when everything else is ending.');
  if (c.habit === 'rosette') {
    parts.push(narrative_variant('selenite', 'rosette') || 'Desert rose form — lenticular plates radiating from a center, trapping sand between the blades. Not a flower, but a crystal that grew through sand, incorporating the ground into itself.');
  } else if (c.habit && c.habit.includes('fibrous')) {
    parts.push(narrative_variant('selenite', 'fibrous') || "Satin spar habit — parallel fibers with a chatoyant sheen that catches light like cat's-eye. The crystals grew in a confined vein, forced into alignment by the narrow space.");
  } else if (c.habit === 'cathedral_blade') {
    parts.push(narrative_variant('selenite', 'cathedral_blade'));
  } else {
    parts.push(narrative_variant('selenite', 'blades_default', { mm: c.c_length_mm.toFixed(1) }) || `Transparent blades (${c.c_length_mm.toFixed(1)} mm) with perfect cleavage — so clear you can read through them. Selenite is named for Selene, the moon, for its soft pearly luster.`);
  }
  if (c.position.includes('pyrite') || c.position.includes('chalcopyrite')) {
    parts.push(narrative_variant('selenite', 'on_sulfide') || 'It nucleated on an oxidized sulfide surface — the sulfur that once locked up iron now combines with calcium as sulfate. Gypsum is the gravestone of pyrite. The same sulfur, a different life.');
  }
  if (c.twinned && (c.twin_law || '').includes('swallowtail')) {
    parts.push(narrative_variant('selenite', 'swallowtail_twin', { twin_law: c.twin_law }) || `Swallow-tail twinned (${c.twin_law}) — two blades meeting at an acute angle, like a bird frozen in flight. One of the most recognizable twin forms in mineralogy.`);
  }
  if (c.c_length_mm > 10) {
    parts.push(narrative_variant('selenite', 'giant_naica') || 'Large selenite crystals are among the biggest in nature — the Cave of Crystals in Naica, Mexico holds selenite beams 11 meters long, grown over 500,000 years in water just 2°C above saturation. Patience beyond patience.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('selenite', 'dissolved'));
  }
  parts.push(narrative_variant('selenite', 'epilogue_tail') || "Selenite forms in the last stage of a vug's life — when the fluid cools, the sulfides oxidize, and the water begins to evaporate. It is the epilogue crystal.");
  return parts.filter(p => p).join(' ');
},
});
