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
