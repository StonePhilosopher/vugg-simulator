// ============================================================
// js/51-engines-borate.ts — borate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/borate.py. Minerals (1): borax.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_borax(crystal, conditions, step) {
  const sigma = conditions.supersaturation_borax();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.concentration < 1.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(10.0, crystal.total_growth_um * 0.25);
      conditions.fluid.Na += dissolved_um * 0.4;
      conditions.fluid.B += dissolved_um * 0.15;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `meteoric flush — borax redissolves (concentration ${conditions.fluid.concentration.toFixed(1)})`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 15.0 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  if (rate > 12 && conditions.temperature >= 35) {
    crystal.habit = 'cottonball';
    crystal.dominant_forms = ['fibrous radial bundles', 'white rounded clusters'];
  } else if (crystal.total_growth_um > 8000) {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['tincal nodule', 'granular massive'];
  } else {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{100} pinacoid', '{110} prism', '{010} dome'];
  }
  conditions.fluid.Na = Math.max(conditions.fluid.Na - rate * 0.06, 0);
  conditions.fluid.B = Math.max(conditions.fluid.B - rate * 0.018, 0);
  let color_note;
  if (conditions.fluid.Cu > 5) color_note = 'pale blue-green borax (trace Cu)';
  else color_note = 'colorless prismatic borax — vitreous, sectile';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: color_note,
  });
}

// tincalconite is paramorph-only — no direct supersaturation path.
// The DEHYDRATION_TRANSITIONS framework (75-transitions.ts) converts
// borax into tincalconite when humidity drops; this stub keeps
// MINERAL_ENGINES.tincalconite resolvable.
function grow_tincalconite(_crystal, _conditions, _step) { return null; }
