// ============================================================
// js/85-simulator.ts — VugSimulator class + small utilities
// ============================================================
// The run-loop class. Mirror of vugg.VugSimulator (Phase A8 of the
// Python refactor would split this further; for now it lives whole).
//
// Reads from VugConditions / FluidChemistry / WallState, dispatches to
// MINERAL_ENGINES per crystal per step, applies events, runs paramorph
// + dehydration transitions, snapshots wall_state for replay.
//
// Includes the tiny UTILITY block (capitalize) that immediately follows
// the class — too small to warrant its own module yet.
//
// Phase B10 of PROPOSAL-MODULAR-REFACTOR.

class VugSimulator {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(conditions, events) {
    this.conditions = conditions;
    this._startTemp = conditions.temperature; // remember initial T for thermal pulse ceiling
    this.events = (events || []).slice().sort((a, b) => a.step - b.step);
    this.crystals = [];
    this.crystal_counter = 0;
    this.step = 0;
    this.log = [];
    // Unwrapped topo-map state. v1 uses ring[0] only; the multi-ring
    // structure is in place so future depth-slice rendering doesn't
    // require reshaping storage. initial_radius_mm is frozen at sim
    // start so later per-cell wall_depth reads as "this slice retreated
    // N mm from where it started."
    const d0 = this.conditions.wall.vug_diameter_mm;
    this.wall_state = new WallState({
      vug_diameter_mm: d0,
      initial_radius_mm: d0 / 2,
      // Phase-1 two-stage bubble-merge void shape. Scenarios set these
      // on VugWall; defaults (3 primary, 6 secondary) give a cohesive
      // main cavity with satellite alcoves so scenarios that don't opt
      // in still get an organic dissolution profile.
      primary_bubbles: this.conditions.wall.primary_bubbles,
      secondary_bubbles: this.conditions.wall.secondary_bubbles,
      shape_seed: this.conditions.wall.shape_seed,
    });
    // Per-step snapshot of ring[0] for the Replay button. Captured at
    // the end of each step; small (~120 cells × ~4 numbers × 100-200
    // steps), so the memory cost of a whole run is trivial.
    this.wall_state_history = [];

    // Phase C of PROPOSAL-3D-SIMULATION: per-ring fluid + temperature.
    // Phase C v1 hooks up: each ring has its own FluidChemistry, the
    // growth loop swaps conditions.fluid to ring_fluids[k] for the
    // engine call, and diffusion at end of step equilibrates them.
    // The "equator" ring (index ring_count/2) is aliased to
    // conditions.fluid so events that mutate conditions.fluid hit
    // the equator's ring_fluids slot, and diffusion then spreads
    // them outward to floor and ceiling rings.
    const nRings = this.wall_state.ring_count;
    const equator = Math.floor(nRings / 2);
    this.ring_fluids = [];
    for (let r = 0; r < nRings; r++) {
      this.ring_fluids.push(_cloneFluid(this.conditions.fluid));
    }
    // Alias the equator ring to conditions.fluid so events propagate.
    this.ring_fluids[equator] = this.conditions.fluid;
    this.ring_temperatures = new Array(nRings).fill(this.conditions.temperature);
    this.inter_ring_diffusion_rate = DEFAULT_INTER_RING_DIFFUSION_RATE;
    // Cache the FluidChemistry numeric field names once for the
    // diffusion loop. Pulled from a fresh instance so any future field
    // additions to FluidChemistry pick up automatically — no separate
    // list to keep in sync. Filtered to numeric fields (the only kind
    // FluidChemistry currently has, but defensive).
    this._fluidFieldNames = Object.keys(new FluidChemistry()).filter(
      k => typeof (new FluidChemistry()[k]) === 'number' && k !== 'concentration'
    );
    // v25 vadose-zone oxidation: track previous fluid_surface_ring so
    // we can detect rings that just transitioned wet → dry. Null at
    // construction means "no surface set yet"; first run_step compares
    // against this and applies the override to whatever rings are
    // currently vadose.
    this._prevFluidSurfaceRing = null;
  }

  // Phase C v1: snapshot conditions.fluid + temperature before a
  // global-mutating block (events, wall dissolution, ambient cooling).
  // Pair with _propagateGlobalDelta to apply the same delta to all
  // non-equator rings. Mirrors VugSimulator._snapshot_global in vugg.py.
  _snapshotGlobal() {
    return [_cloneFluid(this.conditions.fluid), this.conditions.temperature];
  }

  // Phase C v1: apply the delta between current conditions and the
  // pre-block snapshot to all non-equator ring_fluids and
  // ring_temperatures. The equator ring is aliased to conditions.fluid
  // so it already reflects the new value — skip it.
  _propagateGlobalDelta(snap) {
    const [preFluid, preTemp] = snap;
    const equator = Math.floor(this.wall_state.ring_count / 2);
    const equatorFluid = this.ring_fluids[equator];  // = conditions.fluid (aliased)
    for (const fname of this._fluidFieldNames) {
      const delta = this.conditions.fluid[fname] - preFluid[fname];
      if (delta === 0) continue;
      for (const rf of this.ring_fluids) {
        if (rf === equatorFluid) continue;
        rf[fname] = rf[fname] + delta;
      }
    }
    const deltaT = this.conditions.temperature - preTemp;
    if (deltaT !== 0) {
      for (let k = 0; k < this.ring_temperatures.length; k++) {
        if (k === equator) {
          this.ring_temperatures[k] = this.conditions.temperature;
        } else {
          this.ring_temperatures[k] += deltaT;
        }
      }
    }
  }

  // v26: drain `porosity × WATER_LEVEL_DRAIN_RATE` rings per step
  // when the water-level mechanic is active. No-op when
  // fluid_surface_ring is null, porosity is 0 (sealed default), or
  // surface is already at 0. Asymmetric: porosity is a pure sink, not
  // a balance term — refilling stays event-driven. Refill events that
  // snap fluid_surface_ring above ring_count get clamped here on the
  // next step (so events can write a sentinel like 1e6 to mean
  // "fill to ceiling" without needing to know ring_count themselves).
  // Mirror of VugSimulator._apply_water_level_drift in vugg.py.
  _applyWaterLevelDrift() {
    let s = this.conditions.fluid_surface_ring;
    if (s === null || s === undefined) return 0;
    const n = this.wall_state.ring_count;
    if (s > n) {
      this.conditions.fluid_surface_ring = n;
      s = n;
    }
    const p = this.conditions.porosity;
    if (p <= 0 || s <= 0) return 0;
    const delta = -p * WATER_LEVEL_DRAIN_RATE;
    const newS = Math.max(0, s + delta);
    this.conditions.fluid_surface_ring = newS;
    return newS - s;
  }

  // v25: detect rings that just transitioned wet → dry (submerged or
  // meniscus → vadose) and force their fluid to oxidizing chemistry.
  // Submerged rings keep the scenario's chemistry, so the cavity floor
  // stays reducing while the now-exposed ceiling oxidizes — matches
  // real-world supergene paragenesis (galena → cerussite, chalcopyrite
  // → malachite/azurite, pyrite → limonite, all in the air zone).
  // Mirror of VugSimulator._apply_vadose_oxidation_override in vugg.py.
  _applyVadoseOxidationOverride() {
    const n = this.wall_state.ring_count;
    const newSurface = this.conditions.fluid_surface_ring;
    const oldSurface = this._prevFluidSurfaceRing;
    this._prevFluidSurfaceRing = newSurface;
    if (newSurface === null || newSurface === undefined) return [];
    if (oldSurface !== null && oldSurface !== undefined && newSurface >= oldSurface) {
      return [];
    }
    const becameVadose = [];
    for (let r = 0; r < n; r++) {
      const was = VugConditions._classifyWaterState(oldSurface, r, n);
      const now = VugConditions._classifyWaterState(newSurface, r, n);
      if (now === 'vadose' && was !== 'vadose') {
        const rf = this.ring_fluids[r];
        if (rf.O2 < 1.8) rf.O2 = 1.8;
        rf.S *= 0.3;
        // v27 evaporative concentration boost (mirror of vugg.py).
        rf.concentration *= EVAPORATIVE_CONCENTRATION_FACTOR;
        becameVadose.push(r);
      }
    }
    return becameVadose;
  }

  // Phase C inter-ring homogenization. One discrete-Laplacian step per
  // fluid component and per temperature, with Neumann (no-flux)
  // boundary conditions at the floor and ceiling rings.
  //
  // Uniform rings → no-op (Laplacian of a constant is zero), which
  // preserves byte-equality for default scenarios. Non-uniform rings
  // relax the gradient by `rate * (neighbor sum - 2*self)` per step.
  //
  // Old values are read into a snapshot before any writes so each
  // ring's update sees the pre-step state of its neighbors —
  // otherwise ring k+1's update would already see ring k's new value
  // and the diffusion would be asymmetric.
  _diffuseRingState(rate?) {
    if (rate == null) rate = this.inter_ring_diffusion_rate;
    if (!(rate > 0)) return;
    const n = this.ring_fluids.length;
    if (n <= 1) return;
    for (const fname of this._fluidFieldNames) {
      const old = this.ring_fluids.map(rf => rf[fname]);
      for (let k = 0; k < n; k++) {
        const kp = k > 0 ? k - 1 : 0;
        const kn = k < n - 1 ? k + 1 : n - 1;
        this.ring_fluids[k][fname] = old[k] + rate * (old[kp] + old[kn] - 2 * old[k]);
      }
    }
    const oldT = this.ring_temperatures.slice();
    for (let k = 0; k < n; k++) {
      const kp = k > 0 ? k - 1 : 0;
      const kn = k < n - 1 ? k + 1 : n - 1;
      this.ring_temperatures[k] = oldT[k] + rate * (oldT[kp] + oldT[kn] - 2 * oldT[k]);
    }
  }

  nucleate(mineral, position = 'vug wall', sigma = 1.0) {
    this.crystal_counter++;
    const crystal = new Crystal({
      mineral, crystal_id: this.crystal_counter,
      nucleation_step: this.step,
      nucleation_temp: this.conditions.temperature,
      position
    });

    // Pick a growth-vector variant from the spec. Its name sets the habit
    // and its wall_spread/void_reach/vector populate the topo-map
    // footprint. Falls back to legacy defaults below if the mineral has
    // no variant objects in the spec.
    const variant = selectHabitVariant(
      mineral, sigma, this.conditions.temperature, this._spaceIsCrowded()
    );
    if (variant) {
      crystal.habit = variant.name || crystal.habit;
      crystal.wall_spread = Number(variant.wall_spread ?? 0.5);
      crystal.void_reach = Number(variant.void_reach ?? 0.5);
      crystal.vector = variant.vector || 'equant';
    }

    // Anchor on the wall. Crystals that nucleated on another crystal
    // (position "on <mineral> #<id>") inherit the host's cell + ring
    // so pseudomorphs/overgrowths paint alongside it. Free-wall
    // nucleations get a random ring (Phase C v1: scatter across the
    // sphere wall; Phase D will weight by orientation).
    crystal.wall_center_cell = this._assignWallCell(position);
    crystal.wall_ring_index = this._assignWallRing(position, mineral);

    // v24 water-level: stamp growth_environment from the ring's
    // water state. Submerged or meniscus = wet = 'fluid'; vadose
    // (above the meniscus) = 'air'. Mirrors vugg.py.
    {
      const wstate = this.conditions.ringWaterState(
        crystal.wall_ring_index, this.wall_state.ring_count);
      crystal.growth_environment = (wstate === 'vadose') ? 'air' : 'fluid';
    }

    // Dominant-form strings describe crystallographic faces and aren't
    // governed by the habit variant; keep per-mineral defaults.
    if (mineral === 'quartz') {
      crystal.dominant_forms = ['m{100} prism', 'r{101} rhombohedron'];
    } else if (mineral === 'calcite') {
      crystal.dominant_forms = ['e{104} rhombohedron'];
    } else if (mineral === 'aragonite') {
      crystal.dominant_forms = ['columnar prisms', '{110} cyclic twin (six-pointed)'];
    } else if (mineral === 'rhodochrosite') {
      crystal.dominant_forms = ["e{104} curved 'button' rhombohedron", 'rose-pink'];
    } else if (mineral === 'siderite') {
      crystal.dominant_forms = ["e{104} curved 'saddle' rhombohedron", 'tan to brown'];
    } else if (mineral === 'dolomite') {
      crystal.dominant_forms = ['e{104} saddle-shaped curved rhombohedron', 'white to colorless'];
    } else if (mineral === 'sphalerite') {
      crystal.dominant_forms = ['{111} tetrahedron'];
    } else if (mineral === 'wurtzite') {
      crystal.dominant_forms = ['hemimorphic hexagonal pyramid', '{0001} + {101̄1}'];
    } else if (mineral === 'fluorite') {
      crystal.dominant_forms = ['{100} cube'];
    } else if (mineral === 'pyrite') {
      crystal.dominant_forms = ['{100} cube'];
    } else if (mineral === 'marcasite') {
      crystal.dominant_forms = ['cockscomb aggregate', '{010} tabular crests'];
    } else if (mineral === 'chalcopyrite') {
      crystal.dominant_forms = ['{112} disphenoid'];
    } else if (mineral === 'hematite') {
      crystal.dominant_forms = ['{001} basal plates'];
    } else if (mineral === 'malachite') {
      crystal.dominant_forms = ['botryoidal masses'];
    } else if (mineral === 'uraninite') {
      crystal.dominant_forms = ['{100} cube', '{111} octahedron'];
    } else if (mineral === 'galena') {
      crystal.dominant_forms = ['{100} cube', '{111} octahedron'];
    } else if (mineral === 'selenite') {
      crystal.dominant_forms = ['{010} blades', '{110} prism'];
    } else if (mineral === 'halite') {
      crystal.dominant_forms = ['{100} cube', 'hopper-growth pyramidal hollows'];
    } else if (mineral === 'borax') {
      crystal.dominant_forms = ['{100} pinacoid', '{110} monoclinic prism', 'vitreous to resinous luster'];
    } else if (mineral === 'tincalconite') {
      crystal.dominant_forms = ['paramorph after borax', 'white powdery crust'];
    } else if (mineral === 'mirabilite') {
      crystal.dominant_forms = ['{010} pinacoid', '{110} monoclinic prism', 'Glauber salt'];
    } else if (mineral === 'thenardite') {
      crystal.dominant_forms = ['orthorhombic dipyramid', '{111} dominant', '{010} pinacoid'];
    } else if (mineral === 'feldspar') {
      crystal.dominant_forms = ['{010} pinacoid', '{110} prism'];
    } else if (mineral === 'topaz') {
      crystal.dominant_forms = ['m{110} prism', 'y{041} pyramid', 'c{001} basal cleavage'];
    } else if (mineral === 'tourmaline') {
      crystal.dominant_forms = ['m{10̄10} trigonal prism', 'striated faces', 'slightly rounded triangular cross-section'];
    } else if (mineral === 'beryl' || mineral === 'emerald' || mineral === 'aquamarine' || mineral === 'morganite' || mineral === 'heliodor') {
      crystal.dominant_forms = ['m{10̄10} hex prism', 'c{0001} flat basal pinacoid'];
    } else if (mineral === 'corundum' || mineral === 'ruby' || mineral === 'sapphire') {
      crystal.dominant_forms = ['c{0001} flat basal pinacoid', 'n{22̄43} steep dipyramid', 'hexagonal prism or barrel'];
    } else if (mineral === 'spodumene') {
      crystal.dominant_forms = ['m{110} prism', 'a{100} + b{010} pinacoids', '~87° pyroxene cleavages'];
    } else if (mineral === 'anglesite') {
      crystal.dominant_forms = ['b{010} pinacoid', 'm{110} prism', 'o{011} orthorhombic dome'];
    } else if (mineral === 'cerussite') {
      crystal.dominant_forms = ['b{010} pinacoid', 'm{110} prism', 'pseudo-hexagonal if twinned'];
    } else if (mineral === 'pyromorphite') {
      crystal.dominant_forms = ['{10̄10} hexagonal prism', 'c{0001} pinacoid', 'barrel profile'];
    } else if (mineral === 'vanadinite') {
      crystal.dominant_forms = ['{10̄10} hexagonal prism', 'c{0001} pinacoid', 'flat basal termination'];
    } else if (mineral === 'erythrite') {
      crystal.dominant_forms = ['earthy crimson-pink crust', 'cobalt bloom'];
    } else if (mineral === 'annabergite') {
      crystal.dominant_forms = ['apple-green earthy crust', 'nickel bloom'];
    } else if (mineral === 'tetrahedrite') {
      crystal.dominant_forms = ['{111} tetrahedron', 'steel-gray metallic'];
    } else if (mineral === 'tennantite') {
      crystal.dominant_forms = ['{111} tetrahedron', 'gray-black metallic with cherry-red transmission'];
    } else if (mineral === 'apophyllite') {
      crystal.dominant_forms = ['pseudo-cubic tabular {001} + {110}', 'transparent to pearly'];
    } else if (mineral === 'bornite') {
      crystal.dominant_forms = ['massive granular', 'iridescent tarnish'];
    } else if (mineral === 'chalcocite') {
      crystal.dominant_forms = ['{110} prism', 'pseudo-hexagonal if twinned'];
    } else if (mineral === 'covellite') {
      crystal.dominant_forms = ['{0001} basal plate', 'perfect basal cleavage'];
    } else if (mineral === 'cuprite') {
      crystal.dominant_forms = ['{111} octahedron', 'dark red with ruby internal reflections'];
    } else if (mineral === 'azurite') {
      crystal.dominant_forms = ['monoclinic prism', 'deep azure-blue'];
    } else if (mineral === 'chrysocolla') {
      crystal.dominant_forms = ['botryoidal crust', 'cyan-blue cryptocrystalline enamel'];
    } else if (mineral === 'native_copper') {
      crystal.dominant_forms = ['arborescent branching', 'copper-red metallic'];
    } else if (mineral === 'magnetite') {
      crystal.dominant_forms = ['{111} octahedron', 'black metallic, strongly magnetic'];
    } else if (mineral === 'lepidocrocite') {
      crystal.dominant_forms = ['{010} platy scales', 'ruby-red micaceous'];
    } else if (mineral === 'stibnite') {
      crystal.dominant_forms = ['elongated {110} prism', 'lead-gray sword-blade'];
    } else if (mineral === 'bismuthinite') {
      crystal.dominant_forms = ['acicular {110} needle', 'lead-gray metallic'];
    } else if (mineral === 'native_bismuth') {
      crystal.dominant_forms = ['arborescent silver-white', 'iridescent oxide tarnish'];
    } else if (mineral === 'clinobisvanite') {
      crystal.dominant_forms = ['micro-platy {010}', 'bright yellow'];
    }

    // Twin roll — once at nucleation per declared twin_laws (Round 9
    // bug fix Apr 2026). Pre-fix, each grow_*() function rolled per
    // growth step, giving ~92% twinning rate after 30 zones at p=0.1.
    // Post-fix the roll happens once here per twin_law in
    // data/minerals.json, matching declared probability semantics.
    this._rollSpontaneousTwin(crystal);

    this.crystals.push(crystal);
    return crystal;
  }

  _rollSpontaneousTwin(crystal) {
    // Mirror of vugg.py VugSimulator._roll_spontaneous_twin.
    // Triggers containing 'thermal_shock' or 'tectonic' are skipped —
    // those remain in their grow functions as event-conditional logic
    // (currently only quartz Dauphiné). First law to fire wins; later
    // laws of the same mineral don't compound onto an already-twinned
    // crystal.
    if (crystal.twinned) return;
    const spec = MINERAL_SPEC[crystal.mineral];
    if (!spec) return;
    const twinLaws = spec.twin_laws || [];
    for (const law of twinLaws) {
      if (!law || typeof law !== 'object') continue;
      const prob = law.probability;
      if (typeof prob !== 'number' || prob <= 0) continue;
      const trigger = (law.trigger || '').toLowerCase();
      if (trigger.includes('thermal_shock') || trigger.includes('tectonic')) continue;
      if (rng.random() < prob) {
        crystal.twinned = true;
        crystal.twin_law = law.name || 'twin';
        return;
      }
    }
  }

  _spaceIsCrowded() {
    // Fraction of ring-0 cells already claimed. Habit selection uses
    // this to penalize projecting variants when the vug is filling up.
    const ring0 = this.wall_state?.rings?.[0];
    if (!ring0 || !ring0.length) return false;
    const occupied = ring0.reduce((n, c) => n + (c.crystal_id != null ? 1 : 0), 0);
    return (occupied / ring0.length) >= 0.5;
  }

  _atNucleationCap(mineral) {
    // True if the mineral has hit its spec max_nucleation_count for
    // crystals *still exposed on the wall* — enclosed and dissolved
    // crystals don't count toward the cap because the surface they
    // held is effectively gone (buried by the host, or etched away).
    //
    // This is what lets a classic MVT calcite accumulate dense
    // chalcopyrite inclusion trails: the sulfide nucleates, grows a
    // little, gets enveloped, and fresh bare wall from the host's
    // advancing front becomes available for another sulfide to
    // nucleate. Real specimens can carry hundreds of inclusions.
    const cap = MINERAL_SPEC[mineral]?.max_nucleation_count;
    if (cap == null) return false;
    let n = 0;
    for (const c of this.crystals) {
      if (c.mineral !== mineral) continue;
      if (c.enclosed_by != null || c.dissolved) continue;
      n++;
      if (n >= cap) return true;
    }
    return false;
  }

  _assignWallCell(position) {
    // Host-substrate overgrowths inherit the host's cell; free-wall
    // nucleations claim a random empty cell (or a random cell at all
    // if the wall is full — overlaps paint the larger crystal on top).
    let hostId = null;
    const hashIdx = position.indexOf(' #');
    if (hashIdx >= 0) {
      const num = parseInt(position.slice(hashIdx + 2), 10);
      if (!Number.isNaN(num)) hostId = num;
    }
    if (hostId != null) {
      const host = this.crystals.find(c => c.crystal_id === hostId);
      if (host && host.wall_center_cell != null) return host.wall_center_cell;
    }
    const N = this.wall_state.cells_per_ring;
    const ring0 = this.wall_state.rings[0];
    const empty = [];
    for (let i = 0; i < ring0.length; i++) {
      if (ring0[i].crystal_id == null) empty.push(i);
    }
    if (empty.length) return empty[Math.floor(rng.random() * empty.length)];
    return Math.floor(rng.random() * N);
  }

  // Phase C v1: run a mineral growth engine for a crystal, swapping
  // conditions.fluid + temperature to the crystal's ring's values
  // for the duration of the call. Engines never see ring_fluids
  // directly — they observe "the fluid" via conditions, the same
  // interface as before. Mass-balance side effects (consumption,
  // byproduct release) hit ring_fluids[k] because that's the object
  // swapped in. Restore globals afterward so subsequent code (events,
  // narrators, log) sees the bulk-fluid view. Mirrors the equivalent
  // try/finally block in VugSimulator.run_step (vugg.py).
  _runEngineForCrystal(engine, crystal) {
    const ringIdx = crystal.wall_ring_index;
    let savedFluid = null;
    let savedTemp = null;
    if (ringIdx != null && ringIdx >= 0 && ringIdx < this.ring_fluids.length) {
      savedFluid = this.conditions.fluid;
      savedTemp = this.conditions.temperature;
      this.conditions.fluid = this.ring_fluids[ringIdx];
      this.conditions.temperature = this.ring_temperatures[ringIdx];
    }
    try {
      return engine(crystal, this.conditions, this.step);
    } finally {
      if (savedFluid != null) {
        this.conditions.fluid = savedFluid;
      }
      if (savedTemp != null) {
        this.ring_temperatures[ringIdx] = this.conditions.temperature;
        this.conditions.temperature = savedTemp;
      }
    }
  }

  // Phase C v1: pick a ring for a nucleating crystal. Host-substrate
  // overgrowths inherit the host's ring (so pseudomorphs land on
  // the same latitude); free-wall nucleations get a random ring.
  // Phase D v2: per-mineral orientation bias (see ORIENTATION_PREFERENCE
  // module-level table). Spatially neutral minerals stay area-weighted.
  // Mirrors VugSimulator._assign_wall_ring in vugg.py.
  _assignWallRing(position, mineral) {
    let hostId = null;
    const hashIdx = position.indexOf(' #');
    if (hashIdx >= 0) {
      const num = parseInt(position.slice(hashIdx + 2), 10);
      if (!Number.isNaN(num)) hostId = num;
    }
    if (hostId != null) {
      const host = this.crystals.find(c => c.crystal_id === hostId);
      if (host && host.wall_ring_index != null) return host.wall_ring_index;
    }
    // Phase D: area-weighted sample (equator gets more nucleations
    // than polar caps). Always consumes one RNG number so parity
    // holds across ring counts. Mirrors VugSimulator._assign_wall_ring
    // in vugg.py — same algorithm so both runtimes pick the same
    // ring for the same RNG state.
    const n = Math.max(1, this.wall_state.ring_count);
    const weights = [];
    let total = 0;
    for (let k = 0; k < n; k++) {
      const w = this.wall_state.ringAreaWeight(k);
      weights.push(w);
      total += w;
    }
    // Phase D v2: per-mineral preferred-orientation bias.
    const pref = mineral ? ORIENTATION_PREFERENCE[mineral] : null;
    if (pref && n > 1) {
      const [target, strength] = pref;
      total = 0;
      for (let k = 0; k < n; k++) {
        if (this.wall_state.ringOrientation(k) === target) weights[k] *= strength;
        total += weights[k];
      }
    }
    // v27: per-mineral water-state bias for evaporite minerals.
    // Mirror of _assign_wall_ring in vugg.py.
    const wpref = mineral ? WATER_STATE_PREFERENCE[mineral] : null;
    if (wpref && n > 1) {
      const [targetState, strength] = wpref;
      total = 0;
      for (let k = 0; k < n; k++) {
        if (this.conditions.ringWaterState(k, n) === targetState) weights[k] *= strength;
        total += weights[k];
      }
    }
    if (total <= 0) total = 1;
    let r = rng.random() * total;
    for (let k = 0; k < n; k++) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return n - 1;
  }

  _repaintWallState() {
    // Rebuild ring-0 occupancy from the crystal list. Cheap (~120 × ~20)
    // and keeps per-cell thickness consistent with dissolution / enclosure.
    this.wall_state.updateDiameter(this.conditions.wall.vug_diameter_mm);
    this.wall_state.clear();
    // Paint smallest-first so biggest crystals win overlaps — that's
    // what a viewer would see from outside the vug.
    const sorted = [...this.crystals].sort((a, b) => a.total_growth_um - b.total_growth_um);
    for (const crystal of sorted) {
      if (crystal.dissolved) continue;
      this.wall_state.paintCrystal(crystal);
    }
    // Snapshot ring[0] for the Replay button. Shallow clone of each
    // cell's render-relevant fields — including base_radius_mm so the
    // Phase-1 Fourier profile is preserved across replay frames.
    const snap = new Array(this.wall_state.rings[0].length);
    for (let i = 0; i < snap.length; i++) {
      const c = this.wall_state.rings[0][i];
      snap[i] = {
        wall_depth: c.wall_depth,
        crystal_id: c.crystal_id,
        mineral: c.mineral,
        thickness_um: c.thickness_um,
        base_radius_mm: c.base_radius_mm,
      };
    }
    this.wall_state_history.push(snap);
  }

  _wallCellsBlockedByCrystals() {
    // Which ring-0 cells are shielded from wall dissolution. A cell
    // blocks when it holds a non-dissolved crystal whose mineral is
    // stable at the current pH — either permanently acid-stable
    // (acid_dissolution == null, e.g. uraninite/molybdenite) or the
    // current pH is above its threshold.
    const ph = this.conditions.fluid.pH;
    const byId = new Map<number, any>(this.crystals.map(c => [c.crystal_id, c]));
    const blocked = new Set();
    const ring0 = this.wall_state.rings[0];
    for (let i = 0; i < ring0.length; i++) {
      const cell = ring0[i];
      if (cell.crystal_id == null) continue;
      const crystal = byId.get(cell.crystal_id);
      if (!crystal || crystal.dissolved) continue;
      const acid = MINERAL_SPEC[crystal.mineral]?.acid_dissolution;
      if (acid == null) { blocked.add(i); continue; }
      const threshold = acid.pH_threshold;
      if (threshold == null || ph >= threshold) blocked.add(i);
    }
    return blocked;
  }

  get_vug_fill() {
    const vugR = this.conditions.wall.vug_diameter_mm / 2;
    const vugVol = (4 / 3) * Math.PI * Math.pow(vugR, 3);
    if (vugVol <= 0) return 0;
    let crystalVol = 0;
    for (const c of this.crystals) {
      if (!c.active) continue;
      const a = c.c_length_mm / 2;
      const b = c.a_width_mm / 2;
      crystalVol += (4 / 3) * Math.PI * a * b * b;
    }
    return crystalVol / vugVol;
  }

  check_nucleation(vugFill) {
    // No new crystals if vug is full
    if (vugFill !== undefined && vugFill >= 0.95) return;

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
  }

  apply_events() {
    for (const event of this.events) {
      if (event.step === this.step) {
        const result = event.apply_fn(this.conditions);
        this.log.push('');
        this.log.push(`  ⚡ EVENT: ${event.name}`);
        this.log.push(`     ${result}`);
        this.log.push('');
      }
    }
  }

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
      this.wall_state.erodeCells(result.rate_mm, blocked);
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
  }

  ambient_cooling(rate = 1.5) {
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
    if (rng.random() < pulseChance && this.conditions.temperature < (this._startTemp || 400) * 0.8) {
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
  }

  run_step() {
    this.log = [];
    this.step++;
    // Phase C v1: events apply to conditions.fluid (= equator ring
    // fluid via aliasing). Snapshot before and propagate the delta to
    // non-equator rings — otherwise a global event pulse never reaches
    // the rings where crystals are actually growing. Same wrap on
    // dissolve_wall and ambient_cooling. Mirrors vugg.py.
    let snap = this._snapshotGlobal();
    this.apply_events();
    this._propagateGlobalDelta(snap);
    // v26: continuous drainage from host-rock porosity. Runs before
    // the vadose override so a porosity-driven drift-out gets caught
    // as a transition on the same step it dries.
    this._applyWaterLevelDrift();
    // v25: events may have dropped fluid_surface_ring. Detect rings
    // that just transitioned wet → vadose and force their fluid to
    // oxidizing chemistry. Lets the existing supergene-oxidation
    // engines fire naturally in the air-exposed rings while the floor
    // stays reducing.
    const newlyVadose = this._applyVadoseOxidationOverride();
    if (newlyVadose.length) {
      this.log.push(
        `  ☁ Vadose oxidation: rings ${newlyVadose.join(',')} now exposed `
        + `to air — O₂ rises, sulfides become unstable`);
    }
    // Track dolomite saturation crossings for the Kim 2023 cycle mechanism.
    this.conditions.update_dol_cycles();
    snap = this._snapshotGlobal();
    this.dissolve_wall();
    this._propagateGlobalDelta(snap);

    // Calculate vug fill percentage — stop growth when full
    const vugFill = this.get_vug_fill();

    if (vugFill >= 1.0 && !this._vug_sealed) {
      this._vug_sealed = true;
      // Determine dominant mineral
      const mineralVols: Record<string, number> = {};
      for (const c of this.crystals) {
        if (!c.active) continue;
        const a = c.c_length_mm / 2, b = c.a_width_mm / 2;
        const v = (4/3) * Math.PI * a * b * b;
        mineralVols[c.mineral] = (mineralVols[c.mineral] || 0) + v;
      }
      const sorted = Object.entries(mineralVols).sort((a,b) => b[1] - a[1]);
      const dominant = sorted[0] ? sorted[0][0] : 'mineral';
      let sealMsg = `🪨 VUG SEALED — cavity completely filled after ${this.step} steps`;
      if (dominant === 'quartz' && sorted[0][1] / Object.values(mineralVols).reduce((a,b)=>a+b,0) > 0.8) {
        sealMsg += ` — AGATE (>80% quartz)`;
      } else if (sorted.length > 1) {
        sealMsg += ` — dominant: ${dominant}, with ${sorted.slice(1).map(s=>s[0]).join(', ')}`;
      }
      this.log.push(sealMsg);
    }

    this.check_nucleation(vugFill);
    let currentFill = vugFill; // Track fill dynamically during growth loop
    for (const crystal of this.crystals) {
      if (!crystal.active) continue;
      // If vug is full, no more growth (dissolution still allowed)
      if (currentFill >= 1.0) {
        // Still allow dissolution (negative zones)
        const engine = MINERAL_ENGINES[crystal.mineral];
        if (!engine) continue;
        const zone = this._runEngineForCrystal(engine, crystal);
        if (zone && zone.thickness_um < 0) {
          crystal.add_zone(zone);
          currentFill = this.get_vug_fill(); // Update after dissolution
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        }
        continue;
      }
      // Universal max-size cap — 2× world record per MINERAL_SPEC.
      // Closes the 321,248% runaway growth bug.
      const capCm = maxSizeCm(crystal.mineral);
      if (capCm != null && crystal.c_length_mm / 10.0 >= capCm) {
        crystal.active = false;
        this.log.push(`  ⛔ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: reached size cap (${capCm} cm = 2× world record) — growth halts`);
        continue;
      }
      const engine = MINERAL_ENGINES[crystal.mineral];
      if (!engine) continue;
      const zone = this._runEngineForCrystal(engine, crystal);
      if (zone) {
        crystal.add_zone(zone);
        // Re-check fill after each crystal grows to prevent >100% overshoot
        if (zone.thickness_um > 0) {
          currentFill = this.get_vug_fill();
        }
        if (zone.thickness_um < 0) {
          currentFill = this.get_vug_fill();
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        } else if (Math.abs(zone.thickness_um) > 0.5) {
          this.log.push(`  ▲ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: ${crystal.describe_latest_zone()}`);
        }
      }
    }

    // Paramorph transitions — convert crystals whose host fluid has cooled
    // past their phase-transition T (Round 8a-2: argentite → acanthite at
    // 173°C). Preserves habit + dominant_forms + zones; only crystal.mineral
    // changes. First non-destructive polymorph mechanic in the sim.
    for (const crystal of this.crystals) {
      const transition = applyParamorphTransitions(crystal, this.conditions.temperature, this.step);
      if (transition) {
        const [oldM, newM] = transition;
        this.log.push(
          `  ↻ PARAMORPH: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
          `(T dropped to ${this.conditions.temperature.toFixed(0)}°C, crossed ${oldM}/${newM} ` +
          `phase boundary; cubic external form preserved)`
        );
      }
    }

    // v28: dehydration paramorphs — environment-triggered counterpart
    // to PARAMORPH_TRANSITIONS. Borax left in a vadose ring loses
    // water and pseudomorphs to tincalconite. Mirror of vugg.py.
    {
      const nRings = this.wall_state.ring_count;
      for (const crystal of this.crystals) {
        if (!DEHYDRATION_TRANSITIONS[crystal.mineral]) continue;
        const ringIdx = crystal.wall_ring_index;
        if (ringIdx == null || ringIdx < 0 || ringIdx >= nRings) continue;
        const ringFluid = this.ring_fluids[ringIdx];
        const ringState = this.conditions.ringWaterState(ringIdx, nRings);
        const Tlocal = this.ring_temperatures[ringIdx];
        const transition = applyDehydrationTransitions(
          crystal, ringFluid, ringState, Tlocal, this.step);
        if (transition) {
          const [oldM, newM] = transition;
          this.log.push(
            `  ☼ DEHYDRATION: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
            `(vadose exposure ${crystal.dry_exposure_steps} steps, ring ${ringIdx} ` +
            `concentration=${ringFluid.concentration.toFixed(1)}); external ` +
            `crystal form preserved as a ${newM} pseudomorph`
          );
        }
      }
    }

    // Water-solubility metastability — Round 8e (Apr 2026). Chalcanthite
    // re-dissolves when fluid.salinity < 4 OR fluid.pH > 5. The geological
    // truth: every chalcanthite is a temporary victory over entropy.
    for (const crystal of this.crystals) {
      if (crystal.mineral !== 'chalcanthite' || crystal.dissolved || !crystal.active) continue;
      if (this.conditions.fluid.salinity < 4.0 || this.conditions.fluid.pH > 5.0) {
        // 40%/step decay, with a 0.5-µm absolute floor below which we
        // collapse to full dissolution (asymptotic decay otherwise).
        let dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.4);
        if (crystal.total_growth_um < 0.5) dissolved_um = crystal.total_growth_um;
        crystal.total_growth_um -= dissolved_um;
        crystal.c_length_mm = Math.max(crystal.total_growth_um / 1000.0, 0);
        this.conditions.fluid.Cu += dissolved_um * 0.5;
        this.conditions.fluid.S += dissolved_um * 0.5;
        if (crystal.total_growth_um <= 0) {
          crystal.dissolved = true;
          crystal.active = false;
          this.log.push(
            `  💧 RE-DISSOLVED: Chalcanthite #${crystal.crystal_id} ` +
            `completely returned to solution (salinity=${this.conditions.fluid.salinity.toFixed(1)}, ` +
            `pH=${this.conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + SO₄²⁻ back in fluid`
          );
        } else {
          this.log.push(
            `  💧 Chalcanthite #${crystal.crystal_id}: re-dissolving ` +
            `(${dissolved_um.toFixed(1)} µm lost; salinity=${this.conditions.fluid.salinity.toFixed(1)}, ` +
            `pH=${this.conditions.fluid.pH.toFixed(1)})`
          );
        }
      }
    }

    // Check for vug seal after growth loop (may cross 1.0 during crystal growth)
    if (currentFill >= 1.0 && !this._vug_sealed) {
      this._vug_sealed = true;
      const mineralVols: Record<string, number> = {};
      for (const c of this.crystals) {
        if (!c.active) continue;
        const a = c.c_length_mm / 2, b = c.a_width_mm / 2;
        const v = (4/3) * Math.PI * a * b * b;
        mineralVols[c.mineral] = (mineralVols[c.mineral] || 0) + v;
      }
      const sorted = Object.entries(mineralVols).sort((a,b) => b[1] - a[1]);
      const dominant = sorted[0] ? sorted[0][0] : 'mineral';
      let sealMsg = `🪨 VUG SEALED — cavity completely filled after ${this.step} steps`;
      if (dominant === 'quartz' && sorted[0][1] / Object.values(mineralVols).reduce((a,b)=>a+b,0) > 0.8) {
        sealMsg += ` — AGATE (>80% quartz)`;
      } else if (sorted.length > 1) {
        sealMsg += ` — dominant: ${dominant}, with ${sorted.slice(1).map(s=>s[0]).join(', ')}`;
      }
      this.log.push(sealMsg);
    }
    // ---- Radiation damage processing ----
    const active_uraninite = this.crystals.filter(c => c.mineral === 'uraninite' && c.active);
    if (active_uraninite.length) {
      if (!this.radiation_dose) this.radiation_dose = 0;
      if (!this._smoky_logged) this._smoky_logged = false;
      if (!this._metamict_logged) this._metamict_logged = false;

      for (const u_crystal of active_uraninite) {
        const u_size = u_crystal.c_length_mm;
        // Uraninite produces Pb into fluid via radioactive decay
        this.conditions.fluid.Pb += 0.1 * u_size;
        this.radiation_dose += 0.01 * u_size;

        // Radiation damages all OTHER crystals
        for (const other of this.crystals) {
          if (other === u_crystal || !other.active) continue;
          if (!other.radiation_damage) other.radiation_damage = 0;
          other.radiation_damage += 0.02 * u_size;

          // Smoky quartz check
          if (other.mineral === 'quartz' && other.radiation_damage > 0.3 && !this._smoky_logged) {
            this.log.push(`  ☢️ Quartz #${other.crystal_id} is turning smoky — radiation damage from nearby uraninite is displacing Al³⁺ in the lattice, creating color centers`);
            this._smoky_logged = true;
          }

          // Metamictization check
          if (other.radiation_damage > 0.8 && !this._metamict_logged) {
            this.log.push(`  ☢️ ${capitalize(other.mineral)} #${other.crystal_id} is becoming metamict — alpha radiation is destroying the crystal lattice`);
            this._metamict_logged = true;
          }
        }
      }
    }

    // Enclosure / liberation — bigger crystals swallow adjacent smaller
    // ones; dissolving hosts can free what they held.
    this._check_enclosure();
    this._check_liberation();

    // Refresh the topo-map wall state from the current crystal list.
    this._repaintWallState();

    // Ambient cooling — propagate the temperature drop to all rings
    // so non-equator rings cool too.
    {
      const coolSnap = this._snapshotGlobal();
      this.ambient_cooling();
      this._propagateGlobalDelta(coolSnap);
    }

    // Phase C: inter-ring fluid/temperature diffusion runs at the
    // very end of the step so chemistry exchanges happen against a
    // stable post-events post-growth state. No-op when all rings
    // carry identical values (Laplacian of a constant is zero) —
    // this preserves byte-equality for default scenarios.
    this._diffuseRingState();

    return this.log;
  }

  // When a big crystal grows past an adjacent smaller one that's stopped
  // growing, the smaller crystal becomes an inclusion inside the bigger
  // one. Classic "Sweetwater mechanism" — pyrite first, then calcite
  // grows around it. Ports check_enclosure from vugg.py 1:1.
  _check_enclosure() {
    for (const grower of this.crystals) {
      if (!grower.active || grower.c_length_mm < 0.5) continue;
      if (grower.enclosed_by != null) continue;
      for (const candidate of this.crystals) {
        if (candidate.crystal_id === grower.crystal_id) continue;
        if (candidate.enclosed_by != null) continue;
        if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;

        const sizeRatio = grower.c_length_mm / Math.max(candidate.c_length_mm, 0.001);
        const adjacent = (
          candidate.position === grower.position
          || candidate.position.includes(`#${grower.crystal_id}`)
        );
        // Require the candidate to have actually lived a bit before it
        // can be swallowed. Without this, a just-nucleated crystal with
        // zero zones qualifies on step 1 and gets enveloped before it
        // grows a single face — 600 inclusions pile up in a loop of
        // nucleate-then-instantly-enclose. Real Sweetwater-style
        // pyrite needs time to exhaust its chemistry and stop growing
        // before the calcite takes it.
        if (!candidate.zones || candidate.zones.length < 3) continue;
        const recent = candidate.zones.slice(-3).reduce((s, z) => s + z.thickness_um, 0);
        const slowing = recent < 3.0;
        if (sizeRatio > 3.0 && adjacent && slowing) {
          grower.enclosed_crystals.push(candidate.crystal_id);
          grower.enclosed_at_step.push(this.step);
          candidate.enclosed_by = grower.crystal_id;
          candidate.active = false;
          this.log.push(
            `  💎 ENCLOSURE: ${capitalize(grower.mineral)} #${grower.crystal_id} ` +
            `(${grower.c_length_mm.toFixed(1)}mm) has grown around ` +
            `${candidate.mineral} #${candidate.crystal_id} (${candidate.c_length_mm.toFixed(2)}mm). ` +
            `The ${candidate.mineral} is now an inclusion inside the ${grower.mineral}.`
          );
        }
      }
    }
  }

  // When the host crystal is dissolving back past the point it enclosed
  // a neighbor, the neighbor is freed. Ports check_liberation from
  // vugg.py 1:1.
  _check_liberation() {
    for (const host of this.crystals) {
      if (!host.enclosed_crystals.length) continue;
      if (!host.dissolved) continue;
      const freed = [];
      for (let i = 0; i < host.enclosed_crystals.length; i++) {
        const encId = host.enclosed_crystals[i];
        const encStep = host.enclosed_at_step[i];
        const enc = this.crystals.find(c => c.crystal_id === encId);
        if (!enc) continue;
        let hostSizeAtEnc = 0;
        for (const z of host.zones) if (z.step <= encStep) hostSizeAtEnc += z.thickness_um;
        if (host.total_growth_um < hostSizeAtEnc * 0.7) {
          freed.push(i);
          enc.enclosed_by = null;
          enc.active = true;
          this.log.push(
            `  🔓 LIBERATION: ${enc.mineral} #${encId} freed from ` +
            `dissolving ${host.mineral} #${host.crystal_id}! ` +
            `The inclusion is exposed again and can resume growth.`
          );
        }
      }
      for (const i of freed.sort((a, b) => b - a)) {
        host.enclosed_crystals.splice(i, 1);
        host.enclosed_at_step.splice(i, 1);
      }
    }
  }

  format_header() {
    const c = this.conditions;
    const sigma_q = c.supersaturation_quartz();
    const sigma_c = c.supersaturation_calcite();
    let wall_info = '';
    if (c.wall.total_dissolved_mm > 0) {
      wall_info = ` │ Vug: ${c.wall.vug_diameter_mm.toFixed(0)}mm (+${c.wall.total_dissolved_mm.toFixed(1)})`;
    }
    return `═══ Step ${String(this.step).padStart(3)} │ T=${this.conditions.temperature.toFixed(1).padStart(6)}°C │ P=${c.pressure.toFixed(2)} kbar │ pH=${c.fluid.pH.toFixed(1)} │ σ(Qz)=${sigma_q.toFixed(2)} σ(Cal)=${sigma_c.toFixed(2)}${wall_info} │ Fluid: ${c.fluid.describe()}`;
  }

  format_summary() {
    const lines = [];
    lines.push('');
    const yearsPerStep = timeScale * 10000;
    const totalYears = this.step * yearsPerStep;
    const timeStr = totalYears >= 1e6 ? `~${(totalYears / 1e6).toFixed(1)} million years` : `~${(totalYears / 1000).toFixed(0)},000 years`;
    lines.push('═'.repeat(70));
    lines.push(`FINAL VUG INVENTORY — ${this.step} steps (${timeStr})`);
    lines.push('═'.repeat(70));

    // Vug wall stats if dissolution occurred
    const w = this.conditions.wall;
    if (w.total_dissolved_mm > 0) {
      const orig_diam = w.vug_diameter_mm - w.total_dissolved_mm * 2;
      lines.push('');
      lines.push('VUG CAVITY');
      lines.push(`  Host rock: ${w.composition}`);
      lines.push(`  Original diameter: ${orig_diam.toFixed(0)} mm`);
      lines.push(`  Final diameter: ${w.vug_diameter_mm.toFixed(0)} mm`);
      lines.push(`  Total wall dissolved: ${w.total_dissolved_mm.toFixed(1)} mm`);
      lines.push('  The acid made the room. The room grew the crystals.');
    }

    for (const c of this.crystals) {
      lines.push('');
      lines.push(`${c.mineral.toUpperCase()} #${c.crystal_id}`);
      lines.push(`  Nucleated: step ${c.nucleation_step} at ${c.nucleation_temp.toFixed(0)}°C`);
      lines.push(`  Position: ${c.position}`);
      lines.push(`  Morphology: ${c.describe_morphology()}`);
      lines.push(`  Growth zones: ${c.zones.length}`);
      lines.push(`  Total growth: ${c.total_growth_um.toFixed(0)} µm (${c.c_length_mm.toFixed(1)} mm)`);

      const fi_count = c.zones.filter(z => z.fluid_inclusion).length;
      if (fi_count) {
        const fi_types = [...new Set(c.zones.filter(z => z.fluid_inclusion).map(z => z.inclusion_type))];
        lines.push(`  Fluid inclusions: ${fi_count} (${fi_types.join(', ')})`);
      }
      if (c.twinned) lines.push(`  Twinning: ${c.twin_law}`);
      if (c.dissolved) lines.push(`  Note: partially dissolved (late-stage undersaturation)`);
      if (c.phantom_count > 0) {
        lines.push(`  Phantom boundaries: ${c.phantom_count} (dissolution surfaces preserved inside crystal)`);
      }

      // Provenance (for calcite with wall dissolution)
      if (c.mineral === 'calcite' && c.zones.length) {
        const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.1);
        if (wall_zones.length) {
          const avg_wall = wall_zones.reduce((s, z) => s + z.ca_from_wall, 0) / wall_zones.length;
          const max_wall = Math.max(...wall_zones.map(z => z.ca_from_wall));
          lines.push(`  Provenance: ${wall_zones.length}/${c.zones.length} zones contain wall-derived Ca²⁺`);
          lines.push(`    Average wall contribution: ${(avg_wall * 100).toFixed(0)}%, peak: ${(max_wall * 100).toFixed(0)}%`);
          const first_wall_zone = c.zones.find(z => z.ca_from_wall > 0.1);
          if (first_wall_zone) {
            lines.push(`    Wall-derived Ca first appears at step ${first_wall_zone.step} (T=${first_wall_zone.temperature.toFixed(0)}°C)`);
          }
        }
      }

      const fl = c.predict_fluorescence();
      if (fl !== 'non-fluorescent') lines.push(`  Predicted UV fluorescence: ${fl}`);

      if (c.zones.length) {
        const temps = c.zones.map(z => z.temperature);
        const minT = Math.min(...temps), maxT = Math.max(...temps);
        lines.push(`  Growth temperature range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C`);
        if (c.mineral === 'quartz') {
          const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
          if (ti_vals.length) {
            const avg_ti = ti_vals.reduce((a, b) => a + b, 0) / ti_vals.length;
            lines.push(`  Avg Ti-in-quartz: ${avg_ti.toFixed(3)} ppm (TitaniQ range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C)`);
          }
        }
      }
    }

    lines.push('');
    lines.push('═'.repeat(70));

    const narrative = this.narrate();
    if (narrative) {
      lines.push('');
      lines.push('GEOLOGICAL HISTORY');
      lines.push('─'.repeat(70));
      lines.push(narrative);
      lines.push('═'.repeat(70));
    }

    return lines;
  }

  narrate() {
    if (!this.crystals.length) return 'The vug remained empty. No minerals precipitated under these conditions. The fluid passed through without leaving a trace — still too hot, too undersaturated, or too brief. Given more time, this story might begin differently.';

    const totalGrowth = this.crystals.reduce((sum, c) => sum + c.total_growth_um, 0);
    if (totalGrowth < 5) {
      return `The vug barely began its story. Over ${this.step} steps, conditions shifted but nothing had time to grow beyond a thin film on the cavity wall. This is the very beginning — the fluid is still finding its equilibrium. Run more steps to see what this vug becomes.`;
    }

    const paragraphs = [];
    const first_crystal = this.crystals[0];
    const start_T = first_crystal.nucleation_temp;
    const mineral_names = [...new Set(this.crystals.map(c => c.mineral))];

    let setting;
    if (start_T > 300) setting = 'deep hydrothermal';
    else if (start_T > 150) setting = 'moderate-temperature hydrothermal';
    else setting = 'low-temperature';

    let vug_growth = '';
    if (this.conditions.wall.total_dissolved_mm > 0) {
      const w = this.conditions.wall;
      vug_growth = ` The cavity itself expanded from ${(w.vug_diameter_mm - w.total_dissolved_mm * 2).toFixed(0)}mm to ${w.vug_diameter_mm.toFixed(0)}mm diameter as acid pulses dissolved ${w.total_dissolved_mm.toFixed(1)}mm of the ${w.composition} host rock.`;
    }

    const yearsPerStep = timeScale * 10000;
    const totalYears = this.step * yearsPerStep;
    const timeStr = totalYears >= 1e6 ? `${(totalYears / 1e6).toFixed(1)} million years` : `${(totalYears / 1000).toFixed(0)},000 years`;
    paragraphs.push(
      `This vug records a ${setting} crystallization history spanning approximately ${timeStr}, beginning at ${start_T.toFixed(0)}°C. ${this.crystals.length} crystals grew across ${this.step} time steps (~${(yearsPerStep/1000).toFixed(0)},000 years each), producing an assemblage of ${mineral_names.join(', ')}.${vug_growth}`
    );

    const first_step = Math.min(...this.crystals.map(c => c.nucleation_step));
    const first_minerals = this.crystals.filter(c => c.nucleation_step === first_step);

    for (const c of first_minerals) {
      if (c.mineral === 'calcite') {
        paragraphs.push(
          `Calcite was the first mineral to crystallize, nucleating on the vug wall at ${c.nucleation_temp.toFixed(0)}°C. ` + this._narrate_calcite(c)
        );
      } else if (c.mineral === 'quartz') {
        paragraphs.push(
          `Quartz nucleated first at ${c.nucleation_temp.toFixed(0)}°C on the vug wall. ` + this._narrate_quartz(c)
        );
      } else {
        paragraphs.push(`${capitalize(c.mineral)} nucleated at ${c.nucleation_temp.toFixed(0)}°C.`);
      }
    }

    const later_crystals = this.crystals.filter(c => c.nucleation_step > first_step);
    if (later_crystals.length) {
      const triggeringEvent = (step) => {
        for (const e of this.events) {
          if (Math.abs(e.step - step) <= 2) return e;
        }
        return null;
      };

      // Event-triggered batches come out step-by-step. Untriggered
      // nucleations defer and get consolidated per-mineral so a mineral
      // that re-nucleates dozens of times in a stable brine reads as one
      // sentence instead of thirty repeating lines.
      const nuc_steps = [...new Set<number>(later_crystals.map(c => c.nucleation_step))].sort((a, b) => a - b);
      const untriggeredByMineral: Record<string, any[]> = {};
      for (const ns of nuc_steps) {
        const batch = later_crystals.filter(c => c.nucleation_step === ns);
        const batch_names = batch.map(c => c.mineral);
        const triggering_event = triggeringEvent(ns);

        if (triggering_event) {
          const name = triggering_event.name.toLowerCase();
          if (name.includes('mixing')) {
            paragraphs.push(
              `A fluid mixing event at step ${triggering_event.step} transformed the vug's chemistry. ` + this._narrate_mixing_event(batch, triggering_event)
            );
          } else if (name.includes('pulse')) {
            paragraphs.push(
              `A fresh pulse of hydrothermal fluid at step ${triggering_event.step} introduced new chemistry. ${[...new Set(batch_names)].map(capitalize).join(', ')} nucleated in response.`
            );
          } else if (name.includes('tectonic')) {
            paragraphs.push(
              `A tectonic event at step ${triggering_event.step} produced a pressure spike.` + this._narrate_tectonic(batch)
            );
          } else {
            for (const c of batch) (untriggeredByMineral[c.mineral] ||= []).push(c);
          }
        } else {
          for (const c of batch) (untriggeredByMineral[c.mineral] ||= []).push(c);
        }
      }

      const ref_T = first_minerals.length ? first_minerals[0].nucleation_temp : null;

      for (const [mineral, crystals] of Object.entries(untriggeredByMineral)) {
        crystals.sort((a, b) => a.nucleation_step - b.nucleation_step);
        const temps = crystals.map(c => c.nucleation_temp);
        const t_min = Math.min(...temps), t_max = Math.max(...temps);
        const s_min = crystals[0].nucleation_step;
        const s_max = crystals[crystals.length - 1].nucleation_step;
        const mineralCap = capitalize(mineral);

        if (crystals.length === 1) {
          const c = crystals[0];
          if (ref_T !== null && Math.abs(c.nucleation_temp - ref_T) <= 2) {
            paragraphs.push(
              `At ${c.nucleation_temp.toFixed(0)}°C, ${mineral} nucleated at step ${c.nucleation_step} — the brine had held its window long enough for saturation to tip over.`
            );
          } else if (ref_T !== null && c.nucleation_temp < ref_T - 2) {
            paragraphs.push(
              `As temperature continued to fall, ${mineral} nucleated at step ${c.nucleation_step} (${c.nucleation_temp.toFixed(0)}°C).`
            );
          } else {
            paragraphs.push(
              `${mineralCap} nucleated at step ${c.nucleation_step} (${c.nucleation_temp.toFixed(0)}°C).`
            );
          }
          continue;
        }

        if (t_max - t_min <= 4) {
          paragraphs.push(
            `Between step ${s_min} and step ${s_max}, ${mineral} nucleated ${crystals.length} times as conditions held steady around ${t_min.toFixed(0)}°C — the window stayed open.`
          );
        } else {
          const direction = crystals[0].nucleation_temp > crystals[crystals.length - 1].nucleation_temp ? 'cooled' : 'warmed';
          paragraphs.push(
            `${mineralCap} nucleated ${crystals.length} times between step ${s_min} (${crystals[0].nucleation_temp.toFixed(0)}°C) and step ${s_max} (${crystals[crystals.length - 1].nucleation_temp.toFixed(0)}°C) as the fluid ${direction} through its window.`
          );
        }
      }
    }

    // Dispatch via this['_narrate_' + mineral] — spec says every mineral has one.
    const significant = this.crystals.filter(c => c.total_growth_um > 100);
    for (const c of significant) {
      const fn = this[`_narrate_${c.mineral}`];
      const story = typeof fn === 'function' ? fn.call(this, c) : '';
      if (story && !first_minerals.includes(c)) paragraphs.push(story);
    }

    // Phantom growth narrative
    const phantom_crystals = this.crystals.filter(c => c.phantom_count > 0);
    for (const c of phantom_crystals) {
      if (c.phantom_count >= 2) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} shows ${c.phantom_count} phantom boundaries — internal surfaces where acid dissolved the crystal before new growth covered the damage. Each phantom preserves the shape of the crystal at the moment the acid arrived. In a polished section, these appear as ghost outlines nested inside the final crystal — the crystal's autobiography, written in dissolution and regrowth.`
        );
      } else if (c.phantom_count === 1) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} contains a single phantom surface — a dissolution boundary where the crystal was partially eaten and then regrew over the wound. The phantom preserves the crystal's earlier shape as a ghost outline inside the final form.`
        );
      }
    }

    // Provenance narrative for calcite
    for (const c of this.crystals) {
      if (c.mineral === 'calcite' && c.zones.length) {
        const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.3);
        const fluid_zones = c.zones.filter(z => z.ca_from_wall < 0.1 && z.thickness_um > 0);
        if (wall_zones.length && fluid_zones.length) {
          paragraphs.push(
            `The calcite tells two stories in one crystal. Early growth zones are built from the original fluid — Ca²⁺ that traveled through the basin. Later zones are built from recycled wall rock — limestone that was dissolved by acid and reprecipitated. The trace element signature shifts at the boundary: wall-derived zones carry the host rock's Fe and Mn signature, distinct from the fluid-derived zones. A microprobe traverse across this crystal would show the moment the vug started eating itself to feed its children.`
          );
        }
      }
    }

    // Radiation narrative
    if (this.radiation_dose > 0) {
      const smoky_crystals = this.crystals.filter(c => c.mineral === 'quartz' && c.radiation_damage > 0.3);
      const metamict_crystals = this.crystals.filter(c => c.radiation_damage > 0.8);
      let rad_text = `☢️ Radiation has left its mark on this vug. Total accumulated dose: ${this.radiation_dose.toFixed(2)}.`;
      if (smoky_crystals.length) {
        rad_text += ` ${smoky_crystals.length} quartz crystal${smoky_crystals.length > 1 ? 's have' : ' has'} turned smoky — aluminum impurities in the lattice were knocked loose by alpha particles from nearby uraninite, creating the color centers that give smoky quartz its signature darkness.`;
      }
      if (metamict_crystals.length) {
        rad_text += ` ${metamict_crystals.length} crystal${metamict_crystals.length > 1 ? 's have' : ' has'} become metamict — the crystal structure itself is destroyed by accumulated radiation damage, leaving an amorphous glass where ordered atoms once stood.`;
      }
      const uraninite_crystals = this.crystals.filter(c => c.mineral === 'uraninite');
      const galena_from_decay = this.crystals.filter(c => c.mineral === 'galena');
      if (uraninite_crystals.length && galena_from_decay.length) {
        rad_text += ` The galena in this assemblage crystallized in part from lead produced by uraninite decay — U-238 → Pb-206, the same chain used to date the age of rocks.`;
      }
      paragraphs.push(rad_text);
    }

    paragraphs.push(this._narrate_collectors_view());
    return paragraphs.join('\n\n');
  }

}

// ============================================================
// UTILITY
// ============================================================

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
