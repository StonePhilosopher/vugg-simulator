# Uranospinite — Vugg Simulator Research

**Date:** 2026-05-01
**Status:** Implementation-grade draft (NOT yet boss-canonical). Pending review at StonePhilosopher. Synthesized from Mineralogical Society of America Handbook + Strunz nomenclature + sim-architecture parity with autunite/zeunerite.

## Species: Uranospinite

### Identity
- **Formula:** Ca(UO₂)₂(AsO₄)₂·10H₂O (water content variable; meta-form has fewer waters)
- **Crystal system:** Tetragonal (autunite-group structure — same family as autunite, zeunerite, torbernite)
- **Mineral group:** Autunite group
- **Hardness (Mohs):** 2–3
- **Specific gravity:** 3.45
- **Cleavage:** Perfect {001}, micaceous (autunite-group signature)
- **Luster:** Adamantine to pearly on cleavage; vitreous

### Color & Appearance
- **Typical color:** Yellow to greenish-yellow; lemon-yellow on cleavage faces
- **Color causes:** Uranyl (UO₂)²⁺ charge-transfer absorption; arsenate doesn't tint significantly (unlike vanadate)
- **Transparency:** Transparent to translucent
- **Streak:** Pale yellow
- **Notable visual features:** Looks like a yellow autunite with subtle differences. The cleavage flakes are thin and brittle; under longwave UV the color shifts visibly toward green as fluorescence kicks in.

### Crystal Habits
- **Primary habit:** Thin tabular plates flattened on {001} (autunite-group habit)
- **Common forms/faces:** Square or rectangular plates, sometimes pseudoomorphic after zeunerite
- **Twin laws:** None commonly reported
- **Varieties:**
  - Metauranospinite — partially dehydrated form, common in dry storage; readily reverses on humidification
- **Special morphologies:** Stacked book habits at high σ (Margnac, Schneeberg); thin yellow encrustation as low-σ form

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** 5–50°C (supergene/ambient)
- **Optimal growth temperature:** 10–35°C
- **Decomposition temperature:** Loses water progressively starting near room T in dry air; full collapse around 80°C (irreversible to metauranospinite-derivatives)
- **Temperature-dependent habits:** mirror autunite/zeunerite habits — high σ → micaceous_book; moderate σ → tabular_plates; low σ → encrusting

#### Chemistry Required
- **Required elements:** Ca, U, As — all mobile in oxidizing arsenic-bearing groundwater
- **Optional/enhancing:** Cu (drives toward zeunerite), P (drives toward autunite), Fe³⁺ (incidental in As-rich oxidation zones)
- **Inhibiting elements:** Reducing fluid; Cu dominance over Ca routes uranyl arsenate to zeunerite; P or V dominance routes anion to autunite/tyuyamunite branches
- **Required pH range:** 4.5–8.0 (broad, like autunite — Ca²⁺ doesn't form acid-side complexes)
- **Required Eh range:** Strongly oxidizing — U⁶⁺ + As⁵⁺
- **Required O₂ range:** O₂ ≥ 0.8 in sim units

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ca²⁺, (UO₂)²⁺, AsO₄³⁻
- **Byproducts of dissolution:** Releases uranyl, arsenate, calcium (acid attack pH < 4.5)

#### Growth Characteristics
- **Relative growth rate:** Slower than autunite — As is rarer than P in most groundwater, so the As-anion-fraction gate is harder to satisfy
- **Maximum size:** Specimens up to 1–2 mm plates from Schneeberg; rarely larger
- **Competes with:** Zeunerite (Cu-cation analogue), autunite (P-anion competitor), metazeunerite (the dehydrated zeunerite form, often co-mineralized in Schneeberg-type oxidation)

#### Stability
- **Breaks down in heat?** Yes (~80°C dehydration to metauranospinite, similar to autunite/meta-autunite pair)
- **Dissolves in acid?** Yes — pH < 4.5 (uranyl arsenates dissolve readily in mineral acid, like all autunite-group)
- **Radiation sensitivity:** Strongly radioactive (U + As both decay-active in uranium decay chain); long-term self-irradiation eventually metamictizes the lattice

### Paragenesis
- **Forms AFTER:** Uraninite weathering + arsenopyrite weathering. Both primary minerals must oxidize for the U⁶⁺ + AsO₄³⁻ to coexist in solution.
- **Forms BEFORE:** Metauranospinite (dehydration). Long-term: dissolves under acidic groundwater; uranyl re-mobilizes and may precipitate further down the gradient as another secondary U mineral.
- **Commonly associated minerals:** Metazeunerite (the Cu-As partner — they often co-mineralize in Schneeberg), metauranocircite, uranophane, trögerite, walpurgite, asselbornite. The Schneeberg "Weisser Hirsch" mine is the classic locality where the full secondary uranyl assemblage occurs.
- **Zone:** Supergene oxidation
- **Geological environments:**
  1. Oxidized arsenopyrite-uraninite hydrothermal vein deposits (Schneeberg, Saxony — type locality)
  2. Roll-front deposits with arsenic enrichment (rare; most roll-fronts are V-dominant or P-dominant)
  3. Pegmatite oxidation zones with arsenide accessories (Margnac, France)

### Famous Localities
- **Walpurgis Flacher vein, Weisser Hirsch Mine (shaft 3), Neustädtel, Schneeberg, Erzgebirgskreis, Saxony, Germany** — TYPE LOCALITY (Weisbach 1873). The same Ore Mountains district where torbernite, zeunerite, and many autunite-group species were first characterized.
- **Margnac, Limousin, France** — secondary mineralization in U-bearing pegmatites
- **Cornwall, England** — minor occurrences in Cu-As-U vein systems
- **Talmessi mine, Iran** — As-rich uranium oxidation zones

### Fluorescence
- **Fluorescent under UV?** Yes, strongly
- **LW (365nm) color:** Bright yellow-green
- **SW (255nm) color:** Weaker yellow-green
- **Note:** Strong fluorescence — Ca²⁺ doesn't quench uranyl emission like Cu²⁺ does in zeunerite. Among the autunite-group, Ca-cation species (autunite, uranospinite, tyuyamunite-like) all glow far brighter than their Cu-cation siblings (torbernite, zeunerite). The exact intensity is slightly dampened in uranospinite vs autunite — arsenate is a heavier anion than phosphate and absorbs some of the uranyl emission via vibrational coupling — but it's still in the "bright" tier.

### Flavor Text

> Zeunerite's calcium ghost. Same chemistry as the emerald-green Schneeberg arsenate, but where Cu²⁺ killed the fluorescence, Ca²⁺ leaves it intact — and in 1873 when Weisbach described the type material, he was looking at a yellow plate that glowed under whatever crude UV source mineralogists had assembled. The Schneeberg deposits weather both species side by side; uranospinite is rarer because Cu²⁺ tends to win the cation race in actively-mined Cu+As districts. Where the Cu has been depleted but the As is still around, the Ca-cation analogue takes over.

### Simulator Implementation Notes

- **No new FluidChemistry fields needed** — Ca, U, As all already declared
- **Cation fork (Round 9e):** Ca/(Cu+Ca) > 0.5 vs zeunerite's Cu/(Cu+Ca) > 0.5
- **Anion fork:** As/(P+As+V) > 0.5 (mirror zeunerite)
- **T optimum:** 10–35°C
- **pH window:** 4.5–8.0 (broad, like autunite)
- **Habit dispatch:** mirror autunite/zeunerite — high-σ micaceous_book, default tabular_plates, low-σ encrusting
- **Paragenetic preference:** weathering uraninite + weathering arsenopyrite (the As source); active zeunerite or metazeunerite in the same vug as a substrate hint
- **Zeunerite update:** add Cu/(Cu+Ca) > 0.5 cation gate to its existing supersat (without this, zeunerite would still fire in Ca-dominant fluids that should route to uranospinite)
- **Strong fluorescence narrative beat:** uranospinite is the "third bright fluorescer" alongside autunite + (more intense) intrinsic uranyl phosphate — distinct from torbernite/zeunerite/carnotite which are all dim or dead under UV
