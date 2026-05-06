// ============================================================
// js/52-engines-carbonate.ts — carbonate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/carbonate.py. Minerals (11): aragonite, aurichalcite, azurite, calcite, cerussite, dolomite, malachite, rhodochrosite, rosasite, siderite, smithsonite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_calcite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_calcite();
  if (sigma < 1.0) {
    // Acid dissolution — calcite dissolves easily in acid
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(8.0, crystal.total_growth_um * 0.15);
      // RECYCLING: Ca, CO3, and trace elements return to fluid
      // Phase 1e: Ca + CO3 (major species) credits via MINERAL_DISSOLUTION_RATES.calcite.
      // Mn and Fe trace credits stay inline below — they're zone-data-driven, not rate-scaled.
      if (crystal.zones.length) {
        const recentZones = crystal.zones.slice(-3);
        const avg_mn = recentZones.reduce((s, z) => s + z.trace_Mn, 0) / recentZones.length;
        const avg_fe = recentZones.reduce((s, z) => s + z.trace_Fe, 0) / recentZones.length;
        conditions.fluid.Mn += avg_mn * 0.5;
        conditions.fluid.Fe += avg_fe * 0.5;
      }
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + CO₃²⁻ released back to fluid`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.8, 1.2);

  const Mn_partition = 0.1 * (1 + excess * 0.5);
  const trace_Mn = conditions.fluid.Mn * Mn_partition;
  const Fe_partition = 0.08;
  const trace_Fe = conditions.fluid.Fe * Fe_partition;

  // Provenance tracking — what fraction of Ca came from the wall?
  const wall = conditions.wall;
  const total_ca = conditions.fluid.Ca;
  let ca_wall_fraction = 0.0;
  let ca_fluid_fraction = 1.0;
  if (total_ca > 0 && wall.ca_from_wall_total > 0) {
    ca_wall_fraction = Math.min(wall.ca_from_wall_total / total_ca, 1.0);
    ca_fluid_fraction = 1.0 - ca_wall_fraction;
  }

  if (conditions.temperature > 200) {
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = ['v{211} scalenohedron', 'dog-tooth'];
  } else if (conditions.temperature > 100) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104} rhombohedron'];
  } else {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104}', 'possibly nail-head'];
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let note = '';
  if (trace_Mn > 1.0 && trace_Fe < 2.0) note = 'Mn-rich zone — will fluoresce orange under UV';
  else if (trace_Mn > 1.0 && trace_Fe > 2.0) note = 'Fe quenching Mn fluorescence — dark CL zone';

  // Provenance note when significant wall-derived material
  if (ca_wall_fraction > 0.3) {
    const prov_note = `[${(ca_wall_fraction * 100).toFixed(0)}% recycled wall rock]`;
    note = note ? `${note} ${prov_note}` : prov_note;
  }

  let fi = false, fi_type = '';
  if (rate > 8 && rng.random() < 0.2) {
    fi = true;
    fi_type = conditions.temperature > 150 ? '2-phase' : 'single-phase';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn,
    fluid_inclusion: fi, inclusion_type: fi_type, note,
    ca_from_wall: ca_wall_fraction,
    ca_from_fluid: ca_fluid_fraction,
  });
}

function grow_aragonite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_aragonite();

  // Polymorphic conversion to calcite — aragonite is metastable. At T > 100°C
  // when the kinetic favorability has dropped, the orthorhombic structure
  // inverts to trigonal calcite via solution-mediated dissolution + reprecipitation.
  if (crystal.total_growth_um > 10
      && conditions.temperature > 100
      && sigma < 0.8) {
    crystal.dissolved = true;
    conditions.fluid.Ca += 2.0;
    conditions.fluid.CO3 += 1.5;
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -2.0, growth_rate: -2.0,
      note: `polymorphic conversion — orthorhombic CaCO₃ → trigonal calcite (T=${conditions.temperature.toFixed(0)}°C, sigma_arag=${sigma.toFixed(2)})`
    });
  }

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(8.0, crystal.total_growth_um * 0.15);
      // Phase 1e (aragonite acid path): Ca + CO3 credits stay inline —
      // aragonite has multi-mode dissolution (this acid path uses
      // Ca=0.5 CO3=0.3, the polymorph path uses different effective
      // rates), pending per-mode dispatch.
      conditions.fluid.Ca += dissolved_um * 0.5;
      conditions.fluid.CO3 += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 5.5 * excess * rng.uniform(0.7, 1.3);

  // Habit selection
  if (conditions.fluid.Fe > 30 && excess > 0.6) {
    crystal.habit = 'flos_ferri';
    crystal.dominant_forms = ["dendritic 'iron flower' coral", 'stalactitic ferruginous'];
  } else if (excess > 1.5) {
    crystal.habit = 'acicular_needle';
    crystal.dominant_forms = ['acicular needles', 'radiating spray'];
  } else if (excess > 0.6) {
    crystal.habit = 'twinned_cyclic';
    crystal.dominant_forms = ['pseudo-hexagonal cyclic twin {110}', 'six-pointed star (cerussite-like)'];
  } else {
    crystal.habit = 'columnar';
    crystal.dominant_forms = ['columnar prisms', 'transparent to white'];
  }

  const trace_Mn = conditions.fluid.Mn * 0.05;
  const trace_Fe = conditions.fluid.Fe * 0.06;

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let note = `${crystal.habit} CaCO₃`;
  const sr_uptake = conditions.fluid.Sr * 0.15;
  const pb_uptake = conditions.fluid.Pb * 0.10;
  if (sr_uptake > 0.5 || pb_uptake > 0.5) {
    note += ' (Sr+Pb scavenged: aragonite hosts what calcite can\'t)';
  }
  if (conditions.fluid.Mg > 0) {
    const mg_ratio = conditions.fluid.Mg / Math.max(conditions.fluid.Ca, 0.01);
    if (mg_ratio > 1.5) {
      note += ` — Mg/Ca=${mg_ratio.toFixed(1)}, calcite is poisoned here`;
    }
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn,
    note,
  });
}

function grow_dolomite(crystal, conditions, step) {
  // Kim 2023 kinetics — see Python grow_dolomite for full citation.
  // Cycling required for true ordered dolomite; phantom_count tracks cycles.
  const sigma = conditions.supersaturation_dolomite();
  if (sigma < 1.0) {
    // Strong acid dissolution
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 6.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.12);
      // Phase 1e: Ca + Mg + CO3 credits via MINERAL_DISSOLUTION_RATES.dolomite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + Mg²⁺ + CO₃²⁻ released`
      });
    }
    // Kim-cycle etch — transition from growth → undersaturation strips
    // the disordered Ca/Mg surface layer. Only emit on the FIRST low-σ
    // step after a growth step (last zone positive); subsequent low-σ
    // steps wait until σ recovers.
    if (crystal.zones.length && crystal.zones[crystal.zones.length - 1].thickness_um > 0) {
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -0.3, growth_rate: -0.3,
        note: `Kim-cycle etch (Sun & Kim 2023) — disordered Ca/Mg surface stripped, ordered template preserved (cycle #${crystal.phantom_count + 1})`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const base_rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  // Kim 2023: ordering fraction f_ord ramps with FLUID-LEVEL cycle count.
  // Tracking at the fluid level captures the geological insight that an
  // oscillatory environment ratchets ordering across all dolomite nuclei,
  // not just the ones that survive enclosure. N₀=10 calibrated for sim
  // timescale (each sim cycle stands in for thousands of real tidal cycles).
  const cycle_count = conditions._dol_cycle_count;
  const f_ord = 1.0 - Math.exp(-cycle_count / 7.0);
  const rate = base_rate * (0.30 + 0.70 * f_ord);

  if (conditions.temperature > 200 && excess < 0.5) {
    crystal.habit = 'coarse_rhomb';
    crystal.dominant_forms = ['coarse rhombohedral {104}', 'transparent to white textbook crystals'];
  } else if (excess > 1.2) {
    crystal.habit = 'massive';
    crystal.dominant_forms = ['massive granular', 'white to gray sugary aggregate'];
  } else {
    crystal.habit = 'saddle_rhomb';
    crystal.dominant_forms = ['e{104} saddle-shaped curved rhombohedron', 'the diagnostic dolomite habit (curved-face signature)'];
  }

  let color_note;
  if (conditions.fluid.Fe > 30) color_note = 'tan to brown (Fe-rich, approaching ankerite intermediate)';
  else if (conditions.fluid.Mn > 10) color_note = 'pinkish-white (Mn-bearing kutnohorite-dolomite intermediate)';
  else color_note = 'white to colorless (Ca-Mg end-member dolomite)';

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let order_note;
  if (f_ord < 0.3) order_note = ` [DISORDERED — f_ord=${f_ord.toFixed(2)}, fluid_cycles=${cycle_count}, growing as Mg-calcite intermediate]`;
  else if (f_ord < 0.7) order_note = ` [PARTIALLY ORDERED — f_ord=${f_ord.toFixed(2)}, fluid_cycles=${cycle_count}]`;
  else order_note = ` [ORDERED dolomite — f_ord=${f_ord.toFixed(2)}, fluid_cycles=${cycle_count}]`;

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.08,
    trace_Mn: conditions.fluid.Mn * 0.05,
    note: `${crystal.habit} — ${color_note}${order_note}`,
  });
}

function grow_siderite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_siderite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.13);
      // Phase 1e: Fe + CO3 credits via MINERAL_DISSOLUTION_RATES.siderite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative breakdown (O₂=${conditions.fluid.O2.toFixed(2)}) — Fe²⁺ → Fe³⁺, siderite converting to goethite/limonite (classic diagenetic pseudomorph)`
      });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.15);
      // Phase 1e: Fe + CO3 credits via MINERAL_DISSOLUTION_RATES.siderite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Fe²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 5.0 * excess * rng.uniform(0.7, 1.3);

  if (excess > 1.5) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['botryoidal mammillary crusts', 'tan-brown rounded aggregates'];
  } else if (excess > 1.0 && conditions.temperature < 80) {
    crystal.habit = 'spherulitic';
    crystal.dominant_forms = ["spherulitic concretions ('spherosiderite')", 'radial fibrous interior'];
  } else if (excess > 0.6) {
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = ['v{211} scalenohedral', 'sharp brown crystals'];
  } else {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ["e{104} curved 'saddle' rhombohedron", 'tan to brown'];
  }

  let color_note;
  if (conditions.fluid.Mn > 5) color_note = 'pinkish-brown (Mn-bearing manganosiderite)';
  else if (conditions.fluid.Ca > 100) color_note = 'tan to pale brown (Ca-bearing intermediate toward ankerite)';
  else color_note = 'deep brown (Fe-dominant end-member)';

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.4,
    trace_Mn: conditions.fluid.Mn * 0.05,
    note: `${crystal.habit} — ${color_note}`,
  });
}

function grow_rhodochrosite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_rhodochrosite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Mn += dissolved_um * 0.4;
      conditions.fluid.CO3 += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidative breakdown — Mn²⁺ → Mn³⁺/Mn⁴⁺, surface converting to black manganese oxide (pyrolusite/psilomelane staining)`
      });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.15);
      conditions.fluid.Mn += dissolved_um * 0.5;
      conditions.fluid.CO3 += dissolved_um * 0.4;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Mn²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 5.0 * excess * rng.uniform(0.7, 1.3);

  const pos_str = typeof crystal.position === 'string' ? crystal.position : '';
  const on_drip = pos_str.includes('goethite') || pos_str.includes('stalactit');

  if (on_drip) {
    crystal.habit = 'stalactitic';
    crystal.dominant_forms = ['concentric stalactitic banding', 'rose-pink mammillary aggregates'];
  } else if (excess > 1.5) {
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = ["v{211} scalenohedral 'dog-tooth'", 'sharp deep-rose crystals'];
  } else if (excess > 0.5) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ["e{104} curved 'button' rhombohedron", 'rose-pink to raspberry'];
  } else {
    crystal.habit = 'banding_agate';
    crystal.dominant_forms = ['rhythmic Mn/Ca banding', 'agate-like layered cross-section'];
  }

  const ca_in_lattice = conditions.fluid.Ca / Math.max(conditions.fluid.Mn + conditions.fluid.Ca, 0.01);
  let color_note;
  if (ca_in_lattice > 0.5) color_note = 'pale pink (Ca-rich, approaching kutnohorite intermediate)';
  else if (ca_in_lattice > 0.2) color_note = 'rose-pink (some Ca substitution)';
  else color_note = 'deep raspberry-red (Mn-dominant, end-member rhodochrosite)';
  if (conditions.fluid.Fe > 30) color_note += ' with brownish tint (Fe-rich)';

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mn: conditions.fluid.Mn * 0.4,
    trace_Fe: conditions.fluid.Fe * 0.05,
    note: `${crystal.habit} — ${color_note}`,
  });
}

function grow_malachite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_malachite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.15);
      // Phase 1e: Cu + CO3 credits via MINERAL_DISSOLUTION_RATES.malachite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — fizzing! Cu²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const zone_count = crystal.zones.length;
  if (zone_count >= 20) {
    crystal.habit = 'banded';
    crystal.dominant_forms = ['banded botryoidal', 'concentric layers'];
  } else if (rate > 8) {
    crystal.habit = 'fibrous/acicular';
    crystal.dominant_forms = ['acicular sprays', 'fibrous radiating'];
  } else {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['botryoidal masses', 'mammillary'];
  }

  if (crystal.habit === 'botryoidal' || crystal.habit === 'banded') {
    crystal.a_width_mm = crystal.c_length_mm * 1.5;
  } else if (crystal.habit === 'fibrous/acicular') {
    crystal.a_width_mm = crystal.c_length_mm * 0.2;
  }

  // Phase 1d: Cu consumption owned by the wrapper (applyMassBalance).

  let color_note;
  if (zone_count >= 20) {
    color_note = 'banded green (alternating light/dark)';
  } else if (conditions.fluid.Cu > 30) {
    color_note = 'vivid green';
  } else if (conditions.fluid.Cu < 10) {
    color_note = 'pale green';
  } else {
    color_note = 'green';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `${crystal.habit}, ${color_note}, Cu fluid: ${conditions.fluid.Cu.toFixed(0)} ppm`
  });
}

function grow_smithsonite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_smithsonite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.12);
      // Phase 1e: Zn + CO3 credits via MINERAL_DISSOLUTION_RATES.smithsonite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — smithsonite fizzes weakly in acid, releasing Zn²⁺`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const zone_count = crystal.zones.length;
  if (zone_count >= 15) {
    crystal.habit = 'botryoidal/stalactitic';
    crystal.dominant_forms = ['botryoidal crusts', 'stalactitic masses'];
  } else if (rate > 6) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['{10̄11} rhombohedron', 'curved faces'];
  } else {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['grape-like clusters', 'reniform masses'];
  }

  if (crystal.habit === 'botryoidal' || crystal.habit === 'botryoidal/stalactitic') {
    crystal.a_width_mm = crystal.c_length_mm * 1.8;
  }

  // Phase 1d: Zn/CO3 consumption owned by the wrapper (applyMassBalance).

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let color_note;
  if (conditions.fluid.Cu > 15) {
    color_note = 'apple-green (Cu impurity)';
  } else if (conditions.fluid.Fe > 20) {
    color_note = 'yellow-brown (Fe impurity)';
  } else if (conditions.fluid.Mn > 10) {
    color_note = 'pink (Mn impurity)';
  } else {
    color_note = rng.random() < 0.4 ? 'blue-green' : 'white to pale blue';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `${crystal.habit}, ${color_note}, Zn fluid: ${conditions.fluid.Zn.toFixed(0)} ppm`
  });
}

function grow_rosasite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_rosasite();
  if (sigma < 1.0) {
    // Acid dissolution — fizzes like calcite below pH 5
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.08);
      // Phase 1e: Cu + Zn + CO3 credits via MINERAL_DISSOLUTION_RATES.rosasite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + Zn²⁺ + CO₃²⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  // Habit selection
  let habit_note;
  if (conditions.temperature < 15 && excess > 0.6) {
    crystal.habit = "acicular_radiating";
    crystal.dominant_forms = ["needle-like sprays", "radiating fibrous"];
    habit_note = "delicate acicular sprays — low-T slow growth";
  } else if (excess > 1.0) {
    crystal.habit = "botryoidal";
    crystal.dominant_forms = ["botryoidal", "mammillary crusts"];
    habit_note = "botryoidal spheres — the diagnostic rosasite habit";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["thin crust", "mammillary"];
    habit_note = "mammillary crust";
  }
  // Color shift by Cu fraction
  const cu_zn_total_g = conditions.fluid.Cu + conditions.fluid.Zn;
  const cu_frac = cu_zn_total_g > 0 ? conditions.fluid.Cu / cu_zn_total_g : 0.5;
  if (cu_frac > 0.85) habit_note += "; sky-blue (Cu-rich, approaching malachite composition)";
  else if (cu_frac > 0.65) habit_note += "; blue-green (typical Cu-dominant rosasite)";
  else habit_note += "; greenish blue-green (transitional toward aurichalcite)";
  // Nickeloan variant
  if (conditions.fluid.Ni > 5) habit_note += "; nickeloan (darker green from Ni substitution)";
  // Deplete
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.04, 0);
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.025, 0);
  conditions.fluid.CO3 = Math.max(conditions.fluid.CO3 - rate * 0.06, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_aurichalcite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_aurichalcite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.08);
      // Phase 1e: Zn + Cu + CO3 credits via MINERAL_DISSOLUTION_RATES.aurichalcite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Zn²⁺ + Cu²⁺ + CO₃²⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (conditions.temperature < 25 && excess > 0.5) {
    crystal.habit = "tufted_spray";
    crystal.dominant_forms = ["divergent acicular sprays", "tufted aggregates"];
    habit_note = "delicate tufted sprays — the diagnostic aurichalcite habit";
  } else if (excess > 1.0) {
    crystal.habit = "radiating_columnar";
    crystal.dominant_forms = ["radiating spheres", "spherical aggregates"];
    habit_note = "radiating spherical aggregates";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["thin crust", "laminated"];
    habit_note = "thin laminar crust";
  }
  const cu_zn_total_g = conditions.fluid.Cu + conditions.fluid.Zn;
  const zn_frac = cu_zn_total_g > 0 ? conditions.fluid.Zn / cu_zn_total_g : 0.5;
  if (zn_frac > 0.85) habit_note += "; very pale green-white (Zn-rich, approaching smithsonite composition)";
  else if (zn_frac > 0.65) habit_note += "; pale blue-green (typical Zn-dominant aurichalcite)";
  else habit_note += "; deeper blue-green (transitional toward rosasite)";
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.05, 0);
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.02, 0);
  conditions.fluid.CO3 = Math.max(conditions.fluid.CO3 - rate * 0.07, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_azurite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_azurite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Cu += d * 0.5;
      conditions.fluid.CO3 += d * 0.4;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `carbonate dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — fizzes, Cu²⁺ + CO₃²⁻ released` });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.CO3 < 80) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.08);
      conditions.fluid.Cu += d * 0.5;
      conditions.fluid.CO3 += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `azurite → malachite conversion (CO₃ ${conditions.fluid.CO3.toFixed(0)} ppm drops below pseudomorph threshold)` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let color_note;
  if (excess > 1.0) { crystal.habit = 'azurite_sun'; crystal.dominant_forms = ['radiating flat disc', 'azurite-sun in fracture']; color_note = 'deep blue azurite-sun — radiating disc habit in narrow fracture'; }
  else if (excess > 0.4) { crystal.habit = 'rosette_bladed'; crystal.dominant_forms = ['radiating bladed crystals', 'rosette']; color_note = 'deep blue rosette of radiating blades'; }
  else { crystal.habit = 'deep_blue_prismatic'; crystal.dominant_forms = ['monoclinic prismatic', 'deep azure/midnight blue']; color_note = 'deep azure-blue monoclinic prism'; }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.025, 0);
  conditions.fluid.CO3 = Math.max(conditions.fluid.CO3 - rate * 0.018, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_cerussite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_cerussite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.1);
      // Phase 1e: Pb + CO3 credits via MINERAL_DISSOLUTION_RATES.cerussite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `carbonate dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — fizzes` });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let color_note = f.Cu > 5.0 ? `blue-green tint (Cu ${f.Cu.toFixed(1)} ppm)` : 'colorless to white, adamantine, extreme birefringence';
  if (crystal.twinned && (crystal.twin_law || '').includes('sixling')) color_note += ' — six-ray stellate twin';

  if (crystal.twinned && (crystal.twin_law || '').includes('sixling')) {
    crystal.habit = 'stellate_sixling';
    crystal.dominant_forms = ['cyclic {110} sixling twin', 'pseudo-hexagonal outline'];
  } else if (excess > 1.2) {
    crystal.habit = 'acicular';
    crystal.dominant_forms = ['fine {110} needles', 'radiating sprays'];
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['b{010} pinacoid', 'm{110} prism'];
  }

  const trace_Pb = f.Pb * 0.015;
  f.Pb = Math.max(f.Pb - rate * 0.02, 0);
  f.CO3 = Math.max(f.CO3 - rate * 0.015, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Pb, note: color_note });
}
