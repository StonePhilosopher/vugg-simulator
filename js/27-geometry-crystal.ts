// ============================================================
// js/27-geometry-crystal.ts — GrowthZone + Crystal
// ============================================================
// Mirror of vugg/geometry/crystal.py. GrowthZone is one annotated
// growth ring (per step the crystal grew); Crystal owns the list of
// zones plus identity / habit / dominant_forms / dissolved flags.
//
// Phase B6 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// CRYSTAL MODELS
// ============================================================

// Habit → aspect ratio (a/c) lookup table — single source of truth.
// Used by Crystal.add_zone (zone-integrated volume) and by
// VugSimulator.get_vug_fill (cavity-fill calc).
//
// 2026-05-18 habit-stability fix: previously this lookup was duplicated
// across add_zone (geometry derivation) AND get_vug_fill (volume calc),
// AND many growth engines (e.g. js/50-engines-arsenate.ts) set crystal.
// a_width_mm directly with their OWN aRatio values per growth step.
// When a crystal's habit oscillates between e.g. 'tabular' (aRatio=1.5,
// vol coeff 1.178) and 'prismatic' (aRatio=0.4, vol coeff 0.0838),
// get_vug_fill swings 14× for that crystal — without the crystal's
// actual stored growth changing. gem_pegmatite + radioactive_pegmatite
// peak vugFill stuck at 5.75× / 4.07× post-Proposal-D because this
// per-step habit reinterpretation kept inflating cumulative fill.
//
// Fix: integrate volume PER ZONE at the habit-as-of-that-zone aspect
// ratio. Crystal stores _volume_mm3 as a running sum of zone shell
// volumes. get_vug_fill reads _volume_mm3 directly — no more
// reinterpreting accumulated total_growth_um through the current habit.
function _habitAspectRatio(habit: string): number {
  if (habit === 'prismatic') return 0.4;
  if (habit === 'tabular') return 1.5;
  if (habit === 'acicular') return 0.15;
  if (habit === 'rhombohedral') return 0.8;
  if (habit === 'snowball') return 1.0;
  // Calcite-morphology arc Phase 2 (2026-06-11): the σ-regime habit
  // strings carry their PARENT FORM's exact aspect ratio — rhombohedral
  // family 0.8, scalenohedral family 0.5 (= the default 'scalenohedral'
  // always landed on). This is the byte-identity keystone: a habit
  // RENAME must not move _volume_mm3 → a_width → vug fill → chemistry.
  // (Verified by the calibration suite passing unchanged at v186.)
  if (habit === 'stepped_rhombohedral' || habit === 'hopper_rhombohedral'
      || habit === 'dendritic_rhombohedral') return 0.8;
  if (habit === 'stepped_scalenohedral' || habit === 'hopper_scalenohedral'
      || habit === 'dendritic_scalenohedral') return 0.5;
  // Morphology-generalization arc (2026-06-12): the halide cube family.
  // 'cubic' (and the legacy 'hopper_growth'/'hopper_cube' it replaces in
  // the engines) always landed on the DEFAULT 0.5 — so the regime
  // renames carry 0.5 EXPLICITLY, not the geometric cube's 1.0. Same
  // keystone as the calcite families above: a habit rename must not
  // move _volume_mm3 → a_width → vug fill → chemistry. (If cube aspect
  // is ever corrected to 1.0, 'cubic' and this family must move
  // TOGETHER, with a SIM bump + rebake.)
  if (habit === 'stepped_cube' || habit === 'hopper_cube'
      || habit === 'dendritic_cube') return 0.5;
  // Bismuth regime family (2026-06-12): same firewall — the legacy
  // strings (massive_granular / arborescent_dendritic /
  // rhombohedral_crystal) always landed on the default 0.5, so the new
  // intermediates carry it explicitly.
  if (habit === 'feathery_bismuth' || habit === 'skeletal_bismuth') return 0.5;
  // Pyrite striation overlay (2026-06-12): the parent forms (cubic /
  // pyritohedral / cubo-pyritohedral) all land on the default 0.5 —
  // the striated_ renames carry it explicitly. Same firewall as above.
  if (habit === 'striated_cubic' || habit === 'striated_pyritohedral'
      || habit === 'striated_cubo_pyritohedral') return 0.5;
  // REE-octahedron regime family (fix-backlog 2026-06-12): the parent
  // 'octahedral_REE' lands on the default 0.5 — the σ-graded renames
  // carry it explicitly. Same firewall as above.
  if (habit === 'stepped_octahedral_REE' || habit === 'hopper_octahedral_REE'
      || habit === 'dendritic_octahedral_REE') return 0.5;
  return 0.5;
}

// Ellipsoid volume coefficient: V = kVol(aRatio) × c_mm³.
// V = (4/3)π × (c/2) × (a/2)² = (π/6) × aRatio² × c³.
function _habitVolCoeff(aRatio: number): number {
  return (Math.PI / 6) * aRatio * aRatio;
}

class GrowthZone {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts: any = {}) {
    this.step = opts.step ?? 0;
    this.temperature = opts.temperature ?? 0;
    this.thickness_um = opts.thickness_um ?? 0;
    this.growth_rate = opts.growth_rate ?? 0;
    this.trace_Fe = opts.trace_Fe ?? 0;
    this.trace_Mn = opts.trace_Mn ?? 0;
    this.trace_Al = opts.trace_Al ?? 0;
    this.trace_Ti = opts.trace_Ti ?? 0;
    this.trace_Pb = opts.trace_Pb ?? 0;
    this.trace_Au = opts.trace_Au ?? 0;  // invisible-gold trace (arsenopyrite)
    this.fluid_inclusion = opts.fluid_inclusion ?? false;
    this.inclusion_type = opts.inclusion_type ?? '';
    this.note = opts.note ?? '';
    this.ca_from_wall = opts.ca_from_wall ?? 0.0;
    this.ca_from_fluid = opts.ca_from_fluid ?? 0.0;
    this.is_phantom = opts.is_phantom ?? false;
    this.dissolution_depth_um = opts.dissolution_depth_um ?? 0.0;
    // Phase 1e completion: which dissolution mode the engine chose
    // (e.g. 'oxidative' | 'acid' | 'polymorph' | 'inversion' | 'low_co3' | 'thermal'
    // | 'dehydration'). Read by applyMassBalance to dispatch the credit
    // through MINERAL_DISSOLUTION_RATES[mineral].__modes[mode]. Optional —
    // single-mode (legacy) entries don't need it; the wrapper falls
    // through to the first declared mode when missing.
    if (opts.dissolutionMode) this.dissolutionMode = opts.dissolutionMode;
    // Calcite-morphology arc Phase 1 (2026-06-11): per-zone growth-regime
    // tags — the SHAPE history recorded alongside the chemistry history.
    //   morph_regime:     'spiral_smooth' | 'stepped_mild' | 'stepped_macro'
    //                     | 'hopper_skeletal' | 'dendritic' (Sunagawa order)
    //   morph_form:       crystallographic form token ('rhombohedral' |
    //                     'scalenohedral' | 'cube' | …, per mineral)
    //   morph_surf_sigma: (damped) surface σ the regime was classified
    //                     from (post-step basis — 18th catch)
    // Optional like dissolutionMode: written post-hoc by
    // classifyMorphologyStep (js/45 registry — calcite was the first
    // tenant, halite/sylvite the second wave) at end of run_step; only
    // MORPH_TH-registered minerals' zones carry them. Zone-stack
    // consumers (strip chips, zone modal, terrace geometry) read them
    // when present.
    if (opts.morph_regime) this.morph_regime = opts.morph_regime;
    if (opts.morph_form) this.morph_form = opts.morph_form;
    if (opts.morph_surf_sigma != null) this.morph_surf_sigma = opts.morph_surf_sigma;
  }
}

class Crystal {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(opts: any = {}) {
    this.mineral = opts.mineral ?? '';
    this.crystal_id = opts.crystal_id ?? 0;
    this.nucleation_step = opts.nucleation_step ?? 0;
    this.nucleation_temp = opts.nucleation_temp ?? 0;
    this.position = opts.position ?? 'vug wall';
    this.c_length_mm = 0;
    this.a_width_mm = 0;
    // 2026-05-18 habit-stability fix: zone-integrated volume tracking.
    // _volume_mm3 accumulates shell volumes from each positive zone using
    // the habit's aspect ratio AT TIME OF GROWTH. Replaces the previous
    // pattern of reinterpreting accumulated total_growth_um through the
    // crystal's CURRENT habit (which oscillates step-to-step in some
    // engines, causing wild fill swings). See _habitAspectRatio above.
    this._volume_mm3 = 0;
    this.habit = opts.habit ?? 'prismatic';
    this.dominant_forms = opts.dominant_forms ? [...opts.dominant_forms] : [];
    this.twinned = false;
    this.twin_law = '';
    // Growth-vector footprint (chosen from MINERAL_SPEC habit_variants at
    // nucleation time). Drives the topo map: wall_spread = lateral coverage,
    // void_reach = projection into the vug interior. vector is the
    // categorical style (projecting / coating / tabular / equant / dendritic).
    this.wall_spread = opts.wall_spread ?? 0.5;
    this.void_reach = opts.void_reach ?? 0.5;
    this.vector = opts.vector ?? 'equant';
    // PHASE-4-CAVITY-MESH (PROPOSAL-CAVITY-MESH §13 Tranche 4b) — the
    // legacy `wall_ring_index` / `wall_center_cell` fields are gone.
    // `wall_anchor` is the only positional field on Crystal from this
    // commit forward. Phase 1's deprecation completes; renderers and
    // engine code all go through wall_anchor (or the WallState helper
    // _resolveAnchor) directly.
    //
    // wall_anchor shape:
    //   { phi: number, theta: number, ringIdx: number, cellIdx: number }
    // phi ∈ [0, π] (south pole 0, north pole π); theta ∈ [0, 2π).
    // ringIdx/cellIdx are derived caches for fast lat-long lookups
    // (Phase 2's lat-long tessellation); phi/theta is the truth that
    // survives a future re-tessellation (Phase 2.5).
    //
    // null = unanchored crystal (rare — only mid-construction in
    // tests). Renderers that encounter a null anchor skip the crystal.
    this.wall_anchor = opts.wall_anchor ?? null;
    // Environment at nucleation time. 'fluid' (the dominant case —
    // vug fluid-filled, geometric-selection orientation along the
    // substrate normal) or 'air' (drained / cave-style cavity,
    // gravity-driven orientation: stalactite c-axis points world-
    // down regardless of substrate normal). Default 'fluid' for
    // legacy / unset; air-mode currently never triggers (no scenario
    // sets it yet). Companion: σ=12° Gaussian c-axis scatter in
    // _renderCrystalWireframe (geometric-selection literature).
    this.growth_environment = opts.growth_environment ?? 'fluid';
    // DIRECTIONAL / POLAR / STEPPED GROWTH render tags (central-distance arc
    // Phase 0, 2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md).
    // These are crystal-level RENDER overprint tags, NOT initialized here — set
    // ad-hoc by their post-growth classifiers ONLY when a crystal qualifies,
    // exactly like _deformation / _etch / _sectorZoned. Documented here for
    // discoverability; never assigned in the constructor so they stay absent
    // (undefined) for untagged crystals and never widen any serialized output:
    //   _faceStep   { steppedFaceSet, atStep }   — js/45 classifyFaceStep:
    //               directional macrostep relief on one face-SET (calcite {104}
    //               obtuse/acute anisotropy). Phase 1 renders it.
    //   _occlusion  { attachedFraction }          — js/45 classifyOcclusion: the
    //               frozen substrate-attached -c fraction (extrinsic, UNIVERSAL driver
    //               of the singly-terminated drusy habit). Phase 2 renders it (js/99i
    //               sinks the base offset). Gated on wall.occlusion (opt-in).
    //   _polarAxis  { pointGroup }                — js/45 classifyPolarAxis: TRUE
    //               crystallographic polarity, the 10 polar point groups only
    //               (hemimorphite/wurtzite/tourmaline/greenockite). Phase 3 renders it.
    //               Kept DISTINCT from _occlusion — the science forbids one scalar for
    //               both, and a wall crystal can carry BOTH (buried base + polar +c).
    //   _split      { index, rung, route, dominant, sumA, sumB, driver } — js/44c
    //               accrueSplitIndex (W-F O5 SPLITTING): the two-route cumulative-
    //               misorientation index (A impurity/low-σ + B high-σ) that earns a
    //               crystal's place on the saddle→split→sheaf→spherulite ladder. The
    //               ONE grow-integrated member of this list (accrued in the js/85
    //               growth loop each positive-growth step, not a post-growth
    //               classifier) — but it shares the same never-init / never-widen
    //               property: written ONLY when a split-able crystal actually accrues
    //               (rate > 0), so untagged crystals stay undefined. RECORDED &
    //               UNREAD in S-a (byte-identical, 0/38); S-b lets `rung` drive the
    //               habit + render params. `route` provenance is REQUIRED, never
    //               optional (boss §9a #1: an A-saddle ≠ a B-reached saddle).
    //   _wulffForm  { biasC, growthFrac, octahedral, scaleno, tabular, bladed, wedge } — js/45
    //               classifyWulffForm: the central-distance (Wulff) FORM bias (Phase 4). Renderer
    //               (js/99i) builds the true convex polyhedron (js/46) instead of a fixed primitive.
    //               SIX tenants across FIVE crystal systems: fluorite (4a.1, wall.wulff_fluorite,
    //               CUBIC) — {100}/{111} cube↔octahedron (fluid.Y); token stays cube/octahedron →
    //               isometric scale unchanged. calcite (4a.2, wall.wulff_calcite, TRIGONAL) —
    //               {104}/{21-31} rhombohedron↔scalenohedron (nailhead↔dogtooth); token stays
    //               rhomb/scalene, scaled ISOTROPICALLY by cLen (c is the LONG axis). wulfenite (4a.3,
    //               wall.wulff_wulfenite, TETRAGONAL 4/m) — c{001}/{101} tabular SQUARE plate; token
    //               stays 'tablet', scaled isotropically by the plate DIAMETER (c is the SHORT axis).
    //               barite (4a.4, wall.wulff_barite, ORTHORHOMBIC mmm) — c{001}/o{011}/m{210} tabular
    //               RECTANGULAR plate (a≠b); tabular+bladed only (token 'tablet'), scaled isotropically
    //               by the plate diameter (c SHORT, like wulfenite). galena (4a.5, wall.wulff_galena,
    //               CUBIC again) — {100}/{111} cube-dominant with VISIBLE {111} corner truncations
    //               (hardcoded cubic habit → octahedral always false; isometric scale like fluorite).
    //               titanite (4a.6, wall.wulff_titanite, MONOCLINIC 2/m) — a{100}/c{001}/m{110}/u{011}/
    //               {-111} the oblique sphenoid WEDGE; the FIRST non-orthogonal cell (β=113.81°), so
    //               {100}∧{001}=66.19°≠90° (the wedge flag); token prism/tablet, scaled isotropically
    //               by diameter like wulfenite/barite (b is the long axis, internal to the body).
    //               growthFrac is LIVE (rung 4a.8): re-derived each step, so the body matures on
    //               screen instead of freezing at its ~30µm tag-step form (biasC stays tag-fixed
    //               except wulfenite's Pb:Mo integral, 4a.7).
    //               All render-only → size scalars untouched, byte-identical (no SIM bump, no rebake).
    this.zones = [];
    this.total_growth_um = 0;
    this.active = true;
    this.dissolved = false;
    this.phantom_surfaces = [];
    this.phantom_count = 0;
    // Enclosure: crystals this one has swallowed, and the host that
    // swallowed this one (if any). Drives the topo map's inclusion
    // dots and the Sweetwater-style narration.
    this.enclosed_crystals = [];
    this.enclosed_at_step = [];
    this.enclosed_by = null;
    // W-F O4b — how this crystal was enclosed (null = not enclosed /
    // unclassified pre-v221 save). true: nucleated ON its host and buried
    // at the host's growth front (marks a zone horizon — O5's phantom
    // datum). false: lateral wall swallow, embedded-inert (poikilotopic).
    // Set by _check_enclosure, cleared by _check_liberation.
    this.coats_front = null;
    // W-F O5 (perturbed regrowth) — a foreign-matter film masking this
    // crystal's growth front. null = clean. { mineral, phi_term, phi_prism,
    // step } = macroscopic coverage per axis (termination / prism), set by an
    // event `film:` dusting directive or by an O4b coats_front enclosure
    // (js/44b applyFilmDusting; js/85c). RECORDED in O5a, UNREAD — the σ*(φ)
    // masking gate that consumes it (js/44b sigmaStarForCoverage) is behind
    // O5_MASKING_ENABLED, false until O5b. Cleared when the fluid grows through
    // the film (O5b) or, for a coats_front film, on liberation.
    this._film = opts._film ?? null;
    // Paramorph tracking — set by applyParamorphTransitions when the crystal
    // crosses a phase-transition T (Round 8a-2: argentite → acanthite at 173°C).
    // Stores the *original* (pre-transition) mineral name so library + narrator
    // can flag the cubic-acanthite-after-argentite case.
    this.paramorph_origin = opts.paramorph_origin ?? null;
    this.paramorph_step = opts.paramorph_step ?? null;
    // v28 dehydration tracking — counts steps in a dry environment
    // for crystals listed in DEHYDRATION_TRANSITIONS.
    this.dry_exposure_steps = opts.dry_exposure_steps ?? 0;
    // Q2a paragenesis tracking — set by sim.nucleate when this
    // crystal is born via a CDR (coupled dissolution-precipitation)
    // route per Putnis 2002/2009. cdr_replaces_crystal_id points to
    // the parent crystal whose dissolution fed this nucleation;
    // perimorph_eligible flags shape_preserved=true routes (per
    // boss directive 2026-05-06: schema anticipates Q4 perimorph
    // mechanic even before renderer wires it). Q3 renderer reads
    // cdr_replaces_crystal_id to inherit parent outline; Q4 renderer
    // uses perimorph_eligible to decide if the crystal should
    // persist as a hollow cast when later dissolved.
    this.cdr_replaces_crystal_id = opts.cdr_replaces_crystal_id ?? null;
    this.perimorph_eligible = opts.perimorph_eligible ?? false;
    // Cavity diameter at nucleation time, used by add_zone to cap
    // c_length / a_width so individual crystals can't grow past the
    // cavity walls. See BUG-CRYSTALS-CLIP-VUG-WALL.md (Tier 2 fix). The
    // cap is the spatial counterpart to the existing global vug-fill
    // check (which limits TOTAL volume across all crystals, but doesn't
    // prevent any single crystal from being oversized). Set by
    // sim.nucleate() at construction; 0 means "no cap" for crystals
    // loaded from legacy saves or constructed in tests.
    this.vug_diameter_mm = opts.vug_diameter_mm ?? 0;
  }

  add_zone(zone, extentMult = 1) {
    // Apply time compression — more geological time per step = thicker zones
    zone.thickness_um *= timeScale;
    zone.growth_rate *= timeScale;
    // Detect phantom boundaries
    if (zone.thickness_um < 0) {
      zone.is_phantom = true;
      zone.dissolution_depth_um = Math.abs(zone.thickness_um);
      this.phantom_surfaces.push(this.zones.length);
      this.phantom_count++;
    } else if (this.zones.length && this.zones[this.zones.length - 1].thickness_um < 0 && zone.thickness_um > 0) {
      zone.note = (zone.note + ' [phantom boundary — growing over dissolution surface]').trim();
    }
    // W-F O5b — a MASKED HORIZON is a phantom of a DIFFERENT origin: the growth
    // loop (js/85) tags the first zone that grows THROUGH a foreign film
    // (`zone.masked_horizon`, positive thickness, no mass ever lost). It joins
    // the phantom_surfaces record beside the dissolution phantoms so narrators,
    // the Strip View, and O5c's band render read one horizon list — but the
    // ORIGIN differs ("dusted and buried" vs the etch phantom's "etched and
    // healed"), which `zone.masked_horizon` + `zone.film_mineral` preserve. This
    // is the phantom the ontogeny arc's originating ask leaves in the lattice.
    if (zone.masked_horizon && zone.thickness_um > 0) {
      this.phantom_surfaces.push(this.zones.length);
      this.phantom_count++;
      const fm = zone.film_mineral ? `${zone.film_mineral} ` : '';
      zone.note = (`${zone.note || ''} [masked horizon — grew through a ${fm}film]`).trim();
    }
    this.zones.push(zone);
    // 2026-05-18 habit-stability fix: integrate _volume_mm3 PER ZONE at
    // the aspect ratio of the habit AS-OF-THIS-ZONE. Stamp the aspect
    // ratio on the zone itself for snapshot/replay fidelity. Done BEFORE
    // total_growth_um is mutated so c_old / c_new bracket the zone cleanly.
    const cOld_mm = this.total_growth_um / 1000.0;
    this.total_growth_um += zone.thickness_um;
    const cNew_mm = this.total_growth_um / 1000.0;
    const zoneAspect = _habitAspectRatio(this.habit);
    zone.aspect_ratio = zoneAspect;
    if (zone.thickness_um > 0) {
      // Positive zone — add ellipsoid shell volume at this zone's aspect.
      //   V = (π/6) × aspect² × (c_new³ - c_old³)
      const kVol = _habitVolCoeff(zoneAspect);
      this._volume_mm3 += kVol * (Math.pow(cNew_mm, 3) - Math.pow(cOld_mm, 3));
    } else if (zone.thickness_um < 0 && cOld_mm > 0) {
      // Dissolution — scale the whole crystal's volume by (c_new/c_old)³.
      // Geological intuition: dissolution thins the outer shell uniformly;
      // since the ellipsoid is shape-similar at all scales, volume scales
      // as the cube of the linear dimension. Clamp at 0 if total dissolves.
      const scale = Math.max(0, cNew_mm / cOld_mm);
      this._volume_mm3 *= scale * scale * scale;
    }
    this.c_length_mm = cNew_mm;
    // W-K VOL-NEUTRAL (measurement): compact the AXIAL extent at CONSTANT volume.
    // js/85 passes extentMult = splitGrowthMult(_split.index) for a split crystal
    // when O5_VOLNEUTRAL_ENABLED (else 1 → this branch is skipped, byte-identical).
    // _volume_mm3 was integrated ABOVE at the uncompacted c, so it — and thus
    // get_vug_fill / nucleation — is untouched; a_width_mm (derived below from the
    // SAME _volume_mm3 and the now-shorter c) auto-WIDENS to conserve it: the
    // needle collapsing to the sphere's radius, same material.
    if (extentMult !== 1) this.c_length_mm *= extentMult;
    // a_width_mm: derive from the integrated _volume_mm3 so the renderer
    // sees a STABLE width matching the crystal's growth history, not the
    // latest habit's possibly-oscillating ratio. Math: V = (π/6) × a² × c
    // (from V = (4/3)π × (c/2) × (a/2)²) → a = sqrt(6V / (π × c)).
    //
    // Fallback to the legacy habit-based derivation when _volume_mm3 is
    // zero (no positive zones yet — only dissolution / initial state).
    if (this._volume_mm3 > 0 && this.c_length_mm > 0) {
      this.a_width_mm = Math.sqrt(
        (6 * this._volume_mm3) / (Math.PI * this.c_length_mm),
      );
    } else {
      this.a_width_mm = this.c_length_mm * _habitAspectRatio(this.habit);
    }
    // No size cap. Crystals grow to chemistry-true size (boss directive
    // "defer to actual geology" 2026-05-06): in real cavities a crystal
    // that outgrows its container either competes for space, deforms,
    // or extends into surrounding rock — it doesn't get clamped at the
    // wall. The renderer-side per-cell cavity clip (commit 4fb128f)
    // handles the visual: fragments past the local wall radius are
    // discarded per-fragment, so a 60 mm crystal in a 50 mm vug renders
    // its inside-cavity portion and the wall slices the rest invisibly.
    // The earlier v59 sim-side cap (`c_length <= vug_radius`,
    // `a_width <= vug_diameter`) was over-cautious — it predates the
    // per-cell clip and was carrying the load the shader now does.
    // Removed in v61.
  }

  describe_morphology() {
    const forms = this.dominant_forms.length ? this.dominant_forms.join(', ') : this.habit;
    const twin_str = this.twinned ? `, ${this.twin_law} twin` : '';
    // Show in µm if crystal is < 0.1mm, otherwise mm
    let size;
    if (this.c_length_mm < 0.05) {
      const c_um = this.total_growth_um;
      const a_um = c_um * (this.a_width_mm / (this.c_length_mm || 1));
      size = `${c_um.toFixed(1)} × ${(isFinite(a_um) ? a_um : 0).toFixed(1)} µm`;
    } else if (this.c_length_mm < 1.0) {
      size = `${this.c_length_mm.toFixed(2)} × ${this.a_width_mm.toFixed(2)} mm`;
    } else {
      size = `${this.c_length_mm.toFixed(1)} × ${this.a_width_mm.toFixed(1)} mm`;
    }
    return `${this.habit} [${forms}]${twin_str}, ${size}`;
  }

  describe_latest_zone() {
    if (!this.zones.length) return 'no growth';
    const z = this.zones[this.zones.length - 1];
    const parts = [`+${z.thickness_um.toFixed(1)} µm`];
    const traces = [];
    if (z.trace_Fe > 1) traces.push(`Fe ${z.trace_Fe.toFixed(1)}`);
    if (z.trace_Mn > 0.5) traces.push(`Mn ${z.trace_Mn.toFixed(1)}`);
    if (z.trace_Ti > 0.1) traces.push(`Ti ${z.trace_Ti.toFixed(2)}`);
    if (z.trace_Al > 1) traces.push(`Al ${z.trace_Al.toFixed(1)}`);
    if (traces.length) parts.push(`traces: ${traces.join(', ')} ppm`);
    if (z.fluid_inclusion) parts.push(`fluid inclusion (${z.inclusion_type})`);
    if (z.note) parts.push(z.note);
    return parts.join('; ');
  }

  predict_fluorescence() {
    // DOOR 2 (2026-07-09): the narrator now runs the SAME zone-scale
    // physics as the 98c UV bar — both mirror the growth engines' own
    // recorded classifiers (the pre-audit gates here were broth-scale
    // numbers copied from the spec's threshold_ppm fields, so the quench
    // branches were unreachable and the two voices contradicted each
    // other on 27 fleet crystals). Per-zone tallies, crystal-level prose.
    const n = Math.max(this.zones.length, 1);
    const avg_Mn = this.zones.reduce((s, z) => s + z.trace_Mn, 0) / n;
    const avg_Fe = this.zones.reduce((s, z) => s + z.trace_Fe, 0) / n;

    if (this.mineral === 'calcite') {
      // Mirrors the js/52 4-tier ladder per zone (the bar's exact gates).
      let dark = 0, glow = 0, brilliant = 0;
      for (const z of this.zones) {
        const Mn = z.trace_Mn || 0, Fe = z.trace_Fe || 0;
        if (Mn > 1.0 && Fe > 2.0) dark++;
        else if (Mn > 6.0 && Fe < 0.4) { brilliant++; glow++; }
        else if ((Mn > 2.0 && Fe < 1.0) || (Mn > 1.0 && Fe < 2.0)) glow++;
      }
      if (glow && dark) return 'banded orange-red under SW UV — Mn²⁺ zones glow, Fe-quenched zones stay dark: the growth history reads under the lamp';
      if (brilliant) return 'brilliant salmon under SW UV (manganocalcite — Mn²⁺ activator high, Fe quencher minimal)';
      if (glow) return 'orange-red under SW UV (Mn²⁺ activated)';
      if (dark) return 'quenched (Fe²⁺ silencing the Mn²⁺ emission — dark CL)';
      return 'non-fluorescent (no Mn²⁺ activator)';
    }
    if (this.mineral === 'fluorite') {
      // Eu²⁺/REE electronic blue-violet or radiation defects — a LOCALITY
      // trait, not a species trait ("all fluorites are not luminescent!").
      const ree = this.zones.some((z) =>
        (z.trace_Y || 0) > 0.01 || /(HREE|REE)-(rich|bearing)/i.test(z.note || ''));
      if (ree || (this.radiation_damage || 0) > 0.1) return 'blue-violet under SW + LW (Eu²⁺/REE centers)';
      return 'non-fluorescent (this lot lacks the REE/defect centers — fluorite’s famous glow is a locality trait)';
    }
    if (this.mineral === 'quartz') {
      // Macrocrystalline quartz is honestly inert — the Al-defect blue is
      // a cathodoluminescence phenomenon, not a UV-lamp response; famous
      // "glowing quartz" is oil inclusions or a hyalite/chalcedony coating.
      return 'non-fluorescent (macrocrystalline quartz)';
    }
    if (this.mineral === 'sphalerite' || this.mineral === 'wurtzite') {
      // Mn²⁺ orange (~595 nm) LW-dominant with the classic tribo-
      // luminescence; Fe is the textbook ZnS killer (cleiophane < 0.1%
      // bright, marmatite dead). Same zone gate as the bar.
      const lit = this.zones.some((z) => (z.trace_Mn || 0) > 0.1 && (z.trace_Fe || 0) < 2.0);
      if (lit) return 'orange under LW UV (Mn²⁺ — the low-Fe cleiophane glow), with yellow-orange triboluminescence';
      if (avg_Fe > 2.0) return 'non-fluorescent (Fe-quenched — the marmatitic signature)';
      return 'non-fluorescent';
    }
    if (this.mineral === 'ruby' || this.mineral === 'corundum' || this.mineral === 'sapphire') {
      // Cr³⁺ 694 nm; Fe quench — Mogok (marble, Fe avg ~92 ppm) bright
      // vs Thai/Cambodian (basalt, ~2000-4400 ppm) SW-dead.
      const cr = this.zones.some((z) => (z.trace_Cr || 0) > 0.5 || /Cr|chromium|ruby/i.test(z.note || ''));
      if (cr && avg_Fe < 2.0) return 'strong red under LW + SW UV (Cr³⁺ R-lines at 694 nm — the marble-hosted signature)';
      if (cr) return 'weak to inert (Fe quenching the Cr³⁺ emission — the basalt-hosted signature)';
      return 'non-fluorescent (no chromium)';
    }
    if (this.mineral === 'emerald') {
      if (avg_Fe < 1.0) return 'weak red under LW UV / Chelsea filter (Cr³⁺, low-Fe — the Colombian signature)';
      return 'inert (Fe-quenched Cr³⁺ — the schist-type signature)';
    }
    if (this.mineral === 'willemite') {
      const lit = this.zones.some((z) => (z.trace_Mn || 0) > 0.005);
      if (lit) return 'bright green under SW UV (Mn²⁺ in the Zn site — the Franklin classic), often phosphorescent';
      return 'weakly fluorescent pale green';
    }
    if (this.mineral === 'autunite') {
      return 'intense apple-green under SW UV (uranyl — the brightest lamp in the case; Ca²⁺ doesn’t quench the way Cu²⁺ does)';
    }
    if (this.mineral === 'uranophane') {
      return 'bright yellow-green under SW + LW UV (uranyl vibronic emission — often outshines autunite)';
    }
    if (this.mineral === 'uranospinite') {
      return 'bright yellow-green under LW UV (Ca uranyl — the heavier As-anion dims it a shade below autunite)';
    }
    if (this.mineral === 'metatorbernite' || this.mineral === 'metazeunerite') {
      return 'non-fluorescent — Cu²⁺ kills the uranyl emission (the classic field test against autunite)';
    }
    if (this.mineral === 'pyrite' || this.mineral === 'marcasite' || this.mineral === 'chalcopyrite' || this.mineral === 'galena' || this.mineral === 'molybdenite' || this.mineral === 'tetrahedrite' || this.mineral === 'tennantite') {
      return 'non-fluorescent (opaque sulfide)';
    }
    if (this.mineral === 'hematite') {
      return 'non-fluorescent (opaque oxide)';
    }
    if (this.mineral === 'goethite') {
      return 'non-fluorescent (opaque hydroxide)';
    }
    if (this.mineral === 'malachite') {
      return 'non-fluorescent';
    }
    if (this.mineral === 'uraninite') {
      return 'weak green-yellow (U) — daughter autunite/torbernite would glow brightly';
    }
    if (this.mineral === 'smithsonite') {
      // Weak and RARELY observed (fluomin: pale yellow / violet-red,
      // weak) — the old always-on blue-green overstated a rarity; the
      // Tsumeb scarlet is the famous exception, not the rule.
      return 'weakly fluorescent at best (pale yellow, rarely observed — the Tsumeb scarlet is the exception)';
    }
    if (this.mineral === 'wulfenite') {
      return 'non-fluorescent (typical — the famous "green wulfenite" glow is a hyalite coating)';
    }
    if (this.mineral === 'selenite') {
      // Real gypsum often glows cream/bluish-white from ORGANIC traces
      // (fluomin: "often"; the 1927 Wiesloch UV hourglass) — a field the
      // sim's chemistry doesn't carry yet, so growth here is organic-free.
      return 'non-fluorescent as grown (organic-free — natural gypsum often glows cream from trapped organics)';
    }
    if (this.mineral === 'adamite') {
      // Trace-URANYL activated (the Mapimí lime-green); Cu²⁺ QUENCHES —
      // the pre-audit branches had the sense backwards (cuproadamite
      // narrated brighter). Same physics as torbernite-vs-autunite.
      const avg_Cu = this.zones.reduce((s, z) => s + (z.trace_Cu || 0), 0) / n;
      const cupro = avg_Cu > 0.1 || this.zones.some((z) => /cupro|cuprian/.test(z.note || ''));
      if (cupro) return 'dim green (cuprian — Cu²⁺ mutes the uranyl glow)';
      return 'bright lime-green under SW UV (trace-uranyl activated — the Mapimí classic)';
    }
    if (this.mineral === 'mimetite') {
      return 'usually non-fluorescent (the famous Långban orange is often hedyphane in disguise)';
    }
    if (this.mineral === 'feldspar') {
      // Amazonite's Pb²⁺ is a COLOUR CENTRE, not an activator — the old
      // yellow-green claim retired (audit 2026-07-09). The real response
      // is the weak Fe³⁺ deep red (~700-720 nm, SW): Franklin albite
      // "FL red SW" (Bostwick 2008).
      if (avg_Fe > 0.35) return 'weak deep-red under SW UV (Fe³⁺ in the framework — barely visible at ~700 nm)';
      if (this.zones.some(z => (z.note || '').includes('amazonite'))) {
        return 'non-fluorescent (the amazonite green is a Pb²⁺ colour centre, not a glow)';
      }
      return 'non-fluorescent or weak white under SW';
    }
    return 'unknown';
  }
}

