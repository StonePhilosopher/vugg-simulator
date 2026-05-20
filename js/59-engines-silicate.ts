// ============================================================
// js/59-engines-silicate.ts — silicate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/silicate.py. Minerals (13): albite, apophyllite, aquamarine, beryl, chrysocolla, emerald, feldspar, heliodor, morganite, quartz, spodumene, topaz, tourmaline. Family helpers: _beryl_family_dissolution, _beryl_family_habit_forms, _corundum_family_habit.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_quartz(crystal, conditions, step) {
  const sigma = conditions.supersaturation_quartz();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.1);
      // Phase 1e: SiO2 credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.quartz.

      // Determine dissolution type
      let note;
      if (conditions.fluid.pH < 4.0 && conditions.fluid.F > 20) {
        note = 'HF etching — trigonal etch pits on prism faces, SiO₂ dissolved as SiF₄';
      } else {
        note = 'dissolution — etching on prism faces';
      }

      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate;
  if (excess < 0.5) rate = 8.0 * excess * excess;
  else rate = 4.0 * excess;

  // Arrhenius rescaled so prefactor ~= 1.0 at 200 C (sim's most-common
  // working temperature). Previous exp(-3000/T_K) * 50 was calibrated
  // for 400 C porphyry quartz and collapsed to 0.03-0.09 at Herkimer /
  // MVT / Alpine temperatures, starving quartz below the 0.1 um cutoff.
  // New slope keeps real T-dependence (400:100 ratio ~3.3x) without
  // suppressing mid-T growth. See vugg.py grow_quartz comment for full
  // rationale and the look-up table.
  rate *= Math.exp(-1000.0 / (conditions.temperature + 273.15)) * 8.27;
  rate *= rng.uniform(0.7, 1.3);

  if (rate < 0.1) return null;

  const Ti_partition = 0.01 * Math.exp(0.005 * conditions.temperature);
  const trace_Ti = conditions.fluid.Ti * Ti_partition;
  const Al_partition = 0.02 * (1 + 0.5 * excess);
  const trace_Al = conditions.fluid.Al * Al_partition;
  const trace_Fe = conditions.fluid.Fe * 0.005;
  const trace_Mn = conditions.fluid.Mn * 0.003;

  let fi = false, fi_type = '';
  if (rate > 15 && rng.random() < 0.3) {
    fi = true;
    if (conditions.temperature > 300) fi_type = '2-phase (liquid + vapor)';
    else if (conditions.temperature > 200) fi_type = '2-phase (liquid-dominant)';
    else fi_type = 'single-phase liquid';
  }

  // SiO₂ polymorph determines habit — different crystal structures at different T
  const polymorph = conditions.silica_polymorph();
  crystal._polymorph = polymorph; // store for narrative
  if (polymorph === 'tridymite') {
    crystal.habit = 'tridymite (thin hexagonal plates)';
    crystal.dominant_forms = ['thin tabular {0001}', 'pseudo-hexagonal'];
    crystal.mineral_display = 'tridymite';
  } else if (polymorph === 'beta-quartz') {
    // β-quartz: hexagonal bipyramids, no prism faces. Inverts to α-quartz on cooling.
    crystal.habit = 'β-quartz bipyramidal (paramorphic)';
    crystal.dominant_forms = ['hexagonal bipyramid {10̄11}', 'no prism faces'];
    crystal.mineral_display = 'quartz (β→α)';
  } else if (polymorph === 'alpha-quartz') {
    // Classic hydrothermal quartz
    if (conditions.temperature > 400) {
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['m{100} prism', 'r{101} rhombohedron'];
    } else if (conditions.temperature > 250) {
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['m{100} prism', 'r{101}', 'z{011}'];
    } else {
      crystal.dominant_forms = ['m{100}', 'r{101}', 'z{011} dominant'];
      if (excess > 1.0) crystal.habit = 'scepter overgrowth possible';
    }
  } else if (polymorph === 'chalcedony') {
    crystal.habit = 'chalcedony (microcrystalline)';
    crystal.dominant_forms = ['fibrous aggregates', 'botryoidal'];
    crystal.mineral_display = 'chalcedony';
    // Chalcedony grows faster than crystalline quartz due to disordered structure
    rate *= 1.5;
  } else { // opal
    crystal.habit = 'opal (amorphous silica)';
    crystal.dominant_forms = ['botryoidal', 'colloform'];
    crystal.mineral_display = 'opal';
    rate *= 2.0; // amorphous precipitates fastest
  }

  // Dauphiné twinning: occurs during β→α quartz inversion at 573°C,
  // or from mechanical stress / thermal shock. Most common when crystal
  // grew as β-quartz and cooled through the transition.
  if (!crystal.twinned && crystal.zones.length > 2) {
    const prev_T = crystal.zones[crystal.zones.length - 1].temperature;
    const crossed_573 = (prev_T > 573 && conditions.temperature <= 573) ||
                         (prev_T <= 573 && conditions.temperature > 573);
    if (crossed_573 && rng.random() < 0.7) {
      // High probability when crossing the β→α inversion
      crystal.twinned = true;
      crystal.twin_law = 'Dauphiné (β→α inversion)';
    } else if (!crossed_573) {
      const delta_T = Math.abs(conditions.temperature - prev_T);
      if (delta_T > 50 && rng.random() < 0.25) {
        // Thermal shock twinning — less common
        crystal.twinned = true;
        crystal.twin_law = 'Dauphiné (thermal stress)';
      }
    }
  }

  let note = '';
  // Polymorph-specific growth notes
  if (polymorph === 'opal') {
    note = 'amorphous silica precipitating — colloidal deposition';
  } else if (polymorph === 'chalcedony') {
    note = 'chalcedony — fibrous microcrystalline growth';
    if (excess > 1.5) note += ', rapid banding possible';
  } else if (polymorph === 'beta-quartz') {
    note = 'β-quartz crystallizing — hexagonal bipyramids, will invert to α on cooling';
  } else if (polymorph === 'tridymite') {
    note = 'tridymite crystallizing — high-T silica polymorph, thin hexagonal plates';
  } else {
    // α-quartz notes
    if (excess > 1.5) note = 'rapid growth — growth hillocks developing on prism faces';
    else if (excess > 1.0) note = 'moderate supersaturation — clean layer growth';
    else if (excess < 0.2) note = 'near-equilibrium — very slow, high-quality growth';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn, trace_Al, trace_Ti,
    fluid_inclusion: fi, inclusion_type: fi_type, note
  });
}

function grow_feldspar(crystal, conditions, step) {
  const sigma = conditions.supersaturation_feldspar();

  if (sigma < 1.0) {
    // Feldspar kaolinization in acidic conditions. Balanced reaction:
    // 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite + 2 K⁺ + 4 SiO₂.
    // Al is conserved in the new kaolinite phase; only K and SiO₂ go
    // to the fluid (with a small Al pore-fluid contribution, ~5%).
    // The sim doesn't track kaolinite as a distinct mineral — it's an
    // implicit Al sink.
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.08);
      // Phase 1e: K + Al + SiO2 credits via MINERAL_DISSOLUTION_RATES.feldspar.
      // (Note: Al rate=0.05 reflects most Al staying in kaolinite, not redissolved.)
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `kaolinization (pH ${conditions.fluid.pH.toFixed(1)}) — KAlSi₃O₈ → kaolinite + K⁺ + SiO₂; Al conserved in kaolinite`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 3.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  const isKrich = conditions.fluid.K >= conditions.fluid.Na;

  // Determine polymorph from temperature
  let polymorph, crystal_system;
  if (isKrich) {
    if (T > 500) {
      polymorph = 'sanidine';
      crystal_system = 'monoclinic';
      crystal.habit = 'tabular';
      crystal.dominant_forms = ['{010} tabular', '{001} pinacoid'];
    } else if (T > 300) {
      polymorph = 'orthoclase';
      crystal_system = 'monoclinic';
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['{010} pinacoid', '{001} pinacoid', '{110} prism'];
    } else {
      polymorph = 'microcline';
      crystal_system = 'triclinic';
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['{010} pinacoid', '{001} pinacoid', '{110} prism'];
      // Adularia habit in hydrothermal veins at low T
      if (T < 250 && rate < 2) {
        polymorph = 'adularia';
        crystal.habit = 'pseudo-orthorhombic';
        crystal.dominant_forms = ['{110} prism', '{101} dome'];
      }
    }
  } else {
    // Na-rich → albite
    polymorph = 'albite';
    crystal_system = 'triclinic';
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{010} tabular', '{001} pinacoid'];
    if (conditions.fluid.Na > 60 && T < 400) {
      crystal.habit = 'platy (cleavelandite)';
      crystal.dominant_forms = ['{010} platy blades'];
    }
  }

  // Store polymorph on crystal for display
  crystal.mineral_display = polymorph;

  // Phase 1d: K/Na/Al/SiO2 consumption owned by the wrapper
  // (applyMassBalance, per MINERAL_STOICHIOMETRY['feldspar']).
  // Note: feldspar is K-only per v17 reconciliation; the K-or-Na fork
  // here was a pre-v17 artifact. Albite (Na-feldspar) has its own
  // engine + stoichiometry entry.

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
  // Polymorph-specific twin selection (Carlsbad/Baveno/Manebach for
  // K-feldspar; cross-hatched for microcline; albite polysynthetic
  // for albite) was previously rolled per-step. Post-fix the spec's
  // single feldspar entry rolls Carlsbad/Baveno/Manebach at nucleation
  // regardless of polymorph; refining per-polymorph twin selection
  // would require splitting feldspar into separate spec entries
  // (orthoclase/sanidine/microcline/albite as 4 distinct minerals).
  // Filed for the literature-pass tuning round.

  // Perthite exsolution — if K-feldspar cools through the solvus with Na present
  let perthite = false;
  if (isKrich && conditions.fluid.Na > 10 && T < 400 && crystal.zones.length > 2) {
    const prevT = crystal.zones[crystal.zones.length - 1]?.temperature || T;
    if (prevT > 450 && T < 400) {
      perthite = true; // Slow cooling through solvus
    }
  }

  // Fluid inclusions
  let fi = false, fi_type = '';
  if (rate > 4 && rng.random() < 0.2) {
    fi = true;
    fi_type = 'primary (alkali-rich brine)';
  }

  // Trace elements
  const trace_Fe = conditions.fluid.Fe * 0.003;
  const trace_Pb = (conditions.fluid.Pb || 0) * 0.01; // Pb partitions into microcline

  // Color and note
  let note;
  if (polymorph === 'microcline' && trace_Pb > 0.1) {
    note = `amazonite (Pb²⁺ = ${trace_Pb.toFixed(2)} ppm) — green from lead substituting for potassium`;
  } else if (perthite) {
    note = `${polymorph} with perthite exsolution — Na-rich lamellae unmixing during cooling. If submicroscopic: moonstone adularescence`;
  } else if (polymorph === 'adularia') {
    note = `adularia — low-T hydrothermal, pseudo-orthorhombic habit, the alpine cleft feldspar`;
  } else if (polymorph === 'albite' && crystal.habit.includes('cleavelandite')) {
    note = `cleavelandite albite — platy blades, classic pegmatite habit`;
  } else {
    note = `${polymorph} (${crystal_system}), T=${T.toFixed(0)}°C, K: ${conditions.fluid.K.toFixed(0)} Na: ${conditions.fluid.Na.toFixed(0)} ppm`;
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe,
    trace_Al: conditions.fluid.Al * 0.1,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note
  });
}

function grow_albite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_albite();
  if (sigma < 1.0) {
    // Albite kaolinization (pH < 3 — more acid-resistant than K-spar):
    // 2 NaAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite + 2 Na⁺ + 4 SiO₂.
    // Al conserved in the kaolinite phase (only ~5% pore partition to
    // fluid); Na and SiO₂ go back to the pocket.
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.06);
      // Phase 1e: Na + Al + SiO2 credits via MINERAL_DISSOLUTION_RATES.albite.
      // (Note: Al rate=0.05 reflects most Al staying in kaolinite.)
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `albite kaolinization (pH ${conditions.fluid.pH.toFixed(1)}) — Na⁺ + SiO₂ released, Al conserved in kaolinite` });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  const ordering = T > 450 ? 'high-albite (disordered)' : 'low-albite (fully ordered)';
  crystal.habit = 'prismatic';
  crystal.dominant_forms = ['{001} cleavage', '{010} face', '{110} prism'];

  // Cleavelandite platy habit at low T
  let cleavelandite = false;
  if (T < 350 && rate < 3.0 && rng.random() < 0.25) {
    cleavelandite = true;
    crystal.habit = 'cleavelandite_platy';
    crystal.dominant_forms = ['thin platy lamellae', 'curved aggregates'];
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  // Peristerite moonstone — Ca trace creates the sheen
  let peristerite = false;
  if (conditions.fluid.Ca > 2 && T < 400 && rng.random() < 0.15) peristerite = true;

  conditions.fluid.Na = Math.max(conditions.fluid.Na - rate * 0.012, 0);
  conditions.fluid.Al = Math.max(conditions.fluid.Al - rate * 0.006, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.010, 0);

  let note = ordering;
  if (cleavelandite) note += ', cleavelandite platy habit';
  if (peristerite) note += ', peristerite intergrowth (moonstone adularescence)';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Al: conditions.fluid.Al * 0.03, note });
}

function grow_chrysocolla(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chrysocolla();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.08);
      // Phase 1e: Cu + SiO2 credits via MINERAL_DISSOLUTION_RATES.chrysocolla.acid.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid', note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + silicic acid released` });
    }
    if (crystal.total_growth_um > 5 && conditions.temperature > 120) {
      crystal.dissolved = true;
      const d = Math.min(1.5, crystal.total_growth_um * 0.05);
      // Phase 1e: Cu + SiO2 credits via MINERAL_DISSOLUTION_RATES.chrysocolla.dehydration.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'dehydration', note: `dehydration at ${conditions.temperature.toFixed(0)} °C — chrysocolla is a strict low-T phase` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  const on_cuprite   = pos.includes('cuprite');
  const on_azurite   = pos.includes('azurite') || pos.includes('pseudomorph after azurite');
  const on_native_cu = pos.includes('native_copper');
  let color_note;
  if (on_azurite) { crystal.habit = 'pseudomorph_after_azurite'; crystal.dominant_forms = ['azurite prism outline preserved', 'chrysocolla fill']; color_note = "cyan chrysocolla pseudomorph — azurite's monoclinic prisms outline preserved in copper silicate"; }
  else if (on_cuprite) { crystal.habit = 'enamel_on_cuprite'; crystal.dominant_forms = ['thin conformal film']; color_note = 'sky-blue enamel over the earlier cuprite — Bisbee signature'; }
  else if (on_native_cu) { crystal.habit = 'botryoidal_crust'; crystal.dominant_forms = ['grape-cluster lobes']; color_note = 'cyan botryoidal crust coating the native copper sheets'; }
  else if (excess > 1.2) { crystal.habit = 'reniform_globules'; crystal.dominant_forms = ['reniform globule cluster', 'glassy conchoidal fracture']; color_note = 'thick reniform chrysocolla globules — grape-cluster cyan'; }
  else if (excess > 0.3) { crystal.habit = 'botryoidal_crust'; crystal.dominant_forms = ['botryoidal crust', 'enamel-like']; color_note = 'cyan-blue botryoidal crust — hydrous copper silicate enamel'; }
  else { crystal.habit = 'silica_gel_hemisphere'; crystal.dominant_forms = ['gel hemisphere']; color_note = 'pale cyan silica-gel hemisphere — low σ, rounded drop'; }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.020, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.035, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

// v101 (2026-05-19): Opal SiO2·nH2O — amorphous-to-short-range-
// ordered silica mineraloid. Forms hot-spring sinter aprons, botryoidal
// fillings, replacement of organics (opalized wood). Diagenesis-ladder
// flagged via crystal._diagenesis_stage for future POLYMORPH_DIAGENESIS
// implementation (opal-A → opal-CT → opal-C → chalcedony → quartz).
function grow_opal(crystal, conditions, step) {
  const sigma = conditions.supersaturation_opal();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.12);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — opal redissolves to silicic acid` });
    }
    if (crystal.total_growth_um > 5 && conditions.temperature > 150) {
      // High-T diagenesis: opal recrystallizes to chalcedony/quartz
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'diagenesis', note: `diagenesis to chalcedony/quartz > 150°C — opal-A → opal-CT → opal-C → chalcedony → quartz ladder` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.5 * excess * rng.uniform(0.8, 1.2);  // amorphous precipitates fastest
  if (rate < 0.1) return null;

  // Diagenesis stage — start as opal-A (fresh sinter), age over T+time
  const T = conditions.temperature;
  let diagenesis_stage;
  if (T < 50 && crystal.zones.length < 5) diagenesis_stage = 'opal-A';  // fresh amorphous
  else if (T < 100 && crystal.zones.length < 20) diagenesis_stage = 'opal-CT';
  else diagenesis_stage = 'opal-C';
  crystal._diagenesis_stage = diagenesis_stage;

  const pos = crystal.position || '';
  if (pos.includes('cinnabar') || pos.includes('native_sulfur')) {
    crystal.habit = 'sinter_apron';
    crystal.dominant_forms = ['hot-spring sinter apron embedding sulfides', 'mound morphology'];
  } else if (excess > 1.4) {
    crystal.habit = 'botryoidal_mound';
    crystal.dominant_forms = ['botryoidal grape-cluster mounds', 'reniform terminations'];
  } else if (excess > 0.6) {
    crystal.habit = 'reniform_layer';
    crystal.dominant_forms = ['reniform layered crusts', 'concentric banding'];
  } else if (excess > 0.2) {
    crystal.habit = 'nodular';
    crystal.dominant_forms = ['nodular massive', 'glassy conchoidal fracture'];
  } else {
    crystal.habit = 'thin_film';
    crystal.dominant_forms = ['thin film coating substrate'];
  }
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.040, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `opal (${diagenesis_stage}) ${crystal.habit}, white-to-brown common opal; amorphous silica, conchoidal fracture, H 5.5-6.5 distinguishes from quartz` });
}

function grow_coffinite(crystal, conditions, step) {
  // USiO4·nH2O — micro-crystalline U(IV) silicate, dark black/tarry
  // texture. Replaces uraninite along fractures + grain boundaries.
  // Highly radioactive (~70% U by mass). NOT fluorescent (U(IV)).
  const sigma = conditions.supersaturation_coffinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative', note: `oxidative dissolution — U(IV) → U(VI), releases uranyl (UO2)²⁺ to feed uranophane/autunite supergene` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * rng.uniform(0.7, 1.3);  // slow growth — refractory
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('uraninite') || pos.includes('pitchblende')) {
    crystal.habit = 'fracture_replacement_after_uraninite';
    crystal.dominant_forms = ['microcrystalline coating along uraninite fractures'];
  } else if (excess > 1.0) {
    crystal.habit = 'colloform_band';
    crystal.dominant_forms = ['colloform banded sub-micron texture', 'intergrown with pitchblende'];
  } else {
    crystal.habit = 'sooty_coating';
    crystal.dominant_forms = ['fine-grained black-tarry coating', 'sub-micron crystallinity'];
  }
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.025, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.015, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `coffinite ${crystal.habit}, black/tarry U(IV) silicate; highly radioactive; NOT UV-fluorescent (lacks uranyl chromophore)` });
}

function grow_uranophane(crystal, conditions, step) {
  // Ca(UO2)2(SiO3)2(OH)2·5H2O — fibrous lemon-yellow acicular sprays;
  // BRIGHT yellow-green SW+LW UV fluorescence (the diagnostic uranyl
  // luminescence). Replaces uraninite/coffinite supergene weathering.
  const sigma = conditions.supersaturation_uranophane();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — uranyl + Ca + Si released` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('uraninite') || pos.includes('coffinite') || pos.includes('pitchblende')) {
    crystal.habit = 'oxidation_front_replacement';
    crystal.dominant_forms = ['acicular sprays at oxidation front', 'replacing U(IV) primary'];
  } else if (excess > 1.2) {
    crystal.habit = 'acicular_starburst';
    crystal.dominant_forms = ['radiating needles 0.1-5 mm', 'star-shaped clusters in vugs'];
  } else if (excess > 0.4) {
    crystal.habit = 'radiating_fibrous_puffs';
    crystal.dominant_forms = ['silky sub-mm needles', 'hemispherical "puff" aggregates'];
  } else {
    crystal.habit = 'powdery_yellow_coating';
    crystal.dominant_forms = ['earthy yellow coating', 'sub-mm crystallinity'];
  }
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.030, 0);
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.010, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.015, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `uranophane ${crystal.habit}, brilliant lemon-yellow; UV-FLUORESCENT bright yellow-green (SW + LW) 💛 — uranyl (UO₂)²⁺ vibronic emission` });
}

function grow_hemimorphite(crystal, conditions, step) {
  // Zn4Si2O7(OH)2·H2O — hemimorphic crystals (different terminations
  // top vs. bottom), the textbook polar crystal class. Fan-shaped
  // sprays / botryoidal crusts / drusy on smithsonite.
  const sigma = conditions.supersaturation_hemimorphite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.08);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    if (crystal.total_growth_um > 5 && conditions.temperature > 250) {
      crystal.dissolved = true;
      const d = Math.min(1.5, crystal.total_growth_um * 0.06);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'dehydration', note: `dehydration > 250°C — hemimorphite loses structural H2O, converts to willemite + quartz` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('smithsonite')) {
    crystal.habit = 'fan_sheaves_on_smithsonite';
    crystal.dominant_forms = ['fan-shaped sprays radiating from smithsonite substrate', 'Tsumeb bowtie habit'];
  } else if (excess > 1.2) {
    crystal.habit = 'botryoidal_blue';
    crystal.dominant_forms = ['botryoidal-stalactitic crusts', 'fibrous radial internal structure', 'Mapimi blue (trace Cu) signature'];
  } else if (excess > 0.5) {
    crystal.habit = 'fan_sheaves';
    crystal.dominant_forms = ['radiating fan-shaped sprays', 'bladed acicular crystals elongate on c'];
  } else {
    crystal.habit = 'drusy_lining';
    crystal.dominant_forms = ['drusy linings of vugs', 'colorless to pale blue-green'];
  }
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.025, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.015, 0);
  const cu_blue = conditions.fluid.Cu > 5 ? 'Mapimi-style blue (Cu²⁺ trace)' : 'colorless to white';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `hemimorphite ${crystal.habit}, ${cu_blue}; hemimorphic polar crystals (different top/bottom terminations) diagnostic when visible` });
}

function grow_willemite(crystal, conditions, step) {
  // Zn2SiO4 — trigonal R-3 phenakite-group. Famously fluoresces
  // BRIGHT GREEN under SW UV (Mn²⁺ activator in Zn²⁺ site). Bimodal
  // formation: primary metamorphic 500-600°C (Franklin/Sterling NJ)
  // or supergene "nonsulfide" 50-200°C (Skorpion Namibia).
  const sigma = conditions.supersaturation_willemite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const T = conditions.temperature;
  const pos = crystal.position || '';
  const on_sphalerite = pos.includes('sphalerite');
  if (T >= 500) {
    crystal.habit = 'hexagonal_prism_franklin';
    crystal.dominant_forms = ['hexagonal prisms terminated by rhombohedra', 'Franklin troostite reddish (Mn²⁺ rich)', 'with franklinite + zincite'];
  } else if (on_sphalerite) {
    crystal.habit = 'pseudomorph_after_sphalerite_skorpion';
    crystal.dominant_forms = ['replacement pseudomorph after sphalerite', 'fibrous radiating Skorpion-style'];
  } else if (excess > 1.0) {
    crystal.habit = 'fibrous_radiating_skorpion';
    crystal.dominant_forms = ['fibrous-radiating supergene replacement', 'green-yellow Mn-bearing'];
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['massive granular intergrown', 'green-yellow Mn-bearing'];
  }
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.030, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.010, 0);
  // Color from trace Mn (chromophore + fluorescence activator)
  const mn_trace = conditions.fluid.Mn * 0.005;
  let color;
  if (mn_trace > 0.05) color = 'troostite red-brown (Mn-rich Franklin variety) — UV-FLUORESCENT bright green';
  else if (mn_trace > 0.005) color = 'green-yellow (trace Mn) — UV-FLUORESCENT bright green 💚';
  else color = 'colorless to pale green — weakly fluorescent';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Mn: mn_trace, note: `willemite ${crystal.habit}, ${color}` });
}

function grow_dioptase(crystal, conditions, step) {
  // CuSiO₃·H₂O — emerald-green trigonal cyclosilicate of the Tsumeb
  // 2nd oxidation zone. Habit: short prismatic hexagonal {1010} + rhombohedron
  // {0221} (Tsumeb iconic), or long prismatic to acicular (Kaokoveld), or
  // druzy crusts on chrysocolla, or rare calcite pseudomorphs. Per
  // research dossier 2026-05 (Ribbe/Gibbs/Hamil 1977, Keller 1977).
  const sigma = conditions.supersaturation_dioptase();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.07);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + silicic acid released`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  const on_calcite   = pos.includes('calcite');
  const on_dolomite  = pos.includes('dolomite');
  const on_chrysocolla = pos.includes('chrysocolla');
  const on_malachite = pos.includes('malachite');  // rare; pseudomorph
  let color_note;
  if (on_calcite && excess > 0.5) {
    crystal.habit = 'short_prismatic_emerald';
    crystal.dominant_forms = ['{1010} hexagonal prism', '{0221} rhombohedron', 'on calcite scalenohedra'];
    color_note = `emerald-green prismatic dioptase on calcite — Tsumeb 2nd oxidation zone iconic (σ=${sigma.toFixed(2)}, Cu ${conditions.fluid.Cu.toFixed(0)})`;
  } else if (on_malachite) {
    crystal.habit = 'pseudomorph_after_calcite';
    crystal.dominant_forms = ['calcite scalenohedron outline preserved', 'dioptase fill'];
    color_note = 'emerald-green dioptase preserving an earlier carbonate outline — late vadose conversion';
  } else if (on_chrysocolla) {
    crystal.habit = 'druzy_overgrowth';
    crystal.dominant_forms = ['sub-mm prisms', 'high nucleation density on Cu-Si gel'];
    color_note = 'druzy emerald dioptase crusts on chrysocolla substrate';
  } else if (excess > 1.0) {
    crystal.habit = 'long_prismatic_acicular';
    crystal.dominant_forms = ['c-axis–elongated needles', 'Kaokoveld habit'];
    color_note = 'acicular emerald dioptase — higher SiO₂/Cu ratio, fast nucleation';
  } else if (on_dolomite) {
    crystal.habit = 'short_prismatic_emerald';
    crystal.dominant_forms = ['{1010} prism', '{0221} rhombohedron', 'on dolomite'];
    color_note = 'emerald-green prismatic dioptase on dolomite';
  } else {
    crystal.habit = 'short_prismatic_emerald';
    crystal.dominant_forms = ['{1010} prism', '{0221} rhombohedron'];
    color_note = `emerald-green dioptase prisms (σ=${sigma.toFixed(2)})`;
  }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.020, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.025, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_shattuckite(crystal, conditions, step) {
  // Cu₅(SiO₃)₄(OH)₂ — deep azure-blue inosilicate. Type locality Shattuck
  // mine, Bisbee (Schaller 1915). Single-chain pyroxene-type Cu-Si chains
  // on Cu-O sheets (Evans & Mrose 1977). Habit: acicular tufts + spherulitic
  // rosettes + replacement of malachite/azurite/plancheite when CO₂
  // escapes a vadose vug. Per research dossier 2026-05.
  const sigma = conditions.supersaturation_shattuckite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.07);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + silicic acid released`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  const on_malachite = pos.includes('malachite') || pos.includes('pseudomorph after malachite');
  const on_azurite   = pos.includes('azurite') || pos.includes('pseudomorph after azurite');
  const on_chrysocolla = pos.includes('chrysocolla');
  let color_note;
  if (on_malachite) {
    crystal.habit = 'pseudomorph_after_malachite';
    crystal.dominant_forms = ['malachite botryoidal outline preserved', 'fibrous shattuckite fill'];
    color_note = `azure shattuckite pseudomorph after malachite — Bisbee signature; net 5 Cu₂(CO₃)(OH)₂ + 8 SiO₂ → 2 shattuckite + 5 CO₂↑ + 3 H₂O`;
  } else if (on_azurite) {
    crystal.habit = 'pseudomorph_after_azurite';
    crystal.dominant_forms = ['azurite prism outline preserved', 'fibrous shattuckite fill'];
    color_note = 'azure shattuckite pseudomorph after azurite — Mesopotamia mine Kaokoveld habit';
  } else if (on_chrysocolla && excess > 0.5) {
    crystal.habit = 'spherulitic_rosette';
    crystal.dominant_forms = ['radiating fibrous balls', 'concentric zoning'];
    color_note = `deep-azure spherulitic rosettes on chrysocolla — Kaokoveld botryoidal habit (σ=${sigma.toFixed(2)})`;
  } else if (excess > 1.2) {
    crystal.habit = 'spherulitic_rosette';
    crystal.dominant_forms = ['concentric fibrous balls 2-15 mm'];
    color_note = 'deep-azure shattuckite rosettes — high σ, dense nucleation';
  } else if (excess > 0.4) {
    crystal.habit = 'acicular_tuft';
    crystal.dominant_forms = ['radiating azure needles 1-5 mm'];
    color_note = `azure acicular tufts (σ=${sigma.toFixed(2)}, Cu ${conditions.fluid.Cu.toFixed(0)}) — Bisbee vug habit`;
  } else {
    crystal.habit = 'massive_granular';
    crystal.dominant_forms = ['fibrous massive blue fill'];
    color_note = 'azure-blue shattuckite mass — low σ replacement fill';
  }
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.025, 0);  // higher Cu:Si than dioptase
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.020, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_lepidolite(crystal, conditions, step) {
  // Lepidolite K(Li,Al)₃(Al,Si)₄O₁₀(F,OH)₂ — trioctahedral lithium
  // mica. Perfect {001} cleavage producing micaceous sheets ("books");
  // pink-to-purple from Mn²⁺ substitution in octahedral sites
  // (Evans & Raftery 1982). The thermoluminescence property (50-200°C
  // heat releases visible light) is flagged on the spec entry but not
  // a runtime mechanic in v86. Per research-lepidolite.md.
  const sigma = conditions.supersaturation_lepidolite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  // Mica growth is layer-by-layer TOT sheet addition — slow relative
  // to quartz baseline. Research-lepidolite.md §Growth Kinetics:
  // "Slow relative to quartz baseline (layer-by-layer TOT sheet
  // addition)". 1.8× base * excess is roughly half of spodumene's
  // pyroxene-chain growth rate.
  const rate = 1.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  // Color/variety dispatch — Mn-purple is the diagnostic species
  // signature. Rb concentrates very late (K-depletion phase) and
  // produces a rose-red variety; Fe-suppressed variants are gray.
  let variety, color_note;
  if (f.Mn >= 2.0) {
    variety = 'purple_book';
    color_note = `Mn²⁺ purple-lilac (Mn ${f.Mn.toFixed(1)} ppm — octahedral substitution chromophore)`;
  } else if (f.Fe >= 50 && f.Fe < 500) {
    variety = 'gray_book';
    color_note = `gray-greenish (Fe ${f.Fe.toFixed(0)} ppm dampens Mn chromophore; transitional toward zinnwaldite)`;
  } else {
    variety = 'pale_book';
    color_note = 'pale yellow to colorless (low Mn, low Fe — clean lepidolite)';
  }

  // Habit dispatch: hexagonal "books" at high σ + warm T, scaly
  // aggregates otherwise (research-lepidolite.md §Habit Selection).
  const T = conditions.temperature;
  if (excess > 0.5 && T >= 400) {
    crystal.habit = variety;
    crystal.dominant_forms = ['c{001} basal pinacoid (perfect cleavage)', 'm{110} pseudohexagonal prism', 'flexible TOT sheets', 'book-shaped'];
  } else {
    crystal.habit = 'scaly_aggregate';
    crystal.dominant_forms = ['c{001} basal cleavage', 'scaly aggregate', 'shimmering subparallel sheets'];
  }

  // Trace flagging — Mn-purple chromophore + Rb late-stage substitution.
  const trace_Mn = f.Mn * 0.020;
  const trace_Fe = f.Fe * 0.005;
  const trace_Al = f.Al * 0.010;

  // Mass balance: Li + K + Al + SiO2 + F all consumed; Mn modestly
  // sequestered in octahedral sites for the purple variety.
  f.Li = Math.max(f.Li - rate * 0.030, 0);
  f.K  = Math.max(f.K  - rate * 0.012, 0);
  f.Al = Math.max(f.Al - rate * 0.015, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.025, 0);
  f.F  = Math.max(f.F  - rate * 0.008, 0);
  if (variety === 'purple_book') f.Mn = Math.max(f.Mn - rate * 0.005, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth — wider sheets, scaly aggregate texture');
  else if (excess < 0.2) parts.push('near-equilibrium — clean hexagonal book');
  // Thermoluminescence flag (research-lepidolite.md §Fluorescence &
  // Luminescence): not visible during formation, but the crystal
  // carries the property forward for any post-formation heat probe.
  parts.push('thermoluminescent (50-200°C heat releases visible light)');

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mn, trace_Fe, trace_Al,
    note: parts.join(', '),
  });
}

function grow_spodumene(crystal, conditions, step) {
  // Spodumene (LiAlSi₂O₆) — monoclinic pyroxene, "book shape" flattened
  // tabular habit, two ~87° cleavages. No practical acid dissolution.
  const sigma = conditions.supersaturation_spodumene();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  let variety, color_note;
  if (f.Cr > 0.5) {
    variety = 'hiddenite';
    color_note = `hiddenite green (Cr³⁺ ${f.Cr.toFixed(2)} ppm)`;
  } else if (f.Mn > 2.0) {
    variety = 'kunzite';
    color_note = `kunzite pink-lilac (Mn²⁺ ${f.Mn.toFixed(1)} ppm — strong SW fluorescence)`;
  } else if (f.Fe > 10) {
    variety = 'triphane_yellow';
    color_note = `yellow-green triphane (Fe ${f.Fe.toFixed(0)} ppm, pale tint)`;
  } else {
    variety = 'triphane';
    color_note = 'colorless to pale yellow triphane (pure)';
  }

  crystal.habit = variety;
  const T = conditions.temperature;
  if (T > 550) {
    crystal.dominant_forms = ['m{110} prism', 'a{100} pinacoid', '{110}∧{1̄10} ≈87° prismatic cleavages', 'blade'];
  } else {
    crystal.dominant_forms = ['m{110} prism', 'a{100} + b{010} pinacoids', '{110}∧{1̄10} ≈87° cleavages', 'flattened tabular "book"'];
  }

  const trace_Fe = f.Fe * 0.008;
  const trace_Mn = f.Mn * 0.025;
  const trace_Al = f.Al * 0.020;

  f.Li = Math.max(f.Li - rate * 0.020, 0);
  f.Al = Math.max(f.Al - rate * 0.008, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.020, 0);
  if (variety === 'kunzite') f.Mn = Math.max(f.Mn - rate * 0.010, 0);
  else if (variety === 'hiddenite') f.Cr = Math.max(f.Cr - rate * 0.004, 0);

  const parts = [color_note, '~87° pyroxene cleavage direction established'];
  if (excess > 1.0) parts.push('rapid growth — more color-causing impurity trapped');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn, trace_Al,
    note: parts.join(', '),
  });
}

function _beryl_family_habit_forms(T) {
  if (T > 500) return ['m{10̄10} hex prism', 'c{0001} basal pinacoid', 'elongated'];
  if (T > 380) return ['m{10̄10} hex prism', 'c{0001} flat pinacoid', 'classic hexagonal'];
  return ['m{10̄10} hex prism', 'c{0001} pinacoid', 'stubby tabular'];
}

function _beryl_family_dissolution(crystal, conditions, step) {
  if (crystal.total_growth_um > 20 && conditions.fluid.pH < 3.0 && conditions.fluid.F > 30) {
    crystal.dissolved = true;
    const d = Math.min(1.5, crystal.total_growth_um * 0.03);
    // Phase 1e: Be + Al + SiO2 credits via MINERAL_DISSOLUTION_RATES (per beryl-family variant).
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -d, growth_rate: -d,
      note: `HF-assisted dissolution (pH ${conditions.fluid.pH.toFixed(1)}, F ${conditions.fluid.F.toFixed(0)}) — Be²⁺, Al³⁺, SiO₂ released`,
    });
  }
  return null;
}

function grow_beryl(crystal, conditions, step) {
  // Beryl/goshenite — post-Round-7 the colorless/generic variety; fires
  // only when no chromophore variety's gate is met. Dissolves only in HF.
  const sigma = conditions.supersaturation_beryl();
  if (sigma < 1.0) return _beryl_family_dissolution(crystal, conditions, step);

  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  crystal.habit = 'goshenite';
  crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature);

  const trace_Fe = f.Fe * 0.010;
  const trace_Al = f.Al * 0.025;

  let fi = false, fi_type = '';
  if (rate > 3 && rng.random() < 0.22) {
    fi = true;
    const T = conditions.temperature;
    if (T > 350) fi_type = '2-phase (liquid + vapor) — beryl geothermometer';
    else if (T > 150) fi_type = '2-phase (liquid-dominant)';
    else fi_type = 'single-phase liquid (late)';
  }

  f.Be = Math.max(f.Be - rate * 0.025, 0);
  f.Al = Math.max(f.Al - rate * 0.010, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.015, 0);

  const parts = ['goshenite colorless (pure beryl — no chromophore above variety gate)'];
  if (excess > 1.0) parts.push('rapid growth — wider growth ring, thermal history recorder');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Al,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function grow_emerald(crystal, conditions, step) {
  // Emerald — Cr/V variety; the "ultramafic-pegmatite paradox" mineral.
  const sigma = conditions.supersaturation_emerald();
  if (sigma < 1.0) return _beryl_family_dissolution(crystal, conditions, step);
  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  // Rare trapiche pattern (Colombian Muzo specialty)
  if (excess > 1.2 && rng.random() < 0.05) crystal.habit = 'trapiche';
  else crystal.habit = 'hex_prism';
  crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature);

  const color_note = (f.Cr > 0.5)
    ? `emerald green (Cr³⁺ ${f.Cr.toFixed(2)} ppm — the ultramafic-pegmatite paradox met)`
    : `emerald green (V³⁺ ${f.V.toFixed(2)} ppm — Colombian-type chromophore)`;

  const trace_Fe = f.Fe * 0.010;
  const trace_Mn = f.Mn * 0.010;
  const trace_Al = f.Al * 0.025;

  let fi = false, fi_type = '';
  if (rate > 3 && rng.random() < 0.30) {
    fi = true;
    fi_type = '2-phase (liquid + vapor) — emerald signature';
  }

  f.Be = Math.max(f.Be - rate * 0.025, 0);
  f.Al = Math.max(f.Al - rate * 0.010, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.015, 0);
  if (f.Cr > 0.5) f.Cr = Math.max(f.Cr - rate * 0.004, 0);
  else f.V = Math.max(f.V - rate * 0.005, 0);

  const parts = [color_note];
  if (crystal.habit === 'trapiche') parts.push('trapiche pattern — 6-spoke sector growth with black inclusion rays (Colombian Muzo)');
  if (excess > 1.0) parts.push('rapid growth — wider growth ring');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn, trace_Al,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function grow_aquamarine(crystal, conditions, step) {
  // Aquamarine — Fe²⁺ variety; the most abundant gem beryl.
  const sigma = conditions.supersaturation_aquamarine();
  if (sigma < 1.0) return _beryl_family_dissolution(crystal, conditions, step);
  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  const T = conditions.temperature;
  if (T < 380) crystal.habit = 'stubby_tabular';
  else crystal.habit = 'hex_prism_long';
  crystal.dominant_forms = _beryl_family_habit_forms(T);

  const color_note = (f.Fe > 12)
    ? `Santa Maria deep blue (Fe²⁺ ${f.Fe.toFixed(1)} ppm, high-Fe reducing)`
    : `aquamarine blue (Fe²⁺ ${f.Fe.toFixed(1)} ppm, reducing/moderate-O2)`;

  const trace_Fe = f.Fe * 0.015;
  const trace_Al = f.Al * 0.025;

  let fi = false, fi_type = '';
  if (rate > 3 && rng.random() < 0.22) {
    fi = true;
    fi_type = '2-phase (liquid + vapor) — beryl geothermometer';
  }

  f.Be = Math.max(f.Be - rate * 0.025, 0);
  f.Al = Math.max(f.Al - rate * 0.010, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.015, 0);
  f.Fe = Math.max(f.Fe - rate * 0.008, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth — thermal history recorder');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Al,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function grow_morganite(crystal, conditions, step) {
  // Morganite — Mn²⁺ pink variety; late-stage pegmatite.
  const sigma = conditions.supersaturation_morganite();
  if (sigma < 1.0) return _beryl_family_dissolution(crystal, conditions, step);
  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  if (excess > 0.5) crystal.habit = 'tabular_hex';
  else crystal.habit = 'stubby_prism';
  crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature);

  const color_note = (f.Mn < 3)
    ? `peach morganite (Mn²⁺ ${f.Mn.toFixed(1)} ppm, pre-irradiation state)`
    : `morganite pink (Mn²⁺/Mn³⁺ ${f.Mn.toFixed(1)} ppm, irradiation-oxidized)`;

  const trace_Mn = f.Mn * 0.020;
  const trace_Al = f.Al * 0.025;

  let fi = false, fi_type = '';
  if (rate > 3 && rng.random() < 0.22) {
    fi = true;
    fi_type = '2-phase (liquid + vapor) — late-stage pegmatite signature';
  }

  f.Be = Math.max(f.Be - rate * 0.025, 0);
  f.Al = Math.max(f.Al - rate * 0.010, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.015, 0);
  f.Mn = Math.max(f.Mn - rate * 0.006, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth — late-stage pocket concentration');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mn, trace_Al,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function grow_heliodor(crystal, conditions, step) {
  // Heliodor — Fe³⁺ oxidized yellow variety.
  const sigma = conditions.supersaturation_heliodor();
  if (sigma < 1.0) return _beryl_family_dissolution(crystal, conditions, step);
  const excess = sigma - 1.0;
  const rate = 2.2 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  crystal.habit = 'hex_prism';
  crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature);

  const color_note = (f.Fe > 25)
    ? `Namibian deep-yellow heliodor (Fe³⁺ ${f.Fe.toFixed(0)} ppm, strongly oxidized)`
    : `heliodor yellow (Fe³⁺ ${f.Fe.toFixed(0)} ppm, oxidized)`;

  const trace_Fe = f.Fe * 0.015;
  const trace_Al = f.Al * 0.025;

  let fi = false, fi_type = '';
  if (rate > 3 && rng.random() < 0.20) {
    fi = true;
    fi_type = '2-phase (liquid + vapor) — oxidizing pocket signature';
  }

  f.Be = Math.max(f.Be - rate * 0.025, 0);
  f.Al = Math.max(f.Al - rate * 0.010, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.015, 0);
  f.Fe = Math.max(f.Fe - rate * 0.008, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth under oxidizing pulse');
  else if (excess < 0.2) parts.push('near-equilibrium — clean gem-grade interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Al,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function _corundum_family_habit(conditions, excess) {
  const T = conditions.temperature;
  if (T > 700 && excess > 0.5) {
    return ['barrel', ['c{0001} short basal', 'n{22̄43} steep dipyramid', 'barrel profile']];
  } else if (T < 600) {
    return ['tabular', ['c{0001} flat basal pinacoid', 'm{10̄10} subordinate prism', 'flat tabular']];
  }
  return ['prism', ['m{10̄10} hexagonal prism', 'c{0001} flat basal', 'short hexagonal']];
}

function grow_tourmaline(crystal, conditions, step) {
  // Tourmaline (schorl→elbaite series). Cyclosilicate — no practical
  // dissolution path in this simplified model. Color is chosen per-zone
  // from the current fluid composition, matching vugg.py.
  const sigma = conditions.supersaturation_tourmaline();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  const is_li_rich = f.Li > 10.0;
  let variety = 'schorl';
  let color_note = '';
  if (f.Cu > 1.0) {
    variety = 'paraiba';
    color_note = `neon Paraíba blue (Cu²⁺ ${f.Cu.toFixed(2)} ppm — extreme rarity)`;
  } else if (is_li_rich && f.Mn > 0.3 && f.Fe < 15) {
    variety = 'rubellite';
    color_note = `pink rubellite (Mn²⁺ ${f.Mn.toFixed(1)} + Li ${f.Li.toFixed(0)} ppm)`;
  } else if (is_li_rich && (f.Cr > 0.5 || f.V > 1.0)) {
    variety = 'verdelite';
    color_note = `green verdelite (${f.Cr > 0.5 ? 'Cr³⁺' : 'V³⁺'} + Li ${f.Li.toFixed(0)} ppm)`;
  } else if (is_li_rich && f.Fe > 5 && f.Ti > 0.3) {
    variety = 'indicolite';
    color_note = `blue indicolite (Fe²⁺+Ti with Li ${f.Li.toFixed(0)} ppm)`;
  } else if (f.Fe > 15 && f.Li < 5) {
    variety = 'schorl';
    color_note = `black schorl (Fe²⁺ ${f.Fe.toFixed(0)} ppm dominant, Li-depleted)`;
  } else if (is_li_rich) {
    variety = 'elbaite';
    color_note = 'colorless achroite (Li-bearing elbaite, trace elements muted)';
  } else {
    color_note = 'dark olive-brown (mixed Fe/Mg character)';
  }

  crystal.habit = variety;
  if (conditions.temperature > 500) {
    crystal.dominant_forms = ['m{10̄10} prism', 'r{101̄1} + o{022̄1} terminations', 'deep striations'];
  } else {
    crystal.dominant_forms = ['m{10̄10} prism', 'slightly rounded triangular cross-section', 'deep striations'];
  }

  const trace_Fe = f.Fe * 0.04;
  const trace_Mn = f.Mn * 0.02;
  const trace_Al = f.Al * 0.03;
  const trace_Ti = f.Ti * 0.01;

  f.B  = Math.max(f.B  - rate * 0.025, 0);
  f.Na = Math.max(f.Na - rate * 0.008, 0);
  f.Al = Math.max(f.Al - rate * 0.015, 0);
  f.SiO2 = Math.max(f.SiO2 - rate * 0.020, 0);
  if (variety === 'schorl' || variety === 'indicolite') {
    f.Fe = Math.max(f.Fe - rate * 0.012, 0);
  }
  if (is_li_rich || ['rubellite','verdelite','indicolite','elbaite'].includes(variety)) {
    f.Li = Math.max(f.Li - rate * 0.010, 0);
  }
  if (variety === 'rubellite') f.Mn = Math.max(f.Mn - rate * 0.008, 0);
  if (variety === 'verdelite') {
    if (f.Cr > 0.5) f.Cr = Math.max(f.Cr - rate * 0.005, 0);
    else f.V = Math.max(f.V - rate * 0.006, 0);
  }
  if (variety === 'paraiba') f.Cu = Math.max(f.Cu - rate * 0.015, 0);

  const parts = [color_note, 'vertical striations deepen — every growth pulse leaves a ridge'];
  if (excess > 1.5) parts.push('rapid growth — radial sprays possible');
  else if (excess < 0.2) parts.push('near-equilibrium — clean prismatic growth');

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn, trace_Al, trace_Ti,
    note: parts.join(', '),
  });
}

function grow_topaz(crystal, conditions, step) {
  // Topaz (Al₂SiO₄(F,OH)₂) — orthorhombic nesosilicate. F-gated nucleation.
  // Imperial color (Cr³⁺ substitution) kicks in when fluid Cr > 3 ppm; pink
  // imperial (Cr-rich + oxidizing conditions) above 8 ppm. Perfect basal
  // cleavage means partial dissolution can leave phantom surfaces inside.
  const sigma = conditions.supersaturation_topaz();

  if (sigma < 1.0) {
    // Very acid-resistant — only pH < 2 touches topaz, and slowly.
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 2.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      // Phase 1e: Al + SiO2 + F credits via MINERAL_DISSOLUTION_RATES.topaz.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d,
        note: `strong-acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Al³⁺, SiO₂, F⁻ released`,
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  if (T > 450) crystal.dominant_forms = ['m{110} prism', 'y{041} pyramid', 'c{001} pinacoid', 'stubby'];
  else if (T > 380) crystal.dominant_forms = ['m{110} prism', 'y{041} pyramid', '{021} pyramid'];
  else crystal.dominant_forms = ['m{110} prism', 'steep {021}+{041} pyramids', 'c{001} basal cleavage'];

  // Imperial color flag — the Ouro Preto signature comes from trace Cr³⁺
  // leached from nearby ultramafic country rock, NOT from the main pegmatite
  // or metamorphic fluid itself.
  const Cr_fluid = conditions.fluid.Cr;
  const F_fluid = conditions.fluid.F;
  let color_note;
  if (Cr_fluid > 8.0) {
    color_note = `pink imperial (Cr³⁺ ${Cr_fluid.toFixed(1)} ppm — rare, Cr⁴⁺ oxidation-state coloring)`;
    crystal.habit = 'prismatic_imperial_pink';
  } else if (Cr_fluid > 3.0) {
    color_note = `imperial golden-orange (Cr³⁺ ${Cr_fluid.toFixed(1)} ppm — the Ouro Preto signature)`;
    crystal.habit = 'prismatic_imperial';
  } else if (F_fluid > 40 && conditions.fluid.Fe < 5 && Cr_fluid < 0.5) {
    color_note = 'pale blue (F-rich fluid, no Cr chromophore)';
  } else if (conditions.fluid.Fe > 15) {
    color_note = 'pale yellow to brown (Fe³⁺ substitution)';
  } else {
    color_note = 'colorless to water-clear';
  }

  const trace_Fe = conditions.fluid.Fe * 0.008;
  const trace_Al = conditions.fluid.Al * 0.02;
  const trace_Ti = conditions.fluid.Ti * 0.015;

  // Fluid inclusions at growth-zone boundaries — topaz is famous for them.
  // Morteani 2002 pinned Ouro Preto at 360°C via microthermometry.
  let fi = false, fi_type = '';
  if (rate > 4 && rng.random() < 0.25) {
    fi = true;
    if (T > 350) fi_type = '2-phase (liquid + vapor) — geothermometer primary';
    else if (T > 150) fi_type = '2-phase (liquid-dominant)';
    else fi_type = 'single-phase liquid (late, low-T)';
  }

  conditions.fluid.Al = Math.max(conditions.fluid.Al - rate * 0.015, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.012, 0);
  conditions.fluid.F = Math.max(conditions.fluid.F - rate * 0.018, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth — potential growth hillocks');
  else if (excess < 0.2) parts.push('near-equilibrium — gem-quality potential');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Al, trace_Ti,
    fluid_inclusion: fi, inclusion_type: fi_type,
    note: parts.join(', '),
  });
}

function grow_apophyllite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_apophyllite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      // Phase 1e: K + Ca + SiO2 + F credits via MINERAL_DISSOLUTION_RATES.apophyllite.
      // (Legacy used constants with thickness_um=-2.0; table rates =
      // constant/2.0 give identical credit amounts.)
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — K, Ca, SiO₂, F released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 5.0 * excess * rng.uniform(0.7, 1.3);

  if (excess > 1.8) {
    crystal.habit = 'druzy_crust';
    crystal.dominant_forms = ['fine-grained drusy coating', 'sparkling colorless'];
  } else if (excess > 1.0) {
    crystal.habit = 'hopper_growth';
    crystal.dominant_forms = ['stepped/terraced {001} faces', 'skeletal hopper crystals'];
  } else if (excess > 0.4) {
    crystal.habit = 'prismatic_tabular';
    crystal.dominant_forms = ['pseudo-cubic tabular {001} + {110}', 'transparent to pearly'];
  } else {
    crystal.habit = 'chalcedony_pseudomorph';
    crystal.dominant_forms = ['chalcedony pseudomorph after earlier zeolite blade', 'massive milky'];
  }

  let hematite_note = '';
  if (conditions.fluid.Fe > 8 && conditions.fluid.O2 > 0.2 && rng.random() < 0.4) {
    hematite_note = " (hematite needle phantoms — bloody apophyllite zone)";
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.05,
    note: `${crystal.habit} K-Ca-Si zeolite${hematite_note}`
  });
}

// v63 brief-19: chrysoprase — Ni-bearing chalcedony (microfibrous SiO2 +
// Ni-clay nano-inclusions). First chalcedony habit in the sim.
function grow_chrysoprase(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chrysoprase();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.temperature > 150) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'thermal fade above 150°C — Ni-clay nano-inclusions destabilize, color fades to white/yellow-brown',
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 2.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 2.5) { crystal.habit = 'nodular_massive'; crystal.dominant_forms = ['rounded apple-green nodule in saprolite']; }
  else if (sigma > 1.6) { crystal.habit = 'banded_chalcedony'; crystal.dominant_forms = ['flow-banded chalcedony']; }
  else { crystal.habit = 'chalcedony_vein'; crystal.dominant_forms = ['fracture-fill chalcedony fabric']; }
  let color_note;
  if (conditions.fluid.Ni > 500) color_note = 'deep emerald chrysoprase (Szklary aesthetic — Ni > 500 ppm)';
  else if (conditions.fluid.Ni < 100) color_note = 'pale yellow-green chrysoprase (lower-Ni grade)';
  else color_note = 'apple-green chrysoprase (Marlborough aesthetic) — Ni-clay nano-inclusions in chalcedony fabric';
  if (conditions.fluid.Fe > 30) color_note += '; olive muddying (Fe staining)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Ni: conditions.fluid.Ni * 0.01,
    trace_Mg: conditions.fluid.Mg * 0.005,
    note: color_note,
  });
}

// v110 (2026-05-20): Datolite CaB(SiO4)(OH) — first mineral of the
// Jeffrey Mine rodingite arc. Calcium boronosilicate (sorosilicate
// with B in one tetrahedral site). Lake Superior basalt-amygdale OR
// rodingite-contact paragenesis. Habit dispatch:
//   crystallized_gem (default; colorless to pale-yellow monoclinic
//      {110}/{011}/{102} crystals — the Jeffrey/Lake Superior cabinet
//      aesthetic)
//   gemmy_vitreous_terminated (high excess; sharp-faced gem crystals
//      to several cm — best-of-Jeffrey specimens)
//   botryoidal_white (low excess; calcite-like massive coating —
//      common Lake Superior basalt vug filling)
//   pseudomorph_after_calcite (rare; Bernardini 1981 notes some
//      Jeffrey datolite forms after calcite substrate consumption)
// Color dispatch:
//   Cu trace > 1 ppm → pale pink-brown (Lake Superior Cu-stained
//      "copper-bearing datolite" of Bornhorst 2017)
//   Fe trace > 5 ppm → pale-yellow (canary tint; Italian Alps
//      datolite)
//   pure → colorless gem (Jeffrey best material)
// Substrate priority: prehnite (when wired v113) > wollastonite
// (v113) > calcite > native_copper > magnetite > wall.
function grow_datolite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_datolite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.08);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — datolite releases Ca + B(OH)3 + H4SiO4 to fluid`,
      });
    }
    if (crystal.total_growth_um > 5 && conditions.temperature > 400) {
      // Thermal breakdown: datolite → wollastonite + boric acid
      crystal.dissolved = true;
      const d = Math.min(1.5, crystal.total_growth_um * 0.05);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'thermal_decomp',
        note: `thermal breakdown > 400°C — datolite decomposes to wollastonite + boric acid`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Habit dispatch — substrate-driven first, then σ-driven
  const pos = crystal.position || '';
  const on_calcite = pos.includes('calcite');
  const on_prehnite = pos.includes('prehnite');
  const on_wollastonite = pos.includes('wollastonite');
  const on_native_copper = pos.includes('native_copper');
  const pseudomorph_after_calcite = pos.includes('pseudomorph after calcite');

  if (pseudomorph_after_calcite) {
    crystal.habit = 'pseudomorph_after_calcite';
    crystal.dominant_forms = ['calcite scalenohedron outline preserved', 'datolite fill — porcelaneous interior'];
  } else if (excess > 1.4) {
    crystal.habit = 'gemmy_vitreous_terminated';
    crystal.dominant_forms = ['gemmy monoclinic {110}', 'terminated {011}/{102}', 'vitreous to adamantine luster'];
  } else if (excess > 0.4) {
    crystal.habit = 'crystallized_gem';
    crystal.dominant_forms = ['monoclinic prismatic {110}', 'modified {011}', 'small terminated crystals'];
  } else {
    crystal.habit = 'botryoidal_white';
    crystal.dominant_forms = ['botryoidal porcelaneous coating', 'reniform white-to-pale-tan crusts'];
  }

  // Color dispatch — trace cations read off existing fields
  let color_note;
  if (conditions.fluid.Cu > 1.0) {
    color_note = 'pale pink-brown copper-bearing datolite (Lake Superior aesthetic — Cu inclusions in growth zones per Bornhorst 2017)';
  } else if (conditions.fluid.Fe > 5.0) {
    color_note = 'pale-yellow Fe-tinted datolite (Italian Alps canary tint)';
  } else {
    color_note = 'colorless gem datolite (Jeffrey best material aesthetic)';
  }

  // Substrate flavor for the growth-zone note
  let substrate_flavor;
  if (on_prehnite) substrate_flavor = ' on prehnite — Lake Superior amygdale paragenesis';
  else if (on_wollastonite) substrate_flavor = ' on wollastonite — Jeffrey rodingite contact';
  else if (on_calcite) substrate_flavor = ' on calcite — basalt-amygdale or rodingite contact';
  else if (on_native_copper) substrate_flavor = ' with native copper — Keweenaw signature';
  else substrate_flavor = '';

  // Mass-balance debits — formula CaB(SiO4)(OH)
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.020, 0);
  conditions.fluid.B = Math.max(conditions.fluid.B - rate * 0.005, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.030, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Cu: conditions.fluid.Cu > 0.5 ? conditions.fluid.Cu * 0.005 : 0,
    trace_Fe: conditions.fluid.Fe > 2.0 ? conditions.fluid.Fe * 0.003 : 0,
    note: `datolite ${crystal.habit}, ${color_note}${substrate_flavor}; CaB(SiO4)(OH) calcium boronosilicate, monoclinic P21/c, H 5-5.5, glassy fracture`,
  });
}
