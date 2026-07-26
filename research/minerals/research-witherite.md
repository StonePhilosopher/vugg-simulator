# Mineral Species Research — Witherite

## Species: Witherite

### Identity
- **Formula:** BaCO₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Carbonate (aragonite group)
- **Hardness (Mohs):** 3.0–3.5
- **Specific gravity:** 4.3 (heavy for a translucent mineral — the barium does that)
- **Cleavage:** Distinct on {010}, poor on {110} and {012}
- **Fracture:** Subconchoidal
- **Luster:** Vitreous, resinous on fractures

### Color & Appearance
- **Typical color:** Colorless, white, pale gray; tints of pale yellow, pale brown, pale green
- **Color causes:** Trace impurities; pure material is colorless
- **Transparency:** Subtransparent to translucent
- **Streak:** White
- **Notable visual features:** Nearly always twinned, giving pseudohexagonal cross-sections. Botryoidal to spherical aggregates are common and distinctive. High specific gravity is immediately noticeable in hand.

### Crystal Habits
- **Primary habit:** Short prismatic crystals, striated along length
- **Common forms/faces:** Prismatic along [001]; pseudohexagonal from repeated twinning
- **Twin laws:** {110} contact twin — universal. Repeated twinning produces hexagonal-looking crystals
- **Varieties:** None formally named
- **Special morphologies:** Botryoidal, spherical (stellate), columnar-fibrous, granular, massive

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** Low-temperature hydrothermal, ~50–200°C
- **Optimal growth temperature:** ~80–150°C
- **Decomposition temperature:** ~811°C (decomposes to BaO + CO₂)
- **Temperature-dependent habits:** Lower temps favor botryoidal/massive; higher temps produce better-defined prisms

#### Chemistry Required
- **Required elements in broth:** Ba²⁺, CO₃²⁻ (or dissolved CO₂ + alkaline conditions)
- **Optional/enhancing elements:** Sr (forms solid solution with strontianite), Pb (trace substitution), Ca
- **Inhibiting elements:** High sulfate favors barite (BaSO₄) over witherite — SO₄²⁻ competes directly
- **Required pH range:** Alkaline (pH >7); carbonate stability requires it
- **Required Eh range:** Not strongly redox-sensitive (Ba²⁺ is stable in both)
- **Required O₂ range:** Not critical

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ba²⁺ and CO₃²⁻ from solution
- **Byproducts of dissolution/decomposition:** Dissolves in acids releasing CO₂; thermal decomposition releases CO₂

#### Growth Characteristics
- **Relative growth rate:** Moderate — faster than barite but slower than calcite
- **Maximum crystal size:** To ~8 cm; botryoidal masses can be larger
- **Typical crystal size in vugs:** 1–5 cm prismatic crystals; botryoidal masses to 10+ cm
- **Does growth rate change with temperature?** Higher CO₂ partial pressure increases solubility; retrograde solubility not significant in normal range
- **Competes with:** Barite (BaSO₄) — the primary competitor for Ba. High sulfate = barite wins. Low sulfate, high carbonate = witherite wins

#### Stability
- **Breaks down in heat?** Yes, ~811°C → BaO + CO₂
- **Breaks down in light?** No
- **Dissolves in water?** Very slightly (Ksp ~2.58 × 10⁻⁹ at 25°C)
- **Dissolves in acid?** Yes, readily in dilute HCl with effervescence
- **Oxidizes?** No (Ba²⁺ is already oxidized)
- **Dehydrates?** No (anhydrous)
- **Radiation sensitivity:** Not notable

### Paragenesis
- **Forms AFTER:** Barite (commonly replaces barite when CO₂-rich fluids invade)
- **Forms BEFORE:** Can alter to barite if sulfate is introduced later
- **Commonly associated minerals:** Barite, fluorite, galena, calcite, celestine, sphalerite
- **Zone:** Low-temperature hydrothermal veins, Mississippi Valley-Type deposits
- **Geological environment:** Hydrothermal veins in limestone, vugs in carbonate host rocks

### Famous Localities
- **Settlingstones Mine, Northumberland, England** — world's best witherite specimens, botryoidal white balls
- **Cave-in-Rock, Illinois, USA** — fine prismatic crystals with fluorite
- **Alston Moor, Cumbria, England** — classic locality, historical type area
- **Pigeon Roost Mine, Glenwood, Arkansas, USA** — good crystals
- **Thunder Bay, Ontario, Canada** — associated with amethyst deposits

### Fluorescence
- **Fluorescent under UV?** Yes — strongly
- **SW (255nm) color:** Bluish white (also reported greenish and yellow from some localities)
- **MW (310nm) color:** Bluish white
- **LW (365nm) color:** Bluish white
- **Phosphorescent?** Yes — white after SW, bluish white after LW
- **Activator:** Likely intrinsic lattice defects or trace rare earth elements
- **Quenched by:** Not well documented; Fe may quench

### Flavor Text
> Witherite is barite's quiet cousin — the same heavy barium, but married to carbonate instead of sulfate. Where barite demands sulfur, witherite asks only for CO₂, and in low-sulfate hydrothermal veins it sometimes replaces its more famous relative entirely. The result is always twinned: every crystal a hexagonal illusion built from orthorhombic repetition. Under UV it glows a soft ghostly blue and keeps glowing after you turn the light off, as if it doesn't quite trust the dark. William Withering proved it was a new mineral in 1784 — the same man who discovered digitalis, the foxglove heart drug. A physician who could read both pulses and crystals.

### Simulator Implementation Notes
- **New parameters needed:** None — Ba and CO₃ already tracked
- **New events needed:** Possible barite→witherite replacement event (CO₂-rich fluid pulse converts existing barite)
- **Nucleation rule pseudocode:**
```
IF trace_Ba > threshold AND dissolved_CO3 > threshold AND sulfate_low THEN nucleate
```
- **Growth rule pseudocode:**
```
IF trace_Ba > 0 AND dissolved_CO3 > 0 AND SO4/Ba_ratio < 1.0 THEN grow
rate proportional to min(trace_Ba, dissolved_CO3) * (1 - SO4_ratio)
```
- **Habit selection logic:** T < 100°C → botryoidal; T > 100°C → prismatic/twinned pseudohexagonal
- **Decomposition products:** BaO + CO₂ (gas) at ~811°C
- **Competition:** If SO₄²⁻ is high, nucleate barite instead. Witherite/barite ratio = f(CO₃/SO₄)

### Variants for Game
- **Variant 1:** *Botryoidal witherite* — low temperature, rounded mammillary aggregates. Classic English material.
- **Variant 2:** *Prismatic twinned witherite* — higher temperature, pseudohexagonal cross-sections. Cave-in-Rock style.
- **Variant 3:** *Strontian witherite* — Sr-substituted, transitional toward strontianite. Slightly lower SG, different fluorescence hue.

---

## Paragenetic Note: The Aragonite Group Carbonates
Witherite (BaCO₃) and strontianite (SrCO₃) are isostructural members of the aragonite group (orthorhombic carbonates). They form a partial solid solution series. In the simulator, they share:
- Same crystal system (orthorhombic, space group Pmcn)
- Same zone (low-T hydrothermal)
- Same competition mechanic (carbonate vs sulfate — witherite vs barite, strontianite vs celestine)
- Same UV fluorescence behavior

The formation sequence in a vug: if Ba or Sr is present in the fluid, the CO₃/SO₄ ratio determines whether you get carbonates (witherite/strontianite) or sulfates (barite/celestine). A shift from sulfate-rich to CO₂-rich conditions converts the sulfates to carbonates — a replacement event.

---

*Completed: 2026-05-02 by Vugg game expansion cron*
