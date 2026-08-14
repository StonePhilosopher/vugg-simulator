# Research: Stibnite (Sb₂S₃)

## Species: Stibnite

### Identity
- **Formula:** Sb₂S₃
- **Crystal system:** Orthorhombic
- **Mineral group:** Sulfide
- **Hardness (Mohs):** 2
- **Specific gravity:** 4.63
- **Cleavage:** Perfect on {010}; imperfect on {100} and {110}
- **Fracture:** Subconchoidal
- **Luster:** Metallic — brilliant on fresh surfaces, dulls to black on oxidation

### Color & Appearance
- **Typical color:** Lead-gray, silvery metallic when fresh; tarnishes blackish or iridescent
- **Color causes:** Metallic luster from Sb-S bonding; iridescent tarnish from thin-film oxidation (Sb₂O₃/Sb₂O₄ surface layers)
- **Transparency:** Opaque
- **Streak:** Lead gray
- **Notable visual features:** Spectacular elongated prismatic crystals — some of the most recognizable in mineralogy. Striated along c-axis length. Iridescent tarnish on older surfaces. Flexible but not elastic (will bend, won't spring back).

### Crystal Habits
- **Primary habit:** Elongated prismatic crystals, often radiating or divergent clusters
- **Common forms/faces:** Dominant {010} prism faces with strong vertical striations; terminations rare but show {111} and {131}
- **Twin laws:** Rare — not a defining feature
- **Varieties:** Metastibnite — earthy, reddish, amorphous microcrystalline deposits
- **Special morphologies:** Massive, granular, radiating sheaves, divergent sprays, "Chinese needles" (slender single crystals). Crystals can reach 60×5×5 cm — among the longest single sulfide crystals known.

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 100–350°C (epithermal to mesothermal hydrothermal)
- **Optimal growth temperature:** 200–300°C (low-to-moderate hydrothermal)
- **Decomposition temperature:** 550°C (melting point of Sb₂S₃)
- **Temperature-dependent habits:** Lower temps → slender needles; higher temps → thicker, more equant prisms. Rapid cooling favors fibrous/radiating clusters.

#### Chemistry Required
- **Required elements in broth:** Sb (≥50 ppm), S (≥100 ppm)
- **Optional/enhancing elements:** As (promotes association with realgar/orpiment), Fe (associated pyrite), Pb (associated galena), Ca (calcite gangue)
- **Inhibiting elements:** High O₂ (causes oxidation to stibiconite/cervantite before stibnite can form)
- **Required pH range:** Near-neutral to mildly acidic (pH 4–7)
- **Required Eh range:** Reducing — stibnite requires low oxygen fugacity to prevent antimony from oxidizing to Sb⁵⁺
- **Required O₂ range:** Very low — strictly reducing conditions. Any significant O₂ drives Sb³⁺→Sb⁵⁺ oxidation.

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Minimal — direct precipitation from Sb³⁺ + S²⁻ in solution
- **Byproducts of dissolution/decomposition:** Oxidation releases Sb⁵⁺ into solution (forms stibiconite, cervantite) and sulfate (SO₄²⁻)

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast — stibnite crystallizes readily when conditions are right
- **Maximum crystal size:** Up to 60 cm long in nature (Japan, France, Germany localities)
- **Typical crystal size in vugs:** 1–20 cm, often forming dramatic sprays
- **Does growth rate change with temperature?** Yes — strongly anisotropic growth (c-axis elongation) at all temps, but faster at higher temps
- **Competes with:** Bismuthinite (Bi₂S₃ — same structure, solid solution possible), arsenopyrite (if As and Fe present), realgar/orpiment (if Sb/As ratio is low)

#### Stability
- **Breaks down in heat?** Melts at 550°C. Before melting, no phase transitions known.
- **Breaks down in light?** No (unlike realgar)
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Decomposed by HCl (releases H₂S)
- **Oxidizes?** Yes — readily oxidizes at surface to stibiconite (Sb³⁺Sb⁵⁺₂O₆(OH)) and cervantite (Sb₂O₄). This is the primary supergene alteration path.
- **Dehydrates?** N/A
- **Radiation sensitivity:** None notable

### Paragenesis
- **Forms AFTER:** Initial quartz/calcite gangue crystallization; may co-precipitate with early pyrite
- **Forms BEFORE:** Stibiconite, cervantite (oxidation products), kermesite (Sb₂S₂O — partial oxidation, crimson)
- **Commonly associated minerals:** Realgar, orpiment, cinnabar, galena, pyrite, marcasite, arsenopyrite, calcite, ankerite, barite, chalcedony
- **Zone:** Primary/hypogene — low-temperature hydrothermal veins and replacement deposits
- **Geological environment:** Epithermal veins, hot-spring deposits, stibnite-quartz veins, carbonate-hosted replacement deposits

### Famous Localities
- **Xikuangshan mine, Hunan, China** — world's largest antimony deposit; large crystals with calcite
- **Ichinokawa mine, Japan** — classic elongated crystals to 60 cm
- **Herja mine, Maramureș, Romania** — aesthetic sprays with calcite and sphalerite
- **Lac Nicolet mine, Quebec, Canada** — fine radiating clusters
- **Mollie Gibson mine, Colorado, USA** — large sprays
- **Notable specimens:** AMNH displays a 1,000-pound specimen. Largest single crystals ~60×5×5 cm from Japanese, French, and German localities.

### Fluorescence
- **Fluorescent under UV?** No — metallic/opaque minerals generally non-fluorescent
- **SW/MW/LW color:** N/A
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A

### Flavor Text

> Stibnite grows like frozen lightning — lead-gray blades erupting from calcite walls, each one a slow-motion strike conducted over millennia in the reducing dark. Antimony's signature mineral, crystallizing in low-temperature hydrothermal veins where the broth runs thick with sulfur and the oxygen never reaches. The ancient Egyptians ground it into kohl for their eyes; alchemists chased philosophical mercury through its crystals. Fresh from the vug, it gleams like polished steel. Give it air and it tarnishes — iridescent, then black — antimony slowly betraying itself to oxygen. Some crystals reach half a meter long: the longest sulfide blades in the mineral kingdom. Flexible but not elastic. Bend one and it stays bent, like a promise you can't unmake.

### Simulator Implementation Notes
- **New parameters needed:** trace_Sb (antimony) — not currently in broth sliders
- **New events needed:** `event_antimony_pulse` — Sb-enriched fluid pulse in hydrothermal scenarios
- **Nucleation rule pseudocode:**
```
IF trace_Sb > 50 AND trace_S > 100 AND T < 350 AND T > 100 AND O₂ < 0.01 AND pH < 7 → nucleate stibnite
```
- **Growth rule pseudocode:**
```
IF σ_stibnite > 1.0 AND T < 350 → grow along c-axis preferentially (elongation factor 3-5x)
  growth_rate = base_rate * (trace_Sb/100) * (trace_S/100) * (1 - O₂)
  habit = IF T < 200 → slender needle; IF T > 250 → thick prism
```
- **Habit selection logic:**
  - T < 200°C, rapid cooling → slender needles, radiating clusters
  - T 200–300°C, slow cooling → thick prismatic blades, individual crystals
  - Trace Pb present → may form with galena association
  - Oxidizing conditions → converts to kermesite (partial) or stibiconite (full)
- **Decomposition products:**
  - T > 550°C → melts (Sb₂S₃ liquid)
  - Oxidation → stibiconite Sb³⁺Sb⁵⁺₂O₆(OH) + cervantite Sb₂O₄
  - Partial oxidation → kermesite Sb₂S₂O (crimson red — notable color)

### Variants for Game
- **Variant 1: Classic stibnite** — elongated silvery blades in radiating spray. Standard hydrothermal conditions.
- **Variant 2: Iridescent stibnite** — oxidized surface with thin-film interference colors (blues, greens, golds). Forms when O₂ briefly contacts crystal surfaces before returning to reducing conditions. Rare and striking.
- **Variant 3: Kermesite ghost** — partial oxidation product, crimson red coating on gray stibnite blades. The boundary between sulfide and oxide, captured mid-transformation. Serves as visual indicator of oxidation front advancing through the vug.

---

## Completed Species Links
- Cuprite → `memory/research-cuprite.md`
- Malachite → `memory/research-malachite.md`
- Azurite → `memory/research-azurite.md`
- Native Copper → `memory/research-native-copper.md`
- Galena → `memory/research-galena.md`
- Pyrite/Marcasite → `memory/research-pyrite-marcasite.md`
- Sphalerite → `memory/research-sphalerite.md`
- Chalcopyrite → `memory/research-chalcopyrite.md`
- Bornite → `memory/research-bornite.md`
- Chalcocite → `memory/research-chalcocite.md`
- Covellite → `memory/research-covellite.md`
- Hematite → `memory/research-hematite.md`
- Magnetite → `memory/research-magnetite.md`
- Cerussite → `memory/research-cerussite.md`
- Anglesite → `memory/research-anglesite.md`
- Pyromorphite → `memory/research-pyromorphite.md`
- Mimetite → `memory/research-mimetite.md`
- Vanadinite → `memory/research-vanadinite.md`
- Lepidocrocite → `memory/research-lepidocrocite.md`
- Stibnite → `memory/research-stibnite.md` ✓ NEW
