# Broth-Ratio Branching Research — Malachite vs Azurite

**Pair:** Cu carbonates competing for Cu + CO₃ in supergene oxidation zones
**Purpose:** Determine whether the Round 9 broth-ratio mechanic should be retrofitted, and if so, what thresholds.
**Reference for retrofit pattern:** `vugg.py:supersaturation_rosasite` (Round 9a, commit `8ba1df8`).
**Verdict at the end:** **Existing implementation is sound — no broth-ratio retrofit needed. Documentation refresh only.**

---

## Identity

| Mineral | Formula | Cu/CO₃ ratio | Cu/(OH) ratio |
|---|---|---|---|
| **Malachite** | Cu₂(CO₃)(OH)₂ | 2:1 | 2:2 = 1.0 |
| **Azurite** | Cu₃(CO₃)₂(OH)₂ | 3:2 = 1.5 | 3:2 = 1.5 |

Azurite is more carbonate-rich per Cu atom — that's the entire physical basis for the competition. To stabilize azurite, the fluid needs more available carbonate (higher pCO₂ in solution equilibrium).

## Branching Condition

**Primary control: pCO₂ (carbonate activity).**

The classic thermodynamic study is **Vink 1986** (Mineralogical Magazine 50:43–47), which fixes the azurite/malachite univariant boundary at:

> log(pCO₂) ≈ −3.5 at 25°C

At pCO₂ above this (CO₂-charged groundwater, monsoon infiltration through limestone), azurite is stable. Below it (drying conditions, atmospheric pCO₂), malachite is stable. Azurite → malachite conversion is documented as a **paramorph replacement** that preserves the prismatic azurite habit while changing the green/blue color — the "altered azurite" of textbook collections.

**Secondary control: pH.** The pH range matters less for the malachite/azurite split than for whether either forms at all (both dissolve below ~5, both stable to ~9; tenorite competes above 9-10). Within the carbonate stability window, pCO₂ is dispositive.

**Temperature:** Both are low-T (<50°C optimal). Azurite's stability field shrinks at higher T (Vink); above 80°C neither is geologically common.

**Why this is NOT a Cu:Zn-style ratio competition:** The competing pair shares ONE element (Cu), not two. The "ratio" that matters here is between the carbonate species ([CO₃²⁻] / [Cu²⁺] effectively, but more cleanly captured as carbonate activity = pCO₂). The rosasite/aurichalcite pattern doesn't apply directly.

**Citations:**
- Vink, B.W. 1986. "Stability relations of malachite and azurite." *Mineralogical Magazine* 50:43–47.
- Symes, R.F. and Embrey, P.G. 1977. *Minerals of Cornwall and Devon*.
- Anthony, J.W. et al. 2003. *Handbook of Mineralogy* vol. V (Cu carbonates entries).

## Current Sim Implementation

`vugg.py:supersaturation_malachite` requires CO₃ ≥ 20.
`vugg.py:supersaturation_azurite` requires CO₃ ≥ 120.

The 6× gap between thresholds is the sim's encoding of Vink's pCO₂ boundary. Both also require Cu (≥5 / ≥20), O₂ (≥0.3 / ≥1.0), low T (<50°C decay).

**Paramorph mechanic:** `grow_azurite` in both runtimes flags the crystal for malachite conversion when CO₃ drops below the azurite threshold during the run. The Bisbee scenario's `event_bisbee_co2_drop` (step 225) drives this mid-scenario.

The Bisbee scenario explicitly cycles the system through **azurite peak (CO₃ +80) → pCO₂ drop (CO₃ −120) → silica seep (chrysocolla)** — three different groundwater regimes, three minerals, locked in sequence. This is the working version of the Vink mechanic.

## Decision: No Retrofit Needed

The existing implementation already encodes what the brief is asking for:
1. **CO₃ threshold split** matches Vink's pCO₂ boundary at sim scale.
2. **Paramorph conversion** captures the azurite → malachite replacement on drying.
3. **Bisbee scenario** explicitly exercises the cascade.

**What WOULD a retrofit look like?** A Cu:CO₃ ratio gate would be redundant with the existing CO₃ thresholds. A pH-based ratio would mis-model the system (pH is a secondary control, not the dispositive one). Switching to a hard-zero binary cut at a specific pCO₂ value (rather than the current soft thresholds) would hurt the existing Bisbee scenario, which depends on azurite forming first and then transitioning.

**Recommendation:**
- Keep current CO₃ thresholds (malachite ≥20, azurite ≥120).
- Update both supersat docstrings to cite Vink 1986 explicitly and explain the pCO₂ basis.
- File closed; no code change to gates.

**One small follow-up (optional):** the malachite docstring currently says "Acid penalty — malachite dissolves easily" but the implementation is `sigma -= 0.5*(4.5−pH)` which is a soft penalty, not a hard gate. That's fine; just note it explicitly in the docstring.
