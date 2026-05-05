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
  parts.push(narrative_blurb('native_copper') || 'Cu — elemental copper. Only forms when the fluid is strongly reducing AND low in sulfur. The Michigan Keweenaw peninsula basalt vesicles produced 500-ton masses — the Ontonagon boulder, now at the Smithsonian, is 1.7 tons. Copper-red fresh, tarnishes brown (cuprite surface film), eventually green (malachite patina).');
  if (c.habit === 'massive_sheet') {
    parts.push(narrative_variant('native_copper', 'massive_sheet') || 'Massive sheet copper — the Lake Superior basin signature. Rapid precipitation in open basalt vesicles produced sheets tens of centimeters thick. This is where industrial copper mining began in the Western hemisphere, ~5000 BC with the Old Copper Culture.');
  } else if (c.habit === 'arborescent_dendritic') {
    parts.push(narrative_variant('native_copper', 'arborescent_dendritic') || "Arborescent dendritic — tree-like branching, the collector's ideal. Each branch is a single crystal oriented along {100}.");
  } else if (c.habit === 'wire_copper') {
    parts.push(narrative_variant('native_copper', 'wire_copper') || 'Wire copper — filamentary growth in narrow channels. Ray and Chino (Arizona) produced the delicate wires.');
  } else {
    parts.push(narrative_variant('native_copper', 'cubic_dodecahedral') || 'Cubic/dodecahedral well-formed crystal — rare for native copper, which usually grows as dendrites.');
  }
  parts.push(narrative_variant('native_copper', 'statue_of_liberty_tail') || "The Statue of Liberty's iconic green patina is malachite growing on native copper — the mineralogical fate of most surface copper, given enough time and rain.");
  return parts.filter(p => p).join(' ');
},

  _narrate_native_gold(c) {
  // Prose lives in narratives/native_gold.md. JS narrator added in this
  // commit to close the JS-side gap (Python had a narrator; JS dispatch
  // would silently emit nothing for native gold). Mirrors Python's blurb +
  // 3-way habit + 2-way alloy + noble_tail structure.
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
  parts.push(narrative_blurb('native_bismuth') || "Bi — elemental bismuth.");
  if (c.habit === 'arborescent_dendritic') parts.push(narrative_variant('native_bismuth', 'arborescent_dendritic') || 'Arborescent dendritic.');
  else if (c.habit === 'rhombohedral_crystal') parts.push(narrative_variant('native_bismuth', 'rhombohedral_crystal') || 'Rhombohedral crystal — RARE.');
  else parts.push(narrative_variant('native_bismuth', 'massive_default') || 'Massive granular.');
  return parts.filter(p => p).join(' ');
},

  _narrate_native_tellurium(c) {
  // Prose lives in narratives/native_tellurium.md.
  const parts = [`Native tellurium #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_tellurium') || 'Te — elemental tellurium.');
  if (c.habit === 'prismatic_hex') parts.push(narrative_variant('native_tellurium', 'prismatic_hex') || 'Hexagonal prismatic.');
  else if (c.habit === 'reticulated') parts.push(narrative_variant('native_tellurium', 'reticulated') || 'Reticulated.');
  else parts.push(narrative_variant('native_tellurium', 'granular_default') || 'Granular massive.');
  if ((c.position || '').includes('native_gold')) parts.push(narrative_variant('native_tellurium', 'on_native_gold') || 'Note position — nucleated on native gold.');
  if (c.dissolved) parts.push(narrative_variant('native_tellurium', 'oxidative_dissolution') || 'Oxidative dissolution.');
  else if (c.zones && c.zones.length > 6) parts.push(narrative_variant('native_tellurium', 'tellurite_tarnish') || 'Tellurite tarnish.');
  return parts.filter(p => p).join(' ');
},

  _narrate_native_sulfur(c) {
  // Prose lives in narratives/native_sulfur.md.
  const parts = [`Native sulfur #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_sulfur') || 'S — elemental sulfur.');
  if (c.habit === 'bipyramidal_alpha') parts.push(narrative_variant('native_sulfur', 'bipyramidal_alpha') || 'α-Sulfur bipyramidal.');
  else if (c.habit === 'prismatic_beta') parts.push(narrative_variant('native_sulfur', 'prismatic_beta') || 'β-Sulfur prismatic.');
  else if (c.habit === 'sublimation_crust') parts.push(narrative_variant('native_sulfur', 'sublimation_crust') || 'Sublimation crust.');
  if ((c.position || '').includes('celestine')) parts.push(narrative_variant('native_sulfur', 'on_celestine') || 'Nucleated on celestine.');
  else if ((c.position || '').includes('aragonite') || (c.position || '').includes('selenite')) parts.push(narrative_variant('native_sulfur', 'biogenic_caprock') || 'Sedimentary biogenic context.');
  if (c.dissolved) parts.push(narrative_variant('native_sulfur', 'oxidative_dissolution') || 'Oxidative dissolution.');
  return parts.filter(p => p).join(' ');
},

  _narrate_native_arsenic(c) {
  // Prose lives in narratives/native_arsenic.md.
  const parts = [`Native arsenic #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_arsenic') || 'As — elemental arsenic, the pariah of the periodic table.');
  if (c.habit === 'reniform') parts.push(narrative_variant('native_arsenic', 'reniform') || 'Reniform / botryoidal.');
  else if (c.habit === 'rhombohedral_crystal') parts.push(narrative_variant('native_arsenic', 'rhombohedral_crystal') || 'Rhombohedral crystal — RARE.');
  else if (c.habit === 'arsenolamprite') parts.push(narrative_variant('native_arsenic', 'arsenolamprite') || 'Arsenolamprite — Bi-rich variety.');
  else parts.push(narrative_variant('native_arsenic', 'massive_default') || 'Massive granular — the Freiberg ore form.');
  if (c.dissolved) parts.push(narrative_variant('native_arsenic', 'oxidative_dissolution') || 'Oxidative dissolution.');
  else if (c.zones && c.zones.length > 8) parts.push(narrative_variant('native_arsenic', 'arsenolite_tarnish') || 'Arsenolite tarnish.');
  return parts.filter(p => p).join(' ');
},

  _narrate_native_silver(c) {
  // Prose lives in narratives/native_silver.md.
  const parts = [`Native silver #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('native_silver') || "Ag — elemental silver, the only native element bright enough to make you rich just by looking at it wrong. Cubic isometric (Fm3̄m), Mohs 2.5-3, specific gravity 10.5 (one of the heaviest native metals). The chemistry novelty: native silver only forms where every sulfur atom is already claimed and the fluid is strongly reducing — the inverse of normal supersaturation logic. Every Kongsberg wire grew in a calcite-vein basement pocket where no sulfide source was anywhere nearby.");
  if (c.habit === 'wire') {
    parts.push(narrative_variant('native_silver', 'wire') || "Wire silver — the collector's prize. Epithermal, low-T, open-vug habit; the thread of metal curls through the void as the depletion-driven supersaturation is exhausted along the growth front. Kongsberg's wires reach 30+ cm (Bjørlykke 1959).");
  } else if (c.habit === 'dendritic') {
    parts.push(narrative_variant('native_silver', 'dendritic') || 'Dendritic silver — fern-like plates, the Cobalt-Ontario habit. Branching emerges when diffusion-limited growth outruns the depletion zone, splits, and self-replicates in two dimensions.');
  } else if (c.habit === 'cubic_crystal') {
    parts.push(narrative_variant('native_silver', 'cubic_crystal') || "Cubic crystal — RARE habit. Native silver almost never grows as well-formed isometric crystals; the diffusion-limited geometry of low-S reducing fluid favors wires and dendrites.");
  } else {
    parts.push(narrative_variant('native_silver', 'massive') || 'Massive native silver — hackly metallic mass, the Keweenaw nugget habit. Forms when Ag concentration is high enough that the depletion zone is locally exhausted before delicate morphologies develop.');
  }
  if (c.twinned && (c.twin_law || '').includes('{111}')) {
    parts.push(narrative_variant('native_silver', 'penetration_twin') || '{111} penetration twin — two cubes interlocked along a {111} composition plane. Diagnostic when present, rare in nature.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('native_silver', 'tarnishing_full') || 'Tarnishing — S has returned to the fluid and is skinning the surface with acanthite. Geologically inevitable.');
  } else if (c.zones && c.zones.length > 20) {
    parts.push(narrative_variant('native_silver', 'tarnishing_early') || 'The fresh-broken metallic luster has begun to dull — atmospheric S is reaching the surface and the first molecular layer of acanthite is forming.');
  }
  if ((c.position || '').includes('acanthite')) {
    parts.push(narrative_variant('native_silver', 'on_acanthite') || "Note position — this crystal nucleated on a dissolving acanthite. That's the supergene Ag-enrichment cycle: primary acanthite oxidizes, releases Ag⁺, the Ag⁺ migrates down the redox gradient and re-precipitates as native silver in a deeper reducing pocket. Same Ag atoms, different mineral, same vug.");
  }
  return parts.filter(p => p).join(' ');
},
});
