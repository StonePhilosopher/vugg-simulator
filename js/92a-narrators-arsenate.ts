// ============================================================
// js/92a-narrators-arsenate.ts — VugSimulator._narrate_<mineral> (arsenate)
// ============================================================
// Per-mineral narrators for arsenate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (6): adamite, annabergite, erythrite, mimetite, olivenite, scorodite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_olivenite(c) {
  // Prose lives in narratives/olivenite.md.
  const parts = [`Olivenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('olivenite'));
  if (c.habit === 'fibrous') parts.push(narrative_variant('olivenite', 'fibrous'));
  else if (c.habit === 'prismatic') parts.push(narrative_variant('olivenite', 'prismatic'));
  else parts.push(narrative_variant('olivenite', 'globular_default'));
  return parts.filter(p => p).join(' ');
},

  _narrate_scorodite(c) {
  // Prose lives in narratives/scorodite.md. JS narrator added in this
  // commit. Dipyramidal habit splits at avg trace_Fe > 0.15 into Fe-rich
  // vs pale sub-variants.
  const parts = [`Scorodite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('scorodite'));
  if (c.habit === 'dipyramidal') {
    const avgFe = (c.zones || []).reduce((s, z) => s + (z.trace_Fe || 0), 0) / Math.max((c.zones || []).length, 1);
    if (avgFe > 0.15) {
      parts.push(narrative_variant('scorodite', 'dipyramidal_fe_rich'));
    } else {
      parts.push(narrative_variant('scorodite', 'dipyramidal_pale'));
    }
  } else {
    parts.push(narrative_variant('scorodite', 'earthy_default'));
  }
  if (c.dissolved) parts.push(narrative_variant('scorodite', 'dissolved_arsenic_remobilization'));
  return parts.filter(p => p).join(' ');
},

  _narrate_adamite(c) {
  // Prose lives in narratives/adamite.md (boss-pushed canonical 2026-04-30).
  // Uses the avg_Cu dispatch (more precise than a FLUORESCENT-note check)
  // while Markdown owns the prose. Blurb is the opening line;
  // closing is always-emitted tail.
  const parts = [];
  parts.push(narrative_blurb('adamite', { crystal_id: c.crystal_id }));
  const avgCu = c.zones.reduce((s, z) => s + (z.trace_Cu || 0), 0) / Math.max(c.zones.length, 1);
  const cuproNote = c.zones.some(z => (z.note || '').includes('cuproadamite'));
  if (avgCu > 0.5 || cuproNote) parts.push(narrative_variant('adamite', 'fluorescent'));
  else parts.push(narrative_variant('adamite', 'non_fluorescent'));
  if (c.position.includes('goethite') || c.position.includes('hematite')) {
    parts.push(narrative_variant('adamite', 'on_goethite'));
  }
  if (c.habit === 'acicular sprays') parts.push(narrative_variant('adamite', 'acicular'));
  const activeOli = (this && this.crystals) ? this.crystals.filter(oc => oc.mineral === 'olivenite' && oc.active) : [];
  if (activeOli.length) parts.push(narrative_variant('adamite', 'olivenite_companion'));
  if (c.dissolved) parts.push(narrative_variant('adamite', 'dissolved'));
  parts.push(narrative_closing('adamite'));
  return parts.filter(p => p).join(' ');
},

  _narrate_mimetite(c) {
  // Prose lives in narratives/mimetite.md. The three-way habit dispatch,
  // unified opening line, on-galena chemistry, and acid-dissolution branch
  // are all canonical here.
  const parts = [`Mimetite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('mimetite'));
  if (c.habit && c.habit.includes('campylite')) {
    parts.push(narrative_variant('mimetite', 'campylite'));
  } else if (c.habit === 'prismatic') {
    parts.push(narrative_variant('mimetite', 'prismatic'));
  } else {
    parts.push(narrative_variant('mimetite', 'tabular_default'));
  }
  if (c.position.includes('galena')) {
    parts.push(narrative_variant('mimetite', 'on_galena'));
  }
  if (c.dissolved) parts.push(narrative_variant('mimetite', 'acid_dissolution'));
  parts.push(narrative_variant('mimetite', 'imitator_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_erythrite(c) {
  // Prose lives in narratives/erythrite.md. Paragenetic-source dispatch scans
  // the live simulator crystals for cobaltite.
  const parts = [`Erythrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('erythrite'));
  if (c.habit === 'radiating_fibrous') {
    parts.push(narrative_variant('erythrite', 'radiating_fibrous'));
  } else if (c.habit === 'bladed_crystal') {
    parts.push(narrative_variant('erythrite', 'bladed_crystal'));
  } else if (c.habit === 'botryoidal_crust') {
    parts.push(narrative_variant('erythrite', 'botryoidal_crust'));
  } else {
    parts.push(narrative_variant('erythrite', 'earthy_default'));
  }
  if (c.position && (c.position.includes('cobaltite') || c.position.includes('arsenide'))) {
    parts.push(narrative_variant('erythrite', 'on_substrate', { position: c.position }));
  }
  const dissolvingCob = (this && this.crystals) ? this.crystals.filter(cb => cb.mineral === 'cobaltite' && cb.dissolved) : [];
  if (dissolvingCob.length && !(c.position || '').includes('cobaltite')) {
    parts.push(narrative_variant('erythrite', 'paragenetic_source_cobaltite', { cobaltite_id: dissolvingCob[0].crystal_id }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('erythrite', 'dehydration'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_annabergite(c) {
  // Prose lives in narratives/annabergite.md. Paragenetic-source dispatch
  // scans live simulator crystals for nickeline and millerite.
  const parts = [`Annabergite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('annabergite'));
  if (c.habit === 'cabrerite') {
    parts.push(narrative_variant('annabergite', 'cabrerite'));
  } else if (c.habit === 'co_bearing') {
    parts.push(narrative_variant('annabergite', 'co_bearing'));
  } else if (c.habit === 'capillary_crystal') {
    parts.push(narrative_variant('annabergite', 'capillary_crystal'));
  } else {
    parts.push(narrative_variant('annabergite', 'earthy_default'));
  }
  const dissolvingNik = (this && this.crystals) ? this.crystals.filter(nk => nk.mineral === 'nickeline' && nk.dissolved) : [];
  const dissolvingMil = (this && this.crystals) ? this.crystals.filter(ml => ml.mineral === 'millerite' && ml.dissolved) : [];
  if (dissolvingNik.length) {
    parts.push(narrative_variant('annabergite', 'paragenetic_source_nickeline', { nickeline_id: dissolvingNik[0].crystal_id }));
  } else if (dissolvingMil.length) {
    parts.push(narrative_variant('annabergite', 'paragenetic_source_millerite', { millerite_id: dissolvingMil[0].crystal_id }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('annabergite', 'dehydration'));
  }
  return parts.filter(p => p).join(' ');
},
});
