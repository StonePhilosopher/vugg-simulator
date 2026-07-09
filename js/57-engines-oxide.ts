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
    // v225: record the chromium the note has always narrated ("Cr³⁺ X
    // ppm" = f.Cr — Cr³⁺ substitutes Al³⁺ compatibly, lattice ≈ fluid
    // here). The UV rules' numeric arm reads this; pre-v225 records
    // keep replaying through the note arm.
    trace_Cr: f.Cr,
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
    // v225: record Cr like ruby does — the pink-sapphire note narrates
    // it, and pink Cr-sapphire fluoresces weak red on the same physics.
    trace_Cr: f.Cr,
    note: parts.join(', '),
  });
}

// v63 brief-19: rutile TiO2 — tetragonal Ti oxide, the 'needle' mineral.
// Refractory; chemically inert.
function grow_rutile(crystal, conditions, step) {
  const sigma = conditions.supersaturation_rutile();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  let rate = 2.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  const T = conditions.temperature;
  if (T > 500 && sigma < 1.5) { crystal.habit = 'stout_prismatic'; crystal.dominant_forms = ['coarse alpine-cleft prism with dipyramid termination']; }
  else if (sigma > 2.0 && T < 300) { crystal.habit = 'sixling_star'; crystal.dominant_forms = ['cyclic-sixling reticulated star (rare)']; }
  else { crystal.habit = 'acicular_needle'; crystal.dominant_forms = ['slender vertically-striated prism']; }
  let color_note;
  if (conditions.fluid.Cr > 5) color_note = 'red Cr-rutile (rare)';
  else if (conditions.fluid.Fe > 10) color_note = 'black nigrine (Fe-rich)';
  else if (conditions.fluid.Fe < 2) color_note = 'golden yellow rutile (low-Fe alpine cleft)';
  else color_note = 'red-brown adamantine rutile prism';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    trace_Cr: conditions.fluid.Cr * 0.01,
    note: color_note,
  });
}

// v89 (2026-05-19): cassiterite SnO2 — primary tin ore, tetragonal
// dipyramidal. Three formation environments differentiated by T at
// nucleation (per research-cassiterite.md §Habit correlation):
//   T > 500°C  → prismatic_dipyramid (Erzgebirge pegmatite + Bolivia
//                hydrothermal vein, the iconic display habit)
//   300-500°C  → equant_octahedral (greisen-stage Cornwall, blocky)
//   T < 300°C  → botryoidal_woodtin (low-T "wood tin", concentric
//                colloidal banding, the placer-source habit)
// Inert: no acid dissolution, no thermal decomposition path under
// any geological conditions (research §Decomposition & Stability:
// "Cassiterite is inert. Does not dissolve, decompose, or oxidize").
function grow_cassiterite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_cassiterite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  // Growth rate: slow oxide deposition, comparable to rutile/chromite
  // base rate. Sn is incorporated 1:1 with the formula unit; trace
  // Fe/Nb/Ta sequestered per growth zone.
  const rate = 2.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  const f = conditions.fluid;

  // Habit dispatch by formation T at nucleation (research §Habit
  // correlation). Each habit name maps to a renderer geometry token
  // declared in the minerals.json habit_variants.
  let habit_note;
  if (T > 500) {
    crystal.habit = 'prismatic_dipyramid';
    crystal.dominant_forms = ['{110} tetragonal prism', '{111} pyramidal termination', 'elbow_twin {011} ~60° bend (diagnostic)'];
    habit_note = 'prismatic dipyramid — Erzgebirge / Bolivia pegmatite habit (T > 500°C)';
  } else if (T >= 300) {
    crystal.habit = 'equant_octahedral';
    crystal.dominant_forms = ['{110} prism', '{100} pinacoid', 'equant blocky'];
    habit_note = 'equant blocky cassiterite — Cornwall greisen habit (T 300-500°C)';
  } else {
    crystal.habit = 'botryoidal_woodtin';
    crystal.dominant_forms = ['botryoidal globule', 'concentric colloidal banding', '"wood tin" texture'];
    habit_note = 'botryoidal wood tin — concentric banded colloidal habit (T < 300°C)';
  }

  // Color modulation by trace Fe (research: "Fe 10-1000 ppm darkens").
  // Pure cassiterite is honey-yellow to amber; Fe-rich is black "tin
  // pitch" (the historical Cornish miners' tinstone color).
  let color_note;
  if (f.Fe > 100) color_note = 'black tin-pitch (Fe-darkened, the Cornish "black jack" of the tinstone tradition)';
  else if (f.Fe > 30) color_note = 'red-brown cassiterite (moderate Fe)';
  else if (f.Fe > 5) color_note = 'amber to chocolate-brown cassiterite (trace Fe)';
  else color_note = 'honey-yellow cassiterite (low-Fe, the gem-quality "tin gem" form)';
  habit_note += `; ${color_note}`;

  // Twin annotation — elbow/knee twins on {011} are diagnostic for
  // cassiterite (research §Crystal Habits & Morphology: "Twin signature:
  // Elbow/knee twins on {011} bent ~60°; diagnostic feature").
  if (excess > 0.6 && rng.random() < 0.30) {
    crystal.twinned = true;
    crystal.twin_law = 'cassiterite_011_elbow';
    habit_note += ' — {011} elbow twin (the diagnostic ~60° knee bend)';
  }

  // Nb/Ta coupled substitution annotation (research: "Nb/Ta trace-1%,
  // coupled substitution")
  if (f.Bi > 5 || f.W > 10) {
    habit_note += `; trace Nb/Ta indicators (Bi ${f.Bi.toFixed(1)}, W ${f.W.toFixed(1)} ppm) — coupled-substitution evidence`;
  }

  // Mass balance: Sn consumed (the primary deposition); trace Fe + W
  // sequestered as growth-zone metadata.
  f.Sn = Math.max(f.Sn - rate * 0.025, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: f.Fe * 0.008,
    trace_W: f.W * 0.005,
    note: habit_note,
  });
}

// v102 (2026-05-19): pyrolusite β-MnO2 — tetragonal rutile-type Mn(IV)
// oxide, the default Mn4+ supergene endmember. Two formation modes:
// continental weathering (mode A, 95%) and low-T hydrothermal vein
// (mode B, 5%). Per the dossier:
//   * massive_sooty (default, ~65%): T < 25, Mn 0.3-2 ppm. Soils-the-
//     fingers black powder, the field-recognizable Mn-rind texture.
//   * botryoidal_reniform: Mode A, higher Mn (>5 ppm), pH 7-8, stable
//     groundwater table. Mammillary surfaces, classic "manganese rind."
//   * radiating_fibrous (polianite-style): Mode B hydrothermal,
//     replacement of manganite needles in vug. Cleavage perpendicular
//     to wall, up to 8 cm. Source of the rare Ilfeld specimens.
//   * prismatic_crystal (rare): Mode B, slow growth at low sigma on
//     clean vug wall, long-prismatic ‖ [001].
//   * pseudomorph_after_rhodochrosite / after_manganite: substrate-
//     driven, encodes the canonical Mn-weathering paragenesis.
//
// IMPORTANT (Potter & Rossman 1979): we do NOT ship a dendritic habit.
// Most "dendritic pyrolusite" in textbooks is actually cryptomelane/
// romanechite. The engine refuses to perpetuate the textbook error;
// dendritic habits route to those cousins when their engines land.
//
// Dissolution: acid (pH < 5.0) + grown > 5 µm → Mn²⁺ released back to
// fluid. Pyrolusite is stable to alkali but dissolves readily in acidic
// mine drainage (the standard Mn-oxide AMD signature).
function grow_pyrolusite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_pyrolusite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.08);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Mn²⁺ released to fluid, AMD-style Mn-oxide leach`
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  // Slow growth — oxidation-rate-limited (Hem 1963). Comparable to
  // hematite/goethite supergene rates.
  const rate = 1.5 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;

  const T = conditions.temperature;
  const f = conditions.fluid;
  const pos = crystal.position || '';
  const on_rhodochrosite = pos.includes('rhodochrosite');
  const on_manganite = pos.includes('manganite');
  const on_siderite = pos.includes('siderite');

  let habit_note;
  if (on_rhodochrosite) {
    crystal.habit = 'pseudomorph_after_rhodochrosite';
    crystal.dominant_forms = ['rhodochrosite rhomb outline preserved', 'sooty black MnO2 fill'];
    habit_note = 'pseudomorph after rhodochrosite — "rotted rhomb" texture, classic supergene Mn-carbonate weathering';
  } else if (on_manganite) {
    crystal.habit = 'pseudomorph_after_manganite';
    crystal.dominant_forms = ['manganite prismatic outline preserved', 'radiating fibrous MnO2'];
    habit_note = 'polianite — pseudomorph after manganite, b-axis 15% contraction (Champness 1971)';
  } else if (on_siderite) {
    crystal.habit = 'massive_sooty';
    crystal.dominant_forms = ['Fe-Mn wad coating', 'mixed Fe/Mn oxide stain'];
    habit_note = 'Fe-Mn weathering "wad" — sooty black on Mn-bearing siderite';
  } else if (T > 100 && excess > 0.6) {
    // Mode B hydrothermal vein
    if (excess > 1.4) {
      crystal.habit = 'radiating_fibrous';
      crystal.dominant_forms = ['radiating fibrous bundles', 'perpendicular to vug wall'];
      habit_note = 'radiating fibrous "polianite-style" — Mode B hydrothermal vein (Ilfeld habit)';
    } else {
      crystal.habit = 'prismatic_crystal';
      crystal.dominant_forms = ['long-prismatic ‖ [001]', '{110} tetragonal prism', 'square cross-section'];
      habit_note = 'prismatic crystal — rare Mode B slow-growth habit (Platten/Ilmenau type material)';
    }
  } else if (T < 35 && f.Mn > 5 && f.pH >= 7.0 && f.pH <= 8.0 && excess > 0.4) {
    crystal.habit = 'botryoidal_reniform';
    crystal.dominant_forms = ['mammillary botryoidal surface', 'concentric internal banding'];
    habit_note = 'botryoidal reniform — stable groundwater table, classic "manganese rind"';
  } else {
    crystal.habit = 'massive_sooty';
    crystal.dominant_forms = ['sooty earthy aggregate', 'soils-the-fingers black powder'];
    habit_note = 'massive sooty — continental-weathering endmember, the field-common form';
  }

  // Mn-Fe ratio note for the growth zone
  if (f.Fe > 2 * f.Mn) {
    habit_note += ` (Fe/Mn ${(f.Fe / Math.max(f.Mn, 0.01)).toFixed(1)} — losing the oxidation competition to goethite)`;
  }

  // Mass balance — Mn consumed primarily. Trace Ba/K/Pb sequestered as
  // tunnel-cation indicators (low values; tunnel cations partition into
  // pyrolusite weakly compared to romanechite/cryptomelane/coronadite).
  f.Mn = Math.max(f.Mn - rate * 0.030, 0);
  f.O2 = Math.max(f.O2 - rate * 0.005, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Ba: f.Ba * 0.002,
    trace_K: f.K * 0.001,
    note: `${habit_note} — Mn ${f.Mn.toFixed(1)} ppm at pH ${f.pH.toFixed(1)}, T=${T.toFixed(0)}°C, σ=${sigma.toFixed(2)}`,
  });
}

// v63 brief-19: chromite FeCr2O4 — magmatic Fe-Cr spinel.
function grow_chromite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chromite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  let rate = 4.0 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 2.5) { crystal.habit = 'massive_granular'; crystal.dominant_forms = ['cumulate granular fabric']; }
  else { crystal.habit = 'octahedral'; crystal.dominant_forms = ['black metallic octahedron']; }
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Cr: conditions.fluid.Cr * 0.015,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `black FeCr2O4 spinel — Cr ${conditions.fluid.Cr.toFixed(0)} Fe ${conditions.fluid.Fe.toFixed(0)} ppm at T=${conditions.temperature.toFixed(0)}°C`,
  });
}

// v114 (2026-05-20): Brucite Mg(OH)2 — trigonal Mg hydroxide. The
// serpentinization byproduct. Diagnostic hyperalkaline pH 10-13
// (above magnesite-carbonate stability). Habits:
//   tabular_hexagonal (default) — flat hexagonal {0001} plates
//   foliated_mass (low σ) — the field-aesthetic massive form
//   pearly_lamellae (high σ) — pearly-vitreous {0001} cleavage flakes
function grow_brucite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_brucite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 8.5) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.10);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — brucite Mg(OH)2 unstable below pH 8.5; releases Mg²⁺ + 2OH⁻ to fluid`,
      });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.CO3 > 50) {
      // Carbonatization: brucite + CO2 → magnesite + H2O
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.08);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'carbonatization',
        note: `carbonatization (CO3 ${conditions.fluid.CO3.toFixed(0)} ppm) — brucite + CO2 → magnesite + H2O`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.8 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Habit dispatch
  if (excess > 1.2) {
    crystal.habit = 'pearly_lamellae';
    crystal.dominant_forms = ['pearly-vitreous flat {0001} cleavage flakes', 'partial bunched lamellar morphology', 'best-of-cabinet plates from Asbestos QC + Wood\'s Mine PA'];
  } else if (excess < 0.3) {
    crystal.habit = 'foliated_mass';
    crystal.dominant_forms = ['compact foliated massive', 'no terminations — the field aesthetic'];
  } else {
    crystal.habit = 'tabular_hexagonal';
    crystal.dominant_forms = ['tabular hexagonal {0001}', 'flat plates with hexagonal outline'];
  }

  // Mass-balance debit — Mg(OH)2
  conditions.fluid.Mg = Math.max(conditions.fluid.Mg - rate * 0.050, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `brucite ${crystal.habit}, white to pale-blue-green; trigonal Mg(OH)2, H 2.5, pearly cleavage flexible flakes`,
  });
}
