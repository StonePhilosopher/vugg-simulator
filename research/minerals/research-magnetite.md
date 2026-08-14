# Research: Magnetite — Vugg Simulator

**Date:** 2026-04-18
**Species:** Magnetite

---

## Identity
- **Formula:** Fe²⁺Fe³⁺₂O₄ (Fe₃O₄)
- **Crystal system:** Isometric (cubic), space group Fd3m
- **Mineral group:** Oxide — inverse spinel group (isostructural with magnesioferrite MgFe₂O₄, ulvospinel Fe₂TiO₄)
- **Hardness (Mohs):** 5.5–6.5
- **Specific gravity:** 5.17–5.18
- **Cleavage:** Indistinct; parting on {111}, very good
- **Fracture:** Uneven
- **Luster:** Metallic to submetallic

## Color & Appearance
- **Typical color:** Black, gray with brownish tint in reflected light
- **Color causes:** Mixed Fe²⁺/Fe³⁺ — the combination of oxidation states and inverse spinel structure produces broad absorption. Opaque black in all forms.
- **Transparency:** Opaque
- **Streak:** Black — diagnostic (vs hematite's red streak)
- **Notable visual features:** Strongly magnetic (lodestone variety is permanently magnetized). Octahedral crystals are iconic. Sometimes shows metallic submetallic luster with slight brownish tint.

## Crystal Habits
- **Primary habit:** Octahedral — bounded by {111} faces, the overwhelmingly dominant form
- **Common forms/faces:** {111} octahedron dominant; {110} rhombic dodecahedron less common; rare combinations
- **Twin laws:** Spinel law — contact twin on {111}, twin and composition plane identical
- **Varieties:**
  - **Lodestone** — naturally magnetized, acts as permanent magnet. Rare. Attracts iron filings.
  - **Titanomagnetite** — solid solution with ulvospinel (Fe₂TiO₄), common in mafic igneous rocks
  - **Martite** — actually hematite pseudomorph AFTER magnetite (see hematite research)
- **Special morphologies:** Octahedral crystals, granular massive, dendritic (rare), sandy/granular in sediments

## Formation Conditions (SIMULATOR PARAMETERS)

### Temperature
- **Nucleation temperature range:** 250–800°C (hydrothermal to igneous). Low-T hydrothermal synthesis demonstrated down to 250°C under reducing conditions.
- **Optimal growth temperature:** 300–600°C for well-formed octahedral crystals
- **Decomposition temperature:** ~1,583°C (melting). But oxidizes to hematite at much lower temps if fO₂ is high (see below).
- **Temperature-dependent habits:** Higher T → larger, sharper octahedra. Lower T → granular, massive. Hydrothermal with mineralizers → rounded octahedra + rhombic dodecahedra.

### Chemistry Required
- **Required elements in broth:** Fe (both Fe²⁺ AND Fe³⁺ — requires mixed valence), O₂
- **Optional/enhancing elements:** Ti (→ titanomagnetite solid solution), Mg (→ magnesioferrite), Mn, V, Cr, Al, Ni, Co, Zn, Ga — trace element chemistry is diagnostic of formation environment (hydrothermal vs igneous). Per USGS review (Dare et al. 2014): Ni/(Cr+Mn), Ti+V, Al+Mn vs Ti+V discriminant plots.
- **Inhibiting elements:** High sulfur → sulfide stability field (pyrite/pyrrhotite form instead). Very high fO₂ → hematite instead.
- **Required pH range:** Neutral to alkaline preferred (pH 7–12). Acidic conditions dissolve magnetite.
- **Required Eh range:** Intermediate — needs moderate fO₂. Not reducing enough for wüstite (FeO), not oxidizing enough for hematite. Between the iron-wüstite (IW) and hematite-magnetite (HM) buffers.
- **Required O₂ range:** Low to moderate. The HM buffer: 6Fe₂O₃ → 4Fe₃O₄ + O₂. Magnetite stable where fO₂ is below this buffer. Too much O₂ → oxidizes to hematite.

### Secondary Chemistry Release
- **Byproducts of nucleation:** Minimal — direct precipitation from Fe-bearing fluid. If forming from Fe²⁺ in solution: 3Fe²⁺ + 4H₂O → Fe₃O₄ + 8H⁺ + 2e⁻ (requires moderate oxidation).
- **Byproducts of dissolution:** In acid: Fe₃O₄ + 8HCl → FeCl₂ + 2FeCl₃ + 4H₂O. Dissolves slowly in HCl. Under reducing conditions can release Fe²⁺ back to fluid.

### Growth Characteristics
- **Relative growth rate:** Moderate. Slower than hematite in most conditions because it needs both Fe²⁺ and Fe³⁺ in the right ratio.
- **Maximum crystal size:** Octahedral crystals to ~15 cm. Hydrothermal crystals to ~10 mm commonly.
- **Typical crystal size in vugs:** 1–10 mm octahedra common; rarely larger.
- **Does growth rate change with temperature?** Yes — higher T = faster growth, better crystals. Hydrothermal synthesis at 416–800°C produces well-formed octahedra.
- **Competes with:** Hematite (higher fO₂ wins), pyrite (sulfur + reducing), siderite (CO₂-rich + reducing), goethite (low T + oxidizing + hydrated)

### Stability
- **Breaks down in heat?** No — melts at 1,583°C. But oxy-exsolves at ~600°C if Ti-rich: titanomagnetite → magnetite + ilmenite intergrowth.
- **Breaks down in light?** No.
- **Dissolves in water?** No — very insoluble.
- **Dissolves in acid?** Slowly in HCl. Faster in hot concentrated acid.
- **Oxidizes?** YES — key transformation. 4Fe₃O₄ + O₂ → 6Fe₂O₃ (magnetite → hematite). This is the hematite-magnetite buffer reaction. In vugs exposed to oxygen, magnetite rims alter to hematite (martitization).
- **Dehydrates?** No (anhydrous).
- **Radiation sensitivity:** None significant. Extremely stable.

## Paragenesis
- **Forms AFTER:** Primary iron minerals — can form early in crystallization sequence. Often crystallizes directly from Fe-rich hydrothermal fluid.
- **Forms BEFORE:** Hematite (oxidation), goethite (weathering), martite (pseudomorphic replacement by hematite)
- **Commonly associated minerals:** Hematite, pyrite, chalcopyrite, pyrrhotite, quartz, calcite, fluorite, apatite, actinolite
- **Zone:** Primary/hypogene (hydrothermal veins, igneous), sometimes survives into supergene zone (resistant to weathering, just gets a hematite rim). Also forms in metamorphic and sedimentary environments (BIF, detrital).
- **Geological environment:** Mafic/ultramafic igneous rocks (cumulate layers), hydrothermal veins, skarn deposits, banded iron formations, beach sands (detrital black sand), metamorphic rocks

## Famous Localities
- **Classic locality 1:** Bolivia (Pacosmayo, Cerro Huanaquino) — large octahedral crystals
- **Classic locality 2:** Italy (island of Elba, Traversella) — classic hydrothermal octahedra
- **Classic locality 3:** Sweden (Langban, Garpenberg) — associated with manganese/iron skarns
- **Notable specimens:** Bear Lake, Ontario (large octahedra); ZCA Mine, Balmat, New York; Parau, Bolivia; Magnet Cove, Arkansas (lodestone). Kiruna, Sweden (massive magnetite ore).

## Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** N/A — magnetite is opaque and non-fluorescent.

## Flavor Text

> Magnetite is the one that remembers which way north was. A spinel with mixed-valence iron — Fe²⁺ and Fe³⁺ locked in an inverse lattice where the tetrahedral and octahedral sites carry opposite magnetic moments, and one side wins by sheer numbers. The result: the most magnetic mineral on Earth, and lodestone, its naturally magnetized form, is how humans first discovered that the world has an invisible architecture. In a vug, magnetite grows perfect octahedra, black and geometric, each face a {111} plane like a crystallographic calling card. It sits in the middle of the iron story — more oxidized than pyrite, less oxidized than hematite — and the boundary between it and hematite is a redox buffer that geochemists use as a reference frame for the entire crust. Bring oxygen and it transforms. Take oxygen away and it comes back. The mineral is a switch.

## Simulator Implementation Notes
- **New parameters needed:** trace_Fe already tracked. Need fO₂ tracking (Eh buffer). Fe²⁺/Fe³⁺ ratio would be ideal but can use Eh as proxy.
- **New events needed:** Magnetite→hematite oxidation event when fO₂ rises. Titanomagnetite oxy-exsolution at ~600°C if Ti present.
- **Nucleation rule pseudocode:**
```
IF trace_Fe > threshold AND IW_buffer < fO₂ < HM_buffer AND T > 200°C:
  nucleate magnetite
  IF trace_Ti > threshold → titanomagnetite variant
```
- **Growth rule pseudocode:**
```
IF σ_magnetite > 1.0:
  grow at rate proportional to Fe²⁺×Fe³⁺ (needs both)
  higher T → better octahedral crystals
  IF fO₂ rises above HM_buffer → convert to hematite (martite pseudomorph)
```
- **Habit selection logic:**
  - Default → octahedral {111}
  - With mineralizers (Cl⁻, I⁻) at moderate T → rhombic dodecahedra {110}
  - Low σ, slow growth → sharp octahedra
  - Rapid growth → granular/massive
- **Decomposition products:** Oxidizes to hematite (martite) at high fO₂. Oxy-exsolves ilmenite if Ti-bearing and cooling through ~600°C.

### Variants for Game
- **Variant 1: Octahedral magnetite** — classic form, sharp black octahedra. Moderate growth, good σ, T > 300°C.
- **Variant 2: Lodestone** — permanently magnetized variety. Rare event: lightning strike or specific geological conditions. Could be a special event crystal.
- **Variant 3: Titanomagnetite** — Ti-bearing solid solution. Exsolves ilmenite on cooling → interesting transformation event (two minerals from one).
- **Variant 4: Martite** — actually hematite, but formed by oxidizing existing magnetite in place. Transformation event: magnetite crystal → same shape, now hematite. Red streak on a black octahedron.

---

## Linked Sequence: Iron Oxide Paragenesis

Magnetite belongs to the **iron oxide sequence**:
1. **Pyrite/marcasite** (FeS₂) — primary sulfide, forms first in reducing conditions with sulfur
2. **Magnetite** (Fe₃O₄) — forms at intermediate fO₂, moderate-high T, needs both Fe²⁺ and Fe³⁺
3. **Hematite** (Fe₂O₃) — forms at high fO₂, the fully oxidized endpoint
4. **Goethite** (FeOOH) — hydrated iron oxide, forms at low T in weathering zones

The HM buffer (hematite-magnetite) is one of the most important redox buffers in geochemistry. Crossing it transforms the mineral assemblage. In the simulator, this should be a significant event — the moment when oxygen wins and magnetite converts.

See also: `memory/research-hematite.md`
