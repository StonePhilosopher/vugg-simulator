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
  // picks the matching named variant. Inline fallbacks preserve
  // offline/file:// boot.
  const parts = [`Sphalerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.zones.length) {
    const fe_vals = c.zones.filter(z => z.trace_Fe > 0).map(z => z.trace_Fe);
    if (fe_vals.length) {
      const max_fe = Math.max(...fe_vals), min_fe = Math.min(...fe_vals);
      if (max_fe > min_fe * 1.5) {
        const third = Math.max(Math.floor(c.zones.length / 3), 1);
        const early_fe = c.zones.slice(0, third).reduce((s, z) => s + z.trace_Fe, 0) / third;
        const late_fe = c.zones.slice(-third).reduce((s, z) => s + z.trace_Fe, 0) / third;
        const variant = (early_fe < late_fe) ? 'fe_zoning_increasing' : 'fe_zoning_decreasing';
        const fallback = (early_fe < late_fe)
          ? `Iron content increased through growth — early zones are pale (low Fe, cleiophane variety) grading to darker amber or brown as the fluid became more iron-rich. This color zoning would be visible in a polished cross-section.`
          : `Iron content decreased through growth — the crystal darkened early (higher Fe, approaching marmatite) then cleared as iron was depleted from the fluid.`;
        parts.push(narrative_variant('sphalerite', variant) || fallback);
      }
    }
  }
  if (c.twinned) {
    const v = narrative_variant('sphalerite', 'twinned', { twin_law: c.twin_law });
    parts.push(v || `Twinned on the ${c.twin_law} — a common growth twin in sphalerite that creates triangular re-entrant faces.`);
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_wurtzite(c) {
  // Prose lives in narratives/wurtzite.md.
  const parts = [`Wurtzite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'hemimorphic_crystal') parts.push(narrative_variant('wurtzite', 'hemimorphic_crystal') || 'Hemimorphic hexagonal pyramid.');
  else if (c.habit === 'radiating_columnar') parts.push(narrative_variant('wurtzite', 'radiating_columnar') || 'Radiating hexagonal columns.');
  else if (c.habit === 'fibrous_coating') parts.push(narrative_variant('wurtzite', 'fibrous_coating') || "Fibrous crust on the wall.");
  else parts.push(narrative_variant('wurtzite', 'tabular_default') || 'Tabular {0001} plates.');
  if (c.zones && c.zones.length) {
    const fe_vals = c.zones.filter(z => z.trace_Fe > 0).map(z => z.trace_Fe);
    if (fe_vals.length) {
      const max_fe_pct = Math.max(...fe_vals) / 10.0;
      if (max_fe_pct > 10) {
        parts.push(narrative_variant('wurtzite', 'fe_content', { fe_pct: max_fe_pct.toFixed(0) }) || `Fe content up to ${max_fe_pct.toFixed(0)} mol%.`);
      }
    }
  }
  if (c.twinned) parts.push(narrative_variant('wurtzite', 'twinned', { twin_law: c.twin_law }) || `Shows the ${c.twin_law} twin.`);
  if (c.dissolved) parts.push(narrative_variant('wurtzite', 'polymorphic_inversion') || 'Polymorphic inversion destroyed the crystal.');
  else parts.push(narrative_variant('wurtzite', 'kept_hexagonal') || 'Kept hexagonal as long as fluid stayed above 95°C.');
  return parts.filter(p => p).join(' ');
},

  _narrate_pyrite(c) {
  // Prose lives in narratives/pyrite.md.
  const parts = [`Pyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'framboidal') {
    parts.push(narrative_variant('pyrite', 'framboidal') || 'The low temperature produced framboidal pyrite — microscopic raspberry-shaped aggregates of tiny crystallites, a texture common in sedimentary environments.');
  } else if (c.habit === 'pyritohedral') {
    parts.push(narrative_variant('pyrite', 'pyritohedral') || 'The crystal developed the characteristic pyritohedral habit — twelve pentagonal faces, a form unique to pyrite and one of nature\'s few non-crystallographic symmetries.');
  } else if (c.habit.includes('cubic')) {
    parts.push(narrative_variant('pyrite', 'cubic') || 'Clean cubic habit with bright metallic luster. The striations on each cube face (perpendicular on adjacent faces) are the fingerprint of pyrite\'s lower symmetry disguised as cubic.');
  }
  if (c.twinned) {
    parts.push(narrative_variant('pyrite', 'twinned', { twin_law: c.twin_law }) || `Twinned as an ${c.twin_law} — two crystals interpenetrating at 90°, one of the most recognizable twin forms in mineralogy.`);
  }
  if (c.dissolved) {
    parts.push(narrative_variant('pyrite', 'acid_oxidation') || 'Late-stage oxidation attacked the pyrite — in nature this would produce a limonite/goethite boxwork pseudomorph, the rusty ghost of the original crystal.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_marcasite(c) {
  // Prose lives in narratives/marcasite.md.
  const parts = [`Marcasite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'cockscomb') {
    parts.push(narrative_variant('marcasite', 'cockscomb') || "The crystal developed the classic cockscomb habit — aggregated tabular plates on {010}, edges ridged like a rooster's comb. This shape is the diagnostic fingerprint: pyrite never crests like this.");
  } else if (c.habit === 'spearhead') {
    parts.push(narrative_variant('marcasite', 'spearhead') || 'Spearhead twins — paired tabular crystals tapered to pyramidal tips. The {101} twin law produces a swallowtail shape unique to marcasite.');
  } else if (c.habit === 'radiating_blade') {
    parts.push(narrative_variant('marcasite', 'radiating_blade') || 'Radiating blades sprayed outward from a common center — low-temperature, high-supersaturation growth in acid fluids, the same style that gives sedimentary marcasite nodules their stellate fracture patterns.');
  } else {
    parts.push(narrative_variant('marcasite', 'tabular_plates') || 'Flat tabular {010} plates — the slow-growth marcasite form, pale brass already starting to iridesce as surface sulfur oxidizes.');
  }
  if (c.twinned) {
    parts.push(narrative_variant('marcasite', 'twinned', { twin_law: c.twin_law }) || `Shows the ${c.twin_law} swallowtail twin, diagnostic of marcasite and absent from its cubic cousin pyrite.`);
  }
  if (c.dissolved) {
    parts.push(narrative_variant('marcasite', 'dissolved_inversion') || 'Metastable inversion or oxidative breakdown destroyed the crystal — marcasite is the unstable FeS₂ dimorph. Over geologic time it converts to pyrite; on museum shelves it rots to sulfuric acid and iron sulfate.');
  } else {
    parts.push(narrative_variant('marcasite', 'kept_orthorhombic') || 'The pH/T regime kept it in the orthorhombic field; given geologic time or a temperature excursion above 240°C, this crystal would invert to pyrite.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcopyrite(c) {
  // Prose lives in narratives/chalcopyrite.md — code keeps the
  // conditional dispatch (which variants apply); markdown owns the
  // words. Fallback strings preserve the inline content when the
  // markdown fetch hasn't completed (rare; mostly file:// boot).
  const parts = [`Chalcopyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  const blurb = narrative_blurb('chalcopyrite');
  parts.push(blurb || 'Brassy yellow with a greenish tint — distinguishable from pyrite by its deeper color and softer hardness (3.5 vs 6). The disphenoidal crystals often look tetrahedral, a common misidentification.');
  if (c.twinned) {
    const v = narrative_variant('chalcopyrite', 'twinned', { twin_law: c.twin_law });
    parts.push(v || `Shows ${c.twin_law} twinning — repeated twins create spinel-like star shapes.`);
  }
  if (c.dissolved) {
    const v = narrative_variant('chalcopyrite', 'dissolved', {});
    parts.push(v || 'Oxidation began converting the chalcopyrite — at the surface, this weathering produces malachite (green) and azurite (blue), the colorful signal that led ancient prospectors to copper deposits.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_bornite(c) {
  // Prose lives in narratives/bornite.md.
  const parts = [`Bornite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('bornite') || "Cu₅FeS₄ — bronze-colored fresh, famous for the iridescent 'peacock ore' tarnish from thin-film interference on surface oxidation products. The 228°C order-disorder transition is one of mineralogy\u2019s cleanest structural changes: above, Cu and Fe randomly occupy the cation sites (pseudo-cubic); below, they order into the orthorhombic arrangement.");
  if ((c.habit || '').includes('pseudo_cubic')) {
    parts.push(narrative_variant('bornite', 'pseudo_cubic') || 'Grew at T > 228°C — crystal has the disordered pseudo-cubic structure preserved. If cooled slowly, the Cu and Fe will gradually order into orthorhombic domains, sometimes visible under reflected light.');
  } else if ((c.habit || '').includes('peacock')) {
    parts.push(narrative_variant('bornite', 'peacock') || 'Peacock iridescent — thin-film interference on an oxidation crust. Fresh bornite bronze under the film. Strike it with a steel hammer and the fresh surface shows through; leave it in air for a week and the rainbow comes back.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('bornite', 'oxidative_dissolution') || 'Oxidative dissolution — Cu²⁺ and Fe³⁺ went back to the fluid, probably to find malachite/azurite (for Cu) or goethite (for Fe).');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_chalcocite(c) {
  // Prose lives in narratives/chalcocite.md.
  const parts = [`Chalcocite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('chalcocite') || 'Cu₂S — 79.8% Cu by weight, one of the richest copper ores ever mined. Forms in the supergene enrichment blanket, where descending Cu²⁺-rich meteoric fluids meet reducing conditions at the water table. This is where mineable copper ore gets made.');
  if (c.twinned && (c.twin_law || '').includes('sixling')) {
    parts.push(narrative_variant('chalcocite', 'sixling_twin') || 'Pseudo-hexagonal cyclic sixling twin — chalcocite\u2019s collector habit. Three orthorhombic individuals intergrown at ~60° approximate a hexagonal symmetry the mineral doesn\u2019t actually have. Butte, Cornwall, and Bristol Cliff produced sharp sixlings.');
  }
  if ((c.habit || '').includes('pseudomorph')) {
    parts.push(narrative_variant('chalcocite', 'pseudomorph') || "Pseudomorph — this chalcocite replaced a primary sulfide (chalcopyrite or bornite) atom-by-atom while preserving the host's external form. Copper diffused in, iron and excess sulfur diffused out, leaving a ghost outline in dark gray Cu₂S.");
  }
  if ((c.habit || '').includes('sooty')) {
    parts.push(narrative_variant('chalcocite', 'sooty') || 'Sooty microcrystalline texture — rapid precipitation at the oxidation/reduction interface. The aggregate looks like black soot smeared on the host rock.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_covellite(c) {
  // Prose lives in narratives/covellite.md.
  const parts = [`Covellite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('covellite') || 'CuS — indigo-blue, the only common naturally blue mineral (azurite aside). Named for Niccolo Covelli, who first described the Vesuvius fumarole specimens in 1833. Hexagonal, with perfect basal cleavage — the fresh plates peel like mica, and the cleavage surfaces flash purple-green iridescence from thin-film interference.');
  if ((c.habit || '').includes('iridescent')) {
    parts.push(narrative_variant('covellite', 'iridescent') || 'Iridescent coating — this covellite grew at the boundary between the oxidation and reduction zones. The fluid oscillated across the Eh boundary just enough to produce Cu²⁺ surface products on the forming crystal.');
  } else if ((c.habit || '').includes('rosette')) {
    parts.push(narrative_variant('covellite', 'rosette') || 'Radiating rosette — plates nucleating outward from a common center. High supersaturation triggered multiple nucleation sites on the substrate at once, and the crystals grew into each other until the void was paved blue.');
  }
  parts.push(narrative_variant('covellite', 'stoichiometry') || "S:Cu ratio = 1:1, twice that of chalcocite. Covellite forms where sulfur activity is high enough to push past chalcocite's stoichiometry — typically the transition layer between oxidized caprock and reduced primary sulfides below.");
  if (c.dissolved) parts.push(narrative_variant('covellite', 'oxidative_dissolution') || 'Oxidative dissolution — the Cu²⁺ will find malachite or azurite; the S oxidized to sulfate.');
  return parts.filter(p => p).join(' ');
},

  _narrate_arsenopyrite(c) {
  // Prose lives in narratives/arsenopyrite.md.
  const parts = [`Arsenopyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('arsenopyrite') || "FeAsS — the most common arsenic mineral and a primary mesothermal sulfide.");
  const trappedAu = (c.zones || []).reduce((s, z) => s + (z.trace_Au || 0), 0);
  if (trappedAu > 0.01) parts.push(narrative_variant('arsenopyrite', 'invisible_gold', { trapped_au: trappedAu.toFixed(3) }) || `Invisible gold — ${trappedAu.toFixed(3)} ppm Au trapped structurally in the arsenopyrite lattice.`);
  if (c.habit === 'striated_prism') parts.push(narrative_variant('arsenopyrite', 'striated_prism') || 'Striated prismatic — the display habit.');
  else if (c.habit === 'rhombic_blade') parts.push(narrative_variant('arsenopyrite', 'rhombic_blade') || 'Rhombic blade.');
  else if (c.habit === 'acicular') parts.push(narrative_variant('arsenopyrite', 'acicular') || 'Acicular.');
  else parts.push(narrative_variant('arsenopyrite', 'massive_default') || 'Massive granular.');
  if (c.dissolved) parts.push(narrative_variant('arsenopyrite', 'oxidation_front') || "Oxidation front — arsenopyrite + O₂ + H₂O → Fe³⁺ + AsO₄³⁻ + H₂SO₄.");
  return parts.filter(p => p).join(' ');
},

  _narrate_stibnite(c) {
  // Prose lives in narratives/stibnite.md.
  const parts = [`Stibnite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('stibnite') || 'Sb₂S₃ — orthorhombic antimony sulfide, same structure as bismuthinite.');
  if (c.habit === 'elongated_prism_blade') parts.push(narrative_variant('stibnite', 'elongated_prism_blade') || 'Elongated sword-blade.');
  else if (c.habit === 'radiating_spray') parts.push(narrative_variant('stibnite', 'radiating_spray') || 'Radiating spray.');
  else parts.push(narrative_variant('stibnite', 'massive_default') || 'Massive granular.');
  return parts.filter(p => p).join(' ');
},

  _narrate_bismuthinite(c) {
  // Prose lives in narratives/bismuthinite.md.
  const parts = [`Bismuthinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('bismuthinite') || 'Bi₂S₃ — orthorhombic bismuth sulfide, same structure as stibnite.');
  if ((c.habit || '').includes('stout')) parts.push(narrative_variant('bismuthinite', 'stout') || 'Stout prismatic.');
  else if ((c.habit || '').includes('radiating')) parts.push(narrative_variant('bismuthinite', 'radiating') || 'Radiating cluster of needles.');
  else parts.push(narrative_variant('bismuthinite', 'acicular_default') || 'Acicular needles.');
  return parts.filter(p => p).join(' ');
},

  _narrate_acanthite(c) {
  // Prose lives in narratives/acanthite.md.
  const parts = [`Acanthite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('acanthite') || 'Ag₂S — monoclinic silver sulfide, the most important silver ore on Earth.');
  if (c.paramorph_origin === 'argentite') {
    const stepPhrase = c.paramorph_step ? ` at step ${c.paramorph_step}` : '';
    const habitPretty = (c.habit || '').replace('_', ' ');
    parts.push(narrative_variant('acanthite', 'paramorph', { step_phrase: stepPhrase, habit_pretty: habitPretty }));
    return parts.filter(p => p).join(' ');
  }
  if (c.habit === 'thorn') parts.push(narrative_variant('acanthite', 'thorn') || "Thorn-habit.");
  else if (c.habit === 'prismatic') parts.push(narrative_variant('acanthite', 'prismatic') || 'Elongated prismatic.');
  else parts.push(narrative_variant('acanthite', 'massive_default') || 'Massive granular.');
  if (c.dissolved) parts.push(narrative_variant('acanthite', 'oxidative_dissolution') || 'Oxidative dissolution.');
  else if (c.zones && c.zones.length > 15) parts.push(narrative_variant('acanthite', 'tarnish') || 'Tarnish.');
  return parts.filter(p => p).join(' ');
},

  _narrate_nickeline(c) {
  // Prose lives in narratives/nickeline.md.
  const parts = [`Nickeline #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('nickeline') || "NiAs — hexagonal nickel arsenide.");
  if (c.habit === 'reniform') parts.push(narrative_variant('nickeline', 'reniform') || 'Reniform / botryoidal.');
  else if (c.habit === 'columnar') parts.push(narrative_variant('nickeline', 'columnar') || 'Columnar.');
  else parts.push(narrative_variant('nickeline', 'massive_default') || 'Massive granular.');
  if (c.dissolved) parts.push(narrative_variant('nickeline', 'oxidative_dissolution') || 'Oxidative dissolution.');
  else if (c.zones && c.zones.length > 12) parts.push(narrative_variant('nickeline', 'tarnish') || 'Tarnish.');
  return parts.filter(p => p).join(' ');
},

  _narrate_millerite(c) {
  // Prose lives in narratives/millerite.md.
  const parts = [`Millerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('millerite') || "NiS — trigonal nickel sulfide.");
  if (c.habit === 'capillary') parts.push(narrative_variant('millerite', 'capillary') || 'Capillary.');
  else if (c.habit === 'acicular') parts.push(narrative_variant('millerite', 'acicular') || 'Acicular.');
  else parts.push(narrative_variant('millerite', 'massive_default') || 'Massive granular.');
  if (c.dissolved) parts.push(narrative_variant('millerite', 'oxidative_dissolution') || 'Oxidative dissolution.');
  return parts.filter(p => p).join(' ');
},

  _narrate_cobaltite(c) {
  // Prose lives in narratives/cobaltite.md. JS gains glaucodot_series
  // dispatch (Python had it; trace_Fe avg threshold).
  const parts = [`Cobaltite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cobaltite') || "CoAsS — orthorhombic cobalt sulfarsenide.");
  if (c.habit === 'pyritohedral') parts.push(narrative_variant('cobaltite', 'pyritohedral') || 'Pyritohedral.');
  else if (c.habit === 'reniform') parts.push(narrative_variant('cobaltite', 'reniform') || 'Reniform.');
  else parts.push(narrative_variant('cobaltite', 'massive_default') || 'Massive granular.');
  const avgFe = c.zones.reduce((s, z) => s + (z.trace_Fe || 0), 0) / Math.max(c.zones.length, 1);
  if (avgFe > 0.3) parts.push(narrative_variant('cobaltite', 'glaucodot_series'));
  if (c.dissolved) parts.push(narrative_variant('cobaltite', 'oxidative_dissolution') || 'Oxidative dissolution.');
  return parts.filter(p => p).join(' ');
},

  _narrate_argentite(c) {
  // Prose lives in narratives/argentite.md.
  const parts = [`Argentite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('argentite') || "Ag₂S — body-centered cubic silver sulfide, the high-T polymorph stable only above 173°C.");
  if (c.habit === 'cubic') parts.push(narrative_variant('argentite', 'cubic') || 'Cubic — sharp {100} faces.');
  else if (c.habit === 'octahedral') parts.push(narrative_variant('argentite', 'octahedral') || 'Octahedral — {111} faces dominant.');
  else if (c.habit === 'arborescent') parts.push(narrative_variant('argentite', 'arborescent') || 'Arborescent — dendritic / wire-like aggregates.');
  if (c.twinned && (c.twin_law || '').includes('spinel')) {
    parts.push(narrative_variant('argentite', 'spinel_twin') || 'Spinel-law penetration twin.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tetrahedrite(c) {
  // Prose lives in narratives/tetrahedrite.md.
  const parts = [`Tetrahedrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tetrahedrite') || "Cu₁₂Sb₄S₁₃ — steel-gray metallic, the Sb-endmember of the fahlore solid-solution series.");
  if (c.habit === 'tetrahedral') parts.push(narrative_variant('tetrahedrite', 'tetrahedral') || 'Classic {111} tetrahedra — the namesake habit.');
  else if (c.habit === 'crustiform') parts.push(narrative_variant('tetrahedrite', 'crustiform') || 'Crustiform banding on the fracture wall.');
  else if (c.habit === 'druzy_coating') parts.push(narrative_variant('tetrahedrite', 'druzy_coating') || 'Fine-grained drusy surface.');
  else parts.push(narrative_variant('tetrahedrite', 'massive_default') || 'Massive granular aggregates.');
  if (c.position && c.position.includes('chalcopyrite')) parts.push(narrative_variant('tetrahedrite', 'on_chalcopyrite') || 'Growing on chalcopyrite.');
  if (c.dissolved) parts.push(narrative_variant('tetrahedrite', 'oxidative_dissolution') || 'Oxidative dissolution.');
  return parts.filter(p => p).join(' ');
},

  _narrate_tennantite(c) {
  // Prose lives in narratives/tennantite.md.
  const parts = [`Tennantite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('tennantite') || "Cu₁₂As₄S₁₃ — the As counterpart to tetrahedrite.");
  if (c.habit === 'tetrahedral') parts.push(narrative_variant('tennantite', 'tetrahedral') || 'Classic {111} tetrahedra.');
  else if (c.habit === 'crustiform') parts.push(narrative_variant('tennantite', 'crustiform') || 'Crustiform banded crust.');
  else if (c.habit === 'druzy_coating') parts.push(narrative_variant('tennantite', 'druzy_coating') || 'Fine-grained drusy surface.');
  else parts.push(narrative_variant('tennantite', 'massive_default') || 'Massive granular.');
  if (c.position && c.position.includes('tetrahedrite')) parts.push(narrative_variant('tennantite', 'alongside_tetrahedrite') || 'Growing alongside tetrahedrite.');
  if (c.dissolved) parts.push(narrative_variant('tennantite', 'oxidative_dissolution') || 'Oxidative dissolution.');
  return parts.filter(p => p).join(' ');
},

  _narrate_galena(c) {
  // Prose lives in narratives/galena.md.
  const parts = [`Galena #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('galena') || "PbS — the densest common sulfide (SG 7.6), perfect cubic cleavage, bright lead-gray metallic luster. Pick up a piece and it's surprisingly heavy; tap it and it cleaves into perfect little cubes.");
  if (c.twinned) {
    parts.push(narrative_variant('galena', 'spinel_twin', { twin_law: c.twin_law }) || `Twinned on the ${c.twin_law} — spinel-law twins create striking interpenetrating cubes in galena, rare but diagnostic.`);
  }
  const hasAg = c.zones.some(z => (z.note || '').includes('Ag'));
  if (hasAg) {
    parts.push(narrative_variant('galena', 'argentiferous') || "The fluid carried silver — argentiferous galena, the historic source of most of the world's silver (Potosí, Leadville, Broken Hill).");
  }
  if (c.dissolved) {
    parts.push(narrative_variant('galena', 'oxidative_breakdown') || 'Oxidation attacked the galena — Pb²⁺ went into solution and can reprecipitate as cerussite (PbCO₃), anglesite (PbSO₄), or — if Mo is present — wulfenite (PbMoO₄).');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_molybdenite(c) {
  // Prose lives in narratives/molybdenite.md.
  const parts = [`Molybdenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('molybdenite') || 'MoS₂ — soft hexagonal platy crystals, bluish-gray metallic, greasy to the touch. Softest metallic mineral on Mohs (1–1.5); leaves a mark on paper like graphite.');
  if (c.nucleation_temp >= 300 && c.nucleation_temp <= 500) {
    parts.push(narrative_variant('molybdenite', 'porphyry_sweet_spot') || 'Nucleated in the porphyry sweet spot — Mo arrived in a separate pulse from Cu (Seo et al. 2012, Bingham Canyon), a late magmatic fluid delivering molybdenum on its own timeline.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('molybdenite', 'oxidative_dissolution') || 'Oxidation dissolved the molybdenite, releasing MoO₄²⁻ into solution. If Pb is also present in the oxidation zone, the combination becomes wulfenite — the sunset mineral.');
  }
  return parts.filter(p => p).join(' ');
},
});
