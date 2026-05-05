// ============================================================
// js/58-engines-phosphate.ts — phosphate-class crystal-growth engines
// ============================================================
// Mirror of vugg/engines/phosphate.py. Minerals (11): autunite, carnotite, clinobisvanite, descloizite, mottramite, pyromorphite, torbernite, tyuyamunite, uranospinite, vanadinite, zeunerite.
//
// Each grow_<mineral>(crystal, conditions, step) is a pure function:
// reads VugConditions / Crystal state, mutates the crystal in place,
// returns the GrowthZone produced (or null to skip the step).
//
// Phase B8 of PROPOSAL-MODULAR-REFACTOR.

function grow_descloizite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_descloizite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['mammillary cherry-red crust', 'concentric layers'];
    habit_note = 'botryoidal descloizite — Mibladen / Berg-Aukas habit';
  } else if (excess > 0.6) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{010} pyramid', '{110} prism'];
    habit_note = 'prismatic descloizite — Tsumeb display habit';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{010} tabular', 'cherry-red plates'];
    habit_note = 'tabular descloizite — late-stage low-σ growth';
  }
  if (conditions.fluid.Cu > 10) {
    const cu_pct = Math.min(30, 100 * conditions.fluid.Cu / Math.max(conditions.fluid.Cu + conditions.fluid.Zn, 1));
    if (cu_pct > 5) habit_note += `; Cu-bearing (${cu_pct.toFixed(0)}% Cu in Zn-site, mottramite-intermediate)`;
  }
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb - rate * 0.005, 0);
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.010, 0);
  conditions.fluid.V  = Math.max(conditions.fluid.V  - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_mottramite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_mottramite();
  if (sigma < 1.0) return null;
  const excess = sigma - 1.0;
  const rate = 2.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['mammillary olive-green crust', 'concentric layers'];
    habit_note = 'botryoidal mottramite — Mottram St Andrew (Cheshire) type habit';
  } else if (excess > 0.6) {
    crystal.habit = 'prismatic';
    crystal.dominant_forms = ['{010} pyramid', '{110} prism'];
    habit_note = 'prismatic mottramite — Tsumeb olive-green crystals';
  } else {
    crystal.habit = 'tabular';
    crystal.dominant_forms = ['{010} tabular', 'olive-green plates'];
    habit_note = 'tabular mottramite — late-stage habit';
  }
  if (conditions.fluid.Zn > 10) {
    const zn_pct = Math.min(30, 100 * conditions.fluid.Zn / Math.max(conditions.fluid.Cu + conditions.fluid.Zn, 1));
    if (zn_pct > 5) habit_note += `; Zn-bearing (${zn_pct.toFixed(0)}% Zn in Cu-site, descloizite-intermediate)`;
  }
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb - rate * 0.005, 0);
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.010, 0);
  conditions.fluid.V  = Math.max(conditions.fluid.V  - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: habit_note });
}

function grow_torbernite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_torbernite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Cu += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.P += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + UO₂²⁺ + PO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0 && conditions.temperature < 30) {
    crystal.habit = "micaceous_book";
    crystal.dominant_forms = ["stacked tabular plates", "subparallel books"];
    habit_note = "stacked micaceous plates — high-σ Musonoi habit";
  } else if (excess > 0.3) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["tabular {001}", "square plates"];
    habit_note = "thin emerald-green plates — the diagnostic Schneeberg habit";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["earthy crust", "powdery coating"];
    habit_note = "earthy green crust — low-σ encrustation";
  }
  habit_note += "; emerald-green (Cu²⁺ + UO₂²⁺); non-fluorescent (Cu²⁺ quenches)";
  habit_note += "; ☢️ radioactive";
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.025, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.P = Math.max(conditions.fluid.P - rate * 0.05, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_zeunerite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_zeunerite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Cu += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.As += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + UO₂²⁺ + AsO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0 && conditions.temperature < 30) {
    crystal.habit = "micaceous_book";
    crystal.dominant_forms = ["stacked tabular plates", "subparallel books"];
    habit_note = "stacked micaceous plates — high-σ Schneeberg habit";
  } else if (excess > 0.3) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["tabular {001}", "square plates"];
    habit_note = "thin emerald-green plates — the diagnostic Schneeberg habit";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["scaly crust", "thin overlapping plates"];
    habit_note = "scaly encrustation — low-σ thin coating";
  }
  habit_note += "; emerald-green (Cu²⁺ + UO₂²⁺); non-fluorescent (Cu²⁺ quenches)";
  habit_note += "; ☢️ radioactive (U + As both decay-active)";
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu - rate * 0.025, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.06, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_carnotite(crystal, conditions, step) {
  // V-branch of the uranyl anion-competition trio (Round 9c). Almost
  // always forms as canary-yellow earthy crusts on sandstone — the
  // diagnostic Colorado Plateau habit. Mirror of vugg.py grow_carnotite.
  const sigma = conditions.supersaturation_carnotite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.K += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.V += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — K⁺ + UO₂²⁺ + VO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5 && conditions.temperature < 30) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["diamond-shaped {001} plates", "tabular crystals"];
    habit_note = "rare crystalline carnotite — diamond-shaped plates, the collector's prize";
  } else if (excess > 0.4) {
    crystal.habit = "earthy_crust";
    crystal.dominant_forms = ["canary-yellow earthy crust", "thin coating"];
    habit_note = "canary-yellow earthy crust — the diagnostic Colorado Plateau habit";
  } else {
    crystal.habit = "powdery_disseminated";
    crystal.dominant_forms = ["powdery yellow disseminations", "sandstone stain"];
    habit_note = "powdery yellow disseminations — the sandstone-stain form";
  }
  habit_note += "; bright canary-yellow (UO₂²⁺ charge-transfer); ☢️ radioactive";
  habit_note += "; non-fluorescent (vanadate matrix quenches uranyl emission)";
  if (conditions.fluid.Fe > 5 && conditions.temperature < 30) {
    habit_note += "; roll-front signature (oxidizing groundwater + sandstone host)";
  }
  conditions.fluid.K = Math.max(conditions.fluid.K - rate * 0.04, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.V = Math.max(conditions.fluid.V - rate * 0.05, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_autunite(crystal, conditions, step) {
  // Round 9d (May 2026): Ca-cation analog of torbernite. Same parent fluid,
  // opposite cation. The defining feature is the fluorescence: Ca²⁺ doesn't
  // quench the uranyl emission like Cu²⁺ does, so autunite glows intense
  // apple-green under LW UV. Mirror of vugg.py grow_autunite.
  const sigma = conditions.supersaturation_autunite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ca += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.P += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + UO₂²⁺ + PO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0 && conditions.temperature < 25) {
    crystal.habit = "micaceous_book";
    crystal.dominant_forms = ["stacked tabular plates", "subparallel books"];
    habit_note = "stacked micaceous plates — high-σ Margnac/Spruce-Pine habit";
  } else if (excess > 0.3) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["tabular {001}", "square plates"];
    habit_note = "thin canary-yellow plates — the diagnostic Saint-Symphorien habit";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["earthy crust", "yellow staining"];
    habit_note = "earthy yellow crust — 'yellow uranium ore' staining the host rock";
  }
  habit_note += "; canary-yellow (uranyl chromophore, no Cu²⁺ to muddy it)";
  habit_note += "; intense apple-green LW UV fluorescence (Ca²⁺ doesn't quench like Cu²⁺ does)";
  habit_note += "; ☢️ radioactive";
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.025, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.P = Math.max(conditions.fluid.P - rate * 0.05, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_uranospinite(crystal, conditions, step) {
  // Round 9e (May 2026): Ca-cation analog of zeunerite. Mirror of
  // vugg.py grow_uranospinite. Same parent fluid, opposite cation —
  // Ca²⁺ doesn't quench uranyl emission like Cu²⁺ does, so this is
  // strongly fluorescent yellow-green LW UV.
  const sigma = conditions.supersaturation_uranospinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ca += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.As += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + UO₂²⁺ + AsO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.0 && conditions.temperature < 25) {
    crystal.habit = "micaceous_book";
    crystal.dominant_forms = ["stacked tabular plates", "subparallel books"];
    habit_note = "stacked micaceous plates — high-σ Schneeberg/Margnac habit";
  } else if (excess > 0.3) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["tabular {001}", "square plates"];
    habit_note = "thin yellow tabular plates — the autunite-group habit (Schneeberg form)";
  } else {
    crystal.habit = "encrusting";
    crystal.dominant_forms = ["earthy crust", "yellow staining"];
    habit_note = "earthy yellow encrustation — secondary surface staining";
  }
  habit_note += "; yellow to greenish-yellow (uranyl chromophore)";
  habit_note += "; bright yellow-green LW UV fluorescence (Ca²⁺ doesn't quench like Cu²⁺)";
  habit_note += "; ☢️ radioactive (U + As both decay-active)";
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.025, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.06, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_tyuyamunite(crystal, conditions, step) {
  // Round 9e (May 2026): Ca-cation analog of carnotite. Mirror of
  // vugg.py grow_tyuyamunite. Same chemistry stage as carnotite,
  // orthorhombic instead of monoclinic. Crystalline tyuyamunite is
  // rare; the default is sandstone-staining earthy yellow crust.
  const sigma = conditions.supersaturation_tyuyamunite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(2.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ca += dissolved_um * 0.2;
      conditions.fluid.U += dissolved_um * 0.4;
      conditions.fluid.V += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH=${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + UO₂²⁺ + VO₄³⁻ released`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 1.5 * excess * (0.8 + rng.random() * 0.4);
  if (rate < 0.1) return null;
  let habit_note;
  if (excess > 1.5 && conditions.temperature < 30) {
    crystal.habit = "tabular_plates";
    crystal.dominant_forms = ["diamond-shaped {001} plates", "tabular crystals"];
    habit_note = "rare crystalline tyuyamunite — diamond-shaped plates from Tyuya-Muyun";
  } else if (excess > 0.4) {
    crystal.habit = "earthy_crust";
    crystal.dominant_forms = ["canary-yellow earthy crust", "thin coating"];
    habit_note = "canary-yellow earthy crust — the standard sandstone-staining habit";
  } else {
    crystal.habit = "powdery_disseminated";
    crystal.dominant_forms = ["powdery yellow disseminations", "sandstone stain"];
    habit_note = "powdery yellow disseminations — the sandstone-stain form";
  }
  habit_note += "; canary-yellow (UO₂²⁺ charge-transfer); ☢️ radioactive";
  habit_note += "; weakly fluorescent yellow-green LW UV (vanadate dampens, but Ca²⁺ helps slightly)";
  if (conditions.fluid.Fe > 5 && conditions.temperature < 30) {
    habit_note += "; roll-front signature (oxidizing groundwater + sandstone host)";
  }
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.025, 0);
  conditions.fluid.U = Math.max(conditions.fluid.U - rate * 0.04, 0);
  conditions.fluid.V = Math.max(conditions.fluid.V - rate * 0.05, 0);
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    note: habit_note,
  });
}

function grow_clinobisvanite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_clinobisvanite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 2.5) {
      crystal.dissolved = true;
      const d = Math.min(0.5, crystal.total_growth_um * 0.05);
      conditions.fluid.Bi += d * 0.4;
      conditions.fluid.V += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 2.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const f = conditions.fluid;
  let color_note;
  if (excess > 1.0) { crystal.habit = 'powdery_aggregate'; crystal.dominant_forms = ['powdery yellow-orange aggregate', 'micro-crystalline']; color_note = 'powdery orange-yellow clinobisvanite (rapid growth, thicker crust)'; }
  else { crystal.habit = 'micro_plates_yellow'; crystal.dominant_forms = ['{010} micro plates', 'yellow monoclinic']; color_note = 'bright yellow micro-platy clinobisvanite (photocatalyst for water splitting)'; }
  f.Bi = Math.max(f.Bi - rate * 0.025, 0);
  f.V = Math.max(f.V - rate * 0.012, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: color_note });
}

function grow_pyromorphite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_pyromorphite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      conditions.fluid.Pb += d * 0.3;
      conditions.fluid.P += d * 0.2;
      conditions.fluid.Cl += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  let color_note;
  if (f.Fe > 5.0) { color_note = `brown to olive-brown (Fe ${f.Fe.toFixed(0)} ppm)`; crystal.habit = 'brown_hex_barrel'; }
  else if (f.Ca > 80.0) { color_note = `pale yellow-orange (phosphoapatite-adjacent, Ca ${f.Ca.toFixed(0)} ppm)`; crystal.habit = 'yellow_hex_barrel'; }
  else { color_note = 'classic olive-green hexagonal barrel'; crystal.habit = 'olive_hex_barrel'; }

  if (excess > 1.5) crystal.dominant_forms = ['hoppered {10̄10} hexagonal prism', 'step-faced edges'];
  else crystal.dominant_forms = ['{10̄10} hexagonal prism', 'c{0001} flat pinacoid', 'barrel profile'];

  const trace_Fe = f.Fe * 0.015;
  const trace_Pb = f.Pb * 0.015;
  f.Pb = Math.max(f.Pb - rate * 0.025, 0);
  f.P = Math.max(f.P - rate * 0.008, 0);
  f.Cl = Math.max(f.Cl - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe, trace_Pb, note: color_note });
}

function grow_vanadinite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_vanadinite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 2.5) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.06);
      conditions.fluid.Pb += d * 0.3;
      conditions.fluid.V += d * 0.2;
      conditions.fluid.Cl += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }

  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const f = conditions.fluid;
  let color_note;
  if (f.As > 2.0) { color_note = `yellow endlichite (As ${f.As.toFixed(1)} + V ${f.V.toFixed(1)} mix)`; crystal.habit = 'endlichite_yellow'; }
  else if (f.Fe > 5.0) { color_note = `brown-orange (Fe ${f.Fe.toFixed(0)} ppm)`; crystal.habit = 'brown_hex_prism'; }
  else { color_note = `bright red-orange (V⁵⁺ ${f.V.toFixed(1)} ppm — the signature)`; crystal.habit = 'red_hex_prism'; }

  crystal.dominant_forms = ['{10̄10} hexagonal prism', 'c{0001} pinacoid', 'flat basal termination'];
  const trace_Fe = f.Fe * 0.010;
  const trace_Pb = f.Pb * 0.015;
  f.Pb = Math.max(f.Pb - rate * 0.025, 0);
  f.V = Math.max(f.V - rate * 0.008, 0);
  f.Cl = Math.max(f.Cl - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe, trace_Pb, note: color_note });
}
