// ============================================================
// js/54-engines-hydroxide.ts — hydroxide-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/hydroxide.py. Minerals (2): goethite, lepidocrocite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_goethite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_goethite();

  if (sigma < 1.0) {
    // Acid dissolution (FeO(OH) + 3H+ -> Fe3+ + 2H2O)
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.12);
      // Phase 1e: Fe credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.goethite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — goethite releases Fe³⁺`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;

  // Habit evolves with zone count — botryoidal aggregates build up
  const zoneCount = crystal.zones.length;
  if (zoneCount >= 20) {
    crystal.habit = 'botryoidal/stalactitic';
    crystal.dominant_forms = ['botryoidal masses', 'velvety surfaces'];
  } else if (zoneCount >= 8) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['grape-like clusters', 'reniform masses'];
  } else if (crystal.position.includes('pseudomorph after')) {
    crystal.habit = 'pseudomorph_after_sulfide';
    crystal.dominant_forms = ['replaces sulfide cube', 'preserves parent habit'];
  } else {
    crystal.habit = 'fibrous_acicular';
    crystal.dominant_forms = ['radiating needles', 'velvet crust'];
  }

  if (crystal.habit.includes('botryoidal')) {
    crystal.a_width_mm = crystal.c_length_mm * 1.6;
  }

  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.008, 0);
  conditions.fluid.O2 = Math.max(conditions.fluid.O2 - rate * 0.001, 0);

  let colorNote;
  if (crystal.habit.includes('pseudomorph')) {
    colorNote = 'yellow-brown pseudomorph after pyrite — the boxwork ghost';
  } else if (crystal.habit.includes('botryoidal')) {
    colorNote = 'black lustrous botryoidal surfaces, velvety sheen';
  } else {
    colorNote = 'yellow-brown earthy to ochre';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.02,
    note: colorNote
  });
}

function grow_lepidocrocite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_lepidocrocite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(1.5, crystal.total_growth_um * 0.06);
      // Phase 1e: Fe credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.lepidocrocite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.0) { crystal.habit = 'fibrous_micaceous'; crystal.dominant_forms = ['fibrous micaceous aggregate', 'rapid-oxidation signature']; color_note = 'rust-brown fibrous (fast Fe²⁺ oxidation, coarser particles)'; }
  else if (excess > 0.4) { crystal.habit = 'plumose_rosette'; crystal.dominant_forms = ['plumose rosette', 'radiating platy']; color_note = 'ruby-red plumose rosette'; }
  else { crystal.habit = 'platy_scales'; crystal.dominant_forms = ['{010} platy scales', 'perfect basal cleavage (mica-like)']; color_note = "pink-mauve to ruby-red platy (nanoscale 'lithium quartz' pigment scale)"; }
  f.Fe = Math.max(f.Fe - rate * 0.020, 0);
  f.O2 = Math.max(f.O2 - rate * 0.002, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: f.Fe * 0.02, note: color_note });
}
