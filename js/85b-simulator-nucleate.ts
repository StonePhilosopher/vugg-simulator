// ============================================================
// js/85b-simulator-nucleate.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (9): nucleate, _rollSpontaneousTwin, _spaceIsCrowded, _atNucleationCap, _assignWallCell, _pickSubstrate, _sigmaDiscountForPosition, _runEngineForCrystal, _assignWallRing.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  nucleate(mineral, position = 'vug wall', sigma = 1.0) {
  this.crystal_counter++;
  // vug_diameter_mm is captured at nucleation so add_zone can cap
  // dimensions against it (BUG-CRYSTALS-CLIP-VUG-WALL.md Tier-2 fix).
  // Read live from the wall (it grows as dissolution erodes); each
  // crystal stores the value at its own birth, which is a slight
  // simplification — a crystal nucleated in a 30 mm cavity that later
  // dissolves to 60 mm will still cap against 30. Acceptable for v1
  // since the cap matters most for runaway growth in small cavities.
  const vugDiameterAtBirth = this.conditions?.wall?.vug_diameter_mm ?? 0;
  const crystal = new Crystal({
    mineral, crystal_id: this.crystal_counter,
    nucleation_step: this.step,
    nucleation_temp: this.conditions.temperature,
    position,
    vug_diameter_mm: vugDiameterAtBirth,
  });

  // Pick a growth-vector variant from the spec. Its name sets the habit
  // and its wall_spread/void_reach/vector populate the topo-map
  // footprint. Falls back to legacy defaults below if the mineral has
  // no variant objects in the spec.
  const variant = selectHabitVariant(
    mineral, sigma, this.conditions.temperature, this._spaceIsCrowded(),
    // Proposal B (2026-05): pass current vugFill so habit variants can
    // gate on it. Stashed by check_nucleation each step. Undefined for
    // legacy non-step nucleations (preview/library) — selectHabitVariant
    // skips the fill scoring branch when undefined.
    this._currentVugFill,
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
  // PHASE-4-CAVITY-MESH (PROPOSAL-CAVITY-MESH §13 Tranche 4b) —
  // assign the spherical-coordinate anchor directly; legacy
  // wall_ring_index / wall_center_cell fields retired in this
  // tranche. Anchor pickers still return (ringIdx, cellIdx) under
  // the hood (Phase 2's lat-long tessellation) — _anchorFromRingCell
  // wraps them into the canonical anchor record.
  //
  // ORDER MATTERS: _assignWallCell runs before _assignWallRing,
  // matching the pre-Tranche-4b sequence. Both consume from the
  // shared RNG; swapping them shifts every downstream nucleation
  // anchor and rebakes every calibration baseline. Keep this order.
  //
  // Tranche 6 of PROPOSAL-CAVITY-MESH §14: when
  // wall_state.per_vertex_nucleation is on AND we're not inheriting
  // a host's cell, _assignWallCell does the joint σ-weighted sample
  // over all (ring, cell) pairs for `mineral` and stashes the picked
  // ring on `this._lastNucVertexRing`. _assignWallRing reads that
  // stash instead of running its own area-weighted draw, so the
  // ring + cell come from the same joint sample. Default-off scenarios
  // keep the legacy two-step path.
  this._lastNucVertexRing = null;
  const _cellIdx = this._assignWallCell(position, mineral);
  const _ringIdx = this._assignWallRing(position, mineral);
  crystal.wall_anchor = this.wall_state._anchorFromRingCell(_ringIdx, _cellIdx);

  // v24 water-level: stamp growth_environment from the ring's
  // water state. Submerged or meniscus = wet = 'fluid'; vadose
  // (above the meniscus) = 'air'. Mirrors vugg.py.
  //
  // PROPOSAL-HABIT-BIAS Slice 2: scenarios with wall.air_mode_default
  // (cave-style cavities — air-filled from step 0) override to 'air'
  // unconditionally. The flag wins over water-state because a cave
  // that's also flagged as having fluid is a contradiction; treat
  // the flag as the modeler's intent.
  {
    const wstate = this.conditions.ringWaterState(
      _ringIdx, this.wall_state.ring_count);
    if (this.conditions.wall?.air_mode_default) {
      crystal.growth_environment = 'air';
    } else {
      crystal.growth_environment = (wstate === 'vadose') ? 'air' : 'fluid';
    }
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

  // Q2a — paragenesis CDR tagging. If the position string identifies
  // a host crystal AND (host.mineral, this.mineral) matches a
  // documented PSEUDOMORPH_ROUTES entry, tag this crystal as a CDR
  // pseudomorph: cdr_replaces_crystal_id points to the host;
  // perimorph_eligible flags shape_preserved=true routes for Q4. The
  // host doesn't need to be dissolved at this moment — the position
  // string already encoded the engine's intent ("on dissolved X",
  // "pseudomorph after X", "on weathering X", or even "on X" when
  // the route is documented). Q3 renderer reads cdr_replaces_crystal_id
  // to inherit parent outline; Q4 renderer reads perimorph_eligible.
  {
    const parsed = parsePositionHost(position, this.crystals);
    if (parsed && parsed.host) {
      const route = findPseudomorphRoute(parsed.host.mineral, mineral);
      if (route) {
        crystal.cdr_replaces_crystal_id = parsed.host.crystal_id;
        crystal.perimorph_eligible = route.shape_preserved;
      }
    }
  }

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
  // True if the mineral cannot nucleate right now. Two reasons:
  //
  // (A) Proposal A (2026-05): probabilistic fill dampener. The
  //     simulator's check_nucleation computes a sigmoid each step
  //     (1 / (1 + exp(20 * (vugFill - 0.85))), capped at 1.0) and
  //     stashes it on this._fillDampener. When the dampener < 1.0,
  //     this helper rolls one RNG number per call; if the roll fails
  //     the mineral is blocked for this step. Geological motivation:
  //     mass transport to crystal surfaces becomes diffusion-limited
  //     well before the cavity is geometrically full (Tenthorey &
  //     Cox 1998 — permeability falls 10x at ~80-85% fill while
  //     porosity barely drops).
  //
  //     Replaces Backlog K's binary `if (_fillCapped) return true`
  //     gate. fill_exempt minerals (borax, mirabilite, thenardite,
  //     sylvite — the playa efflorescent crust set) bypass the
  //     dampener entirely; they always pass this check regardless
  //     of fill. Same geological intent as Backlog K — those
  //     minerals grow on top of existing crystals as coatings, not
  //     in competition for fresh wall.
  //
  //     Below vugFill ~0.7 the dampener is exactly 1.0 and this
  //     branch is a no-op (no RNG consumed). Most scenarios stay
  //     here for their entire run; the 6 high-fill scenarios see
  //     probabilistic drift consistent with regen baselines.
  //
  // (B) Per-mineral count cap. The mineral has hit its spec
  //     max_nucleation_count for crystals *still exposed on the
  //     wall* — enclosed and dissolved crystals don't count toward
  //     the cap because the surface they held is effectively gone
  //     (buried by the host, or etched away).
  //
  //     This is what lets a classic MVT calcite accumulate dense
  //     chalcopyrite inclusion trails: the sulfide nucleates, grows
  //     a little, gets enveloped, and fresh bare wall from the
  //     host's advancing front becomes available for another sulfide
  //     to nucleate. Real specimens can carry hundreds of inclusions.
  const spec = MINERAL_SPEC[mineral];
  const dampener = this._fillDampener;
  if (typeof dampener === 'number' && dampener < 1.0) {
    // Proposal C (2026-05): graduated late-stage propensity. The
    // binary fill_exempt:true gets backward-compat-folded into
    // propensity:1.0. Effective dampener D' = D + p × (1 - D)
    // interpolates between vanilla (p=0) and full-bypass (p=1).
    //
    //   D = 0.12 (vugFill ≈ 0.95), p = 0.0 → D' = 0.12 (bulk mineral)
    //   D = 0.12,                  p = 0.4 → D' = 0.47 (calcite-as-druzy regime)
    //   D = 0.12,                  p = 0.9 → D' = 0.91 (terminal-patina regime)
    //   D = 0.12,                  p = 1.0 → D' = 1.00 (legacy fill_exempt)
    //
    // The cascade-gate-via-bulk-view caveat from sec 12 of HANDOFF-
    // CALIBRATION-AND-COVERAGE.md still applies: a mineral whose
    // sigma engine has a hard cation gate (like native_tellurium's
    // ag_suppr) won't benefit from propensity until that gate is
    // also softened. The two mechanisms compose.
    let propensity = 0.0;
    if (spec) {
      if (typeof spec.late_stage_propensity === 'number') {
        propensity = Math.max(0, Math.min(1, spec.late_stage_propensity));
      } else if (spec.fill_exempt) {
        propensity = 1.0;  // backward compat — fill_exempt:true ≡ propensity:1.0
      }
    }
    const effective = dampener + propensity * (1.0 - dampener);
    if (effective < 1.0 && rng.random() >= effective) return true;
  }
  const cap = spec?.max_nucleation_count;
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

  // Q1a paragenesis hook — consult MINERAL_PARAGENESIS substrate-
  // affinity table for a heterogeneous-nucleation discount on the
  // currently-nucleating mineral. Returns null in Q1a (table is
  // empty); Q1b populates the table with documented MVT/supergene
  // pairs; Q1c wires the discount into the σ-threshold check at
  // nucleation sites. Per-engine inline `if (rng() < 0.7) pos = 'on
  // X #Y'` rules will migrate to this helper as Q1b lands.
  //
  // Returns: { host: Crystal, discount: number } | null.
  _pickSubstrate(mineral) {
    return pickSubstrateForMineral(mineral, this.crystals, rng);
  },

  // Q1c — σ-discount lookup for an already-chosen substrate position.
  // Each engine runs its inline substrate-pick first (so narrative
  // qualifiers like "(oxidized)", "weathering ...", "adjacent to ..."
  // are preserved in the position string), then calls this helper to
  // get the σ-threshold discount factor for the chosen host. The
  // engine's σ-check uses `baseThreshold * discount` instead of
  // `baseThreshold` — heterogeneous nucleation on a documented host
  // clears at a lower σ than bare-wall nucleation, matching the
  // reduced interfacial-free-energy barrier (Putnis 2002 for CDR;
  // Ramdohr 1980 for sulfide epitaxy).
  //
  // Position-string parsing: matches "on <mineral> #<id>" and any
  // qualifier that follows ("(oxidized)", "weathering", "adjacent to",
  // "pseudomorph after", etc.) — the leading `on <mineral>` is what
  // governs the discount; qualifiers are narrative.
  //
  // Returns: discount factor in [0, 1]. 1.0 = no discount (bare wall
  // or undocumented host). 0.5 = strong epitaxy / strong CDR. 0.7 =
  // facet-selective heterogeneous nucleation.
  _sigmaDiscountForPosition(mineral, position) {
    const parsed = parsePositionHost(position, this.crystals);
    if (!parsed) return 1.0;
    return paragenesisDiscount(parsed.hostMineral, mineral);
  },

  _assignWallCell(position, mineral) {
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
    // PHASE-1-CAVITY-MESH: read host's cell via _resolveAnchor so this
    // site keeps working when the legacy fields retire in Phase 4.
    if (host) {
      const a = this.wall_state._resolveAnchor(host);
      if (a) return a.cellIdx;
    }
  }
  // Tranche 6 of PROPOSAL-CAVITY-MESH §14: per-vertex nucleation. When
  // wall.per_vertex_nucleation is on AND we have a mineral name (a
  // free-wall nucleation, not a host inheritance), draw a joint sample
  // over all (ring, cell) pairs weighted by per-cell σ for `mineral`.
  // Stash the picked ring on this._lastNucVertexRing for the
  // immediately-following _assignWallRing call to read.
  //
  // Falls through to legacy random cell when:
  //   * wall.per_vertex_nucleation is false (default)
  //   * mineral is not a string (older internal callers without arg)
  //   * the mineral has no supersaturation_<mineral> method
  //   * the mesh has no cells (sim is mid-init or test harness skipped
  //     bindRingChemistry)
  //   * every candidate cell evaluates to σ ≤ 0 (no supersaturated
  //     locations — gate engines should have caught this upstream, but
  //     defensive fall-through means we still pick A cell instead of
  //     crashing or returning -1)
  if (
    mineral &&
    typeof mineral === 'string' &&
    this.wall_state &&
    this.wall_state.per_vertex_nucleation
  ) {
    const picked = this._perVertexNucleationSample(mineral);
    if (picked) {
      this._lastNucVertexRing = picked.ringIdx;
      return picked.cellIdx;
    }
    // picked === null → fell through; legacy path consumes the RNG
    // number below. _lastNucVertexRing stays null so _assignWallRing
    // also uses its legacy path.
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

// Tranche 6 of PROPOSAL-CAVITY-MESH §14 — joint σ-weighted sample over
// every (ring, cell) pair. Returns { ringIdx, cellIdx } or null if no
// cell evaluates to a positive supersaturation weight (in which case
// the caller falls through to the legacy random sampler).
//
// Weight(r, c) = max(0, σ_at_cell(r, c) − 1.0)²:
//   * σ < 1 (undersaturated or acid-dissolved) → weight 0
//   * σ slightly > 1 (saturation cusp)         → very small weight
//   * σ ≫ 1 (deeply supersaturated)            → strong weight
//
// Quadratic, not linear, so the sampler genuinely prefers high-σ
// locations rather than spreading nucleations roughly evenly across
// all supersaturated cells.
//
// Cost: O(ring_count × cells_per_ring) σ-evaluations per call.
// supersaturation_<mineral>() is ~10-30 ops typically; ~50k ops total
// at default 16×120 resolution. Bounded.
//
// One subtle invariant: the σ helpers read this.conditions.fluid and
// this.conditions.temperature, so we swap those to the per-cell values
// inside the inner loop and restore at the end. The pattern mirrors
// _runEngineForCrystal — same swap/restore, different consumer.
_perVertexNucleationSample(mineral) {
  const wall = this.wall_state;
  if (!wall || !wall.rings || !wall.rings.length) return null;
  const ringCount = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  if (ringCount < 1 || N < 1) return null;

  // Locate the supersaturation method up-front. If it doesn't exist
  // for this mineral, fall through immediately — caller uses legacy
  // path. This is the same name dispatch nucleation engines and the
  // sigma-panel UI use.
  const sigmaFn = this.conditions[`supersaturation_${mineral}`];
  if (typeof sigmaFn !== 'function') return null;

  // Per-vertex chemistry lives on the WallMesh. The mesh is built
  // in the simulator constructor and re-baked on dissolution events
  // (see WallMesh.recompute), so meshFor() returns the live mesh.
  // Each cell's .fluid is an independent clone of its ring's broth
  // (Tranche 4a un-aliasing), evolving under engines + diffusion.
  const mesh = wall.meshFor ? wall.meshFor(this) : null;
  if (!mesh || !mesh.cells || mesh.cells.length < ringCount * N) return null;

  // Pull the per-ring temperature array. ring_temperatures is
  // allocated in the simulator constructor with one slot per ring;
  // engines + events mutate it during cooling/thermal pulses.
  const ringTemps = this.ring_temperatures || [];

  // Save conditions.fluid + .temperature once; swap inside the loop.
  const savedFluid = this.conditions.fluid;
  const savedTemp = this.conditions.temperature;

  const weights = new Float64Array(ringCount * N);
  let total = 0;
  try {
    for (let r = 0; r < ringCount; r++) {
      const tempR = (r < ringTemps.length) ? ringTemps[r] : savedTemp;
      this.conditions.temperature = tempR;
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const cell = mesh.cells[idx];
        const cellFluid = cell ? cell.fluid : null;
        if (!cellFluid) continue;
        this.conditions.fluid = cellFluid;
        let sigma = 0;
        try {
          sigma = sigmaFn.call(this.conditions);
        } catch (_e) {
          // A supersat function that throws (typically a guard
          // returning early on missing fields) → treat as σ=0.
          sigma = 0;
        }
        if (!Number.isFinite(sigma) || sigma <= 1) continue;
        const w = (sigma - 1) * (sigma - 1);
        weights[idx] = w;
        total += w;
      }
    }
  } finally {
    this.conditions.fluid = savedFluid;
    this.conditions.temperature = savedTemp;
  }

  // No supersaturated cells anywhere. Caller's legacy fall-through
  // will pick a random cell + a random ring — the same behavior as
  // an unflagged scenario, which is the right thing when the engine
  // gate has fired but every cell is technically at σ ≤ 1 (a
  // numerical edge case at the threshold).
  if (total <= 0) return null;

  // Joint sample. One RNG draw.
  let r = rng.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return { ringIdx: Math.floor(i / N) | 0, cellIdx: (i % N) | 0 };
    }
  }
  // Float round-off can land just past the last positive-weight slot;
  // walk backwards to the last positive entry as a safe fallback.
  for (let i = weights.length - 1; i >= 0; i--) {
    if (weights[i] > 0) {
      return { ringIdx: Math.floor(i / N) | 0, cellIdx: (i % N) | 0 };
    }
  }
  return null;
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
  // PHASE-1-CAVITY-MESH: read ringIdx through the anchor helper so
  // this site stops touching wall_ring_index directly. Identity
  // result while wall_anchor and legacy fields are kept in sync.
  const anchor = this.wall_state._resolveAnchor(crystal);
  const ringIdx = anchor ? anchor.ringIdx : null;
  let savedFluid = null;
  let savedTemp = null;
  if (ringIdx != null && ringIdx >= 0 && ringIdx < this.ring_fluids.length) {
    savedFluid = this.conditions.fluid;
    savedTemp = this.conditions.temperature;
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — mesh is always built
    // by the time _runEngineForCrystal fires (VugSimulator constructor
    // calls wall_state.meshFor(this)); the cell.fluid read is the
    // canonical per-vertex chemistry handle. Defensive fallback
    // dropped now that the mesh-build is a constructor-invariant.
    const mesh = this.wall_state.meshFor(this);
    const cell = mesh.cellOf(crystal, this.wall_state);
    this.conditions.fluid = (cell && cell.fluid)
      ? cell.fluid
      : this.ring_fluids[ringIdx];  // last-resort sentinel; should never hit
    this.conditions.temperature = this.ring_temperatures[ringIdx];
  }
  try {
    const zone = engine(crystal, this.conditions, this.step);
    // PROPOSAL-GEOLOGICAL-ACCURACY Phase 1 — mass-balance hook.
    // Each precipitation zone debits the per-ring fluid by stoichiometry
    // (per MINERAL_STOICHIOMETRY in 19-mineral-stoichiometry.ts).
    // Returns the list of species that just depleted to zero so we can
    // narrate the event to the player.
    if (zone) {
      const depleted = applyMassBalance(crystal, zone, this.conditions);
      if (depleted && depleted.length) {
        const ringTag = ringIdx != null && ringIdx >= 0
          ? ` in ring ${ringIdx}`
          : '';
        for (const species of depleted) {
          this.log.push(
            `  ⛔ ${species} depleted${ringTag} — ` +
            `${capitalize(crystal.mineral)} #${crystal.crystal_id} growth halts`
          );
        }
      }
    }
    return zone;
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
  // Tranche 6: when _assignWallCell ran the joint σ-weighted sample,
  // it stashed the picked ring on this._lastNucVertexRing. Honor that
  // — both indices come from the same joint draw, so the cell and
  // ring are guaranteed to refer to the same vertex.
  if (this._lastNucVertexRing != null) {
    const r = this._lastNucVertexRing;
    this._lastNucVertexRing = null;  // single-use, reset for next nucleation
    return r;
  }
  let hostId = null;
  const hashIdx = position.indexOf(' #');
  if (hashIdx >= 0) {
    const num = parseInt(position.slice(hashIdx + 2), 10);
    if (!Number.isNaN(num)) hostId = num;
  }
  if (hostId != null) {
    const host = this.crystals.find(c => c.crystal_id === hostId);
    // PHASE-1-CAVITY-MESH: read host's ring via _resolveAnchor so this
    // site survives the Phase 4 legacy-field drop.
    if (host) {
      const a = this.wall_state._resolveAnchor(host);
      if (a) return a.ringIdx;
    }
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
  // PROPOSAL-HOST-ROCK Mechanic 5: architecture-level nucleation bias.
  // Hard filter — zeros out rings whose orientation doesn't match the
  // archetype. Architecture wins over per-mineral preference so basin
  // crystals stay on the floor even if the mineral prefers ceilings.
  // 'uniform' (and missing/null) leaves weights untouched, preserving
  // legacy behavior for scenarios that don't opt in.
  const archBias = this.wall_state.nucleation_bias || 'uniform';
  if (archBias !== 'uniform' && n > 1) {
    total = 0;
    for (let k = 0; k < n; k++) {
      const orient = this.wall_state.ringOrientation(k);
      const allowed =
        archBias === 'walls_only'   ? (orient === 'wall') :
        archBias === 'floor_only'   ? (orient === 'floor') :
        archBias === 'ceiling_only' ? (orient === 'ceiling') :
        true;
      if (!allowed) weights[k] = 0;
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
