# RESEARCH — how vug fluid chemistry evolves over a cavity's life

**Date:** 2026-06-01. **Method:** deep-research pass (5 search angles → 25
sources fetched → 100 claims → 25 adversarially verified by 3-vote → 23
confirmed, 2 killed). Feeds `PROPOSAL-EVENTS-AS-GEOLOGICAL-MOVEMENTS.md`.

**Citation discipline:** the citations below come from the research pass's
own 3-vote verification, NOT from my independent reading of each source.
Treat them as *research-grade*, not *project-canonical*. Before ANY of these
lands in code or a data file (`thermo-*.json`, `minerals.json`, a commit
message asserting a fact), it gets the project's normal citation-verification
treatment — open the source, confirm author/year/venue/number. This is a
discussion artifact; the v145 fabricated-citation incident is why this
paragraph exists.

---

## TL;DR — the core design is right; the research corrected me twice

**Confirmed (high confidence):** mineralizing fluid chemistry IS driven by a
small set of master variables (T, pH, redox), and dissolved elements **covary
off those shared drivers rather than varying independently.** Boiling
co-precipitates Au-Ag-Cu-Pb-Zn together and vertically zones them; redox is a
first-order control that minerals literally record. → The simulator design of
"move a few master variables, let the saturation engines produce *correlated*
element pulses" is the geologically faithful one. Unfreezing **redox** is the
single highest-value change.

**Correction #1 — my "red noise / persistent movement" model is contradicted
at fine scale.** The one directly-measured natural dataset (Holten et al.
1997) found oscillatory-zoning increments are non-periodic, non-chaotic, and
**ANTI-persistent (Hurst ≈ 0.25–0.45, H<0.5) — i.e. mean-reverting, they tend
to REVERSE, not continue.** That's the opposite of a persistent random walk.
The Hasselmann-1976 red-noise framing I leaned on was **not supported by any
source** for geochemistry — it's a climate-science result I imported by
analogy. The better model (below): a slowly-moving *setpoint* (the movement) +
*mean-reverting* texture around it, NOT a biased random walk.

**Correction #2 — my iron mechanism was the wrong regime.** I told the boss Fe
banding is Fe²⁺-soluble / Fe³⁺-insoluble in-fluid oxidation. In *hydrothermal*
fluids that's refuted (0-3): dissolved Fe is dominantly **ferrous** across
conditions (Scholten et al. 2019), transported as **chloride complexes**, and
banding is better modeled as **pH / salinity / redox-buffer SOLUBILITY
cycling**, not in-fluid ferric/ferrous oxidation. The oxidation-to-ferric-oxide
story IS correct — but for the *supergene/surface* regime (weathering, the
iron-stained specimens), not the deep hydrothermal one. Mechanism is
regime-dependent.

---

## Findings (by question)

### Q1 — Master variables & drivers ✅ (high)
- **Boiling** (CO₂/H₂S loss → pH rise + pressure drop) is a primary trigger
  for high-grade precipitation and **co-precipitates a metal suite + zones it
  vertically** (shallow Au-Ag bonanza over deeper Pb-Zn). Mechanism: CO₂
  exsolution → pH rise → metal-chloride complexes destabilize; H₂S loss drives
  Au. *Drummond & Ohmoto 1985, Econ. Geol. 80:126-147, doi:10.2113/gsecongeo.80.1.126;
  Aruga & Imai 2024, Geochemistry 84(4); Cao et al. 2022, J. Geochem. Explor.
  240:107048; Camprubí & Albinson (Taxco).*
- **Different zones of one system can be driven by different mechanisms**:
  shallow breccias by boiling, deeper carbonate-replacement bodies by mixing /
  fluid-rock reaction (no boiling). *Cao et al. 2022.* → a scenario may
  legitimately use different drivers in different regions.
- **Redox (fO₂-fS₂) is a key control** on element concentrations and is
  computable from dissolved H₂/H₂S and recorded by sulfide assemblages.
  *Kawasumi & Chiba 2017, Chem. Geol. 451:25-37.* (Scope: seafloor/VMS;
  principle generalizes, the H₂/H₂S numbers don't.)

### Q2 — Volatile vs conservative & covariance ✅ (high), with the Fe correction
- **Covariance confirmed.** Sphalerite FeS content is a direct recorder of
  fluid fS₂/sulfidation state → Fe in the mineral tracks the fluid's redox.
  *Barton & Toulmin 1966; Czamanske 1974, Econ. Geol. 69(8):1328; Einaudi,
  Hedenquist & Inan 2003.*
- **Fe-Mn are redox-coupled via a redox ladder** (MnO₂/Mn²⁺ ≈ +1.23 V >
  Fe³⁺/Fe²⁺ ≈ +0.77 V): Mn oxides oxidize dissolved Fe(II); a single redox
  shift mobilizes one while immobilizing the other, often with a **lead/lag**
  (classic Mn-then-Fe diagenetic sequence). *Liu/Hochella et al. 2022,
  Earth-Sci. Rev. 232:104105; Sung & Morgan 1981, GCA 45:2377; Stumm & Morgan.*
  **Scope caveat: this source is diagenetic/near-surface, NOT hydrothermal.**
  Lead/lag covariation still matches "correlated, not independent."
- **Iron mobility tracks Cl/salinity + redox-buffer + pH** (FMQ buffer → higher
  Fe solubility than reduced sulfide buffer; highest oxide solubility in HCl).
  *Scholten et al. 2019, GCA 252:126.* **The sister claim that Fe banding is
  driven by in-fluid Fe²⁺/Fe³⁺ oxidation was REFUTED 0-3** — Fe is dominantly
  ferrous in hydrothermal fluids. → model Fe as solubility cycling.

### Q3 — Zoning origin ✅ both real, balance contested
- **Externally-forced (real fluid change):** Nayongzhi MVT sphalerite — Fe
  color bands (brown Fe-rich cores: Mn,Co,Ge,Tl,Pb; pale zones: Ga,Cd,Sn,In,Sb)
  from **episodic ore-fluid influxes mixing with a reduced-S aquifer fluid**;
  intracrystalline δ³⁴S varies up to 4.3‰. A clean external-forcing example
  with **element groups that covary** — exactly the intended sim behavior.
  *Wei et al. 2021, Mineral. Mag. 85(3):364-378, doi:10.1180/mgm.2021.41.*
- **Intrinsic self-organization (constant fluid still bands):** lab calcite
  from a CONSTANT solution produced >10-fold REE oscillation over <1 mm,
  growth-rate-controlled, NOT a fluid change. *Barker & Cox 2011, Geofluids
  11(1):48-56.* Deterministic nonlinear diffusion-partition models self-organize
  oscillations isothermally. *L'Heureux & Fowler 1996, GRL 23(1):17-20;
  Wang & Merino 1992.*
- **Balance (medium):** the one well-studied natural dataset says open
  hydrothermal systems are **predominantly externally forced** (large-scale
  processes dominate; diffusion-smoothing below detection); closed systems
  (agate) more likely internal. *Holten et al. 1997, Am. Min. 82:596-606.* This
  is one side of a **genuinely live debate** (Ortoleva / Wang & Merino /
  L'Heureux self-organization camp still active). Heuristic, not settled.

### Q4 — Fluid-inclusion time series ⚠️ (partial)
Partial trajectories only: Taxco boiling onset at paleo-depth ~360 m coinciding
with the base-metal/Ag boundary; Nayongzhi δ³⁴S + trace-element groups across
growth zones. **No verified claim delivered a full sequential T–salinity–element
time series with stated swing magnitudes** for a named system (Creede, Alpine
cleft quartz). Magnitudes of T/salinity swings within single crystals remain
under-quantified here — a gap.

### Q5 — Open vs closed ⚠️ (medium, inferential)
Direction is supported: **open vug flushed by fluid → composition set by an
evolving external source (external forcing dominates)**; **sealed geode →
closed system, depletion + intrinsic self-organization dominate.** Open-system
external forcing is the better-attested regime for hydrothermal cavities. But
no measured Rayleigh-fractionation/depletion magnitudes for a sealed geode were
found — synthesized, not directly quoted.

### Q6 — Statistical character ❗ (refines/refutes my hypothesis)
- Measured natural zoning is **non-periodic, non-chaotic, stochastic-fractal**
  (3-0). *Holten et al. 1997.*
- **Anti-persistent (H ≈ 0.25–0.45)** — increments mean-revert (the sub-claim
  was 1-2, contested on generalization, but the Hurst result is real in the
  paper). → **fine-scale zoning is mean-reverting, NOT persistent red noise.**
- **Hasselmann 1976 / AR(1) red-noise applicability to geochemistry: NOT
  verified by any source (flagged low/unconfirmed).** The Hasselmann paper is
  real, famous *climate* science (Tellus, doi:10.1111/j.2153-3490.1976.tb00696.x);
  its transfer to vug-scale geochemistry is my untested analogy.
- **Important scale distinction (the saving grace):** Holten's anti-persistence
  is for **fine interface-controlled texture**, not necessarily the **coarse
  master-variable trajectory (T, redox) over the cavity's life**, where slow
  secular trends (cooling) plausibly still dominate. Two different scales, two
  different statistics.

---

## The refined model (supersedes §6c of the proposal)

Driven by the findings, the faithful model is **"moving setpoint + mean-reverting
texture," not "biased random walk":**

1. **A few master variables**: T, pH, redox (Eh/fO₂ — currently FROZEN at 200,
   the #1 fix), salinity/Cl, fluid-flux/mixing state.
2. **Each has a slowly-moving SETPOINT** — the "movement." Driven by (a)
   scenario events (a cooling event lowers the T setpoint over a window; a
   mixing event shifts the redox + metal-source setpoints) and (b) optional
   autonomous secular drift (gradual cooling / gradual oxidation toward the
   surface). The setpoint drift is where the boss's "long slow movement" lives,
   and persistent/monotonic drift is defensible **for this coarse trajectory.**
3. **The actual value mean-reverts toward the moving setpoint** (Ornstein-
   Uhlenbeck with a time-varying mean) — fine texture that REVERSES, honoring
   Holten's measured anti-persistence, NOT a walk that wanders off. This is the
   key correction from the research.
4. **Element concentrations are NOT independently randomized** — they're
   computed from the master variables through the existing solubility/SI engines
   + chloride-complex/redox-buffer relations. Fe/Mn/Cu/Zn/Pb pulse *because*
   redox/pH/salinity/T moved, and they covary (allow lead/lag, e.g. Mn-then-Fe).
   Conservative ions (Na, Cl, K) drift slowly/monotonically.
5. **Iron = solubility cycling** (pH/salinity/T/redox-buffer), NOT in-fluid
   Fe²⁺/Fe³⁺ oxidation — EXCEPT in explicitly supergene/surface scenarios
   (bisbee, supergene_oxidation) where oxidation to ferric oxides IS the
   mechanism.
6. **Distinguish coarse stage-banding (external — model this) from fine
   oscillatory texture (often intrinsic self-organization).** The sim could
   later add an optional interface-level self-organization mechanic for fine
   texture; that's a separate, lower-priority lane and explicitly contested
   science.

## Biggest remaining gap → the "how fast" question
**Timescales were NOT quantified by any verified source** — no measured cooling
rates, band durations, or pH-swing rates. For a GAME this is partly liberating:
real vugs form over 10³–10⁶ yr but the sim runs ~100–260 steps, so **"how fast"
is an aesthetic/gameplay calibration** (tuned to band-count + visual/sonic
readability), informed by — not bound to — geology. The science nails
DIRECTION and CORRELATION (well-constrained); RATE is a free parameter we own.

## Scope caveats to carry forward
- Strongest measured evidence is from epithermal ore + MVT systems — the right
  analogue for **vein vugs**, weaker for miarolitic cavities / agate geodes.
- Fe-Mn coupling source is diagenetic; redox H₂/H₂S window is seafloor — cite
  for principle, not for hydrothermal numbers.
- The external-vs-self-organization balance is an open research debate
  (active 2024-2025 work) — treat open→external / closed→intrinsic as a
  heuristic, not a closed question.
