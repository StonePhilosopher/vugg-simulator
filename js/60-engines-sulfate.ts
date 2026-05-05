// ============================================================
// js/60-engines-sulfate.ts — sulfate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/sulfate.py. Minerals (12): alunite, anglesite, anhydrite, antlerite, barite, brochantite, celestine, chalcanthite, jarosite, mirabilite, selenite, thenardite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_barite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_barite();
  if (sigma < 1.0) return null;  // no acid path; permanent at sim T

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['stubby prisms', 'vein-fill habit'];
    habit_note = 'stubby prismatic barite, vein-fill';
  } else if (excess > 0.8) {
    crystal.habit = 'cockscomb';
    crystal.dominant_forms = ['cyclic twin crests', 'cockscomb'];
    habit_note = 'cockscomb barite — cyclic twins giving the diagnostic crested form';
  } else if (excess > 0.3) {
    crystal.habit = 'bladed';
    crystal.dominant_forms = ['divergent blades', 'Cumberland-style fans'];
    habit_note = 'bladed divergent barite, Cumberland-style';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{001} tabular plates'];
    habit_note = 'tabular barite plates — the desert-rose habit';
  }

  if (conditions.fluid.Sr > 0 && conditions.fluid.Ba > 0) {
    const sr_ratio = conditions.fluid.Sr / Math.max(conditions.fluid.Ba, 0.1);
    if (sr_ratio > 0.25) {
      habit_note += '; Sr-substituted (celestobarite intermediate)';
    }
  }
  if (conditions.fluid.Pb > 5) {
    habit_note += '; honey-yellow (Pb-bearing — Cumberland gold habit)';
  }

  // Phase 1d: Ba/S consumption owned by the wrapper (applyMassBalance).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.002,
    trace_Pb: conditions.fluid.Pb * 0.005,
    note: habit_note
  });
}

function grow_celestine(crystal, conditions, step) {
  const sigma = conditions.supersaturation_celestine();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const sulfur_context = conditions.fluid.S > 200;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'nodular';
    crystal.dominant_forms = ['geodal lining', 'concentric blue crust'];
    habit_note = 'nodular celestine — Madagascar geode lining';
  } else if (sulfur_context && excess > 0.5) {
    crystal.habit = 'fibrous';
    crystal.dominant_forms = ['radiating acicular fibers'];
    habit_note = 'fibrous celestine — Sicilian sulfur-vug habit, radiating from substrate';
  } else if (excess > 0.3) {
    crystal.habit = 'bladed';
    crystal.dominant_forms = ['divergent blue blades'];
    habit_note = 'bladed celestine — Lake Erie / Put-in-Bay habit';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{001} tabular plates', 'pale celestial blue'];
    habit_note = 'tabular pale-blue celestine plates';
  }

  if (conditions.fluid.Mn > 5) {
    habit_note += '; reddish tint (Mn²⁺ trace — rare habit)';
  }
  if (conditions.fluid.Ba > 0 && conditions.fluid.Sr > 0) {
    const ba_ratio = conditions.fluid.Ba / Math.max(conditions.fluid.Sr, 0.1);
    if (ba_ratio > 0.25) {
      habit_note += '; Ba-substituted (barytocelestine intermediate)';
    }
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.001,
    note: habit_note
  });
}

function grow_chalcanthite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chalcanthite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 5.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'stalactitic';
    crystal.dominant_forms = ['sky-blue stalactitic drip', 'blue cone'];
    habit_note = 'stalactitic chalcanthite — Chuquicamata mine-wall habit, sky-blue dripstones';
  } else if (excess > 0.6) {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{110} prismatic', 'Berlin-blue triclinic'];
    habit_note = 'tabular chalcanthite — RARE prismatic blue crystals; most natural specimens are stalactitic';
  } else {
    crystal.habit = 'efflorescent_crust';
    crystal.dominant_forms = ['powdery blue bloom', 'fibrous mass'];
    habit_note = 'efflorescent crust chalcanthite — high-evaporation arid habit';
  }
  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_anhydrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_anhydrite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3
        && conditions.temperature < 55
        && conditions.fluid.salinity < 95) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ca += dissolved_um * 0.5;
      conditions.fluid.S  += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'rehydration to gypsum — anhydrite releases Ca²⁺ + SO₄²⁻ as fluid freshens (salinity < 100‰ at T < 60°C)'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const high_T = conditions.temperature > 200;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular massive layers'];
    habit_note = high_T
      ? 'massive granular anhydrite — Bingham porphyry deep-brine vein habit'
      : 'massive granular anhydrite — the sabkha + salt-mine evaporite habit';
  } else if (excess > 0.8) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['stubby prisms', 'vein-fill'];
    habit_note = 'stubby prismatic anhydrite, vein-fill';
  } else if (excess > 0.3 || conditions.temperature < 50) {
    crystal.habit = 'fibrous';
    crystal.dominant_forms = ['satin spar fibers', 'parallel fibrous'];
    habit_note = 'fibrous satin-spar anhydrite — parallel fibers across vein';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['tabular crystals', 'three perpendicular cleavages'];
    habit_note = 'tabular anhydrite with the diagnostic three perpendicular cleavages';
  }

  if (conditions.fluid.Mn > 3 || (conditions.temperature < 60
                                    && conditions.fluid.salinity > 150)) {
    habit_note += '; pale lavender (angelite variant)';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mn: conditions.fluid.Mn * 0.002,
    note: habit_note
  });
}

function grow_brochantite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_brochantite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && (
      conditions.fluid.pH < 2.8 || conditions.fluid.pH > 7.5
    )) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.12);
      conditions.fluid.Cu += dissolved_um * 0.5;
      conditions.fluid.S  += dissolved_um * 0.3;
      const cause = conditions.fluid.pH < 2.8
        ? 'pH < 3 → antlerite stable'
        : 'pH > 7 → tenorite/malachite stable';
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `dissolution (${cause}) — brochantite releases Cu²⁺ + SO₄²⁻`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'drusy_crust';
    crystal.dominant_forms = ['microcrystalline druse', 'emerald-green coating'];
    habit_note = 'drusy emerald-green brochantite crust on Cu-bearing wall';
  } else if (excess > 0.8) {
    crystal.habit = 'acicular_tuft';
    crystal.dominant_forms = ['radiating acicular needle-tufts'];
    habit_note = 'acicular emerald-green brochantite tufts radiating from substrate';
  } else if (excess > 0.3) {
    crystal.habit = 'short_prismatic';
    crystal.dominant_forms = ['stubby emerald-green prisms'];
    habit_note = 'stubby emerald-green brochantite prisms — the Atacama / Bisbee habit';
  } else {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['globular aggregates'];
    habit_note = 'botryoidal brochantite — globular emerald-green aggregates';
  }

  if (conditions.fluid.Cl > 100) {
    habit_note += '; Cl-rich (would compete with atacamite — Cl-Cu hydroxychloride)';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.001,
    note: habit_note
  });
}

function grow_antlerite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_antlerite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && conditions.fluid.pH > 4.2) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.15);
      conditions.fluid.Cu += dissolved_um * 0.5;
      conditions.fluid.S  += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'dissolution (pH > 3.5 → brochantite stable) — antlerite releases Cu²⁺ + SO₄²⁻'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'granular';
    crystal.dominant_forms = ['massive granular emerald-green'];
    habit_note = 'massive granular antlerite — Chuquicamata habit';
  } else if (excess > 0.8) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['thin needles', 'radiating aggregates'];
    habit_note = 'acicular antlerite — radiating dark-green needles';
  } else if (excess > 0.3) {
    crystal.habit = 'short_prismatic';
    crystal.dominant_forms = ['stubby green prisms'];
    habit_note = 'stubby emerald-green antlerite prisms — visually identical to brochantite, distinguished by acid-resistance test';
  } else {
    crystal.habit = 'druzy';
    crystal.dominant_forms = ['microcrystalline druse'];
    habit_note = 'druzy antlerite microcrystals on dissolving Cu sulfide';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.001,
    note: habit_note
  });
}

function grow_jarosite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_jarosite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && conditions.fluid.pH > 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.15);
      conditions.fluid.K  += dissolved_um * 0.3;
      conditions.fluid.Fe += dissolved_um * 0.5;
      conditions.fluid.S  += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'dissolution (pH > 4) — jarosite releases K + Fe³⁺ + SO₄²⁻; goethite-stable territory now'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'earthy_crust';
    crystal.dominant_forms = ['powdery yellow coating', 'AMD stain'];
    habit_note = 'powdery yellow jarosite crust on weathered sulfide — the diagnostic AMD signature';
  } else if (excess > 0.5) {
    crystal.habit = 'druzy';
    crystal.dominant_forms = ['microcrystalline druse'];
    habit_note = 'druzy jarosite microcrystals — yellow honeycomb on pyrite oxidation surfaces';
  } else {
    crystal.habit = 'pseudocubic';
    crystal.dominant_forms = ['pseudocubic rhombs', 'tabular {0001}'];
    habit_note = 'pseudocubic golden-yellow jarosite rhombs';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    note: habit_note
  });
}

function grow_alunite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_alunite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && (conditions.fluid.pH > 4.5
                                         || conditions.temperature > 350)) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.12);
      conditions.fluid.K  += dissolved_um * 0.3;
      conditions.fluid.Al += dissolved_um * 0.4;
      conditions.fluid.S  += dissolved_um * 0.4;
      const cause = conditions.fluid.pH > 4.5 ? 'pH > 4' : 'T > 350°C';
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `dissolution (${cause}) — alunite releases K + Al³⁺ + SO₄²⁻`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'earthy';
    crystal.dominant_forms = ['chalky white masses', 'feldspar-replacement habit'];
    habit_note = 'earthy alunite — chalky white replacement of feldspathic wall (Marysvale alunite-stone habit)';
  } else if (excess > 0.8) {
    crystal.habit = 'fibrous';
    crystal.dominant_forms = ['radiating fibers', 'vein-fill'];
    habit_note = 'fibrous alunite — vein-fill, radiating from substrate';
  } else if (excess > 0.3) {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['sharp tabular blades'];
    habit_note = 'tabular alunite blades — Goldfield epithermal habit';
  } else {
    crystal.habit = 'pseudocubic';
    crystal.dominant_forms = ['pseudocubic rhombs'];
    habit_note = 'pseudocubic alunite rhombs';
  }

  if (conditions.fluid.Fe > 20) {
    habit_note += '; pinkish (intermediate to jarosite — natroalunite series)';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.002,
    trace_Al: conditions.fluid.Al * 0.005,
    note: habit_note
  });
}

function grow_mirabilite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_mirabilite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.concentration < 1.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(10.0, crystal.total_growth_um * 0.25);
      conditions.fluid.Na += dissolved_um * 0.4;
      conditions.fluid.S += dissolved_um * 0.25;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `meteoric flush — mirabilite redissolves (concentration ${conditions.fluid.concentration.toFixed(1)})`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 12.0 * excess * (0.85 + rng.random() * 0.30);
  if (rate < 0.1) return null;
  if (rate > 10) {
    crystal.habit = 'fibrous_coating';
    crystal.dominant_forms = ['thin efflorescent crust', 'satin sheen'];
  } else {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{010} pinacoid', '{110} prism', 'monoclinic'];
  }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: 'colorless prismatic Glauber salt — vitreous, water-soluble',
  });
}

function grow_thenardite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_thenardite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.concentration < 1.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(8.0, crystal.total_growth_um * 0.20);
      conditions.fluid.Na += dissolved_um * 0.4;
      conditions.fluid.S += dissolved_um * 0.25;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `meteoric flush — thenardite redissolves (concentration ${conditions.fluid.concentration.toFixed(1)})`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 9.0 * excess * (0.85 + rng.random() * 0.30);
  if (rate < 0.1) return null;
  if (rate > 8) {
    crystal.habit = 'fibrous_coating';
    crystal.dominant_forms = ['white efflorescent crust'];
  } else if (crystal.total_growth_um > 5000) {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{010} pinacoid', '{110} prism'];
  } else {
    crystal.habit = 'dipyramidal';
    crystal.dominant_forms = ['orthorhombic dipyramid', '{111} dominant'];
  }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: 'colorless to white thenardite — orthorhombic Na2SO4',
  });
}

function grow_selenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_selenite();

  if (sigma < 1.0) {
    // Selenite dissolves easily in undersaturated conditions
    if (crystal.total_growth_um > 2 && (conditions.fluid.pH < 4 || conditions.temperature > 80)) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.15);
      conditions.fluid.Ca += dissolved_um * 0.4;
      conditions.fluid.S += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `dissolution — selenite dissolves, releasing Ca²⁺ and SO₄²⁻ back to fluid`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.7, 1.3); // selenite grows relatively fast
  if (rate < 0.1) return null;

  // Selenite habit depends on conditions
  if (conditions.temperature < 30 && rate < 3) {
    // Slow, cool growth → large transparent blades ("cathedral" selenite)
    crystal.habit = 'tabular blades';
    crystal.dominant_forms = ['{010} blades', 'transparent'];
    crystal.a_width_mm = crystal.c_length_mm * 0.3; // elongated
  } else if (rate > 8) {
    // Rapid growth → desert rose (sand inclusions) or satin spar
    crystal.habit = rng.random() < 0.5 ? 'fibrous (satin spar)' : 'rosette';
    crystal.dominant_forms = crystal.habit === 'rosette' ? 
      ['desert rose', 'lenticular plates'] : ['fibrous aggregates', 'silky luster'];
  } else {
    // Standard prismatic selenite
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{010} tabular', '{110} prism', '{111} dome'];
  }

  // Ca and S consumption

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  // Fluid inclusions common in fast-growing selenite
  let fi = false, fi_type = '';
  if (rate > 5 && rng.random() < 0.3) {
    fi = true;
    fi_type = rng.random() < 0.5 ? 'primary (trapped brine)' : 'hourglass (sand inclusions)';
  }

  let note;
  if (crystal.habit === 'rosette') {
    note = 'desert rose — lenticular plates with sand inclusions';
  } else if (crystal.habit.includes('fibrous')) {
    note = 'satin spar — fibrous, chatoyant sheen';
  } else if (conditions.temperature < 30 && crystal.total_growth_um > 50) {
    note = 'transparent selenite blade — water-clear, large crystal';
  } else {
    note = `selenite, ${crystal.habit}, Ca: ${conditions.fluid.Ca.toFixed(0)} S: ${conditions.fluid.S.toFixed(0)} ppm`;
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.002,
    trace_Mn: conditions.fluid.Mn * 0.001,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note
  });
}

function grow_anglesite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_anglesite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      conditions.fluid.Pb += d * 0.3;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.CO3 > 150) {
      crystal.dissolved = true;
      const d = Math.min(1.5, crystal.total_growth_um * 0.04);
      conditions.fluid.Pb += d * 0.3;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `anglesite → cerussite (CO₃ ${conditions.fluid.CO3.toFixed(0)} ppm overwhelms)` });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  let color_note;
  if (f.Fe > 3.0) color_note = `yellow-amber tint (Fe ${f.Fe.toFixed(0)} ppm)`;
  else if (f.Cu > 2.0) color_note = `pale blue-green tint (Cu ${f.Cu.toFixed(1)} ppm)`;
  else color_note = "colorless to white, adamantine luster";

  crystal.dominant_forms = ['b{010} pinacoid', 'm{110} prism', 'o{011} orthorhombic dome'];
  const trace_Fe = f.Fe * 0.015;
  const trace_Pb = f.Pb * 0.015;
  f.Pb = Math.max(f.Pb - rate * 0.02, 0);
  f.S = Math.max(f.S - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe, trace_Pb, note: color_note });
}
