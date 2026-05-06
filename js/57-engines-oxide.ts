// ============================================================
// js/57-engines-oxide.ts — oxide-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/oxide.py. Minerals (7): corundum, cuprite, hematite, magnetite, ruby, sapphire, uraninite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_hematite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_hematite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.1);
      // Phase 1e: Fe credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.hematite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Fe²⁺ released back to fluid`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  if (conditions.temperature > 300) {
    crystal.habit = 'specular';
    crystal.dominant_forms = ['{001} basal plates', 'metallic platy'];
  } else if (conditions.temperature > 150) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['{101} rhombohedron'];
  } else {
    if (excess > 0.5) {
      crystal.habit = 'botryoidal';
      crystal.dominant_forms = ['kidney-ore texture'];
    } else {
      crystal.habit = 'earthy/massive';
      crystal.dominant_forms = ['microcrystalline aggregate'];
    }
  }

  if (crystal.habit === 'specular') crystal.a_width_mm = crystal.c_length_mm * 2.0;
  else if (crystal.habit === 'botryoidal') crystal.a_width_mm = crystal.c_length_mm * 1.2;

  const trace_Mn = conditions.fluid.Mn * 0.04;
  const trace_Fe = conditions.fluid.Fe * 0.2;

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  let color_note;
  if (crystal.habit === 'specular') {
    color_note = rng.random() < 0.03 ? 'iridescent (very thin plates — interference colors)' : 'steel-gray metallic';
  } else if (crystal.habit === 'earthy/massive' || crystal.habit === 'botryoidal') {
    color_note = 'red earthy';
  } else {
    color_note = 'dark gray metallic';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn,
    note: `${crystal.habit} habit, ${color_note}`
  });
}

function grow_uraninite(crystal, conditions, step) {
  // v12 (May 2026): Gatekeeper for the secondary U family. When sigma<1
  // AND O2>0.3 AND grown>3µm, uraninite oxidizes and releases UO₂²⁺
  // back to broth — feedstock for torbernite/zeunerite/carnotite.
  // Habit dispatch: T>500 octahedral (pegmatitic), else pitchblende_massive.
  const sigma = conditions.supersaturation_uraninite();

  if (sigma < 1.0) {
    // Oxidative dissolution: UO₂ + ½O₂ + 2H⁺ → UO₂²⁺ + H₂O
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.3) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.12);
      // Phase 1e: U credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.uraninite.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidation — uraninite weathers, releasing UO₂²⁺ (U fluid: ${conditions.fluid.U.toFixed(0)} ppm)`
      });
    }
    return null;
  }

  const rate = 0.008 * sigma * 1000 * rng.uniform(0.8, 1.2); // scale to µm
  if (rate < 0.1) return null;

  // Habit dispatch — research §157
  const T = conditions.temperature;
  if (T > 500) {
    crystal.habit = 'octahedral';
    crystal.dominant_forms = ['{111} octahedron'];
  } else {
    crystal.habit = 'pitchblende_massive';
    crystal.dominant_forms = ['botryoidal masses', 'colloform banding'];
  }

  // Phase 1d: U consumption owned by the wrapper (applyMassBalance).

  let color_note;
  if (T > 500) color_note = 'pitch-black, submetallic — pegmatitic octahedron';
  else if (T >= 200) color_note = 'greasy black pitchblende, botryoidal crust';
  else color_note = 'cryptocrystalline black mass — roll-front uraninite';

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `${color_note}, U fluid: ${conditions.fluid.U.toFixed(0)} ppm — radioactive`
  });
}

function grow_magnetite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_magnetite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && (conditions.fluid.pH < 2.5 || conditions.fluid.O2 > 1.4)) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.05);
      // Phase 1e: Fe credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.magnetite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `dissolution (pH ${conditions.fluid.pH.toFixed(1)}, O₂ ${conditions.fluid.O2.toFixed(1)}) — martite conversion if oxidizing` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.5) { crystal.habit = 'granular_massive'; crystal.dominant_forms = ['granular massive aggregate']; color_note = 'black massive magnetite'; }
  else if (conditions.temperature > 400 && excess > 0.5 && excess < 1.2) { crystal.habit = 'rhombic_dodecahedral'; crystal.dominant_forms = ['{110} rhombic dodecahedron', 'with mineralizer']; color_note = 'black rhombic dodecahedral (high-T, mineralizer-assisted)'; }
  else { crystal.habit = 'octahedral'; crystal.dominant_forms = ['{111} octahedron', 'metallic black']; color_note = 'black octahedral — strongly magnetic (lodestone)'; }
  f.Fe = Math.max(f.Fe - rate * 0.025, 0);
  f.O2 = Math.max(f.O2 - rate * 0.003, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: f.Fe * 0.03, note: color_note });
}

function grow_cuprite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_cuprite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && (conditions.fluid.pH < 3.5 || conditions.fluid.O2 > 1.5)) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.07);
      // Phase 1e: Cu credit handled by applyMassBalance via MINERAL_DISSOLUTION_RATES.cuprite.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `dissolution — Eh window exceeded (pH ${conditions.fluid.pH.toFixed(1)}, O₂ ${conditions.fluid.O2.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.5) { crystal.habit = 'chalcotrichite'; crystal.dominant_forms = ['hair-like {100} whiskers', 'plush velvet texture']; color_note = `chalcotrichite — hair-like Cu₂O whiskers (σ ${sigma.toFixed(2)}, rapid directional growth)`; }
  else if (excess > 0.8) { crystal.habit = 'massive_earthy'; crystal.dominant_forms = ['massive earthy "tile ore"', 'dark red-brown']; color_note = "massive earthy — 'tile ore' in dark red-brown (rapid growth in tight space)"; }
  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026); see Python equivalent for context. Spinel-twinned cuprite now carries the default 'octahedral' habit + the twinned flag.
  else { crystal.habit = 'octahedral'; crystal.dominant_forms = ['{111} octahedron', 'dark red to black with ruby internal reflection']; color_note = 'dark red octahedral (ruby-red internal reflection in thin crystals)'; }
  f.Cu = Math.max(f.Cu - rate * 0.035, 0);
  f.O2 = Math.max(f.O2 - rate * 0.002, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_corundum(crystal, conditions, step) {
  // Al₂O₃ colorless/generic — SiO₂-undersaturated Al-rich chemistry.
  // Acid-inert; no dissolution branch.
  const sigma = conditions.supersaturation_corundum();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  const [habit, forms] = _corundum_family_habit(conditions, excess);
  crystal.habit = habit;
  crystal.dominant_forms = forms;

  let color_note = 'colorless corundum (no chromophore above variety gate)';
  if (f.Ti > 0.1 && f.Ti < 0.5) color_note = `pale grey corundum (trace Ti ${f.Ti.toFixed(2)} ppm)`;
  else if (f.Fe > 1 && f.Fe < 5) color_note = `pale brown corundum (trace Fe ${f.Fe.toFixed(1)} ppm, below sapphire gate)`;

  const trace_Fe = f.Fe * 0.008;
  const trace_Ti = f.Ti * 0.020;
  const trace_Al = f.Al * 0.025;

  f.Al = Math.max(f.Al - rate * 0.015, 0);

  const parts = [color_note];
  if (excess > 1.0) parts.push('rapid growth — contact metamorphic pulse');
  else if (excess < 0.2) parts.push('near-equilibrium — gem-clarity interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Ti, trace_Al,
    note: parts.join(', '),
  });
}

function grow_ruby(crystal, conditions, step) {
  // Al₂O₃ + Cr³⁺ — red chromium variety. Asterism via rutile-needle trigger.
  const sigma = conditions.supersaturation_ruby();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  const [habit, forms] = _corundum_family_habit(conditions, excess);
  crystal.habit = habit;
  crystal.dominant_forms = forms;

  if (f.Ti > 0.3 && excess > 0.5 && rng.random() < 0.08) {
    crystal.habit = 'asterated';
    crystal.dominant_forms = ['c{0001} basal dominant', 'aligned rutile needles', '6-rayed asterism'];
  }

  let color_note;
  if (f.Cr > 10.0) color_note = `cherry-red ruby (Cr³⁺ ${f.Cr.toFixed(1)} ppm — deep saturation)`;
  else if (f.Cr > 5.0 && f.Fe > 1.0) color_note = `pigeon's blood ruby (Cr³⁺ ${f.Cr.toFixed(1)} + trace Fe — Mogok signature)`;
  else if (f.Cr > 3.0) color_note = `Mogok ruby red (Cr³⁺ ${f.Cr.toFixed(1)} ppm)`;
  else color_note = `pinkish ruby (Cr³⁺ ${f.Cr.toFixed(1)} ppm — near threshold)`;

  const trace_Fe = f.Fe * 0.008;
  const trace_Ti = f.Ti * 0.025;
  const trace_Al = f.Al * 0.025;

  f.Al = Math.max(f.Al - rate * 0.015, 0);
  f.Cr = Math.max(f.Cr - rate * 0.003, 0);

  const parts = [color_note];
  if (crystal.habit === 'asterated') parts.push('6-rayed asterism — rutile needle inclusions aligned along basal');
  if (excess > 1.0) parts.push('rapid growth — peak metamorphic pulse');
  else if (excess < 0.2) parts.push('near-equilibrium — gem-clarity interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Ti, trace_Al,
    note: parts.join(', '),
  });
}

function grow_sapphire(crystal, conditions, step) {
  // Al₂O₃ + Fe (+ optional Ti) — non-red corundum color family.
  const sigma = conditions.supersaturation_sapphire();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  const [habit, forms] = _corundum_family_habit(conditions, excess);
  crystal.habit = habit;
  crystal.dominant_forms = forms;

  if (f.Ti > 0.5 && excess > 0.5 && rng.random() < 0.06) {
    crystal.habit = 'asterated';
    crystal.dominant_forms = ['c{0001} basal dominant', 'aligned rutile needles', '6-rayed star sapphire'];
  }

  // Color sub-dispatch — priority: padparadscha > blue > yellow > pink > green
  let color_note, variety;
  if (f.Cr >= 0.5 && f.Cr < 2.0 && f.Fe >= 2 && f.Fe < 10) {
    color_note = `padparadscha (Cr³⁺ ${f.Cr.toFixed(2)} + Fe ${f.Fe.toFixed(1)} — pink-orange)`;
    variety = 'padparadscha';
  } else if (f.Fe >= 5 && f.Ti >= 0.5) {
    if (f.Fe < 10 && f.Ti < 1.5) {
      color_note = `cornflower blue sapphire (Fe ${f.Fe.toFixed(1)} + Ti ${f.Ti.toFixed(2)} — Kashmir-type)`;
      variety = 'cornflower_kashmir';
    } else {
      color_note = `royal blue sapphire (Fe ${f.Fe.toFixed(1)} + Ti ${f.Ti.toFixed(2)} — Fe-Ti intervalence)`;
      variety = 'royal_blue';
    }
  } else if (f.Fe >= 20) {
    color_note = `yellow sapphire (Fe³⁺ ${f.Fe.toFixed(0)} — Fe alone)`;
    variety = 'yellow';
  } else if (f.Cr > 0.5 && f.Cr < 2.0) {
    color_note = `pink sapphire (Cr³⁺ ${f.Cr.toFixed(2)} — sub-ruby threshold)`;
    variety = 'pink_sapphire';
  } else {
    color_note = `green sapphire (Fe ${f.Fe.toFixed(1)} — no Ti, oxidation-dependent)`;
    variety = 'green';
  }

  const trace_Fe = f.Fe * 0.012;
  const trace_Ti = f.Ti * 0.025;
  const trace_Al = f.Al * 0.025;

  f.Al = Math.max(f.Al - rate * 0.015, 0);
  if (variety === 'cornflower_kashmir' || variety === 'royal_blue') {
    f.Fe = Math.max(f.Fe - rate * 0.004, 0);
    f.Ti = Math.max(f.Ti - rate * 0.002, 0);
  } else if (variety === 'yellow') {
    f.Fe = Math.max(f.Fe - rate * 0.005, 0);
  } else if (variety === 'padparadscha') {
    f.Cr = Math.max(f.Cr - rate * 0.002, 0);
    f.Fe = Math.max(f.Fe - rate * 0.002, 0);
  } else if (variety === 'pink_sapphire') {
    f.Cr = Math.max(f.Cr - rate * 0.002, 0);
  } else {
    f.Fe = Math.max(f.Fe - rate * 0.003, 0);
  }

  const parts = [color_note];
  if (crystal.habit === 'asterated') parts.push('6-rayed asterism — aligned rutile inclusions along basal');
  if (excess > 1.0) parts.push('rapid growth — peak metamorphic pulse');
  else if (excess < 0.2) parts.push('near-equilibrium — gem-clarity interior');
  if (crystal.twinned) parts.push(`${crystal.twin_law} present`);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Ti, trace_Al,
    note: parts.join(', '),
  });
}
