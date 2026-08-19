// ============================================================
// js/92b-narrators-carbonate.ts — VugSimulator._narrate_<mineral> (carbonate)
// ============================================================
// Per-mineral narrators for carbonate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (11): aragonite, aurichalcite, azurite, calcite, cerussite, dolomite, malachite, rhodochrosite, rosasite, siderite, smithsonite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_calcite(c) {
  // Prose lives in narratives/calcite.md.
  const parts = [];
  if (c.zones.length) {
    const mn_zones = c.zones.filter(z => z.trace_Mn > 1.0 && z.trace_Fe < 2.0);
    const fe_zones = c.zones.filter(z => z.trace_Fe > 3.0);
    if (mn_zones.length && fe_zones.length) {
      const mn_end = mn_zones[mn_zones.length - 1].step;
      const fe_start = fe_zones[0].step;
      if (fe_start > mn_end - 5) {
        parts.push(narrative_variant('calcite', 'mn_fe_quench', { fe_start }));
      }
    } else if (mn_zones.length) {
      parts.push(narrative_variant('calcite', 'mn_only'));
    }
  }
  // Calcite-morphology arc Phase 5 (2026-06-11): the growth-regime story,
  // read from the per-zone tags — the renderer builds these same bands
  // into visible terraces, so the prose and the geometry tell one story.
  const morphTagged = c.zones.filter(z => z.morph_regime && z.thickness_um > 0);
  if (morphTagged.length) {
    const morphMass: Record<string, number> = {};
    for (const z of morphTagged) morphMass[z.morph_regime] = (morphMass[z.morph_regime] || 0) + z.thickness_um;
    const morphTotal = Object.values(morphMass).reduce((s: number, x: number) => s + x, 0);
    const steppedShare = ((morphMass.stepped_macro || 0) + (morphMass.stepped_mild || 0)) / morphTotal;
    const hopperShare = (morphMass.hopper_skeletal || 0) / morphTotal;
    let stepBands = 0, prevRegime = null;
    for (const z of morphTagged) {
      const stepped = z.morph_regime === 'stepped_macro' || z.morph_regime === 'stepped_mild';
      if (stepped && prevRegime !== 'stepped') stepBands++;
      prevRegime = stepped ? 'stepped' : z.morph_regime;
    }
    if (hopperShare > 0.5) {
      parts.push(narrative_variant('calcite', 'morph_hopper'));
    } else if (steppedShare > 0.1 && stepBands > 0) {
      parts.push(narrative_variant('calcite', 'morph_stepped', { bands: stepBands, bands_s: stepBands === 1 ? '' : 's' }));
    }
    // DIRECTIONAL {104} stepping (central-distance arc Phase 1, 2026-06-22; science
    // CORRECTED 2026-06-23 — specimen-debt pass). When the scenario opted in
    // (wall.directional_steps → crystal._faceStep) the macrostep relief is one-sided.
    // The six {104} faces are symmetry-equivalent, so the lopsidedness is TRANSPORT-
    // driven, not a face property: under diffusion-limited growth the better-fed faces
    // step-bunch while sheltered faces stay smooth (Berg 1938; Wang/Gilbert 2022 Science
    // 376:abm1748). The obtuse(~102°)/acute(~78°) step anisotropy is a finer within-face
    // effect (intrasectoral zoning), not the cause of the whole-face asymmetry. Calcite
    // is centrosymmetric, so none of this is polarity.
    if (c._faceStep && steppedShare > 0.1) {
      parts.push(narrative_variant('calcite', 'directional_stepped'));
    }
  }
  if (c.twinned) {
    parts.push(narrative_variant('calcite', 'twinned', { twin_law: c.twin_law }));
  }
  // MECHANICAL e-TWIN lamellae — post-growth crystal-plastic overprint (deformation arc
  // §5.3). Tectonic strain glided the finished crystal on its e-twin plane {01-12},
  // leaving the parallel mechanical-twin lamellae that gauge paleostress + temperature
  // (Ferrill 2004 Type I-IV; Burkhard 1993). A POST-growth overprint, not a growth habit.
  if (c._deformation && c._deformation.kind === 'etwin') {
    parts.push(narrative_variant('calcite', 'e_twinned'));
  }
  const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 2 ? 'small' : 'well-developed';
  parts.push(narrative_variant('calcite', 'final_size', { size_desc, mm: c.c_length_mm.toFixed(1), habit: c.habit }));
  return parts.filter(p => p).join(' ');
},

  _narrate_aragonite(c) {
  // Prose lives in narratives/aragonite.md.
  const parts = [`Aragonite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aragonite'));
  if (c.habit === 'acicular_needle') {
    parts.push(narrative_variant('aragonite', 'acicular_needle'));
  } else if (c.habit === 'twinned_cyclic') {
    parts.push(narrative_variant('aragonite', 'twinned_cyclic'));
  } else if (c.habit === 'flos_ferri') {
    // (2026-06-10 review §2.4: flos ferri is PURE aragonite — named for the
    // Eisenerz siderite mines it grew in, not for any iron content.)
    parts.push(narrative_variant('aragonite', 'flos_ferri'));
  } else {
    parts.push(narrative_variant('aragonite', 'columnar_prisms'));
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('polymorphic conversion')) {
      parts.push(narrative_variant('aragonite', 'polymorphic_conversion'));
    } else {
      parts.push(narrative_variant('aragonite', 'acid_dissolution'));
    }
  } else {
    parts.push(narrative_variant('aragonite', 'preserved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_dolomite(c) {
  // Prose lives in narratives/dolomite.md. Code keeps the
  // cycle_count → f_ord computation and threshold dispatch (Kim 2023
  // ordering tiers); markdown owns the words.
  const parts = [`Dolomite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  const cycle_count = this.conditions._dol_cycle_count;
  const f_ord = cycle_count > 0 ? 1.0 - Math.exp(-cycle_count / 7.0) : 0.0;
  parts.push(narrative_blurb('dolomite'));
  if (cycle_count > 0) {
    const ctx = { cycle_count, f_ord: f_ord.toFixed(2) };
    if (f_ord > 0.7) {
      parts.push(narrative_variant('dolomite', 'kim_ordered', ctx));
    } else if (f_ord > 0.3) {
      parts.push(narrative_variant('dolomite', 'kim_partial', ctx));
    } else {
      parts.push(narrative_variant('dolomite', 'kim_disordered', ctx));
    }
  } else {
    parts.push(narrative_variant('dolomite', 'no_cycling'));
  }
  if (c.habit === 'saddle_rhomb') {
    parts.push(narrative_variant('dolomite', 'saddle_rhomb'));
  } else if (c.habit === 'coarse_rhomb') {
    parts.push(narrative_variant('dolomite', 'coarse_rhomb'));
  } else {
    parts.push(narrative_variant('dolomite', 'massive_granular'));
  }
  if (c.position && c.position.includes('calcite')) {
    parts.push(narrative_variant('dolomite', 'on_calcite'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('dolomite', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_siderite(c) {
  // Prose lives in narratives/siderite.md.
  const parts = [`Siderite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('siderite'));
  if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('siderite', 'rhombohedral'));
  } else if (c.habit === 'scalenohedral') {
    parts.push(narrative_variant('siderite', 'scalenohedral'));
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('siderite', 'botryoidal'));
  } else {
    parts.push(narrative_variant('siderite', 'spherulitic_concretion'));
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('oxidative breakdown')) {
      parts.push(narrative_variant('siderite', 'oxidative_breakdown'));
    } else {
      parts.push(narrative_variant('siderite', 'acid_dissolution'));
    }
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_rhodochrosite(c) {
  // Prose lives in narratives/rhodochrosite.md.
  const parts = [`Rhodochrosite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('rhodochrosite'));
  if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('rhodochrosite', 'rhombohedral'));
  } else if (c.habit === 'scalenohedral') {
    parts.push(narrative_variant('rhodochrosite', 'scalenohedral'));
  } else if (c.habit === 'stalactitic') {
    parts.push(narrative_variant('rhodochrosite', 'stalactitic'));
  } else {
    parts.push(narrative_variant('rhodochrosite', 'rhythmic_banding'));
  }
  if (c.position && (c.position.includes('sphalerite') || c.position.includes('pyrite') || c.position.includes('galena'))) {
    parts.push(narrative_variant('rhodochrosite', 'on_sulfide', { position: c.position }));
  }
  if (c.dissolved) {
    const note = c.zones.length ? c.zones[c.zones.length - 1].note : '';
    if (note && note.includes('oxidative breakdown')) {
      parts.push(narrative_variant('rhodochrosite', 'oxidative_breakdown'));
    } else {
      parts.push(narrative_variant('rhodochrosite', 'acid_dissolution'));
    }
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_malachite(c) {
  // Prose lives in narratives/malachite.md.
  const parts = [`Malachite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.position.includes('chalcopyrite')) {
    parts.push(narrative_variant('malachite', 'on_chalcopyrite'));
  }
  if (c.habit === 'banded') {
    parts.push(narrative_variant('malachite', 'banded'));
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('malachite', 'botryoidal'));
  } else if (c.habit === 'fibrous/acicular') {
    parts.push(narrative_variant('malachite', 'fibrous_acicular'));
  }
  if (c.dissolved) parts.push(narrative_variant('malachite', 'acid_dissolution'));
  const color = c.predict_color ? c.predict_color() : '';
  if (color) parts.push(narrative_variant('malachite', 'color', { color }));
  return parts.filter(p => p).join(' ');
},

  _narrate_smithsonite(c) {
  // Prose lives in narratives/smithsonite.md.
  const parts = [`Smithsonite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('smithsonite'));
  if (c.position.includes('sphalerite')) {
    const oxidized = c.position.includes('oxidized');
    if (oxidized) {
      parts.push(narrative_variant('smithsonite', 'on_sphalerite_oxidized'));
    } else {
      parts.push(narrative_variant('smithsonite', 'on_sphalerite_fresh'));
    }
  }
  if (c.habit === 'botryoidal' || c.habit === 'botryoidal/stalactitic') {
    parts.push(narrative_variant('smithsonite', 'botryoidal'));
  } else if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('smithsonite', 'rhombohedral'));
  }
  const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
  if (lastZone && lastZone.note) {
    if (lastZone.note.includes('apple-green')) parts.push(narrative_variant('smithsonite', 'color_apple_green'));
    else if (lastZone.note.includes('pink')) parts.push(narrative_variant('smithsonite', 'color_pink'));
    else if (lastZone.note.includes('blue-green')) parts.push(narrative_variant('smithsonite', 'color_blue_green'));
  }
  if (c.dissolved) parts.push(narrative_variant('smithsonite', 'acid_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_cerussite(c) {
  // Prose lives in narratives/cerussite.md.
  const parts = [`Cerussite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cerussite'));
  if (c.twinned && (c.twin_law || '').includes('sixling')) {
    parts.push(narrative_variant('cerussite', 'sixling_twin'));
  }
  if ((c.position || '').includes('galena')) {
    parts.push(narrative_variant('cerussite', 'on_galena'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('cerussite', 'acid_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_azurite(c) {
  // Prose lives in narratives/azurite.md. Code dispatches on habit and the
  // paramorph-conversion zone-note signal; Markdown is canonical.
  const parts = [`Azurite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('azurite'));
  if (c.habit === 'azurite_sun') {
    parts.push(narrative_variant('azurite', 'azurite_sun'));
  } else if (c.habit === 'rosette_bladed') {
    parts.push(narrative_variant('azurite', 'rosette_bladed'));
  } else {
    parts.push(narrative_variant('azurite', 'monoclinic_prismatic'));
  }
  const has_conversion = c.zones.some(z => (z.note || '').includes('→ malachite'));
  if (has_conversion) {
    parts.push(narrative_variant('azurite', 'malachite_conversion'));
  }
  if (c.dissolved && !has_conversion) {
    parts.push(narrative_variant('azurite', 'dissolved'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_rosasite(c) {
  // Prose lives in narratives/rosasite.md (mirror of aurichalcite).
  const parts = [`Rosasite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('rosasite'));
  if (c.habit === 'acicular_radiating') {
    parts.push(narrative_variant('rosasite', 'acicular_radiating'));
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('rosasite', 'botryoidal'));
  } else {
    parts.push(narrative_variant('rosasite', 'encrusting_mammillary'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_aurichalcite(c) {
  // Prose lives in narratives/aurichalcite.md. Code dispatches on
  // habit; markdown owns the words.
  const parts = [`Aurichalcite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('aurichalcite'));
  if (c.habit === 'tufted_spray') {
    parts.push(narrative_variant('aurichalcite', 'tufted_spray'));
  } else if (c.habit === 'radiating_columnar') {
    parts.push(narrative_variant('aurichalcite', 'radiating_columnar'));
  } else {
    parts.push(narrative_variant('aurichalcite', 'laminar_crust'));
  }
  return parts.filter(p => p).join(' ');
},

  // v64 brief-19 narrators.
  _narrate_strontianite(c) {
    const parts = [`Strontianite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('SrCO₃ — orthorhombic, aragonite-group; almost always cyclic-twinned into pseudohexagonal forms (every crystal a palindrome). Type locality Strontian, Scotland (1790) — the namesake of the element strontium itself. Loses to celestine when sulfate dominates, which is most of the time globally.');
    if (c.habit === 'acicular_fibrous') parts.push('Radiating fibrous spray — the Münsterland aesthetic from low-T high-σ growth.');
    if (c.dissolved) parts.push('Acid dissolution — SrCO₃ + 2H⁺ → Sr²⁺ + H₂O + CO₂.');
    return parts.join(' ');
  },

  _narrate_witherite(c) {
    const parts = [`Witherite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('BaCO₃ — orthorhombic Ba carbonate; almost always cyclic-twinned into pseudohexagonal pyramids (the Settlingstones aesthetic). Loses to barite when sulfate dominates. Strongly UV-fluorescent bluish-white and persistently phosphorescent — keeps glowing after the lamp goes dark, as if the lattice does not quite trust the dark.');
    if (c.habit === 'botryoidal_white') parts.push('Botryoidal white balls — the Settlingstones type-specimen aesthetic.');
    if (c.position && c.position.includes('fluorite')) parts.push('Grew on fluorite — Cave-in-Rock-style witherite + fluorite + barite + galena assemblage.');
    if (c.dissolved) parts.push('Acid dissolution — BaCO₃ + 2H⁺ → Ba²⁺ + H₂O + CO₂.');
    return parts.join(' ');
  },
});
