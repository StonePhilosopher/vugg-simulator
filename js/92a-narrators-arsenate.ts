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
  parts.push(narrative_blurb('olivenite') || "Cu₂AsO₄(OH) — orthorhombic Cu arsenate, the Cu end of the olivenite-adamite series. Olive-green to grayish-green (the Cu chromophore — olive in name and color), Mohs 3-4. Cornwall is the type locality; Tsumeb and Bisbee produce showcase modern specimens. When Zn > Cu, adamite takes priority.");
  if (c.habit === 'fibrous') parts.push(narrative_variant('olivenite', 'fibrous') || "Fibrous — radiating acicular bundles, the Cornish 'wood-copper' silky habit.");
  else if (c.habit === 'prismatic') parts.push(narrative_variant('olivenite', 'prismatic') || 'Prismatic — the Cornwall display habit.');
  else parts.push(narrative_variant('olivenite', 'globular_default') || 'Globular — Tsumeb / Bisbee secondary habit.');
  return parts.filter(p => p).join(' ');
},

  _narrate_scorodite(c) {
  // Prose lives in narratives/scorodite.md. JS narrator added in this
  // commit. Dipyramidal habit splits at avg trace_Fe > 0.15 into Fe-rich
  // vs pale sub-variants (matches Python).
  const parts = [`Scorodite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('scorodite'));
  if (c.habit === 'dipyramidal') {
    const avgFe = (c.zones || []).reduce((s, z) => s + (z.trace_Fe || 0), 0) / Math.max((c.zones || []).length, 1);
    parts.push(narrative_variant('scorodite', avgFe > 0.15 ? 'dipyramidal_fe_rich' : 'dipyramidal_pale'));
  } else {
    parts.push(narrative_variant('scorodite', 'earthy_default'));
  }
  if (c.dissolved) parts.push(narrative_variant('scorodite', 'dissolved_arsenic_remobilization'));
  return parts.filter(p => p).join(' ');
},

  _narrate_adamite(c) {
  // Prose lives in narratives/adamite.md (boss-pushed canonical 2026-04-30).
  // Boss direction: JS tone + Python facts blend. Use Python's avg_Cu
  // dispatch logic (more precise than JS FLUORESCENT-note check), keep
  // JS-derived prose in markdown variants. Blurb is the opening line;
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
  // Prose lives in narratives/mimetite.md. Drift consolidation: JS-side
  // dispatch (3-way habit + tail) was richer than Python's; Python now
  // matches JS. JS gains a unified opening line that includes mm size
  // (matches Python pattern) and the on_galena variant uses Python's
  // chemistry-focused prose. Acid_dissolution is preserved (was Python-only).
  const parts = [`Mimetite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('mimetite'));
  if (c.habit && c.habit.includes('campylite')) {
    parts.push(narrative_variant('mimetite', 'campylite') || 'Campylite variety — the hexagonal prisms have curved, barrel-shaped faces from iron substituting for lead. The name comes from the Greek "kampylos" (bent). These are among the most sought-after mimetite specimens: orange-brown barrels with an almost waxy luster.');
  } else if (c.habit === 'prismatic') {
    parts.push(narrative_variant('mimetite', 'prismatic') || 'Hexagonal prisms — the classic apatite supergroup habit. Mimetite, pyromorphite, and vanadinite are all Pb₅(XO₄)₃Cl where X is As, P, or V respectively. Same structure, different chemistry, all beautiful.');
  } else {
    parts.push(narrative_variant('mimetite', 'tabular_default') || 'Tabular crystals with a resinous to adamantine luster. The lead gives them density — you can feel the weight of a mimetite specimen in your hand.');
  }
  if (c.position.includes('galena')) {
    parts.push(narrative_variant('mimetite', 'on_galena') || 'Growing on galena — its parent mineral. Galena (PbS) oxidizes, liberating lead into solution. That lead meets arsenic and chlorine in the oxidation zone and reprecipitates as mimetite.');
  }
  if (c.dissolved) parts.push(narrative_variant('mimetite', 'acid_dissolution'));
  parts.push(narrative_variant('mimetite', 'imitator_tail') || 'Mimetite\'s name means "imitator" — it was confused with pyromorphite for centuries because they\'re isostructural. Only chemistry tells them apart.');
  return parts.filter(p => p).join(' ');
},

  _narrate_erythrite(c) {
  // Prose lives in narratives/erythrite.md. JS gains paragenetic_source_cobaltite
  // dispatch (Python had it; sim crystal scan).
  const parts = [`Erythrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('erythrite') || "Co₃(AsO₄)₂·8H₂O — the crimson-pink cobalt arsenate, known to medieval miners as 'cobalt bloom.' A supergene product: primary cobalt arsenides (cobaltite, skutterudite) oxidized in surface waters, releasing Co²⁺ and arsenate that recombined in damp fractures.");
  if (c.habit === 'radiating_fibrous') {
    parts.push(narrative_variant('erythrite', 'radiating_fibrous') || 'Radiating fibrous sprays directly on a primary Co-arsenide substrate — the classic Schneeberg and Bou Azzer habit: the outer shell of an oxidizing cobaltite or skutterudite vein blooms pink.');
  } else if (c.habit === 'bladed_crystal') {
    parts.push(narrative_variant('erythrite', 'bladed_crystal') || 'Striated prismatic {010} blades, transparent crimson — the rare and prized erythrite crystal form, sharp enough to be mistaken for a kämmererite until the pink hue settles the identification.');
  } else if (c.habit === 'botryoidal_crust') {
    parts.push(narrative_variant('erythrite', 'botryoidal_crust') || 'Botryoidal rounded aggregates — high-supersaturation coating, mineral grape clusters spreading across the fracture wall.');
  } else {
    parts.push(narrative_variant('erythrite', 'earthy_default') || "Earthy pink crust — the classic 'cobalt bloom' field appearance, the first hint to a prospector that a cobalt arsenide is weathering nearby.");
  }
  if (c.position && (c.position.includes('cobaltite') || c.position.includes('arsenide'))) {
    parts.push(narrative_variant('erythrite', 'on_substrate', { position: c.position }) || `Growing on ${c.position} — direct replacement texture, the cobalt is moving centimeters at a time from primary sulfide to secondary arsenate.`);
  }
  const dissolvingCob = (this && this.crystals) ? this.crystals.filter(cb => cb.mineral === 'cobaltite' && cb.dissolved) : [];
  if (dissolvingCob.length && !(c.position || '').includes('cobaltite')) {
    parts.push(narrative_variant('erythrite', 'paragenetic_source_cobaltite', { cobaltite_id: dissolvingCob[0].crystal_id }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('erythrite', 'dehydration') || 'Dehydration or acid dissolution broke down the crystal — erythrite holds eight waters of crystallization in its structure, and they go first: above 200°C or below pH 4.5, the lattice collapses.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_annabergite(c) {
  // Prose lives in narratives/annabergite.md. JS gains paragenetic_source_*
  // dispatch (Python had it; sim crystal scan for nickeline + millerite).
  const parts = [`Annabergite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('annabergite') || "Ni₃(AsO₄)₂·8H₂O — 'nickel bloom,' the pale apple-green counterpart to erythrite. Same vivianite-group structure, nickel substitutes for cobalt, and the color shifts from crimson to green. Formed by oxidation of primary Ni-arsenides like niccolite and gersdorffite.");
  if (c.habit === 'cabrerite') {
    parts.push(narrative_variant('annabergite', 'cabrerite') || 'Mg substituted for Ni — this is cabrerite, the pale-green to white variety, named for the Sierra Cabrera in Spain. The Mg content bleaches the color toward off-white.');
  } else if (c.habit === 'co_bearing') {
    parts.push(narrative_variant('annabergite', 'co_bearing') || 'Co was also present in the fluid — the crystal shifted toward a pinkish-green intermediate, physically tracking the Ni/Co ratio along the erythrite-annabergite solid solution.');
  } else if (c.habit === 'capillary_crystal') {
    parts.push(narrative_variant('annabergite', 'capillary_crystal') || "Capillary hair-like fibers — the rare high-σ habit. Silky sprays of apple-green filaments, a collector's prize when intact.");
  } else {
    parts.push(narrative_variant('annabergite', 'earthy_default') || 'Earthy apple-green crust — the field appearance, an unmistakable green stain in the oxidation zone of any nickel-arsenide deposit.');
  }
  const dissolvingNik = (this && this.crystals) ? this.crystals.filter(nk => nk.mineral === 'nickeline' && nk.dissolved) : [];
  const dissolvingMil = (this && this.crystals) ? this.crystals.filter(ml => ml.mineral === 'millerite' && ml.dissolved) : [];
  if (dissolvingNik.length) {
    parts.push(narrative_variant('annabergite', 'paragenetic_source_nickeline', { nickeline_id: dissolvingNik[0].crystal_id }));
  } else if (dissolvingMil.length) {
    parts.push(narrative_variant('annabergite', 'paragenetic_source_millerite', { millerite_id: dissolvingMil[0].crystal_id }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('annabergite', 'dehydration') || 'Dehydration or acid dissolution consumed the crystal — like erythrite, annabergite is a hydrated arsenate with eight lattice waters and little stability outside a narrow T/pH window.');
  }
  return parts.filter(p => p).join(' ');
},
});
