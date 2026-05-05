// ============================================================
// js/20c-chemistry-redox.ts — Nernst-equation redox infrastructure
// ============================================================
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 4a. Brings Eh online as a
// continuous fluid state (mV) plus three explicit redox couples
// (Fe³⁺/Fe²⁺, Mn⁴⁺/Mn²⁺, SO₄²⁻/HS⁻) that engines can query for the
// fraction of a given element sitting in its oxidized vs reduced
// pool. Gates the long-tail engine migration that follows in 4b.
//
// Coupling: this module is the Eh-side complement to Phase 3a's
// carbonate-system module (20b-chemistry-carbonate-system.ts).
// Both use the same pH input from `fluid.pH`. At neutral pH the
// Mn and S couples are pH-strongly-dependent; the Fe couple is
// pH-independent in the simple Fe³⁺/Fe²⁺ form, but in real waters
// hydrolysis (Fe(OH)₃ formation) introduces an effective pH slope.
// The simple n-electron Henderson-Hasselbalch form here is enough
// resolution for game-mode chemistry; Phase 4b can refine specific
// couples if calibration calls for it.
//
// Default state: EH_DYNAMIC_ENABLED = false. Engines still gate on
// `fluid.O2 > X` until Phase 4b migrates them one class at a time.
// With the flag on (Phase 4c), `redoxFraction(fluid, 'Fe')` etc.
// becomes the canonical query and `fluid.O2` collapses to a derived
// proxy via `ehFromO2`.
//
// Conventions:
//   - Eh in mV (volts × 1000), positive = oxidizing.
//     +500 mV ≈ aerobic surface water, oxic.
//     +200 mV ≈ mildly oxidizing groundwater (default).
//     0 mV   ≈ redox boundary, transition zone.
//     -100 mV ≈ Fe-reducing, ferruginous.
//     -200 mV ≈ sulfate-reducing, sulfidic.
//     -400 mV ≈ methanogenic.
//   - REDOX_COUPLES values are E° in mV at 25°C, plus a pH
//     coefficient (mV per pH unit) and electron count n.
//   - Henderson-Hasselbalch slope at 25°C: 59.16 / n mV.
//     Slope = 2.303 × R × T / (n × F).

const EH_DYNAMIC_ENABLED = false;

// Three half-reactions encoded — the minimum set the proposal calls
// for. Each entry: E0 in mV, n electrons, pHCoeff (mV per pH unit
// shift in apparent E0). pHCoeff comes from the H⁺ stoichiometry of
// the half-reaction; the formula is -59.16 × m / n where m is the
// number of H⁺ in the oxidized → reduced step.
//
// Fe³⁺ + e⁻ ⇌ Fe²⁺
//   m = 0 (no H⁺), n = 1 → pHCoeff = 0.
//
// MnO₂ + 4H⁺ + 2e⁻ ⇌ Mn²⁺ + 2H₂O
//   m = 4, n = 2 → pHCoeff = -118.32 mV/pH (very pH-sensitive).
//   In real waters the dominant Mn redox is the Mn⁴⁺/Mn²⁺ couple
//   through the manganite intermediates; this two-electron form is
//   the standard textbook reference.
//
// SO₄²⁻ + 9H⁺ + 8e⁻ ⇌ HS⁻ + 4H₂O
//   m = 9, n = 8 → pHCoeff = -66.6 mV/pH.
//   E0 from Stumm & Morgan, Aquatic Chemistry (3rd ed.) Table 8.1.
const REDOX_COUPLES = {
  Fe: { E0: 770,  n: 1, pHCoeff:    0 },   // Fe³⁺/Fe²⁺
  Mn: { E0: 1230, n: 2, pHCoeff: -118.32 }, // MnO₂/Mn²⁺
  S:  { E0: 250,  n: 8, pHCoeff:  -66.6 },  // SO₄²⁻/HS⁻
};

// Nernst-derived oxidized fraction of a redox couple. Returns
// f_ox ∈ [0,1] giving the proportion of the element sitting in its
// oxidized pool at the current Eh and pH. Reduced fraction is 1-f_ox.
//
// Formula:
//   E_apparent = E0 + pHCoeff × pH
//   slope     = 59.16 / n  (mV per decade at 25°C)
//   f_ox       = 1 / (1 + 10^((E_apparent - Eh) / slope))
//
// Behavior:
//   - Eh ≫ E_apparent → f_ox → 1 (mostly oxidized)
//   - Eh ≪ E_apparent → f_ox → 0 (mostly reduced)
//   - Eh = E_apparent → f_ox = 0.5 (50/50 split, the redox boundary)
function nernstOxidizedFraction(couple: any, Eh_mV: number, pH: number): number {
  if (!couple) return 0.5;
  const Eapparent = couple.E0 + couple.pHCoeff * pH;
  const slope = 59.16 / Math.max(1, couple.n);
  const x = (Eapparent - Eh_mV) / slope;
  // Cap exponent so very acidic + very oxidizing systems don't
  // produce Infinity. f_ox saturates at 1 / (1 + ε) ≈ 1.
  if (x > 30) return 0;
  if (x < -30) return 1;
  return 1 / (1 + Math.pow(10, x));
}

// Convenience: read fluid.Eh + fluid.pH and return the oxidized
// fraction of the named element ('Fe', 'Mn', or 'S'). Falls back to
// 0.5 (no information) if the element isn't in REDOX_COUPLES.
//
// Engines after Phase 4b read this instead of `fluid.O2 > 0.5`. With
// the EH_DYNAMIC_ENABLED flag off, callers should still rely on
// `fluid.O2`; this helper is callable but unused in flag-OFF mode.
function redoxFraction(fluid: any, element: string): number {
  if (!fluid) return 0.5;
  const couple = REDOX_COUPLES[element];
  if (!couple) return 0.5;
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7;
  return nernstOxidizedFraction(couple, Eh, pH);
}

// Backward-compatibility derivation: scenarios that only set
// `fluid.O2` (the legacy redox proxy) get a sensible default Eh
// inferred from it. Mapping per the proposal:
//   O₂ > 1.0  → Eh > +500 mV (well-oxygenated)
//   O₂ ≈ 0.3  → Eh ≈ 0 mV (boundary)
//   O₂ < 0.1  → Eh < -100 mV (sulfate-reducing)
// Linear interpolation in log space — O₂ varies over orders of
// magnitude in real systems, Eh varies linearly with log[O₂] per
// the half-reaction O₂ + 4H⁺ + 4e⁻ ⇌ 2H₂O.
function ehFromO2(O2_ppm: number): number {
  if (typeof O2_ppm !== 'number' || O2_ppm <= 0) return -200;
  // pin three anchors: (0.05, -150), (0.5, +100), (5.0, +500)
  // and interpolate between them in log10(O2) space.
  const logO2 = Math.log10(Math.max(O2_ppm, 1e-6));
  // log10 anchors: -1.30 → -150, -0.30 → +100, +0.70 → +500
  // Slope between them ≈ +250 mV per decade of O₂.
  if (logO2 <= -1.30) return -150 + (logO2 - (-1.30)) * 100;  // saturate gently below
  if (logO2 <= -0.30) return -150 + (logO2 - (-1.30)) * (250 / 1.0);
  if (logO2 <= 0.70)  return  100 + (logO2 - (-0.30)) * (400 / 1.0);
  return 500 + (logO2 - 0.70) * 100;  // saturate gently above
}

// Optional: when a scenario sets fluid.Eh directly but legacy engines
// still read fluid.O2, derive a synthetic O2 so they keep working.
// Inverse of ehFromO2 — same anchors. Used by Phase 4b migration so
// scenarios can be written in mV terms and engines that haven't
// migrated yet see consistent O₂.
function o2FromEh(Eh_mV: number): number {
  if (typeof Eh_mV !== 'number') return 0.5;
  if (Eh_mV >= 500)  return Math.pow(10,  0.70 + (Eh_mV - 500) / 1000);
  if (Eh_mV >= 100)  return Math.pow(10, -0.30 + (Eh_mV - 100) / 400);
  if (Eh_mV >= -150) return Math.pow(10, -1.30 + (Eh_mV - (-150)) / 250);
  return Math.pow(10, -1.30 + (Eh_mV - (-150)) / 100);
}

// ============================================================
// Phase 4b sulfate-class engine helpers
// ============================================================
// Two helpers consumed by js/40-supersat-sulfate.ts for the long-tail
// engine migration. With EH_DYNAMIC_ENABLED off, both passthrough to
// the legacy fluid.O2 form so seed-42 output is byte-identical. With
// the flag on (Phase 4c), they consult fluid.Eh via the ehFromO2 /
// o2FromEh anchor mapping. The sulfate class is the proof-of-pattern;
// arsenate / carbonate / hydroxide / oxide / sulfide get their own
// helpers as the migration walks the remaining 5 classes.
//
// Why per-class helpers and not a single generic one: each class has
// its own redox semantics (sulfate gates oxidized side, sulfide gates
// reduced side, carbonate mixes Fe-state and S-state). One helper
// per class keeps each migration commit self-contained and the
// thresholds adjustable without touching unrelated engines.

// Returns true if the sulfate redox state passes the legacy O2
// threshold. Form: replaces `fluid.O2 < X` with
// `!sulfateRedoxAvailable(fluid, X)` (note the negation — this helper
// is "is it oxidized enough?", the legacy was "is it not oxidized
// enough?"). With flag off, identical to `fluid.O2 >= X` — the strict
// `<` legacy form combined with the negation gives the same boundary.
function sulfateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  // Phase 4c calibration: gate on Eh equivalent to the legacy O2 cutoff.
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

// Returns the multiplier form of the legacy O2 factor:
// `Math.min(fluid.O2 / scaleAtFull, cap)`. cap defaults to Infinity
// for sites that don't cap (e.g. selenite's `O2/0.5`). With flag off,
// identical to the inline expression. With flag on, derives a
// synthetic O2 from current Eh and applies the same ratio.
function sulfateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  // Phase 4c: synthesize an O2 equivalent from current Eh, apply the
  // legacy ratio. Per-site tuning of scaleAtFull/cap stays callable
  // by individual engine sites if calibration calls for it.
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// ============================================================
// Phase 4b hydroxide-class engine helpers
// ============================================================
// For Fe(III) hydroxides (goethite, lepidocrocite). The legacy
// fluid.O2 gate stands proxy for Fe being in its oxidized state — at
// low O2 / low Eh, Fe is Fe²⁺ and stays in solution as a soluble
// cation; at high O2 / high Eh it becomes Fe³⁺ and hydrolyzes /
// precipitates. Phase 4c will bind these helpers to
// redoxFraction(fluid, 'Fe') with E°(Fe³⁺/Fe²⁺) = 770 mV; the legacy
// fluid.O2 thresholds in goethite/lepidocrocite (0.4 and 0.8) map to
// Eh thresholds well above the Fe couple's midpoint, which is
// consistent with these minerals only forming under solidly oxic
// conditions in real groundwater.
//
// Same flag-OFF passthrough shape as sulfate; named separately so
// Phase 4c can tune Fe-couple thresholds independently of S-couple.

function hydroxideRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  // Phase 4c: gate on Fe couple oxidized fraction. Equivalent
  // threshold logic — using ehFromO2 as a coarse anchor for now.
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function hydroxideRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// ============================================================
// Phase 4b oxide-class engine helpers
// ============================================================
// Oxides have three different redox shapes — unlike sulfate/hydroxide
// which are uniformly "needs oxidized state":
//
//   1. HEMATITE (Fe₂O₃, Fe(III)): standard oxidized-side, same shape
//      as sulfate. oxideRedoxAvailable/Factor.
//
//   2. URANINITE (UO₂, U(IV)): REDUCED-side. Forms only when fluid is
//      sufficiently anoxic; uranium oxidation to U(VI) keeps uranyl
//      mobile in solution. oxideRedoxAnoxic/AnoxicFactor.
//
//   3. MAGNETITE (Fe₃O₄, mixed Fe(II)/Fe(III)) and CUPRITE (Cu₂O,
//      Cu(I), intermediate copper oxidation): WINDOWED — neither
//      solidly oxic nor anoxic. Forms in transition zones with a
//      preferred peak. oxideRedoxWindow/Tent.
//
// All variants flag-OFF passthrough to fluid.O2; flag-ON Phase 4c
// will bind the standard form to redoxFraction(fluid, 'Fe'), the
// anoxic form to a U-couple (TBD: add to REDOX_COUPLES), and the
// windowed forms to per-mineral Eh band specs.

// Standard oxidized-side gate (hematite-style).
function oxideRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

// Standard oxidized-side multiplier (hematite-style).
function oxideRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// Reduced-side gate (uraninite-style): true when conditions are
// reducing enough — i.e., when fluid.O2 is BELOW the threshold.
// Replaces `if (fluid.O2 > X) return 0` with `if (!oxideRedoxAnoxic(fluid, X)) return 0`.
function oxideRedoxAnoxic(fluid: any, o2UpperBound: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) <= o2UpperBound;
  }
  const EhEquivalent = ehFromO2(o2UpperBound);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh <= EhEquivalent;
}

// Reduced-side multiplier (uraninite-style): factor grows as O2
// falls. Legacy form: `(scale - fluid.O2)`. With the upstream gate
// ensuring O2 stays well under `scale`, the result stays positive.
function oxideRedoxAnoxicFactor(fluid: any, scale: number): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return scale - O2;
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return scale - o2eq;
}

// Windowed gate (magnetite/cuprite-style): true when fluid.O2 sits
// within [low, high]. Replaces `if (fluid.O2 < low || fluid.O2 > high) return 0`
// with `if (!oxideRedoxWindow(fluid, low, high)) return 0`.
function oxideRedoxWindow(fluid: any, o2Low: number, o2High: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return O2 >= o2Low && O2 <= o2High;
  }
  const EhLow = ehFromO2(o2Low);
  const EhHigh = ehFromO2(o2High);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhLow && Eh <= EhHigh;
}

// Tent-function multiplier (magnetite/cuprite-style): Math.max(floor,
// 1.0 - Math.abs(O2 - peak) * slope). Falls off linearly from a peak
// value of 1.0 at the specified peak O2, with a floor.
function oxideRedoxTent(fluid: any, peak: number, slope: number, floor: number): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.max(floor, 1.0 - Math.abs(O2 - peak) * slope);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.max(floor, 1.0 - Math.abs(o2eq - peak) * slope);
}
