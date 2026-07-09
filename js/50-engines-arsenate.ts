// ============================================================
// js/50-engines-arsenate.ts — arsenate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/arsenate.py. Minerals (6): adamite, annabergite, erythrite, mimetite, olivenite, scorodite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_scorodite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_scorodite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && (conditions.fluid.pH > 5.5 || conditions.temperature > 160)) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      // Phase 1e: Fe + As credits via MINERAL_DISSOLUTION_RATES.scorodite.
      const cause = conditions.fluid.pH > 5.5 ? 'pH>5' : 'T>160°C';
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `dissolution (${cause}) — scorodite releases AsO₄³⁻ for downstream arsenates`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'earthy_crust';
    crystal.dominant_forms = ['powdery greenish-brown crust'];
    habit_note = 'earthy greenish-brown scorodite crust on arsenopyrite';
  } else if (excess > 0.5) {
    crystal.habit = 'dipyramidal';
    crystal.dominant_forms = ['pseudo-octahedral dipyramids'];
    habit_note = 'pseudo-octahedral pale blue-green scorodite dipyramids';
  } else {
    crystal.habit = 'dipyramidal';
    crystal.dominant_forms = ['well-formed dipyramids', 'deep blue-green'];
    habit_note = 'well-formed deep blue-green scorodite (Tsumeb-style)';
  }

  if (conditions.fluid.Fe > 30) {
    habit_note += ' (deep blue, Fe-rich)';
  }

  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.005, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.005, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    note: habit_note
  });
}

function grow_pharmacolite(crystal, conditions, step) {
  // CaHAsO₄·2H₂O — monoclinic Ca-only hydrated arsenate. Per
  // research-pharmacolite.md (boss canonical 2026-05). The
  // diagnostic radiating/stellate acicular habit ("starbursts of
  // white needles") is the field marker; this engine builds toward
  // that habit when σ is high and falls back to powdery efflorescent
  // crusts at low σ.
  //
  // Thermal dehydration to haidingerite (CaHAsO₄·H₂O) at >80°C is
  // now handled by DEHYDRATION_TRANSITIONS (js/75-transitions.ts,
  // v90 entry: pharmacolite → haidingerite, threshold 30 steps,
  // T_max 80°C). The v88 inline "thermal destruction" branch that
  // set crystal.dissolved = true at T > 80 has been REMOVED — that
  // was a v88 stub when haidingerite wasn't yet in the catalog; v90
  // adds haidingerite as a transformation-only mineral, and the
  // standard paramorph mechanic preserves the crystal's external
  // habit + position through the transformation (so a "radiating
  // stellate pharmacolite" becomes a "radiating stellate haidingerite
  // pseudomorph after pharmacolite", instead of vanishing). Acid
  // dissolution below pH 4.5 is still the only in-engine destruction
  // path.
  const sigma = conditions.supersaturation_pharmacolite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.2, growth_rate: -1.2,
        dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + HAsO₄²⁻ + H₂O released`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Habit dispatch per research §Habit Selection Logic:
  // "High humidity + slow growth: Acicular/radiating (classic
  // pharmacolite form)" — at moderate σ this is the dominant habit.
  // Higher σ produces denser radiating bundles ("stellate aggregates").
  // Low σ produces powdery/earthy efflorescent crust ("Variant 2
  // Efflorescent Crust: degraded state").
  let habit_note;
  if (excess > 1.0) {
    crystal.habit = 'radiating_stellate';
    crystal.dominant_forms = ['radiating acicular needles', 'stellate aggregate', 'starburst of white needles'];
    habit_note = 'radiating stellate aggregate — the classic Jáchymov/Schneeberg habit';
  } else if (excess > 0.3) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['acicular needles', 'prismatic {010} blades', 'fibrous white'];
    habit_note = 'acicular pharmacolite — radiating bundles, field-common form';
  } else {
    crystal.habit = 'efflorescent_crust';
    crystal.dominant_forms = ['earthy powdery crust', 'thin white coating'];
    habit_note = 'efflorescent crust — low-σ degraded state, the "drying out" form';
  }

  // Color modulation by trace impurities (research §Color &
  // Visual Characteristics)
  const f = conditions.fluid;
  if (f.Fe > 10) habit_note += `; trace Fe (${f.Fe.toFixed(0)} ppm — yellowish tint)`;
  if (f.Mn > 2)  habit_note += `; trace Mn (${f.Mn.toFixed(1)} ppm — pinkish hue)`;
  if (f.Cu > 1)  habit_note += `; trace Cu (${f.Cu.toFixed(1)} ppm — greenish cast)`;

  // Substrate annotation — pharmacolite-classic associations
  const pos = crystal.position || '';
  if (typeof pos === 'string') {
    if (pos.includes('cobaltite')) habit_note += ' — replacing weathered cobaltite (five-element vein paragenesis)';
    else if (pos.includes('arsenopyrite')) habit_note += ' — on weathering arsenopyrite, the As source';
    else if (pos.includes('native_arsenic')) habit_note += ' — on weathering native_arsenic, Ca scavenges As⁵⁺ as oxidation completes';
    else if (pos.includes('erythrite')) habit_note += ' — alongside erythrite (Co-Ca arsenate pair)';
    else if (pos.includes('nickeline')) habit_note += ' — alongside nickeline weathering products';
  }

  // Mass balance: Ca + As consumed
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.020, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.012, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: f.Fe * 0.005,
    trace_Mn: f.Mn * 0.010,
    note: habit_note,
  });
}

function grow_conichalcite(crystal, conditions, step) {
  // CaCu(AsO₄)(OH) — orthorhombic Ca-Cu arsenate. Vivid emerald-green
  // chromophore (Cu²⁺ in octahedral coordination), Mohs 4.5 (harder
  // than olivenite at 3 — the Ca-Cu substitution stiffens the
  // structure). Per research-conichalcite.md (boss canonical 2026-05).
  //
  // Habit dispatch:
  //   high σ (>1.5)        → acicular/prismatic (Tsumeb display)
  //   moderate σ (0.5-1.5) → botryoidal/reniform with radiating fibrous
  //                          interior (the field-common form)
  //   low σ (<0.5)         → drusy_coating (crust on substrate)
  const sigma = conditions.supersaturation_conichalcite();
  if (sigma < 1.0) {
    // Acid dissolution: pH < 4.5 destroys conichalcite (research:
    // "readily dissolves in HCl/HNO₃")
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.0, growth_rate: -1.0,
        dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + Cu²⁺ + AsO₄³⁻ released`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.3 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['radiating acicular needles', 'prismatic {110} clusters', 'emerald-green'];
    habit_note = 'acicular conichalcite — Tsumeb display habit (high-σ)';
  } else if (excess > 0.5) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['botryoidal/reniform mass', 'radiating fibrous interior', 'emerald-to-apple green'];
    habit_note = 'botryoidal conichalcite — field-common habit (mod σ)';
  } else {
    crystal.habit = 'drusy_coating';
    crystal.dominant_forms = ['drusy green coating', 'thin emerald film'];
    habit_note = 'drusy conichalcite — low-σ surface crust';
  }

  // Color modulation by trace Fe (research: "Fe trace-10% shifts color
  // yellowish-green")
  if (conditions.fluid.Fe > 30) {
    const fe_pct = Math.min(20, 100 * conditions.fluid.Fe / (conditions.fluid.Cu + conditions.fluid.Fe + 1));
    if (fe_pct > 5) habit_note += `; Fe-bearing (${fe_pct.toFixed(0)}% Fe — yellowish-green cast, transitional toward austinite)`;
  }
  // Substrate annotation
  const pos = crystal.position || '';
  if (typeof pos === 'string') {
    if (pos.includes('olivenite')) habit_note += ' — coexisting with olivenite (two-shade green vug)';
    else if (pos.includes('scorodite')) habit_note += ' — overgrowing scorodite';
    else if (pos.includes('malachite')) habit_note += ' — alongside malachite (Cu+CO3 vs Cu+As branches)';
    else if (pos.includes('chrysocolla')) habit_note += ' — on chrysocolla matrix';
    else if (pos.includes('native_copper')) habit_note += ' — alongside native copper';
  }

  // Mass balance: Ca, Cu, As all consumed; OH from H2O/pH buffer.
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.020, 0);
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.015, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.010, 0);

  const trace_Fe = conditions.fluid.Fe * 0.010;
  const trace_Zn = conditions.fluid.Zn * 0.008;  // Zn may substitute for Cu (austinite-end)

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Zn,
    note: habit_note,
  });
}

function grow_olivenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_olivenite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'fibrous';
    crystal.dominant_forms = ['radiating acicular fibers', 'olive-green silky'];
    habit_note = 'fibrous olivenite — high-σ silky habit';
  } else if (excess > 0.6) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{110} prism', 'olive-green prisms'];
    habit_note = 'prismatic olivenite — Cornwall display habit';
  } else {
    crystal.habit = 'globular';
    crystal.dominant_forms = ['botryoidal globule', 'olive crust'];
    habit_note = 'globular olivenite — Tsumeb / Bisbee secondary habit';
  }
  if (conditions.fluid.Zn > 10) {
    const zn_pct = Math.min(50, 100 * conditions.fluid.Zn / Math.max(conditions.fluid.Cu + conditions.fluid.Zn, 1));
    if (zn_pct > 10) habit_note += `; Zn-bearing (${zn_pct.toFixed(0)}% Zn — zincolivenite intermediate toward adamite)`;
  }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.010, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_erythrite(crystal, conditions, step) {
  // Thermal dehydration above 200°C
  if (crystal.total_growth_um > 5 && conditions.temperature > 200) {
    crystal.dissolved = true;
    // Phase 1e: Co + As constants via MINERAL_DISSOLUTION_RATES.erythrite.thermal.
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.0, growth_rate: -1.0,
      dissolutionMode: 'thermal',
      note: 'thermal dehydration — Co3(AsO4)2·8H2O loses water, breaks down above 200°C'
    });
  }

  const sigma = conditions.supersaturation_erythrite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      // Phase 1e: Co + As constants via MINERAL_DISSOLUTION_RATES.erythrite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.2, growth_rate: -1.2,
        dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Co²⁺ + AsO₄³⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.7, 1.3);

  const pos = crystal.position || '';
  const on_primary = typeof pos === 'string' && (pos.includes('cobaltite') || pos.includes('skutterudite') || pos.includes('arsenide'));
  if (on_primary) {
    crystal.habit = 'radiating_fibrous';
    crystal.dominant_forms = ['radiating fibrous sprays', 'stellate clusters'];
  } else if (excess > 1.2) {
    crystal.habit = 'bladed_crystal';
    crystal.dominant_forms = ['striated prismatic {010} blades', 'crimson-pink transparent'];
  } else if (excess > 0.5) {
    crystal.habit = 'botryoidal_crust';
    crystal.dominant_forms = ['botryoidal rounded aggregates', 'pink-red crust'];
  } else {
    crystal.habit = 'cobalt_bloom';
    crystal.dominant_forms = ['earthy crimson-pink crust', 'cobalt bloom'];
  }

  const ni_fraction = conditions.fluid.Ni / Math.max(conditions.fluid.Co + conditions.fluid.Ni, 0.01);
  let color_note;
  if (ni_fraction > 0.3) color_note = 'purplish-pink (mixed Co-Ni composition)';
  else if (ni_fraction > 0.1) color_note = 'dusty crimson (trace Ni)';
  else color_note = 'crimson-pink (Co-dominant — cobalt bloom)';

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mn: conditions.fluid.Mn * 0.01,
    note: `${crystal.habit} — ${color_note}`
  });
}

function grow_annabergite(crystal, conditions, step) {
  if (crystal.total_growth_um > 5 && conditions.temperature > 200) {
    crystal.dissolved = true;
    // Phase 1e: Ni + As constants via MINERAL_DISSOLUTION_RATES.annabergite.thermal.
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.0, growth_rate: -1.0,
      dissolutionMode: 'thermal',
      note: 'thermal dehydration — Ni3(AsO4)2·8H2O loses water, breaks down above 200°C'
    });
  }

  const sigma = conditions.supersaturation_annabergite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      // Phase 1e: Ni + As constants via MINERAL_DISSOLUTION_RATES.annabergite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.2, growth_rate: -1.2,
        dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ni²⁺ + AsO₄³⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.7, 1.3);

  const co_fraction = conditions.fluid.Co / Math.max(conditions.fluid.Co + conditions.fluid.Ni, 0.01);
  const mg_fraction = conditions.fluid.Mg / Math.max(conditions.fluid.Mg + conditions.fluid.Ni, 0.01);

  let color_note;
  if (co_fraction > 0.25) {
    crystal.habit = 'co_bearing';
    crystal.dominant_forms = ['pinkish-green intermediate crust'];
    color_note = 'pinkish-green (Co-bearing annabergite, transitioning to erythrite)';
  } else if (mg_fraction > 0.3) {
    crystal.habit = 'cabrerite';
    crystal.dominant_forms = ['pale green to white crust', 'Mg-bearing cabrerite variety'];
    color_note = 'pale green to white (cabrerite — Mg substitution)';
  } else if (excess > 1.5) {
    crystal.habit = 'capillary_crystal';
    crystal.dominant_forms = ['capillary hair-like fibers', 'green silky sprays'];
    color_note = 'bright apple-green capillaries';
  } else {
    crystal.habit = 'nickel_bloom';
    crystal.dominant_forms = ['apple-green earthy crust', 'nickel bloom'];
    color_note = 'apple-green (Ni-dominant — nickel bloom)';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `${crystal.habit} — ${color_note}`
  });
}

function grow_adamite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_adamite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.5) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.12);
      // Phase 1e: Zn + As credits via MINERAL_DISSOLUTION_RATES.adamite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  let rate = 4.0 * (sigma - 1.0) * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  
  const zc = crystal.zones.length;
  if (rate > 6) {
    crystal.habit = 'acicular sprays';
    crystal.dominant_forms = ['radiating fan-shaped sprays'];
  } else if (zc > 15) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['elongated prisms', 'wedge-shaped'];
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['tabular crystals'];
  }
  
  // v225 UV audit: the old ladder had the physics BACKWARDS — it treated
  // Cu as the ACTIVATOR ("no Cu → NON-FLUORESCENT"). Verified 2026-07-09
  // (fluomin; Nature's Rainbows Geiger comparison): the Mapimí lime-green
  // is TRACE-URANYL activated, and Cu²⁺ QUENCHES it — the torbernite-vs-
  // autunite physics. Body colours keep their ladder; the UV claims flip.
  const cuInCrystal = conditions.fluid.Cu * 0.02;
  let colorNote;
  if (cuInCrystal > 0.5) colorNote = 'vivid green (cuproadamite) — Cu²⁺ mutes the UV glow';
  else if (cuInCrystal > 0.1) colorNote = 'green (cuprian) — dimmed under UV';
  else colorNote = 'yellow-green — UV-FLUORESCENT lime-green 💚 (trace uranyl, the Mapimí classic)';

  // Phase 1d: growth debits owned by the wrapper (applyMassBalance).
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.01, trace_Cu: cuInCrystal, note: `${crystal.habit}, ${colorNote}` });
}

function grow_mimetite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_mimetite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(5.0, crystal.total_growth_um * 0.10);
      // Phase 1e: Pb + As + Cl credits via MINERAL_DISSOLUTION_RATES.mimetite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  let rate = 5.0 * (sigma - 1.0) * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  
  const zc = crystal.zones.length;
  const feRatio = conditions.fluid.Fe / Math.max(conditions.fluid.Pb, 1);
  
  if (feRatio > 0.3 && rng.random() < 0.4) {
    crystal.habit = 'campylite (barrel-shaped)';
    crystal.dominant_forms = ['barrel-shaped hexagonal prisms', 'curved faces'];
  } else if (rate > 7) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['thin hexagonal needles'];
  } else if (zc > 10) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['hexagonal prisms'];
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['thick tabular hexagons'];
  }
  
  let colorNote;
  if (feRatio > 0.3) colorNote = 'orange-brown (campylite)';
  else if (conditions.fluid.Pb > 100) colorNote = 'bright yellow-orange';
  else colorNote = 'pale yellow';

  // Phase 1d: growth debits owned by the wrapper (applyMassBalance).
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.02, note: `${crystal.habit}, ${colorNote}` });
}

// v97 (2026-05-19): Tsumeb arsenate suite grow engines.

function grow_austinite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_austinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('conichalcite')) {
    crystal.habit = 'epitactic_on_conichalcite';
    crystal.dominant_forms = ['epitactic overgrowth on conichalcite (same structure type)'];
  } else if (excess > 1.2) {
    crystal.habit = 'powder_puff';
    crystal.dominant_forms = ['radial spray', 'hemispherical "powder-puff" aggregate'];
  } else if (excess > 0.4) {
    crystal.habit = 'acicular_sprays';
    crystal.dominant_forms = ['drusy crusts of acicular crystals'];
  } else {
    crystal.habit = 'bladed';
    crystal.dominant_forms = ['bladed prismatic'];
  }
  const cu_color = (conditions.fluid.Cu > 5) ? 'apple-green (cuprian)' : 'pale yellow-green';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `austinite ${crystal.habit}, ${cu_color}` });
}

function grow_legrandite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_legrandite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    // Dehydration above ~120°C
    if (crystal.total_growth_um > 3 && conditions.temperature > 120) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.08);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'dehydration', note: `dehydration > 120°C (legrandite is the hydrous Zn arsenate; loses structural H2O)` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * (0.8 + rng.random() * 0.4);  // grows fast — the Tsumeb sprays
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('adamite')) {
    crystal.habit = 'on_adamite';
    crystal.dominant_forms = ['acicular spray on adamite substrate'];
  } else if (excess > 1.3) {
    crystal.habit = 'aztec_sun_spray';
    crystal.dominant_forms = ['radiating sprays + fans', 'wedge-shaped prismatic terminations (Tsumeb iconic "Aztec sun")'];
  } else if (excess > 0.5) {
    crystal.habit = 'wedge_prismatic';
    crystal.dominant_forms = ['acicular wedge prisms', 'divergent groups'];
  } else {
    crystal.habit = 'solitary_prismatic';
    crystal.dominant_forms = ['solitary wedge prisms on limonite-coated dolomite'];
  }
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `legrandite ${crystal.habit}, bright canary yellow (Tsumeb iconic)` });
}

function grow_koettigite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_koettigite();
  if (sigma < 1.0) {
    // Dehydration above ~50°C — the 8 H2O is fragile
    if (crystal.total_growth_um > 3 && conditions.temperature > 50) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.12);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'dehydration', note: `dehydration > 50°C (koettigite is a vivianite-group 8-hydrate; loses structural H2O rapidly)` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  if (excess > 1.2) {
    crystal.habit = 'spherulitic';
    crystal.dominant_forms = ['spherulitic radiating bladed', 'vivianite-group rosette'];
  } else if (excess > 0.5) {
    crystal.habit = 'bladed_lath';
    crystal.dominant_forms = ['bladed lath-like along [010]', 'perfect {010} cleavage on flakes'];
  } else {
    crystal.habit = 'drusy_crust';
    crystal.dominant_forms = ['thin drusy crusts in damp seams'];
  }
  // Color from any Co/Ni traces (vivianite-group)
  const tinge = (conditions.fluid.Co > 0.5) ? 'pale pink (cobaltoan tinge)' : 'colorless to very pale peach';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `koettigite ${crystal.habit}, ${tinge}` });
}

function grow_duftite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_duftite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('malachite') || pos.includes('azurite') || pos.includes('mimetite') || pos.includes('cerussite')) {
    crystal.habit = 'botryoidal_crust';
    crystal.dominant_forms = ['olive-green botryoidal crust on Pb-Cu carbonate'];
  } else if (excess > 1.2) {
    crystal.habit = 'spheroidal_aggregate';
    crystal.dominant_forms = ['1-5 mm hemispherical aggregates', 'olive-green'];
  } else if (excess > 0.4) {
    crystal.habit = 'mammillary_crust';
    crystal.dominant_forms = ['mammillary crusts lining vugs'];
  } else {
    crystal.habit = 'drusy_coating';
    crystal.dominant_forms = ['drusy olive-green coating'];
  }
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `duftite ${crystal.habit}, olive-drab green (heavy, SG 6.4 — diagnostic)` });
}

function grow_bayldonite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_bayldonite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.8 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('mimetite') || pos.includes('duftite')) {
    crystal.habit = 'pseudomorph_or_overgrowth';
    crystal.dominant_forms = ['epitactic overgrowth on Pb-As substrate', 'sometimes pseudomorph after mimetite'];
  } else if (excess > 1.2) {
    crystal.habit = 'spheroidal_mammillary';
    crystal.dominant_forms = ['1-10 mm mammillary hemispheres', 'apple-green to yellow-green'];
  } else if (excess > 0.4) {
    crystal.habit = 'botryoidal_druze';
    crystal.dominant_forms = ['botryoidal druses on Pb-Cu oxide matrix'];
  } else {
    crystal.habit = 'powdery_crust';
    crystal.dominant_forms = ['earthy powdery yellow-green coating (Cornwall Penberthy Croft type texture)'];
  }
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `bayldonite ${crystal.habit}, apple-green (paler than duftite, SG 5.7)` });
}
