# TASK-BRIEF-RETROFIT-BROTH-RATIO.md — Retrofit Broth-Ratio Branching to Existing Minerals

**Status:** Backlog — pending research
**Priority:** After Round 9 complete + architecture refactoring
**Depends on:** Round 9 broth-ratio branching implementation (reference code)

---

## What

Several existing mineral pairs compete for the same elements in real mineralogy but currently nucleate independently in the simulator. The broth-ratio branching mechanic introduced in Round 9 (rosasite/aurichalcite) should be retrofitted to these pairs so that fluid chemistry determines which species forms.

---

## Candidate Pairs (RESEARCH NEEDED)

Each pair needs a dedicated research pass to determine the actual branching conditions. The lists below are preliminary — the builder should NOT implement until research confirms the specific ratios/thresholds.

### 1. Malachite vs Azurite (HIGH priority)
- **Both:** Cu carbonates — malachite Cu₂CO₃(OH)₂, azurite Cu₃(CO₃)₂(OH)₂
- **Likely branching condition:** CO₂ partial pressure and/or pH. Azurite forms at higher CO₂ / slightly acidic conditions; malachite at lower CO₂ / neutral-alkaline
- **Why it matters:** This is the textbook example of mineral competition. Every mineralogy student learns it. Currently both just need Cu + carbonate present
- **Research needed:** confirm exact pH/pCO₂ thresholds from literature

### 2. Adamite vs Olivenite
- **Both:** Cu-Zn arsenates — adamite Zn₂(AsO₄)(OH), olivenite Cu₂(AsO₄)(OH)
- **Likely branching condition:** Cu:Zn ratio (same as rosasite/aurichalcite). Olivenite when Cu>Zn, adamite when Zn>Cu
- **Research needed:** confirm whether other factors (pH, temperature) also matter or if it's purely ratio-driven

### 3. Descloizite vs Mottramite
- **Both:** Pb-vanadates — descloizite PbZn(VO₄)(OH), mottramite PbCu(VO₄)(OH)
- **Likely branching condition:** Zn vs Cu availability. Descloizite when Zn>Cu, mottramite when Cu>Zn
- **Research needed:** confirm branching threshold and whether complete solid solution exists (some sources say yes, with intermediate compositions)

### 4. Wurtzite vs Sphalerite
- **Both:** ZnS polymorphs — wurtzite (hexagonal, high-T), sphalerite (cubic, low-T)
- **Likely branching condition:** Temperature. Wurtzite is the high-temperature polymorph (>1020°C at atmospheric, but can be kinetically stabilized much lower)
- **Complication:** Pure temperature branching might be too simple — wurtzite can form metastably at low T in certain conditions. May need a probabilistic transition rather than hard threshold
- **Research needed:** viable temperature threshold for simulator purposes, metastability handling

---

## Implementation Notes

- **Reference implementation:** Round 9's rosasite/aurichalcite broth-ratio branching code
- **Each retrofit is a separate commit** — don't batch these
- **Retroactive scenarios:** existing scenarios that produce both minerals may need their initial fluids adjusted so the branching is exercised
- **Baseline tests:** each retrofit needs a test showing that adjusting the ratio flips which mineral nucleates
- **SIM_VERSION bump:** each retrofit bumps the sim version and archives the old baseline

---

## Research Deliverables

For each pair, the research should produce:
1. Confirmed branching condition (ratio? temperature? pH? combination?)
2. Specific threshold value(s) with literature citation
3. Whether intermediate/solid-solution compositions exist
4. Any complications (metastability, kinetic factors, ordering)
5. A `memory/research-<topic>.md` file documenting findings

---

*Do not implement until research for each pair is complete and reviewed.*
