# Mineral Species Research — Meta-Autunite, Metatorbernite, Metazeunerite, Pararealgar

**Date:** 2026-05-01
**Status:** Complete
**Purpose:** Spec for vugg simulator — dehydration/pseudomorph minerals

---

## 1. Meta-Autunite

### Identity
- **Formula:** Ca(UO₂)₂(PO₄)₂·6-8H₂O (脱水 from autunite's 10-12 H₂O)
- **Crystal system:** Orthorhombic (脱水-induced symmetry change from autunite's tetragonal)
- **Mineral group:** Meta-autunite group
- **Hardness (Mohs):** 2-2.5
- **Specific gravity:** 3.1-3.6 (lower than autunite due to water loss)
- **Luster:** Vitreous to pearly

### Color & Appearance
- **Color:** Pale yellow to greenish-yellow, lemon-yellow
- **Fluorescence:** Strong yellow-green under SW UV (same activator as autunite — uranyl ion)
- **Habit:** Tabular rectangular plates, foliated/micaceous aggregates (same as autunite but often more powdery)

### Formation in Simulator
- **Mechanism:** Autunite loses interlayer water. NOT a temperature event primarily — it's a humidity/desiccation event.
- **Trigger conditions:** Low humidity OR mild heating (>75°C in contact with water, but much lower in dry air)
- **Key insight:** Most museum "autunite" specimens are actually meta-autunite. The transition happens at ordinary atmospheric conditions over time. Meta-autunite is the MORE STABLE form.
- **Can form directly:** Yes — from supersaturated solution at elevated temperature, skipping the autunite phase entirely. Produces true crystalline meta-autunite (dark green, translucent) vs. dehydration product (paler, powdery).
- **Reversibility:** Partially — meta-autunite can rehydrate in humid conditions, but the crystal quality degrades. Like zeolite hydration/dehydration but lossy.

### Simulator Implementation
- **NOT a new species that nucleates from broth.** It's a post-formation transformation of autunite.
- **Trigger:** autunite crystal exists + low humidity OR temperature event
- **Visual effect:** color shifts from bright green-yellow to paler yellow, crystal may become more powdery/fractured
- **Should keep fluorescing** — the uranyl ion is unchanged, only the water content changed

---

## 2. Metatorbernite

### Identity
- **Formula:** Cu(UO₂)₂(PO₄)₂·8H₂O (脱水 from torbernite's 12 H₂O)
- **Crystal system:** Tetragonal
- **Mineral group:** Meta-autunite group
- **Hardness (Mohs):** 2-2.5
- **Specific gravity:** 3.7-3.8
- **Luster:** Vitreous to dull

### Color & Appearance
- **Color:** Pale to dark green
- **Fluorescence:** Weak to none (Cu²⁺ quenches fluorescence — same as torbernite)
- **Habit:** Tabular rectangular crystals, foliated/micaceous aggregates
- **Twinning:** Merohedral twins reported

### Formation in Simulator
- **Mechanism:** Torbernite loses interlayer water
- **Transition temperature:** ~75°C in contact with water; much lower in dry air
- **Can form directly:** Yes — from supersaturated solution, producing dark green translucent crystals (these are actually MORE attractive than dehydration-product metatorbernite)
- **Key distinction:** Direct-deposition metatorbernite = dark green, vitreous, well-crystallized. Dehydration metatorbernite = paler, more friable. Both are the same mineral.

### Simulator Implementation
- **Post-formation transformation of torbernite** (primary path)
- **OR direct nucleation from broth** when uranyl + Cu + PO₄ + low water activity
- **Same fluorescence behavior as torbernite** — weak/none due to Cu²⁺ quenching

---

## 3. Metazeunerite

### Identity
- **Formula:** Cu(UO₂)₂(AsO₄)₂·8H₂O (脱水 from zeunerite's 12 H₂O)
- **Crystal system:** Tetragonal
- **Mineral group:** Meta-autunite group
- **Hardness (Mohs):** 2-2.5
- **Specific gravity:** 3.87
- **Luster:** Vitreous to dull

### Color & Appearance
- **Color:** Pale to green (similar to metatorbernite but slightly more blue-green due to arsenate)
- **Fluorescence:** Weak to none (Cu²⁺ quenching)
- **Habit:** Tabular rectangular crystals with pinacoid faces; foliated/micaceous aggregates
- **Cleavage:** Perfect on {001}, distinct on {010}

### Formation in Simulator
- **Mechanism:** Zeunerite loses interlayer water
- **Transition:** Same thermal boundary as metatorbernite (~75°C aqueous, lower in air)
- **Can form directly:** Yes, same as metatorbernite
- **Almost always found as dehydration product of zeunerite** in arsenic-bearing hydrothermal uranium deposits

### Simulator Implementation
- **Post-formation transformation of zeunerite** (primary path)
- **Same Cu²⁺ quenching of fluorescence** as torbernite/metatorbernite
- **Same structural family** — the three meta- minerals share the autunite-group sheet structure with variable cations (Ca, Cu) and anions (PO₄, AsO₄)

---

## The Meta-Autunite Group: Unifying Framework

All four parent-child pairs share the same mechanism:

| Parent | Water | Meta- form | Water | Cation | Anion |
|--------|-------|-----------|-------|--------|-------|
| Autunite | 10-12 H₂O | Meta-autunite | 6-8 H₂O | Ca²⁺ | PO₄³⁻ |
| Torbernite | 12 H₂O | Metatorbernite | 8 H₂O | Cu²⁺ | PO₄³⁻ |
| Zeunerite | 12 H₂O | Metazeunerite | 8 H₂O | Cu²⁺ | AsO₄³⁻ |

(There's also a missing entry: the Ca-arsenate pair — meta-uranospinite / Ca-arsenate uranyl — but it's quite rare.)

**Shared sim mechanic:** These are NOT new nucleation events. They are hydration-state transformations of existing crystals. The crystal structure is sheet-like (uranyl phosphate/arsenate layers separated by water-bearing interlayers). Losing interlayer water shrinks the c-axis, changes symmetry (sometimes), and makes the crystal more friable — but the chemistry of the sheets is unchanged.

**Fluorescence rule:** Uranyl ion fluoresces bright green-yellow UNLESS Cu²⁺ is present (quenches). So meta-autunite fluoresces; metatorbernite and metazeunerite don't (or weakly).

---

## 4. Pararealgar

### Identity
- **Formula:** As₄S₄ (same composition as realgar — structural isomer)
- **Crystal system:** Monoclinic (realgar is monoclinic too, but different space group)
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 1-1.5 (even softer than realgar at 1.5-2)
- **Specific gravity:** 3.52
- **Luster:** Vitreous to resinous

### Color & Appearance
- **Color:** Bright yellow (powdery) to yellow-orange / orange-brown (granular)
- **Streak:** Bright yellow
- **Transparency:** Translucent
- **Notable:** This is the stuff that makes realgar specimens crumble to yellow powder on museum shelves. The transformation is visible — you can watch it happen over months to years.

### Formation: LIGHT-INDUCED TRANSFORMATION
- **Mechanism:** Realgar (red, As₄S₄, D₂d symmetry) → pararealgar (yellow, As₄S₄, Cs symmetry) under exposure to light
- **Trigger wavelength:** >500nm (visible light, NOT UV specifically — ordinary room light does it)
- **Speed:** Gradual. Weeks to years depending on light intensity. Dark storage preserves realgar indefinitely.
- **Molecular change:** The As₄S₄ cage molecule isomerizes. In realgar, all four As atoms are equivalent (D₂d symmetry). In pararealgar, there are three types of As atoms (Cs symmetry). The As-As bonds (30% weaker than As-S bonds) are the ones that break and reform.
- **Irreversible:** Once realgar becomes pararealgar, it doesn't go back.

### Why This Is Special for the Simulator
- **It's the only light-induced transformation in the game.** Every other mineral transformation is driven by temperature, chemistry, or fluid. Pararealgar is driven by LIGHT.
- **Realgar is already in the sim.** This is a post-formation event, like the meta- minerals, but the trigger is completely different.
- **Visual storytelling:** A red crystal slowly turning yellow and crumbling is one of the most dramatic things that happens in mineral collections. Players would notice this.

### Paragenesis
- **Forms FROM:** Realgar (exclusively)
- **Associated with:** Realgar (untransformed remnants), stibnite, tetrahedrite, arsenopyrite, orpiment, native arsenic, arsenolite, native sulfur
- **Environment:** Same as realgar — low-T hydrothermal veins, typically As-S systems

### Simulator Implementation
- **NOT a nucleation event.** Purely a post-formation transformation.
- **Trigger:** realgar crystal exists + light exposure over time
- **Visual progression:** Red → orange → yellow → yellow powder
- **Structural effect:** Hardness drops, crystal becomes friable, eventually crumbles
- **Game mechanic:** If you want to preserve realgar specimens, store them in the dark. If you want pararealgar, put them in the light. This gives the player a reason to care about light exposure in the vug.

### Key Difference from Meta- Minerals
The meta- minerals lose water (hydration-state change). Pararealgar is an isomerization — same atoms, different molecular arrangement. No water involved. Driven by photons, not heat or chemistry.

---

## Implementation Priority for Builder

1. **Pararealgar** — unique mechanic (light-induced), high visual drama, only requires realgar exists + light
2. **Meta-autunite** — most common of the meta- trio, follows autunite naturally
3. **Metatorbernite** — can form directly OR from torbernite dehydration
4. **Metazeunerite** — same pattern as metatorbernite, AsO₄ variant

All four are post-formation transformations, not new nucleation events. The sim may need a generic "crystal transformation" event type that handles:
- Hydration-state changes (the meta- trio)
- Light-induced isomerization (pararealgar)

---

*Research completed 2026-05-01 by 🪨✍️ for the Vugg Simulator mineral expansion project.*
