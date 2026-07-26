# Research: Aluminum Minerals for the Vugg Simulator

**Date:** 2026-04-02
**Purpose:** Identify which aluminum-bearing minerals could be added to the Vugg Simulator now that Al is in the broth, what conditions they need, what new game mechanics they'd introduce, and what new broth elements (if any) they'd require.

---

## Current State

**Existing minerals (14):** quartz, calcite, sphalerite, fluorite, pyrite, chalcopyrite, hematite, malachite, uraninite, galena, smithsonite, wulfenite, selenite, feldspar (with 5 polymorphs: sanidine/orthoclase/microcline/albite + amazonite)

**Existing broth elements:** SiO2, Ca, Fe, Mn, Zn, S, F, Al, Ti, Pb, Cu, Mo, K, Na, O2 (oxygen fugacity)

**Feldspar already uses Al** — Al + K + Si → K-feldspar polymorphs, Al + Na + Si → albite. So the aluminum pathway is established. The question is: what ELSE can Al do?

---

## Tier 1: Ready to Build (no new elements needed)

These minerals can form from elements already in the broth.

### 1. Muscovite (mica) — KAl₂(AlSi₃O₁₀)(OH)₂
**Needs:** K + Al + SiO2 (all present)
**Conditions:** 300-600°C hydrothermal to pegmatitic. Forms in peraluminous environments (excess Al beyond what feldspar can absorb). Classic pegmatite pocket mineral.
**Game mechanic — SHEET SILICATE:** First non-framework, non-chain silicate in the game. Grows as flat hexagonal books. Perfect basal cleavage — splits into transparent sheets. In real pegmatites, muscovite books can be enormous (meters across in some Indian pegmatites). Could grow as lining on vug walls before other minerals nucleate on top of it.
**Color:** Silvery-white to pale gold (Fe substitution → greenish "fuchsite" if Cr present, but we don't have Cr). With Fe: slightly green/brown tint.
**Why it's interesting for the game:**
- **Substrate mineral** — other crystals grow ON muscovite books. Creates layered vug architecture.
- **Competes with feldspar** for K and Al — if muscovite nucleates first, less K available for K-feldspar. The player's temperature/chemistry choices determine which gets priority.
- **Al:Si ratio matters** — muscovite needs MORE Al per Si than feldspar does (peraluminous). High Al broth → mica. Moderate Al → feldspar. The Al slider becomes a branching decision.
- **Temperature zoning** — muscovite forms across a wide range but especially 400-550°C. Below feldspar's sanidine range, overlapping with orthoclase/microcline.
- **Alteration product** — feldspar weathers to muscovite (sericite). If the game has acid weathering events, feldspars could partially convert to fine-grained mica, which is geologically real and creates a beautiful cycle: feldspar → sericite → new mineral growth on the mica surface.

### 2. Garnet (grossular) — Ca₃Al₂(SiO₄)₃
**Needs:** Ca + Al + SiO2 (all present)
**Conditions:** 350-490°C+ hydrothermal (skarn/contact metamorphism). Grossular is the Ca-Al garnet, the one most commonly found in vugs. Classic skarn mineral. Also found in hydrothermal veins.
**Game mechanic — CUBIC NESOSILICATE:** First isolated-tetrahedra silicate. Isometric crystal system — forms dodecahedra and trapezohedra. No cleavage (unusual for a silicate). Very hard (6.5-7.5).
**Color:** Pure grossular is colorless. With Fe → brownish (hessonite/"cinnamon stone"). With Cr → green (tsavorite, one of the most valuable garnets). With Mn → orange-pink (spessartine, but that's a different garnet end-member requiring Mn instead of Ca).
**Why it's interesting for the game:**
- **Competes with calcite for Ca** — garnet locks up Ca in a silicate that won't dissolve in acid the way calcite does. Strategic choice: let Ca make calcite (fragile, dissolves) or garnet (permanent, hard, valuable).
- **Skarn scenario potential** — a new scenario where a carbonate vug gets intruded by silica-rich fluid. Calcite dissolves, garnet/diopside replace it. Contact metamorphism as gameplay.
- **Growth zoning** — garnets are famous for recording their growth history in concentric composition zones. Fe/Mn/Ca ratios vary from core to rim. Each zone is a snapshot of the fluid at that moment. The Record Groove would love this — the garnet IS a groove.
- **No cleavage** — survives everything. Once garnet forms, it persists. Anti-calcite. The tank of the mineral world.
- We could also do **spessartine** (Mn₃Al₂(SiO₄)₃) since we have Mn in the broth — orange garnets from Mn-rich fluids.
- And **almandine** (Fe₃Al₂(SiO₄)₃) since we have Fe — deep red garnets, the most common garnet species.
- **Three garnets from the same element set, differentiated by Ca/Mn/Fe ratio.** That's a rich decision space.

### 3. Corundum — Al₂O₃
**Needs:** Al only (must be silica-POOR environment)
**Conditions:** 400-600°C hydrothermal (synthetic ruby grown at these conditions), or contact metamorphism in marbles/plumasites. The key constraint: corundum CANNOT coexist with free quartz. If SiO2 is available, Al goes into aluminosilicates instead. Corundum forms only when Al is abundant and Si is depleted.
**Game mechanic — SILICA EXCLUSION:** This is the big one. Corundum is the anti-quartz. It forms precisely when and where quartz cannot. The player would need to either start in a silica-poor environment or DEPLETE silica by growing lots of quartz/feldspar first, creating a silica-exhausted residual fluid where corundum can precipitate.
**Color:** Pure = colorless (white sapphire). Cr trace → red (RUBY). Fe+Ti → blue (SAPPHIRE). Fe → yellow/green. 
**Why it's interesting for the game:**
- **Strategic silica depletion** — the only way to get corundum is to use UP your SiO2 first. Every quartz crystal you grew was eating corundum's future. But every quartz you DIDN'T grow was wasting the most abundant element. The tension is real.
- **Hardness 9** — second only to diamond. Once formed, nearly indestructible. The ultimate late-game crystal.
- **Ruby vs sapphire** — same mineral, different trace impurities. Cr (which we don't have yet) makes ruby. Fe+Ti (both present!) makes blue sapphire. We could have sapphire immediately, ruby with a Cr addition.
- **Geological reality** — Kashmir sapphires formed exactly this way: pegmatite met marble, silica was consumed by reactions with carbite, residual Al-rich fluid precipitated corundum in pockets. The game could model this.
- **The trophy crystal** — corundum should be rare, hard to get, and spectacular. It's the mineral that rewards understanding the system, not just pouring in elements.

### 4. Kyanite / Andalusite / Sillimanite — Al₂SiO₅ (polymorphs)
**Needs:** Al + SiO2 (both present)
**Conditions:** These are the classic Al₂SiO₅ polymorphs — same chemistry, three different structures controlled by temperature and pressure:
- **Andalusite:** low P, low-moderate T (below ~4 kbar, below ~500°C)
- **Kyanite:** high P, moderate T (above ~4 kbar, wide T range)  
- **Sillimanite:** high T, moderate P (above ~500°C at low P)
- **Triple point:** ~500°C, ~4 kbar (debated — estimates range from 3.8 to 6.5 kbar)

**Game mechanic — PRESSURE POLYMORPHISM:** We already have temperature-dependent polymorphism (feldspar: sanidine→orthoclase→microcline). The Al₂SiO₅ system adds PRESSURE as a second axis. This is one of the most famous phase diagrams in all of petrology. Every geology student learns it.
**Color:** Kyanite = blue (Fe/Ti). Andalusite = pink-brown (Mn), cross-sectional color zoning ("chiastolite" variety with carbon inclusions in a cross pattern). Sillimanite = white/fibrous.
**Why it's interesting for the game:**
- **The pressure axis enters the game.** Currently the simulator is mostly temperature-driven. Al₂SiO₅ makes pressure a real gameplay variable. Which polymorph you get depends on WHERE in the crust your vug sits.
- **Feldspar sister** — same ingredients (Al + Si), different proportions. If you have excess Al beyond what feldspar needs, AND Si available, you get these. Feldspar is the first Al mineral, Al₂SiO₅ is what happens when the ratio tips.
- **Metamorphic indicator** — in real geology, finding kyanite vs andalusite tells you the P-T history of the rock. Same information in the game: which polymorph you grew proves your vug's conditions.
- **Caveat:** These are primarily metamorphic, not hydrothermal cavity minerals. Kyanite occurs in quartz veins in high-P metamorphic terrains, but andalusite and sillimanite are less common in vugs. May need to be tied to a specific scenario (metamorphic vein scenario?).

### 5. Spinel (sensu stricto) — MgAl₂O₄
**Needs:** Al + Mg... wait. **We don't have Mg in the broth.** 
**Status: Needs new element (Mg).** Moving to Tier 2.

---

## Tier 2: Need One New Element

### 5. Spinel — MgAl₂O₄
**Needs:** Mg (NEW) + Al
**Conditions:** Contact metamorphism of Mg-rich carbonate (dolomite) by Al-rich fluids. 600-900°C. Classic skarn mineral in dolomitic marble. Also in some mafic/ultramafic environments.
**New element: Mg (magnesium)**
**Why add Mg:** Opens up dolomite (CaMg(CO₃)₂), diopside (CaMgSi₂O₆), forsterite/olivine (Mg₂SiO₄), tremolite, phlogopite mica, serpentine group. Mg is arguably the most impactful single element we could add — it connects carbonate, silicate, and contact metamorphic systems. BUT it's a major commitment in game complexity.
**Game mechanic — OCTAHEDRAL CRYSTAL:** Isometric, typically octahedral habit. Hard (7.5-8). Often twinned (spinel law — we already reference "spinel-law {111}" twinning in sphalerite!). Ruby-red with Cr, blue/black with Fe.
**Why it's interesting:** The sphalerite twinning we already narrate is NAMED after spinel. Adding actual spinel to the game gives the namesake mineral to a twin law the game already teaches. Meta-recursive.

### 6. Tourmaline — XY₃Z₆(T₆O₁₈)(BO₃)₃V₃W
**Needs:** B (boron, NEW) + Al + SiO2 + Na + Fe/Mg/Li
**New element: B (boron)**
**Conditions:** Pegmatitic to hydrothermal. Schorl (Fe-rich, black) is the most common tourmaline and forms in granitic pegmatites at 400-600°C. Elbaite (Li-rich) makes the gem-quality watermelon/green/pink tourmalines.
**Game mechanic — BORON CYCLE:** Tourmaline is the principal boron mineral. B is an incompatible element that concentrates in late-stage granitic melts. Tourmaline is the signal that a pegmatite is evolved — boron-enriched residual fluid.
**Color:** Schorl = black (Fe). Dravite = brown (Mg). Elbaite = green/pink/blue/watermelon (Li+trace). The most color-variable mineral family.
**Why it's interesting:**
- **Color zoning** — tourmaline is famous for concentric color zones (watermelon: pink core, green rim). The crystal records fluid composition changes in vivid color. Each growth zone is a different chapter.
- **Piezoelectric/pyroelectric** — tourmaline generates voltage when heated or compressed. Dutch traders used tourmaline crystals to pull ash from pipes ("aschentrekker"). Not directly a game mechanic but flavor text gold.
- **Indicator mineral** — tourmaline in a vug = evolved, volatile-rich system. It's the "this fluid has been cooking for a long time" signal.
- **Would need B and potentially Li** — two new elements. Li also opens lepidolite (Li-mica) and spodumene.

### 7. Topaz — Al₂SiO₄(F,OH)₂
**Needs:** Al + SiO2 + F (ALL PRESENT!)
**Wait — F is already in the broth.** Moving back to Tier 1.

---

## REVISED Tier 1 (no new elements)

### 5. Topaz — Al₂SiO₄(F,OH)₂
**Needs:** Al + SiO2 + F (all present!)
**Conditions:** 300-600°C. Forms in fluorine-rich hydrothermal systems (greisens), pegmatite vugs, and vapor-phase cavities in rhyolite. The F content has an interesting relationship with temperature: in hydrothermal topaz, F increases WITH temperature; in magmatic topaz, it's reversed.
**Game mechanic — FLUORINE COMPETITION:** Topaz and fluorite BOTH need F. Currently fluorite is the only F sink. Adding topaz creates a competition: F + Ca → fluorite, F + Al + Si → topaz. The player's broth chemistry determines which forms. High Ca = fluorite territory. High Al = topaz territory.
**Color:** Colorless, pale blue (natural), yellow-brown ("imperial topaz" from Ouro Preto, Brazil), pink (rare, Cr/heat-treated). Blue topaz in the gem market is almost always irradiated + heated.
**Why it's interesting for the game:**
- **Three-way competition:** Al is now contested by feldspar, muscovite, AND topaz. F is contested by fluorite and topaz. Every slider position changes the outcome.
- **Greisen scenario** — granite cooling with F-rich fluids. Feldspar alters to mica and topaz. Tin/tungsten ores associated. Classic Cornish tin mine environment.
- **Hardness 8** — the defining mineral for Mohs 8. Very hard, very stable. A late-game crystal.
- **The fluorine-temperature inversion** — hydrothermal topaz gets MORE fluorine-rich at higher T, which is unusual. Could be a game mechanic: the same broth at different temperatures produces topaz with different F:OH ratios, visible as different colors/properties.

---

## Summary: Recommended Build Order

### Phase 1 — Muscovite (mica)
**Why first:** Introduces sheet silicates, competes with feldspar for K+Al, acts as substrate for other minerals. Minimal new code — similar nucleation logic to feldspar but with different Al:Si ratio requirement. Creates the "peraluminous fork" — high Al pushes toward mica over feldspar.

### Phase 2 — Topaz
**Why second:** Uses existing F element in a new way. Creates three-way F competition (fluorite vs topaz). Straightforward chemistry (Al₂SiO₄(F,OH)₂). Introduces the greisen pathway.

### Phase 3 — Garnet (grossular/spessartine/almandine)
**Why third:** Three varieties from existing elements (Ca/Mn/Fe + Al + Si). Introduces nesosilicate structure. Competes with calcite for Ca. Growth zoning is a natural fit for the Record Groove. Could enable a skarn scenario.

### Phase 4 — Corundum (sapphire)
**Why fourth:** The trophy mineral. Requires strategic silica depletion — rewards deep system understanding. Blue sapphire from Fe+Ti already available. Introduces the concept of exclusion (anti-quartz).

### Phase 5 (stretch) — Al₂SiO₅ polymorphs
**Why later:** Requires adding pressure as a proper game axis. More complex. More metamorphic than hydrothermal. But the phase diagram is one of the most teachable things in petrology.

### Deferred — Tourmaline (needs B), Spinel (needs Mg), Beryl (needs Be)
These are spectacular minerals but each requires a new element. Save for a future "pegmatite scenario" expansion where B, Li, Be, Mg all come in together.

---

## New Broth Element Candidates (for future reference)

| Element | What it unlocks | Priority |
|---------|----------------|----------|
| **Mg** | Spinel, dolomite, olivine, diopside, serpentine, tremolite, phlogopite | HIGH — opens entire mafic/ultramafic/skarn mineral suite |
| **B** | Tourmaline (schorl, dravite, elbaite), axinite | MEDIUM — spectacular but narrow |
| **Li** | Elbaite tourmaline, lepidolite, spodumene, petalite | LOW — very specialized pegmatite |
| **Be** | Beryl (emerald, aquamarine), chrysoberyl | LOW — rare element, one mineral family |
| **Cr** | Ruby (corundum + Cr), chrome diopside, fuchsite, uvarovite | LOW — trace element, colors existing minerals |
| **P** | Apatite, turquoise, lazulite, augelite | MEDIUM — apatite is very common and would add biology connection |

---

## Key Geological Principles for Implementation

1. **The peraluminous threshold:** When Al exceeds what feldspar can incorporate (Al > K + Na + 2Ca in molar terms), the excess Al must go somewhere else: muscovite, garnet, Al₂SiO₅ polymorphs, topaz, or corundum. This is the ALUMINUM SATURATION INDEX (ASI). ASI > 1 = peraluminous = muscovite/garnet/topaz territory.

2. **Silica activity controls everything:** High SiO2 → quartz + feldspar + mica + topaz. Low SiO2 → corundum + spinel. You cannot have corundum AND quartz in the same vug at the same time (thermodynamically forbidden at equilibrium). This is the most important constraint and creates the deepest strategic decision.

3. **Temperature cascades:** As a pegmatite/hydrothermal system cools:
   - 700-600°C: feldspar (sanidine), muscovite begins
   - 600-500°C: feldspar (orthoclase), muscovite, garnet (skarn conditions)
   - 500-400°C: topaz (greisen), feldspar (microcline), kyanite (high P)
   - 400-300°C: adularia, late muscovite
   - <300°C: clay minerals (kaolinite from feldspar weathering)

4. **Competition networks:**
   - K: feldspar vs muscovite
   - Al: feldspar vs muscovite vs topaz vs garnet vs corundum vs Al₂SiO₅
   - F: fluorite vs topaz
   - Ca: calcite vs garnet (grossular)
   - SiO2: quartz vs everything that uses silica... vs corundum (which needs silica ABSENT)

These competition networks are where the game mechanics live. Every mineral added to the Al system creates new strategic branches.

---

*Research for Vugg Simulator development. See also: memory/research-feldspar-vugg.md (feldspar research from 2026-04-01)*
