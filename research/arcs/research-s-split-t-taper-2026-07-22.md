# Research — the S-split T-taper anchors + the S0 census reframe (2026-07-22)

Backing note for the fluid.S sulfate/sulfide split (`PROPOSAL-FLUID-S-SPLIT-2026-07-17.md`),
phase **S0**. Two products: (1) the literature-tightened T-taper anchors, and (2) what the
S0 census (`tools/sulfur-speciation-census.mjs`) measured when the derived partition was
swept against the real seed-42 nucleation fleet. Both land in the inert
`sulfurReducedFraction` block of `js/20c-chemistry-redox.ts`.

## 1. The T-taper anchors — 100/200 °C, one curve (not the draft's 150/250)

The proposal draft used **150 / 250 °C** with a split Ohmoto-upper / Machel-lower citation.
The literature supports **~100 / ~200 °C off a single curve** — the abiotic
SO₄²⁻↔H₂S exchange half-life vs T (Ohmoto & Lasaga 1982):

| anchor | draft | tightened | basis |
|---|---|---|---|
| upper → sharp equilibrium step | 250 °C | **~200 °C** | Ohmoto & Lasaga 1982 (GCA 46:1727, verified): chemical + isotopic equilibrium attained **<100 yr above ~200 °C** (half-life 3.4–8.2 **days** at 300 °C; extrapolates to ~10⁹ yr at ambient). |
| lower → widest disequilibrium | 150 °C | **~100 °C** | same curve: below ~100 °C the exchange half-life is ~10⁸–10⁹ yr — utterly frozen. |

**Reframe:** the disequilibrium width is governed by ONE mechanism (abiotic exchange), so
the taper is a single sigmoid anchored at 100 and 200 °C, not a splice of two papers.

**Machel 2001** (Sed. Geol. 140:143) is repurposed, not dropped: it is the *source*
justification for §4 — BSR (0–80 °C) + TSR (100–180 °C) between them generate sulfide
across the whole vug temperature range, so a brine genuinely inherits **both** pools
everywhere. It is not the equilibration control (that is Ohmoto–Lasaga).

**Corroboration for §4's inherited-disequilibrium physics:** the sulfur-isotope-exchange
literature independently finds that sulfate–sulfide *coprecipitation below ~350 °C requires
mixing of separate sulfide-rich and sulfate-rich solutions, not simple cooling of one
equilibrated fluid* (0012821X78901516) — exactly the two-inherited-pools story
barite+galena coexistence rests on.

**Hot-scenario check:** porphyry (400 °C) and schneeberg (450 °C) sit far above either upper
anchor — full equilibrium-step regime regardless, so the upper anchor gates no coexistence
scenario. The draft's parenthetical survives the tightening. What the lower anchor moving
150→100 °C *does* touch is the coexistence fleet (MVT barite T 90–150 °C), which is why §5-B's
"barite still saturates its s_f cap" estimate had to be re-measured, not inherited.

## 2. What the S0 census measured (and how it reshaped the plan)

The census re-invokes each species' real engine with `fluid.S` replaced by the
split-available ppm, at every recorded seed-42 nucleation event, and tests survival at the
**per-event actual position-derived nucleation bar** (the hardened test — bare-wall events
use sigma_crit×1.0; snowball seeds on sulfide hosts use their real paragenesis discount).

**Finding A — F_min is not the lever; wCold is.** Lost-coexistence counts are flat across
F_min (0.20→0.00) and move only with the frozen-regime sigmoid width wCold. A wide cold
sigmoid (≫ vug Eh span) flattens the partition toward the inherited-ratio limit
(~Eh-independent), which is what §4 demands. So `SULFUR_W_COLD` carries the model;
`SULFUR_F_MIN` (0.10) is a non-binding residual clamp. This is the measured answer to open
question §9.1: **F_min ≈ 0.10 residual; the load-bearing parameter is wCold ≈ 250 mV.**

**Finding B — §5-B's mechanism was wrong, its conclusion mostly survives.** Barite does NOT
survive by "s_f cap saturation" — measured barite SO₄ availability is 15–70 ppm (s_f 0.4–1.75),
not cap-saturated. It survives (where it does) via the wide cold sigmoid + substrate epitaxy.

**Finding C — wCold ≈ 250 mV is the binding choice.** It is the minimum width that preserves
both `barite@mvt` (needs ≥150) AND `barite@elmwood` (needs ≥250) at their real bars.

**Finding D — two §8-protected coexistences are NOT preservable by pure (Eh,T,S) derivation
at ANY wCold: `barite@wittichen` and `selenite@elmwood`.** Both nucleate bare-wall
(discount 1.00) in reducing fluid, so no substrate epitaxy rescues their SO₄, and the
Eh-derived sulfate fraction is too low at their nucleation windows. The uniform-0.7 first
pass masked this; the hardened per-event test surfaced it. **These are the pre-registered S1
casualties.** S1 (the live split-sim, first baseline-moving commit) must either confirm they
recover at another step or grant them a carve-out (proposal §6/§8). The census's per-event
table is the pre-registration of record.

**Instrument caveats (honest):** the census is a static post-hoc test on *pre-split*
operating points — it cannot run the counterfactual split-sim, so "lost" means "this
nucleation window would be suppressed," not "never forms." Only S1 confirms recovery. The
recompute swaps fluid.S + temperature from the snapshot and reuses the run's final
conditions object for any non-fluid scalar; sulfate/sulfide engines are fluid+T functions,
so this is exact for them (verified: FluidChemistry O2/Eh are own fields; effectiveTemperature
is a live getter on this.temperature).

## 3. Residual S1 watch-list (hardened, F_min 0.10, wCold 250)

24 (species,scenario) groups flagged at-risk — the two protected ones above, plus secondary
celestine/barite in `reactive_wall` and `reactivated_fluorite_vein`, and scattered sulfides
(pyrite@mvt/elmwood, galena@elmwood, orpiment/realgar/proustite@…). Full table in the census
output. None besides the two named are in the §8 protected set. S1 clears these one class at
a time, each with its own blast check.

## Refs
Ohmoto & Lasaga 1982 GCA 46:1727 (exchange kinetics — load-bearing, verified); Machel 2001
Sed. Geol. 140:143 (BSR/TSR source regimes); the sulfate–sulfide mixing-not-cooling result
(0012821X78901516); the v92 As split (`js/20c-chemistry-redox.ts:415`) as the derivation
template.

*S0 research note, twenty-fourth hand, 2026-07-22.*
