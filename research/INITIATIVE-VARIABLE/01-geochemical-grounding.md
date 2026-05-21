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

**v = C · σ · tanh(σ_1 / σ)** (canonical BCF form)

- v = step advancement rate
- C = kinetic coefficient
- σ = supersaturation
- σ_1 = characteristic supersaturation (∝ x_s/d, where x_s = surface diffusion length, d = step spacing scale)

**Regimes (textbook convention; De Yoreo & Vekilov 2003, *Reviews in Mineralogy & Geochemistry* vol 54):**
- **Very low σ (σ << σ_1):** tanh(σ_1/σ) → 1, but spiral-step density ∝ σ, so **v ∝ σ²** (parabolic, screw-dislocation regime)
- **High σ (σ >> σ_1):** tanh(σ_1/σ) → σ_1/σ, surface roughens, **v ∝ σ** (linear, direct integration / 2D nucleation regime)

**CORRECTION 2026-05-21:** Earlier version of this doc had the regimes inverted. The textbook convention is **parabolic at low σ, linear at high σ** — the inverse of the naive `tanh` reading. The σ-dependence of step density (more dislocations active at higher σ) is the multiplier that gives σ² at low σ; at high σ, every kink site is saturated and surface roughening dominates, giving linear scaling.

---

## Mineral-Specific Data

### Temperature Sweet-Spots (from Literature)

| Mineral | ΔH° (kJ/mol) | Solubility Trend | Optimal T (°C) | Initiative Modifier | Source |
|---------|---------------|------------------|----------------|-------------------|--------|
| Calcite | −12.5 | Inverse (more soluble cold) | 80–120 | +2 at high T | Plummer & Busenberg 1982 |
| Aragonite | −10.5 | Inverse (slightly less than calcite) | 60–100 | +1 at moderate-high T | Plummer & Busenberg 1982 |
| **Quartz** | **+22** | Normal (more soluble hot) | 200–350 | +2 at high T (and ΔG* drops sharply with T) | Rimstidt & Barnes 1980 (GCA 44:1683) |
| Barite | +26 | Normal | 100–200 | +1 at moderate T | Blount 1977 |
| Sphalerite | ~+15 to +30 | Normal (varies with Fe content) | 150–250 | +1 at moderate-high T | Anderson 1962 |
| Galena | +18 to +30 | Normal | 100–200 | +1 at moderate T | Anderson 1962 |
| Gypsum | +1 (low T) → −2 (>40°C) | Crosses zero near 40°C | 20–40 | +2 at low T | Marshall & Slusher 1966 |
| Anhydrite | +5 to +10 | Normal (with retrograde >100°C in NaCl brines) | 80–200 | +1 at moderate T | Blount & Dickson 1973 |
| **Opal (amorphous SiO₂)** | **+14** | Normal | 20–60 | +2 at low T (amorphous γ very low, low σ_crit dominates) | Iler 1979 |
| Fluorite | +13 to +15 | Normal | 100–200 | +1 at moderate T | Bond & Pfeiffer 1981 |
| Apatite | +15 to +20 | Normal | 100–300 | +1 at moderate-high T | various; Valyashko 2002 |

*Note: ΔH° values are dissolution enthalpies at ~25°C, 1 bar, from cited sources. They depend on pH, ionic strength, and competing ions — these are "best-mid-range" estimates for initiative calibration, not thermodynamic precision.*

**CORRECTIONS 2026-05-21:** Earlier version of this doc had quartz at +3.8 kJ/mol (off by ~6×) and opal at +2 kJ/mol (off by ~7×). The literature values from Rimstidt & Barnes 1980 and Iler 1979 are above. These corrections matter: they predict quartz to be strongly T-dependent (which it is — quartz kinetics slow dramatically below 200°C, well-known from sinter / quartz-cement diagenesis) and opal to also be moderately T-dependent (also correct — opal-A → opal-CT → quartz transitions happen with burial heating).

### Surface Energy γ (literature values)

**⚠️ Read the units carefully.** The relevant γ for nucleation **from solution** is the **solid–liquid interfacial energy γ_sl**, NOT the solid–vapor surface energy γ_sv. The two differ by 2–5× and are easy to confuse in the literature. ΔG* uses γ_sl.

**γ_sl values (solid–liquid in water, the right ones for the sim):**

| Mineral | γ_sl (J/m²) | Category | Initiative Modifier | Source |
|---------|-------------|----------|-------------------|--------|
| Opal (amorphous SiO₂) | 0.05–0.10 | very_low | +2 | Iler 1979 |
| Gypsum | 0.04–0.09 | low | +1 | Christoffersen & Christoffersen 1976 |
| Aragonite (Mg-poisoned) | 0.08–0.12 | low | +1 | Berner 1975 |
| Calcite | 0.09–0.12 | medium | 0 | Söhnel & Mullin 1982 |
| Barite | 0.12–0.18 | medium | 0 | He et al. 1995 |
| Sphalerite | 0.15–0.25 | medium-high | −1 | Karthikeyan et al. 2002 (est.) |
| Quartz | 0.35–0.50 | high | −1 | Brace & Walsh 1962; Parks 1984 |
| Corundum | 0.60–0.90 | very_high | −2 | various; estimated for α-Al₂O₃ in water |
| Diamond | >1.0 (in water; not relevant — never grows from solution in vug) | extreme | n/a | not applicable |

**γ_sv values (solid–vapor, NOT used for nucleation from solution — listed only for cross-reference because earlier draft confused them):**

| Mineral | γ_sv (J/m²) |
|---------|-------------|
| Calcite | 0.3–0.5 |
| Barite | 0.4–0.6 |
| Quartz | 0.8–1.2 |
| Corundum | 1.5–2.0 |

**CORRECTION 2026-05-21:** Earlier version of this doc listed γ_sv values as if they were γ_sl. The category ordering (opal < gypsum < calcite < barite < quartz < corundum) is unchanged — the categorical modifier still works. But the absolute scale for the proposal's `criticalSupersaturation` derivation should use γ_sl, which is typically 2–5× smaller than what was listed.

### Critical Supersaturation σ_crit (empirical estimates)

**⚠️ Homogeneous vs heterogeneous nucleation distinction matters here.**
- **Homogeneous nucleation** (new crystal forms in bulk fluid with no surface help): σ_crit is high — driven by full ΔG* barrier
- **Heterogeneous nucleation** (new crystal forms on existing substrate — wall, prior crystal, particulate): σ_crit is much lower because the substrate lowers the effective γ. In a vug, virtually all nucleation is heterogeneous (vug wall, prior generations).

Literature values vary 2–10× depending on which regime is being measured.

| Mineral | σ_crit (homogeneous, bulk) | σ_crit (heterogeneous, vug-relevant) | Source |
|---------|---------------------------|-------------------------------------|--------|
| Calcite | 3–10 | 1.2–2.0 | Lin & Singer 2005 (het); Stack & Grantham 2010 |
| Aragonite | 4–12 | 1.5–2.5 | Berner 1975 |
| **Quartz** | **6–20+** | **2.0–4.0** | Rimstidt & Barnes 1980; Williams 1985; Brantley 2008 |
| Barite | 2–4 | 1.5–2.5 | Nielsen 1964 |
| Sphalerite | 4–8 | 1.8–3.0 | Karthikeyan 2002 (higher in Fe-rich fluids) |
| Gypsum | 1.5–3 | 1.0–1.5 | Lancia et al. 1999 |
| Opal (amorphous) | 1.5–2.5 | 0.5–1.0 | Iler 1979; Williams 1985 |
| Fluorite | 3–6 | 1.5–2.5 | Hamza & Hamdona 1991 |

**The sim's σ_crit values should be heterogeneous-regime numbers** because vug nucleation is essentially always heterogeneous (wall, prior crystals, particulates). The "vug-relevant" column is what gets loaded into the modifier system.

**CORRECTION 2026-05-21:** Earlier version listed quartz at 2.0–3.0 without distinguishing regime. That's right for heterogeneous nucleation on existing quartz; for homogeneous it would be much higher. Calibration target: extract σ_crit from each engine's first-gate threshold (which the engines have already calibrated against the heterogeneous-from-substrate behavior of vug growth).

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

8. **Rimstidt & Barnes 1980 — The kinetics of silica–water reactions** (Geochim. Cosmochim. Acta 44:1683)
   - Key finding: Quartz dissolution ΔH° ≈ +22 kJ/mol (corrects earlier ~+4 estimate)

9. **Iler 1979 — The Chemistry of Silica**
   - Key finding: Amorphous silica γ_sl ≈ 0.05-0.10 J/m², ΔH° ≈ +14 kJ/mol, σ_crit (het) ≈ 0.5-1.0

10. **De Yoreo & Vekilov 2003 — Principles of Crystal Nucleation and Growth** (Reviews in Mineralogy & Geochemistry vol 54)
    - Key finding: Canonical BCF regimes — parabolic at low σ (spiral growth), linear at high σ (rough surface)

11. **Söhnel & Mullin 1982 — Interpretation of crystallization induction periods** (J. Colloid Interface Sci. 89:152)
    - Key finding: Calcite γ_sl ≈ 0.094 J/m² in water (the solid-liquid value, distinct from γ_sv)

12. **Plummer & Busenberg 1982 — The solubilities of calcite, aragonite and vaterite** (Geochim. Cosmochim. Acta 46:1011)
    - Key finding: Calcite ΔH° = −12.5 kJ/mol, aragonite ΔH° = −10.5 kJ/mol

13. **Brantley et al. 2008 — Kinetics of Water-Rock Interaction**
    - Key finding: Quartz homogeneous σ_crit ≥ 6 at 25°C from solution; heterogeneous on existing quartz much lower

14. **Williams 1985 — Silica geochemistry: amorphous vs crystalline regimes**
    - Key finding: σ_crit hierarchy opal < chalcedony < quartz mirrors γ_sl hierarchy

---

## Bottom Line

The geochemistry provides a solid foundation for initiative modifiers:
- Temperature effects are real and mineral-specific (inverse vs normal solubility)
- Surface energy differences are well-documented and predict nucleation order
- Critical supersaturation is a real threshold with sharp transitions
- Competition for shared cations is the mechanism behind cascade-prone scenarios

The sim doesn't need to model every detail — but the modifier system should capture the first-order effects that determine which mineral nucleates first.

— 🪨✍️
