// ============================================================
// js/92e-narrators-molybdate.ts — VugSimulator._narrate_<mineral> (molybdate)
// ============================================================
// Per-mineral narrators for molybdate-class minerals. Mirror of B7's
// supersat-mixin split. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_calcite(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (4): ferrimolybdite, raspite, stolzite, wulfenite.
//
// Phase B16 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  _narrate_wulfenite(c) {
  // Prose lives in narratives/wulfenite.md. JS canonical for poetic
  // framings; gains acid_dissolution dispatch (Python had it).
  // Standardized opening to mm-pattern; the "collector's prize" line
  // is folded into the merged blurb.
  const parts = [`Wulfenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('wulfenite'));
  if (c.position.includes('galena')) {
    const oxidized = c.position.includes('oxidized');
    if (oxidized) {
      parts.push(narrative_variant('wulfenite', 'on_oxidized_galena') || 'It nucleated on the ghosts of two sulfides — oxidized galena (Pb²⁺) and oxidized molybdenite (MoO₄²⁻). Lead molybdate born from the death of both parents.');
    } else {
      parts.push(narrative_variant('wulfenite', 'on_galena') || 'It grew on galena, drawing lead from the same source mineral. A secondary generation claiming the primary mineral as its substrate.');
    }
  }
  const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
  if (lastZone && lastZone.note) {
    if (lastZone.note.includes('honey')) parts.push(narrative_variant('wulfenite', 'color_honey') || 'Honey-orange and translucent — light passes through the plates like stained glass.');
    else if (lastZone.note.includes('red')) parts.push(narrative_variant('wulfenite', 'color_red_cloud') || 'Red-orange from chromium traces — the sought-after "Red Cloud" variety.');
  }
  if (c.twinned) {
    parts.push(narrative_variant('wulfenite', 'twinned', { twin_law: c.twin_law }) || `Penetration twinned (${c.twin_law}) — two plates interpenetrating at right angles, forming a cross or butterfly shape.`);
  }
  if (c.dissolved) parts.push(narrative_variant('wulfenite', 'acid_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_raspite(c) {
  // Prose lives in narratives/raspite.md.
  const parts = [`Raspite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('raspite') || "PbWO₄ — monoclinic lead tungstate, RARE. Same composition as stolzite but a different crystal system; stolzite (tetragonal) is favored ~90% of the time. Honey-yellow tabular crystals with perfect {100} cleavage. Type locality: Broken Hill, NSW, Australia.");
  return parts.filter(p => p).join(' ');
},

  _narrate_stolzite(c) {
  // Prose lives in narratives/stolzite.md.
  const parts = [`Stolzite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('stolzite') || "PbWO₄ — tetragonal lead tungstate, the lead analog of scheelite. Honey-yellow to orange-yellow Mohs 2.5-3 tetragonal crystals; the dominant PbWO₄ polymorph (~90% over raspite). Type locality: Cínovec (Czech Republic). Broken Hill (Australia) and Tsumeb (Namibia) produce museum specimens.");
  if (c.habit === 'dipyramidal') parts.push(narrative_variant('stolzite', 'dipyramidal') || 'Dipyramidal — {101} faces, Broken Hill / Tsumeb display habit.');
  else parts.push(narrative_variant('stolzite', 'tabular_default') || 'Tabular — {001} plates, late-stage habit.');
  return parts.filter(p => p).join(' ');
},

  _narrate_ferrimolybdite(c) {
  // Prose lives in narratives/ferrimolybdite.md. JS narrator added in this
  // commit. Habit strings 'acicular tuft' and 'fibrous mat' have spaces —
  // preserved as-is.
  const parts = [`Ferrimolybdite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('ferrimolybdite'));
  if (c.habit === 'acicular tuft') parts.push(narrative_variant('ferrimolybdite', 'acicular_tuft'));
  else if (c.habit === 'fibrous mat') parts.push(narrative_variant('ferrimolybdite', 'fibrous_mat'));
  else parts.push(narrative_variant('ferrimolybdite', 'powdery_default'));
  if (c.dissolved) parts.push(narrative_variant('ferrimolybdite', 'dehydration'));
  return parts.filter(p => p).join(' ');
},
});
