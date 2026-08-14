# Broth-Ratio Branching Research — Adamite vs Olivenite

**Pair:** Cu-Zn arsenates competing for As + (Cu or Zn) in supergene oxidation zones
**Purpose:** Determine retrofit thresholds matching the rosasite/aurichalcite pattern.
**Reference:** `vugg.py:supersaturation_rosasite` (Round 9a).
**Verdict at the end:** **Retrofit recommended.** Upgrade Round 8d's strict-comparison dispatch to a 50% gate with sweet-spot bonus.

---

## Identity

| Mineral | Formula | Color | Habit |
|---|---|---|---|
| **Adamite** | Zn₂(AsO₄)(OH) | Pale yellow / colorless / green (Cu²⁺ activator gives lime green + UV fluorescence) | Tabular to acicular |
| **Olivenite** | Cu₂(AsO₄)(OH) | Olive green to grayish-green (Cu²⁺ chromophore) | Acicular to fibrous prisms |

Same orthorhombic adamite-group structure (space group Pnnm). The Zn²⁺ and Cu²⁺ end-members swap on a single octahedral site; intermediate compositions form **zincolivenite** (Cu,Zn)(AsO₄)(OH) — a separately named species since 2008 (Chukanov et al. 2008, IMA-approved).

## Branching Condition

**Primary control: Cu:Zn ratio in the parent fluid.**

This is the direct analog of rosasite/aurichalcite. The structural site that hosts Cu²⁺ vs Zn²⁺ is the same in both end-members; the only thing that changes is which divalent metal occupies it. Whichever metal dominates the fluid wins the site occupancy.

**Solid solution behavior:**
- Pure end-members are stable under stoichiometric extreme conditions only.
- The intermediate **zincolivenite** field (roughly Cu:Zn 1:1 with a bias toward whichever side dominates) is documented from many localities — Tsumeb (type), Cap Garonne (France), Mapimi.
- Above ~70 mol% of one metal, the corresponding pure-end-member name applies.

**Secondary controls (both present, neither dispositive between adamite and olivenite):**
- **Temperature:** Both are low-T (<100°C) supergene minerals. Doesn't differentiate.
- **pH:** Both stable in 4–8 range with optimum near-neutral (5–7). Doesn't differentiate.
- **As³⁺ vs As⁵⁺:** Both require oxidized arsenate (AsO₄³⁻). Doesn't differentiate.
- **Trace Cu in adamite:** the famous green UV fluorescence (515 nm) requires ~0.1–0.5 wt% Cu²⁺ as activator. So even "pure" adamite usually has a few hundred ppm Cu — the Zn dominance is what makes it adamite, not the absence of Cu.

**Citations:**
- Hawthorne, F.C. 1976. "The crystal chemistry of the adamite group." *Mineralogical Magazine* 40:875–877.
- Burns, P.C. and Hawthorne, F.C. 1995. "Hydrogen bonding in adamite-olivenite series." *Canadian Mineralogist* 33:885–888.
- Chukanov, N.V. et al. 2008. "Zincolivenite — a new IMA-approved species." *Mineralogical Magazine* 71:709–712.
- Pinch, W.W. and Wilson, W.E. 1977. *Tsumeb monograph* — adamite-olivenite-zincolivenite paragenesis at the type locality.

## Current Sim Implementation (Round 8d)

```python
# adamite (line 1474)
if self.fluid.Cu > self.fluid.Zn:
    return 0
# olivenite (line 3336)
if self.fluid.Zn > self.fluid.Cu:
    return 0
```

Strict `>` comparison — when Cu == Zn, both return their σ. The simulator picks based on whichever has higher σ (which depends on the per-mineral activity factors, denominators, and T/pH bonuses). Functionally similar to a 50% gate but without sweet-spot bonus or pure-element damping.

**Floor thresholds** (independent — not affected by ratio):
- Adamite: Zn ≥ 10, As ≥ 5, O₂ ≥ 0.3
- Olivenite: Cu ≥ 50, As ≥ 10, O₂ ≥ 0.5

The Cu floor for olivenite (≥50) is much higher than the Zn floor for adamite (≥10) — this asymmetric encoding reflects the empirical observation that Cu-arsenates need more Cu activity to nucleate than Zn-arsenates need Zn (olivenite is rarer in nature than adamite, and requires Cu-rich supergene conditions).

## Proposed Retrofit

Match the rosasite/aurichalcite Round 9 pattern:

```python
# In supersaturation_adamite, after the floor + T/pH checks:
cu_zn_total = self.fluid.Cu + self.fluid.Zn
zn_fraction = self.fluid.Zn / cu_zn_total  # safe — Zn≥10 guaranteed
if zn_fraction < 0.5:
    return 0

# Sweet-spot bonus: Zn-dominant but Cu-trace present (the fluorescent
# variety) is the most aesthetic adamite. Pure-Zn adamite (no Cu) is
# rarer in nature and less interesting in-game.
if 0.55 <= zn_fraction <= 0.85:
    sigma *= 1.3
elif zn_fraction > 0.95:
    sigma *= 0.5  # pure-Zn — competes with hemimorphite/smithsonite
```

Mirror image for olivenite:

```python
cu_zn_total = self.fluid.Cu + self.fluid.Zn
cu_fraction = self.fluid.Cu / cu_zn_total
if cu_fraction < 0.5:
    return 0
if 0.55 <= cu_fraction <= 0.85:
    sigma *= 1.3
elif cu_fraction > 0.95:
    sigma *= 0.5  # pure-Cu — competes with malachite/brochantite
```

**Floor thresholds:** Keep the current asymmetric values (adamite Zn ≥ 10, olivenite Cu ≥ 50). They reflect real activity differences.

**Trace-element minimum on the recessive side:** Add Cu ≥ 0.5 to adamite (so the Cu activator can fluoresce) and Zn ≥ 0.5 to olivenite (so zincolivenite-leaning compositions can fire). These are very low floors, basically saying "the other element must exist in the fluid for the ratio to be meaningful."

**Differences from rosasite pattern:**
- Sweet-spot windows are the same (0.55–0.85, with damping above 0.95).
- T-factor stays per-mineral (different optima — adamite peaks 20–30°C, olivenite 20–40°C).
- pH stays per-mineral (slightly different windows).

## Decision: Retrofit Recommended

**Why:** Round 8d's strict-comparison dispatch already gives the right qualitative behavior, but:
1. The sweet-spot bonus rewards realistic Cu-trace adamite (the fluorescent variety) and Zn-trace olivenite — both are the most-collected forms.
2. The pure-element damping captures real competition with malachite (Cu pure) and smithsonite/hemimorphite (Zn pure).
3. Aligning with rosasite/aurichalcite gives the codebase a single canonical broth-ratio idiom — easier to read, easier to extend.

**Sequencing:** Implement after this research is reviewed. One commit. No new FluidChemistry fields. Existing supergene_oxidation scenario test fixtures should still pass (Tsumeb fluid is Zn-dominant by design, so adamite still wins there). May need to bump SIM_VERSION if the sweet-spot bonus shifts seed-42 crystal counts.
