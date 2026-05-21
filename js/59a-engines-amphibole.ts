// ============================================================
// js/59a-engines-amphibole.ts — amphibole-class grow engines
// ============================================================
// v116 (2026-05-20): commercial-asbestos quintet — tremolite,
// actinolite, anthophyllite, amosite, crocidolite. All five engines
// share the same habit-dispatch structure:
//
//   fibrous_asbestiform  — the diagnostic ASBESTOS habit; wide wall-
//                          spread (0.85+), low void-reach (0.10-0.15);
//                          renders as a MAT covering the cavity wall,
//                          not projecting fibers. Per boss's v116
//                          guidance: "rendered like malachite or
//                          chalcedony, more as a wide area of effect."
//   bladed_columnar      — the non-asbestiform "normal" amphibole form;
//                          moderate wall-spread (0.45), moderate void-
//                          reach (0.55); the cabinet morphology with
//                          discrete crystals.
//   massive_compact      — granular felted aggregates (nephrite-jade
//                          for actinolite); high wall-spread, low void-
//                          reach.
//
// The asbestiform-vs-not dispatch is σ-driven: HIGH σ → asbestiform
// (rapid fiber growth in confined channels); MODERATE σ → bladed;
// LOW σ → massive. This matches the geological observation that
// asbestiform habit results from sustained-supersaturation growth in
// narrow fractures, not from open cavity crystallization.
//
// ASBESTOS HEALTH CONTEXT: WHO recognizes all 6 commercial asbestos
// minerals as carcinogenic. Crocidolite + tremolite are the most
// aggressive (lung cancer + mesothelioma). The mineral engines encode
// the GEOLOGY here; the health context is documented in minerals.json
// description fields + scenario notes where relevant. Asbestos
// regulation closed Wittenoom (1966) and Jeffrey (2011); the mineral
// identity itself is geologically scientifically important regardless.

function grow_tremolite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_tremolite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — tremolite releases Ca + Mg + Si to fluid`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Habit dispatch — σ-driven, asbestiform on high-σ
  if (excess > 1.4) {
    crystal.habit = 'fibrous_asbestiform';
    crystal.dominant_forms = ['parallel-bundle silky white fibers', 'asbestiform habit — the WHO-recognized health-hazard form; matts the cavity wall'];
  } else if (excess > 0.5) {
    crystal.habit = 'bladed_columnar';
    crystal.dominant_forms = ['bladed prismatic white crystals', '{110} cleavage at 56°/124°', 'classic amphibole morphology'];
  } else {
    crystal.habit = 'massive_compact';
    crystal.dominant_forms = ['compact felted aggregate', 'low-relief surface mass'];
  }

  // Mass-balance debits — Ca2 Mg5 Si8
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.012, 0);
  conditions.fluid.Mg = Math.max(conditions.fluid.Mg - rate * 0.030, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.048, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `tremolite ${crystal.habit}, white-to-pale-green Ca-Mg amphibole; monoclinic Ca2Mg5Si8O22(OH)2, H 5-6, vitreous`,
  });
}

function grow_actinolite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_actinolite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — actinolite releases Ca + Mg + Fe + Si to fluid`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Habit dispatch
  let nephrite_match = false;
  if (excess > 0.6 && conditions.temperature < 350 && conditions.fluid.Ca > 100) {
    // Nephrite-jade conditions: cool greenschist-facies + compact felted
    nephrite_match = true;
    crystal.habit = 'nephrite_compact';
    crystal.dominant_forms = ['compact felted-fibrous actinolite mass', 'the nephrite-jade gem variety (Pounamu NZ, Chinese imperial)', 'translucent green'];
  } else if (excess > 1.4) {
    crystal.habit = 'fibrous_asbestiform';
    crystal.dominant_forms = ['fibrous actinolite-asbestos', 'green silky parallel bundles', 'WHO-recognized asbestos variety'];
  } else if (excess > 0.5) {
    crystal.habit = 'bladed_columnar';
    crystal.dominant_forms = ['bladed prismatic green crystals', '{110} cleavage at 56°', 'amphibole classic'];
  } else {
    crystal.habit = 'massive_compact';
    crystal.dominant_forms = ['massive granular green aggregate'];
  }

  // Color dispatch
  let color_note;
  const cr = conditions.fluid.Cr;
  if (cr > 1.0) {
    color_note = 'emerald-green chromian actinolite ("smaragdite" variety; Cr³⁺ d-d transitions)';
  } else if (nephrite_match) {
    color_note = 'green nephrite — the gem variety, translucent felted-fibrous';
  } else {
    color_note = 'green Fe-bearing actinolite (Fe²⁺ M-site crystal field)';
  }

  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.012, 0);
  conditions.fluid.Mg = Math.max(conditions.fluid.Mg - rate * 0.018, 0);
  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.020, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.048, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe > 10 ? conditions.fluid.Fe * 0.005 : 0,
    trace_Cr: conditions.fluid.Cr > 0.5 ? conditions.fluid.Cr * 0.008 : 0,
    note: `actinolite ${crystal.habit}, ${color_note}; monoclinic Ca2(Mg,Fe)5Si8O22(OH)2, H 5-6`,
  });
}

function grow_anthophyllite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_anthophyllite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — anthophyllite releases Mg + Fe + Si`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Anthophyllite is COMMONLY ASBESTIFORM — bias the default toward
  // fibrous habit. Open-cavity prismatic crystals are rarer.
  if (excess > 0.8) {
    crystal.habit = 'fibrous_asbestiform';
    crystal.dominant_forms = ['parallel-bundle brown-grey fibers', 'orthorhombic asbestiform anthophyllite (Finland + Carolina type)', 'WHO-recognized asbestos variety'];
  } else if (excess > 0.4) {
    crystal.habit = 'prismatic_brown';
    crystal.dominant_forms = ['orthorhombic prismatic brown crystals', '{210} cleavage', 'less common open-cavity form'];
  } else {
    crystal.habit = 'massive_compact';
    crystal.dominant_forms = ['compact brown-grey aggregate'];
  }

  conditions.fluid.Mg = Math.max(conditions.fluid.Mg - rate * 0.038, 0);
  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.020, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.048, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `anthophyllite ${crystal.habit}, brown-to-grey-brown Mg-Fe orthoamphibole; orthorhombic (Mg,Fe)7Si8O22(OH)2, H 5.5-6`,
  });
}

function grow_amosite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_amosite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — amosite releases Fe + Si to fluid`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Amosite is by definition the ASBESTIFORM variety — strongly bias
  // toward fibrous. Non-asbestiform cummingtonite would be a separate
  // mineral entry (deferred).
  if (excess > 0.4) {
    crystal.habit = 'fibrous_asbestiform';
    crystal.dominant_forms = ['parallel-bundle brown silky fibers', 'cummingtonite-grunerite asbestos', '"brown asbestos" of South African commerce (Penge type)', 'WHO-recognized health-hazard variety'];
  } else {
    crystal.habit = 'prismatic_brown';
    crystal.dominant_forms = ['prismatic brown amphibole crystals (rare non-asbestiform end)'];
  }

  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.045, 0);
  conditions.fluid.Mg = Math.max(conditions.fluid.Mg - rate * 0.010, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.048, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `amosite ${crystal.habit}, "brown asbestos" Fe-dominant cummingtonite-grunerite asbestiform variety; monoclinic ~(Fe,Mg)7Si8O22(OH)2`,
  });
}

function grow_crocidolite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_crocidolite();
  if (sigma < 1.0) {
    // Crocidolite OXIDIZES — this is the tiger's eye precursor reaction.
    // At elevated O2 + temperature, Fe2+ → Fe3+ + the Na is exchanged
    // out, the fiber bundles get SILICA-REPLACED by chalcedony in
    // pseudomorph (the famous gold-brown chatoyant gemstone).
    if (crystal.total_growth_um > 5 && conditions.fluid.O2 > 0.4) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'oxidative',
        note: `oxidative dissolution (O₂ ${conditions.fluid.O2.toFixed(1)}) — crocidolite Fe²⁺ oxidizes to Fe³⁺; tiger's eye CHALCEDONY PSEUDOMORPH precursor reaction. Na released to fluid; Fe³⁺ creates the chatoyant golden-brown color in chalcedony fiber pseudomorph.`,
      });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.04);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — crocidolite releases Na + Fe + Si`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  // Crocidolite is by definition the ASBESTIFORM variety — bias fibrous.
  if (excess > 0.4) {
    crystal.habit = 'fibrous_asbestiform';
    crystal.dominant_forms = ['parallel-bundle deep blue silky fibers', 'riebeckite asbestos — "BLUE ASBESTOS"', 'the most carcinogenic asbestos variety per WHO + Frank et al. 2002', 'Wittenoom Australia + Northern Cape SA type material'];
  } else {
    crystal.habit = 'massive_blue';
    crystal.dominant_forms = ['massive blue-grey crocidolite mass (rare non-asbestiform)'];
  }

  // Color dispatch — partial oxidation creates "hawk's eye" intermediate
  let color_note;
  if (conditions.fluid.O2 > 0.2 && conditions.fluid.O2 < 0.4) {
    color_note = 'hawk\'s eye intermediate (partial oxidation — blue-grey-gold chatoyant); precursor to full tiger\'s eye pseudomorph at higher O2';
  } else {
    color_note = 'deep blue to lavender-blue crocidolite; Na2Fe²⁺3Fe³⁺2 charge transfer';
  }

  conditions.fluid.Na = Math.max(conditions.fluid.Na - rate * 0.012, 0);
  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.050, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.048, 0);

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: `crocidolite ${crystal.habit}, ${color_note}; monoclinic Na2Fe²⁺3Fe³⁺2Si8O22(OH)2 riebeckite-asbestos variety`,
  });
}
