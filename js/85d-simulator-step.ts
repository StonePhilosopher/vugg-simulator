// ============================================================
// js/85d-simulator-step.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (4): apply_events, dissolve_wall, ambient_cooling, check_nucleation.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

// Proposal A (2026-05, research/RESEARCH-GROWTH-AT-HIGH-FILL.md):
// Continuous sigmoid dampener for nucleation + growth as the vug fills.
//
// Replaces TWO binary cliffs the simulator used to carry:
//
//   * vugFill >= 0.95 → nucleation cap (Backlog K — only fill_exempt
//     minerals could pass)
//   * vugFill >= 1.0  → growth fully stopped, dissolution only
//
// Both cliffs were calibration shortcuts, not geology. The sigmoid
// matches Tenthorey & Cox 1998 (JGR experimental observation: permeability
// falls 10x while porosity stays nearly constant; meaningful flow
// restriction at 80-85% fill, not 95%). At vugFill=0.85 the dampener
// hits 0.5; the 5-95% transition spans vugFill 0.70-1.00.
//
//   vugFill    dampener
//   0.50       0.999
//   0.70       0.953
//   0.80       0.731
//   0.85       0.500
//   0.90       0.269
//   0.95       0.119
//   1.00       0.047
//   1.10       0.007
//   1.20       0.001
//
// Reference dampener curve: 1 / (1 + exp(20 * (vugFill - 0.85))).
// Returns 1.0 (no dampening) below vugFill ~0.7 — most scenarios stay
// here for their entire run, so no RNG-sequence drift for them. Returns
// 0.0 at vugFill ≥ 1.0 — preserves the geometric reality that the
// cavity can't hold more crystal volume than its own bounding sphere.
// Proposal D (later) will replace this floor with an "interlocking
// texture" mode where chemistry continues but produces granular
// densification rather than new outward growth; for Proposal A we
// match the old hard-cliff behavior at the 1.0 boundary while smoothing
// the approach.
//
// fill_exempt minerals (the Backlog K set: borax, mirabilite, thenardite,
// sylvite) bypass the dampener at the NUCLEATION step (via
// _atNucleationCap) but not at the growth step — geologically, an
// efflorescent crust can keep nucleating on existing crystal cover but
// its individual blades are still mass-transport-limited.
function _fillDampenerFor(vugFill: number): number {
  if (vugFill <= 0.7) return 1.0;
  if (vugFill >= 1.0) return 0.0;
  return 1.0 / (1.0 + Math.exp(20 * (vugFill - 0.85)));
}

Object.assign(VugSimulator.prototype, {
  apply_events() {
  for (const event of this.events) {
    if (event.step === this.step) {
      const result = event.apply_fn(this.conditions);
      this.log.push('');
      this.log.push(`  ⚡ EVENT: ${event.name}`);
      this.log.push(`     ${result}`);
      // FLUID-SOURCE SPOTS Phase 2d — open/close feeders when an event declares
      // a `spots` directive. The plumbing changes over the vug's life: a fracture
      // seal shuts the feeders (self-sealing = "the fill is ending"); tectonic
      // uplift / aquifer recharge breaches them back open. Every coupling
      // (2b erosion, 2c.1 origin, 2c.2b clustering) filters on spot.open, so this
      // flip propagates for free. No directive / no spots → no-op (byte-identical).
      if (event.spots && this._fluidSpots && !this._fluidSpots.isEmpty) {
        const dir = (typeof event.spots === 'string') ? { action: event.spots } : event.spots;
        const pred = dir.kind != null ? dir.kind : undefined;
        const toggled = dir.action === 'breach'
          ? this._fluidSpots.breachSpots(pred)
          : dir.action === 'seal'
            ? this._fluidSpots.sealSpots(pred)
            : [];
        if (toggled.length) {
          const verb = dir.action === 'breach' ? 'breached open' : 'sealed shut';
          const kinds = toggled.map(s => s.kind).join(', ');
          this.log.push(`     🔌 ${toggled.length} fluid feeder${toggled.length === 1 ? '' : 's'} ${verb} (${kinds}) — plumbing changed`);
        }
      }
      this.log.push('');
    }
  }
},

  dissolve_wall() {
  const wall = this.conditions.wall;
  // Acid strength = how far below the carbonate-attack threshold pH we
  // are. Negative when pH ≥ 5.5; clipped to 0 inside wall.dissolve().
  const acid_strength = Math.max(0.0, 5.5 - this.conditions.fluid.pH);
  // Skip the call entirely when there's no work to do — neutral fluid
  // AND default reactivity. Avoids logging noise.
  if (acid_strength <= 0.0 && wall.reactivity <= 1.0) return;

  const pre_sigma_cal = this.conditions.supersaturation_calcite();
  const pre_Ca = this.conditions.fluid.Ca;

  const result = wall.dissolve(acid_strength, this.conditions.fluid);

  if (result.dissolved) {
    // Distribute the erosion per-cell. Cells shielded by acid-resistant
    // crystals don't budge, concentrating the attack elsewhere — the
    // vug grows lopsided in whatever direction the deposit left bare.
    const blocked = this._wallCellsBlockedByCrystals();
    // Phase 2b — FEEDER-LOCALIZED erosion (PROPOSAL §10). Open fluid-source spots
    // redistribute the FIXED dissolution budget toward their columns, so the cavity
    // deepens lopsidedly toward its feeders (cracks/geysers/hotspots) instead of as
    // an even sphere. Gated by fluidSpotsDecayEnabled() (default on); null weights
    // (coupling off / no spots / no >1 bonus) → the legacy uniform path, byte-
    // identical. Mass-conserving → chemistry (Ca/CO3 release) unchanged; pure shape.
    const _colW = (fluidSpotsDecayEnabled() && this._fluidSpots && !this._fluidSpots.isEmpty)
      ? this._fluidSpots.columnWeights(this.wall_state.cells_per_ring)
      : null;
    this.wall_state.erodeCells(result.rate_mm, blocked, _colW);
    const post_sigma_cal = this.conditions.supersaturation_calcite();

    this.log.push(`  🧱 WALL DISSOLUTION: ${result.rate_mm.toFixed(2)} mm of ${wall.composition} dissolved`);
    if (blocked.size) {
      this.log.push(`     ${blocked.size} cell${blocked.size === 1 ? '' : 's'} shielded by acid-resistant crystal growth`);
    }
    this.log.push(`     pH ${result.ph_before.toFixed(1)} → ${result.ph_after.toFixed(1)} (carbonate buffering)`);
    this.log.push(`     Released: Ca²⁺ +${result.ca_released.toFixed(0)} ppm, CO₃²⁻ +${result.co3_released.toFixed(0)} ppm, Fe +${result.fe_released.toFixed(1)}, Mn +${result.mn_released.toFixed(1)}`);
    this.log.push(`     Vug diameter: ${result.vug_diameter.toFixed(1)} mm (+${result.total_dissolved.toFixed(1)} mm total enlargement)`);

    if (post_sigma_cal > pre_sigma_cal * 1.3 && post_sigma_cal > 1.0) {
      this.log.push(`     ⚡ SUPERSATURATION SPIKE: σ(Cal) ${pre_sigma_cal.toFixed(2)} → ${post_sigma_cal.toFixed(2)} — rapid calcite growth expected!`);
    }
  }
},

  ambient_cooling(rate = null) {
  // v179: rate resolves wall.cooling_rate (per-scenario knob, default 1.5 —
  // the historical hard-coded value). An explicit argument still wins
  // (legacy callers / tests). RNG-NEUTRAL: the uniform draw happens
  // regardless of the rate value, so unset scenarios are byte-identical.
  if (rate === null || rate === undefined) {
    const wr = this.conditions.wall?.cooling_rate;
    rate = (typeof wr === 'number' && isFinite(wr) && wr >= 0) ? wr : 1.5;
  }
  this.conditions.temperature -= rate * rng.uniform(0.8, 1.2);
  this.conditions.temperature = Math.max(this.conditions.temperature, 25);

  // ---- Thermal pulses: episodic fluid injection ----
  // Real hydrothermal systems don't cool monotonically. Hot fluid pulses
  // arrive through fractures — fast, dramatic, then bleed heat back out.
  // Probability scales with how far we've cooled (more fractures open as
  // rock contracts) and inversely with how hot we still are (already-hot
  // systems don't notice small pulses).
  const cooledFraction = 1 - (this.conditions.temperature - 25) / Math.max(this._startTemp || 400, 100);
  const pulseChance = 0.04 + cooledFraction * 0.06; // 4-10% per step
  // v162 supergene opt-out (LAST && operand so rng.random() is still drawn
  // first — keeps every non-flagged scenario byte-identical). Scenarios that
  // model a near-surface / supergene regime set wall.thermal_pulses:false:
  // there is no magmatic heat source at the surface, so the "hot fluid
  // injection" pulses (which were reheating bisbee's 25°C azurite/malachite
  // cascade toward 350°C) must not fire. See VugWall.thermal_pulses (22).
  const _pulsesOn = (this.conditions.wall?.thermal_pulses !== false);
  if (rng.random() < pulseChance && this.conditions.temperature < (this._startTemp || 400) * 0.8 && _pulsesOn) {
    // Spike: 30-150°C above current, but not above original start temp
    const spike = rng.uniform(30, 150);
    const newTemp = Math.min(this.conditions.temperature + spike, (this._startTemp || 400) * 0.95);
    const actualSpike = newTemp - this.conditions.temperature;
    if (actualSpike > 15) {
      this.conditions.temperature = newTemp;
      // Fresh fluid pulse brings chemistry
      this.conditions.fluid.SiO2 += rng.uniform(50, 300);
      this.conditions.fluid.Fe += rng.uniform(2, 15);
      this.conditions.fluid.Mn += rng.uniform(1, 5);
      this.conditions.flow_rate = rng.uniform(1.5, 3.0);
      // pH shift from new fluid (slightly acidic hydrothermal)
      this.conditions.fluid.pH = Math.max(4.0, this.conditions.fluid.pH - rng.uniform(0.3, 1.0));
      this.log.push(`  🌡️ THERMAL PULSE: +${actualSpike.toFixed(0)}°C — hot fluid injection through fracture! T=${newTemp.toFixed(0)}°C`);
      this.log.push(`     Fresh fluid: SiO₂↑, Fe↑, Mn↑, pH↓ — new growth expected`);
    }
  }

  // pH recovery toward equilibrium — scaled by flow rate.
  // Fresh fluid flushing through the vug dilutes acid and restores
  // pH; a sealed pocket can't exchange fluid, so acidity persists
  // until mineral reactions buffer it. Recovery 0.1/step at
  // flow_rate=1.0, near-zero at flow_rate~0.1 (sealed pocket).
  if (this.conditions.fluid.pH < 6.5) {
    const recovery = 0.1 * Math.min(this.conditions.flow_rate / 1.0, 2.0);
    this.conditions.fluid.pH += recovery;
  }

  if (this.conditions.flow_rate > 1.0) this.conditions.flow_rate *= 0.9;
  const active_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
  if (active_quartz.length) {
    const depletion = active_quartz.reduce((s, c) => s + (c.zones.length ? c.zones[c.zones.length - 1].thickness_um : 0), 0) * 0.1;
    this.conditions.fluid.SiO2 = Math.max(this.conditions.fluid.SiO2 - depletion, 10);
  }

  // Sulfide growth depletes Fe, S, Cu, Zn
  const active_sulfides = this.crystals.filter(c => (c.mineral === 'pyrite' || c.mineral === 'chalcopyrite' || c.mineral === 'sphalerite') && c.active);
  for (const c of active_sulfides) {
    if (c.zones.length) {
      const dep = c.zones[c.zones.length - 1].thickness_um * 0.05;
      this.conditions.fluid.S = Math.max(this.conditions.fluid.S - dep, 0);
      this.conditions.fluid.Fe = Math.max(this.conditions.fluid.Fe - dep * 0.5, 0);
      if (c.mineral === 'chalcopyrite') {
        this.conditions.fluid.Cu = Math.max(this.conditions.fluid.Cu - dep * 0.8, 0);
      }
      if (c.mineral === 'sphalerite') {
        this.conditions.fluid.Zn = Math.max(this.conditions.fluid.Zn - dep * 0.8, 0);
      }
    }
  }
},

  check_nucleation(vugFill) {
  // Proposal A (2026-05): compute the continuous fill dampener and
  // stash it on the simulator for _atNucleationCap and the growth loop
  // to read this step. Replaces the previous binary _fillCapped flag
  // (Backlog K, which itself replaced a hard short-circuit). The
  // dampener helper short-circuits to 1.0 below vugFill=0.7 so most
  // scenarios pay zero cost for this — no RNG-sequence drift in the
  // 18 of 24 scenarios that never approach high fill.
  //
  // Above vugFill ~0.7 the dampener gates nucleation probabilistically
  // inside _atNucleationCap; the 6 high-fill scenarios see the
  // calibration drift documented in the regen baseline.
  this._fillDampener = (vugFill !== undefined) ? _fillDampenerFor(vugFill) : 1.0;
  // Proposal B (2026-05): stash raw vugFill for selectHabitVariant. The
  // fill dampener (sigmoid) is the right input for σ gating; the raw fill
  // is the right input for habit selection (a 0-1 quantity that triggers
  // can match against directly). Undefined for legacy non-step paths.
  this._currentVugFill = vugFill;

  _nucleateClass_amphibole(this);
  _nucleateClass_arsenate(this);
  _nucleateClass_borate(this);
  _nucleateClass_carbonate(this);
  _nucleateClass_halide(this);
  _nucleateClass_hydroxide(this);
  _nucleateClass_molybdate(this);
  _nucleateClass_native(this);
  _nucleateClass_oxide(this);
  _nucleateClass_phosphate(this);
  _nucleateClass_silicate(this);
  _nucleateClass_sulfate(this);
  _nucleateClass_sulfide(this);
},
});
