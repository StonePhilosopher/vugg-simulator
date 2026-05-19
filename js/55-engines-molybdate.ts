// ============================================================
// js/55-engines-molybdate.ts — molybdate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/molybdate.py. Minerals (4): ferrimolybdite, raspite, stolzite, wulfenite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_wulfenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_wulfenite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.10);
      // Phase 1e: Pb + Mo credits handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.wulfenite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution — wulfenite dissolves, releasing Pb²⁺ and MoO₄²⁻`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 3.5 * excess * rng.uniform(0.8, 1.2); // slower growth — rare mineral
  if (rate < 0.1) return null;

  crystal.habit = 'tabular';
  crystal.dominant_forms = ['{001} tabular plates', 'square outline'];

  // Aspect ratio: very flat plates
  // Phase 1d: Pb/Mo consumption owned by the wrapper (applyMassBalance).

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let color_note;
  if (conditions.fluid.Cr > 5) {
    color_note = 'red-orange (Cr impurity)';
  } else if (rate > 5) {
    color_note = 'honey-yellow, translucent';
  } else {
    color_note = rng.random() < 0.5 ? 'orange tabular plates' : 'honey-orange, vitreous luster';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    note: `${color_note}, Pb: ${conditions.fluid.Pb.toFixed(0)} Mo: ${conditions.fluid.Mo.toFixed(0)} ppm`
  });
}

function grow_ferrimolybdite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_ferrimolybdite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 2 && (conditions.fluid.pH < 2 || conditions.temperature > 150)) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.5, crystal.total_growth_um * 0.18);
      // Phase 1e: Fe + Mo credits handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.ferrimolybdite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'dehydration — ferrimolybdite crumbles, releasing Fe³⁺ + MoO₄²⁻'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.8, 1.2); // fast growth — the defining trait
  if (rate < 0.1) return null;

  // Habit by σ excess:
  //   very high σ → powdery crust (mass accretion, no crystal form)
  //   high σ → fibrous mat (felted yellow aggregate)
  //   moderate σ → acicular tufts (classic radiating hair habit)
  let habit_note;
  if (excess > 2.0) {
    crystal.habit = 'powdery crust';
    crystal.dominant_forms = ['earthy yellow powder', 'sulfur-yellow coating'];
    habit_note = 'canary-yellow powdery crust on molybdenite';
  } else if (excess > 0.8) {
    crystal.habit = 'fibrous mat';
    crystal.dominant_forms = ['dense fibrous mats', 'yellow felted aggregate'];
    habit_note = 'fibrous mat of yellow ferrimolybdite';
  } else {
    crystal.habit = 'acicular tuft';
    crystal.dominant_forms = ['radiating acicular tufts', 'hair-like fibers'];
    habit_note = 'acicular radiating tufts of canary-yellow ferrimolybdite';
  }

  conditions.fluid.Mo = Math.max(conditions.fluid.Mo - rate * 0.003, 0);
  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.004, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: habit_note
  });
}

function grow_raspite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_raspite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 1.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  crystal.habit = 'tabular_monoclinic';
  crystal.dominant_forms = ['monoclinic tabular plate', 'honey-yellow'];
  const habit_note = 'raspite — RARE monoclinic PbWO₄, Broken Hill habit';
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb - rate * 0.005, 0);
  conditions.fluid.W  = Math.max(conditions.fluid.W  - rate * 0.020, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_stolzite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_stolzite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0) {
    crystal.habit = 'dipyramidal';
    crystal.dominant_forms = ['{101} dipyramid', 'tetragonal honey-yellow'];
    habit_note = 'dipyramidal stolzite — Broken Hill / Tsumeb display habit';
  } else {
    crystal.habit = 'tabular_tetragonal';
    crystal.dominant_forms = ['{001} tabular plate', 'tetragonal honey-yellow'];
    habit_note = 'tabular stolzite — late-stage low-σ habit';
  }
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb - rate * 0.005, 0);
  conditions.fluid.W  = Math.max(conditions.fluid.W  - rate * 0.020, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

// v63 brief-19: scheelite CaWO4 — Ca tungstate, scheelite-group lattice.
// Bright blue-white SW UV is the diagnostic; non-fluorescent wolframite
// is the field-test pair.
function grow_scheelite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_scheelite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid attack (pH ${conditions.fluid.pH.toFixed(1)}) — slow scheelite dissolution`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 4.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (conditions.temperature > 400) { crystal.habit = 'dipyramidal'; crystal.dominant_forms = ['pseudo-octahedral dipyramid']; }
  else if (sigma > 2.0) { crystal.habit = 'tabular'; crystal.dominant_forms = ['flat scheelite tablet']; }
  else { crystal.habit = 'octahedral_pseudo'; crystal.dominant_forms = ['pseudo-octahedron (looks cubic, is tetragonal)']; }
  let color_note = 'white-yellow scheelite — bright blue-white SW UV';
  if (conditions.fluid.Mo > 5) color_note = 'brown-orange scheelite (Mo-bearing — fluorescence shifts toward yellow)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mo: conditions.fluid.Mo * 0.005,
    note: color_note,
  });
}

// v63 brief-19: powellite CaMoO4 — Mo end-member of scheelite-powellite SS.
// Bright yellow SW UV vs scheelite's blue. Forms in molybdenite oxidation.
function grow_powellite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_powellite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'acid dissolution — powellite is more soluble than scheelite',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 3.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 2.0) { crystal.habit = 'pulverulent_crust'; crystal.dominant_forms = ['yellow crusty supergene coating']; }
  else { crystal.habit = 'tabular_thin_001'; crystal.dominant_forms = ['paper-thin {001} tablet']; }
  let color_note = 'straw-yellow powellite — bright yellow SW UV';
  if (conditions.fluid.W > 1) color_note = 'blue-green zoned powellite-scheelite SS';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_W: conditions.fluid.W * 0.005,
    note: color_note,
  });
}

// v63 brief-19: wolframite (Fe,Mn)WO4 — Fe-Mn tungstate, monoclinic blade.
// Non-fluorescent (diagnostic vs scheelite).
function grow_wolframite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_wolframite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.05);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'supergene oxidation — wolframite slowly altering toward tungstite (WO3·H2O)',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 3.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (conditions.temperature > 400) { crystal.habit = 'equant_high_T'; crystal.dominant_forms = ['blocky equant crystal']; }
  else if (sigma > 2.0) { crystal.habit = 'bladed_tabular'; crystal.dominant_forms = ['bladed wolframite (Panasqueira aesthetic)']; }
  else { crystal.habit = 'prismatic_striated'; crystal.dominant_forms = ['striated prism']; }
  let color_note;
  const mnf = conditions.fluid.Mn / Math.max(conditions.fluid.Fe + conditions.fluid.Mn, 1);
  if (mnf > 0.7) color_note = 'reddish-brown hübnerite (Mn-rich end)';
  else if (mnf < 0.3) color_note = 'black ferberite (Fe-rich end)';
  else color_note = 'submetallic dark-brown wolframite (intermediate Fe/Mn)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    trace_Mn: conditions.fluid.Mn * 0.01,
    note: color_note,
  });
}
