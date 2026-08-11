// ============================================================
// js/92d-narrators-hydroxide.ts — VugSimulator._narrate_<mineral> (hydroxide)
// ============================================================
// Per-mineral narrators for hydroxide-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (2): goethite, lepidocrocite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_lepidocrocite(c) {
  // Prose lives in narratives/lepidocrocite.md.
  const parts = [`Lepidocrocite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('lepidocrocite'));
  if (c.habit === 'platy_scales') parts.push(narrative_variant('lepidocrocite', 'platy_scales'));
  else if (c.habit === 'plumose_rosette') parts.push(narrative_variant('lepidocrocite', 'plumose_rosette'));
  else parts.push(narrative_variant('lepidocrocite', 'fibrous_micaceous'));
  parts.push(narrative_variant('lepidocrocite', 'conversion_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_goethite(c) {
  // Prose lives in narratives/goethite.md.
  const parts = [`Goethite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.position.includes('pseudomorph after pyrite')) {
    parts.push(narrative_variant('goethite', 'pseudomorph_after_pyrite'));
  } else if (c.position.includes('pseudomorph after chalcopyrite')) {
    parts.push(narrative_variant('goethite', 'pseudomorph_after_chalcopyrite'));
  } else if (c.position.includes('hematite')) {
    parts.push(narrative_variant('goethite', 'on_hematite'));
  }
  if (c.habit === 'botryoidal/stalactitic') {
    parts.push(narrative_variant('goethite', 'botryoidal_stalactitic'));
  } else if (c.habit === 'fibrous_acicular') {
    parts.push(narrative_variant('goethite', 'fibrous_acicular'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('goethite', 'acid_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},
});
