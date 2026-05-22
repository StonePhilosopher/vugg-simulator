// ============================================================
// js/99d-renderer-wireframe.ts — Wireframe crystal renderer
// ============================================================
// _seededRand / _seededGaussian / _orthonormalBasis / _convexHull2D / _druzyClusterCount geometry helpers + _renderCrystalWireframe / _renderWireframeInstance painters.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

// hanging drip?" — not "is this habit string in some list".
function _isDripstoneEligibleCanonical(prim) {
  return prim === PRIM_HEX_PRISM_TERMINATED
      || prim === PRIM_HEX_PRISM
      || prim === PRIM_ACICULAR
      || prim === PRIM_RHOMBOHEDRON
      || prim === PRIM_SCALENOHEDRON
      || prim === PRIM_BOTRYOIDAL;
}

function _lookupCrystalPrimitive(crystal) {
  if (!crystal) return PRIM_RHOMBOHEDRON;
  // v134 (2026-05-22): twin-law geometry override. Each check below
  // is a mineral-scoped + law-scoped guard that returns a hand-rolled
  // twin primitive instead of the canonical habit dispatch. Runs BEFORE
  // the air-mode dripstone override: a twinned crystal in an air
  // cavity is still a twin, not a dripstone (twins don't drip).
  //
  // Iconic twins shipped so far:
  //   fluorite penetration   {111}  — two cubes rotated 60° around body diagonal
  //   selenite swallowtail   {100}  — two tabular blades opening in V (60°)
  //
  // Future twin primitives (data side already complete in v133):
  //   marcasite cockscomb, cerussite trilling, pyrite iron-cross,
  //   galena octahedron-twin, aragonite pseudo-hex
  if (crystal.mineral === 'fluorite' && crystal.twinned
      && crystal.twin_law === 'penetration') {
    return PRIM_FLUORITE_PENETRATION_TWIN;
  }
  if (crystal.mineral === 'selenite' && crystal.twinned
      && crystal.twin_law === 'swallowtail') {
    return PRIM_SELENITE_SWALLOWTAIL_TWIN;
  }
  // v24 air-mode override — crystals nucleated in vadose rings get
  // dripstone geometry instead of their canonical habit primitive,
  // when the canonical primitive is structurally compatible with a
  // hanging-drip silhouette. The renderer's existing c-axis flip
  // handles orientation: ceiling cells get c-axis world-down
  // (stalactite hanging), floor cells get c-axis world-up
  // (stalagmite standing).
  const canonical = _canonicalPrimitive(crystal);
  if (crystal.growth_environment === 'air'
      && _isDripstoneEligibleCanonical(canonical)) {
    return PRIM_DRIPSTONE;
  }
  return canonical;
}

// Canonical (fluid-mode) primitive for a crystal, ignoring growth
// environment. Direct table first, then the fuzzy-substring fallback
// catches compound habit strings + runtime-set engine habits.
function _canonicalPrimitive(crystal) {
  if (!crystal) return PRIM_RHOMBOHEDRON;
  const direct = HABIT_TO_PRIMITIVE[crystal.habit];
  if (direct) return direct;
  const h = (crystal.habit || '').toLowerCase();
  // Order matters: hopper checked BEFORE 'cube' since "hopper_growth"
  // doesn't contain "cube" but is cubic; 'opal' before 'plate' since
  // some opal variants get described "platy"; tabular/plate checked
  // before acicular since "tabular_or_prismatic_or_fibrous" should
  // resolve tabular not fibrous.
  if (h.includes('hopper'))                                 return PRIM_CUBE;
  if (h.includes('cube') || h.includes('cubic'))           return PRIM_CUBE;
  if (h.includes('pyritohed'))                              return PRIM_PYRITOHEDRON;
  if (h.includes('octahed'))                                return PRIM_OCTAHEDRON;
  if (h.includes('tetrahed'))                               return PRIM_TETRAHEDRON;
  if (h.includes('scalenohed') || h.includes('dogtooth'))   return PRIM_SCALENOHEDRON;
  if (h.includes('rhomb'))                                  return PRIM_RHOMBOHEDRON;
  if (h.includes('dipyramid') || h.includes('bipyramid')
      || h.includes('trapiche') || h.includes('twinned_cyclic')
      || h.includes('stellate'))                            return PRIM_DIPYRAMID;
  if (h.includes('barrel'))                                 return PRIM_HEX_PRISM;
  if (h.includes('hex_prism') || h.includes('hexagonal'))   return PRIM_HEX_PRISM_TERMINATED;
  if (h.includes('prism') || h.includes('columnar')
      || h.includes('hemimorphic') || h.includes('scepter')
      || h.includes('spearhead') || h.includes('reticulated')
      || h.includes('thorn'))                               return PRIM_HEX_PRISM_TERMINATED;
  if (h.includes('tabular') || h.includes('platy')
      || h.includes('plate') || h.includes('plates')
      || h.includes('micaceous') || h.includes('specular')
      || h.includes('bladed') || h.includes('blade'))       return PRIM_TABULAR;
  // v134 (2026-05-22): 'plumose' and 'radiating' moved here from the
  // PRIM_BOTRYOIDAL fuzzy branch so radiating-needle habits get the
  // acicular silhouette + spike cluster pattern. Specific habit strings
  // like 'radiating_blade' (-> PRIM_TABULAR) and 'rosette_radiating'
  // (-> PRIM_BOTRYOIDAL) remain in HABIT_TO_PRIMITIVE explicit table
  // and dispatch BEFORE this fuzzy fallback, so the fan-shaped rosettes
  // and bladed radiations keep their existing primitives. Fuzzy
  // 'radiating' + 'plumose' here catches the general needle-fan case.
  if (h.includes('acicular') || h.includes('needle')
      || h.includes('wire') || h.includes('capillary')
      || h.includes('flos_ferri')
      || h.includes('plumose') || h.includes('radiating'))  return PRIM_ACICULAR;
  if (h.includes('botryoidal') || h.includes('reniform')
      || h.includes('mammillary') || h.includes('massive')
      || h.includes('earthy') || h.includes('stalactit')
      || h.includes('opal') || h.includes('chalcedony')
      || h.includes('agate') || h.includes('spherulit')
      || h.includes('globular') || h.includes('nodular')
      || h.includes('framboidal') || h.includes('granular')
      || h.includes('powdery') || h.includes('crust')
      || h.includes('rosette') || h.includes('iridescent')
      || h.includes('sublimation') || h.includes('coating')
      || h.includes('fibrous') || h.includes('nugget')
      || h.includes('silica_gel'))                          return PRIM_BOTRYOIDAL;
  if (h.includes('arborescent') || h.includes('dendritic')) return PRIM_ACICULAR;
  return PRIM_RHOMBOHEDRON;
}

// Deterministic float in [0, 1) seeded from an integer crystal_id.
// Reuses the same Mulberry32 the wall-state generator uses so the
// rotation around c-axis is reproducible across reloads / replays.
function _seededRand(seed) {
  return _mulberry32(seed | 0)();
}

// Box-Muller: deterministic standard-normal sample seeded from
// (crystal_id, channel). Channel lets a single crystal pull multiple
// independent normals — c-axis tilt-x, tilt-z, and rotation-around-c
// each get their own channel so they don't co-vary. Output is N(0, 1);
// callers multiply by the desired σ. Clamped to ±3σ so a once-in-
// thousand outlier doesn't flip a crystal completely sideways.
function _seededGaussian(seed, channel) {
  const r = _mulberry32(((seed | 0) ^ (channel * 0x9E3779B1)) >>> 0);
  // Standard Box-Muller; r() never returns 0 so log is safe.
  const u1 = Math.max(r(), 1e-9);
  const u2 = r();
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(-3, Math.min(3, g));
}

// Build a right-handed basis (perp1, perp2) perpendicular to `axis`,
// rotated by `rotRad` around `axis`. Used to orient a primitive's
// equatorial axes (x, z) in world space for a given anchor.
function _orthonormalBasis(axis, rotRad) {
  const ax = axis[0], ay = axis[1], az = axis[2];
  // Pick a non-parallel helper. World up unless axis ≈ ±y.
  const helper = (Math.abs(ay) < 0.9) ? [0, 1, 0] : [1, 0, 0];
  // p1 = normalize(axis × helper)
  let p1x = ay * helper[2] - az * helper[1];
  let p1y = az * helper[0] - ax * helper[2];
  let p1z = ax * helper[1] - ay * helper[0];
  const p1len = Math.hypot(p1x, p1y, p1z) || 1;
  p1x /= p1len; p1y /= p1len; p1z /= p1len;
  // p2 = axis × p1  (already unit length since axis and p1 are unit + perp)
  const p2x = ay * p1z - az * p1y;
  const p2y = az * p1x - ax * p1z;
  const p2z = ax * p1y - ay * p1x;
  // Rotate the (p1, p2) frame by rotRad around axis.
  const c = Math.cos(rotRad), s = Math.sin(rotRad);
  return [
    [p1x * c + p2x * s, p1y * c + p2y * s, p1z * c + p2z * s],
    [-p1x * s + p2x * c, -p1y * s + p2y * c, -p1z * s + p2z * c],
  ];
}

// Andrew's monotone-chain convex hull of 2D points. Returns the hull
// vertices in CCW order (in screen-y-down coords this looks clockwise
// to a human reader — fine for the canvas fill, which doesn't care).
function _convexHull2D(points) {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ----- Cluster spec: per-habit aggregate parameterization -----
//
// The original wireframe cluster system (`_druzyClusterCount`) only
// fired on a small set of explicit habit strings — `druz`, `crust`,
// `granular`, `earthy`, `arborescent`, `massive`, `sugar`, `coating` —
// plus a size-based fallback for tiny crystals. Everything else
// rendered as a single primitive. That captured the microcrystalline
// drusy-sugar aesthetic but missed the macrocrystalline end of the
// spectrum: vein-comb quartz, MVT comb calcite, parallel-forest
// prismatic druzy — where each individual crystal is a recognizable
// hex-prism point and the aggregate is a forest of upright points
// growing perpendicular to the local wall (the "comb" texture).
//
// The Three.js renderer (99i) already does this correctly via
// `_CLUSTER_PATTERNS` indexed by geom token (prism, spike, cube,
// tablet, etc.). This block ports the same pattern system to the
// wireframe renderer so the two agree.
//
// Reference: PROPOSAL-HABIT-BIAS.md §11 — "when one renderer ships a
// feature, the other should follow within a phase." This is that
// follow.
//
// Per-cluster spec fields:
//   count       — number of satellite crystals around the parent
//   sizeMin/Max — uniform range for per-satellite size multiplier
//                 (drawn deterministically via _seededRand)
//   alpha       — fill-alpha multiplier (1.0 = opaque, <1 = sparkle)
//   radiusMul   — multiplier on the tangent-plane scatter radius
//                 (cluster_radius = parent_a_width × this × mmToPx,
//                  capped at 9 × mmToPx so a runaway crystal can't
//                  blanket the whole vug)
//   evenAngles  — if true, satellites are placed at evenly-spaced
//                 angles around the tangent circle (rosette signature
//                 for desert-rose / hematite-rose tabular habits);
//                 if false, angles are uniform random

// Cluster pattern table for the wireframe renderer. Mirrors
// `_CLUSTER_PATTERNS` in 99i-renderer-three.ts so the two renderers
// produce the same cluster aesthetic for the same habit. Where 99i's
// fields are countScale + scaleMin/Max, here we use absolute count +
// sizeMin/Max because the wireframe never had a "base count by size
// class" lookup — it always returned an explicit number. We bake the
// 99i base (4–6 satellites for typical mm-scale crystals) × countScale
// into a direct count here.
const _CLUSTER_PATTERNS_2D = {
  // Acicular spray — needles fanning out from a single nucleation
  // point. Tighter spread + bigger satellites = the stibnite spray.
  // Mirrors 99i.spike (countScale=1.3, spreadMul=0.6, scaleMin=0.35,
  // scaleMax=0.75).
  spike:        { count:  8, sizeMin: 0.35, sizeMax: 0.75, alpha: 1.0,  radiusMul: 0.55, evenAngles: false },
  // Prismatic forest — quartz druze, beryl forest, comb-quartz. The
  // photo-correction case. Parallel alignment dominates; satellites
  // stand close, mostly matching parent's height. Macro-comb.
  // Mirrors 99i.prism (countScale=1.5, spreadMul=1.1, scaleMin=0.55,
  // scaleMax=0.95).
  prism:        { count:  9, sizeMin: 0.55, sizeMax: 0.95, alpha: 1.0,  radiusMul: 1.0,  evenAngles: false },
  // Cubic carpet — fluorite / halite / pyrite druze. Many small cubes
  // packed against the wall.
  // Mirrors 99i.cube (countScale=1.8, spreadMul=1.4, scaleMin=0.25,
  // scaleMax=0.55).
  cube:         { count: 11, sizeMin: 0.25, sizeMax: 0.55, alpha: 1.0,  radiusMul: 1.3,  evenAngles: false },
  // Octahedral / dodecahedral — chunky isometric, fewer + larger.
  // Mirrors 99i.octahedron (countScale=0.8, scaleMin=0.40, scaleMax=0.75).
  octahedron:   { count:  5, sizeMin: 0.40, sizeMax: 0.75, alpha: 1.0,  radiusMul: 0.9,  evenAngles: false },
  rhombic_dodec:{ count:  5, sizeMin: 0.40, sizeMax: 0.75, alpha: 1.0,  radiusMul: 0.9,  evenAngles: false },
  // Tabular rosette — gypsum desert rose, hematite rose. Petals fanned
  // with even angular spacing. Wider tilt to face the petals outward
  // (the wireframe handles tilt via _renderWireframeInstance's
  // Gaussian scatter — per-pattern tilt is a follow-up).
  // Mirrors 99i.tablet (countScale=1.2, spreadMul=1.3, scaleMin=0.50,
  // scaleMax=0.85, evenAngles=true).
  tablet:       { count:  7, sizeMin: 0.50, sizeMax: 0.85, alpha: 1.0,  radiusMul: 1.2,  evenAngles: true  },
  // Rhombohedral / scalenohedral — calcite chunks + dogtooth. Treated
  // like a less-extreme prism cluster (parallel, recognizable
  // individuals).
  rhomb:        { count:  6, sizeMin: 0.55, sizeMax: 0.90, alpha: 1.0,  radiusMul: 0.9,  evenAngles: false },
  scalene:      { count:  6, sizeMin: 0.55, sizeMax: 0.90, alpha: 1.0,  radiusMul: 0.9,  evenAngles: false },
  // Botryoidal — the primitive is already a multi-bubble cluster;
  // adding satellites would just clutter. Mirrors 99i.botryoidal
  // (countScale=0).
  botryoidal:   { count:  0, sizeMin: 1.0,  sizeMax: 1.0,  alpha: 1.0,  radiusMul: 0.0,  evenAngles: false },
  // Dripstone — air-mode tapered icicle. Single hanging/standing
  // primitive; satellites would break the silhouette.
  dripstone:    { count:  0, sizeMin: 1.0,  sizeMax: 1.0,  alpha: 1.0,  radiusMul: 0.0,  evenAngles: false },
};

const _CLUSTER_PATTERN_2D_DEFAULT = {
  count: 5, sizeMin: 0.40, sizeMax: 0.80, alpha: 1.0, radiusMul: 1.0, evenAngles: false,
};

// Map a primitive object → cluster pattern key. The primitive is what
// _canonicalPrimitive (and the air-mode-aware _lookupCrystalPrimitive)
// returns from the habit-string lookup, so we go through that resolved
// shape rather than re-parsing habit strings. Keeps the wireframe and
// the cluster pattern dispatch agreeing on the same canonical shape.
function _clusterPatternKeyForPrim(prim) {
  if (prim === PRIM_HEX_PRISM_TERMINATED || prim === PRIM_HEX_PRISM) return 'prism';
  if (prim === PRIM_ACICULAR) return 'spike';
  if (prim === PRIM_CUBE || prim === PRIM_PYRITOHEDRON) return 'cube';
  if (prim === PRIM_OCTAHEDRON || prim === PRIM_TETRAHEDRON || prim === PRIM_DIPYRAMID) return 'octahedron';
  if (prim === PRIM_RHOMBOHEDRON) return 'rhomb';
  if (prim === PRIM_SCALENOHEDRON) return 'scalene';
  if (prim === PRIM_TABULAR) return 'tablet';
  if (prim === PRIM_BOTRYOIDAL) return 'botryoidal';
  if (prim === PRIM_DRIPSTONE) return 'dripstone';
  return null;  // unknown → caller falls through to legacy drusy-habit path or single primitive
}

// Drusy-cluster decision: should this crystal render as one large
// primitive (the default) or as a carpet of N small copies?
//
// Real druses are dense carpets — coarse 5–50 nuclei/cm², fine sugar
// coatings 10²–10⁴ — not the few sparse euhedral crystals the v0
// renderer was producing. Habit strings that signal "this is a carpet
// of small crystals, not one big one" map to a cluster count; a
// size-based fallback gives sub-mm individuals a small cluster too,
// since at typical zoom they otherwise read as ambient noise.
//
// 2026-05-22 cluster-spec refactor: function now returns a SPEC OBJECT
// {count, sizeMin, sizeMax, alpha, radiusMul, evenAngles} so the
// caller can use per-pattern parameters (macro-comb prism druze vs
// sparkly micro-drusy vs gypsum-rose evenly-spaced rosette) without
// hardcoding values in `_renderCrystalWireframe`. Legacy explicit-
// habit-string paths (`druz`/`crust`/`granular`/etc.) preserve their
// original counts and micro-cluster parameters byte-for-byte — only
// the API shape changed for those callers.
//
// Dispatch order:
//   1. Explicit micro-drusy habit string (drusy, crust, granular,
//      earthy, dendritic/arborescent, massive, sugar/coating) →
//      legacy micro params (original counts, 0.3–0.7× size, alpha 0.55).
//   2. Per-canonical-primitive macro pattern from _CLUSTER_PATTERNS_2D
//      (prism, spike, cube, tablet, etc.) → macro params with full
//      alpha and larger satellites. THIS is the new path that catches
//      vein-comb quartz / parallel-forest prismatic druze.
//   3. Small-crystal size fallback (c_length < 0.4mm) → 4 mini-copies
//      at micro params, so dust doesn't render as one invisible pixel.
//   4. Default → count: 0 (single primitive).
function _druzyClusterSpec(crystal) {
  const h = (crystal.habit || '').toLowerCase();
  // (1) Legacy explicit drusy habits — preserve the micro-cluster
  // parameters byte-for-byte. The original code used 0.3-0.7 size,
  // 0.55 alpha, 0.9 radiusMul; encode those as the micro defaults.
  const micro = (count) => ({
    count, sizeMin: 0.3, sizeMax: 0.7, alpha: 0.55, radiusMul: 0.9, evenAngles: false,
  });
  if (h.includes('druz'))                                   return micro(16);
  if (h.includes('crust'))                                  return micro(12);
  if (h.includes('granular'))                               return micro(18);
  if (h.includes('earthy'))                                 return micro(22);
  if (h.includes('arborescent') || h.includes('dendritic')) return micro(20);
  if (h.includes('massive'))                                return micro(14);
  if (h.includes('sugar') || h.includes('coating'))         return micro(14);
  // (2) Per-canonical-primitive macro pattern. Use _canonicalPrimitive
  // so the macro-cluster lookup agrees with the actual rendered shape,
  // and so air-mode dripstone overrides (PRIM_DRIPSTONE) skip clustering.
  const prim = _lookupCrystalPrimitive(crystal);
  const key = _clusterPatternKeyForPrim(prim);
  if (key) {
    const pat = _CLUSTER_PATTERNS_2D[key];
    if (pat) {
      // Big gem crystals — same threshold as 99i's _clusterSatelliteCount
      // (cLen > 60 mm reads as a solo specimen, no cluster).
      const cLen = crystal.c_length_mm || 0;
      if (cLen > 60) return { count: 0, sizeMin: 1, sizeMax: 1, alpha: 1, radiusMul: 0, evenAngles: false };
      return { ...pat };
    }
  }
  // (3) Tiny-crystal fallback — preserve the original sparse mini-cluster.
  if ((crystal.c_length_mm || 0) < 0.4) return micro(4);
  // (4) Default — no cluster, single primitive.
  return { count: 0, sizeMin: 1, sizeMax: 1, alpha: 1, radiusMul: 0, evenAngles: false };
}

// Legacy alias — preserved so any external caller (or test) that
// reads the old count-only API still gets a sensible answer. Internal
// callers (`_renderCrystalWireframe`) should consume the spec object.
function _druzyClusterCount(crystal) {
  return _druzyClusterSpec(crystal).count;
}

// Render one wireframe crystal — single primitive or aggregate cluster
// depending on habit/size. The single-instance path lives in
// _renderWireframeInstance; this function dispatches and, when
// clustering, scatters N offset copies in the substrate's tangent
// plane around the parent's anchor cell.
//
// 2026-05-22: per-pattern cluster spec. The spec object returned by
// `_druzyClusterSpec` carries the count + size range + alpha + radius
// multiplier + evenAngles flag, so the same dispatch handles micro
// drusy (sparkly sugar, alpha 0.55, sizes 0.3–0.7) AND macro comb
// druze (vein-comb quartz, alpha 1.0, sizes 0.55–0.95) AND tabular
// rosette (evenly-spaced petals — gypsum desert rose, hematite rose)
// without per-mode dispatch branches. Adding a new cluster mode = one
// entry in `_CLUSTER_PATTERNS_2D`.
function _renderCrystalWireframe(ctx, crystal, cellWorld, sphereRadiusPx,
                                  mmToPx, cx, cy, F) {
  const spec = _druzyClusterSpec(crystal);
  if (spec.count <= 0) {
    _renderWireframeInstance(ctx, crystal, cellWorld, sphereRadiusPx,
                              mmToPx, cx, cy, F, {});
    return;
  }
  // Cluster mode. Each child gets:
  //   * an offset anchor in the substrate's tangent plane (so the
  //     aggregate spreads along the wall, not into the cavity)
  //   * its own seeded c-axis scatter (parent_id ^ child_index)
  //   * a size multiplier drawn uniformly from [sizeMin, sizeMax]
  //   * a fill-alpha multiplier from the spec (1.0 for macro, 0.55 for
  //     micro sparkle).
  const invR = 1 / (Math.hypot(cellWorld[0], cellWorld[1], cellWorld[2]) || 1);
  const subNormal = [-cellWorld[0] * invR, -cellWorld[1] * invR,
                     -cellWorld[2] * invR];
  const [tA, tB] = _orthonormalBasis(subNormal, 0);
  // Cluster radius in pixels: scaled by the parent's a-width (which
  // encodes the crystal's lateral coverage on the wall) so a tight
  // micro fleck stays compact while a wide tablet rosette fans across
  // more cells. radiusMul comes from the per-pattern spec (1.3 for
  // cubic carpet, 0.55 for tight acicular spray, 1.0 for prism forest).
  // Capped so a runaway crystal can't blanket the whole vug.
  const widthMm = Math.max(crystal.a_width_mm || 0,
                            crystal.c_length_mm || 0, 1.0);
  const clusterRadiusPx = Math.min(widthMm * spec.radiusMul * mmToPx, 9 * mmToPx);
  const id = crystal.crystal_id | 0;
  const sizeSpan = spec.sizeMax - spec.sizeMin;
  for (let i = 1; i <= spec.count; i++) {
    // Scatter offset in tangent plane. Two seeded uniforms with
    // sqrt-radius weighting → uniform area density inside the disc.
    const r = Math.sqrt(_seededRand((id ^ (i * 7919)) >>> 0)) * clusterRadiusPx;
    // evenAngles: petals at evenly-spaced angles around the tangent
    // circle (rosette signature — gypsum desert rose, hematite rose).
    // Default: uniform random angle (carpet/forest aesthetic).
    const a = spec.evenAngles
      ? ((i - 1) / spec.count) * 2 * Math.PI + (_seededRand((id ^ (i * 6133)) >>> 0) - 0.5) * 0.3
      : _seededRand((id ^ (i * 6133)) >>> 0) * 2 * Math.PI;
    const jx = r * Math.cos(a), jy = r * Math.sin(a);
    const anchor = [
      cellWorld[0] + tA[0] * jx + tB[0] * jy,
      cellWorld[1] + tA[1] * jx + tB[1] * jy,
      cellWorld[2] + tA[2] * jx + tB[2] * jy,
    ];
    const sizeMul = spec.sizeMin + sizeSpan * _seededRand((id ^ (i * 4111)) >>> 0);
    _renderWireframeInstance(ctx, crystal, anchor, sphereRadiusPx,
                              mmToPx, cx, cy, F, {
      sizeMul,
      seedOffset: i,
      fillAlphaMul: spec.alpha,
    });
  }
}

// One wireframe primitive: silhouette fill (mineral color, 40% of the
// edge alpha) + edges (mineral color, full edge alpha). Anchor +
// size + seed are passed in so the same helper drives both single-
// crystal and cluster-child rendering. c-axis orientation is
// environment-dependent:
//
//   * 'fluid' (default): perpendicular to substrate (= inward sphere
//     normal at the anchor), with Gaussian scatter that reproduces
//     real druse geometric-selection outcomes (Mathematical
//     Geosciences 1989; mature druse σ ≈ 10–15° around the substrate
//     normal, capped at ±30° before extinction). Epitaxial overgrowths
//     (`enclosed_by != null`) lock tighter at σ ≈ 3° because
//     nucleation is templated by the host's lattice.
//
//   * 'air': gravity-aligned. Stalactite c-axis points world-down
//     regardless of substrate orientation; stalagmite world-up. Wall
//     crystals in air are an edge case with no clean geological
//     analog — fall back to substrate-perpendicular.
//
// Within-crystal jitter is seeded from (crystal_id, seedOffset) with
// separate channels so reloads / replays stay reproducible AND
// cluster children get independent randomness.
function _renderWireframeInstance(ctx, crystal, anchor, sphereRadiusPx,
                                   mmToPx, cx, cy, F, opts) {
  const sizeMul       = opts.sizeMul       != null ? opts.sizeMul       : 1.0;
  const seedOffset    = opts.seedOffset    != null ? opts.seedOffset    : 0;
  const fillAlphaMul  = opts.fillAlphaMul  != null ? opts.fillAlphaMul  : 1.0;
  const prim = _lookupCrystalPrimitive(crystal);
  const cLengthPx = Math.max((crystal.c_length_mm || 0.5) * sizeMul * mmToPx, 3);
  const aWidthPx  = Math.max((crystal.a_width_mm  || 0.5) * sizeMul * mmToPx, 3);
  // Substrate-perpendicular at this anchor (= inward sphere normal).
  const invR = 1 / (Math.hypot(anchor[0], anchor[1], anchor[2]) || 1);
  const subNormal = [-anchor[0] * invR, -anchor[1] * invR, -anchor[2] * invR];
  const env = crystal.growth_environment || 'fluid';
  let cAxis;
  if (env === 'air') {
    // See _topoRenderRings3D's wz convention: south-pole/floor sits at
    // -z, so gravity-down = +z direction. Stalactites at the ceiling
    // point at the floor (always +z); stalagmites at the floor point
    // up (always -z). Wall cells in air fall back to perpendicular.
    if (subNormal[2] > 0.4)       cAxis = [0, 0, 1];
    else if (subNormal[2] < -0.4) cAxis = [0, 0, -1];
    else                          cAxis = subNormal;
  } else {
    const epitaxial = crystal.enclosed_by != null;
    const sigmaRad = (epitaxial ? 3 : 12) * Math.PI / 180;
    const seedId = ((crystal.crystal_id | 0) ^ (seedOffset * 0xA5F00D)) >>> 0;
    const [tA, tB] = _orthonormalBasis(subNormal, 0);
    const gx = _seededGaussian(seedId, 1) * sigmaRad;
    const gy = _seededGaussian(seedId, 2) * sigmaRad;
    const tx = subNormal[0] + tA[0] * gx + tB[0] * gy;
    const ty = subNormal[1] + tA[1] * gx + tB[1] * gy;
    const tz = subNormal[2] + tA[2] * gx + tB[2] * gy;
    const len = Math.hypot(tx, ty, tz) || 1;
    cAxis = [tx / len, ty / len, tz / len];
  }
  const rotSeed = ((crystal.crystal_id | 0) ^ 0xC1B2A305 ^ (seedOffset * 0x5BD1E995)) >>> 0;
  const rotRad = (_seededRand(rotSeed) - 0.5) * 2 * Math.PI;
  const [perp1, perp2] = _orthonormalBasis(cAxis, rotRad);
  const projected = [];
  for (const [px, py, pz] of prim.vertices) {
    const wx = anchor[0] + perp1[0] * px * aWidthPx
                          + cAxis[0] * py * cLengthPx
                          + perp2[0] * pz * aWidthPx;
    const wy = anchor[1] + perp1[1] * px * aWidthPx
                          + cAxis[1] * py * cLengthPx
                          + perp2[1] * pz * aWidthPx;
    const wz = anchor[2] + perp1[2] * px * aWidthPx
                          + cAxis[2] * py * cLengthPx
                          + perp2[2] * pz * aWidthPx;
    const proj = _topoProject3D(wx, wy, wz, _topoTiltX, _topoTiltY, F);
    projected.push([cx + proj[0], cy + proj[1]]);
  }
  const edgeAlpha = topoAlphaFor(crystal.mineral);
  const color = topoClassColor(crystal.mineral);
  const hull = _convexHull2D(projected);
  if (hull.length >= 3) {
    ctx.globalAlpha = 0.4 * fillAlphaMul * edgeAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(hull[0][0], hull[0][1]);
    for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = edgeAlpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [a, b] of prim.edges) {
    ctx.moveTo(projected[a][0], projected[a][1]);
    ctx.lineTo(projected[b][0], projected[b][1]);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Phase B (Tier 1.5) — 3D multi-ring renderer.
// Called from topoRender when _topoView3D is true. Renders every ring
// in wall.rings stacked along a vertical (Y) axis, using per-vertex
// projection through _topoProject3D. Rings + crystals are interleaved
// in painter's order (back-to-front by post-rotation z) so wireframe
// crystals occlude the cavity rings behind them — see
// proposals/PROPOSAL-WIREFRAME-CRYSTALS.md.
//
// Painter's-order granularity: rings paint atomically (the entire
// 120-cell outline of a ring is one paint unit). A crystal anchored
// on the front of ring k paints AFTER ring k as a whole — including
// the back-side cells of ring k that should logically be behind the
// crystal. Acceptable v0 trade-off; see addendum B for the per-cell
// upgrade path.
//
// What's intentionally simplified for v0:
//   * Habit textures (sawtooth/botryoidal/etc) collapse into the
//     primitive's wireframe — drawHabitTexture's chord math doesn't
//     compose with arbitrary projection.
//   * Inclusion dots are skipped (they live on ring[0] only; tier-1
//     hit-test was already broken in 3D mode).
//   * Scale bar is skipped — its physical-distance reading is
