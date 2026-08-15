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
  // Prose lives in narratives/quartz.md. Radiation is tracked at crystal
  // level, so the dispatcher selects the corresponding crystal-level variants.
  if (!c.zones.length) return narrative_variant('quartz', 'failed_to_develop', { crystal_id: c.crystal_id, nucleation_temp: c.nucleation_temp.toFixed(0) });
  const parts = [];
  const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
  if (ti_vals.length && Math.max(...ti_vals) > 0.01) {
    parts.push(narrative_variant('quartz', 'titanium_zoning', { max_ti: Math.max(...ti_vals).toFixed(3), min_ti: Math.min(...ti_vals).toFixed(3) }));
  }
  const fi_zones = c.zones.filter(z => z.fluid_inclusion);
  if (fi_zones.length) {
    const fi_types = [...new Set(fi_zones.map(z => z.inclusion_type))];
    parts.push(narrative_variant('quartz', 'fluid_inclusions', { count: fi_zones.length, types: fi_types.join(', ') }));
  }
  if (c.twinned) {
    parts.push(narrative_variant('quartz', 'twinned', { twin_law: c.twin_law }));
  }
  // Gwindel — the alpine-fissure twisted column (js/45 classifyQuartzGwindel).
  // Takes narrative precedence over the sceptre (it is the showpiece habit).
  if (c._gwindel) {
    parts.push(narrative_variant('quartz', 'gwindel', { twist: c._gwindel.twistDeg.toFixed(0) }));
  }
  // Sceptre — a gen-1 stem capped by a wider gen-2 termination (js/45
  // classifyQuartzSceptre). TWO natural routes, distinguished by _sceptre.route:
  // CORROSION (a fissure seal resorbed the tip, a breach regenerated it — grimsel's
  // alpine crack-seal, "etched and healed") and MASKING (a foreign film frosted the
  // prism, the tip renewed a wider cap THROUGH it — Takahashi & Sunagawa 2004 ELO,
  // "dusted and buried"). The masking route must NOT read as corrosion.
  if (c._sceptre && !c._gwindel) {
    if (c._sceptre.route === 'masking') {
      const film = c._sceptre.filmMineral || (c.zones || []).find((z: any) => z.masked_horizon && z.film_mineral)?.film_mineral;
      parts.push(narrative_variant('quartz', 'sceptre_masking', {
        capUm: c._sceptre.capUm.toFixed(0),
        film_phrase: film ? `${film} ` : '',
      }));
    } else {
      parts.push(narrative_variant('quartz', 'sceptre', { capUm: c._sceptre.capUm.toFixed(0) }));
    }
  }
  // Bent — POST-GROWTH deformation overprint (deformation/shear arc; js/45
  // classifyDeformation). The crystal grew straight, then a later tectonic shear
  // plastically bent it (bent quartz = post-growth bend-gliding, undulose strain
  // — NOT a growth habit). Distinct from the gwindel twist (a growth feature).
  if (c._deformation && c._deformation.kind === 'bend') {
    parts.push(narrative_variant('quartz', 'bent'));
  }
  // Tessin (Tessiner Habitus) — the alpine face development.
  if ((c.dominant_forms || []).some(f => f.includes('{40-41}/{30-31}'))) {
    parts.push(narrative_variant('quartz', 'tessin'));
  }
  // Smoky / morion colour centres (Rossman 1994 — Al + radiogenic-host γ-dose).
  const rd = c.radiation_damage || 0;
  if (rd > 0.3) {
    if (rd > 0.6) {
      parts.push(narrative_variant('quartz', 'morion', { dose: rd.toFixed(2) }));
    } else {
      parts.push(narrative_variant('quartz', 'smoky', { dose: rd.toFixed(2) }));
    }
  }
  const fast_zones = c.zones.filter(z => z.growth_rate > 15);
  const slow_zones = c.zones.filter(z => z.growth_rate > 0 && z.growth_rate < 2);
  if (fast_zones.length && slow_zones.length) {
    parts.push(narrative_variant('quartz', 'growth_oscillation', { max_rate: Math.max(...fast_zones.map(z => z.growth_rate)).toFixed(0) }));
  }
  const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 5 ? 'thumbnail' : 'cabinet-sized';
  parts.push(narrative_variant('quartz', 'final_size', { size_desc, mm: c.c_length_mm.toFixed(1), a_width_mm: c.a_width_mm.toFixed(1) }));
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcedony(c) {
  if (!c.zones.length) {
    return `Chalcedony #${c.crystal_id} nucleated at ${c.nucleation_temp.toFixed(0)}°C but did not build a resolvable microfibrous lining.`;
  }
  const positive = c.zones.filter(z => z.thickness_um > 0);
  const transitions = c.zones.filter(z => z._silica_transition);
  const parts = [
    `Chalcedony #${c.crystal_id} built ${positive.length} recorded cryptocrystalline SiO₂ layer${positive.length === 1 ? '' : 's'} to ${c.c_length_mm.toFixed(1)} mm.`,
  ];
  if (c.habit === 'banded_agate') {
    parts.push('AGATE — repeated silica-activity changes produced alternating length-fast fibrous bands recorded shell by shell; this is a chalcedony aggregate texture, not a quartz-filled-vug nickname.');
  } else if (c.habit === 'botryoidal_chalcedony') {
    parts.push('Radiating microfibres coalesced into botryoidal spherulites on the cavity wall.');
  } else {
    parts.push('Length-fast silica microfibres grew normal to the substrate as a thin wall veneer.');
  }
  if (transitions.length) {
    parts.push('Later quartz stability drove solution-mediated maturation: chalcedony shells dissolved back to the tracked silica pool before quartz could reprecipitate.');
  }
  return parts.join(' ');
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
  parts.push(narrative_blurb('albite'));
  const peristerite = c.zones.some(z => (z.note || '').includes('peristerite'));
  if (peristerite) parts.push(narrative_variant('albite', 'peristerite'));
  if (c.habit && c.habit.includes('cleavelandite')) parts.push(narrative_variant('albite', 'cleavelandite'));
  if (c.twinned) parts.push(narrative_variant('albite', 'twinned', { twin_law: c.twin_law }));
  if (c.dissolved) parts.push(narrative_variant('albite', 'dissolved'));
  return parts.filter(p => p).join(' ');
},

  _narrate_topaz(c) {
  // Prose lives in narratives/topaz.md.
  const parts = [`Topaz #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('topaz'));

  const imperial_pink = c.zones.some(z => (z.note || '').includes('pink imperial'));
  const imperial_gold = c.zones.some(z => (z.note || '').includes('imperial golden-orange'));
  const pale_blue = c.zones.some(z => (z.note || '').includes('pale blue'));
  const pale_yellow = c.zones.some(z => (z.note || '').includes('pale yellow'));

  if (imperial_pink) {
    parts.push(narrative_variant('topaz', 'pink_imperial'));
  } else if (imperial_gold) {
    parts.push(narrative_variant('topaz', 'imperial_gold'));
  } else if (pale_blue) {
    // (2026-06-10 review §2.4: "Iapetos-age pegmatites ... deliberately
    // irradiated" was a garbled phrase — rewritten to the actual story.)
    parts.push(narrative_variant('topaz', 'pale_blue'));
  } else if (pale_yellow) {
    parts.push(narrative_variant('topaz', 'pale_yellow'));
  } else {
    parts.push(narrative_variant('topaz', 'colorless_default'));
  }

  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    const geothermometer = inclusion_zones.some(z => (z.inclusion_type || '').includes('geothermometer'));
    if (geothermometer) {
      const avg_T = inclusion_zones.reduce((s, z) => s + z.temperature, 0) / inclusion_zones.length;
      parts.push(narrative_variant('topaz', 'fluid_inclusions_geothermometer', { count: inclusion_zones.length, avg_T: avg_T.toFixed(0) }));
    } else {
      parts.push(narrative_variant('topaz', 'fluid_inclusions', { count: inclusion_zones.length }));
    }
  }

  const avg_Ti = c.zones.reduce((s, z) => s + (z.trace_Ti || 0), 0) / Math.max(c.zones.length, 1);
  if (avg_Ti > 0.05) {
    parts.push(narrative_variant('topaz', 'trace_ti_rutile'));
  }

  if (c.phantom_count >= 1) {
    const phantomPhrase = `${c.phantom_count} phantom boundar${c.phantom_count > 1 ? 'ies' : 'y'}`;
    parts.push(narrative_variant('topaz', 'phantom_boundary', { phantom_phrase: phantomPhrase }));
  }

  if (c.dissolved) {
    parts.push(narrative_variant('topaz', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tourmaline(c) {
  // Prose lives in narratives/tourmaline.md.
  const parts = [`Tourmaline #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tourmaline'));
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
    parts.push(narrative_variant('tourmaline', 'color_zoned_schorl', { others: other.join(', ') }));
  } else if (varieties.has('paraiba')) {
    parts.push(narrative_variant('tourmaline', 'paraiba'));
  } else if (varieties.has('rubellite')) {
    parts.push(narrative_variant('tourmaline', 'rubellite'));
  } else if (varieties.has('verdelite')) {
    parts.push(narrative_variant('tourmaline', 'verdelite'));
  } else if (varieties.has('indicolite')) {
    parts.push(narrative_variant('tourmaline', 'indicolite'));
  } else if (varieties.has('schorl')) {
    parts.push(narrative_variant('tourmaline', 'schorl'));
  } else if (varieties.has('achroite')) {
    parts.push(narrative_variant('tourmaline', 'achroite'));
  }
  if (c._sectorZoned) {
    parts.push(narrative_variant('tourmaline', 'sector_zoned'));
  }
  parts.push(narrative_closing('tourmaline'));
  return parts.filter(p => p).join(' ');
},

  _narrate_andalusite(c) {
  // Prose lives in narratives/andalusite.md.
  const parts = [`Andalusite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('andalusite'));
  if (c._sectorZoned && c._sectorZoned.kind === 'cross') {
    parts.push(narrative_variant('andalusite', 'chiastolite'));
  } else {
    const notes = c.zones.map(z => (z.note || '').toLowerCase());
    if (notes.some(n => n.includes('viridine'))) parts.push(narrative_variant('andalusite', 'viridine'));
    else if (notes.some(n => n.includes('pink'))) parts.push(narrative_variant('andalusite', 'pink'));
  }
  parts.push(narrative_closing('andalusite'));
  return parts.filter(p => p).join(' ');
},

  _narrate_beryl(c) {
  // Prose lives in narratives/beryl.md. Goshenite / generic colorless
  // fallback; variety crystals are emerald/aquamarine/morganite/heliodor.
  const parts = [`Goshenite (beryl) #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('beryl'));
  parts.push(narrative_variant('beryl', 'goshenite_clean'));
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('beryl', 'fluid_inclusions', { count: inclusion_zones.length }));
  }
  parts.push(narrative_variant('beryl', 'c_axis_thermal_history'));
  if (c.dissolved) {
    parts.push(narrative_variant('beryl', 'hf_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_emerald(c) {
  // Prose lives in narratives/emerald.md.
  const parts = [`Emerald #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('emerald'));
  const is_trapiche = c.zones.some(z => (z.note || '').includes('trapiche')) || c.habit === 'trapiche';
  if (is_trapiche) {
    parts.push(narrative_variant('emerald', 'trapiche'));
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('emerald', 'jardin', { count: inclusion_zones.length }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('emerald', 'hf_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_aquamarine(c) {
  // Prose lives in narratives/aquamarine.md.
  const parts = [`Aquamarine #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aquamarine'));
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('aquamarine', 'fluid_inclusions', { count: inclusion_zones.length }));
  }
  if (c.habit === 'stubby_tabular') {
    parts.push(narrative_variant('aquamarine', 'stubby_tabular'));
  } else if (c.habit === 'hex_prism_long') {
    parts.push(narrative_variant('aquamarine', 'hex_prism_long'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('aquamarine', 'hf_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_morganite(c) {
  // Prose lives in narratives/morganite.md.
  const parts = [`Morganite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('morganite'));
  parts.push(narrative_variant('morganite', 'late_stage_pegmatite'));
  if (c.habit === 'tabular_hex') {
    parts.push(narrative_variant('morganite', 'tabular_hex'));
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('morganite', 'fluid_inclusions', { count: inclusion_zones.length }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('morganite', 'hf_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_heliodor(c) {
  // Prose lives in narratives/heliodor.md.
  const parts = [`Heliodor #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('heliodor'));
  if (c.zones.some(z => (z.note || '').includes('Namibian'))) {
    // (2026-06-10 review §2.4: Volodarsk-Volynskii is UKRAINE, not Namibia —
    // two localities were conflated. Variant KEY kept for back-compat.)
    parts.push(narrative_variant('heliodor', 'namibian_deep_yellow'));
  }
  const inclusion_zones = c.zones.filter(z => z.fluid_inclusion);
  if (inclusion_zones.length) {
    parts.push(narrative_variant('heliodor', 'fluid_inclusions', { count: inclusion_zones.length }));
  }
  parts.push(narrative_variant('heliodor', 'color_stability'));
  if (c.dissolved) {
    parts.push(narrative_variant('heliodor', 'hf_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_spodumene(c) {
  // Prose lives in narratives/spodumene.md.
  const parts = [`Spodumene #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('spodumene'));

  const notes = c.zones.map(z => (z.note || '').toLowerCase());
  const varieties = new Set();
  for (const n of notes) {
    if (n.includes('kunzite')) varieties.add('kunzite');
    if (n.includes('hiddenite')) varieties.add('hiddenite');
    if (n.includes('triphane')) varieties.add('triphane');
  }

  if (varieties.has('kunzite')) {
    parts.push(narrative_variant('spodumene', 'kunzite'));
  } else if (varieties.has('hiddenite')) {
    parts.push(narrative_variant('spodumene', 'hiddenite'));
    // (2026-06-10 review \u00a72.4: the old tail credited Minas Gerais with the
    // world's best hiddenite \u2014 true Cr-hiddenite's classic source is the
    // North Carolina discovery locality; Brazilian green spodumene is
    // mostly Fe-colored.)
  } else if (varieties.has('triphane')) {
    parts.push(narrative_variant('spodumene', 'triphane'));
  }

  parts.push(narrative_closing('spodumene'));
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
  parts.push(narrative_blurb('apophyllite'));
  if (c.habit === 'prismatic_tabular') parts.push(narrative_variant('apophyllite', 'prismatic_tabular'));
  else if (c.habit === 'hopper_growth') parts.push(narrative_variant('apophyllite', 'hopper_growth'));
  else if (c.habit === 'druzy_crust') parts.push(narrative_variant('apophyllite', 'druzy_crust'));
  else parts.push(narrative_variant('apophyllite', 'chalcedony_pseudomorph'));
  if (c._apophylliteGreen) {
    parts.push(narrative_variant('apophyllite', 'poona_green'));
  }
  const hematite_zones = c.zones.filter(z => z.note && z.note.includes('hematite needle phantom'));
  if (hematite_zones.length) {
    parts.push(narrative_variant('apophyllite', 'bloody_phantoms', { count: hematite_zones.length }));
  }
  if (c.position && c.position.includes('hematite')) {
    parts.push(narrative_variant('apophyllite', 'on_hematite'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('apophyllite', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  // v64 brief-19 narrator.
  _narrate_chrysoprase(c) {
    const parts = [`Chrysoprase #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Ni-bearing chalcedony — microfibrous SiO₂ with nano-inclusions of Ni-phyllosilicate (pimelite, willemseite, kerolite) trapped within the fabric. The apple-green color is a composite — no other gemstone is colored by nanoparticles of one mineral inside fibers of another. Heat fades it; sunlight slowly fades it. Mined since the 14th century at Szklary (Poland); modern world reference is Marlborough (Queensland).');
    if (c.habit === 'banded_chalcedony') parts.push('Faint internal banding — flow-deposition cycles imprinted in the chalcedony fabric.');
    if (c.dissolved) parts.push('Thermal fade — Ni-clay nano-inclusions destabilize above ~150°C, color shifts to white / yellow-brown irreversibly.');
    return parts.join(' ');
  },
});
