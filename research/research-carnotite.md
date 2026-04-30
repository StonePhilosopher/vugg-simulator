# Carnotite — Vugg Simulator Research

## Species: Carnotite

### Identity
- **Formula:** K₂(UO₂)₂(VO₄)₂·3H₂O (water content variable, 1–3 H₂O)
- **Crystal system:** Monoclinic
- **Mineral group:** Carnotite group (uranyl vanadate)
- **Hardness (Mohs):** 2
- **Specific gravity:** 4.70 (heavy for a soft mineral — uranium)
- **Cleavage:** Perfect on {001}, micaceous
- **Fracture:** Uneven
- **Luster:** Dull, earthy; silky when crystalline

### Color & Appearance
- **Typical color:** Bright yellow to lemon-yellow, may be greenish-yellow
- **Color causes:** Uranyl (UO₂)²⁺ charge-transfer absorption — yellow is diagnostic for U⁶⁺ vanadates
- **Transparency:** Semitransparent
- **Streak:** Yellow
- **Notable visual features:** Intense canary yellow that colors sandstone at <1% concentration; powdery crusts and flakes; strongly radioactive

### Crystal Habits
- **Primary habit:** Crusts and earthy masses
- **Common forms/faces:** Rarely crystalline — when found, diamond-shaped plates flattened on {001}, to 2 mm
- **Twin laws:** On {001} as both twin and composition plane
- **Varieties:** Tyuyamunite (Ca analogue — Ca(UO₂)₂(VO₄)₂·5-8H₂O), margaritasite (Cs-bearing)
- **Special morphologies:** Foliated aggregates, granular coatings, powdery disseminations in sandstone, concentrations around petrified wood

### Formation Conditions

#### Temperature
- **Nucleation temperature range:** <50°C (supergene/ambient)
- **Optimal growth temperature:** 20–40°C (arid environments)
- **Decomposition temperature:** Dehydrates readily; structure collapses above ~100°C
- **Temperature-dependent habits:** No significant habit variation — rarely forms good crystals regardless

#### Chemistry Required
- **Required elements:** K, U, V — all must be mobile in groundwater
- **Optional/enhancing elements:** Ca (forms tyuyamunite if K depleted), Ba, Mg, Fe, Na (common impurities)
- **Inhibiting elements:** Reducing agents; P and As compete for uranyl (form autunite/zeunerite instead)
- **Required pH range:** Slightly alkaline to neutral (6–8) — V is mobile as vanadate above pH 6
- **Required Eh range:** Strongly oxidizing — U must be U⁶⁺, V must be V⁵⁺
- **Required O₂ range:** High

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes K⁺, (UO₂)²⁺, VO₄³⁻ from solution
- **Byproducts of dissolution:** Releases uranyl, vanadate, potassium

#### Growth Characteristics
- **Relative growth rate:** Moderate to fast when conditions are right — tends to form crusts rather than discrete crystals
- **Maximum crystal size:** Rarely exceeds 2 mm as crystals; crusts can cover meters of sandstone
- **Typical crystal size in vugs:** Powdery coatings, sub-mm flakes
- **Competes with:** Tyuyamunite (Ca analogue), other uranyl minerals

#### Stability
- **Breaks down in heat?** Yes — loses water readily
- **Breaks down in light?** No
- **Dissolves in water?** Slightly soluble; more stable in arid conditions (which is why it survives in desert sandstones)
- **Dissolves in acid?** Yes, readily
- **Oxidizes?** Already fully oxidized
- **Dehydrates?** Yes — variable water content (1–3 H₂O) depending on humidity
- **Radiation sensitivity:** Self-damage from U decay

### Paragenesis
- **Forms AFTER:** Uraninite (primary), montroseite (V-bearing), davidite; also forms from V-bearing sediments
- **Forms BEFORE:** Secondary clay minerals, iron oxyhydroxides
- **Commonly associated minerals:** Tyuyamunite, barite, quartz (sandstone host), clays, limonite
- **Zone:** Supergene oxidation zone, typically in sedimentary (sandstone-hosted) uranium deposits
- **Geological environment:** Colorado Plateau-type sandstone uranium deposits, arid climates, roll-front deposits, around petrified wood (organic reducing traps)

### Famous Localities
- **Colorado Plateau (UT, CO, AZ, NM), USA** — type area, historically major U ore
- **Roc Creek, Montrose County, Colorado** — type locality (1899)
- **Shinkolobwe Mine, Katanga, DRC** — high-grade uranium deposit
- **Radium Hill, South Australia** — carnotite-bearing deposits
- **Notable specimens:** Bright yellow coatings on sandstone from Happy Jack Mine, Moab, Utah; carnotite on petrified wood from St. George, Utah

### Fluorescence
- **Fluorescent under UV?** No — carnotite is non-fluorescent
- **Activator:** N/A (UO₂²⁺ would normally fluoresce green but the vanadate matrix quenches it)
- **Quenched by:** Vanadate matrix and self-absorption

### Flavor Text

> Carnotite paints the desert yellow. A mineral so chromatically aggressive that one percent of it will stain an entire sandstone outcrop the color of school buses and hazard tape. It shouldn't exist — uranium and vanadium, two elements that barely know each other at depth, thrown together by groundwater chemistry in the oxidized tops of sedimentary deposits. The Colorado Plateau was built on carnotite: miners chased its yellow stain through Jurassic sandstones, finding it concentrated around petrified logs where ancient organic matter had trapped uranium from solution. The crystals themselves are almost an afterthought — tiny, rare, barely 2 mm. Carnotite's real habit is the crust. The paint. The smear. It doesn't crystallize so much as it stains.

### Simulator Implementation Notes
- **New parameters needed:** trace_V (already in game), trace_K (already in game)
- **New events needed:** Vanadium oxidation — V must be mobilized as V⁵⁺ in oxidizing groundwater
- **Nucleation rule pseudocode:**
```
IF temp < 50 AND Eh > 0.4 AND trace_U > threshold AND trace_K > threshold AND trace_V > threshold AND pH 6-8 → nucleate carnotite
IF trace_Ca >> trace_K → nucleate tyuyamunite instead
```
- **Growth rule pseudocode:**
```
IF carnotite exists AND U, V, K available AND oxidizing AND dry → grow crust (powdery habit)
Growth rate ∝ min(U, V, K) — limited by least abundant
```
- **Habit selection logic:** Almost always crust/earthy. Crystals only at very high supersaturation with slow growth (rare).
- **Decomposition products:** Dehydration products with fewer H₂O; dissolution releases all components

### Variants for Game
- **Variant 1: Tyuyamunite** — Ca analogue, Ca(UO₂)₂(VO₄)₂·5-8H₂O. More water, calcium instead of potassium. Forms when Ca dominates over K.
- **Variant 2: Sandstone stain** — powdery disseminated form coloring host rock. Most common natural occurrence.
- **Variant 3: Petrified wood association** — carnotite concentrated on organic surfaces. Bonus growth rate near carbonaceous material.

---

## Paragenetic Sequence: Uranium Oxidation Zone

See research-torbernite.md for full sequence table. Carnotite represents the V-dominated branch of the supergene uranium family, forming where vanadium is available instead of phosphorus or arsenic.
