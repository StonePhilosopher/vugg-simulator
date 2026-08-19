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
  apply_pending_exact_fluid_replacement() {
    const replacement = this.conditions._pending_exact_fluid_replacement;
    delete this.conditions._pending_exact_fluid_replacement;
    if (!replacement) return 0;
    const handles = new Set<any>();
    handles.add(this.conditions.fluid);
    for (const fluid of (this.ring_fluids || [])) handles.add(fluid);
    const grid = this.wall_state?.voxelGridFor?.(this);
    for (const voxel of (grid?.voxels || [])) {
      if (voxel?.fluid) handles.add(voxel.fluid);
    }
    for (const fluid of handles) {
      for (const key of Object.keys(replacement)) fluid[key] = replacement[key];
    }
    this.log.push(`     ⚗ PORE-FLUID REPLACEMENT: ${handles.size} local fluid handles receive the authored replacement fluid`);
    return handles.size;
  },

  apply_events() {
  for (const event of this.events) {
    if (event.step === this.step) {
      const result = event.apply_fn(this.conditions);
      const scenarioState = this.conditions?._scenario;
      if (scenarioState && typeof event.type === 'string' && event.type) {
        const history = Array.isArray(scenarioState.executed_event_types)
          ? scenarioState.executed_event_types : [];
        if (!history.includes(event.type)) history.push(event.type);
        scenarioState.executed_event_types = history;
      }
      this.log.push('');
      this.log.push(`  ⚡ EVENT: ${event.name}`);
      this.log.push(`     ${result}`);
      const stressPulse = this.conditions._pending_stress_pulse;
      if (stressPulse) {
        delete this.conditions._pending_stress_pulse;
        const stressResult = applyDifferentialStressPulse(
          this,
          stressPulse.sigma_diff_mpa,
        );
        this.log.push(`     ⟁ STRESS: ${stressResult.sigma_diff_mpa.toFixed(1)} MPa differential; ${stressResult.twinned.length} existing crystal${stressResult.twinned.length === 1 ? '' : 's'} mechanically twinned; fluid pressure unchanged`);
      }
      // FLUID-SOURCE SPOTS Phase 2d — open/close feeders when an event declares
      // a `spots` directive. The plumbing changes over the vug's life: a fracture
      // seal shuts the feeders (self-sealing = "the fill is ending"); tectonic
      // uplift / aquifer recharge breaches them back open. Every coupling
      // (2b erosion, 2c.1 origin, 2c.2b clustering) filters on spot.open, so this
      // flip propagates for free. No directive / no spots → no-op (byte-identical).
      if (event.spots && this._fluidSpots
          && !_fluidSpotIsEmptyInternal(this._fluidSpots)) {
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
      // POST-GROWTH DEFORMATION (deformation/shear arc 2026-06-20) — an event may
      // carry a `deformation` directive {style,magnitude,minerals}. It records a
      // shear event onto the sim WITH the step it fired (classifyDeformation,
      // post-growth in js/45, then bends crystals that had grown by this step).
      // Chemically inert by design: deformation is MECHANICAL and POST-growth, so
      // apply_fn must not touch fluid/T — the assemblage stays byte-identical.
      if (event.deformation) {
        if (!this._deformationEvents) this._deformationEvents = [];
        const d = event.deformation;
        this._deformationEvents.push({
          step: this.step,
          style: d.style || 'bend',
          magnitude: (typeof d.magnitude === 'number') ? d.magnitude : 0.5,
          minerals: d.minerals || null,
        });
        const ms = d.minerals ? d.minerals.join(', ') : 'all grown crystals';
        this.log.push(`     ⟁ VISUAL DEFORMATION RECONSTRUCTION: ${d.style || 'bend'} on ${ms} — render tag only; no strain-time law is claimed`);
      }
      // PHYSICAL ETCH (SIM 253). The event handler first establishes the
      // undersaturated fluid. Queue the directive until run_step propagates
      // that global boundary delta into every local cell; only then can the
      // evidence-bounded rate law read the chemistry the crystal actually sees.
      if (event.etch) {
        if (!this._etchEvents) this._etchEvents = [];
        const e = event.etch;
        const queued = {
          step: this.step,
          amount: (typeof e.amount === 'number') ? e.amount : 0.5,
          duration_days: (typeof e.duration_days === 'number') ? e.duration_days : undefined,
          minerals: e.minerals || null,
          physical: true,
        };
        this._etchEvents.push(queued);
        (this._pendingPhysicalEtchDirectives ||= []).push(queued);
        const ems = e.minerals ? e.minerals.join(', ') : 'all grown crystals';
        this.log.push(`     ⚗ PHYSICAL ETCH QUEUED: model-derived surface retreat on ${ems} — evaluates after local fluid propagation`);
      }
      // FILM DUSTING (W-F O5 perturbed regrowth) — an event may carry a `film`
      // directive {mineral, prism, term, minerals?}: a foreign film (chlorite,
      // clay) settles on the growth fronts of the crystals alive at this step,
      // masking their FUTURE growth. applyFilmDusting (js/44b) records `_film`
      // per-crystal (deterministic, no RNG, no fluid/T mutation). This is the
      // O5 gate's INPUT; the gate itself (sigmaStarForCoverage in the growth
      // path) is behind O5_MASKING_ENABLED — false in O5a — so a scenario with
      // this directive is byte-identical until O5b flips the flag.
      if (event.film) {
        const f = event.film;
        const dusted = applyFilmDusting(
          this.crystals,
          f.mineral || 'chlorite',
          (typeof f.term === 'number') ? f.term : 0,
          (typeof f.prism === 'number') ? f.prism : 0,
          this.step,
          f.minerals || null,
        );
        const fms = f.minerals ? f.minerals.join(', ') : 'all exposed crystals';
        this.log.push(`     ▓ FILM: ${f.mineral || 'chlorite'} dusts ${fms} (${dusted} crystal${dusted === 1 ? '' : 's'}) — a foreign coat masks the growth front; growth stalls until a fresh pulse clears it`);
      }
      this.log.push('');
    }
  }
},

  apply_pending_physical_etch() {
    const pending = this._pendingPhysicalEtchDirectives || [];
    this._pendingPhysicalEtchDirectives = [];
    for (const directive of pending) {
      const result = applyPhysicalEtchDirective(this, directive, this.step);
      const returned = result.receipts
        .filter((r: any) => r.accepted)
        .flatMap((r: any) => Object.keys(r.returnedInventoryPpm || {}));
      const returnedLabel = [...new Set(returned)].join(', ') || 'none';
      this.log.push(
        `     ⚗ PHYSICAL ETCH: ${result.accepted}/${result.considered} exposed crystals retreated; `
        + `${result.totalAxialLossUm.toFixed(1)} µm axial-equivalent solid removed; `
        + `booked solution return (${returnedLabel})`,
      );
      for (const rejected of result.receipts.filter((r: any) => !r.accepted)) {
        this.log.push(
          `       ↳ ${rejected.mineral} #${rejected.crystalId}: no etch — ${rejected.rejection}`,
        );
      }
    }
  },

  dissolve_wall() {
  const wall = this.conditions.wall;
  if (wall.composition !== 'limestone' && wall.composition !== 'dolomite') return;

  // Everything below is computed from the pre-attack state. Local cell pH,
  // fractional overlapping shielding, and feeder flux are frozen into the
  // exposure receipt before any bulk-fluid buffering occurs.
  const attack = this._wallSurfaceAttackState();
  if (!(attack.attemptedRate > 0) || !(attack.acceptedRate > 0)) return;
  const preSigmaCalcite = this.conditions.supersaturation_calcite();
  const preview = wall.previewDissolve(
    Math.max(0, 5.5 - this.conditions.fluid.pH),
    this.conditions.fluid,
    {
      attempted_rate_mm: attack.attemptedRate,
      accepted_rate_mm: attack.acceptedRate,
      temperature_C: this.conditions.temperature,
      pressure_kbar: this.conditions.pressure,
    },
  );
  if (!preview.dissolved) return;
  const evolutionLedger = this.wall_state.cavityEvolutionLedger();
  if (!evolutionLedger) throw new Error('carbonate dissolution requires a cavity evolution ledger');
  const geometryPlan = evolutionLedger.previewErosion(this.wall_state, attack.mesh, {
    target_volume_delta_mm3_per_kg: preview.target_volume_delta_mm3_per_kg,
    vertex_weights: attack.vertexWeights,
  });
  const result = wall.commitDissolvePreview(preview, this.conditions.fluid, {
    wall_state: this.wall_state,
    geometry_plan: geometryPlan,
    exposure_receipt: attack.receipt,
    step: this.step,
  });

  declareCarbonLedgerAddition(
    this.conditions,
    'wall_release',
    result.formula + ' host dissolution',
    result.co3_released,
  );
  wall.paleo_flow_accum += this.conditions.flow_rate * result.rate_mm;
  wall.paleo_flow_wt += result.rate_mm;
  this.wall_state.paleo_flow = wall.paleoFlow();
  const postSigmaCalcite = this.conditions.supersaturation_calcite();

  this.log.push('  WALL DISSOLUTION: ' + result.rate_mm.toFixed(3)
    + ' mm calibrated reaction-path depth of ' + wall.composition);
  if (attack.blocked.size || attack.receipt.partially_covered_cells) {
    this.log.push('     Shielding: ' + attack.blocked.size + ' fully blocked, '
      + attack.receipt.partially_covered_cells + ' partly covered of '
      + attack.receipt.total_cells + ' wall cells');
  }
  this.log.push('     pH ' + result.ph_before.toFixed(1) + ' -> '
    + result.ph_after.toFixed(1) + ' (empirical carbonate buffering)');
  this.log.push('     Released (' + result.formula + '): Ca2+ +'
    + result.ca_released.toFixed(1) + ' ppm, Mg2+ +' + result.mg_released.toFixed(1)
    + ' ppm, CO3(2-) +' + result.co3_released.toFixed(1) + ' ppm, Fe +'
    + result.fe_released.toFixed(1) + ', Mn +' + result.mn_released.toFixed(1));
  this.log.push('     Cavity capacity +' + result.achieved_volume_delta_mm3_per_kg.toFixed(3)
    + ' mm3 per 1 kg solvent reference (target '
    + result.target_volume_delta_mm3_per_kg.toFixed(3) + ', residual '
    + result.volume_residual_mm3_per_kg.toExponential(2) + '); equivalent diameter '
    + result.vug_diameter.toFixed(3) + ' mm');
  if (postSigmaCalcite > preSigmaCalcite * 1.3 && postSigmaCalcite > 1) {
    this.log.push('     SUPERSATURATION SPIKE: calcite sigma '
      + preSigmaCalcite.toFixed(2) + ' -> ' + postSigmaCalcite.toFixed(2));
  }
},

  ambient_cooling(rate = null) {
  // v179: rate resolves wall.cooling_rate (per-scenario knob, default 1.5 —
  // the historical hard-coded value). An explicit argument still wins
  // (legacy callers / tests).
  //
  // T-RECONCILIATION (2026-06-10, SIM 181): the drift + pulse draws below come
  // from this._thermalRng — a dedicated run-seed-derived stream (85j
  // _makeThermalRng) — NOT the shared `rng`. Statistically the same mechanic
  // (verified in tools/t-reconciliation-probe.mjs: meanT/pulse-count
  // distributions indistinguishable across seeds), but the thermal history no
  // longer displaces the nucleation cascade. DELTA semantics throughout: the
  // drift subtracts and the pulses add to whatever T currently is, so event
  // shoves (70-events ±15..50°C) compose instead of being clobbered — the
  // same-field-movement foot-gun documented at scenarios.json5 (supergene
  // movement note) does not apply here.
  if (rate === null || rate === undefined) {
    const wr = this.conditions.wall?.cooling_rate;
    rate = (typeof wr === 'number' && isFinite(wr) && wr >= 0) ? wr : 1.5;
  }
  // STAND-DOWN (the T-unlock): when a scenario declares a `temperature`
  // movement (85j) whose window is active this step, the declared movement
  // IS the thermal regime — the ambient drift and pulses yield for the
  // window (naica's stable pool, a pegmatite's 650→300 ramp) and resume
  // when it closes. Thermal-stream draws are skipped during the window;
  // that shifts the post-window thermal realization for THAT scenario only
  // (declaring a movement is a per-scenario rebake anyway).
  const _mvOwnsT = !!(this._movements && this._movements.drivesFieldAt
    && this._movements.drivesFieldAt('temperature', this.step));
  // The global conditions object is only the volume-mean view. Preserve the
  // two physically different contributions so _propagateGlobalDelta can cool
  // each local control volume toward ambient without blindly subtracting the
  // bulk delta from cells that are already colder than ambient. A positive
  // fracture-pulse contribution remains genuine heating and is broadcast
  // separately below.
  this._lastAmbientThermalStep = {
    ambientTemperatureC: null,
    coolingDeltaC: 0,
    pulseDeltaC: 0,
    movementOwnsTemperature: _mvOwnsT,
  };
  if (!_mvOwnsT) {
  // Passive conductive loss approaches an authored far-field equilibrium.
  // The old unconditional Math.max(T, 25) was not cooling: it heated every
  // 12-22 C cave/playa/aquifer to room temperature on its first step. Keep
  // the thermal-stream draw unconditional (seed ordering remains stable), but
  // apply it only while the fluid is warmer than its environment. If no
  // environment is authored, 25 C remains the legacy warm-system target.
  const authoredAmbient = this.conditions.wall?.ambient_temperature_C;
  const ambientTemperature = typeof authoredAmbient === 'number' && Number.isFinite(authoredAmbient)
    ? authoredAmbient
    : 25;
  this._lastAmbientThermalStep.ambientTemperatureC = ambientTemperature;
  const coolingIncrement = rate * this._thermalRng.uniform(0.8, 1.2);
  const beforeCooling = this.conditions.temperature;
  if (this.conditions.temperature > ambientTemperature) {
    this.conditions.temperature = Math.max(
      ambientTemperature,
      this.conditions.temperature - coolingIncrement,
    );
  }
  this._lastAmbientThermalStep.coolingDeltaC = this.conditions.temperature - beforeCooling;

  // ---- Thermal pulses: episodic fluid injection ----
  // Real hydrothermal systems don't cool monotonically. Hot fluid pulses
  // arrive through fractures — fast, dramatic, then bleed heat back out.
  // Probability scales with how far we've cooled (more fractures open as
  // rock contracts) and inversely with how hot we still are (already-hot
  // systems don't notice small pulses).
  const coolingSpan = Math.max((this._startTemp || 400) - ambientTemperature, 1);
  const cooledFraction = Math.max(0, Math.min(
    1,
    1 - (this.conditions.temperature - ambientTemperature) / coolingSpan,
  ));
  const pulseChance = 0.04 + cooledFraction * 0.06; // 4-10% per step
  // v162 supergene opt-out (LAST && operand so the chance draw still happens
  // first — keeps the thermal stream's draw pattern uniform). Scenarios that
  // model a near-surface / supergene regime set wall.thermal_pulses:false:
  // there is no magmatic heat source at the surface, so the "hot fluid
  // injection" pulses (which were reheating bisbee's 25°C azurite/malachite
  // cascade toward 350°C) must not fire. See VugWall.thermal_pulses (22).
  const _pulsesOn = (this.conditions.wall?.thermal_pulses !== false);
  if (this._thermalRng.random() < pulseChance && this.conditions.temperature < (this._startTemp || 400) * 0.8 && _pulsesOn) {
    // Spike: 30-150°C above current, but not above original start temp
    const spike = this._thermalRng.uniform(30, 150);
    const newTemp = Math.min(this.conditions.temperature + spike, (this._startTemp || 400) * 0.95);
    const actualSpike = newTemp - this.conditions.temperature;
    if (actualSpike > 15) {
      this.conditions.temperature = newTemp;
      this._lastAmbientThermalStep.pulseDeltaC = actualSpike;
      // Fresh fluid pulse brings chemistry
      const silicaPulse = this._thermalRng.uniform(50, 300);
      if (typeof this.conditions.fluid.addReactiveSilica === 'function') {
        this.conditions.fluid.addReactiveSilica(silicaPulse);
      } else {
        this.conditions.fluid.SiO2 += silicaPulse;
      }
      this.conditions.fluid.Fe += this._thermalRng.uniform(2, 15);
      this.conditions.fluid.Mn += this._thermalRng.uniform(1, 5);
      this.conditions.flow_rate = this._thermalRng.uniform(1.5, 3.0);
      // pH shift from new fluid (slightly acidic hydrothermal)
      this.conditions.fluid.pH = Math.max(4.0, this.conditions.fluid.pH - this._thermalRng.uniform(0.3, 1.0));
      this.log.push(`  🌡️ THERMAL PULSE: +${actualSpike.toFixed(0)}°C — hot fluid injection through fracture! T=${newTemp.toFixed(0)}°C`);
      this.log.push(`     Fresh fluid: SiO₂↑, Fe↑, Mn↑, pH↓ — new growth expected`);
    }
  }
  } // end !_mvOwnsT (ambient drift + pulses)

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
  // Historical fallback only. The canonical accepted-zone mass ledger now
  // debits every mineral after dampening/clamping/time scaling, so repeating
  // these old quartz/sulfide heuristics would consume the same solid twice
  // (and a negative zone would accidentally create a second dissolution
  // credit). Keep the branch solely for developers explicitly disabling the
  // growth-budget feature flag in a diagnostic build.
  if (!STOICHIOMETRIC_GROWTH_BUDGET_ENABLED) {
    const active_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (active_quartz.length) {
      const depletion = active_quartz.reduce((s, c) => s + (c.zones.length ? c.zones[c.zones.length - 1].thickness_um : 0), 0) * 0.1;
      this.conditions.fluid.SiO2 = Math.max(this.conditions.fluid.SiO2 - depletion, 10);
    }

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

  const restoreLocalizedEnvelope = this._installLocalizedNucleationEnvelope?.();
  try {
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
  } finally {
    restoreLocalizedEnvelope?.();
  }
},
});
