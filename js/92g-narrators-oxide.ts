// ============================================================
// js/92g-narrators-oxide.ts — VugSimulator._narrate_<mineral> (oxide)
// ============================================================
// Per-mineral narrators for oxide-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_hematite(c) {
  // Prose lives in narratives/hematite.md.
  const parts = [`Hematite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'specular') {
    parts.push(narrative_variant('hematite', 'specular'));
    if (c.zones && c.zones.some(z => z.note && z.note.includes('iridescent'))) {
      parts.push(narrative_variant('hematite', 'specular_iridescent'));
    }
  } else if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('hematite', 'rhombohedral'));
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('hematite', 'botryoidal'));
  } else if (c.habit === 'earthy/massive') {
    parts.push(narrative_variant('hematite', 'earthy_massive'));
  }
  if (c.twinned) parts.push(narrative_variant('hematite', 'twinned', { twin_law: c.twin_law }));
  if (c.dissolved) parts.push(narrative_variant('hematite', 'acid_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_corundum(c) {
  // Prose lives in narratives/corundum.md.
  const parts = [`Corundum #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('corundum'));
  if (c.habit === 'tabular') parts.push(narrative_variant('corundum', 'tabular'));
  else if (c.habit === 'barrel') parts.push(narrative_variant('corundum', 'barrel'));
  const avg_Ti = c.zones.reduce((s, z) => s + (z.trace_Ti || 0), 0) / Math.max(c.zones.length, 1);
  if (avg_Ti > 0.05) {
    parts.push(narrative_variant('corundum', 'trace_ti'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('corundum', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_ruby(c) {
  // Prose lives in narratives/ruby.md.
  const parts = [`Ruby #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('ruby'));
  const notes = c.zones.map(z => (z.note || ''));
  if (notes.some(n => n.includes("pigeon"))) parts.push(narrative_variant('ruby', 'pigeons_blood'));
  else if (notes.some(n => n.includes('cherry'))) parts.push(narrative_variant('ruby', 'cherry'));
  else if (notes.some(n => n.includes('pinkish'))) parts.push(narrative_variant('ruby', 'pinkish'));
  if (c.habit === 'asterated') parts.push(narrative_variant('ruby', 'asterated'));
  else if (c.habit === 'barrel') parts.push(narrative_variant('ruby', 'barrel'));
  else if (c.habit === 'tabular') parts.push(narrative_variant('ruby', 'tabular'));
  return parts.filter(p => p).join(' ');
},

  _narrate_sapphire(c) {
  // Prose lives in narratives/sapphire.md, including the violet (V³⁺,
  // Tanzania) zone-note variant.
  const parts = [`Sapphire #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('sapphire'));
  const notes = c.zones.map(z => (z.note || ''));
  if (notes.some(n => n.includes('cornflower'))) parts.push(narrative_variant('sapphire', 'cornflower'));
  else if (notes.some(n => n.includes('royal blue'))) parts.push(narrative_variant('sapphire', 'royal_blue'));
  else if (notes.some(n => n.includes('padparadscha'))) parts.push(narrative_variant('sapphire', 'padparadscha'));
  else if (notes.some(n => n.includes('yellow'))) parts.push(narrative_variant('sapphire', 'yellow'));
  else if (notes.some(n => n.includes('violet'))) parts.push(narrative_variant('sapphire', 'violet'));
  else if (notes.some(n => n.includes('pink'))) parts.push(narrative_variant('sapphire', 'pink'));
  else if (notes.some(n => n.includes('green'))) parts.push(narrative_variant('sapphire', 'green'));
  if (c.habit === 'asterated') parts.push(narrative_variant('sapphire', 'asterated'));
  else if (c.habit === 'barrel') parts.push(narrative_variant('sapphire', 'barrel'));
  else if (c.habit === 'tabular') parts.push(narrative_variant('sapphire', 'tabular'));
  return parts.filter(p => p).join(' ');
},

  _narrate_cuprite(c) {
  // Prose lives in narratives/cuprite.md.
  const parts = [`Cuprite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cuprite'));
  if (c.habit === 'chalcotrichite') {
    parts.push(narrative_variant('cuprite', 'chalcotrichite'));
  } else if ((c.habit || '').includes('massive')) {
    parts.push(narrative_variant('cuprite', 'massive'));
  } else if (c.twinned && (c.twin_law || '').includes('spinel')) {
    parts.push(narrative_variant('cuprite', 'spinel_twin'));
  } else {
    parts.push(narrative_variant('cuprite', 'octahedral_default'));
  }
  if (c.dissolved) parts.push(narrative_variant('cuprite', 'eh_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_magnetite(c) {
  // Prose lives in narratives/magnetite.md.
  const parts = [`Magnetite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('magnetite'));
  if (c.habit === 'octahedral') parts.push(narrative_variant('magnetite', 'octahedral'));
  else if (c.habit === 'rhombic_dodecahedral') parts.push(narrative_variant('magnetite', 'rhombic_dodecahedral'));
  else parts.push(narrative_variant('magnetite', 'granular_massive'));
  if (c.dissolved) parts.push(narrative_variant('magnetite', 'martite_pseudomorph'));
  return parts.filter(p => p).join(' ');
},

  _narrate_uraninite(c) {
  // Prose lives in narratives/uraninite.md.
  const parts = [`Uraninite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('uraninite'));
  if (c.nucleation_temp > 400) parts.push(narrative_variant('uraninite', 'pegmatite_high_t'));
  else parts.push(narrative_variant('uraninite', 'roll_front_low_t'));
  if (c.dissolved) parts.push(narrative_variant('uraninite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  // v64 brief-19 narrators.
  _narrate_rutile(c) {
    const parts = [`Rutile #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('TiO₂ — tetragonal Ti oxide, the canonical "needle" mineral. Most of the world has seen rutile only as needles inside quartz (Venus hair, Cupid\'s darts). As a free-standing crystal, rare and stranger: blood-red prisms with adamantine luster, geniculate elbow twins, reticulated sixling stars. Refractory and chemically inert — survives weathering unchanged.');
    if (c.position && c.position.includes('quartz')) parts.push('Included in quartz — the rutilated-quartz pattern.');
    if (c.habit === 'sixling_star') parts.push('Cyclic sixling — the rare reticulated rutile star, the "Cabo cabo" Brazilian aesthetic.');
    else if (c.habit === 'stout_prismatic') parts.push('Coarse alpine-cleft prism with dipyramid termination — high-T habit.');
    return parts.join(' ');
  },

  _narrate_chromite(c) {
    const parts = [`Chromite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('FeCr₂O₄ — magmatic Fe-Cr spinel, one of the first phases to crystallize from cooling mafic / ultramafic magma at 1200–1400°C. Atypical vug mineral — forms as black metallic octahedra in cumulus settings, then survives weathering unchanged due to extreme spinel-structure stability.');
    if (c.habit === 'massive_granular') parts.push('Granular cumulate fabric — the chromitite-seam aesthetic of layered mafic intrusions.');
    return parts.join(' ');
  },
});
