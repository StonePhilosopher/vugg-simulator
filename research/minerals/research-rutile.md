# Mineral Species Template — Vugg Simulator

## Species: Rutile

### Identity
- **Formula:** TiO₂ (titanium dioxide; tetragonal polymorph — anatase and brookite are the lower-T polymorphs)
- **Crystal system:** Tetragonal (4/m 2/m 2/m), space group P4₂/mnm
- **Mineral group:** Oxide (rutile group — also includes cassiterite SnO₂, pyrolusite MnO₂, plattnerite PbO₂)
- **Hardness (Mohs):** 6 – 6.5
- **Specific gravity:** 4.23
- **Cleavage:** {110} distinct, {100} less so
- **Fracture:** Conchoidal to uneven; brittle
- **Luster:** Adamantine to submetallic; needles often nearly metallic with red internal reflection

### Color & Appearance
- **Typical color:** Reddish brown, blood red, golden yellow, yellow-brown, black; strongly anisotropic (light vs. dark depending on viewing angle)
- **Color causes:** Fe³⁺ + Fe²⁺ charge transfer (red-brown — the default rutile color), Nb/Ta substitution (black "ilmenorutile/strüverite" varieties), Cr³⁺ (rare red), low-Fe / high-purity (yellow to honey)
- **Transparency:** Transparent to nearly opaque depending on Fe content; Fe-poor needles are gem-transparent ruby red
- **Streak:** Pale brown to pale yellow
- **Notable visual features:** Asterism in rutilated quartz (rutile needles inside quartz produce a 6-rayed star). Sagenitic webs (intersecting needles at 60°/120°). Geniculate "elbow/knee" twins. Reticulated sixling stars (cyclic twins). Adamantine luster on prism faces.

### Crystal Habits
- **Primary habit:** Slender prismatic to acicular crystals elongated parallel to c-axis, vertically striated
- **Common forms/faces:** {110} prism (dominant), {100} prism, {111} dipyramid (typical termination), {101} dipyramid; pinacoid {001} rare
- **Twin laws:**
  - **Geniculate / elbow twin** on {011} — diagnostic "knee" bend at ~115°. The most recognizable rutile habit.
  - **Cyclic sixling** — six-membered cyclic twin on {011} producing reticulated star, "reticulated rutile" or "sagenitic"
  - **Heart twin** — contact twin on {031}, less common
- **Varieties:**
  - **Sagenite** — needles forming a netted/woven web (often inside quartz or as overgrowth on hematite)
  - **Strüverite / ilmenorutile** — Nb,Ta-bearing, black, metallic
  - **Nigrine** — Fe-rich, black
  - **Rutilated quartz / Venus hair / Cupid's darts** — quartz with rutile inclusions (host mineral is quartz; rutile is included)
  - **Cabo cabo (sixling stars)** — Brazilian classic
- **Special morphologies:** Acicular needles in quartz (most common occurrence by mass); sagenitic webs; epitaxial overgrowth on hematite ("iron rose with rutile sun"); coarse prismatic alpine-cleft crystals

### Formation Conditions (SIMULATOR PARAMETERS)

#### Temperature
- **Nucleation temperature range:** 200 – 1000°C (very wide). Hydrothermal rutile starts ~200°C; metamorphic up to amphibolite/eclogite facies; magmatic up to liquidus
- **Optimal growth temperature:**
  - Alpine-cleft hydrothermal: 300 – 500°C (sharp prismatic crystals from low-grade metamorphic fluids)
  - High-grade metamorphic: 500 – 800°C (eclogite/granulite — rutile is the dominant Ti phase here)
  - Pegmatite / late magmatic: 400 – 700°C
  - Inclusion in quartz (post-cooling exsolution from Ti-bearing quartz): 300 – 500°C as the host re-equilibrates
- **Decomposition temperature:** No significant breakdown below melting (~1843°C). Rutile is the stable TiO₂ polymorph at all geologic conditions; anatase and brookite invert to rutile irreversibly above ~600 – 800°C.
- **Temperature-dependent habits:** High T (alpine-cleft) → coarse prismatic with sharp dipyramidal terminations. Moderate T → acicular needles. Low T → very fine needles (sagenitic web). Brookite/anatase compete only below ~600°C; above that, only rutile nucleates.

#### Chemistry Required
- **Required elements in broth:** Ti (the gating element — usually trace, must be enriched for rutile to nucleate)
- **Optional/enhancing elements:**
  - Fe (Fe³⁺ + Fe²⁺) → red/brown color (default), Fe-rich → black (nigrine)
  - Nb, Ta → strüverite/ilmenorutile (black, metallic) — not currently tracked in broth
  - V → V-bearing rutile, sometimes with vanadinite association
  - Cr → rare red-orange variety
- **Inhibiting elements:** SiO₂ in excess → Ti-bearing silicates (titanite CaTiSiO₅) win when Ca is also present. High Fe + Ti at low T → ilmenite (FeTiO₃) instead of rutile.
- **Required pH range:** Wide (4 – 10). Rutile is one of the most chemically inert minerals known.
- **Required Eh range:** Any. Ti⁴⁺ is the stable oxidation state in all natural fluids.
- **Required O₂ range:** Not critical. Forms in both reducing and oxidizing settings.

#### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Ti⁴⁺ from solution. Trivial pH change (Ti⁴⁺ hydrolysis is incorporated into the lattice).
- **Byproducts of dissolution:** Effectively non-soluble in geologic fluids. Only HF can attack rutile, and only slowly. No meaningful Ti release back to fluid except in extreme F-rich high-T fluids.

#### Growth Characteristics
- **Relative growth rate:** Slow. Ti supply is usually rate-limiting.
- **Maximum crystal size:** Up to ~30 cm prismatic crystals (alpine-cleft, Brazilian pegmatites). Inclusion needles inside quartz typically <5 mm but extend >20 cm in extreme rutilated-quartz specimens (the host is quartz; the rutile needle is the elongation).
- **Typical crystal size in vugs:** 1 – 30 mm acicular needles, 5 – 50 mm prismatic in alpine clefts
- **Does growth rate change with temperature?** Yes — higher T moves Ti more easily. Ti diffusion is the rate-limiting step.
- **Competes with:**
  - **Anatase** (TiO₂, tetragonal) — lower-T polymorph, < ~600°C in low-pressure environments. Anatase and brookite both exist in low-T alpine-cleft systems alongside rutile.
  - **Brookite** (TiO₂, orthorhombic) — moderate T, low pressure
  - **Titanite / sphene** (CaTiSiO₅) — wins when Ca and SiO₂ are both available
  - **Ilmenite** (FeTiO₃) — wins when Fe is high and Ti relatively low (magmatic, basaltic)
  - **Perovskite** (CaTiO₃) — rare alkaline / silica-undersaturated environments

#### Stability
- **Breaks down in heat?** No. Stable to very near melting.
- **Breaks down in light?** No.
- **Dissolves in water?** No (effectively insoluble across geologic conditions).
- **Dissolves in acid?** No common acid attacks rutile. HF + heat will, slowly.
- **Oxidizes?** No (Ti is already at maximum oxidation state).
- **Dehydrates?** No.
- **Radiation sensitivity:** Rutile can host radiogenic Pb (used in U-Pb geochronology) but the lattice is highly resistant to metamictization. Some Nb,Ta-rich varieties show metamictization at very high doses.

### Paragenesis
- **Forms AFTER:** Often follows or is contemporaneous with quartz in alpine-cleft assemblages. In metamorphic settings, follows ilmenite breakdown during prograde metamorphism (ilmenite + quartz → rutile + Fe-silicate as T rises into eclogite facies).
- **Forms BEFORE:** Becomes an inclusion phase in later-grown quartz (rutilated quartz). Persists as a heavy-mineral residual in placer deposits.
- **Commonly associated minerals:**
  - Alpine cleft: quartz, hematite (iron rose), adularia, chlorite, muscovite, brookite, anatase
  - Pegmatite: quartz, microcline, muscovite, tourmaline
  - Eclogite/granulite metamorphic: garnet, omphacite, kyanite, zoisite
  - Inclusions in: quartz (rutilated), kyanite, garnet, andalusite
- **Zone:** Hydrothermal vein (alpine cleft), pegmatitic, metamorphic (medium-to-high grade), residual placer
- **Geological environment:** Alpine-cleft fissure veins (metamorphic dewatering of greenschist–amphibolite); high-grade metamorphic Ti-rich protoliths (eclogites, blueschists, granulites); pegmatites carrying late Ti; detrital placer concentrate (chemically resistant — survives weathering).

### Famous Localities
- **Classic locality 1:** Graves Mountain, Lincoln County, Georgia, USA — coarse prismatic and sixling-twin rutile up to 8 cm in lazulite + pyrophyllite matrix
- **Classic locality 2:** Diamantina, Minas Gerais, Brazil — rutilated quartz par excellence (Cupid's darts, Venus hair); also coarse alpine-cleft-style rutile
- **Classic locality 3:** Cavradi / Binntal / Hot Springs / various Swiss + Italian alpine clefts — sharp prismatic needles on quartz/hematite (the iron-rose-with-rutile-sun aesthetic)
- **Notable specimens:**
  - Graves Mountain sixling-twin reticulated rutile (Cabo cabo style) — collector classic
  - Diamantina sagenitic quartz with rutile webs to 30 cm
  - Novo Horizonte, Bahia — golden rutile in rock crystal
  - Champion mine, California — pegmatite rutile + benitoite
  - Parigi/Italian Alps — strüverite (Nb,Ta-bearing black)

### Fluorescence
- **Fluorescent under UV?** No (Fe quenches; Ti⁴⁺ is not a UV activator)
- **SW (255nm) color:** None
- **MW (310nm) color:** None
- **LW (365nm) color:** None
- **Phosphorescent?** No
- **Activator:** N/A
- **Quenched by:** Fe (universal in natural rutile)

### Flavor Text
> Rutile is the mineral that inhabits other minerals. Most of what the world has seen of rutile is needles inside quartz — the so-called "Venus hair" and "Cupid's darts" of Brazilian rutilated quartz, where slender red-gold rods are frozen mid-trajectory through clear silica. As a free-standing crystal, rutile is rarer and stranger: blood-red prisms with adamantine luster, geniculate elbow twins that bend at improbable angles, and reticulated sixling stars that look like circuit diagrams cast in cinnabar. Titanium is the gate. The element is everywhere in trace amounts but only crystallizes its own oxide when geology concentrates it — alpine-cleft fissures dewatering greenschist, eclogite-facies rocks where ilmenite has broken down, and pegmatites that hoard Ti through fractional crystallization. Once formed, rutile refuses to leave: it is one of the most chemically resistant minerals known, riding through weathering, transport, and burial unchanged. The black sand on a beach is partly rutile; the placer that survived a hundred million years of erosion is partly rutile.

### Simulator Implementation Notes
- **New parameters needed:** None — Ti is already in `FluidChemistry`, default 0.5 ppm. Scenarios that want rutile bumps Ti to ≥30 ppm in the broth.
- **New events needed:** None. Could add a `ti_pulse` event for alpine-cleft scenarios where metamorphic dewatering injects Ti.
- **Nucleation rule pseudocode:**
```
IF Ti > 25 ppm AND T > 200°C → nucleate rutile
  IF SiO2 > 200 AND host_growing_quartz_present → nucleate AS QUARTZ INCLUSION (rutilated quartz habit)
  ELSE IF Ca > 20 AND SiO2 > 100 AND T < 700°C → titanite competes (down-weight rutile)
  ELSE IF Fe > 10 AND T > 600°C AND O2 < 0.5 → ilmenite competes
```
- **Growth rule pseudocode:**
```
IF σ_rutile > 1.0 AND Ti available → grow at rate 0.4 (slow — Ti diffusion limited)
  T > 500°C AND σ low → coarse prismatic with dipyramid termination
  T 300-500°C AND σ moderate → acicular needles with geniculate twin probability ~0.25
  T < 300°C AND σ high → fine sagenitic needles, sixling twin probability ~0.05
```
- **Habit selection logic:**
  - `acicular_needle` (default): low-T hydrothermal, slender vertically-striated prisms — wall_spread 0.15, void_reach 0.85
  - `stout_prismatic`: moderate T alpine-cleft style, well-formed dipyramidal terminations — wall_spread 0.3, void_reach 0.7
  - `geniculate_twin`: contact twin on {011} producing diagnostic elbow bend — wall_spread 0.25, void_reach 0.75, probability 0.25 when σ moderate and T 300-500°C
  - `sixling_star`: cyclic sixling on {011} producing reticulated star — wall_spread 0.4, void_reach 0.5, probability 0.05 when σ low and T moderate
  - `included_in_quartz`: when host quartz is growing simultaneously, rutile crystals nucleate INSIDE quartz crystals — flagged via Crystal.included_in field; renderer treats as host-attached needles. Habit pattern that demonstrates the existing inclusion system.
- **Decomposition products:** None. Rutile is effectively a permanent phase once formed.

### Variants for Game
- **Variant 1: Alpine-cleft prismatic** — sharp red-brown prisms, dipyramidal terminations, often with hematite "iron rose" + quartz. The collector's classic.
- **Variant 2: Sagenitic / rutilated quartz** — fine needles enclosed in growing quartz crystal. The most iconic rutile occurrence and a use case for the inclusion system.
- **Variant 3: Geniculate twin** — bent "elbow" or "knee" crystal — instantly recognizable as rutile. Should fire when σ is moderate and T moves through the 300-500°C window. 
- **Variant 4: Reticulated sixling** — the rare cyclic twin star, "Cabo cabo" Brazilian style. Low probability, distinctive appearance, prized specimen.

### Supergroup Connection (Why This Mineral Matters)
Rutile is the **structural archetype** of the rutile group — a tetragonal AO₂ lattice that also accommodates cassiterite (SnO₂), pyrolusite (MnO₂), and plattnerite (PbO₂). All four are dense oxides of small high-valence cations. In the simulator, rutile is the **first Ti consumer** and demonstrates the inclusion mechanic: rutile-in-quartz is the canonical rutilated-quartz pattern that other inclusion minerals (rutile-in-garnet, rutile-in-kyanite) can later reuse. Once present, rutile pseudo-permanently locks Ti out of the broth, just as pyrite locks Fe + S — its extreme insolubility is the geological signal.

---

## Completed Species
- This file added by priority-three batch (turquoise, rutile, chrysoprase) — see `proposals/MINERALS-ROUNDS-3-6.md` §5b for the implementation brief that originally specced rutile.
