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
  parts.push(narrative_blurb('pyromorphite') || "Pb₅(PO₄)₃Cl — hexagonal apatite-group phosphate. Barrel-shaped hexagonal prisms in olive-green, yellow, orange, or brown. Forms in supergene oxidation zones when phosphate-bearing meteoric water encounters a Pb-bearing horizon. The name is Greek 'pyros morphos' — 'fire form' — because the crystals re-form into a spherical droplet when melted.");
  if ((c.habit || '').includes('olive')) {
    parts.push(narrative_variant('pyromorphite', 'olive_classic') || 'Classic olive-green barrel crystals. Found at the type locality of Leadhills (Scotland), at Dognacska (Romania), and — best of all — at Les Farges (France) where millimeter-sharp brilliant-green crystals set the world standard.');
  } else if ((c.habit || '').includes('yellow') || (c.habit || '').includes('brown')) {
    parts.push(narrative_variant('pyromorphite', 'non_canonical_color') || 'Non-canonical color — the pocket fluid substituted Ca for some Pb (pale yellow-orange, phosphoapatite-adjacent) or carried Fe trace (brown-olive).');
  }
  parts.push(narrative_variant('pyromorphite', 'remediation_tail') || 'Pyromorphite is used in environmental remediation: dump phosphate fertilizer onto lead-contaminated soil and the toxic Pb precipitates as pyromorphite — stable, insoluble, and harmless. Mineralogy as a cleanup tool.');
  return parts.filter(p => p).join(' ');
},

  _narrate_vanadinite(c) {
  // Prose lives in narratives/vanadinite.md. JS gains the vanadate_companions
  // branch in this commit (drift consolidation — Python had it).
  const parts = [`Vanadinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('vanadinite') || 'Pb₅(VO₄)₃Cl — hexagonal apatite-group vanadate. Bright red-orange prisms with flat basal terminations, sitting atop goethite-stained matrix. Vanadium-end-member of the pyromorphite–mimetite–vanadinite series, arguably mineralogy\u2019s most complete solid-solution triangle.');
  if ((c.habit || '').includes('endlichite')) {
    parts.push(narrative_variant('vanadinite', 'endlichite') || 'Endlichite — intermediate vanadinite-mimetite composition with significant As⁵⁺ substituting for V⁵⁺. The color shifts toward yellow as As dominates. The compositional series is continuous.');
  } else if ((c.habit || '').includes('red')) {
    parts.push(narrative_variant('vanadinite', 'red_signature') || "The signature red-orange. This is the chromophore pegged to V⁵⁺ in the crystal structure — no other common mineral produces this particular red. The Moroccan Mibladen and Touissit deposits have produced the world\u2019s finest specimens, growing on goethite crust in near-surface oxidation pockets.");
  }
  parts.push(narrative_variant('vanadinite', 'desert_tail') || "Classic desert mineral. V comes from oxidation of V-bearing red-bed sediments (roll-front uranium deposits, ironstones) — an arid-climate signature. The rock-shop cliché 'vanadinite on goethite' is geologically accurate.");
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
  parts.push(narrative_blurb('clinobisvanite') || 'BiVO₄ — bright yellow to orange-yellow monoclinic Bi-vanadate.');
  parts.push(narrative_closing('clinobisvanite') || 'BiVO₄ is a photocatalyst for solar-driven water splitting.');
  return parts.filter(p => p).join(' ');
},

  _narrate_descloizite(c) {
  // Prose lives in narratives/descloizite.md. Drift consolidation: JS
  // habit branches were shorter; live JS now matches the longer Python text.
  const parts = [`Descloizite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('descloizite') || "Pb(Zn,Cu)VO₄(OH) — orthorhombic Pb-Zn vanadate, the Zn end of the descloizite-mottramite series. Cherry-red to brown-red, Mohs 3-3.5; the Tsumeb display standard. Forms in supergene oxidation zones where Pb-Zn sulfide ore (galena + sphalerite) has weathered AND V is delivered by groundwater. When Cu > Zn, mottramite (the olive-green Cu sibling) takes priority instead.");
  if (c.habit === 'botryoidal') parts.push(narrative_variant('descloizite', 'botryoidal') || 'Botryoidal mammillary crust — Mibladen / Berg-Aukas habit.');
  else if (c.habit === 'prismatic') parts.push(narrative_variant('descloizite', 'prismatic') || 'Prismatic — the Tsumeb display habit.');
  else parts.push(narrative_variant('descloizite', 'tabular_default') || 'Tabular — late-stage low-σ habit.');
  return parts.filter(p => p).join(' ');
},

  _narrate_mottramite(c) {
  // Prose lives in narratives/mottramite.md.
  const parts = [`Mottramite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('mottramite') || "Pb(Cu,Zn)VO₄(OH) — orthorhombic Pb-Cu vanadate, the Cu end of the descloizite-mottramite series. Olive-green to yellowish-green from the Cu chromophore. Type locality: Mottram St. Andrew, Cheshire (England), 1876. Tsumeb produces the museum specimens. When Zn ≥ Cu, descloizite takes priority.");
  if (c.habit === 'botryoidal') parts.push(narrative_variant('mottramite', 'botryoidal') || 'Botryoidal — Mottram St Andrew habit.');
  else if (c.habit === 'prismatic') parts.push(narrative_variant('mottramite', 'prismatic') || "Prismatic — Tsumeb's olive-green crystals.");
  else parts.push(narrative_variant('mottramite', 'tabular_default') || 'Tabular — late-stage habit.');
  return parts.filter(p => p).join(' ');
},

  _narrate_torbernite(c) {
  // Prose lives in narratives/torbernite.md.
  const parts = [`Torbernite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('torbernite') || "Cu(UO₂)₂(PO₄)₂·12H₂O — tetragonal uranyl phosphate, the phosphate branch of the autunite-group anion-competition trio (with zeunerite for arsenate and carnotite for vanadate). Emerald-green tabular plates that look like green mica; non-fluorescent because the Cu²⁺ in the lattice quenches the uranyl emission that would otherwise make this mineral glow. The crystal exists because uraninite weathered upstream, releasing mobile U⁶⁺ into oxidizing groundwater that also carried Cu and phosphate — and at the moment of nucleation, phosphate dominated arsenate in the local fluid. Mohs 2-2.5, ☢️ radioactive (the U⁶⁺ decays slowly inside the crystal lattice it builds).");
  if (c.habit === 'micaceous_book') parts.push(narrative_variant('torbernite', 'micaceous_book') || "Micaceous book habit — stacked subparallel plates, the high-σ Musonoi (Katanga, DRC) form. Looks like someone pressed sheets of green glass into a single specimen.");
  else if (c.habit === 'tabular_plates') parts.push(narrative_variant('torbernite', 'tabular_plates') || "Tabular plates flattened on {001} — the diagnostic Schneeberg habit. Square or octagonal outlines, thin enough to flake, the textbook torbernite specimen.");
  else parts.push(narrative_variant('torbernite', 'earthy_crust') || "Earthy crust — low-σ encrustation on fracture surfaces. Less aesthetic than the diagnostic plates but more abundant in the field.");
  if (c.nucleation_temp > 60) {
    parts.push(narrative_variant('torbernite', 'metatorbernite_warning') || "Note: this crystal grew near the metatorbernite transition temperature (~75°C). Continued heat would drive irreversible dehydration to the 8-H₂O metatorbernite form — a one-way conversion.");
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_zeunerite(c) {
  // Prose lives in narratives/zeunerite.md.
  const parts = [`Zeunerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('zeunerite') || "Cu(UO₂)₂(AsO₄)₂·(10-16)H₂O — tetragonal uranyl arsenate, the arsenate branch of the autunite-group trio. Visually almost indistinguishable from torbernite — same emerald-green color, same square tabular habit, same micaceous cleavage — distinguishable in the field only by chemistry. The arsenic is the giveaway: zeunerite localities are almost always former mining districts with arsenopyrite or tennantite as primary As-bearing ores. The fluid that grew this crystal carried more arsenate than phosphate at the moment of nucleation; in a parallel run with the ratio inverted, this same broth would have grown torbernite instead. Mohs 2.5, ☢️ radioactive (U + As both decay-active).");
  if (c.habit === 'micaceous_book') parts.push(narrative_variant('zeunerite', 'micaceous_book') || "Micaceous book habit — stacked subparallel plates, the high-σ Schneeberg form. Type-locality material.");
  else if (c.habit === 'tabular_plates') parts.push(narrative_variant('zeunerite', 'tabular_plates') || "Tabular plates flattened on {001} — the diagnostic Schneeberg/Cínovec habit. Identical in shape to torbernite; chemistry is the only discriminator.");
  else parts.push(narrative_variant('zeunerite', 'scaly_encrustation') || "Scaly encrustation — low-σ thin overlapping plates coating fracture surfaces.");
  return parts.filter(p => p).join(' ');
},

  _narrate_carnotite(c) {
  // Prose lives in narratives/carnotite.md.
  const parts = [`Carnotite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('carnotite') || "K₂(UO₂)₂(VO₄)₂·3H₂O — monoclinic uranyl vanadate, the vanadate branch of the autunite-group anion-competition trio (with torbernite for phosphate and zeunerite for arsenate). The mineral that paints the desert: bright canary-yellow, so chromatically aggressive that one percent of it stains an entire Jurassic sandstone outcrop the color of school buses and hazard tape. The Colorado Plateau uranium districts were prospected by following yellow stains across mesa tops decades before scintillometers existed. Mohs ~2 (soft, earthy), ☢️ radioactive, non-fluorescent (the vanadate matrix quenches the uranyl emission that would otherwise make this mineral glow).");
  if (c.habit === 'tabular_plates') parts.push(narrative_variant('carnotite', 'tabular_plates') || "Rare crystalline habit — diamond-shaped plates flattened on {001}, the collector's prize. Crystalline carnotite is genuinely uncommon; almost all carnotite in nature is the earthy/powdery form.");
  else if (c.habit === 'earthy_crust') parts.push(narrative_variant('carnotite', 'earthy_crust') || "Canary-yellow earthy crust — the diagnostic Colorado Plateau habit. Forms as crusts on sandstone, often concentrated around petrified wood and carbonaceous shales where ancient organic matter trapped uranium from circulating groundwater.");
  else parts.push(narrative_variant('carnotite', 'powdery_disseminated') || "Powdery yellow disseminations — the sandstone-stain form. Doesn't crystallize so much as it stains; the stain is the habit.");
  if (c.nucleation_temp < 30) {
    parts.push(narrative_variant('carnotite', 'roll_front') || "Cool nucleation (~ambient surface temperatures) — consistent with the roll-front geological setting where oxidizing meteoric water encounters a reducing barrier and drops both U and V into the same yellow precipitate.");
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_autunite(c) {
  // Prose lives in narratives/autunite.md. Round 9d (May 2026) Ca-cation
  // analog of torbernite — the cation fork's narrative payoff is the
  // fluorescence (Ca²⁺ doesn't quench like Cu²⁺ does).
  const parts = [`Autunite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('autunite') || "Ca(UO₂)₂(PO₄)₂·11H₂O — same parent fluid as torbernite, opposite cation. Where torbernite's Cu²⁺ quenches the uranyl emission cold, autunite's Ca²⁺ leaves it alone. Bright canary-yellow tabular plates that glow intense apple-green under longwave UV.");
  if (c.habit === 'micaceous_book') {
    parts.push(narrative_variant('autunite', 'micaceous_book') || "Stacked subparallel plates — the Margnac and Spruce Pine book habit. High σ pushes successive {001} layers to nucleate atop each other rather than spreading laterally.");
  } else if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('autunite', 'tabular_plates') || "The default Saint-Symphorien habit — thin square yellow plates flattened on {001}, looking like uranium-saturated mica. Brongniart described these from Autun in 1852.");
  } else {
    parts.push(narrative_variant('autunite', 'encrusting') || "Earthy yellow staining — the 'yellow uranium ore' appearance prospectors used to track on sandstone outcrops.");
  }
  if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('autunite', 'on_weathering_uraninite') || 'This autunite grew on a dissolving uraninite — the canonical paragenesis. Reducing fluid put the U⁴⁺ down as primary uraninite; meteoric oxidation flipped U⁴⁺ to mobile UO₂²⁺ and the dissolving uraninite released its uranyl directly into local Ca + PO₄-bearing groundwater.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('autunite', 'acid_dissolution') || 'Acid attack — pH below 4.5 destabilizes uranyl phosphates. Ca²⁺ floats free, the uranyl ion goes back into solution, the phosphate joins the broth.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_uranospinite(c) {
  // Prose lives in narratives/uranospinite.md. Round 9e (May 2026)
  // Ca-cation analog of zeunerite. The cation fork's narrative payoff
  // on the As-branch — Ca²⁺ doesn't quench like Cu²⁺ does in zeunerite.
  const parts = [`Uranospinite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('uranospinite') || "Ca(UO₂)₂(AsO₄)₂·10H₂O — same chemistry stage as zeunerite, opposite cation. Yellow tabular plates that glow yellow-green under longwave UV.");
  if (c.habit === 'micaceous_book') {
    parts.push(narrative_variant('uranospinite', 'micaceous_book') || "Stacked subparallel plates — high σ at cool T pushes successive {001} layers into a stacked book.");
  } else if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('uranospinite', 'tabular_plates') || "The default Schneeberg habit — thin square plates flattened on {001}, looking like a yellow autunite.");
  } else {
    parts.push(narrative_variant('uranospinite', 'encrusting') || "Earthy yellow encrustation — low σ, thin yellow surface staining on the host rock.");
  }
  if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('uranospinite', 'on_weathering_uraninite') || 'Grew on a dissolving uraninite — the canonical paragenesis.');
  } else if ((c.position || '').includes('arsenopyrite')) {
    parts.push(narrative_variant('uranospinite', 'on_weathering_arsenopyrite') || 'Grew adjacent to a dissolving arsenopyrite — the As source.');
  } else if ((c.position || '').includes('zeunerite')) {
    parts.push(narrative_variant('uranospinite', 'on_zeunerite') || 'Adjacent to active zeunerite — the Cu-cation partner. Where Cu dominates the pore, zeunerite plates; where Ca dominates, uranospinite.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('uranospinite', 'acid_dissolution') || 'Acid attack — pH below 4.5 destabilizes the autunite-group framework.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_tyuyamunite(c) {
  // Prose lives in narratives/tyuyamunite.md. Round 9e (May 2026)
  // Ca-cation analog of carnotite — orthorhombic instead of monoclinic.
  const parts = [`Tyuyamunite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('tyuyamunite') || "Ca(UO₂)₂(VO₄)₂·5-8H₂O — same chemistry stage as carnotite, opposite cation. Two species, one mechanism, drawn apart by which alkaline-earth/alkali metal happens to dominate the local groundwater.");
  if (c.habit === 'tabular_plates') {
    parts.push(narrative_variant('tyuyamunite', 'tabular_plates') || "Rare crystalline tyuyamunite — diamond-shaped plates flattened on {001}, the Tyuya-Muyun form.");
  } else if (c.habit === 'earthy_crust') {
    parts.push(narrative_variant('tyuyamunite', 'earthy_crust') || "Canary-yellow earthy crust — the standard sandstone-staining habit.");
  } else {
    parts.push(narrative_variant('tyuyamunite', 'powdery_disseminated') || "Powdery yellow disseminations — the sandstone-stain form.");
  }
  if ((c.position || '').includes('carnotite')) {
    parts.push(narrative_variant('tyuyamunite', 'carnotite_companion') || 'This tyuyamunite is the calcium twin to a carnotite growing in the same pocket. The fluid Ca/K ratio decided which one each grain became.');
  } else if ((c.position || '').includes('uraninite')) {
    parts.push(narrative_variant('tyuyamunite', 'on_weathering_uraninite') || 'Grew on a dissolving uraninite — the canonical paragenetic chain.');
  } else if ((c.position || '').includes('roll-front')) {
    parts.push(narrative_variant('tyuyamunite', 'roll_front') || 'Roll-front position — concentrated around organic carbon.');
  }
  if (c.dissolved) {
    parts.push(narrative_variant('tyuyamunite', 'acid_dissolution') || 'Acid attack — pH below 5 destabilizes the uranyl-vanadate framework.');
  }
  return parts.filter(p => p).join(' ');
},
});
