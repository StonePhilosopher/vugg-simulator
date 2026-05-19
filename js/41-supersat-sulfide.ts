// ============================================================
// js/41-supersat-sulfide.ts — supersaturation methods for sulfide minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/sulfide.py. Minerals (20): acanthite, argentite, arsenopyrite, bismuthinite, bornite, chalcocite, chalcopyrite, cobaltite, covellite, galena, marcasite, millerite, molybdenite, nickeline, pyrite, sphalerite, stibnite, tennantite, tetrahedrite, wurtzite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_sphalerite() {
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  // Below 95°C: full sigma. Above: accelerated decay (wurtzite field).
  const T_factor = this.temperature <= 95
    ? 2.0 * Math.exp(-0.004 * this.temperature)
    : 2.0 * Math.exp(-0.01 * this.temperature);
  return product * T_factor;
},

  supersaturation_wurtzite() {
  // Hexagonal (Zn,Fe)S dimorph of sphalerite. Round 9c retrofit
  // (Apr 2026): two-branch model. Equilibrium high-T branch (>95°C)
  // unchanged. Low-T metastable branch added per Murowchick & Barnes
  // 1986: wurtzite forms below 95°C only when pH<4 AND sigma_base>=1
  // AND Fe>=5 — the kinetic-trap conditions that produce Aachen-style
  // schalenblende and AMD wurtzite. See
  // research/research-broth-ratio-sphalerite-wurtzite.md.
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const T = this.temperature;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  if (T > 95) {
    let T_factor;
    if (T < 150) T_factor = (T - 95) / 55.0;
    else if (T <= 300) T_factor = 1.4;
    else T_factor = 1.4 * Math.exp(-0.005 * (T - 300));
    return product * T_factor;
  }
  // Low-T metastable branch — all three conditions required.
  if (this.fluid.pH >= 4.0) return 0;
  if (product < 1.0) return 0;
  if (this.fluid.Fe < 5) return 0;
  return product * 0.4;
},

  supersaturation_pyrite() {
  if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  // v68: effectiveTemperature is now an identity pass-through after the
  // Mo-flux artifact was removed (canonical 5ecbb42). Kept for forward
  // compat with the Python mirror.
  const eT = this.effectiveTemperature;
  const T_factor = (100 < eT && eT < 400) ? 1.0 : 0.5;
  // pH rolloff below 5 — marcasite (orthorhombic FeS2) wins in acid
  let pH_factor = 1.0;
  if (this.fluid.pH < 5.0) {
    pH_factor = Math.max(0.3, (this.fluid.pH - 3.5) / 1.5);
  }
  return product * T_factor * pH_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_marcasite() {
  // Orthorhombic FeS2 dimorph of pyrite. pH<5 AND T<240 hard gates.
  if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH >= 5.0) return 0;
  if (this.temperature > 240) return 0;
  const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  const pH_factor = Math.min(1.4, (5.0 - this.fluid.pH) / 1.2);
  const T_factor = this.temperature < 150 ? 1.2 : 0.6;
  return product * pH_factor * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_chalcopyrite() {
  if (this.fluid.Cu < 10 || this.fluid.Fe < 5 || this.fluid.S < 15) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  const product = (this.fluid.Cu / 80.0) * (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
  const eT = this.effectiveTemperature;
  // Chalcopyrite: main porphyry window 300-500°C, ~90% deposits before 400°C (Seo et al. 2012)
  // Can form at lower T (200-300°C) but less efficiently. Rare below 180°C.
  let T_factor;
  if (eT < 180) T_factor = 0.2;            // rare at low T
  else if (eT < 300) T_factor = 0.8;       // viable, not peak
  else if (eT <= 500) T_factor = 1.3;      // sweet spot — porphyry window
  else T_factor = 0.5;                      // fades above 500°C
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_galena() {
  // v13: reconciled to Python — pre-v13 had no O2 gate, allowing the
  // sulfide to form under oxidizing conditions (a clear physics bug,
  // surfaced by tools/supersat_drift_audit.py). Now matches vugg.py.
  if (this.fluid.Pb < 5 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;  // sulfides can't survive oxidation
  let sigma = (this.fluid.Pb / 50.0) * (this.fluid.S / 80.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
  // Pre-v68 the Mo-flux widened the galena T window; that was a
  // simulation artifact with no geological basis.
  const eT = this.effectiveTemperature;
  if (eT >= 200 && eT <= 400) sigma *= 1.3;
  if (eT > 450) sigma *= Math.exp(-0.008 * (eT - 450));
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'galena');
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor for pyrite/marcasite/sphalerite/wurtzite/
  // chalcopyrite. Those are unrelated Fe/Zn/Cu sulfides with their own
  // stoichiometry; multiplying SIX factors stacked log γᵢ over the wrong
  // ion sets and silently dampened galena's σ by ~½×. Regression
  // introduced by the Phase 2b activity-coefficient sweep (eff8ec1,
  // 2026-05-05). Equivalent fixes landed on adamite, borax, and stibnite
  // the same day. Galena is the most heavily exercised mineral in the
  // sim (MVT + every Pb-bearing scenario) so this is the highest-impact
  // single line of the audit.
  return Math.max(sigma, 0);
},

  supersaturation_molybdenite() {
  // v13: reconciled to Python (which agent-api already matched). Pre-v13
  // had no O2 gate, allowing the sulfide to form under oxidizing conditions.
  if (this.fluid.Mo < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;  // sulfide, needs reducing
  let sigma = (this.fluid.Mo / 15.0) * (this.fluid.S / 60.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // v68: effectiveTemperature is identity after Mo-flux removal (5ecbb42).
  const eT = this.effectiveTemperature;
  if (eT < 150) {
    sigma *= Math.exp(-0.01 * (150 - eT));
  } else if (eT > 300 && eT < 500) {
    sigma *= 1.3;  // porphyry Mo sweet spot
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'molybdenite');
  return Math.max(sigma, 0);
},

  supersaturation_acanthite() {
  if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
  if (this.temperature > 173) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.5, 2.5);
  const s_f  = Math.min(this.fluid.S  / 25.0, 2.5);
  let sigma = ag_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 80 && T <= 150) {
    T_factor = 1.2;
  } else if (T < 80) {
    T_factor = Math.max(0.4, 1.0 - 0.012 * (80 - T));
  } else {  // 150 < T ≤ 173
    T_factor = Math.max(0.5, 1.0 - 0.020 * (T - 150));
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) {
    sigma *= 0.5;
  }
  if (this.fluid.Fe > 30 && this.fluid.Cu > 20) {
    sigma *= 0.6;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'acanthite');
  return Math.max(sigma, 0);
},

  supersaturation_argentite() {
  if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
  if (this.temperature <= 173) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const ag_f = Math.min(this.fluid.Ag / 2.5, 2.5);
  const s_f  = Math.min(this.fluid.S  / 25.0, 2.5);
  let sigma = ag_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 400) {
    T_factor = 1.3;
  } else if (T <= 200) {
    T_factor = Math.max(0.5, (T - 173) / 27.0 + 0.5);
  } else if (T <= 600) {
    T_factor = Math.max(0.4, 1.0 - 0.005 * (T - 400));
  } else {
    T_factor = 0.3;
  }
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 9) sigma *= 0.5;
  if (this.fluid.Cu > 30) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'argentite');
  return Math.max(sigma, 0);
},

  supersaturation_nickeline() {
  // 2026-05 cascade-gate audit Arc 3 calibration tier: Path C bulk-view
  // means the σ engine reads equator-ring fluid where Ni stays at the
  // seeded value (~20 ppm Schneeberg per Burkhardt 2001) rather than the
  // locally-enriched precipitating cell (typically 3-5× higher in real
  // arsenide veins). Same philosophy as Arc 2's hard-gate softening, just
  // applied to scaling denominators: divide by 3 so realistic bulk
  // concentrations produce σ ~1.
  //
  // Lower gate Ni<40 → Ni<15 (just clears Schneeberg Ni=20). As<40 → As<30.
  // Scaling Ni/60 → Ni/15, As/80 → As/30 (caps lifted to 3.0). Net effect:
  // Schneeberg Ni=20 + As=60 yields ni_f=1.33 × as_f=2.0 = 2.66 base,
  // clears nuc threshold 1.0 at peak T (300-450°C window during the
  // pegmatite-crystallization phase of schneeberg's 160-step trajectory).
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm. Nickeline
  // is NiAs (Ni-arsenide); the As component is As(III) / As-elemental,
  // not As(V) arsenate. arseniteAvailablePpm returns full As ppm in
  // sulfide-rich fluids (Schneeberg pegmatite phase) and 0 in oxidized
  // supergene fluids where As would be As(V) bound to oxygen.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (this.fluid.Ni < 15 || as_iii < 30) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.6)) return 0;
  const ni_f = Math.min(this.fluid.Ni / 15.0, 3.0);
  const as_f = Math.min(as_iii / 30.0, 3.0);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = ni_f * as_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 300 && T <= 450) T_factor = 1.3;
  else if (T < 200) T_factor = 0.3;
  else if (T < 300) T_factor = 0.3 + 0.010 * (T - 200);
  else if (T <= 500) T_factor = Math.max(0.5, 1.3 - 0.012 * (T - 450));
  else T_factor = 0.4;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'nickeline');
  return Math.max(sigma, 0);
},

  supersaturation_millerite() {
  if (this.fluid.Ni < 50 || this.fluid.S < 30) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.6)) return 0;
  // v92 As-state split: this "high As blocks millerite" inhibition
  // gate is about As(III) competing for the Ni cation (routes to
  // nickeline/cobaltite). As(V) doesn't compete for sulfarsenide
  // formation, so the check reads arseniteAvailablePpm.
  if (arseniteAvailablePpm(this.fluid) > 30.0 && this.temperature > 200) return 0;
  const ni_f = Math.min(this.fluid.Ni / 80.0, 2.5);
  const s_f  = Math.min(this.fluid.S  / 60.0, 2.5);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = ni_f * s_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 350) T_factor = 1.2;
  else if (T < 100) T_factor = 0.3;
  else if (T < 200) T_factor = 0.3 + 0.009 * (T - 100);
  else if (T <= 400) T_factor = Math.max(0.4, 1.2 - 0.013 * (T - 350));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'millerite');
  return Math.max(sigma, 0);
},

  supersaturation_cobaltite() {
  // 2026-05 cascade-gate audit Arc 3 calibration tier: twin treatment to
  // nickeline. Pre-fix: gates Co<50, As<100, S<50 all hard-blocked at
  // Schneeberg's seeded Co=30, As=60, S=30 — yet cobaltite is the
  // SECOND-most-diagnostic mineral of the historic Schneeberg ore type
  // (the cobalt arsenide that gave us the "kobold"/cobalt etymology when
  // smelters discovered the kobolds released arsenic fumes). 10-seed
  // sweep showed 0/10 firings.
  //
  // Lower gates to Co<20, As<30, S<20 (Schneeberg's bulk-view chemistry
  // clears all three). Tighten scaling denominators by 3x (Co/25, As/35,
  // S/25, cap 3.0) to reflect bulk-view-as-proxy-for-local. At Schneeberg
  // Co=30, As=60, S=30: co_f=1.2, as_f=1.71, s_f=1.2 → product 2.46. At
  // peak T (400-500°C, early pegmatite phase), σ ≈ 2.46 × 1.3 = 3.2
  // before activity correction — well above the 1.2 nuc threshold.
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm. Cobaltite
  // is CoAsS (sulfarsenide); As is in the As(III)/As(-I) state.
  const as_iii_cob = arseniteAvailablePpm(this.fluid);
  if (this.fluid.Co < 20 || as_iii_cob < 30 || this.fluid.S < 20) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;
  const co_f = Math.min(this.fluid.Co / 25.0, 3.0);
  const as_f = Math.min(as_iii_cob / 35.0, 3.0);
  const s_f  = Math.min(this.fluid.S  / 25.0, 3.0);
  const red_f = sulfideRedoxLinearFactor(this.fluid, 1.0, 1.5, 0.4);
  let sigma = co_f * as_f * s_f * red_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 400 && T <= 500) T_factor = 1.3;
  else if (T < 300) T_factor = 0.3;
  else if (T < 400) T_factor = 0.3 + 0.010 * (T - 300);
  else if (T <= 600) T_factor = Math.max(0.4, 1.3 - 0.012 * (T - 500));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cobaltite');
  return Math.max(sigma, 0);
},

  supersaturation_arsenopyrite() {
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm.
  // Arsenopyrite is FeAsS (sulfarsenide); As is in As(III)/As(-I) state,
  // not As(V). In supergene-oxidized fluids As is As(V) and arsenopyrite
  // properly returns 0 — geologically correct.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (this.fluid.Fe < 5 || as_iii < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 0.8)) return 0;  // sulfide — needs reducing
  let sigma = (this.fluid.Fe / 30.0) * (as_iii / 15.0)
            * (this.fluid.S / 50.0) * sulfideRedoxLinearFactor(this.fluid, 1.5);
  // Mesothermal sweet spot 300-500°C
  const T = this.temperature;
  if (T >= 300 && T <= 500) {
    sigma *= 1.4;
  } else if (T < 200) {
    sigma *= Math.exp(-0.01 * (200 - T));
  } else if (T > 600) {
    sigma *= Math.exp(-0.015 * (T - 600));
  }
  // pH window 3-6.5
  if (this.fluid.pH < 3) {
    sigma *= 0.5;
  } else if (this.fluid.pH > 6.5) {
    sigma *= Math.max(0.2, 1.0 - 0.3 * (this.fluid.pH - 6.5));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'arsenopyrite');
  return Math.max(sigma, 0);
},

  supersaturation_tetrahedrite() {
  if (this.fluid.Cu < 10 || this.fluid.Sb < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
  if (this.temperature < 100 || this.temperature > 400) return 0;
  const product = (this.fluid.Cu / 40.0) * (this.fluid.Sb / 15.0) * (this.fluid.S / 40.0);
  let T_factor;
  if (this.temperature >= 200 && this.temperature <= 300) T_factor = 1.3;
  else if ((this.temperature >= 150 && this.temperature < 200) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
  else T_factor = 0.6;
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  supersaturation_tennantite() {
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm.
  // Tennantite is Cu₁₂As₄S₁₃ (sulfosalt); As(III) in trigonal pyramidal
  // [AsS₃]³⁻ groups. Not arsenate.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (this.fluid.Cu < 10 || as_iii < 3 || this.fluid.S < 10) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
  if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
  if (this.temperature < 100 || this.temperature > 400) return 0;
  const product = (this.fluid.Cu / 40.0) * (as_iii / 15.0) * (this.fluid.S / 40.0);
  let T_factor;
  if (this.temperature >= 150 && this.temperature <= 300) T_factor = 1.3;
  else if ((this.temperature >= 100 && this.temperature < 150) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
  else T_factor = 0.6;
  return product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
},

  // Cinnabar (HgS) — mercury sulfide, the principal ore of mercury.
  // Hot-spring deposits (Sulphur Bank Mine + Almadén + Idria + New
  // Almaden) and sedimentary Hg in Sicilian sulfur. Mixed-redox
  // tolerant: cinnabar is one of the most chemically stable sulfides,
  // surviving from fully reducing (formation conditions) to mildly
  // oxidizing (it's why the red cinnabar accumulates intact in
  // oxidation zones while other Hg minerals weather to mercury vapor
  // + chloride salts).
  //
  // Engine gates (2026-05-18, v81):
  //   Hg >= 1.0     — even very low Hg loads (hot springs carry 0.5-50
  //                    ppm Hg from magmatic-volcanic source)
  //   S >= 50       — modest sulfide load
  //   O2 <= 1.0     — destroyed at fully oxic (sublimes as Hg° + SO4)
  //   pH <= 9       — broad pH tolerance (cinnabar stable acid → mildly alkaline)
  // T optimum 50-200°C (hot-spring window); decay outside.
  //
  // Hg-burdened fluids span both Sulphur Bank (pH 2, T 75) and Sicily
  // (pH 6, T 30) — the broad pH/T tolerance is what makes cinnabar
  // a co-product in both canonical native_sulfur deposit types.
  supersaturation_cinnabar() {
  if (this.fluid.Hg < 1.0) return 0;
  if (this.fluid.S < 50) return 0;
  if (this.fluid.O2 > 1.0) return 0;
  if (this.fluid.pH > 9) return 0;
  const hg_f = Math.min(this.fluid.Hg / 5.0, 4.0);
  const s_f = Math.min(this.fluid.S / 100.0, 3.0);
  // Eh window: mildly reducing optimal, fully oxic shuts the engine.
  // Sulfide redox helper hits 1.0 at the engine's preferred Eh and
  // tapers as conditions become more oxic. Cinnabar is the most
  // O2-tolerant of the common sulfides (the engine's O2 cap is 1.0
  // vs the stricter 0.4-0.7 cuts on pyrite/galena/etc.).
  const eh_f = sulfideRedoxLinearFactor(this.fluid, 1.0);
  let sigma = hg_f * s_f * eh_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 50 && T <= 200) T_factor = 1.2;
  else if (T < 50) T_factor = Math.max(0.5, 0.6 + (T - 20) / 100);
  else if (T <= 350) T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 200));
  else T_factor = 0.0;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'cinnabar');
  return Math.max(sigma, 0);
},

  // Realgar (AsS) — α-realgar, monoclinic arsenic sulfide, the lower-S
  // phase of the As-S system. Orange-red. Low-T hot-spring + epithermal
  // habit; co-deposits with orpiment. Type localities Allchar
  // (Macedonia) + Shimen (China); active hot-spring sites at
  // Yellowstone Norris Geyser Basin + Carbazo Springs + Sulphur Bank
  // Mine. Engine gates (2026-05-19, v82):
  //   As >= 5, S >= 30
  //   Reducing-to-mixed redox (sulfideRedoxAnoxic threshold 1.2 — broader
  //     than arsenopyrite's 0.8 because realgar tolerates more O₂ than
  //     the deeper-anoxic ferrous arsenosulfide).
  //   pH <= 9 (alkali dissolves it as thioarsenite complex).
  //   T optimum 50-180°C (matches Sulphur Bank's 60-90°C vent regime).
  supersaturation_realgar() {
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm.
  // Realgar is α-As₄S₄ — As(II) sulfide cage molecule, As in cuboid
  // cage with formal oxidation state +2 (commonly reduced-side
  // classified). Not arsenate; reads from the As(III) pool.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (as_iii < 5 || this.fluid.S < 30) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;
  if (this.fluid.pH > 9) return 0;
  const as_f = Math.min(as_iii / 15.0, 3.0);
  const s_f = Math.min(this.fluid.S / 100.0, 3.0);
  // Eh window: mildly reducing optimal. Sulfide-redox helper at the
  // engine's preferred Eh; tolerance broader than arsenopyrite.
  const eh_f = sulfideRedoxLinearFactor(this.fluid, 1.5);
  let sigma = as_f * s_f * eh_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 50 && T <= 180) T_factor = 1.2;
  else if (T < 50) T_factor = Math.max(0.4, 0.6 + (T - 20) / 100);
  else if (T <= 250) T_factor = Math.max(0.3, 1.2 - 0.012 * (T - 180));
  else T_factor = 0.0;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'realgar');
  return Math.max(sigma, 0);
},

  // Orpiment (As₂S₃) — monoclinic arsenic sulfide, the higher-S phase of
  // the As-S system. Golden yellow. Same depositional environment as
  // realgar but slightly higher S threshold (As₂S₃ stoichiometry needs
  // more S per As). Type locality Allchar; major Carlin-type producers
  // Getchell + Twin Creeks (Nevada); 'aurum pigmentum' of antiquity.
  // Engine gates:
  //   As >= 8 (higher than realgar's 5 — orpiment's As₂S₃ formula
  //            requires As to be present at higher levels)
  //   S >= 50 (more S than realgar; the S/As 3/2 stoichiometry favors
  //            S-rich fluids)
  //   Reducing-to-mixed redox.
  //   pH <= 9.5 (very broad; orpiment is the most alkali-tolerant of
  //              the As-sulfides).
  //   T optimum 60-200°C (slightly hotter than realgar; orpiment is
  //                       the higher-T As-S phase in many systems).
  supersaturation_orpiment() {
  // v92 As-state split: As(III) ppm via arseniteAvailablePpm.
  // Orpiment is As₂S₃ — As(III) sulfide. Not arsenate.
  const as_iii = arseniteAvailablePpm(this.fluid);
  if (as_iii < 8 || this.fluid.S < 50) return 0;
  if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;
  if (this.fluid.pH > 9.5) return 0;
  const as_f = Math.min(as_iii / 20.0, 3.0);
  const s_f = Math.min(this.fluid.S / 150.0, 3.0);
  const eh_f = sulfideRedoxLinearFactor(this.fluid, 1.5);
  let sigma = as_f * s_f * eh_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 60 && T <= 200) T_factor = 1.2;
  else if (T < 60) T_factor = Math.max(0.4, 0.5 + (T - 20) / 100);
  else if (T <= 280) T_factor = Math.max(0.3, 1.2 - 0.011 * (T - 200));
  else T_factor = 0.0;
  sigma *= T_factor;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'orpiment');
  return Math.max(sigma, 0);
},

  supersaturation_stibnite() {
  if (this.fluid.Sb < 10 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
  const sb_f = Math.min(this.fluid.Sb / 20.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 40.0, 1.5);
  let sigma = sb_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 150 && T <= 300) T_factor = 1.0;
  else if (T >= 100 && T < 150) T_factor = 0.5 + 0.01 * (T - 100);
  else if (T > 300 && T <= 400) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 300));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.3, 1.0, 0.5);
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'stibnite');
  // 2026-05 cascade-gate audit: removed accidental over-suppression by
  // activityCorrectionFactor for tetrahedrite + tennantite. Those are
  // Cu-As/Sb sulfosalts with their own stoichiometry, structurally
  // unrelated to stibnite (Sb2S3). Stacking the three factors dampened
  // σ enough to keep stibnite below the σ=1.2 nucleation threshold even
  // in porphyry (Sb=25, S=60-115): pre-fix best σ = 0.87 across 360
  // step-samples. Regression introduced by the Phase 2b sweep (eff8ec1,
  // 2026-05-05). Equivalent fixes landed on adamite, borax, and galena
  // the same day.
  return Math.max(sigma, 0);
},

  supersaturation_bismuthinite() {
  if (this.fluid.Bi < 5 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
  const bi_f = Math.min(this.fluid.Bi / 20.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 50.0, 1.5);
  let sigma = bi_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 200 && T <= 400) T_factor = 1.0;
  else if (T >= 150 && T < 200) T_factor = 0.5 + 0.01 * (T - 150);
  else if (T > 400 && T <= 500) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 400));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.3, 1.0, 0.5);
  if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'bismuthinite');
  return Math.max(sigma, 0);
},

  supersaturation_bornite() {
  if (this.fluid.Cu < 25 || this.fluid.Fe < 8 || this.fluid.S < 20 || !sulfideRedoxAnoxic(this.fluid, 1.8)) return 0;
  const cu_fe_ratio = this.fluid.Cu / Math.max(this.fluid.Fe, 1);
  if (cu_fe_ratio < 2.0) return 0;
  const cu_f = Math.min(this.fluid.Cu / 80.0, 2.0);
  const fe_f = Math.min(this.fluid.Fe / 30.0, 1.3);
  const s_f  = Math.min(this.fluid.S / 60.0, 1.5);
  let sigma = cu_f * fe_f * s_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 80 && T <= 300) T_factor = 1.0;
  else if (T < 80) T_factor = 0.6 + 0.005 * T;
  else if (T <= 500) T_factor = Math.max(0.5, 1.0 - 0.003 * (T - 300));
  else T_factor = 0.2;
  sigma *= T_factor;
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.5, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'bornite');
  return Math.max(sigma, 0);
},

  supersaturation_chalcocite() {
  if (this.fluid.Cu < 30 || this.fluid.S < 15 || !sulfideRedoxAnoxic(this.fluid, 1.9)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 60.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 50.0, 1.5);
  let sigma = cu_f * s_f;
  if (this.temperature > 150) sigma *= Math.exp(-0.03 * (this.temperature - 150));
  sigma *= sulfideRedoxLinearFactor(this.fluid, 1.4, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'chalcocite');
  return Math.max(sigma, 0);
},

  supersaturation_covellite() {
  if (this.fluid.Cu < 20 || this.fluid.S < 25 || !sulfideRedoxAnoxic(this.fluid, 2.0)) return 0;
  const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
  const s_f  = Math.min(this.fluid.S / 60.0, 1.8);
  let sigma = cu_f * s_f;
  if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
  sigma *= sulfideRedoxTent(this.fluid, 0.8, 1.3, 1.0, 0.3);
  if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'covellite');
  return Math.max(sigma, 0);
},

  // v63 brief-19 — telluride / selenide / Cd-sulfide group.
  // All are reducing-only (chalcophile chemistry); most are Au-Ag-Te or
  // Pb-Ag-Se epithermal phases; greenockite/hawleyite are the Cd-sulfide
  // pair from sphalerite oxidation.

  // AuTe2 — incommensurately modulated monoclinic Au telluride.
  // Fires when Au + Te both present, low S, mid-T epithermal.
  supersaturation_calaverite() {
    if (this.fluid.Au < 0.1 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Au/1.0, Te/5.0) → (Au/0.2, Te/2.0). Cripple Creek fluid
    // inclusion data (Saunders 2008) puts typical telluride-precipitating
    // fluids at Au 0.4-2 ppm and Te 1-30 ppm. The prior references
    // anchored "well-saturated" at Au=1 ppm and Te=5 ppm, so the
    // scenario's natural-range Au=0.4 / Te=3 gave σ=0.24 — well below
    // the >1.0 nucleation threshold. epithermal_telluride's
    // calaverite stale across 10 seeds × 100 steps confirmed the
    // miss via tools/mineral_coverage_check.mjs.
    let sigma = (this.fluid.Au / 0.2) * (this.fluid.Te / 2.0);
    const T = this.temperature;
    if (T < 100 || T > 450) return 0;
    let T_factor = 1.0;
    if (T >= 200 && T <= 350) T_factor = 1.2;
    else if (T < 200) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 100));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 350));
    sigma *= T_factor;
    // Sulfide competition — high S favors sulfides over tellurides
    if (this.fluid.S > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (this.fluid.S - 50));
    // Sylvanite competition — when Ag is comparable to Au, sylvanite wins
    if (this.fluid.Ag > this.fluid.Au * 5) sigma *= 0.5;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'calaverite');
    return Math.max(sigma, 0);
  },

  // (Au,Ag)Te2 — Au:Ag 1:1 to 3:1 monoclinic telluride. Photosensitive.
  // Wins over calaverite when Ag is comparable to Au.
  supersaturation_sylvanite() {
    if (this.fluid.Au < 0.1 || this.fluid.Ag < 0.5 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Au/1.0, Ag/5.0, Te/5.0) → (Au/0.2, Ag/5.0, Te/2.0). Same
    // rescaling rationale as calaverite — Cripple Creek Au + Te
    // averages were sub-saturating against the prior anchors. Ag/5.0
    // kept because Ag=15 in the scenario already produces a 3× factor
    // and the cation-fork dynamic (sylvanite favored when Ag dominates
    // Au) needs preservation, not amplification.
    let sigma = (this.fluid.Au / 0.2) * (this.fluid.Ag / 5.0) * (this.fluid.Te / 2.0) * 0.7;
    const T = this.temperature;
    if (T < 80 || T > 400) return 0;
    let T_factor = 1.0;
    if (T >= 150 && T <= 300) T_factor = 1.2;
    else if (T < 150) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 80));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 300));
    sigma *= T_factor;
    if (this.fluid.S > 50) sigma *= Math.max(0.4, 1.0 - 0.005 * (this.fluid.S - 50));
    // Calaverite competition — when Au ≫ Ag, calaverite wins
    if (this.fluid.Au > this.fluid.Ag * 0.5) sigma *= 0.7;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'sylvanite');
    return Math.max(sigma, 0);
  },

  // Ag2Te — silver telluride. Phase transition at 155°C (cubic↔monoclinic).
  // Wins over acanthite (Ag2S) only when Te > S.
  supersaturation_hessite() {
    if (this.fluid.Ag < 5 || this.fluid.Te < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    // Tier 2 F follow-up (2026-05): reference values dropped from
    // (Ag/30.0, Te/5.0) → (Ag/10.0, Te/2.0). Hessite is the Ag-
    // dominant end of the Au-Te paragenesis; at Cripple Creek's
    // Ag=15 ppm + Te=3 ppm the prior anchors gave σ=0.3, no
    // nucleation across the 10-seed sweep. The new anchors put
    // hessite in supersaturated territory at the scenario's
    // chemistry, unlocking the Ag→native_tellurium consumption
    // cascade (hessite debits Ag from the broth; when Ag drops
    // below the native_tellurium gate of 5 ppm, that engine fires).
    let sigma = (this.fluid.Ag / 10.0) * (this.fluid.Te / 2.0);
    const T = this.temperature;
    if (T < 50 || T > 400) return 0;
    let T_factor = 1.0;
    if (T >= 150 && T <= 250) T_factor = 1.2;
    else if (T < 150) T_factor = Math.max(0.4, 0.5 + 0.007 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.006 * (T - 250));
    sigma *= T_factor;
    // Sulfide competition — acanthite (Ag2S) wins when S >> Te
    if (this.fluid.S > 30) sigma *= Math.max(0.4, 1.0 - 0.01 * (this.fluid.S - 30));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hessite');
    return Math.max(sigma, 0);
  },

  // Ag2Se — silver selenide. Phase transition at 133°C (orthorhombic↔cubic).
  // Wins over acanthite + hessite only when Se > S and Se > Te.
  supersaturation_naumannite() {
    // 2026-05 cascade-gate audit Arc 3 calibration tier: same bulk-view-
    // proxy philosophy as cobaltite + nickeline. Pre-fix: scaling
    // Ag/30 × Se/5 yielded σ_base = 0.107 at Schneeberg's seeded Ag=8 +
    // Se=2 — 12× below the σ>1.3 nuc threshold. Naumannite (Ag2Se) is
    // the diagnostic Erzgebirge selenide-vein mineral (Pinch & Wilson
    // 1977); the σ formula was calibrated against fluid-inclusion bulk
    // measurements rather than the locally-enriched precipitating cell.
    //
    // Tighten Ag/30 → Ag/6 and Se/5 → Se/1.5. At Schneeberg Ag=8, Se=2:
    // σ_base = 1.33 × 1.33 = 1.78. At peak T (100-200°C, naumannite's
    // sweet spot), σ ≈ 2.1 — clears the 1.3 nuc threshold cleanly. The
    // Ag<5 / Se<1 lower gates stay (geological floor).
    if (this.fluid.Ag < 5 || this.fluid.Se < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.Ag / 6.0) * (this.fluid.Se / 1.5);
    const T = this.temperature;
    if (T < 50 || T > 350) return 0;
    let T_factor = 1.0;
    if (T >= 100 && T <= 200) T_factor = 1.2;
    else if (T < 100) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 200));
    sigma *= T_factor;
    if (this.fluid.S > 30) sigma *= Math.max(0.4, 1.0 - 0.01 * (this.fluid.S - 30));
    // Hessite competition — when Te > Se, hessite wins
    if (this.fluid.Te > this.fluid.Se) sigma *= 0.6;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'naumannite');
    return Math.max(sigma, 0);
  },

  // PbSe — lead selenide. Galena-structure. Above 300°C forms continuous
  // SS with galena; below, miscibility gap opens (exsolution lamellae).
  supersaturation_clausthalite() {
    if (this.fluid.Pb < 20 || this.fluid.Se < 1) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.Pb / 80.0) * (this.fluid.Se / 5.0);
    const T = this.temperature;
    if (T < 50 || T > 450) return 0;
    let T_factor = 1.0;
    if (T >= 100 && T <= 250) T_factor = 1.2;
    else if (T < 100) T_factor = Math.max(0.4, 0.5 + 0.01 * (T - 50));
    else T_factor = Math.max(0.4, 1.2 - 0.005 * (T - 250));
    sigma *= T_factor;
    // Galena competition — high S forms PbS instead
    if (this.fluid.S > 30) sigma *= Math.max(0.3, 1.0 - 0.015 * (this.fluid.S - 30));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'clausthalite');
    return Math.max(sigma, 0);
  },

  // CdS — hexagonal (wurtzite-structure) cadmium sulfide. High-T polymorph
  // (>200°C). Fast nucleation due to extreme Ksp (~10⁻²⁸). Forms by
  // sphalerite oxidation releasing Cd that re-precipitates against
  // residual sulfide.
  supersaturation_greenockite() {
    if (this.fluid.Cd < 0.5 || this.fluid.S < 5) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    let sigma = (this.fluid.Cd / 1.5) * (this.fluid.S / 30.0);
    const T = this.temperature;
    if (T < 25 || T > 250) return 0;
    let T_factor = 1.0;
    if (T >= 50 && T <= 150) T_factor = 1.2;
    else if (T < 50) T_factor = Math.max(0.5, 0.6 + 0.012 * (T - 25));
    else T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 150));
    sigma *= T_factor;
    // pH window 5-7
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (4.0 - this.fluid.pH));
    if (this.fluid.pH > 8.0) sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 8.0));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'greenockite');
    return Math.max(sigma, 0);
  },

  // CdS — cubic (sphalerite-structure) low-T polymorph. <100°C kinetically
  // favored. Always powdery — no discrete crystals.
  supersaturation_hawleyite() {
    if (this.fluid.Cd < 0.5 || this.fluid.S < 5) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    let sigma = (this.fluid.Cd / 1.5) * (this.fluid.S / 30.0);
    const T = this.temperature;
    if (T < 5 || T > 100) return 0;
    let T_factor = 1.0;
    if (T >= 10 && T <= 50) T_factor = 1.2;
    else if (T < 10) T_factor = Math.max(0.4, 0.5 + 0.05 * T);
    else T_factor = Math.max(0.4, 1.2 - 0.015 * (T - 50));
    sigma *= T_factor;
    // Above 100°C, greenockite (hexagonal) is favored
    if (this.fluid.pH < 4.0) sigma *= Math.max(0.3, 1.0 - 0.3 * (4.0 - this.fluid.pH));
    if (this.fluid.pH > 8.0) sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 8.0));
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'hawleyite');
    return Math.max(sigma, 0);
  },

  // v94 (2026-05-19): enargite — Cu₃AsS₄ orthorhombic high-sulfidation
  // Cu-As-S sulfosalt. Type-locality and dominant primary Cu mineral at
  // Butte MT, Chuquicamata Chile, Bisbee AZ, Tsumeb upper sulfide zone,
  // Lepanto Philippines, El Indio Chile, Goldfield NV.
  //
  // CRITICAL discriminator from tennantite (Cu₁₂As₄S₁₃, intermediate-
  // sulfidation): enargite needs HIGHER f(S₂) AND LOWER pH (Einaudi,
  // Hedenquist & Inan 2003 — sulfidation-state diagram). The simulator
  // has total S only, not f(S₂), so the proxy is:
  //
  //     sulfidation_proxy = log10(S_ppm + 1) - pH
  //
  // High-sulfidation (enargite): proxy > 1.5, pH < 4.5
  //   (e.g. S=1000, pH=2.5 → proxy=0.5 → STILL borderline; needs both
  //    high S AND low pH simultaneously, matching the SO₂ disproportion-
  //    ation environment that drives Butte-style high-sulfidation
  //    porphyry-related Cu).
  // Intermediate-sulfidation (tennantite): proxy 0.5-1.5, pH 3-7.
  //
  // Refs: research dossier 2026-05-19; Einaudi/Hedenquist/Inan (2003)
  // SEG Special Publication 10:285-313; Sack & Loucks (1985) Am. Min.
  // 70:1270-1289; Posfai & Buseck (1998) for enargite/luzonite phase
  // relations (luzonite is the < 320°C polymorph; the engine fires
  // enargite across the full T range but flags luzonite-regime growth).
  // v95 (2026-05-19): Diarsenide quartet — the five-element vein primary
  // arsenide stage. Schneeberg/Jachymov canonical, Cobalt-Ontario,
  // Bou Azzer, Andreasberg, Black Hawk NM. Defined by Kissin (1992
  // Geosci. Canada 19:113) as the Ni-Co-As-Ag-Bi association where rapid
  // reduction (CH4/graphite/Fe2+ wall-rock contact) of an oxidized
  // As(III)-bearing brine drives precipitation far from equilibrium
  // (Markl et al. 2016 Min. Dep. 51:703 — the "natural fracking" model).
  //
  // All four use:
  //   * arseniteAvailablePpm (As(III), the arsenide oxidation state)
  //   * sulfideRedoxAnoxic gate — REDUCING, sulfide-poor regime
  //   * As >> S gate (X_As > 0.95 in solid; in fluid: As > 5x S)
  //   * pH 5.5-7 carbonate-buffered
  //
  // Discriminator gates per mineral (dominant metal + T-range):
  //   skutterudite    (Co,Ni,Fe)As3   T 280-500 highest, deepest Co-Ni
  //   rammelsbergite  NiAs2           T 250-400 Ni-dominant, pink tint
  //   safflorite      (Co,Fe)As2      T 200-350 Co-dominant, star-twins
  //   loellingite     FeAs2           T 150-450 Fe-dominant, widest range
  //
  // Refs: Kissin 1992, Markl et al. 2016 (Odenwald), Ondrus et al. 2003
  // (Jachymov), Radcliffe & Berry 1968 Am. Min. 53:1856 (safflorite-
  // loellingite solid solution), Handbook of Mineralogy.

  supersaturation_skutterudite() {
    // (Co,Ni,Fe)As3 — cubic Im-3m, triarsenide stoichiometry demands
    // the HIGHEST As activity of any phase here. Forms FIRST in zoned
    // arsenide rosettes on native Bi-Ag dendrites. Cobalt-Canada
    // chemistry shows X_As = 0.96-0.99 (Markl et al. 2016).
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Co < 5 || as_iii < 30) return 0;
    if (this.fluid.S > 5) return 0;  // No sulfur tolerance
    if (!sulfideRedoxAnoxic(this.fluid, 0.5)) return 0;  // VERY reducing
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    if (this.temperature < 280 || this.temperature > 500) return 0;
    const co_f  = Math.min(this.fluid.Co / 50.0, 2.5);
    const as_f  = Math.min(as_iii / 80.0, 2.0);
    let sigma = co_f * as_f;
    // T sweet spot 320-420
    const T = this.temperature;
    if (T >= 320 && T <= 420) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 370) / 100);
    // Ni co-incorporation: Ni enables triarsenide stoichiometry
    if (this.fluid.Ni > 5) sigma *= 1.1;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'skutterudite');
    return Math.max(sigma, 0);
  },

  supersaturation_safflorite() {
    // (Co,Fe)As2 — orthorhombic Pnnm (loellingite group), star-twin on
    // {011} fivelings. Mid-T member, tolerates a few wt% S in solid.
    // The Co-sink phase when residual fluid has moderate As after
    // skutterudite has crystallized.
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Co < 5 || as_iii < 15) return 0;
    if (this.fluid.S > 15) return 0;  // ~0.9 wt% S in solid tolerance
    if (!sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    if (this.temperature < 200 || this.temperature > 380) return 0;
    const co_f = Math.min(this.fluid.Co / 40.0, 2.5);
    const as_f = Math.min(as_iii / 40.0, 2.0);
    let sigma = co_f * as_f;
    // T sweet spot 230-320
    const T = this.temperature;
    if (T >= 230 && T <= 320) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 275) / 80);
    // Fe substitution: safflorite-loellingite solid solution
    if (this.fluid.Fe > 20) sigma *= 1.1;
    // Mantle position — discount if NO skutterudite/rammelsbergite-
    // friendly fluid (i.e., needs depleted-Ni residual after first
    // arsenide pulse). Approximated by Co/Ni ratio.
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'safflorite');
    return Math.max(sigma, 0);
  },

  supersaturation_rammelsbergite() {
    // NiAs2 — orthorhombic Pnnm, Ni-dominant diarsenide. Pink-tinted
    // tin-white. Up to ~3 wt% S tolerance before flipping to
    // gersdorffite (NiAsS, not in catalog).
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Ni < 5 || as_iii < 15) return 0;
    if (this.fluid.S > 20) return 0;
    if (!sulfideRedoxAnoxic(this.fluid, 1.0)) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    if (this.temperature < 250 || this.temperature > 420) return 0;
    const ni_f = Math.min(this.fluid.Ni / 40.0, 2.5);
    const as_f = Math.min(as_iii / 40.0, 2.0);
    let sigma = ni_f * as_f;
    // T sweet spot 280-380
    const T = this.temperature;
    if (T >= 280 && T <= 380) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 330) / 80);
    // Suppress when Co > Ni (safflorite or skutterudite wins)
    if (this.fluid.Co > this.fluid.Ni) sigma *= 0.5;
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'rammelsbergite');
    return Math.max(sigma, 0);
  },

  supersaturation_loellingite() {
    // FeAs2 — orthorhombic Pnnm (the namesake of the loellingite group),
    // Fe-dominant diarsenide. Widest T range of the quartet (150-450°C).
    // CRITICAL: at fS2 > ~10^-12 atm, flips to arsenopyrite FeAsS
    // (Kretschmar & Scott 1976). The simulator's S < 1 gate is the
    // proxy for "below the loellingite-arsenopyrite boundary."
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Fe < 10 || as_iii < 15) return 0;
    if (this.fluid.S > 1) return 0;  // Sharp arsenopyrite boundary
    if (!sulfideRedoxAnoxic(this.fluid, 1.2)) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    if (this.temperature < 150 || this.temperature > 450) return 0;
    const fe_f = Math.min(this.fluid.Fe / 50.0, 2.0);
    const as_f = Math.min(as_iii / 40.0, 2.0);
    let sigma = fe_f * as_f;
    // T sweet spot 200-300 in five-element-vein context, but engine
    // accepts the full 150-450 range with smooth attenuation
    const T = this.temperature;
    if (T >= 200 && T <= 350) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 275) / 150);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'loellingite');
    return Math.max(sigma, 0);
  },

  // v96 (2026-05-19): Ruby silvers — proustite (Ag3AsS3, "light ruby
  // silver", As-end) + pyrargyrite (Ag3SbS3, "dark ruby silver", Sb-end).
  // Trigonal R3c, isostructural; near-complete solid solution above
  // ~300°C with a miscibility gap opening below ~200°C (Sack & Loucks
  // 1985 Am. Min. 70:1270-1289). Type ruby-silver Ag mining minerals
  // at Schneeberg / Jachymov / Andreasberg / Pribram / Chanarcillo /
  // San Cristobal Bolivia / Guanajuato / Cobalt-Ontario / Comstock Lode.
  //
  // The fork mechanism (research dossier 2026-05): below the solvus,
  // fluids nucleate end-member proustite OR end-member pyrargyrite,
  // discriminated by X_As = mol(As)/(mol(As)+mol(Sb)) in fluid:
  //   X_As > 0.7 → proustite
  //   X_As < 0.3 → pyrargyrite
  //   intermediate at T > 300°C → solid solution (rare in nature)
  //   intermediate at T < 200°C → both co-precipitate as discrete grains
  //
  // Late-stage epithermal Ag: 100-300°C, near-neutral to weakly alkaline
  // (pH 5-8), reducing (HM-2 to HM-6), low-sulfidation environment.
  // Use arseniteAvailablePpm for As(III) — ruby silvers carry As in
  // [AsS3]^3- trigonal pyramidal groups (like tennantite, NOT arsenate).
  //
  // Refs: Sack & Loucks 1985; Ondrus et al. 2003 (Jachymov); Dana 7th;
  // Handbook of Mineralogy; Keighin & Honea 1969 (proustite-pyrargyrite
  // phase diagram).

  supersaturation_proustite() {
    // Ag3AsS3 — the As-end ruby silver. Scarlet-vermilion to cochineal
    // red, photodecomposes (museum specimens kept in dark).
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Ag < 0.1 || as_iii < 1 || this.fluid.S < 10) return 0;
    if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    if (this.temperature < 100 || this.temperature > 350) return 0;
    // X_As fork — proustite needs As-dominant fluid
    const sb = this.fluid.Sb || 0;
    const x_as = as_iii / Math.max(as_iii + sb, 0.001);
    if (x_as < 0.5) return 0;  // below 0.5 → pyrargyrite field
    const ag_f = Math.min(this.fluid.Ag / 2.0, 3.0);
    const as_f = Math.min(as_iii / 15.0, 2.5);
    const s_f  = Math.min(this.fluid.S / 100.0, 2.0);
    let sigma = ag_f * as_f * s_f;
    // X_As preference: above 0.7 = pure proustite, sweet spot
    if (x_as >= 0.7) sigma *= 1.4;
    else sigma *= Math.max(0.5, (x_as - 0.5) * 4.0);  // 0.5-0.7 ramp
    // T sweet spot 180-250°C
    const T = this.temperature;
    if (T >= 180 && T <= 250) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 215) / 80);
    sigma *= sulfideRedoxLinearFactor(this.fluid, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'proustite');
    return Math.max(sigma, 0);
  },

  supersaturation_pyrargyrite() {
    // Ag3SbS3 — the Sb-end ruby silver. Cherry-red to red-black,
    // typically larger crystals than proustite (Andreasberg 5 cm+).
    // The MORE common of the two ruby silvers (Sb is more abundant
    // than As in most epithermal Ag systems).
    const as_iii = arseniteAvailablePpm(this.fluid);
    const sb = this.fluid.Sb || 0;
    if (this.fluid.Ag < 0.1 || sb < 1 || this.fluid.S < 10) return 0;
    if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    if (this.temperature < 100 || this.temperature > 320) return 0;
    // X_As fork — pyrargyrite needs Sb-dominant fluid (X_As < 0.5)
    const x_as = as_iii / Math.max(as_iii + sb, 0.001);
    if (x_as > 0.5) return 0;  // above 0.5 → proustite field
    const ag_f = Math.min(this.fluid.Ag / 2.0, 3.0);
    const sb_f = Math.min(sb / 15.0, 2.5);
    const s_f  = Math.min(this.fluid.S / 100.0, 2.0);
    let sigma = ag_f * sb_f * s_f;
    // X_As preference: below 0.3 = pure pyrargyrite, sweet spot
    if (x_as <= 0.3) sigma *= 1.4;
    else sigma *= Math.max(0.5, (0.5 - x_as) * 4.0);  // 0.3-0.5 ramp
    // T sweet spot 150-230°C (slightly cooler than proustite per research)
    const T = this.temperature;
    if (T >= 150 && T <= 230) sigma *= 1.3;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(T - 190) / 80);
    sigma *= sulfideRedoxLinearFactor(this.fluid, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'pyrargyrite');
    return Math.max(sigma, 0);
  },

  supersaturation_enargite() {
    const as_iii = arseniteAvailablePpm(this.fluid);
    if (this.fluid.Cu < 20 || as_iii < 5 || this.fluid.S < 100) return 0;
    if (!sulfideRedoxAnoxic(this.fluid, 1.5)) return 0;
    if (this.fluid.pH > 4.5) return 0;  // high-sulfidation = acidic
    if (this.temperature < 200 || this.temperature > 500) return 0;
    // Sulfidation-state proxy: high S + low pH → high f(S₂)
    const sulfidation_proxy = Math.log10(this.fluid.S + 1) - this.fluid.pH;
    if (sulfidation_proxy < 0.5) return 0;  // tennantite field instead
    const product = (this.fluid.Cu / 60.0) * (as_iii / 20.0) * (this.fluid.S / 200.0);
    let T_factor;
    if (this.temperature >= 250 && this.temperature <= 400) T_factor = 1.3;
    else if (this.temperature < 250) T_factor = Math.max(0.4, 1.0 - (250 - this.temperature) / 100);
    else T_factor = Math.max(0.4, 1.0 - (this.temperature - 400) / 100);
    // pH sweet spot 1.5-3 (advanced argillic alteration regime)
    if (this.fluid.pH > 3.0) T_factor *= Math.max(0.3, 1.0 - (this.fluid.pH - 3.0) * 0.5);
    let sigma = product * T_factor * sulfideRedoxLinearFactor(this.fluid, 1.5);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'enargite');
    return Math.max(sigma, 0);
  },
});
