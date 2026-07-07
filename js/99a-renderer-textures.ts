// ============================================================
// js/99a-renderer-textures.ts — Topo-line edge textures (botryoidal / saddle-rhomb / sawtooth)
// ============================================================
// drawHabitTexture dispatcher + the 3 texture painters. Uses ctx + cell-arc geometry to paint the colored stroke that represents each crystal occupying its wall cell.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

// Habit-keyed defaults applied to any mineral. Mineral-specific
// overrides go in HABIT_TO_TEXTURE_BY_MINERAL below and take priority.
const HABIT_TO_TEXTURE = {
  // Stage 1 — calcite habits.
  'scalenohedral':       'dogtooth',  // sharp tall triangles (T>200°C; "dog-tooth spar")
  'rhombohedral':        'rhomb',     // broader, shorter triangles (T<200°C, e.g. MVT)
  // Stage 2 — cubic / isometric habits.
  'cubic':               'cube_edge', // pyrite, halite, fluorite, native Cu (galena overridden below)
  'pyritohedral':        'cube_edge', // pyrite alt — pentagonal faces, still blocky
  'cubo-pyritohedral':   'cube_edge', // pyrite mixed
  'pseudo_cubic':        'cube_edge', // chalcopyrite high-T
  // Stage 3 — botryoidal / globular / framboidal (rounded aggregates).
  'botryoidal':          'botryoidal', // chrysocolla, malachite, hematite kidney ore, smithsonite
  'spherulitic':         'botryoidal', // mesolite-style radial bundles read as scalloped on edge
  'framboidal':          'botryoidal', // pyrite microspheres (sweetwater style)
  'reniform_globules':   'botryoidal', // chrysocolla — bigger lobes, same family
  'botryoidal_crust':    'botryoidal', // chrysocolla
  // Stage 4 — acicular / needle / radiating bundles.
  // PLACEHOLDER: dispatches to sawtooth with dogtooth-cloned params
  // pending its own design (true acicular wants a denser, spikier feel).
  'acicular':            'acicular',   // apatite, hemimorphite alt
  'acicular_needle':     'acicular',   // aragonite, bismuthinite low-T
  'acicular sprays':     'acicular',   // (with-space variant)
  'radiating_blade':     'acicular',   // marcasite
  'radiating_columnar':  'acicular',   // hemimorphite
  'radiating_cluster':   'acicular',   // bismuthinite
  'radiating_spray':     'acicular',   // stibnite
  'radiating_fibrous':   'acicular',   // erythrite on cobaltite, etc.
  'cockscomb':           'acicular',   // marcasite — iconic habit name
  'spearhead':           'acicular',   // marcasite
  'elongated_prism_blade': 'acicular', // stibnite Ichinokawa
  'fibrous_acicular':    'acicular',   // chalcedony-style fibrous, also annabergite
  'plumose_rosette':     'acicular',   // erythrite plumose
  // Stage 5 — dolomite habits (THE headline texture: saddle_rhomb).
  'saddle_rhomb':        'saddle_rhomb', // dolomite default — diagnostic curved-face habit
  'coarse_rhomb':        'rhomb',        // dolomite hydrothermal (textbook flat-face rhomb)
  // Stage 6 — hopper / skeletal habits (v134, 2026-05-22). Per Tanaka et
  // al. 2018 J. Phys. Chem. Lett. (PMC5994728), the cubic-to-hopper
  // growth transition for halite happens at a specific σ where edges
  // outpace face centers (diffusion-limited regime: rate ∝ σ³). The
  // resulting morphology has stepped/terraced face centers recessed
  // inward — the "hopper" funnel. Same physics for halide / native /
  // silica polymorphs that ship hopper variants in MINERAL_SPEC.
  // RESEARCH-CRYSTAL-NATURALISM.md §6.3 picked this as a TEXTURE not
  // a primitive (per boss directive 2026-05-22).
  'hopper_growth':       'hopper',  // halite, apophyllite high-σ
  'hopper_cube':         'hopper',  // sylvite high-fill / rapid evap
  'skeletal_hopper':     'hopper',  // galena very-high-σ
  'skeletal_fenster':    'hopper',  // quartz "window" skeletal (rapid cooling)
  'hoppered_hexagonal':  'hopper',  // pyromorphite moderate-high σ low T
  // Stage 7 — calcite σ-regime habits (calcite-morphology arc Phase 2,
  // 2026-06-11). Stepped + hopper families read as the right-angle
  // 'hopper' notch texture (terraced, not spiky) in the 2D wall view;
  // dendritic reads as the acicular rasp (branches = dense spikes at
  // wall-cell scale).
  'stepped_scalenohedral':   'hopper',
  'stepped_rhombohedral':    'hopper',
  'hopper_scalenohedral':    'hopper',
  'hopper_rhombohedral':     'hopper',
  'dendritic_scalenohedral': 'acicular',
  'dendritic_rhombohedral':  'acicular',
  // Stage 8 — halide cube family (morphology-generalization arc,
  // 2026-06-12; 'hopper_cube' already mapped in Stage 6 from the legacy
  // sylvite string — the regime dispatch now emits it for both
  // halides). Banded/stepped cubes read as the terraced notch;
  // dendritic crusts read acicular. The Tanaka 2018 σ³ edge-outpacing
  // physics in the Stage 6 note is exactly the MORPH_TH.halite hopper
  // band (js/45).
  'stepped_cube':            'hopper',
  'dendritic_cube':          'acicular',
  // Stage 9 — bismuth regime family (2026-06-12). Feathery laths read
  // acicular (fans of elongated plates at wall-cell scale); skeletal
  // frames read as the hopper notch; arborescent_dendritic already
  // reads via the 99d dendritic fuzzy.
  'feathery_bismuth':        'acicular',
  'skeletal_bismuth':        'hopper',
  // Stage 10 — pyrite striation overlay (2026-06-12). The deep stepped
  // cube-edge texture IS the striation read in the 2D wall view (the
  // pyrite/galena by-mineral override already used it for 'cubic').
  'striated_cubic':              'cube_edge_deep',
  'striated_pyritohedral':       'cube_edge_deep',
  'striated_cubo_pyritohedral':  'cube_edge_deep',
  // Stage 11 — REE-octahedron regime family (fix-backlog 2026-06-12).
  // Same texture grammar as every other stepped/hopper/dendritic
  // family: terraced notch for the driven bands, acicular rasp for the
  // dendritic crust. Plain octahedral_REE keeps the default (no entry).
  'stepped_octahedral_REE':      'hopper',
  'hopper_octahedral_REE':       'hopper',
  'dendritic_octahedral_REE':    'acicular',
};

// Mineral-specific overrides: HABIT_TO_TEXTURE_BY_MINERAL[mineral][habit]
// wins over HABIT_TO_TEXTURE[habit]. Used when one habit string covers
// minerals that should look distinct (e.g. galena's cubic cleavage is
// deeper / more stepped than pyrite's compact cube faces).
const HABIT_TO_TEXTURE_BY_MINERAL = {
  galena: {
    'cubic': 'cube_edge_deep',   // taller V's — stepped cubic cleavage signature
  },
  fluorite: {
    'cubic': 'cube_edge_deep',   // fluorite cube cleavage is similarly bold
  },
};

// Per-texture parameters. amplitude_factor scales tooth height from
// crystal thickness (real scalenohedra are 3:1+ height:base, so factors
// >1 are correct, not exuberant); pitch_mm sets tooth spacing.
//
// max_amplitude_pitch_ratio (optional) caps amplitude at pitch × ratio,
// to enforce a maximum aspect ratio. cube faces want ~90° peaks
// (ratio 0.5) so they don't render as needles on thick crystals;
// scalenohedra are unbounded (cap omitted) so they can elongate fully.
const TEXTURE_PARAMS = {
  dogtooth:       { amplitude_factor: 1.5, pitch_mm: 2.0 },
  rhomb:          { amplitude_factor: 0.7, pitch_mm: 2.0 },
  cube_edge:      { amplitude_factor: 1.0, pitch_mm: 1.5, max_amplitude_pitch_ratio: 0.5 },
  cube_edge_deep: { amplitude_factor: 1.5, pitch_mm: 1.5, max_amplitude_pitch_ratio: 1.0 },
  // Botryoidal: max ratio 0.5 means at saturation each bump is a perfect
  // half-circle (amplitude = pitch/2). Below saturation bumps flatten into
  // gentle scallops — still reads as round, just less plump.
  botryoidal:     { amplitude_factor: 1.0, pitch_mm: 2.5, max_amplitude_pitch_ratio: 0.5 },
  // Acicular PLACEHOLDER — clones dogtooth's params pending its own
  // design. Future polish: denser pitch, taller amplitude, possibly
  // a "needle bundle" function that draws many tightly-packed spikes
  // instead of a sawtooth. Token kept distinct so swap is one line.
  acicular:       { amplitude_factor: 1.5, pitch_mm: 2.0 },
  // Saddle rhomb — dolomite's diagnostic curved-face signature.
  // bulge_factor controls how far each face bows outward in chord
  // direction (0 = straight rhomb, 1 = extreme curl). 0.4 gives a
  // visibly-curved-but-still-rhomb feel matching textbook saddle
  // dolomite cross-sections.
  saddle_rhomb:   { amplitude_factor: 0.7, pitch_mm: 2.5, max_amplitude_pitch_ratio: 0.5, bulge_factor: 0.4 },
  // Hopper — stepped/terraced face. Per Tanaka et al. 2018, the
  // hopper-cube transition happens at a critical growth rate where
  // edges outrun face centers (~6.5 µm/s for halite at room T). The
  // visual signature is a series of recessed stair-step terraces
  // dropping into the face. In our 2D wall-cell topo view we encode
  // that as a series of rectangular (right-angle) notches pushed
  // inward toward the void — distinct from sawtooth (triangular
  // spikes) because the right-angles read as "stepped" rather than
  // "spiky." Capped at 60° aspect (ratio 0.5) so deep crystals don't
  // produce ribbons. Pitch slightly wider than sawtooth so each notch
  // reads as a discrete step rather than a high-frequency rasp.
  hopper:         { amplitude_factor: 0.9, pitch_mm: 2.2, max_amplitude_pitch_ratio: 0.5 },
};

// Draw the inner (fluid-facing) edge of a wedge from (fromX,fromY) to
// (toX,toY). For 'smooth', emits the existing quadratic Bezier through
// (controlX,controlY) — bit-for-bit identical to the pre-refactor code.
//
// Direction note: the wedge path traverses outer-start → outer-end →
// inner-end → inner-start, so this function draws inner edge END→START.
// Textured polylines must respect that direction or the fill winds wrong.
//
// thicknessMm/cellArcMm bound the texture amplitude; (cx,cy) gives the
// vug center so textures can compute the inward (toward-void) normal.
// `mineral` enables per-mineral overrides where one habit string is
// shared by minerals that should look distinct (e.g. galena vs pyrite,
// both 'cubic').
function drawHabitTexture(ctx, mineral, habit, fromX, fromY, toX, toY, controlX, controlY, thicknessMm, cellArcMm, mmToPx, cx, cy) {
  const texture = _resolveTexture(mineral, habit);
  switch (texture) {
    case 'dogtooth':
      _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.dogtooth);
      return;
    case 'rhomb':
      _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.rhomb);
      return;
    case 'cube_edge':
      _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.cube_edge);
      return;
    case 'cube_edge_deep':
      _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.cube_edge_deep);
      return;
    case 'botryoidal':
      _texture_botryoidal(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.botryoidal);
      return;
    case 'acicular':
      // PLACEHOLDER: same _texture_sawtooth as dogtooth pending its own
      // design. Swap this line when a real acicular function arrives.
      _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.acicular);
      return;
    case 'saddle_rhomb':
      _texture_saddle_rhomb(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.saddle_rhomb);
      return;
    case 'hopper':
      _texture_hopper(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, TEXTURE_PARAMS.hopper);
      return;
    case 'smooth':
    default:
      ctx.quadraticCurveTo(controlX, controlY, toX, toY);
      return;
  }
}

// Resolve a (mineral, habit) pair to a texture token. Priority:
//   1. mineral-specific override (HABIT_TO_TEXTURE_BY_MINERAL)
//   2. exact habit match (HABIT_TO_TEXTURE)
//   3. fuzzy substring fallback (catches variant strings like
//      'botryoidal_crust', 'reniform_globules', 'botryoidal/stalactitic'
//      without enumerating every permutation)
//   4. 'smooth' default
function _resolveTexture(mineral, habit) {
  const byMineral = mineral && HABIT_TO_TEXTURE_BY_MINERAL[mineral];
  if (byMineral && byMineral[habit]) return byMineral[habit];
  if (habit && HABIT_TO_TEXTURE[habit]) return HABIT_TO_TEXTURE[habit];
  if (habit) {
    const h = habit.toLowerCase();
    // v134: hopper / skeletal / fenster check BEFORE botryoidal because
    // 'skeletal_fenster' shouldn't fuzzy-match the botryoidal family.
    // Fenster is the German "window" — quartz fenster crystals show
    // recessed terraced face centers, the silica analog of halite
    // hopper.
    if (h.includes('hopper') || h.includes('skeletal') || h.includes('fenster')) return 'hopper';
    if (h.includes('botryoidal') || h.includes('reniform') || h.includes('globule') || h.includes('framboidal')) return 'botryoidal';
    if (h.includes('acicular') || h.includes('needle') || h.includes('radiating') || h.includes('spray') || h.includes('cockscomb') || h.includes('plumose')) return 'acicular';
  }
  return 'smooth';
}

// Texture amplitude in mm. Primary control is physical (thickness ×
// factor). Optional max_amplitude_pitch_ratio caps amplitude to a
// fixed fraction of the pitch — e.g. cube_edge sets it to 0.5 to
// enforce ≤90° peaks (height ≤ half-base) so thick cubic crystals
// render as blocky-square rather than needle-spike.
function _textureAmplitudeMm(thicknessMm, cellArcMm, params) {
  let amp = thicknessMm * params.amplitude_factor;
  if (params.max_amplitude_pitch_ratio != null) {
    amp = Math.min(amp, params.pitch_mm * params.max_amplitude_pitch_ratio);
  }
  return amp;
}

// Botryoidal — series of smooth half-circle bumps along the chord,
// each pushed inward toward the void. Uses one quadratic Bezier per
// bump with the control point at amplitude × 2 inward (so the curve
// at t=0.5 lands at exactly amplitude inward, giving a clean scallop).
// At amplitude saturation (max_amplitude_pitch_ratio = 0.5) each bump
// is a perfect half-circle ⌒⌒⌒. Below saturation, gentle scallops.
//
// Used by chrysocolla, malachite, hematite kidney ore, framboidal
// pyrite, smithsonite — anywhere the habit string suggests "round
// blobs on the wall" rather than crystalline points or faces.
function _texture_botryoidal(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, params) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) { ctx.lineTo(toX, toY); return; }
  const ux = dx / len, uy = dy / len;
  const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
  const inX = cx - midX, inY = cy - midY;
  const inLen = Math.sqrt(inX * inX + inY * inY) || 1;
  const nx = inX / inLen, ny = inY / inLen;
  const amplitudeMm = _textureAmplitudeMm(thicknessMm, cellArcMm, params);
  const amplitudePx = amplitudeMm * mmToPx;
  const pitchPx = params.pitch_mm * mmToPx;
  const nBumps = Math.max(1, Math.round(len / pitchPx));
  const bumpLen = len / nBumps;
  // Pen at (fromX,fromY); emit a quadratic Bezier per bump → (toX,toY).
  // Control point at segment midpoint pushed inward by 2×amplitude so
  // the Bezier passes through (chord_mid + amplitude × inward_normal)
  // at t=0.5. (Quadratic at t=0.5 = (start + 2·control + end)/4.)
  for (let i = 0; i < nBumps; i++) {
    const t0 = i * bumpLen;
    const t1 = (i + 1) * bumpLen;
    const startX = fromX + t0 * ux, startY = fromY + t0 * uy;
    const endX   = fromX + t1 * ux, endY   = fromY + t1 * uy;
    const segMidX = (startX + endX) / 2, segMidY = (startY + endY) / 2;
    const cpX = segMidX + nx * amplitudePx * 2;
    const cpY = segMidY + ny * amplitudePx * 2;
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  }
}

// Saddle rhomb — dolomite's diagnostic curved-face signature. Each
// tooth has the sawtooth tip-pushed-inward geometry of rhomb, but
// each side is a quadratic Bezier with the control point bulged in
// the chord direction AWAY from the tooth's apex. That bows each
// face outward, giving the wider-at-middle / narrower-at-tip "saddle"
// profile you see in real dolomite cross-sections.
//
// bulge_factor (0..1) sets how far the control points are offset in
// chord-space relative to half the tooth length. 0 = straight V
// (degenerate to rhomb); ~0.4 = textbook saddle; ~0.8 = exaggerated
// fish-scale feel.
//
// This is the texture that makes ordered dolomite (Kim 2023 sabkha
// scenario) visibly distinct from straight calcite rhombohedra on
// the wall — the "dolomite problem" reveal in pictorial form.
function _texture_saddle_rhomb(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, params) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) { ctx.lineTo(toX, toY); return; }
  const ux = dx / len, uy = dy / len;
  const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
  const inX = cx - midX, inY = cy - midY;
  const inLen = Math.sqrt(inX * inX + inY * inY) || 1;
  const nx = inX / inLen, ny = inY / inLen;
  const amplitudeMm = _textureAmplitudeMm(thicknessMm, cellArcMm, params);
  const amplitudePx = amplitudeMm * mmToPx;
  const pitchPx = params.pitch_mm * mmToPx;
  const nTeeth = Math.max(1, Math.round(len / pitchPx));
  const toothLen = len / nTeeth;
  const bulgePx = (params.bulge_factor != null ? params.bulge_factor : 0.4) * (toothLen / 2);
  for (let i = 0; i < nTeeth; i++) {
    const t0 = i * toothLen;
    const tipT = (i + 0.5) * toothLen;
    const t1 = (i + 1) * toothLen;
    const startX = fromX + t0 * ux, startY = fromY + t0 * uy;
    const tipX   = fromX + tipT * ux + nx * amplitudePx;
    const tipY   = fromY + tipT * uy + ny * amplitudePx;
    const endX   = fromX + t1 * ux, endY = fromY + t1 * uy;
    // Side 1 (start → tip): control point at chord-midpoint of (start,tip),
    // pushed in -chord-direction (away from apex, toward t0).
    const cp1X = (startX + tipX) / 2 - ux * bulgePx;
    const cp1Y = (startY + tipY) / 2 - uy * bulgePx;
    ctx.quadraticCurveTo(cp1X, cp1Y, tipX, tipY);
    // Side 2 (tip → end): control point at chord-midpoint of (tip,end),
    // pushed in +chord-direction (away from apex, toward t1).
    const cp2X = (tipX + endX) / 2 + ux * bulgePx;
    const cp2Y = (tipY + endY) / 2 + uy * bulgePx;
    ctx.quadraticCurveTo(cp2X, cp2Y, endX, endY);
  }
}

// Sawtooth — shared by 'dogtooth' (sharp tall, T>200°C scalenohedral
// calcite — "dog-tooth spar") and 'rhomb' (shorter wider, T<200°C
// rhombohedral calcite). Both push triangular teeth inward toward the
// void; only the amplitude_factor and pitch_mm in `params` differ.
function _texture_sawtooth(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, params) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) { ctx.lineTo(toX, toY); return; }
  const ux = dx / len, uy = dy / len;
  // Perpendicular pointing inward (toward vug center). Use chord
  // midpoint → center direction so we don't have to reason about
  // tangent rotation sign in canvas y-down coordinates.
  const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
  const inX = cx - midX, inY = cy - midY;
  const inLen = Math.sqrt(inX * inX + inY * inY) || 1;
  const nx = inX / inLen, ny = inY / inLen;
  const amplitudeMm = _textureAmplitudeMm(thicknessMm, cellArcMm, params);
  const amplitudePx = amplitudeMm * mmToPx;
  const pitchPx = params.pitch_mm * mmToPx;
  const nTeeth = Math.max(1, Math.round(len / pitchPx));
  const toothLen = len / nTeeth;
  // Pen is at (fromX,fromY); emit sawtooth → (toX,toY).
  // Each tooth: tip pushed inward by amplitudePx, then valley back on chord.
  for (let i = 0; i < nTeeth; i++) {
    const tipT = (i + 0.5) * toothLen;
    const valleyT = (i + 1) * toothLen;
    const tipX = fromX + tipT * ux + nx * amplitudePx;
    const tipY = fromY + tipT * uy + ny * amplitudePx;
    const valleyX = fromX + valleyT * ux;
    const valleyY = fromY + valleyT * uy;
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(valleyX, valleyY);
  }
}

// Hopper / skeletal — stepped right-angle notches pushed inward toward
// the void. Visually distinct from sawtooth's triangular spikes
// because each step uses right-angle corners (down, across, up) rather
// than triangular peaks (up, down). Reads as "stepped terraces" rather
// than "spikes."
//
// Per Tanaka et al. 2018 J. Phys. Chem. Lett. (PMC5994728), the
// cubic-to-hopper growth transition for halite happens at a critical
// growth rate (~6.5 µm/s, room T) above which edges outpace face
// centers in a diffusion-limited regime where rate ∝ σ³. The
// resulting morphology has face centers RECESSED behind the edges,
// with stepped terraces marking each growth-rate interval. The
// rectangular-notch profile here encodes that step-down/step-up
// geometry on the 2D cell-edge.
//
// Each tooth has 4 segments:
//   1. Outer half (along chord) — top of the step, on the silhouette
//   2. Step in (perpendicular inward by amplitudePx) — drop into the
//      recess
//   3. Inner half (along chord at the recessed depth) — the recess floor
//   4. Step out (perpendicular outward by amplitudePx) — back to the
//      silhouette before the next tooth begins
//
// Triggered by habit strings containing 'hopper', 'skeletal', or
// 'fenster' (the German "window," used for quartz skeletal). Active
// on halite / sylvite / galena / quartz / apophyllite / pyromorphite
// when their high-σ or high-fill triggers fire.
function _texture_hopper(ctx, fromX, fromY, toX, toY, thicknessMm, cellArcMm, mmToPx, cx, cy, params) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) { ctx.lineTo(toX, toY); return; }
  const ux = dx / len, uy = dy / len;
  // Perpendicular pointing inward (toward vug center). Same convention
  // as _texture_sawtooth — chord-midpoint → vug-center direction so
  // notches push into the void.
  const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
  const inX = cx - midX, inY = cy - midY;
  const inLen = Math.sqrt(inX * inX + inY * inY) || 1;
  const nx = inX / inLen, ny = inY / inLen;
  const amplitudeMm = _textureAmplitudeMm(thicknessMm, cellArcMm, params);
  const amplitudePx = amplitudeMm * mmToPx;
  const pitchPx = params.pitch_mm * mmToPx;
  const nTeeth = Math.max(1, Math.round(len / pitchPx));
  const toothLen = len / nTeeth;
  const halfTooth = toothLen / 2;
  // Pen is at (fromX, fromY); emit hopper stair-step pattern → (toX, toY).
  // Each tooth: outer half (chord top), drop in, inner half (recessed
  // floor), rise out (back to chord) — see header comment for geometry.
  for (let i = 0; i < nTeeth; i++) {
    const t0 = i * toothLen;
    const tMid = t0 + halfTooth;
    const t1 = (i + 1) * toothLen;
    // Outer-mid: end of the outer-flat segment (top of step).
    const outerMidX = fromX + tMid * ux;
    const outerMidY = fromY + tMid * uy;
    // Inner-mid: start of the inner-flat segment (recess floor begins).
    const innerMidX = outerMidX + nx * amplitudePx;
    const innerMidY = outerMidY + ny * amplitudePx;
    // Inner-end: end of the inner-flat segment (recess floor ends).
    const innerEndX = (fromX + t1 * ux) + nx * amplitudePx;
    const innerEndY = (fromY + t1 * uy) + ny * amplitudePx;
    // Outer-end: end of the tooth (back on the silhouette chord).
    const outerEndX = fromX + t1 * ux;
    const outerEndY = fromY + t1 * uy;
    ctx.lineTo(outerMidX, outerMidY);   // top of step (along chord)
    ctx.lineTo(innerMidX, innerMidY);   // drop into the recess
    ctx.lineTo(innerEndX, innerEndY);   // recess floor (along chord at depth)
    ctx.lineTo(outerEndX, outerEndY);   // rise back to silhouette
  }
}

// ============================================================
// MATRIX SKINS (2026-07-06, boss ask: "the vugg wall should have a specific
// texture skin that tells you what kind of matrix it is"). One procedural
// CanvasTexture per host LITHOLOGY, applied as the cavity material's map in
// js/99i. The renderer resolves litho = wall.matrix ?? wall.composition —
// `composition` is the physics field (dissolution gates on it), `matrix` the
// render-only override for scenarios whose composition is a physics proxy
// (chiastolite's metapelite runs as inert 'pegmatite').
//
// Field-guide discipline: low-saturation, small features, no drama. The
// cavity material multiplies map × vertexColors (orientation + water tints),
// so skins are built LIGHT (base ~0.8 luminance) with restrained darker
// features — the existing tints keep working and the skin reads as fabric,
// not paint. Basalt/hornfels/serpentinite are honestly dark hosts and are
// allowed to darken the wall; that IS their identity.
//
// Deterministic: a string-seeded LCG replaces Math.random so a given litho
// paints the same skin every session (reproducible screenshots + no RNG
// discipline questions — the sim's SeededRandom is never touched).
// ============================================================

function _matrixLcg(seedStr: string): () => number {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) { s ^= seedStr.charCodeAt(i); s = Math.imul(s, 16777619) >>> 0; }
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Shared painter helpers — all take the 256×256 ctx.
function _mskBase(ctx: any, color: string) { ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256); }
function _mskStipple(ctx: any, rnd: () => number, n: number, colors: string[], rMin: number, rMax: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    const r = rMin + rnd() * (rMax - rMin);
    ctx.beginPath(); ctx.arc(rnd() * 256, rnd() * 256, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function _mskBands(ctx: any, rnd: () => number, n: number, color: string, alpha: number, wMin: number, wMax: number, wobble: number) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const y = rnd() * 256, h = wMin + rnd() * (wMax - wMin);
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) ctx.lineTo(x, y + Math.sin((x / 256 + rnd()) * Math.PI * 2) * wobble);
    for (let x = 256; x >= 0; x -= 32) ctx.lineTo(x, y + h + Math.sin((x / 256 + rnd()) * Math.PI * 2) * wobble);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function _mskVeins(ctx: any, rnd: () => number, n: number, color: string, alpha: number, width: number) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  for (let i = 0; i < n; i++) {
    let x = rnd() * 256, y = rnd() * 256;
    ctx.beginPath(); ctx.moveTo(x, y);
    const segs = 4 + (rnd() * 5) | 0;
    for (let sSeg = 0; sSeg < segs; sSeg++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function _mskLaths(ctx: any, rnd: () => number, n: number, colors: string[], lMin: number, lMax: number, w: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(rnd() * 256, rnd() * 256); ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    const L = lMin + rnd() * (lMax - lMin);
    ctx.fillRect(-L / 2, -w / 2, L, w);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// One painter per lithology. Palettes are restrained field-guide reads of the
// real rocks; identity comes from fabric (bedding/vesicles/speckle/banding/
// veining), not saturation.
const _MATRIX_SKIN_PAINTERS: Record<string, (ctx: any, rnd: () => number) => void> = {
  limestone(ctx, rnd) {              // pale warm micrite, faint bedding + mottle
    _mskBase(ctx, '#d8d2c4');
    _mskBands(ctx, rnd, 5, '#c9c2b2', 0.35, 6, 18, 3);
    _mskStipple(ctx, rnd, 240, ['#cfc8b9', '#c4bcab', '#ddd7ca'], 1, 4, 0.5);
  },
  dolomite(ctx, rnd) {               // buff sucrosic, fine sparkle stipple + vuggy pits
    _mskBase(ctx, '#d9cbba');
    _mskStipple(ctx, rnd, 700, ['#e2d6c6', '#cec0ae', '#d4c6b4'], 0.6, 2, 0.6);
    _mskStipple(ctx, rnd, 24, ['#b9ab99'], 2, 5, 0.5);
  },
  basalt(ctx, rnd) {                 // dark aphanitic groundmass + vesicles
    _mskBase(ctx, '#6b6662');
    _mskStipple(ctx, rnd, 500, ['#5f5a57', '#75706b'], 0.5, 1.6, 0.5);
    _mskStipple(ctx, rnd, 90, ['#4e4a47'], 1.5, 4.5, 0.8);   // vesicle pits
    _mskStipple(ctx, rnd, 22, ['#8b857c'], 1.5, 3.5, 0.6);   // amygdule fills
  },
  pegmatite(ctx, rnd) {              // coarse felsic intergrowth + mica books
    _mskBase(ctx, '#ded7cb');
    _mskLaths(ctx, rnd, 46, ['#e8e2d8', '#d3cabb', '#e0d5c2'], 20, 52, 12, 0.75);  // feldspar laths
    _mskStipple(ctx, rnd, 40, ['#eeeae2'], 3, 9, 0.7);        // quartz patches
    _mskLaths(ctx, rnd, 26, ['#57524c', '#6a6157'], 4, 12, 3, 0.85);  // mica flecks
  },
  sandstone(ctx, rnd) {              // granular tan + bedding laminae
    _mskBase(ctx, '#d4c19f');
    _mskStipple(ctx, rnd, 900, ['#cdb894', '#dbc9a9', '#c5b08a'], 0.5, 1.8, 0.7);
    _mskBands(ctx, rnd, 7, '#c2ab83', 0.4, 3, 8, 2);
  },
  phonolite(ctx, rnd) {              // greenish-gray aphanitic + sanidine laths
    _mskBase(ctx, '#a9ac9c');
    _mskStipple(ctx, rnd, 420, ['#9fa292', '#b2b5a5'], 0.5, 1.6, 0.5);
    _mskLaths(ctx, rnd, 22, ['#c3c6b6'], 8, 20, 3, 0.7);
  },
  ultramafic(ctx, rnd) {             // dark serpentinite, waxy patches + pale vein net
    _mskBase(ctx, '#525c50');
    _mskStipple(ctx, rnd, 130, ['#5c675a', '#485245'], 3, 10, 0.5);
    _mskVeins(ctx, rnd, 12, '#8a9884', 0.5, 1.4);             // chrysotile veinlets
    _mskVeins(ctx, rnd, 5, '#a9b6a2', 0.35, 2.2);
  },
  marble(ctx, rnd) {                 // near-white recrystallized, soft gray swirls
    _mskBase(ctx, '#e7e4de');
    _mskBands(ctx, rnd, 4, '#d6d2ca', 0.4, 10, 26, 9);
    _mskVeins(ctx, rnd, 6, '#c4bfb5', 0.4, 1.6);
    _mskStipple(ctx, rnd, 300, ['#efece7', '#dedad2'], 0.6, 2, 0.4);  // sugary sparkle
  },
  hornfels(ctx, rnd) {               // dark spotted metapelite (the chiastolite country rock)
    _mskBase(ctx, '#5d5954');
    _mskStipple(ctx, rnd, 600, ['#565250', '#646059'], 0.5, 1.4, 0.5);
    _mskStipple(ctx, rnd, 46, ['#4a4642'], 1.5, 4, 0.7);      // cordierite/graphite spots
  },
  granite(ctx, rnd) {                // finer felsic speckle than pegmatite
    _mskBase(ctx, '#d7d1c6');
    _mskStipple(ctx, rnd, 520, ['#e3ded4', '#c9c1b2', '#d0c7b8'], 1, 3.5, 0.8);
    _mskStipple(ctx, rnd, 130, ['#5d5850', '#6d665c'], 0.8, 2.4, 0.85);  // biotite/hornblende
  },
  gneiss(ctx, rnd) {                 // banded ortho-gneiss — the alpine-cleft country rock
    _mskBase(ctx, '#c9c3b7');
    _mskBands(ctx, rnd, 6, '#7c766c', 0.55, 8, 20, 6);        // mafic bands
    _mskBands(ctx, rnd, 4, '#dcd6cb', 0.5, 6, 14, 6);         // felsic bands
    _mskStipple(ctx, rnd, 200, ['#b5aea1'], 0.6, 2, 0.4);
  },
  amphibolite(ctx, rnd) {            // tormiq's epidote-cleft host — hornblende + plagioclase speckle
    _mskBase(ctx, '#4f554d');
    _mskLaths(ctx, rnd, 90, ['#3d423b', '#454b43'], 4, 12, 2.5, 0.85);  // hornblende laths
    _mskStipple(ctx, rnd, 160, ['#9aa093', '#878d81'], 0.8, 2.4, 0.7);  // plagioclase flecks
    _mskBands(ctx, rnd, 3, '#464c44', 0.35, 8, 18, 5);        // faint foliation
  },
  phyllite(ctx, rnd) {               // ouro preto's imperial-topaz host — silvery sheened foliation
    _mskBase(ctx, '#9b978e');
    _mskBands(ctx, rnd, 9, '#8b877e', 0.5, 2, 6, 4);          // fine wavy foliation
    _mskBands(ctx, rnd, 5, '#aca89e', 0.45, 2, 5, 4);         // sericite sheen streaks
    _mskStipple(ctx, rnd, 150, ['#928e85'], 0.5, 1.6, 0.4);
  },
};

// litho → cached THREE.CanvasTexture. Unknown lithologies fall back to the
// limestone fabric (never throws mid-render); returns null when THREE or a
// 2D canvas is unavailable (headless callers just skip the map).
const _matrixSkinCache = new Map<string, any>();
function _matrixSkinTexture(litho: string): any {
  if (typeof THREE === 'undefined') return null;
  const key = _MATRIX_SKIN_PAINTERS[litho] ? litho : 'limestone';
  let tex = _matrixSkinCache.get(key);
  if (tex !== undefined) return tex;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) { _matrixSkinCache.set(key, null); return null; }
    _MATRIX_SKIN_PAINTERS[key](ctx, _matrixLcg(key));
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);   // ~60°×60° per tile on the lat-long shell — small field-guide fabric
    if ('colorSpace' in tex && typeof (THREE as any).SRGBColorSpace !== 'undefined') {
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
    }
  } catch { tex = null; }
  _matrixSkinCache.set(key, tex);
  return tex;
}

// W-K V1 (wall microtexture, 2026-07-07): the cavity wall's GENESIS RELIEF, a
// procedural NORMAL map keyed on wall.architecture (render-visible via WallState,
// js/85:60 — the double-whitelist already paid for `architecture`). The matrix
// skin (above) tells you the host LITHOLOGY as colour; this tells you the cavity's
// GENESIS as surface texture. Render-only: reads architecture, no sim state.
// Three families cover the 6 archetypes (tools/v1-wall-census.mjs):
//   scallops — dissolution pits (pocket/spherical/irregular/tabular, 33/38 scenarios):
//              Blumberg-Curl scalloped solution surfaces. SYMMETRIC dimples for v1;
//              flow-asymmetric downstream-steepening (Curl 1974) pre-registered.
//   cleft    — parallel fracture striations along the median seam (cleft/Zerrkluft).
//   basin    — horizontal sediment-rind banding (basin/playa floor).
const _WALL_RELIEF_FAMILY: { [k: string]: string } = {
  pocket: 'scallops', spherical: 'scallops', irregular: 'scallops', tabular: 'scallops',
  cleft: 'cleft', basin: 'basin',
};
const _wallReliefCache = new Map<string, any>();
// deterministic hash → [0,1) (RNG-free; jitters scallop centres / step lines)
function _reliefHash(i: number, j: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// height field 0..1, tiling seamlessly on [0,1)² (toroidal), per family
function _wallReliefHeight(fam: string, xf: number, yf: number): number {
  if (fam === 'cleft') {
    // parallel striations running along y; jittered groove spacing in x
    const nG = 9;
    const line = Math.floor(xf * nG);
    const jit = _reliefHash(line, 7) * 0.35;
    let t = (xf * nG) % 1;                 // 0..1 within a groove
    t = (t + jit) % 1;
    return Math.abs(t * 2 - 1);            // triangle → V-grooves
  }
  if (fam === 'basin') {
    // horizontal sediment bands (layering in y), slight per-band thickness jitter
    const nB = 7;
    const band = Math.floor(yf * nB);
    const jit = _reliefHash(band, 13) * 0.4;
    let t = (yf * nB) % 1;
    t = (t + jit) % 1;
    return t < 0.15 ? 0.0 : 1.0;           // sharp bedding plane risers
  }
  // scallops: cellular (Worley F1) concave dimples on a jittered grid
  const G = 4;
  let best = 9;
  for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
    const cxI = Math.floor(xf * G) + gx, cyI = Math.floor(yf * G) + gy;
    const cx = (cxI + 0.25 + 0.5 * _reliefHash(((cxI % G) + G) % G, ((cyI % G) + G) % G)) / G;
    const cy = (cyI + 0.25 + 0.5 * _reliefHash(((cyI % G) + G) % G, ((cxI % G) + G) % G + 99)) / G;
    let dx = Math.abs(xf - cx); dx = Math.min(dx, 1 - dx);
    let dy = Math.abs(yf - cy); dy = Math.min(dy, 1 - dy);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) best = d;
  }
  return Math.min(1, best / (0.62 / G));   // 0 at centre (deep bowl) → 1 at rim
}
// architecture → a cached tangent-space normal map for its genesis relief
function _wallReliefNormalMap(architecture: string): any {
  if (typeof THREE === 'undefined') return null;
  const fam = _WALL_RELIEF_FAMILY[architecture] || 'scallops';
  const cached = _wallReliefCache.get(fam);
  if (cached !== undefined) return cached;
  let tex: any = null;
  try {
    const N = 128;
    const canvas = document.createElement('canvas'); canvas.width = N; canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) { _wallReliefCache.set(fam, null); return null; }
    const Hf = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) Hf[y * N + x] = _wallReliefHeight(fam, x / N, y / N);
    const STR = fam === 'cleft' ? 2.4 : (fam === 'basin' ? 2.0 : 1.7);   // relief strength
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const hL = Hf[y * N + ((x - 1 + N) % N)], hR = Hf[y * N + ((x + 1) % N)];
      const hD = Hf[((y - 1 + N) % N) * N + x], hU = Hf[((y + 1) % N) * N + x];
      let nx = (hL - hR) * STR, ny = (hD - hU) * STR; const nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const i = (y * N + x) * 4;
      img.data[i] = (nx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(fam === 'basin' ? 1 : 5, fam === 'basin' ? 6 : 5);   // basin bands span the shell; scallops/cleft tile
    // NORMAL maps are LINEAR data — must NOT be tagged sRGB (the skin map above is).
    if ('colorSpace' in tex) {
      if (typeof (THREE as any).NoColorSpace !== 'undefined') (tex as any).colorSpace = (THREE as any).NoColorSpace;
      else if (typeof (THREE as any).LinearSRGBColorSpace !== 'undefined') (tex as any).colorSpace = (THREE as any).LinearSRGBColorSpace;
    }
  } catch { tex = null; }
  _wallReliefCache.set(fam, tex);
  return tex;
}

// Paint a centered placeholder hint into the topo canvas. Used when no
// active sim or no ring data exists yet, so the panel reads as 'waiting'
// rather than showing a 340px-tall void. Kept simple: one or two lines
// of muted text, no decoration. Sized via _topoResize so the rendering
// matches what topoRender uses for real content.
