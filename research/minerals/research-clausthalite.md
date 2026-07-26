# Species: Clausthalite

## Identity
- **Formula:** PbSe
- **Crystal system:** Isometric (cubic)
- **Mineral group:** Selenide — Galena group (isometric, NaCl-type structure)
- **Hardness (Mohs):** 2.5
- **Specific gravity:** 7.6–8.8 (very heavy — lead + selenium)
- **Cleavage:** Perfect cubic {001}, {010}, {100} — identical to galena
- **Fracture:** Granular to subconchoidal
- **Luster:** Metallic

## Color & Appearance
- **Typical color:** Bluish gray to lead-gray
- **Color causes:** Intrinsic metallic bonding
- **Transparency:** Opaque
- **Streak:** Grayish black
- **Notable visual features:** Nearly indistinguishable from galena (PbS) in hand specimen. Same cubic cleavage, same metallic luster, same lead-gray color. Only distinguished by density (slightly heavier), microprobe, or XRD. Can show granular to botryoidal surfaces.

## Crystal Habits
- **Primary habit:** Massive, granular, fine-grained aggregates
- **Common forms/faces:** Rare euhedral cubic crystals; {100} faces when present
- **Twin laws:** None significant
- **Varieties:** None named; forms complete solid solution with galena (PbS) above 300°C, and with altaite (PbTe) above 500°C
- **Special morphologies:** Botryoidal crusts (some occurrences), foliated masses

## Formation Conditions (SIMULATOR PARAMETERS)

### Temperature
- **Nucleation temperature range:** 80–350°C (epithermal to mesothermal)
- **Optimal growth temperature:** 100–250°C
- **Decomposition temperature:** ~1065°C (melting)
- **Temperature-dependent habits:** Above 300°C: complete solid solution with galena (PbS-PbSe continuous). Below 300°C: miscibility gap opens — PbSe and PbS unmix into separate phases. Below 100°C: PbS-PbSe separation essentially complete. This means high-T clausthalite/galena solid solutions exsolve on cooling.

### Chemistry Required
- **Required elements in broth:** Pb²⁺, Se²⁻
- **Optional/enhancing elements:** Ag (naumannite co-precipitation), Hg (tiemannite HgSe), Cu (klockmannite Cu₂Se), Au (associated with selenide-type gold deposits)
- **Inhibiting elements:** High S²⁻ — sulfur outcompetes selenium for lead, forming galena (PbS) instead. Same competition as all selenides.
- **Required pH range:** Near-neutral to slightly alkaline (5–8)
- **Required Eh range:** Reducing — Se must be as Se²⁻, not oxidized
- **Required O₂ range:** Low

### Secondary Chemistry Release
- **Byproducts of nucleation:** Consumes Pb and Se from fluid
- **Byproducts of dissolution:** Pb²⁺ and SeO₃²⁻ (selenite) released

### Growth Characteristics
- **Relative growth rate:** Slow — selenium is a trace element
- **Maximum crystal size:** Rarely >1 cm; usually microscopic disseminations
- **Typical crystal size in vugs:** 0.01–3 mm grains
- **Does growth rate change with temperature?** Limited by Se supply
- **Competes with:** Galena (PbS — dominant if S present, same structure, wins the Pb), cerussite (PbCO₃ — oxidation product), anglesite (PbSO₄ — oxidation product)

### Stability
- **Breaks down in heat?** No phase transition; melts ~1065°C. Solid solution exsolution with galena on cooling below 300°C.
- **Breaks down in light?** No
- **Dissolves in water?** Insoluble
- **Dissolves in acid?** Dissolves in HNO₃; selenium liberated
- **Oxidizes?** Slowly — Pb²⁺ can form cerussite/anglesite, Se oxidizes to selenite
- **Dehydrates?** N/A
- **Radiation sensitivity:** No

## Paragenesis
- **Forms AFTER:** Primary sulfides (especially galena, which forms first if S present)
- **Forms BEFORE:** Oxidation-zone minerals (cerussite, anglesite, selenite minerals)
- **Commonly associated minerals:** Tied to selenide assemblages: tiemannite (HgSe), klockmannite (Cu₂Se), berzelianite (Cu₂₋ₓSe), umangite (Cu₃Se₂), naumannite (Ag₂Se), gold, stibiopalladinite, uraninite. Also galena (when both S and Se present, they coexist below 300°C as exsolved phases).
- **Zone:** Primary/hypogene — low-sulfur hydrothermal deposits, mercury deposits, uranium deposits
- **Geological environment:** Low-sulfur hydrothermal veins, mercury deposits, some sandstone-type uranium deposits, oxidized selenide zones

## Famous Localities
- **Classic locality 1:** Clausthal-Zellerfeld, Harz Mountains, Germany — TYPE LOCALITY (1832). Named for the town. Low-sulfur hydrothermal veins with selenide assemblage.
- **Classic locality 2:** Příbram, Czech Republic — Uranium-selenide deposit with clausthalite + tiemannite + berzelianite
- **Classic locality 3:** Pakajake, Bolivia — Selenide-bearing epithermal veins
- **Notable specimens:** Olympic Dam, South Australia — nanoscale clausthalite symplectites in Cu-Au-U ore, demonstrating remobilization during later thermal events

## Fluorescence
- **Fluorescent under UV?** No (metallic, opaque)

## Flavor Text

> Clausthalite is galena's evil twin — same cubic symmetry, same perfect cleavage, same lead-gray swagger, but with selenium where sulfur should be. In the hand they're identical. Under the probe they're worlds apart. It crystallizes in the sulfur-starved backwaters of hydrothermal systems, where selenium somehow won the geochemical lottery. Above 300°C it dissolves completely into galena, the two indistinguishable, one mineral. Cool it down and they divorce — exsolve into separate phases, galena and clausthalite, living side by side but no longer one. A mineral that is and isn't galena, depending on the temperature of its birth and the patience of its cooling.

## Simulator Implementation Notes
- **New parameters needed:** trace_Se (shared with naumannite)
- **New events needed:** `event_selenium_pulse` (shared with naumannite)
- **Nucleation rule pseudocode:**
```
IF temp < 350 AND temp > 80 AND trace_Pb > threshold AND trace_Se > threshold AND trace_S < (trace_Se * 2) → nucleate clausthalite
PRIORITY: galena nucleates first if S available; clausthalite only if Se > S for Pb
```
- **Growth rule pseudocode:**
```
IF trace_Pb > 0 AND trace_Se > 0 AND trace_S < (trace_Se * 2) → grow at rate * min(trace_Pb, trace_Se) * 1.5
RATE = slow (Se-limited)
```
- **Habit selection logic:**
```
Always cubic/isometric habit
IF formed > 300°C AND trace_S > 0 → solid solution with galena; exsolve on cooling
IF formed < 300°C → separate clausthalite phase from start
```
- **Decomposition products:** Pb²⁺ to fluid (→ cerussite/anglesite in oxidation), Se²⁻ → SeO₃²⁻ (selenite)

### Solid Solution Behavior (Special Mechanic)
```
IF temp > 300 AND trace_Pb > 0 AND trace_S > 0 AND trace_Se > 0:
  → Form (Pb,S)(Pb,Se) solid solution
  ON COOLING below 300°C:
  → Exsolve into separate galena + clausthalite intergrowths
  → Texture flag: "exsolution lamellae"
```
This is a unique game mechanic — one mineral that becomes two on cooling.

## Variants for Game
- **Variant 1:** Pure clausthalite — formed from Se-only, no S present. Clean cubic crystals.
- **Variant 2:** Exsolved clausthalite — cooled from galena-clausthalite solid solution above 300°C. Shows exsolution lamellae (myrmekitic intergrowth with galena). Rare and interesting texture.
- **Variant 3:** Botryoidal clausthalite — massive botryoidal crusts. Some Harz Mountain specimens show this habit. Lower crystal quality, larger mass.

## Paragenetic Sequence Note
See research-hessite.md for full sequence. Clausthalite is the lead member of the selenide-telluride family. In a single cooling hydrothermal pulse:
1. Sulfides nucleate first (pyrite, galena if S present)
2. As fluids cool and S depletes, Se and Te begin to form their minerals
3. Pb + Se → clausthalite (if Se available)
4. Ag + Te → hessite (if Te available)
5. Ag + Se → naumannite (if Se available and Ag not consumed by acanthite)
6. The S:Se:Te ratio and the Pb:Ag:Cu ratio determine the assemblage

All three minerals are slow-growing, trace-element limited, late-stage crystallizers. They are the dessert course of the hydrothermal system.
