// ============================================================
// js/92g-narrators-oxide.ts — VugSimulator._narrate_<mineral> (oxide)
// ============================================================
// Per-mineral narrators for oxide-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_hematite(c) {
  // Prose lives in narratives/hematite.md.
  const parts = [`Hematite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  if (c.habit === 'specular') {
    parts.push(narrative_variant('hematite', 'specular') || 'The high temperature produced specular hematite — brilliant metallic plates that flash like mirrors. The thin {001} basal plates grew parallel, creating the characteristic iron rose texture.');
    if (c.zones && c.zones.some(z => z.note && z.note.includes('iridescent'))) {
      parts.push(narrative_variant('hematite', 'specular_iridescent') || 'Some plates are thin enough to show iridescent interference colors — rainbow hematite, a collector favorite.');
    }
  } else if (c.habit === 'rhombohedral') {
    parts.push(narrative_variant('hematite', 'rhombohedral') || 'Moderate temperatures produced rhombohedral hematite — sharp-edged crystals with {101} faces, dark metallic gray with a red streak.');
  } else if (c.habit === 'botryoidal') {
    parts.push(narrative_variant('hematite', 'botryoidal') || 'Low-temperature growth produced botryoidal hematite — kidney-ore texture with smooth, rounded surfaces. Classic kidney iron ore mined since antiquity.');
  } else if (c.habit === 'earthy/massive') {
    parts.push(narrative_variant('hematite', 'earthy_massive') || 'Low supersaturation produced earthy, massive hematite — red microcrystalline aggregate. The red ochre pigment humans have used for 100,000 years.');
  }
  if (c.twinned) parts.push(narrative_variant('hematite', 'twinned', { twin_law: c.twin_law }) || `Shows a rare ${c.twin_law}.`);
  if (c.dissolved) parts.push(narrative_variant('hematite', 'acid_dissolution') || 'Late-stage acid attack dissolved some of the hematite, releasing iron back to the fluid.');
  return parts.filter(p => p).join(' ');
},

  _narrate_corundum(c) {
  // Prose lives in narratives/corundum.md.
  const parts = [`Corundum #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('corundum') || 'Al₂O₃ — trigonal close-packed oxide, hardness 9 (the benchmark below diamond). This is the colorless/generic variety: no chromophore trace above the ruby (Cr ≥ 2 ppm) or sapphire (Fe ≥ 5) gates.');
  if (c.habit === 'tabular') parts.push(narrative_variant('corundum', 'tabular') || 'Flat tabular hexagonal plate — the Mogok marble-hosted contact-metamorphic habit. Basal pinacoid dominates over the prism.');
  else if (c.habit === 'barrel') parts.push(narrative_variant('corundum', 'barrel') || 'Steep dipyramidal "barrel" — the high-T (>700°C) habit diagnostic of basalt-hosted xenocrysts. Thailand and Mozambique corundum most often takes this form.');
  const avg_Ti = c.zones.reduce((s, z) => s + (z.trace_Ti || 0), 0) / Math.max(c.zones.length, 1);
  if (avg_Ti > 0.05) {
    parts.push(narrative_variant('corundum', 'trace_ti') || "Trace Ti in the zones — microscale rutile partitioning that did not reach the asterism-inclusion threshold.");
  }
  if (c.dissolved) {
    parts.push(narrative_variant('corundum', 'dissolved') || 'Unusual — corundum is essentially acid-inert in all sim conditions.');
  }
  return parts.filter(p => p).join(' ');
},

  _narrate_ruby(c) {
  // Prose lives in narratives/ruby.md.
  const parts = [`Ruby #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('ruby') || "Al₂O₃ + Cr³⁺ — the red chromium-bearing variety of corundum.");
  const notes = c.zones.map(z => (z.note || ''));
  if (notes.some(n => n.includes("pigeon"))) parts.push(narrative_variant('ruby', 'pigeons_blood') || "Pigeon's blood — the Mogok color grade.");
  else if (notes.some(n => n.includes('cherry'))) parts.push(narrative_variant('ruby', 'cherry') || "Cherry-red — deep Cr saturation, darker tone than Mogok 'pigeon's blood'. The Burma classical grade.");
  else if (notes.some(n => n.includes('pinkish'))) parts.push(narrative_variant('ruby', 'pinkish') || 'Pinkish ruby — Cr just above the 2 ppm gate.');
  if (c.habit === 'asterated') parts.push(narrative_variant('ruby', 'asterated') || '6-rayed asterism — rutile (TiO₂) needle inclusions aligned along the basal plane.');
  else if (c.habit === 'barrel') parts.push(narrative_variant('ruby', 'barrel') || 'Steep dipyramidal "barrel" — Mozambique/Madagascar basalt-hosted habit.');
  else if (c.habit === 'tabular') parts.push(narrative_variant('ruby', 'tabular') || 'Flat hexagonal plate — the Mogok marble-hosted signature.');
  return parts.filter(p => p).join(' ');
},

  _narrate_sapphire(c) {
  // Prose lives in narratives/sapphire.md. JS gains the violet (V³⁺
  // Tanzania) zone-note variant Python had — drift consolidation.
  const parts = [`Sapphire #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('sapphire') || 'Al₂O₃ with Fe/Ti/V trace — the non-red corundum varieties.');
  const notes = c.zones.map(z => (z.note || ''));
  if (notes.some(n => n.includes('cornflower'))) parts.push(narrative_variant('sapphire', 'cornflower') || "Cornflower blue — the Kashmir type.");
  else if (notes.some(n => n.includes('royal blue'))) parts.push(narrative_variant('sapphire', 'royal_blue') || 'Royal blue — deeper Fe than Kashmir cornflower.');
  else if (notes.some(n => n.includes('padparadscha'))) parts.push(narrative_variant('sapphire', 'padparadscha') || 'Padparadscha — the pink-orange corundum named for the Sinhalese word for lotus blossom.');
  else if (notes.some(n => n.includes('yellow'))) parts.push(narrative_variant('sapphire', 'yellow') || 'Yellow sapphire — Fe³⁺ in the Al site, no Ti partner.');
  else if (notes.some(n => n.includes('violet'))) parts.push(narrative_variant('sapphire', 'violet'));
  else if (notes.some(n => n.includes('pink'))) parts.push(narrative_variant('sapphire', 'pink') || 'Pink sapphire — Cr just below the 2 ppm ruby gate.');
  else if (notes.some(n => n.includes('green'))) parts.push(narrative_variant('sapphire', 'green') || 'Green sapphire — Fe alone, no Ti partner.');
  if (c.habit === 'asterated') parts.push(narrative_variant('sapphire', 'asterated') || '6-rayed star sapphire — rutile needles aligned along basal plane.');
  else if (c.habit === 'barrel') parts.push(narrative_variant('sapphire', 'barrel') || 'Steep dipyramidal "barrel" — basalt-hosted xenocryst signature.');
  else if (c.habit === 'tabular') parts.push(narrative_variant('sapphire', 'tabular') || 'Flat hexagonal plate — Mogok marble-hosted.');
  return parts.filter(p => p).join(' ');
},

  _narrate_cuprite(c) {
  // Prose lives in narratives/cuprite.md.
  const parts = [`Cuprite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('cuprite') || 'Cu₂O — 88.8% Cu by weight, dark red with ruby-red internal reflections in thin slices. Forms at the Eh boundary between more-reducing native copper and more-oxidizing malachite/tenorite. The window is narrow, which is why cuprite tends to appear as thin layers between native Cu and green malachite coats.');
  if (c.habit === 'chalcotrichite') {
    parts.push(narrative_variant('cuprite', 'chalcotrichite') || 'Chalcotrichite — hair-like plush texture. Rapid directional growth in open fracture space produced whisker crystals instead of octahedra. Morenci (Arizona) and Chessy (France) produced the best specimens.');
  } else if ((c.habit || '').includes('massive')) {
    parts.push(narrative_variant('cuprite', 'massive') || "Massive 'tile ore' — dark red-brown rapidly-precipitated cuprite filling tight pore space.");
  } else if (c.twinned && (c.twin_law || '').includes('spinel')) {
    parts.push(narrative_variant('cuprite', 'spinel_twin') || 'Spinel-law penetration twin — two octahedra intergrown with a {111} reentrant angle between them. Rare.');
  } else {
    parts.push(narrative_variant('cuprite', 'octahedral_default') || 'Classic octahedral habit, dark red with glassy-to-adamantine luster. Tsumeb (Namibia) and Mashamba West mine (Congo) produced gem-grade octahedra to 15+ cm.');
  }
  if (c.dissolved) parts.push(narrative_variant('cuprite', 'eh_dissolution') || 'Crystal dissolved — the Eh window shifted out from under it.');
  return parts.filter(p => p).join(' ');
},

  _narrate_magnetite(c) {
  // Prose lives in narratives/magnetite.md.
  const parts = [`Magnetite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('magnetite') || "Fe₃O₄ — the mixed-valence Fe²⁺Fe³⁺₂O₄ spinel oxide. Black, strongly magnetic (lodestone is natural permanent-magnet magnetite — the first compass). Sits at the HM (hematite-magnetite) redox buffer; cross that buffer and entire mineral assemblages shift. Streak is black, not red like hematite's.");
  if (c.habit === 'octahedral') parts.push(narrative_variant('magnetite', 'octahedral') || 'Octahedral {111} — the classic magnetite habit, sharp on matrix from Cerro Huanaquino (Bolivia) and Binn Valley (Switzerland).');
  else if (c.habit === 'rhombic_dodecahedral') parts.push(narrative_variant('magnetite', 'rhombic_dodecahedral') || 'Rhombic dodecahedral {110} — high-T mineralizer-assisted habit. Cl-bearing fluids promote this form over simple octahedra.');
  else parts.push(narrative_variant('magnetite', 'granular_massive') || 'Granular massive — rapid precipitation, aggregate of tiny individual crystals.');
  if (c.dissolved) parts.push(narrative_variant('magnetite', 'martite_pseudomorph') || 'Dissolving to hematite (martite pseudomorph) as O₂ climbed past the HM buffer.');
  return parts.filter(p => p).join(' ');
},

  _narrate_uraninite(c) {
  // Prose lives in narratives/uraninite.md.
  const parts = [`Uraninite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
  parts.push(narrative_blurb('uraninite') || "UO₂ — pitch-black, submetallic, one of Earth's densest oxides.");
  if (c.nucleation_temp > 400) parts.push(narrative_variant('uraninite', 'pegmatite_high_t') || 'Nucleated at high temperature — a pegmatite-scale uraninite.');
  else parts.push(narrative_variant('uraninite', 'roll_front_low_t') || 'Low-T uraninite — the sedimentary / roll-front style.');
  if (c.dissolved) parts.push(narrative_variant('uraninite', 'oxidative_dissolution') || 'Partial dissolution as O₂ invaded the system.');
  return parts.filter(p => p).join(' ');
},
});
