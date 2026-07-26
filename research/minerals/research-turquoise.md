# Mineral Species Template — Vugg Simulator

## Species: Turquoise

### Identity
- **Formula:** CuAl₆(PO₄)₄(OH)₈·4H₂O — Cu in the M1 site, Al in the M2 octahedra; Fe³⁺ substitutes for Al toward the chalcosiderite end-member CuFe₆³⁺(PO₄)₄(OH)₈·4H₂O
- **Crystal system:** Triclinic (1̄)
- **Mineral group:** Phosphate (turquoise group: turquoise–chalcosiderite–faustite–planerite solid-solution series)
- **Hardness (Mohs):** 5 – 6 (massive turquoise can be much softer when porous; gem-grade is 5.5+)
- **Specific gravity:** 2.6 – 2.9
- **Cleavage:** {001} good and {010} fair, but only seen on rare crystals; massive turquoise shows none
- **Fracture:** Conchoidal, smooth in compact varieties; granular and friable in soft material
- **Luster:** Waxy to subvitreous on fresh fracture; dull on weathered surface

### Color & Appearance
- **Typical color:** Sky-blue to robin's-egg blue (the canonical "turquoise blue") through blue-green to apple-green; rarely yellow-green at the chalcosiderite/faustite end
- **Color causes:** Cu²⁺ in distorted octahedral coordination (the chromophore — same blue as azurite/chalcanthite). Fe³⁺ substitution for Al pulls the color green; pure chalcosiderite is yellow-green. Hydration state matters: dehydrated turquoise greens irreversibly.
- **Transparency:** Translucent in thin section to opaque in massive form
- **Streak:** White to pale greenish white
- **Notable visual features:** Spider-web matrix patterns (host-rock veining around turquoise nodules), the iconic black-and-blue contrast of "spider-web turquoise." Surface often shows a porcellanous or waxy sheen. Fresh material is sky-blue; aged or sun-exposed material drifts toward green or pale chalky tones.

### Crystal Habits
- **Primary habit:** Cryptocrystalline / microcrystalline massive — botryoidal, reniform, stalactitic crusts; veinlet-fillings; pore-fillings; nodular concretions
- **Common forms/faces:** Rare. Distinct triclinic crystals exist only at a handful of localities (most famously Lynch Station, Campbell County, Virginia, USA) and are typically <2 mm tabular pseudo-rhombic plates on {001}.
- **Twin laws:** None documented
- **Varieties:**
  - **Sky-blue / robin's-egg** — the classic, low-Fe, well-hydrated. Persian (Nishapur, Iran) and Sleeping Beauty (Globe AZ) are the type aesthetics.
  - **Spider-web turquoise** — host-rock matrix veining producing dark filigree network through blue
  - **Green turquoise** — Fe³⁺-substituted, chalcosiderite-leaning. Common in eastern USA deposits (Virginia, Nevada).
  - **Faustite** — Zn replaces Cu; yellow-green, rare
  - **Chalcosiderite** — Fe³⁺-end-member, dark green, rare
  - **Planerite** — water-poor end-member
- **Special morphologies:** Nodules in altered host rock; veinlet-fillings between host clasts; botryoidal crusts in fracture cavities; stalactitic bottoms on cavity walls (rare); microcrystalline pseudomorphs after apatite (Lynch Station occurrence)

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 0 – 80°C (a strict supergene / low-T meteoric mineral)
- **Optimal growth temperature:**
  - Surface to shallow oxidation zone: 15 – 40°C
  - Slightly warmer hot-spring–altered: up to 60°C (rare)
- **Decomposition temperature:** Dehydration begins around 200 – 250°C (loses zeolitic water → green color shift). Full breakdown to a Cu-Al-phosphate + Cu-oxide assemblage above ~400°C.
- **Temperature-dependent habits:** Habit is overwhelmingly determined by space and supersaturation, not T. Higher T (warm meteoric) → coarser microcrystalline botryoidal. Lower T → finer cryptocrystalline / chalky.

#### Chemistry Required
- **Required elements in broth:** Cu (≥ 5 ppm), Al (high — the structural element, ≥ 3 ppm), P (the gating element for any phosphate, ≥ 1 ppm), water (turquoise is hydrated)
- **Optional/enhancing elements:**
  - Fe³⁺ → green color (Fe-rich → chalcosiderite)
  - Zn → faustite (Zn-Cu) end-member, yellow-green
  - PO₄³⁻ source is typically pre-existing apatite or guano in the host rock
- **Inhibiting elements:** High SO₄ (drives sulfate phosphates instead of pure phosphates), high Cl (drives chloride supergene Cu phases like atacamite). High Fe²⁺ in reducing groundwater → pyrite forms instead of releasing Cu.
- **Required pH range:** 6.0 – 8.5. Acidic groundwater (pH < 5) dissolves turquoise. Alkaline-carbonate groundwater (pH > 9) drives chrysocolla or malachite instead.
- **Required Eh range:** Oxidizing (Cu must be Cu²⁺, not Cu⁺). Eh > +200 mV.
- **Required O₂ range:** O₂ > 0.5 ppm (must be at the oxidation zone, not in reducing aquifer).

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Cu²⁺, Al³⁺, PO₄³⁻, OH⁻, H₂O. Mildly acidifies fluid (pH drop ~0.2 — phosphate uptake releases H⁺ from solution).
- **Byproducts of dissolution:** Releases Cu²⁺ + Al³⁺ + PO₄³⁻ back to fluid. Dehydration above ~250°C releases water but holds the rest.

#### Growth Characteristics
- **Relative growth rate:** Very slow. Massive turquoise is the integrated product of small precipitations over geological time as supergene fluids cycle through fractured Cu-bearing rock.
- **Maximum crystal size:** Single triclinic crystals to ~2 mm (Lynch Station). Massive nodules to ~30 cm. The vast majority of turquoise is microcrystalline aggregate.
- **Typical crystal size in vugs:** 0.1 – 5 mm botryoidal coatings; 1 – 10 cm nodular massive; >10 cm specimens are rare and prized.
- **Does growth rate change with temperature?** Modestly — slightly faster near the warm end of its T window. Supersaturation (fluid evaporation) is a more important driver.
- **Competes with:**
  - **Chrysocolla** (CuSiO₃·nH₂O — already in game) — wins when SiO₂ is high and P is low. Sister supergene Cu mineral that takes over in silica-rich settings.
  - **Malachite / azurite** (already in game) — wins when CO₃ is high (carbonate-rich groundwater)
  - **Atacamite** (in the brief — to be added) — wins when Cl is high (arid coastal / saline groundwater)
  - **Chalcosiderite** (Fe-end-member of turquoise group) — wins when Fe ≫ Al
  - **Apatite** (in the brief — to be added) — the precursor; if Ca is also abundant, Ca₅(PO₄)₃X locks the phosphate before turquoise can form

#### Stability
- **Breaks down in heat?** Yes — irreversible greening above ~200°C as zeolitic water leaves. Full breakdown above ~400°C.
- **Breaks down in light?** Sun-exposure and dehydration over years of museum display will dull and green a specimen. This is well-known to collectors and conservators (turquoise rings worn against skin pick up oils and skin chemistry, shifting color over months — the "personal turquoise" effect).
- **Dissolves in water?** Slow dissolution in pure neutral water. Acidic groundwater attacks rapidly.
- **Dissolves in acid?** Yes — readily in dilute HCl. The phosphate goes into solution; Cu²⁺ stains the acid blue.
- **Oxidizes?** No — Cu is already Cu²⁺ as required for the structure.
- **Dehydrates?** Yes — the diagnostic stability behavior. ~200°C onset, color shift from sky-blue to green to chalky white.
- **Radiation sensitivity:** Not significant.

### Paragenesis
- **Forms AFTER:** Pyrite + chalcopyrite + apatite oxidation in the unsaturated zone of arid Cu-porphyry deposits. The full chain: chalcopyrite + pyrite + meteoric O₂ → Cu²⁺ + Fe³⁺ + SO₄ + acid → leaches host apatite → Cu²⁺ + Al³⁺ (from clay) + PO₄³⁻ + OH⁻ → turquoise precipitates in fractures.
- **Forms BEFORE:** Often the latest oxidation-zone phosphate. Can be partly dissolved and replaced by chalcosiderite (more Fe), chrysocolla (more silica), or — at the surface — kaolinite + Cu-stain when fully weathered.
- **Commonly associated minerals:**
  - Supergene Cu suite: chrysocolla, malachite, azurite, native copper, cuprite, antlerite, brochantite
  - Host-rock alteration: kaolinite, alunite, jarosite, halloysite, sericite
  - Phosphate cousins: chalcosiderite, variscite, wavellite, planerite (rare)
  - Wall rock: quartz veinlets, limonite-stained sandstone or rhyolite breccia
- **Zone:** Supergene oxidation zone, specifically the upper unsaturated portion where O₂ is abundant and groundwater is meteoric and relatively alkaline. Below the water table (reducing zone) → no turquoise.
- **Geological environment:** Arid to semi-arid weathering of Cu-bearing porphyry, skarn, or vein systems where the host rock contains apatite or other phosphate. The Cordilleran western US (Nevada, Arizona, New Mexico, Colorado), the Iran/Sinai/Egypt arid belt, and parts of Tibet/China are the classic settings — humid climates leach Cu away before turquoise can form.

### Famous Localities
- **Classic locality 1:** Nishapur, Khorasan, Iran — the historical type aesthetic. Persian turquoise: pure sky-blue with minimal matrix, mined since at least 5000 BCE. The reference specimen for "perfect turquoise."
- **Classic locality 2:** Sleeping Beauty Mine, Globe-Miami district, Gila County, Arizona, USA — robin's-egg blue, virtually no matrix. Closed in 2012; existing material is collector-grade. Defines modern American "true blue" turquoise.
- **Classic locality 3:** Bisbee, Cochise County, Arizona, USA — deep blue with smoky matrix; "Bisbee Blue" is a named varietal alongside chrysocolla and malachite from the same Cu-porphyry pit.
- **Notable specimens:**
  - Lynch Station / Bishop Manganese Mine, Campbell County, Virginia — RARE actual triclinic crystals (to 2 mm), the only locality where turquoise grows as identifiable crystals rather than massive
  - Maghara, Sinai, Egypt — Mafkat ("turquoise") of the pharaohs; the original mining was Old Kingdom (~2600 BCE)
  - Cerrillos Hills, New Mexico — the Pueblo source for Pueblo + Anasazi jewelry
  - Lavender Pit, Bisbee — chrysocolla + turquoise + malachite + azurite intergrown specimens
  - Lone Mountain, Nevada — spider-web turquoise (matrix as decorative element)
  - Hubei province, China — major modern producer; matrix-rich "spider-web" varieties
  - Lookout Mountain Mine, Lander County, Nevada — chalcosiderite/turquoise solid solution

### Fluorescence
- **Fluorescent under UV?** Generally no. Some specimens show very weak greenish-yellow under LW from organic-matter contamination, but turquoise itself is non-fluorescent.
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None to very weak greenish (organic, not structural)
- **Phosphorescent?** No
- **Activator:** N/A — Cu²⁺ is a strong UV quencher
- **Quenched by:** Cu²⁺ itself (the chromophore is also the quencher)

### Flavor Text
> Turquoise is the supergene mineral that civilizations claim. From Mafkat in pharaonic Egypt to the Persian sky-blue of Nishapur, from Pueblo jewelry strung with Cerrillos Hills nuggets to Bisbee Blue cut into cabochons in modern Arizona, turquoise has been mined by every culture that lived near a copper-bearing rock and an arid climate. The chemistry is unromantic: pyrite and chalcopyrite weather to release Cu²⁺ and acid, the acid attacks apatite and clay in the host rock, and the resulting Cu-Al-phosphate brine percolates downward through fractures until it precipitates a hydrated phosphate as fracture-fill. The romance is in the color and the rarity of the conditions: too wet a climate and the Cu washes out before the phosphate can catch it; too cold and the meteoric chemistry never activates; too iron-rich and you get green chalcosiderite instead of robin's-egg blue. Turquoise crystallizes in the narrow window where copper, aluminum, phosphate, and aridity overlap, which turns out to be a small belt of the world's deserts. The mineral is also a witness — exposed for years it greens as it dehydrates, worn against skin it absorbs the chemistry of its wearer. A sky-blue cabochon is a moment of geology held briefly stable.

### Simulator Implementation Notes
- **New parameters needed:** None — Cu, Al, P, O₂ all in `FluidChemistry`. Hydrothermal scenarios that already carry Cu (porphyry, MVT, Bisbee) just need to add P (low ppm) and ensure O₂ is high in the supergene zone.
- **New events needed:** None. Could optionally add a `meteoric_acid_pulse` event for arid-supergene scenarios that drives a temporary pH drop + Cu²⁺ release; turquoise then nucleates as the pH recovers and PO₄ comes out of host apatite.
- **Nucleation rule pseudocode:**
```
IF Cu > 5 AND Al > 3 AND P > 1 AND pH > 6.0 AND pH < 8.5
   AND O2 > 0.5 AND T < 80°C → nucleate turquoise
  IF Fe > 50 → chalcosiderite (green) variant
  IF Zn > 50 → faustite variant (rare, yellow-green)
  IF SiO2 > 200 AND Cu > 5 → chrysocolla competes (down-weight turquoise)
  IF CO3 > 100 AND Cu > 5 → malachite competes (down-weight turquoise)
  IF Cl > 30 AND Cu > 5 → atacamite competes (down-weight turquoise)
```
- **Growth rule pseudocode:**
```
IF σ_turquoise > 1.2 AND space available → grow at rate 0.25 (slow, supergene)
  σ low + space available → botryoidal/reniform crust (default)
  σ high + space limited → microcrystalline pore-fill
  Fe/(Fe+Al) > 0.5 → green color shift (chalcosiderite-leaning)
  T trajectory crosses 200°C upward → dehydration, irreversible green
```
- **Habit selection logic:**
  - `botryoidal_crust` (default): smooth blue mammillary aggregates on cavity walls — wall_spread 0.85, void_reach 0.15, vector "coating"
  - `nodular_massive`: rounded blue lumps in fractured matrix — wall_spread 0.7, void_reach 0.3, vector "equant"
  - `veinlet_fill`: thin blue stringers along host-rock fractures (the dominant habit at most localities) — wall_spread 0.95, void_reach 0.05, vector "coating"
  - `spider_web`: matrix-rich variety where host-rock fragments are the visual matrix — wall_spread 0.9, void_reach 0.1, special render hint for matrix patterning
  - `triclinic_microcrystal`: rare, small tabular pseudo-rhombic crystals (Lynch Station style) — wall_spread 0.4, void_reach 0.5, probability < 0.05; flagged when σ low and growth slow
- **Decomposition products:** Above 200°C → green color shift (water loss); above 400°C → breakdown to Cu-aluminate + amorphous phosphate (rare in geological setting).

### Variants for Game
- **Variant 1: Sky-blue (Persian / Sleeping Beauty)** — the canonical robin's-egg blue, low Fe, well-hydrated. Default appearance.
- **Variant 2: Spider-web (Hubei / Lone Mountain)** — matrix host-rock veining gives black filigree through blue. Distinctive specimen aesthetic.
- **Variant 3: Green turquoise / chalcosiderite-leaning** — Fe³⁺ substitution shifts color toward apple-green. Common in eastern-US occurrences.
- **Variant 4: Triclinic microcrystal (Lynch Station)** — rare actual crystals, tabular pseudo-rhombic plates. Low-probability collector specimen — proves to the player that turquoise IS a mineral, not just a colored matrix.

### Supergroup Connection (Why This Mineral Matters)
Turquoise is the **type species of the turquoise group**, a family of hydrated copper-aluminum/iron phosphates that share the same triclinic structure: turquoise (Cu-Al), chalcosiderite (Cu-Fe³⁺), faustite (Zn-Al), planerite (water-poor). All form in the same supergene niche when the relative cation supply shifts. In the simulator, turquoise is the **arid Cu-supergene phosphate** that pairs with chrysocolla (silica), malachite/azurite (carbonate), and atacamite (chloride) to give the Cu oxidation zone a four-axis branching: silica → chrysocolla, carbonate → malachite, chloride → atacamite, **phosphate → turquoise**. The branching anchors a mechanic that already exists for sulfate (brochantite/antlerite) and gives the player a way to read the supergene fluid chemistry off the mineral that grew. Turquoise also requires Al, which most existing supergene minerals do not — so its nucleation is a signal that aluminum is mobile in the broth, opening future doors for wavellite, variscite, and planerite.

---

## Completed Species
- This file added by priority-three batch (turquoise, rutile, chrysoprase). Turquoise was not previously specced in any rounds proposal — research authored fresh from real-world mineralogy + the existing supergene-Cu pattern in the simulator.
