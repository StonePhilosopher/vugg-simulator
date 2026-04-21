# Mineral Expansion: Pre-Researched Species

**Date:** 2026-04-20
**Status:** Data compiled from existing research files — ready for template formatting
**Source:** 16 mineral species researched during nightly sessions, not yet in the game

All research lives in `memory/research-<name>.md`. This document extracts the key sim-relevant data for each species.

---

## Summary Table

| # | Species | Formula | Class | Scenarios | Research File |
|---|---------|---------|-------|-----------|---------------|
| 1 | Pyromorphite | Pb₅(PO₄)₃Cl | Phosphate | Supergene | research-pyromorphite.md |
| 2 | Vanadinite | Pb₅(VO₄)₃Cl | Vanadate* | Supergene | research-vanadinite.md |
| 3 | Cerussite | PbCO₃ | Carbonate | Supergene | research-cerussite.md |
| 4 | Anglesite | PbSO₄ | Sulfate | Supergene | research-anglesite.md |
| 5 | Azurite | Cu₃(CO₃)₂(OH)₂ | Carbonate | Supergene | research-azurite.md |
| 6 | Cuprite | Cu₂O | Oxide | Supergene | research-cuprite.md |
| 7 | Native Copper | Cu | Native | Supergene | research-native-copper.md |
| 8 | Chalcocite | Cu₂S | Sulfide | Supergene | research-chalcocite.md |
| 9 | Covellite | CuS | Sulfide | Supergene | research-covellite.md |
| 10 | Bornite | Cu₅FeS₄ | Sulfide | Supergene | research-bornite.md |
| 11 | Stibnite | Sb₂S₃ | Sulfide | Hydrothermal | research-stibnite.md |
| 12 | Bismuthinite | Bi₂S₃ | Sulfide | Hydrothermal | research-bismuthinite.md |
| 13 | Native Bismuth | Bi | Native | Hydrothermal | research-native-bismuth.md |
| 14 | Clinobisvanite | BiVO₄ | Vanadate* | Supergene | research-clinobisvanite.md |
| 15 | Magnetite | Fe₃O₄ | Oxide | Hydrothermal | research-magnetite.md |
| 16 | Lepidocrocite | γ-FeOOH | Hydroxide | Supergene | research-lepidocrocite.md |

*Vanadinite and clinobisvanite are vanadates — not in the current 12-class color wheel. Will need to decide: add Vanadate as class 13, or fold into Phosphate (structurally related apatite group).

---

## 1. Pyromorphite — Pb₅(PO₄)₃Cl

**Class:** Phosphate (#13eb7f)
**T range:** <80°C (supergene)
**Required:** Pb²⁺ (from galena/anglesite/cerussite), PO₄³⁻, Cl⁻
**Nucleation σ:** 1.2
**Max size:** 15 cm
**Max nucleation count:** 6
**Growth rate:** 0.4
**Habits:**
- Hexagonal prisms (barrel-shaped) — wall_spread 0.3, void_reach 0.7, projecting, low σ
- Hoppered hexagonal — wall_spread 0.35, void_reach 0.6, projecting, moderate-high σ
- Botryoidal/coating — wall_spread 0.8, void_reach 0.2, coating, high σ
- Acicular needles — wall_spread 0.15, void_reach 0.8, projecting, high σ rapid growth
- Default — hexagonal barrel

**Color:** Green (most common, from trace Cr), brown, orange, yellow, colorless
**Fluorescence:** None (unusual for lead mineral)
**Key mechanic:** Forms from existing Pb minerals in oxidation zone when PO₄ is introduced. Can pseudomorph after galena/anglesite/cerussite.
**Paragenesis:** After galena → anglesite → cerussite; if PO₄ arrives, pyromorphite grows on/near cerussite.

---

## 2. Vanadinite — Pb₅(VO₄)₃Cl

**Class:** Vanadate* (color TBD — possibly fold into Phosphate or add new class)
**T range:** <80°C (supergene)
**Required:** Pb²⁺, V⁵⁺ (from oxidizing V-bearing sediments/ironstones), Cl⁻
**Nucleation σ:** 1.3
**Max size:** 10 cm
**Max nucleation count:** 6
**Growth rate:** 0.35
**Habits:**
- Hexagonal prisms (elongated, hair-like) — wall_spread 0.15, void_reach 0.85, projecting, low σ
- Stout hexagonal barrel — wall_spread 0.3, void_reach 0.6, equant, moderate σ
- Acicular tufts — wall_spread 0.2, void_reach 0.8, projecting, high σ
- Default — hexagonal prism

**Color:** Bright red-orange to brown-orange, yellow. One of the most recognizable minerals.
**Fluorescence:** None
**Key mechanic:** Apatite group — isostructural with pyromorphite and mimetite. The Pb₅(XO₄)₃Cl solid solution series (pyromorphite-mimetite-vanadinite) is one of mineralogy's most complete. V⁵⁺ source is arid-climate oxidation of V-bearing sediments.
**Paragenesis:** Same zone as wulfenite, cerussite, pyromorphite. Desert oxidation zone.

---

## 3. Cerussite — PbCO₃

**Class:** Carbonate (#eb7f13)
**T range:** <80°C (supergene)
**Required:** Pb²⁺, CO₃²⁻
**Nucleation σ:** 1.0
**Max size:** 20+ cm
**Max nucleation count:** 4
**Growth rate:** 0.3
**Habits:**
- Stellate cyclic twin (six-rayed star) — wall_spread 0.3, void_reach 0.6, projecting, moderate σ
- Tabular single crystal — wall_spread 0.4, void_reach 0.4, tabular, low σ
- Acicular needles — wall_spread 0.15, void_reach 0.75, projecting, high σ
- Pseudomorph after galena — inherits galena's cubic shape
- Default — stellate twin

**Color:** Colorless to white, adamantine luster, extreme birefringence
**Fluorescence:** Weak yellow LW sometimes
**Key mechanic:** Final product of lead oxidation sequence (galena → anglesite → cerussite). Replaces anglesite in carbonate-rich groundwater. The stellate twins are among mineralogy's most iconic forms.
**Paragenesis:** After anglesite. Before pyromorphite/mimetite/vanadinite if PO₄/AsO₄/VO₄ arrive.

---

## 4. Anglesite — PbSO₄

**Class:** Sulfate (#eb137f)
**T range:** <80°C (supergene)
**Required:** Pb²⁺ (from galena), SO₄²⁻ (from sulfide oxidation)
**Nucleation σ:** 1.1
**Max size:** 15 cm
**Max nucleation count:** 4
**Growth rate:** 0.3
**Habits:**
- Prismatic orthorhombic — wall_spread 0.25, void_reach 0.7, projecting, low σ
- Pseudomorph after galena (cube shape) — wall_spread 0.4, void_reach 0.4, equant, on galena surface
- Druzy coating — wall_spread 0.7, void_reach 0.15, coating, high σ
- Default — prismatic

**Color:** Colorless to white, yellow, orange. Brilliant adamantine luster (one of the most lustrous non-metallic minerals).
**Fluorescence:** Rarely weak yellow LW
**Key mechanic:** Intermediate in lead oxidation sequence. Transient — dissolves in carbonate waters to become cerussite. The "letter written in passing."
**Paragenesis:** After galena. Before cerussite (always, in carbonate environments).

---

## 5. Azurite — Cu₃(CO₃)₂(OH)₂

**Class:** Carbonate (#eb7f13)
**T range:** <50°C (supergene, high pCO₂)
**Required:** Cu²⁺ (high, from sulfide oxidation), CO₃²⁻ (high pCO₂)
**Nucleation σ:** 1.4
**Max size:** 25 cm
**Max nucleation count:** 4
**Growth rate:** 0.3
**Habits:**
- Deep blue prismatic — wall_spread 0.2, void_reach 0.8, projecting, low σ, high pCO₂
- Rosette (radiating bladed) — wall_spread 0.4, void_reach 0.5, projecting, moderate σ
- Azurite sun (flat disc) — wall_spread 0.6, void_reach 0.3, tabular, growth in thin fractures
- Default — prismatic

**Color:** Deep azure blue to midnight blue — the deepest blue in the mineral kingdom
**Fluorescence:** None
**Key mechanic:** **Azurite→malachite conversion.** Requires HIGHER pCO₂ than malachite. If pCO₂ drops during growth, azurite converts to malachite pseudomorph (same shape, green instead of blue). Most azurite is born to become malachite.
**Paragenesis:** After cuprite/native copper. Before malachite (at lower pCO₂). Requires limestone/carbonate country rock.

---

## 6. Cuprite — Cu₂O

**Class:** Oxide (#eb1313)
**T range:** <100°C (supergene)
**Required:** Cu (moderate-high), O₂ (moderate — sweet spot between reducing and oxidizing)
**Nucleation σ:** 1.2
**Max size:** 15 cm
**Max nucleation count:** 4
**Growth rate:** 0.35
**Habits:**
- Octahedral — wall_spread 0.25, void_reach 0.6, equant, slow growth, open vug
- Chalcotrichite (hair/plush) — wall_spread 0.1, void_reach 0.9, projecting, rapid directional growth
- Massive/earthy (tile ore) — wall_spread 0.7, void_reach 0.2, coating, rapid growth low space
- Spinel-law twin — wall_spread 0.3, void_reach 0.55, equant, rare
- Default — octahedral

**Color:** Dark red to nearly black, ruby-red internal reflections (not fluorescence — refraction)
**Fluorescence:** None
**Key mechanic:** Forms at the Eh boundary between native copper (more reducing) and tenorite/malachite (more oxidizing). Redox-controlled existence. 88.8% Cu by weight.
**Paragenesis:** After native copper/chalcocite. Before malachite/azurite (with CO₃ + O₂).

---

## 7. Native Copper — Cu

**Class:** Native (#eb13eb)
**T range:** <300°C (supergene to hydrothermal)
**Required:** Cu (very high), Eh strongly reducing, S low
**Nucleation σ:** 1.6
**Max size:** Enormous (500-ton masses at Keweenaw)
**Max nucleation count:** 3
**Growth rate:** 0.2 (slow — needs specific reducing conditions)
**Habits:**
- Cubic/dodecahedral crystals — wall_spread 0.25, void_reach 0.6, equant, open vesicle
- Dendritic/arborescent — wall_spread 0.3, void_reach 0.7, dendritic, fracture-fill
- Wire copper — wall_spread 0.1, void_reach 0.95, projecting, narrow channel growth
- Massive sheet — wall_spread 0.8, void_reach 0.3, coating, large void fill
- Default — arborescent

**Color:** Copper-red, tarnishes brown, eventually green (malachite)
**Fluorescence:** None (metallic)
**Key mechanic:** Only forms when S²⁻ is absent (otherwise makes sulfides) AND Eh is reducing. The Statue of Liberty's patina is cuprite + malachite growing on native copper.
**Paragenesis:** After chalcocite/covellite (Cu²⁺ reduced). Before cuprite (if Eh rises).

---

## 8. Chalcocite — Cu₂S

**Class:** Sulfide (#7feb13)
**T range:** <150°C (supergene enrichment)
**Required:** Cu (very high), S (moderate)
**Nucleation σ:** 1.1
**Max size:** 15 cm
**Max nucleation count:** 5
**Growth rate:** 0.6
**Habits:**
- Pseudohexagonal stellate twin (sixling) — wall_spread 0.3, void_reach 0.6, projecting, twin tendency
- Tabular/prismatic — wall_spread 0.25, void_reach 0.7, projecting, low σ
- Pseudomorph (replaces chalcopyrite/bornite shape) — inherits parent shape
- Default — tabular

**Color:** Dark gray to black, metallic
**Fluorescence:** None
**Key mechanic:** **Pseudomorph thief** — replaces chalcopyrite and bornite atom by atom, keeping their shape. 79.8% Cu by weight — one of the richest copper ores. Forms in the supergene enrichment blanket.
**Paragenesis:** After chalcopyrite/bornite (replaces them). Before covellite (more S), cuprite/native copper (if oxidized).

---

## 9. Covellite — CuS

**Class:** Sulfide (#7feb13)
**T range:** <100°C (supergene transition zone)
**Required:** Cu (moderate-high), S (high — 1:1 ratio, more S than chalcocite)
**Nucleation σ:** 1.2
**Max size:** 10 cm plates
**Max nucleation count:** 4
**Growth rate:** 0.45
**Habits:**
- Thin hexagonal plate — wall_spread 0.5, void_reach 0.3, tabular, default
- Rosette (radiating plates) — wall_spread 0.4, void_reach 0.5, projecting, moderate σ
- Iridescent coating — wall_spread 0.6, void_reach 0.2, coating, near oxidation boundary
- Default — hexagonal plate

**Color:** Indigo-blue — the only common naturally blue mineral. Micaceous (peels into flexible sheets).
**Fluorescence:** None
**Key mechanic:** Forms at the boundary between oxidation and reduction zones — a transition mineral. Higher S:Cu ratio than chalcocite. Perfect basal cleavage allows peeling like mica. Decomposes to chalcocite + sulfur at 507°C.
**Paragenesis:** After chalcocite. Before cuprite/malachite (full oxidation).

---

## 10. Bornite — Cu₅FeS₄

**Class:** Sulfide (#7feb13)
**T range:** 200–500°C (hypogene) or supergene
**Required:** Cu (high), Fe (moderate), S (moderate-high). Cu:Fe ratio > 3:1.
**Nucleation σ:** 1.0
**Max size:** 5 cm crystals (usually massive)
**Max nucleation count:** 3
**Growth rate:** 0.4
**Habits:**
- Pseudo-cubic (T > 228°C) — wall_spread 0.35, void_reach 0.5, equant, high T
- Massive/granular (T < 228°C) — wall_spread 0.6, void_reach 0.3, coating, low T
- Peacock ore (iridescent tarnish) — cosmetic variant near oxidation
- Default — massive

**Color:** Bronze fresh; iridescent blue/purple/green/gold tarnish ("peacock ore")
**Fluorescence:** None
**Key mechanic:** **228°C order-disorder transition** — above 228°C Cu and Fe randomly occupy sites (pseudo-cubic), below they order (orthorhombic). Surface tarnish from thin-film interference. Competes with chalcopyrite for same elements at different Cu:Fe ratios.
**Paragenesis:** With chalcopyrite, chalcocite. Before chalcocite in supergene enrichment.

---

## 11. Stibnite — Sb₂S₃

**Class:** Sulfide (#7feb13)
**T range:** 200–400°C (hydrothermal)
**Required:** Sb (moderate-high), S (moderate)
**Nucleation σ:** 1.2
**Max size:** 60+ cm (Japan produces giants)
**Max nucleation count:** 4
**Growth rate:** 0.35
**Habits:**
- Elongated prismatic blades — wall_spread 0.1, void_reach 0.95, projecting, low σ (signature habit)
- Radiating sprays — wall_spread 0.3, void_reach 0.7, projecting, moderate σ
- Massive/granular — wall_spread 0.5, void_reach 0.4, coating, high σ
- Default — elongated blade

**Color:** Lead-gray metallic, brilliant metallic luster on fresh surfaces
**Fluorescence:** None
**Key mechanic:** One of the most visually striking minerals — sword-like blades up to 60 cm. Same crystal structure as bismuthinite (orthorhombic, elongated). Blistering metallic luster when fresh.
**Paragenesis:** With quartz, calcite, barite, pyrite, arsenopyrite, cinnabar.

---

## 12. Bismuthinite — Bi₂S₃

**Class:** Sulfide (#7feb13)
**T range:** 200–500°C (high-T hydrothermal)
**Required:** Bi (50–500 ppm), S (abundant, reducing)
**Nucleation σ:** 1.3
**Max size:** Several cm needles
**Max nucleation count:** 4
**Growth rate:** 0.4
**Habits:**
- Acicular needles (low T) — wall_spread 0.1, void_reach 0.9, projecting, T < 350°C
- Stout prismatic (high T) — wall_spread 0.2, void_reach 0.75, projecting, T > 350°C
- Radiating cluster — wall_spread 0.35, void_reach 0.6, projecting, nucleation burst
- Default — acicular

**Color:** Lead-gray to tin-white, yellowish/iridescent tarnish
**Fluorescence:** None (opaque)
**Key mechanic:** Temperature-driven habit switch (stout at high T, needles at low T). Same structure as stibnite — Bi and Sb are geochemical cousins. Sulfur depletion switches production to native bismuth.
**Paragenesis:** With native bismuth, arsenopyrite, chalcopyrite, cassiterite, wolframite.

---

## 13. Native Bismuth — Bi

**Class:** Native (#eb13eb)
**T range:** 100–271.5°C (melts at 271.5°C!)
**Required:** Bi (high), S²⁻ very low (otherwise makes bismuthinite)
**Nucleation σ:** 1.4
**Max size:** A few cm
**Max nucleation count:** 3
**Growth rate:** 0.4
**Habits:**
- Arborescent (tree-like) — wall_spread 0.3, void_reach 0.7, dendritic, fracture growth
- Massive granular — wall_spread 0.5, void_reach 0.4, coating, massive fill
- Rhombohedral crystals — wall_spread 0.25, void_reach 0.55, equant, rare, open vug
- Default — arborescent

**Color:** Silver-white fresh, iridescent oxide tarnish (yellow/blue/pink)
**Fluorescence:** None (metallic)
**Key mechanic:** **Melts at 271.5°C** — unusually low for a metal. Only forms when sulfur runs out before bismuth does. The rainbow hoppered crystals sold in rock shops are lab-grown, NOT natural.
**Paragenesis:** After bismuthinite (S depletion). Before bismite/bismutite (oxidation) → clinobisvanite (if V present).

---

## 14. Clinobisvanite — BiVO₄

**Class:** Vanadate* (color TBD)
**T range:** <80°C (supergene)
**Required:** Bi³⁺ (from bismuthinite/native bismuth oxidation), V⁵⁺
**Nucleation σ:** 1.5
**Max size:** 0.1 mm (microscopic!)
**Max nucleation count:** 8
**Growth rate:** 0.2 (slow — dilute solutions)
**Habits:**
- Micro-crystalline yellow plates — wall_spread 0.4, void_reach 0.2, coating, default
- Powdery aggregate — wall_spread 0.6, void_reach 0.15, coating, rapid
- Default — micro plates

**Color:** Bright yellow to orange-yellow
**Fluorescence:** None documented
**Key mechanic:** End of the bismuth oxidation sequence. BiVO₄ is a famous photocatalyst for water splitting — the same mineral that forms as a supergene afterthought is being studied to make solar fuel. Microscopic — only visible under magnification.
**Paragenesis:** After bismuthinite/native bismuth oxidation. Requires V source.

---

## 15. Magnetite — Fe₃O₄

**Class:** Oxide (#eb1313)
**T range:** 250–800°C (hydrothermal to igneous)
**Required:** Fe (both Fe²⁺ AND Fe³⁺ — mixed valence), O₂ (moderate — between IW and HM buffers)
**Nucleation σ:** 1.0
**Max size:** 15 cm octahedra
**Max nucleation count:** 5
**Growth rate:** 0.35
**Habits:**
- Octahedral {111} — wall_spread 0.25, void_reach 0.6, equant, moderate σ, T > 300°C
- Rhombic dodecahedra {110} — wall_spread 0.3, void_reach 0.5, equant, with mineralizers
- Granular massive — wall_spread 0.6, void_reach 0.3, coating, rapid growth
- Default — octahedral

**Color:** Black, metallic to submetallic. Streak: black (diagnostic vs hematite's red).
**Fluorescence:** None (opaque)
**Key mechanic:** **The HM buffer** — the hematite-magnetite redox boundary is one of geochemistry's most important reference frames. Crossing it transforms the mineral assemblage. Strongly magnetic (lodestone = permanent magnetism). Can oxidize to hematite (martite pseudomorph).
**Paragenesis:** With hematite, pyrite, chalcopyrite, quartz, calcite.

---

## 16. Lepidocrocite — γ-FeOOH

**Class:** Hydroxide (#13ebeb)
**T range:** <250°C (supergene/weathering)
**Required:** Fe²⁺ (from pyrite/sulfide oxidation), O₂ (rapid oxidation), pH 5–7
**Nucleation σ:** 1.1
**Max size:** Microscopic to mm-scale
**Max nucleation count:** 10
**Growth rate:** 0.5 (kinetically favored over goethite in rapid oxidation)
**Habits:**
- Platy scales — wall_spread 0.5, void_reach 0.2, tabular, default (weak interlayer bonding)
- Plumose rosettes — wall_spread 0.4, void_reach 0.35, coating, moderate σ
- Fibrous/micaceous — wall_spread 0.35, void_reach 0.4, coating, high σ
- Default — platy scales

**Color:** Ruby-red to reddish-brown (particle size dependent — nanoscale = pink-mauve)
**Fluorescence:** None
**Key mechanic:** **Dimorph of goethite** — same formula (FeOOH), different crystal structure, different color. Goethite = 3D framework (yellow-brown needles), lepidocrocite = layered (ruby-red plates). Rapid oxidation favors lepidocrocite; slow oxidation favors goethite. Transforms to goethite over time, or to maghemite/hematite when heated.
**Paragenesis:** From pyrite oxidation on quartz substrates. "Lithium quartz" is actually nanoscale lepidocrocite.

---

## Paragenetic Groups

### Lead Oxidation Sequence (supergene)
Galena → Anglesite → Cerussite → [Pyromorphite / Mimetite / Vanadinite]

All 4 new minerals (anglesite, cerussite, pyromorphite, vanadinite) plus existing galena, mimetite, wulfenite. This is the most complete sequence for the game — 7 linked minerals telling one oxidation story.

### Copper Paragenesis (supergene)
Chalcopyrite → Bornite → Chalcocite → Covellite → Native Copper → Cuprite → Azurite → Malachite

6 new minerals (bornite, chalcocite, covellite, native copper, cuprite, azurite) plus existing chalcopyrite and malachite. The Eh-pH gradient from reducing to oxidizing.

### Bismuth Sequence (hydrothermal → supergene)
Bismuthinite → Native Bismuth → [Bismite / Bismutite / Clinobisvanite]

3 new minerals (bismuthinite, native bismuth, clinobisvanite). Sulfur-controlled switch at depth, Eh-controlled transformation at surface.

### Iron Oxide Polymorphs (existing + new)
Pyrite → Magnetite → Hematite → Goethite → Lepidocrocite

2 new minerals (magnetite, lepidocrocite) plus existing pyrite, hematite, goethite. The fO₂ and hydration gradient.

### Standalone
Stibnite — hydrothermal antimony sulfide, sword-like blades.

---

## Open Questions

1. **Vanadate class color**: Vanadinite and clinobisvanite are vanadates. Current 12-hue wheel has no Vanadate. Options:
   - Add 13th class (13-hue at ~27.7° spacing — but breaks the clean 30° system)
   - Fold into Phosphate (both are apatite-group structurally) — simpler
   - Decision needed before implementation

2. **Eh tracking**: Cuprite, native copper, chalcocite, covellite, magnetite ALL need Eh (redox potential) as a sim variable. This is a significant new mechanic — currently the sim only tracks O₂, not formal redox state. Cuprite's entire existence is controlled by being in a narrow Eh band.

3. **pCO₂ tracking**: Azurite→malachite conversion needs dissolved CO₂ pressure. Azurite requires HIGH pCO₂; malachite requires lower. The conversion mechanic is one of the best teaching moments in mineralogy.

4. **Pseudomorph system**: Multiple minerals (chalcocite, cerussite, anglesite) replace earlier crystals while preserving shape. This needs a general mechanism — not per-mineral hardcoding.

5. **Implementation priority**: Which to build first? My recommendation:
   - **Round 1 (lead oxidation):** Anglesite → Cerussite → Pyromorphite. Completes the supergene lead story.
   - **Round 2 (copper paragenesis):** Bornite → Chalcocite → Covellite → Cuprite → Azurite. The full copper sequence.
   - **Round 3 (iron + bismuth + standalone):** Magnetite, Lepidocrocite, Stibnite, Bismuthinite, Native Bismuth, Clinobisvanite, Native Copper.

---

*Research sources: All data from existing research files in `memory/research-*.md`, cross-referenced against Mindat, GIA, USGS, and primary literature cited in individual files.*
