# 01: Geochemical Grounding for Initiative Variable

**Date:** 2026-05-21
**Researcher:** 🪨✍️
**Sources:** Web search on nucleation kinetics, crystal growth theory, thermodynamics of dissolution

---

## Core Equations

### Nucleation Rate (Arrhenius Form)

**J = A · exp(-ΔG* / kT)**

- J = nucleation rate (nuclei per unit volume per unit time)
- A = pre-exponential factor (frequency of molecular encounters)
- ΔG* = Gibbs free energy of activation barrier
- k = Boltzmann constant
- T = absolute temperature

**Key insight:** Higher temperature → lower barrier → faster nucleation. But ΔG* itself depends on T through surface energy and solubility.

### Critical Supersaturation

For homogeneous nucleation from solution:

**ΔG* = (16πγ³V_m²) / (3(RT ln S)²)**

- γ = surface energy (mineral-specific)
- V_m = molar volume
- S = supersaturation ratio (C/C_sat)
- R = gas constant

**Key insight:** Lower γ → lower barrier → faster nucleation. This is why:
- Opal (amorphous, low γ) precipitates before quartz
- Gypsum precipitates before anhydrite
- Aragonite wins over calcite when Mg²⁺ poisons calcite surface

### Solubility Product Temperature Dependence

**ln(Ksp) = -ΔG° / RT = ΔS°/R - ΔH°/RT**

- ΔG° = standard Gibbs free energy of dissolution
- ΔH° = enthalpy of dissolution
- ΔS° = entropy of dissolution

**Key insight:** The sign of ΔH° determines whether solubility increases or decreases with temperature:
- **Negative ΔH°** (exothermic dissolution): inverse solubility — more soluble at low T
  - Example: calcite, most carbonates
- **Positive ΔH°** (endothermic dissolution): normal solubility — more soluble at high T
  - Example: quartz, most silicates
- **Near-zero ΔH°**: weak temperature dependence
  - Example: NaCl

### Growth Rate (BCF Theory)

**v = C · σ · tanh(λ_s / 2x_s)**

- v = step advancement rate
- C = kinetic coefficient
- σ = supersaturation
- λ_s = step spacing
- x_s = surface diffusion length

**Regimes:**
- **Low σ (λ_s >> 2x_s):** tanh → 1, v ≈ Cσ (linear, direct integration)
- **High σ (λ_s << 2x_s):** tanh → λ_s/2x_s, v ≈ Cσ² (quadratic, surface diffusion limited)

---

## Mineral-Specific Data

### Temperature Sweet-Spots (from Literature)

| Mineral | ΔH° (kJ/mol) | Solubility Trend | Optimal T (°C) | Initiative Modifier |
|---------|---------------|------------------|----------------|-------------------|
| Calcite | -10.5 | Inverse (more soluble cold) | 80–120 | +2 at high T |
| Aragonite | -8.5 | Inverse (slightly less than calcite) | 60–100 | +1 at moderate-high T |
| Quartz | +3.8 | Normal (more soluble hot) | 200–350 | +2 at high T (despite lower σ) |
| Barite | +20 | Normal | 100–200 | +1 at moderate T |
| Sphalerite | ~+15 | Normal | 150–250 | +1 at moderate-high T |
| Galena | +10 | Normal | 100–200 | +1 at moderate T |
| Gypsum | -1.7 | Weak inverse | 20–40 | +2 at low T |
| Anhydrite | +5 | Normal | 80–150 | +1 at moderate T |
| Opal | ~+2 | Normal (but amorphous = fast) | 20–60 | +2 at low T |
| Fluorite | +18 | Normal | 100–200 | +1 at moderate T |
| Apatite | +15 | Normal | 100–300 | +1 at moderate-high T |

*Note: ΔH° values are approximate and depend on pH, ionic strength, and competing ions. These are "order-of-magnitude" guidelines for initiative calibration, not thermodynamic precision.*

### Surface Energy γ (literature values, J/m²)

| Mineral | γ (approx) | Category | Initiative Modifier |
|---------|-----------|----------|-------------------|
| Opal | 0.05–0.1 | Very low | +2 |
| Gypsum | 0.1–0.2 | Low | +1 |
| Aragonite (in Mg-fluid) | 0.2–0.3 | Low | +1 |
| Calcite | 0.3–0.5 | Medium | 0 |
| Barite | 0.4–0.6 | Medium | 0 |
| Sphalerite | 0.5–0.8 | Medium-high | -1 |
| Quartz | 0.8–1.2 | High | -1 |
| Corundum | 1.5–2.0 | Very high | -2 |
| Diamond | 3.0–5.0 | Extreme | -3 |

*Note: Surface energy depends on face, fluid composition, and adsorbed species. These are basal-plane values in aqueous solution. In the sim, we'd use simplified categories rather than precise values.*

### Critical Supersaturation σ_crit (empirical estimates)

From nucleation induction time data:

| Mineral | σ_crit (typical) | Notes |
|---------|-----------------|-------|
| Calcite | 1.2–2.0 | Low barrier, fast nucleation |
| Aragonite | 1.5–2.5 | Slightly higher than calcite |
| Quartz | 2.0–3.0 | High barrier, very slow at low σ |
| Barite | 1.5–2.5 | Moderate barrier |
| Sphalerite | 1.8–3.0 | Higher in Fe-rich fluids |
| Gypsum | 1.0–1.5 | Very low barrier |
| Opal | 0.5–1.0 | Amorphous = no real barrier |
| Fluorite | 1.5–2.5 | Moderate barrier |

*Note: σ_crit is context-dependent (T, pH, impurities). In the sim, we'd calibrate these empirically against seed-42 baselines rather than using literature values directly.*

---

## Sources

1. **ScienceDirect — Nucleation Rate overview**
   - URL: https://www.sciencedirect.com/topics/engineering/nucleation-rate
   - Key finding: Nucleation rate follows Arrhenius form with activation barrier ΔG*

2. **McGill EPS C644 — Principles of Crystal Nucleation and Growth**
   - URL: https://eps.mcgill.ca/~courses/c644/Biomineralization%20(2011)/Growth_Apatite_Calcite/Principles%20Of%20Nucleation%20And%20Growth.pdf
   - Key finding: Induction time is a strong function of supersaturation; critical supersaturation concept

3. **Nature Communications Chemistry — CaCO₃ on quartz (2018)**
   - URL: https://www.nature.com/articles/s42004-018-0056-5
   - Key finding: Experimental determination of activation energy and pre-exponential factor for heterogeneous nucleation

4. **PNAS — Directed nucleation and growth (2018)**
   - URL: https://www.pnas.org/doi/10.1073/pnas.1712911115
   - Key finding: Nucleation barrier determined by interface chemistry and local supersaturation

5. **ACS Crystal Growth & Design — Supersaturation and Crystal Resilience**
   - URL: https://pubs.acs.org/doi/10.1021/acs.cgd.2c01459
   - Key finding: Growth-dominated vs nucleation-dominated regimes; deposition behavior changes with supersaturation

6. **Burton-Cabrera-Frank Theory (1951, 2016 review)**
   - URL: https://royalsocietypublishing.org/rsta/article/373/2039/20140230
   - Key finding: Step-flow and terrace kinetics; regime-dependent growth rate scaling

7. **UCLA Manning — Thermodynamic model for mineral solubility**
   - URL: http://www2.ess.ucla.edu/~manning/pdfs/dm10.pdf
   - Key finding: Ksp(T) relationships, ΔG°, ΔH°, ΔS° for common minerals

---

## Bottom Line

The geochemistry provides a solid foundation for initiative modifiers:
- Temperature effects are real and mineral-specific (inverse vs normal solubility)
- Surface energy differences are well-documented and predict nucleation order
- Critical supersaturation is a real threshold with sharp transitions
- Competition for shared cations is the mechanism behind cascade-prone scenarios

The sim doesn't need to model every detail — but the modifier system should capture the first-order effects that determine which mineral nucleates first.

— 🪨✍️
