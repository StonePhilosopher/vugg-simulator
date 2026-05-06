// ============================================================
// js/56-engines-native.ts — native-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/native.py. Minerals (7): native_arsenic, native_bismuth, native_copper, native_gold, native_silver, native_sulfur, native_tellurium.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_native_tellurium(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_tellurium();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.7) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      // Phase 1e: Te credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.native_tellurium.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — Te oxidizing to TeO₃²⁻ tellurite`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  let habit_note;

  if (T > 250 && excess < 1.5) {
    crystal.habit = 'prismatic_hex';
    crystal.dominant_forms = ['{1010} striated prism', '{1011} rhombohedron termination'];
    habit_note = 'prismatic native tellurium — well-formed hexagonal prisms, the Kalgoorlie habit';
  } else if (T < 200) {
    crystal.habit = 'reticulated';
    crystal.dominant_forms = ['filiform mass', 'interconnected wire network'];
    habit_note = 'reticulated native tellurium — low-T filamentous habit';
  } else {
    crystal.habit = 'granular';
    crystal.dominant_forms = ['massive granular', 'tin-white metallic mass'];
    habit_note = 'granular native tellurium — Cripple Creek ore form';
  }

  if (crystal.zones && crystal.zones.length > 6) {
    habit_note += '; tellurite tarnish (TeO₂ surface bloom)';
  } else {
    habit_note += '; tin-white metallic, fresh fracture';
  }

  conditions.fluid.Te = Math.max(conditions.fluid.Te - rate * 0.005, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_native_sulfur(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_sulfur();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.9) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      // Phase 1e: S credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.native_sulfur.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — S oxidizing to SO₄²⁻`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  let habit_note;

  if (excess > 1.5 && T > 60) {
    crystal.habit = 'sublimation_crust';
    crystal.dominant_forms = ['bright yellow encrustation', 'powdery crystalline mass'];
    habit_note = 'sublimation crust — fumarole habit, gas-phase deposition (Bolivian fumarole / Vulcano)';
  } else if (T >= 95) {
    crystal.habit = 'prismatic_beta';
    crystal.dominant_forms = ['β-sulfur monoclinic prism', 'needle-like'];
    habit_note = 'β-sulfur prismatic — RARE high-T monoclinic habit; converts to α on cooling with internal cracking';
  } else {
    crystal.habit = 'bipyramidal_alpha';
    crystal.dominant_forms = ['{111} steep dipyramid', '{113} shallow dipyramid', '{001} pinacoid'];
    habit_note = 'α-sulfur bipyramidal — Sicilian Agrigento habit, the iconic bright-yellow crystals';
  }

  // Synproportionation acidifies the local fluid slightly
  conditions.fluid.pH = Math.max(conditions.fluid.pH - rate * 0.0003, 0.5);
  conditions.fluid.S = Math.max(conditions.fluid.S - rate * 0.02, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_native_arsenic(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_arsenic();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.7) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.10);
      // Phase 1e: As credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.native_arsenic.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — As released as AsO₄³⁻ into fluid`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const bi_present = conditions.fluid.Bi > 5.0;
  const T = conditions.temperature;
  let habit_note;

  if (bi_present && excess > 0.5) {
    crystal.habit = 'arsenolamprite';
    crystal.dominant_forms = ['Bi-rich orthorhombic As', 'lamellar'];
    habit_note = `arsenolamprite — Bi-rich variety (Bi=${conditions.fluid.Bi.toFixed(0)} ppm in fluid)`;
  } else if (excess > 1.5) {
    crystal.habit = 'reniform';
    crystal.dominant_forms = ['botryoidal kidney crust', 'concentric layers'];
    habit_note = 'reniform native arsenic — Akatani botryoidal habit';
  } else if (T > 250 && excess < 0.6) {
    crystal.habit = 'rhombohedral_crystal';
    crystal.dominant_forms = ['{0001} basal pinacoid', '{1011} rhombohedron'];
    habit_note = 'rhombohedral native arsenic — RARE high-T crystal habit';
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular crust', 'tin-white metallic mass'];
    habit_note = 'massive granular native arsenic — Freiberg ore form';
  }

  if (crystal.zones && crystal.zones.length > 8) {
    habit_note += '; arsenolite tarnish (As₂O₃ surface bloom)';
  } else {
    habit_note += '; tin-white metallic, fresh fracture';
  }
  if (conditions.fluid.Sb > 10) {
    habit_note += '; Sb-substituted (As-Sb solid solution, up to ~3% Sb)';
  }

  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.012, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_native_silver(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_silver();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.S > 5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.04);
      const sBefore = conditions.fluid.S;
      // Phase 1e: Ag + S consumption via MINERAL_DISSOLUTION_RATES.native_silver
      // (rates Ag=-0.3, S=-0.4, both clamped at 0). Ag₂S formation pulls
      // both species INTO the solid; the legacy note misread its own
      // arithmetic ("S returned to fluid") — we capture pre-consumption
      // S for the narration since the wrapper credit fires post-return.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `tarnish — Ag + S consumed (S=${sBefore.toFixed(1)} pre); surface skinning to acanthite`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  const is_open_low_T = T < 150;
  const is_high_T_primary = T > 200 && excess < 0.6;

  let habit_note;
  if (is_high_T_primary) {
    crystal.habit = 'cubic_crystal';
    crystal.dominant_forms = ['{100} cube', 'modified by {111}'];
    habit_note = 'cubic native silver — rare hypogene primary crystal habit';
  } else if (is_open_low_T && excess > 1.0) {
    crystal.habit = 'wire';
    crystal.dominant_forms = ['epithermal wire', 'curling thread of metal'];
    habit_note = "wire silver — Kongsberg habit, the collector's prize";
  } else if (excess > 0.6) {
    crystal.habit = 'dendritic';
    crystal.dominant_forms = ['dendritic plates', 'fern-like branches'];
    habit_note = 'dendritic native silver — Cobalt-Ontario fern habit';
  } else {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['hackly massive', 'metallic nugget'];
    habit_note = 'massive native silver — Keweenaw nugget habit';
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  if (crystal.zones && crystal.zones.length > 20) {
    habit_note += '; tarnishing — acanthite rind beginning to form';
  } else {
    habit_note += '; bright silver-white metallic luster';
  }

  conditions.fluid.Ag = Math.max(conditions.fluid.Ag - rate * 0.012, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_native_bismuth(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_bismuth();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      // Phase 1e: Bi credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.native_bismuth.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `oxidation (O₂ ${conditions.fluid.O2.toFixed(1)}) — bismite/bismutite surface forms` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.0) { crystal.habit = 'massive_granular'; crystal.dominant_forms = ['massive granular silver-white']; color_note = 'massive granular native bismuth'; }
  else if (excess > 0.25 && rng.random() < 0.1) { crystal.habit = 'rhombohedral_crystal'; crystal.dominant_forms = ['{0001} basal pinacoid', 'rhombohedral trigonal']; color_note = 'rhombohedral crystal (rare — well-formed in open vug)'; }
  else { crystal.habit = 'arborescent_dendritic'; crystal.dominant_forms = ['arborescent branching', 'dendritic fracture fill']; color_note = 'arborescent native bismuth — silver-white tree-like growth, iridescent tarnish expected'; }
  f.Bi = Math.max(f.Bi - rate * 0.035, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_native_gold(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_gold();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.05) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'nugget';
    crystal.dominant_forms = ['rounded nugget', 'massive native gold'];
    habit_note = 'nugget — rapid precipitation in pocket';
  } else if (excess > 0.5) {
    crystal.habit = 'dendritic';
    crystal.dominant_forms = ['dendritic {111} branching', 'spongy gold'];
    habit_note = 'dendritic / spongy native gold (the fishbone-and-leaf habit of supergene Au)';
  } else {
    crystal.habit = 'octahedral';
    crystal.dominant_forms = ['{111} octahedron', 'rare well-formed crystal'];
    habit_note = 'octahedral well-formed native gold (rare — slow growth)';
  }
  // Alloying note — pick whichever alloying element is dominant.
  if (conditions.fluid.Ag > conditions.fluid.Cu * 0.5 && conditions.fluid.Ag > 5) {
    habit_note += '; Ag-alloyed (electrum, pale yellow tint)';
  } else if (conditions.fluid.Cu > 50) {
    habit_note += '; Cu-alloyed (rose-gold tint, cuproauride affinity)';
  }
  conditions.fluid.Au = Math.max(conditions.fluid.Au - rate * 0.05, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_native_copper(crystal, conditions, step) {
  const sigma = conditions.supersaturation_native_copper();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.7) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      // Phase 1e: Cu credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.native_copper.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `oxidation (O₂ ${conditions.fluid.O2.toFixed(1)}) — forms cuprite film, then malachite if CO₃ is present` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let color_note;
  if (excess > 1.5) { crystal.habit = 'massive_sheet'; crystal.dominant_forms = ['massive sheet copper', 'fills large void']; color_note = 'massive sheet copper (rapid precipitation in open void)'; }
  else if (excess > 0.6) { crystal.habit = 'arborescent_dendritic'; crystal.dominant_forms = ['arborescent branching growth', 'dendritic {100}']; color_note = 'arborescent dendritic — tree-like branching copper'; }
  else if (excess > 0.25) { crystal.habit = 'wire_copper'; crystal.dominant_forms = ['wire growth along narrow channel', 'filamentary Cu']; color_note = 'wire copper — filamentary growth in narrow channel'; }
  else { crystal.habit = 'cubic_dodecahedral'; crystal.dominant_forms = ['{100} cube', '{110} rhombic dodecahedron', 'rare well-formed crystal']; color_note = 'cubic/dodecahedral well-formed native copper (rare)'; }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.04, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}
