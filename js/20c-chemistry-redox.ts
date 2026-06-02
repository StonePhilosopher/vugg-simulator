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
// State (Phase 4c.2, 2026-06-02): EH_DYNAMIC_ENABLED is now ON by
// default. Every redox engine consumes Eh via the per-class helpers,
// which derive a synthetic O2 from the fluid's Eh (`o2FromEh(fluid.Eh)`)
// and apply the legacy ratio/threshold against it. This is byte-identical
// to the old `fluid.O2` path because (a) `_syncRedoxEh` (85c) keeps
// `fluid.Eh = ehFromO2(fluid.O2)` synced just before the engines read it
// each step, and (b) `ehFromO2`/`o2FromEh` are exact inverses for
// O2 ∈ [0.05, 5] — which covers every scenario (max observed O2 ≈ 2.2);
// above 5 `o2FromEh` saturates gently (no NaN / wild values), so even a
// pathological high-O2 cell degrades safely rather than breaking.
//
// `let` + setter (mirrors setCarbonateKspActive): the bundle's closure-
// scoped binding can't be flipped via globalThis, so tests that want to
// exercise the legacy flag-OFF passthrough wrap their body in
// setEhDynamicEnabled(false) … restore.
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

let EH_DYNAMIC_ENABLED = true;

// Setter (mirrors setCarbonateKspActive) — the only safe way to flip the
// closure-scoped binding from outside the bundle. Tests exercising the
// legacy flag-OFF passthrough call setEhDynamicEnabled(false), run, then
// setEhDynamicEnabled(true) to restore.
function setEhDynamicEnabled(enabled: boolean): void {
  EH_DYNAMIC_ENABLED = !!enabled;
}
function snapshotEhDynamicFlag(): boolean { return EH_DYNAMIC_ENABLED; }
function restoreEhDynamicFlag(snap: boolean): void { EH_DYNAMIC_ENABLED = !!snap; }

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

// ============================================================
// Phase 4d arsenic-state split (v92, 2026-05-19)
// ============================================================
// Closes residual debt flagged from the v85-v90 mineral push: the
// simulator's single fluid.As pool couldn't represent oxidation state
// distinctly, so arsenate engines (which need As(V)) had to use proxy
// gates against sulfide loading. The v88 pharmacolite engine carried
// an explicit `if (fluid.S > 50) return 0` band-aid for exactly this
// reason — Sulphur Bank's S=400 ppm fluid would otherwise have fired
// pharmacolite incorrectly during O2-spike events, even though all
// the As in that fluid is locked in As(III) sulfide complexes
// (thioarsenites).
//
// The principled fix (v92): split fluid.As dynamically into
// As(V) (arsenate, AsO₄³⁻) and As(III) (arsenite/arsenide,
// H₃AsO₃ or sulfide-complexed) fractions based on the fluid's redox
// state + sulfide loading. Arsenate engines consume As(V) ppm;
// arsenide/sulfarsenide engines consume As(III) ppm. The scenarios'
// fluid.As field remains as "total dissolved As" — what scenario
// authors actually know — and the helpers split it at engine read time.
//
// Geochemistry model:
//   1. SULFIDE GATE (hard suppression). When fluid.S > 50 ppm AND
//      fluid.O2 < 1.0, As stays as As(III) regardless of bulk Eh:
//      the thioarsenite complexes (H₂AsS, H₃AsS₃, etc.) are
//      thermodynamically stable across the entire Eh range of any
//      sulfide-rich fluid. Reference: Helz, Tossell, Charnock,
//      Pattrick, Vaughan, Garner (1995) "Oligomerization in As(III)
//      sulfide solutions: Theoretical constraints and spectroscopic
//      evidence." Geochim. Cosmochim. Acta 59:4591-4604.
//      Also: Stumm & Morgan (1996) Aquatic Chemistry 3rd ed., Ch. 8.
//   2. O2-DRIVEN OXIDATION (smooth ramp). With S < 50 (sulfide
//      depleted), As(V) fraction grows monotonically with O2 across
//      the supergene window. Linear ramp from 0 at O2=0.1 to 1 at
//      O2=1.5; constant 0 below 0.1 (hard anoxic floor) and constant
//      1 above 1.5 (hard oxic ceiling). The crossover at O2~0.5
//      matches the approximate boundary between sulfide-stable and
//      arsenate-stable conditions in supergene groundwater (Bowell
//      et al. 2014, "The Environmental Geochemistry of Arsenic,"
//      Reviews in Mineralogy and Geochemistry 79).
//
// Note on pH: real-world As(III)/As(V) crossover is also pH-dependent
// (H₃AsO₃ ⇌ H₂AsO₃⁻ at pK_a~9.2; H₃AsO₄ stepwise at 2.3/6.8/11.5).
// The simulator's coarse chemistry pool doesn't resolve this nuance;
// pH-dependence is captured implicitly by the per-engine pH gates
// (most arsenates have pH 5-7.5 windows that align with the dominant
// H₂AsO₄⁻ species).
//
// Returns fraction (0-1) of fluid.As sitting as As(V).
function arsenicOxidizedFraction(fluid: any): number {
  if (!fluid || typeof fluid.As !== 'number') return 0;
  const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
  const S = typeof fluid.S === 'number' ? fluid.S : 0;
  // Sulfide hard-suppression: thioarsenite stability locks As as
  // As(III) when sulfide is present at meaningful concentration AND
  // the fluid is not fully oxic. Sulphur Bank (S=400) stays As(III)
  // through O2 spikes to 0.4 during synproportionation; schneeberg's
  // late Cu+P phase (S consumed by sulfide-mineral precipitation,
  // O2 jumps to 1.5) crosses out of this regime.
  if (S > 50 && O2 < 1.0) return 0;
  // O2-driven oxidation ramp.
  if (O2 < 0.1) return 0;       // hard anoxic floor
  if (O2 >= 1.5) return 1;      // hard oxic ceiling
  return Math.min(1, Math.max(0, (O2 - 0.1) / 1.4));
}

// As(V) ppm available for arsenate + uranyl-arsenate engines.
// Replaces direct `fluid.As` reads in supersaturation_* methods for:
// adamite, annabergite, conichalcite, erythrite, mimetite, olivenite,
// pharmacolite, scorodite (all js/30-supersat-arsenate.ts) +
// the As-branch + As-component of uranyl P/As/V fork engines
// (torbernite, autunite, zeunerite, uranospinite, carnotite,
// tyuyamunite in js/38-supersat-phosphate.ts).
function arsenateAvailablePpm(fluid: any): number {
  if (!fluid || typeof fluid.As !== 'number') return 0;
  return fluid.As * arsenicOxidizedFraction(fluid);
}

// As(III) ppm available for arsenide + sulfarsenide + arsenic-sulfide
// + native_arsenic engines. Replaces direct `fluid.As` reads in
// supersaturation_* methods for: native_arsenic (js/36-supersat-
// native.ts) + arsenopyrite, cobaltite, nickeline, tennantite,
// realgar, orpiment (js/41-supersat-sulfide.ts).
function arseniteAvailablePpm(fluid: any): number {
  if (!fluid || typeof fluid.As !== 'number') return 0;
  return fluid.As * (1 - arsenicOxidizedFraction(fluid));
}

// ============================================================
// Phase 4b arsenate-class engine helpers
// ============================================================
// All six arsenates (adamite, annabergite, erythrite, mimetite,
// olivenite, scorodite) gate on oxidized arsenic — As(V) as
// AsO₄³⁻. v92 split: instead of just checking fluid.O2 ≥ threshold,
// engines now read arsenateAvailablePpm(fluid) directly, which combines
// the redox-state check + sulfide-suppression check into the As
// concentration value itself.
//
// The legacy arsenateRedoxAvailable / arsenateRedoxFactor helpers
// stay in the API for callers that want a fast O2-only check
// (e.g. coarse pre-gate before computing the full fraction), but the
// per-engine reads now use arsenateAvailablePpm.
// Same flag-OFF passthrough as sulfate / hydroxide.

function arsenateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function arsenateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// ============================================================
// Phase 4b carbonate-class engine helpers
// ============================================================
// Carbonates split between oxidized-side (Cu/Zn supergene carbonates:
// malachite, smithsonite, azurite, rosasite, aurichalcite) and
// reduced-side (siderite Fe(II), rhodochrosite Mn(II)). Calcite,
// dolomite, aragonite, cerussite have no fluid.O2 reference — they
// don't need migration.
//
// Phase 4c binding: oxidized-side carbonates will gate on Eh
// (Cu²⁺ / Zn²⁺ are stable across most of the oxic range, so the
// gate is mostly about ruling out anoxic conditions). Reduced-side
// carbonates will bind to redoxFraction(fluid, 'Fe') for siderite
// and (1 - redoxFraction(fluid, 'Mn')) shape for rhodochrosite.
// Until then, all four helpers passthrough to fluid.O2.

function carbonateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function carbonateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// Reduced-side gate (siderite, rhodochrosite hard cutoffs).
function carbonateRedoxAnoxic(fluid: any, o2UpperBound: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) <= o2UpperBound;
  }
  const EhEquivalent = ehFromO2(o2UpperBound);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh <= EhEquivalent;
}

// Reduced-side soft penalty: returns 1.0 if O2 ≤ startO2 (no
// penalty). Above startO2, returns max(floor, peakValueAtStart -
// slope × (O2 - startO2)). Two patterns in carbonate:
//   siderite:      startO2=0.3, peakValue=1.0, slope=1.5, floor=0.2
//                  (legacy: 1.0 - (O2 - 0.3) × 1.5)
//   rhodochrosite: startO2=0.8, peakValue=0.7, slope=1.0, floor=0.3
//                  (legacy: 1.5 - O2 — note the implicit step
//                  discontinuity at O2=0.8 from 1.0 to 0.7, preserved
//                  via peakValue=0.7)
function carbonateRedoxPenalty(
  fluid: any, startO2: number, peakValueAtStart: number, slope: number, floor: number,
): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    if (O2 <= startO2) return 1.0;
    return Math.max(floor, peakValueAtStart - slope * (O2 - startO2));
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  if (o2eq <= startO2) return 1.0;
  return Math.max(floor, peakValueAtStart - slope * (o2eq - startO2));
}

// ============================================================
// Phase 4b sulfide-class engine helpers
// ============================================================
// All 20 sulfide minerals gate on REDUCED conditions — sulfide minerals
// can't survive in oxic fluid (they oxidize to native sulfur, sulfate,
// or oxide minerals). The engine file has 34 fluid.O2 sites split
// across 4 shapes:
//
//   GATES (18 sites): `if (fluid.O2 > X) return 0` — replaced with
//     `if (!sulfideRedoxAnoxic(fluid, X)) return 0`.
//
//   LINEAR MULTIPLIERS (15 sites total, three patterns folded into
//     sulfideRedoxLinearFactor(fluid, intercept, slope=1, floor=-∞)):
//     • `(intercept - O2)` no-clamp (8 sites: pyrite, marcasite,
//       chalcopyrite, galena, molybdenite, arsenopyrite, tetrahedrite,
//       tennantite). Slope=1, floor=-∞.
//     • `max(floor, intercept - O2)` (4 sites: stibnite, bismuthinite,
//       bornite, chalcocite). Slope=1, floor finite.
//     • `max(floor, 1.0 - O2*slope)` (3 sites: nickeline, millerite,
//       cobaltite). Intercept=1, slope variable, floor finite.
//
//   TENT (1 site, covellite): `max(floor, peakValue - abs(O2 - peak) × slope)`.
//
// Phase 4c will bind the gate + linear helpers to `1 - redoxFraction(fluid, 'S')`
// against an Eh threshold consistent with sulfide stability.

function sulfideRedoxAnoxic(fluid: any, o2UpperBound: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) <= o2UpperBound;
  }
  const EhEquivalent = ehFromO2(o2UpperBound);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh <= EhEquivalent;
}

// Unified linear-multiplier helper. Three call patterns:
//   sulfideRedoxLinearFactor(f, 1.5)                 // no-clamp `1.5 - O2`
//   sulfideRedoxLinearFactor(f, 1.3, 1.0, 0.5)       // offset clamped at 0.5
//   sulfideRedoxLinearFactor(f, 1.0, 1.5, 0.4)       // slope variant: max(0.4, 1 - 1.5×O2)
function sulfideRedoxLinearFactor(
  fluid: any, intercept: number, slope: number = 1.0, floor: number = -Infinity,
): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.max(floor, intercept - slope * O2);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.max(floor, intercept - slope * o2eq);
}

// Tent multiplier (covellite-style):
// max(floor, peakValue - abs(O2 - peakO2) × slope)
function sulfideRedoxTent(
  fluid: any, peakO2: number, peakValue: number, slope: number, floor: number,
): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.max(floor, peakValue - Math.abs(O2 - peakO2) * slope);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.max(floor, peakValue - Math.abs(o2eq - peakO2) * slope);
}

// ============================================================
// Phase 4b molybdate / phosphate / silicate-class engine helpers
// ============================================================
// All three classes are oxidized-side throughout — molybdate (MoO4²⁻),
// phosphate (PO4³⁻ + secondary uranyl), silicate (chrysocolla Cu(II)).
// Same flag-OFF passthrough as sulfate. Phase 4c will bind each to
// an Eh threshold; no specific Nernst couple applies (these are
// non-redox-active anions whose minerals need "oxic enough" fluid
// for the cation to be in its mobile state).
//
// The textual repetition with sulfateRedox* / arsenateRedox* etc. is
// deliberate — keeping per-class helper names makes Phase 4c's tuning
// surface (one Eh threshold per class) explicit at the call site.

function molybdateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function molybdateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

function phosphateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function phosphateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

function silicateRedoxAvailable(fluid: any, o2Threshold: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) >= o2Threshold;
  }
  const EhEquivalent = ehFromO2(o2Threshold);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhEquivalent;
}

function silicateRedoxFactor(fluid: any, scaleAtFull: number, cap: number = Infinity): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.min(O2 / scaleAtFull, cap);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.min(o2eq / scaleAtFull, cap);
}

// ============================================================
// Phase 4b native-class engine helpers
// ============================================================
// Native elements (Te, S⁰, As, Ag, Bi, Cu) form under reducing
// conditions — their cations get reduced all the way to elementary
// state. native_sulfur is the exception: it forms in a narrow Eh
// transition zone (synproportionation of H₂S + SO₄²⁻ ⇌ S⁰), needing
// neither solidly oxic nor solidly anoxic. native_gold has no
// fluid.O2 dependence (Au is nobilized by complexation, not Eh).
//
// Same shapes as sulfide + oxide; named per-class so Phase 4c can
// tune independently.

function nativeRedoxAnoxic(fluid: any, o2UpperBound: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    return (typeof fluid.O2 === 'number' ? fluid.O2 : 0) <= o2UpperBound;
  }
  const EhEquivalent = ehFromO2(o2UpperBound);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh <= EhEquivalent;
}

function nativeRedoxLinearFactor(
  fluid: any, intercept: number, slope: number = 1.0, floor: number = -Infinity,
): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.max(floor, intercept - slope * O2);
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.max(floor, intercept - slope * o2eq);
}

// native_sulfur Eh window — neither solidly oxic nor solidly anoxic.
function nativeRedoxWindow(fluid: any, o2Low: number, o2High: number): boolean {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return O2 >= o2Low && O2 <= o2High;
  }
  const EhLow = ehFromO2(o2Low);
  const EhHigh = ehFromO2(o2High);
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  return Eh >= EhLow && Eh <= EhHigh;
}

// native_sulfur Eh-distance peak — peaks at peakO2, falls off
// linearly. Identical shape to oxide's tent + sulfide's tent but
// with peakValue=1.0 hardcoded (the legacy native_sulfur form).
function nativeRedoxTent(
  fluid: any, peakO2: number, slope: number, floor: number,
): number {
  if (!EH_DYNAMIC_ENABLED) {
    const O2 = typeof fluid.O2 === 'number' ? fluid.O2 : 0;
    return Math.max(floor, 1.0 - slope * Math.abs(O2 - peakO2));
  }
  const Eh = typeof fluid.Eh === 'number' ? fluid.Eh : 200;
  const o2eq = o2FromEh(Eh);
  return Math.max(floor, 1.0 - slope * Math.abs(o2eq - peakO2));
}
