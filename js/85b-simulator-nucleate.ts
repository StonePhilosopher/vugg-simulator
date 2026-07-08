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

  // W-F O3a — record this crystal's NUCLEATION ORIENTATION (rigid whole-body
  // tilt off the substrate normal + azimuth) from the isolated orient stream.
  // Zero shared-rng draws → byte-identical. Drawn UNCONDITIONALLY (the draw is
  // free on an isolated stream); GEOMETRIC_SELECTION_ENABLED gates only the
  // READERS (render lean + burial gate, O3b), so selection-off and selection-on
  // see the SAME recorded tilt — the review's disabled-draw invariant. Defensive
  // lazy-init covers non-constructor nucleations (preview/library/test paths).
  const _orientRng = this._orientRng || (this._orientRng = _makeOrientRng(rng.state));
  crystal._nucTilt = drawNucleationTilt(_orientRng);

  this.crystals.push(crystal);
  return crystal;
},

  // W-F O3b — GEOMETRIC SELECTION burial pass (Kolmogorov 1949 / van der Drift
  // 1967). Runs ONCE per step BEFORE the growth loop (js/85 run_step), gated by
  // GEOMETRIC_SELECTION_ENABLED (js/44a) — a no-op, byte-identical, when off.
  //
  // A crystal is BURIED (arrested — active=false, the same handle the world-
  // record size cap uses) when a NEIGHBOR that is more wall-normal has grown its
  // front more than O3_BURY_GAP_MM past this crystal's own front: the more-normal
  // neighbor has overtaken and sealed it off. Survivors are the near-normal ones;
  // the base of a druse keeps the short tilted losers — the palisade EARNED.
  //
  // DETERMINISM: every crystal's front + tilt is SNAPSHOT before any burial is
  // marked, and the neighbor test reads only the snapshot (never live .active),
  // so the pass is order-independent — burial is decided simultaneously on the
  // step-start configuration. Once buried, active=false is permanent (a sealed
  // crystal never resumes; its front freezes while neighbors advance, so the
  // lead only widens). Exempts air-mode (gravity-oriented stalactites/-mites)
  // and enclosed/overgrowth crystals (templated, not free-wall competitors).
  _applyGeometricSelection() {
    if (!GEOMETRIC_SELECTION_ENABLED) return;
    const wall = this.wall_state;
    if (!wall) return;
    const N = wall.cells_per_ring | 0;
    const R = wall.ring_count | 0;
    if (N < 1 || R < 1) return;

    // Snapshot eligible crystals + bucket by cell for O(1) neighbor lookup.
    const byCell = new Map<number, any[]>();
    const elig: any[] = [];
    for (const c of this.crystals) {
      if (!c || !c.active || c.dissolved) continue;
      if (c.growth_environment === 'air') continue;   // gravity-oriented, not selected
      if (c.enclosed_by != null) continue;             // templated overgrowth, not a competitor
      const t = c._nucTilt;
      if (!t) continue;
      // ELONGATE only — geometric selection is a palisade phenomenon (js/44a).
      // Equant/tabular/platy/botryoidal/dendritic forms don't compete for
      // outward space, so they neither bury nor are buried.
      const aw = c.a_width_mm || 0;
      if (aw <= 0 || c.c_length_mm <= aw * O3_SELECT_MIN_ASPECT) continue;
      const a = wall._resolveAnchor ? wall._resolveAnchor(c) : c.wall_anchor;
      if (!a) continue;
      const rec = {
        c, ri: a.ringIdx | 0, ci: a.cellIdx | 0,
        theta: t.theta, front: o3NormalFrontMm(c), nucStep: c.nucleation_step | 0,
      };
      elig.push(rec);
      const key = rec.ri * N + rec.ci;
      const bucket = byCell.get(key);
      if (bucket) bucket.push(rec); else byCell.set(key, [rec]);
    }
    if (elig.length < 2) return;

    const dThetaMin = O3_BURY_DTHETA_MIN_DEG * Math.PI / 180;
    const keepFrac = 1 - O3_BURY_LEAD_FRAC;   // buried when own front < neighbor.front × keepFrac
    const minAge = O3_BURY_GRACE_STEPS;

    // Each crystal scans its cell + the 8 lat-long neighbors (ring ±1 clamped,
    // cell ±1 wrapped). Buried by the first more-normal neighbor that has out-
    // reached it by the lead fraction (scale-invariant ratio, not an mm gap).
    for (const rec of elig) {
      if (rec.c._buried) continue;                       // already sealed (sticky); still an overtaker via the bucket
      if (this.step - rec.nucStep < minAge) continue;    // grace period (still an overtaker via the bucket)
      let buried = false;
      for (let dr = -1; dr <= 1 && !buried; dr++) {
        const rr = rec.ri + dr;
        if (rr < 0 || rr >= R) continue;
        for (let dc = -1; dc <= 1 && !buried; dc++) {
          const cc = (((rec.ci + dc) % N) + N) % N;   // wrap around the ring
          const bucket = byCell.get(rr * N + cc);
          if (!bucket) continue;
          for (const nb of bucket) {
            if (nb === rec) continue;
            if (nb.theta < rec.theta - dThetaMin && rec.front < nb.front * keepFrac) {
              buried = true;
              break;
            }
          }
        }
      }
      if (buried) {
        // Throttle, don't kill — the crystal stays ACTIVE (present, counted) but
        // its growth is scaled to O3_BURY_GROWTH_MULT in run_step, ending a short
        // leaning stub. Sticky: _buried never unsets (once sealed, sealed).
        rec.c._buried = true;
        this.log.push(
          `  ◄ ${capitalize(rec.c.mineral)} #${rec.c.crystal_id}: ` +
          `overgrown by a more-normal neighbor — geometric selection (growth throttled)`,
        );
      }
    }
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
  if (cap != null) {
    let n = 0;
    for (const c of this.crystals) {
      // v84 (2026-05-19): also count crystals that paramorph-originated
      // as this mineral. A realgar crystal that transformed to
      // pararealgar (light-induced isomerization, applyLightTransitions)
      // still consumed a realgar nucleation event when it originally
      // nucleated. Without this check, the cap effectively reopens each
      // time a paramorph fires — letting MORE of the original mineral
      // nucleate beyond its spec'd max. Sister case: argentite →
      // acanthite (T paramorph) and borax → tincalconite (dehydration)
      // also benefit from this cap accounting.
      if (c.mineral !== mineral && c.paramorph_origin !== mineral) continue;
      if (c.enclosed_by != null || c.dissolved) continue;
      n++;
      if (n >= cap) return true;
    }
  }
  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 2b (v160) — depletion-halo
  // strangulation gate. Runs LAST so it's RNG-neutral and the cap
  // accounting above is unchanged: byte-identical to the diffusion-only
  // path until the first step where the whole accessible wall is
  // strangled for a mineral whose bulk-view σ still wants to fire.
  // See _wallStrangledFor for the geological + mechanistic rationale.
  if (this._wallStrangledFor(mineral)) return true;
  return false;
},

// PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 2b (v160) — depletion-halo
// strangulation gate (Putnis 2009, Reviews in Mineralogy v70 §5).
//
// A fast-growing crystal consumes ions from its local boundary layer
// faster than diffusion can replenish them, dropping the local σ below
// the nucleation threshold across a 3D halo. New nuclei can't form
// where the wall is depleted — the classic "alpha crystal" exclusion-
// zone texture. v160's per-voxel 3D diffusion makes these halos real
// spatial objects: mass balance debits the d=0 wall cell; diffusion
// spreads the depletion laterally across the wall mesh and radially
// inward, while the interior reservoir (d=1,2,3) replenishes from the
// other side. Strangulation occurs only where consumption outpaces the
// diffusive supply — the coupled mechanism this whole arc was built for.
//
// Why the gate is needed: each nucleation engine's σ-gate reads the
// BULK view (conditions.fluid = ring_fluids[equator]), which is NOT
// debited by mass balance — it's the flow-fed cavity average. So an
// engine can decide "the average chemistry favors mineral X" while
// EVERY accessible wall cell is locally strangled below σ_crit. This
// gate samples the per-cell wall chemistry (the boundary voxels, via
// mesh.cells) and blocks nucleation when NO cell clears the threshold.
//
// Returns true (strangled → block) only when the per-cell machinery is
// available AND no wall cell reaches σ_crit. Returns false (not
// strangled) defensively in every other case, so the gate never blocks
// in headless/legacy paths and never throws.
//
// RNG-neutral: consumes no RNG, only σ evaluations. Bounded cost: only
// reached when the engine's bulk σ > σ_crit gate already passed (the &&
// short-circuit puts _atNucleationCap last), and the per-cell scan
// early-exits the instant any cell clears — which is the common case
// (cells ≈ bulk until a dominant phase depletes them), so the scan is
// usually a single σ-eval.
_wallStrangledFor(mineral) {
  const gate = (typeof MINERAL_GATES_REGISTRY !== 'undefined')
    ? MINERAL_GATES_REGISTRY[mineral]
    : null;
  const sigmaCrit = gate ? gate.sigma_crit : null;
  if (typeof sigmaCrit !== 'number') return false;
  const sigmaFn = this.conditions[`supersaturation_${mineral}`];
  if (typeof sigmaFn !== 'function') return false;

  // CRITICAL precondition: only strangulation-block when the BULK view
  // itself says the mineral wants to nucleate (bulk σ > σ_crit). If the
  // bulk σ is below threshold, the mineral isn't trying to fire via the
  // cavity-average chemistry at all (e.g. σ=0 because the ingredient
  // cations aren't in the broth) — that's not depletion-halo
  // strangulation, it's just absence, and the engine's own σ gate
  // handles it. Returning false here in that case is essential for
  // byte-identity: several engines (malachite, azurite, smithsonite,
  // cerussite, hydrozincite, …) call _atNucleationCap in their FIRST
  // guard, BEFORE their σ check and BEFORE their substrate-pick RNG
  // draws. If this gate returned true on a σ=0 mineral it would
  // early-return the engine and skip those RNG draws — desyncing the
  // sequence in every scenario. Gating on bulk σ > σ_crit keeps the
  // gate dormant (byte-identical) except in genuine strangulation: the
  // cavity average favors the mineral, yet every wall cell is locally
  // depleted below σ_crit.
  let bulkSigma = 0;
  try {
    bulkSigma = sigmaFn.call(this.conditions);
  } catch (_e) {
    return false;
  }
  if (!(Number.isFinite(bulkSigma) && bulkSigma > sigmaCrit)) return false;

  const wall = this.wall_state;
  const mesh = (wall && wall.meshFor) ? wall.meshFor(this) : null;
  if (!mesh || !mesh.cells || !mesh.cells.length) return false;
  const ringCount = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  if (ringCount < 1 || N < 1) return false;
  if (mesh.cells.length < ringCount * N) return false;

  const ringTemps = this.ring_temperatures || [];
  // Swap conditions.fluid + .temperature to per-cell values inside the
  // loop, restore in finally — same pattern as _perVertexNucleationSample
  // and _runEngineForCrystal.
  const savedFluid = this.conditions.fluid;
  const savedTemp = this.conditions.temperature;
  let anyClears = false;
  try {
    for (let r = 0; r < ringCount && !anyClears; r++) {
      const tempR = (r < ringTemps.length) ? ringTemps[r] : savedTemp;
      this.conditions.temperature = tempR;
      for (let c = 0; c < N; c++) {
        const cell = mesh.cells[r * N + c];
        const cellFluid = cell ? cell.fluid : null;
        if (!cellFluid) continue;
        this.conditions.fluid = cellFluid;
        let sigma = 0;
        try {
          sigma = sigmaFn.call(this.conditions);
        } catch (_e) {
          sigma = 0;
        }
        // A cell "clears" if it reaches the bare σ_crit. We deliberately
        // ignore per-substrate paragenesis discounts here: the discount
        // lowers the threshold for nucleation ON a documented host, but
        // strangulation is about bare-wall depletion. Using bare σ_crit
        // is the conservative definition of "the wall is depleted" — it
        // can only UNDER-report strangulation (never over-block), which
        // is the safe direction.
        if (Number.isFinite(sigma) && sigma > sigmaCrit) {
          anyClears = true;
          break;
        }
      }
    }
  } finally {
    this.conditions.fluid = savedFluid;
    this.conditions.temperature = savedTemp;
  }
  return !anyClears;  // strangled when no cell cleared σ_crit
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
  // Phase 2c.2b — DEPOSITION CLUSTERING. When the flag is on AND the cavity has
  // open supply-feeders (geysers/hotspots), draw a joint (ring, col) sample
  // weighted by ringAreaWeight(ring)·proximityField(cell) — a decaying halo of
  // nucleation boost around each vent. Pure geometry (no σ), so it clusters
  // free-wall nucleation toward feeders in ANY scenario, not just per-vertex ones.
  // Stashes the ring on _lastNucVertexRing (reusing the per-vertex handoff) so the
  // following _assignWallRing honors it. Returns null (→ legacy uniform pick,
  // byte-identical) when off / no supply-feeders. (The 2c.2 column-only bias this
  // supersedes did NOT cluster — a feeder is a 2-D patch, not a thin stripe.)
  if (fluidSpotsDepositionFor(this) && this._fluidSpots && !this._fluidSpots.isEmpty) {
    const picked = this._feederProximitySample();
    if (picked) {
      this._lastNucVertexRing = picked.ringIdx;
      return picked.cellIdx;
    }
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

// Phase 2c.2b — joint (ring, col) nucleation sample weighted by
// ringAreaWeight(ring)·proximityField(cell): crystals cluster in a decaying halo
// around open supply-feeders while the no-feeder background stays area-true (with
// proximity ≡ 1 the ring-marginal reduces to the legacy sin φ area distribution).
// One RNG draw; returns { ringIdx, cellIdx } or null (no open supply-feeders /
// degenerate mesh → caller uses the legacy pick). Mirrors _perVertexNucleationSample's
// return + _lastNucVertexRing contract but is GEOMETRY-only (works for every
// free-wall mineral, not only those with a supersaturation_<mineral> method).
_feederProximitySample() {
  const wall = this.wall_state;
  if (!wall || !wall.rings || !wall.rings.length) return null;
  const R = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  if (R < 1 || N < 1) return null;
  const prox = this._fluidSpots.proximityField(N, R);
  if (!prox) return null;                         // no open supply-feeders
  const weights = new Float64Array(R * N);
  let total = 0;
  for (let r = 0; r < R; r++) {
    const areaW = wall.ringAreaWeight(r);
    for (let c = 0; c < N; c++) {
      const idx = r * N + c;
      const w = areaW * prox[idx];
      weights[idx] = w;
      total += w;
    }
  }
  if (!(total > 0)) return null;
  let rr = rng.random() * total;
  for (let i = 0; i < weights.length; i++) {
    rr -= weights[i];
    if (rr <= 0) return { ringIdx: (i / N) | 0, cellIdx: (i % N) | 0 };
  }
  return { ringIdx: R - 1, cellIdx: N - 1 };       // float round-off guard
},

// Tranche 6 of PROPOSAL-CAVITY-MESH §14 — joint σ-weighted sample over
// every (ring, cell) pair. Returns { ringIdx, cellIdx } or null if no
// cell evaluates to a positive supersaturation weight (in which case
// the caller falls through to the legacy random sampler).
//
// Weight(r, c) = ringAreaWeight(r) · max(0, σ_at_cell(r, c) − 1.0)²:
//   * σ < 1 (undersaturated or acid-dissolved) → weight 0
//   * σ slightly > 1 (saturation cusp)         → very small weight
//   * σ ≫ 1 (deeply supersaturated)            → strong weight
//
// Quadratic in (σ−1), not linear, so the sampler genuinely prefers
// high-σ locations rather than spreading nucleations roughly evenly
// across all supersaturated cells.
//
// THE AREA TERM (ringAreaWeight = sin(π(r+0.5)/n)) is load-bearing,
// not decoration. The number of nuclei a patch of wall hosts is
// (nucleation rate per unit area) × (available area). The (σ−1)²
// factor is the rate; ringAreaWeight is the area. On the lat-long
// tessellation every ring carries the SAME cell count, but polar
// rings cover far less actual surface (sin φ → 0 at the caps), so
// WITHOUT this factor a near-uniform σ field samples every cell
// equally and over-nucleates the floor/ceiling poles: floor/wall/
// ceiling comes out 25/50/25 instead of the area-true 14.6/70.7/14.6
// the legacy _assignWallRing produces via the same sin φ weight.
// (Measured: tools/placement-skew-probe.mjs, every non-zoned
// scenario.) With the factor in, a uniform σ field reduces EXACTLY
// to the legacy area distribution; a zoned σ field still sorts by
// chemistry, the area term only modulating the within-zone spread.
// This is the same sin φ correction _cellCavityVolMm3 applies for
// fill accounting and ringAreaWeight applies for legacy placement —
// the per-vertex sampler was the one site that omitted it.
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

  // Phase 2c.2b — DEPOSITION CLUSTERING: multiply the per-cell σ weight by the
  // feeder proximity halo (proximityField), so a per-vertex scenario with open
  // supply-feeders concentrates nucleation around its vents with the SAME decaying
  // halo the geometry-only _feederProximitySample uses. null (→ no multiply,
  // byte-identical) when the flag is off or there are no open supply-feeders.
  const prox = (fluidSpotsDepositionFor(this) && this._fluidSpots && !this._fluidSpots.isEmpty)
    ? this._fluidSpots.proximityField(N, ringCount) : null;
  const weights = new Float64Array(ringCount * N);
  let total = 0;
  try {
    for (let r = 0; r < ringCount; r++) {
      const tempR = (r < ringTemps.length) ? ringTemps[r] : savedTemp;
      this.conditions.temperature = tempR;
      // sin(φ) area weight — depends only on the ring, hoist out of the
      // cell loop. This is the polar-thinning correction (see header).
      const areaW = wall.ringAreaWeight(r);
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
        let w = areaW * (sigma - 1) * (sigma - 1);
        if (prox) w *= prox[idx];
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
        // W-K V0 — cleft archetype: druses grow on BOTH flat faces
        // (footwall + hangingwall), not on the thin rim. Excluding the
        // rim keeps crystals off the lens edge where the real cleft's
        // aperture pinches shut.
        archBias === 'floor_ceiling' ? (orient === 'floor' || orient === 'ceiling') :
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

// ============================================================
// v128 graduated-competition support
// ============================================================
// _dryRunEngineForCrystal — same per-cell swap as _runEngineForCrystal,
// but DOES NOT call applyMassBalance. The engine reads cell.fluid +
// cell.temperature; the returned zone is the "desired" growth that
// would happen at zero competition. Used by _computeGraduatedZones
// during pass 1.
//
// IMPORTANT: like _runEngineForCrystal, this temporarily swaps
// conditions.fluid / .temperature for the per-cell view. The engine
// may dereference fluid fields; we don't mutate the cell fluid
// because mass balance is the only mutation path and we skip it.
//
// Returns the engine's zone (or null). Callers should not treat the
// returned zone as mutable shared state — it's a fresh object per
// crystal per call.

_dryRunEngineForCrystal(engine, crystal) {
  const anchor = this.wall_state._resolveAnchor(crystal);
  const ringIdx = anchor ? anchor.ringIdx : null;
  let savedFluid = null;
  let savedTemp = null;
  if (ringIdx != null && ringIdx >= 0 && ringIdx < this.ring_fluids.length) {
    savedFluid = this.conditions.fluid;
    savedTemp = this.conditions.temperature;
    const mesh = this.wall_state.meshFor(this);
    const cell = mesh.cellOf(crystal, this.wall_state);
    this.conditions.fluid = (cell && cell.fluid)
      ? cell.fluid
      : this.ring_fluids[ringIdx];
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

// _applyZoneMassBalance — apply mass balance for a pre-computed zone
// (one that came from _dryRunEngineForCrystal × graduated scaling).
// Mirrors the per-cell swap of _runEngineForCrystal so applyMassBalance
// hits cell.fluid, then restores.
//
// Returns the depletion list from applyMassBalance (or null).

_applyZoneMassBalance(crystal, zone) {
  if (!zone) return null;
  const anchor = this.wall_state._resolveAnchor(crystal);
  const ringIdx = anchor ? anchor.ringIdx : null;
  let savedFluid = null;
  let savedTemp = null;
  if (ringIdx != null && ringIdx >= 0 && ringIdx < this.ring_fluids.length) {
    savedFluid = this.conditions.fluid;
    savedTemp = this.conditions.temperature;
    const mesh = this.wall_state.meshFor(this);
    const cell = mesh.cellOf(crystal, this.wall_state);
    this.conditions.fluid = (cell && cell.fluid)
      ? cell.fluid
      : this.ring_fluids[ringIdx];
    this.conditions.temperature = this.ring_temperatures[ringIdx];
  }
  try {
    return applyMassBalance(crystal, zone, this.conditions);
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

// _computeGraduatedZones — pass 1 of v128 graduated competition.
//
// For each active crystal:
//   1. Run engine in dry-run mode (no mass balance) to get its desired
//      zone.thickness_um and σ
//   2. Compute its initiative score via js/43-initiative.ts
//   3. Group by per-cell anchor (with ring fallback)
//
// Then per-cell:
//   4. Run computeGraduatedAllocations against the cell's fluid
//   5. Scale each crystal's desired zone by its allocation factor
//
// Returns Map<crystal_id, scaledZone>. Crystals not in the map either
// produced no zone, had no positive thickness, or had no stoichiometry
// (they grow via the existing engine path).
//
// CALLED ONLY when GRADUATED_COMPETITION_ENABLED is true. The flag-off
// branch never invokes this — the existing growth loop runs unchanged.

_computeGraduatedZones() {
  // cellKey → { fluid: <Record>, items: Array<{crystal, zone, sigma, initiative}> }
  const cellGroups = new Map();
  // out is the public return; we populate it here for crystals whose
  // dry-run didn't produce positive thickness (negative = dissolution,
  // null/zero = no growth). Those entries don't go through rationing —
  // they pass through to pass 2 as-is so the growth loop knows the
  // engine was already called for them and not to re-invoke it.
  // (Re-invoking would double-consume RNG vs v127, breaking determinism.)
  const out = new Map();

  for (const crystal of this.crystals) {
    if (!crystal.active) continue;
    const engine = MINERAL_ENGINES[crystal.mineral];
    if (!engine) continue;

    // Dry-run the engine to get its desired zone. The engine is called
    // EXACTLY ONCE per crystal per step — same as v127. Pass 2 will
    // consume this stored zone instead of calling the engine again.
    const dryZone = this._dryRunEngineForCrystal(engine, crystal);
    if (!dryZone) {
      // Engine returned null (no zone produced). Pass 2 needs to know
      // we already called the engine — store an explicit null sentinel
      // so the growth loop's `else` branch doesn't re-call.
      out.set(crystal.crystal_id, null);
      continue;
    }
    if (typeof dryZone.thickness_um !== 'number') {
      out.set(crystal.crystal_id, null);
      continue;
    }
    if (dryZone.thickness_um < 0) {
      // Dissolution: no rationing applies (a crystal dissolving doesn't
      // compete for fluid — it RELEASES species). Pass directly to
      // pass 2 with thickness preserved.
      out.set(crystal.crystal_id, dryZone);
      continue;
    }
    if (dryZone.thickness_um === 0) {
      out.set(crystal.crystal_id, null);
      continue;
    }

    // Identify the cell + fluid this crystal competes within.
    const anchor = this.wall_state._resolveAnchor(crystal);
    const ringIdx = anchor ? anchor.ringIdx : null;
    let cellFluid = null;
    let cellKey: string;
    if (ringIdx != null && ringIdx >= 0 && ringIdx < this.ring_fluids.length) {
      const mesh = this.wall_state.meshFor(this);
      const cell = mesh.cellOf(crystal, this.wall_state);
      // v177: the key must identify the BUDGET being rationed. WallCell
      // carries no id/idx/vertexIdx fields, so the old `cell.id ?? …`
      // chain always degraded to `cell:<ringIdx>:?` — every crystal in a
      // ring shared ONE group, rationed against whichever cell's fluid
      // registered first. Key off the anchor (ring, cell) when the cell
      // has its own fluid; fall back to the ring key when the budget is
      // the shared ring fluid, so group identity always matches budget.
      if (cell && cell.fluid) {
        cellFluid = cell.fluid;
        cellKey = `cell:${anchor.ringIdx}:${anchor.cellIdx}`;
      } else {
        cellFluid = this.ring_fluids[ringIdx];
        cellKey = `ring:${ringIdx}`;
      }
    } else {
      cellFluid = this.conditions.fluid;
      cellKey = 'bulk';
    }

    // Compute σ for the initiative scoring. The dry-run zone doesn't
    // carry σ explicitly, so we re-derive via the supersaturation method
    // on the cell fluid + temperature.
    let sigma = 0;
    try {
      const sigmaFn = (this.conditions as any)['supersaturation_' + crystal.mineral];
      if (typeof sigmaFn === 'function') {
        // Need the per-cell swap context for σ too. Re-do the swap.
        const savedFluid = this.conditions.fluid;
        const savedTemp = this.conditions.temperature;
        this.conditions.fluid = cellFluid;
        this.conditions.temperature = ringIdx != null ? this.ring_temperatures[ringIdx] : savedTemp;
        try {
          sigma = sigmaFn.call(this.conditions);
        } finally {
          this.conditions.fluid = savedFluid;
          this.conditions.temperature = savedTemp;
        }
      }
    } catch (_) { sigma = 0; }
    if (typeof sigma !== 'number' || !Number.isFinite(sigma)) sigma = 0;

    if (!cellGroups.has(cellKey)) {
      cellGroups.set(cellKey, { fluid: cellFluid, items: [] });
    }
    cellGroups.get(cellKey).items.push({ crystal, zone: dryZone, sigma, initiative: 0 });
  }

  // Per-cell: compute initiatives + rationing (`out` already has
  // entries for crystals whose dry-run was non-positive — those bypass
  // rationing entirely).
  for (const [cellKey, group] of cellGroups) {
    const items = group.items;
    if (items.length === 0) continue;

    // Compute initiative scores using js/43-initiative.ts. The active-
    // minerals list is everyone in THIS cell with σ > 0 (the competition
    // is intra-cell — different cells have independent fluid budgets).
    const activeMinerals = items.map(it => it.crystal.mineral);
    const sigmaByMineral: Record<string, number> = {};
    for (const it of items) {
      // If multiple crystals of the same mineral are in the cell, take
      // the max σ — they share the same initiative score.
      if ((sigmaByMineral[it.crystal.mineral] ?? 0) < it.sigma) {
        sigmaByMineral[it.crystal.mineral] = it.sigma;
      }
    }

    // Per-mineral initiative (one score per mineral, shared by every
    // crystal of that mineral in the cell).
    const initiativeByMineral: Record<string, number> = {};
    for (const mineral of Object.keys(sigmaByMineral)) {
      const r = computeInitiative(mineral, sigmaByMineral[mineral], this.conditions, activeMinerals);
      initiativeByMineral[mineral] = r.finalInitiative;
    }
    for (const it of items) {
      it.initiative = initiativeByMineral[it.crystal.mineral] ?? 0;
    }

    // Build dry-run records. Crystals without stoichiometry skip
    // graduated competition entirely (treated as full-growth).
    const runs: any[] = [];
    const noStoich: any[] = [];
    for (const it of items) {
      const r = buildCrystalDryRun(
        it.crystal.crystal_id,
        it.crystal.mineral,
        it.sigma,
        it.initiative,
        it.zone.thickness_um,
      );
      if (r) runs.push(r);
      else noStoich.push(it);
    }

    // No-stoichiometry crystals get full-growth scaling (no rationing
    // possible without knowing what they debit). The existing engine
    // path would have given them full growth too, so this preserves
    // behavior for them.
    for (const it of noStoich) {
      out.set(it.crystal.crystal_id, it.zone);
    }

    if (!runs.length) continue;

    const allocs = computeGraduatedAllocations(runs, group.fluid);

    for (const it of items) {
      if (noStoich.includes(it)) continue;
      const a = allocs.get(it.crystal.crystal_id);
      const scaling = a ? a.scaling : 1.0;
      if (scaling >= 1.0) {
        out.set(it.crystal.crystal_id, it.zone);
      } else if (scaling <= 0) {
        // Edge-of-gate skip — the crystal was rationed to zero. Log it
        // (proposal §3.1 step 7).
        this.log.push(
          `  ◌ ${capitalize(it.crystal.mineral)} #${it.crystal.crystal_id}: ` +
          `edge-of-gate skip — ${a?.why ?? 'rationed to 0'}`,
        );
        // IMPORTANT: store a null sentinel so pass-2 knows the engine was
        // already called in the dry-run pass and must NOT be called again.
        // Without this, `_graduatedZones.has(id)` returns false and pass-2
        // falls through to _runEngineForCrystal — calling the engine twice,
        // consuming extra RNG, and breaking the once-per-crystal invariant.
        out.set(it.crystal.crystal_id, null);
      } else {
        // Scale the dry-run zone. Clone to avoid sharing state.
        const scaled = Object.assign({}, it.zone);
        scaled.thickness_um = it.zone.thickness_um * scaling;
        out.set(it.crystal.crystal_id, scaled);
      }
    }
  }

  return out;
},
});
