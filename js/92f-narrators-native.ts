// ============================================================
// js/92f-narrators-native.ts — VugSimulator._narrate_<mineral> (native)
// ============================================================
// Per-mineral narrators for native-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (7): native_arsenic, native_bismuth, native_copper, native_gold, native_silver, native_sulfur, native_tellurium.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_native_copper(c) {
  // Prose lives in narratives/native_copper.md.
  const parts = [`Native copper #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_copper'));
  if (c.habit === 'massive_sheet') {
    parts.push(narrative_variant('native_copper', 'massive_sheet'));
  } else if (c.habit === 'arborescent_dendritic') {
    parts.push(narrative_variant('native_copper', 'arborescent_dendritic'));
  } else if (c.habit === 'wire_copper') {
    parts.push(narrative_variant('native_copper', 'wire_copper'));
  } else {
    parts.push(narrative_variant('native_copper', 'cubic_dodecahedral'));
  }
  // (2026-06-10 review §2.4: the Liberty patina is SULFATE chemistry —
  // brochantite + antlerite (+ atacamite near sea air), not malachite.)
  parts.push(narrative_variant('native_copper', 'statue_of_liberty_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_native_gold(c) {
  // Prose lives in narratives/native_gold.md: blurb, three-way habit,
  // two-way alloy, and noble-tail structure.
  const parts = [`Native gold #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_gold'));
  if (c.habit === 'nugget') {
    parts.push(narrative_variant('native_gold', 'nugget'));
  } else if (c.habit === 'dendritic') {
    parts.push(narrative_variant('native_gold', 'dendritic'));
  } else {
    parts.push(narrative_variant('native_gold', 'octahedral_default'));
  }
  if (c.dominant_forms && c.dominant_forms.some(f => (f || '').toLowerCase().includes('electrum'))) {
    parts.push(narrative_variant('native_gold', 'alloy_electrum'));
  } else if (c.dominant_forms && c.dominant_forms.some(f => { const lo = (f || '').toLowerCase(); return lo.includes('cuproauride') || lo.includes('rose-gold'); })) {
    parts.push(narrative_variant('native_gold', 'alloy_cuproauride'));
  }
  parts.push(narrative_variant('native_gold', 'noble_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_native_bismuth(c) {
  // Prose lives in narratives/native_bismuth.md.
  const parts = [`Native bismuth #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_bismuth'));
  if (c.habit === 'arborescent_dendritic') parts.push(narrative_variant('native_bismuth', 'arborescent_dendritic'));
  else if (c.habit === 'feathery_bismuth') parts.push(narrative_variant('native_bismuth', 'feathery_bismuth'));
  else if (c.habit === 'skeletal_bismuth') parts.push(narrative_variant('native_bismuth', 'skeletal_bismuth'));
  else if (c.habit === 'rhombohedral_crystal') parts.push(narrative_variant('native_bismuth', 'rhombohedral_crystal'));
  else parts.push(narrative_variant('native_bismuth', 'massive_default'));
  // Zone-stack morphology read (morphology-generalization arc,
  // 2026-06-12): a stack carrying a dendritic episode recorded a redox
  // shock — say so even if quieter fluid later healed the habit over.
  {
    let dendr = 0, total = 0;
    for (const z of (c.zones || [])) {
      if (!(z.thickness_um > 0)) continue;
      total += z.thickness_um;
      if (z.morph_regime === 'dendritic') dendr += z.thickness_um;
    }
    if (total > 0 && dendr / total > 0.05 && c.habit !== 'arborescent_dendritic') {
      parts.push(narrative_variant('native_bismuth', 'morph_healed_dendrite', { pct: Math.round(100 * dendr / total) }));
    }
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_native_tellurium(c) {
  // Prose lives in narratives/native_tellurium.md.
  const parts = [`Native tellurium #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_tellurium'));
  if (c.habit === 'prismatic_hex') parts.push(narrative_variant('native_tellurium', 'prismatic_hex'));
  else if (c.habit === 'reticulated') parts.push(narrative_variant('native_tellurium', 'reticulated'));
  else parts.push(narrative_variant('native_tellurium', 'granular_default'));
  if ((c.position || '').includes('native_gold')) parts.push(narrative_variant('native_tellurium', 'on_native_gold'));
  if (c.dissolved) parts.push(narrative_variant('native_tellurium', 'oxidative_dissolution'));
  else if (c.zones && c.zones.length > 6) parts.push(narrative_variant('native_tellurium', 'tellurite_tarnish'));
  return parts.filter(p => p).join(' ');
},

  _narrate_native_sulfur(c) {
  // Prose lives in narratives/native_sulfur.md.
  const parts = [`Native sulfur #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_sulfur'));
  if (c.habit === 'bipyramidal_alpha') parts.push(narrative_variant('native_sulfur', 'bipyramidal_alpha'));
  else if (c.habit === 'prismatic_beta') parts.push(narrative_variant('native_sulfur', 'prismatic_beta'));
  else if (c.habit === 'sublimation_crust') parts.push(narrative_variant('native_sulfur', 'sublimation_crust'));
  if ((c.position || '').includes('celestine')) parts.push(narrative_variant('native_sulfur', 'on_celestine'));
  else if ((c.position || '').includes('aragonite') || (c.position || '').includes('selenite')) parts.push(narrative_variant('native_sulfur', 'biogenic_caprock'));
  if (c.dissolved) parts.push(narrative_variant('native_sulfur', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_native_arsenic(c) {
  // Prose lives in narratives/native_arsenic.md.
  const parts = [`Native arsenic #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_arsenic'));
  if (c.habit === 'reniform') parts.push(narrative_variant('native_arsenic', 'reniform'));
  else if (c.habit === 'rhombohedral_crystal') parts.push(narrative_variant('native_arsenic', 'rhombohedral_crystal'));
  else if (c.habit === 'arsenolamprite') parts.push(narrative_variant('native_arsenic', 'arsenolamprite'));
  else parts.push(narrative_variant('native_arsenic', 'massive_default'));
  if (c.dissolved) parts.push(narrative_variant('native_arsenic', 'oxidative_dissolution'));
  else if (c.zones && c.zones.length > 8) parts.push(narrative_variant('native_arsenic', 'arsenolite_tarnish'));
  return parts.filter(p => p).join(' ');
},

  _narrate_native_silver(c) {
  // Prose lives in narratives/native_silver.md.
  const parts = [`Native silver #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_silver'));
  if (c.habit === 'wire') {
    parts.push(narrative_variant('native_silver', 'wire'));
  } else if (c.habit === 'dendritic') {
    parts.push(narrative_variant('native_silver', 'dendritic'));
  } else if (c.habit === 'cubic_crystal') {
    parts.push(narrative_variant('native_silver', 'cubic_crystal'));
  } else {
    parts.push(narrative_variant('native_silver', 'massive'));
  }
  if (c.twinned && (c.twin_law || '').includes('{111}')) {
    parts.push(narrative_variant('native_silver', 'penetration_twin'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('native_silver', 'tarnishing_full'));
  } else if (c.zones && c.zones.length > 20) {
    parts.push(narrative_variant('native_silver', 'tarnishing_early'));
  }
  if ((c.position || '').includes('acanthite')) {
    parts.push(narrative_variant('native_silver', 'on_acanthite'));
  }
  return parts.filter(p => p).join(' ');
},
});
