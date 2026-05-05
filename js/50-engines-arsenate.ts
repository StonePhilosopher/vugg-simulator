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
      conditions.fluid.Fe += dissolved_um * 0.5;
      conditions.fluid.As += dissolved_um * 0.5;  // AsO4³⁻ for downstream arsenates
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
    conditions.fluid.Co += 0.4;
    conditions.fluid.As += 0.3;
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.0, growth_rate: -1.0,
      note: 'thermal dehydration — Co3(AsO4)2·8H2O loses water, breaks down above 200°C'
    });
  }

  const sigma = conditions.supersaturation_erythrite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      conditions.fluid.Co += 0.6;
      conditions.fluid.As += 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.2, growth_rate: -1.2,
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
    conditions.fluid.Ni += 0.4;
    conditions.fluid.As += 0.3;
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.0, growth_rate: -1.0,
      note: 'thermal dehydration — Ni3(AsO4)2·8H2O loses water, breaks down above 200°C'
    });
  }

  const sigma = conditions.supersaturation_annabergite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      conditions.fluid.Ni += 0.6;
      conditions.fluid.As += 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -1.2, growth_rate: -1.2,
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
      conditions.fluid.Zn += d * 0.5;
      conditions.fluid.As += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  let rate = 4.0 * (sigma - 1.0) * (0.8 + Math.random() * 0.4);
  if (rate < 0.1) return null;
  
  const zc = crystal.zones.length;
  if (rate > 6) {
    crystal.habit = 'acicular sprays';
    crystal.dominant_forms = ['radiating fan-shaped sprays'];
    crystal.a_width_mm = crystal.c_length_mm * 0.15;
  } else if (zc > 15) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['elongated prisms', 'wedge-shaped'];
    crystal.a_width_mm = crystal.c_length_mm * 0.4;
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['tabular crystals'];
    crystal.a_width_mm = crystal.c_length_mm * 0.7;
  }
  
  const cuInCrystal = conditions.fluid.Cu * 0.02;
  let colorNote;
  if (cuInCrystal > 0.5) colorNote = 'vivid green (cuproadamite) — UV-FLUORESCENT 💚';
  else if (cuInCrystal > 0.1) colorNote = 'green — weakly fluorescent';
  else colorNote = 'yellow-green — NON-FLUORESCENT (no Cu)';
  
  // Phase 1d: growth debits owned by the wrapper (applyMassBalance).
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.01, note: `${crystal.habit}, ${colorNote}` });
}

function grow_mimetite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_mimetite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(5.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Pb += d * 0.8;
      conditions.fluid.As += d * 0.3;
      conditions.fluid.Cl += d * 0.1;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  let rate = 5.0 * (sigma - 1.0) * (0.8 + Math.random() * 0.4);
  if (rate < 0.1) return null;
  
  const zc = crystal.zones.length;
  const feRatio = conditions.fluid.Fe / Math.max(conditions.fluid.Pb, 1);
  
  if (feRatio > 0.3 && Math.random() < 0.4) {
    crystal.habit = 'campylite (barrel-shaped)';
    crystal.dominant_forms = ['barrel-shaped hexagonal prisms', 'curved faces'];
    crystal.a_width_mm = crystal.c_length_mm * 0.6;
  } else if (rate > 7) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['thin hexagonal needles'];
    crystal.a_width_mm = crystal.c_length_mm * 0.15;
  } else if (zc > 10) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['hexagonal prisms'];
    crystal.a_width_mm = crystal.c_length_mm * 0.4;
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['thick tabular hexagons'];
    crystal.a_width_mm = crystal.c_length_mm * 0.8;
  }
  
  let colorNote;
  if (feRatio > 0.3) colorNote = 'orange-brown (campylite)';
  else if (conditions.fluid.Pb > 100) colorNote = 'bright yellow-orange';
  else colorNote = 'pale yellow';
  
  // Phase 1d: growth debits owned by the wrapper (applyMassBalance).
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.02, note: `${crystal.habit}, ${colorNote}` });
}
