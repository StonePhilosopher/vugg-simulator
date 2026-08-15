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
  parts.push(narrative_blurb('anglesite'));
  if ((c.position || '').includes('galena')) {
    parts.push(narrative_variant('anglesite', 'on_galena'));
  }
  if (c.zones.some(z => (z.note || '').includes('→ cerussite'))) {
    parts.push(narrative_variant('anglesite', 'converting_to_cerussite'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('anglesite', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_barite(c) {
  // Prose lives in narratives/barite.md; all habit branches are canonical here.
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
    if (c.c_length_mm < 100) {
      parts.push(narrative_variant('anhydrite', 'massive_granular_sabkha'));
    } else {
      parts.push(narrative_variant('anhydrite', 'massive_granular_porphyry'));
    }
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
  // Prose lives in narratives/selenite.md, including cathedral-blade,
  // swallowtail-twin, and dissolved variants.
  const parts = [`Selenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_variant('selenite', 'epigraph'));
  if (c.habit === 'rosette') {
    parts.push(narrative_variant('selenite', 'rosette'));
  } else if (c.habit && c.habit.includes('fibrous')) {
    parts.push(narrative_variant('selenite', 'fibrous'));
  } else if (c.habit === 'cathedral_blade') {
    parts.push(narrative_variant('selenite', 'cathedral_blade'));
  } else {
    parts.push(narrative_variant('selenite', 'blades_default', { mm: c.c_length_mm.toFixed(1) }));
  }
  if (c.position.includes('pyrite') || c.position.includes('chalcopyrite')) {
    parts.push(narrative_variant('selenite', 'on_sulfide'));
  }
  if (c.twinned && (c.twin_law || '').includes('swallowtail')) {
    parts.push(narrative_variant('selenite', 'swallowtail_twin', { twin_law: c.twin_law }));
  }
  if (c.c_length_mm > 10) {
    parts.push(narrative_variant('selenite', 'giant_naica'));
  }
  // Hourglass selenite — clay/sand/iron trapped on the low-T fast-growing sectors
  // (js/45 _seleniteHourglassParams; render js/99i). The Great Salt Plains signature.
  if (c._sectorZoned && c._sectorZoned.kind === 'gypsum_hourglass') {
    const hg = c._sectorZoned;
    if (hg.flooded) {
      parts.push(narrative_variant('selenite', 'hourglass_flooded'));
    } else {
      parts.push(narrative_variant('selenite', 'hourglass'));
    }
    if (hg.steps >= 2) {
      parts.push(narrative_variant('selenite', 'hourglass_stepped'));
    }
  }
  if (c.dissolved) {
    parts.push(narrative_variant('selenite', 'dissolved'));
  }
  parts.push(narrative_variant('selenite', 'epilogue_tail'));
  return parts.filter(p => p).join(' ');
},

  // Mirabilite and thenardite share a chemistry (Na₂SO₄) and a phase
  // boundary at 32.4°C — narrators reference each other where the
  // paramorph relationship matters.
  _narrate_mirabilite(c) {
    const parts = [`Mirabilite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Na₂SO₄·10H₂O — Glauber salt. The cold-evaporite half of the sodium-sulfate system. Decahydrate, stable only below 32.4°C — the eutectic with anhydrous thenardite. Forms in winter playas, Antarctic dry valleys, cold caves, and any Na-rich brine that cools without freezing.');

    if (c.habit === 'prismatic') {
      parts.push('Prismatic Glauber crystals — slow cooling, slow evaporation, transparent prisms with the elongation along [001]. Stable enough to handle in cold air; they tarnish over an hour at room temperature.');
    } else if (c.habit === 'fibrous_coating') {
      parts.push('Fibrous efflorescent crust — the brine reached the cave wall already at saturation and the crystals nucleated as a fine fibrous coating. The "lake-margin frost" habit, typical of the Aral Sea playa and the Antarctic dry-valley lakes.');
    }

    if (c.dissolved) {
      parts.push('Dissolved — the same meteoric pulse that takes halite takes mirabilite first. Among the most soluble of common minerals; the crystals reach equilibrium with their own brine and any fresh-water input shifts that equilibrium fast.');
    } else {
      // Existence warning — the crystal lattice is metastable above
      // 32.4°C, so any thermal pulse the scenario contains is a clock.
      parts.push("Living on borrowed time. Mirabilite's lattice loses all 10 water molecules to thenardite at the eutectic; most museum specimens are paramorphs now — the original transparent prisms are gone and the white powder in the case is thenardite preserving the external form. Every mirabilite specimen is a race against a warm dry day.");
    }

    return parts.filter(p => p).join(' ');
  },

  _narrate_thenardite(c) {
    const parts = [`Thenardite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Na₂SO₄ — anhydrous sodium sulfate, the warm-evaporite half of the mirabilite-thenardite pair. Crystallizes either by direct precipitation from a warm playa brine above 32.4°C, or by dehydration of mirabilite when the eutectic crosses upward. Searles Lake, Bayan Khar, Camp Verde, and the type locality at Espartinas Spain.');

    if (c.habit === 'dipyramidal') {
      parts.push('Orthorhombic dipyramidal habit — clean bipyramids when the crystal grew slowly from a stable supersaturated brine. The Searles Lake habit; well-formed Bayan Khar specimens look like ground glass dipyramids in matrix.');
    } else if (c.habit === 'tabular') {
      parts.push('Tabular habit — pinacoid-dominant flat plates, more common than the dipyramids in nature. The bookshelf-stack habit of Espartinas museum specimens.');
    } else if (c.habit === 'pseudomorph') {
      parts.push(`Paramorph after mirabilite — this crystal didn't grow as thenardite. It grew as mirabilite (Na₂SO₄·10H₂O, transparent prism, decahydrate), and a warm dry pulse pulled all 10 water molecules out of the lattice at the 32.4°C eutectic. The external prismatic form is mirabilite's; the internal arrangement and the chalky white surface are thenardite's. Every "old" thenardite specimen in a Smithsonian drawer started its life this way.`);
    } else if (c.habit === 'fibrous_coating') {
      parts.push('Fibrous saline crust — the efflorescent habit of arid-region soil thenardite. Forms wherever Na-sulfate-bearing groundwater wicks to a dry surface and the water flashes off, leaving a powdery white rind on stones and walls.');
    }

    if (c.dissolved) {
      parts.push('Dissolved — anhydrous thenardite is slightly less soluble than its decahydrate sibling, but in geological terms still a sponge. Goes with the first meteoric pulse.');
    }

    return parts.filter(p => p).join(' ');
  },
});
