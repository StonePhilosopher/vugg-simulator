// ============================================================
// js/44a-geometric-selection.ts — W-F O3: geometric selection
// ============================================================
// The ontogeny arc's first SIM bump (PROPOSAL-ONTOGENY §3, rung O3).
// Kolmogorov 1949 / van der Drift 1967 / Gray 1984: crystals nucleate on a
// substrate at RANDOM orientations and grow anisotropically; the ones whose
// fast axis points into the void outrun their neighbors and BURY the ones
// tilted away. The palisade/comb fabric is EARNED by competition — survivor
// density thins as n(h) ∝ h^(−1/2) (Gray), survivor tilt → 0 (van der Drift).
// The analytic oracle for both laws is tools/o3-selection-oracle.mjs (built
// and verified first: k≈2 anisotropy reproduces −1/2, isotropic control shows
// no selection).
//
// STENO PIN. This module stores a per-crystal NUCLEATION ORIENTATION — a RIGID
// rotation of the WHOLE crystal (its lattice frame) relative to the substrate
// normal. It NEVER perturbs an individual face normal: interfacial angles are
// fixed by the lattice (Steno 1669). A tilted crystal is the same normal set,
// bodily rotated. This is the exact distinction the arc's first test pin guards.
//
// STAGING (the review's sharpened invariant, PROPOSAL-ONTOGENY §6 point #4):
//   • O3a — the orientation DRAW is recorded at nucleation from an ISOLATED
//     stream (zero shared-rng draws) but NO consumer reads it. GEOMETRIC_
//     SELECTION_ENABLED = false. Byte-identical fleet-wide — the draw exists,
//     is recorded, and is unused. (This file ships in that state.)
//   • O3b — flip the flag TRUE: the renderer leans crystals at their real tilt
//     and the growth loop's burial gate arrests overtaken losers. SIM bump;
//     baselines move BY DESIGN, and the disabled-draw invariant is what makes
//     that move attributable to selection alone.

// Master switch. O3a shipped this false (draw recorded, unread → byte-identical);
// O3b (SIM 218) flips it TRUE — the render leans crystals at their real tilt and
// the burial pass arrests overtaken losers. Baselines move BY DESIGN, and the
// O3a disabled-draw invariant is what attributes the move to selection alone.
let GEOMETRIC_SELECTION_ENABLED = true;

// Nucleation tilt draw — a truncated half-normal in θ (angle off the substrate
// normal) + uniform azimuth. The oracle showed both uniform and σ≈30° draws
// reproduce Gray's −1/2; the concentrated draw gives a tighter, MORE LEGIBLE
// survivor envelope (spec risk #2: keep the hero termination readable), so the
// default is a moderate spread that O3b's calibration tunes against the oracle.
// `let` (not const) so the O3b calibration sweep can rebind without a rebuild.
let O3_TILT_SIGMA_DEG = 28;   // half-normal σ of the initial tilt off normal
let O3_TILT_MAX_DEG   = 55;   // hard truncation (~2σ; van der Drift extinction cone)

// Salt for the orientation stream (ASCII "ORNT"). Distinct from the movement
// (0x4d4f5645) and thermal (0x48454154) salts so orientation draws never
// displace those cascades and vice versa.
const _ORIENT_SALT = 0x4f524e54;

// A dedicated per-run orientation PRNG, thermal-idiom (js/85j _makeThermalRng):
// nucleation orientation is a STOCHASTIC PER-EVENT property (weather — the way
// the atoms happened to land), NOT a fixed cavity property (geology), so it
// derives from `rng.state` captured at sim construction — reproducible at a
// given run seed (baseline-safe at seed 42), different play-to-play (the 200-
// seed canary sweep sees real orientation variation), and consuming ZERO shared
// draws. SCRAMBLED not bare-XOR (js/85j:69 — nearby run seeds correlate under a
// bare XOR): one throwaway avalanche draw, then seed the real stream. Reuses
// _mulberry32 (js/22), a bundle global available by this file's concat order.
function _makeOrientRng(sharedState: number): () => number {
  const scramble = _mulberry32((((sharedState | 0) ^ _ORIENT_SALT) >>> 0));
  return _mulberry32(Math.floor(scramble() * 4294967296) >>> 0);
}

// Draw one nucleation orientation from the isolated stream. Fixed stride of
// exactly THREE draws (two for the Box–Muller θ, one for azimuth) so the
// per-crystal sequence position is predictable. θ is a half-normal truncated
// by bounded rejection (clean truncated Gaussian, no spike at the cap), azimuth
// uniform. Returns { theta, azim } in radians; theta measured off the substrate
// normal, azim around it (applied in the render's tangent-plane basis in O3b).
function drawNucleationTilt(orientRng: () => number): { theta: number; azim: number } {
  const sigma = O3_TILT_SIGMA_DEG * Math.PI / 180;
  const cap = O3_TILT_MAX_DEG * Math.PI / 180;
  let theta = cap;
  for (let tries = 0; tries < 6; tries++) {
    const u1 = Math.max(1e-12, orientRng());
    const u2 = orientRng();
    const g = Math.abs(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
    theta = g * sigma;
    if (theta <= cap) break;
    theta = cap;   // last-iteration fallback holds at the cap (rare: >6σ tail)
  }
  const azim = orientRng() * Math.PI * 2;
  return { theta, azim };
}

// Setters — the bundle wraps top-level `let`/`const` in a closure, so external
// callers (tests, the O3b calibration sweep, the oracle-vs-sim probe) can't
// mutate the bindings directly. Mirrors js/44's graduated-competition setters
// and the setSeed epilogue in tests-js/setup.ts.
function setGeometricSelectionEnabled(v: boolean): void {
  GEOMETRIC_SELECTION_ENABLED = !!v;
}
function setO3TiltSigmaDeg(v: number): void { O3_TILT_SIGMA_DEG = +v; }
function setO3TiltMaxDeg(v: number): void { O3_TILT_MAX_DEG = +v; }

// ============================================================
// O3b — the SELECTION consumers (read _nucTilt; gated by the flag)
// ============================================================

// The burial rule's two calibrated dials (tools/o3-selection-verify.mjs tunes
// them so the fleet's survivor-density-vs-height matches the oracle's h^(−1/2)).
// A crystal is buried when a more-normal NEIGHBOR's growth front leads its own
// by more than the gap — the van der Drift overtaking condition, with the
// lateral geometry folded into one length scale. Larger gap ⇒ gentler thinning
// (only well-overtaken losers sealed) ⇒ closer to Gray's −1/2; a small gap
// over-culls. `let` so the calibration sweep rebinds without a rebuild.
// A crystal is buried when a more-normal NEIGHBOR has out-reached it by more
// than O3_BURY_LEAD_FRAC of the neighbor's OWN front — a RATIO, so the rule is
// scale-invariant (the oracle is about angles + relative positions, not mm): it
// selects identically in a sub-mm crust and a 40 mm pocket. An absolute mm gap
// (the first cut) over-selected big-crystal scenarios and never fired in tiny
// ones — the verify probe caught it. Larger fraction ⇒ gentler (a neighbor must
// tower higher to seal you); smaller over-culls. `let` for the calibration sweep.
let O3_BURY_LEAD_FRAC      = 0.35;  // neighbor front must exceed yours by this fraction to seal you
let O3_BURY_DTHETA_MIN_DEG = 8;     // min tilt advantage — parallel columns (near-equal tilt) coexist
// Young crystals get a GRACE period (in steps) before selection can judge them.
// The sim nucleates over time (unlike the oracle's simultaneous seeding), so a
// fresh nucleus starts at front ~0 and any ratio test would insta-seal it —
// killing the late gap-nucleation real druses keep. Age-based (scale-invariant),
// not a length floor. Never limits who can OVERTAKE.
let O3_BURY_GRACE_STEPS    = 5;
// Geometric selection is a PALISADE phenomenon: it acts on ELONGATE crystals
// competing for outward space (van der Drift's crusts are columnar; Grigor'ev's
// druse). Equant forms (cube/rhomb/octahedron/tetrahedron), tabular + platy
// forms (barite, wulfenite, lepidolite mica books), botryoidal crusts, and
// dendritic/arborescent metal do NOT palisade-compete, so they are exempt from
// BOTH being buried and burying. Gate on aspect c/a — the specimen tests caught
// hard arrest shrinking a cabinet lepidolite book to a 54µm flake and culling a
// bisbee copper dendrite; neither undergoes geometric selection in nature. This
// is the "defer to geology" bedrock, not a threshold nudge to pass tests.
let O3_SELECT_MIN_ASPECT   = 1.4;   // c_length must exceed this × a_width to compete
// Burial SLOWS growth, it does not kill it. A shadowed crystal in a real druse
// keeps creeping in the diminishing space between its overtaking neighbors — it
// is not instantly dead. So a buried crystal stays ACTIVE (still present, still
// counted) but grows at this fraction of its rate, ending a short leaning stub.
// This is gentler than hard arrest (which the specimen tests caught culling
// present-and-documented accessory sulfides below their counts), keeps the fill
// ripple small, and is the more faithful mechanism. 0 would be hard arrest.
let O3_BURY_GROWTH_MULT    = 0.12;
function setO3BuryLeadFrac(v: number): void { O3_BURY_LEAD_FRAC = +v; }
function setO3BuryDThetaMinDeg(v: number): void { O3_BURY_DTHETA_MIN_DEG = +v; }
function setO3BuryGraceSteps(v: number): void { O3_BURY_GRACE_STEPS = +v; }
function setO3SelectMinAspect(v: number): void { O3_SELECT_MIN_ASPECT = +v; }

// Apply a recorded nucleation tilt to a substrate normal — a RIGID rotation of
// the whole c-axis by θ off the normal, azimuth around it, in the normal's own
// tangent frame (_orthonormalBasis, js/99d — a bundle global available at render
// time). The result is unit-length by construction (cos²+sin²=1 across an
// orthonormal triad). Steno-safe: this rotates the AXIS the body is built along;
// the render's per-vertex build preserves every interfacial angle. Returns the
// normal unchanged when tilt is absent.
function o3TiltedAxis(
  normal: number[],
  tilt: { theta: number; azim: number } | null | undefined,
): [number, number, number] {
  if (!tilt) return [normal[0], normal[1], normal[2]];
  const [tA, tB] = _orthonormalBasis(normal, 0);
  const st = Math.sin(tilt.theta), ct = Math.cos(tilt.theta);
  const ca = Math.cos(tilt.azim), sa = Math.sin(tilt.azim);
  return [
    normal[0] * ct + (tA[0] * ca + tB[0] * sa) * st,
    normal[1] * ct + (tA[1] * ca + tB[1] * sa) * st,
    normal[2] * ct + (tA[2] * ca + tB[2] * sa) * st,
  ];
}

// A crystal's growth-front reach into the void = its length projected onto the
// substrate normal: a tilted crystal projects LESS far per unit growth, so it
// is overtaken by a more-normal neighbor — the mechanism of selection. Reads
// c_length_mm (the actual rendered extent, cavity-capped) × cos θ.
function o3NormalFrontMm(crystal: any): number {
  const t = crystal && crystal._nucTilt;
  const L = (crystal && crystal.c_length_mm) || 0;
  return t ? L * Math.cos(t.theta) : L;
}
