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

// Master switch. O3a = false (draw recorded, unread → byte-identical).
let GEOMETRIC_SELECTION_ENABLED = false;

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
