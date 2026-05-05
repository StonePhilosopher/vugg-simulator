// ============================================================
// js/61-engines-sulfide.ts — sulfide-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/sulfide.py. Minerals (20): acanthite, argentite, arsenopyrite, bismuthinite, bornite, chalcocite, chalcopyrite, cobaltite, covellite, galena, marcasite, millerite, molybdenite, nickeline, pyrite, sphalerite, stibnite, tennantite, tetrahedrite, wurtzite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_sphalerite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_sphalerite();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.7, 1.3);

  const Fe_mol_percent = Math.min(conditions.fluid.Fe * 0.1 * (conditions.temperature / 300.0), 30.0);
  const trace_Fe = Fe_mol_percent * 10;

  crystal.habit = 'tetrahedral';
  crystal.dominant_forms = ['{111} tetrahedron'];

  let color_note;
  if (Fe_mol_percent > 15) color_note = 'black (marmatite — high Fe)';
  else if (Fe_mol_percent > 8) color_note = 'dark brown';
  else if (Fe_mol_percent > 3) color_note = 'honey/amber';
  else color_note = 'pale yellow (cleiophane — gem quality)';

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe,
    note: `color: ${color_note}, Fe: ${Fe_mol_percent.toFixed(1)} mol%`
  });
}

function grow_wurtzite(crystal, conditions, step) {
  // Polymorphic inversion on cooling below 95°C
  if (crystal.total_growth_um > 10 && conditions.temperature <= 95) {
    crystal.dissolved = true;
    conditions.fluid.Zn += 1.5;
    conditions.fluid.S += 1.2;
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.5, growth_rate: -1.5,
      note: 'polymorphic inversion — T dropped below 95°C, hexagonal (Zn,Fe)S converting to cubic sphalerite'
    });
  }

  const sigma = conditions.supersaturation_wurtzite();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 5.5 * excess * rng.uniform(0.7, 1.3);

  const Fe_mol_percent = Math.min(conditions.fluid.Fe * 0.12 * (conditions.temperature / 300.0), 35.0);
  const trace_Fe = Fe_mol_percent * 10;

  if (excess > 1.5) {
    crystal.habit = 'fibrous_coating';
    crystal.dominant_forms = ['fibrous crust', '{0001} parallel columns'];
  } else if (excess > 0.8) {
    crystal.habit = 'radiating_columnar';
    crystal.dominant_forms = ['radiating hexagonal columns', 'stellate aggregates'];
  } else if (excess > 0.3) {
    crystal.habit = 'hemimorphic_crystal';
    crystal.dominant_forms = ['hemimorphic hexagonal pyramid', '{0001} + {101̄1}'];
  } else {
    crystal.habit = 'platy_massive';
    crystal.dominant_forms = ['{0001} tabular plate', 'micaceous'];
  }

  let color_note;
  if (Fe_mol_percent > 15) color_note = 'black metallic (Fe-rich wurtzite)';
  else if (Fe_mol_percent > 5) color_note = 'brownish-black';
  else color_note = 'yellowish-brown to dark brown';

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe,
    note: `hemimorphic hexagonal (Zn,Fe)S — ${color_note}, Fe: ${Fe_mol_percent.toFixed(1)} mol%`
  });
}

function grow_pyrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_pyrite();

  if (sigma < 1.0) {
    // Check for oxidation/dissolution
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.1);
      // RECYCLING: Fe and S return to fluid
      conditions.fluid.Fe += dissolved_um * 1.0;
      conditions.fluid.S += dissolved_um * 0.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidizing — pyrite weathering to goethite/limonite, Fe²⁺ released to fluid'
      });
    }
    // Also dissolves in strong acid
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      conditions.fluid.Fe += 2.0;
      conditions.fluid.S += 1.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Fe + S released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.7, 1.3);

  if (conditions.temperature > 300) {
    crystal.habit = 'cubic';
    crystal.dominant_forms = ['{100} cube'];
  } else if (conditions.temperature > 200) {
    crystal.habit = 'pyritohedral';
    crystal.dominant_forms = ['{210} pyritohedron'];
  } else if (conditions.temperature > 100) {
    crystal.habit = 'cubo-pyritohedral';
    crystal.dominant_forms = ['{100} + {210}'];
  } else {
    if (excess > 1.0) {
      crystal.habit = 'framboidal';
      crystal.dominant_forms = ['framboidal aggregate'];
    } else {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube, microcrystalline'];
    }
  }

  let trace_note = 'brassy yellow metallic luster';
  if (conditions.fluid.Cu > 20) {
    trace_note += ', Cu traces (may exsolve chalcopyrite inclusions)';
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.15,
    note: trace_note
  });
}

function grow_marcasite(crystal, conditions, step) {
  // Metastable inversion to pyrite if pH rises above 5 or T exceeds 240
  if (crystal.total_growth_um > 10 && (conditions.fluid.pH >= 5.0 || conditions.temperature > 240)) {
    crystal.dissolved = true;
    conditions.fluid.Fe += 1.5;
    conditions.fluid.S += 1.2;
    const trigger = conditions.fluid.pH >= 5.0 ? 'pH rose above 5' : 'T exceeded 240°C';
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.5, growth_rate: -1.5,
      note: `metastable inversion — ${trigger}, orthorhombic FeS2 converting to pyrite`
    });
  }

  const sigma = conditions.supersaturation_marcasite();

  if (sigma < 1.0) {
    // Oxidative breakdown — the classic museum rot
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Fe += dissolved_um * 1.0;
      conditions.fluid.S += dissolved_um * 0.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative breakdown — FeS2 + O2 + H2O → FeSO4 + H2SO4 (the museum rot)'
      });
    }
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 1.5) {
      crystal.dissolved = true;
      conditions.fluid.Fe += 2.0;
      conditions.fluid.S += 1.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        note: `extreme-acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  if (excess > 1.5 && conditions.temperature < 100) {
    crystal.habit = 'radiating_blade';
    crystal.dominant_forms = ['radiating blades', 'fibrous stellate clusters'];
  } else if (excess > 0.8) {
    crystal.habit = 'cockscomb';
    crystal.dominant_forms = ['cockscomb aggregate', 'crested tabular {010}'];
  } else if (excess > 0.3) {
    crystal.habit = 'spearhead';
    crystal.dominant_forms = ['spearhead twins', 'pyramidal terminations'];
  } else {
    crystal.habit = 'tabular_plate';
    crystal.dominant_forms = ['{010} tabular plate'];
  }

  let trace_note = 'pale brass-yellow metallic, tarnishing iridescent';
  if (conditions.fluid.pH < 3.5) {
    trace_note += ' (strong acid — extra-rapid cockscomb growth)';
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.15,
    note: trace_note
  });
}

function grow_chalcopyrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chalcopyrite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.1);
      // RECYCLING: Cu, Fe, S return to fluid
      conditions.fluid.Cu += dissolved_um * 0.8;
      conditions.fluid.Fe += dissolved_um * 0.5;
      conditions.fluid.S += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidizing — chalcopyrite weathering, Cu²⁺ + Fe²⁺ released (→ malachite/azurite at surface)'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  crystal.habit = 'disphenoidal';
  crystal.dominant_forms = ['{112} disphenoid', '{012}'];

  let color_note;
  if (conditions.temperature < 100) {
    color_note = 'brassy yellow, may develop iridescent tarnish';
  } else {
    color_note = 'brassy yellow, metallic';
  }

  const trace_Cu = conditions.fluid.Cu * 0.1;

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.1,
    note: `${color_note}, Cu: ${trace_Cu.toFixed(1)} ppm incorporated`
  });
}

function grow_molybdenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_molybdenite();
  if (sigma < 1.0) {
    // Oxidation: MoS₂ + 3.5O₂ → MoO₄²⁻ + SO₄²⁻ (releases Mo back to fluid)
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.3) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.15);
      conditions.fluid.Mo += dissolved_um * 0.8; // MoO₄²⁻ back to fluid
      conditions.fluid.S += dissolved_um * 0.2;  // some S returns as sulfate
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidation — molybdenite dissolves, releasing MoO₄²⁻ (Mo fluid: ${conditions.fluid.Mo.toFixed(0)} ppm)`
      });
    }
    return null;
  }

  let rate = 0.008 * sigma * 1000 * rng.uniform(0.8, 1.2); // slow growth — rare mineral
  if (conditions.temperature >= 300 && conditions.temperature <= 500) {
    rate *= 1.3;
  }
  if (rate < 0.1) return null;

  crystal.habit = 'hexagonal platy';
  crystal.dominant_forms = ['{0001} basal pinacoid', '{10-10} prism'];

  // Mo and S consumption

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.002,
    note: `bluish-gray metallic, platy habit, Mo fluid: ${conditions.fluid.Mo.toFixed(0)} ppm`
  });
}

function grow_galena(crystal, conditions, step) {
  const sigma = conditions.supersaturation_galena();
  if (sigma < 1.0) return null;

  let rate = 0.015 * sigma * 1000 * rng.uniform(0.8, 1.2); // scale to µm
  // Faster at 200-400°C
  if (conditions.temperature >= 200 && conditions.temperature <= 400) {
    rate *= 1.2;
  }
  if (rate < 0.1) return null;

  crystal.habit = 'cubic';
  crystal.dominant_forms = ['{100} cube', '{111} octahedron'];

  // Pb and S consumption

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let color_note = 'lead-gray, bright metallic luster';
  if (conditions.fluid.Ag > 5) {
    color_note += ', possible Ag inclusions';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    note: `${color_note}, Pb fluid: ${conditions.fluid.Pb.toFixed(0)} ppm`
  });
}

function grow_arsenopyrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_arsenopyrite();

  if (sigma < 1.0) {
    // Oxidation-dissolution: arsenopyrite + O₂ + H₂O →
    //   Fe³⁺ + AsO₄³⁻ + H₂SO₄. Releases trapped Au back to fluid.
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Fe += dissolved_um * 0.5;
      conditions.fluid.As += dissolved_um * 0.4;
      conditions.fluid.S += dissolved_um * 0.4;
      conditions.fluid.pH = Math.max(2.0, conditions.fluid.pH - dissolved_um * 0.02);
      // Release 12% of zone-summed trapped invisible-gold per step.
      const total_trapped_au = (crystal.zones || []).reduce((sum, z) => sum + (z.trace_Au || 0), 0);
      const released_au = total_trapped_au * 0.12;
      if (released_au > 0) {
        conditions.fluid.Au += released_au;
      }
      let note_str = 'oxidation — arsenopyrite → Fe³⁺ + AsO₄³⁻ + H₂SO₄';
      if (released_au > 0.005) {
        note_str += ` (releases ${released_au.toFixed(3)} ppm trapped Au — supergene enrichment)`;
      }
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: note_str
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 2.0) {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular masses', 'metallic silver-white'];
    habit_note = 'granular massive arsenopyrite';
  } else if (excess > 1.2) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['thin needles', 'acicular aggregates'];
    habit_note = 'acicular arsenopyrite needles';
  } else if (excess > 0.4) {
    crystal.habit = 'rhombic_blade';
    crystal.dominant_forms = ['flattened rhombic blades'];
    habit_note = 'rhombic-bladed arsenopyrite';
  } else {
    crystal.habit = 'striated_prism';
    crystal.dominant_forms = ['{110} striated prisms', 'diamond cross-section'];
    habit_note = 'striated prismatic arsenopyrite with diamond cross-section';
  }

  // Au-trapping — invisible-gold mechanic. 5% per step, 30% of trap rate
  // actually leaves the fluid (rest is reversibly partitioned). Cap at
  // 1.5 ppm per zone.
  let au_trap_ppm = 0.0;
  if (conditions.fluid.Au > 0.01) {
    au_trap_ppm = Math.min(conditions.fluid.Au * 0.05, 1.5);
    conditions.fluid.Au = Math.max(conditions.fluid.Au - au_trap_ppm * 0.3, 0);
    if (au_trap_ppm > 0.02) {
      habit_note += `; traps invisible-Au (${au_trap_ppm.toFixed(3)} ppm)`;
    }
  }

  if (conditions.fluid.Co > 2) {
    habit_note += ' (Co-bearing, pinkish tinge)';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.003,
    trace_Au: au_trap_ppm,
    note: habit_note
  });
}

function grow_acanthite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_acanthite();

  if (sigma < 1.0) {
    // Oxidative dissolution — strong O2 puts Ag back in solution (supergene
    // enrichment mechanism, Boyle 1968).
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.2) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ag += dissolved_um * 0.4;
      conditions.fluid.S = Math.max(conditions.fluid.S - dissolved_um * 0.1, 0);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — Ag⁺ released to solution`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'thorn';
    crystal.dominant_forms = ['spiky prismatic projections', 'thorn-like aggregates'];
    habit_note = "thorn-habit acanthite — the species' diagnostic";
  } else if (excess > 0.6) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['elongated {110} prism', 'distorted pseudo-orthorhombic'];
    habit_note = 'prismatic acanthite — primary low-T growth';
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular vein filling', 'disseminated'];
    habit_note = 'massive granular acanthite — economic ore form';
  }

  if (crystal.zones && crystal.zones.length > 15) {
    habit_note += '; tarnished to iron-black';
  } else {
    habit_note += '; lead-gray metallic';
  }


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_argentite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_argentite();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'arborescent';
    crystal.dominant_forms = ['dendritic Ag₂S branches', 'wire-like aggregates'];
    habit_note = 'arborescent argentite — dendritic high-σ growth';
  } else if (excess > 0.8) {
    crystal.habit = 'octahedral';
    crystal.dominant_forms = ['{111} octahedron', 'modified by {100}'];
    habit_note = 'octahedral argentite — rarer high-T habit';
  } else {
    crystal.habit = 'cubic';
    crystal.dominant_forms = ['{100} cube', 'sharp isometric form'];
    habit_note = 'cubic argentite — Comstock Lode habit';
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).


  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_nickeline(crystal, conditions, step) {
  const sigma = conditions.supersaturation_nickeline();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.10);
      conditions.fluid.Ni += dissolved_um * 0.4;
      conditions.fluid.As += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — Ni²⁺ + AsO₄³⁻ to fluid; downstream annabergite forming`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'reniform';
    crystal.dominant_forms = ['botryoidal copper-red crust', 'concentric layers'];
    habit_note = 'reniform nickeline — Cobalt-Ontario botryoidal habit';
  } else if (excess > 0.6) {
    crystal.habit = 'columnar';
    crystal.dominant_forms = ['{0001} columnar', 'vertical aggregate'];
    habit_note = 'columnar nickeline — vertical hexagonal stacks';
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular massive', 'pale copper-red metallic'];
    habit_note = 'massive granular nickeline — primary ore form';
  }
  if (crystal.zones && crystal.zones.length > 12) habit_note += '; tarnished to darker copper-rose';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_millerite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_millerite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ni += dissolved_um * 0.4;
      conditions.fluid.S += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — Ni²⁺ released to fluid`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0) {
    crystal.habit = 'capillary';
    crystal.dominant_forms = ['hair-fine acicular needle', 'radiating spray'];
    habit_note = 'capillary millerite — Halls Gap geode habit, hair-thin brass-yellow needles';
  } else if (excess > 0.4) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['thin prismatic needle', 'diverging cluster'];
    habit_note = 'acicular millerite — slender brass-yellow prisms';
  } else {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['massive granular', 'brass-yellow metallic'];
    habit_note = 'massive millerite — granular ore form';
  }
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_cobaltite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_cobaltite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.7) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.10);
      conditions.fluid.Co += dissolved_um * 0.4;
      conditions.fluid.As += dissolved_um * 0.4;
      conditions.fluid.S = Math.max(conditions.fluid.S - dissolved_um * 0.1, 0);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative dissolution (O₂=${conditions.fluid.O2.toFixed(2)}) — Co²⁺ + AsO₄³⁻ to fluid; erythrite forming downstream`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'reniform';
    crystal.dominant_forms = ['botryoidal crust', 'concentric'];
    habit_note = 'reniform cobaltite — high-σ botryoidal habit';
  } else if (excess > 0.5) {
    crystal.habit = 'pyritohedral';
    crystal.dominant_forms = ['{210} pyritohedron', 'striated faces'];
    habit_note = 'pyritohedral cobaltite — Cobalt Ontario diagnostic habit';
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['granular', 'tin-white-with-pink-blush'];
    habit_note = 'massive granular cobaltite — Tunaberg ore form';
  }
  if (conditions.fluid.Fe > 100) habit_note += '; Fe-rich (glaucodot series — (Co,Fe)AsS)';
  if (crystal.zones && crystal.zones.length > 10) habit_note += '; pinkish-blush surface tarnish (Co oxide skin)';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_stibnite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_stibnite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      conditions.fluid.Sb += d * 0.3;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.2) { crystal.habit = 'massive_granular'; crystal.dominant_forms = ['massive granular aggregate']; color_note = 'lead-gray massive granular stibnite'; }
  else if (excess > 0.5) { crystal.habit = 'radiating_spray'; crystal.dominant_forms = ['radiating bladed spray', 'sword-blade aggregate']; color_note = 'radiating spray of steel-gray blades'; }
  else { crystal.habit = 'elongated_prism_blade'; crystal.dominant_forms = ['elongated {110} prism', 'sword-blade terminations', 'brilliant metallic luster']; color_note = 'elongated sword-blade — the Ichinokawa habit (lead-gray metallic)'; }
  f.Sb = Math.max(f.Sb - rate * 0.025, 0);
  f.S = Math.max(f.S - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_bismuthinite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_bismuthinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      conditions.fluid.Bi += d * 0.3;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  const T = conditions.temperature;
  let color_note;
  if (T > 350) { crystal.habit = 'stout_prismatic'; crystal.dominant_forms = ['stout {110} prism', 'tin-white metallic']; color_note = `stout prismatic bismuthinite (high-T form, T=${T.toFixed(0)}°C)`; }
  else if (excess > 1.0) { crystal.habit = 'radiating_cluster'; crystal.dominant_forms = ['radiating cluster', 'needle bundle']; color_note = 'radiating cluster of fine bismuthinite needles'; }
  else { crystal.habit = 'acicular_needle'; crystal.dominant_forms = ['acicular {110} needles', 'lead-gray with iridescent tarnish']; color_note = `acicular needles (low-T form, T=${T.toFixed(0)}°C) — iridescent tarnish develops`; }
  f.Bi = Math.max(f.Bi - rate * 0.030, 0);
  f.S = Math.max(f.S - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_bornite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_bornite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.3) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.08);
      conditions.fluid.Cu += d * 0.4;
      conditions.fluid.Fe += d * 0.2;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `oxidative dissolution (O₂ ${conditions.fluid.O2.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  const T = conditions.temperature;
  let color_note;
  if (T > 228) { crystal.habit = 'pseudo_cubic'; crystal.dominant_forms = ['pseudo-cubic {100}', 'disordered high-T form']; color_note = `bronze fresh (high-T disordered Cu/Fe, T=${T.toFixed(0)}°C)`; }
  else if (T > 80) { crystal.habit = 'massive_granular'; crystal.dominant_forms = ['massive granular', 'low-T orthorhombic, ordered Cu/Fe']; color_note = `bronze fresh (ordered low-T form, T=${T.toFixed(0)}°C)`; }
  else { crystal.habit = 'peacock_iridescent'; crystal.dominant_forms = ['peacock tarnish on ordered bornite', 'thin-film iridescence']; color_note = `peacock iridescent tarnish (Cu²⁺ surface products, T=${T.toFixed(0)}°C)`; }
  const trace_Fe = f.Fe * 0.02;
  f.Cu = Math.max(f.Cu - rate * 0.03, 0);
  f.Fe = Math.max(f.Fe - rate * 0.008, 0);
  f.S = Math.max(f.S - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe, note: color_note });
}

function grow_chalcocite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chalcocite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Cu += d * 0.5;
      conditions.fluid.S += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `oxidative dissolution (O₂ ${conditions.fluid.O2.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
  let color_note;
  if (crystal.twinned && (crystal.twin_law || '').includes('sixling')) {
    crystal.habit = 'stellate_sixling';
    crystal.dominant_forms = ['pseudo-hexagonal sixling twin', 'dark gray metallic'];
    color_note = 'pseudo-hexagonal sixling twin — the collector habit';
  } else if ((crystal.position || '').includes('chalcopyrite') || (crystal.position || '').includes('bornite')) {
    crystal.habit = 'pseudomorph';
    crystal.dominant_forms = ['pseudomorph after host — inherits outline', 'Cu-enriched replacement'];
    color_note = 'pseudomorphic — replaced host atom-by-atom (Cu enrichment blanket)';
  } else if (excess > 1.2) {
    crystal.habit = 'sooty_massive';
    crystal.dominant_forms = ['sooty microcrystalline aggregate', 'supergene enrichment blanket'];
    color_note = 'sooty microcrystalline black (rapid enrichment precipitation)';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{110} prism', 'tabular habit'];
    color_note = 'dark gray metallic tabular';
  }
  f.Cu = Math.max(f.Cu - rate * 0.04, 0);
  f.S = Math.max(f.S - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_covellite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_covellite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.2) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Cu += d * 0.4;
      conditions.fluid.S += d * 0.4;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `oxidative dissolution (O₂ ${conditions.fluid.O2.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.0) { crystal.habit = 'rosette_radiating'; crystal.dominant_forms = ['radiating hexagonal plates', 'rosette']; color_note = 'indigo-blue radiating rosette'; }
  else if (f.O2 > 0.5 && f.O2 < 1.2) { crystal.habit = 'iridescent_coating'; crystal.dominant_forms = ['iridescent cleavage {0001}', 'purple-green thin-film interference']; color_note = `indigo-blue with iridescent purple-green tarnish (near oxidation boundary, O₂ ${f.O2.toFixed(1)})`; }
  else { crystal.habit = 'hex_plate'; crystal.dominant_forms = ['{0001} hexagonal basal plate', 'perfect basal cleavage — peels like mica']; color_note = 'indigo-blue hexagonal plate — the only common blue mineral'; }
  f.Cu = Math.max(f.Cu - rate * 0.03, 0);
  f.S = Math.max(f.S - rate * 0.03, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_tetrahedrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_tetrahedrite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.1);
      conditions.fluid.Cu += dissolved_um * 0.6;
      conditions.fluid.Sb += dissolved_um * 0.3;
      conditions.fluid.S += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative dissolution — Cu²⁺ + Sb³⁺ released (feeds secondary Sb oxides)'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  const on_wall = typeof crystal.position === 'string' && (crystal.position.includes('wall') || crystal.position.includes('fracture'));
  if (excess > 1.2) {
    if (on_wall) {
      crystal.habit = 'crustiform';
      crystal.dominant_forms = ['crustiform banded crust', 'fracture-wall coating'];
    } else {
      crystal.habit = 'druzy_coating';
      crystal.dominant_forms = ['fine-grained drusy surface', 'sparkling steel-gray'];
    }
  } else if (excess > 0.6) {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['massive granular', 'steel-gray metallic'];
  } else {
    crystal.habit = 'tetrahedral';
    crystal.dominant_forms = ['{111} tetrahedron', 'classic steel-gray tetrahedra'];
  }

  let ag_note = '';
  if (conditions.fluid.Ag > 10) ag_note = ', Ag-rich (freibergite — Ag as ore)';

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.05,
    note: `${crystal.habit} Cu12Sb4S13 — steel-gray metallic${ag_note}`
  });
}

function grow_tennantite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_tennantite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.1);
      conditions.fluid.Cu += dissolved_um * 0.6;
      conditions.fluid.As += dissolved_um * 0.3;
      conditions.fluid.S += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative dissolution — Cu²⁺ + AsO₄³⁻ released (feeds secondary arsenates: adamite, erythrite, etc.)'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  const on_wall = typeof crystal.position === 'string' && (crystal.position.includes('wall') || crystal.position.includes('fracture'));
  if (excess > 1.2) {
    if (on_wall) {
      crystal.habit = 'crustiform';
      crystal.dominant_forms = ['crustiform banded crust', 'gray-black fracture coating'];
    } else {
      crystal.habit = 'druzy_coating';
      crystal.dominant_forms = ['fine-grained drusy surface', 'sparkling gray-black'];
    }
  } else if (excess > 0.6) {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['massive granular', 'gray-black compact'];
  } else {
    crystal.habit = 'tetrahedral';
    crystal.dominant_forms = ['{111} tetrahedron', 'gray-black tetrahedra with cherry-red thin-edge transmission'];
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.05,
    note: `${crystal.habit} Cu12As4S13 — gray-black metallic, cherry-red transmission in thin fragments`
  });
}
