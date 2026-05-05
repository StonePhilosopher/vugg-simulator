// ============================================================
// js/25-chemistry-conditions.ts — VugConditions + 97 supersat methods
// ============================================================
// Mirror of vugg/chemistry/conditions.py. The mega-class with all the
// fluid/wall/ring fields plus one supersaturation_<mineral>() per
// supported mineral. Phase B7 will split the supersat methods into
// per-class mixin files (mirroring vugg/chemistry/supersat/<class>.py),
// leaving this module slim.
//
// Phase B6 of PROPOSAL-MODULAR-REFACTOR.

class VugConditions {
  constructor(opts = {}) {
    this.temperature = opts.temperature ?? 350.0;
    this.pressure = opts.pressure ?? 1.5;
    this.fluid = opts.fluid || new FluidChemistry();
    this.flow_rate = opts.flow_rate ?? 1.0;
    this.wall = opts.wall || new VugWall();
    // v24 water-level mechanic. Float in [0, ring_count] giving the
    // meniscus position; null = "no water level set" → fully submerged
    // (legacy default, every ring 'submerged'). Below = submerged,
    // surface band = meniscus, above = vadose/'air'.
    this.fluid_surface_ring = opts.fluid_surface_ring ?? null;
    // v26 host-rock porosity. Sink-only term for water-level drift:
    // each step the surface drops by porosity × WATER_LEVEL_DRAIN_RATE
    // rings. 0.0 = sealed cavity (no drainage; legacy default). 1.0 =
    // highly permeable host. Filling stays event-driven.
    this.porosity = opts.porosity ?? 0.0;
    // Kim 2023 dolomite cycle tracking — fluid-level so all dolomites benefit
    this._dol_cycle_count = 0;
    this._dol_prev_sigma = 0.0;
    this._dol_in_undersat = false;
  }

  // Pure classifier; used by ringWaterState and by transition-detection
  // logic that needs to compare against an arbitrary previous surface.
  static _classifyWaterState(surface, ringIdx, ringCount) {
    if (surface === null || surface === undefined) return 'submerged';
    if (ringCount <= 1) return surface >= 1.0 ? 'submerged' : 'vadose';
    if (ringIdx + 1 <= surface) return 'submerged';
    if (ringIdx >= surface) return 'vadose';
    return 'meniscus';
  }

  // v24: classify a ring as 'submerged' / 'meniscus' / 'vadose'
  // from the cavity's current fluid_surface_ring. Mirror of
  // VugConditions.ring_water_state in vugg.py.
  ringWaterState(ringIdx, ringCount) {
    return VugConditions._classifyWaterState(this.fluid_surface_ring, ringIdx, ringCount);
  }

  update_dol_cycles() {
    // Track dolomite saturation crossings — call once per step.
    const sigma = this.supersaturation_dolomite();
    const prev = this._dol_prev_sigma;
    if (prev > 0.0) {
      if (prev >= 1.0 && sigma < 1.0) {
        this._dol_in_undersat = true;
      } else if (prev < 1.0 && sigma >= 1.0 && this._dol_in_undersat) {
        this._dol_cycle_count += 1;
        this._dol_in_undersat = false;
      }
    }
    this._dol_prev_sigma = sigma;
  }

  // Mo flux effect: when Mo > 20 ppm, high-temperature minerals nucleate
  // as if temperature were 15% higher. MoO₃ is a classic flux for growing
  // corundum at lower temperatures — here it broadens what can grow.
  get effectiveTemperature() {
    if (this.fluid.Mo > 20) {
      const boost = 1.0 + 0.15 * Math.min((this.fluid.Mo - 20) / 40, 1.0);
      return this.temperature * boost;
    }
    return this.temperature;
  }

  // SiO₂ solubility in water (ppm) — based on Fournier & Potter 1982 / Rimstidt 1997
  // Quartz solubility is PROGRADE: increases with temperature.
  // Quartz precipitates when silica-rich hot fluid COOLS.
  static _SiO2_SOLUBILITY = [
    [25,6],[50,15],[75,30],[100,60],[125,90],[150,130],[175,200],
    [200,300],[225,390],[250,500],[275,600],[300,700],[325,850],
    [350,1000],[375,1100],[400,1200],[450,1400],[500,1500],[600,1600]
  ];

  silica_equilibrium(T) {
    const table = VugConditions._SiO2_SOLUBILITY;
    if (T <= table[0][0]) return table[0][1];
    if (T >= table[table.length-1][0]) return table[table.length-1][1];
    for (let i = 0; i < table.length - 1; i++) {
      if (T >= table[i][0] && T <= table[i+1][0]) {
        const frac = (T - table[i][0]) / (table[i+1][0] - table[i][0]);
        return table[i][1] + frac * (table[i+1][1] - table[i][1]);
      }
    }
    return table[table.length-1][1];
  }

  // Which SiO₂ polymorph precipitates at this temperature?
  silica_polymorph() {
    const T = this.temperature;
    if (T < 100) return 'opal';           // Amorphous silica
    if (T < 200) return 'chalcedony';     // Microcrystalline quartz
    if (T < 573) return 'alpha-quartz';   // α-quartz — the classic
    if (T < 870) return 'beta-quartz';    // β-quartz (inverts to α on cooling)
    return 'tridymite';                    // High-T volcanic polymorph
  }

  supersaturation_quartz() {
    const eq = this.silica_equilibrium(this.effectiveTemperature);
    if (eq <= 0) return 0;
    let sigma = this.fluid.SiO2 / eq;

    // HF attack on quartz: low pH + high F = dissolution
    if (this.fluid.pH < 4.0 && this.fluid.F > 20) {
      const hf_attack = (4.0 - this.fluid.pH) * (this.fluid.F / 50.0) * 0.3;
      sigma -= hf_attack;
    }

    return Math.max(sigma, 0);
  }

  supersaturation_calcite() {
    // Calcite has RETROGRADE solubility — less soluble at higher T.
    // Precipitates on heating or CO₂ degassing. Forms at 10-500°C.
    // Decomposes to CaO + CO₂ above ~500°C.
    // Mg poisoning: Mg²⁺ stalls calcite {10ī4} growth steps (Davis 2000;
    // Nielsen 2013). Mg/Ca > ~2 hands the polymorph to aragonite. Capped
    // at 85% inhibition — high-Mg calcite (HMC) always forms some fraction.
    if (this.temperature > 500) return 0; // thermal decomposition
    const eq = 300.0 * Math.exp(-0.005 * this.temperature);
    if (eq <= 0) return 0;
    const ca_co3 = Math.min(this.fluid.Ca, this.fluid.CO3);
    let sigma = ca_co3 / eq;

    // Acid dissolution of carbonates
    if (this.fluid.pH < 5.5) {
      const acid_attack = (5.5 - this.fluid.pH) * 0.5;
      sigma -= acid_attack;
    }
    // Alkaline conditions favor carbonate precipitation
    else if (this.fluid.pH > 7.5) {
      sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.15;
    }

    // Mg poisoning of calcite growth steps — sigmoid centered on Mg/Ca=2
    const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
    const mg_inhibition = 1.0 / (1.0 + Math.exp(-(mg_ratio - 2.0) / 0.5));
    sigma *= (1.0 - 0.85 * mg_inhibition);

    return Math.max(sigma, 0);
  }

  supersaturation_siderite() {
    // FeCO3 — iron carbonate. Reducing conditions only (Fe²⁺ stability).
    if (this.fluid.Fe < 10 || this.fluid.CO3 < 20) return 0;
    if (this.temperature < 20 || this.temperature > 300) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 9.0) return 0;
    if (this.fluid.O2 > 0.8) return 0;  // hard reducing gate
    const eq_fe = 80.0 * Math.exp(-0.005 * this.temperature);
    if (eq_fe <= 0) return 0;
    const fe_co3 = Math.min(this.fluid.Fe, this.fluid.CO3);
    let sigma = fe_co3 / eq_fe;
    if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
    else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
    if (this.fluid.O2 > 0.3) sigma *= Math.max(0.2, 1.0 - (this.fluid.O2 - 0.3) * 1.5);
    return Math.max(sigma, 0);
  }

  supersaturation_dolomite() {
    // CaMg(CO3)2 — ordered Ca-Mg carbonate. Kim 2023: T floor lowered to
    // 10°C — ambient T is fine thermodynamically, kinetics handled by f_ord.
    if (this.fluid.Mg < 25 || this.fluid.Ca < 30 || this.fluid.CO3 < 20) return 0;
    if (this.temperature < 10 || this.temperature > 400) return 0;
    if (this.fluid.pH < 6.5 || this.fluid.pH > 10.0) return 0;
    const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
    if (mg_ratio < 0.3 || mg_ratio > 30.0) return 0;
    const eq = 200.0 * Math.exp(-0.005 * this.temperature);
    if (eq <= 0) return 0;
    const ca_mg = Math.sqrt(this.fluid.Ca * this.fluid.Mg);
    const co3_limit = this.fluid.CO3 * 2.0;
    const product = Math.min(ca_mg, co3_limit);
    let sigma = product / eq;
    const ratio_distance = Math.abs(Math.log10(mg_ratio));
    sigma *= Math.exp(-ratio_distance * 1.0);
    if (this.temperature > 250) sigma *= Math.max(0.3, 1.0 - (this.temperature - 250) / 200.0);
    if (this.fluid.pH < 6.5) sigma -= (6.5 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  supersaturation_rhodochrosite() {
    // MnCO3 — pink Mn carbonate, structurally identical to calcite (R3̄c).
    // T 20-250°C, pH 5-9, Mn²⁺ stable in moderate-to-reducing conditions.
    if (this.fluid.Mn < 5 || this.fluid.CO3 < 20) return 0;
    if (this.temperature < 20 || this.temperature > 250) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 9.0) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    const eq_mn = 50.0 * Math.exp(-0.005 * this.temperature);
    if (eq_mn <= 0) return 0;
    const mn_co3 = Math.min(this.fluid.Mn, this.fluid.CO3);
    let sigma = mn_co3 / eq_mn;
    if (this.fluid.pH < 5.5) sigma -= (5.5 - this.fluid.pH) * 0.5;
    else if (this.fluid.pH > 7.5) sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.1;
    if (this.fluid.O2 > 0.8) sigma *= Math.max(0.3, 1.5 - this.fluid.O2);
    return Math.max(sigma, 0);
  }

  supersaturation_aragonite() {
    // Orthorhombic CaCO₃ dimorph — metastable at surface but kinetically
    // favored when Mg/Ca > ~1.5 (dominant, Folk 1974 / Morse 1997),
    // T > ~50°C (Burton & Walter 1987 in low-Mg), or Ω > ~10 (Ostwald
    // step rule, Sun 2015). Trace Sr/Pb/Ba give a small additional boost.
    // Pressure is the thermodynamic sorter (stable above ~0.4 GPa) but is
    // irrelevant at vug/hot-spring pressures — don't use it as a gate.
    if (this.fluid.Ca < 30 || this.fluid.CO3 < 20) return 0;
    if (this.fluid.pH < 6.0 || this.fluid.pH > 9.0) return 0;

    const eq = 300.0 * Math.exp(-0.005 * this.temperature);
    if (eq <= 0) return 0;
    const ca_co3 = Math.min(this.fluid.Ca, this.fluid.CO3);
    const omega = ca_co3 / eq;

    const mg_ratio = this.fluid.Mg / Math.max(this.fluid.Ca, 0.01);
    const mg_factor = 1.0 / (1.0 + Math.exp(-(mg_ratio - 1.5) / 0.3));
    const T_factor = 1.0 / (1.0 + Math.exp(-(this.temperature - 50.0) / 15.0));
    const omega_factor = 1.0 / (1.0 + Math.exp(-(Math.log10(Math.max(omega, 0.01)) - 1.0) / 0.3));
    const trace_sum = this.fluid.Sr + this.fluid.Pb + this.fluid.Ba;
    const trace_ratio = trace_sum / Math.max(this.fluid.Ca, 0.01);
    const trace_factor = 1.0 + 0.3 / (1.0 + Math.exp(-(trace_ratio - 0.01) / 0.005));

    // Weighted sum, not product — Mg/Ca alone is enough at high values.
    const favorability = (0.70 * mg_factor + 0.20 * T_factor + 0.10 * omega_factor) * trace_factor;
    return omega * favorability;
  }

  supersaturation_fluorite() {
    if (this.fluid.Ca < 10 || this.fluid.F < 5) return 0;
    let product = (this.fluid.Ca / 200.0) * (this.fluid.F / 20.0);
    // 5-tier T window per Richardson & Holland 1979 + MVT deposit
    // studies showing 50-152°C formation range. Solubility increases
    // with T below 100°C (kinetically slow precipitation), passes
    // through max around 100-250°C, declines above 350°C.
    let T_factor = 1.0;
    if (this.temperature < 50) T_factor = this.temperature / 50.0;
    else if (this.temperature < 100) T_factor = 0.8;
    else if (this.temperature <= 250) T_factor = 1.2;
    else if (this.temperature <= 350) T_factor = 1.0;
    else T_factor = Math.max(0.1, 1.0 - (this.temperature - 350) / 200);
    let sigma = product * T_factor;
    // v17: fluoro-complex penalty (ported from Python canonical, May 2026).
    // Per Manning 1979 — at very high F, Ca²⁺ + nF⁻ → CaFₙ complexes
    // re-dissolve fluorite. Secondary effect at T<300°C, real.
    if (this.fluid.F > 80) {
      const complex_penalty = (this.fluid.F - 80) / 200.0;
      sigma -= complex_penalty;
    }
    // Acid dissolution — fluorite dissolves in strong acid
    if (this.fluid.pH < 5.0) {
      const acid_attack = (5.0 - this.fluid.pH) * 0.4;
      sigma -= acid_attack;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_sphalerite() {
    if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
    const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
    // Below 95°C: full sigma. Above: accelerated decay (wurtzite field).
    const T_factor = this.temperature <= 95
      ? 2.0 * Math.exp(-0.004 * this.temperature)
      : 2.0 * Math.exp(-0.01 * this.temperature);
    return product * T_factor;
  }

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
  }

  supersaturation_pyrite() {
    if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
    const eT = this.effectiveTemperature; // Mo flux widens T window
    const T_factor = (100 < eT && eT < 400) ? 1.0 : 0.5;
    // pH rolloff below 5 — marcasite (orthorhombic FeS2) wins in acid
    let pH_factor = 1.0;
    if (this.fluid.pH < 5.0) {
      pH_factor = Math.max(0.3, (this.fluid.pH - 3.5) / 1.5);
    }
    return product * T_factor * pH_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_marcasite() {
    // Orthorhombic FeS2 dimorph of pyrite. pH<5 AND T<240 hard gates.
    if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    if (this.fluid.pH >= 5.0) return 0;
    if (this.temperature > 240) return 0;
    const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
    const pH_factor = Math.min(1.4, (5.0 - this.fluid.pH) / 1.2);
    const T_factor = this.temperature < 150 ? 1.2 : 0.6;
    return product * pH_factor * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_chalcopyrite() {
    if (this.fluid.Cu < 10 || this.fluid.Fe < 5 || this.fluid.S < 15) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    const product = (this.fluid.Cu / 80.0) * (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
    const eT = this.effectiveTemperature; // Mo flux widens T window
    // Chalcopyrite: main porphyry window 300-500°C, ~90% deposits before 400°C (Seo et al. 2012)
    // Can form at lower T (200-300°C) but less efficiently. Rare below 180°C.
    let T_factor;
    if (eT < 180) T_factor = 0.2;            // rare at low T
    else if (eT < 300) T_factor = 0.8;       // viable, not peak
    else if (eT <= 500) T_factor = 1.3;      // sweet spot — porphyry window
    else T_factor = 0.5;                      // fades above 500°C
    return product * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_hematite() {
    if (this.fluid.Fe < 20 || this.fluid.O2 < 0.5) return 0;
    let sigma = (this.fluid.Fe / 100.0) * (this.fluid.O2 / 1.0) * Math.exp(-0.002 * this.temperature);
    if (this.fluid.pH < 3.5) {
      sigma -= (3.5 - this.fluid.pH) * 0.3;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_malachite() {
    if (this.fluid.Cu < 5 || this.fluid.CO3 < 20 || this.fluid.O2 < 0.3) return 0;
    // Denominators reference realistic supergene weathering fluid (Cu ~25 ppm,
    // CO₃ ~100 ppm). The older 50/200 values were tuned for Cu-saturated
    // porphyry fluids and starved supergene vugs of their flagship Cu mineral.
    // Malachite-vs-azurite competition is encoded by carbonate-activity
    // thresholds (Vink 1986, Mineralogical Magazine 50:43-47): malachite
    // CO3 ≥20, azurite CO3 ≥120 — the sim-scale encoding of Vink's
    // log(pCO2) ≈ -3.5 univariant boundary at 25°C. Azurite drops back
    // to malachite via the paramorph mechanic in grow_azurite when CO3
    // falls during a run (Bisbee step 225 ev_co2_drop).
    // See research/research-broth-ratio-malachite-azurite.md.
    let sigma = (this.fluid.Cu / 25.0) * (this.fluid.CO3 / 100.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.005 * (this.temperature - 50));
    }
    if (this.fluid.pH < 4.5) {
      sigma -= (4.5 - this.fluid.pH) * 0.5;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_uraninite() {
    // Reconciled to Python canonical (v12, May 2026). Pre-v12 JS used a
    // T-only formula with no O2 gate — uraninite would form even in
    // oxidizing conditions, contradicting research-uraninite.md.
    // Now: needs reducing + U + (slight high-T preference).
    if (this.fluid.U < 5 || this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.U / 20.0) * (0.5 - this.fluid.O2);
    if (this.temperature > 200) sigma *= 1.3;
    return Math.max(sigma, 0);
  }

  supersaturation_galena() {
    // v13: reconciled to Python — pre-v13 had no O2 gate, allowing the
    // sulfide to form under oxidizing conditions (a clear physics bug,
    // surfaced by tools/supersat_drift_audit.py). Now matches vugg.py.
    if (this.fluid.Pb < 5 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;  // sulfides can't survive oxidation
    let sigma = (this.fluid.Pb / 50.0) * (this.fluid.S / 80.0) * (1.5 - this.fluid.O2);
    // v17: Mo-flux applied throughout via effectiveTemperature (matches Python).
    const eT = this.effectiveTemperature;
    if (eT >= 200 && eT <= 400) sigma *= 1.3;
    if (eT > 450) sigma *= Math.exp(-0.008 * (eT - 450));
    return Math.max(sigma, 0);
  }

  supersaturation_smithsonite() {
    // v17 reconciliation (May 2026): supergene-only per
    // research-smithsonite.md (T 10-50°C optimum, never above ~80°C
    // in nature). Pre-v17 JS hard cap at 200°C was too lenient.
    // Tightened to 100°C hard with steep decay above 80°C.
    if (this.fluid.Zn < 20 || this.fluid.CO3 < 50 || this.fluid.O2 < 0.2) return 0;
    if (this.temperature > 100) return 0;
    if (this.fluid.pH < 5) return 0;
    let sigma = (this.fluid.Zn / 80.0) * (this.fluid.CO3 / 200.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 80) {
      sigma *= Math.exp(-0.04 * (this.temperature - 80));
    }
    if (this.fluid.pH > 7) sigma *= 1.2;
    return Math.max(sigma, 0);
  }

  // Wulfenite (PbMoO₄) — supergene mineral requiring oxidation of BOTH galena and molybdenite
  // Per Seo et al. 2012: wulfenite forms when Pb²⁺ (from oxidized galena) meets MoO₄²⁻ (from oxidized molybdenite)
  supersaturation_wulfenite() {
    // v17 reconciliation (May 2026): per research-wulfenite.md
    // "T <80°C (supergene), pH 6-9 (near-neutral to slightly alkaline),
    // rare two-parent mineral that only appears when chemistry of two
    // different primary ore bodies converges." Pre-v17 JS T cap at
    // 250°C was way too lenient (250°C is hydrothermal, not supergene);
    // pH window 4-7 was too restrictive on alkaline side. Now matches
    // Python: decay above 80°C, graduated pH penalties at 3.5/9.0.
    // Pb/Mo thresholds (>=10/>=5) preserved — JS canonical here, matches
    // the research's "rare two-parent" framing better than Python's
    // pre-v17 lower thresholds.
    if (this.fluid.Pb < 10 || this.fluid.Mo < 5 || this.fluid.O2 < 0.5) return 0;
    let sigma = (this.fluid.Pb / 40.0) * (this.fluid.Mo / 15.0) * (this.fluid.O2 / 1.0);
    // Decay above 80°C — supergene-only ceiling
    if (this.temperature > 80) {
      sigma *= Math.exp(-0.025 * (this.temperature - 80));
    }
    // Graduated pH penalties (matches research: 6-9 window, soft edges)
    if (this.fluid.pH < 3.5) {
      sigma -= (3.5 - this.fluid.pH) * 0.4;
    } else if (this.fluid.pH > 9.0) {
      sigma -= (this.fluid.pH - 9.0) * 0.3;
    }
    return Math.max(sigma, 0);
  }

  // Molybdenite (MoS₂) — primary molybdenum sulfide, porphyry deposits
  // High-temperature primary mineral (300-500°C). Mo arrives in separate later pulse from Cu.
  // Per Seo et al. 2012 (Bingham Canyon): MoS₂ is the primary Mo-bearing phase.
  supersaturation_molybdenite() {
    // v13: reconciled to Python (which agent-api already matched). Pre-v13
    // had no O2 gate, allowing the sulfide to form under oxidizing conditions.
    if (this.fluid.Mo < 3 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.2) return 0;  // sulfide, needs reducing
    let sigma = (this.fluid.Mo / 15.0) * (this.fluid.S / 60.0) * (1.5 - this.fluid.O2);
    // v17: use effectiveTemperature throughout for Mo-flux widening (matches Python).
    const eT = this.effectiveTemperature;
    if (eT < 150) {
      sigma *= Math.exp(-0.01 * (150 - eT));
    } else if (eT > 300 && eT < 500) {
      sigma *= 1.3;  // porphyry Mo sweet spot
    }
    return Math.max(sigma, 0);
  }

  // Ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) — the no-lead branch of Mo oxidation.
  // Canary-yellow acicular tufts; fast-growing, powdery, under-displayed
  // but geologically more common than wulfenite. Forms from oxidized
  // molybdenite when Fe is around and Pb is either absent or already
  // committed elsewhere. Coexists with wulfenite in Pb-bearing systems
  // (both draw on MoO₄²⁻ pool).
  supersaturation_ferrimolybdite() {
    if (this.fluid.Mo < 2 || this.fluid.Fe < 3 || this.fluid.O2 < 0.5) return 0;
    // Lower Mo threshold + /10 scaling reflects faster, less-picky growth.
    let sigma = (this.fluid.Mo / 10.0) * (this.fluid.Fe / 20.0) * (this.fluid.O2 / 1.0);
    // Strongly low-temperature — supergene/weathering zone only.
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.02 * (this.temperature - 50));
    }
    // pH window — mild acidic to neutral.
    if (this.fluid.pH > 7) {
      sigma *= Math.max(0.2, 1.0 - 0.2 * (this.fluid.pH - 7));
    } else if (this.fluid.pH < 3) {
      sigma *= Math.max(0.3, 1.0 - 0.25 * (3 - this.fluid.pH));
    }
    return Math.max(sigma, 0);
  }

  // Barite (BaSO₄) — the Ba sequestration mineral. Densest non-metallic
  // mineral collectors will encounter (4.5 g/cm³). Galena's primary gangue
  // mineral in MVT districts; also abundant in hydrothermal vein systems.
  // No acid dissolution (the standard drilling-mud weighting agent for a
  // reason); thermal decomposition only above 1149°C. Eh ≥ 0.1 — needs
  // sulfate (SO₄²⁻), not sulfide (H₂S).
  supersaturation_barite() {
    if (this.fluid.Ba < 5 || this.fluid.S < 10 || this.fluid.O2 < 0.1) return 0;
    // Factor caps to prevent evaporite-level S from runaway sigma.
    const ba_f = Math.min(this.fluid.Ba / 30.0, 2.0);
    const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
    // O2 saturation at SO₄/H₂S Eh boundary (~O2=0.4), not at fully
    // oxidized. Allows barite + galena coexistence (MVT diagnostic).
    const o2_f = Math.min(this.fluid.O2 / 0.4, 1.5);
    let sigma = ba_f * s_f * o2_f;
    const T = this.temperature;
    if (T >= 50 && T <= 200) {
      sigma *= 1.2;
    } else if (T < 5) {
      sigma *= 0.3;
    } else if (T > 500) {
      sigma *= Math.max(0.2, 1.0 - 0.003 * (T - 500));
    }
    if (this.fluid.pH < 4) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (4 - this.fluid.pH));
    } else if (this.fluid.pH > 9) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
    }
    return Math.max(sigma, 0);
  }

  // Anhydrite (CaSO₄) — high-T or saline-low-T Ca sulfate sister of selenite.
  // Two stability regimes: T > 60°C (high-T branch) OR T < 60°C with salinity
  // > 100‰ (low-T saline branch — sabkha evaporite). Below 60°C in dilute
  // fluid, anhydrite is metastable and rehydrates to gypsum.
  supersaturation_anhydrite() {
    if (this.fluid.Ca < 50 || this.fluid.S < 20 || this.fluid.O2 < 0.3) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
    const o2_f = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = ca_f * s_f * o2_f;
    const T = this.temperature;
    const salinity = this.fluid.salinity;
    let T_factor;
    if (T > 60) {
      if (T < 200) {
        T_factor = 0.5 + 0.005 * (T - 60);
      } else if (T <= 700) {
        T_factor = 1.2;
      } else {
        T_factor = Math.max(0.3, 1.2 - 0.002 * (T - 700));
      }
    } else {
      if (salinity > 100) {
        T_factor = Math.min(1.0, 0.4 + salinity / 200.0);
      } else if (salinity > 50) {
        T_factor = 0.3;
      } else {
        return 0;  // dilute low-T → gypsum/selenite wins
      }
    }
    sigma *= T_factor;
    if (this.fluid.pH < 5) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (5 - this.fluid.pH));
    } else if (this.fluid.pH > 9) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
    }
    return Math.max(sigma, 0);
  }

  // Brochantite (Cu₄(SO₄)(OH)₆) — wet-supergene Cu sulfate; emerald-green
  // prismatic crystals. The higher-pH end (pH 4-7) of the brochantite ↔
  // antlerite fork. Statue of Liberty patina mineral.
  supersaturation_brochantite() {
    if (this.fluid.Cu < 10 || this.fluid.S < 15 || this.fluid.O2 < 0.5) return 0;
    if (this.fluid.pH < 3 || this.fluid.pH > 7.5) return 0;
    const cu_f = Math.min(this.fluid.Cu / 40.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 30.0, 2.5);
    const o2_f = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = cu_f * s_f * o2_f;
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.05 * (this.temperature - 50));
    }
    if (this.fluid.pH < 4) {
      sigma *= Math.max(0.3, 1.0 - 0.5 * (4 - this.fluid.pH));
    } else if (this.fluid.pH > 6) {
      sigma *= Math.max(0.3, 1.0 - 0.4 * (this.fluid.pH - 6));
    }
    return Math.max(sigma, 0);
  }

  // Antlerite (Cu₃(SO₄)(OH)₄) — dry-acid Cu sulfate; pH 1-3.5 stability.
  // The lower-pH end of the brochantite ↔ antlerite fork. Chuquicamata
  // type ore phase.
  supersaturation_antlerite() {
    if (this.fluid.Cu < 15 || this.fluid.S < 20 || this.fluid.O2 < 0.5) return 0;
    if (this.fluid.pH > 4 || this.fluid.pH < 0.5) return 0;
    const cu_f = Math.min(this.fluid.Cu / 40.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 30.0, 2.5);
    const o2_f = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = cu_f * s_f * o2_f;
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.05 * (this.temperature - 50));
    }
    if (this.fluid.pH > 3.5) {
      sigma *= Math.max(0.2, 1.0 - 0.5 * (this.fluid.pH - 3.5));
    } else if (this.fluid.pH < 1.5) {
      sigma *= Math.max(0.4, 1.0 - 0.3 * (1.5 - this.fluid.pH));
    }
    return Math.max(sigma, 0);
  }

  // Jarosite (KFe³⁺₃(SO₄)₂(OH)₆) — the diagnostic acid-mine-drainage mineral.
  // Yellow rhombs/crusts; supergene Fe-sulfate that takes over from goethite
  // when pH drops below 4. Confirmed on Mars (Klingelhöfer et al. 2004).
  // Stability: K, Fe, S, O2; pH 1-5 (above pH 5 dissolves to feed goethite).
  // Strongly low-T — supergene only.
  supersaturation_jarosite() {
    if (this.fluid.K < 5 || this.fluid.Fe < 10 || this.fluid.S < 20
        || this.fluid.O2 < 0.5) return 0;
    if (this.fluid.pH > 5) return 0;
    const k_f  = Math.min(this.fluid.K  / 15.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 30.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 50.0, 2.5);
    const o2_f = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = k_f * fe_f * s_f * o2_f;
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.04 * (this.temperature - 50));
    }
    if (this.fluid.pH > 4) {
      sigma *= Math.max(0.2, 1.0 - 0.6 * (this.fluid.pH - 4));
    } else if (this.fluid.pH < 1) {
      sigma *= 0.4;
    }
    return Math.max(sigma, 0);
  }

  // Alunite (KAl₃(SO₄)₂(OH)₆) — the Al sister of jarosite (alunite group).
  // The index mineral of advanced argillic alteration in porphyry-Cu lithocaps
  // and high-sulfidation epithermal Au deposits. Marysvale UT type locality.
  // Wider T window than jarosite (50-300 °C — hydrothermal acid-sulfate spans
  // the porphyry-epithermal range, not just supergene).
  supersaturation_alunite() {
    if (this.fluid.K < 5 || this.fluid.Al < 10 || this.fluid.S < 20
        || this.fluid.O2 < 0.5) return 0;
    if (this.fluid.pH > 5) return 0;
    const k_f  = Math.min(this.fluid.K  / 15.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 25.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 50.0, 2.5);
    const o2_f = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = k_f * al_f * s_f * o2_f;
    const T = this.temperature;
    if (T >= 50 && T <= 200) {
      sigma *= 1.2;
    } else if (T < 25) {
      sigma *= 0.5;
    } else if (T > 350) {
      sigma *= Math.max(0.2, 1.0 - 0.005 * (T - 350));
    }
    if (this.fluid.pH > 4) {
      sigma *= Math.max(0.2, 1.0 - 0.6 * (this.fluid.pH - 4));
    } else if (this.fluid.pH < 1) {
      sigma *= 0.4;
    }
    return Math.max(sigma, 0);
  }

  // Celestine (SrSO₄) — the Sr sister of barite (isostructural). Pale
  // celestial blue from F-center defects. Madagascar geodes, Sicilian
  // sulfur-vug fibrous habit, Lake Erie. No acid dissolution; thermal
  // decomposition >1100°C.
  supersaturation_celestine() {
    if (this.fluid.Sr < 3 || this.fluid.S < 10 || this.fluid.O2 < 0.1) return 0;
    const sr_f = Math.min(this.fluid.Sr / 15.0, 2.0);
    const s_f  = Math.min(this.fluid.S  / 40.0, 2.5);
    // O2 saturation at SO₄/H₂S boundary — same MVT-coexistence rationale.
    const o2_f = Math.min(this.fluid.O2 / 0.4, 1.5);
    let sigma = sr_f * s_f * o2_f;
    const T = this.temperature;
    if (T < 100) {
      sigma *= 1.2;
    } else if (T > 200) {
      sigma *= Math.max(0.3, 1.0 - 0.005 * (T - 200));
    }
    if (this.fluid.pH < 5) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (5 - this.fluid.pH));
    } else if (this.fluid.pH > 9) {
      sigma *= Math.max(0.4, 1.0 - 0.2 * (this.fluid.pH - 9));
    }
    return Math.max(sigma, 0);
  }

  // Acanthite (Ag₂S, monoclinic) — the low-T silver sulfide. First Ag mineral
  // in the sim. Hard upper-T gate at 173°C (above that, argentite forms).
  // Reducing only. Source: research/research-acanthite.md, Petruk et al. 1974.
  supersaturation_acanthite() {
    if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
    if (this.temperature > 173) return 0;
    if (this.fluid.O2 > 0.5) return 0;
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
    return Math.max(sigma, 0);
  }

  // Argentite (Ag₂S, cubic) — the high-T silver sulfide. Hard lower-T gate
  // at 173°C (acanthite handles below). Paramorph on cooling — handled in
  // applyParamorphTransitions hook in run_step. Source: research-argentite.md.
  supersaturation_argentite() {
    if (this.fluid.Ag < 0.5 || this.fluid.S < 5) return 0;
    if (this.temperature <= 173) return 0;
    if (this.fluid.O2 > 0.5) return 0;
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
    return Math.max(sigma, 0);
  }

  // Chalcanthite (CuSO4·5H2O) — water-soluble Cu sulfate, the terminal
  // Cu-sulfate oxidation phase. Source: research-chalcanthite.md.
  supersaturation_chalcanthite() {
    if (this.fluid.Cu < 30 || this.fluid.S < 50) return 0;
    if (this.fluid.pH > 4) return 0;
    if (this.fluid.O2 < 0.8) return 0;
    if (this.fluid.salinity < 5.0) return 0;
    const cu_f = Math.min(this.fluid.Cu / 80.0, 3.0);
    const s_f  = Math.min(this.fluid.S  / 100.0, 3.0);
    const ox_f = Math.min(this.fluid.O2 / 1.5, 2.0);
    const sal_f = Math.min(this.fluid.salinity / 30.0, 3.0);
    const ph_f = Math.max(0.5, 1.0 + (3.0 - this.fluid.pH) * 0.2);
    let sigma = cu_f * s_f * ox_f * sal_f * ph_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 40) T_factor = 1.3;
    else if (T < 10) T_factor = 0.4;
    else if (T < 20) T_factor = 0.4 + 0.09 * (T - 10);
    else if (T <= 50) T_factor = Math.max(0.4, 1.3 - 0.06 * (T - 40));
    else T_factor = 0.2;
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Descloizite (PbZnVO4(OH)) — Zn end of complete solid solution series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. See
  // research/research-broth-ratio-descloizite-mottramite.md.
  supersaturation_descloizite() {
    if (this.fluid.Pb < 40 || this.fluid.Zn < 50 || this.fluid.V < 10) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    if (this.fluid.Cu < 0.5) return 0;
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const zn_fraction = this.fluid.Zn / cu_zn_total;
    if (zn_fraction < 0.5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
    const zn_f = Math.min(this.fluid.Zn / 80.0, 2.5);
    const v_f  = Math.min(this.fluid.V  / 20.0, 2.5);
    const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
    let sigma = pb_f * zn_f * v_f * ox_f;
    if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
    else if (zn_fraction > 0.95) sigma *= 0.5;
    const T = this.temperature;
    let T_factor;
    if (T >= 30 && T <= 50) T_factor = 1.2;
    else if (T < 20) T_factor = 0.4;
    else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
    else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
    else T_factor = 0.3;
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Mottramite (PbCu(VO4)(OH)) — Cu end of complete solid solution series.
  // Round 9c retrofit: same broth-ratio idiom as descloizite.
  supersaturation_mottramite() {
    if (this.fluid.Pb < 40 || this.fluid.Cu < 50 || this.fluid.V < 10) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    if (this.fluid.Zn < 0.5) return 0;
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const cu_fraction = this.fluid.Cu / cu_zn_total;
    if (cu_fraction < 0.5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
    const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
    const v_f  = Math.min(this.fluid.V  / 20.0, 2.5);
    const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
    let sigma = pb_f * cu_f * v_f * ox_f;
    if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
    else if (cu_fraction > 0.95) sigma *= 0.5;
    const T = this.temperature;
    let T_factor;
    if (T >= 30 && T <= 50) T_factor = 1.2;
    else if (T < 20) T_factor = 0.4;
    else if (T < 30) T_factor = 0.4 + 0.08 * (T - 20);
    else if (T <= 80) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 50));
    else T_factor = 0.3;
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Raspite (PbWO4, monoclinic) — RARE polymorph.
  supersaturation_raspite() {
    if (this.fluid.Pb < 40 || this.fluid.W < 5) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.0);
    const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
    const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
    let sigma = pb_f * w_f * ox_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 40) T_factor = 1.2;
    else if (T < 10) T_factor = 0.4;
    else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
    else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
    else T_factor = 0.3;
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Stolzite (PbWO4, tetragonal) — common polymorph.
  supersaturation_stolzite() {
    if (this.fluid.Pb < 40 || this.fluid.W < 5) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
    const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
    const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
    let sigma = pb_f * w_f * ox_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 80) T_factor = 1.2;
    else if (T < 10) T_factor = 0.4;
    else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
    else if (T <= 100) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 80));
    else T_factor = 0.3;
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Olivenite (Cu2AsO4(OH)) — Cu end of olivenite-adamite series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. See
  // research/research-broth-ratio-adamite-olivenite.md and
  // research/research-olivenite.md.
  supersaturation_olivenite() {
    if (this.fluid.Cu < 50 || this.fluid.As < 10) return 0;
    if (this.fluid.O2 < 0.5) return 0;
    // Recessive-side trace floor — real olivenite always has at least
    // trace Zn (zincolivenite-leaning); makes the ratio meaningful.
    if (this.fluid.Zn < 0.5) return 0;
    // Broth-ratio gate — olivenite is Cu-dominant.
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const cu_fraction = this.fluid.Cu / cu_zn_total;
    if (cu_fraction < 0.5) return 0;
    const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
    const as_f = Math.min(this.fluid.As / 20.0, 2.5);
    const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
    let sigma = cu_f * as_f * ox_f;
    // Sweet-spot bonus — Cu-dominant with Zn trace is zincolivenite-
    // leaning, the most-collected form. Pure-Cu damped (malachite/
    // brochantite take that territory).
    if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
    else if (cu_fraction > 0.95) sigma *= 0.5;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 40) T_factor = 1.2;
    else if (T < 10) T_factor = 0.4;
    else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
    else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
    else T_factor = 0.3;
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Nickeline (NiAs) — high-T pale-copper-red Ni arsenide.
  supersaturation_nickeline() {
    if (this.fluid.Ni < 40 || this.fluid.As < 40) return 0;
    if (this.fluid.O2 > 0.6) return 0;
    const ni_f = Math.min(this.fluid.Ni / 60.0, 2.5);
    const as_f = Math.min(this.fluid.As / 80.0, 2.5);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.5);
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
    return Math.max(sigma, 0);
  }

  // Millerite (NiS) — capillary brass-yellow nickel sulfide. Mutual-exclusion
  // gate: nickeline takes priority when As>30 + T>200.
  supersaturation_millerite() {
    if (this.fluid.Ni < 50 || this.fluid.S < 30) return 0;
    if (this.fluid.O2 > 0.6) return 0;
    if (this.fluid.As > 30.0 && this.temperature > 200) return 0;
    const ni_f = Math.min(this.fluid.Ni / 80.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 60.0, 2.5);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.5);
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
    return Math.max(sigma, 0);
  }

  // Cobaltite (CoAsS) — three-element-gate sulfarsenide.
  supersaturation_cobaltite() {
    if (this.fluid.Co < 50 || this.fluid.As < 100 || this.fluid.S < 50) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    const co_f = Math.min(this.fluid.Co / 80.0, 2.5);
    const as_f = Math.min(this.fluid.As / 120.0, 2.5);
    const s_f  = Math.min(this.fluid.S  / 80.0, 2.5);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.5);
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
    return Math.max(sigma, 0);
  }

  // Native tellurium (Te⁰) — metal-telluride-overflow engine.
  // Hard gates: Au>1, Ag>5, Hg>0.5, O2>0.5. Source: research-native-tellurium.md.
  supersaturation_native_tellurium() {
    if (this.fluid.Te < 0.5) return 0;
    if (this.fluid.Au > 1.0) return 0;
    if (this.fluid.Ag > 5.0) return 0;
    // Hg not currently tracked; coloradoite gate deferred.
    if (this.fluid.O2 > 0.5) return 0;
    const te_f = Math.min(this.fluid.Te / 2.0, 3.5);
    const pb_suppr = Math.max(0.5, 1.0 - this.fluid.Pb / 200.0);
    const bi_suppr = Math.max(0.5, 1.0 - this.fluid.Bi / 60.0);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.8);
    let sigma = te_f * pb_suppr * bi_suppr * red_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 150 && T <= 300) {
      T_factor = 1.2;
    } else if (T < 100) {
      T_factor = 0.3;
    } else if (T < 150) {
      T_factor = 0.3 + 0.018 * (T - 100);
    } else if (T <= 400) {
      T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 300));
    } else {
      T_factor = 0.2;
    }
    sigma *= T_factor;
    if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Native sulfur (S₈) — synproportionation Eh-window engine.
  // Hard gates: 0.1<O2<0.7, pH<5, Fe+Cu+Pb+Zn<100. Source: research-native-sulfur.md.
  supersaturation_native_sulfur() {
    if (this.fluid.S < 100) return 0;
    if (this.fluid.O2 < 0.1 || this.fluid.O2 > 0.7) return 0;
    if (this.fluid.pH > 5) return 0;
    const metal_sum = this.fluid.Fe + this.fluid.Cu + this.fluid.Pb + this.fluid.Zn;
    if (metal_sum > 100) return 0;
    const s_f = Math.min(this.fluid.S / 200.0, 4.0);
    const eh_dist = Math.abs(this.fluid.O2 - 0.4);
    const eh_f = Math.max(0.4, 1.0 - 2.0 * eh_dist);
    const ph_f = Math.max(0.4, 1.0 - 0.15 * this.fluid.pH);
    let sigma = s_f * eh_f * ph_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 95) {
      T_factor = 1.2;
    } else if (T < 20) {
      T_factor = 0.6;
    } else if (T <= 119) {
      T_factor = Math.max(0.5, 1.2 - 0.025 * (T - 95));
    } else if (T < 200) {
      T_factor = Math.max(0.3, 0.5 - 0.005 * (T - 119));
    } else {
      T_factor = 0.0;
    }
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Native arsenic (As⁰) — the residual-overflow native element.
  // Hard gates: S>10 (overflows to realgar/arsenopyrite), Fe>50 (arsenopyrite),
  // O2>0.5 (arsenate). Source: research-native-arsenic.md.
  supersaturation_native_arsenic() {
    if (this.fluid.As < 5) return 0;
    if (this.fluid.S > 10.0) return 0;
    if (this.fluid.Fe > 50.0) return 0;
    if (this.fluid.O2 > 0.5) return 0;
    const as_f = Math.min(this.fluid.As / 30.0, 3.0);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.8);
    const s_suppr = Math.max(0.4, 1.0 - this.fluid.S / 12.0);
    let sigma = as_f * red_f * s_suppr;
    const T = this.temperature;
    let T_factor;
    if (T >= 150 && T <= 300) {
      T_factor = 1.2;
    } else if (T < 100) {
      T_factor = 0.3;
    } else if (T < 150) {
      T_factor = 0.3 + 0.018 * (T - 100);
    } else if (T <= 350) {
      T_factor = Math.max(0.5, 1.2 - 0.014 * (T - 300));
    } else {
      T_factor = 0.3;
    }
    sigma *= T_factor;
    if (this.fluid.pH < 3 || this.fluid.pH > 8) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Native silver (Ag⁰) — the Kongsberg wire-silver mineral.
  // First depletion-gate engine in the sim: fires only when S < 2 AND O2 < 0.3.
  // Source: research/research-native-silver.md, Boyle 1968.
  supersaturation_native_silver() {
    if (this.fluid.Ag < 1.0) return 0;
    if (this.fluid.S > 2.0) return 0;
    if (this.fluid.O2 > 0.3) return 0;
    const ag_f = Math.min(this.fluid.Ag / 2.0, 3.0);
    const red_f = Math.max(0.3, 1.0 - this.fluid.O2 * 2.5);
    const s_f = Math.max(0.2, 1.0 - this.fluid.S / 4.0);
    let sigma = ag_f * red_f * s_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 100 && T <= 200) {
      T_factor = 1.2;
    } else if (T < 50) {
      T_factor = 0.4;
    } else if (T < 100) {
      T_factor = 0.4 + 0.016 * (T - 50);
    } else if (T <= 300) {
      T_factor = Math.max(0.4, 1.2 - 0.008 * (T - 200));
    } else {
      T_factor = 0.3;
    }
    sigma *= T_factor;
    if (this.fluid.pH < 4 || this.fluid.pH > 9) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  // Scorodite (FeAsO₄·2H₂O) — the arsenic sequestration mineral.
  // Pseudo-octahedral pale blue-green dipyramids; the most common
  // supergene arsenate. Forms from oxidized arsenopyrite (Fe³⁺ +
  // AsO₄³⁻ both required) in acidic oxidizing conditions. The
  // acidic-end of the arsenate stability field — at pH > 5 it
  // dissolves, releasing AsO₄³⁻ for the higher-pH arsenate suite
  // (erythrite, mimetite, adamite, etc.). World-class deep blue-green
  // crystals at Tsumeb (Gröbner & Becker 1973).
  supersaturation_scorodite() {
    if (this.fluid.Fe < 5 || this.fluid.As < 3 || this.fluid.O2 < 0.3) return 0;
    if (this.fluid.pH > 6) return 0;  // dissolves above pH 5; nucleation gate at 6 for hysteresis
    let sigma = (this.fluid.Fe / 30.0) * (this.fluid.As / 15.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 80) {
      sigma *= Math.exp(-0.025 * (this.temperature - 80));
    }
    if (this.fluid.pH > 5) {
      sigma *= Math.max(0.3, 1.0 - 0.5 * (this.fluid.pH - 5));
    } else if (this.fluid.pH < 2) {
      sigma *= Math.max(0.4, 1.0 - 0.3 * (2 - this.fluid.pH));
    }
    return Math.max(sigma, 0);
  }

  // Arsenopyrite (FeAsS) — the arsenic gateway, the #1 Au-trapping mineral.
  // Mesothermal primary sulfide co-precipitates with pyrite in orogenic
  // gold systems and arrives in the later-stage porphyry evolution.
  // Structurally traps Au up to ~1500 ppm as "invisible gold" — released
  // back to fluid when the crystal later oxidizes (supergene Au
  // enrichment). Oxidation pathway: arsenopyrite + O₂ + H₂O →
  // Fe³⁺ + AsO₄³⁻ + H₂SO₄ → feeds scorodite + acidifies further.
  supersaturation_arsenopyrite() {
    if (this.fluid.Fe < 5 || this.fluid.As < 3 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 0.8) return 0;  // sulfide — needs reducing
    let sigma = (this.fluid.Fe / 30.0) * (this.fluid.As / 15.0)
              * (this.fluid.S / 50.0) * (1.5 - this.fluid.O2);
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
    return Math.max(sigma, 0);
  }

  // Feldspar (KAlSi3O8 / NaAlSi3O8) — the most abundant mineral on Earth
  // Temperature determines polymorph: sanidine (>500°C) → orthoclase (300-500°C) → microcline (<300°C)
  // Needs K or Na + Al + Si in fluid
  supersaturation_feldspar() {
    // K-feldspar (sanidine/orthoclase/microcline polymorphs).
    // v17 reconciliation (May 2026): pre-v17 JS folded Na into a
    // K-or-Na fork using max(K,Na), but albite has its own
    // supersaturation_albite engine — Na fluids should route there,
    // not double-fire here. Python's K-only design has been canonical
    // since the data model split feldspar/albite as separate species.
    // JS now matches Python's K-only structure, with a hard 800°C
    // upper cap (sanidine→melt boundary) added.
    if (this.fluid.K < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
    // Hard upper cap — feldspar melts above 800°C.
    if (this.temperature > 800) return 0;
    let sigma = (this.fluid.K / 40.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
    // Feldspars need HIGH temperature — they're igneous/metamorphic
    if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
    // Acid destabilization — kaolinization regime, mirrors grow_feldspar
    // dissolution at pH < 4. KAlSi₃O₈ + H⁺ → kaolinite + K⁺ + SiO₂.
    if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 2.0;
    return Math.max(sigma, 0);
  }

  // Selenite (gypsum, CaSO4·2H2O) — forms in evaporite/oxidation environments
  // Low temperature, needs Ca + S (as sulfate via oxidation) + O2
  // The crystal that grows when everything else is ending
  supersaturation_mirabilite() {
    // v29 cold-side Na-sulfate evaporite. Mirror of vugg.py.
    if (this.fluid.Na < 50 || this.fluid.S < 50 || this.fluid.O2 < 0.2) return 0;
    if (this.temperature > 32) return 0;
    const c = this.fluid.concentration ?? 1.0;
    if (c < 1.5) return 0;
    let sigma = (this.fluid.Na / 300.0) * (this.fluid.S / 200.0) * c * c;
    if (this.temperature < 10) sigma *= 1.3;
    if (this.fluid.pH < 5.0) sigma *= 0.5;
    return Math.max(sigma, 0);
  }

  supersaturation_thenardite() {
    // v29 warm-side Na-sulfate evaporite. Mirror of vugg.py.
    if (this.fluid.Na < 50 || this.fluid.S < 50 || this.fluid.O2 < 0.2) return 0;
    if (this.temperature < 25) return 0;
    const c = this.fluid.concentration ?? 1.0;
    if (c < 1.5) return 0;
    let sigma = (this.fluid.Na / 300.0) * (this.fluid.S / 200.0) * c * c;
    if (this.temperature > 50) sigma *= 1.2;
    if (this.fluid.pH < 5.0) sigma *= 0.5;
    return Math.max(sigma, 0);
  }

  supersaturation_tincalconite() {
    // v28 paramorph product of borax — never nucleates from solution.
    return 0;
  }

  supersaturation_borax() {
    // v28 alkaline-brine borate evaporite. Mirror of
    // supersaturation_borax in vugg.py.
    if (this.fluid.Na < 50 || this.fluid.B < 5) return 0;
    if (this.temperature > 60) return 0;
    if (this.fluid.pH < 7.0) return 0;
    const c = this.fluid.concentration ?? 1.0;
    // v28: hard concentration gate — borax is strictly an active-
    // evaporation mineral. Submerged rings stay at c=1.0 and never
    // fire borax; only meniscus + vadose rings cross this threshold.
    if (c < 1.5) return 0;
    let sigma = (this.fluid.Na / 500.0) * (this.fluid.B / 100.0) * c * c;
    if (this.fluid.pH >= 8.5 && this.fluid.pH <= 10.5) sigma *= 1.4;
    else if (this.fluid.pH > 10.5) sigma *= 1.1;
    if (this.fluid.Ca > 50) {
      const caPenalty = Math.min(1.0, this.fluid.Ca / 150.0);
      sigma *= (1.0 - 0.7 * caPenalty);
    }
    return Math.max(sigma, 0);
  }

  supersaturation_halite() {
    // v27 chloride evaporite. Quadratic in concentration so halite
    // stays dormant at scenario baseline (concentration=1) and fires
    // sharply when a vadose-transition concentration spike kicks in.
    // Mirror of supersaturation_halite in vugg.py.
    if (this.fluid.Na < 5 || this.fluid.Cl < 50) return 0;
    const c = this.fluid.concentration ?? 1.0;
    let sigma = (this.fluid.Na / 100.0) * (this.fluid.Cl / 500.0) * c * c;
    if (this.temperature > 100) sigma *= 0.7;
    if (this.fluid.pH < 4.0) sigma *= 0.5;
    return Math.max(sigma, 0);
  }

  supersaturation_selenite() {
    // v17 reconciliation (May 2026): Phase boundary is at ~55-60°C
    // (Naica 54.5°C, Pulpí 20°C, Van Driessche et al. 2016). Pre-v17
    // JS used a hard 80°C cutoff which was too lenient — gypsum
    // converts to anhydrite well before 80°C. Now matches Python's
    // softer decay starting at 60°C, while keeping JS's T<40 bonus
    // (real per Pulpí Geode formation).
    if (this.fluid.Ca < 20 || this.fluid.S < 15 || this.fluid.O2 < 0.2) return 0;
    let sigma = (this.fluid.Ca / 60.0) * (this.fluid.S / 50.0) * (this.fluid.O2 / 0.5);
    if (this.temperature > 60) {
      sigma *= Math.exp(-0.06 * (this.temperature - 60));
    }
    // Cool-T sweet spot — Pulpí 20°C
    if (this.temperature < 40) sigma *= 1.5;
    // Neutral to slightly alkaline pH preferred
    if (this.fluid.pH < 5.0) {
      sigma -= (5.0 - this.fluid.pH) * 0.2;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_apophyllite() {
    if (this.fluid.K < 5 || this.fluid.Ca < 30 || this.fluid.SiO2 < 800 || this.fluid.F < 2) return 0;
    if (this.temperature < 50 || this.temperature > 250) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 10.0) return 0;
    if (this.pressure > 0.5) return 0;
    const product = (this.fluid.K / 30.0) * (this.fluid.Ca / 100.0) * (this.fluid.SiO2 / 1500.0) * (this.fluid.F / 8.0);
    let T_factor;
    if (this.temperature >= 100 && this.temperature <= 200) T_factor = 1.4;
    else if ((this.temperature >= 80 && this.temperature < 100) || (this.temperature > 200 && this.temperature <= 230)) T_factor = 1.0;
    else T_factor = 0.6;
    const pH_factor = (this.fluid.pH >= 7.5 && this.fluid.pH <= 9.0) ? 1.2 : 0.8;
    return product * T_factor * pH_factor;
  }

  supersaturation_tetrahedrite() {
    if (this.fluid.Cu < 10 || this.fluid.Sb < 3 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
    if (this.temperature < 100 || this.temperature > 400) return 0;
    const product = (this.fluid.Cu / 40.0) * (this.fluid.Sb / 15.0) * (this.fluid.S / 40.0);
    let T_factor;
    if (this.temperature >= 200 && this.temperature <= 300) T_factor = 1.3;
    else if ((this.temperature >= 150 && this.temperature < 200) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
    else T_factor = 0.6;
    return product * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_tennantite() {
    if (this.fluid.Cu < 10 || this.fluid.As < 3 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    if (this.fluid.pH < 3.0 || this.fluid.pH > 7.0) return 0;
    if (this.temperature < 100 || this.temperature > 400) return 0;
    const product = (this.fluid.Cu / 40.0) * (this.fluid.As / 15.0) * (this.fluid.S / 40.0);
    let T_factor;
    if (this.temperature >= 150 && this.temperature <= 300) T_factor = 1.3;
    else if ((this.temperature >= 100 && this.temperature < 150) || (this.temperature > 300 && this.temperature <= 350)) T_factor = 1.0;
    else T_factor = 0.6;
    return product * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_erythrite() {
    // Co3(AsO4)2·8H2O — cobalt bloom. Shared vivianite-group gating with annabergite.
    if (this.fluid.Co < 2 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    const product = (this.fluid.Co / 20.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
    const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
    return product * T_factor;
  }

  supersaturation_annabergite() {
    // Ni3(AsO4)2·8H2O — nickel bloom. Ni equivalent of erythrite.
    if (this.fluid.Ni < 2 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    const product = (this.fluid.Ni / 20.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
    const T_factor = (this.temperature >= 10 && this.temperature <= 30) ? 1.2 : 0.7;
    return product * T_factor;
  }

  // Adamite (Zn2(AsO4)(OH)) — Zn end of olivenite-adamite series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. The famous green
  // UV fluorescence requires trace Cu²⁺ activator — pure-Zn adamite is
  // rare in nature. See research/research-broth-ratio-adamite-olivenite.md.
  supersaturation_adamite() {
    if (this.fluid.Zn < 10 || this.fluid.As < 5 || this.fluid.O2 < 0.3) return 0;
    // Trace Cu floor — Cu²⁺ activator gives the diagnostic green
    // fluorescence; recessive-side floor makes the Cu:Zn ratio meaningful.
    if (this.fluid.Cu < 0.5) return 0;
    // Broth-ratio gate — adamite is Zn-dominant.
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const zn_fraction = this.fluid.Zn / cu_zn_total;
    if (zn_fraction < 0.5) return 0;
    let sigma = (this.fluid.Zn / 80.0) * (this.fluid.As / 30.0) * (this.fluid.O2 / 1.0);
    // Sweet-spot bonus — Zn-dominant with Cu trace (the fluorescent
    // variety) is the most aesthetic adamite. Pure-Zn damped because
    // hemimorphite/smithsonite take that territory.
    if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
    else if (zn_fraction > 0.95) sigma *= 0.5;
    if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
    if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.4;
    else if (this.fluid.pH > 8.0) sigma *= 0.5;
    return Math.max(sigma, 0);
  }

  supersaturation_mimetite() {
    if (this.fluid.Pb < 5 || this.fluid.As < 3 || this.fluid.Cl < 2 || this.fluid.O2 < 0.3) return 0;
    let sigma = (this.fluid.Pb / 60.0) * (this.fluid.As / 25.0) * (this.fluid.Cl / 30.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
    if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.5;
    return Math.max(sigma, 0);
  }

  // Goethite (FeO(OH)) — the ghost mineral, now real.
  // Low-T oxidation product of Fe-sulfides and Fe²⁺ fluids.
  // Botryoidal, mammillary, fibrous. Often pseudomorphs pyrite/marcasite.
  // Dehydrates to hematite above 300°C.
  supersaturation_goethite() {
    if (this.fluid.Fe < 15 || this.fluid.O2 < 0.4) return 0;
    let sigma = (this.fluid.Fe / 60.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.5;
    return Math.max(sigma, 0);
  }

  // Albite (NaAlSi₃O₈) — plagioclase end-member, pegmatite staple.
  supersaturation_albite() {
    if (this.fluid.Na < 10 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
    let sigma = (this.fluid.Na / 35.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
    if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
    // Acid destabilization — albite kaolinizes at pH < 3 (more
    // resistant than K-feldspar). Mirrors grow_albite dissolution gate.
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 2.0;
    return Math.max(sigma, 0);
  }

  // Spodumene (LiAlSi₂O₆) — Li-gated monoclinic pyroxene. Kunzite (Mn²⁺
  // pink), hiddenite (Cr³⁺ green), triphane (pure/yellow). T window
  // 400–700°C with optimum 450–600°C (hotter than beryl's window).
  supersaturation_spodumene() {
    if (this.fluid.Li < 8 || this.fluid.Al < 5 || this.fluid.SiO2 < 40) return 0;
    const li_f = Math.min(this.fluid.Li / 20.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 10.0, 1.5);
    const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
    let sigma = li_f * al_f * si_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 450 && T <= 600) T_factor = 1.0;
    else if (T >= 400 && T < 450) T_factor = 0.5 + 0.01 * (T - 400);
    else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
    else if (T > 700) T_factor = 0.2;
    else T_factor = Math.max(0.1, 0.5 - 0.008 * (400 - T));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Magnetite (Fe₃O₄) — mixed-valence Fe²⁺Fe³⁺ at the HM redox buffer.
  supersaturation_magnetite() {
    if (this.fluid.Fe < 25 || this.fluid.O2 < 0.1 || this.fluid.O2 > 1.0) return 0;
    const fe_f = Math.min(this.fluid.Fe / 60.0, 2.0);
    const o_f = Math.max(0.4, 1.0 - Math.abs(this.fluid.O2 - 0.4) * 1.5);
    let sigma = fe_f * o_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 300 && T <= 600) T_factor = 1.0;
    else if (T >= 100 && T < 300) T_factor = 0.5 + 0.0025 * (T - 100);
    else if (T > 600 && T <= 800) T_factor = Math.max(0.4, 1.0 - 0.003 * (T - 600));
    else T_factor = 0.2;
    sigma *= T_factor;
    if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Lepidocrocite (γ-FeOOH) — ruby-red dimorph of goethite, rapid oxidation.
  supersaturation_lepidocrocite() {
    if (this.fluid.Fe < 15 || this.fluid.O2 < 0.8) return 0;
    const fe_f = Math.min(this.fluid.Fe / 50.0, 2.0);
    const o_f = Math.min(this.fluid.O2 / 1.5, 1.5);
    let sigma = fe_f * o_f;
    if (this.temperature > 50) sigma *= Math.exp(-0.02 * (this.temperature - 50));
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.4;
    if (this.fluid.pH > 7.5) sigma *= Math.max(0.5, 1.0 - (this.fluid.pH - 7.5) * 0.3);
    return Math.max(sigma, 0);
  }

  // Stibnite (Sb₂S₃) — sword-blade antimony sulfide.
  supersaturation_stibnite() {
    if (this.fluid.Sb < 10 || this.fluid.S < 15 || this.fluid.O2 > 1.0) return 0;
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
    sigma *= Math.max(0.5, 1.3 - this.fluid.O2);
    if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Bismuthinite (Bi₂S₃) — same structure as stibnite, Bi cousin.
  supersaturation_bismuthinite() {
    if (this.fluid.Bi < 5 || this.fluid.S < 15 || this.fluid.O2 > 1.0) return 0;
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
    sigma *= Math.max(0.5, 1.3 - this.fluid.O2);
    if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Native bismuth (Bi) — elemental; forms when S runs out.
  supersaturation_native_bismuth() {
    if (this.fluid.Bi < 15 || this.fluid.S > 12 || this.fluid.O2 > 0.6) return 0;
    const bi_f = Math.min(this.fluid.Bi / 25.0, 2.0);
    const s_mask = Math.max(0.4, 1.0 - this.fluid.S / 20.0);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 1.5);
    let sigma = bi_f * s_mask * red_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 100 && T <= 250) T_factor = 1.0;
    else if (T < 100) T_factor = 0.6;
    else if (T <= 270) T_factor = Math.max(0.3, 1.0 - 0.05 * (T - 250));
    else T_factor = 0.1;
    sigma *= T_factor;
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Clinobisvanite (BiVO₄) — end of the Bi oxidation sequence.
  supersaturation_clinobisvanite() {
    if (this.fluid.Bi < 2 || this.fluid.V < 2 || this.fluid.O2 < 1.0) return 0;
    const bi_f = Math.min(this.fluid.Bi / 5.0, 2.0);
    const v_f  = Math.min(this.fluid.V / 5.0, 2.0);
    const o_f  = Math.min(this.fluid.O2 / 1.5, 1.3);
    let sigma = bi_f * v_f * o_f;
    if (this.temperature > 40) sigma *= Math.exp(-0.04 * (this.temperature - 40));
    if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Cuprite (Cu₂O) — the Eh-boundary oxide.
  supersaturation_cuprite() {
    if (this.fluid.Cu < 20 || this.fluid.O2 < 0.3 || this.fluid.O2 > 1.2) return 0;
    const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
    const o_f = Math.max(0.3, 1.0 - Math.abs(this.fluid.O2 - 0.7) * 1.4);
    let sigma = cu_f * o_f;
    if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
    if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Azurite (Cu₃(CO₃)₂(OH)₂) — deep-blue Cu carbonate, high pCO₂.
  // Cu carbonate competition is pCO₂-based, not Cu:Zn-style ratio (Vink
  // 1986, Mineralogical Magazine 50:43-47). Azurite's higher CO3 floor
  // (≥120 vs malachite ≥20) encodes Vink's log(pCO2) ≈ -3.5 univariant
  // boundary at 25°C. Paramorph drop to malachite when CO3 falls is in
  // grow_azurite. See research/research-broth-ratio-malachite-azurite.md.
  supersaturation_azurite() {
    if (this.fluid.Cu < 20 || this.fluid.CO3 < 120 || this.fluid.O2 < 1.0) return 0;
    const cu_f = Math.min(this.fluid.Cu / 40.0, 2.0);
    const co_f = Math.min(this.fluid.CO3 / 150.0, 1.8);
    const o_f  = Math.min(this.fluid.O2 / 1.5, 1.3);
    let sigma = cu_f * co_f * o_f;
    if (this.temperature > 50) sigma *= Math.exp(-0.06 * (this.temperature - 50));
    if (this.fluid.pH < 5.0) sigma -= (5.0 - this.fluid.pH) * 0.4;
    return Math.max(sigma, 0);
  }

  // Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) — hydrous copper silicate, the cyan
  // enamel of Cu oxidation zones. Strictly low-T, meteoric. Needs
  // Cu²⁺ + SiO₂ simultaneously in a near-neutral pH window (5.5–7.5).
  // Chrysocolla loses to the carbonates when CO₃ > SiO₂ — it's the
  // late-stage "pCO₂ has dropped" mineral. Mirrors
  // supersaturation_chrysocolla in vugg.py.
  supersaturation_chrysocolla() {
    if (this.fluid.Cu < 5 || this.fluid.SiO2 < 20 || this.fluid.O2 < 0.3) return 0;
    if (this.temperature < 5 || this.temperature > 80) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    if (this.fluid.CO3 > this.fluid.SiO2) return 0;
    const cu_f = Math.min(this.fluid.Cu / 30.0, 3.0);
    const si_f = Math.min(this.fluid.SiO2 / 60.0, 2.5);
    const o_f  = Math.min(this.fluid.O2 / 1.0, 1.5);
    const T = this.temperature;
    let t_f;
    if (T >= 15 && T <= 40) t_f = 1.0;
    else if (T < 15) t_f = Math.max(0.3, T / 15.0);
    else t_f = Math.max(0.3, 1.0 - (T - 40) / 40.0);
    const pH = this.fluid.pH;
    let ph_f;
    if (pH >= 6.0 && pH <= 7.5) ph_f = 1.0;
    else if (pH < 6.0) ph_f = Math.max(0.4, 1.0 - (6.0 - pH) * 0.6);
    else ph_f = Math.max(0.4, 1.0 - (pH - 7.5) * 0.6);
    const sigma = cu_f * si_f * o_f * t_f * ph_f;
    return Math.max(sigma, 0);
  }

  // Native gold (Au) — noble metal. Two precipitation paths collapsed
  // into one σ: high-T Au-Cl decomplexation (Bingham vapor plume) and
  // low-T Au-Cl reduction at supergene redox interface (Bisbee oxidation
  // cap). Tolerates both Eh regimes — only S-suppression and Au activity
  // matter. See vugg.py supersaturation_native_gold for full rationale.
  supersaturation_native_gold() {
    if (this.fluid.Au < 0.5) return 0;
    const au_f = Math.min(this.fluid.Au / 1.0, 4.0);
    const s_f = Math.max(0.2, 1.0 - this.fluid.S / 200.0);
    let sigma = au_f * s_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 400) T_factor = 1.0;
    else if (T < 20) T_factor = 0.5;
    else if (T <= 700) T_factor = Math.max(0.5, 1.0 - 0.001 * (T - 400));
    else T_factor = 0.3;
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Native copper (Cu) — elemental, strongly reducing + low S.
  supersaturation_native_copper() {
    if (this.fluid.Cu < 50 || this.fluid.O2 > 0.4 || this.fluid.S > 30) return 0;
    const cu_f = Math.min(this.fluid.Cu / 80.0, 2.5);
    const red_f = Math.max(0.4, 1.0 - this.fluid.O2 * 2.0);
    const s_f = Math.max(0.3, 1.0 - this.fluid.S / 40.0);
    let sigma = cu_f * red_f * s_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 150) T_factor = 1.0;
    else if (T < 20) T_factor = 0.7;
    else if (T <= 300) T_factor = Math.max(0.4, 1.0 - 0.004 * (T - 150));
    else T_factor = 0.2;
    sigma *= T_factor;
    if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Bornite (Cu₅FeS₄) — peacock ore, 228°C order-disorder transition.
  supersaturation_bornite() {
    if (this.fluid.Cu < 25 || this.fluid.Fe < 8 || this.fluid.S < 20 || this.fluid.O2 > 1.8) return 0;
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
    sigma *= Math.max(0.3, 1.5 - this.fluid.O2);
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Chalcocite (Cu₂S) — the supergene Cu-enrichment pseudomorph thief.
  supersaturation_chalcocite() {
    if (this.fluid.Cu < 30 || this.fluid.S < 15 || this.fluid.O2 > 1.9) return 0;
    const cu_f = Math.min(this.fluid.Cu / 60.0, 2.0);
    const s_f  = Math.min(this.fluid.S / 50.0, 1.5);
    let sigma = cu_f * s_f;
    if (this.temperature > 150) sigma *= Math.exp(-0.03 * (this.temperature - 150));
    sigma *= Math.max(0.3, 1.4 - this.fluid.O2);
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Covellite (CuS) — the only common naturally blue mineral; transition zone.
  supersaturation_covellite() {
    if (this.fluid.Cu < 20 || this.fluid.S < 25 || this.fluid.O2 > 2.0) return 0;
    const cu_f = Math.min(this.fluid.Cu / 50.0, 2.0);
    const s_f  = Math.min(this.fluid.S / 60.0, 1.8);
    let sigma = cu_f * s_f;
    if (this.temperature > 100) sigma *= Math.exp(-0.03 * (this.temperature - 100));
    sigma *= Math.max(0.3, 1.3 - Math.abs(this.fluid.O2 - 0.8));
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Anglesite (PbSO₄) — orthorhombic lead sulfate, supergene intermediate.
  supersaturation_anglesite() {
    if (this.fluid.Pb < 15 || this.fluid.S < 15 || this.fluid.O2 < 0.8) return 0;
    const pb_f = Math.min(this.fluid.Pb / 40.0, 2.0);
    const s_f  = Math.min(this.fluid.S / 40.0, 1.5);
    const o_f  = Math.min(this.fluid.O2 / 1.0, 1.5);
    let sigma = pb_f * s_f * o_f;
    if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
    if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.3;
    return Math.max(sigma, 0);
  }

  // Cerussite (PbCO₃) — orthorhombic lead carbonate, stellate sixling twins.
  supersaturation_cerussite() {
    if (this.fluid.Pb < 15 || this.fluid.CO3 < 30) return 0;
    const pb_f = Math.min(this.fluid.Pb / 40.0, 2.0);
    const co_f = Math.min(this.fluid.CO3 / 80.0, 1.5);
    let sigma = pb_f * co_f;
    if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
    if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.4;
    else if (this.fluid.pH > 7.0) sigma *= 1.0 + (this.fluid.pH - 7.0) * 0.1;
    return Math.max(sigma, 0);
  }

  // Pyromorphite (Pb₅(PO₄)₃Cl) — hexagonal apatite-group phosphate.
  supersaturation_pyromorphite() {
    if (this.fluid.Pb < 20 || this.fluid.P < 2 || this.fluid.Cl < 5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
    const p_f  = Math.min(this.fluid.P / 5.0, 2.0);
    const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
    let sigma = pb_f * p_f * cl_f;
    if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
    if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
    return Math.max(sigma, 0);
  }

  // Vanadinite (Pb₅(VO₄)₃Cl) — hexagonal apatite-group vanadate.
  supersaturation_vanadinite() {
    if (this.fluid.Pb < 20 || this.fluid.V < 2 || this.fluid.Cl < 5) return 0;
    const pb_f = Math.min(this.fluid.Pb / 30.0, 1.8);
    const v_f  = Math.min(this.fluid.V / 6.0, 2.0);
    const cl_f = Math.min(this.fluid.Cl / 15.0, 1.3);
    let sigma = pb_f * v_f * cl_f;
    if (this.temperature > 80) sigma *= Math.exp(-0.04 * (this.temperature - 80));
    if (this.fluid.pH < 2.5) sigma -= (2.5 - this.fluid.pH) * 0.4;
    return Math.max(sigma, 0);
  }

  // Beryl (Be₃Al₂Si₆O₁₈) — Be-gated cyclosilicate. Beryllium is the most
  // incompatible common element — no other mineral consumes it, so Be
  // accumulates in pegmatite fluid until σ finally crosses 1.8. Slow
  // growth rate (growth_rate_mult 0.25) but rides the supersaturation
  // for many steps, producing meter-scale crystals in real pegmatites.
  // Shared Be + Al + SiO2 + T-window core for the beryl family
  // (goshenite/beryl + emerald + aquamarine + morganite + heliodor).
  _beryl_base_sigma() {
    if (this.fluid.Be < 10 || this.fluid.Al < 6 || this.fluid.SiO2 < 50) return 0;
    const be_f = Math.min(this.fluid.Be / 15.0, 2.5);
    const al_f = Math.min(this.fluid.Al / 12.0, 1.5);
    const si_f = Math.min(this.fluid.SiO2 / 350.0, 1.5);
    let sigma = be_f * al_f * si_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 350 && T <= 550) T_factor = 1.0;
    else if (T >= 300 && T < 350) T_factor = 0.6 + 0.008 * (T - 300);
    else if (T > 550 && T <= 650) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 550));
    else if (T > 650) T_factor = 0.2;
    else T_factor = Math.max(0.1, 0.6 - 0.006 * (300 - T));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Beryl/goshenite — colorless/generic; fires only when no chromophore
  // variety's gate is met (post-Round-7 architecture).
  supersaturation_beryl() {
    const f = this.fluid;
    if (f.Cr >= 0.5 || f.V >= 1.0) return 0;       // emerald priority
    if (f.Mn >= 2.0) return 0;                     // morganite priority
    if (f.Fe >= 15 && f.O2 > 0.5) return 0;        // heliodor priority
    if (f.Fe >= 8) return 0;                       // aquamarine priority
    return this._beryl_base_sigma();
  }

  // Emerald — Cr³⁺/V³⁺ variety; top priority in beryl-family dispatch.
  supersaturation_emerald() {
    if (this.fluid.Cr < 0.5 && this.fluid.V < 1.0) return 0;
    const base = this._beryl_base_sigma();
    if (base <= 0) return 0;
    const chrom_f = Math.max(
      Math.min(this.fluid.Cr / 1.5, 1.8),
      Math.min(this.fluid.V / 3.0, 1.5)
    );
    return base * chrom_f;
  }

  // Aquamarine — Fe²⁺ reducing variety; excludes emerald/morganite/heliodor.
  supersaturation_aquamarine() {
    const f = this.fluid;
    if (f.Fe < 8) return 0;
    if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
    if (f.Mn >= 2.0) return 0;                 // morganite
    if (f.Fe >= 15 && f.O2 > 0.5) return 0;    // heliodor
    const base = this._beryl_base_sigma();
    if (base <= 0) return 0;
    const fe_f = Math.min(f.Fe / 12.0, 1.8);
    return base * fe_f;
  }

  // Morganite — Mn²⁺ variety; priority over aquamarine/heliodor, under emerald.
  supersaturation_morganite() {
    const f = this.fluid;
    if (f.Mn < 2.0) return 0;
    if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
    const base = this._beryl_base_sigma();
    if (base <= 0) return 0;
    const mn_f = Math.min(f.Mn / 4.0, 1.8);
    return base * mn_f;
  }

  // Heliodor — Fe³⁺ oxidizing variety; narrower window than aquamarine.
  supersaturation_heliodor() {
    const f = this.fluid;
    if (f.Fe < 15 || f.O2 <= 0.5) return 0;
    if (f.Cr >= 0.5 || f.V >= 1.0) return 0;   // emerald
    if (f.Mn >= 2.0) return 0;                 // morganite
    const base = this._beryl_base_sigma();
    if (base <= 0) return 0;
    const fe_f = Math.min(f.Fe / 20.0, 1.6);
    const o2_f = Math.min(f.O2 / 1.0, 1.3);
    return base * fe_f * o2_f;
  }

  // ---- Corundum family (Al₂O₃) — FIRST UPPER-BOUND GATE IN THE SIM ----
  // SiO₂ < 50 is the defining constraint: with silica present at normal
  // crustal concentrations, Al + SiO₂ drives to feldspar/Al₂SiO₅ instead.
  _corundum_base_sigma() {
    if (this.fluid.Al < 15) return 0;
    if (this.fluid.SiO2 > 50) return 0;  // UPPER gate — defining constraint
    if (this.fluid.pH < 6 || this.fluid.pH > 10) return 0;
    const T = this.temperature;
    if (T < 400 || T > 1000) return 0;
    const al_f = Math.min(this.fluid.Al / 25.0, 2.0);
    let sigma = al_f;
    let T_factor;
    if (T >= 600 && T <= 900) T_factor = 1.0;
    else if (T >= 400 && T < 600) T_factor = 0.4 + 0.003 * (T - 400);
    else if (T > 900 && T <= 1000) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 900));
    else T_factor = 0.2;
    sigma *= T_factor;
    const pH_factor = (this.fluid.pH >= 7 && this.fluid.pH <= 9) ? 1.0 : 0.6;
    sigma *= pH_factor;
    return Math.max(sigma, 0);
  }

  // Corundum — colorless/generic; fires when no chromophore variety's gate is met.
  supersaturation_corundum() {
    const f = this.fluid;
    if (f.Cr >= 2.0) return 0;  // ruby priority
    if (f.Fe >= 5) return 0;    // sapphire priority
    return this._corundum_base_sigma();
  }

  // Ruby — Cr³⁺ red variety; top priority in corundum-family dispatch.
  supersaturation_ruby() {
    if (this.fluid.Cr < 2.0) return 0;
    const base = this._corundum_base_sigma();
    if (base <= 0) return 0;
    const cr_f = Math.min(this.fluid.Cr / 5.0, 2.0);
    return base * cr_f;
  }

  // Sapphire — Fe is the universal chromophore (blue Fe+Ti IVCT; yellow Fe alone).
  supersaturation_sapphire() {
    const f = this.fluid;
    if (f.Cr >= 2.0) return 0;  // ruby priority
    if (f.Fe < 5) return 0;
    const base = this._corundum_base_sigma();
    if (base <= 0) return 0;
    let chrom_f = Math.min(f.Fe / 15.0, 1.5);
    if (f.Ti >= 0.5) chrom_f *= Math.min(f.Ti / 1.5, 1.3);
    return base * chrom_f;
  }

  // Tourmaline (Na(Fe,Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄) — B-gated cyclosilicate.
  // Schorl (Fe²⁺, early) → elbaite (Li-rich, late) series records fluid
  // evolution. T window 350–700°C, optimum 400–600°C. Extremely resistant.
  supersaturation_tourmaline() {
    if (this.fluid.Na < 3 || this.fluid.B < 6 || this.fluid.Al < 8 || this.fluid.SiO2 < 60) return 0;
    const na_f = Math.min(this.fluid.Na / 20.0, 1.5);
    const b_f  = Math.min(this.fluid.B / 15.0, 2.0);
    const al_f = Math.min(this.fluid.Al / 15.0, 1.5);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = na_f * b_f * al_f * si_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 400 && T <= 600) T_factor = 1.0;
    else if (T >= 350 && T < 400) T_factor = 0.5 + 0.01 * (T - 350);
    else if (T > 600 && T <= 700) T_factor = Math.max(0.3, 1.0 - 0.007 * (T - 600));
    else if (T > 700) T_factor = 0.2;
    else T_factor = Math.max(0.1, 0.5 - 0.008 * (350 - T));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Topaz (Al₂SiO₄(F,OH)₂) — F-gated nesosilicate. Imperial topaz at Ouro
  // Preto grew at ~360°C, 3.5 kbar (Morteani 2002). Hard F threshold
  // (20 ppm) below which the structure can't form — delays nucleation
  // until fluorine accumulates. Factors are capped so pegmatite-level
  // Al/SiO₂ (thousands of ppm) doesn't blow sigma into runaway territory.
  supersaturation_topaz() {
    if (this.fluid.F < 20 || this.fluid.Al < 3 || this.fluid.SiO2 < 200) return 0;
    const al_f = Math.min(this.fluid.Al / 8.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    const f_f  = Math.min(this.fluid.F / 25.0, 1.5);
    let sigma = al_f * si_f * f_f;
    const T = this.temperature;
    let T_factor;
    if (T >= 340 && T <= 400) T_factor = 1.0;
    else if (T >= 300 && T < 340) T_factor = 0.6 + 0.01 * (T - 300);
    else if (T > 400 && T <= 500) T_factor = Math.max(0.2, 1.0 - 0.008 * (T - 400));
    else if (T > 500 && T <= 600) T_factor = Math.max(0.1, 0.4 - 0.003 * (T - 500));
    else T_factor = 0.1;
    sigma *= T_factor;
    if (this.fluid.pH < 2.0) sigma -= (2.0 - this.fluid.pH) * 0.4;
    return Math.max(sigma, 0);
  }

  // Round 9a — broth-ratio branching pair (rosasite + aurichalcite).
  // First mechanic in the sim where the *ratio* of fluid elements
  // (Cu vs Zn) gates nucleation, not presence/absence. Same parent
  // broth, opposite outcome based on which side dominates.
  // Mirror of vugg.py supersaturation_rosasite / _aurichalcite.

  supersaturation_rosasite() {
    if (this.fluid.Cu < 5 || this.fluid.Zn < 3 || this.fluid.CO3 < 30) return 0;
    if (this.temperature < 10 || this.temperature > 40) return 0;
    if (this.fluid.O2 < 0.8) return 0;
    if (this.fluid.pH < 6.5) return 0;
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const cu_fraction = this.fluid.Cu / cu_zn_total;  // safe — Cu>=5 above
    if (cu_fraction < 0.5) return 0;  // broth-ratio branch: Cu must dominate
    const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
    const zn_f = Math.min(this.fluid.Zn / 25.0, 2.0);
    const co3_f = Math.min(this.fluid.CO3 / 100.0, 2.0);
    let sigma = cu_f * zn_f * co3_f;
    if (cu_fraction >= 0.55 && cu_fraction <= 0.85) sigma *= 1.3;
    else if (cu_fraction > 0.95) sigma *= 0.5;
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 30) T_factor = 1.2;
    else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
    else T_factor = Math.max(0.5, 1.2 - 0.07 * (T - 30));
    sigma *= T_factor;
    if (this.fluid.Fe > 60) sigma *= 0.6;
    return Math.max(sigma, 0);
  }

  supersaturation_aurichalcite() {
    if (this.fluid.Zn < 5 || this.fluid.Cu < 3 || this.fluid.CO3 < 30) return 0;
    if (this.temperature < 10 || this.temperature > 40) return 0;
    if (this.fluid.O2 < 0.8) return 0;
    // pH gate — see vugg.py supersaturation_aurichalcite for citation
    // (Pinch & Wilson 1977 — real Tsumeb fluids active at pH 5.5-7.5).
    if (this.fluid.pH < 6.0) return 0;
    const cu_zn_total = this.fluid.Cu + this.fluid.Zn;
    const zn_fraction = this.fluid.Zn / cu_zn_total;
    if (zn_fraction < 0.5) return 0;  // broth-ratio branch: Zn must dominate
    const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
    const zn_f = Math.min(this.fluid.Zn / 25.0, 2.0);
    const co3_f = Math.min(this.fluid.CO3 / 100.0, 2.0);
    let sigma = cu_f * zn_f * co3_f;
    if (zn_fraction >= 0.55 && zn_fraction <= 0.85) sigma *= 1.3;
    else if (zn_fraction > 0.95) sigma *= 0.5;
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 28) T_factor = 1.2;
    else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
    else T_factor = Math.max(0.5, 1.2 - 0.06 * (T - 28));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  // Round 9b — anion-competition mechanic (torbernite + zeunerite).
  // Three-branch generalization of 9a's broth-ratio gate: three uranyl
  // minerals compete for the same U⁶⁺ cation, differentiated by which
  // anion (PO₄³⁻/AsO₄³⁻/VO₄³⁻) dominates. 9b ships P + As branches;
  // carnotite (V) joins in 9c. Mirror of vugg.py supersaturation_*.

  supersaturation_torbernite() {
    if (this.fluid.Cu < 5 || this.fluid.U < 0.3 || this.fluid.P < 1.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 10 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    // Anion competition (3-way as of 9c): denominator includes V so
    // V-rich fluid routes to carnotite instead of falling into torbernite.
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const p_fraction = this.fluid.P / anion_total;
    if (p_fraction < 0.5) return 0;
    // Cation competition (Round 9d): Cu must dominate over Ca. Pre-9d
    // torbernite would have fired even in Ca-saturated groundwater if
    // Cu>=5; the cation fork sends those fluids to autunite instead.
    const cation_total = this.fluid.Cu + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const cu_fraction = this.fluid.Cu / cation_total;
    if (cu_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
    const p_f = Math.min(this.fluid.P / 10.0, 2.0);
    let sigma = u_f * cu_f * p_f;
    if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 40) T_factor = 1.2;
    else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  supersaturation_autunite() {
    // Round 9d (May 2026): Ca-cation analog of torbernite. Same parent
    // fluid (U + P + supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
    // Mirror of vugg.py supersaturation_autunite.
    if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.P < 1.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 4.5 || this.fluid.pH > 8.0) return 0;
    // Anion competition — same shape as torbernite/zeunerite/carnotite
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const p_fraction = this.fluid.P / anion_total;
    if (p_fraction < 0.5) return 0;
    // Cation competition — Ca must dominate over Cu (mirror of torbernite)
    const cation_total = this.fluid.Cu + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const ca_fraction = this.fluid.Ca / cation_total;
    if (ca_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
    const p_f = Math.min(this.fluid.P / 10.0, 2.0);
    let sigma = u_f * ca_f * p_f;
    if (p_fraction >= 0.55 && p_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 10 && T <= 35) T_factor = 1.2;
    else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  supersaturation_zeunerite() {
    if (this.fluid.Cu < 5 || this.fluid.U < 0.3 || this.fluid.As < 2.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 10 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    // Anion competition (3-way as of 9c)
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const as_fraction = this.fluid.As / anion_total;
    if (as_fraction < 0.5) return 0;
    // Cation competition (Round 9e): Cu must dominate over Ca. Mirror
    // of torbernite's 9d gate. Without this, zeunerite would fire in
    // Ca-saturated groundwater that should route to uranospinite.
    const cation_total = this.fluid.Cu + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const cu_fraction = this.fluid.Cu / cation_total;
    if (cu_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const cu_f = Math.min(this.fluid.Cu / 25.0, 2.0);
    const as_f = Math.min(this.fluid.As / 15.0, 2.0);
    let sigma = u_f * cu_f * as_f;
    if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 40) T_factor = 1.2;
    else if (T < 15) T_factor = 0.6 + 0.04 * (T - 10);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  supersaturation_uranospinite() {
    // Round 9e (May 2026): Ca-cation analog of zeunerite. Mirror of
    // vugg.py supersaturation_uranospinite. Same parent fluid (U + As +
    // supergene-T + oxidizing), gates on Ca/(Cu+Ca) > 0.5.
    if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.As < 2.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 4.5 || this.fluid.pH > 8.0) return 0;
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const as_fraction = this.fluid.As / anion_total;
    if (as_fraction < 0.5) return 0;
    const cation_total = this.fluid.Cu + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const ca_fraction = this.fluid.Ca / cation_total;
    if (ca_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
    const as_f = Math.min(this.fluid.As / 15.0, 2.0);
    let sigma = u_f * ca_f * as_f;
    if (as_fraction >= 0.55 && as_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 10 && T <= 35) T_factor = 1.2;
    else if (T < 10) T_factor = 0.5 + 0.07 * (T - 5);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  supersaturation_carnotite() {
    // V-branch / K-cation of the uranyl cation+anion fork (Round 9c + 9e).
    // Mirror of vugg.py supersaturation_carnotite.
    if (this.fluid.K < 5 || this.fluid.U < 0.3 || this.fluid.V < 1.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 10 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 7.5) return 0;
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const v_fraction = this.fluid.V / anion_total;
    if (v_fraction < 0.5) return 0;
    // Cation competition (Round 9e): K must dominate over Ca. Without
    // this, carnotite would fire in Ca-saturated groundwater that should
    // route to tyuyamunite.
    const cation_total = this.fluid.K + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const k_fraction = this.fluid.K / cation_total;
    if (k_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const k_f = Math.min(this.fluid.K / 30.0, 2.0);
    const v_f = Math.min(this.fluid.V / 10.0, 2.0);
    let sigma = u_f * k_f * v_f;
    if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 20 && T <= 40) T_factor = 1.2;
    else if (T < 20) T_factor = 0.5 + 0.07 * (T - 10);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 40));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }

  supersaturation_tyuyamunite() {
    // Round 9e (May 2026): Ca-cation analog of carnotite. Mirror of
    // vugg.py supersaturation_tyuyamunite. Orthorhombic instead of
    // monoclinic crystal system but same chemistry stage.
    if (this.fluid.Ca < 15 || this.fluid.U < 0.3 || this.fluid.V < 1.0 || this.fluid.O2 < 0.8) return 0;
    if (this.temperature < 5 || this.temperature > 50) return 0;
    if (this.fluid.pH < 5.0 || this.fluid.pH > 8.0) return 0;
    const anion_total = this.fluid.P + this.fluid.As + this.fluid.V;
    if (anion_total <= 0) return 0;
    const v_fraction = this.fluid.V / anion_total;
    if (v_fraction < 0.5) return 0;
    const cation_total = this.fluid.K + this.fluid.Ca;
    if (cation_total <= 0) return 0;
    const ca_fraction = this.fluid.Ca / cation_total;
    if (ca_fraction < 0.5) return 0;
    const u_f = Math.min(this.fluid.U / 2.0, 2.0);
    const ca_f = Math.min(this.fluid.Ca / 50.0, 2.0);
    const v_f = Math.min(this.fluid.V / 10.0, 2.0);
    let sigma = u_f * ca_f * v_f;
    if (v_fraction >= 0.55 && v_fraction <= 0.85) sigma *= 1.3;
    const T = this.temperature;
    let T_factor;
    if (T >= 15 && T <= 35) T_factor = 1.2;
    else if (T < 15) T_factor = 0.5 + 0.07 * (T - 5);
    else T_factor = Math.max(0.4, 1.2 - 0.08 * (T - 35));
    sigma *= T_factor;
    return Math.max(sigma, 0);
  }
}

