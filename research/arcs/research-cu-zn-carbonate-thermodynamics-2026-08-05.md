# Rosasite and aurichalcite thermodynamic closure

**Date:** 2026-08-05
**Decision:** replace the false “no published thermodynamic data” claim with composition-labelled Tier-C observations; do not promote either empirical nucleation engine.

## Player/model question

The Creative-mode formation inspector should be able to distinguish:

- the simulator's empirical nucleation score, which currently determines whether rosasite or aurichalcite forms; and
- a literature-based saturation observation, which is useful evidence but is not yet a defensible solid-solution engine.

The previous database classified both minerals as Tier D and stated that no direct thermodynamic data had been published. That statement is incorrect.

## Primary evidence

1. Alwan, Thomas & Williams (1980), *Mineral Formation from Aqueous Solution. Part III. The Stability of Aurichalcite … and Rosasite …*, **Transition Metal Chemistry 5**, 3–5. DOI: https://doi.org/10.1007/BF01396855
   - 25°C rosasite Ksp = 3.98 × 10^-37 (log Ksp = -36.400).
   - 25°C aurichalcite Ksp = 7.94 × 10^-91 (log Ksp = -90.100) for a specific natural composition.
   - sample-specific reported ΔGf values are about -1100 kJ/mol for rosasite and -2766 kJ/mol for aurichalcite.

2. Kaluza et al. (2024), *Fast Method to Determine Solubility Products of Sparingly Soluble Salts …*, **Industrial & Engineering Chemistry Research 63**, 14333–14351. DOI: https://doi.org/10.1021/acs.iecr.4c01616 ; open repository copy: https://publikationen.bibliothek.kit.edu/1000173552/154374629
   - reproduces the 1980 25°C literature values in Table 1;
   - fits synthetic Zn2.9Cu2.1 aurichalcite at log Ksp -76.16, -79.05, and -82.19 at 25, 45, and 65°C respectively;
   - explicitly demonstrates that the fitted aurichalcite Ksp depends strongly on phase composition, aqueous speciation/activity assumptions, and selected boundary-phase constants;
   - reports that an alternative boundary condition changes the 65°C fit to -89.05;
   - warns that quantitative phase fractions are difficult to resolve where aurichalcite and hydrozincite have similar lattices.

## Scientific interpretation

The 25°C aurichalcite values differ by roughly fourteen orders of magnitude. That is not a rounding disagreement: the samples have different Cu:Zn ratios and the 2024 values are inverse-model results for synthetic catalyst precursors. A single universal aurichalcite Ksp would therefore be false precision.

Rosasite is less conflicted: the 2024 literature review associates the same 3.98 × 10^-37 value with two nearby reported compositions. Even there, a variable-composition phase still needs a solid-solution activity model before its SI can control nucleation.

## Implemented model boundary

- `data/thermo-carbonates.json` now carries the measured values, sample compositions, sources, conflict, and Tier-C confidence.
- The observer SI uses the same activity/speciation helpers as the existing carbonate engine:
  - rosasite proxy: Cu1.3Zn0.7(CO3)(OH)2 and log Ksp -36.400;
  - aurichalcite proxy: synthetic Zn2.9Cu2.1(CO3)2(OH)6 and log Ksp -76.16.
- The hover panel labels these as Tier-C observers and states when 25°C data are being extrapolated.
- `CARBONATE_KSP_ACTIVE_PER_MINERAL` remains off/absent for both minerals. The existing empirical Cu:Zn, temperature, pH, redox, and reagent gates remain authoritative for gameplay.

## Future promotion gate

Do not promote either phase until all of the following exist:

1. a selected and cited solid-solution model with an explicit composition variable;
2. calibration/validation across at least two independent natural or experimental systems;
3. a brine-capable activity model or a clearly bounded dilute-solution applicability domain;
4. sensitivity tests spanning the published aurichalcite Ksp conflict;
5. scenario impact census, mass-balance tests, new baselines, and a model-version migration note.

This is a science-first closure: the data gap is fixed, while the remaining model uncertainty is made visible rather than hidden inside a universal constant.
