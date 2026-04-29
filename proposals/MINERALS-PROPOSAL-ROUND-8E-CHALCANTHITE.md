# Round 8e — Chalcanthite (the Soluble Extreme)

**Status:** Implementation proposal. One new species: `chalcanthite` (CuSO₄·5H₂O). Standalone — no chemistry overlap with the rest of Round 8. Smallest sub-round but introduces a **new mechanic in the sim: water-solubility / hydration metastability.** Worth its own proposal because the mechanic generalizes (melanterite FeSO₄·7H₂O, chalcocyanite CuSO₄ anhydrous, and other hydrated sulfates eventually).

**Template reference:** `proposals/vugg-mineral-template.md`

**Source-of-truth research file** (boss's commit `f2939da`):
- `research/research-chalcanthite.md`

**Class:** `sulfate` — `class_color: "#eb137f"` (same family as the Round 5 sulfates).

**Schema readiness:** zero new fields needed. Cu, S, O2, salinity all live. The mechanic novelty isn't a schema bump — it's a **runtime mechanic**: chalcanthite dissolves on contact with low-salinity fluid. New per-step hook needed, generalizable to other hydrated species later.

**Scenarios most-likely-affected at seed-42:**
- `bisbee` — late-stage supergene Cu sulfate. Cu + S + O2 all present. Most likely seed-42 hit.
- `supergene_oxidation` (Tsumeb) — late acid drainage zones could fire chalcanthite if the fluid stays saturated.
- `reactive_wall` (Sweetwater) — has Cu + S but pH may be too neutral. Marginal candidate.
- `sabkha_dolomitization` (Coorong) — has S=2700 but limited Cu. Probably absent.

---

## Implementation pairing

Two commits — engine + the metastability mechanic:

| Commit | What | Mechanism |
|---|---|---|
| **8e-1** | `chalcanthite` engine | Standard CuSO₄·5H₂O nucleation. Low-T (10-40°C), oxidizing, acidic mine drainage. Fires after brochantite/antlerite if fluid keeps acidifying. |
| **8e-2** | The dissolution mechanic + locality realizations + closeout | Per-step hook: any chalcanthite crystal in contact with low-salinity / non-saturated fluid dissolves. Activates the "rare in nature, common in mine drainage" geological truth. SIM_VERSION bump if not already taken. |

---

## 1. Chalcanthite — CuSO₄·5H₂O

**Chemistry summary:**
- Required: Cu ≥ 30 ppm, S ≥ 50 ppm, salinity ≥ ~6 (for stability)
- T range: 10-50°C, optimum 20-40°C (ambient-to-warm; dehydrates to lower hydrates above ~50°C, fully anhydrous as chalcocyanite above 250°C)
- pH 1-4 (strongly acidic — mine drainage range)
- Eh oxidizing, O2 > 0.5
- Inhibitors: low salinity (< ~5 — chalcanthite needs concentrated CuSO₄ aqueous environment to nucleate); high pH (Cu → brochantite/antlerite/malachite/azurite instead — already-shipped Round 5 species)

**Habits:**
1. **euhedral_triclinic** — sharp blue prismatic crystals when grown slowly. Display-grade specimens are essentially man-made — the natural occurrences are dust-fragile.
2. **stalactitic_drip** — pendant icicle-form deposits in mine workings. The "blue caves" of abandoned Cu mines.
3. **massive_crust** — encrusting blue layer on mine walls; the bread-and-butter form.

**Paragenesis:**
- Forms AFTER: brochantite/antlerite (the latest stage of Cu sulfate oxidation when pH still drops below their stability windows). Already in sim — Round 5.
- Forms BEFORE: nothing — it's the END of the copper sulfate line. Redissolves and washes away in the next rain.
- Companions: brochantite, antlerite, melanterite, chalcopyrite (relict), limonite, calcite, aragonite

**Color rules:** vivid royal blue (Cu²⁺ aquo complex, vibrant). The most saturated naturally-occurring blue mineral in the sim. No fluorescence.

**Sim-specific notes:**
- Chalcanthite is **the rarest natural mineral despite being the most common mine-drainage Cu mineral.** This paradox is the species' pedagogical hook: in nature, chalcanthite never lasts — every rain dissolves it. The geologically-honest sim representation should let chalcanthite *form* readily in the right conditions but *dissolve* on the next moisture/dilution event.
- Ambient T means chalcanthite fires LATE in any cooling scenario, after most other species have already nucleated. This is geologically correct.
- The salinity gate is critical — without it, chalcanthite would fire in any low-T Cu+S scenario, which would over-produce the species. Real chalcanthite requires CONCENTRATED drainage (saturated CuSO₄ aqueous solution) → high salinity proxy.

---

## The water-solubility / metastability mechanic

This is the round's novel contribution. Chalcanthite is unique among Round 8 species in that it actively *re-dissolves* under realistic environmental change. Implementation:

```python
# In vugg.py, per-step hook on every chalcanthite crystal:
def apply_chalcanthite_dissolution(self, crystal, conditions):
    if crystal.mineral != "chalcanthite":
        return
    # If salinity drops below saturation threshold, the crystal dissolves.
    # Modeled as a simple gate — every step in low-salinity fluid removes
    # ~5 µm. A tiny crystal disappears in a few steps; a large encrustation
    # takes longer.
    if conditions.fluid.salinity < 4.0 or conditions.fluid.pH > 5.0:
        crystal.dissolved = True
        dissolved_um = min(5.0, crystal.total_growth_um * 0.4)
        conditions.fluid.Cu += dissolved_um * 0.5
        conditions.fluid.S += dissolved_um * 0.5
        crystal.total_growth_um -= dissolved_um
        # If fully dissolved, mark inactive
        if crystal.total_growth_um <= 0:
            crystal.active = False
```

Hook lives in the per-step tick after grow_X but before nucleate. Same pattern as the existing per-step thermal_decomposition hook.

**Why this matters:** in a long-running scenario where Cu + S accumulate, build pH down via supergene events, then a rain event resets salinity / raises pH — chalcanthite could nucleate, accrue mass, then partially dissolve, releasing Cu + S back to the fluid. The released Cu + S could then feed brochantite/antlerite re-nucleation in the next acid pulse. **A miniature "wash and re-deposit" cycle visible in zone history.** Geologically authentic for the Cu supergene cap, and a beautiful pedagogical loop.

**Generalizes to:** melanterite (FeSO₄·7H₂O), chalcocyanite (CuSO₄ anhydrous), other hydrated sulfates and their hydration cycles. Round 8e plants the seed; future hydrate-cycle minerals reuse the hook.

---

## Cross-cutting implementation notes

### The "ephemeral mineral" pattern

Chalcanthite is the first species in the sim that's allowed to **fully dissolve and disappear** on changed fluid conditions (other species have dissolution branches that release their elements but don't remove the crystal record). This requires:

1. The dissolution hook above
2. Crystal Inventory + Library views need to handle "fully dissolved" specimens — currently they show all crystals regardless of state. After 8e, "fully dissolved chalcanthite" should display a faded ghost-thumbnail or a special icon, with a note ("Dissolved in late event — Cu/S released back to fluid"). Same UX pattern as the dissolution-tinting in the chem bar.
3. The save-to-collection flow should allow saving a chalcanthite specimen even if it later dissolves in the running sim — players want to keep specimens they collected, even if the in-sim record subsequently disappears.

### The metastability narrator

```python
def _narrate_chalcanthite(self, c):
    parts = [f"Chalcanthite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
    parts.append(
        "CuSO₄·5H₂O — the bluest mineral in nature, and the most "
        "ephemeral. Every chalcanthite specimen ever found in the wild "
        "was about to dissolve when humans got there first. The mineral "
        "forms readily wherever copper sulfide is oxidizing in dry, "
        "warm, acidic conditions — abandoned mine workings are its "
        "preferred habitat. Spectacular blue stalactites grow on mine "
        "walls in the months after a sulfide ore body is opened to "
        "atmospheric oxygen, but a single rain event flushes them away. "
        "The 'museum' chalcanthite specimens are mostly grown in lab "
        "from CuSO₄ solution."
    )
    if c.dissolved:
        parts.append(
            "This crystal dissolved during the simulation — fluid salinity "
            "dropped below saturation, pH rose past stability, or both. "
            "The Cu²⁺ and SO₄²⁻ went back into solution. In the live game, "
            "a freshly-precipitated chalcanthite crust may not survive the "
            "next acid pulse if upstream conditions change."
        )
    if c.habit == "stalactitic_drip":
        parts.append(
            "Stalactitic — the pendant 'mine icicle' habit. Forms when "
            "saturated CuSO₄ drips from a roof and partially evaporates "
            "in a humid mine atmosphere. Real abandoned-mine specimens "
            "from Chuquicamata + Río Tinto + Bingham."
        )
    return " ".join(parts)
```

### Locality chemistry adjustments

After 8e-2 lands:
- `bisbee.mineral_realizations_v8e_chalcanthite.chalcanthite` — likely seed-42 hit (Cu + S + acidic drainage all present)
- `tsumeb.mineral_realizations_v8e_chalcanthite.chalcanthite` — possible late-stage hit (Tsumeb's deep oxidation has the chemistry; seed-42 timing is the question)
- `intentionally_zero` for `chalcanthite` at MVT, sabkha, gem_pegmatite, marble_contact_metamorphism — none of these have the right combination of Cu + S + acidic drainage

### Test for the dissolution mechanic

```python
def test_chalcanthite_dissolves_in_low_salinity_fluid(vugg):
    """A chalcanthite crystal placed in a low-salinity fluid dissolves
    over multiple steps; its total_growth_um drops to 0, the released
    Cu and S return to fluid concentrations."""
    # ... build a synthetic fluid with high Cu, S, salinity (chalcanthite stable)
    # ... grow a chalcanthite to ~50 µm
    # ... drop salinity to 2.0 in a sim event
    # ... step the sim ~10 times
    # ... assert crystal.total_growth_um < 5
    # ... assert fluid.Cu > original (released back)
```

This test belongs in a new `tests/test_metastability.py` file — chalcanthite is the first metastable mineral in the sim, deserves its own test module.

---

## Automated testing expectations

**+8 parameterized tests** (4 + 8 for the one species) for free.

**Two species-specific tests:**

1. The salinity gate (chalcanthite blocked at low salinity even with Cu + S favorable):

```python
def test_chalcanthite_requires_high_salinity(vugg):
    """Chalcanthite needs concentrated drainage — salinity ≥ 6. Low-
    salinity fluid with high Cu + S still won't nucleate chalcanthite."""
    # ... build favorable Cu + S, vary salinity from 0 to 10; assert sigma > 0
    # ... only when salinity >= 6
```

2. The dissolution mechanic (the round's signature test, in the new test_metastability.py module described above).

**Scenario regression:** Chalcanthite's nucleation in a single existing scenario (Bisbee at seed-42 likely). SIM_VERSION bump in the closeout commit if not already taken.

**Total test suite** post-Round-8e: ~975 → ~985 passing (1 species × ~9 tests + 1 salinity test + 1 dissolution test).

---

## The Round 8 closeout — when all 5 sub-rounds ship

After 8a + 8b + 8c + 8d + 8e all land:

- **Engine count: 69 → 84** (+15 new species)
- **Test suite: 842 → ~985** passing (+143 new tests, mix of parameterized + species-specific + integration)
- **SIM_VERSION: 7 → 8** (one cumulative bump for the round; baseline regenerated once)
- **New mechanics introduced:**
  - 173°C polymorph paramorph (8a — argentite ↔ acanthite)
  - S-depletion overflow gate (8a + 8b — native silver / native arsenic)
  - Synproportionation Eh window (8b — native sulfur)
  - Telluride-residue gate (8b — native tellurium)
  - Three-element gate (8c — cobaltite needs Co + As + S simultaneously)
  - Solid-solution metal-ratio fork (8d — descloizite/mottramite, olivenite/adamite)
  - Polymorph kinetic preference (8d — raspite/stolzite both stable, stolzite favored)
  - Water-solubility / hydration metastability (8e — chalcanthite re-dissolves)

These new mechanics generalize to many future species. Round 8 is heavy on novel mechanics for its size — a good moment to write them up in `proposals/vugg-mineral-template.md` as a "Mineral pairing patterns" section so Round 9+ can reuse them cleanly.

- **Pedagogical wins:**
  - Tsumeb in-game becomes a faithful encyclopedia of supergene mineralogy (descloizite + mottramite + olivenite + scorodite + cerussite + adamite + smithsonite + cuprite + native_silver chain)
  - Bisbee in-game shows the full primary → supergene Co-Ni-As chain (cobaltite + nickeline → erythrite + annabergite — the Cobalt Ontario paragenesis in miniature)
  - The Au-Te coupling backlog item now has a path to land cleanly (Te chemistry pre-positioned, native_tellurium engine waiting)

- **Open follow-ups after Round 8 closes:**
  - Tarnish clock (deferred in 8a, generalizes to 8b)
  - Au-Te coupling round (depends on 8b's native_tellurium)
  - Refresh existing narrators (annabergite, erythrite) to reference new primary parents
  - 41 existing-species research files (boss's research drop) could refresh older narrators with richer habit detail; not blocking, but worth a follow-up sweep

---

## Sources

The boss's research file is the primary specification:
- `research/research-chalcanthite.md` (canonical commit `f2939da`)

Additional references for the implementation reviewer:
- Bayliss, P. (1989). "Crystal chemistry and crystallography of some minerals within the chalcocite-acanthite group." *American Mineralogist* 74: 1414–1420. [Cu sulfate hydrate stability]
- Hammarstrom, J.M., Seal, R.R., Meier, A.L., & Kornfeld, J.M. (2005). "Secondary sulfate minerals associated with acid drainage in the eastern US: Recycling of metals and acidity in surficial environments." *Chemical Geology* 215: 407–431. [Mine drainage chalcanthite paragenesis]
- Posnjak, E. & Tunell, G. (1929). "The system, cupric oxide-sulfur trioxide-water." *American Journal of Science* 18: 1–34. [The classic chalcanthite phase diagram study]

---

🪨
