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
  // Prose lives in narratives/wulfenite.md, including acid dissolution.
  // Standardized opening to mm-pattern; the "collector's prize" line
  // is folded into the merged blurb.
  const parts = [`Wulfenite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('wulfenite'));
  if (c.position.includes('galena')) {
    const oxidized = c.position.includes('oxidized');
    if (oxidized) {
      // (2026-06-10 review §2.4: wulfenite does NOT require discrete
      // molybdenite — Red Cloud and Mežica have none; Mo commonly arrives
      // as trace Mo in galena or the wallrock.)
      parts.push(narrative_variant('wulfenite', 'on_oxidized_galena'));
    } else {
      parts.push(narrative_variant('wulfenite', 'on_galena'));
    }
  }
  const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
  if (lastZone && lastZone.note) {
    if (lastZone.note.includes('honey')) parts.push(narrative_variant('wulfenite', 'color_honey'));
    else if (lastZone.note.includes('red')) parts.push(narrative_variant('wulfenite', 'color_red_cloud'));
  }
  if (c.twinned) {
    parts.push(narrative_variant('wulfenite', 'twinned', { twin_law: c.twin_law }));
  }
  if (c.dissolved) parts.push(narrative_variant('wulfenite', 'acid_dissolution'));
  return parts.filter(p => p).join(' ');
},

  _narrate_raspite(c) {
  // Prose lives in narratives/raspite.md.
  const parts = [`Raspite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('raspite'));
  return parts.filter(p => p).join(' ');
},

  _narrate_stolzite(c) {
  // Prose lives in narratives/stolzite.md.
  const parts = [`Stolzite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
  parts.push(narrative_blurb('stolzite'));
  if (c.habit === 'dipyramidal') parts.push(narrative_variant('stolzite', 'dipyramidal'));
  else parts.push(narrative_variant('stolzite', 'tabular_default'));
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

  // v64 brief-19 narrators.
  _narrate_scheelite(c) {
    const parts = [`Scheelite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    // (2026-06-10 review §2.4: UV prospecting is a 1930s–WWII development —
    // portable UV lamps didn't exist in the 19th century.)
    parts.push('CaWO₄ — calcium tungstate, scheelite-group lattice. The brilliant blue-white SW UV fluorescence is diagnostic — from the 1930s through the Second World War, prospectors swept hillsides with portable UV lamps at night hunting tungsten for tool steel. Forms in granitic-intrusion-related W-Sn skarns; loses to wolframite when Ca is depleted and Fe+Mn dominate.');
    if (c.habit === 'tabular') parts.push('Tabular flat plates — moderate σ habit.');
    else if (c.habit === 'octahedral_pseudo') parts.push('Pseudo-octahedron — looks cubic but is tetragonal. Low-σ habit.');
    if (c.zones.length) {
      const last = c.zones[c.zones.length - 1].note || '';
      if (last.includes('Mo-bearing')) parts.push('Mo-bearing — fluorescence shifts toward yellow as the lattice trades W for Mo (gradational toward powellite).');
    }
    if (c.dissolved) parts.push('Slow acid dissolution — scheelite is mostly inert outside strong acid.');
    return parts.join(' ');
  },

  _narrate_powellite(c) {
    const parts = [`Powellite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('CaMoO₄ — Mo end-member of the powellite-scheelite solid-solution series. Same lattice, different chromophore: bright yellow under SW UV vs scheelite\'s blue. Forms in supergene oxidation of molybdenite — MoS₂ + O₂ → MoO₄²⁻, Ca steps in, and powellite plates as thin yellow tablets.');
    if (c.habit === 'pulverulent_crust') parts.push('Yellow crusty supergene coating — the typical Bingham Canyon habit.');
    else if (c.habit === 'tabular_thin_001') parts.push('Paper-thin {001} tablet with adamantine luster.');
    if (c.position && c.position.includes('molybdenite')) parts.push('Grew on weathered molybdenite — direct supergene successor.');
    if (c.dissolved) parts.push('Acid dissolution — powellite is more soluble than scheelite.');
    return parts.join(' ');
  },

  _narrate_wolframite(c) {
    const parts = [`Wolframite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('(Fe,Mn)WO₄ — Fe-Mn tungstate, monoclinic blade (NOT scheelite-group). Specific gravity 7.0–7.5 — three times denser than quartz, the field diagnostic. Refractory; chemically resistant. Non-fluorescent — diagnostic distinction from scheelite under SW UV.');
    if (c.zones.length) {
      const last = c.zones[c.zones.length - 1].note || '';
      if (last.includes('hübnerite')) parts.push('Mn-rich end of the series (hübnerite) — reddish-brown, more transparent.');
      else if (last.includes('ferberite')) parts.push('Fe-rich end (ferberite) — black, opaque.');
    }
    if (c.position && c.position.includes('quartz')) parts.push('Grew on quartz — Panasqueira-style W-Sn vein assemblage.');
    if (c.dissolved) parts.push('Slow supergene oxidation — altering toward tungstite WO₃·H₂O.');
    return parts.join(' ');
  },
});
