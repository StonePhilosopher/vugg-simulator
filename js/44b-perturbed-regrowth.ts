// ============================================================
// js/44b-perturbed-regrowth.ts — W-F O5: perturbed regrowth (the film)
// ============================================================
// The ontogeny arc's SECOND SIM bump (PROPOSAL-ONTOGENY §3 rung O5; full arc
// design in PROPOSAL-O5-PERTURBED-REGROWTH-2026-07-08.md). O5 is THE
// ORIGINATING ASK — the boss's founding phrasing for the whole workstream:
// "how uneven mineral inclusions can alter later layers of growth." A film of
// foreign matter (chlorite, clay, an inert overgrowth) settles on a growth
// front and MASKS it; masked faces stall until the fluid supersaturates enough
// to grow THROUGH the film, leaving a phantom horizon in the lattice — and,
// when the prism is masked but the tip is free, the masking SCEPTRE (the second
// natural sceptre route, distinct from the corrosion route grimsel already
// earns in js/45 classifyQuartzSceptre).
//
// THE σ*(φ) LAW — settled by two independent research passes reconciled
// 2026-07-08 (rockbot's RESEARCH-SIGMA-STAR-PHI + the builder's parallel pass;
// both converged on the hyperbolic form, cross-confirmed citations, adopted
// rockbot's baseline-anchored version):
//
//     σ*(φ) = σ*₀ · (1 + k · φ/(1−φ))
//
//   σ*₀ = the crystal's EXISTING clean-surface threshold (per-mineral σ_crit).
//   φ   = MACROSCOPIC film coverage in [0,1) (a chlorite blanket — NOT the
//         ppm-scale molecular adsorbate θ~1e-6 the lab literature measures).
//   k   = one calibrated constant (SIGMA_STAR_K), tuned on the sim's own σ
//         scale by the 4a.7 recipe in O5b.
//
// WHY THIS FORM (over-determined by the two passes):
//   • φ=0  → σ* = σ*₀ exactly: an unfilmed crystal is BIT-FOR-BIT as today, so
//     the O5b blast radius is a property of the equation (only film-writing
//     scenarios can move) — no `if (!_film)` guard needed. This is also why the
//     builder's first-draft `k·φ/(1−φ)` (→ σ*(0)=0, a clean crystal with no
//     threshold) was WRONG and rockbot's baseline anchor was adopted.
//   • φ→1  → σ* diverges: a complete film fully arrests growth (Ehrenberg 1993,
//     Norwegian-Shelf grain-coating chlorite quenches quartz cementation). The
//     divergence is HONORED, not clamped to a modest cap — a heavy blanket is a
//     heavy barrier. Real films sit at φ<1 (Ehrenberg's micro-overgrowths creep
//     through gaps), so φ=1 exactly = full burial = an inclusion (O4, not O5).
//   • The APPROACH is super-linear / sharp, NOT a gentle linear fade: DeYoreo,
//     Wasylenki & Dove 2004 (calcite AFM — the nearest measured mineral) found
//     both Cabrera–Vermilyea AND kink-blocking fail, with a sharp step-speed
//     drop above a threshold coverage. The hyperbolic form renders that; the
//     literature licenses going sharper (a sigmoid), never gentler-linear.
//
// STAGING (the O3a/O3b template — record-unread, then flip):
//   • O5a — this file ships O5_MASKING_ENABLED = false. `_film` state is
//     RECORDED on crystals (by the event `film:` directive and by O4b's
//     coats_front enclosures) and the σ*(φ) law EXISTS and is unit-tested, but
//     NO growth path reads it. Byte-identical fleet-wide (0/38), proven by
//     regenerating the baseline with the writers live. Consumes ZERO shared RNG
//     (dusting is deterministic — even simpler than O3a's isolated stream).
//   • O5b — flip the flag TRUE: the growth loop calls sigmaStarForCoverage to
//     gate each masked axis; the first zone that grows THROUGH the film is
//     tagged `masked_horizon`; classifyQuartzSceptre generalizes to the masking
//     route. SIM bump; movers == the O5a census's writer list, everything else
//     byte-identical. First content = the Sweetwater snowball-barite scenario.
//   • O5c — the phantom band renders (D2 vertexColors seam), the O4a idiom.

// Master switch. O5a shipped this FALSE (film recorded + law defined, unread →
// byte-identical). O5b (SIM 222) flips it TRUE: the masking gate goes live in
// the growth path (js/85 growth loop). Baselines move BY DESIGN, and the O5a
// disabled-read invariant is what attributes the move to masking alone —
// confined to the film-carrying scenarios the O5a census pre-registered.
let O5_MASKING_ENABLED = true;

// The single calibrated constant of the σ*(φ) law. Placeholder 1.0 for O5a
// (the law is unread); O5b calibrates it on the sim's σ scale by the 4a.7
// recipe (probe the fleet's σ dynamic range → pick k so a realistic chlorite
// blanket, φ≈0.6–0.9, lifts σ* into the "stall until a fresh pulse" band, not
// so high nothing ever resumes nor so low the film is cosmetic). `let` so the
// O5b calibration sweep can rebind without a rebuild (the O3 dial idiom).
let SIGMA_STAR_K = 1.0;

// φ is clamped just below 1 before it enters the law — a real film always
// leaves gaps (Ehrenberg's through-gap micro-overgrowths), and φ=1 exactly is
// full burial (an inclusion, O4's domain), so the growth gate never sees a
// literally-infinite barrier. This is a NUMERICAL guard on the divergence, not
// a cap on its magnitude: at φ=0.98 the barrier is already σ*₀·(1+49k).
const O5_PHI_MAX = 0.995;

// Writer 2's per-guest coverage increment. Each O4b `coats_front` enclosure —
// a guest that nucleated ON the host and was buried at its growth front (js/85c)
// — deposits this much termination-film on the host: the grain that sat on the
// advancing tip is itself the mask. Coverage ACCUMULATES across guests (a host
// with several front-coating inclusions is more masked), capped at O5_PHI_MAX.
// Front-coatings land on the TERMINATION axis (the growth front), not the prism
// flanks. Placeholder magnitude for O5a (unread); O5b calibrates whether a
// single 0.4 mm speck should mask this much (probably tune down) against the
// event-dusting φ scale. `let` for that sweep.
let O5_COATS_FRONT_PHI_STEP = 0.15;
function setO5CoatsFrontPhiStep(v: number): void { O5_COATS_FRONT_PHI_STEP = +v; }

// The reconciled dead-zone law. Pure, DOM-free, RNG-free — unit-tested in
// isolation (tests-js/o5-film.test.ts) exactly as drawNucleationTilt is. Called
// by NOTHING in O5a; the growth-path call site lands in O5b behind the flag.
//   sigmaStar0 : the crystal's clean-surface threshold σ*₀ (per-mineral σ_crit)
//   phi        : macroscopic film coverage on the axis in question, [0,1]
// Returns the supersaturation a masked axis must clear to grow. φ≤0 → σ*₀
// (unmasked = today's threshold, the byte-identity anchor).
function sigmaStarForCoverage(sigmaStar0: number, phi: number): number {
  const s0 = Number.isFinite(sigmaStar0) ? sigmaStar0 : 0;
  if (!(phi > 0)) return s0;                       // unmasked → clean threshold
  const p = Math.min(phi, O5_PHI_MAX);
  return s0 * (1 + SIGMA_STAR_K * p / (1 - p));
}

// Writer 1's core — apply a film dusting to a set of crystals. Called by the
// event `film:` directive (js/85d apply_events) when a scenario's dusting beat
// fires: every currently-active, non-enclosed target crystal gets `_film` set
// to the event's coverages. DETERMINISTIC (no RNG), touches no fluid/T/growth —
// it only records per-crystal state the O5b gate will later read. A second
// dusting on an already-filmed crystal takes the MAX coverage per axis (films
// accrete, they don't wash off) and refreshes the step stamp.
//
// mineralFilter: array of mineral names the dust settles on, or null = all.
// Returns the count of crystals dusted (for the log line + the census).
function applyFilmDusting(
  crystals: any[],
  filmMineral: string,
  phiTerm: number,
  phiPrism: number,
  step: number,
  mineralFilter?: string[] | null,
): number {
  if (!Array.isArray(crystals)) return 0;
  const pt = Math.max(0, Math.min(1, Number(phiTerm) || 0));
  const pp = Math.max(0, Math.min(1, Number(phiPrism) || 0));
  let n = 0;
  for (const c of crystals) {
    if (!c || !c.active || c.dissolved || c.enclosed_by != null) continue;
    if (mineralFilter && mineralFilter.length && !mineralFilter.includes(c.mineral)) continue;
    const prev = c._film;
    c._film = {
      mineral: filmMineral || (prev && prev.mineral) || 'film',
      phi_term: prev ? Math.max(prev.phi_term || 0, pt) : pt,
      phi_prism: prev ? Math.max(prev.phi_prism || 0, pp) : pp,
      step,
    };
    n++;
  }
  return n;
}

// Setters — the bundle wraps top-level bindings in a closure, so external
// callers (tests, the O5b calibration sweep, the census tool) mutate through
// these. Mirrors js/44a's setGeometricSelectionEnabled / setO3* idiom.
function setO5MaskingEnabled(v: boolean): void { O5_MASKING_ENABLED = !!v; }
function setSigmaStarK(v: number): void { SIGMA_STAR_K = +v; }
