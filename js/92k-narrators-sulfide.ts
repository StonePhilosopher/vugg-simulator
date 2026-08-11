// ============================================================
// js/92k-narrators-sulfide.ts — VugSimulator._narrate_<mineral> (sulfide)
// ============================================================
// Per-mineral narrators for sulfide-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (20): acanthite, argentite, arsenopyrite, bismuthinite, bornite, chalcocite, chalcopyrite, cobaltite, covellite, galena, marcasite, millerite, molybdenite, nickeline, pyrite, sphalerite, stibnite, tennantite, tetrahedrite, wurtzite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_sphalerite(c) {
  // Prose lives in narratives/sphalerite.md. Code keeps the
  // Fe-zoning analysis (early/late thirds, ratio threshold) and
  // picks the matching named variant.
  const parts = [`Sphalerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.zones.length) {
    const fe_vals = c.zones.filter(z => z.trace_Fe > 0).map(z => z.trace_Fe);
    if (fe_vals.length) {
      const max_fe = Math.max(...fe_vals), min_fe = Math.min(...fe_vals);
      if (max_fe > min_fe * 1.5) {
        const third = Math.max(Math.floor(c.zones.length / 3), 1);
        const early_fe = c.zones.slice(0, third).reduce((s, z) => s + z.trace_Fe, 0) / third;
        const late_fe = c.zones.slice(-third).reduce((s, z) => s + z.trace_Fe, 0) / third;
        if (early_fe < late_fe) {
          parts.push(narrative_variant('sphalerite', 'fe_zoning_increasing'));
        } else {
          parts.push(narrative_variant('sphalerite', 'fe_zoning_decreasing'));
        }
      }
    }
  }
  if (c.twinned) {
    parts.push(narrative_variant('sphalerite', 'twinned', { twin_law: c.twin_law }));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_wurtzite(c) {
  // Prose lives in narratives/wurtzite.md.
  const parts = [`Wurtzite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'hemimorphic_crystal') parts.push(narrative_variant('wurtzite', 'hemimorphic_crystal'));
  else if (c.habit === 'radiating_columnar') parts.push(narrative_variant('wurtzite', 'radiating_columnar'));
  else if (c.habit === 'fibrous_coating') parts.push(narrative_variant('wurtzite', 'fibrous_coating'));
  else parts.push(narrative_variant('wurtzite', 'tabular_default'));
  if (c.zones && c.zones.length) {
    const fe_vals = c.zones.filter(z => z.trace_Fe > 0).map(z => z.trace_Fe);
    if (fe_vals.length) {
      const max_fe_pct = Math.max(...fe_vals) / 10.0;
      if (max_fe_pct > 10) {
        parts.push(narrative_variant('wurtzite', 'fe_content', { fe_pct: max_fe_pct.toFixed(0) }));
      }
    }
  }
  if (c.twinned) parts.push(narrative_variant('wurtzite', 'twinned', { twin_law: c.twin_law }));
  if (c.dissolved) parts.push(narrative_variant('wurtzite', 'polymorphic_inversion'));
  // (2026-06-10 review §2.4: the old fallback called 95°C "the" boundary —
  // the equilibrium inversion is ~1020°C; low-T wurtzite is metastable,
  // held by S-deficiency/low pH. 95°C stays as a sim GATE, not a fact.)
  else parts.push(narrative_variant('wurtzite', 'kept_hexagonal'));
  return parts.filter(p => p).join(' ');
},

  _narrate_pyrite(c) {
  // Prose lives in narratives/pyrite.md.
  const parts = [`Pyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'framboidal') {
    parts.push(narrative_variant('pyrite', 'framboidal'));
  } else if (String(c.habit || '').startsWith('striated_')) {
    // Morphology-generalization arc (2026-06-12): the striated_ overlay
    // habits had NO narrator branch — striated_cubic fell into the
    // generic cubic prose via the includes('cubic') check below, and the
    // pyritohedral overlays fell through silently. The striations are
    // the regime story (bunched growth steps), so they get their own
    // sentence carrying the parent form.
    const parent = c.habit === 'striated_cubic' ? 'cube'
      : c.habit === 'striated_pyritohedral' ? 'pyritohedron'
      : 'cubo-pyritohedral crystal';
    parts.push(narrative_variant('pyrite', 'striated', { parent }));
  } else if (c.habit === 'pyritohedral') {
    // (2026-06-10 review §2.4: {210} is fully crystallographic, class m3̄ —
    // pseudo-fivefold is what the old text meant by "non-crystallographic".)
    parts.push(narrative_variant('pyrite', 'pyritohedral'));
  } else if (c.habit.includes('cubic')) {
    parts.push(narrative_variant('pyrite', 'cubic'));
  }
  if (c.twinned) {
    parts.push(narrative_variant('pyrite', 'twinned', { twin_law: c.twin_law }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('pyrite', 'acid_oxidation'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_marcasite(c) {
  // Prose lives in narratives/marcasite.md.
  const parts = [`Marcasite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'cockscomb') {
    parts.push(narrative_variant('marcasite', 'cockscomb'));
  } else if (c.habit === 'spearhead') {
    parts.push(narrative_variant('marcasite', 'spearhead'));
  } else if (c.habit === 'radiating_blade') {
    parts.push(narrative_variant('marcasite', 'radiating_blade'));
  } else {
    parts.push(narrative_variant('marcasite', 'tabular_plates'));
  }
  if (c.twinned) {
    parts.push(narrative_variant('marcasite', 'twinned', { twin_law: c.twin_law }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('marcasite', 'dissolved_inversion'));
  } else {
    parts.push(narrative_variant('marcasite', 'kept_orthorhombic'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcopyrite(c) {
  // Prose lives in narratives/chalcopyrite.md — code keeps the
  // conditional dispatch (which variants apply); markdown owns the words.
  const parts = [`Chalcopyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('chalcopyrite'));
  if (c.twinned) {
    parts.push(narrative_variant('chalcopyrite', 'twinned', { twin_law: c.twin_law }));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('chalcopyrite', 'dissolved', {}));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_bornite(c) {
  // Prose lives in narratives/bornite.md.
  const parts = [`Bornite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('bornite'));
  if ((c.habit || '').includes('pseudo_cubic')) {
    parts.push(narrative_variant('bornite', 'pseudo_cubic'));
  } else if ((c.habit || '').includes('peacock')) {
    parts.push(narrative_variant('bornite', 'peacock'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('bornite', 'oxidative_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcocite(c) {
  // Prose lives in narratives/chalcocite.md.
  const parts = [`Chalcocite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('chalcocite'));
  if (c.twinned && (c.twin_law || '').includes('sixling')) {
    parts.push(narrative_variant('chalcocite', 'sixling_twin'));
  }
  if ((c.habit || '').includes('pseudomorph')) {
    parts.push(narrative_variant('chalcocite', 'pseudomorph'));
  }
  if ((c.habit || '').includes('sooty')) {
    parts.push(narrative_variant('chalcocite', 'sooty'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_covellite(c) {
  // Prose lives in narratives/covellite.md.
  const parts = [`Covellite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('covellite'));
  if ((c.habit || '').includes('iridescent')) {
    parts.push(narrative_variant('covellite', 'iridescent'));
  } else if ((c.habit || '').includes('rosette')) {
    parts.push(narrative_variant('covellite', 'rosette'));
  }
  parts.push(narrative_variant('covellite', 'stoichiometry'));
  if (c.dissolved) parts.push(narrative_variant('covellite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_arsenopyrite(c) {
  // Prose lives in narratives/arsenopyrite.md.
  const parts = [`Arsenopyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('arsenopyrite'));
  const trappedAu = (typeof remainingBookedInventory === 'function')
    ? remainingBookedInventory(c, 'Au')
    : 0;
  if (trappedAu > 0.000001) parts.push(narrative_variant('arsenopyrite', 'invisible_gold', { trapped_au: trappedAu.toFixed(6) }));
  if (c.habit === 'striated_prism') parts.push(narrative_variant('arsenopyrite', 'striated_prism'));
  else if (c.habit === 'rhombic_blade') parts.push(narrative_variant('arsenopyrite', 'rhombic_blade'));
  else if (c.habit === 'acicular') parts.push(narrative_variant('arsenopyrite', 'acicular'));
  else parts.push(narrative_variant('arsenopyrite', 'massive_default'));
  if (c.dissolved) parts.push(narrative_variant('arsenopyrite', 'oxidation_front'));
  return parts.filter(p => p).join(' ');
},

  _narrate_stibnite(c) {
  // Prose lives in narratives/stibnite.md.
  const parts = [`Stibnite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('stibnite'));
  if (c.habit === 'elongated_prism_blade') parts.push(narrative_variant('stibnite', 'elongated_prism_blade'));
  else if (c.habit === 'radiating_spray') parts.push(narrative_variant('stibnite', 'radiating_spray'));
  else parts.push(narrative_variant('stibnite', 'massive_default'));
  return parts.filter(p => p).join(' ');
},

  _narrate_bismuthinite(c) {
  // Prose lives in narratives/bismuthinite.md.
  const parts = [`Bismuthinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('bismuthinite'));
  if ((c.habit || '').includes('stout')) parts.push(narrative_variant('bismuthinite', 'stout'));
  else if ((c.habit || '').includes('radiating')) parts.push(narrative_variant('bismuthinite', 'radiating'));
  else parts.push(narrative_variant('bismuthinite', 'acicular_default'));
  return parts.filter(p => p).join(' ');
},

  _narrate_acanthite(c) {
  // Prose lives in narratives/acanthite.md.
  const parts = [`Acanthite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('acanthite'));
  if (c.paramorph_origin === 'argentite') {
    const stepPhrase = c.paramorph_step ? ` at step ${c.paramorph_step}` : '';
    const habitPretty = (c.habit || '').replace('_', ' ');
    parts.push(narrative_variant('acanthite', 'paramorph', { step_phrase: stepPhrase, habit_pretty: habitPretty }));
    return parts.filter(p => p).join(' ');
  }
  if (c.habit === 'thorn') parts.push(narrative_variant('acanthite', 'thorn'));
  else if (c.habit === 'prismatic') parts.push(narrative_variant('acanthite', 'prismatic'));
  else parts.push(narrative_variant('acanthite', 'massive_default'));
  if (c.dissolved) parts.push(narrative_variant('acanthite', 'oxidative_dissolution'));
  else if (c.zones && c.zones.length > 15) parts.push(narrative_variant('acanthite', 'tarnish'));
  return parts.filter(p => p).join(' ');
},

  _narrate_nickeline(c) {
  // Prose lives in narratives/nickeline.md.
  const parts = [`Nickeline #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('nickeline'));
  if (c.habit === 'reniform') parts.push(narrative_variant('nickeline', 'reniform'));
  else if (c.habit === 'columnar') parts.push(narrative_variant('nickeline', 'columnar'));
  else parts.push(narrative_variant('nickeline', 'massive_default'));
  if (c.dissolved) parts.push(narrative_variant('nickeline', 'oxidative_dissolution'));
  else if (c.zones && c.zones.length > 12) parts.push(narrative_variant('nickeline', 'tarnish'));
  return parts.filter(p => p).join(' ');
},

  _narrate_millerite(c) {
  // Prose lives in narratives/millerite.md.
  const parts = [`Millerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('millerite'));
  if (c.habit === 'capillary') parts.push(narrative_variant('millerite', 'capillary'));
  else if (c.habit === 'acicular') parts.push(narrative_variant('millerite', 'acicular'));
  else parts.push(narrative_variant('millerite', 'massive_default'));
  if (c.dissolved) parts.push(narrative_variant('millerite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_cobaltite(c) {
  // Prose lives in narratives/cobaltite.md. Glaucodot-series dispatch uses
  // the trace-Fe average threshold.
  const parts = [`Cobaltite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cobaltite'));
  if (c.habit === 'pyritohedral') parts.push(narrative_variant('cobaltite', 'pyritohedral'));
  else if (c.habit === 'reniform') parts.push(narrative_variant('cobaltite', 'reniform'));
  else parts.push(narrative_variant('cobaltite', 'massive_default'));
  const avgFe = c.zones.reduce((s, z) => s + (z.trace_Fe || 0), 0) / Math.max(c.zones.length, 1);
  if (avgFe > 0.3) parts.push(narrative_variant('cobaltite', 'glaucodot_series'));
  if (c.dissolved) parts.push(narrative_variant('cobaltite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_argentite(c) {
  // Prose lives in narratives/argentite.md.
  const parts = [`Argentite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('argentite'));
  if (c.habit === 'cubic') parts.push(narrative_variant('argentite', 'cubic'));
  else if (c.habit === 'octahedral') parts.push(narrative_variant('argentite', 'octahedral'));
  else if (c.habit === 'arborescent') parts.push(narrative_variant('argentite', 'arborescent'));
  if (c.twinned && (c.twin_law || '').includes('spinel')) {
    parts.push(narrative_variant('argentite', 'spinel_twin'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tetrahedrite(c) {
  // Prose lives in narratives/tetrahedrite.md.
  const parts = [`Tetrahedrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tetrahedrite'));
  if (c.habit === 'tetrahedral') parts.push(narrative_variant('tetrahedrite', 'tetrahedral'));
  else if (c.habit === 'crustiform') parts.push(narrative_variant('tetrahedrite', 'crustiform'));
  else if (c.habit === 'druzy_coating') parts.push(narrative_variant('tetrahedrite', 'druzy_coating'));
  else parts.push(narrative_variant('tetrahedrite', 'massive_default'));
  if (c.position && c.position.includes('chalcopyrite')) parts.push(narrative_variant('tetrahedrite', 'on_chalcopyrite'));
  if (c.dissolved) parts.push(narrative_variant('tetrahedrite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_tennantite(c) {
  // Prose lives in narratives/tennantite.md.
  const parts = [`Tennantite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tennantite'));
  if (c.habit === 'tetrahedral') parts.push(narrative_variant('tennantite', 'tetrahedral'));
  else if (c.habit === 'crustiform') parts.push(narrative_variant('tennantite', 'crustiform'));
  else if (c.habit === 'druzy_coating') parts.push(narrative_variant('tennantite', 'druzy_coating'));
  else parts.push(narrative_variant('tennantite', 'massive_default'));
  if (c.position && c.position.includes('tetrahedrite')) parts.push(narrative_variant('tennantite', 'alongside_tetrahedrite'));
  if (c.dissolved) parts.push(narrative_variant('tennantite', 'oxidative_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_galena(c) {
  // Prose lives in narratives/galena.md.
  const parts = [`Galena #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('galena'));
  if (c.twinned) {
    parts.push(narrative_variant('galena', 'spinel_twin', { twin_law: c.twin_law }));
  }
  const hasAg = c.zones.some(z => (z.note || '').includes('Ag'));
  if (hasAg) {
    parts.push(narrative_variant('galena', 'argentiferous'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('galena', 'oxidative_breakdown'));
  }
  // ETCHED — post-growth dissolution overprint (crystal-face realism arc §2). When a
  // reactivated vein reopens, the returning undersaturated fluid corrodes the early galena
  // cubes — edges + corners round, the metallic faces frost — before the next generation.
  if (c._etch) {
    parts.push(narrative_variant('galena', 'etched'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_molybdenite(c) {
  // Prose lives in narratives/molybdenite.md.
  const parts = [`Molybdenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('molybdenite'));
  if (c.nucleation_temp >= 300 && c.nucleation_temp <= 500) {
    parts.push(narrative_variant('molybdenite', 'porphyry_sweet_spot'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('molybdenite', 'oxidative_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  // v64 brief-19 narrators — telluride / selenide / Cd-sulfide group.

  _narrate_calaverite(c) {
    const parts = [`Calaverite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('AuTe₂ — the gold telluride that broke crystallography. For decades its faces refused to index because of an incommensurate modulation wave through the tellurium positions, driven by gold fluctuating between Au⁺ and Au³⁺. The crystal is arguing with itself about what charge gold should be. Cripple Creek was built on this mineral.');
    if (c.habit === 'bladed_striated_prism') parts.push('Bladed striated prism — the diagnostic high-T habit, brass-yellow with adamantine luster.');
    if (c.dissolved) parts.push('Thermal decomposition — AuTe₂ → Au⁰ + Te vapor at ~450°C. Native gold liberates wherever calaverite breaks down.');
    return parts.join(' ');
  },

  _narrate_sylvanite(c) {
    const parts = [`Sylvanite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('(Au,Ag)Te₂ — the most common gold telluride, and the one that cannot sit in the sun. Photosensitive: prolonged light exposure tarnishes the surface from silver-white to sullen black. Au:Ag varies 1:1 to 3:1 — it cannot decide if it is a gold mineral or a silver mineral. Type locality Sacarîmb / Nagyág (Transylvania); also Cripple Creek, Kalgoorlie.');
    if (c.habit === 'bladed_graphic') parts.push('Graphic-tellurium habit — intergrown bladed crystals like cuneiform scratched into the rock.');
    if (c.dissolved) parts.push('Thermal decomposition above 400°C — sylvanite → Au + Ag-telluride species.');
    return parts.join(' ');
  },

  _narrate_hessite(c) {
    const parts = [`Hessite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Ag₂Te — silver telluride. Wins over acanthite (Ag₂S) only when local Te exceeds S. Phase transition at 155°C (cubic ↔ monoclinic) — the cooling history is written into the lattice as transformation lamellae, a game-readable thermometer.');
    if (c.habit === 'cubic_high_T') parts.push('Cubic high-T phase — formed and stayed above 155°C.');
    else if (c.habit === 'monoclinic_low_T_lamellae') parts.push('Monoclinic low-T phase with phase-transformation lamellae from the cubic-to-monoclinic transition during cooling.');
    if (c.dissolved) parts.push('Oxidative dissolution — Ag leaches, Te oxidizes to tellurite.');
    return parts.join(' ');
  },

  _narrate_naumannite(c) {
    const parts = [`Naumannite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Ag₂Se — silver selenide, sister to hessite (Ag₂Te). Forms in selenium-enriched epithermal veins where S is suppressed; rare globally because S almost always wins. Phase transition at 133°C (orthorhombic ↔ cubic) — the high-T cubic form has unusual ionic conductivity (~2 S/cm).');
    if (c.position && c.position.includes('clausthalite')) parts.push('Co-precipitated with clausthalite — the diagnostic Erzgebirge low-S selenide assemblage.');
    if (c.dissolved) parts.push('Oxidative dissolution — Ag leaches, Se oxidizes to selenite.');
    return parts.join(' ');
  },

  _narrate_clausthalite(c) {
    const parts = [`Clausthalite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('PbSe — selenide analog of galena. Type locality Clausthal-Zellerfeld in the Harz Mountains (1832). Above 300°C forms continuous solid solution with galena; below, the miscibility gap opens and the two phases unmix into lamellae on cooling — high-T solid solutions become diagnostic textures.');
    if (c.habit === 'exsolution_lamellae_in_galena') parts.push('Lamellar exsolution from PbS-PbSe solid solution — recorded the cooling event below 300°C.');
    if (c.dissolved) parts.push('Oxidative dissolution — Pb²⁺ leaches, Se oxidizes to selenite.');
    return parts.join(' ');
  },

  _narrate_greenockite(c) {
    const parts = [`Greenockite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('CdS — hexagonal cadmium sulfide. The "cadmium yellow" pigment, mineral form. A whisper of cadmium hiding inside sphalerite gets liberated by oxidation, then slams shut against residual sulfide as CdS — Ksp ~10⁻²⁸, so even trace Cd precipitates readily. Found in a Scottish railway tunnel in 1840.');
    if (c.position && c.position.includes('sphalerite')) parts.push('Grew on sphalerite — direct supergene successor (sphalerite carries Cd substituting for Zn up to ~1%).');
    if (c.habit === 'hexagonal_pyramidal') parts.push('Hemimorphic hexagonal pyramid — different terminations top and bottom, as if the crystal could not decide which way was up.');
    else if (c.habit === 'powdery_coating') parts.push('Bright yellow earthy coating — the typical sub-mm habit.');
    if (c.dissolved) parts.push('Oxidation — CdS → Cd²⁺ + SO₄²⁻ (toxic). Otavite (CdCO₃) may follow if carbonate is available.');
    return parts.join(' ');
  },

  _narrate_hawleyite(c) {
    const parts = [`Hawleyite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('CdS — cubic cadmium sulfide, greenockite\'s shadow. Same chemistry, different lattice. Hawleyite settles for powdery yellow anonymity at low T because the cubic structure is what cold meteoric water favors. You will never see a hawleyite crystal — nobody has. It exists as a bright yellow dust on sphalerite, named for a Queens University mineralogist in 1955.');
    if (c.dissolved) parts.push('Oxidation — CdS → Cd²⁺ + SO₄²⁻.');
    return parts.join(' ');
  },
});
