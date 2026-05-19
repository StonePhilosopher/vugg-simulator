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
    // Phase 1e: Zn + S constants via MINERAL_DISSOLUTION_RATES.wurtzite.inversion.
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.5, growth_rate: -1.5,
      dissolutionMode: 'inversion',
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
      // Phase 1e: Fe + S credits via MINERAL_DISSOLUTION_RATES.pyrite.oxidative.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        dissolutionMode: 'oxidative',
        note: 'oxidizing — pyrite weathering to goethite/limonite, Fe²⁺ released to fluid'
      });
    }
    // Also dissolves in strong acid
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      // Phase 1e: Fe + S constants via MINERAL_DISSOLUTION_RATES.pyrite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        dissolutionMode: 'acid',
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
    // Phase 1e: Fe + S constants via MINERAL_DISSOLUTION_RATES.marcasite.inversion.
    const trigger = conditions.fluid.pH >= 5.0 ? 'pH rose above 5' : 'T exceeded 240°C';
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -1.5, growth_rate: -1.5,
      dissolutionMode: 'inversion',
      note: `metastable inversion — ${trigger}, orthorhombic FeS2 converting to pyrite`
    });
  }

  const sigma = conditions.supersaturation_marcasite();

  if (sigma < 1.0) {
    // Oxidative breakdown — the classic museum rot
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.12);
      // Phase 1e: Fe + S credits via MINERAL_DISSOLUTION_RATES.marcasite.oxidative.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        dissolutionMode: 'oxidative',
        note: 'oxidative breakdown — FeS2 + O2 + H2O → FeSO4 + H2SO4 (the museum rot)'
      });
    }
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 1.5) {
      crystal.dissolved = true;
      // Phase 1e: Fe + S constants via MINERAL_DISSOLUTION_RATES.marcasite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        dissolutionMode: 'acid',
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
      // Phase 1e: Cu + Fe + S credits via MINERAL_DISSOLUTION_RATES.chalcopyrite.
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
      // Phase 1e: Mo + S credits via MINERAL_DISSOLUTION_RATES.molybdenite.
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
      // Phase 1e: Fe + As + S credits via MINERAL_DISSOLUTION_RATES.arsenopyrite.
      // pH stays inline — it's an activity adjustment, not a mass-balance credit.
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
      // Phase 1e: Ag credit + S consumption via MINERAL_DISSOLUTION_RATES.acanthite (rate S=-0.1, clamped).
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
      // Phase 1e: Ni + As credits via MINERAL_DISSOLUTION_RATES.nickeline.
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
      // Phase 1e: Ni + S credits via MINERAL_DISSOLUTION_RATES.millerite.
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
      // Phase 1e: Co + As credits + S consumption via MINERAL_DISSOLUTION_RATES.cobaltite (rate S=-0.1, clamped).
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
      // Phase 1e: Sb + S credits via MINERAL_DISSOLUTION_RATES.stibnite.
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

// Realgar (AsS) — α-realgar, monoclinic arsenic sulfide. Orange-red,
// low-T hot-spring + epithermal. Habit dispatcher:
//   T 100-180°C, high excess  → sublimation_crust_red (fumarole vent)
//   excess > 1.2              → granular_orange (massive aggregate)
//   else                      → prismatic_red (the iconic Allchar /
//                                Shimen elongated prism)
//
// Acid-resistant (no acid dissolution branch); only strong alkali
// (pH > 9.5) destabilizes it. The dissolution branch fires only at
// high pH where AsS → AsS₃³⁻ + H₂S.
function grow_realgar(crystal, conditions, step) {
  const sigma = conditions.supersaturation_realgar();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH > 9.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d,
        note: `alkaline dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — thioarsenite complex forms`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const T = conditions.temperature;
  let color_note;
  if (T >= 100 && excess > 1.5) {
    crystal.habit = 'sublimation_crust_red';
    crystal.dominant_forms = ['fumarole sublimation crust', 'orange-red vent coating'];
    color_note = `orange-red sublimation crust — Yellowstone Norris Geyser Basin habit (T=${T.toFixed(0)}°C)`;
  } else if (excess > 1.2) {
    crystal.habit = 'granular_orange';
    crystal.dominant_forms = ['granular massive aggregate', 'vermillion ore'];
    color_note = 'orange-red granular massive realgar — Shimen ore-grade habit';
  } else {
    crystal.habit = 'prismatic_red';
    crystal.dominant_forms = ['elongated {110} prism', 'orange-red resinous crystal'];
    color_note = `orange-red prismatic realgar — Allchar habit (T=${T.toFixed(0)}°C)`;
  }
  // Growth-zone As + S debit handled by applyMassBalance via
  // MINERAL_STOICHIOMETRY.realgar = { As: 1, S: 1 }.
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: color_note,
  });
}

// Orpiment (As₂S₃) — golden-yellow monoclinic arsenic sulfide.
// Co-deposits with realgar but slightly higher T sweet spot + needs
// more S relative to As. Habit dispatcher:
//   excess > 1.5            → granular_yellow (massive aggregate)
//   low σ + steady          → columnar_yellow (Getchell habit)
//   default                 → foliated_golden (the iconic gilded plates)
function grow_orpiment(crystal, conditions, step) {
  const sigma = conditions.supersaturation_orpiment();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH > 9.8) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d,
        note: `alkaline dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — thioarsenite AsS₃³⁻ complex forms`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let color_note;
  if (excess > 1.5) {
    crystal.habit = 'granular_yellow';
    crystal.dominant_forms = ['granular massive aggregate', 'golden-yellow ore'];
    color_note = 'golden-yellow granular massive orpiment — high-σ ore habit';
  } else if (excess < 0.6) {
    crystal.habit = 'columnar_yellow';
    crystal.dominant_forms = ['columnar {010} crystal', 'pearly cleavage'];
    color_note = 'columnar orpiment with pearly cleavage — Getchell habit (low σ, steady growth)';
  } else {
    crystal.habit = 'foliated_golden';
    crystal.dominant_forms = ['{010} foliated plates', 'gilded book-form'];
    color_note = 'foliated golden plates — the iconic aurum-pigmentum habit';
  }
  // Growth-zone As + S debit handled by applyMassBalance via
  // MINERAL_STOICHIOMETRY.orpiment = { As: 2, S: 3 }.
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: color_note,
  });
}

// Cinnabar (HgS) — mercury sulfide. Hot-spring deposit (Sulphur Bank
// + Almadén + Idria type) + co-product in Sicilian sedimentary
// native_sulfur. Habit dispatcher:
//   T < 100°C, low excess  → rhombohedral_cochineal (the iconic deep-
//                            red rhombs, Sulphur Bank specimens).
//   higher excess          → massive_red (vermillion massive aggregate).
//
// Acid-tolerant: cinnabar is unusual among sulfides in surviving low
// pH essentially indefinitely (the reason it persists in oxidation
// zones — aqua regia required to dissolve it). Dissolution branch
// fires only at very high O2 (fully oxic) where HgS → Hg vapor + SO4.
function grow_cinnabar(crystal, conditions, step) {
  const sigma = conditions.supersaturation_cinnabar();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.3) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d,
        note: `oxidative sublimation (O₂=${conditions.fluid.O2.toFixed(2)}) — Hg° vapor released, S → SO₄²⁻`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  const T = conditions.temperature;
  let color_note;
  if (excess > 1.5) {
    crystal.habit = 'massive_red';
    crystal.dominant_forms = ['vermillion massive aggregate', 'granular red ore'];
    color_note = 'vermillion massive cinnabar — the dragon\'s-blood pigment habit';
  } else if (T < 100) {
    crystal.habit = 'rhombohedral_cochineal';
    crystal.dominant_forms = ['rhombohedral crystal', 'deep cochineal-red euhedron'];
    color_note = `cochineal-red rhombohedron — the Sulphur Bank / Almadén habit (T=${T.toFixed(0)}°C)`;
  } else {
    crystal.habit = 'rhombohedral_cochineal';
    crystal.dominant_forms = ['stout rhombohedron', 'red trigonal prism'];
    color_note = `red rhombohedral cinnabar (T=${T.toFixed(0)}°C)`;
  }
  // Growth-zone Hg + S debit handled by applyMassBalance via
  // MINERAL_STOICHIOMETRY.cinnabar = { Hg: 1, S: 1 }. The wrapper
  // applies the scaled debit (MASS_BALANCE_SCALE × thickness ×
  // stoich) at runtime — no inline f.Hg / f.S decrements needed.
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: color_note,
  });
}

function grow_bismuthinite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_bismuthinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      // Phase 1e: Bi + S credits via MINERAL_DISSOLUTION_RATES.bismuthinite.
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
      // Phase 1e: Cu + Fe + S credits via MINERAL_DISSOLUTION_RATES.bornite.
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
      // Phase 1e: Cu + S credits via MINERAL_DISSOLUTION_RATES.chalcocite.
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
      // Phase 1e: Cu + S credits via MINERAL_DISSOLUTION_RATES.covellite.
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
      // Phase 1e: Cu + Sb + S credits via MINERAL_DISSOLUTION_RATES.tetrahedrite.
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

// v95 (2026-05-19): Diarsenide quartet engines. All share the
// arsenide-class growth pattern: As-As bonded pairs in marcasite-type
// structure (Pnnm) for safflorite/rammelsbergite/loellingite; cubic
// Im-3m for skutterudite's triarsenide. Habit dispatch encodes the
// rim-zonation paragenesis from Kissin (1992) + Markl et al. (2016):
// Ni-rich rammelsbergite cores → Co-rich skutterudite/safflorite
// mantles → Fe-rich loellingite outermost rims as fluid evolves.

function _grow_arsenide_common(crystal, conditions, sigma, rate, mineral) {
  // Shared mass-balance: As(III) consumed; specific cation per mineral.
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.030, 0);
  if (mineral === 'skutterudite') {
    conditions.fluid.Co = Math.max(conditions.fluid.Co - rate * 0.015, 0);
    if (conditions.fluid.Ni > 0) conditions.fluid.Ni = Math.max(conditions.fluid.Ni - rate * 0.005, 0);
  } else if (mineral === 'safflorite') {
    conditions.fluid.Co = Math.max(conditions.fluid.Co - rate * 0.020, 0);
    if (conditions.fluid.Fe > 0) conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.005, 0);
  } else if (mineral === 'rammelsbergite') {
    conditions.fluid.Ni = Math.max(conditions.fluid.Ni - rate * 0.020, 0);
  } else if (mineral === 'loellingite') {
    conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.025, 0);
  }
}

function grow_skutterudite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_skutterudite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — Co²⁺ + AsO₄³⁻ released; feeds erythrite (Co) / annabergite (Ni) supergene bloom`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  // Habit dispatch: cubic / cubo-octahedral / pyritohedral. Markl
  // chemistry shows skutterudite as core in Cobalt rosettes when grown
  // directly on native Bi-Ag.
  const pos = crystal.position || '';
  if (pos.includes('native_bismuth') || pos.includes('native_silver')) {
    crystal.habit = 'rosette_core';
    crystal.dominant_forms = ['cubo-octahedral core on native Bi-Ag seed', 'iridescent tarnish'];
  } else if (excess > 1.0) {
    crystal.habit = 'cubic';
    crystal.dominant_forms = ['{100} cube', 'iridescent black tarnish'];
  } else if (excess > 0.5) {
    crystal.habit = 'cubo_octahedral';
    crystal.dominant_forms = ['{100} cube + {111} octahedron', 'silver-tin-white'];
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['massive granular ("smaltite" variety)'];
  }
  _grow_arsenide_common(crystal, conditions, sigma, rate, 'skutterudite');
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `skutterudite (Co,Ni,Fe)As₃ — ${crystal.habit}, deepest+hottest arsenide, X_As ~0.97 (Markl 2016)`
  });
}

function grow_safflorite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_safflorite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — Co²⁺ + AsO₄³⁻ released; feeds erythrite crimson bloom`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  // Habit dispatch: pseudo-orthorhombic prisms, star fivelings on {011},
  // mantles on rammelsbergite/skutterudite cores.
  const pos = crystal.position || '';
  const on_arsenide_core = pos.includes('rammelsbergite') || pos.includes('skutterudite');
  if (on_arsenide_core) {
    crystal.habit = 'mantle';
    crystal.dominant_forms = ['silvery thick rim on Ni-rich core', 'Cobalt-Ontario rosette mantle'];
  } else if (excess > 1.4 && rng.random() < 0.30) {
    crystal.habit = 'star_fiveling';
    crystal.dominant_forms = ['five-pointed star twin on {011}', 'tin-white prismatic'];
    crystal.twinned = true;
    crystal.twin_law = '{011} (star fiveling)';
  } else if (excess > 0.6) {
    crystal.habit = 'pseudo_orthorhombic_prism';
    crystal.dominant_forms = ['elongate [010] prisms', '{101}+{310} faces, pseudo-tetragonal outline'];
  } else {
    crystal.habit = 'radial_fibrous';
    crystal.dominant_forms = ['spherical-radiating bowtie', 'silvery anisotropic'];
  }
  _grow_arsenide_common(crystal, conditions, sigma, rate, 'safflorite');
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `safflorite (Co,Fe)As₂ — ${crystal.habit}, Co-sink phase, X_Co up to 0.76 (Markl Odenwald)`
  });
}

function grow_rammelsbergite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_rammelsbergite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — Ni²⁺ + AsO₄³⁻ released; feeds annabergite apple-green bloom`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  // Habit dispatch: prismatic [010], commonly massive/fibrous/acicular.
  // Innermost arsenide in zoned crystals when Ni dominates.
  if (excess > 1.0) {
    crystal.habit = 'acicular_spray';
    crystal.dominant_forms = ['radiating prismatic [010]', 'pinkish-white tin tint'];
  } else if (excess > 0.5) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{010} prism', 'pinkish-white anisotropic'];
  } else {
    crystal.habit = 'massive_radial';
    crystal.dominant_forms = ['massive fibrous-radiating', 'pink-white tint'];
  }
  _grow_arsenide_common(crystal, conditions, sigma, rate, 'rammelsbergite');
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `rammelsbergite NiAs₂ — ${crystal.habit}, Ni-dominant, pinkish tin-white (the only quartet member with pink cast)`
  });
}

function grow_loellingite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_loellingite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — Fe²⁺ + AsO₄³⁻ released; feeds scorodite (pale-green Fe-arsenate). NO erythrite/annabergite signature (Fe-only).`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  // Habit dispatch: prismatic [001] WITH LONGITUDINAL STRIATIONS (the
  // diagnostic — striations deeper + more regular than arsenopyrite).
  // Outermost arsenide rim in five-element vein zonation.
  const pos = crystal.position || '';
  const on_arsenide = pos.includes('skutterudite') || pos.includes('safflorite') || pos.includes('rammelsbergite');
  if (on_arsenide) {
    crystal.habit = 'outermost_rim';
    crystal.dominant_forms = ['steel-gray rim on Co-Ni arsenide core', 'oscillatory zoning with arsenopyrite possible'];
  } else if (excess > 1.4) {
    crystal.habit = 'striated_prism';
    crystal.dominant_forms = ['{001} prism with deep longitudinal striations', 'steel-gray, doubly terminated'];
  } else if (excess > 0.6) {
    crystal.habit = 'radial_spray';
    crystal.dominant_forms = ['radial divergent sprays', 'steel-gray pyramidal'];
  } else {
    crystal.habit = 'massive_dense';
    crystal.dominant_forms = ['"dense loellingite" massive ore', 'steel-gray'];
  }
  _grow_arsenide_common(crystal, conditions, sigma, rate, 'loellingite');
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `loellingite FeAs₂ — ${crystal.habit}, Fe-dominant, steel-gray (the only non-silver quartet member). Below fS₂ boundary; if S rises, flips to arsenopyrite.`
  });
}

// v96 (2026-05-19): Ruby silvers grow engines. The As:Sb fork in
// supersaturation guarantees that each crystal grows from a fluid
// where its chromophore dominates; this means the supergene products
// distinguish cleanly (native_silver + scorodite for proustite,
// native_silver + cervantite/stibiconite for pyrargyrite).
// Photodecomposition flag carried via crystal._light_sensitive — not
// runtime-applied in v96 but available for future LIGHT_TRANSITIONS
// integration (the pararealgar/proustite-pyrargyrite mechanic family).

function grow_proustite(crystal, conditions, step) {
  // Ag3AsS3 — scarlet trigonal R3c scalenohedra. Habit dispatch:
  // acute_scalenohedral (Jachymov classic), acute_prismatic, massive,
  // reniform_crust (late vug fillings).
  const sigma = conditions.supersaturation_proustite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 8 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.09);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — releases Ag (50% native Ag + 50% acanthite by mol) + AsO₄³⁻ (→ scorodite if Fe present, else arsenolite)`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  crystal._light_sensitive = true;  // photodecomposes — keep in dark
  if (excess > 1.4) {
    crystal.habit = 'acute_scalenohedral';
    crystal.dominant_forms = ['{0221} acute scalenohedron', 'cm-scale Jáchymov / Chañarcillo habit'];
  } else if (excess > 0.6) {
    crystal.habit = 'acute_prismatic';
    crystal.dominant_forms = ['{1010} acute prism', 'rhombohedral termination'];
  } else if (excess > 0.2) {
    crystal.habit = 'reniform_crust';
    crystal.dominant_forms = ['scarlet reniform coating', 'late vug filling'];
  } else {
    crystal.habit = 'massive_disseminated';
    crystal.dominant_forms = ['massive granular vermilion'];
  }
  conditions.fluid.Ag = Math.max(conditions.fluid.Ag - rate * 0.020, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.008, 0);
  conditions.fluid.S  = Math.max(conditions.fluid.S  - rate * 0.020, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `proustite Ag₃AsS₃ — ${crystal.habit}, scarlet light-ruby-silver; photodecomposes to acanthite + As residue if exposed`
  });
}

function grow_pyrargyrite(crystal, conditions, step) {
  // Ag3SbS3 — cherry-red trigonal scalenohedra/prisms. Slightly larger
  // typical crystals than proustite (Andreasberg / San Cristobal 5 cm+).
  // Less photo-sensitive than proustite but still keep dark.
  const sigma = conditions.supersaturation_pyrargyrite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 8 && conditions.fluid.O2 > 0.8) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.09);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — releases Ag (50% native + 50% acanthite) + Sb (→ cervantite/stibiconite Sb oxides)`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.8 * excess * rng.uniform(0.7, 1.3);  // slightly faster — pyrargyrite typically larger
  if (rate < 0.1) return null;
  crystal._light_sensitive = true;
  if (excess > 1.4) {
    crystal.habit = 'large_prismatic_hemimorphic';
    crystal.dominant_forms = ['hemimorphic prism (different terminations)', 'Andreasberg classic'];
  } else if (excess > 0.6) {
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = ['{0221} scalenohedron', 'rhombohedral termination'];
  } else if (excess > 0.2) {
    crystal.habit = 'massive_xenomorphic';
    crystal.dominant_forms = ['cherry-red to red-black mass', 'vein selvages'];
  } else {
    crystal.habit = 'compact_granular';
    crystal.dominant_forms = ['compact masses in vein gangue'];
  }
  conditions.fluid.Ag = Math.max(conditions.fluid.Ag - rate * 0.020, 0);
  if (conditions.fluid.Sb !== undefined) conditions.fluid.Sb = Math.max(conditions.fluid.Sb - rate * 0.008, 0);
  conditions.fluid.S  = Math.max(conditions.fluid.S  - rate * 0.020, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `pyrargyrite Ag₃SbS₃ — ${crystal.habit}, cherry-red dark-ruby-silver; photodecomposes slowly to acanthite + Sb residue`
  });
}

function grow_enargite(crystal, conditions, step) {
  // Cu₃AsS₄ — orthorhombic high-sulfidation Cu-As-S sulfosalt. Steel-gray
  // to iron-black with bright metallic luster on fresh fracture. Perfect
  // {110} prismatic cleavage. Characteristic c-axis striations on prisms.
  // Below ~320°C the same composition forms luzonite (tetragonal); the
  // engine flags this regime via _polymorph for narrative. Per research
  // dossier 2026-05; Einaudi/Hedenquist/Inan 2003.
  const sigma = conditions.supersaturation_enargite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution — Cu²⁺ + AsO₄³⁻ + SO₄²⁻ + H⁺ released (the big AMD As budget; brochantite/scorodite supergene cascade follows)`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;

  // Polymorph dispatch: enargite > 320°C, luzonite < 320°C (Posfai &
  // Buseck 1998). Same composition, different symmetry.
  const polymorph = conditions.temperature >= 320 ? 'enargite' : 'luzonite';
  crystal._polymorph = polymorph;
  if (polymorph === 'luzonite') crystal.mineral_display = 'luzonite';

  // Habit dispatch. Striated prismatic at moderate σ is the textbook
  // form (Butte / Quiruvilca); 60° trillings at high σ; tabular at low σ;
  // bladed in some deposits.
  if (excess > 1.4 && rng.random() < 0.30) {
    crystal.habit = 'pseudo_hexagonal_trilling';
    crystal.dominant_forms = ['60° trilling on {320}', 'striated prismatic faces', 'pseudo-hexagonal outline'];
    crystal.twinned = true;
    crystal.twin_law = '{320}';
  } else if (excess > 0.8) {
    crystal.habit = 'striated_prismatic';
    crystal.dominant_forms = ['{110} prism', 'c-axis striations', 'elongate [001]'];
  } else if (excess > 0.3) {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{001} tabular', 'iron-black metallic'];
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['compact massive ore', 'steel-gray metallic'];
  }
  const note = (polymorph === 'luzonite'
    ? `luzonite (tetragonal < 320°C polymorph) — Cu₃AsS₄, ${crystal.habit}; will not invert to enargite kinetically at low T`
    : `enargite (orthorhombic > 320°C) — Cu₃AsS₄, ${crystal.habit}; high-sulfidation primary Cu (S=${conditions.fluid.S.toFixed(0)}, pH=${conditions.fluid.pH.toFixed(1)})`);

  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.030, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.010, 0);
  conditions.fluid.S = Math.max(conditions.fluid.S - rate * 0.040, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.02,
    trace_Sb: conditions.fluid.Sb * 0.05,  // famatinite-end substitution
    note
  });
}

function grow_tennantite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_tennantite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.1);
      // Phase 1e: Cu + As + S credits via MINERAL_DISSOLUTION_RATES.tennantite.
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


// ============================================================
// v63 brief-19: telluride / selenide / Cd-sulfide group (7 minerals)
// ============================================================

// AuTe2 — incommensurately modulated monoclinic gold telluride.
function grow_calaverite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_calaverite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.temperature > 450) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.15);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'thermal decomposition >450C — AuTe2 -> Au0 + Te vapor (native gold liberates)',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 1.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  if (conditions.temperature > 280) {
    crystal.habit = 'bladed_striated_prism';
    crystal.dominant_forms = ['slender bladed prism, longitudinally striated'];
  } else {
    crystal.habit = 'granular_massive';
    crystal.dominant_forms = ['granular AuTe2 aggregate'];
  }
  let color_note = 'brass-yellow calaverite';
  if (conditions.fluid.Ag > 1) color_note = 'silver-white calaverite (Ag-bearing — gradational toward sylvanite)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Au: conditions.fluid.Au * 0.05,
    trace_Te: conditions.fluid.Te * 0.02,
    note: color_note,
  });
}

// (Au,Ag)Te2 — Au-Ag telluride. Photosensitive — cosmetic darkening with light exposure.
function grow_sylvanite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_sylvanite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.temperature > 400) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.15);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'thermal decomposition >400C — sylvanite -> Au + Ag-telluride species',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 1.6 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  if (sigma > 1.8) {
    crystal.habit = 'bladed_graphic';
    crystal.dominant_forms = ['intergrown bladed crystals (graphic-tellurium pattern)'];
  } else {
    crystal.habit = 'tabular_striated';
    crystal.dominant_forms = ['striated tabular plate'];
  }
  let color_note = 'silver-white sylvanite (photosensitive — darkens with light exposure)';
  if (conditions.fluid.Au / Math.max(conditions.fluid.Ag, 0.1) > 1.5) color_note = 'brass-yellow Au-rich sylvanite (gradational toward calaverite)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Au: conditions.fluid.Au * 0.03,
    trace_Ag: conditions.fluid.Ag * 0.02,
    trace_Te: conditions.fluid.Te * 0.02,
    note: color_note,
  });
}

// Ag2Te — silver telluride. Phase transition at 155C (cubic <-> monoclinic).
function grow_hessite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_hessite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative dissolution — Ag leaches, Te oxidizes to tellurite',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 2.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (conditions.temperature > 155) {
    crystal.habit = 'cubic_high_T';
    crystal.dominant_forms = ['cubic Ag2Te (high-T phase)'];
  } else {
    crystal.habit = 'monoclinic_low_T_lamellae';
    crystal.dominant_forms = ['monoclinic with phase-transformation lamellae from cubic-monoclinic transition'];
  }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Ag: conditions.fluid.Ag * 0.04,
    trace_Te: conditions.fluid.Te * 0.02,
    note: 'lead-gray hessite Ag2Te',
  });
}

// Ag2Se — silver selenide. Phase transition at 133C (orthorhombic <-> cubic).
function grow_naumannite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_naumannite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative dissolution — Ag leaches, Se oxidizes to selenite',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 1.8 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (conditions.temperature > 133) {
    crystal.habit = 'cubic_high_T';
    crystal.dominant_forms = ['cubic Ag2Se (high-T phase, ionic conductivity 2 S/cm)'];
  } else {
    crystal.habit = 'orthorhombic_low_T';
    crystal.dominant_forms = ['orthorhombic Ag2Se (low-T phase)'];
  }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Ag: conditions.fluid.Ag * 0.04,
    trace_Se: conditions.fluid.Se * 0.02,
    note: 'iron-gray naumannite Ag2Se',
  });
}

// PbSe — galena-structure lead selenide.
function grow_clausthalite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_clausthalite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidative dissolution — Pb leaches, Se oxidizes',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 2.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (conditions.temperature > 300 && conditions.fluid.S > 5) {
    crystal.habit = 'exsolution_lamellae_in_galena';
    crystal.dominant_forms = ['lamellar exsolution from PbS-PbSe SS (cooling below 300C)'];
  } else if (sigma > 1.8) {
    crystal.habit = 'cubic_galena_structure';
    crystal.dominant_forms = ['small lead-gray cube'];
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['disseminated grain'];
  }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Pb: conditions.fluid.Pb * 0.02,
    trace_Se: conditions.fluid.Se * 0.02,
    note: 'lead-gray clausthalite PbSe',
  });
}

// CdS hexagonal — high-T polymorph (>200C kinetic favorability).
function grow_greenockite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_greenockite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.12);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidation — CdS -> Cd2+ + SO4 2-, otavite (CdCO3) may follow',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 2.5) {
    crystal.habit = 'powdery_coating';
    crystal.dominant_forms = ['bright yellow earthy dust on sphalerite'];
  } else if (sigma > 1.5) {
    crystal.habit = 'colloform_crust';
    crystal.dominant_forms = ['encrusting colloform aggregate'];
  } else {
    crystal.habit = 'hexagonal_pyramidal';
    crystal.dominant_forms = ['hemimorphic six-sided pyramid'];
  }
  let color_note = 'honey-yellow to citron CdS — adamantine luster';
  if (conditions.fluid.Zn > 100) color_note = 'paler yellow greenockite (Zn-substituted; fluoresces yellow under LW UV)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Cd: conditions.fluid.Cd * 0.05,
    trace_Zn: conditions.fluid.Zn * 0.005,
    note: color_note,
  });
}

// CdS cubic — low-T polymorph. Always powdery (no discrete crystals known).
function grow_hawleyite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_hawleyite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.12);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidation — CdS -> Cd2+ + SO4 2-',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 4.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  crystal.habit = 'powdery_coating';
  crystal.dominant_forms = ['cadmium-yellow earthy dust (no discrete crystals known)'];
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Cd: conditions.fluid.Cd * 0.05,
    note: 'cadmium-yellow hawleyite (cubic CdS, low-T metastable polymorph)',
  });
}
