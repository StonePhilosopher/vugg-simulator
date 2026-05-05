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
  parts.push(narrative_blurb('lepidocrocite') || 'γ-FeOOH — the ruby-red platy dimorph of goethite. Same formula, different crystal structure: goethite is a 3D framework (yellow-brown needles), lepidocrocite is layered (ruby-red platy, peels like mica). Kinetically favored when Fe²⁺ oxidizes FAST.');
  if (c.habit === 'platy_scales') parts.push(narrative_variant('lepidocrocite', 'platy_scales') || "Platy scales — the default habit. 'Lithium quartz' sold in rock shops is quartz with nanoscale lepidocrocite inclusions that scatter pink-mauve through the clear host.");
  else if (c.habit === 'plumose_rosette') parts.push(narrative_variant('lepidocrocite', 'plumose_rosette') || 'Plumose rosette — radiating platy blades. Cornwall and Siegerland (Germany) produced the best.');
  else parts.push(narrative_variant('lepidocrocite', 'fibrous_micaceous') || 'Fibrous micaceous — very rapid growth, coarser particle size, rust-brown color.');
  parts.push(narrative_variant('lepidocrocite', 'conversion_tail') || 'Given geological time, lepidocrocite converts to goethite (the thermodynamically stable dimorph).');
  return parts.filter(p => p).join(' ');
},

  _narrate_goethite(c) {
  // Prose lives in narratives/goethite.md.
  const parts = [`Goethite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.position.includes('pseudomorph after pyrite')) {
    parts.push(narrative_variant('goethite', 'pseudomorph_after_pyrite') || "It replaced pyrite atom-for-atom — the classic boxwork pseudomorph. What looks like a rusty pyrite cube is actually goethite that has inherited the sulfide's habit while the Fe-S lattice dissolved and Fe-O-OH precipitated in its place. The Egyptian Prophecy Stones' cousin — the rusty ghost of a crystal that was.");
  } else if (c.position.includes('pseudomorph after chalcopyrite')) {
    parts.push(narrative_variant('goethite', 'pseudomorph_after_chalcopyrite') || "Chalcopyrite oxidized and goethite took its place — a copper sulfide's iron heir. The copper went to malachite; the iron stayed here.");
  } else if (c.position.includes('hematite')) {
    parts.push(narrative_variant('goethite', 'on_hematite') || 'Nucleated on hematite — the hydrated/anhydrous iron oxide pair coexist in oxidation zones, separated only by how much water the fluid carried.');
  }
  if (c.habit === 'botryoidal/stalactitic') {
    parts.push(narrative_variant('goethite', 'botryoidal_stalactitic') || "Built up into stalactitic, botryoidal masses — the velvety black surfaces that collectors call 'black goethite.' Each layer a separate pulse of Fe-saturated water.");
  } else if (c.habit === 'fibrous_acicular') {
    parts.push(narrative_variant('goethite', 'fibrous_acicular') || 'Radiating needle habit — the fibrous goethite that grows as velvet crusts on cavity walls when Fe³⁺-rich fluid seeps slowly.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('goethite', 'acid_dissolution') || 'Acid attack released Fe³⁺ back to the fluid. Goethite survives oxidation but not strong acid — the rusty armor has a pH floor.');
  }
  return parts.filter(p => p).join(' ');
},
});
