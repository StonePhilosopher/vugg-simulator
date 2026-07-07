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

// ============================================================
// Calcite morphology (calcite-morphology arc, 2026-06-11) — the
// classification machinery + threshold table were HOISTED to
// js/45-morphology.ts in the registry hoist (morphology-generalization
// arc, 2026-06-12): calcite is MORPH_TH.calcite, the registry's first
// tenant, and the threshold values + their physics rationale live
// there now (Sunagawa ladder, Wolthers bounded boundary layer, Mg
// step-edge pinning). These aliases keep this file's grow_calcite, the
// tests, the UI surfaces, and the bench mirror
// (tools/calcite-morphology-map.mjs) on their existing names.
const CALCITE_MORPH_TH = MORPH_TH.calcite;

// Severity-ordinal regime list + display flavor = the shared registry
// (js/45 MORPH_REGIMES / MORPH_DISPLAY.calcite — display moved there
// with the halide wave so the zone modal can speak each mineral's
// field language via morphDisplayLabel).
const CALCITE_MORPH_REGIMES = MORPH_REGIMES;
const CALCITE_MORPH_DISPLAY = MORPH_DISPLAY.calcite;

// Thin wrappers over the js/45 generics (kept: tests + bench bind to
// these names; calciteMorphForm below is REAL calcite physics — the
// registry's form hook calls it).
function calciteSurfaceSigma(bulkSigma: number, sizeUm: number): number {
  return morphSurfaceSigma(MORPH_TH.calcite, bulkSigma, sizeUm);
}

function calciteMorphRegime(surfSigma: number): string {
  return morphRegime(MORPH_TH.calcite, surfSigma);
}

function calciteMorphForm(mgRatio: number, temperature: number, omega?: number, subaqueous?: boolean): string {
  if (mgRatio > CALCITE_MORPH_TH.MG_SCALENO || temperature > 200) return 'scalenohedral';
  // C0 (SIM 217) — the σ lever: highly supersaturated SUBAQUEOUS growth makes
  // scalenohedra even in Mg-poor, low-T water (González, Carpenter & Lohmann
  // 1992; García-Carmona 2003; threshold rationale + full citations at
  // MORPH_TH.calcite.OMEGA_SCALENO in js/45). omega undefined/NaN degrades to
  // the Mg/T-only fence (callers without a σ in hand keep the old contract);
  // subaqueous defaults true, air-mode drip films are gated out by callers.
  if (subaqueous !== false && Number.isFinite(omega) && (omega as number) > CALCITE_MORPH_TH.OMEGA_SCALENO) {
    return 'scalenohedral';
  }
  return 'rhombohedral';
}

// Calcite-morphology arc Phase 3 (2026-06-11): TERRACE BANDS from the
// zone stack — the geometry-side read of the per-zone regime tags. The
// renderer (99i _topoSyncCrystalMeshes) calls this to decide whether a
// calcite crystal renders as the smooth parent form or as zone-stack
// terraces, and where the ledges sit. Lives in the ENGINE file (not the
// renderer) so it is headless-testable and replay-correct: pass
// uptoStep to truncate the walk at a replay frame — terraces ACCUMULATE
// as the scrubber advances, which is the watch-it-grow deliverable.
//
// Returns null when the crystal should render smooth (no tags, or the
// relief share is below 5% of grown mass — a smooth-spar crystal with a
// stepped sliver of core stays visually smooth, matching hand
// specimens). Otherwise:
//   { form: 'scalene' | 'rhomb',
//     knots: [{ frac, regime }],   // band END fractions of total grown
//                                  // size, ascending, last === 1.0
//     hopperTip: boolean }         // last band is hopper_skeletal →
//                                  // the apex hollows into a funnel
function calciteTerraceBands(crystal, uptoStep) {
  // The band walk itself is mineral-agnostic and moved to js/45
  // morphTerraceKnots in the halide render wave (2026-06-12) — same
  // arithmetic verbatim (relief floor 5%, sliver merge 1.5%, replay
  // truncation). This wrapper keeps calcite's gate + form derivation.
  if (!crystal || crystal.mineral !== 'calcite') return null;
  const walk = morphTerraceKnots(crystal, uptoStep);
  if (!walk) return null;
  const form = String(crystal.habit || '').includes('scalenohedral') ? 'scalene' : 'rhomb';
  return { form, knots: walk.knots, hopperTip: walk.hopperTip };
}

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

  // Growth rate dispatch — v144 Week 9: when the calcite SI flag is on,
  // delegate the rate calculation to PWP kinetics (Plummer-Wigley-
  // Parkhurst 1978 + Mg poisoning + Arrhenius T-dependence). The
  // empirical 5.0 × excess formula stays as the fallback for any
  // future flag-off testing / debug rollback. Same flag gate as the
  // sigma dispatch in supersaturation_calcite — both halves of the
  // engine flip together (proposal Week 9 plan).
  const excess = sigma - 1.0;
  let rate;
  if (kspSupersatActiveFor('calcite')) {
    const pwp_mol = calciteRate(conditions.fluid, conditions.temperature);
    rate = pwpRateToSimMicronsPerStep('calcite', pwp_mol) * rng.uniform(0.8, 1.2);
    // PWP under-supersat (omega < 1) yields negative rate, which is
    // dissolution territory — but we already handled the sigma < 1
    // case above. If PWP returns negative here (Ω slightly > 1 but
    // forward rate vanishingly small), treat as no growth this step.
    if (rate < 0) rate = 0;
  } else {
    rate = 5.0 * excess * rng.uniform(0.8, 1.2);
  }

  // Mn partition rises with supersaturation (less selective lattice
  // rejection at faster growth). Capped at 1.0 — the lattice can't
  // hold more Mn than the fluid offers, regardless of growth rate.
  // Pre-v144 empirical excess was bounded ~0-12; cap was a no-op. SI
  // engine omega can reach 100s in wildly supersaturated scenarios,
  // making the cap load-bearing.
  const Mn_partition = Math.min(1.0, 0.1 * (1 + excess * 0.5));
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

  // v103 (2026-05-19): manganocalcite habit branch — late-stage
  // Mn-rich Fe-poor calcite at low supersaturation, the cauliflower-
  // mammillary slow-growth habit observed at Silverton / Standard Mine
  // (capping rhodochrosite as the terminal carbonate pulse). The
  // existing T-based habit dispatch (scalenohedral / rhombohedral)
  // covers the standard CaCO3 cases; manganocalcite is a variety
  // distinguished by chemistry (high Mn / low Fe) AND kinetics (very
  // low excess, slow growth → botryoidal instead of crystalline).
  // Per Pohl 2011 Economic Geology of Mineral Deposits + observed
  // Silverton specimen aesthetic.
  const is_manganocalcite = (conditions.fluid.Mn > 5 && conditions.fluid.Fe < 2);
  // Calcite-morphology arc Phase 2 (2026-06-11): the habit string is now
  // driven by the classifier's recorded regime (crystal._morphology,
  // written by classifyCalciteMorphologyStep at the END of last step —
  // the one-step lag is physical: it is the rock's recorded state, on
  // the calibrated post-step basis, 18th catch). Precedence preserved:
  // manganocalcite (chemistry variety) outranks the σ regime, exactly
  // as it outranked the old T ladder.
  // Phase 4 (SIM 187): the form axis is the FULL calciteMorphForm —
  // Mg:Ca > 0.15 elongates toward scalenohedral (GCA 2015) alongside
  // the T>200 trigger. This IS a chemistry change (scaleno aspect 0.5
  // vs rhomb 0.8 → volume → fill) for the four Mg-dominated waters
  // (sabkha 3.3, searles 1.6, ultramafic 10, zoned_dripstone 0.75);
  // the MVT brines (Mg:Ca ~0.075) correctly stay rhombohedral.
  const morphMgRatio = (conditions.fluid.Mg || 0) / Math.max(1e-6, conditions.fluid.Ca || 0);
  // C0 (SIM 217): the fence gains the σ lever — sigma is this step's textbook
  // Ω against THIS crystal's cell fluid (already in hand, line 78), and the
  // subaqueous gate keeps air-mode drip films on the Mg/T-only fence
  // (Weremeichik 2024's ladder is for subaqueous spar). Live per-step, same
  // trajectory contract as the Mg branch (the v187 lesson).
  const morphFormT = calciteMorphForm(morphMgRatio, conditions.temperature, sigma, crystal.growth_environment !== 'air');
  const morphRegime = (crystal._morphology && crystal._morphology.regime) || null;
  if (is_manganocalcite && excess < 0.4) {
    crystal.habit = 'botryoidal_manganocalcite';
    crystal.dominant_forms = ['cauliflower botryoidal mass', 'mammillary surface', 'cryptocrystalline interior'];
    crystal._variety = 'manganocalcite';
  } else if (morphRegime === 'stepped_mild' || morphRegime === 'stepped_macro') {
    const macro = morphRegime === 'stepped_macro';
    crystal.habit = `stepped_${morphFormT}`;
    if (morphFormT === 'scalenohedral') {
      crystal.dominant_forms = macro
        ? ['v{211} scalenohedron with macrostep terraces', 'stepped dog-tooth']
        : ['v{211} scalenohedron, gentle growth steps', 'dog-tooth'];
    } else {
      crystal.dominant_forms = macro
        ? ['e{104} rhombohedron with macrostep terraces', 'pagoda-stacked faces']
        : ['e{104} rhombohedron, gentle growth steps'];
    }
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  } else if (morphRegime === 'hopper_skeletal') {
    crystal.habit = `hopper_${morphFormT}`;
    crystal.dominant_forms = morphFormT === 'scalenohedral'
      ? ['v{211} scalenohedron, faces hollowed to funnels (hopper)', 'skeletal edge frame']
      : ['e{104} rhombohedron, faces hollowed to funnels (hopper)', 'skeletal edge frame'];
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  } else if (morphRegime === 'dendritic') {
    crystal.habit = `dendritic_${morphFormT}`;
    crystal.dominant_forms = ['branched dendritic calcite', 'the instability run past hopper — trunks with side arms'];
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  } else if (morphFormT === 'scalenohedral') {
    // Smooth growth, scalenohedral form — T>200 (the original ladder),
    // OR Mg:Ca>0.15 (Phase 4: GCA 2015 elongation is form-level
    // physics, regime-independent — Mg-rich smooth spar elongates too),
    // OR sustained Ω past the C0 σ lever (SIM 217). The annotation names
    // the fence branch that actually fired, in precedence order.
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = conditions.temperature > 200
      ? ['v{211} scalenohedron', 'dog-tooth']
      : (morphMgRatio > CALCITE_MORPH_TH.MG_SCALENO
        ? ['v{211} scalenohedron', 'dog-tooth (Mg-elongated)']
        : ['v{211} scalenohedron', 'dog-tooth (σ-grown spar)']);
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  } else if (conditions.temperature > 100) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104} rhombohedron'];
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  } else {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104}', 'possibly nail-head'];
    if (is_manganocalcite) crystal._variety = 'manganocalcite';
  }

  // Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

  // v103: graduated Mn²⁺ fluorescence intensity by Mn-in-lattice level.
  // Bright "much brighter than most" specimens are the manganocalcite
  // upper end (Mn > 30 ppm at growth, Fe < 2 ppm to avoid quenching).
  let note = '';
  if (trace_Mn > 1.0 && trace_Fe > 2.0) {
    note = 'Fe quenching Mn fluorescence — dark CL zone';
  } else if (trace_Mn > 6.0 && trace_Fe < 0.4) {
    note = 'brilliant salmon SW UV fluorescence (manganocalcite — Mn²⁺ activator high, Fe quencher minimal)';
  } else if (trace_Mn > 2.0 && trace_Fe < 1.0) {
    note = 'moderate orange SW UV fluorescence (Mn²⁺ activator)';
  } else if (trace_Mn > 1.0 && trace_Fe < 2.0) {
    note = 'Mn-rich zone — will fluoresce orange under UV';
  }

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

// The end-of-step morphology classification pass (with its 18th-catch
// post-step-basis rationale) moved to js/45-morphology.ts in the
// registry hoist — classifyMorphologyStep iterates MORPH_TH, of which
// calcite was the first tenant. The Mg-bunching multiplier and the
// Mg/T form rule ride along as the calcite entry's effSigmaMult/form
// hooks (the form hook calls calciteMorphForm above — the physics
// stays in this file).

function grow_aragonite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_aragonite();

  // Polymorphic conversion to calcite — aragonite is metastable. At T > 100°C
  // when the kinetic favorability has dropped, the orthorhombic structure
  // inverts to trigonal calcite via solution-mediated dissolution + reprecipitation.
  if (crystal.total_growth_um > 10
      && conditions.temperature > 100
      && sigma < 0.8) {
    crystal.dissolved = true;
    // Phase 1e: Ca + CO3 constants via MINERAL_DISSOLUTION_RATES.aragonite.polymorph.
    return new GrowthZone({
      step, temperature: conditions.temperature,
      thickness_um: -2.0, growth_rate: -2.0,
      dissolutionMode: 'polymorph',
      note: `polymorphic conversion — orthorhombic CaCO₃ → trigonal calcite (T=${conditions.temperature.toFixed(0)}°C, sigma_arag=${sigma.toFixed(2)})`
    });
  }

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(8.0, crystal.total_growth_um * 0.15);
      // Phase 1e: Ca + CO3 credits via MINERAL_DISSOLUTION_RATES.aragonite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        dissolutionMode: 'acid',
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  // Growth rate dispatch — v147 Week 12: when aragonite SI flag is on,
  // delegate to PWP kinetics via aragoniteRate (which is calcite PWP
  // × 3 per Burton-Walter 1987 Geology 15:111 / Wollast 1990 Aquatic
  // Chemical Kinetics). The Mg-poisoning factor that lives in
  // calciteRate is NOT applied to aragonite — high Mg/Ca is what
  // FAVORS aragonite vs calcite, not what suppresses it. Same flag
  // gate as W9-W11. Empirical 5.5 × excess fallback stays.
  let rate;
  if (kspSupersatActiveFor('aragonite')) {
    const pwp_mol = aragoniteRate(conditions.fluid, conditions.temperature);
    rate = pwpRateToSimMicronsPerStep('aragonite', pwp_mol) * rng.uniform(0.7, 1.3);
    if (rate < 0) rate = 0;
  } else {
    rate = 5.5 * excess * rng.uniform(0.7, 1.3);
  }

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
  // Kim 2023: ordering fraction f_ord ramps with FLUID-LEVEL cycle count.
  // Tracking at the fluid level captures the geological insight that an
  // oscillatory environment ratchets ordering across all dolomite nuclei,
  // not just the ones that survive enclosure. N₀=7 (matches dolomiteRate
  // in 52b) calibrated for sim timescale (each sim cycle stands in for
  // thousands of real tidal cycles).
  const cycle_count = conditions._dol_cycle_count;
  const f_ord = 1.0 - Math.exp(-cycle_count / 7.0);

  // Growth rate dispatch — v145 Week 10: when the dolomite SI flag is
  // on, delegate the rate to PWP kinetics (dolomiteRate already bakes
  // in the Kim 2023 (0.30 + 0.70 × f_ord) ordering gate; we just pass
  // f_ord). Same flag gate pattern as Week 9 calcite. The empirical
  // base_rate formula stays as the fallback path.
  let rate;
  if (kspSupersatActiveFor('dolomite')) {
    const pwp_mol = dolomiteRate(conditions.fluid, conditions.temperature, f_ord);
    rate = pwpRateToSimMicronsPerStep('dolomite', pwp_mol) * rng.uniform(0.7, 1.3);
    if (rate < 0) rate = 0;
  } else {
    const base_rate = 4.5 * excess * rng.uniform(0.7, 1.3);
    rate = base_rate * (0.30 + 0.70 * f_ord);
  }

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

// v146 (Week 11): HMC (High-Magnesium Calcite) — disordered
// Ca(1-x)Mg(x)CO3 with x ≈ 0.05-0.30. Kinetic precursor to ordered
// dolomite per Kim 2023; persists as metastable Mg-rich calcite
// intermediate without cycling. The mg_content is per-crystal state,
// set at nucleation from fluid Mg/Ca (Mucci-Morse 1983 partitioning).
function grow_HMC(crystal, conditions, step) {
  const sigma = conditions.supersaturation_HMC();
  if (sigma < 1.0) {
    // Acid dissolution — HMC dissolves more readily than calcite due
    // to higher Ksp of the Mg-substituted lattice (Bischoff-Mackenzie-
    // Bishop 1987). pH < 6 threshold (vs calcite's 5.5).
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 6.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.18);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — disordered HMC lattice less stable than pure calcite`
      });
    }
    return null;
  }

  // Read crystal's stored mg_content (set at nucleation). If absent
  // (legacy data), default to 0.10 — a representative marine HMC value.
  const mg_content = typeof crystal._mg_content === 'number' ? crystal._mg_content : 0.10;

  // Growth rate dispatch — v146 Week 11: when HMC SI flag is on,
  // delegate the rate to PWP kinetics via HMCRate (which is calcite
  // PWP with Mg-poisoning sigmoid already baked in per Davis 2000).
  // Same flag gate pattern as W9 calcite + W10 dolomite. Empirical
  // 3.5 × excess formula stays as fallback.
  const excess = sigma - 1.0;
  let rate;
  if (kspSupersatActiveFor('HMC')) {
    const pwp_mol = HMCRate(conditions.fluid, conditions.temperature, mg_content);
    rate = pwpRateToSimMicronsPerStep('calcite', pwp_mol) * rng.uniform(0.7, 1.3);  // calcite Vm; close enough for Mg-substituted lattice
    if (rate < 0) rate = 0;
  } else {
    rate = 3.5 * excess * rng.uniform(0.8, 1.2);  // somewhat slower than calcite per Davis 2000 Mg poisoning
  }

  // Habit dispatch — HMC is overwhelmingly a microcrystalline cement
  // in real geology (Coorong dolomite/HMC ambiguity aside). Discrete
  // cabinet-grade HMC is rare. Per Bischoff-Mackenzie-Bishop 1987 +
  // Morse-Mackenzie 1990 chapter on diagenetic stabilization.
  if (excess > 1.5 && conditions.temperature < 35) {
    crystal.habit = 'recrystallized_HMC';
    crystal.dominant_forms = ['small rhombohedral aggregates', 'incipient ordered domains'];
  } else if (mg_content > 0.20) {
    crystal.habit = 'high_Mg_micritic';
    crystal.dominant_forms = ['microcrystalline cement', 'gray-white groundmass', `${(mg_content * 100).toFixed(0)} mol% Mg`];
  } else {
    crystal.habit = 'micritic';
    crystal.dominant_forms = ['fine-grained cement', 'matrix-supporting', `${(mg_content * 100).toFixed(0)} mol% Mg`];
  }

  // Substrate note — HMC often replaces or overgrows calcite/aragonite
  const pos = crystal.position || '';
  let prov_note = '';
  if (pos.includes('calcite')) prov_note = ` [Mg-substituted overgrowth on calcite]`;
  else if (pos.includes('aragonite')) prov_note = ` [HMC cement post-aragonite recrystallization]`;

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Mg: conditions.fluid.Mg * 0.04,  // crystal Mg trace (small relative to lattice Mg)
    trace_Fe: conditions.fluid.Fe * 0.06,
    trace_Mn: conditions.fluid.Mn * 0.04,
    note: `${crystal.habit}${prov_note} — disordered Ca-Mg carbonate (x = ${mg_content.toFixed(2)}); will recrystallize to LMC over geological time without cycling, or to ordered dolomite under Kim 2023 cyclic-Ω mechanism`,
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
      // Phase 1e: Mn + CO3 credits via MINERAL_DISSOLUTION_RATES.rhodochrosite.oxidative.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        dissolutionMode: 'oxidative',
        note: `oxidative breakdown — Mn²⁺ → Mn³⁺/Mn⁴⁺, surface converting to black manganese oxide (pyrolusite/psilomelane staining)`
      });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.15);
      // Phase 1e: Mn + CO3 credits via MINERAL_DISSOLUTION_RATES.rhodochrosite.acid.
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        dissolutionMode: 'acid',
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
  } else if (crystal.habit === 'fibrous/acicular') {
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
    // 2026-05-21 (v119) — "bonbon pink" Mn-bearing smithsonite trace.
    // The Tsumeb cabinet aesthetic (bonbon pink + sky blue + apple
    // green) keys off trace_Mn substitution into ZnCO3. Mn²⁺ (83 pm)
    // substitutes Zn²⁺ (74 pm) modestly; partition 0.05 matches the
    // carbonate-family coefficient. Pink hue threshold at Mn > 10 ppm
    // is already in the color_note dispatch above; the zone-level
    // trace capture lets the renderer paint per-zone color bands
    // (slated for next sub-arc after Rock Bot visual-diff lands).
    trace_Mn: conditions.fluid.Mn * 0.05,
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
      // Phase 1e: Cu + CO3 credits via MINERAL_DISSOLUTION_RATES.azurite.acid.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'acid', note: `carbonate dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — fizzes, Cu²⁺ + CO₃²⁻ released` });
    }
    if (crystal.total_growth_um > 5 && conditions.fluid.CO3 < 80) {
      crystal.dissolved = true;
      const d = Math.min(2.5, crystal.total_growth_um * 0.08);
      // Phase 1e: Cu + CO3 credits via MINERAL_DISSOLUTION_RATES.azurite.low_co3.
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, dissolutionMode: 'low_co3', note: `azurite → malachite conversion (CO₃ ${conditions.fluid.CO3.toFixed(0)} ppm drops below pseudomorph threshold)` });
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

// v63 brief-19: strontianite SrCO3 — Sr carbonate, aragonite-group; almost
// always cyclic-twinned into pseudohex.
function grow_strontianite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_strontianite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.13);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — SrCO3 + 2H+ -> Sr2+ + H2O + CO2`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 4.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 1.8 && conditions.temperature < 100) {
    crystal.habit = 'acicular_fibrous';
    crystal.dominant_forms = ['radiating fibrous spray (Münsterland aesthetic)'];
  } else {
    crystal.habit = 'twinned_pseudohexagonal';
    crystal.dominant_forms = ['pseudohex cyclic-twinned prism'];
  }
  let color_note = 'white Sr-carbonate prism';
  if (conditions.fluid.Pb > 10) color_note = 'pale yellow strontianite (Pb trace)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Sr: conditions.fluid.Sr * 0.02,
    note: color_note,
  });
}

// v63 brief-19: witherite BaCO3 — Ba carbonate, almost always cyclic-twinned
// pseudohex pyramid (Settlingstones aesthetic).
function grow_witherite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_witherite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.13);
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — BaCO3 + 2H+ -> Ba2+ + H2O + CO2`,
      });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 4.5 * excess * rng.uniform(0.85, 1.15);
  if (rate < 0.1) return null;
  if (sigma > 2.5) {
    crystal.habit = 'botryoidal_white';
    crystal.dominant_forms = ['white botryoidal balls (Settlingstones)'];
  } else {
    crystal.habit = 'pseudohexagonal_twinned';
    crystal.dominant_forms = ['pseudohex pyramid via cyclic twin'];
  }
  let color_note = 'white BaCO3 — fluoresces bluish-white SW';
  if (conditions.fluid.Fe > 5) color_note = 'yellow-brown witherite (Fe staining)';
  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Ba: conditions.fluid.Ba * 0.02,
    note: color_note,
  });
}

// v98 (2026-05-19): Hydrozincite Zn5(CO3)2(OH)6 — latest+coolest
// Zn supergene mineral. Chalky-spherulitic crusts + cave-floor
// coatings. Pale-blue SW-UV fluorescence (defect-related, NOT Mn-
// activator like willemite). Iglesiente Sardinia type.
function grow_hydrozincite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_hydrozincite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 6.0) {
      crystal.dissolved = true;
      const d = Math.min(2.0, crystal.total_growth_um * 0.10);
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — reverts toward smithsonite + Zn²⁺` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.5 * excess * rng.uniform(0.8, 1.2);  // grows fast — efflorescent
  if (rate < 0.1) return null;
  const pos = crystal.position || '';
  if (pos.includes('smithsonite')) {
    crystal.habit = 'alteration_after_smithsonite';
    crystal.dominant_forms = ['chalky crust on smithsonite (in-situ alteration product)'];
  } else if (excess > 1.5) {
    crystal.habit = 'cave_floor_chalky_coating';
    crystal.dominant_forms = ['centimeter-thick chalky white coatings (Iglesiente cave-floor style)'];
  } else if (excess > 0.5) {
    crystal.habit = 'spherulitic_crust';
    crystal.dominant_forms = ['spherulitic crusts ~0.5-5 mm spherules', 'radiating fibrous internal structure'];
  } else {
    crystal.habit = 'botryoidal_film';
    crystal.dominant_forms = ['thin botryoidal film on weathered Zn ore'];
  }
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.030, 0);
  conditions.fluid.CO3 = Math.max(conditions.fluid.CO3 - rate * 0.020, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: `hydrozincite ${crystal.habit}, chalk-white (fluoresces pale-blue under SW UV)` });
}
