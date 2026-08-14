# Mineral Species Template — Vugg Simulator

## Species: Chrysoprase

### Identity
- **Formula:** SiO₂ (chalcedony — microcrystalline-fibrous quartz) with Ni²⁺ as the chromophore. Modern crystallographic work (Sachanbiński et al. 2001; Witkowski 2007) shows the green color comes from nanoparticulate inclusions of Ni-bearing phyllosilicates — pimelite, willemseite, kerolite (Ni-talc) — embedded in the chalcedony fabric, not from Ni³⁺ in the SiO₂ lattice. Bulk Ni typically 0.4 – 4 wt% NiO.
- **Crystal system:** Trigonal (host quartz, α-quartz; chalcedony is microcrystalline-fibrous aggregate of quartz)
- **Mineral group:** Silicate (silica group — chalcedony variety; sister to agate, carnelian, jasper, onyx, sard, mtorolite)
- **Hardness (Mohs):** 6.5 – 7 (slightly softer than crystalline quartz due to porosity from microfibrous fabric)
- **Specific gravity:** 2.55 – 2.65
- **Cleavage:** None (chalcedony fabric)
- **Fracture:** Conchoidal, takes a high polish — the property that makes it gem-grade
- **Luster:** Waxy to vitreous; highest-quality material is translucent with an almost gel-like depth

### Color & Appearance
- **Typical color:** Apple-green to bright spring-green to deep emerald-green depending on Ni content; lower-Ni material is yellow-green; oxidized/altered material is olive to brown-green
- **Color causes:** Nano-inclusions of Ni-phyllosilicate (pimelite/willemseite/kerolite) within the chalcedony — Ni²⁺ in 6-coordinate sites of the inclusion clay. The chalcedony itself is colorless silica. This is a composite color, not a lattice color, which is why heat and sunlight can fade chrysoprase (the Ni-clay nanoparticles destabilize) where they cannot fade amethyst.
- **Transparency:** Translucent (gem-grade) to opaque (commercial grade)
- **Streak:** White
- **Notable visual features:** Soft porcellanous translucency. Sometimes shows faint banding (chalcedony fabric inherits flow textures from gel-deposition). Rarely intergrown with white opal, magnesite, or unaltered serpentinite host fragments. The very best Marlborough material has a uniform "Granny Smith apple" green that is unique among gemstones.

### Crystal Habits
- **Primary habit:** Massive cryptocrystalline / microfibrous chalcedony — vein-fillings, cavity-fillings, nodules in altered ultramafic rock
- **Common forms/faces:** None — no macroscopic crystal faces. SEM shows chalcedony is fibrous quartz with fibers ~50–500 nm wide growing perpendicular to the fluid front.
- **Twin laws:** None at the macroscopic scale. Internal Brazil-law twinning is present in individual fibers but invisible.
- **Varieties:**
  - **Marlborough green** — Queensland, Australia. Apple-green, uniform, gem-grade. The current world reference.
  - **Szklary green** — Lower Silesia, Poland. Historical type locality; 14th-century mining; deeper, more saturated green; supplied much of European Renaissance + Baroque chrysoprase.
  - **Tulare County / California green** — Tulare, Fresno counties; pale to medium green; a US classic.
  - **Niquelândia / Goiás green** — Brazilian Ni-laterite, modern producer.
  - **Mtorolite / chrome-chalcedony** — sister stone, Cr-green not Ni-green, looks visually similar but is a different chromophore (Cr³⁺); from Mtoroshanga, Zimbabwe. NOT chrysoprase.
  - **Prase** — generic green chalcedony, often actinolite or chlorite-included; lower quality and chromatically muted.
- **Special morphologies:** Massive vein-fillings up to ~30 cm thick in serpentinite fractures; nodular concretions in saprolite (weathered ultramafic regolith); thin coatings on host fracture walls; rare botryoidal exteriors

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 0 – 80°C (strict supergene / low-T meteoric)
- **Optimal growth temperature:** 15 – 50°C — surface to shallow groundwater of weathering ultramafic / serpentinite terrain
- **Decomposition temperature:** Ni-bearing inclusions destabilize above ~150°C → color fades to white/yellow-brown. Pure chalcedony lattice is stable to ~870°C (α→β quartz transition); chrysoprase as a green stone is gone long before then.
- **Temperature-dependent habits:** None significant — habit is determined by space and silica supply.

#### Chemistry Required
- **Required elements in broth:** SiO₂ (high — must be at chalcedony-saturation, ≥ 100 ppm), Ni (≥ 50 ppm — the gating element; comes from weathering of olivine + serpentinite), Mg (cogenetic with Ni in ultramafic protolith)
- **Optional/enhancing elements:**
  - Cr → would shift toward mtorolite (chrome-chalcedony) — note: this is a different mineral, listed as a separate variant
  - Fe → muddies the green toward olive (oxide staining)
- **Inhibiting elements:** High Ca → magnesite/dolomite/calcite take CO₃ ahead of any silica precipitation. High Al → opal-CT or kaolinite forms instead (Al-bearing silica). High Cu → would form Cu-silicates (chrysocolla) instead, but Cu is essentially absent from ultramafic protoliths so this is rarely a competition.
- **Required pH range:** 7.5 – 9.5 (mildly alkaline — typical of serpentinite groundwater after Mg²⁺ and OH⁻ leaching). Below pH 7 SiO₂ stays in solution; above pH 10 Ni-clay takes the Ni instead of chalcedony.
- **Required Eh range:** Oxidizing (Eh > +100 mV) — needed to weather the ultramafic protolith and mobilize Ni²⁺ as a soluble cation.
- **Required O₂ range:** O₂ > 0.5 ppm.

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes SiO₂ + (Ni embedded as nano-inclusions). Weak acidification (~0.1 pH unit) from hydroxyl release as Si-OH polymerizes.
- **Byproducts of dissolution:** Releases SiO₂ + Ni²⁺ + Mg²⁺. Dissolution is very slow even in alkaline water; chrysoprase is geologically robust unless heated or sun-exposed.

#### Growth Characteristics
- **Relative growth rate:** Slow. Chalcedony deposition from gel is rate-limited by silica supersaturation cycles, not by chemistry.
- **Maximum crystal size:** No discrete crystals. Massive vein-fillings up to 30+ cm thickness; nodules to 20 cm; thin (<1 cm) crusts on fracture walls are most common.
- **Typical crystal size in vugs:** Massive vein-fill 1 – 30 cm; nodular pods 2 – 15 cm.
- **Does growth rate change with temperature?** Slightly faster at the warm end of supergene range; sensitive to fluid evaporation cycles which drive supersaturation pulses.
- **Competes with:**
  - **Quartz** (already in game) — wins above ~80°C and at lower silica supersaturation. Quartz forms discrete prisms in vugs; chalcedony forms when silica is dumped fast and cool from gel.
  - **Opal** (not in game) — wins at the lowest temperatures and very fast deposition (opal-A → opal-CT → chalcedony series with age + diagenesis).
  - **Magnesite + dolomite** — wins for the carbonate share of the fluid; chrysoprase forms in the silica-rich pulses between carbonate phases.
  - **Pimelite / Ni-clay** — wins when silica supply is low and Ni stays as clay rather than nano-inclusion in silica.
  - **Mtorolite** — chrome-chalcedony, alternate Ni→Cr substrate (different protolith).

#### Stability
- **Breaks down in heat?** Yes — the Ni-inclusion nanostructure breaks down above ~150°C, color fades irreversibly. Heat-treatment is sometimes used cosmetically but generally damages chrysoprase.
- **Breaks down in light?** Yes, slowly. Long sun-exposure in arid climates fades the green over decades. Museum + dealer practice is to keep chrysoprase out of direct light.
- **Dissolves in water?** Slow dissolution in alkaline water; effectively stable in cool neutral groundwater.
- **Dissolves in acid?** Slow; HF is the only acid that meaningfully attacks chalcedony.
- **Oxidizes?** No.
- **Dehydrates?** Weak — chalcedony retains a few percent of water in micro-pores and along fiber boundaries; loss is gradual over geological time.
- **Radiation sensitivity:** Not significant.

### Paragenesis
- **Forms AFTER:** Olivine + serpentinite weathering. The full chain: olivine + meteoric water + CO₂ → serpentine + Mg²⁺ + Ni²⁺ + Si(OH)₄. As the weathering profile matures, Ni concentrates in laterite + saprolite zones; silica reprecipitates from mature ultra-alkaline groundwater into fractures as chalcedony, scavenging Ni as nano-inclusion.
- **Forms BEFORE:** Persists indefinitely once formed unless heated or sun-faded. In a continued weathering cycle, can be stripped and replaced by Ni-bearing clay (pimelite/garnierite) when silica supply drops.
- **Commonly associated minerals:**
  - Ultramafic weathering zone: serpentine (antigorite, lizardite), magnesite, hydromagnesite, opal, talc, brucite
  - Ni-laterite ore: pimelite, garnierite, willemseite, falcondoite
  - Country rock: dunite, harzburgite, peridotite (fresh ultramafic), serpentinite (altered)
  - Cogenetic species in the same vein: chalcedony (white), opal, magnesite veins
- **Zone:** Surface to ~50 m depth in weathered ultramafic regolith. Strictly supergene.
- **Geological environment:** Ni-laterite weathering profiles on dunite/peridotite/serpentinite host rock, in tropical-to-temperate climates with seasonal rainfall (full tropical = leaches everything; full arid = no fluid). The classic settings are old continental shield ultramafics that have weathered for tens of millions of years (Australian Marlborough, Polish Szklary, Brazilian Niquelândia) — modern volcanic ultramafics are too young.

### Famous Localities
- **Classic locality 1:** Szklary, Lower Silesia, Poland — historical type locality. Mined since the 14th century; supplied Holy Roman Empire, Baroque court jewelry, and the chrysoprase columns of the Chapel of St. Wenceslaus in Prague Cathedral (which are the largest chrysoprase decorative pieces in the world).
- **Classic locality 2:** Marlborough, Queensland, Australia — modern world reference. Apple-green, uniform, gem-grade; the working mine that supplies most current high-quality chrysoprase.
- **Classic locality 3:** Niquelândia + Goiás, Brazil — major modern producer; lower Ni than Marlborough so colors range to yellow-green.
- **Notable specimens:**
  - Tulare County, California — historical US source; specimens in Smithsonian + Harvard collections
  - Frederick County, Maryland — small but historically interesting US locality
  - Yerilla, Western Australia — secondary Australian producer
  - Sarykul Boldy, Kazakhstan — Soviet-era source
  - Khaneshin, Afghanistan — recent producer
  - Chapel of St. Wenceslaus, Prague Castle — wall panels of Szklary chrysoprase, ~1370 CE; the largest single-locality decorative deployment

### Fluorescence
- **Fluorescent under UV?** No
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A — Ni²⁺ is a d⁸ cation that is a strong UV/visible quencher
- **Quenched by:** Ni²⁺ itself

### Flavor Text
> Chrysoprase is the green that geology grows when an ultramafic rock spends fifty million years weathering. Olivine breaks down to serpentine; serpentine releases Mg²⁺ and Ni²⁺ to slow alkaline groundwater; the groundwater dumps silica into fractures during seasonal pulses; the silica precipitates as fibrous chalcedony and traps Ni as nano-inclusions of Ni-talc inside it. The result is an apple-green stone that is structurally identical to quartz but chromatically unique — no other gemstone is colored by nanoparticulate inclusions of one mineral inside fibers of another. Pliny the Elder wrote of it; the workshops of Krakow cut it into baroque cabochons; the chapel of St. Wenceslaus in Prague Castle has walls of it from the Szklary mines. Modern Australian Marlborough chrysoprase is its current center of gravity, but the chemistry that produces it is rare on Earth: ultramafic protolith, deep weathering, alkaline groundwater, supergene silica supply. Most planets that aren't this one have no chrysoprase. Heat fades it; sunlight slowly fades it; the green is fragile in a way that lattice-color gems like emerald and amethyst are not. The mineral is a temporary witness to a slow, specific weathering history — the moment a continent stood still long enough for olivine to become apple-green silica.

### Simulator Implementation Notes
- **New parameters needed:** None — SiO₂, Ni, Mg, O₂ all in `FluidChemistry`.
- **New events needed:** None. Could optionally add a `lateritic_weathering` event for ultramafic-host scenarios that delivers a Ni + Mg pulse with high silica activity.
- **Nucleation rule pseudocode:**
```
IF SiO2 > 100 AND Ni > 50 AND Mg > 50 AND pH > 7.5 AND pH < 9.5
   AND O2 > 0.5 AND T < 80°C → nucleate chrysoprase
  IF Cr > 30 → mtorolite (chrome-chalcedony) variant — this is a different mineral, flag separately
  IF Ni < 20 → plain chalcedony (white/gray) — no green
  IF SiO2 > 200 AND T > 80°C AND Ni high → quartz crystals scavenge Si first; chrysoprase loses
```
- **Growth rule pseudocode:**
```
IF σ_chrysoprase > 1.0 AND space available → grow at rate 0.2 (slow, supergene chalcedony)
  Default → vein-fill / coating habit (chalcedony fabric, no discrete crystals)
  Ni concentration determines color saturation (Ni > 200 → deep apple green; Ni 50-200 → spring green; Ni < 50 → pale)
  T trajectory crosses 150°C upward → color fades irreversibly to white/yellow-brown
```
- **Habit selection logic:**
  - `chalcedony_vein` (default): fracture-fill in serpentinite host — wall_spread 0.95, void_reach 0.05, vector "coating"
  - `nodular_massive`: rounded apple-green nodules in saprolite matrix — wall_spread 0.7, void_reach 0.3, vector "equant"
  - `botryoidal_crust`: rare — botryoidal exterior on a vein-fill — wall_spread 0.85, void_reach 0.15, vector "coating", probability 0.1
  - `banded_chalcedony`: faint internal banding from flow-deposition cycles — visual variant of `chalcedony_vein`
- **Decomposition products:** Above 150°C, color fades (Ni nano-inclusions break down) but lattice persists. Above 870°C → β-quartz transition, then melt at 1713°C.

### Variants for Game
- **Variant 1: Apple-green Marlborough** — uniform bright spring-green, gem grade, the canonical aesthetic. Default appearance when Ni is in the 100 – 500 ppm range.
- **Variant 2: Yellow-green / pale chrysoprase** — lower Ni, less saturated. Common at lower-grade localities (Tulare, Goiás).
- **Variant 3: Deep emerald Szklary** — historical aesthetic; very Ni-rich (>500 ppm) with unusually deep green. Rare specimen.
- **Variant 4: Faded / heat-altered** — color-fade variant when temperature trajectory crossed 150°C. Cosmetic flag — same chemistry, white/yellow appearance. Useful for narrating "this specimen was buried too deep too long."

### Supergroup Connection (Why This Mineral Matters)
Chrysoprase is the **green chalcedony variety of the silica family** and the simulator's first chalcedony habit. The silica family in nature has macroscopic crystalline forms (quartz prisms — already in game) and microcrystalline-fibrous chalcedony forms (agate, carnelian, jasper, sard, onyx, prase, mtorolite, chrysoprase). Chalcedony as a habit is missing from the existing quartz entry — chrysoprase introduces it cleanly because Ni gates its uniqueness. Once the chalcedony habit exists, the simulator gains the substrate for adding agate (banded chalcedony), carnelian (Fe³⁺-red), and onyx (Fe³⁺-black/white-banded) as future variants without re-architecting silica chemistry. Chrysoprase also pairs naturally with serpentine + magnesite (ultramafic supergene), which suggests a future ultramafic / Ni-laterite scenario — a category currently missing from the scenario inventory.

### Design Decision: Separate Entry vs. Quartz Variant
**Decision:** SEPARATE mineral entry. Rationale:
- Chalcedony is fundamentally a different macroscopic habit from prismatic quartz (no discrete crystals, fibrous fabric, vein-fill mode of occurrence). Treating it as a quartz color-rule like amethyst would lose this.
- Chrysoprase has a distinct Ni-gated geological niche (ultramafic supergene) — separate scenarios, separate parageneses, separate associated minerals.
- Real-world mineralogical practice: chrysoprase, agate, carnelian, jasper are catalogued as named varieties with their own provenances and aesthetic traits, not as quartz colors.
- Precedent in the game: selenite is a separate mineral from gypsum despite being structurally identical, because their habit profiles diverge enough that one engine cannot serve both.
- Future doors: a `chrysoprase` entry establishes the chalcedony habit family; agate/carnelian/onyx can be added as siblings without forcing re-architecture of the quartz entry.

---

## Completed Species
- This file added by priority-three batch (turquoise, rutile, chrysoprase). Chrysoprase research authored fresh from real-world mineralogy + the existing supergene + ultramafic-laterite literature.
