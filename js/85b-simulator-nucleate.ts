// ============================================================
// js/85b-simulator-nucleate.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (7): nucleate, _rollSpontaneousTwin, _spaceIsCrowded, _atNucleationCap, _assignWallCell, _runEngineForCrystal, _assignWallRing.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
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
},

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
},

  _spaceIsCrowded() {
  // Fraction of ring-0 cells already claimed. Habit selection uses
  // this to penalize projecting variants when the vug is filling up.
  const ring0 = this.wall_state?.rings?.[0];
  if (!ring0 || !ring0.length) return false;
  const occupied = ring0.reduce((n, c) => n + (c.crystal_id != null ? 1 : 0), 0);
  return (occupied / ring0.length) >= 0.5;
},

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
},

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
},

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
},

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
},
});
