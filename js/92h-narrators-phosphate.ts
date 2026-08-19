// ============================================================
// js/92h-narrators-phosphate.ts — VugSimulator._narrate_<mineral> (phosphate)
// ============================================================
// Per-mineral narrators for phosphate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (11): autunite, carnotite, clinobisvanite, descloizite, mottramite, pyromorphite, torbernite, tyuyamunite, uranospinite, vanadinite, zeunerite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_pyromorphite(c) {
  // Prose lives in narratives/pyromorphite.md.
  const parts = [`Pyromorphite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('pyromorphite'));
  if ((c.habit || '').includes('olive')) {
    parts.push(narrative_variant('pyromorphite', 'olive_classic'));
  } else if ((c.habit || '').includes('yellow') || (c.habit || '').includes('brown')) {
    parts.push(narrative_variant('pyromorphite', 'non_canonical_color'));
  }
  parts.push(narrative_variant('pyromorphite', 'remediation_tail'));
  return parts.filter(p => p).join(' ');
},

  _narrate_vanadinite(c) {
  // Prose lives in narratives/vanadinite.md, including vanadate companions.
  const parts = [`Vanadinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('vanadinite'));
  if ((c.habit || '').includes('endlichite')) {
    parts.push(narrative_variant('vanadinite', 'endlichite'));
  } else if ((c.habit || '').includes('red')) {
    parts.push(narrative_variant('vanadinite', 'red_signature'));
  }
  parts.push(narrative_variant('vanadinite', 'desert_tail'));
  const activeDes = (this && this.crystals) ? this.crystals.filter(dc => dc.mineral === 'descloizite' && dc.active) : [];
  const activeMot = (this && this.crystals) ? this.crystals.filter(mc => mc.mineral === 'mottramite' && mc.active) : [];
  if (activeDes.length || activeMot.length) {
    const companions = [];
    if (activeDes.length) companions.push(`descloizite #${activeDes[0].crystal_id}`);
    if (activeMot.length) companions.push(`mottramite #${activeMot[0].crystal_id}`);
    parts.push(narrative_variant('vanadinite', 'vanadate_companions', { companions: companions.join(' and ') }));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_clinobisvanite(c) {
  // Prose lives in narratives/clinobisvanite.md.
  const parts = [`Clinobisvanite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('clinobisvanite'));
  parts.push(narrative_closing('clinobisvanite'));
  return parts.filter(p => p).join(' ');
},

  _narrate_descloizite(c) {
  // Prose lives in narratives/descloizite.md; Markdown owns the full habit text.
  const parts = [`Descloizite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('descloizite'));
  if (c.habit === 'botryoidal') parts.push(narrative_variant('descloizite', 'botryoidal'));
  else if (c.habit === 'prismatic') parts.push(narrative_variant('descloizite', 'prismatic'));
  else parts.push(narrative_variant('descloizite', 'tabular_default'));
  return parts.filter(p => p).join(' ');
},

  _narrate_mottramite(c) {
  // Prose lives in narratives/mottramite.md.
  const parts = [`Mottramite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('mottramite'));
  if (c.habit === 'botryoidal') parts.push(narrative_variant('mottramite', 'botryoidal'));
  else if (c.habit === 'prismatic') parts.push(narrative_variant('mottramite', 'prismatic'));
  else parts.push(narrative_variant('mottramite', 'tabular_default'));
  return parts.filter(p => p).join(' ');
},

  _narrate_torbernite(c) {
  // Prose lives in narratives/torbernite.md.
  const parts = [`Torbernite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('torbernite'));
  if (c.habit === 'micaceous_book') parts.push(narrative_variant('torbernite', 'micaceous_book'));
  else if (c.habit === 'tabular_plates') parts.push(narrative_variant('torbernite', 'tabular_plates'));
  else parts.push(narrative_variant('torbernite', 'earthy_crust'));
  if (c.nucleation_temp > 60) {
    parts.push(narrative_variant('torbernite', 'metatorbernite_warning'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_zeunerite(c) {
  // Prose lives in narratives/zeunerite.md.
  const parts = [`Zeunerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('zeunerite'));
  if (c.habit === 'micaceous_book') parts.push(narrative_variant('zeunerite', 'micaceous_book'));
  else if (c.habit === 'tabular_plates') parts.push(narrative_variant('zeunerite', 'tabular_plates'));
  else parts.push(narrative_variant('zeunerite', 'scaly_encrustation'));
  return parts.filter(p => p).join(' ');
},

  _narrate_carnotite(c) {
  // Prose lives in narratives/carnotite.md.
  const parts = [`Carnotite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('carnotite'));
  if (c.habit === 'tabular_plates') parts.push(narrative_variant('carnotite', 'tabular_plates'));
  else if (c.habit === 'earthy_crust') parts.push(narrative_variant('carnotite', 'earthy_crust'));
  else parts.push(narrative_variant('carnotite', 'powdery_disseminated'));
  if (c.nucleation_temp < 30) {
    parts.push(narrative_variant('carnotite', 'roll_front'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_autunite(c) {
  // Prose lives in narratives/autunite.md. Round 9d (May 2026) Ca-cation
  // analog of torbernite — the cation fork's narrative payoff is the
  // fluorescence (Ca²⁺ doesn't quench like Cu²⁺ does).
  const parts = [`Autunite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('autunite'));
  if (c.habit === 'micaceous_book') {
    parts.push(narrative_variant('autunite', 'micaceous_book'));
  } else if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('autunite', 'tabular_plates'));
  } else {
    parts.push(narrative_variant('autunite', 'encrusting'));
  }
  if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('autunite', 'on_weathering_uraninite'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('autunite', 'acid_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_uranospinite(c) {
  // Prose lives in narratives/uranospinite.md. Round 9e (May 2026)
  // Ca-cation analog of zeunerite. The cation fork's narrative payoff
  // on the As-branch — Ca²⁺ doesn't quench like Cu²⁺ does in zeunerite.
  const parts = [`Uranospinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('uranospinite'));
  if (c.habit === 'micaceous_book') {
    parts.push(narrative_variant('uranospinite', 'micaceous_book'));
  } else if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('uranospinite', 'tabular_plates'));
  } else {
    parts.push(narrative_variant('uranospinite', 'encrusting'));
  }
  if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('uranospinite', 'on_weathering_uraninite'));
  } else if ((c.position || '').includes('arsenopyrite')) {
    parts.push(narrative_variant('uranospinite', 'on_weathering_arsenopyrite'));
  } else if ((c.position || '').includes('zeunerite')) {
    parts.push(narrative_variant('uranospinite', 'on_zeunerite'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('uranospinite', 'acid_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tyuyamunite(c) {
  // Prose lives in narratives/tyuyamunite.md. Round 9e (May 2026)
  // Ca-cation analog of carnotite — orthorhombic instead of monoclinic.
  const parts = [`Tyuyamunite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('tyuyamunite'));
  if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('tyuyamunite', 'tabular_plates'));
  } else if (c.habit === 'earthy_crust') {
    parts.push(narrative_variant('tyuyamunite', 'earthy_crust'));
  } else {
    parts.push(narrative_variant('tyuyamunite', 'powdery_disseminated'));
  }
  if ((c.position || '').includes('carnotite')) {
    parts.push(narrative_variant('tyuyamunite', 'carnotite_companion'));
  } else if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('tyuyamunite', 'on_weathering_uraninite'));
  } else if ((c.position || '').includes('roll-front')) {
    parts.push(narrative_variant('tyuyamunite', 'roll_front'));
  }
  if (c.dissolved) {
    parts.push(narrative_variant('tyuyamunite', 'acid_dissolution'));
  }
  return parts.filter(p => p).join(' ');
},

  // v64 brief-19 narrators.
  _narrate_apatite(c) {
    const parts = [`Apatite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Ca₅(PO₄)₃(F,Cl,OH) — the structural archetype of the apatite supergroup. The Pb-end-members already in the vug (pyromorphite, mimetite, vanadinite) are derivatives of this same hexagonal channel structure.');
    if (c.habit === 'prismatic_hexagonal') parts.push('Long c-axis hexagonal prism — the Cerro de Mercado / Panasqueira aesthetic.');
    else if (c.habit === 'botryoidal_collophane') parts.push('Cryptocrystalline botryoidal mass — low-T sedimentary phosphorite habit (collophane).');
    if (c.dissolved) parts.push('Acid attack dissolved it — apatite is the basis of phosphoric acid production from phosphate rock, and of tooth decay.');
    return parts.join(' ');
  },

  _narrate_turquoise(c) {
    const parts = [`Turquoise #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('CuAl₆(PO₄)₄(OH)₈·4H₂O — the sky-blue Cu-supergene phosphate. Mined since 5000 BCE at Maghara (Sinai); Persian Nishapur, American Sleeping Beauty, Bisbee Blue all crystallize from the same arid Cu-porphyry chemistry where chloride / carbonate / sulfate could not get to the copper first.');
    if (c.habit === 'veinlet_fill') parts.push('Veinlet-fill habit — thin blue stringer along host-rock fracture.');
    else if (c.habit === 'spider_web') parts.push('Spider-web matrix — host-rock fragments form filigree network through blue (Hubei / Lone Mountain aesthetic).');
    if (c.dissolved) parts.push('Dehydration above 200°C greened the crystal irreversibly — turquoise is a hydrated phase that loses zeolitic water on heating.');
    return parts.join(' ');
  },
});
