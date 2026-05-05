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
    const byId = new Map(this.crystals.map(c => [c.crystal_id, c]));
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
    const sigma_q = this.conditions.supersaturation_quartz();
    const existing_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (sigma_q > 1.2 && existing_quartz.length < 3 && !this._atNucleationCap('quartz')) {
      if (!existing_quartz.length || (sigma_q > 2.0 && rng.random() < 0.3)) {
        const c = this.nucleate('quartz', 'vug wall', sigma_q);
        this.log.push(`  ✦ NUCLEATION: Quartz #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_q.toFixed(2)})`);
      }
    }

    const sigma_c = this.conditions.supersaturation_calcite();
    const existing_calcite = this.crystals.filter(c => c.mineral === 'calcite' && c.active);
    if (sigma_c > 1.3 && !existing_calcite.length && !this._atNucleationCap('calcite')) {
      const c = this.nucleate('calcite', 'vug wall', sigma_c);
      this.log.push(`  ✦ NUCLEATION: Calcite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_c.toFixed(2)})`);
    }

    // Aragonite nucleation — Mg/Ca + T + Ω + trace Sr/Pb/Ba favorability.
    const sigma_arag = this.conditions.supersaturation_aragonite();
    const existing_arag = this.crystals.filter(c => c.mineral === 'aragonite' && c.active);
    if (sigma_arag > 1.0 && !existing_arag.length && !this._atNucleationCap('aragonite')) {
      let pos = 'vug wall';
      const existing_goe_a = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      const existing_hem_a = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (existing_goe_a.length && rng.random() < 0.4) pos = `on goethite #${existing_goe_a[0].crystal_id}`;
      else if (existing_hem_a.length && rng.random() < 0.3) pos = `on hematite #${existing_hem_a[0].crystal_id}`;
      const mg_ratio = this.conditions.fluid.Mg / Math.max(this.conditions.fluid.Ca, 0.01);
      const c = this.nucleate('aragonite', pos, sigma_arag);
      this.log.push(`  ✦ NUCLEATION: Aragonite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, Mg/Ca=${mg_ratio.toFixed(2)}, σ=${sigma_arag.toFixed(2)})`);
    }

    // Dolomite nucleation — Ca-Mg carbonate, needs both cations + T > 50°C.
    const sigma_dol = this.conditions.supersaturation_dolomite();
    const existing_dol = this.crystals.filter(c => c.mineral === 'dolomite' && c.active);
    if (sigma_dol > 1.0 && !existing_dol.length && !this._atNucleationCap('dolomite')) {
      let pos = 'vug wall';
      const existing_cal_d = this.crystals.filter(c => c.mineral === 'calcite' && c.active);
      if (existing_cal_d.length && rng.random() < 0.4) pos = `on calcite #${existing_cal_d[0].crystal_id}`;
      const mg_ratio = this.conditions.fluid.Mg / Math.max(this.conditions.fluid.Ca, 0.01);
      const c = this.nucleate('dolomite', pos, sigma_dol);
      this.log.push(`  ✦ NUCLEATION: Dolomite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, Mg/Ca=${mg_ratio.toFixed(2)}, σ=${sigma_dol.toFixed(2)})`);
    }

    // Siderite nucleation — Fe carbonate, brown rhomb. Reducing only.
    const sigma_sid = this.conditions.supersaturation_siderite();
    const existing_sid = this.crystals.filter(c => c.mineral === 'siderite' && c.active);
    if (sigma_sid > 1.0 && !existing_sid.length && !this._atNucleationCap('siderite')) {
      let pos = 'vug wall';
      const existing_py_s = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      const existing_sph_s = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      if (existing_py_s.length && rng.random() < 0.4) pos = `on pyrite #${existing_py_s[0].crystal_id}`;
      else if (existing_sph_s.length && rng.random() < 0.3) pos = `on sphalerite #${existing_sph_s[0].crystal_id}`;
      const c = this.nucleate('siderite', pos, sigma_sid);
      this.log.push(`  ✦ NUCLEATION: Siderite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, Fe=${this.conditions.fluid.Fe.toFixed(0)}, σ=${sigma_sid.toFixed(2)})`);
    }

    // Rhodochrosite nucleation — Mn carbonate, the pink mineral.
    const sigma_rho = this.conditions.supersaturation_rhodochrosite();
    const existing_rho = this.crystals.filter(c => c.mineral === 'rhodochrosite' && c.active);
    if (sigma_rho > 1.0 && !existing_rho.length && !this._atNucleationCap('rhodochrosite')) {
      let pos = 'vug wall';
      const existing_goe_r = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      const existing_py_r = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      const existing_sph_r = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      if (existing_goe_r.length && rng.random() < 0.5) pos = `on goethite #${existing_goe_r[0].crystal_id}`;
      else if (existing_sph_r.length && rng.random() < 0.4) pos = `on sphalerite #${existing_sph_r[0].crystal_id}`;
      else if (existing_py_r.length && rng.random() < 0.3) pos = `on pyrite #${existing_py_r[0].crystal_id}`;
      const c = this.nucleate('rhodochrosite', pos, sigma_rho);
      this.log.push(`  ✦ NUCLEATION: Rhodochrosite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, Mn=${this.conditions.fluid.Mn.toFixed(0)}, σ=${sigma_rho.toFixed(2)})`);
    }

    const sigma_s = this.conditions.supersaturation_sphalerite();
    const existing_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    if (sigma_s > 1.0 && !existing_sph.length && !this._atNucleationCap('sphalerite')) {
      const c = this.nucleate('sphalerite', 'vug wall', sigma_s);
      this.log.push(`  ✦ NUCLEATION: Sphalerite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_s.toFixed(2)})`);
    }

    // Wurtzite nucleation — T>95°C hexagonal ZnS dimorph
    const sigma_wz = this.conditions.supersaturation_wurtzite();
    const existing_wz = this.crystals.filter(c => c.mineral === 'wurtzite' && c.active);
    if (sigma_wz > 1.0 && !existing_wz.length && !this._atNucleationCap('wurtzite')) {
      const c = this.nucleate('wurtzite', 'vug wall', sigma_wz);
      this.log.push(`  ✦ NUCLEATION: Wurtzite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_wz.toFixed(2)})`);
    }

    const sigma_f = this.conditions.supersaturation_fluorite();
    const existing_fl = this.crystals.filter(c => c.mineral === 'fluorite' && c.active);
    if (sigma_f > 1.2 && !existing_fl.length && !this._atNucleationCap('fluorite')) {
      const c = this.nucleate('fluorite', 'vug wall', sigma_f);
      this.log.push(`  ✦ NUCLEATION: Fluorite #${c.crystal_id} on ${c.position}`);
    }

    // Pyrite nucleation
    const sigma_py = this.conditions.supersaturation_pyrite();
    const existing_py = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
    if (sigma_py > 1.0 && !existing_py.length && !this._atNucleationCap('pyrite')) {
      let pos = 'vug wall';
      const existing_sph2 = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      if (existing_sph2.length && rng.random() < 0.5) {
        pos = `on sphalerite #${existing_sph2[0].crystal_id}`;
      }
      const c = this.nucleate('pyrite', pos, sigma_py);
      this.log.push(`  ✦ NUCLEATION: Pyrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_py.toFixed(2)})`);
    }

    // Marcasite nucleation — pH<5, T<240. The acidic dimorph.
    const sigma_mc = this.conditions.supersaturation_marcasite();
    const existing_mc = this.crystals.filter(c => c.mineral === 'marcasite' && c.active);
    if (sigma_mc > 1.0 && !existing_mc.length && !this._atNucleationCap('marcasite')) {
      let pos = 'vug wall';
      const existing_sph3 = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      const existing_gal = this.crystals.filter(c => c.mineral === 'galena' && c.active);
      if (existing_sph3.length && rng.random() < 0.5) {
        pos = `on sphalerite #${existing_sph3[0].crystal_id}`;
      } else if (existing_gal.length && rng.random() < 0.4) {
        pos = `on galena #${existing_gal[0].crystal_id}`;
      }
      const c = this.nucleate('marcasite', pos, sigma_mc);
      this.log.push(`  ✦ NUCLEATION: Marcasite #${c.crystal_id} on ${c.position} (pH=${this.conditions.fluid.pH.toFixed(1)}, σ=${sigma_mc.toFixed(2)})`);
    }

    // Chalcopyrite nucleation
    const sigma_cp = this.conditions.supersaturation_chalcopyrite();
    const existing_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
    if (sigma_cp > 1.0 && !existing_cp.length && !this._atNucleationCap('chalcopyrite')) {
      let pos = 'vug wall';
      if (existing_py.length && rng.random() < 0.4) {
        pos = `on pyrite #${existing_py[0].crystal_id}`;
      }
      const c = this.nucleate('chalcopyrite', pos, sigma_cp);
      this.log.push(`  ✦ NUCLEATION: Chalcopyrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cp.toFixed(2)})`);
    }

    // Tetrahedrite nucleation — Sb-endmember fahlore, Cu-Sb-S hydrothermal.
    const sigma_td = this.conditions.supersaturation_tetrahedrite();
    const existing_td = this.crystals.filter(c => c.mineral === 'tetrahedrite' && c.active);
    if (sigma_td > 1.0 && !existing_td.length && !this._atNucleationCap('tetrahedrite')) {
      let pos = 'vug wall';
      const existing_cp2 = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      const existing_py2 = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      if (existing_cp2.length && rng.random() < 0.5) pos = `on chalcopyrite #${existing_cp2[0].crystal_id}`;
      else if (existing_py2.length && rng.random() < 0.3) pos = `on pyrite #${existing_py2[0].crystal_id}`;
      const c = this.nucleate('tetrahedrite', pos, sigma_td);
      this.log.push(`  ✦ NUCLEATION: Tetrahedrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_td.toFixed(2)})`);
    }

    // Tennantite nucleation — As-endmember fahlore.
    const sigma_tn = this.conditions.supersaturation_tennantite();
    const existing_tn = this.crystals.filter(c => c.mineral === 'tennantite' && c.active);
    if (sigma_tn > 1.0 && !existing_tn.length && !this._atNucleationCap('tennantite')) {
      let pos = 'vug wall';
      const existing_cp3 = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      const existing_td3 = this.crystals.filter(c => c.mineral === 'tetrahedrite' && c.active);
      if (existing_cp3.length && rng.random() < 0.4) pos = `on chalcopyrite #${existing_cp3[0].crystal_id}`;
      else if (existing_td3.length && rng.random() < 0.3) pos = `alongside tetrahedrite #${existing_td3[0].crystal_id}`;
      const c = this.nucleate('tennantite', pos, sigma_tn);
      this.log.push(`  ✦ NUCLEATION: Tennantite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_tn.toFixed(2)})`);
    }

    // Apophyllite nucleation — alkaline silicate, low-T zeolite vesicle filling.
    const sigma_ap = this.conditions.supersaturation_apophyllite();
    const existing_ap = this.crystals.filter(c => c.mineral === 'apophyllite' && c.active);
    if (sigma_ap > 1.0 && !existing_ap.length && !this._atNucleationCap('apophyllite')) {
      let pos = 'vug wall';
      const existing_q_ap = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
      const existing_hem_ap = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (existing_hem_ap.length && rng.random() < 0.4) {
        pos = `on hematite #${existing_hem_ap[0].crystal_id}`;
      } else if (existing_q_ap.length && rng.random() < 0.3) {
        pos = `on quartz #${existing_q_ap[0].crystal_id}`;
      }
      const c = this.nucleate('apophyllite', pos, sigma_ap);
      this.log.push(`  ✦ NUCLEATION: Apophyllite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ap.toFixed(2)})`);
    }

    // Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
    const sigma_hem = this.conditions.supersaturation_hematite();
    const existing_hem = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
    const total_hem = this.crystals.filter(c => c.mineral === 'hematite').length;
    if (sigma_hem > 1.2 && !existing_hem.length && total_hem < 3 && !this._atNucleationCap('hematite')) {
      let pos = 'vug wall';
      if (existing_quartz.length && rng.random() < 0.4) {
        pos = `on quartz #${existing_quartz[0].crystal_id}`;
      }
      const c = this.nucleate('hematite', pos, sigma_hem);
      this.log.push(`  ✦ NUCLEATION: Hematite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_hem.toFixed(2)})`);
    }

    // Malachite nucleation — needs sigma > 1.0
    const sigma_mal = this.conditions.supersaturation_malachite();
    const existing_mal = this.crystals.filter(c => c.mineral === 'malachite' && c.active);
    const total_mal = this.crystals.filter(c => c.mineral === 'malachite').length;
    if (sigma_mal > 1.0 && !existing_mal.length && total_mal < 3 && !this._atNucleationCap('malachite')) {
      let pos = 'vug wall';
      // Preference for chalcopyrite surface (classic oxidation paragenesis!)
      const dissolving_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_cp_all = this.crystals.filter(c => c.mineral === 'chalcopyrite');
      if (dissolving_cp.length && rng.random() < 0.7) {
        pos = `on chalcopyrite #${dissolving_cp[0].crystal_id}`;
      } else if (active_cp_all.length && rng.random() < 0.4) {
        pos = `on chalcopyrite #${active_cp_all[0].crystal_id}`;
      } else if (existing_hem.length && rng.random() < 0.3) {
        pos = `on hematite #${existing_hem[0].crystal_id}`;
      }
      const c = this.nucleate('malachite', pos, sigma_mal);
      this.log.push(`  ✦ NUCLEATION: Malachite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mal.toFixed(2)})`);
    }

    // Uraninite nucleation — needs sigma > 1.5, max 3 active / 5 total
    const sigma_urn = this.conditions.supersaturation_uraninite();
    const existing_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.active);
    const total_urn = this.crystals.filter(c => c.mineral === 'uraninite').length;
    if (sigma_urn > 1.5 && existing_urn.length < 3 && total_urn < 5 && !this._atNucleationCap('uraninite')) {
      if (!existing_urn.length || (sigma_urn > 2.5 && rng.random() < 0.3)) {
        const c = this.nucleate('uraninite', 'vug wall', sigma_urn);
        this.log.push(`  ✦ NUCLEATION: ☢️ Uraninite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_urn.toFixed(2)}) — radioactive!`);
      }
    }

    // Smithsonite nucleation — needs sigma > 1.0, oxidized Zn environment
    const sigma_sm = this.conditions.supersaturation_smithsonite();
    const existing_sm = this.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
    const total_sm = this.crystals.filter(c => c.mineral === 'smithsonite').length;
    if (sigma_sm > 1.0 && !existing_sm.length && total_sm < 3 && !this._atNucleationCap('smithsonite')) {
      let pos = 'vug wall';
      // Prefers to nucleate on dissolved sphalerite — classic oxidation zone paragenesis
      const dissolved_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
      const any_sph = this.crystals.filter(c => c.mineral === 'sphalerite');
      if (dissolved_sph.length && rng.random() < 0.7) {
        pos = `on sphalerite #${dissolved_sph[0].crystal_id} (oxidized)`;
      } else if (any_sph.length && rng.random() < 0.3) {
        pos = `on sphalerite #${any_sph[0].crystal_id}`;
      }
      const c = this.nucleate('smithsonite', pos, sigma_sm);
      this.log.push(`  ✦ NUCLEATION: Smithsonite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_sm.toFixed(2)}) — zinc carbonate from oxidized sphalerite`);
    }

    // Wulfenite nucleation — needs sigma > 1.2, RARE: requires both Pb and Mo
    const sigma_wulf = this.conditions.supersaturation_wulfenite();
    const existing_wulf = this.crystals.filter(c => c.mineral === 'wulfenite' && c.active);
    const total_wulf = this.crystals.filter(c => c.mineral === 'wulfenite').length;
    if (sigma_wulf > 1.2 && !existing_wulf.length && total_wulf < 2 && !this._atNucleationCap('wulfenite')) {
      let pos = 'vug wall';
      // Prefers to nucleate on dissolved galena AND/OR dissolved molybdenite
      // Wulfenite = Pb²⁺ (from oxidized galena) + MoO₄²⁻ (from oxidized molybdenite)
      const dissolved_gal = this.crystals.filter(c => c.mineral === 'galena' && c.dissolved);
      const dissolved_moly = this.crystals.filter(c => c.mineral === 'molybdenite' && c.dissolved);
      const any_gal = this.crystals.filter(c => c.mineral === 'galena');
      const any_moly = this.crystals.filter(c => c.mineral === 'molybdenite');
      if (dissolved_moly.length && dissolved_gal.length && rng.random() < 0.7) {
        pos = `on molybdenite #${dissolved_moly[0].crystal_id} (oxidized, near galena #${dissolved_gal[0].crystal_id})`;
      } else if (dissolved_gal.length && rng.random() < 0.6) {
        pos = `on galena #${dissolved_gal[0].crystal_id} (oxidized)`;
      } else if (dissolved_moly.length && rng.random() < 0.5) {
        pos = `on molybdenite #${dissolved_moly[0].crystal_id} (oxidized)`;
      } else if (any_gal.length && rng.random() < 0.3) {
        pos = `on galena #${any_gal[0].crystal_id}`;
      }
      const c = this.nucleate('wulfenite', pos, sigma_wulf);
      this.log.push(`  ✦ NUCLEATION: 🟠 Wulfenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_wulf.toFixed(2)}) — the collector's prize!`);
    }

    // Ferrimolybdite nucleation — the no-lead Mo-oxidation fork.
    // Lower σ threshold (1.0 vs wulfenite's 1.2) + higher per-check
    // probability (0.18) reflect its faster, less-picky growth. Substrate:
    // dissolving molybdenite (direct oxidation product) > active
    // molybdenite > free vug wall. Coexists with wulfenite; both draw
    // on the MoO₄²⁻ pool but ferrimolybdite wins the early window.
    const sigma_fmo = this.conditions.supersaturation_ferrimolybdite();
    if (sigma_fmo > 1.0 && !this._atNucleationCap('ferrimolybdite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const dissolving_mol = this.crystals.filter(c => c.mineral === 'molybdenite' && c.dissolved);
        const active_mol = this.crystals.filter(c => c.mineral === 'molybdenite' && c.active);
        if (dissolving_mol.length && rng.random() < 0.7) {
          pos = `on dissolving molybdenite #${dissolving_mol[0].crystal_id}`;
        } else if (active_mol.length && rng.random() < 0.4) {
          pos = `on molybdenite #${active_mol[0].crystal_id}`;
        }
        const c = this.nucleate('ferrimolybdite', pos, sigma_fmo);
        this.log.push(`  ✦ NUCLEATION: 🟡 Ferrimolybdite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_fmo.toFixed(2)}, Mo=${this.conditions.fluid.Mo.toFixed(0)}, Fe=${this.conditions.fluid.Fe.toFixed(0)}) — canary-yellow tufts on oxidizing molybdenite`);
      }
    }

    // Arsenopyrite nucleation — mesothermal primary sulfide, reducing
    // Fe+As+S. Substrate preference: pyrite (orogenic-gold co-precipitation
    // habit — arsenopyrite rhombs on pyrite cubes) > chalcopyrite > vug
    // wall. σ threshold 1.2 reflects mesothermal pickiness. Au-trapping
    // (in grow_arsenopyrite) competes with native_gold for the fluid Au
    // pool when both are forming.
    const sigma_apy = this.conditions.supersaturation_arsenopyrite();
    if (sigma_apy > 1.2 && !this._atNucleationCap('arsenopyrite')) {
      if (rng.random() < 0.12) {
        let pos = 'vug wall';
        const active_py_apy = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
        const active_cp_apy = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        if (active_py_apy.length && rng.random() < 0.5) {
          pos = `on pyrite #${active_py_apy[0].crystal_id}`;
        } else if (active_cp_apy.length && rng.random() < 0.3) {
          pos = `on chalcopyrite #${active_cp_apy[0].crystal_id}`;
        }
        const c = this.nucleate('arsenopyrite', pos, sigma_apy);
        this.log.push(`  ✦ NUCLEATION: ⚪ Arsenopyrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_apy.toFixed(2)}, Fe=${this.conditions.fluid.Fe.toFixed(0)}, As=${this.conditions.fluid.As.toFixed(0)}, Au=${this.conditions.fluid.Au.toFixed(2)} ppm) — striated diamond-section prisms; will trap invisible-gold`);
      }
    }

    // Scorodite nucleation — the arsenate supergene gateway; classic
    // "crystallized on dissolving arsenopyrite" habit. σ threshold 1.0
    // + per-check 0.20 reflect supergene speed. Substrate priority:
    // dissolving arsenopyrite (direct parent — the famous habit) >
    // active arsenopyrite > dissolving pyrite (often co-occurs) > vug
    // wall.
    const sigma_sco = this.conditions.supersaturation_scorodite();
    if (sigma_sco > 1.0 && !this._atNucleationCap('scorodite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const diss_apy_sco = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
        const active_apy_sco = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
        const diss_py_sco = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
        if (diss_apy_sco.length && rng.random() < 0.8) {
          pos = `on dissolving arsenopyrite #${diss_apy_sco[0].crystal_id}`;
        } else if (active_apy_sco.length && rng.random() < 0.5) {
          pos = `on arsenopyrite #${active_apy_sco[0].crystal_id}`;
        } else if (diss_py_sco.length && rng.random() < 0.4) {
          pos = `on dissolving pyrite #${diss_py_sco[0].crystal_id}`;
        }
        const c = this.nucleate('scorodite', pos, sigma_sco);
        this.log.push(`  ✦ NUCLEATION: 💎 Scorodite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_sco.toFixed(2)}, Fe=${this.conditions.fluid.Fe.toFixed(0)}, As=${this.conditions.fluid.As.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — pale blue-green dipyramids, sequesters arsenic`);
      }
    }

    // Barite nucleation — the Ba sequestration mineral. σ threshold 1.0
    // + per-check 0.15. Wide-T habit; substrate-agnostic but in MVT often
    // perches near galena/sphalerite (co-precipitation paragenesis).
    const sigma_brt = this.conditions.supersaturation_barite();
    if (sigma_brt > 1.0 && !this._atNucleationCap('barite')) {
      if (rng.random() < 0.15) {
        let pos = 'vug wall';
        const active_gal_brt = this.crystals.filter(c => c.mineral === 'galena' && c.active);
        const active_sph_brt = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
        if (active_gal_brt.length && rng.random() < 0.3) {
          pos = `near galena #${active_gal_brt[0].crystal_id}`;
        } else if (active_sph_brt.length && rng.random() < 0.2) {
          pos = `near sphalerite #${active_sph_brt[0].crystal_id}`;
        }
        const c = this.nucleate('barite', pos, sigma_brt);
        this.log.push(`  ✦ NUCLEATION: ⚪ Barite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_brt.toFixed(2)}, Ba=${this.conditions.fluid.Ba.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(2)}) — heavy spar, MVT gangue`);
      }
    }

    // Celestine nucleation — the Sr sequestration mineral; pale celestial
    // blue. Substrate priority: existing barite (celestobarite-barytocelestine
    // pair) > vug wall.
    const sigma_cel = this.conditions.supersaturation_celestine();
    if (sigma_cel > 1.0 && !this._atNucleationCap('celestine')) {
      if (rng.random() < 0.15) {
        let pos = 'vug wall';
        const active_brt_cel = this.crystals.filter(c => c.mineral === 'barite' && c.active);
        if (active_brt_cel.length && rng.random() < 0.25) {
          pos = `on barite #${active_brt_cel[0].crystal_id} (celestobarite-barytocelestine pair)`;
        }
        const c = this.nucleate('celestine', pos, sigma_cel);
        this.log.push(`  ✦ NUCLEATION: 🟦 Celestine #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cel.toFixed(2)}, Sr=${this.conditions.fluid.Sr.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(2)}) — pale celestial blue, Sr sulfate`);
      }
    }

    // Jarosite nucleation — the AMD-yellow Fe sulfate. Substrate prefers
    // dissolving pyrite/marcasite (the diagnostic yellow rim).
    const sigma_jar = this.conditions.supersaturation_jarosite();
    if (sigma_jar > 1.0 && !this._atNucleationCap('jarosite')) {
      // v5: per-check 0.45 (was 0.18) so jarosite fires reliably (~95%)
      // during brief acid windows in carbonate-buffered systems like
      // Tsumeb (where ev_supergene_acidification holds pH near 4 for
      // only ~15 steps before meteoric flush neutralizes).
      if (rng.random() < 0.45) {
        let pos = 'vug wall';
        const diss_py_jar = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
        const diss_mar_jar = this.crystals.filter(c => c.mineral === 'marcasite' && c.dissolved);
        const active_py_jar = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
        if (diss_py_jar.length && rng.random() < 0.7) {
          pos = `on dissolving pyrite #${diss_py_jar[0].crystal_id}`;
        } else if (diss_mar_jar.length && rng.random() < 0.6) {
          pos = `on dissolving marcasite #${diss_mar_jar[0].crystal_id}`;
        } else if (active_py_jar.length && rng.random() < 0.4) {
          pos = `on pyrite #${active_py_jar[0].crystal_id}`;
        }
        const c = this.nucleate('jarosite', pos, sigma_jar);
        this.log.push(`  ✦ NUCLEATION: 🟡 Jarosite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_jar.toFixed(2)}, K=${this.conditions.fluid.K.toFixed(0)}, Fe=${this.conditions.fluid.Fe.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — AMD yellow, Mars-class mineral`);
      }
    }

    // Alunite nucleation — advanced argillic alteration; substrate prefers
    // dissolving feldspar (the wall-leaching origin of Al).
    const sigma_alu = this.conditions.supersaturation_alunite();
    if (sigma_alu > 1.0 && !this._atNucleationCap('alunite')) {
      // v5: per-check 0.45 (was 0.15) — same rationale as jarosite,
      // tighter alunite window (Al/25 cap means only 3 of 4 acid
      // pulses cross threshold).
      if (rng.random() < 0.45) {
        let pos = 'vug wall';
        const diss_fel_alu = this.crystals.filter(c => c.mineral === 'feldspar' && c.dissolved);
        const active_fel_alu = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
        if (diss_fel_alu.length && rng.random() < 0.7) {
          pos = `on dissolving feldspar #${diss_fel_alu[0].crystal_id}`;
        } else if (active_fel_alu.length && rng.random() < 0.4) {
          pos = `on feldspar #${active_fel_alu[0].crystal_id}`;
        }
        const c = this.nucleate('alunite', pos, sigma_alu);
        this.log.push(`  ✦ NUCLEATION: ⚪ Alunite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_alu.toFixed(2)}, K=${this.conditions.fluid.K.toFixed(0)}, Al=${this.conditions.fluid.Al.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — advanced argillic alteration index`);
      }
    }

    // Brochantite nucleation — wet-supergene Cu sulfate (pH 4-7 fork end).
    // Substrate priority: dissolving Cu sulfides > active Cu sulfides > vug wall.
    const sigma_brn_sulf = this.conditions.supersaturation_brochantite();
    if (sigma_brn_sulf > 1.0 && !this._atNucleationCap('brochantite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const diss_chc_brn = this.crystals.filter(c => c.mineral === 'chalcocite' && c.dissolved);
        const diss_cov_brn = this.crystals.filter(c => c.mineral === 'covellite' && c.dissolved);
        const active_chc_brn = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
        if (diss_chc_brn.length && rng.random() < 0.7) {
          pos = `on dissolving chalcocite #${diss_chc_brn[0].crystal_id}`;
        } else if (diss_cov_brn.length && rng.random() < 0.6) {
          pos = `on dissolving covellite #${diss_cov_brn[0].crystal_id}`;
        } else if (active_chc_brn.length && rng.random() < 0.4) {
          pos = `on chalcocite #${active_chc_brn[0].crystal_id}`;
        }
        const c = this.nucleate('brochantite', pos, sigma_brn_sulf);
        this.log.push(`  ✦ NUCLEATION: 🟢 Brochantite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_brn_sulf.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — emerald-green Cu sulfate`);
      }
    }

    // Antlerite nucleation — dry-acid Cu sulfate (pH 1-3.5 fork end).
    // Substrate-prefers dissolving brochantite (pH-fork conversion).
    const sigma_ant = this.conditions.supersaturation_antlerite();
    if (sigma_ant > 1.0 && !this._atNucleationCap('antlerite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const diss_brn_ant = this.crystals.filter(c => c.mineral === 'brochantite' && c.dissolved);
        const diss_chc_ant = this.crystals.filter(c => c.mineral === 'chalcocite' && c.dissolved);
        if (diss_brn_ant.length && rng.random() < 0.8) {
          pos = `on dissolving brochantite #${diss_brn_ant[0].crystal_id} (pH-fork conversion)`;
        } else if (diss_chc_ant.length && rng.random() < 0.5) {
          pos = `on dissolving chalcocite #${diss_chc_ant[0].crystal_id}`;
        }
        const c = this.nucleate('antlerite', pos, sigma_ant);
        this.log.push(`  ✦ NUCLEATION: 🟢 Antlerite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ant.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — dry-acid Chuquicamata Cu sulfate`);
      }
    }

    // Anhydrite nucleation — high-T or saline-low-T Ca sulfate.
    // Substrate-agnostic; in Bingham deep-zone often co-precipitates
    // with chalcopyrite (porphyry deep-brine paragenesis).
    const sigma_anh = this.conditions.supersaturation_anhydrite();
    if (sigma_anh > 1.0 && !this._atNucleationCap('anhydrite')) {
      if (rng.random() < 0.16) {
        let pos = 'vug wall';
        const active_cp_anh = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        if (active_cp_anh.length && this.conditions.temperature > 200 && rng.random() < 0.3) {
          pos = `near chalcopyrite #${active_cp_anh[0].crystal_id} (porphyry deep-brine paragenesis)`;
        }
        const c = this.nucleate('anhydrite', pos, sigma_anh);
        this.log.push(`  ✦ NUCLEATION: ⚪ Anhydrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_anh.toFixed(2)}, Ca=${this.conditions.fluid.Ca.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, salinity=${this.conditions.fluid.salinity.toFixed(0)}‰)`);
      }
    }

    // Selenite nucleation — low temperature, oxidized sulfate environment
    // The crystal that grows when everything else is ending
    const sigma_sel = this.conditions.supersaturation_selenite();
    const existing_sel = this.crystals.filter(c => c.mineral === 'selenite' && c.active);
    const total_sel = this.crystals.filter(c => c.mineral === 'selenite').length;
    if (sigma_sel > 1.0 && existing_sel.length < 2 && total_sel < 4 && !this._atNucleationCap('selenite')) {
      if (!existing_sel.length || (sigma_sel > 1.8 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        // Prefers to grow on dissolved sulfide surfaces — the oxidation zone paragenesis
        const dissolved_py = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
        const dissolved_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
        if (dissolved_py.length && rng.random() < 0.6) {
          pos = `on pyrite #${dissolved_py[0].crystal_id} (oxidized)`;
        } else if (dissolved_cp.length && rng.random() < 0.5) {
          pos = `on chalcopyrite #${dissolved_cp[0].crystal_id} (oxidized)`;
        }
        const c = this.nucleate('selenite', pos, sigma_sel);
        this.log.push(`  ✦ NUCLEATION: 💎 Selenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_sel.toFixed(2)}) — gypsum blades forming in the cooling, oxidizing fluid`);
      }
    }

    // Halite nucleation — chloride evaporite, fires when a vadose-
    // transition concentration boost pushes Na × Cl × concentration²
    // into supersaturation. v27 mirror of vugg.py.
    const sigma_hal = this.conditions.supersaturation_halite();
    if (sigma_hal > 1.0 && !this._atNucleationCap('halite') && rng.random() < 0.15) {
      const c = this.nucleate('halite', 'vug wall', sigma_hal);
      this.log.push(`  ✦ NUCLEATION: 🧂 Halite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_hal.toFixed(2)}, concentration=${this.conditions.fluid.concentration.toFixed(1)}) — bathtub-ring NaCl precipitating from the evaporating brine`);
    }

    // Mirabilite nucleation — cold-side Na-sulfate evaporite. v29.
    const sigma_mirab = this.conditions.supersaturation_mirabilite();
    if (sigma_mirab > 1.0 && !this._atNucleationCap('mirabilite') && rng.random() < 0.13) {
      const c = this.nucleate('mirabilite', 'vug wall', sigma_mirab);
      this.log.push(`  ✦ NUCLEATION: ❄️ Mirabilite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mirab.toFixed(2)}, concentration=${this.conditions.fluid.concentration.toFixed(1)}) — Glauber salt from the cold playa brine`);
    }

    // Thenardite nucleation — warm-side Na-sulfate evaporite. v29.
    const sigma_then = this.conditions.supersaturation_thenardite();
    if (sigma_then > 1.0 && !this._atNucleationCap('thenardite') && rng.random() < 0.13) {
      const c = this.nucleate('thenardite', 'vug wall', sigma_then);
      this.log.push(`  ✦ NUCLEATION: 🌫️ Thenardite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_then.toFixed(2)}, concentration=${this.conditions.fluid.concentration.toFixed(1)}) — anhydrous Na₂SO₄ from the warm playa surface`);
    }

    // Borax nucleation — alkaline-brine borate evaporite, v28 mirror
    // of vugg.py. Needs Na + B + alkaline pH + low T + concentration
    // boost. Stays dormant in scenarios that don't drain.
    const sigma_brx = this.conditions.supersaturation_borax();
    if (sigma_brx > 1.0 && !this._atNucleationCap('borax') && rng.random() < 0.12) {
      const c = this.nucleate('borax', 'vug wall', sigma_brx);
      this.log.push(`  ✦ NUCLEATION: 💎 Borax #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_brx.toFixed(2)}, concentration=${this.conditions.fluid.concentration.toFixed(1)}, pH=${this.conditions.fluid.pH.toFixed(1)}) — alkaline-brine evaporite from the playa-lake chemistry of this drained vug`);
    }

    // Feldspar nucleation — needs sigma > 1.0, K or Na + Al + Si
    const sigma_feld = this.conditions.supersaturation_feldspar();
    const existing_feld = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
    const total_feld = this.crystals.filter(c => c.mineral === 'feldspar').length;
    if (sigma_feld > 1.0 && existing_feld.length < 3 && total_feld < 6 && !this._atNucleationCap('feldspar')) {
      if (!existing_feld.length || (sigma_feld > 1.8 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        // Can nucleate on quartz in pegmatite conditions
        if (existing_quartz.length && rng.random() < 0.3) {
          pos = `on quartz #${existing_quartz[0].crystal_id}`;
        }
        const c = this.nucleate('feldspar', pos, sigma_feld);
        const T = this.conditions.temperature;
        const polyName = T > 500 ? 'sanidine' : (T > 300 ? 'orthoclase' : 'microcline');
        c.mineral_display = polyName;
        this.log.push(`  ✦ NUCLEATION: Feldspar #${c.crystal_id} (${polyName}) on ${c.position} (T=${T.toFixed(0)}°C, σ=${sigma_feld.toFixed(2)}) — ${T > 500 ? 'disordered high-T form' : T > 300 ? 'partially ordered' : 'fully ordered triclinic'}`);
      }
    }

    // Albite nucleation — Na-feldspar, often co-occurs with K-feldspar in pegmatites.
    const sigma_alb = this.conditions.supersaturation_albite();
    const existing_alb = this.crystals.filter(c => c.mineral === 'albite' && c.active);
    const total_alb = this.crystals.filter(c => c.mineral === 'albite').length;
    if (sigma_alb > 1.0 && existing_alb.length < 2 && total_alb < 4 && !this._atNucleationCap('albite')) {
      if (!existing_alb.length || (sigma_alb > 1.5 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        // Classic perthite association — albite on feldspar host
        if (existing_feld.length && rng.random() < 0.5) pos = `on feldspar #${existing_feld[0].crystal_id}`;
        else if (existing_quartz.length && rng.random() < 0.3) pos = `on quartz #${existing_quartz[0].crystal_id}`;
        const c = this.nucleate('albite', pos, sigma_alb);
        this.log.push(`  ✦ NUCLEATION: Albite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_alb.toFixed(2)})`);
      }
    }

    // Galena nucleation — needs sigma > 1.0, max 4 active / 8 total
    const sigma_gal = this.conditions.supersaturation_galena();
    const existing_gal = this.crystals.filter(c => c.mineral === 'galena' && c.active);
    const total_gal = this.crystals.filter(c => c.mineral === 'galena').length;
    if (sigma_gal > 1.0 && existing_gal.length < 4 && total_gal < 8 && !this._atNucleationCap('galena')) {
      if (!existing_gal.length || (sigma_gal > 2.0 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const existing_sph3 = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
        if (existing_sph3.length && rng.random() < 0.4) {
          pos = `on sphalerite #${existing_sph3[0].crystal_id}`;
        }
        const c = this.nucleate('galena', pos, sigma_gal);
        this.log.push(`  ✦ NUCLEATION: Galena #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_gal.toFixed(2)})`);
      }
    }

    // Molybdenite nucleation — Mo + S at high T (porphyry), max 3 active / 6 total
    const sigma_moly = this.conditions.supersaturation_molybdenite();
    const existing_moly = this.crystals.filter(c => c.mineral === 'molybdenite' && c.active);
    const total_moly = this.crystals.filter(c => c.mineral === 'molybdenite').length;
    if (sigma_moly > 1.0 && existing_moly.length < 3 && total_moly < 6 && !this._atNucleationCap('molybdenite')) {
      if (!existing_moly.length || (sigma_moly > 1.5 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        // Often associates with chalcopyrite or pyrite in porphyry systems
        const existing_cp2 = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        const existing_py2 = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
        if (existing_cp2.length && rng.random() < 0.4) {
          pos = `on chalcopyrite #${existing_cp2[0].crystal_id}`;
        } else if (existing_py2.length && rng.random() < 0.3) {
          pos = `on pyrite #${existing_py2[0].crystal_id}`;
        }
        const c = this.nucleate('molybdenite', pos, sigma_moly);
        this.log.push(`  ✦ NUCLEATION: Molybdenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_moly.toFixed(2)}) — Mo pulse arriving`);
      }
    }

    // Goethite nucleation — the ghost mineral, now real.
    // Classic pseudomorph after pyrite/marcasite; also forms on dissolving chalcopyrite.
    const sigma_goe = this.conditions.supersaturation_goethite();
    const existing_goe_active = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const total_goe = this.crystals.filter(c => c.mineral === 'goethite').length;
    if (sigma_goe > 1.0 && !existing_goe_active.length && total_goe < 3 && !this._atNucleationCap('goethite')) {
      let pos = 'vug wall';
      const dissolving_py = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      const dissolving_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_hem = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (dissolving_py.length && rng.random() < 0.7) {
        pos = `pseudomorph after pyrite #${dissolving_py[0].crystal_id}`;
      } else if (dissolving_cp.length && rng.random() < 0.5) {
        pos = `pseudomorph after chalcopyrite #${dissolving_cp[0].crystal_id}`;
      } else if (active_hem.length && rng.random() < 0.3) {
        pos = `on hematite #${active_hem[0].crystal_id}`;
      }
      const c = this.nucleate('goethite', pos, sigma_goe);
      this.log.push(`  ✦ NUCLEATION: Goethite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_goe.toFixed(2)})`);
    }

    // Adamite nucleation — Zn + As + O₂, low T oxidation zone
    const sigma_adam = this.conditions.supersaturation_adamite();
    const existing_adam = this.crystals.filter(c => c.mineral === 'adamite' && c.active);
    const total_adam = this.crystals.filter(c => c.mineral === 'adamite').length;
    if (sigma_adam > 1.0 && !existing_adam.length && total_adam < 4 && !this._atNucleationCap('adamite')) {
      let pos = 'vug wall';
      const existing_goe = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      if (existing_goe.length && rng.random() < 0.6) {
        pos = `on goethite #${existing_goe[0].crystal_id}`;
      } else if (existing_hem.length && rng.random() < 0.4) {
        pos = `on hematite #${existing_hem[0].crystal_id}`;
      }
      const c = this.nucleate('adamite', pos, sigma_adam);
      this.log.push(`  ✦ NUCLEATION: Adamite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_adam.toFixed(2)})`);
      // Second crystal — fluorescent/non-fluorescent pair
      if (sigma_adam > 1.3 && rng.random() < 0.5 && !this._atNucleationCap('adamite')) {
        const c2 = this.nucleate('adamite', pos, sigma_adam);
        this.log.push(`  ✦ NUCLEATION: Adamite #${c2.crystal_id} alongside #${c.crystal_id} — will one fluoresce and the other stay dark?`);
      }
    }

    // Mimetite nucleation — Pb + As + Cl + O₂, oxidation zone
    const sigma_mim = this.conditions.supersaturation_mimetite();
    const existing_mim = this.crystals.filter(c => c.mineral === 'mimetite' && c.active);
    const total_mim = this.crystals.filter(c => c.mineral === 'mimetite').length;
    if (sigma_mim > 1.0 && !existing_mim.length && total_mim < 3 && !this._atNucleationCap('mimetite')) {
      let pos = 'vug wall';
      const existing_gal2 = this.crystals.filter(c => c.mineral === 'galena');
      const existing_goe2 = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      if (existing_gal2.length && rng.random() < 0.6) {
        pos = `on galena #${existing_gal2[0].crystal_id}`;
      } else if (existing_goe2.length && rng.random() < 0.3) {
        pos = `on goethite #${existing_goe2[0].crystal_id}`;
      }
      const c = this.nucleate('mimetite', pos, sigma_mim);
      this.log.push(`  ✦ NUCLEATION: Mimetite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mim.toFixed(2)})`);
    }

    // Erythrite nucleation — the cobalt bloom, low-T oxidation of Co arsenides.
    const sigma_ery = this.conditions.supersaturation_erythrite();
    const existing_ery = this.crystals.filter(c => c.mineral === 'erythrite' && c.active);
    if (sigma_ery > 1.0 && !existing_ery.length && !this._atNucleationCap('erythrite')) {
      let pos = 'vug wall';
      const existing_goe_e = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      const existing_adam_e = this.crystals.filter(c => c.mineral === 'adamite' && c.active);
      if (existing_goe_e.length && rng.random() < 0.5) {
        pos = `on goethite #${existing_goe_e[0].crystal_id}`;
      } else if (existing_adam_e.length && rng.random() < 0.3) {
        pos = `on adamite #${existing_adam_e[0].crystal_id}`;
      }
      const c = this.nucleate('erythrite', pos, sigma_ery);
      this.log.push(`  ✦ NUCLEATION: Erythrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ery.toFixed(2)})`);
    }

    // Annabergite nucleation — the nickel bloom, Ni equivalent of erythrite.
    const sigma_ann = this.conditions.supersaturation_annabergite();
    const existing_ann = this.crystals.filter(c => c.mineral === 'annabergite' && c.active);
    if (sigma_ann > 1.0 && !existing_ann.length && !this._atNucleationCap('annabergite')) {
      let pos = 'vug wall';
      const existing_goe_a = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      const existing_ery_a = this.crystals.filter(c => c.mineral === 'erythrite' && c.active);
      if (existing_goe_a.length && rng.random() < 0.5) {
        pos = `on goethite #${existing_goe_a[0].crystal_id}`;
      } else if (existing_ery_a.length && rng.random() < 0.3) {
        pos = `alongside erythrite #${existing_ery_a[0].crystal_id}`;
      }
      const c = this.nucleate('annabergite', pos, sigma_ann);
      this.log.push(`  ✦ NUCLEATION: Annabergite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ann.toFixed(2)})`);
    }

    // Magnetite nucleation — Fe + moderate O2 (HM buffer).
    const sigma_mag = this.conditions.supersaturation_magnetite();
    const existing_mag = this.crystals.filter(c => c.mineral === 'magnetite' && c.active);
    if (sigma_mag > 1.0 && !this._atNucleationCap('magnetite')) {
      if (!existing_mag.length || (sigma_mag > 1.7 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_hem_mag = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
        if (active_hem_mag.length && rng.random() < 0.3) pos = `on hematite #${active_hem_mag[0].crystal_id}`;
        const c = this.nucleate('magnetite', pos, sigma_mag);
        this.log.push(`  ✦ NUCLEATION: Magnetite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mag.toFixed(2)}, Fe=${this.conditions.fluid.Fe.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(2)})`);
      }
    }

    // Lepidocrocite nucleation — Fe + rapid oxidation at low T.
    const sigma_lep = this.conditions.supersaturation_lepidocrocite();
    const existing_lep = this.crystals.filter(c => c.mineral === 'lepidocrocite' && c.active);
    if (sigma_lep > 1.1 && !this._atNucleationCap('lepidocrocite')) {
      if (!existing_lep.length || (sigma_lep > 1.7 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const dissolving_py_lep = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
        const active_qtz_lep = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        if (dissolving_py_lep.length && rng.random() < 0.6) pos = `on pyrite #${dissolving_py_lep[0].crystal_id}`;
        else if (active_qtz_lep.length && rng.random() < 0.3) pos = `on quartz #${active_qtz_lep[0].crystal_id}`;
        const c = this.nucleate('lepidocrocite', pos, sigma_lep);
        this.log.push(`  ✦ NUCLEATION: Lepidocrocite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_lep.toFixed(2)}, Fe=${this.conditions.fluid.Fe.toFixed(0)})`);
      }
    }

    // Stibnite nucleation — Sb + S + moderate T + reducing.
    const sigma_stb = this.conditions.supersaturation_stibnite();
    const existing_stb = this.crystals.filter(c => c.mineral === 'stibnite' && c.active);
    if (sigma_stb > 1.2 && !this._atNucleationCap('stibnite')) {
      if (!existing_stb.length || (sigma_stb > 1.8 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_qtz_stb = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        if (active_qtz_stb.length && rng.random() < 0.4) pos = `on quartz #${active_qtz_stb[0].crystal_id}`;
        const c = this.nucleate('stibnite', pos, sigma_stb);
        this.log.push(`  ✦ NUCLEATION: Stibnite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_stb.toFixed(2)}, Sb=${this.conditions.fluid.Sb.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Bismuthinite nucleation — Bi + S + high T + reducing.
    const sigma_bmt = this.conditions.supersaturation_bismuthinite();
    const existing_bmt = this.crystals.filter(c => c.mineral === 'bismuthinite' && c.active);
    if (sigma_bmt > 1.3 && !this._atNucleationCap('bismuthinite')) {
      if (!existing_bmt.length || (sigma_bmt > 1.8 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_qtz_bmt = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        const active_cp_bmt = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        if (active_qtz_bmt.length && rng.random() < 0.3) pos = `on quartz #${active_qtz_bmt[0].crystal_id}`;
        else if (active_cp_bmt.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_bmt[0].crystal_id}`;
        const c = this.nucleate('bismuthinite', pos, sigma_bmt);
        this.log.push(`  ✦ NUCLEATION: Bismuthinite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_bmt.toFixed(2)}, Bi=${this.conditions.fluid.Bi.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Native bismuth nucleation — Bi + very low S + reducing.
    const sigma_nbi = this.conditions.supersaturation_native_bismuth();
    const existing_nbi = this.crystals.filter(c => c.mineral === 'native_bismuth' && c.active);
    if (sigma_nbi > 1.4 && !this._atNucleationCap('native_bismuth')) {
      if (!existing_nbi.length || (sigma_nbi > 2.0 && rng.random() < 0.15)) {
        let pos = 'vug wall';
        const dissolving_bmt = this.crystals.filter(c => c.mineral === 'bismuthinite' && c.dissolved);
        if (dissolving_bmt.length && rng.random() < 0.5) pos = `on bismuthinite #${dissolving_bmt[0].crystal_id}`;
        const c = this.nucleate('native_bismuth', pos, sigma_nbi);
        this.log.push(`  ✦ NUCLEATION: Native bismuth #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nbi.toFixed(2)}, Bi=${this.conditions.fluid.Bi.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Argentite nucleation — Ag + S + reducing + T > 173°C.
    // High-T sibling of acanthite. Will paramorph on cooling
    // (handled by applyParamorphTransitions in run_step).
    const sigma_arg = this.conditions.supersaturation_argentite();
    if (sigma_arg > 1.0 && !this._atNucleationCap('argentite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_galena_arg = this.crystals.filter(c => c.mineral === 'galena' && c.active);
        if (active_galena_arg.length && rng.random() < 0.4) pos = `on galena #${active_galena_arg[0].crystal_id}`;
        const c = this.nucleate('argentite', pos, sigma_arg);
        this.log.push(`  ✦ NUCLEATION: Argentite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_arg.toFixed(2)}, Ag=${this.conditions.fluid.Ag.toFixed(2)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Chalcanthite nucleation — Cu + S + acidic + oxidizing + concentrated.
    const sigma_cha = this.conditions.supersaturation_chalcanthite();
    if (sigma_cha > 1.0 && !this._atNucleationCap('chalcanthite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const dissolving_brh_cha = this.crystals.filter(c => c.mineral === 'brochantite' && c.dissolved);
        const dissolving_atl_cha = this.crystals.filter(c => c.mineral === 'antlerite' && c.dissolved);
        if (dissolving_brh_cha.length && rng.random() < 0.5) pos = `on brochantite #${dissolving_brh_cha[0].crystal_id}`;
        else if (dissolving_atl_cha.length && rng.random() < 0.4) pos = `on antlerite #${dissolving_atl_cha[0].crystal_id}`;
        const c = this.nucleate('chalcanthite', pos, sigma_cha);
        this.log.push(`  ✦ NUCLEATION: Chalcanthite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cha.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)}, pH=${this.conditions.fluid.pH.toFixed(1)}, salinity=${this.conditions.fluid.salinity.toFixed(1)})`);
      }
    }

    // Descloizite nucleation — Pb + Zn + V + oxidizing.
    const sigma_des = this.conditions.supersaturation_descloizite();
    if (sigma_des > 1.0 && !this._atNucleationCap('descloizite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_van_des = this.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
        if (active_van_des.length && rng.random() < 0.4) pos = `on vanadinite #${active_van_des[0].crystal_id}`;
        const c = this.nucleate('descloizite', pos, sigma_des);
        this.log.push(`  ✦ NUCLEATION: Descloizite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_des.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, Zn=${this.conditions.fluid.Zn.toFixed(0)}, V=${this.conditions.fluid.V.toFixed(1)})`);
      }
    }

    // Mottramite nucleation — Pb + Cu + V + oxidizing.
    const sigma_mot = this.conditions.supersaturation_mottramite();
    if (sigma_mot > 1.0 && !this._atNucleationCap('mottramite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_van_mot = this.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
        if (active_van_mot.length && rng.random() < 0.4) pos = `on vanadinite #${active_van_mot[0].crystal_id}`;
        const c = this.nucleate('mottramite', pos, sigma_mot);
        this.log.push(`  ✦ NUCLEATION: Mottramite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mot.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, V=${this.conditions.fluid.V.toFixed(1)})`);
      }
    }

    // Tungstate pair — raspite + stolzite both PbWO4, kinetic preference
    // dispatcher gives stolzite ~90% of the time.
    let sigma_rasp = this.conditions.supersaturation_raspite();
    const sigma_stol = this.conditions.supersaturation_stolzite();
    if (sigma_rasp > 1.4 && sigma_stol > 1.0 && rng.random() < 0.9) {
      sigma_rasp = 0;
    }
    if (sigma_rasp > 1.4 && !this._atNucleationCap('raspite')) {
      if (rng.random() < 0.16) {
        const c = this.nucleate('raspite', 'vug wall', sigma_rasp);
        this.log.push(`  ✦ NUCLEATION: Raspite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_rasp.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, W=${this.conditions.fluid.W.toFixed(1)})`);
      }
    }
    if (sigma_stol > 1.0 && !this._atNucleationCap('stolzite')) {
      if (rng.random() < 0.18) {
        const c = this.nucleate('stolzite', 'vug wall', sigma_stol);
        this.log.push(`  ✦ NUCLEATION: Stolzite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_stol.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, W=${this.conditions.fluid.W.toFixed(1)})`);
      }
    }

    // Olivenite nucleation — Cu + As + oxidizing.
    const sigma_oli = this.conditions.supersaturation_olivenite();
    if (sigma_oli > 1.0 && !this._atNucleationCap('olivenite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_mal_oli = this.crystals.filter(c => c.mineral === 'malachite' && c.active);
        if (active_mal_oli.length && rng.random() < 0.3) pos = `on malachite #${active_mal_oli[0].crystal_id}`;
        const c = this.nucleate('olivenite', pos, sigma_oli);
        this.log.push(`  ✦ NUCLEATION: Olivenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_oli.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, As=${this.conditions.fluid.As.toFixed(0)})`);
      }
    }

    // Nickeline nucleation — Ni + As + reducing + high T.
    const sigma_nik = this.conditions.supersaturation_nickeline();
    if (sigma_nik > 1.0 && !this._atNucleationCap('nickeline')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_apy_nik = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
        if (active_apy_nik.length && rng.random() < 0.4) pos = `on arsenopyrite #${active_apy_nik[0].crystal_id}`;
        const c = this.nucleate('nickeline', pos, sigma_nik);
        this.log.push(`  ✦ NUCLEATION: Nickeline #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nik.toFixed(2)}, Ni=${this.conditions.fluid.Ni.toFixed(0)}, As=${this.conditions.fluid.As.toFixed(0)})`);
      }
    }

    // Millerite nucleation — Ni + S + reducing + As-poor.
    const sigma_mil = this.conditions.supersaturation_millerite();
    if (sigma_mil > 1.0 && !this._atNucleationCap('millerite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_pyr_mil = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
        if (active_pyr_mil.length && rng.random() < 0.3) pos = `on pyrite #${active_pyr_mil[0].crystal_id}`;
        const c = this.nucleate('millerite', pos, sigma_mil);
        this.log.push(`  ✦ NUCLEATION: Millerite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mil.toFixed(2)}, Ni=${this.conditions.fluid.Ni.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Cobaltite nucleation — three-element gate Co+As+S + reducing + high T.
    const sigma_cob = this.conditions.supersaturation_cobaltite();
    if (sigma_cob > 1.2 && !this._atNucleationCap('cobaltite')) {
      if (rng.random() < 0.16) {
        let pos = 'vug wall';
        const active_apy_cob = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
        if (active_apy_cob.length && rng.random() < 0.5) pos = `on arsenopyrite #${active_apy_cob[0].crystal_id}`;
        const c = this.nucleate('cobaltite', pos, sigma_cob);
        this.log.push(`  ✦ NUCLEATION: Cobaltite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cob.toFixed(2)}, Co=${this.conditions.fluid.Co.toFixed(0)}, As=${this.conditions.fluid.As.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Native tellurium nucleation — Te + reducing + telluride-metal-poor.
    const sigma_nte = this.conditions.supersaturation_native_tellurium();
    if (sigma_nte > 1.0 && !this._atNucleationCap('native_tellurium')) {
      if (rng.random() < 0.16) {
        let pos = 'vug wall';
        const active_au_nte = this.crystals.filter(c => c.mineral === 'native_gold' && c.active);
        if (active_au_nte.length && rng.random() < 0.4) pos = `on native_gold #${active_au_nte[0].crystal_id}`;
        const c = this.nucleate('native_tellurium', pos, sigma_nte);
        this.log.push(`  ✦ NUCLEATION: Native tellurium #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nte.toFixed(2)}, Te=${this.conditions.fluid.Te.toFixed(2)}, Au=${this.conditions.fluid.Au.toFixed(2)})`);
      }
    }

    // Native sulfur nucleation — synproportionation Eh window + acidic + low base metals.
    const sigma_nsu = this.conditions.supersaturation_native_sulfur();
    if (sigma_nsu > 1.0 && !this._atNucleationCap('native_sulfur')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_cel_nsu = this.crystals.filter(c => c.mineral === 'celestine' && c.active);
        const active_arag_nsu = this.crystals.filter(c => c.mineral === 'aragonite' && c.active);
        const active_gyp_nsu = this.crystals.filter(c => c.mineral === 'selenite' && c.active);
        if (active_cel_nsu.length && rng.random() < 0.5) pos = `on celestine #${active_cel_nsu[0].crystal_id}`;
        else if (active_arag_nsu.length && rng.random() < 0.4) pos = `on aragonite #${active_arag_nsu[0].crystal_id}`;
        else if (active_gyp_nsu.length && rng.random() < 0.3) pos = `on selenite #${active_gyp_nsu[0].crystal_id}`;
        const c = this.nucleate('native_sulfur', pos, sigma_nsu);
        this.log.push(`  ✦ NUCLEATION: Native sulfur #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nsu.toFixed(2)}, S=${this.conditions.fluid.S.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(2)}, pH=${this.conditions.fluid.pH.toFixed(1)})`);
      }
    }

    // Native arsenic nucleation — As + strongly_reducing + S<10 + Fe<50.
    // The residual-overflow mineral.
    const sigma_nas = this.conditions.supersaturation_native_arsenic();
    if (sigma_nas > 1.0 && !this._atNucleationCap('native_arsenic')) {
      if (rng.random() < 0.16) {
        let pos = 'vug wall';
        const dissolving_apy_nas = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
        if (dissolving_apy_nas.length && rng.random() < 0.5) pos = `on arsenopyrite #${dissolving_apy_nas[0].crystal_id}`;
        const c = this.nucleate('native_arsenic', pos, sigma_nas);
        this.log.push(`  ✦ NUCLEATION: Native arsenic #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nas.toFixed(2)}, As=${this.conditions.fluid.As.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(1)}, Fe=${this.conditions.fluid.Fe.toFixed(0)})`);
      }
    }

    // Native silver nucleation — Ag + strongly_reducing + S < 2.
    // The depletion mineral. Substrate preferences track the geological
    // pathway: dissolving acanthite (supergene Ag-enrichment route at
    // Tsumeb), dissolving tetrahedrite, or native_copper (Keweenaw
    // co-precipitation in S-poor basalt amygdules).
    const sigma_nag = this.conditions.supersaturation_native_silver();
    if (sigma_nag > 1.2 && !this._atNucleationCap('native_silver')) {
      if (rng.random() < 0.16) {
        let pos = 'vug wall';
        const dissolving_aca_nag = this.crystals.filter(c => c.mineral === 'acanthite' && c.dissolved);
        const dissolving_tet_nag = this.crystals.filter(c => c.mineral === 'tetrahedrite' && c.dissolved);
        const active_ncopper_nag = this.crystals.filter(c => c.mineral === 'native_copper' && c.active);
        if (dissolving_aca_nag.length && rng.random() < 0.6) pos = `on acanthite #${dissolving_aca_nag[0].crystal_id}`;
        else if (dissolving_tet_nag.length && rng.random() < 0.5) pos = `on tetrahedrite #${dissolving_tet_nag[0].crystal_id}`;
        else if (active_ncopper_nag.length && rng.random() < 0.4) pos = `on native_copper #${active_ncopper_nag[0].crystal_id}`;
        const c = this.nucleate('native_silver', pos, sigma_nag);
        this.log.push(`  ✦ NUCLEATION: Native silver #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nag.toFixed(2)}, Ag=${this.conditions.fluid.Ag.toFixed(2)}, S=${this.conditions.fluid.S.toFixed(1)})`);
      }
    }

    // Acanthite nucleation — Ag + S + reducing + T < 173°C.
    // Substrate preference: galena (the classic Ag-bearing parent),
    // dissolving tetrahedrite (often the supergene Ag source), or bare wall.
    // First Ag mineral in the sim — paragenetic successor to galena/
    // tetrahedrite/proustite, predecessor to native_silver in S-depleted pockets.
    const sigma_aca = this.conditions.supersaturation_acanthite();
    if (sigma_aca > 1.0 && !this._atNucleationCap('acanthite')) {
      if (rng.random() < 0.18) {
        let pos = 'vug wall';
        const active_galena_aca = this.crystals.filter(c => c.mineral === 'galena' && c.active);
        const dissolving_tet_aca = this.crystals.filter(c => c.mineral === 'tetrahedrite' && c.dissolved);
        if (active_galena_aca.length && rng.random() < 0.4) pos = `on galena #${active_galena_aca[0].crystal_id}`;
        else if (dissolving_tet_aca.length && rng.random() < 0.6) pos = `on tetrahedrite #${dissolving_tet_aca[0].crystal_id}`;
        const c = this.nucleate('acanthite', pos, sigma_aca);
        this.log.push(`  ✦ NUCLEATION: Acanthite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_aca.toFixed(2)}, Ag=${this.conditions.fluid.Ag.toFixed(2)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Clinobisvanite nucleation — Bi + V + oxidizing + low T.
    const sigma_cbv = this.conditions.supersaturation_clinobisvanite();
    const existing_cbv = this.crystals.filter(c => c.mineral === 'clinobisvanite' && c.active);
    if (sigma_cbv > 1.5 && !this._atNucleationCap('clinobisvanite')) {
      if (!existing_cbv.length || (sigma_cbv > 2.0 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const dissolving_nbi = this.crystals.filter(c => c.mineral === 'native_bismuth' && c.dissolved);
        const dissolving_bmt_cbv = this.crystals.filter(c => c.mineral === 'bismuthinite' && c.dissolved);
        if (dissolving_nbi.length && rng.random() < 0.5) pos = `on native_bismuth #${dissolving_nbi[0].crystal_id}`;
        else if (dissolving_bmt_cbv.length && rng.random() < 0.4) pos = `on bismuthinite #${dissolving_bmt_cbv[0].crystal_id}`;
        const c = this.nucleate('clinobisvanite', pos, sigma_cbv);
        this.log.push(`  ✦ NUCLEATION: Clinobisvanite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cbv.toFixed(2)}, Bi=${this.conditions.fluid.Bi.toFixed(1)}, V=${this.conditions.fluid.V.toFixed(1)})`);
      }
    }

    // Cuprite nucleation — Cu + narrow O₂ window (Eh-boundary mineral).
    const sigma_cpr = this.conditions.supersaturation_cuprite();
    const existing_cpr = this.crystals.filter(c => c.mineral === 'cuprite' && c.active);
    if (sigma_cpr > 1.2 && !this._atNucleationCap('cuprite')) {
      if (!existing_cpr.length || (sigma_cpr > 1.8 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_nc_cpr = this.crystals.filter(c => c.mineral === 'native_copper' && c.active);
        const active_chc_cpr = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
        if (active_nc_cpr.length && rng.random() < 0.6) pos = `on native_copper #${active_nc_cpr[0].crystal_id}`;
        else if (active_chc_cpr.length && rng.random() < 0.3) pos = `on chalcocite #${active_chc_cpr[0].crystal_id}`;
        const c = this.nucleate('cuprite', pos, sigma_cpr);
        this.log.push(`  ✦ NUCLEATION: Cuprite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cpr.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(1)})`);
      }
    }

    // Azurite nucleation — Cu + high CO₃ + O₂ (limestone-hosted Cu deposit).
    const sigma_azr = this.conditions.supersaturation_azurite();
    const existing_azr = this.crystals.filter(c => c.mineral === 'azurite' && c.active);
    if (sigma_azr > 1.4 && !this._atNucleationCap('azurite')) {
      if (!existing_azr.length || (sigma_azr > 2.0 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const active_cpr_azr = this.crystals.filter(c => c.mineral === 'cuprite' && c.active);
        const active_nc_azr = this.crystals.filter(c => c.mineral === 'native_copper' && c.active);
        if (active_cpr_azr.length && rng.random() < 0.4) pos = `on cuprite #${active_cpr_azr[0].crystal_id}`;
        else if (active_nc_azr.length && rng.random() < 0.3) pos = `on native_copper #${active_nc_azr[0].crystal_id}`;
        const c = this.nucleate('azurite', pos, sigma_azr);
        this.log.push(`  ✦ NUCLEATION: Azurite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_azr.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, CO₃=${this.conditions.fluid.CO3.toFixed(0)})`);
      }
    }

    // Chrysocolla nucleation — Cu²⁺ + SiO₂ at low-T oxidation, the
    // cyan finale of the copper paragenesis. Pseudomorphs azurite when
    // the pCO₂ drop arrives with silica — the Bisbee signature.
    const sigma_chry = this.conditions.supersaturation_chrysocolla();
    const existing_chry = this.crystals.filter(c => c.mineral === 'chrysocolla' && c.active);
    if (sigma_chry > 1.2 && !this._atNucleationCap('chrysocolla')) {
      if (!existing_chry.length || (sigma_chry > 1.8 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const active_azr_chry = this.crystals.filter(c => c.mineral === 'azurite' && c.active);
        const dissolving_azr_chry = this.crystals.filter(c => c.mineral === 'azurite' && c.dissolved);
        const active_cpr_chry = this.crystals.filter(c => c.mineral === 'cuprite' && c.active);
        const active_nc_chry = this.crystals.filter(c => c.mineral === 'native_copper' && c.active);
        if (dissolving_azr_chry.length && rng.random() < 0.6) pos = `pseudomorph after azurite #${dissolving_azr_chry[0].crystal_id}`;
        else if (active_azr_chry.length && rng.random() < 0.3) pos = `on azurite #${active_azr_chry[0].crystal_id}`;
        else if (active_cpr_chry.length && rng.random() < 0.5) pos = `on cuprite #${active_cpr_chry[0].crystal_id}`;
        else if (active_nc_chry.length && rng.random() < 0.4) pos = `on native_copper #${active_nc_chry[0].crystal_id}`;
        const c = this.nucleate('chrysocolla', pos, sigma_chry);
        this.log.push(`  ✦ NUCLEATION: Chrysocolla #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_chry.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, SiO₂=${this.conditions.fluid.SiO2.toFixed(0)}, CO₃=${this.conditions.fluid.CO3.toFixed(0)})`);
      }
    }

    // Native copper nucleation — Cu + strongly reducing + low S.
    const sigma_nc = this.conditions.supersaturation_native_copper();
    const existing_nc_nuc = this.crystals.filter(c => c.mineral === 'native_copper' && c.active);
    if (sigma_nc > 1.6 && !this._atNucleationCap('native_copper')) {
      if (!existing_nc_nuc.length || (sigma_nc > 2.2 && rng.random() < 0.15)) {
        let pos = 'vug wall';
        const active_chc_nc = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
        const active_brn_nc = this.crystals.filter(c => c.mineral === 'bornite' && c.active);
        if (active_chc_nc.length && rng.random() < 0.4) pos = `on chalcocite #${active_chc_nc[0].crystal_id}`;
        else if (active_brn_nc.length && rng.random() < 0.3) pos = `on bornite #${active_brn_nc[0].crystal_id}`;
        const c = this.nucleate('native_copper', pos, sigma_nc);
        this.log.push(`  ✦ NUCLEATION: Native copper #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_nc.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, O₂=${this.conditions.fluid.O2.toFixed(2)})`);
      }
    }

    // Native gold nucleation — Au + tolerant of both Eh regimes.
    // Substrate preference: chalcocite (supergene Au-on-chalcocite,
    // Bisbee enrichment-blanket habit) > pyrite (orogenic gold-on-pyrite)
    // > bornite > free vug wall.
    const sigma_au = this.conditions.supersaturation_native_gold();
    const existing_au = this.crystals.filter(c => c.mineral === 'native_gold' && c.active);
    if (sigma_au > 1.0 && !this._atNucleationCap('native_gold')) {
      if (!existing_au.length || (sigma_au > 1.5 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_chc_au = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
        const active_py_au = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
        const active_brn_au = this.crystals.filter(c => c.mineral === 'bornite' && c.active);
        if (active_chc_au.length && rng.random() < 0.4) pos = `on chalcocite #${active_chc_au[0].crystal_id}`;
        else if (active_py_au.length && rng.random() < 0.25) pos = `on pyrite #${active_py_au[0].crystal_id}`;
        else if (active_brn_au.length && rng.random() < 0.2) pos = `on bornite #${active_brn_au[0].crystal_id}`;
        const c = this.nucleate('native_gold', pos, sigma_au);
        this.log.push(`  ✦ NUCLEATION: Native gold #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_au.toFixed(2)}, Au=${this.conditions.fluid.Au.toFixed(2)} ppm)`);
      }
    }

    // Bornite nucleation — Cu + Fe + S, Cu:Fe > 2:1.
    const sigma_brn = this.conditions.supersaturation_bornite();
    const existing_brn = this.crystals.filter(c => c.mineral === 'bornite' && c.active);
    if (sigma_brn > 1.0 && !this._atNucleationCap('bornite')) {
      if (!existing_brn.length || (sigma_brn > 1.7 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const dissolving_cp_brn = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
        const active_cp_brn = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        if (dissolving_cp_brn.length && rng.random() < 0.5) pos = `on chalcopyrite #${dissolving_cp_brn[0].crystal_id}`;
        else if (active_cp_brn.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_brn[0].crystal_id}`;
        const c = this.nucleate('bornite', pos, sigma_brn);
        this.log.push(`  ✦ NUCLEATION: Bornite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_brn.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, Fe=${this.conditions.fluid.Fe.toFixed(0)})`);
      }
    }

    // Chalcocite nucleation — Cu-rich + S + low T + reducing.
    const sigma_chc = this.conditions.supersaturation_chalcocite();
    const existing_chc = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
    if (sigma_chc > 1.1 && !this._atNucleationCap('chalcocite')) {
      if (!existing_chc.length || (sigma_chc > 1.7 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const dissolving_cp_chc = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
        const active_cp_chc = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        const dissolving_brn = this.crystals.filter(c => c.mineral === 'bornite' && c.dissolved);
        const active_brn = this.crystals.filter(c => c.mineral === 'bornite' && c.active);
        if (dissolving_cp_chc.length && rng.random() < 0.6) pos = `on chalcopyrite #${dissolving_cp_chc[0].crystal_id}`;
        else if (active_cp_chc.length && rng.random() < 0.4) pos = `on chalcopyrite #${active_cp_chc[0].crystal_id}`;
        else if (dissolving_brn.length && rng.random() < 0.6) pos = `on bornite #${dissolving_brn[0].crystal_id}`;
        else if (active_brn.length && rng.random() < 0.4) pos = `on bornite #${active_brn[0].crystal_id}`;
        const c = this.nucleate('chalcocite', pos, sigma_chc);
        this.log.push(`  ✦ NUCLEATION: Chalcocite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_chc.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Covellite nucleation — Cu + S-rich + low T (transition zone).
    const sigma_cov = this.conditions.supersaturation_covellite();
    const existing_cov = this.crystals.filter(c => c.mineral === 'covellite' && c.active);
    if (sigma_cov > 1.2 && !this._atNucleationCap('covellite')) {
      if (!existing_cov.length || (sigma_cov > 1.7 && rng.random() < 0.2)) {
        let pos = 'vug wall';
        const active_chc_cov = this.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
        const active_cp_cov = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
        if (active_chc_cov.length && rng.random() < 0.5) pos = `on chalcocite #${active_chc_cov[0].crystal_id}`;
        else if (active_cp_cov.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_cov[0].crystal_id}`;
        const c = this.nucleate('covellite', pos, sigma_cov);
        this.log.push(`  ✦ NUCLEATION: Covellite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cov.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Anglesite nucleation — Pb + oxidized S + O₂ (supergene).
    const sigma_ang = this.conditions.supersaturation_anglesite();
    const existing_ang = this.crystals.filter(c => c.mineral === 'anglesite' && c.active);
    if (sigma_ang > 1.1 && !this._atNucleationCap('anglesite')) {
      if (!existing_ang.length || (sigma_ang > 1.8 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const dissolving_gal = this.crystals.filter(c => c.mineral === 'galena' && (c.dissolved || rng.random() < 0.6));
        const active_gal_ang = this.crystals.filter(c => c.mineral === 'galena' && c.active);
        if (dissolving_gal.length && rng.random() < 0.6) pos = `on galena #${dissolving_gal[0].crystal_id}`;
        else if (active_gal_ang.length && rng.random() < 0.4) pos = `on galena #${active_gal_ang[0].crystal_id}`;
        const c = this.nucleate('anglesite', pos, sigma_ang);
        this.log.push(`  ✦ NUCLEATION: Anglesite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ang.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, S=${this.conditions.fluid.S.toFixed(0)})`);
      }
    }

    // Cerussite nucleation — Pb + CO₃ (supergene).
    const sigma_cer = this.conditions.supersaturation_cerussite();
    const existing_cer = this.crystals.filter(c => c.mineral === 'cerussite' && c.active);
    if (sigma_cer > 1.0 && !this._atNucleationCap('cerussite')) {
      if (!existing_cer.length || (sigma_cer > 1.8 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const dissolving_ang = this.crystals.filter(c => c.mineral === 'anglesite' && c.dissolved);
        const dissolving_gal_c = this.crystals.filter(c => c.mineral === 'galena' && c.dissolved);
        const active_gal_c = this.crystals.filter(c => c.mineral === 'galena' && c.active);
        if (dissolving_ang.length && rng.random() < 0.7) pos = `on anglesite #${dissolving_ang[0].crystal_id}`;
        else if (dissolving_gal_c.length && rng.random() < 0.5) pos = `on galena #${dissolving_gal_c[0].crystal_id}`;
        else if (active_gal_c.length && rng.random() < 0.3) pos = `on galena #${active_gal_c[0].crystal_id}`;
        const c = this.nucleate('cerussite', pos, sigma_cer);
        this.log.push(`  ✦ NUCLEATION: Cerussite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cer.toFixed(2)}, Pb=${this.conditions.fluid.Pb.toFixed(0)}, CO3=${this.conditions.fluid.CO3.toFixed(0)})`);
      }
    }

    // Pyromorphite nucleation — Pb + P + Cl (supergene, P-gated).
    const sigma_pyr = this.conditions.supersaturation_pyromorphite();
    const existing_pyr = this.crystals.filter(c => c.mineral === 'pyromorphite' && c.active);
    if (sigma_pyr > 1.2 && !this._atNucleationCap('pyromorphite')) {
      if (!existing_pyr.length || (sigma_pyr > 1.8 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const dissolving_cer_p = this.crystals.filter(c => c.mineral === 'cerussite' && c.dissolved);
        const active_cer_p = this.crystals.filter(c => c.mineral === 'cerussite' && c.active);
        const existing_goe_pyr = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
        if (dissolving_cer_p.length && rng.random() < 0.6) pos = `on cerussite #${dissolving_cer_p[0].crystal_id}`;
        else if (active_cer_p.length && rng.random() < 0.3) pos = `on cerussite #${active_cer_p[0].crystal_id}`;
        else if (existing_goe_pyr.length && rng.random() < 0.3) pos = `on goethite #${existing_goe_pyr[0].crystal_id}`;
        const c = this.nucleate('pyromorphite', pos, sigma_pyr);
        this.log.push(`  ✦ NUCLEATION: Pyromorphite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_pyr.toFixed(2)}, P=${this.conditions.fluid.P.toFixed(1)}, Cl=${this.conditions.fluid.Cl.toFixed(0)})`);
      }
    }

    // Vanadinite nucleation — Pb + V + Cl (supergene, V-gated).
    const sigma_vnd = this.conditions.supersaturation_vanadinite();
    const existing_vnd = this.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
    if (sigma_vnd > 1.3 && !this._atNucleationCap('vanadinite')) {
      if (!existing_vnd.length || (sigma_vnd > 1.8 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const existing_goe_vnd = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
        const dissolving_cer_v = this.crystals.filter(c => c.mineral === 'cerussite' && c.dissolved);
        if (existing_goe_vnd.length && rng.random() < 0.7) pos = `on goethite #${existing_goe_vnd[0].crystal_id}`;
        else if (dissolving_cer_v.length && rng.random() < 0.4) pos = `on cerussite #${dissolving_cer_v[0].crystal_id}`;
        const c = this.nucleate('vanadinite', pos, sigma_vnd);
        this.log.push(`  ✦ NUCLEATION: Vanadinite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_vnd.toFixed(2)}, V=${this.conditions.fluid.V.toFixed(1)}, Pb=${this.conditions.fluid.Pb.toFixed(0)})`);
      }
    }

    // Spodumene nucleation — Li + Al + SiO₂ (Li-gated, σ > 1.5).
    // Lithium competes with elbaite tourmaline for the same fluid Li —
    // spodumene also needs a hotter fluid (T > 400°C), so pocket
    // paragenesis tends to see schorl → spodumene → elbaite as the
    // fluid cools and Li remains. max_nucleation_count=4.
    const sigma_spd = this.conditions.supersaturation_spodumene();
    const existing_spd = this.crystals.filter(c => c.mineral === 'spodumene' && c.active);
    if (sigma_spd > 1.5 && !this._atNucleationCap('spodumene')) {
      if (!existing_spd.length || (sigma_spd > 2.5 && rng.random() < 0.15)) {
        let pos = 'vug wall';
        const existing_qtz_spd = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        const existing_feld_spd = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
        if (existing_qtz_spd.length && rng.random() < 0.35) {
          pos = `on quartz #${existing_qtz_spd[0].crystal_id}`;
        } else if (existing_feld_spd.length && rng.random() < 0.35) {
          pos = `on feldspar #${existing_feld_spd[0].crystal_id}`;
        }
        const c = this.nucleate('spodumene', pos, sigma_spd);
        const f = this.conditions.fluid;
        let tag;
        if (f.Cr > 0.5) tag = 'hiddenite';
        else if (f.Mn > 2.0) tag = 'kunzite';
        else if (f.Fe > 10) tag = 'triphane-yellow';
        else tag = 'triphane';
        this.log.push(`  ✦ NUCLEATION: Spodumene #${c.crystal_id} (${tag}) on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_spd.toFixed(2)}, Li=${f.Li.toFixed(0)} ppm, Mn=${f.Mn.toFixed(1)}, Cr=${f.Cr.toFixed(2)})`);
      }
    }

    // Beryl family nucleation — Be + Al + SiO₂ with chromophore dispatch.
    // Post-Round-7: 5 species (emerald/morganite/heliodor/aquamarine/
    // goshenite(beryl)) each nucleate via their own supersaturation
    // function, which encodes the priority chain through exclusion
    // preconditions. Dispatch evaluates each in priority order and fires
    // AT MOST ONE per step — the shared Be pool would otherwise let two
    // siblings over-nucleate.
    const beryl_family_candidates = [
      ['emerald', this.conditions.supersaturation_emerald(), 1.4],
      ['morganite', this.conditions.supersaturation_morganite(), 1.4],
      ['heliodor', this.conditions.supersaturation_heliodor(), 1.4],
      ['aquamarine', this.conditions.supersaturation_aquamarine(), 1.3],
      ['beryl', this.conditions.supersaturation_beryl(), 1.8],
    ];
    const existing_qtz_ber = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    const existing_feld_ber = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
    for (const [species, sigma_bf, threshold] of beryl_family_candidates) {
      if (sigma_bf <= threshold) continue;
      if (this._atNucleationCap(species)) continue;
      const existing_sp = this.crystals.filter(c => c.mineral === species && c.active);
      if (existing_sp.length && !(sigma_bf > threshold + 0.7 && rng.random() < 0.15)) continue;
      let pos = 'vug wall';
      if (existing_qtz_ber.length && rng.random() < 0.4) {
        pos = `on quartz #${existing_qtz_ber[0].crystal_id}`;
      } else if (existing_feld_ber.length && rng.random() < 0.4) {
        pos = `on feldspar #${existing_feld_ber[0].crystal_id}`;
      }
      const c = this.nucleate(species, pos, sigma_bf);
      const f = this.conditions.fluid;
      const speciesCap = species.charAt(0).toUpperCase() + species.slice(1);
      this.log.push(`  ✦ NUCLEATION: ${speciesCap} #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_bf.toFixed(2)}, Be=${f.Be.toFixed(0)} ppm, Cr=${f.Cr.toFixed(2)}, Fe=${f.Fe.toFixed(0)}, Mn=${f.Mn.toFixed(2)})`);
      break;  // only one beryl-family nucleation per step
    }

    // Corundum family nucleation — Al₂O₃ with SiO₂-undersaturation upper gate.
    // Priority: ruby > sapphire > corundum. One per step (shared Al pool).
    const corundum_family_candidates = [
      ['ruby', this.conditions.supersaturation_ruby(), 1.5],
      ['sapphire', this.conditions.supersaturation_sapphire(), 1.4],
      ['corundum', this.conditions.supersaturation_corundum(), 1.3],
    ];
    for (const [species, sigma_cf, threshold] of corundum_family_candidates) {
      if (sigma_cf <= threshold) continue;
      if (this._atNucleationCap(species)) continue;
      const existing_sp = this.crystals.filter(c => c.mineral === species && c.active);
      if (existing_sp.length && !(sigma_cf > threshold + 0.5 && rng.random() < 0.2)) continue;
      const pos = 'vug wall';
      const c = this.nucleate(species, pos, sigma_cf);
      const f = this.conditions.fluid;
      const speciesCap = species.charAt(0).toUpperCase() + species.slice(1);
      this.log.push(`  ✦ NUCLEATION: ${speciesCap} #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cf.toFixed(2)}, Al=${f.Al.toFixed(0)}, SiO2=${f.SiO2.toFixed(0)}, Cr=${f.Cr.toFixed(2)}, Fe=${f.Fe.toFixed(1)}, Ti=${f.Ti.toFixed(2)})`);
      break;  // only one corundum-family nucleation per step
    }

    // Tourmaline nucleation — Na + B + Al + SiO₂ (B-gated, σ=1.3).
    // Schorl (Fe²⁺-dominant black) early, elbaite varieties (rubellite,
    // verdelite, indicolite, Paraíba) late as Fe depletes and Li
    // accumulates. Nucleation label previews the variety likely to grow.
    const sigma_tml = this.conditions.supersaturation_tourmaline();
    const existing_tml = this.crystals.filter(c => c.mineral === 'tourmaline' && c.active);
    if (sigma_tml > 1.3 && !this._atNucleationCap('tourmaline')) {
      if (!existing_tml.length || (sigma_tml > 2.0 && rng.random() < 0.25)) {
        let pos = 'vug wall';
        const existing_qtz_tml = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        const existing_feldspar_tml = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
        if (existing_qtz_tml.length && rng.random() < 0.4) {
          pos = `on quartz #${existing_qtz_tml[0].crystal_id}`;
        } else if (existing_feldspar_tml.length && rng.random() < 0.4) {
          pos = `on feldspar #${existing_feldspar_tml[0].crystal_id}`;
        }
        const c = this.nucleate('tourmaline', pos, sigma_tml);
        const f = this.conditions.fluid;
        let tag;
        if (f.Cu > 1.0) tag = 'Paraíba';
        else if (f.Li > 10 && f.Mn > 0.3) tag = 'rubellite';
        else if (f.Li > 10 && (f.Cr > 0.5 || f.V > 1.0)) tag = 'verdelite';
        else if (f.Fe > 15 && f.Li < 5) tag = 'schorl';
        else if (f.Li > 10) tag = 'elbaite';
        else tag = 'mixed';
        this.log.push(`  ✦ NUCLEATION: Tourmaline #${c.crystal_id} (${tag}) on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_tml.toFixed(2)}, B=${f.B.toFixed(0)} ppm, Fe=${f.Fe.toFixed(0)}, Li=${f.Li.toFixed(0)})`);
      }
    }

    // Topaz nucleation — Al + SiO₂ + F (F-gated, nucleation_sigma=1.4).
    // Threshold is the Ouro Preto gate: early quartz grows alone while
    // fluorine accumulates; topaz appears only when F crosses saturation.
    // Often grows on quartz (vein-lining paragenesis).
    const sigma_tpz = this.conditions.supersaturation_topaz();
    const existing_tpz = this.crystals.filter(c => c.mineral === 'topaz' && c.active);
    if (sigma_tpz > 1.4 && !this._atNucleationCap('topaz')) {
      if (!existing_tpz.length || (sigma_tpz > 2.0 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const existing_qtz_tpz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
        if (existing_qtz_tpz.length && rng.random() < 0.5) {
          pos = `on quartz #${existing_qtz_tpz[0].crystal_id}`;
        }
        const c = this.nucleate('topaz', pos, sigma_tpz);
        const imperial = this.conditions.fluid.Cr > 3.0;
        const flag = imperial ? ' ✨ imperial color window open' : '';
        this.log.push(`  ✦ NUCLEATION: Topaz #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_tpz.toFixed(2)}, F=${this.conditions.fluid.F.toFixed(0)} ppm, Cr=${this.conditions.fluid.Cr.toFixed(1)} ppm)${flag}`);
      }
    }

    // Rosasite nucleation — Cu-dominant supergene carbonate (Round 9a).
    // The broth-ratio gate (Cu/(Cu+Zn) > 0.5) is enforced inside
    // supersaturation_rosasite, so we don't double-check here. Substrate
    // preference: weathering chalcopyrite (Cu source) or weathering
    // sphalerite (Zn co-source), or bare wall.
    const sigma_ros = this.conditions.supersaturation_rosasite();
    if (sigma_ros > 1.0 && !this._atNucleationCap('rosasite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_cpy = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
        const weathering_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
        if (weathering_cpy.length && rng.random() < 0.4) {
          pos = `on weathering chalcopyrite #${weathering_cpy[0].crystal_id}`;
        } else if (weathering_sph.length && rng.random() < 0.3) {
          pos = `on weathering sphalerite #${weathering_sph[0].crystal_id}`;
        }
        const c = this.nucleate('rosasite', pos, sigma_ros);
        const cu_zn = this.conditions.fluid.Cu + this.conditions.fluid.Zn;
        const cu_pct = cu_zn > 0 ? (this.conditions.fluid.Cu / cu_zn * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Rosasite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_ros.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, Zn=${this.conditions.fluid.Zn.toFixed(0)}, Cu-fraction=${cu_pct.toFixed(0)}%) — broth-ratio branch: Cu-dominant`);
      }
    }

    // Aurichalcite nucleation — Zn-dominant supergene carbonate (Round 9a).
    // Mirror of rosasite. Substrate preference: weathering sphalerite or
    // adjacent active rosasite (the two species are commonly intergrown).
    const sigma_aur = this.conditions.supersaturation_aurichalcite();
    if (sigma_aur > 1.0 && !this._atNucleationCap('aurichalcite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
        const active_ros = this.crystals.filter(c => c.mineral === 'rosasite' && c.active);
        if (weathering_sph.length && rng.random() < 0.4) {
          pos = `on weathering sphalerite #${weathering_sph[0].crystal_id}`;
        } else if (active_ros.length && rng.random() < 0.4) {
          pos = `adjacent to rosasite #${active_ros[0].crystal_id}`;
        }
        const c = this.nucleate('aurichalcite', pos, sigma_aur);
        const cu_zn = this.conditions.fluid.Cu + this.conditions.fluid.Zn;
        const zn_pct = cu_zn > 0 ? (this.conditions.fluid.Zn / cu_zn * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Aurichalcite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_aur.toFixed(2)}, Cu=${this.conditions.fluid.Cu.toFixed(0)}, Zn=${this.conditions.fluid.Zn.toFixed(0)}, Zn-fraction=${zn_pct.toFixed(0)}%) — broth-ratio branch: Zn-dominant`);
      }
    }

    // Torbernite nucleation — P-branch of the uranyl anion-competition
    // trio (Round 9b). Substrate preference: weathering uraninite or wall.
    const sigma_tor = this.conditions.supersaturation_torbernite();
    if (sigma_tor > 1.0 && !this._atNucleationCap('torbernite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        if (weathering_urn.length && rng.random() < 0.5) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        }
        const c = this.nucleate('torbernite', pos, sigma_tor);
        const p_as = this.conditions.fluid.P + this.conditions.fluid.As;
        const p_pct = p_as > 0 ? (this.conditions.fluid.P / p_as * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Torbernite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_tor.toFixed(2)}, U=${this.conditions.fluid.U.toFixed(2)}, P=${this.conditions.fluid.P.toFixed(1)}, As=${this.conditions.fluid.As.toFixed(1)}, P-fraction=${p_pct.toFixed(0)}%) — anion-competition branch: P-dominant`);
      }
    }

    // Zeunerite nucleation — As-branch of the uranyl anion-competition trio.
    const sigma_zeu = this.conditions.supersaturation_zeunerite();
    if (sigma_zeu > 1.0 && !this._atNucleationCap('zeunerite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        const weathering_apy = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
        const active_tor = this.crystals.filter(c => c.mineral === 'torbernite' && c.active);
        if (weathering_urn.length && rng.random() < 0.4) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        } else if (weathering_apy.length && rng.random() < 0.4) {
          pos = `on weathering arsenopyrite #${weathering_apy[0].crystal_id}`;
        } else if (active_tor.length && rng.random() < 0.3) {
          pos = `adjacent to torbernite #${active_tor[0].crystal_id}`;
        }
        const c = this.nucleate('zeunerite', pos, sigma_zeu);
        const p_as = this.conditions.fluid.P + this.conditions.fluid.As;
        const as_pct = p_as > 0 ? (this.conditions.fluid.As / p_as * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Zeunerite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_zeu.toFixed(2)}, U=${this.conditions.fluid.U.toFixed(2)}, P=${this.conditions.fluid.P.toFixed(1)}, As=${this.conditions.fluid.As.toFixed(1)}, As-fraction=${as_pct.toFixed(0)}%) — anion-competition branch: As-dominant`);
      }
    }

    // Carnotite nucleation — V-branch of the uranyl anion-competition trio (Round 9c).
    // Substrate preference: weathering uraninite (U source) or "organic-rich" position
    // via Fe>5 + low-T proxy (real carnotite famously concentrates around petrified
    // wood; sim doesn't track organic matter as a separate species).
    const sigma_car = this.conditions.supersaturation_carnotite();
    if (sigma_car > 1.0 && !this._atNucleationCap('carnotite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        if (weathering_urn.length && rng.random() < 0.5) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        } else if (this.conditions.fluid.Fe > 5 && this.conditions.temperature < 30 && rng.random() < 0.3) {
          pos = 'around organic carbon (roll-front position)';
        }
        const c = this.nucleate('carnotite', pos, sigma_car);
        const anion_total = this.conditions.fluid.P + this.conditions.fluid.As + this.conditions.fluid.V;
        const v_pct = anion_total > 0 ? (this.conditions.fluid.V / anion_total * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Carnotite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_car.toFixed(2)}, K=${this.conditions.fluid.K.toFixed(0)}, U=${this.conditions.fluid.U.toFixed(2)}, V=${this.conditions.fluid.V.toFixed(1)}, V-fraction=${v_pct.toFixed(0)}%) — anion-competition branch: V-dominant`);
      }
    }

    // Autunite nucleation — Ca-branch of the uranyl cation+anion fork
    // (Round 9d, May 2026). Substrate preference: weathering uraninite
    // (canonical paragenesis). The cation fork (Ca/(Cu+Ca)>0.5) is enforced
    // inside supersaturation_autunite — we don't double-check here.
    const sigma_aut = this.conditions.supersaturation_autunite();
    if (sigma_aut > 1.0 && !this._atNucleationCap('autunite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        if (weathering_urn.length && rng.random() < 0.5) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        }
        const c = this.nucleate('autunite', pos, sigma_aut);
        const cation_total = this.conditions.fluid.Cu + this.conditions.fluid.Ca;
        const ca_pct = cation_total > 0 ? (this.conditions.fluid.Ca / cation_total * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Autunite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_aut.toFixed(2)}, Ca=${this.conditions.fluid.Ca.toFixed(0)}, U=${this.conditions.fluid.U.toFixed(2)}, P=${this.conditions.fluid.P.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the P-branch`);
      }
    }

    // Uranospinite nucleation — Ca-branch / As-anion of the autunite-
    // group fork (Round 9e). Substrate preference: weathering uraninite
    // OR weathering arsenopyrite OR active zeunerite (the Cu-cation
    // partner often co-mineralizes at Schneeberg).
    const sigma_uros = this.conditions.supersaturation_uranospinite();
    if (sigma_uros > 1.0 && !this._atNucleationCap('uranospinite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        const weathering_apy = this.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
        const active_zeu = this.crystals.filter(c => c.mineral === 'zeunerite' && c.active);
        if (weathering_urn.length && rng.random() < 0.4) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        } else if (weathering_apy.length && rng.random() < 0.4) {
          pos = `on weathering arsenopyrite #${weathering_apy[0].crystal_id}`;
        } else if (active_zeu.length && rng.random() < 0.3) {
          pos = `adjacent to zeunerite #${active_zeu[0].crystal_id}`;
        }
        const c = this.nucleate('uranospinite', pos, sigma_uros);
        const cation_total = this.conditions.fluid.Cu + this.conditions.fluid.Ca;
        const ca_pct = cation_total > 0 ? (this.conditions.fluid.Ca / cation_total * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Uranospinite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_uros.toFixed(2)}, Ca=${this.conditions.fluid.Ca.toFixed(0)}, U=${this.conditions.fluid.U.toFixed(2)}, As=${this.conditions.fluid.As.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the As-branch`);
      }
    }

    // Tyuyamunite nucleation — Ca-branch / V-anion of the autunite-group
    // fork (Round 9e). Substrate preference: weathering uraninite OR
    // active carnotite (the K-cation partner often intergrown in Colorado
    // Plateau and Tyuya-Muyun deposits) OR roll-front position.
    const sigma_tyu = this.conditions.supersaturation_tyuyamunite();
    if (sigma_tyu > 1.0 && !this._atNucleationCap('tyuyamunite')) {
      if (rng.random() < 0.20) {
        let pos = 'vug wall';
        const weathering_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
        const active_car = this.crystals.filter(c => c.mineral === 'carnotite' && c.active);
        if (weathering_urn.length && rng.random() < 0.4) {
          pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
        } else if (active_car.length && rng.random() < 0.4) {
          pos = `adjacent to carnotite #${active_car[0].crystal_id}`;
        } else if (this.conditions.fluid.Fe > 5 && this.conditions.temperature < 30 && rng.random() < 0.3) {
          pos = 'around organic carbon (roll-front position)';
        }
        const c = this.nucleate('tyuyamunite', pos, sigma_tyu);
        const cation_total = this.conditions.fluid.K + this.conditions.fluid.Ca;
        const ca_pct = cation_total > 0 ? (this.conditions.fluid.Ca / cation_total * 100) : 0;
        this.log.push(`  ✦ NUCLEATION: Tyuyamunite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_tyu.toFixed(2)}, Ca=${this.conditions.fluid.Ca.toFixed(0)}, U=${this.conditions.fluid.U.toFixed(2)}, V=${this.conditions.fluid.V.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the V-branch`);
      }
    }
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
      const mineralVols = {};
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
      const mineralVols = {};
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
      const nuc_steps = [...new Set(later_crystals.map(c => c.nucleation_step))].sort((a, b) => a - b);
      const untriggeredByMineral = {};
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
