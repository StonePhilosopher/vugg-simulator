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
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts: any = {}) {
    this.temperature = opts.temperature ?? 350.0;
    this.pressure = opts.pressure ?? 1.5;
    this.fluid = opts.fluid || new FluidChemistry();
    this.flow_rate = opts.flow_rate ?? 1.0;
    this.wall = opts.wall || new VugWall();
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 3 — water-level mechanic
    // migrates to mm-height as the canonical representation.
    //
    // Old name `fluid_surface_ring` and new name `fluid_surface_height_mm`
    // are aliased via getters/setters below — they refer to the same
    // private slot. Numerically identical while `ring_spacing_mm = 1.0`
    // (the project-wide default across every shipping scenario). When
    // a future scenario overrides ring spacing, the legacy ring-index
    // name will need a spacing-aware conversion; flagged in the
    // proposal's tranche notes.
    //
    // Why migrate the name: when wall.rings retires (Tranche 4), the
    // "ring index" concept stops being meaningful. Height-in-mm is
    // the science-grounded representation (real cavity water tables
    // sit at a specific elevation above the floor, not at "ring 4").
    //
    // null = "no water level set" → fully submerged (legacy default,
    // every cell 'submerged'). Below = submerged, surface band =
    // meniscus, above = vadose/'air'.
    this._fluidSurfaceMm = (opts.fluid_surface_height_mm != null)
      ? opts.fluid_surface_height_mm
      : (opts.fluid_surface_ring != null ? opts.fluid_surface_ring : null);
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

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 3 — water-level accessors.
  // Both names hit the same private slot (this._fluidSurfaceMm).
  // Numerically identical while ring_spacing_mm = 1.0 (today's
  // default everywhere); spacing-aware conversion can land later.
  get fluid_surface_height_mm() { return this._fluidSurfaceMm; }
  set fluid_surface_height_mm(v) { this._fluidSurfaceMm = v; }
  get fluid_surface_ring() { return this._fluidSurfaceMm; }
  set fluid_surface_ring(v) { this._fluidSurfaceMm = v; }

  // Pure classifier; used by ringWaterState and by transition-detection
  // logic that needs to compare against an arbitrary previous surface.
  //
  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 3 — `surface` is the
  // fluid surface position. With ring_spacing_mm=1.0 (default), this
  // is numerically equivalent to a ring index AND to a height in mm
  // — the arithmetic below uses ring units throughout, so callers
  // passing either name see consistent results. Spacing-aware
  // generalization can land when a scenario actually overrides
  // ring_spacing_mm.
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
    //
    // Kim 2023 cyclic-omega mechanism: ordering builds when the system
    // alternates between supersaturated-for-ordered-dolomite and
    // undersaturated-for-ordered-dolomite. The relevant threshold is
    // NOT thermodynamic equilibrium (omega = 1 — the boundary for
    // "any dolomite at all") but the boundary where ordered dolomite
    // stops winning the competition against the disordered HMC
    // precursor.
    //
    // The omega = 100 threshold is engineering-calibrated from the
    // codebase's own Ksp data (data/thermo-carbonates.json): ordered
    // dolomite Ksp = 10^-17.09, disordered HMC at x=0.30 Ksp ≈ 10^-5.5
    // — so dolomite is ~10^11.6 less soluble than the disordered Mg
    // intermediate. Setting the cycle threshold at omega_dolomite = 100
    // approximates "the IAP is enough above ordered-dolomite
    // equilibrium to overcome the HMC competitor" — the geological
    // condition Kim 2023 shows is required for ordering progression.
    //
    // (Earlier comments in v145 cited Burton 1993 and Wright 1999 as
    // the basis for the 100 threshold; W11 prep research surfaced that
    // those citations were fabricated — Burton 1993 Chem. Geol. 105 is
    // a review paper on aragonite-vs-Mg-calcite cement mineralogy,
    // NOT a kinetics-vs-omega study. The threshold value is defensible
    // from the simulator's own Ksp differential, but the citations
    // were not. "Follow the science" means pulling fabricated anchors
    // when caught — corrected in the v146 prep arc.)
    //
    // v145 fix: under the SI engine (CARBONATE_KSP_ACTIVE_PER_MINERAL.
    // dolomite = true), supersaturation_dolomite returns raw omega
    // which never drops below 1.0 in sabkha's Mg-rich brine even
    // during evap events — the empirical engine masked this because
    // its ppm-style sigma formula DID cross 1.0 cleanly. The SI
    // engine's honest omega numbers require an honest threshold for
    // the Kim ordering criterion.
    //
    // Pre-SI (empirical) mode keeps the 1.0 threshold so v144 and
    // earlier behavior is preserved.
    const sigma = this.supersaturation_dolomite();
    const prev = this._dol_prev_sigma;
    const threshold = (typeof kspSupersatActiveFor === 'function' && kspSupersatActiveFor('dolomite')) ? 100 : 1.0;
    if (prev > 0.0) {
      if (prev >= threshold && sigma < threshold) {
        this._dol_in_undersat = true;
      } else if (prev < threshold && sigma >= threshold && this._dol_in_undersat) {
        this._dol_cycle_count += 1;
        this._dol_in_undersat = false;
      }
    }
    this._dol_prev_sigma = sigma;
  }

  // effectiveTemperature is now an identity pass-through. The historical
  // Mo-flux boost (when Mo > 20 ppm: 15% effective-T increase to "flux"
  // the sulfide T windows) was a SIMULATION ARTIFACT with no geological
  // basis. Mo does NOT thermodynamically lower the nucleation barrier
  // for pyrite, chalcopyrite, or galena in natural hydrothermal systems
  // — the original code's "MoO₃ as a flux for corundum growth" citation
  // refers to LABORATORY synthetic-crystal-growth technique (Knipovich
  // / Czochralski flux melt at 1100°C), not natural petrology. In real
  // porphyry deposits (Climax, Bingham, El Teniente) Mo + Cu + Pb
  // sulfides coexist because each nucleates in its own T window
  // independently. Removed in v68 (canonical 5ecbb42). Getter is
  // preserved as an identity pass-through so call sites that still
  // read `effectiveTemperature` keep working.
  get effectiveTemperature() {
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


  // Wulfenite (PbMoO₄) — supergene mineral requiring oxidation of BOTH galena and molybdenite
  // Per Seo et al. 2012: wulfenite forms when Pb²⁺ (from oxidized galena) meets MoO₄²⁻ (from oxidized molybdenite)

  // Molybdenite (MoS₂) — primary molybdenum sulfide, porphyry deposits
  // High-temperature primary mineral (300-500°C). Mo arrives in separate later pulse from Cu.
  // Per Seo et al. 2012 (Bingham Canyon): MoS₂ is the primary Mo-bearing phase.

  // Ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) — the no-lead branch of Mo oxidation.
  // Canary-yellow acicular tufts; fast-growing, powdery, under-displayed
  // but geologically more common than wulfenite. Forms from oxidized
  // molybdenite when Fe is around and Pb is either absent or already
  // committed elsewhere. Coexists with wulfenite in Pb-bearing systems
  // (both draw on MoO₄²⁻ pool).

  // Barite (BaSO₄) — the Ba sequestration mineral. Densest non-metallic
  // mineral collectors will encounter (4.5 g/cm³). Galena's primary gangue
  // mineral in MVT districts; also abundant in hydrothermal vein systems.
  // No acid dissolution (the standard drilling-mud weighting agent for a
  // reason); thermal decomposition only above 1149°C. Eh ≥ 0.1 — needs
  // sulfate (SO₄²⁻), not sulfide (H₂S).

  // Anhydrite (CaSO₄) — high-T or saline-low-T Ca sulfate sister of selenite.
  // Two stability regimes: T > 60°C (high-T branch) OR T < 60°C with salinity
  // > 100‰ (low-T saline branch — sabkha evaporite). Below 60°C in dilute
  // fluid, anhydrite is metastable and rehydrates to gypsum.

  // Brochantite (Cu₄(SO₄)(OH)₆) — wet-supergene Cu sulfate; emerald-green
  // prismatic crystals. The higher-pH end (pH 4-7) of the brochantite ↔
  // antlerite fork. Statue of Liberty patina mineral.

  // Antlerite (Cu₃(SO₄)(OH)₄) — dry-acid Cu sulfate; pH 1-3.5 stability.
  // The lower-pH end of the brochantite ↔ antlerite fork. Chuquicamata
  // type ore phase.

  // Jarosite (KFe³⁺₃(SO₄)₂(OH)₆) — the diagnostic acid-mine-drainage mineral.
  // Yellow rhombs/crusts; supergene Fe-sulfate that takes over from goethite
  // when pH drops below 4. Confirmed on Mars (Klingelhöfer et al. 2004).
  // Stability: K, Fe, S, O2; pH 1-5 (above pH 5 dissolves to feed goethite).
  // Strongly low-T — supergene only.

  // Alunite (KAl₃(SO₄)₂(OH)₆) — the Al sister of jarosite (alunite group).
  // The index mineral of advanced argillic alteration in porphyry-Cu lithocaps
  // and high-sulfidation epithermal Au deposits. Marysvale UT type locality.
  // Wider T window than jarosite (50-300 °C — hydrothermal acid-sulfate spans
  // the porphyry-epithermal range, not just supergene).

  // Celestine (SrSO₄) — the Sr sister of barite (isostructural). Pale
  // celestial blue from F-center defects. Madagascar geodes, Sicilian
  // sulfur-vug fibrous habit, Lake Erie. No acid dissolution; thermal
  // decomposition >1100°C.

  // Acanthite (Ag₂S, monoclinic) — the low-T silver sulfide. First Ag mineral
  // in the sim. Hard upper-T gate at 173°C (above that, argentite forms).
  // Reducing only. Source: research/research-acanthite.md, Petruk et al. 1974.

  // Argentite (Ag₂S, cubic) — the high-T silver sulfide. Hard lower-T gate
  // at 173°C (acanthite handles below). Paramorph on cooling — handled in
  // applyParamorphTransitions hook in run_step. Source: research-argentite.md.

  // Chalcanthite (CuSO4·5H2O) — water-soluble Cu sulfate, the terminal
  // Cu-sulfate oxidation phase. Source: research-chalcanthite.md.

  // Descloizite (PbZnVO4(OH)) — Zn end of complete solid solution series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. See
  // research/research-broth-ratio-descloizite-mottramite.md.

  // Mottramite (PbCu(VO4)(OH)) — Cu end of complete solid solution series.
  // Round 9c retrofit: same broth-ratio idiom as descloizite.

  // Raspite (PbWO4, monoclinic) — RARE polymorph.

  // Stolzite (PbWO4, tetragonal) — common polymorph.

  // Olivenite (Cu2AsO4(OH)) — Cu end of olivenite-adamite series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. See
  // research/research-broth-ratio-adamite-olivenite.md and
  // research/research-olivenite.md.

  // Nickeline (NiAs) — high-T pale-copper-red Ni arsenide.

  // Millerite (NiS) — capillary brass-yellow nickel sulfide. Mutual-exclusion
  // gate: nickeline takes priority when As>30 + T>200.

  // Cobaltite (CoAsS) — three-element-gate sulfarsenide.

  // Native tellurium (Te⁰) — metal-telluride-overflow engine.
  // Hard gates: Au>1, Ag>5, Hg>0.5, O2>0.5. Source: research-native-tellurium.md.

  // Native sulfur (S₈) — synproportionation Eh-window engine.
  // Hard gates: 0.1<O2<0.7, pH<5, Fe+Cu+Pb+Zn<100. Source: research-native-sulfur.md.

  // Native arsenic (As⁰) — the residual-overflow native element.
  // Hard gates: S>10 (overflows to realgar/arsenopyrite), Fe>50 (arsenopyrite),
  // O2>0.5 (arsenate). Source: research-native-arsenic.md.

  // Native silver (Ag⁰) — the Kongsberg wire-silver mineral.
  // First depletion-gate engine in the sim: fires only when S < 2 AND O2 < 0.3.
  // Source: research/research-native-silver.md, Boyle 1968.

  // Scorodite (FeAsO₄·2H₂O) — the arsenic sequestration mineral.
  // Pseudo-octahedral pale blue-green dipyramids; the most common
  // supergene arsenate. Forms from oxidized arsenopyrite (Fe³⁺ +
  // AsO₄³⁻ both required) in acidic oxidizing conditions. The
  // acidic-end of the arsenate stability field — at pH > 5 it
  // dissolves, releasing AsO₄³⁻ for the higher-pH arsenate suite
  // (erythrite, mimetite, adamite, etc.). World-class deep blue-green
  // crystals at Tsumeb (Gröbner & Becker 1973).

  // Arsenopyrite (FeAsS) — the arsenic gateway, the #1 Au-trapping mineral.
  // Mesothermal primary sulfide co-precipitates with pyrite in orogenic
  // gold systems and arrives in the later-stage porphyry evolution.
  // Structurally traps Au up to ~1500 ppm as "invisible gold" — released
  // back to fluid when the crystal later oxidizes (supergene Au
  // enrichment). Oxidation pathway: arsenopyrite + O₂ + H₂O →
  // Fe³⁺ + AsO₄³⁻ + H₂SO₄ → feeds scorodite + acidifies further.

  // Feldspar (KAlSi3O8 / NaAlSi3O8) — the most abundant mineral on Earth
  // Temperature determines polymorph: sanidine (>500°C) → orthoclase (300-500°C) → microcline (<300°C)
  // Needs K or Na + Al + Si in fluid

  // Selenite (gypsum, CaSO4·2H2O) — forms in evaporite/oxidation environments
  // Low temperature, needs Ca + S (as sulfate via oxidation) + O2
  // The crystal that grows when everything else is ending


  // Adamite (Zn2(AsO4)(OH)) — Zn end of olivenite-adamite series.
  // Round 9c retrofit (Apr 2026): broth-ratio (50%-gate + sweet-spot)
  // replaces the Round 8d strict-comparison dispatch. The famous green
  // UV fluorescence requires trace Cu²⁺ activator — pure-Zn adamite is
  // rare in nature. See research/research-broth-ratio-adamite-olivenite.md.


  // Goethite (FeO(OH)) — the ghost mineral, now real.
  // Low-T oxidation product of Fe-sulfides and Fe²⁺ fluids.
  // Botryoidal, mammillary, fibrous. Often pseudomorphs pyrite/marcasite.
  // Dehydrates to hematite above 300°C.

  // Albite (NaAlSi₃O₈) — plagioclase end-member, pegmatite staple.

  // Spodumene (LiAlSi₂O₆) — Li-gated monoclinic pyroxene. Kunzite (Mn²⁺
  // pink), hiddenite (Cr³⁺ green), triphane (pure/yellow). T window
  // 400–700°C with optimum 450–600°C (hotter than beryl's window).

  // Magnetite (Fe₃O₄) — mixed-valence Fe²⁺Fe³⁺ at the HM redox buffer.

  // Lepidocrocite (γ-FeOOH) — ruby-red dimorph of goethite, rapid oxidation.

  // Stibnite (Sb₂S₃) — sword-blade antimony sulfide.

  // Bismuthinite (Bi₂S₃) — same structure as stibnite, Bi cousin.

  // Native bismuth (Bi) — elemental; forms when S runs out.

  // Clinobisvanite (BiVO₄) — end of the Bi oxidation sequence.

  // Cuprite (Cu₂O) — the Eh-boundary oxide.

  // Azurite (Cu₃(CO₃)₂(OH)₂) — deep-blue Cu carbonate, high pCO₂.
  // Cu carbonate competition is pCO₂-based, not Cu:Zn-style ratio (Vink
  // 1986, Mineralogical Magazine 50:43-47). Azurite's higher CO3 floor
  // (≥120 vs malachite ≥20) encodes Vink's log(pCO2) ≈ -3.5 univariant
  // boundary at 25°C. Paramorph drop to malachite when CO3 falls is in
  // grow_azurite. See research/research-broth-ratio-malachite-azurite.md.

  // Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) — hydrous copper silicate, the cyan
  // enamel of Cu oxidation zones. Strictly low-T, meteoric. Needs
  // Cu²⁺ + SiO₂ simultaneously in a near-neutral pH window (5.5–7.5).
  // Chrysocolla loses to the carbonates when CO₃ > SiO₂ — it's the
  // late-stage "pCO₂ has dropped" mineral. Mirrors
  // supersaturation_chrysocolla in vugg.py.

  // Native gold (Au) — noble metal. Two precipitation paths collapsed
  // into one σ: high-T Au-Cl decomplexation (Bingham vapor plume) and
  // low-T Au-Cl reduction at supergene redox interface (Bisbee oxidation
  // cap). Tolerates both Eh regimes — only S-suppression and Au activity
  // matter. See vugg.py supersaturation_native_gold for full rationale.

  // Native copper (Cu) — elemental, strongly reducing + low S.

  // Bornite (Cu₅FeS₄) — peacock ore, 228°C order-disorder transition.

  // Chalcocite (Cu₂S) — the supergene Cu-enrichment pseudomorph thief.

  // Covellite (CuS) — the only common naturally blue mineral; transition zone.

  // Anglesite (PbSO₄) — orthorhombic lead sulfate, supergene intermediate.

  // Cerussite (PbCO₃) — orthorhombic lead carbonate, stellate sixling twins.

  // Pyromorphite (Pb₅(PO₄)₃Cl) — hexagonal apatite-group phosphate.

  // Vanadinite (Pb₅(VO₄)₃Cl) — hexagonal apatite-group vanadate.

  // Beryl (Be₃Al₂Si₆O₁₈) — Be-gated cyclosilicate. Beryllium is the most
  // incompatible common element — no other mineral consumes it, so Be
  // accumulates in pegmatite fluid until σ finally crosses 1.8. Slow
  // growth rate (growth_rate_mult 0.25) but rides the supersaturation
  // for many steps, producing meter-scale crystals in real pegmatites.
  // Shared Be + Al + SiO2 + T-window core for the beryl family
  // (goshenite/beryl + emerald + aquamarine + morganite + heliodor).

  // Beryl/goshenite — colorless/generic; fires only when no chromophore
  // variety's gate is met (post-Round-7 architecture).

  // Emerald — Cr³⁺/V³⁺ variety; top priority in beryl-family dispatch.

  // Aquamarine — Fe²⁺ reducing variety; excludes emerald/morganite/heliodor.

  // Morganite — Mn²⁺ variety; priority over aquamarine/heliodor, under emerald.

  // Heliodor — Fe³⁺ oxidizing variety; narrower window than aquamarine.

  // ---- Corundum family (Al₂O₃) — FIRST UPPER-BOUND GATE IN THE SIM ----
  // SiO₂ < 50 is the defining constraint: with silica present at normal
  // crustal concentrations, Al + SiO₂ drives to feldspar/Al₂SiO₅ instead.

  // Corundum — colorless/generic; fires when no chromophore variety's gate is met.

  // Ruby — Cr³⁺ red variety; top priority in corundum-family dispatch.

  // Sapphire — Fe is the universal chromophore (blue Fe+Ti IVCT; yellow Fe alone).

  // Tourmaline (Na(Fe,Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄) — B-gated cyclosilicate.
  // Schorl (Fe²⁺, early) → elbaite (Li-rich, late) series records fluid
  // evolution. T window 350–700°C, optimum 400–600°C. Extremely resistant.

  // Topaz (Al₂SiO₄(F,OH)₂) — F-gated nesosilicate. Imperial topaz at Ouro
  // Preto grew at ~360°C, 3.5 kbar (Morteani 2002). Hard F threshold
  // (20 ppm) below which the structure can't form — delays nucleation
  // until fluorine accumulates. Factors are capped so pegmatite-level
  // Al/SiO₂ (thousands of ppm) doesn't blow sigma into runaway territory.

  // Round 9a — broth-ratio branching pair (rosasite + aurichalcite).
  // First mechanic in the sim where the *ratio* of fluid elements
  // (Cu vs Zn) gates nucleation, not presence/absence. Same parent
  // broth, opposite outcome based on which side dominates.
  // Mirror of vugg.py supersaturation_rosasite / _aurichalcite.


  // Round 9b — anion-competition mechanic (torbernite + zeunerite).
  // Three-branch generalization of 9a's broth-ratio gate: three uranyl
  // minerals compete for the same U⁶⁺ cation, differentiated by which
  // anion (PO₄³⁻/AsO₄³⁻/VO₄³⁻) dominates. 9b ships P + As branches;
  // carnotite (V) joins in 9c. Mirror of vugg.py supersaturation_*.


}

